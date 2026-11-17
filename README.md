# 💌 모바일 청첩장 만들기 + 픽셀 방명록

누구나 자기만의 **모바일 청첩장**을 만들어 `/w/<주소>` 로 공유할 수 있는 자체 호스팅 서비스입니다.
청첩장 기본 기능에 더해, 하객이 **자신만의 픽셀 캐릭터**를 만들어 예식장 화면을 돌아다니게 하는
**픽셀 방명록**을 담았습니다.

- 🧑‍🤝‍🧑 **여러 청첩장** — 계정 없이 주소(`/w/<주소>`)와 **관리 비밀번호**만 정하면 바로 만들어집니다
- 📱 청첩장 기본 기능 (인사말·예식 일정·오시는 길·갤러리·계좌 안내)
- 🖼️ 사진 업로드 (표지·갤러리, 서버에 저장)
- 🔎 장소 검색 → 지도 좌표 자동 입력 (OpenStreetMap, 서버가 대신 조회)
- 💬 카카오톡 링크 미리보기 — 청첩장마다 제목·설명·표지 사진이 다르게 표시됩니다
- 📅 일정 등록 → 캘린더 앱 연동 (청첩장별 `wedding.ics` + Google Calendar)
- 🧭 카카오내비 / 네이버지도 / 티맵 길안내 바로가기
- 🎮 캐릭터 픽셀 방명록 — 청첩장마다 따로 저장되고 실시간으로 갱신됩니다
  (아이디어 참고만 하고 **코드·에셋은 모두 직접 제작**했습니다)

> 배포 방식은 두 가지입니다.
> 1. **Docker 자체 호스팅** (nginx + API) — 청첩장 만들기까지 되는 **완전한 서비스**
> 2. **GitHub Pages** (정적 호스팅, 무료) — 서버가 없으므로 **데모 청첩장(`/w/demo`, 김신랑 ♥ 박신부)만** 동작

---

## 🧭 서비스 구조

| 주소 | 내용 |
|---|---|
| `/` | 서비스 소개(랜딩) — "청첩장 만들기", "데모 보기" |
| `/new` | 새 청첩장 만들기 (주소·관리 비밀번호·내용 입력) |
| `/w/demo` | 데모 청첩장 (프론트에 번들된 예시. 방명록은 그 기기에만 저장) |
| `/w/<주소>` | 청첩장 |
| `/w/<주소>/edit` | 관리 화면 — 관리 비밀번호로 로그인해 내용·사진 수정, 방명록 글 삭제, 청첩장 삭제 |
| `/w/<주소>/wedding.ics` | 캘린더 파일 |

- **계정이 없습니다.** 청첩장을 만들 때 정한 관리 비밀번호가 유일한 열쇠입니다(서버에는 scrypt 해시만 저장).
  비밀번호를 잊으면 복구할 수 없고, 운영자가 `ADMIN_TOKEN` 으로 삭제해 줄 수만 있습니다.
- **주소 규칙**: 영문 소문자·숫자·하이픈 3~30자, 하이픈으로 시작/끝 불가. `demo`, `new`, `api` 등 일부 이름은 예약어입니다.
- 로그인하면 12시간짜리 토큰이 발급됩니다. 비밀번호를 바꾸면 이전 토큰은 모두 무효가 됩니다.
- `/w/<주소>` 는 서버가 `index.html` 에 그 청첩장의 `<title>`·OG 태그를 넣어 응답합니다
  (카카오톡 등 스크레이퍼는 JS 를 실행하지 않기 때문). 검색엔진에는 색인되지 않도록 `noindex` 를 붙입니다.

---

## 📂 프로젝트 구조

```
wedding-card/
├─ web/                     # 프론트엔드 (Vite + React + TypeScript)
│  ├─ src/
│  │  ├─ platform/          # 플랫폼 계약(contract.ts)·API 클라이언트·만들기/관리 화면
│  │  ├─ config/wedding.ts  # WeddingConfig 타입 + 데모 청첩장(김신랑 ♥ 박신부) 내용
│  │  ├─ guestbook/         # 픽셀 방명록 (캐릭터 생성·맵·저장소)
│  │  ├─ lib/               # 길안내·캘린더·ics 유틸
│  │  └─ styles/            # 디자인 토큰·폰트
│  ├─ public/               # 정적 파일 (기본 미리보기 이미지 og.png 등)
│  ├─ Dockerfile            # 웹 이미지 (빌드 → nginx)
│  └─ nginx.conf            # SPA 서빙 + /api · /uploads · /w 프록시(SSE 지원)
├─ server/                  # 플랫폼 API (Node 24, 외부 의존성 0개)
│  ├─ src/                  # node:http + node:sqlite
│  ├─ test/                 # node:test 통합 테스트
│  └─ Dockerfile            # API 이미지 (비루트, /data 볼륨, 헬스체크)
├─ docker-compose.yml       # web + api 한 번에 (자체 호스팅용)
├─ .env.example             # compose 환경변수 예시
└─ .github/workflows/       # ci.yml(검증) · deploy.yml(Pages 배포)
```

