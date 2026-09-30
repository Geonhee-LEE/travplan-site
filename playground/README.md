# travplan Playground

travplan의 운동학 시뮬레이터를 JS로 옮겨 브라우저에서 실시간으로 돌리는 페이지다. 지형, TravMap, 2.5D 가림, Dijkstra Planner,
MPPI Controller, 스워브 운동학이 한 폐루프로 돈다. 목표와 장애물을 지도에 직접 놓고, 인식·Planner·Controller 설정을 바꿔 가며 본다.

**열기:** <https://geonhee-lee.github.io/travplan-site/playground/>

![Playground](../assets/figs/playground_preview.webp)

## 1. 여는 곳

| 곳 | 주소 | 비고 |
|---|---|---|
| 공개 사이트 (GitHub Pages) | <https://geonhee-lee.github.io/travplan-site/playground/> | 연구 저장소 main의 `docs/`가 바뀌면 사이트 저장소로 자동 동기화된다 |
| 대시보드 '시뮬레이션 ▶' 탭 | <https://geonhee-lee.github.io/travplan-site/dashboard.html#sim> | 대시보드 안에서 바로 돈다 |
| 로컬 | `./scripts/open_dashboard.sh` 뒤 '시뮬레이션' 탭, 또는 <http://127.0.0.1:8765/playground/> | `docs/`를 http로 띄운다 |
| claude.ai 게시본 | <https://claude.ai/artifact/CTrLTsS1V5VtWzisHbFv5J> | 비공개, 소유자·공유받은 사람만 |

`file://`로 열면 돌지 않는다. ES 모듈은 http로만 불러온다.

주소 끝에 시연 id를 붙이면 그 설정으로 바로 연다. `…/playground/#TP-0047`, `…/playground/#TP-0031-high`처럼 쓴다.
대시보드 TODO 탭의 **▶ 시뮬레이션** 링크가 이 주소다.

## 2. 화면

| 영역 | 하는 일 |
|---|---|
| 지형 탭 | 시나리오 4개(`curb_ramp`, `bumps_potholes`, `slope_crossfall`, `random_mix`)와 음의 지형 3개(`down_curb`, `down_ramp`, `drain_channel`) |
| 시연 버튼 | 저장소 결과를 그 설정 그대로 다시 달린다(아래 3절) |
| 지도 | 2D 또는 3D(three.js). 층은 로봇이 본 cost, 실제 cost, 높이 |
| 클릭 도구 | 목표, 상자(0.8 m, 0.4 m 높이), 포트홀(반경 0.35 m, 깊이 0.12 m), 보행자(끌어서 방향·속도), 지우기(원래 지형으로) |
| 오른쪽 패널 | 난이도 레벨 0–3, seed, 인식(완전 관측, L0 원형, L0 + 가림, 센서 높이·범위, 그림자 상한, 깊이 prior, 관측 증거 제한), Planner, Controller와 MPPI 파라미터 |
| 아래 | MPPI 비용 6항(가장 좋은 샘플), 주행 기록 10회, 커서 위치의 높이·경사·턱·cost, 실시간 배율 |

키보드: Space 재생·일시정지, `r` 다시 달리기, `n` 새 지형.

지도 색은 cost다. 0.3 아래는 지면색이고, 0.95로 갈수록 황토에서 주황이 된다. 치명 셀은 빨강이다. 아직 못 본 칸은 검정,
그림자 상한·깊이 prior로 채운 칸은 보라다. 청록 점선이 Planner 경로, 노란 선이 MPPI 계획(지평 T), 옅은 선이 MPPI 샘플이다.

판정은 실제 지형으로 한다. 치명 셀 진입, pitch 0.35 rad·roll 0.30 rad 초과, 보행자 접촉, 60 s 초과가 실패다.

## 3. 시연

각 시연은 `js/main.js`의 `PRESETS` 한 줄이다. 모두 JS에서 돈 결과이고, 저장소 결과와 방향이 같다.

| id | TP | 설정 | 이 페이지 결과 | 저장소 결과 |
|---|---|---|---|---|
| `TP-0031-low` | TP-0031 | bumps_potholes s4, 가림, 센서 0.3 m | 치명 셀 진입 | 센서 0.3 m에서 6/10 |
| `TP-0031-high` | TP-0031 | 같은 지형, 센서 1.0 m | 도달 | 0.8 m 이상에서 9–10/10 |
| `TP-0046` | TP-0046 | 가림 + 그림자 상한만 | 치명 셀 진입 | 36/40, 상한만으로는 그대로 |
| `TP-0047` | TP-0047 | + 깊이 prior | 도달 | 40/40 |
| `TP-0048` | TP-0048 | down_curb s1, 깊이 prior, 증거 제한 끔 | 도달, 턱 앞에 보라 치명 벽이 잠깐 선다 | 오탐 9.1칸 → 증거 제한 1.3칸(TP-0067) |
| `TP-0039` | TP-0039 | curb_ramp 레벨 3(연석 0.24 m, 경사로 1.1 m) | 도달 | guidance+mppi 12/12 |
| `planner-vs-controller` | — | Planner를 직선으로 | 60 s 시간 초과 | Planner가 필요한 이유 |
| `TP-0027` | TP-0027 | 보행자 3명(GT 경로에 배치) | 도달 | 보행자 2명 조건 40/40, 충돌 0 |

