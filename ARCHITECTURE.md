# Architecture & Roadmap

## 1. 설계 결정

travplan의 설계는 다섯 가지 결정 위에 서 있다.

| 결정 | 선택 | 이유 |
|---|---|---|
| 지형 표현 | 2.5D elevation + traversability + 불확실성 σ | Orin에서 실시간으로 돌고, MPPI rollout이 칸 하나를 O(1) bilinear 조회로 읽는다. 턱·경사·거칠기를 0/1이 아닌 연속값으로 담는다 |
| 계층 | **Planner(학습 기반) → Controller(MPPI)** (2026-09-25) | Planner는 경로나 시간 인덱스 궤적만 내고, Controller가 추종과 로컬 안전을 맡는다. Nav2의 planner/controller 분리와 같다. 개발 대상은 학습 Planner이고, MPPI는 유지보수만 한다 |
| 인터페이스 | `Planner`(`PlanRequest` → `PlanResult`), `Controller`(`ControlRequest` → `ControlResult`) | 트랙끼리는 이 입출력만 공유한다. 다른 트랙 코드를 import하지 않는다 |
| 시뮬레이터 | Isaac Sim 6.0 + Isaac Lab(본 검증), 운동학 시뮬(빠른 반복·CI) | 두 시뮬레이터가 같은 지형 정의(`sim/terrain.py`)를 쓴다. 로컬의 기존 4.5.0은 ROS 2 브릿지가 Humble용뿐이라 P1 전에 6.0으로 올려야 한다(`docs/prd.md` R-F-001) |
| 센서 구성 | 전면 3D LiDAR 1 + 카메라 5(전면 스테레오 2, 측면 2, 후면 1), 낮은 차체 (2026-09-27) | LiDAR가 지형 기하, 전면 스테레오가 근거리 사각, 카메라 다섯 대가 사람을 360°로 본다. 옆·뒤 지형은 기억뿐이라 움직임을 시야 쪽으로 제한한다(`docs/design-sensor-layout.md`) |

## 2. TravMap 채널 (`core/types.py::Ch`)

TravMap은 8채널 격자다. 앞의 여섯 채널은 높이에서 계산한 기하 특징이고, 뒤의 두 채널이 Planner와 Controller가
실제로 쓰는 비용과 불확실성이다.

| 채널 | 의미 | 계산 |
|---|---|---|
| ELEV | 높이 | 미관측 칸은 확산 보간으로 채운다(`fill_unknown`) |
| GRAD_X/Y | 차체 크기(0.35 m)로 평활한 표면의 기울기 | roll/pitch 투영에 쓴다 |
| SLOPE | atan(\|∇z\|), 로봇 반경만큼 max-dilate | |
| STEP | 0.3 m 창의 높이 범위에서 1 m 대역 경사로 설명되는 부분을 뺀 값 | 완만한 램프를 턱으로 오인하지 않는다 |
| ROUGH | 고역 통과 잔차의 표준편차 | |
| COST | 추정기 출력 ∈ [0, 1]. **0.95 이상이면 치명 셀** | 기하 추정기는 max_i ramp(특징_i / 한계_i) |
| SIGMA | 불확실성 ∈ [0, 1] | 미관측은 1, 학습 추정기는 heteroscedastic 분산 |

기본 로봇 한계는 경사 15°, 턱 8 cm, 거칠기 4 cm다(`GeometricTravConfig`).

## 3. Planner → Controller

```
 TravMap + 목표 ──▶ Planner ──(PlanResult: path [N,2|3], 선택 times [N])──▶ Controller ──▶ body twist
                   (학습 기반, 개발 대상)                                  (MPPI / pure pursuit)
                   planners/learned, GuidancePlanner(기준선)               control/mppi, control/tracker
                   1초마다 Guidance(Dijkstra) 갱신 → learned의 subgoal        + DynamicObstacles(ControlRequest)
```

### 3.1 Planner (`planners/`, 개발 대상)

**LearnedPlanner**는 로봇 중심으로 회전한 6.4 m 크롭(cost, σ, slope, step)과 subgoal을 받아 waypoint 8개를 낸다.
손실(`learned/loss.py`)은 보간한 경로점에서 흐린 비용, 치명 hinge, σ, 목표, 곡률(2차 차분), 길이를 더한 것이다.
모든 항이 `grid_sample`을 거쳐 미분된다.

