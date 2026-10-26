package com.tabitrace.photo.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;

public final class PhotoDtos {
    private PhotoDtos() {}
    /** variant=thumb|medium 时为已签名原图（variantOf）签发尺寸版本的上传地址 */
    public record PresignRequest(@NotBlank String fileName,@NotBlank String contentType,Long fileSize,String variantOf,String variant) {
        public PresignRequest(String fileName,String contentType,Long fileSize){this(fileName,contentType,fileSize,null,null);}
    }
    public record PresignResponse(String storageKey,String uploadUrl,String publicUrl,long expiresInSeconds,boolean mock) {}
    public record RegisterPhotoRequest(Long checkinId,@NotBlank String storageKey,String imageUrl,Integer width,Integer height,Long fileSize,@NotBlank String mimeType,Boolean featured,OffsetDateTime capturedAt,String thumbKey,String mediumKey) {
        public RegisterPhotoRequest(Long checkinId,String storageKey,String imageUrl,Integer width,Integer height,Long fileSize,String mimeType,Boolean featured,OffsetDateTime capturedAt){this(checkinId,storageKey,imageUrl,width,height,fileSize,mimeType,featured,capturedAt,null,null);}
    }
    public record UpdatePhotoRequest(Long checkinId,OffsetDateTime capturedAt) {}
    /** 批量操作：FEATURE / UNFEATURE / DELETE；照片必须都属于该旅行 */
    public record BatchPhotoRequest(@jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max=500) java.util.List<Long> photoIds,@NotBlank String action) {}
    public record BatchPhotoResult(String action,int affected) {}
    public record PhotoView(Long id,Long tripId,Long checkinId,String storageKey,String imageUrl,Integer width,Integer height,Long fileSize,String mimeType,boolean featured,OffsetDateTime capturedAt,OffsetDateTime createdAt,String thumbUrl,String mediumUrl) {}
    /** 照片墙分页：游标分页（nextCursor 为空表示没有更多），counts 是整段旅行的统计（不随筛选变化） */
    public record PhotoPage(java.util.List<PhotoView> items,String nextCursor,PhotoCounts counts) {}
    public record PhotoCounts(int total,int featured,int linked,int unlinked) {}
}
