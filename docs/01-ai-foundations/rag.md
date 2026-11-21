# RAG 与知识检索

RAG（Retrieval-Augmented Generation）通过先检索外部知识，再将检索结果作为上下文交给模型生成答案。

## 典型流程

1. 文档解析与清洗。
2. 按语义或结构切分 Chunk。
3. 计算 Embedding 并建立索引。
4. 根据用户问题检索相关片段。
5. 可选执行 Hybrid Search 与 Rerank。
6. 将证据片段交给模型生成带引用的回答。

## 评估维度

- Retrieval Recall：相关证据是否被召回。
- Precision：召回内容是否相关。
- Faithfulness：回答是否忠实于证据。
- Citation Accuracy：引用是否真正支持结论。

机器人代码库场景可将 README、接口说明、配置、日志和故障记录作为检索源。
