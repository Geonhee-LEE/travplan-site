<!-- doc: 배경 · 수식 | 5 -->
# 배경 · 수식 — 논문들이 공유하는 수학 도구 (§0)

## 0. 배경 지식 — 논문들이 공유하는 수식

이 문서의 논문들은 몇 가지 수학 도구를 반복해서 쓴다. 여기서 한 번 정리해 두고, 각 논문의 "자세히" 토글에서는 **그 논문이
무엇을 바꿨는지**만 설명한다. 각 항목은 한두 문장의 직관을 먼저 쓰고, 수식은 토글 안에 넣었다. travplan 코드와 연결되는 곳은
파일 이름을 적었다.

**이 문서는 여러 논문이 공유하는 수학 도구 14개를 세 탭에 모았다.** 표의 "쓰는 절"은 그 도구를 "배경 0.N"으로 가리키는 절이다.
번호는 처음 쓴 순서라 탭 안에서 순서가 섞여 있다.

| 절 | 도구 | 한 줄 요약 | 쓰는 절 | travplan 코드 |
|---|---|---|---|---|
| 0.1 | 리프팅 | 카메라 특징을 깊이 분포로 BEV·voxel 격자에 올린다 | A.2, A.8 | — |
| 0.8 | Heteroscedastic 회귀, evidential 학습 | 값과 함께 분산을 예측해, 모르는 곳에서 σ를 키운다 | A.10.3, E.2 | `representation/self_supervised.py` |
| 0.9 | PU learning | 양성과 "라벨 없음"만으로 분류기를 학습한다 | A.3, A.7, A.10.3 | TravNet 손실 후보 |
| 0.10 | Bayesian Kernel Inference | 주변 관측을 거리로 가중해 빈 칸을 채운다 | A.10.3 | `fill_unknown` 개선 후보 |
| 0.14 | VQ-VAE | 연속 장면을 코드북의 이산 토큰으로 바꾼다 | A.6 | — |
| 0.5 | Diffusion과 guidance | 잡음 제거로 샘플하고, 비용 기울기로 샘플을 유도한다 | A.6, B.3, B.6, B.8, B.8.0 | — |
| 0.6 | Flow matching | 잡음에서 데이터로 곧게 가는 속도장을 배운다 | B.6b, B.8.2, B.9 | `planners/learned/flow_model.py` |
| 0.7 | Truncated·anchored diffusion | 잡음 대신 후보에서 시작해 몇 스텝만 적분한다 | B.8.2, B.9 | — |
| 0.12 | 모방 학습, DAgger, 특권 교사 | 교사를 따라 하되, 학생이 간 상태에 교사 라벨을 붙인다 | A.7.1, B.2, B.5, B.9 | Planner D 개선 후보 |
| 0.13 | Conformal prediction | 분포 가정 없이 보정된 예측 영역을 만든다 | B.9, E | — |
| 0.2 | MPPI | 제어열 후보를 굴려 비용이 낮을수록 큰 가중치로 평균한다 | A.10.1, B.5, B.8.2, C.2, E.1 | `control/mppi/mppi.py` |
| 0.3 | CVaR | 평균 대신 가장 나쁜 꼬리의 평균을 본다 | A.7, B.9, C.2 | `RiskCost` |
| 0.4 | Control Barrier Function | 명령을 최소한으로 고쳐 안전 집합에 남긴다 | B.9, C.2, C.4 | CVaR-BF(TP-0014) 후보 |
| 0.11 | 메타러닝, 온라인 적응 | 빨리 적응하기 좋은 시작점을 배워 두고 현장에서 몇 스텝 미세조정한다 | A.10.3, E | — |

---

<!-- tab: 인식 -->

### 0.1 카메라 특징을 BEV·voxel로 올리기 (리프팅)

==카메라는 깊이를 모르므로, 픽셀마다 "어느 깊이에 있을지"의 확률을 예측해 3D 공간에 나눠 뿌린다.== LiDAR는 점이 이미 3D라서
격자에 바로 넣으면 된다(직접 복셀화). 카메라 기반 occupancy(§A)는 대부분 이 리프팅 위에 서 있다.

