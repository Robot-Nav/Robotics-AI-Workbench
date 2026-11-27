# 项目实践

项目记录以可复现和可验收为目标。每个项目至少应说明：

1. 要解决的问题与非目标。
2. 系统架构和模块接口。
3. 关键算法与设计取舍。
4. 构建、运行和部署命令。
5. 测试场景与评价指标。
6. 结果证据、已知限制和后续计划。

建议把项目代码放在独立仓库，本站维护项目说明、技术决策、实验报告和问题索引。

## Robot-Nav 开源项目算法分析

已完成 Robot-Nav 名下 **22 个可分析机器人项目**的源码阅读与算法文档整理，覆盖导航规划、优化控制、强化学习、移动操作、感知定位和视觉算法。2 个仓库暂时缺少公开源码，1 个仓库属于非机器人 AI 应用，因此不虚构分析内容。

- [Robot-Nav 项目算法分析总览](robot-nav-repositories/README.md)
- 导航规划：[legbot_3D_Nav](robot-nav-repositories/navigation/legbot-3d-nav.md) · [legbot_Nav_system](robot-nav-repositories/navigation/legbot-nav-system.md) · [Bubble-Planner](robot-nav-repositories/navigation/bubble-planner.md) · [Lazy Theta*](robot-nav-repositories/navigation/lazy-thetastar.md) · [State Lattice](robot-nav-repositories/navigation/standalone-lattice.md)
- 控制优化：[SA-MPPI](robot-nav-repositories/control/sa-mppi.md) · [legbot-MPC-WBC](robot-nav-repositories/control/legbot-mpc-wbc.md) · [Graceful Controller](robot-nav-repositories/control/pp-controller.md) · [RPP](robot-nav-repositories/control/rpp-controller.md) · [Path Tracking Benchmark](robot-nav-repositories/control/path-tracking-benchmarks.md) · [MPPI Cost Calculator](robot-nav-repositories/control/sa-mppi-cost-calculator.md)
- 强化学习：[legbot_lab](robot-nav-repositories/learning/legbot-lab.md) · [GO2_backflip](robot-nav-repositories/learning/go2-backflip.md) · [RAV-TD3](robot-nav-repositories/learning/rav-td3.md) · [RPO_IsaacLab](robot-nav-repositories/learning/rpo-isaaclab.md) · [Panda_arm_PPO](robot-nav-repositories/learning/panda-arm-ppo.md) · [IL-dual-arm](robot-nav-repositories/learning/il-dual-arm-hdr-il.md)
- 机械臂与移动操作：[manipulation_wheel](robot-nav-repositories/manipulation/manipulation-wheel.md) · [SuperMimic-Agent-WFArm](robot-nav-repositories/manipulation/supermimic-agent-wfarm.md) · [openarm-custom-stack](robot-nav-repositories/manipulation/openarm-custom-stack.md)
- 感知与视觉：[LiDAR-IMU-Camera](robot-nav-repositories/perception/lidar-imu-camera-ws.md) · [Deblurred_Image](robot-nav-repositories/vision/deblurred-image.md)

**验证边界：** 本批次完成公开源码阅读和文档整理，未对全部仓库执行统一编译、仿真或真机回归。各篇均注明源码证据、理论解释和待验证事项。
