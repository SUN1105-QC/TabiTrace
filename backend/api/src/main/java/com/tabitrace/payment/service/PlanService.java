package com.tabitrace.payment.service;

import com.tabitrace.checkin.service.CheckinService;
import com.tabitrace.photo.service.PhotoService;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.video.mapper.VideoCatalogMapper;
import com.tabitrace.video.service.VideoService;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Trip Pro 的方案配置：价格、计费方式、Free 限制与 Travel Story 的 Free / Pro 差异。
 * 所有数值都直接引用业务代码里真正执行的常量与视频目录，升级页面只读这里，不在前端另写一份。
 */
@Service
public class PlanService {
    public record Price(int amount, String currency) {}
    /** Free 旅行的限制；Trip Pro 旅行没有打卡与照片数量上限 */
    public record FreeLimits(int activeFreeTrips, int checkinsPerTrip, int photosPerTrip) {}
    public record StoryTier(int maxPhotos, List<Integer> durations, String quality, boolean watermark) {}
    public record CatalogItem(String name, String plan) {}
    public record TripProPlan(Price price, String billing, boolean renews, boolean expires, boolean realPayments,
                              FreeLimits freeLimits, StoryTier storyFree, StoryTier storyPro,
                              List<CatalogItem> storyTemplates, List<CatalogItem> storyMusic) {}

    private final VideoCatalogMapper catalog;
    private final PaymentService payments;
    public PlanService(VideoCatalogMapper catalog, PaymentService payments) { this.catalog = catalog; this.payments = payments; }

    public TripProPlan tripPro() {
        return new TripProPlan(
                new Price(PaymentService.TRIP_PRO_AMOUNT, PaymentService.TRIP_PRO_CURRENCY),
                // 一次性付款（Stripe mode=payment），升级后该旅行的 plan_type 永久为 PRO，没有续费与到期
                "ONE_TIME_PER_TRIP", false, false, payments.realPayments(),
                new FreeLimits(TripService.FREE_ACTIVE_TRIP_LIMIT, CheckinService.FREE_CHECKIN_LIMIT, PhotoService.FREE_PHOTO_LIMIT),
                new StoryTier(VideoService.FREE_MAX_PHOTOS, VideoService.FREE_DURATIONS, VideoService.FREE_QUALITY, true),
                new StoryTier(VideoService.PRO_MAX_PHOTOS, VideoService.PRO_DURATIONS, VideoService.PRO_QUALITY, false),
                catalog.templates().stream().filter(t -> Boolean.TRUE.equals(t.enabled)).map(t -> new CatalogItem(t.name, t.plan)).toList(),
                catalog.music().stream().filter(m -> Boolean.TRUE.equals(m.enabled) && !"NONE".equals(m.code)).map(m -> new CatalogItem(m.name, m.plan)).toList());
    }
}
