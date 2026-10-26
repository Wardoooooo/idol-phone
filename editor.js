/* =========================================================
   In-page customizer
   Everything edits a working copy; "Save" writes it and reloads
   ========================================================= */
(function () {
  'use strict';

  if (!window.WB) return;
  if (window.WB.READ_ONLY) return;

  var PH_IMG = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">' +
    '<rect width="240" height="240" fill="#c9c9d1"/>' +
    '<circle cx="120" cy="92" r="38" fill="#ffffff"/>' +
    '<path d="M52 212c10-46 38-66 68-66s58 20 68 66z" fill="#ffffff"/></svg>');

  var E = null;
  var tab = 'profile';
  var chatSel = '';
  var chatBulk = '';
  var dirty = false;
  var wallpaperTouched = false;
  var toastTimer = 0;
  var cloudTimer = 0;
  var cloudQueue = Promise.resolve();
  var lastCloudSnap = '';
  var cloudErrorShown = false;
  var panel, bodyEl, tabsEl, usageEl;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clone(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }
  function isNum(s) { return /^\d+$/.test(s); }

  function getPath(obj, path) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setPath(obj, path, val) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (cur[k] == null) cur[k] = isNum(parts[i + 1]) ? [] : {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = val;
  }

  /* ---------------- small HTML builders ---------------- */
  function card(title, inner, extra) {
    return '<section class="wbCard"><div class="wbCardHead"><h3>' + esc(title) + '</h3>'
      + (extra || '') + '</div>' + inner + '</section>';
  }

  function field(label, path, value, opts) {
    opts = opts || {};
    var type = opts.type || 'text';
    return '<label class="wbField"><span>' + esc(label) + '</span>'
      + '<input type="' + type + '" data-path="' + esc(path) + '"'
      + ' value="' + esc(value == null ? '' : value) + '"'
      + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '')
      + (opts.maxlen ? ' maxlength="' + opts.maxlen + '"' : '')
      + (opts.num ? ' data-num="1"' : '')
      + '></label>';
  }

  function area(label, path, value, rows) {
    return '<label class="wbField wbArea"><span>' + esc(label) + '</span>'
      + '<textarea rows="' + (rows || 3) + '" data-path="' + esc(path) + '">'
      + esc(value == null ? '' : value) + '</textarea></label>';
  }

  function check(label, path, on) {
    return '<label class="wbCheck"><input type="checkbox" data-path="' + esc(path) + '"'
      + (on ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
  }

  function colorField(label, path, value) {
    return '<label class="wbField wbColor"><span>' + esc(label) + '</span>'
      + '<input type="color" data-path="' + esc(path) + '" value="' + esc(value || '#7c5cff') + '"></label>';
  }

  function selectField(label, path, value, options) {
    return '<label class="wbField"><span>' + esc(label) + '</span><select data-path="'
      + esc(path) + '">' + options.map(function (o) {
        return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(value) ? ' selected' : '')
          + '>' + esc(o.l) + '</option>';
      }).join('') + '</select></label>';
  }

  function mediaField(label, path, value, kind) {
    kind = kind || 'image';
    var audio = kind === 'audio';
    var url = WB.mediaURL(value);
    var inner = audio
      ? (url ? '<audio controls preload="metadata" src="' + esc(url) + '"></audio>' : '<span class="wbNoMedia">未上传音频</span>')
      : (url ? '<img src="' + esc(url) + '" alt="">' : '<span class="wbNoMedia">未选择图片</span>');
    return '<div class="wbField wbMediaField"><span>' + esc(label) + '</span>'
      + '<div class="wbMediaRow"><div class="wbThumb' + (audio ? ' audio' : '') + '">' + inner + '</div>'
      + '<div class="wbMediaSide">'
      + '<label class="wbFileBtn">' + (audio ? '上传音频' : '上传图片')
      + '<input type="file" accept="' + (audio ? 'audio/*' : 'image/*') + '" data-media="' + esc(path) + '" data-kind="' + kind + '"></label>'
      + (value ? '<button type="button" class="wbMini danger" data-act="media-clear" data-path="' + esc(path) + '">移除</button>' : '')
      + '<span class="wbFileName">' + esc(WB.mediaName(value)) + '</span>'
      + '</div></div></div>';
  }

  function btn(label, act, attrs, cls) {
    return '<button type="button" class="' + (cls || 'wbBtn') + '" data-act="' + act + '"'
      + (attrs || '') + '>' + label + '</button>';
  }

  function moveBtns(act, attrs, arrLen, i) {
    return btn('↑', act, attrs + ' data-dir="-1"', 'wbMini') +
      btn('↓', act, attrs + ' data-dir="1"', 'wbMini') +
      btn('✕', act, attrs + ' data-dir="0"', 'wbMini danger');
  }

  /* ---------------- profile ---------------- */
  function tabProfile() {
    E.owner = E.owner || {};
    E.lock = E.lock || {};
    E.theme = E.theme || {};
    E.weather = E.weather || {};
    var o = E.owner, l = E.lock, t = E.theme, w = E.weather;
    return ''
      + card('手机主人',
        mediaField('头像', 'owner.avatar', o.avatar, 'image')
        + field('名字（显示在聊天/关于）', 'owner.name', o.name, { ph: '例如 Min' })
        + field('英文名 / 状态栏名', 'owner.en', o.en, { ph: '例如 MIN' })
        + field('简介小标题', 'owner.sub', o.sub, { ph: '例如 Singer · Main vocal' })
        + area('简介正文', 'owner.bio', o.bio, 4))
      + card('主题色',
        '<div class="wbGrid2">'
        + colorField('主色', 'theme.accent', t.accent)
        + colorField('强调色', 'theme.accent2', t.accent2)
        + '</div>')
      + card('锁屏与壁纸',
        field('锁屏密码（4 位，留空 = 无密码）', 'lock.pin', l.pin, { maxlen: 4, ph: '0309' })
        + mediaField('壁纸（锁屏 + 主屏）', 'wallpaper', E.wallpaper, 'image')
        + '<p class="wbNote">上传的壁纸会同时用于锁屏和主屏。若之前在手机「设置」里换过壁纸，保存后以这里为准。</p>')
      + card('天气小组件',
        field('城市', 'weather.city', w.city)
        + '<div class="wbGrid2">'
        + field('温度', 'weather.temp', w.temp, { ph: '18°' })
        + field('图标（emoji）', 'weather.icon', w.icon, { ph: '☀️' })
        + '</div>'
        + field('天气描述', 'weather.desc', w.desc, { ph: 'Sunny' }));
  }

  /* ---------------- contacts ---------------- */
  function tabContacts() {
    E.contacts = E.contacts || {};
    E.unread = E.unread || {};
    var keys = Object.keys(E.contacts);
    var list = keys.map(function (cid) {
      var c = E.contacts[cid];
      var n = (E.chats && E.chats[cid]) ? E.chats[cid].length : 0;
      return card(c.name || cid,
        mediaField('头像', 'contacts.' + cid + '.avatar', c.avatar, 'image')
        + '<div class="wbGrid2">'
        + field('显示名称', 'contacts.' + cid + '.name', c.name)
        + field('状态（Online / Busy…）', 'contacts.' + cid + '.status', c.status)
        + '</div>'
        + '<div class="wbGrid2">'
        + field('未读消息数', 'unread.' + cid, (E.unread && E.unread[cid]) || 0, { num: true, type: 'number' })
        + '<label class="wbField"><span>内部 ID（只读）</span><input value="' + esc(cid) + '" readonly></label>'
        + '</div>'
        + '<div class="wbRowBtns">'
        + btn('编辑聊天（' + n + ' 条）', 'open-chat', ' data-cid="' + esc(cid) + '"', 'wbBtn primary')
        + btn('删除联系人', 'del-contact', ' data-cid="' + esc(cid) + '"', 'wbBtn danger')
        + '</div>',
        ''
      );
    }).join('');
    return (list || '<div class="wbEmpty">还没有联系人</div>')
      + '<div class="wbAddBar">' + btn('＋ 添加联系人', 'add-contact', '', 'wbBtn primary') + '</div>'
      + '<p class="wbNote">「内部 ID」只是数据里的键名（如 you、mom）。新增联系人的 ID 会自动生成，不需要修改。</p>';
  }

  /* ---------------- chats ---------------- */
  function tabChats() {
    E.contacts = E.contacts || {};
    E.chats = E.chats || {};
    var keys = Object.keys(E.contacts);
    if (!keys.length) return '<div class="wbEmpty">先在「联系人」里添加联系人</div>';
    if (keys.indexOf(chatSel) < 0) chatSel = keys[0];
    var msgs = E.chats[chatSel] || (E.chats[chatSel] = []);
    var c = E.contacts[chatSel] || {};
    var selector = '<label class="wbField"><span>正在编辑谁的聊天</span><select id="wbChatSel">'
      + keys.map(function (cid) {
        return '<option value="' + esc(cid) + '"' + (cid === chatSel ? ' selected' : '') + '>'
          + esc((E.contacts[cid].name || cid)) + '</option>';
      }).join('') + '</select></label>';

    var rows = msgs.map(function (m, i) {
      var typeOpts = [
        { v: 'them', l: '对方发来' }, { v: 'me', l: '我发出' },
        { v: 'date', l: '日期分隔' }, { v: 'voice', l: '语音（对方）' }
      ];
      var type = m.voice ? 'voice' : (m.t || 'them');
      var head = '<div class="wbMsgHead"><span class="wbChip ' + esc(type) + '">#' + (i + 1) + '</span>'
        + '<label class="wbField wbMsgType"><select data-msgtype="1" data-cid="' + esc(chatSel) + '" data-i="' + i + '">'
        + typeOpts.map(function (o) {
          return '<option value="' + o.v + '"' + (o.v === type ? ' selected' : '') + '>' + o.l + '</option>';
        }).join('') + '</select></label>'
        + '<div class="wbMsgActions">'
        + btn('↑', 'move-msg', ' data-cid="' + esc(chatSel) + '" data-i="' + i + '" data-dir="-1"', 'wbMini')
        + btn('↓', 'move-msg', ' data-cid="' + esc(chatSel) + '" data-i="' + i + '" data-dir="1"', 'wbMini')
        + btn('✕', 'del-msg', ' data-cid="' + esc(chatSel) + '" data-i="' + i + '"', 'wbMini danger')
        + '</div></div>';
      var inner;
      if (type === 'date') {
        inner = field('日期文字', 'chats.' + chatSel + '.' + i + '.text', m.text, { ph: 'Today / Oct 18' });
      } else if (type === 'voice') {
        inner = mediaField('语音文件', 'chats.' + chatSel + '.' + i + '.src', m.src, 'audio')
          + field('语音时长（显示用）', 'chats.' + chatSel + '.' + i + '.voice', m.voice || '0:03', { ph: '0:03' })
          + '<p class="wbNote">语音会显示成对方发来的语音条；点播放会放这段音频。</p>';
      } else {
        inner = area('内容', 'chats.' + chatSel + '.' + i + '.text', m.text, 2);
      }
      return '<div class="wbMsg">' + head + inner + '</div>';
    }).join('');

    return '<div class="wbStickyTop">' + selector + '</div>'
      + (rows || '<div class="wbEmpty">这段聊天还是空的，点下面按钮添加第一条</div>')
      + '<div class="wbAddBar">'
      + btn('＋ 对方消息', 'add-msg', ' data-cid="' + esc(chatSel) + '" data-kind="them"', 'wbBtn')
      + btn('＋ 我的消息', 'add-msg', ' data-cid="' + esc(chatSel) + '" data-kind="me"', 'wbBtn')
      + btn('＋ 日期', 'add-msg', ' data-cid="' + esc(chatSel) + '" data-kind="date"', 'wbBtn')
      + btn('＋ 语音', 'add-msg', ' data-cid="' + esc(chatSel) + '" data-kind="voice"', 'wbBtn')
      + '</div>'
      + '<p class="wbNote">聊天记录会按这里的顺序显示；「对方」的消息靠左，「我的」靠右。对方发语音时，上传音频并填好显示时长。</p>'
      + '<div class="wbBulk">'
      + '<div class="wbBulkTitle">批量粘贴聊天内容</div>'
      + '<label class="wbFileBtn" style="margin-bottom:8px">从 txt 文件读取'
      + '<input type="file" id="wbBulkFile" accept=".txt,text/plain"></label>'
      + '<textarea id="wbChatBulk" rows="5" placeholder="我: 今天好累\n对方: 辛苦了\n日期: Oct 18\n对方: 早点睡">' + esc(chatBulk) + '</textarea>'
      + '<div class="wbRowBtns">'
      + btn('追加到当前聊天', 'bulk-append', '', 'wbBtn primary')
      + btn('覆盖当前聊天', 'bulk-replace', '', 'wbBtn danger')
      + '</div>'
      + '<p class="wbNote">每行一条，用「我:」「对方:」「日期:」开头；英文 me: / them: / date: 也可以。没写前缀的默认算「对方」。</p>'
      + '</div>';
  }

  /* ---------------- photos ---------------- */
  function tabPhotos() {
    E.photos = Array.isArray(E.photos) ? E.photos : [];
    var list = E.photos.map(function (sec, i) {
      var items = (sec.items || []).map(function (p, j) {
        return '<div class="wbPhoto">'
          + '<img src="' + esc(WB.mediaURL(p.src) || PH_IMG) + '" alt="">'
          + '<label class="wbPhotoCap"><span>说明</span><input data-path="photos.' + i + '.items.' + j + '.cap" value="' + esc(p.cap || '') + '" placeholder="照片说明"></label>'
          + '<div class="wbPhotoBtns">'
          + btn('←', 'move-photo', ' data-i="' + i + '" data-j="' + j + '" data-dir="-1"', 'wbMini')
          + btn('→', 'move-photo', ' data-i="' + i + '" data-j="' + j + '" data-dir="1"', 'wbMini')
          + btn('✕', 'del-photo', ' data-i="' + i + '" data-j="' + j + '"', 'wbMini danger')
          + '</div></div>';
      }).join('');
      return card(sec.month || ('相册 ' + (i + 1)),
        field('月份标题', 'photos.' + i + '.month', sec.month, { ph: 'October 2026' })
        + '<div class="wbPhotoGrid">' + (items || '<div class="wbEmpty">还没有照片</div>') + '</div>'
        + '<div class="wbAddBar">'
        + '<label class="wbFileBtn">＋ 上传照片（可多选）<input type="file" accept="image/*" multiple data-multi="photos.' + i + '.items" data-multi-kind="photo"></label>'
        + btn('删除整组', 'del-section', ' data-i="' + i + '"', 'wbBtn danger')
        + '</div>'
      );
    }).join('');
    return (list || '<div class="wbEmpty">还没有相册</div>')
      + '<div class="wbAddBar">' + btn('＋ 添加相册分组', 'add-section', '', 'wbBtn primary') + '</div>'
      + '<p class="wbNote">照片会上传并压缩到最长边 1600px；原图较大时会转成 JPEG 以节省空间。</p>';
  }

  /* ---------------- music ---------------- */
  function tabMusic() {
    E.songs = Array.isArray(E.songs) ? E.songs : [];
    var list = E.songs.map(function (s, i) {
      return card(s.title || ('歌曲 ' + (i + 1)),
        mediaField('封面', 'songs.' + i + '.cover', s.cover, 'image')
        + field('歌名', 'songs.' + i + '.title', s.title)
        + field('歌手', 'songs.' + i + '.artist', s.artist)
        + mediaField('音频文件', 'songs.' + i + '.src', s.src, 'audio')
        + '<div class="wbRowBtns">'
        + btn('↑', 'move-song', ' data-i="' + i + '" data-dir="-1"', 'wbMini')
        + btn('↓', 'move-song', ' data-i="' + i + '" data-dir="1"', 'wbMini')
        + btn('删除这首歌', 'del-song', ' data-i="' + i + '"', 'wbBtn danger')
        + '</div>');
    }).join('');
    return (list || '<div class="wbEmpty">还没有歌曲</div>')
      + '<div class="wbAddBar">' + btn('＋ 添加歌曲', 'add-song', '', 'wbBtn primary') + '</div>'
      + '<p class="wbNote">支持 MP3 / M4A / WAV 等浏览器能播放的格式。歌曲会直接存进浏览器，不压缩。</p>';
  }

  /* ---------------- notes ---------------- */
  function tabNotes() {
    E.notes = Array.isArray(E.notes) ? E.notes : [];
    var list = E.notes.map(function (n, i) {
      return card(n.title || ('备忘录 ' + (i + 1)),
        field('标题', 'notes.' + i + '.title', n.title)
        + field('日期', 'notes.' + i + '.date', n.date, { ph: '2026-10-16' })
        + area('正文', 'notes.' + i + '.body', n.body, 4)
        + '<div class="wbRowBtns">'
        + btn('↑', 'move-note', ' data-i="' + i + '" data-dir="-1"', 'wbMini')
        + btn('↓', 'move-note', ' data-i="' + i + '" data-dir="1"', 'wbMini')
        + btn('删除', 'del-note', ' data-i="' + i + '"', 'wbBtn danger')
        + '</div>');
    }).join('');
    return (list || '<div class="wbEmpty">还没有备忘录</div>')
      + '<div class="wbAddBar">' + btn('＋ 添加备忘录', 'add-note', '', 'wbBtn primary') + '</div>';
  }

  /* ---------------- calendar ---------------- */
  function tabCalendar() {
    E.events = Array.isArray(E.events) ? E.events : [];
    var rows = E.events.map(function (ev, i) {
      return '<div class="wbEvent">'
        + '<div class="wbGrid3">'
        + field('日期', 'events.' + i + '.date', ev.date, { type: 'date' })
        + field('时间', 'events.' + i + '.time', ev.time, { ph: '19:00' })
        + field('地点', 'events.' + i + '.place', ev.place)
        + '</div>'
        + field('事件标题', 'events.' + i + '.title', ev.title)
        + '<div class="wbRowBtns">'
        + btn('↑', 'move-event', ' data-i="' + i + '" data-dir="-1"', 'wbMini')
        + btn('↓', 'move-event', ' data-i="' + i + '" data-dir="1"', 'wbMini')
        + btn('删除', 'del-event', ' data-i="' + i + '"', 'wbBtn danger')
        + '</div></div>';
    }).join('');
    return (rows || '<div class="wbEmpty">日历还是空的</div>')
      + '<div class="wbAddBar">' + btn('＋ 添加日程', 'add-event', '', 'wbBtn primary') + '</div>'
      + '<p class="wbNote">日期用 YYYY-MM-DD，主屏小组件会自动显示最近的日程。</p>';
  }

  /* ---------------- mail ---------------- */
  function tabMail() {
    E.mails = Array.isArray(E.mails) ? E.mails : [];
    var list = E.mails.map(function (m, i) {
      return card(m.subject || ('邮件 ' + (i + 1)),
        '<div class="wbGrid3">'
        + field('发件人', 'mails.' + i + '.from', m.from)
        + field('日期', 'mails.' + i + '.date', m.date, { ph: 'Yesterday' })
        + check('未读', 'mails.' + i + '.unread', m.unread)
        + '</div>'
        + field('主题', 'mails.' + i + '.subject', m.subject)
        + area('正文', 'mails.' + i + '.body', m.body, 4)
        + '<div class="wbRowBtns">'
        + btn('↑', 'move-mail', ' data-i="' + i + '" data-dir="-1"', 'wbMini')
        + btn('↓', 'move-mail', ' data-i="' + i + '" data-dir="1"', 'wbMini')
        + btn('删除', 'del-mail', ' data-i="' + i + '"', 'wbBtn danger')
        + '</div>');
    }).join('');
    return (list || '<div class="wbEmpty">没有邮件</div>')
      + '<div class="wbAddBar">' + btn('＋ 添加邮件', 'add-mail', '', 'wbBtn primary') + '</div>';
  }

  /* ---------------- calls ---------------- */
  function tabCalls() {
    E.calls = Array.isArray(E.calls) ? E.calls : [];
    var keys = Object.keys(E.contacts || {});
    var contactOpts = keys.map(function (cid) {
      return { v: cid, l: (E.contacts[cid].name || cid) };
    });
    if (!contactOpts.length) contactOpts = [{ v: '', l: '（无联系人）' }];
    var typeOpts = [{ v: 'in', l: '来电' }, { v: 'out', l: '拨出' }, { v: 'missed', l: '未接' }];
    var rows = E.calls.map(function (c, i) {
      return '<div class="wbEvent"><div class="wbGrid3">'
        + selectField('联系人', 'calls.' + i + '.contact', c.contact, contactOpts)
        + selectField('类型', 'calls.' + i + '.type', c.type, typeOpts)
        + field('时间文字', 'calls.' + i + '.time', c.time, { ph: 'Today 9:04 PM' })
        + '</div><div class="wbGrid3">'
        + field('时长', 'calls.' + i + '.dur', c.dur, { ph: '12:31' })
        + check('已读（不显示未接红点）', 'calls.' + i + '.seen', c.seen)
        + '<div></div></div>'
        + '<div class="wbRowBtns">' + btn('删除', 'del-call', ' data-i="' + i + '"', 'wbBtn danger') + '</div></div>';
    }).join('');
    return (rows || '<div class="wbEmpty">没有通话记录</div>')
      + '<div class="wbAddBar">' + btn('＋ 添加通话记录', 'add-call', '', 'wbBtn primary') + '</div>';
  }

  /* ---------------- social ---------------- */
  function tabSocial() {
    E.social = E.social || {};
    var s = E.social;
    s.instagram = s.instagram || {};
    s.twitter = s.twitter || {};
    s.facebook = s.facebook || {};
    var ig = s.instagram, tw = s.twitter, fb = s.facebook;

    var igPhotos = (ig.photos || []).map(function (p, i) {
      return '<div class="wbPhoto sm"><img src="' + esc(WB.mediaURL(p) || PH_IMG) + '" alt="">'
        + '<div class="wbPhotoBtns">'
        + btn('←', 'ig-move', ' data-i="' + i + '" data-dir="-1"', 'wbMini')
        + btn('→', 'ig-move', ' data-i="' + i + '" data-dir="1"', 'wbMini')
        + btn('✕', 'ig-del', ' data-i="' + i + '"', 'wbMini danger')
        + '</div></div>';
    }).join('');

    var tweets = (tw.tweets || []).map(function (t, i) {
      return '<div class="wbEvent">'
        + area('推文内容', 'social.twitter.tweets.' + i + '.text', t.text, 2)
        + '<div class="wbGrid3">'
        + field('时间', 'social.twitter.tweets.' + i + '.time', t.time, { ph: '2h' })
        + field('回复数', 'social.twitter.tweets.' + i + '.replies', t.replies)
        + field('转推数', 'social.twitter.tweets.' + i + '.retweets', t.retweets)
        + '</div>'
        + field('点赞数', 'social.twitter.tweets.' + i + '.likes', t.likes)
        + '<div class="wbRowBtns">'
        + btn('↑', 'move-tweet', ' data-i="' + i + '" data-dir="-1"', 'wbMini')
        + btn('↓', 'move-tweet', ' data-i="' + i + '" data-dir="1"', 'wbMini')
        + btn('删除', 'del-tweet', ' data-i="' + i + '"', 'wbBtn danger')
        + '</div></div>';
    }).join('');

    var posts = (fb.posts || []).map(function (p, i) {
      return '<div class="wbEvent">'
        + area('动态内容', 'social.facebook.posts.' + i + '.text', p.text, 2)
        + '<div class="wbGrid2">'
        + field('时间', 'social.facebook.posts.' + i + '.time', p.time)
        + field('点赞数', 'social.facebook.posts.' + i + '.likes', p.likes)
        + '</div>'
        + '<div class="wbRowBtns">'
        + btn('↑', 'move-fb', ' data-i="' + i + '" data-dir="-1"', 'wbMini')
        + btn('↓', 'move-fb', ' data-i="' + i + '" data-dir="1"', 'wbMini')
        + btn('删除', 'del-fb', ' data-i="' + i + '"', 'wbBtn danger')
        + '</div></div>';
    }).join('');

    return ''
      + card('Instagram',
        mediaField('头像', 'social.instagram.avatar', ig.avatar, 'image')
        + '<div class="wbGrid2">'
        + field('名称', 'social.instagram.name', ig.name)
        + field('账号', 'social.instagram.handle', ig.handle, { ph: '@min.official' })
        + field('简介', 'social.instagram.bio', ig.bio)
        + field('帖子数', 'social.instagram.posts', ig.posts)
        + field('粉丝数', 'social.instagram.followers', ig.followers)
        + field('关注数', 'social.instagram.following', ig.following)
        + '</div>'
        + '<div class="wbPhotoGrid">' + (igPhotos || '<div class="wbEmpty">还没有动态图片</div>') + '</div>'
        + '<div class="wbAddBar"><label class="wbFileBtn">＋ 上传图片（可多选）'
        + '<input type="file" accept="image/*" multiple data-multi="social.instagram.photos" data-multi-kind="igphoto"></label></div>')
      + card('Twitter',
        mediaField('头像', 'social.twitter.avatar', tw.avatar, 'image')
        + '<div class="wbGrid2">'
        + field('名称', 'social.twitter.name', tw.name)
        + field('账号', 'social.twitter.handle', tw.handle)
        + '</div>'
        + tweets
        + '<div class="wbAddBar">' + btn('＋ 添加推文', 'add-tweet', '', 'wbBtn') + '</div>')
      + card('Facebook',
        mediaField('头像', 'social.facebook.avatar', fb.avatar, 'image')
        + mediaField('封面', 'social.facebook.cover', fb.cover, 'image')
        + '<div class="wbGrid2">'
        + field('名称', 'social.facebook.name', fb.name)
        + field('账号 / 显示名', 'social.facebook.handle', fb.handle)
        + '</div>'
        + posts
        + '<div class="wbAddBar">' + btn('＋ 添加动态', 'add-fb', '', 'wbBtn') + '</div>');
  }

  /* ---------------- extras ---------------- */
  function tabExtra() {
    E.lock = E.lock || {};
    E.liveScript = E.liveScript || {};
    E.call = E.call || {};
    E.contacts = E.contacts || {};
    var keys = Object.keys(E.contacts);
    var contactOpts = keys.map(function (cid) {
      return { v: cid, l: (E.contacts[cid].name || cid) };
    });
    if (!contactOpts.length) contactOpts = [{ v: '', l: '（无联系人）' }];

    var notifs = (E.lock.notifications || []).map(function (n, i) {
      return '<div class="wbEvent">'
        + '<div class="wbGrid3">'
        + field('App 名', 'lock.notifications.' + i + '.app', n.app, { ph: 'Messages' })
        + field('图标 emoji', 'lock.notifications.' + i + '.icon', n.icon, { ph: '💬' })
        + field('时间文字', 'lock.notifications.' + i + '.time', n.time, { ph: 'now' })
        + '</div>'
        + field('标题', 'lock.notifications.' + i + '.title', n.title)
        + field('内容', 'lock.notifications.' + i + '.text', n.text)
        + selectField('点开跳到谁', 'lock.notifications.' + i + '.chat', n.chat, contactOpts)
        + '<div class="wbRowBtns">' + btn('删除通知', 'del-notif', ' data-i="' + i + '"', 'wbBtn danger') + '</div></div>';
    }).join('');

    var scripts = keys.map(function (cid) {
      var arr = E.liveScript[cid] || [];
      return '<div class="wbEvent"><div class="wbField wbArea"><span>' + esc(E.contacts[cid].name || cid) + ' · 自动回复（每行一条，按顺序）</span>'
        + '<textarea rows="4" data-lines="liveScript.' + esc(cid) + '">' + esc(arr.join('\n')) + '</textarea></div></div>';
    }).join('');

    return ''
      + card('锁屏通知',
        notifs
        + '<div class="wbAddBar">' + btn('＋ 添加锁屏通知', 'add-notif', '', 'wbBtn') + '</div>')
      + card('聊天自动回复',
        scripts || '<div class="wbEmpty">先在「联系人」里添加联系人</div>'
        + '<p class="wbNote">在手机里给对方发消息时，对方会按顺序自动回复这些句子。（当前只在浏览器里模拟，不会真的联网）</p>')
      + card('模拟来电',
        '<div class="wbGrid2">'
        + selectField('来电联系人', 'call.contact', E.call.contact, contactOpts)
        + field('来电显示名', 'call.name', E.call.name)
        + '</div>'
        + mediaField('来电头像', 'call.avatar', E.call.avatar, 'image')
        + field('发满几条消息后来电', 'call.afterMessages', E.call.afterMessages, { num: true, type: 'number' })
        + '<p class="wbNote">发满指定条数消息后，会模拟一通来电；接听/拒绝都不影响聊天。</p>');
  }

  /* ---------------- data ---------------- */
  function fmtBytes(n) {
    if (!n || n < 0) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function tabData() {
    var media = WB.listMedia();
    var total = media.reduce(function (a, m) { return a + m.size; }, 0);
    var rows = media.slice(0, 60).map(function (m) {
      return '<li><span>' + esc(m.name || m.id) + '</span><em>' + esc(m.kind || m.type) + ' · ' + fmtBytes(m.size) + '</em></li>';
    }).join('');
    return ''
      + card('云端作品 / 分享',
        '<p class="wbNote">修改会<b>自动保存到云端</b>。点「分享我的作品」生成一个只读链接：别人打开只能看，不能改。分享的是点击那一刻的快照；之后改了内容要再点一次。</p>'
        + '<p class="wbNote" id="wbCloudInfo">正在检查云端…</p>'
        + '<div class="wbRowBtns">'
        + btn('🔗 分享我的作品', 'cloud-share', '', 'wbBtn primary')
        + btn('☁ 立即保存到云端', 'cloud-save', '', 'wbBtn')
        + '</div>')
      + card('保存 / 分享',
        '<p class="wbNote">修改会存在这台电脑的浏览器里。想发给对方，先点右上角「保存并应用」，再点「生成分享网页」：会把已保存的全部内容（包括上传的图片、音乐）打包成一个独立的 <b>index.html</b>，对方打开就能看，不需要安装任何东西；分享页没有编辑按钮，内容固定在这一刻。</p>'
        + '<p class="wbNote">想要一个网址：生成下面的 <b>.zip</b>，拖到 Netlify Drop 或 Cloudflare Pages 直接上传，就能得到链接。也可以直接把 index.html 文件发给对方（手机微信里可能不方便打开，建议用网址）。</p>'
        + '<div class="wbRowBtns">'
        + btn('🎁 生成分享网页 (.html)', 'share-html', '', 'wbBtn primary')
        + btn('⤓ 生成分享压缩包 (.zip)', 'share-zip', '', 'wbBtn primary')
        + '</div>'
        + '<div class="wbRowBtns">'
        + btn('⤓ 导出成品 data.js', 'export-datajs', '', 'wbBtn')
        + btn('⤓ 导出完整备份 (.json)', 'export-backup', '', 'wbBtn')
        + btn('⤓ 仅导出文字内容', 'export-text', '', 'wbBtn')
        + btn('⤒ 导入备份', 'import-backup', '', 'wbBtn')
        + '</div>'
        + '<input type="file" id="wbImportFile" accept="application/json,.json" hidden>'
        + '<p class="wbNote">「完整备份」包含上传的图片和音乐，可以在另一台电脑的浏览器里导入继续编辑。data.js 里也会内嵌素材，文件可能较大。</p>')
      + card('素材与空间',
        '<p class="wbNote" id="wbUsage">正在统计…</p>'
        + '<p class="wbNote">已保存上传素材：' + media.length + ' 个 · ' + fmtBytes(total) + '</p>'
        + (rows ? '<ul class="wbMediaList">' + rows + '</ul>' : '')
        + '<div class="wbRowBtns">'
        + btn('清理未使用素材', 'prune', '', 'wbBtn')
        + '</div>'
        + '<p class="wbNote">清理只会删除已经不被任何头像 / 照片 / 歌曲 / 语音引用的上传文件。</p>')
      + card('恢复默认',
        '<p class="wbNote">会清除所有自定义内容、上传素材、锁屏密码和备忘录修改，回到初始演示内容。建议先导出备份。</p>'
        + '<div class="wbRowBtns">' + btn('恢复默认内容', 'reset', '', 'wbBtn danger') + '</div>');
  }

  /* ---------------- render ---------------- */
  var TABS = [
    { id: 'profile', label: '主页' },
    { id: 'contacts', label: '联系人' },
    { id: 'chats', label: '聊天' },
    { id: 'photos', label: '相册' },
    { id: 'music', label: '音乐' },
    { id: 'notes', label: '备忘录' },
    { id: 'calendar', label: '日历' },
    { id: 'mail', label: '邮件' },
    { id: 'calls', label: '通话' },
    { id: 'social', label: '社交' },
    { id: 'extra', label: '通知/自动回复' },
    { id: 'data', label: '备份/重置' }
  ];

  var RENDER = {
    profile: tabProfile, contacts: tabContacts, chats: tabChats,
    photos: tabPhotos, music: tabMusic, notes: tabNotes,
    calendar: tabCalendar, mail: tabMail, calls: tabCalls,
    social: tabSocial, extra: tabExtra, data: tabData
  };

  function render(resetScroll) {
    var y = bodyEl.scrollTop;
    tabsEl.innerHTML = TABS.map(function (t) {
      return '<button type="button" class="' + (t.id === tab ? 'on' : '') + '" data-act="tab" data-tab="' + t.id + '">'
        + esc(t.label) + '</button>';
    }).join('');
    bodyEl.innerHTML = (RENDER[tab] || tabProfile)();
    bodyEl.scrollTop = resetScroll ? 0 : y;
    if (tab === 'data') { refreshUsage(); refreshCloudInfo(); }
  }

  function refreshUsage() {
    usageEl = document.getElementById('wbUsage');
    if (!usageEl) return;
    WB.usage().then(function (est) {
      if (!est || !est.usage) { usageEl.textContent = '浏览器未提供空间统计。'; return; }
      usageEl.textContent = '浏览器已用：' + fmtBytes(est.usage) + ' / 可用约 ' + fmtBytes(est.quota);
    });
  }

  function toast(msg) {
    var t = document.getElementById('wbToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------------- open / close / save ---------------- */
  function open() {
    if (panel.classList.contains('show')) return;
    panel.classList.add('show');
    document.body.classList.add('wbEditing');
    document.getElementById('wbOpenBtn').classList.add('hidden');
    tabsEl.innerHTML = '';
    bodyEl.innerHTML = '<div class="wbLoading">正在读取内容…</div>';

    var setup = function () {
      E = WB.config();
      tab = 'profile';
      chatSel = Object.keys(E.contacts || {})[0] || '';
      chatBulk = '';
      dirty = false;
      wallpaperTouched = false;
      lastCloudSnap = JSON.stringify(E);
      setCloudState(cloudReady()
        ? (WB.cloud.projectId() ? '云端已连接' : '云端待创建')
        : '仅本机保存', '');
      render(true);
    };
    if (WB.ingestEmbedded) {
      WB.ingestEmbedded().then(setup, setup);
    } else {
      setup();
    }
  }

  function close(force) {
    if (!force && dirty && !confirm('还有未保存的修改，确定关闭吗？')) return;
    if (dirty && cloudReady()) cloudSaveNow(false).catch(function () { /* shown */ });
    panel.classList.remove('show');
    document.body.classList.remove('wbEditing');
    document.getElementById('wbOpenBtn').classList.remove('hidden');
    dirty = false;
  }

  function normalize() {
    E.owner = E.owner || {};
    E.lock = E.lock || {};
    E.theme = E.theme || {};
    E.weather = E.weather || {};
    E.contacts = E.contacts || {};
    E.chats = E.chats || {};
    E.unread = E.unread || {};
    E.liveScript = E.liveScript || {};
    E.photos = Array.isArray(E.photos) ? E.photos : [];
    E.songs = Array.isArray(E.songs) ? E.songs : [];
    E.notes = Array.isArray(E.notes) ? E.notes : [];
    E.events = Array.isArray(E.events) ? E.events : [];
    E.mails = Array.isArray(E.mails) ? E.mails : [];
    E.calls = Array.isArray(E.calls) ? E.calls : [];
    E.call = E.call || {};
    E.social = E.social || {};
    ['instagram', 'twitter', 'facebook'].forEach(function (k) { E.social[k] = E.social[k] || {}; });
    E.social.instagram.photos = Array.isArray(E.social.instagram.photos) ? E.social.instagram.photos : [];
    E.social.twitter.tweets = Array.isArray(E.social.twitter.tweets) ? E.social.twitter.tweets : [];
    E.social.facebook.posts = Array.isArray(E.social.facebook.posts) ? E.social.facebook.posts : [];
    E.lock.notifications = Array.isArray(E.lock.notifications) ? E.lock.notifications : [];
    if (wallpaperTouched) E.lock.wallpaper = E.wallpaper;
    Object.keys(E.contacts).forEach(function (cid) {
      if (!Array.isArray(E.chats[cid])) E.chats[cid] = [];
      E.chats[cid].forEach(function (m) {
        if (m.voice) m.t = 'them';
      });
      if (typeof E.unread[cid] !== 'number') E.unread[cid] = Number(E.unread[cid]) || 0;
    });
    Object.keys(E.chats).forEach(function (cid) {
      if (!E.contacts[cid]) delete E.chats[cid];
    });
    E.calls.forEach(function (c) {
      if (c.contact && !E.contacts[c.contact]) c.contact = '';
    });
    if (E.call && E.call.contact && !E.contacts[E.call.contact]) E.call.contact = '';
    var firstCid = Object.keys(E.contacts)[0] || '';
    E.lock.notifications.forEach(function (n) {
      if (n.chat && !E.contacts[n.chat]) n.chat = firstCid;
    });
  }

  /* ---------------- cloud autosave / sharing ---------------- */
  function cloudReady() {
    return !!(window.WB && WB.cloud && WB.cloud.configured && WB.cloud.configured());
  }

  function cloudTitle() {
    var name = E && E.owner && E.owner.name ? String(E.owner.name).trim() : '';
    return name ? name + "'s iPhone" : 'My iPhone';
  }

  function setCloudState(text, cls) {
    var el = document.getElementById('wbCloudState');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'wbCloudState' + (cls ? ' ' + cls : '');
  }

  function refreshCloudInfo() {
    var el = document.getElementById('wbCloudInfo');
    if (!el) return;
    if (!cloudReady()) {
      el.textContent = '云端未配置：内容只保存在这台电脑的浏览器里。';
      return;
    }
    var id = WB.cloud.projectId();
    el.textContent = id
      ? '云端作品 ID：' + String(id).slice(0, 8) + '… 修改会自动保存；分享链接是冻结快照。'
      : '还没有云端作品；第一次自动保存时会创建。';
  }

  function doCloudSave(data, title, manual) {
    return WB.cloud.saveDraft(data, title).then(function (result) {
      cloudErrorShown = false;
      setCloudState('已保存到云端', 'ok');
      var same = false;
      try { same = JSON.stringify(E) === JSON.stringify(data); } catch (e) { /* ignore */ }
      if (same) {
        dirty = false;
        lastCloudSnap = JSON.stringify(E);
        if (result && result.data && window.DATA) {
          Object.keys(window.DATA).forEach(function (k) { delete window.DATA[k]; });
          Object.keys(result.data).forEach(function (k) { window.DATA[k] = result.data[k]; });
          try { WB.saveConfig(window.DATA, { clearWallpaper: false }); } catch (e) { /* ignore */ }
        }
      }
      refreshCloudInfo();
      return true;
    }).catch(function (err) {
      setCloudState('云端保存失败', 'err');
      if (manual || !cloudErrorShown) {
        cloudErrorShown = true;
        toast('云端保存失败：' + (err && err.message ? err.message : err));
      }
      throw err;
    });
  }

  function cloudSaveNow(manual) {
    if (!cloudReady()) {
      if (manual) toast('云端未配置');
      return Promise.reject(new Error('云端未配置'));
    }
    if (!E) return Promise.resolve(false);
    normalize();
    var data;
    try { data = JSON.parse(JSON.stringify(E)); } catch (e) { data = E; }
    var title = cloudTitle();
    setCloudState('保存中…', 'saving');
    var job = function () { return doCloudSave(data, title, manual); };
    cloudQueue = cloudQueue.then(job, job);
    return cloudQueue;
  }

  function scheduleCloudSave() {
    if (!cloudReady()) return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () {
      cloudSaveNow(false).catch(function () { /* already shown */ });
    }, 1200);
  }

  function checkCloud() {
    if (!E || !panel || !panel.classList.contains('show') || !cloudReady()) return;
    var snap;
    try { snap = JSON.stringify(E); } catch (e) { return; }
    if (snap === lastCloudSnap) return;
    lastCloudSnap = snap;
    scheduleCloudSave();
  }

  function showShareDialog(url) {
    var old = document.getElementById('wbShareMask');
    if (old) old.remove();
    var mask = document.createElement('div');
    mask.id = 'wbShareMask';
    mask.className = 'wbShareMask';
    mask.innerHTML = ''
      + '<div class="wbShareBox">'
      + '  <div class="wbShareHead"><b>分享我的作品</b><button type="button" class="wbClose" id="wbShareClose">✕</button></div>'
      + '  <p class="wbShareHint">别人打开这个链接只能看，不能改。你之后更新内容，需要再点一次「分享我的作品」才会更新快照。</p>'
      + '  <input id="wbShareUrl" readonly value="' + esc(url) + '">'
      + '  <div class="wbRowBtns">'
      + '    <button type="button" class="wbBtn primary" id="wbShareCopy">复制链接</button>'
      + '    <a class="wbBtn" id="wbShareOpen" target="_blank" rel="noopener" href="' + esc(url) + '">打开预览</a>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(mask);
    function close() { mask.remove(); }
    document.getElementById('wbShareClose').addEventListener('click', close);
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    document.getElementById('wbShareCopy').addEventListener('click', function () {
      var input = document.getElementById('wbShareUrl');
      function done() { toast('分享链接已复制'); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () {
          input.select();
          try { document.execCommand('copy'); } catch (e) { /* ignore */ }
          done();
        });
      } else {
        input.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        done();
      }
    });
    setTimeout(function () { document.getElementById('wbShareUrl').select(); }, 50);
  }

  function shareCloud() {
    if (!cloudReady()) { toast('云端未配置'); return; }
    if (!E) return;
    normalize();
    var data;
    try { data = JSON.parse(JSON.stringify(E)); } catch (e) { data = E; }
    setCloudState('发布中…', 'saving');
    toast('正在发布作品…');
    WB.cloud.publish(data, cloudTitle()).then(function (res) {
      setCloudState('已发布', 'ok');
      refreshCloudInfo();
      showShareDialog(WB.cloud.shareUrl(res.id));
    }).catch(function (err) {
      setCloudState('发布失败', 'err');
      toast('发布失败：' + (err && err.message ? err.message : err));
    });
  }

  function save() {
    if (!E) return;
    normalize();
    var pin = String((E.lock && E.lock.pin) || '');
    if (pin && !/^\d{4}$/.test(pin)) {
      tab = 'profile';
      render();
      toast('锁屏密码必须是 4 位数字，或留空');
      return;
    }
    function finish() {
      try {
        WB.saveConfig(E, { clearWallpaper: wallpaperTouched });
        dirty = false;
        try { sessionStorage.setItem('wb_after_edit', '1'); } catch (e) { /* ignore */ }
        toast('已保存，正在刷新…');
        setTimeout(function () { location.reload(); }, 450);
      } catch (err) {
        toast('保存失败：' + (err && err.message ? err.message : err));
      }
    }
    if (cloudReady()) {
      toast('正在保存到云端…');
      cloudSaveNow(true).then(finish, finish);
    } else {
      finish();
    }
  }

  /* ---------------- actions ---------------- */
  function addContact() {
    var cid = 'c' + Date.now().toString(36);
    E.contacts[cid] = { name: 'New contact', avatar: PH_IMG, status: 'Online' };
    E.chats[cid] = [];
    E.unread[cid] = 0;
    E.liveScript[cid] = [];
    chatSel = cid;
    dirty = true;
    render();
  }

  function delContact(cid) {
    var c = E.contacts[cid] || {};
    if (!confirm('删除「' + (c.name || cid) + '」及其聊天记录？')) return;
    delete E.contacts[cid];
    delete E.chats[cid];
    delete E.unread[cid];
    delete E.liveScript[cid];
    if (E.lock && Array.isArray(E.lock.notifications)) {
      E.lock.notifications = E.lock.notifications.filter(function (n) { return n.chat !== cid; });
    }
    if (E.call && E.call.contact === cid) E.call.contact = Object.keys(E.contacts)[0] || '';
    if (chatSel === cid) chatSel = Object.keys(E.contacts)[0] || '';
    dirty = true;
    render();
  }

  function importBulk(replace) {
    if (!chatBulk.trim()) { toast('先在上面的框里粘贴聊天内容'); return; }
    var out = [];
    chatBulk.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var m = line.match(/^(我|me|对方|他|她|them|日期|date)\s*[:：]\s*(.*)$/i);
      if (!m) { out.push({ t: 'them', text: line }); return; }
      var key = m[1].toLowerCase();
      var text = m[2];
      if (key === '日期' || key === 'date') out.push({ t: 'date', text: text || 'Today' });
      else if (key === '我' || key === 'me') out.push({ t: 'me', text: text });
      else out.push({ t: 'them', text: text });
    });
    if (!out.length) { toast('没有识别到内容'); return; }
    var arr = E.chats[chatSel] || (E.chats[chatSel] = []);
    if (replace) {
      if (!confirm('用粘贴的内容替换当前这段聊天的全部记录？')) return;
      arr.splice(0, arr.length);
    }
    out.forEach(function (m) { arr.push(m); });
    chatBulk = '';
    dirty = true;
    render();
    toast((replace ? '已替换为 ' : '已追加 ') + out.length + ' 条消息');
  }

  function setMsgType(cid, i, t) {
    var m = (E.chats[cid] || [])[i];
    if (!m) return;
    if (t === 'voice') {
      m.t = 'them';
      m.voice = m.voice || '0:03';
      if (typeof m.src !== 'string') m.src = '';
      delete m.text;
    } else {
      delete m.voice;
      delete m.src;
      m.t = t;
      if (typeof m.text !== 'string') m.text = t === 'date' ? 'Today' : '';
      if (t === 'date' && !m.text) m.text = 'Today';
    }
    dirty = true;
    render();
  }

  function addMsg(cid, kind) {
    var arr = E.chats[cid] || (E.chats[cid] = []);
    if (kind === 'date') arr.push({ t: 'date', text: 'Today' });
    else if (kind === 'me') arr.push({ t: 'me', text: '' });
    else if (kind === 'voice') arr.push({ t: 'them', voice: '0:03', src: '' });
    else arr.push({ t: 'them', text: '' });
    dirty = true;
    render();
  }

  function moveArr(arr, i, dir) {
    if (!Array.isArray(arr)) return;
    if (dir === 0) { arr.splice(i, 1); return; }
    var j = i + dir;
    if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }

  function action(act, el) {
    var d = el.dataset;
    if (act === 'tab') { tab = d.tab; render(true); return; }
    if (act === 'media-clear') {
      setPath(E, d.path, '');
      if (d.path === 'wallpaper') wallpaperTouched = true;
      dirty = true; render(); return;
    }
    if (act === 'open-chat') {
      chatSel = d.cid; tab = 'chats'; render(); return;
    }
    if (act === 'add-contact') return addContact();
    if (act === 'del-contact') return delContact(d.cid);
    if (act === 'add-msg') return addMsg(d.cid, d.kind);
    if (act === 'bulk-append') return importBulk(false);
    if (act === 'bulk-replace') return importBulk(true);
    if (act === 'del-msg') {
      (E.chats[d.cid] || []).splice(Number(d.i), 1); dirty = true; render(); return;
    }
    if (act === 'move-msg') {
      moveArr(E.chats[d.cid], Number(d.i), Number(d.dir)); dirty = true; render(); return;
    }
    if (act === 'add-section') {
      E.photos.push({ month: 'New album', items: [] }); dirty = true; render(); return;
    }
    if (act === 'del-section') {
      if (!confirm('删除这一整组照片？')) return;
      E.photos.splice(Number(d.i), 1); dirty = true; render(); return;
    }
    if (act === 'del-photo') {
      var sec = E.photos[Number(d.i)];
      if (sec) sec.items.splice(Number(d.j), 1);
      dirty = true; render(); return;
    }
    if (act === 'move-photo') {
      var sec2 = E.photos[Number(d.i)];
      if (sec2) moveArr(sec2.items, Number(d.j), Number(d.dir));
      dirty = true; render(); return;
    }
    if (act === 'add-song') {
      E.songs.push({ title: 'New song', artist: (E.owner && E.owner.name) || '', cover: PH_IMG, src: '' });
      dirty = true; render(); return;
    }
    if (act === 'del-song') {
      if (!confirm('删除这首歌？')) return;
      E.songs.splice(Number(d.i), 1); dirty = true; render(); return;
    }
    if (act === 'move-song') {
      moveArr(E.songs, Number(d.i), Number(d.dir)); dirty = true; render(); return;
    }
    if (act === 'add-note') {
      E.notes.push({ title: 'New note', date: new Date().toISOString().slice(0, 10), body: '' });
      dirty = true; render(); return;
    }
    if (act === 'del-note') {
      E.notes.splice(Number(d.i), 1); dirty = true; render(); return;
    }
    if (act === 'move-note') {
      moveArr(E.notes, Number(d.i), Number(d.dir)); dirty = true; render(); return;
    }
    if (act === 'add-event') {
      E.events.push({ date: new Date().toISOString().slice(0, 10), time: '', title: 'New event', place: '' });
      dirty = true; render(); return;
    }
    if (act === 'del-event') {
      E.events.splice(Number(d.i), 1); dirty = true; render(); return;
    }
    if (act === 'move-event') {
      moveArr(E.events, Number(d.i), Number(d.dir)); dirty = true; render(); return;
    }
    if (act === 'add-mail') {
      E.mails.push({ from: '', subject: 'New mail', date: '', unread: false, body: '' });
      dirty = true; render(); return;
    }
    if (act === 'del-mail') {
      E.mails.splice(Number(d.i), 1); dirty = true; render(); return;
    }
    if (act === 'move-mail') {
      moveArr(E.mails, Number(d.i), Number(d.dir)); dirty = true; render(); return;
    }
    if (act === 'add-call') {
      E.calls.push({
        contact: Object.keys(E.contacts)[0] || '', type: 'in',
        time: 'Today', dur: '', seen: true
      });
      dirty = true; render(); return;
    }
    if (act === 'del-call') {
      E.calls.splice(Number(d.i), 1); dirty = true; render(); return;
    }
    if (act === 'ig-del') {
      E.social.instagram.photos.splice(Number(d.i), 1); dirty = true; render(); return;
    }
    if (act === 'ig-move') {
      moveArr(E.social.instagram.photos, Number(d.i), Number(d.dir)); dirty = true; render(); return;
    }
    if (act === 'add-tweet') {
      E.social.twitter.tweets = E.social.twitter.tweets || [];
      E.social.twitter.tweets.push({ text: '', time: 'now', replies: '0', retweets: '0', likes: '0' });
      dirty = true; render(); return;
    }
    if (act === 'del-tweet') {
      E.social.twitter.tweets.splice(Number(d.i), 1); dirty = true; render(); return;
    }
    if (act === 'move-tweet') {
      moveArr(E.social.twitter.tweets, Number(d.i), Number(d.dir)); dirty = true; render(); return;
    }
    if (act === 'add-fb') {
      E.social.facebook.posts = E.social.facebook.posts || [];
      E.social.facebook.posts.push({ text: '', time: 'now', likes: '0' });
      dirty = true; render(); return;
    }
    if (act === 'del-fb') {
      E.social.facebook.posts.splice(Number(d.i), 1); dirty = true; render(); return;
    }
    if (act === 'move-fb') {
      moveArr(E.social.facebook.posts, Number(d.i), Number(d.dir)); dirty = true; render(); return;
    }
    if (act === 'add-notif') {
      E.lock.notifications.push({
        icon: '💬', app: 'Messages', title: '', text: '', time: 'now',
        chat: Object.keys(E.contacts)[0] || ''
      });
      dirty = true; render(); return;
    }
    if (act === 'del-notif') {
      E.lock.notifications.splice(Number(d.i), 1); dirty = true; render(); return;
    }
    if (act === 'export-backup') return exportBackup(true);
    if (act === 'export-text') return exportBackup(false);
    if (act === 'export-datajs') return exportDataJS();
    if (act === 'share-html') return sharePage(false);
    if (act === 'share-zip') return sharePage(true);
    if (act === 'cloud-share') return shareCloud();
    if (act === 'cloud-save') {
      cloudSaveNow(true).then(function () {
        toast('已保存到云端');
      }).catch(function () { /* toast already shown */ });
      return;
    }
    if (act === 'import-backup') {
      var inp = document.getElementById('wbImportFile');
      if (inp) inp.click();
      return;
    }
    if (act === 'prune') {
      if (!confirm('删除没有被任何地方使用的上传素材？')) return;
      WB.prune().then(function (n) {
        toast(n ? '已清理 ' + n + ' 个素材' : '没有可清理的素材');
        render();
      }).catch(function (e) { toast('清理失败：' + e.message); });
      return;
    }
    if (act === 'reset') {
      if (!confirm('确定恢复默认内容？所有自定义内容、上传素材、密码和备忘录修改都会被清除。')) return;
      WB.reset();
      WB.clearMedia().catch(function () { /* ignore */ }).then(function () {
        location.reload();
      });
    }
  }

  function stamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function exportBackup(includeMedia) {
    toast(includeMedia ? '正在打包图片和音乐…' : '正在导出…');
    WB.exportBackup(includeMedia).then(function (obj) {
      WB.download('idol-phone-backup-' + stamp() + '.json', JSON.stringify(obj));
      toast('备份已导出');
    }).catch(function (e) {
      toast('导出失败：' + (e && e.message ? e.message : e));
    });
  }

  function sharePage(asZip) {
    toast('正在打包图片和音乐，素材多时需要几秒…');
    WB.buildShareHTML().then(function (html) {
      var mb = (new Blob([html]).size / 1024 / 1024).toFixed(1);
      if (asZip) {
        WB.downloadBlob('idol-phone-share.zip', WB.zipFile('index.html', html));
        toast('已生成 ' + mb + ' MB 的分享压缩包 — 拖到 Netlify Drop 即可得到网址');
      } else {
        WB.download('index.html', html, 'text/html;charset=utf-8');
        toast('已生成 ' + mb + ' MB 的 index.html — 对方双击就能打开');
      }
    }).catch(function (e) {
      toast('生成失败：' + (e && e.message ? e.message : e));
    });
  }

  function exportDataJS() {
    toast('正在生成 data.js，素材多时需要几秒…');
    WB.exportDataJS().then(function (txt) {
      WB.download('data.js', txt, 'text/javascript');
      toast('已导出 data.js — 替换文件夹里的同名文件即可');
    }).catch(function (e) {
      toast('导出失败：' + (e && e.message ? e.message : e));
    });
  }

  function importFile(file) {
    if (!file) return;
    toast('正在导入…');
    var r = new FileReader();
    r.onload = function () {
      var obj;
      try { obj = JSON.parse(r.result); } catch (e) { toast('不是有效的 JSON 备份'); return; }
      WB.importBackup(obj).then(function () {
        toast('导入成功，正在刷新…');
        setTimeout(function () { location.reload(); }, 600);
      }).catch(function (e) {
        toast('导入失败：' + (e && e.message ? e.message : e));
      });
    };
    r.onerror = function () { toast('读取文件失败'); };
    r.readAsText(file);
  }

  function uploadMedia(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var path = input.dataset.media;
    var kind = input.dataset.kind || 'image';
    toast('正在处理素材…');
    WB.addFile(file, kind).then(function (r) {
      setPath(E, path, r.ref);
      if (path === 'wallpaper') wallpaperTouched = true;
      dirty = true;
      render();
      toast(kind === 'audio' ? '音频已添加' : '图片已添加');
    }).catch(function (e) {
      toast('上传失败：' + (e && e.message ? e.message : e) + '（请用 Chrome / Edge 打开）');
    });
    input.value = '';
  }

  function uploadMulti(input) {
    var files = input.files;
    if (!files || !files.length) return;
    var path = input.dataset.multi;
    var mode = input.dataset.multiKind;
    var arr = getPath(E, path);
    if (!Array.isArray(arr)) { arr = []; setPath(E, path, arr); }
    toast('正在上传 ' + files.length + ' 张图片…');
    var jobs = Array.prototype.map.call(files, function (f) {
      return WB.addFile(f, 'image');
    });
    Promise.all(jobs).then(function (res) {
      res.forEach(function (r) {
        arr.push(mode === 'igphoto' ? r.ref : { src: r.ref, cap: '' });
      });
      dirty = true;
      render();
      toast('已添加 ' + res.length + ' 张图片');
    }).catch(function (e) {
      toast('上传失败：' + (e && e.message ? e.message : e));
    });
    input.value = '';
  }

  /* ---------------- events ---------------- */
  function bind() {
    panel = document.getElementById('wbPanel');
    bodyEl = document.getElementById('wbBody');
    tabsEl = document.getElementById('wbTabs');

    document.getElementById('wbOpenBtn').addEventListener('click', open);
    document.getElementById('wbCloseBtn').addEventListener('click', function () { close(false); });
    document.getElementById('wbSaveBtn').addEventListener('click', save);

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b) { e.preventDefault(); action(b.dataset.act, b); }
    });

    function onValue(el) {
      if (!E) return;
      if (el.id === 'wbChatSel') {
        chatSel = el.value;
        chatBulk = '';
        render(true);
        return;
      }
      if (el.id === 'wbChatBulk') {
        chatBulk = el.value;
        return;
      }
      if (el.matches('[data-lines]')) {
        var arr = el.value.split('\n').map(function (s) { return s.replace(/\s+$/, ''); })
          .filter(function (s) { return s.trim() !== ''; });
        setPath(E, el.dataset.lines, arr);
        dirty = true;
        return;
      }
      if (!el.matches('[data-path]')) return;
      var path = el.dataset.path;
      if (!path) return;
      var val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.dataset.num) val = Number(el.value) || 0;
      else val = el.value;
      setPath(E, path, val);
      dirty = true;
      if (path === 'theme.accent') document.documentElement.style.setProperty('--accent', val);
      if (path === 'theme.accent2') document.documentElement.style.setProperty('--accent2', val);
    }

    bodyEl.addEventListener('input', function (e) {
      if (e.target.id === 'wbChatBulk') { chatBulk = e.target.value; return; }
      if (e.target.matches('input[data-path], textarea[data-path], select[data-path], input[data-lines], textarea[data-lines]')) {
        onValue(e.target);
      }
    });
    bodyEl.addEventListener('change', function (e) {
      var el = e.target;
      if (el.matches('input[type="file"][data-media]')) { uploadMedia(el); return; }
      if (el.matches('input[type="file"][data-multi]')) { uploadMulti(el); return; }
      if (el.id === 'wbImportFile') { importFile(el.files && el.files[0]); el.value = ''; return; }
      if (el.id === 'wbBulkFile') {
        var f = el.files && el.files[0];
        if (f) {
          var fr = new FileReader();
          fr.onload = function () {
            chatBulk = String(fr.result || '');
            render();
            toast('已读取 ' + f.name);
          };
          fr.onerror = function () { toast('读取文件失败'); };
          fr.readAsText(f);
        }
        el.value = '';
        return;
      }
      if (el.matches('select[data-msgtype]')) {
        setMsgType(el.dataset.cid, Number(el.dataset.i), el.value);
        return;
      }
      if (el.matches('select[data-path], input[type="checkbox"][data-path], input[type="color"][data-path]')) {
        onValue(el);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('show')) close(false);
    });

    window.addEventListener('beforeunload', function (e) {
      if (dirty && panel.classList.contains('show')) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  function start() {
    var wrap = document.createElement('div');
    wrap.id = 'wbRoot';
    wrap.innerHTML = ''
      + '<button type="button" id="wbOpenBtn" class="wbOpenBtn" title="自定义这个网页">✎ <span>自定义</span></button>'
      + '<div class="wbPanel" id="wbPanel">'
      + '  <div class="wbHead"><div class="wbTitle"><b>个性化定制</b><span>改完点右上角「保存并应用」</span><em id="wbCloudState" class="wbCloudState"></em></div>'
      + '    <div class="wbHeadBtns"><button type="button" id="wbSaveBtn" class="wbSave">保存并应用</button>'
      + '    <button type="button" id="wbCloseBtn" class="wbClose" aria-label="关闭">✕</button></div></div>'
      + '  <div class="wbTabs" id="wbTabs"></div>'
      + '  <div class="wbBody" id="wbBody"></div>'
      + '</div>'
      + '<div class="wbToast" id="wbToast"></div>';
    document.body.appendChild(wrap);
    bind();
    setInterval(checkCloud, 1500);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && dirty && cloudReady()) {
        cloudSaveNow(false).catch(function () { /* ignore */ });
      }
    });
  }

  function boot() {
    var tries = 0;
    (function tick() {
      if (window.WB && WB.ready) { start(); return; }
      if (tries++ > 120) { start(); return; }
      setTimeout(tick, 100);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
