package com.tabitrace.video.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.usermusic.entity.UserMusicEntity;
import com.tabitrace.usermusic.service.UserMusicService;
import com.tabitrace.video.dto.VideoDtos.*;
import com.tabitrace.video.entity.VideoMusicEntity;
import com.tabitrace.video.entity.VideoProjectEntity;
import com.tabitrace.video.entity.VideoTemplateEntity;
import com.tabitrace.video.mapper.VideoCatalogMapper;
import com.tabitrace.video.mapper.VideoProjectMapper;
import com.tabitrace.video.mapper.VideoProjectPhotoMapper;
import com.tabitrace.video.service.StoryboardService.Settings;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Locale;

@Service
public class VideoService {
    public static final int FREE_MAX_PHOTOS = 10;
    /** 每个用户同时排队 / 生成中的视频上限：渲染很耗 CPU，防止刷生成拖垮渲染机或造成账单失控 */
    public static final int MAX_ACTIVE_RENDERS_PER_USER = 2;
    public static final int PRO_MAX_PHOTOS = 30;
    private static final List<Integer> DURATIONS = List.of(15, 30, 60);
    /** Free 旅行可选的视频时长；Trip Pro 可用 DURATIONS 全部 */
    public static final List<Integer> FREE_DURATIONS = List.of(15, 30);
    public static final List<Integer> PRO_DURATIONS = DURATIONS;
    public static final String FREE_QUALITY = "720p";
    public static final String PRO_QUALITY = "1080p";
    /** 成片比例：9:16 竖屏、4:5 社交信息流、16:9 横屏（Free / Pro 都可用；Worker 按比例重新排版，不是裁切） */
    public static final List<String> SUPPORTED_RATIOS = List.of("9:16", "4:5", "16:9");
    private static final List<String> QUALITIES = List.of("720p", "1080p");

    private final VideoProjectMapper mapper;
    private final VideoProjectPhotoMapper projectPhotos;
    private final PhotoMapper photos;
    private final TripService trips;
    private final VideoCatalogMapper catalog;
    private final StoryboardService storyboards;
    private final ObjectMapper json;
    private final com.tabitrace.photo.storage.StorageService storage;
    /** 「我的音乐」：自定义音乐的主人、状态与会员检查都在 UserMusicService.requireUsable */
    private final UserMusicService userMusic;
    private final com.tabitrace.cost.CostControlService costs;

    public VideoService(VideoProjectMapper mapper, VideoProjectPhotoMapper projectPhotos, PhotoMapper photos, TripService trips,
                        VideoCatalogMapper catalog, StoryboardService storyboards, ObjectMapper json, com.tabitrace.photo.storage.StorageService storage) {
        this(mapper, projectPhotos, photos, trips, catalog, storyboards, json, storage, null, null);
    }

