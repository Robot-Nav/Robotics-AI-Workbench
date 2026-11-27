# PP_Controller：算法与工程实现

> [源仓库](https://github.com/Robot-Nav/PP_Controller) · [源码快照](https://github.com/Robot-Nav/PP_Controller/tree/c6e31335feb5ce98c00f92e2859051ea8c0e5d31) · 2026-11-26
>
> 本页为核心源码初审与理论说明；未进行编译、仿真或真机复测。公式为实现归纳或明确标注的通用理论。

## 1. 项目定位：不是普通 Pure Pursuit
核心类是 SmoothControlLaw / Graceful Controller，使用目标姿态的极坐标反馈，而不只是前视点几何曲率。独立 C++ 控制核心通过 ROS 2 包装节点接收路径、状态并输出速度，包含初始/终点旋转、前视目标选择和碰撞检测。

## 2. 数学原理
经典 PP 在车体坐标系的目标点 $(x_l,y_l)$ 给出 $\kappa=2y_l/(x_l^2+y_l^2)$，$\omega=v\kappa$，不显式考虑目标姿态。Graceful 使用相对距离 $r$ 与角误差 $\phi,\delta$；源码曲率计算包含

$$
P=k_\delta(\delta-\arctan(-k_\phi\phi)),\quad F=(1+k_\phi/(1+(k_\phi\phi)^2))\sin\delta.
$$

曲率由上述反馈项除以距离并按源码坐标符号组合。应结合 EgoPolarCoords 的角定义阅读，不可互换目标航向与视线角。速度策略为

$$
v=\frac{v_{\max}}{1+\beta|\kappa|^\lambda},\quad \omega=\kappa v.
$$

接近目标再按 slowdown_radius 缩速，角速度饱和时回算线速度维持曲率，再施加速度上下界。距离接近零时返回零避免除零。[SmoothControlLaw](https://github.com/Robot-Nav/PP_Controller/blob/c6e31335feb5ce98c00f92e2859051ea8c0e5d31/graceful_controller_standalone.cpp#L87-L193)。

## 3. 工程实现与参数
calculateNextPose 使用离散单轮车运动学预测下一位姿，可用于碰撞前向检查。控制器根据目标距离、角度切换跟踪与旋转逻辑。ROS 2 包装见 [graceful_controller_ros2.cpp](https://github.com/Robot-Nav/PP_Controller/blob/c6e31335feb5ce98c00f92e2859051ea8c0e5d31/ros2_ws/src/graceful_controller_ros2/src/graceful_controller_ros2.cpp)。
| 参数 | YAML 值 |
|---|---:|
| control_frequency | 20 Hz |
| min/max_lookahead | 0.25 / 1.0 m |
| k_phi / k_delta | 2 / 1 |
| beta / lambda | 0.4 / 2 |
| v_linear_min/max | 0.1 / 0.5 m/s |
| v_angular_max | 1 rad/s |
| slowdown_radius | 1.5 m |
| goal_dist / angle tolerance | 0.1 m / 0.1 rad |
| collision safety_distance | 0.3 m |
来源：[controller_params.yaml](https://github.com/Robot-Nav/PP_Controller/blob/c6e31335feb5ce98c00f92e2859051ea8c0e5d31/config/controller_params.yaml)。低速下限可能与终点停车冲突，需由终点逻辑覆盖；改变前视与增益应结合振荡和最小曲率测试。

## 4. 对比、实验和资料
与 RPP 相比，本方法额外使用目标方向误差；与 LQR/MPC 相比，无在线矩阵求解或轨迹优化，计算轻但对目标选择、坐标误差和限幅敏感。建议测试直线、圆、S 弯、倒车与原地转向，统计横向误差、超调、速度平滑和终点姿态。未执行 ROS 仿真。参考 [Nav2 Graceful Controller](https://docs.nav2.org/configuration/packages/configuring-graceful-motion-controller.html)。

## 关联知识
[路径规划](../../../04-robotics-core/planning.md) · [运动控制](../../../04-robotics-core/motion-control.md) · [专题总览](../README.md)
