# legbot_3D_Nav：四足机器人三维跨楼层导航系统分析

> 源仓库：[Robot-Nav/legbot_3D_Nav](https://github.com/Robot-Nav/legbot_3D_Nav)  
> 分析分支：ROS2-jazzy  
> 主要技术：FAST-LIO、PCT 多层全局规划、SCAN 局部规划、3D A*、B-Spline、L-BFGS、Go2 速度控制与 RL 推理  
> 本文范围：基于当前公开分支的 README、项目分析文档、ROS 2 节点、规划器和控制器源码进行交叉分析。

## 1. 项目定位与问题定义

该仓库面向四足机器人在室内多楼层环境中的自主导航。与二维平面导航不同，跨楼层任务需要同时处理：

- 楼层之间的高度差和可通行连接关系；
- 楼梯、坡道、平台边缘等非平面地形；
- 点云地图中的障碍物、可通行区域和局部几何约束；
- 全局路线与局部可执行轨迹之间的尺度差异；
- 规划速度指令与四足机器人低层运动策略之间的接口。

从源码结构可确认，系统把定位、全局路线、局部轨迹优化、速度指令适配和四足执行分成相对独立的模块。README 将其描述为 ROS 2 Jazzy / Ubuntu 24.04 / Gazebo Harmonic 组合，并集成 FAST-LIO、PCT 和 SCAN。

## 2. 系统架构与数据流

**主链路：**

LiDAR + IMU → FAST-LIO → 里程计与注册点云 → 地图/地形表示 → PCT 多层全局路线 → SCAN 局部 B-Spline → Go2 轨迹跟踪适配器 → RL locomotion controller → 关节执行接口。

**模块职责：**

| 模块 | 输入 | 输出 | 主要职责 |
|---|---|---|---|
| FAST-LIO | LiDAR 点云、IMU | 位姿、注册点云 | LiDAR-IMU 紧耦合状态估计与点云去畸变 |
| PCT | 预计算 tomogram、起点/终点 | 多楼层全局路径 | 在分层可通行图中搜索跨层路线 |
| SCAN | 局部占据地图、当前状态、局部目标 | B-Spline 轨迹 | A* 引导的碰撞修复、轨迹优化与动态可行性检查 |
| SCAN FSM | 里程计、目标、轨迹状态 | 规划请求与轨迹发布 | 触发规划、失败重试、碰撞安全检查 |
| Go2 command adapter | B-Spline、里程计、目标 | 速度/航向指令 | 时间参数化轨迹跟踪、终点减速和停车确认 |
| RL quadruped controller | IMU、关节状态、控制指令 | 12 DoF 控制输出 | 运行已训练策略并通过 ROS 2 Control 接入执行器 |

### 2.1 PCT 全局规划的数据表示

源码中的 TomogramPlanner 从 pickle 文件读取多层栅格数据。当前 Python 包装层将主要通道解释为：

- tomogram[0]：traversability；
- tomogram[1]：traversability 在 x 方向的梯度；
- tomogram[2]：traversability 在 y 方向的梯度；
- tomogram[3]：各层高度网格 elev_g；
- tomogram[4]：高程/代价辅助网格 elev_c。

TomogramPlanner 会预计算每个栅格索引对应的物理 XY 坐标，并通过高度插值查询某一层在给定 XY 位置处的高度。match_best_layer 遍历候选层，过滤无效高程和高度差超过 slice_dh 的层，再根据 traversability cost 选择代价较低的层。

代码还根据相邻层 traversability 差异和高程差构造 gateway_up / gateway_dn，作为楼层间上行、下行连接的候选区域。随后由 OfflineElePlanner 执行多层路径搜索。

**实现边界：** TomogramPlanner 的 Python 调度、数据通道和层选择逻辑可读；OfflineElePlanner、a_star、ele_planner 等接口由 .pyi 暴露，核心原生扩展实现并未以可读 Python/C++ 源码完整呈现。因此，本文不把原生扩展内部的搜索细节描述为已逐行验证。

## 3. 核心算法原理

### 3.1 FAST-LIO：LiDAR-IMU 紧耦合状态估计

FAST-LIO 的基本任务是估计 IMU 状态并将连续扫描点云变换到统一参考时刻。典型状态可写为：

$$
\mathbf{x} =
\left[
\mathbf{R},\mathbf{p},\mathbf{v},
\mathbf{b}_g,\mathbf{b}_a,
\mathbf{g}
\right]
$$

其中 R、p、v 分别为姿态、位置和速度，bg、ba 为陀螺仪和加速度计偏置，g 为重力向量。IMU 高频传播提供短时运动预测，LiDAR 几何残差校正累计漂移。FAST-LIO 系列通过迭代误差状态 Kalman Filter 将点到局部地图的几何约束融入状态更新，并使用增量式空间索引维护局部点云地图。

对点云中的点 p_i，去畸变时需要根据点采样时刻 t_i 的运动状态，将其变换到统一时刻 t_r：

$$
{}^{W}\mathbf{p}_{i}(t_r)
=
{}^{W}\mathbf{T}_{B}(t_r)^{-1}
{}^{W}\mathbf{T}_{B}(t_i)
{}^{B}\mathbf{p}_{i}
$$

这里的公式描述 FAST-LIO/IMU 去畸变的一般坐标变换关系；具体误差状态、观测雅可比和迭代更新应以仓库内 FAST-LIO 上游代码为准。

### 3.2 PCT：多层可通行图上的全局搜索

跨楼层环境不能只用单层 XY 栅格表示。PCT 的核心思路是把不同高度区间的地形切片组织为多层可通行表示，并显式建立楼层之间的连接关系。

可将搜索节点抽象为：

$$
n=(i_x,i_y,l)
$$

其中 ix、iy 是平面栅格索引，l 是高度层索引。相邻层的 gateway 对应跨层边。全局搜索的通用形式为：

$$
J(\pi)=\sum_{(n_i,n_j)\in\pi}
c(n_i,n_j)
$$

其中边代价 c 可由 traversability、几何可行性和跨层转移代价共同构成。仓库可读代码确认了分层高程、traversability、层选择和 gateway 构造；原生 OfflineElePlanner 的完整代价和搜索实现尚不能从当前源码直接复核。

### 3.3 SCAN：A* 引导的局部轨迹优化

SCAN 的局部规划分为初始化、碰撞修复、连续轨迹优化和可行性检查。

1. 根据起点、速度、加速度和局部目标生成初始控制点。
2. 对初始轨迹分段采样，查询局部占据/膨胀地图。
3. 对碰撞段调用三维 A*，得到可用于控制点重布置的引导路径。
4. 使用 B-Spline 表示连续轨迹，并优化控制点。
5. 检查轨迹速度、加速度等动态可行性；失败时触发重规划或安全处理。

A* 的基本代价为：

$$
f(n)=g(n)+h(n)
$$

其中 g(n) 是从起点到节点 n 的累计代价，h(n) 是到目标的启发式估计。源码提供对角、曼哈顿和欧氏启发式计算。A* 在这里主要负责提供离散可行引导，不直接替代最终连续轨迹。

三次均匀 B-Spline 可写为：

$$
\mathbf{p}(u)=\sum_i \mathbf{P}_i B_{i,3}(u)
$$

P_i 为控制点，B_{i,3} 为三次基函数。轨迹连续性由基函数结构提供，控制点优化则在平滑、碰撞、可行性和参考路径贴合之间权衡。源码中优化权重从配置读取：

$$
J(\mathbf{P})=
\lambda_s J_{\mathrm{smooth}}+
\lambda_c J_{\mathrm{collision}}+
\lambda_f J_{\mathrm{feasibility}}+
\lambda_r J_{\mathrm{fitness}}
$$

这里是对代码中四类代价项的结构化概括；每项的具体离散表达式和梯度应以 BsplineOptimizer 对应函数为准。

**关键实现：** BsplineOptimizer::initControlPoints 负责碰撞分段与 A* 引导；BsplineOptimizeTrajRebound 调用 L-BFGS 优化 rebound 目标；后续 refine 阶段再次调用 L-BFGS 优化 refine 目标。L-BFGS 通过有限内存的曲率历史近似逆 Hessian，适合控制点维度较高、需要反复计算目标函数和梯度的无约束/软约束优化问题。

### 3.4 FSM 与轨迹跟踪适配

SCANReplanFSM 使用 0.01 s 的执行定时器和 0.05 s 的安全检查定时器，分别对应 100 Hz 的 FSM 执行检查和 20 Hz 的碰撞安全检查。这里的频率是源码定时器配置，不代表每次都一定执行完整重规划。

Go2 command adapter 不直接输出关节轨迹，而是从 B-Spline 中寻找最近时间 t_near，再前视 time_forward 得到：

$$
t_{\mathrm{look}}=\min(T,t_{\mathrm{near}}+T_f)
$$

并查询前视位置、速度和航向，再转换为速度指令。源码还包含起步速度、楼梯速度缩放、终点减速、旋转优先和到达确认等工程逻辑，避免低速死锁、越过终点后反向修正以及新目标规划期间继续执行旧轨迹。

### 3.5 RL 低层运动控制接口

rl_quadruped_controller 是 ROS 2 Control 控制器插件。LeggedGymController 读取关节状态、IMU、足端力和外部控制输入，并通过 FSM 在 PASSIVE、固定站立和 RL 状态之间切换。

StateRL 的源码确认：
- 策略输入由单帧观测维度与 history_length 相乘得到；
- 支持 12 DoF；
- 当前代码校验 num_observations 为 42 或 45；
- 支持历史观测缓冲；
- TorchScript 模型加载后执行 warm-up，并检查输出是否为 12 维且有限；
- 当前代码明确拒绝异步 RL 推理线程，采用同步推理与 decimation 控制。

因此，导航层输出的是底盘速度/航向命令，RL 层负责把速度命令转化为四足关节动作，两层控制目标不能混为一谈。

## 4. 关键源码索引

| 文件 | 关键实现 | 阅读重点 |
|---|---|---|
| [PCT planner_wrapper.py](https://github.com/Robot-Nav/legbot_3D_Nav/blob/ROS2-jazzy/src/pct_planner/planner/scripts/planner_wrapper.py) | TomogramPlanner | pickle 数据通道、层高查询、gateway、OfflineElePlanner 接口 |
| [PCT plan.py](https://github.com/Robot-Nav/legbot_3D_Nav/blob/ROS2-jazzy/src/pct_planner/planner/scripts/plan.py) | ROS 2 规划节点 | 输入起终点、定时规划、Path 和地图点云发布 |
| [A* dyn_a_star.cpp](https://github.com/Robot-Nav/legbot_3D_Nav/blob/ROS2-jazzy/src/scan_planner/algorithm/path_searching/src/dyn_a_star.cpp) | AStar | 启发式、端点修正、搜索和路径回溯 |
| [Bspline optimizer](https://github.com/Robot-Nav/legbot_3D_Nav/blob/ROS2-jazzy/src/scan_planner/algorithm/bspline_opt/src/bspline_optimizer.cpp) | BsplineOptimizer | 碰撞分段、rebound、代价函数、L-BFGS |
| [Planner manager](https://github.com/Robot-Nav/legbot_3D_Nav/blob/ROS2-jazzy/src/scan_planner/algorithm/plan_manage/src/planner_manager.cpp) | SCANPlannerManager | 初始化、reboundReplan、轨迹优化与可行性检查 |
| [SCAN FSM](https://github.com/Robot-Nav/legbot_3D_Nav/blob/ROS2-jazzy/src/scan_planner/algorithm/plan_manage/src/scan_replan_fsm.cpp) | SCANReplanFSM | 状态机、定时器、重规划与碰撞安全检查 |
| [Go2 adapter](https://github.com/Robot-Nav/legbot_3D_Nav/blob/ROS2-jazzy/src/scan_planner/algorithm/plan_manage/src/go2_cmd_adapter.cpp) | B-Spline 跟踪 | 前视时间、速度指令、终点锁存与到达确认 |
| [RL StateRL](https://github.com/Robot-Nav/legbot_3D_Nav/blob/ROS2-jazzy/src/rl_quadruped_controller/src/FSM/StateRL.cpp) | 策略推理 | 模型加载、历史观测、输入输出维度和推理节拍 |
| [ROS 2 Controller](https://github.com/Robot-Nav/legbot_3D_Nav/blob/ROS2-jazzy/src/rl_quadruped_controller/src/RlQuadrupedController.cpp) | LeggedGymController | ros2_control 接口、FSM、紧急停止 |

## 5. 参数与运行节拍

| 参数/配置 | 源码值或默认值 | 解释 |
|---|---:|---|
| SCAN planning horizon | 5.0 m（planner_manager 参数默认值） | 局部规划范围配置 |
| FSM execution timer | 0.01 s | 100 Hz 状态机检查 |
| Collision safety timer | 0.05 s | 20 Hz 碰撞安全检查 |
| PCT plan check interval | 0.5 s | PCT Python 节点的位置变化检查间隔 |
| Go2 adapter time_forward | 0.55 s（代码默认值） | 轨迹前视时间 |
| heading_error_threshold | 1.20 rad（代码默认值） | 进入旋转优先控制的角度阈值 |
| RL observation dimension | 42 或 45 | StateRL 当前接受的单帧维度 |
| RL history_length | 配置项 | 实际策略输入维度 = observation dimension × history length |
| RL action dimension | 12 | 四足 12 个关节输出 |

不同 launch、模型和 YAML 可能覆盖这些默认值；应以实际运行命令加载的参数文件为准。

## 6. 实验与评价

仓库提供 Gazebo 场景、PCT 多层地图、SCAN 轨迹和 Go2 控制适配。README 与运行指南描述了 FAST-LIO、真值诊断、跨楼层路径和局部规划组合。当前本次代码检查没有发现可统一复核的完整成功率、定位 RMSE、规划耗时分布或跨楼层任务统计表，因此不在本文填写推测数值。

建议后续补齐：
- FAST-LIO：ATE、位置/姿态 RMSE、点云地图重叠误差；
- PCT：跨层路径成功率、路径代价、规划耗时、层间连接失败率；
- SCAN：重规划频率、轨迹长度、最小障碍距离、动态可行性失败率；
- RL：速度跟踪 RMSE、机身姿态误差、摔倒率、策略推理延迟；
- 系统：任务成功率、端到端时延、定位失效后的安全行为。

## 7. 局限性与进一步研究

1. PCT 的核心原生扩展通过 Python 类型接口暴露，建议增加可读的算法说明、版本锁定和单元测试。
2. PCT 多层地图的高度层选择和 gateway 质量会直接影响跨楼层路线，建议增加层连接可视化和路径可达性测试。
3. SCAN 的 A* 引导和 B-Spline 优化需要同时关注几何安全与动力学可行性；仅有无碰轨迹并不等于四足机器人能稳定执行。
4. 导航输出与 RL policy 的速度指令范围、控制频率和历史观测格式必须一致，建议把接口契约写入自动化测试。
5. 建议在仿真中分别测试 FAST-LIO 真实估计链路和 Gazebo ground-truth 诊断链路，避免真值绕过定位模块形成虚假的闭环效果。

## 8. 相关知识扩展

- [定位与建图](../../../04-robotics-core/localization-mapping.md)：FAST-LIO、ESKF、IMU 预积分、点云去畸变。
- [路径规划与轨迹优化](../../../04-robotics-core/planning.md)：A*、3D 栅格、启发式函数、B-Spline、L-BFGS。
- [运动控制与优化控制](../../../04-robotics-core/motion-control.md)：速度跟踪、控制频率、滚动时域和安全约束。
- [模仿学习与强化学习](../../../03-physical-ai/robot-learning.md)：Actor-Critic、观测历史、策略推理与 Sim2Real。

