# openarm-custom-stack：OpenArm RGB-D 感知与 MoveIt Task Constructor 抓放

> 源仓库：[Robot-Nav/openarm-custom-stack](https://github.com/Robot-Nav/openarm-custom-stack) · 默认分支：main  
> 主要依据：README.md、aruco_detector_node.py、scene_manager.cpp、mtc_pregrasp.cpp、openarm_hardware 动力学与夹爪接触模块。仓库通过固定版本的上游依赖与补丁集成 OpenArm、MoveIt 和 RealSense，并非复制全部第三方源码。

## 1. 系统架构

项目面向 OpenArm v2.0 与 RealSense D435i 的视觉抓放任务。完整链路：

RGB-D 图像与 CameraInfo → 目标/箱体检测与位姿估计 → TF 与时间戳检查 → PlanningScene 碰撞物体更新 → MoveIt Task Constructor 规划 Pick → Place → Return → 轨迹安全检查 → ros2_control 执行 → 夹爪 torque 监测。

其关键是把视觉估计作为动态场景输入，而不是把物体位置、尺寸写死在 MTC 任务中。

## 2. ArUco 位姿估计

ArUco 检测先在灰度图像中提取 marker corners，再用相机内参矩阵和 marker 三维角点坐标执行 PnP 求解：

$$s\begin{bmatrix}u\\v\\1\end{bmatrix}
=K[R\mid t]\begin{bmatrix}X\\Y\\Z\\1\end{bmatrix}.$$

得到的旋转、平移转换为四元数和 PoseStamped，并发布 TF。相机内参来自 CameraInfo；图像消息时间戳用于保证位姿与图像时刻一致。marker 的实际尺寸、字典类型、相机坐标系和外参必须标定正确，否则 PnP 只能给出数学上自洽但物理坐标错误的位姿。

源码：[aruco_detector_node.py](https://github.com/Robot-Nav/openarm-custom-stack/blob/main/src/openarm_aruco_vision/openarm_aruco_vision/aruco_detector_node.py)。

## 3. RGB-D 物体几何与 PlanningScene

物体检测节点结合 RGB 图像和深度信息估计物体 pose 与尺寸。scene_manager 接收 pose 和 dimensions 两个话题，检查：
- 两者时间戳差是否在允许范围；
- frame_id 是否与 planning frame 一致；
- 位姿数值是否有限；
- 四元数是否归一化。

通过检查后创建 MoveIt CollisionObject，将箱体、物体等几何体加入 PlanningScene。这样规划器能在当前观测场景中做碰撞检查。视觉误差不能通过随意修改 MTC 目标位姿来掩盖，应先检查内参、深度对齐、TF 和物体尺寸估计。

源码：[scene_manager.cpp](https://github.com/Robot-Nav/openarm-custom-stack/blob/main/src/openarm_mtc_pick/src/scene_manager.cpp)。

## 4. MoveIt Task Constructor 任务规划

MTC 将复杂抓放任务分解为阶段：
1. CurrentState 获取当前机器人状态；
2. 生成预抓取姿态；
3. ComputeIK 将末端目标转换为关节状态；
4. Connect 连接阶段间轨迹；
5. MoveRelative / CartesianPath 生成接近、抬起、放置等笛卡尔运动；
6. ModifyPlanningScene 更新物体附着/释放状态；
7. 生成返回轨迹并执行。

任务的优势是将多个规划阶段组织为可检查的任务图，并允许不同阶段使用不同 solver。ComputeIK 负责位姿到关节空间映射，规划器负责关节空间无碰撞连接，CartesianPath 用于需要直线末端运动的阶段。IK 成功不代表整条路径无碰撞，也不代表执行器一定能跟踪。

## 5. 轨迹安全处理与执行

mtc_pregrasp.cpp 对待执行的子轨迹检查空轨迹、控制器归属、末端速度/加速度和轨迹边界，并对不安全的终端边界做处理后再提交执行。这个环节用于避免规划结果在控制器切换或轨迹拼接处出现突变。

实机运行前还必须验证关节零位、TF、控制器状态、夹爪接口、重力补偿和急停。README 提供 fake controllers、plan-only、随机场景回归和 Gazebo RGB-D 闭环入口；应先完成这些无硬件验证，再逐步进入低速空载实机测试。

## 6. 夹爪接触与动力学补偿

仓库集成了夹爪 torque 监测、接触检测与机械臂动力学补偿相关代码。接触检测应区分正常夹持力、摩擦/卡滞和机械限位；阈值需要通过空载、正常夹持和异常阻挡数据标定。重力补偿和关节力矩接口必须与上游驱动版本、关节方向和零位一致。

## 7. 测试与指标

建议记录视觉 pose 误差、尺寸误差、PlanningScene 更新延迟、MTC 规划成功率、规划时间、轨迹最小碰撞间距、执行跟踪误差、抓取成功率、放置误差、夹爪接触误判率。随机化箱体/物体尺寸、位置和 yaw，并把视觉高度误差单独注入，检查系统是否真正依赖在线视觉输入。

## 8. 源码入口

- [项目 README 与实机流程](https://github.com/Robot-Nav/openarm-custom-stack/blob/main/README.md)
- [ArUco 视觉节点](https://github.com/Robot-Nav/openarm-custom-stack/blob/main/src/openarm_aruco_vision/openarm_aruco_vision/aruco_detector_node.py)
- [PlanningScene 管理](https://github.com/Robot-Nav/openarm-custom-stack/blob/main/src/openarm_mtc_pick/src/scene_manager.cpp)
- [MTC 任务与执行](https://github.com/Robot-Nav/openarm-custom-stack/blob/main/src/openarm_mtc_pick/src/mtc_pregrasp.cpp)
- [OpenArm 硬件集成](https://github.com/Robot-Nav/openarm-custom-stack/tree/main/integration)


---

[Robot-Nav 项目分析总索引](../README.md)