<details markdown="1">
<summary>수식 보기</summary>

픽셀 $(u, v)$의 깊이 후보 $d \in \{d_1, \dots, d_D\}$에 대해 네트워크가 깊이 분포 $\alpha_{uv}(d)$와 특징 $f_{uv}$를 낸다. 3D 점은
카메라 내부 행렬 $K$와 외부 자세 $T$로 복원한다.

$$ p_{uv}(d) = T \, K^{-1} \begin{bmatrix} u \\ v \\ 1 \end{bmatrix} d, \qquad F(p_{uv}(d)) \mathrel{+}= \alpha_{uv}(d)\, f_{uv} $$

같은 voxel(또는 BEV 칸)에 떨어진 특징을 더하거나 평균하면 3D 특징 격자가 된다(Lift-Splat-Shoot 방식). transformer 계열은 반대로
voxel 쪽 query가 이미지 특징을 attention으로 가져온다. 어느 쪽이든 마지막에 칸마다 점유 확률 $P(\text{occupied})$와 클래스를 예측한다.

</details>

### 0.8 Heteroscedastic 회귀와 evidential 학습: 예측에 "얼마나 확실한지"를 붙인다

값만 예측하지 않고 ==그 값의 분산(불확실성)도 함께 예측하게 하면, 모델이 모르는 곳에서 스스로 σ를 키운다.== travplan TravNet의
cost·σ 채널과 자기지도 손실(`representation/self_supervised.py`)이 이 방식이고, Evidential BKI(§A.10)는 분류에서 같은 일을 한다.

<details markdown="1">
<summary>수식 보기</summary>

**Heteroscedastic 가우시안 NLL.** 예측 평균 $\mu$와 로그 분산 $s = \log \sigma^2$를 함께 낸다.

$$ -\log \mathcal{N}(y;\, \mu, \sigma^2) = \tfrac{1}{2} e^{-s} (y - \mu)^2 + \tfrac{1}{2} s + \text{const} $$

오차가 크면 $s$를 키워 첫 항을 줄이고, 둘째 항이 $s$가 무한히 커지는 것을 막는다. 반대로 라벨에 노이즈가 거의 없으면 $s \to -\infty$로 발산할
수 있어, travplan은 $s \ge -6$ 하한을 둔다. 라벨이 없는 칸은 가중치 $w = 0$으로 뺀다.

$$ \mathcal{L} = \frac{\sum_i w_i \big[\tfrac{1}{2} e^{-s_i} (\sigma(z_i) - y_i)^2 + \tfrac{1}{2} s_i\big]}{\sum_i w_i}, \qquad w_i = 1 - e^{-n_i/2} $$

**Evidential deep learning(분류).** 소프트맥스 확률 대신 클래스별 증거 $e_c \ge 0$을 내고, Dirichlet 분포 $\mathrm{Dir}(\alpha)$, $\alpha_c = e_c + 1$로 해석한다.
증거가 적을수록 불확실성 $u$가 커진다($C$: 클래스 수).

$$ \hat p_c = \frac{\alpha_c}{S}, \qquad S = \sum_c \alpha_c, \qquad u = \frac{C}{S} $$

</details>

### 0.9 PU learning: 양성과 "라벨 없음"만 있을 때

자기지도 traversability에는 "지나간 곳(지나갈 수 있음)"이라는 양성 라벨만 있고, 지나가지 않은 곳은 쉬운지 어려운지 모른다. 이걸 "어려움"으로
취급하면 틀리고, 무시하면 모델이 모르는 곳을 근거 없이 쉽다고 한다. ==PU learning은 라벨 없는 데이터 속에 양성과 음성이 섞여 있다는 사실을
학습에 반영해 이 과신을 막는다.== 크게 두 갈래가 있고, ScaTE와 Self-Supervisions Only(§A.10)는 둘째 갈래다. TP-0010의 PU loss 후보는 둘 다다.
(주의: PU의 "양성"은 라벨이 붙은 쪽, 즉 지나간 칸이다. 설계 문서의 "힘든 곳 라벨"과 방향이 다르다.)

