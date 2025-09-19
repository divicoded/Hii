// ===============================
// UTILITIES & INITIALIZATION
// ===============================
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

// DOM Elements
const timeEl = $('time'), dateEl = $('date'), greetingEl = $('greeting'), greetingSubtitleEl = $('greetingSubtitle');
const seasonBtn = $('seasonBtn'), seasonNameEl = $('seasonName'), quotesContainer = $('quotesContainer');
const hourHand = $('hourHand'), minuteHand = $('minuteHand'), secondHand = $('secondHand'), clockMarkers = $('clockMarkers');
const settingsToggle = $('settingsToggle'), settingsPanel = $('settingsPanel');
const nameInput = $('nameInput'), particlesToggle = $('particlesToggle'), soundToggle = $('soundToggle');

// Canvas setup
const canvas = $('particles');
const ctx = canvas.getContext('2d', { alpha: true });
let DPR = 1, logicalW = 1, logicalH = 1;

// Season definitions
const SEASONS = ['spring', 'summer', 'monsoon', 'autumn', 'winter', 'prewinter'];
const SEASON_LABELS = {
  spring: 'Spring', 
  summer: 'Summer', 
  monsoon: 'Monsoon', 
  autumn: 'Autumn', 
  winter: 'Winter', 
  prewinter: 'Pre-Winter'
};

// ===============================
// CLOCK & GREETING FUNCTIONS
// ===============================
function formatClock(d) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

let tickAudio;
function initTickSound() {
  if (tickAudio) return;
  const ctxA = new (window.AudioContext || window.webkitAudioContext)();
  tickAudio = () => {
    const o = ctxA.createOscillator(), g = ctxA.createGain();
    o.type = 'square'; 
    o.frequency.value = 850;
    g.gain.value = 0.0015;
    o.connect(g); 
    g.connect(ctxA.destination);
    o.start(); 
    setTimeout(() => { o.stop() }, 30);
  };
}

function updateClock() {
  const now = new Date();
  timeEl.textContent = formatClock(now);
  dateEl.textContent = formatDate(now);

  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  
  const hourAngle = (hours * 30) + (minutes * 0.5);
  const minuteAngle = minutes * 6;
  const secondAngle = seconds * 6;
  
  hourHand.style.transform = `rotate(${hourAngle}deg)`;
  minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
  secondHand.style.transform = `rotate(${secondAngle}deg)`;
  
  const h = now.getHours();
  const name = localStorage.getItem('greet_name') || 'Friend';
  let greeting, subtitle;
  
  if (h >= 0 && h < 4) {
    greeting = `Good Night, ${name}...`;
    subtitle = 'Time to rest and recharge for tomorrow';
  } else if (h >= 4 && h < 12) {
    greeting = `Good Morning, ${name}...`;
    subtitle = 'Hope you have a productive day ahead!';
  } else if (h >= 12 && h < 16) {
    greeting = `Good Afternoon, ${name}...`;
    subtitle = 'Keep up the great work today!';
  } else {
    greeting = `Good Evening, ${name}...`;
    subtitle = 'Time to unwind and reflect on today';
  }
  
  greetingEl.textContent = greeting;
  greetingSubtitleEl.textContent = subtitle;

  if (soundToggle.checked && !prefersReduced) {
    try {
      initTickSound();
      tickAudio();
    } catch (e) {}
  }
}

function createClockMarkers() {
  clockMarkers.innerHTML = '';
  for (let i = 0; i < 60; i++) {
    const marker = document.createElement('div');
    marker.className = `clock-marker ${i % 5 === 0 ? 'hour' : 'minute'}`;
    marker.style.transform = `rotate(${i * 6}deg)`;
    clockMarkers.appendChild(marker);
  }
}

createClockMarkers();
updateClock();
if (!prefersReduced) setInterval(updateClock, 1000);

// ===============================
// CANVAS & PARTICLE SYSTEM
// ===============================
function resizeCanvas() {
  DPR = Math.max(1, window.devicePixelRatio || 1);
  logicalW = Math.max(1, Math.floor(window.innerWidth));
  logicalH = Math.max(1, Math.floor(window.innerHeight));
  canvas.width = Math.max(1, Math.floor(logicalW * DPR));
  canvas.height = Math.max(1, Math.floor(logicalH * DPR));
  canvas.style.width = logicalW + 'px';
  canvas.style.height = logicalH + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

resizeCanvas();

let _resizeTimer = null;
window.addEventListener('resize', () => {
  if (_resizeTimer) clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    resizeCanvas();
    if (window.Particle && window.Particle.reflow) window.Particle.reflow();
  }, 120);
});

