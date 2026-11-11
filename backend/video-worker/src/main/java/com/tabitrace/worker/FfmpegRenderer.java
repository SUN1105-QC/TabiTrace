package com.tabitrace.worker;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

/**
 * 按 API 冻结的分镜渲染 Travel Story：
 *   PREPARING 下载解码照片 → STORY 开场 / 地点 / 结尾帧 → MUSIC 校验音乐 → EXPORTING xfade 转场 + 混音导出 MP4。
 * 每个阶段失败都抛带错误码的 RenderFailure，前端据此显示「素材下载失败 / 画面生成失败 / 视频合成失败」等。
 * 音乐例外：音乐文件不存在、下载失败或混音失败时不让整个视频失败，改用无音乐继续生成，并上报 MUSIC_FALLBACK 告警。
 * 速度：照片下载解码和画面绘制按 render-threads 并行（结果与顺序执行逐像素一致）；导出时静止段每张图只处理一次，
 * 转场单独合成后拼接，成片与原先「每帧解码 + xfade 长链」的做法逐帧一致（见 encode）。
 */
@Component
public class FfmpegRenderer {
    /** 渲染进度回调：阶段名 + 百分比；warn 上报「生成成功但有降级」（例如 MUSIC_FALLBACK） */
    public interface Progress {
        void report(String stage, int progress);
        default void warn(String code) {}
    }

    public static final String MUSIC_FALLBACK = "MUSIC_FALLBACK";
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(FfmpegRenderer.class);

    private static final Set<String> TRANSITIONS = Set.of("fade", "fadeblack", "fadewhite", "dissolve", "slideleft",
            "slideright", "slideup", "slidedown", "wipeleft", "wiperight", "smoothleft", "smoothright", "circleopen");
    private static final int FPS = 30;

    private record Shot(Path file, double seconds) {
        Shot withSeconds(double s) { return new Shot(file, s); }
    }
    /** 冻结在分镜里的音乐片段：从原曲第 start 秒开始，统一响度增益 + 用户音量，淡入淡出 */
    /** loudnorm：没有预先测过响度（「我的音乐」）时，用 FFmpeg loudnorm 实时统一到 -16 LUFS，代替固定增益 */
    private record MusicPlan(Path file, double start, double gainDb, double volume, double fadeIn, double fadeOut, String credit, boolean loudnorm) {}

    private final JdbcTemplate jdbc;
    private final String ffmpeg;
    private final Path workDir;
    private final Path musicDir;
    private final Path musicCacheDir;
    private final WorkerStorage storage;
    private final long ffmpegTimeoutSeconds;
    /** 并行下载解码 / 绘制的线程数（每个线程同一时刻只持有一张原图，内存随线程数而不是照片数增长） */
    private final int threads;
    private final HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();
    private final ObjectMapper json = JsonMapper.builder().build();

