# lidar_imu_camera_ws：LiDAR–IMU–Camera 标定与融合定位工作区

> 源仓库：[Robot-Nav/lidar_imu_camera_ws](https://github.com/Robot-Nav/lidar_imu_camera_ws) · 默认分支：main  
> 主要依据：README、FAST-LIO 技术文档、RS16 外接 IMU 标定指南、D435i 相机-IMU 指南、FAST-Calib 与 FAST-LIVO2 集成代码。工作区包含多个上游项目，本文按传感器标定链和定位算法链拆解。

## 1. 工作区定位

该仓库不是单一 SLAM 算法，而是把 LiDAR-IMU、Camera-IMU、LiDAR-Camera 标定与 FAST-LIO2 / FAST-LIVO2 建图验证整合在同一工作空间。传感器组合包括 Livox MID360、RoboSense RS16、外置 IMU、RealSense D435i 等。

核心目标是让不同传感器之间的空间外参和时间偏移可估计、可复核，并将标定结果正确写入定位系统配置。标定参数方向、时间戳语义或坐标系命名错误，都会造成融合定位漂移，即使每个单独驱动都能正常发布数据。

## 2. LiDAR–IMU 时空联合标定：LI-Init

LiDAR 和 IMU 的测量时间不同步，且两者坐标系存在固定旋转和平移。LI-Init 联合估计：

- 旋转外参 $R_{IL}$；
- 平移外参 $t_{IL}$；
- LiDAR 与 IMU 的固定时间偏移 $\Delta t$；
- IMU 陀螺仪/加速度计零偏初值。

RS16 指南特别要求点云包含逐点 timestamp 和 ring 信息，因此需使用 XYZIRT 点类型。没有逐点时间戳，就无法正确利用 IMU 轨迹对一帧扫描内不同采样时刻的点进行去畸变。

标定不强制要求事先具备 PPS/PTP 硬件同步，但需要两路时间戳有效且时基语义明确。软件估计固定时间偏移不能补偿随时间漂移的时钟，也不能修复驱动端错误的时间戳。

标定输出中的变换方向必须明确。例如若定义：

$$p_I=R_{IL}p_L+t_{IL},$$

则写入 FAST-LIO 配置时必须采用相同的 LiDAR→IMU 约定，不能把逆变换直接填入。

## 3. FAST-LIO2：紧耦合激光惯性里程计

FAST-LIO2 以 IMU 高频传播为预测，以 LiDAR 点云 scan-to-map 配准为观测更新。主要流程：

1. 解析 LiDAR 点云与逐点时间；
2. IMU 初始化重力和零偏；
3. IMU 前向传播得到扫描期间连续运动状态；
4. 将点云反向传播到统一参考时刻，完成 deskew；
5. 下采样并将点变换到世界坐标；
6. 在 ikd-Tree 中查询近邻、拟合局部平面；
7. 构造点到面残差和状态雅可比；
8. 通过流形上的迭代 EKF 更新状态；
9. 将有效点增量插入 ikd-Tree，并裁剪视场外地图。

状态包括位置、姿态、速度、IMU bias、重力和 LiDAR-IMU 外参等。连续运动模型可写为：

$$\dot p=v,\quad
\dot R=R[\omega_m-b_g-n_g]_\times,$$

$$\dot v=R(a_m-b_a-n_a)+g.$$

对每个点 $p_j$，根据其采样时刻与扫描参考时刻之间的相对位姿进行去畸变。完成坐标变换后，局部平面观测残差为：

$$r_j=n_j^T p_j^W+d_j.$$

IEKF 根据残差与雅可比修正位姿、速度、bias 等状态。ikd-Tree 支持增量插入、删除和局部地图维护，避免每帧重新构建整张 KD 树。

源码：[laserMapping.cpp](https://github.com/Robot-Nav/lidar_imu_camera_ws/blob/main/src/FAST_LIO/src/laserMapping.cpp)、[FAST-LIO 技术文档](https://github.com/Robot-Nav/lidar_imu_camera_ws/blob/main/src/FAST_LIO/TECHNICAL_DOCUMENTATION.md)。

## 4. FAST-LIVO2：LiDAR-IMU-视觉融合

FAST-LIVO2 在激光惯性状态估计基础上引入图像观测，使视觉纹理信息参与状态估计与地图约束。与 FAST-LIO2 相比，融合系统还必须处理相机内参、相机-IMU 外参、相机-雷达外参、图像曝光时间和时间偏移。

实际部署时应分别验证：
- 仅 LiDAR + IMU 的轨迹稳定性；
- 仅 Camera + IMU 的视觉惯性初始化和跟踪；
- 多传感器外参固定后的联合运行；
- 遮挡、低纹理、运动模糊、快速旋转和时间偏移扰动下的鲁棒性。

不能因为 FAST-LIVO2 能启动，就认定相机与 LiDAR 的外参正确；应检查图像投影点与点云边缘/平面结构是否对齐。

## 5. Camera–IMU 标定：D435i 与 VINS-Mono

D435i 标定指南将问题拆成三类：
1. IMU 内参：通过六面静止采集估计加速度计/陀螺仪确定性误差，并写入设备；
2. RGB 相机内参：读取对应分辨率的 CameraInfo，内参与分辨率绑定；
3. RGB–IMU 联合外参与时间偏移：以设备出厂外参为初值，用 VINS-Mono 优化旋转、平移、时间延迟及运行时 bias。

时间偏移符号必须与配置一致，例如 $t_{imu}=t_{image}+td$。更换图像分辨率、帧率或驱动 SDK 后，应重新读取 CameraInfo 并复核时间戳链路。

## 6. LiDAR–Camera 外参标定

仓库提供两类方案：

- FAST-Calib：基于标定板/目标特征的 LiDAR-Camera 外参估计；
- direct_visual_lidar_calibration：无需专用标定板的直接视觉-激光标定方案。

两者适用条件不同。目标板法依赖标定板几何和角点/平面检测质量；无目标板法依赖环境中足够的视觉与几何结构。标定后应使用独立场景验证点云投影与图像边缘的一致性，避免只在标定数据上观察误差。

## 7. 工程排查顺序

1. 检查驱动时间戳是否为零、是否单调、是否来自同一时基；
2. 检查点云是否包含逐点时间字段，字段单位是否正确；
3. 检查 TF 树与外参变换方向；
4. 先验证 IMU 静止时 bias、重力方向和噪声；
5. 再运行 LiDAR-IMU 标定并检查残差；
6. 固化外参后运行 FAST-LIO2；
7. 再接入相机，逐步验证 Camera-IMU 和 LiDAR-Camera；
8. 通过 bag 回放、静态场景和闭环轨迹比较检查结果。

建议记录轨迹 ATE/RPE、点云地图重叠误差、闭环前后漂移、外参重复标定差异、时间偏移重复性、初始化时间和实时处理延迟。

## 8. 源码与指南

- [工作区 README](https://github.com/Robot-Nav/lidar_imu_camera_ws/blob/main/readme.md)
- [FAST-LIO 技术文档](https://github.com/Robot-Nav/lidar_imu_camera_ws/blob/main/src/FAST_LIO/TECHNICAL_DOCUMENTATION.md)
- [RS16 外接 IMU 标定指南](https://github.com/Robot-Nav/lidar_imu_camera_ws/blob/main/RS16_外接IMU_LiDAR_IMU_Init标定指南.md)
- [D435i IMU 与 RGB-IMU 标定指南](https://github.com/Robot-Nav/lidar_imu_camera_ws/blob/main/D435i中imu内参标定以及内置相机与imu内参优化联合标定指南.md)
- [FAST-LIO2 源码](https://github.com/Robot-Nav/lidar_imu_camera_ws/tree/main/src/FAST_LIO)
- [FAST-LIVO2 源码](https://github.com/Robot-Nav/lidar_imu_camera_ws/tree/main/src/FAST-LIVO2)


---

[Robot-Nav 项目分析总索引](../README.md)
