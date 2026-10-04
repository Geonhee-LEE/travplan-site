<!-- doc: 강화학습 | 5 -->
# 강화학습 (§R) — 버클리 CS 185/285의 순서로 읽는다

**결론 먼저.** ==이 문서는 강화학습(reinforcement learning, RL)을 버클리 CS 185/285(Deep Reinforcement Learning, Sergey Levine, 2026 봄)의 강의 순서대로 정리하고, 절마다 travplan이 그 방법을 어디에 쓰는지 잇는다.==
travplan은 이미 세 자리에서 강화학습을 쓴다. Planner D의 폐루프 후학습(TP-0066), Playground 학습 Controller의 진화 전략(TP-0128), 그리고 모델을 굴려 행동을 고르는 MPPI(TP-0150)다.
강의 슬라이드와 영상은 [과목 홈페이지](https://rail.eecs.berkeley.edu/deeprlcourse/)에 있다. 이 문서는 그 순서를 따르되 설명은 새로 썼고, 수식은 표준 표기로 다시 적었다.

**강의와 이 문서.** 25강 가운데 복습 두 강을 뺀 주제를 절 16개로 묶었다. 확산·flow 정책의 강화학습과 안전 제약(R.13)은 강의 밖이지만, Planner D가 flow matching 정책이라 따로 두었다.

| 강의 | 주제 | 이 문서 | travplan에서 |
|---|---|---|---|
| 2–3 | 행동 복제(모방학습) | R.2 | Planner D의 시연 학습, DAgger(TP-0073, TP-0143) |
| 4 | RL 기초 | R.1 | 벤치마크 에피소드 하나가 MDP의 궤적 하나 |
| 5 | 정책 기울기 | R.3 | TP-0128의 진화 전략, TP-0066의 그룹 기준선 |
| 6 | actor-critic | R.4 | rsl_rl의 PPO(Controller 문서) |
| 7–8 | 가치 기반 RL, Q-learning | R.6 | 오프라인 RL과 확산 정책 critic의 바탕 |
| 9–10 | 고급 정책 기울기(자연 기울기, TRPO, PPO) | R.5 | 보행 정책 학습의 표준 |
| 11–12 | 변분 추론 | R.7 | VQ-VAE(배경 0.14), diffusion의 ELBO |
| 13 | 제어를 추론으로 | R.8 | MPPI의 지수 가중(배경 0.2) |
| 14 | LLM RL | R.12 | TP-0066의 그룹 상대 이점(GRPO) |
| 15–16 | 모델 기반 RL | R.9 | `mppi_plant_lag`(TP-0150), 예측 모델 계층(TP-0124–0126) |
| 17–18 | 오프라인 RL | R.10 | TP-0066의 AWR 가중 flow matching |
| 19, 23 | 탐색 | R.11 | 후학습 후보의 다양성 |
| 20 | RL 이론 | R.14 | 잡음 바닥과 짝 비교(TP-0078) |
| 24–25 | 다과제 RL, 남은 문제 | R.15 | 지형 레벨 0–3 커리큘럼, plant 적응 |
| 강의 밖 | 확산·flow 정책의 RL, 안전 RL | R.13 | Planner D 후학습의 다음 후보 |

**표기.** 상태 $s_t$, 행동 $a_t$, 관측 $o_t$, 보상 $r(s_t, a_t)$, 할인율 $\gamma \in [0, 1)$, 정책 $\pi_\theta(a \mid s)$를 쓴다.
궤적은 $\tau = (s_0, a_0, s_1, a_1, \dots)$이고 그 수익은 $R(\tau) = \sum_t \gamma^t r_t$다.
상태 가치는 $V^\pi(s)$, 행동 가치는 $Q^\pi(s, a)$, 이점은 $A^\pi(s, a) = Q^\pi(s, a) - V^\pi(s)$다.

**처음 읽는 사람의 순서.** R.1, R.2, R.3, R.5, R.8, R.16 순서로 읽으면 travplan이 강화학습을 쓰는 세 자리를 모두 이해할 수 있다.

<!-- tab: 문제 설정·모방 -->

### R.1 문제 설정: MDP, 목표, 가치 함수 (4강)

**한 줄로.** ==강화학습은 상태에서 행동을 고르면 보상과 다음 상태가 나오는 반복에서, 보상의 기댓값이 가장 큰 정책을 찾는 문제다.==

Markov 결정 과정(Markov decision process, MDP)은 상태 집합, 행동 집합, 전이 확률 $p(s_{t+1} \mid s_t, a_t)$, 보상 $r(s_t, a_t)$로 정한다.
다음 상태가 지금의 상태와 행동에만 달렸다는 가정이 Markov 성질이다.
로봇은 보통 상태 전체를 보지 못하고 관측 $o_t$만 본다. 이것이 부분 관측 MDP(partially observable MDP, POMDP)다.
그래서 정책은 과거 관측을 기억하거나, 관측을 모아 만든 믿음(belief)을 상태 대신 쓴다.

목표는 정책이 만드는 궤적 분포 위에서 수익의 기댓값을 가장 크게 만드는 것이다.

$$ J(\theta) = \mathbb E_{\tau \sim p_\theta(\tau)} \Big[ \sum_t \gamma^t r(s_t, a_t) \Big], \qquad p_\theta(\tau) = p(s_0) \prod_t \pi_\theta(a_t \mid s_t)\, p(s_{t+1} \mid s_t, a_t) $$

가치 함수는 이 기댓값을 상태별로 쪼갠 것이고, 두 가치 함수는 Bellman 식으로 서로를 정의한다.

$$ Q^\pi(s, a) = r(s, a) + \gamma\, \mathbb E_{s' \sim p(\cdot \mid s, a)} \big[ V^\pi(s') \big], \qquad V^\pi(s) = \mathbb E_{a \sim \pi(\cdot \mid s)} \big[ Q^\pi(s, a) \big] $$

알고리즘은 이 식의 어느 쪽을 배우느냐로 나뉜다.

| 갈래 | 배우는 것 | 표본 효율 | 약점 | travplan의 예 |
|---|---|---|---|---|
| 정책 기울기(R.3, R.5) | 정책 | 낮다(on-policy) | 분산이 크다 | TP-0128 진화 전략 |
| actor-critic(R.4) | 정책과 가치 | 중간 | critic 편향 | 보행 정책의 PPO |
| 가치 기반(R.6) | 행동 가치 | 높다(off-policy) | 발산할 수 있다 | 없음 |
| 모델 기반(R.9) | 전이 모델 | 가장 높다 | 모델 오차를 계획이 이용한다 | MPPI(`mppi_plant_lag`) |

