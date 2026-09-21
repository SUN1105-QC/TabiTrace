package com.tabitrace.worker;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.awt.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class FfmpegRenderer {
    private final JdbcTemplate jdbc;
    private final String ffmpeg;
    private final Path workDir;
    private final Path musicDir;
    private final HttpClient http = HttpClient.newHttpClient();

    public FfmpegRenderer(
            JdbcTemplate jdbc,
            @Value("${worker.ffmpeg-binary:ffmpeg}") String ffmpeg,
            @Value("${worker.work-dir:./video-output}") String workDir,
            @Value("${worker.music-dir:./video-music}") String musicDir) {
        this.jdbc = jdbc;
        this.ffmpeg = ffmpeg;
        this.workDir = Path.of(workDir);
        this.musicDir = Path.of(musicDir);
    }

    public Path render(VideoJob job) throws Exception {
        Path dir = workDir.resolve("project-" + job.id());
        Files.createDirectories(dir);

        List<String> urls = jdbc.query(
                "SELECT p.image_url FROM video_project_photos v JOIN photos p ON p.id=v.photo_id " +
                        "WHERE v.video_project_id=? ORDER BY v.sort_order",
                (rs, n) -> rs.getString(1),
                job.id());
        if (urls.isEmpty()) throw new IllegalStateException("No photos selected");

        int width = "PRO".equalsIgnoreCase(job.planType()) ? 1080 : 720;
        int height = "PRO".equalsIgnoreCase(job.planType()) ? 1920 : 1280;
        String scaleFilter = "scale=" + width + ":" + height +
                ":force_original_aspect_ratio=decrease,pad=" + width + ":" + height +
                ":(ow-iw)/2:(oh-ih)/2:color=white";

        Path watermark = null;
        if (!"PRO".equalsIgnoreCase(job.planType())) {
            watermark = createWatermark(dir);
        }

        List<Path> frames = new ArrayList<>();
        int i = 0;
        for (String url : urls) {
            Path raw = dir.resolve("raw-" + (++i));
            download(url, raw);
            Path frame = dir.resolve(String.format("frame-%03d.jpg", i));
            if (watermark == null) {
                exec(List.of(
                        ffmpeg, "-y", "-i", raw.toString(),
                        "-vf", scaleFilter,
                        "-frames:v", "1",
                        frame.toString()));
            } else {
                String filter = "[0:v]" + scaleFilter + "[base];[base][1:v]overlay=W-w-24:H-h-24";
                exec(List.of(
                        ffmpeg, "-y", "-i", raw.toString(), "-i", watermark.toString(),
                        "-filter_complex", filter,
                        "-frames:v", "1",
                        frame.toString()));
            }
            frames.add(frame);
        }

        double secondsPerPhoto = Math.max(1.0, job.duration() / (double) frames.size());
        Path concat = dir.resolve("concat.txt");
        StringBuilder list = new StringBuilder();
        for (Path frame : frames) {
            list.append("file '").append(frame.toAbsolutePath()).append("'\n");
            list.append("duration ").append(String.format(Locale.ROOT, "%.3f", secondsPerPhoto)).append("\n");
        }
        list.append("file '").append(frames.get(frames.size() - 1).toAbsolutePath()).append("'\n");
        Files.writeString(concat, list);

        Path output = dir.resolve("output.mp4");
        List<String> cmd = new ArrayList<>(List.of(
                ffmpeg, "-y",
                "-f", "concat", "-safe", "0", "-i", concat.toString()));

        Path music = resolveMusic(job.musicCode());
        boolean withMusic = music != null;
        if (withMusic) cmd.addAll(List.of("-stream_loop", "-1", "-i", music.toString()));

        cmd.addAll(List.of(
                "-t", String.valueOf(job.duration()),
                "-r", "30",
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p"));
        if (withMusic) cmd.addAll(List.of(
                "-filter:a", "volume=1.35",
                "-c:a", "aac",
                "-b:a", "192k",
                "-ar", "48000",
                "-ac", "2",
                "-shortest"));
        cmd.add(output.toString());

        exec(cmd);
        return output;
    }

    private Path resolveMusic(String musicCode) {
        if (musicCode == null || "NONE".equalsIgnoreCase(musicCode)) return null;
        for (String extension : List.of(".mp3", ".wav", ".m4a", ".aac")) {
            Path candidate = musicDir.resolve(musicCode.toUpperCase(Locale.ROOT) + extension);
            if (Files.isRegularFile(candidate)) return candidate;
        }
        throw new IllegalStateException("Music file not found for code " + musicCode + " in " + musicDir.toAbsolutePath());
    }

    private Path createWatermark(Path dir) throws Exception {
        Path file = dir.resolve("tabitrace-watermark.png");
        BufferedImage image = new BufferedImage(360, 74, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(new Color(0, 0, 0, 120));
        g.fillRoundRect(0, 0, 360, 74, 18, 18);
        g.setColor(new Color(255, 255, 255, 235));
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 30));
        g.drawString("旅迹 TabiTrace", 24, 48);
        g.dispose();
        ImageIO.write(image, "png", file.toFile());
        return file;
    }

    private void download(String url, Path target) throws Exception {
        if (url.startsWith("file:")) {
            Files.copy(Path.of(URI.create(url)), target, StandardCopyOption.REPLACE_EXISTING);
            return;
        }
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).GET().build();
        HttpResponse<Path> res = http.send(req, HttpResponse.BodyHandlers.ofFile(target));
        if (res.statusCode() / 100 != 2) {
            throw new IllegalStateException("Photo download failed: " + res.statusCode());
        }
    }

    private void exec(List<String> cmd) throws Exception {
        Process process = new ProcessBuilder(cmd).redirectErrorStream(true).start();
        String output = new String(process.getInputStream().readAllBytes());
        if (process.waitFor() != 0) throw new IllegalStateException("ffmpeg failed: " + output);
    }
}
