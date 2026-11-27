# SuperMimic-Agent-WFArm：可微世界模型与轮腿臂协同策略学习

> 源仓库：[Robot-Nav/SuperMimic-Agent-WFArm](https://github.com/Robot-Nav/SuperMimic-Agent-WFArm) · 默认分支：main  
> 本文基于仓库自带的 PROJECT_ANALYSIS_CN.md、README_CN.md 与训练源码整理。项目中存在全身轮腿臂分支和固定底盘机械臂分支，两者状态、动作和控制目标不同，不能混成一个模型描述。

## 1. 研究问题与系统组成

目标是让策略在同一个控制决策中协调底盘、腿部、轮子与机械臂，使末端任务执行与机身运动相互配合。项目还保留固定底盘机械臂控制基线，用于分离验证末端任务学习机制。

主要模块：
- MimicAgent 风格参考生成前端：将任务和阶段计划转成轨迹程序，执行运动学检查和诊断反馈；
- MuJoCo 物理筛选：运行示范控制器，记录真实仿真状态转移；
- SuperMimic 风格后端：拟合可微世界模型，执行短时域想象展开；
- Actor / Critic：在可微模型内用 BPTT 优化策略；
- 真实仿真评估：检查接触、关节越界和任务成功，避免只在学习模型中自洽。

参考前端是离线轨迹提案和筛选工具，不是在线 VLA 控制器；世界模型学习机制也不意味着真实物理引擎被替换。

## 2. 全身状态与统一动作

全身分支的原始状态为 57 维：

$$
s_t=[p_t,r_t,q_t,v_t,\omega_t,\dot q_t],
$$

其中位置 3 维、wxyz 四元数 4 维、关节位置 22 维、线速度 3 维、角速度 3 维、关节速度 22 维。动力学网络接收规范化后的 53 维特征，去掉全局平移和航向中的冗余表示。

策略输出 22 维动作，按 12 路腿部位置目标、4 路轮速目标和 6 路机械臂位置目标排列：

$$
q_i^{target}=q_i^0+\sigma_i a_i,\qquad
\dot q_j^{target}=\sigma_j a_j.
$$

这是统一 Actor 的联合输出接口，但不自动证明底盘与机械臂已学会有效协同。需要通过底盘运动消融、机械臂冻结、姿态扰动和末端误差等实验验证。

固定底盘机械臂分支使用不同的低维关节状态和六维命令，输出六个关节位置目标，不应沿用全身分支的 57/53/22 维描述。

## 3. 可微世界模型

世界模型学习仿真转移：

$$
\hat s_{t+1}=F_\theta(\hat s_t,a_t,\xi),
$$

其中 $\xi$ 可包含摩擦等上下文。实现采用残差预测与显式积分，避免网络从零预测整个状态。以平移为例：

$$
\hat v_{t+1}=\hat v_t+R_h\Delta v_\theta,
$$

$$
\hat p_{t+1}=\hat p_t+\Delta t\hat v_{t+1}+R_h\Delta p_\theta.
$$

关节位置使用类似的速度积分与残差形式；姿态使用旋转增量更新并归一化。残差通过 tanh 和尺度限制，减少初始化时不合理的状态跳变。

训练采用多步自回归预测，而不是每一步都把真实状态重新喂给模型：

$$
\hat s_{t+k+1}=F_\theta(\hat s_{t+k},a_{t+k},\xi).
$$

损失由归一化状态预测误差和失败预测 BCE 组成。多步训练暴露误差累积问题；但预测误差小不代表动作梯度一定正确，因此还需要对比真实仿真与模型对小动作扰动的响应。

## 4. 失败预测与真实物理约束

全身分支将学习失败概率与解析失败概率组合：

$$
\hat d=1-(1-\hat d_{\rm learned})(1-\hat d_{\rm analytic}).
$$

想象展开可据此降低失败状态继续传播的权重。解析安全代理提供平滑学习信号，真实 MuJoCo 接触和关节限位仍是最终评估依据。代理间隙不等于精确网格碰撞检测，不能替代真实碰撞检查。

## 5. Actor 的 BPTT 与 Critic 的 λ-return

策略在模型中展开：

$$
a_t=\pi_\phi(o_t,g_t),\qquad
\hat s_{t+1}=F_\theta(\hat s_t,a_t,\xi).
$$

短时域目标包含累计任务奖励、存活概率和终端价值：

$$
J(\phi)=\mathbb E\left[
\sum_{t=0}^{H-1}\gamma^t C_t r_{t+1}
+\gamma^H C_H V_\psi(\hat s_H,g_H,\xi)\right],
$$

$$
C_t=\prod_{j=1}^{t}(1-\hat d_j).
$$

Actor 更新时冻结世界模型和 Critic 的参数，但保留状态/动作通过网络的梯度，因此可用 BPTT 将未来回报梯度传回当前动作。冻结参数与 detach 中间状态不是同一操作：后者会切断时间梯度链。

有示范时可加入行为克隆损失；参考状态跟踪辅助可随训练衰减。Critic 使用停止梯度的 λ-return 目标，降低单纯短时域模型回报的方差。固定底盘与全身分支的损失归一化和存活权重索引存在实现差异，阅读源码时需分支核对。

## 6. MimicAgent × SuperMimic 的关系

MimicAgent 前端根据任务描述与阶段计划生成轨迹程序，程序通过运动学检查，再在 MuJoCo 中执行。物理筛选后的真实状态、动作、下一状态用于模型拟合；经过筛选的参考也可用于 BC 或参考状态辅助。

因此：
- MimicAgent 负责“提出什么参考动作程序，并依据检查反馈修正”；
- MuJoCo 负责“该程序在真实仿真物理中是否可执行”；
- SuperMimic 风格世界模型负责“学习状态转移并在模型中展开”；
- BPTT 负责“通过想象回报优化策略”。

不能将 MimicAgent 生成的程序直接称为训练完成的控制策略，也不能把固定底盘基线的结果当成自由底盘全身协同的证明。

## 7. 实验设计与复现边界

建议分别评估末端到达、轨迹跟踪、底盘移动+机械臂操作。数据按完整请求/轨迹划分训练、验证和最终测试，防止相邻帧泄漏。比较世界模型多步预测误差、动作响应一致性、末端误差、底盘姿态、失败率、物理碰撞和模型外泛化。

固定底盘与全身分支应分别报告状态维数、动作接口、奖励和控制频率。最终测试集不能参与世界模型拟合、BC、Actor 更新或 checkpoint 选择。

## 8. 源码与参考

- [项目中文 README](https://github.com/Robot-Nav/SuperMimic-Agent-WFArm/blob/main/README_CN.md)
- [完整项目分析](https://github.com/Robot-Nav/SuperMimic-Agent-WFArm/blob/main/docs/PROJECT_ANALYSIS_CN.md)
- [世界模型与全身训练代码](https://github.com/Robot-Nav/SuperMimic-Agent-WFArm/tree/main/src/supermimic/wf)
- [MimicAgent 参考生成前端](https://github.com/Robot-Nav/SuperMimic-Agent-WFArm/tree/main/src/supermimic/mimicagent)
- [SuperMimic 原论文](https://arxiv.org/abs/2610.28480)
- [MimicAgent 原论文](https://arxiv.org/abs/2609.24145)

---

[Robot-Nav 项目分析总索引](../README.md)
