package com.tabitrace.worker;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;
import java.nio.file.Path;

@Component
public class WorkerStorage {
    private final String mode,bucket,publicBase,localPublicBase;private final S3Client s3;
    public WorkerStorage(@Value("${worker.storage.mode:mock}") String mode,@Value("${worker.storage.r2.endpoint:}") String endpoint,@Value("${worker.storage.r2.access-key:}") String access,@Value("${worker.storage.r2.secret-key:}") String secret,@Value("${worker.storage.r2.bucket:}") String bucket,@Value("${worker.storage.r2.public-base-url:}") String publicBase,@Value("${worker.storage.local.public-base-url:http://localhost:3000/generated-videos}") String localPublicBase){this.mode=mode;this.bucket=bucket;this.publicBase=publicBase==null?"":publicBase.replaceAll("/$","");this.localPublicBase=localPublicBase.replaceAll("/$","");if("r2".equalsIgnoreCase(mode)){this.s3=S3Client.builder().endpointOverride(URI.create(endpoint)).region(Region.of("auto")).credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(access,secret))).build();}else this.s3=null;}
    public Result save(VideoJob job,Path file){if(s3==null)return new Result(file.toAbsolutePath().toString(),localPublicBase+"/project-"+job.id()+"/output.mp4");String key="users/"+job.userId()+"/trips/"+job.tripId()+"/videos/"+job.id()+".mp4";s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType("video/mp4").build(),RequestBody.fromFile(file));return new Result(key,publicBase+"/"+key);}
    public record Result(String key,String url){}
}
