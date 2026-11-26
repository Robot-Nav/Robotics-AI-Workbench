# legbot_lab：MoE-CTS 轮足机器人强化学习训练分析

> 源仓库：[Robot-Nav/legbot_lab](https://github.com/Robot-Nav/legbot_lab)  
> 分析分支：WF-CTS-MOE  
> 平台：Isaac Lab 2.3.2、PyTorch 2.7、定制 RSL-RL、MuJoCo Sim2Sim  
> 核心算法：PPO + Concurrent Teacher-Student (CTS) + Mixture of Experts (MoE)

## 1. 项目目标与机器人任务

legbot_lab 面向 16 DoF 轮足机器人 Legbot-WF 的粗糙地形速度跟踪。机器人每条腿包含 hip、thigh、calf 三个关节和一个主动轮，因此总计 12 个腿部关节 + 4 个轮关节。

动作接口采用混合控制：
- 12 个腿部关节输出位置偏移；
- 4 个轮关节输出速度指令。

仓库还提供 Go2 参考任务，核心 MoE-CTS 训练算法共享。需要注意：Legbot-WF 的 URDF、mesh、scene 和训练权重不随公开仓库分发；本文仅分析公开的训练框架、任务配置和部署接口，不推断未公开模型资产。

## 2. 系统架构

Isaac Lab ManagerBasedRLEnv  
↓  
Legbot Scene / Terrain / Contact Sensor / Height Scanner  
↓  
Observation Manager：policy history、single_obs、privileged critic  
↓  
MoECTS：teacher encoder / student MoE encoder / shared actor / shared critic  
↓  
PPO rollout 与更新 + student latent distillation  
↓  
student policy export  
↓  
MuJoCo Sim2Sim deployment

## 3. 观察、动作与机器人接口

### 3.1 Observation

README 给出的单帧 onboard policy observation 为 57 维。配置项由以下部分组成：

| 观测项 | 维数 | 说明 |
|---|---:|---|
| base_ang_vel | 3 | 机身角速度 |
| projected_gravity | 3 | 机身坐标系下的重力方向 |
| velocity_commands | 3 | vx、vy、yaw rate 命令 |
| joint_pos | 16 | 相对默认关节位置；轮关节列置零而不是删除 |
| joint_vel | 16 | 16 个关节速度 |
| actions | 16 | 上一时刻动作 |
| 合计 | 57 | 单帧 onboard 观测 |

PolicyCfg 设置 history_length=4，并展平历史维度：

\[
o_{\mathrm{on},t}=
[o_t,o_{t-1},o_{t-2},o_{t-3}]
\in\mathbb{R}^{228}
\]

历史观测有助于策略从连续观测中间接估计速度变化、接触状态和未直接测量的动态信息。

CriticCfg 则额外使用 base linear velocity、joint acceleration、joint torque、contact force、height scan 等训练期可获得的特权信息。README 给出的 privileged critic 输入为 295 维。

### 3.2 Action

\[
\mathbf{a}\in\mathbb{R}^{16}
\]

腿部关节位置目标按关节组 scale=0.25，并使用默认关节位置偏置；轮关节速度 scale=20。配置中轮速度动作 clip 为 [-150,150]，这是动作接口的限幅值，不等于电机最终实际速度上限。

### 3.3 环境与控制周期

| 配置 | 当前代码值 | 说明 |
|---|---:|---|
| num_envs | 2048 | 并行仿真实例数 |
| sim.dt | 0.005 s | 物理仿真步长，200 Hz |
| decimation | 4 | 每 4 个物理步更新一次策略 |
| policy dt | 0.02 s | 50 Hz |
| episode_length_s | 25 s | 单回合最大时长 |
| num_steps_per_env | 24 | 每环境每轮 rollout 步数 |
| rollout samples | 49152 | 2048 × 24 |

## 4. CTS：Concurrent Teacher-Student

CTS 的目标是在训练阶段利用仿真特权状态提高学习效率，同时让最终部署策略只依赖 onboard 可观测量。

教师编码器：

\[
z_t=f_\theta(o_{\mathrm{priv}})
\]

学生编码器：

\[
z_s=g_\phi(o_{\mathrm{on}})
\]

两者得到相同维数的 latent。共享 Actor 接收 latent 与当前单帧观测：

\[
a\sim\pi_\psi(a\mid z,o_{\mathrm{single}})
\]

共享 Critic 接收 latent 与 privileged observation：

\[
V_\omega=V_\omega(z,o_{\mathrm{priv}})
\]

当前配置中 teacher_env_ratio=0.75，即 2048 个环境中约 1536 个 teacher environments 和 512 个 student environments。教师和学生并发采样，但不是两套互不相关的完整策略；二者共享 Actor 和 Critic，latent 的来源不同。

### 4.1 PPO 目标

对新旧策略概率比：

\[
r_t(\psi)=
\frac{\pi_\psi(a_t\mid s_t)}
{\pi_{\psi_{\mathrm{old}}}(a_t\mid s_t)}
\]

剪切 surrogate objective：

\[
L^{CLIP}=
\mathbb{E}_t
\left[
\min\left(
r_t\hat A_t,
\operatorname{clip}(r_t,1-\epsilon,1+\epsilon)\hat A_t
\right)
\right]
\]

GAE：

\[
\delta_t=r_t+\gamma V(s_{t+1})-V(s_t)
\]

\[
\hat A_t=\delta_t+\gamma\lambda\hat A_{t+1}
\]

价值损失、熵正则和 PPO surrogate 共同更新 teacher encoder、Actor、Critic 与动作标准差。代码采用 clipped value loss，并依据 KL 与 desired_kl 自适应调整 PPO learning rate。

## 5. MoE Student Encoder

普通 CTS 学生编码器使用单一 MLP 将 onboard observation 映射到 latent。该仓库把学生编码器替换为 MoE：

\[
z_s=\sum_{i=1}^{N}w_i(o)e_i(o)
\]

\[
w(o)=\operatorname{softmax}(g(o))
\]

其中 e_i 是第 i 个 expert，g 是 gating network。当前配置 expert_num=8、latent_dim=32。其动机是让不同专家有机会学习不同运动模式，例如轮式滚动、腿式支撑、越障和姿态恢复；但“每个专家已经形成某个明确语义专长”不能只凭结构推断，需要分析 gating 分布和专家激活结果。

### 5.1 学生蒸馏损失

学生 latent 通过教师 latent 监督：

\[
L_{\mathrm{latent}}=
\|z_t-z_s\|_2^2
\]

为避免所有输入都集中到少数专家，代码计算 batch 内平均 gating usage：

\[
\bar w_i=\mathbb{E}_{o}[w_i(o)]
\]

并约束其接近均匀分布：

\[
L_{\mathrm{balance}}=
\frac{1}{N}\sum_i
\left(\bar w_i-\frac{1}{N}\right)^2
\]

总学生损失：

\[
L_{\mathrm{student}}=
L_{\mathrm{latent}}+
\alpha L_{\mathrm{balance}}
\]

其中 alpha 对应 load_balance_coef=0.01。实现中 teacher latent 在蒸馏阶段 detach/no_grad，学生 MoE 使用独立 optimizer 更新；这与 PPO 主 optimizer 分开，避免把学生编码器的蒸馏梯度混入 PPO 参数更新。

### 5.2 训练与部署的区别

- 训练时：teacher 环境使用 privileged encoder；student 环境使用 MoE encoder；共享 Actor/Critic 共同训练。
- 蒸馏时：学生 MoE 对齐教师 latent，并增加专家负载均衡损失。
- 推理时：调用 act_inference，使用 student_moe_encoder 和共享 Actor，教师分支不参与部署。

这是 CTS 的关键价值：利用仿真特权信息指导策略学习，但最终保留只依赖 onboard observation 的学生路径。

## 6. 奖励函数与课程学习

当前 Legbot 任务包括以下奖励类别：

| 奖励项 | 权重/配置 | 作用 |
|---|---:|---|
| track_lin_vel_xy_exp | +2.0 | 跟踪水平速度命令 |
| track_ang_vel_z_exp | +1.0 | 跟踪偏航角速度 |
| lin_vel_z_l2 | -2.0 → -1.0 | 抑制垂向速度，课程调节 |
| ang_vel_xy_l2 | -0.05 | 抑制 roll/pitch 角速度 |
| joint_acc_l2 | -1e-7 | 降低关节加速度 |
| joint_power | -2e-5 | 降低机械功率消耗 |
| joint_torques_l2 | -1e-4 | 降低关节力矩 |
| base_height_l2 | -1.0 → -10.0 | 维持机身高度 |
| action_rate_l2 | -0.01 | 抑制动作变化 |
| action_smoothness_l2 | -0.01 | 惩罚动作二阶差分 |
| undesired_contacts | -1.0 | 惩罚大腿/小腿碰撞 |
| joint_pos_limits | -2.0 | 惩罚腿部关节越界 |
| wheel_axis_alignment_l2 | -0.6 | 约束轮轴外倾和 toe 方向 |
| standing_joint_vel_l2 | -0.02 | 静止命令时抑制多余腿部运动和轮子空转 |

轮足特有奖励是该项目值得重点阅读的部分：

- joint_pose_l1_standing_scaled：根据速度命令是否接近零，以及地面是否平坦、机身是否 upright，增加静止站立时的关节姿态偏差代价。
- wheel_axis_alignment_l2：从 wheel link 四元数恢复轮轴方向，分别计算 toe 与 camber 误差；设置 2° deadzone，允许必要的平衡调整。
- standing_joint_vel_l2：只在静止命令下惩罚腿部关节运动和轮子空转。

课程学习包括地形等级、命令范围和部分奖励权重渐变。README 记录命令范围最终扩展到 vx ±3 m/s、vy ±1 m/s、yaw rate ±3.14 rad/s；具体阶段应以当前任务配置和训练 run 参数为准。

## 7. 关键源码索引

| 文件 | 作用 |
|---|---|
| [Legbot env config](https://github.com/Robot-Nav/legbot_lab/blob/WF-CTS-MOE/source/robot_lab/robot_lab/tasks/legbot/env_cfg.py) | 场景、动作、观测、奖励、随机化和课程 |
| [Legbot rewards](https://github.com/Robot-Nav/legbot_lab/blob/WF-CTS-MOE/source/robot_lab/robot_lab/tasks/legbot/env/rewards.py) | 轮轴姿态、静止站立姿态与速度惩罚 |
| [MoECTS algorithm](https://github.com/Robot-Nav/legbot_lab/blob/WF-CTS-MOE/source/rsl_rl/rsl_rl/algorithms/moe_cts.py) | teacher/student 环境拆分、PPO、GAE、蒸馏与负载均衡 |
| [MoE Actor-Critic](https://github.com/Robot-Nav/legbot_lab/blob/WF-CTS-MOE/source/rsl_rl/rsl_rl/modules/actor_critic_moe_cts.py) | teacher encoder、student MoE、shared actor/critic |
| [CTS runner](https://github.com/Robot-Nav/legbot_lab/blob/WF-CTS-MOE/source/rsl_rl/rsl_rl/runners/on_policy_runner_cts.py) | rollout、环境交互、训练循环和 checkpoint |
| [Observation helpers](https://github.com/Robot-Nav/legbot_lab/blob/WF-CTS-MOE/source/robot_lab/robot_lab/tasks/go2/mdp/observations.py) | 轮关节位置观测屏蔽、接触力与关节观测 |

## 8. 训练、导出与 Sim2Sim

README 给出的主要流程：

1. Isaac Lab 中并行训练 RobotLab-Legbot-v0；
2. checkpoint 保存为 model_<iter>.pt；
3. play.py 加载 checkpoint，并导出 student policy；
4. 输出 policy.pt 和 policy.onnx；
5. deploy_mujoco/deploy_legbot.py 在 MuJoCo 中运行导出的学生策略；
6. 使用 mixed、flat、stairs、rough 等场景进行 Sim2Sim 检查。

当前公开 README 明确提供 MuJoCo Sim2Sim 部署路径；不能据此认定该分支已经完成真实 Legbot 硬件部署。README 也明确指出训练模型、权重和 Legbot-WF 私有 URDF/mesh 不在 Git 仓库中。

## 9. 超参数表

| 参数 | 配置值 |
|---|---:|
| teacher_env_ratio | 0.75 |
| expert_num | 8 |
| latent_dim | 32 |
| actor hidden dims | [512,256,128] |
| critic hidden dims | [512,256,128] |
| PPO clip_param | 0.2 |
| gamma | 0.99 |
| GAE lambda | 0.95 |
| value_loss_coef | 1.0 |
| entropy_coef | 0.01 |
| load_balance_coef | 0.01 |
| PPO learning_rate | 1e-3，adaptive KL |
| student_encoder_learning_rate | 1e-3 |
| desired_kl | 0.01 |
| num_learning_epochs | 5 |
| num_mini_batches | 4 |
| max_grad_norm | 1.0 |
| num_steps_per_env | 24 |
| max_iterations | 300000 |
| save_interval | 50 |

## 10. 研究价值与局限

值得研究：
- 特权信息如何被压缩成可部署 latent；
- 学生编码器的时间历史长度与观测噪声之间的关系；
- MoE 专家是否形成可解释的运动模式分工；
- 轮式滚动和腿式支撑切换时，gating 是否平滑；
- wheel-axis、standing reward 是否改善静止稳定性和轮足姿态。

建议补充的实验：
- PPO-only、CTS-MLP、CTS-MoE 三组消融；
- teacher_env_ratio、expert_num、latent_dim 扫描；
- 不同地形和命令分布的固定测试集；
- wheel slip、动作延迟、传感器噪声和动力学随机化泛化；
- 学生策略在 MuJoCo 上的成功率、速度跟踪误差、姿态误差、能耗和推理耗时。

