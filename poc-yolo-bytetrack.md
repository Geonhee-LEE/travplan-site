# TP-0011·TP-0018: YOLO + ByteTrack 동적 장애물 인식 PoC

**요약.** 카메라로 보행자를 찾아 추적하고(YOLO + ByteTrack), 그 결과를 Controller가 쓰는 `DynamicObstacles`로 바꾸는 경로를
검증했다. Isaac Sim 없이 합성 영상과 가짜 카메라로 먼저 확인했다. 트랙 ID는 안정적으로 유지됐고, **카메라로 본 보행자 정보만으로도
정답 위치를 준 경우와 같은 수준으로 보행자를 피했다**(충돌 0/5, 최소 여유 0.69–0.91 m). 실제 Isaac Sim 카메라 연결은 GPU 드라이버
복구(TP-0020) 뒤에 한다.

## 1. 왜 별도 가상환경(`.venv-yolo`)인가

메인 `.venv`의 torch는 이 GPU(RTX 5080, Blackwell/sm_120)에 맞춰 따로 설치한 빌드(`2.14.0+cu130`)다. `ultralytics`는 torchvision이
필요한데, 메인 `.venv`에 그냥 설치하면 pip가 맞지 않는 torchvision을 끌어오며 **torch 자체를 다운그레이드할 위험**이 있다. 예전에
cupy 때문에 CUDA 버전이 꼬였던 것과 같은 종류의 문제다. 그래서 elevation mapping PoC(`.venv-emap`)처럼 **완전히 격리한 venv**를
만들고 pip가 맞는 조합을 고르게 했다. pip가 고른 조합(`torch==2.14.0+cu130`, `torchvision==0.29.0`)이 이 GPU에서 CUDA를 정상적으로
쓰는 것도 확인했다.

```bash
python3 -m venv .venv-yolo
.venv-yolo/bin/pip install ultralytics opencv-python-headless
.venv-yolo/bin/pip install --no-deps -e .   # 이 venv에서도 travplan을 import하도록
```

`.venv-yolo/`와 YOLO 가중치(`yolov8n.pt`, 처음 실행할 때 자동 다운로드)는 git에서 무시된다.

## 2. 검증 범위

- **확인한 것**: 모델 로드, 추론 API(`ultralytics`의 `.track(..., tracker="bytetrack.yaml")`), `travplan/perception/detect_track.py`
  래퍼의 출력 형태, ByteTrack ID가 프레임 사이에 유지되는지, 프레임당 지연.
- **확인하지 않은 것**: 실제 보행자 인식 정확도(합성 영상이라 실제 보행 동작이 아니다)와 Jetson Orin 지연(아래 숫자는 이 개발 서버
  기준이다). 둘 다 Isaac Sim 카메라를 연결한 뒤에 잰다.

## 3. 합성 테스트 영상

카메라가 없는 상태에서 파이프라인을 검증하려고, `ultralytics`에 들어 있는 샘플 사진(`bus.jpg`, 실제 사람이 찍힌 사진)을 넓은
캔버스에 붙이고 프레임마다 가로로 옮겨 "카메라 앞을 지나가는 보행자"를 흉내 낸다(`scripts/poc_yolo_bytetrack.py::make_synthetic_pan`).

이동량은 **프레임당 고정 픽셀**(`shift_px_per_frame`, 기본 15 px)로 줘야 한다. 처음에 "총 이동 거리 ÷ 프레임 수"로 짰더니, 프레임
수를 줄이면 프레임당 이동이 커져 ByteTrack의 IoU 매칭이 깨지고 매 프레임 새 ID가 붙었다. 프레임레이트가 낮은 실제 카메라에서도 같은
일이 생기므로 실제 통합 때도 기억할 값이다.

## 4. 실행과 결과

```bash
.venv-yolo/bin/python scripts/poc_yolo_bytetrack.py --frames 30 --device cpu                                  # 트랙 ID + 지연 요약
.venv-yolo/bin/python scripts/poc_yolo_bytetrack.py --frames 30 --device cuda:0 --save-video /path/out.mp4   # 박스·ID를 그린 mp4
```

