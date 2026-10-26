package com.tabitrace.checkin.service;

import com.tabitrace.checkin.dto.CheckinDtos.*;
import com.tabitrace.checkin.entity.CheckinEntity;
import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.geo.dto.GeoDtos.WeatherSnapshot;
import com.tabitrace.geo.service.WeatherService;
import com.tabitrace.photo.dto.PhotoDtos.PhotoView;
import com.tabitrace.photo.dto.PhotoDtos.RegisterPhotoRequest;
import com.tabitrace.photo.service.PhotoService;
import com.tabitrace.trip.service.TripService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * 快速打卡：拍照优先、自动信息、一步保存。
 * 1. 照片由前端先上传到存储（presign + PUT，复用 Storage Adapter）；上传失败时前端不会调用这里，什么都不会创建
 * 2. 天气在事务外获取（外部请求不占用数据库连接）；拿不到就不写，不影响保存
 * 3. 打卡、天气快照、照片元数据在同一个事务里写入：任何一步失败（例如照片未真正上传、超出 Free 限额）整体回滚，
 *    不会出现「照片没保存，却生成了一条完整打卡」的状态
 * 没有地点信息时记为「随手记录」—— 这是记录类型，不是猜测出来的地点。
 */
@Service
public class QuickCheckinService {
    public static final String UNKNOWN_PLACE = "随手记录";

    private final CheckinService checkins; private final CheckinMapper mapper; private final PhotoService photos;
    private final WeatherService weather; private final TripService trips; private final TransactionTemplate tx;

    public QuickCheckinService(CheckinService checkins, CheckinMapper mapper, PhotoService photos, WeatherService weather, TripService trips, PlatformTransactionManager txManager) {
        this.checkins = checkins; this.mapper = mapper; this.photos = photos; this.weather = weather; this.trips = trips;
        this.tx = new TransactionTemplate(txManager);
    }

    public QuickCheckinResult create(Long userId, Long tripId, QuickCheckinRequest r) {
        trips.requireWritable(userId, tripId);
        CreateCheckinRequest c = r.checkin();
        boolean hasName = c.placeId() != null || (c.placeName() != null && !c.placeName().isBlank());
        CreateCheckinRequest req = hasName ? c : new CreateCheckinRequest(c.placeId(), c.itineraryItemId(), c.checkinTime(), c.latitude(), c.longitude(),
            UNKNOWN_PLACE, c.area(), c.note(), c.timezone(), c.accuracyM());
        WeatherSnapshot w = Boolean.TRUE.equals(r.captureWeather()) ? weather.at(c.latitude(), c.longitude(), c.checkinTime().toInstant()) : null;

        return tx.execute(status -> {
            CheckinView created = checkins.create(userId, tripId, req);
            if (w != null) {
                CheckinEntity e = new CheckinEntity();
                e.id = created.id();
                e.weatherCode = w.code();
                e.weatherText = w.text();
                e.temperatureC = w.temperatureC();
                e.weatherObservedAt = w.observedAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
                e.weatherSource = w.source();
                mapper.updateWeather(e);
            }
            List<PhotoView> saved = new ArrayList<>();
            for (RegisterPhotoRequest p : r.photos() == null ? List.<RegisterPhotoRequest>of() : r.photos()) {
                // 随手拍默认不设为精选：精选仍由用户在照片页自己决定（分享成果 / Travel Story 只用精选）
                saved.add(photos.register(userId, tripId, new RegisterPhotoRequest(created.id(), p.storageKey(), null, p.width(), p.height(), p.fileSize(), p.mimeType(),
                    Boolean.TRUE.equals(p.featured()), p.capturedAt() != null ? p.capturedAt() : c.checkinTime(), p.thumbKey(), p.mediumKey())));
            }
            return new QuickCheckinResult(checkins.get(userId, created.id()), saved);
        });
    }
}
