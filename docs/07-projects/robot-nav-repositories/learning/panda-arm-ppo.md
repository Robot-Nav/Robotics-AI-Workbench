# Panda_arm_PPO：MuJoCo Franka Panda 的 PPO 目标到达与避障

> 源仓库：[Robot-Nav/Panda_arm_PPO](https://github.com/Robot-Nav/Panda_arm_PPO) · 默认分支：main  
> 主要依据：README.md、panda_reach_env.py、reward.py、training/config.py、rl_dual_arm_obstacle.py。训练参数来自配置，不代表本轮重新训练结果。

## 1. 任务划分

仓库包含三类基于 Stable-Baselines3 PPO 的 MuJoCo 任务：

- 单臂末端目标到达：模块化 Gym 环境、独立 reward/config/callback；
- 单臂避障：将障碍物状态加入观测，策略学习目标到达与避障；
- 双臂避障：14 维动作同时控制左右两条 7-DOF Panda，环境中随机化目标和障碍物位置。

这是强化学习控制示例，不是传统 IK/MPC 控制器。策略在仿真中学习关节动作，环境负责动作映射、物理步进、奖励和终止判定。

## 2. PPO-Clip 原理

策略概率比率为 $r_t(\theta)=\pi_\theta(a_t|s_t)/\pi_{\theta_{old}}(a_t|s_t)$，剪切目标：

$$L^{clip}=\mathbb E_t\min\left(r_t\hat A_t,
\operatorname{clip}(r_t,1-\epsilon,1+\epsilon)\hat A_t\right).$$

Critic 拟合回报，GAE 由 TD 残差累积得到优势，熵项鼓励探索。Stable-Baselines3 提供 PPO 算法实现，仓库主要工作集中在 MuJoCo 环境、状态/动作设计、奖励和训练配置。

## 3. Reach Target：状态、动作与奖励

7 关节状态与末端几何量组成 20 维观测：

$$o=[q_{1:7},\dot q_{1:7},p_{ee},p_{goal}-p_{ee}].$$

动作有两种模式。Delta 模式将归一化动作映射为关节增量并限幅：

$$q^{cmd}=\operatorname{clip}(q+\alpha a,q_{\min},q_{\max});$$

Absolute 模式将 $[-1,1]$ 线性映射到各关节范围。每次策略动作后，MuJoCo 执行若干物理子步，再重新计算末端状态和奖励。

Reward 模块包含：
- 目标距离奖励：远距离用 $1/(1+d)$，达到阈值给成功奖励；
- 直线路径偏离奖励/惩罚：将当前末端投影到起点—目标线段，计算横向偏离；
- 末端方向惩罚：期望工具 Z 轴朝向目标表面方向；
- 动作平滑惩罚：$||a_t-a_{t-1}||$；
- 碰撞惩罚：读取 MuJoCo contact；
- 关节限位惩罚：超出关节范围时按超限量惩罚。

因此总奖励不是单一末端距离，而是任务精度、路径形状、姿态、平滑与安全约束的组合。目标阈值配置为 5 mm；环境达到目标后额外给予终止奖励，最大步数截断并扣分。

## 4. 单臂与双臂避障

单臂避障观测还包含障碍物相对末端向量、障碍物距离及其位置等信息。策略需要同时学到接近目标和绕开障碍物，而不是把避障完全交给外部规划器。

双臂环境的动作空间为 14 维，前 7 维控制左臂，后 7 维控制右臂。每个 episode 随机化左右目标和障碍物位置。奖励由左右末端距离、目标推进、动作平滑、碰撞等项组成。双臂策略是联合策略，但并不意味着显式建模了双臂间的协作通信或任务分解。

## 5. 课程学习与域随机化

ReachTargetEnv 通过最近 50 次成功记录更新课程等级；目标采样距离随课程变化。关节阻尼在指定范围内随机化，初始关节角可添加噪声。这类随机化有助于降低策略对单一仿真参数的过拟合，但当前代码主要针对动力学参数/初始状态，不应夸大为完整 sim2real 域随机化。

## 6. 配置与训练

| 配置 | 默认值 |
|---|---:|
| 最大 episode steps | 500 |
| MuJoCo 子步数 | 5 |
| 动作类型 | delta |
| delta action scale | 0.1 |
| 目标到达阈值 | 0.005 m |
| PPO 总步数 | 100,000,000 |
| 学习率 | 3e-4 |
| rollout steps | 2048 |
| batch size | 256 |
| 折扣因子 | 0.99 |
| Actor 网络 | [256, 256, 128] |
| Critic 网络 | [512, 256, 128] |
| checkpoint 间隔 | 500,000 |

实际训练时还应记录 Stable-Baselines3 版本、VecNormalize 统计量、随机种子、并行环境数和 checkpoint 对应配置。归一化统计量与模型权重必须成对保存和加载。

## 7. 实验与改进

建议单臂目标到达对比 PPO 与解析 IK；单臂避障对比 PPO、RRT/MoveIt 规划、势场或 MPC；双臂任务对比共享策略与独立策略。指标包括末端位置/姿态误差、成功率、碰撞次数、最小间距、关节限位触发、动作变化率、完成时间和推理耗时。

重点消融：去掉线性度奖励、方向奖励、动作平滑项、碰撞惩罚；固定阻尼 vs 域随机化；固定目标分布 vs 课程学习。奖励调参不能只看 episode return，应同步查看物理碰撞、真实末端误差与动作轨迹。

## 8. 源码入口

- [README 与算法说明](https://github.com/Robot-Nav/Panda_arm_PPO/blob/main/README.md)
- [Gym 环境](https://github.com/Robot-Nav/Panda_arm_PPO/blob/main/src/envs/panda_reach_env.py)
- [奖励函数](https://github.com/Robot-Nav/Panda_arm_PPO/blob/main/src/envs/reward.py)
- [PPO 配置](https://github.com/Robot-Nav/Panda_arm_PPO/blob/main/src/training/config.py)
- [双臂避障环境](https://github.com/Robot-Nav/Panda_arm_PPO/blob/main/rl_dual_arm_obstacle.py)


---

[Robot-Nav 项目分析总索引](../README.md)
