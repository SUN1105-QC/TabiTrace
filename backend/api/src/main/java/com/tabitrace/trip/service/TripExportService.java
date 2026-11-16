package com.tabitrace.trip.service;

import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.itinerary.mapper.ItineraryMapper;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.video.mapper.VideoProjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class TripExportService {
    private final TripService trips;
    private final TripMapper tripMapper;
    private final PhotoMapper photos;
    private final CheckinMapper checkins;
    private final ItineraryMapper itinerary;
    private final PlaceMapper places;
    private final VideoProjectMapper videos;
    private final StorageService storage;
    private final ObjectMapper json;

    public TripExportService(TripService trips, TripMapper tripMapper, PhotoMapper photos, CheckinMapper checkins,
                             ItineraryMapper itinerary, PlaceMapper places, VideoProjectMapper videos,
                             StorageService storage, ObjectMapper json) {
        this.trips = trips;
        this.tripMapper = tripMapper;
        this.photos = photos;
        this.checkins = checkins;
        this.itinerary = itinerary;
        this.places = places;
        this.videos = videos;
        this.storage = storage;
        this.json = json;
    }

    /** Hold the account lock for the download so expiry cannot remove photos during export. */
    @Transactional
    public void write(Long userId, Long tripId, OutputStream output) throws IOException {
        tripMapper.lockPolicy(userId);
        trips.requireOwned(userId, tripId);
        var photoRows = photos.listByTrip(tripId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("trip", trips.get(userId, tripId));
        data.put("checkins", checkins.listByTrip(tripId));
        data.put("itinerary", itinerary.listByTrip(tripId));
        data.put("places", places.findByTrip(tripId));
        data.put("photos", photoRows);
        data.put("videos", videos.listByTrip(tripId));
        List<String> missing = new ArrayList<>();
        try (var zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
            entry(zip, "trip.json", json.writeValueAsBytes(data));
            entry(zip, "README.txt", """
                    TabiTrace 旅程备份
                    trip.json 包含旅程、打卡、行程、地点、照片信息和视频信息。
                    photos/ 包含原始照片；请检查 export-report.json 中是否有未能读取的文件。
                    视频文件请在到期前从旅行视频页面另行下载，JSON 中的在线地址到期后不再可用。
                    """.getBytes(StandardCharsets.UTF_8));
            for (var p : photoRows) {
                byte[] bytes;
                try {
                    bytes = storage.read(p.storageKey);
                } catch (RuntimeException ex) {
                    missing.add("photo-" + p.id);
                    continue;
                }
                entry(zip, "photos/" + p.id + "." + StorageService.extensionFor(p.mimeType), bytes);
            }
            entry(zip, "export-report.json", json.writeValueAsBytes(Map.of("totalPhotos", photoRows.size(),
                    "savedPhotos", photoRows.size() - missing.size(), "missingFiles", missing)));
        }
    }

    private static void entry(ZipOutputStream zip, String name, byte[] data) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(data);
        zip.closeEntry();
    }
}
