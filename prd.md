# Product Requirements — travplan P1 (Isaac Sim 6.0 + ROS 2 Jazzy)

## 1. 북극성

**실외 보도 배달로봇(비동축 스워브)이 costmap 없이 2.5D 지형 표현(높이 + traversability + 불확실성)만으로 턱·경사·거칠기를 반영해,
충돌과 전복 없이 목적지까지 간다.**

P0에서 이 목표를 운동학 시뮬(`travplan/sim/kinematic_sim.py`)로 검증했다. 4 시나리오 × 3 seed에서 MPPI3D 12/12, learned 5/12, hybrid 12/12였다
(2026-09-25 분리 뒤 이름으로는 guidance+mppi 12/12, learned+tracker 5/12). P1은 같은 인터페이스를 그대로 둔 채 Isaac Sim 6.0과 ROS 2 Jazzy에서
같은 지형·로봇·스택으로 폐루프를 재현한다. 묻는 질문은 하나다. **운동학 근사로 얻은 결과가 같은 소프트웨어 스택의 물리 시뮬레이션에서도
유지되는가?**

시뮬레이션 조사(`docs/research-simulation.md`)는 travplan의 시뮬을 네 층으로 나눈다. L0는 운동학 시뮬, L1은 Isaac Sim 센서 폐루프, L2는 보도
전용 장면과 벤치마크, L3는 실물과 시뮬의 짝 평가다. **P1은 L1을 세우는 단계다.** L0 결과가 L1에서도 유지되는지와 함께, L0의 관측 모델이
얼마나 낙관적인지(가림 없는 5 m 원 시야)를 L1과 비교해 수치로 남긴다.

### P1 완료 기준
- Isaac Sim 6.0에서 ROS 2 Jazzy 브릿지가 네이티브로 동작한다(Humble 우회 없음).
- `travplan/sim/isaac/terrain_export.py::heightfield_to_mesh()`의 출력이 Isaac Sim USD 스테이지에 지형 prim으로 그대로 로드된다(P0과 같은
  `sim/terrain.py` 시나리오).
- 스워브 로봇(운동학 프록시)에 LiDAR가 달려 있고, ROS 2 노드가 `elevation → TravMapBuilder → Planner → MPPIController` 폐루프를 돌린다.
- 최소 한 시나리오(`curb_ramp` 권장)에서 P0과 같은 성공 기준(목표 도달, 치명 셀 미접촉)을 재현한다.
- 같은 시나리오에서 L0 belief TravMap과 L1 TravMap(RTX LiDAR → elevation mapping)의 비용 오차 분포를 비교해 L0 관측 모델의 격차를
  기록한다(R-F-010).

### 하지 않는 것
- **스워브 모듈의 실제 조인트·타이어 물리(슬립, 서스펜션).** P1은 운동학 프록시로 충분하다. GPU 물리의 바퀴 접촉은 아직 불안정하다.
  PhysX GPU 파이프라인은 2025-02에야 원기둥 충돌체를 지원했고, NVIDIA COMPASS와 UrbanVerse도 바퀴형 로봇을 운동학으로 굴렸다
  (`docs/research-simulation.md` S.5.2). 스워브 모듈의 조향 한계는 L0의 모듈 모델(`docs/prd-p2.md` R-F-010)로 먼저 넣는다.
- **Isaac Sim 버전 이동.** P1은 설치한 6.0으로 끝낸다. 6.1(2026-09-10)과 Isaac Lab 3.0(정식판 2026-10 말 목표, kit-less 학습)은 P3에서 본다.
- **학습 Planner의 Isaac Sim 재학습.** P1은 비학습 스택(guidance+mppi)만 폐루프로 재현하면 된다. 학습 Planner는 elevation mapping이 붙은 뒤(P2 이후)다.
- **Nav2 플러그인화와 실차 배포**(P5).
- **Isaac Sim GUI로 수동 튜닝하는 워크플로 문서화**(별도 사용자 가이드의 몫).

## 2. 단계별 로드맵

