<!-- doc: Controller · 안전 | 3 -->
# Controller와 안전 필터 — Planner의 궤적을 실행하는 쪽 (§E, §C)

**Controller는 Planner의 경로나 궤적을 받아 추종하면서, 지형과 동적 장애물을 로컬로 피하는 body twist를 낸다.** travplan에서 Controller(MPPI)는
개발 계획에서 빠져 유지보수만 하므로(2026-09-25 결정), 이 문서는 Controller를 손봐야 할 때 볼 참고 지도다. 세 탭으로 나뉜다.

| 탭 | 다루는 것 | 절 | travplan과의 관계 |
|---|---|---|---|
| MPPI 계열 | MPPI의 계보, 학습 prior를 넣는 법, SMPPI | E.1, B.5 | `MPPIController`, `SmoothMPPIController` |
| 학습 동역학·적응 | 학습 rollout 모델, 불확실성, 온라인 적응, 마일스톤, Zeilinger 그룹(학습 MPC의 보장·공개 코드·내비 MPC) | E, E.2–E.7 | 슬립이 커질 때 바꿀 rollout 모델 |
| 안전 필터 | 비용 통합형과 외부 필터형, CBF 계열, 계보 | C.1–C.4 | 시간가변 비용 레이어(구현), CVaR-BF(TP-0014) |

**계보 한눈에 보기.**

| 연도 | 샘플링 MPC | 학습 동역학·적응 | 안전 필터 |
|---|---|---|---|
| 2015–2018 | MPPI, 정보이론적 MPC, Tube-MPPI | PETS | CBF-QP, HJ 도달 가능성, 예측 안전 필터 |
| 2019–2021 | Robust MPPI | IKD, RMA | CBF 튜토리얼, 이산 CBF + MPC, safe-control-gym |
| 2022–2023 | log-MPPI, SMPPI, Nav2 MPPI, RA-MPPI | PENN, TOAST, 지형 인지 운동 모델, 확률 앙상블 능동 탐색, TD-MPC2 | 안전 필터 통합 관점 |
| 2024–2026 | MPPI-Generic, π-MPPI, DRA-MPPI, ProxPI | 잠재 문맥 온라인 적응 | CVaR-BF, OcclusionCBF, Predictive Semantic Safety |

**공개 코드.** GitHub 별 순이다(2026-09).

