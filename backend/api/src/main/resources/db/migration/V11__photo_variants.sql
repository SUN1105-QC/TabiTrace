-- 照片尺寸版本：上传时由浏览器生成缩略图（列表网格）与中图（详情、封面），原图只用于下载与视频生成。
-- 旧照片没有版本时，前端回退到原图显示。
ALTER TABLE photos
  ADD COLUMN thumb_key VARCHAR(500) NULL AFTER image_url,
  ADD COLUMN thumb_url VARCHAR(1000) NULL AFTER thumb_key,
  ADD COLUMN medium_key VARCHAR(500) NULL AFTER thumb_url,
  ADD COLUMN medium_url VARCHAR(1000) NULL AFTER medium_key;

-- 照片列表分页（按旅行 + id 做游标的兜底排序）
CREATE INDEX idx_photos_trip_id ON photos(trip_id, id);
