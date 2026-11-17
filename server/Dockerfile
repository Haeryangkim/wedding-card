# syntax=docker/dockerfile:1
# 청첩장 플랫폼 API: 외부 의존성이 없으므로 빌드 단계 없이 소스만 복사한다.
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/guestbook.db \
    UPLOAD_DIR=/data/uploads

# 소스 복사 (node:http + node:sqlite 만 사용, npm install 불필요)
COPY package.json ./
COPY src ./src

# sqlite 데이터 + 업로드 사진 디렉터리를 비루트 사용자(node) 소유로 준비
RUN mkdir -p /data/uploads && chown -R node:node /data /app
VOLUME ["/data"]

USER node
EXPOSE 8787

# 컨테이너 자체 헬스체크 (Node 24 전역 fetch 사용)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
