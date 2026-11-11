package com.tabitrace.worker;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.ResultSet;
import java.util.*;
import java.util.stream.Stream;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 渲染耗时基准（默认不运行，CI 不受影响）。用真实照片文件走完整的 FfmpegRenderer 流程，按阶段计时：
 *   RENDER_BENCH=1 RENDER_BENCH_PHOTOS=<照片目录> mvn -f backend/pom.xml -pl video-worker test -Dtest=RenderBenchmarkTest
 * 可选：RENDER_BENCH_DURATION（默认 60）、RENDER_BENCH_QUALITY（1080p / 720p）、RENDER_BENCH_GRADE（NATURAL / FILM …）、
 * RENDER_BENCH_COUNT（照片数，默认 30）、RENDER_BENCH_TEMPLATE（默认 JOURNAL）、RENDER_BENCH_OUT（成片另存路径，用于画质对比）、
 * RENDER_BENCH_FFMPEG（FFmpeg 路径）。
 */
@EnabledIfEnvironmentVariable(named = "RENDER_BENCH", matches = "1")
class RenderBenchmarkTest {
    static String env(String k, String d) { String v = System.getenv(k); return v == null || v.isBlank() ? d : v; }

    @Test
    void benchmark() throws Exception {
        int duration = Integer.parseInt(env("RENDER_BENCH_DURATION", "60"));
        int count = Integer.parseInt(env("RENDER_BENCH_COUNT", "30"));
        String quality = env("RENDER_BENCH_QUALITY", "1080p"), grade = env("RENDER_BENCH_GRADE", "NATURAL");
        List<Path> photos;
        try (Stream<Path> s = Files.list(Path.of(env("RENDER_BENCH_PHOTOS", ".")))) {
            photos = s.filter(p -> p.getFileName().toString().matches("(?i).+\\.(jpe?g|webp|png)$")).sorted().limit(count).toList();
        }
        if (photos.size() < 3) throw new IllegalStateException("RENDER_BENCH_PHOTOS 至少需要 3 张照片");

        // 分镜：开场 + 若干地点段 + 结尾，时长分配与 StoryboardService 的节奏相近
        double opening = 3, ending = 4, perPhoto = (duration - opening - ending) / photos.size();
        StringBuilder scenes = new StringBuilder();
        scenes.append("{\"key\":\"opening\",\"type\":\"OPENING\",\"title\":\"东京五日\",\"subtitle\":\"2026.10.01 – 10.05\",\"duration\":").append(opening)
                .append(",\"enabled\":true,\"photoIds\":[1],\"meta\":{\"kicker\":\"TRAVEL STORY\",\"destination\":\"东京\"}}");
        int perScene = 3;
        for (int i = 0, scene = 0; i < photos.size(); i += perScene, scene++) {
            int n = Math.min(perScene, photos.size() - i);
            StringBuilder ids = new StringBuilder(), shots = new StringBuilder();
            for (int j = 0; j < n; j++) { if (j > 0) { ids.append(','); shots.append(','); } ids.append(i + j + 1); shots.append(String.format(Locale.ROOT, "%.3f", perPhoto)); }
            scenes.append(",{\"key\":\"place-").append(scene).append("\",\"type\":\"PLACE\",\"title\":\"地点 ").append(scene + 1)
                    .append("\",\"subtitle\":\"第 ").append(scene / 3 + 1).append(" 天 · 下午\",\"duration\":").append(String.format(Locale.ROOT, "%.3f", perPhoto * n))
                    .append(",\"enabled\":true,\"photoIds\":[").append(ids).append("],\"meta\":{\"note\":\"沿着河边慢慢走，记下这一刻。\",\"shots\":[").append(shots).append("]}}");
        }
        scenes.append(",{\"key\":\"ending\",\"type\":\"ENDING\",\"title\":\"下一段旅程见\",\"subtitle\":\"旅迹 TabiTrace\",\"duration\":").append(ending)
                .append(",\"enabled\":true,\"photoIds\":[").append(photos.size()).append("],\"meta\":{\"stats\":\"5 天 · 30 个地点\",\"endingText\":\"谢谢观看\",\"tagline\":\"记录每一次出发\"}}");
        String resolution = switch (quality) { case "1080p" -> "1080×1920"; default -> "720×1280"; };
        String storyboard = "{\"resolution\":\"" + resolution + "\",\"watermark\":" + env("RENDER_BENCH_WATERMARK", "false")
                + ",\"transition\":\"" + env("RENDER_BENCH_TRANSITION", "fade") + "\",\"transitionSeconds\":0.5,\"grade\":\"" + grade
                + "\",\"scenes\":[" + scenes + "]}";

        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        doAnswer(inv -> {
            RowCallbackHandler h = inv.getArgument(1);
            Object[] args = Arrays.copyOfRange(inv.getArguments(), 2, inv.getArguments().length);
            for (Object a : args) {
                long id = ((Number) a).longValue();
                ResultSet rs = mock(ResultSet.class);
                when(rs.getLong(1)).thenReturn(id);
                when(rs.getString(2)).thenReturn(photos.get((int) id - 1).toUri().toString());
                h.processRow(rs);
            }
            return null;
        }).when(jdbc).query(anyString(), any(RowCallbackHandler.class), any(Object[].class));

        Path work = Files.createTempDirectory("render-bench");
        FfmpegRenderer renderer = new FfmpegRenderer(jdbc, env("RENDER_BENCH_FFMPEG", "ffmpeg"), work.toString(), work.resolve("music").toString(), 1800,
                work.resolve("music-cache").toString(), null);
        Map<String, Long> marks = new LinkedHashMap<>();
        long start = System.nanoTime();
        Path out = renderer.render(new VideoJob(1L, 1L, 1L, env("RENDER_BENCH_TEMPLATE", "JOURNAL"), "9:16", duration, null, quality, "PRO", storyboard),
                (stage, p) -> marks.putIfAbsent(stage, System.nanoTime()));
        long end = System.nanoTime();
        marks.put("DONE", end);
        StringBuilder report = new StringBuilder(String.format(Locale.ROOT, "RENDER_BENCH %ds %s %s photos=%d total=%.1fs", duration, quality, grade, photos.size(), (end - start) / 1e9));
        long prev = start; String prevName = "START";
        for (var e : marks.entrySet()) { report.append(String.format(Locale.ROOT, " | %s→%s %.1fs", prevName, e.getKey(), (e.getValue() - prev) / 1e9)); prev = e.getValue(); prevName = e.getKey(); }
        report.append(String.format(Locale.ROOT, " | size=%dKB", Files.size(out) / 1024));
        System.out.println(report);
        String keep = System.getenv("RENDER_BENCH_OUT");
        if (keep != null && !keep.isBlank()) Files.copy(out, Path.of(keep), StandardCopyOption.REPLACE_EXISTING);
        renderer.discard(1L);
    }
}