**Planner D**(`FlowPlanner`, TP-0025)는 같은 입력에 현재 속도를 더해 **4초짜리 시간 인덱스 궤적**을 낸다. flow
matching으로 제어 변화율 후보 16개를 생성하고, 이를 적분해 `SwerveModel`로 굴린 뒤, 지도 비용과 남은 거리로 하나를
고른다. 직전에 고른 궤적도 한 스텝 밀어 후보에 넣어(`keep_previous`) 참조가 매 스텝 흔들리지 않게 한다. 굴려서 만든
궤적이라 모든 후보가 스워브 속도·가속 한계 안에 있다. `planner_dg`는 생성 도중 TravMap 비용의
기울기로 샘플을 치명 셀 밖으로 밀어낸다(재학습 없음). 설계 근거는 `docs/research-planner.md` B.8.3이다.

**GuidancePlanner**는 Dijkstra 경로 그 자체다(scipy csgraph, 8-이웃, 간선 = 길이 × (1 + 4·cost + 0.5·σ), 1초 주기).
학습 Planner의 비교 기준이자 폴백이고, 같은 Guidance의 subgoal이 학습 Planner의 입력이 된다.

### 3.2 Controller (`control/`, 유지보수만)

**MPPIController**는 body twist (vx, vy, wz)를 샘플링해 최적화한다. AR(1) 상관 노이즈를 쓰고
(`SmoothMPPIController`는 SMPPI식 적분 노이즈), 이전 해로 워밍 스타트하며, 정지 후보를 항상 포함한다. 샘플의
30%는 레퍼런스를 pure pursuit로 따라가는 제어열 주변에서 뽑는다. 비용 항(`control/mppi/costs.py`)은 다음과 같다.

| 비용 항 | 하는 일 |
|---|---|
| `ReferenceCost` | 경로면 이탈 거리 + 끝까지 남은 호 길이, 시간 인덱스 궤적이면 시각별 위치 오차 + 지평 끝 오차(진행 항) |
| `GoalApproachCost` | 레퍼런스가 목표에서 끝날 때만 v ≤ √(2ad) 정지 프로파일을 강제 |
| `TraversabilityCost` | ∫cost dt + 치명 셀 강한 벌점 |
| `RiskCost` | 경로 위 (cost + β·σ)의 CVaR_α + `ControlRequest.dynamic_obstacles` 시간가변 레이어 |
| `AttitudeCost` | roll/pitch 부드러운 2차 벌점 + 전복 한계 강한 벌점 |
| `ControlCost` | 가속 평활, 횡이동·후진 억제(센서 시야 유지) |

**TrackerController**는 지도를 보지 않는 pure pursuit다. Planner 단독 품질을 재는 데 쓴다.

## 4. 벤치마크 (운동학 시뮬, 4 시나리오 × 3 seed)

`scripts/run_benchmark.py --stacks <planner>+<controller> ...`로 돌린다.

| 스택 | 성공 | 도달시간(s)* | gt_cost | RMS jerk | 계획 ms | 출처 |
|---|---|---|---|---|---|---|
| guidance+mppi | 12/12 | 16.0 | 0.018 | 4.4 | — | `results/split.log` |
| guidance+mppi_smooth | 12/12 | 15.6 | 0.019 | 4.5 | — | 〃 |
| learned+tracker | 5/12 | 16.7 | 0.039 | 7.0 | 0.5 | 〃 |
| learned+mppi | 8/12 | 22.8 | 0.007 | 3.3 | 0.5 | 〃 |
| learned+mppi_smooth | 11/12 | 21.4 | 0.014 | 3.8 | 0.5 | 〃 |
| planner_d+tracker | 6/12 | 16.9 | 0.054 | 4.5 | 3.4 | `results/tp0025_v2/bench.log` |
| **planner_d+mppi** | **12/12** | 15.9 | 0.019 | 3.9 | 3.4 | 〃 |
| planner_d+mppi_smooth | 12/12 | 16.4 | 0.018 | 4.5 | 3.4 | 〃 |
| planner_dd+mppi (DAgger) | 12/12 | 15.9 | 0.019 | 4.0 | 3.4 | 〃 |
| (이전) planner_d+mppi | 8/12 | 17.7 | 0.002 | 2.0 | 3.0 | `results/planner_d_bench.log` |
| (이전) planner_dg+mppi | 9/12 | — | — | — | 65–151 | `results/planner_dg_sweep.log` |

