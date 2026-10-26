package com.tabitrace.worker;

import org.junit.jupiter.api.Test;

import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

/** 视频文字换行：中文避头尾（右括号、句读不在行首，左括号不在行尾），不丢字 */
class ScenePainterWrapTest {
    private static FontMetrics metrics() {
        Graphics2D g = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB).createGraphics();
        g.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 20));
        return g.getFontMetrics();
    }

    @Test
    void closingPunctuationNeverStartsALine() {
        FontMetrics fm = metrics();
        String title = "东京审计旅行（改名）";
        // 宽度恰好放下 9 个字：不处理的话 “）” 会单独掉到第二行
        int width = fm.stringWidth("东京审计旅行（改名");
        List<String> lines = ScenePainter.wrap(title, fm, width, 3);
        assertEquals(title, String.join("", lines));
        for (String line : lines) assertFalse(line.startsWith("）"), lines.toString());
    }

    @Test
    void openingBracketNeverEndsALine() {
        FontMetrics fm = metrics();
        String text = "银座散步（晚上）和筑地市场";
        int width = fm.stringWidth("银座散步（");
        List<String> lines = ScenePainter.wrap(text, fm, width, 5);
        assertEquals(text, String.join("", lines));
        for (String line : lines) assertFalse(line.endsWith("（"), lines.toString());
        for (String line : lines) assertFalse(line.startsWith("）") || line.startsWith("，"), lines.toString());
    }
}
