<!-- doc: 개요 | 0 -->
# 리서치 개요 (2026-09)

**travplan의 리서치는 이 개요와, 파이프라인 순서의 네 주제 문서, 두 보조 문서로 나뉜다.** 주제 문서는 인식, Planner,
Controller·안전, 시뮬레이션이고, 보조 문서는 여러 논문이 함께 쓰는 수식(배경·수식)과 전체 목록(참고문헌)이다. 각 주제 문서의 첫 탭은 그 분야의
**계보**다. 분야를 연 마일스톤에서 2026년 최신(SOTA)까지 한 표로 보여 주고, 공개 모델(HuggingFace)과 코드(GitHub) 현황을 함께 둔다.
그다음 탭들이 세부 주제별 설명이다.

각 방식은 같은 순서로 소개한다. **한 줄 요약**으로 무엇인지 말하고, **동작 방식**을 설명하고, **travplan에 주는 의미**로 마무리한다.
논문 그림에는 무엇을 보여주는지 한 줄 설명을 붙였다. 방법과 수식은 그림 뒤의 **"자세히"** 토글에 있다. ==노란 강조==는 그 절에서
가장 먼저 기억할 문장이다.

```
 센서(카메라/LiDAR)                                                            동적 장애물(보행자)
      │                                                                              │
      ▼                                                                              ▼
 ┌──────────────────┐    ┌───────────┐    ┌──────────────────┐    ┌──────────────────────────────┐
 │ 인식 (§A)         │──▶ │ TravMap   │──▶ │ Planner (§B)      │──▶ │ Controller · 안전 (§E, §C)     │──▶ body twist
 │ 지형 지도, 가통행성 │    │ [8,H,W]   │    │ 학습 궤적 생성     │    │ MPPI 추종, 안전 필터            │
 │ 동적 장애물 인식    │    └───────────┘    └──────────────────┘    └──────────────────────────────┘
 └──────────────────┘
          시뮬레이션 (§S): 운동학 시뮬 · Isaac Sim · 보도 장면 · sim-to-real 로 위 전체를 검증
```

**문서 지도.** 문서마다 첫 탭이 개요(분야 계보, 공개 코드·모델 현황, travplan의 위치)이고, 그 뒤가 주제별 탭이다. 절 번호는 문서를 옮겨도
그대로 둔다(인식 A, Planner B, Controller E와 안전 필터 C, 시뮬레이션 S, 배경 0, 강화학습 R, 참고문헌 D).

| 문서 | 탭과 절 | 무엇을 보나 | travplan에서 |
|---|---|---|---|
| 인식 (§A) | 지형 지도·Occupancy(A.1–A.5), Traversability(A.10), 시각 기반 모델(A.11), 동적 장애물(A.12), 예측·World model(A.6), 보행 로봇(A.7–A.9) | 센서에서 TravMap과 동적 장애물까지 | elevation mapping(P2.1), TravNet(TP-0010), 검출·추적 PoC(TP-0011) |
| Planner (§B) | **방법** — travplan과 고전 기준선(B.1, B.10), 학습 로컬 Planner(B.2–B.4, B.4b, B.7), 생성형 궤적(B.8.0, B.8), Foundation·VLA·언어(B.6, B.6b–B.6d), 위험 인지·로컬 내비(B.9). **현황** — 자율주행 자동차(B.12.1, B.11, B.13), 다리·바퀴 로봇과 계보(B.12, B.14, B.16) | 경로와 시간 인덱스 궤적 생성 | GuidancePlanner, LearnedPlanner, Planner D |
| Controller·안전 (§E, §C) | MPPI 계열(E.1, B.5), 학습 동역학·적응(E, E.2), 안전 필터(C.1–C.4) | 궤적 추종과 안전 | MPPIController(유지보수), 시간가변 비용 레이어, CVaR-BF 후보 |
| 시뮬레이션 (§S) | 물리 엔진(S.1), 보도·도시(S.2), 보행자(S.3), 센서·렌더링(S.4), 지형·바퀴(S.5), sim-to-real(S.6), travplan 권고(S.7) | 검증 환경의 네 층(L0–L3) | 운동학 시뮬(L0), Isaac Sim(L1) |
| 배경·수식 (§0) | 인식(0.1, 0.8, 0.9, 0.10, 0.14), Planner·학습(0.5, 0.6, 0.7, 0.12, 0.13), 제어·안전(0.2, 0.3, 0.4, 0.11) | 여러 논문이 공유하는 수식 | 각 토글이 "배경 0.N"으로 가리킨다 |
| 강화학습 (§R) | 개요(R.0), 문제 설정·모방(R.1–R.2), 정책 기울기(R.3–R.5), 가치 기반(R.6), 추론으로서의 제어(R.7–R.8, R.17), 모델 기반(R.9, R.18), 오프라인·탐색(R.10–R.11), LLM·생성 정책·안전(R.12–R.13), 이론·다과제(R.14–R.15), travplan에서(R.16) | 버클리 CS 185/285의 강의마다 풀어 쓴 설명과 영상(2023, 2018), 확산·flow 정책의 RL | TP-0066 후학습(AWR, 그룹 이점), TP-0128 진화 전략, MPPI(제어를 추론으로), NMPC(iLQR 계열) |
| 참고문헌 (§D) | 인식(D.1–D.3b), Planner(D.0–D.5b), Controller·안전(D.6–D.7b), 강화학습(D.14), 연구 그룹(D.13), 로코모션·데이터·산업(D.8–D.12) | 전체 목록, 발표처, 코드 링크 | — |

