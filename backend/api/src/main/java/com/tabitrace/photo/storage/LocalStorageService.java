package com.tabitrace.photo.storage;

import com.tabitrace.common.BusinessException;
import com.tabitrace.photo.dto.PhotoDtos.PresignResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Service
@ConditionalOnProperty(name="app.storage.mode",havingValue="local")
public class LocalStorageService implements StorageService {
    private static final long UPLOAD_TTL_SECONDS=900;
    private final Path root; private final String apiUrl; private final byte[] uploadSigningKey=new byte[32];
    public LocalStorageService(@Value("${app.storage.local.directory:./.tabitrace/uploads}") String directory,@Value("${app.api-url:http://localhost:8080}") String apiUrl){this.root=Paths.get(directory).toAbsolutePath().normalize();this.apiUrl=apiUrl.replaceAll("/$","");new SecureRandom().nextBytes(uploadSigningKey);try{Files.createDirectories(root);}catch(Exception e){throw new IllegalStateException("Cannot create local upload directory",e);}}
    @Override public PresignResponse presign(Long userId,Long tripId,String fileName,String contentType,long fileSize){return presignKey("users/"+userId+"/trips/"+tripId+"/"+UUID.randomUUID()+"."+StorageService.extensionFor(contentType),contentType);}
    @Override public PresignResponse presignKey(String key,String contentType){String encoded=URLEncoder.encode(key,StandardCharsets.UTF_8);long expires=Instant.now().getEpochSecond()+UPLOAD_TTL_SECONDS;return new PresignResponse(key,apiUrl+"/api/v1/local-storage/upload?key="+encoded+"&expires="+expires+"&signature="+sign(key,expires),publicUrl(key),UPLOAD_TTL_SECONDS,false);}
    @Override public String publicUrl(String storageKey){return apiUrl+"/api/v1/local-storage/file?key="+URLEncoder.encode(storageKey,StandardCharsets.UTF_8);}
    @Override public boolean exists(String storageKey){return Files.isRegularFile(resolve(storageKey));}
    public boolean verifyUpload(String key,Long expires,String signature){if(key==null||expires==null||signature==null||expires<Instant.now().getEpochSecond())return false;return MessageDigest.isEqual(sign(key,expires).getBytes(StandardCharsets.UTF_8),signature.getBytes(StandardCharsets.UTF_8));}
    public void write(String key,byte[] data){Path path=resolve(key);try{Files.createDirectories(path.getParent());Files.write(path,data,StandardOpenOption.CREATE,StandardOpenOption.TRUNCATE_EXISTING);}catch(Exception e){throw new BusinessException("LOCAL_UPLOAD_FAILED","本地图片写入失败");}}
    @Override public void delete(String storageKey){try{Files.deleteIfExists(resolve(storageKey));}catch(BusinessException e){throw e;}catch(Exception e){throw new BusinessException("STORAGE_DELETE_FAILED","文件删除失败，请稍后重试");}}
    @Override public void deletePrefix(String prefix){StorageService.requireDirectoryPrefix(prefix);Path dir=resolve(prefix.substring(0,prefix.length()-1));if(!Files.isDirectory(dir))return;
        try(var paths=Files.walk(dir)){for(Path p:paths.sorted(java.util.Comparator.reverseOrder()).toList())Files.deleteIfExists(p);}
        catch(Exception e){throw new BusinessException("STORAGE_DELETE_FAILED","文件删除失败，请稍后重试");}}
    @Override public String keyOf(String publicUrl){String prefix=apiUrl+"/api/v1/local-storage/file?key=";return publicUrl!=null&&publicUrl.startsWith(prefix)?java.net.URLDecoder.decode(publicUrl.substring(prefix.length()),StandardCharsets.UTF_8):null;}
    @Override public byte[] read(String key){try{return Files.readAllBytes(resolve(key));}catch(Exception e){throw new BusinessException("LOCAL_FILE_NOT_FOUND","本地图片不存在",org.springframework.http.HttpStatus.NOT_FOUND);}}
    /** 私有文件的限时读取地址：签名与上传签名分开（前缀 read:），上传地址不能拿来读取 */
    @Override public String signedReadUrl(String key,long ttlSeconds){long expires=Instant.now().getEpochSecond()+ttlSeconds;return apiUrl+"/api/v1/local-storage/file?key="+URLEncoder.encode(key,StandardCharsets.UTF_8)+"&expires="+expires+"&signature="+sign("read:"+key,expires);}
    public boolean verifyRead(String key,Long expires,String signature){if(key==null||expires==null||signature==null||expires<Instant.now().getEpochSecond())return false;return MessageDigest.isEqual(sign("read:"+key,expires).getBytes(StandardCharsets.UTF_8),signature.getBytes(StandardCharsets.UTF_8));}
    /** 本地文件路径（流式返回、支持 Range）；路径校验同 resolve */
    public Path path(String key){return resolve(key);}
    String sign(String key,long expires){try{Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(uploadSigningKey,"HmacSHA256"));return HexFormat.of().formatHex(mac.doFinal((key+"\n"+expires).getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException("Cannot sign local upload",e);}}
    private Path resolve(String key){if(key==null||key.isBlank()||key.contains("..")||key.startsWith("/")||key.startsWith("\\"))throw new BusinessException("INVALID_STORAGE_KEY","图片存储路径不合法");Path p=root.resolve(key).normalize();if(!p.startsWith(root))throw new BusinessException("INVALID_STORAGE_KEY","图片存储路径不合法");return p;}
}
