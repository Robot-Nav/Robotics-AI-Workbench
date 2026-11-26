# Robot-Nav 开源项目算法分析知识库

> 本专题面向 Robot-Nav 名下公开机器人项目，按“问题背景—系统架构—算法原理—代码实现—配置参数—实验验证—研究扩展”组织文档。这里不是项目宣传页，而是可以沿着源码路径复核的工程技术手册。

- 盘点日期：2026-11-26
- 源仓库范围：GitHub 用户 [Robot-Nav](https://github.com/Robot-Nav) 当前公开仓库
- 本专题目标：只在 Robotics-AI-Workbench 中维护分析文档；源项目仓库只读
- 证据原则：区分源码确认、README 说明、理论背景和待验证事项

## 1. 项目盘点

通过 GitHub 仓库搜索发现 27 个公开仓库条目。排除本知识库仓库 Robotics-AI-Workbench 和个人主页仓库 Robot-Nav 后，得到 **25 个候选项目仓库**。

### 1.1 已完成源码分析

| 领域 | 项目 | 分析文档 | 当前结论 |
|---|---|---|---|
| 三维导航 | [legbot_3D_Nav](https://github.com/Robot-Nav/legbot_3D_Nav) | [算法分析](navigation/legbot-3d-nav.md) | FAST-LIO + PCT 全局规划 + SCAN 局部轨迹优化 + Go2 执行控制；PCT 原生扩展内部实现仍有不可见部分 |
| 采样优化控制 | [SA-MPPI](https://github.com/Robot-Nav/SA-MPPI) | [算法分析](control/sa-mppi.md) | C++ MPPI、多运动学模型、critic 代价、可选 RC-ESDF 形状感知避障 |
| 轮足强化学习 | [legbot_lab](https://github.com/Robot-Nav/legbot_lab) | [算法分析](learning/legbot-lab.md) | Isaac Lab + PPO + Concurrent Teacher-Student + Student MoE；包含 MuJoCo Sim2Sim |
| 四足动作技能 | [GO2_backflip](https://github.com/Robot-Nav/GO2_backflip) | [算法分析](learning/go2-backflip.md) | 相位条件化后空翻、非对称 Actor-Critic PPO、安全课程与实机部署层 |
| 四足优化控制 | [legbot-MPC-WBC](https://github.com/Robot-Nav/legbot-MPC-WBC) | [算法分析](control/legbot-mpc-wbc.md) | 质心凸 MPC 接触力优化 + 摆动腿笛卡尔控制；当前源码并非通用全身 QP-WBC |

**首批 5 个项目已完成源码级分析。**

### 1.2 待分析的机器人算法与系统项目

| 领域 | 仓库 | 默认分支 | 初步分析方向 |
|---|---|---|---|
| 导航与规划 | [legbot_Nav_system](https://github.com/Robot-Nav/legbot_Nav_system) | foxy-humble | ROS 导航系统、定位、路径规划与运动控制集成 |
| 导航与规划 | [Bubble-Planner](https://github.com/Robot-Nav/Bubble-Planner) | main | Bubble 表示、局部路径搜索与碰撞安全约束 |
| 导航与规划 | [Lazy_Thetastar_planner](https://github.com/Robot-Nav/Lazy_Thetastar_planner) | Kinodynamic_Lazy_Theta | Lazy Theta*、运动学/动力学可行路径搜索 |
| 导航与规划 | [standalone_lattice_planner](https://github.com/Robot-Nav/standalone_lattice_planner) | main | State Lattice、运动原语、启发式搜索 |
| 导航与规划 | [Path-Tracking-Benchmarks](https://github.com/Robot-Nav/Path-Tracking-Benchmarks) | main | 参考路径跟踪 Benchmark、控制器公平对比与评价指标 |
| 控制与优化 | [PP_Controller](https://github.com/Robot-Nav/PP_Controller) | main | Pure Pursuit 路径跟踪、前视距离与曲率关系 |
| 控制与优化 | [RPP_controller](https://github.com/Robot-Nav/RPP_controller) | main | Regulated Pure Pursuit、速度调节与碰撞前向仿真 |
| 控制与优化 | [SA-MPPI-cost-calculator](https://github.com/Robot-Nav/SA-MPPI-cost-calculator) | main | MPPI 代价函数计算/可视化辅助工具 |
| 强化学习 | [RAV_TD3](https://github.com/Robot-Nav/RAV_TD3) | master | 风险感知 TD3、状态/动作定义、风险代价与策略更新 |
| 强化学习 | [RPO_IsaacLab](https://github.com/Robot-Nav/RPO_IsaacLab) | main | Isaac Lab 中的 RPO/PPO 训练与环境配置 |
| 强化学习 | [Panda_arm_PPO](https://github.com/Robot-Nav/Panda_arm_PPO) | main | MuJoCo Franka Panda 目标到达、单臂/双臂避障 PPO |
| 机械臂与移动操作 | [manipulation_wheel](https://github.com/Robot-Nav/manipulation_wheel) | main | 四轮足底盘与机械臂移动操作、模仿学习/策略训练 |
| 机械臂与移动操作 | [SuperMimic-Agent-WFArm](https://github.com/Robot-Nav/SuperMimic-Agent-WFArm) | main | 可微世界模型、MimicAgent 参考轨迹、短时域模型学习策略优化 |
| 机械臂与移动操作 | [openarm-custom-stack](https://github.com/Robot-Nav/openarm-custom-stack) | main | OpenArm 控制栈、运动规划、视觉/抓取任务接口 |
| 机械臂与移动操作 | [IL-dual-arm](https://github.com/Robot-Nav/IL-dual-arm) | main | 双臂模仿学习、示范数据与协同操作 |
| 感知与定位 | [lidar_imu_camera_ws](https://github.com/Robot-Nav/lidar_imu_camera_ws) | main | LiDAR-IMU-Camera 标定、时间同步、融合定位工作空间 |
| 视觉算法 | [Deblurred_Image](https://github.com/Robot-Nav/Deblurred_Image) | main | 图像去模糊、成像退化模型与视觉前处理 |

### 1.3 暂不作为完整算法项目分析的仓库

| 仓库 | 盘点结果 | 处理方式 |
|---|---|---|
| [GLD-VSLAM](https://github.com/Robot-Nav/GLD-VSLAM) | 当前默认分支根目录仅发现 LICENSE，未发现 README 或算法源码 | 暂记为待补充仓库；不根据名称虚构 VSLAM 实现 |
| [GLD-DOT](https://github.com/Robot-Nav/GLD-DOT) | 当前默认分支根目录仅发现 LICENSE，未发现 README 或算法源码 | 暂记为待补充仓库；不根据名称虚构检测/跟踪实现 |
| [AlphaInsight](https://github.com/Robot-Nav/AlphaInsight) | README 指向 LangGraph 多智能体金融尽调系统，不属于机器人算法项目 | 不纳入本专题算法项目；可归入 Agent Engineering / AI 应用专题 |

> 说明：Path-Tracking-Benchmarks 是基准测试项目，SA-MPPI-cost-calculator 是工具项目；二者仍属于机器人算法工程生态，但文档类型应分别采用 Benchmark 分析和工具实现分析，而不是套用完整控制器模板。

## 2. 分析文档的证据标记

每篇文章使用以下口径，避免把推断写成实现事实：

- **源码确认**：在默认分支对应文件中找到类、函数、参数或数据流。
- **README 说明**：仓库文档明确描述，但尚未由运行日志或完整代码独立验证。
- **理论背景**：用于解释算法的通用数学原理，不代表仓库完整实现了该理论的所有部分。
- **待验证**：代码缺失、预编译扩展不可读、实验数据未公开或配置入口不明确。

参数表只记录源码或配置文件中实际出现的值。不同 launch profile、训练 run 和部署配置不一致时，分别标注，不合并成一个“默认值”。

## 3. 推荐阅读路径

1. 先阅读 [legbot_3D_Nav](navigation/legbot-3d-nav.md)，理解定位、全局规划、局部轨迹优化和运动执行的系统闭环。
2. 阅读 [SA-MPPI](control/sa-mppi.md)，理解采样式最优控制、代价函数和形状感知避障。
3. 阅读 [legbot-MPC-WBC](control/legbot-mpc-wbc.md)，理解质心动力学、接触力 QP 和支撑/摆动相控制。
4. 阅读 [legbot_lab](learning/legbot-lab.md)，理解轮足机器人 PPO、特权信息和 Teacher-Student 蒸馏。
5. 阅读 [GO2_backflip](learning/go2-backflip.md)，理解相位条件化技能学习、安全约束和 sim2real。

## 4. 与基础知识板块的关系

- [路径规划与轨迹优化](../../04-robotics-core/planning.md)
- [运动控制与优化控制](../../04-robotics-core/motion-control.md)
- [定位与建图](../../04-robotics-core/localization-mapping.md)
- [感知与多传感器融合](../../04-robotics-core/perception.md)
- [模仿学习与强化学习](../../03-physical-ai/robot-learning.md)
- [World Model](../../03-physical-ai/world-model.md)

本专题保留“项目中如何使用”的上下文；基础知识页面负责可跨项目复用的算法定义、推导和通用比较。后续发现理论页面缺项时，优先补充基础页面，再从项目文档链接过去，避免重复堆砌。

## 5. 后续批次

建议按每批 3–5 个仓库推进。下一批优先分析导航规划类的 Bubble-Planner、Lazy_Thetastar_planner、standalone_lattice_planner，以及控制类 PP_Controller、RPP_controller。每批完成后更新本页状态和侧边栏。
