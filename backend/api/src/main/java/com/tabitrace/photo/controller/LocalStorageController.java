package com.tabitrace.photo.controller;

import com.tabitrace.photo.storage.LocalStorageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/local-storage")
@ConditionalOnProperty(name="app.storage.mode",havingValue="local")
public class LocalStorageController {
    private static final long DEFAULT_MAX_UPLOAD_BYTES=20*1024*1024L;
    private final LocalStorageService storage; private final long userMusicMaxBytes;
    public LocalStorageController(LocalStorageService storage,@Value("${app.user-music.max-file-bytes:31457280}") long userMusicMaxBytes){this.storage=storage;this.userMusicMaxBytes=userMusicMaxBytes;}
    @PutMapping("/upload") public ResponseEntity<Void> upload(@RequestParam String key,@RequestParam(required=false) Long expires,@RequestParam(required=false) String signature,@RequestBody byte[] body){if(!storage.verifyUpload(key,expires,signature)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();if(body.length>maxUploadBytes(key)) return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();storage.write(key,body);return ResponseEntity.noContent().build();}
    /**
     * 读取文件。用户上传的音乐是私有文件：只接受带读取签名的限时地址（由 /user/music/{id}/play-url 签发），
     * 以文件流返回，支持 Range（拖动进度条、从暂停处继续）。
     */
    @GetMapping("/file") public ResponseEntity<?> file(@RequestParam String key,@RequestParam(required=false) Long expires,@RequestParam(required=false) String signature){
        if(userMusicKey(key)){
            if(!storage.verifyRead(key,expires,signature)) return ResponseEntity.notFound().build();
            FileSystemResource file=new FileSystemResource(storage.path(key));
            if(!file.exists()) return ResponseEntity.notFound().build();
            return ResponseEntity.ok().contentType(MediaType.parseMediaType(contentType(key))).cacheControl(CacheControl.noStore()).body(file);
        }
        if(privateKey(key)) return ResponseEntity.notFound().build();
        byte[] data=storage.read(key);MediaType type=MediaType.parseMediaType(contentType(key));return ResponseEntity.ok().contentType(type).cacheControl(CacheControl.noCache()).body(data);
    }
    /** 用户上传的音乐可达 30MB（app.user-music.max-file-bytes）；其他文件（照片、头像）沿用 20MB */
    long maxUploadBytes(String key){return userMusicKey(key)?userMusicMaxBytes:DEFAULT_MAX_UPLOAD_BYTES;}
    /** 背景音乐原曲只给视频 worker 读取（直接读目录），不通过 HTTP 提供；先规范化路径，防止 previews/../originals 绕过 */
    static boolean privateKey(String key){String k=normalized(key);return k==null||k.startsWith("music/originals/")||k.contains("/music/originals/")||userMusicKey(key);}
    /** 用户上传的音乐（user-music/{userId}/...）：不允许无签名读取 */
    static boolean userMusicKey(String key){String k=normalized(key);return k==null||k.startsWith("user-music/");}
    private static String normalized(String key){try{return java.nio.file.Path.of(key.replace('\\','/')).normalize().toString().replace('\\','/').toLowerCase();}catch(RuntimeException e){return null;}}
    /** 本地存储同时放照片、头像、背景音乐试听片段与用户上传的音乐：按扩展名给出正确的 Content-Type */
    static String contentType(String key){String k=key.toLowerCase();if(k.endsWith(".png"))return "image/png";if(k.endsWith(".gif"))return "image/gif";if(k.endsWith(".webp"))return "image/webp";if(k.endsWith(".mp3"))return "audio/mpeg";if(k.endsWith(".m4a"))return "audio/mp4";if(k.endsWith(".wav"))return "audio/wav";if(k.endsWith(".mp4"))return "video/mp4";return "image/jpeg";}
}
