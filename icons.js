/* =========================================================
   iOS 4 风格图标（全部用 SVG 手绘，无外部素材）
   每个图标调用一次生成带唯一 id 的 SVG，可重复使用
   ========================================================= */
window.ICON_SVG = (function () {
  'use strict';
  let n = 0;

  function frame(bg, inner, defs, gloss) {
    const u = 'ic' + (n++);
    const g = (gloss === undefined ? 0.5 : gloss);
    return `<svg viewBox="0 0 64 64" class="appSvg" aria-hidden="true">
      <defs>
        <linearGradient id="${u}bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/>
        </linearGradient>
        <linearGradient id="${u}gl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".85"/>
          <stop offset=".55" stop-color="#fff" stop-opacity=".14"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
        <clipPath id="${u}cp"><rect width="64" height="64" rx="11"/></clipPath>
        ${defs ? defs(u) : ''}
      </defs>
      <g clip-path="url(#${u}cp)">
        <rect width="64" height="64" fill="url(#${u}bg)"/>
        ${inner(u)}
        <path d="M0 0 H64 V30 C50 38 14 38 0 30 Z" fill="url(#${u}gl)" opacity="${g}"/>
        <rect x=".5" y=".5" width="63" height="63" rx="10.5"
              fill="none" stroke="#000" stroke-opacity=".22"/>
      </g>
    </svg>`;
  }

  /* 信息：绿色 + 白色对话气泡 */
  function chat() {
    return frame(['#a9ee7c', '#0d9700'],
      (u) => `<path d="M18 13 H46 A9 9 0 0 1 55 22 V36 A9 9 0 0 1 46 45 H34 L25 54 V45 H18 A9 9 0 0 1 9 36 V22 A9 9 0 0 1 18 13 Z"
        fill="url(#${u}bb)" stroke="#c4c4c4" stroke-width=".8"/>`,
      (u) => `<linearGradient id="${u}bb" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d8d8d8"/></linearGradient>`);
  }

  /* 相册：向日葵 */
  function photos() {
    const petals = Array.from({ length: 12 }, (_, i) =>
      `<ellipse cx="32" cy="14.5" rx="5" ry="12" transform="rotate(${i * 30} 32 30)"/>`).join('');
    return frame(['#c3ecff', '#1d6f9e'],
      (u) => `<rect y="37" width="64" height="27" fill="url(#${u}water)"/>
        <g fill="url(#${u}petal)">${petals}</g>
        <circle cx="32" cy="30" r="9.5" fill="url(#${u}core)"/>
        <circle cx="32" cy="30" r="9.5" fill="none" stroke="#2a1a06" stroke-opacity=".35"/>`,
      (u) => `<linearGradient id="${u}water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3f8fbd"/><stop offset="1" stop-color="#123a5e"/></linearGradient>
        <linearGradient id="${u}petal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff47d"/><stop offset="1" stop-color="#f0a300"/></linearGradient>
        <radialGradient id="${u}core">
          <stop offset="0" stop-color="#7a5426"/><stop offset="1" stop-color="#38200a"/></radialGradient>`);
  }

  /* 音乐：紫色 + 白色音符 */
  function music() {
    return frame(['#d98bff', '#65159c'],
      () => `<g fill="#ffffff">
        <rect x="20" y="19" width="5" height="25" rx="2.5"/>
        <rect x="39" y="16" width="5" height="25" rx="2.5"/>
        <path d="M20 19 L44 15 L44 21 L20 25 Z"/>
        <ellipse cx="17" cy="45" rx="7" ry="5" transform="rotate(-18 17 45)"/>
        <ellipse cx="36" cy="42" rx="7" ry="5" transform="rotate(-18 36 42)"/>
      </g>`);
  }

  /* 备忘录：黄色便签纸 */
  function notes() {
    let lines = '';
    for (let y = 23; y <= 53; y += 6) {
      lines += `<rect x="10" y="${y}" width="44" height="1.5" fill="#c9a63c" opacity=".65"/>`;
    }
    return frame(['#ffe98f', '#e8b61c'],
      (u) => `<rect width="64" height="12" fill="url(#${u}top)"/>
        <rect y="12" width="64" height="2.5" fill="#000" opacity=".12"/>
        ${lines}`,
      (u) => `<linearGradient id="${u}top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#cfa94f"/><stop offset="1" stop-color="#a37c27"/></linearGradient>`);
  }

  /* 日历：自动显示今天 */
  function calendar() {
    const d = new Date();
    const wd = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
    return frame(['#ffffff', '#d8d8d8'],
      (u) => `<rect width="64" height="18" fill="url(#${u}red)"/>
        <text x="32" y="13" text-anchor="middle" font-size="9" font-family="Helvetica,Arial,sans-serif"
              fill="#ffffff">${wd}</text>
        <text x="32" y="50" text-anchor="middle" font-size="30" font-weight="300"
              font-family="Helvetica,Arial,sans-serif" fill="#1a1a1a">${d.getDate()}</text>`,
      (u) => `<linearGradient id="${u}red" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e43f3f"/><stop offset="1" stop-color="#a60000"/></linearGradient>`,
      0.35);
  }

  /* 邮件：蓝色 + 白色信封 */
  function mail() {
    return frame(['#9bd8ff', '#1b6dcf'],
      (u) => `<rect x="9" y="17" width="46" height="30" rx="3.5" fill="url(#${u}env)"
                 stroke="#b9c9d8" stroke-width=".8"/>
        <path d="M10 19 L32 35 L54 19" fill="none" stroke="#9fb4c8" stroke-width="2" stroke-linejoin="round"/>
        <path d="M10 45 L26 31 M54 45 L38 31" stroke="#c3d2e0" stroke-width="1.5"/>`,
      (u) => `<linearGradient id="${u}env" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dde6ee"/></linearGradient>`);
  }

  /* 电话：绿色 + 白色听筒 */
  function phone() {
    return frame(['#93e574', '#119a00'],
      (u) => `<g transform="rotate(-45 32 32)" fill="url(#${u}hand)">
        <rect x="22" y="9" width="20" height="10" rx="5"/>
        <rect x="28.5" y="17" width="7" height="30" rx="3.5"/>
        <rect x="22" y="45" width="20" height="10" rx="5"/>
      </g>`,
      (u) => `<linearGradient id="${u}hand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e0e0e0"/></linearGradient>`);
  }

  /* 人像（备用） */
  function about() {
    return frame(['#8d95a4', '#323844'],
      (u) => `<circle cx="32" cy="24" r="8.5" fill="url(#${u}per)"/>
        <path d="M13 53 C13 42 21 36 32 36 C43 36 51 42 51 53 Z" fill="url(#${u}per)"/>`,
      (u) => `<linearGradient id="${u}per" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ccd4de"/></linearGradient>`,
      0.4);
  }

  /* Instagram：复古相机 */
  function instagram() {
    return frame(['#f0c9a0', '#a06a3c'],
      () => `<rect x="23" y="12" width="18" height="7" rx="2.5" fill="#5a3d24"/>
        <rect x="9" y="17" width="46" height="32" rx="6" fill="#6b4b2f"/>
        <rect x="9" y="17" width="46" height="9" rx="6" fill="#8a623d"/>
        <rect x="13" y="21" width="7" height="5" rx="1.5" fill="#e8e2d0"/>
        <circle cx="50" cy="22" r="2.2" fill="#d33838"/>
        <circle cx="32" cy="34" r="12" fill="#2b2b2b"/>
        <circle cx="32" cy="34" r="8.5" fill="#4a7bd8"/>
        <circle cx="29" cy="31" r="2.6" fill="#cfe3ff" opacity=".85"/>
        <rect x="30" y="45" width="4" height="2" rx="1" fill="#2b2b2b"/>`,
      null, 0.35);
  }

  /* Twitter：蓝色 + 白鸟 */
  function twitter() {
    return frame(['#8fdcff', '#0b8bd6'],
      () => `<g transform="translate(4,4) scale(2.35)" fill="#ffffff">
        <path d="M23.643 4.937c-.835.37-1.732.62-2.675.733a4.67 4.67 0 0 0 2.048-2.578 9.3 9.3 0 0 1-2.958 1.13 4.66 4.66 0 0 0-7.938 4.25 13.229 13.229 0 0 1-9.602-4.868c-.4.69-.63 1.49-.63 2.342A4.66 4.66 0 0 0 3.96 9.824a4.647 4.647 0 0 1-2.11-.583v.06a4.66 4.66 0 0 0 3.737 4.568 4.692 4.692 0 0 1-2.104.08 4.661 4.661 0 0 0 4.352 3.234 9.348 9.348 0 0 1-5.786 1.995 9.5 9.5 0 0 1-1.112-.065 13.175 13.175 0 0 0 7.14 2.093c8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602a9.47 9.47 0 0 0 2.323-2.41z"/>
      </g>`, null, 0.4);
  }

  /* Facebook：蓝色 + 白色 f */
  function facebook() {
    return frame(['#7fa8ff', '#0b4fbf'],
      () => `<text x="33" y="48" text-anchor="middle" font-size="42" font-weight="bold"
          font-family="Helvetica,Arial,sans-serif" fill="#ffffff">f</text>`, null, 0.35);
  }

  /* 设置：三个齿轮 */
  function settings() {
    return frame(['#7d838d', '#2c2f36'],
      () => `<g>
        <circle cx="32" cy="26" r="12" fill="none" stroke="#d8dde4" stroke-width="6" stroke-dasharray="3.2 3.2"/>
        <circle cx="32" cy="26" r="6.5" fill="#d8dde4"/>
        <circle cx="21" cy="41" r="8.5" fill="none" stroke="#a8b0bb" stroke-width="5" stroke-dasharray="2.8 2.8"/>
        <circle cx="21" cy="41" r="4.5" fill="#a8b0bb"/>
        <circle cx="43" cy="42" r="7.5" fill="none" stroke="#bfc6d0" stroke-width="4.5" stroke-dasharray="2.6 2.6"/>
        <circle cx="43" cy="42" r="4" fill="#bfc6d0"/>
      </g>`, null, 0.35);
  }


  /* 时钟：白表盘 + 10:10 */
  function clock() {
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = i * Math.PI / 6;
      const x1 = 32 + Math.sin(a) * 19, y1 = 32 - Math.cos(a) * 19;
      const x2 = 32 + Math.sin(a) * 21.5, y2 = 32 - Math.cos(a) * 21.5;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }).join('');
    return frame(['#ffffff', '#d5d5d5'],
      () => `<circle cx="32" cy="32" r="22" fill="#ffffff" stroke="#2a2a2a" stroke-width="3"/>
        <g stroke="#2a2a2a" stroke-width="1.4" stroke-linecap="round">${ticks}</g>
        <g stroke="#1a1a1a" stroke-width="2.6" stroke-linecap="round">
          <line x1="32" y1="32" x2="21.6" y2="26"/>
          <line x1="32" y1="32" x2="45" y2="24.5"/>
        </g>
        <line x1="32" y1="32" x2="23.5" y2="46.7" stroke="#d33" stroke-width="1.3" stroke-linecap="round"/>
        <circle cx="32" cy="32" r="2" fill="#1a1a1a"/>`,
      null, 0.3);
  }

  /* 计算器：深色机身 + 橙色运算列 */
  function calculator() {
    let btns = '';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        btns += `<circle cx="${14 + c * 12}" cy="${29 + r * 9}" r="4.1"
          fill="${c === 3 ? '#ff9500' : '#6e6e6e'}"/>`;
      }
    }
    return frame(['#3c3c3c', '#0e0e0e'],
      () => `<rect x="10" y="8" width="44" height="13" rx="2.5" fill="#cfe8b8"/>
        ${btns}`, null, 0.35);
  }

  /* 天气：蓝天 + 太阳 + 云 */
  function weather() {
    return frame(['#7cc9ff', '#0a5fa8'],
      () => `<circle cx="25" cy="25" r="9.5" fill="#ffd93b"/>
        <g fill="#ffffff">
          <circle cx="36" cy="35" r="9"/>
          <circle cx="45" cy="37" r="7"/>
          <rect x="26" y="35" width="24" height="9" rx="4.5"/>
        </g>`, null, 0.35);
  }

  return { chat, photos, music, notes, calendar, mail, phone, settings, instagram, twitter, facebook, clock, calculator, weather };
})();
