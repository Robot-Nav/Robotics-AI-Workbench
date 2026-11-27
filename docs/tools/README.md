# 工具箱

这里放置可直接使用的轻量工具，和算法原理、项目源码文档分开维护。

## 当前工具

- **[Offer 沟通助手](https://robot-nav.github.io/Robotics-AI-Workbench/tools/offer-assistant/)**：按公司独立管理 Offer 档案，整理沟通问题、记录 HR 答复，并提供仅限仓库所有者 GitHub 账号访问的私有录音工作台。
- [Offer 沟通助手使用说明与认证部署](offer-assistant/README.md)

## 私有录音工作台

录音工作台独立部署在 Cloudflare Worker，通过 GitHub OAuth 在服务器端核验仓库所有者 `Robot-Nav`。公开 GitHub Pages 不直接提供本地密码解锁录音；未完成服务器部署和认证地址配置前，录音入口保持关闭。

工具箱中的公司档案、问题清单和文字记录默认保存在使用者当前浏览器本地。录音音频由浏览器本地处理，需手动下载，不上传至 GitHub 仓库或本项目 Worker。
