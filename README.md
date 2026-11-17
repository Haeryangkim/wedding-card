# 💌 모바일 청첩장 + 픽셀 방명록

나만의 모바일 청첩장입니다. 기본적인 청첩장 기능에 더해, 하객이 **자신만의 픽셀 캐릭터**를
만들어 예식장 화면을 돌아다니게 하는 **픽셀 방명록**을 담았습니다.

- 📱 모바일 청첩장 기본 기능 (인사말·예식 일정·오시는 길·갤러리 등)
- 📅 일정 등록 → 캘린더 앱 연동 (`wedding.ics` + Google Calendar)
- 🧭 카카오내비 / 네이버지도 / 티맵 길안내 바로가기
- 🎮 캐릭터 픽셀 방명록 — 하객이 캐릭터를 만들고 메시지를 남기면 예식장 맵에서 돌아다님
  (아이디어 참고만 하고 **코드·에셋은 모두 직접 제작**했습니다)

> 결과물은 두 가지 방식으로 배포합니다.
> 1. **GitHub Pages** (정적 호스팅, 무료) — 방명록은 백엔드가 없으면 **데모 모드**로 동작
> 2. **Docker** (nginx + API) — 방명록 데이터가 실제로 저장되는 자체 호스팅

---

## 📂 프로젝트 구조

```
wedding-card/
├─ web/                     # 청첩장 프론트엔드 (Vite + React + TypeScript)
│  ├─ src/
│  │  ├─ config/wedding.ts  # ← 청첩장 내용(신랑·신부·일정·장소 등) 전부 여기서 수정
│  │  ├─ guestbook/         # 픽셀 방명록 (캐릭터 생성·맵·저장소)
│  │  ├─ lib/               # 길안내·캘린더·ics 유틸
│  │  └─ styles/            # 디자인 토큰·폰트
│  ├─ public/               # ← 사진 등 정적 파일을 여기에 둠
│  ├─ Dockerfile            # 웹 이미지 (빌드 → nginx)
│  └─ nginx.conf            # SPA 서빙 + /api 프록시(SSE 지원)
├─ server/                  # 방명록 API (Node 24, 외부 의존성 0개)
│  ├─ src/                  # node:http + node:sqlite
│  ├─ test/                 # node:test 통합 테스트
│  └─ Dockerfile            # API 이미지 (비루트, /data 볼륨, 헬스체크)
├─ docker-compose.yml       # web + api 한 번에 (자체 호스팅용)
├─ .env.example             # compose 환경변수 예시
└─ .github/workflows/       # ci.yml(검증) · deploy.yml(Pages 배포)
```

---

## 🚀 로컬 개발

### 1) 웹 (청첩장)

```bash
cd web
npm install
npm run dev            # http://localhost:5173
```

### 2) 방명록 API (선택)

방명록을 실제 저장소와 함께 돌려보려면 API 서버를 같이 띄웁니다.
`web` 개발 서버는 `/api` 요청을 `http://localhost:8787` 로 프록시합니다.

```bash
cd server
npm start              # http://localhost:8787  (sqlite: ./data/guestbook.db)
```

그리고 웹을 API 모드로 실행하려면 `web/.env.local` 에 아래를 추가합니다.

```
VITE_API_URL=/
```

> API 서버 없이 `npm run dev` 만 하면 방명록은 **로컬 데모 모드**(localStorage + 샘플 하객)로 동작합니다.

### 서버 테스트

```bash
cd server
npm test               # node --test (외부 의존성 없음)
```

> `node:sqlite` 는 아직 실험적 기능이라 실행 시 경고가 뜹니다. 스크립트에서
> `--disable-warning=ExperimentalWarning` 로 숨겨 두었고, 플래그 없이도 Node 24 에서 정상 동작합니다.

---

## ✏️ 내용 수정하기

- **청첩장 문구·일정·장소·계좌 등**: `web/src/config/wedding.ts` 한 파일에서 모두 수정합니다.
- **사진**: `web/public/` 에 이미지를 넣고 `wedding.ts` 에서 파일명을 가리킵니다.
  (경로는 항상 `BASE_URL` 기준입니다. 루트 절대경로 `"/photo.png"` 대신 `import` 하거나 `public` 에 두세요.)
- **지도 좌표/주소**: `wedding.ts` 의 장소 정보(위도·경도·장소명)를 채우면 길안내 버튼이 연결됩니다.

---

## ⚙️ 환경변수

### 웹 빌드 (Vite, 빌드 시점에 주입)

| 변수 | 설명 | 기본값 |
|---|---|---|
| `VITE_BASE` | 서빙 하위 경로. 자체 도메인/도커는 `/`, GitHub Pages 프로젝트 페이지는 `/<repo>/` | `/` |
| `VITE_SITE_URL` | 배포된 청첩장의 절대 URL(OG 미리보기·캘린더 링크). 예 `https://user.github.io/wedding-card/` | (빈 값) |
| `VITE_API_URL` | 방명록 API 주소. `/` = 같은 오리진(`/api`), **빈 값 = 데모 모드**, 그 외 = 해당 서버 | (빈 값) |

