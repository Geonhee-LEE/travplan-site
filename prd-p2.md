# Product Requirements — travplan P2 (인식 + 학습 Planner)

## 1. 북극성

**실제에 가까운 센서 데이터로 지형과 움직이는 장애물을 인식하고, 학습 Planner가 그 위에서 비학습 기준선만큼 안전하게 목표에
도달한다.** 안전 기준은 P1과 같다. 치명 셀에 닿지 않고 목표에 도착하는 것이다.

P0은 합성 지형과 기하 traversability로 검증했고, P1은 같은 지형을 Isaac Sim 폐루프로 재현하는 단계다. P2는 두 가지 간극을 메운다.
첫째, **진짜에 가까운 센서에서 진짜 인식 신호가 나오는가**(elevation mapping, TravNet 자기지도 학습, 동적 장애물 인식). 둘째,
2026-09-25 Planner/Controller 분리 이후 **학습 Planner가 비학습 Planner를 대체할 만큼 좋은가**다. 동적 장애물 처리는 원래 로드맵에
없었고 P2에서 새로 넣었다.

2026-09-25 Planner D가 비학습 기준선과 같은 12/12에 도달하면서 병목이 **평가**로 옮겨 갔다. 벤치마크가 포화돼 두 스택을 가르지 못하고,
운동학 시뮬(L0)은 가림·지연·슬립이 없어 낙관적이다. 시뮬레이션 조사(`docs/research-simulation.md`)의 결론에 따라 P2 후반은 평가를 넓히고
(P2.8) L0의 낙관 편향을 줄이는(P2.9) 데 쓴다. 보도 전용 장면(L2)은 조사와 PoC까지만 한다(P2.10).

### P2 완료 기준
- GPU elevation mapping이 점군에서 TravMap과 호환되는 높이 채널을 Orin 실시간 예산(10 Hz 이상) 안에서 만든다.
- TravNet(학습 `TraversabilityEstimator`)이 시뮬레이션 접촉·슬립 로그로 자기지도 학습되어, 기하 추정기보다 측정 가능한 개선(cost AUROC)을 보인다.
- 움직이는 장애물(보행자 등)이 최소 한 가지 방식(시간가변 비용 레이어)으로 Controller에 반영되어, 정적 장면과 확연히 다른 회피 행동을 보인다.
- 학습 Planner(Planner D)가 같은 Controller 위에서 비학습 기준선(guidance+mppi, 12/12)과 같은 성공률을 낸다.
- 평가가 포화되지 않는다. 보행자 반응, 지형 난이도, seed 10개 이상에서 guidance+mppi와 planner_d+mppi의 차이가 드러나거나, 차이가 없음을
  확인한다(R-F-009).
- L0 충실도 옵션(가림, 지연, 자기 위치 잡음, 슬립, 스워브 모듈)을 하나씩 켠 벤치마크에서 스택별 성공률 변화를 기록한다(R-F-010).

### 하지 않는 것
- **CBF-QP·OcclusionCBF류 강한 안전 필터의 실제 도입.** Gurobi 상용 라이선스 문제로 이번 단계는 오픈소스 대체 조사까지만 한다.
- **학습 궤적 예측기(Trajectron++ 계열)의 제품 통합.** Jetson 실측이 없어 등속 + 불확실성 모델로 먼저 가고, 학습 예측기는 후속 과제로 둔다.
- **실제 로봇 조립과 실외 필드 시험.** 이번 단계는 설계·PoC·시뮬레이션까지다. 센서 구매(R-F-005)는 포함하지만 장착과 필드 검증은 범위 밖이다.
- **자동차용 Occupancy Network(MonoScene, TPVFormer, SurroundOcc 계열) 채택.** Orin 실측이 없고 데스크톱 GPU에서도 무겁다(MonoScene은 RTX 4090에서 프레임당 0.87초).
- **사각지대(가림) 전용 처리.** 검증된 대안(OA-MPC, OACP, Control-Tree)은 모두 48–200 ms로 Orin 예산 밖이고, 빠른 OcclusionCBF는 Gurobi 문제가 같아 P2 이후로 미룬다.
  L0 시뮬에 가림을 **재현**하는 일(R-F-010)은 이것과 다르며 P2에서 한다.
- **변형 지면 시뮬레이션**(Chrono SCM, Newton MPM). 보도는 대부분 단단하다. L0의 슬립 무작위화(R-F-010)로 먼저 대신한다.
- **관절 물리 스워브.** GPU 물리의 바퀴 접촉이 아직 불안정하다(`docs/research-simulation.md` S.5.2). 모듈 수준 운동학 모델(R-F-010)로 대신한다.
- **world model 시뮬과 사진 같은 렌더링**(NWM, Cosmos, 3DGS·NuRec). 카메라 모듈 폐루프가 필요해지는 TP-0022·TP-0011 이후로 미룬다.
- **시뮬 엔진 교체**(Genesis, MuJoCo 단독, Gazebo 주력). 보도 시뮬레이터 생태계가 Isaac Sim 위에 있다.

