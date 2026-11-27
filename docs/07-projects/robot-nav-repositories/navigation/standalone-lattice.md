# standalone_lattice_planner：算法与工程实现

> [源仓库](https://github.com/Robot-Nav/standalone_lattice_planner) · [源码快照](https://github.com/Robot-Nav/standalone_lattice_planner/tree/c6c665afeec5e0560d2b2bfadbcfb1813de9a2b2) · 2026-11-26
>
> 本页为核心源码初审与理论说明；未进行编译、仿真或真机复测。公式为实现归纳或明确标注的通用理论。

## 1. 系统定位
独立 C++ State Lattice 规划器，从 Nav2 Smac 相关结构移植、移除 ROS 依赖。输入 costmap、运动原语 JSON、起终位姿与 footprint，经 A*、解析扩展和可选平滑输出路径。源码包含独立地图加载、碰撞、启发式及搜索模块。

## 2. 状态与运动原语
节点 $n=(i_x,i_y,i_\theta)$，原语是预先生成的运动可行曲线集合，按起始航向分类。每次扩展将原语轨迹平移到当前状态，得到末端栅格和航向，并对中间位姿检查占据/footprint。相比 Hybrid A* 的在线积分，原语离线生成可统一几何可行性，但分辨率和原语覆盖限制解空间。[LatticeMotionTable](https://github.com/Robot-Nav/standalone_lattice_planner/blob/c6c665afeec5e0560d2b2bfadbcfb1813de9a2b2/src/state_space/node_lattice.cpp#L40-L109)。

## 3. 搜索代价与启发式
源码 child cost 归一化 $c=C/252$，原语长度转为栅格单位 $\ell$，一般移动代价

$$
g_e=\ell(r+w_c c^p),\quad p\in\{1,2\}.
$$

转弯、左右切换、倒车分别乘以或添加惩罚因子；原地旋转独立计价。启发式取 $h=\max(h_{\rm obs},\min_{q\in G}h_{\rm dist}(n,q))$。取最大而不是相加可避免重复计算距离；只有各项都为下界且代价满足条件，才有 A* 最优性保证。retrospective_penalty、解析扩展、提前终止和离散化均可能改变保证。[getTraversalCost/getHeuristicCost](https://github.com/Robot-Nav/standalone_lattice_planner/blob/c6c665afeec5e0560d2b2bfadbcfb1813de9a2b2/src/state_space/node_lattice.cpp#L279-L345)。

## 4. 工程实现
[configure/createPlan](https://github.com/Robot-Nav/standalone_lattice_planner/blob/c6c665afeec5e0560d2b2bfadbcfb1813de9a2b2/src/lattice_planner.cpp) 校验 costmap 分辨率与原语元数据，初始化角度离散的 footprint checker，互斥锁保护规划状态；[AStarAlgorithm](https://github.com/Robot-Nav/standalone_lattice_planner/blob/c6c665afeec5e0560d2b2bfadbcfb1813de9a2b2/include/lattice_planner/search/a_star_impl.hpp) 管理图节点、目标集合、障碍启发式缓存与搜索；[analytic expansion](https://github.com/Robot-Nav/standalone_lattice_planner/blob/c6c665afeec5e0560d2b2bfadbcfb1813de9a2b2/include/lattice_planner/search/analytic_expansion_impl.hpp) 尝试直接连接目标以减少搜索；[smoother](https://github.com/Robot-Nav/standalone_lattice_planner/blob/c6c665afeec5e0560d2b2bfadbcfb1813de9a2b2/src/smoother/smoother.cpp) 执行后处理。平滑可能改变原语可行性，需对最终路径复查。离散状态的规模约 $N_xN_yN_\theta$，每节点扩展 M 个原语，优先队列操作通常 $O(\log V)$，碰撞检查受原语采样数影响。

## 5. 参数与验证
| SearchInfo/LatticePlannerConfig | 默认 | 意义 |
|---|---:|---|
| non_straight_penalty | 1.05 | 转弯代价 |
| reverse_penalty / cost_penalty | 2 / 2 | 倒车与地图代价 |
| rotation_penalty | 5 | 原地转向 |
| max_iterations | 1000000 | 搜索预算 |
| max_planning_time | 5 s | 时间预算 |
| angle_quantization / num_quantizations | 72 / 72 | 角度配置，原语航向以元数据为准 |
| smoothing_max_time | 2 s | 平滑预算 |
来源：[config.hpp](https://github.com/Robot-Nav/standalone_lattice_planner/blob/c6c665afeec5e0560d2b2bfadbcfb1813de9a2b2/include/lattice_planner/core/config.hpp)。示例入口 [examples/main.cpp](https://github.com/Robot-Nav/standalone_lattice_planner/blob/c6c665afeec5e0560d2b2bfadbcfb1813de9a2b2/examples/main.cpp)，仓库 [PERFORMANCE](https://github.com/Robot-Nav/standalone_lattice_planner/blob/c6c665afeec5e0560d2b2bfadbcfb1813de9a2b2/docs/PERFORMANCE.md) 为原项目记录，未重新实测。

## 6. 研究路线
对比 Hybrid A*、Theta* 与 lattice：状态维数、运动原语覆盖、反向搜索启发式、狭窄空间精确 footprint、重规划缓存失效。参考 [Nav2 Smac Planner](https://docs.nav2.org/configuration/packages/configuring-smac-planner.html)，运动原语生成算法与该移植版本差异需另查。

## 关联知识
[路径规划](../../../04-robotics-core/planning.md) · [运动控制](../../../04-robotics-core/motion-control.md) · [专题总览](../README.md)