<details markdown="1">
<summary>수식 보기</summary>

**① 위험 추정기(nnPU).** 양성 집합 $P$, 라벨 없는 집합 $U$, 전체 중 양성 비율 $\pi$. 음성에 대한 위험을 $U$에서 양성 몫을 빼서 추정하고, 음수가 되어
과적합하는 것을 막으려고 0에서 자른다. 양성 비율 $\pi$를 알아야 한다는 것이 약점이다.

$$ \hat R(g) = \pi\, \hat{\mathbb{E}}_P\big[\ell(g(x), +1)\big] + \max\Big\{0,\ \hat{\mathbb{E}}_U\big[\ell(g(x), -1)\big] - \pi\, \hat{\mathbb{E}}_P\big[\ell(g(x), -1)\big]\Big\} $$

**② one-class + 라벨 없는 데이터의 비지도 활용.** 양성의 특징만 한 중심 $C_p$ 주변에 모으고(Deep SVDD), 중심에서 먼 입력을 "낯선 것(지나가기
어려울 수 있음)"으로 본다.

$$ \mathcal{L}^{\text{SVDD}}(x_i) = \lVert g_\phi(x_i) - C_p \rVert^2, \qquad x_i \in P $$

양성만 쓰면 모든 입력을 중심으로 보내는 **붕괴 해**가 생긴다. 그래서 라벨 없는 데이터를 $K$개 학습 prototype으로 **군집화**해(균등 분할 제약) 특징
공간이 뭉개지지 않게 한다. 군집 사후확률은 다음과 같다($\tau = 0.05$).

$$ Q_{kj} = \frac{\exp(x_j^\top c_k / \tau)}{\sum_{k'} \exp(x_j^\top c_{k'} / \tau)}, \qquad \max_A \operatorname{Tr}(A^\top Q)\ \ \text{s.t. 각 군집 크기} = n_u / K $$

</details>

### 0.10 Bayesian Kernel Inference(BKI): 주변 관측을 거리로 가중해 빈 칸을 채운다

지도 칸 하나의 값을 그 칸에 떨어진 관측만으로 정하면 빈 칸이 많아진다. ==BKI는 주변 관측을 거리에 따라 줄어드는 커널로 가중해 칸마다
베이즈 사후분포를 만든다.== 관측이 적은 칸은 사후분포가 넓게 남아 그대로 불확실성이 된다. Evidential BKI와 TRIP(§A.10)의 바탕이고,
travplan `fill_unknown`을 개선할 후보다.

<details markdown="1">
<summary>수식 보기</summary>

클래스 $c$의 확률에 Dirichlet 사전분포 $\mathrm{Dir}(\alpha_0)$를 두고, 관측 $(x_i, y_i)$가 칸 $x_*$에 거리 커널 $k$만큼 기여한다고 본다.

$$ \alpha_c(x_*) = \alpha_{0,c} + \sum_i k(x_*, x_i)\, \mathbb{1}[y_i = c] $$

흔히 쓰는 희소 커널은 반경 $l$ 밖에서 정확히 0이라 계산이 가볍다($d = \lVert x_* - x_i \rVert$).

$$ k(d) = \begin{cases} \dfrac{1}{3}\Big(2 + \cos\dfrac{2\pi d}{l}\Big)\Big(1 - \dfrac{d}{l}\Big) + \dfrac{1}{2\pi} \sin\dfrac{2\pi d}{l}, & d < l \\[4pt] 0, & d \ge l \end{cases} $$

연속값(높이, 비용)은 같은 커널로 가중 평균과 분산을 모은다. Evidential BKI는 여기에 관측마다 분할 불확실성에 따른 가중을 곱해, 확신 없는
관측이 지도를 덜 바꾸게 한다.

</details>

