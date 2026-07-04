# =============================================================================
# バックエンド単体 Dockerfile
# 本番環境でも使えるように、ビルドとランタイムを分離したマルチステージ構成にしています
# =============================================================================

# ---- ビルドステージ ----
FROM node:24-alpine AS backend-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY packages/types ./packages/types
RUN npm ci --workspace backend
COPY backend ./backend
RUN npm --workspace backend run build

# ---- 本番ランタイムステージ ----
FROM node:24-alpine AS backend-runtime
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --omit=dev --workspace backend
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY backend/migrations ./backend/migrations

EXPOSE 3001
CMD ["sh", "-c", "npm --workspace backend run migrate && npm --workspace backend run start"]
