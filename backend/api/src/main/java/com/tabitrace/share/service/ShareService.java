package com.tabitrace.share.service;

import com.tabitrace.achievement.service.AchievementService;
import com.tabitrace.checkin.service.CheckinService;
import com.tabitrace.common.BusinessException;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.photo.service.PhotoService;
import com.tabitrace.share.dto.ShareDtos.*;
import com.tabitrace.share.entity.ShareLinkEntity;
import com.tabitrace.share.mapper.ShareLinkMapper;
import com.tabitrace.summary.service.SummaryService;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tabitrace.checkin.dto.CheckinDtos.CheckinView;
import com.tabitrace.checkin.dto.CheckinDtos.TimelineDay;
import com.tabitrace.checkin.dto.CheckinDtos.TimelineItem;
import com.tabitrace.user.entity.UserEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;

@Service
public class ShareService {
    private final ShareLinkMapper mapper;private final TripService trips;private final TripMapper tripMapper;private final SummaryService summaries;private final CheckinService checkins;private final PhotoMapper photos;private final AchievementService achievements;private final UserMapper users;private final String publicUrl;
    public ShareService(ShareLinkMapper mapper,TripService trips,TripMapper tripMapper,SummaryService summaries,CheckinService checkins,PhotoMapper photos,AchievementService achievements,UserMapper users,@Value("${app.public-url:http://localhost:3000}") String publicUrl){this.mapper=mapper;this.trips=trips;this.tripMapper=tripMapper;this.summaries=summaries;this.checkins=checkins;this.photos=photos;this.achievements=achievements;this.users=users;this.publicUrl=publicUrl.replaceAll("/$","");}
    @Transactional public ShareLinkView create(Long userId,Long tripId,CreateShareRequest r){trips.requireOwned(userId,tripId);ShareLinkEntity l=new ShareLinkEntity();l.tripId=tripId;l.shareToken=token();l.expiresAt=r!=null&&r.expiresAt()!=null?r.expiresAt():defaultExpiry(users.findById(userId));mapper.insert(l);tripMapper.updateVisibility(tripId,"UNLISTED");return view(mapper.findById(l.id));}
    public List<ShareLinkView> list(Long userId,Long tripId){trips.requireOwned(userId,tripId);return mapper.listByTrip(tripId).stream().map(this::view).toList();}
    @Transactional public void revoke(Long userId,Long tripId,Long shareId){trips.requireOwned(userId,tripId);ShareLinkEntity l=mapper.findById(shareId);if(l==null||!tripId.equals(l.tripId))throw new BusinessException("SHARE_LINK_NOT_FOUND","分享链接不存在",HttpStatus.NOT_FOUND);mapper.revoke(shareId);if(mapper.countActive(tripId)==0)tripMapper.updateVisibility(tripId,"PRIVATE");}
    @Transactional public PublicShareView publicView(String token){ShareLinkEntity l=mapper.findActiveByToken(token);if(l==null)throw new BusinessException("SHARE_LINK_INVALID","分享链接无效或已失效",HttpStatus.NOT_FOUND);mapper.incrementViews(l.id);TripEntity t=tripMapper.findById(l.tripId);if(t==null)throw new BusinessException("TRIP_NOT_FOUND","旅行不存在",HttpStatus.NOT_FOUND);var featured=photos.listFeatured(t.id).stream().map(PhotoService::view).toList();var owner=users.findById(t.userId);
        var timeline=checkins.timeline(t.userId,t.id);
        // 默认不公开精确坐标：除非本人在隐私设置里开启，否则分享页只拿到约 1 公里精度的位置
        if(owner==null||!Boolean.TRUE.equals(owner.shareExactLocation))timeline=coarsen(timeline);
        return new PublicShareView(TripService.view(t),summaries.get(t.userId,t.id),timeline,featured,achievements.list(t.userId,t.id),owner==null?"旅行者":owner.nickname);}
    /** 用户设置的分享链接默认有效期（0 = 长期有效） */
    static LocalDateTime defaultExpiry(UserEntity owner){
        int days=owner==null||owner.shareLinkExpiryDays==null?0:owner.shareLinkExpiryDays;
        return days>0?LocalDateTime.now(ZoneOffset.UTC).plusDays(days):null;
    }

    /** 坐标保留两位小数（约 1 公里），足够画出路线轮廓，但不暴露住处等精确位置 */
    static List<TimelineDay> coarsen(List<TimelineDay> days){
        return days.stream().map(d->new TimelineDay(d.date(),d.items().stream().map(i->{
            CheckinView c=i.checkin();
            return new TimelineItem(new CheckinView(c.id(),c.tripId(),c.placeId(),c.itineraryItemId(),c.checkinType(),c.checkinTime(),round(c.latitude()),round(c.longitude()),c.placeName(),c.area(),c.note(),c.createdAt()),i.photos());
        }).toList())).toList();
    }

    static BigDecimal round(BigDecimal v){return v==null?null:v.setScale(2,RoundingMode.HALF_UP);}

    private ShareLinkView view(ShareLinkEntity l){return new ShareLinkView(l.id,l.shareToken,l.status,l.viewCount==null?0:l.viewCount,l.createdAt,l.expiresAt,l.revokedAt,publicUrl+"/s/"+l.shareToken);}
    private static String token(){byte[] b=new byte[24];new SecureRandom().nextBytes(b);return Base64.getUrlEncoder().withoutPadding().encodeToString(b);}
}
