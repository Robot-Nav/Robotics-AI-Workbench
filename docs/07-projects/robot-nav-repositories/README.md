# Robot-Nav 开源项目算法分析知识库

> 本专题面向 Robot-Nav 名下公开机器人项目，按“问题背景—系统架构—算法原理—代码实现—配置参数—实验验证—研究扩展”组织。目标是建立可以沿源码路径复核的工程技术手册，而不是项目宣传页。

- 盘点日期：2026-11-27
- GitHub 公开仓库条目：27
- 排除知识库仓库 Robotics-AI-Workbench 与个人主页仓库 Robot-Nav 后，候选仓库：25
- 已完成分析文档：22
- 暂不具备源码分析条件：2
- 非机器人算法项目：1
- 源项目仓库保持只读；本专题只在 Robotics-AI-Workbench 维护文档

## 1. 完成情况

**状态：22 / 22 个可分析项目已完成。**

| 领域 | 项目数 | 分析文档 |
|---|---:|---|
| 导航与规划 | 5 | [导航专题](#21-导航与规划) |
| 控制与优化 | 6 | [控制专题](#22-控制与优化) |
| 强化学习与运动学习 | 6 | [学习专题](#23-强化学习与运动学习) |
| 机械臂与移动操作 | 3 | [操作专题](#24-机械臂与移动操作) |
| 感知与定位 | 1 | [感知专题](#25-感知与定位) |
| 视觉算法 | 1 | [视觉专题](#26-视觉算法) |
| **合计** | **22** | **22 篇项目分析** |

### 2.1 导航与规划

| 项目 | 核心技术 | 文档 |
|---|---|---|
| [legbot_3D_Nav](https://github.com/Robot-Nav/legbot_3D_Nav) | FAST-LIO、PCT、局部轨迹优化、Go2 导航闭环；部分原生扩展内部实现不可见 | [算法分析](navigation/legbot-3d-nav.md) |
| [legbot_Nav_system](https://github.com/Robot-Nav/legbot_Nav_system) | 预计算路径集、36 方向离散评分、地形分析、前视点航向反馈 | [算法分析](navigation/legbot-nav-system.md) |
| [Bubble-Planner](https://github.com/Robot-Nav/Bubble-Planner) | 球形安全走廊、MINCO、多项式轨迹优化、RHC | [算法分析](navigation/bubble-planner.md) |
| [Lazy_Thetastar_planner](https://github.com/Robot-Nav/Lazy_Thetastar_planner) | Theta* LOS、Dubins、Bézier、曲率与运动可行性处理 | [算法分析](navigation/lazy-thetastar.md) |
| [standalone_lattice_planner](https://github.com/Robot-Nav/standalone_lattice_planner) | State Lattice、运动原语、A*、解析扩展与平滑 | [算法分析](navigation/standalone-lattice.md) |

### 2.2 控制与优化

| 项目 | 核心技术 | 文档 |
|---|---|---|
| [SA-MPPI](https://github.com/Robot-Nav/SA-MPPI) | MPPI、多运动学模型、critic 代价、RC-ESDF 形状感知避障 | [算法分析](control/sa-mppi.md) |
| [legbot-MPC-WBC](https://github.com/Robot-Nav/legbot-MPC-WBC) | 质心凸 MPC、接触力优化、摆动腿笛卡尔控制；当前实现不等同于通用全身 QP-WBC | [算法分析](control/legbot-mpc-wbc.md) |
| [PP_Controller](https://github.com/Robot-Nav/PP_Controller) | Graceful Controller、极坐标姿态反馈、曲率与速度控制 | [算法分析](control/pp-controller.md) |
| [RPP_controller](https://github.com/Robot-Nav/RPP_controller) | Regulated Pure Pursuit、曲率/代价调速、前向碰撞检查 | [算法分析](control/rpp-controller.md) |
| [Path-Tracking-Benchmarks](https://github.com/Robot-Nav/Path-Tracking-Benchmarks) | PID、LQR、MPC、DWA、RPP 等控制器基准；仓库 MPC 为常值控制量枚举 rollout | [算法分析](control/path-tracking-benchmarks.md) |
| [SA-MPPI-cost-calculator](https://github.com/Robot-Nav/SA-MPPI-cost-calculator) | 10 类 MPPI critic 代价计算、敏感性与可视化；属于辅助工具而非控制器 | [工具分析](control/sa-mppi-cost-calculator.md) |

### 2.3 强化学习与运动学习

| 项目 | 核心技术 | 文档 |
|---|---|---|
| [legbot_lab](https://github.com/Robot-Nav/legbot_lab) | Isaac Lab、PPO、Concurrent Teacher-Student、Student MoE、MuJoCo Sim2Sim | [算法分析](learning/legbot-lab.md) |
| [GO2_backflip](https://github.com/Robot-Nav/GO2_backflip) | 相位条件化后空翻、非对称 Actor-Critic PPO、安全课程与实机部署 | [算法分析](learning/go2-backflip.md) |
| [RAV_TD3](https://github.com/Robot-Nav/RAV_TD3) | TD3、双 Actor 投票、极坐标注意力、风险奖励、OU 噪声与 PER | [算法分析](learning/rav-td3.md) |
| [RPO_IsaacLab](https://github.com/Robot-Nav/RPO_IsaacLab) | PPO、AMP、BeyondMimic、Parkour、动作重定向与 MuJoCo Sim2Sim | [算法分析](learning/rpo-isaaclab.md) |
| [Panda_arm_PPO](https://github.com/Robot-Nav/Panda_arm_PPO) | MuJoCo Franka Panda、PPO、末端目标到达、单臂/双臂避障 | [算法分析](learning/panda-arm-ppo.md) |
| [IL-dual-arm](https://github.com/Robot-Nav/IL-dual-arm) | HDR-IL、GAT-GRU-VAE、分层原语规划、可微 DTW | [算法分析](learning/il-dual-arm-hdr-il.md) |

### 2.4 机械臂与移动操作

| 项目 | 核心技术 | 文档 |
|---|---|---|
| [manipulation_wheel](https://github.com/Robot-Nav/manipulation_wheel) | 全向移动操作、DLS-IK、零空间优化、关节柔顺控制、Diffusion Policy | [算法分析](manipulation/manipulation-wheel.md) |
| [SuperMimic-Agent-WFArm](https://github.com/Robot-Nav/SuperMimic-Agent-WFArm) | 轮腿臂统一策略、可微世界模型、短时域想象、BPTT、MimicAgent 参考生成 | [算法分析](manipulation/supermimic-agent-wfarm.md) |
| [openarm-custom-stack](https://github.com/Robot-Nav/openarm-custom-stack) | RGB-D/ArUco、PlanningScene、MoveIt Task Constructor、抓放执行与夹爪接触监测 | [算法分析](manipulation/openarm-custom-stack.md) |

### 2.5 感知与定位

| 项目 | 核心技术 | 文档 |
|---|---|---|
| [lidar_imu_camera_ws](https://github.com/Robot-Nav/lidar_imu_camera_ws) | LI-Init、FAST-LIO2、FAST-LIVO2、VINS-Mono、FAST-Calib、LiDAR-Camera 标定 | [算法分析](perception/lidar-imu-camera-ws.md) |

### 2.6 视觉算法

| 项目 | 核心技术 | 文档 |
|---|---|---|
| [Deblurred_Image](https://github.com/Robot-Nav/Deblurred_Image) | Richardson-Lucy、Wiener、盲去卷积、DeblurGAN-v2、RT-Focuser、ONNX 部署 | [算法分析](vision/deblurred-image.md) |

## 3. 暂不作为完整算法项目分析的仓库

| 仓库 | 盘点结果 | 处理方式 |
|---|---|---|
| [GLD-VSLAM](https://github.com/Robot-Nav/GLD-VSLAM) | 当前默认分支仅发现 LICENSE，未发现 README 或算法源码 | 保留待补充状态；不根据仓库名虚构 VSLAM 算法 |
| [GLD-DOT](https://github.com/Robot-Nav/GLD-DOT) | 当前默认分支仅发现 LICENSE，未发现 README 或算法源码 | 保留待补充状态；不根据仓库名虚构检测/跟踪算法 |
| [AlphaInsight](https://github.com/Robot-Nav/AlphaInsight) | README 指向 LangGraph 金融尽调多智能体应用，不属于机器人算法项目 | 不纳入本专题，可归入 Agent Engineering / AI 应用 |

## 4. 文档证据与验证边界

每篇文章按以下原则组织：

- **源码确认**：在仓库文件中找到对应类、函数、数据流、配置或参数。
- **README 说明**：项目文档明确描述，但不代表本轮重新运行验证。
- **理论背景**：解释通用算法原理，不代表项目实现了该理论的全部假设和保证。
- **待验证**：源码缺失、预编译扩展不可读、运行环境不可用或实验数据未公开。

本批次完成的是公开源码阅读、算法梳理和文档写入，**不代表 22 个项目均已完成编译、仿真或真机复测**。文档中没有把 README 声称的指标写成本轮实测结果；参数以对应源码和配置为准。后续如果运行项目，应补充代码 Commit、依赖版本、随机种子、命令、日志和指标。

## 5. 建议阅读路线

1. 系统导航：legbot_3D_Nav → legbot_Nav_system → Bubble-Planner → State Lattice。
2. 规划控制：SA-MPPI → Path-Tracking-Benchmarks → Graceful / RPP。
3. 强化学习：Panda PPO → RAV-TD3 → legbot_lab → RPO AMP/BeyondMimic。
4. 移动操作：manipulation_wheel → SuperMimic-Agent-WFArm → openarm-custom-stack。
5. 感知前端：LiDAR-IMU-Camera 标定与 FAST-LIO2 → Deblurred_Image 视觉前处理。

## 6. 与基础知识板块的关系

- [路径规划与轨迹优化](../../04-robotics-core/planning.md)
- [运动控制与优化控制](../../04-robotics-core/motion-control.md)
- [定位与建图](../../04-robotics-core/localization-mapping.md)
- [感知与多传感器融合](../../04-robotics-core/perception.md)
- [机械臂与移动操作](../../04-robotics-core/manipulation.md)
- [模仿学习与强化学习](../../03-physical-ai/robot-learning.md)
- [World Model](../../03-physical-ai/world-model.md)

项目专题保留“算法如何在具体代码和系统中使用”的上下文；基础知识板块负责跨项目复用的定义、推导和通用比较。
