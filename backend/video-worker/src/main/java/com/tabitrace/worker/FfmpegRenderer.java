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
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

/**
 * 按 API 冻结的分镜渲染 Travel Story：
 *   PREPARING 下载解码照片 → MAP 地图路线帧 → STORY 开场 / 地点 / 成就 / 结尾帧 → MUSIC 校验音乐 → EXPORTING xfade 转场 + 混音导出 MP4。
 * 每个阶段失败都抛带错误码的 RenderFailure，前端据此显示「素材下载失败 / 地图生成失败 / 视频合成失败」等。
 */
@Component
public class FfmpegRenderer {
    /** 渲染进度回调：阶段名 + 百分比 */
    public interface Progress { void report(String stage, int progress); }

    private static final Set<String> TRANSITIONS = Set.of("fade", "fadeblack", "fadewhite", "dissolve", "slideleft",
            "slideright", "slideup", "slidedown", "wipeleft", "wiperight", "smoothleft", "smoothright", "circleopen");
    private static final int MAX_MAP_FRAMES = 12;
    private static final int FPS = 30;

    private record Shot(Path file, double seconds) {}

    private final JdbcTemplate jdbc;
    private final String ffmpeg;
    private final Path workDir;
    private final Path musicDir;
    private final long ffmpegTimeoutSeconds;
    private final HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();
    private final ObjectMapper json = JsonMapper.builder().build();

    public FfmpegRenderer(
            JdbcTemplate jdbc,
            @Value("${worker.ffmpeg-binary:ffmpeg}") String ffmpeg,
            @Value("${worker.work-dir:./video-output}") String workDir,
            @Value("${worker.music-dir:./video-music}") String musicDir,
            @Value("${worker.ffmpeg-timeout-seconds:600}") long ffmpegTimeoutSeconds) {
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
            // 工作目录可能在 public 下：失败时下载的原始照片同样不能留在可公开访问的位置
            deleteContents(dir, null);
            throw ex;
        }
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

        // ── PREPARING：下载并解码照片 ──
        progress.report("PREPARING", 10);
        Map<Long, BufferedImage> images = loadPhotos(dir, scenes);

        // ── MAP：地图路线帧 ──
        Map<String, List<Shot>> byScene = new HashMap<>();
        int frameNo = 0;
        if (scenes.stream().anyMatch(sc -> "MAP".equals(sc.path("type").asText()))) {
            progress.report("MAP", 30);
            try {
                for (JsonNode sc : scenes) {
                    if (!"MAP".equals(sc.path("type").asText())) continue;
                    List<Shot> shots = renderMap(dir, painter, sc, frameNo);
                    frameNo += shots.size();
                    byScene.put(sc.path("key").asText(), shots);
                }
            } catch (Exception ex) {
                throw new RenderFailure("MAP_FAILED", "地图路线生成失败", ex);
            }
        }

        // ── STORY：开场 / 地点照片 / 成就 / 结尾 ──
        progress.report("STORY", 50);
        int photoTotal = (int) scenes.stream().filter(sc -> "PLACE".equals(sc.path("type").asText()))
                .mapToLong(sc -> sc.path("photoIds").size()).sum();
        int photoIndex = 0;
        try {
            for (JsonNode sc : scenes) {
                String type = sc.path("type").asText();
                if ("MAP".equals(type)) continue;
                List<Shot> shots = new ArrayList<>();
                double seconds = sc.path("duration").asDouble();
                String title = text(sc, "title"), subtitle = text(sc, "subtitle");
                JsonNode meta = sc.path("meta");
                switch (type) {
                    case "OPENING" -> shots.add(write(dir, ++frameNo, painter.opening(firstImage(sc, images),
                            text(meta, "kicker"), title, subtitle, text(meta, "destination")), seconds));
                    case "PLACE" -> {
                        List<Long> ids = ids(sc.path("photoIds"));
                        JsonNode shotSeconds = meta.path("shots");
                        for (int i = 0; i < ids.size(); i++) {
                            photoIndex++;
                            double s = shotSeconds.has(i) ? shotSeconds.get(i).asDouble() : seconds / ids.size();
                            BufferedImage img = images.get(ids.get(i));
                            // 照片在排队期间被删：跳过这一张，时长并入相邻镜头
                            if (img == null) { shots.add(new Shot(null, s)); continue; }
                            shots.add(write(dir, ++frameNo, painter.photo(img, title, subtitle, text(meta, "note"),
                                    i == 0, photoIndex, photoTotal), s));
                        }
                    }
                    case "ACHIEVEMENTS" -> {
                        List<String> items = new ArrayList<>();
                        meta.path("items").forEach(n -> items.add(n.asText()));
                        shots.add(write(dir, ++frameNo, painter.achievements(title, subtitle, items), seconds));
                    }
                    case "ENDING" -> shots.add(write(dir, ++frameNo, painter.ending(firstImage(sc, images), title, subtitle,
                            text(meta, "stats"), text(meta, "endingText"), text(meta, "tagline")), seconds));
                    default -> { }
                }
                byScene.put(sc.path("key").asText(), shots);
            }
        } catch (IOException ex) {
            throw new RenderFailure("STORY_FAILED", "旅行故事画面生成失败", ex);
        }

