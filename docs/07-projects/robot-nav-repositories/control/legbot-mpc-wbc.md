# legbot-MPC-WBC：四足机器人质心凸 MPC 与分层腿部控制分析

> 源仓库：[Robot-Nav/legbot-MPC-WBC](https://github.com/Robot-Nav/legbot-MPC-WBC)  
> 分析分支：main  
> 核心技术：Centroidal Model、Convex MPC、QP、OSQP、CasADi、Pinocchio、Gait Scheduler、Swing Foot Impedance/Feedforward、MuJoCo Sim2Real

## 1. 项目定位

仓库 README 将项目定位为 Go2 / Legbot 四足机器人凸模型预测控制栈。控制器的核心不是直接优化每个关节位置，而是在简化质心动力学模型上优化未来各足端地面接触力，再将接触力映射为关节力矩。

从当前可读源码看，系统由以下模块组成：
- ComTraj：生成质心位置、姿态、速度和角速度参考；
- Gait：根据频率、duty factor 和 phase offset 生成支撑/摆动接触表；
- CentroidalMPC：构建并求解凸 QP，输出未来接触力；
- LegController：支撑相使用接触力映射，摆动相使用笛卡尔 PD + 前馈；
- PinGo2Model / PinLegbotModel：通过 Pinocchio 计算质心、足端、雅可比和动力学项；
- MuJoCo / DDS-CAN：仿真和实机执行接口。

**命名澄清：** 仓库名包含 MPC-WBC，但当前读取的核心控制器是质心凸 MPC + 分相腿部控制器，并没有看到一个统一求解所有关节力矩、接触力和任务约束的通用 Whole-Body QP/WBC 求解器。因此本文不把它描述成完整的通用 WBC 框架。

## 2. 系统架构

速度/姿态命令  
↓  
ComTraj：未来质心参考轨迹  
↓  
Gait：未来 N 步接触表  
↓  
CentroidalMPC：求解未来接触力序列  
↓  
LegController：
- stance：将 MPC 接触力映射到关节力矩；
- swing：笛卡尔足端轨迹 + PD + 前馈补偿  
↓  
Pinocchio 机器人模型  
↓  
MuJoCo 或真实机器人接口

## 3. 质心动力学模型

### 3.1 状态和输入

代码采用 12 维质心状态：

\[
\mathbf{x}=
[\mathbf{p}^{T},\boldsymbol{\Theta}^{T},
\mathbf{v}^{T},\boldsymbol{\omega}^{T}]^{T}
\in\mathbb{R}^{12}
\]

其中 p 为质心位置，Θ 为 roll/pitch/yaw，v 为质心线速度，ω 为机身角速度。

控制输入为四条腿各自的三维接触力：

\[
\mathbf{u}=
[\mathbf{f}_{FL}^{T},
\mathbf{f}_{FR}^{T},
\mathbf{f}_{RL}^{T},
\mathbf{f}_{RR}^{T}]^{T}
\in\mathbb{R}^{12}
\]

### 3.2 单刚体质心动力学

\[
m\ddot{\mathbf{p}}
=
\sum_i\mathbf{f}_i+m\mathbf{g}
\]

\[
\dot{\mathbf{L}}=
\sum_i(\mathbf{r}_i\times\mathbf{f}_i)
\]

其中 r_i 是质心到第 i 个足端接触点的力臂，L 是角动量。代码通过 Pinocchio 获取质心、足端位置、机身惯量和雅可比，并在 ComTraj 中构造线性化状态空间模型。

在一个预测时域内可写成：

\[
\mathbf{x}_{k+1}=A_k\mathbf{x}_k+B_k\mathbf{u}_k+\mathbf{c}_k
\]

A、B 的具体数值随参考轨迹、质心惯量、接触点位置和离散步长更新。源码将动力学矩阵构造成稀疏结构，并预计算不随控制周期变化的部分。

## 4. 凸 MPC 的 QP 形式

### 4.1 优化变量

对预测步数 N，优化变量包括每步 12 维状态和 12 维接触力：

\[
\mathbf{z}=
[\mathbf{x}_0,\ldots,\mathbf{x}_{N-1},
\mathbf{u}_0,\ldots,\mathbf{u}_{N-1}]
\]

决策变量总数为 24N。代码中 NX=12、NU=12。

### 4.2 目标函数

实现使用对角状态权重 Q 和输入权重 R：

\[
J=
\sum_{k=0}^{N-1}
(\mathbf{x}_k-\mathbf{x}^{ref}_k)^TQ
(\mathbf{x}_k-\mathbf{x}^{ref}_k)
+
\mathbf{u}_k^TR\mathbf{u}_k
\]

当前源码权重为：

\[
Q=\operatorname{diag}
(1,1,50,10,20,1,2,2,1,1,1,1)
\]

\[
R=\operatorname{diag}(10^{-5},\ldots,10^{-5})
\]

Q 的较大姿态/高度相关权重体现了对机身姿态和高度跟踪的重视；R 较小表示接触力正则化相对弱。权重含义仍应结合状态变量顺序和实际实验调参验证，不能仅凭某个数字推断最终性能。

### 4.3 动力学等式约束

\[
\mathbf{x}_{k+1}-A_k\mathbf{x}_k-B_k\mathbf{u}_k
=\mathbf{c}_k
\]

该组等式约束把未来状态与接触力关联起来，是 MPC 对预测动力学的显式表达。

### 4.4 摩擦锥线性化

代码采用摩擦金字塔近似摩擦锥。对每条支撑腿，摩擦约束可表示为：

\[
|f_x|\le\mu f_z,\qquad
|f_y|\le\mu f_z
\]

即四个线性不等式。当前代码 MU=0.8。与二阶锥约束相比，摩擦金字塔可保持 QP 结构，但其可行域是圆锥的多面体近似。

接触相位还形成 box constraints：
- 摆动腿：三轴接触力均固定为 0；
- 支撑腿：法向力 fz 设置下界 FZ_MIN=10 N；
- FZ_MAX 当前为无穷大，源码注释指出特定简化机器人模型的力上限仍需进一步调参。

## 5. 求解器与实时优化

CentroidalMPC 使用 CasADi 构建稀疏 QP，并调用 OSQP。源码把 Hessian 稀疏结构、动力学约束结构和静态摩擦矩阵尽量预计算，运行时只更新参考轨迹、接触表和时变动力学项。

每个 MPC 周期：
1. 根据当前 ComTraj 更新 QP 向量 g、约束矩阵 A 和约束上下界；
2. 根据 gait contact_table 更新接触力变量边界；
3. 若存在上一次解，则传入 primal x0、dual lam_x0、lam_a0 作为 warm start；
4. 调用 OSQP；
5. 检查 infeasible/error 状态；
6. 保存本轮原始/对偶解供下一周期 warm start。

这属于滚动时域优化：每个周期重新规划未来 N 步接触力，实际执行当前步，再根据新状态重新求解。

## 6. Gait 与摆动腿控制

### 6.1 Trot 接触表

Gait 默认对角步态相位偏置：

\[
\phi=[0.5,0,0,0.5]
\]

相位由时间和步态周期得到：

\[
s_i(t)=
\operatorname{mod}
\left(\phi_i+\frac{t}{T},1\right)
\]

若 s_i 小于 duty factor，则该腿处于 stance，否则为 swing。接触表被传入 MPC，用于把摆动腿的接触力固定为零。

### 6.2 Swing 足端轨迹

摆动腿根据 takeoff 时刻生成足端轨迹和 touchdown 位置。落足点规划考虑当前 base velocity、期望速度、yaw rate 和腿部 hip offset，具有 Raibert 风格的速度前馈与转动补偿思想。

### 6.3 Swing Cartesian 控制

LegController 先计算足端位置误差和速度误差，再构造操作空间惯量：

\[
\Lambda=
(JM^{-1}J^T)^{-1}
\]

前馈项：

\[
\mathbf{f}_{ff}
=
\Lambda(\ddot{\mathbf{p}}_d-\dot J\dot q)
\]

笛卡尔 PD + 前馈：

\[
\mathbf{F}=
K_p(\mathbf{p}_d-\mathbf{p})
+
K_d(\dot{\mathbf{p}}_d-\dot{\mathbf{p}})
+
\mathbf{f}_{ff}
\]

映射为关节力矩：

\[
\boldsymbol{\tau}
=
J^T\mathbf{F}+C(q,\dot q)\dot q+g(q)
\]

### 6.4 Stance 力矩映射

支撑相使用 MPC 输出的接触力：

\[
\boldsymbol{\tau}=J^T(-\mathbf{f}_{contact})
\]

源码对 stance 与 swing 采用不同控制逻辑，这是一种分相混合控制器，而不是一个统一的全身 QP 同时优化所有任务。

## 7. 关键源码索引

| 文件 | 作用 |
|---|---|
| [centroidal_mpc.py](https://github.com/Robot-Nav/legbot-MPC-WBC/blob/main/src/convex_mpc/centroidal_mpc.py) | QP 构建、稀疏约束、OSQP、warm start、接触边界 |
| [com_trajectory.py](https://github.com/Robot-Nav/legbot-MPC-WBC/blob/main/src/convex_mpc/com_trajectory.py) | 质心参考轨迹、连续/离散动力学 |
| [gait.py](https://github.com/Robot-Nav/legbot-MPC-WBC/blob/main/src/convex_mpc/gait.py) | Trot 相位、接触表、落足点和摆腿轨迹 |
| [leg_controller.py](https://github.com/Robot-Nav/legbot-MPC-WBC/blob/main/src/convex_mpc/leg_controller.py) | stance 接触力映射与 swing Cartesian PD/前馈 |
| [go2_robot_data.py](https://github.com/Robot-Nav/legbot-MPC-WBC/blob/main/src/convex_mpc/go2_robot_data.py) | Pinocchio 模型、质心、足端、Jacobian 和动力学项 |
| [README.md](https://github.com/Robot-Nav/legbot-MPC-WBC/blob/main/README.md) | 项目架构、运行频率、仿真与实机说明 |
| [EX34 config](https://github.com/Robot-Nav/legbot-MPC-WBC/blob/main/configs/ex34_trot_final_fast_imu.yaml) | 特定实机测试 profile 的频率和步态参数 |

## 8. 关键参数与频率

| 参数 | 当前源码/配置 | 说明 |
|---|---:|---|
| NX | 12 | 质心状态维度 |
| NU | 12 | 四足接触力输入维度 |
| MU | 0.8 | 摩擦系数 |
| FZ_MIN | 10 N | 支撑腿法向力下界 |
| FZ_MAX | infinity | 当前未设置有限上界 |
| Q | diag(1,1,50,10,20,1,2,2,1,1,1,1) | 状态跟踪权重 |
| R | diag(1e-5) | 接触力正则化权重 |
| phase offset | [0.5,0,0,0.5] | Trot 对角相位 |
| swing height | 0.1 m | gait.py 默认摆腿高度 |
| touchdown clearance | 0.02 m | 足端触地点余量 |
| simulation physics | 1000 Hz | README 记录的仿真物理频率 |
| leg controller | 200 Hz | README 记录的仿真腿控频率 |
| MPC | 30–50 Hz | README 记录的仿真 MPC 频率 |
| EX34 profile state_hz | 100 Hz | 特定实机配置 |
| EX34 profile leg_control_hz | 100 Hz | 特定实机配置 |
| EX34 profile mpc_hz | 5 Hz | 特定实机配置；不能与仿真频率混为一谈 |

## 9. 实验与结果口径

README 记载了 Go2 仿真前进/后退最高 0.8 m/s、侧向 0.4 m/s、旋转 4.0 rad/s，并记录 Trot 3.0 Hz、duty 0.6 等配置。这些是仓库 README 声明的结果，本次没有读取到与每个指标一一对应的原始实验日志，因此在论文或正式报告中应标注为项目记录值，后续补充运行日志和统计方法。

README 还记录了整体实机控制链路曾受 MPC 求解、轨迹生成、状态更新和通信开销影响；特定 EX34 profile 则将 MPC 频率设为 5 Hz，状态与腿控为 100 Hz。这说明应分别报告求解器耗时和端到端控制循环耗时。

## 10. 研究扩展与局限

- 当前质心模型属于单刚体近似，快速姿态变化、强碰撞和复杂柔性接触下会产生模型误差。
- 摩擦金字塔和法向力边界影响 QP 可行性；应统计 infeasible 次数、接触力峰值和摩擦约束余量。
- 摆动腿控制采用操作空间惯量和 PD+前馈，需关注 Jacobian 条件数、奇异位形和模型误差。
- 该代码更准确的描述是“质心凸 MPC + 分相腿部控制”，如需完整 WBC，可进一步引入任务优先级、浮动基动力学、接触约束 QP 和全身力矩分配。
- 建议补充 MPC horizon N、time_step、每周期 QP 更新耗时、OSQP solve time、warm-start 收敛统计和真机端到端延迟。

## 11. 相关知识扩展

- [运动控制与优化控制](../../../04-robotics-core/motion-control.md)：MPC、QP、OSQP、WBC、接触约束。
- [路径规划与轨迹优化](../../../04-robotics-core/planning.md)：参考轨迹、样条和时间参数化。
- [机器人动力学与操作空间控制](../../../04-robotics-core/manipulation.md)：Jacobian、操作空间惯量、PD 与前馈补偿。
