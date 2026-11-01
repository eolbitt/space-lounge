# Space Lounge — 혼자지만, 같은 우주에 있는 사람들

작은 우주인이 되어 하나의 라운지 같은 우주를 천천히 떠다니는 **침묵의 공존** 웹 MVP입니다.  
채팅·경쟁·미션·점수 없음. 전원 같은 기본 우주복, 이름/프로필 표시 없음.

## 경험

- **떠다니기** / **가만히 있기** / **인사하기** / **바라보기**
- 아바타 상태: Idle · Move · Rest(소행성 근처) · Wave
- 모의 동시 접속 수 + 익명 방문 우주인

지구가 가장 큰 중심 오브젝트이고, 달·고리 행성·소행성·별/성운은 분위기 레이어로 분리되어 있습니다.

## 에셋

```
public/assets/astronaut/   astronaut-idle|move|rest|wave.png
public/assets/background/  space-stars.png, nebula.png
public/assets/objects/     earth.png, moon.png, planet.png, asteroid.png
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
- 사운드 / 설정 패널 동작
- 라운지 포드의 따뜻한 실내 디테일
- 물리 기반 착석·손 흔들기 애니메이션 클립
