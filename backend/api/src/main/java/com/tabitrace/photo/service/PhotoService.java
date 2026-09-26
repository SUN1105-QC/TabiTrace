package com.tabitrace.photo.service;

import com.tabitrace.achievement.service.AchievementService;
import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.photo.dto.PhotoDtos.*;
import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.dto.TripDtos.TripView;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class PhotoService {
    /** 免费旅行最多可以保存的照片数（Trip Pro 不限） */
    public static final int FREE_PHOTO_LIMIT=10;
    private final PhotoMapper mapper;private final TripService trips;private final CheckinMapper checkins;private final StorageService storage;private final AchievementService achievements;private final TripMapper tripMapper;
    public PhotoService(PhotoMapper mapper,TripService trips,CheckinMapper checkins,StorageService storage,AchievementService achievements,TripMapper tripMapper){this.tripMapper=tripMapper;this.mapper=mapper;this.trips=trips;this.checkins=checkins;this.storage=storage;this.achievements=achievements;}
    public PresignResponse presign(Long userId,Long tripId,PresignRequest r){TripEntity t=trips.requireWritable(userId,tripId);if("FREE".equals(t.planType)&&mapper.countByTrip(tripId)>=FREE_PHOTO_LIMIT)throw new BusinessException("FREE_PHOTO_LIMIT","免费旅行最多保存 "+FREE_PHOTO_LIMIT+" 张照片，请升级 Trip Pro");long size=r.fileSize()==null?0:r.fileSize();if(size>20*1024*1024L)throw new BusinessException("PHOTO_TOO_LARGE","单张照片不能超过 20MB");if(!r.contentType().startsWith("image/"))throw new BusinessException("INVALID_PHOTO_TYPE","仅支持图片文件");return storage.presign(userId,tripId,r.fileName(),r.contentType(),size);}
    @Transactional public PhotoView register(Long userId,Long tripId,RegisterPhotoRequest r){TripEntity t=trips.requireWritable(userId,tripId);if("FREE".equals(t.planType)&&mapper.countByTrip(tripId)>=FREE_PHOTO_LIMIT)throw new BusinessException("FREE_PHOTO_LIMIT","免费旅行最多保存 "+FREE_PHOTO_LIMIT+" 张照片，请升级 Trip Pro");if(r.checkinId()!=null){var c=checkins.findById(r.checkinId());if(c==null||!tripId.equals(c.tripId))throw new BusinessException("CHECKIN_NOT_FOUND","关联打卡不存在");}String expectedPrefix="users/"+userId+"/trips/"+tripId+"/";if(!r.storageKey().startsWith(expectedPrefix)||r.storageKey().contains(".."))throw new BusinessException("INVALID_STORAGE_KEY","图片存储路径不属于当前旅行");if(!r.mimeType().startsWith("image/"))throw new BusinessException("INVALID_PHOTO_TYPE","仅支持图片文件");if(r.fileSize()!=null&&r.fileSize()>20*1024*1024L)throw new BusinessException("PHOTO_TOO_LARGE","单张照片不能超过 20MB");if(!storage.exists(r.storageKey()))throw new BusinessException("PHOTO_UPLOAD_MISSING","请先完成图片上传");PhotoEntity p=new PhotoEntity();p.userId=userId;p.tripId=tripId;p.checkinId=r.checkinId();p.storageKey=r.storageKey();p.imageUrl=storage.publicUrl(r.storageKey());p.width=r.width();p.height=r.height();p.fileSize=r.fileSize();p.mimeType=r.mimeType();p.featured=Boolean.TRUE.equals(r.featured());p.capturedAt=r.capturedAt()==null?null:r.capturedAt().withOffsetSameInstant(java.time.ZoneOffset.UTC).toLocalDateTime();mapper.insert(p);achievements.evaluate(userId,tripId,"PHOTO_UPLOADED");return view(p);}
    public List<PhotoView> list(Long userId,Long tripId){trips.requireOwned(userId,tripId);return mapper.listByTrip(tripId).stream().map(PhotoService::view).toList();}
    @Transactional public PhotoView update(Long userId,Long id,UpdatePhotoRequest r){PhotoEntity p=requireWritable(userId,id);if(r.checkinId()!=null){var c=checkins.findById(r.checkinId());if(c==null||!p.tripId.equals(c.tripId))throw new BusinessException("CHECKIN_NOT_FOUND","关联打卡不存在");}p.checkinId=r.checkinId();p.capturedAt=r.capturedAt()==null?null:r.capturedAt().withOffsetSameInstant(java.time.ZoneOffset.UTC).toLocalDateTime();mapper.update(p);return view(mapper.findById(id));}
    @Transactional public PhotoView feature(Long userId,Long id,boolean featured){PhotoEntity p=requireWritable(userId,id);mapper.setFeatured(id,featured);p.featured=featured;return view(p);}
    @Transactional public void delete(Long userId,Long id){PhotoEntity p=requireWritable(userId,id);remove(p);achievements.evaluate(userId,p.tripId,"PHOTO_DELETED");}

    /** 删除一张照片并清理引用：Travel Story 的照片列表随外键级联删除，封面引用在这里清空；打卡本身不受影响 */
    private void remove(PhotoEntity p){mapper.delete(p.id);mapper.clearVideoCover(p.id);tripMapper.clearCoverIf(p.tripId,p.imageUrl);}

    /** 设为旅行封面：照片必须属于这段旅行 */
    @Transactional public TripView setCover(Long userId,Long tripId,Long photoId){trips.requireWritable(userId,tripId);PhotoEntity p=mapper.findById(photoId);if(p==null||!tripId.equals(p.tripId))throw new BusinessException("PHOTO_NOT_FOUND","照片不存在",HttpStatus.NOT_FOUND);tripMapper.updateCover(tripId,p.imageUrl);return TripService.view(tripMapper.findById(tripId));}

    /** 批量精选 / 取消精选 / 删除；任何一张不属于该旅行都整体拒绝 */
    @Transactional public BatchPhotoResult batch(Long userId,Long tripId,BatchPhotoRequest r){
        trips.requireWritable(userId,tripId);
        String action=r.action().toUpperCase();
        if(!List.of("FEATURE","UNFEATURE","DELETE").contains(action))throw new BusinessException("INVALID_BATCH_ACTION","不支持的批量操作");
        List<PhotoEntity> list=r.photoIds().stream().distinct().map(mapper::findById).toList();
        if(list.stream().anyMatch(p->p==null||!tripId.equals(p.tripId)))throw new BusinessException("PHOTO_NOT_FOUND","部分照片不存在或不属于这段旅行",HttpStatus.NOT_FOUND);
        for(PhotoEntity p:list){if("DELETE".equals(action))remove(p);else mapper.setFeatured(p.id,"FEATURE".equals(action));}
        if("DELETE".equals(action))achievements.evaluate(userId,tripId,"PHOTO_DELETED");
        return new BatchPhotoResult(action,list.size());
    }
    private PhotoEntity requireWritable(Long userId,Long id){PhotoEntity p=mapper.findById(id);if(p==null)throw new BusinessException("PHOTO_NOT_FOUND","照片不存在",HttpStatus.NOT_FOUND);trips.requireWritable(userId,p.tripId);return p;}
    public static PhotoView view(PhotoEntity p){return new PhotoView(p.id,p.tripId,p.checkinId,p.storageKey,p.imageUrl,p.width,p.height,p.fileSize,p.mimeType,Boolean.TRUE.equals(p.featured),p.capturedAt==null?null:p.capturedAt.atOffset(java.time.ZoneOffset.UTC),p.createdAt==null?null:p.createdAt.atOffset(java.time.ZoneOffset.UTC));}
}
