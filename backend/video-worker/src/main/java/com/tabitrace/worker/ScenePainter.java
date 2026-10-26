package com.tabitrace.worker;

import java.awt.*;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 用 Java2D 把分镜里的每一段画成一帧（或一组帧）。设计稿按 1080 宽绘制，720p 时整体等比缩放。
 * 三个模板共用一套画法，只在版式上区分：
 *   JOURNAL 满版照片 + 底部文字；MINIMAL 米白底留白 + 小字；CITY 满版照片 + 顶部大字标题。
 */
final class ScenePainter {
    static final Color BRAND = new Color(0xE9, 0x7A, 0x33);
    static final Color INK = new Color(0x17, 0x17, 0x17);
    static final Color PAPER = new Color(0xF8, 0xF4, 0xEE);
    static final Color MUTED = new Color(0x6F, 0x78, 0x85);
    static final Color LINE = new Color(0xEA, 0xE1, 0xD5);

    private static final String[] SANS = {"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC",
            "Noto Sans SC", "Source Han Sans SC", "WenQuanYi Micro Hei", Font.SANS_SERIF};
    private static final String[] SERIF = {"Noto Serif SC", "Noto Serif CJK SC", "Source Han Serif SC", "Songti SC",
            "STSong", "SimSun", Font.SERIF};
    private static final String SANS_FAMILY = pick(SANS);
    private static final String SERIF_FAMILY = pick(SERIF);

