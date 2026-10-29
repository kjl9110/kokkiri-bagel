(() => {
  const N = 239, FPS_SRC = 24, DUR = 23.875;
  const BG = [246, 232, 210];
  const hero = document.getElementById('hero');
  const stage = document.getElementById('stage');
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const beats = [...document.querySelectorAll('.beat')];
  const tcEl = document.getElementById('tc');
  const tcBar = document.getElementById('tcBar');
  const loader = document.getElementById('loader');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const frames = new Array(N);
  let loadedCount = 0;
  const src = i => 'seq/' + String(i + 1).padStart(3, '0') + '.webp';
  function load(i) {
    return new Promise(res => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { frames[i] = im; lastKey = ''; loadedCount++; loader.style.transform = `scaleX(${loadedCount / N})`; if (loadedCount === N) loader.style.opacity = 0; res(); };
      im.onerror = res;
      im.src = src(i);
    });
  }
  (async () => {
    await load(0); lastKey = ''; draw();
    const order = [];
    for (let step = 16; step >= 1; step = Math.floor(step / 2)) {
      for (let i = 0; i < N; i += step) if (!order.includes(i) && i !== 0) order.push(i);
      if (step === 1) break;
    }
    let k = 0;
    const worker = async () => { while (k < order.length) { const i = order[k++]; await load(i); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
  })();

  function nearest(i) {
    if (frames[i]) return frames[i];
    for (let d = 1; d < N; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  }

  let W = 0, H = 0, dpr = 1;
  const EXP = 0.2;
  const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  // Video holds on frame 1 while the crumb grows (so the cut-out stays pixel-aligned), then plays
  const fp = p => p < EXP ? 0 : p < 0.36 ? (p - EXP) / (0.36 - EXP) * 0.16 : 0.16 + (p - 0.36) / 0.64 * 0.84;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    lastKey = '';
    draw();
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  let curP = 0, lastKey = '';
  // Background-free crumb matched to frame 1: affine transform from cut-out pixels into 1280x720 frame space (SIFT fit)
  const CUT = { a: 1.51109, b: 0.23869, c: -0.23869, d: 1.51109, e: 148.08, f: -41.97 };
  const startCut = new Image();
  startCut.onload = () => { lastKey = ''; };
  startCut.src = 'img/bagel-start.webp';
  // Press-to-squish: while the on-screen cursor sits near the middle of the crumb (frames 18–28), holding the pointer pushes the video toward the deepest dent frame
  const PRESS_F = 25, PRESS_IN = 18, PRESS_OUT = 28;
  let press = 0, pressV = 0, pressing = false, px = 0, py = 0;
  const canPress = () => ease(curP / EXP) >= 1 && fp(curP) * (N - 1) > PRESS_IN && fp(curP) * (N - 1) < PRESS_OUT;
  function draw() {
    if (!W) return;
    const f = lerp(fp(curP) * (N - 1), PRESS_F, Math.max(0, Math.min(1, press)));
    const key = curP.toFixed(4) + press.toFixed(4) + W + 'x' + H;
    if (key === lastKey) return;
    const i = Math.floor(f), frac = f - i;
    const a = nearest(i);
    if (!a) return;
    lastKey = key;

    const e = ease(curP / EXP);
    const portrait = W / H < 1.05;
    const sw = portrait ? Math.min(W * 0.78, H * 0.36) : Math.min(W * 0.34, 600);
    const sh = portrait ? sw * 0.78 : sw * 0.62;
    const w = lerp(sw, W, e), h = lerp(sh, H, e);
    const cx = lerp(W * (portrait ? 0.5 : 0.475), W / 2, e);
    const cy = lerp(H * (portrait ? 0.74 : 0.73), H / 2, e);
    const rot = lerp(-11, 0, e) * Math.PI / 180;
    const rad = lerp(portrait ? 22 : 30, 0, e);

    // Only the cut-out crumb shows while it grows; the video background fades in once it nearly fills the screen
    const bgA = ease((e - 0.8) / 0.2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    if (e < 1 && bgA > 0) {
      ctx.save();
      ctx.globalAlpha = bgA;
      ctx.shadowColor = 'rgba(80,14,0,.35)';
      ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
      ctx.fillStyle = `rgb(${BG})`;
      rr(-w / 2, -h / 2, w, h, rad); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = bgA;
    rr(-w / 2, -h / 2, w, h, rad); ctx.clip();
    ctx.fillStyle = `rgb(${BG})`;
    ctx.fillRect(-w / 2, -h / 2, w, h);

    const cover = Math.max(w / 1280, h / 720);
    const s = portrait ? Math.min(cover, (W * (W < 600 ? 2.15 : 1.75)) / 1280 * lerp(1.35, 1, e)) : cover;
    const iw = 1280 * s, ih = 720 * s;
    const pp = fp(curP);
    const shift = portrait ? H * (0.04 - 0.15 * ease((pp - 0.12) / 0.12)) * e : 0;
    const ix = -iw / 2, iy = -ih / 2 + shift;
    if (press) {
      const ox = px - cx, oy = py - cy;
      ctx.translate(ox, oy);
      if (press > 0) ctx.scale(1 + press * 0.045, 1 + press * 0.015);
      else ctx.scale(1 - press * 0.02, 1 - press * 0.045);
      ctx.translate(-ox, -oy);
    }
    ctx.drawImage(a, ix, iy, iw, ih);
    const b = frames[i + 1];
    if (b && frac > 0.02) { ctx.globalAlpha = frac * bgA; ctx.drawImage(b, ix, iy, iw, ih); ctx.globalAlpha = bgA; }
    if (portrait && ih < h) {
      const fade = ih * 0.28;
      let gr = ctx.createLinearGradient(0, iy, 0, iy + fade);
      gr.addColorStop(0, `rgba(${BG},1)`); gr.addColorStop(1, `rgba(${BG},0)`);
      ctx.fillStyle = gr; ctx.fillRect(-w / 2, iy - 1, w, fade + 1);
      gr = ctx.createLinearGradient(0, iy + ih - fade, 0, iy + ih);
      gr.addColorStop(0, `rgba(${BG},0)`); gr.addColorStop(1, `rgba(${BG},1)`);
      ctx.fillStyle = gr; ctx.fillRect(-w / 2, iy + ih - fade, w, fade + 1);
    }
    ctx.restore();
    if (bgA < 1 && startCut.complete && startCut.naturalWidth) {
      const drawCut = () => {
        ctx.translate(ix, iy); ctx.scale(s, s);
        ctx.transform(CUT.a, CUT.b, CUT.c, CUT.d, CUT.e, CUT.f);
        ctx.drawImage(startCut, 0, 0);
      };
      // Whole crumb fades out as the card takes over…
      ctx.save();
      ctx.globalAlpha = 1 - bgA;
      // Soft, and gone well before the background arrives, so the gap under the crumb never reads as a dark hole
      ctx.shadowColor = `rgba(80,14,0,${(0.22 * (1 - ease(e / 0.7))).toFixed(3)})`;
      ctx.shadowBlur = 36; ctx.shadowOffsetY = 14;
      drawCut();
      ctx.restore();
      // …while the part inside the card stays solid, so the bread never turns see-through
      if (bgA > 0) {
        ctx.save();
        rr(-w / 2, -h / 2, w, h, rad); ctx.clip();
        drawCut();
        ctx.restore();
      }
    }
  }

  function heroProgress() {
    const r = hero.getBoundingClientRect();
    const total = hero.offsetHeight - stage.clientHeight;
    return Math.max(0, Math.min(1, -r.top / total));
  }

  function updateBeats(p) {
    beats.forEach(el => {
      const a = +el.dataset.in, b = +el.dataset.out, fade = 0.04;
      let o = Math.min(ease((p - a) / fade), 1 - ease((p - (b - fade)) / fade));
      o = Math.max(0, Math.min(1, o));
      el.style.opacity = o;
      el.style.translate = `0 ${(1 - o) * 24}px`;
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    });
  }

  function timecode(p) {
    const t = p * DUR;
    const s = Math.floor(t), fr = Math.floor((t - s) * FPS_SRC);
    const pad = n => String(n).padStart(2, '0');
    tcEl.textContent = `00:00:${pad(s)}:${pad(fr)}`;
    tcBar.style.transform = `scaleX(${p})`;
  }

  const hdr = document.getElementById('hdr');
  const htype = document.getElementById('htype');
  const hcut = document.getElementById('hcut');
  const hcutImg = hcut.querySelector('img');
  const squish = () => { if (reduce) return; hcutImg.classList.remove('squish'); void hcutImg.offsetWidth; hcutImg.classList.add('squish'); };
  hcutImg.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') squish(); });
  hcutImg.addEventListener('click', squish);
  hcutImg.addEventListener('animationend', e => { if (e.animationName === 'squish') hcutImg.classList.remove('squish'); });
  const toTop = document.getElementById('toTop');
  toTop.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.querySelector('.hdr a, .hdr button').focus({ preventScroll: true });
  });
  const cue = document.getElementById('cue');
  // Desktop: SCROLL sits halfway between "centred on the headline lockup (logo → BAGELS)" and
  // "resting on the bottom edge"; phones: just below BAGELS (beside it would hit the ring).
  // Offsets ignore the headline's scroll scale.
  const hLogo = document.querySelector('.h-logo'), hl3 = document.querySelector('.h-l3');
  function placeCue() {
    const top = hLogo.offsetTop, bottom = hl3.offsetTop + hl3.offsetHeight, ch = cue.offsetHeight;
    const centred = (top + bottom) / 2 - ch / 2, resting = stage.clientHeight - 36 - ch;
    cue.style.top = Math.round(innerWidth <= 820 ? bottom + 28 : (centred + resting) / 2) + 'px';
    cue.style.bottom = 'auto';
  }
  addEventListener('resize', placeCue);
  document.fonts.ready.then(placeCue);
  placeCue();
  const tcWrap = document.getElementById('tcWrap');
  const sw = document.getElementById('stretchWord');
  const stretch = document.getElementById('stretch');
  function stretchUpdate() {
    const r = stretch.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight * 0.9)));
    sw.style.setProperty('--p', ease(p).toFixed(3));
  }

  function tick() {
    const p = heroProgress();
    curP = reduce ? p : curP + (p - curP) * 0.07;
    if (Math.abs(p - curP) < 0.0002) curP = p;
    if (pressing && !canPress()) pressing = false;
    if (pressing || press || pressV) {
      pressV += ((pressing ? 1 : 0) - press) * 0.05 - pressV * 0.16;
      press += pressV;
      if (!pressing && Math.abs(press) < 0.001 && Math.abs(pressV) < 0.001) press = pressV = 0;
    }
    stage.classList.toggle('pressable', canPress());
    draw();
    const e = ease(curP / EXP);
    htype.style.transform = `scale(${1 + e * 0.12})`;
    htype.style.opacity = 1 - ease((curP - EXP * 0.55) / (EXP * 0.45));
    hcut.style.visibility = e > 0.98 ? 'hidden' : '';
    // Gone (sliding down) before the growing headline ring can reach it
    const cueOut = ease(e / 0.22);
    cue.style.opacity = 1 - cueOut;
    cue.style.transform = `translate(50%, ${cueOut * 28}px)`;
    tcWrap.style.opacity = e;
    updateBeats(curP);
    timecode(fp(curP));
    hdr.classList.toggle('solid', hero.getBoundingClientRect().bottom < 90);
    hdr.classList.toggle('on-light', e > 0.5 || hero.getBoundingClientRect().bottom < 90);
    const docMax = document.documentElement.scrollHeight - innerHeight;
    toTop.classList.toggle('show', scrollY > innerHeight * 1.2 && !hdr.classList.contains('menu-open'));
    toTop.style.setProperty('--prog', docMax > 0 ? (scrollY / docMax * 100).toFixed(1) : 0);
    stretchUpdate();
    requestAnimationFrame(tick);
  }

  stage.addEventListener('pointerdown', e => {
    if (!canPress() || e.button > 0) return;
    const r = stage.getBoundingClientRect();
    px = e.clientX - r.left; py = e.clientY - r.top;
    pressing = true;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => stage.addEventListener(t, () => { pressing = false; }));

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(tick);

  const menuBtn = document.getElementById('menuBtn');
  const nav = document.getElementById('nav');
  const setNav = open => { nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', open); menuBtn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기'); document.body.style.overflow = open ? 'hidden' : ''; hdr.classList.toggle('menu-open', open); };
  menuBtn.addEventListener('click', () => setNav(!nav.classList.contains('open')));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setNav(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });

  const form = document.getElementById('form');
  const fields = document.getElementById('formFields');
  const done = document.getElementById('done');
  const msg = document.getElementById('formMsg');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.fname.value.trim(), email = form.femail.value.trim();
    if (!name) { msg.textContent = '이름을 적어 주세요.'; form.fname.focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = '이메일 주소를 확인해 주세요. 예) you@example.com'; form.femail.focus(); return; }
    if (!form.fagree.checked) { msg.textContent = '개인정보 수집에 동의해 주세요.'; return; }
    fields.hidden = true; done.hidden = false;
  });
  document.getElementById('again').addEventListener('click', () => { form.reset(); fields.hidden = false; done.hidden = true; msg.textContent = '시안용 폼이라 실제로 전송되지는 않아요.'; });

  // Event poster modal
  const evLinks = [...document.querySelectorAll('.ev a')];
  const modal = document.getElementById('evModal');
  const mImg = document.getElementById('evModalImg'), mTag = document.getElementById('evModalTag');
  const mTitle = document.getElementById('evModalTitle'), mCount = document.getElementById('evModalCount');
  let evIdx = 0;
  function showEv(i) {
    evIdx = (i + evLinks.length) % evLinks.length;
    const a = evLinks[evIdx], img = a.querySelector('img'), tag = a.querySelector('.ev-tag');
    mImg.src = img.src; mImg.alt = img.alt;
    mTag.className = tag.className; mTag.textContent = tag.textContent;
    mTitle.textContent = a.querySelector('b').textContent;
    mCount.textContent = `${evIdx + 1} / ${evLinks.length}`;
  }
  evLinks.forEach((a, i) => a.addEventListener('click', e => {
    e.preventDefault();
    showEv(i);
    modal.showModal();
    document.body.style.overflow = 'hidden';
  }));
  modal.addEventListener('close', () => { document.body.style.overflow = ''; evLinks[evIdx].focus(); });
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
  modal.querySelector('.ev-close').addEventListener('click', () => modal.close());
  modal.querySelector('.ev-nav.prev').addEventListener('click', () => showEv(evIdx - 1));
  modal.querySelector('.ev-nav.next').addEventListener('click', () => showEv(evIdx + 1));
  modal.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') showEv(evIdx - 1);
    if (e.key === 'ArrowRight') showEv(evIdx + 1);
  });

  // Notice accordion
  document.querySelectorAll('.nt-row').forEach(row => {
    const btn = row.querySelector('.nt-toggle');
    const body = document.getElementById(btn.getAttribute('aria-controls'));
    row.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open);
      body.hidden = !open;
    });
  });

  // Copy address
  const copyBtn = document.getElementById('copyAddr');
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(copyBtn.dataset.addr); } catch { return; }
    copyBtn.textContent = '복사됐어요'; copyBtn.classList.add('ok');
    setTimeout(() => { copyBtn.textContent = '주소 복사'; copyBtn.classList.remove('ok'); }, 1600);
  });

  // Bagel that trails the mouse pointer, rolling as it goes
  const follow = document.getElementById('follow');
  if (matchMedia('(pointer: fine)').matches && !reduce) {
    const OX = 22, OY = 24;  // sit below-right of the arrow so it never covers the tip
    const CLICKABLE = 'a, button, label, summary, select, [role="button"], input[type="checkbox"], input[type="radio"], .nt-row, .stage.pressable, .h-cut img';
    let tx = 0, ty = 0, fx = 0, fy = 0, rot = 0, squash = 0, running = false;
    function fstep() {
      const dx = (tx - fx) * 0.18, dy = (ty - fy) * 0.18;
      fx += dx; fy += dy;
      rot += dx * 2.2;
      squash *= 0.82;
      follow.style.transform = `translate3d(${fx}px, ${fy}px, 0) rotate(${rot}deg) scale(${1 + squash * 0.25}, ${1 - squash * 0.3})`;
      if (Math.abs(tx - fx) + Math.abs(ty - fy) > 0.3 || squash > 0.01) requestAnimationFrame(fstep);
      else running = false;
    }
    const kick = () => { if (!running) { running = true; requestAnimationFrame(fstep); } };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX + OX; ty = e.clientY + OY;
      if (!follow.classList.contains('on')) { fx = tx; fy = ty; follow.classList.add('on'); }
      follow.classList.toggle('hover', !!e.target.closest(CLICKABLE));
      kick();
    }, { passive: true });
    addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { squash = 1; kick(); } });
    document.documentElement.addEventListener('mouseleave', () => follow.classList.remove('on'));
  }

  // Bagels wandering around the footer (behind its content; only animated while visible)
  const fb = document.getElementById('ftrBagels');
  if (!reduce) {
    const COUNT = innerWidth < 600 ? 6 : 11;
    const items = [];
    let fw = 0, fh = 0, ftrOn = false, fLast = 0;
    const fsize = () => { fw = fb.clientWidth; fh = fb.clientHeight; };
    fsize();
    for (let n = 0; n < COUNT; n++) {
      const el = new Image();
      el.src = 'img/bagel-follow.svg'; el.alt = '';
      const s = 26 + Math.random() ** 1.5 * 54;
      el.width = el.height = Math.round(s);
      fb.appendChild(el);
      const a = Math.random() * 6.283, v = 18 + Math.random() * 26;
      items.push({ el, s, x: Math.random() * (fw - s), y: Math.random() * (fh - s), vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        r: Math.random() * 360, vr: (Math.random() - .5) * 60, wob: Math.random() * 6.283 });
    }
    function floop(now) {
      if (!ftrOn) return;
      const dt = Math.min((now - (fLast || now)) / 1000, .05); fLast = now;
      for (const b of items) {
        b.wob += dt * .8;
        // gentle meandering: slowly turn the heading
        const turn = Math.sin(b.wob) * .6 * dt, c = Math.cos(turn), sn = Math.sin(turn);
        [b.vx, b.vy] = [b.vx * c - b.vy * sn, b.vx * sn + b.vy * c];
        b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); } else if (b.x > fw - b.s) { b.x = fw - b.s; b.vx = -Math.abs(b.vx); }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); } else if (b.y > fh - b.s) { b.y = fh - b.s; b.vy = -Math.abs(b.vy); }
        b.el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.r}deg)`;
      }
      requestAnimationFrame(floop);
    }
    new IntersectionObserver(([en]) => {
      ftrOn = en.isIntersecting;
      if (ftrOn) { fsize(); fLast = 0; requestAnimationFrame(floop); }
    }).observe(fb);
    addEventListener('resize', fsize);
  }
})();