| 단계 | 내용 | 담당 | 완료 기준 |
|---|---|---|---|
| P1.0 ✅ | Isaac Sim 4.5.0 → 6.0 업그레이드, ROS 2 Jazzy 네이티브 브릿지 확인 | 사용자(TP-0001) | `ros2 topic list`에 브릿지 토픽이 Jazzy 클라이언트로 보임 |
| P1.1 ✅ | 지형 USD 변환 유틸(`create_prim_from_mesh` 포팅) | claude(TP-0002) | 단위 테스트 통과(`usd-core`, Isaac Sim 불필요) |
| P1.2 ✅ | ROS 2 Jazzy 브릿지 노드 뼈대 | claude(TP-0003) | mock publisher로 노드 기동, 메시지 스키마 확정 |
| P1.3 ✅ | 스워브 + LiDAR 운동학 프록시 설계 | claude(TP-0004) | 설계 문서 + 스텁 병합 |
| P1.4 | 통합 폐루프 + P0 대비 벤치마크 | 사용자(TP-0005) | 한 시나리오 이상 재현, 성공률 표 갱신. GPU 드라이버는 2026-09-25 복구(TP-0020) |
| P1.5 | L0–L1 인식 격차 측정(판정자 방식) | claude(TP-0040) | 한 시나리오 이상에서 두 TravMap의 비용 오차 분포와 Wasserstein 거리 기록 |

P0 이전과 P2–P5는 `docs/ARCHITECTURE.md` §6에 있다.

## 3. 기능 요구

### R-F-001 Isaac Sim 6.0 네이티브 ROS 2 Jazzy 브릿지
로컬 설치본(4.5.0)의 `isaacsim.ros2.bridge` 확장은 Humble 바이너리만 있어 Jazzy와 맞지 않는다. Isaac Sim 6.0(Python 3.12)은 Ubuntu 24.04와
ROS 2 Jazzy를 네이티브로 지원한다. IsaacLab 2.3.2가 의존하는 기존 4.5.0은 건드리지 않고, 6.0을 별도 경로에 추가 설치한다. **새 소프트웨어
설치이므로 daily_executor가 자동으로 하지 않는다(담당: 사용자).**

### R-F-002 지형 heightfield → USD mesh 변환
`heightfield_to_mesh()`는 `(verts, faces)` numpy 배열을 낸다. `~/IsaacLab/source/isaaclab/isaaclab/terrains/utils.py::create_prim_from_mesh`
(trimesh → `UsdGeom.Mesh` prim)를 참고해 USD prim을 만드는 함수를 더한다. `pxr`는 `usd-core` pip 패키지로 Isaac Sim 없이 import·테스트할 수
있어서, 6.0 설치(R-F-001)를 기다리지 않고 시작할 수 있다.

### R-F-003 LiDAR 부착
`~/Downloads/isaac-go2-ros2/go2/go2_sensors.py::add_rtx_lidar()`의 `omni.kit.commands.execute("IsaacSensorCreateRtxLidar", ...)` 패턴을 따라
로봇 prim에 RTX LiDAR를 단다.

### R-F-004 스워브 운동학 프록시
`travplan/robot/swerve.py::SwerveModel`(body twist vx·vy·wz, `clamp_twist`·`clamp_accel`)을 그대로 쓴다. Isaac Sim에서 실제 스워브 조인트를
시뮬레이션하지 않고, 매 스텝 `SwerveModel.step()`이 계산한 자세를 로봇 rigid body(또는 articulation root)에 직접 쓴다. 운동학은
`kinematic_sim.py`와 같고 물리 백엔드만 다르다.

### R-F-005 ROS 2 Jazzy 브릿지 노드
`travplan_ws/src/travplan_bridge` colcon 패키지다. `~/Downloads/isaac-go2-ros2/ros2/go2_ros2_bridge.py`(odom·LiDAR PointCloud2 발행, cmd_vel 구독)
패턴을 따르되, diff-drive cmd_vel 대신 body twist(vx, vy, wz)를 쓴다. 워크스페이스 구조는 `~/IsaacSim-ros_workspaces/jazzy_ws`를 참고한다.

