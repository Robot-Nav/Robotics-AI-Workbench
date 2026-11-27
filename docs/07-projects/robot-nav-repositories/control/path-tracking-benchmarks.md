# Path-Tracking-Benchmarks：算法与工程实现

> [源仓库](https://github.com/Robot-Nav/Path-Tracking-Benchmarks) · [源码快照](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/tree/b045041fbced585a631cffd8ffc8f897ea2ed0a2) · 2026-11-26
>
> 本页为核心源码初审与理论说明；未进行编译、仿真或真机复测。公式为实现归纳或明确标注的通用理论。

## 1. 定位与系统
这是路径跟踪控制器对比基准，不是单一算法。仓库含 APF、DWA、PID、LQR、MPC、Graceful PP、RPP 与 open-loop QP/geometric tracking 模块。参考路径 → 各控制器 → 同类底盘运动模型 → 记录误差和耗时。实验公平性依赖统一状态初值、路径、速度/加速度约束、周期、扰动和终止定义。

## 2. 实际 MPC 与理论 MPC 的区别
[mpc_controller.hpp](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/blob/b045041fbced585a631cffd8ffc8f897ea2ed0a2/mpc_controller/include/mpc_controller/mpc_controller.hpp#L72-L156) 在当前速度加速度边界内枚举常值 $(v,\omega)$，对未来 N 步 rollout，选最小代价；不是逐时刻独立控制变量的标准 NMPC/QP。

$$
x_{k+1}=x_k+v\cos\theta_k\Delta t,\quad y_{k+1}=y_k+v\sin\theta_k\Delta t,\quad\theta_{k+1}=\theta_k+\omega\Delta t.
$$

代价含随步数增大的权重 $1+0.3k$、位置误差平方、角误差及速度/角速度正则；最小转弯半径约束检查 $|\omega|\le v/R_{\min}$。若枚举 $K_vK_\omega$ 组合，计算量约 $O(K_vK_\omega N)$。可作为轻量 constant-control shooting baseline，论文中应明确区别。

## 3. LQR
[lqr_controller.hpp](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/blob/b045041fbced585a631cffd8ffc8f897ea2ed0a2/lqr_controller/include/lqr_controller/lqr_controller.hpp#L113-L197) 由前视参考、三点曲率和参考速度构造 $u_r=(v_r,v_r\kappa)$，线性化误差动力学 $e^+=Ae+B\Delta u$。DARE 为

$$
P=Q+A^TPA-A^TPB(R+B^TPB)^{-1}B^TPA.
$$

最优反馈 $\Delta u=-Ke$；源码将符号包含于 K_，实现 u=u_r+K_*e 后限幅。LQR 最优性仅在线性模型、二次代价和相应可稳定条件下成立，饱和后不能直接援引原结论。

## 4. 其他模块与对比
[PID](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/blob/b045041fbced585a631cffd8ffc8f897ea2ed0a2/pid_controller/include/pid_controller/pid_controller.hpp) 属误差反馈，[DWA](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/blob/b045041fbced585a631cffd8ffc8f897ea2ed0a2/dwa_controller/include/dwa_controller/dwa_controller.hpp) 属速度窗口搜索，[APF](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/blob/b045041fbced585a631cffd8ffc8f897ea2ed0a2/apf_controller/include/apf_controller/apf_controller.hpp) 属势场控制，[RPP](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/blob/b045041fbced585a631cffd8ffc8f897ea2ed0a2/rpp_controller/include/rpp_controller/rpp_controller.hpp) 和 [Graceful](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/blob/b045041fbced585a631cffd8ffc8f897ea2ed0a2/pp_controller/include/pp_controller/graceful_controller.hpp) 属几何控制；本次对这五个文件只核对路径与类别，具体公式及参数仍需逐实现复核。[global open-loop QP](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/blob/b045041fbced585a631cffd8ffc8f897ea2ed0a2/open_loop_qp_controller/scripts/global_open_loop_qp_controller.py) 与 [geometric tracking](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/blob/b045041fbced585a631cffd8ffc8f897ea2ed0a2/open_loop_qp_controller/scripts/geometric_tracking_controller.py) 是另两个入口，不能默认前者每步闭环重新求解。

## 5. 评价方法与复现
建议统一路径投影 $s^*=\arg\min_s||p-r(s)||$，位置 RMSE $=\sqrt{N^{-1}\sum||p-r(s^*)||^2}$，航向误差用 wrap，控制平滑度用 $\sum||u_k-u_{k-1}||^2$，终点误差单独报告；跟踪时间和完成率需防止提前失败导致低 RMSE。给出控制周期、各控制器 YAML、随机种子、轨迹采样间隔和 CPU 耗时 p50/p95。项目原有 [分析文档](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/blob/b045041fbced585a631cffd8ffc8f897ea2ed0a2/docs/project-analysis.zh-CN.md) 与 [benchmark 说明](https://github.com/Robot-Nav/Path-Tracking-Benchmarks/blob/b045041fbced585a631cffd8ffc8f897ea2ed0a2/controller_benchmark/README.md) 提供入口。本次未执行 benchmark，未确认任何排名或实测数值。

## 关联知识
[路径规划](../../../04-robotics-core/planning.md) · [运动控制](../../../04-robotics-core/motion-control.md) · [专题总览](../README.md)