    public FfmpegRenderer(JdbcTemplate jdbc, String ffmpeg, String workDir, String musicDir, long ffmpegTimeoutSeconds,
                          String musicCacheDir, WorkerStorage storage) {
        this(jdbc, ffmpeg, workDir, musicDir, ffmpegTimeoutSeconds, musicCacheDir, storage, 0);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public FfmpegRenderer(
            JdbcTemplate jdbc,
            @Value("${worker.ffmpeg-binary:ffmpeg}") String ffmpeg,
            @Value("${worker.work-dir:./video-output}") String workDir,
            @Value("${worker.music-dir:./video-music}") String musicDir,
            @Value("${worker.ffmpeg-timeout-seconds:600}") long ffmpegTimeoutSeconds,
            @Value("${worker.music-cache-dir:${java.io.tmpdir}/tabitrace-music}") String musicCacheDir,
            WorkerStorage storage,
            @Value("${worker.render-threads:0}") int renderThreads) {
        this.threads = renderThreads > 0 ? renderThreads : Math.max(2, Runtime.getRuntime().availableProcessors());
        this.musicCacheDir = Path.of(musicCacheDir);
        this.storage = storage;
        this.jdbc = jdbc;
        this.ffmpeg = ffmpeg;
        this.workDir = Path.of(workDir);
        this.musicDir = Path.of(musicDir);
        this.ffmpegTimeoutSeconds = ffmpegTimeoutSeconds;
    }

    public Path render(VideoJob job, Progress progress) throws Exception {
        Path dir = workDir.resolve("project-" + job.id());
        resetDir(dir);
        try {
            return renderIn(dir, job, progress);
        } catch (Exception ex) {
            // 工作目录可能在 public 下：失败时下载的原始照片同样不能留在可公开访问的位置。
            // 停机中断时线程带着中断标记，先清掉再删（否则删除重试会立刻放弃），删完再恢复
            boolean interrupted = Thread.interrupted();
            deleteContents(dir, null);
            if (interrupted) Thread.currentThread().interrupt();
            throw ex;
        }
    }

    /** 成片已上传到对象存储：删除本地工作目录（容器磁盘不会随渲染次数增长） */
    public void discard(long jobId) {
        Path dir = workDir.resolve("project-" + jobId);
        deleteContents(dir, null);
        try { Files.deleteIfExists(dir); } catch (IOException ignored) { /* 目录非空或被占用：启动清扫会再处理 */ }
    }

    private Path renderIn(Path dir, VideoJob job, Progress progress) throws Exception {
        JsonNode sb = storyboard(job);
        int[] size = resolution(sb.path("resolution").asText("720×1280"));
        ScenePainter painter = new ScenePainter(size[0], size[1], job.templateCode(), sb.path("watermark").asBoolean(true));
        List<JsonNode> scenes = new ArrayList<>();
        for (JsonNode sc : sb.path("scenes")) {
            if (sc.path("enabled").asBoolean(true) && sc.path("duration").asDouble(0) > 0) scenes.add(sc);
        }
        if (scenes.isEmpty()) throw new RenderFailure("STORYBOARD_EMPTY", "分镜里没有可渲染的段落，请返回编辑后重新生成");

        // ── PREPARING：并行下载照片并解码成 JPEG（只写到工作目录，绘制时再逐张读入，不同时常驻内存） ──
        long started = System.nanoTime();
        progress.report("PREPARING", 10);
        Photos photos = preparePhotos(dir, scenes);

        // ── STORY：开场 / 地点照片 / 结尾。先按原顺序排好镜头和画面编号，再并行绘制 ──
        long prepared = System.nanoTime();
        progress.report("STORY", 50);
        Map<String, List<Shot>> byScene = new HashMap<>();
        List<Callable<Shot>> paints = new ArrayList<>();
        List<Runnable> fill = new ArrayList<>();
        List<Shot> painted = new ArrayList<>();
        int photoTotal = (int) scenes.stream().filter(sc -> "PLACE".equals(sc.path("type").asText()))
                .mapToLong(sc -> sc.path("photoIds").size()).sum();
        int photoIndex = 0, frameNo = 0;
        for (JsonNode sc : scenes) {
            String type = sc.path("type").asText();
            List<Shot> shots = new ArrayList<>();
            double seconds = sc.path("duration").asDouble();
            String title = text(sc, "title"), subtitle = text(sc, "subtitle");
            JsonNode meta = sc.path("meta");
            switch (type) {
                case "OPENING" -> {
                    int frame = ++frameNo;
                    Long cover = firstImageId(sc, photos.files());
                    paint(paints, fill, painted, shots, () -> write(dir, frame, painter.opening(read(photos, cover),
                            text(meta, "kicker"), title, subtitle, text(meta, "destination")), seconds));
                }
                case "PLACE" -> {
                    List<Long> ids = ids(sc.path("photoIds"));
                    JsonNode shotSeconds = meta.path("shots");
                    // 旧版本分镜在地点开头留给路线动画的时长（meta.leg.seconds）并入第一张照片，总时长不变
                    double extra = meta.path("leg").path("seconds").asDouble(0);
                    for (int i = 0; i < ids.size(); i++) {
                        photoIndex++;
                        double s = (shotSeconds.has(i) ? shotSeconds.get(i).asDouble() : (seconds - extra) / ids.size()) + (i == 0 ? extra : 0);
                        Long id = ids.get(i);
                        // 照片在排队期间被删：跳过这一张，时长并入相邻镜头
                        if (!photos.files().containsKey(id)) { shots.add(new Shot(null, s)); continue; }
                        int frame = ++frameNo, index = photoIndex;
                        boolean first = i == 0;
                        paint(paints, fill, painted, shots, () -> write(dir, frame, painter.photo(read(photos, id), title, subtitle,
                                text(meta, "note"), first, index, photoTotal), s));
                    }
                }
                case "ENDING" -> {
                    int frame = ++frameNo;
                    Long cover = firstImageId(sc, photos.files());
                    paint(paints, fill, painted, shots, () -> write(dir, frame, painter.ending(read(photos, cover), title, subtitle,
                            text(meta, "stats"), text(meta, "endingText"), text(meta, "tagline")), seconds));
                }
                // 旧版本分镜里的已下线段落：不再渲染，时长并入相邻镜头（总时长不变）
                default -> shots.add(new Shot(null, seconds));
            }
            byScene.put(sc.path("key").asText(), shots);
        }
        try {
            painted.addAll(runAll(paints));
        } catch (RenderFailure | InterruptedException | RuntimeException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new RenderFailure("STORY_FAILED", "旅行故事画面生成失败", ex);
        }
        fill.forEach(Runnable::run);
        long drawn = System.nanoTime();

        List<Shot> timeline = new ArrayList<>();
        for (JsonNode sc : scenes) timeline.addAll(byScene.getOrDefault(sc.path("key").asText(), List.of()));
        timeline = mergeMissing(timeline);
        if (timeline.isEmpty()) throw new RenderFailure("PHOTO_DOWNLOAD_FAILED", "素材下载失败：没有可用的照片");

        // ── MUSIC ──
        progress.report("MUSIC", 70);
        MusicPlan music = music(job, sb, progress);
        // 需要署名的音乐（CC BY）：在最后一个画面的副本底部写上作者与授权（原图保留，混音失败回退无音乐时不带署名）
        List<Shot> withCredit = music != null && music.credit() != null ? creditLastShot(timeline, music.credit()) : timeline;

        // ── EXPORTING ──
        progress.report("EXPORTING", 80);
        String transition = sb.path("transition").asText("fade");
        String tr = TRANSITIONS.contains(transition) ? transition : "fade";
        double trSeconds = sb.path("transitionSeconds").asDouble(0.5);
        String grade = sb.path("grade").asText("NATURAL");
        Path output;
        try {
            output = encode(dir, withCredit, tr, trSeconds, music, job.duration(), size, grade);
        } catch (RenderFailure ex) {
            if (music == null || Thread.currentThread().isInterrupted()) throw ex;
            // 音频损坏等导致混音失败：去掉音乐再合成一次，视频仍然生成
            log.warn("视频项目 {} 混音失败，改用无音乐生成：{}", job.id(), ex.getMessage());
            progress.warn(MUSIC_FALLBACK);
            output = encode(dir, timeline, tr, trSeconds, null, job.duration(), size, grade);
        }

        cleanupIntermediate(dir, output);
        long done = System.nanoTime();
        log.info("视频项目 {} 渲染完成：{} 秒 {}，{} 个镜头，准备 {}s / 绘制 {}s / 导出 {}s，共 {}s", job.id(), job.duration(), job.quality(),
                timeline.size(), secs(prepared - started), secs(drawn - prepared), secs(done - drawn), secs(done - started));
        return output;
    }

    private static String secs(long nanos) { return String.format(Locale.ROOT, "%.1f", nanos / 1e9); }

    // ───────────── 分镜与素材 ─────────────

    private JsonNode storyboard(VideoJob job) throws RenderFailure {
        if (job.storyboardJson() == null || job.storyboardJson().isBlank()) {
            throw new RenderFailure("STORYBOARD_MISSING", "分镜数据缺失，请返回编辑后重新生成");
        }
        try {
            return json.readTree(job.storyboardJson());
        } catch (Exception ex) {
            throw new RenderFailure("STORYBOARD_MISSING", "分镜数据无法解析，请返回编辑后重新生成", ex);
        }
    }

    /** files：成功解码的照片（插入顺序与原先的照片表一致，决定开场 / 结尾缺图时的兜底顺序）；ordinal：报错时的「第 n 张」 */
    private record Photos(Map<Long, Path> files, Map<Long, Integer> ordinal) {}

    private Photos preparePhotos(Path dir, List<JsonNode> scenes) throws Exception {
        Set<Long> wanted = new LinkedHashSet<>();
        scenes.forEach(sc -> wanted.addAll(ids(sc.path("photoIds"))));
        Map<Long, String> urls = new HashMap<>();
        if (!wanted.isEmpty()) {
            String in = String.join(",", Collections.nCopies(wanted.size(), "?"));
            jdbc.query("SELECT id,image_url FROM photos WHERE id IN (" + in + ")",
                    rs -> { urls.put(rs.getLong(1), rs.getString(2)); }, wanted.toArray());
        }
        List<Long> order = new ArrayList<>();
        Map<Long, Integer> ordinal = new HashMap<>();
        for (Long id : wanted) {
            if (urls.get(id) == null) continue; // 照片已被删除：由调用方跳过
            order.add(id);
            ordinal.put(id, order.size());
        }
        List<Callable<Path>> tasks = new ArrayList<>();
        for (Long id : order) tasks.add(() -> {
            Path raw = dir.resolve("raw-" + id);
            Path decoded = dir.resolve("decoded-" + id + ".jpg");
            try {
                if (!download(urls.get(id), raw)) return null; // 404 / 410：存储里的文件已不存在，同样跳过
                // 统一交给 FFmpeg 解码（webp / png / heic 都能读），绘制时再用 ImageIO 读入
                exec(dir, List.of(ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", raw.getFileName().toString(),
                        "-frames:v", "1", "-q:v", "2", decoded.getFileName().toString()));
                if (!Files.isRegularFile(decoded) || Files.size(decoded) == 0) throw new IOException("无法解码图片");
                return decoded;
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw ex;
            } catch (Exception ex) {
                throw new RenderFailure("PHOTO_DOWNLOAD_FAILED", "素材下载失败：第 " + ordinal.get(id) + " 张照片无法读取", ex);
            }
        });
        List<Path> results = runAll(tasks);
        Map<Long, Path> files = new HashMap<>();
        for (int i = 0; i < order.size(); i++) if (results.get(i) != null) files.put(order.get(i), results.get(i));
        return new Photos(files, ordinal);
    }

    /** 读入解码后的照片；读不出来按「素材下载失败」处理（与原先在准备阶段读入时的错误一致） */
    private static BufferedImage read(Photos photos, Long id) throws RenderFailure {
        if (id == null) return null;
        try {
            BufferedImage img = ImageIO.read(photos.files().get(id).toFile());
            if (img == null) throw new IOException("无法解码图片");
            return img;
        } catch (IOException ex) {
            throw new RenderFailure("PHOTO_DOWNLOAD_FAILED", "素材下载失败：第 " + photos.ordinal().get(id) + " 张照片无法读取", ex);
        }
    }

    /** 先在镜头列表里占位，绘制完成后按提交顺序回填（镜头顺序和画面编号与串行时一致） */
    private static void paint(List<Callable<Shot>> paints, List<Runnable> fill, List<Shot> painted, List<Shot> shots, Callable<Shot> task) {
        int slot = shots.size(), index = paints.size();
        shots.add(null);
        paints.add(task);
        fill.add(() -> shots.set(slot, painted.get(index)));
    }

    /**
     * 用 threads 个线程执行，按提交顺序返回结果。任一任务失败就停止其余任务（中断正在运行的 FFmpeg），
     * 抛出提交顺序最靠前的失败——与串行执行时报告的是同一项。调用线程被中断（Worker 停机）时同样停止全部任务。
     */
    private <T> List<T> runAll(List<Callable<T>> tasks) throws Exception {
        if (tasks.isEmpty()) return List.of();
        AtomicInteger n = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(threads, tasks.size()), r -> {
            Thread t = new Thread(r, "video-render-" + n.incrementAndGet());
            t.setDaemon(true);
            return t;
        });
        try {
            List<Future<T>> futures = new ArrayList<>();
            for (Callable<T> task : tasks) futures.add(pool.submit(task));
            List<T> out = new ArrayList<>(tasks.size());
            for (Future<T> f : futures) {
                try {
                    out.add(f.get());
                } catch (ExecutionException ex) {
                    pool.shutdownNow();
                    if (ex.getCause() instanceof Exception e) throw e;
                    if (ex.getCause() instanceof Error e) throw e;
                    throw ex;
                }
            }
            return out;
        } finally {
            pool.shutdownNow();
            // 等子线程收尾（被中断的 FFmpeg 已强制结束），再让调用方清理工作目录；保留调用线程的中断标记
            boolean interrupted = Thread.interrupted();
            try {
                pool.awaitTermination(30, TimeUnit.SECONDS);
            } catch (InterruptedException ex) {
                interrupted = true;
            }
            if (interrupted) Thread.currentThread().interrupt();
        }
    }

