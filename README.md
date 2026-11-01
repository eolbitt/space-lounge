# Space Lounge — 혼자지만, 같은 우주에 있는 사람들

작은 우주인이 되어 하나의 라운지 같은 우주를 천천히 떠다니는 **침묵의 공존** 웹 MVP입니다.  
채팅·경쟁·미션·점수 없음. 전원 같은 기본 우주복, 이름/프로필 표시 없음.

## 경험

- **떠다니기** / **가만히 있기** / **인사하기**
- **3D 유영** — 드래그(터치)로 시야, WASD/화살표·Q/E로 카메라 상대 이동
- **실시간 공존** — WebSocket 프레즌스(+ BroadcastChannel 폴백)
- **라운지 포드** — 공간에 흩뿌린 Rest + 아이소메트릭 실내 걷기(바닥·충돌, 날기 없음)
- **행성·태양 깃발** — 최대 10자, **1분 강제 잠금** 후 덮어쓰기(시간만으로 삭제 안 함), 행성당 현재 깃발만 `data/flags.json`에 저장(이전 문구 히스토리 없음) + WebSocket 동기화
- 근접 시 **마음(하트) +1** (쿨다운)
- BGM/SFX · Idle/Move/Rest/Wave · 익명 동일 우주복 · 채팅/랭킹 없음

## 로컬 실행

```bash
npm install
npm run dev:ws   # 터미널 1 — ws://0.0.0.0:43128
npm run dev      # 터미널 2 — http://127.0.0.1:43127
```

한 프로세스로 프로덕션과 동일하게 돌리려면:

```bash
npm run build
npm run start:prod   # http + /ws  (PORT 기본 43127)
```

## 공개 배포 (Render)

- **GitHub:** https://github.com/eolbitt/space-lounge
- **URL:** https://space-lounge-55de.onrender.com
- **WebSocket:** `wss://space-lounge-55de.onrender.com/ws` (same-origin)
- 계정: Render `eolbitt@gmail.com` · free web `space-lounge` · **Git 빌드** (`main` + `render.yaml` / `start:prod`)
- ttl.sh 이미지 배포는 제거됨

## Render 무료 배포 (권장)

웹과 presence WebSocket을 **하나의 웹 서비스**로 합쳤습니다.  
프로덕션 엔트리 `server/prod.mjs`가 Next를 띄우고 같은 포트에서 `/ws` 업그레이드를 처리합니다.

### Blueprint (가장 쉬움)

1. [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**
2. 이 저장소를 연결하고 `render.yaml` 확인
3. **Apply** — 빌드: `npm ci && npm run build` / 스타트: `npm run start:prod`
4. 배포 후 공개 URL: `https://<service>.onrender.com`  
   WebSocket: `wss://<service>.onrender.com/ws` (같은 오리진, 별도 env 불필요)

### 수동 웹 서비스

| 항목 | 값 |
|------|-----|
| Runtime | Node |
| Plan | Free |
| Build | `npm ci && npm run build` |
| Start | `npm run start:prod` |
| Health check | `/` |

환경변수:

| Key | 값 | 비고 |
|-----|-----|------|
| `NODE_VERSION` | `20` | 권장 |
| `NODE_ENV` | `production` | |
| `NEXT_PUBLIC_WS_URL` | _(비움)_ | 비우면 자동으로 `wss://<host>/ws` |
| `PORT` | Render가 주입 | 직접 설정하지 말 것 |

### Free tier 참고

- 약 15분 무접속 후 스핀다운 → 첫 요청이 느릴 수 있음
- WebSocket도 같은 프로세스가 잠들면 함께 끊김 (재접속 로직이 있음)
- 깃발은 프로세스 재시작 시 `data/flags.json`에서 복구되지만, Render Free 디스크는 ephemeral이라 인스턴스 교체 시 유실될 수 있음
- 계정·CLI 키가 없으면 Blueprint를 대시보드에서만 적용할 수 있습니다

### Cloudflare tunnel (보조)

로컬/에이전트 미리보기용. 영구 공개 URL이 필요하면 Render를 쓰세요.

```bash
# 예시 — Next와 WS를 각각 터널
cloudflared tunnel --url http://127.0.0.1:43127
cloudflared tunnel --url http://127.0.0.1:43128
# Next 쪽에 NEXT_PUBLIC_WS_URL=wss://<ws-tunnel> 전달
```

## 에셋

```
public/assets/astronaut/   astronaut-idle|move|rest|wave.png
public/assets/background/  space-stars.png, nebula.png
public/assets/objects/     earth, moon, planets, asteroid, lounge-pod, sun, blackhole, nebula…
public/assets/audio/       deep-space-ambience.mp3 (BGM loop), sfx-wave.ogg, sfx-heart.ogg
```

## 기술

Next.js · TypeScript · Tailwind · three.js / React Three Fiber / drei · `ws`  
카메라 상대 WASD + 스프라이트 좌우 미러 · 단일 프로세스 HTTP+/ws

## 미룸

- 인증·방 분리·대규모 샤딩
- 손 흔들기/착석 프레임 클립
- 꾸미기 UI (의도적 제외)