프론트와 서버가 공유하는 규칙(라우트, REST 형태, 상한값)은 `web/src/platform/contract.ts` 가 기준 문서입니다.
서버는 JS 라 이 파일을 import 하지 않고 같은 규칙을 `server/src/wedding-config.js` 등에 그대로 구현합니다 —
**바꿀 때는 양쪽을 함께** 고칩니다.

---

## 🐳 호스팅 — Docker compose

```bash
cp .env.example .env     # PUBLIC_ORIGIN 등 값 수정
docker compose up -d --build
# → http://localhost:8080
```

- `web`(nginx) 이 SPA 를 서빙하고 `/api/`, `/uploads/`, `/w/` 요청을 `api` 컨테이너로 프록시합니다.
- `api` 는 청첩장·방명록(sqlite)과 업로드 사진을 **하나의 named volume**(`guestbook-data` → `/data`)에 저장합니다.
- 웹과 API 가 **같은 오리진**이라 `CORS_ORIGIN` 없이 동작합니다.
- 중지: `docker compose down` / **데이터까지 삭제**: `docker compose down -v`

### 운영 체크리스트

- **`PUBLIC_ORIGIN`** 을 실제 주소(예: `https://our.wedding`)로 설정하세요. 카카오톡 미리보기의 `og:url`/`og:image` 와
  캘린더 링크가 이 값으로 만들어집니다. 비워 두면 요청 헤더에서 추정하는데, HTTPS 를 앞단에서 끝내면 `http://` 로 잡힙니다.
- 실제 도메인 + HTTPS 는 앞단에 리버스 프록시(Caddy, Traefik, Cloudflare Tunnel 등)를 두는 것을 권장합니다.
  그때는 아래 **`TRUST_PROXY` 주의**를 꼭 읽으세요.
- 랜딩/데모 페이지의 미리보기 절대 URL 은 빌드 인자 `VITE_SITE_URL` 로 정합니다.
- 신고 대응 등 운영자 권한이 필요하면 `ADMIN_TOKEN` 을 설정합니다(모든 청첩장에 관리 권한).
  ```bash
  # 예: 청첩장 통째로 삭제
  curl -X DELETE https://our.wedding/api/weddings/<주소> -H "Authorization: Bearer $ADMIN_TOKEN"
  ```
- 디스크: 업로드 사진 전체 용량은 **`MAX_UPLOAD_BYTES`**(기본 5GB)를 넘지 않습니다(초과 시 업로드 507). 사진은 DB 와 같은
  볼륨에 있어 디스크가 가득 차면 모든 청첩장의 저장이 실패하므로, 이 값을 디스크 여유보다 작게 잡으세요.
  (청첩장당 사진 30장 × 2MB 이므로 이 상한이 없다면 최악 `MAX_WEDDINGS × 60MB` 입니다.)
  저장된 내용(표지·갤러리)에서 쓰지 않는 업로드는 1시간 뒤 다음 저장/업로드 때 자동으로 정리됩니다.
- 장소 검색은 공개 OpenStreetMap Nominatim 을 씁니다(서버가 초당 1회 이하로 호출하고 결과를 캐시).
  사용량이 많으면 자체 Nominatim 을 띄우고 `GEOCODE_URL` 을 바꾸세요.

### 💾 백업과 복원

모든 데이터는 `guestbook-data` 볼륨 하나에 있습니다.

```
/data/guestbook.db (+ -wal, -shm)   청첩장 내용 · 관리 비밀번호 해시 · 방명록 · 토큰 서명 키
/data/uploads/<주소>/<파일>          업로드된 사진
```