**전체 연표.** 분야마다 흐름을 바꾼 연구를 한 표에 놓았다. 2023년 전후로 네 분야가 함께 "큰 사전학습 모델 + 생성형 출력"으로
옮겨 갔다. 인식은 시각 기반 모델로, Planner는 diffusion과 flow matching으로, Controller는 학습 world model로, 시뮬레이션은 GPU 병렬
학습과 사진 같은 렌더링으로 갔다. 각 이름의 설명은 해당 문서의 개요 탭과 본문에 있다.

| 연도 | 인식 | Planner | Controller·안전 | 시뮬레이션 |
|---|---|---|---|---|
| 1959–1997 | — | Dijkstra, A*, DWA | — | — |
| 2008–2014 | Robot-centric elevation mapping | Hybrid A*, TEB | — | — |
| 2015–2018 | Social GAN | Apollo EM planner | MPPI, 정보이론적 MPC, CBF-QP, HJ 도달 가능성, PETS, 예측 안전 필터 | Sorour 등, Domain Randomization, Dynamics Randomization |
| 2019–2020 | Lift-Splat-Shoot, RELLIS-3D, BADGR, 등속 모델, Trajectron++ | Nav2 | CBF 튜토리얼, 이산 CBF + MPC | Actuator net, ADR, Sim2Real Predictivity |
| 2021–2022 | BEVFormer, BEVFusion, MonoScene, elevation_mapping_cupy, ByteTrack, BoT-SORT | Diffuser, GNM, FAR Planner, PUTN | Robust MPPI, IKD, RMA, log-MPPI, SMPPI | Learning to Walk in Minutes, ART/ATK |
| 2023 | DINOv2, Grounding DINO, Occ3D, WVN, RT-DETR | iPlanner, ViNT, NoMaD, Diffusion Policy, MPD, UniAD, VAD, PDM-Closed, ArtPlanner | TD-MPC2, 안전 필터 통합 관점 | HuNavSim, Gazebo Harmonic |
| 2024 | Depth Anything V2, SAM 2, V-STRONG, RoadRunner, YOLOv10, D-FINE | ViPlanner, OpenVLA, π0, NaVILA, CityWalker, DiffusionDrive, NAVSIM, Hydra-MDP | MPPI-Generic | MetaUrban, Arena 4.0, X-Mobility, Navigation World Models |
| 2025 | DINOv3, Depth Anything 3, SAM 3, RF-DETR, MoFlow | Diffusion Planner, GoalFlow, NavDP, CaRL, Alpamayo, MolmoAct, VAMOS, FPO | CVaR-BF, DRA-MPPI | Isaac Lab, MuJoCo Playground, URBAN-SIM, UrbanVerse, COMPASS, Cosmos |
| 2026 | WalkOCC, ViTA, CATNAV, PIVOT, RayOcc, 4D panoptic occupancy tracking, EgoHTR | AgniNav, MILER, PC-Diffuser, JPPD, GRACE, Can VFMs Navigate?, Click-and-Traverse, TNT, DYNA-2.1 | ProxPI, Predictive Semantic Safety, HDVIO2.0, OGM-CBF, Safe Score Matching, PolyStep | Isaac Sim 6.x, Newton, SidewalkBench, NavIsaacLab |

