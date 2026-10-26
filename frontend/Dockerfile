FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
ARG APP_URL
ARG NEXT_PUBLIC_MAP_STYLE_URL=""
ARG NEXT_PUBLIC_MAP_TILE_URL=""
ARG NEXT_PUBLIC_MAP_ATTRIBUTION=""
ARG NEXT_PUBLIC_MAP_API_KEY=""
ENV APP_URL=${APP_URL} \
    API_INTERNAL_URL=http://api:8080 \
    NEXT_PUBLIC_MAP_STYLE_URL=${NEXT_PUBLIC_MAP_STYLE_URL} \
    NEXT_PUBLIC_MAP_TILE_URL=${NEXT_PUBLIC_MAP_TILE_URL} \
    NEXT_PUBLIC_MAP_ATTRIBUTION=${NEXT_PUBLIC_MAP_ATTRIBUTION} \
    NEXT_PUBLIC_MAP_API_KEY=${NEXT_PUBLIC_MAP_API_KEY} \
    NEXT_TELEMETRY_DISABLED=1
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