| 분야 | 이름 | 코드(★) | 라이선스 | travplan에서 |
|---|---|---|---|---|
| 스택 | [Nav2 (MPPI Controller 포함)](https://github.com/ros-navigation/navigation2) | 4.7k | 패키지별 혼합 | ROS 2 통합 시 비교 대상 |
| 모델 기반 RL | [TD-MPC2](https://github.com/nicklashansen/tdmpc2) | 1.0k | MIT | 잠재 world model + MPPI 참고 |
| 벤치마크 | [safe-control-gym](https://github.com/utiasDSL/safe-control-gym) | 0.9k | MIT | 안전 방법 비교 환경 |
| MPPI | [pytorch_mppi](https://github.com/UM-ARM-Lab/pytorch_mppi) | 0.8k | MIT | 같은 PyTorch 계열 참고 |
| 안전 | [NMPC-DCLF-DCBF](https://github.com/HybridRobotics/NMPC-DCLF-DCBF) | 0.3k | MIT | 이산 CBF + MPC 참고 |
| MPPI | [MPPI-Generic](https://github.com/ACDSLab/MPPI-Generic) | 0.3k | BSD-2-Clause | Orin 이식 시 CUDA 구현 후보 |
| 안전 | [safe_control](https://github.com/tkkim-robot/safe_control) | 0.3k | 표기 없음 | CBF-QP, MPC-CBF 구현 참고 |
| 안전 | [hj_reachability](https://github.com/StanfordASL/hj_reachability) | 0.2k | MIT | JAX 도달 가능성 계산 |

**travplan의 위치.** ==travplan Controller는 "MPPI + 비용 통합형 안전"이고, 다음 단계는 뒤에 붙는 안전 필터다.== 비용은 `CostTerm`으로만
더하고 최적화기(`mppi.py`)는 건드리지 않는다는 규칙이 있어서, 이 문서의 연구 가운데 travplan에 들어오는 것은 셋 중 하나다. 새 비용 항,
새 rollout 모델, Controller 뒤의 필터다.

---

<!-- tab: MPPI 계열 -->

### E.1 MPPI의 계보: 경로 적분 제어에서 GPU 라이브러리까지

**MPPI는 2015년 경로 적분 제어를 GPU 샘플링으로 푼 데서 시작했다.** 이후 정보이론적 유도로 일반화되고(2017), 외란에 버티는 판(Tube·Robust
MPPI), 샘플링 분포를 바꾼 판(log-MPPI, SMPPI), 범용 라이브러리(Nav2 MPPI Controller, MPPI-Generic)로 발전했다. travplan `MPPIController`는
2017년 정보이론적 MPPI에 시간 상관 AR(1) 노이즈와 참조 추종 샘플을 더한 형태다(배경 0.2). 개발 계획에서는 빠져 있어, 이 절은 Controller를
손볼 때 볼 지도다.

| 연도 | 이름 | 바꾼 것 | 구현(★) |
|---|---|---|---|
| 2015–2016 | MPPI | 경로 적분 제어를 GPU 병렬 샘플링 MPC로, AutoRally 공격적 주행 | — |
| 2017–2018 | 정보이론적 MPC | KL 기반 유도로 일반 비선형 동역학과 비용으로 확장 | — |
| 2018–2021 | Tube-MPPI, Robust MPPI | 명목 상태와 실제 상태를 나누고 추종 제어기를 더해 외란에 강하게 | MPPI-Generic |
| 2022 | log-MPPI | 정규분포와 로그정규분포를 곱한 분포에서 샘플 | — |
| 2022 | SMPPI | 노이즈를 제어 변화율에 넣어 매끄럽게(B.5) | travplan `SmoothMPPIController` |
| 2022–2023 | Nav2 MPPI Controller | ROS 2 표준 스택의 CPU MPPI | [ros-navigation/navigation2](https://github.com/ros-navigation/navigation2) 4.7k |
| 2024 | MPPI-Generic | MPPI, Tube-MPPI, Robust MPPI의 C++/CUDA 템플릿 라이브러리 | [ACDSLab/MPPI-Generic](https://github.com/ACDSLab/MPPI-Generic) 0.3k |
| — | pytorch_mppi | 근사 동역학을 쓰는 PyTorch 구현 | [UM-ARM-Lab/pytorch_mppi](https://github.com/UM-ARM-Lab/pytorch_mppi) 0.8k |

**MPPI와 정보이론적 MPC — 샘플을 굴려 가중 평균한다**([arXiv:1509.01149](https://arxiv.org/abs/1509.01149), 2015;
[arXiv:1707.02342](https://arxiv.org/abs/1707.02342), T-RO 2018, Georgia Tech). 제어열에 잡음을 섞은 후보 수천 개를 GPU로 동시에 굴리고,
비용의 지수 가중치로 평균해 새 제어열을 얻는다. 2015년판은 경로 적분 제어 이론에서 일반화된 중요도 샘플링으로 유도했다. 2017년판은
"비용의 볼츠만 분포에 KL 기준으로 가장 가까운 제어 분포"를 찾는 정보이론적 유도로 틀을 넓혀 일반 비선형 동역학에 썼다. 1/5 크기
AutoRally 차량으로 흙길 트랙을 공격적으로 달렸고, 교차 엔트로피 방법(CEM)의 MPC 판과 비교했다.

![Information-theoretic MPC Fig. 2](https://arxiv.org/html/1707.02342v1/Figures/distributions.png)
*그림 — 정보이론적 MPC (Fig. 2): 제어 분포를 최적 분포 쪽으로 "밀어" 가깝게 만드는 목적을 그림으로 나타냈다. 출처: [arXiv:1707.02342](https://arxiv.org/abs/1707.02342)*

**Tube-MPPI와 Robust MPPI — 외란과 모델 오차에 버틴다**([RMPPI arXiv:2102.09027](https://arxiv.org/abs/2102.09027), RA-L 2021,
Georgia Tech). MPPI는 매 스텝 실제 상태에서 다시 시작한다. 모델이 틀리거나 외란이 크면 샘플 전체가 나쁜 영역으로 밀려 중요도 샘플링이
무너진다. Tube-MPPI(RSS 2018)는 외란을 받지 않는 명목 상태에서 MPPI를 풀고, 실제 상태가 명목 궤적을 따라가게 하는 추종 제어기를 붙였다.
다만 명목 상태가 실제에서 멀어질 수 있고 보장이 없었다. RMPPI는 명목과 실제를 합친 증강 상태, 명목 상태를 어디서 다시 시작할지 정하는
규칙, 추종 제어기의 능력을 반영한 중요도 샘플링을 더해 자유 에너지 증가의 상한을 유도했다. AutoRally 실차에서 MPPI의 강건성 부족과
Tube-MPPI의 과한 보수성을 함께 줄였다.

**log-MPPI — 샘플링 분포를 바꿔 실행 가능한 궤적을 늘린다**([arXiv:2203.16599](https://arxiv.org/abs/2203.16599), RA-L 2022). 모든 샘플이
비용이 높거나 불가능한 영역에 몰리면 MPPI는 실행할 수 없는 궤적을 낸다. log-MPPI는 가우시안 대신 정규분포 변수와 로그정규분포 변수의
곱(NLN)에서 제어 변화를 샘플한다. 작은 잡음 분산으로 제약 위반을 피하면서도 궤적이 상태 공간에 넓게 퍼진다. 2D occupancy 격자를 비용으로
직접 넣어, 미지의 복잡한 환경을 로컬 비용 지도만으로 충돌 없이 주행했다.

**MPPI-Generic — GPU MPPI 라이브러리**([arXiv:2409.07563](https://arxiv.org/abs/2409.07563), 2024, Georgia Tech). MPPI, Tube-MPPI, Robust
MPPI를 C++/CUDA 템플릿으로 구현했다. 동역학과 비용을 API에 맞춰 쓰면 MPPI 코드를 고치지 않고 바꿀 수 있다. 차동 구동 모델과 Nav2의
비용 항을 똑같이 재현해 비교했다. RTX 3080에서 샘플 128개 기준 최적화 한 번에 약 0.15 ms로, Nav2의 CPU 구현(0.39–0.62 ms)보다 빠르고
PyTorch 기반 TorchRL 구현(25–48 ms)보다 두 자릿수 이상 빨랐다. Jetson Orin Nano에서도 샘플 128개에 약 0.6 ms였다.

<details markdown="1">
<summary>자세히: Robust MPPI의 명목 상태 선택과 log-MPPI의 샘플링</summary>

**기본 MPPI.** 잡음 섞은 제어열을 굴려 비용 $S_k$를 얻고, $\exp(-S_k/\lambda)$ 가중 평균으로 제어열을 갱신한다(배경 0.2).

**추종 제어기(Tube-MPPI, RMPPI).** 명목 상태 $\bar{\mathbf x}$에서 MPPI가 낸 제어 $\bar{\mathbf u}$에, 실제 상태와의 차이를 되먹이는 항을 더해
실행한다. $K$는 iLQG나 contraction metric 제어기가 준다.

$$ \mathbf u_t = \bar{\mathbf u}_t + K_t\,(\mathbf x_t - \bar{\mathbf x}_t) $$

**RMPPI의 명목 상태 선택.** 실제 상태 $\mathbf x$와 이전 명목 상태 사이의 후보 $\mathbf p_0, \dots, \mathbf p_R$ 가운데, 몬테카를로로 추정한
자유 에너지 $\mathcal F_{MC}$가 임계값 $\alpha$(보통 충돌 비용) 이하인 것 중 실제 상태에 가장 가까운 것을 새 명목 상태로 쓴다.

$$ \mathbf x^* = \arg\min_{\mathbf p_i} \lVert \mathbf p_i - \mathbf x \rVert \quad \text{s.t.} \quad \mathcal F_{MC}(S, \mathbb P, \mathbf p_i, \lambda) \le \alpha $$

실제 상태가 괜찮으면 거기서 다시 시작하고(MPPI처럼), 위험하면 명목 상태를 유지한다(Tube-MPPI처럼).

**log-MPPI의 NLN 샘플.** 정규분포 변수 $X$와 로그정규분포 변수 $Y$를 곱한 $Z = XY$를 제어 변화로 쓴다. 논문의 예에서는 잡음 분산을
작게 두어 제약 위반을 피하면서도, 가우시안 샘플보다 궤적이 넓게 퍼졌다.

$$ \delta \mathbf u = X \cdot Y, \qquad X \sim \mathcal N(0, \sigma_n^2), \quad \ln Y \sim \mathcal N(\mu_{ln}, \sigma_{ln}^2) $$

**travplan에 주는 것.** travplan `MPPIController`는 샘플 768개, 지평 40스텝(4초)으로 운동학 벤치마크에서 스텝당 약 10 ms가 걸린다(PyTorch).
Orin 이식에서 지연이 문제가 되면 MPPI-Generic 같은 CUDA 구현이 첫 후보다. Isaac Sim이나 실물에서 슬립이 커지면, 실제 상태에서 매번
다시 시작하는 지금 방식 대신 RMPPI식 명목 상태 선택이 로봇을 안정시킨다.

</details>

### B.5 Controller 쪽 참고: 학습 prior를 MPPI에 넣는 법과 SMPPI

> MPPI는 2026-09-25에 Controller로 분리되어 개발 계획에서 빠졌다. 이 절은 Controller를 손볼 때 볼 기록이다.

**ProxPI**([arXiv:2609.00941](https://arxiv.org/abs/2609.00941)) — 학습 prior를 MPPI에 넣을 때, 샘플링 분포의 **평균을 prior로
옮기면** prior가 틀린 경우 최적화기의 보정이 매번 버려져 성능이 떨어진다고 지적한다. 대신 prior를 **부드러운 근접 비용 항으로만**
넣으라고 제안한다. 그러면 prior가 틀려도 다른 비용 항(예: traversability)이 해를 바로잡을 수 있다. 실제 로봇과 시뮬레이션에서
검증했다.

![ProxPI Fig. 2](https://arxiv.org/html/2609.00941v1/fig_ood_grid.png)
*그림 — ProxPI (Fig. 2): prior가 틀릴 때 기본 MPPI / 워밍스타트 / ProxPI의 행동 비교(5개 로봇). 출처: [arXiv:2609.00941](https://arxiv.org/abs/2609.00941)*

<details markdown="1">
<summary>자세히: ProxPI의 방법과 수식</summary>

**두 가지 prior 주입 방식.** 학습 prior가 제어열 $U_p$를 줄 때, 샘플링 분포를 prior로 옮기는 워밍스타트와, 샘플링은 그대로 두고 비용에 근접 항을 더하는
ProxPI가 있다.

$$ \text{워밍스타트: } q_w(V) = \mathcal{N}(U_p, \Sigma), \qquad \text{ProxPI: } S'(V) = S(V) + \alpha \lVert V - U_p \rVert^2 $$

ProxPI의 목표 분포는 MPPI 우도와 "평균 $U_p$, 공분산 $\tfrac{\lambda}{2\alpha} I$"인 가우시안 prior의 곱이다. 둘 다 같은 중심을 쓰지만 폭이 다르다.

$$ p'(V) \propto \exp\!\big(-S(V)/\lambda\big)\, \exp\!\big(-\tfrac{\alpha}{\lambda} \lVert V - U_p \rVert^2\big)\, p_0(V) $$

**왜 ProxPI가 나은가.** 과제 비용을 국소 2차식 $S \approx S(U^*) + \tfrac12 \lVert V - U^* \rVert_H^2$로 근사하면, 반복 갱신은 과제 최적 $U^*$와 prior $U_p$ 사이의
고정점으로 수렴한다.

$$ U^\dagger = (H + 2\alpha I)^{-1}\big(H U^* + 2\alpha U_p\big), \qquad U_{j+1} - U^\dagger = A_\alpha\, (U_j - U^\dagger) $$

ProxPI는 이전 해 $U_j$를 중심으로 샘플링하므로 **보정이 반복마다 쌓인다.** 워밍스타트는 매번 $U_p$로 중심을 되돌려 이 보정을 버린다. 또 prior가 목표
분포에서 멀면 가중치가 몇 샘플에 몰려(유효 샘플 수 감소, $\chi^2$ 발산으로 측정) 추정이 흔들린다.

**travplan에 주는 것.** `MPPIController`는 Planner 경로를 `ReferenceCost`(비용)로 받고, 샘플의 30%만 경로 추종 제어열 주변에서 뽑는다. ProxPI 분석대로라면
이 30% 혼합보다 비용 항만 쓰는 편이 prior가 틀릴 때 더 안전할 수 있다. Controller 튜닝 때 비교할 항목이다.

</details>

travplan의 `MPPIController`는 이미 이 방향에 가깝다. Planner의 경로를 **`ReferenceCost`라는 비용 항**으로 받고, 샘플의 30%만 그
경로를 따라가는 제어열 주변에서 뽑는다(평균을 통째로 옮기지 않는다). ProxPI 형태의 비용 항은 다음처럼 쓸 수 있다.

```python
# control/mppi/costs.py::CostTerm 인터페이스 예시 (ProxPI 스타일)
class ProximityCost:
    """Planner 경로에서 멀어질수록 비용을 준다. 샘플링 평균은 건드리지 않으므로,
    경로가 틀려도 TraversabilityCost 같은 다른 항이 해를 되돌릴 수 있다."""
    def __call__(self, ctx):
        xy = ctx.poses[:, 1:, :2]                                   # [K, T, 2]
        d = torch.cdist(xy.reshape(-1, 2), ctx.ref_xy).min(-1).values
        return weight * d.reshape(xy.shape[:2]).pow(2).sum(-1)       # [K]
```

**Self-Supervised MPC Initialization**([arXiv:2408.03394](https://arxiv.org/abs/2408.03394))은 MPC의 초기해(워밍스타트)를 학습한다.
결정론적 MPC에서 21.6%·34.1% 개선을, 샘플링 MPC에서 안전 +100%, 경로 효율 +12.8%, 조향 매끄러움 +7.2%를 보고했다.
**π-MPPI**([arXiv:2504.10962](https://arxiv.org/abs/2504.10962))는 이름과 달리 워밍스타트 학습이 아니다. MPPI 샘플마다 QP 투영
필터를 걸어 제어의 크기와 도함수 한계를 보장하는 방법이고(고정익 비행체), 학습은 그 QP 풀이기의 초기값에만 쓴다. 두 연구 모두 검증은
시뮬레이션뿐이다.

![π-MPPI Fig. 1](https://arxiv.org/html/2504.10962v2/NN_block_diagram.png)
*그림 — π-MPPI (Fig. 1): QP 투영 필터의 초기값을 예측하는 네트워크(MLP + 최적화 반복을 풀어 놓은 구조). 출처: [arXiv:2504.10962](https://arxiv.org/abs/2504.10962)*

![Self-Supervised MPC Init Fig. 1](https://arxiv.org/html/2408.03394v3/images/general_framework.png)
*그림 — Self-Supervised MPC Init (Fig. 1): 전문가 MPC 데모로 1차 학습 → 자기지도로 2차 개선하는 2단계 학습. 출처: [arXiv:2408.03394](https://arxiv.org/abs/2408.03394)*

<details markdown="1">
<summary>자세히: π-MPPI의 방법과 수식</summary>

**목표: 제어 도함수의 상한을 보장하는 MPPI.** 고정익 비행체(FWV)처럼 제어가 떨리면 안 되는 시스템에서, 사후 평활화는 도함수 한계를 보장하지 못한다.
π-MPPI는 **샘플 하나하나를 projection filter로 최소한만 고쳐** 크기와 고차 도함수 한계를 만족시킨 뒤 MPPI 평균을 낸다.

$$ \min_{\bar\nu^m} \tfrac12 \lVert \nu^m - \bar\nu^m \rVert^2 \quad \text{s.t.}\quad {}^{(j)}\bar\nu_0^m = {}^{(j)}u_{\text{init}},\qquad {}^{(j)}u_{\min} \le {}^{(j)}\bar\nu^m \le {}^{(j)}u_{\max} $$

유한 차분으로 쓰면 등식·부등식 제약이 있는 QP다($A \bar\nu = b$, $G\bar\nu - h - \zeta = 0$, $\zeta \ge 0$). 필터가 비선형이므로 걸러진 샘플의 평균·공분산을 다시 추정해
가중치를 계산하고, 평균을 낸 뒤 다시 한 번 필터를 적용해 결과도 한계 안에 둔다.

**학습하는 것.** 이 QP 풀이기의 **초기값**을 신경망이 예측해 수렴을 빠르게 한다. MPPI 자체의 워밍스타트가 아니다.

**travplan에 주는 것.** travplan은 스워브 한계를 `SwerveModel.clamp_accel`로 굴리는 도중에 적용한다(투영이 아니라 클램프). 가속의 도함수(jerk) 한계까지
보장해야 할 때 참고한다.

</details>

<details markdown="1">
<summary>자세히: Self-Supervised MPC Initialization의 방법과 수식</summary>

**목표.** MPC 풀이기에 좋은 **초기해**를 주는 정책을 학습해 최적화 시간을 줄인다. 이전 해를 옮겨 쓰는 방식은 상태가 급변하면 실패하고, 순수 모방은
계산 시간을 직접 줄이지 못한다.

**2단계 학습.**
1. 오프라인 BC: 초기해 없이(0 벡터) 충분히 반복한 전문가 MPC의 (상태, 제어열) 쌍으로 MLP를 학습한다(MSE).
2. 온라인 미세조정: RL로 **MPC 계산 시간을 직접 줄이는** 방향으로 조정하고, DAgger(배경 0.12)로 정책이 실제로 도달한 상태를 데이터에 더해 분포 이동을 줄인다.

**결과.** 결정론적 MPC(F1 트랙 경로 추종)에서 최적화 21.6% 단축, 추종 정확도 34.1% 향상. 샘플링 MPC(장애물 많은 내비)에서 안전 100% 향상, 경로 효율
12.8%, 조향 부드러움 7.2% 개선.

**travplan에 주는 것.** MPPI 워밍스타트를 학습하는 방법이자, Planner D에 DAgger를 적용하는 구체적인 절차의 참고다.

</details>

#### Smooth MPPI(SMPPI): 노이즈를 변화율에 더한다

```
표준 MPPI                               SMPPI (input lifting)
u_k = u_nom_k + ε_k                     v_k = v_nom_k + ε_k       (ε: 독립 노이즈)
(ε_k가 스텝마다 독립 → 제어가 들쭉날쭉)     u_k = u_{k-1} + v_k·dt    (적분 → 매끄러움)
```

표준 MPPI는 스텝마다 독립인 노이즈를 제어값에 바로 더하므로 제어열이 떨리기 쉽다. **Smooth MPPI**([arXiv:2112.09988](https://arxiv.org/abs/2112.09988))는
노이즈를 제어의 **변화율**에 더하고 적분해 제어를 만든다. 랜덤 워크가 개별 잡음보다 매끄러운 것과 같은 원리로, 비용 항을 튜닝하지 않고도
구조적으로 매끄러운 제어를 얻는다. MPPI의 정보이론적 유도는 그대로 유지된다.

<details markdown="1">
<summary>자세히: Smooth MPPI의 방법과 수식</summary>

**MPPI의 정보이론적 틀.** 제어 평균 $U$ 주변의 샘플 분포 $q(V)$와 무제어 분포 $p(V)$를 두고, 자유 에너지로 최적 분포 $q^\star$를 정의한다(배경 0.2).

$$ q^\star(V) = \frac{1}{\eta} \exp\!\Big(-\frac{1}{\lambda} S(V)\Big)\, p(V) $$

**문제.** 원래 MPPI의 제어 비용 항은 "이전 반복과 현재 반복의 제어 차이"만 줄인다. 시간 축 방향의 떨림(chattering)은 비용에 없고, 임의로 비용을 더하면
MPPI의 유도(중요도 샘플링으로 제어 비용이 정해지는 구조)가 깨진다.

**input lifting.** 제어 공간과 행동 공간을 나눈다. 노이즈는 **한 차수 높은 공간**(제어의 변화율)에서 뽑고, 적분해 행동 열 $A$를 만든다. 노이즈 분산은
입력 변화율의 물리적 한계에 맞춘다. 그러면 MPPI 유도를 그대로 지키면서 행동의 변화율에 비용을 걸 수 있다.

$$ a_t = a_{t-1} + u_t\, \Delta t, \qquad u_t = \bar u_t + \epsilon_t,\ \ \epsilon_t \sim \mathcal{N}(0, \Sigma) $$

**travplan 적용.** travplan은 비용 항(`ControlCost`)은 그대로 두고 노이즈 생성만 이 방식으로 바꿨다(`SmoothMPPIController`, 배경 0.2).

</details>

**travplan 실험(TP-0016, `scripts/exp_smppi.py`, 4 시나리오 × 3 seed, `results/exp_smppi.txt`).** SMPPI의 세 요소 가운데 변화율 비용과
가중평균의 매끄러움 보존은 travplan MPPI에 이미 있었다. 남은 차이는 "노이즈를 변화율 공간에서 뽑아 적분한다" 하나라서, 노이즈 생성만 바꾼
서브클래스로 비교했다(아래 이름은 당시 이름이고, `mppi3d`는 지금의 `mppi`다).

| 변형 | 성공 | 도달시간(s) | gt_cost | max pitch(°) | RMS jerk | 계획 ms |
|---|---|---|---|---|---|---|
| mppi3d (AR(1) ρ=0.7) | 12/12 | 15.5 | 0.024 | 4.3 | 6.7 | 5.1 |
| ar09 (AR(1) ρ=0.9) | 12/12 | 12.2 | 0.030 | 4.1 | 6.1 | 5.1 |
| **smppi_lite (적분 노이즈)** | 12/12 | 14.1 | **0.023** | 4.1 | **4.8** | 4.7 |

적분 노이즈는 **RMS jerk를 28% 줄였고, 12개 에피소드 모두에서 개선**됐다. 안전 지표(gt_cost, pitch)는 그대로이고 도달시간은 9% 짧아졌다.
ρ=0.9는 더 빠르지만 gt_cost가 25% 나빠진다(지형을 덜 피한다). 결론은 ==**비용 항은 그대로 두고 노이즈 모델만 바꾸면 된다**==는 것이다.

이를 `SmoothMPPIController`(`control/mppi/smooth.py`, TP-0021)로 정식 추가했다. 전체 벤치마크(`results/tp0021.log`, 분리 전 이름 기준)는
다음과 같다.

| 스택(당시 이름) | 성공 | 도달시간(s) | gt_cost | RMS jerk | 계획 ms |
|---|---|---|---|---|---|
| mppi3d | 12/12 | 15.5 | 0.024 | 6.7 | 5.1 |
| **mppi3d_smooth** | 12/12 | 14.1 | 0.023 | **4.8** | 4.8 |
| hybrid | 12/12 | 12.9 | 0.026 | 7.2 | 8.6 |
| **hybrid_smooth** | 12/12 | 13.3 | 0.025 | **5.2** | 7.9 |
| learned(참고) | 5/12 | 16.7 | 0.039 | 7.0 | 0.5 |

hybrid에서도 jerk가 28% 줄고 도달시간은 3% 늘었다. 기본 Controller는 바꾸지 않았다. Planner D도 같은 "변화율 공간"에서 궤적을 생성한다.

---

<!-- tab: 학습 동역학·적응 -->

## E. Controller — 학습 동역학과 추종 (참고)

==**travplan의 Controller(MPPI)는 개발 계획에서 빠져 있고 유지보수만 한다.**== 이 절은 Controller를 손봐야 할 때 볼 기록이다. 가장 그럴듯한
계기는 Isaac Sim이나 실물에서 슬립이 커져, 지금의 운동학 모델로는 로봇 움직임을 예측하지 못할 때다. 출처는 A.10과 같은
[Notion 블록](https://app.notion.com/p/geonhee-lee/VLA-E2E-Learning-based-planning-Mobile-robot-346c5d39343d80f18d74f6efac4cc40a#3e5c5d39343d8039bd36c32ec5418e7d)의
Taekyung Kim·Wonsuk Lee 계열 연구다. MPPI 샘플링 쪽 기록(SMPPI, ProxPI)은 §B.5에 있다.

이 계열이 바꾸는 것은 대부분 **MPPI가 미래를 굴려 보는 모델**이다.

```
travplan 지금                                    이 계열이 바꾸는 부분
Planner 궤적 ──▶ MPPIController ──▶ body twist    같은 MPPI 구조에서 rollout 모델을 학습 모델로 바꾼다
                 rollout = SwerveModel(운동학)     ├─ 지형 인지 운동 모델(6자유도, 접촉 추정)   RA-L 2023
                                                  ├─ 물리 + 신경망 차량 모델                  PENN
                                                  ├─ 확률 앙상블(불확실성) + 능동 탐색          RSS 2023
                                                  ├─ 잠재 문맥 온라인 적응                     RA-L 2026
                                                  └─ 같은 신경망으로 최적화 + 고속 추종          TOAST
```

**지형 인지 운동 모델 + MPPI**(*Learning Terrain-Aware Kinodynamic Model for Autonomous Off-Road Rally Driving With MPPI Control*,
[arXiv:2305.00676](https://arxiv.org/abs/2305.00676), RA-L 2023). proprioception과 지형 인식을 조건으로 6자유도 운동을 예측하고, 힘의 정답
없이도 접촉 상호작용을 추정하는 모델을 MPPI rollout에 넣는다. travplan `MPPIController`는 `SwerveModel`(평면 운동학)을 굴린 뒤
`terrain_attitude`로 자세만 지형에 투영한다. 이 논문은 그 자리를 학습 모델로 바꾼 사례다.

![Terrain-Aware Kinodynamic Fig. 1](https://arxiv.org/html/2305.00676v2/Fig_1.png)
*그림 — Terrain-Aware Kinodynamic MPPI (Fig. 1): MPPI 샘플 궤적과 최적 궤적. 지형 기하가 차량 운동에 미치는 영향을 예측해 위험한 궤적에 벌점을 준다. 출처: [arXiv:2305.00676](https://arxiv.org/abs/2305.00676)*

<details markdown="1">
<summary>자세히: 지형 인지 운동 모델 + MPPI의 방법과 수식</summary>

**상태.** 무게중심의 6자유도 proprioceptive 상태를 동역학 부분(몸체 선속도·각속도)과 운동학 부분(전역 위치·자세)으로 나눈다.

$$ x = [x^d;\ x^k], \qquad x^d = [v_x, v_y, v_z, \omega_x, \omega_y, \omega_z]^\top, \qquad x^k = [x, y, z, \psi, \theta, \phi]^\top $$

**모델은 세 부분이다.**
1. **높이 지도 인코더** $E_{\text{enc}}$: 로봇 주변 높이 지도 $M_t$를 CNN 3층 + 전결합 2층으로 지형 잠재 $h_t$로 만든다.
2. **동역학 예측망** $G_d$: 속도·제어 이력 $(x^d_{t-H+1:t},\ u_{t-H+1:t})$과 $h_t$로 **속도 변화**를 예측한다. **확률 앙상블**이라 각 구성원이 평균과 표준편차를 내고
   (우연 불확실성), 구성원끼리의 불일치로 인식 불확실성을 잰다.
3. **명시적 운동학 층**: 예측한 몸체 속도를 고정 좌표계로 돌려 위치·자세 변화를 해석적으로 적분한다. 학습할 필요가 없는 부분은 물리로 둔다.

$$ h_t = E_{\text{enc}}(M_t), \qquad \big(\hat\mu^d_{t+1}, \hat\sigma^d_{t+1}\big) = G_d\big(x^d_{t-H+1:t},\ u_{t-H+1:t},\ h_t\big) $$

힘의 정답 데이터 없이도 접촉 상호작용의 효과를 예측하고, MPPI는 이 모델을 굴려 지형 때문에 위험해지는 궤적(큰 roll·충격)을 벌한다.

**travplan에 주는 것.** travplan `MPPIController`는 평면 `SwerveModel`을 굴린 뒤 `terrain_attitude`로 자세만 지형에 투영한다. Isaac·실물에서 슬립이나 서스펜션 효과가
커지면, "학습 동역학 + 해석적 운동학 층" 구조로 rollout 모델을 바꿀 수 있다.

</details>

**물리 + 신경망 차량 모델(PENN)**([arXiv:2207.07920](https://arxiv.org/abs/2207.07920), Kim·Lee·Lee 2022). 미분 가능한 물리 모델에 신경망을
결합해, 순수 신경망보다 빨리 배우고 일반화가 좋다. 잠재 특징이 추가 학습 없이 횡방향 타이어 힘을 나타내므로 위험 인지 주행에 쓴다.

<details markdown="1">
<summary>자세히: PENN의 방법과 수식</summary>

**물리를 신경망의 마지막 층으로.** 동역학 자전거 모델(상태 $(v_x, v_y, r)$, 입력 $(\delta, v_{\text{des}})$)과 Pacejka 타이어 모델(magic formula)을 신경망의 마지막 은닉층으로
넣는다. 신경망 앞부분은 타이어 모델의 매개변수를 상황에 맞게 추정하고, 뒷부분은 물리식으로 가속을 계산한다.

$$ F_y = D \sin\!\Big(C \arctan\big(B\alpha - E\,(B\alpha - \arctan B\alpha)\big)\Big) $$

($\alpha$: 타이어 슬립각, $B, C, D, E$: 강성·형상·최대값·곡률 계수. Pacejka의 표준 형태다.)

**효과.** 순수 신경망보다 빨리 배우고, 정확하고, 일반화가 좋다. 또 forward 도중 나오는 중간 값이 **횡방향 타이어 힘**이라, 따로 학습하지 않고도 마찰 한계에
얼마나 가까운지를 알 수 있다. MPC는 이 잠재 특징을 힌트로 마찰을 모르는 노면에서 위험 인지 주행을 한다.

**travplan에 주는 것.** 스워브 모듈의 바퀴 슬립을 학습할 때 "물리 구조는 유지하고 계수만 학습"하는 방향의 참고다.

</details>

**불확실성을 아는 동역학과 능동 탐색**(*Bridging Active Exploration and Uncertainty-Aware Deployment*,
[arXiv:2305.12240](https://arxiv.org/abs/2305.12240), RSS 2023). 확률 앙상블 신경망으로 동역학을 배운다. 학습 때는 앙상블끼리 예측이
엇갈리는(Jensen-Rényi divergence가 큰) 곳을 일부러 탐색하고, 배포 때는 그 불확실성을 피한다. **탐색 쪽은 travplan TP-0022 E2(자기지도 라벨
수집 때의 탐색 정책)에 바로 쓸 수 있는 근거다.**

![Bridging Fig. 4](https://arxiv.org/html/2305.12240v2/Safe_compressed.png)
*그림 — Bridging (Fig. 4): 불확실성 인지 주행 결과. 궤적 위에 차량이 받은 회전 충격을 표시한다. 출처: [arXiv:2305.12240](https://arxiv.org/abs/2305.12240)*

<details markdown="1">
<summary>자세히: Bridging(능동 탐색 + 불확실성 인지 배포)의 방법과 수식</summary>

**확률 앙상블 신경망.** 구성원 $b$마다 가우시안을 낸다. 구성원 내부 분산은 우연 불확실성(노이즈), 구성원 사이의 차이는 인식 불확실성(데이터 부족)이다.

$$ E_b(x_t, u_t; \theta_b) = \mathcal{N}\big(\mu_{\theta_b}(x_t, u_t),\ \Sigma_{\theta_b}(x_t, u_t)\big), \qquad b = 1, \dots, B $$

**능동 탐색(학습 단계).** 앙상블 예측 분포들이 얼마나 엇갈리는지를 **Jensen-Rényi divergence**로 재고, 그 값이 큰(정보가 많은) 상태로 가도록 샘플링 MPC를 굴린다.
혼합의 엔트로피에서 구성원 엔트로피 평균을 뺀 값이라, 가우시안이면 닫힌 형태로 계산된다.

$$ \mathrm{JRD}\big(\{p_b\}\big) = H_2\Big(\frac{1}{B}\sum_b p_b\Big) - \frac{1}{B}\sum_b H_2(p_b) $$

**불확실성 인지 배포(사용 단계).** 같은 불확실성을 이번에는 **비용**으로 쓴다. 부드러운 벌점과 임계를 넘으면 버리는 강한 제약을 함께 둔다. 즉 한 모델로 "모르는
곳을 찾아가 배우기"와 "모르는 곳을 피하기"를 모두 한다.

**travplan에 주는 것.** TP-0022 E2(자기지도 라벨 수집 때의 탐색 정책)에 그대로 옮길 수 있다. TravNet 앙상블의 불일치가 큰 칸을 찾아가게 하면, 좋은 Planner가 피해
다녀 드물었던 "힘든 곳" 라벨을 모을 수 있다.

</details>

**잠재 문맥 온라인 적응**(*Guided Latent-Context Online Adaptation for Learned Vehicle Dynamics*, G. Park·W. Lee·F. C. Park, RA-L 2026).
학습한 동역학 모델을 잠재 문맥으로 현장에 맞춘다. 공개 arXiv 링크는 찾지 못했다([저자 Scholar](https://scholar.google.com/citations?user=olIJfeYAAAAJ&hl=ko)).

**TOAST**([arXiv:2201.08321](https://arxiv.org/abs/2201.08321), RA-L/IROS 2022). MPC가 쓰는 신경망 동역학을 그대로 써서 최적 추종 제어기를
만들고, MPC 갱신 주기보다 빠르게 외란을 보정한다. 기존 모델 기반 제어기에 덧붙이는 확장이다. travplan Controller 주기(지금 약 8 ms)가
모자라질 때의 구조 참고다.

<details markdown="1">
<summary>자세히: TOAST의 방법과 수식</summary>

**문제.** MPC(여기서는 SMPPI)는 계산이 무거워, 다음 명령을 계산하는 동안 같은 명령을 유지해야 한다. 그 사이의 외란이나 모델 오차는 보정되지 않는다.

**해법.** MPC가 쓰는 **같은 신경망 동역학**을 선형화해, MPC 명령을 기준으로 삼는 최적 피드백 추종 제어기를 만든다. MPC 명령을 방해하지 않고, 그 사이 시간의
오차를 더 빠른 주기로 줄인다. 새 오차 함수나 별도 신경망을 학습하지 않고 이득을 적응적으로 계산한다. 신경망에 이력 정보가 들어 있어 일반적인
$\dot x = f(x, u)$ 형태가 아니어도 된다.

$$ u_t = u^{\text{MPC}}_t + K_t\,\big(x^{\text{MPC}}_t - x_t\big), \qquad K_t:\ \text{신경망 동역학의 선형화로 구한 최적 이득} $$

(식은 구조를 보인 개념 형태다. 이득 계산은 논문을 따른다.)

**travplan에 주는 것.** travplan Controller는 10 Hz 재계획에 한 주기 약 8 ms라 지금은 여유가 있다. Orin에서 주기가 모자라면 "무거운 MPPI + 가벼운 고속 추종기"
2단 구조로 가는 참고다.

</details>

**SMPPI**(같은 저자, RA-L/IROS 2022)는 이미 `SmoothMPPIController`로 반영했다(TP-0021, §B.5).

**예측 점유를 안전 필터에 넣기 — Predictive Semantic Safety**(Kim et al. 2026, [프로젝트](https://www.taekyung.me/3e218d5c-31e3-8088-ac70-fee275314177)).
VLM이 RGB-D에서 "곧 떨어질 물체" 같은 물리 사건을 예측하고, conformal prediction으로 보정한 미래 점유로 바꾼 뒤, 백업 기동을 보존하는 QP 안전
필터로 명령을 최소한으로 고친다(MuJoCo 4족, 150회 중 149회 안전). §C의 CVaR-BF와 같은 저자 계열이고, 동적 장애물 예측을 안전 필터에 넣는 방식의
참고다.

Notion 블록에는 *Convex Optimization Based Robust Optimal Control for Autonomous Vehicle*(ICROS 2022) 발표 자료도 첨부돼 있다(공개 링크 없음).

| 연구 | Controller에서 바뀌는 부분 | travplan에서 쓸 때 |
|---|---|---|
| 지형 인지 운동 모델 (RA-L 2023) | rollout 모델 = 지형 조건 학습 6자유도 모델 | 슬립·충격이 커져 `SwerveModel`이 안 맞을 때 |
| PENN (2022) | 물리 + 신경망 하이브리드 차량 모델 | 같은 목적, 데이터가 적을 때 |
| Bridging (RSS 2023) | 앙상블 불확실성으로 탐색·회피 | **TP-0022 E2 탐색 정책** |
| Guided Latent-Context (RA-L 2026) | 학습 모델의 온라인 적응 | 실물 전이 단계 |
| TOAST (RA-L 2022) | 같은 신경망으로 고속 추종 | Controller 주기가 모자랄 때 |
| Predictive Semantic Safety (2026) | 예측 점유 → QP 안전 필터 | §C 안전 필터 후보 |

### E.2 학습 동역학과 온라인 적응의 마일스톤

**위 절의 연구들은 네 개의 마일스톤 위에 서 있다.** 불확실성을 아는 확률 앙상블 동역학(PETS, 2018), IMU로 지형 효과를 배우는 역운동
모델(IKD, 2021), 특권 정보를 잠재 벡터로 압축했다가 이력에서 추정하는 온라인 적응(RMA, 2021), 잠재 world model 안에서 MPPI로 계획하는
모델 기반 RL(TD-MPC2, 2023)이다.

| 연도 | 이름 | 핵심 | 이어지는 연구(위 절) | 코드(★) |
|---|---|---|---|---|
| 2018 | PETS | 확률 앙상블 동역학 + 궤적 샘플링 계획 | 확률 앙상블과 능동 탐색(RSS 2023) | — |
| 2021 | IKD | 관성 관측을 넣은 역운동 모델로 고속 오프로드 추종 | 지형 인지 운동 모델 + MPPI(RA-L 2023) | — |
| 2021 | RMA | 환경 요인을 잠재 벡터로, 배포 때는 최근 이력에서 추정 | 잠재 문맥 온라인 적응(RA-L 2026) | — |
| 2023 | TD-MPC2 | 디코더 없는 잠재 world model 안에서 MPPI 계획 | TOAST, 학습 동역학 MPPI 전반 | [nicklashansen/tdmpc2](https://github.com/nicklashansen/tdmpc2) 1.0k |

**PETS — 불확실성을 아는 동역학으로 계획한다**([arXiv:1805.12114](https://arxiv.org/abs/1805.12114), NeurIPS 2018, UC Berkeley). 모델
기반 RL은 샘플 효율이 좋지만, 큰 신경망 동역학은 모델 오차 때문에 최종 성능이 모델 없는 RL에 못 미쳤다. PETS는 출력 분포(평균과 분산)를
내는 확률 신경망 여러 개의 앙상블로 동역학을 학습한다. 분산은 데이터 자체의 잡음을, 앙상블 사이의 불일치는 데이터가 부족한 곳의 모델
불확실성을 나타낸다. 계획은 샘플 궤적을 앙상블로 전파해 CEM으로 행동을 고른다. half-cheetah에서 Soft Actor-Critic보다 8배, PPO보다
125배 적은 샘플로 비슷한 최종 성능에 이르렀다.

![PETS Fig. 1](https://arxiv.org/html/1805.12114v2/diagram.png)
*그림 — PETS (Fig. 1): 부트스트랩 앙상블 확률 동역학 모델과, 그 모델로 입자를 전파해 행동 열을 평가하는 궤적 샘플링 계획. 출처: [arXiv:1805.12114](https://arxiv.org/abs/1805.12114)*

**IKD — 관성 관측으로 지형 효과를 배운 역운동 모델**([arXiv:2102.12667](https://arxiv.org/abs/2102.12667), RA-L 2021, UT Austin). 비정형
지형을 빠르게 달리면 작은 지형 차이도 크게 증폭돼, 계획한 궤적대로 움직이지 않는다. IKD는 원하는 상태 변화(속도와 곡률)와 최근 IMU
관측을 넣으면, 그 변화를 실제로 만드는 제어 입력을 내는 역운동 모델을 데이터로 학습한다. 자갈 같은 지형이 고속에서 언더스티어를 만드는
효과를 IMU가 보여 주기 때문이다. 1/10 크기 차량으로 실외 트랙을 달려, 계획 실행 성공률을 52.4%에서 86.9%로 높였고 보지 못한 실내
바닥에서도 효과가 유지됐다.

**RMA — 환경을 잠재 벡터로 압축하고, 배포 때는 이력에서 추정한다**([arXiv:2107.04034](https://arxiv.org/abs/2107.04034), RSS 2021, UC
Berkeley·CMU). 시뮬레이션에서는 마찰, 하중, 모터 세기 같은 환경 요인을 안다. RMA는 이 특권 정보를 인코더로 잠재 벡터(extrinsics)로 줄여
기본 보행 정책에 넣고 RL로 학습한다. 두 번째 단계에서 적응 모듈이 최근 상태·행동 이력만으로 같은 잠재 벡터를 추정하도록 지도 학습한다.
배포 때 적응 모듈은 10 Hz, 기본 정책은 100 Hz로 따로 돌아, 저가형 A1 로봇에서도 1초 안쪽으로 새 지형과 하중에 적응했다. 시뮬레이션에서만
학습하고 미세조정 없이 바위, 미끄러운 바닥, 모래, 계단에 배포했다.

![RMA Fig. 1](https://arxiv.org/html/2107.04034v1/rma-method-1.png)
*그림 — RMA (Fig. 1): 1단계에서 특권 환경 요인을 잠재 벡터로 압축해 기본 정책을 학습하고, 2단계에서 적응 모듈이 상태·행동 이력으로 그 벡터를 추정한다. 배포 때 적응 모듈은 10 Hz, 정책은 100 Hz로 돈다. 출처: [arXiv:2107.04034](https://arxiv.org/abs/2107.04034)*

**TD-MPC2 — 잠재 world model 안에서 MPPI로 계획한다**([arXiv:2310.16828](https://arxiv.org/abs/2310.16828), ICLR 2024, UC San Diego).
관측을 복원하는 디코더 없이, 보상과 가치 예측에 필요한 것만 담는 잠재 상태를 학습한다. 잠재 동역학, 보상, Q 함수, 정책 prior를 함께
학습하고, 행동은 잠재 공간에서 MPPI로 짧게 계획한 뒤 지평 너머는 학습한 가치로 잇는다. 4개 도메인 104개 과제에서 하이퍼파라미터 한
벌로 기준선을 크게 앞섰고, 3.17억 파라미터 에이전트 하나가 여러 몸체와 행동 공간의 80개 과제를 수행했다. 모델과 데이터를 키울수록
능력이 늘었다.

![TD-MPC2 Fig. 3](https://arxiv.org/html/2310.16828v2/tdmpc2.png)
*그림 — TD-MPC2 (Fig. 3): 관측을 정규화된 잠재 상태로 인코딩하고, 잠재 동역학으로 반복 예측하면서 스텝마다 보상, Q 값, 행동을 예측한다. 출처: [arXiv:2310.16828](https://arxiv.org/abs/2310.16828)*

<details markdown="1">
<summary>자세히: 확률 앙상블, 잠재 적응, 잠재 공간 계획의 수식</summary>

**PETS의 확률 앙상블.** 앙상블 멤버 $b = 1, \dots, B$가 각각 다음 상태의 가우시안을 낸다. 계획할 때는 입자마다 멤버 하나를 골라 전파해
두 불확실성을 함께 반영한다.

$$ \tilde f_{\theta_b}(\mathbf s_t, \mathbf a_t) = \mathcal N\big(\mu_{\theta_b}(\mathbf s_t, \mathbf a_t),\ \Sigma_{\theta_b}(\mathbf s_t, \mathbf a_t)\big), \qquad \mathcal L(\theta_b) = \sum_n \big[\mu - \mathbf s_{n+1}\big]^\top \Sigma^{-1} \big[\mu - \mathbf s_{n+1}\big] + \log\det \Sigma $$

손실은 가우시안 음의 로그 우도라, 배경 0.8의 heteroscedastic 회귀와 같은 형태다.

**IKD의 역운동 모델.** 순운동 $\dot x = f(x, u, w)$에서 지형 상태 $w$는 보이지 않는다. IKD는 원하는 상태 변화 $\Delta x$와 관성 관측 $y$에서
제어를 바로 내는 $u = f^+_\theta(\Delta x, y)$를 학습한다. 목표는 주행 시간과 계획 추종 오차의 합을 줄이는 것이다.

$$ J = T + \gamma \int_0^T \lVert x(t) - x_\Pi(t) \rVert^2\, dt $$

**RMA의 두 단계.** 1단계는 환경 요인 $e_t$를 인코더 $\mu$로 줄인 $z_t = \mu(e_t)$를 정책 $a_t = \pi(x_t, a_{t-1}, z_t)$에 넣고 RL로 학습한다.
2단계는 적응 모듈 $\phi$가 최근 이력에서 $\hat z_t$를 추정하도록 회귀한다.

$$ \hat z_t = \phi\big(x_{t-k:t-1},\ a_{t-k:t-1}\big), \qquad \min_\phi \lVert \hat z_t - z_t \rVert^2 $$

**TD-MPC2의 계획.** 잠재 상태 $\mathbf z$에서 지평 $H$ 동안 보상을 더하고 끝에 Q 값을 붙인 목적을 MPPI로 최대화한다.

$$ \max_{\mathbf a_{0:H}} \ \mathbb E\Big[\gamma^H Q(\mathbf z_H, \mathbf a_H) + \sum_{t=0}^{H-1} \gamma^t R(\mathbf z_t, \mathbf a_t)\Big], \qquad \mathbf z_{t+1} = d(\mathbf z_t, \mathbf a_t) $$

**travplan에 주는 것.** travplan Controller는 지금 `SwerveModel`(운동학)을 굴린다. Isaac Sim이나 실물에서 슬립이 커지면 바꿀 순서는
이렇다. 먼저 IKD처럼 명령과 실제 움직임의 차이를 IMU·odometry로 보정하는 작은 역모델을 추종 층에 넣는다. 그다음 PETS식 앙상블로
불확실성을 재서 MPPI 비용에 넣는다. RMA식 잠재 적응은 지형과 하중이 자주 바뀔 때의 마지막 단계다. 모두 `MPPIController`의 최적화기를
바꾸지 않고 rollout 모델과 `CostTerm`만 바꾼다.

</details>

### E.3 동역학 모델을 상태 추정에 넣어 외란을 읽는다

**HDVIO2.0 — 물리 모델 위에 신경망 잔차를 얹은 6자유도 동역학을 VIO 최적화에 넣는다**([arXiv:2504.00969](https://arxiv.org/abs/2504.00969),
T-RO 2025, UZH RPG, [코드](https://github.com/uzh-rpg/hdvio2.0) GPL-3.0, ★0.1k). 앞 절들은 학습 동역학을 MPPI rollout에 넣었다. 이 연구는
같은 종류의 모델을 반대쪽, 상태 추정에 넣는다. ==힘 정답 없이 위치·속도·자세만으로 잔차 동역학을 학습하고, 모델이 예측한 움직임과 실제
움직임의 차이를 외력 상태로 추정한다.==

**동작 방식.** 병진은 점질량, 회전은 강체라는 단순한 물리 모델이 대부분을 설명한다. 신경망은 그 위의 잔차만 맡는다. 시간 합성곱
신경망(TCN) 두 개가 각각 잔차 추력과 잔차 토크를 낸다. 입력은 추력·토크 명령과 자이로 측정의 최근 100 ms(100 Hz이므로 신호마다 10개)다.
전체 차량 상태를 알 필요가 없다는 것이 요점이다. 외력은 가우시안 확률 변수로 두고, 자세·속도·IMU bias와 함께 슬라이딩 윈도 최적화에서
같이 푼다. 그래서 바람 같은 연속 외란이 상태 추정의 부산물로 나온다.

![HDVIO2.0 Fig. 1](https://arxiv.org/html/2504.00969v2/eyecatcher.png)
*그림 — HDVIO2.0 (Fig. 1): 영상·관성 측정에 동역학 측정을 더해 로봇 상태와 외란을 함께 추정한다. 동역학은 단순 물리 모델과 학습 요소를 합친 것이다. 출처: [arXiv:2504.00969](https://arxiv.org/abs/2504.00969)*

**결과.** NeuroBEM 고속 비행 데이터에서 힘 예측 오차가 BEM 0.982 N에서 0.491 N으로 절반이 됐다. Blackbird 자세 추정에서 절대 궤적
오차가 VIO 대비 Egg 8 m/s에서 1.79 m → 0.77 m, Mouse 5 m/s에서 1.10 m → 0.22 m다. 산업용 팬 세 대로 최대 25 km/h 바람을 만든
실험에서 외력 추정 오차는 원 궤적 기준 VIMO 0.62 N 대 0.51 N이다. TCN 추론은 Jetson TX2에서 약 180 Hz다. **학습에 힘 정답이 필요 없다.**
바람 없이 무작위 궤적을 10분쯤 날린 로그의 위치·속도·자세만 있으면 된다.

<details markdown="1">
<summary>자세히: 잔차 동역학과 최적화에 들어가는 동역학 항</summary>

**하이브리드 동역학.** 추력 $\mathbf f_t$와 토크 $\boldsymbol\tau$는 명령에서 오고, 학습 잔차 $\mathbf f_{\text{res}}$, $\boldsymbol\tau_{\text{res}}$가 모델이 설명하지 못하는
공기역학을 메운다. $\mathbf f_e$는 추정할 외력이다.

$$ \dot{\mathbf v} = R\big(\mathbf f_t + \mathbf f_{\text{res}} + \mathbf f_e\big) + \mathbf g, \qquad \dot{\boldsymbol\omega} = J^{-1}\big(\boldsymbol\tau + \boldsymbol\tau_{\text{res}} - \boldsymbol\omega \times J \boldsymbol\omega\big) $$

**신경망.** TCN은 64필터 4층에 128필터 3층을 쌓고 선형층으로 3차원 벡터를 낸다. 입력은 명령과 자이로의 최근 100 ms다. 각속도는
5차 B-spline(제어점 10개, $\Delta t = 0.01$ s)으로 연속 함수로 두어, 이산 IMU 샘플 사이에서도 회전 동역학을 적분한다.

**최적화 항.** 슬라이딩 윈도 factor graph에 동역학 잔차 $\mathbf e_d^k$를 넣는다. 사전적분한 위치·속도·자세 증분 $(\alpha, \beta, \gamma)$과 동역학
모델이 예측한 증분의 차이, 그리고 외력의 시간 변화로 이루어진다.

$$ \mathbf e_d^k = \big[\alpha - \hat\alpha,\ \beta - \hat\beta,\ \gamma - \hat\gamma,\ \mathbf f_e^{k+1} - \hat{\mathbf f}_e^{k+1}\big] $$

**라벨 없는 학습.** 힘 정답을 재려면 별도 장비가 필요하다. 이 연구는 그 대신 SLAM이나 모션 캡처로 얻은 위치·속도·자세만 지도 신호로
쓴다. 모델이 예측한 궤적이 관측한 궤적과 맞도록 잔차를 학습하므로, 로봇을 날린 로그가 곧 학습 데이터다.

**travplan에 주는 것.** travplan Controller의 rollout은 `SwerveModel`(평면 운동학)이고, 지형이 미는 힘이나 슬립은 모델에 없다. 이 구조를
옮기면 `SwerveModel`이 물리 부분, 작은 신경망이 잔차 부분을 맡고, 남는 차이를 외란 상태로 추정하게 된다. 학습 라벨은 주행 로그의
자세·속도면 되므로 Isaac Sim 폐루프(TP-0005)나 실물 로그에서 바로 얻는다.

</details>

**travplan에 주는 의미.** E.2의 순서(IKD, PETS, RMA)는 모두 제어기 쪽 모델을 바꾸는 이야기였다. HDVIO2.0이 더하는 것은 두 가지다.
첫째, 학습을 잔차로 한정하는 구조다. 물리 모델이 대부분을 설명하니 신경망이 작아도 되고, 그래서 Jetson TX2에서 180 Hz가 나온다.
travplan의 Orin 예산에 그대로 들어간다. 둘째, 라벨 없이 학습하는 방법이다. 슬립이나 지형 반력의 정답을 따로 잴 필요 없이 주행 로그의
자세·속도만 있으면 된다. 순서는 L0 충실도 항목을 먼저 넣는 것이다. 슬립 무작위화(TP-0033)와 스워브 모듈 모델(TP-0034)로 설명되는
부분을 물리 모델에 넣고, 그러고도 남는 차이를 잔차로 흡수한다. 다만 대상이 쿼드로터 공기역학이고 코드가 GPL-3.0이라, 구조와 학습
방식만 참고한다.

### E.4 반복되는 외란을 잠재 조건으로 기억한다

**Continual Robot Policy Learning via Variational Neural Dynamics**([arXiv:2606.27353](https://arxiv.org/abs/2606.27353), 2026-06,
UZH RPG, 코드 공개 미표기). 앞 절이 외란을 상태로 **읽는** 쪽이라면, 이쪽은 겪어 본 조건을 **기억해** 정책을 미리 대비시킨다.
==온라인으로 잔차를 다시 맞추는 대신 조건을 잠재 벡터로 남겨, 같은 바람이 돌아오면 다시 배우지 않는다.==

**동작 방식.** 동역학은 HDVIO2.0과 같은 꼴이다. 강체 물리 prior에 신경망 잔차를 더하되, 잔차가 잠재 조건 $z$를 함께 받는다.
$z$는 GRU 인코더가 최근 0.4초(50 Hz로 20스텝)의 상태·행동 이력에서 추정하는 12차원 벡터다. 정책은 미분 가능 시뮬레이션에서
학습한다. 인코더와 잔차를 얼린 뒤 병렬 환경마다 $z$를 prior에서 뽑아 굴리고, 지평 250스텝을 BPTT로 역전파한다. 배포 때는 뽑은 $z$를
인코더 출력으로 바꾸기만 하면 되므로 정책 인터페이스가 같다. **continual은 재생 버퍼에 있다.** 실제 주행 전이를 쌓아 두고, 잠재
모델을 갱신할 때마다 버퍼 전체를 다시 인코딩해 좌표계를 맞춘다. 그래서 잠재가 표류하지 않고, 지난번에 겪은 조건을 알아본다.

![Continual VND Fig. 1](https://arxiv.org/html/2606.27353v1/overview.png)
*그림 — Continual VND (Fig. 1): 실제 궤적에서 잠재 조건부 잔차 동역학을 배우고, prior에서 뽑은 잠재로 병렬 미분 가능 시뮬 정책 학습을 돌린다. 출처: [arXiv:2606.27353](https://arxiv.org/abs/2606.27353)*

**결과.** Agilicious 쿼드로터, 제어 50 Hz다. 큰 외란에서 호버 오차가 0.105 m에서 0.036 m로(−65.7%), 추종 오차가 0.137 m에서
0.064 m로(−53.3%) 줄었다(온라인 잔차 재적합 LOTF 대비). 반복되는 바람에서 회복은 약 5배 빠르다(약 11초 대 55초). 8자 궤적 추종
오차는 지속 갱신으로 41 cm에서 9 cm가 됐다. 프로펠러를 자른 고장에서도 갱신 두 번 만에 52 → 24 → 12 cm로 적응했다. 기준선은
L1-MPC, RMA, DATT, LOTF, 시험 조건으로 학습한 oracle이다.

<details markdown="1">
<summary>자세히: 잠재 조건부 잔차와 VAE가 아닌 이유</summary>

**잠재 조건부 잔차.** 물리 prior $f_{\text{prior}}$는 외란 없는 강체 동역학을 RK4로 적분한다. 잔차 $D_\psi$는 FiLM으로 변조되는 MLP이고,
위치·속도·회전 벡터 보정을 낸다. 회전 잔차는 지수 사상으로 합성해 회전 다양체 위에 머문다.

$$ \hat{\mathbf s}_{t+1} = f_{\text{prior}}(\mathbf s_t, \mathbf a_t) + D_\psi(\mathbf s_t, \mathbf a_t, \mathbf z_t), \qquad \mathbf z_t = E_\phi\big(\{(\mathbf s_i, \mathbf a_i)\}_{i=t-C}^{t-1}\big) $$

**VAE가 아니다.** 표본마다 KL을 걸거나 궤적을 복원하지 않는다. 인코더가 만드는 분포 전체를 최대 평균 불일치(MMD)로 표준 정규
분포에 맞출 뿐이다. 잠재는 잔차 예측 손실에서 정보를 얻고, MMD는 prior에서 뽑은 $\mathbf z$가 현실적인 동역학을 만들도록 보장한다.
정책 학습이 $\mathbf z \sim \mathcal N(0, I)$ 샘플에 의존하므로 이 보장이 필요하다.

$$ \mathcal L = \mathcal L_{\text{dyn}} + \lambda_{\text{rec}} \mathcal L_{\text{rec}} + \lambda_{\text{mmd}}\, \mathrm{MMD}\big(q_\phi(\mathbf z),\ \mathcal N(0, I)\big) $$

**정책 목적.** 얼린 동역학 위에서 환경마다 $\mathbf z$를 하나 뽑아 지평 $H = 250$을 굴리고 BPTT로 미분한다.

$$ \max_\theta\ \mathbb E_{\mathbf z \sim \mathcal N(0,I)} \Big[ \sum_{t=0}^{H-1} \gamma^t\, r\big(\mathbf s_t,\ \pi_\theta(\bar{\mathbf o}_t, \mathbf z),\ \mathbf s_{t+1}\big) \Big] $$

**travplan에 주는 것.** 잠재가 무엇을 잡았는지 확인 가능하다는 점이 쓸모 있다. 학습된 잠재는 바람의 방향과 세기별로 군집을 이뤘다.
travplan에서 같은 분석을 하면 노면 조건이 잠재로 분리되는지 볼 수 있다.

</details>

**travplan에 주는 의미.** E.2의 RMA가 "환경 요인을 잠재로 압축하고 배포 때는 이력에서 추정한다"였다. 이 연구는 두 가지를 더한다.
잠재를 정책뿐 아니라 **잔차 동역학에도** 조건으로 주고, 배포 로그를 쌓아 같은 조건이 돌아오면 재학습 없이 알아본다. 배달로봇에서
반복되는 숨은 조건은 바람이 아니라 노면과 하중이다. 젖은 보도, 자갈, 무거운 화물은 같은 구간을 반복 주행하는 동안 계속 돌아온다.
구조가 맞는다. 다만 전제가 걸린다. 정책 학습이 **미분 가능 시뮬레이션**을 요구하는데 travplan L0(`KinematicSim`)은 미분 가능하지
않고, TP-0066은 PPO/GRPO로 가기로 했다. 그래서 현실적인 1단계는 잠재 조건 인코더만 떼어 Controller의 rollout 모델이나 Planner D의
조건 입력으로 넣고, 노면 조건이 실제로 군집되는지 보는 것이다. E.3과 묶으면 역할이 갈린다. HDVIO2.0은 지금 받는 외란을 상태로
추정해 읽고, 이 연구는 겪어 본 조건을 기억해 미리 대비한다.

### E.5 모르는 것 위에서의 보장: 학습 MPC의 세 갈래

**Melanie Zeilinger(ETH Zürich)의 MIT Robotics 세미나 "Learning for Complex Control Systems — Guarantees in the Unknown"
(2026-04-10, [영상](https://www.youtube.com/watch?v=tfDv32K5Pmo))을 계기로 그 그룹의 연구를 정리했다.** 강연 초록과 자막은 확보하지
못했으므로, 아래는 같은 그룹이 낸 논문으로 재구성한 것이다. E.3과 E.4가 "잔차를 어떻게 배우나"였다면, 이 절은 **배운 모델 위에서 어떻게
보장을 만드나**다.

**세 갈래로 나뉜다.** 이 그룹의 개관 논문이 학습 MPC 연구를 셋으로 가른다([Annual Review of Control, Robotics, and Autonomous Systems
3:269–296, 2020](https://www.annualreviews.org/content/journals/10.1146/annurev-control-090419-075625), Hewing·Wabersich·Menner·Zeilinger).

| 갈래 | 무엇을 학습하나 | travplan의 위치 |
|---|---|---|
| 1 | 기록한 데이터로 **예측 모델**을 자동 개선한다 | E.2(IKD, PETS, RMA), E.3(HDVIO2.0), E.4(잠재 조건) |
| 2 | 폐루프 성능이 가장 좋은 **MPC 파라미터화**(비용·제약)를 추론한다 | ==아직 손대지 않은 축== |
| 3 | MPC로 학습 제어기에 **제약 만족**을 덧붙인다 | C.4 예측 안전 필터 |

**Cautious MPC — 잔차의 불확실성으로 제약을 조인다**([arXiv:1705.10702](https://arxiv.org/abs/1705.10702), Hewing·Kabzan·Zeilinger,
IEEE TCST). 이름 있는 모델에 가우시안 과정(GP)으로 모델링한 비선형 잔차를 더한다. 여기까지는 E.3의 HDVIO2.0과 같은 구조다. 다른 점은
**GP가 잔차의 불확실성을 함께 내고, 그것을 예측 지평 위로 전파해 확률 제약(chance constraint)으로 바꾼다**는 것이다. 모델이 자신 없는
영역에서는 제약이 저절로 조여져 제어가 조심스러워진다. 상태 분포 전파는 근사로 처리하고, 원격조종 경주용 차 실물에서 성능과 안전이
**함께** 올랐다.

**예측 제어 barrier 함수(PCBF) — 예측 안전 필터가 실행 불가능해지는 순간을 없앤다**([arXiv:2105.10241](https://arxiv.org/abs/2105.10241),
Wabersich·Zeilinger, 2021–2022). C.4의 예측 안전 필터는 "안전한 입력열이 존재하는가"를 묻는데, 존재하지 않으면 최적화가 실행 불가능해지고
그때 무엇을 할지가 비어 있다. PCBF는 **항상 실행 가능한 소프트 제약 보조 문제**를 두고, 그 해가 원래 필터의 실행 가능 집합을 점근적으로
안정화하게 만든다. 안전 영역 밖으로 밀려나도 돌아오는 **회복 장치**가 생긴다. 실행 가능성은 제약 조이기와 종단 barrier 함수로 보장하고,
제약마다 손으로 $h$를 설계할 필요가 없다.

<details markdown="1">
<summary>자세히: 확률 제약으로 조이기와 PCBF의 실행 가능성</summary>

**GP 잔차.** 이름 있는 모델 $f$에 잔차 $g$를 더하고, $g$를 GP로 둔다. 상태 $x_k$가 분포로 퍼지므로 예측 지평 위에서 평균과 공분산을 함께 굴린다.

$$ x_{k+1} = f(x_k, u_k) + g(x_k, u_k), \qquad g \sim \mathcal{GP}\big(\mu(x,u),\ \Sigma(x,u)\big) $$

**확률 제약.** 결정론적 제약 $h^\top x \le b$를 만족 확률로 바꾸면, 평균에 대한 제약을 표준편차만큼 조인 형태가 된다. $\Phi^{-1}$은 정규 분포의
분위수다. 모델이 자신 없는 곳(큰 $\Sigma_k$)에서 여유가 커진다.

$$ \Pr\big(h^\top x_k \le b\big) \ge 1 - \epsilon \quad \Longleftrightarrow \quad h^\top \mu_k \le b - \Phi^{-1}(1-\epsilon)\sqrt{h^\top \Sigma_k h} $$

**PCBF.** 예측 안전 필터(C.4)는 종단 제약 $x_N \in \mathcal S_f$를 딱딱하게 걸어 실행 불가능해질 수 있다. PCBF는 제약 위반량 $\xi_k \ge 0$을
변수로 올려 항상 해가 있게 하고, 그 위반량에 벌점을 주면서 종단에 barrier 함수를 둔다. 최적 위반량의 합이 barrier 함수 역할을 해,
집합 밖에서 안으로 끌어당긴다.

$$ \min_{u_{0:N-1},\,\xi_{0:N}} \sum_k \ell_\xi(\xi_k) + \lVert u_0 - u_L \rVert^2 \quad \text{s.t.}\quad x_k \in \mathcal X \oplus \xi_k,\ \ u_k \in \mathcal U,\ \ x_N \in \mathcal S_f \oplus \xi_N $$

**travplan에 주는 것.** travplan Controller의 rollout은 `SwerveModel`이고 불확실성이 없다. TravMap의 σ 채널은 있지만 `RiskCost`의 부드러운
비용으로만 쓰인다. 위 확률 제약은 σ를 **제약을 조이는 양**으로 바꾸는 방법이다. MPPI는 제약을 벌점으로 다루므로 그대로 옮기려면
벌점 문턱을 σ에 따라 움직이게 하는 형태가 된다.

</details>

**travplan에 주는 의미.** ==travplan Controller는 세 갈래 가운데 첫째만 건드리고 있고, 둘째는 아예 비어 있다.== 순서를 이렇게 본다.
첫째, 잔차에 **불확실성을 붙인다.** E.3의 HDVIO2.0은 잔차를 배우지만 얼마나 믿을지를 내지 않는다. E.2의 PETS식 앙상블이나 여기의 GP로
바꾸면 그 값이 나온다. 둘째, 그 불확실성과 TravMap의 σ로 **비용이 아니라 제약을 조인다.** 지금 σ는 `RiskCost`의 한 항일 뿐이어서, 지도가
못 본 곳을 지날 때 제어가 더 조심스러워지지 않는다. 셋째, C.4에 적은 예측 안전 필터를 얹되 **PCBF의 회복 장치까지** 가져온다.
travplan에서 안전 대체 정책은 Planner D의 이전 계획이나 GuidancePlanner 경로이고, 필터가 실행 불가능해지는 상황은 가림으로 치명 링이
갑자기 나타날 때(TP-0047, TP-0067)다. 그때 "돌아올 방향"을 주는 것이 PCBF의 몫이다.

둘째 갈래도 값이 있다. travplan의 MPPI 비용 가중치는 지금 손으로 정한다. 폐루프 성능에서 가중치를 추론하는 방법은 벤치마크가 이미
자동화돼 있으므로(`scripts/run_benchmark.py`) 붙이기 쉽다. 다만 MPPI는 개발 계획에서 빠져 있으므로(§E 머리말) 지금은 기록만 해 둔다.
이 갈래를 실제 코드로 어떻게 돌리는지는 E.6이다. 셋째 갈래를 Planner 쪽에서 푸는 길(생성 과정 안에 barrier를 넣기)은 Planner 문서
B.8.2에 있다.


### E.6 이 계보의 공개 코드와, travplan이 실제로 가져올 것

**E.5가 논문이라면 이 절은 돌릴 수 있는 코드다.** 같은 그룹이 도구 셋을 공개해 뒀는데 travplan 적합도가 확연히 다르다. 그래서 여기에는
**넣지 않기로 한 것과 그 이유**도 같이 적는다.

| 도구 | 무엇인가 | travplan 적합도 |
|---|---|---|
| [l4acados](https://github.com/IntelligentControlSystems/l4acados) | 실시간 SQP 솔버 acados에 Python 학습 모델(GP·신경망)을 잔차로 꽂는 틀. 외부 sensitivity를 Python 모듈로 넘기고 Jacobian 근사·병렬화를 지원 | ==낮음== — Controller가 MPPI(샘플링)라 Jacobian 자체를 안 쓴다 |
| [ampyc](https://github.com/IntelligentControlSystems/ampyc) | 강건·확률 MPC를 Python으로 정리한 교육용 구현 모음 | 중간 — 제약 조이기를 구현할 때 읽을 코드 |
| [bayesopt4ros](https://github.com/IntelligentControlSystems/bayesopt4ros) | ROS 공식 배포판에 올라간 베이즈 최적화 노드 | ==높음== — 손으로 맞추는 문턱값이 지금도 많다 |

**bayesopt4ros — E.5에서 비어 있다고 적은 둘째 갈래가 여기 있다.** 이 그룹은 MPC 파라미터 추론을 베이즈 최적화로 구현한다. 문맥 베이즈
최적화로 차량 동역학 학습과 MPC 파라미터 튜닝을 함께 돌린 연구가 1:28 경주차에서 **3,000랩 넘게** 실측됐다
([arXiv:2110.02710](https://arxiv.org/abs/2110.02710), IROS 2022, Fröhlich·Küttel·Arcari·Hewing·Zeilinger·Carron). 여기서 "문맥"은 학습한
동역학 모델이 인코딩한 환경 조건이고, 조건이 바뀌어도 이전 조건의 데이터를 재사용해 적은 시행으로 랩타임을 줄인다.

**travplan에서 이게 지금 값이 있는 이유.** ==TP-0067에서 `shadow_depth_m`·`shadow_evidence_m`·`shadow_margin_m`을 손으로 맞췄다.== 규칙
설계를 네 번 실패하고 다섯 번째에 통과했는데, 그 과정은 전부 사람이 후보를 내고 벤치마크를 돌린 것이다. travplan은 폐루프 평가가 이미
자동화돼 있어(`scripts/run_benchmark.py`, `scripts/eval_shadow_false_alarm.py`) 목적 함수가 준비돼 있다. 붙일 자리는 MPPI 가중치가
아니라 **`TravMapBuilder`의 문턱값들**이다(MPPI는 개발 계획 제외, §E 머리말). 문맥은 시나리오(내리막 연석·포트홀·배수로)로 두면 된다.
다만 성공률은 12/12처럼 이산적이고 잡음이 커서 목적 함수로 나쁘다. 오탐 셀 수와 치명 recall처럼 연속인 대리 지표를 써야 한다.

**l4acados·zero-order — 지금 쓸 것은 아니지만 길목을 표시해 둔다.** GP 잔차를 MPC에 넣으면 매 스텝 GP 추론과 그 Jacobian이 필요해
실시간이 어렵다. zero-order 근사는 **분산은 제약 조이기에 그대로 쓰되 Jacobian 기여만 떨어뜨려** SQP 반복을 싸게 만든다
([arXiv:2211.15522](https://arxiv.org/abs/2211.15522), European Journal of Control 74, 2023). l4acados는 이것을 acados 위에 일반화한
오픈소스다([arXiv:2411.19258](https://arxiv.org/abs/2411.19258), IEEE TCST). travplan Controller는 기울기를 안 쓰므로 이 가속 자체는
필요 없다. 의미는 다른 데 있다 — **E.5가 말한 "잔차에 불확실성을 붙이고 그것으로 제약을 조인다"가 실물에서 도는 형태로 공개돼 있다**는
것이다. MPPI를 유지하는 한 옮겨올 것은 분산 전파와 제약 조이기 공식이지 솔버가 아니다.

<details markdown="1">
<summary>자세히: zero-order 근사와 베이즈 최적화의 목적 함수</summary>

**zero-order 근사.** GP-MPC는 평균 $\mu_k$와 공분산 $\Sigma_k$를 함께 굴리는데, $\Sigma_k$가 평균 궤적에 의존하므로 SQP의 Jacobian에
$\partial \Sigma / \partial x$가 들어가 비용이 커진다. 이 항만 버리고 $\Sigma$는 **이전 반복의 궤적에서 고정**한 값 $\bar\Sigma_k$로 쓴다.
제약 조이기는 그대로 남으므로 보수성은 유지되고, 반복 한 번이 크게 싸진다.

$$ h^\top \mu_k \le b - \Phi^{-1}(1-\epsilon)\sqrt{h^\top \bar{\Sigma}_k h}, \qquad \bar{\Sigma}_k = \Sigma_k(\bar{x}_{0:k})\ \text{(이전 반복에서 고정)} $$

**문맥 베이즈 최적화.** 파라미터 $\theta$와 문맥 $c$에 대한 폐루프 성능 $f(\theta, c)$를 GP로 모델링하고, 획득 함수로 다음 시행을 고른다.
문맥을 입력에 넣었기 때문에 조건이 달라져도 이전 데이터가 사전 정보로 남는다.

$$ f \sim \mathcal{GP}\big(m(\theta, c),\ k\big((\theta,c), (\theta',c')\big)\big), \qquad \theta^\star(c) = \arg\max_\theta\ \mu_f(\theta, c) + \kappa\, \sigma_f(\theta, c) $$

**travplan 대입.** $\theta = (\texttt{shadow\_depth\_m},\ \texttt{shadow\_evidence\_m},\ \texttt{shadow\_margin\_m})$, $c$는 시나리오,
$f$는 `eval_shadow_false_alarm.py`의 (오탐 셀 수, 치명 recall) 가중합. 시행 하나가 4 시나리오 × 3 seed라 수십 분이므로, 시행 예산이
작은 베이즈 최적화가 격자 탐색보다 맞는 도구다.

</details>

**넣지 않은 것과 이유.** 목록에 있던 나머지는 확인은 했지만 문서에 절을 주지 않았다.

- **강건 MPC의 system level synthesis·외란 피드백 계열**(Leeman 외, [IEEE TAC 2025](https://arxiv.org/abs/2301.04943);
  [arXiv:2509.18760](https://arxiv.org/abs/2509.18760), ICRA 2026, [코드](https://github.com/antoineleeman/robust-nonlinear-mpc)).
  명목 모델·외란 피드백 이득·모델 오차 상한을 순차 볼록 계획으로 함께 최적화해 강건 제약 만족과 재귀 실행 가능성을 보장한다. 이론은
  좋지만 **MPPI를 버려야 들어온다.** 그리고 ==travplan의 주된 불확실성은 동역학의 외란이 아니라 지각이다== — 못 본 셀, 가림이 만든 그림자,
  지도의 σ다. 이 그룹의 장치들은 외란 쪽에 맞춰져 있어 옮길 때 대응이 1:1이 아니다.
- **안전 탐색 계열**(Koller·Berkenkamp·Turchetta·Zeilinger, [arXiv:1906.12189](https://arxiv.org/abs/1906.12189); Prajapat 외,
  [arXiv:2402.06562](https://arxiv.org/abs/2402.06562)). 실물에서 동역학을 탐색하며 배우는 설정이다. travplan은 시뮬에서 학습하고 실물
  온라인 학습 계획이 없어(PRD P1) 지금은 쓸 자리가 없다. 다만 "탐색해도 되는 영역을 불확실성으로 정한다"는 발상은 L1 인식 루프에서 미관측
  영역을 다룰 때 다시 볼 값이 있다.

**출처를 바로잡은 것.** 받은 목록에 서지가 어긋난 항목이 셋 있었다.

1. "Annual Reviews 2024, Carron 외, *Learning-based MPC: Toward Safe and Efficient Real-World Autonomy*"는 찾지 못했다. 확인되는 것은
   Hewing·Wabersich·Menner·Zeilinger, *Toward Safe Learning in Control*, Annual Review 2020이고 **E.5가 이미 그 논문**이다.
2. "ECC 2023 zero-order"는 European Journal of Control 74(2023) 게재분이다. "TCST 2025 Zero-Order Approximations"의 저자 목록
   (Lahr·Näf·Wabersich·Frey·Carron·Diehl·Zeilinger)은 **l4acados 논문의 것**이다. 둘은 다른 논문이다.
3. "Automatica 2021 예측 안전 필터"는 C.4에 이미 있는 2018년 논문의 학술지판이다.

**비용 함수를 역으로 배우는 갈래**(Didier의 이중 수준 최적화로 인용된 항목)는 그 서지를 확인하지 못했다. 확인되는 가까운 연구는
Menner·Worsnop·Zeilinger의 제약 역최적제어(IEEE TCST)로, **시연에서** 비용 함수를 역으로 뽑는 방법이다. travplan에는 시연이 아니라
벤치마크 점수가 있으므로 같은 자리에 들어갈 도구는 역최적제어가 아니라 위의 베이즈 최적화다.


### E.7 Zeilinger 그룹 더 보기: 경로를 품은 MPC, 성능을 지키는 자동 튜닝, 실험 플랫폼

그룹 전체(E.5–E.7)를 한 화면으로 정리한 설명 페이지는 [Zeilinger 학습 MPC 지도](explainers/zeilinger-lab.html)다.

**E.5와 E.6이 "학습 모델 위의 보장"이었다면, 이 절은 같은 그룹이 그 보장을 로봇 내비게이션과 튜닝 절차에 옮긴 결과다.** 그룹은 ETH Zürich
IDSC(Institute for Dynamic Systems and Control)의 Intelligent Control Systems 그룹이고, Melanie N. Zeilinger 교수가 이끈다. 아래 논문 대부분에
Andrea Carron이 함께 올라 있다. 2026-09 기준 travplan에 닿는 결과는 셋이다. ==가장 가까운 것은 전역 경로를 MPC 최적화 안에 넣어 막힘 없이 보장을 유지한 내비게이션
MPC다.== 이것이 travplan의 Planner와 Controller 경계를 어떻게 그을지에 대한 한 답이다.

| 결과 | 무엇인가 | travplan에서 |
|---|---|---|
| 경로를 품은 MPC (2025) | Dijkstra 경로 구간을 MPC 결정 변수에 넣고 재귀 실행 가능성·충돌 회피를 보장 | GuidancePlanner → Controller 경계, Planner D 멈춤 |
| COAT-MPC (RA-L 2025) | 성능이 문턱 아래로 떨어지지 않게 제약을 건 베이즈 최적화 튜너 | `TravMapBuilder` 문턱값 튜닝(E.6 bayesopt4ros의 개선판) |
| Chronos·CRS (ICRA 2023) | 1:28 소형 차량과 제어·추정 소프트웨어 틀 | 실험 플랫폼 설계의 참고 |

**경로를 품은 MPC — 전역 경로를 최적화 안에 넣어 막힘과 보장을 함께 푼다**([arXiv:2509.15917](https://arxiv.org/abs/2509.15917),
Köhler·Zhang·Soloperto·Carron·Zeilinger, 2025-09, 2026-03 개정, [코드](https://github.com/IntelligentControlSystems/ClutteredEnvironment)).
지평이 짧은 MPC는 장애물이 빽빽하면 목표 쪽 벽 앞에서 멈춘다. 전역 경로를 참조로만 넘기면 이 멈춤은 풀리지만, 참조를 바꿀 때마다 보장이 깨진다.
이 방법은 가시성 그래프 위의 Dijkstra 최단 경로에서 앞쪽 구간 3개를 **MPC의 결정 변수**로 올린다. MPC는 궤적과 함께 "궤적이 끝나는 인공 정지점"과
"그 정지점에서 목표까지 이어지는 직선 구간들"을 같이 최적화한다. 비용은 추종 비용에 구간 길이의 합을 더한 것이다. 구간이 장애물과 겹치지 않는다는
제약과 종단 정지 제약 덕분에 재귀 실행 가능성, 충돌 회피, 목표 수렴이 보장된다. 목표가 운행 중에 바뀌어도 보장은 유지된다.

동작은 이렇다. 장애물은 부풀린 볼록 다면체이고, 충돌 회피는 분리 초평면 승수로 매끄럽게 바꾼 제약이다. 로봇은 운동학 자전거 모델(상태 6, 입력 2)이고,
지평 20스텝을 20 Hz로 acados SQP-RTI가 푼다. 전역 경로를 넣는 비용은 계산 시간 17–35%다. 무작위 밀집 환경 시뮬레이션에서 성공률은 100%였고,
전역 경로 없는 MPC는 빽빽한 장면 대부분에서 멈췄다. 1:28 소형 차량 실물에서 사람이 목표를 바꿔 주면 50–100 ms 안에 반응했고, 새 목표에 2–3초
안에 도달했다.

**travplan에 주는 의미.** ==이 논문의 멈춤은 Planner D의 이전 8/12 멈춤과 같은 종류다.== 그때 원인은 MPPI 시간 참조 모드에 진행 항이 없는
것이었고(`docs/ARCHITECTURE.md` §4), 진행 항을 더해 12/12가 됐다. 이 논문은 같은 문제를 "경로 구간 길이를 비용에 넣고, 구간 자체를 최적화
변수로 둔다"로 푼다. travplan에 그대로 들어오지는 않는다. 두 가지가 다르기 때문이다. 첫째, travplan Controller는 기울기 없는 MPPI이고 최적화기는
건드리지 않는다는 규칙이 있다. 둘째, TravMap은 볼록 다면체가 아니라 격자 비용 지도다. 옮길 수 있는 것은 **구조**다. GuidancePlanner의
Dijkstra 경로에서 "앞 구간의 남은 길이"를 `CostTerm`의 종단 항으로 두면, Planner D의 궤적이 짧게 끝나도 Controller가 목표 쪽 진행을 잃지 않는다.
waypoint를 건너뛰는 규칙(논문의 중간 목표 갱신)은 Planner D에 subgoal을 넘길 때 그대로 쓸 수 있다.

**COAT-MPC — 튜닝하는 동안에도 성능이 문턱 아래로 떨어지지 않게 한다**([arXiv:2503.07127](https://arxiv.org/abs/2503.07127),
Gassol Puigjaner·Prajapat·Carron·Krause·Zeilinger, IEEE RA-L 2025). E.6의 bayesopt4ros는 좋은 파라미터를 적은 시행으로 찾지만, 탐색 도중에
나쁜 파라미터를 시험하는 것은 막지 않는다. COAT-MPC는 폐루프 성능을 GP 사후분포로 두고, **성능이 정한 문턱 이상일 확률이 높은 영역 안에서만**
낙관적인 후보를 고른다. 문턱 제약은 임의로 높은 확률로 만족되고, 유한 시간 안에 최적 성능으로 수렴한다는 증명이 있다. 자율 경주에서 기존
베이즈 최적화보다 제약 위반과 누적 regret이 모두 작았다.

**travplan에 주는 의미.** E.6에서 붙일 자리로 적은 `TravMapBuilder`의 문턱값 튜닝(`shadow_depth_m`, `shadow_evidence_m`, `shadow_margin_m`)은
목적이 둘로 갈린다. 오탐 셀 수는 줄이고, 포트홀 치명 재현율은 지켜야 한다. ==COAT-MPC의 형식은 이 요구와 정확히 맞는다.== 목적 함수는 오탐 셀 수,
제약은 "치명 재현율 ≥ 0.88(TP-0067 값)"으로 두면 된다. 튜닝 중에 재현율을 깎는 후보를 시험하지 않으므로, 벤치마크 시행을 버리지 않는다.
TP-0067에서 사람이 네 번 실패하고 다섯 번째에 통과한 과정이 이 탐색의 대상이다.

**예측 안전 필터를 실물 경주에 올린 연구**([arXiv:2102.11907](https://arxiv.org/abs/2102.11907), Tearle·Wabersich·Carron·Zeilinger, IEEE RA-L
2021)도 같은 그룹이다. C.4의 예측 안전 필터를 학습 기반 경주 제어기 뒤에 붙여 소형 차량에서 돌렸다. C.4의 이론이 실시간 차량에서 돈다는 근거로
기록해 둔다.

**Chronos·CRS — 이 그룹 실험이 돌아가는 소형 차량과 소프트웨어**([arXiv:2209.12048](https://arxiv.org/abs/2209.12048), Carron 외, ICRA 2023,
[코드](https://github.com/IntelligentControlSystems/crs), BSD-2-Clause). Chronos는 전자부를 공개한 1:28 차량이고, CRS는 시스템 식별·상태 추정·
MPC·다중 에이전트 조정을 한 틀에 넣은 소프트웨어다. 위의 경로를 품은 MPC, E.6의 문맥 베이즈 최적화, 이 절의 안전 필터 실험이 모두 이 플랫폼에서
나왔다. travplan에는 직접 쓸 코드가 아니다. 다만 "같은 소형 플랫폼 위에서 식별·추정·제어를 한 저장소로 반복한다"는 운영 방식은 P1 Isaac 폐루프를
실물로 옮길 때 참고할 값이 있다.

**공개 코드(2026-09, GitHub 별).** [ClutteredEnvironment](https://github.com/IntelligentControlSystems/ClutteredEnvironment) 143,
[l4acados](https://github.com/IntelligentControlSystems/l4acados) 94, [ampyc](https://github.com/IntelligentControlSystems/ampyc) 32,
[bayesopt4ros](https://github.com/IntelligentControlSystems/bayesopt4ros) 19, [crs](https://github.com/IntelligentControlSystems/crs) 5.
COAT-MPC의 코드 공개는 확인하지 못했다.

**정리: 이 그룹에서 travplan이 가져올 순서.** 첫째, TP-0068·TP-0069의 GP 잔차와 σ 제약 조이기(E.5, `docs/design-gp-dynamics.md`). 둘째,
`TravMapBuilder` 문턱값을 COAT-MPC 형식으로 자동 튜닝한다. 셋째, Dijkstra 경로의 남은 길이를 Controller 종단 비용으로 넣는 구조를 Planner D
멈춤 대책의 후보로 둔다. 같은 층에서 다리 로봇 쪽이 푼 방식, 즉 학습 동역학에 실패 확률을 붙여 MPPI에 넣는 방식은 Planner 문서 B.14(ETH RSL)에 있다.


### E.8 GP와 희소 GP: 잔차 모델의 선택지

**E.5–E.7이 "보장을 어떻게 만드나"였다면 이 절은 그 보장의 재료인 잔차 모델 자체다.** travplan이 실제로 구현하고 재 본
결과는 MPC 문서 M.3.6·M.3.8에 있고, 여기에는 계보와 고를 때 보는 축을 적는다.

**계보는 세 갈래다.**

| 갈래 | 대표 | 하는 일 | 비용 |
|---|---|---|---|
| 정확 GP | Rasmussen·Williams | $K^{-1}$을 그대로 푼다 | $O(n^3)$ 학습, $O(n)$/$O(n^2)$ 예측 |
| **유도점(inducing point)** | DTC·FITC → [Titsias 2009](https://proceedings.mlr.press/v5/titsias09a.html) VFE → Hensman SVGP | $m \ll n$개의 가상 입력으로 사후분포를 요약 | $O(nm^2)$, 예측 $O(m)$/$O(m^2)$ |
| **유한 기저(random features)** | Rahimi-Recht, Lázaro-Gredilla 2010 (sparse spectrum) | 커널을 $D$차원 특징 사상으로 바꿔 베이즈 선형회귀로 | $O(D^3)$ 한 번, 예측 **$O(D)$, 데이터 양과 무관** |

**유도점 계열에서 갈리는 지점은 보정 방향이다.** FITC는 잡음을 입력에 따라 다르게 잡을 수 있어 **잡음을 과소평가하고
과신하는** 쪽으로 틀리고, Titsias의 VFE는 참 사후분포와의 KL을 줄이는 하한을 올리므로 **보수적으로** 틀린다. 이 차이를
실험으로 정리한 것이 [arXiv:1606.04820](https://arxiv.org/abs/1606.04820)(Bauer·van der Wilk·Rasmussen)이다.
==안전에 쓰는 분산이라면 과신하는 근사를 고르면 안 된다.==

**온라인·스트리밍.** 제어에서는 데이터가 계속 들어온다. 고정 예산으로 활성 집합을 관리하는 원조가 Csató·Opper의
sparse online GP(Neural Computation 2002)이고, 여기에 하이퍼파라미터 갱신까지 변분으로 묶은 것이
[Streaming Sparse GP](https://arxiv.org/abs/1705.07131)(Bui·Nguyen·Turner, NeurIPS 2017)다. travplan이 쓰는 고정 크기
딕셔너리는 전자의 가장 단순한 형태다(M.3.6).

**로봇 제어에서 실제로 쓰인 방식.**

| 연구 | 무엇 | 희소화 |
|---|---|---|
| [Data-Driven MPC for Quadrotors](https://arxiv.org/abs/2102.05773) (RA-L 2021, UZH RPG) | 공력 잔차를 GP로 배워 NMPC에 넣어 고속 추종 오차 **70% 감소** | 400점에서 뽑은 **유도점 20개**. 15–25가 성능·계산의 최적 구간이었다 |
| [Computationally Efficient Data-Driven MPC](https://arxiv.org/abs/2305.17254) (2023) | 위의 후속, 계산을 더 줄임 | 유도점 |
| [GaPT](https://arxiv.org/abs/2303.08181) (ICRA 2023) | 온라인 회귀 툴킷, 쿼드로터 동역학 | 스트리밍 |
| [Multi-Sparse GP](https://arxiv.org/abs/2003.01802) (2020) | 반파라메트릭 제어(명목 + 잔차) | 다중 희소 GP |
| Cautious MPC (E.5) | GP 분산을 확률 제약으로 | 정확 GP + zero-order(E.6) |

==쿼드로터 쪽 숫자가 특히 참고할 만하다 — **유도점 20개**로 실물 70% 개선을 냈다.== 잔차 모델은 크지 않아도 된다는 뜻이다.

**고를 때 보는 축은 넷이다.** 정확도, **보정 방향**(과신인가 보수인가), 갱신·예측 시간, 그리고 **분포 밖 거동**이다.
마지막 축이 제어에서 특히 중요한데, MPC의 예측 지평은 로봇이 아직 가 보지 않은 곳을 지나므로 질의가 늘 학습 분포 가장자리에
있기 때문이다. travplan에서 이 넷을 모두 재 본 표가 M.3.8이다.


### E.9 모바일 로봇에 GP를 붙인 사례들

**E.8이 방법이면 이 절은 실물이다.** 쿼드로터·로봇 팔은 사례가 많지만 travplan과 설정이 같은 것은 **바퀴로 실외를 달리는
로봇**이다. 그쪽만 모았다.

먼저 틀을 하나 빌린다. Zeilinger 그룹이 2025년에 GP-MPC를 정리하면서 남은 과제를 셋으로 꼽았다
([arXiv:2502.02310](https://arxiv.org/abs/2502.02310), Scampicchio·Arcari·Lahr·Zeilinger). ==이 셋이 travplan이 실제로
부딪힌 것과 같다.==

| 서베이가 꼽은 과제 | travplan에서 만난 형태 |
|---|---|
| (i) GP 회귀의 **확장성** | 정확 GP는 1,400점에서 refresh 121 ms — 제어 주기 밖 (MPC 문서 M.3.8) |
| (ii) 다루기 쉬운 MPC로 만드는 **근사** | 잔차 평균을 acados 파라미터로 → 0차 근사 (M.3.6) |
| (iii) 운용 중 데이터로 하는 **온라인 갱신** | 고정 크기 딕셔너리 + 주기적 재분해 (M.3.6) |

**바퀴 로봇 사례.**

| 연구 | 로봇 | GP가 배운 것 | 실측 규모 |
|---|---|---|---|
| [LB-NMPC](https://onlinelibrary.wiley.com/doi/abs/10.1002/rob.21587) (Ostafew·Schoellig·Barfoot, JFR 2016) | 실외 지상 로봇 **3종, 50–600 kg** | 간단한 사전 차량 모델 위의 **외란**을 상태·입력의 함수로 | **3 km 주행**, 0.35–1.2 m/s, 시각 기반 항법(GPS 없음) |
| [Robust Constrained LB-NMPC](https://journals.sagepub.com/doi/10.1177/0278364916645661) (같은 팀, IJRR 2016) | 위와 같음 | 위 + 제약 강건화 | 반복 경로 추종 |
| [Learn Fast, Forget Slow](https://arxiv.org/abs/1810.06681) (McKinnon·Schoellig, RA-L 2019) | **900 kg 지상 로봇** | 반복 과제에서 **변해 가는** 동역학 | **3.0 km**, 물리적·인공적 동역학 변화 |
| [Probabilistic Motion Model](https://arxiv.org/abs/2402.18065) (Trivedi 외, ICRA 2024) | 스키드 스티어 오프로드 | **타이어-지면 상호작용**이 속도에 주는 비선형 | 미지 지형으로 일반화 |
| [MPC + On-line Sparse GP](https://www.sciencedirect.com/science/article/pii/S240589631731635X) (IFAC 2017) | 스키드 스티어 | 명령 속도 → 실제 속도 | **온라인 희소 GP**로 주행 중 갱신 |
| Cooperative GP-MPC (2026) | 다중 에이전트 내비 | 잔차 + 그 불확실성을 **확률 제약 충돌 회피**에 | 분산 최적화 |

**Ostafew의 구조가 travplan과 같다.** 명목 모델은 단순하게 두고 그 위의 외란만 GP로 배워 NMPC에 넣는다. 규모도 비슷하다 —
0.35–1.2 m/s는 travplan의 1.5 m/s와 같은 자리이고, 50–600 kg은 AntBot의 60 kg을 포함한다.

**그런데 같은 연구실의 후속이 GP를 버렸다.** McKinnon·Schoellig는 900 kg 로봇 3 km 실측에서 **가중 베이즈 선형회귀(wBLR)가
GPR보다 평균도 불확실성도 더 정확했다**고 보고한다. 계산이 싸고, 지평을 길게 볼 수 있고, 최적화가 쉬우며, 새 운용 조건으로
튜닝 없이 일반화했다. 그 위에 Tube MPC를 얹어 불확실성 증가를 눌렀다.

==이 결과를 travplan의 실측이 그대로 따라간다.== M.3.6에서 잰 잔차는 $dv_x$·$dv_y$에서 **선형모형이 GP와 같았고**
($R^2$ 0.71/0.95), GP가 이긴 곳은 $d\omega$ 하나였다. 이유도 같다 — 바퀴 로봇 잔차의 큰 몫은 **액추에이터 지연**이고
그것은 선형이다. 비선형은 조향 포화와 비동축 스크럽처럼 요 축에 몰린다.

**그래서 셋을 기억해 둔다.**
1. **GP를 쓰는 이유는 "더 잘 맞아서"가 아니다.** 지연이 지배하는 채널에서는 선형회귀로 충분하다. GP는 **비선형이 남는
   채널**과 **분산이 필요한 곳**에 쓴다.
2. **E.8의 RFF는 사실상 wBLR의 커널판이다.** 무작위 특징 위의 베이즈 선형회귀이므로, McKinnon의 결론과 travplan의
   RFF 결과(정확도는 정확 GP에 근접, 예측 0.21–0.35 ms)가 같은 이야기를 한다.
3. **스키드 스티어 쪽이 슬립을 다룬다.** travplan의 비동축 스워브는 스키드 스티어보다 슬립이 적지만, 지형 의존 슬립을
   GP로 배우는 방식(Trivedi 2024)은 TP-0033을 켠 뒤 그대로 참고할 수 있다.


### E.10 GP가 모바일 로봇에서 앉는 자리는 셋이다

E.9는 **동역학 잔차** 한 자리만 봤다. 사례를 더 모으니 바퀴 로봇에서 GP가 앉는 자리가 셋이고, travplan에는 셋 다 대응하는
칸이 이미 있다.

| 자리 | 회귀하는 것 | travplan의 대응 |
|---|---|---|
| ① 동역학 잔차 | (상태, 입력) → 실현 오차 | E.9, TP-0068 (MPC 문서 M.3.6) |
| ② 지형 → 슬립·통과성 | 지형 기하·종류 → 슬립비, 통과 비용 | **TravNet 자리**(인식 A.7, TP-0010·0022), TP-0033 |
| ③ 지도 자체 | 관측한 점 → 고도장 + 불확실성 | **TravMap의 `ELEV`·`SIGMA` 채널** |

**② 지형 → 슬립.** 행성 탐사차 쪽이 이 갈래를 가장 오래 팠다. 시각으로 분류한 지형 종류마다 **기하 → 슬립**을 GP로 배우고
([Locally-adaptive slip prediction](https://ieeexplore.ieee.org/document/7989646/), ICRA 2017), 종·횡 슬립의 평균과 최댓값을
신뢰구간과 함께 낸다([Applied Sciences 2022](https://www.mdpi.com/2076-3417/12/9/4789)). 예측한 통과성을 확률적으로 융합해
경로 계획에 넣은 것이 [arXiv:2303.01169](https://arxiv.org/abs/2303.01169)다.

주장 두 개가 travplan에 그대로 걸린다. 첫째, ==**현지에서 모은 데이터로 회귀한 것이 미리 보정해 둔 슬립 곡선보다 평균도
불확실성도 낫다.**== 둘째, **국소 적응의 이득이 고슬립 모래에서 가장 크다** — 즉 위험한 구간이 곧 모델이 약한 구간이고,
거기서 온라인 갱신이 가장 값지다. M.3.6의 고정 크기 딕셔너리가 하는 일이 바로 이것이다.

travplan에서 이 자리는 TravNet이다. ==지금 TravNet은 점 추정이라 σ를 내지 않는다.== 같은 자리에 GP(또는 희소 GP)를 두면
`TravMap`의 `SIGMA` 채널이 학습된 값으로 채워지고, 그것이 TP-0069가 제약을 조일 재료가 된다. 통과성 추정 전반의 지형은
[A Survey of Traversability Estimation](https://arxiv.org/abs/2204.10883)에 정리돼 있다.

**③ 지도 자체.** GP를 지형 모델로 쓰는 계보가 따로 있다(Vasudevan·Ramos·Nettleton·Durrant-Whyte, *Gaussian process modeling of
large-scale terrain*, JFR 2009). 다중 해상도이고, 불확실성을 자연스럽게 다루며, **관측 결손**(가림, 먼 거리의 성김)에 대응한다.
travplan이 미관측 칸을 NaN으로 두고 그림자 상한·깊이 prior로 메우는 자리(TP-0044·0047·0067)와 같은 문제다. 격자 전체에 GP를
돌리는 비용이 걸림돌이고, 최신판은 Neural Process로 바꿔 푼다([arXiv:2508.03890](https://arxiv.org/abs/2508.03890),
off-road 고도 모델링).

**그리고 앞서 적은 것을 하나 고친다.** MPC 문서 M.1에 "MPPI에는 hard 제약이 없으니 GP 분산을 쓰려면 acados NMPC가 필요하다"고
적었다. ==그렇지 않다.== [Data-Driven Sampling Based Stochastic MPC](https://arxiv.org/abs/2411.03289)(Trivedi 외, ICRA 2025,
E.9의 스키드 스티어 운동 모델과 같은 연구실)는 동적 유니사이클에 GP 잔차를 더하고 **장애물 회피와 경로 추종을 확률 제약으로
세워 MPPI로 푼다.** GPU 가속으로 실시간이고 스키드 스티어 실물에서 검증했다.

그래서 travplan에는 길이 둘 다 열려 있다.

| 길 | 내용 | 강점 | 상태 |
|---|---|---|---|
| (a) acados NMPC + 조인 제약 | 잔차 평균을 파라미터로, 분산으로 제약을 조인다 | **hard 제약·튜브·0차 GP** | 정적 38/40, GP 평균으로 plant 37 → 44/48(MPC 문서 M.3.10–M.3.12). 분산 조임(TP-0069)이 다음 |
| (b) MPPI + chance constraint | 샘플 비용에 확률 제약을 세운다 | **비평활 비용**(치명 셀, 이진 충돌)을 그대로 | 구현(TP-0076). 정적·보행자는 기준과 같고 plant 42/48(기준 44/48). 0선이 실패 경계보다 느슨한 곳이 남았다(MPC 문서 M.3.13) |

==2026-09-30에 "MPPI는 개발 계획 제외" 규칙이 해제됐다(CLAUDE.md, PRD §7).== 둘 중 하나를 고르는 것이 아니라
**둘 다 개발하고 같은 벤치마크에서 비교한다.** 강점이 갈리기 때문이다 — MPPI는 절벽 비용을 샘플로 넘고, NMPC는 제약을
형식적으로 건다. 잔차 GP와 ESDF는 둘이 공유하므로 두 번 만들 것은 없다.

**마지막으로 보도 배달 자체.** [Robust Route Planning for Sidewalk Delivery Robots](https://arxiv.org/abs/2507.12067)(2025)는
층이 다르다 — 동역학이 아니라 **주행 시간의 불확실성**을 집합으로 잡아 경로를 고른다. travplan의 전역 경로 위쪽 층이고,
TP-0038의 100 m당 지표와 이어 볼 값이 있다.

---

<!-- tab: 안전 필터 -->

## C. 동적 장애물 안전 필터

==**보행자처럼 움직이는 장애물은 두 가지 방식으로 다룬다.**== 예측을 비용에 녹여 최적화가 알아서 피하게 하거나(비용 통합형), 어떤 명령이 나오든
마지막에 안전 필터가 최소한으로 고치게 한다(외부 필터형). travplan은 비용 통합형으로 시작했고, 외부 필터는 라이선스 문제가 풀리면 더한다.

### C.1 두 구조

```
(1) 비용 통합형 — travplan 채택(P2.4)                (2) 외부 안전 필터형 — CBF-QP 계열
┌──────────────┐                                    ┌──────────────┐    ┌──────────┐
│ MPPI 샘플링    │  비용(예측 위치와의 거리·CVaR)       │ 임의의 명령     │──▶ │ QP 안전   │──▶ 최종 명령
│ + CostTerm    │ ──────────────────▶ 최적 제어       │ (Controller 등)│    │ 필터      │   (최소 수정)
└──────────────┘                                    └──────────────┘    └──────────┘
 travplan RiskCost·시간가변 비용 레이어와                 OcclusionCBF, 표준 CBF-QP, CVaR-BF
 같은 CostTerm 인터페이스로 바로 붙는다
```

### C.2 방식별 설명

**시간가변 비용 레이어**(travplan 채택, P2.4·TP-0012) — 예측한 장애물 위치 주변에 거리에 따라 줄어드는 비용을 얹는다. 가장 쉽고 기존 구조를 그대로 쓴다.
구현이 끝났고, 횡단 보행자 시나리오에서 충돌을 1/3에서 0/3으로 줄였다. 지금은 `ControlRequest.dynamic_obstacles`로 Controller의 `RiskCost`에 들어간다.

**RA-MPPI / DRA-MPPI** — 장애물 위치 분포(가우시안·GMM)를 MPPI 샘플과 함께 몬테카를로로 뽑아, 충돌 확률이 임계를 넘는 궤적을 벌하거나 버린다.
travplan의 샘플링 + CVaR `RiskCost`와 구조가 가장 가깝다. DRA-MPPI는 RTX 2080 노트북 GPU에서 반복당 97–115 ms(약 5 Hz)이고 Orin 실측은 없다.
MPPI 자체를 개선하는 일이라 2026-09-25 개발 계획에서 뺐다.

<details markdown="1">
<summary>자세히: RA-MPPI와 DRA-MPPI의 방법과 수식</summary>

**RA-MPPI**([arXiv:2209.12842](https://arxiv.org/abs/2209.12842)). 원래 MPPI는 기대 비용만 줄인다(배경 0.2).

$$ \min_{v}\ J(v) = \mathbb{E}\Big[\phi(x_K) + \sum_{k=0}^{K-1}\Big(q(x_k) + \tfrac{\lambda}{2} v_k^\top \Sigma_\epsilon^{-1} v_k\Big)\Big], \quad x_{k+1} = F(x_k, v_k + \epsilon_k) $$

RA-MPPI는 시뮬레이션 모델 $F$를 더 일반적인 확률 시스템 $\tilde F(\tilde x_k, u_k, w_k)$의 기댓값으로 보고, 실현 궤적의 손실 $L(\tilde x)$에 **CVaR 제약**을 건다
(배경 0.3). 샘플마다 교란 $w$를 여러 번 뽑아 CVaR를 추정하고, 제약을 어기는 샘플에 벌점을 준다.

$$ \min_v J(v) \quad \text{s.t.}\quad \operatorname{CVaR}_\alpha\big(L(\tilde x)\big) \le C_u,\quad \tilde x_{k+1} = \tilde F(\tilde x_k, v_k, w_k) $$

**DRA-MPPI**([arXiv:2506.21205](https://arxiv.org/abs/2506.21205), IROS 2025). 보행자 위치를 가우시안 혼합(MoG)으로 예측하고, 여러 장애물과의 **결합 충돌 확률**에
확률 제약을 건다($r$: 로봇과 장애물 반경의 합, $\sigma$: 허용 충돌 확률).

$$ p_t^o(x, y) = \sum_{i=1}^{N_m} \phi_i\, \mathcal{N}\big(\mu_i(t), \Sigma_i(t)\big), \qquad \mathbb{P}\big[\lVert q_t - \delta_t^o \rVert_2 > r,\ \forall o\big] \ge 1 - \sigma,\ \ \forall t $$

이 확률을 MPPI 샘플 수백 개에 대해 몬테카를로로 병렬 추정해 비용에 넣는다. 가우시안이 아닌 예측도 근사 없이 다룬다. RTX 2080 노트북 GPU에서 반복당 97–115 ms.

**travplan과의 관계.** travplan `RiskCost`는 보행자를 등속 원판 + 시간에 따라 커지는 반경으로 예측하고, 겹침에 강한 벌점을 준다. 결합 확률을 몬테카를로로 재지는
않는다. MPPI 개선이라 계획에서는 뺐지만, 보행자 예측을 MoG로 바꿀 때 비용을 어떻게 만들지의 참고다.

</details>

**표준 CBF-QP** — 매 스텝 작은 QP를 풀어, barrier 함수가 음수가 되지 않도록 명령을 최소한으로 고친다. 보이는 장애물에만 반응하고 0.6–0.8 ms로 빠르다.

**OcclusionCBF** — 가려진 영역을 시간 인덱스 도달 가능 점유로 넉넉하게 추정하고, 백업 rollout이 그 점유 전체와 인증된 종단 집합에 대해 안전한지
검증한다. 그래서 사각지대에서도 **보이기 전에** 개입한다. 1.6–4.5 ms지만 **참조 구현이 상용 Gurobi를 요구**해서 보류했다.

| 감지 후 반응(일반 CBF-QP) | 감지 전 개입(OcclusionCBF) |
|---|---|
| ![reactive](https://github.com/user-attachments/assets/083a1d86-ab8d-4e66-93a2-674b9eb9d568) | ![proactive](https://github.com/user-attachments/assets/8537ae49-91c4-478e-aafa-c2fc742e17d9) |

**Risk Adaptive CVaR Barrier Functions**(IROS 2025) — CVaR와 동적 영역 기반 barrier 함수를 결합하고, 위험 수준을 상황에 맞게 스스로 조절한다.
공식 구현의 `requirements.txt`를 직접 확인한 결과 의존성은 `casadi`, `numpy`, `scipy`뿐이다. **Gurobi나 cvxpy가 아니라 오픈소스 CasADi**(내부적으로
qpOASES·IPOPT)로 푼다. OcclusionCBF와 달리 라이선스 걸림돌이 없고, travplan `RiskCost`가 이미 CVaR를 쓰므로 개념적으로도 가장 가깝다. TP-0014의
1순위 후보다.

![Adaptive CVaR-BF demo](https://raw.githubusercontent.com/Lawliet9666/Adaptive-CVaR-Barrier-Function/master/config/20obs/figures/adap_cvarbf_beta0.99_hdist_cone.gif)

<details markdown="1">
<summary>자세히: Adaptive CVaR Barrier Functions의 방법과 수식</summary>

**이산 CBF**(배경 0.4). $\alpha(r) = \gamma r$로 두면 $h(x_{k+1}) \ge (1-\gamma) h(x_k)$이고, 명목 명령 $\bar u_k$를 최소한만 고치는 QP로 강제한다.

**확률적 안전 → CVaR.** 장애물의 다음 상태가 확률 변수라 $h_{k+1}$도 확률 변수다. 충돌 확률 조건 $P(h_{k+1} \ge 0) \ge 1 - \beta$는 VaR 조건과 같고, 이를 CVaR로 강화한다.
시점마다 CVaR 연산을 합성한 CVaR-safety가 성립하면 안전 집합에 머문다.

$$ \min_{u_k \in \mathcal{U}} \lVert u_k - \bar u_k \rVert^2 \quad \text{s.t.}\quad \operatorname{CVaR}_\beta^{k}\big(h_{k+1}\big) \ge (1-\gamma)\, h_k $$

**문제: 고정 $\beta$의 딜레마.** $\beta$가 크면 제약이 느슨해져 장애물 가까이 가고(위험), 작으면 제약이 빡빡해져 QP가 풀리지 않거나 지나치게 보수적이 된다.

**해법: 매 스텝 $\beta$를 고른다.** 제약을 만족하는 제어 집합 $\mathcal{U}^k_\beta$가 비어 있지 않은 가장 작은 $\beta$(상한 $\beta_u$ 이하)를 쓴다. 안전하게 풀 수 있을 때는
가장 보수적으로, 그렇지 않을 때만 완화한다. 여기에 동적 영역 기반 barrier를 더하고, max 연산자는 보조 변수로 바꿔 **평범한 QP**로 만든다.

$$ \beta_k := \min\big\{\beta \in (0, \beta_u] \ \big|\ \mathcal{U}^k_\beta \neq \emptyset\big\} $$

구현은 CasADi(오픈소스)로 풀며 Gurobi가 필요 없다.

**travplan에 주는 것.** Controller(MPPI) 출력 뒤에 붙일 안전 필터의 1순위 후보다(TP-0014). $h$는 TravMap 치명 셀과 `DynamicObstacles` 원판까지의 거리로 만들 수 있다.

</details>

**OA-MPC / OACP / Control-Tree MPC** — 가림을 다루는 다른 대안들이지만 모두 48–200 ms로 Orin 예산 밖이다(OcclusionCBF 논문의 비교 기준).

### C.3 비교

| 방식 | 스텝당 지연 | 안전 보장 | 솔버·의존성 | 가림 대응 | travplan 통합 |
|---|---|---|---|---|---|
| 시간가변 비용 레이어 | 거의 0(TravMap 조회) | 없음(휴리스틱) | 없음 | 부분적(마지막 관측 위치 유지) | **채택·구현 완료** |
| RA-MPPI / DRA-MPPI | 97–115 ms(RTX 2080) | 확률적(chance constraint) | MPPI 샘플러 확장 | 없음 | 계획에서 제외(MPPI 개선) |
| 표준 CBF-QP | 0.6–0.8 ms | 강함(barrier 불변) | 소형 QP(OSQP 등) | 없음(반응형) | 중간(새 QP 계층) |
| OcclusionCBF | 1.6–4.5 ms | 강함 + 가림 인증 | **Gurobi(상용)** | ✅ 사전 개입 | 어려움(라이선스) — **보류** |
| CVaR-BF(Adaptive) | 논문 미보고(CBF-QP급 추정) | 확률적(CVaR) + 적응형 여유 | **CasADi(오픈소스, 확인)** | 없음 | **중간 — 가장 유력(TP-0014)** |
| OA-MPC / OACP / Control-Tree | 48–200 ms | 강함(최악 경우) | MPC 솔버 | ✅ | Orin 예산 밖 |

**결론.** 동적 장애물은 지금의 시간가변 비용 레이어로 충분히 시작했다. ==다음 단계는 Controller 뒤에 붙는 **CVaR-BF 안전 필터**다.== 라이선스가 확인됐고
travplan의 CVaR `RiskCost`와 개념이 가장 가깝다. OcclusionCBF와 OA-MPC 계열은 라이선스와 지연 문제로 계속 보류한다. 예측 점유를 안전 필터에 넣는
최신 방식(Predictive Semantic Safety)은 §E에 있다.

### C.4 안전 필터의 계보: CBF-QP, 도달 가능성, 예측 안전 필터

**안전 필터는 세 갈래에서 왔다.** 명령에 barrier 부등식을 거는 CBF-QP(2016–2019), 안전하게 되돌아올 수 있는 상태 집합을 미리 계산하는
Hamilton-Jacobi 도달 가능성(2017), 짧은 MPC로 "이 명령을 써도 안전한 대안이 남는가"를 확인하는 예측 안전 필터(2018)다. 2023년 리뷰는 이
셋을 "감시 + 개입"이라는 한 구조로 묶었다. 위 C.2의 OcclusionCBF와 CVaR-BF는 CBF-QP 갈래의 최신판이다. 2025년에는 인식한 점유 지도에서
barrier 함수를 바로 만드는 Poisson 안전 함수가 나왔고, 다리 로봇 내비(RoM-Nav, Planner 문서 B.9)의 안전 필터로 쓰인다.

| 연도 | 이름 | 갈래 | 핵심 | 코드(★) |
|---|---|---|---|---|
| 2016 | CBF-QP (Ames 등) | barrier | CBF와 CLF를 한 QP로 묶어 안전과 목표를 함께 | — |
| 2017 | HJ 도달 가능성 개관 | 도달 가능성 | 가치 함수로 안전 집합을 계산, GPU level set 도구 | [StanfordASL/hj_reachability](https://github.com/StanfordASL/hj_reachability) 0.2k |
| 2018 | 예측 안전 필터 | 예측(MPC) | 학습 제어기의 명령을 MPC로 검사하고 최소로 고친다 | — |
| 2021 | 예측 제어 barrier 함수(PCBF) | 예측 + barrier | 항상 실행 가능한 소프트 제약으로 실행 가능 집합을 안정화, 회복 장치 | — |
| 2019 | CBF 이론과 응용 | barrier | CBF의 이론과 로봇 응용을 정리한 튜토리얼 | — |
| 2020 | 이산 시간 CBF + MPC | barrier + 예측 | MPC 안에 이산 CBF 제약 | [HybridRobotics/NMPC-DCLF-DCBF](https://github.com/HybridRobotics/NMPC-DCLF-DCBF) 0.3k |
| 2021 | safe-control-gym | 벤치마크 | 제어·RL의 안전 방법을 같은 환경에서 비교 | [utiasDSL/safe-control-gym](https://github.com/utiasDSL/safe-control-gym) 0.9k |
| 2023 | 안전 필터 통합 관점 | 리뷰 | 세 갈래를 감시와 개입이라는 한 구조로 | — |
| 2024 | ABS | 도달 가능성(학습) | 정책 조건 도달-회피 가치로 빠른 정책과 회복 정책을 전환(Planner 문서 B.9) | [LeCAR-Lab/ABS](https://github.com/LeCAR-Lab/ABS) 0.6k |
| 2025 | Poisson 안전 함수 | barrier | 점유 지도에서 Poisson 방정식을 풀어 CBF를 곧바로 만든다 | — |
| 2025 | Poisson 안전 함수 + CBF MPC | barrier + 예측 | 로봇 모양(Minkowski 차)과 움직이는 장애물까지 넣은 예측 안전 필터, G1·Go2 | — |
| — | safe_control | 구현 모음 | 단일·다중 로봇 내비의 CBF-QP, MPC-CBF 등 | [tkkim-robot/safe_control](https://github.com/tkkim-robot/safe_control) 0.3k |

**CBF-QP — 안전과 목표를 한 QP로**([arXiv:1609.06408](https://arxiv.org/abs/1609.06408), IEEE TAC 2017, Caltech 등). 자동차 적응형 순항
제어처럼 목표(속도 유지)와 안전(차간 거리)이 부딪히는 시스템을 겨냥했다. 안전 조건은 집합의 전방 불변성으로 정의하고, 이를 보장하는
barrier 함수 두 종류를 일반화해 제어 입력에 대한 부등식 제약(CBF)을 얻었다. 목표는 control Lyapunov 함수(CLF) 제약으로 표현하고, 두 제약을
한 QP에 넣어 매 스텝 푼다. 둘이 부딪히면 CLF 제약을 완화 변수로 풀어 안전을 우선한다. 뒤이은 튜토리얼
([arXiv:1903.11199](https://arxiv.org/abs/1903.11199), ECC 2019)이 이론과 로봇 응용을 정리해 표준 참고가 됐다(배경 0.4).

**HJ 도달 가능성 — 어디서부터는 이미 늦었는지 계산한다**([arXiv:1709.07523](https://arxiv.org/abs/1709.07523), CDC 2017, UC Berkeley). 외란이
최악으로 작용해도 위험 집합을 피할 수 있는 상태들의 집합을 Hamilton-Jacobi 편미분 방정식의 해(가치 함수)로 계산한다. 일반 비선형 동역학과
유계 외란을 형식적으로 다루는 것이 장점이고, 상태 차원에 대해 계산량이 지수적으로 커지는 것이 한계다. 이 개관은 기본 이론, GPU 병렬 level
set 도구 사용법, 고차원 문제를 분해로 줄이는 최근 연구를 정리했다.

**예측 안전 필터 — 학습 제어기 뒤에 붙는 MPC 검사기**([arXiv:1812.05506](https://arxiv.org/abs/1812.05506), 2018, ETH Zurich). RL 같은 학습
제어기는 상태와 입력 제약을 명시적으로 지키지 못한다. 예측 안전 필터는 학습 제어기가 낸 명령을 받아, 그 명령으로 시작해도 이후 안전한
입력열이 존재하는지를 짧은 MPC로 확인한다. 존재하면 명령을 그대로 쓰고, 없으면 첫 입력이 원래 명령에 가장 가까운 안전한 입력열로 바꾼다.
데이터로 학습한 모델과 상태·입력에 따른 불확실성을 고려한다. 어떤 RL 알고리즘이든 그대로 붙일 수 있다.

**PCBF는 이 필터의 실행 불가능 문제를 없앤다**(E.5). 안전한 입력열이 없을 때 최적화가 풀리지 않는 대신, 항상 풀리는 소프트 제약 문제로
바꾸고 그 해가 원래 실행 가능 집합으로 돌아오게 만든다.

**안전 필터의 통합 관점**([arXiv:2309.05837](https://arxiv.org/abs/2309.05837), Annual Review of Control, Robotics, and Autonomous Systems,
Princeton). 모델 기반 안전 제어는 일반화와 확장이 어렵고, 데이터 기반 방법은 보장이 약해 예측할 수 없는 치명적 실패를 낸다. 이 리뷰는
겉보기에 다른 안전 필터들(가치 함수 기반, CBF, 예측·rollout 기반)이 같은 모듈 구조를 가진다는 것을 보였다. 안전 대체 정책, 지금 상태가
아직 회복 가능한지 판단하는 감시기, 필요할 때만 명령을 바꾸는 개입 방식이다. 이 관점에서 더 확장 가능한 합성, 강건한 감시, 효율적 개입이
다음 과제로 제시됐다.

**Poisson 안전 함수 — 점유 지도에서 barrier 함수를 곧바로 만든다**([arXiv:2505.06794](https://arxiv.org/abs/2505.06794), 2025, Caltech,
Bahati·Bena·Ames, [영상](https://youtu.be/fBRdkAJGixI)). CBF를 쓰려면 안전 집합을 나타내는 함수 $h$가 필요한데, 복잡하고 변하는 환경에서는
이 함수를 손으로 만들기 어렵다. 이 연구는 인식한 점유 지도에서 $h$를 편미분 방정식으로 계산한다. 자유 공간을 영역으로, 장애물 경계를 $h = 0$인
Dirichlet 경계 조건으로 두고 Poisson 방정식 $\Delta h = f$를 푼다. 음의 forcing 함수 $f$ 덕분에 $h$는 자유 공간 안에서 양수이고, 경계에서
멀어질수록 커지며, 기울기가 경계 근처에서도 0이 되지 않는다. 그래서 거리장보다 CBF로 쓰기 좋다. GPU에서 SOR(successive over-relaxation)로
120 × 120 격자를 0.2–0.3 ms에 풀고, 이전 해로 시작해 10 Hz로 갱신한다. 로봇은 단일 적분기(속도 명령) 축소 모델로 보고 CBF-QP를 건다.
Unitree Go2에서는 $h$가 늘 양수였고, G1에서는 보행 제어기의 속도 추종 지연 때문에 잠깐 음수가 됐다.

**후속 두 편.** 하나는 이 함수를 예측 안전 필터로 옮겼다([arXiv:2508.11129](https://arxiv.org/abs/2508.11129), Humanoids 2025). 로봇 모양을
Minkowski 차로 방향마다 빼서 긴 짐을 든 G1처럼 비대칭인 몸체도 다루고, 장애물 경계의 움직임을 광류로 추정해 시간에 따라 변하는 $h$를 만든다.
평면 속도 $(v_x, v_y, \omega)$ 축소 모델의 MPC에 이산 CBF 제약을 넣어 OSQP로 100 Hz에 푼다. 다른 하나는 장애물마다 위험도를 다르게 줬다
([arXiv:2510.25913](https://arxiv.org/abs/2510.25913), 2025). Laplace 방정식으로 안내 벡터장을 만들고, 위험한 장애물 경계에 더 큰 유출량을 줘서
그 주변의 $h$가 더 천천히 커지게 한다. 같은 안전 보장 아래 위험한 장애물을 더 멀리 돌아간다.

**travplan에 주는 의미.** ==TravMap의 치명 셀을 Dirichlet 경계로 두면, 격자 하나를 풀어 MPPI 뒤의 CBF 안전 필터를 바로 만들 수 있다.==
travplan은 이미 격자 지도와 GPU를 쓰므로 계산 부담이 작다. 위험도별 유출량(2510.25913)은 TravMap cost를 경계 조건으로 넣는 길이다. G1에서 본
속도 추종 지연 문제는 스워브 모듈의 조향 지연에도 같게 생기므로, 축소 모델에 여유를 두거나 예측 필터를 쓴다. 안전 필터 후보 비교(C.3)에
넣을 만하다.

<details markdown="1">
<summary>자세히: 세 갈래의 안전 조건을 한 틀로 보기</summary>

**CBF-QP.** 안전 집합 $\mathcal C = \{x : h(x) \ge 0\}$에서 $h$가 너무 빨리 줄지 않게 제약하고, 목표 CLF $V$는 완화 변수 $\delta$와 함께
넣는다(배경 0.4).

$$ \min_{u,\, \delta} \ \lVert u - u_{\text{nom}} \rVert^2 + p\,\delta^2 \quad \text{s.t.} \quad L_f h + L_g h\, u \ge -\alpha(h), \quad L_f V + L_g V\, u \le -\gamma V + \delta $$

**HJ 도달 가능성.** 실패 집합을 $\ell(x) < 0$으로 정의하면, 가치 함수 $V(x, t)$는 제어가 최선을, 외란이 최악을 다하는 게임의 해다. 안전
집합은 $V \ge 0$인 곳이고, 경계 가까이에서만 안전 제어로 개입한다.

$$ \frac{\partial V}{\partial t} + \min\Big\{0,\ \max_{u} \min_{d}\ \nabla V(x, t)^\top f(x, u, d)\Big\} = 0, \qquad V(x, T) = \ell(x) $$

**예측 안전 필터.** 학습 제어기의 명령 $u_L$에 가장 가까운 첫 입력을 가지면서, $N$스텝 뒤 불변 안전 집합 $\mathcal S_f$에 도달하는 입력열을 찾는다.

$$ \min_{u_{0:N-1}} \lVert u_0 - u_L \rVert^2 \quad \text{s.t.} \quad x_{k+1} = f(x_k, u_k),\ \ x_k \in \mathcal X,\ \ u_k \in \mathcal U,\ \ x_N \in \mathcal S_f $$

**통합 관점.** 세 방법 모두 "감시기가 위험하다고 판단하면 대체 정책으로 개입한다"로 쓸 수 있다. CBF-QP는 $h$와 그 변화율로, HJ는 가치
함수 $V$로, 예측 필터는 안전한 입력열의 존재로 감시한다.

**travplan에 주는 것.** travplan의 다음 안전 층 후보인 CVaR-BF(TP-0014)는 CBF-QP 갈래의 확률판이다. 예측 안전 필터는 travplan 구조와 더 잘
맞는다. Planner D의 이전 계획(`keep_previous`)이나 GuidancePlanner 경로를 "안전 대체 정책"으로 두고, Controller 명령이 그 대체 계획으로
돌아갈 여지를 남기는지만 짧은 rollout으로 검사하면 된다. 이미 가진 rollout 코드(`SwerveModel.rollout`)로 구현할 수 있다.

</details>

---

<!-- tab: 하위 제어 · 4족 RL -->

## F. 하위 제어: 4족 보행 RL

**travplan은 body twist까지만 낸다.** 그 아래(관절 토크·위치)는 스워브의 경우 모듈 역기구학이 해석적으로 풀어 주므로
RL이 필요 없다. 그런데도 이 계열을 여기 두는 이유가 셋이다.

1. **커리큘럼이 같은 문제다.** travplan에도 지형 난이도 레벨(TP-0039)과 Planner D의 RL 후학습(TP-0066)이 있고,
   "다음에 어떤 과제를 뽑을 것인가"를 지금은 무작위로 답하고 있다.
2. **입력이 같다.** 이 정책들은 지형 높이 샘플을 관측으로 받는다. TravMap이 주는 것과 같은 종류다.
3. **sim-to-real 장치가 같다.** 액추에이터 모델, 특권 정보 증류, 도메인 무작위화는 travplan의 plant(TP-0033·0034)와
   GP 잔차(TP-0068)가 다루는 문제와 뿌리가 같다.

### F.1 계보 — 액추에이터 모델에서 자동 커리큘럼까지

| 연도 | 이름 | 핵심 | travplan과 닿는 곳 |
|---|---|---|---|
| 2019 | Hwangbo 외, *Learning agile and dynamic motor skills* (Science Robotics) | **actuator net**으로 모터·감속기 동역학을 학습해 sim-to-real 격차를 메움 | 잔차 학습의 원조(E.9) |
| 2020 | [Lee 외](https://arxiv.org/abs/2010.11251), *Learning quadrupedal locomotion over challenging terrain* (Science Robotics) | 특권 정보 교사 → 고유수용 학생 증류, 험지 | 배경 0.12의 증류 |
| 2021 | [Rudin 외](https://arxiv.org/abs/2109.11978), *Learning to Walk in Minutes* (CoRL 2022) | GPU 대규모 병렬 + **게임식 지형 커리큘럼**(잘하면 올리고 못하면 내린다) | 지형 난이도 레벨(TP-0039) |
| 2022 | Miki 외 (Science Robotics) | 고유수용 + 외수용을 합치는 belief encoder | 인식 A.7.1 |
| 2023 | [Hoeller 외](https://arxiv.org/abs/2306.14874), *ANYmal Parkour* (Science Robotics 2024) | 기술별 정책 + 항법, 지각 기반 민첩 주행 | Planner 문서 B.14 |
| **2026** | [Li·Li·Hutter](https://arxiv.org/abs/2601.17428), *Scaling Rough Terrain Locomotion with Automatic Curriculum RL* | **학습 진척으로 과제 분포를 자동 조절**(LP-ACRL) | 아래 F.2 |

### F.2 LP-ACRL — 난이도 순서를 사람이 정하지 않는다

**문제.** 커리큘럼 학습은 보통 **난이도 순으로 정렬한 과제 열**을 사람이 만든다. 그런데 지형 종류와 속도 명령을 동시에
다뤄야 하면 ==순서를 매길 수가 없다== — 자갈이 계단보다 쉬운가? 2 m/s 평지가 1 m/s 계단보다 쉬운가? 답이 정해지지 않는다.

**방법.** 과제 $\zeta$의 **학습 진척(learning progress)**을 연속한 두 학습 단계의 에피소드 보상 차이로 재고, 그 값에
softmax를 걸어 샘플링 확률로 쓴다. 난이도 사전 지식이 필요 없다.

$$ \mathrm{LP}(\zeta) = R_{c_j}(\zeta) - R_{c_{j-1}}(\zeta), \qquad p(\zeta) \propto \exp\big(\mathrm{LP}(\zeta)/\tau\big) $$

![LP-ACRL 방법](https://arxiv.org/html/2601.17428v1/figs/3_Approach/LP-ACRL.png)
*그림 — LP-ACRL의 흐름. 학습 진척을 온라인으로 재서 과제 표집 분포를 갱신한다. 출처: [arXiv:2601.17428](https://arxiv.org/abs/2601.17428)*

**실험은 셋으로 키워 간다.** 평지 속도 추종 8개 과제(0–4.0 m/s) → 지형 6종 → **확장 600개**(선속도 5단계 × 각속도
6단계 × 지형 5종 × 지형별 난이도 4단계). 비교 대상은 ALP, Prioritized Level Replay, 저보상 우선, 손으로 짠 커리큘럼,
균등 표집이다.

==**600개 과제에서 LP-ACRL은 1,500 iteration에 성공률 80%에 닿았고, 기준선들은 3,000 이후에도 고전했다.**==

**실물은 ANYmal D다.** 평지 **3.0 m/s**, 계단·경사·자갈 같은 험지에서 **2.5 m/s**, 각속도 **3.0 rad/s**까지 나왔다.

![ANYmal D 실물 배포](https://arxiv.org/html/2601.17428v1/real_deploy.png)
*그림 — 학습한 정책을 ANYmal D에 올린 실물 주행 여섯 장면: 경사판, 실내 계단 내려가기, 자갈, 철제 계단, 실외 돌계단, 포장면. 출처: [arXiv:2601.17428](https://arxiv.org/abs/2601.17428)*

<details markdown="1">
<summary>자세히: 배경 — 이 논문을 읽으려면 알아야 할 네 가지</summary>

**1. 강화학습과 정책.** **정책**은 "지금 본 것"을 넣으면 "지금 할 것"을 내주는 함수이고, 여기서는 신경망이다. 넣는 것은
로봇의 자세·관절 상태·속도 명령과 발밑 지형의 높이 격자, 나오는 것은 관절 12개의 목표 위치다. 로봇은 이 정책으로
시뮬레이션에서 수없이 걸어 보고 잘 걸으면 **보상**을 받는다. 보상을 더 받도록 가중치를 조금씩 고치는 것이 강화학습이다.
==보상은 "얼마나 잘했나"를 재는 자이지 "무엇을 연습할까"를 정하지 않는다.== 이 논문이 건드리는 것은 뒤쪽이다.

**2. 커리큘럼 학습.** 사람을 가르칠 때 쉬운 것부터 주듯, 로봇도 평지에서 천천히 걷는 것부터 시키고 되면 계단을 준다.
이 **과제를 주는 순서**가 커리큘럼이다. 문제는 그 순서를 보통 사람이 손으로 짠다는 것이다. 축이 하나면 쉽지만
(속도만 다루면 느린 것부터), ==축이 여럿이면 순서가 정의되지 않는다== — 자갈과 계단 중 무엇이 쉬운가?

**3. sim-to-real.** 실물 로봇으로 수백만 번 넘어뜨리며 배울 수는 없다. 시뮬레이터(여기서는 Isaac Lab)에서 로봇
수천 대를 GPU로 동시에 굴려 배운 뒤 정책을 실물로 옮긴다. 옮길 때 성능이 떨어지는 것이 이 분야의 오랜 숙제다.

**4. 교사–학생 증류.** 시뮬에서는 로봇이 알 수 없는 것까지 알 수 있다(지형의 정확한 모양, 마찰 계수). 이것이 **특권
정보**다. 특권 정보를 받는 **교사** 정책을 먼저 잘 학습시킨 뒤, 실제 센서만 보는 **학생** 정책이 교사를 흉내 내게
하는 것이 증류다. 이 논문도 실물 배포에는 학생을 쓴다(아래).

</details>

<details markdown="1">
<summary>자세히: 왜 "난이도"가 아니라 "진척"인가</summary>

과제는 셋으로 갈린다.

- **이미 잘하는 과제** — 더 줘도 늘 것이 없다. 시간 낭비다.
- **너무 어려운 과제** — 줘도 안 는다. 역시 시간 낭비다.
- **지금 늘고 있는 과제** — 여기가 배울 것이 남은 자리다.

==보상의 **값**만 보면 앞의 둘을 구분하지 못한다.== 보상이 낮은 과제를 더 주는 방법(기준선 중 하나인 저보상 우선)은
"너무 어려운 과제"에 시간을 다 쓰게 된다. 그래서 값이 아니라 **변화**를 본다. 그것이 학습 진척이다.

$$ \mathrm{LP}_{c_j}(\zeta) = \underbrace{R_{c_j}(\zeta)}_{\text{이번 단계 평균 보상}} - \underbrace{R_{c_{j-1}}(\zeta)}_{\text{지난 단계 평균 보상}} $$

이 값이 크면 그 과제에서 실력이 빠르게 늘고 있다는 뜻이다. 모든 과제의 LP에 softmax를 씌우면 확률이 되고, 온도
$\beta$가 작을수록 잘 늘고 있는 과제에 몰아준다.

$$ c_{j+1}(\zeta) = \frac{\exp\big(\mathrm{LP}_{c_j}(\zeta)/\beta\big)}{\sum_{\zeta' \in \mathcal{T}} \exp\big(\mathrm{LP}_{c_j}(\zeta')/\beta\big)} $$

학습은 **단계(stage)**로 나뉜다. 한 단계 동안 이 분포로 과제를 뽑아 학습하고, 단계가 끝나면 과제별 평균 보상을 다시
재서 LP를 갱신하고 분포를 다시 만든다. 그것이 전부다.

**기준선 ALP와의 차이가 미묘하지만 중요하다.** ALP는 $|\mathrm{LP}|$로 절대값을 쓴다. 그러면 **성능이 떨어지고 있는
과제**도 "변화가 크다"고 보고 더 뽑는다. LP-ACRL은 부호를 살려 **오르고 있는 쪽**만 키운다.

</details>

**과제 공간을 어떻게 쪼개나.** 범주형 차원(지형 종류)은 그대로 두고, 연속형 차원(속도 명령)은 겹치지 않는 구간으로
자른다. 확장 실험의 600개는 $|v_x| \in [0, 2.5]$ m/s를 5구간, $|\omega_z| \in [0, 3.0]$ rad/s를 6구간, 지형 5종,
지형별 난이도 4단계로 만든 곱이다.

**관측과 행동.** 고유수용(기저 선속도·각속도·중력 벡터), 속도 명령, 관절 위치·속도, 직전 행동, 그리고 **지형 높이
격자 275개**(로봇 기준 2.4 m × 1.0 m, 해상도 0.1 m → 25 × 11)가 관측이고, 행동은 관절 위치 목표 12개다.
높이 격자를 관측으로 받는다는 점이 travplan의 TravMap과 같은 구조다.
(논문 본문은 같은 격자를 "108개"라고 적지만, 표와 격자 크기는 275로 맞는다.)

**보상은 표준 로코모션 구성이다.** 선속도·각속도 추종에 $\varphi(x) = \exp(-\lVert x \rVert^2 / 0.25)$를 쓰고,
수직 속도·자세 각속도·관절 가속·토크·행동 변화율·충돌에 벌점을 주며, 발이 공중에 머문 시간에 보상을 준다.
==LP-ACRL은 보상을 바꾸지 않는다. 바꾸는 것은 **어떤 과제를 얼마나 자주 보여줄지**뿐이다.==

**비교한 기준선 다섯.** 절대 학습 진척(ALP, 부호를 버리고 크기만 쓴다), Prioritized Level Replay(GAE 기반 예측
오차로 고른다), 저보상 우선(보상이 낮은 과제를 더 뽑는다), 손으로 짠 커리큘럼(속도 범위를 sigmoid로 넓힌다),
그리고 균등 표집이다. ==travplan이 지금 쓰는 방식이 마지막 것이다.==

**실물에는 증류한 학생 정책을 올린다.** 실제 로봇의 높이 격자는 **elevation mapping**으로 만드는데 속도가 붙으면
잡음이 커진다. 그래서 교사(LP-ACRL로 학습) → 학생(LSTM + MLP) 증류로 시간 정보를 쓰게 해 잡음에 견디게 했다.
==travplan의 L1이 쓰는 것이 같은 elevation mapping이고, Planner D가 L1 belief에서 떨어지는 것이 TP-0055다.==
같은 처방(특권 교사 → 시간 정보를 쓰는 학생)이 그 자리에 그대로 온다.

### F.3 travplan에 주는 것 — 지금 바로 걸리는 자리가 있다

==travplan은 지금 지형 난이도 레벨을 **무작위로** 뽑고, 레벨 3에서 실패하고 있다.== 열린 작업 둘이 정확히 그 자리다.

| travplan | 지금 하는 방식 | LP-ACRL의 답 |
|---|---|---|
| TP-0039 지형 난이도 레벨 | 레벨을 인자로 고정하거나 무작위 | **진척이 큰 레벨을 더 뽑는다** |
| TP-0073 시연 수집 `--levels` 무작위 | 균등 표집 | 균등 표집은 LP-ACRL의 기준선 중 하나다 |
| TP-0050 레벨 3 실패 | 원인 진단 중(생성기의 치명 샘플) | 진척이 0인 과제는 표집이 저절로 줄어 **다른 과제를 갉아먹지 않는다** |
| TP-0066 Planner D RL 후학습 | 시나리오·seed 균등 | 과제 공간이 (시나리오 × 레벨 × 보행자)로 다차원이라 순서를 매길 수 없다 — 같은 문제 |

**옮길 때 조심할 것 둘.** 첫째, LP는 **보상의 차이**라 보상이 잡음이 크면 진척 추정도 흔들린다. travplan의 폐루프
지표는 성공/실패가 이산적이라(12/12) 그대로 쓰기 어렵고, GT cost나 진행 거리 같은 연속 지표를 보상으로 써야 한다.
둘째, 진척이 큰 과제를 더 뽑으면 **이미 푼 과제를 잊는다**. 위 논문은 학습 단계를 나눠 다시 재는 것으로 다루는데,
travplan처럼 과제 수가 적으면 균등 표집을 일부 섞는 편이 간단하다.

**하나 더 있다 — TP-0055.** 이 논문이 실물 배포에서 겪은 문제가 travplan의 L1 문제와 같다. 높이 격자를
elevation mapping으로 만들면 잡음이 끼고, 그 위에서 정책이 흔들린다. 논문의 답은 **특권 교사 → LSTM 학생 증류**다.
travplan의 Planner D는 L0에서 40/40인데 L1 belief에서 32/40으로 떨어진다(TP-0055). 같은 처방을 쓸 자리다.

**그 아래 층 자체는 아직 travplan의 범위가 아니다.** 스워브 모듈은 역기구학이 해석적이라 관절 RL이 필요 없다
(모듈 모델은 `travplan/robot/plant.py`). 다만 액추에이터 모델은 지금도 관련이 있다 — Hwangbo의 actuator net이
Isaac Lab의 `ActuatorNetMLP`로 이어지고, 그 파라메트릭 판이 unitree_rl_lab의 `UnitreeActuator`다
(시뮬레이션 문서 S.5.3c). travplan의 plant가 넣은 1차 지연이 그 자리의 가장 단순한 형태다.

### F.4 무엇을 보고 걷나 — 갈래가 셋이다

LP-ACRL은 **높이 격자를 본다**. 그런데 그것이 유일한 길이 아니다. 이 계열은 "정책이 무엇을 관측하는가"로 크게 셋으로 갈리고,
travplan이 어느 쪽을 참고할지는 이 갈래에 달려 있다.

| 갈래 | 관측 | 대표 | 강점 | 약점 |
|---|---|---|---|---|
| (a) **외수용 격자** | 고유수용 + 높이 지도 | Miki 2022, LP-ACRL, ANYmal Parkour | 지형을 미리 보고 발을 놓는다. 계단·징검다리에 강하다 | 지도가 틀리면 같이 틀린다. 매핑 파이프라인이 필요하다 |
| (b) **고유수용만(blind)** | 관절·IMU만 | **DreamWaQ**, DreamRiser | 센서가 싸고 매핑이 없다. 지도 오류에 면역이다 | 앞을 못 보니 미리 대비하지 못한다. 높은 계단에서 약하다 |
| (c) **카메라 직접** | 깊이 영상 | Extreme Parkour, Robot Parkour | 지도를 거치지 않아 지연이 적다 | 시야·조명에 약하고 학습이 무겁다 |

**(b) DreamWaQ — 지형을 "상상"한다**([arXiv:2301.10602](https://arxiv.org/abs/2301.10602), ICRA 2023, KAIST 도시로봇연구실
Nahrendra·Yu·Myung). ==외수용 센서 없이 고유수용만으로 주변 지형을 암묵적으로 추정한다.== 문맥 보조 추정기(CENet)가
관절 이력에서 지형·동역학 문맥을 잠재 벡터로 뽑고, 정책은 그 잠재 벡터를 조건으로 받는다. E.2의 RMA와 같은 뼈대인데
대상이 "환경 파라미터"가 아니라 **지형**이다. ICRA 2023 자율 사족보행 대회에서 1위였고, 경사 36°·고도차 22 m의 실외
장거리 주행을 보였다. 보상 함수를 다시 맞추지 않고도 다른 4족 로봇으로 옮겨진다는 점을 강조한다.

**DreamRiser — 넘어진 뒤 일어나는 것도 같은 방식으로**([arXiv:2306.12712](https://arxiv.org/abs/2306.12712), KAIST).
같은 "학습된 지형 상상"으로 **복구 동작**을 배운다. 스펀지·플라스틱 상자·울퉁불퉁한 바닥처럼 학습 분포 밖 지형에서
A1·Go1이 넘어진 뒤 일어나 다시 걷는다. ==로코모션 정책이 아니라 실패 뒤의 회복을 다룬 것이 특징이다.==

**DreamWaQ++ — (b)에서 (a)로 건너오면서 "믿을지 말지"를 배운다**([arXiv:2409.19709](https://arxiv.org/abs/2409.19709),
IEEE T-RO 2026, KAIST·KRAFTON·MIT). blind 기반 위에 외수용을 더하되, **PointNet 인코더 + 학습된 신뢰도 필터**를 두고
MLP-Mixer로 두 흐름을 50 Hz에 합친다. 계단 성공률 97.8%, 계단 50개 코스를 35초에, 합산 30 cm 장애물까지 넘는다.
시뮬에서 계단 구성별로 20–40%p 높은 성공률이고, 센서 구성이 다른 하드웨어 네 종으로 일반화한다.

==travplan에 가장 값진 것이 이 "신뢰도 필터"다.== travplan은 미관측·불확실을 `SIGMA` 채널로 들고 있지만 그것을 **믿을지
말지의 게이트로 쓰지 않는다**. DreamWaQ++는 외수용이 믿을 만할 때만 쓰고 아니면 고유수용으로 물러난다. L1 belief에서
Planner D가 떨어지는 문제(TP-0055)에 그대로 대응한다.

**(c) 지형 인지 발놓기**([arXiv:2310.04675](https://arxiv.org/abs/2310.04675), Shi 외, Tencent Robotics X). 매개변수화된
궤적 생성기를 두고 RL이 발 높이·보폭 주기 같은 **파라미터만** 조절한다. 보상 둘이 핵심이다 — 안전한 곳에 발을 놓게 하는 항과
발 들어올림을 아끼게 하는 항. 25.5 cm가 넘는 징검다리 간격을 실물로 넘었다. ==정책이 관절을 직접 내지 않고 생성기의
파라미터를 낸다는 구조가 travplan의 Planner D(제어 공간 생성)와 닮았다.==

### F.5 RL과 MPC를 섞는 갈래 — travplan의 Controller 결정과 같은 질문

4족 쪽에서도 "RL이냐 MPC냐"를 한쪽으로 고르지 않고 섞는 연구가 따로 있다. ==2026-09-30에 travplan이 내린 결정(MPPI와
NMPC를 함께 개발한다)과 같은 질문이다.==

| 방식 | 하는 일 | travplan과 닿는 곳 |
|---|---|---|
| **확률 제약 MPC** ([코드](https://github.com/RIVeR-Lab/Chance-Constrained-MPC)) | 불확실성을 전파해 마찰 원뿔·접촉력 제약을 **적응적으로 조인다** | ==TP-0069·TP-0076의 원형== |
| RL 보강 MPC (TechRxiv 2026) | MPC가 제약을 지키고, 특권 학습 RL이 모델에 없는 하중·지형 효과를 실시간 보정 | TP-0068 잔차 + TP-0071 제약의 조합 |
| [MULE](https://arxiv.org/abs/2505.00488) (2025) | 미지의 하중과 지형에 적응하는 RL | 화물 무게가 변하는 배달로봇 |

**확률 제약 MPC를 특히 볼 만하다**(*Chance-Constrained Convex MPC for Robust Quadruped Locomotion Under Parametric and
Additive Uncertainties*). 단일 강체 동역학의 관성과 접촉 위치를 확률 분포로 두고 테일러 전개로 불확실성을 전파한 뒤,
그만큼 제약을 조인다. 결과가 중요하다 — ==**손으로 맞춘 제약 조이기**와 선형 MPC를 둘 다 이겼고, 모델에 없는 7.5 kg
화물까지 견뎠다.== travplan의 TP-0071은 지금 여유를 **손으로 0.15 m 고정**해 두었고(M.3.5), 그것이 이 논문이 이긴
기준선이다. TP-0069가 가야 할 방향을 실물로 보여 준다.

### F.6 오픈소스 — 이 계열은 코드가 잘 열려 있다

| 저장소 | 무엇 | 별 | 비고 |
|---|---|---|---|
| [IsaacLab](https://github.com/isaac-sim/IsaacLab) | 학습 환경 표준. LP-ACRL·unitree_rl_lab이 이 위에 있다 | 8.3k | BSD-3 |
| [legged_gym](https://github.com/leggedrobotics/legged_gym) | Rudin 2021의 환경. 이 계열 거의 전부의 출발점 | 3.1k | Isaac Gym 기반(구세대) |
| [rsl_rl](https://github.com/leggedrobotics/rsl_rl) | GPU 전용 경량 RL 라이브러리. PPO + **교사–학생 증류**, RND, 대칭 증강 | 3.0k | [논문](https://arxiv.org/abs/2509.10771) |
| [unitree_rl_lab](https://github.com/unitreerobotics/unitree_rl_lab) | Isaac Lab 위의 Unitree 로봇. **바퀴 달린 Go2-W 설정 포함** | 1.4k | 시뮬 문서 S.5.3c |
| [walk-these-ways](https://github.com/Improbable-AI/walk-these-ways) | 행동 다양성으로 일반화. Go1 배포 코드 포함 | 1.5k | 2024 이후 정체 |
| [extreme-parkour](https://github.com/chengxuxin/extreme-parkour) | 단일 전방 깊이 카메라로 파쿠르, 20시간 학습 | 1.2k | [논문](https://arxiv.org/abs/2309.14341) ICRA 2024 |

==`rsl_rl`이 travplan에 직접 쓸 수 있는 유일한 조각이다.== 4족 환경이 아니라 **PPO와 교사–학생 증류 구현** 자체이고,
TP-0066(Planner D 폐루프 RL 후학습)과 TP-0055(L1 belief 증류)가 필요로 하는 것이 정확히 그 둘이다.
DreamWaQ 계열은 프로젝트 페이지에 코드 공개 표시가 없다.

### F.7 장단점 비교 — travplan 관점에서

지금까지의 갈래를 한 표로 모은다. 마지막 열이 판단이다.

| 방식 | 센서 요구 | 지형 정보가 틀릴 때 | 학습 비용 | 실물 검증 | travplan 적합도 |
|---|---|---|---|---|---|
| **외수용 격자 + 수동 커리큘럼**<br>(Rudin, Miki) | 높이 지도 필요 | 같이 틀린다 | 중간 | 강함 | 지형 레벨 개념의 출처. 이미 TP-0039로 들어와 있다 |
| **외수용 격자 + 자동 커리큘럼**<br>(LP-ACRL) | 높이 지도 필요 | 같이 틀린다 | **가장 적음**(1,500 vs 3,000+) | ANYmal D 3.0 m/s | ==**높음** — 우리가 지금 균등 표집을 쓴다(F.3)== |
| **고유수용만**<br>(DreamWaQ, DreamRiser) | 관절·IMU만 | **면역** | 적음 | 대회 1위, 실외 장거리 | 낮음 — travplan은 이미 지도를 만든다. 다만 **지도 실패 시 폴백**의 사고방식은 가져올 값이 있다 |
| **신뢰도 필터로 융합**<br>(DreamWaQ++) | 지도 + 고유수용 | **믿을 만할 때만 쓴다** | 큼(두 흐름) | 계단 97.8%, 4개 기종 | ==**높음** — TP-0055(L1에서 40/40 → 32/40)에 그대로 대응== |
| **카메라 직접**<br>(Extreme Parkour) | 깊이 카메라 | 해당 없음(지도를 안 만듦) | 큼 | 저가 로봇 파쿠르 | 낮음 — travplan은 TravMap이 공통 표현이라 구조가 어긋난다 |
| **궤적 생성기 + RL 파라미터**<br>(Shi 2023) | 지도 | 생성기가 받쳐 준다 | 중간 | 징검다리 25.5 cm | 중간 — Planner D의 "제어 공간 생성"과 구조가 닮았다 |
| **확률 제약 MPC**<br>(RIVeR) | 상태 추정 | 제약을 그만큼 조인다 | 없음(학습 아님) | 7.5 kg 미지 하중 | ==**높음** — TP-0069·0076이 가려는 곳의 실물 선례== |
| **RL 보강 MPC** | 상태 추정 + 학습 | MPC가 제약을 지킨다 | 중간 | 시뮬 위주 | 중간 — TP-0068 + TP-0071의 조합과 같은 그림 |

**세 줄로 줄이면 이렇다.**

1. **바로 쓸 것은 LP-ACRL의 표집과 DreamWaQ++의 신뢰도 필터다.** 앞은 우리가 균등 표집을 쓰고 있어서,
   뒤는 L1 지도 잡음에서 정책이 무너져서다. 둘 다 travplan에 이미 열린 TODO(TP-0073·0075, TP-0055)를 겨냥한다.
2. **확률 제약 MPC는 Controller 트랙의 실물 근거다.** 손으로 맞춘 조이기를 이겼다는 결과가, 지금 0.15 m로 고정해 둔
   TP-0071의 여유를 TP-0069로 옮길 이유가 된다.
3. ==**관절 RL 자체는 여전히 범위 밖이다.**== 스워브는 모듈 역기구학이 해석적이라 배울 것이 없다. 이 계열에서 가져오는 것은
   **학습 절차**(커리큘럼, 증류, 신뢰도 게이트)이지 정책이 아니다.
