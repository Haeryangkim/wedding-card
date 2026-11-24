# syntax=docker/dockerfile:1

# ---------- build stage ----------
FROM node:24-alpine AS build
WORKDIR /app

# 빌드 타임에 주입되는 Vite 환경변수
ARG VITE_BASE=/
ARG VITE_SITE_URL=
ARG VITE_API_URL=/
# "1" 이면 비공개 시험용 그림체(msref · acref)를 켠다. 그 그림 파일은 저장소에 없으므로
# 빌드 컨텍스트(src/guestbook/styles/{msref,acref}/assets)에 직접 만들어 둔 경우에만 실제로 나타난다.
ARG VITE_REF_STYLES=
ENV VITE_BASE=$VITE_BASE \
    VITE_SITE_URL=$VITE_SITE_URL \
    VITE_API_URL=$VITE_API_URL \
    VITE_REF_STYLES=$VITE_REF_STYLES

# 의존성 설치 (lockfile 기준 재현 가능 빌드)
COPY package.json package-lock.json ./
RUN npm ci

# 소스 복사 후 정적 빌드 (dist/ 에 wedding.ics 도 함께 생성됨)
COPY . .
RUN npm run build

# ---------- serve stage ----------
FROM nginx:alpine AS runtime

# 기본 설정 제거 후 우리 설정만 사용
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# nginx:alpine 기본 CMD(nginx -g 'daemon off;') 사용