// Mouse interaction for particles
const mouse = { x: 0, y: 0, vx: 0, vy: 0, down: false };
window.addEventListener('mousemove', (e) => {
  const px = mouse.x, py = mouse.y;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.vx = mouse.x - px;
  mouse.vy = mouse.y - py;
});
window.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);

function createParticleEngine(initialMode) {
  let parts = [], ripples = [], flares = [];
  let running = true, mode = initialMode || 'prewinter', last = performance.now();
  let rafId = null;
  const maxCounts = { spring: 110, summer: 100, monsoon: 140, autumn: 120, winter: 90, prewinter: 90 };
  const images = { leaf1: null, leaf2: null };

  function loadImg(src) {
    return new Promise(res => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = src;
    });
  }

  // Preload optional assets
  loadImg('leaf1.png').then(img => images.leaf1 = img);
  loadImg('leaf2.png').then(img => images.leaf2 = img);

  function rnd(a, b) { return Math.random() * (b - a) + a; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function newParticle() {
    const p = {
      x: rnd(0, logicalW), y: rnd(-60, logicalH + 60), vx: 0, vy: 0, r: 1,
      ang: rnd(0, Math.PI * 2), spin: rnd(-0.05, 0.05), type: 'dot', alpha: 1,
      color: '#fff', z: rnd(0.4, 1.2)
    };

    if (mode === 'spring') {
      p.type = 'petal';
      p.r = rnd(3.5, 7.5);
      p.vx = rnd(-0.28, 0.35);
      p.vy = rnd(0.18, 0.55);
      p.color = 'rgba(255,140,170,0.96)';
      p.spin = rnd(-0.06, 0.06);
    } else if (mode === 'summer') {
      p.type = Math.random() < 0.12 ? 'leaf' : 'dust';
      if (p.type === 'dust') {
        p.r = rnd(0.8, 2.8);
        p.vx = rnd(0.05, 0.45);
        p.vy = rnd(-0.02, 0.18);
        p.color = 'rgba(255,205,110,0.9)';
        p.alpha = rnd(0.35, 0.9);
      } else {
        p.r = rnd(6, 12);
        p.vx = rnd(0.1, 0.6);
        p.vy = rnd(0.05, 0.25);
        p.color = 'rgba(255,180,90,0.95)';
        p.spin = rnd(-0.2, 0.2);
      }
    } else if (mode === 'monsoon') {
      p.type = 'rain';
      p.r = rnd(1.0, 1.6);
      p.vx = rnd(-0.25, 0.2);
      p.vy = rnd(0.65, 1.4);
      p.color = 'rgba(170,210,240,0.98)';
    } else if (mode === 'autumn') {
      p.type = 'leaf';
      p.r = rnd(6, 13);
      p.vx = rnd(-0.6, 0.45);
      p.vy = rnd(0.25, 0.7);
      p.color = 'rgba(255,170,80,0.98)';
      p.spin = rnd(-0.3, 0.3);
    } else if (mode === 'prewinter') {
      p.type = Math.random() < 0.25 ? 'mist' : 'dewdrop';
      if (p.type === 'mist') {
        p.r = rnd(60, 140);
        p.vx = rnd(0.02, 0.12);
        p.vy = rnd(-0.02, 0.04);
        p.alpha = rnd(0.05, 0.12);
      } else {
        p.r = rnd(1.4, 3.6);
        p.vx = rnd(-0.2, 0.2);
        p.vy = rnd(0.08, 0.35);
        p.color = 'rgba(220,240,255,0.96)';
      }
    } else {
      p.type = Math.random() < 0.12 ? 'ember' : 'snow';
      if (p.type === 'snow') {
        p.r = rnd(1.4, 3.8);
        p.vx = rnd(-0.2, 0.2);
        p.vy = rnd(0.08, 0.32);
        p.color = 'rgba(240,248,255,0.96)';
      } else {
        p.r = rnd(1.2, 2.4);
        p.vx = rnd(-0.05, 0.05);
        p.vy = rnd(-0.06, -0.02);
        p.color = 'rgba(255,120,60,0.9)';
      }
    }
    return p;
  }

  function init(count) {
    parts = [];
    for (let i = 0; i < count; i++) parts.push(newParticle());
  }

  function reflow() {
    for (let p of parts) {
      p.x = clamp(p.x / logicalW * logicalW, 0, logicalW);
      p.y = clamp(p.y / logicalH * logicalH, -50, logicalH + 50);
    }
  }

  function setMode(m) {
    mode = m;
    init(maxCounts[mode] || 90);

    // Prepare lens flares for summer
    flares = [];
    if (mode === 'summer') {
      const n = 2 + Math.floor(rnd(0, 2));
      for (let i = 0; i < n; i++) {
        flares.push({
          x: rnd(0, logicalW),
          y: rnd(0, logicalH * 0.6),
          r: rnd(120, 240),
          t: rnd(0, Math.PI * 2),
          speed: rnd(0.0002, 0.0005)
        });
      }
    }
  }

  function addRipple(x, y) {
    ripples.push({ x, y, r: 2, alpha: 0.35 });
  }

  function drawFlare(f) {
    const cx = f.x + Math.cos(f.t) * 120;
    const cy = f.y + Math.sin(f.t) * 60;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, f.r);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.35, 'rgba(255,220,180,0.22)');
    g.addColorStop(1, 'rgba(255,200,120,0.0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    f.t += f.speed * (prefersReduced ? 0 : 1);
  }

  function step(now) {
    const dt = Math.min(40, now - last);
    last = now;

    if (!running) {
      rafId = null;
      return; // stop scheduling more frames when paused
    }

    ctx.clearRect(0, 0, logicalW, logicalH);

    // Flares layer for summer
    if (mode === 'summer' && flares.length) {
      for (const f of flares) drawFlare(f);
    }

    for (const p of parts) {
      // Mouse wind interaction
      const dx = (p.x - mouse.x), dy = (p.y - mouse.y);
      const dist = Math.hypot(dx, dy) || 1;
      const influence = particlesToggle.checked && !prefersReduced ? Math.max(0, 1 - dist / 180) : 0;
      p.vx += (-dx / dist) * 0.04 * influence + (mouse.vx * 0.002 * influence);
      p.vy += (-dy / dist) * 0.02 * influence + (mouse.vy * 0.002 * influence);

      // Season forces
      if (mode === 'spring') {
        p.vx += Math.sin(p.ang * 0.7 + now * 0.0005) * 0.01;
        p.vy += 0.006 * (dt / 16);
        p.ang += p.spin * 0.01;
      } else if (mode === 'summer') {
        p.vx += Math.sin((p.y / logicalH * 6) + now * 0.0008) * 0.02;
        p.vy += 0.002 * (dt / 16);
      } else if (mode === 'monsoon') {
        p.vx += Math.sin(now * 0.001 + (p.x / logicalW) * 12) * 0.06;
        p.vy += 0.02 * (dt / 16);
      } else if (mode === 'autumn') {
        p.vx += Math.sin((p.y / logicalH * 8) + p.ang) * 0.035;
        p.vy += 0.008 * (dt / 16);
        p.ang += p.spin * 0.018;
      } else if (mode === 'prewinter') {
        if (p.type === 'mist') {
          p.vx += 0.004;
        } else {
          p.vy += 0.004 * (dt / 16);
        }
      } else if (mode === 'winter') {
        if (p.type === 'ember') {
          p.vy -= 0.006 * (dt / 16);
        } else {
          p.vy += 0.004 * (dt / 16);
        }
        p.vx += Math.sin(now * 0.0006 + p.y * 0.02) * 0.006;
      }

      // Damping and integration
      p.vx *= 0.995;
      p.vy *= 0.997;
      p.x += p.vx * (dt / 16) * p.z;
      p.y += p.vy * (dt / 16) * p.z;

      // Draw
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = p.alpha;

      if (p.type === 'petal') {
        ctx.rotate(p.ang);
        ctx.beginPath();
        const r = p.r;
        ctx.moveTo(0, -r / 2);
        ctx.quadraticCurveTo(r * 1.2, -r * 1.4, r, r * 1.4);
        ctx.quadraticCurveTo(0, r, -r, r * 1.4);
        ctx.quadraticCurveTo(-r * 1.2, -r * 1.4, 0, -r / 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (p.type === 'dust') {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = p.alpha * 0.08;
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = p.alpha;
      } else if (p.type === 'leaf') {
        ctx.rotate(Math.sin(p.ang) * 0.6);
        const img = Math.random() < 0.5 ? images.leaf1 : images.leaf2;
        if (img) {
          ctx.drawImage(img, -p.r, -p.r, p.r * 2, p.r * 2);
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.r / 2);
          ctx.bezierCurveTo(p.r * 1.2, -p.r, p.r * 1.1, p.r, 0, p.r * 1.2);
          ctx.bezierCurveTo(-p.r * 1.1, p.r, -p.r * 1.2, -p.r, 0, -p.r / 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      } else if (p.type === 'rain') {
        ctx.beginPath();
        ctx.moveTo(0, -p.r * 6);
        ctx.lineTo(p.vx * -6, p.r * 6);
        ctx.lineWidth = Math.max(1, p.r * 0.8);
        const g = ctx.createLinearGradient(0, -p.r * 6, 0, p.r * 6);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(1, p.color);
        ctx.strokeStyle = g;
        ctx.stroke();
        if (p.y > logicalH - 2) {
          addRipple(p.x, logicalH - 3);
        }
      } else if (p.type === 'mist') {
        const g = ctx.createRadialGradient(0, 0, p.r * 0.1, 0, 0, p.r);
        g.addColorStop(0, 'rgba(255,255,255,0.08)');
        g.addColorStop(1, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'dewdrop') {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(-p.r * 0.3, -p.r * 0.4, p.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = p.alpha;
      } else if (p.type === 'snow') {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (p.type === 'ember') {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 3);
        g.addColorStop(0, 'rgba(255,160,90,0.9)');
        g.addColorStop(1, 'rgba(255,120,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.restore();

      // Recycle particles that go off-screen
      if (p.y > logicalH + 80 || p.x < -140 || p.x > logicalW + 140 || p.y < -140) {
        const idx = parts.indexOf(p);
        parts[idx] = newParticle();
        parts[idx].x = Math.random() * logicalW;
        parts[idx].y = -10 - Math.random() * 40;
      }
    }

    // Draw ripples (monsoon)
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(180,210,240,${rp.alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      rp.r += 0.9;
      rp.alpha -= 0.015;
      if (rp.alpha <= 0) ripples.splice(i, 1);
    }

    // schedule next frame
    rafId = requestAnimationFrame(step);
  }

  function pause() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    ctx.clearRect(0, 0, logicalW, logicalH);
  }

  function resume() {
    if (!prefersReduced && !running) {
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(step);
    }
  }

  setMode(mode);
  rafId = requestAnimationFrame(step);

  return { setMode, pause, resume, reflow };
}

let activeSeason = localStorage.getItem('greet_season') || 'prewinter';
const Particle = createParticleEngine(activeSeason);
window.Particle = Particle;

// ===============================
// SEASON SELECTOR FUNCTIONS
// ===============================
function updateSeasonSelector(season) {
  document.querySelectorAll('.season-option').forEach(option => {
    if (option.dataset.season === season) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
  seasonNameEl.textContent = SEASON_LABELS[season] || 'Season';
}

// Add click handlers to season options
document.querySelectorAll('.season-option').forEach(option => {
  option.addEventListener('click', () => {
    setSeason(option.dataset.season);
  });
});

// ===============================
// SEASON STATE MANAGEMENT
// ===============================
function setSeason(s) {
  activeSeason = s;
  const emojis = {
    spring: '🌸', summer: '☀️', monsoon: '🌧️', 
    autumn: '🍂', winter: '❄️', prewinter: '☃'
  };
  
  seasonBtn.textContent = emojis[s] || '☀️';
  seasonNameEl.textContent = SEASON_LABELS[s] || 'Season';
  document.body.className = s;
  localStorage.setItem('greet_season', s);
  
  if (Particle && Particle.setMode) Particle.setMode(s);
  updateSeasonSelector(s);
}

seasonBtn.addEventListener('click', () => {
  const idx = SEASONS.indexOf(activeSeason);
  setSeason(SEASONS[(idx + 1) % SEASONS.length]);
});

setSeason(activeSeason);

// ===============================
// SETTINGS PANEL FUNCTIONALITY
// ===============================
settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.toggle('open');
});

nameInput.value = localStorage.getItem('greet_name') || 'Div';
nameInput.addEventListener('input', (e) => {
  localStorage.setItem('greet_name', e.target.value || 'Friend');
  updateClock();
});

particlesToggle.checked = localStorage.getItem('particles_on') !== 'off';
particlesToggle.addEventListener('change', () => {
  localStorage.setItem('particles_on', particlesToggle.checked ? 'on' : 'off');
  if (!particlesToggle.checked) {
    Particle.pause();
    ctx.clearRect(0, 0, logicalW, logicalH);
  } else {
    Particle.resume();
  }
});

soundToggle.checked = localStorage.getItem('tick_sound') === 'on';
soundToggle.addEventListener('change', () => {
  localStorage.setItem('tick_sound', soundToggle.checked ? 'on' : 'off');
});

// Honor persisted toggles at load
if (localStorage.getItem('particles_on') === 'off') {
  Particle.pause();
}
if (localStorage.getItem('tick_sound') === 'on') {
  soundToggle.checked = true;
}

// ===============================
// INITIALIZE SEASON UI
// ===============================
seasonNameEl.textContent = SEASON_LABELS[activeSeason] || 'Season';
updateSeasonSelector(activeSeason);