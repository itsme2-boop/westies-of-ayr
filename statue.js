/* Westie Trail statue: 30 procedural designs + Three.js (r128) statue viewer.
   Needs global THREE and THREE.OrbitControls loaded first. */
(function () {
  'use strict';
  var TAU = Math.PI * 2, S = 1024;

  // Seeded RNG so every design paints the same way every time.
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function bg(c, col) { c.fillStyle = col; c.fillRect(0, 0, S, S); }
  function dot(c, x, y, rad, col) { c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fillStyle = col; c.fill(); }
  function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function vgrad(c, stops, y0, y1) {
    var g = c.createLinearGradient(0, y0 || 0, 0, y1 || S);
    stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); });
    return g;
  }

  // Tartan from a half-sett [[colour, width], ...], mirrored as real setts are.
  function tartan(c, sett) {
    var seq = sett.concat(sett.slice().reverse()), p, i;
    for (p = 0, i = 0; p < S; i++) { var s = seq[i % seq.length]; c.fillStyle = s[0]; c.fillRect(0, p, S, s[1]); p += s[1]; }
    c.globalAlpha = 0.55;
    for (p = 0, i = 0; p < S; i++) { s = seq[i % seq.length]; c.fillStyle = s[0]; c.fillRect(p, 0, s[1], S); p += s[1]; }
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(0,0,0,0.10)'; c.lineWidth = 2;
    for (p = -S; p < S; p += 6) line(c, p, 0, p + S, S);
  }

  function starburst(c, x, y, r1, r2, n, fill) {
    c.beginPath();
    for (var i = 0; i < n * 2; i++) {
      var a = i / (n * 2) * TAU, rr = i % 2 ? r2 : r1;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = 6; c.strokeStyle = '#111'; c.stroke();
  }

  function horse(c, x, y, coat, silk, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.strokeStyle = coat; c.lineCap = 'round'; c.lineWidth = 9;
    line(c, -40, 15, -70, 50); line(c, -30, 15, -10, 55); line(c, 35, 15, 70, 40); line(c, 40, 15, 25, 58);
    c.fillStyle = coat;
    c.beginPath(); c.ellipse(0, 0, 60, 26, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(35, -15); c.lineTo(70, -55); c.lineTo(85, -45); c.lineTo(55, 5); c.fill();
    c.beginPath(); c.ellipse(85, -48, 22, 11, 0.5, 0, TAU); c.fill();
    c.lineWidth = 6; line(c, -58, -5, -90, 20);
    dot(c, 5, -48, 11, '#f1c27d');
    c.fillStyle = silk; c.beginPath(); c.ellipse(-2, -26, 14, 20, 0.4, 0, TAU); c.fill();
    c.beginPath(); c.arc(5, -52, 11, Math.PI, TAU); c.fill();
    c.restore();
  }

  function paisleyShape(c, x, y, s, rot) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.beginPath(); c.moveTo(0, 0.6);
    c.bezierCurveTo(-0.6, 0.6, -0.6, -0.2, 0, -0.3);
    c.bezierCurveTo(0.4, -0.4, 0.3, -0.9, 0.6, -1.0);
    c.bezierCurveTo(0.7, -0.5, 0.6, 0.6, 0, 0.6);
    c.restore();
  }

  var D = [
    ['Classic White', 'Morag Kerr', 'A tribute to the breed itself: soft white fur and nothing else to hide behind.', function (c, r) {
      bg(c, '#f7f5ef');
      c.lineWidth = 2.5; c.lineCap = 'round';
      for (var i = 0; i < 4000; i++) {
        var x = r() * S, y = r() * S, l = 10 + r() * 18, a = Math.PI / 2 + (r() - 0.5) * 1.2;
        c.strokeStyle = r() < 0.5 ? 'rgba(190,182,168,0.35)' : 'rgba(255,255,255,0.9)';
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 6, y + l / 2, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
    }],
    ['Royal Stewart', 'Callum Baird', 'The best-known tartan of them all, worn proudly on Ayr High Street.', function (c) {
      tartan(c, [['#c8102e', 40], ['#0a2a6b', 14], ['#111', 6], ['#f2d43a', 3], ['#111', 6], ['#c8102e', 12], ['#fff', 3], ['#c8102e', 12], ['#0d5c2e', 18], ['#c8102e', 8]]);
    }],
    ['Black Watch', 'Isla Macpherson', 'The dark green and navy of the famous regiment, quiet but unmistakable.', function (c) {
      tartan(c, [['#0b2346', 34], ['#111', 10], ['#0b2346', 4], ['#111', 10], ['#0c3d26', 34], ['#111', 4]]);
    }],
    ['Carrick Coast', 'Fraser Dunlop', 'A tartan sett invented for this trail, in the sea and sand colours of the Ayrshire coast.', function (c) {
      tartan(c, [['#1c3f5e', 36], ['#3fa7a3', 14], ['#1c3f5e', 6], ['#e9c46a', 4], ['#1c3f5e', 6], ['#f4f1de', 8], ['#7a1f2b', 20]]);
    }],
    ['Saltire Pup', 'Eilidh Grant', 'St Andrew\'s cross in bold blue and white, flying from nose to tail.', function (c) {
      bg(c, '#005eb8'); c.strokeStyle = '#fff'; c.lineWidth = 80;
      [0, 512, 1024].forEach(function (cx) { line(c, cx - 256, 0, cx + 256, S); line(c, cx + 256, 0, cx - 256, S); });
    }],
    ['Rabbie\'s Words', 'Hamish Burnett', 'Lines from Robert Burns, Ayrshire\'s own bard, written all over.', function (c) {
      bg(c, '#f3e6c4');
      var lines = ['My love is like a red, red rose', 'Should auld acquaintance be forgot', 'Wee, sleekit, cow\'rin, tim\'rous beastie',
        'Auld Ayr, wham ne\'er a town surpasses', 'For honest men and bonie lasses', 'A man\'s a man for a\' that',
        'Fair fa\' your honest, sonsie face', 'My heart\'s in the Highlands', 'Tam o\' Shanter'];
      var fonts = ['italic 40px Georgia, serif', 'bold 36px Georgia, serif', '42px "Brush Script MT", cursive', 'italic bold 34px serif'];
      var cols = ['#5a1e1e', '#1f3b5a', '#2f4f2f', '#7a3e00'];
      c.textBaseline = 'middle';
      for (var row = 0; row < 18; row++) {
        var x = -((row * 137) % 300), k = row;
        c.font = fonts[row % 4]; c.fillStyle = cols[row % 4];
        while (x < S) { var t = lines[k++ % lines.length] + '  •  '; c.fillText(t, x, 30 + row * 57); x += c.measureText(t).width; }
      }
    }],
    ['Beach Hut Parade', 'Kirsty Laing', 'A row of cheerful seaside huts like a sunny day on Ayr beach.', function (c, r) {
      c.fillStyle = vgrad(c, ['#5fb8f2', '#bfe7ff'], 0, 300); c.fillRect(0, 0, S, 300);
      c.fillStyle = '#2a8fc4'; c.fillRect(0, 300, S, 80);
      c.fillStyle = '#f1dca0'; c.fillRect(0, 380, S, S - 380);
      var cols = ['#e63946', '#f4a261', '#2a9d8f', '#ffd166', '#118ab2', '#ef476f', '#06d6a0', '#8338ec'];
      for (var i = 0; i < 8; i++) {
        var x = i * 128 + 10, col = cols[i];
        c.fillStyle = col; c.fillRect(x, 520, 108, 300);
        if (i % 2) { c.fillStyle = '#fff'; for (var k = 0; k < 108; k += 27) c.fillRect(x + k, 520, 13, 300); }
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x - 10, 525); c.lineTo(x + 54, 440); c.lineTo(x + 118, 525); c.fill();
        c.fillStyle = col; c.beginPath(); c.moveTo(x + 8, 515); c.lineTo(x + 54, 455); c.lineTo(x + 100, 515); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + 34, 640, 40, 180);
        c.fillStyle = '#8d6e63'; c.fillRect(x - 10, 820, 128, 16);
      }
      for (i = 0; i < 300; i++) dot(c, r() * S, 850 + r() * 174, 2, 'rgba(160,120,60,0.4)');
    }],
    ['Harbour Lights', 'Douglas McIlwraith', 'Fishing boats bobbing in Ayr harbour beneath the old stone quay.', function (c, r) {
      c.fillStyle = vgrad(c, ['#5fa8d3', '#1b4965']); c.fillRect(0, 0, S, S);
      c.fillStyle = '#8d8a83'; c.fillRect(0, 0, S, 150);
      c.strokeStyle = '#6b6862'; c.lineWidth = 3;
      for (var y = 0; y < 150; y += 37) for (var x = (y / 37 % 2) * 40; x < S; x += 80) c.strokeRect(x, y, 80, 37);
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 3;
      for (var i = 0; i < 160; i++) { x = r() * S; y = 160 + r() * 864; c.beginPath(); c.arc(x, y, 14, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); }
      var hulls = ['#c1121f', '#003049', '#f77f00', '#2a9d8f', '#fcbf49', '#5e548e'];
      for (i = 0; i < 12; i++) {
        x = (i % 4) * 256 + 40 + r() * 80; y = 300 + Math.floor(i / 4) * 250 + r() * 50;
        var col = pick(r, hulls);
        c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + 10, y + 40, 150, 20);
        c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 170, y); c.lineTo(x + 145, y + 40); c.lineTo(x + 20, y + 40); c.fill();
        c.fillStyle = '#fff'; c.fillRect(x + 90, y - 45, 50, 45);
        c.fillStyle = '#1b263b'; c.fillRect(x + 98, y - 38, 14, 14); c.fillRect(x + 118, y - 38, 14, 14);
        c.strokeStyle = '#333'; c.lineWidth = 5; line(c, x + 55, y, x + 55, y - 110);
        c.strokeStyle = '#ffd166'; c.lineWidth = 3; line(c, x + 55, y - 105, x + 150, y - 45);
      }
      c.strokeStyle = '#fff'; c.lineWidth = 4;
      for (i = 0; i < 10; i++) { x = r() * S; y = 180 + r() * 800; c.beginPath(); c.arc(x - 12, y, 12, Math.PI * 1.1, Math.PI * 1.9); c.arc(x + 12, y, 12, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    }],
    ['Heather Hills', 'Ailsa Ross', 'A carpet of purple Highland heather in late summer bloom.', function (c, r) {
      c.fillStyle = vgrad(c, ['#7b6a9a', '#4d6b3a', '#3a4f2a']); c.fillRect(0, 0, S, S);
      var purples = ['#9b5fc0', '#c77dff', '#7b2cbf', '#e0aaff', '#b5179e'];
      for (var i = 0; i < 1100; i++) {
        var x = r() * S, y = r() * (S + 60), h = 40 + r() * 50;
        c.strokeStyle = '#2d4a22'; c.lineWidth = 3; line(c, x, y, x + (r() - 0.5) * 10, y - h);
        var p = pick(r, purples);
        for (var k = 0; k < 8; k++) dot(c, x + (r() - 0.5) * 12, y - h * 0.4 - k * h * 0.08, 4 + r() * 3, p);
      }
    }],
    ['Flower of Scotland', 'Ruaridh Shaw', 'Prickly purple thistles, Scotland\'s national flower, standing tall.', function (c, r) {
      c.fillStyle = vgrad(c, ['#d8ecf7', '#a9d1e8']); c.fillRect(0, 0, S, S);
      for (var i = 0; i < 20; i++) {
        var x = (i % 5) * 205 + 100 + (r() - 0.5) * 60, y = Math.floor(i / 5) * 256 + 150 + (r() - 0.5) * 40;
        c.strokeStyle = '#3f7a3a'; c.lineWidth = 8; line(c, x, y, x, y + 140);
        c.fillStyle = '#4c8a3f';
        [-1, 1].forEach(function (d) {
          c.beginPath(); c.moveTo(x, y + 90);
          for (var k = 0; k <= 5; k++) c.lineTo(x + d * (k * 14), y + 90 - (k % 2 ? 22 : 6) + k * 3);
          c.lineTo(x, y + 110); c.fill();
        });
        c.fillStyle = '#3f7a3a'; c.beginPath(); c.ellipse(x, y, 30, 34, 0, 0, TAU); c.fill();
        c.strokeStyle = '#a7c957'; c.lineWidth = 2;
        for (var k = -24; k <= 24; k += 12) { line(c, x + k - 15, y - 25, x + k + 15, y + 25); line(c, x + k + 15, y - 25, x + k - 15, y + 25); }
        c.lineWidth = 5;
        for (var a = -2.7; a <= -0.4; a += 0.11) {
          c.strokeStyle = r() < 0.5 ? '#8e44ad' : '#c56cf0';
          line(c, x + Math.cos(a) * 18, y - 26 + Math.sin(a) * 6, x + Math.cos(a) * 55, y - 26 + Math.sin(a) * 60);
        }
      }
    }],
    ['Arran at Dusk', 'Catriona Boyd', 'The Sleeping Warrior of Arran glowing across the Firth of Clyde at sunset.', function (c, r) {
      c.fillStyle = vgrad(c, ['#2b1d5c', '#8e3b8a', '#e85d75', '#ff9a3c', '#ffd36b'], 0, 600); c.fillRect(0, 0, S, 600);
      var g = c.createRadialGradient(512, 560, 20, 512, 560, 260); g.addColorStop(0, 'rgba(255,240,180,0.9)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = g; c.fillRect(0, 300, S, 300);
      dot(c, 512, 575, 85, '#ffe39a');
      c.fillStyle = '#3b2559';
      c.beginPath(); c.moveTo(0, 600);
      [[0, 540], [90, 500], [170, 470], [230, 430], [290, 455], [360, 410], [420, 440], [470, 470], [560, 485], [640, 450], [700, 470], [780, 520], [880, 505], [960, 530], [1024, 540]].forEach(function (p) { c.lineTo(p[0], p[1]); });
      c.lineTo(S, 600); c.fill();
      c.fillStyle = vgrad(c, ['#4a2f73', '#1a1840'], 600, S); c.fillRect(0, 600, S, 424);
      for (var i = 0; i < 90; i++) {
        var y = 610 + r() * 400, w = 20 + r() * 120 * (1 - (y - 600) / 500);
        c.fillStyle = 'rgba(255,190,110,' + (0.2 + r() * 0.5) + ')'; c.fillRect(512 - w / 2 + (r() - 0.5) * 200, y, w, 4);
      }
    }],
    ['Off and Running', 'Gordon Hastie', 'Racehorses thundering round Ayr Racecourse, home of the Scottish Grand National.', function (c, r) {
      for (var i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#4caf50' : '#43a047'; c.fillRect(0, i * 128, S, 128); }
      c.strokeStyle = '#fff'; c.lineWidth = 8;
      [190, 860].forEach(function (y) { line(c, 0, y, S, y); line(c, 0, y + 30, S, y + 30); for (var x = 0; x < S; x += 64) line(c, x, y, x, y + 50); });
      var coats = ['#5d4037', '#3e2723', '#8d6e63', '#212121', '#a1887f'], silks = ['#e63946', '#ffd166', '#118ab2', '#fff', '#06d6a0', '#ff70a6'];
      for (i = 0; i < 9; i++) horse(c, (i % 3) * 340 + 150 + r() * 40, 360 + Math.floor(i / 3) * 190, pick(r, coats), pick(r, silks), 1.1);
    }],
    ['Cathedral Light', 'Fiona Struthers', 'Jewel-coloured stained glass, inspired by the windows of Ayr\'s old kirks.', function (c, r) {
      var n = 9, step = S / (n - 1), P = [], i, j;
      for (j = 0; j < n; j++) { P[j] = []; for (i = 0; i < n; i++) P[j][i] = [i * step + (i % (n - 1) ? (r() - 0.5) * 60 : 0), j * step + (j % (n - 1) ? (r() - 0.5) * 60 : 0)]; }
      var jewels = ['#c1121f', '#1d4ed8', '#059669', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#facc15'];
      function tri(a, b, d) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fillStyle = pick(r, jewels); c.fill(); c.stroke(); }
      c.strokeStyle = '#1a1a1a'; c.lineWidth = 10; c.lineJoin = 'round';
      for (j = 0; j < n - 1; j++) for (i = 0; i < n - 1; i++) {
        if ((i + j) % 2) { tri(P[j][i], P[j][i + 1], P[j + 1][i]); tri(P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]); }
        else { tri(P[j][i], P[j][i + 1], P[j + 1][i + 1]); tri(P[j][i], P[j + 1][i + 1], P[j + 1][i]); }
      }
      var g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.15)');
      c.fillStyle = g; c.fillRect(0, 0, S, S);
    }],
    ['Spotty Dug', 'Lorna Gibb', 'Big white polka dots on pillar-box red, because every trail needs some fun.', function (c) {
      bg(c, '#e63946');
      for (var y = 0, row = 0; y < S + 64; y += 96, row++) for (var x = (row % 2) * 64; x < S + 64; x += 128) dot(c, x, y, 32, '#fff');
    }],
    ['Over the Rainbow', 'Alex Morrison', 'Pride colours wrapping the statue in bands of welcome.', function (c) {
      ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'].forEach(function (col, i) { c.fillStyle = col; c.fillRect(0, i * S / 6, S, S / 6 + 1); });
    }],
    ['Star Dog', 'Nadia Quinn', 'A deep-space Westie swirling with nebulae and stars over the Ayrshire night.', function (c, r) {
      bg(c, '#05030f');
      [['rgba(123,44,191,0.55)', 300, 400, 380], ['rgba(0,119,182,0.5)', 750, 300, 340], ['rgba(255,0,110,0.35)', 600, 750, 320], ['rgba(58,12,163,0.5)', 150, 850, 300], ['rgba(0,180,216,0.3)', 950, 800, 260]].forEach(function (n) {
        var g = c.createRadialGradient(n[1], n[2], 0, n[1], n[2], n[3]); g.addColorStop(0, n[0]); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, S, S);
      });
      for (var i = 0; i < 1400; i++) dot(c, r() * S, r() * S, r() * r() * 2.6 + 0.4, 'rgba(255,255,255,' + (0.4 + r() * 0.6) + ')');
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2;
      for (i = 0; i < 25; i++) { var x = r() * S, y = r() * S, l = 8 + r() * 14; line(c, x - l, y, x + l, y); line(c, x, y - l, x, y + l); dot(c, x, y, 3, '#fff'); }
    }],
    ['Knotwork', 'Seonaid MacLeod', 'Endless Celtic rings in gold on deep green, with no beginning and no end.', function (c) {
      bg(c, '#0e4d3a');
      var sp = 128, rr = 76, x, y;
      function ring(x, y, a0, a1) {
        c.beginPath(); c.arc(x, y, rr, a0, a1); c.strokeStyle = '#111'; c.lineWidth = 28; c.stroke();
        c.beginPath(); c.arc(x, y, rr, a0, a1); c.strokeStyle = '#d4a537'; c.lineWidth = 16; c.stroke();
        c.beginPath(); c.arc(x, y, rr, a0, a1); c.strokeStyle = '#f6dc8a'; c.lineWidth = 4; c.stroke();
      }
      for (y = 0; y <= S; y += sp) for (x = 0; x <= S; x += sp) ring(x, y, 0, TAU);
      // redraw short arcs on top so neighbouring rings appear to weave over and under
      for (y = 0; y <= S; y += sp) for (x = 0; x <= S; x += sp) { ring(x, y, -0.6, 0.6); ring(x, y, Math.PI / 2 - 0.6, Math.PI / 2 + 0.6); }
      c.strokeStyle = '#d4a537'; c.lineWidth = 6;
      for (y = sp / 2; y < S; y += sp) for (x = sp / 2; x < S; x += sp) { c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x + 14, y); c.lineTo(x, y + 14); c.lineTo(x - 14, y); c.closePath(); c.stroke(); }
    }],
    ['Hide and Seek', 'Craig Paton', 'Woodland camouflage, so this Westie can sneak up on squirrels in Rozelle Park.', function (c, r) {
      bg(c, '#6b7b4b');
      var cols = ['#3f4a2a', '#8a7a52', '#2a2a1f', '#9aa36b'];
      for (var i = 0; i < 160; i++) {
        var col = pick(r, cols), x = r() * S, y = r() * S;
        for (var k = 0; k < 7; k++) dot(c, x + (r() - 0.5) * 90, y + (r() - 0.5) * 60, 20 + r() * 30, col);
      }
    }],
    ['WOOF!', 'Jamie Kerr', 'Pop-art comic panels with halftone dots and a very loud bark.', function (c) {
      bg(c, '#ffe14d');
      for (var y = 0; y < S; y += 22) for (var x = (y / 22 % 2) * 11; x < S; x += 22) dot(c, x, y, 2 + 7 * (0.5 + 0.5 * Math.sin(x / 90) * Math.cos(y / 120)), '#e8322f');
      [[260, 260, 'WOOF!', '#fff'], [770, 520, 'POW!', '#4cc9f0'], [300, 800, 'ARF!', '#fff'], [800, 900, 'ZAP!', '#ff70a6'], [800, 110, 'BARK!', '#fff']].forEach(function (b) {
        starburst(c, b[0], b[1], 170, 110, 14, b[3]);
        c.font = 'bold 90px Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 10; c.strokeStyle = '#111'; c.strokeText(b[2], b[0], b[1]); c.fillStyle = '#e8322f'; c.fillText(b[2], b[0], b[1]);
      });
      c.textAlign = 'start';
    }],
    ['Seaside Mosaic', 'Mhairi Robertson', 'Hundreds of little tiles in the blues and golds of the Clyde coast.', function (c, r) {
      bg(c, '#ece4d4');
      var pal = ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#e9c46a', '#f4a261', '#0077b6', '#2a9d8f'];
      for (var y = 0; y < S; y += 32) for (var x = 0; x < S; x += 32) {
        var d = Math.hypot(x + 16 - 512, y + 16 - 512), k = Math.floor(d / 56 + r() * 0.6);
        c.fillStyle = pal[k % pal.length]; c.fillRect(x + 3 + r() * 2, y + 3 + r() * 2, 26, 26);
      }
    }],
    ['Firth of Clyde', 'Euan Paterson', 'Rolling waves layered from pale shallows to deep blue water.', function (c) {
      var cols = ['#caf0f8', '#ade8f4', '#90e0ef', '#48cae4', '#00b4d8', '#0096c7', '#0077b6', '#023e8a', '#03045e', '#020340', '#0077b6', '#00b4d8', '#48cae4', '#90e0ef'];
      bg(c, cols[0]);
      cols.forEach(function (col, i) {
        var y0 = i * 76, amp = 22 + (i % 3) * 8, f = 2 + (i % 4);
        c.beginPath(); c.moveTo(0, S);
        for (var x = 0; x <= S; x += 8) c.lineTo(x, y0 + Math.sin(x / S * TAU * f + i) * amp);
        c.lineTo(S, S); c.closePath(); c.fillStyle = col; c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 5; c.beginPath();
        for (x = 0; x <= S; x += 8) c.lineTo(x, y0 + Math.sin(x / S * TAU * f + i) * amp); c.stroke();
      });
    }],
    ['Autumn in Belleisle', 'Rhona Wallace', 'Falling leaves in fiery reds and golds from Belleisle Park\'s old trees.', function (c, r) {
      bg(c, '#5a3b22');
      var cols = ['#d9480f', '#f08c00', '#c92a2a', '#e8b923', '#8f3b1b', '#e67700'];
      for (var i = 0; i < 170; i++) {
        var s = 30 + r() * 35; c.save(); c.translate(r() * S, r() * S); c.rotate(r() * TAU);
        c.fillStyle = pick(r, cols);
        c.beginPath(); c.moveTo(0, -s); c.bezierCurveTo(s * 0.8, -s * 0.5, s * 0.6, s * 0.6, 0, s); c.bezierCurveTo(-s * 0.6, s * 0.6, -s * 0.8, -s * 0.5, 0, -s); c.fill();
        c.strokeStyle = 'rgba(60,20,0,0.5)'; c.lineWidth = 3; line(c, 0, -s * 0.9, 0, s * 1.3);
        c.restore();
      }
    }],
    ['Burns Supper', 'Alasdair Reid', 'Haggis, neeps and tatties served on a tartan tablecloth for Burns Night.', function (c, r) {
      tartan(c, [['#7a1020', 40], ['#0b2346', 14], ['#111', 6], ['#f2d43a', 3], ['#111', 6], ['#7a1020', 20], ['#0c3d26', 18]]);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 0, S, S);
      for (var i = 0; i < 9; i++) {
        var x = (i % 3) * 341 + 170 + (Math.floor(i / 3) % 2) * 60 - 30, y = Math.floor(i / 3) * 341 + 170;
        dot(c, x + 6, y + 8, 128, 'rgba(0,0,0,0.35)'); dot(c, x, y, 128, '#fafafa'); c.strokeStyle = '#1f3b5a'; c.lineWidth = 6; c.beginPath(); c.arc(x, y, 112, 0, TAU); c.stroke();
        c.fillStyle = '#6d3b1f'; c.beginPath(); c.ellipse(x - 10, y - 25, 62, 44, 0.2, 0, TAU); c.fill();
        c.strokeStyle = '#4a240f'; c.lineWidth = 5; line(c, x - 50, y - 30, x + 30, y - 20); line(c, x - 10, y - 65, x - 10, y + 15);
        for (var k = 0; k < 6; k++) dot(c, x - 45 + k * 10 + r() * 6, y + 50 + r() * 14, 18, '#f08c00');
        for (k = 0; k < 6; k++) dot(c, x + 35 + r() * 30, y + 5 + k * 8, 18, '#f3ead3');
        c.fillStyle = 'rgba(220,150,40,0.85)'; c.fillRect(x + 120, y - 100, 34, 44); c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(x + 120, y - 110, 34, 54);
      }
    }],
    ['Pipe Band', 'Kenneth Muir', 'Rows of tartan bagpipes, ready to strike up Scotland the Brave.', function (c) {
      bg(c, '#f4ecd8');
      for (var i = 0; i < 16; i++) {
        var x = (i % 4) * 256 + 128 + (Math.floor(i / 4) % 2) * 64 - 32, y = Math.floor(i / 4) * 256 + 140;
        c.save(); c.translate(x, y); c.rotate(-0.3);
        c.strokeStyle = '#111'; c.lineCap = 'round';
        [[-20, 150, 14], [10, 120, 11], [40, 105, 11]].forEach(function (d) {
          c.lineWidth = d[2]; line(c, d[0], -10, d[0] + 30, -d[1]);
          c.strokeStyle = '#efe6cf'; c.lineWidth = d[2] + 6; line(c, d[0] + 15, -d[1] * 0.5, d[0] + 17, -d[1] * 0.55); c.strokeStyle = '#111';
          dot(c, d[0] + 30, -d[1] - 6, d[2], '#111');
        });
        c.save(); c.beginPath(); c.ellipse(0, 20, 70, 50, 0, 0, TAU); c.clip();
        c.fillStyle = '#c8102e'; c.fillRect(-80, -40, 160, 120);
        c.fillStyle = 'rgba(13,92,46,0.8)'; for (var k = -80; k < 80; k += 30) { c.fillRect(k, -40, 10, 120); c.fillRect(-80, k + 20, 160, 10); }
        c.fillStyle = 'rgba(10,42,107,0.6)'; for (k = -65; k < 80; k += 30) { c.fillRect(k, -40, 4, 120); c.fillRect(-80, k + 20, 160, 4); }
        c.restore();
        c.lineWidth = 4; c.strokeStyle = '#111'; c.beginPath(); c.ellipse(0, 20, 70, 50, 0, 0, TAU); c.stroke();
        c.lineWidth = 12; line(c, -40, 60, -70, 140);
        c.strokeStyle = '#e9c46a'; c.lineWidth = 5; line(c, 60, 0, 100, -40);
        c.restore();
      }
    }],
    ['Honest Men', 'Stuart Boyle', 'Black and white stripes in honour of Ayr United, the Honest Men of Somerset Park.', function (c) {
      bg(c, '#fff'); c.fillStyle = '#111';
      for (var x = 0; x < S; x += 128) c.fillRect(x, 0, 64, S);
      c.fillStyle = '#c8102e'; c.fillRect(0, 0, S, 18); c.fillRect(0, S - 18, S, 18);
    }],
    ['Wild Garden', 'Shona Fleming', 'A bright tumble of meadow flowers on fresh spring green.', function (c, r) {
      bg(c, '#a8e6cf');
      for (var i = 0; i < 120; i++) {
        var x = r() * S, y = r() * S; c.fillStyle = '#52b788'; c.beginPath(); c.ellipse(x + 20, y + 25, 22, 9, 0.6, 0, TAU); c.fill();
      }
      var cols = ['#ff6b6b', '#ffd93d', '#c77dff', '#ff8fab', '#4d96ff', '#ffffff', '#f77f00'];
      for (i = 0; i < 85; i++) {
        x = r() * S; y = r() * S; var s = 22 + r() * 26, n = 5 + Math.floor(r() * 4), col = pick(r, cols), rot = r();
        c.fillStyle = col;
        for (var k = 0; k < n; k++) { var a = rot + k / n * TAU; c.beginPath(); c.ellipse(x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7, s * 0.6, s * 0.3, a, 0, TAU); c.fill(); }
        dot(c, x, y, s * 0.32, '#ffb703'); dot(c, x, y, s * 0.15, '#9c6644');
      }
    }],
    ['Hogmanay', 'Gregor Campbell', 'Fireworks bursting over the Town Hall spire to welcome the New Year.', function (c, r) {
      c.fillStyle = vgrad(c, ['#05051a', '#1a1040', '#2d1b5a']); c.fillRect(0, 0, S, S);
      var cols = ['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0', '#fb5607', '#ffffff'];
      for (var i = 0; i < 16; i++) {
        var x = r() * S, y = r() * 750, rad = 60 + r() * 110, n = 24 + Math.floor(r() * 18), col = pick(r, cols);
        c.strokeStyle = col; c.lineWidth = 3;
        for (var k = 0; k < n; k++) {
          var a = k / n * TAU;
          c.globalAlpha = 0.8; line(c, x + Math.cos(a) * rad * 0.2, y + Math.sin(a) * rad * 0.2, x + Math.cos(a) * rad, y + Math.sin(a) * rad);
          c.globalAlpha = 1; dot(c, x + Math.cos(a) * rad, y + Math.sin(a) * rad, 4, col);
        }
        dot(c, x, y, 6, '#fff');
      }
      c.fillStyle = '#0a0a14';
      c.beginPath(); c.moveTo(0, S); c.lineTo(0, 900);
      [[120, 900], [120, 860], [260, 860], [260, 890], [420, 890], [420, 820], [470, 820], [470, 700], [492, 700], [512, 560], [532, 700], [554, 700], [554, 820], [604, 820], [604, 880], [760, 880], [760, 850], [900, 850], [900, 895], [1024, 895]].forEach(function (p) { c.lineTo(p[0], p[1]); });
      c.lineTo(S, S); c.fill();
      c.fillStyle = '#ffd166'; for (i = 0; i < 40; i++) c.fillRect(r() * S, 905 + r() * 100, 8, 12);
    }],
    ['Winter Westie', 'Ishbel Fraser', 'Delicate snowflakes drifting over an icy blue winter coat.', function (c, r) {
      c.fillStyle = vgrad(c, ['#dff1ff', '#6fa8dc']); c.fillRect(0, 0, S, S);
      for (var i = 0; i < 300; i++) dot(c, r() * S, r() * S, 1 + r() * 3, 'rgba(255,255,255,0.8)');
      c.strokeStyle = '#fff'; c.lineCap = 'round';
      for (i = 0; i < 55; i++) {
        var x = r() * S, y = r() * S, s = 20 + r() * 40;
        c.save(); c.translate(x, y); c.rotate(r()); c.lineWidth = 2 + s / 15;
        for (var k = 0; k < 6; k++) {
          c.rotate(TAU / 6); line(c, 0, 0, 0, -s);
          line(c, 0, -s * 0.5, s * 0.25, -s * 0.7); line(c, 0, -s * 0.5, -s * 0.25, -s * 0.7);
          line(c, 0, -s * 0.75, s * 0.15, -s * 0.9); line(c, 0, -s * 0.75, -s * 0.15, -s * 0.9);
        }
        c.restore();
      }
    }],
    ['Golden Boy', 'Moira Sinclair', 'A gleaming gold Westie, polished by thousands of pats for luck.', function (c, r) {
      var g = c.createLinearGradient(0, 0, S, S);
      ['#8a6a1c', '#f6e27a', '#b8902c', '#fff3b0', '#9c7a24', '#e8c860', '#7a5a14'].forEach(function (s, i, a) { g.addColorStop(i / (a.length - 1), s); });
      c.fillStyle = g; c.fillRect(0, 0, S, S);
      for (var i = 0; i < 2500; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(80,50,0,0.06)'; c.fillRect(r() * S, r() * S, 40 + r() * 160, 2); }
      c.strokeStyle = 'rgba(255,255,240,0.9)'; c.lineWidth = 2;
      for (i = 0; i < 30; i++) { var x = r() * S, y = r() * S, l = 6 + r() * 12; line(c, x - l, y, x + l, y); line(c, x, y - l, x, y + l); }
    }],
    ['Paisley Pattern', 'Elspeth Kerr', 'Swirling Paisley teardrops, a pattern woven in Scotland for two hundred years.', function (c, r) {
      bg(c, '#0f5257');
      var cols = [['#f4a261', '#e76f51'], ['#e9c46a', '#264653'], ['#f28482', '#84a59d'], ['#f6bd60', '#bc4749']];
      for (var i = 0; i < 20; i++) {
        var x = (i % 5) * 205 + 100 + (Math.floor(i / 5) % 2) * 100 - 50, y = Math.floor(i / 5) * 256 + 150, rot = r() * TAU, cp = cols[i % 4];
        paisleyShape(c, x, y, 120, rot); c.fillStyle = cp[0]; c.fill(); c.lineWidth = 5; c.strokeStyle = '#fff8e7'; c.stroke();
        paisleyShape(c, x, y, 80, rot); c.fillStyle = cp[1]; c.fill();
        paisleyShape(c, x, y, 45, rot); c.fillStyle = '#fff8e7'; c.fill();
        for (var k = 0; k < 10; k++) { var a = k / 10 * TAU; dot(c, x + Math.cos(a) * 95, y + Math.sin(a) * 95, 5, '#e9c46a'); }
      }
    }]
  ];

  var designs = D.map(function (d, i) {
    return {
      id: i, name: d[0], artist: d[1], blurb: d[2],
      paint: function (ctx, w, h) {
        ctx.save(); ctx.scale(w / S, h / S); d[3](ctx, rng(1000 + i * 7919)); ctx.restore();
      }
    };
  });

  function getDesign(id) {
    var d = designs[id];
    if (!d) throw new Error('WestieStatue: no design ' + id);
    return d;
  }

  function thumb(id, size) {
    size = size || 128;
    var cv = document.createElement('canvas'); cv.width = cv.height = size;
    getDesign(id).paint(cv.getContext('2d'), size, size);
    return cv.toDataURL('image/png');
  }

  function paintPlaque(cv, id) {
    var c = cv.getContext('2d'), d = getDesign(id);
    c.fillStyle = '#5b3a1a'; c.fillRect(0, 0, 512, 160);
    c.strokeStyle = '#d4a537'; c.lineWidth = 10; c.strokeRect(10, 10, 492, 140);
    c.fillStyle = '#f6dc8a'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 60px Georgia, serif'; c.fillText('No. ' + (id + 1 < 10 ? '0' : '') + (id + 1), 256, 62);
    c.font = 'italic 30px Georgia, serif'; c.fillText(d.name, 256, 118, 470);
  }


  var credit = '"Westie" 3D model by Ozyon (printables.com/model/1802492), licensed CC BY-NC 4.0; simplified and painted for the Westie Trail.';

  // Minimal GLB reader for our own model/westie.glb (one mesh: POSITION + indices). Avoids
  // needing GLTFLoader and works on file:// because the bytes are embedded as base64.
  function loadModel(b64) {
    try {
      var bin = atob(b64), u8 = new Uint8Array(bin.length), i;
      for (i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      var dv = new DataView(u8.buffer);
      if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
      var jl = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jl))), b0 = 28 + jl;
      var acc = function (k) {
        var a = json.accessors[k], bv = json.bufferViews[a.bufferView], off = b0 + (bv.byteOffset || 0) + (a.byteOffset || 0);
        var T = a.componentType === 5126 ? Float32Array : a.componentType === 5125 ? Uint32Array : Uint16Array;
        var n = a.count * (a.type === 'VEC3' ? 3 : 1);
        return new T(u8.buffer.slice(off, off + n * T.BYTES_PER_ELEMENT));
      };
      var pr = json.meshes[0].primitives[0], g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(acc(pr.attributes.POSITION), 3));
      g.setIndex(new THREE.BufferAttribute(acc(pr.indices), 1));
      // Source STL is Z-up: make Y up, long axis along x, head (tallest point = ears) facing +x.
      g.rotateX(-Math.PI / 2); g.computeBoundingBox();
      var bb = g.boundingBox;
      if (bb.max.z - bb.min.z > bb.max.x - bb.min.x) { g.rotateY(Math.PI / 2); g.computeBoundingBox(); bb = g.boundingBox; }
      var p = g.attributes.position, topI = 0;
      for (i = 1; i < p.count; i++) if (p.getY(i) > p.getY(topI)) topI = i;
      if (p.getX(topI) < (bb.min.x + bb.max.x) / 2) { g.rotateY(Math.PI); g.computeBoundingBox(); bb = g.boundingBox; }
      var sc = 2.1 / (bb.max.x - bb.min.x);
      g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); g.scale(sc, sc, sc);
      sideUV(g);
      g.computeVertexNormals();
      return g;
    } catch (e) {
      console.warn('WestieStatue: model failed to load, using primitive dog', e);
      return null;
    }
  }

  // Side-projection UVs so the design reads across the whole statue like a painted sculpture.
  function sideUV(g) {
    g.computeBoundingBox();
    var bb = g.boundingBox, p = g.attributes.position, i;
    var uv = new Float32Array(p.count * 2), w = bb.max.x - bb.min.x, h = bb.max.y;
    for (i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - bb.min.x) / w + p.getZ(i) * 0.12; uv[i * 2 + 1] = p.getY(i) / h; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  // Vertex-clustering decimation: snap vertices to a grid of `cells` along the longest side,
  // merge each cell to its average and drop collapsed triangles. Crude but fast and robust.
  function decimate(g, cells) {
    g.computeBoundingBox();
    var bb = g.boundingBox, p = g.attributes.position, idx = g.index.array, i;
    var cs = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) / cells;
    var keyToId = new Map(), remap = new Uint32Array(p.count), sum = [];
    for (i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      var key = Math.floor((x - bb.min.x) / cs) + Math.floor((y - bb.min.y) / cs) * 1024 + Math.floor((z - bb.min.z) / cs) * 1048576;
      var id = keyToId.get(key);
      if (id === undefined) { id = sum.length / 4; keyToId.set(key, id); sum.push(0, 0, 0, 0); }
      sum[id * 4] += x; sum[id * 4 + 1] += y; sum[id * 4 + 2] += z; sum[id * 4 + 3]++;
      remap[i] = id;
    }
    var n = sum.length / 4, pos = new Float32Array(n * 3), out = [];
    for (i = 0; i < n; i++) { pos[i * 3] = sum[i * 4] / sum[i * 4 + 3]; pos[i * 3 + 1] = sum[i * 4 + 1] / sum[i * 4 + 3]; pos[i * 3 + 2] = sum[i * 4 + 2] / sum[i * 4 + 3]; }
    for (i = 0; i < idx.length; i += 3) {
      var a = remap[idx[i]], b = remap[idx[i + 1]], c = remap[idx[i + 2]];
      if (a !== b && b !== c && a !== c) out.push(a, b, c);
    }
    var d = new THREE.BufferGeometry();
    d.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    d.setIndex(out);
    sideUV(d); d.computeVertexNormals();
    return d;
  }

  // Primitive Westie (fallback when the sculpted model is missing). Standing, facing +x,
  // feet at y=0. Each part is a reshaped sphere; `seg` sets sphere detail (56 in the viewer).
  function noise(v) { return Math.sin(v.x * 13.1 + v.z * 7.3) * Math.sin(v.y * 11.7 + v.x * 5.1) * Math.sin(v.z * 9.3 + v.y * 3.7); }
  function shag(k) { return function (v) { v.multiplyScalar(1 + k * noise(v)); }; }
  function primitiveDog(skin, black, seg) {
    var dog = new THREE.Group();
    function part(c, rad, rot, shape, mat) {
      var g = new THREE.SphereGeometry(1, seg, Math.round(seg * 5 / 7)), p = g.attributes.position, v = new THREE.Vector3(), i;
      for (i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); if (shape) shape(v);
        p.setXYZ(i, v.x * rad[0], v.y * rad[1], v.z * rad[2]);
      }
      if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])));
      g.translate(c[0], c[1], c[2]);
      g.computeVertexNormals();
      var uv = g.attributes.uv;
      for (i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.95) / 2.35 + p.getZ(i) * 0.12, p.getY(i) / 1.85);
      var m = new THREE.Mesh(g, mat || skin); m.castShadow = true; dog.add(m); return m;
    }
    // Body: level back, deep chest at the front, shaggy skirt hanging under the belly.
    part([0, 0.74, 0], [0.66, 0.3, 0.3], null, function (v) {
      if (v.y < 0) v.y *= 1 + 0.45 * Math.max(0, v.x + 0.3);              // deeper chest
      if (v.y < -0.2) v.y -= 0.22 * (0.6 + 0.4 * Math.sin(v.x * 31) * Math.sin(v.z * 23)); // fur fringe
      if (v.y > 0) v.y *= 0.85;                                         // flatter, level back
      v.multiplyScalar(1 + 0.03 * noise(v));
    });
    part([0.52, 1.06, 0], [0.17, 0.28, 0.2], [0, 0, -0.45], shag(0.04)); // neck/shoulders
    part([-0.48, 0.78, 0], [0.26, 0.24, 0.29], null, shag(0.04));         // rump

    [-1, 1].forEach(function (s) {
      // Front legs: short, straight, furry; small round paws.
      part([0.42, 0.32, s * 0.16], [0.095, 0.32, 0.095], null, function (v) { if (v.y < 0.5) v.multiplyScalar(1 + 0.12 * noise(v.clone().multiplyScalar(2))); });
      part([0.46, 0.045, s * 0.16], [0.11, 0.055, 0.095], null, null);
      // Rear legs: muscular thigh, gaskin angled back to a visible hock, upright pastern.
      part([-0.42, 0.62, s * 0.19], [0.24, 0.28, 0.11], [0, 0, -0.2], shag(0.05));
      part([-0.47, 0.32, s * 0.19], [0.085, 0.18, 0.08], [0, 0, -0.6], shag(0.06));
      part([-0.55, 0.12, s * 0.19], [0.065, 0.12, 0.065], [0, 0, 0.12], null);
      part([-0.51, 0.04, s * 0.19], [0.11, 0.05, 0.09], null, null);
      // Head detail: tufted cheeks, brows, small upright ears set wide.
      part([0.92, 1.3, s * 0.19], [0.15, 0.16, 0.13], null, shag(0.12));
      part([1.0, 1.52, s * 0.12], [0.09, 0.06, 0.08], [0, 0, -0.3], shag(0.1));
      part([0.72, 1.72, s * 0.2], [0.12, 0.17, 0.12], [s * 0.3, 0, 0], function (v) {
        var t = (v.y + 1) / 2; v.x *= 0.45 * (1 - t); v.z *= 1 - t * 0.98;     // flat pointed ear
      });
      part([1.085, 1.44, s * 0.12], [0.032, 0.04, 0.055], [s * 0.4, 0.35 * s, 0], null, black); // almond eyes
    });

    // Head: big round fur frame, then a short forward muzzle (~40% of head length) below a stop.
    part([0.78, 1.42, 0], [0.33, 0.31, 0.34], null, shag(0.07));
    part([1.08, 1.31, 0], [0.2, 0.12, 0.13], null, function (v) { if (v.x < 0) v.y += 0.15 * v.x; });
    part([1.02, 1.17, 0], [0.16, 0.12, 0.15], null, shag(0.15));       // beard
    part([1.27, 1.33, 0], [0.05, 0.045, 0.06], null, null, black);      // nose
    var mouth = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(1.17, 1.235, -0.07), new THREE.Vector3(1.26, 1.215, 0), new THREE.Vector3(1.17, 1.235, 0.07)), 12, 0.008, 6), black);
    dog.add(mouth);
    // Carrot tail: thick base, straight up.
    part([-0.63, 1.12, 0], [0.085, 0.2, 0.085], [0, 0, 0.2], function (v) { var t = (v.y + 1) / 2; v.x *= 1 - 0.8 * t; v.z *= 1 - 0.8 * t; });
    return dog;
  }

  // Lightweight painted dog for scenes with many statues (the game). One decimated model geometry
  // (or one low-poly primitive template) is built once and shared; each dog gets its own material.
  // opts: { texSize: 256, cells: 40 (decimation grid) }. Facing +x, feet at y=0, ~2.1 long.
  // group.userData.skin is the painted material (tweak emissive etc.).
  var shared = null;
  function makeDog(designId, opts) {
    opts = opts || {};
    var ts = opts.texSize || 256, cv = document.createElement('canvas'); cv.width = cv.height = ts;
    getDesign(designId).paint(cv.getContext('2d'), ts, ts);
    var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    var skin = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.02 });
    if (!shared) {
      var full = window.WESTIE_MODEL_B64 && loadModel(window.WESTIE_MODEL_B64);
      if (full) { shared = { geo: decimate(full, opts.cells || 40) }; full.dispose(); }
      else shared = { tpl: primitiveDog(skin, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 }), 14), skin: skin };
    }
    var g;
    if (shared.geo) { g = new THREE.Group(); var m = new THREE.Mesh(shared.geo, skin); m.castShadow = true; g.add(m); }
    else {
      g = shared.tpl.clone();
      g.traverse(function (o) { if (o.material === shared.skin) o.material = skin; });
    }
    g.userData.skin = skin;
    return g;
  }

  function mount(el, id) {
    // transparent canvas: the container's CSS background (street photo) shows behind the statue
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100); cam.position.set(2.6, 2.3, 5.3);
    var controls = new THREE.OrbitControls(cam, renderer.domElement);
    controls.target.set(0, 1.3, 0); controls.enableDamping = true; controls.enablePan = false;
    controls.minDistance = 3; controls.maxDistance = 14; controls.maxPolarAngle = Math.PI * 0.52; controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.75));
    var sun = new THREE.DirectionalLight(0xfff4e5, 0.75); sun.position.set(4, 9, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4; sun.shadow.bias = -0.0005;
    ['left', 'bottom'].forEach(function (k) { sun.shadow.camera[k] = -4; }); ['right', 'top'].forEach(function (k) { sun.shadow.camera[k] = 4; });
    scene.add(sun);
    var fill = new THREE.DirectionalLight(0xdde8ff, 0.35); fill.position.set(-5, 4, -3); scene.add(fill);

    var ground = new THREE.Mesh(new THREE.CircleGeometry(10, 48), new THREE.ShadowMaterial({ opacity: 0.35 })); // shadow only, no grey disc
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    // Plinth layers (base, block, cap) are stacked to this height; sized to the dog further down.
    var LAY = [[0.24, 0.13], [0, 0.42], [0.1, 0.08]], BEV = 0.015, top = 0;
    LAY.forEach(function (l) { top += l[1] + 2 * BEV; });

    var plaqueCv = document.createElement('canvas'); plaqueCv.width = 512; plaqueCv.height = 160;
    var plaqueTex = new THREE.CanvasTexture(plaqueCv); plaqueTex.encoding = THREE.sRGBEncoding;

    var cv = document.createElement('canvas'); cv.width = cv.height = S;
    var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    // Subtle fur relief shared by all designs (bump only, colour comes from the design).
    var furCv = document.createElement('canvas'); furCv.width = furCv.height = S;
    (function (c, r) {
      c.fillStyle = '#808080'; c.fillRect(0, 0, S, S); c.lineCap = 'round'; c.lineWidth = 2;
      for (var i = 0; i < 26000; i++) {
        var x = r() * S, y = r() * S, l = 6 + r() * 12, a = Math.PI / 2 + (r() - 0.5) * 0.9, g = Math.floor(70 + r() * 120);
        c.strokeStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
    })(furCv.getContext('2d'), rng(42));
    var furTex = new THREE.CanvasTexture(furCv);
    var skin = new THREE.MeshStandardMaterial({ map: tex, bumpMap: furTex, bumpScale: 0.012, roughness: 0.6, metalness: 0.02 });
    var black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });

    // Standing Westie, facing +x, feet at y=0. Each part is a reshaped high-res sphere;
    // UVs are a side projection in dog space so a design reads across the whole statue.
    var dog = new THREE.Group(); dog.position.set(-0.3, top, 0); dog.scale.setScalar(1.12); scene.add(dog);

    var model = window.WESTIE_MODEL_B64 && loadModel(window.WESTIE_MODEL_B64);
    if (model) {
      dog.position.set(0, top, 0); dog.scale.setScalar(1);
      var mm = new THREE.Mesh(model, skin); mm.castShadow = true; mm.receiveShadow = true; dog.add(mm);
    } else {
      // Fallback: primitive dog when model/westie-model.js is not loaded.
      dog.add(primitiveDog(skin, black, 56));
    }

    // Centre the dog's footprint on the plinth, then size the plinth to it with a small border.
    var box = new THREE.Box3().setFromObject(dog);
    dog.position.x -= (box.min.x + box.max.x) / 2; dog.position.z -= (box.min.z + box.max.z) / 2;
    var L = box.max.x - box.min.x + 0.35, W = box.max.z - box.min.z + 0.35;

    // Speckled granite texture for a dressed-stone look.
    var gCv = document.createElement('canvas'); gCv.width = gCv.height = 256;
    (function (c, r) {
      c.fillStyle = '#9a9a96'; c.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 9000; i++) {
        var g = Math.floor(60 + r() * 150), s = r() < 0.92 ? 1 : 2;
        c.fillStyle = 'rgba(' + g + ',' + g + ',' + (g - 4) + ',' + (0.35 + r() * 0.5) + ')'; c.fillRect(r() * 256, r() * 256, s, s);
      }
    })(gCv.getContext('2d'), rng(7));
    var gTex = new THREE.CanvasTexture(gCv); gTex.encoding = THREE.sRGBEncoding;
    gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping; gTex.repeat.set(1.5, 1.5);
    var stone = new THREE.MeshStandardMaterial({ map: gTex, bumpMap: gTex, bumpScale: 0.004, roughness: 0.78 });

    function slab(w, d, h, y) {
      var r = 0.04, s = new THREE.Shape(), x0 = -w / 2, z0 = -d / 2;
      s.moveTo(x0 + r, z0); s.lineTo(x0 + w - r, z0); s.quadraticCurveTo(x0 + w, z0, x0 + w, z0 + r);
      s.lineTo(x0 + w, z0 + d - r); s.quadraticCurveTo(x0 + w, z0 + d, x0 + w - r, z0 + d);
      s.lineTo(x0 + r, z0 + d); s.quadraticCurveTo(x0, z0 + d, x0, z0 + d - r);
      s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
      var g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 2, curveSegments: 4 });
      g.rotateX(-Math.PI / 2);
      var m = new THREE.Mesh(g, stone); m.position.y = y + BEV; m.castShadow = m.receiveShadow = true; scene.add(m);
    }
    var y = 0, blockMid = 0;
    LAY.forEach(function (l, i) { if (i === 1) blockMid = y + BEV + l[1] / 2; slab(L + l[0], W + l[0], l[1], y); y += l[1] + 2 * BEV; });

    // Brass plaque set on the block's front face.
    var pw = Math.min(1.0, L * 0.62);
    var plaque = new THREE.Mesh(new THREE.BoxGeometry(pw, pw * 0.31, 0.02), [0, 0, 0, 0, 1, 0].map(function (k) {
      return k ? new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.35, metalness: 0.4 }) : new THREE.MeshStandardMaterial({ color: 0xa8822e, roughness: 0.35, metalness: 0.8 });
    }));
    plaque.position.set(0, blockMid, W / 2 + BEV + 0.01); scene.add(plaque);

    function setDesign(n) {
      var d = getDesign(n);
      var c = cv.getContext('2d'); c.clearRect(0, 0, S, S); d.paint(c, S, S); tex.needsUpdate = true;
      paintPlaque(plaqueCv, n); plaqueTex.needsUpdate = true;
    }
    setDesign(id || 0);

    function resize() {
      var w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    resize();
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(el); else window.addEventListener('resize', resize);

    var raf = 0;
    (function loop() { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, cam); })();

    return {
      setDesign: setDesign,
      // Render design n and return a transparent PNG dataURL (read right after render, so no preserveDrawingBuffer needed).
      snap: function (n) {
        setDesign(n); resize(); controls.update(); renderer.render(scene, cam);
        return renderer.domElement.toDataURL('image/png');
      },
      dispose: function () {
        cancelAnimationFrame(raf);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        controls.dispose();
        scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); [].concat(o.material || []).forEach(function (m) { m.dispose(); }); });
        tex.dispose(); furTex.dispose(); plaqueTex.dispose(); renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }

  window.WestieStatue = { designs: designs, thumb: thumb, mount: mount, makeDog: makeDog, credit: credit };

  // Self-check
  console.assert(designs.length === 30, 'WestieStatue: expected 30 designs, got ' + designs.length);
  var seen = {};
  designs.forEach(function (d, i) {
    console.assert(d.id === i && !seen[d.id], 'WestieStatue: bad or duplicate id ' + d.id);
    console.assert(d.name && d.artist && d.blurb && typeof d.paint === 'function', 'WestieStatue: incomplete design ' + i);
    seen[d.id] = true;
  });
})();
