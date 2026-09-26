package com.tabitrace.worker;

import java.awt.*;
import java.awt.geom.Path2D;
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

    record MapPoint(String name, String time, double lat, double lng) {}

    private final int w, h;
    private final double k;
    private final String template;
    private final boolean watermark;

    ScenePainter(int width, int height, String template, boolean watermark) {
        this.w = width;
        this.h = height;
        this.k = width / 1080.0;
        this.template = template == null ? "JOURNAL" : template.toUpperCase(Locale.ROOT);
        this.watermark = watermark;
    }

    // ───────────── 开场 ─────────────

    BufferedImage opening(BufferedImage cover, String kicker, String title, String subtitle, String destination) {
        BufferedImage img = canvas();
        Graphics2D g = graphics(img);
        if ("MINIMAL".equals(template)) {
            paper(g);
            if (cover != null) framedPhoto(g, cover, s(90), s(200), w - s(180), s(1180));
            text(g, kicker, serif(Font.PLAIN, 28), MUTED, s(90), s(1500), w - s(180), 1, 0.3f);
            text(g, title, serif(Font.BOLD, 72), INK, s(90), s(1600), w - s(180), 2, 0);
            text(g, subtitle, sans(Font.PLAIN, 30), MUTED, s(90), s(1790), w - s(180), 1, 0);
        } else {
            if (cover != null) cover(g, cover, 0, 0, w, h); else paper(g);
            boolean city = "CITY".equals(template);
            gradient(g, city ? 0 : h * 0.35, h, city ? 150 : 40, 215);
            if (city) {
                int y = s(760);
                text(g, destination == null ? "" : destination.toUpperCase(Locale.ROOT), sans(Font.BOLD, 150), Color.WHITE, s(80), y, w - s(160), 1, 0);
                bar(g, s(80), y + s(40), s(160), s(12));
                text(g, title, sans(Font.BOLD, 58), Color.WHITE, s(80), y + s(150), w - s(160), 2, 0);
                text(g, subtitle, sans(Font.PLAIN, 32), new Color(255, 255, 255, 215), s(80), y + s(330), w - s(160), 1, 0);
            } else {
                text(g, kicker, sans(Font.BOLD, 30), BRAND, s(90), s(1330), w - s(180), 1, 0.35f);
                text(g, title, serif(Font.BOLD, 88), Color.WHITE, s(90), s(1450), w - s(180), 2, 0);
                text(g, subtitle, sans(Font.PLAIN, 34), new Color(255, 255, 255, 225), s(90), s(1690), w - s(180), 1, 0);
                if (destination != null && !destination.isBlank()) pill(g, destination, s(90), s(1745));
            }
        }
        finish(g, img);
        return img;
    }

    // ───────────── 照片镜头 ─────────────

    BufferedImage photo(BufferedImage photo, String title, String subtitle, String note, boolean firstShot, int index, int total) {
        BufferedImage img = canvas();
        Graphics2D g = graphics(img);
        switch (template) {
            case "MINIMAL" -> {
                paper(g);
                framedPhoto(g, photo, s(90), s(170), w - s(180), s(1330));
                text(g, title, serif(Font.BOLD, 54), INK, s(90), s(1640), w - s(180), 1, 0);
                text(g, subtitle, sans(Font.PLAIN, 28), MUTED, s(90), s(1715), w - s(180), 1, 0);
                if (firstShot) text(g, note, serif(Font.ITALIC, 30), MUTED, s(90), s(1790), w - s(180), 2, 0);
            }
            case "CITY" -> {
                cover(g, photo, 0, 0, w, h);
                gradient(g, 0, h * 0.42, 190, 0);
                gradient(g, h * 0.78, h, 0, 170);
                text(g, title, sans(Font.BOLD, 84), Color.WHITE, s(80), s(250), w - s(160), 2, 0);
                bar(g, s(80), s(290) + (title != null && lines(g, title, sans(Font.BOLD, 84), w - s(160)) > 1 ? s(100) : 0), s(120), s(10));
                text(g, subtitle, sans(Font.PLAIN, 32), new Color(255, 255, 255, 220), s(80), s(400), w - s(160), 1, 0);
                text(g, String.format(Locale.ROOT, "%02d / %02d", index, total), sans(Font.BOLD, 30), BRAND, s(80), h - s(110), s(300), 1, 0.1f);
                if (firstShot) text(g, note, sans(Font.PLAIN, 32), Color.WHITE, s(80), h - s(260), w - s(160), 2, 0);
            }
            default -> {
                cover(g, photo, 0, 0, w, h);
                gradient(g, h * 0.52, h, 0, 205);
                int y = s(1450);
                bar(g, s(90), y, s(64), s(8));
                text(g, title, serif(Font.BOLD, 64), Color.WHITE, s(90), y + s(100), w - s(180), 2, 0);
                text(g, subtitle, sans(Font.PLAIN, 30), new Color(255, 255, 255, 215), s(90), y + s(185), w - s(180), 1, 0);
                if (note != null && !note.isBlank()) {
                    text(g, "“" + note + "”", sans(Font.PLAIN, 32), new Color(255, 255, 255, 235), s(90), y + s(265), w - s(180), 3, 0);
                }
            }
        }
        finish(g, img);
        return img;
    }

    // ───────────── 地图路线 ─────────────

    /** upto：画到第几个点（含）；-1 表示全部。 */
    BufferedImage map(List<MapPoint> points, int upto, String title, String subtitle) {
        BufferedImage img = canvas();
        Graphics2D g = graphics(img);
        paper(g);
        g.setColor(LINE);
        g.setStroke(new BasicStroke((float) (2 * k)));
        for (int x = s(90); x < w; x += s(120)) g.drawLine(x, s(300), x, h - s(300));
        for (int y = s(300); y < h - s(300); y += s(120)) g.drawLine(s(40), y, w - s(40), y);

        text(g, "ROUTE", sans(Font.BOLD, 28), BRAND, s(90), s(170), w - s(180), 1, 0.35f);
        text(g, title, serif(Font.BOLD, 70), INK, s(90), s(260), w - s(180), 1, 0);
        text(g, subtitle, sans(Font.PLAIN, 30), MUTED, s(90), s(330), w - s(180), 1, 0);

        int last = upto < 0 ? points.size() - 1 : Math.min(upto, points.size() - 1);
        double[][] xy = project(points, s(140), s(470), w - s(280), h - s(1020));

        Path2D route = new Path2D.Double();
        route.moveTo(xy[0][0], xy[0][1]);
        for (int i = 1; i <= last; i++) route.lineTo(xy[i][0], xy[i][1]);
        g.setColor(new Color(0xE9, 0x7A, 0x33, 60));
        g.setStroke(new BasicStroke((float) (26 * k), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.draw(route);
        g.setColor(BRAND);
        g.setStroke(new BasicStroke((float) (10 * k), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.draw(route);

        // 先画全部标记，再统一摆标签，标签不会被后画的标记压住
        double[][] badge = spread(xy, last, s(30));
        List<Rectangle> occupied = new ArrayList<>();
        for (int i = 0; i <= last; i++) {
            boolean current = upto >= 0 && i == last;
            if (badge[i][0] != xy[i][0] || badge[i][1] != xy[i][1]) {
                g.setColor(BRAND);
                g.setStroke(new BasicStroke((float) (3 * k)));
                g.drawLine((int) xy[i][0], (int) xy[i][1], (int) badge[i][0], (int) badge[i][1]);
            }
            marker(g, badge[i][0], badge[i][1], i + 1, current);
            int r = s(current ? 54 : 34);
            occupied.add(new Rectangle((int) badge[i][0] - r, (int) badge[i][1] - r, 2 * r, 2 * r));
        }
        boolean labelAll = upto < 0 && points.size() <= 10;
        for (int i = 0; i <= last; i++) {
            boolean must = i == 0 || i == last;
            if (labelAll || must) label(g, points.get(i).name(), badge[i][0], badge[i][1], occupied, must);
        }

        MapPoint focus = points.get(last);
        int cardY = h - s(470);
        g.setColor(Color.WHITE);
        g.fill(new RoundRectangle2D.Double(s(90), cardY, w - s(180), s(210), s(40), s(40)));
        g.setColor(LINE);
        g.setStroke(new BasicStroke((float) (2 * k)));
        g.draw(new RoundRectangle2D.Double(s(90), cardY, w - s(180), s(210), s(40), s(40)));
        text(g, String.format(Locale.ROOT, "%02d", last + 1), sans(Font.BOLD, 56), BRAND, s(130), cardY + s(120), s(140), 1, 0);
        text(g, focus.name(), serif(Font.BOLD, 46), INK, s(260), cardY + s(95), w - s(390), 1, 0);
        text(g, focus.time(), sans(Font.PLAIN, 28), MUTED, s(260), cardY + s(160), w - s(390), 1, 0);
        finish(g, img);
        return img;
    }

    // ───────────── 成就 ─────────────

    BufferedImage achievements(String title, String subtitle, List<String> items) {
        BufferedImage img = canvas();
        Graphics2D g = graphics(img);
        paper(g);
        text(g, "ACHIEVEMENTS", sans(Font.BOLD, 28), BRAND, s(90), s(420), w - s(180), 1, 0.35f);
        text(g, title, serif(Font.BOLD, 84), INK, s(90), s(540), w - s(180), 1, 0);
        text(g, subtitle, sans(Font.PLAIN, 32), MUTED, s(90), s(620), w - s(180), 1, 0);
        int y = s(740);
        for (String item : items) {
            g.setColor(Color.WHITE);
            g.fill(new RoundRectangle2D.Double(s(90), y, w - s(180), s(150), s(36), s(36)));
            g.setColor(BRAND);
            g.fillOval(s(130), y + s(35), s(80), s(80));
            text(g, "★", sans(Font.BOLD, 40), Color.WHITE, s(150), y + s(92), s(60), 1, 0);
            text(g, item, sans(Font.BOLD, 40), INK, s(250), y + s(92), w - s(380), 1, 0);
            y += s(180);
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
        int y = s(760);
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

    private void marker(Graphics2D g, double x, double y, int number, boolean current) {
        int r = s(current ? 36 : 26);
        if (current) {
            g.setColor(new Color(0xE9, 0x7A, 0x33, 70));
            g.fillOval((int) x - r - s(18), (int) y - r - s(18), 2 * (r + s(18)), 2 * (r + s(18)));
        }
        g.setColor(Color.WHITE);
        g.fillOval((int) x - r, (int) y - r, 2 * r, 2 * r);
        g.setColor(BRAND);
        g.setStroke(new BasicStroke((float) (7 * k)));
        g.drawOval((int) x - r, (int) y - r, 2 * r, 2 * r);
        Font f = sans(Font.BOLD, current ? 30 : 24);
        g.setFont(f);
        String n = String.valueOf(number);
        FontMetrics fm = g.getFontMetrics();
        g.drawString(n, (int) x - fm.stringWidth(n) / 2, (int) y + fm.getAscent() / 2 - s(3));
    }

    /**
     * 标签依次尝试右、左、上、下四个位置，取第一个不与已有标签 / 标记重叠且不出画布的位置。
     * 都放不下时：首尾站点（must）取重叠最少的位置，其余站点省略标签（序号与底部卡片仍能识别）。
     */
    private void label(Graphics2D g, String name, double x, double y, List<Rectangle> occupied, boolean must) {
        if (name == null || name.isBlank()) return;
        g.setFont(sans(Font.BOLD, 28));
        String t = name.length() > 10 ? name.substring(0, 10) + "…" : name;
        int bw = g.getFontMetrics().stringWidth(t) + s(36), bh = s(52), gap = s(46);
        int[][] candidates = {
                {(int) x + gap, (int) y - bh / 2},
                {(int) x - gap - bw, (int) y - bh / 2},
                {(int) x - bw / 2, (int) y - gap - bh},
                {(int) x - bw / 2, (int) y + gap}};
        Rectangle best = null;
        long bestOverlap = Long.MAX_VALUE;
        for (int[] c : candidates) {
            Rectangle rect = new Rectangle(c[0], c[1], bw, bh);
            if (rect.x < s(30) || rect.y < s(380) || rect.x + bw > w - s(30) || rect.y + bh > h - s(500)) continue;
            long overlap = 0;
            for (Rectangle o : occupied) {
                Rectangle hit = rect.intersection(o);
                if (!hit.isEmpty()) overlap += (long) hit.width * hit.height;
            }
            if (overlap == 0) { best = rect; bestOverlap = 0; break; }
            if (overlap < bestOverlap) { best = rect; bestOverlap = overlap; }
        }
        if (best == null || (bestOverlap > 0 && !must)) return;
        occupied.add(best);
        g.setColor(new Color(255, 255, 255, 235));
        g.fill(new RoundRectangle2D.Double(best.x, best.y, bw, bh, s(20), s(20)));
        g.setColor(INK);
        g.drawString(t, best.x + s(18), best.y + s(36));
    }

    /** 几乎重合的站点把序号标记错开排成一圈，用短线连回真实位置，避免数字叠在一起。 */
    private static double[][] spread(double[][] xy, int last, int minDistance) {
        double[][] out = new double[xy.length][2];
        for (int i = 0; i <= last; i++) {
            out[i][0] = xy[i][0];
            out[i][1] = xy[i][1];
            for (int attempt = 0; attempt < 8 && crowded(out, i, minDistance); attempt++) {
                double angle = Math.PI / 4 * attempt - Math.PI / 4;
                out[i][0] = xy[i][0] + Math.cos(angle) * minDistance * 1.9;
                out[i][1] = xy[i][1] + Math.sin(angle) * minDistance * 1.9;
            }
        }
        return out;
    }

    private static boolean crowded(double[][] pts, int i, int minDistance) {
        for (int j = 0; j < i; j++) {
            if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < minDistance * 1.6) return true;
        }
        return false;
    }

    /** 经纬度 → 画布坐标：经度按纬度余弦压缩，保持东西 / 南北比例正确。 */
    private static double[][] project(List<MapPoint> points, int x, int y, int bw, int bh) {
        double midLat = points.stream().mapToDouble(MapPoint::lat).average().orElse(0);
        double cos = Math.cos(Math.toRadians(midLat));
        double minX = Double.MAX_VALUE, maxX = -Double.MAX_VALUE, minY = Double.MAX_VALUE, maxY = -Double.MAX_VALUE;
        double[][] raw = new double[points.size()][2];
        for (int i = 0; i < points.size(); i++) {
            raw[i][0] = points.get(i).lng() * cos;
            raw[i][1] = -points.get(i).lat();
            minX = Math.min(minX, raw[i][0]);
            maxX = Math.max(maxX, raw[i][0]);
            minY = Math.min(minY, raw[i][1]);
            maxY = Math.max(maxY, raw[i][1]);
        }
        double spanX = Math.max(maxX - minX, 0.002), spanY = Math.max(maxY - minY, 0.002);
        double scale = Math.min(bw / spanX, bh / spanY);
        double offX = x + (bw - spanX * scale) / 2, offY = y + (bh - spanY * scale) / 2;
        double[][] out = new double[points.size()][2];
        for (int i = 0; i < points.size(); i++) {
            out[i][0] = offX + (raw[i][0] - minX) * scale;
            out[i][1] = offY + (raw[i][1] - minY) * scale;
        }
        return out;
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
        List<String> lines = wrap(value, fm, w - s(180), maxLines);
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
