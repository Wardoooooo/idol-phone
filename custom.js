/* =========================================================
   Customization core
   - Saved content overrides (localStorage)
   - Uploaded images / audio (IndexedDB)
   - Boots app.js after media references are resolved
   ========================================================= */
(function () {
  'use strict';

  var CUSTOM_KEY = 'wb_custom_v1';
  var DB_NAME = 'wb_media_db';
  var STORE = 'files';
  var DB_VER = 1;

  function clone(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }

  function mapStrings(node, fn) {
    if (typeof node === 'string') return fn(node);
    if (Array.isArray(node)) return node.map(function (v) { return mapStrings(v, fn); });
    if (node && typeof node === 'object') {
      var out = {};
      Object.keys(node).forEach(function (k) { out[k] = mapStrings(node[k], fn); });
      return out;
    }
    return node;
  }

  var DEFAULTS = clone(window.DATA || {});

  var WB = {
    VERSION: 1,
    DEFAULTS: DEFAULTS,
    custom: null,
    error: '',
    idbOk: false,
    media: {},        // id -> { id, blob, url, name, type, kind }
    refToUrl: {},     // 'idb:<id>' -> blob: URL
    urlToRef: {},     // blob: URL -> 'idb:<id>'
    ready: false
  };
  window.WB = WB;

  /* Shared read-only view: /?p=<project-id> */
  var sharedId = null;
  try {
    var pm = location.search.match(/[?&]p=([^&]+)/);
    sharedId = pm ? decodeURIComponent(pm[1]) : null;
  } catch (e) { /* ignore */ }
  WB.READ_ONLY = !!sharedId;
  WB.sharedId = sharedId;
  WB.cloud = window.WBCloud || null;

  /* ---------------- IndexedDB ---------------- */
  var dbPromise = null;

  function idbOpen() {
    if (!window.indexedDB) return Promise.reject(new Error('no-indexeddb'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('idb-open-failed')); };
      req.onblocked = function () { reject(new Error('idb-blocked')); };
    });
    return dbPromise;
  }

  function idbAll() {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function idbPut(rec) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = function () { resolve(rec); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  function idbDelete(id) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () { resolve(id); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function registerMedia(rec) {
    var url = URL.createObjectURL(rec.blob);
    WB.media[rec.id] = {
      id: rec.id, blob: rec.blob, url: url,
      name: rec.name || '', type: rec.type || rec.blob.type || '',
      kind: rec.kind || '', ts: rec.ts || Date.now()
    };
    WB.refToUrl['idb:' + rec.id] = url;
    WB.urlToRef[url] = 'idb:' + rec.id;
    return WB.media[rec.id];
  }

  function loadMedia() {
    return idbAll().then(function (records) {
      WB.idbOk = true;
      records.forEach(function (rec) {
        if (rec && rec.id && rec.blob) registerMedia(rec);
      });
    }).catch(function (err) {
      WB.error = 'IndexedDB unavailable: ' + (err && err.message ? err.message : err);
    });
  }

  /* ---------------- image helpers ---------------- */
  function shrinkImage(file) {
    if (!/^image\//.test(file.type || '')) return Promise.resolve(file);
    if (/svg|gif/i.test(file.type)) return Promise.resolve(file);
    if (file.size <= 700 * 1024) return Promise.resolve(file);
    return new Promise(function (resolve) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1600;
        var scale = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        try {
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (blob && blob.size < file.size) resolve(blob);
            else resolve(file);
          }, 'image/jpeg', 0.86);
        } catch (e) {
          URL.revokeObjectURL(url);
          resolve(file);
        }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  /* ---------------- public: media ---------------- */
  WB.addFile = function (file, kind) {
    if (!file) return Promise.reject(new Error('No file'));
    var prep = kind === 'image' ? shrinkImage(file) : Promise.resolve(file);
    return prep.then(function (blob) {
      var id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      var rec = {
        id: id, blob: blob,
        name: file.name || '', type: blob.type || file.type || '',
        kind: kind || (blob.type.indexOf('audio') === 0 ? 'audio' : 'image'),
        ts: Date.now()
      };
      return idbPut(rec).then(function () {
        var m = registerMedia(rec);
        return { ref: 'idb:' + id, url: m.url, name: m.name };
      });
    });
  };

  WB.mediaURL = function (ref) {
    if (!ref) return '';
    if (ref.indexOf('idb:') === 0) return WB.refToUrl[ref] || '';
    return ref;
  };

  WB.mediaName = function (ref) {
    if (!ref || ref.indexOf('idb:') !== 0) return ref ? '内置素材' : '';
    var m = WB.media[ref.slice(4)];
    return m ? (m.name || '已上传素材') : '素材丢失';
  };

  /* Turn embedded data: URLs (e.g. a shared, baked data.js) into
     IndexedDB media, in place, so the customizer can save a small config. */
  WB.ingestEmbedded = function () {
    var found = {};
    (function collect(node) {
      if (typeof node === 'string') {
        if (/^data:(image|audio)\//i.test(node)) found[node] = true;
      } else if (Array.isArray(node)) {
        node.forEach(collect);
      } else if (node && typeof node === 'object') {
        Object.keys(node).forEach(function (k) { collect(node[k]); });
      }
    })(window.DATA);

    var urls = Object.keys(found);
    if (!urls.length) return Promise.resolve(0);
    var map = {};
    var jobs = urls.map(function (dataURL) {
      var blob;
      try { blob = dataURLToBlob(dataURL); } catch (e) { return Promise.resolve(); }
      var id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      var kind = dataURL.indexOf('data:audio') === 0 ? 'audio' : 'image';
      var rec = { id: id, blob: blob, name: 'embedded', type: blob.type, kind: kind, ts: Date.now() };
      return idbPut(rec).then(function () {
        map[dataURL] = registerMedia(rec).url;
      }).catch(function () { /* keep original */ });
    });

    return Promise.all(jobs).then(function () {
      (function replace(node) {
        if (Array.isArray(node)) {
          for (var i = 0; i < node.length; i++) {
            if (typeof node[i] === 'string' && map[node[i]]) node[i] = map[node[i]];
            else replace(node[i]);
          }
        } else if (node && typeof node === 'object') {
          Object.keys(node).forEach(function (k) {
            if (typeof node[k] === 'string' && map[node[k]]) node[k] = map[node[k]];
            else replace(node[k]);
          });
        }
      })(window.DATA);
      return urls.length;
    });
  };

  WB.listMedia = function () {
    return Object.keys(WB.media).map(function (id) {
      var m = WB.media[id];
      return { id: id, name: m.name, type: m.type, kind: m.kind, size: m.blob.size, ts: m.ts };
    }).sort(function (a, b) { return b.ts - a.ts; });
  };

  WB.usage = function () {
    if (navigator.storage && navigator.storage.estimate) {
      return navigator.storage.estimate().catch(function () { return null; });
    }
    return Promise.resolve(null);
  };

  /* ---------------- config ---------------- */
  WB.hasCustom = function () {
    if (WB.custom) return true;
    try { return !!localStorage.getItem(CUSTOM_KEY); } catch (e) { return false; }
  };

  WB.config = function () {
    var snap = clone(window.DATA || {});
    return mapStrings(snap, function (s) {
      return WB.urlToRef[s] || s;
    });
  };

  function syncSideStores(cfg, opts) {
    opts = opts || {};
    // Notes edited inside the phone app are stored separately.
    try {
      localStorage.setItem('wb_notes', JSON.stringify(cfg.notes || []));
    } catch (e) { /* ignore */ }
    // The phone app prefers wb_pin over data.lock.pin.
    try {
      localStorage.setItem('wb_pin', String((cfg.lock && cfg.lock.pin) || ''));
    } catch (e) { /* ignore */ }
    // Settings wallpaper overrides data.wallpaper.
    if (opts.clearWallpaper) {
      try {
        var set = JSON.parse(localStorage.getItem('wb_settings') || '{}');
        set.wallpaper = '';
        localStorage.setItem('wb_settings', JSON.stringify(set));
      } catch (e) { /* ignore */ }
    }
  }

  WB.saveConfig = function (cfg, opts) {
    var text = JSON.stringify(cfg);
    try {
      localStorage.setItem(CUSTOM_KEY, text);
    } catch (e) {
      throw new Error('保存失败：浏览器本地存储空间不足');
    }
    WB.custom = clone(cfg);
    syncSideStores(cfg, opts);
    return text.length;
  };

  WB.reset = function () {
    try { localStorage.removeItem(CUSTOM_KEY); } catch (e) { /* ignore */ }
    try { localStorage.removeItem('wb_notes'); } catch (e) { /* ignore */ }
    try { localStorage.removeItem('wb_pin'); } catch (e) { /* ignore */ }
    try {
      var set = JSON.parse(localStorage.getItem('wb_settings') || '{}');
      set.wallpaper = '';
      localStorage.setItem('wb_settings', JSON.stringify(set));
    } catch (e) { /* ignore */ }
    WB.custom = null;
  };

  WB.clearMedia = function () {
    var ids = Object.keys(WB.media);
    return Promise.all(ids.map(function (id) {
      return idbDelete(id).then(function () {
        var m = WB.media[id];
        if (m) {
          URL.revokeObjectURL(m.url);
          delete WB.urlToRef[m.url];
        }
        delete WB.media[id];
        delete WB.refToUrl['idb:' + id];
      }).catch(function () { /* ignore single failure */ });
    }));
  };

  WB.prune = function () {
    var used = {};
    mapStrings(WB.config(), function (s) {
      if (s.indexOf('idb:') === 0) used[s.slice(4)] = true;
      return s;
    });
    var unused = Object.keys(WB.media).filter(function (id) { return !used[id]; });
    return Promise.all(unused.map(function (id) {
      return idbDelete(id).then(function () {
        var m = WB.media[id];
        if (m) {
          URL.revokeObjectURL(m.url);
          delete WB.urlToRef[m.url];
        }
        delete WB.media[id];
        delete WB.refToUrl['idb:' + id];
      });
    })).then(function () { return unused.length; });
  };

  /* ---------------- export / import ---------------- */
  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(dataURL) {
    var parts = String(dataURL).split(',');
    var head = parts[0] || '';
    var mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    var payload = parts.slice(1).join(',');
    if (/;base64/i.test(head)) {
      var bin = atob(payload);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  }

  WB.exportBackup = function (includeMedia) {
    var cfg = WB.config();
    var out = {
      app: 'idol-phone', kind: 'backup', version: 1,
      savedAt: new Date().toISOString(), data: cfg
    };
    if (!includeMedia) return Promise.resolve(out);
    var ids = {};
    mapStrings(cfg, function (s) {
      if (s.indexOf('idb:') === 0) ids[s.slice(4)] = true;
      return s;
    });
    out.media = {};
    var jobs = Object.keys(ids).filter(function (id) { return !!WB.media[id]; }).map(function (id) {
      var m = WB.media[id];
      return blobToDataURL(m.blob).then(function (data) {
        out.media[id] = { name: m.name, type: m.type, kind: m.kind, data: data };
      });
    });
    return Promise.all(jobs).then(function () { return out; });
  };

  /* config with every uploaded media ref baked into a data URL */
  WB.bakeConfig = function () {
    var cfg = WB.config();
    var jobs = [];
    var staged = mapStrings(cfg, function (s) {
      if (s.indexOf('idb:') === 0) {
        var m = WB.media[s.slice(4)];
        if (!m) return s;
        jobs.push(blobToDataURL(m.blob).then(function (data) { m.__data = data; }));
        return s;
      }
      return s;
    });
    return Promise.all(jobs).then(function () {
      var finalCfg = mapStrings(staged, function (s) {
        if (s.indexOf('idb:') === 0) {
          var m = WB.media[s.slice(4)];
          return m && m.__data ? m.__data : s;
        }
        return s;
      });
      Object.keys(WB.media).forEach(function (id) { delete WB.media[id].__data; });
      return finalCfg;
    });
  };

  /* data.js that can be dropped into the folder and shared */
  WB.exportDataJS = function () {
    return WB.bakeConfig().then(function (finalCfg) {
      return '/* Personalized content — generated by the in-page customizer */\n'
        + 'var DATA = ' + JSON.stringify(finalCfg, null, 2) + ';\n';
    });
  };

  WB.importBackup = function (obj) {
    return new Promise(function (resolve, reject) {
      if (!obj || typeof obj !== 'object') return reject(new Error('文件内容不是有效的备份'));
      var cfg = obj.data || (obj.owner && obj.contacts ? obj : null);
      if (!cfg) return reject(new Error('备份里没有 DATA 内容'));
      var media = obj.media || {};
      var jobs = Object.keys(media).map(function (id) {
        var m = media[id];
        var blob;
        try { blob = dataURLToBlob(m.data); } catch (e) { return Promise.resolve(); }
        return idbPut({
          id: id, blob: blob, name: m.name || '', type: m.type || blob.type,
          kind: m.kind || '', ts: Date.now()
        });
      });
      Promise.all(jobs).then(function () {
        WB.saveConfig(cfg, { clearWallpaper: true });
        resolve(true);
      }).catch(reject);
    });
  };

  /* ---------------- standalone share page ---------------- */
  var shareTplPromise = null;

  function loadShareTemplate() {
    if (window.WB_SHARE_TEMPLATE) return Promise.resolve(window.WB_SHARE_TEMPLATE);
    if (shareTplPromise) return shareTplPromise;
    shareTplPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'share-template.js?v=' + Date.now();
      s.async = true;
      s.onload = function () {
        if (window.WB_SHARE_TEMPLATE) resolve(window.WB_SHARE_TEMPLATE);
        else {
          shareTplPromise = null;
          reject(new Error('share-template.js 内容无效，请重新运行 tools/build-share-template.js'));
        }
      };
      s.onerror = function () {
        shareTplPromise = null;
        reject(new Error('找不到 share-template.js（要和 index.html 放在同一目录）'));
      };
      document.head.appendChild(s);
    });
    return shareTplPromise;
  }

  function put(html, marker, text) {
    return html.replace(marker, function () { return text; });
  }

  /* app.js hard-codes a few asset paths (Settings → Wallpaper).
     Rewrite them so the standalone page never needs an assets/ folder. */
  function inlineAssetRefs(source, embedded) {
    return String(source).replace(/(['"])(assets\/[^'"]+)\1/g, function (m, quote, rel) {
      return embedded[rel] ? quote + embedded[rel] + quote : m;
    });
  }

  /* Build one self-contained index.html: no folder, no editor, no setup. */
  WB.buildShareHTML = function () {
    return loadShareTemplate().then(function (tpl) {
      return WB.bakeConfig().then(function (cfg) {
        var embedded = tpl.assets || {};
        var finalCfg = mapStrings(cfg, function (s) {
          if (s.indexOf('idb:') === 0) return s;
          if (embedded[s]) return embedded[s];
          var rel = s.replace(/^\.\//, '');
          return embedded[rel] || s;
        });

        /* Each build gets its own storage prefix: notes / PIN / wallpaper a
           recipient changes are kept for this build, while a new version of
           the gift starts fresh and never touches the customizer's own state. */
        var buildId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        var boot = '<script>window.WB_KEY_PREFIX = '
          + JSON.stringify('wb' + buildId + '_') + ';<\/script>';

        var json = JSON.stringify(finalCfg)
          .replace(/</g, "\\u003c")
          .split("\u2028").join("\\u2028")
          .split("\u2029").join("\\u2029");
        var shell = inlineAssetRefs(tpl.shell, embedded);
        var css = inlineAssetRefs(tpl.css, embedded);
        var icons = inlineAssetRefs(tpl.icons, embedded);
        var app = inlineAssetRefs(tpl.app, embedded);
        var html = shell;
        html = put(html, '<!--WB_STYLE-->', '<style>\n' + css + '\n</style>');
        html = put(html, '<!--WB_DATA-->', '<script>window.DATA = ' + json + ';<\/script>');
        html = put(html, '<!--WB_ICONS-->', '<script>\n' + icons + '\n<\/script>');
        html = put(html, '<!--WB_APP-->', boot + '\n<script>\n' + app + '\n<\/script>');
        return html;
      });
    });
  };

  /* ---------------- tiny single-file ZIP (stored) ---------------- */
  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  WB.zipFile = function (filename, text) {
    var enc = new TextEncoder();
    var name = enc.encode(filename);
    var data = enc.encode(text);
    var crc = crc32(data);
    var d = new Date();
    var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5)
      | (Math.floor(d.getSeconds() / 2) & 31);
    var date = (((d.getFullYear() - 1980) & 127) << 9)
      | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);

    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }

    var local = u32(0x04034b50).concat(u16(20), u16(0x0800), u16(0),
      u16(time), u16(date), u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0));
    var central = u32(0x02014b50).concat(u16(20), u16(20), u16(0x0800), u16(0),
      u16(time), u16(date), u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0));
    var localBytes = new Uint8Array(local);
    var centralBytes = new Uint8Array(central);
    var cdOffset = localBytes.length + name.length + data.length;
    var cdSize = centralBytes.length + name.length;
    var end = u32(0x06054b50).concat(u16(0), u16(0), u16(1), u16(1),
      u32(cdSize), u32(cdOffset), u16(0));
    var endBytes = new Uint8Array(end);

    var out = new Uint8Array(localBytes.length + name.length + data.length
      + centralBytes.length + name.length + endBytes.length);
    var pos = 0;
    function putBytes(arr) { out.set(arr, pos); pos += arr.length; }
    putBytes(localBytes); putBytes(name); putBytes(data);
    putBytes(centralBytes); putBytes(name); putBytes(endBytes);
    return new Blob([out], { type: 'application/zip' });
  };

  /* ---------------- download ---------------- */
  WB.downloadBlob = function (filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 4000);
  };

  WB.download = function (filename, text, mime) {
    WB.downloadBlob(filename,
      new Blob([text], { type: mime || 'application/json;charset=utf-8' }));
  };

  /* ---------------- boot ---------------- */
  function applyCustom() {
    if (WB.custom) return; // already loaded
    var raw = null;
    try { raw = localStorage.getItem(CUSTOM_KEY); } catch (e) { /* ignore */ }
    if (!raw) return;
    var cfg;
    try { cfg = JSON.parse(raw); } catch (e) {
      WB.error = 'Saved customization is corrupted and was ignored';
      return;
    }
    if (!cfg || typeof cfg !== 'object') return;
    WB.custom = cfg;
    var resolved = mapStrings(cfg, function (s) {
      if (s.indexOf('idb:') === 0) return WB.refToUrl[s] || s;
      return s;
    });
    var out = resolved;
    Object.keys(DEFAULTS).forEach(function (k) {
      if (!(k in out)) out[k] = clone(DEFAULTS[k]);
    });
    window.DATA = out;
  }

  function injectApp() {
    var s = document.createElement('script');
    s.src = 'app.js?v=61';
    s.async = false;
    s.onerror = function () {
      document.title = 'Engine failed to load';
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:99999;'
        + 'background:#1d1d25;color:#fff;padding:18px 22px;border-radius:12px;'
        + 'font:13px/1.7 system-ui,sans-serif;max-width:320px;text-align:center';
      box.textContent = 'app.js 加载失败：请确认所有文件都放在同一个文件夹里（index.html、app.js、custom.js 等）。';
      document.body.appendChild(box);
    };
    document.body.appendChild(s);
  }

  function withDefaults(cfg) {
    var out = cfg || {};
    Object.keys(DEFAULTS).forEach(function (k) {
      if (!(k in out)) out[k] = clone(DEFAULTS[k]);
    });
    return out;
  }

  function showLoading(text) {
    var el = document.createElement('div');
    el.id = 'wbShareLoading';
    el.style.cssText = 'position:fixed;inset:0;z-index:99998;background:#0b0b10;color:#eee;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'font:15px/1.6 system-ui,-apple-system,sans-serif;text-align:center;padding:24px';
    el.textContent = text || 'Loading…';
    document.body.appendChild(el);
  }

  function hideLoading() {
    var el = document.getElementById('wbShareLoading');
    if (el) el.remove();
  }

  function showShareError(message) {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0b0b10;color:#eee;'
      + 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;'
      + 'font:15px/1.6 system-ui,-apple-system,sans-serif;text-align:center;padding:24px';
    var title = document.createElement('div');
    title.textContent = message || 'This shared phone is not available.';
    title.style.fontSize = '18px';
    var link = document.createElement('a');
    link.href = location.pathname;
    link.textContent = 'Create your own iPhone →';
    link.style.color = '#8ab4ff';
    box.appendChild(title);
    box.appendChild(link);
    document.body.appendChild(box);
  }

  function bootShared() {
    if (!WB.cloud || !WB.cloud.configured()) {
      showShareError('This shared phone is not available.');
      return;
    }
    showLoading('Loading shared phone…');
    var wait = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 8000); });
    Promise.race([WB.cloud.loadShared(sharedId), wait]).then(function (project) {
      if (!project || !project.data) {
        hideLoading();
        showShareError('This shared phone is no longer available.');
        return;
      }
      var ts = project.published_at ? Date.parse(project.published_at) : Date.now();
      if (isNaN(ts)) ts = Date.now();
      var short = String(sharedId).replace(/-/g, '').slice(0, 12);
      /* Isolate notes / PIN / wallpaper a viewer changes on the shared page. */
      window.WB_KEY_PREFIX = 'wbshare_' + short + '_' + ts + '_';
      window.DATA = withDefaults(project.data);
      if (project.title) document.title = project.title;
      hideLoading();
      WB.ready = true;
      injectApp();
    }).catch(function () {
      hideLoading();
      showShareError('This shared phone is no longer available.');
    });
  }

  function bootOwner() {
    var wait = new Promise(function (resolve) { setTimeout(resolve, 8000); });
    Promise.race([loadMedia(), wait]).then(function () {
      applyCustom();
      var pid = WB.cloud && WB.cloud.projectId ? WB.cloud.projectId() : null;
      if (!pid || !WB.cloud.configured()) {
        WB.ready = true;
        injectApp();
        return;
      }
      var cloudWait = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 3000); });
      Promise.race([
        WB.cloud.loadProject(pid).catch(function () { return null; }),
        cloudWait
      ]).then(function (project) {
        if (project && project.data) {
          window.DATA = withDefaults(project.data);
          try { WB.saveConfig(window.DATA, { clearWallpaper: false }); } catch (e) { /* ignore */ }
        }
        WB.ready = true;
        injectApp();
      });
    });
  }

  if (sharedId) bootShared();
  else bootOwner();
})();
