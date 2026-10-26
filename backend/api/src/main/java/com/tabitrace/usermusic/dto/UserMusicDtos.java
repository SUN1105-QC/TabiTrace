package com.tabitrace.usermusic.dto;

import com.tabitrace.membership.service.MembershipService.MembershipView;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

public final class UserMusicDtos {
    private UserMusicDtos() {}

    /** 申请上传地址：必须勾选版权确认；fileSize 是浏览器读到的文件大小，存储会拒绝与之不一致的上传 */
    public record UploadUrlRequest(@NotBlank @Size(max = 255) String fileName, @NotBlank @Size(max = 100) String contentType,
                                   @NotNull Long fileSize, @Size(max = 60) String title, Boolean copyrightConfirmed) {}
    /** contentType：上传时 PUT 请求必须带的 Content-Type（预签名地址签入了它） */
    public record UploadUrlResponse(UserMusicView music, String uploadUrl, String contentType, long expiresInSeconds, boolean mock) {}
    /** 文件已经上传到存储：登记并解析 */
    public record CompleteRequest(@NotNull Long musicId) {}
    public record RenameRequest(@NotBlank @Size(max = 60) String title) {}

    /** format：MP3 / M4A / WAV；failureMessage：失败原因（中文，可直接展示） */
    public record UserMusicView(Long id, String title, String originalFilename, String format, String mimeType, long fileSize,
                                Double durationSeconds, String status, String failureCode, String failureMessage,
                                LocalDateTime createdAt, LocalDateTime updatedAt) {}

    public record Limits(long maxFileBytes, int maxTracks, long maxTotalBytes, int minDurationSeconds, int maxDurationSeconds,
                         List<String> formats, List<String> extensions, List<String> mimeTypes) {}
    public record Usage(int tracks, long bytes) {}
    /**
     * 「我的音乐」：会员状态 + 限制 + 用量 + 列表。
     * canUpload / canUse 由后端按会员状态给出（会员到期后只读：可以查看、试听、删除，不能上传和用于新视频）。
     */
    public record Library(MembershipView membership, boolean canUpload, boolean canUse, Limits limits, Usage usage, List<UserMusicView> items) {}
    public record PlayUrl(String url, long expiresInSeconds) {}
}