## 2. 단계별 로드맵

| 단계 | 내용 | 담당 | 완료 기준 |
|---|---|---|---|
| P2.0 | 센서 하드웨어 확정(스테레오/RGB-D + solid-state LiDAR 후보 중 결정) | 사용자(TP-0009) | SKU 확정과 구매 |
| P2.1 ✅ | GPU elevation mapping: `elevation_mapping_gpu_ros2`(Jetson Orin 포트) 조사와 `TravMapBuilder` 연결 PoC | claude(TP-0008) | 점군 → 높이 채널 PoC 동작. **헤드리스 실행으로 검증** |
| P2.2 ✅ | TravNet 자기지도 학습 설계(WVN, V-STRONG, ScaTE 참고) | claude(TP-0010) | 설계 문서 + 스텁(`docs/design-travnet-ssl.md`) |
| P2.3 🚧 | 동적 장애물 탐지·추적 PoC(YOLO + ByteTrack, Isaac Sim 카메라 대상) | claude(TP-0011, TP-0019) | 시뮬 카메라 영상에서 탐지·추적 동작. 가짜 카메라로는 검증했다. GPU가 복구돼(2026-09-25) Isaac 카메라 검증을 진행할 수 있다 |
| P2.4 ✅ | 시간가변 동적 장애물 비용 레이어 + Controller `RiskCost` 통합(`ControlRequest.dynamic_obstacles`) | claude(TP-0012) | 동적 장애물이 있을 때 회피 행동 관측 |
| P2.5 | 샘플링 제어기의 확률 제약: GP 분산을 비용이 아니라 제약으로(RA-MPPI·DRA-MPPI 계열) — **2026-09-30 재개**(§7) |  claude(TP-0076) | MPPI가 GP 분산으로 여유를 조이는 것을 벤치마크에서 확인 |
| P2.6 (보류) | CBF-QP 계열 안전 필터를 오픈소스 QP로 대체할 수 있는지 조사 | claude(TP-0014) | 대체 가능 여부 결론 |
| P2.7 ✅ | 학습 Planner: Planner D(flow matching 시간 인덱스 궤적) | claude(TP-0025) | planner_d+mppi 12/12(2026-09-25 달성) |
| P2.8 🚧 | 평가 확장: seed 10개 이상 ✅(TP-0027), 반응형·사건 기반 보행자, 지형 난이도, 100 m당 실패·충돌 속도·화물 비용 지표 | claude(TP-0027, TP-0036–0039) | 두 스택의 차이를 판정할 수 있는 평가표 |
| P2.9 🚧 | L0 충실도 보강: 가림 ✅(TP-0031), 지연·자기 위치 잡음, 슬립, 스워브 모듈 모델 | claude(TP-0031–0034), 사용자(TP-0035 모듈 파라미터) | 옵션별 스택 성공률 변화 기록 |
| P2.10 | (조사·PoC) L2 보도 장면: URBAN-SIM·UrbanVerse 장면 활용성, SidewalkBench 코드 공개 추적 | claude(TP-0041) | 도입 여부 결론 |

## 3. 기능 요구

### R-F-001 GPU elevation mapping — ✅ PoC 완료 (TP-0008, 2026-09-24)

`elevation_mapping_cupy`(ETH RSL/ANYbotics) 계보 가운데 **Jetson Orin 포트가 실제로 있는 `iit-DLSLab/elevation_mapping_gpu_ros2`**를 1순위로
조사했다. 필터링한 점군 기준 최대 약 50 Hz, RealSense 원시 점군 기준 약 16 Hz가 보고돼 있다.

`travplan_ws/src/elevation_mapping_cupy`에 코드를 가져와 합성 점군으로 **헤드리스 실행까지 검증**했다. `grid_map_msgs/GridMap`(레이어:
elevation, variance, traversability)이 실제로 발행되고, 로봇이 움직이며 지형 값이 채워지는 것을 `ros2 topic echo`로 확인했다. 이 메시지를
`GridSpec`으로 바꾸는 `travplan/perception/gridmap_bridge.py`도 만들고 테스트했다(이 포크의 CUDA 커널은 row = Y, col = X로 뒤집힘 없이
맞는다는 것을 실측으로 확인). `TravMapBuilder`가 합성 heightfield 대신 이 경로를 쓰도록 잇는 일은 다음 단계다.

