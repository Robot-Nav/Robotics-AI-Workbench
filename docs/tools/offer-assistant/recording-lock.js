(() => {
  "use strict";
  const strongSignals = /开始录音|结束录音|停止录音|暂停录音|下载音频|录音同意|麦克风权限|实时语音转写|实时转写|开始转写|停止转写|录音时长/i;
  const selector = "button,a,label,h1,h2,h3,h4,p,span,strong,b,textarea,input";
  let entry = null;
  let observer = null;

  function removePublicRecorder() {
    const remove = new Set();
    document.querySelectorAll(selector).forEach((element) => {
      const text = (element.innerText || element.textContent || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 100 || !strongSignals.test(text)) return;
      const panel = element.closest(".panel,.card,section,article,fieldset,[class*='panel'],[class*='card']");
      if (panel && panel !== document.body && panel !== document.documentElement) remove.add(panel);
      else if (element !== entry) remove.add(element);
    });
    remove.forEach((element) => element.remove());
  }

  function addPrivateEntry() {
    if (entry || !document.body) return;
    entry = document.createElement("button");
    entry.type = "button";
    entry.textContent = "隐藏入口";
    entry.setAttribute("aria-label", "仓库所有者私有录音入口");
    entry.title = "私有录音入口";
    Object.assign(entry.style, {
      position: "fixed",
      right: "10px",
      bottom: "8px",
      zIndex: "99999",
      padding: "5px 9px",
      border: "0",
      borderRadius: "8px",
      background: "rgba(255,255,255,.78)",
      color: "#8491a3",
      fontSize: "11px",
      cursor: "pointer",
      opacity: ".65"
    });
    entry.addEventListener("click", () => {
      const configured = String(window.OFFER_RECORDING_AUTH_URL || "").trim();
      if (!configured) {
        alert("服务器身份认证尚未部署完成。录音功能目前保持关闭。");
        return;
      }
      try {
        const base = new URL(configured);
        if (base.protocol !== "https:") throw new Error("认证地址必须使用 HTTPS");
        window.location.assign(new URL("/login", base).toString());
      } catch (error) {
        alert("私有录音认证地址配置无效：" + error.message);
      }
    });
    document.body.appendChild(entry);
  }

  function initialize() {
    removePublicRecorder();
    addPrivateEntry();
    if (!observer) {
      observer = new MutationObserver(() => {
        removePublicRecorder();
        addPrivateEntry();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();