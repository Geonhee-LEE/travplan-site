<!-- doc: 참고문헌 | 6 -->
# 참고문헌 (§D)

## D. 참고문헌

**읽는 법.** 목록은 travplan 구조(인식 → Planner → Controller)를 따라 나눴다. 인식과 계획이 한 모델로 묶인 **E2E 연구**는 D.0에서
인식 부분과 플래너 부분으로 나눠 보고, travplan에 쓸 만한 쪽의 목록에 각각 올렸다. 목록의 `E2E▸인식`, `E2E▸플래너` 표시가 그 항목이다.
"본문" 칸은 이 문서에서 다룬 절이다. 연·월은 arXiv 첫 게재 기준이고, 학회·저널은 확인한 것만 적었다.

목차: D.0 E2E 분해 · D.1 지형·traversability·중간 표현(A.10) · D.2 Occupancy · D.3 예측(occupancy flow·world model·
행위자) · D.3b 인식 마일스톤·시각 기반 모델·동적 장애물 · D.4 학습 Planner · D.4b 비학습 위험 인지 경로 계획 · D.5 생성형 궤적 Planner ·
D.5b 고전 기준선·마일스톤·VLA·E2E 주행 · D.5c 로봇별 오픈소스 스택 · D.6 Controller(참고) · D.7 안전 필터 · D.7b Controller·안전 마일스톤 ·
**D.13 연구 그룹과 사람** · D.8 로코모션·시스템 스택 · D.9 데이터셋·벤치마크 · D.10 벤더·산업 자료 ·
D.12 IROS 2026 수확 · D.11 기타
(시뮬레이션 참고문헌은 시뮬레이션 문서의 S.8에 있다)

---

<!-- tab: 인식 -->

