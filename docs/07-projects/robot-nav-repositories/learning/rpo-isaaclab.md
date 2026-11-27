# RPO_IsaacLab：双足机器人 AMP、BeyondMimic 与强化学习训练

> 源仓库：[Robot-Nav/RPO_IsaacLab](https://github.com/Robot-Nav/RPO_IsaacLab) · 默认分支：main  
> 主要依据：README_CN.md、TECHNICAL_DOC_CN.md、Isaac Lab 任务配置、RSL-RL 训练入口和 atom01 部署目录。仓库包含多条算法路线，不能将所有任务统称为 AMP。

## 1. 项目定位与训练闭环

RPO_IsaacLab 是面向带臂双足机器人的 Isaac Lab / Isaac Sim 训练工作区，基于 RSL-RL，包含任务注册、机器人资产、地形、动作数据、训练/回放脚本、动作重定向和 MuJoCo Sim2Sim。任务覆盖平地/粗糙地形行走、舞蹈、参考动作模仿、起身恢复、跑酷、注意力编码和中断恢复。

典型流程：准备机器人关节拓扑、执行器参数与动作参考数据；Isaac Lab 并行环境采样状态、动作、奖励和终止；PPO 或 AMP-PPO 更新策略；导出策略并在 Isaac Lab 回放；在 MuJoCo 做 Sim2Sim；经部署接口完成观测构造、ONNX/PyTorch 推理、关节命令限幅与实机验证。

## 2. PPO：任务策略优化

PPO 使用旧策略与新策略的概率比率：

$$
r_t(\theta)=\frac{\pi_\theta(a_t|s_t)}{\pi_{\theta_{\rm old}}(a_t|s_t)},
$$

$$
L^{clip}=\mathbb E_t\left[\min\left(r_t\hat A_t,

\operatorname{clip}(r_t,1-\epsilon,1+\epsilon)\hat A_t\right)\right].
$$

Critic 回归价值目标，GAE 用 $\gamma$ 与 $\lambda$ 平衡优势估计偏差和方差。RSL-RL 在并行环境中采集 rollout，再按 minibatch/epoch 更新 Actor-Critic。域随机化、课程学习、镜像对称损失和特权 Critic 属于训练配置增强，不是 PPO 本身定义的一部分。

## 3. AMP：对抗式动作先验

AMP 将参考动作片段作为专家分布，判别器区分专家状态转移与当前策略状态转移。项目技术文档记录采用 LS-GAN 形式：专家标签 +1、策略样本标签 -1。判别器学习运动风格的可辨识特征，策略则最大化任务奖励与风格奖励的混合回报。

可以将目标写为：

$$
r_t=r_t^{task}+\lambda_{\rm amp}r_t^{style},
$$

$$
L_D=\frac12\mathbb E_{x_E}[(D(x_E)-1)^2]

+\frac12\mathbb E_{x_\pi}[(D(x_\pi)+1)^2].
$$

AMP 不是逐帧强制复现一条参考轨迹，而是学习参考动作分布中的运动风格；因此可在速度指令和任务目标约束下产生不同动作。项目包含平地 AMP、粗糙地形 AMP、LAFAN1 舞蹈 AMP 等任务。

## 4. BeyondMimic：显式参考轨迹跟踪

BeyondMimic 与 AMP 的关键差别是：它为当前时刻提供参考动作帧，策略通过关节位置/速度等误差奖励跟踪该帧，并叠加任务奖励与扰动鲁棒性训练。可抽象为：

$$
r_{\rm track}=
w_p e^{-\|q-q^*\|^2/\sigma_p^2}
+w_v e^{-\|\dot q-\dot q^*\|^2/\sigma_v^2}
+w_b e^{-\|p_b-p_b^*\|^2/\sigma_b^2}.
$$

项目另有 Getup-Mimic 起身模仿任务，参考动作重采样、初始位姿扰动和关节位置扰动需按具体配置理解。参考轨迹跟踪更直接，但对数据质量、相位对齐、重定向误差与参考动作覆盖范围更敏感。

## 5. Parkour、Direct RL 与注意力任务

- Parkour：面向复杂地形通过，任务包含深度/地形相关观测和专门推理导出路径；不是普通平地 PPO 的简单改名。
- Flat / Rough：Direct RL 任务直接优化运动任务奖励；粗糙地形配置可为 Critic 提供 height-scan 等特权观测。
- AttnEnc：用于验证注意力编码器在观测特征处理上的效果。
- Interrupt：研究运动执行中断后的恢复行为。
- Dance：以 LAFAN1 等动作参考进行风格学习。

这些任务应分别查看其 EnvCfg、观测组、奖励项、终止条件与训练入口，不能用单一超参数表概括所有任务。

## 6. 动作重定向与部署

动作重定向把公开人体/机器人动作映射到 RPO 的关节空间，核心包括骨架拓扑对应、坐标系/根节点变换、关节轴与零位映射、IK 或关节重定向、速度平滑和物理可执行性筛选。重定向后的动作必须检查关节限位、速度/加速度、足端接触与自碰撞。

部署配置位于 atom01_deploy 的 inference/config 目录，其中 BeyondMimic 配置包含 23 个关节通道、动作缩放 0.25，以及 IMU、重力投影、指令速度、关节状态和 last_action 等观测组。不同任务配置的观测布局不同，导出模型的输入顺序必须与推理端完全一致。

Sim2Sim 入口包含 direct RL、AMP、BeyondMimic、Parkour 等不同脚本。ONNX 导出只代表格式转换成功，不代表跨仿真器动态一致或实机安全。

## 7. 推荐实验与风险控制

1. AMP vs PPO：同任务奖励、同训练预算、同地形随机化，比较运动自然性、速度跟踪、跌倒率；
2. AMP vs BeyondMimic：在动作风格相同的情况下，比较参考动作误差、任务完成率和参考外泛化；
3. Flat → Rough：逐步增加地形高度、摩擦、质量与外力随机化；
4. Sim2Sim：统一关节顺序、PD 增益、摩擦、惯量、控制频率和观测滤波；
5. Sim2Real：增加传感器延迟、通信抖动、力矩限幅和急停测试。

评价至少包括速度跟踪 RMSE、机身姿态误差、足端滑移、跌倒率、恢复成功率、能耗、推理延迟和跨地形成功率。训练配置值不等于实测指标。

## 8. 主要源码入口

- [中文 README](https://github.com/Robot-Nav/RPO_IsaacLab/blob/main/README_CN.md)
- [完整技术文档](https://github.com/Robot-Nav/RPO_IsaacLab/blob/main/TECHNICAL_DOC_CN.md)
- [训练入口](https://github.com/Robot-Nav/RPO_IsaacLab/tree/main/robolab/scripts/rsl_rl)
- [MuJoCo Sim2Sim](https://github.com/Robot-Nav/RPO_IsaacLab/tree/main/robolab/scripts/mujoco)
- [实物部署配置](https://github.com/Robot-Nav/RPO_IsaacLab/tree/main/atom01_deploy)

## 9. 进一步阅读

- [AMP: Adversarial Motion Priors](https://arxiv.org/abs/2104.02180)
- [PPO](https://arxiv.org/abs/1707.06347)
- [Isaac Lab 文档](https://isaac-sim.github.io/IsaacLab/)

---

[Robot-Nav 项目分析总索引](../README.md)
