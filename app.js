/* =========================================================
   Fake phone · engine
   All content comes from data.js — this file is UI + logic only
   ========================================================= */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const screen = $('#screen');
  const canvas = $('#canvas');
  const lockL = $('#lockL'), pinL = $('#pinL'), homeL = $('#homeL'), appL = $('#appL');
  const statusbar = $('#statusbar'), homebar = $('#homebar');
  const wall = $('#wall'), islandText = $('#islandText');
  const callScreen = $('#callScreen'), callName = $('#callName'), callAvatar = $('#callAvatar');
  const callTag = $('#callTag'), callSub = $('#callSub'), callActions = $('#callActions');
  const callTimer = $('#callTimer');
  const viewer = $('#viewer'), viewerImg = $('#viewerImg'), viewerCap = $('#viewerCap');
  const toastEl = $('#toast');

  const D = window.DATA || {};

  /* ---------------- persisted settings ---------------- */
  /* Standalone share builds set this so their local state never mixes
     with the customizer's state in the same browser. */
  const STORE_PREFIX = window.WB_KEY_PREFIX || '';
  const SET_KEY = STORE_PREFIX + 'wb_settings';
  const SET = {
    airplane: false, wifi: true, bluetooth: true, dnd: false,
    notifications: true, brightness: 1, wallpaper: ''
  };
  try { Object.assign(SET, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { /* ignore */ }

  function saveSettings() {
    try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) { /* ignore */ }
  }

  /* notes are editable — keep them in localStorage */
  const NOTES_KEY = STORE_PREFIX + 'wb_notes';
  try {
    const rawNotes = localStorage.getItem(NOTES_KEY);
    if (rawNotes) {
      const arr = JSON.parse(rawNotes);
      if (Array.isArray(arr)) D.notes = arr;
    }
  } catch (e) { /* ignore */ }

  function saveNotes() {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(D.notes)); } catch (e) { /* ignore */ }
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function applySettings() {
    screen.style.filter = SET.brightness < 0.99 ? 'brightness(' + SET.brightness + ')' : '';
    if (SET.wallpaper) {
      D.wallpaper = SET.wallpaper;
      if (D.lock) D.lock.wallpaper = SET.wallpaper;
    }
    if (state.view !== 'lock') wall.style.backgroundImage = 'url(' + (D.wallpaper || '') + ')';
    statusbar.classList.toggle('airplane', !!SET.airplane);
    const g = document.querySelector('.sb3g');
    if (g) g.textContent = SET.airplane ? '✈' : '3G';
    renderLock();
  }

  const state = {
    view: 'lock', app: null, chat: 'you', chatOpen: false, compose: false,
    sent: 0, reply: 0, song: -1, playing: false,
    callActive: false, callOutgoing: false, callNumber: '', callSec: 0,
    note: -1, mail: -1, calSel: null,
    pinMode: null, pin: '', pinTemp: '', pendingChat: null,
    phoneTab: 'recents', dial: '', page: 0, setView: 'root',
    noteEdit: false,
    clockTab: 'world', swRun: false, swStart: 0, swAcc: 0,
    timerLeft: 0, timerRun: false, timerEnd: 0,
    calc: { display: '0', acc: null, op: null, fresh: true }
  };

  /* ---------------- canvas scaling ---------------- */
  function fitCanvas() {
    const scale = Math.min(screen.clientWidth / 393, screen.clientHeight / 852);
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.style.left = Math.max(0, (screen.clientWidth - 393 * scale) / 2) + 'px';
    canvas.style.top = Math.max(0, (screen.clientHeight - 852 * scale) / 2) + 'px';
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', fitCanvas);

  if (D.theme && D.theme.accent) {
    document.documentElement.style.setProperty('--accent', D.theme.accent);
    if (D.theme.accent2) document.documentElement.style.setProperty('--accent2', D.theme.accent2);
  }

  /* ---------------- time ---------------- */
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAYS_S = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const pad = (n) => String(n).padStart(2, '0');
  const clock12 = () => {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    return h + ':' + pad(d.getMinutes());
  };
  const ampmClock = () => {
    const d = new Date();
    return clock12() + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');
  };
  const dateEN = () => {
    const d = new Date();
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  };

  let dayStamp = new Date().toDateString();
  function tick() {
    $('#lockClock').textContent = clock12();
    $('#lockDate').textContent = dateEN();
    $('#sbTime').textContent = ampmClock();
    const now = new Date().toDateString();
    if (now !== dayStamp) {
      dayStamp = now;
      renderLock();
      renderHome();
    }
    if (state.app === 'clock') {
      document.querySelectorAll('[data-tz]').forEach((el) => {
        el.textContent = cityTime(el.dataset.tz);
      });
      const sw = document.getElementById('swDisp');
      if (sw) sw.textContent = fmtSw(swValue());
      if (state.timerRun) {
        state.timerLeft = Math.max(0, (state.timerEnd - Date.now()) / 1000);
        const td = document.getElementById('timerDisp');
        if (td) td.textContent = fmtTimer(state.timerLeft);
        if (state.timerLeft <= 0) {
          state.timerRun = false;
          beep();
          toast('Timer done');
          renderClock();
        }
      }
    }
  }
  tick();
  setInterval(tick, 1000);

  /* ---------------- chrome ---------------- */
  function setChrome(white) {
    statusbar.classList.toggle('light', white);
    statusbar.classList.toggle('dark', !white);
    homebar.classList.toggle('dark', !white);
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  /* ---------------- PIN ---------------- */
  const PIN_KEY = STORE_PREFIX + 'wb_pin';

  function currentPin() {
    try {
      const v = localStorage.getItem(PIN_KEY);
      if (v) return v;
    } catch (e) { /* ignore */ }
    return (D.lock && D.lock.pin) || '';
  }

  function savePin(p) {
    try { localStorage.setItem(PIN_KEY, p); } catch (e) { /* ignore */ }
    if (D.lock) D.lock.pin = p;
  }

  function openPin(mode) {
    state.pinMode = mode;
    state.pin = '';
    if (mode === 'set1') state.pinTemp = '';
    pinL.classList.add('show');
    drawPin();
  }

  function closePin() {
    pinL.classList.remove('show');
    state.pinMode = null;
    state.pin = '';
  }

  function drawPin() {
    const titles = {
      unlock: 'Enter Passcode',
      set1: 'New Passcode',
      set2: 'Re-enter Passcode'
    };
    $('#pinTitle').textContent = titles[state.pinMode] || '';
    $('#pinDots').innerHTML = [0, 1, 2, 3]
      .map((i) => `<i class="${i < state.pin.length ? 'on' : ''}"></i>`).join('');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'Del'];
    $('#keypad').innerHTML = keys.map((k) => k === ''
      ? '<span></span>'
      : `<button class="key" data-key="${k}">${k}</button>`).join('');
  }

  function pinComplete() {
    const entry = state.pin;
    if (state.pinMode === 'unlock') {
      if (entry === currentPin()) {
        const target = state.pendingChat;
        state.pendingChat = null;
        closePin();
        unlock(target);
      } else {
        shakePin();
      }
    } else if (state.pinMode === 'set1') {
      state.pinTemp = entry;
      state.pin = '';
      state.pinMode = 'set2';
      drawPin();
    } else if (state.pinMode === 'set2') {
      if (entry === state.pinTemp) {
        savePin(entry);
        closePin();
        toast('Passcode changed');
      } else {
        toast("Passcodes didn't match");
        state.pin = '';
        state.pinMode = 'set1';
        drawPin();
      }
    }
  }

  function shakePin() {
    pinL.animate([
      { transform: 'translateX(0)' }, { transform: 'translateX(-8px)' },
      { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }
    ], { duration: 260 });
    state.pin = '';
    setTimeout(drawPin, 120);
  }

  pinL.addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]');
    if (b) {
      const k = b.dataset.key;
      if (k === 'Del') {
        state.pin = state.pin.slice(0, -1);
      } else if (state.pin.length < 4) {
        state.pin += k;
      }
      drawPin();
      if (state.pin.length === 4) setTimeout(pinComplete, 120);
      return;
    }
    if (e.target.id === 'pinCancel') closePin();
  });

  /* ---------------- lock screen ---------------- */
  function renderLock() {
    wall.style.backgroundImage = 'url(' + ((D.lock && D.lock.wallpaper) || D.wallpaper || '') + ')';
    const show = SET.notifications && !SET.dnd;
    const list = show ? ((D.lock && D.lock.notifications) || []) : [];
    $('#noticeList').innerHTML = list.map((n) => `
      <div class="notice" data-notif="${esc(n.chat || '')}">
        <div class="nIcon">${esc(n.icon || '💬')}</div>
        <div class="nBody">
          <div class="nTop"><span>${esc(n.app || '')}</span><span>${esc(n.time || '')}</span></div>
          <div class="nTitle">${esc(n.title || '')}</div>
          <div class="nText">${esc(n.text || '')}</div>
        </div>
      </div>`).join('');
  }

  function tapLock(e) {
    const n = e && e.target.closest('[data-notif]');
    state.pendingChat = n ? (n.dataset.notif || 'you') : null;
    if (!currentPin()) {
      unlock(state.pendingChat);
      return;
    }
    openPin('unlock');
  }

  function unlock(targetChat) {
    if (state.view !== 'lock' && state.view !== 'pin') return;
    state.view = 'home';
    lockL.classList.add('hidden');
    pinL.classList.remove('show');
    homeL.classList.remove('hidden');
    wall.classList.remove('dim');
    wall.style.backgroundImage = 'url(' + (D.wallpaper || '') + ')';
    setChrome(true);
    if (targetChat) openApp('chat', targetChat);
  }

  let swipeY = null;
  lockL.addEventListener('pointerdown', (e) => { swipeY = e.clientY; });
  lockL.addEventListener('pointerup', (e) => {
    if (swipeY != null && swipeY - e.clientY > 30) { swipeY = null; tapLock(e); }
    swipeY = null;
  });
  lockL.addEventListener('click', (e) => { tapLock(e); });

  /* ---------------- home ---------------- */
  const ICONS = {
    chat:      { svg: ICON_SVG.chat,      name: 'Messages' },
    photos:    { svg: ICON_SVG.photos,    name: 'Photos' },
    music:     { svg: ICON_SVG.music,     name: 'Music' },
    notes:     { svg: ICON_SVG.notes,     name: 'Notes' },
    calendar:  { svg: ICON_SVG.calendar,  name: 'Calendar' },
    mail:      { svg: ICON_SVG.mail,      name: 'Mail' },
    phone:     { svg: ICON_SVG.phone,     name: 'Phone' },
    instagram: { svg: ICON_SVG.instagram, name: 'Instagram' },
    twitter:   { svg: ICON_SVG.twitter,   name: 'Twitter' },
    facebook:  { svg: ICON_SVG.facebook,  name: 'Facebook' },
    clock:     { svg: ICON_SVG.clock,     name: 'Clock' },
    calculator:{ svg: ICON_SVG.calculator,name: 'Calculator' },
    weather:   { svg: ICON_SVG.weather,   name: 'Weather' },
    settings:  { svg: ICON_SVG.settings,  name: 'Settings' }
  };
  const GRID = ['photos', 'music', 'notes', 'calendar', 'mail', 'phone', 'chat', 'instagram'];
  const GRID2 = ['twitter', 'facebook', 'clock', 'calculator', 'weather', 'settings'];
  const DOCK = ['chat', 'photos', 'music', 'phone'];

  function badgeFor(id) {
    if (id === 'chat') {
      return Object.values(D.unread || {}).reduce((a, b) => a + b, 0);
    }
    if (id === 'mail') return (D.mails || []).filter((m) => m.unread).length;
    if (id === 'phone') return (D.calls || []).filter((c) => c.type === 'missed' && !c.seen).length;
    return 0;
  }

  function appButton(id) {
    const ic = ICONS[id];
    const b = badgeFor(id);
    return `<button class="appIco" data-app="${id}">
      <span class="tile">${ic.svg()}</span>
      ${b ? `<span class="bdg">${b}</span>` : ''}
      <span class="lbl">${esc(ic.name)}</span>
    </button>`;
  }

  function renderWidget() {
    const now = new Date();
    const key = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    const evs = (D.events || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const next = evs.find((e) => e.date >= key);
    $('#homeWidget').innerHTML = `
      <div class="wDay">${now.getDate()}</div>
      <div class="wInfo">
        <b>${DAYS_S[now.getDay()]} · ${MONTHS[now.getMonth()]}</b>
        <span>${next ? esc(next.title) + (next.time ? ' · ' + esc(next.time) : '') : 'No events today'}</span>
      </div>`;

    const w = D.weather || { city: 'Seoul', temp: '18°', desc: 'Sunny', icon: '☀️' };
    $('#wWeather').innerHTML = `
      <div class="mwTop">${esc(w.city)}</div>
      <div class="mwTemp">${esc(w.temp)}</div>
      <div class="mwDesc">${esc(w.icon || '')} ${esc(w.desc || '')}</div>`;

    const s = (D.songs || [])[state.song >= 0 ? state.song : 0];
    $('#wMusic').innerHTML = s ? `
      <div class="mwTop">Recently played</div>
      <div class="mwFlex"><img src="${esc(s.cover)}" alt="">
        <div><div class="mwSong">${esc(s.title)}</div>
        <div class="mwDesc">${esc(s.artist || '')}</div></div></div>` : '';
  }

  function renderP2() {
    const photos = [];
    (D.photos || []).forEach((sec) => sec.items.forEach((p) => photos.push(p)));
    $('#p2Photos').innerHTML = '<div class="p2Title">Photos</div><div class="p2Photos">'
      + photos.slice(0, 4).map((p) => `<img src="${esc(p.src)}" data-full="${esc(p.src)}" data-cap="${esc(p.cap || '')}" alt="">`).join('')
      + '</div>';

    const now = new Date();
    const key = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    const evs = (D.events || []).filter((e) => e.date >= key)
      .sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 3);
    $('#p2Today').innerHTML = '<div class="p2Title">Upcoming</div>' + (evs.length
      ? evs.map((e) => `<div class="p2Event"><div class="t">${esc(e.time || '')}</div>
          <div><b>${esc(e.title)}</b><span>${esc(e.place || '')}</span></div></div>`).join('')
      : '<div class="p2Note"><span>Nothing scheduled</span></div>');

  }

  function setPage(i, animate) {
    state.page = Math.max(0, Math.min(1, i));
    const track = $('#pagesTrack');
    if (!track) return;
    if (animate === false) {
      track.style.transition = 'none';
      setTimeout(() => { track.style.transition = ''; }, 30);
    }
    track.classList.toggle('p2', state.page === 1);
    document.querySelectorAll('#pageDots i').forEach((d, k) => {
      d.classList.toggle('on', k === state.page);
    });
  }

  function renderHome() {
    renderWidget();
    $('#homeGrid').innerHTML = GRID.map(appButton).join('');
    $('#page2Grid').innerHTML = GRID2.map(appButton).join('');
    $('#dock').innerHTML = DOCK.map(appButton).join('');
    renderP2();
    setPage(state.page, false);
  }

  document.getElementById('homebar').addEventListener('click', () => {
    if (state.view === 'app') closeApp();
  });

  let suppressClick = false;
  let swipeX = null, swipeDX = 0;

  homeL.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    const img = e.target.closest('img[data-full]');
    if (img) { showViewer(img.dataset.full, img.dataset.cap || ''); return; }
    const b = e.target.closest('[data-app]');
    if (b) openApp(b.dataset.app);
  });

  homeL.addEventListener('pointerdown', (e) => { swipeX = e.clientX; swipeDX = 0; });
  homeL.addEventListener('pointermove', (e) => { if (swipeX != null) swipeDX = e.clientX - swipeX; });
  homeL.addEventListener('pointerup', () => {
    if (swipeX != null && Math.abs(swipeDX) > 40) {
      setPage(state.page + (swipeDX < 0 ? 1 : -1));
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 360);
    }
    swipeX = null;
  });

  document.getElementById('pageDots').addEventListener('click', (e) => {
    const d = e.target.closest('[data-page]');
    if (d) setPage(Number(d.dataset.page));
  });

  /* ---------------- app framework ---------------- */
  const LIGHT_UI = {
    photos: true, music: true, instagram: true, twitter: true,
    facebook: true, clock: true, calculator: true, weather: true
  };

  function openApp(id, arg) {
    if (state.view !== 'home') return;
    state.app = id;
    state.view = 'app';
    state.compose = false;
    state.phoneTab = 'recents';
    state.setView = 'root';
    if (id === 'chat') {
      state.chatOpen = !!arg;
      if (arg) {
        state.chat = arg;
        state.sent = 0;
        state.reply = 0;
        if (D.unread) D.unread[arg] = 0;
        if (D.lock && D.lock.notifications) {
          D.lock.notifications = D.lock.notifications.filter((n) => n.chat !== arg);
          renderLock();
        }
      }
    }
    renderApp(id);
    appL.classList.add('show');
    setChrome(!!LIGHT_UI[id]);
  }

  function closeApp() {
    appL.classList.remove('show');
    appL.innerHTML = '';
    state.view = 'home';
    state.app = null;
    state.chatOpen = false;
    state.compose = false;
    state.note = -1;
    state.mail = -1;
    setChrome(true);
    setTimeout(() => { if (state.view === 'home') renderHome(); }, 30);
  }

  function appShell(title, sub, opts) {
    opts = opts || {};
    return `<div class="app ${opts.dark ? 'dark' : ''}">
      <div class="appHeader">
        <button class="backBtn" data-back="1">‹</button>
        ${opts.avatar ? `<img class="headAvatar" src="${esc(opts.avatar)}" alt="">` : ''}
        <div class="appTitle"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>
        ${opts.right || ''}
      </div>
      <div class="content ${opts.cls || ''}" id="appContent">${opts.body || ''}</div>
      ${opts.after || ''}
    </div>`;
  }

  function renderApp(id) {
    if (id === 'chat') return renderChatApp();
    if (id === 'photos') return renderPhotos();
    if (id === 'music') return renderMusic();
    if (id === 'notes') return renderNotes();
    if (id === 'calendar') return renderCalendar();
    if (id === 'mail') return renderMail();
    if (id === 'phone') return renderPhone();
    if (id === 'clock') return renderClock();
    if (id === 'calculator') return renderCalculator();
    if (id === 'weather') return renderWeather();
    if (id === 'instagram') return renderInstagram();
    if (id === 'twitter') return renderTwitter();
    if (id === 'facebook') return renderFacebook();
    if (id === 'settings') return renderSettings();
  }

  function goBack() {
    if (state.app === 'notes' && state.noteEdit) {
      state.noteEdit = false;
      renderNotes();
      return;
    }
    if (state.app === 'settings' && state.setView !== 'root') {
      state.setView = 'root';
      renderSettings();
      return;
    }
    if (state.app === 'chat' && state.compose) { state.compose = false; renderChatApp(); return; }
    if (state.app === 'chat' && state.chatOpen) { state.chatOpen = false; renderChatApp(); return; }
    if (state.app === 'notes' && state.note >= 0) { state.note = -1; renderNotes(); return; }
    if (state.app === 'mail' && state.mail >= 0) { state.mail = -1; renderMail(); return; }
    closeApp();
  }

  appL.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) { goBack(); return; }

    const tgl = e.target.closest('[data-toggle]');
    if (tgl) {
      const k = tgl.dataset.toggle;
      SET[k] = !SET[k];
      saveSettings();
      applySettings();
      renderSettings();
      return;
    }

    const wallPick = e.target.closest('[data-wall]');
    if (wallPick) {
      SET.wallpaper = wallPick.dataset.wall;
      saveSettings();
      applySettings();
      renderWallpaper();
      toast('Wallpaper set');
      return;
    }

    const act = e.target.closest('[data-action]');
    if (act) {
      const a = act.dataset.action;
      if (a === 'compose') { state.compose = true; renderChatApp(); return; }
      if (a === 'changepin') { openPin('set1'); return; }
      if (a === 'newnote') {
        D.notes = D.notes || [];
        D.notes.unshift({ title: 'New Note', date: todayStr(), body: '' });
        saveNotes();
        state.note = 0;
        state.noteEdit = true;
        renderNotes();
        return;
      }
      if (a === 'editnote') { state.noteEdit = true; renderNotes(); return; }
      if (a === 'cancelnote') { state.noteEdit = false; renderNotes(); return; }
      if (a === 'savenote') {
        if (state.note >= 0 && D.notes[state.note]) {
          const t = document.getElementById('noteTitle');
          const b = document.getElementById('noteBody');
          D.notes[state.note] = {
            title: (t && t.value.trim()) || 'New Note',
            date: todayStr(),
            body: b ? b.value : ''
          };
          saveNotes();
        }
        state.noteEdit = false;
        renderNotes();
        return;
      }
      if (a === 'clocktab') { state.clockTab = act.dataset.tab; renderClock(); return; }
      if (a === 'swstart') { state.swStart = Date.now(); state.swRun = true; renderClock(); return; }
      if (a === 'swstop') {
        if (state.swRun) state.swAcc += Date.now() - state.swStart;
        state.swRun = false;
        renderClock();
        return;
      }
      if (a === 'swreset') { state.swAcc = 0; state.swRun = false; renderClock(); return; }
      if (a === 'timerset') {
        state.timerLeft = Number(act.dataset.min) * 60;
        state.timerRun = false;
        renderClock();
        return;
      }
      if (a === 'timerstart') {
        if (state.timerLeft <= 0) state.timerLeft = 300;
        state.timerEnd = Date.now() + state.timerLeft * 1000;
        state.timerRun = true;
        renderClock();
        return;
      }
      if (a === 'timerpause') {
        state.timerLeft = Math.max(0, (state.timerEnd - Date.now()) / 1000);
        state.timerRun = false;
        renderClock();
        return;
      }
      if (a === 'timerreset') { state.timerLeft = 0; state.timerRun = false; renderClock(); return; }
      if (a === 'wallpaper') { state.setView = 'wallpaper'; renderSettings(); return; }
      if (a === 'about') { state.setView = 'about'; renderSettings(); return; }
      if (a === 'resetsettings') {
        try { localStorage.removeItem(SET_KEY); } catch (e) { /* ignore */ }
        toast('Settings reset');
        setTimeout(() => location.reload(), 700);
        return;
      }
      if (a === 'tabRecents') { state.phoneTab = 'recents'; renderPhone(); return; }
      if (a === 'tabKeypad') { state.phoneTab = 'keypad'; renderPhone(); return; }
      if (a === 'dialdel') { state.dial = state.dial.slice(0, -1); renderPhone(); return; }
      if (a === 'dialcall') { if (state.dial) startCall({ outgoing: true, number: state.dial }); return; }
      if (a === 'playpause') { togglePlay(); return; }
      if (a === 'next') { nextSong(1); return; }
      if (a === 'prev') { nextSong(-1); return; }
    }

    const alarmBtn = e.target.closest('[data-alarm]');
    if (alarmBtn) {
      const i = Number(alarmBtn.dataset.alarm);
      if (D.alarms && D.alarms[i]) {
        D.alarms[i].on = !D.alarms[i].on;
        renderClock();
      }
      return;
    }

    const calcKey = e.target.closest('[data-calc]');
    if (calcKey) { calcPress(calcKey.dataset.calc); return; }

    const digit = e.target.closest('[data-digit]');
    if (digit) {
      if (state.dial.length < 15) state.dial += digit.dataset.digit;
      renderPhone();
      return;
    }

    const chat = e.target.closest('[data-chat]');
    if (chat && state.app === 'chat') { openChat(chat.dataset.chat); return; }
    const song = e.target.closest('[data-song]');
    if (song) { playSong(Number(song.dataset.song)); return; }
    const note = e.target.closest('[data-note]');
    if (note) {
      state.note = Number(note.dataset.note);
      state.noteEdit = false;
      renderNotes();
      return;
    }
    const mail = e.target.closest('[data-mail]');
    if (mail) { state.mail = Number(mail.dataset.mail); renderMail(); return; }
    const day = e.target.closest('[data-day]');
    if (day) { state.calSel = Number(day.dataset.day); renderCalendar(); return; }
    const img = e.target.closest('#appContent img[data-full]');
    if (img) { showViewer(img.dataset.full, img.dataset.cap || ''); return; }
  });

  appL.addEventListener('input', (e) => {
    if (e.target.id === 'brightness') {
      SET.brightness = Number(e.target.value) / 100;
      saveSettings();
      applySettings();
    }
  });

  /* ---------------- chat ---------------- */
  function lastMsg(cid) {
    const arr = (D.chats && D.chats[cid]) || [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const m = arr[i];
      if (m.t !== 'date') return m.voice ? '[Voice]' : m.text;
    }
    return '';
  }

  function renderChatApp() {
    if (state.compose) {
      const rows = Object.keys(D.contacts || {}).map((cid) => {
        const c = D.contacts[cid];
        return `<button class="callRow" data-chat="${cid}">
          <img src="${esc(c.avatar)}" alt="">
          <div style="flex:1"><div class="cName">${esc(c.name)}</div>
          <div class="cMeta">${esc(c.status || '')}</div></div>
        </button>`;
      }).join('');
      appL.innerHTML = appShell('New Message', '', { body: rows });
      return;
    }
    if (!state.chatOpen) {
      const rows = Object.keys(D.contacts || {}).map((cid) => {
        const c = D.contacts[cid];
        const n = (D.unread && D.unread[cid]) || 0;
        return `<button class="callRow" data-chat="${cid}">
          <img src="${esc(c.avatar)}" alt="">
          <div style="flex:1;min-width:0">
            <div class="cName">${esc(c.name)}</div>
            <div class="cMeta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(lastMsg(cid))}</div>
          </div>
          <span class="cType">${n ? `<b style="color:#ff3b30">${n}</b>` : ''}</span>
        </button>`;
      }).join('');
      appL.innerHTML = appShell('Messages', '', {
        body: rows,
        right: '<button class="backBtn" data-action="compose" title="New message">✎</button>'
      });
    } else {
      renderChat(state.chat);
    }
  }

  function openChat(cid) {
    state.chat = cid;
    state.chatOpen = true;
    state.compose = false;
    state.sent = 0;
    state.reply = 0;
    if (D.unread) D.unread[cid] = 0;
    if (D.lock && D.lock.notifications) {
      D.lock.notifications = D.lock.notifications.filter((n) => n.chat !== cid);
      renderLock();
    }
    renderChat(cid);
  }

  function msgHTML(cid, m, c) {
    if (m.t === 'date') return `<div class="dateChip">${esc(m.text)}</div>`;
    const me = m.t === 'me';
    const av = me ? '' : `<img class="chatAvatar" src="${esc(c.avatar)}" alt="">`;
    if (m.voice) {
      return `<div class="chatRow ${me ? 'me' : 'them'}">${av}
        <div class="bubble"><div class="voice">
          <button data-voice="${esc(m.src)}">▶</button>
          <span class="bars"><i style="height:6px"></i><i style="height:12px"></i><i style="height:8px"></i><i style="height:14px"></i><i style="height:9px"></i></span>
          <span class="len">${esc(m.voice)}</span>
        </div></div></div>`;
    }
    return `<div class="chatRow ${me ? 'me' : 'them'}">${av}<div class="bubble">${esc(m.text)}</div></div>`;
  }

  function renderChat(cid) {
    const c = (D.contacts && D.contacts[cid]) || {
      name: 'Unknown', avatar: (D.owner && D.owner.avatar) || '', status: ''
    };
    const msgs = (D.chats && D.chats[cid]) || [];
    const body = '<div class="chatStack">' + msgs.map((m) => msgHTML(cid, m, c)).join('') + '</div>';
    appL.innerHTML = appShell(c.name, c.status || 'Online', {
      avatar: c.avatar,
      body,
      cls: 'chatContent',
      after: `<div class="chatInput">
        <input id="chatInput" placeholder="Message…" autocomplete="off">
        <button class="sendBtn" id="sendBtn">↑</button>
      </div>`
    });
    const input = $('#chatInput');
    const btn = $('#sendBtn');
    const send = () => sendChat();
    btn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    const sc = $('#appContent');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  function appendMsg(cid, kind, text) {
    const c = D.contacts[cid];
    const box = document.querySelector('.chatStack');
    const sc = $('#appContent');
    if (!box) return;
    box.insertAdjacentHTML('beforeend', msgHTML(cid, { t: kind, text }, c));
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  function showTyping() {
    const box = document.querySelector('.chatStack');
    const sc = $('#appContent');
    if (!box) return;
    const c = D.contacts[state.chat];
    box.insertAdjacentHTML('beforeend',
      `<div class="chatRow them" id="typingRow"><img class="chatAvatar" src="${esc(c.avatar)}" alt="">
        <div class="typingRow"><i></i><i></i><i></i></div></div>`);
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  function hideTyping() {
    const t = $('#typingRow');
    if (t) t.remove();
  }

  function sendChat() {
    const input = $('#chatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    state.sent += 1;
    appendMsg(state.chat, 'me', text);

    const script = (D.liveScript && D.liveScript[state.chat]) || [];
    if (script.length) {
      const reply = script[Math.min(state.reply, script.length - 1)];
      state.reply += 1;
      setTimeout(() => {
        showTyping();
        setTimeout(() => { hideTyping(); appendMsg(state.chat, 'them', reply); }, 1300);
      }, 500);
    }

    const call = D.call || {};
    if (call.afterMessages && state.sent === call.afterMessages && state.chat === (call.contact || 'you')) {
      setTimeout(() => startCall({}), 1800);
    }
  }

  appL.addEventListener('click', (e) => {
    const v = e.target.closest('[data-voice]');
    if (v) {
      const a = new Audio(v.dataset.voice);
      a.play().catch(() => {});
    }
  });

  /* ---------------- photos ---------------- */
  function renderPhotos() {
    const body = (D.photos || []).map((sec) => `
      <div class="monthTitle">${esc(sec.month)}</div>
      <div class="photoGrid">${sec.items.map((p) => `
        <img src="${esc(p.src)}" data-full="${esc(p.src)}" data-cap="${esc(p.cap || '')}" alt="">`).join('')}</div>`).join('');
    appL.innerHTML = appShell('Photos', '', { dark: true, body, cls: 'photosContent' });
  }

  function showViewer(src, cap) {
    viewerImg.src = src;
    viewerCap.textContent = cap || '';
    viewer.classList.add('show');
  }
  $('#viewerClose').addEventListener('click', () => viewer.classList.remove('show'));
  viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.classList.remove('show'); });

  /* ---------------- music ---------------- */
  const audio = new Audio();
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('ended', () => nextSong(1));
  audio.addEventListener('play', () => { state.playing = true; syncPlaying(); });
  audio.addEventListener('pause', () => { state.playing = false; syncPlaying(); });

  function curSong() { return (D.songs || [])[state.song]; }

  function renderMusic() {
    const songs = D.songs || [];
    if (state.song < 0 && songs.length) state.song = 0;
    const s = curSong();
    const hero = s ? `
      <div class="hero ${state.playing ? 'heroPlaying' : ''}">
        <img class="heroCover" src="${esc(s.cover)}" alt="">
        <div class="heroTitle">${esc(s.title)}</div>
        <div class="heroArtist">${esc(s.artist || '')}</div>
        <div class="heroBar"><i id="heroBar"></i></div>
        <div class="heroBtns">
          <button data-action="prev">⏮</button>
          <button class="play" data-action="playpause">${state.playing ? '❚❚' : '▶'}</button>
          <button data-action="next">⏭</button>
        </div>
      </div>` : '';
    const list = songs.map((x, i) => `
      <button class="songRow ${i === state.song ? 'on' : ''}" data-song="${i}">
        <img src="${esc(x.cover)}" alt="">
        <span><span class="sT">${esc(x.title)}</span><span class="sA">${esc(x.artist || '')}</span></span>
      </button>`).join('');
    appL.innerHTML = appShell('Music', '', { dark: true, body: hero + list, cls: 'musicContent' });
    updateProgress();
  }

  function playSong(i) {
    const songs = D.songs || [];
    if (!songs[i]) return;
    const same = (i === state.song) && !audio.paused;
    state.song = i;
    audio.src = songs[i].src;
    audio.play().catch(() => {});
    renderMusic();
    if (same) audio.pause();
  }

  function togglePlay() {
    const s = curSong();
    if (!s) return;
    if (!audio.src) audio.src = s.src;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
    renderMusic();
  }

  function nextSong(dir) {
    const songs = D.songs || [];
    if (!songs.length) return;
    const i = ((state.song + dir) % songs.length + songs.length) % songs.length;
    playSong(i);
  }

  function updateProgress() {
    const bar = $('#heroBar');
    if (bar && audio.duration) bar.style.width = (audio.currentTime / audio.duration * 100) + '%';
  }

  function syncPlaying() {
    const on = state.playing && !!curSong();
    if (islandText) islandText.textContent = on ? curSong().title : '';
    const hero = document.querySelector('.hero');
    if (hero) hero.classList.toggle('heroPlaying', state.playing);
    const playBtn = document.querySelector('.heroBtns .play');
    if (playBtn) playBtn.textContent = state.playing ? '❚❚' : '▶';
  }

  /* ---------------- notes ---------------- */
  function renderNotes() {
    if (state.noteEdit && state.note >= 0) {
      const n = D.notes[state.note];
      appL.innerHTML = appShell('Edit Note', '', {
        body: `<div class="noteEdit">
          <input id="noteTitle" value="${esc(n.title)}" placeholder="Title">
          <textarea id="noteBody" placeholder="Write something...">${esc(n.body)}</textarea>
          <div class="noteEditBar">
            <button data-action="cancelnote">Cancel</button>
            <button class="save" data-action="savenote">Save</button>
          </div>
        </div>`
      });
      return;
    }
    if (state.note >= 0) {
      const n = D.notes[state.note];
      appL.innerHTML = appShell(n.title, n.date, {
        body: `<div class="noteDetail"><div class="noteMeta">${esc(n.date)}</div>${esc(n.body)}</div>`,
        right: '<button class="backBtn" data-action="editnote" style="font-size:14px">Edit</button>'
      });
      return;
    }
    const rows = (D.notes || []).map((n, i) => `
      <button class="noteRow" data-note="${i}">
        <b>${esc(n.title)}</b><span>${esc((n.body || '').split('\n')[0])}</span>
      </button>`).join('');
    appL.innerHTML = appShell('Notes', (D.notes || []).length + ' notes', {
      body: rows,
      right: '<button class="backBtn" data-action="newnote" style="font-size:22px">＋</button>'
    });
  }

  /* ---------------- calendar ---------------- */
  function renderCalendar() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (state.calSel == null) state.calSel = now.getDate();

    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const evMap = {};
    (D.events || []).forEach((e) => {
      if (!evMap[e.date]) evMap[e.date] = [];
      evMap[e.date].push(e);
    });
    const todayKey = y + '-' + pad(m + 1) + '-' + pad(now.getDate());

    let cells = '';
    DAYS_S.forEach((d) => { cells += `<div class="calDow">${d}</div>`; });
    for (let i = 0; i < first; i++) cells += '<div class="calCell out"></div>';
    for (let d = 1; d <= days; d++) {
      const key = y + '-' + pad(m + 1) + '-' + pad(d);
      const cls = ['calCell'];
      if (key === todayKey) cls.push('today');
      if (d === state.calSel) cls.push('sel');
      if (evMap[key]) cls.push('dot');
      cells += `<div class="${cls.join(' ')}" data-day="${d}">${d}</div>`;
    }

    const selKey = y + '-' + pad(m + 1) + '-' + pad(state.calSel);
    const evs = evMap[selKey] || [];
    const evHTML = evs.length ? evs.map((e) => `
      <div class="ev"><div class="t">${esc(e.time || '')}</div>
        <div class="b"><b>${esc(e.title)}</b><span>${esc(e.place || '')}</span></div></div>`).join('')
      : '<div class="ev"><div class="b"><span>No events today</span></div></div>';

    appL.innerHTML = appShell('Calendar', '', {
      body: `<div class="calContent">
        <div class="calMonth">${MONTHS[m]} ${y}</div>
        <div class="calGrid">${cells}</div>
        <div class="events">${evHTML}</div>
      </div>`
    });
  }

  /* ---------------- mail ---------------- */
  function renderMail() {
    if (state.mail >= 0) {
      const m = D.mails[state.mail];
      m.unread = false;
      appL.innerHTML = appShell(m.subject, m.from + ' · ' + m.date, {
        body: `<div class="mailBody">${esc(m.body)}</div>`
      });
      return;
    }
    // opening the list marks everything read (badge clears); dots use a snapshot
    const snap = (D.mails || []).map((m) => !!m.unread);
    const rows = (D.mails || []).map((m, i) => `
      <button class="mailRow" data-mail="${i}">
        <b>${snap[i] ? '<span class="udot"></span>' : ''}${esc(m.from)}<span class="dt">${esc(m.date)}</span></b>
        <div class="sub">${esc(m.subject)}</div>
        <div class="pre">${esc((m.body || '').split('\n')[0])}</div>
      </button>`).join('');
    appL.innerHTML = appShell('Mail', '', { body: rows });
    (D.mails || []).forEach((m) => { m.unread = false; });
  }

  /* ---------------- phone ---------------- */
  function renderPhone() {
    const isKeypad = state.phoneTab === 'keypad';
    const right = `<button class="backBtn" data-action="${isKeypad ? 'tabRecents' : 'tabKeypad'}"
      style="font-size:19px">${isKeypad ? '🕘' : '⌨'}</button>`;

    if (isKeypad) {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
      const body = `<div class="dialWrap">
        <div class="dialNum">${esc(state.dial || ' ')}</div>
        <div class="dialPad">${keys.map((k) => `<button class="dialKey" data-digit="${k}">${k}</button>`).join('')}</div>
        <div class="dialActions">
          <button class="dialDel" data-action="dialdel">Del</button>
          <button class="dialCall" data-action="dialcall">Call</button>
        </div>
      </div>`;
      appL.innerHTML = appShell('Phone', '', { body, right });
      return;
    }

    const missed = (D.calls || []).filter((c) => c.type === 'missed' && !c.seen);
    const rows = (D.calls || []).map((c) => {
      let name, avatar;
      if (c.contact && D.contacts[c.contact]) {
        name = D.contacts[c.contact].name;
        avatar = D.contacts[c.contact].avatar;
      } else {
        name = c.number || 'Unknown';
        avatar = (D.owner || {}).avatar || '';
      }
      const type = c.type === 'missed' ? 'Missed' : c.type === 'in' ? 'Incoming' : 'Outgoing';
      return `<div class="callRow ${c.type === 'missed' ? 'missed' : ''}">
        <img src="${esc(avatar)}" alt="">
        <div style="flex:1"><div class="cName">${esc(name)}</div>
        <div class="cMeta">${esc(c.time)}${c.dur ? ' · ' + esc(c.dur) : ''}</div></div>
        <span class="cType">${type}</span>
      </div>`;
    }).join('');
    appL.innerHTML = appShell('Phone', '', { body: rows, right });
    missed.forEach((c) => { c.seen = true; });
  }

  /* ---------------- social ---------------- */
  /* ---------------- Instagram 2011 ---------------- */
  function renderInstagram() {
    const ig = (D.social || {}).instagram || {};
    const posts = (ig.photos || []).slice(0, 6).map((ph, i) => `
      <div class="igPost">
        <div class="igHead"><img src="${esc(ig.avatar)}" alt="">
          <b>${esc((ig.handle || '').replace('@', ''))}</b><span>${i + 1}d</span></div>
        <img class="igPhoto" src="${esc(ph)}" data-full="${esc(ph)}" data-cap="" alt="">
        <div class="igActs"><span>♥</span><span>💬</span></div>
        <div class="igLikes">${(1200 + i * 347).toLocaleString()} likes</div>
      </div>`).join('');
    appL.innerHTML = `<div class="app ig2011">
      <div class="igTop">
        <button class="backBtn" data-back="1">‹</button>
        <span class="igLogo">Instagram</span>
        <span class="igCam">📷</span>
      </div>
      <div class="content igFeed">${posts}</div>
      <div class="igTabs"><span class="on">⌂</span><span>🔥</span><span>📷</span><span>👤</span></div>
    </div>`;
  }

  /* ---------------- Twitter 2011 ---------------- */
  function renderTwitter() {
    const tw = (D.social || {}).twitter || {};
    const tweets = (tw.tweets || []).map((t) => `
      <div class="twTweet">
        <img class="twAvatar" src="${esc(tw.avatar)}" alt="">
        <div style="flex:1;min-width:0">
          <div class="twHead"><b>${esc(tw.name)}</b> <span>${esc(tw.handle)} · ${esc(t.time)}</span></div>
          <div class="twText">${esc(t.text)}</div>
          <div class="twActions"><span>Reply</span><span>Retweet</span><span>Favorite</span></div>
        </div>
      </div>`).join('');
    appL.innerHTML = `<div class="app tw2011">
      <div class="tw2011Top">
        <button class="backBtn" data-back="1">‹</button>
        <span class="twLogo">twitter</span>
        <nav class="tw2011Nav"><b>Home</b><span>Connect</span><span>Discover</span><span>Me</span></nav>
        <span class="tw2011Search">Search</span>
      </div>
      <div class="content">
        <div class="twCompose">
          <div class="twComposePh">What's happening?</div>
          <button class="twTweetBtn">Tweet</button>
        </div>
        ${tweets}
      </div>
    </div>`;
  }

  /* ---------------- Facebook 2011 ---------------- */
  function renderFacebook() {
    const fb = (D.social || {}).facebook || {};
    const posts = (fb.posts || []).map((p) => `
      <div class="fbPost">
        <div class="fbWho"><img src="${esc(fb.avatar)}" alt="">
          <div><b>${esc(fb.name)}</b> <span>${esc(p.time)}</span></div></div>
        <div class="fbText">${esc(p.text)}</div>
        <div class="fbActions">Like · Comment · Share</div>
      </div>`).join('');
    appL.innerHTML = `<div class="app fb2011">
      <div class="fbTop">
        <button class="backBtn" data-back="1">‹</button>
        <span class="fbLogo">facebook</span>
        <span class="fbSearch">Search</span>
      </div>
      <div class="content"><div class="fbWall">${posts}</div></div>
    </div>`;
  }

  /* ---------------- Clock ---------------- */
  const CITIES = [
    ['Seoul', 'Asia/Seoul'], ['New York', 'America/New_York'],
    ['London', 'Europe/London'], ['Tokyo', 'Asia/Tokyo']
  ];

  function cityOffset(tz) {
    try {
      const f = (zone) => Number(new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hour: '2-digit', hourCycle: 'h23'
      }).format(new Date()));
      let d = f(tz) - f(Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (d > 12) d -= 24;
      if (d < -12) d += 24;
      return d;
    } catch (e) { return 0; }
  }

  function cityTime(tz) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).format(new Date());
    } catch (e) { return '--:--'; }
  }

  function fmtSw(ms) {
    const total = Math.max(0, ms);
    const m = Math.floor(total / 60000);
    const s = Math.floor((total % 60000) / 1000);
    const cs = Math.floor((total % 1000) / 10);
    return pad(m) + ':' + pad(s) + '.' + pad(cs);
  }

  function fmtTimer(sec) {
    const total = Math.max(0, Math.ceil(sec));
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  }

  function swValue() {
    return state.swAcc + (state.swRun ? Date.now() - state.swStart : 0);
  }

  function beep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const a = new AC();
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.12;
      o.connect(g).connect(a.destination);
      o.start();
      setTimeout(() => { try { o.stop(); a.close(); } catch (e) { /* ignore */ } }, 450);
    } catch (e) { /* ignore */ }
  }

  function renderClock() {
    const tab = state.clockTab;
    let body = '';
    if (tab === 'world') {
      body = CITIES.map((c) => `<div class="wcRow">
        <div><div class="wcCity">${c[0]}</div>
          <div class="wcOff">Today, ${cityOffset(c[1]) >= 0 ? '+' : ''}${cityOffset(c[1])} HR</div></div>
        <div class="wcTime" data-tz="${c[1]}">${cityTime(c[1])}</div></div>`).join('');
    } else if (tab === 'alarm') {
      body = (D.alarms || []).map((a, i) => `<div class="alarmRow">
        <div><div class="alarmTime">${esc(a.time)}</div>
          <div class="alarmLbl">${esc(a.label)}</div></div>
        <button class="switch ${a.on ? 'on' : ''}" data-alarm="${i}"></button></div>`).join('');
    } else if (tab === 'stopwatch') {
      body = `<div class="swDisplay" id="swDisp">${fmtSw(swValue())}</div>
        <div class="clockBtns">
          <button class="cBtn ${state.swRun ? 'red' : 'green'}"
            data-action="${state.swRun ? 'swstop' : 'swstart'}">${state.swRun ? 'Stop' : 'Start'}</button>
          <button class="cBtn" data-action="swreset">Reset</button>
        </div>`;
    } else {
      body = `<div class="swDisplay" id="timerDisp">${fmtTimer(state.timerLeft)}</div>
        <div class="timerPresets">
          <button data-action="timerset" data-min="1">1 min</button>
          <button data-action="timerset" data-min="5">5 min</button>
          <button data-action="timerset" data-min="10">10 min</button>
        </div>
        <div class="clockBtns">
          <button class="cBtn ${state.timerRun ? 'red' : 'green'}"
            data-action="${state.timerRun ? 'timerpause' : 'timerstart'}">${state.timerRun ? 'Pause' : 'Start'}</button>
          <button class="cBtn" data-action="timerreset">Reset</button>
        </div>`;
    }
    const tabs = [['world', '🌐', 'World'], ['alarm', '⏰', 'Alarm'],
      ['stopwatch', '⏱', 'Stopwatch'], ['timer', '⏳', 'Timer']];
    appL.innerHTML = `<div class="app clockApp">
      <div class="appHeader" style="border-color:#222">
        <button class="backBtn" data-back="1" style="color:#ff9f0a">‹</button>
        <div class="appTitle" style="color:#fff"><b>Clock</b></div>
      </div>
      <div class="content" style="padding-bottom:86px">${body}</div>
      <div class="clockTabs">${tabs.map((t) => `
        <button class="clockTab ${tab === t[0] ? 'on' : ''}" data-action="clocktab" data-tab="${t[0]}">
          <i>${t[1]}</i>${t[2]}</button>`).join('')}</div>
    </div>`;
  }

  /* ---------------- Calculator ---------------- */
  function calcDo(a, b, op) {
    if (op === '+') return a + b;
    if (op === '−') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? 0 : a / b;
    return b;
  }

  function calcPress(k) {
    const c = state.calc;
    if (k === 'AC') {
      c.display = '0'; c.acc = null; c.op = null; c.fresh = true;
    } else if (k === '±') {
      c.display = c.display.charAt(0) === '-' ? c.display.slice(1) : '-' + c.display;
    } else if (k === '%') {
      c.display = String(parseFloat(c.display) / 100);
    } else if (k === '.') {
      if (c.fresh) { c.display = '0.'; c.fresh = false; }
      else if (c.display.indexOf('.') < 0) c.display += '.';
    } else if ('0123456789'.indexOf(k) >= 0) {
      if (c.fresh) { c.display = k; c.fresh = false; }
      else c.display = c.display === '0' ? k : c.display + k;
    } else if ('+−×÷'.indexOf(k) >= 0) {
      const v = parseFloat(c.display) || 0;
      if (c.op && !c.fresh) { c.acc = calcDo(c.acc, v, c.op); c.display = String(c.acc); }
      else c.acc = v;
      c.op = k; c.fresh = true;
    } else if (k === '=') {
      if (c.op) {
        c.acc = calcDo(c.acc, parseFloat(c.display) || 0, c.op);
        c.display = String(c.acc);
        c.op = null; c.fresh = true;
      }
    }
    if (c.display.length > 10) c.display = c.display.slice(0, 10);
    renderCalculator();
  }

  function renderCalculator() {
    const keys = [
      ['AC', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'],
      ['7', ''], ['8', ''], ['9', ''], ['×', 'op'],
      ['4', ''], ['5', ''], ['6', ''], ['−', 'op'],
      ['1', ''], ['2', ''], ['3', ''], ['+', 'op'],
      ['0', 'zero'], ['.', ''], ['=', 'op']
    ];
    appL.innerHTML = `<div class="app calcApp">
      <div class="appHeader" style="border-color:#222">
        <button class="backBtn" data-back="1" style="color:#ff9f0a">‹</button>
        <div class="appTitle" style="color:#fff"><b>Calculator</b></div>
      </div>
      <div class="content" style="display:flex;flex-direction:column">
        <div class="calcDisplay">${esc(state.calc.display)}</div>
        <div class="calcGrid">${keys.map((k) => `
          <button class="calcKey ${k[1]}" data-calc="${esc(k[0])}">${esc(k[0])}</button>`).join('')}</div>
      </div>
    </div>`;
  }

  /* ---------------- Weather ---------------- */
  function renderWeather() {
    const w = D.weather || {};
    const body = `
      <div class="wxHero">
        <div class="wxCity">${esc(w.city || '')}</div>
        <div class="wxTemp">${esc(w.temp || '')}</div>
        <div class="wxDesc">${esc(w.desc || '')}</div>
      </div>
      <div class="wxList">${(w.forecast || []).map((f) => `
        <div class="wxRow"><span class="d">${esc(f.day)}</span>
          <span class="i">${esc(f.icon)}</span>
          <span class="hi">${esc(f.hi)}</span><span class="lo">${esc(f.lo)}</span></div>`).join('')}</div>`;
    appL.innerHTML = `<div class="app weatherApp">
      <div class="appHeader" style="border-color:rgba(255,255,255,.2)">
        <button class="backBtn" data-back="1" style="color:#fff">‹</button>
        <div class="appTitle" style="color:#fff"><b>Weather</b></div>
      </div>
      <div class="content">${body}</div>
    </div>`;
  }

  /* ---------------- settings ---------------- */
  function renderSettings() {
    if (state.setView === 'wallpaper') return renderWallpaper();
    if (state.setView === 'about') return renderAbout();
    const o = D.owner || {};
    const tg = (k) => `<button class="switch ${SET[k] ? 'on' : ''}" data-toggle="${k}"></button>`;
    const body = `
      <div class="aboutWrap">
        <img src="${esc(o.avatar || '')}" alt="">
        <h2>${esc(o.name || '')} <span style="font-size:13px;color:#8e8e93">${esc(o.en || '')}</span></h2>
        <div class="sub">${esc(o.sub || '')}</div>
        <p>${esc(o.bio || '').replace(/\n/g, '<br>')}</p>
      </div>
      <div class="setGroupTitle">Connectivity</div>
      <div class="setCard">
        <div class="setRow"><span>Airplane Mode</span>${tg('airplane')}</div>
        <div class="setRow"><span>Wi-Fi</span><span class="dim">${SET.wifi ? 'MIN-5G' : 'Off'}</span>${tg('wifi')}</div>
        <div class="setRow"><span>Bluetooth</span>${tg('bluetooth')}</div>
      </div>
      <div class="setGroupTitle">Notifications</div>
      <div class="setCard">
        <div class="setRow"><span>Do Not Disturb</span>${tg('dnd')}</div>
        <div class="setRow"><span>Show on Lock Screen</span>${tg('notifications')}</div>
      </div>
      <div class="setGroupTitle">Display &amp; Brightness</div>
      <div class="setCard">
        <div class="setRow"><span>Brightness</span>
          <input type="range" id="brightness" min="40" max="100" value="${Math.round(SET.brightness * 100)}"></div>
        <button class="setRow" data-action="wallpaper"><span>Wallpaper</span><span class="chev">›</span></button>
      </div>
      <div class="setGroupTitle">Security</div>
      <div class="setCard">
        <button class="setRow" data-action="changepin"><span>Change Passcode</span><span class="chev">›</span></button>
      </div>
      <div class="setGroupTitle">General</div>
      <div class="setCard">
        <button class="setRow" data-action="about"><span>About</span><span class="chev">›</span></button>
        <button class="setRow" data-action="resetsettings"><span style="color:#ff3b30">Reset Settings</span></button>
      </div>`;
    appL.innerHTML = appShell('Settings', '', { body });
  }

  function renderWallpaper() {
    const WALLS = [
      { name: 'Droplets', src: 'assets/wallpaper_ios4.jpg' },
      { name: 'Midnight', src: 'assets/wallpaper.jpg' },
      { name: 'Blossom', src: 'assets/wallpaper_pastel.jpg' }
    ];
    const body = '<div class="wallGrid">' + WALLS.map((w) => `
      <button class="wallItem ${D.wallpaper === w.src ? 'on' : ''}" data-wall="${esc(w.src)}">
        <img src="${esc(w.src)}" alt=""><span>${esc(w.name)}</span>
      </button>`).join('') + '</div>';
    appL.innerHTML = appShell('Wallpaper', '', { body });
  }

  function renderAbout() {
    const o = D.owner || {};
    const body = `
      <div class="setCard" style="margin-top:14px">
        <div class="setRow"><span>Model</span><span class="dim">iPhone 4</span></div>
        <div class="setRow"><span>Version</span><span class="dim">1.0</span></div>
        <div class="setRow"><span>Owner</span><span class="dim">${esc(o.name || '')}</span></div>
        <div class="setRow"><span>Storage</span><span class="dim">16 GB</span></div>
      </div>`;
    appL.innerHTML = appShell('About', '', { body });
  }

  /* ---------------- calls ---------------- */
  let callIv = null;

  function beginTimer() {
    state.callSec = 0;
    callTimer.textContent = '00:00';
    if (callIv) clearInterval(callIv);
    callIv = setInterval(() => {
      state.callSec += 1;
      callTimer.textContent = pad(Math.floor(state.callSec / 60)) + ':' + pad(state.callSec % 60);
    }, 1000);
  }

  function startCall(opts) {
    opts = opts || {};
    if (state.callActive) return;
    const c = D.call || {};
    state.callActive = true;
    state.callOutgoing = !!opts.outgoing;
    state.callNumber = opts.number || '';
    callName.textContent = opts.number || opts.name || c.name || 'Unknown';
    if (opts.outgoing || !c.avatar) {
      callAvatar.style.display = 'none';
    } else {
      callAvatar.style.display = 'block';
      callAvatar.src = c.avatar;
    }
    callTag.textContent = opts.outgoing ? 'Calling…' : 'Incoming call';
    callSub.textContent = opts.outgoing ? '' : 'Mobile';
    callTimer.textContent = '';
    callActions.innerHTML = opts.outgoing
      ? '<button class="callBtn decline" id="btnHangup"><span>✕</span><em>End</em></button>'
      : `<button class="callBtn decline" id="btnDecline"><span>✕</span><em>Decline</em></button>
         <button class="callBtn accept" id="btnAccept"><span>📞</span><em>Accept</em></button>`;
    if (opts.outgoing) {
      $('#btnHangup').onclick = hangup;
    } else {
      $('#btnDecline').onclick = declineCall;
      $('#btnAccept').onclick = acceptCall;
    }
    callScreen.classList.add('show');
    setChrome(true);
    if (opts.outgoing) {
      setTimeout(() => {
        if (!state.callActive) return;
        callTag.textContent = 'Call';
        beginTimer();
      }, 2500);
    }
  }

  function acceptCall() {
    callTag.textContent = 'Call';
    callSub.textContent = '';
    callActions.innerHTML = '<button class="callBtn decline" id="btnHangup"><span>✕</span><em>End</em></button>';
    $('#btnHangup').onclick = hangup;
    beginTimer();
  }

  function endCallUI() {
    callScreen.classList.remove('show');
    state.callActive = false;
    if (callIv) { clearInterval(callIv); callIv = null; }
    callActions.innerHTML = '';
    setChrome(state.app ? !!LIGHT_UI[state.app] : true);
  }

  function addCall(rec) {
    D.calls = D.calls || [];
    D.calls.unshift(rec);
    if (state.app === 'phone') renderPhone();
  }

  function declineCall() {
    const c = D.call || {};
    endCallUI();
    addCall({ contact: c.contact || 'you', type: 'missed', time: 'Just now', dur: '', seen: false });
  }

  function hangup() {
    const dur = pad(Math.floor(state.callSec / 60)) + ':' + pad(state.callSec % 60);
    const outgoing = state.callOutgoing;
    const num = state.callNumber;
    endCallUI();
    if (outgoing) {
      addCall({ contact: null, number: num, type: 'out', time: 'Just now', dur, seen: true });
    } else {
      const c = D.call || {};
      addCall({ contact: c.contact || 'you', type: 'in', time: 'Just now', dur, seen: true });
    }
  }

  /* ---------------- init ---------------- */
  renderLock();
  renderHome();
  setChrome(true);
  applySettings();

  // After saving in the customizer, reopen straight to the home screen.
  var afterEdit = false;
  try {
    afterEdit = sessionStorage.getItem('wb_after_edit') === '1';
    if (afterEdit) sessionStorage.removeItem('wb_after_edit');
  } catch (e) { /* ignore */ }
  if (afterEdit) setTimeout(unlock, 80);

  const q = new URLSearchParams(location.search);
  if (q.get('page') === '2') setPage(1, false);
  const v = q.get('view');
  if (q.get('static')) document.documentElement.classList.add('no-anim');

  if (q.get('test')) {
    window.onerror = function (m) { document.title = 'ERR ' + m; };
    setTimeout(function () {
      if (currentPin()) {
        state.pin = currentPin();
        state.pinMode = 'unlock';
        pinComplete();
      } else {
        unlock();
      }
      openApp('chat', 'you');
      state.chatOpen = true;
      renderChat('you');
      setTimeout(function () {
        ['one', 'two', 'three'].forEach(function (t) {
          var inp = document.getElementById('chatInput');
          if (inp) { inp.value = 'test ' + t; sendChat(); }
        });
        setTimeout(function () {
          var rows = document.querySelectorAll('.chatStack .chatRow').length;
          var typing = !!document.getElementById('typingRow');
          var call = document.getElementById('callScreen').classList.contains('show');
          if (call) declineCall();
          closeApp();
          setTimeout(function () {
            var b = document.querySelector('.appIco[data-app="chat"] .bdg');
            document.title = 'test rows=' + rows + ' typing=' + typing + ' call=' + call
              + ' badge=' + (b ? b.textContent : 'none')
              + ' unread=' + JSON.stringify(D.unread)
              + ' notif=' + ((D.lock && D.lock.notifications) ? D.lock.notifications.length : -1)
              + ' pin=' + currentPin();
          }, 300);
        }, 5200);
      }, 400);
    }, 300);
  }

  if (q.get('debug')) {
    setTimeout(function () {
      var a = document.querySelector('#appL .app');
      if (!a) {
        var r = function (el) { var b = el.getBoundingClientRect(); return Math.round(b.left) + ',' + Math.round(b.top) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height); };
        document.title = 'vw=' + innerWidth + ' vh=' + innerHeight
          + ' | screen=' + r(screen) + ' | canvas=' + r(canvas)
          + ' | grid=' + r(document.querySelector('.homeGrid'));
        return;
      }
      document.title = 'app ' + a.getBoundingClientRect().width;
    }, 900);
  }

  if (v && v !== 'lock') {
    setTimeout(function () {
      if (v === 'pin') { openPin('unlock'); return; }
      // 需要密码时先输密码（截图/调试直接放行）
      if (currentPin() && !q.get('static')) {
        state.pendingChat = v === 'chat' ? (q.get('chat') || 'you') : null;
        openPin('unlock');
        return;
      }
      unlock();
      if (v === 'chat') {
        var cid = q.get('chat');
        if (cid === 'list') { openApp('chat'); }
        else { openApp('chat', cid || 'you'); state.chatOpen = true; renderChat(state.chat); }
      } else if (ICONS[v]) {
        openApp(v);
        if (v === 'phone' && q.get('tab') === 'keypad') { state.phoneTab = 'keypad'; renderPhone(); }
      } else if (v === 'call') {
        startCall({});
      }
    }, 120);
  }

  window.__phone = { openApp, closeApp, startCall, unlock, openPin };
})();
