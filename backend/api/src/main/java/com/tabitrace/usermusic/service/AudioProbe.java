package com.tabitrace.usermusic.service;

import java.nio.charset.StandardCharsets;

/**
 * 按文件内容（而不是扩展名 / 浏览器给的 MIME）识别音频格式并读取时长。纯 Java 实现，API 不依赖 FFmpeg。
 * - MP3：跳过 ID3v2 标签，找到 MPEG-1/2/2.5 Layer III 帧，并要求后面连续几帧也合法（防止把任意二进制误认成 MP3）；
 *        时长取 Xing / Info / VBRI 头里的帧数，没有时按 CBR 估算
 * - M4A：ISO-BMFF（ftyp 开头），读取 moov/mvhd 的时长；必须有音频轨（soun），不能有视频轨（vide）—— 改了扩展名的视频会被拒绝
 * - WAV：RIFF/WAVE，PCM / IEEE float / Extensible，时长 = data 块大小 ÷ 每秒字节数
 * 视频、压缩包、可执行文件等都识别不出来，返回 UNKNOWN。
 */
public final class AudioProbe {
    private AudioProbe() {}

    public enum Format {
        MP3("audio/mpeg", "mp3"), M4A("audio/mp4", "m4a"), WAV("audio/wav", "wav");
        public final String mime, extension;
        Format(String mime, String extension) { this.mime = mime; this.extension = extension; }
    }

    /** format 为 null 时 failure 说明原因：UNKNOWN / CONTAINS_VIDEO / CORRUPTED */
    public record Result(Format format, double durationSeconds, String failure) {
        static Result ok(Format f, double seconds) { return new Result(f, seconds, null); }
        static Result fail(String reason) { return new Result(null, 0, reason); }
        public boolean ok() { return format != null; }
    }

    public static Result probe(byte[] b) {
        if (b == null || b.length < 64) return Result.fail("UNKNOWN");
        try {
            if (ascii(b, 0, "RIFF")) return ascii(b, 8, "WAVE") ? wav(b) : Result.fail(ascii(b, 8, "AVI ") ? "CONTAINS_VIDEO" : "UNKNOWN");
            if (ascii(b, 4, "ftyp")) return mp4(b);
            return mp3(b);
        } catch (RuntimeException ex) {
            return Result.fail("CORRUPTED");
        }
    }

    // ───────────── WAV ─────────────

    private static Result wav(byte[] b) {
        long byteRate = 0; int format = -1; long dataSize = -1;
        int p = 12;
        while (p + 8 <= b.length) {
            String id = new String(b, p, 4, StandardCharsets.US_ASCII);
            long size = u32le(b, p + 4);
            int body = p + 8;
            if ("fmt ".equals(id) && size >= 16 && body + 16 <= b.length) {
                format = u16le(b, body);
                byteRate = u32le(b, body + 8);
            } else if ("data".equals(id)) {
                // 有的录音软件写入 0 或超出文件的大小：按实际剩余字节计算
                dataSize = size == 0 || body + size > b.length ? b.length - body : size;
                break;
            }
            p = body + (int) Math.min(size + (size & 1), Integer.MAX_VALUE - body);
        }
        if (format != 1 && format != 3 && format != 0xFFFE) return Result.fail("UNKNOWN");
        if (byteRate <= 0 || dataSize <= 0) return Result.fail("CORRUPTED");
        return Result.ok(Format.WAV, (double) dataSize / byteRate);
    }

    // ───────────── M4A（ISO-BMFF）─────────────

