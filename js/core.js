/* Pure learning rules and browser adapters. No DOM is needed to require this file. */
(function (root) {
  'use strict';
  const VERSION = 3;
  const STORAGE_KEY = 'kokki-quiz';
  const INTERVALS = [1, 1, 3, 7, 14, 30, 60];
  const DEFAULTS = Object.freeze({ newPerDay: 3, sessionLimit: 15, choices: 3, hiragana: false,
    audioRate: 1, sound: true, flashDelay: 1 });
  const CONTINENTS = Object.freeze({
    asia: { name: 'アジア', kana: 'あじあ', color: '#f8c54d', icon: '🐼' },
    europe: { name: 'ヨーロッパ', kana: 'よーろっぱ', color: '#ac9dea', icon: '🏰' },
    africa: { name: 'アフリカ', kana: 'あふりか', color: '#f4a374', icon: '🦁' },
    north_america: { name: '北アメリカ', kana: 'きたあめりか', color: '#80c9a7', icon: '🐻' },
    south_america: { name: '南アメリカ', kana: 'みなみあめりか', color: '#f19db2', icon: '🦙' },
    oceania: { name: 'オセアニア', kana: 'おせあにあ', color: '#75c9e6', icon: '🐨' }
  });
  const copy = value => JSON.parse(JSON.stringify(value));
  function localDay(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  // UTC is only an arithmetic representation of the local calendar fields, never a 24h timer.
  function dayNumber(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('日付の形式が正しくありません');
    const [y, m, d] = day.split('-').map(Number);
    if (y < 1900 || y > 2200) throw new Error('日付の範囲が正しくありません');
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new Error('存在しない日付です');
    return Math.floor(dt.getTime() / 86400000);
  }
  function addDays(day, n) { return new Date((dayNumber(day) + n) * 86400000).toISOString().slice(0, 10); }
  function daysBetween(a, b) { return dayNumber(b) - dayNumber(a); }
  function createState(today) {
    const day = today || localDay(); dayNumber(day);
    return { version: VERSION, startDate: day, settings: { ...DEFAULTS }, progress: {}, days: {}, medals: [] };
  }
  function blankProgress(day) {
    return { introducedOn: day, box: 0, due: day, gradedDays: [], history: [], wrongStreak: 0,
      total: 0, correct: 0, said: false, sticker: false };
  }
  function ensureDay(state, day) {
    if (!state.days[day]) state.days[day] = { prepared: false, introduced: [], seenIntro: [], answers: 0, correct: 0, learned: 0, said: 0, active: false };
    return state.days[day];
  }
  function learnedCount(state) { return Object.values(state.progress).filter(p => p.box >= 4).length; }
  function stickerCount(state) { return Object.values(state.progress).filter(p => p.sticker).length; }
  function saidCount(state) {
    return Object.values(state.progress).filter(p => p.said).length +
      Object.entries(state.practice || {}).filter(([id, p]) => !state.progress[id] && p.said).length;
  }
  function snapshot(state, day) {
    const d = ensureDay(state, day); d.learned = learnedCount(state); d.said = saidCount(state);
    const count = stickerCount(state);
    state.medals = [...new Set([...state.medals, ...[10, 25, 50, 100, 150, 199].filter(n => count >= n)])].sort((a, b) => a - b);
  }
  function dueCountries(state, countries, day) {
    return countries.filter(c => {
      const p = state.progress[c.id]; return p && p.due <= day && !p.gradedDays.includes(day);
    }).sort((a, b) => {
      const x = state.progress[a.id], y = state.progress[b.id];
      return x.due.localeCompare(y.due) || x.box - y.box || a.order - b.order;
    });
  }
  function prepareDaily(input, countries, day) {
    dayNumber(day);
    const state = copy(input), daily = ensureDay(state, day);
    if (!daily.prepared) {
      const overdue = dueCountries(state, countries, day).length;
      const quota = overdue > state.settings.sessionLimit * 2 ? 1 : state.settings.newPerDay;
      const fresh = countries.filter(c => !state.progress[c.id]).sort((a, b) => a.order - b.order).slice(0, quota);
      fresh.forEach(c => {
        const practice = (state.practice || {})[c.id];
        state.progress[c.id] = { ...blankProgress(day), ...(practice || {}) };
        if (practice) delete state.practice[c.id];
        daily.introduced.push(c.id);
      });
      daily.prepared = true;
    }
    snapshot(state, day);
    return state;
  }
  function markIntro(input, id, day) {
    const state = copy(input), daily = ensureDay(state, day);
    if (daily.introduced.includes(id) && !daily.seenIntro.includes(id)) daily.seenIntro.push(id);
    return state;
  }
  function recordActivity(input, day) {
    const state = copy(input); ensureDay(state, day).active = true; snapshot(state, day); return state;
  }
  function buildSession(state, countries, day) {
    const daily = state.days[day] || { introduced: [], seenIntro: [] };
    const available = dueCountries(state, countries, day);
    const newIds = daily.introduced.filter(id => state.progress[id] && !state.progress[id].gradedDays.includes(day));
    const review = available.filter(c => !newIds.includes(c.id)).map(c => c.id);
    const allIds = [...newIds, ...review], ids = allIds.slice(0, state.settings.sessionLimit);
    return { ids, introIds: daily.introduced.filter(id => !daily.seenIntro.includes(id)), remaining: Math.max(0, allIds.length - ids.length) };
  }
  function transition(progress, correct, day, graded) {
    const p = copy(progress);
    p.history = [...p.history, !!correct].slice(-5); p.total += 1; p.correct += correct ? 1 : 0;
    p.wrongStreak = correct ? 0 : p.wrongStreak + 1;
    if (graded && !p.gradedDays.includes(day)) {
      p.box = correct ? Math.min(6, p.box + 1) : Math.max(0, p.box - 2);
      p.due = addDays(day, INTERVALS[p.box]); p.gradedDays.push(day);
    }
    if (p.box >= 4) p.sticker = true;
    return p;
  }
  function recordAnswer(input, id, correct, day, mode) {
    const state = copy(input);
    // Free play never introduces a country or changes its SRS box.
    const p = state.progress[id] || blankProgress(day);
    const daily = ensureDay(state, day);
    daily.active = true;
    daily.answers += 1; daily.correct += correct ? 1 : 0;
    if (state.progress[id]) state.progress[id] = transition(p, correct, day, mode === 'daily');
    else {
      // Unintroduced countries' practice statistics are kept separately until introduction.
      state.practice = state.practice || {};
      const prior = state.practice[id] || { history: [], wrongStreak: 0, total: 0, correct: 0 };
      prior.history = [...prior.history, !!correct].slice(-5);
      prior.wrongStreak = correct ? 0 : prior.wrongStreak + 1;
      prior.total += 1; prior.correct += correct ? 1 : 0; state.practice[id] = prior;
    }
    snapshot(state, day); return state;
  }
  function recordRecall(input, id, correct, day) {
    let state = recordAnswer(input, id, correct, day, 'recall');
    const p = state.progress[id];
    if (p) {
      p.said = !!correct;
      if (!correct) { p.box = Math.max(0, p.box - 1); p.due = addDays(day, INTERVALS[p.box]); }
    } else {
      // A recall success can be retained without adding the country to the daily curriculum.
      state.practice[id].said = !!correct;
    }
    snapshot(state, day); return state;
  }
  function isWeak(p) { return !!p && (p.wrongStreak >= 2 || (p.history.length > 0 && p.history.filter(Boolean).length / p.history.length < 0.6)); }
  function weakCountries(state, countries) {
    return countries.filter(c => isWeak(state.progress[c.id]) || isWeak((state.practice || {})[c.id]));
  }
  function shuffle(items, random) {
    const a = items.slice(), rng = random || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function areTwins(a, b) { return a.twin === b.id || b.twin === a.id; }
  function selectChoices(target, countries, state, random, requested, options) {
    const rng = random || Math.random, p = state.progress[target.id];
    const box = p ? p.box : 0, opts = options || {};
    const limit = Math.max(2, Math.min(4, requested || state.settings.choices));
    const count = opts.fixed ? limit : (box <= 1 ? 2 : limit);
    const selected = [target], similar = new Set(target.similar || []);
    const mixSimilar = !!opts.allowSimilar || (box >= 3 && rng() < 0.5);
    const allowed = c => c.id !== target.id && !selected.some(s => s.id === c.id || areTwins(c, s)) &&
      (mixSimilar || !similar.has(c.id));
    const introduced = shuffle(countries.filter(c => state.progress[c.id] && c.id !== target.id), rng);
    const nearby = countries.filter(c => !state.progress[c.id] && c.id !== target.id)
      .sort((a, b) => Math.abs(a.order - target.order) - Math.abs(b.order - target.order) || a.order - b.order);
    for (const pool of [introduced, nearby]) {
      if (mixSimilar && !opts.allowSimilar && selected.length < count && !selected.some(c => similar.has(c.id))) {
        const preferred = pool.find(c => similar.has(c.id) && allowed(c));
        if (preferred) selected.push(preferred);
      }
      for (const c of pool) { if (selected.length >= count) break; if (allowed(c)) selected.push(c); }
    }
    return shuffle(selected, rng);
  }
  function appendRetries(ids, wrongIds) { return [...ids, ...[...new Set(wrongIds)].slice(0, 5)]; }
  function streak(state, day) {
    let cursor = day, count = 0;
    const active = date => state.days[date] && (state.days[date].active || state.days[date].answers > 0);
    if (!active(cursor)) cursor = addDays(cursor, -1);
    while (active(cursor)) { count++; cursor = addDays(cursor, -1); }
    return count;
  }
  function normalizedSettings(raw) {
    const s = raw || {}, result = { ...DEFAULTS };
    for (const [key, values] of Object.entries({ newPerDay: [2, 3, 4, 5], sessionLimit: [10, 15, 20], choices: [2, 3, 4],
      audioRate: [0.7, 0.9, 1, 1.1, 1.25], flashDelay: [0.5, 1, 2] })) {
      if (s[key] !== undefined) { if (!values.includes(s[key])) throw new Error(`設定 ${key} の値が正しくありません`); result[key] = s[key]; }
    }
    for (const key of ['hiragana', 'sound']) if (s[key] !== undefined) {
      if (typeof s[key] !== 'boolean') throw new Error(`設定 ${key} の値が正しくありません`); result[key] = s[key];
    }
    return result;
  }
  function validateBackup(raw, countries, today) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('バックアップの形式が正しくありません');
    if (![1, 2, VERSION].includes(raw.version)) throw new Error('このバージョンのバックアップには対応していません');
    const state = createState(raw.startDate || today || localDay()); state.settings = normalizedSettings(raw.settings);
    // Generated audio already speaks at speedScale 0.9. Remove the old default's extra slowdown.
    if (raw.version < VERSION && state.settings.audioRate === 0.9) state.settings.audioRate = 1;
    const known = new Set(countries.map(c => c.id));
    const integer = (v, max) => Number.isSafeInteger(v) && v >= 0 && v <= max;
    const object = v => v && typeof v === 'object' && !Array.isArray(v);
    if (!object(raw.progress) || (raw.days !== undefined && !object(raw.days))) throw new Error('学習記録の形式が正しくありません');
    const validIds = values => Array.isArray(values) && values.every(v => typeof v === 'string' && known.has(v)) && new Set(values).size === values.length;
    function stats(p) {
      if (!Array.isArray(p.history) || p.history.length > 5 || !p.history.every(x => typeof x === 'boolean') ||
        !integer(p.total, 10000000) || p.history.length > p.total || !integer(p.correct, p.total) ||
        !integer(p.wrongStreak, p.total - p.correct)) throw new Error('正誤記録が正しくありません');
      return { history: p.history.slice(), total: p.total, correct: p.correct, wrongStreak: p.wrongStreak };
    }
    for (const [id, original] of Object.entries(raw.progress)) {
      if (!known.has(id) || !object(original)) throw new Error(`不明な国の記録です: ${id}`);
      const p = { ...original };
      if (raw.version === 1) {
        p.introducedOn = p.introducedOn || state.startDate;
        p.gradedDays = p.gradedDays || (p.lastGradedDay ? [p.lastGradedDay] : []);
        p.sticker = p.sticker === undefined ? p.box >= 4 : p.sticker;
        p.said = p.said === undefined ? false : p.said;
      }
      if (!integer(p.box, 6) || typeof p.said !== 'boolean' || typeof p.sticker !== 'boolean' || !Array.isArray(p.gradedDays) ||
        p.gradedDays.length > 110000 || new Set(p.gradedDays).size !== p.gradedDays.length) throw new Error('復習記録が正しくありません');
      dayNumber(p.due); dayNumber(p.introducedOn); p.gradedDays.forEach(dayNumber);
      state.progress[id] = { introducedOn: p.introducedOn, box: p.box, due: p.due, gradedDays: p.gradedDays.slice(),
        ...stats(p), said: p.said, sticker: p.sticker || p.box >= 4 };
    }
    for (const [day, original] of Object.entries(raw.days || {})) {
      dayNumber(day); if (!object(original)) throw new Error('カレンダー記録が正しくありません');
      const d = { ...original };
      if (raw.version === 1) { d.seenIntro = d.seenIntro || []; d.said = d.said || 0; d.prepared = !!d.prepared; }
      if (d.active === undefined) d.active = d.answers > 0;
      if (typeof d.prepared !== 'boolean' || !validIds(d.introduced) || !validIds(d.seenIntro) ||
        d.introduced.some(id => !state.progress[id]) || d.seenIntro.some(id => !d.introduced.includes(id)) ||
        typeof d.active !== 'boolean' || !integer(d.answers, 10000000) || !integer(d.correct, d.answers) ||
        !integer(d.learned, countries.length) || !integer(d.said, countries.length)) throw new Error('カレンダー記録が正しくありません');
      state.days[day] = { prepared: d.prepared, introduced: d.introduced.slice(), seenIntro: d.seenIntro.slice(),
        answers: d.answers, correct: d.correct, learned: d.learned, said: d.said, active: d.active };
    }
    if (raw.practice !== undefined) {
      if (!object(raw.practice)) throw new Error('自由あそびの記録が正しくありません');
      state.practice = {};
      for (const [id, p] of Object.entries(raw.practice)) {
        if (!known.has(id) || !object(p) || (p.said !== undefined && typeof p.said !== 'boolean')) throw new Error('自由あそびの記録が正しくありません');
        state.practice[id] = { ...stats(p), ...(p.said === undefined ? {} : { said: p.said }) };
      }
    }
    const allowedMedals = [10, 25, 50, 100, 150, 199];
    if (raw.medals !== undefined && (!Array.isArray(raw.medals) || raw.medals.some(n => !allowedMedals.includes(n)))) throw new Error('メダル記録が正しくありません');
    state.medals = [...new Set(raw.medals || [])]; return state;
  }
  function loadState(storage, countries, day) {
    let raw = null;
    try {
      raw = storage.getItem(STORAGE_KEY);
      return { state: raw === null ? createState(day) : validateBackup(JSON.parse(raw), countries, day), error: null };
    } catch (error) {
      if (raw !== null) try {
        const now = new Date(), stamp = localDay(now).replace(/-/g, '') +
          [now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2, '0')).join('');
        storage.setItem(`kokki-quiz-broken-${stamp}`, raw);
      } catch (_) {}
      return { state: createState(day), error };
    }
  }
  function saveState(storage, state) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (_) { return false; }
  }
  class AudioPackLoader {
    constructor({ document = root.document, timeout = 8000,
      schedule = (fn, ms) => setTimeout(fn, ms), unschedule = id => clearTimeout(id) } = {}) {
      this.document = document; this.timeout = timeout; this.schedule = schedule; this.unschedule = unschedule;
      this.cache = new Map(); this.pending = new Map();
    }
    register(id, clips) {
      if (!/^[a-z0-9_-]+$/.test(id) || !clips || typeof clips !== 'object') return;
      const pack = Object.fromEntries(Object.entries(clips).filter(([, uri]) =>
        typeof uri === 'string' && uri.startsWith('data:audio/mp4;base64,')));
      this.cache.set(id, pack);
      const pending = this.pending.get(id); if (pending) pending.finish(pack);
    }
    load(id) {
      if (!/^[a-z0-9_-]+$/.test(id)) return Promise.resolve(null);
      if (this.cache.has(id)) return Promise.resolve(this.cache.get(id));
      if (this.pending.has(id)) return this.pending.get(id).promise;
      const script = this.document.createElement('script');
      let resolve, timer, done = false;
      const promise = new Promise(complete => { resolve = complete; });
      const finish = pack => {
        if (done) return; done = true;
        this.unschedule(timer); script.onload = null; script.onerror = null; script.remove();
        this.cache.set(id, pack); this.pending.delete(id); resolve(pack);
      };
      this.pending.set(id, { promise, finish });
      script.src = `audio/pack/${id}.js`; script.async = true;
      script.onload = () => finish(this.cache.get(id) || null);
      script.onerror = () => finish(null);
      timer = this.schedule(() => finish(null), this.timeout);
      try { this.document.head.appendChild(script); } catch (_) { finish(null); }
      return promise;
    }
    preload(ids) { return Promise.all([...new Set(ids)].map(id => this.load(id))); }
  }
  const api = { VERSION, STORAGE_KEY, INTERVALS, DEFAULTS, CONTINENTS, localDay, dayNumber, addDays, daysBetween,
    createState, blankProgress, prepareDaily, markIntro, recordActivity, buildSession, dueCountries, transition, recordAnswer,
    recordRecall, learnedCount, stickerCount, saidCount, isWeak, weakCountries, shuffle, areTwins, selectChoices,
    appendRetries, streak, normalizedSettings, validateBackup, migrateStorage: validateBackup, loadState, saveState, AudioPackLoader };
  root.KQ = Object.assign(root.KQ || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* A single media element is reused throughout the app. */
(function (root) {
  'use strict';
  if (!root.document) return;
  class AudioPlayer {
    constructor(settings, onBlocked, onNotice) {
      this.settings = settings; this.onBlocked = onBlocked; this.onNotice = onNotice;
      this.element = new Audio(); this.element.preload = 'auto'; this.element.playsInline = true;
      this.ticket = 0; this.context = null; this.finish = null; this.pending = null;
    }
    unlock() {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (AC && !this.context) { try { this.context = new AC(); } catch (_) {} }
      if (this.context && this.context.state === 'suspended') this.context.resume().catch(() => {});
      // Called synchronously in the first user gesture, including on Safari.
      this.element.src = 'data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA';
      const play = this.element.play(); if (play) play.catch(() => {});
    }
    cancel() {
      this.ticket++; this.element.pause(); this.element.onended = null; this.element.onerror = null;
      if (root.speechSynthesis) root.speechSynthesis.cancel();
      if (this.finish) this.finish(false);
      this.finish = null; this.pending = null; this.onBlocked(null);
    }
    play(src, text, onStart) {
      this.cancel(); const ticket = this.ticket;
      return new Promise(resolve => {
        let done = false, fallback = false;
        const finish = result => { if (done) return; done = true; this.finish = null; this.pending = null; this.onBlocked(null); resolve(result); };
        this.finish = finish;
        const speak = () => {
          if (done || ticket !== this.ticket || fallback) return;
          fallback = true;
          this.element.pause(); this.element.onended = null;
          if (!root.speechSynthesis || !root.SpeechSynthesisUtterance) { this.onNotice('おとが でないときは おうちのひとと よんでね'); finish(true); return; }
          const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ja-JP'; utterance.rate = this.settings().audioRate;
          const voice = root.speechSynthesis.getVoices().find(v => /^ja[-_]JP/i.test(v.lang)); if (voice) utterance.voice = voice;
          utterance.onend = () => finish(true); utterance.onerror = () => finish(true);
          if (onStart) onStart(); root.speechSynthesis.speak(utterance);
        };
        const start = () => {
          if (done || ticket !== this.ticket) return;
          this.onBlocked(null);
          this.element.src = src; this.element.defaultPlaybackRate = this.settings().audioRate;
          this.element.playbackRate = this.settings().audioRate;
          this.element.onended = () => finish(true); this.element.onerror = speak;
          let promise;
          try { promise = this.element.play(); } catch (_) { this.pending = start; this.onBlocked(text); return; }
          if (promise) promise.then(() => { if (!done && ticket === this.ticket && onStart) onStart(); }).catch(() => {
            if (done || ticket !== this.ticket || fallback) return;
            if (this.element.error) { speak(); return; }
            this.pending = start; this.onBlocked(text);
          });
        };
        // Claim the playback ticket before waiting for the script, so a tap or
        // navigation cancels loading playback just as it cancels playing media.
        if (src && typeof src.then === 'function') {
          src.then(value => {
            if (done || ticket !== this.ticket) return;
            src = value; if (src) start(); else speak();
          }, speak);
        } else if (src) start(); else speak();
      });
    }
    replayBlocked() {
      if (this.context && this.context.state === 'suspended') this.context.resume().catch(() => {});
      const pending = this.pending; if (pending) pending();
    }
    effect() {
      if (!this.settings().sound || !this.context) return;
      const ctx = this.context;
      [523.25, 659.25, 783.99].forEach((frequency, i) => {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + i * 0.11;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.09, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.27);
        oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start + 0.3);
      });
    }
  }
  root.KQ.AudioPlayer = AudioPlayer;
})(typeof window !== 'undefined' ? window : globalThis);