### 0.14 VQ-VAE: 연속 장면을 이산 토큰으로

OccWorld 계열(§A.6)은 occupancy 장면을 ==코드북의 이산 토큰 열로 바꾼 뒤, 언어모델처럼 다음 토큰을 예측해 미래 장면을 만든다.== 그 토큰화가
VQ-VAE다.

<details markdown="1">
<summary>수식 보기</summary>

인코더 출력 $z_e(x)$를 코드북 $\{e_k\}$에서 가장 가까운 벡터로 바꾼다.

$$ z_q(x) = e_{k^*}, \qquad k^* = \arg\min_k \lVert z_e(x) - e_k \rVert $$

$\arg\min$은 미분할 수 없으므로 기울기를 그대로 통과시키고(straight-through), 코드북과 인코더를 서로 끌어당기는 두 항을 더한다
($\mathrm{sg}$: stop-gradient).

$$ \mathcal{L} = \lVert x - \hat x \rVert^2 + \lVert \mathrm{sg}[z_e] - e_{k^*} \rVert^2 + \beta\, \lVert z_e - \mathrm{sg}[e_{k^*}] \rVert^2 $$

</details>

---

<!-- tab: Planner·학습 -->

### 0.5 Diffusion 모델과 guidance

diffusion 모델은 ==데이터에 노이즈를 조금씩 더하는 과정을 거꾸로 배워서, 순수한 노이즈에서 데이터를 만들어 낸다.== 궤적을 데이터로
보면 "궤적 분포"를 배울 수 있어, 갈림길처럼 답이 여럿인 상황에 강하다(§B.3, §B.8). guidance는 학습이 끝난 모델에 **재학습 없이**
원하는 성질(충돌 회피 등)을 덧붙이는 방법이다.

<details markdown="1">
<summary>수식 보기</summary>

**순방향(노이즈 더하기).** 깨끗한 궤적 $x_0$에 스케줄 $\bar\alpha_t$에 따라 노이즈를 섞는다.

$$ q(x_t \mid x_0) = \mathcal{N}\!\big(x_t;\ \sqrt{\bar\alpha_t}\, x_0,\ (1-\bar\alpha_t) I\big) \quad\Longleftrightarrow\quad x_t = \sqrt{\bar\alpha_t}\, x_0 + \sqrt{1-\bar\alpha_t}\,\epsilon $$

**학습.** 네트워크 $\epsilon_\theta$가 섞인 노이즈를 맞히게 한다(조건 $c$: 지도, 경로, 주변 차량 등).

$$ \mathcal{L}(\theta) = \mathbb{E}_{x_0, \epsilon, t}\, \big\lVert \epsilon - \epsilon_\theta(x_t, t, c) \big\rVert^2 $$

이것은 score $\nabla_{x_t} \log q_t(x_t) \approx -\epsilon_\theta / \sqrt{1-\bar\alpha_t}$를 배우는 것과 같다. 모델이 $x_0$를 바로 예측하게 해도 된다(DiffusionDrive).

**샘플링.** 역방향을 확률 흐름 ODE로 보고 적분한다. DPM-Solver(++) 같은 고차 ODE 풀이기를 쓰면 10스텝 안팎으로 줄어든다(Diffusion Planner).

$$ \frac{dx_t}{dt} = f(t)\, x_t - \tfrac{1}{2} g^2(t)\, \nabla_{x_t} \log q_t(x_t) $$

**Guidance.** 학습한 분포 $q_0$에 에너지 $\mathcal{E}$(충돌, 차선 이탈, 속도 등)를 곱해 목표 분포를 만든다.

$$ p_0(x_0) \propto q_0(x_0)\, e^{-\mathcal{E}(x_0)} \quad\Rightarrow\quad \nabla \log p_t(x_t) \approx \nabla \log q_t(x_t) - \nabla_{x_t}\, \mathcal{E}\big(\hat x_0(x_t)\big) $$

