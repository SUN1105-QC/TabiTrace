package com.tabitrace.video.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.video.dto.VideoDtos.*;
import com.tabitrace.video.entity.VideoProjectEntity;
import com.tabitrace.video.mapper.VideoProjectMapper;
import com.tabitrace.video.mapper.VideoProjectPhotoMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class VideoService {
    private final VideoProjectMapper mapper;private final VideoProjectPhotoMapper projectPhotos;private final PhotoMapper photos;private final TripService trips;
    public VideoService(VideoProjectMapper mapper,VideoProjectPhotoMapper projectPhotos,PhotoMapper photos,TripService trips){this.mapper=mapper;this.projectPhotos=projectPhotos;this.photos=photos;this.trips=trips;}
    @Transactional public VideoProjectView create(Long userId,Long tripId,UpsertVideoProjectRequest r){TripEntity t=trips.requireWritable(userId,tripId);validate(t,r);VideoProjectEntity p=new VideoProjectEntity();p.userId=userId;p.tripId=tripId;apply(p,r);p.status="DRAFT";p.progress=0;mapper.insert(p);replacePhotos(p.id,tripId,r.photoIds());return view(p);}
    public List<VideoProjectView> list(Long userId,Long tripId){trips.requireOwned(userId,tripId);return mapper.listByTrip(tripId).stream().map(this::view).toList();}
    public VideoProjectView get(Long userId,Long id){return view(requireOwned(userId,id));}
    @Transactional public VideoProjectView update(Long userId,Long id,UpsertVideoProjectRequest r){VideoProjectEntity p=requireOwned(userId,id);if(!"DRAFT".equals(p.status))throw new BusinessException("VIDEO_NOT_EDITABLE","只有草稿视频可以修改");TripEntity t=trips.requireWritable(userId,p.tripId);validate(t,r);apply(p,r);mapper.updateDraft(p);replacePhotos(p.id,p.tripId,r.photoIds());return view(mapper.findById(id));}
    @Transactional public VideoProjectView render(Long userId,Long id){VideoProjectEntity p=requireOwned(userId,id);trips.requireWritable(userId,p.tripId);if(!List.of("DRAFT","FAILED").contains(p.status))throw new BusinessException("VIDEO_ALREADY_RENDERING","当前视频状态不能重新生成");if(projectPhotos.photoIds(id).isEmpty())throw new BusinessException("VIDEO_PHOTOS_REQUIRED","请至少选择一张照片");p.status="QUEUED";p.progress=0;p.errorMessage=null;p.outputUrl=null;p.outputKey=null;p.completedAt=null;mapper.updateStatus(p);return view(p);}
    @Transactional public void delete(Long userId,Long id){VideoProjectEntity p=requireOwned(userId,id);trips.requireWritable(userId,p.tripId);if("PROCESSING".equals(p.status))throw new BusinessException("VIDEO_PROCESSING","正在生成的视频不能删除");mapper.delete(id);}
    private VideoProjectEntity requireOwned(Long userId,Long id){VideoProjectEntity p=mapper.findById(id);if(p==null)throw new BusinessException("VIDEO_PROJECT_NOT_FOUND","视频项目不存在",HttpStatus.NOT_FOUND);if(!userId.equals(p.userId))throw new BusinessException("VIDEO_FORBIDDEN","不能访问其他用户的视频项目",HttpStatus.FORBIDDEN);return p;}
    private void replacePhotos(Long projectId,Long tripId,List<Long> ids){projectPhotos.deleteByProject(projectId);int sort=1;for(Long id:ids){PhotoEntity ph=photos.findById(id);if(ph==null||!tripId.equals(ph.tripId))throw new BusinessException("VIDEO_PHOTO_INVALID","视频照片不属于当前旅行");projectPhotos.add(projectId,id,sort++,null);}}
    private void validate(TripEntity t,UpsertVideoProjectRequest r){String template=r.templateCode().toUpperCase();if(!List.of("JOURNAL","MINIMAL","CITY").contains(template))throw new BusinessException("VIDEO_TEMPLATE_INVALID","视频模板不正确");if("FREE".equals(t.planType)&&"CITY".equals(template))throw new BusinessException("PRO_TEMPLATE_REQUIRED","City 模板需要 Trip Pro");if(r.photoIds()==null||r.photoIds().isEmpty())throw new BusinessException("VIDEO_PHOTOS_REQUIRED","请至少选择一张照片");if(new java.util.HashSet<>(r.photoIds()).size()!=r.photoIds().size())throw new BusinessException("VIDEO_PHOTO_DUPLICATED","视频照片不能重复选择");int max="PRO".equals(t.planType)?30:10;if(r.photoIds().size()>max)throw new BusinessException("VIDEO_PHOTO_LIMIT","当前套餐最多可选择 "+max+" 张照片");String music=r.musicCode()==null?"NONE":r.musicCode().toUpperCase();if(!List.of("NONE","WARM_JOURNEY","TOKYO_NIGHT","SLOW_MORNING","CITY_WALK","MEMORIES").contains(music))throw new BusinessException("VIDEO_MUSIC_INVALID","视频音乐选项不正确");String ratio=r.aspectRatio()==null?"9:16":r.aspectRatio();if(!"9:16".equals(ratio))throw new BusinessException("VIDEO_RATIO_UNSUPPORTED","MVP 仅支持 9:16 视频");int duration=r.duration()==null?30:r.duration();if(duration!=30)throw new BusinessException("VIDEO_DURATION_UNSUPPORTED","MVP 仅支持 30 秒视频");}
    private static void apply(VideoProjectEntity p,UpsertVideoProjectRequest r){p.templateCode=r.templateCode().toUpperCase();p.aspectRatio=r.aspectRatio()==null?"9:16":r.aspectRatio();p.duration=r.duration()==null?30:r.duration();p.musicCode=r.musicCode()==null?"NONE":r.musicCode().toUpperCase();p.showText=r.showText()==null||r.showText();p.showMap=r.showMap()==null||r.showMap();p.showAchievements=r.showAchievements()==null||r.showAchievements();}
    private VideoProjectView view(VideoProjectEntity p){return new VideoProjectView(p.id,p.tripId,p.templateCode,p.aspectRatio,p.duration,p.musicCode,Boolean.TRUE.equals(p.showText),Boolean.TRUE.equals(p.showMap),Boolean.TRUE.equals(p.showAchievements),p.status,p.progress,p.outputUrl,p.errorMessage,projectPhotos.photoIds(p.id),p.createdAt,p.completedAt);}
}
