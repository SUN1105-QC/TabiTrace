CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  locale VARCHAR(20) NOT NULL DEFAULT 'zh-CN',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Tokyo',
  default_visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE refresh_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  jti VARCHAR(100) NOT NULL UNIQUE,
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user_active(user_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE official_cities (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  country_code VARCHAR(10) NOT NULL,
  description TEXT NULL,
  cover_image VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  theme VARCHAR(50) NULL,
  created_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE places (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  country_code VARCHAR(10) NULL,
  country VARCHAR(100) NULL,
  city VARCHAR(100) NULL,
  area VARCHAR(100) NULL,
  address VARCHAR(500) NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  category VARCHAR(50) NULL,
  source_type VARCHAR(20) NOT NULL,
  description TEXT NULL,
  cover_image VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  INDEX idx_places_search(name, city, area),
  INDEX idx_places_official(source_type, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE trips (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  destination_name VARCHAR(200) NOT NULL,
  country_code VARCHAR(10) NULL,
  city VARCHAR(100) NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  people_count INT NOT NULL DEFAULT 1,
  cover_image VARCHAR(500) NULL,
  plan_type VARCHAR(20) NOT NULL DEFAULT 'FREE',
  status VARCHAR(30) NOT NULL DEFAULT 'PLANNING',
  visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_trips_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_trips_user(user_id, start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE trip_places (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  place_id BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_trip_places_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_places_place FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
  UNIQUE KEY uk_trip_place(trip_id, place_id),
  INDEX idx_trip_places_order(trip_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE itinerary_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  place_id BIGINT NULL,
  custom_place_name VARCHAR(200) NULL,
  area VARCHAR(100) NULL,
  planned_date DATE NOT NULL,
  planned_time TIME NULL,
  note TEXT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_itinerary_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_itinerary_place FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE SET NULL,
  INDEX idx_itinerary_trip_date(trip_id, planned_date, planned_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE checkins (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  place_id BIGINT NULL,
  user_id BIGINT NOT NULL,
  itinerary_item_id BIGINT NULL,
  checkin_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  checkin_time DATETIME(6) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  place_name_snapshot VARCHAR(200) NOT NULL,
  area_snapshot VARCHAR(100) NULL,
  note TEXT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_checkins_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkins_place FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE SET NULL,
  CONSTRAINT fk_checkins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkins_itinerary FOREIGN KEY (itinerary_item_id) REFERENCES itinerary_items(id) ON DELETE SET NULL,
  INDEX idx_checkins_trip_time(trip_id, checkin_time),
  INDEX idx_checkins_place(trip_id, place_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE photos (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  trip_id BIGINT NOT NULL,
  checkin_id BIGINT NULL,
  storage_key VARCHAR(500) NOT NULL,
  image_url VARCHAR(1000) NOT NULL,
  width INT NULL,
  height INT NULL,
  file_size BIGINT NULL,
  mime_type VARCHAR(100) NOT NULL,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  captured_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_photos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_photos_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_photos_checkin FOREIGN KEY (checkin_id) REFERENCES checkins(id) ON DELETE SET NULL,
  INDEX idx_photos_trip(trip_id, captured_at),
  INDEX idx_photos_featured(trip_id, is_featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE achievements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  type VARCHAR(20) NOT NULL,
  city_code VARCHAR(50) NULL,
  icon_url VARCHAR(500) NULL,
  condition_type VARCHAR(50) NOT NULL,
  condition_value INT NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_achievements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  trip_id BIGINT NULL,
  achievement_id BIGINT NOT NULL,
  earned_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_user_ach_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_ach_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_ach_achievement FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_trip_achievement(user_id, trip_id, achievement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  trip_id BIGINT NOT NULL,
  provider VARCHAR(30) NOT NULL,
  provider_payment_id VARCHAR(255) NULL,
  amount INT NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(30) NOT NULL,
  paid_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  INDEX idx_payments_trip(trip_id, id),
  INDEX idx_payments_provider(provider_payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE share_links (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  share_token VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  view_count BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  CONSTRAINT fk_share_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  INDEX idx_share_trip_status(trip_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE video_projects (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  trip_id BIGINT NOT NULL,
  template_code VARCHAR(50) NOT NULL,
  aspect_ratio VARCHAR(20) NOT NULL,
  duration INT NOT NULL,
  music_code VARCHAR(50) NOT NULL,
  show_text BOOLEAN NOT NULL DEFAULT TRUE,
  show_map BOOLEAN NOT NULL DEFAULT TRUE,
  show_achievements BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  progress INT NOT NULL DEFAULT 0,
  output_key VARCHAR(500) NULL,
  output_url VARCHAR(1000) NULL,
  error_message TEXT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  completed_at DATETIME(6) NULL,
  CONSTRAINT fk_video_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_video_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  INDEX idx_video_trip(trip_id, id),
  INDEX idx_video_queue(status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE video_project_photos (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  video_project_id BIGINT NOT NULL,
  photo_id BIGINT NOT NULL,
  sort_order INT NOT NULL,
  duration DECIMAL(5,2) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_video_photo_project FOREIGN KEY (video_project_id) REFERENCES video_projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_video_photo_photo FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  UNIQUE KEY uk_video_photo(video_project_id, photo_id),
  INDEX idx_video_photo_order(video_project_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