$\hat x_0(x_t)$는 현재 $x_t$에서 예측한 깨끗한 궤적이다. 에너지를 노이즈 섞인 $x_t$가 아니라 예측한 $\hat x_0$에서 계산하는 것이 diffusion
posterior sampling(DPS)이고, 별도의 분류기를 학습할 필요가 없다. 미분할 수 없는 에너지는 기울기 대신 MPPI식 가중평균으로 근사할 수 있다(GRACE).

</details>

### 0.6 Flow matching: 노이즈에서 데이터까지 곧게 가는 속도장

flow matching은 diffusion과 같은 일을 더 단순하게 한다. ==노이즈 $x_0$와 데이터 $x_1$을 직선으로 잇고, 그 직선을 따라가는 속도를
네트워크가 배운다.== 샘플링은 그 속도장을 몇 스텝 적분하면 끝난다. travplan Planner D(`planners/learned/flow_model.py`)가 이 방식이다.

<details markdown="1">
<summary>수식 보기</summary>

**학습(rectified flow).** $t \sim U[0,1]$에서 두 점을 선형 보간하고, 그 방향 $x_1 - x_0$를 맞힌다.

$$ x_t = (1-t)\, x_0 + t\, x_1, \quad x_0 \sim \mathcal{N}(0, I), \qquad \mathcal{L}(\theta) = \mathbb{E}_{t, x_0, x_1}\, \big\lVert v_\theta(x_t, t, c) - (x_1 - x_0) \big\rVert^2 $$

**샘플링.** $\dot x = v_\theta(x, t, c)$를 Euler로 $n$스텝 적분한다(Planner D는 $n = 10$).

$$ x_{t + 1/n} = x_t + \tfrac{1}{n}\, v_\theta(x_t, t, c) $$

**Planner D의 데이터 $x_1$.** 궤적이 아니라 **제어 변화율**을 가속 한계로 정규화한 열 $a \in \mathbb{R}^{40 \times 3}$이다. 적분해 제어를 만들고
`SwerveModel`로 굴린다.

$$ u_t = u_{\text{now}} + \sum_{s \le t} a_s \odot a_{\max}\, \Delta t, \qquad \text{궤적} = \texttt{SwerveModel.rollout}(\text{pose}, u) $$

**비용 유도(planner_dg).** 매 스텝 끝점을 $\hat x_1 = x + (1-t)\,v$로 예측하고, 그 점에서의 지도 비용 기울기를 정규화해 속도를 고친다
(0.5의 DPS와 같은 발상).

$$ g = \nabla_{\hat x_1} J(\hat x_1), \qquad v \leftarrow v - s \cdot \frac{g}{\lVert g \rVert}\sqrt{3T}, \quad s = 1.0 $$

</details>

### 0.7 Truncated / anchored diffusion: 시작점을 노이즈가 아니라 후보에서

순수 노이즈에서 시작하면 여러 샘플이 한 궤적으로 몰리는 mode collapse가 생기고, 스텝도 많이 든다. ==미리 뽑아 둔 대표 궤적(anchor)이나
동작 primitive에 노이즈를 조금만 섞어 거기서 시작하면, 2스텝 만에 다양한 후보를 얻는다.== DiffusionDrive와 NMoMa(§B.9)가 이 방식이고,
Planner D의 급회전 실패를 풀 후보다.

<details markdown="1">
<summary>수식 보기</summary>

학습 데이터 궤적을 K-means로 묶어 anchor $\{a_k\}_{k=1}^{N}$을 만든다(DiffusionDrive는 $N = 20$). 전체 스케줄 $T$ 대신 앞부분 $T_{\text{trunc}} \ll T$까지만
노이즈를 섞는다.

$$ \tau_k^{i} = \sqrt{\bar\alpha^{i}}\, a_k + \sqrt{1 - \bar\alpha^{i}}\, \epsilon, \qquad i \in [1, T_{\text{trunc}}] $$

