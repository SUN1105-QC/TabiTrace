package com.tabitrace.video.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.service.TripService;
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
import java.util.Locale;

@Service
public class VideoService {
    public static final int FREE_MAX_PHOTOS = 10;
    public static final int PRO_MAX_PHOTOS = 30;
    private static final List<Integer> DURATIONS = List.of(15, 30, 60);
    /** Free 旅行可选的视频时长；Trip Pro 可用 DURATIONS 全部 */
    public static final List<Integer> FREE_DURATIONS = List.of(15, 30);
    public static final List<Integer> PRO_DURATIONS = DURATIONS;
    public static final String FREE_QUALITY = "720p";
    public static final String PRO_QUALITY = "1080p";
    private static final List<String> SUPPORTED_RATIOS = List.of("9:16");
    private static final List<String> COMING_SOON_RATIOS = List.of("4:5", "16:9");
    private static final List<String> QUALITIES = List.of("720p", "1080p");

    private final VideoProjectMapper mapper;
    private final VideoProjectPhotoMapper projectPhotos;
    private final PhotoMapper photos;
    private final TripService trips;
    private final VideoCatalogMapper catalog;
    private final StoryboardService storyboards;
    private final ObjectMapper json;

    public VideoService(VideoProjectMapper mapper, VideoProjectPhotoMapper projectPhotos, PhotoMapper photos, TripService trips,
                        VideoCatalogMapper catalog, StoryboardService storyboards, ObjectMapper json) {
        this.mapper = mapper;
        this.projectPhotos = projectPhotos;
        this.photos = photos;
        this.trips = trips;
        this.catalog = catalog;
        this.storyboards = storyboards;
        this.json = json;
    }

    /** 校验通过后的完整参数。 */
    private record Resolved(VideoTemplateEntity template, VideoMusicEntity music, String ratio, int duration, String quality,
                            Long coverPhotoId, Settings settings, List<Long> photoIds) {}

    // ───────────── 目录 ─────────────

    public List<VideoTemplateView> templates() {
        return catalog.templates().stream().filter(t -> Boolean.TRUE.equals(t.enabled))
                .map(t -> new VideoTemplateView(t.code, t.name, t.englishName, t.description, t.suitableFor, t.pace,
                        t.transition, t.transitionSeconds.doubleValue(), t.plan, t.recommendedMusic))
                .toList();
    }

    public List<VideoMusicView> music() {
        return catalog.music().stream().filter(m -> Boolean.TRUE.equals(m.enabled))
                .map(m -> new VideoMusicView(m.code, m.name, m.category, m.mood,
                        m.durationSeconds == null ? null : m.durationSeconds.doubleValue(), m.plan, m.recommendedTemplate))
                .toList();
    }

    // ───────────── 项目 ─────────────

    @Transactional
    public VideoProjectView create(Long userId, Long tripId, UpsertVideoProjectRequest r) {
        TripEntity t = trips.requireWritable(userId, tripId);
        Resolved v = validate(t, r);
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
        Resolved v = validate(t, r);
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
        Resolved v = validate(t, r);
        return storyboards.build(userId, t, v.template(), v.duration(), v.quality(), v.ratio(), v.coverPhotoId(), v.settings(), v.photoIds());
    }

    /** 已开始生成的项目返回冻结的分镜；草稿按当前数据现算。 */
    public StoryboardView storyboard(Long userId, Long id) {
        VideoProjectEntity p = requireOwned(userId, id);
        TripEntity t = trips.requireOwned(userId, p.tripId);
        if (p.storyboardJson != null && !"DRAFT".equals(p.status)) {
            return json.readValue(p.storyboardJson, StoryboardView.class);
        }
        Resolved v = validate(t, requestOf(p));
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
        if (projectPhotos.photoIds(id).isEmpty()) {
            throw new BusinessException("VIDEO_PHOTOS_REQUIRED", "照片已被删除或还没有选择照片，请重新选择后再生成");
        }
        // 重新校验：照片可能被删、旅行套餐或模板目录可能已变化
        Resolved v = validate(t, requestOf(p));
        StoryboardView sb = storyboards.build(userId, t, v.template(), v.duration(), v.quality(), v.ratio(), v.coverPhotoId(), v.settings(), v.photoIds());
        if (!StoryboardService.hasPhotoScene(sb)) {
            throw new BusinessException("VIDEO_STORY_EMPTY", "分镜里至少要保留一个照片段落才能生成视频");
        }
        p.storyboardJson = json.writeValueAsString(sb);
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
        p.showText = src.showText;
        p.showMap = src.showMap;
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

    private Resolved validate(TripEntity t, UpsertVideoProjectRequest r) {
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

        String musicCode = r.musicCode() == null ? "NONE" : r.musicCode().trim().toUpperCase(Locale.ROOT);
        VideoMusicEntity music = catalog.musicByCode(musicCode);
        if (music == null) throw new BusinessException("VIDEO_MUSIC_INVALID", "视频音乐不存在");
        if (!Boolean.TRUE.equals(music.enabled)) {
            throw new BusinessException("VIDEO_MUSIC_UNAVAILABLE", "「" + music.name + "」暂时不可用，请换一首音乐");
        }
        if (!pro && "PRO".equals(music.plan)) {
            throw proRequired("PRO_MUSIC_REQUIRED", "「" + music.name + "」是 Trip Pro 音乐，Free 旅行可以使用基础音乐");
        }

        String ratio = r.aspectRatio() == null ? "9:16" : r.aspectRatio().trim();
        if (COMING_SOON_RATIOS.contains(ratio)) {
            throw new BusinessException("VIDEO_RATIO_COMING_SOON", ratio + " 比例即将推出，目前只能生成 9:16 视频");
        }
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

        Settings settings = StoryboardService.normalize(r.settings(), r.showText(), r.showMap(), r.showAchievements());
        if (!StoryboardService.MAP_MODES.contains(settings.mapMode())) {
            throw new BusinessException("VIDEO_MAP_MODE_INVALID", "地图动画只能是关闭、简洁或完整路线");
        }
        if (!pro && "FULL".equals(settings.mapMode())) {
            throw proRequired("PRO_MAP_REQUIRED", "完整旅行路线动画需要 Trip Pro，Free 旅行可以使用简洁地图");
        }

        Long cover = r.coverPhotoId();
        if (cover != null && !ids.contains(cover)) {
            throw new BusinessException("VIDEO_COVER_INVALID", "封面必须是已选择的照片");
        }
        return new Resolved(template, music, ratio, duration, quality, cover, settings, List.copyOf(ids));
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
        p.musicCode = v.music().code;
        Settings s = v.settings();
        p.showText = s.showCheckinText();
        p.showMap = !"OFF".equals(s.mapMode());
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
                p.showText, p.showMap, p.showAchievements, s, projectPhotos.photoIds(p.id));
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
                : StoryboardService.normalize(null, p.showText, p.showMap, p.showAchievements).toDto();
        boolean pro = "PRO".equals(t.planType);
        return new VideoProjectView(p.id, p.tripId, p.name, p.templateCode, p.aspectRatio, p.duration, p.quality,
                StoryboardService.resolution(p.aspectRatio, p.quality), !pro, p.musicCode, p.coverPhotoId,
                Boolean.TRUE.equals(p.showText), Boolean.TRUE.equals(p.showMap), Boolean.TRUE.equals(p.showAchievements),
                settings, p.status, p.progress, p.renderStage, p.renderer, p.outputUrl, p.errorCode, p.errorMessage,
                projectPhotos.photoIds(p.id), p.createdAt, p.updatedAt, p.completedAt);
    }
}