### 방명록 API (서버/도커)

| 변수 | 설명 | 기본값 |
|---|---|---|
| `PORT` | API 포트 | `8787` |
| `DB_PATH` | sqlite 파일 경로(폴더 자동 생성) | `./data/guestbook.db` |
| `CORS_ORIGIN` | 허용 오리진(쉼표 구분, `*` 가능). 비우면 같은 오리진만 | (빈 값) |
| `ADMIN_TOKEN` | 설정 시 `Authorization: Bearer <토큰>` 으로 비번 없이 삭제 | (없음) |
| `MAX_GUESTS` | 최대 방명록 수(초과 시 409) | `1000` |
| `TRUST_PROXY` | nginx 뒤에서 `X-Forwarded-For` 로 IP 판별(레이트리밋용) | `0` |

### docker compose

| 변수 | 설명 | 기본값 |
|---|---|---|
| `WEB_PORT` | 웹을 노출할 호스트 포트 | `8080` |

---

## 🌐 배포 1 — GitHub Pages (정적)

`main` 브랜치에 push 하면 `.github/workflows/deploy.yml` 이 자동으로 빌드·배포합니다.

- 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 설정
- 배포 주소: `https://<owner>.github.io/<repo>/`
  (이 저장소 기준: `https://haeryangkim.github.io/wedding-card/`)

> ⚠️ **GitHub Pages 는 정적 호스팅이라 방명록 API 를 실행할 수 없습니다.**
> 저장소 변수 `VITE_API_URL` 이 비어 있으면 방명록은 **데모 모드**(각자 브라우저에만 저장, 공유 안 됨)로 동작합니다.
> 하객들이 **함께** 보는 방명록을 원하면, 아래처럼 API 를 따로 호스팅하고 연결해야 합니다.

### Pages 방명록을 실데이터로 연결하기

1. 아무 서버(또는 Docker, 아래 참고)에 **방명록 API 를 공개 주소로 띄웁니다.**
   그 서버의 `CORS_ORIGIN` 에 Pages 주소를 넣습니다. 예:
   ```
   CORS_ORIGIN=https://haeryangkim.github.io
   ```
2. GitHub 저장소 **Settings → Secrets and variables → Actions → Variables** 에
   **`VITE_API_URL`** 변수를 추가하고 API 의 공개 주소를 넣습니다. 예: `https://api.example.com`
3. 다시 배포(push 또는 **Actions → Deploy → Run workflow**)하면 방명록이 실데이터로 연결됩니다.

---

## 🐳 배포 2 — Docker 자체 호스팅

웹(nginx)이 청첩장을 서빙하고 `/api` 요청을 API 컨테이너로 프록시합니다.
방명록 데이터는 named volume(`guestbook-data`)의 sqlite 에 저장됩니다.

```bash
cp .env.example .env     # 필요시 값 수정 (ADMIN_TOKEN 등)
docker compose up -d --build
# → http://localhost:8080
```

- 이 구성에서는 웹과 API 가 **같은 오리진**(nginx 프록시)이라 `CORS_ORIGIN` 없이도 동작합니다.
- 방명록 삭제를 관리자가 직접 하려면 `.env` 에 `ADMIN_TOKEN` 을 설정하세요.
- 중지: `docker compose down` / 데이터까지 삭제: `docker compose down -v`

### 운영 팁

- 실제 도메인 + HTTPS 는 앞단에 리버스 프록시(예: Caddy, Traefik, Cloudflare Tunnel)를 두는 것을 권장합니다.
- 절대 URL 미리보기(카카오톡 OG)가 필요하면 빌드 시 `VITE_SITE_URL` 을 실제 도메인으로 설정하세요.

---

## 🔑 참고 — 카카오내비 JS 키 (선택)

카카오**내비** 길안내는 공식적으로 JavaScript SDK + 도메인 등록이 필요합니다.
키가 없어도 카카오맵/네이버지도/티맵 길안내는 동작하며, 카카오내비만 키가 필요합니다.
키를 발급(카카오 developers)받아 사이트 도메인을 등록한 뒤 `web/src/config/wedding.ts` 의
해당 항목에 넣으면 됩니다. (프론트엔드 영역)

---

## ✅ CI

`.github/workflows/ci.yml` 이 push/PR 마다 다음을 검증합니다.

- **web**: 타입체크(`tsc -b --noEmit`) · 테스트(vitest) · 빌드
- **server**: `node:test` 통합 테스트
- **docker**: 이미지 빌드 → `docker compose up` → nginx 를 통해 `/`, `/wedding.ics`,
  `/api/health`, 방명록 작성·조회·삭제까지 실제로 스모크 테스트

---

made with ❤️