    /** 片尾音乐署名（CC BY 要求注明作者、作品与授权）：画面底部半透明条 + 白字，最多两行 */
    static void creditOverlay(BufferedImage img, String text) {
        if (text == null || text.isBlank()) return;
        Graphics2D g = img.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            int w = img.getWidth(), h = img.getHeight();
            // 按短边取字号：横屏不会因为画面更宽而把署名放大
            Font font = new Font(SANS_FAMILY, Font.PLAIN, Math.max(14, Math.round(Math.min(w, h) * 0.027f)));
            g.setFont(font);
            FontMetrics fm = g.getFontMetrics();
            List<String> lines = wrap(text, fm, (int) (w * 0.86), 2);
            int lineH = fm.getHeight();
            int band = lineH * lines.size() + lineH;
            int top = h - band - Math.round(h * 0.035f);
            g.setPaint(new GradientPaint(0, top - lineH, new Color(0, 0, 0, 0), 0, top + band / 2f, new Color(0, 0, 0, 150)));
            g.fillRect(0, top - lineH, w, h - top + lineH);
            g.setColor(new Color(255, 255, 255, 225));
            int y = top + lineH / 2 + fm.getAscent();
            for (String line : lines) { g.drawString(line, (w - fm.stringWidth(line)) / 2, y); y += lineH; }
        } finally {
            g.dispose();
        }
    }

    private final int w, h;
    /** 按短边缩放（1080 为基准）：9:16 / 4:5 / 16:9 的文字与元素大小一致 */
    private final double k;
    private final String template;
    private final boolean watermark;
    /** 版式：PORTRAIT 9:16、FEED 4:5、LANDSCAPE 16:9。竖向位置按「距顶部 / 距底部」锚定，横屏改为左右分栏 */
    private final boolean landscape, feed;

    ScenePainter(int width, int height, String template, boolean watermark) {
        this.w = width;
        this.h = height;
        this.k = Math.min(width, height) / 1080.0;
        this.landscape = width > height;
        this.feed = !landscape && height < width * 1.5;
        this.template = template == null ? "JOURNAL" : template.toUpperCase(Locale.ROOT);
        this.watermark = watermark;
    }

    // ───────────── 开场 ─────────────

    BufferedImage opening(BufferedImage cover, String kicker, String title, String subtitle, String destination) {
        BufferedImage img = canvas();
        Graphics2D g = graphics(img);
        int textW = textWidth();
        if ("MINIMAL".equals(template)) {
            paper(g);
            if (landscape) {
                // 横屏：左侧照片，右侧文字
                int pw = (int) (w * 0.56), x = s(80) + pw + s(90), tw = w - x - s(90);
                if (cover != null) framedPhoto(g, cover, s(80), s(80), pw, h - s(160));
                int y = (int) (h * 0.40);
                text(g, kicker, serif(Font.PLAIN, 28), MUTED, x, y, tw, 1, 0.3f);
                int n = text(g, title, serif(Font.BOLD, 72), INK, x, y + s(100), tw, 3, 0);
                text(g, subtitle, sans(Font.PLAIN, 30), MUTED, x, y + s(100) + s(90) * Math.max(1, n) + s(20), tw, 2, 0);
            } else {
                int top = s(feed ? 110 : 200);
                if (cover != null) framedPhoto(g, cover, s(90), top, w - s(180), h - top - s(520));
                text(g, kicker, serif(Font.PLAIN, 28), MUTED, s(90), h - s(420), w - s(180), 1, 0.3f);
                text(g, title, serif(Font.BOLD, 72), INK, s(90), h - s(320), w - s(180), 2, 0);
                text(g, subtitle, sans(Font.PLAIN, 30), MUTED, s(90), h - s(130), w - s(180), 1, 0);
            }
        } else {
            if (cover != null) cover(g, cover, 0, 0, w, h); else paper(g);
            boolean city = "CITY".equals(template);
            gradient(g, city ? 0 : h * (landscape ? 0.25 : 0.35), h, city ? 150 : 40, 215);
            if (city) {
                int y = landscape ? (int) (h * 0.32) : feed ? (int) (h * 0.36) : s(760);
                text(g, destination == null ? "" : destination.toUpperCase(Locale.ROOT), sans(Font.BOLD, 150), Color.WHITE, s(80), y, textW, 1, 0);
                bar(g, s(80), y + s(40), s(160), s(12));
                text(g, title, sans(Font.BOLD, 58), Color.WHITE, s(80), y + s(150), textW, 2, 0);
                text(g, subtitle, sans(Font.PLAIN, 32), new Color(255, 255, 255, 215), s(80), y + s(330), textW, 1, 0);
            } else {
                text(g, kicker, sans(Font.BOLD, 30), BRAND, s(90), h - s(590), textW, 1, 0.35f);
                // 副标题跟在标题实际行数之后（单行标题时不留大空白）
                int n = Math.max(1, text(g, title, serif(Font.BOLD, 88), Color.WHITE, s(90), h - s(470), textW, 2, 0));
                int sub = h - s(470) + s(100) * n + s(40);
                text(g, subtitle, sans(Font.PLAIN, 34), new Color(255, 255, 255, 225), s(90), sub, textW, 1, 0);
                if (destination != null && !destination.isBlank()) pill(g, destination, s(90), sub + s(55));
            }
        }
        finish(g, img);
        return img;
    }

    // ───────────── 照片镜头 ─────────────

    BufferedImage photo(BufferedImage photo, String title, String subtitle, String note, boolean firstShot, int index, int total) {
        BufferedImage img = canvas();
        Graphics2D g = graphics(img);
        int textW = textWidth();
        switch (template) {
            case "MINIMAL" -> {
                paper(g);
                if (landscape) {
                    int pw = (int) (w * 0.6), x = s(80) + pw + s(80), tw = w - x - s(80);
                    framedPhoto(g, photo, s(80), s(80), pw, h - s(160));
                    int y = (int) (h * 0.42);
                    int n = text(g, title, serif(Font.BOLD, 54), INK, x, y, tw, 2, 0);
                    int sy = y + s(70) * Math.max(1, n) + s(10);
                    text(g, subtitle, sans(Font.PLAIN, 28), MUTED, x, sy, tw, 2, 0);
                    if (firstShot) text(g, note, serif(Font.ITALIC, 30), MUTED, x, sy + s(110), tw, 4, 0);
                } else {
                    int top = s(feed ? 110 : 170);
                    framedPhoto(g, photo, s(90), top, w - s(180), h - top - s(420));
                    text(g, title, serif(Font.BOLD, 54), INK, s(90), h - s(280), w - s(180), 1, 0);
                    text(g, subtitle, sans(Font.PLAIN, 28), MUTED, s(90), h - s(205), w - s(180), 1, 0);
                    if (firstShot) text(g, note, serif(Font.ITALIC, 30), MUTED, s(90), h - s(130), w - s(180), 2, 0);
                }
            }
            case "CITY" -> {
                cover(g, photo, 0, 0, w, h);
                gradient(g, 0, h * 0.42, 190, 0);
                gradient(g, h * 0.78, h, 0, 170);
                text(g, title, sans(Font.BOLD, 84), Color.WHITE, s(80), s(landscape ? 170 : 250), textW, 2, 0);
                int base = s(landscape ? 210 : 290);
                bar(g, s(80), base + (title != null && lines(g, title, sans(Font.BOLD, 84), textW) > 1 ? s(100) : 0), s(120), s(10));
                text(g, subtitle, sans(Font.PLAIN, 32), new Color(255, 255, 255, 220), s(80), base + s(110), textW, 1, 0);
                text(g, String.format(Locale.ROOT, "%02d / %02d", index, total), sans(Font.BOLD, 30), BRAND, s(80), h - s(110), s(300), 1, 0.1f);
                if (firstShot) text(g, note, sans(Font.PLAIN, 32), Color.WHITE, s(80), h - s(260), textW, 2, 0);
            }
            default -> {
                cover(g, photo, 0, 0, w, h);
                gradient(g, h * (landscape ? 0.45 : 0.52), h, 0, 205);
                int y = h - s(470);
                bar(g, s(90), y, s(64), s(8));
                text(g, title, serif(Font.BOLD, 64), Color.WHITE, s(90), y + s(100), textW, 2, 0);
                text(g, subtitle, sans(Font.PLAIN, 30), new Color(255, 255, 255, 215), s(90), y + s(185), textW, 1, 0);
                if (note != null && !note.isBlank()) {
                    text(g, "“" + note + "”", sans(Font.PLAIN, 32), new Color(255, 255, 255, 235), s(90), y + s(265), textW, landscape ? 2 : 3, 0);
                }
            }
        }
        finish(g, img);
        return img;
    }

    // ───────────── 成就 ─────────────

    BufferedImage achievements(String title, String subtitle, List<String> items) {
        BufferedImage img = canvas();
        Graphics2D g = graphics(img);
        paper(g);
        int top = landscape ? s(150) : feed ? s(230) : s(420);
        text(g, "ACHIEVEMENTS", sans(Font.BOLD, 28), BRAND, s(90), top, w - s(180), 1, 0.35f);
        text(g, title, serif(Font.BOLD, 84), INK, s(90), top + s(120), w - s(180), 1, 0);
        text(g, subtitle, sans(Font.PLAIN, 32), MUTED, s(90), top + s(200), w - s(180), 1, 0);
        // 成就卡：竖屏一列；放不下时（4:5、横屏）排成两列，仍放不下的只显示前面的
        int start = top + s(320), row = s(180), gap = s(40);
        int perCol = Math.max(1, (h - start - s(110)) / row);
        int cols = Math.min(landscape ? 3 : 2, (items.size() + perCol - 1) / perCol);
        int colW = (w - s(180) - (cols - 1) * gap) / cols;
        List<String> shown = items.subList(0, Math.min(items.size(), perCol * cols));
        for (int i = 0; i < shown.size(); i++) {
            int x = s(90) + (i / perCol) * (colW + gap), y = start + (i % perCol) * row;
            g.setColor(Color.WHITE);
            g.fill(new RoundRectangle2D.Double(x, y, colW, s(150), s(36), s(36)));
            g.setColor(BRAND);
            g.fillOval(x + s(40), y + s(35), s(80), s(80));
            text(g, "★", sans(Font.BOLD, 40), Color.WHITE, x + s(60), y + s(92), s(60), 1, 0);
            text(g, shown.get(i), sans(Font.BOLD, 40), INK, x + s(160), y + s(92), colW - s(200), 1, 0);
        }
        finish(g, img);
        return img;
    }

    // ───────────── 结尾 ─────────────

    BufferedImage ending(BufferedImage background, String title, String subtitle, String stats, String endingText, String tagline) {
        BufferedImage img = canvas();
        Graphics2D g = graphics(img);
        boolean minimal = "MINIMAL".equals(template) || background == null;
        Color main = minimal ? INK : Color.WHITE;
        Color soft = minimal ? MUTED : new Color(255, 255, 255, 215);
        if (minimal) {
            paper(g);
        } else {
            cover(g, background, 0, 0, w, h);
            g.setColor(new Color(20, 14, 10, 165));
            g.fillRect(0, 0, w, h);
        }
        int y = landscape ? (int) (h * 0.27) : feed ? (int) (h * 0.33) : s(760);
        centered(g, title, serif(Font.BOLD, 84), main, y, 2);
        centered(g, subtitle, sans(Font.PLAIN, 38), soft, y + s(130), 1);
        if (stats != null) centered(g, stats, sans(Font.BOLD, 36), BRAND, y + s(210), 1);
        if (endingText != null) centered(g, "“" + endingText + "”", serif(Font.ITALIC, 44), main, y + s(340), 2);
        centered(g, tagline, serif(Font.ITALIC, 34), soft, h - s(260), 1);
        centered(g, "旅迹 TabiTrace", sans(Font.BOLD, 30), BRAND, h - s(190), 1);
        finish(g, img);
        return img;
    }

    // ───────────── 绘制工具 ─────────────

    private BufferedImage canvas() { return new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB); }

    /** 文字最大宽度：横屏不铺满整行（太长不好读），约 62% 画面宽 */
    private int textWidth() { return landscape ? Math.min(w - s(180), (int) (w * 0.62)) : w - s(180); }

    private Graphics2D graphics(BufferedImage img) {
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        return g;
    }

    private void finish(Graphics2D g, BufferedImage img) {
        if (watermark) {
            Font f = sans(Font.BOLD, 30);
            g.setFont(f);
            String label = "旅迹 TabiTrace";
            int tw = g.getFontMetrics().stringWidth(label);
            int pw = tw + s(56), ph = s(64);
            int x = w - pw - s(40), y = h - ph - s(40);
            g.setColor(new Color(0, 0, 0, 115));
            g.fill(new RoundRectangle2D.Double(x, y, pw, ph, ph, ph));
            g.setColor(new Color(255, 255, 255, 235));
            g.drawString(label, x + s(28), y + s(43));
        }
        g.dispose();
    }

    private void paper(Graphics2D g) {
        g.setColor(PAPER);
        g.fillRect(0, 0, w, h);
    }

    /** 等比铺满后居中裁切（object-fit: cover）。 */
    private static void cover(Graphics2D g, BufferedImage src, int x, int y, int bw, int bh) {
        double scale = Math.max(bw / (double) src.getWidth(), bh / (double) src.getHeight());
        int dw = (int) Math.ceil(src.getWidth() * scale), dh = (int) Math.ceil(src.getHeight() * scale);
        Shape old = g.getClip();
        g.clipRect(x, y, bw, bh);
        g.drawImage(src, x + (bw - dw) / 2, y + (bh - dh) / 2, dw, dh, null);
        g.setClip(old);
    }

    private void framedPhoto(Graphics2D g, BufferedImage src, int x, int y, int bw, int bh) {
        g.setColor(new Color(60, 40, 20, 28));
        g.fill(new RoundRectangle2D.Double(x + s(6), y + s(14), bw, bh, s(28), s(28)));
        Shape old = g.getClip();
        g.setClip(new RoundRectangle2D.Double(x, y, bw, bh, s(28), s(28)));
        cover(g, src, x, y, bw, bh);
        g.setClip(old);
    }

    private void gradient(Graphics2D g, double fromY, double toY, int alphaFrom, int alphaTo) {
        g.setPaint(new GradientPaint(0, (float) fromY, new Color(0, 0, 0, alphaFrom), 0, (float) toY, new Color(0, 0, 0, alphaTo)));
        g.fillRect(0, (int) fromY, w, (int) Math.ceil(toY - fromY));
    }

    private void bar(Graphics2D g, int x, int y, int bw, int bh) {
        g.setColor(BRAND);
        g.fill(new RoundRectangle2D.Double(x, y, bw, bh, bh, bh));
    }

    private void pill(Graphics2D g, String label, int x, int y) {
        Font f = sans(Font.BOLD, 28);
        g.setFont(f);
        int tw = g.getFontMetrics().stringWidth(label);
        g.setColor(new Color(0, 0, 0, 110));
        g.fill(new RoundRectangle2D.Double(x, y, tw + s(56), s(62), s(62), s(62)));
        g.setColor(Color.WHITE);
        g.drawString(label, x + s(28), y + s(42));
    }

    /** 左对齐多行文字，baseline 为第一行基线；letterSpacing 为字距（em）。返回实际行数。 */
    private int text(Graphics2D g, String value, Font font, Color color, int x, int baseline, int maxWidth, int maxLines, float letterSpacing) {
        if (value == null || value.isBlank()) return 0;
        Font f = letterSpacing > 0 ? font.deriveFont(java.util.Map.of(java.awt.font.TextAttribute.TRACKING, letterSpacing)) : font;
        g.setFont(f);
        g.setColor(color);
        FontMetrics fm = g.getFontMetrics();
        List<String> lines = wrap(value, fm, maxWidth, maxLines);
        int lh = (int) (fm.getHeight() * 1.12);
        for (int i = 0; i < lines.size(); i++) g.drawString(lines.get(i), x, baseline + i * lh);
        return lines.size();
    }

    private int lines(Graphics2D g, String value, Font font, int maxWidth) {
        g.setFont(font);
        return wrap(value, g.getFontMetrics(), maxWidth, 3).size();
    }

    private void centered(Graphics2D g, String value, Font font, Color color, int baseline, int maxLines) {
        if (value == null || value.isBlank()) return;
        g.setFont(font);
        g.setColor(color);
        FontMetrics fm = g.getFontMetrics();
        List<String> lines = wrap(value, fm, textWidth(), maxLines);
        int lh = (int) (fm.getHeight() * 1.12);
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            g.drawString(line, (w - fm.stringWidth(line)) / 2, baseline + i * lh);
        }
    }

    /** 中日文按字断行，英文尽量在空格处断行；超出行数时末行加省略号。 */
    static List<String> wrap(String text, FontMetrics fm, int maxWidth, int maxLines) {
        List<String> out = new ArrayList<>();
        String rest = text.replace('\n', ' ').trim();
        while (!rest.isEmpty() && out.size() < maxLines) {
            int end = rest.length();
            while (end > 1 && fm.stringWidth(rest.substring(0, end)) > maxWidth) end--;
            if (end < rest.length()) {
                int space = rest.lastIndexOf(' ', end);
                if (space > end / 2 && isLatin(rest.charAt(end - 1))) end = space;
                // 中文避头尾：右括号、句读不放在行首（挂在上一行末尾，允许略微超出），左括号不留在行尾
                while (end < rest.length() && NO_LINE_START.indexOf(rest.charAt(end)) >= 0) end++;
                while (end > 1 && end < rest.length() && NO_LINE_END.indexOf(rest.charAt(end - 1)) >= 0) end--;
            }
            String line = rest.substring(0, end).trim();
            rest = rest.substring(end).trim();
            if (out.size() == maxLines - 1 && !rest.isEmpty()) {
                while (line.length() > 1 && fm.stringWidth(line + "…") > maxWidth) line = line.substring(0, line.length() - 1);
                line = line + "…";
                rest = "";
            }
            out.add(line);
        }
        return out;
    }

    private static boolean isLatin(char c) { return c < 0x2E80; }
    private static final String NO_LINE_START = "）)］]｝}】」』》〉〕、。，．,.！!？?：:；;…‥·・～ー%％";
    private static final String NO_LINE_END = "（(［[｛{【「『《〈〔";

    private int s(double designPx) { return (int) Math.round(designPx * k); }

    private Font sans(int style, double size) { return new Font(SANS_FAMILY, style, s(size)); }

    private Font serif(int style, double size) { return new Font(SERIF_FAMILY, style, s(size)); }

    /** 选中的字体能否显示中文。Linux 服务器没装 CJK 字体时会退回逻辑字体，成片里的中文会变成方块。 */
    static String fontReport() {
        String sample = "旅迹东京下次再见";
        boolean sans = new Font(SANS_FAMILY, Font.PLAIN, 24).canDisplayUpTo(sample) == -1;
        boolean serif = new Font(SERIF_FAMILY, Font.PLAIN, 24).canDisplayUpTo(sample) == -1;
        return sans && serif ? null : "sans=" + SANS_FAMILY + (sans ? "" : "(不支持中文)") + ", serif=" + SERIF_FAMILY + (serif ? "" : "(不支持中文)");
    }

    static String families() { return "sans=" + SANS_FAMILY + ", serif=" + SERIF_FAMILY; }

    private static String pick(String[] preferred) {
        Set<String> installed = new HashSet<>(Arrays.asList(
                GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames()));
        for (String name : preferred) if (installed.contains(name)) return name;
        return preferred[preferred.length - 1];
    }
}
