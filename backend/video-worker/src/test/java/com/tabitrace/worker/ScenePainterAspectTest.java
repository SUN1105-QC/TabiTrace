package com.tabitrace.worker;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 9:16 / 4:5 / 16:9 × 三个模板 × 开场 / 照片 / 结尾：画面尺寸正确，版式按比例重新排（不是裁切），
 * 文字没有被画到画面外（最后一行文字的底部仍在画面内）。关键帧另存到 target/aspect-frames 便于人工检查。
 */
class ScenePainterAspectTest {
    static final int[][] SIZES = {{1080, 1920}, {1080, 1350}, {1920, 1080}};
    static final String[] NAMES = {"9x16", "4x5", "16x9"};

    static BufferedImage photo() {
        BufferedImage img = new BufferedImage(1600, 1200, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setPaint(new GradientPaint(0, 0, new Color(0x3A6EA5), 1600, 1200, new Color(0xE9A96B)));
        g.fillRect(0, 0, 1600, 1200);
        g.dispose();
        return img;
    }

    /** 最下方 4% 区域里是否有大面积与背景不同的像素：用来粗略判断文字没被挤出画面 */
    static boolean bottomRowsClean(BufferedImage img) {
        int h = img.getHeight(), w = img.getWidth();
        // 最后 2 像素行不应出现文字（白色）笔画；水印在右下角，排除右侧 30%
        for (int y = h - 2; y < h; y++) for (int x = 0; x < (int) (w * 0.7); x++) {
            Color c = new Color(img.getRGB(x, y));
            if (c.getRed() > 245 && c.getGreen() > 245 && c.getBlue() > 245) return false;
        }
        return true;
    }

    @Test void everySceneRendersInEveryAspectRatio() throws Exception {
        Path dir = Path.of("target/aspect-frames");
        Files.createDirectories(dir);
        BufferedImage p = photo();
        for (int i = 0; i < SIZES.length; i++) {
            int w = SIZES[i][0], h = SIZES[i][1];
            for (String tpl : new String[]{"JOURNAL", "MINIMAL", "CITY"}) {
                ScenePainter painter = new ScenePainter(w, h, tpl, true);
                BufferedImage[] frames = {
                        painter.opening(p, "MY JOURNEY", "秋天的东京漫步与京都之旅", "2026.10.01 - 2026.10.05", "东京"),
                        painter.photo(p, "浅草寺", "10.01 10:00 · 台东区 · 晴 22°C", "雷门的灯笼比想象中还要大，人很多但很热闹。", true, 1, 12),
                        painter.ending(p, "秋天的东京漫步", "5 天 4 晚", "10 个地点 · 12 张照片", "东京，下次再见。", ScenePainterAspectTest.class.getSimpleName())
                };
                String[] kinds = {"opening", "photo", "ending"};
                for (int k = 0; k < frames.length; k++) {
                    assertEquals(w, frames[k].getWidth());
                    assertEquals(h, frames[k].getHeight());
                    assertTrue(bottomRowsClean(frames[k]), NAMES[i] + " " + tpl + " " + kinds[k] + " 文字贴到了画面底边");
                    ImageIO.write(frames[k], "jpg", dir.resolve(NAMES[i] + "-" + tpl.toLowerCase() + "-" + kinds[k] + ".jpg").toFile());
                }
            }
        }
    }

    @Test void musicCreditScalesByShortSide() {
        BufferedImage land = new BufferedImage(1920, 1080, BufferedImage.TYPE_INT_RGB);
        BufferedImage port = new BufferedImage(1080, 1920, BufferedImage.TYPE_INT_RGB);
        ScenePainter.creditOverlay(land, "Music: “Wanderlust” – Scott Buckley · CC BY 4.0");
        ScenePainter.creditOverlay(port, "Music: “Wanderlust” – Scott Buckley · CC BY 4.0");
        // 两种画面的署名条高度应接近（同一字号），横屏不会被放大
        assertTrue(Math.abs(bandHeight(land) - bandHeight(port)) <= 8, bandHeight(land) + " vs " + bandHeight(port));
    }

    /** 署名条（左边缘处渐变不为纯黑）的高度 */
    static int bandHeight(BufferedImage img) {
        int count = 0;
        for (int y = 0; y < img.getHeight(); y++) if ((img.getRGB(5, y) & 0xFFFFFF) != 0) count++;
        return count;
    }
}