```bash
# 백업 (sqlite 가 WAL 모드이므로 잠깐 멈추고 통째로 묶는 것이 가장 안전)
docker compose stop api
docker run --rm -v wedding-card_guestbook-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/wedding-backup-$(date +%F).tgz -C /data .
docker compose start api

# 복원 (빈 볼륨에 풀기)
docker compose down
docker run --rm -v wedding-card_guestbook-data:/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/wedding-backup-YYYY-MM-DD.tgz -C /data && chown -R 1000:1000 /data'
docker compose up -d
```

> 볼륨 이름은 `<compose 프로젝트 이름>_guestbook-data` 입니다(`docker volume ls` 로 확인).
> 백업 파일에는 비밀번호 해시와 토큰 서명 키가 들어 있으니 안전한 곳에 보관하세요.

### 이전(단일 청첩장) 버전에서 올릴 때

예전 DB 로 그대로 시작해도 됩니다. 테이블은 자동으로 마이그레이션되고, 예전 방명록 글은 지워지지 않지만
어떤 청첩장에도 속하지 않아 화면에는 나오지 않습니다(DB 의 `guests.wedding_slug = '_legacy'`).
예전 `/api/guests`, `/api/events` 경로는 없어졌습니다.

---

## 🚀 로컬 개발

### 1) 웹

```bash
cd web
npm install
npm run dev            # http://localhost:5173
```

### 2) API 서버

`web` 개발 서버는 `/api` 요청을 `http://localhost:8787` 로 프록시합니다.

```bash
cd server
npm start              # http://localhost:8787  (sqlite: ./data/guestbook.db, 사진: ./data/uploads)
```

웹을 API 모드로 실행하려면 `web/.env.local` 에 아래를 추가합니다.

```
VITE_API_URL=/
```

> API 서버 없이 `npm run dev` 만 하면 **데모 청첩장**만 동작합니다(방명록은 localStorage + 샘플 하객).

도커 없이 서버만 띄워 `/w/<주소>` 미리보기 태그까지 확인하려면 템플릿 위치를 알려 줍니다.

```bash
cd web && npm run build
cd ../server && INDEX_HTML_PATH=../web/dist/index.html npm start
curl -s http://localhost:8787/w/<주소> | grep og:
```

### 서버 테스트

```bash
cd server
npm test               # node --test (외부 의존성 없음, 실제 네트워크 호출 없음)
```

> `node:sqlite` 는 아직 실험적 기능이라 실행 시 경고가 뜹니다. 스크립트에서
> `--disable-warning=ExperimentalWarning` 로 숨겨 두었고, 플래그 없이도 Node 24 에서 정상 동작합니다.

---

## 🔌 API 요약

모두 JSON 이고 오류는 `4xx/5xx {"error": "메시지"}` 입니다. 인증은 `Authorization: Bearer <토큰>`.

| 메서드 · 경로 | 설명 |
|---|---|
| `GET /api/health` | `{ok:true}` |
| `GET /api/weddings/:slug/availability` | `{available, reason?}` — 형식 오류·예약어·사용 중이면 `available:false` |
| `POST /api/weddings` `{slug,password,config}` | `201 {wedding, token, expiresAt}` · 주소 중복 `409` · 정원 초과 `503` |
| `GET /api/weddings/:slug` | `200 {slug, config, createdAt, updatedAt}` · 없으면 `404` (비밀번호 정보는 절대 없음) |
| `POST /api/weddings/:slug/login` `{password}` | `200 {token, expiresAt}` · 틀리면 `403` · 실패가 잦으면 `429` |
| `PUT /api/weddings/:slug` 🔒 `{config}` | `200` 정제된 WeddingRecord · 검증 실패 `400`(필드 이름 포함) |
| `PUT /api/weddings/:slug/password` 🔒 `{password}` | `204` — 이후 이전 토큰은 `401`, 새 비밀번호로 다시 로그인 |
| `DELETE /api/weddings/:slug` 🔒 | `204` — 방명록·사진까지 전부 삭제 |
| `POST /api/weddings/:slug/photos` 🔒 | 본문 = 이미지 바이트, `Content-Type: image/jpeg\|png\|webp` → `201 {url}` · `413` 2MB 초과 · `415` 형식 · `409` 30장 초과 · `507` 서비스 전체 용량(`MAX_UPLOAD_BYTES`) 초과 · 업로드 도중 비밀번호가 바뀌면 `401` |
| `DELETE /api/weddings/:slug/photos/:file` 🔒 | `204` (config 에서 경로를 빼는 것은 호출 측의 일). 저장된 config 가 쓰지 않는 업로드는 1시간 뒤 다음 저장/업로드 때 서버가 정리 |
| `GET /uploads/:slug/:file` | 이미지 (1년 immutable 캐시) |
| `GET /api/geocode?q=` | `200 [{name,address,lat,lng}]` · 업스트림 실패 `502` |
| `GET /api/weddings/:slug/guests` | `200 GuestEntry[]` (작성 시각 오름차순) |
| `POST /api/weddings/:slug/guests` | `201 GuestEntry` · 가득 차면 `409` |
| `DELETE /api/weddings/:slug/guests/:id` | `{password}`(글 비밀번호) 또는 🔒 → `204` · `403` · `404` |
| `GET /api/weddings/:slug/events` | SSE — `added`(GuestEntry) / `removed`({id}) |
| `GET /w/:slug`, `/w/:slug/edit` | OG 태그가 들어간 `index.html` · 없는 주소는 SPA 셸 + `404` |
| `GET /w/:slug/wedding.ics` | `text/calendar` |