**이 개발 서버 측정치(2026-09-24, Orin 수치 아님).**

| 장치 | 평균 ms/프레임 | p95 ms/프레임 | 비고 |
|---|---|---|---|
| cpu | 40.8 | 8.8 | 평균은 첫 프레임 워밍업 때문에 부풀었다. 정상 상태는 p95에 가깝다 |
| cuda:0 | 33.3 | 5.8 | 이 venv의 torch가 RTX 5080에서 CUDA 연산을 한다 |

30프레임 동안 사진 속 승객 세 명의 트랙 ID가 끊기지 않고 유지됐다.

## 5. 코드 구조

- `travplan/perception/detect_track.py` — `YoloByteTrackDetector`(`update(frame) -> list[Track]`). `ultralytics`는 쓸 때만 불러오므로,
  이 모듈은 메인 `.venv`에서도 import된다.
- `scripts/poc_yolo_bytetrack.py` — 위 실행 스크립트와 `make_synthetic_pan()`.
- `tests/test_detect_track.py` — `pytest.importorskip("ultralytics")`로 감싸 메인 `.venv`에서는 건너뛴다. 실제로 돌리려면
  `PYTHONPATH=. .venv-yolo/bin/python -m pytest -q tests/test_detect_track.py`.

## 6. 진행 상황

1. **ROS 2 노드(TP-0011 2단계, 완료)** — `travplan_bridge/obstacle_tracker_node.py`는 Image + CameraInfo + Odometry를 받아 YOLO + ByteTrack
   → 지면 투영 → `vision_msgs/Detection3DArray`(`/travplan/dynamic_obstacles`; id = 트랙 ID, center = 발 위치, size = 2 × 반경)를 낸다.
   속도 추정은 받는 쪽(`detection3d_array_to_observations` → `TrackVelocityFilter`)이 맡는다. apt의 `cv_bridge`는 numpy 1.x ABI라
   `.venv-yolo`(numpy 2.x)와 충돌할 수 있어, 이미지를 직접 디코딩한다. Isaac 대신 `scripts/ros_fake_camera.py`(합성 영상을 10 Hz로
   발행)로 ROS를 거친 스모크 테스트를 했다. 60프레임 중 47개 결과를 받았고(초반 CPU 워밍업 동안 best-effort QoS로 일부 유실), 트랙
   ID 세 개가 43–47프레임 동안 유지됐다.
   ```bash
   source /opt/ros/jazzy/setup.bash
   export PYTHONPATH=$PYTHONPATH:$PWD:$PWD/travplan_ws/src/travplan_bridge
   .venv-yolo/bin/python -m travplan_bridge.obstacle_tracker_node &
   .venv-yolo/bin/python scripts/ros_fake_camera.py --frames 60
   ```
2. **Isaac Sim 카메라(TP-0019, 코드만 작성)** — `scripts/isaac_ros2_bridge_scene.py`에 차체 장착 RGB 카메라(`/World/Robot/camera`, 앞 0.25 m·
   위 0.3 m·피치 0.1 rad, 수평 시야 약 90°)와 `ROS2CameraHelper`/`ROS2CameraInfoHelper`(→ `/travplan/camera/image_raw`, `camera_info`)를
   더했다. `--pedestrian`을 주면 시작점과 목표를 잇는 선을 가로지르는 보행자(캐릭터 USD, 없으면 캡슐)가 나온다. 카메라 자세가 트래커의
   optical frame과 맞는지는 `tests/test_isaac_export.py`가 usd-core로 검증한다. **NVIDIA 커널 모듈이 로드되지 않아(`/dev/nvidia*` 없음)
   Isaac Sim을 실행하지 못했다.** 드라이버 복구 뒤 확인이 필요하고, 캐릭터 USD 경로(`F_Business_02`)도 확인하지 못했다.
