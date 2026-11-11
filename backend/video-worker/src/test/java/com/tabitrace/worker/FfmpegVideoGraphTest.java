package com.tabitrace.worker;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 导出滤镜图的结构：静止段与转场段的帧数加起来正好等于目标时长，转场起点与 FFmpeg 的取整一致，
 * 调色的静态部分不逐帧计算，时域部分（FILM 颗粒、暗角）仍逐帧作用在整条视频上。
 * 成片与旧做法逐帧一致由 RenderBenchmarkTest（真实 FFmpeg）验证。
 */
class FfmpegVideoGraphTest {
    static List<?> shots(double... seconds) throws Exception {
        Class<?> shot = Class.forName("com.tabitrace.worker.FfmpegRenderer$Shot");
        Constructor<?> c = shot.getDeclaredConstructor(Path.class, double.class);
        c.setAccessible(true);
        List<Object> out = new ArrayList<>();
        for (int i = 0; i < seconds.length; i++) out.add(c.newInstance(Path.of("scene-" + i + ".jpg"), seconds[i]));
        return out;
    }

    @SuppressWarnings("unchecked")
    static String graph(List<?> shots, String transition, double t, int duration, String grade) throws Exception {
        var m = FfmpegRenderer.class.getDeclaredMethod("videoGraph", List.class, String.class, double.class, int.class, int[].class, String.class);
        m.setAccessible(true);
        return (String) m.invoke(null, shots, transition, t, duration, new int[]{1080, 1920}, grade);
    }

    /** 所有片段的帧数：静止段 loop=c-1 → c 帧，转场段 trim=end_frame=D → D 帧 */
    static int totalFrames(String g) {
        int total = 0;
        Matcher still = Pattern.compile("loop=loop=(\\d+):size=1:start=0,setpts=N/\\(30\\*TB\\)\\[p\\d+]").matcher(g);
        while (still.find()) total += Integer.parseInt(still.group(1)) + 1;
        Matcher trans = Pattern.compile("trim=end_frame=(\\d+),setpts=N/\\(30\\*TB\\),[^;]*null\\[p\\d+]").matcher(g);
        while (trans.find()) total += Integer.parseInt(trans.group(1));
        return total;
    }

    @Test void framesFollowFfmpegRounding() {
        assertEquals(15, FfmpegRenderer.frames(0.5));
        assertEquals(90, FfmpegRenderer.frames(3.0));
        assertEquals(53, FfmpegRenderer.frames(1.7666666));   // "1.767" → 53.01
        assertEquals(1590, FfmpegRenderer.frames(52.999999)); // "53.000"
        assertEquals(46, FfmpegRenderer.frames(1.517));       // 45.51 → 46
    }

    @Test void piecesAddUpToExactDuration() throws Exception {
        double per = 53.0 / 30;
        double[] secs = new double[32];
        secs[0] = 3; secs[31] = 4;
        for (int i = 1; i < 31; i++) secs[i] = per;
        String g = graph(shots(secs), "fade", 0.5, 60, "NATURAL");
        assertEquals(1800, totalFrames(g));
        assertTrue(g.contains("concat=n=63:v=1:a=0,format=yuv420p[vout]"));
        assertEquals(31 + 32, count(g, "xfade=transition=fade:duration=0.500:offset=0"), "31 个转场 + 32 个静止画面各经过一次 xfade");
        assertFalse(g.contains("-loop"));
    }

    @Test void transitionStartsWhereTheChainStartedIt() throws Exception {
        String g = graph(shots(3, 2.5, 4), "slideleft", 0.5, 10, "NATURAL");
        // 镜头 0：0..89 帧（90 帧）；转场 1：90..104；镜头 1：105..164（第 2 个转场从 5.5s = 165 帧开始）；转场 2：165..179；镜头 2：180..299
        assertTrue(g.contains("[s0][z0]xfade=transition=fade:duration=0.500:offset=0,trim=end_frame=1,setpts=N/(30*TB),loop=loop=89:"));
        assertTrue(g.contains("[s1][z1]xfade=transition=fade:duration=0.500:offset=0,trim=end_frame=1,setpts=N/(30*TB),loop=loop=59:"));
        assertTrue(g.contains("[s2][z2]xfade=transition=fade:duration=0.500:offset=0,trim=end_frame=1,setpts=N/(30*TB),loop=loop=119:"));
        // 转场段使用所选转场；静止画面统一经过 fade（与所选转场无关）
        assertEquals(2, count(g, "xfade=transition=slideleft"));
        assertEquals(300, totalFrames(g));
    }

    @Test void singleShotHasNoTransitionAndStaysUntouched() throws Exception {
        String g = graph(shots(15), "fade", 0, 15, "NATURAL");
        assertFalse(g.contains("xfade"));
        assertTrue(g.contains("[0:v]scale=1080:1920,setsar=1,format=yuv420p[s0];"));
        assertEquals(450, totalFrames(g));
    }

    @Test void gradeIsSplitIntoStillAndTemporalParts() throws Exception {
        String film = graph(shots(3, 3, 4), "fade", 0.5, 10, "FILM");
        // 颗粒随帧变化：只在拼接之后作用一次（逐帧），暗角在颗粒之后，顺序与原先一致
        assertTrue(film.endsWith("concat=n=5:v=1:a=0,noise=alls=7:allf=t,vignette=angle=PI/5,format=yuv420p[vout]"));
        assertEquals(1, count(film, "noise="));
        // 静态部分：3 个静止画面 + 2 个转场段各一次
        assertEquals(5, count(film, "colorbalance="));
        String[] parts = FfmpegRenderer.gradeParts("FILM");
        assertEquals(FfmpegRenderer.gradeFilter("FILM"), parts[0] + parts[1]);
        for (String g : List.of("NATURAL", "FRESH", "URBAN", "UNKNOWN")) {
            assertEquals(FfmpegRenderer.gradeFilter(g), FfmpegRenderer.gradeParts(g)[0]);
            assertEquals("", FfmpegRenderer.gradeParts(g)[1]);
        }
    }

    static int count(String s, String needle) {
        int n = 0;
        for (int i = s.indexOf(needle); i >= 0; i = s.indexOf(needle, i + 1)) n++;
        return n;
    }
}
