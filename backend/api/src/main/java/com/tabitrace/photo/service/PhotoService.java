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
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class PhotoService {
    /** 免费旅行最多可以保存的照片数（Trip Pro 不限） */
    public static final int FREE_PHOTO_LIMIT=10;
    /** 与前端 PHOTO_MAX_BYTES 一致；预签名 URL 会签入声明的大小，对象存储拒绝不一致的上传 */
    public static final long PHOTO_MAX_BYTES=20*1024*1024L;
    /** 浏览器生成的尺寸版本：缩略图（列表网格）与中图（详情、封面） */
    public static final long THUMB_MAX_BYTES=1024*1024L, MEDIUM_MAX_BYTES=5*1024*1024L;
    /** 照片墙每页数量（与前端网格列数 2 / 3 / 4 / 5 / 6 都能整除的 60 以内取 48 作为上限，默认 40） */
    public static final int PAGE_SIZE=40, MAX_PAGE_SIZE=60;
    private final PhotoMapper mapper;private final TripService trips;private final CheckinMapper checkins;private final StorageService storage;private final AchievementService achievements;private final TripMapper tripMapper;
    private final UserMapper users;
    @Autowired public PhotoService(PhotoMapper mapper,TripService trips,CheckinMapper checkins,StorageService storage,AchievementService achievements,TripMapper tripMapper,UserMapper users){this.tripMapper=tripMapper;this.mapper=mapper;this.trips=trips;this.checkins=checkins;this.storage=storage;this.achievements=achievements;this.users=users;}
    public PhotoService(PhotoMapper mapper,TripService trips,CheckinMapper checkins,StorageService storage,AchievementService achievements,TripMapper tripMapper){this(mapper,trips,checkins,storage,achievements,tripMapper,null);}
    public PresignResponse presign(Long userId,Long tripId,PresignRequest r){if(r.variant()!=null&&!r.variant().isBlank())return presignVariant(userId,tripId,r);TripEntity t=trips.requireWritable(userId,tripId);if("FREE".equals(t.planType)&&mapper.countByTrip(tripId)>=FREE_PHOTO_LIMIT)throw new BusinessException("FREE_PHOTO_LIMIT","免费旅行最多保存 "+FREE_PHOTO_LIMIT+" 张照片，请升级 Trip Pro");long size=r.fileSize()==null?0:r.fileSize();if(size<=0)throw new BusinessException("INVALID_PHOTO_SIZE","缺少图片大小");if(size>PHOTO_MAX_BYTES)throw new BusinessException("PHOTO_TOO_LARGE","单张照片不能超过 20MB");if(!StorageService.IMAGE_TYPES.contains(r.contentType().trim().toLowerCase()))throw new BusinessException("INVALID_PHOTO_TYPE","仅支持 JPG、PNG、WebP、GIF、HEIC 图片");return storage.presign(userId,tripId,r.fileName(),r.contentType(),size);}
    @Transactional public PhotoView register(Long userId,Long tripId,RegisterPhotoRequest r){TripEntity t=trips.requireWritable(userId,tripId);if("FREE".equals(t.planType)&&mapper.countByTrip(tripId)>=FREE_PHOTO_LIMIT)throw new BusinessException("FREE_PHOTO_LIMIT","免费旅行最多保存 "+FREE_PHOTO_LIMIT+" 张照片，请升级 Trip Pro");if(r.checkinId()!=null){var c=checkins.findById(r.checkinId());if(c==null||!tripId.equals(c.tripId))throw new BusinessException("CHECKIN_NOT_FOUND","关联打卡不存在");}String expectedPrefix="users/"+userId+"/trips/"+tripId+"/";if(!r.storageKey().startsWith(expectedPrefix)||r.storageKey().contains(".."))throw new BusinessException("INVALID_STORAGE_KEY","图片存储路径不属于当前旅行");if(!StorageService.IMAGE_TYPES.contains(r.mimeType().trim().toLowerCase()))throw new BusinessException("INVALID_PHOTO_TYPE","仅支持 JPG、PNG、WebP、GIF、HEIC 图片");if(r.fileSize()!=null&&r.fileSize()>PHOTO_MAX_BYTES)throw new BusinessException("PHOTO_TOO_LARGE","单张照片不能超过 20MB");if(!storage.exists(r.storageKey()))throw new BusinessException("PHOTO_UPLOAD_MISSING","请先完成图片上传");PhotoEntity p=new PhotoEntity();p.userId=userId;p.tripId=tripId;p.checkinId=r.checkinId();p.storageKey=r.storageKey();p.imageUrl=storage.publicUrl(r.storageKey());p.thumbKey=variant(r.storageKey(),r.thumbKey(),"thumb");p.thumbUrl=p.thumbKey==null?null:storage.publicUrl(p.thumbKey);p.mediumKey=variant(r.storageKey(),r.mediumKey(),"medium");p.mediumUrl=p.mediumKey==null?null:storage.publicUrl(p.mediumKey);p.width=r.width();p.height=r.height();p.fileSize=r.fileSize();p.mimeType=r.mimeType();p.featured=Boolean.TRUE.equals(r.featured());p.capturedAt=r.capturedAt()==null?null:r.capturedAt().withOffsetSameInstant(java.time.ZoneOffset.UTC).toLocalDateTime();mapper.insert(p);achievements.evaluate(userId,tripId,"PHOTO_UPLOADED");return view(p);}
    public List<PhotoView> list(Long userId,Long tripId){trips.requireOwned(userId,tripId);return mapper.listByTrip(tripId).stream().map(PhotoService::view).toList();}
    @Transactional public PhotoView update(Long userId,Long id,UpdatePhotoRequest r){PhotoEntity p=requireWritable(userId,id);if(r.checkinId()!=null){var c=checkins.findById(r.checkinId());if(c==null||!p.tripId.equals(c.tripId))throw new BusinessException("CHECKIN_NOT_FOUND","关联打卡不存在");}p.checkinId=r.checkinId();p.capturedAt=r.capturedAt()==null?null:r.capturedAt().withOffsetSameInstant(java.time.ZoneOffset.UTC).toLocalDateTime();mapper.update(p);return view(mapper.findById(id));}
    @Transactional public PhotoView feature(Long userId,Long id,boolean featured){PhotoEntity p=requireWritable(userId,id);mapper.setFeatured(id,featured);p.featured=featured;return view(p);}
    @Transactional public void delete(Long userId,Long id){PhotoEntity p=requireWritable(userId,id);remove(p);achievements.evaluate(userId,p.tripId,"PHOTO_DELETED");}

    /** 删除一张照片并清理引用：Travel Story 的照片列表随外键级联删除，封面引用在这里清空；打卡本身不受影响 */
    /** 先删对象存储里的文件：删不掉就整体失败（事务回滚），不会出现“记录没了但公开地址还能访问”的情况 */
    private void remove(PhotoEntity p){storage.deleteAll(keys(p));mapper.delete(p.id);mapper.clearVideoCover(p.id);tripMapper.clearCoverIf(p.tripId,p.imageUrl);if(p.mediumUrl!=null)tripMapper.clearCoverIf(p.tripId,p.mediumUrl);}
    static List<String> keys(PhotoEntity p){List<String> k=new ArrayList<>();k.add(p.storageKey);if(p.thumbKey!=null)k.add(p.thumbKey);if(p.mediumKey!=null)k.add(p.mediumKey);return k;}

    /** 设为旅行封面：照片必须属于这段旅行 */
    @Transactional public TripView setCover(Long userId,Long tripId,Long photoId){trips.requireWritable(userId,tripId);PhotoEntity p=mapper.findById(photoId);if(p==null||!tripId.equals(p.tripId))throw new BusinessException("PHOTO_NOT_FOUND","照片不存在",HttpStatus.NOT_FOUND);tripMapper.updateCover(tripId,p.mediumUrl!=null?p.mediumUrl:p.imageUrl);return TripService.view(tripMapper.findById(tripId));}

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
    public static PhotoView view(PhotoEntity p){return new PhotoView(p.id,p.tripId,p.checkinId,p.storageKey,p.imageUrl,p.width,p.height,p.fileSize,p.mimeType,Boolean.TRUE.equals(p.featured),p.capturedAt==null?null:p.capturedAt.atOffset(java.time.ZoneOffset.UTC),p.createdAt==null?null:p.createdAt.atOffset(java.time.ZoneOffset.UTC),p.thumbUrl,p.mediumUrl);}

    /** 尺寸版本的上传地址：路径由原图路径派生（同一目录、同名加 -thumb / -medium），只接受 JPEG / WebP */
    private PresignResponse presignVariant(Long userId,Long tripId,PresignRequest r){
        trips.requireWritable(userId,tripId);
        String v=r.variant().trim().toLowerCase();
        long max=switch(v){case "thumb" -> THUMB_MAX_BYTES; case "medium" -> MEDIUM_MAX_BYTES; default -> throw new BusinessException("INVALID_PHOTO_VARIANT","不支持的照片尺寸");};
        String of=r.variantOf();
        if(of==null||!of.startsWith("users/"+userId+"/trips/"+tripId+"/")||of.contains("..")||of.contains("-thumb.")||of.contains("-medium."))throw new BusinessException("INVALID_STORAGE_KEY","图片存储路径不属于当前旅行");
        String type=r.contentType().trim().toLowerCase();
        if(!type.equals("image/jpeg")&&!type.equals("image/webp"))throw new BusinessException("INVALID_PHOTO_TYPE","缩略图只支持 JPEG / WebP");
        long size=r.fileSize()==null?0:r.fileSize();
        if(size<=0)throw new BusinessException("INVALID_PHOTO_SIZE","缺少图片大小");
        if(size>max)throw new BusinessException("PHOTO_TOO_LARGE","缩略图过大");
        return storage.presignKey(variantKey(of,v,type),type,size);
    }

    static String variantKey(String original,String variant,String contentType){
        int slash=original.lastIndexOf('/'),dot=original.lastIndexOf('.');
        String stem=dot>slash?original.substring(0,dot):original;
        return stem+"-"+variant+"."+StorageService.extensionFor(contentType);
    }

    /** 登记时校验尺寸版本：必须是由这张原图派生的路径，并且已经上传；没有提供时返回 null（前端回退原图） */
    private String variant(String original,String key,String variant){
        if(key==null||key.isBlank())return null;
        boolean derived=key.equals(variantKey(original,variant,"image/jpeg"))||key.equals(variantKey(original,variant,"image/webp"));
        if(!derived)throw new BusinessException("INVALID_STORAGE_KEY","缩略图路径与原图不匹配");
        if(!storage.exists(key))throw new BusinessException("PHOTO_UPLOAD_MISSING","请先完成缩略图上传");
        return key;
    }

    /**
     * 照片墙游标分页：filter = ALL / FEATURED / LINKED / UNLINKED，sort = NEWEST / OLDEST。
     * 排序与前端 utils/gallery 相同；游标为 “排序时间（微秒）或 n” + “_” + 照片 id。
     */
    public PhotoPage page(Long userId,Long tripId,String filter,String sort,String cursor,Integer limit){
        TripEntity t=trips.requireOwned(userId,tripId);
        String f=filter==null||filter.isBlank()?"ALL":filter.trim().toUpperCase();
        if(!List.of("ALL","FEATURED","LINKED","UNLINKED").contains(f))throw new BusinessException("INVALID_PHOTO_FILTER","不支持的筛选条件");
        boolean desc=!"OLDEST".equalsIgnoreCase(sort);
        int n=limit==null?PAGE_SIZE:Math.max(1,Math.min(MAX_PAGE_SIZE,limit));
        ZoneId zone=zone(userId);
        LocalDateTime winStart=t.startDate==null?LocalDateTime.of(1970,1,1,0,0):t.startDate.atStartOfDay(zone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        LocalDateTime winEnd=t.endDate==null?LocalDateTime.of(9999,1,1,0,0):t.endDate.plusDays(1).atStartOfDay(zone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        LocalDateTime cursorAt=null; Long cursorId=null;
        if(cursor!=null&&!cursor.isBlank()){
            try{
                int us=cursor.indexOf('_');
                String at=cursor.substring(0,us);
                cursorId=Long.parseLong(cursor.substring(us+1));
                if(!"n".equals(at)){long micros=Long.parseLong(at);cursorAt=LocalDateTime.ofEpochSecond(Math.floorDiv(micros,1_000_000L),(int)Math.floorMod(micros,1_000_000L)*1000,ZoneOffset.UTC);}
            }catch(RuntimeException ex){throw new BusinessException("INVALID_CURSOR","分页参数无效，请刷新页面");}
        }
        List<PhotoEntity> rows=mapper.page(tripId,f,desc,winStart,winEnd,cursorAt,cursorId,n+1);
        boolean more=rows.size()>n;
        if(more)rows=rows.subList(0,n);
        String next=null;
        if(more){PhotoEntity last=rows.get(rows.size()-1);next=(last.sortAt==null?"n":String.valueOf(last.sortAt.toEpochSecond(ZoneOffset.UTC)*1_000_000L+last.sortAt.getNano()/1000))+"_"+last.id;}
        Map<String,Object> c=mapper.counts(tripId);
        int total=((Number)c.get("total")).intValue(),linked=((Number)c.get("linked")).intValue();
        return new PhotoPage(rows.stream().map(PhotoService::view).toList(),next,new PhotoCounts(total,((Number)c.get("featured")).intValue(),linked,total-linked));
    }

    private ZoneId zone(Long userId){
        if(users==null)return ZoneOffset.UTC;
        var u=users.findById(userId);
        try{return ZoneId.of(u==null||u.timezone==null?"UTC":u.timezone);}catch(Exception ex){return ZoneOffset.UTC;}
    }
}