\* 성공한 에피소드 평균. Controller(MPPI) 한 주기는 약 8 ms다. "(이전)"은 시간 참조 진행 항과 직전 계획 유지를 넣기 전이다.

**읽는 법**
- **Planner D가 비학습 기준선과 같은 12/12에 도달했다(TP-0025).** 이전 8/12의 원인은 Planner가 아니라 Controller의
  시간 참조 모드였다. 추종 오차만 있고 진행 항이 없어서, Planner가 건너기로 한 비용 0.7 구간 앞에서 멈춤과 건넘의
  비용이 비슷했다. `ReferenceCost` 시간 모드에 지평 끝 오차 항을 더해 해결했다. 경로 참조 스택(guidance, learned) 결과는 그대로다.
- **분리 전 hybrid의 12/12는 Dijkstra 덕이었다.** 분리 전에는 MPPI의 목표 비용이 Dijkstra cost-to-go였고, 학습
  경로는 샘플링 힌트였을 뿐이다.
- **learned(WaypointNet)는 여전히 8/12다.** 경로 모드라 이번 수정의 영향을 받지 않는다. 치명 셀을 지나는 경로를 내면
  Controller가 진입을 거부하고 멈춘다.
- **벤치마크가 포화됐다.** 기준선과 Planner D가 모두 12/12라 차이를 보려면 seed를 늘리고 동적 장애물·미관측 영역을
  넣어야 한다(TP-0027). seed 10개로 늘려도 포화는 그대로였다(아래 표).
- **mppi_smooth는 막힌 경로 주변을 더 잘 우회한다.** 적분 노이즈의 탐색 폭이 horizon 끝으로 갈수록 커지기 때문이다.
- **Controller 없이 학습 경로만 따라가면 좁은 곳에서 실패한다.** 학습 Planner를 배포하려면 로컬 안전을 맡는
  Controller가 필요하다는 근거다.
- curb_ramp에서 램프가 센서 범위(5 m) 밖에 있으면, 로봇은 미관측 영역을 지나는 경로로 갔다가 되돌아온다.

### seed 10개 평가와 L0 가림 (2026-09-25)

4 시나리오 × 10 seed, `--pedestrians 2`(경로 위 보행자), `--occlusion`(2.5D 시선 검사, 센서 0.30 m)으로 돌렸다(TP-0027, TP-0031).

| 설정 | guidance+mppi | planner_d+mppi | 출처 |
|---|---|---|---|
| 정적 | 40/40 | 39/40 | `results/tp0027_static` |
| 보행자 2명 | 40/40, 충돌 0 | 40/40, 충돌 0 | `results/tp0027_ped` |
| 정적 + 가림 | 36/40 | 38/40 | `results/tp0031_occ` |
| 보행자 2명 + 가림 | 37/40 | 36/40 | `results/tp0031_occ_ped` |

- **seed 10개와 보행자로도 포화가 풀리지 않았다.** Planner D는 학습에 쓰지 않은 seed 3–9 지형에서도 기준선만큼 성공했다.
- **가림을 켜면 포트홀이 문제가 된다.** 가림 실패는 모두 bumps_potholes에서 포트홀 둘레 치명 셀에 들어간 것이다. 센서가 낮으면
  포트홀 앞쪽 턱이 바닥을 가려 belief에 얕은 오목만 남는다. 센서 높이별 bumps_potholes 성공(10 seed)은 guidance+mppi가 0.3 m 6,
  0.5 m 7, 0.8 m 9, 1.2 m 9이고 planner_d+mppi가 8, 9, 10, 9였다(`results/tp0031_h*`).

## 5. 알려진 한계

- **오버행을 표현하지 못한다.** 2.5D라서 나뭇가지나 차단봉 아래 공간을 담을 수 없다. 필요하면 3D occupancy head를 더한다.
- **높은 박스 윗면의 비용이 낮게 나온다.** 윗면은 평탄해서 가장자리만 치명 셀이 된다. 가장자리 때문에 실제로 올라갈 수는
  없지만, "주변 대비 절대 높이" 특징이나 도달성 마스크를 넣는 편이 안전하다.
