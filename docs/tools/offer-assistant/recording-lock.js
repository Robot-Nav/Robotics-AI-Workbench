(() => {
  "use strict";

  const STORAGE_KEY = "offer-assistant-recording-access-v1";
  const ITERATIONS = 240000;
  const encoder = new TextEncoder();
  const signal = /开始录音|结束录音|停止录音|暂停录音|下载音频|实时转写|麦克风|录音同意|录音文件|音频文件|保存录音|导出音频|录音与|录音控制|语音录制/i;
  const smallTextNodes = "button,label,h1,h2,h3,h4,p,span,strong,b,div";
  let unlocked = false;
  let failedAttempts = 0;
  let lockUntil = 0;
  let observer = null;
  const hiddenTargets = new Set();

  const readConfig = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
    catch (_) { return null; }
  };

  const toBase64 = (bytes) => {
    let binary = "";
    bytes.forEach((value) => { binary += String.fromCharCode(value); });
    return btoa(binary);
  };

  const fromBase64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

  async function deriveHash(password, salt, iterations) {
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    }, key, 256);
    return new Uint8Array(bits);
  }

  function nearestFeatureContainer(element) {
    return element.closest(".panel,.card,section,article,fieldset,[class*='panel'],[class*='card']") || element;
  }

  function findFeatureTargets() {
    const found = new Set();
    document.querySelectorAll(smallTextNodes).forEach((element) => {
      const value = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
      if (!value || value.length > 140 || !signal.test(value)) return;
      const target = nearestFeatureContainer(element);
      if (target && target !== document.body && target !== document.documentElement) found.add(target);
    });
    return found;
  }

  function setFeatureVisibility(visible) {
    const targets = findFeatureTargets();
    targets.forEach((target) => hiddenTargets.add(target));
    hiddenTargets.forEach((target) => {
      if (!target.isConnected) {
        hiddenTargets.delete(target);
        return;
      }
      if (visible) {
        target.removeAttribute("data-recording-lock");
        target.hidden = false;
        target.style.removeProperty("display");
      } else {
        target.setAttribute("data-recording-lock", "hidden");
        target.hidden = true;
        target.style.setProperty("display", "none", "important");
      }
    });
  }

  const entry = document.createElement("button");
  entry.type = "button";
  entry.id = "offerRecordingHiddenEntry";
  entry.textContent = "隐藏入口";
  entry.setAttribute("aria-label", "打开隐藏入口");
  Object.assign(entry.style, {
    display: "block",
    margin: "24px auto 12px",
    padding: "5px 9px",
    border: "0",
    background: "transparent",
    color: "#8a96a8",
    fontSize: "11px",
    cursor: "pointer",
    opacity: "0.7"
  });

  const overlay = document.createElement("div");
  overlay.id = "offerRecordingPasswordOverlay";
  overlay.hidden = true;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px",
    background: "rgba(10,20,35,.68)",
    backdropFilter: "blur(5px)"
  });

  const modal = document.createElement("form");
  modal.id = "offerRecordingPasswordForm";
  Object.assign(modal.style, {
    width: "min(100%, 380px)",
    boxSizing: "border-box",
    padding: "23px",
    borderRadius: "16px",
    background: "#fff",
    color: "#17263c",
    boxShadow: "0 24px 70px rgba(0,0,0,.28)",
    fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
  });
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.appendChild(entry);

  function showOverlay() {
    overlay.hidden = false;
    overlay.style.display = "flex";
    renderPasswordForm();
  }

  function closeOverlay() {
    overlay.hidden = true;
    overlay.style.display = "none";
    modal.innerHTML = "";
  }

  function renderPasswordForm(errorMessage) {
    const configured = !!readConfig();
    const title = configured ? "解锁录音功能" : "首次设置录音访问密码";
    const description = configured
      ? "请输入访问密码，验证通过后显示录音与转写工具。"
      : "请设置一个仅在当前浏览器使用的访问密码，至少 8 位。密码只保存加密校验值，不会上传到网站。";
    modal.innerHTML = "";
    const heading = document.createElement("h2");
    heading.textContent = title;
    Object.assign(heading.style, { margin: "0 0 8px", fontSize: "19px" });
    const detail = document.createElement("p");
    detail.textContent = description;
    Object.assign(detail.style, { margin: "0 0 16px", color: "#64748b", fontSize: "13px", lineHeight: "1.6" });
    modal.append(heading, detail);

    const makeField = (labelText, name, placeholder) => {
      const wrap = document.createElement("label");
      Object.assign(wrap.style, { display: "block", margin: "0 0 12px", fontSize: "12px", color: "#475569" });
      const label = document.createElement("span");
      label.textContent = labelText;
      label.style.display = "block";
      label.style.marginBottom = "5px";
      const input = document.createElement("input");
      input.name = name;
      input.type = "password";
      input.autocomplete = configured ? "current-password" : "new-password";
      input.placeholder = placeholder;
      input.required = true;
      input.minLength = 8;
      Object.assign(input.style, {
        width: "100%",
        boxSizing: "border-box",
        padding: "11px 12px",
        border: "1px solid #cbd5e1",
        borderRadius: "9px",
        fontSize: "15px"
      });
      wrap.append(label, input);
      modal.appendChild(wrap);
      return input;
    };

    const password = makeField("访问密码", "password", "至少 8 位");
    let confirmation = null;
    if (!configured) confirmation = makeField("再次输入密码", "confirmation", "再次输入以确认");

    const message = document.createElement("p");
    message.setAttribute("role", "status");
    message.textContent = errorMessage || "";
    Object.assign(message.style, { minHeight: "18px", margin: "0 0 12px", color: "#b42318", fontSize: "12px" });
    modal.appendChild(message);

    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", gap: "9px", justifyContent: "flex-end" });
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = configured ? "验证并显示" : "设置密码并显示";
    [cancel, submit].forEach((button) => Object.assign(button.style, {
      border: "0",
      borderRadius: "9px",
      padding: "10px 13px",
      fontSize: "13px",
      cursor: "pointer"
    }));
    cancel.style.background = "#eef2f7";
    submit.style.background = "#1d4ed8";
    submit.style.color = "#fff";
    cancel.addEventListener("click", closeOverlay);
    actions.append(cancel, submit);
    modal.appendChild(actions);
    password.focus();

    modal.onsubmit = async (event) => {
      event.preventDefault();
      const first = password.value;
      if (first.length < 8) {
        renderPasswordForm("密码至少需要 8 位。");
        return;
      }
      submit.disabled = true;
      submit.textContent = "正在验证…";
      try {
        const config = readConfig();
        if (!config) {
          if (first !== confirmation.value) {
            renderPasswordForm("两次输入的密码不一致，请重新输入。");
            return;
          }
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const hash = await deriveHash(first, salt, ITERATIONS);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            algorithm: "PBKDF2-SHA-256",
            iterations: ITERATIONS,
            salt: toBase64(salt),
            hash: toBase64(hash),
            createdAt: new Date().toISOString()
          }));
          unlock();
          return;
        }
        if (Date.now() < lockUntil) {
          const seconds = Math.ceil((lockUntil - Date.now()) / 1000);
          renderPasswordForm("尝试次数过多，请 " + seconds + " 秒后再试。");
          return;
        }
        const candidate = await deriveHash(first, fromBase64(config.salt), config.iterations);
        const expected = fromBase64(config.hash);
        let diff = candidate.length ^ expected.length;
        for (let i = 0; i < Math.min(candidate.length, expected.length); i++) diff |= candidate[i] ^ expected[i];
        if (diff === 0) {
          failedAttempts = 0;
          unlock();
        } else {
          failedAttempts += 1;
          if (failedAttempts >= 5) {
            failedAttempts = 0;
            lockUntil = Date.now() + 30000;
            renderPasswordForm("密码错误次数过多，已暂停验证 30 秒。");
          } else {
            renderPasswordForm("密码不正确，还可以尝试 " + (5 - failedAttempts) + " 次。");
          }
        }
      } catch (error) {
        renderPasswordForm("验证失败：" + (error && error.message ? error.message : "请检查浏览器是否支持安全加密功能。"));
      }
    };
  }

  function unlock() {
    unlocked = true;
    closeOverlay();
    setFeatureVisibility(true);
    entry.textContent = "隐藏录音";
    entry.setAttribute("aria-label", "隐藏并锁定录音功能");
    entry.style.color = "#b45309";
  }

  function lock() {
    unlocked = false;
    setFeatureVisibility(false);
    entry.textContent = "隐藏入口";
    entry.setAttribute("aria-label", "打开隐藏入口");
    entry.style.color = "#8a96a8";
  }

  entry.addEventListener("click", () => {
    if (unlocked) lock();
    else showOverlay();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeOverlay();
  });

  if (!window.crypto || !window.crypto.subtle) {
    entry.title = "当前浏览器不支持安全密码校验，请使用最新版 Chrome、Edge 或 Safari。";
  }

  const start = () => {
    setFeatureVisibility(false);
    const footer = document.querySelector("footer");
    if (footer) footer.appendChild(entry);
    observer = new MutationObserver(() => setFeatureVisibility(unlocked));
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();