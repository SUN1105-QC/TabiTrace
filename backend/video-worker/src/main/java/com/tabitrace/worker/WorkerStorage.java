package com.tabitrace.worker;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Component
public class WorkerStorage {
    private final String mode,bucket,publicBase,localPublicBase;private final S3Client s3;
    @org.springframework.beans.factory.annotation.Autowired
    public WorkerStorage(@Value("${worker.storage.mode:mock}") String mode,@Value("${worker.storage.r2.endpoint:}") String endpoint,@Value("${worker.storage.r2.access-key:}") String access,@Value("${worker.storage.r2.secret-key:}") String secret,@Value("${worker.storage.r2.bucket:}") String bucket,@Value("${worker.storage.r2.public-base-url:}") String publicBase,@Value("${worker.storage.local.public-base-url:http://localhost:3000/generated-videos}") String localPublicBase){this.mode=mode;this.bucket=bucket;this.publicBase=publicBase==null?"":publicBase.replaceAll("/$","");this.localPublicBase=localPublicBase.replaceAll("/$","");if("r2".equalsIgnoreCase(mode)){this.s3=S3Client.builder().endpointOverride(URI.create(endpoint)).region(Region.of("auto")).credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(access,secret))).build();}else this.s3=null;}
    public Result save(VideoJob job,Path file){if(s3==null)return new Result(file.toAbsolutePath().toString(),localPublicBase+"/project-"+job.id()+"/output.mp4");String key="users/"+job.userId()+"/trips/"+job.tripId()+"/videos/"+job.id()+".mp4";s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType("video/mp4").build(),RequestBody.fromFile(file));return new Result(key,publicBase+"/"+key);}
    public record Result(String key,String url){}

    WorkerStorage(S3Client client, String bucket) {
        this.mode = "r2"; this.bucket = bucket; this.s3 = client;
        this.publicBase = ""; this.localPublicBase = "";
    }

    /** Derive the exact output key from server-owned IDs; never accept a client path for deletion. */
    public void deleteOutput(long userId, long tripId, long projectId) {
        if (userId <= 0 || tripId <= 0 || projectId <= 0) throw new IllegalArgumentException("Invalid video ownership");
        if (s3 != null) s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket)
                .key("users/" + userId + "/trips/" + tripId + "/videos/" + projectId + ".mp4").build());
    }

    /** 成片保存在对象存储（r2）：本地文件上传后即可删除 */
    public boolean remote(){return s3!=null;}

    /** 原曲所在的存储桶：建议放在没有公开域名的私有桶（R2_MUSIC_BUCKET），试听片段留在公开桶；未配置时与视频同桶 */
    @Value("${worker.storage.r2.music-bucket:}") private String musicBucket = "";

    /**
     * 背景音乐原曲：r2 模式从存储桶下载到本地缓存（路径里带文件哈希，同一文件只下载一次）；其他模式直接读本地存储目录。
     * 只接受 music/ 下的路径，防止路径穿越。
     */
    public Path music(String key, Path localRoot, Path cacheDir) throws IOException {
        if (key == null || key.contains("..") || key.startsWith("/") || !key.startsWith("music/")) throw new IOException("invalid music key");
        if (s3 == null) return localRoot.resolve(key).normalize();
        Path target = cacheDir.resolve(key).normalize();
        if (!target.startsWith(cacheDir.normalize())) throw new IOException("invalid music key");
        if (Files.isRegularFile(target) && Files.size(target) > 0) return target;
        Files.createDirectories(target.getParent());
        Path part = target.resolveSibling(target.getFileName() + ".part");
        Files.deleteIfExists(part);
        s3.getObject(GetObjectRequest.builder().bucket(musicBucket == null || musicBucket.isBlank() ? bucket : musicBucket).key(key).build(), ResponseTransformer.toFile(part));
        Files.move(part, target, StandardCopyOption.REPLACE_EXISTING);
        return target;
    }

    /**
     * 「我的音乐」（用户上传）：只接受这个用户自己目录下的路径 user-music/{userId}/...。
     * 本地模式直接读 API 的本地存储目录；r2 模式从主存储桶下载到缓存（路径里是随机 UUID，文件不会被覆盖，可以缓存）。
     */
    public Path userMusic(String key, long userId, Path localRoot, Path cacheDir) throws IOException {
        String prefix = "user-music/" + userId + "/";
        if (key == null || key.contains("..") || key.contains("\\") || !key.startsWith(prefix) || key.length() <= prefix.length()) throw new IOException("invalid user music key");
        if (s3 == null) {
            Path p = localRoot.resolve(key).normalize();
            if (!p.startsWith(localRoot.normalize())) throw new IOException("invalid user music key");
            return p;
        }
        Path target = cacheDir.resolve(key).normalize();
        if (!target.startsWith(cacheDir.normalize())) throw new IOException("invalid user music key");
        if (Files.isRegularFile(target) && Files.size(target) > 0) return target;
        Files.createDirectories(target.getParent());
        Path part = target.resolveSibling(target.getFileName() + ".part");
        Files.deleteIfExists(part);
        s3.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build(), ResponseTransformer.toFile(part));
        Files.move(part, target, StandardCopyOption.REPLACE_EXISTING);
        return target;
    }
}