- **운동학 시뮬에는 슬립과 서스펜션이 없다.** Isaac Sim 단계에서 검증한다.
- **전면 LiDAR 하나라서 옆과 뒤의 지형은 기억뿐이다.** 스워브가 옆·뒤로 움직이면 관측이 오래된 칸에 들어간다. 시야 인지 움직임 비용과
  관측 나이 σ로 다룬다(TP-0062, `docs/design-sensor-layout.md` D4·D5).

## 6. 로드맵

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| P0 ✅ | 인터페이스, 기하 traversability, MPPI, 학습 Planner, 운동학 벤치마크 | 테스트 통과, 비교표 |
| P1 🚧 | Isaac Sim 6.0: 스워브 로봇 USD + LiDAR, 같은 지형 로드, ROS 2 Jazzy 브릿지, L0–L1 인식 격차 측정 | 같은 시나리오 Isaac 폐루프, 인식 격차 기록 |
| P2 🚧 | GPU elevation mapping, 동적 장애물 인식, TravNet 자기지도 학습, 학습 Planner(Planner D), 평가 확장, L0 충실도 보강 | 기하 대비 cost AUROC 개선, 학습 스택 12/12, 포화되지 않은 평가 |
| P3 | Isaac Lab 병렬 환경에서 학습 Planner를 RL로 미세조정(보상 = 성공 − 자세 − traversability 비용). Isaac Lab 3.0 kit-less 경로(Newton·OVPhysX), 지형 난이도 커리큘럼, 보도 장면(URBAN-SIM식 비동기 장면 샘플링) 후보 | 학습 Planner 단독 성공률 개선 |
| P4 | Orin 배포: CUDA/TensorRT 포팅, 계획·제어 주기 예산 | Orin 20 Hz 이내 |
| P5 | Nav2 플러그인화(Planner server + Controller server), 실차. 첫 주행 기록으로 스워브 모델 보정, 스택 여러 개로 SRCC 측정 | 시뮬 순위가 실물 순위를 맞힘(SRCC) |

### P1 세부 단계 (P1.4·P1.5가 남음, 자세한 내용은 `docs/prd.md`, `TODO.md`)

| 단계 | 내용 | 담당 |
|---|---|---|
| P1.0 ✅ | Isaac Sim 4.5.0 → 6.0 업그레이드, ROS 2 Jazzy 네이티브 브릿지 확인 | 사용자(TP-0001) |
| P1.1 ✅ | `heightfield_to_mesh()` 출력을 USD mesh prim으로 변환(IsaacLab `create_prim_from_mesh` 포팅) | claude(TP-0002) |
| P1.2 ✅ | ROS 2 Jazzy 브릿지 노드 뼈대(메시지 인터페이스 + mock publisher) | claude(TP-0003) |
| P1.3 ✅ | 스워브 + LiDAR 로봇의 운동학 프록시(조인트 물리 없이 `SwerveModel` body twist로 구동) | claude(TP-0004) |
| P1.4 | 지형 + 로봇 + 브릿지 통합, 운동학 벤치마크와 성공률 비교(GPU는 2026-09-25 복구) | 사용자(TP-0005) |
| P1.5 | L0–L1 인식 격차 측정: 같은 시나리오의 두 TravMap 비용 오차 분포 비교(판정자 방식) | claude(TP-0040) |