    /** 缺图的镜头时长并入前一个（没有前一个就并入后一个），保证总时长不变。 */
    private static List<Shot> mergeMissing(List<Shot> shots) {
        List<Shot> out = new ArrayList<>();
        double carry = 0;
        for (Shot s : shots) {
            if (s.file() == null) {
                if (out.isEmpty()) carry += s.seconds();
                else out.set(out.size() - 1, out.get(out.size() - 1).withSeconds(out.get(out.size() - 1).seconds() + s.seconds()));
                continue;
            }
            out.add(s.withSeconds(s.seconds() + carry));
            carry = 0;
        }
        return out;
    }

    // ───────────── 导出 ─────────────

    /**
     * 视觉风格 → 成片调色滤镜，在转场链之后、输出格式之前整体套用。
     * NATURAL 不调色；其余为轻度调整，保证文字与水印依旧清晰。
     */
    /**
     * 调色拆成两段：静态部分（逐像素、与帧序无关）对每张静止画面只算一次，对转场帧在混合之后计算；
     * 时域部分（FILM 的颗粒随帧变化、其后的暗角）仍逐帧作用在整条视频上。两段按原顺序拼起来与 gradeFilter 完全相同。
     */
    static String[] gradeParts(String grade) {
        return switch (grade == null ? "" : grade) {
            case "FILM" -> new String[]{"eq=contrast=1.06:saturation=0.8:gamma=0.97,colorbalance=rs=0.05:gs=0.01:bs=-0.04:rh=0.04:bh=-0.05,",
                    "noise=alls=7:allf=t,vignette=angle=PI/5,"};
            default -> new String[]{gradeFilter(grade), ""};
        };
    }