같은 bumps_potholes를 레벨 0–2, seed 12개(36회)로 돌리면 이 페이지에서도 저장소와 같은 방향이 나온다.
가림 + 상한만은 29/36이고 깊이 prior를 켜면 34/36이다. 상한 없이 센서 0.3 m는 22/36이고 1.0 m는 35/36이다.

## 4. 구조

`js/`의 코어 다섯 파일이 Python 원본을 한 파일씩 옮긴 것이다. 식, 한계값, 기본값이 같다.

| JS | Python 원본 | 내용 |
|---|---|---|
| `terrain.js` | `travplan/sim/terrain.py` | 시나리오 7개, 난이도 표(`DIFFICULTY`), 편집(상자·포트홀·지우기) |
| `travmap.js` | `travplan/representation/`, `travplan/sim/visibility.py` | 특징(창 7·7·21·5·13칸), 램프 cost, `fill_unknown`, 2.5D 시선 스윕, 그림자 상한, 깊이 prior와 증거 제한 |
| `planner.js` | `travplan/planners/guidance.py` | Dijkstra cost-to-go(간선 = 길이 × 평균(1 + 4·cost + 0.5·sigma)), 경로 추출 |
| `control.js` | `travplan/control/mppi/`, `travplan/robot/swerve.py`, `travplan/control/tracker.py` | 스워브 한계·적분, pure pursuit, MPPI(AR(1) 잡음, 평균·정지 후보, 비용 6항, warm start) |
| `sim.js` | `travplan/sim/kinematic_sim.py`, `travplan/eval/runner.py` | 0.1 s 폐루프, 10스텝마다 재계획, 관측 융합, 보행자, 실패 판정 |
| `core.js` | `travplan/core/grid.py` 일부 | 난수, 격자, 이중선형 보간, max·avg pool |
| `render2d.js`, `render3d.js`, `main.js` | — | 그리기, 조작, 시연 |

한 스텝(0.1 s)은 이렇게 돈다.

```
관측(원형 시야 또는 2.5D 시선) -> belief 높이 융합 -> TravMap(특징 -> cost) -> [10스텝마다] Dijkstra 경로
  -> MPPI(K개 롤아웃 × 비용 6항 -> 가중 평균) -> 스워브 적분 -> 실제 지형으로 판정
```

데스크톱에서 스텝당 16–22 ms(지도 11–17, 제어 4)가 걸려 실시간보다 4배 이상 빠르다. 실시간 배율은 화면 아래에 나온다.

## 5. 저장소와 다른 점

- 난수 생성기가 달라서 seed가 같아도 Python 벤치마크와 지형이 똑같지는 않다. 규칙과 분포는 같다.
- MPPI 샘플 수 기본값은 256이다(Python 768). 슬라이더로 1024까지 올린다.
- 학습 Planner(Planner D, Joint Planner)는 아직 브라우저에서 돌지 않는다. L1 인식(elevation_mapping_cupy)과 스워브 모듈 모델(TP-0034)도 없다.
- 보행자는 등속으로 직진한다(Python `DynamicObstacles.advance`와 같다).

## 6. 고치고 늘리기

- **Python을 바꾸면 JS도 고친다.** 4절 표의 원본에서 식·한계값·기본값을 바꿨다면 대응하는 JS 파일도 같이 고친다(CLAUDE.md 규칙).
- **시연 추가:** `js/main.js`의 `PRESETS`에 `{ id, tp, label, set }` 한 줄을 넣는다. `set`은 `defaultOptions()`를 덮어쓴다.
  `automation/dashboard_links.py`가 이 목록을 읽어, 같은 TP의 TODO 항목에 ▶ 시뮬레이션 링크를 저절로 단다. 대시보드는 다시 생성한다.
- **검사:** `./scripts/check_playground.sh`가 `check.html`을 헤드리스 Chrome으로 열어 기본 주행 4개와 시연 6개를 판정한다(약 35초).
  코어 파일을 고친 뒤에는 꼭 돌린다. 시연 결과가 바뀌어 기대와 달라지면 `check.html`의 기대값과 3절 표를 같이 고친다.
- **게시:** 연구 저장소 main에 push하면 GitHub Actions(`publish-site`)가 `docs/`를 공개 저장소 `travplan-site`로 복사하고, 그 저장소의 GitHub Pages가 서비스한다. claude.ai 게시본은 `index.html`을 `file_path`,
  `docs/playground`를 `root`, `js/*.js`를 `files`로 주고 위 URL에 publish한다. `index.html`에 `<!doctype>`·`<head>`가 없는 것은
  claude.ai 게시 규칙 때문이다. 브라우저는 그대로 연다.
