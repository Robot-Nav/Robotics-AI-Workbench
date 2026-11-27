(() => {
  const META_KEY = "offer-assistant-companies-v1";
  const ACTIVE_KEY = "offer-assistant-active-company-v1";
  const SCOPED_KEYS = new Set(["offer-assistant-check-v2", "offer-assistant-transcript-v1"]);
  const storage = window.localStorage;
  const proto = Storage.prototype;
  const nativeGet = proto.getItem;
  const nativeSet = proto.setItem;
  const nativeRemove = proto.removeItem;
  const prefix = (id, key) => "offer-assistant-company:" + id + ":" + key;
  const readRaw = (key) => nativeGet.call(storage, key);
  const writeRaw = (key, value) => nativeSet.call(storage, key, value);
  const parse = (value, fallback) => { try { return JSON.parse(value) || fallback; } catch (_) { return fallback; } };

  let companies = parse(readRaw(META_KEY), []);
  if (!Array.isArray(companies) || companies.length === 0) {
    const id = "offer-" + Date.now().toString(36);
    const profile = {
      id,
      name: "默认公司档案",
      role: "",
      city: "",
      stage: "沟通中",
      hr: "",
      notes: "",
      createdAt: new Date().toISOString()
    };
    companies = [profile];
    writeRaw(META_KEY, JSON.stringify(companies));
    const oldChecklist = readRaw("offer-assistant-check-v2");
    const oldTranscript = readRaw("offer-assistant-transcript-v1");
    if (oldChecklist !== null) writeRaw(prefix(id, "offer-assistant-check-v2"), oldChecklist);
    if (oldTranscript !== null) writeRaw(prefix(id, "offer-assistant-transcript-v1"), oldTranscript);
  }

  let activeId = readRaw(ACTIVE_KEY);
  if (!companies.some((item) => item.id === activeId)) {
    activeId = companies[0].id;
    writeRaw(ACTIVE_KEY, activeId);
  }

  proto.getItem = function (key) {
    if (this === storage && SCOPED_KEYS.has(String(key))) {
      return nativeGet.call(this, prefix(activeId, String(key)));
    }
    return nativeGet.call(this, key);
  };
  proto.setItem = function (key, value) {
    if (this === storage && SCOPED_KEYS.has(String(key))) {
      return nativeSet.call(this, prefix(activeId, String(key)), value);
    }
    return nativeSet.call(this, key, value);
  };
  proto.removeItem = function (key) {
    if (this === storage && SCOPED_KEYS.has(String(key))) {
      return nativeRemove.call(this, prefix(activeId, String(key)));
    }
    return nativeRemove.call(this, key);
  };

  window.OfferCompanyStore = {
    list: () => parse(readRaw(META_KEY), []),
    activeId: () => readRaw(ACTIVE_KEY),
    active: () => {
      const id = readRaw(ACTIVE_KEY);
      return parse(readRaw(META_KEY), []).find((item) => item.id === id) || null;
    },
    saveList: (list) => writeRaw(META_KEY, JSON.stringify(list)),
    activate: (id) => {
      if (!parse(readRaw(META_KEY), []).some((item) => item.id === id)) return false;
      writeRaw(ACTIVE_KEY, id);
      window.location.reload();
      return true;
    },
    rawGet: (id, key) => readRaw(prefix(id, key)),
    rawSet: (id, key, value) => writeRaw(prefix(id, key), value),
    rawRemove: (id, key) => nativeRemove.call(storage, prefix(id, key)),
    scopedKeys: Array.from(SCOPED_KEYS)
  };
})();