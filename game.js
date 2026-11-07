/* Westie Hunt: a small 3D game for the Westie Trail app. Level 3: The Old Mill, 12 Westies over 4 floors joined by ladders. Level 4: The Tower, every trail Westie over 7 themed floors. Level 1: walk round a mini Ayr, find 10 painted
   Westie statues, dodge cars and seagulls. Level 2: a seeded forest maze with 8 Westies, foxes, badgers and an exit gate. Needs global THREE (r128) and WestieStatue (statue.js).
   API: WestieGame.mount(containerEl) -> { pause(), resume(), dispose() } */
(function () {
  'use strict';
  var STATUES = 10, FOREST_STATUES = 8, LIVES = 3, SPEED = 7, PR = 0.6, BEST_KEY = 'westie-game-best';
  var START = [-46.5, 0];

  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Push a circle (x, z, radius r) out of axis-aligned boxes [minX, minZ, maxX, maxZ]. Returns [x, z].
  var CO = [0, 0]; // reused result array (read it before the next call)
  function collide(x, z, r, boxes) {
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (x + r <= b[0] || x - r >= b[2] || z + r <= b[1] || z - r >= b[3]) continue;
        var cx = x < b[0] ? b[0] : x > b[2] ? b[2] : x, cz = z < b[1] ? b[1] : z > b[3] ? b[3] : z;
        var dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) { var d = Math.sqrt(d2); x = cx + dx / d * r; z = cz + dz / d * r; }
        else { // centre inside the box: leave by the nearest side
          var l = x - b[0], rt = b[2] - x, t = z - b[1], bo = b[3] - z, m = Math.min(l, rt, t, bo);
          if (m === l) x = b[0] - r; else if (m === rt) x = b[2] + r; else if (m === t) z = b[1] - r; else z = b[3] + r;
        }
      }
    }
    CO[0] = x; CO[1] = z; return CO;
  }
  (function selfCheck() {
    var B = [[0, 0, 2, 2]], p;
    p = collide(-0.2, 1, 0.5, B); console.assert(Math.abs(p[0] + 0.5) < 1e-9 && p[1] === 1, 'collide: push out of left side');
    p = collide(5, 5, 0.5, B); console.assert(p[0] === 5 && p[1] === 5, 'collide: free space untouched');
    p = collide(1, 0.3, 0.5, B); console.assert(p[0] === 1 && p[1] === -0.5, 'collide: centre inside exits nearest side');
    p = collide(2.2, 2.2, 0.5, B); console.assert(Math.abs(Math.hypot(p[0] - 2, p[1] - 2) - 0.5) < 1e-9, 'collide: corner pushes out radially');
  })();

  var CSS = [
    '.wg-root{position:relative;width:100%;height:100%;overflow:hidden;font:16px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-user-select:none;user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;background:#bfe0f5;',
    '--wg-glass:rgba(255,255,255,.9);--wg-edge:rgba(255,255,255,.75);--wg-ink:#16203a;--wg-card:rgba(255,255,255,.95);--wg-tile:#eef2fa;--wg-tile-h:#e2e9f7;--wg-accent:#1f3b73;--wg-muted:#4d5573;--wg-gold:#f2b632}',
    '@media (prefers-color-scheme:dark){.wg-root{--wg-glass:rgba(16,22,36,.86);--wg-edge:rgba(255,255,255,.14);--wg-ink:#eef1fa;--wg-card:rgba(24,30,46,.96);--wg-tile:#26304a;--wg-tile-h:#2e3a58;--wg-accent:#3d63c9;--wg-muted:#b3bad0}}',
    '.wg-root canvas{position:absolute;left:0;top:0;display:block}',
    '.wg-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 85% 75% at 50% 48%,rgba(0,0,0,0) 60%,rgba(8,16,32,.32) 100%)}',
    '.wg-bar{position:absolute;top:8px;left:8px;right:8px;display:flex;gap:6px;align-items:center;pointer-events:none}',
    '.wg-pill{background:var(--wg-glass);border:1px solid var(--wg-edge);color:var(--wg-ink);border-radius:999px;padding:0 12px;height:44px;display:flex;align-items:center;gap:6px;font-weight:800;font-size:18px;box-shadow:0 4px 14px rgba(0,0,0,.16);white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.wg-pill small{font-size:14px;font-weight:700;opacity:.7}',
    '.wg-ico{width:22px;height:22px;flex:none;fill:currentColor}',
    '.wg-hearts{gap:1px;padding:0 10px}.wg-hearts svg{width:24px;height:24px;fill:#ec4058;filter:drop-shadow(0 1px 1px rgba(0,0,0,.2));transition:transform .3s}.wg-hearts svg.wg-lost{fill:#9aa1b0;opacity:.45;transform:scale(.85)}',
    '.wg-found .wg-ico{fill:#e09b00}.wg-time{margin-left:auto}',
    '.wg-floor{display:none}.wg-tower .wg-floor{display:flex}',
    '.wg-btn{pointer-events:auto;min-width:44px;height:44px;border:1px solid var(--wg-edge);border-radius:999px;background:var(--wg-glass);color:var(--wg-ink);font:inherit;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.16);display:grid;place-items:center;padding:0}',
    '.wg-btn svg{width:20px;height:20px;fill:currentColor}',
    '.wg-mus{position:absolute;top:60px;right:8px}.wg-mus svg{width:22px;height:22px}',
    '@media (max-width:420px){.wg-bar{gap:4px}.wg-pill{padding:0 8px;font-size:16px}.wg-hearts svg{width:20px;height:20px}.wg-ico{width:19px;height:19px}}',
    '.wg-nav{position:absolute;top:60px;left:50%;transform:translateX(-50%);pointer-events:none;font-size:16px}',
    '.wg-arrow{display:inline-block;width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:22px solid #e09b00;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25))}',
    '.wg-joy{--js:120px;position:absolute;left:0;top:0;width:var(--js);height:var(--js);margin:calc(var(--js) / -2) 0 0 calc(var(--js) / -2);border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.1),rgba(255,255,255,.3));border:2px solid rgba(255,255,255,.75);box-shadow:0 4px 16px rgba(0,0,0,.2);pointer-events:none;display:none}.wg-joy.wg-on{display:block}',
    '.wg-hint{position:absolute;left:10%;bottom:16%;width:120px;height:120px;pointer-events:none;display:none}.wg-hint.wg-on{display:block}.wg-hint i{position:absolute;left:30px;top:30px;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid #fff;box-shadow:0 0 0 12px rgba(255,255,255,.18);animation:wg-thumb 1.5s ease-in-out 2}',
    '@keyframes wg-thumb{0%{transform:translate(0,0);opacity:.5}15%{opacity:1}50%{transform:translate(38px,-34px)}85%{opacity:1}100%{transform:translate(0,0);opacity:.5}}',
    '.wg-knob{position:absolute;left:50%;top:50%;width:46%;height:46%;margin:-23% 0 0 -23%;border-radius:50%;background:linear-gradient(#fff,#e6ebf3);box-shadow:0 3px 8px rgba(0,0,0,.3);pointer-events:none}',
    '.wg-toast{position:absolute;left:50%;top:112px;transform:translate(-50%,-10px) scale(.96);background:linear-gradient(#ffd25e,#f2b632);color:#1b2440;font-weight:800;padding:10px 18px;border-radius:999px;opacity:0;transition:opacity .25s,transform .35s cubic-bezier(.2,1.4,.4,1);pointer-events:none;max-width:90%;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.25)}',
    '.wg-toast.wg-on{opacity:1;transform:translate(-50%,0) scale(1)}',
    '.wg-flash{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(226,61,79,0) 40%,rgba(226,61,79,.55) 100%);opacity:0;pointer-events:none;transition:opacity .5s}.wg-flash.wg-on{opacity:1;transition:none}',
    '.wg-screen{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(10,20,40,.4);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);padding:16px}.wg-screen.wg-on{display:flex}',
    '@keyframes wg-in{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}@keyframes wg-pop{0%{opacity:0;transform:scale(.3) rotate(-20deg)}70%{transform:scale(1.2)}100%{opacity:1;transform:none}}',
    '.wg-card{background:var(--wg-card);color:var(--wg-ink);border:1px solid var(--wg-edge);border-radius:22px;padding:22px 18px 18px;max-width:360px;width:100%;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.35);animation:wg-in .32s cubic-bezier(.2,.8,.2,1);max-height:100%;overflow:auto}',
    '.wg-card h2{margin:0 0 6px;font-size:1.55rem;letter-spacing:-.01em}.wg-card p{margin:.4em 0;color:var(--wg-muted)}',
    '.wg-kicker{font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#d48a00!important;margin:0 0 2px!important}',
    '.wg-big{font-size:2.6rem;font-weight:800;color:var(--wg-ink)!important;font-variant-numeric:tabular-nums;margin:.1em 0!important}',
    '.wg-stats{display:flex;justify-content:center;gap:10px;margin:8px 0}.wg-stats div{background:var(--wg-tile);border-radius:12px;padding:6px 14px}.wg-stats small{display:block;font-size:.72rem;color:var(--wg-muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em}.wg-stats b{font-size:1.15rem;font-variant-numeric:tabular-nums}',
    '.wg-bigstars{font-size:44px;line-height:1;margin:6px 0 2px}.wg-bigstars span{display:inline-block;color:#c9ced9;animation:wg-pop .45s backwards}.wg-bigstars span.wg-got{color:var(--wg-gold);text-shadow:0 2px 6px rgba(224,155,0,.45)}',
    '.wg-levels{display:grid;gap:10px;margin-top:14px}',
    '.wg-lv{display:flex;align-items:center;gap:12px;text-align:left;padding:10px 12px;border-radius:16px;border:0;background:var(--wg-tile);color:var(--wg-ink);cursor:pointer;min-height:68px;font:inherit;width:100%;transition:transform .15s,background .15s}',
    '.wg-lv:hover{background:var(--wg-tile-h)}.wg-lv:active{transform:scale(.98)}.wg-lv svg{width:52px;height:52px;flex:none;border-radius:13px;box-shadow:0 2px 6px rgba(0,0,0,.15)}',
    '.wg-lv b{display:block;font-size:1.05rem}.wg-lv small{display:block;color:var(--wg-muted);font-size:.8rem}.wg-lv span.wg-st{margin-left:auto;text-align:right;font-size:.8rem;color:var(--wg-muted);white-space:nowrap}',
    '.wg-st i{font-style:normal;font-size:15px;color:#c5cad6}.wg-st i.wg-got{color:var(--wg-gold)}',
    '.wg-go{display:block;margin-top:14px;min-height:48px;width:100%;border:0;border-radius:14px;background:linear-gradient(#2e4f93,var(--wg-accent));color:#fff;font:inherit;font-weight:800;font-size:1.08rem;cursor:pointer;box-shadow:0 4px 12px rgba(31,59,115,.35);transition:transform .15s}.wg-go:active{transform:scale(.98)}',
    '.wg-go.wg-alt{background:transparent;color:var(--wg-ink);box-shadow:inset 0 0 0 2px var(--wg-tile-h);margin-top:10px}',
    '.wg-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;margin:10px 0 4px}.wg-grid span{font-size:.8rem;font-weight:800;padding:5px 0;border-radius:8px;background:var(--wg-tile);color:var(--wg-muted);font-variant-numeric:tabular-nums}.wg-grid span.wg-got{background:var(--wg-gold);color:#1b2440}',
    '.wg-btn:focus-visible,.wg-go:focus-visible,.wg-lv:focus-visible{outline:3px solid #f2b632;outline-offset:2px}',
    // Phone landscape and short screens: level cards in two columns, tighter HUD (touch targets stay 40px+).
    '@media (orientation:landscape) and (min-width:560px){.wg-card{max-width:640px}.wg-levels{grid-template-columns:1fr 1fr}}',
'@media (max-height:420px){.wg-pill{height:40px;font-size:15px;padding:0 9px}.wg-btn{min-width:40px;height:40px}.wg-hearts svg{width:19px;height:19px}.wg-ico{width:18px;height:18px}.wg-nav,.wg-mus{top:54px}.wg-nav{font-size:14px}.wg-toast{top:98px;padding:7px 14px}.wg-card{padding:14px 14px 12px}.wg-card h2{font-size:1.2rem}.wg-card p{margin:.25em 0}.wg-go{min-height:44px;margin-top:10px}.wg-lv{min-height:54px;padding:6px 10px}.wg-lv svg{width:40px;height:40px}.wg-bigstars{font-size:32px}.wg-big{font-size:1.8rem}}'
  ].join('\n');

  var ICON = {
    heart: '<path d="M12 21s-7.4-4.5-9.5-9.1C1 8.5 3.1 4.6 6.8 4.6c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.7 0 5.8 3.9 4.3 7.3C19.4 16.5 12 21 12 21z"/>',
    paw: '<ellipse cx="12" cy="16" rx="5" ry="4.2"/><circle cx="5.5" cy="10.5" r="2.2"/><circle cx="9.3" cy="6.6" r="2.3"/><circle cx="14.7" cy="6.6" r="2.3"/><circle cx="18.5" cy="10.5" r="2.2"/>',
    clock: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.2a7.8 7.8 0 1 1 0 15.6 7.8 7.8 0 0 1 0-15.6zM11 6.5v6.1l4.6 2.8 1.1-1.8-3.5-2.1V6.5z"/>',
    soundOn: '<path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/>',
    soundOff: '<path d="M4 9v6h4l5 4V5L8 9H4zm15.6 3 2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4z"/>',
    floor: '<path d="M3 20h5v-4h4v-4h4V8h5V5h-8v4H9v4H5v4H3z"/>'
  };
  function svg(name, cls) { return '<svg class="' + (cls || 'wg-ico') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICON[name] + '</svg>'; }
  // Small level thumbnails for the level-select cards.
  var ART = {
    town: '<svg viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" fill="#bfe6ff"/><rect y="38" width="52" height="14" fill="#2d83bf"/><rect x="6" y="22" width="10" height="18" fill="#e2a68c"/><rect x="18" y="16" width="9" height="24" fill="#d9c3a5"/><path d="M33 40V18h6v22z" fill="#d8bd92"/><path d="M36 5l3 13h-6z" fill="#7d8a8c"/><rect x="41" y="26" width="8" height="14" fill="#a9c1d3"/><rect y="40" width="52" height="3" fill="#e8d49c"/></svg>',
    forest: '<svg viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" fill="#9fc79a"/><path d="M10 40l9-26 9 26z" fill="#2d6638"/><path d="M24 44l10-30 10 30z" fill="#3a7c47"/><path d="M0 46h52v6H0z" fill="#86684a"/><circle cx="44" cy="12" r="5" fill="#fff3b0"/></svg>',
    beach: '<svg viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" fill="#9fd6ff"/><path d="M0 26l10-8 8 4 10-9 12 8 12-3v8H0z" fill="#7b88b8"/><rect y="28" width="52" height="10" fill="#2d83bf"/><path d="M0 38q13-4 26 0t26 0v14H0z" fill="#e3c98b"/><rect x="34" y="34" width="6" height="8" fill="#e63946"/><rect x="42" y="34" width="6" height="8" fill="#ffd166"/><ellipse cx="14" cy="45" rx="3" ry="2" fill="#d9480f"/></svg>',
    alloway: '<svg viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" fill="#1b2840"/><circle cx="40" cy="11" r="6" fill="#f4f1de"/><path d="M8 44V24l8-8 8 8v20h-5V32h-6v12z" fill="#55607a"/><rect x="30" y="36" width="4" height="8" rx="2" fill="#8090a8"/><rect x="38" y="38" width="4" height="6" rx="2" fill="#8090a8"/><path d="M0 44h52v8H0z" fill="#26402c"/><path d="M20 12l4-6 3 6z" fill="#111"/></svg>',
    hogmanay: '<svg viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" fill="#2b2457"/><circle cx="14" cy="12" r="7" fill="none" stroke="#ff4fa0" stroke-width="2" stroke-dasharray="2 3"/><circle cx="36" cy="10" r="6" fill="none" stroke="#ffd166" stroke-width="2" stroke-dasharray="2 3"/><rect x="6" y="26" width="14" height="18" fill="#c47a62"/><rect x="24" y="22" width="12" height="22" fill="#d9c3a5"/><rect x="38" y="28" width="10" height="16" fill="#a9c1d3"/><g fill="#ffd27a"><rect x="9" y="30" width="3" height="3"/><rect x="27" y="27" width="3" height="3"/><rect x="41" y="32" width="3" height="3"/></g><path d="M0 44h52v8H0z" fill="#eef3f8"/><path d="M5 26h16l-2-3H7zM23 22h14l-2-3H25z" fill="#fff"/></svg>',
    racecourse: '<svg viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" fill="#8fc96a"/><rect x="6" y="14" width="40" height="24" rx="12" fill="none" stroke="#5f9a3e" stroke-width="7"/><rect x="6" y="14" width="40" height="24" rx="12" fill="none" stroke="#fff" stroke-width="1"/><path d="M20 30l4-4h7l3-3 2 2-3 3v4h-2v-3h-6l-2 3h-2z" fill="#5d4037"/><circle cx="27" cy="23" r="2" fill="#e63946"/></svg>',
    harbour: '<svg viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" fill="#0f1b33"/><path d="M38 10l4 24h-8z" fill="#e8e8e8"/><rect x="36" y="7" width="4" height="4" fill="#ffd166"/><path d="M40 9L52 4v10z" fill="#ffd166" opacity=".5"/><rect y="34" width="52" height="18" fill="#1d3557"/><path d="M6 34h18l-3 5H9z" fill="#c1121f"/><rect x="13" y="26" width="2" height="8" fill="#ddd"/><path d="M0 44h52v8H0z" fill="#59606b"/><path d="M26 44l10-6 6 6z" fill="#ffd166" opacity=".35"/></svg>',
    tower7: '<svg viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" fill="#a9d3f5"/><rect x="16" y="8" width="20" height="44" fill="#d6c4a4"/><g fill="#34495a"><rect x="20" y="13" width="4" height="4"/><rect x="28" y="13" width="4" height="4"/><rect x="20" y="20" width="4" height="4"/><rect x="28" y="20" width="4" height="4"/><rect x="20" y="27" width="4" height="4"/><rect x="28" y="27" width="4" height="4"/><rect x="20" y="34" width="4" height="4"/><rect x="28" y="34" width="4" height="4"/></g><rect x="14" y="5" width="24" height="4" fill="#4f9443"/><circle cx="19" cy="4" r="3" fill="#3f8a3a"/><circle cx="32" cy="4" r="3" fill="#e86a8a"/><rect x="23" y="42" width="6" height="10" fill="#7a4a2a"/></svg>',
    tower: '<svg viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" fill="#f6c690"/><rect x="12" y="10" width="28" height="38" fill="#a4553a"/><path d="M10 10h32l-4-6H14z" fill="#5b3a2c"/><g fill="#ffe7a8"><rect x="16" y="14" width="5" height="6"/><rect x="31" y="14" width="5" height="6"/><rect x="16" y="25" width="5" height="6"/><rect x="31" y="25" width="5" height="6"/></g><rect x="23" y="36" width="6" height="12" fill="#3b2a20"/><g stroke="#6b4a2f" stroke-width="1.6"><path d="M43 48V20M48 48V20M43 26h5M43 32h5M43 38h5M43 44h5"/></g></svg>'
  };

  var HTML = '<div class="wg-vig"></div><div class="wg-bar"><div class="wg-pill wg-hearts" role="img"></div>' +
    '<div class="wg-pill wg-found" aria-label="Westies found"></div><div class="wg-pill wg-floor" aria-label="Floor"></div><div class="wg-pill wg-time" aria-label="Time">0:00</div>' +
    '<button class="wg-btn wg-pause" aria-label="Pause"><svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button></div>' +
    '<button class="wg-btn wg-mus" aria-label="Music" aria-pressed="true"></button>' +
    '<div class="wg-pill wg-nav" aria-hidden="true"><span class="wg-arrow"></span><span class="wg-dist"></span></div>' +
    '<div class="wg-joy" aria-hidden="true"><div class="wg-knob"></div></div><div class="wg-hint" aria-hidden="true"><i></i></div>' +
    '<div class="wg-toast" role="status" aria-live="polite"></div><div class="wg-flash"></div>' +
    '<div class="wg-screen" role="dialog" aria-modal="true"><div class="wg-card"></div></div>';

  var styleEl = null, live = 0;

  // Colours are authored in sRGB; three r128 lights/materials work in linear space.
  function col(h) { return new THREE.Color(h).convertSRGBToLinear(); }

  // Merge simple primitives into one vertex-coloured geometry (one draw call per prop).
  function P(g, c, x, y, z, r, s) { return { g: g, c: c, x: x, y: y, z: z, r: r, s: s }; }
  function merge(parts) {
    var pos = [], nor = [], cols = [];
    parts.forEach(function (p) {
      var g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
      if (p.s) g.scale(p.s[0], p.s[1], p.s[2]);
      if (p.r) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(p.r[0], p.r[1], p.r[2])));
      g.translate(p.x || 0, p.y || 0, p.z || 0);
      var a = g.attributes.position.array, n = g.attributes.normal.array, c = col(p.c), i;
      for (i = 0; i < a.length; i++) { pos.push(a[i]); nor.push(n[i]); }
      for (i = 0; i < a.length / 3; i++) cols.push(c.r, c.g, c.b);
      g.dispose(); p.g.dispose();
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return out;
  }
  function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
  function cyl(a, b, h, n) { return new THREE.CylinderGeometry(a, b, h, n || 8); }
  function ball(r, w, h) { return new THREE.SphereGeometry(r, w || 10, h || 8); }

  function inst(geo, mat, items) {
    var m = new THREE.InstancedMesh(geo, mat, items.length), o = new THREE.Object3D();
    items.forEach(function (it, i) {
      o.position.set(it.x, it.y || 0, it.z); o.rotation.set(0, it.ry || 0, 0);
      if (it.sx) o.scale.set(it.sx, it.sy, it.sz); else o.scale.setScalar(it.s || 1);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      // always set: r128 reuses a material's program across instanced meshes with and without instanceColor
      m.setColorAt(i, col(it.c || '#ffffff'));
    });
    m.receiveShadow = true; // shadows are kept for the player, statues, hazards and a few key props
    m.frustumCulled = false; // instances spread across the whole map; the base geometry bounds would cull them all
    return m;
  }

  function fmt(t) { t = Math.floor(t); return Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2); }
  function lerpAngle(a, b, k) { var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; }


  // ================= Music: original tunes in a Scottish folk style, synthesised with Web Audio =================
  // Notes are written one token per step: a note ("D5", "F#4"), "-" holds the previous note, "." is a rest.
  var MUSIC_KEY = 'westie-game-music', SFX_KEY = 'westie-game-sfx';
  var SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function hz(n) { var m = /^([A-G]#?)(\d)$/.exec(n); return 440 * Math.pow(2, (SEMI[m[1]] + (+m[2] + 1) * 12 - 69) / 12); }
  function seq(s) {
    var out = [], last = null;
    s.replace(/\|/g, ' ').trim().split(/\s+/).forEach(function (t) {
      if (t === '-') { if (last) last.len++; out.push(null); }
      else if (t === '.') { last = null; out.push(null); }
      else { last = { f: hz(t), len: 1 }; out.push(last); }
    });
    return out;
  }
  var TRACKS = {
    // 3/4, gentle: flute over a D drone.
    menu: { bpm: 96, sub: 1, drone: ['D3', 'A3'], droneVol: 0.05, drum: 'X . . x . .', drumVol: 0.4, voices: [
      { ins: 'flute', vol: 0.32, seq: seq('D5 - E5 | F#5 - A5 | B5 - A5 | F#5 - - | E5 - D5 | B4 - D5 | E5 - - | D5 - - | A4 - D5 | E5 - F#5 | A5 - B5 | A5 - - | F#5 - E5 | D5 - B4 | D5 - - | D5 - - |') }] },
    // Jig in 6/8 (dotted crotchet = 120), D mixolydian, pipe tune over a bagpipe-like drone.
    town: { bpm: 120, sub: 3, drone: ['D3', 'A3'], droneVol: 0.06, drum: 'X . x x . x', drumVol: 0.6, voices: [
      { ins: 'pipe', vol: 0.22, seq: seq('D5 F#5 A5 | B5 A5 F#5 | G5 E5 C5 | E5 D5 C5 | D5 F#5 A5 | D6 B5 A5 | G5 E5 C5 | D5 - - | A5 B5 C6 | D6 C6 A5 | B5 G5 E5 | G5 A5 B5 | C6 B5 A5 | G5 E5 C5 | D5 E5 F#5 | D5 - - |') },
      { ins: 'bass', vol: 0.28, seq: seq('D3 - - | A2 - - | C3 - - | C3 - - | D3 - - | D3 - - | C3 - - | D3 - - |') }] },
    // Slow, misty: flute in A minor pentatonic, low drone, a soft heartbeat drum.
    forest: { bpm: 72, sub: 2, drone: ['A2', 'E3'], droneVol: 0.05, drum: 'x . . . . . . . . . . . . . . .', drumVol: 0.35, voices: [
      { ins: 'flute', vol: 0.3, seq: seq('E5 - - G5 | A5 - - - | C6 - B5 A5 | G5 - - - | E5 - D5 E5 | G5 - - - | A5 - - - | - - . . | A5 - - C6 | D6 - C6 A5 | G5 - E5 - | D5 - - - | E5 - G5 A5 | E5 - D5 C5 | A4 - - - | - - . . |') }] },
    // Bouncy and plucky: G major pentatonic with a walking bass and off-beat taps.
    tower: { bpm: 132, sub: 2, drone: null, drum: 'X . x . X . x x', drumVol: 0.45, voices: [
      { ins: 'pluck', vol: 0.3, seq: seq('G4 . B4 D5 | E5 . D5 B4 | A4 . G4 A4 | B4 . . . | G4 . B4 D5 | G5 . E5 D5 | E5 D5 B4 A4 | G4 . . . | D5 . E5 G5 | A5 . G5 E5 | D5 . B4 D5 | E5 . . . | G5 . E5 D5 | B4 . A4 B4 | A4 G4 A4 B4 | G4 . . . |') },
      { ins: 'bass', vol: 0.3, seq: seq('G2 . D3 . | C3 . G2 . | D3 . A2 . | G2 . D3 . | G2 . D3 . | C3 . G2 . | D3 . A2 . | G2 . G2 . |') }] },
    // Breezy 6/8 in D major: flute over a plucked bass, light drum.
    beach: { bpm: 112, sub: 3, drone: ['D3'], droneVol: 0.035, drum: 'X . . x . .', drumVol: 0.35, voices: [
      { ins: 'flute', vol: 0.3, seq: seq('A5 F#5 D5 | E5 F#5 A5 | B5 A5 F#5 | A5 - - | D6 B5 A5 | F#5 E5 D5 | E5 F#5 E5 | D5 - - | F#5 A5 B5 | D6 - B5 | A5 F#5 A5 | B5 - - | A5 F#5 E5 | D5 E5 F#5 | E5 D5 B4 | D5 - - |') },
      { ins: 'pluck', vol: 0.26, seq: seq('D3 - - | A2 - - | G2 - - | D3 - - | B2 - - | G2 - - | A2 - - | D3 - - |') }] },
    // Eerie E aeolian: slow flute with a raised seventh, low drone, a rare thud.
    alloway: { bpm: 66, sub: 2, drone: ['E2', 'B2'], droneVol: 0.05, drum: 'X . . . . . . . . . . . . . . .', drumVol: 0.3, voices: [
      { ins: 'flute', vol: 0.28, seq: seq('E5 - - - | G5 - F#5 E5 | D#5 - - - | E5 - - - | B4 - C5 - | B4 - A4 G4 | F#4 - - - | . . . . | E5 - G5 B5 | C6 - B5 A5 | G5 - F#5 - | E5 - - - | C5 - B4 A4 | G4 - F#4 - | E4 - - - | . . . . |') }] },
    // Festive reel in G: pipe tune with plucked bells an octave up and a bouncing bass.
    hogmanay: { bpm: 120, sub: 2, drone: ['G2', 'D3'], droneVol: 0.04, drum: 'X . x . X . x x', drumVol: 0.45, voices: [
      { ins: 'pipe', vol: 0.2, seq: seq('G5 B5 D6 B5 | G5 B5 D6 - | C6 E6 C6 A5 | B5 G5 E5 D5 | G5 B5 D6 B5 | A5 B5 C6 E6 | D6 B5 A5 F#5 | G5 - - . |') },
      { ins: 'pluck', vol: 0.12, seq: seq('G6 . . . D6 . . . | E6 . . . B5 . . . | C6 . . . A5 . . . | D6 . . . G6 . . . |') },
      { ins: 'bass', vol: 0.28, seq: seq('G2 . D3 . | G2 . D3 . | C3 . G2 . | G2 . D3 . | G2 . D3 . | A2 . E3 . | D3 . A2 . | G2 . G2 . |') }] },
    // Galloping 6/8 in A mixolydian.
    racecourse: { bpm: 138, sub: 3, drone: ['A2', 'E3'], droneVol: 0.04, drum: 'X . x X . x', drumVol: 0.5, voices: [
      { ins: 'pipe', vol: 0.2, seq: seq('A4 C#5 E5 | A5 E5 C#5 | G5 E5 C#5 | E5 D5 C#5 | A4 C#5 E5 | A5 B5 A5 | G5 E5 D5 | E5 - - | A5 G5 E5 | D5 E5 G5 | A5 G5 E5 | D5 B4 G4 | A4 C#5 E5 | G5 A5 B5 | A5 G5 E5 | A4 - - |') },
      { ins: 'bass', vol: 0.28, seq: seq('A2 - - | A2 - - | G2 - - | G2 - - | A2 - - | A2 - - | G2 - - | A2 - - |') }] },
    // Night shanty in 3/4, A minor: flute and a swaying bass.
    harbour: { bpm: 100, sub: 1, drone: ['A2'], droneVol: 0.035, drum: 'X . x', drumVol: 0.35, voices: [
      { ins: 'flute', vol: 0.28, seq: seq('A4 - C5 | E5 - D5 | C5 - B4 | A4 - - | G4 - B4 | D5 - C5 | B4 - G4 | E4 - - | A4 - C5 | E5 - A5 | G5 - E5 | D5 - - | C5 - B4 | A4 - G4 | E4 - G4 | A4 - - |') },
      { ins: 'bass', vol: 0.26, seq: seq('A2 E3 E3 | A2 E3 E3 | F2 C3 C3 | E2 B2 B2 |') }] },
    // Driving A dorian reel feel; the game speeds it up floor by floor.
    tower7: { bpm: 126, sub: 2, drone: ['A2', 'E3'], droneVol: 0.045, drum: 'X . x . X x x .', drumVol: 0.55, voices: [
      { ins: 'pipe', vol: 0.2, seq: seq('A4 C5 E5 A5 | G5 E5 D5 E5 | C5 D5 E5 G5 | A5 - G5 E5 | A4 C5 E5 A5 | B5 A5 G5 E5 | D5 E5 G5 E5 | A5 - - . | E5 A5 A5 B5 | C6 B5 A5 G5 | E5 G5 D5 G5 | E5 D5 C5 B4 | A4 C5 E5 A5 | G5 E5 D5 B4 | C5 B4 G4 B4 | A4 - - . |') },
      { ins: 'bass', vol: 0.3, seq: seq('A2 A2 A3 A2 | G2 G2 G3 G2 | C3 C3 C3 G2 | A2 A2 E3 A2 |') }] }
  };
  var STINGS = {
    win: [['pipe', 'D5', 0, 0.12], ['pipe', 'F#5', 0.12, 0.12], ['pipe', 'A5', 0.24, 0.12], ['pipe', 'D6', 0.36, 0.9], ['flute', 'A5', 0.36, 0.9], ['bass', 'D3', 0.36, 0.9]],
    lose: [['flute', 'A4', 0, 0.35], ['flute', 'F4', 0.38, 0.35], ['flute', 'D4', 0.76, 1.1], ['bass', 'D2', 0.76, 1.1]]
  };

  function makeMusic() {
    var AC = window.AudioContext || window.webkitAudioContext, ctx = null, master, bus, noise, drone = [], cur = null, curName = null, pending = null;
    var step = 0, nextT = 0, timer = 0, notes = 0, extra = 0, on = true, sfxOn = true, closed = false, sfxBus;
    try { on = localStorage.getItem(MUSIC_KEY) !== 'off'; sfxOn = localStorage.getItem(SFX_KEY) !== 'off'; } catch (e) { /* storage blocked: default on */ }
    function live() { return on || sfxOn; }
    // One-shot sound effects (own bus, so they work with the music switched off).
    function tone(type, f0, f1, t, dur, vol, filt) {
      var o = ctx.createOscillator(), g = ctx.createGain(), last = g;
      o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      if (filt) { var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = filt; bp.Q.value = 1.2; o.connect(bp); bp.connect(g); } else o.connect(g);
      last.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
    }
    function hiss(t, dur, vol, f) {
      var n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      n.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      n.connect(bp); bp.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + dur + 0.01);
    }
    var SFX = {
      chime: function (t) { tone('sine', 1319, 0, t, 0.35, 0.25); tone('sine', 1976, 0, t + 0.08, 0.5, 0.22); tone('triangle', 2637, 0, t + 0.08, 0.3, 0.06); },
      bark: function (t) { tone('sawtooth', 560, 300, t, 0.13, 0.32, 900); hiss(t, 0.08, 0.12, 1400); },
      bark2: function (t) { SFX.bark(t); SFX.bark(t + 0.2); },
      yelp: function (t) { tone('triangle', 900, 1500, t, 0.06, 0.28); tone('triangle', 1500, 520, t + 0.06, 0.2, 0.25); },
      clunk: function (t) { tone('sine', 130, 65, t, 0.18, 0.5); hiss(t, 0.04, 0.2, 2500); },
      gate: function (t) { tone('sawtooth', 75, 115, t, 0.55, 0.12, 600); tone('sawtooth', 110, 80, t + 0.5, 0.4, 0.1, 600); SFX.chime(t + 0.8); }
    };

    function voice(ins, f, t, dur, vol) {
      notes++;
      var o = ctx.createOscillator(), g = ctx.createGain(), out = g, end;
      o.frequency.value = f;
      if (ins === 'pipe') { // reedy chanter: square through a lowpass, quick attack
        o.type = 'square'; var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; o.connect(lp); lp.connect(g);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.setValueAtTime(vol, t + dur * 0.85); g.gain.linearRampToValueAtTime(0, t + dur + 0.04); end = t + dur + 0.06;
      } else if (ins === 'flute') { // breathy sine with a slow swell
        o.type = 'sine'; o.connect(g);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.setValueAtTime(vol * 0.85, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur + 0.18); end = t + dur + 0.2;
      } else { // pluck and bass: triangle with a fast decay
        o.type = 'triangle'; o.connect(g); var dec = ins === 'bass' ? Math.min(dur, 0.6) + 0.15 : 0.35;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec); end = t + dec + 0.02;
      }
      out.connect(bus); o.start(t); o.stop(end);
    }
    function drum(t, strong, vol) { // bodhran: pitched-down thump, plus a skin tap on light hits
      notes++;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(strong ? 140 : 180, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
      g.gain.setValueAtTime(vol * (strong ? 0.9 : 0.45), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.27);
      if (!strong) {
        var n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
        n.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = 1800; ng.gain.setValueAtTime(vol * 0.18, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        n.connect(bp); bp.connect(ng); ng.connect(bus); n.start(t); n.stop(t + 0.07);
      }
    }
    function stepDur() { return 60 / (cur.bpm + extra) / cur.sub; }
    function schedule(n, t) {
      var sd = stepDur();
      cur.voices.forEach(function (v) { var e = v.seq[n % v.seq.length]; if (e) voice(v.ins, e.f, t, e.len * sd * 0.95, v.vol); });
      var d = cur.drum.split(' '), k = d[n % d.length];
      if (k !== '.') drum(t, k === 'X', cur.drumVol);
    }
    function tick() { // lookahead scheduler: queue anything due in the next 150 ms
      clearTimeout(timer); timer = setTimeout(tick, 25);
      if (!ctx || !cur || !on || ctx.state !== 'running') return;
      if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.02;
      while (nextT < ctx.currentTime + 0.15) { schedule(step, nextT); nextT += stepDur(); step++; }
    }
    function stopDrone() {
      drone.forEach(function (d) { try { d.g.gain.setTargetAtTime(0, ctx.currentTime, 0.15); d.o.stop(ctx.currentTime + 0.8); } catch (e) { /* already stopped */ } });
      drone = [];
    }
    function startDrone(list, vol) {
      if (!list) return;
      list.forEach(function (n, i) {
        var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = i ? 3 : -3; lp.type = 'lowpass'; lp.frequency.value = 520;
        g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.2);
        o.connect(lp); lp.connect(g); g.connect(bus); o.start(); drone.push({ o: o, g: g });
      });
    }
    var api = {
      // Must be called from a user gesture (tap/click/key): iOS only lets audio start that way.
      unlock: function () {
        if (closed || !AC) return;
        if (!ctx) {
          try { ctx = new AC(); } catch (e) { return; }
          var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
          master = ctx.createGain(); master.gain.value = on ? 0.22 : 0; bus = ctx.createGain();
          bus.connect(master); master.connect(comp); comp.connect(ctx.destination);
          sfxBus = ctx.createGain(); sfxBus.gain.value = 0.3; sfxBus.connect(comp);
          noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
          var ch = noise.getChannelData(0); for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
          var s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); // iOS unlock blip
        }
        if (live() && ctx.state === 'suspended') ctx.resume();
        if (pending) { var p = pending; pending = null; api.play(p); }
      },
      play: function (name) {
        if (!ctx) { pending = name; return; }
        if (name === curName && cur) { api.resume(); return; }
        stopDrone(); cur = TRACKS[name]; curName = name; step = 0; nextT = ctx.currentTime + 0.1;
        startDrone(cur.drone, cur.droneVol);
        api.resume();
      },
      sting: function (kind) {
        if (!ctx) return;
        stopDrone(); cur = null; curName = null;
        if (!on) return;
        if (ctx.state === 'suspended') ctx.resume();
        var t = ctx.currentTime + 0.05;
        STINGS[kind].forEach(function (n) { voice(n[0], hz(n[1]), t + n[2], n[3], n[0] === 'bass' ? 0.3 : 0.25); });
        if (kind === 'win') [0, 0.12, 0.24, 0.36].forEach(function (d) { drum(t + d, d === 0.36, 0.5); });
      },
      suspend: function () { clearTimeout(timer); if (ctx && ctx.state === 'running') ctx.suspend(); },
      resume: function () {
        if (!ctx || !live() || closed) return;
        var go = function () { nextT = Math.max(nextT, ctx.currentTime + 0.05); if (on) tick(); };
        if (ctx.state === 'suspended') ctx.resume().then(go, function () {}); else go();
      },
      duck: function () { if (!ctx) return; var t = ctx.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0.3, t, 0.05); bus.gain.setTargetAtTime(1, t + 0.7, 0.25); },
      tempo: function (add) { extra = add; },
      isOn: function () { return on; },
      setOn: function (v) {
        on = v; try { localStorage.setItem(MUSIC_KEY, v ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
        if (!ctx) return;
        master.gain.setTargetAtTime(v ? 0.22 : 0, ctx.currentTime, 0.05);
        if (!v) { clearTimeout(timer); if (!sfxOn) setTimeout(function () { if (!live()) api.suspend(); }, 200); }
      },
      sfx: function (kind) { if (ctx && sfxOn && !closed && ctx.state === 'running') SFX[kind](ctx.currentTime + 0.01); },
      isSfx: function () { return sfxOn; },
      setSfx: function (v) {
        sfxOn = v; try { localStorage.setItem(SFX_KEY, v ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
        if (ctx && !live()) api.suspend();
      },
      dispose: function () { closed = true; clearTimeout(timer); if (ctx && ctx.state !== 'closed') ctx.close(); },
      stats: function () { return { notes: notes, state: ctx ? ctx.state : 'none', track: curName }; }
    };
    return api;
  }

  // keep: shared geometries/materials/textures (vmat, plinth, beam, the statue.js dog mesh) that later levels reuse.
  function disposeTree(obj, keep) {
    obj.traverse(function (o) {
      if (o.geometry && !(keep && keep.has(o.geometry))) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(function (m) { if (keep && keep.has(m)) return; if (m.map && !(keep && keep.has(m.map))) m.map.dispose(); m.dispose(); });
    });
  }

  function mount(container) {
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl); }
    live++;
    var root = document.createElement('div'); root.className = 'wg-root'; root.innerHTML = HTML;
    container.appendChild(root);
    var $ = function (s) { return root.querySelector(s); };
    var music = makeMusic(), musBtn = $('.wg-mus');
    function musIcon() { var o = music.isOn(); musBtn.innerHTML = svg(o ? 'soundOn' : 'soundOff', ''); musBtn.setAttribute('aria-pressed', String(o)); musBtn.setAttribute('aria-label', o ? 'Music on' : 'Music off'); }
    function toggleMusic() {
      music.unlock(); music.setOn(!music.isOn()); musIcon();
      if (music.isOn() && state !== 'pause') music.resume();
      [].forEach.call(root.querySelectorAll('[data-act="music"]'), function (b) { b.textContent = 'Music: ' + (music.isOn() ? 'On' : 'Off'); });
    }
    function toggleSfx() {
      music.unlock(); music.setSfx(!music.isSfx()); if (music.isSfx()) { music.resume(); music.sfx('chime'); }
      [].forEach.call(root.querySelectorAll('[data-act="sfx"]'), function (b) { b.textContent = 'Sounds: ' + (music.isSfx() ? 'On' : 'Off'); });
    }
    function soundBtns() { return '<div style="display:flex;gap:8px"><button class="wg-go wg-alt" data-act="music">Music: ' + (music.isOn() ? 'On' : 'Off') + '</button><button class="wg-go wg-alt" data-act="sfx">Sounds: ' + (music.isSfx() ? 'On' : 'Off') + '</button></div>'; }
    musIcon(); musBtn.onclick = toggleMusic;
    // Audio may only start inside a user gesture (iOS): unlock on the first tap or key.
    var unlock = function (e) { if (e.type === 'keydown' && (!root.offsetParent || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || ''))) return; music.unlock(); };
    root.addEventListener('pointerdown', unlock, true); window.addEventListener('keydown', unlock, true);
    if ((window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window) root.classList.add('wg-touch');

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    var maxPR = Math.min(window.devicePixelRatio || 1, 1.5), slowFrames = 0; // drops to 1 if frames stay slow
    renderer.setPixelRatio(maxPR);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    root.insertBefore(renderer.domElement, root.firstChild);
    var ANISO = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    // iOS can drop the GL context (memory pressure, backgrounding): pause, and redraw once it is back.
    function onLost(e) { e.preventDefault(); pause(); stop(); }
    function onRestored() { resize(); draw(); }
    renderer.domElement.addEventListener('webglcontextlost', onLost); renderer.domElement.addEventListener('webglcontextrestored', onRestored);

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xbfe0f5, 60, 130);
    // Vertical sky gradient (only seen near the top edge, but it beats a flat colour).
    function skyTex(top, bottom) {
      var c = document.createElement('canvas'); c.width = 2; c.height = 256;
      var x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
      x.fillStyle = gr; x.fillRect(0, 0, 2, 256);
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    }
    var cam = new THREE.PerspectiveCamera(50, 1, 0.5, 400), camScale = 1;
    var hemi = new THREE.HemisphereLight(0xffffff, 0x6f7f60, 0.75); scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff1dc, 0.85); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0008;
    var sc = sun.shadow.camera; sc.left = sc.bottom = -24; sc.right = sc.top = 24; sc.near = 1; sc.far = 90;
    scene.add(sun, sun.target);

    // ---- Game state (shared by both levels).
    var hearts = $('.wg-hearts'), foundEl = $('.wg-found'), timeEl = $('.wg-time'), nav = $('.wg-nav'), arrow = $('.wg-arrow'), distEl = $('.wg-dist');
    var toastEl = $('.wg-toast'), flashEl = $('.wg-flash'), screenEl = $('.wg-screen'), card = $('.wg-card'), joy = $('.wg-joy'), knob = $('.wg-knob');
    var state = 'start', time = 0, T = 0, lives = LIVES, found = 0, inv = 0, raf = 0, last = 0, shownSec = -1, shownDist = '', toastTimer = 0, flashTimer = 0;
    var shownAng = 99, navShown = true, shake = 0, climb = null, ladderLock = false, floorEl = $('.wg-floor');
    var px = START[0], pz = START[1], vx = 0, vz = 0, kx = 0, kz = 0, walk = 0, keys = {}, jx = 0, jz = 0, jid = null;
    var L = null, levels = {};

    // ---- Shared pieces: vertex-colour material and painted Westie statues on plinths.
    var vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    var D = WestieStatue.designs;
    var plinthGeo = merge([P(box(2.2, 0.12, 2.2), '#7d8288', 0, 0.06, 0), P(box(2.0, 0.42, 2.0), '#9aa0a6', 0, 0.33, 0), P(box(2.15, 0.1, 2.15), '#b3b8bd', 0, 0.58, 0), P(box(0.9, 0.22, 0.02), '#c9a24a', 0, 0.33, 1.01)]), plinthMat = vmat;
    var beamGeo = new THREE.CylinderGeometry(0.9, 0.6, 9, 16, 1, true).translate(0, 4.5, 0);
    var beamMat = new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    var GLOW = col('#ffc23a');
    var KEEP = new Set([vmat, plinthGeo, beamGeo, beamMat]);

    // Sparkle burst when a Westie is found (one pooled particle system).
    var SPN = 60, spPos = new Float32Array(SPN * 3), spVel = new Float32Array(SPN * 3), spT = 0;
    var spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    var spCv = document.createElement('canvas'); spCv.width = spCv.height = 64;
    (function (c) { var gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,230,140,.9)'); gr.addColorStop(1, 'rgba(255,200,60,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); })(spCv.getContext('2d'));
    var spMat = new THREE.PointsMaterial({ size: 0.55, map: new THREE.CanvasTexture(spCv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe08a });
    var sparks = new THREE.Points(spGeo, spMat); sparks.visible = false; sparks.frustumCulled = false; sparks.renderOrder = 6; scene.add(sparks);
    function burst(x, y, z) {
      for (var n = 0; n < SPN; n++) {
        var a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
        spPos[n * 3] = x; spPos[n * 3 + 1] = y; spPos[n * 3 + 2] = z;
        spVel[n * 3] = Math.cos(a) * sp; spVel[n * 3 + 1] = 3 + Math.random() * 5; spVel[n * 3 + 2] = Math.sin(a) * sp;
      }
      spT = 1.2; sparks.visible = true;
    }
    function tickSparks(dt) {
      if (spT <= 0) return;
      spT -= dt;
      for (var n = 0; n < SPN * 3; n += 3) { spVel[n + 1] -= 9 * dt; spPos[n] += spVel[n] * dt; spPos[n + 1] += spVel[n + 1] * dt; spPos[n + 2] += spVel[n + 2] * dt; }
      spGeo.attributes.position.needsUpdate = true; spMat.opacity = Math.max(0, spT / 1.2);
      if (spT <= 0) sparks.visible = false;
    }
    // spots: [x, z] or [x, z, group, boxes, floor] (the tower puts each statue on its own floor).
    function makeStatues(spots, grp, boxes, R, solidIf) {
      var ids = D.map(function (d, i) { return i; }), k;
      for (k = ids.length - 1; k > 0; k--) { var sw = Math.floor(Math.random() * (k + 1)), tmp = ids[k]; ids[k] = ids[sw]; ids[sw] = tmp; }
      return spots.map(function (s, i) {
        var id = s[5] !== undefined ? s[5] : ids[i % ids.length], g = new THREE.Group(); g.position.set(s[0], 0, s[1]);
        var pl = new THREE.Mesh(plinthGeo, plinthMat); pl.castShadow = pl.receiveShadow = true; g.add(pl);
        var dog = WestieStatue.makeDog(id); dog.scale.setScalar(0.95); dog.position.y = 0.6; dog.rotation.y = R() * 6;
        dog.traverse(function (o) { o.castShadow = true; if (o.geometry) KEEP.add(o.geometry); });
        dog.userData.skin.emissive = GLOW; g.add(dog);
        var beam = new THREE.Mesh(beamGeo, beamMat); beam.renderOrder = 2; g.add(beam);
        (s[2] || grp).add(g);
        if (!solidIf || solidIf(i)) (s[3] || boxes).push([s[0] - 1.1, s[1] - 1.1, s[0] + 1.1, s[1] + 1.1]);
        return { x: s[0], z: s[1], floor: s[4], id: id, name: D[id].name, dog: dog, skin: dog.userData.skin, beam: beam, ph: i * 1.7, found: false, pop: 0 };
      });
    }

    // ================= Level 1: Town =================
    // snow = Hogmanay Snow: the same town at dusk in snow, icy patches, festive lights, fireworks and snowball throwers.
    function buildTown(snow) {
      var grp = new THREE.Group();
      var R = rng(7), boxes = [], buildings = [], roofs = [], trees = [], lamps = [], benches = [], cones = [], huts = [], puddles = [], spots = [];
      var BC = [-50, -30, -10, 10, 30, 50], ROADS = [-40, -20, 0, 20, 40];
      var WALLS = ['#d9c3a5', '#c9b28f', '#ebe5d8', '#b9c3cb', '#e2a68c', '#a9c1d3', '#ead78f', '#c47a62', '#9fb39b', '#f0c9c0'];
      var ROOFS = snow ? ['#f4f7fb', '#e6edf5'] : ['#5b5f66', '#6b4f45', '#4a5560', '#3f4a3c'];
      var C = snow ? { pave: '#e6ebf1', sand: '#e9e6de', park: '#f3f6fa', path: '#d3d9e2', plaza: '#e9edf3', hall: '#e3e8ee', kerb: '#ffffff', road: '#7d8590', dash: '#c9ced6', zebra: '#dfe3ea', outer: '#eef2f7' }
        : { pave: '#cbc5b9', sand: '#dcc184', park: '#7cb35a', path: '#ddd0ae', plaza: '#e3d8c2', hall: '#dacfb5', kerb: '#ece6da', road: '#50565e', dash: '#f2f2f2', zebra: '#f4f4f4', outer: '#8dbb64' };
      var PARKS = { '1,4': 1, '4,1': 1, '3,4': 1 }, PLAZA = { '3,2': [-1, 1], '1,2': [1, 1], '4,3': [-1, -1], '5,2': [-1, 1] };
      var HALL = [-10, -30];

      function solid(x, z, hw, hd) { boxes.push([x - hw, z - hd, x + hw, z + hd]); }
      function building(x, z, w, d, h) {
        buildings.push({ x: x, z: z, sx: w, sy: h, sz: d, c: WALLS[Math.floor(R() * WALLS.length)] });
        roofs.push({ x: x, y: h, z: z, sx: w + 0.3, sy: 0.35, sz: d + 0.3, c: ROOFS[Math.floor(R() * ROOFS.length)] });
        solid(x, z, w / 2, d / 2);
      }
      function lamp(x, z, ry) { lamps.push({ x: x, z: z, ry: ry }); solid(x, z, 0.15, 0.15); }
      function bench(x, z, ry) { benches.push({ x: x, z: z, ry: ry }); solid(x, z, ry ? 0.3 : 0.8, ry ? 0.8 : 0.3); }
      function tree(x, z, s, solidToo) { trees.push({ x: x, z: z, s: s, ry: R() * 6, c: (snow ? ['#dfe9f2', '#cfdbe6', '#e8f0f7', '#d5e0ea'] : ['#ffffff', '#d8f0c0', '#c4dca8', '#e8f8d8'])[Math.floor(R() * 4)] }); if (solidToo) solid(x, z, 0.3, 0.3); }
      function coneRow(x, z, dx, dz, n) { for (var i = 0; i < n; i++) { cones.push({ x: x + dx * i, z: z + dz * i }); solid(x + dx * i, z + dz * i, 0.3, 0.3); } }

      BC.forEach(function (cx, i) {
        BC.forEach(function (cz, j) {
          var key = i + ',' + j;
          if (i === 0 || (i === 1 && j === 0)) return; // beach column and harbour basin
          if (cx === HALL[0] && cz === HALL[1]) return;
          var corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
          corners.forEach(function (s) { lamp(cx + s[0] * 6.5, cz + s[1] * 6.5, s[0] > 0 ? 0 : Math.PI); });
          if (PARKS[key]) {
            spots.push([cx, cz]);
            [[4.5, 2.2], [2.2, 4.5]].forEach(function (o) { [-1, 1].forEach(function (a) { [-1, 1].forEach(function (b) { tree(cx + a * o[0], cz + b * o[1], 0.8 + R() * 0.4, true); }); }); });
            bench(cx - 2.6, cz + 0.2, Math.PI / 2); bench(cx + 2.6, cz + 0.2, Math.PI / 2);
            return;
          }
          var skip = PLAZA[key];
          if (skip) {
            var px = cx + skip[0] * 3.4, pz = cz + skip[1] * 3.4;
            spots.push([px, pz]); tree(px + skip[0] * 1.8, pz - skip[1] * 1.8, 0.7, true);
          }
          if (!skip && R() < 0.35) { // terrace rows
            [-1, 1].forEach(function (s) { building(cx, cz + s * 3.4, 12.2, 5, 3 + R() * 4); });
            return;
          }
          corners.forEach(function (s) {
            if (skip && skip[0] === s[0] && skip[1] === s[1]) return;
            var edge = Math.abs(cx) === 50 || Math.abs(cz) === 50;
            building(cx + s[0] * 3.4, cz + s[1] * 3.4, 4.4 + R() * 1.4, 4.4 + R() * 1.4, 3 + R() * (edge ? 8 : 6));
          });
        });
      });

      // Seafront: sand strip, beach huts, lamps on the esplanade edge.
      ['#e63946', '#f4a261', '#2a9d8f', '#ffd166', '#118ab2', '#ef476f'].forEach(function (c, k) {
        var z = 34 + k * 2.4; huts.push({ x: -47.5, z: z, ry: 0, c: c }); solid(-47.5, z, 0.85, 0.85);
      });
      for (var lz = -35; lz <= 55; lz += 10) lamp(-43.5, lz, Math.PI);
      spots.push([-47, -22], [-47, 14], [-30, -44.6]); // beach x2, harbour quay
      // Harbour benches facing the boats.
      bench(-40, -44.3, 0); bench(-22, -44.3, 0);
      // Edge greenery (outside the walls, just scenery).
      for (var e = -40; e <= 57; e += 3.2) { tree(e, 59 + R(), 1 + R() * 0.4); tree(59 + R(), e, 1 + R() * 0.4); if (e > -15) tree(e, -59 - R(), 1 + R() * 0.4); }
      // Roadworks on the quiet (car-free) streets, puddles too.
      coneRow(17.6, -30, 0.8, 0, 4); coneRow(-30, -22.4, 0, 0.8, 4); coneRow(-22.4, 30, 0.8, 0, 4); coneRow(28, 17.6, 0, 0.8, 4); coneRow(-17.6, -8, -0.8, 0, 4);
      [[-20, -32, 1.3], [8, -20, 1.1], [20, 8, 1.4], [-8, 20, 1.2], [-20, 42, 1.1], [33, 20, 1.3], [-36, -20, 1], [20, 32, 1.2]].forEach(function (p) { puddles.push({ x: p[0], y: 0.025, z: p[1], s: p[2] * (snow ? 1.5 : 1), ry: R() * 3 }); });
      // Water and world edge.
      boxes.push([-400, -400, -51, 400], [-400, -400, -17, -46], [57, -400, 400, 400], [-400, 57, 400, 400], [-400, -400, 400, -57]);
      // Town hall: sandstone hall with a tall spire.
      solid(HALL[0], HALL[1] - 1, 6, 4); solid(HALL[0], HALL[1] + 4, 1.6, 1.6);
      console.assert(spots.length === STATUES, 'WestieGame: expected ' + STATUES + ' statue spots, got ' + spots.length);

      // ---- Ground texture: pavements, roads, parks, sand and water painted on one canvas.
      var N = 1024, K = N / 120, gcv = document.createElement('canvas'); gcv.width = gcv.height = N;
      var g = gcv.getContext('2d');
      function rect(x0, z0, x1, z1, c) { g.fillStyle = c; g.fillRect((x0 + 60) * K, (z0 + 60) * K, (x1 - x0) * K, (z1 - z0) * K); }
      rect(-60, -60, 60, 60, C.pave);
      for (var k = 0; k < 9000; k++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.05)'; g.fillRect(R() * N, R() * N, 2, 2); }
      g.fillStyle = 'rgba(80,70,60,.13)'; // paving slab joints
      for (var sl = -60; sl < 60; sl += 1.5) { g.fillRect((sl + 60) * K, 0, 1.5, N); g.fillRect(0, (sl + 60) * K, N, 1.5); }
      rect(-60, -60, -43, 60, C.sand);
      for (k = 0; k < 12000; k++) { g.fillStyle = R() < 0.5 ? 'rgba(150,110,50,.12)' : 'rgba(255,255,255,.25)'; g.fillRect(R() * 17 * K, R() * N, 2, 2); }
      rect(-60, -60, -51, 60, '#2d83bf'); rect(-60, -60, -17, -46, '#2d83bf'); rect(-51.6, -46, -51, 60, 'rgba(255,255,255,.7)');
      rect(-60, -46, -17, -43, '#a49e92'); rect(-60, -46.3, -17, -45.8, '#77726a');
      Object.keys(PARKS).forEach(function (key) {
        var cx = BC[+key[0]], cz = BC[+key[2]];
        rect(cx - 6.7, cz - 6.7, cx + 6.7, cz + 6.7, C.park);
        if (!snow) for (var gb = 0; gb < 1500; gb++) { g.fillStyle = gb % 2 ? 'rgba(40,90,20,.25)' : 'rgba(190,230,120,.25)'; g.fillRect((cx - 6.7 + R() * 13.4 + 60) * K, (cz - 6.7 + R() * 13.4 + 60) * K, 2, 4); }
        rect(cx - 0.8, cz - 6.7, cx + 0.8, cz + 6.7, C.path); rect(cx - 6.7, cz - 0.8, cx + 6.7, cz + 0.8, C.path);
        g.fillStyle = C.path; g.beginPath(); g.arc((cx + 60) * K, (cz + 60) * K, 2.2 * K, 0, 7); g.fill();
      });
      Object.keys(PLAZA).forEach(function (key) {
        var s = PLAZA[key], x = BC[+key[0]] + s[0] * 3.4, z = BC[+key[2]] + s[1] * 3.4;
        rect(x - 2.9, z - 2.9, x + 2.9, z + 2.9, C.plaza);
        g.strokeStyle = 'rgba(120,100,70,.35)'; g.lineWidth = 1;
        for (var q = -2.9; q <= 2.9; q += 0.97) { g.strokeRect((x + q + 60) * K, (z - 2.9 + 60) * K, 0.97 * K, 5.8 * K); }
      });
      rect(HALL[0] - 6.8, HALL[1] + 3, HALL[0] + 6.8, HALL[1] + 6.8, C.hall);
      ROADS.forEach(function (r) { rect(r - 3.2, -43, r + 3.2, 57, C.kerb); rect(-43, r - 3.2, 57, r + 3.2, C.kerb); });
      ROADS.forEach(function (r) { rect(r - 3, -43, r + 3, 57, C.road); rect(-43, r - 3, 57, r + 3, C.road); });
      ROADS.forEach(function (r) {
        for (var t = -43; t < 57; t += 3) {
          var near = ROADS.some(function (o) { return Math.abs(t + 0.75 - o) < 3.8; });
          if (near) continue;
          rect(r - 0.09, t, r + 0.09, t + 1.5, C.dash); rect(t, r - 0.09, t + 1.5, r + 0.09, C.dash);
        }
        ROADS.forEach(function (o) { // zebra crossings on each approach
          if (o === -40) return; // west approach would be on the sand
          for (var zz = -2.6; zz < 2.7; zz += 0.8) { rect(r + zz, o - 4.4, r + zz + 0.4, o - 3.4, C.zebra); rect(o - 4.4, r + zz, o - 3.4, r + zz + 0.4, C.zebra); }
        });
      });
      if (snow) ROADS.forEach(function (r) { [-1.7, 1.3].forEach(function (o) { rect(r + o, -43, r + o + 0.35, 57, 'rgba(70,78,90,.5)'); rect(-43, r + o, 57, r + o + 0.35, 'rgba(70,78,90,.5)'); }); }); // tyre tracks
      var gtex = new THREE.CanvasTexture(gcv); gtex.encoding = THREE.sRGBEncoding; gtex.anisotropy = ANISO;
      var ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: gtex, roughness: 1 }));
      ground.receiveShadow = true; grp.add(ground);
      var outer = new THREE.Mesh(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col(C.outer), roughness: 1 }));
      outer.position.y = -0.05; grp.add(outer);
      var waterMat = new THREE.MeshStandardMaterial({ color: col('#2d83bf'), roughness: 0.3, metalness: 0.1 });
      var sea = new THREE.Mesh(new THREE.PlaneGeometry(349, 800).rotateX(-Math.PI / 2), waterMat); sea.position.set(-51 - 174.5, 0.03, 0);
      var basin = new THREE.Mesh(new THREE.PlaneGeometry(43, 354).rotateX(-Math.PI / 2), waterMat); basin.position.set(-38.5, 0.03, -46 - 177);
      grp.add(sea, basin);

      // ---- Buildings: one instanced box with a window texture tinted per building, plus roof caps.
      // Facade: cornice, framed sash windows with sills, a shopfront at street level, and soft edge/base darkening.
      var wcv = document.createElement('canvas'); wcv.width = wcv.height = 128;
      var wc = wcv.getContext('2d'); wc.fillStyle = '#fff'; wc.fillRect(0, 0, 128, 128);
      wc.fillStyle = '#e4e4e4'; wc.fillRect(0, 8, 128, 6); wc.fillStyle = '#c8c8c8'; wc.fillRect(0, 14, 128, 2);
      for (var wx = 0; wx < 3; wx++) for (var wy = 0; wy < 3; wy++) {
        var x0 = 14 + wx * 38, y0 = 22 + wy * 24, gl = wc.createLinearGradient(0, y0, 0, y0 + 16);
        wc.fillStyle = '#f4f4f4'; wc.fillRect(x0 - 2, y0 - 2, 24, 20);
        gl.addColorStop(0, '#4e6378'); gl.addColorStop(1, '#7f98ad'); wc.fillStyle = gl; wc.fillRect(x0, y0, 20, 16);
        wc.fillStyle = '#f4f4f4'; wc.fillRect(x0 + 9, y0, 2, 16); wc.fillRect(x0, y0 + 7, 20, 2);
        wc.fillStyle = '#d2d2d2'; wc.fillRect(x0 - 3, y0 + 17, 26, 3);
      }
      wc.fillStyle = '#d9d9d9'; wc.fillRect(0, 94, 128, 4);
      var sg = wc.createLinearGradient(0, 100, 0, 124); sg.addColorStop(0, '#3e5366'); sg.addColorStop(1, '#6d879c');
      wc.fillStyle = sg; wc.fillRect(8, 101, 76, 22); wc.fillStyle = '#5a4636'; wc.fillRect(94, 101, 22, 27);
      wc.fillStyle = '#efefef'; for (var mx = 8; mx <= 84; mx += 19) wc.fillRect(mx, 101, 2, 22);
      var ao = wc.createLinearGradient(0, 104, 0, 128); ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,.28)'); wc.fillStyle = ao; wc.fillRect(0, 104, 128, 24);
      [[0, 1], [128, -1]].forEach(function (e) { var eg = wc.createLinearGradient(e[0], 0, e[0] + e[1] * 10, 0); eg.addColorStop(0, 'rgba(0,0,0,.18)'); eg.addColorStop(1, 'rgba(0,0,0,0)'); wc.fillStyle = eg; wc.fillRect(Math.min(e[0], e[0] + e[1] * 10), 0, 10, 128); });
      var wtex = new THREE.CanvasTexture(wcv); wtex.encoding = THREE.sRGBEncoding;
      var bgeo = box(1, 1, 1).translate(0, 0.5, 0), buv = bgeo.attributes.uv;
      for (k = 8; k < 16; k++) buv.setXY(k, 0.5, 0.97); // top/bottom faces: plain wall, no windows
      var bmat = new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.9 });
      if (snow) { // lit windows at dusk: an emissive map with only the panes
        var ecv = document.createElement('canvas'); ecv.width = ecv.height = 128; var ec = ecv.getContext('2d'); ec.fillStyle = '#000'; ec.fillRect(0, 0, 128, 128);
        for (var ex = 0; ex < 3; ex++) for (var ey = 0; ey < 3; ey++) if ((ex * 7 + ey * 3) % 4) { ec.fillStyle = ['#ffcf7a', '#ffe2a0', '#ffb860'][(ex + ey) % 3]; ec.fillRect(14 + ex * 38, 22 + ey * 24, 20, 16); }
        ec.fillStyle = '#ffd58a'; ec.fillRect(8, 101, 76, 22);
        var etex = new THREE.CanvasTexture(ecv); etex.encoding = THREE.sRGBEncoding;
        bmat.emissiveMap = etex; bmat.emissive = new THREE.Color(0xffffff); bmat.emissiveIntensity = 0.85;
      }
      grp.add(inst(bgeo, bmat, buildings));
      grp.add(inst(box(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), roofs));

      grp.add(inst(merge([P(cyl(0.15, 0.22, 1.4, 6), '#6b4a2f', 0, 0.7, 0), P(new THREE.IcosahedronGeometry(1.25, 0), '#4f8f3a', 0, 2.2, 0), P(new THREE.IcosahedronGeometry(0.8, 0), '#5fa244', 0.2, 3.1, 0.1)]), vmat, trees));
      grp.add(inst(merge([P(cyl(0.07, 0.09, 3.2, 6), '#2f3640', 0, 1.6, 0), P(box(0.6, 0.06, 0.06), '#2f3640', 0.3, 3.17, 0), P(box(0.36, 0.12, 0.26), '#fff3b0', 0.55, 3.1, 0)]), vmat, lamps));
      grp.add(inst(merge([P(box(1.6, 0.08, 0.5), '#8d5a3b', 0, 0.45, 0), P(box(1.6, 0.4, 0.06), '#8d5a3b', 0, 0.75, -0.24), P(box(0.08, 0.45, 0.45), '#2f3640', -0.7, 0.22, 0), P(box(0.08, 0.45, 0.45), '#2f3640', 0.7, 0.22, 0)]), vmat, benches));
      grp.add(inst(merge([P(new THREE.ConeGeometry(0.24, 0.75, 8), '#ff6a13', 0, 0.42, 0), P(cyl(0.155, 0.19, 0.14, 8), '#ffffff', 0, 0.42, 0), P(box(0.5, 0.06, 0.5), '#222222', 0, 0.03, 0)]), vmat, cones));
      grp.add(inst(merge([P(box(1.6, 1.8, 1.6), '#ffffff', 0, 0.9, 0), P(new THREE.ConeGeometry(1.35, 0.8, 4), '#f4f1ea', 0, 2.2, 0, [0, Math.PI / 4, 0]), P(box(0.7, 1.2, 0.05), '#5a4636', 0.0, 0.6, 0.81)]), vmat, huts));
      var pmesh = inst(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2).scale(1, 1, 0.65), new THREE.MeshStandardMaterial({ color: col(snow ? '#d6ecfa' : '#6d9cc2'), roughness: snow ? 0.02 : 0.1, metalness: snow ? 0.4 : 0.2, transparent: true, opacity: 0.85 }), puddles);
      pmesh.castShadow = false; grp.add(pmesh);

      // Town hall + spire.
      var stone = new THREE.MeshStandardMaterial({ color: col('#d8bd92'), roughness: 0.9 });
      var hall = new THREE.Group(); hall.position.set(HALL[0], 0, HALL[1]);
      [[0, 3.5, -1, 12, 7, 8], [0, 7.5, -1, 12.4, 1, 8.4], [0, 8, 4, 3.2, 16, 3.2], [0, 17, 4, 2.4, 2, 2.4]].forEach(function (b) {
        var m = new THREE.Mesh(box(b[3], b[4], b[5]), stone); m.position.set(b[0], b[1], b[2]); m.receiveShadow = true; hall.add(m);
      });
      var spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 10, 4), new THREE.MeshStandardMaterial({ color: col('#7d8a8c'), roughness: 0.7 }));
      spire.rotation.y = Math.PI / 4; spire.position.set(0, 23, 4); spire.castShadow = true; hall.add(spire);
      var gold = new THREE.Mesh(ball(0.3), new THREE.MeshStandardMaterial({ color: col('#e8c050'), metalness: 0.8, roughness: 0.3 })); gold.position.set(0, 28.2, 4); hall.add(gold);
      var clock = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshStandardMaterial({ color: col('#fbf7ea'), roughness: 0.5 })); clock.position.set(0, 13.5, 5.62); hall.add(clock);
      grp.add(hall);

      // Harbour boats.
      var boats = ['#c1121f', '#003049', '#f77f00'].map(function (c, i) {
        var m = new THREE.Mesh(merge([P(box(4, 0.9, 1.6), c, 0, 0.2, 0), P(box(4.05, 0.15, 1.65), '#ffffff', 0, 0.55, 0), P(box(1.2, 0.9, 1.1), '#f4f4f4', -0.6, 1.1, 0), P(cyl(0.05, 0.05, 3, 6), '#333333', 0.8, 2, 0)]), vmat);
        m.position.set(-52 + i * 12, 0, -52 - (i % 2) * 3); m.rotation.y = 0.3 - i * 0.4; m.castShadow = true; grp.add(m); return m;
      });

      var statues = makeStatues(spots, grp, boxes, R);

      // ---- Cars: drive on the left round rectangular loops of streets.
      var LOOPS = [[-40, -40, 0, 0, 1], [0, -40, 40, 0, -1], [0, 0, 40, 40, 1], [-40, 0, 0, 40, -1], [-40, -40, 40, 40, 1]];
      function loopPts(Lp) {
        var e = Lp[4] > 0 ? 1.5 : -1.5, x0 = Lp[0] - e, z0 = Lp[1] - e, x1 = Lp[2] + e, z1 = Lp[3] + e, p = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
        return Lp[4] > 0 ? p : [p[0], p[3], p[2], p[1]];
      }
      function along(pts, s) {
        for (var i = 0; i < 4; i++) {
          var a = pts[i], b = pts[(i + 1) % 4], len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
          if (s <= len) { var t = s / len; return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: Math.sign(b[0] - a[0]), dz: Math.sign(b[1] - a[1]) }; }
          s -= len;
        }
        return { x: pts[0][0], z: pts[0][1], dx: 1, dz: 0 };
      }
      var cars = [[0, 0, '#d62828'], [0, 0.5, '#1d70b8'], [1, 0.1, '#f4a300'], [2, 0, '#2a9d8f'], [2, 0.5, '#f6f6f6'], [3, 0.3, '#6a4c93'], [4, 0, '#264653'], [4, 0.5, '#e76f51']].slice(0, snow ? 5 : 8).map(function (c, i) {
        var pts = loopPts(LOOPS[c[0]]), per = 0; pts.forEach(function (a, j) { var b = pts[(j + 1) % 4]; per += Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); });
        var parts = [P(box(2.6, 0.7, 1.3), c[2], 0, 0.55, 0), P(box(1.4, 0.55, 1.18), '#2c3e50', -0.15, 1.15, 0), P(box(1.42, 0.08, 1.2), c[2], -0.15, 1.44, 0),
          P(box(0.06, 0.18, 0.3), '#fff6c0', 1.31, 0.62, 0.42), P(box(0.06, 0.18, 0.3), '#fff6c0', 1.31, 0.62, -0.42), P(box(0.06, 0.15, 0.3), '#c1121f', -1.31, 0.65, 0.42), P(box(0.06, 0.15, 0.3), '#c1121f', -1.31, 0.65, -0.42)];
        [[0.8, 0.62], [0.8, -0.62], [-0.8, 0.62], [-0.8, -0.62]].forEach(function (w) { parts.push(P(cyl(0.3, 0.3, 0.22, 10), '#1a1a1a', w[0], 0.3, w[1], [Math.PI / 2, 0, 0])); });
        var m = new THREE.Mesh(merge(parts), vmat); m.castShadow = true; grp.add(m);
        return { pts: pts, per: per, s: c[1] * per, speed: 8 + (i % 3) * 1.5, m: m };
      });

      // ---- Seagulls: circle high up, then now and then swoop at the player.
      var gullBody = merge([P(ball(1, 10, 8), '#ffffff', 0, 0, 0, null, [0.36, 0.17, 0.17]), P(ball(0.13), '#ffffff', 0.33, 0.08, 0), P(new THREE.ConeGeometry(0.04, 0.18, 6), '#f4a300', 0.5, 0.06, 0, [0, 0, -Math.PI / 2]), P(box(0.25, 0.04, 0.2), '#9aa3ab', -0.38, 0.02, 0)]);
      var wingGeo = merge([P(box(0.42, 0.03, 0.9), '#aab3bb', 0, 0, 0.45), P(box(0.3, 0.031, 0.25), '#222222', -0.03, 0, 0.82)]);
      var gulls = (snow ? [] : [[-46, -12], [-30, -50], [0, 0], [30, 30]]).map(function (c, i) {
        var gg = new THREE.Group(), body = new THREE.Mesh(gullBody, vmat), wl = new THREE.Mesh(wingGeo, vmat), wr = new THREE.Mesh(wingGeo, vmat);
        wl.scale.z = -1; body.castShadow = wl.castShadow = wr.castShadow = true;
        wl.position.z = -0.1; wr.position.z = 0.1; gg.add(body, wl, wr); gg.scale.setScalar(1.5); grp.add(gg);
        return { g: gg, wl: wl, wr: wr, cx: c[0], cz: c[1], ox: c[0], oz: c[1], a: i * 1.6, st: 0, cd: 0, u: 0, fx: 0, fz: 0, tx: 0, tz: 0, ph: i };
      });

      // ---- Hogmanay extras: strings of coloured bulbs, fireworks over unfound Westies, snowball throwers.
      var fw = null, kids = [], balls = [], fwT = 1;
      if (snow) {
        var bulbs = [], BC2 = ['#ff3b3b', '#3bff6a', '#ffd23b', '#3bb4ff', '#ff6ad5'], bn = 0;
        ROADS.forEach(function (r) {
          for (var q = -42; q < 56; q += 2.2) {
            if (ROADS.some(function (o) { return Math.abs(q - o) < 4; })) continue;
            var sag = 3.1 - Math.abs(Math.sin(q * 0.7)) * 0.5;
            [-3.5, 3.5].forEach(function (o) { bulbs.push({ x: r + o, y: sag, z: q, s: 1, c: BC2[bn++ % 5] }); bulbs.push({ x: q, y: sag, z: r + o, s: 1, c: BC2[bn++ % 5] }); });
          }
        });
        var bm = inst(new THREE.SphereGeometry(0.13, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), bulbs); bm.receiveShadow = false; grp.add(bm);
        // Fireworks: one pooled particle system, a burst over a random unfound Westie every couple of seconds.
        var FN = 4, FP = 48, fpos = new Float32Array(FN * FP * 3), fcol = new Float32Array(FN * FP * 3), fvel = new Float32Array(FN * FP * 3), fage = [9, 9, 9, 9], fslot = 0;
        var fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); fgeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
        fw = new THREE.Points(fgeo, new THREE.PointsMaterial({ size: 0.8, map: spMat.map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        fw.frustumCulled = false; grp.add(fw);
        fw.userData.burst = function (x, z) {
          var b = fslot++ % FN, c = new THREE.Color(BC2[Math.floor(Math.random() * 5)]); fage[b] = 0;
          for (var n = 0; n < FP; n++) {
            var i3 = (b * FP + n) * 3, u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = 5 + Math.random() * 2;
            fpos[i3] = x; fpos[i3 + 1] = 12; fpos[i3 + 2] = z; fvel[i3] = r * Math.cos(a) * sp; fvel[i3 + 1] = u * sp; fvel[i3 + 2] = r * Math.sin(a) * sp;
            fcol[i3] = c.r; fcol[i3 + 1] = c.g; fcol[i3 + 2] = c.b;
          }
        };
        fw.userData.tick = function (dt) {
          for (var b = 0; b < FN; b++) {
            fage[b] += dt; var fade = Math.max(0, 1 - fage[b] / 1.8);
            for (var n = 0; n < FP; n++) {
              var i3 = (b * FP + n) * 3; fvel[i3 + 1] -= 4 * dt;
              fpos[i3] += fvel[i3] * dt; fpos[i3 + 1] += fvel[i3 + 1] * dt; fpos[i3 + 2] += fvel[i3 + 2] * dt;
              if (fade <= 0) fpos[i3 + 1] = -50;
              fcol[i3] *= fade > 0 ? 0.995 : 0; fcol[i3 + 1] *= fade > 0 ? 0.995 : 0; fcol[i3 + 2] *= fade > 0 ? 0.995 : 0;
            }
          }
          fgeo.attributes.position.needsUpdate = true; fgeo.attributes.color.needsUpdate = true;
        };
        // Snowball throwers on the pavements: lob a ball at the dog when it comes close.
        var kidGeo = merge([P(new THREE.ConeGeometry(0.42, 1.0, 8), '#c8102e', 0, 0.5, 0), P(ball(0.2), '#f1c27d', 0, 1.15, 0), P(new THREE.ConeGeometry(0.2, 0.35, 8), '#2a6fdb', 0, 1.42, 0), P(ball(0.08), '#ffffff', 0, 1.62, 0), P(box(0.5, 0.1, 0.12), '#2a9d8f', 0, 0.98, 0.05)]);
        [[-16.6, 8], [3.4, -12], [23.4, 26], [-36.6, -8], [43.4, 12]].forEach(function (k, n) {
          var m = new THREE.Mesh(kidGeo, vmat); m.position.set(k[0], 0, k[1]); m.castShadow = true; grp.add(m);
          kids.push({ m: m, x: k[0], z: k[1], cd: 2 + n });
        });
        var ballGeo = new THREE.SphereGeometry(0.22, 8, 6), ballMat = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 });
        for (var bb = 0; bb < 6; bb++) { var bmesh = new THREE.Mesh(ballGeo, ballMat); bmesh.visible = false; bmesh.castShadow = true; grp.add(bmesh); balls.push({ m: bmesh, on: false }); }
      }
      function tickSnow(dt) {
        fwT -= dt;
        if (fwT <= 0) { fwT = 1.6 + Math.random(); var left = statues.filter(function (q) { return !q.found; }); if (left.length) { var st = left[Math.floor(Math.random() * left.length)]; fw.userData.burst(st.x, st.z); } }
        fw.userData.tick(dt);
        kids.forEach(function (k) {
          var d = Math.hypot(px - k.x, pz - k.z); k.m.rotation.y = Math.atan2(-(pz - k.z), px - k.x) + Math.PI / 2;
          k.cd -= dt;
          if (k.cd <= 0 && d < 13 && state === 'play') {
            var b = balls.filter(function (q) { return !q.on; })[0]; if (!b) return;
            k.cd = 3 + Math.random() * 2;
            var tf = Math.max(0.6, d / 13);
            b.on = true; b.u = 0; b.tf = tf; b.x0 = k.x; b.z0 = k.z; b.x1 = px + vx * tf * 0.8; b.z1 = pz + vz * tf * 0.8; b.m.visible = true;
          }
        });
        balls.forEach(function (b) {
          if (!b.on) return;
          b.u += dt / b.tf;
          var u = Math.min(1, b.u), x = b.x0 + (b.x1 - b.x0) * u, z = b.z0 + (b.z1 - b.z0) * u, y = 1.4 + Math.sin(u * Math.PI) * 1.6 - u * 1.1;
          b.m.position.set(x, y, z);
          if (inv <= 0 && state === 'play' && y < 1.8 && Math.hypot(px - x, pz - z) < 0.75) { b.on = false; b.m.visible = false; hurt(px - x, pz - z); return; }
          if (u >= 1) { b.on = false; b.m.visible = false; }
        });
      }
      function tick(dt) {
        if (snow) tickSnow(dt);
        cars.forEach(function (c) {
          c.s = (c.s + c.speed * dt) % c.per;
          var q = along(c.pts, c.s); c.m.position.set(q.x, 0, q.z);
          c.m.rotation.y = lerpAngle(c.m.rotation.y, Math.atan2(-q.dz, q.dx), Math.min(1, dt * 10));
          if (inv > 0 || state !== 'play') return;
          var rx = px - q.x, rz = pz - q.z;
          if (Math.abs(rx * q.dx + rz * q.dz) < 1.3 + PR && Math.abs(rx * q.dz - rz * q.dx) < 0.65 + PR) hurt(rx, rz);
        });
        gulls.forEach(function (g) {
          var x, z, y, dx, dz, flap;
          if (g.st === 0) {
            g.cd -= dt; g.a += dt * 0.7;
            x = g.cx + Math.cos(g.a) * 7; z = g.cz + Math.sin(g.a) * 7; y = 9 + Math.sin(T * 1.3 + g.ph) * 0.6;
            dx = -Math.sin(g.a); dz = Math.cos(g.a); flap = Math.sin(T * 7 + g.ph) * 0.5;
            if (g.cd <= 0 && Math.hypot(px - x, pz - z) < 14) { g.st = 1; g.u = 0; g.fx = x; g.fz = z; g.tx = px + vx * 0.5; g.tz = pz + vz * 0.5; }
          } else {
            g.u = Math.min(1, g.u + dt / 2.6);
            x = g.fx + (g.tx - g.fx) * 2 * g.u; z = g.fz + (g.tz - g.fz) * 2 * g.u;
            y = 0.9 + 8.4 * Math.pow(2 * g.u - 1, 2); dx = g.tx - g.fx; dz = g.tz - g.fz; flap = g.u < 0.5 ? 0.9 : Math.sin(T * 12) * 0.6;
            if (inv <= 0 && state === 'play' && y < 1.9 && Math.hypot(px - x, pz - z) < 1.0) hurt(px - x, pz - z);
            if (g.u >= 1) { g.st = 0; g.cd = 9 + Math.random() * 7; g.cx = x - Math.cos(g.a) * 7; g.cz = z - Math.sin(g.a) * 7; }
          }
          g.g.position.set(x, y, z); g.g.rotation.y = Math.atan2(-dz, dx);
          g.wr.rotation.x = -flap; g.wl.rotation.x = flap;
        });
        boats.forEach(function (b, i) { b.position.y = Math.sin(T * 1.2 + i * 2) * 0.08; b.rotation.z = Math.sin(T * 0.9 + i) * 0.04; });
      }
      if (window.WESTIE_GAME_DEBUG) reachCheck(snow ? 'Hogmanay Snow' : 'Town', boxes, START, spots, -60, -60, 60, 60);
      return {
        key: snow ? 'hogmanay' : 'town', title: snow ? 'Hogmanay Snow' : 'Town', group: grp, boxes: boxes, statues: statues, start: START, cam: { h: 10, b: 10 },
        env: snow ? { top: '#2a2350', sky: 0xe7a27a, near: 55, far: 125, hemi: 0.45, hemiSky: 0xc8c0ff, ground: 0x8090a0, sun: 0.65, sunCol: 0xff9d6a, exposure: 1.0 }
          : { top: '#5aa6e8', sky: 0xcfe6f5, near: 60, far: 130, hemi: 0.62, hemiSky: 0xdbeeff, ground: 0x7a8a5a, sun: 1.0, sunCol: 0xffe2b8 },
        slow: function (x, z) { return !snow && puddles.some(function (p) { return Math.hypot(x - p.x, (z - p.z) / 0.65) < p.s; }); },
        slide: snow ? function (x, z) { return puddles.some(function (p) { return Math.hypot(x - p.x, (z - p.z) / 0.65) < p.s; }); } : null,
        tick: tick, exit: null,
        reset: function () { gulls.forEach(function (g) { g.st = 0; g.cd = 9 + g.ph * 4; g.cx = g.ox; g.cz = g.oz; }); kids.forEach(function (k, n) { k.cd = 2 + n; }); balls.forEach(function (b) { b.on = false; b.m.visible = false; }); }
      };
    }

    // ================= Level 2: Forest Maze =================
    // Maze of NC x NC cells (CS units each) carved by a seeded recursive backtracker, walls of trees on a hedge base.
    // night = Alloway by Night: same maze generator, moonlit, gravestones, a ruined kirk, witches, the Brig o' Doon.
    function buildForest(night) {
      var R = rng((Math.random() * 1e9) | 0), grp = new THREE.Group(), boxes = [];
      var NC = 12, CS = 6, H = NC * CS / 2, WT = 1.6, i, j, k;
      function cc(n) { return -H + CS * (n + 0.5); }
      var E = [], S = []; // E[i][j]: open between (i,j)-(i+1,j); S[i][j]: open between (i,j)-(i,j+1)
      for (i = 0; i < NC; i++) { E.push([]); S.push([]); for (j = 0; j < NC; j++) { E[i].push(false); S[i].push(false); } }
      function setOpen(a, b, c, d, v) { if (a === c) S[a][Math.min(b, d)] = v; else E[Math.min(a, c)][b] = v; }
      function isOpen(a, b, c, d) { return a === c ? S[a][Math.min(b, d)] : E[Math.min(a, c)][b]; }
      function nbrs(a, b) { return [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]].filter(function (p) { return p[0] >= 0 && p[0] < NC && p[1] >= 0 && p[1] < NC; }); }
      function links(a, b) { return nbrs(a, b).filter(function (p) { return isOpen(a, b, p[0], p[1]); }); }
      function bfs(a, b) { // distances in steps from (a,b), keyed "i,j"
        var d = {}, q = [[a, b]], h = 0; d[a + ',' + b] = 0;
        while (h < q.length) { var c = q[h++]; links(c[0], c[1]).forEach(function (p) { if (d[p] === undefined) { d[p] = d[c] + 1; q.push(p); } }); }
        return d;
      }
      var SC = [0, NC - 1], XC = [NC - 1, 0], seen = {}, stack = [SC]; seen[SC] = 1;
      while (stack.length) {
        var cur = stack[stack.length - 1], fresh = nbrs(cur[0], cur[1]).filter(function (p) { return !seen[p]; });
        if (!fresh.length) { stack.pop(); continue; }
        var nx = fresh[Math.floor(R() * fresh.length)]; setOpen(cur[0], cur[1], nx[0], nx[1], true); seen[nx] = 1; stack.push(nx);
      }
      // Clearings: open the walls inside two 2x2 blocks.
      var clearings = [[2 + Math.floor(R() * 3), 3 + Math.floor(R() * 3)], [6 + Math.floor(R() * 3), 3 + Math.floor(R() * 4)]];
      clearings.forEach(function (q) { var a = q[0], b = q[1]; setOpen(a, b, a + 1, b, true); setOpen(a, b + 1, a + 1, b + 1, true); setOpen(a, b, a, b + 1, true); setOpen(a + 1, b, a + 1, b + 1, true); });
      // Statues: the dead ends farthest from the start, spread apart.
      var dist = bfs(SC[0], SC[1]), cells = [];
      for (i = 0; i < NC; i++) for (j = 0; j < NC; j++) cells.push({ i: i, j: j, d: dist[i + ',' + j], dead: links(i, j).length === 1 });
      var cand = cells.filter(function (c) { return !(c.i === SC[0] && c.j === SC[1]) && !(c.i === XC[0] && c.j === XC[1]) && c.d > 2; });
      cand.sort(function (a, b) { return (b.dead - a.dead) || (b.d - a.d); });
      var picked = [], taken = {};
      [3, 0].forEach(function (gap) {
        cand.forEach(function (c) {
          if (picked.length >= FOREST_STATUES || taken[c.i + ',' + c.j]) return;
          if (picked.some(function (p) { return Math.abs(p.i - c.i) + Math.abs(p.j - c.j) < gap; })) return;
          picked.push(c); taken[c.i + ',' + c.j] = 1;
        });
      });
      // A few extra loops (never touching statue cells, so those stay dead ends).
      for (k = 0, i = 0; k < 80 && i < 8; k++) {
        var a = Math.floor(R() * NC), b = Math.floor(R() * NC), nb = nbrs(a, b), p = nb[Math.floor(R() * nb.length)];
        if (taken[a + ',' + b] || taken[p] || isOpen(a, b, p[0], p[1])) continue;
        setOpen(a, b, p[0], p[1], true); i++;
      }
      // Fallen logs block a few corridors on loops: only kept if everything stays reachable.
      var logs = [];
      for (k = 0; k < 80 && logs.length < 3; k++) {
        var c2 = cells[Math.floor(R() * cells.length)], ls = links(c2.i, c2.j), q2 = ls[Math.floor(R() * ls.length)];
        if (!q2 || taken[c2.i + ',' + c2.j] || taken[q2] || c2.d < 3) continue;
        setOpen(c2.i, c2.j, q2[0], q2[1], false);
        if (Object.keys(bfs(SC[0], SC[1])).length === NC * NC) logs.push([c2.i, c2.j, q2[0], q2[1]]);
        else setOpen(c2.i, c2.j, q2[0], q2[1], true);
      }
      console.assert(Object.keys(bfs(SC[0], SC[1])).length === NC * NC, 'WestieGame: forest maze is not fully connected');
      var isLog = {};
      logs.forEach(function (l) { isLog[Math.min(l[0], l[2]) + ',' + Math.min(l[1], l[3]) + (l[0] === l[2] ? 's' : 'e')] = 1; });

      // ---- Walls: hedge base + trees, one collider box per wall segment.
      var hedges = [], pines = [], rounds = [], posts = {};
      var TINT = night ? ['#8e9bb3', '#7a879f', '#9aa6bb', '#6f7c94', '#a4afc2'] : ['#ffffff', '#dfeccf', '#c9dcb8', '#eef7e6', '#d6e2c0'];
      function tree(x, z) {
        var t = { x: x + (R() - 0.5) * 0.5, z: z + (R() - 0.5) * 0.5, s: 0.85 + R() * 0.4, ry: R() * 6, c: TINT[Math.floor(R() * TINT.length)] };
        (R() < 0.6 ? pines : rounds).push(t);
      }
      function wall(x0, z0, x1, z1) {
        var vert = x0 === x1, len = vert ? z1 - z0 : x1 - x0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        boxes.push([Math.min(x0, x1) - WT / 2, Math.min(z0, z1) - WT / 2, Math.max(x0, x1) + WT / 2, Math.max(z0, z1) + WT / 2]);
        hedges.push({ x: mx, z: mz, sx: vert ? WT : len + WT, sy: 0.9 + R() * 0.3, sz: vert ? len + WT : WT, c: TINT[Math.floor(R() * TINT.length)] });
        [-1 / 3, 0, 1 / 3].forEach(function (t) { tree(vert ? x0 : mx + t * len, vert ? mz + t * len : z0); });
        [[x0, z0], [x1, z1]].forEach(function (v) { if (!posts[v]) { posts[v] = 1; tree(v[0], v[1]); } });
      }
      for (i = 0; i < NC; i++) for (j = 0; j < NC; j++) {
        var wx0 = -H + CS * i, wz0 = -H + CS * j;
        if (i < NC - 1 && !E[i][j] && !isLog[i + ',' + j + 'e']) wall(wx0 + CS, wz0, wx0 + CS, wz0 + CS);
        if (j < NC - 1 && !S[i][j] && !isLog[i + ',' + j + 's']) wall(wx0, wz0 + CS, wx0 + CS, wz0 + CS);
      }
      for (k = 0; k < NC; k++) {
        var t0 = -H + CS * k;
        wall(-H, t0, -H, t0 + CS); wall(H, t0, H, t0 + CS); wall(t0, H, t0 + CS, H);
        if (k !== XC[0]) wall(t0, -H, t0 + CS, -H);
      }
      var hedgeMesh = inst(box(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: col(night ? '#22392a' : '#3b6630'), roughness: 1 }), hedges);
      hedgeMesh.castShadow = false; grp.add(hedgeMesh);
      var pineMesh, roundMesh;
      grp.add(pineMesh = inst(merge([P(cyl(0.18, 0.26, 1.0, 6), '#5a3d26', 0, 0.5, 0), P(new THREE.ConeGeometry(1.25, 1.8, 7), '#2d6638', 0, 1.6, 0), P(new THREE.ConeGeometry(1.0, 1.5, 7), '#327040', 0, 2.5, 0), P(new THREE.ConeGeometry(0.68, 1.2, 7), '#3a7c47', 0, 3.3, 0)]), vmat, pines));
      grp.add(roundMesh = inst(merge([P(cyl(0.18, 0.26, 1.4, 6), '#5a3d26', 0, 0.7, 0), P(new THREE.IcosahedronGeometry(1.3, 0), '#4a8a3a', 0, 2.1, 0), P(new THREE.IcosahedronGeometry(0.85, 0), '#58993f', 0.2, 2.9, 0.1)]), vmat, rounds));

      // ---- Slow patches (mud, nettles), mushrooms and ferns in corridors.
      function freeCell() {
        for (var n = 0; n < 50; n++) {
          var c = cells[Math.floor(R() * cells.length)];
          if (!taken[c.i + ',' + c.j] && c.d > 1 && !(c.i === XC[0] && c.j === XC[1])) return c;
        }
        return cells[NC];
      }
      var slows = [], muds = [], nettles = [], shrooms = [], ferns = [];
      for (k = 0; k < 9; k++) {
        var fc = freeCell(), sx = cc(fc.i) + (R() - 0.5) * 1.5, sz = cc(fc.j) + (R() - 0.5) * 1.5, mud = k < 5;
        slows.push({ x: sx, z: sz, r: 1.3, mud: mud });
        if (mud) muds.push({ x: sx, y: 0.03, z: sz, s: 1.3, ry: R() * 3 });
        else for (var nn = 0; nn < 5; nn++) nettles.push({ x: sx + (R() - 0.5) * 1.8, z: sz + (R() - 0.5) * 1.8, s: 0.8 + R() * 0.5, ry: R() * 6 });
      }
      // Decorations hug the walls: offset from a cell centre towards a side with no passage.
      function byWall(list, n, mk) {
        for (var m = 0; m < n; m++) {
          var c = cells[Math.floor(R() * cells.length)], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (d) {
            var a = c.i + d[0], b = c.j + d[1];
            return a < 0 || a >= NC || b < 0 || b >= NC || !isOpen(c.i, c.j, a, b);
          });
          if (!dirs.length) continue;
          var d = dirs[Math.floor(R() * dirs.length)], off = CS / 2 - WT / 2 - 0.35, side = (R() - 0.5) * 3.5;
          list.push(mk(cc(c.i) + d[0] * off + (d[0] ? 0 : side), cc(c.j) + d[1] * off + (d[1] ? 0 : side)));
        }
      }
      byWall(shrooms, 45, function (x, z) { return { x: x, z: z, s: 0.7 + R() * 0.6, ry: R() * 6 }; });
      byWall(ferns, 90, function (x, z) { return { x: x, z: z, s: 0.7 + R() * 0.5, ry: R() * 6, c: TINT[Math.floor(R() * TINT.length)] }; });
      var mudMesh = inst(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2).scale(1, 1, 0.7), new THREE.MeshStandardMaterial({ color: col('#4a3622'), roughness: 0.15, metalness: 0.1 }), muds);
      mudMesh.castShadow = false; grp.add(mudMesh);
      var nettleParts = [];
      for (k = 0; k < 6; k++) { var an = k / 6 * Math.PI * 2; nettleParts.push(P(new THREE.ConeGeometry(0.09, 0.7, 4), k % 2 ? '#2f5a26' : '#3e7030', Math.cos(an) * 0.18, 0.35, Math.sin(an) * 0.18, [Math.sin(an) * 0.3, 0, -Math.cos(an) * 0.3])); }
      grp.add(inst(merge(nettleParts), vmat, nettles));
      grp.add(inst(merge([P(cyl(0.05, 0.07, 0.25, 6), '#f1ead8', 0, 0.12, 0), P(new THREE.SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#c62828', 0, 0.22, 0), P(cyl(0.035, 0.05, 0.16, 6), '#f1ead8', 0.18, 0.08, 0.1), P(new THREE.SphereGeometry(0.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#c62828', 0.18, 0.15, 0.1)]), vmat, shrooms));
      var fernParts = [];
      for (k = 0; k < 6; k++) { var af = k / 6 * Math.PI * 2; fernParts.push(P(new THREE.ConeGeometry(0.16, 1.0, 4), '#4d8f3a', Math.cos(af) * 0.32, 0.3, Math.sin(af) * 0.32, [Math.sin(af) * 1.0, 0, -Math.cos(af) * 1.0], [1, 1, 0.25])); }
      grp.add(inst(merge(fernParts), vmat, ferns));

      // ---- Fallen logs: the blocking ones from the maze, plus one in each clearing.
      var logGeo = merge([P(cyl(0.42, 0.46, 1, 10), '#6b4a2f', 0, 0, 0, [0, 0, Math.PI / 2]), P(cyl(0.38, 0.38, 0.04, 10), '#c9a46a', 0.5, 0, 0, [0, 0, Math.PI / 2]), P(cyl(0.38, 0.38, 0.04, 10), '#c9a46a', -0.5, 0, 0, [0, 0, Math.PI / 2]), P(box(0.3, 0.1, 0.5), '#5f8f3a', 0.1, 0.42, 0)]);
      function log(x, z, len, alongX) {
        var m = new THREE.Mesh(logGeo, vmat); m.position.set(x, 0.42, z); m.scale.set(len, 1, 1); if (!alongX) m.rotation.y = Math.PI / 2;
        m.castShadow = m.receiveShadow = true; grp.add(m);
        boxes.push(alongX ? [x - len / 2, z - 0.45, x + len / 2, z + 0.45] : [x - 0.45, z - len / 2, x + 0.45, z + len / 2]);
      }
      logs.forEach(function (l) {
        if (l[0] === l[2]) log(cc(l[0]), -H + CS * Math.max(l[1], l[3]), CS - 0.6, true); // blocks north-south travel
        else log(-H + CS * Math.max(l[0], l[2]), cc(l[1]), CS - 0.6, false);
      });
      if (!night) clearings.forEach(function (q) { log(-H + CS * (q[0] + 1) + 1.2, -H + CS * (q[1] + 1) - 1, 3.2, R() < 0.5); });

      // ---- Forest floor: grass, dirt paths along the corridors, leaves and dappled light.
      var M = H + 10, N = 1024, K = N / (2 * M), fcv = document.createElement('canvas'); fcv.width = fcv.height = N;
      var g = fcv.getContext('2d');
      function fr(x0, z0, x1, z1, c) { g.fillStyle = c; g.fillRect((x0 + M) * K, (z0 + M) * K, (x1 - x0) * K, (z1 - z0) * K); }
      function dot(x, z, r, c) { g.fillStyle = c; g.beginPath(); g.arc((x + M) * K, (z + M) * K, r * K, 0, 7); g.fill(); }
      fr(-M, -M, M, M, night ? '#1f3524' : '#3d6a31');
      for (k = 0; k < 16000; k++) { g.fillStyle = ['rgba(20,50,15,.25)', 'rgba(120,170,80,.18)', 'rgba(60,40,20,.15)'][k % 3]; g.fillRect(R() * N, R() * N, 2, 3); }
      clearings.forEach(function (q) { dot(-H + CS * (q[0] + 1), -H + CS * (q[1] + 1), CS * 0.95, night ? '#2c4630' : '#5c8c44'); });
      (night ? [['rgba(80,72,60,.6)', 1.7], ['#4e463a', 1.2]] : [['rgba(125,96,62,.55)', 1.7], ['#86684a', 1.2]]).forEach(function (pass) {
        var w = pass[1];
        for (i = 0; i < NC; i++) for (j = 0; j < NC; j++) {
          fr(cc(i) - w, cc(j) - w, cc(i) + w, cc(j) + w, pass[0]);
          if (i < NC - 1 && E[i][j]) fr(cc(i), cc(j) - w, cc(i + 1), cc(j) + w, pass[0]);
          if (j < NC - 1 && S[i][j]) fr(cc(i) - w, cc(j), cc(i) + w, cc(j + 1), pass[0]);
        }
        fr(cc(XC[0]) - w, -H - 4, cc(XC[0]) + w, cc(0), pass[0]);
      });
      slows.forEach(function (s) { dot(s.x, s.z, s.r * 1.1, s.mud ? '#3b2a1a' : 'rgba(30,60,25,.6)'); });
      for (k = 0; k < 9000; k++) { g.fillStyle = (night ? ['#3a3024', '#4a3c2a', '#2e261c', '#40382c', '#33291e'] : ['#b5651d', '#d9962b', '#8a3b12', '#c8a03a', '#6b4a22'])[k % 5]; g.save(); g.translate(R() * N, R() * N); g.rotate(R() * 6); g.fillRect(-1.5, -0.8, 3, 1.6); g.restore(); }
      for (k = 0; k < 110; k++) {
        var lx = R() * N, ly = R() * N, lr = 15 + R() * 45, gr = g.createRadialGradient(lx, ly, 0, lx, ly, lr);
        gr.addColorStop(0, night ? 'rgba(170,190,255,.14)' : 'rgba(255,240,170,.22)'); gr.addColorStop(1, 'rgba(255,240,170,0)'); g.fillStyle = gr; g.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
      }
      var ftex = new THREE.CanvasTexture(fcv); ftex.encoding = THREE.sRGBEncoding; ftex.anisotropy = ANISO;
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * M, 2 * M).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ftex, roughness: 1 }));
      floor.receiveShadow = true; grp.add(floor);
      var outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col(night ? '#1c2e20' : '#3a6230'), roughness: 1 }));
      outer.position.y = -0.05; grp.add(outer);

      // ---- Statues in the dead ends (solid plinths there; any fallback cell in a corridor stays walk-through).
      var statues = makeStatues(picked.map(function (c) { return [cc(c.i), cc(c.j)]; }), grp, boxes, R, function (n) { return picked[n].dead; });

      // ---- Exit gate on the far (north-east) edge: shut until all Westies are found.
      var gx = cc(XC[0]), gz = -H, gate = new THREE.Group(); gate.position.set(gx, 0, gz);
      var wood = new THREE.MeshStandardMaterial({ color: col('#6b4a2f'), roughness: 0.9 });
      [[-2.3, 1.6, 0, 0.5, 3.2, 0.5], [2.3, 1.6, 0, 0.5, 3.2, 0.5], [0, 3.3, 0, 5.3, 0.4, 0.55]].forEach(function (b) {
        var m = new THREE.Mesh(box(b[3], b[4], b[5]), wood); m.position.set(b[0], b[1], b[2]); m.castShadow = true; gate.add(m);
      });
      var leafGeo = merge([P(box(2, 1.5, 0.12), '#9a6a3c', 0, 0.9, 0), P(box(2, 0.14, 0.16), '#5a3d26', 0, 1.4, 0), P(box(2, 0.14, 0.16), '#5a3d26', 0, 0.4, 0), P(box(0.14, 1.4, 0.16), '#5a3d26', 0, 0.9, 0, [0, 0, 0.6])]);
      var hinges = [-1, 1].map(function (s) {
        var h = new THREE.Group(); h.position.set(s * 2.05, 0, 0);
        var leaf = new THREE.Mesh(leafGeo, vmat); leaf.position.x = -s * 1.02; leaf.castShadow = true; h.add(leaf); gate.add(h); return h;
      });
      var exitMat = new THREE.MeshBasicMaterial({ color: 0xa8ff7a, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      var glow = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 6, 20, 1, true).translate(0, 3, 0), exitMat); glow.scale.z = 0.4; glow.renderOrder = 2; gate.add(glow);
      grp.add(gate);
      var gateBox = [gx - 2.3, gz - 0.6, gx + 2.3, gz + 0.6]; boxes.push(gateBox);
      boxes.push([gx - 10, gz - 30, gx + 10, gz - 3]); // keeps the player near the gate if they step through
      var exit = { x: gx, z: gz, open: false, openIt: function () { exit.open = true; var n = boxes.indexOf(gateBox); if (n >= 0) boxes.splice(n, 1); } };
      var witches = [];
      if (night) {
        // The Brig o' Doon beyond the gate, over a dark burn.
        var burn = new THREE.Mesh(new THREE.PlaneGeometry(60, 3.5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col('#16283f'), roughness: 0.2, metalness: 0.3 }));
        burn.position.set(gx, 0.03, gz - 5.5); grp.add(burn);
        var brig = new THREE.Mesh(merge([P(box(3.4, 0.35, 9), '#7d7a72', 0, 0.9, 0), P(new THREE.TorusGeometry(2.2, 0.5, 6, 12, Math.PI), '#6e6b63', 0, -0.6, 0, [0, Math.PI / 2, 0]), P(box(0.3, 0.6, 9), '#8a877e', -1.6, 1.35, 0), P(box(0.3, 0.6, 9), '#8a877e', 1.6, 1.35, 0)]), vmat);
        brig.position.set(gx, 0, gz - 5.5); brig.castShadow = true; grp.add(brig);
        // Gravestones by the walls (corner spots, so corridors stay open) and a roofless kirk in the first clearing.
        var stones = [];
        for (k = 0; k < 60; k++) {
          var gc = cells[Math.floor(R() * cells.length)];
          if (taken[gc.i + ',' + gc.j] || gc.d < 2) continue;
          var gx2 = cc(gc.i) + Math.sign(R() - 0.5) * 1.7, gz2 = cc(gc.j) + Math.sign(R() - 0.5) * 1.7;
          stones.push({ x: gx2, z: gz2, ry: (R() - 0.5) * 0.4, s: 0.8 + R() * 0.4, c: ['#ffffff', '#d8dde6', '#c4cad6'][k % 3] });
          boxes.push([gx2 - 0.35, gz2 - 0.2, gx2 + 0.35, gz2 + 0.2]);
        }
        grp.add(inst(merge([P(box(0.6, 0.85, 0.16), '#9aa3b2', 0, 0.42, 0), P(cyl(0.3, 0.3, 0.16, 10), '#9aa3b2', 0, 0.85, 0, [Math.PI / 2, 0, 0]), P(box(0.7, 0.08, 0.3), '#6f7787', 0, 0.04, 0)]), vmat, stones));
        var kq = clearings[0], kx0 = -H + CS * (kq[0] + 1), kz0 = -H + CS * (kq[1] + 1), kmat = new THREE.MeshStandardMaterial({ color: col('#6c6a66'), roughness: 1 });
        [[-2, -1.5, -0.4, -1.5, 2.0], [0.4, -1.5, 2, -1.5, 1.4], [-2, 1.5, -0.4, 1.5, 1.2], [0.4, 1.5, 2, 1.5, 2.3], [-2, -1.5, -2, 1.5, 2.8], [2, -1.5, 2, 1.5, 1.6]].forEach(function (w) {
          var vert = w[0] === w[2], len = (vert ? w[3] - w[1] : w[2] - w[0]) + 0.4, m = new THREE.Mesh(box(vert ? 0.4 : len, w[4], vert ? len : 0.4), kmat);
          m.position.set(kx0 + (w[0] + w[2]) / 2, w[4] / 2, kz0 + (w[1] + w[3]) / 2); m.castShadow = true; grp.add(m);
          boxes.push([kx0 + Math.min(w[0], w[2]) - 0.2, kz0 + Math.min(w[1], w[3]) - 0.2, kx0 + Math.max(w[0], w[2]) + 0.2, kz0 + Math.max(w[1], w[3]) + 0.2]);
        });
        // Witches drift over the trees and chase the dog when it is close, but never near the open brig.
        var witchGeo = merge([P(new THREE.ConeGeometry(0.45, 1.1, 8), '#3b2a5a', 0, 0.55, 0), P(ball(0.17), '#8fc06a', 0, 1.2, 0), P(new THREE.ConeGeometry(0.22, 0.5, 8), '#111111', 0, 1.55, 0), P(cyl(0.34, 0.34, 0.03, 12), '#111111', 0, 1.3, 0),
          P(cyl(0.035, 0.035, 1.8, 6), '#6b4a2f', 0, 0.35, 0, [0, 0, Math.PI / 2]), P(new THREE.ConeGeometry(0.18, 0.5, 8), '#c8a050', -1.0, 0.35, 0, [0, 0, Math.PI / 2])]);
        var far = cells.filter(function (c) { return c.d >= 6 && !taken[c.i + ',' + c.j]; });
        witches = [0, 1, 2].map(function (n) {
          var h = far[Math.floor(R() * far.length)] || cells[0], m = new THREE.Mesh(witchGeo, vmat); m.castShadow = true; grp.add(m);
          return { m: m, x: cc(h.i), z: cc(h.j), tx: cc(h.i), tz: cc(h.j), ph: n * 2 };
        });
      }

      // ---- Foxes and badgers patrol the corridors (wander cell to cell, rarely turning back).
      var foxGeo = merge([P(ball(1, 10, 8), '#d9661f', 0, 0.45, 0, null, [0.42, 0.2, 0.2]), P(ball(0.17), '#d9661f', 0.45, 0.58, 0), P(new THREE.ConeGeometry(0.09, 0.26, 6), '#f1e4d0', 0.66, 0.55, 0, [0, 0, -Math.PI / 2]), P(ball(0.035), '#111111', 0.79, 0.55, 0),
        P(new THREE.ConeGeometry(0.07, 0.16, 4), '#3a2416', 0.42, 0.78, 0.09), P(new THREE.ConeGeometry(0.07, 0.16, 4), '#3a2416', 0.42, 0.78, -0.09), P(ball(1, 8, 6), '#d9661f', -0.6, 0.52, 0, [0, 0, 0.5], [0.32, 0.11, 0.11]), P(ball(0.09), '#ffffff', -0.88, 0.66, 0),
        P(box(0.08, 0.35, 0.08), '#2e1d12', 0.25, 0.17, 0.1), P(box(0.08, 0.35, 0.08), '#2e1d12', 0.25, 0.17, -0.1), P(box(0.08, 0.35, 0.08), '#2e1d12', -0.25, 0.17, 0.1), P(box(0.08, 0.35, 0.08), '#2e1d12', -0.25, 0.17, -0.1)]);
      var badgerGeo = merge([P(ball(1, 10, 8), '#7b7b7b', 0, 0.36, 0, null, [0.48, 0.24, 0.3]), P(ball(1, 10, 8), '#f4f4f4', 0.48, 0.4, 0, null, [0.2, 0.15, 0.15]), P(box(0.3, 0.06, 0.05), '#111111', 0.5, 0.52, 0.06), P(box(0.3, 0.06, 0.05), '#111111', 0.5, 0.52, -0.06),
        P(ball(0.04), '#111111', 0.68, 0.38, 0), P(box(0.12, 0.2, 0.12), '#1a1a1a', 0.28, 0.1, 0.17), P(box(0.12, 0.2, 0.12), '#1a1a1a', 0.28, 0.1, -0.17), P(box(0.12, 0.2, 0.12), '#1a1a1a', -0.28, 0.1, 0.17), P(box(0.12, 0.2, 0.12), '#1a1a1a', -0.28, 0.1, -0.17)]);
      function clearRun(c, q) { // the centre-to-centre run (half-width 0.5) misses every collider: plinths in dead ends, clearing logs
        var x0 = Math.min(cc(c[0]), cc(q[0])) - 0.5, x1 = Math.max(cc(c[0]), cc(q[0])) + 0.5, z0 = Math.min(cc(c[1]), cc(q[1])) - 0.5, z1 = Math.max(cc(c[1]), cc(q[1])) + 0.5;
        return !boxes.some(function (b) { return x1 > b[0] && x0 < b[2] && z1 > b[1] && z0 < b[3]; });
      }
      function nextCell(c, prev) {
        var ls = links(c[0], c[1]).filter(function (q) { return clearRun(c, q); }), opts = ls.filter(function (q) { return !prev || q[0] !== prev[0] || q[1] !== prev[1]; });
        if (!opts.length) opts = ls.length ? ls : links(c[0], c[1]);
        return opts[Math.floor(Math.random() * opts.length)];
      }
      var homes = cells.filter(function (c) { return c.d >= 5 && !taken[c.i + ',' + c.j]; });
      var critters = (night ? [] : [0, 1, 2, 3]).map(function (n) {
        var h = homes[Math.floor(R() * homes.length)] || cells[0], fox = n % 2 === 0;
        var m = new THREE.Mesh(fox ? foxGeo : badgerGeo, vmat); m.castShadow = true; m.scale.setScalar(1.2); grp.add(m);
        var c = [h.i, h.j];
        return { m: m, cur: c, prev: null, next: nextCell(c, null), t: R(), speed: fox ? 2.6 : 1.9, ph: n };
      });

      // Trees between the camera (south) and the player shrink to bushes so the dog stays in view.
      var tmpO = new THREE.Object3D();
      function cutTrees(mesh, items) {
        var changed = false;
        items.forEach(function (t, n) {
          var c = Math.abs(t.x - px) < 2.8 && t.z > pz + 0.3 && t.z < pz + 5.5;
          if (c === !!t.cut) return;
          t.cut = c; changed = true;
          tmpO.position.set(t.x, 0, t.z); tmpO.rotation.set(0, t.ry, 0); tmpO.scale.setScalar(c ? t.s * 0.3 : t.s); tmpO.updateMatrix(); mesh.setMatrixAt(n, tmpO.matrix);
        });
        if (changed) mesh.instanceMatrix.needsUpdate = true;
      }
      function tick(dt) {
        cutTrees(pineMesh, pines); cutTrees(roundMesh, rounds);
        if (night) {
          scene.fog.far = Math.max(17, 40 - time * 0.08); // the fog slowly closes in
          var safe = exit.open && Math.hypot(px - exit.x, pz - exit.z) < 7;
          witches.forEach(function (w) {
            var d = Math.hypot(px - w.x, pz - w.z), chase = d < 8 && !safe && state === 'play', sp = chase ? 3.4 : 1.4;
            if (chase) { w.tx = px; w.tz = pz; }
            else if (Math.hypot(w.tx - w.x, w.tz - w.z) < 0.5 || safe) { var c = cells[Math.floor(Math.random() * cells.length)]; w.tx = cc(c.i); w.tz = cc(c.j); }
            var dx = w.tx - w.x, dz = w.tz - w.z, l = Math.hypot(dx, dz) || 1, st = Math.min(l, sp * dt);
            w.x += dx / l * st; w.z += dz / l * st;
            // fly above the pines (tops ~3.9) and only dive to dog height when right over the dog, so they never pass through hedges
            w.h = (w.h == null ? 4.4 : w.h) + ((chase && d < 2.2 ? 0.9 : 4.4) - (w.h == null ? 4.4 : w.h)) * Math.min(1, dt * 3);
            w.m.position.set(w.x, w.h + Math.sin(T * 2 + w.ph) * 0.25, w.z); w.m.rotation.y = lerpAngle(w.m.rotation.y, Math.atan2(-dz, dx), Math.min(1, dt * 5));
            if (inv <= 0 && state === 'play' && w.h < 1.6 && d < 0.7 + PR) hurt(px - w.x, pz - w.z);
          });
        }
        critters.forEach(function (c) {
          c.t += c.speed * dt / CS;
          if (c.t >= 1) { c.t -= 1; c.prev = c.cur; c.cur = c.next; c.next = nextCell(c.cur, c.prev); }
          var x = cc(c.cur[0]) + (cc(c.next[0]) - cc(c.cur[0])) * c.t, z = cc(c.cur[1]) + (cc(c.next[1]) - cc(c.cur[1])) * c.t;
          c.m.position.set(x, Math.abs(Math.sin(T * 9 + c.ph)) * 0.06, z);
          c.m.rotation.y = lerpAngle(c.m.rotation.y, Math.atan2(-(c.next[1] - c.cur[1]), c.next[0] - c.cur[0]), Math.min(1, dt * 8));
          if (inv <= 0 && state === 'play' && Math.hypot(px - x, pz - z) < 0.75 + PR) hurt(px - x, pz - z);
        });
        if (exit.open) {
          hinges[0].rotation.y = Math.min(1.9, hinges[0].rotation.y + dt * 1.5); hinges[1].rotation.y = -hinges[0].rotation.y;
          exitMat.opacity = 0.18 + 0.08 * Math.sin(T * 3);
        }
      }
      if (night && window.WESTIE_GAME_DEBUG) reachCheck('Alloway by Night', boxes, [cc(SC[0]), cc(SC[1])], picked.map(function (c) { return [cc(c.i), cc(c.j)]; }).concat([[gx, gz + 1.2]]), -H, -H, H, H);
      return {
        key: night ? 'alloway' : 'forest', title: night ? 'Alloway by Night' : 'Forest Maze', group: grp, boxes: boxes, statues: statues, start: [cc(SC[0]), cc(SC[1])], cam: { h: 13, b: 4 },
        env: night ? { top: '#0b1430', sky: 0x1a2742, near: 12, far: 40, hemi: 0.3, hemiSky: 0x9fb4e8, ground: 0x0c121c, sun: 0.5, sunCol: 0xb4c8ff, exposure: 1.0 }
          : { top: '#6f9b86', sky: 0xa9c2a6, near: 20, far: 52, hemi: 0.6, hemiSky: 0xe8f5d8, ground: 0x2f3f25, sun: 0.9, sunCol: 0xffe7b0 },
        slow: function (x, z) { return slows.some(function (s) { return Math.hypot(x - s.x, z - s.z) < s.r; }); },
        tick: tick, exit: exit, reset: function () {}
      };
    }

    // ================= Levels 3 and 4: The Old Mill and The Tower =================
    // Floors of 4x4 rooms (doors from a seeded spanning tree, one open corridor row per floor),
    // furniture hugging the walls, ladders between floors at different spots, cutaway camera.
    function canvasTex(w, h, paint, rep) {
      var c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = ANISO;
      if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    }
    function scaleUV(geo, u, v) { var a = geo.attributes.uv; for (var i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * u, a.getY(i) * v); return geo; }
    function speck(c, w, h, n, cols) { for (var i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }

    // Floor surfaces (256px, tiled 8x across a 40-unit floor).
    var FLOORS = {
      wood: function (c, w, h) {
        var cols = ['#b07a4a', '#a56f40', '#bb8656', '#9c6a3e', '#b47f50'];
        for (var y = 0, r = 0; y < h; y += 32, r++) for (var x = -((r * 97) % 160); x < w; x += 160) {
          c.fillStyle = cols[Math.abs(r * 3 + Math.floor(x / 160)) % 5]; c.fillRect(x, y, 160, 32);
          c.fillStyle = 'rgba(60,35,15,.5)'; c.fillRect(x, y, 2, 32);
          for (var g = 0; g < 6; g++) { c.fillStyle = 'rgba(80,45,20,.12)'; c.fillRect(x, y + 4 + g * 5 + (g % 2), 160, 1); }
        }
        c.fillStyle = 'rgba(60,35,15,.55)'; for (y = 0; y < h; y += 32) c.fillRect(0, y, w, 2);
      },
      darkwood: function (c, w, h) {
        var cols = ['#5c3a22', '#66412a', '#543420', '#6d4630'];
        for (var y = 0, r = 0; y < h; y += 24, r++) for (var x = -((r * 61) % 128); x < w; x += 128) { c.fillStyle = cols[(r + Math.abs(Math.floor(x / 128))) % 4]; c.fillRect(x, y, 128, 24); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, y, 2, 24); }
        c.fillStyle = 'rgba(0,0,0,.4)'; for (y = 0; y < h; y += 24) c.fillRect(0, y, w, 2);
      },
      marble: function (c, w, h) {
        for (var y = 0; y < h; y += 64) for (var x = 0; x < w; x += 64) { c.fillStyle = (x + y) % 128 ? '#ece7df' : '#d9d2c6'; c.fillRect(x, y, 64, 64); }
        c.strokeStyle = 'rgba(120,110,100,.25)'; c.lineWidth = 1;
        for (var i = 0; i < 30; i++) { c.beginPath(); c.moveTo(Math.random() * w, Math.random() * h); c.bezierCurveTo(Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h); c.stroke(); }
        c.fillStyle = 'rgba(90,80,70,.35)'; for (var t = 0; t < w; t += 64) { c.fillRect(t, 0, 1, h); c.fillRect(0, t, w, 1); }
      },
      carpet: function (c, w, h) {
        c.fillStyle = '#56657a'; c.fillRect(0, 0, w, h); speck(c, w, h, 9000, ['rgba(255,255,255,.08)', 'rgba(0,0,0,.12)']);
        c.fillStyle = 'rgba(0,0,0,.18)'; for (var t = 0; t < w; t += 64) { c.fillRect(t, 0, 1, h); c.fillRect(0, t, w, 1); }
      },
      parquet: function (c, w, h) {
        for (var y = 0; y < h; y += 32) for (var x = 0; x < w; x += 32) {
          var hor = ((x + y) / 32) % 2; c.fillStyle = hor ? '#c99a62' : '#b98a55'; c.fillRect(x, y, 32, 32);
          c.fillStyle = 'rgba(80,50,20,.3)'; for (var k = 0; k < 32; k += 8) { if (hor) c.fillRect(x, y + k, 32, 1); else c.fillRect(x + k, y, 1, 32); }
        }
      },
      terracotta: function (c, w, h) {
        c.fillStyle = '#e6dccb'; c.fillRect(0, 0, w, h);
        var cols = ['#c0704a', '#b5653f', '#c97b52', '#ad5f3b'];
        for (var y = 0; y < h; y += 32) for (var x = 0; x < w; x += 32) { c.fillStyle = cols[(x / 32 + y / 16) % 4 | 0]; c.fillRect(x + 1.5, y + 1.5, 29, 29); }
      },
      checker: function (c, w, h) { for (var y = 0; y < h; y += 32) for (var x = 0; x < w; x += 32) { c.fillStyle = (x + y) % 64 ? '#2b2b2e' : '#f1eee6'; c.fillRect(x, y, 32, 32); } },
      grass: function (c, w, h) { c.fillStyle = '#6aa046'; c.fillRect(0, 0, w, h); speck(c, w, h, 14000, ['rgba(40,90,20,.35)', 'rgba(190,230,120,.3)', 'rgba(90,140,50,.4)']); }
    };
    var texCache = {};
    function floorTex(kind) { return texCache['f' + kind] || (texCache['f' + kind] = canvasTex(256, 256, FLOORS[kind], true)); }
    function wallTex(base, skirt) {
      var key = 'w' + base + skirt;
      return texCache[key] || (texCache[key] = canvasTex(128, 128, function (c, w, h) {
        c.fillStyle = base; c.fillRect(0, 0, w, h);
        speck(c, w, h, 1500, ['rgba(255,255,255,.3)', 'rgba(60,50,40,.08)']);
        c.fillStyle = skirt; c.fillRect(0, h - 14, w, 14); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0, h - 15, w, 2);
        var ao = c.createLinearGradient(0, h - 40, 0, h - 14); ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,.12)'); c.fillStyle = ao; c.fillRect(0, h - 40, w, 26);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, 0, w, 3);
      }));
    }
    function hedgeTex() {
      return texCache.hedge || (texCache.hedge = canvasTex(128, 128, function (c, w, h) { c.fillStyle = '#3d7a34'; c.fillRect(0, 0, w, h); speck(c, w, h, 5000, ['#2f6528', '#4f9443', '#5aa34c', '#285a22']); }));
    }
    var brickPaint = function (c, w, h) {
      c.fillStyle = '#7d3f2a'; c.fillRect(0, 0, w, h);
      var bc = ['#a4553a', '#9a4d33', '#b0603f', '#8f4630', '#a85a3c'];
      for (var y = 0, r = 0; y < h; y += 16, r++) for (var x = (r % 2) * -16; x < w; x += 32) { c.fillStyle = bc[(x / 32 + r * 7) % 5 | 0]; c.fillRect(x + 1, y + 1, 30, 14); }
      c.fillStyle = '#ffe2a6'; c.fillRect(96, 64, 64, 96); c.fillStyle = '#3c4a56'; c.fillRect(100, 68, 56, 88); c.fillStyle = '#e8dccb'; c.fillRect(126, 68, 4, 88); c.fillRect(100, 108, 56, 4); c.fillRect(90, 158, 76, 8);
    };
    var stonePaint = function (c, w, h) { // tower facade: pale sandstone blocks with tall windows
      c.fillStyle = '#b9a688'; c.fillRect(0, 0, w, h);
      for (var y = 0, r = 0; y < h; y += 32, r++) for (var x = (r % 2) * -32; x < w; x += 64) { c.fillStyle = ['#d6c4a4', '#cfbd9b', '#dccbad', '#c9b694'][(x / 64 + r * 3) % 4 | 0]; c.fillRect(x + 1, y + 1, 62, 30); }
      c.fillStyle = '#e9dcc4'; c.fillRect(92, 40, 72, 150); c.fillStyle = '#34495a'; c.fillRect(98, 46, 60, 138); c.fillStyle = '#e9dcc4'; c.fillRect(126, 46, 4, 138); c.fillRect(98, 110, 60, 4);
    };

    // Furniture prototypes (length along x, depth along z, back against -z); built once, shared by both towers.
    var FURN = null;
    function furniture() {
      if (FURN) return FURN;
      function shelf() {
        var ps = [P(box(2.4, 2.0, 0.08), '#6b4a2f', 0, 1.0, -0.26), P(box(0.08, 2.0, 0.6), '#6b4a2f', -1.16, 1.0, 0), P(box(0.08, 2.0, 0.6), '#6b4a2f', 1.16, 1.0, 0)];
        for (var s = 0; s < 4; s++) {
          ps.push(P(box(2.3, 0.06, 0.58), '#7d5838', 0, 0.05 + s * 0.6, 0));
          if (s < 3) for (var bk = 0; bk < 7; bk++) ps.push(P(box(0.18 + (bk % 3) * 0.04, 0.42 - (bk % 2) * 0.08, 0.4), ['#c0392b', '#2e86c1', '#27ae60', '#f39c12', '#8e44ad', '#d35400', '#16a085'][(bk + s) % 7], -0.95 + bk * 0.3, 0.3 + s * 0.6, 0));
        }
        return merge(ps);
      }
      function bush(x, y, z, r, c) { return P(new THREE.IcosahedronGeometry(r, 0), c, x, y, z); }
      FURN = {
        crates: { len: 2.4, dep: 1.2, geo: merge([P(box(1.15, 1.1, 1.15), '#b38a55', -0.6, 0.55, 0), P(box(1.15, 1.1, 1.15), '#a57d4b', 0.6, 0.55, 0), P(box(0.95, 0.9, 0.95), '#c29a63', -0.5, 1.55, 0.05, [0, 0.3, 0]), P(box(1.17, 0.12, 1.17), '#7a5a34', -0.6, 0.55, 0), P(box(1.17, 0.12, 1.17), '#7a5a34', 0.6, 0.55, 0)]) },
        desk: { len: 2.2, dep: 1.1, geo: merge([P(box(2.2, 0.1, 1.0), '#8b5a35', 0, 0.78, 0), P(box(0.1, 0.75, 0.9), '#5c3c26', -1.0, 0.38, 0), P(box(0.1, 0.75, 0.9), '#5c3c26', 1.0, 0.38, 0), P(box(0.6, 0.5, 0.04), '#2b2f36', 0.3, 1.1, -0.25), P(box(0.5, 0.06, 0.5), '#3a5a8a', -0.4, 0.5, 0.75), P(box(0.5, 0.5, 0.06), '#3a5a8a', -0.4, 0.75, 0.98)]) },
        shelf: { len: 2.4, dep: 0.6, geo: shelf() },
        sofa: { len: 2.4, dep: 1.0, geo: merge([P(box(2.4, 0.45, 0.95), '#5d7fa8', 0, 0.3, 0.02), P(box(2.4, 0.6, 0.25), '#4f6f96', 0, 0.75, -0.36), P(box(0.25, 0.55, 0.95), '#4f6f96', -1.08, 0.5, 0.02), P(box(0.25, 0.55, 0.95), '#4f6f96', 1.08, 0.5, 0.02), P(box(0.7, 0.12, 0.7), '#6d8fb8', -0.5, 0.58, 0.05), P(box(0.7, 0.12, 0.7), '#6d8fb8', 0.4, 0.58, 0.05)]) },
        plant: { len: 1.2, dep: 1.2, geo: merge([P(cyl(0.38, 0.3, 0.6, 10), '#c46a3d', 0, 0.3, 0), bush(0, 1.05, 0, 0.55, '#3f8a3a'), bush(0.2, 1.45, 0.1, 0.38, '#4d9b45'), bush(-0.2, 1.35, -0.1, 0.32, '#367a32')]) },
        reception: { len: 2.6, dep: 1.1, geo: merge([P(box(2.6, 1.05, 0.9), '#7a4a2a', 0, 0.52, 0.05), P(box(2.7, 0.08, 1.0), '#e9e1d2', 0, 1.08, 0.05), P(box(0.5, 0.35, 0.04), '#2b2f36', 0.6, 1.3, -0.15), P(ball(0.12), '#f2c418', -0.8, 1.2, 0)]) },
        painting: { len: 1.8, dep: 0.2, geo: merge([P(box(1.8, 1.3, 0.08), '#b8892c', 0, 1.65, -0.04), P(box(1.6, 1.1, 0.02), '#2f5f8a', 0, 1.65, 0.01), P(box(0.7, 0.5, 0.02), '#e9c46a', -0.35, 1.8, 0.02), P(box(0.5, 0.7, 0.02), '#e76f51', 0.4, 1.55, 0.03), P(ball(0.18, 8, 6), '#f4f1de', 0.15, 1.95, 0.02)]) },
        bench: { len: 2.2, dep: 0.8, geo: merge([P(box(2.2, 0.12, 0.7), '#8d5a3b', 0, 0.45, 0.05), P(box(0.12, 0.45, 0.6), '#2f3640', -0.9, 0.22, 0.05), P(box(0.12, 0.45, 0.6), '#2f3640', 0.9, 0.22, 0.05)]) },
        planter: { len: 2.4, dep: 1.0, geo: merge([P(box(2.4, 0.6, 0.95), '#8a6a4a', 0, 0.3, 0), P(box(2.3, 0.06, 0.85), '#4a3422', 0, 0.6, 0), bush(-0.7, 0.95, 0, 0.45, '#4d9b45'), bush(0.1, 1.05, 0.05, 0.5, '#3f8a3a'), bush(0.8, 0.9, -0.05, 0.4, '#e86a8a'), bush(0.45, 0.85, 0.15, 0.25, '#f2c418')]) },
        table: { len: 2.2, dep: 1.4, geo: merge([P(cyl(0.6, 0.6, 0.06, 16), '#f4efe6', 0, 0.78, 0.1), P(cyl(0.06, 0.08, 0.75, 8), '#333333', 0, 0.38, 0.1), P(cyl(0.22, 0.22, 0.06, 12), '#c8102e', -0.85, 0.48, 0.1), P(cyl(0.04, 0.04, 0.46, 6), '#333333', -0.85, 0.23, 0.1), P(cyl(0.22, 0.22, 0.06, 12), '#c8102e', 0.85, 0.48, 0.1), P(cyl(0.04, 0.04, 0.46, 6), '#333333', 0.85, 0.23, 0.1), P(cyl(0.08, 0.06, 0.14, 8), '#ffffff', 0.15, 0.88, 0.2)]) },
        counter: { len: 2.6, dep: 0.9, geo: merge([P(box(2.6, 1.0, 0.85), '#e9e1d2', 0, 0.5, 0), P(box(2.7, 0.08, 0.95), '#3b3b3e', 0, 1.04, 0), P(box(0.5, 0.45, 0.45), '#9aa0a8', -0.7, 1.3, -0.1), P(cyl(0.12, 0.12, 0.3, 10), '#c8102e', 0.4, 1.23, 0), P(cyl(0.1, 0.1, 0.25, 10), '#2e86c1', 0.8, 1.2, 0.05)]) }
      };
      return FURN;
    }

    var MILL = {
      key: 'tower', title: 'The Old Mill', seed: 1887, numbered: false, perFloor: [3, 3, 3, 3], start: [0, 3],
      ladders: [[0, 3, 0, 1, -1], [1, 0, 0, -1, -1], [1, 1, 3, 1, 1], [2, 3, 3, 1, 1]],
      themes: ['mill', 'mill', 'mill', 'mill'], pats: [['vac'], ['cat'], ['vac'], ['cat']], spills: [2, 2, 2, 2],
      facade: brickPaint, cam: { h: 12, b: 7 },
      env: { top: '#e7a46e', sky: 0xf4d8b6, near: 45, far: 110, hemi: 0.85, hemiSky: 0xfff1dc, ground: 0x6a5a48, sun: 1.15, sunCol: 0xffd6a0 }
    };
    var TOWER7 = {
      key: 'tower7', title: 'The Tower', seed: 3131, numbered: true, perFloor: null, start: [0, 3],
      ladders: [[0, 3, 0, 1, -1], [1, 0, 0, -1, -1], [1, 1, 3, 1, 1], [2, 3, 3, 1, 1], [3, 0, 3, -1, 1], [3, 2, 0, 1, -1], [4, 3, 1, 1, -1], [5, 0, 0, -1, -1], [5, 2, 3, 1, 1]],
      themes: ['lobby', 'library', 'office', 'gallery', 'greenhouse', 'cafe', 'roof'],
      pats: [['vac'], ['vac'], ['cat'], ['cat', 'vac'], ['cat', 'vac'], ['cat', 'cat'], ['ball', 'cat']], spills: [1, 1, 2, 2, 2, 3, 2],
      facade: stonePaint, cam: { h: 12, b: 7 },
      env: { top: '#5f9fe0', sky: 0xd9ebf7, near: 50, far: 120, hemi: 0.75, hemiSky: 0xf2f8ff, ground: 0x6a6a5a, sun: 1.05, sunCol: 0xfff0d8 }
    };
    var THEMES = {
      mill: { floor: 'wood', wall: ['#f1e8d8', '#7a5236'], furn: ['crates', 'desk', 'shelf', 'sofa'], rug: 0.35 },
      lobby: { name: 'Lobby', floor: 'marble', wall: ['#f3ead9', '#8a6a4a'], furn: ['sofa', 'plant', 'reception', 'plant'], rug: 0.3 },
      library: { name: 'Library', floor: 'darkwood', wall: ['#2f5a46', '#4a2e1c'], furn: ['shelf', 'shelf', 'desk', 'shelf'], rug: 0.5 },
      office: { name: 'Office', floor: 'carpet', wall: ['#e4e8ee', '#5a6270'], furn: ['desk', 'desk', 'shelf', 'plant'], rug: 0 },
      gallery: { name: 'Gallery', floor: 'parquet', wall: ['#fbfaf6', '#9a9a9a'], furn: ['painting', 'painting', 'bench', 'painting'], rug: 0 },
      greenhouse: { name: 'Greenhouse', floor: 'terracotta', wall: ['#d6efdd', '#5d7a5f'], furn: ['planter', 'plant', 'planter', 'plant'], rug: 0 },
      cafe: { name: 'Café', floor: 'checker', wall: ['#f6dfa8', '#7a4a2a'], furn: ['table', 'counter', 'table', 'sofa'], rug: 0 },
      roof: { name: 'Rooftop garden', floor: 'grass', wall: 'hedge', furn: ['planter', 'bench', 'plant', 'table'], rug: 0, low: true }
    };

    function buildTower(cfg) {
      var R = rng(cfg.seed), grp = new THREE.Group(), NF = cfg.themes.length, FH = 4, RS = 10, NR = 4, HALF = 20, WT = 0.4, DOOR = 2.6, i, j, k, f;
      function rc(n) { return -HALF + RS * (n + 0.5); }
      var LADS = cfg.ladders.map(function (l) {
        var cx = rc(l[1]), cz = rc(l[2]), t = l[4], x = cx + l[3] * 3.0, z = cz + t * (RS / 2 - WT / 2 - 0.12);
        return { from: l[0], room: [l[1], l[2]], corner: [l[3], t], x: x, z: z, fx: x, fz: z - t * 0.9, ax: x, az: z - t * 2.6, face: Math.atan2(-t, 0) };
      });
      var START_ROOM = cfg.start, start = [rc(START_ROOM[0]), rc(START_ROOM[1]) + 1];
      // Westies per floor: the Tower spreads every trail design over its floors; designs.length may be 31 at runtime.
      var total = cfg.perFloor ? cfg.perFloor.reduce(function (a, b) { return a + b; }, 0) : D.length;
      var perFloor = cfg.perFloor || cfg.themes.map(function (t, n) { return Math.floor(total / NF) + (n < total % NF ? 1 : 0); });

      var F_ = furniture();
      var facadeTex = canvasTex(256, 256, cfg.facade, true);
      var outerMat = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.9 });
      var parapetMat = new THREE.MeshStandardMaterial({ color: col('#cdbfa8'), roughness: 0.9 });
      var wallGeo = box(1, 1, 1).translate(0, 0.5, 0);
      var cobbleTex = texCache.cobble || (texCache.cobble = canvasTex(256, 256, function (c, w, h) {
        c.fillStyle = '#6e6a62'; c.fillRect(0, 0, w, h);
        for (var y = 0, r = 0; y < h; y += 21, r++) for (var x = (r % 2) * 12; x < w + 12; x += 24) { c.fillStyle = ['#8d877c', '#9a9488', '#7f7a70', '#a39d90'][(x + r * 3) % 4 | 0]; c.beginPath(); c.ellipse(x, y + 10, 10.5, 9, 0, 0, 7); c.fill(); }
      }, true));
      var yard = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(240, 240), 40, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 1 }));
      yard.position.y = -0.02; yard.receiveShadow = true; grp.add(yard);
      // Lower storeys seen from outside when you are upstairs.
      var shellTex = facadeTex.clone(); shellTex.needsUpdate = true;
      var shell = new THREE.Mesh(box(40.4, 1, 40.4).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ map: shellTex, roughness: 0.9 }));
      shell.castShadow = shell.receiveShadow = true; grp.add(shell);

      var signGeo = merge([P(box(0.5, 0.8, 0.04), '#f2c418', 0, 0.38, 0.12, [-0.3, 0, 0]), P(box(0.5, 0.8, 0.04), '#f2c418', 0, 0.38, -0.12, [0.3, 0, 0]), P(box(0.3, 0.08, 0.05), '#222222', 0, 0.48, 0.15, [-0.3, 0, 0])]);
      var spillMat = new THREE.MeshStandardMaterial({ color: col('#a9d4f0'), roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55 });
      var ringMats = { up: new THREE.MeshBasicMaterial({ color: 0x6cff8f, transparent: true, opacity: 0.7, depthWrite: false }), down: new THREE.MeshBasicMaterial({ color: 0x6cc7ff, transparent: true, opacity: 0.7, depthWrite: false }) };
      var ringGeo = new THREE.RingGeometry(0.5, 0.72, 28).rotateX(-Math.PI / 2);
      var railGeo = merge((function () {
        var ps = [P(box(0.1, FH + 0.9, 0.1), '#8a6a42', -0.45, (FH + 0.9) / 2, 0), P(box(0.1, FH + 0.9, 0.1), '#8a6a42', 0.45, (FH + 0.9) / 2, 0)];
        for (var y = 0.35; y < FH + 0.8; y += 0.4) ps.push(P(box(0.9, 0.07, 0.07), '#a88456', 0, y, 0));
        return ps;
      })());
      var hatchGeo = merge([P(box(1.3, 0.04, 1.0), '#1b140e', 0, 0.02, 0.1), P(box(1.4, 0.06, 0.08), '#5c3c26', 0, 0.03, 0.62), P(box(0.1, 1.0, 0.1), '#8a6a42', -0.45, 0.5, 0), P(box(0.1, 1.0, 0.1), '#8a6a42', 0.45, 0.5, 0)]);
      var PATGEO = {
        vac: merge([P(cyl(0.45, 0.45, 0.14, 20), '#2f3238', 0, 0.09, 0), P(cyl(0.38, 0.38, 0.03, 20), '#4a4f58', 0, 0.17, 0), P(cyl(0.08, 0.08, 0.03, 10), '#39c0ff', 0.15, 0.19, 0), P(box(0.08, 0.06, 0.6), '#9aa0a8', 0.42, 0.08, 0)]),
        cat: merge([P(ball(1, 10, 8), '#e08a3c', 0, 0.38, 0, null, [0.38, 0.17, 0.16]), P(ball(0.16), '#e08a3c', 0.4, 0.5, 0), P(new THREE.ConeGeometry(0.06, 0.14, 4), '#c86f28', 0.4, 0.68, 0.08), P(new THREE.ConeGeometry(0.06, 0.14, 4), '#c86f28', 0.4, 0.68, -0.08),
          P(ball(0.03), '#1d6b2a', 0.54, 0.54, 0.06), P(ball(0.03), '#1d6b2a', 0.54, 0.54, -0.06), P(cyl(0.035, 0.03, 0.55, 6), '#c86f28', -0.5, 0.6, 0, [0, 0, 0.7]),
          P(box(0.07, 0.3, 0.07), '#d07a30', 0.22, 0.15, 0.08), P(box(0.07, 0.3, 0.07), '#d07a30', 0.22, 0.15, -0.08), P(box(0.07, 0.3, 0.07), '#d07a30', -0.22, 0.15, 0.08), P(box(0.07, 0.3, 0.07), '#d07a30', -0.22, 0.15, -0.08), P(box(0.3, 0.02, 0.33), '#f4e2c8', 0, 0.22, 0)]),
        ball: merge([P(new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI / 2), '#e63946', 0, 0, 0), P(new THREE.SphereGeometry(0.5, 16, 12, Math.PI / 2, Math.PI / 2), '#ffffff', 0, 0, 0), P(new THREE.SphereGeometry(0.5, 16, 12, Math.PI, Math.PI / 2), '#118ab2', 0, 0, 0), P(new THREE.SphereGeometry(0.5, 16, 12, Math.PI * 1.5, Math.PI / 2), '#ffd166', 0, 0, 0)])
      };
      var PATSPEED = { vac: 1.8, cat: 2.6, ball: 3.3 };
      var RUGS = ['#8e3b46', '#2f5d7c', '#6b7f3a', '#9a6a2a'];

      // ---- Floors.
      var floors = [], statueSpots = [];
      for (f = 0; f < NF; f++) {
        var th = THEMES[cfg.themes[f]], FR = rng(500 + f * 31), F = { g: new THREE.Group(), boxes: [], walls: [], slows: [], E: [], S: [], th: th, pats: [] };
        F.g.position.y = f * FH; grp.add(F.g);
        var WH = th.low ? 1.7 : 2.6;
        for (i = 0; i < NR; i++) { F.E.push([0, 0, 0, 0]); F.S.push([0, 0, 0, 0]); }
        // Doors: spanning tree (backtracker) + a few extras; one row is an open corridor.
        var seen = {}, stack = [[0, 0]]; seen['0,0'] = 1;
        var nb = function (a, b) { return [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]].filter(function (p) { return p[0] >= 0 && p[0] < NR && p[1] >= 0 && p[1] < NR; }); };
        var setD = function (FF) { return function (a, b, c, d, v) { if (a === c) FF.S[a][Math.min(b, d)] = Math.max(FF.S[a][Math.min(b, d)], v); else FF.E[Math.min(a, c)][b] = Math.max(FF.E[Math.min(a, c)][b], v); }; }(F);
        while (stack.length) {
          var cu = stack[stack.length - 1], fr = nb(cu[0], cu[1]).filter(function (p) { return !seen[p]; });
          if (!fr.length) { stack.pop(); continue; }
          var nx = fr[Math.floor(FR() * fr.length)]; setD(cu[0], cu[1], nx[0], nx[1], 1); seen[nx] = 1; stack.push(nx);
        }
        for (k = 0; k < (th.low ? 7 : 3); k++) { var ea = Math.floor(FR() * NR), eb = Math.floor(FR() * NR), en = nb(ea, eb), ep = en[Math.floor(FR() * en.length)]; setD(ea, eb, ep[0], ep[1], 1); }
        var crow = [1, 2, 2, 1][f % 4]; for (i = 0; i < NR - 1; i++) F.E[i][crow] = 2;
        F.links = function (FF) { return function (a, b) { return nb(a, b).filter(function (p) { return p[0] === a ? FF.S[a][Math.min(b, p[1])] : FF.E[Math.min(a, p[0])][b]; }); }; }(F);

        // Slab, themed walls (inner), facade or parapet (outer); each wall remembers its height for the cutaway.
        var slab = new THREE.Mesh(scaleUV(box(40.4, 0.3, 40.4), 8, 8).translate(0, -0.15, 0), new THREE.MeshStandardMaterial({ map: floorTex(th.floor), roughness: th.floor === 'marble' || th.floor === 'checker' ? 0.35 : 0.75 }));
        slab.receiveShadow = true; F.g.add(slab);
        var innerMat = new THREE.MeshStandardMaterial({ map: th.wall === 'hedge' ? hedgeTex() : wallTex(th.wall[0], th.wall[1]), roughness: 0.95 });
        var wall = function (FF, WHh, inMat) {
          return function (x0, z0, x1, z1, outer) {
            var vert = x0 === x1, len = (vert ? z1 - z0 : x1 - x0) + WT, m, hgt = outer && th.low ? 1.1 : WHh;
            if (outer && !th.low) { m = new THREE.Mesh(scaleUV(box(len, hgt, WT), len / 4, 0.65).translate(0, hgt / 2, 0), outerMat); if (vert) m.rotation.y = Math.PI / 2; }
            else { m = new THREE.Mesh(wallGeo, outer ? parapetMat : inMat); m.scale.set(vert ? WT : len, hgt, vert ? len : WT); }
            m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); m.receiveShadow = true; FF.g.add(m);
            FF.walls.push({ m: m, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: vert ? WT / 2 : len / 2, fixed: vert && len > 12, cur: 1, full: m.geometry === wallGeo ? hgt : 1 });
            FF.boxes.push([Math.min(x0, x1) - WT / 2, Math.min(z0, z1) - WT / 2, Math.max(x0, x1) + WT / 2, Math.max(z0, z1) + WT / 2]);
          };
        }(F, WH, innerMat);
        var split = function (a0, a1, mk, state) { // full wall, wall with a centred door, or nothing
          if (state === 2) return;
          if (state === 0) { mk(a0, a1); return; }
          var mid = (a0 + a1) / 2; mk(a0, mid - DOOR / 2); mk(mid + DOOR / 2, a1);
        };
        for (i = 0; i < NR; i++) for (j = 0; j < NR; j++) {
          var X0 = -HALF + RS * i, Z0 = -HALF + RS * j;
          if (i < NR - 1) split(Z0, Z0 + RS, function (a, b) { wall(X0 + RS, a, X0 + RS, b); }, F.E[i][j]);
          if (j < NR - 1) split(X0, X0 + RS, function (a, b) { wall(a, Z0 + RS, b, Z0 + RS); }, F.S[i][j]);
        }
        wall(-HALF, -HALF, HALF, -HALF, true); wall(-HALF, HALF, HALF, HALF, true); wall(-HALF, -HALF, -HALF, HALF, true); wall(HALF, -HALF, HALF, HALF, true);
        floors.push(F);
      }

      // ---- Ladders: base on the lower floor, hatch on the upper one; corners reserved on both.
      var reserved = {};
      function resv(fl, rm, cn) { reserved[fl + ':' + rm[0] + ',' + rm[1] + ':' + cn[0] + ',' + cn[1]] = 1; }
      LADS.forEach(function (l) {
        resv(l.from, l.room, l.corner); resv(l.from + 1, l.room, l.corner);
        var lo = floors[l.from].g, hi = floors[l.from + 1].g, t = l.corner[1];
        var rails = new THREE.Mesh(railGeo, vmat); rails.position.set(l.x, 0, l.z); rails.castShadow = true; lo.add(rails);
        var hatch = new THREE.Mesh(hatchGeo, vmat); hatch.position.set(l.x, 0, l.z); hatch.rotation.y = t > 0 ? 0 : Math.PI; hi.add(hatch);
        var r1 = new THREE.Mesh(ringGeo, ringMats.up); r1.position.set(l.fx, 0.02, l.fz); lo.add(r1);
        var r2 = new THREE.Mesh(ringGeo, ringMats.down); r2.position.set(l.fx, 0.02, l.fz); hi.add(r2);
      });

      // ---- Per floor: statues (one in a building-corner room), furniture, rugs, spills, patrollers.
      var CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]], BCORN = [[0, 0], [3, 0], [0, 3], [3, 3]];
      var furn = {};
      floors.forEach(function (F, fl) {
        var FR = rng(900 + fl * 17), rooms = [], th = F.th;
        for (i = 0; i < NR; i++) for (j = 0; j < NR; j++) if (!(fl === 0 && i === START_ROOM[0] && j === START_ROOM[1])) rooms.push([i, j]);
        var free = function (rm) { return CORNERS.filter(function (cn) { return !reserved[fl + ':' + rm[0] + ',' + rm[1] + ':' + cn[0] + ',' + cn[1]]; }); };
        var pickRoom = function (list) { return list[Math.floor(FR() * list.length)]; };
        var chosen = [], used = {}, tries = 0;
        var corner = BCORN.filter(function (r) { return !(fl === 0 && r[0] === START_ROOM[0] && r[1] === START_ROOM[1]); });
        chosen.push(pickRoom(corner)); used[chosen[0]] = 1;
        while (chosen.length < perFloor[fl]) {
          var rr = pickRoom(rooms), prev = chosen[chosen.length - 1];
          if (!used[rr] && (++tries > 200 || Math.abs(rr[0] - prev[0]) + Math.abs(rr[1] - prev[1]) > 1)) { chosen.push(rr); used[rr] = 1; }
        }
        chosen.forEach(function (rm) {
          var fc = free(rm), cn = fc[Math.floor(FR() * fc.length)];
          resv(fl, rm, cn);
          statueSpots.push([rc(rm[0]) + cn[0] * 2.6, rc(rm[1]) + cn[1] * 2.6, F.g, F.boxes, fl]);
        });
        for (i = 0; i < NR; i++) for (j = 0; j < NR; j++) {
          var cx = rc(i), cz = rc(j);
          free([i, j]).forEach(function (cn) {
            if (FR() > 0.6) return;
            var name = th.furn[Math.floor(FR() * th.furn.length)], it = F_[name], t = cn[1];
            var x = cx + cn[0] * (RS / 2 - WT / 2 - it.len / 2 - 0.25), z = cz + t * (RS / 2 - WT / 2 - it.dep / 2 - 0.05);
            (furn[name + ':' + fl] = furn[name + ':' + fl] || []).push({ x: x, z: z, ry: t > 0 ? Math.PI : 0 });
            F.boxes.push([x - it.len / 2, z - it.dep / 2, x + it.len / 2, z + it.dep / 2]);
          });
          if (FR() < th.rug) {
            var rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col(RUGS[Math.floor(FR() * RUGS.length)]), roughness: 1 }));
            rug.position.set(cx, 0.012, cz); rug.receiveShadow = true; F.g.add(rug);
          }
        }
        // Wet-floor spills (with a sign); puddles on the roof.
        for (k = 0; k < cfg.spills[fl]; k++) {
          var sr = pickRoom(rooms), sx = rc(sr[0]) + (FR() - 0.5), sz = rc(sr[1]) + (FR() - 0.5);
          var sp = new THREE.Mesh(new THREE.CircleGeometry(1.25, 20).rotateX(-Math.PI / 2).scale(1, 1, 0.75), spillMat); sp.position.set(sx, 0.02, sz); F.g.add(sp);
          if (!th.low) {
            var sg = new THREE.Mesh(signGeo, vmat); sg.position.set(sx + 1.6, 0, sz - 1.2); sg.rotation.y = 0.5; sg.castShadow = true; F.g.add(sg);
            F.boxes.push([sx + 1.35, sz - 1.45, sx + 1.85, sz - 0.95]);
          }
          F.slows.push({ x: sx, z: sz, r: 1.25 });
        }
        // Patrollers walk room centre to room centre through the doors.
        cfg.pats[fl].forEach(function (type, n) {
          var m = new THREE.Mesh(PATGEO[type], vmat); m.castShadow = true; m.scale.setScalar(type === 'cat' ? 1.3 : type === 'ball' ? 1.4 : 1.1); F.g.add(m);
          var home = n === 0 ? [fl % 2 ? 1 : 2, fl < 2 ? 1 : 2] : [fl % 2 ? 2 : 1, 3];
          F.pats.push({ m: m, home: home, cur: home.slice(), prev: null, next: null, t: 0, speed: PATSPEED[type], type: type });
        });
      });
      Object.keys(furn).forEach(function (key) {
        var p = key.split(':'); floors[+p[1]].g.add(inst(F_[p[0]].geo, vmat, furn[key]));
      });
      // Design ids: the Tower uses every design once (shuffled across floors); the Mill picks at random.
      if (cfg.numbered) {
        var all = D.map(function (d, n) { return n; });
        for (k = all.length - 1; k > 0; k--) { var sw = Math.floor(Math.random() * (k + 1)), tmp = all[k]; all[k] = all[sw]; all[sw] = tmp; }
        statueSpots.forEach(function (s, n) { s[5] = all[n]; });
      }
      var statues = makeStatues(statueSpots, grp, null, R);

      function nextRoom(F, c, prev) {
        var ls = F.links(c[0], c[1]), opts = ls.filter(function (q) { return !prev || q[0] !== prev[0] || q[1] !== prev[1]; });
        if (!opts.length) opts = ls;
        return opts[Math.floor(Math.random() * opts.length)];
      }
      function resetPats() { floors.forEach(function (F) { F.pats.forEach(function (p) { p.cur = p.home.slice(); p.prev = null; p.next = nextRoom(F, p.cur, null); p.t = 0; }); }); }
      resetPats();

      // ---- Reachability check: rasterise each floor, flood-fill from the start, hop floors at ladder feet.
      if (window.WESTIE_GAME_DEBUG) (function check() { // costly raster flood-fill: test runs only
        var G = 0.5, NG = Math.round(2 * HALF / G) + 1;
        var blocked = floors.map(function (F) {
          var a = new Uint8Array(NG * NG);
          for (var gi = 0; gi < NG; gi++) for (var gj = 0; gj < NG; gj++) {
            var x = -HALF + gi * G, z = -HALF + gj * G;
            a[gi * NG + gj] = F.boxes.some(function (b) { return x > b[0] - PR && x < b[2] + PR && z > b[1] - PR && z < b[3] + PR; }) ? 1 : 0;
          }
          return a;
        });
        var seen = floors.map(function () { return new Uint8Array(NG * NG); }), q = [];
        function push(fl, x, z) {
          var gi = Math.round((x + HALF) / G), gj = Math.round((z + HALF) / G), n = gi * NG + gj;
          if (gi < 0 || gj < 0 || gi >= NG || gj >= NG || blocked[fl][n] || seen[fl][n]) return;
          seen[fl][n] = 1; q.push([fl, gi, gj]);
        }
        push(0, start[0], start[1]);
        for (var h = 0; h < q.length; h++) {
          var c = q[h], x = -HALF + c[1] * G, z = -HALF + c[2] * G;
          push(c[0], x + G, z); push(c[0], x - G, z); push(c[0], x, z + G); push(c[0], x, z - G);
          LADS.forEach(function (l) {
            if (Math.hypot(x - l.fx, z - l.fz) > 0.9) return;
            if (l.from === c[0]) push(l.from + 1, l.ax, l.az);
            if (l.from + 1 === c[0]) push(l.from, l.ax, l.az);
          });
        }
        var unreachable = statues.filter(function (s) {
          for (var gi = 0; gi < NG; gi++) for (var gj = 0; gj < NG; gj++) if (seen[s.floor][gi * NG + gj] && Math.hypot(-HALF + gi * G - s.x, -HALF + gj * G - s.z) < 2.2) return false;
          return true;
        });
        console.assert(!unreachable.length && statues.length === total, 'WestieGame: ' + cfg.title + ' has unreachable Westies on floors ' + unreachable.map(function (s) { return s.floor + 1; }).join(','));
        if (cfg.numbered) console.assert(statues.every(function (s, n) { return statues.filter(function (o) { return o.id === s.id; }).length === 1; }), 'WestieGame: duplicate design in The Tower');
      })();

      var lv = {
        key: cfg.key, title: cfg.title, numbered: cfg.numbered, group: grp, boxes: floors[0].boxes, statues: statues, start: start, cam: cfg.cam, env: cfg.env,
        floors: floors, floor: 0, y: 0, FH: FH, ladders: LADS,
        slow: function (x, z) { return floors[lv.floor].slows.some(function (s) { return Math.hypot(x - s.x, (z - s.z) / 0.75) < s.r; }); },
        setFloor: function (n, announce) {
          lv.floor = n; lv.y = n * FH; lv.boxes = floors[n].boxes;
          floors.forEach(function (F, m) { F.g.visible = m === n; });
          shell.visible = n > 0; shell.scale.y = Math.max(0.01, n * FH - 0.3); shellTex.repeat.set(10, Math.max(1, n * FH / 4));
          if (announce && floors[n].th.name) toast('Floor ' + (n + 1) + ' — ' + floors[n].th.name);
        },
        ladderAt: function (x, z, r) {
          for (var n = 0; n < LADS.length; n++) {
            var l = LADS[n];
            if ((l.from === lv.floor || l.from + 1 === lv.floor) && Math.hypot(x - l.fx, z - l.fz) < r) {
              var up = l.from === lv.floor;
              return { up: up, to: up ? l.from + 1 : l.from, fx: l.x, fz: l.z - l.corner[1] * 0.35, ax: l.ax, az: l.az, face: l.face };
            }
          }
          return null;
        },
        nav: function (x, z) { // nearest Westie is on another floor: point at a ladder towards it
          var left = statues.filter(function (s) { return !s.found; });
          if (!left.length) return null;
          var tf = left.reduce(function (a, s) { return Math.abs(s.floor - lv.floor) < Math.abs(a - lv.floor) ? s.floor : a; }, left[0].floor), up = tf > lv.floor, bestL = null, bd = 1e9;
          LADS.forEach(function (l) {
            if ((up && l.from === lv.floor) || (!up && l.from + 1 === lv.floor)) { var d = Math.hypot(x - l.fx, z - l.fz); if (d < bd) { bd = d; bestL = l; } }
          });
          return bestL && { x: bestL.fx, z: bestL.fz, up: up };
        },
        tick: function (dt) {
          var F = floors[lv.floor];
          // Cutaway: walls between the camera (south) and the dog drop to knee height.
          F.walls.forEach(function (w) {
            var want = !w.fixed && w.cz > pz + 0.8 && w.cz < pz + 16 && Math.abs(w.cx - px) < 7 + w.hx ? 0.22 : 1;
            if (Math.abs(w.cur - want) < 0.01) return;
            w.cur += (want - w.cur) * Math.min(1, dt * 10);
            w.m.scale.y = w.full * w.cur;
          });
          // Only the floor you are on (and the one you are climbing to) moves its patrollers.
          [lv.floor, climb && climb.to !== lv.floor ? climb.to : -1].forEach(function (fl) {
            if (fl < 0) return;
            floors[fl].pats.forEach(function (p) {
              var FF = floors[fl];
              p.t += p.speed * dt / RS;
              if (p.t >= 1) { p.t -= 1; p.prev = p.cur; p.cur = p.next; p.next = nextRoom(FF, p.cur, p.prev); }
              var x = rc(p.cur[0]) + (rc(p.next[0]) - rc(p.cur[0])) * p.t, z = rc(p.cur[1]) + (rc(p.next[1]) - rc(p.cur[1])) * p.t;
              var dx = p.next[0] - p.cur[0], dz = p.next[1] - p.cur[1];
              if (p.type === 'ball') { p.m.position.set(x, 0.7, z); p.m.rotation.x += dz * p.speed * dt / 0.7; p.m.rotation.z -= dx * p.speed * dt / 0.7; }
              else {
                p.m.position.set(x, p.type === 'cat' ? Math.abs(Math.sin(T * 8)) * 0.05 : 0, z);
                p.m.rotation.y = lerpAngle(p.m.rotation.y, Math.atan2(-dz, dx), Math.min(1, dt * 8));
              }
              if (fl === lv.floor && !climb && inv <= 0 && state === 'play' && Math.hypot(px - x, pz - z) < (p.type === 'ball' ? 0.75 : 0.6) + PR) hurt(px - x, pz - z);
            });
          });
          ringMats.up.opacity = ringMats.down.opacity = 0.55 + 0.3 * Math.sin(T * 4);
        },
        reset: function () { lv.setFloor(0); resetPats(); floors.forEach(function (F) { F.walls.forEach(function (w) { w.cur = 1; w.m.scale.y = w.full; }); }); },
        exit: null
      };
      lv.setFloor(0);
      return lv;
    }

    // ---- Debug-only reachability check for open levels: rasterise the colliders (grown by the dog's radius),
    // flood-fill from the start, and assert every target (Westie, exit) has a reachable cell within collect range.
    function reachCheck(title, boxes, start, pts, x0, z0, x1, z1) {
      var G = 0.5, NX = Math.ceil((x1 - x0) / G) + 1, NZ = Math.ceil((z1 - z0) / G) + 1, blk = new Uint8Array(NX * NZ), seen = new Uint8Array(NX * NZ), q = [];
      boxes.forEach(function (b) {
        var i0 = Math.max(0, Math.ceil((b[0] - PR - x0) / G)), i1 = Math.min(NX - 1, Math.floor((b[2] + PR - x0) / G));
        var j0 = Math.max(0, Math.ceil((b[1] - PR - z0) / G)), j1 = Math.min(NZ - 1, Math.floor((b[3] + PR - z0) / G));
        for (var i = i0; i <= i1; i++) for (var j = j0; j <= j1; j++) blk[i * NZ + j] = 1;
      });
      function push(i, j) { if (i < 0 || j < 0 || i >= NX || j >= NZ) return; var n = i * NZ + j; if (blk[n] || seen[n]) return; seen[n] = 1; q.push(n); }
      push(Math.round((start[0] - x0) / G), Math.round((start[1] - z0) / G));
      for (var h = 0; h < q.length; h++) { var ci = Math.floor(q[h] / NZ), cj = q[h] % NZ; push(ci + 1, cj); push(ci - 1, cj); push(ci, cj + 1); push(ci, cj - 1); }
      var bad = pts.filter(function (p) {
        for (var i = Math.max(0, Math.floor((p[0] - 2.2 - x0) / G)); i <= Math.min(NX - 1, Math.ceil((p[0] + 2.2 - x0) / G)); i++)
          for (var j = Math.max(0, Math.floor((p[1] - 2.2 - z0) / G)); j <= Math.min(NZ - 1, Math.ceil((p[1] + 2.2 - z0) / G)); j++)
            if (seen[i * NZ + j] && Math.hypot(x0 + i * G - p[0], z0 + j * G - p[1]) < 2.2) return false;
        return true;
      });
      console.assert(!bad.length && seen.some(function (v) { return v; }), 'WestieGame: ' + title + ' has unreachable targets ' + JSON.stringify(bad));
      return bad;
    }
    // Paint a ground canvas over [x0,x1]x[z0,z1]: paint(rect, dot, K, ctx).
    function groundPlane(x0, z0, x1, z1, N, paint) {
      var w = x1 - x0, h = z1 - z0, cv = document.createElement('canvas'); cv.width = N; cv.height = Math.round(N * h / w);
      var K = N / w, c = cv.getContext('2d');
      function rect(a0, b0, a1, b1, col0) { c.fillStyle = col0; c.fillRect((a0 - x0) * K, (b0 - z0) * K, (a1 - a0) * K, (b1 - b0) * K); }
      function dot(a, b, r, col0) { c.fillStyle = col0; c.beginPath(); c.arc((a - x0) * K, (b - z0) * K, r * K, 0, 7); c.fill(); }
      paint(rect, dot, K, c, function (a, b) { return [(a - x0) * K, (b - z0) * K]; });
      var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = ANISO;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
      m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); m.receiveShadow = true;
      return m;
    }
    function speckle(c, n, cols, size) { var W = c.canvas.width, Hh = c.canvas.height; for (var i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(Math.random() * W, Math.random() * Hh, size || 2, size || 2); } }

    // ================= Level 5: Ayr Beach at low tide =================
    // The tide line sweeps in and out: shallow water slows and pushes you back, deep water costs a heart.
    // Four Westies sit on the tidal flats, so you have to time them for low water.
    function buildBeach() {
      var R = rng(55), grp = new THREE.Group(), boxes = [], k;
      var TIDE = function () { return -29 + 11 * Math.sin(time * Math.PI * 2 / 40); }; // water edge x (-40 low .. -18 high)
      function solid(x, z, hw, hd) { boxes.push([x - hw, z - hd, x + hw, z + hd]); }
      grp.add(groundPlane(-70, -40, 46, 40, 1024, function (rect, dot, K, c) {
        rect(-70, -40, 30, 40, '#d9b977'); speckle(c, 14000, ['rgba(150,110,50,.18)', 'rgba(255,255,255,.3)', 'rgba(120,90,40,.12)']);
        rect(-70, -40, -36, 40, '#c7a86a'); // flats exposed at low tide
        for (var r = 0; r < 60; r++) { c.strokeStyle = 'rgba(120,95,55,.25)'; c.lineWidth = 2; c.beginPath(); var y = Math.random() * c.canvas.height; c.moveTo(0, y); c.bezierCurveTo(200, y - 20, 300, y + 20, (-36 + 70) * K, y); c.stroke(); } // ripples
        rect(30, -40, 46, 40, '#a9a294');
        for (var t = -40; t < 40; t += 1.5) rect(30, t, 46, t + 0.06, 'rgba(90,80,70,.25)');
        rect(29.4, -40, 30.6, 40, '#a39a8a');
        [[-12, -24, 1.8], [-6, 16, 2.2], [8, -6, 1.5]].forEach(function (p) { dot(p[0], p[1], p[2], '#4c9cc4'); });
      }));
      // Sea: deep water, shallow band, foam and wet sand all follow the tide edge.
      var deep = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col('#1f6fa8'), roughness: 0.25, metalness: 0.15 }));
      var shallow = new THREE.Mesh(new THREE.PlaneGeometry(5, 120).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col('#62b6db'), roughness: 0.15, transparent: true, opacity: 0.8 }));
      var foam = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 120).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
      var wet = new THREE.Mesh(new THREE.PlaneGeometry(5, 120).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col('#8a7046'), transparent: true, opacity: 0.45, roughness: 0.3 }));
      deep.position.y = 0.05; shallow.position.y = 0.06; foam.position.y = 0.07; wet.position.y = 0.02; grp.add(deep, shallow, foam, wet);
      // Arran on the horizon.
      var arran = new THREE.Mesh(merge([P(new THREE.ConeGeometry(30, 22, 7), '#6d78a8', 0, 11, 0, null, [1, 1, 0.6]), P(new THREE.ConeGeometry(24, 17, 6), '#7a85b3', 0, 8, 34, null, [1, 1, 0.6]), P(new THREE.ConeGeometry(36, 13, 7), '#646fa0', 0, 6, -40, null, [1, 1, 0.6]), P(new THREE.ConeGeometry(18, 9, 6), '#8590bd', 0, 4, 70)]), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
      arran.position.set(-190, 0, -10); grp.add(arran);
      // Promenade: sea wall with steps, beach huts.
      var wallSegs = [[-34, -21], [-17, -1], [3, 21], [25, 34]];
      var wallItems = wallSegs.map(function (w) { solid(30, (w[0] + w[1]) / 2, 0.4, (w[1] - w[0]) / 2); return { x: 30, z: (w[0] + w[1]) / 2, sx: 0.8, sy: 0.9, sz: w[1] - w[0], c: '#b9b0a0' }; });
      grp.add(inst(box(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), wallItems));
      var huts = [-30, -26, -22, -17, -3, 1, 5, 17, 21].map(function (z, i) { solid(39.5, z, 0.85, 0.85); return { x: 39.5, z: z, ry: Math.PI / 2, c: ['#e63946', '#f4a261', '#2a9d8f', '#ffd166', '#118ab2', '#ef476f', '#06d6a0', '#8338ec', '#ff8fab'][i] }; });
      grp.add(inst(merge([P(box(1.6, 1.8, 1.6), '#ffffff', 0, 0.9, 0), P(new THREE.ConeGeometry(1.35, 0.8, 4), '#f4f1ea', 0, 2.2, 0, [0, Math.PI / 4, 0]), P(box(0.7, 1.2, 0.05), '#5a4636', 0, 0.6, 0.81), P(box(1.62, 0.25, 1.62), '#ffffff', 0, 0.12, 0)]), vmat, huts));
      // Groynes: timber breakwaters across the beach with gaps to pass.
      var posts = [];
      [-14, 8, 26].forEach(function (z) {
        [[-44, -24], [-20, -4], [0, 8]].forEach(function (seg) {
          solid((seg[0] + seg[1]) / 2, z, (seg[1] - seg[0]) / 2, 0.3);
          for (var x = seg[0]; x <= seg[1]; x += 0.9) posts.push({ x: x, z: z, s: 1, ry: R(), c: '#ffffff' });
        });
      });
      grp.add(inst(merge([P(cyl(0.22, 0.25, 1.2, 6), '#5b4632', 0, 0.6, 0), P(cyl(0.23, 0.23, 0.15, 6), '#3e5a3a', 0, 0.15, 0)]), vmat, posts));
      // Rocks on the flats.
      var rocks = [];
      [[-30, -16, 1.4], [-24, 3, 1.1], [-38, 18, 1.6], [-42, -30, 1.3], [-20, 22, 0.9], [-34, 6, 1.0]].forEach(function (r) { solid(r[0], r[1], r[2] * 0.8, r[2] * 0.8); rocks.push({ x: r[0], z: r[1], s: r[2], ry: R() * 6, c: '#ffffff' }); });
      grp.add(inst(new THREE.IcosahedronGeometry(1, 0).translate(0, 0.45, 0).scale(1, 0.7, 1), new THREE.MeshStandardMaterial({ color: col('#7a7c80'), roughness: 0.95, flatShading: true }), rocks));
      var shells = []; for (k = 0; k < 120; k++) shells.push({ x: -40 + R() * 68, y: 0.03, z: -33 + R() * 66, s: 0.6 + R() * 0.6, ry: R() * 6, c: ['#ffffff', '#ffd6c9', '#f2e1b8'][k % 3] });
      var shellMesh = inst(new THREE.ConeGeometry(0.12, 0.08, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 0.6 }), shells); grp.add(shellMesh);
      // Crabs scuttle sideways about the dry sand.
      var crabGeo = merge([P(ball(1, 10, 6), '#d9480f', 0, 0.2, 0, null, [0.3, 0.13, 0.22]), P(ball(0.09), '#d9480f', 0.15, 0.25, 0.32), P(ball(0.09), '#d9480f', 0.15, 0.25, -0.32), P(ball(0.04), '#111111', 0.26, 0.34, 0.07), P(ball(0.04), '#111111', 0.26, 0.34, -0.07),
        P(box(0.04, 0.2, 0.5), '#b83c0c', 0, 0.1, 0, [0.6, 0, 0]), P(box(0.04, 0.2, 0.5), '#b83c0c', 0, 0.1, 0, [-0.6, 0, 0])]);
      var crabs = [[-10, -20], [5, 0], [16, -28], [-4, 24], [20, 14]].map(function (c, n) {
        var m = new THREE.Mesh(crabGeo, vmat); m.castShadow = true; m.scale.setScalar(1.3); grp.add(m);
        return { m: m, x: c[0], z: c[1], ox: c[0], oz: c[1], tx: c[0], tz: c[1], ph: n };
      });
      boxes.push([46, -400, 400, 400], [-400, -400, 400, -34], [-400, 34, 400, 400], [-400, -400, -60, 400]);
      var spots = [[-32, -24], [-37, -4], [-30, 16], [-38, 30], [-10, -30], [4, 20], [14, -20], [18, 2], [35, -8], [35, 12]];
      var statues = makeStatues(spots, grp, boxes, R);
      var start = [35, 30];
      if (window.WESTIE_GAME_DEBUG) reachCheck('Ayr Beach', boxes, start, spots, -60, -34, 46, 34);
      var xw = TIDE();
      function tick(dt) {
        xw = TIDE();
        deep.position.x = xw - 5 - 200; shallow.position.x = xw - 2.5; foam.position.x = xw + Math.sin(T * 2) * 0.25; wet.position.x = xw + 2.5;
        if (state === 'play') {
          if (px < xw - 5) { if (inv <= 0) hurt(1, 0); kx = Math.max(kx, 10); } // deep: a heart and a shove back to the beach
          else if (px < xw) kx += 12 * dt; // shallow water pushes you up the beach
        }
        crabs.forEach(function (c) {
          if (Math.hypot(c.tx - c.x, c.tz - c.z) < 0.3) { c.tx = Math.max(-18, Math.min(26, c.ox + (Math.random() - 0.5) * 16)); c.tz = Math.max(-32, Math.min(32, c.oz + (Math.random() - 0.5) * 10)); }
          var dx = c.tx - c.x, dz = c.tz - c.z, l = Math.hypot(dx, dz) || 1, st = Math.min(l, 1.8 * dt);
          var q = collide(c.x + dx / l * st, c.z + dz / l * st, 0.5, boxes);
          if (Math.hypot(q[0] - c.x, q[1] - c.z) < st * 0.5) { c.tx = q[0]; c.tz = q[1]; } // blocked by a groyne, rock or plinth: pick a new spot next frame
          c.x = q[0]; c.z = q[1];
          c.m.position.set(c.x, Math.abs(Math.sin(T * 14 + c.ph)) * 0.04, c.z); c.m.rotation.y = Math.atan2(-dz, dx) + Math.PI / 2; // sideways
          if (inv <= 0 && state === 'play' && Math.hypot(px - c.x, pz - c.z) < 0.5 + PR) hurt(px - c.x, pz - c.z);
        });
      }
      return {
        key: 'beach', title: 'Ayr Beach', group: grp, boxes: boxes, statues: statues, start: start, cam: { h: 10, b: 10 },
        env: { top: '#3f97e0', sky: 0xd6ecfa, near: 90, far: 320, hemi: 0.5, hemiSky: 0xe8f4ff, ground: 0xb8a070, sun: 0.85, sunCol: 0xfff0d0, exposure: 0.85 },
        slow: function (x, z) { return x < xw + 5 || [[-12, -24, 1.8], [-6, 16, 2.2], [8, -6, 1.5]].some(function (p) { return Math.hypot(x - p[0], z - p[1]) < p[2]; }); },
        tick: tick, exit: null,
        reset: function () { crabs.forEach(function (c) { c.x = c.tx = c.ox; c.z = c.tz = c.oz; }); }
      };
    }

    // ================= Level 8: Ayr Racecourse =================
    // An oval of turf inside white rails; cross only at the gates. Horses gallop laps in four lanes.
    function buildRacecourse() {
      var R = rng(88), grp = new THREE.Group(), boxes = [], k, HW = 5, SL = 26, RAD = 18, PER = 4 * SL + 2 * Math.PI * RAD;
      function cl(s) { // centreline point, unit direction and outward normal at distance s
        s = ((s % PER) + PER) % PER;
        var a, L1 = 2 * SL, L2 = Math.PI * RAD;
        if (s < L1) return { x: -SL + s, z: RAD, dx: 1, dz: 0 };
        s -= L1; if (s < L2) { a = Math.PI / 2 - s / RAD; return { x: SL + RAD * Math.cos(a), z: RAD * Math.sin(a), dx: Math.sin(a), dz: -Math.cos(a) }; }
        s -= L2; if (s < L1) return { x: SL - s, z: -RAD, dx: -1, dz: 0 };
        s -= L1; a = -Math.PI / 2 - s / RAD; return { x: -SL + RAD * Math.cos(a), z: RAD * Math.sin(a), dx: Math.sin(a), dz: -Math.cos(a) };
      }
      function at(s, d) { var p = cl(s); return [p.x - p.dz * d, p.z + p.dx * d]; } // d > 0 is outward
      var GATES = [0.13, 0.4, 0.62, 0.9].map(function (f) { return f * PER; });
      grp.add(groundPlane(-64, -44, 64, 44, 1024, function (rect, dot, K, c, map) {
        rect(-64, -44, 64, 44, '#7cb35a'); speckle(c, 9000, ['rgba(40,90,20,.2)', 'rgba(190,230,120,.2)']);
        c.lineJoin = 'round';
        [[HW * 2 + 0.6, '#ffffff'], [HW * 2, '#5f9e43']].forEach(function (pass) {
          c.strokeStyle = pass[1]; c.lineWidth = pass[0] * K; c.beginPath();
          for (var s = 0; s <= PER; s += 1) { var p = map.apply(null, at(s, 0)); if (s) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
          c.closePath(); c.stroke();
        });
        c.lineWidth = 1.2 * K; c.strokeStyle = 'rgba(255,255,255,.12)'; // mowing stripes
        [-3, 0, 3].forEach(function (d) { c.beginPath(); for (var s = 0; s <= PER; s += 1) { var p = map.apply(null, at(s, d)); if (s) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); } c.closePath(); c.stroke(); });
        dot(0, 0, 6, '#4c9cc4'); // infield pond
        rect(-24, -40, 24, -26, '#b9b2a5');
      }));
      // Rails: posts + a top rail, with gaps at the crossing gates; one collider per rail segment.
      var railItems = [], postItems = [], gatePosts = [];
      [-HW, HW].forEach(function (d) {
        for (var s = 0; s < PER; s += 1.6) {
          var mid = s + 0.8, gate = GATES.some(function (g) { var dd = Math.abs(mid - g); return Math.min(dd, PER - dd) < 2.2; });
          var a = at(s, d), b = at(s + 1.6, d);
          if (gate) { gatePosts.push({ x: a[0], z: a[1], c: '#e63946' }); continue; }
          var len = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
          railItems.push({ x: (a[0] + b[0]) / 2, y: 0.95, z: (a[1] + b[1]) / 2, sx: len + 0.05, sy: 0.12, sz: 0.12, ry: ry });
          postItems.push({ x: a[0], z: a[1] });
          boxes.push([Math.min(a[0], b[0]) - 0.15, Math.min(a[1], b[1]) - 0.15, Math.max(a[0], b[0]) + 0.15, Math.max(a[1], b[1]) + 0.15]);
        }
      });
      grp.add(inst(box(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 }), railItems));
      grp.add(inst(cyl(0.07, 0.07, 1.0, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: col('#f4f4f4'), roughness: 0.6 }), postItems));
      var gp = inst(cyl(0.12, 0.12, 1.5, 8).translate(0, 0.75, 0), new THREE.MeshStandardMaterial({ roughness: 0.6 }), gatePosts); grp.add(gp);
      // Grandstand with a crowd, winning post, hedges and the pond in the infield.
      var stand = new THREE.Mesh(merge([P(box(46, 1, 10), '#8a8f98', 0, 0.5, 0), P(box(46, 1, 7), '#9aa0a8', 0, 1.5, 1.5), P(box(46, 1, 4), '#aab0b8', 0, 2.5, 3), P(box(48, 0.3, 11), '#2f3640', 0, 6, 0.5), P(box(0.4, 6, 0.4), '#2f3640', -22, 3, -4.5), P(box(0.4, 6, 0.4), '#2f3640', 22, 3, -4.5), P(box(48, 2.4, 0.5), '#1f3b73', 0, 4.2, 5.3)]), vmat);
      stand.position.set(0, 0, -31.5); stand.rotation.y = Math.PI; stand.castShadow = true; grp.add(stand); boxes.push([-23, -37, 23, -26.5]);
      var crowd = []; for (k = 0; k < 160; k++) { var row = k % 3; crowd.push({ x: -22 + R() * 44, y: 1 + row, z: -28 - row * 1.5 - R() * 0.6, s: 1, c: ['#e63946', '#ffd166', '#118ab2', '#ffffff', '#2a9d8f', '#ef476f'][k % 6] }); }
      grp.add(inst(merge([P(box(0.35, 0.6, 0.3), '#ffffff', 0, 0.3, 0), P(ball(0.13), '#f1c27d', 0, 0.75, 0)]), vmat, crowd));
      var post = new THREE.Mesh(merge([P(cyl(0.12, 0.12, 3, 8), '#ffffff', 0, 1.5, 0), P(cyl(0.5, 0.5, 0.1, 16), '#e63946', 0, 3.1, 0, [Math.PI / 2, 0, 0])]), vmat);
      var wp = at(0.25 * PER, -HW - 1.2); post.position.set(wp[0], 0, wp[1]); grp.add(post);
      boxes.push([-5.5, -5.5, 5.5, 5.5]); // pond
      var hedges = [[-14, -6, 6, 1], [14, 6, 6, 1], [-16, 8, 1, 5], [16, -8, 1, 5]];
      hedges.forEach(function (hh) { boxes.push([hh[0] - hh[2] / 2, hh[1] - hh[3] / 2, hh[0] + hh[2] / 2, hh[1] + hh[3] / 2]); });
      grp.add(inst(box(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: col('#3f7a32'), roughness: 1 }), hedges.map(function (hh) { return { x: hh[0], z: hh[1], sx: hh[2], sy: 1.2, sz: hh[3] }; })));
      var trees = []; for (k = 0; k < 40; k++) { var ta = k / 40 * Math.PI * 2; trees.push({ x: Math.cos(ta) * 60, z: Math.sin(ta) * 40, s: 1 + R() * 0.4, ry: R() * 6, c: '#ffffff' }); }
      grp.add(inst(merge([P(cyl(0.15, 0.22, 1.4, 6), '#6b4a2f', 0, 0.7, 0), P(new THREE.IcosahedronGeometry(1.4, 0), '#4f8f3a', 0, 2.3, 0)]), vmat, trees));
      // Horses: four lanes, different speeds, anticlockwise laps.
      var horses = [['#5d4037', '#e63946', -3, 12.5], ['#3e2723', '#ffd166', -1, 13.5], ['#8d6e63', '#118ab2', 1, 11.5], ['#212121', '#06d6a0', 3, 14.5]].map(function (h, n) {
        var g = merge([P(ball(1, 10, 8), h[0], 0, 1.3, 0, null, [0.95, 0.42, 0.36]), P(box(0.35, 0.9, 0.3), h[0], 0.85, 1.75, 0, [0, 0, -0.6]), P(box(0.6, 0.28, 0.26), h[0], 1.25, 2.1, 0, [0, 0, -0.2]),
          P(box(0.14, 1.1, 0.14), h[0], 0.6, 0.55, 0.2), P(box(0.14, 1.1, 0.14), h[0], 0.6, 0.55, -0.2), P(box(0.14, 1.1, 0.14), h[0], -0.6, 0.55, 0.2), P(box(0.14, 1.1, 0.14), h[0], -0.6, 0.55, -0.2),
          P(box(0.6, 0.12, 0.08), '#1a1a1a', -1.0, 1.4, 0, [0, 0, 0.8]), P(box(0.35, 0.5, 0.35), h[1], 0.1, 2.0, 0), P(ball(0.15), '#f1c27d', 0.15, 2.4, 0), P(ball(0.16), h[1], 0.15, 2.48, 0)]);
        var m = new THREE.Mesh(g, vmat); m.castShadow = true; grp.add(m);
        return { m: m, s: n * PER / 4 + 20, d: h[2], speed: h[3], ph: n };
      });
      boxes.push([56, -400, 400, 400], [-400, -400, -56, 400], [-400, -400, 400, -38], [-400, 36, 400, 400]);
      var sp = [at(0.3 * PER, 0), at(0.55 * PER, 1.5), at(0.8 * PER, -1.5), [-10, 2], [12, -2], [0, 10], [-40, -26], [48, 22]];
      var statues = makeStatues(sp, grp, boxes, R, function (n) { return n > 2; }); // plinths on the track itself are walk-through
      var start = [0, 28];
      if (window.WESTIE_GAME_DEBUG) reachCheck('Ayr Racecourse', boxes, start, sp, -56, -38, 56, 36);
      function tick(dt) {
        horses.forEach(function (h) {
          h.s += h.speed * dt;
          var p = cl(h.s), x = p.x - p.dz * h.d, z = p.z + p.dx * h.d;
          h.m.position.set(x, Math.abs(Math.sin(T * 10 + h.ph)) * 0.25, z); h.m.rotation.y = Math.atan2(-p.dz, p.dx); h.m.rotation.z = Math.sin(T * 10 + h.ph) * 0.06;
          if (inv > 0 || state !== 'play') return;
          var rx = px - x, rz = pz - z;
          if (Math.abs(rx * p.dx + rz * p.dz) < 1.3 + PR && Math.abs(rx * p.dz - rz * p.dx) < 0.45 + PR) hurt(rx, rz);
        });
      }
      return {
        key: 'racecourse', title: 'Ayr Racecourse', group: grp, boxes: boxes, statues: statues, start: start, cam: { h: 11, b: 10 },
        env: { top: '#4a9be0', sky: 0xd4eafa, near: 70, far: 170, hemi: 0.62, hemiSky: 0xe0f0ff, ground: 0x6f8f4a, sun: 1.0, sunCol: 0xfff0d0 },
        slow: function () { return false; }, tick: tick, exit: null,
        reset: function () { horses.forEach(function (h, n) { h.s = n * PER / 4 + 20; }); }
      };
    }

    // ================= Level 9: Harbour at night =================
    // Dark quayside; the dog carries a torch (one spotlight), the lighthouse beam sweeps and flashes Westies it crosses.
    function buildHarbour() {
      var R = rng(99), grp = new THREE.Group(), boxes = [], k;
      function solid(x, z, hw, hd) { boxes.push([x - hw, z - hd, x + hw, z + hd]); }
      grp.add(groundPlane(-40, -44, 40, 30, 1024, function (rect, dot, K, c) {
        rect(-40, -44, 40, 30, '#14253d');
        rect(-30, -16, 40, 30, '#5d6168'); speckle(c, 12000, ['rgba(0,0,0,.18)', 'rgba(255,255,255,.06)']);
        for (var x = -30; x < 40; x += 2.4) rect(x, -16, x + 0.08, 30, 'rgba(0,0,0,.18)');
        for (var z = -16; z < 30; z += 1.2) rect(-30, z, 40, z + 0.06, 'rgba(0,0,0,.14)');
        rect(4, -42, 10, -16, '#676b72'); rect(-30, -16.6, 40, -15.9, '#d9c56a'); rect(4, -42, 4.5, -16, '#d9c56a'); rect(9.5, -42, 10, -16, '#d9c56a');
        [[-18, -6], [6, 8], [22, -4], [-8, 18], [28, 14]].forEach(function (p) { dot(p[0], p[1], 1.6, 'rgba(40,60,90,.55)'); });
      }));
      var sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col('#0e1c30'), roughness: 0.2, metalness: 0.4 }));
      sea.position.set(0, -0.3, -100); grp.add(sea);
      boxes.push([-400, -400, 4, -16], [10, -400, 400, -16], [-400, -400, -30, 400], [4, -400, 10, -42], [34, -400, 400, 400], [-400, 26, 400, 400]);
      // Warehouses (south), central crate block, crate stacks, bollards.
      var sheds = [[-22, 22, 16, 7, '#4a5560'], [4, 22, 16, 7, '#5b4a44'], [26, 22, 14, 7, '#3f4a3c']];
      sheds.forEach(function (w) { solid(w[0], w[1], w[2] / 2, w[3] / 2); });
      grp.add(inst(merge([P(box(1, 1, 1), '#ffffff', 0, 0.5, 0), P(box(1.02, 0.08, 1.02), '#2a2a2a', 0, 1.0, 0)]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), sheds.map(function (w) { return { x: w[0], z: w[1], sx: w[2], sy: 2.6, sz: w[3], c: w[4] }; })));
      var crates = [], CC = ['#8a5a35', '#2e86c1', '#c0392b', '#27ae60', '#d4a017'];
      function stack(x, z, w, d) { solid(x, z, w / 2, d / 2); for (var i = 0; i < w; i += 1.2) for (var j = 0; j < d; j += 1.2) { var hgt = 1 + Math.floor(R() * 3); for (var y = 0; y < hgt; y++) crates.push({ x: x - w / 2 + 0.6 + i, y: y * 1.15, z: z - d / 2 + 0.6 + j, s: 1, ry: (R() - 0.5) * 0.2, c: CC[Math.floor(R() * CC.length)] }); } }
      stack(0, 0, 12, 4.8); stack(-20, 6, 3.6, 3.6); stack(20, 6, 3.6, 2.4); stack(-14, -10, 2.4, 2.4); stack(16, -9, 3.6, 2.4); stack(28, 2, 2.4, 3.6);
      grp.add(inst(merge([P(box(1.1, 1.1, 1.1), '#ffffff', 0, 0.55, 0), P(box(1.12, 0.1, 1.12), '#333333', 0, 0.55, 0), P(box(0.1, 1.12, 1.12), '#333333', 0, 0.55, 0)]), vmat, crates));
      var bollards = []; for (var bx = -26; bx < 34; bx += 6) { if (bx > 2 && bx < 12) continue; bollards.push({ x: bx, z: -15.2 }); solid(bx, -15.2, 0.3, 0.3); }
      grp.add(inst(merge([P(cyl(0.25, 0.3, 0.6, 10), '#222222', 0, 0.3, 0), P(cyl(0.35, 0.35, 0.12, 10), '#222222', 0, 0.62, 0)]), vmat, bollards));
      // Moored boats, ropes to the bollards.
      ['#c1121f', '#1d70b8', '#f4a300', '#2a9d8f'].forEach(function (c, i) {
        var m = new THREE.Mesh(merge([P(box(5, 1.1, 2), c, 0, 0, 0), P(box(5.05, 0.15, 2.05), '#eeeeee', 0, 0.55, 0), P(box(1.6, 1.2, 1.4), '#dddddd', -0.8, 1.2, 0), P(cyl(0.06, 0.06, 4, 6), '#999999', 1, 2.2, 0)]), vmat);
        m.position.set(-22 + i * 14 + (i > 1 ? 6 : 0), 0, -19.5); m.castShadow = true; grp.add(m); m.userData.ph = i;
        var rope = new THREE.Mesh(cyl(0.03, 0.03, 4.5, 4), new THREE.MeshStandardMaterial({ color: col('#c8b78a') })); rope.position.set(m.position.x + 1.5, 0.5, -17.3); rope.rotation.x = Math.PI / 2 - 0.25; grp.add(rope);
        grp.userData.boats = (grp.userData.boats || []).concat(m);
      });
      // Lighthouse at the end of the pier with a sweeping beam.
      var lh = new THREE.Group(); lh.position.set(7, 0, -38.5);
      lh.add(new THREE.Mesh(merge([P(cyl(1.3, 1.6, 3, 16), '#f4f4f4', 0, 1.5, 0), P(cyl(1.15, 1.3, 3, 16), '#c1121f', 0, 4.5, 0), P(cyl(1.0, 1.15, 3, 16), '#f4f4f4', 0, 7.5, 0), P(cyl(1.3, 1.3, 0.2, 16), '#333333', 0, 9.1, 0), P(new THREE.ConeGeometry(1.1, 1.2, 16), '#333333', 0, 10.8, 0)]), vmat));
      var lamp = new THREE.Mesh(cyl(0.8, 0.8, 1.4, 12), new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false })); lamp.position.y = 9.9; lh.add(lamp);
      var pivot = new THREE.Group(); pivot.position.y = 9.9; lh.add(pivot);
      var beamMatL = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      var beamL = new THREE.Mesh(new THREE.ConeGeometry(4, 46, 16, 1, true).rotateZ(-Math.PI / 2).translate(-23, 0, 0).rotateZ(0.18), beamMatL); pivot.add(beamL); // tip at the lamp, pointing along -x
      grp.add(lh); solid(7, -38.5, 1.7, 1.7);
      // Street lamps (emissive heads only, no extra lights).
      var lampItems = [[-24, 12], [-6, 12], [14, 12], [30, -6], [-24, -12], [24, -12]].map(function (p) { solid(p[0], p[1], 0.15, 0.15); return { x: p[0], z: p[1] }; });
      grp.add(inst(merge([P(cyl(0.08, 0.1, 3.4, 6), '#2f3640', 0, 1.7, 0)]), vmat, lampItems));
      grp.add(inst(new THREE.SphereGeometry(0.28, 10, 8).translate(0, 3.5, 0), new THREE.MeshBasicMaterial({ color: 0xffd98a, toneMapped: false }), lampItems));
      // Wet, slippery patches.
      var wetp = [[-18, -6, 1.8], [6, 8, 1.8], [22, -4, 1.8], [-8, 18, 1.8], [28, 14, 1.8]];
      // Torch: one spotlight from the dog's head, no shadows.
      var torch = new THREE.SpotLight(0xfff2d0, 2.4, 22, 0.6, 0.55, 1.2), torchT = new THREE.Object3D(); torch.target = torchT; grp.add(torch, torchT);
      // Forklift on a loop round the central crate block.
      var lift = new THREE.Mesh(merge([P(box(2.2, 0.8, 1.4), '#f2c418', 0, 0.6, 0), P(box(0.9, 1.3, 1.2), '#333333', -0.3, 1.5, 0), P(box(0.1, 2.2, 1.0), '#555555', 1.1, 1.1, 0), P(box(1.0, 0.08, 0.2), '#888888', 1.6, 0.3, 0.3), P(box(1.0, 0.08, 0.2), '#888888', 1.6, 0.3, -0.3),
        P(cyl(0.3, 0.3, 0.25, 10), '#111111', 0.6, 0.3, 0.75, [Math.PI / 2, 0, 0]), P(cyl(0.3, 0.3, 0.25, 10), '#111111', -0.6, 0.3, 0.75, [Math.PI / 2, 0, 0]), P(cyl(0.3, 0.3, 0.25, 10), '#111111', 0.6, 0.3, -0.75, [Math.PI / 2, 0, 0]), P(cyl(0.3, 0.3, 0.25, 10), '#111111', -0.6, 0.3, -0.75, [Math.PI / 2, 0, 0]),
        P(box(0.2, 0.2, 0.2), '#ff8c00', -0.3, 2.25, 0)]), vmat);
      lift.castShadow = true; grp.add(lift);
      var LP = [[-10, -5], [10, -5], [10, 5], [-10, 5]], LPER = 60, ls = 0;
      function liftAt(s) { s = ((s % LPER) + LPER) % LPER; for (var i = 0; i < 4; i++) { var a = LP[i], b = LP[(i + 1) % 4], len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); if (s <= len) { var t = s / len; return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: Math.sign(b[0] - a[0]), dz: Math.sign(b[1] - a[1]) }; } s -= len; } return { x: -10, z: -5, dx: 1, dz: 0 }; }
      var sp = [[-26, -12], [-12, 12], [-4, -10], [14, 12], [29, -10], [7, -30], [-26, 14], [28, 17]];
      var statues = makeStatues(sp, grp, boxes, R);
      var start = [0, 14.5];
      if (window.WESTIE_GAME_DEBUG) reachCheck('Harbour at Night', boxes, start, sp, -30, -42, 34, 26);
      function tick(dt) {
        var hd = player.rotation.y; torch.position.set(px - Math.cos(hd) * 0.3, 3.2, pz + Math.sin(hd) * 0.3); torchT.position.set(px + Math.cos(hd) * 5, 0, pz - Math.sin(hd) * 5);
        pivot.rotation.y = T * 0.7;
        var ba = pivot.rotation.y; // beam points along -x of the pivot: world direction (-cos, sin)
        statues.forEach(function (st) {
          var a = Math.atan2(-(st.z - lh.position.z), st.x - lh.position.x), b = Math.atan2(-Math.sin(ba), -Math.cos(ba)), dd = Math.abs(lerpAngle(0, a - b, 1));
          st.flash = dd < 0.14 ? 0.9 : (st.flash || 0) * Math.exp(-3 * dt);
        });
        (grp.userData.boats || []).forEach(function (m) { m.position.y = Math.sin(T + m.userData.ph) * 0.1; m.rotation.x = Math.sin(T * 0.8 + m.userData.ph) * 0.04; });
        ls += 4.5 * dt; var q = liftAt(ls);
        lift.position.set(q.x, 0, q.z); lift.rotation.y = lerpAngle(lift.rotation.y, Math.atan2(-q.dz, q.dx), Math.min(1, dt * 6));
        if (inv <= 0 && state === 'play') { var rx = px - q.x, rz = pz - q.z; if (Math.abs(rx * q.dx + rz * q.dz) < 1.6 + PR && Math.abs(rx * q.dz - rz * q.dx) < 0.75 + PR) hurt(rx, rz); }
      }
      return {
        key: 'harbour', title: 'Harbour at Night', group: grp, boxes: boxes, statues: statues, start: start, cam: { h: 11, b: 9 },
        env: { top: '#050b1c', sky: 0x0d1626, near: 25, far: 75, hemi: 0.22, hemiSky: 0x6f86c0, ground: 0x10141c, sun: 0.35, sunCol: 0x9fb4ff, exposure: 1.15 },
        slow: function () { return false; },
        slide: function (x, z) { return wetp.some(function (p) { return Math.hypot(x - p[0], z - p[1]) < p[2]; }); },
        tick: tick, exit: null, reset: function () { ls = 0; }
      };
    }

    // ---- Player: the sculpted Westie from statue.js (design 0, plain white), with a red collar and a soft contact shadow.
    // It shares the decimated statue geometry, so it costs one extra draw call. Animation is a trotting bob, nose rock and turn lean.
    var player = new THREE.Group(), body = new THREE.Group(); player.add(body);
    var STENCIL = { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp };
    var model = WestieStatue.makeDog(0, { texSize: 256 }); model.scale.setScalar(0.66);
    model.traverse(function (o) { if (o.material) { Object.assign(o.material, STENCIL); o.material.roughness = 0.85; KEEP.add(o.geometry); } });
    var collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 16), new THREE.MeshStandardMaterial(Object.assign({ color: col('#c8102e'), roughness: 0.5 }, STENCIL)));
    collar.position.set(0.62, 1.12, 0); collar.rotation.set(0, Math.PI / 2, 0.55); model.add(collar);
    body.add(model);
    // Visible dog parts mark the stencil; the x-ray ghost then draws only where the dog is hidden behind something.
    var ghostMat = new THREE.MeshBasicMaterial({ color: 0x1f6fff, transparent: true, opacity: 0.5, depthWrite: false, depthFunc: THREE.GreaterDepth, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc });
    var ghost = model.clone(); ghost.traverse(function (o) { if (o.material) { o.material = ghostMat; o.renderOrder = 5; } }); body.add(ghost);
    var blobCv = document.createElement('canvas'); blobCv.width = blobCv.height = 64;
    (function (c) { var gr = c.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); })(blobCv.getContext('2d'));
    var blob = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCv), transparent: true, depthWrite: false }));
    blob.position.y = 0.03; blob.renderOrder = 1; player.add(blob);
    var lean = 0, lastHeading = 0;
    scene.add(player);

    // ---- Levels.
    // Level registry: list order is the level-select order and the 'Next level' chain. stars = seconds for 3 / 2 stars.
    // fresh: rebuilt every run (random mazes); otherwise built once and reused.
    var LEVELS = [
      { key: 'town', title: 'Town', sub: '10 Westies · cars, gulls', stars: [150, 240], best: BEST_KEY, build: function () { return buildTown(); } },
      { key: 'forest', title: 'Forest Maze', sub: '8 Westies · foxes, badgers', stars: [120, 210], best: BEST_KEY + '-forest', fresh: true, build: function () { return buildForest(); } },
      { key: 'tower', title: 'The Old Mill', sub: '12 Westies · 4 floors, ladders', stars: [180, 300], best: BEST_KEY + '-tower', build: function () { return buildTower(MILL); } },
      { key: 'tower7', title: 'The Tower', sub: function () { return 'All ' + D.length + ' Westies · 7 floors'; }, stars: [480, 720], best: BEST_KEY + '-tower7', build: function () { return buildTower(TOWER7); } },
      { key: 'beach', title: 'Ayr Beach', sub: '10 Westies · tide, crabs', stars: [150, 240], best: BEST_KEY + '-beach', build: function () { return buildBeach(); } },
      { key: 'alloway', title: 'Alloway by Night', sub: '8 Westies · witches, fog', stars: [150, 240], best: BEST_KEY + '-alloway', fresh: true, build: function () { return buildForest(true); } },
      { key: 'hogmanay', title: 'Hogmanay Snow', sub: '10 Westies · ice, snowballs', stars: [160, 260], best: BEST_KEY + '-hogmanay', build: function () { return buildTown(true); } },
      { key: 'racecourse', title: 'Ayr Racecourse', sub: '8 Westies · horses, gates', stars: [110, 190], best: BEST_KEY + '-racecourse', build: function () { return buildRacecourse(); } },
      { key: 'harbour', title: 'Harbour at Night', sub: '8 Westies · torch, forklift', stars: [130, 220], best: BEST_KEY + '-harbour', build: function () { return buildHarbour(); } }
    ];
    var LV = {}, KEYS = {}, STARS = {};
    LEVELS.forEach(function (l, i) { LV[l.key] = l; l.next = LEVELS[i + 1]; KEYS[l.key] = l.best; STARS[l.key] = l.stars; });
    function starsFor(key, t) { return t === null ? 0 : t <= STARS[key][0] ? 3 : t <= STARS[key][1] ? 2 : 1; }
    function setLevel(key) {
      var def = LV[key], lv = def.fresh ? def.build() : (levels[key] = levels[key] || def.build());
      if (L && L !== lv) { scene.remove(L.group); if (LV[L.key].fresh) disposeTree(L.group, KEEP); }
      levels[key] = lv; L = lv; scene.add(lv.group);
      var e = lv.env; if (scene.background) scene.background.dispose();
      scene.background = skyTex(e.top, '#' + new THREE.Color(e.sky).getHexString()); scene.fog.color.set(e.sky); scene.fog.near = e.near; scene.fog.far = e.far;
      renderer.toneMappingExposure = e.exposure || 0.9;
      hemi.intensity = e.hemi; hemi.color.set(e.hemiSky); hemi.groundColor.set(e.ground); sun.intensity = e.sun; sun.color.set(e.sunCol);
      root.classList.toggle('wg-tower', !!lv.floors);
    }
    function best(k) { try { var v = localStorage.getItem(KEYS[k]), n = v === null ? NaN : +v; return isFinite(n) && n >= 0 ? n : null; } catch (e) { return null; } }
    var newBest = false, prevBest = null;

    function hud() {
      var h = ''; for (var i = 0; i < LIVES; i++) h += svg('heart', i < lives ? '' : 'wg-lost');
      hearts.innerHTML = h; hearts.setAttribute('aria-label', lives + ' of ' + LIVES + ' lives');
      foundEl.innerHTML = svg('paw') + found + '<small>/' + L.statues.length + '</small>';
      if (L.floors) floorEl.innerHTML = svg('floor') + (L.floor + 1) + '<small>/' + L.floors.length + '</small>';
      floorEl.setAttribute('aria-label', L.floors ? 'Floor ' + (L.floor + 1) + ' of ' + L.floors.length : '');
    }
    function toast(msg) {
      toastEl.textContent = msg; toastEl.classList.add('wg-on');
      clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('wg-on'); }, 2200);
    }
    function starRow(n, cls) { var h = ''; for (var i = 0; i < 3; i++) h += '<i' + (i < n ? ' class="wg-got"' : '') + '>★</i>'; return '<span class="' + cls + '">' + h + '</span>'; }
    function levelCard(key, title, sub) {
      var b = best(key);
      return '<button class="wg-lv" data-act="' + key + '">' + ART[key] + '<span><b>' + title + '</b><small>' + sub + '</small></span>' +
        '<span class="wg-st">' + starRow(starsFor(key, b), '') + '<br>' + (b !== null ? 'Best ' + fmt(b) : 'Not played') + '</span></button>';
    }

    function showScreen(kind) {
      if (!kind) { screenEl.classList.remove('wg-on'); return; }
      var b = best(L.key), n = L.statues.length, menu = '<button class="wg-go wg-alt" data-act="menu">Choose level</button>';
      var html;
      var LEAVE = document.getElementById('game-exit') ? '<button class="wg-go wg-alt" data-act="leave">← Back to the trail</button>' : '';
      if (kind === 'start') {
        html = '<p class="wg-kicker">Westies of Ayr</p><h2>Westie Hunt</h2><p>Find every painted Westie as fast as you can. Follow the gold arrow.</p>' +
          '<div class="wg-levels">' + LEVELS.map(function (l) { return levelCard(l.key, l.title, typeof l.sub === 'function' ? l.sub() : l.sub); }).join('') + '</div>' +
          '<p style="font-size:.85rem;margin-top:12px">Move with WASD / arrow keys, or the joystick on a phone.</p>' + soundBtns() + LEAVE;
        music.play('menu');
      } else if (kind === 'pause') {
        var grid = '';
        if (L.numbered) {
          var got = {}; L.statues.forEach(function (s) { if (s.found) got[s.id] = 1; });
          grid = '<div class="wg-grid" aria-label="Trail numbers found">' + D.map(function (d, i) { return '<span' + (got[i] ? ' class="wg-got" title="' + d.name.replace(/"/g, '') + '"' : '') + '>' + (i + 1) + '</span>'; }).join('') + '</div>';
        }
        html = '<p class="wg-kicker">' + L.title + '</p><h2>Paused</h2><p>' + found + ' of ' + n + ' found in ' + fmt(time) + (L.floors ? ' · Floor ' + (L.floor + 1) + '/' + L.floors.length : '') + '</p>' + grid + '<button class="wg-go" data-act="resume">Resume</button><button class="wg-go wg-alt" data-act="restart">Restart</button>' + soundBtns() + menu + LEAVE;
      } else if (kind === 'win') {
        var st = starsFor(L.key, Math.floor(time)), stars = '', i;
        for (i = 0; i < 3; i++) stars += '<span' + (i < st ? ' class="wg-got"' : '') + ' style="animation-delay:' + (0.15 + i * 0.18) + 's">★</span>';
        var nx = LV[L.key].next && [LV[L.key].next.key, LV[L.key].next.title];
        html = '<p class="wg-kicker">Level complete</p><h2>' + (L.exit ? 'Out of the maze!' : 'All Westies found!') + '</h2><div class="wg-bigstars" aria-label="' + st + ' of 3 stars">' + stars + '</div>' +
          '<div class="wg-stats"><div><small>Time</small><b>' + fmt(time) + '</b></div><div><small>' + (newBest && prevBest !== null ? 'New best!' : 'Best') + '</small><b>' + (b !== null ? fmt(b) : '–') + '</b></div></div>' +
          (nx ? '<button class="wg-go" data-act="' + nx[0] + '">Next level: ' + nx[1] + '</button><button class="wg-go wg-alt" data-act="restart">Play again</button>'
            : '<button class="wg-go" data-act="restart">Play again</button>' + menu) + LEAVE;
      } else {
        html = '<p class="wg-kicker">' + L.title + '</p><h2>Out of hearts!</h2><p>You found ' + found + ' of ' + n + ' Westies.</p><button class="wg-go" data-act="restart">Try again</button>' + menu + LEAVE;
      }
      card.innerHTML = html; screenEl.classList.add('wg-on');
      [].forEach.call(card.querySelectorAll('[data-act]'), function (btn) {
        btn.onclick = function () {
          var act = btn.getAttribute('data-act');
          if (act === 'music') toggleMusic();
          else if (act === 'sfx') toggleSfx();
          else if (act === 'resume') resume();
          else if (act === 'menu') { state = 'start'; showScreen('start'); }
          else if (act === 'leave') { var ex = document.getElementById('game-exit'); if (ex) ex.click(); } // host app's exit: pauses and goes to the map
          else begin(act === 'restart' ? L.key : act);
        };
      });
      var first = card.querySelector('[data-act]'); if (root.clientWidth) try { first.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
    }
    function begin(key) {
      if (LV[key].fresh || key !== L.key) setLevel(key); // mazes are fresh every run
      reset(); state = 'play'; showScreen(null); draw(); run();
      music.tempo(0); music.play(key); music.sfx('bark'); moveHint();
    }
    function end(kind) {
      state = kind; stop(); keys = {};
      if (kind === 'win') {
        var b = best(L.key), t = Math.floor(time); prevBest = b; newBest = b === null || t < b;
        if (newBest) try { localStorage.setItem(KEYS[L.key], String(t)); } catch (e) { /* storage blocked */ }
      }
      music.sting(kind === 'win' ? 'win' : 'lose'); if (kind === 'win') music.sfx('bark2');
      draw(); showScreen(kind);
    }
    function hurt(dx, dz) {
      lives--; inv = 1.6; shake = 0.45; music.sfx('yelp');
      var l = Math.hypot(dx, dz) || 1; kx = dx / l * 16; kz = dz / l * 16; vx = vz = 0;
      flashEl.classList.add('wg-on'); clearTimeout(flashTimer); flashTimer = setTimeout(function () { flashEl.classList.remove('wg-on'); }, 80);
      hud(); if (lives <= 0) end('over');
    }
    function collect(st) {
      st.found = true; found++; st.beam.visible = false; st.skin.emissiveIntensity = 0; st.pop = 1;
      burst(st.x, (L.y || 0) + 1.6, st.z); music.duck(); music.sfx('chime');
      hud();
      var what = L.numbered ? 'No. ' + (st.id + 1) + ' — ' + st.name : 'Found: ' + st.name + '!';
      if (found < L.statues.length) toast(what);
      else if (L.exit) { L.exit.openIt(); music.sfx('gate'); toast('All found! The gate is open — head for the exit!'); }
      else { toast(what); end('win'); }
    }
    function reset() {
      time = 0; lives = LIVES; found = 0; inv = 2; vx = vz = kx = kz = 0; keys = {}; climb = null; ladderLock = false; shake = 0;
      L.statues.forEach(function (s) { s.found = false; s.pop = 0; s.beam.visible = true; s.skin.emissiveIntensity = 0.3; s.dog.position.y = 0.6; });
      L.reset(); px = L.start[0]; pz = L.start[1];
      player.rotation.y = 0; player.visible = true; shownSec = -1; timeEl.textContent = fmt(0); hud(); place(1, 0);
    }

    var camBase = new THREE.Vector3(), climbY = 0, lookX = 0, lookZ = 0, portrait = true;
    function place(snap, dt) {
      var fy = L.y || 0;
      player.position.set(px, fy + climbY, pz);
      var ch = L.cam.h * camScale, cb = L.cam.b * camScale, k = snap ? 1 : 1 - Math.exp(-5 * dt), ty = fy + climbY * 0.6;
      // Look ahead of the dog in its direction of travel, and aim a little north so the dog sits lower on screen.
      var kl = snap ? 1 : 1 - Math.exp(-2.2 * dt), ahead = portrait ? 2.6 : 3.4;
      lookX += (vx / SPEED * ahead - lookX) * kl; lookZ += (vz / SPEED * ahead - lookZ) * kl;
      var ax = px + lookX, az = pz + lookZ - (portrait ? 0.16 : 0.06) * ch;
      camBase.x += (ax - camBase.x) * k; camBase.y += (ty + ch - camBase.y) * k; camBase.z += (az + cb - camBase.z) * k;
      var j = shake > 0.01 ? shake : 0, sx = (Math.random() - 0.5) * j, sy = (Math.random() - 0.5) * j;
      shake *= Math.exp(-7 * (dt || 0));
      cam.position.set(camBase.x + sx, camBase.y + sy, camBase.z);
      cam.lookAt(camBase.x + sx, camBase.y - ch + 0.8 + sy, camBase.z - cb);
      sun.position.set(px + 14, fy + 30, pz + 8); sun.target.position.set(px, fy, pz);
    }

    function update(dt) {
      time += dt; T += dt;
      tickSparks(dt);
      var speed = 0;
      if (climb) {
        // Ladder: shuffle to the foot, climb (or slide down), then step off on the new floor.
        climb.t = Math.min(1, climb.t + dt / 1.1);
        var u = climb.t, m = Math.min(1, u * 4), r = Math.max(0, (u - 0.25) / 0.75), ez = r * r * (3 - 2 * r);
        px = climb.x0 + (climb.lx - climb.x0) * m; pz = climb.z0 + (climb.lz - climb.z0) * m;
        climbY = L.FH * (climb.up ? ez : 1 - ez);
        player.rotation.y = lerpAngle(player.rotation.y, climb.face, Math.min(1, dt * 10));
        body.position.y = Math.abs(Math.sin(T * 12)) * 0.08; body.rotation.z = 0.25;
        if (u >= 1) {
          if (climb.up) L.setFloor(climb.to, true);
          px = climb.ax; pz = climb.az; climbY = 0; climb = null; ladderLock = true; inv = Math.max(inv, 0.6); hud();
        }
      } else {
        var ix = jx + (keys.r ? 1 : 0) - (keys.l ? 1 : 0), iz = jz + (keys.d ? 1 : 0) - (keys.u ? 1 : 0), il = Math.hypot(ix, iz);
        if (il > 1) { ix /= il; iz /= il; }
        var sp = SPEED * (L.slow(px, pz) ? 0.45 : 1);
        var kk = Math.min(1, dt * (L.slide && L.slide(px, pz) ? 1.5 : 12)); vx += (ix * sp - vx) * kk; vz += (iz * sp - vz) * kk;
        var kd = Math.exp(-5 * dt); kx *= kd; kz *= kd;
        var mx = (vx + kx) * dt, mz = (vz + kz) * dt, ns = Math.max(1, Math.ceil(Math.hypot(mx, mz) / (PR * 0.5)));
        for (var si = 0; si < ns; si++) { var p = collide(px + mx / ns, pz + mz / ns, PR, L.boxes); px = p[0]; pz = p[1]; }
        speed = Math.hypot(vx, vz);
        if (speed > 0.4) player.rotation.y = lerpAngle(player.rotation.y, Math.atan2(-vz, vx), Math.min(1, dt * 12));
        walk += dt * (2 + speed * 1.6);
        var sw = Math.sin(walk) * 0.7 * Math.min(1, speed / SPEED);
        // trot: bob and nose rock with the stride; lean into turns
        var turn = lerpAngle(0, player.rotation.y - lastHeading, 1) / Math.max(dt, 1e-3); lastHeading = player.rotation.y;
        lean += (Math.max(-0.22, Math.min(0.22, -turn * 0.05)) - lean) * Math.min(1, dt * 8);
        body.position.y = Math.abs(Math.sin(walk)) * 0.13 * Math.min(1, speed / 3);
        body.rotation.z = sw * 0.08 + (speed < 0.3 ? Math.sin(T * 2.2) * 0.025 : 0); body.rotation.x = lean;
        if (L.ladderAt && state === 'play') {
          var lad = L.ladderAt(px, pz, ladderLock ? 1.5 : 0.9);
          if (!lad) ladderLock = false;
          else if (!ladderLock) {
            climb = { t: 0, up: lad.up, to: lad.to, x0: px, z0: pz, lx: lad.fx, lz: lad.fz, ax: lad.ax, az: lad.az, face: lad.face };
            vx = vz = kx = kz = 0; music.sfx('clunk');
            if (!lad.up) L.setFloor(lad.to, true); // going down: show the lower floor straight away
          }
        }
      }
      blob.visible = !climb;
      if (inv > 0) { inv -= dt; player.visible = inv <= 0 || Math.floor(inv * 12) % 2 === 0; }

      L.tick(dt);
      if (L.key === 'tower7') music.tempo(L.floor * 5); // the Tower speeds up as you climb
      if (state !== 'play') return;

      var near = null, nd = 1e9, here = L.floors ? L.floor : undefined;
      L.statues.forEach(function (s) {
        if (s.found) {
          if (s.pop > 0) { // found: hop up, spin, settle
            s.pop = Math.max(0, s.pop - dt * 1.3);
            s.dog.position.y = 0.6 + Math.sin((1 - s.pop) * Math.PI) * 1.3; s.dog.rotation.y += dt * 9 * s.pop;
          }
          return;
        }
        s.dog.position.y = 0.72 + Math.sin(T * 2 + s.ph) * 0.12; s.dog.rotation.y += dt * 0.5;
        s.skin.emissiveIntensity = 0.12 + 0.12 * Math.sin(T * 3 + s.ph) + (s.flash || 0);
        if (s.floor !== here || climb) return;
        var d = Math.hypot(px - s.x, pz - s.z);
        if (d < 2.3 && state === 'play') collect(s);
        else if (d < nd) { nd = d; near = s; }
      });
      beamMat.opacity = 0.1 + 0.05 * Math.sin(T * 2.5);
      if (L.exit && L.exit.open && state === 'play') {
        if (pz < L.exit.z + 0.2 && Math.abs(px - L.exit.x) < 2.6) { end('win'); return; }
        if (!near) { near = L.exit; nd = Math.hypot(px - near.x, pz - near.z); }
      }
      var label = '';
      if (!near && L.nav && !climb) { near = L.nav(px, pz); if (near) { nd = Math.hypot(px - near.x, pz - near.z); label = near.up ? 'Ladder ↑ ' : 'Ladder ↓ '; if (!hinted.ladder) { setHint('ladder'); toast('Climb! Follow the arrow to the ladder and step on the ring'); } } }

      var sec = Math.floor(time); if (sec !== shownSec) { shownSec = sec; timeEl.textContent = fmt(time); }
      if (!!near !== navShown) { navShown = !!near; nav.style.visibility = near ? 'visible' : 'hidden'; }
      if (near) {
        // Camera never yaws, so screen-up is world -z.
        var ang = Math.round(Math.atan2(near.x - px, -(near.z - pz)) * 50) / 50;
        if (ang !== shownAng) { shownAng = ang; arrow.style.transform = 'rotate(' + ang + 'rad)'; }
        var dtext = label + Math.round(nd) + ' m'; if (dtext !== shownDist) { shownDist = dtext; distEl.textContent = dtext; }
      }
      place(0, dt);
    }

    function draw() { renderer.render(scene, cam); }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      // Sustained slow frames (>22 ms for ~2 s) drop the pixel ratio to 1.
      if (maxPR > 1) { slowFrames = dt > 0.022 ? slowFrames + 1 : Math.max(0, slowFrames - 2); if (slowFrames > 90) { maxPR = 1; renderer.setPixelRatio(1); resize(); } }
      update(dt); if (state === 'play') draw();
    }
    function run() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    function pause() {
      if (state !== 'play') return;
      state = 'pause'; stop(); keys = {}; joyEnd({ pointerId: jid }); music.suspend(); draw(); showScreen('pause');
    }
    function resume() { if (state === 'pause') { state = 'play'; showScreen(null); run(); music.resume(); } }

    var KEYMAP = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
    function typing(e) { var t = e.target; return t && t !== document.body && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); }
    function onKey(e) {
      if (typing(e) || !root.offsetParent || !root.clientWidth) return;
      if (state === 'play' && KEYMAP[e.key]) { keys[KEYMAP[e.key]] = e.type === 'keydown'; e.preventDefault(); }
      else if (e.type === 'keydown' && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) { if (state === 'play') pause(); else if (state === 'pause' && e.key !== 'Escape') resume(); }
    }
    function onBlur() { keys = {}; }
    function onVis() { if (document.hidden) { pause(); music.suspend(); } else if (state !== 'pause' && root.clientWidth) music.resume(); }
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    $('.wg-pause').onclick = pause;

    // Floating joystick: appears under the thumb anywhere on the left 45% of the screen.
    var joyMax = 45, jcx = 0, jcy = 0;
    function joySize() { var h = root.clientHeight; return h < 420 ? 90 : Math.min(120, Math.round(h * 0.3)); }
    function joyStart(e) {
      if (state !== 'play' || jid !== null || e.pointerType === 'mouse') return;
      if (e.target.closest && e.target.closest('button,.wg-screen')) return;
      var r = root.getBoundingClientRect(); if (e.clientX - r.left > r.width * 0.45) return;
      var sz = joySize(); jid = e.pointerId; joyMax = sz / 2 - 6; jcx = e.clientX; jcy = e.clientY;
      joy.style.setProperty('--js', sz + 'px'); joy.style.left = (e.clientX - r.left) + 'px'; joy.style.top = (e.clientY - r.top) + 'px'; joy.classList.add('wg-on');
      try { root.setPointerCapture(jid); } catch (er) { /* synthetic events */ }
      hideHint(); joyMove(e); e.preventDefault();
    }
    function joyMove(e) {
      if (e.pointerId !== jid) return;
      var dx = e.clientX - jcx, dy = e.clientY - jcy, l = Math.hypot(dx, dy);
      if (l > joyMax) { dx *= joyMax / l; dy *= joyMax / l; l = joyMax; }
      var m = l / joyMax, amt = m < 0.15 ? 0 : Math.pow((m - 0.15) / 0.85, 1.4); // dead zone, then eased
      jx = l ? dx / l * amt : 0; jz = l ? dy / l * amt : 0;
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }
    function joyEnd(e) { if (e.pointerId !== jid) return; jid = null; jx = jz = 0; knob.style.transform = ''; joy.classList.remove('wg-on'); }
    root.addEventListener('pointerdown', joyStart); root.addEventListener('pointermove', joyMove);
    root.addEventListener('pointerup', joyEnd); root.addEventListener('pointercancel', joyEnd);
    // First-time hints (remembered): a ghost thumb over the joystick area, and a ladder tip.
    var hinted = {}, hintEl = $('.wg-hint'), hintTimer = 0;
    try { hinted = JSON.parse(localStorage.getItem('westie-game-hinted') || '{}') || {}; } catch (e) { /* storage blocked */ }
    function setHint(k) { hinted[k] = 1; try { localStorage.setItem('westie-game-hinted', JSON.stringify(hinted)); } catch (e) { /* storage blocked */ } }
    function hideHint() { hintEl.classList.remove('wg-on'); clearTimeout(hintTimer); }
    function moveHint() {
      if (hinted.move) return;
      setHint('move');
      if (root.classList.contains('wg-touch')) { hintEl.classList.add('wg-on'); hintTimer = setTimeout(hideHint, 3000); }
      else toast('Move with WASD or the arrow keys');
    }

    root.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') root.classList.add('wg-touch'); });

    function resize() {
      var w = root.clientWidth, h = root.clientHeight;
      if (!w || !h) { pause(); music.suspend(); return; } // tab hidden (display:none)
      renderer.setSize(w, h); cam.aspect = w / h; cam.fov = w < h ? 62 : 50; cam.updateProjectionMatrix();
      portrait = w < h; camScale = portrait ? 1.6 : (h < 420 ? 0.95 : 1.3); place(1, 0); if (!raf) draw();
      if (state !== 'pause' && !document.hidden) music.resume();
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(root); else window.addEventListener('resize', resize);

    setLevel('town'); reset(); resize(); showScreen('start');
    // Test-only hook (game-test.html sets the flag first); not part of the API.
    if (window.WESTIE_GAME_DEBUG) window.WESTIE_GAME_DEBUG = { level: function () { return L; }, warp: function (x, z) { px = x; pz = z; place(1, 0); }, collect: function (n) { L.statues.slice(0, n).forEach(function (s) { if (!s.found) collect(s); }); }, floor: function (n) { if (L.setFloor) { L.setFloor(n); hud(); } }, music: music };

    return {
      // The host may pause on the menu too (tab switch): always silence; resume() restarts menu music if not mid-game.
      pause: function () { pause(); music.suspend(); },
      resume: function () { resume(); if (state !== 'pause') music.resume(); },
      dispose: function () {
        stop(); state = 'disposed'; music.dispose();
        root.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onVis);
        clearTimeout(toastTimer); clearTimeout(flashTimer); clearTimeout(hintTimer);
        disposeTree(scene);
        Object.keys(levels).forEach(function (k) { if (levels[k] !== L) disposeTree(levels[k].group); });
        renderer.dispose(); renderer.forceContextLoss();
        if (root.parentNode) root.parentNode.removeChild(root);
        if (--live === 0 && styleEl) { styleEl.parentNode.removeChild(styleEl); styleEl = null; }
      }
    };
  }

  window.WestieGame = { mount: mount };
})();
