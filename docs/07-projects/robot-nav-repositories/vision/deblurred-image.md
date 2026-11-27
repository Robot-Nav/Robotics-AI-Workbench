# Deblurred_Image：传统去卷积、DeblurGAN-v2 与 RT-Focuser

> 源仓库：[Robot-Nav/Deblurred_Image](https://github.com/Robot-Nav/Deblurred_Image) · 默认分支：main  
> 主要依据：README.md、DeblurGANv2 模型/损失代码、RT-Focuser 技术文档、PyTorch/ONNX 推理脚本。该仓库是图像去模糊算法集合，不是单一网络。

## 1. 图像模糊模型

图像去模糊通常从退化模型出发：

$$
y=k*x+n,
$$

其中 $x$ 为清晰图像，$k$ 为模糊核，$y$ 为观测模糊图像，$n$ 为噪声。运动模糊的核由曝光期间相机/物体运动轨迹决定；空间变化模糊可能需要更复杂的非均匀退化模型。

仓库分为传统方法和深度学习方法：传统方法依赖显式 PSF/噪声假设，深度网络从数据中学习图像先验和逆映射。

## 2. 传统方法

### 2.1 Richardson–Lucy 迭代去卷积

在泊松噪声模型下，RL 通过迭代最大化似然估计：

$$
x^{(k+1)}=x^{(k)}\odot
\left[k^\star * \frac{y}{k*x^{(k)}+\epsilon}\right].
$$

其中 $k^\star$ 是模糊核的翻转形式。RL 不需要显式求解大规模线性系统，但迭代过多会放大噪声和振铃。效果高度依赖 PSF 是否接近真实模糊过程。

### 2.2 Wiener Filter

维纳滤波在频域中结合退化核与噪声功率谱：

$$
\hat X(u,v)=
\frac{K^*(u,v)}{|K(u,v)|^2+K_n(u,v)/K_x(u,v)}Y(u,v).
$$

它在反卷积和噪声抑制之间折中。噪声参数 $K$ 或功率谱估计错误时，会出现过度平滑或残留模糊。

### 2.3 盲去卷积

盲去卷积同时估计清晰图像和未知模糊核：

$$
\min_{x,k}\|k*x-y\|^2+\lambda_x\Phi(x)+\lambda_k\Psi(k).
$$

这是非凸问题，需要对图像梯度、稀疏性或模糊核施加先验。仓库中传统方法脚本适合用于已知/近似 PSF 场景与算法原理对照。

## 3. DeblurGAN-v2

DeblurGAN-v2 将去模糊建模为条件生成任务。生成器使用 FPN 进行多尺度特征提取和融合，判别器采用局部 Patch 与全局图像尺度的双判别结构。FPN 自顶向下融合高层语义与低层细节，帮助同时恢复大尺度运动拖影和局部纹理。

生成器训练损失通常由对抗项与内容项组成：

$$
L_G=L_{\rm adv}+\lambda_cL_{\rm content}.
$$

仓库实现支持感知损失：使用预训练 VGG 特征比较生成图像与清晰图像的高层特征，并结合像素 MSE/L1。判别器代码支持 WGAN-GP、LSGAN、GAN、RaGAN 等形式；具体实验必须以配置文件中的 disc_loss 为准。

双尺度判别器分别关注局部纹理真实度和全局结构一致性。轻量骨干如 MobileNet-V2 可降低计算量，但精度、纹理恢复和速度之间仍需通过目标数据集验证。

## 4. RT-Focuser：边缘侧轻量去模糊

RT-Focuser 的设计重点是轻量与多尺度特征融合。仓库模型包含以下模块：

- LD Block：轻量级去模糊特征块，使用深度可分离卷积、倒置瓶颈和残差结构；
- SN Module：可学习锐化卷积核并结合归一化，显式强化边缘/高频特征；
- MLIA：Multi-Level Integrated Aggregation，将不同编码层级的特征统一通道数、对齐空间分辨率、拼接融合，再用 SE 通道注意力自适应重标定；
- X-Fuse：融合上采样的深层解码特征、多尺度聚合特征和原始输入图像；
- Decoder：逐级上采样并输出清晰图像残差。

MLIA 的抽象形式：

$$
F_{MLIA}=SE\left(Conv_{3\times3}
\left[Proj(F_1)\Vert\cdots\Vert Proj(F_n)\right]\right).
$$

它与普通 U-Net 逐层 skip connection 的区别在于：多个编码层级可以同时参与一个解码尺度的特征融合。模型还提供 SPPF 变体，以不同池化感受野增加上下文信息。

## 5. ONNX 与边缘部署

仓库提供 PyTorch、ONNX Runtime 推理脚本，并包含 PTQ/量化导出工具。部署前需要确认：
- 输入颜色顺序、归一化区间、尺寸缩放与训练一致；
- ONNX 输入/输出 tensor 名称、shape 和动态维度；
- 权重/激活精度配置与硬件算子支持；
- resize、padding、裁剪与输出反归一化一致；
- CPU/GPU/NPU 推理时间和内存峰值。

INT8 权重量化不代表所有激活也为 INT8；需要检查具体量化配置和 ONNX 图中的节点精度。量化后应同时比较 PSNR、SSIM、视觉伪影和端到端延迟。

## 6. 评价指标与实验设计

常用图像恢复指标：
- PSNR：像素均方误差的对数度量；
- SSIM：局部亮度、对比度和结构相似度；
- LPIPS：深度特征感知距离；
- Latency / FPS：真实目标设备上的端到端推理性能；
- GMACs / Params：模型计算量和参数规模。

建议在 GoPro 等运动模糊数据集上比较传统 RL/Wiener、DeblurGAN-v2、RT-Focuser，并额外加入真实相机运动模糊数据。对机器人视觉应用，还应测量去模糊前后检测/跟踪精度、角点定位误差和 SLAM 前端跟踪成功率。图像看起来更锐利不代表几何特征更准确。

## 7. 源码入口

- [仓库总 README](https://github.com/Robot-Nav/Deblurred_Image/blob/main/README.md)
- [RT-Focuser 中文说明](https://github.com/Robot-Nav/Deblurred_Image/tree/main/深度学习/RT-Focuser-main)
- [RT-Focuser 模型](https://github.com/Robot-Nav/Deblurred_Image/blob/main/深度学习/RT-Focuser-main/model/rt_focuser_model.py)
- [RT-Focuser 技术文档](https://github.com/Robot-Nav/Deblurred_Image/blob/main/深度学习/RT-Focuser-main/RT文档.md)
- [DeblurGAN-v2 模型与损失](https://github.com/Robot-Nav/Deblurred_Image/tree/main/深度学习/DeblurGANv2)

---

[Robot-Nav 项目分析总索引](../README.md)
