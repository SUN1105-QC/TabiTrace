package com.tabitrace.share.mapper;

import com.tabitrace.share.entity.ShareLinkEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface ShareLinkMapper {
    @Insert("INSERT INTO share_links(trip_id,share_token,status,view_count,created_at,expires_at) VALUES(#{tripId},#{shareToken},'ACTIVE',0,UTC_TIMESTAMP(),#{expiresAt})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(ShareLinkEntity link);
    @Select("SELECT * FROM share_links WHERE id=#{id}") ShareLinkEntity findById(Long id);
    @Select("SELECT * FROM share_links WHERE trip_id=#{tripId} ORDER BY id DESC") List<ShareLinkEntity> listByTrip(Long tripId);
    @Select("SELECT * FROM share_links WHERE share_token=#{token} AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP())") ShareLinkEntity findActiveByToken(String token);
    @Update("UPDATE share_links SET view_count=view_count+1 WHERE id=#{id}") int incrementViews(Long id);
    @Update("UPDATE share_links SET status='REVOKED',revoked_at=UTC_TIMESTAMP() WHERE id=#{id} AND status='ACTIVE'") int revoke(Long id);
    @Select("SELECT COUNT(*) FROM share_links WHERE trip_id=#{tripId} AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP())") int countActive(Long tripId);
}