### D.1 인식 — 지형·traversability·중간 표현

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| SEB-Naver | 2025.03 · IROS 2025 | **지상 비평탄 지형**: SE(2) 위험 지도를 GPU로 만들고 Felzenszwalb SDF를 얹는다 | A.2c | [논문](https://arxiv.org/abs/2503.02412) · [코드](https://github.com/ZJU-FAST-Lab/seb_naver) |
| EGO-Planner | 2020.08 · RA-L 2021 | ESDF를 없애고 제어점마다 앵커 반공간으로 거리·경사를 만든다. ESDF 5.07 ms 대 앵커 0.37 ms | A.2c | [논문](https://arxiv.org/abs/2008.08835) · [코드](https://github.com/ZJU-FAST-Lab/ego-planner) |
| FIESTA | 2019.03 · IROS 2019 | 전역 ESDF 증분 유지(두 큐 + 최근접 장애물 이중 연결 리스트). BFS 갱신은 정확할 수 없음을 스스로 증명 | A.2c | [논문](https://arxiv.org/abs/1903.02144) · [코드](https://github.com/HKUST-Aerial-Robotics/FIESTA) |
| Fast-Planner | 2019.07 · RA-L 2019 | log-odds 점유 격자 + 바뀐 셀 AABB에만 Felzenszwalb EDT(양·음 2패스) | A.2c | [논문](https://arxiv.org/abs/1907.01531) · [코드](https://github.com/HKUST-Aerial-Robotics/Fast-Planner) |
| RC-ESDF | 2023.06 · IROS 2023 | 거리장을 환경이 아니라 **로봇 몸체 좌표계**에 오프라인으로. whole-body 제약 | A.2c | [논문](https://arxiv.org/abs/2306.16046) |
| ROG-Map *(Fei Gao 아님)* | 2023.02 · IROS 2024 | robocentric 슬라이딩 격자, O(n) 증분 팽창, Unknown을 별도 상태로 | A.2c | [논문](https://arxiv.org/abs/2302.14819) · [코드](https://github.com/hku-mars/ROG-Map) |
| Frozone | 2020.03 · RA-L 5(3):4352 | ==**Freezing Rate** 정의==(10초 넘게 멈추거나 진동한 비율). **정면 3 m 조우에서 기존 방법이 100 % 얼어붙는다** — travplan 게이트에 없는 지표이자 없는 시나리오 | A.12.5 | [논문](https://arxiv.org/abs/2003.05395) · [DOI](https://doi.org/10.1109/LRA.2020.2996593) |
| BRNE (Sun·Baldini·Hughes·**Trautman**·Murphey) | 2024.03 · IJRR | ==2010년 FRP 논문 저자의 14년 뒤 답.== 로봇 계획과 보행자 예측을 **동시에** 생성하는 베이즈 반복 = 혼합전략 내시 균형. 사족 온보드 실시간 | A.12.5 | [논문](https://arxiv.org/abs/2403.01537) |
| SICNav | 2023.10 · IEEE T-RO | ==**보행자가 ORCA를 따른다고 보고 그 모델을 MPC 제약으로 박는다**(이중수준, KKT 재정식화).== 결합 예측-계획의 가장 값싼 구현 경로 — acados 트랙에 직결 | A.12.5, TP-0090 | [논문](https://arxiv.org/abs/2310.10982) |
| SACSoN | 2023.06 · RA-L | ==반사실 목적함수: *"if the robot had not intruded, would the human have acted the same way?"*== — "적절히 양보했는가"의 형식적 정의 | A.12.5 | [논문](https://arxiv.org/abs/2306.01874) |
| Fla. Stat. § 316.2071 | 2017 | 보행자 동등 권리를 주되 ==**거기서 로봇을 다시 빼내어** "must yield the right-of-way to pedestrians"를 덧붙인다.== 버지니아는 동등 취급만 하고 `yield` 0회 | A.12.5 | [원문](https://www.flsenate.gov/Laws/Statutes/2023/316.2071) |
| Tex. Transp. Code Ch. 552A | 2019 · S.B. 969 | ==보도 배달로봇에 **"yield the right-of-way to all other traffic, including pedestrians"**를 법으로 명령== . 보행자 구역 10 mph(지자체 하향 시 7 mph 하한), 제동 장치 의무. **중량 제한 없음** | A.12.5 | [원문](https://statutes.capitol.texas.gov/Docs/TN/htm/TN.552A.htm) |
| Starship EP 3 679 441 B1 | 2017 우선권 · 2023 등록 | ==업계에서 나온 유일한 기술 문서.== 진입 go/no-go + 주행 중 **중단·후진** 분기(후방 여유 조건, 최대 1.5 m). 위험 판정이 *"an approaching object that is **not decelerating**"* ⚠️ **자동차에게** 양보하는 것 | A.12.5 | [EPO 원문](https://data.epo.org/publication-server/rest/v1.0/publication-dates/20230628/patents/EP3679441NWB1/document.html) |
| SA-CADRL | 2017.03 · ICRA 2017 | *"passing on the right and overtaking on the left"*를 반평면 페널티로. ==**Norm preference (%)**가 곧 지나가는 쪽 준수 지표== | A.12.5 | [논문](https://arxiv.org/abs/1703.08862) |
| Multi-agent path topology (Mavrogiannis & Knepper) | 2019 · IJRR 38(2-3):338 | ==**위상 브레이드**로 지나가는 쪽을 이산 클래스화==하고 관측으로 집단 전략을 추론 — Apollo의 "이산 결정 + 연속 최적화"와 같은 구조. ⚠️ arXiv에 없음(`1906.11251`은 물리학 논문이다) | A.12.5 | [DOI](https://doi.org/10.1177/0278364918781016) |
| Conflict Avoidance in Social Navigation (Mirsky 외) | 2021.06 · ACM THRI 2024 | 충돌 회피 전용 서베이인데 ==`right of way` 0회, `priority` 0회== — 이 분야에 통행 우선권 어휘가 없다는 증거 | A.12.5 | [논문](https://arxiv.org/abs/2106.12113) · [DOI](https://doi.org/10.1145/3647983) |
| 보도 로봇-보행자 상호작용 실측 (Gehrke 외) | 2023.03 · TRIP 18:100789 | ==보도 배달로봇 충돌 위험을 정량화한 **유일한** 연구.== 지표는 post-encroachment time이고 **양보율 수치는 아니다** | A.12.5 | [DOI](https://doi.org/10.1016/j.trip.2023.100789) |
| Sharing the Sidewalk (Weinberg 외) | 2023.05 · MTI 7(5):53 | ==피츠버그시(DOMI) **Kiwibot** 파일럿의 민족지 관찰 — 상용 로봇의 **stop-and-wait 얼어붙기**를 보도에서 기록한 유일한 문헌.== 본문에 `yield` 0회 | A.12.5 | [DOI](https://doi.org/10.3390/mti7050053) |
| Accessibility and The Crowded Sidewalk (Bennett 외) | 2021 · ACM DIS 2021 | 마이크로모빌리티가 공공 공간 접근성에 주는 영향. ==휠체어 이용자가 로봇에 막힌 사건을 동료평가 문헌으로 다룬 것== | A.12.5 | [DOI](https://doi.org/10.1145/3461778.3462065) |
| Autoware velocity_smoother | 소스 확인 2026-09-30 | ==모듈은 **속도 상한·정지점만 꽂고**, 저크 제한 QP 하나가 $s$축으로 거꾸로 전파해 부드럽게 만든다.== `autoware_motion_velocity_run_out_module`은 on/off 버퍼가 비대칭인 Schmitt 트리거 | A.12.5 | [코드](https://github.com/autowarefoundation/autoware_core/tree/main/planning/autoware_velocity_smoother) |
| openpilot 종방향 MPC | 소스 확인 2026-09-30 | ==**이산 모드가 없다**== — 움직이는 앞차를 $v^2/2a$만큼 먼 정지 장애물로 환산. acados `SQP_RTI`, 거리 제약을 슬랙으로(*"behaves like an asymmetrical cost"*), 속도로 정규화 | A.12.5 | [코드](https://github.com/commaai/openpilot/blob/master/openpilot/selfdrive/controls/lib/longitudinal_mpc_lib/long_mpc.py) |
| Smooth MPPI without Smoothing (Kim 외) | 2021.12 · RA-L 2022 | ==MPPI 떨림의 원인은 비용 절벽이 아니라 **샘플링 확률성**==. i축·t축 평활화 | A.12.5, C | [논문](https://arxiv.org/abs/2112.09988) · [DOI](https://doi.org/10.1109/LRA.2022.3192800) |
| Convex speed planning (Zhang 외) | 2018 · Sensors 18(7):2185 | pseudo-jerk 볼록 속도 계획. Autoware smoother가 인용하는 공개 접근 문헌 | A.12.5 | [DOI](https://doi.org/10.3390/s18072185) |
| CBF-QP의 Lipschitz 연속성 정리 (Ames 외) | 2016.09 · IEEE TAC 2017, 62(8):3861 | Theorem 3. 매끄러움 외에 ==**입력이 제약에 나타나야**($L_g B \ne 0$)== 한다 — 가속도 입력 로봇에서 위치 거리 CBF가 무의미한 이유 | A.12.5, C | [논문](https://arxiv.org/abs/1609.06408) · [DOI](https://doi.org/10.1109/TAC.2016.2638961) |
| PGIF-MPPI | 2026.08 · **프리프린트** | 보행자 예측을 지평 전체로 전파해 **비등방 가우시안**으로 MPPI 비용에 넣는다. ==충돌 82 %→0 %인데 타임아웃 0 %→59 % — 얼어붙기의 대가를 측정한 유일한 표== ⚠️ 단독 저자·**워크숍 논문**(HFR 2026, Springer Proc. Adv. Robotics 게재 확정)·시뮬만. 저자들은 이 보수성을 **고전 FRP와 구분한다** | A.12.5 | [논문](https://arxiv.org/abs/2608.08323) · [코드](https://github.com/ChinmayMundane/PGIF_MPPI) |
| DRA-MPPI | 2025.06 · IROS 2025 | ==soft(연속 조절) + hard(위험 상한 지시함수)를 **한 critic에**== . Jackal + 보행자 5명 실물 | A.12.5, C.2 | [논문](https://arxiv.org/abs/2506.21205) · [DOI](https://doi.org/10.1109/IROS60139.2025.11246822) |
| Chance-Constrained Sampling-Based MPC (Mohamed 외) | 2025.01 · RA-L 10(7):7492 | 마할라노비스 형식 $M \ge \kappa$ — ==$\Sigma$가 커지면 $M$이 문턱보다 빨리 줄어 **접근 금지 반경이 부푼다**(κ 자체는 작아진다)== . travplan σ 채널·E.10과 직결 | A.12.5 | [논문](https://arxiv.org/abs/2501.08520) · [DOI](https://doi.org/10.1109/LRA.2025.3576071) |
| 시간가변 CBF (Huang 외) | 2023.07 · IECON 2023 | $\partial h/\partial t$ 항 + **오프셋 점** 평가로 $v$와 $\omega$가 모두 나타난다 → ==고차 CBF 없이 **감속으로** 회피== ⚠️ 시뮬만 | A.12.5 | [논문](https://arxiv.org/abs/2307.08227) · [DOI](https://doi.org/10.1109/IECON51785.2023.10312269) |
| The Before, During, and After of Multi-Robot Deadlock (Grover 외) | 2022.06 · 프리프린트 | 실물 Khepera-IV. ==근본 원인: **안전은 하드 제약, 목표는 비용**이라 구조적으로 교착== . 대칭이면 **반드시** 교착 | A.12.5, C | [논문](https://arxiv.org/abs/2206.01781) |
| Undesired Equilibria 제거 (Tan & Dimarogonas) | 2021.04 · Automatica 2024 | 위 병리의 **해결된 형태** — 안전 집합 내부의 가짜 평형점 완전 제거 | A.12.5, C | [논문](https://arxiv.org/abs/2104.14895) · [DOI](https://doi.org/10.1016/j.automatica.2023.111359) |
| Safety-Critical MPC with Discrete-Time CBF (Zeng 외) | 2020.07 · ACC 2021 | ==거리 제약은 늦게 밟고 CBF는 일찍 밟는 이유==, 그리고 $\gamma$의 안전-실행가능성 딜레마를 저자들이 직접 미해결로 남김 | A.12.5, C | [논문](https://arxiv.org/abs/2007.11718) · [DOI](https://doi.org/10.23919/ACC50511.2021.9483029) |
| CBF: Theory and Applications (Ames 외) | 2019.03 · ECC 2019 | CBF-QP 해가 ==**Lipschitz 연속**== — 안전 필터가 점프를 낼 수 없는 정확한 이유 | A.12.5, C | [논문](https://arxiv.org/abs/1903.11199) · [DOI](https://doi.org/10.23919/ECC.2019.8796030) |
| High Relative Degree CBF (Xiao & Belta) | 2019.03 · CDC 2019 | 위치 기반 $h$에서 입력이 사라지는 문제의 원 논문(고차 CBF) | A.12.5, C | [논문](https://arxiv.org/abs/1903.04706) · [DOI](https://doi.org/10.1109/CDC40024.2019.9029455) |
| **Unfreezing the Robot** (Trautman & Krause) | 2010 · IROS 2010 | FRP를 이름 붙인 원 논문. ⚠️ **폐쇄 접근이라 원문 확인 불가** — 인용은 아래 저널판에서 한다 | A.12.5 | [DOI](https://doi.org/10.1109/IROS.2010.5654369) |
| **Robot navigation in dense human crowds** (Trautman 외) | 2015 · IJRR 34(3):335 | ==**완벽한 *개별* 예측이어도 군중이 *특정 배치*(나란히 걷기)를 취하면 얼어붙는다**== — 원인은 정확도가 아니라 예측이 로봇 행동과 무관한 **구조**다. 더 나은 개별 예측은 *"only ... below a certain density threshold"* | A.12.5 | [DOI](https://doi.org/10.1177/0278364914557874) |
| Core Challenges of Social Robot Navigation (Mavrogiannis 외) | 2021.03 · ACM THRI 2023 | ==예측-계획 **분리 대 결합**== 축으로 분야를 정리. 도달 시간 대 충돌 수 경계선을 직접 측정 | A.12.5 | [논문](https://arxiv.org/abs/2103.05668) · [DOI](https://doi.org/10.1145/3583741) |
| Principles and Guidelines for Evaluating Social Robot Navigation (Francis 외 31인) | 2023.06 · ACM THRI 2025 | 소셜 내비 **지표 표준**. ==Stalled time·Space compliance·jerk·Aggregated Time==으로 "얼어붙기"와 "양보"를 가른다 | A.12.5 | [논문](https://arxiv.org/abs/2306.16740) · [DOI](https://doi.org/10.1145/3700599) |
| Apollo EM Planner 계열 (경로-속도 분해 / ST 그래프) | 소스 확인 2026-09-30 | `st_bounds_decider` → `speed_decider` → `path_time_heuristic`(DP) → ==`piecewise_jerk_speed`(저크 제한 QP)==. **연속 가감속이 나오는 자리가 마지막 QP다** | A.12.5 | [코드](https://github.com/ApolloAuto/apollo/tree/master/modules/planning/tasks) |
| Reciprocal n-Body Collision Avoidance (ORCA) | 2011 · STAR 70 | 속도 공간 반평면. ==상호성 가정==(각자 절반씩 회피)이 군중이 얼지 않는 이유이자 한계 | A.12.5 | [DOI](https://doi.org/10.1007/978-3-642-19457-3_1) · [코드](https://github.com/snape/RVO2) |
| Social force model (Helbing & Molnár) | 1995 · Phys. Rev. E 51:4282 | 보행자 상호작용의 원형. 감쇠 길이가 **접근 속도**에 따라 커지는 타원형 확장은 Moussaïd 외(2009) | A.12.5 | [DOI](https://doi.org/10.1103/PhysRevE.51.4282) |
| CBF-QP가 가짜 평형점을 만든다 (Reis 외) | 2021 · IEEE L-CSS 5(2):731 | ==안전 필터가 목표 아닌 곳에 **점근 안정한** 정지점을 만든다는 증명== — 교착의 정확한 진술 | A.12.5, C | [DOI](https://doi.org/10.1109/LCSYS.2020.3004797) |
| Why Does Symmetry Cause Deadlocks? (Grover 외) | 2020 · IFAC-PapersOnLine 53(2):9746 | "둘이 같은 쪽으로 피한다"는 튜닝 버그가 아니라 **대칭성** 현상이다 | A.12.5, C | [DOI](https://doi.org/10.1016/j.ifacol.2020.12.2644) |
| HuNavSim | 2023 · RA-L | 반응형 보행자 + 소셜 지표 자동 계산. ==Isaac Sim 래퍼가 있어 P1·TP-0036에 맞는다== | A.12.5 | [DOI](https://doi.org/10.1109/LRA.2023.3316072) · [코드](https://github.com/robotics-upo/hunav_sim) |
| **FastDEM** | GitHub 2026.09 (고려대 ISR) | ==Orin **100+ Hz**, 스캔당 ~10 ms, **CPU만**(Eigen)==. step을 백분위 띠로. 레이어가 `TravMap[8]`과 1:1 | A.2b.4, A.5.1 | [코드](https://github.com/Ikhyeon-Cho/FastDEM) |
| OHM | 2022.06 · RA-L 2022 (CSIRO) | GPU voxel + 2.5D 높이지도. ==미관측을 6상태 열거형으로==(`kVirtualSurface` 등), SubT 결선 2위 | A.2b.7, A.5.1 | [논문](https://arxiv.org/abs/2206.06079) · [코드](https://github.com/csiro-robotics/ohm) |
| Virtual Surfaces (Hines 외) | 2020.10 · RA-L 투고 (CSIRO) | ==음의 장애물에 매핑·계획·반응을 **동시에** 결합한 선행 연구==. TP-0031/0044/0047의 선행 문헌 | A.2b.7 | [논문](https://arxiv.org/abs/2010.16018) |
| ArtPlanner | 2023.03 · Field Robotics 2023 (ETH RSL) | emap 상한을 **virtual surface**로 쓰는 공개 소비자. ==*"only use virtual surfaces if above sensor height"*==, 인페인팅·비주행 처리를 명시 거부 | A.2b.7 | [논문](https://arxiv.org/abs/2303.01420) · [코드](https://github.com/leggedrobotics/art_planner) |
| Automatic Navigation Map Generation (Mozzarelli 외) | 2024.03 (Politecnico di Milano) | ==**보도 라스트마일 배달로봇** 명시 대상==. 미관측에 이웃 최소고도 재귀 전파 → 생긴 불연속을 양의 장애물 검출기로 잡는다(min_filter의 역이용) | A.2b.7 | [논문](https://arxiv.org/abs/2403.13431) |
| Reconstructing Occluded Elevation (solving-occlusion) | 2021.09 · RA-L 2022 (ETH RSL) | ==불완전한 실제 DEM에 가림을 **더** 넣고 원래 관측 칸을 복원 학습== — 정답 지도 불필요 | A.2b.7 | [논문](https://arxiv.org/abs/2109.07150) · [코드](https://github.com/mstoelzle/solving-occlusion) |
| UNRealNet | 2024.07 (CMU + Field AI) | 단일 스캔 → ==7채널 칸별 **평균+분산**(travplan 8채널과 거의 일치)==, 인페인팅을 학습으로 강제. 코드 없음 | A.2b.7, A.5.2 | [논문](https://arxiv.org/abs/2407.08720) |
| Robot-Centric Elevation Map Completion (Goga 외) | 2026 · Applied Sciences 16(16):8262 | ==센서 원점 고정 **각도 섹터** 증강==(*"unlike random masks"*), β-NLL로 칸별 불확실성 | A.2b.7, A.3b | [논문](https://doi.org/10.3390/app16168262) |
| SCAN-Planner | 2026.06 (arXiv 2606.19555) | *"2.5D cannot faithfully represent overhanging..."*. 하이브리드 3D + ==twin-cylinder `d_up`==. Go2 + Orin NX 실시간 | A.2b.6, A.5.1 | [논문](https://arxiv.org/abs/2606.19555) · [코드](https://github.com/wuyi2121/SCAN-Planner) |
| traversability_generator3d / ugv_nav4d | 2026 · JOSS 11(118):9410 (DFKI) | **MLS** 다층 표면. ==Unknown/Frontier/**Hole**을 1급 노드 상태로==, 근거 부족 시 보간하지 않음 | A.2b.6, A.5.1 | [논문](https://joss.theoj.org/papers/10.21105/joss.09410) · [코드](https://github.com/dfki-ric/traversability_generator3d) |
| G-VOM | 2021.09 · IEEE IV 2022 (Texas A&M) | 3D voxel → 2.5D 5장. ==`negative_obstacle`·`visibility`를 1급 출력으로 내는 유일한 구현==. GPL-3.0 | A.2b.3, A.5.1 | [논문](https://arxiv.org/abs/2109.13176) · [코드](https://github.com/unmannedlab/G-VOM) · [ETH 포크](https://github.com/leggedrobotics/G-VOM) |
| GroundGrid | 2024.05 · RA-L 9(1):420 (FU Berlin) | 격자 기반 지면 분할. ==94.78 % mIoU @ **171 Hz**==(SemanticKITTI), `ros2-jazzy` 브랜치 | A.5.2 | [논문](https://arxiv.org/abs/2405.15664) · [코드](https://github.com/dcmlr/groundgrid) |
| urban_road_filter | 2022.01 · Sensors 22(1):194 | 연석 검출기 3종 교체 가능, ==기본 브랜치가 `ros2`==. 오름/내림 연석 미구분 | A.3c | [논문](https://doi.org/10.3390/s22010194) · [코드](https://github.com/jkk-research/urban_road_filter) |
| depth_nav_tools (cliff_detector) | 2017 · JAMRIS | ==지면 $z=0$ 예상 거리 조회표 대비 초과분으로 낙차 판정== — 가장 단순한 기하 기준선 | A.2b.7 | [코드](https://github.com/mdrwiega/depth_nav_tools) |
| LuSeg | 2025.03 · IROS 2025 (NUDT) | RGB-D ~57 Hz. ==동결 RGB 특징 대비 대조 손실로 **함몰을 깊이 잡음과 분리**== | A.3c | [논문](https://arxiv.org/abs/2503.11409) · [코드](https://github.com/nubot-nudt/LuSeg) |
| Similar but Different (서베이) | 2023.12 | 지면 분할과 traversability 추정 서베이. ==음의 장애물을 부분집합 관계로 명시== | A.2b.7 | [논문](https://arxiv.org/abs/2312.16839) |
| elevation_mapping_gpu_ros2 | GitHub | GPU elevation mapping의 Jetson Orin 포트. **travplan 채택, TP-0008 실행 검증** | A.1, A.5 | [코드](https://github.com/iit-DLSLab/elevation_mapping_gpu_ros2) |
| elevation_mapping_cupy | 2022.04 · IROS 2022 (ETH RSL) | 위 리포의 상위. 기하 + 시맨틱 + RGB 멀티모달 GPU elevation mapping, 가시성 정리와 상한 층 | A.2b, A.8 | [논문](https://arxiv.org/abs/2204.12876) · [코드](https://github.com/leggedrobotics/elevation_mapping_cupy) |
| traversability_estimation | GitHub (ETH RSL) | elevation map → 법선·경사·거칠기·step 필터로 cost layer. 비학습 기준선 | A.7 | [코드](https://github.com/leggedrobotics/traversability_estimation) |
| Wild Visual Navigation | 2024.04 · Autonomous Robots 2025(저널판) | frozen DINO 특징 + 온라인 자기지도 traversability 헤드, 5분 내 현장 적응 | A.7, TP-0010 | [논문](https://arxiv.org/abs/2404.07110) · [저널](https://link.springer.com/article/10.1007/s10514-025-10202-x) |
| V-STRONG | 2023.12 · ICRA 2024 | vision foundation model + contrastive 자기지도 traversability | TP-0010(PRD) | [논문](https://arxiv.org/abs/2312.16016) · [코드](https://github.com/shjung13/V-Strong) |
| ScaTE | 2022.09 · RA-L/IROS 2023 | 점군 → 차량이 느낄 proprioception 예측, **PU learning**으로 과신 영역 식별 | A.10, TP-0010 설계 §4 | [논문](https://arxiv.org/abs/2209.06522) · [프로젝트](https://www.taekyung.me/research/scate) |
| Learning Off-Road Terrain Traversability with Self-Supervisions Only | 2023.05 · RA-L 2023 | 지나간 곳 = 양성 자동 라벨 + one-class 분류 | A.10 | [논문](https://arxiv.org/abs/2305.18896) |
| METAVerse | 2023.07 | LiDAR BEV 연속 비용 지도, 메타러닝 + 현장 온라인 적응, MPC 연동 | A.10 | [논문](https://arxiv.org/abs/2307.13991) |
| Evidential Semantic Mapping (BKI) | 2024.03 | EDL 불확실성으로 가중한 BKI 시맨틱 지도 융합 | A.10 | [논문](https://arxiv.org/abs/2403.14138) |
| Uncertainty-aware Semantic Mapping (Dempster-Shafer) | 2024.05 | 증거 이론 기반 오프로드 시맨틱 지도 | A.10 | [논문](https://arxiv.org/abs/2405.06265) |
| E2-BKI | 2025.09 | 가우시안 묶음 + 타원형 커널의 불확실성 인지 BKI | A.10 | [논문](https://arxiv.org/abs/2509.11964) |
| Embracing Uncertainty in Off-road Perception (강연) | Junwon Seo | 위 자기지도·불확실성 계보를 한 흐름으로 설명 | A.10 | [영상](https://www.youtube.com/watch?v=xJEXuIprkSg) |
| SALON | 2024.12 | 바퀴형 로봇 오프로드 자기지도 적응 학습 | A.7 | [논문](https://arxiv.org/abs/2412.07826) |
| STERLING | 2023.09 | 제약 없는 주행 경험에서 지형 표현 자기지도 학습 | A.7 | [논문](https://arxiv.org/abs/2309.15302) |
| MILER `E2E▸인식` | 2026.09 | 시맨틱 BEV 중간 표현으로 sim-to-real, Jetson AGX Orin 실주행 17.3 km | B.4 | [논문](https://arxiv.org/abs/2609.20747) |
| TRIP | 2024.11 | 다리 로봇 위험 인지 traversability 지도, T-BGK 보간 | A.10 | [논문](https://arxiv.org/abs/2411.17134) |
| RoM-Nav `E2E▸인식` | 2026.09 · ICRA 2027 심사 중 | LiDAR·깊이 denoising VAE 인코더 + 지형 분할 헤드, 사전학습 후 고정 | B.9 | [논문](https://arxiv.org/abs/2609.19272) · [프로젝트](https://wdc3iii.github.io/rom-nav/) · [코드](https://github.com/wdc3iii/rom-nav) · [영상](https://www.youtube.com/watch?v=l_YT4iP0W8Q) |
| height_mapping (Caltech AMBER) | GitHub | G1 + MID-360 FAST-LIO 높이 지도, 큰 축 정렬 지도 + SE(2) 조회 스레드 | A.8 | [코드](https://github.com/wdc3iii/height_mapping) |
| DreamFlow `E2E▸인식` | 2026.03 · ICRA 2026 | flow matching으로 관측 밖 지형 잠재 예측 | B.9 | [논문](https://arxiv.org/abs/2603.02976) · [프로젝트](https://ziwon-park.github.io/dreamflow/) |
| Miki et al. (perceptive locomotion) `E2E▸인식` | 2022.01 · Science Robotics 2022 | 높이 샘플 + proprioception belief encoder | A.7.1 | [논문](https://arxiv.org/abs/2201.08117) |
| NavDP `E2E▸인식` | 2025.05 · ICRA 2026 | 시뮬 특권 정보로만 학습한 RGB-D 공간 이해 | B.3 | [논문](https://arxiv.org/abs/2505.08712) · [코드](https://github.com/InternRobotics/NavDP) |

### D.2 인식 — Occupancy

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| WalkOCC | 2026.06 | sidewalk 배달로봇 단안 3D occupancy, ray-marching + 하이브리드 학습 | A.3 | [논문](https://arxiv.org/abs/2606.19122) |
| OneOcc | 2025.11 · CVPR 2026 | 다리 로봇 단일 파노라마, Dual-Projection · Bi-Grid · 보행 흔들림 보정 | A.3 | [논문](https://arxiv.org/abs/2511.03571) · [코드](https://github.com/MasterHow/OneOcc) |
| O3N | 2026.03 | 전방위 이미지, Polar-spiral Mamba + CLIP 개방 어휘 | A.3 | [논문](https://arxiv.org/abs/2603.12144) |
| PanoMMOcc / VoxelHound | 2026.03 | 다리 로봇 파노라마 멀티모달, 수직 흔들림 보정 | A.3 | [논문](https://arxiv.org/abs/2603.13108) |
| FlashOcc | 2023.11 | BEV 유지 + channel-to-height, TensorRT export 검증(자동차) | A.2, A.4 | [논문](https://arxiv.org/abs/2311.12058) · [코드](https://github.com/Yzichen/FlashOCC) |
| AgniNav `E2E▸인식` | 2026.06 | 단안 → 1D pseudo-laserscan, 몸체 4 파라미터, Orin 30 Hz | B.2 | [논문](https://arxiv.org/abs/2606.10903) |
| Humanoid Occupancy | 2025.07 | 자기 가림·센서 간섭 대응 파노라마 occupancy + 데이터셋 | A.8 | [논문](https://arxiv.org/abs/2507.20217) · [프로젝트](https://humanoid-occupancy.github.io/) |
| Humanoid-OmniOcc | 2026.06 | 스테레오만으로 Real2Sim2Real 파노라마 occupancy | A.8 | [논문](https://arxiv.org/abs/2606.22971) |
| MonoScene | 2021.12 (자동차, 채택 제외) | 단안 3D semantic scene completion | A.2, A.5 | [논문](https://arxiv.org/abs/2112.00726) |
| TPVFormer | 2023.02 (자동차, 채택 제외) | tri-perspective view occupancy | A.2, A.5 | [논문](https://arxiv.org/abs/2302.07817) |
| SurroundOcc | 2023.03 (자동차, 채택 제외) | 멀티카메라 3D occupancy | A.2, A.5, A.6 | [논문](https://arxiv.org/abs/2303.09551) |

### D.3 인식 — 예측: occupancy flow·world model·행위자

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| Drive-OccWorld `E2E▸인식` | 2024.08 · AAAI 2025 | 메모리 조건부 4D occupancy·flow 예측 | A.6 | [논문](https://arxiv.org/abs/2408.14197) |
| OccWorld `E2E▸인식` | 2023.11 | VQ 장면 토큰 transformer로 미래 occupancy 예측 | A.6 | [논문](https://arxiv.org/abs/2311.16038) · [코드](https://github.com/wzzheng/OccWorld) |
| RiskWorld `E2E▸인식` | 2026.09 | flow-guided occupancy 이송 + risk field, RTX 4090 11.5 FPS | A.6 | [논문](https://arxiv.org/abs/2609.18442) |
| JPPD `E2E▸인식` | 2026.06 | 학습된 시공간 점유 potential(보행자) | B.8.2 | [논문](https://arxiv.org/abs/2606.20686) |
| OccLLaMA | 2024.09 | occupancy-언어-행동 생성형 world model | A.6 | [논문](https://arxiv.org/abs/2409.03272) |
| DFIT-OccWorld | 2024.12 | 동적/정적 flow 분리 + 미분 가능 렌더링 | A.6 | [논문](https://arxiv.org/abs/2412.13772) |
| DOME | 2024.10 | diffusion 기반 제어 가능 occupancy world model | A.6 | [논문](https://arxiv.org/abs/2410.10429) · [코드](https://github.com/gusongen/DOME) |
| GEM | 2026.05 | 임의 시각 질의 가능한 연속 4D 가우시안(비자기회귀) | A.6 | [논문](https://arxiv.org/abs/2605.17682) |
| Let Occ Flow | 2024.07 · CoRL 2024 | 카메라만으로 occupancy + flow 자기지도 | A.6 | [논문](https://arxiv.org/abs/2407.07587) |
| OFMPNet | 2024.04 | Waymo occupancy-and-flow 벤치마크 직접 타깃 | A.6 | [논문](https://arxiv.org/abs/2404.02263) |
| HOPE | 2022.06 | 계층적 시공간 occupancy flow 예측(챌린지 우승 여부는 미검증) | A.6 | [논문](https://arxiv.org/abs/2206.10118) |
| Trajectron++ | 2020.01 | 기구학적으로 실현 가능한 다중 행위자 궤적 예측, 자차 계획 조건(Jetson 실측 없음, 후속 과제) | A.12, PRD R-F-004 | [논문](https://arxiv.org/abs/2001.03093) |

### D.3b 인식 — 마일스톤, 시각 기반 모델, 동적 장애물

A.2·A.2b(지형 지도 계보), A.10.1–A.10.2(traversability 계보와 2026 SOTA), A.11(시각 기반 모델), A.12(검출·추적·예측, A.12.4 로봇 기준 3D·BEV)에서 다룬 연구다.
위 D.1–D.3에 이미 있는 항목(MonoScene, TPVFormer, SurroundOcc, FlashOcc, Trajectron++ 등)은 반복하지 않는다.

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| Lift-Splat-Shoot | 2020.08 · ECCV 2020 | 깊이 분포로 카메라 특징을 BEV에 올리는 리프팅의 원형 | A.2 | [논문](https://arxiv.org/abs/2008.05711) · [코드](https://github.com/nv-tlabs/lift-splat-shoot) |
| BEVFormer | 2022.03 · ECCV 2022 | 격자 BEV query의 공간·시간 attention | A.2 | [논문](https://arxiv.org/abs/2203.17270) · [코드](https://github.com/fundamentalvision/BEVFormer) |
| BEVFusion | 2022.05 · ICRA 2023 | 카메라와 LiDAR를 같은 BEV에서 융합 | A.2 | [논문](https://arxiv.org/abs/2205.13542) · [코드](https://github.com/mit-han-lab/bevfusion) |
| Occ3D | 2023.04 · NeurIPS 2023 | 가시성을 아는 조밀 occupancy 정답과 벤치마크 | A.2 | [논문](https://arxiv.org/abs/2304.14365) · [코드](https://github.com/Tsinghua-MARS-Lab/Occ3D) |
| SparseOcc | 2023.12 · ECCV 2024 | 완전 희소 occupancy, 광선 기반 지표 RayIoU | A.2 | [논문](https://arxiv.org/abs/2312.17118) · [코드](https://github.com/MCG-NJU/SparseOcc) |
| GaussianFormer | 2024.05 · ECCV 2024 | 장면을 3D Gaussian 집합으로 표현 | A.2 | [논문](https://arxiv.org/abs/2405.17429) · [코드](https://github.com/huang-yh/GaussianFormer) |
| GaussianFormer-2 | 2024.12 · CVPR 2025 | Gaussian을 점유 확률로 보는 확률적 중첩 | A.2 | [논문](https://arxiv.org/abs/2412.04384) |
| Robot-centric elevation mapping | CLAWAR 2014 · RA-L 2018 | 칸마다 높이와 분산을 Kalman으로, 자세 불확실성 전파 | A.2b | [코드](https://github.com/ANYbotics/elevation_mapping) |
| RELLIS-3D | 2020.11 · ICRA 2021 | 오프로드 멀티모달 데이터셋, 사람 라벨 20클래스 | A.10.1 | [논문](https://arxiv.org/abs/2011.12954) · [코드](https://github.com/unmannedlab/RELLIS-3D) |
| BADGR | 2020.02 · RA-L 2021 | 충돌·충격 사건을 자기지도 라벨로 행동 조건 예측 모델 학습 | A.10.1 | [논문](https://arxiv.org/abs/2002.05700) · [코드](https://github.com/gkahn13/badgr) |
| TerraPN | 2022.02 · IROS 2022 | IMU 진동·주행거리 오차로 표면 비용을 25분에 온라인 학습 | A.10.1 | [논문](https://arxiv.org/abs/2202.12873) |
| How Does It Feel? | 2022.09 · ICRA 2023 | 속도 조건 proprioception 비용 지도 | A.10.1 | [논문](https://arxiv.org/abs/2209.10788) |
| RoadRunner | 2024.02 · T-FR | 카메라·LiDAR에서 traversability와 높이를 함께, 지연 500→140 ms | A.10.1, PRD R-F-001 | [논문](https://arxiv.org/abs/2402.19341) |
| ViTA | 2026.05 | SAM2를 traversability prompt와 기하 증류로 적응 | A.10.2 | [논문](https://arxiv.org/abs/2605.29565) |
| CATNAV | 2026.03 | VLM 비용 지도 + 의미 캐시로 호출 85.7% 감소 | A.10.2 | [논문](https://arxiv.org/abs/2603.22800) |
| PIVOT | 2026.09 | VLM 비용을 실측과 상관으로 보정, 기하 기본 + VLM 대체 | A.10.2 | [논문](https://arxiv.org/abs/2609.20983) |
| DINOv2 | 2023.04 | 라벨 없이 학습한 범용 영상 특징(Apache-2.0) | A.11 | [논문](https://arxiv.org/abs/2304.07193) · [코드](https://github.com/facebookresearch/dinov2) |
| DINOv3 | 2025.08 | Gram anchoring으로 조밀 특징 유지, 7B 교사 증류(자체 라이선스) | A.11 | [논문](https://arxiv.org/abs/2508.10104) · [코드](https://github.com/facebookresearch/dinov3) |
| Depth Anything V2 | 2024.06 · NeurIPS 2024 | 합성 영상 교사와 가짜 라벨 학생의 단안 깊이 | A.11 | [논문](https://arxiv.org/abs/2406.09414) · [코드](https://github.com/DepthAnything/Depth-Anything-V2) |
| Depth Anything 3 | 2025.11 | 평범한 DINOv2 transformer + depth-ray 목표로 여러 시점 기하 | A.11 | [논문](https://arxiv.org/abs/2511.10647) · [코드](https://github.com/ByteDance-Seed/Depth-Anything-3) |
| SAM 2 | 2024.08 | 스트리밍 메모리로 영상 분할과 추적(Apache-2.0) | A.11 | [논문](https://arxiv.org/abs/2408.00714) · [코드](https://github.com/facebookresearch/sam2) |
| SAM 3 | 2025.11 | 명사구·예시로 지정한 개념의 모든 인스턴스 분할, presence head | A.11 | [논문](https://arxiv.org/abs/2511.16719) · [코드](https://github.com/facebookresearch/sam3) |
| Grounding DINO | 2023.03 · ECCV 2024 | 글로 지정한 물체의 open-set 검출, COCO zero-shot 52.5 AP | A.11 | [논문](https://arxiv.org/abs/2303.05499) · [코드](https://github.com/IDEA-Research/GroundingDINO) |
| Ultralytics YOLO | GitHub | YOLOv8부터 YOLO26까지, 학습·추적·내보내기 일체(AGPL-3.0). PoC(TP-0011)가 사용 | A.12 | [코드](https://github.com/ultralytics/ultralytics) |
| RT-DETR | 2023.04 · CVPR 2024 | 첫 실시간 end-to-end 검출기(Apache-2.0) | A.12 | [논문](https://arxiv.org/abs/2304.08069) · [코드](https://github.com/lyuwenyu/RT-DETR) |
| YOLOv10 | 2024.05 · NeurIPS 2024 | 이중 할당으로 NMS 없는 YOLO(AGPL-3.0) | A.12 | [논문](https://arxiv.org/abs/2405.14458) · [코드](https://github.com/THU-MIG/yolov10) |
| D-FINE | 2024.10 · ICLR 2025 | 상자 회귀를 분포 정제로(Apache-2.0) | A.12 | [논문](https://arxiv.org/abs/2410.13842) · [코드](https://github.com/Peterande/D-FINE) |
| RF-DETR | 2025.11 · ICLR 2026 | DINOv2 백본 + 가중치 공유 NAS, 실시간 첫 60 AP(Apache-2.0) | A.12 | [논문](https://arxiv.org/abs/2511.09554) · [코드](https://github.com/roboflow/rf-detr) |
| ByteTrack | 2021.10 · ECCV 2022 | 낮은 점수 상자도 두 번째 매칭에 쓰는 추적. PoC가 사용 | A.12 | [논문](https://arxiv.org/abs/2110.06864) · [코드](https://github.com/FoundationVision/ByteTrack) |
| BoT-SORT | 2022.06 | 카메라 움직임 보정, 칼만 상태 개선, ReID 융합 | A.12 | [논문](https://arxiv.org/abs/2206.14651) · [코드](https://github.com/NirAharon/BoT-SORT) |
| Social GAN | 2018.03 · CVPR 2018 | GAN과 사회적 pooling으로 여러 미래 샘플 | A.12 | [논문](https://arxiv.org/abs/1803.10892) · [코드](https://github.com/agrimgupta92/sgan) |
| Constant Velocity Model | 2019.03 · RA-L 2020 | 등속 모델이 신경망 보행자 예측과 비슷하거나 낫다 | A.12 | [논문](https://arxiv.org/abs/1903.07933) |
| AgentFormer | 2021.03 · ICCV 2021 | 시간과 사회 차원을 한 transformer로 | A.12 | [논문](https://arxiv.org/abs/2103.14023) · [코드](https://github.com/Khrylx/AgentFormer) |
| MID | 2022.03 · CVPR 2022 | 확산으로 불확정성을 걷어 내는 궤적 예측 | A.12 | [논문](https://arxiv.org/abs/2203.13777) · [코드](https://github.com/gutianpei/MID) |
| LED | 2023.03 · CVPR 2023 | leapfrog 초기화로 확산 예측 19–31배 가속 | A.12 | [논문](https://arxiv.org/abs/2303.10895) · [코드](https://github.com/MediaBrain-SJTU/LED) |
| SingularTrajectory | 2024.03 · CVPR 2024 | 다섯 예측 과제를 한 특이값 공간으로 | A.12 | [논문](https://arxiv.org/abs/2403.18452) · [코드](https://github.com/InhwanBae/SingularTrajectory) |
| MoFlow | 2025.03 · CVPR 2025 | flow matching K-shot 예측 + IMLE 한 스텝 증류 | A.12 | [논문](https://arxiv.org/abs/2503.09950) · [코드](https://github.com/DSL-Lab/MoFlow) |
| CenterPoint | 2020.06 · CVPR 2021 | BEV 중심점 검출 + 속도 헤드로 탐욕 매칭 추적, nuScenes 65.5 NDS·63.8 AMOTA | A.12.4 | [논문](https://arxiv.org/abs/2006.11275) · [코드](https://github.com/tianweiy/CenterPoint) |
| AB3DMOT | 2019.07 · IROS 2020 | 3D 칼만 + 3D IoU 헝가리안, 207 FPS, 3D 추적 지표 | A.12.4 | [논문](https://arxiv.org/abs/1907.03961) · [코드](https://github.com/xinshuoweng/AB3DMOT) |
| FaF (Fast and Furious) | CVPR 2018 | LiDAR BEV 한 네트워크로 검출·추적·예측, 30 ms | A.12.4 | [논문](https://arxiv.org/abs/2012.12395) |
| MotionNet | 2020.03 · CVPR 2020 | BEV 칸마다 범주와 움직임, 상자 기반 시스템의 백업 | A.12.4 | [논문](https://arxiv.org/abs/2003.06754) · [코드](https://github.com/pxiangwu/MotionNet) |
| UnO | 2024.06 · CVPR 2024 | LiDAR 광선 가짜 라벨로 4D 점유장 자기지도 학습 | A.12.4 | [논문](https://arxiv.org/abs/2406.08691) |
| DR-SPAAM | 2020.04 · IROS 2020 | 2D LiDAR 사람 검출, 공간 attention 누적(GPL-3.0) | A.12.4 | [논문](https://arxiv.org/abs/2004.14079) · [코드](https://github.com/VisualComputingInstitute/2D_lidar_person_detection) |
| 임베디드 2D LiDAR 사람 추적 | 2024.12 | DR-SPAAM + 등속 칼만(Norfair)을 사족보행 로봇에, 20 Hz MOTA 85.45% | A.12.4 | [논문](https://arxiv.org/abs/2412.15000) |
| JRDB | 2019.10 · T-PAMI 2021 | 로봇 시점 사람 인식 데이터셋, 3D 상자 180만 개 | A.12.4 | [논문](https://arxiv.org/abs/1910.11792) · [사이트](https://jrdb.erc.monash.edu/) |
| Person-MinkUNet | 2021.07 | sparse 3D 합성곱 사람 검출, JRDB AP 76.4% | A.12.4 | [논문](https://arxiv.org/abs/2107.06780) · [코드](https://github.com/VisualComputingInstitute/Person_MinkUNet) |
| 2D vs 3D LiDAR 사람 검출 | 2021.06 · IROS 2022 | JRDB에서 DR-SPAAM과 CenterPoint 비교, Jetson 속도 | A.12.4 | [논문](https://arxiv.org/abs/2106.11239) |
| RoboSense | 2024.08 · CVPR 2025 | 로봇 근거리 멀티센서 데이터셋, 3D 상자 140만 개 | A.12.4 | [논문](https://arxiv.org/abs/2408.15503) · [코드](https://github.com/suhaisheng/RoboSense) |
| MonoLoco | 2019.06 · ICCV 2019 | 2D 관절에서 3D 위치와 Laplace 불확실성 | A.12.4 | [논문](https://arxiv.org/abs/1906.06059) · [코드](https://github.com/vita-epfl/monoloco) |
| navigation2_dynamic | GitHub | Nav2 동적 장애물 칼만·헝가리안 추적, ObstacleArray | A.12.4 | [코드](https://github.com/ros-navigation/navigation2_dynamic) |
| M-detector | Nat. Commun. 2024 | 가림 원리로 점마다 수 µs에 이동 판정(GPL-2.0) | A.12.4 | [논문](https://www.nature.com/articles/s41467-023-44554-8) · [코드](https://github.com/hku-mars/M-detector) |
| Dynablox | 2023.04 · RA-L 2023 | 확실한 빈 공간에 나타난 점으로 이동 검출, IoU 86% 17 FPS | A.12.4 | [논문](https://arxiv.org/abs/2304.10049) · [코드](https://github.com/ethz-asl/dynablox) |
| 동적 occupancy grid (DOGMa) | 2016.05 · IJRR 2018 | random finite set 입자 필터로 칸별 점유와 속도 | A.12.4 | [논문](https://arxiv.org/abs/1605.02406) · [코드](https://github.com/TheCodez/dynamic-occupancy-grid-map) |
| EgoTraj-Bench | 2025.10 | 잡음 섞인 1인칭 이력으로 예측, BiFlow로 minADE·minFDE 10–15% 감소 | A.12.4 | [논문](https://arxiv.org/abs/2510.00405) |
| Legs Over Arms | 2026.02 · ICRA 2026 | 하체 3D 관절이 로봇 시점 궤적 예측 ADE 13% 감소 | A.12.4 | [논문](https://arxiv.org/abs/2602.09076) |
| Conformal 군중 내비게이션 | 2025.08 · CoRL 2025 | 적응형 conformal 오차 범위 + 제약 강화학습 | A.12.4 | [논문](https://arxiv.org/abs/2508.05634) |
| 예측 품질과 내비게이션 성능 | 2026.01 | 사용자 80명 실험, ADE가 내비게이션 성능을 대변하지 못함 | A.12.4 | [논문](https://arxiv.org/abs/2601.09856) |
| EgoNeMo | 2026.09 | 1인칭 LiDAR로 옮겨 쓸 수 있는 보행 패턴 지도 | A.12.4 | [논문](https://arxiv.org/abs/2609.06195) |

---

<!-- tab: Planner -->

### D.0 E2E 연구 분해 — 인식 부분 / 플래너 부분

| 연구 | 입력 → 출력 | 인식 부분 | 플래너 부분 | travplan에 쓸 부분 | 목록 |
|---|---|---|---|---|---|
| Drive-OccWorld | 멀티카메라 → 미래 4D occupancy·flow + 궤적 | 과거 BEV 임베딩을 누적하는 메모리 + 의미·운동 조건부 정규화로 미래 occupancy·flow 예측 | 속도·조향·궤적 조건부로 미래를 생성해 후보 궤적 중 최적을 선택 | **인식**: 보행자 미래 점유 예측(등속 `DynamicObstacles`의 후속 후보). **플래너**: 후보별 예측 점유로 채점 → Planner D 선택기 확장 | D.3, D.5 |
| OccWorld | 과거 occupancy → 미래 occupancy + ego 궤적 | VQ scene tokenizer(occupancy → 이산 토큰) | 장면 토큰과 ego 토큰을 한 transformer로 함께 생성 | **인식**: 장면 전체 미래 예측. 플래너 쪽은 JPPD·Diffusion Planner가 더 직접적 | D.3 |
| RiskWorld | 카메라 + 지도 + 행위자 → 위험 인지 궤적 | flow-guided occupancy 이송 + signed residual 보정, risk field | 현재 계획과 후보를 충돌 점수로 비교해 위험이 임계를 넘고 대안이 제약을 만족할 때만 교체(예측 재사용) | **인식**: flow 기반 점유 예측. **플래너**: 선택적 재계획 → Planner D 재계획 간 일관성 | D.3, D.5 |
| JPPD | 로봇 상태 + 보행자 이력 + 지도 + 목표 → 로봇·보행자 미래 | 시공간 occupancy 확률 네트워크(학습된 점유 potential) | 로봇·보행자 공동 diffusion + 미분 가능 안전 포텐셜 guidance, CLF로 목표 진행 | **둘 다**: 보행자 점유를 학습 필드로, 공동 생성으로 상호작용. 보도 배달로봇·Isaac Sim·ROS 검증 | D.3, D.5 |
| Diffusion Planner | 벡터화된 이웃·차선(인식 결과) → ego + 이웃 궤적 | 센서 인식은 없음. 이웃 10대의 미래 **예측**을 계획과 한 번에 생성 | DiT, classifier guidance, DPM-Solver++ 10 step | **플래너**(주 참고). 예측을 계획에 합치는 구조는 2단계 과제 | D.5 |
| DiffusionDrive | 카메라 + LiDAR → 궤적 | TransFuser식 카메라·LiDAR BEV 융합(ResNet-34) | 20개 anchor에서 시작하는 truncated diffusion 2 step + cascade decoder | **플래너**: anchor로 모드 커버리지 확보(Planner D의 급회전 실패 대응 후보). 인식은 자동차 멀티센서라 제외 | D.5 |
| FeaXDrive | 센서 → 궤적(NAVSIM) | 자동차 E2E 백본 | 곡률 정규화 학습 + drivable-area guidance + feasibility GRPO 후학습 | **플래너**: 생성 중 guidance(Planner D 개선안 2) | D.5 |
| GuideFlow | 센서 → 궤적 | 자동차 E2E 백본 | constrained flow matching + EBM으로 물리 제약 직접 강제 | **플래너**: Planner D와 같은 flow matching에 제약 추가 | D.5 |
| NavDP | RGB-D → 궤적 후보 + 안전 점수 | RGB-D 인코더(transformer), 시뮬 특권 정보로 공간 이해 학습 | diffusion 궤적 헤드 + ESDF 특권 정보로 학습한 critic(contrastive) | **플래너**: 학습 critic → Planner D의 비학습 선택기 대체. **인식**(부분): 특권 정보로 시뮬에서만 학습한 깊이 인코더 | D.1, D.5 |
| SanD-Planner | 깊이 → 궤적 | 깊이 인코더 | clamped B-spline 공간 diffusion + ESDF 안전 검사기, 데모 500 에피소드 | **플래너**: B-spline 공간 생성(매끄러움·표본 효율) | D.5 |
| ViNT / NoMaD | RGB 이력(+목표 이미지) → waypoint | EfficientNet 인코더 + transformer, 토폴로지 그래프 | NoMaD: 목표 마스킹 diffusion으로 목표가 없을 때 탐색 | **플래너**: 목표 마스킹 탐색 → 알려진 한계인 "미관측 영역 탐색" 대응 | D.4 |
| AgniNav | 단안 RGB + 로봇 높이 → 1D pseudo-laserscan → 고전 로컬 플래너 | 이미지 → 충돌 관련 1D scan(높이 조건, column-minimum 라벨) | 풋프린트 4 파라미터로 충돌 검사하는 고전 플래너 | **인식**: 카메라 단독 경량 중간 표현, Jetson Orin 30 Hz 실측 | D.2 |
| MILER | 카메라 + LiDAR → 차량 제어 | BEVFusion 시맨틱 BEV = 시뮬과 같은 중간 표현(sim-to-real 다리) | 시뮬 RL 정책(자전거 모델) + trajectory alignment로 zero-shot 전이 | **인식**: "중간 표현으로 sim-to-real"은 TravMap 설계와 같은 발상. 플래너(부분): trajectory alignment | D.1, D.4 |
| CORE Planner | 이미지 기반 환경 → 미지 환경 목표 도달 | sparse visibility graph(밀집 격자 대비 경량) | transformer + 문맥 메모리로 결정 | **플래너**(부분): 미지 환경 탐색 | D.4 |
| TANGO | RGB + 언어 → 29-DoF 전신 명령 | 1인칭 RGB(VLM) | 전역 경로 + 운동학 모션 생성 + 장애물 편집 + RL로 만든 시뮬 supervision | **플래너**(부분): 학습 데이터 생성 파이프라인이 Planner D expert 생성과 같은 구조 | D.4 |
| DreamFlow | 높이 지도 → 로컬 속도 명령(DRL) | flow matching으로 관측 밖 지형 잠재를 상상 | 관측 + 상상 잠재를 받는 DRL 로컬 정책 | **둘 다**: 미관측 영역 예측(인식), 막다른 곳 사전 회피(플래너) | D.1, D.4 |
| RoM-Nav | LiDAR + 깊이 → 평면 속도 명령 → 고정 보행 정책 | denoising VAE CNN 인코더(바닥·장애물·계단·램프 분할 헤드)를 사전학습 후 고정 | 축소 모델 정책으로 kickstart한 내비 정책 + Poisson 안전 필터 | **둘 다**: 분할 헤드 달린 사전학습 인코더(인식), Planner/Controller 분리·축소 모델 → 실동역학 이전(플래너) | D.1, D.4 |
| Path-conditioned RL local planning | 깊이 + proprioception + 참조 경로 → 로컬 명령 | 사전학습 깊이 인코더 | 경로를 관측으로만 받는 RL 정책(추종 보상 없음) | **플래너**: 틀린 전역 경로에 강건한 학습 Planner | D.4 |
| ANYmal Parkour | 점군 → 관절 명령(계층형) | 점군으로 지형을 복원하는 인식 모듈 | 기술(skill) 선택·목표를 정하는 내비 정책 + 기술 정책 | **플래너**(부분): 계획/실행 분리를 기술 단위로 확장. 인식(부분): 지형 복원 | D.8 |
| Miki et al. 2022 | elevation map + proprioception → 관절 명령 | 높이 샘플과 proprioception을 융합하는 belief encoder | 보행 정책(Controller 성격) | **인식**: 지도가 틀릴 때 덜 믿는 융합 → `TravMap.SIGMA` 활용 | D.1, D.8 |
| Robostral Navigate | 단안 RGB + 언어 → 이미지 공간 waypoint | 8B VLM | 이미지 공간에서 목표 지점 예측(몸체 무관) | **플래너**(부분): 몸체 무관 출력 공간 | D.4 |

### D.4 Planner — 학습 기반 (waypoint·RL·foundation)

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| ViNT | 2023.06 | 시각 내비게이션 foundation model(transformer, waypoint) | B.6 | [논문](https://arxiv.org/abs/2306.14846) · [코드](https://github.com/robodhruv/visualnav-transformer) |
| NoMaD `E2E▸플래너` | 2023.10 | 목표 마스킹 diffusion으로 목표 도달·탐색 겸용 | B.6 | [논문](https://arxiv.org/abs/2310.07896) · [코드](https://github.com/robodhruv/visualnav-transformer) |
| GNM | 2022.10 | 여러 로봇에 쓰는 일반 내비게이션 모델 | B.6 | [논문](https://arxiv.org/abs/2210.03370) |
| Skill-Nav | 2025.06 | waypoint 인터페이스 + 지형 적응 RL 보행(계층형) | B.2 | [논문](https://arxiv.org/abs/2506.21853) |
| MILER `E2E▸플래너` | 2026.09 | 시뮬 RL 정책 + trajectory alignment로 zero-shot 실주행 | B.4 | [논문](https://arxiv.org/abs/2609.20747) |
| CORE Planner `E2E▸플래너` | 2026.06 | visibility graph + transformer + 메모리, 미지 환경 목표 도달 | B.4 | [논문](https://arxiv.org/abs/2606.29222) |
| TANGO `E2E▸플래너` | 2026.09 | 전신 VLA 내비, 시뮬 supervision 파이프라인, G1 zero-shot | A.8 | [논문](https://arxiv.org/abs/2609.09158) |
| RoM-Nav `E2E▸플래너` | 2026.09 · ICRA 2027 심사 중 | 축소 모델 kickstart 내비 정책 + 고정 보행 제어기 + Poisson 안전 필터, G1 다층 내비 | B.9, B.12.3 | [논문](https://arxiv.org/abs/2609.19272) · [프로젝트](https://wdc3iii.github.io/rom-nav/) · [코드](https://github.com/wdc3iii/rom-nav) · [영상](https://www.youtube.com/watch?v=l_YT4iP0W8Q) |
| ViNL | 2022.10 · ICRA 2023 | 따로 학습한 운동학 내비 정책과 시각 보행 정책을 속도 명령으로 zero-shot 연결 | B.9 | [논문](https://arxiv.org/abs/2210.14791) · [코드](https://github.com/SimarKareer/ViNL) |
| Path-conditioned RL Local Planning `E2E▸플래너` | 2026.03 | 참조 경로를 관측으로만 쓰는 RL 로컬 플래너(ETH RSL) | B.9 | [논문](https://arxiv.org/abs/2603.13888) |
| 학습 전방 동역학 모델 FDM | 2025.04 · RSS 2025 | 높이 스캔·proprioception·명령열 → 앞 자세와 실패 확률, MPPI 채점, Orin 7 Hz (ETH RSL) | B.14 | [논문](https://arxiv.org/abs/2504.19322) · [코드](https://github.com/leggedrobotics/fdm) |
| 바퀴·다리 로봇 도시 내비게이션 | 2024.05 · Science Robotics 2024 | 전역 그래프 + 학습 내비 정책 + 학습 보행 정책 3층, 취리히·세비야 km 단위 (ETH RSL) | B.14 | [논문](https://arxiv.org/abs/2405.01792) · [프로젝트](https://junja94.github.io/learning_robust_autonomous_navigation_and_locomotion_for_wheeled_legged_robots/) |
| SRU (공간 강화 순환 유닛) | 2025.06 · IJRR 2025 | 원소별 곱으로 RNN에 공간 변환을 넣어 지도 없는 장거리 내비 (ETH RSL) | B.14 | [논문](https://arxiv.org/abs/2506.05997) · [코드](https://github.com/leggedrobotics/sru-pytorch-spatial-learning) |
| CLUE | 2026.05 | LLM 상식으로 방·물체 단서를 가중한 통합 시맨틱 가치 지도, zero-shot object-goal | B.6 | [논문](https://arxiv.org/abs/2605.19206) |
| DreamFlow `E2E▸플래너` | 2026.03 · ICRA 2026 | 관측 + 상상 잠재 DRL 로컬 내비, Go2 실험 | B.9 | [논문](https://arxiv.org/abs/2603.02976) · [프로젝트](https://ziwon-park.github.io/dreamflow/) |
| Robostral Navigate `E2E▸플래너` | 2026.07 | 8B VLM, 이미지 공간 waypoint, R2R-CE 77.4% | B.6 | [논문](https://huggingface.co/papers/2607.20785) |

### D.4b Planner — 비학습 위험 인지 경로 계획 (비교 기준)

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| TRG-planner | 2025.01 · RA-L 2025, IROS 2025 oral | Traversal Risk Graph 위 안전·최단 경로, ICRA 2023 QRC 우승 팀 전역 플래너 | B.9 | [논문](https://arxiv.org/abs/2501.01806) · [프로젝트](https://trg-planner.github.io/) |
| Risk-Aware Kinodynamic Planning (Planetary) | 2026.08 | AO-RRT + SCP, CVaR 위험으로 불확실한 지형 회피 | B.9 | [논문](https://arxiv.org/abs/2608.11175) |

### D.5 Planner — 생성형 궤적 (diffusion·flow) — Planner D 직접 참고

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| Diffusion Planner | 2025.01 · ICLR 2025 | 예측 + 계획 공동 diffusion, classifier guidance. Autoware 채택 | B.8.1, B.12.1 | [논문](https://arxiv.org/abs/2501.15564) · [코드](https://github.com/ZhengYinan-AIR/Diffusion-Planner) |
| Autoware Diffusion Planner | 2025.07 (TIER IV) | 위 모델의 ROS 2 통합, v4.0 Real-Time Chunking | B.8 | [PR](https://github.com/autowarefoundation/autoware_universe/pull/10957) · [영상](https://www.youtube.com/watch?v=Ug9Pv2fOdmg) |
| JPPD `E2E▸플래너` | 2026.06 | 보도 공유공간 로봇·보행자 공동 diffusion, CPU 32 ms | B.8.2 | [논문](https://arxiv.org/abs/2606.20686) |
| NavDP `E2E▸플래너` | 2025.05 · ICRA 2026 | diffusion 궤적 + 특권 ESDF로 학습한 critic | B.3 | [논문](https://arxiv.org/abs/2505.08712) · [코드](https://github.com/InternRobotics/NavDP) |
| SanD-Planner `E2E▸플래너` | 2026.02 | B-spline 공간 diffusion + ESDF 검사기, 데모 500 에피소드 | — | [논문](https://arxiv.org/abs/2602.00923) |
| DiffusionDrive `E2E▸플래너` | 2024.11 · CVPR 2025 | anchor truncated diffusion 2 step, 4090 45 FPS | B.8.2 | [논문](https://arxiv.org/abs/2411.15139) · [코드](https://github.com/hustvl/diffusiondrive) |
| FeaXDrive `E2E▸플래너` | 2026.04 | 곡률 정규화 + drivable-area guidance + GRPO | B.8.2 | [논문](https://arxiv.org/abs/2604.12656) |
| GuideFlow `E2E▸플래너` | 2025.11 · CVPR 2026 | constrained flow matching + EBM | B.8.2 | [논문](https://arxiv.org/abs/2511.18729) |
| Drive-OccWorld `E2E▸플래너` | 2024.08 · AAAI 2025 | 행동 조건부 미래 생성으로 후보 궤적 선택 | A.6 | [논문](https://arxiv.org/abs/2408.14197) |
| RiskWorld `E2E▸플래너` | 2026.09 | 위험 임계 기반 선택적 재계획 | A.6 | [논문](https://arxiv.org/abs/2609.18442) |
| NMoMa (Primitive-based Truncated Diffusion) | 2026.04 | primitive로 치우친 truncated diffusion + 궤적 최적화, 차동 구동 모바일 매니퓰레이터 | B.9 | [논문](https://arxiv.org/abs/2604.04166) · [프로젝트](https://nmoma.github.io/nmoma/) · [코드](https://github.com/nmoma/nmoma) |
| PC-Diffuser | 2026.03 | denoise 루프 안 capsule CBF 안전 필터, LQR로 자전거 모델 feasible | B.8.2 | [논문](https://arxiv.org/abs/2603.10330) |
| Adaptive Time Step Flow Matching | 2026.02 | 분산 추정으로 step 수 선택 + QP 후처리, RTX 3070 20 Hz | B.8.2 | [논문](https://arxiv.org/abs/2602.10285) |
| MISTY | 2026.04 | 단일 step drifting, 10.1 ms | B.8.2 | [논문](https://arxiv.org/abs/2604.21489) |
| GRACE | 2026.07 | reverse step마다 MPPI로 guidance 평균 추정(gradient 불필요) | B.8.2 | [논문](https://arxiv.org/abs/2607.21661) |
| CoDiG | 2025.05 | denoise SDE에 지수 barrier 기울기를 더해 제약 만족, 1:28 경주차 실물. 4090 2.5 Hz(warm start) | B.8.2 | [논문](https://arxiv.org/abs/2505.13131) |
| 최적화 guidance (OGD) | 2026.06 | 역방향 스텝의 노이즈를 최적화 변수로 치환, 재학습 없이 hard 제약. 제약 solver는 46–69배 | B.8.2 | [논문](https://arxiv.org/abs/2606.24208) |

### D.5b Planner — 고전 기준선, 마일스톤, VLA, E2E 주행

B.10(고전 기준선), B.4b(비용 지도 자기지도), B.6b(VLA·도시 내비), B.8.0(생성형 궤적 계보), B.11(E2E 주행)에서 다룬 연구다. 고전 논문은
arXiv가 없어 DOI로 링크했다.

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| Dijkstra | 1959 · Numerische Mathematik | 그래프 최단 경로. travplan `GuidancePlanner`의 알고리즘 | B.10 | [DOI](https://doi.org/10.1007/BF01386390) |
| A* | 1968 · IEEE Trans. SSC | 휴리스틱으로 탐색 순서를 정하는 최단 경로 | B.10 | [DOI](https://doi.org/10.1109/TSSC.1968.300136) |
| DWA | 1997 · IEEE RAM | 동적 창 안의 속도 선택 로컬 플래너 | B.10 | [DOI](https://doi.org/10.1109/100.580977) |
| Hybrid A* | 2008 워크숍 · IJRR 2010 | 연속 자세를 가진 격자 A*, 차량 기구학 경로 | B.10 | [DOI](https://doi.org/10.1177/0278364909359210) |
| TEB | 2012–2017 · RAS 2017 | 시간 간격 궤적의 희소 그래프 최적화, 여러 위상 후보 | B.10, B.12.4 | [DOI](https://doi.org/10.1016/j.robot.2016.11.007) · [코드](https://github.com/rst-tu-dortmund/teb_local_planner) |
| Nav2 (The Marathon 2) | 2020.03 · IROS 2020 | behavior tree 기반 ROS 2 내비 스택 | B.10, B.12.4 | [논문](https://arxiv.org/abs/2003.00368) · [코드](https://github.com/ros-navigation/navigation2) |
| ROS 2 내비 알고리즘 개관 | 2023.07 | Nav2 유지보수자들이 쓴 알고리즘 비교 | B.10 | [논문](https://arxiv.org/abs/2307.15236) |
| Smac Planner | 2024.01 | 비용 인식 A\*, Hybrid-A\*, State Lattice. Nav2 기본 계획기 | B.10, B.12.4 | [논문](https://arxiv.org/abs/2401.13078) |
| iPlanner | 2023.02 · RSS 2023 | 비용 지도의 기울기로 학습하는 경로 Planner, fear loss | B.4b, B.12.2 | [논문](https://arxiv.org/abs/2302.11434) · [코드](https://github.com/leggedrobotics/iPlanner) |
| ViPlanner | 2023.10 · ICRA 2024 | 의미 비용 지도로 확장, 시뮬 학습만으로 실물 | B.4b, B.12.2 | [논문](https://arxiv.org/abs/2310.00982) · [코드](https://github.com/leggedrobotics/viplanner) |
| OpenVLA | 2024.06 | 공개 7B VLA, 행동을 256구간 토큰으로 | B.6b | [논문](https://arxiv.org/abs/2406.09246) · [코드](https://github.com/openvla/openvla) |
| Mobility VLA | 2024.07 · CoRL 2024 | 긴 문맥 VLM이 시연 투어에서 목표 프레임만 고르고 위상 그래프가 waypoint를 냄. 계층을 없애면 0% | B.6c | [논문](https://arxiv.org/abs/2407.07775) |
| π0 | 2024.10 · RSS 2025 | VLM + flow matching 행동 전문가, Euler 10스텝 | B.6b, B.8.0 | [논문](https://arxiv.org/abs/2410.24164) · [코드](https://github.com/Physical-Intelligence/openpi) |
| NaVILA | 2024.12 | 언어로 된 중간 행동 + 보행 RL 정책의 두 층 VLA | B.6b | [논문](https://arxiv.org/abs/2412.04453) · [코드](https://github.com/AnjieCheng/NaVILA) |
| Uni-NaVid | 2024.12 | 내비 과제 넷을 한 영상 VLA로, 5 Hz | B.6b | [논문](https://arxiv.org/abs/2412.06224) · [코드](https://github.com/jzhzhang/Uni-NaVid) |
| CityWalker | 2024.11 · CVPR 2025 | 웹 도시 보행 영상 2,000시간 이상으로 학습한 도시 내비 | B.6b | [논문](https://arxiv.org/abs/2411.17820) · [코드](https://github.com/ai4ce/CityWalker) |
| MIMIC | 2026.03 | Coco 배달로봇 원격조종 로그 50시간으로 보도 자율주행. 다중 규모 모방 + 교정 행동 확장, 400 m당 개입 4회 | B.6d | [논문](https://arxiv.org/abs/2603.22527) |
| Can Vision Foundation Models Navigate? | 2026.03 | 시각 내비 기반 모델 다섯 개의 실제 환경 평가, 잦은 충돌 | B.6b | [논문](https://arxiv.org/abs/2603.25937) |
| InternNav | GitHub | 내비 기반 모델을 만드는 공개 플랫폼 | B.0 | [코드](https://github.com/InternRobotics/InternNav) |
| Diffuser | 2022.05 · ICML 2022 | 궤적 전체를 확산으로 생성하는 계획 | B.8.0 | [논문](https://arxiv.org/abs/2205.09991) · [코드](https://github.com/jannerm/diffuser) |
| Diffusion Policy | 2023.03 · RSS 2023 | 관측 조건 행동 열 확산, receding horizon | B.8.0 | [논문](https://arxiv.org/abs/2303.04137) · [코드](https://github.com/real-stanford/diffusion_policy) |
| MPD | 2023.08 | 확산 prior와 비용 likelihood의 사후 분포 샘플 | B.8.0 | [논문](https://arxiv.org/abs/2308.01557) · [코드](https://github.com/joaoamcarvalho/mpd-public) |
| GoalFlow | 2025.03 · CVPR 2025 | 목표점 선택 + flow matching 한 스텝, NAVSIM PDMS 90.3 | B.8.0 | [논문](https://arxiv.org/abs/2503.05689) · [코드](https://github.com/YvanYin/GoalFlow) |
| UniAD | 2022.12 · CVPR 2023 | 계획 중심 E2E 주행, 과제를 query로 연결 | B.11 | [논문](https://arxiv.org/abs/2212.10156) · [코드](https://github.com/OpenDriveLab/UniAD) |
| VAD | 2023.03 · ICCV 2023 | 벡터 장면 표현과 벡터 계획 제약 | B.11 | [논문](https://arxiv.org/abs/2303.12077) · [코드](https://github.com/hustvl/VAD) |
| SparseDrive | 2024.05 | 희소 표현, 예측·계획 병렬, 충돌 인식 재채점 | B.11 | [논문](https://arxiv.org/abs/2405.19620) · [코드](https://github.com/swc-17/SparseDrive) |
| NAVSIM | 2024.06 · NeurIPS 2024 D&B | 비반응 시뮬레이션 지표 PDMS | B.11 | [논문](https://arxiv.org/abs/2406.15349) · [코드](https://github.com/autonomousvision/navsim) |
| Hydra-MDP | 2024.06 | 궤적 어휘와 규칙 기반 점수 증류, CVPR 2024 챌린지 1위 | B.11 | [논문](https://arxiv.org/abs/2406.06978) · [코드](https://github.com/NVlabs/Hydra-MDP) |
| DriveVLM | 2024.02 | VLM 장면 이해 + 기존 스택 결합, 양산차 배포 | B.11 | [논문](https://arxiv.org/abs/2402.12289) |
| EMMA | 2024.10 · TMLR | 다중모달 LLM이 궤적·물체·도로를 텍스트로 출력 | B.11 | [논문](https://arxiv.org/abs/2410.23262) |
| ChauffeurNet | 2018.12 | 모방 + 합성한 실패 상황 + 벌점, 3,000만 예시로도 순수 모방은 부족 | B.13 | [논문](https://arxiv.org/abs/1812.03079) |
| PDM (Parting with Misconceptions) | 2023.06 · CoRL 2023 | 규칙 기반 IDM 후보 선택이 nuPlan 1위, 열린 루프 지표의 한계 | B.13 | [논문](https://arxiv.org/abs/2306.07962) · [코드](https://github.com/autonomousvision/tuplan_garage) |
| RAD | 2025.02 · NeurIPS 2025 | 3DGS 환경의 대규모 강화학습, 충돌률 1/3 | B.13 | [논문](https://arxiv.org/abs/2502.13144) · [코드](https://github.com/hustvl/RAD) |
| Scaling Laws of Motion Forecasting and Planning | 2025.06 | Waymo 50만 시간, 계산량 거듭제곱 법칙, 폐루프도 개선 | B.13 | [논문](https://arxiv.org/abs/2506.08228) |
| Alpamayo-R1 | 2025.11 | 인과 사슬 추론 VLA 10B, 99 ms | B.13 | [논문](https://arxiv.org/abs/2511.00088) · [코드](https://github.com/NVlabs/alpamayo) |
| NAVSIM v2 (pseudo-simulation) | CoRL 2025 | 3DGS 합성 관측의 2단계 평가, 폐루프와 강한 상관, 계산 1/6 | B.13 | [코드](https://github.com/autonomousvision/navsim) |
| NoRD | 2026.02 · CVPR 2026 | 추론 주석 없는 주행 VLA, Dr. GRPO | B.13 | [논문](https://arxiv.org/abs/2602.21172) |
| Post-Training in E2E Autonomous Driving | 2026.07 | RL·선호 최적화·GRPO·보상 설계로 본 후학습 서베이 | B.13 | [논문](https://arxiv.org/abs/2607.08072) |
| DriveZero | 2026.09 | 사람 궤적 없이 혼합 에이전트 폐루프 RL, nuPlan 93.57 | B.13 | [논문](https://arxiv.org/abs/2609.06055) |

### D.5c Planner — 로봇별 오픈소스 스택

B.12(자율주행 자동차, 사족보행, 휴머노이드, 바퀴 로봇의 공개 Planner)에서 다룬 코드와 논문이다. 위 목록이나 다른 탭에 이미 있는 항목(Nav2,
TEB, Smac, iPlanner, ViPlanner, X-Mobility, COMPASS, legged_gym, autonomy_stack_go2 등)은 반복하지 않고 그 행의 "본문" 칸에 B.12를 더했다.

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| Autoware | GitHub (ROS 2) | 규칙 모듈 풀스택, 생성형·규칙 후보를 검증기와 순위기로 고르는 새 계획 구조 | B.12.1 | [코드](https://github.com/autowarefoundation/autoware) · [planning](https://github.com/autowarefoundation/autoware_universe/tree/main/planning) · [새 구조 논의](https://github.com/tier4/new_planning_framework) |
| Apollo EM planner | 2018.07 | Frenet 좌표의 DP + 스플라인 QP, 3,380시간 폐루프 | B.12.1 | [논문](https://arxiv.org/abs/1807.08048) · [코드](https://github.com/ApolloAuto/apollo/tree/master/modules/planning) |
| TDR-OBCA | 2020.09 | Apollo open space(주차) 최적화 기반 충돌 회피 | B.12.1 | [논문](https://arxiv.org/abs/2009.11345) |
| openpilot | 2025.04 | 양산 운전자 보조, world model 안에서 주행 정책 학습 | B.12.1 | [논문](https://arxiv.org/abs/2504.19077) · [코드](https://github.com/commaai/openpilot) |
| nuPlan | 2021.06 | 폐루프 ML 계획 벤치마크 | B.12.1 | [논문](https://arxiv.org/abs/2106.11810) · [코드](https://github.com/motional/nuplan-devkit) |
| PDM (tuplan_garage) | 2023.06 · CoRL 2023 | IDM 제안 15개 + 시뮬 + 점수 선택, nuPlan 2023 우승 | B.12.1 | [논문](https://arxiv.org/abs/2306.07962) · [코드](https://github.com/autonomousvision/tuplan_garage) |
| PlanTF | 2023.09 · ICRA 2024 | 모방 학습 Planner 기준선, 지름길 학습 진단(State Dropout, 상태 교란) | B.12.1 | [논문](https://arxiv.org/abs/2309.10443) · [코드](https://github.com/jchengai/planTF) |
| PLUTO | 2024.04 | 횡·종 query 후보 + ESDF 충돌 손실 + 대조 학습, 규칙 채점기와 합쳐 규칙 기반을 처음 넘음 | B.12.1 | [논문](https://arxiv.org/abs/2404.14327) · [코드](https://github.com/jchengai/pluto) |
| PlanT | 2022.10 · CoRL 2022 | 객체 토큰 transformer, 규칙 expert 모방으로 교사를 넘음 | B.12.1 | [논문](https://arxiv.org/abs/2210.14222) · [코드](https://github.com/autonomousvision/plant) |
| TransFuser | 2022.05 · T-PAMI 2023 | 카메라·LiDAR transformer 융합 E2E | B.12.1 | [논문](https://arxiv.org/abs/2205.15997) · [코드](https://github.com/autonomousvision/transfuser) |
| CaRL | 2025.04 · CoRL 2025 | 경로 완주 × 곱하는 감점, 위반 시 종료의 단순 보상으로 PPO를 5억 샘플까지 | B.12.1 | [논문](https://arxiv.org/abs/2504.17838) · [코드](https://github.com/autonomousvision/CaRL) |
| EPSILON | 2021.08 · T-RO 2021 | POMDP 행동 계획 + 시공간 의미 회랑 | B.12.1 | [논문](https://arxiv.org/abs/2108.07993) · [코드](https://github.com/HKUST-Aerial-Robotics/EPSILON) |
| Alpamayo 1 (Alpamayo-R1), 1.5 | 2025.10 | 자율주행 추론 VLA, 가중치 OpenMDW-1.1 | B.12.1 | [논문](https://arxiv.org/abs/2511.00088) · [코드](https://github.com/NVlabs/alpamayo) · [1.5](https://github.com/NVlabs/alpamayo1.5) · [모델](https://huggingface.co/nvidia/Alpamayo-1.5-10B) |
| Waymax | 2023.10 | JAX 가속 자율주행 시뮬(비상업) | B.12.1 | [논문](https://arxiv.org/abs/2310.08710) · [코드](https://github.com/waymo-research/waymax) |
| GPUDrive | 2024.08 · ICLR 2025 | 초당 100만 스텝 다중 에이전트 시뮬 | B.12.1 | [논문](https://arxiv.org/abs/2408.01584) · [코드](https://github.com/Emerge-Lab/gpudrive) |
| Bench2Drive | 2024.06 · NeurIPS 2024 D&B | CARLA 폐루프 E2E 벤치마크 | B.12.1 | [논문](https://arxiv.org/abs/2406.03877) · [코드](https://github.com/Thinklab-SJTU/Bench2Drive) |
| PythonRobotics | 2018.08 | 내비 알고리즘 교육용 코드 모음 | B.12.1, B.12.4 | [논문](https://arxiv.org/abs/1808.10703) · [코드](https://github.com/AtsushiSakai/PythonRobotics) |
| ArtPlanner | 2023.03 · Field Robotics 2023 | 도달 가능성 자세 검증 + 학습 이동 비용, DARPA SubT 우승 | B.12.2 | [논문](https://arxiv.org/abs/2303.01420) · [코드](https://github.com/leggedrobotics/art_planner) |
| GBPlanner | JFR 2020 | 공중·다리 로봇의 그래프 기반 지하 탐사 계획 | B.12.2 | [DOI](https://doi.org/10.1002/rob.21993) · [코드](https://github.com/ntnu-arl/gbplanner_ros) |
| FAR Planner | 2021.10 · IROS 2022 | 가시성 그래프 동적 갱신 경로 계획 | B.12.2, B.12.4 | [논문](https://arxiv.org/abs/2110.09460) · [코드](https://github.com/MichaelFYang/far_planner) |
| TARE | RSS 2021 | 계층형 탐사 계획 | B.12.2, B.12.4 | [DOI](https://doi.org/10.15607/RSS.2021.XVII.018) · [코드](https://github.com/caochao39/tare_planner) |
| CMU 탐사 개발 환경 | 2021.10 · ICRA 2022 | 지형 분석, 로컬 Planner, waypoint 추종 | B.12.2, B.12.4 | [논문](https://arxiv.org/abs/2110.14573) · [코드](https://github.com/HongbiaoZ/autonomous_exploration_development_environment) · [사이트](https://www.cmu-exploration.com/) |
| OCS2 | GitHub | 전환 시스템 최적 제어(SLQ, iLQR, SQP, IPM), ROS 2 가지 | B.12.2 | [코드](https://github.com/leggedrobotics/ocs2) |
| legged_control | GitHub | OCS2 기반 NMPC + WBC + 상태 추정(유지보수 종료) | B.12.2 | [코드](https://github.com/qiayuanl/legged_control) |
| TOWR | RA-L 2018 | 접촉 위상까지 최적화하는 다리 로봇 궤적 최적화 | B.12.2 | [DOI](https://doi.org/10.1109/LRA.2018.2798285) · [코드](https://github.com/ethz-adrl/towr) |
| CHAMP | GitHub | MIT Cheetah I 계층 제어기 + ROS 내비 | B.12.2 | [코드](https://github.com/chvmp/champ) |
| Walk These Ways | 2022.12 · CoRL 2022 | 여러 걸음새를 한 정책에 담은 보행 제어기 | B.12.2 | [논문](https://arxiv.org/abs/2212.03238) · [코드](https://github.com/Improbable-AI/walk-these-ways) |
| Robot Parkour Learning | 2023.09 · CoRL 2023 | 깊이 영상 한 정책의 파쿠르 기술 | B.12.2 | [논문](https://arxiv.org/abs/2309.05665) · [코드](https://github.com/ZiwenZhuang/parkour) |
| humanoid_navigation (footstep planner) | Humanoids 2012 | anytime 탐색 발자국 계획 | B.12.3 | [DOI](https://doi.org/10.1109/HUMANOIDS.2012.6651592) · [코드](https://github.com/ahornung/humanoid_navigation) |
| IHMC Open Robotics Software | GitHub | 평면 영역 A\* 발자국 계획 + 운동량 기반 전신 제어 | B.12.3 | [코드](https://github.com/ihmcrobotics/ihmc-open-robotics-software) |
| BaselineFootstepPlanner | GitHub (AIST) | 그래프 탐색 기준 발자국 계획 | B.12.3 | [코드](https://github.com/isri-aist/BaselineFootstepPlanner) · [문서](https://isri-aist.github.io/BaselineFootstepPlanner/) |
| HPP | IROS 2016 | 제약 있는 운동 계획(LAAS) | B.12.3 | [DOI](https://doi.org/10.1109/IROS.2016.7759083) · [코드](https://github.com/humanoid-path-planner/hpp-core) |
| Crocoddyl | 2019.09 · ICRA 2020 | 다접촉 최적 제어, FDDP | B.12.3 | [논문](https://arxiv.org/abs/1909.04947) · [코드](https://github.com/loco-3d/crocoddyl) |
| Pinocchio, TSID, Aligator | GitHub | 강체 동역학, 작업 공간 역동역학, 제약 궤적 최적화 | B.12.3 | [Pinocchio](https://github.com/stack-of-tasks/pinocchio) · [TSID](https://github.com/stack-of-tasks/tsid) · [Aligator](https://github.com/Simple-Robotics/aligator) |
| MuJoCo MPC | 2022.12 | iLQG, 경사 하강, Predictive Sampling 예측 제어 | B.12.3 | [논문](https://arxiv.org/abs/2212.00541) · [코드](https://github.com/google-deepmind/mujoco_mpc) |
| Drake | GitHub | 수리 계획과 다물체 동역학 | B.12.3 | [코드](https://github.com/RobotLocomotion/drake) |
| humanoid-gym, unitree_rl_gym, booster_gym | 2024.04(humanoid-gym) · GitHub | Isaac Gym RL 보행 + sim-to-sim 검증 | B.12.3 | [논문](https://arxiv.org/abs/2404.05695) · [humanoid-gym](https://github.com/roboterax/humanoid-gym) · [unitree_rl_gym](https://github.com/unitreerobotics/unitree_rl_gym) · [booster_gym](https://github.com/BoosterRobotics/booster_gym) |
| HOVER | 2024.10 · ICRA 2025 | 여러 명령 모드를 증류한 전신 제어 정책 | B.12.3 | [논문](https://arxiv.org/abs/2410.21229) · [코드](https://github.com/NVlabs/HOVER) |
| ASAP | 2025.02 · RSS 2025 | 실물 데이터 잔차 행동 모델로 sim-to-real 정렬 | B.12.3 | [논문](https://arxiv.org/abs/2502.01143) · [코드](https://github.com/LeCAR-Lab/ASAP) |
| Gallant | 2025.11 | LiDAR 복셀 격자 휴머노이드 보행·로컬 내비 | B.12.3 | [논문](https://arxiv.org/abs/2511.14625) · [코드](https://github.com/InternRobotics/Gallant) · [프로젝트](https://gallantloco.github.io/) |
| Click-and-Traverse | 2026.01 | HumanoidPF + RL 충돌 없는 실내 통과 | B.12.3 | [논문](https://arxiv.org/abs/2601.16035) · [코드](https://github.com/GalaxyGeneralRobotics/Click-and-Traverse) · [프로젝트](https://axian12138.github.io/CAT/) |
| HEAD | 2025.08 · CoRL 2025 | 사람 데이터로 배운 휴머노이드 내비·도달 | B.12.3 | [논문](https://arxiv.org/abs/2508.03068) · [코드](https://github.com/Stanford-TML/HEAD_release) |
| GR00T N1 | 2025.03 | 휴머노이드 기반 VLA(VLM + 확산 transformer) | B.12.3 | [논문](https://arxiv.org/abs/2503.14734) · [코드](https://github.com/NVIDIA/Isaac-GR00T) |
| ROS 1 navigation | ICRA 2010 | costmap + 전역·로컬 Planner(move_base) | B.12.4 | [DOI](https://doi.org/10.1109/ROBOT.2010.5509725) · [코드](https://github.com/ros-planning/navigation) |
| Move Base Flex | IROS 2018 | 유연한 ROS 내비 프레임워크 | B.12.4 | [DOI](https://doi.org/10.1109/IROS.2018.8593829) · [코드](https://github.com/naturerobots/move_base_flex) |
| BotBrain | 2026.01 · GitHub | RTAB-Map + Nav2(Smac 2D, MPPI) + twist_mux 우선순위 + 웹 UI, Go2·G1·Tita | B.12.4 | [코드](https://github.com/botbotrobotics/BotBrain) · [사이트](https://botbot.bot) |
| dddmr_navigation | GitHub (ROS 2 Humble) | 3D 점군 풀스택 14패키지. 지면 그래프 A\* 비용 = 거리 + 장애물 팽창 + 회전 + 경계 벌점. 높이 항이 없다 | B.12.4, S.1.5, S.9 | [코드](https://github.com/dfl-rlab/dddmr_navigation) |
| Regulated Pure Pursuit | 2023.05 | 곡률·장애물 근접도로 선속도를 줄이는 추종 | B.12.4 | [논문](https://arxiv.org/abs/2305.20026) |
| ros2_controllers | GitHub | 차동·메카넘·옴니휠·조향 제어기, 스워브 기구학 문서, 스워브 제어기 PR | B.12.4 | [코드](https://github.com/ros-controls/ros2_controllers) · [스워브 PR #1694](https://github.com/ros-controls/ros2_controllers/pull/1694) |
| ffw_swerve_drive_controller | GitHub (ROBOTIS AI Worker) | 스워브 모듈 IK, 조향 각속도 한계, 180° 반전. travplan 모듈 모델의 참고 | B.12.4, TP-0034 | [코드](https://github.com/ROBOTIS-GIT/ai_worker/tree/main/ffw_swerve_drive_controller) |
| OMPL | IEEE RAM 2012 | 샘플링 기반 운동 계획 라이브러리 | B.12.4 | [DOI](https://doi.org/10.1109/MRA.2012.2205651) · [코드](https://github.com/ompl/ompl) · [사이트](https://ompl.kavrakilab.org/) |
| SBPL | GitHub | 탐색 기반 계획 라이브러리(ARA\*, lattice) | B.12.4 | [코드](https://github.com/sbpl/sbpl) |
| PUTN | 2022.03 · IROS 2022 | 평면 맞춤 RRT\* + GPR + NMPC 험지 내비 | B.12.4 | [논문](https://arxiv.org/abs/2203.04541) · [코드](https://github.com/jianzhuozhuTHU/putn) |
| Choreo (TrajoptLib) | GitHub | 스워브 모듈 힘 한계 안의 최소 시간 궤적 최적화 | B.12.4 | [코드](https://github.com/SleipnirGroup/Choreo) · [문서](https://choreo.autos/) · [Sleipnir](https://github.com/SleipnirGroup/Sleipnir) |
| PathPlanner | GitHub | 전방향 로봇 Bézier 경로, AD\* 경로 탐색 | B.12.4 | [코드](https://github.com/mjansen4857/pathplanner) · [문서](https://pathplanner.dev/home.html) |
| TidyBot++ | 2024.12 · CoRL 2024 | powered caster 4개의 비동축 전방향 기저, CAD·부품표·코드 공개, 전방향 9/10 대 차동 4/10 | B.12.4, TP-0034 | [논문](https://arxiv.org/abs/2412.10447) · [코드](https://github.com/jimmyyhwu/tidybot2) |
| PCV (Holmberg·Khatib) | 2000.11 · IJRR | powered caster vehicle 기구학·동역학 정식화. 비동축 스워브 모델의 출처 | B.12.4, TP-0034 | [DOI](https://doi.org/10.1177/02783640022067977) · [PDF](https://robotics.stanford.edu/~rah/papers/ijrr-1162.pdf) |
| CrowdNav | 2018.09 · ICRA 2019 | 주의 기반 군중 회피 RL | B.12.4 | [논문](https://arxiv.org/abs/1809.08835) · [코드](https://github.com/vita-epfl/CrowdNav) |
| DRL-VO | 2023.01 · T-RO 2023 | 속도 장애물 보상 RL 군중 내비 | B.12.4 | [논문](https://arxiv.org/abs/2301.06512) · [코드](https://github.com/TempleRAIL/drl_vo_nav) |
| ORCA (RVO2) | ISRR 2009 | 상호 속도 장애물 기반 다중 에이전트 회피 | B.12.4, S.3 | [DOI](https://doi.org/10.1007/978-3-642-19457-3_1) · [코드](https://github.com/snape/RVO2) |
| Open-RMF | GitHub | 여러 로봇의 교통 관리와 작업 배정 | B.12.4 | [코드](https://github.com/open-rmf/rmf) · [사이트](https://www.open-rmf.org/) |

---

<!-- tab: Controller·안전 -->

### D.6 Controller — MPPI·학습 동역학 계열 (참고, 2026-09-25 개발 계획 제외)

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| Smooth MPPI (SMPPI) | 2021.12 · RA-L/IROS 2022 | 제어 변화율 공간 샘플링. `SmoothMPPIController`로 반영(TP-0021) | B.5, E | [논문](https://arxiv.org/abs/2112.09988) · [프로젝트](https://www.taekyung.me/research/smppi) |
| Terrain-Aware Kinodynamic Model + MPPI | 2023.05 · RA-L 2023 | 지형 조건 학습 6-DoF 모델을 MPPI rollout에 사용, 접촉 추정 | E | [논문](https://arxiv.org/abs/2305.00676) · [프로젝트](https://www.taekyung.me/research/off-road) |
| PENN (Physics Embedded NN Vehicle Model) | 2022.07 | 미분 가능 물리 + NN 차량 모델, 잠재 특징 = 타이어 힘 | E | [논문](https://arxiv.org/abs/2207.07920) |
| TOAST | 2022.01 · RA-L/IROS 2022 | MPC와 같은 NN 동역학으로 고속 추종 제어 | E | [논문](https://arxiv.org/abs/2201.08321) |
| HDVIO2.0 | 2025.04 · T-RO 2025 | 물리 + TCN 잔차 6-DoF 동역학을 VIO 최적화에 넣어 외력·바람 추정, 힘 라벨 불필요, Jetson TX2 180 Hz | E.3 | [논문](https://arxiv.org/abs/2504.00969) · [코드](https://github.com/uzh-rpg/hdvio2.0) |
| Continual Policy Learning via Variational Neural Dynamics | 2026.06 | 잠재 조건부 잔차 동역학 + 미분 가능 시뮬 정책 학습, 겪은 조건을 재생 버퍼로 기억 | E.4 | [논문](https://arxiv.org/abs/2606.27353) |
| 학습 MPC 개관 | 2020.05 · Annual Review | 학습 MPC를 세 갈래로 가름: 예측 모델 개선, MPC 파라미터화 추론, 제약 만족 덧붙이기 | E.5 | [논문](https://www.annualreviews.org/content/journals/10.1146/annurev-control-090419-075625) |
| Cautious MPC (GP) | 2017.05 · IEEE TCST | 이름 있는 모델 + GP 잔차, 상태 분포 전파, 확률 제약으로 제약을 조인다. RC 경주 실물 | E.5 | [논문](https://arxiv.org/abs/1705.10702) |
| 예측 제어 barrier 함수(PCBF) | 2021.05 | 항상 실행 가능한 소프트 제약 보조 문제로 예측 안전 필터의 실행 가능 집합을 안정화 | E.5, C.4 | [논문](https://arxiv.org/abs/2105.10241) |
| Bridging Active Exploration and Uncertainty-Aware Deployment | 2023.05 · RSS 2023 | 확률 앙상블 동역학, JRD 불일치로 능동 탐색 · 불확실성 회피 | E, TP-0022 E2 | [논문](https://arxiv.org/abs/2305.12240) · [프로젝트](https://www.taekyung.me/rss2023-bridging) |
| Guided Latent-Context Online Adaptation for Learned Vehicle Dynamics | RA-L 2026 | 학습 동역학의 잠재 문맥 온라인 적응(공개 arXiv 없음) | E | [Scholar](https://scholar.google.com/citations?user=olIJfeYAAAAJ&hl=ko) |
| ProxPI | 2026.09 | 학습 prior를 근접 비용항으로만 반영 | B.5 | [논문](https://arxiv.org/abs/2609.00941) |
| π-MPPI | 2025.04 | 샘플별 QP 투영으로 제어 도함수 한계 보장(QP 초기값만 학습) | B.5 | [논문](https://arxiv.org/abs/2504.10962) |
| Self-Supervised MPC Initialization | 2024.08 | MPC 초기해 자기지도 학습 | B.5 | [논문](https://arxiv.org/abs/2408.03394) |
| RA-MPPI | 2022.09 | CVaR 기반 위험 인지 MPPI | C.2, PRD R-F-006 | [논문](https://arxiv.org/abs/2209.12842) |
| DRA-MPPI | 2025.06 · IROS 2025 | 군중 속 몬테카를로 동적 위험 MPPI, RTX2080 97–115 ms | C.2, PRD R-F-006 | [논문](https://arxiv.org/abs/2506.21205) |
| zero-order GP-MPC | 2022.11 · European J. Control 2023 | 분산은 제약 조이기에 쓰고 Jacobian 기여만 떨어뜨려 GP-MPC 실시간화 | E.6 | [논문](https://arxiv.org/abs/2211.15522) |
| L4acados | 2024.11 · IEEE TCST | acados에 Python 학습 잔차 모델을 꽂는 틀, Jacobian 근사·병렬 sensitivity | E.6 | [논문](https://arxiv.org/abs/2411.19258) · [코드](https://github.com/IntelligentControlSystems/l4acados) |
| 문맥 베이즈 최적화 MPC 튜닝 | 2021.10 · IROS 2022 | 학습 동역학이 인코딩한 문맥으로 MPC 파라미터를 전이 튜닝, 1:28 경주차 3,000랩 | E.6 | [논문](https://arxiv.org/abs/2110.02710) · [코드](https://github.com/IntelligentControlSystems/bayesopt4ros) |
| ampyc | — | 강건·확률 MPC 교육용 Python 구현 모음 | E.6 | [코드](https://github.com/IntelligentControlSystems/ampyc) |
| 강건 비선형 MPC (외란 피드백) | 2025.09 · ICRA 2026 | 명목 모델 + 외란 피드백 + 모델 오차 상한을 SCP로 동시 최적화 (E.6에서 채택 안 함) | E.6 | [논문](https://arxiv.org/abs/2509.18760) · [코드](https://github.com/antoineleeman/robust-nonlinear-mpc) |
| 강건 비선형 최적제어 (SLS) | 2023.01 · IEEE TAC 2025 | system level synthesis로 명목 궤적과 피드백 이득을 함께 최적화 | E.6 | [논문](https://arxiv.org/abs/2301.04943) |
| 안전 탐색 학습 MPC | 2019.06 | GP 동역학 위에서 되돌아올 수 있는 영역만 탐색 (E.6에서 채택 안 함) | E.6 | [논문](https://arxiv.org/abs/1906.12189) |
| 경로를 품은 내비게이션 MPC | 2025.09 | Dijkstra 경로 구간을 MPC 결정 변수로, 재귀 실행 가능성·충돌 회피 보장, 1:28 차량 (ETH IDSC) | E.7 | [논문](https://arxiv.org/abs/2509.15917) · [코드](https://github.com/IntelligentControlSystems/ClutteredEnvironment) |
| COAT-MPC | 2025.03 · IEEE RA-L 2025 | 성능 문턱 제약을 지키는 베이즈 최적화 MPC 튜너 (ETH IDSC) | E.7 | [논문](https://arxiv.org/abs/2503.07127) |
| 경주용 예측 안전 필터 | 2021.02 · IEEE RA-L 2021 | 학습 경주 제어기 뒤의 예측 안전 필터 실물 검증 (ETH IDSC) | E.7, C.4 | [논문](https://arxiv.org/abs/2102.11907) |
| Chronos·CRS | 2022.09 · ICRA 2023 | 1:28 차량과 식별·추정·제어·다중 에이전트 소프트웨어 틀 (ETH IDSC) | E.7 | [논문](https://arxiv.org/abs/2209.12048) · [코드](https://github.com/IntelligentControlSystems/crs) |
| DTC (Deep Tracking Control) | 2023.09 · Science Robotics 2024 | 궤적 최적화가 낸 발 궤적을 RL 정책이 추종 (ETH RSL) | B.14 | [논문](https://arxiv.org/abs/2309.15462) |
| GP-MPC 서베이 | 2025.02 | GP 동역학 학습의 남은 과제 셋: 확장성·근사·온라인 갱신 | E.9 | [논문](https://arxiv.org/abs/2502.02310) |
| Titsias 변분 유도점 (VFE) | 2009 · AISTATS | 유도 입력을 변분 파라미터로 두고 KL 하한을 올린다. 보수적으로 틀린다 | E.8 | [논문](https://proceedings.mlr.press/v5/titsias09a.html) |
| 희소 GP 근사의 이해 | 2016.06 | FITC는 잡음을 과소평가해 과신, VFE는 보수. 실험 비교 | E.8 | [논문](https://arxiv.org/abs/1606.04820) |
| Streaming Sparse GP | 2017.05 · NeurIPS | 스트리밍에서 하이퍼파라미터까지 변분으로 갱신, Csató·Opper를 특수 경우로 | E.8 | [논문](https://arxiv.org/abs/1705.07131) |
| Data-Driven MPC for Quadrotors | 2021.02 · RA-L | 공력 잔차 GP를 NMPC에, **유도점 20개**로 추종 오차 70% 감소 | E.8 | [논문](https://arxiv.org/abs/2102.05773) · [코드](https://github.com/uzh-rpg/data_driven_mpc) |
| LB-NMPC (Ostafew 외) | 2016 · JFR | 사전 차량 모델 + GP 외란, 실외 지상 로봇 3종 50–600 kg, 3 km | E.9 | [논문](https://onlinelibrary.wiley.com/doi/abs/10.1002/rob.21587) |
| Learn Fast, Forget Slow | 2018.10 · RA-L 2019 | 900 kg 지상 로봇 3 km에서 **wBLR이 GPR보다 정확**, Tube MPC와 결합 | E.9 | [논문](https://arxiv.org/abs/1810.06681) |
| 스키드 스티어 확률 운동 모델 | 2024.02 · ICRA 2024 | 타이어-지면 상호작용을 GPR로, 미지 지형 일반화 | E.9 | [논문](https://arxiv.org/abs/2402.18065) |
| GP + chance-constrained MPPI | 2024.11 · ICRA 2025 | GP 잔차를 더한 유니사이클에 확률 제약을 세워 **MPPI로** 푼다, 스키드 스티어 실물 | E.10 | [논문](https://arxiv.org/abs/2411.03289) |
| elevation_mapping_cupy | 2022.04 · IROS 2022 | GPU 고도 지도 + 학습 기반 traversability 필터, DARPA SubT ANYmal 4대 | A.7.2 | [논문](https://arxiv.org/abs/2204.12876) · [코드](https://github.com/leggedrobotics/elevation_mapping_cupy) |
| Nav2 환경 표현 재설계 이슈 | 2019.10 · 열림 | 2D costmap이 2.5D에 묶는다는 메인테이너의 문제 제기, gradient map 제안 | 개요 | [이슈 #1278](https://github.com/ros-navigation/navigation2/issues/1278) |
| Nav2 실외 한계(농업) | 2024.07 | 통과 가능한 키 큰 풀이 장애물로 찍혀 경로가 길어지거나 중단 | 개요 | [논문](https://arxiv.org/abs/2407.18535) |
| 행성 탐사차 국소 슬립 예측 | 2017 · ICRA | 지형 종류별 기하→슬립 GP, 국소 적응이 고슬립 구간에서 가장 큼 | E.10 | [논문](https://ieeexplore.ieee.org/document/7989646/) |
| 통과성 예측 확률 융합 경로계획 | 2023.03 | 예측한 통과성을 확률적으로 융합해 위험 인지 경로로 | E.10 | [논문](https://arxiv.org/abs/2303.01169) |
| GP 대규모 지형 모델링 | 2009 · JFR | GP를 지형 모델로: 다중 해상도, 불확실성, 관측 결손 대응 | E.10 | [논문](https://robotics.caltech.edu/wiki/images/8/8e/GPModelingTerrain.pdf) |
| Neural Process 고도 모델링 | 2025.08 | 위 계보의 최신판, off-road 고도장과 불확실성 | E.10 | [논문](https://arxiv.org/abs/2508.03890) |
| 통과성 추정 서베이 | 2022.04 | 모바일 로봇 통과성 추정 전반 | E.10, A.7 | [논문](https://arxiv.org/abs/2204.10883) |
| 보도 배달로봇 강건 경로계획 | 2025.07 | 주행 시간 불확실성 집합으로 경로 선택(동역학 아님) | E.10 | [논문](https://arxiv.org/abs/2507.12067) |

### D.7 동적 장애물 안전 필터

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| Adaptive CVaR Barrier Functions | 2025.04 · IROS 2025 | CVaR + 동적 zone CBF, CasADi(오픈소스). TP-0014 1순위 | C.2 | [논문](https://arxiv.org/abs/2504.06513) · [코드](https://github.com/Lawliet9666/Adaptive-CVaR-Barrier-Function) |
| CVaR-BF + RL | 2026.05 | 미분 가능 CVaR-BF로 위험 수준 학습 | C | [논문](https://arxiv.org/abs/2605.21257) |
| OcclusionCBF | — | 가려진 영역 reachable occupancy 인증, Gurobi 필요(보류) | C.2 | [프로젝트](https://www.taekyung.me/occlusion-cbf) · [코드](https://github.com/tkkim-robot/occlusion-cbf) |
| Predictive Semantic Safety | 2026 | VLM 물리 사건 예측 → conformal 미래 점유 → 백업 보존 QP 안전 필터 | E | [프로젝트](https://www.taekyung.me/3e218d5c-31e3-8088-ac70-fee275314177) |

### D.7b Controller·안전 — 마일스톤과 공개 코드

E.1(MPPI 계보), E.2(학습 동역학·적응 마일스톤), C.4(안전 필터 계보)에서 다룬 연구다.

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| ABS (Agile But Safe) | 2024.01 · RSS 2024 | 빠른 정책 + 정책 조건 도달-회피 가치 감시 + 회복 정책, Go1 3 m/s 이상 | B.9, C.4 | [논문](https://arxiv.org/abs/2401.17583) · [코드](https://github.com/LeCAR-Lab/ABS) · [프로젝트](https://agile-but-safe.github.io) |
| Poisson Safety Functions | 2025.05 | 점유 지도에서 Poisson 방정식으로 CBF 안전 함수, GPU SOR 0.2–0.3 ms, Go2·G1 | C.4 | [논문](https://arxiv.org/abs/2505.06794) · [영상](https://youtu.be/fBRdkAJGixI) |
| Geometry-Aware Predictive Safety Filters | 2025.08 · Humanoids 2025 | Poisson 안전 함수 + Minkowski 로봇 모양 + CBF MPC 100 Hz, G1·Go2 | C.4 | [논문](https://arxiv.org/abs/2508.11129) |
| Risk-Aware Poisson Safety + Laplace Guidance | 2025.10 | 장애물별 위험도를 Laplace 안내장의 경계 유출량으로 | C.4 | [논문](https://arxiv.org/abs/2510.25913) |
| MPPI | 2015.09 | 일반화된 중요도 샘플링의 GPU 병렬 경로 적분 MPC | E.1 | [논문](https://arxiv.org/abs/1509.01149) |
| 정보이론적 MPC | 2017.07 · T-RO 2018 | KL 기반 유도로 일반 비선형 동역학에 확장, AutoRally | E.1 | [논문](https://arxiv.org/abs/1707.02342) |
| Robust MPPI | 2021.02 · RA-L 2021 | 명목·실제 증강 상태, 명목 상태 선택, 자유 에너지 상한 | E.1 | [논문](https://arxiv.org/abs/2102.09027) |
| log-MPPI | 2022.03 · RA-L 2022 | 정규·로그정규 곱 분포 샘플링, occupancy 격자 비용 | E.1 | [논문](https://arxiv.org/abs/2203.16599) |
| MPPI-Generic | 2024.09 | MPPI, Tube-MPPI, Robust MPPI의 C++/CUDA 라이브러리 | E.1 | [논문](https://arxiv.org/abs/2409.07563) · [코드](https://github.com/ACDSLab/MPPI-Generic) |
| pytorch_mppi | GitHub | 근사 동역학을 쓰는 PyTorch MPPI | E.1 | [코드](https://github.com/UM-ARM-Lab/pytorch_mppi) |
| PETS | 2018.05 · NeurIPS 2018 | 확률 앙상블 동역학 + 궤적 샘플링 계획 | E.2 | [논문](https://arxiv.org/abs/1805.12114) |
| IKD | 2021.02 · RA-L 2021 | IMU를 넣은 역운동 모델로 고속 오프로드 추종 | E.2 | [논문](https://arxiv.org/abs/2102.12667) |
| RMA | 2021.07 · RSS 2021 | 환경 요인의 잠재 벡터를 이력에서 추정하는 온라인 적응 | E.2 | [논문](https://arxiv.org/abs/2107.04034) |
| TD-MPC2 | 2023.10 · ICLR 2024 | 디코더 없는 잠재 world model 안의 MPPI 계획 | E.2 | [논문](https://arxiv.org/abs/2310.16828) · [코드](https://github.com/nicklashansen/tdmpc2) |
| CBF-QP | 2016.09 · IEEE TAC 2017 | CBF와 CLF를 한 QP로 | C.4 | [논문](https://arxiv.org/abs/1609.06408) |
| CBF 이론과 응용 | 2019.03 · ECC 2019 | CBF 튜토리얼 | C.4 | [논문](https://arxiv.org/abs/1903.11199) |
| HJ 도달 가능성 개관 | 2017.09 · CDC 2017 | 가치 함수 기반 안전 집합 계산과 도구 | C.4 | [논문](https://arxiv.org/abs/1709.07523) · [코드(JAX)](https://github.com/StanfordASL/hj_reachability) |
| 예측 안전 필터 | 2018.12 | 학습 제어기 명령을 MPC로 검사하고 최소로 수정 | C.4 | [논문](https://arxiv.org/abs/1812.05506) |
| 이산 시간 CBF + MPC | 2020.07 · ACC 2021 | MPC 안의 이산 CBF 제약 | C.4 | [논문](https://arxiv.org/abs/2007.11718) · [코드](https://github.com/HybridRobotics/NMPC-DCLF-DCBF) |
| safe-control-gym | 2021.09 | 제어·RL 안전 방법 비교 벤치마크 | C.4 | [논문](https://arxiv.org/abs/2109.06325) · [코드](https://github.com/utiasDSL/safe-control-gym) |
| 안전 필터 통합 관점 | 2023.09 · Annual Review | 가치 함수, CBF, 예측 필터를 감시 + 개입 구조로 통합 | C.4 | [논문](https://arxiv.org/abs/2309.05837) |
| safe_control | GitHub | 단일·다중 로봇 CBF-QP, MPC-CBF 구현 모음 | C.4 | [코드](https://github.com/tkkim-robot/safe_control) |

---

<!-- tab: 연구 그룹 -->

### D.13 연구 그룹과 사람 — 누구를 따라갈 것인가

==**소속과 활동 상태는 2026-09-30에 1차 출처(연구실 페이지·대학 인명부·출판사 제출 소속·`gh api`)로 확인했다.**==
사람은 옮겨 다니므로 기억으로 쓰지 않았고, 확인하지 못한 것은 그렇게 적었다.

<details markdown="1">
<summary>⚠️ 먼저: 흔히 잘못 알려진 소속 10건 (전부 1차 출처로 확인)</summary>

조사 과정에서 **제가 브리프에 적어 준 가정 중 열넷이 틀렸다.** 널리 퍼진 오류라 남겨 둔다.

| 흔한 오해 | 확인된 사실 |
|---|---|
| Trautman이 Honeywell | ==**Honda Research Institute (USA)**== — 출판사 제출 소속 3건으로 확인(IJRR 2024, T-RO 2025, ACM THRI 2025) |
| Kottege가 CSIRO 로보틱스 그룹장 | 2021–2022에 그랬고 **현재는 Cyber-Physical Systems 연구 디렉터**. 현 그룹장은 **David Howard**와 **Chris McCool** |
| Knepper가 Cornell 교수 | ==**학계를 떠났다.**== Cornell 2014–2020 → Amazon → **Outrider Technologies 계획·제어 디렉터(2023–)**. 공저자로만 인용한다 |
| Zeilinger가 ETH IfA | **IDSC / D-MAVT**의 Intelligent Control Systems. IfA는 다른 학과(D-ITET)다 |
| Borrelli 연구실이 `msc.berkeley.edu` | 그건 **Tomizuka**의 연구실이다. Borrelli는 `mpc.berkeley.edu` |
| Mavrogiannis GitHub이 `mavrogiannis` | 그건 **다른 사람**(Giorgos, U. Crete). Christoforos는 `cmavrogiannis` + 조직 `fluentrobotics` |
| Manocha의 군중 내비 코드가 `GAMMA-UMD` | 그 조직은 **음향**이 11개 중 10개다. 군중 내비 코드는 흩어져 있거나 없다 |
| Alonso-Mora가 부교수 | **정교수**(Prof.dr.), TU Delft Cognitive Robotics |
| Oleynikova가 NVIDIA | GitHub 소속이 **`@exclaim-robotics`**로 바뀌었다 |
| Peter Stone이 SocialGym 2.0 공저자 | ==**저자가 아니다**==(arXiv·AAAI 양쪽 모두) |
| supereight가 `smartroboticslab` | 저장소는 **`ethz-mrl/supereight2`**다 |
| Martelaro가 CMU Design | **HCII**(School of Computer Science). 사이트는 `nikmartelaro.com`(`nikolasmartelaro.com`은 죽었다) |
| Miki·Frey가 현 RSL 소속 | 현재 RSL 인명부(60명)에 **없다** |
| Caballero가 세비야 대학 | **Pablo de Olavide University**(IEEE 제출 소속 2건) |

</details>

#### D.13.1 지형 지도·traversability (→ A.2b, A.10)

| 그룹 | PI·기관 | 코드 | travplan에 왜 |
|---|---|---|---|
| **RSL** ([rsl.ethz.ch](https://rsl.ethz.ch/)) | **Marco Hutter**, ETH Zürich | [leggedrobotics](https://github.com/leggedrobotics) 309개. `elevation_mapping_cupy` ★1111 · `wild_visual_navigation` ★318 · 전신 `ANYbotics/grid_map` ★3249 | ==`TravMap[8]`은 사실상 `grid_map` + emap의 층 구성이고 `SIGMA`는 그들의 칸별 분산이다.== ⚠️ 연구실은 활발하지만 **우리가 의존하는 두 저장소는 느려졌다**(emap `main` 2025-05 정지, `traversability_estimation` 2023-06 정지) |
| **Dynamic Robot Systems** ([dynamic.robots.ox.ac.uk](https://dynamic.robots.ox.ac.uk/)) | **Maurice Fallon**, Oxford Robotics Institute | WVN 코드는 `leggedrobotics`에 있다 — **ETH·Oxford 공동 라인이라 둘 다 인용한다** | ==비용 층을 손으로 튜닝하는 대신 **로봇 자신의 주행에서 온라인 자기지도**로 배우는 기준 설계.== 보도는 낙엽·젖은 타일·도색 횡단보도로 계속 바뀐다 |
| **CSIRO Robotics** ([research.csiro.au/robotics](https://research.csiro.au/robotics/)) | 그룹장 **David Howard**·**Chris McCool** | [csiro-robotics](https://github.com/csiro-robotics) 80개, 2026-09-30에도 푸시. `ohm` ★193(**BSD-3**) · `raycloudtools` ★118 | ==**TP-0031/0044/0047이 겪은 문제를 정면으로 다룬 유일한 문헌**== — virtual surfaces(arXiv 2010.16018). **우리 그림자 상한의 선행 연구다.** ⚠️ `ohm` 코드는 `main` 2023-02 정지(그룹은 활발) |
| **ISR Lab** ([isr.korea.ac.kr](https://isr.korea.ac.kr/)) | **정우진(Woojin Chung)**, 고려대 기계공학부 | 연구실 조직 없음 — [Ikhyeon-Cho](https://github.com/Ikhyeon-Cho) 개인 계정. `FastDEM` ★178(**2026-09-04, 이 목록에서 가장 최신**) · `LeSTA` ★118 · `awesome-traversability-analysis` ★167 | ==**세계에서 우리 저장소 전제와 가장 가까운 곳이다.**== FastDEM은 CPU만으로 Orin 100+ Hz, ODS-Bot은 **실제 한국 실외 배달로봇 내비 스택**이고 그 `dwa_planner`·`dijkstra_planner`가 우리 `GuidancePlanner`의 대응물이다. LeSTA는 짧은 수동 주행으로 라벨 없이 traversability를 배운다 |
| **AirLab** ([theairlab.org](https://theairlab.org/)) + Field AI | **Sebastian Scherer**(Research Professor), CMU RI | [castacks](https://github.com/castacks) 219개. `tartanair_tools` ★434 · `tartan_drive` ★126. ⚠️ Field AI는 **공개 코드가 사실상 없다** | ==**STEP**이 "traversability를 분포로 보고 그 위험(CVaR)에 대해 계획한다"의 정본==이고, 그게 우리 `SIGMA` → MPPI 확률 제약(E.10)·NMPC 튜브(TP-0070/0071)의 설계 근거다 |
| **Unmanned Systems Lab** ([unmannedlab.org](https://www.unmannedlab.org/)) | **Srikanth Saripalli**, Texas A&M | [unmannedlab](https://github.com/unmannedlab) — `RELLIS-3D` ★458 · `G-VOM` ★89 | G-VOM은 LiDAR → 지상차량 traversability 격자의 **읽기 쉬운 참조 구현**. ⚠️ 코드는 2023-05 정지 |

#### D.13.2 동적 장애물·소셜 내비게이션 (→ A.12, A.12.5)

| 그룹 | PI·기관 | 코드 | travplan에 왜 |
|---|---|---|---|
| ==**AMR Lab**== ([autonomousrobots.nl](https://autonomousrobots.nl/)) | **Javier Alonso-Mora**(정교수), TU Delft | [tud-amr](https://github.com/tud-amr) — `mpc_planner` ★405 · `mppi-isaac` ★361 · ==`guidance_planner` ★85== | ==**컨트롤러 트랙에 가장 직접적으로 유용한 그룹.**== MPC와 MPPI를 **같은 인터페이스 뒤에** 두고 거기에 **위상 인지 guidance planner**를 붙였다 — 문자 그대로 우리 `GuidancePlanner` → MPPI/NMPC 구조가 이미 발표·벤치마크돼 있다. ⚠️ 이름 충돌 주의: 그들의 `guidance_planner`와 우리 `planners/guidance.py`가 같은 문제를 푼다 |
| **Service Robotics Lab** ([robotics.upo.es](https://robotics.upo.es/)) | **Luis Merino**(정교수)·Fernando Caballero, **Pablo de Olavide University** | [robotics-upo](https://github.com/robotics-upo) 166개 — **이 분야에서 가장 활발**(2026-09 다회 푸시). `hunav_sim` ★166 · `lightsfm` ★80 · `social_force_window_planner` ★58 | ==HuNavSim이 우리의 임시 `--pedestrians 3`를 대체할 기성품==이고 **TP-0036(반응형 보행자)에 직결**된다. ROS 2라 P1 목표와 맞는다. `lightsfm`은 `CostTerm`에 SFM 항을 넣을 때 들어낼 조각이다 |
| **ACL** ([acl.mit.edu](https://acl.mit.edu/)) | **Jonathan How**, MIT AeroAstro | [mit-acl](https://github.com/mit-acl) — ==`mppi_numba` ★317== · `cadrl_ros` ★725 · `gym-collision-avoidance` ★324 | ==`mppi_numba`가 **확률적 traversability 모델을 3D 텐서로 두고 CVaR로 MPPI를 굴린다**== — E.10의 가장 직접적인 선행 구현이 파이썬으로 이미 쓰여 있다. ⚠️ 둘 다 정지(2024-08, 2021-12) |
| **Pete Trautman** | **Honda Research Institute (USA)** — 연구실 없음 | [trautman](https://github.com/trautman) 8개, **전부 0★** | ==A.12.5가 다루는 문제를 이름 붙이고 틀을 세운 사람.== 2024년 IJRR(BRNE)에서 **Northwestern의 Todd Murphey와** 그 라인을 잇고 있다. ⚠️ "현재도 그곳"은 2025-02 논문 기준이고 그 이후는 미확인 |
| **Fluent Robotics** ([fluentrobotics.com](https://fluentrobotics.com/)) | **Christoforos Mavrogiannis**(조교수), U. Michigan | [fluentrobotics](https://github.com/fluentrobotics) 39개 — ★는 최대 10. ==논문으로 판단할 것== | 소셜 내비 서베이가 A.12.5 어휘의 기준이고, ==*Characterizing the Complexity of Social Robot Navigation Scenarios*가 **우리 12개 시나리오가 실제로 어려운지** 판정하는 방법==이다(지금 12/12·39–40/40으로 포화). `Legible_MPPI`는 `CostTerm`에 바로 들어간다 |
| **ADCS / HCII** ([nikmartelaro.com](http://nikmartelaro.com/)) | **Nikolas Martelaro**(부교수), CMU **HCII** | GitHub **없음**(확인 못 함) | ==목록에서 **실제 보도 배달로봇과 실제 보행자의 만남을 현장 관찰하는 유일한 그룹**.== A.12.5의 "얼어붙기가 보도에서 관찰됐다"가 이 그룹의 피츠버그 연구다 |
| **AMRL** ([amrl.cs.utexas.edu](https://amrl.cs.utexas.edu/)) | **Joydeep Biswas**(부교수), UT Austin | [ut-amrl](https://github.com/ut-amrl) 222개 — `SocialGym2` ★63 · `graph_navigation` ★14 | 소셜 내비 벤치마크. ⚠️ **LARG(Peter Stone)는 별도 연구실**이고 SocialGym 2.0의 **저자가 아니다** |

#### D.13.3 제어·최적화, 그리고 한국 그룹 (→ C·E, F)

| 그룹 | PI·기관 | travplan에 왜 |
|---|---|---|
| **ACDS**, Georgia Tech | **Evangelos Theodorou** | MPPI의 원전(ICRA 2016) — `control/mppi/`의 뿌리 |
| **Intelligent Control Systems**, **IDSC / D-MAVT** ETH | **Melanie Zeilinger** | `l4acados`·`ampyc` — GP 잔차와 튜브 MPC를 acados에 얹는 라인(TP-0070/0071, E.10) |
| **syscop**, Freiburg | **Moritz Diehl** | ==acados 자체.== 우리 MPC 트랙 전체가 이 위에 선다 |
| **Hybrid Robotics**, UC Berkeley | **Koushil Sreenath** | CBF ↔ MPC 다리(ACC 2021). ⚠️ `HybridRobotics/MPC-CBF`는 **아카이브됨** |
| **AMBER Lab**, Caltech | **Aaron Ames** | CBF 이론의 정본. A.12.5의 Lipschitz 연속성 정리 |
| **Urban Robotics Lab**, KAIST | **명현(Hyun Myung)** | DreamWaQ 계열(F.4)과 TRIP(A.2b.7 ⑨) — ==보행자·지형 양쪽에서 travplan과 겹치는 국내 그룹== |
| **RaiLab**, KAIST | **황보제민(Jemin Hwangbo)** | 4족 RL의 국내 축. 학습 forward 모델 + 샘플링 MPC(RSS 2022), 전체 로봇 모델 물리 롤아웃(Sci. Robot. 2025) — MPC 문서 M.1.3. ⚠️ 정확한 직함 미확인 |

==**따라갈 곳을 셋만 고른다면**== — 지형은 **고려대 ISR**(FastDEM, 우리 전제와 가장 가깝고 가장 최신),
컨트롤러는 **TU Delft AMR**(guidance + MPC/MPPI 구조가 우리와 같다), 보행자는 **UPO**(HuNavSim이
TP-0036에 바로 들어간다)다.

---

## S.8 참고문헌

### 물리 엔진

| 이름 | 연도 | 한 줄 요약 | 절 | 링크 |
|---|---|---|---|---|
| Isaac Sim | 2026.09(6.1) | USD·PhysX·RTX 로봇 시뮬레이터, ROS 2 브릿지 | S.1.1 | [GitHub](https://github.com/isaac-sim/IsaacSim) |
| Isaac Lab | 2025.11 | Isaac Sim 위 GPU 병렬 학습 프레임워크, 3.0은 다중 백엔드 | S.1.1 | [arXiv:2511.04831](https://arxiv.org/abs/2511.04831), [GitHub](https://github.com/isaac-sim/IsaacLab) |
| Newton | 2026(1.x) | Warp 기반 GPU 물리, MuJoCo Warp·MPM·VBD, Linux Foundation | S.1.2 | [GitHub](https://github.com/newton-physics/newton) |
| MuJoCo Playground | 2025.02 | MJX 기반 학습 프레임워크, zero-shot sim-to-real | S.1.3 | [arXiv:2502.08844](https://arxiv.org/abs/2502.08844) |
| MuJoCo Warp | 2026.09(3.14) | MuJoCo의 GPU판 | S.1.3 | [GitHub](https://github.com/google-deepmind/mujoco_warp) |
| Genesis | 2026.09(1.4.2) | 범용 시뮬레이터, 속도 주장 재검증 논란 | S.1.4 | [GitHub](https://github.com/Genesis-Embodied-AI/genesis-world), [issue #181](https://github.com/Genesis-Embodied-AI/genesis-world/issues/181) |
| Gazebo Harmonic·Jetty | 2023.09·2025.09 | ROS 2 표준 CPU 시뮬레이터 | S.1.5 | [gazebosim.org](https://gazebosim.org/docs/latest/releases/) |
| Project Chrono | 2026.04(10.0) | 다물체·차량·변형 지면(SCM, DEM, SPH) | S.1.6, S.5.4 | [GitHub](https://github.com/projectchrono/chrono), [지형 모델](https://api.projectchrono.org/vehicle_terrain.html) |
| CARLA | 2024.12(0.10) | UE5 자동차 시뮬레이터, 보행자·NuRec | S.1.7 | [GitHub](https://github.com/carla-simulator/carla) |

### 보도·도시·보행자

| 이름 | 연도 | 한 줄 요약 | 절 | 링크 |
|---|---|---|---|---|
| MetaUrban | 2024.07 | 보도 기능 구역 기반 절차 생성 시뮬레이터 | S.2.1 | [arXiv:2407.08725](https://arxiv.org/abs/2407.08725) |
| URBAN-SIM | 2025.05 | Isaac Sim 보도 학습 플랫폼, WFC 지형, GPU ORCA | S.2.2 | [arXiv:2505.00690](https://arxiv.org/abs/2505.00690), [GitHub](https://github.com/metadriverse/urban-sim) |
| UrbanVerse | 2025.10 | 도시 영상에서 Isaac Sim 장면, 10만 에셋 | S.2.3 | [arXiv:2510.15018](https://arxiv.org/abs/2510.15018) |
| Vid2Sim | 2025.01 | 영상에서 3DGS + 메시 혼합 장면 | S.2.4 | [arXiv:2501.06693](https://arxiv.org/abs/2501.06693) |
| SidewalkBench | 2026.06 | 보도 시각 내비 벤치마크, 사건 기반 보행자 | S.2.5 | [arXiv:2606.16953](https://arxiv.org/abs/2606.16953), [프로젝트](https://vail.cs.ucla.edu/SidewalkBench/) |
| FlowPilot | 2026 | anchored flow matching 보도 내비 정책, 사람 선호 정렬 | S.2.5 | [프로젝트](https://vail.cs.ucla.edu/FlowPilot/), [arXiv:2606.12603](https://arxiv.org/abs/2606.12603) |
| AURA | 2026 | 공유 자율 보도 내비, 가상 인계 시험 | S.2 | [arXiv:2604.01659](https://arxiv.org/abs/2604.01659) |
| CostNav | 2025.11 | 손익으로 채점하는 배달로봇 벤치마크 | S.2.6 | [arXiv:2511.20216](https://arxiv.org/abs/2511.20216) |
| SimWorld-Robotics | 2025.12 | UE5 절차 생성 도시, 언어 내비·협업 | S.2.7 | [arXiv:2512.10046](https://arxiv.org/abs/2512.10046) |
| NavVerse | 2026.07 | 실내에서 실외로 이어지는 내비 벤치마크 | S.2.7 | [arXiv:2607.19695](https://arxiv.org/abs/2607.19695) |
| HuNavSim | 2023.05 | Social Force 기반 ROS 2 보행자 시뮬레이터 | S.3.1 | [arXiv:2305.01303](https://arxiv.org/abs/2305.01303) |
| Arena 4.0 | 2024.09 | ROS 2 사회적 내비 플랫폼, 생성형 세계 | S.3.5 | [arXiv:2409.12471](https://arxiv.org/abs/2409.12471) |
| NavIsaacLab | 2026.06 | 궤적 diffusion + 동작 모방 보행자, Isaac Lab | S.3.4 | [arXiv:2606.26265](https://arxiv.org/abs/2606.26265) |
| SONG | 2026.07 | 3DGS 사회적 내비 플랫폼, 언어 모델 보행자 | S.3.4 | [arXiv:2607.25219](https://arxiv.org/abs/2607.25219) |

### 센서·렌더링·world model

| 이름 | 연도 | 한 줄 요약 | 절 | 링크 |
|---|---|---|---|---|
| Isaac Sim RTX LiDAR | 2026 | GPU 광선 추적 LiDAR, 제품 프로파일 | S.4.1 | [문서](https://docs.isaacsim.omniverse.nvidia.com/latest/sensors/isaacsim_sensors_rtx_lidar.html) |
| Omniverse NuRec | 2025 | 3DGUT 복원을 USD로, Isaac Sim·CARLA 연동 | S.4.2 | [소개](https://developer.nvidia.com/omniverse/nurec) |
| GaussGym | 2025.10 | 3DGS 렌더러를 넣은 병렬 물리 시뮬 | S.4.2 | [arXiv:2510.15352](https://arxiv.org/abs/2510.15352) |
| GS-Playground | 2026.04 | 병렬 물리 + 배치 3DGS, RSS 2026 | S.4.2 | [arXiv:2604.25459](https://arxiv.org/abs/2604.25459) |
| Image2Sim | 2026.07 | RGB-D 영상에서 신경 시뮬 장면 2만 개 | S.4.2 | [arXiv:2607.05765](https://arxiv.org/abs/2607.05765) |
| Navigation World Models | 2024.12 | 행동 조건 영상 생성으로 궤적 계획·순위 | S.4.3 | [arXiv:2412.03572](https://arxiv.org/abs/2412.03572) |
| Cosmos | 2025.01 | 공개 가중치 world foundation model | S.4.3 | [arXiv:2501.03575](https://arxiv.org/abs/2501.03575) |
| Cosmos-Transfer1 | 2025.03 | 다중 공간 조건 생성, sim-to-real 증강 | S.4.3 | [arXiv:2503.14492](https://arxiv.org/abs/2503.14492) |
| X-Mobility | 2024.10 | Isaac Sim 합성 데이터 world model 내비 | S.4.3, B.12.4 | [arXiv:2410.17491](https://arxiv.org/abs/2410.17491) · [코드](https://github.com/NVlabs/X-MOBILITY) |
| COMPASS | 2025.02 | 잔차 강화학습 교차 몸체 이동 정책 | S.4.3, S.5.2, B.12.4 | [arXiv:2502.16372](https://arxiv.org/abs/2502.16372) · [코드](https://github.com/NVlabs/COMPASS) |

### 로봇 리그 (S.9)

| 이름 | 종류 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| AntBot | ROS 2 스택 + Ignition Gazebo | ROBOTIS AI 4륜 독립 스워브 배달로봇. 조향 ±56.2°, 비동축 오프셋 55.5 mm, 시뮬 센서는 2D LiDAR·IMU뿐 | S.9.1, B.12.4 | [코드](https://github.com/ROBOTIS-move/antbot) · [문서](https://robotis-move.github.io/antbot/en/) |
| CMU 탐사 개발 환경 | 차량 시뮬 + 환경 5종 | `/registered_scan` 5 Hz, `/state_estimation` 200 Hz, 평탄도 기반 `/terrain_map` | S.9.2, B.12.2, B.12.4 | [코드](https://github.com/HongbiaoZ/autonomous_exploration_development_environment) · [사이트](https://www.cmu-exploration.com/) |
| dfl_mobilerobot_simulator | Gazebo Classic 리그 | dddmr용 Go2·Zinger(4WS)·Saye(Ackermann). Go2는 Velodyne VLP 점군 | S.9.3, B.12.4 | [코드](https://github.com/dfl-rlab/dfl_mobilerobot_simulator) |
| Clearpath simulator | Gazebo(gz) 리그 | Husky·Jackal·Warthog·Ridgeback을 YAML로 구성, 야외 지형 세계 | S.9.3 | [코드](https://github.com/clearpathrobotics/clearpath_simulator) |
| TurtleBot4 simulator | Gazebo(gz) 리그 | 2D LiDAR + OAK-D. 배관 확인용 최소 기준선 | S.9.3 | [코드](https://github.com/turtlebot/turtlebot4_simulator) |

### 지형·바퀴·sim-to-real

| 이름 | 연도 | 한 줄 요약 | 절 | 링크 |
|---|---|---|---|---|
| Learning to Walk in Minutes | 2021.09 | 게임식 지형 커리큘럼, 병렬 강화학습 | S.5.1, B.12.2 | [arXiv:2109.11978](https://arxiv.org/abs/2109.11978) · [코드(legged_gym)](https://github.com/leggedrobotics/legged_gym) |
| Wheeled Lab | 2025.02 | Isaac Lab RC카 sim-to-real 생태계 | S.5.2 | [arXiv:2502.07380](https://arxiv.org/abs/2502.07380) |
| TIAGo Omni in Isaac Sim | 2025.10 | 메카넘 정밀·경량 두 모델, 학습 보정 | S.5.2 | [arXiv:2510.10273](https://arxiv.org/abs/2510.10273) |
| Isaac Lab 바퀴 토론 | 2024–2025 | GPU PhysX 바퀴 근사와 원기둥 지원 | S.5.2 | [#1043](https://github.com/isaac-sim/IsaacLab/discussions/1043) |
| Sorour 등 | 2016 | 조향형 바퀴 로봇의 기구학과 특이점 | S.5.3 | [IEEE](https://ieeexplore.ieee.org/document/7487360/) |
| Domain Randomization | 2017.03 | 시각 파라미터 무작위화 | S.6.1 | [arXiv:1703.06907](https://arxiv.org/abs/1703.06907) |
| Dynamics Randomization | 2017.10 | 동역학 파라미터 무작위화 | S.6.1 | [arXiv:1710.06537](https://arxiv.org/abs/1710.06537) |
| ADR(Rubik's Cube) | 2019.10 | 자동 도메인 랜덤화 | S.6.1 | [arXiv:1910.07113](https://arxiv.org/abs/1910.07113) |
| Actuator net | 2019.01 | 실물 데이터로 학습한 액추에이터 모델 | S.6.2 | [arXiv:1901.08652](https://arxiv.org/abs/1901.08652) |
| Sim2Real Predictivity | 2019.12 | SRCC, Habitat 미끄러짐 허점 | S.6.4 | [arXiv:1912.06321](https://arxiv.org/abs/1912.06321) |
| GPS·IMU sim2real 격차 | 2024.03 | 판정자 기반 센서 격차, Wasserstein | S.6.4 | [arXiv:2403.11000](https://arxiv.org/abs/2403.11000) |
| ART/ATK | 2022.11 | Chrono 디지털 트윈 차량 sim-to-real 연구 플랫폼 | S.1.6 | [arXiv:2211.04886](https://arxiv.org/abs/2211.04886) |

---

<!-- tab: 로코모션·데이터·산업 -->

### D.8 로코모션·시스템 스택 (4족·휴머노이드)

| 이름 | 연·발표 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| DreamWaQ | 2023.01 · ICRA 2023 | 고유수용만으로 지형을 암묵 추정(CENet). ICRA 2023 사족보행 대회 1위, 경사 36°·고도차 22 m | F.4 | [논문](https://arxiv.org/abs/2301.10602) |
| DreamWaQ++ | 2024.09 · T-RO 2026 | PointNet + **학습된 신뢰도 필터**로 외수용을 믿을 때만 쓴다. 계단 97.8%, 4개 기종 | F.4 | [논문](https://arxiv.org/abs/2409.19709) |
| DreamRiser | 2023.06 | 같은 지형 상상으로 넘어진 뒤 복구 동작, 학습 분포 밖 지형 | F.4 | [논문](https://arxiv.org/abs/2306.12712) |
| 지형 인지 발놓기 | 2023.10 | 궤적 생성기의 파라미터만 RL로 조절, 안전 발놓기 보상. 징검다리 25.5 cm | F.4 | [논문](https://arxiv.org/abs/2310.04675) |
| Extreme Parkour | 2023.09 · ICRA 2024 | 단일 전방 깊이 카메라로 파쿠르, 20시간 학습 | F.4, F.6 | [논문](https://arxiv.org/abs/2309.14341) · [코드](https://github.com/chengxuxin/extreme-parkour) |
| 확률 제약 볼록 MPC (4족) | 2025 | 불확실성을 전파해 마찰 원뿔·접촉 제약을 적응 조임. **손으로 맞춘 조이기를 이김**, 미지 하중 7.5 kg | F.5 | [코드](https://github.com/RIVeR-Lab/Chance-Constrained-MPC) · [프로젝트](https://cc-mpc.github.io/) |
| MULE | 2025.05 | 미지 하중과 다지형에 적응하는 RL | F.5 | [논문](https://arxiv.org/abs/2505.00488) |
| RSL-RL | 2025.09 | GPU 전용 경량 RL 라이브러리: PPO + 교사–학생 증류, RND, 대칭 증강 | F.6 | [논문](https://arxiv.org/abs/2509.10771) · [코드](https://github.com/leggedrobotics/rsl_rl) |
| legged_gym | 2021 | Rudin 2021의 학습 환경, 이 계열의 출발점 | F.6 | [코드](https://github.com/leggedrobotics/legged_gym) |
| walk-these-ways | 2022 | 행동 다양성으로 일반화, Go1 배포 코드 | F.6 | [코드](https://github.com/Improbable-AI/walk-these-ways) |
| LP-ACRL (자동 커리큘럼 RL) | 2026.01 | 학습 진척으로 과제 표집 분포를 자동 조절, 600과제에서 1,500 iter에 80%. ANYmal D 평지 3.0 m/s·험지 2.5 m/s | F.2 | [논문](https://arxiv.org/abs/2601.17428) |
| Learning to Walk in Minutes | 2021.09 · CoRL 2022 | GPU 대규모 병렬 + 게임식 지형 커리큘럼 | F.1 | [논문](https://arxiv.org/abs/2109.11978) |
| Learning Quadrupedal Locomotion over Challenging Terrain | 2020.10 · Science Robotics | 특권 교사 → 고유수용 학생 증류 | F.1 | [논문](https://arxiv.org/abs/2010.11251) |
| ANYmal Parkour | 2023.06 · Science Robotics 2024 | 기술별 정책 + 항법, 지각 기반 민첩 주행 | F.1, B.14 | [논문](https://arxiv.org/abs/2306.14874) |
| 학습 기반 다리 로코모션 개관 | 2024.06 | 계열 전체의 현황과 전망 | F.1 | [논문](https://arxiv.org/abs/2406.01152) |
| Learning quadrupedal locomotion over challenging terrain | Science Robotics 2020 | blind proprioceptive RL 보행 | A.7 | [링크](https://pure.kaist.ac.kr/en/publications/learning-quadrupedal-locomotion-over-challenging-terrain/) |
| elmap-rl-controller | GitHub (ETH PBL) | GPU elevation map 위 Jetson급 RL 보행 | A.7 | [코드](https://github.com/ETH-PBL/elmap-rl-controller) |
| autonomy_stack_go2 | GitHub (CMU) | Go2 L1 LiDAR → SLAM → traversability → 충돌회피 전체 스택 | A.7, B.12.2 | [코드](https://github.com/jizhang-cmu/autonomy_stack_go2) |
| Learning robust perceptive locomotion in the wild (Miki et al.) | 2022.01 · Science Robotics 2022 | belief encoder로 지도 오류에 강한 인식 기반 보행 | A.7.1 | [논문](https://arxiv.org/abs/2201.08117) |
| ANYmal Parkour | 2023.06 | 인식 모듈 + 내비 정책 + 보행 기술 3단 계층 | A.7.1 | [논문](https://arxiv.org/abs/2306.14874) |
| High-speed control and navigation (Raibo) | 2025.06 | 발 디딤 planner + 생성 모델과 경쟁 학습한 tracker | A.7.1 | [논문](https://arxiv.org/abs/2506.02835) |
| DreamWaQ++ | 2024.09 · T-RO | PointNet(신뢰도 필터) + 확률 proprio 잠재 + MLP-Mixer, 카메라 고장 시 접촉 반사로 복귀 | A.7.1 | [논문](https://arxiv.org/abs/2409.19709) · [프로젝트](https://dreamwaqpp.github.io/) · [영상](https://www.youtube.com/watch?v=IeBNRQsmKR4) |
| OpenHEART | 2026.03 · ICRA 2026 | 다리 매니퓰레이터의 관절 물체 열기, 시각 + proprioception 관절 정보 추정 | A.7.1 | [논문](https://arxiv.org/abs/2603.05830) · [프로젝트](https://openheart-icra.github.io/OpenHEART/) |
| 전방향 계단 보행 (G1 + Mid-360) | 2026.03 | 신뢰도 감쇠 누적 점군 + EGAU 높이 지도 정제, 조밀한 위험 디딤 벌점 | A.8.2 | [논문](https://arxiv.org/abs/2603.07928) |
| PolygMap | 2025.10 · ICRA 2026 | 계단 평면 다각형 지도 위 발 디딤, 전신 계획 20–30 Hz(Orin) | A.8.2 | [논문](https://arxiv.org/abs/2510.12346) |
| Learning Perceptive Humanoid Locomotion over Challenging Terrain | 2025.03 | 변분 정보 병목 world model로 지도 잡음 대응, 2 km 무개입 | A.8.2 | [논문](https://arxiv.org/abs/2503.00692) |
| autonomy_stack_mecanum_wheel_platform | GitHub (CMU) | Mid-360 + NUC, 분위수 지면 지형 분석·경로 라이브러리 로컬 Planner·FAR·TARE (ROS 2 Jazzy) | A.9.1 | [코드](https://github.com/jizhang-cmu/autonomy_stack_mecanum_wheel_platform) |
| DreamRiser | 2023.06 | 학습된 지형 상상으로 넘어진 뒤 복구 | A.7.1 | [논문](https://arxiv.org/abs/2306.12712) · [프로젝트](https://sites.google.com/view/dreamriser) |
| DreamFLEX | 2025.02 · ICRA 2025 | 관절 고장 감지·적응 보행 | A.7.1 | [논문](https://arxiv.org/abs/2502.05817) |
| Stop to Decide | 2026.07 | 매핑 생략, 지연 우선 proprioceptive 내비(Go2 + Orin) | A.7 | [논문](https://arxiv.org/abs/2607.11204) |
| Efficient Beam Search for Active Perception | 2026.04 | ANYmal + Orin 깊이 추정 + Voxblox | A.7 | [논문](https://arxiv.org/abs/2604.23327) |
| QuadPiPS | 2025.01 | perception-informed footstep 계획(시뮬만) | A.7 | [논문](https://arxiv.org/abs/2501.00112) |
| Gait-Adaptive Perceptive Humanoid Locomotion | 2025.12 | 보행 위상 연동 발밑 재구성, 실제 계단·갭 | A.8 | [논문](https://arxiv.org/abs/2512.07464) |
| DPL | 2025.10 · RA-L 2026 | 깊이 영상 정제 transformer | A.8 | [논문](https://arxiv.org/abs/2510.07152) |
| MARCH | 2026.06 | sparse foothold 계획 | A.8 | [논문](https://arxiv.org/abs/2606.10288) |
| BeamDojo | 2025.02 · RSS 2025 | sparse foothold(빔·돌다리) 보행, 발 디딤 보상 + 이중 critic | A.8 | [논문](https://arxiv.org/abs/2502.10363) · [프로젝트](https://why618188.github.io/beamdojo/) |
| VB-Com | 2025.02 | 인식 실패 시에도 안전 보행 | A.8 | [논문](https://arxiv.org/abs/2502.14814) |
| elevation_mapping_humanoid | GitHub | MID-360 단일 LiDAR 로봇 중심 elevation map | A.8 | [코드](https://github.com/smoggy-P/elevation_mapping_humanoid) |

### D.9 데이터셋·벤치마크

| 이름 | 요약 | 본문 | 링크 |
|---|---|---|---|
| STONE | 오프로드 traversability(LiDAR 128ch + 카메라 6 + 4D 레이더) | A.3 | [논문](https://arxiv.org/abs/2603.09175) |
| UniOcc | nuScenes/Waymo/CARLA/OPV2V 통합 occupancy + flow | A.4, A.6 | [논문](https://arxiv.org/abs/2503.24381) · [코드](https://github.com/tasl-lab/uniocc) · [HF](https://huggingface.co/datasets/tasl-lab/uniocc) |
| Cam4DOcc | 카메라 4D occupancy 예측 벤치마크 | A.6 | [논문](https://arxiv.org/abs/2311.17663) |
| GrandTour | ANYmal-D 멀티모달 49회 실주행(RSS 2025) | A.7 | [HF](https://huggingface.co/datasets/leggedrobotics/grand_tour_dataset) |
| NaviTrace | 1인칭 이미지 + 언어 + 로봇형태 → 2D 경로(sidewalk 포함) | B.6 | [HF](https://huggingface.co/datasets/leggedrobotics/navitrace) |
| humanoid-everyday | 휴머노이드 RGB + 깊이 + LiDAR + 촉각 + IMU | A.8 | [HF](https://huggingface.co/datasets/USC-GVL/humanoid-everyday) |
| egocentric-video | 사람 착용 스테레오 1인칭 영상 | A.8 | [HF](https://huggingface.co/datasets/UniDataPro/egocentric-video) |

### D.10 벤더·산업 자료 (PR 색채 주의)

| 이름 | 요약 | 본문 | 링크 |
|---|---|---|---|
| Coco Robotics Coco 2 | 2026-02 발표. 보도 배달로봇 자율화. 학습 스택으로 Isaac Sim·Isaac Lab·Omniverse·Cosmos, 함대 운용 데이터와 사람 개입 피드백 | S.7, B.6d | [발표](https://www.cocodelivery.com/blog/coco-robotics-launches-next-gen-autonomous-robots-for-urban-deliveries) |
| RIVR (구 Swiss-Mile) | ETH RSL 스핀오프 바퀴·다리 배달로봇. 15 km/h, 40 L, 계단 보행. 오스틴·취리히 시범 배송(2025), 2026-03-19 Amazon 인수 | B.14 | [기사](https://deeptechnation.ch/dtn-news/amazon-acquires-rivr-how-an-eth-zurich-lab-built-the-robot-that-delivers-your-packages/) · [기사](https://www.therobotreport.com/swiss-mile-rebrands-to-rivr-continues-developing-wheeled-quadrupeds/) |
| Boston Dynamics Spot | 스테레오 깊이 5쌍, 학습 기반 계단 분류 | A.7 | [공식](https://support.bostondynamics.com/s/article/About-the-Spot-Robot-72005) |
| Boston Dynamics Atlas | ToF + 스테레오, 다중 평면 분할 매핑 | A.8 | [블로그](https://bostondynamics.com/blog/making-atlas-see-the-world/) |
| ANYbotics ANYmal | 360° LiDAR + 깊이 카메라 6 | A.7 | [공식](https://www.anybotics.com/robotics/anymal/) |
| Unitree Go2 / G1·H1 | 4D LiDAR L1 + D435i, 공개 SDK | A.7, A.8 | [스펙](https://robostore.com/blogs/news/go2-edu-robot-advanced-sensors-4d-lidar-and-ai-computing-power-for-true-autonomy) · [SDK](https://github.com/unitreerobotics) |
| Figure 03 | 카메라 6 + 손바닥 카메라 | A.8 | [공식](https://www.figure.ai/news/introducing-figure-03) |
| 1X NEO | 스테레오 어안 2 + Jetson Thor | A.8 | [공식](https://www.1x.tech/discover/neo-factory) |
| Figure Project Go-Big | 사람 1인칭 영상만으로 영상·언어 → SE(2) 속도 내비게이션(2025-09) | A.8.1 | [공식](https://www.figure.ai/news/project-go-big) |
| Figure Helix 2.5 | 사람 행동 데이터 사전학습, 처음 보는 30가구 조작 56%(2026-09) | A.8.1 | [공식](https://www.figure.ai/news/helix-2-5-zero-shot-30-home-generalization) |
| Sunday ACT-1 (Memo) | 장갑 시연으로 학습, 3D 지도 조건 내비게이션 + 조작(2025-11) | A.8.1 | [블로그](https://www.sunday.ai/blog/no-robot-data) |
| Flexion Reflect v1.0 | VLM 임무 → VLA·RL 기술 → 전신 제어(Reflex), 16단계 임무 90%(2026-06) | A.8.1 | [공식](https://flexion.ai/news/flexion-reflect-v1.0) |
| Niantic Spatial·Flexion·NVIDIA | 360° 카메라 → 3DGS + 충돌 메시 → NuRec USDZ, RGB 내비 정책이 깊이와 대등(2026-07) | A.8.1 | [블로그](https://flexion.ai/news/niantic-spatial-flexion-and-nvidia-closing-the-sim2real-gap-for-humanoids) · [영상](https://www.youtube.com/watch?v=1XtBPY4i780) |
| RealSense + LimX Dynamics | 깊이 + cuVSLAM 휴머노이드 자율 내비게이션(GTC 2026-03) | A.8.1 | [발표](https://www.realsenseai.com/news-insights/news/realsense-unveils-first-of-its-kind-humanoid-autonomous-navigation-at-nvidia-gtc/) |

### D.12 IROS 2026 수확 (개요 문서 "학회 수확")

채택 논문 1,929편 가운데 travplan의 열린 질문에 걸리는 것이다. 괄호 안은 논문 번호다.

| 이름 | 저자 | 요약 | 본문 | 링크 |
|---|---|---|---|---|
| TNT (508) | Pan, Datar, Xiao 등 | 못 갈 것 같은 지형을 과거 차량–지형 상호작용으로 가른다. 계획 성능 50% 개선 | 개요, A.10 | [논문](https://arxiv.org/abs/2409.17479) |
| Remember Your Driving Feel (1304) | Xie 등 | proprioception 기반 온라인 traversability 학습 | 개요, A.10 | [색인](https://2026.ieee-iros.org/program/paper-index/) |
| TravKAN (2427) | Fusaro, Mosco, Li, Pretto | Kolmogorov–Arnold 망으로 빠르고 해석 가능한 traversability | 개요, A.10 | [색인](https://2026.ieee-iros.org/program/paper-index/) |
| Observation-Conditioned Rollout Allocation (3312) | Diaz Pichardo, Mandow, Vazquez-Martin | 근시안 고도지도에서 관측에 따라 MPC rollout 예산 배분 | 개요, E.1 | [색인](https://2026.ieee-iros.org/program/paper-index/) |
| MSC (3480) | Park 등 (KAIST) | caster를 아는 다단계 제어, 불확실성 NMPC + RL 실행 층 | 개요, B.12.4 | [색인](https://2026.ieee-iros.org/program/paper-index/) |
| RayOcc (1720) | Kim, Lee | 가우시안 혼합 세기로 가림 인지 ray occupancy 추정 | 개요, A.5 | [색인](https://2026.ieee-iros.org/program/paper-index/) |
| OGM-CBF (3618) | Raja 등 | 시야 밖 장애물을 기억하는 점유 격자 기반 CBF | 개요, C | [색인](https://2026.ieee-iros.org/program/paper-index/) |
| Streaming Gaussian Encoding (2962) | Luz, Valada 등 | 4D panoptic occupancy 추적, Best Paper 후보 | 개요, A.2 | [색인](https://2026.ieee-iros.org/program/paper-index/) |
| OccTrack360 (1298) | Lin, Yang 등 | 어안 서라운드 뷰 4D panoptic occupancy 추적 벤치마크, 가림·시야 마스크 | 개요, A.2 | [논문](https://arxiv.org/abs/2603.08521) |
| PA-MPPI (68) | Zhai, Reiter, Scaramuzza | 인식을 아는 MPPI, 미지 환경 쿼드로터 | 개요, E.1 | [색인](https://2026.ieee-iros.org/program/paper-index/) |

### D.11 기타

- 사용자 Notion 리서치 허브 — [VLA/E2E/Learning-based planning — Mobile robot](https://app.notion.com/p/geonhee-lee/VLA-E2E-Learning-based-planning-Mobile-robot-346c5d39343d80f18d74f6efac4cc40a)
- KAIST Urban Robotics Lab 연구자 페이지 — [Jiwon Park](https://ziwon-park.com/)(DreamFlow), [Dongkyu Lee](https://dklee98.github.io/#highlights)(TRG-planner, DreamFlow, DreamWaQ++, DreamFLEX, TRIP)
- 같은 페이지의 [ADD - Traversability Estimation, Off-Road Autonomous Driving](https://app.notion.com/p/geonhee-lee/VLA-E2E-Learning-based-planning-Mobile-robot-346c5d39343d80f18d74f6efac4cc40a#3e5c5d39343d8039bd36c32ec5418e7d) 블록 — A.10·E의 출처

_Last updated: 2026-09-25 · 관련: `docs/prd-p2.md`, `docs/ARCHITECTURE.md`_
