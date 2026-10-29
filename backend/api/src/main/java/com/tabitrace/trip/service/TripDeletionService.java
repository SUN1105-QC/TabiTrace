package com.tabitrace.trip.service;

import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.video.mapper.VideoProjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 删除旅行：数据库里的打卡、照片等记录由外键级联删除；对象存储里的照片文件要单独删掉，
 * 否则“已删除”的照片仍能通过公开地址访问。文件删除失败时整个删除失败（事务回滚），可以重试。
 */
@Service
public class TripDeletionService {
    private final TripService trips;
    private final PhotoMapper photos;
    private final StorageService storage;
    private final TripMapper tripMapper;
    private final VideoProjectMapper videos;

    public TripDeletionService(TripService trips, PhotoMapper photos, StorageService storage, TripMapper tripMapper, VideoProjectMapper videos) {
        this.trips = trips; this.photos = photos; this.storage = storage;
        this.tripMapper = tripMapper; this.videos = videos;
    }

    @Transactional
    public void delete(Long userId, Long tripId) {
        trips.requireOwned(userId, tripId);
        // Parent lock also blocks new projects from being inserted while we capture all outputs.
        if (!userId.equals(tripMapper.lockOwner(tripId)))
            throw new com.tabitrace.common.BusinessException("TRIP_NOT_FOUND", "旅行不存在", org.springframework.http.HttpStatus.NOT_FOUND);
        for (var video : videos.lockByTrip(tripId)) videos.enqueueOutputDeletion(video);
        // 原图与缩略图 / 中图一起删除
        storage.deleteAll(photos.listByTrip(tripId).stream().flatMap((PhotoEntity p) -> java.util.stream.Stream.of(p.storageKey, p.thumbKey, p.mediumKey)).filter(java.util.Objects::nonNull).toList());
        trips.delete(userId, tripId);
    }
}