        List<Shot> timeline = new ArrayList<>();
        for (JsonNode sc : scenes) timeline.addAll(byScene.getOrDefault(sc.path("key").asText(), List.of()));
        timeline = mergeMissing(timeline);
        if (timeline.isEmpty()) throw new RenderFailure("PHOTO_DOWNLOAD_FAILED", "素材下载失败：没有可用的照片");

        // ── MUSIC ──
        progress.report("MUSIC", 70);
        Path music = resolveMusic(job.musicCode());

        // ── EXPORTING ──
        progress.report("EXPORTING", 80);
        String transition = sb.path("transition").asText("fade");
        Path output = encode(dir, timeline, TRANSITIONS.contains(transition) ? transition : "fade",
                sb.path("transitionSeconds").asDouble(0.5), music, job.duration(), size, sb.path("grade").asText("NATURAL"));

        cleanupIntermediate(dir, output);
        return output;
    }

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

    private Map<Long, BufferedImage> loadPhotos(Path dir, List<JsonNode> scenes) throws RenderFailure {
        Set<Long> wanted = new LinkedHashSet<>();
        scenes.forEach(sc -> wanted.addAll(ids(sc.path("photoIds"))));
        Map<Long, String> urls = new HashMap<>();
        if (!wanted.isEmpty()) {
            String in = String.join(",", Collections.nCopies(wanted.size(), "?"));
            jdbc.query("SELECT id,image_url FROM photos WHERE id IN (" + in + ")",
                    rs -> { urls.put(rs.getLong(1), rs.getString(2)); }, wanted.toArray());
        }
        Map<Long, BufferedImage> out = new HashMap<>();
        int n = 0;
        for (Long id : wanted) {
            String url = urls.get(id);
            if (url == null) continue; // 照片已被删除：由调用方跳过
            n++;
            Path raw = dir.resolve("raw-" + id);
            Path decoded = dir.resolve("decoded-" + id + ".jpg");
            try {
                if (!download(url, raw)) continue; // 404 / 410：存储里的文件已不存在，同样跳过
                // 统一交给 FFmpeg 解码（webp / png / heic 都能读），再用 ImageIO 读入
                exec(dir, List.of(ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", raw.getFileName().toString(),
                        "-frames:v", "1", "-q:v", "2", decoded.getFileName().toString()));
                BufferedImage img = ImageIO.read(decoded.toFile());
                if (img == null) throw new IOException("无法解码图片");
                out.put(id, img);
            } catch (Exception ex) {
                throw new RenderFailure("PHOTO_DOWNLOAD_FAILED", "素材下载失败：第 " + n + " 张照片无法读取", ex);
            }
        }
        return out;
    }

    private List<Shot> renderMap(Path dir, ScenePainter painter, JsonNode sc, int frameNo) throws IOException {
        List<ScenePainter.MapPoint> points = new ArrayList<>();
        for (JsonNode p : sc.path("meta").path("points")) {
            points.add(new ScenePainter.MapPoint(p.path("name").asText(""), p.path("time").asText(""),
                    p.path("lat").asDouble(), p.path("lng").asDouble()));
        }
        double seconds = sc.path("duration").asDouble();
        String title = text(sc, "title"), subtitle = text(sc, "subtitle");
        List<Shot> shots = new ArrayList<>();
        if (points.size() < 2) return shots;
        if ("FULL".equals(sc.path("meta").path("mode").asText())) {
            // 完整路线：一站一帧，路线逐段延伸；点太多时均匀抽样，控制帧数
            List<Integer> steps = new ArrayList<>();
            int frames = Math.min(points.size(), MAX_MAP_FRAMES);
            for (int i = 0; i < frames; i++) steps.add((int) Math.round(i * (points.size() - 1) / (double) (frames - 1)));
            double each = seconds / steps.size();
            for (int step : steps) shots.add(write(dir, ++frameNo, painter.map(points, step, title, subtitle), each));
        } else {
            shots.add(write(dir, ++frameNo, painter.map(points, -1, title, subtitle), seconds));
        }
        return shots;
    }

    /** 缺图的镜头时长并入前一个（没有前一个就并入后一个），保证总时长不变。 */
    private static List<Shot> mergeMissing(List<Shot> shots) {
        List<Shot> out = new ArrayList<>();
        double carry = 0;
        for (Shot s : shots) {
            if (s.file() == null) {
                if (out.isEmpty()) carry += s.seconds();
                else out.set(out.size() - 1, new Shot(out.get(out.size() - 1).file(), out.get(out.size() - 1).seconds() + s.seconds()));
                continue;
            }
            out.add(new Shot(s.file(), s.seconds() + carry));
            carry = 0;
        }
        return out;
    }

    // ───────────── 导出 ─────────────

    /**
     * 每个镜头是一张循环静帧输入，用 xfade 链串起来：
     * 第 k 个镜头在前面镜头累计时长处开始转场，除最后一个外每个输入多留一个转场时长，总长严格等于目标时长。
     */
    /**
     * 视觉风格 → 成片调色滤镜，在转场链之后、输出格式之前整体套用。
     * NATURAL 不调色；其余为轻度调整，保证文字与水印依旧清晰。
     */
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

    private Path encode(Path dir, List<Shot> shots, String transition, double transitionSeconds, Path music,
                        int duration, int[] size, String grade) throws RenderFailure {
        double minShot = shots.stream().mapToDouble(Shot::seconds).min().orElse(1);
        double t = shots.size() < 2 ? 0 : round3(Math.max(0.1, Math.min(transitionSeconds, minShot * 0.45)));

        List<String> cmd = new ArrayList<>(List.of(ffmpeg, "-y", "-hide_banner", "-loglevel", "error"));
        for (int i = 0; i < shots.size(); i++) {
            double len = shots.get(i).seconds() + (i < shots.size() - 1 ? t : 0);
            cmd.addAll(List.of("-loop", "1", "-framerate", String.valueOf(FPS), "-t", fmt(len),
                    "-i", shots.get(i).file().getFileName().toString()));
        }
        if (music != null) cmd.addAll(List.of("-stream_loop", "-1", "-i", music.toAbsolutePath().toString()));

        StringBuilder f = new StringBuilder();
        for (int i = 0; i < shots.size(); i++) {
            f.append('[').append(i).append(":v]scale=").append(size[0]).append(':').append(size[1])
                    .append(",setsar=1,format=yuv420p,fps=").append(FPS).append("[v").append(i).append("];");
        }
        String last = "v0";
        double offset = 0;
        for (int i = 1; i < shots.size(); i++) {
            offset += shots.get(i - 1).seconds();
            String label = "x" + i;
            f.append('[').append(last).append("][v").append(i).append("]xfade=transition=").append(transition)
                    .append(":duration=").append(fmt(t)).append(":offset=").append(fmt(offset))
                    .append('[').append(label).append("];");
            last = label;
        }
        f.append('[').append(last).append(']').append(gradeFilter(grade)).append("format=yuv420p[vout]");
        if (music != null) {
            f.append(";[").append(shots.size()).append(":a]afade=t=in:st=0:d=0.6,afade=t=out:st=")
                    .append(fmt(Math.max(0, duration - 1.8))).append(":d=1.8,volume=1.2[aout]");
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

    private Path resolveMusic(String musicCode) throws RenderFailure {
        if (musicCode == null || "NONE".equalsIgnoreCase(musicCode)) return null;
        for (String extension : List.of(".mp3", ".wav", ".m4a", ".aac")) {
            Path candidate = musicDir.resolve(musicCode.toUpperCase(Locale.ROOT) + extension);
            if (Files.isRegularFile(candidate)) return candidate;
        }
        throw new RenderFailure("MUSIC_UNAVAILABLE", "音乐「" + musicCode + "」的音频文件不存在，请换一首音乐或补上音频文件");
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
            if (!process.waitFor(ffmpegTimeoutSeconds, TimeUnit.SECONDS)) {
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
    public int sweepLeftovers() throws IOException {
        if (!Files.isDirectory(workDir)) return 0;
        Set<String> completed = new HashSet<>(jdbc.queryForList(
                "SELECT CONCAT('project-',id) FROM video_projects WHERE status='COMPLETED'", String.class));
        int removed = 0;
        try (Stream<Path> dirs = Files.list(workDir)) {
            for (Path d : dirs.filter(Files::isDirectory).filter(p -> p.getFileName().toString().startsWith("project-")).toList()) {
                boolean keepOutput = completed.contains(d.getFileName().toString());
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

    private static BufferedImage firstImage(JsonNode scene, Map<Long, BufferedImage> images) {
        for (Long id : ids(scene.path("photoIds"))) if (images.containsKey(id)) return images.get(id);
        return images.values().stream().findFirst().orElse(null);
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