**구조 결정(2026-09-24, issue #1).** rclpy를 Isaac Sim 프로세스(`.venv-isaac6`, miniforge Python 3.12)에 직접 import하는 방식(A)은
`rclpy.init()`과 `Node()` 생성까지는 동작했다(SOABI `cp312` 일치). 하지만 실제 토픽 발행·구독과, 서로 다르게 빌드된 numpy·tf2 C 확장의
상호작용은 검증하지 못했고 그 위험을 감수할 이유가 없다. 그래서 **Isaac Sim 내장 `isaacsim.ros2.bridge`(OmniGraph 노드)가 DDS로 발행·구독하고,
별도 프로세스의 평범한 rclpy 노드(`travplan_bridge`, 시스템 `/opt/ros/jazzy` 소싱, Isaac import 없음)가 반대편을 맡는 방식(B)**을 택했다. NVIDIA
공식 문서와 로컬 예제(`jazzy_ws`의 `ackermann_control` 등)와 같은 패턴이고 ABI 의존이 없다.

### R-F-006 폐루프 재현
브릿지 노드가 `elevation → TravMapBuilder → Planner → control.mppi.MPPIController`를 그대로 호출한다(기존 코드 재사용, 새 로직 없음).
`eval/runner.py`의 폐루프(관측 → 계획 → 제어 → 스텝)를 ROS 2 타이머와 콜백으로 옮긴 것과 같아야 한다.

### R-F-007 P0 대비 벤치마크
`curb_ramp` 같은 같은 시나리오에서 Isaac Sim 폐루프의 성공·실패와 도달 시간을 P0의 `results/metrics.csv` 스키마(`eval/metrics.py::EpisodeMetrics`)로
기록해 바로 비교한다.

### R-F-008 TODO.md가 유일한 권위
작업 상태는 `TODO.md`만 믿는다. 기계적 수정은 `automation/todo_tool.py`로만 한다(표 정렬, ID 발급, 중복 검사). Notion이나 Telegram 미러는 없다.

### R-F-009 자율 R&D 루프
`automation/daily_executor.sh`가 `automation/prompts/auto_research.md`의 6단계(RESEARCH_INTAKE → REVIEW → PLAN → EXECUTE → REPORT → PLAN_NEXT)를
하루 두 번(10시, 20시) 돌려 TODO 한 건씩 구현하고 PR을 만든다. `automation/daily_wrap.sh`가 22시에 하루를 요약한다.

### R-F-010 L0–L1 인식 격차 측정 (판정자 방식)
L0(`sim/kinematic_sim.py`)는 5 m 원 안의 참 높이에 잡음(σ = 0.01 m)만 더해 관측한다. 연석·물체 뒤의 그림자와 먼 곳의 성긴 점이 없다. L1은
RTX LiDAR 점군을 `elevation_mapping_gpu_ros2`로 쌓는다. 같은 시나리오와 같은 궤적에서 두 경로가 만든 TravMap을 참 TravMap과 비교한다.

비교 대상은 날것의 높이가 아니라 `TravMapBuilder`를 거친 비용이다. 센서 모델의 격차는 하위 알고리즘(판정자)의 오차로 재야 한다는 방식을
따른다(`docs/research-simulation.md` S.6.4). 기록할 값은 세 가지다.
1. 칸별 비용 오차 $\lvert c - c_{\text{gt}} \rvert$의 분포와, L0·L1 두 분포 사이의 1-Wasserstein 거리
2. 치명 셀의 재현율과 정밀도
3. 미관측(σ = 1) 칸의 비율

격차가 크면 L0에 가림(2.5D 시선 검사, TP-0031)을 넣고 다시 잰다. 그러면 L0 벤치마크 숫자가 L1에 얼마나 가까워지는지 확인할 수 있다.

## 4. 비기능 요구

### R-NF-001 자율성
사람 개입 없이 cycle마다 TODO 정확히 한 건을 처리한다. 예산은 daily_executor 35분 이하, daily_wrap 5분 이하다.

### R-NF-002 시간 상한
cycle 안의 시뮬레이션 실행(Isaac Sim GUI·헤드리스, 대규모 벤치마크)은 **2분을 넘을 수 없다.** 넘을 것 같으면 `Status=Blocked`, `UserTest=☑`로 표시해
사람에게 넘긴다.

### R-NF-003 안전
- 코드는 항상 브랜치 + PR(사람 리뷰)이다. `main`에 직접 push하지 않는다.
- `STATE.md`, `TODO.md`, `JOURNAL.md`, `journal/`, `research/`, `results/`만 `automation/state_push.sh`로 `main`에 바로 push할 수 있다(화이트리스트 강제).
- **시스템을 바꾸지 않는다.** `crontab`, `systemctl`, `apt`, 새 패키지 `pip install`, Isaac Sim 설치·업그레이드는 daily_executor가 절대 하지 않는다(R-F-001은 늘 사용자 담당).
- 저장소 밖 `rm -rf`와 사용자 dotfile 수정을 금지한다.

### R-NF-004 관측 가능성
로그는 `~/.local/share/travplan/logs/{daily_executor,daily_wrap}-YYYY-MM-DD.log`, 상태는 `~/.local/state/travplan/*.lock`이다. cycle마다
`journal/YYYY-MM/DD-HH-<slug>.md`, `JOURNAL.md`(최근 20개), `STATE.md`(전체 재작성, `docs/WRITING.md` 기준), `research/cron_activity.md`(한 줄)를 남긴다.

### R-NF-005 재현성
모든 cycle은 `pytest -q`를 통과한 뒤에만 커밋한다. `CLAUDE.md`의 모듈 경계 규칙(공유는 `core/types.py`, `planners/base.py::Planner`,
`control/base.py::Controller`뿐, MPPI 비용은 `CostTerm`으로만, traversability 모델은 `TraversabilityEstimator`로만, 지형 시나리오는 `sim/terrain.py`
한 곳)을 지킨다.

## 5. 성공 지표

### 단기 (P1.1–P1.3, cron이 진행 가능)
- [x] USD 변환 유틸 단위 테스트 통과(TP-0002)
- [x] ROS 2 브릿지 노드가 mock 데이터로 기동(TP-0003)
- [x] 스워브 + LiDAR 프록시 설계 문서 병합(TP-0004)
- [x] `pytest -q` 전부 통과(현재 40 passed, 1 skipped)

### 중기 (P1.4, 사용자 실행 필요)
- [x] Isaac Sim 6.0 설치 + Jazzy 브릿지 네이티브 동작 확인(TP-0001)
- [ ] `curb_ramp`에서 Isaac Sim 폐루프가 목표에 도달하고 치명 셀에 닿지 않음(TP-0005, GPU 복구로 진행 가능)
- [ ] L0–L1 인식 격차(비용 오차 분포, 치명 셀 재현율·정밀도, 미관측 비율) 기록(TP-0040)

### 장기 (P1 종료)
- [ ] P0의 4 시나리오 × 3 seed를 Isaac Sim에서도 재현
- [ ] guidance+mppi 성공률이 운동학 시뮬(12/12)보다 크게 떨어지지 않음(목표: 20%p 이내)

### P2 준비
- [ ] P2의 elevation mapping·TravNet 자기지도 학습에 필요한 접촉·슬립 로그 형식을 P1 ROS 2 브릿지에서 확보

## 6. 위험과 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| 4.5.0 → 6.0 이전이 IsaacLab(심링크 의존) 설치를 깨뜨림 | 다른 Isaac 작업 차단 | 6.0을 별도 경로에 추가 설치하고 4.5.0과 IsaacLab을 유지 |
| Isaac Sim 6.0 + ROS 2 Jazzy 브릿지의 Python 버전 문제(포럼 보고 사례) | P1.0 지연 | 설치 직후 최소 재현(topic list·echo)으로 빨리 확인, R-NF-002로 시간 상한 |
| daily_executor의 시뮬레이션이 사용자의 Isaac Sim·GPU 사용과 겹침 | 작업 방해, 크래시 | 실행 시각은 10시·20시로 유지하고 R-NF-002(2분 상한)로 영향을 줄인다. GPU 사용 조정은 사용자가 직접 관리 |
| USD·LiDAR 통합이 35분 cycle 예산을 넘음 | cycle 실패, 미완 PR | TP-0002–0004로 쪼개 각각 독립 PR로 유지 |
| 스워브 물리가 없어 Isaac 결과가 운동학 결과와 너무 비슷함(검증력 부족) | P1 완료 기준이 약해짐 | 하지 않는 것에 명시하고, 슬립·서스펜션 검증은 P2 이후로 미룬다 |
| GPU 드라이버가 커널 업데이트 뒤 로드되지 않음(TP-0020) | P1.4와 Isaac 관련 P2 작업 전체 정지 | **2026-09-25 재부팅 뒤 해결**(커널 7.0.0-34, 드라이버 580.178.04). 커널을 올린 뒤에는 `nvidia-smi`부터 확인하고, 실패하면 DKMS 재빌드나 이전 커널로 복구 |
| 시뮬레이터 허점 때문에 결과가 낙관적임(Habitat은 벽 미끄러짐 허점 하나로 시뮬·실물 성공률 상관이 0.18이었다) | 벤치마크 숫자가 실물 성능을 과대평가 | 실패는 참 지도 기준으로 판정한다. L1과의 인식 격차를 재고(R-F-010), L0 충실도 옵션을 더한다(`docs/prd-p2.md` R-F-010). 실물이 생기면 SRCC로 확인한다(같은 문서 R-F-012) |
| Isaac Sim·Isaac Lab 버전이 빠르게 바뀜(6.1, 7.0 alpha, Isaac Lab 3.0 Early Access) | 설치·호환 작업이 P1을 늦춤 | P1은 6.0에 고정한다. 새 버전은 P3 학습 환경을 정할 때 한 번에 재평가한다(TP-0042) |

## 7. 의사결정 원칙

- 모든 TODO는 위 로드맵(P1.0–P1.4) 중 한 단계에 속해야 한다.
- 모듈 경계(`core/types.py`, `planners/base.py`, `control/base.py`의 공유 계약)는 바꾸지 않는다. P1의 새 코드는 `travplan/sim/isaac/`, 새 ROS 2
  패키지(`travplan_ws/`), `automation/` 안에만 더한다.
- `results/*.tsv`, `journal/`, `research/cron_activity.md`는 덧붙이기만 한다.
- 시스템 변경(설치, 업그레이드, crontab)은 늘 사람의 몫이다. Owner=user TODO로만 표현하고 daily_executor는 시도하지 않는다.
- 시뮬레이션에 관한 주장에는 반드시 `pytest` 결과나 `results/` 파일로 근거를 남긴다. 근거 없는 "됨" 보고는 받지 않는다.
- 시뮬 결과에는 어느 층에서 쟀는지 붙인다(L0 운동학, L1 Isaac, L2 보도 장면, L3 실물). L0 결과만으로 실물 성능을 주장하지 않는다.
- 시뮬 엔진은 Isaac Sim을 유지한다. 보도 시뮬레이터(URBAN-SIM, UrbanVerse, SidewalkBench, CostNav)가 모두 그 위에 있다. 다른 엔진(Newton MPM,
  Chrono SCM 등)은 변형 지면처럼 분명한 목적이 생길 때만 들인다(`docs/research-simulation.md` S.1, S.7).

## 8. 변경 관리

- **코드**(`travplan/`, `travplan_ws/`, `tests/`): `main` 병합은 사람만 한다. daily_executor는 브랜치 + PR만 만든다.
- **상태 파일**(`TODO.md`, `STATE.md`, `JOURNAL.md`, `journal/`, `research/`, `results/`): daily_executor와 daily_wrap이 `automation/state_push.sh`로
  `main`에 바로 push할 수 있다(화이트리스트 밖 경로가 섞이면 스크립트가 거부한다).
- **이 문서와 `docs/ARCHITECTURE.md`**: 사람이 편집하고 cron 에이전트는 읽기만 한다.

_Last updated: 2026-09-25 (시뮬레이션 조사 반영) · 관련: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/research-simulation.md`, `TODO.md`_
