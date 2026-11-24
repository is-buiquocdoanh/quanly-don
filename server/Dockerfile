FROM node:24-alpine

ENV NODE_ENV=production \
    TZ=Asia/Ho_Chi_Minh \
    DATA_DIR=/data \
    PORT=3000

RUN apk add --no-cache tzdata

WORKDIR /app
# Thư viện ngoài duy nhất: @anthropic-ai/sdk (AI đọc đơn)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY public ./public
COPY site ./site

RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "src/server.js"]
