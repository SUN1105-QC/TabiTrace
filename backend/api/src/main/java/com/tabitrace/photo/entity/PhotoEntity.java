package com.tabitrace.photo.entity;

import java.time.LocalDateTime;

public class PhotoEntity {
    public Long id;
    public Long userId;
    public Long tripId;
    public Long checkinId;
    public String storageKey;
    public String imageUrl;
    /** 列表用缩略图 / 详情用中图（上传时由浏览器生成；旧照片为空，前端回退原图） */
    public String thumbKey;
    public String thumbUrl;
    public String mediumKey;
    public String mediumUrl;
    public Integer width;
    public Integer height;
    public Long fileSize;
    public String mimeType;
    public Boolean featured;
    public LocalDateTime capturedAt;
    public LocalDateTime createdAt;
    /** 分页查询时的排序时间（拍摄时间 → 打卡时间 → 旅行期间内的上传时间），只在分页结果里有值 */
    public LocalDateTime sortAt;
}
