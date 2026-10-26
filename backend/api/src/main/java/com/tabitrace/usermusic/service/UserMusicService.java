package com.tabitrace.usermusic.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.membership.service.MembershipService;
import com.tabitrace.membership.service.MembershipService.MembershipView;
import com.tabitrace.photo.dto.PhotoDtos.PresignResponse;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.usermusic.dto.UserMusicDtos.*;
import com.tabitrace.usermusic.entity.UserMusicEntity;
import com.tabitrace.usermusic.mapper.UserMusicMapper;
import com.tabitrace.usermusic.service.AudioProbe.Format;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * 「我的音乐」：会员上传自己的音乐，用于 Travel Story。
 *
 * 上传流程：申请上传地址（会员 + 版权确认 + 扩展名 / MIME / 大小 / 额度校验，服务端生成随机存储路径并登记 UPLOADING）
 * → 浏览器直传存储 → 完成登记（再次检查会员，服务端读取文件按内容识别格式、读取时长）→ READY 或 FAILED。
 * 前端不会也不能自己“伪造”一条音乐：列表只来自这里。
 *
 * 权限：所有操作都要求是音乐的主人（其他人一律 404，不暴露是否存在）；
 * 上传、重命名、用于视频要求有效会员；查看、试听、删除不需要（会员到期后只读）。
 */
@Service
public class UserMusicService {
    private static final Logger log = LoggerFactory.getLogger(UserMusicService.class);
    public static final String UPLOADING = "UPLOADING", PROCESSING = "PROCESSING", READY = "READY", FAILED = "FAILED", DELETED = "DELETED";
    public static final String KEY_PREFIX = "user-music/";

    /** 扩展名 → 格式 */
    static final Map<String, Format> EXTENSIONS = Map.of("mp3", Format.MP3, "m4a", Format.M4A, "wav", Format.WAV);
    /** 浏览器给出的 MIME → 格式（同一格式在不同浏览器 / 系统上的常见写法） */
    static final Map<String, Format> MIME_TYPES = Map.of(
            "audio/mpeg", Format.MP3, "audio/mp3", Format.MP3,
            "audio/mp4", Format.M4A, "audio/x-m4a", Format.M4A, "audio/m4a", Format.M4A,
            "audio/wav", Format.WAV, "audio/x-wav", Format.WAV, "audio/wave", Format.WAV, "audio/vnd.wave", Format.WAV);

    private final UserMusicMapper mapper;
    private final StorageService storage;
    private final MembershipService memberships;
    private final UserMusicProperties props;

    public UserMusicService(UserMusicMapper mapper, StorageService storage, MembershipService memberships, UserMusicProperties props) {
        this.mapper = mapper; this.storage = storage; this.memberships = memberships; this.props = props;
    }

    // ───────────── 查询 ─────────────

    public Library library(Long userId) {
        MembershipView m = memberships.current(userId);
        List<UserMusicView> items = mapper.listVisible(userId).stream().map(this::view).toList();
        return new Library(m, m.active(), m.active(), limits(), usage(userId), items);
    }

    public Limits limits() {
        return new Limits(props.maxFileBytes, props.maxTracks, props.maxTotalBytes, props.minDurationSeconds, props.maxDurationSeconds,
                List.of("MP3", "M4A", "WAV"), List.of("mp3", "m4a", "wav"), List.of("audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav"));
    }

    private Usage usage(Long userId) {
        Map<String, Object> u = mapper.usage(userId);
        return new Usage(((Number) u.get("tracks")).intValue(), ((Number) u.get("bytes")).longValue());
    }

    // ───────────── 上传 ─────────────

