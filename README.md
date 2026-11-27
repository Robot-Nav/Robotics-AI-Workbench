# Robotics AI Workbench

> **面向 AI 与机器人研发的长期学习、工程实践和知识沉淀工作台。**  
> 从理解原理，到使用 AI Agent 辅助研发，再到机器人系统实现与验证，把零散的学习过程沉淀为可检索、可复用、可持续迭代的工程资产。

<p align="center">
  <a href="https://robot-nav.github.io/Robotics-AI-Workbench/">在线知识库</a>
  ·
  <a href="https://github.com/Robot-Nav/Robotics-AI-Workbench/tree/main/docs">浏览文档源码</a>
  ·
  <a href="https://github.com/Robot-Nav/Robotics-AI-Workbench/issues">问题与讨论</a>
</p>

## 项目定位

Robotics AI Workbench 不只是一个 Markdown 笔记仓库，而是一个围绕 **AI Engineering、Agent Engineering、Physical AI 和 Robotics** 建立的个人研发工作台。

这里持续记录：

- AI 技术：LLM、模型推理、RAG、模型评估与部署。
- Agent 工程：Agent 工作流、Context Engineering、MCP、工具调用和多 Agent 协作。
- Physical AI：VLA、World Model、Diffusion Policy、模仿学习与强化学习。
- 机器人技术：感知、SLAM、路径规划、运动控制、机械臂与移动操作。
- AI 驱动研发：利用 AI 辅助阅读代码、设计架构、开发功能、调试问题和执行测试。
- 工程实践：项目实现、仿真实验、部署记录、性能分析和问题复盘。

## 技术知识体系

| 模块 | 主要内容 |
|---|---|
| AI Foundations | LLM、Transformer、推理优化、RAG、模型评估 |
| Agent Engineering | Agent、Context Engineering、MCP、工具调用、多 Agent 编排 |
| Physical AI | VLA、World Model、Diffusion Policy、Robot Learning |
| Robotics Core | 感知融合、SLAM、规划、MPC / MPPI / WBC、机械臂控制、ROS 2 |
| AI-driven R&D | AI 辅助编码、代码理解、自动测试、实验分析与研发工作流 |
| Simulation & Deployment | Isaac Sim、Isaac Lab、MuJoCo、Gazebo、Sim2Real、嵌入式部署 |
| Projects | 从需求分析、系统设计到代码实现和实验验证的完整项目 |
| Problems & Solutions | 开发环境、算法实现、仿真、部署和硬件问题的排查记录 |
| Research & Journal | 论文解读、技术资料、学习日志和阶段复盘 |

## 研发闭环

`Research → Understand → Design → Build → Test → Analyze → Document`

1. **Research**：检索论文、官方文档、开源项目和技术资料。
2. **Understand**：理解算法原理、适用条件和工程约束。
3. **Design**：明确需求、模块接口、技术路线和验收指标。
4. **Build**：实现代码，使用 AI Agent 辅助开发和重构。
5. **Test**：执行编译、单元测试、仿真和必要的实机验证。
6. **Analyze**：分析日志、性能指标、失败案例和系统瓶颈。
7. **Document**：沉淀技术笔记、实验结果和可复用的问题解决方案。

## 在线知识库

**[打开 Robotics AI Workbench](https://robot-nav.github.io/Robotics-AI-Workbench/)**

网站基于 Docsify 和 GitHub Pages 构建，支持目录导航、全文搜索、公式显示和代码复制。日常内容以 Markdown 维护，无需本地构建网站。

### 工具箱

- **[Offer 沟通助手](https://robot-nav.github.io/Robotics-AI-Workbench/tools/offer-assistant/)**：校招 Offer 沟通问题清单、公司档案管理与答复备注。

## 快速编辑

- **修改已有文章：** 在网站文章底部点击“在 GitHub 上编辑此页”，或直接在仓库的 `docs/` 目录中编辑对应 Markdown 文件。
- **新增文章：** 在对应主题目录创建 Markdown 文件，并在 `docs/_sidebar.md` 中增加导航链接。
- **记录问题：** 复制 `docs/templates/problem.md`，填写复现环境、排查过程、根因、解决方案和验证结果，再更新问题索引。
- **记录实验：** 复制 `docs/templates/experiment.md`，记录代码版本、实验配置、评价指标和实际结果。

## 仓库结构

```text
Robotics-AI-Workbench/
├── README.md
└── docs/
    ├── index.html
    ├── _sidebar.md
    ├── _navbar.md
    ├── 00-start-here/
    ├── 01-ai-foundations/
    ├── 02-agent-engineering/
    ├── 03-physical-ai/
    ├── 04-robotics-core/
    ├── 05-ai-driven-rd/
    ├── 06-simulation-validation/
    ├── 07-projects/
    ├── 08-problems-and-solutions/
    ├── 09-research/
    ├── 10-journal/
    └── templates/
```

## 问题与解决方案

问题记录是本仓库的重要组成部分。每条记录尽量包含：

- 问题现象、预期行为和完整报错。
- 操作系统、硬件、软件版本及关键配置。
- 最小复现步骤和排查过程。
- 已确认根因与尚未验证的假设。
- 解决方法、验证结果和预防措施。

已整理的第一条记录：

- [PS-0001：Codex 登录失败 `token_exchange_failed`](docs/08-problems-and-solutions/ai-agent-llm/codex-login-token-exchange-failed.md)

## 内容与验证原则

- 区分“了解原理”“完成实现”“仿真验证”和“真机验证”，不将计划写成成果。
- 重要结论尽量附论文、官方文档、源码或实验依据。
- 实验数据必须来自实际运行，不编造指标或结果。
- 记录关键依赖、配置、代码 Commit 和复现步骤。
- 优先沉淀能够解决实际问题、能够复用的工程经验。

## 安全说明

本仓库为公开仓库，网站内容也可被公开访问。提交前请检查文档、日志、截图和配置文件，避免包含密码、API Key、Access Token、Cookie、代理订阅链接、个人隐私以及企业内部或保密资料。

---

**Keep learning. Keep building. Keep verifying.**