## ROS/ROS2 costmap의 한계 — travplan이 TravMap을 쓰는 이유

**travplan은 지금도 ROS 2 위에서 돌고 Nav2 생태계를 쓴다.** 그런데 공통 표현만은 `costmap_2d`가 아니라
`TravMap[8,H,W]`다. 왜 갈라섰는지를 여기에 적는다. ==결론부터: costmap은 "여기 무언가 있나"를 답하는 자료구조이고,
보도 주행이 물어야 하는 것은 "여기를 지날 수 있나"다.==

**먼저 costmap이 무엇인지.** `nav2_costmap_2d`는 2D 격자에 레이어를 쌓는다. static(정적 지도), obstacle(센서로
mark/clear), voxel(3D로 쌓았다가 2D로 투영), inflation(장애물 주위를 로봇 반지름만큼 부풀림)이다. 각 셀은
0–255의 비용 하나를 갖는다.

### 다섯 가지 한계

**① 점유/비점유의 이분법.** 셀은 "비었다 / 찼다 / 모른다"와 inflation 비용을 갖는다. ==**"지날 수는 있지만 비싼 곳"**을
표현할 자리가 없다.== 경사 8°의 램프와 평지가 같은 값이고, 자갈과 아스팔트가 같은 값이다. 경사·거칠기를 넣으려면
직접 레이어를 만들어야 하는데, 그러면 그 레이어의 의미는 더 이상 표준이 아니다.

**② 2D 투영이 높이를 무너뜨린다.** 이것이 보도에서 가장 아프다. 세 가지가 함께 무너진다.

- **연석.** 3D 점을 2D로 투영하면 높이 10 cm 턱과 높이 2 m 벽이 같은 "장애물"이다. 반대로 투영 문턱 아래의 턱은
  아예 사라진다(Planner 문서 B.12.4의 BotBrain 사례: 10 cm 미만 턱을 놓친다).
- **오버행.** 나뭇가지나 간판 아래는 로봇이 지나갈 수 있는데 2D로는 막힌 것이 된다.
- ==**음의 장애물.**== 포트홀·배수구·내려가는 연석은 **반사가 돌아오지 않는다.** costmap에서 "반사 없음"은 장애물이
  아니라 **미관측**이고, 미관측은 보통 자유공간처럼 지나간다. travplan이 TP-0031(가림)·TP-0044(그림자 상한)·
  TP-0047(깊이 prior)·TP-0067(관측 증거로 묶기)에 들인 일이 전부 이 한 칸을 메우는 작업이다.

**③ 불확실성이 없다.** 셀은 비용 **하나**를 갖는다. "얼마나 확신하는가"를 담을 곳이 없다. 미관측은 플래그이지
분포가 아니다. 그래서 *"못 본 곳에서는 천천히"*를 표현할 수 없고, 그 결정은 전부 플래너·제어기 쪽 임시 규칙이 된다.
TravMap의 `SIGMA` 채널이 이 자리다.

**④ inflation은 고정된 기하 연산이다.** 로봇 반지름과 감쇠 계수로 정해지고, 속도·지형·불확실성에 따라 변하지 않는다.
Controller 문서 F.5의 4족 확률 제약 MPC가 **"손으로 맞춘 제약 조이기"를 이겼다**고 보고하는데, costmap의 inflation이
바로 그 손으로 맞춘 조이기의 전형이다. travplan의 TP-0069가 겨냥하는 것도 같다.