🔒 = 그 청첩장의 로그인 토큰(또는 운영자 `ADMIN_TOKEN`) 필요. 없거나 만료·다른 청첩장의 토큰이면 `401`.

청첩장 내용(`config`)은 `WeddingConfig` 와 같은 모양만 받습니다(모르는 키·틀린 타입은 400).
사진 경로(`coverImage`, `gallery`)는 **그 청첩장에 실제로 올린** `/uploads/<주소>/…` 만 쓸 수 있으므로
"만들기 → 사진 업로드 → 내용 수정(PUT)" 순서로 진행합니다. `kakaoJsKey` 는 저장하지 않습니다.

---

## ⚙️ 환경변수

### 웹 빌드 (Vite, 빌드 시점에 주입)

| 변수 | 설명 | 기본값 |
|---|---|---|
| `VITE_BASE` | 서빙 하위 경로. 자체 도메인/도커는 `/`, GitHub Pages 프로젝트 페이지는 `/<repo>/` | `/` |
| `VITE_SITE_URL` | 배포된 사이트의 절대 URL(랜딩·데모의 OG 미리보기·캘린더 링크). 예 `https://our.wedding/` | (빈 값) |
| `VITE_API_URL` | 플랫폼 API 주소. `/` = 같은 오리진(`/api`), **빈 값 = 데모 전용**, 그 외 = 해당 서버 | (빈 값) |

### API 서버