디코더는 anchor마다 정제된 궤적 $\hat\tau_k$와 점수 $\hat s_k$를 낸다. 정답에 가장 가까운 anchor에만 회귀 손실을 주고, 점수는 분류 손실로
배운다. 추론은 anchor 주변 가우시안에서 시작해 2스텝 denoise하고 점수가 가장 높은 것을 고른다.

</details>

### 0.12 모방 학습, DAgger, 특권 교사

사람 라벨 대신 **잘 동작하는 교사**(특권 정보를 가진 정책이나 최적화기)를 따라 하게 학습할 수 있다. 문제는 ==학생은 교사가 가 본 적 없는
상태에 들어가면 무너진다는 것==(분포 이동)이다. DAgger는 학생이 실제로 도달한 상태에 교사 라벨을 붙여 데이터를 늘려 이를 푼다. Planner D의
다음 개선 후보다.

<details markdown="1">
<summary>수식 보기</summary>

**행동 복제(BC).** 교사 정책 $\pi^*$의 상태 분포 $d_{\pi^*}$에서 모은 데이터로 학습한다.

$$ \min_\theta\ \mathbb{E}_{s \sim d_{\pi^*}}\, \ell\big(\pi_\theta(s), \pi^*(s)\big) $$

**DAgger.** $i$번째 반복에서 현재 학생 $\pi_{\theta_i}$로 굴린 상태 $d_{\pi_{\theta_i}}$에 교사 라벨을 붙여 누적 데이터 $\mathcal{D}$에 더하고 다시 학습한다.

$$ \mathcal{D} \leftarrow \mathcal{D} \cup \{(s, \pi^*(s)) : s \sim d_{\pi_{\theta_i}}\}, \qquad \theta_{i+1} = \arg\min_\theta \sum_{(s, a) \in \mathcal{D}} \ell(\pi_\theta(s), a) $$

**특권 교사(teacher–student).** 시뮬레이션의 정답 지형·마찰 같은 특권 정보를 보는 교사를 RL로 먼저 학습하고, 실제 센서만 보는 학생이 교사의
행동이나 잠재 표현을 따라 하게 증류한다(Miki 2022, DPL). **KL kickstart**는 RL 목적에 교사와의 KL 항을 더하고 가중치 $\lambda$를 점점
줄인다(RoM-Nav).

$$ \mathcal{L} = \mathcal{L}_{\text{PPO}} + \lambda\, \mathrm{KL}\big(\pi_\theta \,\Vert\, \pi^{\text{teacher}}\big), \qquad \lambda: 1 \to 0.05 $$

</details>

### 0.13 Conformal prediction: 보정된 예측 영역

예측 모델의 오차 분포를 가정하지 않고도 ==보정용 데이터로 "이 반경 안에 정답이 들어올 확률이 적어도 $1-\alpha$"인 영역을 만든다.==
Predictive Semantic Safety(§E)가 미래 점유 영역을 이렇게 보정해 안전 필터에 넣는다.

<details markdown="1">
<summary>수식 보기</summary>

보정 데이터 $n$개에서 비적합 점수(예: 예측 위치와 실제 위치의 거리) $r_i = \lVert \hat y_i - y_i \rVert$를 구하고, 다음 분위수를 반경으로 쓴다.

$$ \hat q = \text{Quantile}\Big(\{r_i\}_{i=1}^{n};\ \tfrac{\lceil (n+1)(1-\alpha) \rceil}{n}\Big), \qquad \mathcal{C}(x) = \{\, y : \lVert \hat y(x) - y \rVert \le \hat q \,\} $$

데이터가 교환 가능(exchangeable)하면 $P\big(y \in \mathcal{C}(x)\big) \ge 1 - \alpha$가 보장된다.

</details>

---

<!-- tab: 제어·안전 -->

### 0.2 MPPI: 굴려 보고, 비용이 낮은 것에 가중치를 준다

MPPI는 제어열에 노이즈를 섞은 후보를 수백 개 굴려 보고, ==비용이 낮은 후보일수록 지수적으로 큰 가중치를 줘서 평균을 낸다.== 미분이
필요 없어서 치명 셀 벌점처럼 불연속인 비용도 그대로 쓸 수 있다. travplan `control/mppi/mppi.py`가 이 방식이다.

