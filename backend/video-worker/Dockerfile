# TabiTrace 视频生成 Worker（FFmpeg + 中文字体）。构建上下文是仓库根目录：docker build -f backend/video-worker/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY backend/pom.xml backend/pom.xml
COPY backend/api/pom.xml backend/api/pom.xml
COPY backend/video-worker/pom.xml backend/video-worker/pom.xml
RUN mvn -q -B -f backend/pom.xml -pl video-worker -am dependency:go-offline -DskipTests || true
COPY backend/video-worker/src backend/video-worker/src
RUN mvn -q -B -f backend/pom.xml -pl video-worker -am package -DskipTests

FROM eclipse-temurin:21-jre
# ffmpeg：合成视频；fonts-noto-cjk：分镜里的中文 / 日文文字（没有它会显示成方块）
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-noto-cjk fontconfig \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system tabitrace && useradd --system --gid tabitrace --uid 10001 tabitrace \
 && mkdir -p /tmp/tabitrace-video && chown tabitrace:tabitrace /tmp/tabitrace-video
WORKDIR /app
COPY --from=build /src/backend/video-worker/target/tabitrace-video-worker-*.jar /app/worker.jar
USER tabitrace
ENV SPRING_PROFILES_ACTIVE=prod \
    FFMPEG_BINARY=/usr/bin/ffmpeg \
    WORKER_MUSIC_CACHE_DIR=/tmp/tabitrace-music \
    VIDEO_WORK_DIR=/tmp/tabitrace-video \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -Duser.timezone=UTC -Djava.awt.headless=true"
CMD ["java", "-jar", "/app/worker.jar"]