| 변수 | 설명 | 기본값 |
|---|---|---|
| `PORT` | API 포트 | `8787` |
| `DB_PATH` | sqlite 파일 경로(폴더 자동 생성) | `./data/guestbook.db` |
| `UPLOAD_DIR` | 업로드 사진 폴더(`<UPLOAD_DIR>/<주소>/<파일>`) | DB 폴더의 `uploads/` |
| `PUBLIC_ORIGIN` | 사이트 공개 주소(끝 `/` 없이). 미리보기·캘린더의 절대 URL 기준. 비우면 `X-Forwarded-Proto/Host`(→ `Host`)에서 추정 | (빈 값) |
| `TOKEN_SECRET` | 로그인 토큰(HMAC) 서명 키. 비우면 한 번 생성해 DB 에 보관 | (자동 생성) |
| `TOKEN_TTL_HOURS` | 로그인 토큰 유효 시간 | `12` |
| `INDEX_HTML_URL` | 미리보기용 `index.html` 템플릿 주소. 처음 필요할 때 가져와 60초 캐시, 실패 시 예전 사본 사용 | `http://web/index.html` |
| `INDEX_HTML_PATH` | 템플릿을 파일에서 읽을 때(설정하면 URL 보다 우선) | (없음) |
| `CORS_ORIGIN` | 허용 오리진(쉼표 구분, `*` 가능). 비우면 같은 오리진만 | (빈 값) |
| `ADMIN_TOKEN` | 운영자 토큰. `Authorization: Bearer <토큰>` 으로 모든 청첩장에 관리 권한 | (없음) |
| `MAX_WEDDINGS` | 서비스 전체 청첩장 수(초과 시 만들기 503) | `2000` |
| `MAX_GUESTS` | 청첩장당 방명록 수(초과 시 409) | `1000` |
| `MAX_UPLOAD_BYTES` | 서비스 전체 업로드 사진 바이트 합계 상한(초과 시 업로드 507). 디스크 여유보다 작게 | `5368709120` (5GB) |
| `PHOTO_ORPHAN_GRACE_MS` | 저장된 내용이 쓰지 않는 업로드를 자동 정리하기 전 유예 시간 | `3600000` |
| `RATE_MAX` / `RATE_WINDOW_MS` | IP별 방명록 등록 한도(검증을 통과한 등록만 차감) | `40` / `600000` |
| `DELETE_RATE_MAX` / `DELETE_RATE_WINDOW_MS` | (IP, 항목)별 방명록 삭제 비밀번호 실패 한도 | `5` / `600000` |
| `CREATE_RATE_MAX` / `CREATE_RATE_WINDOW_MS` | IP별 청첩장 만들기 한도 | `5` / `3600000` |
| `LOGIN_RATE_MAX` / `LOGIN_RATE_WINDOW_MS` | (IP, 청첩장)별 로그인 실패 한도 | `10` / `600000` |
| `LOGIN_SLUG_RATE_MAX` / `LOGIN_SLUG_RATE_WINDOW_MS` | 청첩장별(IP 무관) 로그인 실패 한도 — IP 를 바꿔 가며 오는 대입 공격 상한 | `50` / `600000` |
| `PHOTO_RATE_MAX` / `PHOTO_RATE_WINDOW_MS` | IP별 사진 업로드 한도 | `120` / `600000` |
| `GEOCODE_RATE_MAX` / `GEOCODE_RATE_WINDOW_MS` | IP별 장소 검색 한도 | `20` / `60000` |
| `GEOCODE_URL` | 장소 검색 업스트림(Nominatim `search`) | `https://nominatim.openstreetmap.org/search` |
| `GEOCODE_USER_AGENT` | 업스트림에 보내는 User-Agent(앱 이름만, 개인정보 없음) | `mobile-wedding-invitation/1.0 …` |
| `GEOCODE_MIN_INTERVAL_MS` | 업스트림 호출 사이 최소 간격(Nominatim 정책: 초당 1회 이하) | `1100` |
| `BODY_LIMIT` / `CONFIG_BODY_LIMIT` | JSON 본문 상한: 방명록·로그인 등 / 청첩장 만들기·수정 | `8192` / `65536` |
| `SSE_MAX_CLIENTS` / `SSE_MAX_PER_IP` | 동시 실시간(SSE) 연결 상한(전체 / IP별). 초과 시 503 → 폴링 | `500` / `30` |
| `REQUEST_TIMEOUT_MS` | 요청(헤더+본문) 수신 제한 시간. 느린 본문으로 요청을 오래 붙잡지 못하게 한다 | `60000` |
| `TRUST_PROXY` | 프록시 뒤에서 IP·오리진 판별. `X-Real-IP`, 없으면 `X-Forwarded-For` 의 **마지막** 주소를 쓴다 | `0` |

청첩장당 사진 30장 · 장당 2MB · 갤러리 24장 · 내용 JSON 32KB · 각 글자 수 상한은 프론트와 공유하는
계약값(`PLATFORM_LIMITS`)이라 환경변수가 아니라 코드에 있습니다.

