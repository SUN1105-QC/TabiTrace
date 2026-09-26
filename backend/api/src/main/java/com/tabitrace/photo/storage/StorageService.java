package com.tabitrace.photo.storage;

import com.tabitrace.photo.dto.PhotoDtos.PresignResponse;

public interface StorageService {
    PresignResponse presign(Long userId,Long tripId,String fileName,String contentType,long fileSize);
    /** 为指定存储路径签发上传地址（头像等非旅行照片使用），路径由调用方按用户隔离生成 */
    PresignResponse presignKey(String key,String contentType);
    String publicUrl(String storageKey);
    default boolean exists(String storageKey){return true;}
    static String extensionFor(String contentType){if(contentType==null)return "bin";return switch(contentType.toLowerCase()){case "image/jpeg","image/jpg" -> "jpg";case "image/png" -> "png";case "image/webp" -> "webp";case "image/gif" -> "gif";case "image/heic","image/heif" -> "heic";default -> "img";};}
}
