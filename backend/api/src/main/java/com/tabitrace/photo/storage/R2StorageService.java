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
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import java.net.URI;
import java.time.Duration;
import java.util.UUID;

@Service
@ConditionalOnProperty(name="app.storage.mode",havingValue="r2")
public class R2StorageService implements StorageService {
    private final String bucket; private final String publicBase; private final S3Presigner presigner; private final S3Client client;
    @Autowired
    public R2StorageService(@Value("${app.storage.r2.endpoint}") String endpoint,@Value("${app.storage.r2.access-key}") String access,@Value("${app.storage.r2.secret-key}") String secret,@Value("${app.storage.r2.bucket}") String bucket,@Value("${app.storage.r2.public-base-url}") String publicBase){
        this(bucket,publicBase,S3Presigner.builder().endpointOverride(URI.create(endpoint)).region(Region.of("auto")).credentialsProvider(credentials(access,secret)).build(),S3Client.builder().endpointOverride(URI.create(endpoint)).region(Region.of("auto")).credentialsProvider(credentials(access,secret)).build());
    }
    R2StorageService(String bucket,String publicBase,S3Presigner presigner,S3Client client){this.bucket=bucket;this.publicBase=publicBase.replaceAll("/$","");this.presigner=presigner;this.client=client;}
    @Override public PresignResponse presign(Long userId,Long tripId,String fileName,String contentType,long fileSize){String key="users/"+userId+"/trips/"+tripId+"/"+UUID.randomUUID()+"."+StorageService.extensionFor(contentType);PutObjectRequest put=PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).build();var req=PutObjectPresignRequest.builder().signatureDuration(Duration.ofMinutes(15)).putObjectRequest(put).build();String url=presigner.presignPutObject(req).url().toString();return new PresignResponse(key,url,publicUrl(key),900,false);}
    @Override public String publicUrl(String storageKey){return publicBase+"/"+storageKey;}
    @Override public boolean exists(String storageKey){try{client.headObject(HeadObjectRequest.builder().bucket(bucket).key(storageKey).build());return true;}catch(NoSuchKeyException e){return false;}catch(S3Exception e){if(e.statusCode()==404)return false;throw e;}}
    private static StaticCredentialsProvider credentials(String access,String secret){return StaticCredentialsProvider.create(AwsBasicCredentials.create(access,secret));}
}
