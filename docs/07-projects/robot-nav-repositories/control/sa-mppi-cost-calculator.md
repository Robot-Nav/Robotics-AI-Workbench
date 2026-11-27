# SA-MPPI Cost Calculator：MPPI Critic 代价计算与敏感性分析工具

> 源仓库：[Robot-Nav/SA-MPPI-cost-calculator](https://github.com/Robot-Nav/SA-MPPI-cost-calculator) · 默认分支：main  
> 类型：算法工程辅助工具，不是独立 MPPI 控制器。主要依据 critic_cost_formulas.md 与 critic_cost_calculator.html。

## 1. 工具定位

该仓库提供浏览器端交互计算器，帮助将 MPPI critic 的参数与单条候选轨迹的特征量代入代价公式，查看各项 cost、总代价、代价占比、参数敏感性和预设场景。它的用途是理解调参方向、检查数量级、解释“为什么某个 critic 主导总代价”。

**重要边界：** 计算器输入的是人工指定的距离、速度、偏差等摘要量，不会自动运行机器人动力学、采样 rollout、障碍物地图查询或 MPPI 权重更新。因此它不是闭环仿真，也不能替代真实控制器的 critic 单元测试。

## 2. Critic 结构

工具覆盖 10 类代价：

| Critic | 主要作用 | 典型形式 |
|---|---|---|
| Obstacles | 近障排斥与碰撞惩罚 | 指数衰减；碰撞给大代价 |
| PathFollow | 轨迹终点偏离参考路径 | $w_{pf}d$ |
| PathAlign | 多个轨迹采样点到路径距离均值 | $w_{pa}\bar d$ |
| PathAngle | 超出角度阈值后的朝向偏差 | $w_{pang}\Delta\theta$ |
| Goal | 终点到目标距离 | $w_gd_g^2$ |
| GoalAngle | 目标姿态误差 | $w_{ga}\Delta\theta_g^2$ |
| PreferForward | 倒车速度累计惩罚 | $w_b\sum_{v_x<0}|v_x|$ |
| Constraint | 线速度/角速度越界 | 约束违反量 × $dt$ |
| Twirling | 低前进速度伴随大角速度 | $(1-v_x/v_{\max})|w_z|$ |
| VelocityDeadband | 速度分量落入死区的惩罚 | $\sum\max(0,d_b-|v|)$ |

### 2.1 障碍物代价

当 $d_{margin}<d<d_{inflation}$ 时：

$$J_{obs}=w_{rep}\exp[-k(d-d_{margin})].$$

当 $d\le d_{margin}$ 时，工具采用固定大碰撞代价；超过 inflation 区域则不计排斥项。它表达的是软安全距离，不等同于几何碰撞检测。真实实现还要处理机器人 footprint、ESDF/距离场、障碍物有效性和采样时间。

### 2.2 路径与目标代价

PathFollow 使用轨迹末端到选定路径参考点的距离；PathAlign 使用多个轨迹采样点到路径的平均距离，并可叠加朝向误差。PathAngle 仅在偏差超过阈值时激活。Goal 与 GoalAngle 在进入目标邻域后强调终点位置和姿态精度。多个 critic 的启用阈值和采样 offset 会改变其生效区间。

### 2.3 运动约束代价

ConstraintCritic 将线速度、角速度超限量按 $dt$ 累积。工具区分差速和全向运动模型；若使用 Ackermann 模型，还应加入最小转弯半径或曲率约束，不能直接套用全向模型公式。TwirlingCritic 抑制低线速度下的原地旋转；VelocityDeadbandCritic 则对过小速度分量施加代价，避免输出落入电机死区。

## 3. 总代价与 MPPI 权重更新

一般 MPPI 对第 $k$ 条控制扰动序列计算累计代价 $S_k$，再以指数权重形成更新：

$$w_k=\frac{\exp[-(S_k-S_{\min})/\lambda]}
{\sum_j\exp[-(S_j-S_{\min})/\lambda]},\qquad
u_t\leftarrow u_t+\sum_kw_k\epsilon_{k,t}.$$

Critic 负责构造 $S_k$；温度 $\lambda$ 控制权重分布尖锐程度。改变某个 critic 的系数不仅影响单项代价，也会改变不同 rollout 的相对排序和最终控制更新。因此调参时应观察各项 cost 分布与有效样本数，而不是只让某个 cost 数值“看起来大”。

## 4. 工具使用建议

1. 先固定其余参数，只改变一个 critic 权重；
2. 分别输入开阔、近障、狭窄通道、接近目标、原地旋转等状态；
3. 查看总代价分解，识别是否某项始终压制其他项；
4. 对障碍物 margin、inflation、速度阈值做敏感性曲线；
5. 将工具结果与真实控制器日志中的 critic 输出逐项对照。

## 5. 使用时的易错点

- 所有 critic 的单位未必一致，权重需要结合 rollout horizon、dt 和累计方式解释。
- 路径偏差若按“每个采样点平均”与“整条轨迹累加”，量级不同。
- 指数障碍代价与碰撞常数存在跳变，可能导致优化权重过度集中。
- ConstraintCritic 是软惩罚，不能替代动作限幅、碰撞检查和安全停止。
- GoalCritic 与 PathFollowCritic 的目标区域可能重叠，需检查是否重复惩罚。
- 工具中预设公式必须与当前 SA-MPPI 分支的实际 critic 实现逐项核对，不能仅凭同名认定参数和边界完全相同。

## 6. 源码入口与关联项目

- [公式说明](https://github.com/Robot-Nav/SA-MPPI-cost-calculator/blob/main/critic_cost_formulas.md)
- [在线计算器源码](https://github.com/Robot-Nav/SA-MPPI-cost-calculator/blob/main/critic_cost_calculator.html)
- [SA-MPPI 控制器分析](./sa-mppi.md)


---

[Robot-Nav 项目分析总索引](../README.md)