Isaac Sim 6.0(GTC'26 릴리스, Python 3.12)은 Ubuntu 24.04와 ROS 2 Jazzy 네이티브 브릿지를 지원한다
([NVIDIA 문서](https://docs.isaacsim.omniverse.nvidia.com/6.0.0/installation/install_ros.html),
[발표](https://github.com/isaac-sim/IsaacSim/discussions/538)). 4.x/5.0의 내장 브릿지는 Humble용으로만 빌드돼 Jazzy
바이너리가 없다. 호스트(Ubuntu 24.04.3, 여유 342 GB)에서는 IsaacLab 2.3.2가 의존하는 기존 4.5.0을 유지하고 6.0을
별도 경로에 설치한다.

### P2 세부 단계 (자세한 내용은 `docs/prd-p2.md`, `TODO.md`)

| 단계 | 내용 | 담당 |
|---|---|---|
| P2.0 | 센서 하드웨어 확정(근거리 스테레오/RGB-D + 원거리 solid-state LiDAR 중 결정) | 사용자(TP-0009) |
| P2.1 ✅ | GPU elevation mapping: `elevation_mapping_gpu_ros2`(Jetson Orin 포트)를 합성 점군으로 헤드리스 실행하고, `perception/gridmap_bridge.py`로 `GridSpec` 변환까지 확인 | claude(TP-0008) |
| P2.2 ✅ | TravNet 자기지도 학습 설계(`docs/design-travnet-ssl.md`) | claude(TP-0010) |
| P2.3 🚧 | 동적 장애물 탐지·추적: YOLO + ByteTrack PoC와 ROS 2 `obstacle_tracker_node`를 가짜 카메라로 검증(`docs/poc-yolo-bytetrack.md`). Isaac Sim 카메라(TP-0019)는 코드만 있고, GPU가 복구돼 실행 검증을 진행할 수 있다 | claude(TP-0011) |
| P2.3b ✅ | 트래커 출력 → world-frame `DynamicObstacles`(`perception/obstacle_bridge.py`). 카메라 in-the-loop 폐루프 5 seed에서 충돌 0/5, 최소 여유 0.69–0.91 m(정답 입력 0.70–0.77 m와 같은 수준, 2026-09-25 분리 후 재측정) | claude(TP-0018) |
| P2.4 ✅ | 시간가변 동적 장애물 비용 레이어 + MPPI `RiskCost` 통합. 횡단 보행자 충돌 1/3 → 0/3(분리 전 측정). 지금은 `ControlRequest.dynamic_obstacles`로 Controller에 전달 | claude(TP-0012) |
| ~~P2.5~~ | ~~RA-MPPI/DRA-MPPI 샘플링 동적 리스크~~ — MPPI 개선이라 2026-09-25 계획에서 제외 | — |
| P2.6 (보류) | CBF-QP류 안전 필터를 오픈소스 QP로 대체할 수 있는지 조사(Gurobi 라이선스 회피) | claude(TP-0014) |
| P2.7 ✅ | 학습 Planner: Planner D(flow matching 시간 인덱스 궤적), planner_d+mppi 12/12 | claude(TP-0025) |
| P2.8 🚧 | 평가 확장: seed 10개 이상 ✅(TP-0027), 반응형·사건 기반 보행자, 지형 난이도 레벨, 100 m당 실패·충돌 속도·화물 비용 지표 | claude(TP-0027, TP-0036–0039) |
| P2.9 🚧 | L0 충실도 보강: 가림 ✅(2.5D 시선 검사, TP-0031), 지연·자기 위치 잡음, 슬립, 스워브 모듈 모델. 모두 기본값 끔 | claude(TP-0031–0034), 사용자(TP-0035) |
| P2.10 | (조사·PoC) L2 보도 장면: URBAN-SIM·UrbanVerse 장면 활용성 | claude(TP-0041) |

**인식 아키텍처 결론 (2026-09-24).** 자동차용 Occupancy Network(Tesla, MonoScene, TPVFormer 계열)는 Orin 실측이
없거나 데스크톱 GPU에서도 무거워 쓰지 않는다. `elevation_mapping_cupy`(ETH RSL/ANYbotics) 계보의
[`elevation_mapping_gpu_ros2`](https://github.com/iit-DLSLab/elevation_mapping_gpu_ros2)가 Jetson Orin 이식이 확인된
유일한 후보라 1순위로 채택했다. 동적 장애물은 Controller `RiskCost`의 시간가변 비용 레이어로 먼저 다루고, CBF-QP류
안전 필터는 라이선스 문제가 풀릴 때까지 보류한다. 실제 배달로봇 배포 사례(Serve Robotics Gen3, Cartken)는 모두
Jetson **AGX Orin**급을 쓴다. Orin Nano는 여유가 빠듯한 위험 SKU로 본다. 리서치는 주제별 문서로 나뉜다.
[개요](research-overview.md), [인식](research-perception.md), [Planner](research-planner.md), [Controller·안전](research-controller.md),
[시뮬레이션](research-simulation.md), [배경·수식](research-background.md), [참고문헌](research-references.md)이다. 각 주제 문서의 첫 탭이
그 분야의 마일스톤부터 최신(SOTA)까지의 계보다.