3. **트래커 출력 → `DynamicObstacles`(TP-0018, 완료)** — 아래 7절.
4. **남은 것** — Isaac 카메라의 실제 영상으로 1·2를 연결해 YOLO 탐지 품질과 지연을 재고, 폐루프 노드(TP-0005)가
   `/travplan/dynamic_obstacles`를 구독해 `ControlRequest.dynamic_obstacles`로 넘기게 한다.

## 7. TP-0018: 트래커 출력을 `DynamicObstacles`로

`travplan/perception/obstacle_bridge.py`는 ROS나 ultralytics를 import하지 않는 순수 변환 코드다.

- **`bbox_to_ground_xy(bbox, K, T_world_cam, ground_z)`** — bbox 아래쪽 가운데(발 위치) 픽셀의 광선을 지면과 교차시킨다. 단안·평지 가정이라
  계단이나 경사에서는 오차가 생기므로, TravMap의 국소 높이를 `ground_z`로 넘겨 줄인다. 카메라 좌표는 ROS optical(x 오른쪽, y 아래,
  z 앞)이고 `camera_pose(position, yaw, pitch)`로 만든다.
- **`detection3d_array_to_observations(msg)`** — LiDAR 트래커 같은 3D 입력용(`vision_msgs/Detection3DArray` 형태, 이미 계획 좌표계라고 가정).
- **`TrackVelocityFilter`** — 트랙 ID별로 1초 창 최소제곱 속도를 구한다(두 점 차분보다 bbox 흔들림에 강하다). 속도 상한을 두고, 오래된
  트랙은 지우며, 인식 지연만큼 위치를 앞으로 외삽한다. 반경은 클래스 표(사람 0.35 m 등)를 먼저 쓰고, 모르는 클래스면 bbox 폭으로 재서
  로봇 반경을 더한다.

**검증**(`tests/test_obstacle_bridge.py`, `scripts/eval_perception_loop.py`). 로봇에 단 핀홀 카메라가 본 보행자 bbox(가우시안 픽셀 노이즈,
시야 제한, 정답 속도 없음)만으로 TP-0012의 횡단 보행자 폐루프를 재현했다. Controller(`MPPIController`)는 시작점–목표 직선을 참조 경로로
받는다.

| 입력 | bbox 노이즈 [px] | 충돌 | 최소 여유 [m] (seed 0–4) | 도착 스텝 |
|---|---|---|---|---|
| 없음(동적 레이어 끔) | — | 0/5 | 0.76, 0.20, 0.31, 0.20, 0.43 | 68, 72, 71, 69, 73 |
| 정답 위치·속도 | — | 0/5 | 0.70, 0.77, 0.75, 0.73, 0.76 | 72, 74, 76, 73, 75 |
| 카메라 | 2.0 | 0/5 | 0.73, 0.82, 0.87, 0.69, 0.70 | 70, 75, 71, 72, 73 |
| 카메라 | 6.0 | 0/5 | 0.78, 0.91, 0.90, 0.71, 0.77 | 72, 77, 75, 73, 76 |

(2026-09-25, Planner/Controller 분리 후 재측정.)

**읽는 법.** 카메라 입력만으로 정답 입력과 같은 수준의 여유(0.69–0.91 m)를 지켰다. 동적 레이어를 끄면 이번 측정에서는 충돌이 없었지만
여유가 0.20 m까지 줄었다. 분리 전 측정(Controller가 목표만 보고 움직이던 구조)에서는 레이어를 끄면 1/5 충돌이었다(최소 여유 −0.17 m).
참조 경로를 따라가는 지금 구조가 기본적으로 덜 흔들리기 때문으로 보인다. 그래도 레이어의 효과는 분명하다. 가장 나쁜 seed의 최소 여유가 0.20 m에서 0.69 m 이상으로 늘고, 5개 seed 평균도 0.38 m에서 0.74–0.81 m로 두 배가 된다.

**한계.** bbox는 실제 기하에서 렌더링한 값이라 YOLO의 오탐·미탐·ID 전환이 없다. 탐지기 품질은 Isaac Sim 카메라를 연결한 뒤(TP-0019 → TP-0011)
따로 잰다.