<details markdown="1">
<summary>수식 보기</summary>

현재 제어열 $U = (u_0, \dots, u_{T-1})$ 주변에서 노이즈 $\epsilon^{(k)}$를 섞은 후보 $K$개를 굴려 비용 $S_k$를 얻는다.

$$ V^{(k)} = U + \epsilon^{(k)}, \qquad S_k = \sum_{t} c\big(x^{(k)}_t, v^{(k)}_t\big) + \phi\big(x^{(k)}_T\big) $$

가중치는 온도 $\lambda$의 softmax이고, 새 제어열은 가중평균이다. 최솟값 $\rho = \min_k S_k$를 빼는 것은 수치 안정용이다.

$$ w_k = \frac{\exp\!\big(-(S_k - \rho)/\lambda\big)}{\sum_j \exp\!\big(-(S_j - \rho)/\lambda\big)}, \qquad U \leftarrow \sum_k w_k V^{(k)} $$

travplan은 후보 $V^{(k)}$ 대신 속도·가속 한계를 적용한 뒤 실제로 굴린 제어열을 평균한다(한계 밖으로 나간 평균이 생기지 않게). 이 식은
"비용의 볼츠만 분포에 가장 가까운(KL 기준) 가우시안 제어 분포"를 찾는 정보이론적 유도에서 나온다. $\lambda$가 작으면 최고
후보 하나에 몰리고, 크면 평균에 가까워진다.

**노이즈 모델.** travplan 기본은 시간 상관 AR(1) 노이즈다.

$$ \epsilon_t = a\,\epsilon_{t-1} + \sqrt{1-a^2}\;\xi_t, \qquad \xi_t \sim \mathcal{N}(0, \Sigma), \quad a = 0.7 $$

**Smooth MPPI(SMPPI).** 노이즈를 제어가 아니라 **변화율**에 넣고 적분한다. 그러면 후보 자체가 매끄러워진다. travplan
`SmoothMPPIController`는 다음처럼 뽑고, 중간 시점 $T/2$에서 분산이 AR(1)과 같도록 크기를 맞춘다.

$$ \epsilon_t = \sum_{s \le t} \eta_s, \qquad \eta_s \sim \mathcal{N}\!\Big(0, \tfrac{\Sigma}{T/2}\Big) \;\Rightarrow\; \operatorname{Var}(\epsilon_{T/2}) = \Sigma $$

</details>

### 0.3 CVaR: 평균이 아니라 나쁜 꼬리를 본다

평균 비용은 "짧지만 아주 위험한 구간"을 긴 쉬운 구간이 희석해 버린다. ==CVaR는 가장 나쁜 α 비율만 평균한 값이라, 위험한 한 구간을
놓치지 않는다.== travplan `RiskCost`와 RA-MPPI, CVaR-BF가 이 척도를 쓴다.

<details markdown="1">
<summary>수식 보기</summary>

손실 $Z$의 상위 $\alpha$ 꼬리(예: $\alpha = 0.2$면 가장 나쁜 20%)의 평균이다. Rockafellar–Uryasev 형태로 쓰면 최적화에 바로 넣을 수 있다.

$$ \operatorname{CVaR}_\alpha(Z) = \mathbb{E}\big[\, Z \mid Z \ge \operatorname{VaR}_\alpha(Z) \,\big] = \min_{\nu} \Big\{ \nu + \tfrac{1}{\alpha}\, \mathbb{E}\big[(Z - \nu)_+\big] \Big\} $$

**travplan `RiskCost`.** 궤적 한 개 안에서 스텝별 위험 $r_t$를 만들고, 그중 가장 큰 $\lceil \alpha T \rceil$개의 평균을 비용으로 쓴다
(시간 축 위의 경험적 CVaR). 동적 장애물 레이어 $\mathrm{dyn}_t$가 있으면 더하고, 예측 겹침에는 강한 벌점을 준다.