**시간 예산 실측(TP-0083, 2026-09-30, RTX 4070 Laptop, `results/p2-l1-timing.tsv`).** 병목은 elevation mapping이
아니라 그 뒤의 `TravMapBuilder.build`다.

| 단계 | 평균 | 비고 |
|---|---|---|
| 합성 LiDAR `scan` | 6.7 ms | **시뮬 전용**. 실물에서는 LiDAR 하드웨어가 한다 |
| `mapper.update`(GPU) | **3.7 ms** | 약 270 Hz 상당. 지도 크기·점 수에 거의 둔감하다 |
| `TravMapBuilder.build`(CPU) | **32.8 ms** | 전체의 76%. `compute_features`가 대부분 |
| 〃 + 깊이 prior 0.10 | **65.6 ms** | 86%. 깊이 prior가 **+32.8 ms**이고, 그 중 `shadow_evidence_m=1.0`의 k=21 maxpool 두 번이 **23.1 ms**(11.5 ms × 2)다 |

**R-NF-001의 "10 Hz 이상"은 매퍼 단독으로는 크게 통과한다.** 그런데 폐루프 한 스텝(dt = 0.1 s)으로 보면 실물에 해당하는
비용이 `mapper + build`이고, 권장 설정(깊이 prior 켬)에서 **69 ms**다. 여기에 계획 3.4 ms와 제어 7.8 ms를 더하면
**100 ms 예산의 81%**를 쓰고, 검출·추적은 아직 들어가지 않았다. ==Orin은 이 랩탑보다 느리므로 그대로 두면 이 문서가
"예산 밖"으로 기각한 48–200 ms 구간에 들어간다.== Orin 실측은 없다(하드웨어 없음).

**여유를 만들었다(TP-0084, 2026-09-30).** `TravMapBuilder(device="cuda")`를 더했다. 왕복(H2D + D2H)을 포함해
기본 35.0 → **1.35 ms(26배)**, 깊이 prior 70.4 → **1.59 ms(44배)**이고 출력은 CPU와 같다(유한 셀 최대 오차 3.0e-07,
비유한 패턴 불일치 0. TP-0153에서 비트 단위로 맞췄다). ==외부 계약은 그대로다== — 부른 쪽 device로 돌려주므로 numpy를 쓰는 `GuidancePlanner`도 영향이
없다. CUDA가 없으면 조용히 CPU로 내려간다. 폐루프 8 에피소드가 **결과 동일**하고 벽시계 111.8 s → **31.8 s**다.

이제 실물에 해당하는 비용이 `mapper 3.7 + build 1.6` ≈ **5 ms**, 100 ms 예산의 5%다. 그다음 knob은 격자 해상도이고
(0.05 → 0.10에서 CPU `build`가 7.8배) 아직 쓰지 않았다. **Orin 실측은 여전히 없다.**

**측정에서 드러난 것 하나 더.** `belief_map()`은 `replan_every`와 무관하게 **매 제어 스텝** 호출되는데
(`travplan/eval/runner.py`), 그 비용은 `plan_ms`에도 `control_ms`에도 들어가지 않는다. ==지금까지 보고해 온
"계획 3.4 ms"는 인식·표현 비용을 뺀 숫자다.== 실시간 주장을 할 때는 이 둘을 더해야 한다.

RoadRunner(JPL·Caltech·ETH)는 "카메라 + LiDAR → traversability와 높이를 함께 출력, hindsight 자기지도"라는 모델 설계의 참고로만 쓴다(데스크톱
전용, Orin 미검증). 카메라 단독 대안(WalkOCC, OneOcc 등)은 배포 증거가 얇아 후보로만 추적한다(`docs/research-perception.md` §A).

**PoC에서 해결한 문제**(자세한 내용은 `travplan_ws/src/elevation_mapping_cupy/VENDORED.md`):
1. `cv_bridge`가 NumPy 1.x로 빌드돼 NumPy 2 이상(cupy·scipy 의존)과 충돌했다 → 선택적 import로 고쳤다.
2. CUDA 커널 앞부분이 `float16`을 미완성 타입으로 잘못 참조했다 → `float`로 바꿨다(업스트림 cupy 버전에 따른 버그라 보고할 가치가 있다).
3. `ros-jazzy-fastcdr`가 `ros-jazzy-grid-map-msgs`보다 오래된 빌드라 심볼이 충돌했다 → 전체 `apt upgrade`로 풀었다(부분 업그레이드는
   `rclpy.Node()` 생성 자체를 깨뜨린다).

### R-F-002 TravNet 자기지도 학습

