# Robotics AI Workbench

**Robot-Nav 的机器人与人工智能技术知识库、工程实践与问题解决工作台。**

本仓库使用 **Docsify + GitHub Pages** 将 Markdown 文档直接呈现为可搜索的网站。日常维护只需在 GitHub 网页端编辑 Markdown，提交后网站自动更新。

## 在线网站

完成一次 Pages 设置后访问：

https://robot-nav.github.io/Robotics-AI-Workbench/

## 启用网站（首次只需设置一次）

1. 打开本仓库的 Settings。
2. 进入 Pages。
3. 在 Build and deployment 中选择 Deploy from a branch。
4. Branch 选择 main，目录选择 /docs。
5. 点击 Save，等待 GitHub Pages 发布。

## 快速编辑

- 打开网站中的任意文章，点击页面底部的“在 GitHub 上编辑此页”。
- 或者进入仓库的 docs/ 目录，打开 Markdown 文件并点击铅笔图标。
- 新增文章后，在 docs/_sidebar.md 中添加对应链接。
- 提交后等待 Pages 更新即可，不需要本地构建。

## 仓库结构

- docs/：网站全部内容，日常主要编辑这里。
- docs/index.html：Docsify 配置、搜索、公式渲染和在线编辑入口。
- docs/_sidebar.md：左侧导航。
- docs/08-problems-and-solutions/：问题与解决方案知识库。
- docs/templates/：技术笔记、问题、实验记录模板。

## 已有问题记录

仓库根目录原有的“解决方法 | Codex 登录失败 token_exchange_failed.md”保持原样。本次将其内容同步到网站的问题知识库页面，便于通过网站导航和搜索查阅；原始文件不会被删除或覆盖。

## 内容规范

- 区分待研究、已学习、已实现、仿真验证和真机验证。
- 问题记录应包含环境、现象、复现步骤、根因、修复和验证结果。
- GitHub Pages 是公开网站。不要提交密码、Token、代理订阅链接、企业内部资料或保密文档。
