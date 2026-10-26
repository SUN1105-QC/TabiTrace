package com.tabitrace.payment.service;

import com.tabitrace.checkin.service.CheckinService;
import com.tabitrace.photo.service.PhotoService;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.video.mapper.VideoCatalogMapper;
import com.tabitrace.video.service.VideoService;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Trip Pro 的方案配置：价格、计费方式、Free 限制，以及 Travel Story 与分享图的 Free / Pro 差异。
 * 所有数值都直接引用业务代码里真正执行的常量与视频目录，升级页面只读这里，不在前端另写一份。
 */
@Service
public class PlanService {
    public record Price(int amount, String currency) {}
    /** Free 旅行的限制；Trip Pro 旅行没有打卡与照片数量上限 */
    public record FreeLimits(int activeFreeTrips, int checkinsPerTrip, int photosPerTrip) {}
    public record StoryTier(int maxPhotos, List<Integer> durations, String quality, boolean watermark) {}
    /**
     * 分享图（城市海报 / 九宫格 / 每日长图）的导出规格。分享图在浏览器里生成，前端按这里的数值导出：
     * quality：STANDARD / HD；posterWidth：城市海报导出宽度；scale：九宫格 / 长图整张导出的倍率；tileSize：九宫格分别导出时每张的边长；
     * watermark：是否在导出的每张图片右下角加「旅迹 TabiTrace」水印（Pro 同时去掉成品里的品牌署名）
     */
    public record ShareTier(String quality, int posterWidth, int scale, int tileSize, boolean watermark) {}
    public static final ShareTier SHARE_FREE = new ShareTier("STANDARD", 1080, 1, 720, true);
    public static final ShareTier SHARE_PRO = new ShareTier("HD", 1440, 2, 1080, false);
    public record CatalogItem(String name, String plan) {}
    /** 买断 · 终身 Pro：一次付款，账号下现有与以后新建的所有旅行都是 PRO */
    public record LifetimePlan(Price price, String billing, boolean paymentsAvailable, String unavailableReason) {}
    /** paymentsAvailable：单次旅行升级能否付款；unavailableReason：NOT_CONFIGURED（支付未开放）/ BELOW_MINIMUM（金额低于 Stripe 最低额，需要国内支付渠道） */
    public record TripProPlan(Price price, String billing, boolean renews, boolean expires, boolean realPayments, boolean paymentsAvailable,
                              String unavailableReason, LifetimePlan lifetime,
                              FreeLimits freeLimits, StoryTier storyFree, StoryTier storyPro, ShareTier shareFree, ShareTier sharePro,
                              List<CatalogItem> storyTemplates, List<CatalogItem> storyMusic) {}

    private final VideoCatalogMapper catalog;
    private final PaymentService payments;
    public PlanService(VideoCatalogMapper catalog, PaymentService payments) { this.catalog = catalog; this.payments = payments; }

    public TripProPlan tripPro() {
        return new TripProPlan(
                new Price(PaymentService.TRIP_PRO_AMOUNT, PaymentService.TRIP_PRO_CURRENCY),
                // 一次性付款（Stripe mode=payment），升级后该旅行的 plan_type 永久为 PRO，没有续费与到期
                "ONE_TIME_PER_TRIP", false, false, payments.realPayments(), payments.canCharge(PaymentService.TRIP_PRO_AMOUNT),
                payments.unavailableReason(PaymentService.TRIP_PRO_AMOUNT),
                new LifetimePlan(new Price(PaymentService.LIFETIME_AMOUNT, PaymentService.TRIP_PRO_CURRENCY), "ONE_TIME_LIFETIME",
                        payments.canCharge(PaymentService.LIFETIME_AMOUNT), payments.unavailableReason(PaymentService.LIFETIME_AMOUNT)),
                new FreeLimits(TripService.FREE_ACTIVE_TRIP_LIMIT, CheckinService.FREE_CHECKIN_LIMIT, PhotoService.FREE_PHOTO_LIMIT),
                new StoryTier(VideoService.FREE_MAX_PHOTOS, VideoService.FREE_DURATIONS, VideoService.FREE_QUALITY, true),
                new StoryTier(VideoService.PRO_MAX_PHOTOS, VideoService.PRO_DURATIONS, VideoService.PRO_QUALITY, false),
                SHARE_FREE, SHARE_PRO,
                catalog.templates().stream().filter(t -> Boolean.TRUE.equals(t.enabled)).map(t -> new CatalogItem(t.name, t.plan)).toList(),
                catalog.music().stream().filter(com.tabitrace.video.entity.VideoMusicEntity::usable).map(m -> new CatalogItem(m.name, m.plan)).toList());
    }
}
