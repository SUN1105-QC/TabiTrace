-- Additive presentation metadata. Existing city/detail APIs still require ACTIVE.
CREATE TABLE explore_countries (
  code VARCHAR(10) PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  english_name VARCHAR(100) NOT NULL,
  theme VARCHAR(200) NULL,
  description TEXT NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE explore_city_entries (
  city_code VARCHAR(50) PRIMARY KEY,
  country_code VARCHAR(10) NOT NULL,
  english_name VARCHAR(100) NOT NULL,
  summary VARCHAR(500) NULL,
  tags JSON NULL,
  explore_path VARCHAR(200) NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_explore_entry_city FOREIGN KEY (city_code) REFERENCES official_cities(code),
  CONSTRAINT fk_explore_entry_country FOREIGN KEY (country_code) REFERENCES explore_countries(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO explore_countries(code,slug,name,english_name,theme,description,published,sort_order) VALUES
('JP','japan','日本','JAPAN','传统与现代交织的国度','从古老的神社寺院，到现代都市的霓虹灯火。在街巷、庭园和城市日常里，寻找属于你的旅行节奏。',TRUE,10),
('KR','korea','韩国','SOUTH KOREA','走进街头，也走近日常','从城市街区出发，收藏文化、美食与生活气息，让每一段旅途都留下自己的故事。',TRUE,20),
('CN','china','中国','CHINA','语言相通，风景各有千秋','从熟悉的城市味道，到陌生街角的惊喜，把一座城走进自己的故事。',TRUE,30);

-- Move the previously displayed previews into public editorial records.
-- Existing records, including private/DRAFT cities, are never overwritten or promoted.
INSERT INTO official_cities(code,name,country_code,description,status,theme,created_at)
SELECT s.code,d.name,d.country_code,s.summary,s.status,NULL,UTC_TIMESTAMP()
FROM (
 SELECT 'OSAKA' AS code,'大阪' AS name,'街头美食与都市日常，下一站一起慢慢探索。' AS summary,'COMING_SOON' AS status
 UNION ALL SELECT 'KYOTO','京都','沿着古都街巷，寻找寺社与庭园之间的片刻安静。','COMING_SOON'
 UNION ALL SELECT 'SEOUL','首尔','从城市街区出发，发现旅途中的新鲜日常。','PLANNED'
 UNION ALL SELECT 'TAIPEI','台北','沿着街巷散步，让城市的味道成为旅行记忆。','PLANNED'
) s JOIN destinations d ON d.name=s.name
LEFT JOIN official_cities existing ON existing.code=s.code
WHERE existing.id IS NULL;

INSERT INTO explore_city_entries(city_code,country_code,english_name,summary,tags,explore_path,published,sort_order)
SELECT s.code,s.country_code,s.english_name,s.summary,s.tags,s.explore_path,TRUE,s.sort_order
FROM (
 SELECT 'TOKYO' AS code,'JP' AS country_code,'TOKYO' AS english_name,'在寺社、街区与城市夜色之间，寻找东京的另一面。' AS summary,
   JSON_ARRAY('城市漫步','寺社人文','夜景') AS tags,'/explore/tokyo' AS explore_path,10 AS sort_order
 UNION ALL SELECT 'OSAKA','JP','OSAKA','街头美食与都市日常，下一站一起慢慢探索。',JSON_ARRAY('街头美食','都市日常'),NULL,20
 UNION ALL SELECT 'KYOTO','JP','KYOTO','沿着古都街巷，寻找寺社与庭园之间的片刻安静。',JSON_ARRAY('古都漫步','寺社庭园'),NULL,30
 UNION ALL SELECT 'SEOUL','KR','SEOUL','从城市街区出发，发现旅途中的新鲜日常。',JSON_ARRAY('街区文化','城市生活'),NULL,10
 UNION ALL SELECT 'TAIPEI','CN','TAIPEI','沿着街巷散步，让城市的味道成为旅行记忆。',JSON_ARRAY('街巷散步','城市味道'),NULL,10
) s JOIN official_cities c ON c.code=s.code;
