# =============================================================================
# マルチステージビルド構成
#   ステージ1: frontend-build  - React アプリを Vite でビルドし静的ファイルを生成
#   ステージ2: backend-build   - TypeScript をコンパイルして JS 成果物を生成
#   ステージ3: backend-deps    - 本番用依存関係のみインストール（devDependencies を除外）
#   ステージ4: 本番イメージ     - nginx + Node.js + Supervisor で両サービスを同時起動
# =============================================================================

# ---- ステージ1: フロントエンドのビルド ----
# package*.json を先にコピーすることで、ソース変更時に npm install キャッシュを再利用できる
FROM node:24-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
# Vite で本番用静的ファイルを /app/dist に出力する
RUN npm run build

# ---- ステージ2: バックエンドのビルド ----
# package*.json を先にコピーして npm install のキャッシュを最大限活用する
FROM node:24-alpine AS backend-build
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
# TypeScript を JavaScript にコンパイルして /app/dist に出力する
RUN npm run build

# ---- ステージ3: バックエンド本番依存関係のインストール ----
# devDependencies を除いた本番用 node_modules のみをこのステージで作成し、
# 最終イメージへコピーすることでイメージサイズを削減する
FROM node:24-alpine AS backend-deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev

# ---- ステージ4: 本番イメージ ----
# 軽量な node:24-alpine をベースに nginx と Supervisor を追加し、
# フロントエンド (nginx:80) とバックエンド (Node.js:3001) を同一コンテナで稼働させる
FROM node:24-alpine

# nginx と Supervisor をインストールし、nginx の静的ファイル配信ディレクトリを作成する
RUN apk add --no-cache nginx supervisor && \
    mkdir -p /usr/share/nginx/html /run/nginx

# nginx の設定
# デフォルト設定を削除してカスタム設定を配置し、ビルド済み静的ファイルを配信ディレクトリに配置する
RUN rm -f /etc/nginx/http.d/default.conf
COPY frontend/nginx.conf /etc/nginx/http.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# バックエンドのセットアップ
# ビルド済み JS 成果物と本番用 node_modules のみをコピーしてイメージを軽量に保つ
WORKDIR /app/backend
COPY --from=backend-build /app/dist ./dist
COPY backend/package*.json ./
COPY --from=backend-deps /app/node_modules ./node_modules

# Supervisor の設定
# supervisord.conf で nginx とバックエンドプロセスを管理し、どちらかが落ちても再起動する
COPY supervisord.conf /etc/supervisord.conf

# nginx (80) とバックエンド API (3001) のポートを公開する
EXPOSE 80 3001

# Supervisor をフォアグラウンドで起動して nginx とバックエンドを同時に管理する
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
