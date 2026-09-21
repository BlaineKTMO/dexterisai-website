/* Dexteris AI — interaction + hero canvas */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- theme ---------- */
  var themeBtn = document.getElementById('theme');
  themeBtn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('dx-theme', next); } catch (e) {}
    readPalette();
  });

  /* ---------- mobile menu ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  burger.addEventListener('click', function () {
    var open = nav.getAttribute('data-open') === 'true';
    nav.setAttribute('data-open', String(!open));
    burger.setAttribute('aria-expanded', String(!open));
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      nav.setAttribute('data-open', 'false');
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  /* ---------- header state + active link ---------- */
  var header = document.getElementById('header');
  var links = [].slice.call(nav.querySelectorAll('a'));
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });

  function onScroll() {
    header.classList.toggle('is-stuck', window.scrollY > 24);
    var y = window.scrollY + window.innerHeight * 0.32;
    var current = -1;
    sections.forEach(function (s, i) { if (s && s.offsetTop <= y) current = i; });
    links.forEach(function (a, i) { a.classList.toggle('is-active', i === current); });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- scroll reveal ----------
     Everything is visible by default. We only arm the elements that start below
     the fold, so the first paint — and any screenshot of it — is complete. */
  var reveals = [].slice.call(document.querySelectorAll('.rv'));
  if (!reduce.matches && 'IntersectionObserver' in window) {
    var fold = window.innerHeight * 0.92;
    var armed = reveals.filter(function (el) {
      return el.getBoundingClientRect().top > fold;
    });
    armed.forEach(function (el) { el.setAttribute('data-armed', ''); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var group = [].slice.call(entry.target.parentNode.children).filter(function (c) {
          return c.hasAttribute('data-armed');
        });
        var i = Math.max(0, group.indexOf(entry.target));
        entry.target.style.transitionDelay = Math.min(i * 70, 350) + 'ms';
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    armed.forEach(function (el) { io.observe(el); });
  }

  /* ---------- contact form → mail client ---------- */
  var form = document.getElementById('form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = function (id) { return (document.getElementById(id).value || '').trim(); };
    if (!v('f-name') || !v('f-email') || !v('f-msg')) {
      document.getElementById('form-note').textContent =
        'Name, email, and a line about the robot, please.';
      return;
    }
    var body = [
      'Name: ' + v('f-name'),
      'Email: ' + v('f-email'),
      'Organisation: ' + (v('f-org') || '—'),
      'Stage: ' + v('f-stage'),
      '',
      v('f-msg')
    ].join('\n');
    location.href = 'mailto:blaine@dexterisai.com'
      + '?subject=' + encodeURIComponent('Project enquiry — ' + (v('f-org') || v('f-name')))
      + '&body=' + encodeURIComponent(body);
  });

  document.getElementById('yr').textContent = String(new Date().getFullYear());

  /* ======================================================================
     Hero canvas — the logo as a two-link arm reaching for targets,
     over a slow field of nodes and travelling signals.
     ====================================================================== */
  var canvas = document.getElementById('chain');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1;
  var pal = {};

  function readPalette() {
    var cs = getComputedStyle(root);
    pal.brand = cs.getPropertyValue('--brand').trim() || '#e8703a';
    pal.navy = cs.getPropertyValue('--navy').trim() || '#3a5d80';
    pal.ink3 = cs.getPropertyValue('--ink-3').trim() || '#8593a4';
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* --- background node field --- */
  var nodes = [];
  function seedNodes() {
    nodes = [];
    var n = W < 380 ? 14 : 22;
    for (var i = 0; i < n; i++) {
      nodes.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.00022,
        vy: (Math.random() - 0.5) * 0.00022,
        r: 1.1 + Math.random() * 1.6
      });
    }
  }

  /* --- arm ---
     Targets are stored as fractions of the stage so they survive a resize. */
  var base, L1, L2, target, t0 = 0, grip = 0, trail = [];
  var spotsN = [
    { x: 0.72, y: 0.24 }, { x: 0.80, y: 0.52 }, { x: 0.46, y: 0.17 },
    { x: 0.66, y: 0.68 }, { x: 0.83, y: 0.36 }, { x: 0.40, y: 0.40 }
  ];
  var goalN = spotsN[0];

  /* --- pointer control ---
     Click or drag inside the stage to aim the arm. It hands itself back to its
     own routine after a few seconds without input. */
  var manual = false, dragging = false, lastInput = 0;
  var modeEl = document.getElementById('mode');

  function setMode(text) {
    if (!modeEl) return;
    modeEl.textContent = text;
    modeEl.style.color = text === 'manual' ? 'var(--brand)' : '';
  }

  function aim(e) {
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    goalN = {
      x: Math.max(0.05, Math.min(0.95, (e.clientX - r.left) / r.width)),
      y: Math.max(0.05, Math.min(0.95, (e.clientY - r.top) / r.height))
    };
    lastInput = performance.now();
    if (!manual) { manual = true; setMode('manual'); }
    if (reduce.matches) {
      target.x = goalN.x * W; target.y = goalN.y * H;
      draw(lastInput);
    }
  }

  canvas.addEventListener('pointerdown', function (e) {
    aim(e);
    // Drag-to-track on mouse and pen only — on touch a drag has to stay a scroll.
    if (e.pointerType !== 'touch') {
      dragging = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });
  canvas.addEventListener('pointermove', function (e) { if (dragging) aim(e); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
    canvas.addEventListener(type, function (e) {
      dragging = false;
      try {
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
    });
  });

  function layout() {
    base = { x: W * 0.26, y: H * 0.78 };
    L1 = Math.min(W, H) * 0.40;
    L2 = Math.min(W, H) * 0.355;
    target = { x: goalN.x * W, y: goalN.y * H };
    trail = [];
  }

  function solve(tx, ty) {
    var dx = tx - base.x, dy = ty - base.y;
    var d = Math.hypot(dx, dy);
    var max = (L1 + L2) * 0.999, min = Math.abs(L1 - L2) * 1.001 + 1;
    if (d > max) { d = max; } else if (d < min) { d = min; }
    var a = Math.atan2(dy, dx);
    var cosB = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
    var b = Math.acos(Math.max(-1, Math.min(1, cosB)));
    var s1 = a - b; // elbow-up
    return {
      elbow: { x: base.x + Math.cos(s1) * L1, y: base.y + Math.sin(s1) * L1 },
      end: { x: base.x + Math.cos(a) * d, y: base.y + Math.sin(a) * d }
    };
  }

  function hex(c, a) {
    var h = c.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function reticle(x, y, r, live) {
    ctx.strokeStyle = hex(live ? pal.brand : pal.ink3, live ? 0.8 : 0.26);
    ctx.lineWidth = live ? 1.6 : 1.2;
    var arm = Math.max(4, r * 0.55);
    ctx.beginPath();
    ctx.moveTo(x - r, y - r); ctx.lineTo(x - r, y - r + arm);
    ctx.moveTo(x - r, y - r); ctx.lineTo(x - r + arm, y - r);
    ctx.moveTo(x + r, y + r); ctx.lineTo(x + r, y + r - arm);
    ctx.moveTo(x + r, y + r); ctx.lineTo(x + r - arm, y + r);
    ctx.stroke();
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);

    /* node field + edges */
    nodes.forEach(function (p) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > 1) p.vx *= -1;
      if (p.y < 0 || p.y > 1) p.vy *= -1;
    });
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var dx = (a.x - b.x) * W, dy = (a.y - b.y) * H;
        var d = Math.hypot(dx, dy);
        if (d < W * 0.22) {
          ctx.strokeStyle = hex(pal.ink3, 0.16 * (1 - d / (W * 0.22)));
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x * W, a.y * H);
          ctx.lineTo(b.x * W, b.y * H);
          ctx.stroke();
        }
      }
    }
    nodes.forEach(function (p, k) {
      var pulse = 0.5 + 0.5 * Math.sin(now / 900 + k);
      ctx.fillStyle = hex(pal.ink3, 0.18 + pulse * 0.16);
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, 6.2832);
      ctx.fill();
    });

    /* hand control back after a few quiet seconds */
    if (manual && !dragging && now - lastInput > 3800) {
      manual = false; t0 = now; setMode('auto');
    }
    /* otherwise pick a new target on its own */
    if (!manual && now - t0 > 2600) {
      t0 = now;
      var next = goalN;
      while (next === goalN) next = spotsN[(Math.random() * spotsN.length) | 0];
      goalN = next;
    }

    var goal = { x: goalN.x * W, y: goalN.y * H };
    target.x += (goal.x - target.x) * (manual ? 0.11 : 0.045);
    target.y += (goal.y - target.y) * (manual ? 0.11 : 0.045);

    var reached = Math.hypot(goal.x - target.x, goal.y - target.y) < Math.min(W, H) * 0.02;
    grip += ((reached ? 1 : 0) - grip) * 0.08;

    var arm = solve(target.x, target.y);

    /* end-effector trail */
    trail.push({ x: arm.end.x, y: arm.end.y });
    if (trail.length > 46) trail.shift();
    ctx.lineCap = 'round';
    for (var t = 1; t < trail.length; t++) {
      ctx.strokeStyle = hex(pal.brand, (t / trail.length) * 0.22);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trail[t - 1].x, trail[t - 1].y);
      ctx.lineTo(trail[t].x, trail[t].y);
      ctx.stroke();
    }

    /* the arm's own candidate targets, dim while you have the controls */
    spotsN.forEach(function (s) {
      if (s === goalN) return;
      reticle(s.x * W, s.y * H, 6, false);
    });
    /* the live target */
    reticle(goal.x, goal.y, 9 + grip * 3, true);

    /* the rail — the navy stroke from the mark */
    ctx.strokeStyle = hex(pal.navy, 0.85);
    ctx.lineWidth = Math.max(5, Math.min(W, H) * 0.028);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(base.x + Math.min(W, H) * 0.045, base.y);
    ctx.lineTo(base.x + Math.min(W, H) * 0.34, base.y);
    ctx.stroke();

    /* links */
    var lw = Math.max(5, Math.min(W, H) * 0.028);
    ctx.strokeStyle = pal.brand;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(arm.elbow.x, arm.elbow.y);
    ctx.lineTo(arm.end.x, arm.end.y);
    ctx.stroke();

    /* elbow joint */
    ctx.fillStyle = hex(pal.brand, 0.25);
    ctx.beginPath();
    ctx.arc(arm.elbow.x, arm.elbow.y, lw * 0.85, 0, 6.2832);
    ctx.fill();

    /* base joint — the filled node */
    ctx.fillStyle = pal.brand;
    ctx.beginPath();
    ctx.arc(base.x, base.y, Math.min(W, H) * 0.045, 0, 6.2832);
    ctx.fill();

    /* end effector — the open ring */
    var er = Math.min(W, H) * 0.072 - grip * Math.min(W, H) * 0.014;
    ctx.strokeStyle = pal.brand;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(arm.end.x, arm.end.y, er, 0, 6.2832);
    ctx.stroke();

    if (reached) {
      ctx.strokeStyle = hex(pal.brand, 0.3 * grip);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(arm.end.x, arm.end.y, er + 10 + grip * 8, 0, 6.2832);
      ctx.stroke();
    }
  }

  var raf = 0;
  function loop(now) { draw(now); raf = requestAnimationFrame(loop); }

  function start() {
    resize(); seedNodes(); layout(); readPalette();
    cancelAnimationFrame(raf);
    if (reduce.matches) { draw(0); return; }
    raf = requestAnimationFrame(loop);
  }

  var rt;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(start, 150);
  });

  /* pause when the tab is hidden */
  document.addEventListener('visibilitychange', function () {
    cancelAnimationFrame(raf);
    if (!document.hidden && !reduce.matches) raf = requestAnimationFrame(loop);
  });

  start();
})();