    private static Result mp4(byte[] b) {
        double duration = -1; int audio = 0, video = 0;
        int[] moov = box(b, 0, b.length, "moov");
        if (moov == null) return Result.fail("CORRUPTED");
        int[] mvhd = box(b, moov[0], moov[1], "mvhd");
        if (mvhd != null) duration = mvhdDuration(b, mvhd[0]);
        // 遍历每个 trak 的 mdia/hdlr，统计音频轨与视频轨
        int p = moov[0];
        while (p + 8 <= moov[1]) {
            long size = boxSize(b, p, moov[1]);
            if (size < 8) break;
            if (ascii(b, p + 4, "trak")) {
                int end = (int) Math.min(moov[1], p + size);
                int[] mdia = box(b, p + 8, end, "mdia");
                int[] hdlr = mdia == null ? null : box(b, mdia[0], mdia[1], "hdlr");
                if (hdlr != null && hdlr[0] + 12 <= b.length) {
                    String handler = new String(b, hdlr[0] + 8, 4, StandardCharsets.US_ASCII);
                    if ("soun".equals(handler)) audio++;
                    if ("vide".equals(handler)) video++;
                }
            }
            p += (int) size;
        }
        if (video > 0) return Result.fail("CONTAINS_VIDEO");
        if (audio == 0) return Result.fail("UNKNOWN");
        if (duration <= 0) return Result.fail("CORRUPTED");
        return Result.ok(Format.M4A, duration);
    }

    /** 在 [from, to) 里找子 box，返回其内容的 [start, end)；size=1 为 64 位长度，size=0 表示到父容器末尾 */
    private static int[] box(byte[] b, int from, int to, String type) {
        int p = from;
        while (p + 8 <= to) {
            long size = boxSize(b, p, to);
            if (size < 8) return null;
            int header = u32be(b, p) == 1 ? 16 : 8;
            if (ascii(b, p + 4, type)) return new int[]{p + header, (int) Math.min(to, p + size)};
            if (p + size > to) return null;
            p += (int) size;
        }
        return null;
    }

    private static long boxSize(byte[] b, int p, int to) {
        long size = u32be(b, p);
        if (size == 1) size = p + 16 <= b.length ? u64be(b, p + 8) : -1;
        else if (size == 0) size = to - p;
        return size;
    }

    private static double mvhdDuration(byte[] b, int p) {
        int version = b[p] & 0xFF;
        long timescale, duration;
        if (version == 1) { timescale = u32be(b, p + 20); duration = u64be(b, p + 24); }
        else { timescale = u32be(b, p + 12); duration = u32be(b, p + 16); }
        return timescale <= 0 ? -1 : (double) duration / timescale;
    }

    // ───────────── MP3 ─────────────

    private static final int[][] BITRATES = {
            // MPEG-1 Layer III
            {0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0},
            // MPEG-2 / 2.5 Layer III
            {0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0}};
    private static final int[][] SAMPLE_RATES = {{44100, 48000, 32000}, {22050, 24000, 16000}, {11025, 12000, 8000}};

    private record Frame(int version, int bitrate, int sampleRate, int length, boolean mono, int samples) {}

    private static Result mp3(byte[] b) {
        int start = 0;
        if (ascii(b, 0, "ID3") && b.length > 10) {
            int size = ((b[6] & 0x7F) << 21) | ((b[7] & 0x7F) << 14) | ((b[8] & 0x7F) << 7) | (b[9] & 0x7F);
            start = 10 + size + ((b[5] & 0x10) != 0 ? 10 : 0);
        }
        // 标签后只允许 0 字节填充（64KB 以内），第一帧必须紧接着出现：
        // 不在任意位置搜索帧同步，避免把内嵌 MP3 音轨的视频容器（AVI、MPEG-PS 等）误认成 MP3
        int limit = Math.min(b.length - 4, start + 64 * 1024);
        int p = start;
        while (p < limit && b[p] == 0) p++;
        Frame f = p < limit ? frame(b, p) : null;
        if (f == null || !followedByFrames(b, p, f, 3)) return Result.fail("UNKNOWN");
        int end = b.length >= 128 && ascii(b, b.length - 128, "TAG") ? b.length - 128 : b.length;
        double seconds = vbrDuration(b, p, f);
        if (seconds <= 0) seconds = (end - p) * 8.0 / (f.bitrate() * 1000.0);
        return Result.ok(Format.MP3, seconds);
    }

