(() => {
  "use strict";
  const privatePanelText = /录音|转写|麦克风|音频文件|隐藏入口/i;
  const panelSelector = ".panel,.card,section,article,fieldset,[class*='panel'],[class*='card']";
  const observedSelector = "button,a,label,h1,h2,h3,h4,p,span,strong,b,textarea,input";

  function removeNonPublicPanels() {
    const removals = new Set();
    document.querySelectorAll(panelSelector).forEach((panel) => {
      const text = (panel.innerText || panel.textContent || "").replace(/\s+/g, " ").trim();
      if (text && privatePanelText.test(text)) removals.add(panel);
    });
    document.querySelectorAll(observedSelector).forEach((element) => {
      const text = (element.innerText || element.textContent || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
      if (!text || !privatePanelText.test(text)) return;
      const panel = element.closest(panelSelector);
      if (panel) removals.add(panel);
      else removals.add(element);
    });
    removals.forEach((element) => element.remove());
  }

  function initialize() {
    removeNonPublicPanels();
    document.body.style.visibility = "visible";
    const observer = new MutationObserver(removeNonPublicPanels);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();