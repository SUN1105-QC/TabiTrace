package com.tabitrace.photo.storage;

import com.tabitrace.photo.dto.PhotoDtos.PresignResponse;

public interface StorageService {
    PresignResponse presign(Long userId,Long tripId,String fileName,String contentType,long fileSize);
    /** 为指定存储路径签发上传地址（头像等非旅行照片使用），路径由调用方按用户隔离生成 */
    PresignResponse presignKey(String key,String contentType);
    String publicUrl(String storageKey);
    default boolean exists(String storageKey){return true;}
    /** 按声明的文件大小签发上传地址：对象存储会拒绝与声明大小不一致的上传（防止拿到地址后上传超大文件） */
    default PresignResponse presignKey(String key,String contentType,long size){return presignKey(key,contentType);}
    /** 删除对象（不存在视为成功）。失败抛 BusinessException，调用方据此让整个删除失败，不能假装已删除 */
    default void delete(String storageKey){}
    default void deleteAll(java.util.Collection<String> keys){for(String k:keys)if(k!=null&&!k.isBlank())delete(k);}
    /** 删除某个目录（前缀）下的全部文件，用于注销账号；prefix 必须以 / 结尾，失败时抛异常 */
    default void deletePrefix(String prefix){}
    static void requireDirectoryPrefix(String prefix){if(prefix==null||!prefix.endsWith("/")||prefix.length()<3||prefix.contains("..")||prefix.startsWith("/"))throw new IllegalArgumentException("invalid storage prefix: "+prefix);}
    /** 由 publicUrl 反推存储路径（头像只保存了地址）；不属于本存储时返回 null */
    default String keyOf(String publicUrl){return null;}
    /** 私有文件（用户上传的音乐）的限时读取地址：本地存储带签名，R2 为预签名 GET；没有私有读取能力的存储退回公开地址 */
    default String signedReadUrl(String storageKey,long ttlSeconds){return publicUrl(storageKey);}
    /** 服务端读取对象内容（上传后校验文件真实格式用）；不支持时抛 BusinessException */
    default byte[] read(String storageKey){throw new com.tabitrace.common.BusinessException("STORAGE_READ_UNSUPPORTED","当前存储不支持读取文件");}
    /** 照片与头像允许的图片类型（不含 SVG 等可执行脚本的格式） */
    java.util.Set<String> IMAGE_TYPES=java.util.Set.of("image/jpeg","image/jpg","image/png","image/webp","image/gif","image/heic","image/heif");
    static String extensionFor(String contentType){if(contentType==null)return "bin";return switch(contentType.toLowerCase()){case "image/jpeg","image/jpg" -> "jpg";case "image/png" -> "png";case "image/webp" -> "webp";case "image/gif" -> "gif";case "image/heic","image/heif" -> "heic";default -> "img";};}
}
