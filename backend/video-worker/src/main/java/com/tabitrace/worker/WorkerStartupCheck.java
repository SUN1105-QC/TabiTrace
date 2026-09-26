package com.tabitrace.worker;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * 启动自检：FFmpeg 能否执行、中文字体是否可用、音乐目录是否存在。
 * 这些问题都不会让 Worker 起不来，但会在生成时才失败（或更糟：中文静默变成方块），所以启动时就明确打出来。
 */
@Component
public class WorkerStartupCheck implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(WorkerStartupCheck.class);

    private final String ffmpeg;
    private final Path musicDir;

    public WorkerStartupCheck(@Value("${worker.ffmpeg-binary:ffmpeg}") String ffmpeg,
                              @Value("${worker.music-dir:./video-music}") String musicDir) {
        this.ffmpeg = ffmpeg;
        this.musicDir = Path.of(musicDir);
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            Process p = new ProcessBuilder(List.of(ffmpeg, "-hide_banner", "-version")).redirectErrorStream(true).start();
            String first = new String(p.getInputStream().readAllBytes()).lines().findFirst().orElse("");
            if (!p.waitFor(20, TimeUnit.SECONDS) || p.exitValue() != 0) throw new IllegalStateException("退出码异常");
            log.info("FFmpeg 可用：{}", first);
        } catch (Exception ex) {
            log.error("FFmpeg 不可用（worker.ffmpeg-binary={}）：{}。所有视频都会生成失败，请安装 FFmpeg 或设置 FFMPEG_BINARY。", ffmpeg, ex.getMessage());
        }

        String fontProblem = ScenePainter.fontReport();
        if (fontProblem == null) {
            log.info("视频字体：{}", ScenePainter.families());
        } else {
            log.warn("视频字体不支持中文（{}），成片中的中文会显示为方块。Debian / Ubuntu 请执行：sudo apt install fonts-noto-cjk，然后重启 Worker。", fontProblem);
        }

        if (!Files.isDirectory(musicDir)) {
            log.warn("音乐目录不存在：{}。选择了背景音乐的视频会以「音乐不可用」失败，请设置 VIDEO_MUSIC_DIR。", musicDir.toAbsolutePath());
        }
    }
}