    static String gradeFilter(String grade) {
        return switch (grade == null ? "" : grade) {
            // 日系清新：提亮、降对比与饱和，暗部略偏青蓝
            case "FRESH" -> "eq=brightness=0.035:contrast=0.94:saturation=0.86,colorbalance=rs=-0.02:bs=0.04:bm=0.02,";
            // 电影胶片：暖高光、冷暗部、轻颗粒与暗角
            case "FILM" -> "eq=contrast=1.06:saturation=0.8:gamma=0.97,colorbalance=rs=0.05:gs=0.01:bs=-0.04:rh=0.04:bh=-0.05,"
                    + "noise=alls=7:allf=t,vignette=angle=PI/5,";
            // 城市质感：高对比、低饱和、整体偏冷
            case "URBAN" -> "eq=contrast=1.12:saturation=0.72:brightness=-0.015,colorbalance=rs=-0.02:bs=0.05:bm=0.03:rh=0.03,";
            default -> "";
        };
    }

    private Path encode(Path dir, List<Shot> shots, String transition, double transitionSeconds, MusicPlan music,
                        int duration, int[] size, String grade) throws RenderFailure {
        double minShot = shots.stream().mapToDouble(Shot::seconds).min().orElse(1);
        double t = shots.size() < 2 ? 0 : round3(Math.max(0.1, Math.min(transitionSeconds, minShot * 0.45)));

        List<String> cmd = new ArrayList<>(List.of(ffmpeg, "-y", "-hide_banner", "-loglevel", "error"));
        // 每张画面只作为一帧输入：解码、缩放、转格式各只做一次（原先 -loop 1 会对每一帧重复解码和缩放）
        for (Shot shot : shots) cmd.addAll(List.of("-framerate", String.valueOf(FPS), "-i", shot.file().getFileName().toString()));
        if (music != null) cmd.addAll(List.of("-stream_loop", "-1", "-ss", fmt(music.start()), "-i", music.file().toAbsolutePath().toString()));
        StringBuilder f = new StringBuilder(videoGraph(shots, transition, t, duration, size, grade));
        if (music != null) {
            f.append(";[").append(shots.size()).append(":a]")
                    .append(music.loudnorm() ? "loudnorm=I=-16:TP=-1.5:LRA=11" : "volume=" + fmt(music.gainDb()) + "dB")
                    .append(",volume=").append(fmt(music.volume()))
                    .append(",alimiter=limit=0.95:level=disabled,afade=t=in:st=0:d=").append(fmt(music.fadeIn()))
                    .append(",afade=t=out:st=").append(fmt(Math.max(0, duration - music.fadeOut()))).append(":d=").append(fmt(music.fadeOut())).append("[aout]");
        }

        Path output = dir.resolve("output.mp4");
        cmd.addAll(List.of("-filter_complex", f.toString(), "-map", "[vout]"));
        if (music != null) cmd.addAll(List.of("-map", "[aout]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"));
        cmd.addAll(List.of("-t", String.valueOf(duration), "-r", String.valueOf(FPS), "-c:v", "libx264", "-preset", "veryfast",
                "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output.getFileName().toString()));
        try {
            exec(dir, cmd);
        } catch (Exception ex) {
            throw new RenderFailure("ENCODE_FAILED", "视频合成失败", ex);
        }
        try {
            if (!Files.isRegularFile(output) || Files.size(output) == 0) throw new IOException("输出文件为空");
        } catch (IOException ex) {
            throw new RenderFailure("ENCODE_FAILED", "视频合成失败：没有生成 MP4 文件", ex);
        }
        return output;
    }

    /**
     * 视频滤镜图，输出 [vout]。成片与原先「每个镜头循环输入 + xfade 首尾相连 + 整体调色」逐帧一致，但快得多：
     * - 原先的 xfade 链里，每一帧（包括转场以外的静止帧）都要经过 xfade 处理；这里静止段的画面只经过一次
     *   fade 型 xfade（取进度 1 的第一帧，与原先的静止帧逐像素相同，且与所选转场无关），然后直接复制帧；
     * - 每个转场单独用两张画面合成 D 帧（与原链路相同的起点帧和进度），再按时间顺序 concat；
     * - 静态调色对静止画面只算一次、对转场帧在混合后计算；时域调色（颗粒等）仍逐帧作用在整条视频上。
     * 帧位置按 FFmpeg 的取整规则计算：秒数先按 3 位小数格式化，换算成微秒后再四舍五入到帧。
     */
    static String videoGraph(List<Shot> shots, String transition, double t, int duration, int[] size, String grade) {
        String[] parts = gradeParts(grade);
        String still = parts[0], temporal = parts[1];
        int n = shots.size(), total = duration * FPS;
        int d = n < 2 ? 0 : frames(t);
        int[] start = new int[n]; // 第 k 个转场（进入第 k 个镜头）的起始帧
        double offset = 0;
        for (int k = 1; k < n; k++) { offset += shots.get(k - 1).seconds(); start[k] = frames(offset); }
        String setpts = "setpts=N/(" + FPS + "*TB)";
        String xfade = "xfade=transition=" + transition + ":duration=" + fmt(t) + ":offset=0";
        // 原链路里转场以外的帧也经过 xfade 的内部处理，结果与所选转场无关，等于 fade 在进度 1 的输出
        String settle = "xfade=transition=fade:duration=" + fmt(t) + ":offset=0";
        StringBuilder f = new StringBuilder();
        List<String> pieces = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            List<String> outs = new ArrayList<>(List.of("s" + i));
            if (n > 1) outs.add("z" + i);
            if (i > 0) outs.add("b" + i);
            if (i < n - 1) outs.add("a" + i);
            f.append('[').append(i).append(":v]scale=").append(size[0]).append(':').append(size[1]).append(",setsar=1,format=yuv420p");
            if (outs.size() > 1) {
                f.append(",split=").append(outs.size());
                for (String o : outs) f.append('[').append(o).append(']');
            } else {
                f.append("[s").append(i).append(']');
            }
            f.append(';');
        }
        for (int i = 0; i < n; i++) {
            if (i > 0) {
                String piece = "p" + pieces.size();
                f.append("[a").append(i - 1).append("]loop=loop=").append(d).append(":size=1:start=0,").append(setpts).append("[ta").append(i).append("];")
                        .append("[b").append(i).append("]loop=loop=").append(d).append(":size=1:start=0,").append(setpts).append("[tb").append(i).append("];")
                        .append("[ta").append(i).append("][tb").append(i).append(']').append(xfade).append(",trim=end_frame=").append(d).append(',')
                        .append(setpts).append(',').append(still).append("null[").append(piece).append("];");
                pieces.add(piece);
            }
            int from = i == 0 ? 0 : start[i] + d, to = i == n - 1 ? total : start[i + 1], count = to - from;
            if (count <= 0) {
                f.append("[s").append(i).append("]nullsink;");
                if (n > 1) f.append("[z").append(i).append("]nullsink;");
                continue;
            }
            String piece = "p" + pieces.size();
            f.append("[s").append(i).append(']');
            // 只有一个镜头时原先没有 xfade，静止画面保持原样
            if (n > 1) f.append("[z").append(i).append(']').append(settle).append(",trim=end_frame=1,").append(setpts).append(',');
            f.append(still).append("loop=loop=").append(count - 1).append(":size=1:start=0,").append(setpts).append('[').append(piece).append("];");
            pieces.add(piece);
        }
        for (String p : pieces) f.append('[').append(p).append(']');
        f.append("concat=n=").append(pieces.size()).append(":v=1:a=0,").append(temporal).append("format=yuv420p[vout]");
        return f.toString();
    }

    /** 与 FFmpeg 一致的秒 → 帧换算：按 3 位小数的字符串解析成微秒，再按 1/FPS 四舍五入 */
    static int frames(double seconds) {
        long us = Math.round(Double.parseDouble(fmt(seconds)) * 1_000_000d);
        return (int) Math.floorDiv(us * FPS + 500_000L, 1_000_000L);
    }

    /**
     * 解析冻结在分镜里的音乐。音乐不可用（存储下载失败、文件不存在或为空）时返回 null 并上报 MUSIC_FALLBACK：
     * 视频照常生成（无音乐），而不是整条任务失败。
     */
    private MusicPlan music(VideoJob job, JsonNode sb, Progress progress) {
        JsonNode m = sb.path("music");
        if (m.isObject() && !m.path("objectKey").asText("").isBlank()) {
            if (m.path("volume").asDouble(0.5) <= 0) return null;
            String title = m.path("title").asText(job.musicCode());
            boolean user = "USER".equals(m.path("source").asText(""));
            Path file;
            try {
                if (user) {
                    // 「我的音乐」：不只相信分镜里的路径，按 id 重新核对音乐属于这个视频的主人、文件还没被清理
                    String reason = verifyUserMusic(job, m.path("userMusicId").asLong(0), m.path("objectKey").asText());
                    if (reason != null) return fallback(job, progress, "自定义音乐「" + title + "」" + reason);
                    file = storage.userMusic(m.path("objectKey").asText(), job.userId(), musicDir, musicCacheDir);
                } else {
                    file = storage.music(m.path("objectKey").asText(), musicDir, musicCacheDir);
                }
            } catch (Exception ex) {
                return fallback(job, progress, "背景音乐「" + title + "」读取失败：" + ex.getMessage());
            }
            if (!usableAudio(file)) return fallback(job, progress, "背景音乐「" + title + "」的音频文件不存在或为空");
            String credit = m.path("creditShort").isTextual() ? m.path("creditShort").asText() : null;
            return new MusicPlan(file, m.path("startSeconds").asDouble(0), m.path("gainDb").asDouble(0), m.path("volume").asDouble(0.5),
                    m.path("fadeInSeconds").asDouble(1.0), m.path("fadeOutSeconds").asDouble(1.8), credit, m.path("loudnorm").asBoolean(false));
        }
        // 旧分镜（没有冻结音乐片段）：按音乐代码在本地目录查找，从头播放
        if (job.musicCode() == null || job.musicCode().isBlank() || "NONE".equalsIgnoreCase(job.musicCode())) return null;
        Path legacy = resolveMusic(job.musicCode());
        return legacy == null ? fallback(job, progress, "音乐「" + job.musicCode() + "」的音频文件不存在") : new MusicPlan(legacy, 0, 0, 0.5, 1.0, 1.8, null, false);
    }

    /** 核对「我的音乐」：属于这个视频的主人、存储路径一致、文件还没被清理。通过返回 null，否则返回原因 */
    private String verifyUserMusic(VideoJob job, long musicId, String key) {
        List<java.util.Map<String, Object>> rows = jdbc.queryForList("SELECT user_id, storage_key, purged_at FROM user_music WHERE id=?", musicId);
        if (rows.isEmpty()) return "不存在";
        java.util.Map<String, Object> r = rows.get(0);
        if (job.userId() == null || ((Number) r.get("user_id")).longValue() != job.userId()) return "不属于这个视频的主人";
        if (!key.equals(r.get("storage_key"))) return "存储路径不一致";
        if (r.get("purged_at") != null) return "的文件已被清理";
        return null;
    }

    private static MusicPlan fallback(VideoJob job, Progress progress, String reason) {
        log.warn("视频项目 {} 改用无音乐生成（MUSIC_FALLBACK）：{}", job.id(), reason);
        progress.warn(MUSIC_FALLBACK);
        return null;
    }

    private static boolean usableAudio(Path file) {
        try { return file != null && Files.isRegularFile(file) && Files.size(file) > 1024; } catch (IOException ex) { return false; }
    }

    /** 在最后一个画面的副本上写署名，返回替换了最后一个画面的新时间线（原图不改） */
    private static List<Shot> creditLastShot(List<Shot> timeline, String credit) throws RenderFailure {
        Shot last = timeline.get(timeline.size() - 1);
        Path file = last.file().resolveSibling("credit-" + last.file().getFileName());
        try {
            BufferedImage img = ImageIO.read(last.file().toFile());
            if (img == null) return timeline;
            BufferedImage rgb = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = rgb.createGraphics();
            g.drawImage(img, 0, 0, null);
            g.dispose();
            ScenePainter.creditOverlay(rgb, credit);
            ImageIO.write(rgb, "jpg", file.toFile());
        } catch (IOException ex) {
            throw new RenderFailure("STORY_FAILED", "片尾音乐署名生成失败", ex);
        }
        List<Shot> out = new ArrayList<>(timeline);
        out.set(out.size() - 1, new Shot(file, last.seconds()));
        return out;
    }

    /** 旧分镜：按音乐代码在本地目录查找音频；找不到时返回 null（由调用方回退无音乐） */
    private Path resolveMusic(String musicCode) {
        for (String extension : List.of(".mp3", ".wav", ".m4a", ".aac")) {
            Path candidate = musicDir.resolve(musicCode.toUpperCase(Locale.ROOT) + extension);
            if (Files.isRegularFile(candidate)) return candidate;
        }
        return null;
    }

    // ───────────── 文件与进程 ─────────────

    private static Shot write(Path dir, int frameNo, BufferedImage img, double seconds) throws IOException {
        Path file = dir.resolve(String.format(Locale.ROOT, "scene-%03d.jpg", frameNo));
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpg").next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(0.92f);
        try (ImageOutputStream out = ImageIO.createImageOutputStream(file.toFile())) {
            writer.setOutput(out);
            writer.write(null, new IIOImage(img, null, null), param);
        } finally {
            writer.dispose();
        }
        return new Shot(file, seconds);
    }

    /** 下载照片；返回 false 表示源文件已不存在（404 / 410）。 */
    private boolean download(String url, Path target) throws Exception {
        if (url.startsWith("file:")) {
            Path src = Path.of(URI.create(url));
            if (!Files.exists(src)) return false;
            Files.copy(src, target, StandardCopyOption.REPLACE_EXISTING);
            return true;
        }
        HttpResponse<Path> res = http.send(HttpRequest.newBuilder(URI.create(url)).GET().build(), HttpResponse.BodyHandlers.ofFile(target));
        if (res.statusCode() == 404 || res.statusCode() == 410) return false;
        if (res.statusCode() / 100 != 2) throw new IOException("HTTP " + res.statusCode());
        return true;
    }

    /** 输出写入临时日志而不是读管道，这样才能对卡死的 FFmpeg 施加硬超时（心跳会一直续命，必须由这里兜底）。 */
    private void exec(Path dir, List<String> cmd) throws Exception {
        Path logFile = Files.createTempFile(dir, "ffmpeg-", ".log");
        Process process = new ProcessBuilder(cmd).directory(dir.toFile()).redirectErrorStream(true)
                .redirectOutput(logFile.toFile()).start();
        try {
            boolean finished;
            try {
                finished = process.waitFor(ffmpegTimeoutSeconds, TimeUnit.SECONDS);
            } catch (InterruptedException ex) {
                // Worker 停机中断了渲染：FFmpeg 子进程不能留下来继续占用 CPU / 磁盘
                process.destroyForcibly();
                process.waitFor(10, TimeUnit.SECONDS);
                Thread.currentThread().interrupt();
                throw ex;
            }
            if (!finished) {
                process.destroyForcibly();
                process.waitFor(10, TimeUnit.SECONDS);
                throw new IOException("ffmpeg 超过 " + ffmpegTimeoutSeconds + " 秒没有完成，已强制结束");
            }
            if (process.exitValue() != 0) {
                String output = new String(Files.readAllBytes(logFile), StandardCharsets.UTF_8);
                String tail = output.length() > 800 ? output.substring(output.length() - 800) : output;
                throw new IOException("ffmpeg 退出码 " + process.exitValue() + "：" + tail.trim());
            }
        } finally {
            // 刚被强制结束的进程在 Windows 上会短暂占用文件；删除失败不能掩盖上面真正的错误
            deleteWithRetry(logFile);
        }
    }

    /**
     * 启动清扫：上次 Worker 若被强杀，来不及执行失败清理，下载的原始照片会留在（可能公开的）工作目录里。
     * 启动时没有任何任务在渲染：中间文件全部删除；output.mp4 只保留「已完成」项目的，
     * 强杀时写了一半的残缺视频同样删掉。返回删除的文件数。
     */
    public int sweepLeftovers() throws IOException { return sweepLeftovers(true); }

    /** keepCompletedOutputs=false：成片已在对象存储（r2 模式），本地 output.mp4 也一并删除 */
    public int sweepLeftovers(boolean keepCompletedOutputs) throws IOException {
        if (!Files.isDirectory(workDir)) return 0;
        Set<String> completed = new HashSet<>(jdbc.queryForList(
                "SELECT CONCAT('project-',id) FROM video_projects WHERE status='COMPLETED'", String.class));
        int removed = 0;
        try (Stream<Path> dirs = Files.list(workDir)) {
            for (Path d : dirs.filter(Files::isDirectory).filter(p -> p.getFileName().toString().startsWith("project-")).toList()) {
                boolean keepOutput = keepCompletedOutputs && completed.contains(d.getFileName().toString());
                try (Stream<Path> files = Files.list(d)) {
                    for (Path f : files.toList()) {
                        boolean isOutput = f.getFileName().toString().equals("output.mp4");
                        if ((!isOutput || !keepOutput) && Files.exists(f) && deleteWithRetry(f)) removed++;
                    }
                }
            }
        }
        return removed;
    }

    /** 重新生成时清掉上一次的产物，避免新旧帧混在一起。 */
    private static void resetDir(Path dir) throws IOException {
        if (Files.exists(dir)) deleteContents(dir, null);
        Files.createDirectories(dir);
    }

    /**
     * 尽力删除目录里除 keep 以外的所有文件：逐个删除，某个文件被占用时稍后重试，
     * 仍删不掉也继续删其余文件（绝不因为一个被锁的日志文件留下整批原始照片）。返回没删掉的文件数。
     */
    private static int deleteContents(Path dir, Path keep) {
        if (!Files.isDirectory(dir)) return 0;
        int failed = 0;
        try (Stream<Path> files = Files.list(dir)) {
            for (Path p : files.toList()) {
                if (p.equals(keep)) continue;
                if (!deleteWithRetry(p)) failed++;
            }
        } catch (IOException ex) {
            failed++;
        }
        return failed;
    }

    private static boolean deleteWithRetry(Path file) {
        for (int attempt = 0; attempt < 10; attempt++) {
            try {
                Files.deleteIfExists(file);
                return true;
            } catch (IOException ex) {
                try { Thread.sleep(200); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); return false; }
            }
        }
        return false;
    }

