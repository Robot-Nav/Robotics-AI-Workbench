const OWNER_LOGIN = "Robot-Nav";
const OWNER_ID = 186013147;
const SESSION_COOKIE = "__Host-offer_session";
const STATE_COOKIE = "__Host-offer_state";
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
function randomToken(bytes = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}
function cookieValue(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}
function setCookie(headers, name, value, options = {}) {
  const parts = [name + "=" + value, "Path=" + (options.path || "/"), "Secure", "HttpOnly", "SameSite=Lax"];
  if (options.maxAge !== undefined) parts.push("Max-Age=" + options.maxAge);
  headers.append("Set-Cookie", parts.join("; "));
}
function clearCookie(headers, name, path = "/") {
  setCookie(headers, name, "", { path, maxAge: 0 });
}
function response(body, status = 200, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "microphone=(self), camera=(), geolocation=(), payment=()");
  return new Response(body, { status, headers });
}
async function importHmacKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function createSession(user, secret) {
  const payload = base64url(encoder.encode(JSON.stringify({
    sub: user.id, login: user.login,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })));
  const key = await importHmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return payload + "." + base64url(signature);
}
async function verifySession(request, secret) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64url(parts[1]), encoder.encode(parts[0]));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(parts[0])));
    if (payload.sub !== OWNER_ID || payload.login !== OWNER_LOGIN) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) { return null; }
}
function configError() {
  return response(
    "<!doctype html><html lang='zh-CN'><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>服务尚未配置</title><body style='font:16px system-ui;padding:32px;max-width:650px;margin:auto'><h2>录音认证服务尚未配置</h2><p>请先在 Cloudflare Worker 中配置 GitHub OAuth Client ID、Client Secret 和 SESSION_SECRET。</p></body></html>",
    503, { "Content-Type": "text/html; charset=utf-8" }
  );
}
function loginPage() {
  return response(
    "<!doctype html><html lang='zh-CN'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='referrer' content='no-referrer'><title>Offer 私有录音入口</title><body style='font:16px system-ui;background:#f4f7fb;color:#17263c;padding:24px;min-height:90vh;display:grid;place-items:center'><main style='width:min(100%,440px);background:white;border:1px solid #e2e8f0;border-radius:18px;padding:28px;box-sizing:border-box;box-shadow:0 16px 45px #10233f14'><div style='font-size:12px;color:#64748b'>ROBOT-NAV · PRIVATE TOOL</div><h1 style='font-size:24px;margin:10px 0'>Offer 录音工作台</h1><p style='line-height:1.7;color:#475569'>此功能仅限 GitHub 仓库所有者 <b>Robot-Nav</b> 使用。请使用仓库所有者的 GitHub 账号登录。</p><a href='/auth/login' style='display:block;text-align:center;padding:13px;background:#17263c;color:white;text-decoration:none;border-radius:10px;font-weight:650'>使用 GitHub 账号验证</a><p style='font-size:12px;color:#94a3b8;margin:16px 0 0'>登录由 GitHub 官方授权流程完成；本服务只验证账号身份，不保存 GitHub 访问令牌。</p></main></body></html>",
    200, { "Content-Type": "text/html; charset=utf-8" }
  );
}
function recordingPage(login, nonce) {
  const page = `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#10233f"><meta name="referrer" content="no-referrer">
<title>Offer 私有录音工作台</title>
<style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17263c;background:#f3f6fb}
*{box-sizing:border-box}body{margin:0;padding:18px 14px 42px}.wrap{max-width:820px;margin:auto}
header,.panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;margin:0 0 14px;box-shadow:0 5px 20px #10233f08}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
h1{font-size:21px;margin:0 0 5px}.muted{color:#64748b;font-size:12px;line-height:1.6}
.auth{font-size:12px;color:#166534;background:#ecfdf3;border-radius:999px;padding:7px 10px}
label{display:block;font-size:13px;color:#475569;margin:0 0 7px}
input,textarea{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:11px;font:inherit;background:#fff;color:#17263c}
textarea{min-height:210px;resize:vertical;line-height:1.65}
.row{display:flex;gap:8px;flex-wrap:wrap}.row>*{flex:1}
button,.btn{border:0;border-radius:10px;padding:11px 14px;font:600 13px system-ui;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.primary{background:#1d4ed8;color:white}.secondary{background:#eaf0f8;color:#1e293b}.danger{background:#fff1f2;color:#be123c}
button:disabled{opacity:.45;cursor:not-allowed}
.status{font-size:13px;padding:10px 12px;border-radius:10px;background:#f1f5f9;color:#475569;margin:12px 0}
.timer{font-size:27px;font-weight:750;font-variant-numeric:tabular-nums;letter-spacing:1px}
audio{width:100%;margin-top:12px}.notice{font-size:12px;line-height:1.7;color:#64748b}
@media(max-width:560px){body{padding:10px}.panel,header{padding:14px}.row button{min-width:calc(50% - 8px)}}
</style></head>
<body><main class="wrap">
<header><div><h1>Offer 私有录音工作台</h1><div class="muted">仅限 GitHub 仓库所有者使用 · 录音在本机浏览器处理</div></div><div><span class="auth">已验证：__LOGIN__</span> <a class="btn secondary" href="/logout">退出登录</a></div></header>
<section class="panel">
<label for="company">公司 / 沟通对象</label><input id="company" placeholder="例如：某某机器人 · HR 沟通">
<div style="display:flex;align-items:center;justify-content:space-between;margin:16px 0 4px"><span class="muted">录音时长</span><span class="timer" id="timer">00:00</span></div>
<div class="status" id="status" role="status">尚未开始。请先告知对方并取得录音同意。</div>
<div class="row"><button class="primary" id="start">开始录音</button><button class="secondary" id="pause" disabled>暂停</button><button class="danger" id="stop" disabled>结束录音</button></div>
<audio id="player" controls hidden></audio>
<div class="row" style="margin-top:10px"><button class="secondary" id="downloadAudio" disabled>下载音频</button><button class="secondary" id="clearAudio" disabled>清除音频</button></div>
</section>
<section class="panel">
<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>实时语音转写</b><div class="muted">依赖浏览器 Speech Recognition 支持；部分浏览器会使用在线识别服务</div></div><span class="muted" id="speechStatus">未启动</span></div>
<div class="row" style="margin:12px 0"><button class="primary" id="speechStart">开始转写</button><button class="secondary" id="speechStop" disabled>停止转写</button><button class="secondary" id="copyText">复制文字</button><button class="secondary" id="downloadText">导出 TXT</button></div>
<textarea id="transcript" placeholder="语音识别结果会显示在这里，也可以手动修改……"></textarea>
</section>
<section class="panel"><b>使用说明与隐私</b><p class="notice">本工具仅在通过服务器端 GitHub 身份验证后提供。录音音频只保存在当前页面内存中，不会上传到本服务；请在关闭页面前下载保存。转写服务是否联网取决于浏览器实现。请在录音前告知沟通对象并取得同意。普通网页无法保证手机锁屏或切换后台后持续录音；通话时同一手机的网页麦克风也不能保证录到双方系统通话音频。</p></section>
</main>
<script nonce="__NONCE__">
(() => {
 const $ = (id) => document.getElementById(id);
 let stream=null,recorder=null,chunks=[],blob=null,audioUrl=null,startedAt=0,elapsed=0,timerHandle=null,recognition=null;
 const setStatus=(text)=>{$("status").textContent=text;};
 const format=(seconds)=>{const m=Math.floor(seconds/60),s=seconds%60;return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");};
 const updateTimer=()=>{$("timer").textContent=format(elapsed+(recorder&&recorder.state==="recording"?Math.floor((Date.now()-startedAt)/1000):0));};
 function stopTracks(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}}
 function releaseAudio(){if(audioUrl){URL.revokeObjectURL(audioUrl);audioUrl=null;}blob=null;$("player").removeAttribute("src");$("player").hidden=true;$("downloadAudio").disabled=true;$("clearAudio").disabled=true;}
 $("start").addEventListener("click",async()=>{
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){setStatus("当前浏览器不支持录音，请使用最新版 Chrome、Edge 或 Safari。");return;}
  try{
   releaseAudio();chunks=[];stream=await navigator.mediaDevices.getUserMedia({audio:true});
   recorder=new MediaRecorder(stream);recorder.ondataavailable=(e)=>{if(e.data&&e.data.size)chunks.push(e.data);};
   recorder.onstop=()=>{blob=new Blob(chunks,{type:recorder.mimeType||"audio/webm"});audioUrl=URL.createObjectURL(blob);$("player").src=audioUrl;$("player").hidden=false;$("downloadAudio").disabled=false;$("clearAudio").disabled=false;stopTracks();setStatus("录音已结束，音频仅保存在当前页面。请下载保存。");};
   recorder.start(1000);startedAt=Date.now();elapsed=0;timerHandle=setInterval(updateTimer,500);
   $("start").disabled=true;$("pause").disabled=false;$("stop").disabled=false;setStatus("正在录音。");
  }catch(error){setStatus("无法启动麦克风："+(error.message||"请检查浏览器权限。"));stopTracks();}
 });
 $("pause").addEventListener("click",()=>{
  if(!recorder)return;
  if(recorder.state==="recording"){recorder.pause();elapsed+=Math.floor((Date.now()-startedAt)/1000);$("pause").textContent="继续";setStatus("录音已暂停。");}
  else if(recorder.state==="paused"){recorder.resume();startedAt=Date.now();$("pause").textContent="暂停";setStatus("正在录音。");}
  updateTimer();
 });
 $("stop").addEventListener("click",()=>{
  if(recorder&&recorder.state!=="inactive"){if(recorder.state==="recording")elapsed+=Math.floor((Date.now()-startedAt)/1000);recorder.stop();}
  clearInterval(timerHandle);timerHandle=null;$("start").disabled=false;$("pause").disabled=true;$("stop").disabled=true;$("pause").textContent="暂停";updateTimer();
 });
 $("downloadAudio").addEventListener("click",()=>{
  if(!blob)return;const a=document.createElement("a");a.href=audioUrl;a.download="Offer录音_"+new Date().toISOString().replace(/[:.]/g,"-")+".webm";a.click();
 });
 $("clearAudio").addEventListener("click",()=>{releaseAudio();chunks=[];setStatus("已清除当前页面中的音频。");});
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(Speech){
  recognition=new Speech();recognition.lang="zh-CN";recognition.continuous=true;recognition.interimResults=true;
  recognition.onstart=()=>{$("speechStatus").textContent="识别中";$("speechStart").disabled=true;$("speechStop").disabled=false;};
  recognition.onend=()=>{$("speechStatus").textContent="未启动";$("speechStart").disabled=false;$("speechStop").disabled=true;};
  recognition.onerror=(e)=>{$("speechStatus").textContent="识别异常："+e.error;};
  recognition.onresult=(event)=>{let finalText="";for(let i=event.resultIndex;i<event.results.length;i++){const part=event.results[i][0].transcript;if(event.results[i].isFinal)finalText+=part;}if(finalText)$("transcript").value+=finalText+"\\n";};
  $("speechStart").addEventListener("click",()=>{try{recognition.start();}catch(e){$("speechStatus").textContent="无法启动："+e.message;}});
  $("speechStop").addEventListener("click",()=>recognition.stop());
 }else{$("speechStart").disabled=true;$("speechStatus").textContent="浏览器不支持实时转写";}
 $("copyText").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("transcript").value);$("speechStatus").textContent="已复制";}catch(e){$("speechStatus").textContent="复制失败，请手动复制";}});
 $("downloadText").addEventListener("click",()=>{const title=$("company").value||"Offer沟通";const content=title+"\\n"+new Date().toLocaleString()+"\\n\\n"+$("transcript").value;const url=URL.createObjectURL(new Blob(["\\ufeff",content],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="Offer转写_"+title.replace(/[^\\w\\u4e00-\\u9fa5-]/g,"_")+".txt";a.click();URL.revokeObjectURL(url);});
 window.addEventListener("beforeunload",()=>{if(recognition)try{recognition.stop();}catch(e){}if(recorder&&recorder.state!=="inactive")try{recorder.stop();}catch(e){}stopTracks();if(audioUrl)URL.revokeObjectURL(audioUrl);});
})();
</script></body></html>`;
  return response(page.replace("__LOGIN__", login).replace("__NONCE__", nonce), 200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-" + nonce + "'; connect-src 'self' https:; media-src blob:; img-src data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "X-Frame-Options": "DENY"
  });
}
async function handleLogin(request, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return configError();
  const state = randomToken(32);
  const callback = new URL("/auth/callback", request.url).toString();
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  const headers = new Headers({ Location: authorize.toString(), "Cache-Control": "no-store" });
  setCookie(headers, STATE_COOKIE, state, { maxAge: 300 });
  return new Response(null, { status: 302, headers });
}
async function handleCallback(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const savedState = cookieValue(request, STATE_COOKIE);
  const headers = new Headers({ "Cache-Control": "no-store" });
  clearCookie(headers, STATE_COOKIE);
  if (!state || !savedState || state !== savedState || !code) return new Response("登录状态校验失败，请返回入口重新登录。", { status: 400, headers });
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return configError();
  const callback = new URL("/auth/callback", request.url).toString();
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: callback })
  });
  if (!tokenResponse.ok) return response("GitHub 授权交换失败，请稍后重试。", 502);
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return response("GitHub 未返回有效授权，请重新登录。", 401);
  const userResponse = await fetch("https://api.github.com/user", {
    headers: { "Authorization": "Bearer " + tokenData.access_token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Robot-Nav-Offer-Recording" }
  });
  if (!userResponse.ok) return response("无法验证 GitHub 账号身份。", 502);
  const user = await userResponse.json();
  if (Number(user.id) !== OWNER_ID || String(user.login || "").toLowerCase() !== OWNER_LOGIN.toLowerCase()) {
    return response("<!doctype html><html lang='zh-CN'><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>无权访问</title><body style='font:16px system-ui;padding:32px;max-width:600px;margin:auto'><h2>无权使用录音功能</h2><p>当前 GitHub 账号不是此仓库的所有者。请使用仓库所有者 Robot-Nav 登录。</p><a href='/logout'>返回并清除登录状态</a></body></html>", 403, { "Content-Type": "text/html; charset=utf-8" });
  }
  const session = await createSession({ id: Number(user.id), login: user.login }, env.SESSION_SECRET);
  setCookie(headers, SESSION_COOKIE, session, { maxAge: SESSION_SECONDS });
  headers.set("Location", new URL("/recording", request.url).toString());
  return new Response(null, { status: 302, headers });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET") return response("Method Not Allowed", 405, { "Allow": "GET" });
    if (url.pathname === "/") {
      const session = await verifySession(request, env.SESSION_SECRET);
      return Response.redirect(new URL(session ? "/recording" : "/login", request.url), 302);
    }
    if (url.pathname === "/login") return loginPage();
    if (url.pathname === "/auth/login") return handleLogin(request, env);
    if (url.pathname === "/auth/callback") return handleCallback(request, env);
    if (url.pathname === "/logout") {
      const headers = new Headers({ Location: new URL("/login", request.url).toString(), "Cache-Control": "no-store" });
      clearCookie(headers, SESSION_COOKIE);
      clearCookie(headers, STATE_COOKIE);
      return new Response(null, { status: 302, headers });
    }
    if (url.pathname === "/recording") {
      const session = await verifySession(request, env.SESSION_SECRET);
      if (!session) return Response.redirect(new URL("/login", request.url), 302);
      return recordingPage(session.login, randomToken(18));
    }
    return response("Not Found", 404);
  }
};