    private static Frame frame(byte[] b, int p) {
        if (p + 4 > b.length) return null;
        int h = u32be(b, p);
        if ((h & 0xFFE00000) != 0xFFE00000) return null;
        int versionBits = (h >>> 19) & 3, layer = (h >>> 17) & 3, bitrateIdx = (h >>> 12) & 0xF, rateIdx = (h >>> 10) & 3;
        if (versionBits == 1 || layer != 1 || bitrateIdx == 0 || bitrateIdx == 15 || rateIdx == 3) return null;
        boolean mpeg1 = versionBits == 3;
        int bitrate = BITRATES[mpeg1 ? 0 : 1][bitrateIdx];
        int sampleRate = SAMPLE_RATES[mpeg1 ? 0 : versionBits == 2 ? 1 : 2][rateIdx];
        int padding = (h >>> 9) & 1;
        int samples = mpeg1 ? 1152 : 576;
        int length = (samples / 8) * bitrate * 1000 / sampleRate + padding;
        boolean mono = ((h >>> 6) & 3) == 3;
        return length < 24 ? null : new Frame(versionBits, bitrate, sampleRate, length, mono, samples);
    }

    /** 当前帧后面还要有 n 个合法帧（版本和采样率一致），文件很短时到文件末尾为止 */
    private static boolean followedByFrames(byte[] b, int p, Frame first, int n) {
        int q = p + first.length();
        for (int i = 0; i < n; i++) {
            if (q + 4 > b.length) return i > 0 || q == b.length;
            Frame f = frame(b, q);
            if (f == null || f.version() != first.version() || f.sampleRate() != first.sampleRate()) return false;
            q += f.length();
        }
        return true;
    }

    /** Xing / Info（LAME 写入）或 VBRI（Fraunhofer）头里的总帧数 → 时长；没有时返回 -1 */
    private static double vbrDuration(byte[] b, int p, Frame f) {
        boolean mpeg1 = f.version() == 3;
        int side = mpeg1 ? (f.mono() ? 17 : 32) : (f.mono() ? 9 : 17);
        int x = p + 4 + side;
        if (x + 12 <= b.length && (ascii(b, x, "Xing") || ascii(b, x, "Info"))) {
            int flags = u32be(b, x + 4);
            if ((flags & 1) != 0) {
                long frames = u32be(b, x + 8) & 0xFFFFFFFFL;
                if (frames > 0) return frames * (double) f.samples() / f.sampleRate();
            }
        }
        int v = p + 4 + 32;
        if (v + 18 <= b.length && ascii(b, v, "VBRI")) {
            long frames = u32be(b, v + 14) & 0xFFFFFFFFL;
            if (frames > 0) return frames * (double) f.samples() / f.sampleRate();
        }
        return -1;
    }

    // ───────────── 字节工具 ─────────────

    private static boolean ascii(byte[] b, int p, String s) {
        if (p < 0 || p + s.length() > b.length) return false;
        for (int i = 0; i < s.length(); i++) if (b[p + i] != (byte) s.charAt(i)) return false;
        return true;
    }
    private static int u16le(byte[] b, int p) { return (b[p] & 0xFF) | (b[p + 1] & 0xFF) << 8; }
    private static long u32le(byte[] b, int p) { return (b[p] & 0xFFL) | (b[p + 1] & 0xFFL) << 8 | (b[p + 2] & 0xFFL) << 16 | (b[p + 3] & 0xFFL) << 24; }
    private static int u32be(byte[] b, int p) { return (b[p] & 0xFF) << 24 | (b[p + 1] & 0xFF) << 16 | (b[p + 2] & 0xFF) << 8 | (b[p + 3] & 0xFF); }
    private static long u64be(byte[] b, int p) { return ((long) u32be(b, p) << 32) | (u32be(b, p + 4) & 0xFFFFFFFFL); }
}