$$ r_t = c_t + \beta\,\sigma_t + \gamma\,\mathrm{dyn}_t, \qquad \mathrm{RiskCost} = w \cdot \frac{1}{\lceil \alpha T \rceil} \sum_{t \in \text{top-}\lceil \alpha T \rceil} r_t \;+\; P \cdot \mathbb{1}\big[\max_t \mathrm{dyn}_t \ge 1\big] $$

</details>

### 0.4 Control Barrier Function(CBF): 명령을 최소한으로 고쳐 안전 집합에 남긴다

안전한 상태 집합을 함수 $h(x) \ge 0$로 정의하고, ==$h$가 너무 빨리 줄지 않도록 명령에 부등식 제약을 거는 QP를 매 스텝 푼다.== 원래
명령에서 가장 조금 벗어나는 안전한 명령을 고르므로, 어떤 Planner·Controller 뒤에도 붙일 수 있다(§C).

<details markdown="1">
<summary>수식 보기</summary>

안전 집합 $\mathcal{C} = \{x : h(x) \ge 0\}$. 제어 입력에 선형인 시스템 $\dot x = f(x) + g(x)u$에서, $h$의 감소 속도를 $h$ 자신에 비례하게
제한하면 $\mathcal{C}$ 안에 머문다($\alpha$는 class-$\mathcal{K}$ 함수).

$$ \dot h(x, u) = \nabla h(x)^\top \big(f(x) + g(x)u\big) \;\ge\; -\alpha\big(h(x)\big) $$

매 스텝 푸는 QP는 다음과 같다. 제약이 $u$에 선형이라 작은 QP로 0.6–0.8 ms 안에 풀린다.

$$ u^\star = \arg\min_u \; \lVert u - u_{\text{nom}} \rVert^2 \quad \text{s.t.} \quad \nabla h^\top\!\big(f + g u\big) \ge -\alpha(h) $$

이산 시간 버전은 $h(x_{t+1}) \ge (1-\gamma)\,h(x_t)$, $0 < \gamma \le 1$이다. $h$가 매 스텝 비율 $1-\gamma$보다 빨리 줄지 않는다는 뜻이다.

**확률적 버전.** 장애물의 다음 위치가 불확실하면 $h_{k+1} = h(x_{k+1}, x^o_{k+1})$이 확률 변수가 된다. 충돌 확률 조건
$P(h_{k+1} \ge 0) \ge 1 - \beta$는 VaR 조건과 같고, 이를 더 보수적인 CVaR로 바꾼 것이 CVaR barrier function이다(§C).

$$ \operatorname{CVaR}_\beta^{k}\big(h_{k+1}\big) \ge (1 - \gamma)\, h_k $$

</details>

### 0.11 메타러닝과 온라인 적응

여러 환경의 데이터로 "빨리 적응하기 좋은 시작점"을 배워 두면, ==새 환경에서는 최근 몇 초의 경험만으로 몇 스텝 미세조정해 맞출 수 있다.==
METAVerse(§A.10)와 학습 동역학의 온라인 적응(§E)이 이 방식이다.

<details markdown="1">
<summary>수식 보기</summary>

MAML은 과제(환경) $\mathcal{T}_j$마다 한 스텝 적응한 매개변수가 잘 동작하도록 시작점 $\theta$를 학습한다.

$$ \theta_j' = \theta - \eta\, \nabla_\theta \mathcal{L}_{\mathcal{T}_j}^{\text{support}}(\theta), \qquad \min_\theta \sum_j \mathcal{L}_{\mathcal{T}_j}^{\text{query}}(\theta_j') $$

배포 중에는 최근 상호작용 데이터로 $\theta \to \theta'$ 적응을 반복한다. 매개변수 대신 **잠재 문맥** $z$를 최근 이력에서 추정해 모델에 넣는 방식도
있다($f_\theta(x, u, z)$). 매개변수를 바꾸지 않으므로 더 빠르고 안정적이다.

</details>
