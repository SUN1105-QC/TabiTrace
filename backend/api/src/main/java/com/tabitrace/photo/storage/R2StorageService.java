package com.tabitrace.photo.storage;

import com.tabitrace.photo.dto.PhotoDtos.PresignResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import com.tabitrace.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.S3Object;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Service
@ConditionalOnProperty(name="app.storage.mode",havingValue="r2")
public class R2StorageService implements StorageService {
    private static final Logger log = LoggerFactory.getLogger(R2StorageService.class);
    private final String bucket; private final String publicBase; private final S3Presigner presigner; private final S3Client client;
    @Autowired
    public R2StorageService(@Value("${app.storage.r2.endpoint}") String endpoint,@Value("${app.storage.r2.access-key}") String access,@Value("${app.storage.r2.secret-key}") String secret,@Value("${app.storage.r2.bucket}") String bucket,@Value("${app.storage.r2.public-base-url}") String publicBase){
        this(bucket,publicBase,S3Presigner.builder().endpointOverride(URI.create(endpoint)).region(Region.of("auto")).credentialsProvider(credentials(access,secret)).build(),S3Client.builder().endpointOverride(URI.create(endpoint)).region(Region.of("auto")).credentialsProvider(credentials(access,secret)).build());
    }
    R2StorageService(String bucket,String publicBase,S3Presigner presigner,S3Client client){this.bucket=bucket;this.publicBase=publicBase.replaceAll("/$","");this.presigner=presigner;this.client=client;}
    @Override public PresignResponse presign(Long userId,Long tripId,String fileName,String contentType,long fileSize){return presignKey("users/"+userId+"/trips/"+tripId+"/"+UUID.randomUUID()+"."+StorageService.extensionFor(contentType),contentType,fileSize);}
    @Override public PresignResponse presignKey(String key,String contentType){return presignKey(key,contentType,0);}
    @Override public PresignResponse presignKey(String key,String contentType,long size){var b=PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType);if(size>0)b.contentLength(size);PutObjectRequest put=b.build();var req=PutObjectPresignRequest.builder().signatureDuration(Duration.ofMinutes(15)).putObjectRequest(put).build();String url=presigner.presignPutObject(req).url().toString();return new PresignResponse(key,url,publicUrl(key),900,false);}
    @Override public String publicUrl(String storageKey){return publicBase+"/"+storageKey;}
    @Override public boolean exists(String storageKey){try{client.headObject(HeadObjectRequest.builder().bucket(bucket).key(storageKey).build());return true;}catch(NoSuchKeyException e){return false;}catch(S3Exception e){if(e.statusCode()==404)return false;throw e;}}
    @Override public void delete(String storageKey){try{client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(storageKey).build());}catch(RuntimeException e){throw deleteFailed(e);}}
    /** 批量删除（每次最多 1000 个）；任何一个删除失败都视为失败 */
    @Override public void deleteAll(Collection<String> keys){List<ObjectIdentifier> ids=new ArrayList<>();for(String k:keys)if(k!=null&&!k.isBlank())ids.add(ObjectIdentifier.builder().key(k).build());
        try{for(int i=0;i<ids.size();i+=1000){var res=client.deleteObjects(DeleteObjectsRequest.builder().bucket(bucket).delete(Delete.builder().objects(ids.subList(i,Math.min(ids.size(),i+1000))).quiet(true).build()).build());
            if(res.hasErrors()&&!res.errors().isEmpty())throw new IllegalStateException(res.errors().size()+" objects failed");}}
        catch(RuntimeException e){throw deleteFailed(e);}}
    /** 按前缀列出全部对象后批量删除（列表分页由 SDK 处理） */
    @Override public void deletePrefix(String prefix){StorageService.requireDirectoryPrefix(prefix);List<String> keys=new ArrayList<>();
        try{client.listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build()).contents().stream().map(S3Object::key).forEach(keys::add);}
        catch(RuntimeException e){throw deleteFailed(e);}
        deleteAll(keys);}
    /** 用户上传的音乐不走公开地址：预签名 GET，过期失效 */
    @Override public String signedReadUrl(String storageKey,long ttlSeconds){var get=GetObjectRequest.builder().bucket(bucket).key(storageKey).build();return presigner.presignGetObject(GetObjectPresignRequest.builder().signatureDuration(Duration.ofSeconds(ttlSeconds)).getObjectRequest(get).build()).url().toString();}
    @Override public byte[] read(String storageKey){try{return client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(storageKey).build()).asByteArray();}catch(NoSuchKeyException e){throw new BusinessException("STORAGE_FILE_NOT_FOUND","文件不存在",HttpStatus.NOT_FOUND);}}
    @Override public String keyOf(String publicUrl){String prefix=publicBase+"/";return publicUrl!=null&&publicUrl.startsWith(prefix)?publicUrl.substring(prefix.length()):null;}
    private static BusinessException deleteFailed(RuntimeException e){log.warn("STORAGE: 删除对象失败 reason={}",e.getClass().getSimpleName()+": "+e.getMessage());return new BusinessException("STORAGE_DELETE_FAILED","文件删除失败，请稍后重试",HttpStatus.BAD_GATEWAY);}
    private static StaticCredentialsProvider credentials(String access,String secret){return StaticCredentialsProvider.create(AwsBasicCredentials.create(access,secret));}
}
