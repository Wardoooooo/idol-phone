/* =========================================================
   Lightweight Supabase cloud client (no SDK)
   - anonymous sessions
   - auto-saved projects
   - public published snapshots
   - image / audio uploads to Storage
   ========================================================= */
(function () {
  'use strict';

  var CFG = window.WB_CLOUD || {};
  var SESSION_KEY = 'wb_cloud_session_v1';
  var PROJECT_KEY = 'wb_cloud_project_v1';
  var UPLOAD_CACHE = {};
  var session = null;
  var projectId = null;

  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }
  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
  function configured() {
    return !!(CFG.url && CFG.key);
  }

  /* ---------------- session ---------------- */
  function persistSession(s) {
    session = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      user: { id: s.user && s.user.id, role: (s.user && s.user.role) || 'authenticated' }
    };
    lsSet(SESSION_KEY, session);
    return session;
  }

  function authHeaders(extra, useJson) {
    var h = { apikey: CFG.key };
    if (useJson !== false) h['Content-Type'] = 'application/json';
    if (session && session.access_token) h.Authorization = 'Bearer ' + session.access_token;
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  function anonAuthHeaders() {
    return {
      apikey: CFG.key,
      Authorization: 'Bearer ' + CFG.key,
      'Content-Type': 'application/json'
    };
  }

  function signUpAnon() {
    return fetch(CFG.url + '/auth/v1/signup', {
      method: 'POST',
      headers: anonAuthHeaders(),
      body: JSON.stringify({ data: {}, gotrue_meta_security: {} })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) {
        throw new Error('匿名登录失败 (' + r.status + ') ' + String(t).slice(0, 120));
      });
      return r.json().then(persistSession);
    });
  }

  function refreshSession() {
    if (session && session.refresh_token) {
      return fetch(CFG.url + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: anonAuthHeaders(),
        body: JSON.stringify({ refresh_token: session.refresh_token })
      }).then(function (r) {
        if (r.ok) return r.json().then(persistSession);
        return signUpAnon();
      }).catch(function () {
        return signUpAnon();
      });
    }
    return signUpAnon();
  }

  function ensureSession() {
    if (!configured()) return Promise.reject(new Error('云端未配置'));
    if (!session) session = lsGet(SESSION_KEY);
    if (session && session.access_token) {
      var exp = (session.expires_at || 0) * 1000;
      if (!exp || exp > Date.now() + 60000) return Promise.resolve(session);
    }
    return refreshSession();
  }

  function request(path, opts) {
    opts = opts || {};
    return ensureSession().then(function () {
      function once(retry) {
        return fetch(CFG.url + path, {
          method: opts.method || 'GET',
          headers: authHeaders(opts.headers, opts.json),
          body: opts.body
        }).then(function (r) {
          if (r.status === 401 && retry) {
            return refreshSession().then(function () { return once(false); });
          }
          return r;
        });
      }
      return once(true);
    });
  }

  function readJson(r) {
    return r.text().then(function (t) {
      if (!t) return null;
      try { return JSON.parse(t); } catch (e) { return null; }
    });
  }

  function fail(r, label) {
    return readJson(r).then(function (body) {
      var extra = body && (body.message || body.error_description || body.msg);
      throw new Error(label + '失败 (' + r.status + ')' + (extra ? '：' + String(extra).slice(0, 120) : ''));
    });
  }

  /* ---------------- project ---------------- */
  function getProjectId() {
    if (projectId) return projectId;
    projectId = lsGet(PROJECT_KEY);
    return projectId || null;
  }

  function setProjectId(id) {
    projectId = id;
    lsSet(PROJECT_KEY, id);
    return id;
  }

  function clearProject() {
    projectId = null;
    lsDel(PROJECT_KEY);
    for (var k in UPLOAD_CACHE) { if (UPLOAD_CACHE.hasOwnProperty(k)) delete UPLOAD_CACHE[k]; }
  }

  function createProject(title, data) {
    return request('/rest/v1/projects', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ title: title || 'My iPhone', data: data || {} })
    }).then(function (r) {
      if (!r.ok) return fail(r, '创建作品');
      return readJson(r).then(function (rows) {
        if (!rows || !rows[0]) throw new Error('创建作品失败：没有返回数据');
        return rows[0];
      });
    });
  }

  function ensureProject(title) {
    var id = getProjectId();
    if (id) return Promise.resolve(id);
    return createProject(title, {}).then(function (row) {
      return setProjectId(row.id);
    });
  }

  function loadProject(id) {
    return request('/rest/v1/projects?id=eq.' + encodeURIComponent(id)
      + '&select=id,title,data,published_at').then(function (r) {
      if (!r.ok) return null;
      return readJson(r).then(function (rows) {
        return rows && rows[0] ? rows[0] : null;
      });
    }).catch(function () { return null; });
  }

  function saveDraft(data, title) {
    return prepareData(data).then(function (prepared) {
      return ensureProject(title).then(function (id) {
        return request('/rest/v1/projects?id=eq.' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ title: title || 'My iPhone', data: prepared })
        }).then(function (r) {
          if (!r.ok) return fail(r, '保存');
          return readJson(r).then(function (rows) {
            if (rows && rows.length) return { id: id, data: prepared, row: rows[0] };
            clearProject();
            return createProject(title, prepared).then(function (row) {
              setProjectId(row.id);
              return { id: row.id, data: prepared, row: row };
            });
          });
        });
      });
    });
  }

  function publish(data, title) {
    return prepareData(data).then(function (prepared) {
      return ensureProject(title).then(function (id) {
        var now = new Date().toISOString();
        return request('/rest/v1/projects?id=eq.' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            title: title || 'My iPhone',
            data: prepared,
            published_data: prepared,
            published_at: now
          })
        }).then(function (r) {
          if (!r.ok) return fail(r, '发布');
          return { id: id, published_at: now, data: prepared };
        });
      });
    });
  }

  /* ---------------- media ---------------- */
  function extFor(type, name) {
    var map = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
      'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/ogg': 'ogg'
    };
    if (map[type]) return map[type];
    var m = String(name || '').match(/\.([a-z0-9]{2,5})$/i);
    return m ? m[1].toLowerCase() : 'bin';
  }

  function uploadBlob(blob, name) {
    if (blob.size > 10 * 1024 * 1024) {
      return Promise.reject(new Error('单个文件不能超过 10MB'));
    }
    return ensureSession().then(function () {
      var uid = session.user.id;
      var ext = extFor(blob.type, name);
      var id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      var path = uid + '/media/' + id + '.' + ext;
      return request('/storage/v1/object/media/' + path, {
        method: 'POST',
        json: false,
        headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true' },
        body: blob
      }).then(function (r) {
        if (!r.ok) return fail(r, '上传');
        return CFG.url + '/storage/v1/object/public/media/' + path;
      });
    });
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

  /* Replace IndexedDB refs (idb:...) with public Storage URLs. */
  function prepareData(data) {
    var pending = {};
    var seen = {};
    var total = 0;
    var staged = mapStrings(data, function (s) {
      if (s.indexOf('idb:') !== 0) return s;
      var mid = s.slice(4);
      var m = window.WB && WB.media ? WB.media[mid] : null;
      if (!m) return s;
      if (!seen[mid]) {
        seen[mid] = true;
        total += m.blob.size;
        if (total > 20 * 1024 * 1024) throw new Error('图片和音乐总大小不能超过 20MB');
      }
      var key = mid;
      if (!UPLOAD_CACHE[key]) {
        if (!pending[key]) {
          pending[key] = uploadBlob(m.blob, m.name).then(function (url) {
            UPLOAD_CACHE[key] = url;
            return url;
          });
        }
      }
      return s;
    });
    var jobs = {};
    Object.keys(pending).forEach(function (k) { jobs[k] = true; });
    return Promise.all(Object.keys(jobs).map(function (k) { return pending[k]; })).then(function () {
      return mapStrings(staged, function (s) {
        if (s.indexOf('idb:') === 0) {
          return UPLOAD_CACHE[s.slice(4)] || s;
        }
        return s;
      });
    });
  }

  /* ---------------- public / shared ---------------- */
  function loadShared(id) {
    if (!configured()) return Promise.resolve(null);
    return fetch(CFG.url + '/rest/v1/rpc/get_shared_project', {
      method: 'POST',
      headers: { apikey: CFG.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: id })
    }).then(function (r) {
      if (!r.ok) return null;
      return r.json().then(function (j) {
        return j && j.data ? j : null;
      });
    }).catch(function () { return null; });
  }

  function shareBase() {
    var base = CFG.site || (location.origin + location.pathname);
    base = base.replace(/[?#].*$/, '');
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return base;
  }

  function shareUrl(id) {
    return shareBase() + '?p=' + encodeURIComponent(id);
  }

  window.WBCloud = {
    configured: configured,
    ensureSession: ensureSession,
    projectId: getProjectId,
    setProjectId: setProjectId,
    clearProject: clearProject,
    loadProject: loadProject,
    saveDraft: saveDraft,
    publish: publish,
    loadShared: loadShared,
    prepareData: prepareData,
    uploadBlob: uploadBlob,
    shareUrl: shareUrl,
    userId: function () { return session && session.user ? session.user.id : null; }
  };
})();
