# Offer 沟通助手

**在线地址：** https://robot-nav.github.io/Robotics-AI-Workbench/tools/offer-assistant/

## 功能

- 按公司建立独立 Offer 档案，记录公司名称、岗位、地点、求职进度、联系人和档案备注。
- 每家公司独立保存问题确认状态、HR 答复备注和沟通转写，不会混在一起。
- 支持新建、切换、编辑和删除公司档案。
- 导出当前公司档案 JSON，或一次性备份全部公司；支持从备份文件导入。
- 按岗位与技术发展、薪酬绩效、试用期与应届生政策、五险一金与落户、福利与工作时间、职业发展与劳动合同六个模块整理 Offer 沟通问题。
- 搜索和筛选问题，复制待确认问题或单个模块的问题。
- 录音工作台单独部署在 Cloudflare Worker，通过 GitHub OAuth 在服务器端验证仓库所有者身份。

## 公司档案使用方式

1. 使用 HTTPS 在线地址打开页面。
2. 在页面顶部点击“新建”，为每家公司建立独立档案；填写公司名称、岗位、地点和沟通进度。
3. 切换公司档案后，对应的确认状态、答复备注和转写文字会自动切换。
4. 定期点击“导出当前档案”或“备份全部档案”，保存 JSON 备份。更换设备或浏览器前，先备份，再在新设备导入。

## 录音访问控制：仅限仓库所有者

公开 GitHub Pages 不适合直接承载需要严格身份认证的私有功能。因此，公开页面不再提供本地密码解锁录音控件；录音工作台独立运行在 Cloudflare Worker，并由 Worker 在服务器端验证 GitHub 身份。

允许访问的账号固定为当前仓库所有者：

- GitHub 登录名：`Robot-Nav`
- GitHub 用户 ID：`186013147`
- 仓库：`Robot-Nav/Robotics-AI-Workbench`

服务器同时核对不可变的 GitHub 数字用户 ID 和登录名，不接受其他账号。会话使用 Worker 端 HMAC 签名的 HttpOnly、Secure、SameSite=Lax Cookie，默认有效期 8 小时；退出登录会清除会话。GitHub OAuth access token 只在 Worker 回调请求中短暂使用，不写入浏览器，也不保存到本地。

### 首次部署步骤

需要一个 Cloudflare 账号，并启用 Workers / workers.dev。当前仓库已提供 Worker 源码和 GitHub Actions 部署工作流。

1. 在 Cloudflare 创建 API Token，至少授予目标账户的 **Workers Scripts: Edit** 权限，并按 Cloudflare 当前界面要求授予账户读取权限。
2. 在 GitHub 仓库 **Settings → Secrets and variables → Actions → New repository secret** 添加：
   - `CLOUDFLARE_API_TOKEN`：Cloudflare API Token
   - `CLOUDFLARE_ACCOUNT_ID`：Cloudflare Account ID
3. 运行 GitHub Actions 中的 **Deploy private Offer recording service** 工作流。首次部署后，在 Cloudflare Worker 页面确认实际的 `workers.dev` 地址。
4. 在 GitHub **Settings → Developer settings → OAuth Apps → New OAuth App** 创建 OAuth App：
   - Application name：`Robot-Nav Offer Recording`
   - Homepage URL：填入实际 Worker 地址
   - Authorization callback URL：`https://实际Worker域名/auth/callback`
   - 授权范围只需要读取公开用户身份（`read:user`）。
5. 将 OAuth App 的 Client ID 和 Client Secret 作为 GitHub Actions 仓库 Secrets 添加：
   - `GITHUB_OAUTH_CLIENT_ID`
   - `GITHUB_OAUTH_CLIENT_SECRET`
6. 生成至少 32 字符的随机会话密钥，例如在本地终端执行 `openssl rand -hex 32`，将结果保存为仓库 Secret：`OFFER_SESSION_SECRET`。不要把密钥发到聊天、提交到仓库或写进前端配置文件。
7. 再次运行 **Deploy private Offer recording service** 工作流，部署 Worker 并写入三个 Worker Secrets。
8. 将实际 Worker 地址写入 `docs/tools/offer-assistant/recording-auth-config.js`：
   `window.OFFER_RECORDING_AUTH_URL = "https://实际Worker域名";`
   提交后等待 GitHub Pages 部署完成。
9. 打开 Offer 助手页面，点击底部“隐藏入口”，使用 GitHub 的 `Robot-Nav` 账号登录测试。使用其他 GitHub 账号应返回 403。

### 仓库 Secrets 清单

| Secret 名称 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 允许 GitHub Actions 部署 Worker |
| `CLOUDFLARE_ACCOUNT_ID` | 指定 Cloudflare 账户 |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth 应用标识 |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth 应用密钥 |
| `OFFER_SESSION_SECRET` | Worker 会话签名密钥 |

以上均应配置为 GitHub Actions Repository Secrets，不要配置成公开变量。

## 录音、转写与隐私说明

- 录音功能必须先通过 Worker 服务端 GitHub 身份验证。公开 GitHub Pages 上的旧录音控件会被移除；隐藏入口只负责跳转到私有 Worker。
- Worker 不接收、不保存录音音频。音频在已验证用户的浏览器本地处理，用户需要手动下载保存。
- 实时转写使用浏览器 Speech Recognition API。不同浏览器支持情况不同，部分实现可能调用浏览器厂商的在线识别服务并需要网络；本工具不承诺离线语音识别。
- 录音前应告知沟通对象并取得同意。
- 普通网页无法保证手机锁屏或切换到后台后持续录音；同一部手机拨打蜂窝电话时，网页麦克风不能直接读取系统通话上下行音频。
- 若手机不支持通话录音，建议手机免提通话并使用另一台设备录音；或使用手机系统自带且合规可用的通话录音功能。
- 公司档案、问题清单和文字记录仍保存在当前浏览器本地。更换设备前请导出 JSON 备份；录音音频需要单独下载。
- 不要在公共设备上保留录音或包含个人信息的档案。

## 安全边界

- 服务器端 OAuth 校验限制的是本项目私有录音工作台的访问权限，不可能阻止其他人自行编写或使用通用录音软件。
- Worker 端不提供音频上传、存储或公开下载接口。
- GitHub 仓库所有者身份以当前仓库元数据中确认的 GitHub 数字 ID `186013147` 为准；如仓库转移到其他所有者，需要同步更新 Worker 的允许账号 ID 和登录名。
- 如果 Cloudflare Worker 未部署或前端认证地址未配置，隐藏入口保持关闭，不回退到本地密码解锁。

## 技术实现

- 公开页面：静态 HTML、CSS、JavaScript，部署在 GitHub Pages。
- 私有录音工作台：Cloudflare Worker。
- 身份认证：GitHub OAuth Web Application Flow，服务端调用 GitHub `/user` 并核对用户 ID 与登录名。
- 会话：HMAC-SHA-256 签名的 HttpOnly / Secure / SameSite Cookie。
- 录音：MediaRecorder；实时转写：浏览器 Speech Recognition API。
