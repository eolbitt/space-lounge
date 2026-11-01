# Space Lounge — 혼자지만, 같은 우주에 있는 사람들

작은 우주인이 되어 하나의 라운지 같은 우주를 천천히 떠다니는 **침묵의 공존** 웹 MVP입니다.  
채팅·경쟁·미션·점수 없음. 전원 같은 기본 우주복, 이름/프로필 표시 없음.

## 경험

- **떠다니기** / **가만히 있기** / **인사하기** / **바라보기**
- **3D 유영** — 드래그(터치)로 시야, WASD/화살표·Q/E로 이동
- **멀티탭 실시간** — BroadcastChannel로 같은 브라우저 탭끼리 위치·상태·하트 공유 (폴백 모의 방문객)
- **라운지 포드** — 따뜻한 창문의 Rest 포인트
- 스카이돔 + 절차형 별 + 빌보드 성운
- 근접 시 **마음(하트) +1** (쿨다운)
- BGM/SFX 토글 · Idle/Move/Rest/Wave · 익명 동일 우주복

## 에셋

```
public/assets/astronaut/   astronaut-idle|move|rest|wave.png
public/assets/background/  space-stars.png, nebula.png
public/assets/objects/     earth, moon, planet, asteroid, lounge-pod.png
public/assets/audio/       ambient-space.ogg, sfx-wave.ogg, sfx-heart.ogg
```

## 동기화

같은 출처의 여러 탭은 `BroadcastChannel("space-lounge-presence-v1")` 로 익명 포즈를 공유합니다.  
WebSocket 서버는 MVP에서 생략했고, 탭이 없으면 모의 방문객이 남습니다.

## 실행

```bash
npm install
npm run dev
```

[http://127.0.0.1:43127](http://127.0.0.1:43127)

## 기술

Next.js · TypeScript · Tailwind · three.js / React Three Fiber / drei  
스카이돔·절차형 별점·빌보드 천체/아바타 · 포인터 시야 + WASD 드리프트  
실시간 백엔드 없이 모의 프레즌스.

## 미룸

- 크로스 디바이스 WebSocket/서버 동기화
- 손 흔들기/착석 프레임 애니메이션 클립
- 포드 내부 진입·꾸미기 UI (의도적 제외)
