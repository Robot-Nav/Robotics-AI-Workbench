# Bubble-Planner：算法与工程实现

> [源仓库](https://github.com/Robot-Nav/Bubble-Planner) · [源码快照](https://github.com/Robot-Nav/Bubble-Planner/tree/fe5e056d87ced2abb043d9ab1ea8c01f8e9668ee) · 2026-11-26
>
> 本页为核心源码初审与理论说明；未进行编译、仿真或真机复测。公式为实现归纳或明确标注的通用理论。

## 1. 问题与架构
面向三维空间飞行器局部规划，将离散避障与连续动力学轨迹优化解耦。点云 → ObstacleIndex → AStar3D 引导路径 → CorridorGenerator 球形安全走廊 → MincoOptimizer → 独立碰撞检查 → RHC 重规划。源码包含 ROS 节点、paper/enhanced 两种配置，不能把增强模式当作原论文完全复现。

## 2. 球形走廊与采样
球心 $\mathbf c$ 到最近障碍距离为 $d$，理想半径 $r=d-r_{\rm robot}-r_{\rm margin}$，再施加半径上限及最小半径筛选。相邻球必须满足 $||c_i-c_{i+1}||\le r_i+r_{i+1}-d_{\rm overlap}$，并检查重叠体积。以引导方向构造局部正交基，沿纵向、横向、竖直方向高斯采样球心；增强模式调整采样协方差。实际评分为

$$
S=\rho_1 V_{\rm sphere}+\rho_2 V_{\rm overlap}+\rho_3\Delta s-\rho_4||c-c_{\rm guide}||.
$$

大球提供运动自由度，重叠提供连续连接，推进项避免原地反复采样。参见 [corridor_generator.cpp](https://github.com/Robot-Nav/Bubble-Planner/blob/fe5e056d87ced2abb043d9ab1ea8c01f8e9668ee/src/corridor_generator.cpp#L27-L183)。

## 3. MINCO 与时间优化
每段采用七次多项式 $p_i(t)=\sum_{j=0}^7 c_{ij}t^j$；给定边界条件、连接点与时长后通过 MINCO 消去多项式系数，以航点与对数时间为变量（$T_i=\exp(\tau_i)$）。最小 snap 的一般能量为 $\int||p^{(4)}||^2dt$。代码调用 minco_.getEnergy，并加入时间、球约束、速度、加速度、jerk 和交叠航点惩罚：

$$
J=E+\rho_T\sum T_i+\sum_i\int_0^{T_i}\sum_k w_k B(g_k(t))dt.
$$

例如 $g_c=||p-c_i||^2-r_i^2$、$g_v=||\dot p||^2-v_{\max}^2$；平滑障碍函数 B 在违反约束时增加代价。梯形积分端点权重 0.5，L-BFGS 搜索有限维变量。软惩罚与离散采样不是连续无碰撞证明，最终还执行独立碰撞检查。[minco_optimizer.cpp](https://github.com/Robot-Nav/Bubble-Planner/blob/fe5e056d87ced2abb043d9ab1ea8c01f8e9668ee/src/minco_optimizer.cpp#L91-L167)、[bubble_planner.cpp](https://github.com/Robot-Nav/Bubble-Planner/blob/fe5e056d87ced2abb043d9ab1ea8c01f8e9668ee/src/bubble_planner.cpp#L105-L185)。

## 4. 滚动重规划
[RhcManager::select](https://github.com/Robot-Nav/Bubble-Planner/blob/fe5e056d87ced2abb043d9ab1ea8c01f8e9668ee/src/rhc_manager.cpp) 找到离当前位置最近的旧球，重新查询最近障碍距离、缩减半径，保留有效前缀及旧航点、时间作为热启动。不能直接复用未经复查的旧走廊；动态环境中保留前段承诺时间也需要停止能力与感知延迟约束。

## 5. 参数与实验
| enhanced 参数 | 值 | 影响 |
|---|---:|---|
| replan_rate / command_rate | 20 / 100 Hz | 规划与指令不同节拍 |
| batch_size / max_spheres | 96 / 64 | 搜索代价与覆盖 |
| drone_radius / safety_margin | 0.30 / 0.18 m | 安全空间 |
| max_velocity / acceleration / jerk | 6 / 8 / 25 | 运动限幅目标 |
| quadrature_intervals / max_iterations | 10 / 60 | 积分精度与优化预算 |
| commit_time | 0.15 s | 切换策略 |
来源：[bubble_enhanced.yaml](https://github.com/Robot-Nav/Bubble-Planner/blob/fe5e056d87ced2abb043d9ab1ea8c01f8e9668ee/config/bubble_enhanced.yaml)。[geometry_sanity.py](https://github.com/Robot-Nav/Bubble-Planner/blob/fe5e056d87ced2abb043d9ab1ea8c01f8e9668ee/tests/geometry_sanity.py) 与 demo_world 提供测试入口；未运行，未核实成功率。

## 6. 横向知识与改进
A* 负责拓扑引导；RRT* 通过渐近优化采样搜索；凸多面体走廊能利用不规则自由空间，球走廊查询简单但可能浪费空间。MINCO 通过稀疏参数化减少变量，不等于 B-spline。重点比较狭窄通道成功率、最小连续间隙、重规划耗时分位数、jerk/snap 和失败后制动。理论参考 [MINCO/GCOPTER](https://github.com/ZJU-FAST-Lab/GCOPTER)，未核实该仓库与所有上游细节完全一致。

## 关联知识
[路径规划](../../../04-robotics-core/planning.md) · [运动控制](../../../04-robotics-core/motion-control.md) · [专题总览](../README.md)
