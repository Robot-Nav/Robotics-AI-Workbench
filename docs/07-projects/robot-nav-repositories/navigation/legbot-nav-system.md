# legbot_Nav_system：Go2 点云局部规划、路径跟踪与路线图

> 源仓库：[Robot-Nav/legbot_Nav_system](https://github.com/Robot-Nav/legbot_Nav_system) · 默认分支：foxy-humble  
> 主要依据：README、localPlanner.cpp、pathFollower.cpp、terrainAnalysis.cpp、boundary_handler/graph_extractor.cpp。项目基于 Go2 自主导航栈并进行 ROS 2 集成，包含预计算路径集和局部路径选择，不是典型的在线 A* 全局规划器。

## 1. 系统组成

项目提供 Go2 仿真与实机导航入口，主要由以下模块组成：
- Base Autonomy：点云局部规划、地形分析、路径跟踪、传感器/里程计与运动控制；
- Route Planner：从可通行区域边界构建图结构，供路线规划使用；
- ROS 2 接口：接入 Unitree Go2 运动控制、点云、IMU、里程计和手柄；
- 可视化与数据：RViz、地图文件、路径集和 ROS bag。

README 中的基础自主导航部分来源于公开 Go2 autonomy stack，使用时要区分上游功能与本仓库的改动。

## 2. 预计算路径集与局部路径选择

localPlanner 并非每次在线从零搜索连续路径，而是加载预先生成的路径集合。源码定义 343 条基础候选路径，并将候选路径按 36 个旋转方向（每 10° 一档）投影到当前局部坐标系。它把局部规划转化为“路径候选 + 朝向离散 + 障碍物/地形评分”的选择问题。

点云先按机器人附近区域裁剪和 voxel 降采样。每个障碍点根据位置映射到局部栅格，利用预先生成的 voxel→path 对应表标记哪些路径被该障碍阻挡。若地形分析启用，则较低高度的地形点还可转化为路径惩罚，而不一定直接判定阻塞。

对于每条路径和旋转方向：
- 统计阻挡点数量；
- 计算地形高度惩罚；
- 计算候选路径终点方向与目标方向偏差；
- 根据旋转方向、路径分组、障碍惩罚和方向偏差计算评分；
- 汇总为路径组评分；
- 选择得分最高且满足旋转障碍约束的路径组。

因此它更接近离散候选轨迹评分/选择，而不是 Dijkstra、A* 或 RRT* 的在线图搜索。路径集质量、地图/栅格对应表和路径生成参数会直接影响可行路径覆盖。

## 3. 自适应规划范围与目标裁剪

规划范围可随速度调整，并设置最小路径长度/尺度，避免低速时搜索空间退化。Autonomy 模式下将全局目标变换到车体坐标系，得到相对距离与方向；若启用 pathCropByGoal，会对路径长度进行目标距离裁剪，避免局部路径明显越过目标。

局部坐标变换需保证 odom、vehicle、sensor frame 的定义一致。传感器安装偏移会被纳入机器人位置修正；如果 TF 和 sensorOffset 同时重复补偿，可能导致路径评分系统性偏移。

## 4. 地形分析与动态障碍物

terrainAnalysis 使用点云 voxel 表示地形，代码中包含扫描点降采样、地形高度统计、时间衰减、无数据区域处理、动态障碍物过滤等参数。典型默认值包括：
- 点云 voxel 尺寸 0.05 m；
- 地形 voxel 尺寸 1.0 m；
- 衰减时间 2.0 s；
- 近距离不衰减范围 4.0 m；
- 清除距离 8.0 m；
- 地形高度阈值和动态障碍物阈值可配置。

时间衰减用于降低陈旧障碍点的影响，但如果衰减过快，静态障碍物可能被错误清除；若过慢，动态障碍物可能残留。需要按机器人速度、点云频率和环境动态程度调参。

## 5. PathFollower：前视点与航向误差控制

pathFollower 接收局部 Path 和里程计，将机器人相对运动变换到路径发布时的参考坐标系，再沿路径前进，直到找到距离机器人超过 lookAheadDis 的前视点。由前视点相对方向计算路径方向角：

$$
\psi_{path}=\operatorname{atan2}(y_l,x_l),\qquad
e_\psi=\operatorname{wrap}(\psi-\psi_{path}).
$$

角速度采用比例式航向反馈：

$$
\omega=-k_\psi e_\psi,
$$

并按 maxYawRate 限幅。机器人速度很低时使用 stopYawRateGain，运动中使用 yawRateGain。双向模式下，当方向误差超过约 90° 且满足切换时间条件时，可在前进/后退之间切换。接近路径终点时按 endDis/slowDwnDisThre 缩速，并可根据机身倾角或倾角速度触发减速/停车。

这不是经典 Pure Pursuit 的曲率公式 $\kappa=2y_l/L^2$；它以 lookahead 点的方向误差作为航向反馈。二者都使用前视目标，但控制律不同。

## 6. Route Planner：边界图提取

boundary_handler 从可通行区域边界文件、轨迹文件和关联数据读取多边形边界，构建并可视化 V-Graph。该图用于表达自由空间边界结构与候选连通关系。使用时要检查输入边界是否闭合、坐标系是否一致、狭窄通道是否保留以及节点/边是否存在重复或退化。

本仓库同时包含 far_planner 等模块；其完整全局搜索策略和边界图的后续使用需要结合对应源码分支继续核查，不能只凭 V-Graph 名称推断为标准 Visibility Graph 的完整实现。

## 7. 关键参数与实验指标

| 模块 | 参数 | 代码默认值 |
|---|---|---:|
| 局部规划 | pathNum | 343 |
| 局部规划 | heading bins | 36（10°） |
| 局部规划 | gridVoxelSize | 0.02 m |
| 局部规划 | searchRadius | 0.55 m |
| 局部规划 | laserVoxelSize | 0.05 m |
| 跟踪 | lookAheadDis | 0.5 m |
| 跟踪 | yawRateGain | 7.5 |
| 跟踪 | maxSpeed | 1.0 m/s |
| 跟踪 | maxAccel | 1.0 m/s² |

建议测试狭窄通道、台阶/斜坡、动态行人、目标点近距离、前后切换和机身倾斜场景。指标包括局部规划耗时、可行路径率、最小障碍间距、路径长度、路径跟踪误差、速度平滑度、急停触发次数和任务成功率。

## 8. 源码入口

- [README 与仿真/实机说明](https://github.com/Robot-Nav/legbot_Nav_system/blob/foxy-humble/README.md)
- [局部路径规划](https://github.com/Robot-Nav/legbot_Nav_system/blob/foxy-humble/src/base_autonomy/local_planner/src/localPlanner.cpp)
- [路径跟踪](https://github.com/Robot-Nav/legbot_Nav_system/blob/foxy-humble/src/base_autonomy/local_planner/src/pathFollower.cpp)
- [地形分析](https://github.com/Robot-Nav/legbot_Nav_system/blob/foxy-humble/src/base_autonomy/terrain_analysis/src/terrainAnalysis.cpp)
- [边界图提取](https://github.com/Robot-Nav/legbot_Nav_system/blob/foxy-humble/src/route_planner/boundary_handler/src/graph_extractor.cpp)

---

[Robot-Nav 项目分析总索引](../README.md)
