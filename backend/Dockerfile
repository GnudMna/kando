# =============================================================================
# バックエンド単体 Dockerfile
# 本番環境でも使えるように、ビルドとランタイムを分離したマルチステージ構成にしています
# =============================================================================

# ---- ビルドステージ ----
FROM node:24-alpine AS backend-build
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
COPY packages/types ./packages/types
WORKDIR /app/backend
RUN npm ci
COPY backend .
RUN npm run build

# ---- 本番ランタイムステージ ----
FROM node:24-alpine AS backend-runtime
WORKDIR /app
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY backend/package.json backend/package-lock.json ./backend/
COPY packages/types ./packages/types
WORKDIR /app/backend
RUN npm ci --omit=dev

EXPOSE 3001
CMD ["sh", "-c", "npm run migrate && npm start"]
