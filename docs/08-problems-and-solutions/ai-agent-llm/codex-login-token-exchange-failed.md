# PS-0001 · Codex 登录失败：token_exchange_failed

> 本页面是该问题的唯一维护版本，原始记录内容已完整迁移至此，后续请直接在本页面更新。

在 Linux 上使用 Codex CLI、VS Code 的 Codex 插件或 Codex 客户端时，有时会在浏览器完成 ChatGPT 登录后出现以下错误：

```text
Sign-in could not be completed
Token exchange failed: error sending request for url
(https://auth.openai.com/oauth/token)

Error code: token_exchange_failed
```

有时还会进一步出现：

```text
403 Forbidden
Country, region, or territory not supported
```

这类问题通常不是账号密码错误，而是 **Codex 在 OAuth 登录最后的 Token Exchange 阶段没有走到正确的网络出口**。尤其是在使用 Clash Verge、Mihomo、V2Ray、Sing-box 等代理工具时，CLI、VS Code、桌面客户端可能读取到不同的代理配置。

![](https://i-blog.csdnimg.cn/direct/09fb1abe3813411d9fb0b0758290a576.png)


**图 1  Codex 登录时出现 `token_exchange_failed`。**

---

## 一、Codex CLI 可以登录，但 VS Code Codex 插件或客户端无法登录

这种情况说明 **Codex CLI 本身以及账号认证大概率没有问题**，重点应该检查 VS Code 或桌面客户端的代理环境。

最常见的情况是：

```text
Codex CLI
    ↓
读取终端中的代理环境变量
    ↓
代理出口正常
    ↓
登录成功

VS Code / Codex Desktop
    ↓
没有读取相同的代理配置
    ↓
直连或走了其他代理出口
    ↓
OAuth Token Exchange 失败
```

### 1、先比较普通终端和 VS Code 终端的网络出口

在普通 Linux 终端执行：

```bash
curl https://ipinfo.io
```

然后在 VS Code 内置终端中同样执行：

```bash
curl https://ipinfo.io
```

重点比较：

```text
ip
country
region
```

如果两边的公网 IP 或地区不同，就说明 VS Code 和普通终端没有走同一个网络出口。

继续分别执行：

```bash
env | grep -i proxy
```

重点检查以下变量是否一致：

```text
HTTP_PROXY
HTTPS_PROXY
ALL_PROXY
NO_PROXY
http_proxy
https_proxy
all_proxy
no_proxy
```

---

### 2、刷新 Codex CLI 登录状态和版本

依次执行：

```bash
codex logout
```

更新 Codex：

```bash
npm install -g @openai/codex@latest
```

然后重新启动：

```bash
codex
```

选择：

```text
Sign in with ChatGPT
```

浏览器完成登录后，确认 Codex CLI 可以正常使用。

---

### 3、从已经配置好代理的终端启动 VS Code

如果 CLI 可以正常登录，但 VS Code 插件仍然失败，先完全退出所有 VS Code 窗口，然后从当前终端启动：

```bash
code .
```

这样启动的 VS Code 更容易继承当前 Shell 中的代理环境变量。

进入 VS Code 后，再打开 Codex 插件并选择：

```text
Sign in with ChatGPT
```

如果这样能够正常登录，基本可以确定问题就是：

```text
桌面图标启动的 VS Code
没有继承终端代理环境
```

---

### 4、仍然失败时检查 VS Code Codex 扩展

如果代理出口已经一致，但登录仍然失败，可以继续处理以下几项：

```text
1. 在 Codex 插件中退出当前账号；
2. 完全关闭 VS Code；
3. 更新 Codex 扩展到最新版本；
4. 必要时卸载后重新安装 Codex 扩展；
5. 再次执行 Sign in with ChatGPT。
```

如果之前曾经多次登录失败，也可能是扩展保留了旧的 OAuth 状态，重新安装或彻底退出 VS Code 后重新登录通常更干净。

---

## 二、Codex CLI、VS Code 插件和 Codex 客户端都无法登录

如果 CLI 本身也无法完成登录，则重点检查 Linux 的系统代理环境变量。

下面以 Clash Verge 为例。

打开 Clash Verge：

```text
设置 → Clash 设置 → 端口设置
```

记录当前代理端口。

例如下图中的端口为：

```text
7897
```

![](https://i-blog.csdnimg.cn/direct/647c48538d6b46e1ae42be89eee2c89c.png)


**图 2  Clash Verge 中查看当前代理端口，本例为 `7897`。**

> 注意：你的端口不一定是 `7897`。请以自己 Clash Verge 中实际显示的端口为准。

---

## 三、临时配置 Linux 代理环境变量

如果 Clash Verge 使用的是 Mixed Port，例如：

```text
7897
```

可以先在终端临时设置：

```bash
export HTTP_PROXY="http://127.0.0.1:7897"
export HTTPS_PROXY="http://127.0.0.1:7897"
export ALL_PROXY="socks5://127.0.0.1:7897"
export NO_PROXY="localhost,127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8"
```

为了兼容部分只读取小写变量的程序，也可以同时设置：

```bash
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export all_proxy="$ALL_PROXY"
export no_proxy="$NO_PROXY"
```

检查是否生效：

```bash
env | grep -i proxy
```

然后测试网络出口：

```bash
curl https://ipinfo.io
```

确认网络出口正常后，再执行：

```bash
codex logout
codex
```

然后选择：

```text
Sign in with ChatGPT
```

> 上述 `export` 只对当前终端会话有效，关闭终端后会失效。

---

## 四、Bash 永久配置

如果使用 Bash，可以编辑：

```bash
nano ~/.bashrc
```

在文件末尾加入：

```bash
# Codex / VS Code Proxy
export HTTP_PROXY="http://127.0.0.1:7897"
export HTTPS_PROXY="http://127.0.0.1:7897"
export ALL_PROXY="socks5://127.0.0.1:7897"

# Local addresses bypass proxy
export NO_PROXY="localhost,127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8"

# Lowercase variables for compatibility
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export all_proxy="$ALL_PROXY"
export no_proxy="$NO_PROXY"
```

保存后执行：

```bash
source ~/.bashrc
```

检查：

```bash
env | grep -i proxy
```

---

## 五、Zsh 永久配置

如果使用 Zsh，则编辑：

```bash
nano ~/.zshrc
```

加入：

```bash
# Codex / VS Code Proxy
export HTTP_PROXY="http://127.0.0.1:7897"
export HTTPS_PROXY="http://127.0.0.1:7897"
export ALL_PROXY="socks5://127.0.0.1:7897"
export NO_PROXY="localhost,127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8"

export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export all_proxy="$ALL_PROXY"
export no_proxy="$NO_PROXY"
```

然后执行：

```bash
source ~/.zshrc
```

---

## 六、让桌面启动的 VS Code / Codex 客户端也读取代理

这里是 Linux 下非常容易忽略的一点：

```text
~/.bashrc
```

主要针对交互式 Bash Shell。

如果你直接从桌面图标启动 VS Code 或 Codex 客户端，它们不一定会读取 `~/.bashrc`。

因此有两种处理方法。

### 方法 A：直接从终端启动 VS Code

这是最简单的验证方法：

```bash
source ~/.bashrc
code .
```

然后在这个 VS Code 中重新登录 Codex。

### 方法 B：把代理变量同时加入 ~/.profile

编辑：

```bash
nano ~/.profile
```

加入：

```bash
export HTTP_PROXY="http://127.0.0.1:7897"
export HTTPS_PROXY="http://127.0.0.1:7897"
export ALL_PROXY="socks5://127.0.0.1:7897"
export NO_PROXY="localhost,127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8"

export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export all_proxy="$ALL_PROXY"
export no_proxy="$NO_PROXY"
```

修改完成后，建议 **注销当前 Linux 桌面会话并重新登录**。

如果不确定桌面环境是否已经重新加载变量，最直接的方法就是重启：

```bash
sudo reboot
```

---

## 七、重新登录 Codex

系统重新登录或重启之后，可以先确认代理变量：

```bash
env | grep -i proxy
```

再确认公网出口：

```bash
curl https://ipinfo.io
```

然后执行：

```bash
codex logout
codex
```

选择：

```text
Sign in with ChatGPT
```

对于 VS Code，则建议首次测试时从终端启动：

```bash
code .
```

然后在 Codex 扩展中重新执行登录。

---

## 八、如果使用的不是 7897 端口

`7897` 只是本文截图中的示例端口。

Clash Verge、Mihomo、V2Ray、Sing-box 等工具实际使用的端口可能是：

```text
7890
7891
7897
1080
```

一定要根据自己的代理软件实际配置修改，例如实际端口为 `7890`：

```bash
export HTTP_PROXY="http://127.0.0.1:7890"
export HTTPS_PROXY="http://127.0.0.1:7890"
export ALL_PROXY="socks5://127.0.0.1:7890"
```

不要直接照抄别人的端口。

---

## 九、快速排查命令

如果以后再次遇到 Codex 登录问题，可以优先执行下面几条命令。

### 1、查看 Codex 版本

```bash
codex --version
```

### 2、查看代理环境变量

```bash
env | grep -i proxy
```

### 3、查看当前公网出口

```bash
curl https://ipinfo.io
```

### 4、测试 OpenAI OAuth 域名是否能够建立连接

```bash
curl -I https://auth.openai.com
```

### 5、刷新 Codex

```bash
codex logout
npm install -g @openai/codex@latest
codex
```

### 6、从当前终端启动 VS Code

```bash
code .
```

---

## 十、问题判断总结

可以按照下面的思路快速判断：

```text
情况 1：CLI 可以登录，VS Code 不可以

优先检查：
VS Code 是否继承终端代理
        ↓
普通终端和 VS Code Terminal 对比 ipinfo
        ↓
对比 env | grep -i proxy
        ↓
从终端执行 code .
        ↓
重新登录 Codex
```

```text
情况 2：CLI、VS Code、客户端都无法登录

优先检查：
Clash Verge 实际代理端口
        ↓
配置 HTTP_PROXY / HTTPS_PROXY / ALL_PROXY
        ↓
配置 NO_PROXY
        ↓
source ~/.bashrc
        ↓
检查 curl https://ipinfo.io
        ↓
重新登录 Codex
```

```text
情况 3：终端启动 VS Code 可以登录，桌面启动不可以

基本可以判断：
桌面应用没有继承 Shell 中的代理环境变量
        ↓
将配置加入 ~/.profile
        ↓
注销桌面会话或重启系统
```

---

## 十一、最终推荐配置

如果使用 Clash Verge，并且当前 Mixed Port 为 `7897`，可以参考下面的配置：

```bash
# Codex / VS Code Proxy
export HTTP_PROXY="http://127.0.0.1:7897"
export HTTPS_PROXY="http://127.0.0.1:7897"
export ALL_PROXY="socks5://127.0.0.1:7897"

# OAuth localhost callback / local network bypass
export NO_PROXY="localhost,127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8"

# Compatibility
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export all_proxy="$ALL_PROXY"
export no_proxy="$NO_PROXY"
```

然后执行：

```bash
source ~/.bashrc
```

检查：

```bash
env | grep -i proxy
curl https://ipinfo.io
```

最后：

```bash
codex logout
codex
```

或者从当前终端启动 VS Code：

```bash
code .
```

再重新执行：

```text
Sign in with ChatGPT
```

如果实际所在国家或地区本身不在 OpenAI 服务支持范围内，则应以 OpenAI 当前官方支持范围为准；本文主要用于解决 **Linux 本机代理配置不一致、VS Code 未继承代理、OAuth Token Exchange 无法正常联网** 等环境问题。
