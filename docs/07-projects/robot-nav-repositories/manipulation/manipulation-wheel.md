# manipulation_wheel：全向移动操作与 Diffusion Policy

> 源仓库：[Robot-Nav/manipulation_wheel](https://github.com/Robot-Nav/manipulation_wheel) · 默认分支：main  
> 主要依据：README.md、ik_solver.py、base_controller.py、arm_controller.py、policy_server.py 及 diffusion_policy 配置。仓库的上游任务背景为 TidyBot++ 风格的全向移动操作系统；不要将它误认为四轮足底盘控制器。

## 1. 系统定位

项目把全向移动底盘、机械臂、相机、遥操作、数据记录和 Diffusion Policy 推理串成一个移动操作闭环。底盘负责平面移动与朝向，机械臂负责末端操作，策略输入多视角图像/机器人状态并输出底盘与机械臂动作。控制器与策略服务器分离，避免把高频电机控制直接放进神经网络推理循环。

系统层次：
1. 手机/WebXR 或遥操作端采集示范；
2. 同步记录相机、底盘、机械臂和夹爪状态；
3. 转换数据为训练框架使用的 HDF5/Robomimic 格式；
4. 训练 Diffusion Policy；
5. 通过 ZMQ policy server 提供动作序列；
6. PolicyWrapper 做动作缓存和推理延迟补偿；
7. 底盘与机械臂控制器执行速度/关节命令。

## 2. 全向底盘运动学

全向底盘由多个转向/驱动轮组成。轮端约束可抽象为：

$$
A(q)\dot q=B(q)\xi_b,\qquad
\xi_b=[v_x,v_y,\omega]^T.
$$

在底盘局部坐标系求解后，再用旋转矩阵变换到全局坐标系：

$$
v^W=R(\theta)v^B.
$$

README 中给出轮关节速度与底盘 twist 的映射以及伪逆求解。该映射依赖轮距、轮半径、转向关节角、安装几何和轮子滚动方向；改变 URDF 或轮组配置时必须重新核对运动学矩阵，不能只调整速度比例。

## 3. 机械臂 IK：阻尼最小二乘与零空间

目标末端位姿误差由位置误差和旋转误差组成：

$$
e=\begin{bmatrix}p_d-p\\e_R\end{bmatrix},\qquad
\dot x=J(q)\dot q.
$$

阻尼最小二乘解：

$$
\dot q=J^T(JJ^T+\lambda^2I)^{-1}e.
$$

阻尼项 $\lambda$ 在接近奇异位形时限制关节速度放大。代码还加入零空间项：

$$
\dot q=J^\#e+(I-J^\#J)\dot q_0.
$$

其中 $\dot q_0$ 可用于回到参考关节位形、远离关节限位或优化次级目标。零空间项在理想模型下不改变主任务末端速度，但数值伪逆、阻尼和限幅会产生残余耦合，必须通过实际 FK 误差验证。

源码：[ik_solver.py](https://github.com/Robot-Nav/manipulation_wheel/blob/main/ik_solver.py)。

## 4. 关节柔顺控制与在线轨迹生成

arm_controller 将期望关节状态、当前关节状态和动力学项组合成关节力矩命令。实现包含低通滤波、重力项、摩擦/名义电机模型补偿以及 Ruckig 在线轨迹生成。策略目标不是直接绕过底层控制器给电机力矩，而是产生上层位置/姿态命令，由实时控制层平滑执行。

关节柔顺控制的一般形式为：

$$
\tau=K_p(q_d-q)+K_d(\dot q_d-\dot q)+g(q)+\tau_{ff}.
$$

这里的公式是控制结构说明，具体实现系数和补偿项以代码为准。命令流中断时控制器会保持当前姿态，不能把“保持姿态”理解为独立的碰撞安全机制。

## 5. Diffusion Policy

Diffusion Policy 将动作序列生成视为条件去噪过程。给定观测历史 $o_{t-H_o:t}$，对真实动作序列 $a^0$ 加噪得到 $a^k$，网络预测噪声：

$$
L_{\rm denoise}=\mathbb E_{k,a^0,\epsilon}
\left[\|\epsilon-\epsilon_\theta(a^k,k,o)\|^2\right].
$$

推理时从噪声动作序列逐步去噪，得到一段未来动作，而不是每帧独立输出一个动作。仓库使用 2 步观测历史、8 步动作块；README 中动作向量包含底盘位置/姿态、机械臂目标与夹爪量，示例动作编码为 13 维。

动作块预测能提高动作连续性并降低频繁推理需求，但也引入策略延迟和动作过期问题。

## 6. 异步推理与延迟补偿

policy_server 配置控制周期 100 ms、推理与通信延迟预算 200 ms。PolicyWrapper 在独立线程提前请求下一段动作，并按 latency steps 丢弃已过时动作，避免动作队列耗尽时机器人突然停顿。该机制依赖真实延迟统计；如果推理时间尾部超过预算，仍可能出现队列空洞。

建议记录端到端延迟 p50/p95/p99、队列长度、丢弃动作数、观测时间戳和动作实际执行时间，不能只报告 GPU 单次 forward 时间。

## 7. 训练与实验建议

建议分别评估底盘单独移动、机械臂固定底盘操作、底盘与机械臂同时运动的协调任务。指标包括 TCP 位置/姿态误差、底盘轨迹误差、接触稳定性、任务成功率、碰撞率、动作平滑度和推理延迟。

关键消融：无底盘动作 vs 联合动作；DLS vs DLS+零空间；单步 BC vs Diffusion Policy；同步推理 vs 异步缓存；不同 observation horizon/action horizon。示范数据应按完整 episode 划分训练与测试，避免相邻帧泄漏。

## 8. 源码入口

- [README 与系统架构](https://github.com/Robot-Nav/manipulation_wheel/blob/main/README.md)
- [IK 求解器](https://github.com/Robot-Nav/manipulation_wheel/blob/main/ik_solver.py)
- [底盘控制](https://github.com/Robot-Nav/manipulation_wheel/blob/main/base_controller.py)
- [机械臂柔顺控制](https://github.com/Robot-Nav/manipulation_wheel/blob/main/arm_controller.py)
- [Diffusion Policy 推理服务](https://github.com/Robot-Nav/manipulation_wheel/blob/main/policy_server.py)

---

[Robot-Nav 项目分析总索引](../README.md)
