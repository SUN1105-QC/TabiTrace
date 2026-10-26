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

    public VideoService(VideoProjectMapper mapper, VideoProjectPhotoMapper projectPhotos, PhotoMapper photos, TripService trips,
                        VideoCatalogMapper catalog, StoryboardService storyboards, ObjectMapper json, com.tabitrace.photo.storage.StorageService storage) {
        this(mapper, projectPhotos, photos, trips, catalog, storyboards, json, storage, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public VideoService(VideoProjectMapper mapper, VideoProjectPhotoMapper projectPhotos, PhotoMapper photos, TripService trips,
                        VideoCatalogMapper catalog, StoryboardService storyboards, ObjectMapper json, com.tabitrace.photo.storage.StorageService storage,
                        UserMusicService userMusic) {
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
    private record Resolved(VideoTemplateEntity template, VideoMusicEntity music, UserMusicEntity userMusic, String ratio, int duration, String quality,
                            Long coverPhotoId, Settings settings, List<Long> photoIds) {}

    // ───────────── 目录 ─────────────

    public List<VideoTemplateView> templates() {
        return catalog.templates().stream().filter(t -> Boolean.TRUE.equals(t.enabled))
                .map(t -> new VideoTemplateView(t.code, t.name, t.englishName, t.description, t.suitableFor, t.pace,
                        t.transition, t.transitionSeconds.doubleValue(), t.plan, t.recommendedMusic))
                .toList();
    }

    public List<VideoMusicView> music() { return music(null, null, false); }

    /**
     * 选择器曲库：只列出可用曲目（已启用、授权已核验、音频已导入）。试听只给 45 秒片段，不暴露原曲存储路径。
     * 可按分类、推荐模板、只看 FREE 过滤；排序由后台 sort_order 决定，新增 / 下架 / 改分类都不需要改前端。
     */
    public List<VideoMusicView> music(String category, String template, boolean freeOnly) {
        String cat = category == null || category.isBlank() ? null : category.trim().toUpperCase(Locale.ROOT);
        String tpl = template == null || template.isBlank() ? null : template.trim().toUpperCase(Locale.ROOT);
        return catalog.music().stream().filter(VideoMusicEntity::usable)
                .filter(m -> cat == null || cat.equals(m.category))
                .filter(m -> tpl == null || split(m.recommendedTemplates).contains(tpl))
                .filter(m -> !freeOnly || "FREE".equals(m.plan))
                .map(m -> new VideoMusicView(m.code, m.name, m.category, m.mood,
                        m.durationSeconds == null ? null : m.durationSeconds.doubleValue(), m.plan, split(m.recommendedTemplates),
                        m.artist, split(m.mood), split(m.instruments), m.bpm, m.energy, Boolean.TRUE.equals(m.essential),
                        m.previewKey == null ? null : storage.publicUrl(m.previewKey),
                        Boolean.TRUE.equals(m.attributionRequired), m.attributionText, m.license, m.licenseUrl, m.source, m.sourceUrl,
                        Boolean.TRUE.equals(m.commercialUse), Boolean.TRUE.equals(m.derivativesAllowed)))
                .toList();
    }

    /** 开发环境版权后台用：全部曲目（含 REVIEW_REQUIRED）及授权证据 */
    public List<MusicLicenseView> musicLicenses() {
        return catalog.music().stream().map(m -> new MusicLicenseView(m.code, m.name, m.artist, m.source, m.sourceUrl,
                m.license, m.licenseUrl, m.licenseNotes, Boolean.TRUE.equals(m.attributionRequired), m.attributionText,
                Boolean.TRUE.equals(m.commercialUse), Boolean.TRUE.equals(m.exportAllowed), m.status, m.plan, Boolean.TRUE.equals(m.enabled),
                m.licenseCheckedAt, m.downloadedAt, m.fileSha256, d(m.durationSeconds), m.bpm, m.bpmSource, d(m.loudnessLufs),
                d(m.introStart), d(m.mainStart), d(m.highlightStart), d(m.outroStart))).toList();
    }

    private static List<String> split(String csv) {
        return csv == null || csv.isBlank() ? List.of() : java.util.Arrays.stream(csv.split(",")).map(String::trim).filter(x -> !x.isEmpty()).toList();
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
        MusicCues.MusicCue cue = v.userMusic() != null
                ? MusicCues.userCue(v.userMusic(), v.duration(), v.settings().musicVolume())
                : MusicCues.cue(v.music(), v.duration(), v.settings().musicVolume());
        if (cue != null) frozen.put("music", cue);
        p.storyboardJson = json.writeValueAsString(frozen);
        if (p.name == null) p.name = defaultName(t, v);
        if (mapper.queue(p) == 0) {
            throw new BusinessException("VIDEO_ALREADY_RENDERING", "这个视频正在生成中，请等待完成", HttpStatus.CONFLICT);
        }
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
        p.musicCode = src.musicCode;
        p.musicSource = src.musicSource;
        p.userMusicId = src.userMusicId;
        p.showText = src.showText;
        p.showAchievements = src.showAchievements;
        p.settingsJson = src.settingsJson;
        p.status = "DRAFT";
        p.progress = 0;
        mapper.insert(p);
        replacePhotos(p.id, ids);
        return view(mapper.findById(p.id), t);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        VideoProjectEntity p = requireOwned(userId, id);
        trips.requireWritable(userId, p.tripId);
        if ("PROCESSING".equals(p.status)) {
            throw new BusinessException("VIDEO_PROCESSING", "正在生成的视频不能删除，请等待完成后再删除", HttpStatus.CONFLICT);
        }
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

        VideoMusicEntity music = null;
        UserMusicEntity mine = null;
        try {
            Object m = resolveMusic(t, r, pro);
            if (m instanceof VideoMusicEntity vm) music = vm;
            if (m instanceof UserMusicEntity um) mine = um;
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
        return new Resolved(template, music, mine, ratio, duration, quality, cover, settings, List.copyOf(ids));
    }

    /**
     * 音乐来源：SYSTEM → 系统曲库（下架 / 套餐检查）；USER → 「我的音乐」（必须是自己的、处理完成的，且当前是有效会员）；
     * NONE / 都没填 → 无音乐（旧客户端可能提交 musicCode = "NONE"，同样视为无音乐）。返回 VideoMusicEntity / UserMusicEntity / null。
     */
    private Object resolveMusic(TripEntity t, UpsertVideoProjectRequest r, boolean pro) {
        String source = r.musicSource() == null || r.musicSource().isBlank() ? null : r.musicSource().trim().toUpperCase(Locale.ROOT);
        if (source != null && !List.of("SYSTEM", "USER", "NONE").contains(source)) {
            throw new BusinessException("VIDEO_MUSIC_SOURCE_INVALID", "不支持的音乐来源");
        }
        if ("NONE".equals(source)) return null;
        if ("USER".equals(source) || (source == null && r.userMusicId() != null)) {
            if (userMusic == null) throw new BusinessException("VIDEO_USER_MUSIC_UNAVAILABLE", "暂时不能使用自定义音乐");
            if (r.userMusicId() == null) throw new BusinessException("VIDEO_USER_MUSIC_REQUIRED", "请选择一首「我的音乐」");
            return userMusic.requireUsable(t.userId, r.userMusicId());
        }
        String musicCode = r.musicCode() == null || r.musicCode().isBlank() || "NONE".equalsIgnoreCase(r.musicCode().trim())
                ? null : r.musicCode().trim().toUpperCase(Locale.ROOT);
        if (musicCode == null) return null;
        VideoMusicEntity music = catalog.musicByCode(musicCode);
        if (music == null) throw new BusinessException("VIDEO_MUSIC_INVALID", "视频音乐不存在");
        if (!music.usable()) {
            // 已下架 / 授权复核中 / 音频未导入：历史视频照常播放，重新生成时请用户换一首
            throw new BusinessException("VIDEO_MUSIC_UNAVAILABLE", "「" + music.name + "」已下架或暂时不可用，请重新选择音乐");
        }
        if (!pro && "PRO".equals(music.plan)) {
            throw proRequired("PRO_MUSIC_REQUIRED", "「" + music.name + "」是 Trip Pro 音乐，Free 旅行可以使用基础音乐");
        }
        return music;
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
        p.musicCode = v.music() == null ? null : v.music().code;
        p.userMusicId = v.userMusic() == null ? null : v.userMusic().id;
        p.musicSource = v.userMusic() != null ? "USER" : v.music() != null ? "SYSTEM" : null;
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
        StorySettings settings = p.settingsJson != null
                ? json.readValue(p.settingsJson, StorySettings.class)
                : StoryboardService.normalize(null, p.showText, p.showAchievements).toDto();
        boolean pro = "PRO".equals(t.planType);
        return new VideoProjectView(p.id, p.tripId, p.name, p.templateCode, p.aspectRatio, p.duration, p.quality,
                StoryboardService.resolution(p.aspectRatio, p.quality), !pro, p.musicCode, p.musicSource, p.userMusicId, p.coverPhotoId,
                Boolean.TRUE.equals(p.showText), Boolean.TRUE.equals(p.showAchievements),
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
