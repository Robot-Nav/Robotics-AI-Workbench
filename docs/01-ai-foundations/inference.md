# 模型推理与部署

## 关键指标

| 指标 | 含义 |
|---|---|
| TTFT | 首 Token 延迟 |
| TPOT | 每个输出 Token 的平均生成时间 |
| Throughput | 单位时间处理的请求数或 Token 数 |
| Memory | 权重、KV Cache 和运行时显存占用 |
| Concurrency | 并发请求数量 |

## 常见优化

- 权重量化：FP16、BF16、INT8、INT4。
- KV Cache：减少自回归生成中的重复计算。
- Batching：提高 GPU 利用率，但需要权衡排队延迟。
- Speculative Decoding：通过草稿模型辅助生成。
- TensorRT / ONNX Runtime：面向部署平台优化计算图。

## 机器人部署约束

评估端侧算力、内存、功耗、实时性、网络依赖和异常降级。策略推理与安全控制应分层设计。