Wild Visual Navigation(ANYmal 온보드 실행 확인), V-STRONG, ScaTE처럼 "시각 특징 + 접촉·proprioception 피드백"으로 자기지도 학습한다. 라벨
출처를 새로 만들지 않고 시뮬레이션 폐루프(운동학 시뮬 → Isaac Sim)에서 얻는다. 기존 `TraversabilityEstimator` 프로토콜의 구현체로 추가한다.
설계는 `docs/design-travnet-ssl.md`에 있다.

### R-F-003 동적 장애물 탐지·추적

YOLO 계열 검출기와 ByteTrack/BoT-SORT를 묶는다(Jetson급 실시간 보고가 있다. 예: Orin Nano Super 1080p 약 30 fps). DeepSORT류 재식별은 로봇 한
대 배포에는 불필요한 비용이라 쓰지 않는다. 실물 센서 없이 **Isaac Sim 카메라 영상**으로 시작할 수 있다. 진행 상황은 `docs/poc-yolo-bytetrack.md`.

### R-F-004 동적 장애물의 Controller 통합

먼저 **시간가변 비용 레이어**를 쓴다. 예측한 장애물 위치 주변에 거리에 따라 줄어드는 비용을 얹는 방식으로, 기존 TravMap 채널 구조를 그대로 쓸
수 있어 구현 비용이 가장 낮다. 예측은 등속 + 불확실성 모델로 시작한다(Trajectron++ 계열은 정확도가 높지만 Jetson 실측이 없어 후속 과제). 예측한
장애물은 `ControlRequest.dynamic_obstacles`로 Controller(`MPPIController`의 `RiskCost`)에 전달한다.

### R-F-005 센서 하드웨어 사양

**구성은 정해졌다(2026-09-27): 전면 3D LiDAR 1개, 카메라 전면 2개·측면 2개·후면 1개, 차체는 자율주행차·휴머노이드보다 낮다.**
설계 권장안은 `docs/design-sensor-layout.md`(TP-0060)에 있다. 요점은 네 가지다.

- **LiDAR는 먼저 숙이고, 그다음 높인다.** 기울기를 포함한 아래쪽 시야 끝을 25° 이상, 근거리 사각을 약 1 m 이하로 만든 뒤 차체가 허락하는 한
  높이 단다. L1 시뮬(TP-0060)에서 수직 ±12.5° 센서를 숙이지 않고 0.8 m로 올리면 사각이 3.6 m가 되어 치명 셀 재현율이 0.63으로 나빠졌고,
  15° 숙이면 0.80이었다. Mid-360형은 똑바로 달면 앞쪽 절반을 못 본다. L0 가림 실험(TP-0031)에서 센서가 0.3 m면 포트홀 둘레
  치명 셀 진입이 4/10, 0.8 m면 1/10이었다. L1(TP-0053)에서도 0.3 m → 0.8 m로 치명 셀 재현율이 0.70 → 0.84로 올랐다.
- **전면 카메라 두 대는 스테레오로 묶는다.** LiDAR 근거리 사각을 스테레오 깊이로 메우고, 사람 검출과 거리 교차 확인에 쓴다.
- **측면·후면 카메라는 사람을 360°로 본다.** 거리는 단안 바닥 평면으로 구하므로 IMU 자세 보정이 필수다.
- **옆과 뒤의 지형은 기억뿐이다.** 스워브의 옆·뒤 이동은 최근에 본 칸으로 제한하고, 속도는 음의 장애물 탐지 거리로 제한한다.

LiDAR 모델, 시야각, 장착 높이·기울기, 카메라 사양은 아직 정해지지 않았다. SKU 확정과 구매는 예산이 걸린 **사용자 결정**(TP-0009,
사양 제공은 TP-0064)이고, 이 PRD는 권장안과 근거만 제공한다.

### <del>R-F-006 (연구) 샘플링 기반 동적 리스크</del> — 계획에서 제외 (2026-09-25)

