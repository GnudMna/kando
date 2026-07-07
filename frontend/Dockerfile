# =============================================================================
# フロントエンド専用の Dockerfile
# 本番用のマルチステージビルドで、Vite ビルド成果物を nginx で配信します
# =============================================================================

# ---- ステージ1: ビルド ----
# package*.json を先にコピーして、ソース変更時に npm ci キャッシュを再利用する
FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY packages/types ./packages/types
RUN npm ci --workspace frontend
COPY frontend ./frontend
# @kando/types の dist は .dockerignore で除外されるため、Vite ビルド前に生成する
RUN npm --workspace @kando/types run build && npm --workspace frontend run build

# ---- ステージ2: 配信 ----
# ビルド成果物のみを軽量な nginx イメージにコピーして静的ファイルを配信する
FROM nginx:alpine
# カスタム nginx 設定を配置する
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
# ビルド済み静的ファイルを nginx の配信ディレクトリにコピーする
COPY --from=build /app/frontend/dist /usr/share/nginx/html
# HTTP ポートを公開する
EXPOSE 80
# nginx をフォアグラウンドで起動する（デーモンモードを無効化）
CMD ["nginx", "-g", "daemon off;"]