    /** 工作目录位于 public 下时，原始照片会被公开访问——导出成功后只保留 output.mp4。 */
    private static void cleanupIntermediate(Path dir, Path keep) {
        deleteContents(dir, keep);
    }

    /** 段落自己的第一张可用照片；都不可用时取任意一张（与原先按照片表遍历顺序取第一张一致） */
    private static Long firstImageId(JsonNode scene, Map<Long, Path> files) {
        for (Long id : ids(scene.path("photoIds"))) if (files.containsKey(id)) return id;
        return files.keySet().stream().findFirst().orElse(null);
    }

    private static List<Long> ids(JsonNode arr) {
        List<Long> out = new ArrayList<>();
        arr.forEach(n -> out.add(n.asLong()));
        return out;
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.path(field);
        return v.isMissingNode() || v.isNull() ? null : v.asText();
    }

    private static int[] resolution(String value) {
        String[] parts = value.split("[×x]");
        try {
            return new int[]{Integer.parseInt(parts[0].trim()), Integer.parseInt(parts[1].trim())};
        } catch (Exception ex) {
            return new int[]{720, 1280};
        }
    }

    private static double round3(double v) { return Math.round(v * 1000.0) / 1000.0; }

    private static String fmt(double v) { return String.format(Locale.ROOT, "%.3f", v); }
}