MPPI 자체를 개선하는 일이라 Controller 범주다(§7). 조사 기록만 남긴다. RA-MPPI([arXiv 2209.12842](https://arxiv.org/abs/2209.12842))와
DRA-MPPI([arXiv 2506.21205](https://arxiv.org/abs/2506.21205))는 travplan의 샘플링 + CVaR `RiskCost`(`control/mppi/costs.py`)와 구조가 가장
자연스럽게 맞지만, 공개 수치가 RTX 2080 노트북 GPU에서 반복당 97–115 ms(약 5 Hz)이고 Orin 실측이 없다.

### R-F-007 (연구) 오픈소스 QP 안전 필터 — 후보 확정 (2026-09-24)

CBF-QP 계열(OcclusionCBF 포함, 스텝당 0.6–4.5 ms)은 강한 안전 보장을 주지만, OcclusionCBF 참조 구현은 Gurobi 상용 라이선스를 요구한다.
**대체 후보로 [Risk Adaptive CVaR Barrier Functions](https://arxiv.org/abs/2504.06513)(IROS 2025)를 확정했다.** 공식 구현
([Adaptive-CVaR-Barrier-Function](https://github.com/Lawliet9666/Adaptive-CVaR-Barrier-Function))의 `requirements.txt`를 직접 확인한 결과
의존성은 `casadi`, `numpy`, `scipy`뿐이다. Gurobi나 cvxpy가 아니라 **오픈소스 CasADi**(내부적으로 qpOASES·IPOPT)로 풀므로 라이선스 걸림돌이
없다. travplan `RiskCost`가 이미 CVaR를 쓰므로 개념적으로도 가장 가깝다.

**남은 일은 하나다.** CasADi 기반 CVaR-BF를 Controller(MPPI) 출력 뒤에 안전 필터로 붙였을 때 스텝당 지연을 Orin(최소한 로컬 GPU)에서 재는 것이다.
자세한 비교는 `docs/research-controller.md` §C. OcclusionCBF는 Gurobi 문제로 계속 채택하지 않는다.

### R-F-008 학습 Planner (Planner D) — 충족 (TP-0025, 2026-09-25)

학습 Planner는 TravMap 크롭, route subgoal, 현재 속도를 받아 **4초짜리 시간 인덱스 궤적**(`PlanResult.path`, `times`)을 낸다. 제어 변화율을 생성해
`SwerveModel`로 굴리므로 모든 후보가 스워브 한계 안에 있어야 한다. 학습 데이터는 사람 라벨 없이 시뮬레이션에서 만든다. 평가는 같은 Controller 위에서
Planner만 바꾼 스택 벤치마크(`scripts/run_benchmark.py`)로 한다. 목표였던 12/12를 달성했다(planner_d+mppi, 계획 3.4 ms, `results/tp0025_v2/bench.log`).
설계 근거는 `docs/research-planner.md` §B.8.3.

### R-F-009 평가 확장 (SidewalkBench·CostNav 틀)

평가를 세 층으로 나눈다. SidewalkBench(CoRL 2026)의 구성을 빌렸다(`docs/research-simulation.md` S.2.5).
1. **단위 시험.** 지형 시나리오 4종을 난이도 레벨로 연다. 연석 높이, 램프 폭, 포트홀 간격, 경사각이 손잡이다. 레벨을 올리며 스택별
   성공률이 50%로 떨어지는 **실패 경계**를 잰다(TP-0039). Isaac Lab과 Rudin 등(2021)의 지형 커리큘럼과 같은 구조라, 같은 레벨을 Planner D
   학습 커리큘럼에도 쓸 수 있다.
2. **보행자 반응.** 지금의 등속 보행자(`crossing_pedestrians`)에 두 가지를 더한다. ORCA 반응형 보행자(TP-0036)는 로봇 회피 책임 비율
   $\rho \in [0, 1]$로 조절하고, $\rho = 0$이면 로봇에 반응하지 않는다. 사건 기반 보행자(TP-0037)는 정면 접근, 측면 접근, 추월, 횡단,
   가로막기의 5종이다. 사건은 로봇과의 상대 위치로 발동하고 seed로 재현된다.
3. **장거리.** 100 m 이상 코스는 지금 지도 크기(약 16 m)로는 만들 수 없다. L2 장면(R-F-011)이나 시나리오 연결로 만든다.

지표는 기존 값(성공, 도달 시간, RMS jerk, 보행자 최소 여유 `min_obs_clear_m`)에 세 가지를 더한다(TP-0038). 첫째, 100 m당 실패(충돌, 보도 이탈,
멈춤)다. 멈춤은 일정 시간 진행이 없는 경우이고 기준 시간은 TP-0038에서 정한다. 둘째, 충돌 순간 상대 속도로, 보행자 상해 위험의 대리값이다. 셋째, 화물 손상 비용이다. CostNav처럼 jerk와 충격이 임계를
넘은 비율을 손상 확률로 보고 비용 열로 환산한다. 성공률이 같은 스택을 가르는 데 쓴다. 전체 평가는 seed 10개 이상이다(TP-0027). cron의
2분 상한(`docs/prd.md` R-NF-002)을 넘으므로 사용자나 대화형 세션이 실행한다.

### R-F-010 L0 충실도 보강 (`sim/kinematic_sim.py`)

L0는 5 m 원 안을 가림 없이 보고, 지연·슬립·조향 지연이 없다(`docs/research-simulation.md` S.6.5). 아래 다섯 가지를 `SimConfig` 옵션으로
더한다. **모두 기본값은 끈다.** 기존 벤치마크 결과를 그대로 재현하기 위해서다.

| 옵션 | 내용 | TODO |
|---|---|---|
| 가림 | 센서 높이와 수직 시야각을 둔 2.5D 시선 검사(수평선 알고리즘). 가려진 칸은 미관측으로 남는다. TP-0029(미관측 영역 시나리오)의 선행 | TP-0031 ✅ |
| 지연·자기 위치 잡음 | 센서→지도, 계획, 제어 지연(스텝 단위)과 자세 잡음·누적 드리프트를 무작위화 | TP-0032 |
| 슬립 | 경사·거칠기 채널에 따라 슬립비 s를 뽑아 실제 이동을 (1 − s) × 명령으로 줄임 | TP-0033 |
| 스워브 모듈 모델 | 모듈별 조향 속도 한계, 감속·조향·가속 반전, 정렬 게이트, 최소제곱으로 되돌린 실현 body twist | TP-0034 |

**가림 결과(TP-0031, 2026-09-25, 4 시나리오 × 10 seed).** 정적 벤치마크는 guidance+mppi 40/40에서 36/40으로, planner_d+mppi는
39/40에서 38/40으로 내려갔다. 실패는 모두 bumps_potholes에서 포트홀 둘레 치명 셀에 들어간 것이다. 포트홀 앞쪽 턱이 바닥을 가려 belief에
얕은 오목만 남는 탓이다. 화분 같은 양의 장애물은 실패를 만들지 않았다. 센서를 0.8 m 이상으로 올리면 실패가 1/10 수준으로 준다
(R-F-005). 남은 위험은 음의 장애물 대응(TP-0044)으로 다룬다.

스워브 모듈 모델은 ROBOTIS AI Worker `ffw_swerve_drive_controller`의 Python 이식본(로컬 참고 사본)을 참고한다. 파라미터는 배달로봇 값(TP-0035, 사용자 제공)을
쓴다. 그 전에는 AI Worker 값(3모듈, 조향 속도 한계 8 rad/s, 정렬 임계 0.1 rad)을 임시로 쓰고 결과에 그렇게 적는다.

각 옵션은 켰을 때와 껐을 때의 스택별 성공률, 도달 시간, 충돌을 `results/`에 남긴다. Controller(MPPI)의 rollout 모델을 모듈 모델로 바꿀지는
이 결과를 보고 정한다. MPPI 수정은 유지보수와 Planner 검증 범위 안에서만 한다(§7).

### R-F-011 (조사·PoC) L2 보도 장면

L0의 손으로 만든 시나리오 4개는 장면 다양성이 부족하다. UrbanVerse에서는 현실 분포를 따른 배치 수를 늘릴수록 성능이 멱법칙으로 올랐고,
템플릿 기반 절차 생성은 거의 오르지 않았다(`docs/research-simulation.md` S.2.3). 도입 전에 세 가지를 확인한다(TP-0041).
1. **URBAN-SIM**(코드 Apache-2.0): 따로 내려받는 에셋의 라이선스를 확인한다. Isaac Sim 5.x 소스 빌드 요구가 설치된 6.0과 공존하는지 본다.
   RTX 5080(16 GB, 권장 12 GB 이상)에서 실행해 본다.
2. **UrbanVerse**: 장면 160개와 UrbanVerse-100K 에셋의 라이선스와 형식을 확인한다.
3. 장면에서 높이장과 보행자 궤적을 뽑아 L0 시나리오로 쓰는 경로를 찾는다. 안 되면 WFC 지형 생성 같은 절차만 `sim/terrain.py`에 옮긴다.

SidewalkBench는 코드가 공개되면(현재 "coming soon") 평가 틀째로 쓸 수 있는지 다시 본다.

### R-F-012 (설계) sim-to-real 예측력

실물 로봇이 생기기 전에 측정 방법을 먼저 정한다(TP-0043). 실물 측정 자체는 P5다.
- **SRCC.** 스택 4개 이상(guidance+mppi, planner_d+mppi, learned+mppi, +tracker 조합)을 같은 실외 코스에서 시뮬과 실물로 돌린다. 지표(성공,
  도달 시간, 개입)마다 시뮬·실물 값의 Pearson 상관을 잰다(Kadian 등, RA-L 2020). 상관이 낮으면 시뮬 허점을 찾아 고친다.
- **첫 주행 보정.** body twist 명령과 실제 속도, 모듈 조향각, 지연을 기록할 항목을 정한다. 이 기록으로 `SwerveLimits`와 모듈 파라미터를 맞춘다.

## 4. 비기능 요구

### R-NF-001 Orin 실시간 예산
elevation mapping은 10 Hz 이상, 탐지·추적은 카메라 프레임레이트에 가깝게 돌아야 한다. 전체 파이프라인이 폐루프 제어 주기를 방해하지 않아야 한다.
Cartken과 Serve 모두 Jetson **AGX Orin**급을 쓴다는 선례에 따라, Orin Nano는 여유가 빠듯한 위험 SKU로 본다.

### R-NF-002 사람 라벨 없는 학습 데이터
TravNet과 학습 Planner의 학습 데이터는 사람이 만들지 않는다. 시뮬레이션의 접촉·슬립 로그와 비학습 스택의 시연만 쓴다.

### R-NF-003 안전과 변경 관리
P1 규칙을 그대로 따른다. 코드는 브랜치 + PR로만 바꾼다. `TODO.md`, `STATE.md`, `JOURNAL.md`, `journal/`, `research/`, `results/`만
`automation/state_push.sh`를 거쳐 `main`에 바로 push할 수 있다. daily_executor의 시스템 변경 금지와 시뮬레이션 2분 상한(`docs/prd.md` R-NF-002/003)도 같다.

### R-NF-004 비용·전력 가시성
센서 후보별 비용(USD), 전력(W), 범위(m)를 R-F-005 조사 문서에 표로 남긴다. 예산 논의에 바로 쓸 수 있게 하기 위해서다.

## 5. 성공 지표

### 단기 (P2.1–P2.3, cron이 진행 가능)
- [x] `elevation_mapping_gpu_ros2` 조사와 `TravMapBuilder` 연결 판단(TP-0008)
- [x] TravNet 설계 문서 + `TraversabilityEstimator` 스텁(TP-0010)
- [ ] Isaac Sim 카메라 영상에서 YOLO + ByteTrack 동작(TP-0011, GPU 복구로 진행 가능)

### 중기 (P2.4, P2.7)
- [x] 동적 장애물이 있을 때 Controller가 확연히 회피(TP-0012)
- [ ] 센서 하드웨어 확정·구매(TP-0009)
- [x] 학습 Planner가 비학습 기준선과 같은 성공률(TP-0025, 12/12)
- [ ] 난이도 레벨별 실패 경계와 보행자 반응 평가로 두 스택을 가르는 평가표(P2.8)
- [ ] L0 충실도 옵션별 스택 성공률 변화 기록(P2.9)

### 장기 (P2 종료)
- [ ] TravNet이 기하 추정기보다 cost AUROC가 높다
- [ ] R-F-007 결론 확보, P3 로드맵 반영 여부 결정(R-F-006은 2026-09-25 제외)
- [ ] L2 보도 장면 도입 여부 결론(R-F-011)
- [ ] sim-to-real 예측력 측정 프로토콜 문서(R-F-012)

## 6. 위험과 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| `elevation_mapping_gpu_ros2`가 travplan의 `GridSpec`/TravMap 규약과 맞지 않음 | P2.1 지연 | PoC에서 어댑터 범위만 먼저 확인, 안 맞으면 자체 GPU 커널로 축소. **→ 맞음을 확인했다** |
| 자기지도 라벨(접촉·슬립)이 운동학 프록시 특성상 부족함(P1은 스워브 물리를 쓰지 않음) | 학습 신호 품질 저하 | 초기에는 기하 추정기의 보정용으로만 쓰고, 물리 충실도가 필요하면 P3에서 다시 본다 |
| 힘든 곳 라벨이 드묾(측정 결과 0–7%) | TravNet이 지나가지 않은 곳에서 과신 | 탐색 정책 혼합, PU loss 후보(`docs/design-travnet-ssl.md` §4) |
| 등속 예측이 실제 보행자 행동과 크게 다름 | 과잉 회피나 위험 상황 | 비용 레이어를 보수적으로(반경 크게) 시작하고 예측 모델을 점진적으로 보강 |
| 학습 Planner가 좁은 지형에서 치명 셀을 지나는 궤적을 냄 | Controller가 멈춰 시간 초과 | **해결**(TP-0025). 원인은 Controller 시간 참조 모드에 진행 항이 없던 것이었다. planner_d+mppi 12/12 |
| 벤치마크 포화로 학습 Planner 개선을 판별하지 못함 | 개발 방향을 정할 근거가 없음 | 평가 확장(R-F-009): 난이도 레벨, 반응형·사건 기반 보행자, 비용 지표, seed 10개 이상 |
| L0가 낙관적임(가림·지연·슬립·조향 지연 없음) | 벤치마크가 실물보다 좋게 나옴 | L0 충실도 옵션(R-F-010), L1 인식 격차 측정(`docs/prd.md` R-F-010), 실물 뒤 SRCC(R-F-012) |
| ORCA·사건 기반 보행자가 실제 행동과 다름 | 보행자 평가가 현실을 대표하지 못함 | 사건 기반으로 재현성을 먼저 확보한다. 데이터 기반 보행자(NavIsaacLab류)는 L2에서 본다 |
| URBAN-SIM 에셋 라이선스가 불명확하거나 Isaac Sim 5.x 빌드가 6.0과 충돌 | L2 도입 지연 | R-F-011에서 먼저 확인한다. 안 되면 절차 생성 아이디어(WFC)만 L0에 옮긴다 |
| 배달로봇 스워브 모듈 파라미터를 확보하지 못함 | 모듈 모델이 실물과 다름 | AI Worker 값을 임시로 쓰고 결과에 적는다. 사용자 제공(TP-0035) 뒤 교체한다 |
| 음의 장애물(포트홀)이 가림으로 절반만 보임 | 포트홀 둘레 치명 셀 진입(L0 가림, 센서 0.3 m에서 4/10) | LiDAR를 높이 달고 숙인다(R-F-005, TP-0060). 그림자 상한과 깊이 prior를 켠다(TP-0044, TP-0047) |
| 전면 단일 LiDAR라 옆·뒤 지형이 기억뿐 | 스워브 옆·뒤 이동으로 미관측 칸에 들어감 | 시야 인지 움직임 비용과 관측 나이 σ(TP-0062), 측면·후면 카메라로 사람 감시 |
| 센서 SKU 확정 지연 | P2.0·P2.4 검증이 실물 없이 시뮬로만 진행 | R-F-003/004는 Isaac Sim 카메라만으로 먼저 PoC할 수 있게 설계했다 |
| CVaR-BF가 travplan에 붙였을 때 지연이 큼 | R-F-007이 막다른 결론 | 결과가 부정적이면 그대로 기록하고 P2에서는 CBF-QP류를 배제한다 |

## 7. 의사결정 원칙

- 모든 TODO는 위 로드맵(P2.0–P2.10) 중 한 단계에 속해야 한다.
- 모듈 경계(`core/types.py`, `planners/base.py::Planner`, `control/base.py::Controller`, `TraversabilityEstimator`)는 바꾸지 않는다. 새 코드는 이
  프로토콜의 구현체이거나 `representation/` 또는 `control/mppi/costs.py` 안의 새 `CostTerm`이어야 한다.
- **Planner는 학습 기반으로 개발하고, Controller는 MPPI와 acados NMPC 두 갈래를 함께 개발한다**(2026-09-30 사용자 결정).
  2026-09-25의 "MPPI는 계획에서 제외"를 대체한다. 두 갈래를 두는 이유는 강점이 갈리기 때문이다 — MPPI는 비평활 비용을,
  NMPC는 hard 제약과 튜브를 다룬다. 둘은 같은 프로토콜 구현체이고 같은 벤치마크로 비교하며, 잔차 GP를 공유한다.
- 센서 구매나 필드 시험처럼 예산·물리적 결정은 늘 사람의 몫이다. Owner=user TODO로만 표현한다.
- 실시간 성능 주장에는 반드시 실측(Orin, 최소한 벤치마크 스크립트 결과)을 붙인다. 논문이나 벤더 수치를 그대로 채택하지 않는다.
- Gurobi처럼 상용 라이선스가 필요한 구성 요소는 오픈소스 대체 조사가 끝나기 전에는 채택하지 않는다.
- 시뮬 결과에는 어느 층에서 쟀는지 붙인다(L0 운동학, L1 Isaac, L2 보도 장면, L3 실물). L0 결과만으로 실물 성능을 주장하지 않는다.
- L0 충실도 옵션은 기본값을 끈 채 더한다. 기존 결과의 재현성을 지키고, 켰을 때의 변화를 따로 보고한다.
- 새 시뮬 엔진이나 렌더러는 분명한 목적(변형 지면, 카메라 폐루프)이 생길 때만 들인다(`docs/research-simulation.md` S.7).

## 8. 변경 관리

- **코드**: P1과 같다. `main` 병합은 사람만 하고, daily_executor는 브랜치 + PR만 만든다.
- **상태 파일**(`TODO.md`, `STATE.md`, `JOURNAL.md`, `journal/`, `research/`, `results/`): `automation/state_push.sh`로만 `main`에 바로 push한다.
- **이 문서와 `docs/ARCHITECTURE.md`**: 사람이 편집하고 cron 에이전트는 읽기만 한다.

_Last updated: 2026-09-25 (시뮬레이션 조사 반영) · 관련: `docs/prd.md`(P1), `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/research-simulation.md`, `TODO.md`_