    public VideoService(VideoProjectMapper mapper, VideoProjectPhotoMapper projectPhotos, PhotoMapper photos, TripService trips,
                        VideoCatalogMapper catalog, StoryboardService storyboards, ObjectMapper json, com.tabitrace.photo.storage.StorageService storage,
                        UserMusicService userMusic) {
        this(mapper,projectPhotos,photos,trips,catalog,storyboards,json,storage,userMusic,null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public VideoService(VideoProjectMapper mapper, VideoProjectPhotoMapper projectPhotos, PhotoMapper photos, TripService trips,
                        VideoCatalogMapper catalog, StoryboardService storyboards, ObjectMapper json, com.tabitrace.photo.storage.StorageService storage,
                        UserMusicService userMusic,com.tabitrace.cost.CostControlService costs) {
        this.costs=costs;
        this.userMusic = userMusic;
        this.storage = storage;
        this.mapper = mapper;
        this.projectPhotos = projectPhotos;
        this.photos = photos;
        this.trips = trips;
        this.catalog = catalog;
        this.storyboards = storyboards;
        this.json = json;
    }

    /** 校验通过后的完整参数。 */
    private record Resolved(VideoTemplateEntity template, UserMusicEntity userMusic, String ratio, int duration, String quality,
                            Long coverPhotoId, Settings settings, List<Long> photoIds) {}

    // ───────────── 目录 ─────────────

    public List<VideoTemplateView> templates() {
        return catalog.templates().stream().filter(t -> Boolean.TRUE.equals(t.enabled))
                .map(t -> new VideoTemplateView(t.code, t.name, t.englishName, t.description, t.suitableFor, t.pace,
                        t.transition, t.transitionSeconds.doubleValue(), t.plan, null))
                .toList();
    }

    public List<VideoMusicView> music() { return music(null, null, false); }

    /** 自带曲库已停用；保留旧接口并返回空列表，用户上传音乐走 /user/music。 */
    public List<VideoMusicView> music(String category, String template, boolean freeOnly) {
        return List.of();
    }

    /** 开发环境版权后台用：全部曲目（含 REVIEW_REQUIRED）及授权证据 */
    public List<MusicLicenseView> musicLicenses() {
        return catalog.music().stream().map(m -> new MusicLicenseView(m.code, m.name, m.artist, m.source, m.sourceUrl,
                m.license, m.licenseUrl, m.licenseNotes, Boolean.TRUE.equals(m.attributionRequired), m.attributionText,
                Boolean.TRUE.equals(m.commercialUse), Boolean.TRUE.equals(m.exportAllowed), m.status, m.plan, Boolean.TRUE.equals(m.enabled),
                m.licenseCheckedAt, m.downloadedAt, m.fileSha256, d(m.durationSeconds), m.bpm, m.bpmSource, d(m.loudnessLufs),
                d(m.introStart), d(m.mainStart), d(m.highlightStart), d(m.outroStart))).toList();
    }

    private static Double d(java.math.BigDecimal v) { return v == null ? null : v.doubleValue(); }

    // ───────────── 项目 ─────────────

    @Transactional
    public VideoProjectView create(Long userId, Long tripId, UpsertVideoProjectRequest r) {
        TripEntity t = trips.requireWritable(userId, tripId);
        Resolved v = validate(t, r, true);
        VideoProjectEntity p = new VideoProjectEntity();
        p.userId = userId;
        p.tripId = tripId;
        apply(p, t, v);
        p.status = "DRAFT";
        p.progress = 0;
        mapper.insert(p);
        replacePhotos(p.id, v.photoIds());
        return view(mapper.findById(p.id), t);
    }

    public List<VideoProjectView> list(Long userId, Long tripId) {
        TripEntity t = trips.requireOwned(userId, tripId);
        return mapper.listByTrip(tripId).stream().map(p -> view(p, t)).toList();
    }

    public VideoProjectView get(Long userId, Long id) {
        VideoProjectEntity p = requireOwned(userId, id);
        return view(p, trips.requireOwned(userId, p.tripId));
    }

    @Transactional
    public VideoProjectView update(Long userId, Long id, UpsertVideoProjectRequest r) {
        VideoProjectEntity p = requireOwned(userId, id);
        if (!"DRAFT".equals(p.status)) {
            throw new BusinessException("VIDEO_NOT_EDITABLE", "只有草稿可以直接修改；已生成的视频请使用「重新编辑」创建新版本", HttpStatus.CONFLICT);
        }
        TripEntity t = trips.requireWritable(userId, p.tripId);
        Resolved v = validate(t, r, true);
        apply(p, t, v);
        if (mapper.updateDraft(p) == 0) {
            throw new BusinessException("VIDEO_NOT_EDITABLE", "视频已开始生成，不能再修改草稿", HttpStatus.CONFLICT);
        }
        replacePhotos(p.id, v.photoIds());
        return view(mapper.findById(id), t);
    }

    /** 未保存的设置也能预览分镜：前端每次点「重新预览」都走这里。 */
    public StoryboardView preview(Long userId, Long tripId, UpsertVideoProjectRequest r) {
        TripEntity t = trips.requireOwned(userId, tripId);
        Resolved v = validate(t, r, false);
        return storyboards.build(userId, t, v.template(), v.duration(), v.quality(), v.ratio(), v.coverPhotoId(), v.settings(), v.photoIds());
    }

    /** 已开始生成的项目返回冻结的分镜；草稿按当前数据现算。 */
    public StoryboardView storyboard(Long userId, Long id) {
        VideoProjectEntity p = requireOwned(userId, id);
        TripEntity t = trips.requireOwned(userId, p.tripId);
        if (p.storyboardJson != null && !"DRAFT".equals(p.status)) {
            return json.readValue(p.storyboardJson, StoryboardView.class);
        }
        Resolved v = validate(t, requestOf(p), false);
        return storyboards.build(userId, t, v.template(), v.duration(), v.quality(), v.ratio(), v.coverPhotoId(), v.settings(), v.photoIds());
    }

    /** 开始生成 / 失败重试 / 已完成后重新生成，都走这里。分镜在此刻冻结，Worker 只按冻结结果渲染。 */
    @Transactional
    public VideoProjectView render(Long userId, Long id) {
        if(costs!=null)costs.lockRendering(userId);
        VideoProjectEntity p = requireOwned(userId, id);
        TripEntity t = trips.requireWritable(userId, p.tripId);
        if (List.of("QUEUED", "PROCESSING").contains(p.status)) {
            throw new BusinessException("VIDEO_ALREADY_RENDERING", "这个视频正在生成中，请等待完成", HttpStatus.CONFLICT);
        }
        if (mapper.countActiveByUser(userId) >= MAX_ACTIVE_RENDERS_PER_USER) {
            throw new BusinessException("VIDEO_QUEUE_LIMIT", "同时最多生成 " + MAX_ACTIVE_RENDERS_PER_USER + " 个视频，请等前面的完成后再试", HttpStatus.TOO_MANY_REQUESTS);
        }
        if (projectPhotos.photoIds(id).isEmpty()) {
            throw new BusinessException("VIDEO_PHOTOS_REQUIRED", "照片已被删除或还没有选择照片，请重新选择后再生成");
        }
        // 重新校验：照片可能被删、旅行套餐或模板目录可能已变化；自定义音乐会再次检查会员（会员到期后不能用于新视频）
        Resolved v = validate(t, requestOf(p), true);
        StoryboardView sb = storyboards.build(userId, t, v.template(), v.duration(), v.quality(), v.ratio(), v.coverPhotoId(), v.settings(), v.photoIds());
        if (!StoryboardService.hasPhotoScene(sb)) {
            throw new BusinessException("VIDEO_STORY_EMPTY", "分镜里至少要保留一个照片段落才能生成视频");
        }
        // 冻结分镜时一并锁定音乐片段（起点、增益、音量、署名、原曲路径），Worker 只按它渲染；这个字段不会出现在返回给前端的分镜里
        Map<String, Object> frozen = json.convertValue(sb, new tools.jackson.core.type.TypeReference<Map<String, Object>>() {});
        MusicCues.MusicCue cue = v.userMusic() == null ? null
                : MusicCues.userCue(v.userMusic(), v.duration(), v.settings().musicVolume());
        if (cue != null) frozen.put("music", cue);
        p.storyboardJson = json.writeValueAsString(frozen);
        if (p.name == null) p.name = defaultName(t, v);
        if (mapper.queue(p) == 0) {
            throw new BusinessException("VIDEO_ALREADY_RENDERING", "这个视频正在生成中，请等待完成", HttpStatus.CONFLICT);
        }
        if(costs!=null)costs.reserveRender(userId,v.duration());
        return view(mapper.findById(id), t);
    }

    /** 复制版本：已生成的视频不能改，复制出一个新草稿继续编辑。 */
    @Transactional
    public VideoProjectView duplicate(Long userId, Long id) {
        VideoProjectEntity src = requireOwned(userId, id);
        TripEntity t = trips.requireWritable(userId, src.tripId);
        List<Long> ids = projectPhotos.photoIds(id);
        if (ids.isEmpty()) throw new BusinessException("VIDEO_PHOTOS_REQUIRED", "原视频的照片都已被删除，无法复制");
        VideoProjectEntity p = new VideoProjectEntity();
        p.userId = userId;
        p.tripId = src.tripId;
        p.name = (src.name == null ? t.title : src.name) + " · 副本";
        p.templateCode = src.templateCode;
        p.aspectRatio = src.aspectRatio;
        p.duration = src.duration;
        p.quality = src.quality;
        p.coverPhotoId = src.coverPhotoId != null && ids.contains(src.coverPhotoId) ? src.coverPhotoId : null;
        // 历史成片保留原配乐与署名；复制出的新草稿只保留用户上传的音乐。
        boolean ownMusic = "USER".equals(src.musicSource) || (src.musicSource == null && src.userMusicId != null);
        p.musicCode = null;
        p.musicSource = ownMusic ? "USER" : null;
        p.userMusicId = ownMusic ? src.userMusicId : null;
        p.showText = src.showText;
        p.showAchievements = false;
        p.settingsJson = src.settingsJson;
        p.status = "DRAFT";
        p.progress = 0;
        mapper.insert(p);
        replacePhotos(p.id, ids);
        return view(mapper.findById(p.id), t);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        // Serializes deletion with Worker claim/publication. Never act on a stale status snapshot.
        VideoProjectEntity p = mapper.lockById(id);
        if (p == null) throw new BusinessException("VIDEO_PROJECT_NOT_FOUND", "视频项目不存在或已被删除", HttpStatus.NOT_FOUND);
        if (!userId.equals(p.userId)) throw new BusinessException("VIDEO_FORBIDDEN", "不能访问其他用户的视频项目", HttpStatus.FORBIDDEN);
        trips.requireWritable(userId, p.tripId);
        if ("PROCESSING".equals(p.status)) {
            throw new BusinessException("VIDEO_PROCESSING", "正在生成的视频不能删除，请等待完成后再删除", HttpStatus.CONFLICT);
        }
        mapper.enqueueOutputDeletion(p);
        mapper.delete(id);
    }

    // ───────────── 校验：FREE / PRO 规则全部在这里，前端限制只是体验 ─────────────

    /**
     * @param strictMusic 保存 / 生成时为 true：音乐不可用（下架、已删除、会员到期等）直接拒绝；
     *                    预览分镜时为 false：音乐不影响分镜，不可用时按无音乐处理，不阻止预览
     */
    private Resolved validate(TripEntity t, UpsertVideoProjectRequest r, boolean strictMusic) {
        boolean pro = "PRO".equals(t.planType);

        String templateCode = r.templateCode() == null ? "" : r.templateCode().trim().toUpperCase(Locale.ROOT);
        VideoTemplateEntity template = catalog.template(templateCode);
        if (template == null) throw new BusinessException("VIDEO_TEMPLATE_INVALID", "视频模板不存在");
        if (!Boolean.TRUE.equals(template.enabled)) {
            throw new BusinessException("VIDEO_TEMPLATE_UNAVAILABLE", "「" + template.name + "」模板暂时不可用，请换一个模板");
        }
        if (!pro && "PRO".equals(template.plan)) {
            throw proRequired("PRO_TEMPLATE_REQUIRED", "「" + template.name + "」是 Trip Pro 模板，Free 旅行可以使用「旅行日记」模板");
        }

        List<Long> ids = r.photoIds();
        if (ids == null || ids.isEmpty()) throw new BusinessException("VIDEO_PHOTOS_REQUIRED", "请至少选择一张照片");
        if (new HashSet<>(ids).size() != ids.size()) throw new BusinessException("VIDEO_PHOTO_DUPLICATED", "视频照片不能重复选择");
        int max = pro ? PRO_MAX_PHOTOS : FREE_MAX_PHOTOS;
        if (ids.size() > max) {
            if (pro) throw new BusinessException("VIDEO_PHOTO_LIMIT", "一个视频最多选择 " + PRO_MAX_PHOTOS + " 张照片");
            throw proRequired("PRO_PHOTO_LIMIT", "Free 旅行最多选择 " + FREE_MAX_PHOTOS + " 张照片，升级 Trip Pro 可使用更多素材。");
        }
        for (Long id : ids) {
            PhotoEntity ph = id == null ? null : photos.findById(id);
            if (ph == null) throw new BusinessException("VIDEO_PHOTO_NOT_FOUND", "有照片已被删除，请重新选择照片");
            if (!t.id.equals(ph.tripId)) {
                throw new BusinessException("VIDEO_PHOTO_INVALID", "视频照片不属于当前旅行", HttpStatus.FORBIDDEN);
            }
        }

        UserMusicEntity mine = null;
        try {
            mine = resolveMusic(t, r);
        } catch (BusinessException ex) {
            if (strictMusic) throw ex;
        }

        String ratio = r.aspectRatio() == null ? "9:16" : r.aspectRatio().trim();
        if (!SUPPORTED_RATIOS.contains(ratio)) throw new BusinessException("VIDEO_RATIO_UNSUPPORTED", "不支持的视频比例");

        int duration = r.duration() == null ? 30 : r.duration();
        if (!DURATIONS.contains(duration)) {
            throw new BusinessException("VIDEO_DURATION_UNSUPPORTED", "视频时长只能是 15、30 或 60 秒");
        }
        if (!pro && !FREE_DURATIONS.contains(duration)) {
            throw proRequired("PRO_DURATION_REQUIRED", "60 秒视频需要 Trip Pro，Free 旅行可以选择 15 或 30 秒");
        }

        String quality = r.quality() == null ? (pro ? PRO_QUALITY : FREE_QUALITY) : r.quality().trim().toLowerCase(Locale.ROOT);
        if (!QUALITIES.contains(quality)) throw new BusinessException("VIDEO_QUALITY_INVALID", "视频清晰度只能是 720p 或 1080p");
        if (!pro && PRO_QUALITY.equals(quality)) {
            throw proRequired("PRO_QUALITY_REQUIRED", "1080p 无水印导出需要 Trip Pro，Free 旅行导出 720p（带水印）");
        }

        Settings settings = StoryboardService.normalize(r.settings(), r.showText(), r.showAchievements());

        Long cover = r.coverPhotoId();
        if (cover != null && !ids.contains(cover)) {
            throw new BusinessException("VIDEO_COVER_INVALID", "封面必须是已选择的照片");
        }
        return new Resolved(template, mine, ratio, duration, quality, cover, settings, List.copyOf(ids));
    }

    /**
     * 新项目只支持 USER / NONE。拒绝旧客户端提交的自带音乐，用户音乐仍验证主人、状态和会员。
     */
    private UserMusicEntity resolveMusic(TripEntity t, UpsertVideoProjectRequest r) {
        String source = r.musicSource() == null || r.musicSource().isBlank() ? null : r.musicSource().trim().toUpperCase(Locale.ROOT);
        if (source != null && !List.of("SYSTEM", "USER", "NONE").contains(source)) {
            throw new BusinessException("VIDEO_MUSIC_SOURCE_INVALID", "不支持的音乐来源");
        }
        if ("NONE".equals(source)) return null;
        if ("SYSTEM".equals(source)) throw systemMusicRemoved();
        if ("USER".equals(source) || (source == null && r.userMusicId() != null)) {
            if (userMusic == null) throw new BusinessException("VIDEO_USER_MUSIC_UNAVAILABLE", "暂时不能使用自定义音乐");
            if (r.userMusicId() == null) throw new BusinessException("VIDEO_USER_MUSIC_REQUIRED", "请选择一首「我的音乐」");
            return userMusic.requireUsable(t.userId, r.userMusicId());
        }
        String musicCode = r.musicCode() == null || r.musicCode().isBlank() || "NONE".equalsIgnoreCase(r.musicCode().trim())
                ? null : r.musicCode().trim().toUpperCase(Locale.ROOT);
        if (musicCode != null) throw systemMusicRemoved();
        return null;
    }

    private static BusinessException systemMusicRemoved() {
        return new BusinessException("VIDEO_SYSTEM_MUSIC_REMOVED", "自带音乐已移除，请上传自己的音乐或选择无音乐");
    }

    private static BusinessException proRequired(String code, String message) {
        return new BusinessException(code, message, HttpStatus.FORBIDDEN);
    }

    // ───────────── 内部 ─────────────

    private void apply(VideoProjectEntity p, TripEntity t, Resolved v) {
        p.templateCode = v.template().code;
        p.aspectRatio = v.ratio();
        p.duration = v.duration();
        p.quality = v.quality();
        p.coverPhotoId = v.coverPhotoId();
        p.musicCode = null;
        p.userMusicId = v.userMusic() == null ? null : v.userMusic().id;
        p.musicSource = v.userMusic() != null ? "USER" : null;
        Settings s = v.settings();
        p.showText = s.showCheckinText();
        p.showAchievements = s.showAchievements();
        p.settingsJson = json.writeValueAsString(s.toDto());
        p.name = defaultName(t, v);
    }

    /** 东京旅行 · Journal / 东京旅行 · City · 15 秒版 / 东京旅行 · Journal · 60 秒 Pro 版 */
    private static String defaultName(TripEntity t, Resolved v) {
        String title = v.settings().title() != null ? v.settings().title() : t.title;
        String name = title + " · " + v.template().englishName;
        if (v.duration() == 15) name += " · 15 秒版";
        if (v.duration() == 60) name += " · 60 秒 Pro 版";
        return name.length() > 200 ? name.substring(0, 200) : name;
    }

    /** 从已保存的项目还原请求，用于生成前重新校验。 */
    private UpsertVideoProjectRequest requestOf(VideoProjectEntity p) {
        StorySettings s = p.settingsJson == null ? null : json.readValue(p.settingsJson, StorySettings.class);
        return new UpsertVideoProjectRequest(p.templateCode, p.aspectRatio, p.duration, p.musicCode, p.quality, p.coverPhotoId,
                p.showText, p.showAchievements, s, projectPhotos.photoIds(p.id), p.musicSource, p.userMusicId);
    }

    private VideoProjectEntity requireOwned(Long userId, Long id) {
        VideoProjectEntity p = mapper.findById(id);
        if (p == null) throw new BusinessException("VIDEO_PROJECT_NOT_FOUND", "视频项目不存在或已被删除", HttpStatus.NOT_FOUND);
        if (!userId.equals(p.userId)) {
            throw new BusinessException("VIDEO_FORBIDDEN", "不能访问其他用户的视频项目", HttpStatus.FORBIDDEN);
        }
        return p;
    }

    private void replacePhotos(Long projectId, List<Long> ids) {
        projectPhotos.deleteByProject(projectId);
        int sort = 1;
        for (Long id : ids) projectPhotos.add(projectId, id, sort++, null);
    }

    private VideoProjectView view(VideoProjectEntity p, TripEntity t) {
        StorySettings settings = StoryboardService.normalize(p.settingsJson == null
                ? null : json.readValue(p.settingsJson, StorySettings.class), p.showText, false).toDto();
        boolean pro = "PRO".equals(t.planType);
        return new VideoProjectView(p.id, p.tripId, p.name, p.templateCode, p.aspectRatio, p.duration, p.quality,
                StoryboardService.resolution(p.aspectRatio, p.quality), !pro, p.musicCode, p.musicSource, p.userMusicId, p.coverPhotoId,
                Boolean.TRUE.equals(p.showText), false,
                settings, p.status, p.progress, p.renderStage, p.renderer, p.outputUrl, p.errorCode, p.errorMessage, p.renderWarning,
                projectPhotos.photoIds(p.id), p.createdAt, p.updatedAt, p.completedAt,
                // 音乐不可用、已回退为无音乐生成时，成片里没有这首音乐，也就不需要署名
                (p.renderWarning != null && p.renderWarning.contains("MUSIC_FALLBACK")) || "USER".equals(p.musicSource) ? null : musicCredit(p.musicCode, settings));
    }

    /** 成片里真的有这首音乐时才需要署名：无音乐、音量 0 都不返回 */
    private String musicCredit(String code, StorySettings settings) {
        if (code == null) return null;
        if (settings != null && settings.musicVolume() != null && settings.musicVolume() <= 0) return null;
        VideoMusicEntity m = catalog.musicByCode(code);
        return m != null && Boolean.TRUE.equals(m.attributionRequired) ? m.attributionText : null;
    }
}
