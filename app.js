(function () {
  'use strict';

  const E = window.WorkEngine;
  const STORE = 'workit:v1';
  const ICON = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>',
    skip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5M6 11l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M6 13l6 6 6-6"/></svg>',
  };
  const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const RING_C = 2 * Math.PI * 46;
  const SEC_NAME = { warmup: 'Warm-up', cooldown: 'Cool-down' };

  const app = document.getElementById('app');
  const dock = document.getElementById('dock');
  const sheetEl = document.getElementById('sheet');
  const runEl = document.getElementById('run');
  const toastEl = document.getElementById('toast');

  let state = load();
  let view = 'workout';
  let sheet = null;
  let opener = null;
  let lastToday = today();
  let calMonth = today().slice(0, 7);

  // ---------- storage ----------

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORE);
      if (raw) {
        const { state: s, dropped } = E.normalize(JSON.parse(raw));
        if (dropped) localStorage.setItem(`${STORE}:unreadable:${Date.now()}`, raw);
        return s;
      }
    } catch (e) {
      // Unreadable data: keep a copy instead of overwriting it on the next save.
      try { if (raw) localStorage.setItem(`${STORE}:unreadable:${Date.now()}`, raw); } catch (e2) { /* storage unavailable */ }
    }
    return E.freshState();
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  // ---------- helpers ----------

  function today() { return E.toKey(new Date()); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }
  function day() { return state.days[state.current]; }
  function other(id) { return id === 'upper' ? 'lower' : 'upper'; }

  function longDate(key) {
    return E.fromKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function shortDate(key) {
    return E.fromKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function minutes(sec) {
    const m = Math.round(sec / 60);
    return m < 1 ? '<1 min' : `${m} min`;
  }

  function list(sec, b) {
    const d = day();
    if (sec === 'warmup') return d.warmup;
    if (sec === 'cooldown') return d.cooldown;
    return d.blocks[b] ? d.blocks[b].items : [];
  }

  // ---------- toasts ----------

  const queue = [];
  let toasting = false;

  function toast(...msgs) {
    queue.length = 0;
    queue.push(...msgs);
    if (!toasting) nextToast();
  }

  function nextToast() {
    const msg = queue.shift();
    if (!msg) { toasting = false; return; }
    toasting = true;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(nextToast, 260);
    }, 1800);
  }

  // ---------- files ----------

  function shareFile(text, name, type, title) {
    // Downloads are unreliable in an iPhone home-screen app; the share sheet
    // lets you save to Files instead.
    const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare && typeof File === 'function') {
      const file = new File([text], name, { type });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title }).catch((e) => {
          if (e && e.name !== 'AbortError') download(text, name, type);
        });
        return;
      }
    }
    download(text, name, type);
  }

  function download(text, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.hidden = true;
    document.body.appendChild(input);
    input.onchange = () => {
      const file = input.files[0];
      input.remove();
      if (!file) return;
      file.text().then((text) => {
        const raw = JSON.parse(text);
        if (!raw || !raw.days) throw new Error('not a backup');
        const { state: next, dropped } = E.normalize(raw);
        const note = dropped ? ` ${plural(dropped, 'record')} in it can’t be read and will be skipped.` : '';
        if (!confirm(`Replace all current data with this backup?${note}`)) return;
        state = next;
        save();
        closeSheet();
        toast('Backup restored');
      }).catch(() => toast('That file isn’t a Work it backup'));
    };
    input.click();
  }

  // ---------- body diagram (figure.js) ----------

  function figure(levels, view) { return window.Figure.svg(levels, view); }


  // ---------- cues: voice, tones, vibration, screen ----------

  const Cues = {
    ctx: null,
    voice: true,
    rate: 1,
    voiceName: '',
    tones: true,
    held: [], // iOS drops utterances that get garbage-collected mid-speech

    /** Must run inside a tap: iOS only allows audio and speech after a user gesture. */
    unlock(opts) {
      this.voice = opts.voice;
      this.rate = opts.voiceRate || 1;
      this.voiceName = opts.voiceName || '';
      this.tones = opts.tones;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC && !this.ctx) this.ctx = new AC();
        if (this.ctx && this.ctx.state !== 'running') this.ctx.resume();
      } catch (e) { /* no audio */ }
      if (this.voice && 'speechSynthesis' in window) {
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(' '));
      }
    },
    say(text, interrupt) {
      if (!this.voice || !('speechSynthesis' in window)) return;
      if (interrupt) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = this.rate;
      const v = this.voiceName && speechSynthesis.getVoices().find((x) => x.name === this.voiceName);
      if (v) { u.voice = v; u.lang = v.lang; }
      this.held.push(u);
      if (this.held.length > 20) this.held.shift();
      speechSynthesis.speak(u);
    },
    stop() {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
    beep(freq, ms, delay = 0, vol = 0.14) {
      if (!this.tones || !this.ctx) return;
      try {
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
        o.connect(g).connect(this.ctx.destination);
        o.start(t);
        o.stop(t + ms / 1000 + 0.02);
      } catch (e) { /* ignore */ }
    },
    buzz(p) { if (this.tones && navigator.vibrate) navigator.vibrate(p); },
    go() { this.beep(880, 320, 0, 0.18); this.buzz(60); },                          // work starts
    stopTone() { this.beep(660, 160); this.beep(523, 300, 0.18); this.buzz(30); },   // work ends
    tick() { this.beep(440, 90); },                                                  // last 3 seconds
    tap() { this.beep(392, 90); this.buzz(8); },
    done() { [523, 659, 784, 1047].forEach((f, i) => this.beep(f, 220, i * 0.14)); },
  };

  let wakeLock = null;
  async function lockScreen() {
    try {
      if ('wakeLock' in navigator && !document.hidden && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (e) { /* not supported: rely on Auto-Lock setting */ }
  }
  function releaseScreen() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  // ---------- workout runner ----------
  //
  // The engine compiles the workout into a flat list of timed steps; this walks it
  // with a wall-clock timer. Progress is saved on every step change, so a reload or
  // a backgrounded app resumes where it left off (paused).

  let R = null;
  const sideWord = (s) => (s === 'left' ? 'Left' : s === 'right' ? 'Right' : '');
  const spokenWeight = (w) => (w ? `, ${w % 1 ? w.toFixed(1) : w} pounds` : '');

  function beginSession() {
    closeStale();
    Cues.unlock(state.settings);
    let fresh = false;
    if (!state.active) {
      const snapshot = JSON.parse(JSON.stringify(day()));
      if (!E.buildPlan(snapshot).length) { toast('Add an exercise first'); return; }
      state.active = {
        id: uid(), date: today(), startedAt: Date.now(), snapshot,
        repSeconds: state.settings.repSeconds, stepIndex: 0, done: [], activeMs: 0,
      };
      save();
      fresh = true;
    }
    const a = state.active;
    const now = Date.now();
    const steps = E.buildPlan(a.snapshot, { repSeconds: a.repSeconds });
    R = {
      steps,
      flat: E.flatten(a.snapshot),
      index: Math.min(a.stepIndex, steps.length - 1),
      stepStart: now,
      pausedAt: fresh ? null : now,
      reenter: !fresh,
      spoken: new Set(),
      lastTick: now,
      done: new Set(a.done),
      activeMs: a.activeMs,
      finished: false,
      timer: null,
    };
    runEl.hidden = false;
    app.inert = true;
    dock.inert = true;
    document.body.style.overflow = 'hidden';
    lockScreen();
    R.timer = setInterval(tick, 100);
    if (fresh) enterStep(0, now);
    else renderRun();
  }

  function persist() {
    const a = state.active;
    if (!a || !R) return;
    a.stepIndex = R.index;
    a.done = [...R.done];
    a.activeMs = Math.round(R.activeMs);
    save();
  }

  function accrue(now) {
    if (R.pausedAt == null && !R.finished) R.activeMs += Math.min(2000, Math.max(0, now - R.lastTick));
    R.lastTick = now;
  }

  function itemOf(step) { return R.flat[step.ex].item; }

  function announce(i) {
    const step = R.steps[i];
    const it = itemOf(step);
    switch (step.kind) {
      case 'intro':
        Cues.tap();
        if (step.section === 'block') {
          const names = R.flat.filter((f) => f.section === 'block' && f.block === step.block);
          Cues.say(`Timed intervals. ${plural(step.rounds, 'round')}. ${names.length > 1 ? 'First' : 'Exercise'}: ${it.name}${spokenWeight(it.weight)}.`, true);
        } else {
          const first = i === 0 || R.steps[i - 1].section !== step.section;
          Cues.say(`${first ? `${SEC_NAME[step.section]}. ` : ''}${first ? 'First' : 'Next'}: ${it.name}.`, true);
        }
        break;
      case 'ready':
        if (step.side) Cues.say(`${sideWord(step.side)} side.`);
        break;
      case 'work':
        Cues.go();
        break;
      case 'rest': {
        const n = itemOf(R.steps[i + 1] || step);
        if (step.label === 'Switch sides') Cues.say('Switch sides.');
        else if (step.label === 'Round rest') Cues.say(`Round ${step.round} of ${step.rounds}. Next: ${n.name}${spokenWeight(n.weight)}.`);
        else if (step.section === 'block') Cues.say(`Rest. Next: ${n.name}${spokenWeight(n.weight)}.`);
        else Cues.say('Rest.');
        break;
      }
    }
  }

  function enterStep(i, startAt) {
    if (i >= R.steps.length) { finish('completed'); return; }
    R.index = i;
    R.stepStart = startAt;
    R.spoken.clear();
    R.reenter = false;
    announce(i);
    persist();
    renderRun();
  }

  function completeStep(natural) {
    if (!R || R.finished) return;
    const step = R.steps[R.index];
    const now = Date.now();
    if (natural && step.kind === 'work') {
      R.done.add(R.index);
      if (R.index + 1 < R.steps.length) Cues.stopTone();
    }
    // Chain from the scheduled end so timing doesn't drift, unless we're well behind.
    let startAt = now;
    if (natural) {
      const end = R.stepStart + step.duration * 1000;
      if (now - end < 1000) startAt = end;
    }
    enterStep(R.index + 1, startAt);
  }

  function tick() {
    if (!R || R.finished) return;
    const now = Date.now();
    accrue(now);
    if (R.pausedAt != null) return;
    const step = R.steps[R.index];
    if (!step) return;
    const remaining = step.duration * 1000 - (now - R.stepStart);
    const left = Math.ceil(remaining / 1000);
    const once = (key, fn) => { if (!R.spoken.has(key)) { R.spoken.add(key); fn(); } };
    // Count into the work, and out of it.
    if (step.duration >= 5 && left >= 1 && left <= 3 && step.kind !== 'intro') once(`c${left}`, () => Cues.tick());
    if (step.kind === 'work' && step.section === 'block' && step.duration >= 30) {
      const half = Math.ceil(step.duration / 2);
      if (left === half) once('half', () => Cues.say('Halfway.'));
    }
    if (remaining <= 0) completeStep(true);
    else updateClock(remaining, step.duration * 1000);
    const el = document.getElementById('elapsed');
    if (el) el.textContent = E.clock(R.activeMs / 1000);
  }

  function pause() {
    if (!R || R.finished || R.pausedAt != null) return;
    const now = Date.now();
    accrue(now);
    R.pausedAt = now;
    Cues.stop();
    persist();
    renderRun();
  }

  function resume() {
    if (!R || R.finished || R.pausedAt == null) return;
    Cues.unlock(state.settings);
    const now = Date.now();
    const pausedFor = now - R.pausedAt;
    R.pausedAt = null;
    R.lastTick = now;
    lockScreen();
    if (R.reenter) enterStep(R.index, now);
    else { R.stepStart += pausedFor; renderRun(); }
  }

  function unpauseForJump() {
    if (R.pausedAt != null) { R.pausedAt = null; R.lastTick = Date.now(); }
    Cues.unlock(state.settings);
    Cues.stop();
  }

  /** Rest/intro: start the next interval now. Work: move on without counting it. */
  function skip() {
    if (!R || R.finished) return;
    unpauseForJump();
    completeStep(false);
  }

  function back() {
    if (!R || R.finished) return;
    const elapsed = (R.pausedAt != null ? R.pausedAt : Date.now()) - R.stepStart;
    const target = E.backTarget(R.steps, R.index, R.reenter ? 0 : elapsed);
    for (const i of [...R.done]) if (i >= target) R.done.delete(i);
    unpauseForJump();
    enterStep(target, Date.now());
  }

  function finish(status) {
    if (!R || R.finished) return;
    accrue(Date.now());
    R.finished = true;
    clearInterval(R.timer);
    const a = state.active;
    const sum = E.summarize(a.snapshot, R.steps, [...R.done], status, R.index);
    const durationSec = Math.round(R.activeMs / 1000);
    state.active = null;
    if (status === 'completed') { Cues.done(); Cues.say('Workout complete. Nice work.', true); } else Cues.stop();
    closeRun();
    if (!sum.results.some((r) => r.done > 0)) {
      save();
      render();
      toast('Workout ended · nothing logged');
      return;
    }
    const rec = record(a, status, sum, durationSec);
    state.sessions.push(rec);
    if (status === 'completed') state.current = other(a.snapshot.id);
    save();
    render();
    openSheet({ type: 'review', id: rec.id, draft: { ratings: {}, note: '' }, fresh: true });
  }

  function record(a, status, sum, durationSec) {
    return {
      id: a.id, date: a.date, dayId: a.snapshot.id, dayName: a.snapshot.name,
      startedAt: a.startedAt, endedAt: Date.now(), durationSec, status,
      completionPct: sum.completionPct, results: sum.results, note: '', reviewed: false,
    };
  }

  function closeRun() {
    if (R) clearInterval(R.timer);
    R = null;
    runEl.hidden = true;
    runEl.innerHTML = '';
    releaseScreen();
    dock.inert = false;
    if (!sheet) {
      app.inert = false;
      document.body.style.overflow = '';
    }
  }

  /** A workout left open on an earlier day is saved as ended. */
  function closeStale() {
    const a = state.active;
    if (!a || a.date === today() || R) return;
    const steps = E.buildPlan(a.snapshot, { repSeconds: a.repSeconds });
    const sum = E.summarize(a.snapshot, steps, a.done, 'ended', a.stepIndex);
    if (sum.results.some((r) => r.done > 0)) state.sessions.push(record(a, 'ended', sum, Math.round(a.activeMs / 1000)));
    state.active = null;
    save();
  }

  // ---------- workout rendering ----------

  function where(step) {
    if (step.section === 'block') return `Block ${step.block + 1} · Round ${step.round} of ${step.rounds}`;
    const n = R.flat.filter((f) => f.section === step.section);
    const k = n.findIndex((f) => f.item === itemOf(step));
    return `${SEC_NAME[step.section]} · ${k + 1} of ${n.length}`;
  }

  function nextWork(i) {
    for (let j = i + 1; j < R.steps.length; j++) if (R.steps[j].kind === 'work') return R.steps[j];
    return null;
  }

  function renderRun() {
    if (!R) return;
    const step = R.steps[R.index];
    const it = itemOf(step);
    const paused = R.pausedAt != null;
    const overall = Math.round((R.index / R.steps.length) * 100);
    const isWork = step.kind === 'work';
    const blockIntro = step.kind === 'intro' && step.section === 'block';
    const phase = isWork ? step.label : step.kind === 'intro' ? 'Up next' : step.label;

    const head = blockIntro
      ? `<div class="s-head"><div><div class="s-name">Timed intervals</div><div class="s-meta">${plural(step.rounds, 'round')}</div></div></div>
         <ul class="s-list">${R.flat.filter((f) => f.section === 'block' && f.block === step.block)
          .map((f) => `<li>${esc(f.item.name)}${f.item.weight ? ` · ${E.lb(f.item.weight)}` : ''} · ${E.clock(f.item.seconds)}</li>`).join('')}</ul>`
      : `<div class="s-head"><div>
          <div class="s-name">${esc(it.name)}</div>
          <div class="s-meta">${[it.weight ? E.lb(it.weight) : '', it.kind === 'dynamic' ? `${it.reps} reps` : '', it.muscles.map((m) => E.MUSCLES[m].name).join(', ')].filter(Boolean).map(esc).join(' · ')}</div>
        </div></div>
        ${it.cue ? `<p class="s-cue">${esc(it.cue)}</p>` : ''}`;

    const side = step.side ? `<span class="side ${step.side}">${sideWord(step.side)}</span>` : '';
    const roundWord = step.section === 'block' ? 'Round' : 'Set';
    const repLine = step.rounds ? `<div class="s-rep"><span>${roundWord} ${step.round} of ${step.rounds}</span>${side}</div>` : '';

    let next = '';
    const nw = isWork ? nextWork(R.index) : null;
    if (isWork && nw && nw.ex !== step.ex) {
      const n = itemOf(nw);
      next = `<p class="s-next">Then: <b>${esc(n.name)}</b>${n.weight ? ` · ${E.lb(n.weight)}` : ''}</p>`;
    } else if (!isWork && step.kind === 'rest' && step.section === 'block') {
      next = `<p class="s-next">${it.weight ? `Grab the <b>${E.lb(it.weight)}</b> dumbbells` : 'Get set'}</p>`;
    }

    const canSkipAhead = !isWork;
    const note = paused ? `<div class="paused-note">${R.reenter ? 'Paused · tap play to continue' : 'Paused'}</div>` : '';

    runEl.innerHTML = `<div class="sheet-inner">
      <div class="s-top">
        <button data-run="end">End</button>
        <span class="count">${esc(where(step))}</span>
        <span class="elapsed" id="elapsed">${E.clock(R.activeMs / 1000)}</span>
      </div>
      <div class="s-bar" aria-hidden="true"><i style="width:${overall}%"></i></div>
      ${head}
      <div class="s-stage">
        <div class="ring ${isWork ? 'work' : 'rest'}" role="timer" aria-live="off">
          <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="46"/>
            <circle class="arc" id="arc" cx="50" cy="50" r="46" stroke-dasharray="${RING_C} ${RING_C}" stroke-dashoffset="0"/></svg>
          <div class="ring-in"><b id="clock">${step.duration}</b><small>${esc(phase)}</small></div>
        </div>
        ${repLine}
        ${next}
        ${note}
        ${canSkipAhead && !paused ? `<button class="s-now" data-run="skip">${step.kind === 'rest' ? 'Skip rest' : 'Start now'}</button>` : ''}
      </div>
      <div class="controls">
        <button class="ctl" data-run="back" aria-label="Back"><i>${ICON.back}</i>Back</button>
        <button class="ctl main" data-run="${paused ? 'resume' : 'pause'}" aria-label="${paused ? 'Resume' : 'Pause'}"><i>${paused ? ICON.play : ICON.pause}</i></button>
        <button class="ctl" data-run="skip" aria-label="Skip"><i>${ICON.skip}</i>Skip</button>
      </div>
    </div>`;
    const elapsed = R.reenter ? 0 : (paused ? R.pausedAt : Date.now()) - R.stepStart;
    updateClock(step.duration * 1000 - elapsed, step.duration * 1000);
  }

  function updateClock(remaining, total) {
    const clock = document.getElementById('clock');
    const arc = document.getElementById('arc');
    const s = Math.max(0, Math.ceil(remaining / 1000));
    if (clock) clock.textContent = s >= 60 ? E.clock(s) : String(s);
    if (arc) arc.setAttribute('stroke-dashoffset', String(RING_C * Math.min(1, Math.max(0, 1 - remaining / total))));
  }

  runEl.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-run]');
    if (!el || !R) return;
    switch (el.dataset.run) {
      case 'pause': pause(); break;
      case 'resume': resume(); break;
      case 'back': back(); break;
      case 'skip': skip(); break;
      case 'end': {
        const wasPaused = R.pausedAt != null;
        pause();
        if (confirm('End this workout? What you’ve done so far is saved to your log.')) finish('ended');
        else if (!wasPaused) resume();
        break;
      }
    }
  });

  // ---------- main views ----------

  function render() {
    closeStale();
    const t = today();
    const body = view === 'workout' ? workoutView(t) : view === 'body' ? bodyView(t) : logView(t);
    app.innerHTML = top() + body;
    app.classList.toggle('has-dock', view === 'workout');
    renderDock();
  }

  function top() {
    const tab = (id, label) =>
      `<button class="tab" data-action="view" data-view="${id}" ${view === id ? 'aria-current="page"' : ''}>${label}</button>`;
    return `<header class="top">
      <nav class="tabs" aria-label="Sections">${tab('workout', 'Workout')}${tab('body', 'Body')}${tab('log', 'Log')}</nav>
      <button class="icon-btn" data-action="settings" aria-label="Settings">${ICON.more}</button>
    </header>`;
  }

  function renderDock() {
    if (view !== 'workout') { dock.hidden = true; dock.innerHTML = ''; return; }
    dock.hidden = false;
    const a = state.active && state.active.date === today() ? state.active : null;
    const label = a ? 'Resume workout' : 'Start workout';
    const sub = a ? `${esc(a.snapshot.name)} · in progress` : `≈ ${minutes(E.estimateSeconds(E.buildPlan(day(), { repSeconds: state.settings.repSeconds })))}`;
    dock.innerHTML = `<button class="btn big block" data-action="start">${label}</button><div class="dock-sub">${sub}</div>`;
  }

  function moreBtn(attrs, label) {
    return `<button class="more" ${attrs} aria-label="${esc(label)}">${ICON.more}</button>`;
  }

  function row(it, sec, b, i, rounds) {
    const at = `data-sec="${sec}" data-b="${b}" data-i="${i}"`;
    const trend = it.trend
      ? `<button class="trend" data-action="trend" ${at} aria-label="${it.trend === 'up' ? 'Go up' : 'Go down'}: ${esc(trendText(it))}">${it.trend === 'up' ? ICON.up : ICON.down}</button>`
      : '';
    return `<div class="ex">
      <button class="ex-body" data-action="item" ${at}><b>${esc(it.name)}</b><span>${esc(E.describe(it, rounds))}</span></button>
      ${trend}
      ${moreBtn(`data-action="item" ${at}`, `Edit ${it.name}`)}
    </div>`;
  }

  function trendText(it) {
    const p = E.progress(it, it.trend);
    return it.weight ? (p.weight ? E.lb(p.weight) : 'bodyweight') : `${E.clock(p.seconds)} intervals`;
  }

  function stretchSection(sec) {
    const d = day();
    const on = sec === 'warmup' ? d.warmupOn : d.cooldownOn;
    const items = d[sec];
    if (!items.length) return '';
    const secs = E.sectionSeconds(d, sec, state.settings.repSeconds);
    return `<section class="sec ${on ? '' : 'off'}">
      <div class="sec-head"><h2>${SEC_NAME[sec]}</h2><span class="sec-time">${on ? '+' : ''}${Math.max(1, Math.round(secs / 60))}m</span>
        ${moreBtn(`data-action="section" data-sec="${sec}"`, `${SEC_NAME[sec]} options`)}</div>
      ${items.map((it, i) => row(it, sec, -1, i, it.sets)).join('')}
    </section>`;
  }

  function workoutView(t) {
    const d = day();
    const st = E.dayStats(d);
    const a = state.active && state.active.date === t ? state.active : null;
    const blocks = d.blocks.map((b, bi) => `<div class="block">
        <div class="sec-head"><h3>Timed intervals · ${plural(b.rounds, 'round')}</h3>
          ${moreBtn(`data-action="block" data-b="${bi}"`, `Block ${bi + 1} options`)}</div>
        <div class="circuit">${b.items.map((it, i) => row(it, 'block', bi, i, b.rounds)).join('') || '<p class="hint" style="padding-bottom:12px">Empty block. Add an exercise to it.</p>'}</div>
      </div>`).join('');
    return `<div class="date">${esc(longDate(t))}</div>
      <div class="day-head"><h1>${esc(d.name)}</h1>
        <button class="pill" data-action="switch">${ICON.swap}Switch</button></div>
      <p class="day-sub">${plural(st.exercises, 'exercise')} · ${plural(st.muscles, 'muscle')}</p>
      ${a && a.snapshot.id !== d.id ? `<div class="banner"><span><b>${esc(a.snapshot.name)}</b> is in progress</span><button class="btn small" data-action="start">Resume</button></div>` : ''}
      ${stretchSection('warmup')}
      <section class="sec">${blocks}</section>
      ${stretchSection('cooldown')}
      <button class="add-row" data-action="add"><i aria-hidden="true">+</i>Add exercise</button>`;
  }

  function bodyView(t) {
    const rep = E.muscleReport(state.sessions, t);
    const levels = {};
    for (const m of E.MUSCLE_IDS) {
      if (rep[m].week) levels[m] = 'on';
      else if (rep[m].last) levels[m] = 'was';
    }
    const inPlan = (m) => ['upper', 'lower'].filter((id) => E.dayStats(state.days[id]).muscleIds.includes(m));
    const ids = E.MUSCLE_IDS.filter((m) => rep[m].last || inPlan(m).length);
    ids.sort((x, y) => rep[y].week - rep[x].week || (rep[y].last || '').localeCompare(rep[x].last || ''));
    const rows = ids.map((m) => {
      const r = rep[m];
      const days = inPlan(m).map((id) => state.days[id].name.replace(/ Day$/, '')).join(', ');
      const sub = r.last ? `Last ${r.last === t ? 'today' : shortDate(r.last)}${days ? ` · ${days}` : ''}` : `Not worked yet${days ? ` · ${days}` : ''}`;
      return `<div class="mrow"><div><b>${esc(r.name)}</b><span>${esc(sub)}</span></div>
        <em class="${r.week ? '' : 'zero'}">${r.week ? `${r.week}×` : '—'}</em></div>`;
    }).join('');
    const worked = E.MUSCLE_IDS.filter((m) => rep[m].week).length;
    return `<div class="date">Last 7 days</div>
      <h1>${worked ? plural(worked, 'muscle') : 'Body'}</h1>
      <p class="day-sub">${worked ? 'worked this week' : 'Finish a workout to see what it hit.'}</p>
      <div class="figures">
        <figure>${figure(levels, 'front')}<figcaption>Front</figcaption></figure>
        <figure>${figure(levels, 'back')}<figcaption>Back</figcaption></figure>
      </div>
      <div class="legend"><span><i style="background:var(--fg)"></i>This week</span><span><i style="background:var(--muted)"></i>Earlier</span><span><i style="background:var(--muscle)"></i>Not yet</span></div>
      <div class="section-label">Muscles · workouts this week</div>
      <div class="rows">${rows}</div>`;
  }

  function calendar(t) {
    const [y, m] = calMonth.split('-').map(Number);
    const first = `${calMonth}-01`;
    const days = new Date(y, m, 0).getDate();
    const full = new Set(state.sessions.filter((s) => s.status === 'completed').map((s) => s.date));
    const part = new Set(state.sessions.map((s) => s.date));
    const lead = E.weekday(first);
    let cells = DAY_LETTERS.map((l) => `<span>${l}</span>`).join('');
    for (let i = 0; i < lead; i++) cells += '<i class="blank"></i>';
    for (let d = 1; d <= days; d++) {
      const k = `${calMonth}-${String(d).padStart(2, '0')}`;
      const cls = full.has(k) ? 'full' : part.has(k) ? 'part' : '';
      cells += `<i class="${cls} ${k === t ? 'today' : ''}">${d}</i>`;
    }
    const label = E.fromKey(first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const atNow = calMonth >= t.slice(0, 7);
    return `<div class="month-head"><div class="section-label">${esc(label)}</div>
        <div class="month-nav"><button data-action="month" data-delta="-1" aria-label="Previous month">‹</button>
        <button data-action="month" data-delta="1" aria-label="Next month" ${atNow ? 'disabled' : ''}>›</button></div></div>
      <div class="cal" aria-hidden="true">${cells}</div>
      <div class="cal-legend"><span><i></i>Finished</span><span><i class="p"></i>Ended early</span></div>`;
  }

  function logView(t) {
    const s = state.sessions.slice().sort((a, b) => b.startedAt - a.startedAt);
    const rows = s.slice(0, 60).map((x) => `<button class="srow" data-action="session" data-id="${esc(x.id)}">
        <div class="srow-head"><b>${esc(x.dayName)}</b><span>${x.completionPct}%</span></div>
        <div class="srow-sub">${esc(shortDate(x.date))} · ${minutes(x.durationSec)}${x.status === 'completed' ? '' : ' · ended early'}</div>
        <div class="mini"><i style="width:${x.completionPct}%"></i></div>
      </button>`).join('');
    return `<div class="date">${esc(longDate(t))}</div>
      <h1>Log</h1>
      <div class="stats">
        <div class="stat"><b>${E.weekCount(state.sessions, t)}</b><small>This week</small></div>
        <div class="stat"><b>${E.weekStreak(state.sessions, t)}</b><small>Week streak</small></div>
        <div class="stat"><b>${state.sessions.filter((x) => x.status === 'completed').length}</b><small>Workouts</small></div>
      </div>
      <p class="hint">A week counts toward the streak with 2 or more workouts.</p>
      ${calendar(t)}
      <div class="section-label">History</div>
      <div class="rows">${rows || '<p class="empty-note">No workouts yet.</p>'}</div>`;
  }

  // ---------- sheets ----------

  function openSheet(s) {
    if (!sheet) opener = document.activeElement;
    sheet = s;
    document.body.style.overflow = 'hidden';
    app.inert = true;
    dock.inert = true;
    runEl.inert = true;
    renderSheet();
    sheetEl.scrollTop = 0;
    const title = sheetEl.querySelector('#sheet-title');
    if (title) title.focus({ preventScroll: true });
  }

  function closeSheet() {
    sheet = null;
    runEl.inert = false;
    renderSheet();
    if (!R) {
      app.inert = false;
      dock.inert = false;
      document.body.style.overflow = '';
    }
    render();
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }

  function renderSheet() {
    if (!sheet) {
      sheetEl.hidden = true;
      sheetEl.innerHTML = '';
      return;
    }
    sheetEl.hidden = false;
    const html = {
      item: itemSheet,
      block: blockSheet,
      section: sectionSheet,
      review: reviewSheet,
      session: sessionSheet,
      settings: settingsSheet,
    }[sheet.type]();
    sheetEl.innerHTML = `<div class="sheet-inner">${html}</div>`;
  }

  function stepper(field, value, label, min, max, fmt) {
    return `<div class="stepper">
      <button data-action="step" data-field="${field}" data-delta="-1" aria-label="Less ${esc(label)}" ${value <= min ? 'disabled' : ''}>−</button>
      <output>${esc(fmt ? fmt(value) : value)}</output>
      <button data-action="step" data-field="${field}" data-delta="1" aria-label="More ${esc(label)}" ${value >= max ? 'disabled' : ''}>+</button>
    </div>`;
  }

  function seg(field, value, options) {
    return `<div class="seg" role="group">${options.map(([v, label]) =>
      `<button data-action="seg" data-field="${field}" data-value="${esc(v)}" aria-pressed="${String(value) === String(v)}">${esc(label)}</button>`).join('')}</div>`;
  }

  // ----- exercise (edit / add) -----

  function destinations() {
    const d = day();
    const out = [['warmup', 'Warm-up']];
    d.blocks.forEach((b, i) => out.push([`b${i}`, `Block ${i + 1}`]));
    out.push(['new', 'New block'], ['cooldown', 'Cool-down']);
    return out;
  }

  function destKind(dest) { return dest === 'warmup' || dest === 'cooldown' ? 'stretch' : 'interval'; }

  function itemSheet() {
    const { draft: x, mode } = sheet;
    const isAdd = mode === 'add';
    const interval = x.kind === 'interval';
    let picker = '';
    if (isAdd) {
      const want = destKind(sheet.dest);
      const have = new Set(list(sheet.sec, sheet.b).map((it) => it.name));
      const mine = new Set(E.dayStats(day()).muscleIds);
      const fits = (it) => (it.muscles.some((m) => mine.has(m)) ? 0 : 1);
      const lib = E.library()
        .filter((it) => (want === 'interval' ? it.kind === 'interval' : it.kind !== 'interval') && !have.has(it.name))
        .sort((p, q) => fits(p) - fits(q));
      picker = `<div class="field"><span>Add to</span>
          <div class="chips">${destinations().map(([v, l]) => `<button class="chip" data-action="dest" data-value="${v}" aria-pressed="${sheet.dest === v}">${esc(l)}</button>`).join('')}</div></div>
        <div class="field"><span>Pick one</span>
          <div class="chips scroll">${lib.map((it) => `<button class="chip" data-action="pick" data-value="${esc(it.name)}" aria-pressed="${x.name === it.name}">${esc(it.name)}</button>`).join('')}</div></div>`;
    }
    const last = !isAdd && interval ? E.lastWeight(state.sessions, x.name) : null;
    const weightFmt = (w) => (w ? E.lb(w) : 'Bodyweight');
    const fields = interval
      ? `<div class="field"><span>Interval</span>${stepper('seconds', x.seconds, 'time', 15, 120, (v) => `${E.clock(v)} each`)}</div>
         <div class="field"><span>Weight</span>${stepper('weight', x.weight || 0, 'weight', 0, 200, weightFmt)}
         ${last && last.weight !== x.weight ? `<p class="hint" style="text-align:center">Last time: ${esc(last.weight ? E.lb(last.weight) : 'bodyweight')} on ${esc(shortDate(last.date))}</p>` : ''}</div>`
      : `<div class="field"><span>Type</span>${seg('kind', x.kind, [['static', 'Static hold'], ['dynamic', 'Dynamic reps']])}</div>
         <div class="field"><span>Sets</span>${stepper('sets', x.sets, 'sets', 1, 5)}</div>
         ${x.kind === 'dynamic'
          ? `<div class="field"><span>Reps</span>${stepper('reps', x.reps, 'reps', 2, 30)}</div>`
          : `<div class="field"><span>Hold</span>${stepper('seconds', x.seconds, 'hold', 5, 120, E.clock)}</div>`}
         <div class="field"><span>Sides</span>${seg('sides', x.sides, [['none', 'Both together'], ['each', 'Each side']])}</div>`;
    const n = list(sheet.sec, sheet.b).length;
    const actions = isAdd ? '' : `<div class="detail-actions">
        <button class="link" data-action="move" data-delta="-1" ${sheet.i === 0 ? 'disabled' : ''}>Move up</button>
        <button class="link" data-action="move" data-delta="1" ${sheet.i >= n - 1 ? 'disabled' : ''}>Move down</button>
        <button class="link danger" data-action="remove">Remove</button>
      </div>`;
    return `<div class="sheet-top"><button data-action="close">Cancel</button>
        <button class="done" data-action="save-item" ${x.name.trim() ? '' : 'disabled'}>${isAdd ? 'Add' : 'Save'}</button></div>
      <h1 id="sheet-title" class="detail-name" tabindex="-1">${isAdd ? 'Add exercise' : esc(x.name || 'Exercise')}</h1>
      ${picker}
      <label class="field"><span>Name</span><input type="text" data-field="name" value="${esc(x.name)}" placeholder="e.g. Push Up" maxlength="80" autocomplete="off"></label>
      <div class="field"><span>Muscles</span>
        <div class="chips">${E.MUSCLE_IDS.map((m) => `<button class="chip" data-action="muscle" data-value="${m}" aria-pressed="${x.muscles.includes(m)}">${esc(E.MUSCLES[m].name)}</button>`).join('')}</div></div>
      ${fields}
      <label class="field"><span>Cue</span><textarea data-field="cue" rows="2" placeholder="One line of form cues, shown during the workout">${esc(x.cue)}</textarea></label>
      ${actions}`;
  }

  function newDraft(dest) {
    const interval = destKind(dest) === 'interval';
    return {
      id: '', name: '', muscles: [], kind: interval ? 'interval' : 'static',
      sets: interval ? 2 : 1, seconds: interval ? 45 : 30, reps: 8, weight: null, sides: 'none', cue: '', trend: null,
    };
  }

  function destTo(dest) {
    if (dest === 'warmup' || dest === 'cooldown') return { sec: dest, b: -1 };
    if (dest === 'new') return { sec: 'block', b: day().blocks.length };
    return { sec: 'block', b: Number(dest.slice(1)) };
  }

  function saveItem() {
    const x = sheet.draft;
    const it = E.cleanItem({ ...x, id: x.id || `x-${uid()}` }, x.kind);
    if (!it) return;
    const d = day();
    if (sheet.mode === 'add') {
      if (sheet.dest === 'new') d.blocks.push({ id: `b-${uid()}`, rounds: 3, rest: 15, roundRest: 30, items: [] });
      const { sec, b } = destTo(sheet.dest);
      if (sec === 'block') it.kind = 'interval';
      else if (it.kind === 'interval') it.kind = 'static';
      list(sec, b).push(it);
      toast(`Added ${it.name}`);
    } else {
      list(sheet.sec, sheet.b)[sheet.i] = it;
    }
    save();
    closeSheet();
  }

  // ----- block -----

  function blockSheet() {
    const x = sheet.draft;
    const n = day().blocks[sheet.b].items.length;
    return `<div class="sheet-top"><button data-action="close">Cancel</button><button class="done" data-action="save-block">Save</button></div>
      <h1 id="sheet-title" class="detail-name" tabindex="-1">Block ${sheet.b + 1}</h1>
      <p class="lead">${n > 1 ? `A circuit: each of the ${n} exercises once per round.` : 'One exercise, repeated each round.'}</p>
      <div class="field"><span>Rounds</span>${stepper('rounds', x.rounds, 'rounds', 1, 8)}</div>
      ${n > 1 ? `<div class="field"><span>Rest between exercises</span>${stepper('rest', x.rest, 'rest', 0, 60, (v) => (v ? E.clock(v) : 'None'))}</div>` : ''}
      <div class="field"><span>Rest between rounds</span>${stepper('roundRest', x.roundRest, 'round rest', 0, 180, (v) => (v ? E.clock(v) : 'None'))}</div>
      <div class="field"><span>Every interval in this block</span>${stepper('allSeconds', x.allSeconds, 'time', 15, 120, (v) => `${E.clock(v)} each`)}
        <p class="hint" style="text-align:center">${x.allTouched ? 'Will set all of them' : 'Leave as is to keep each exercise’s own time'}</p></div>
      <div class="detail-actions">
        <button class="link" data-action="block-move" data-delta="-1" ${sheet.b === 0 ? 'disabled' : ''}>Move up</button>
        <button class="link" data-action="block-move" data-delta="1" ${sheet.b >= day().blocks.length - 1 ? 'disabled' : ''}>Move down</button>
        <button class="link danger" data-action="block-remove">Delete block</button>
      </div>`;
  }

  // ----- warm-up / cool-down -----

  function sectionSheet() {
    const d = day();
    const on = sheet.sec === 'warmup' ? d.warmupOn : d.cooldownOn;
    return `<div class="sheet-top"><span></span><button class="done" data-action="close">Done</button></div>
      <h1 id="sheet-title" class="detail-name" tabindex="-1">${SEC_NAME[sheet.sec]}</h1>
      <p class="lead">${sheet.sec === 'warmup' ? 'Stretches before the intervals.' : 'Stretches after the workout, picked for the muscles this day works.'}</p>
      <div class="field"><span>Include in workout</span>${seg('section-on', on ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}</div>
      <div class="form-actions"><button class="btn ghost block" data-action="add-to" data-value="${sheet.sec}">Add a stretch</button></div>`;
  }

  // ----- after a workout -----

  function reviewSheet() {
    const s = state.sessions.find((x) => x.id === sheet.id);
    if (!s) return '';
    const x = sheet.draft;
    const rated = s.results.filter((r) => r.section === 'block' && r.done > 0);
    const intervals = s.results.filter((r) => r.section === 'block').reduce((a, r) => a + r.done, 0);
    const rows = rated.map((r, i) => `<div class="rate">
        <div class="rate-head"><div><b>${esc(r.name)}</b><span>${r.weight ? esc(E.lb(r.weight)) : 'Bodyweight'} · ${r.done} of ${r.target}</span></div></div>
        ${seg(`rate-${i}`, x.ratings[r.id] || '', [['easy', 'Too easy'], ['right', 'Just right'], ['hard', 'Too hard']])}
      </div>`).join('');
    return `<div class="sheet-top"><button data-action="close">Skip</button><button class="done" data-action="save-review">Save</button></div>
      <div class="date" style="margin-top:20px">${esc(s.dayName)}</div>
      <h1 id="sheet-title" tabindex="-1">${s.status === 'completed' ? 'Workout done' : 'Ended early'}</h1>
      <div class="stats">
        <div class="stat"><b>${minutes(s.durationSec).replace(' min', '')}</b><small>Minutes</small></div>
        <div class="stat"><b>${intervals}</b><small>Intervals</small></div>
        <div class="stat"><b>${s.completionPct}%</b><small>Done</small></div>
      </div>
      ${rows ? `<div class="section-label">How did it feel?</div>
      <p class="hint">Too easy shows ↑ next to it next time, too hard shows ↓. Tap the arrow to go up or down a dumbbell (or 5 seconds for bodyweight).</p>
      <div class="rows" style="border-top:0">${rows}</div>` : ''}
      <label class="field"><span>Note</span><textarea data-field="note" rows="3" placeholder="Anything to remember for next time">${esc(x.note)}</textarea></label>`;
  }

  function saveReview() {
    const s = state.sessions.find((x) => x.id === sheet.id);
    if (!s) { closeSheet(); return; }
    const d = state.days[s.dayId];
    const all = [...d.blocks.flatMap((b) => b.items)];
    for (const r of s.results) {
      const rating = sheet.draft.ratings[r.id];
      if (!rating || r.section !== 'block') continue;
      r.rating = rating;
      const it = all.find((y) => y.id === r.id);
      if (it) it.trend = E.trendFor(rating);
    }
    s.note = sheet.draft.note.trim();
    s.reviewed = true;
    save();
    closeSheet();
    const ups = s.results.filter((r) => r.rating === 'easy').length;
    toast(ups ? `${plural(ups, 'exercise')} ready to go up` : 'Saved');
  }

  // ----- past workout -----

  function sessionSheet() {
    const s = state.sessions.find((x) => x.id === sheet.id);
    if (!s) return '';
    const t = new Date(s.startedAt);
    const time = s.startedAt ? t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
    const RATE = { easy: 'too easy', right: 'just right', hard: 'too hard' };
    const group = (sec, label) => {
      const rs = s.results.filter((r) => r.section === sec);
      if (!rs.length) return '';
      return `<div class="section-label">${label}</div><div class="results">${rs.map((r) => `<p>${esc(r.name)}<span>${[
        r.weight ? E.lb(r.weight) : '',
        `${r.done}/${r.target}`,
        r.status === 'done' ? '' : r.status,
        r.rating ? RATE[r.rating] : '',
      ].filter(Boolean).map(esc).join(' · ')}</span></p>`).join('')}</div>`;
    };
    return `<div class="sheet-top"><span></span><button class="done" data-action="close">Done</button></div>
      <div class="date" style="margin-top:20px">${esc(longDate(s.date))}${time ? ` · ${esc(time)}` : ''}</div>
      <h1 id="sheet-title" tabindex="-1">${esc(s.dayName)}</h1>
      <div class="stats">
        <div class="stat"><b>${minutes(s.durationSec).replace(' min', '')}</b><small>Minutes</small></div>
        <div class="stat"><b>${s.results.filter((r) => r.section === 'block').reduce((a, r) => a + r.done, 0)}</b><small>Intervals</small></div>
        <div class="stat"><b>${s.completionPct}%</b><small>${s.status === 'completed' ? 'Finished' : 'Ended early'}</small></div>
      </div>
      ${group('warmup', 'Warm-up')}${group('block', 'Timed intervals')}${group('cooldown', 'Cool-down')}
      ${s.note ? `<div class="section-label">Note</div><p class="note">${esc(s.note)}</p>` : ''}
      <div class="detail-actions">
        ${s.reviewed ? '' : '<button class="link" data-action="review">Rate this workout</button>'}
        <button class="link danger" data-action="delete-session">Delete</button>
      </div>`;
  }

  // ----- settings -----

  function settingsSheet() {
    const s = state.settings;
    const RATES = [[0.85, 'Slower'], [1, 'Normal'], [1.15, 'Faster']];
    return `<div class="sheet-top"><span></span><button class="done" data-action="close">Done</button></div>
      <h1 id="sheet-title" class="detail-name" tabindex="-1">Settings</h1>
      <div class="field"><span>Voice</span>${seg('voice', s.voice ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}
        <p class="hint">Calls out each exercise, the weight to grab and the next round.</p></div>
      <div class="field"><span>Voice speed</span>${seg('voiceRate', RATES.reduce((a, [v]) => (Math.abs(v - s.voiceRate) < Math.abs(a - s.voiceRate) ? v : a), 1), RATES)}</div>
      <div class="field"><span>Tones</span>${seg('tones', s.tones ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}
        <p class="hint">A high tone starts each interval, ticks count down the last 3 seconds.</p></div>
      <div class="field"><span>Dynamic stretch pace</span>${stepper('repSeconds', s.repSeconds, 'pace', 2, 6, (v) => `${v} s per rep`)}</div>
      <div class="section-label">Data</div>
      <div class="rows">
        <button class="row-btn" data-action="export">Export backup <span>JSON</span></button>
        <button class="row-btn" data-action="import">Import backup <span>Replaces data</span></button>
        <button class="row-btn" data-action="reset-day">Reset ${esc(day().name)} <span>Back to the original</span></button>
      </div>
      <p class="hint" style="margin-top:20px">Everything stays on this device. No account.</p>`;
  }

  // ---------- actions ----------

  function openItem(sec, b, i) {
    const it = list(sec, b)[i];
    if (!it) return;
    openSheet({ type: 'item', mode: 'edit', sec, b, i, draft: JSON.parse(JSON.stringify(it)) });
  }

  function openAdd(dest) {
    const { sec, b } = destTo(dest);
    openSheet({ type: 'item', mode: 'add', dest, sec, b, i: -1, draft: newDraft(dest) });
  }

  function stepDraft(field, delta) {
    if (sheet.type === 'settings') {
      const s = state.settings;
      if (field === 'repSeconds') s.repSeconds = Math.min(6, Math.max(2, s.repSeconds + delta));
      save();
      renderSheet();
      return;
    }
    const x = sheet.draft;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    switch (field) {
      case 'seconds': x.seconds = clamp(x.seconds + delta * 5, x.kind === 'interval' ? 15 : 5, 120); break;
      case 'weight': {
        const w = x.weight || 0;
        const step = delta > 0 ? E.weightStep(w) : E.weightStep(Math.max(0, w - 0.01));
        x.weight = E.cleanWeight(clamp(w + delta * step, 0, 200));
        break;
      }
      case 'sets': x.sets = clamp(x.sets + delta, 1, 5); break;
      case 'reps': x.reps = clamp(x.reps + delta, 2, 30); break;
      case 'rounds': x.rounds = clamp(x.rounds + delta, 1, 8); break;
      case 'rest': x.rest = clamp(x.rest + delta * 5, 0, 60); break;
      case 'roundRest': x.roundRest = clamp(x.roundRest + delta * 15, 0, 180); break;
      case 'allSeconds': x.allSeconds = clamp(x.allSeconds + delta * 5, 15, 120); x.allTouched = true; break;
    }
    renderSheet();
  }

  function setSeg(field, value) {
    if (sheet.type === 'settings') {
      const s = state.settings;
      if (field === 'voice') s.voice = value === 'on';
      if (field === 'tones') s.tones = value === 'on';
      if (field === 'voiceRate') s.voiceRate = Number(value);
      save();
      renderSheet();
      if (field === 'voice' && s.voice) { Cues.unlock(s); Cues.say('Voice on.'); }
      if (field === 'voiceRate') { Cues.unlock(s); Cues.say('Next: Dumbbell bicep curl, 15 pounds.', true); }
      if (field === 'tones' && s.tones) { Cues.unlock(s); Cues.go(); }
      return;
    }
    if (sheet.type === 'section') {
      const d = day();
      if (sheet.sec === 'warmup') d.warmupOn = value === 'on';
      else d.cooldownOn = value === 'on';
      save();
      renderSheet();
      return;
    }
    if (sheet.type === 'review') {
      const s = state.sessions.find((x) => x.id === sheet.id);
      const rated = s.results.filter((r) => r.section === 'block' && r.done > 0);
      const r = rated[Number(field.slice(5))];
      if (r) sheet.draft.ratings[r.id] = sheet.draft.ratings[r.id] === value ? '' : value;
      const y = sheetEl.scrollTop;
      renderSheet();
      sheetEl.scrollTop = y;
      return;
    }
    const x = sheet.draft;
    if (field === 'kind') {
      x.kind = value;
      if (value === 'static' && x.seconds > 120) x.seconds = 30;
    }
    if (field === 'sides') x.sides = value;
    renderSheet();
  }

  function handle(el) {
    const ds = el.dataset;
    const b = ds.b != null ? Number(ds.b) : -1;
    const i = ds.i != null ? Number(ds.i) : -1;
    switch (ds.action) {
      case 'view':
        view = ds.view;
        render();
        window.scrollTo(0, 0);
        break;
      case 'start':
        beginSession();
        break;
      case 'switch':
        state.current = other(state.current);
        save();
        render();
        break;
      case 'settings':
        openSheet({ type: 'settings' });
        break;
      case 'close':
        if (sheet && sheet.type === 'review' && !sheet.fresh) openSheet({ type: 'session', id: sheet.id });
        else closeSheet();
        break;

      // workout list
      case 'item':
        openItem(ds.sec, b, i);
        break;
      case 'trend': {
        const it = list(ds.sec, b)[i];
        if (!it || !it.trend) break;
        const p = E.progress(it, it.trend);
        it.weight = p.weight;
        it.seconds = p.seconds;
        it.trend = null;
        save();
        render();
        toast(`${it.name}: ${it.weight ? E.lb(it.weight) : E.clock(it.seconds)}`);
        break;
      }
      case 'add':
        openAdd(day().blocks.length ? 'b0' : 'new');
        break;
      case 'add-to':
        openAdd(ds.value);
        break;
      case 'block': {
        const bl = day().blocks[b];
        const secs = bl.items.map((x) => x.seconds);
        openSheet({ type: 'block', b, draft: { rounds: bl.rounds, rest: bl.rest, roundRest: bl.roundRest, allSeconds: secs[0] || 45, allTouched: false } });
        break;
      }
      case 'section':
        openSheet({ type: 'section', sec: ds.sec });
        break;

      // item sheet
      case 'step':
        stepDraft(ds.field, Number(ds.delta));
        break;
      case 'seg':
        setSeg(ds.field, ds.value);
        break;
      case 'muscle': {
        const m = sheet.draft.muscles;
        const k = m.indexOf(ds.value);
        if (k === -1) m.push(ds.value); else m.splice(k, 1);
        renderSheet();
        break;
      }
      case 'dest': {
        const was = destKind(sheet.dest);
        sheet.dest = ds.value;
        const to = destTo(ds.value);
        sheet.sec = to.sec;
        sheet.b = to.b;
        if (destKind(ds.value) !== was) sheet.draft = newDraft(ds.value);
        renderSheet();
        break;
      }
      case 'pick': {
        const it = E.library().find((x) => x.name === ds.value);
        if (!it) break;
        const interval = destKind(sheet.dest) === 'interval';
        sheet.draft = { ...it, id: '', kind: interval ? 'interval' : (it.kind === 'interval' ? 'static' : it.kind), trend: null };
        const y = sheetEl.scrollTop;
        renderSheet();
        sheetEl.scrollTop = y;
        break;
      }
      case 'save-item':
        saveItem();
        break;
      case 'move': {
        const arr = list(sheet.sec, sheet.b);
        const j = sheet.i + Number(ds.delta);
        if (j < 0 || j >= arr.length) break;
        [arr[sheet.i], arr[j]] = [arr[j], arr[sheet.i]];
        save();
        closeSheet();
        break;
      }
      case 'remove': {
        const arr = list(sheet.sec, sheet.b);
        const it = arr[sheet.i];
        if (!confirm(`Remove ${it.name} from ${day().name}?`)) break;
        arr.splice(sheet.i, 1);
        save();
        closeSheet();
        toast(`Removed ${it.name}`);
        break;
      }

      // block sheet
      case 'save-block': {
        const bl = day().blocks[sheet.b];
        const x = sheet.draft;
        bl.rounds = x.rounds;
        bl.rest = x.rest;
        bl.roundRest = x.roundRest;
        if (x.allTouched) bl.items.forEach((it) => { it.seconds = x.allSeconds; });
        save();
        closeSheet();
        break;
      }
      case 'block-move': {
        const arr = day().blocks;
        const j = sheet.b + Number(ds.delta);
        if (j < 0 || j >= arr.length) break;
        [arr[sheet.b], arr[j]] = [arr[j], arr[sheet.b]];
        save();
        closeSheet();
        break;
      }
      case 'block-remove': {
        const bl = day().blocks[sheet.b];
        const msg = bl.items.length ? `Delete block ${sheet.b + 1} and its ${plural(bl.items.length, 'exercise')}?` : `Delete block ${sheet.b + 1}?`;
        if (!confirm(msg)) break;
        day().blocks.splice(sheet.b, 1);
        save();
        closeSheet();
        break;
      }

      // review & history
      case 'save-review':
        saveReview();
        break;
      case 'review': {
        const s = state.sessions.find((x) => x.id === sheet.id);
        const ratings = {};
        s.results.forEach((r) => { if (r.rating) ratings[r.id] = r.rating; });
        openSheet({ type: 'review', id: s.id, draft: { ratings, note: s.note }, fresh: false });
        break;
      }
      case 'session':
        openSheet({ type: 'session', id: ds.id });
        break;
      case 'delete-session':
        if (!confirm('Delete this workout from your log?')) break;
        state.sessions = state.sessions.filter((x) => x.id !== sheet.id);
        save();
        closeSheet();
        break;
      case 'month': {
        const [y, m] = calMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + Number(ds.delta), 1);
        calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        render();
        break;
      }

      // settings
      case 'export':
        shareFile(JSON.stringify(state, null, 1), `work-it-${today()}.json`, 'application/json', 'Work it backup');
        break;
      case 'import':
        importData();
        break;
      case 'reset-day': {
        const d = day();
        if (!confirm(`Reset ${d.name} to the original exercises? Your log is kept.`)) break;
        state.days[d.id] = JSON.parse(JSON.stringify(E.SEED_DAYS[d.id]));
        save();
        closeSheet();
        toast(`${d.name} reset`);
        break;
      }
    }
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el || el.disabled) return;
    handle(el);
  });

  sheetEl.addEventListener('input', (ev) => {
    const el = ev.target;
    if (!sheet || !sheet.draft || !el.dataset.field) return;
    sheet.draft[el.dataset.field] = el.value;
    const done = sheetEl.querySelector('[data-action="save-item"]');
    if (done && el.dataset.field === 'name') done.disabled = !el.value.trim();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (sheet) {
      if (sheet.type === 'review' && !sheet.fresh) openSheet({ type: 'session', id: sheet.id });
      else closeSheet();
    } else if (R) {
      if (R.pausedAt == null) pause(); else resume();
    }
  });

  // Pause when the app goes to the background: timers don't run there.
  function checkDay() {
    const t = today();
    if (t !== lastToday) {
      lastToday = t;
      if (!R && !sheet) render();
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (R) pause(); }
    else { checkDay(); if (R) lockScreen(); }
  });
  window.addEventListener('pagehide', () => { if (R) pause(); });
  setInterval(checkDay, 60000);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
  if (state.active && state.active.date === today()) toast('Workout in progress · tap Resume');
})();
