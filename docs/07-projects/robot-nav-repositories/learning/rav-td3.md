# RAV-TD3：风险感知投票式连续控制

> 源仓库：[Robot-Nav/RAV_TD3](https://github.com/Robot-Nav/RAV_TD3) · 默认分支：master  
> 主要依据：README、TD3Net.py、Environment.py、per_buffer.py、limo_td3.py。本文区分项目自定义扩展与标准 TD3 理论；未在本轮重新训练或复现实验。

## 1. 任务与系统数据流

项目面向 ROS Noetic + Gazebo 中的 LIMO 移动机器人导航。策略从激光雷达扇区和目标相对极坐标直接产生线速度、角速度，环境层负责仿真交互、奖励、碰撞终止和安全限幅。

$$
s_t=[d_1,\ldots,d_{36},\ \Delta\psi,\ d_g],\qquad a_t=[v_t,\omega_t].
$$

激光扫描降采样为 36 个扇区，目标输入为相对方位角和距离。策略输出中线速度经 sigmoid 映射至 $[0,v_{\max}]$，角速度经 tanh 映射至 $[-\omega_{\max},\omega_{\max}]$，因此当前 Actor 设计为只前进、可双向转向，不直接学习倒车。

源码：[Environment.py](https://github.com/Robot-Nav/RAV_TD3/blob/master/src/limoRL/scripts/TD3/Environment.py)、[TD3Net.py](https://github.com/Robot-Nav/RAV_TD3/blob/master/src/limoRL/scripts/TD3/TD3Net.py)。

## 2. TD3 基础

TD3 用两个 Critic 抑制价值过估计，目标值取较小者：

$$
y=r+\gamma(1-d)\min_{i=1,2}Q_{\theta_i'}(s',\tilde a'),
$$

$$
\tilde a'=\operatorname{clip}(\pi_{\phi'}(s')+\epsilon,a_{\min},a_{\max}),\quad

\epsilon\sim\operatorname{clip}(\mathcal N(0,\sigma),-c,c).
$$

Critic 最小化 $L_Q=\sum_i\mathbb E[(Q_{\theta_i}(s,a)-y)^2]$；Actor 延迟更新，优化 $J_\pi=-\mathbb E[Q_{\theta_1}(s,\pi_\phi(s))]$；目标网络使用 Polyak 更新 $\theta'\leftarrow\tau\theta+(1-\tau)\theta'$。这三项是 TD3 的基础机制，项目在其上叠加双 Actor 投票、风险感知编码与回放机制。

## 3. 创新模块一：极坐标激光注意力

每个雷达扇区先映射为嵌入 $e_i$，再叠加可学习注意力 logit 与距离风险偏置：

$$
\alpha_i=\operatorname{softmax}\left(W_a e_i+\frac{\beta}{d_i+0.05}\right),\qquad
c=\sum_{i=1}^{36}\alpha_i e_i.
$$

近距离扇区即使尚未被网络充分学习，也会获得较强注意力。随后将上下文向量、目标 MLP 特征以及雷达最小值/均值/标准差拼接，再经融合层送入 Actor/Critic。其意义是把“哪个方向危险”显式引入特征提取，而不只是把 36 个数直接交给全连接网络。

注意：$1/(d_i+0.05)$ 对无效距离、零距离和量纲敏感；应确认扫描预处理已对 NaN、Inf、最小量程和最大量程作一致处理。

## 4. 创新模块二：双 Actor 软投票

两个 Actor 对同一状态产生候选动作：

$$
a_A=\pi_A(s),\quad a_B=\pi_B(s),\quad
Q_A=\min_j Q_j(s,a_A),\quad Q_B=\min_j Q_j(s,a_B).
$$

按 Q 值 softmax 得到权重 $w_A,w_B$，再组合 $a_v=w_Aa_A+w_Ba_B$。训练中还对两 Actor 加入一致性正则，约束其输出不要过度分歧。碰撞风险升高时，推理端进一步向角速度绝对值较大的候选动作偏移：

$$
risk=\operatorname{clip}\frac{d_{\rm risk}-d_{\rm front}}{d_{\rm risk}-d_{\rm collision}},\qquad
\omega=\omega_v+risk^2(\omega_{\rm strong}-\omega_v).
$$

这属于项目的风险增强启发式，不是 TD3 标准更新。软投票能利用策略差异，但两个 Actor 若分别建议左右急转，线性平均可能削弱转向；风险修正和安全层需要联合验证。

## 5. 创新模块三：风险感知奖励

前方最近距离定义归一化风险，奖励项随风险变化：安全时鼓励目标推进和速度，近障时降低前进奖励、增加转向鼓励并惩罚危险直行和高速。总奖励可抽象为：

$$
r=\sum_i w_i(risk)r_i-\sum_j \lambda_j(risk)p_j.
$$

项目 README 给出的代表项包括目标推进、速度、朝向对齐、安全间隙、转向、控制平滑、风险直行惩罚、风险高速惩罚等。奖励设计解决固定权重在开阔区和狭窄区难以兼顾的问题，但动态权重也可能引入奖励突变或局部最优，应画出各项随距离变化曲线并做消融。

## 6. OU 探索与优先经验回放

OU 噪声满足离散形式：

$$
n_{t+1}=n_t+\theta(\mu-n_t)\Delta t+\sigma_t\sqrt{\Delta t}\,\epsilon_t.
$$

其时间相关性适合连续速度控制；项目还设置噪声衰减。PER 使用 SumTree 保存优先级，按 $P(i)=p_i^\alpha/\sum_jp_j^\alpha$ 抽样，并以重要性权重 $(N P(i))^{-\beta}$ 修正偏差。优先级通常由 TD error 加小常数构成。代码按优先级区间分层采样，复杂度约 $O(B\log N)$。

源码：[per_buffer.py](https://github.com/Robot-Nav/RAV_TD3/blob/master/src/limoRL/scripts/TD3/per_buffer.py)。

## 7. 环境安全层与训练参数

环境除了 reward 以外，还做了传感器话题回退、扫描有效性处理、碰撞检测、旋转卡死/无进展检测、速度与速度变化率限制、紧急停止距离控制。它们是环境工程安全机制，不能把策略奖励本身当作安全保证。

| 参数 | 训练入口默认值/实现值 |
|---|---:|
| 激光扇区数 | 36 |
| 动作维度 | 2 |
| 线速度上限 | 0.6 m/s |
| 角速度上限 | 1.0 rad/s |
| 随机动作预热 | 5000 steps |
| Replay Buffer | 200000 |
| Batch size | 128（训练入口） |
| $\gamma,\tau$ | 0.99，0.005 |
| target policy noise / clip | 0.2 / 0.5 |
| delayed actor update | 每 2 次 Critic 更新一次 |

注意 TD3 类本身的构造默认值与训练脚本传参可能不同，实验复现应以启动参数和实际日志为准。

## 8. 实验设计与进一步改进

建议固定地图、随机种子和起终点分布，对比 TD3、双 Actor 无风险增强、完整 RAV-TD3、去注意力、去风险奖励、均匀回放。指标至少包含成功率、碰撞率、最小障碍间距、路径长度、到达时间、角速度变化率、策略推理频率。还应统计不同障碍密度与传感器噪声下的结果。

可进一步研究：风险估计的不确定性、双 Actor 分歧度作为置信度、基于 CBF 的动作安全过滤、碰撞事件的优先级偏置、Sim2Real 域随机化与实机急停验证。

## 9. 相关基础知识

- [TD3 原论文](https://arxiv.org/abs/1802.09477)
- [Prioritized Experience Replay](https://arxiv.org/abs/1511.05952)
- [模仿学习与强化学习基础](../../../03-physical-ai/robot-learning.md)

---

[Robot-Nav 项目分析总索引](../README.md)
