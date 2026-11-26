# Lazy_Thetastar_planner：算法与工程实现

> [源仓库](https://github.com/Robot-Nav/Lazy_Thetastar_planner) · [源码快照](https://github.com/Robot-Nav/Lazy_Thetastar_planner/tree/014cc6dfe9c6998fc60ae38dfc1bd4555f764321) · 2026-11-26
>
> 本页为核心源码初审与理论说明；未进行编译、仿真或真机复测。公式为实现归纳或明确标注的通用理论。

## 1. 问题与系统
二维代价地图 → ThetaStar 几何搜索 → LOS shortcut / 重采样 → Dubins 或 Bézier 连接、弹性平滑 → 航向与曲率处理 → 路径输出。该项目不是在完整速度、加速度状态空间中搜索的 kinodynamic A*；运动可行性主要在后处理阶段引入。

## 2. 任意角搜索
传统 A* 使用 $f=g+h$，网格边方向受邻域限制。Theta* 允许跨越若干网格连接祖先，降低折线绕行。源码 [generatePath/resetParent/setNeighbors](https://github.com/Robot-Nav/Lazy_Thetastar_planner/blob/014cc6dfe9c6998fc60ae38dfc1bd4555f764321/src/theta_star.cpp#L63-L175) 在弹出节点后调用 resetParent，检查当前节点到父节点的父节点的 LOS，若新累计代价更低则更新父指针。形式为
$$g'(n)=g(p(p(n)))+w_e||n-p(p(n))||+C_{\rm LOS}.$$
普通邻接边仍累计距离与通行代价；启发权重受 w_euc_cost 限制。这里是延迟祖父捷径实现，不能仅凭名字认定与论文 Lazy Theta* 的所有修复规则等价。队列为空时的终止逻辑值得添加“目标为最后出队节点”测试。

## 3. 运动约束与平滑
几何曲率 $\kappa=d\theta/ds$，非完整底盘 $\omega=v\kappa$、$a_y=v^2\kappa$。在参考速度 $v_r$ 下有效半径
$$R_{\rm eff}=\max(R_{\min},v_r^2/a_{y,\max},v_r/\omega_{\max}).$$
[KinodynamicOptimizer](https://github.com/Robot-Nav/Lazy_Thetastar_planner/blob/014cc6dfe9c6998fc60ae38dfc1bd4555f764321/src/kinodynamic_optimizer.cpp#L25-L50) 按此关系设置 Dubins solver 半径。Dubins 通过直线与定半径圆弧连接前进型姿态；代码进行采样、可行性验证、绕行比限制，失败可用前进型 Bézier 兜底。弹性优化权衡二阶平滑、参考偏移与曲率连续性；不能把保留的 bspline_degree 当成实际 B 样条求解。
恒速近似下 $\dot\omega=v^2 d\kappa/ds$，因此代码对相邻曲率变化作前后向限幅；如果速度变化还需加入 $\dot v\kappa$。限幅曲率字段并不自动证明原始几何曲线满足同样曲率，应从输出坐标重新测算。[曲率处理](https://github.com/Robot-Nav/Lazy_Thetastar_planner/blob/014cc6dfe9c6998fc60ae38dfc1bd4555f764321/src/kinodynamic_optimizer.cpp#L874-L950)。

## 4. 参数
| 配置 | 值 | 意义 |
|---|---:|---|
| planner_frequency | 1 Hz | 规划节拍 |
| w_euc_cost / w_traversal_cost | 1 / 2 | 距离/通行权重 |
| how_many_corners | 8 | 邻域 |
| allow_unknown | true | 未知区可能被允许 |
| max_linear_velocity / acceleration | 1 / 0.5 | m/s、m/s² |
| min_turning_radius / dynamic_feasibility_speed | 0.5 m / 0.6 m/s | 几何及动态评估 |
| max_lateral_acceleration / angular_velocity | 0.3 / 1.0 | 横向和角速度限制 |
| resample_interval / smoothing_iterations | 0.08 m / 90 | 平滑分辨率与预算 |
来源：[theta_star_params.yaml](https://github.com/Robot-Nav/Lazy_Thetastar_planner/blob/014cc6dfe9c6998fc60ae38dfc1bd4555f764321/config/theta_star_params.yaml)。

## 5. 对比与实验建议
A* 离散且简单，Theta* 更直但航向未入搜索状态，Hybrid A* 与 State Lattice 在 SE(2) 扩展运动原语可更直接保证几何约束。Dubins 仅前进，Reeds-Shepp 支持倒车。比较原始/优化路径长度、真实最大曲率、曲率变化、footprint 碰撞、规划时间及失败率；当前没有独立运行记录。参考 [Theta* 原论文](https://arxiv.org/abs/1401.3843)，具体 Lazy Theta* 论文信息待进一步核实。

## 关联知识
[路径规划](../../../04-robotics-core/planning.md) · [运动控制](../../../04-robotics-core/motion-control.md) · [专题总览](../README.md)
