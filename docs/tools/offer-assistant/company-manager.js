(() => {
  const store = window.OfferCompanyStore;
  if (!store) return;
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const makeId = () => "offer-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  const download = (data, filename) => {
    const blob = new Blob(["\ufeff", JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const getData = (profile) => ({
    profile,
    checklist: JSON.parse(store.rawGet(profile.id, "offer-assistant-check-v2") || "{}"),
    transcript: store.rawGet(profile.id, "offer-assistant-transcript-v1") || ""
  });
  const snapshot = (profiles) => ({
    format: "robot-nav-offer-assistant-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    companies: profiles.map(getData)
  });
  const active = () => store.active();
  const setValue = (id, value) => { $(id).value = value || ""; };
  const getValue = (id) => $(id).value.trim();

  function render() {
    const profiles = store.list();
    const current = active();
    $("companySelect").innerHTML = profiles.map((p) =>
      '<option value="' + esc(p.id) + '"' + (p.id === current.id ? " selected" : "") + ">" +
      esc(p.name) + (p.role ? " · " + esc(p.role) : "") + "</option>"
    ).join("");
    $("companyCount").textContent = profiles.length + " 家公司";
    const info = [];
    if (current.role) info.push("岗位：" + esc(current.role));
    if (current.city) info.push("地点：" + esc(current.city));
    if (current.stage) info.push("进度：" + esc(current.stage));
    if (current.hr) info.push("联系人：" + esc(current.hr));
    $("companyMeta").innerHTML =
      '<div class="company-name">' + esc(current.name) + "</div>" +
      '<div class="company-facts">' + (info.length ? info.join("　｜　") : "尚未填写岗位、地点或联系人信息") + "</div>" +
      (current.notes ? '<div class="company-notes">' + esc(current.notes) + "</div>" : "");
    $("deleteCompany").disabled = profiles.length <= 1;
  }

  function openEditor(profile) {
    $("companyEditor").hidden = false;
    $("companyEditorTitle").textContent = profile ? "编辑公司档案" : "新建公司档案";
    setValue("companyName", profile && profile.name);
    setValue("companyRole", profile && profile.role);
    setValue("companyCity", profile && profile.city);
    setValue("companyStage", profile && profile.stage || "沟通中");
    setValue("companyHR", profile && profile.hr);
    setValue("companyNotes", profile && profile.notes);
    $("companyEditor").dataset.editId = profile ? profile.id : "";
    $("companyName").focus();
  }
  function closeEditor() { $("companyEditor").hidden = true; }

  $("companySelect").addEventListener("change", (event) => store.activate(event.target.value));
  $("addCompany").addEventListener("click", () => openEditor(null));
  $("editCompany").addEventListener("click", () => openEditor(active()));
  $("cancelCompany").addEventListener("click", closeEditor);
  $("saveCompany").addEventListener("click", () => {
    const name = getValue("companyName");
    if (!name) { alert("请填写公司名称。"); $("companyName").focus(); return; }
    const profiles = store.list();
    const editId = $("companyEditor").dataset.editId;
    let profile = profiles.find((p) => p.id === editId);
    if (!profile) {
      profile = { id: makeId(), createdAt: new Date().toISOString() };
      profiles.push(profile);
    }
    profile.name = name;
    profile.role = getValue("companyRole");
    profile.city = getValue("companyCity");
    profile.stage = getValue("companyStage");
    profile.hr = getValue("companyHR");
    profile.notes = getValue("companyNotes");
    profile.updatedAt = new Date().toISOString();
    store.saveList(profiles);
    closeEditor();
    if (editId) render();
    else store.activate(profile.id);
  });
  $("deleteCompany").addEventListener("click", () => {
    const current = active();
    if (store.list().length <= 1) return;
    if (!confirm("确定删除「" + current.name + "」档案吗？该公司的清单、答复备注和转写文字也会从此浏览器删除。请先导出备份。")) return;
    const profiles = store.list().filter((p) => p.id !== current.id);
    store.scopedKeys.forEach((key) => store.rawRemove(current.id, key));
    store.saveList(profiles);
    store.activate(profiles[0].id);
  });
  $("exportCompany").addEventListener("click", () => {
    const p = active();
    download(snapshot([p]), "Offer档案_" + p.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "_") + ".json");
  });
  $("backupCompanies").addEventListener("click", () => {
    download(snapshot(store.list()), "Offer全部公司档案备份_" + new Date().toISOString().slice(0, 10) + ".json");
  });
  $("importCompanies").addEventListener("click", () => $("importCompanyFile").click());
  $("importCompanyFile").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.format !== "robot-nav-offer-assistant-backup" || !Array.isArray(data.companies)) throw new Error("文件格式不正确");
      if (!confirm("将导入 " + data.companies.length + " 份公司档案。现有档案不会被覆盖，是否继续？")) return;
      const profiles = store.list();
      data.companies.forEach((item) => {
        if (!item || !item.profile || !item.profile.name) return;
        const p = Object.assign({}, item.profile, { id: makeId(), name: item.profile.name + "（导入）" });
        profiles.push(p);
        store.rawSet(p.id, "offer-assistant-check-v2", JSON.stringify(item.checklist || {}));
        store.rawSet(p.id, "offer-assistant-transcript-v1", String(item.transcript || ""));
      });
      store.saveList(profiles);
      alert("导入完成。");
      render();
    } catch (error) {
      alert("导入失败：" + error.message);
    } finally {
      event.target.value = "";
    }
  });
  render();
})();