**⑤ 지면 평면을 가정한다.** 투영 기준면이 평평하다고 보므로, 경사면에서는 **지면 자체가 장애물로 마킹된다.** 실외
적용에서 흔한 실패이고, 농업 쪽 보고에서는 로봇이 밟고 지나갈 수 있는 키 큰 풀이 장애물로 찍혀 경로가 길어지거나
주행이 중단됐다([arXiv:2407.18535](https://arxiv.org/abs/2407.18535)).

### 업스트림도 같은 결론을 적어 두었다

이것은 바깥의 비판이 아니다. Nav2 저장소의 이슈
[#1278 *Redesign Environmental Representation*](https://github.com/ros-navigation/navigation2/issues/1278)에서
메인테이너가 2019년에 이렇게 썼고, 그 이슈는 지금도 **열려 있다.**

> 오늘 우리는 독립된 셀들의 2D costmap을 쓴다. 싸고 쓸모 있는 방법이지만, 당분간 우리를 2.5D 땅에 묶어 둘 것이다.
> (…) 경사를 3D로 다루면 램프나 언덕, **내려가는 계단이나 낙차**를 표현할 수 있다. (…)
> ==비었나 찼나를 따지는 대신 이제 이렇게 생각하자 — **여기를 지날 수 있나.**==

travplan의 `TravMap`은 그 제안을 실제로 구현한 형태에 가깝다. 제안된 "gradient map"이 `GRAD_X`·`GRAD_Y`·`SLOPE`이고,
"지날 수 있나"가 `COST`다.

### TravMap의 여덟 채널이 어느 한계에 답하나

| 채널 | 답하는 한계 |
|---|---|
| `ELEV` | ② 높이를 버리지 않는다 |
| `GRAD_X`, `GRAD_Y`, `SLOPE` | ①·⑤ 경사를 값으로 갖는다. 지면 평면을 가정하지 않는다 |
| `STEP` | ② 연석 높이를 벽과 구분한다(`max_step_m = 0.08`) |
| `ROUGH` | ① 자갈과 아스팔트를 구분한다 |
| `COST` | ① "지날 수 있나"를 연속값으로 |
| `SIGMA` | ③ 얼마나 확신하는지 |

### 그래도 costmap을 버리지는 않는다

==표현을 바꾼 것이지 생태계를 버린 것이 아니다.== Nav2의 행동 트리, 복구 행동, 전역 플래너(Smac), 그리고 실물
배포의 안전 장치는 그대로 값이 있다. travplan이 Nav2와 겹치는 지점과 비교 기준은 Planner 문서 B.12.4에 정리해 두었다.
실물 배달로봇 스택(AntBot)도 Nav2 위에 있다. **바뀌는 것은 "무엇을 공통 표현으로 쓰는가" 하나다.**

## 학회 수확 — IROS 2026 (피츠버그)

**채택 논문 1,929편을 제목으로 훑어 travplan의 열린 질문에 걸리는 것만 골랐다**([논문 색인](https://2026.ieee-iros.org/program/paper-index/)).
세부는 각 주제 문서에 들어가고, 여기서는 지도만 둔다.

==제목에 "sidewalk"가 들어간 논문이 한 편도 없다.== 보도 배달로봇이라는 자리는 여전히 비어 있다. 가장 가까운 것은 험지(off-road)와
다리 로봇이고, 그 방법을 보도 규모로 옮기는 일은 travplan의 몫으로 남는다. 키워드별 편수는 terrain 41, traversability 9, off-road 8,
elevation map 7, occupancy 11, MPPI 9, sidewalk 0이다.

| travplan의 열린 질문 | IROS 2026에서 걸리는 논문 | 어디에 |
|---|---|---|
| 기하만으로 매기는 비용의 한계(TP-0010, TP-0022) | **TNT**(508), **Remember Your Driving Feel**(1304), **TravKAN**(2427), Implicit Neural Representation of Terrain Traversability(4937) | 인식 A.10 |
| 가림과 미관측(TP-0031, TP-0044, TP-0047) | **RayOcc**(1720), **OGM-CBF**(3618), BEACON(3266), What's Hidden Matters(1569) | 인식 A.5, Controller C |
| 고도지도 위의 샘플링 제어(Controller) | **Observation-Conditioned Rollout Allocation**(3312), PA-MPPI(68), Value Function-Guided MPPI(3764) | Controller E.1, B.5 |
| 비동축 스워브 제어(TP-0034) | **MSC: Multi-Stage Caster-Aware Control**(3480), CHUTNI(2438) | Planner B.12.4 |
| occupancy 표현과 추적 | **Streaming Gaussian Encoding for 4D Panoptic Occupancy Tracking**(2962, Best Paper 후보), OccTrack360(1298) | 인식 A.2 |

### 골라 볼 다섯 편

**TNT — 넘어갈 수 없어 보이는 지형을 가른다**(508, Pan·Datar·Xiao 등, GMU, [arXiv:2409.17479](https://arxiv.org/abs/2409.17479)).
대부분의 traversability 추정은 지형을 갈 수 있는 곳(포장, 자갈, 풀)과 없는 곳(바위, 덤불, 도랑)으로 나눈다. 이 연구는 **바퀴 로봇이 실제로는
차체만 한 바위도 넘는다**는 데서 출발해, 과거의 기구·동역학적 차량–지형 상호작용에서 "보기에 못 갈 것 같은데 갈 수 있는" 곳을 데이터로
가려낸다. 6자유도 기구·동역학 모델을 가진 샘플링 Planner를 그 추정으로 안내해, 실물에서 계획 성능 50%, 효율 26.7%, 안정성 9.2%를
개선했다. travplan의 `GeometricTraversability`는 경사·턱·거칠기의 최댓값으로 비용을 매기는데, 이 방식은 정확히 그 보수성을 문제 삼는다.
TP-0057(TravNet 잔차 방향)에서 "올리는 쪽만 허용할지"를 정할 때 반대 방향의 근거가 된다.

**Remember Your Driving Feel — 주행 감각으로 온라인 학습**(1304, Xie 등). proprioception 기반으로 복잡한 지형의 traversability를 주행
중에 배운다. travplan TravNet의 자기지도 라벨(TP-0010 설계, TP-0022 실험)과 같은 계열이고, 온라인 갱신이라는 점이 다르다.

**Observation-Conditioned Rollout Allocation — 근시안적 고도지도 위의 샘플링 MPC**(3312, Diaz Pichardo·Mandow·Vazquez-Martin).
==로봇 중심 고도지도가 좁아 앞을 멀리 못 볼 때, 관측 상태에 따라 rollout 예산을 나눠 준다.== travplan Controller가 belief TravMap 위에서
MPPI를 돌리고, 가림으로 미관측이 생기는 상황(TP-0031)과 정확히 같은 설정이다. 샘플을 어디에 더 쓸지는 travplan이 아직 다루지 않은 축이다.

**MSC — caster를 아는 제어**(3480, Park 등, KAIST). 불확실성을 아는 NMPC와 RL 실행 층을 여러 단계로 묶는다. caster, 즉 조향축과 접지점이
어긋난 바퀴가 대상이다. travplan 로봇의 비동축 스워브(B.12.4의 PCV, 오프셋 55.5 mm)와 같은 문제를 제어 쪽에서 다룬 것이라
TP-0034의 참고가 된다.

**Streaming Gaussian Encoding for 4D Panoptic Occupancy Tracking**(2962, Luz·Valada 등, **Best Paper 후보**). 3D 가우시안으로 장면을
흘려보내며 occupancy를 개체 단위로 추적한다. 같은 주제의 **OccTrack360**(1298, [arXiv:2603.08521](https://arxiv.org/abs/2603.08521))은
어안 카메라 서라운드 뷰로 4D panoptic occupancy 추적 벤치마크를 낸다. 시퀀스가 174–2234프레임으로 기존보다 길고, **가림 마스크와 어안
시야 마스크로 미관측 복셀을 명시**한다. travplan에 직접 쓰지는 않는다. 관심 범위가 복셀 의미·개체이고 travplan은 2.5D 지형 비용이기
때문이다. 다만 미관측을 마스크로 명시해 평가에서 제외하는 규약은 travplan이 σ 채널과 치명 재현율을 재는 방식(TP-0053, `eval/map_quality.py`)과
같은 문제의식이다.

**travplan에 주는 의미.** ==험지 연구는 "보수적으로 막는 것"에서 "실제로 넘을 수 있는지 데이터로 가르는 것"으로 옮겨 가고 있다.==
TNT가 대표다. travplan은 반대로 보수적인 최댓값 규칙을 쓰고 있고, 그것이 안전 쪽으로는 옳지만 0.07 m 턱을 막는 오탐(TP-0048, TP-0067)의
뿌리이기도 하다. 두 흐름을 어떻게 화해시킬지가 TP-0057의 결정 사항이다. 2026-10-03에는 기본을 "올리는 쪽만"으로 두고, 낮추는 쪽은 치명이 늘지 않는지로 판정하는 선택 실험으로 남겼다. 가림 쪽은 RayOcc와 OGM-CBF가 각각 인식과 제어에서 "못 본 것을
어떻게 들고 갈 것인가"를 다루는데, travplan의 그림자 상한·깊이 prior와 비교할 값이 있다.

