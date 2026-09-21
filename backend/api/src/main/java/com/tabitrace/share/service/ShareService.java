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

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

@Service
public class ShareService {
    private final ShareLinkMapper mapper;private final TripService trips;private final TripMapper tripMapper;private final SummaryService summaries;private final CheckinService checkins;private final PhotoMapper photos;private final AchievementService achievements;private final UserMapper users;private final String publicUrl;
    public ShareService(ShareLinkMapper mapper,TripService trips,TripMapper tripMapper,SummaryService summaries,CheckinService checkins,PhotoMapper photos,AchievementService achievements,UserMapper users,@Value("${app.public-url:http://localhost:3000}") String publicUrl){this.mapper=mapper;this.trips=trips;this.tripMapper=tripMapper;this.summaries=summaries;this.checkins=checkins;this.photos=photos;this.achievements=achievements;this.users=users;this.publicUrl=publicUrl.replaceAll("/$","");}
    @Transactional public ShareLinkView create(Long userId,Long tripId,CreateShareRequest r){trips.requireOwned(userId,tripId);ShareLinkEntity l=new ShareLinkEntity();l.tripId=tripId;l.shareToken=token();l.expiresAt=r==null?null:r.expiresAt();mapper.insert(l);tripMapper.updateVisibility(tripId,"UNLISTED");return view(mapper.findById(l.id));}
    public List<ShareLinkView> list(Long userId,Long tripId){trips.requireOwned(userId,tripId);return mapper.listByTrip(tripId).stream().map(this::view).toList();}
    @Transactional public void revoke(Long userId,Long tripId,Long shareId){trips.requireOwned(userId,tripId);ShareLinkEntity l=mapper.findById(shareId);if(l==null||!tripId.equals(l.tripId))throw new BusinessException("SHARE_LINK_NOT_FOUND","分享链接不存在",HttpStatus.NOT_FOUND);mapper.revoke(shareId);if(mapper.countActive(tripId)==0)tripMapper.updateVisibility(tripId,"PRIVATE");}
    @Transactional public PublicShareView publicView(String token){ShareLinkEntity l=mapper.findActiveByToken(token);if(l==null)throw new BusinessException("SHARE_LINK_INVALID","分享链接无效或已失效",HttpStatus.NOT_FOUND);mapper.incrementViews(l.id);TripEntity t=tripMapper.findById(l.tripId);if(t==null)throw new BusinessException("TRIP_NOT_FOUND","旅行不存在",HttpStatus.NOT_FOUND);var featured=photos.listFeatured(t.id).stream().map(PhotoService::view).toList();var owner=users.findById(t.userId);return new PublicShareView(TripService.view(t),summaries.get(t.userId,t.id),checkins.timeline(t.userId,t.id),featured,achievements.list(t.userId,t.id),owner==null?"旅行者":owner.nickname);}
    private ShareLinkView view(ShareLinkEntity l){return new ShareLinkView(l.id,l.shareToken,l.status,l.viewCount==null?0:l.viewCount,l.createdAt,l.expiresAt,l.revokedAt,publicUrl+"/s/"+l.shareToken);}
    private static String token(){byte[] b=new byte[24];new SecureRandom().nextBytes(b);return Base64.getUrlEncoder().withoutPadding().encodeToString(b);}
}
