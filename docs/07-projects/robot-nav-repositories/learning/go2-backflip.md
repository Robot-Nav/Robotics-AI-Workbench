# GO2_backflip：相位条件化四足后空翻策略分析

> 源仓库：[Robot-Nav/GO2_backflip](https://github.com/Robot-Nav/GO2_backflip)  
> 分析分支：PPO-backflip  
> 机器人：Unitree Go2，12 DoF  
> 核心算法：Phase-conditioned policy、Asymmetric Actor-Critic、PPO、GAE、Domain Randomization、安全课程、ONNX 部署

## 1. 项目目标

该项目训练 Go2 完成一次后空翻并恢复到稳定站立。任务不只是“让机器人旋转一周”，而是需要按时间顺序完成：

1. 起跳准备和蹬地；
2. 腾空旋转；
3. 足端着地；
4. 机身恢复 upright；
5. 维持稳定姿态并满足关节速度、位置和接触安全约束。

仓库把任务设计为 2.0 s 时间窗口内的相位条件化控制问题，并提供 Isaac Lab 训练环境、MuJoCo Sim2Sim 和真实机器人部署层。

## 2. 系统架构

Isaac Lab DirectRLEnv  
↓  
Go2 12 DoF 动力学仿真 + 接触传感器 + 域随机化  
↓  
60 维 actor observation / 165 维 privileged critic observation  
↓  
Asymmetric Actor-Critic PPO  
↓  
ONNX policy export  
↓  
MuJoCo Sim2Sim  
↓  
真实机器人部署层：50 Hz policy + 500 Hz LowCmd 发布与安全约束

仓库同时包含 legacy Gym trainer 的自定义 Asymmetric PPO 实现。应区分 Isaac Lab 当前任务环境和 rl/Backflip 下的旧训练框架，不能把两套入口混为同一个执行链。

## 3. 相位条件化策略

### 3.1 为什么需要 phase

普通速度跟踪策略通常根据当前机身状态和速度命令输出动作。后空翻是强时序技能：同样的姿态在起跳前、腾空中和落地后对应的合理动作完全不同。

因此策略额外接收 episode time 的周期编码。设任务相位时间：

\[
t_\phi=\min(t,2.0)
\]

\[
\phi=\frac{\pi t_\phi}{2.0}
\]

相位特征：

\[
\mathbf{p}(t)=
[
\sin\phi,\cos\phi,
\sin(\phi/2),\cos(\phi/2),
\sin(\phi/4),\cos(\phi/4)
]
\]

多频率 sin/cos 编码让 MLP 能够感知任务进度和不同时间尺度上的相位变化，同时避免直接输入一个不连续的周期边界值。

### 3.2 Actor Observation

当前 actor observation 为 60 维：

\[
o_{\mathrm{actor}}=
o_{\mathrm{sensor}}^{30}
+a_t^{12}
+a_{t-1}^{12}
+p(t)^{6}
\]

其中 sensor observation 30 维包括：
- base angular velocity：3；
- projected gravity：3；
- joint position relative to default：12；
- joint velocity：12。

另外输入当前动作、上一时刻动作和 6 维 phase features。观测采用延迟传感器历史，并对角速度、重力方向和关节状态加入配置的噪声/偏置。

### 3.3 Privileged Critic Observation

Critic observation 为 165 维：

\[
o_{\mathrm{critic}}=
o_{\mathrm{state}}^{64}
+
o_{\mathrm{dynamics}}^{101}
\]

特权信息包括仿真真实状态和随机化动力学参数，例如质量、惯量、质心、摩擦、接触、动作/观测延迟、PD 增益和电机偏置。Actor 不使用这些部署时不可直接获得的信息，Critic 在训练时使用它们提高价值估计质量。

## 4. 非对称 Actor-Critic PPO

Actor 和 Critic 分别使用不同输入：

\[
a_t\sim\pi_\theta(a_t\mid o_{\mathrm{actor}})
\]

\[
V_\phi=V_\phi(o_{\mathrm{critic}})
\]

Actor 与 Critic 均为 ELU MLP，隐藏层为 [512,256,128]。策略采用对角高斯分布，训练阶段从分布采样动作，部署阶段输出动作均值。

### 4.1 PPO clipped objective

\[
r_t(\theta)=
\exp\left(
\log\pi_\theta(a_t|o_t)
-\log\pi_{\theta_{\mathrm{old}}}(a_t|o_t)
\right)
\]

\[
L^{CLIP}=
\mathbb{E}_t\left[
\min\left(
r_t\hat A_t,
\operatorname{clip}(r_t,1-\epsilon,1+\epsilon)\hat A_t
\right)
\right]
\]

GAE：

\[
\delta_t=r_t+\gamma V(s_{t+1})(1-d_t)-V(s_t)
\]

\[
\hat A_t=\delta_t+\gamma\lambda(1-d_t)\hat A_{t+1}
\]

价值函数使用 clipped value loss，策略熵用于维持探索。学习率根据 KL divergence 与 desired_kl 自适应调整。

### 4.2 已确认训练参数

| 参数 | 当前配置 |
|---|---:|
| actor observation | 60 |
| critic observation | 165 |
| action dimension | 12 |
| actor/critic hidden dims | [512,256,128] |
| activation | ELU |
| rollout steps per env | 24 |
| learning epochs | 5 |
| mini-batches | 4 |
| clip_param | 0.2 |
| gamma | 0.99 |
| GAE lambda | 0.95 |
| entropy_coef | 0.005 |
| learning_rate | 1e-3，adaptive |
| desired_kl | 0.01 |
| action std 初值 | 1.0 |
| action std clamp | [0.35,1.50] |
| phase_duration | 2.0 s |

## 5. 任务奖励与成功判定

### 5.1 起跳与旋转奖励

奖励由起跳、旋转、落地、恢复和安全项构成。代表性项包括：
- takeoff 阶段的向上速度；
- rotation 阶段的 pitch angular velocity；
- rotation progress；
- flip completion event；
- flip success event；
- 恢复阶段的 upright、height、default pose、静止和足端接触；
- 对头部碰撞、关节速度越限、关节位置越限、动作 jerk 和着地冲击的惩罚。

源码通过 pitch rate 积分维护 flip angle。代码对 pitch 角速度做限幅，并只在腾空且尚未着地、未发生头部接触时累计：

\[
\theta_{\mathrm{flip},t+1}
=
\theta_{\mathrm{flip},t}
+
\operatorname{clip}(-\omega_y,-\omega_{\max},\omega_{\max})\Delta t
\]

该积分量用于判断旋转进度。配置中 flip_completion_angle=5.50 rad，flip_success_angle=5.80 rad。它们是任务事件阈值，不代表单独满足角度就算成功。

### 5.2 稳定着陆判定

成功候选需要同时满足：
- 已完成腾空和翻转；
- 达到 flip_success_angle；
- 已检测到着陆；
- 机身 upright 程度达到阈值；
- 机身高度足够；
- pitch rate 不超过恢复阈值；
- 最大关节速度和姿态误差在允许范围；
- 至少 3 个足端接触；
- 未触发 unsafe episode。

success_hold_counter 还要求条件持续满足一段时间，避免单帧瞬时满足就误判成功。这比只用翻转角度作为奖励更接近完整技能任务的验收条件。

## 6. 低层控制与安全机制

### 6.1 位置目标与 PD 力矩

策略输出经过 action_clip，再映射为关节位置目标：

\[
q^{des}=q_0+s_a a+\Delta q_{\mathrm{motor}}
\]

PD 力矩：

\[
\tau_{\mathrm{PD}}=
K_p(q^{des}-q)-K_d\dot q
\]

随后代码对动作延迟、目标变化速率、关节软位置范围、电机速度相关扭矩能力进行处理，最终限幅后的力矩才写入仿真执行器。

### 6.2 电机速度-扭矩约束

代码根据当前关节速度在 motor_velocity_x1 与 joint_velocity_limits 之间插值缩放允许扭矩。驱动方向与制动方向使用不同峰值扭矩配置，再结合 torque scale 形成最终限幅。

这意味着策略动作不是直接等价于电机力矩；真实执行路径还包含关节位置目标、PD、速度相关扭矩限制和安全保护。

### 6.3 域随机化

当前 README 记录的主要随机化范围包括：

| 参数 | 范围 |
|---|---|
| 地面摩擦 | [0.5,1.25] |
| 恢复系数 | [0.0,0.05] |
| 接触 offset | [0.0075,0.0125] |
| base mass 增量 | [-0.5,1.0] kg |
| base CoM 偏移 | 各轴约 ±0.015 m |
| limb mass scale | [0.95,1.05] |
| limb inertia jitter | [0.90,1.10] |
| torque scale | [0.75,1.00] |
| motor velocity scale | [0.85,1.00] |
| PD gain scale | [0.8,1.2] |
| motor offset | [-0.02,0.02] rad |

### 6.4 安全课程

安全课程逐步收紧关节速度终止阈值和硬关节位置越界余量。配置中：
- safety_curriculum_warmup_steps = 24000；
- safety_curriculum_ramp_steps = 72000；
- 速度终止比例从 1.50 收紧到 1.00；
- 位置越界余量从 0.30 rad 收紧到 0；
- 完整课程阶段启用非足端身体接触终止。

这使训练初期先发现动作技能，再逐渐学习满足更严格的硬件相关安全包络。

## 7. Sim2Sim 与真实部署

仓库包含：
- Isaac Lab 训练环境；
- MuJoCo replay / Sim2Sim 工具；
- ONNX policy export；
- deploy_real 实机控制层。

实机配置文件明确给出：
- actor 输入维度 60；
- action 维度 12；
- control_dt=0.02 s，即策略 50 Hz；
- lowcmd_dt=0.002 s，即 500 Hz 命令发布；
- phase_duration=2.0 s；
- 关节索引重排、默认角度、关节限位、Kp/Kd；
- 关节速度、目标速度、动作幅值和连续迟到周期等安全阈值。

高频 LowCmd 发布不代表策略每 2 ms 都重新推理；配置注释明确说明 actor 以 50 Hz 更新，最新电机命令在 500 Hz 层重复发布。

## 8. 关键源码索引

| 文件 | 作用 |
|---|---|
| [Go2BackflipEnv](https://github.com/Robot-Nav/GO2_backflip/blob/PPO-backflip/isaaclab_backflip/tasks/go2_backflip/go2_backflip_env.py) | 观测、动作、相位、翻转状态、奖励和安全终止 |
| [Environment config](https://github.com/Robot-Nav/GO2_backflip/blob/PPO-backflip/isaaclab_backflip/tasks/go2_backflip/go2_backflip_env_cfg.py) | 动力学随机化、奖励权重、安全课程和仿真配置 |
| [Asymmetric Actor-Critic](https://github.com/Robot-Nav/GO2_backflip/blob/PPO-backflip/rl/Backflip/actor_critic.py) | actor/critic 独立输入和网络结构 |
| [Asymmetric PPO](https://github.com/Robot-Nav/GO2_backflip/blob/PPO-backflip/rl/Backflip/ppo.py) | PPO、GAE、clipped value loss 和 KL 自适应 |
| [Runner](https://github.com/Robot-Nav/GO2_backflip/blob/PPO-backflip/rl/Backflip/runner.py) | rollout 与训练循环 |
| [Real deployment config](https://github.com/Robot-Nav/GO2_backflip/blob/PPO-backflip/deploy_real/configs/go2_backflip.yaml) | ONNX、关节映射、50/500 Hz 和安全参数 |

## 9. 局限性与建议实验

- 后空翻是高动态、强接触事件技能，单一成功率不足以评价策略，应统计起跳成功率、翻转完成率、稳定着陆率、连续保持成功率和安全终止原因。
- phase-conditioned policy 对任务时长和时序分布敏感，建议测试不同 phase_duration、动作延迟和起跳状态扰动。
- 非对称 Critic 的特权信息不进入 Actor；部署时必须保证 actor observation 的维度、顺序、归一化、延迟和历史定义与训练完全一致。
- 安全课程可能改变探索与任务成功的权衡，建议对 safety warmup/ramp、速度阈值和接触终止做消融。
- 真机部署应优先验证低层关节顺序、PD 增益、速度-扭矩限幅、动作延迟和急停链路，再执行完整翻转。

