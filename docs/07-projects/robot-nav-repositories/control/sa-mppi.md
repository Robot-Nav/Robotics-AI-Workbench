# SA-MPPI：采样式模型预测控制与 RC-ESDF 形状感知避障

> 源仓库：[Robot-Nav/SA-MPPI](https://github.com/Robot-Nav/SA-MPPI)  
> 分析分支：main  
> 主要技术：MPPI、差速/全向/阿克曼运动模型、并行轨迹采样、Critic 代价管理、动态障碍物预测、RC-ESDF、Savitzky-Golay 平滑  
> 本文依据：README_CN、Optimizer、MotionModel、Critic、ROS 1 节点与 YAML 配置。

## 1. 项目定位

SA-MPPI 是从 Nav2 MPPI 思路中解耦出来的 C++17 采样式轨迹优化控制器。核心优化器不依赖 Nav2 lifecycle、Costmap2D 或 pluginlib；ROS 1 节点用于接入 Path、Odometry、LaserScan 并发布 cmd_vel。控制器支持 DiffDrive、Omni 和 Ackermann 三种运动学模型。

仓库中还包含 RC-ESDF 形状感知避障模块。需要区分两种避障路径：

- 基础 ObstaclesCritic：使用局部障碍物距离/栅格查询对候选轨迹评分。
- 可选 EsdfCritic：使用机器人中心坐标系下的多边形 footprint 距离场计算更精确的形状碰撞距离和梯度。ROS 参数 use_esdf_critic 默认 false；启用且初始化成功后会自动关闭基础 ObstaclesCritic，避免重复叠加障碍代价。

## 2. 系统架构

ROS 输入：全局路径 + 里程计 + 激光障碍点 + 可选动态障碍预测  
↓  
MPPIController：选择运动模型、注册 Critics、配置障碍物和目标代价  
↓  
Optimizer：控制序列加噪、速度/加速度约束、轨迹积分、Critic 评分  
↓  
Softmax 权重：根据轨迹总代价计算样本权重  
↓  
控制序列更新：对采样控制进行加权平均  
↓  
滤波/控制序列移位/故障回退  
↓  
输出控制序列第一个速度指令 cmd_vel

### 2.1 Critic 组成

| Critic | 主要作用 |
|---|---|
| ObstaclesCritic | 基础局部障碍物代价和碰撞判断 |
| PathFollowCritic | 路径跟随 |
| PathAlignCritic | 轨迹与全局路径几何对齐 |
| PathAngleCritic | 航向与路径方向对齐 |
| GoalCritic / GoalAngleCritic | 终点位置与终点航向收敛 |
| ConstraintCritic | 速度和运动学约束 |
| PreferForwardCritic | 抑制不必要倒车 |
| TwirlingCritic | 抑制原地旋转 |
| VelocityDeadbandCritic | 低速死区稳定性 |
| EsdfCritic | 可选的 RC-ESDF footprint 碰撞与风险代价 |

## 3. MPPI 数学原理

### 3.1 控制序列采样

设预测时域包含 H 个离散时刻，控制序列为：

\[
\bar{\mathbf{u}}=
[\bar{\mathbf{u}}_0,\ldots,\bar{\mathbf{u}}_{H-1}]
\]

第 k 条候选控制序列通过加入高斯噪声生成：

\[
\mathbf{u}_{k,t}=\bar{\mathbf{u}}_t+\boldsymbol{\epsilon}_{k,t},
\qquad
\boldsymbol{\epsilon}_{k,t}\sim\mathcal{N}(0,\Sigma)
\]

每条候选序列从当前状态开始进行前向 rollout：

\[
\mathbf{x}_{k,t+1}=f(\mathbf{x}_{k,t},\mathbf{u}_{k,t},\Delta t)
\]

对每条轨迹累计路径、目标、障碍、控制约束等代价：

\[
S_k=\sum_{t=0}^{H-1}c(\mathbf{x}_{k,t},\mathbf{u}_{k,t})+
c_T(\mathbf{x}_{k,H})
\]

### 3.2 重要性权重与控制更新

实现中先减去最小代价以改善指数计算数值稳定性，再计算 softmax 权重：

\[
w_k=
\frac{\exp[-(S_k-S_{\min})/T]}
{\sum_j\exp[-(S_j-S_{\min})/T]}
\]

其中 T 是温度参数。最终控制序列按样本权重更新：

\[
\bar{\mathbf{u}}_t
\leftarrow
\sum_{k=1}^{K}w_k\mathbf{u}_{k,t}
\]

Optimizer 还会加入 MPPI 控制代价修正项。源码对 vx、wz 以及全向模型下的 vy 计算：

\[
\Delta S_k =
\sum_t
\frac{\gamma}{\sigma^2}
\bar u_t(u_{k,t}-\bar u_t)
\]

这意味着更新并不是简单地对任意轨迹做无条件平均，而是同时考虑轨迹评分和控制噪声相对当前名义序列的代价修正。

若启用 adaptive_temperature，代码根据候选代价范围调整 T，并限制在设定上下界内。use_mean_normalization 则改变指数权重的代价基准。

### 3.3 运动模型与动态约束

差速模型：

\[
\dot{x}=v_x\cos\theta,\quad
\dot{y}=v_x\sin\theta,\quad
\dot{\theta}=\omega_z
\]

全向模型额外允许横向速度：

\[
\dot{x}=v_x\cos\theta-v_y\sin\theta
\]
\[
\dot{y}=v_x\sin\theta+v_y\cos\theta
\]

阿克曼模型在非全向模型基础上增加最小转弯半径约束：

\[
R=\left|\frac{v_x}{\omega_z}\right|\ge R_{\min}
\]

源码中的加速度约束使用离散限幅：

\[
v_{t+1}=v_t+
\operatorname{clip}(v_t^{cmd}-v_t,-a_{\max}\Delta t,a_{\max}\Delta t)
\]

这使候选控制不会在一个模型步长内瞬间跳变到目标速度。

## 4. RC-ESDF：任意 footprint 的距离场

### 4.1 距离场构造

RcEsdfMap 以机器人中心为参考建立二维局部栅格。对每个栅格中心 p，计算其到多边形 footprint 各边线段的最小距离：

\[
d(p)=\min_i \operatorname{dist}(p,\overline{v_i v_{i+1}})
\]

若点在多边形内部，距离取负；外部取正。注意 rc_esdf.cpp 的实际赋值是外部保存正的 min_dist，注释中“外部为 0”的描述并不代表当前执行语句。

query() 将世界/机器人中心坐标映射到栅格，取四个邻近单元进行双线性插值，并计算插值函数对 x、y 的数值梯度：

\[
d(x,y)\approx
(1-\alpha)(1-\beta)d_{00}
+\alpha(1-\beta)d_{10}
+(1-\alpha)\beta d_{01}
+\alpha\beta d_{11}
\]

\[
\nabla d=
\begin{bmatrix}
\partial d/\partial x\\
\partial d/\partial y
\end{bmatrix}
\]

### 4.2 轨迹姿态与障碍物坐标变换

对候选轨迹在时刻 t 的机器人位姿 (x,y,θ)，将障碍点变换到机器人 body frame：

\[
\begin{bmatrix}x_b\\y_b\end{bmatrix}
=
\begin{bmatrix}
\cos\theta & \sin\theta\\
-\sin\theta & \cos\theta
\end{bmatrix}
\begin{bmatrix}
x_o-x\\y_o-y
\end{bmatrix}
\]

再查询 footprint 的 signed distance。若距离低于 d_hard，则该轨迹被判定为碰撞，代价设为 collision_cost。

在硬碰撞阈值和风险边界之间，源码采用指数惩罚：

\[
J_{\mathrm{risk}}=
w\exp[-k(d-d_{\mathrm{hard}})]
\]

同时计算障碍物距离梯度与机器人速度的方向关系：

\[
a=
-\frac{\mathbf{v}_{body}^{T}\nabla d}
{\|\mathbf{v}_{body}\|\|\nabla d\|}
\]

\[
m=\max(m_{\min},1-\eta a)
\]

最终将风险代价乘以 m。其效果是：候选轨迹若沿着使距离增大的方向运动，风险惩罚会减弱；若继续向障碍物靠近，惩罚会增强。该实现是**梯度调制轨迹代价**，从而间接改变 MPPI 的样本权重；不是直接把高斯采样分布的均值沿梯度平移。

### 4.3 动态障碍物

EsdfCritic 对动态障碍物调用 positionAt(t) 得到预测位置，再把障碍物半径从 footprint 距离中扣除。该方法依赖上游提供的动态障碍物速度/轨迹模型；不能据此推断系统已经具备复杂的人体行为预测或多模态轨迹预测。

### 4.4 计算加速

源码包含障碍点 voxel 去重、局部预过滤栅格、轨迹按 check_step 抽样检测和 obstacle_range 截断，以减少每条候选轨迹与所有障碍点逐点计算的开销。若 ESDF 查询越界，则回退到 footprint 外接圆半径的保守距离估计。

## 5. 优化循环与工程保护

一次 evalControl 的主流程：

1. prepare：更新当前状态、裁剪路径、同步有效路径点和动态障碍物；
2. generateNoisedTrajectories：生成控制噪声；
3. applyControlConstraintsBatch：速度边界；
4. motion_model.applyConstraints：运动学约束；
5. predict：施加加速度约束；
6. integrateStateVelocities：多线程前向积分候选轨迹；
7. CriticManager：累加各代价函数；
8. updateControlSequence：计算代价修正、温度、权重和控制均值；
9. applyControlSequenceConstraints：限制更新后的控制序列；
10. 若所有候选轨迹碰撞或优化失败，执行 fallback；可选 Savitzky-Golay 平滑；
11. 取控制序列第一项输出，并按配置移位控制序列作为下一周期初值。

这体现了典型 receding-horizon 控制：每次只执行第一步，下一控制周期利用新观测重新优化。

## 6. 关键源码索引

| 文件 | 实现 |
|---|---|
| [optimizer.hpp](https://github.com/Robot-Nav/SA-MPPI/blob/main/src/mppi_laser_example/include/optimizer.hpp) | evalControl、采样 rollout、Critic 评分、softmax 更新、fallback、SG 滤波 |
| [motion_models.hpp](https://github.com/Robot-Nav/SA-MPPI/blob/main/src/mppi_laser_example/include/motion_models.hpp) | 差速、全向、阿克曼运动模型与加速度约束 |
| [controller.hpp](https://github.com/Robot-Nav/SA-MPPI/blob/main/src/mppi_laser_example/include/controller.hpp) | Critic 注册、模型选择、控制器接口 |
| [critic_manager.hpp](https://github.com/Robot-Nav/SA-MPPI/blob/main/src/mppi_laser_example/include/critics/critic_manager.hpp) | 代价函数调度与累计 |
| [esdf_critic.hpp](https://github.com/Robot-Nav/SA-MPPI/blob/main/src/mppi_laser_example/include/critics/esdf_critic.hpp) | footprint ESDF 查询、碰撞检测、梯度代价调制 |
| [rc_esdf.cpp](https://github.com/Robot-Nav/SA-MPPI/blob/main/src/RC-ESDF/src/rc_esdf.cpp) | 多边形距离场构建、双线性插值和梯度计算 |
| [mppi_ros1_node.cpp](https://github.com/Robot-Nav/SA-MPPI/blob/main/src/mppi_laser_example/src/mppi_ros1_node.cpp) | ROS 输入输出、YAML 参数加载、Critic 配置 |
| [mppi_params.yaml](https://github.com/Robot-Nav/SA-MPPI/blob/main/src/mppi_laser_example/config/mppi_params.yaml) | 一组 MPPI 和障碍物参数 |

## 7. 配置参数

以下为当前读取的 mppi_params.yaml 中实际出现的值。它们不自动等同于所有 launch 的最终运行值；ROS 节点代码还提供另一组 fallback 默认值。

| 参数 | YAML 值 | 含义 |
|---|---:|---|
| batch_size | 1500 | 每轮采样轨迹数 |
| time_steps | 40 | 预测离散步数 |
| model_dt | 0.05 s | 模型步长 |
| 预测时长 | 2.0 s | 40 × 0.05 s |
| temperature | 0.2 | softmax 温度 |
| gamma | 0.015 | 控制噪声代价系数 |
| iteration_count | 1 | 每控制周期优化迭代数 |
| control_period_ms | 50 ms | 配置的控制周期，对应 20 Hz |
| thread_count | 4 | 轨迹积分线程数 |
| prune_distance | 2.0 m | 路径裁剪距离 |
| vx range | [-0.25, 1.2] m/s | 前向速度边界 |
| wz_max | 2.0 rad/s | 最大角速度 |
| ax_max | 1.5 m/s² | 最大前向加速度 |
| az_max | 2.5 rad/s² | 最大角加速度 |
| vx_std | 0.20 m/s | 线速度采样标准差 |
| wz_std | 0.30 rad/s | 角速度采样标准差 |
| obstacle_collision_margin | 0.3 m | 基础障碍物安全边界参数 |
| robot_radius | 0.25 m | 基础圆形机器人半径参数 |
| use_esdf_critic | 节点默认 false | 是否启用可选 RC-ESDF critic |

**配置审查提示：** 当前 YAML 中 obstacle_repulsion_weight 和 obstacle_collision_cost 为 0.0；ROS 节点代码的 fallback 默认值则不同。部署或复现实验时必须确认实际加载的 YAML、命名空间和启动参数，不能只凭源码 fallback 推断实际避障权重。

## 8. 算法对比与适用条件

| 方法 | 优点 | 局限/代价 | 适用场景 |
|---|---|---|---|
| DWA | 结构简单、速度空间搜索直观 | 轨迹多样性和长时域预测有限 | 低速、简单局部避障 |
| Pure Pursuit | 实现简单、计算轻量 | 不直接优化动态约束和多目标代价 | 路径几何跟踪 |
| MPC/QP | 可显式表达线性/凸约束 | 非线性模型与复杂碰撞约束会增加求解难度 | 可建模、约束明确的控制问题 |
| MPPI | 可处理非线性 rollout 和复杂代价，易并行 | 采样数、噪声、温度和代价尺度敏感 | 非凸、多约束的实时局部控制 |
| MPPI + RC-ESDF | 能使用多边形 footprint 和距离梯度 | ESDF 预计算、地图分辨率和障碍点密度影响计算量 | 非圆形机器人、狭窄空间 |

## 9. 当前局限与后续研究

- 采样优化的效果依赖代价权重、采样方差和温度，建议建立离线参数扫描与闭环敏感性分析。
- ESDF 模块默认关闭，需单独验证其初始化、footprint 坐标、边界回退和实时耗时。
- 代码中的梯度主要用于风险代价方向调制，不能等同于严格的梯度引导采样分布更新。
- 动态障碍物目前采用 positionAt(t) 接口；预测模型精度和不确定性处理需要单独评估。
- 建议报告候选轨迹数量、轨迹积分耗时、critic 耗时、优化耗时、控制延迟、碰撞率和最小安全距离。

## 10. 相关知识扩展

- [运动控制与优化控制](../../../04-robotics-core/motion-control.md)：MPC、MPPI、采样优化、控制约束。
- [路径规划与轨迹优化](../../../04-robotics-core/planning.md)：局部规划、距离场、碰撞检测。
- [感知与多传感器融合](../../../04-robotics-core/perception.md)：点云障碍物、动态目标状态估计。
