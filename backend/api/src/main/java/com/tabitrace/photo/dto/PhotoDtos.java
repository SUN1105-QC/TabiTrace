package com.tabitrace.photo.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;

public final class PhotoDtos {
    private PhotoDtos() {}
    public record PresignRequest(@NotBlank String fileName,@NotBlank String contentType,Long fileSize) {}
    public record PresignResponse(String storageKey,String uploadUrl,String publicUrl,long expiresInSeconds,boolean mock) {}
    public record RegisterPhotoRequest(Long checkinId,@NotBlank String storageKey,String imageUrl,Integer width,Integer height,Long fileSize,@NotBlank String mimeType,Boolean featured,OffsetDateTime capturedAt) {}
    public record UpdatePhotoRequest(Long checkinId,OffsetDateTime capturedAt) {}
    public record PhotoView(Long id,Long tripId,Long checkinId,String storageKey,String imageUrl,Integer width,Integer height,Long fileSize,String mimeType,boolean featured,OffsetDateTime capturedAt,OffsetDateTime createdAt) {}
}
