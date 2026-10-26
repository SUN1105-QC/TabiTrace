# TabiTrace API（Spring Boot）。构建上下文是仓库根目录：docker build -f backend/api/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY backend/pom.xml backend/pom.xml
COPY backend/api/pom.xml backend/api/pom.xml
COPY backend/video-worker/pom.xml backend/video-worker/pom.xml
# 先只下载依赖，源码变化时可以复用这一层缓存
RUN mvn -q -B -f backend/pom.xml -pl api -am dependency:go-offline -DskipTests || true
COPY backend/api/src backend/api/src
RUN mvn -q -B -f backend/pom.xml -pl api -am package -DskipTests

FROM eclipse-temurin:21-jre
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system tabitrace && useradd --system --gid tabitrace --uid 10001 tabitrace
WORKDIR /app
COPY --from=build /src/backend/api/target/tabitrace-api-*.jar /app/app.jar
USER tabitrace
# 容器内存按比例分配堆；时区统一为 UTC（业务时间都按用户时区换算，不依赖服务器本地时间）
# SERVER_ADDRESS=:: 同时监听 IPv4 与 IPv6（Railway 私网可能只有 IPv6）
ENV SPRING_PROFILES_ACTIVE=prod \
    SERVER_ADDRESS=:: \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -Duser.timezone=UTC"
EXPOSE 8080
# 监听端口来自平台注入的 PORT（application.yml: server.port=${PORT:...}），数据库迁移（Flyway）在启动时执行，失败则启动失败
CMD ["java", "-jar", "/app/app.jar"]
