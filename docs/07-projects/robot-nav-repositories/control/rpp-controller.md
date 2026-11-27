# RPP_controller：算法与工程实现

> [源仓库](https://github.com/Robot-Nav/RPP_controller) · [源码快照](https://github.com/Robot-Nav/RPP_controller/tree/cc06b27b6449d095353b2bbe437d1a18d516ed7d) · 2026-11-26
>
> 本页为核心源码初审与理论说明；未进行编译、仿真或真机复测。公式为实现归纳或明确标注的通用理论。

## 1. 系统架构
独立 Regulated Pure Pursuit：Path + Pose + Twist + CostmapInterface → 路径转车体坐标 → carrot 点 → 曲率、速度 regulation → 转向/动态窗口可选分支 → 前向碰撞检查 → VelocityCommand。配置、碰撞、几何工具与控制器解耦，适合嵌入非 ROS 程序。

## 2. PP 几何与速度约束
前视目标坐标 $(x_c,y_c)$，由圆弧几何得 $x_c^2+(y_c-R)^2=R^2$，所以
$$\kappa=\frac{2y_c}{x_c^2+y_c^2},\quad \omega=v\kappa.$$
速度相关前视距离 $L=\operatorname{clip}(|v|T_L,L_{\min},L_{\max})$。曲率半径 $R=1/|\kappa|$ 小于配置阈值时，源码将速度按 $R/R_{\min}$ 缩放。地图膨胀代价反推距离
$$d=r_{\rm inscribed}+\frac{\ln253-\ln C}{k_{\rm inflation}}.$$
近障时按 $g d/d_{\rm scale}$ 缩速，取曲率和代价限制的较小值，再应用最小速度和近终点 regulation。此反算假设 costmap 采用相同指数膨胀模型，否则距离不可信。[regulation_functions.hpp](https://github.com/Robot-Nav/RPP_controller/blob/cc06b27b6449d095353b2bbe437d1a18d516ed7d/include/rpp_controller/regulation_functions.hpp)、[computeVelocityCommands](https://github.com/Robot-Nav/RPP_controller/blob/cc06b27b6449d095353b2bbe437d1a18d516ed7d/src/regulated_pure_pursuit_controller.cpp#L129-L291)。

## 3. 转向与安全
rotateToHeading 施加角加速度可行区间及停止速度 $\sqrt{2a_\omega|\theta_e|}$，降低转向超调。碰撞检查使用预测运动和 footprint；有限时间窗不是无条件安全保证，需考虑停止距离、延迟和地图有效性。[collision_checker.cpp](https://github.com/Robot-Nav/RPP_controller/blob/cc06b27b6449d095353b2bbe437d1a18d516ed7d/src/collision_checker.cpp)。源码另有 [dynamic_window_pure_pursuit_functions.hpp](https://github.com/Robot-Nav/RPP_controller/blob/cc06b27b6449d095353b2bbe437d1a18d516ed7d/include/rpp_controller/dynamic_window_pure_pursuit_functions.hpp)，具体是否启用取决于配置，不把它等同于全部运行模式。

## 4. 关键默认参数
| controller_config.hpp | 值 | 影响 |
|---|---:|---|
| use_collision_detection | true | 预测碰撞检查 |
| max_allowed_time_to_collision_up_to_carrot | 1 s | 检查时域 |
| use_cost_regulated_linear_velocity_scaling | true | 近障减速 |
| cost_scaling_dist / gain | 0.6 m / 1 | 调节区与比例 |
| inflation_cost_scaling_factor | 3 | 必须和地图一致 |
| use_fixed_curvature_lookahead | false | 曲率与跟踪目标可分离 |
来源：[controller_config.hpp](https://github.com/Robot-Nav/RPP_controller/blob/cc06b27b6449d095353b2bbe437d1a18d516ed7d/include/rpp_controller/controller_config.hpp)。

## 5. 评价及扩展
测试文件 [test_regulation_functions.cpp](https://github.com/Robot-Nav/RPP_controller/blob/cc06b27b6449d095353b2bbe437d1a18d516ed7d/test/test_regulation_functions.cpp)、[test_regulated_pp.cpp](https://github.com/Robot-Nav/RPP_controller/blob/cc06b27b6449d095353b2bbe437d1a18d516ed7d/test/test_regulated_pp.cpp)、[test_dwpp_functions.cpp](https://github.com/Robot-Nav/RPP_controller/blob/cc06b27b6449d095353b2bbe437d1a18d516ed7d/test/test_dwpp_functions.cpp) 可用作回归入口，本次未运行。比较 PP、Graceful、DWA、MPPI：前两类轻量跟踪，RPP 添加启发式速度约束，MPPI 优化多个候选时域轨迹。参考 [Regulated Pure Pursuit 论文](https://arxiv.org/abs/2305.20026)。建议验证狭窄弯道、急停距离、未知区域和动态障碍物。

## 关联知识
[路径规划](../../../04-robotics-core/planning.md) · [运动控制](../../../04-robotics-core/motion-control.md) · [专题总览](../README.md)
