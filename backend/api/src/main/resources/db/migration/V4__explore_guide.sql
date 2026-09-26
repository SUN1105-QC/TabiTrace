-- 推荐探索（东京探索指南）：地点编辑内容、官方专题路线、地点收藏。

ALTER TABLE places
  ADD COLUMN tagline VARCHAR(120) NULL COMMENT '一句话介绍' AFTER description,
  ADD COLUMN recommend_reason VARCHAR(255) NULL COMMENT '编辑推荐理由' AFTER tagline,
  ADD COLUMN stay_minutes INT NULL COMMENT '建议停留分钟数' AFTER recommend_reason,
  ADD COLUMN best_time VARCHAR(40) NULL COMMENT '最佳游玩时间' AFTER stay_minutes,
  ADD COLUMN tags VARCHAR(255) NULL COMMENT '探索标签，逗号分隔：MUST,WALK,PHOTO,NIGHT,FREE,RAIN,FOOD,SHOP,NATURE,CULTURE,FIRST' AFTER best_time,
  ADD COLUMN editor_rank INT NULL COMMENT '编辑精选顺序，NULL 表示不在精选里' AFTER tags;

-- 官方专题路线：按顺序串起若干官方地点
CREATE TABLE official_routes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  city_code VARCHAR(40) NOT NULL,
  code VARCHAR(60) NOT NULL,
  title VARCHAR(80) NOT NULL,
  english_title VARCHAR(80) NOT NULL,
  description VARCHAR(255) NOT NULL,
  duration_hint VARCHAR(40) NULL,
  season VARCHAR(20) NULL,
  cover_image VARCHAR(500) NULL,
  place_ids VARCHAR(255) NOT NULL COMMENT '按游览顺序排列的地点 id，逗号分隔',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  UNIQUE KEY uk_official_routes_code(city_code, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 地点收藏（每个用户对每个地点最多收藏一次）
CREATE TABLE place_favorites (
  user_id BIGINT NOT NULL,
  place_id BIGINT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (user_id, place_id),
  CONSTRAINT fk_place_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_place_favorites_place FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 东京官方地点的编辑内容。封面只使用站内已有的图片，没有合适图片的地点保持 NULL，由前端显示文字封面。
UPDATE places SET description='东京最古老的寺院，香火与老街气息都在这里。', tagline='东京最古老的寺院，香火与老街气息都在这里。', recommend_reason='从雷门、仲见世一路走到本堂，是感受江户风情最直接的一条线。', stay_minutes=90, best_time='清晨 / 傍晚', tags='MUST,CULTURE,FREE,PHOTO,FIRST,WALK', editor_rank=1, cover_image='/images/asakusa.jpg' WHERE id=1;
UPDATE places SET description='挂着巨大红灯笼的浅草寺总门。', tagline='挂着巨大红灯笼的浅草寺总门。', recommend_reason='几乎每个人来东京都会在这里拍下第一张合影，清晨人少时最好拍。', stay_minutes=20, best_time='清晨', tags='PHOTO,FREE,FIRST,CULTURE', cover_image='/images/asakusa.jpg' WHERE id=2;
UPDATE places SET description='高 634 米的自立式电波塔，东京新的天际线地标。', tagline='高 634 米的电波塔，东京新的天际线地标。', recommend_reason='在展望台俯瞰整座城市，天气晴朗时可以远眺富士山。', stay_minutes=120, best_time='傍晚到夜晚', tags='NIGHT,PHOTO,RAIN', cover_image='/images/night.jpg' WHERE id=3;
UPDATE places SET description='通往浅草寺的参道商店街，全长约 250 米。', tagline='通往浅草寺的参道商店街，全长约 250 米。', recommend_reason='人形烧、仙贝和各式小玩意，边吃边逛就走到了本堂。', stay_minutes=40, best_time='上午', tags='WALK,FOOD,SHOP,FREE', cover_image='/images/nakamise.jpg' WHERE id=4;
UPDATE places SET description='电器、动漫与游戏文化聚集的街区。', tagline='电器、动漫与游戏文化聚集的街区。', recommend_reason='喜欢动漫和游戏可以在这里逛上一整天，周日中央通常有步行者天国。', stay_minutes=150, best_time='下午到晚上', tags='SHOP,WALK', cover_image='/images/akihabara.jpg' WHERE id=5;
UPDATE places SET description='拥有近 1300 年历史的神社，也被视为商业与 IT 的守护神。', tagline='近 1300 年历史的神社，也被视为 IT 的守护神。', recommend_reason='离秋叶原步行约 10 分钟，传统神社与动漫文化在这里奇妙地交汇。', stay_minutes=30, best_time='白天', tags='CULTURE,FREE' WHERE id=6;
UPDATE places SET description='秋叶原站旁的大型复合设施，餐厅与展示空间集中。', tagline='秋叶原站旁的复合设施，餐厅与展示空间集中。', recommend_reason='逛街累了可以在这里吃饭歇脚，下雨天也很方便。', stay_minutes=45, best_time='全天', tags='RAIN,FOOD', cover_image='/images/anime.jpg' WHERE id=7;
UPDATE places SET description='日本最早的公园之一，博物馆、动物园与不忍池都在园内。', tagline='日本最早的公园之一，博物馆与动物园都在园内。', recommend_reason='春天是赏樱名所，秋天的银杏与红叶同样好看，适合慢慢散步。', stay_minutes=120, best_time='春季 / 秋季', tags='NATURE,WALK,FREE,PHOTO,FIRST', cover_image='/images/ueno.jpg' WHERE id=8;
UPDATE places SET description='上野与御徒町之间的高架下商店街。', tagline='上野与御徒町之间的高架下商店街。', recommend_reason='干货、海鲜、零食与小酒馆挤在一起，热闹又有烟火气。', stay_minutes=60, best_time='傍晚', tags='FOOD,SHOP,WALK,FREE' WHERE id=9;
UPDATE places SET description='日本历史最悠久的博物馆，收藏大量国宝与重要文化财。', tagline='日本历史最悠久的博物馆，收藏大量国宝。', recommend_reason='想系统了解日本美术与历史，这里是最好的起点，雨天也很合适。', stay_minutes=150, best_time='上午', tags='CULTURE,RAIN' WHERE id=10;
UPDATE places SET description='1914 年落成的红砖丸之内站舍，已复原为创建时的模样。', tagline='1914 年落成的红砖站舍，已复原为创建时的模样。', recommend_reason='站前广场拍红砖站舍全景很出片，地下还有拉面街和伴手礼。', stay_minutes=45, best_time='傍晚点灯后', tags='PHOTO,RAIN,FOOD,FREE,FIRST', cover_image='/images/tokyo-station.jpg' WHERE id=11;
UPDATE places SET description='环绕皇居的开阔绿地，可以远眺二重桥。', tagline='环绕皇居的开阔绿地，可以远眺二重桥。', recommend_reason='从东京站步行即到，草坪与松林间是城市里难得的安静。', stay_minutes=60, best_time='上午', tags='NATURE,WALK,FREE' WHERE id=12;
UPDATE places SET description='东京站旁的林荫大道，两侧是精品店与露天咖啡。', tagline='东京站旁的林荫大道，精品店与露天咖啡林立。', recommend_reason='冬季有香槟金色的灯饰，平日午后散步最舒服。', stay_minutes=40, best_time='冬季夜晚', tags='WALK,SHOP,NIGHT,FREE,PHOTO' WHERE id=13;
UPDATE places SET description='东京最具代表性的高级商业街区。', tagline='东京最具代表性的高级商业街区。', recommend_reason='周末中央通会变成步行者天国，老铺与百货公司一次逛齐。', stay_minutes=180, best_time='周末下午', tags='MUST,SHOP,WALK,FOOD,FIRST', editor_rank=3, cover_image='/images/ginza.jpg' WHERE id=14;
UPDATE places SET description='银座规模最大的商业设施，屋顶有免费开放的庭园。', tagline='银座规模最大的商业设施，屋顶庭园免费开放。', recommend_reason='逛完品牌店可以上屋顶庭园吹风，馆内的茑屋书店也值得一逛。', stay_minutes=90, best_time='全天', tags='SHOP,RAIN' WHERE id=15;
UPDATE places SET description='专门上演歌舞伎的剧场，外观为桃山风格。', tagline='专门上演歌舞伎的剧场，外观为桃山风格。', recommend_reason='不看整场也可以买「一幕见」席位，体验一段传统表演。', stay_minutes=90, best_time='演出时段', tags='CULTURE,RAIN' WHERE id=16;
UPDATE places SET description='世界上最繁忙的十字路口之一。', tagline='世界上最繁忙的十字路口之一。', recommend_reason='绿灯亮起时人潮从四面八方同时涌出，是最有东京感的画面。', stay_minutes=20, best_time='傍晚到夜晚', tags='MUST,PHOTO,NIGHT,FREE,FIRST', editor_rank=5, cover_image='/images/night.jpg' WHERE id=17;
UPDATE places SET description='涩谷 Scramble Square 顶层的露天展望台。', tagline='涩谷 Scramble Square 顶层的露天展望台。', recommend_reason='日落时分从屋顶俯瞰涩谷十字路口，远处还能看到东京塔。', stay_minutes=60, best_time='日落前后', tags='NIGHT,PHOTO', cover_image='/images/shibuya.jpg' WHERE id=18;
UPDATE places SET description='涩谷站前的忠犬雕像，也是最有名的碰头地点。', tagline='涩谷站前的忠犬雕像，最有名的碰头地点。', recommend_reason='来涩谷的第一站，顺便听一听八公等待主人的故事。', stay_minutes=10, best_time='白天', tags='PHOTO,FREE,FIRST' WHERE id=19;
UPDATE places SET description='供奉明治天皇与昭宪皇太后的神社，被大片森林环绕。', tagline='被大片森林环绕的神社，原宿旁最安静的地方。', recommend_reason='走进参道的那一刻，城市的喧闹就消失了。清晨来最能感受这份安静。', stay_minutes=60, best_time='清晨', tags='MUST,CULTURE,NATURE,FREE,WALK', editor_rank=4 WHERE id=20;
UPDATE places SET description='原宿的年轻潮流街，可丽饼与杂货店林立。', tagline='原宿的年轻潮流街，可丽饼与杂货店林立。', recommend_reason='适合边走边吃，感受东京年轻人的流行文化。', stay_minutes=40, best_time='工作日下午', tags='FOOD,SHOP,WALK' WHERE id=21;
UPDATE places SET description='紧邻明治神宫的大型城市公园。', tagline='紧邻明治神宫的大型城市公园。', recommend_reason='周末常有市集与街头表演，秋天的银杏大道很美。', stay_minutes=60, best_time='秋季 / 周末', tags='NATURE,WALK,FREE' WHERE id=22;
UPDATE places SET description='融合日式、英式与法式庭园的国民公园。', tagline='融合日式、英式与法式庭园的国民公园。', recommend_reason='赏樱与红叶都是东京一流，门票不贵，却能换来一整个下午的安静。', stay_minutes=120, best_time='春季 / 秋季', tags='NATURE,PHOTO,WALK' WHERE id=23;
UPDATE places SET description='都厅第一本厅舍 45 层设有免费展望室。', tagline='45 层的免费展望室，俯瞰新宿高楼群。', recommend_reason='不花钱就能看东京夜景，晴天白天还能望见富士山。', stay_minutes=45, best_time='夜晚', tags='NIGHT,FREE,RAIN,PHOTO', cover_image='/images/odaiba.jpg' WHERE id=24;
UPDATE places SET description='新宿的不夜城，霓虹灯与小巷交织。', tagline='新宿的不夜城，霓虹灯与小巷交织。', recommend_reason='入夜后最有东京都市感的街区之一，建议结伴前往并留意街头揽客。', stay_minutes=60, best_time='夜晚', tags='NIGHT,FOOD', cover_image='/images/harajuku.jpg' WHERE id=25;
UPDATE places SET description='高 333 米的红白色铁塔，东京最经典的地标。', tagline='高 333 米的红白铁塔，东京最经典的地标。', recommend_reason='从芝公园或增上寺方向拍东京塔最好看，夜晚点灯后更有氛围。', stay_minutes=90, best_time='傍晚到夜晚', tags='MUST,NIGHT,PHOTO,FIRST', editor_rank=2, cover_image='/images/cover.jpg' WHERE id=26;
UPDATE places SET description='2023 年开业的城市复合街区，拥有大片绿地与艺术空间。', tagline='2023 年开业的城市街区，绿地与艺术空间兼具。', recommend_reason='建筑与景观都很有设计感，下雨天或想看当代艺术时很合适。', stay_minutes=90, best_time='全天', tags='RAIN,SHOP,CULTURE' WHERE id=27;
UPDATE places SET description='东京湾旁的人工海滨，可以眺望彩虹大桥。', tagline='东京湾旁的人工海滨，可以眺望彩虹大桥。', recommend_reason='傍晚沿着海边散步，等天色暗下来看大桥与城市一起点灯。', stay_minutes=60, best_time='日落前后', tags='NIGHT,WALK,NATURE,FREE,PHOTO', cover_image='/images/footer.jpg' WHERE id=28;
UPDATE places SET description='连接芝浦与台场的悬索桥。', tagline='连接芝浦与台场、横跨东京湾的悬索桥。', recommend_reason='可以沿桥上的步道走过东京湾，夜景是湾岸最具代表性的画面。', stay_minutes=60, best_time='夜晚', tags='NIGHT,PHOTO,FREE', cover_image='/images/footer.jpg' WHERE id=29;
UPDATE places SET description='取代筑地的东京中央批发市场。', tagline='取代筑地的东京中央批发市场。', recommend_reason='清晨参观金枪鱼拍卖，再在场内吃一顿新鲜的海鲜早餐。', stay_minutes=90, best_time='清晨', tags='FOOD,RAIN,FREE' WHERE id=30;

INSERT INTO official_routes(city_code,code,title,english_title,description,duration_hint,season,cover_image,place_ids,sort_order,created_at) VALUES
('TOKYO','ASAKUSA_WALK','浅草老街散步','Asakusa Old Town','从雷门出发，穿过仲见世走到浅草寺，最后远眺晴空塔。','半天',NULL,'/images/nakamise.jpg','2,4,1,3',1,UTC_TIMESTAMP()),
('TOKYO','AUTUMN_TOKYO','秋日东京散步','Autumn in Tokyo','银杏与红叶最好看的几座公园与神社，适合慢慢走一整天。','一天','秋','/images/ueno.jpg','8,23,20,22',2,UTC_TIMESTAMP()),
('TOKYO','TOKYO_NIGHT','东京夜景精选','Tokyo at Night','从免费展望室到东京湾，收集东京最好看的几个夜晚。','两个晚上',NULL,'/images/odaiba.jpg','24,18,26,29,28',3,UTC_TIMESTAMP()),
('TOKYO','AKIBA_TOUR','秋叶原巡礼','Akihabara Culture','电器街、动漫店与千年神社，一次感受新旧交织的东京。','半天',NULL,'/images/akihabara.jpg','5,7,6',4,UTC_TIMESTAMP()),
('TOKYO','UENO_CULTURE','上野文化一日游','Ueno Culture Day','博物馆、公园与热闹的阿美横丁，一天走完上野。','一天',NULL,'/images/panda.jpg','10,8,9',5,UTC_TIMESTAMP()),
('TOKYO','GINZA_MARUNOUCHI','银座丸之内漫步','Ginza & Marunouchi','从红砖东京站出发，沿林荫大道走到银座的老铺与剧场。','半天',NULL,'/images/tokyo-station.jpg','11,13,14,15,16',6,UTC_TIMESTAMP());
