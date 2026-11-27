# IL-dual-arm：HDR-IL 双臂协同清洁模仿学习

> 源仓库：[Robot-Nav/IL-dual-arm](https://github.com/Robot-Nav/IL-dual-arm) · 默认分支：main  
> 主要依据：README.md、HDRIL_Models.py、TrainDynamicModels.py、TrainPlanningModel.py 和 Simulation Code。本文描述的是分层模仿学习与轨迹生成，不是 PPO 强化学习。

## 1. 任务与总体结构

项目使用 PyBullet 中的 Baxter 双臂机器人研究擦桌面和擦玻璃任务。双臂需要在不同表面方向上维持接触，并按阶段执行接近、按压、擦拭、换行/换位、抬起和收回等动作。

HDR-IL 将复杂操作分成两层：
- 高层 Planning Model：根据当前观测序列预测下一步动作原语类别；
- 低层 Dynamic Models：针对选定原语生成连续轨迹。

这种层级分解将“做哪个动作”与“该动作具体如何运动”分开学习，避免单个网络同时承担离散任务规划和高维连续轨迹生成。

## 2. 状态图与 GAT 空间交互

README 将双臂末端与目标物体状态组织为 21 维特征，包含左右末端位置/姿态和目标物体位置/姿态。模型将状态特征组织成图节点，通过全连接图表达不同特征节点间的交互。

单头 GAT 的核心为：

$$
z_i=Wh_i,\qquad
e_{ij}=\operatorname{LeakyReLU}(a^T[z_i\Vert z_j]),
$$

$$
\alpha_{ij}=\operatorname{softmax}_j(e_{ij}),\qquad

h_i'=\sum_{j\in\mathcal N(i)}\alpha_{ij}z_j.
$$

多头注意力并行提取不同关系，再拼接或聚合。对双臂任务而言，图结构的意义是允许网络根据当前状态动态调整左右臂、目标物体和清洁表面相关特征的重要性。

## 3. 低层 GAT-GRU-VAE 轨迹生成

每个动作原语对应一个动态 VAE。编码器先用 GAT 提取空间交互特征，再用 GRU 建模轨迹时间依赖，输出潜在分布参数：

$$
q_\phi(z|x_{1:T})=\mathcal N(\mu_\phi,\operatorname{diag}(\sigma_\phi^2)).
$$

重参数化采样：

$$
z=\mu+\sigma\odot\epsilon,\qquad\epsilon\sim\mathcal N(0,I).
$$

解码器使用 GRU 自回归生成未来轨迹：

$$
\hat x_t=f_\psi(z,\hat x_{t-1}).
$$

训练损失由轨迹重构误差和 KL 正则组成：

$$
L_{\rm VAE}=L_{\rm recon}+\beta D_{KL}(q_\phi(z|x)\Vert p(z)).
$$

部分模型还融合桌面位姿特征，帮助轨迹生成根据不同表面位置与姿态调整运动。由于是自回归解码，长时域误差可能逐步累积，需要检查完整轨迹而不只看单步重构损失。

## 4. 高层 PlanningGAT 与 PlanningDecoder

规划模型使用 GAT 编码观测序列，得到全局隐状态，再由 PlanningDecoder 预测动作原语标签。该任务本质上是序列条件分类：

$$
L_{\rm plan}=-\sum_c y_c\log\hat y_c.
$$

TrainPlanningModel.py 使用交叉熵训练规划模型。规划模型输出离散原语序列，动态模型再生成每个原语对应的连续动作轨迹。训练代码中的动态模型构造了六个 GAT 编码器与六个 GRU 解码器；任务脚本中的细分动作阶段数量与模型类别索引不是同一概念，阅读数据标签和原语映射时应保持区分。

## 5. 可微 DTW 时序对齐

不同示范轨迹的执行速度和持续时间可能不同，直接逐帧 MSE 会惩罚时间错位。项目使用 smooth-min 近似动态时间规整递推中的 hard min，使时间对齐损失可以参与梯度训练：

$$
D(i,j)=d(x_i,y_j)+\operatorname{softmin}_\rho
\{D(i-1,j),D(i,j-1),D(i-1,j-1)\}.
$$

当 $\rho$ 增大时，softmin 趋近 hard minimum。该方法允许轨迹在时间轴上局部伸缩，但并不保证物理接触力或任务语义正确。

## 6. 仿真与接触工程

项目使用 PyBullet Baxter 场景，控制侧通过 IK 与关节位置控制执行轨迹。清洁末端碰撞体被改为扁平垫状几何，海绵通过固定约束附着；桌面任务设置最低高度约束，防止末端穿透表面。玻璃任务则改变擦拭方向与接触几何。

这些工程约束很重要：纯轨迹重构损失可能生成穿透表面或双臂互相干涉的动作，必须同时验证碰撞、接触与末端轨迹。

## 7. 实验与改进方向

建议比较：
- GAT-GRU-VAE vs MLP-GRU-VAE；
- 有无目标位姿融合；
- MSE vs smooth-DTW；
- 分层规划+动态模型 vs 单一端到端轨迹模型；
- 固定动作原语库 vs 扩充原语类别。

指标包括原语分类准确率、轨迹位置/姿态误差、DTW 距离、双臂碰撞率、表面覆盖率、接触连续性、清洁任务成功率和推理时间。训练/测试应按完整示范轨迹划分，不可将同一轨迹相邻时间片随机分散到训练和测试。

## 8. 源码入口

- [README 与系统原理](https://github.com/Robot-Nav/IL-dual-arm/blob/main/README.md)
- [GAT / GRU / VAE / Planning 模型](https://github.com/Robot-Nav/IL-dual-arm/blob/main/Table_Lift_HDR-IL/Models/HDRIL_Models.py)
- [动态模型训练](https://github.com/Robot-Nav/IL-dual-arm/blob/main/Table_Lift_HDR-IL/TrainDynamicModels.py)
- [规划模型训练](https://github.com/Robot-Nav/IL-dual-arm/blob/main/Table_Lift_HDR-IL/TrainPlanningModel.py)
- [PyBullet 任务与动作原语](https://github.com/Robot-Nav/IL-dual-arm/tree/main/Simulation%20Code)

---

[Robot-Nav 项目分析总索引](../README.md)
