-- 探索指南封面改用裁掉了文字的版本（public/images/explore/）。
-- 只给能确认画面就是该地点的地点配图；无法确认的（晴空塔、秋叶原 UDX、涩谷 SKY）不借用相似照片，由前端显示文字封面。

UPDATE places SET cover_image='/images/explore/asakusa.jpg' WHERE id IN (1,2);
UPDATE places SET cover_image=NULL WHERE id IN (3,7,18);
UPDATE places SET cover_image='/images/explore/nakamise.jpg' WHERE id=4;
UPDATE places SET cover_image='/images/explore/akihabara.jpg' WHERE id=5;
UPDATE places SET cover_image='/images/explore/ueno-autumn.jpg' WHERE id=8;
UPDATE places SET cover_image='/images/explore/tokyo-station.jpg' WHERE id=11;
UPDATE places SET cover_image='/images/explore/ginza.jpg' WHERE id=14;
UPDATE places SET cover_image='/images/explore/shibuya-crossing.jpg' WHERE id=17;
UPDATE places SET cover_image='/images/explore/tocho-night.jpg' WHERE id=24;
UPDATE places SET cover_image='/images/explore/kabukicho.jpg' WHERE id=25;
UPDATE places SET cover_image='/images/explore/tokyo-tower.jpg' WHERE id=26;
UPDATE places SET cover_image='/images/explore/rainbow-bridge.jpg' WHERE id IN (28,29);

UPDATE official_routes SET cover_image='/images/explore/nakamise.jpg' WHERE city_code='TOKYO' AND code='ASAKUSA_WALK';
UPDATE official_routes SET cover_image='/images/explore/ueno-autumn.jpg' WHERE city_code='TOKYO' AND code='AUTUMN_TOKYO';
UPDATE official_routes SET cover_image='/images/explore/tocho-night.jpg' WHERE city_code='TOKYO' AND code='TOKYO_NIGHT';
UPDATE official_routes SET cover_image='/images/explore/akiba-figures.jpg' WHERE city_code='TOKYO' AND code='AKIBA_TOUR';
UPDATE official_routes SET cover_image='/images/explore/ueno-panda.jpg' WHERE city_code='TOKYO' AND code='UENO_CULTURE';
UPDATE official_routes SET cover_image='/images/explore/ginza.jpg' WHERE city_code='TOKYO' AND code='GINZA_MARUNOUCHI';
