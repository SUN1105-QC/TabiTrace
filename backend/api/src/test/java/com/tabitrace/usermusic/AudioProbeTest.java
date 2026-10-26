package com.tabitrace.usermusic;

import com.tabitrace.usermusic.service.AudioProbe;
import com.tabitrace.usermusic.service.AudioProbe.Format;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

/** 按文件内容识别音频：扩展名、MIME 都可以伪造，这里只看字节 */
class AudioProbeTest {

    // ───── 构造测试文件 ─────

    /** 16-bit 立体声 44.1kHz PCM WAV */
    static byte[] wav(double seconds) {
        int byteRate = 44100 * 2 * 2;
        int data = (int) (byteRate * seconds);
        ByteBuffer b = ByteBuffer.allocate(44 + data).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36 + data).put("WAVE".getBytes(StandardCharsets.US_ASCII));
        b.put("fmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short) 1).putShort((short) 2).putInt(44100).putInt(byteRate)
                .putShort((short) 4).putShort((short) 16);
        b.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(data);
        return b.array();
    }

    /** MPEG-1 Layer III 128kbps 44.1kHz CBR，每帧 417 字节 */
    static byte[] mp3(int frames, boolean id3) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (id3) {
            byte[] tag = new byte[10 + 100];
            tag[0] = 'I'; tag[1] = 'D'; tag[2] = '3'; tag[3] = 4; tag[9] = 100;
            out.writeBytes(tag);
        }
        for (int i = 0; i < frames; i++) {
            byte[] f = new byte[417];
            f[0] = (byte) 0xFF; f[1] = (byte) 0xFB; f[2] = (byte) 0x90; f[3] = 0x00;
            out.writeBytes(f);
        }
        return out.toByteArray();
    }

    static byte[] box(String type, byte[]... children) {
        int len = 8;
        for (byte[] c : children) len += c.length;
        ByteBuffer b = ByteBuffer.allocate(len);
        b.putInt(len).put(type.getBytes(StandardCharsets.US_ASCII));
        for (byte[] c : children) b.put(c);
        return b.array();
    }


    /** ftyp + moov(mvhd + trak(mdia(hdlr))) */
    static byte[] mp4(String... handlers) {
        byte[] ftyp = box("ftyp", "M4A ".getBytes(StandardCharsets.US_ASCII), new byte[4], "isom".getBytes(StandardCharsets.US_ASCII));
        ByteBuffer mvhdBody = ByteBuffer.allocate(100);
        mvhdBody.put((byte) 0).put(new byte[3]).putInt(0).putInt(0).putInt(1000).putInt(185_500);
        byte[] mvhd = box("mvhd", mvhdBody.array());
        byte[][] traks = new byte[handlers.length][];
        for (int i = 0; i < handlers.length; i++) {
            ByteBuffer h = ByteBuffer.allocate(24);
            h.putInt(0).putInt(0).put(handlers[i].getBytes(StandardCharsets.US_ASCII));
            traks[i] = box("trak", box("mdia", box("hdlr", h.array())));
        }
        byte[][] moovChildren = new byte[traks.length + 1][];
        moovChildren[0] = mvhd;
        System.arraycopy(traks, 0, moovChildren, 1, traks.length);
        byte[] moov = box("moov", moovChildren);
        byte[] mdat = box("mdat", new byte[512]);
        ByteBuffer all = ByteBuffer.allocate(ftyp.length + mdat.length + moov.length);
        return all.put(ftyp).put(mdat).put(moov).array();
    }

    // ───── 识别成功 ─────

    @Test void wavDuration() {
        AudioProbe.Result r = AudioProbe.probe(wav(3.5));
        assertEquals(Format.WAV, r.format());
        assertEquals(3.5, r.durationSeconds(), 0.01);
    }

    @Test void mp3CbrDurationWithAndWithoutId3() {
        AudioProbe.Result plain = AudioProbe.probe(mp3(400, false));
        assertEquals(Format.MP3, plain.format());
        assertEquals(400 * 417 * 8 / 128000.0, plain.durationSeconds(), 0.05);
        AudioProbe.Result tagged = AudioProbe.probe(mp3(400, true));
        assertEquals(Format.MP3, tagged.format());
        assertEquals(plain.durationSeconds(), tagged.durationSeconds(), 0.05);
    }

    @Test void m4aAudioOnly() {
        AudioProbe.Result r = AudioProbe.probe(mp4("soun"));
        assertEquals(Format.M4A, r.format());
        assertEquals(185.5, r.durationSeconds(), 0.01);
    }

    // ───── 拒绝 ─────

    @Test void videoInsideMp4IsRejected() {
        AudioProbe.Result r = AudioProbe.probe(mp4("vide", "soun"));
        assertFalse(r.ok());
        assertEquals("CONTAINS_VIDEO", r.failure());
    }

    @Test void aviIsRejectedAsVideo() {
        byte[] avi = new byte[256];
        System.arraycopy("RIFF".getBytes(StandardCharsets.US_ASCII), 0, avi, 0, 4);
        System.arraycopy("AVI ".getBytes(StandardCharsets.US_ASCII), 0, avi, 8, 4);
        assertEquals("CONTAINS_VIDEO", AudioProbe.probe(avi).failure());
    }

    @Test void executablesZipsAndRandomBytesAreUnknown() {
        byte[] exe = new byte[4096]; exe[0] = 'M'; exe[1] = 'Z';
        byte[] zip = new byte[4096]; zip[0] = 'P'; zip[1] = 'K'; zip[2] = 3; zip[3] = 4;
        byte[] noise = new byte[64 * 1024]; new Random(7).nextBytes(noise);
        assertFalse(AudioProbe.probe(exe).ok());
        assertFalse(AudioProbe.probe(zip).ok());
        assertFalse(AudioProbe.probe(noise).ok());
        assertFalse(AudioProbe.probe(new byte[10]).ok());
        assertFalse(AudioProbe.probe(null).ok());
    }

    @Test void mp3FramesBuriedInsideOtherDataAreNotAccepted() {
        // 帧同步只允许出现在开头（或 ID3 标签 / 0 填充之后）：前面有任意数据的文件不是 MP3
        byte[] frames = mp3(50, false);
        byte[] junk = new byte[1000 + frames.length];
        for (int i = 0; i < 1000; i++) junk[i] = (byte) (i % 200 + 1);
        System.arraycopy(frames, 0, junk, 1000, frames.length);
        assertFalse(AudioProbe.probe(junk).ok());
    }

    @Test void truncatedWavIsCorruptedNotCrash() {
        // 只有 RIFF 头和 fmt 块、没有 data 块
        byte[] w = wav(1);
        byte[] cut = new byte[80];
        System.arraycopy(w, 0, cut, 0, 36);
        AudioProbe.Result r = AudioProbe.probe(cut);
        assertFalse(r.ok());
        assertEquals("CORRUPTED", r.failure());
    }

}
