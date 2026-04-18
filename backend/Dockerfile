# =============================================================================
# バックエンド単体の開発・検証用 Dockerfile
# 本番環境ではルートの Dockerfile（マルチステージビルド）を使用してください
# =============================================================================
FROM node:24-alpine

WORKDIR /app
# package*.json を先にコピーし、ソースコード変更時に npm ci キャッシュを再利用する
COPY package*.json ./
RUN npm ci
COPY . .
# TypeScript を JavaScript にコンパイルして dist/ に出力する
RUN npm run build
# バックエンド API のポートを公開する
EXPOSE 3001
# マイグレーション実行後にコンパイル済み JS サーバーを起動する
CMD ["sh", "-c", "npm run migrate && npm start"]