**travplan에서.** 벤치마크 에피소드 하나가 MDP의 궤적 하나다. 상태는 로봇의 자세·속도와 지형이고, 관측은 L1 belief(TravMap)다.
그래서 travplan의 Planner와 Controller는 POMDP의 정책이다. 벤치마크 판정(도달, 치명, 시간 초과)은 에피소드 끝에 한 번 나오는 성긴 보상이다.

### R.2 모방학습: 행동 복제와 분포 이동 (2–3강)

**한 줄로.** ==시연을 지도학습으로 따라 하면(행동 복제) 쉽게 배우지만, 작은 실수가 시연에 없던 상태로 이어져 오차가 쌓인다.==

행동 복제(behavioral cloning, BC)는 시연 $(o_t, a_t)$를 지도학습 자료로 보고 $\max_\theta \sum_t \log \pi_\theta(a_t \mid o_t)$를 푼다.
문제는 분포 이동이다. 학습 정책이 한 번 틀리면 시연자가 가 본 적 없는 상태에 들어가고, 거기서는 더 틀린다.
한 스텝의 실수 확률이 $\epsilon$이면, 길이 $T$인 에피소드의 비용은 최악의 경우 $T^2 \epsilon$에 비례해 커진다.

대책은 셋이다.
1. **DAgger**(dataset aggregation, [arXiv:1011.0686](https://arxiv.org/abs/1011.0686)). 학습 정책으로 달리며 방문한 상태에 전문가 행동을 다시 붙여 자료에 더한다. 학습 분포가 실행 분포를 따라가므로 비용이 $T\epsilon$에 비례하는 수준으로 준다(배경 0.12).
2. **다봉 분포를 그대로 배운다.** 시연이 왼쪽과 오른쪽으로 갈라지면, 가우시안 하나의 평균은 그 사이의 장애물로 간다. 혼합 분포, 이산 토큰, diffusion, flow matching 정책을 쓴다(배경 0.5, 0.6).
3. **행동 묶음과 관측 이력.** 여러 스텝을 한 번에 내면 결정 횟수가 줄어 오차가 덜 쌓이고, 관측 이력을 넣으면 POMDP의 기억을 채운다.

**travplan에서.** Planner D는 Guidance + MPPI 시연을 flow matching으로 따라 하는 행동 복제다. flow matching을 고른 이유가 다봉 시연이다.
경사로를 지나친 상태처럼 시연에 없던 상태에서 무너지는 것이 분포 이동이고, TP-0073과 TP-0143의 DAgger가 그 대책이었다.

<!-- tab: 정책 기울기 -->

### R.3 정책 기울기: REINFORCE와 분산 줄이기 (5강)

**한 줄로.** ==잘된 궤적의 행동 확률을 높이고 못된 궤적의 행동 확률을 낮추면, 보상이나 시뮬레이터를 미분하지 않고도 목표의 기울기를 얻는다.==

로그 미분 요령 $\nabla_\theta p_\theta(\tau) = p_\theta(\tau) \nabla_\theta \log p_\theta(\tau)$을 쓰면 전이 확률이 기울기에서 사라진다.

$$ \nabla_\theta J(\theta) = \mathbb E_{\tau \sim p_\theta} \Big[ \sum_t \nabla_\theta \log \pi_\theta(a_t \mid s_t)\, \hat Q_t \Big], \qquad \hat Q_t = \sum_{t' \ge t} \gamma^{t'-t} r_{t'} $$

이것이 REINFORCE다. 표본 궤적만 있으면 되지만, 분산이 커서 표본이 많이 든다. 분산을 줄이는 요령은 둘이다.
- **인과성.** 시각 $t$의 행동은 그 전의 보상을 바꾸지 못하므로, $t$ 뒤의 보상(reward-to-go)만 곱한다. 위 식의 $\hat Q_t$가 그것이다.
- **기준선(baseline).** 행동에 의존하지 않는 $b(s_t)$를 $\hat Q_t$에서 빼도 기댓값은 그대로이고 분산은 준다. 상태 가치 $V(s_t)$를 쓰면 이점 $\hat A_t = \hat Q_t - V(s_t)$가 된다(R.4).

정책 기울기는 on-policy다. 한 번 고친 뒤에는 새 정책으로 표본을 다시 모아야 한다.
이전 정책의 표본을 다시 쓰려면 중요도 비율 $\pi_\theta(a \mid s) / \pi_{\theta_{\text{old}}}(a \mid s)$를 곱하고, 비율이 크게 벗어나지 않게 막아야 한다(R.5).

<details markdown="1">
<summary>자세히: 기준선이 기댓값을 바꾸지 않는 이유와 진화 전략</summary>

**기준선.** 행동에 대해 적분하면 $\mathbb E_{a \sim \pi_\theta}[\nabla_\theta \log \pi_\theta(a \mid s)\, b(s)] = b(s)\, \nabla_\theta \int \pi_\theta(a \mid s)\, da = b(s)\, \nabla_\theta 1 = 0$이다.
그래서 $b$는 무엇을 써도 기댓값을 바꾸지 않고, 잘 고르면 분산만 준다. 분산을 최소로 만드는 $b$는 기울기 크기로 가중한 수익의 평균이고, 실제로는 $V(s)$를 쓴다.

**진화 전략(evolution strategies, ES, [arXiv:1703.03864](https://arxiv.org/abs/1703.03864)).** 행동 대신 정책 파라미터에 잡음을 준다.
파라미터를 $\theta + \sigma \epsilon_i$, $\epsilon_i \sim \mathcal N(0, I)$로 흔들어 에피소드 수익 $F_i$를 재고, 다음 근사로 고친다.

$$ \nabla_\theta\, \mathbb E_{\epsilon} \big[ F(\theta + \sigma\epsilon) \big] \approx \frac{1}{n\sigma} \sum_{i=1}^n F_i\, \epsilon_i $$

이것은 파라미터 공간의 REINFORCE다. 에피소드 수익만 있으면 되므로 판정이 계단 함수여도 쓸 수 있고, 개체를 한 배치로 굴려 병렬화하기 쉽다.
PolyStep(배경 0.2b ①b)은 가우시안 잡음 대신 회전한 다면체 꼭짓점을 쓰고, softmax로 가중한 무게중심으로 옮긴다.

**travplan에서.** TP-0128의 Playground 정책(가중치 1,675개)은 보상이 벤치마크 판정 그 자체라 OpenAI-ES로 학습했다(Controller 문서 E.12).
TP-0066은 같은 상태에서 뽑은 후보 16개의 점수에서 그룹 평균을 빼 이점으로 쓴다. 기준선으로 같은 상태의 다른 표본을 쓰는 것이다(R.12의 GRPO). 다만 기울기는 로그 확률이 아니라 AWR 가중 flow matching으로 준다(R.10).

</details>

### R.4 Actor-critic: 가치를 배워 기울기의 분산을 줄인다 (6강)

**한 줄로.** ==정책(actor)과 함께 가치 함수(critic)를 배워, 몬테카를로 수익 대신 한 스텝 앞을 내다본 이점을 쓰면 분산이 크게 준다.==

critic $V_\phi(s)$는 회귀로 배운다. 목표값은 몬테카를로 수익이나 한 스텝 부트스트랩 $r_t + \gamma V_\phi(s_{t+1})$이다.
부트스트랩은 분산이 작지만, critic이 틀리면 편향이 생긴다. 이점은 시간차(temporal difference, TD) 오차로 추정한다.

$$ \delta_t = r_t + \gamma V_\phi(s_{t+1}) - V_\phi(s_t), \qquad \hat A_t^{\mathrm{GAE}(\lambda)} = \sum_{l \ge 0} (\gamma \lambda)^l\, \delta_{t+l} $$

일반화 이점 추정(generalized advantage estimation, GAE, [arXiv:1506.02438](https://arxiv.org/abs/1506.02438))의 $\lambda$가 편향과 분산을 고른다.
$\lambda = 0$이면 한 스텝 TD(분산은 작고 편향은 큼)이고, $\lambda = 1$이면 몬테카를로(편향은 없고 분산은 큼)다. 보통 0.95 안팎을 쓴다.
지금의 표준은 병렬 환경 수천 개에서 표본을 모아 한꺼번에 고치는 것이다(Isaac Lab, rsl_rl).

**비대칭 actor-critic.** 시뮬레이터에서는 critic에 정답 지형, 마찰, 정확한 속도 같은 특권 정보를 준다. 배포할 때는 actor만 쓰므로, critic은 실제 센서에 없는 정보를 써도 된다.
그러면 가치 추정이 정확해져 학습이 빠르고 안정된다(Planner 문서 B.9의 RoM-Nav, 배경 0.12의 특권 교사).

**travplan에서.** Controller 문서의 rsl_rl(PPO와 교사–학생 증류)이 이 갈래다. Planner D를 폐루프로 더 다듬는다면, critic에는 GT 지도와 plant 상태를 주고 actor에는 L1 belief만 주는 비대칭 구성이 자연스럽다.

### R.5 고급 정책 기울기: 자연 기울기, TRPO, PPO (9–10강)

**한 줄로.** ==정책을 한 번에 너무 많이 바꾸면 모아 둔 표본이 새 정책에 맞지 않으므로, 정책 사이의 KL 거리로 한 번의 갱신 폭을 묶는다.==

새 정책의 성능 향상은, 옛 정책이 방문한 상태에서 잰 새 정책의 이점으로 근사할 수 있다. 두 정책이 가까울 때만 맞는 근사라서 거리를 함께 제약한다.

$$ \max_{\theta'}\ \mathbb E_{s \sim d^{\pi_\theta},\ a \sim \pi_\theta} \Big[ \frac{\pi_{\theta'}(a \mid s)}{\pi_\theta(a \mid s)}\, A^{\pi_\theta}(s, a) \Big] \quad \text{s.t.} \quad \mathbb E_s\, D_{\mathrm{KL}}\big( \pi_\theta(\cdot \mid s) \,\Vert\, \pi_{\theta'}(\cdot \mid s) \big) \le \epsilon $$

- **자연 기울기(natural gradient).** KL의 2차 근사가 Fisher 정보 행렬 $F$라서, 갱신은 $\theta' = \theta + \alpha F^{-1} \nabla_\theta J$가 된다. 파라미터 좌표가 아니라 정책 분포의 거리로 걸음 폭을 잰다.
- **TRPO**([arXiv:1502.05477](https://arxiv.org/abs/1502.05477)). 위 제약을 켤레 기울기와 선 탐색으로 지킨다.
- **PPO**([arXiv:1707.06347](https://arxiv.org/abs/1707.06347)). 제약 대신 비율 $\rho_t = \pi_{\theta'}(a_t \mid s_t) / \pi_\theta(a_t \mid s_t)$를 자른다.

$$ L^{\mathrm{CLIP}}(\theta') = \mathbb E_t \Big[ \min\big( \rho_t \hat A_t,\ \operatorname{clip}(\rho_t, 1-\epsilon, 1+\epsilon)\, \hat A_t \big) \Big] $$

PPO는 구현이 쉽고 병렬 시뮬레이션과 잘 맞아, 보행·조작·언어 모델에서 표준이 됐다. 대부분 GAE(R.4)와 함께 쓴다.

**travplan에서.** 보행 정책 문헌(Controller 문서, 시뮬레이션 문서 S.5)과 CaRL(Planner 문서 B.11)이 모두 PPO다.
Planner D처럼 로그 확률을 바로 계산하기 어려운 생성 정책에 PPO를 쓰는 방법은 R.13에 있다.

<!-- tab: 가치 기반 -->

### R.6 가치 기반 RL과 Q-learning (7–8강)

**한 줄로.** ==행동 가치를 Bellman 식의 고정점으로 배우고 그 최댓값을 내는 행동을 고르면, 정책을 따로 두지 않아도 된다.==

가치 반복은 $Q(s, a) \leftarrow r(s, a) + \gamma\, \mathbb E_{s'} [\max_{a'} Q(s', a')]$를 되풀이한다. 표본으로 이것을 근사하는 것이 fitted Q-iteration이고, 신경망으로 하면 다음 손실이 된다.

$$ \mathcal L(\phi) = \mathbb E_{(s, a, r, s') \sim \mathcal D} \Big[ \big( Q_\phi(s, a) - r - \gamma \max_{a'} Q_{\bar\phi}(s', a') \big)^2 \Big] $$

자료 $\mathcal D$는 어떤 정책이 모은 것이어도 되므로 off-policy다(재생 버퍼). 대신 함수 근사와 함께 쓰면 수렴이 보장되지 않는다.
DQN([arXiv:1312.5602](https://arxiv.org/abs/1312.5602)) 이후의 안정화 요령은 이렇다.
- **목표망.** 목표값을 천천히 따라오는 사본 $\bar\phi$로 계산한다.
- **Double Q**([arXiv:1509.06461](https://arxiv.org/abs/1509.06461)). 행동을 고르는 망과 값을 매기는 망을 나눠, 최댓값의 과대평가를 줄인다. TD3([arXiv:1802.09477](https://arxiv.org/abs/1802.09477))는 두 critic 가운데 작은 값을 쓴다.
- **연속 행동.** 최댓값을 직접 풀 수 없으므로, 행동을 내는 actor를 따로 둔다(DDPG [arXiv:1509.02971](https://arxiv.org/abs/1509.02971), TD3, SAC). 그러면 actor-critic과 같은 모양이 된다.

**travplan에서.** 연속 행동의 주행에 순수 Q-learning은 쓰지 않는다. 그래도 오프라인 RL(R.10)과 확산 정책의 critic(R.13)이 모두 이 손실 위에 서 있다.

<!-- tab: 추론으로서의 제어 -->

### R.7 변분 추론: 다루기 어려운 분포를 근사한다 (11–12강)

**한 줄로.** ==직접 계산할 수 없는 사후분포를 다루기 쉬운 분포로 근사하고 그 차이(KL)를 줄이는 것이 변분 추론이고, 강화학습에서는 잠재 동역학과 "제어를 추론으로" 보는 관점에 쓰인다.==

잠재 변수 $z$를 가진 모델 $p(x, z)$에서 $\log p(x)$는 계산하기 어렵다. 아무 분포 $q(z)$에 대해서나 다음 증거 하한(evidence lower bound, ELBO)이 성립한다.

$$ \log p(x) \ge \mathbb E_{z \sim q} \big[ \log p(x \mid z) \big] - D_{\mathrm{KL}}\big( q(z) \,\Vert\, p(z) \big) $$

두 변의 차이가 $D_{\mathrm{KL}}(q(z) \Vert p(z \mid x))$이므로, ELBO를 크게 만들면 $q$가 참 사후분포에 다가간다.
VAE는 $q(z \mid x)$를 신경망으로 두고 재파라미터화로 학습한다. 강화학습에서는 두 곳에 쓰인다. 하나는 잠재 동역학 모델(R.9의 Dreamer)이고, 다른 하나는 다음 절의 관점이다.

**travplan에서.** VQ-VAE(배경 0.14)가 이 계열이다. diffusion은 ELBO로 유도되고(배경 0.5), Planner D의 flow matching은 ELBO 대신 속도장 회귀를 쓴다(배경 0.6).

### R.8 제어를 추론으로: 최대 엔트로피 RL과 MPPI (13강)

**한 줄로.** ==궤적이 "최적"일 확률을 보상의 지수로 두면 최적 행동을 고르는 일이 확률 추론이 되고, 그 답은 보상의 지수로 가중한 평균이다.==

각 시각에 "이 스텝이 최적이다"라는 이진 변수 $\mathcal O_t$를 두고, 보상이 0 이하라고 할 때 $p(\mathcal O_t = 1 \mid s_t, a_t) = \exp(r(s_t, a_t))$로 정한다([arXiv:1805.00909](https://arxiv.org/abs/1805.00909)).
그러면 최적 궤적의 사후분포는 다음과 같다.

$$ p(\tau \mid \mathcal O_{1:T}) \propto p(\tau)\, \exp\Big( \sum_t r(s_t, a_t) \Big) $$

이 사후분포를 정책으로 근사하는 ELBO를 풀면, 보상에 엔트로피 보너스를 더한 최대 엔트로피 RL이 나온다.

$$ J_{\mathrm{ent}}(\pi) = \mathbb E_\pi \Big[ \sum_t r(s_t, a_t) + \alpha\, \mathcal H\big( \pi(\cdot \mid s_t) \big) \Big] $$

가치 함수는 최댓값 대신 log-sum-exp를 쓰는 soft Bellman 식을 따르고, 최적 정책은 $\pi(a \mid s) \propto \exp(Q(s, a)/\alpha)$다.
SAC(soft actor-critic, [arXiv:1801.01290](https://arxiv.org/abs/1801.01290))가 이 식을 actor-critic으로 푼 것이다. 엔트로피 항은 탐색을 유지하고 여러 해를 함께 남긴다.

**MPPI가 여기서 나온다.** 정책을 학습하지 않고 매 스텝 행동열 $U$를 직접 추론하면, 같은 사후분포가 행동열 위의 분포 $q^*(U) \propto p(U) \exp(-J(U)/\lambda)$가 된다.
표본 $U_k$를 뽑아 $w_k \propto \exp(-J_k/\lambda)$로 평균하는 것이 MPPI다(배경 0.2). 온도 $\lambda$가 SAC의 $\alpha$에 해당한다.

**travplan에서.** travplan의 Controller인 MPPI는 이 관점의 표본 판이다. 사후분포를 정하는 것은 비용과 모델 둘이다.
TP-0150은 모델 쪽을 보였다. rollout이 plant의 지연을 모르면 사후분포가 틀린 곳에 몰려 치명이 55번 났고, 지연을 넣자 4번이 됐다(R.9).

<details markdown="1">
<summary>자세히: soft Bellman 식과 최적 정책</summary>

후방 메시지 $\beta_t(s_t, a_t) = p(\mathcal O_{t:T} \mid s_t, a_t)$를 두고 $Q = \log \beta$, $V(s) = \log \int \exp Q(s, a)\, da$로 쓰면 다음이 나온다.

$$ Q(s_t, a_t) = r(s_t, a_t) + \log \mathbb E_{s_{t+1}} \big[ \exp V(s_{t+1}) \big], \qquad V(s_t) = \log \int \exp Q(s_t, a_t)\, da_t $$

$\log \mathbb E[\exp V]$는 전이가 확률적일 때 운이 좋은 경우를 과대평가한다. 그래서 정책은 사후분포 그대로가 아니라 변분 근사로 구한다.
그러면 기댓값 $\mathbb E[V(s_{t+1})]$을 쓰는 soft Bellman 식이 되고, 최적 정책은 $\pi(a \mid s) = \exp(Q(s, a) - V(s))$다. 온도를 넣으면 $\pi \propto \exp(Q/\alpha)$다.

**travplan에서.** MPPI의 온도를 낮추면 가장 좋은 표본 하나에 몰리고(탐욕), 높이면 평균에 가까워진다. 엔트로피 보너스의 크기를 고르는 것과 같은 선택이다.

</details>

<!-- tab: 모델 기반 -->

### R.9 모델 기반 RL: 동역학을 배워 계획한다 (15–16강)

**한 줄로.** ==전이 모델을 배우면 실제 상호작용 없이 머릿속으로 굴려 볼 수 있어 표본 효율이 높지만, 계획은 모델이 틀린 곳을 찾아가 이용한다.==

가장 단순한 판은 이렇다. 자료로 $f_\psi(s, a) \approx s'$를 회귀하고, 그 모델로 행동열을 최적화해 첫 행동만 실행한 뒤 다시 계획한다(model predictive control, MPC).
계획기는 경사법, CEM, MPPI 무엇이든 된다. 문제는 모델 오차의 이용이다. 계획기는 모델이 실제보다 좋게 보는 행동을 골라낸다. 대책은 셋이다.
- **불확실성.** 앙상블이나 확률 모델로 모델이 모르는 곳을 표시하고, 그 분포 위에서 계획한다(PETS, [arXiv:1805.12114](https://arxiv.org/abs/1805.12114)).
- **짧은 rollout.** 실제 상태에서 시작해 모델로는 몇 스텝만 굴려 자료를 늘린다(MBPO, [arXiv:1906.08253](https://arxiv.org/abs/1906.08253)). Dyna가 원형이다.
- **잠재 공간 모델.** 영상 같은 고차원 관측을 잠재 상태로 줄여 그 안에서 굴린다(Dreamer [arXiv:1912.01603](https://arxiv.org/abs/1912.01603), TD-MPC2 [arXiv:2310.16828](https://arxiv.org/abs/2310.16828)).

| 방법 | 모델 | 정책을 만드는 방법 |
|---|---|---|
| MPC + 학습 모델 | 결정적 또는 확률 | 매 스텝 계획(CEM, MPPI) |
| PETS | 확률 앙상블 | 앙상블로 전파하고 CEM으로 고른다 |
| Dyna, MBPO | 확률 앙상블 | 모델 rollout으로 늘린 자료로 SAC |
| Dreamer | 잠재 상태 공간 모델 | 잠재 rollout 안의 actor-critic |
| TD-MPC2 | 잠재 결정적 모델, 보상, 가치 | 잠재 MPPI, 끝은 가치로 잇는다 |

**travplan에서.** travplan의 MPPI는 손으로 만든 모델(SwerveModel)을 쓰는 모델 기반 계획이다. 모델 오차의 효과가 TP-0149–0152에 그대로 나왔다.
- plant의 지연을 모르는 rollout은 실제보다 세 배 빨리 멈출 수 있다고 믿었다. 권장 L1 레벨 3에서 치명이 55번이었다. rollout에 지연을 넣자(`mppi_plant_lag`) 4번이 됐다.
- 같은 정보를 NMPC에 넣어 명령에서 지연을 되돌리면(`mpc_lag`) 오히려 나빠졌다. 정확한 모델만으로는 부족하고, 계획이 실행할 수 있는 명령을 내야 한다(MPC 문서 M.3.24).
- 다음 단계인 예측 모델 계층(TP-0124–0126)은 이 모델을 배우는 일이다. 배운 모델을 쓸 때는 위 세 대책, 특히 불확실성 표시가 필요하다.

![TP-0150](assets/figs/tp0150_plant_mppi.webp)
*그림 — TP-0150: 권장 L1 + 스워브 plant 레벨 3에서, MPPI rollout 모델에 plant의 지연을 넣으면 치명이 55에서 4로 준다. 모델 기반 계획에서 모델 오차가 결과를 정하는 예다. 출처: scripts/make_evidence_figures.py*

<!-- tab: 오프라인·탐색 -->

### R.10 오프라인 RL: 모은 자료만으로 시연보다 나은 정책 (17–18강)

**한 줄로.** ==새 상호작용 없이 고정된 자료로 정책을 개선하려면, 자료에 없는 행동의 가치를 과대평가하지 않게 막아야 한다.==

오프라인 RL은 자료 $\mathcal D$를 모은 정책 $\pi_\beta$보다 나은 정책을 같은 자료로 찾는다.
Q-learning(R.6)을 그대로 쓰면, 최댓값이 자료에 없는 행동의 틀린 값을 골라 오차가 커진다. 이것이 오프라인의 분포 이동이다. 방법은 세 갈래다.
- **정책 제약.** 새 정책을 $\pi_\beta$ 가까이에 묶는다. 이점으로 가중한 회귀(advantage-weighted regression, AWR, [arXiv:1910.00177](https://arxiv.org/abs/1910.00177))가 가장 단순하다.

$$ \pi_{\mathrm{new}} = \arg\max_\pi\ \mathbb E_{(s, a) \sim \mathcal D} \Big[ \log \pi(a \mid s)\, \exp\big( A(s, a) / \beta \big) \Big] $$

  KL 제약 아래 최적 정책은 $\pi_\beta(a \mid s) \exp(A(s, a)/\beta)$에 비례한다. 그래서 자료의 행동을 이점의 지수로 가중해 행동 복제하면 그 정책에 투영된다.
- **보수적 가치.** 자료에 없는 행동의 Q를 끌어내린다(CQL, [arXiv:2006.04779](https://arxiv.org/abs/2006.04779)).
- **표본 안의 기댓값.** 최댓값 대신 자료 안 행동의 높은 분위수(expectile)로 가치를 배워, 자료 밖 행동을 아예 묻지 않는다. 정책은 AWR로 뽑는다(IQL, [arXiv:2110.06169](https://arxiv.org/abs/2110.06169)).

**travplan에서.** TP-0066의 후학습이 AWR이다. 같은 상태의 후보 16개를 GT 지도에서 채점해 그룹 상대 이점을 만들고, 그 지수로 가중한 flow matching을 했다(Planner 문서 B.15.3). 이점의 지수 가중은 R.8의 MPPI 가중과 같은 꼴이다.
벤치마크가 남기는 에피소드 기록(`results/`)도 오프라인 RL의 자료가 될 수 있다. 다만 자료를 모은 정책(Guidance, MPPI)보다 나아지려면 IQL처럼 자료 밖 행동을 묻지 않는 방법이 필요하다.

### R.11 탐색: 모르는 곳에 가 볼 가치 (19·23강)

**한 줄로.** ==좋다고 아는 행동만 고르면 더 좋은 행동을 영영 찾지 못하므로, 불확실한 곳을 일부러 시도하게 하는 보너스나 표본을 둔다.==

- **낙관(optimism).** 덜 시도한 행동에 보너스를 준다. 밴딧의 UCB는 평균 보상에 $c\sqrt{\ln t / n_a}$를 더해 고른다. 큰 상태 공간에서는 방문 횟수를 밀도 모델의 의사 횟수로 대신한다.
- **사후 표본(Thompson sampling).** 가치나 모델의 사후분포에서 하나를 뽑아 그대로 행동한다. 앙상블 가운데 하나를 에피소드마다 고르는 것이 그 근사다.
- **예측 오차를 보상으로.** 다음 상태를 예측하지 못하는 정도를 새로움으로 쓴다. RND(random network distillation, [arXiv:1810.12894](https://arxiv.org/abs/1810.12894))는 고정된 무작위 망의 출력을 따라 배우는 오차를 쓴다.
- **보상 없는 기술 탐색.** 보상 없이 서로 구별되는 행동들을 먼저 배운다(DIAYN, [arXiv:1802.06070](https://arxiv.org/abs/1802.06070)). 다과제 학습(R.15)으로 이어진다.

**travplan에서.** Planner D 후학습의 탐색은 한 상태에서 후보 16개를 뽑는 다양성에서 나온다. 후보가 모두 같은 모드로 모이면 그룹 상대 이점이 0이 되어 배울 것이 없다.
경사로를 지나는 모드처럼 드문 모드를 남기려면 엔트로피 보너스나 후보 다양성 항이 필요하다.

<!-- tab: LLM·생성 정책·안전 -->

### R.12 언어 모델의 강화학습: RLHF, DPO, GRPO (14강)

**한 줄로.** ==언어 모델도 토큰을 행동으로 고르는 정책이므로, 사람 선호나 정답 검사로 만든 보상을 PPO 계열로 크게 만들되 원래 모델에서 너무 멀어지지 않게 묶는다.==

- **RLHF**([arXiv:2203.02155](https://arxiv.org/abs/2203.02155)). 응답 쌍에 대한 사람 선호로 보상 모델 $r_\phi$를 배우고(Bradley–Terry 모델), 다음 목표를 PPO로 푼다. KL 항은 정책이 보상 모델의 허점을 파고드는 것을 막는다.

$$ \max_\pi\ \mathbb E_{x,\ y \sim \pi(\cdot \mid x)} \big[ r_\phi(x, y) \big] - \beta\, D_{\mathrm{KL}}\big( \pi(\cdot \mid x) \,\Vert\, \pi_{\mathrm{ref}}(\cdot \mid x) \big) $$

- **DPO**([arXiv:2305.18290](https://arxiv.org/abs/2305.18290)). 위 목표의 최적 정책을 닫힌 형식으로 풀어, 보상 모델 없이 선호 쌍 $(y_w, y_l)$로 정책을 바로 학습한다.

$$ \mathcal L_{\mathrm{DPO}} = -\log \sigma\Big( \beta \log \frac{\pi(y_w \mid x)}{\pi_{\mathrm{ref}}(y_w \mid x)} - \beta \log \frac{\pi(y_l \mid x)}{\pi_{\mathrm{ref}}(y_l \mid x)} \Big) $$

- **GRPO**([arXiv:2402.03300](https://arxiv.org/abs/2402.03300)). 같은 질문에 응답을 $G$개 뽑고, 각 응답의 보상을 그룹 평균과 표준편차로 정규화해 이점으로 쓴다. critic(R.4) 없이 PPO의 자른 목표를 쓴다. 정답을 자동으로 검사할 수 있는 수학과 코드에 많이 쓴다.

$$ \hat A_i = \frac{r_i - \operatorname{mean}(r_1, \dots, r_G)}{\operatorname{std}(r_1, \dots, r_G)} $$

**travplan에서.** TP-0066의 그룹 상대 이점이 GRPO의 이점이다. Planner D가 한 상태에서 후보 16개를 내고, GT 지도의 점수를 그 그룹 안에서 정규화한다.
critic이 필요 없어서, 매 라운드 새 지형에서 채점하는 후학습과 잘 맞았다.

### R.13 확산·flow 정책의 강화학습과 안전 제약 (강의 밖)

**한 줄로.** ==diffusion·flow 정책은 다봉 행동을 잘 내지만 로그 확률을 바로 계산하기 어려워, 강화학습에 넣는 방법이 따로 필요하고 2024–2026년에 빠르게 나왔다.==

Planner D가 flow matching 정책이므로 이 절이 travplan과 가장 가깝다. 방법은 넷으로 묶인다.

| 방법 | 발표 | 로그 확률 문제를 푸는 법 | 쓰는 RL |
|---|---|---|---|
| DPPO | 2024, ICLR 2025 | denoising 스텝 하나하나를 가우시안 행동으로 보고, 환경 MDP 안에 denoising MDP를 넣는다 | PPO |
| FPO | 2025 | 가능도 비율 대신 조건부 flow matching 손실의 차이를 비율로 쓴다 | PPO 자른 목표 |
| ReinFlow | 2025, NeurIPS 2025 | flow의 결정적 경로에 학습하는 잡음을 넣어 이산 Markov 과정으로 만든다 | 정책 기울기 |
| QSM, SSM | ICML 2024, NeurIPS 2026 | 정책의 점수를 critic의 행동 기울기에 맞춘다 | off-policy actor-critic |

**DPPO**([arXiv:2409.00588](https://arxiv.org/abs/2409.00588), ICLR 2025, Princeton·MIT·Toyota Research Institute). 사전학습한 Diffusion Policy를 정책 기울기로 미세조정한다.
denoising의 각 스텝은 평균과 분산이 정해진 가우시안이라 그 스텝의 로그 확률이 계산된다. 그래서 환경 한 스텝을 denoising 스텝들로 된 MDP로 펼쳐 PPO를 돌린다.
Robomimic Transport 같은 긴 조작에서 성공률 90 %를 넘겼고, 시뮬에서 다듬은 정책을 실물에 zero-shot으로 옮겼다.

**FPO**([arXiv:2507.21053](https://arxiv.org/abs/2507.21053), 2025, UC Berkeley, [코드](https://github.com/akanazawa/fpo)). PPO의 비율을 $\hat\rho = \exp\big( \hat{\mathcal L}_{\mathrm{CFM}, \theta_{\mathrm{old}}} - \hat{\mathcal L}_{\mathrm{CFM}, \theta} \big)$로 바꾼다.
조건부 flow matching 손실은 가능도 하한(ELBO)의 대리라서, 손실이 줄면 그 행동의 가능도가 오른 것으로 본다. 적분 방식에 묶이지 않는다.
MuJoCo Playground 10과제 평균 보상이 759 대 668(가우시안 PPO)이고, 목표가 덜 주어진 휴머노이드 추종에서 성공률이 70.6 % 대 46.5 %였다.

**ReinFlow**([arXiv:2505.22094](https://arxiv.org/abs/2505.22094), NeurIPS 2025). flow 정책의 스텝마다 학습하는 잡음을 더해 가능도를 정확히 계산한다.
denoising 한 스텝에서 네 스텝까지 안정적으로 미세조정되고, 보행 과제에서 DPPO보다 벽시계 시간을 82.6 % 줄였다.

**QSM**([arXiv:2312.11752](https://arxiv.org/abs/2312.11752), ICML 2024). 확산 정책의 점수 $\nabla_a \log \pi(a \mid s)$를 critic의 행동 기울기 $\nabla_a Q(s, a)$에 맞춘다.
최적 정책이 $\pi \propto \exp(Q/\alpha)$(R.8)이면 둘이 비례하기 때문이다. denoiser만 미분하면 되고, 정책이 다봉으로 남는다.

![DPPO Fig. 1](https://arxiv.org/html/2409.00588v3/overview-v1.png)
*그림 — DPPO (Fig. 1): 환경 MDP의 한 스텝 안에 denoising MDP를 넣고, denoising 스텝마다의 로그 확률로 정책 기울기를 준다. 출처: [arXiv:2409.00588](https://arxiv.org/abs/2409.00588)*

![FPO Fig. 1](https://arxiv.org/html/2507.21053v2/gridworld.png)
*그림 — FPO (Fig. 1): 목표가 위아래에 있는 격자에서, FPO로 학습한 flow 정책은 별 위치에서 두 모드의 행동 분포를 낸다. 가우시안 정책은 한 모드로 모인다. 출처: [arXiv:2507.21053](https://arxiv.org/abs/2507.21053)*

**Safe Score Matching — 안전 집합 안에서는 보상을, 밖에서는 회복을 따라간다**([arXiv:2609.33337](https://arxiv.org/abs/2609.33337), NeurIPS 2026, [코드](https://github.com/byli888/safe-score-matching) MIT).
Hamilton–Jacobi(HJ) 도달 가능성 critic이 "이 상태와 행동에서 앞으로 제약을 어길 최악의 정도"를 재고, 그 값으로 확산 정책의 점수 목표를 두 갈래로 나눈다.
QSM을 상태별 hard 제약이 있는 온라인 안전 RL로 넓힌 off-policy actor-critic이다. 보상 critic $Q_r$과 도달 가능성 critic $Q_h$를 함께 배운다.
- 실행 가능한 상태 집합 안에서는, $Q_h \le 0$인(안전한) 행동만 남긴 채 보상 쪽으로 간다. 목표 정책은 $\pi^* \propto \exp(\alpha_r Q_r(s, a))\, \mathbf 1\{Q_h(s, a) \le 0\}$다.
- 집합 밖에서는 최악의 위반이 줄어드는 쪽으로 간다. 목표 정책은 $\pi^* \propto \exp(-\beta Q_h(s, a))$다.
- denoiser는 갈래에 따라 $\alpha_r \nabla_a Q_r$ 또는 $-\beta \nabla_a Q_h$를 잡음 목표로 회귀한다.

쿼드로터 추종, 장애물을 피하며 안정화하기, F-16 자세 회복에서 과제 성능이 가장 좋거나 그에 가깝고, 안전하다고 잘못 판정하는 비율이 낮았다.
원-쌍대(라그랑주) 기준선은 위반을 더 허용했고, 도달 가능성 기준선은 더 보수적이었다. 저자들은 학습한 critic이 전역 안전을 보장하지 않는다고 적었다.
HJ 도달 가능성 자체는 Controller 문서 C의 안전 필터 절에 있다.

![Safe Score Matching Fig. 1](https://raw.githubusercontent.com/byli888/safe-score-matching/main/docs/assets/fig1_quad2d_stab_avoid.png)
*그림 — Safe Score Matching (Fig. 1): 평면 쿼드로터가 장애물을 피해 목표로 간다. 배경은 학습한 HJ 값의 단면이고 점선이 실행 가능 집합의 경계다. 왼쪽은 무작위 출발, 오른쪽은 고정 출발에서 왼쪽·오른쪽 두 경로가 함께 나온다. 출처: [byli888/safe-score-matching](https://github.com/byli888/safe-score-matching)*

**travplan에서.** 세 가지를 가져온다.
1. **후학습의 다음 후보.** TP-0066은 AWR 가중 flow matching으로 행동 복제 쪽에 머물렀다. FPO는 같은 flow matching 손실을 PPO 비율로 쓰므로, Planner D의 학습 손실을 거의 그대로 둔 채 폐루프 PPO로 넘어갈 수 있다.
2. **안전을 보상에 섞지 않는다.** travplan은 치명 셀을 cost에 넣어 보상과 섞어 왔다. SSM처럼 "앞으로 치명 셀에 닿을 최악의 정도"를 따로 배운 critic으로 갈래를 나누면, 안전 원칙(치명이 늘면 채택하지 않는다)을 학습 목표 안에 넣을 수 있다. GT 지도에서 치명까지의 거리를 계산할 수 있으므로 HJ 값의 라벨도 만들 수 있다.
3. **확률 제약과는 앞뒤 층이다.** MPPI의 확률 제약(Controller 문서 E.10)은 실행할 때 위험을 거르고, SSM은 학습할 때 위험을 정책에 넣는다.

<!-- tab: 이론·다과제 -->

### R.14 RL 이론의 기초: 표본이 얼마나 필요한가 (20강)

**한 줄로.** ==이론은 거의 최적인 정책을 높은 확률로 얻는 데 표본이 얼마나 드는지를 묻고, 답은 상태·행동 수와 지평, 그리고 자료가 정책이 갈 곳을 얼마나 덮는지에 달렸다.==

- **유한 MDP와 생성 모델.** 아무 상태에서나 표본을 뽑을 수 있는 시뮬레이터가 있으면, $\epsilon$-최적 가치를 얻는 데 상태–행동 쌍마다 대략 $1/((1-\gamma)^3 \epsilon^2)$에 로그 인자를 곱한 만큼의 표본이 든다. 지평이 길수록($\gamma \to 1$) 빠르게 늘어난다.
- **근사 가치 반복의 오차.** 반복마다 오차가 $\epsilon$이면, 최종 정책의 손실은 $2\gamma\epsilon/(1-\gamma)^2$까지 커질 수 있다. 부트스트랩이 오차를 지평만큼 쌓기 때문이다.
- **오프라인의 덮음(concentrability).** 오프라인 RL의 보장은 학습 정책의 상태 분포와 자료 분포의 비가 묶여 있을 때만 성립한다. 자료가 덮지 않는 곳에는 아무 보장이 없다는 것이 R.10이 보수적인 이유다.

**travplan에서.** 벤치마크의 잡음 바닥(TP-0078)이 이론이 말하는 분산의 실측이다. 같은 설정을 다시 돌리면 curb_ramp 레벨 3에서 10개 가운데 6개가 뒤집혔다.
그래서 정책 개선을 판정할 때 seed 10 × 난수 오프셋 3의 짝 비교를 쓴다(`docs/prd.md` 7절). 후학습한 정책을 비교할 때도 같은 기준을 쓴다.

### R.15 다과제·메타 RL과 남은 문제 (24–25강)

**한 줄로.** ==한 과제씩 처음부터 배우는 대신 여러 과제가 공유하는 구조를 먼저 배우면, 새 과제와 새 환경에 빨리 적응한다.==

- **다과제 RL.** 목표나 과제를 조건으로 받는 정책 하나를 배운다. 목표 조건 RL에서는 실패한 궤적도 그 궤적이 실제로 간 곳을 목표로 다시 라벨링해 쓴다(hindsight relabeling, [arXiv:1707.01495](https://arxiv.org/abs/1707.01495)).
- **커리큘럼.** 쉬운 과제부터 어려운 과제로 순서를 정한다. 보행 학습의 지형 난이도 커리큘럼이 대표다(Controller 문서).
- **메타 RL과 적응.** 여러 환경에서 빨리 적응하는 법을 배운다. 최근 경험에서 환경 특성을 추정하는 문맥 인코더가 실용적이다(RMA, [arXiv:2107.04034](https://arxiv.org/abs/2107.04034), 배경 0.11).
- **남은 문제.** 흔히 꼽는 열린 문제는 보상 설계, 안전한 탐색, sim-to-real 격차, 긴 지평의 신용 할당, 평가의 재현성이다.

**travplan에서.** 지형 레벨 0–3(TP-0039)은 커리큘럼이자 다과제 평가다. TP-0066은 레벨 0–3을 고르게 섞어 후학습했다.
plant처럼 동역학이 바뀌는 환경에서는 RMA식 적응(배경 0.11)이, 같은 Planner D를 plant와 이상 모델 모두에서 쓰게 하는 방법이다.

<!-- tab: travplan에서 -->

### R.16 travplan이 쓰는 강화학습과 다음 후보

**한 줄로.** ==travplan은 지금 강화학습을 후학습(그룹 이점과 AWR), 기울기 없는 정책 탐색(진화 전략), 모델 기반 계획(MPPI)의 세 자리에서 쓰고, 다음 자리는 plant와 L1을 넣은 폐루프 후학습이다.==

| 자리 | 방법 | 이 문서 | 기록 |
|---|---|---|---|
| Planner D 후학습 | 후보 16개의 그룹 상대 이점, AWR 가중 flow matching, 모방 가중 0.5 | R.10, R.12 | TP-0066(curb_ramp 레벨 3 단독 20/30에서 26/30), TP-0138 |
| Playground 학습 Controller | OpenAI-ES, 보상은 벤치마크 판정 | R.3 | TP-0128(사족 12/12, 바퀴 8/12) |
| Controller | MPPI, 제어를 추론으로 본 모델 기반 계획 | R.8, R.9 | TP-0150(`mppi_plant_lag`, 치명 55에서 4) |
| 시연 학습 | 행동 복제와 DAgger | R.2 | TP-0073, TP-0143 |

![TP-0066](assets/figs/tp0066_rl.webp)
*그림 — TP-0066: Planner D의 폐루프 RL 후학습. 왼쪽은 curb_ramp 레벨 3의 30 에피소드 도달 수이고, 오른쪽은 Guidance 폴백과 함께 쓸 때 폴백이 이긴 계획의 비율과 도달 시간이다. 출처: scripts/make_evidence_figures.py*

**다음 후보(먼저 할 것부터).**
1. **plant와 L1을 넣은 폐루프 후학습.** 지금의 후학습은 이상 모델과 L0 지도로 했다. TP-0149–0154에서 plant와 L1이 성적을 크게 바꿨으므로, rollout도 그 조건이어야 한다. TP-0153의 GPU 경로로 L1 에피소드가 약 3.5배 빨라졌다.
2. **FPO로 PPO 비율 쓰기.** AWR은 모은 후보를 다시 가중할 뿐이다. FPO(R.13)는 Planner D의 flow matching 손실을 그대로 PPO 비율로 쓰므로, critic을 더하면 actor-critic으로 넘어간다.
3. **비대칭 critic과 안전 critic.** critic에 GT 지도와 plant 상태를 주고(R.4), 치명 셀까지의 최악 여유를 따로 배워 갈래를 나눈다(R.13의 SSM).
4. **오프라인 자료.** `results/`의 에피소드 기록을 IQL식으로 쓰는 일은, 자료를 모은 정책보다 나아질 수 있는지부터 작게 잰다(R.10).

**과목 자료.** 숙제는 모방학습, 정책 기울기, Q-learning과 actor-critic, 언어 모델 RL, 오프라인 RL의 다섯 개이고, 과목 홈페이지에 있다.