    public UploadUrlResponse uploadUrl(Long userId, UploadUrlRequest r) {
        memberships.require(userId, MembershipService.FEATURE_CUSTOM_MUSIC);
        if (!Boolean.TRUE.equals(r.copyrightConfirmed())) {
            throw new BusinessException("COPYRIGHT_CONFIRMATION_REQUIRED", "请先确认你拥有这首音乐用于视频创作的合法使用权");
        }
        String fileName = cleanFileName(r.fileName());
        Format format = formatOf(fileName, r.contentType());
        long size = r.fileSize() == null ? 0 : r.fileSize();
        if (size <= 0) throw new BusinessException("USER_MUSIC_EMPTY", "文件是空的，请换一个音乐文件");
        if (size > props.maxFileBytes) {
            throw new BusinessException("USER_MUSIC_TOO_LARGE", "文件超过 " + props.maxFileMb() + "MB，请压缩后再上传", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        Usage u = usage(userId);
        if (u.tracks() >= props.maxTracks) {
            throw new BusinessException("USER_MUSIC_LIMIT", "「我的音乐」最多保存 " + props.maxTracks + " 首，请先删除不用的音乐");
        }
        if (u.bytes() + size > props.maxTotalBytes) {
            throw new BusinessException("USER_MUSIC_STORAGE_FULL", "音乐空间不足（共 " + props.maxTotalBytes / (1024 * 1024) + "MB），请先删除不用的音乐");
        }
        UserMusicEntity m = new UserMusicEntity();
        m.userId = userId;
        m.title = cleanTitle(r.title(), fileName);
        m.originalFilename = fileName;
        // 随机路径：不使用用户的文件名，防止路径注入、覆盖其他文件和特殊字符问题
        m.storageKey = KEY_PREFIX + userId + "/" + UUID.randomUUID() + "." + format.extension;
        m.mimeType = format.mime;
        m.fileSize = size;
        m.status = UPLOADING;
        m.copyrightConfirmed = true;
        m.copyrightConfirmedAt = LocalDateTime.now(ZoneOffset.UTC);
        mapper.insert(m);
        String contentType = r.contentType().trim().toLowerCase(Locale.ROOT);
        PresignResponse presign = storage.presignKey(m.storageKey, contentType, size);
        return new UploadUrlResponse(view(mapper.findById(m.id)), presign.uploadUrl(), contentType, presign.expiresInSeconds(), presign.mock());
    }

    /**
     * 文件已上传：再次检查会员，然后按文件内容识别格式（扩展名、MIME 都可以伪造）。
     * 解析失败时状态为 FAILED 并给出原因，存储里的文件立即删除；成功则 READY。
     */
    public UserMusicView complete(Long userId, Long musicId) {
        UserMusicEntity m = requireOwned(userId, musicId);
        if (READY.equals(m.status) || FAILED.equals(m.status)) return view(m);
        if (!UPLOADING.equals(m.status)) throw new BusinessException("USER_MUSIC_PROCESSING", "这首音乐正在处理中，请稍候", HttpStatus.CONFLICT);
        try {
            memberships.require(userId, MembershipService.FEATURE_CUSTOM_MUSIC);
        } catch (BusinessException ex) {
            failAndPurge(m, "MEMBERSHIP_CHANGED");
            throw ex;
        }
        if (mapper.claim(m.id) == 0) throw new BusinessException("USER_MUSIC_PROCESSING", "这首音乐正在处理中，请稍候", HttpStatus.CONFLICT);

        byte[] bytes;
        try {
            if (!storage.exists(m.storageKey)) return failAndPurge(m, "UPLOAD_MISSING");
            bytes = storage.read(m.storageKey);
        } catch (RuntimeException ex) {
            log.warn("USER_MUSIC: 读取上传文件失败 id={} reason={}", m.id, ex.getMessage());
            return failAndPurge(m, "UPLOAD_MISSING");
        }
        if (bytes.length == 0) return failAndPurge(m, "UPLOAD_MISSING");
        if (bytes.length > props.maxFileBytes) return failAndPurge(m, "FILE_TOO_LARGE");

        AudioProbe.Result probe = AudioProbe.probe(bytes);
        if (!probe.ok()) return failAndPurge(m, switch (probe.failure()) {
            case "CONTAINS_VIDEO" -> "CONTAINS_VIDEO";
            case "CORRUPTED" -> "PARSE_FAILED";
            default -> "UNSUPPORTED_FORMAT";
        });
        Format declared = EXTENSIONS.get(extension(m.storageKey));
        if (probe.format() != declared) return failAndPurge(m, "FORMAT_MISMATCH");
        if (probe.durationSeconds() < props.minDurationSeconds) return failAndPurge(m, "DURATION_TOO_SHORT");
        if (probe.durationSeconds() > props.maxDurationSeconds) return failAndPurge(m, "DURATION_TOO_LONG");

        mapper.ready(m.id, probe.format().mime, bytes.length, BigDecimal.valueOf(probe.durationSeconds()).setScale(2, RoundingMode.HALF_UP));
        return view(mapper.findById(m.id));
    }

    private UserMusicView failAndPurge(UserMusicEntity m, String code) {
        mapper.fail(m.id, code);
        purge(m);
        return view(mapper.findById(m.id));
    }

    // ───────────── 管理 ─────────────

    public UserMusicView rename(Long userId, Long musicId, String title) {
        UserMusicEntity m = requireOwned(userId, musicId);
        memberships.require(userId, MembershipService.FEATURE_CUSTOM_MUSIC);
        String t = cleanTitle(title, null);
        if (t.isEmpty()) throw new BusinessException("USER_MUSIC_TITLE_REQUIRED", "请输入音乐名称");
        mapper.rename(m.id, userId, t);
        return view(mapper.findById(m.id));
    }

    /**
     * 删除：记录标为 DELETED（列表里消失，不能再用于新视频）。
     * 已生成的视频不受影响（成片里已经混好了音乐）；正在排队 / 生成中的视频还要读这个文件，等它们结束后由清理任务删除。
     */
    public void delete(Long userId, Long musicId) {
        UserMusicEntity m = mapper.findById(musicId);
        if (m == null || !userId.equals(m.userId)) throw notFound();
        if (DELETED.equals(m.status)) return;
        mapper.softDelete(m.id, userId);
        if (mapper.countActiveRenders(m.id) == 0) purge(m);
    }

    public PlayUrl playUrl(Long userId, Long musicId) {
        UserMusicEntity m = requireOwned(userId, musicId);
        if (!m.ready()) throw new BusinessException("USER_MUSIC_NOT_READY", "这首音乐还不能试听");
        return new PlayUrl(storage.signedReadUrl(m.storageKey, props.playUrlTtlSeconds), props.playUrlTtlSeconds);
    }

    // ───────────── 给 Travel Story 用 ─────────────

    /**
     * 用于视频（保存 / 生成时都会调用）：必须是自己的、处理完成的音乐，并且当前是有效会员。
     * 会员到期后历史视频照常播放下载，但不能再用自定义音乐生成新视频。
     */
    public UserMusicEntity requireUsable(Long userId, Long musicId) {
        UserMusicEntity m = musicId == null ? null : mapper.findById(musicId);
        if (m == null || !userId.equals(m.userId)) throw new BusinessException("USER_MUSIC_NOT_FOUND", "音乐不存在或已被删除", HttpStatus.NOT_FOUND);
        if (DELETED.equals(m.status)) throw new BusinessException("VIDEO_USER_MUSIC_DELETED", "原音乐已被删除，请重新选择。");
        if (!m.ready()) throw new BusinessException("VIDEO_USER_MUSIC_UNAVAILABLE", "「" + m.title + "」还没有处理完成或处理失败，请重新选择音乐");
        memberships.require(userId, MembershipService.FEATURE_CUSTOM_MUSIC);
        return m;
    }

    public UserMusicEntity find(Long id) { return id == null ? null : mapper.findById(id); }

    // ───────────── 清理 ─────────────

    /** 删除存储文件并记下清理时间；删除失败留给清理任务重试 */
    void purge(UserMusicEntity m) {
        try {
            storage.delete(m.storageKey);
            mapper.markPurged(m.id);
        } catch (RuntimeException ex) {
            log.warn("USER_MUSIC: 删除文件失败，稍后重试 id={} reason={}", m.id, ex.getMessage());
        }
    }

    /** 清理任务：放弃的上传标为删除；已删除 / 失败、且没有视频正在使用的文件从存储删除 */
    public int cleanup() {
        mapper.abandonStale(props.abandonAfterMinutes);
        List<UserMusicEntity> list = mapper.listPurgeable(100);
        list.forEach(this::purge);
        return list.size();
    }

    // ───────────── 内部 ─────────────

    private UserMusicEntity requireOwned(Long userId, Long id) {
        UserMusicEntity m = id == null ? null : mapper.findById(id);
        // 不是自己的音乐与不存在一样返回 404：不暴露别人的音乐是否存在
        if (m == null || !userId.equals(m.userId) || DELETED.equals(m.status)) throw notFound();
        return m;
    }

    private static BusinessException notFound() {
        return new BusinessException("USER_MUSIC_NOT_FOUND", "音乐不存在或已被删除", HttpStatus.NOT_FOUND);
    }

    /** 扩展名与 MIME 必须都是允许的格式，且指向同一种格式；文件内容在完成登记时再检查一次 */
    static Format formatOf(String fileName, String contentType) {
        Format byExt = EXTENSIONS.get(extension(fileName));
        String mime = contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
        int semi = mime.indexOf(';');
        if (semi >= 0) mime = mime.substring(0, semi).trim();
        Format byMime = MIME_TYPES.get(mime);
        if (byExt == null || byMime == null) {
            throw new BusinessException("USER_MUSIC_TYPE_UNSUPPORTED", "只支持 MP3、M4A、WAV 音乐文件", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }
        if (byExt != byMime) throw new BusinessException("USER_MUSIC_TYPE_MISMATCH", "文件扩展名与文件类型不一致，请上传原始音频文件", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        return byExt;
    }

    static String extension(String name) {
        int dot = name == null ? -1 : name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    /** 只保留文件名本身（去掉路径与控制字符），仅用于展示 */
    static String cleanFileName(String name) {
        String n = name == null ? "" : name.replace('\\', '/');
        n = n.substring(n.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "").trim();
        if (n.isEmpty()) throw new BusinessException("USER_MUSIC_TYPE_UNSUPPORTED", "只支持 MP3、M4A、WAV 音乐文件", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        return n.length() > 255 ? n.substring(n.length() - 255) : n;
    }

    /** 名称：去掉控制字符、合并空白，最多 60 字；没填时用文件名（去掉扩展名） */
    static String cleanTitle(String title, String fileName) {
        String t = title == null ? "" : title.replaceAll("\\p{Cntrl}", " ").replaceAll("\\s+", " ").trim();
        if (t.isEmpty() && fileName != null) {
            int dot = fileName.lastIndexOf('.');
            t = (dot > 0 ? fileName.substring(0, dot) : fileName).replaceAll("\\p{Cntrl}", " ").replaceAll("\\s+", " ").trim();
        }
        if (t.isEmpty() && fileName != null) t = "我的音乐";
        return t.codePointCount(0, t.length()) > 60 ? t.substring(0, t.offsetByCodePoints(0, 60)) : t;
    }

    UserMusicView view(UserMusicEntity m) {
        Format f = EXTENSIONS.get(extension(m.storageKey));
        return new UserMusicView(m.id, m.title, m.originalFilename, f == null ? null : f.name(), m.mimeType,
                m.fileSize == null ? 0 : m.fileSize, m.durationSeconds == null ? null : m.durationSeconds.doubleValue(),
                m.status, m.failureCode, failureMessage(m.failureCode), m.createdAt, m.updatedAt);
    }

    String failureMessage(String code) {
        if (code == null) return null;
        return switch (code) {
            case "UPLOAD_MISSING" -> "没有收到完整的音乐文件，可能是网络中断，请重新上传";
            case "FILE_TOO_LARGE" -> "文件超过 " + props.maxFileMb() + "MB，请压缩后重新上传";
            case "UNSUPPORTED_FORMAT" -> "无法识别为 MP3 / M4A / WAV 音频，请换一个文件";
            case "FORMAT_MISMATCH" -> "文件内容与扩展名不一致（例如把其他格式改成了 .mp3），请上传原始音频文件";
            case "CONTAINS_VIDEO" -> "这是视频文件，请上传纯音频（MP3 / M4A / WAV）";
            case "PARSE_FAILED" -> "音乐文件已损坏或无法解析，请换一个文件";
            case "DURATION_TOO_SHORT" -> "音乐太短（至少 " + props.minDurationSeconds + " 秒）";
            case "DURATION_TOO_LONG" -> "音乐太长（最长 " + props.maxDurationSeconds / 60 + " 分钟）";
            case "MEMBERSHIP_CHANGED" -> "会员状态已变化，本次上传没有完成";
            default -> "音乐处理失败，请重新上传";
        };
    }
}