> **`TRUST_PROXY` 주의** — 동봉된 `web/nginx.conf` 는 `X-Real-IP`/`X-Forwarded-For` 를 nginx 가 본 피어 주소로 **덮어써서** 클라이언트가 헤더를 위조해 한도를 우회하지 못하게 합니다. 이 스택 앞에 호스트 리버스 프록시나 TLS 종단(Caddy, Traefik, 클라우드 LB 등)을 한 겹 더 두면 nginx 가 보는 주소가 전부 그 프록시가 되어 **모든 사용자가 한 IP 로 묶입니다**(청첩장 만들기 한도 5개/시간이 서비스 전체에 걸립니다). 그때는 `web/nginx.conf` 상단의 `set_real_ip_from <프록시 대역>; real_ip_header X-Forwarded-For; real_ip_recursive on;` 주석을 켜고, `PUBLIC_ORIGIN` 을 설정하세요.
>
> **앞단 프록시가 없어도 IP 가 하나로 묶이는 환경** — IP별 한도는 nginx 가 실제 클라이언트 주소를 볼 때만 방문자를 구분합니다. 이는 **rootful Linux Docker + IPv4(DNAT)** 에서만 성립합니다. 아래 환경에서는 모든 연결이 브리지 게이트웨이 주소 하나로 들어옵니다(전달된 헤더가 없으므로 `set_real_ip_from` 만으로는 복원할 수 없습니다).
>
> - Docker Desktop (macOS/Windows)
> - rootless Docker (기본 포트 드라이버)
> - 공개 포트로 들어오는 IPv6 (userland proxy 경유)
>
> 이때 기본값으로는 청첩장 만들기 5개/시간이 서비스 전체에 걸리고, 누구든 로그인을 10번 틀리면 그 청첩장 주인이 10분간 로그인하지 못하며, 실시간(SSE) 연결이 전체 30개로 제한되고, 장소 검색·사진 업로드 한도를 모든 편집자가 나눠 씁니다. 대책:
>
> - 호스트에 `X-Forwarded-For` 를 보내는 리버스 프록시(Caddy 등)를 두고 `set_real_ip_from <nginx 가 보는 게이트웨이 대역>; real_ip_header X-Forwarded-For;` 를 켭니다. 대역은 `docker compose logs web` 의 접속 로그로 확인하세요 — Docker Desktop 은 `192.168.65.0/24` 처럼 예시(`172.16.0.0/12`) 밖일 수 있습니다.
> - rootless Docker: 포트 드라이버를 `slirp4netns` 로 바꿉니다(원본 주소 보존).
> - IPv6: Docker 네트워크에 IPv6 를 켭니다(`ip6tables`).
> - 그 외(예: 내 Mac 에서 시험 운영): `CREATE_RATE_MAX`, `LOGIN_RATE_MAX`, `SSE_MAX_PER_IP`, `GEOCODE_RATE_MAX`, `PHOTO_RATE_MAX` 와 `web/nginx.conf` 의 `limit_conn` 값을 올립니다.

### docker compose

| 변수 | 설명 | 기본값 |
|---|---|---|
| `WEB_PORT` | 웹을 노출할 호스트 포트 | `8080` |

---

## 🌐 GitHub Pages (데모)

`main` 브랜치에 push 하면 `.github/workflows/deploy.yml` 이 자동으로 빌드·배포합니다.

- 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 설정
- 배포 주소: `https://<owner>.github.io/<repo>/`
  (이 저장소 기준: `https://haeryangkim.github.io/wedding-card/`)

> ⚠️ **GitHub Pages 는 정적 호스팅이라 API 를 실행할 수 없습니다.**
> 저장소 변수 `VITE_API_URL` 이 비어 있으면 **데모 청첩장만** 동작하고(방명록은 각자 브라우저에만 저장),
> 청첩장 만들기는 쓸 수 없습니다. 또한 Pages 에서는 서버 렌더링이 없어 청첩장별 링크 미리보기가 나오지 않습니다 —
> 실제 서비스는 Docker 로 호스팅하세요.

Pages 프론트를 따로 띄운 API 에 연결하려면, API 서버의 `CORS_ORIGIN` 에 Pages 오리진
(예: `https://haeryangkim.github.io`)을 넣고 저장소 변수 `VITE_API_URL` 에 API 의 공개 주소를 넣은 뒤 다시 배포합니다.

---

## 🔑 참고 — 카카오내비 JS 키 (선택)

카카오**내비** 길안내는 공식적으로 JavaScript SDK + 도메인 등록이 필요합니다.
키가 없어도 카카오맵/네이버지도/티맵 길안내는 동작합니다. 키는 사이트 도메인에 묶이는 값이라
청첩장별로 저장하지 않습니다(서버는 `config.kakaoJsKey` 가 와도 버립니다).

---

## ✅ CI

`.github/workflows/ci.yml` 이 push/PR 마다 다음을 검증합니다.

- **web**: 타입체크(`tsc -b --noEmit`) · 테스트(vitest) · 빌드
- **server**: `node:test` 통합 테스트
- **docker**: 이미지 빌드 → `docker compose up` → nginx 를 통해 실제로 스모크 테스트 —
  `/`·`/new` SPA 셸, 청첩장 만들기, `/w/<주소>` 의 `og:title`, `/w/<주소>/wedding.ics`, 로그인,
  사진 업로드·다운로드, 방명록 작성·조회·관리자 삭제, 청첩장 삭제

---

made with ❤️
