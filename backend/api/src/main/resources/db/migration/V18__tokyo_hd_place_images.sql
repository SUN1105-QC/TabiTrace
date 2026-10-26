-- 东京官方景点换成高清图（frontend/public/images/explore/hd/）。
-- 原图来自 Wikimedia Commons（作者与许可证见 docs/IMAGE_LICENSES.md），由 frontend/scripts/optimize-place-images.mjs
-- 生成 640 / 1280 / 1920 三档 WebP。这里保存 1280 档的地址，前端按显示宽度换成其他档位。
-- 只给能确认画面就是该地点的照片；没有对应照片的地点保持 NULL，前端显示文字封面。
-- 「筑地场外市场」的照片不是丰洲市场，不借用。

-- 地点（同一个景点全站只用这一张主图）
UPDATE places SET cover_image='/images/explore/hd/1280/01-sensoji-kaminarimon.webp' WHERE source_type='OFFICIAL' AND id IN (1,2);   -- 浅草寺、雷门
UPDATE places SET cover_image='/images/explore/hd/1280/04-tokyo-skytree.webp' WHERE source_type='OFFICIAL' AND id=3;                -- 东京晴空塔
UPDATE places SET cover_image='/images/explore/hd/1280/02-nakamise-street.webp' WHERE source_type='OFFICIAL' AND id=4;              -- 仲见世
UPDATE places SET cover_image='/images/explore/hd/1280/19-akihabara.webp' WHERE source_type='OFFICIAL' AND id=5;                    -- 秋叶原电器街
UPDATE places SET cover_image='/images/explore/hd/1280/18-kanda-myojin.webp' WHERE source_type='OFFICIAL' AND id=6;                 -- 神田明神
UPDATE places SET cover_image='/images/explore/hd/1280/20-ueno-park.webp' WHERE source_type='OFFICIAL' AND id=8;                    -- 上野公园
UPDATE places SET cover_image='/images/explore/hd/1280/22-ameyoko.webp' WHERE source_type='OFFICIAL' AND id=9;                      -- 阿美横丁
UPDATE places SET cover_image='/images/explore/hd/1280/23-tokyo-national-museum.webp' WHERE source_type='OFFICIAL' AND id=10;       -- 东京国立博物馆
UPDATE places SET cover_image='/images/explore/hd/1280/07-tokyo-station.webp' WHERE source_type='OFFICIAL' AND id=11;               -- 东京站
UPDATE places SET cover_image='/images/explore/hd/1280/08-imperial-palace.webp' WHERE source_type='OFFICIAL' AND id=12;             -- 皇居外苑
UPDATE places SET cover_image='/images/explore/hd/1280/05-ginza-wako.webp' WHERE source_type='OFFICIAL' AND id=14;                  -- 银座
UPDATE places SET cover_image='/images/explore/hd/1280/06-ginza-six.webp' WHERE source_type='OFFICIAL' AND id=15;                   -- GINZA SIX
UPDATE places SET cover_image='/images/explore/hd/1280/09-shibuya-crossing.webp' WHERE source_type='OFFICIAL' AND id=17;            -- 涩谷十字路口
UPDATE places SET cover_image='/images/explore/hd/1280/10-hachiko-statue.webp' WHERE source_type='OFFICIAL' AND id=19;              -- 忠犬八公像
UPDATE places SET cover_image='/images/explore/hd/1280/13-meiji-jingu.webp' WHERE source_type='OFFICIAL' AND id=20;                 -- 明治神宫
UPDATE places SET cover_image='/images/explore/hd/1280/11-takeshita-street.webp' WHERE source_type='OFFICIAL' AND id=21;            -- 竹下通
UPDATE places SET cover_image='/images/explore/hd/1280/14-yoyogi-park.webp' WHERE source_type='OFFICIAL' AND id=22;                 -- 代代木公园
UPDATE places SET cover_image='/images/explore/hd/1280/15-shinjuku-gyoen.webp' WHERE source_type='OFFICIAL' AND id=23;              -- 新宿御苑
UPDATE places SET cover_image='/images/explore/hd/1280/16-tokyo-metropolitan-government.webp' WHERE source_type='OFFICIAL' AND id=24; -- 东京都厅
UPDATE places SET cover_image='/images/explore/hd/1280/17-kabukicho.webp' WHERE source_type='OFFICIAL' AND id=25;                   -- 歌舞伎町
UPDATE places SET cover_image='/images/explore/hd/1280/03-tokyo-tower.webp' WHERE source_type='OFFICIAL' AND id=26;                 -- 东京塔
UPDATE places SET cover_image='/images/explore/hd/1280/25-odaiba-seaside-park.webp' WHERE source_type='OFFICIAL' AND id=28;         -- 台场海滨公园
UPDATE places SET cover_image='/images/explore/hd/1280/24-rainbow-bridge.webp' WHERE source_type='OFFICIAL' AND id=29;              -- 彩虹大桥
-- 秋叶原UDX、丸之内仲通、歌舞伎座、涩谷 SKY、麻布台 Hills、丰洲市场：清单里没有对应照片，继续 NULL
UPDATE places SET cover_image=NULL WHERE source_type='OFFICIAL' AND id IN (7,13,16,18,27,30);

-- 专题路线（旅行灵感）
UPDATE official_routes SET cover_image='/images/explore/hd/1280/02-nakamise-street.webp' WHERE city_code='TOKYO' AND code='ASAKUSA_WALK';
UPDATE official_routes SET cover_image='/images/explore/hd/1280/15-shinjuku-gyoen.webp' WHERE city_code='TOKYO' AND code='AUTUMN_TOKYO';
UPDATE official_routes SET cover_image='/images/explore/hd/1280/16-tokyo-metropolitan-government.webp' WHERE city_code='TOKYO' AND code='TOKYO_NIGHT';
UPDATE official_routes SET cover_image='/images/explore/hd/1280/19-akihabara.webp' WHERE city_code='TOKYO' AND code='AKIBA_TOUR';
UPDATE official_routes SET cover_image='/images/explore/hd/1280/21-ueno-zoo-panda.webp' WHERE city_code='TOKYO' AND code='UENO_CULTURE';
UPDATE official_routes SET cover_image='/images/explore/hd/1280/07-tokyo-station.webp' WHERE city_code='TOKYO' AND code='GINZA_MARUNOUCHI';

-- 官方城市封面（创建东京旅行时作为默认封面）
UPDATE official_cities SET cover_image='/images/explore/hd/1280/01-sensoji-kaminarimon.webp' WHERE code='TOKYO';

-- 创建东京旅行时，旅行封面复制了当时的城市封面地址（引用的是官方图片，不是用户照片）。
-- 只同步与旧官方图片地址完全相同的旅行封面；用户自己上传或选择的照片封面不受影响。
UPDATE trips SET cover_image='/images/explore/hd/1280/01-sensoji-kaminarimon.webp' WHERE cover_image='/images/explore/asakusa.jpg';
