# Space Lounge — 혼자지만, 같은 우주에 있는 사람들

작은 우주인이 되어 하나의 라운지 같은 우주를 천천히 떠다니는 **침묵의 공존** 웹 MVP입니다.  
채팅·경쟁·미션·점수 없음. 전원 같은 기본 우주복, 이름/프로필 표시 없음.

## 경험

- **떠다니기** / **가만히 있기** / **인사하기** / **바라보기**
- 넓은 유영 범위 — 지구·달·고리행성·소행성 사이를 실제로 이동
- 근접/접촉 시 조용한 **마음(하트) +1** (상대별 쿨다운)
- 앰비언트 BGM + 짧은 SFX, HUD에서 음악/효과음 토글 (입장 제스처 후 재생)
- 아바타 상태: Idle · Move · Rest · Wave
- 모의 동시 접속 수 + 익명 방문 우주인 (이름 없음)

## 에셋

```
public/assets/astronaut/   astronaut-idle|move|rest|wave.png
public/assets/background/  space-stars.png, nebula.png
public/assets/objects/     earth.png, moon.png, planet.png, asteroid.png
public/assets/audio/       ambient-space.ogg, sfx-wave.ogg, sfx-heart.ogg
```

## 실행

```bash
npm install
npm run dev
```

[http://127.0.0.1:43127](http://127.0.0.1:43127)

## 기술

Next.js · TypeScript · Tailwind · three.js / React Three Fiber  
실시간 백엔드 없이 모의 프레즌스.

## 미룸

- 실제 멀티플레이어 동기화
- 라운지 포드·랜턴 디테일
- 손 흔들기/착석 프레임 애니메이션 클립
- 꾸미기 UI (의도적 제외)
