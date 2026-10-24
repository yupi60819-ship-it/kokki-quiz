(function () {
  'use strict';
  const K = window.KQ, U = window.KQUI, app = document.getElementById('app');
  const countries = Array.isArray(window.COUNTRIES) ? window.COUNTRIES.slice().sort((a, b) => a.order - b.order) : [];
  const embedded = window.self !== window.top;
  const $ = id => document.getElementById(id), byId = id => countries.find(c => c.id === id);
  let storage = null, state, storageOK = true, current = 'welcome', view = 0, timer = null, toastTimer = null;
  let atlasFilter = 'all', calendarMonth = K.localDay().slice(0, 7), quiz = null, flash = null, pair = null, printList = [];
  let gateTimer = null, gateButton = null, gatePoint = null, pendingConfirmation = null;
  const packs = new K.AudioPackLoader();
  window.KQ_AUDIO_PACK = (id, clips) => packs.register(id, clips);
  packs.load('phrases');
  function notice(text) {
    $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  }
  const player = new K.AudioPlayer(() => state ? state.settings : K.DEFAULTS, text => {
    $('audio-gate').hidden = !text; $('audio-gate-text').textContent = text || '';
  }, notice);
  function save() {
    const success = K.saveState(storage, state);
    if (!success) storageOK = false;
    $('save-warning').hidden = storageOK;
    const streak = K.streak(state, K.localDay());
    $('header-streak').textContent = streak ? `🌱 ${streak}にちの ぼうけん` : '🌱 きょうも いっぽ';
  }
  function show(html, screen) {
    clearTimeout(timer); timer = null; player.cancel(); stopGate(); current = screen; view++;
    pendingConfirmation = null;
    if (document.body.dataset) document.body.dataset.screen = screen;
    app.innerHTML = html; app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    return view;
  }
  function speak(kind, id, onStart) {
    if (kind === 'continent') return speak('phrase', `continent_${id}`, onStart);
    if (kind === 'phrase') return player.play(packs.load('phrases').then(pack => pack && pack[id]),
      (window.AUDIO_PHRASES || {})[id] || '', onStart);
    const c = byId(id); if (!c) return Promise.resolve(false);
    const name = c.name, capital = c.capital;
    const text = { name, question: `${name}の国旗はどれかな`,
      capital: `${name}の首都は、${capital}だよ`, capname: capital, desc: c.descSpeech }[kind];
    return player.play(packs.load(c.id).then(pack => pack && pack[kind]), text || c.name, onStart);
  }
  function celebrate() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#ffcc55', '#74b6df', '#9ad1b0', '#f29fb1', '#b69dde'];
    const container = $('celebration');
    container.innerHTML = Array.from({ length: 24 }, (_, i) => `<i class="confetti" style="left:${(i * 47) % 100}%;background:${colors[i % colors.length]};animation-delay:${i % 5 * 0.07}s;transform:rotate(${i * 17}deg)"></i>`).join('');
    setTimeout(() => { container.innerHTML = ''; }, 2500);
  }
  function home() { show(U.home(state, countries, K.localDay()), 'home'); save(); }
  function scopeCountries(scope, continent) {
    const day = state.days[K.localDay()], ids = day ? day.introduced : [];
    return countries.filter(c => (continent === 'all' || c.continent === continent) &&
      (scope === 'all' || (scope === 'today' && ids.includes(c.id)) ||
        (scope === 'learned' && state.progress[c.id] && state.progress[c.id].box >= 4) ||
        (scope === 'introduced' && state.progress[c.id])));
  }
  function empty(title, text) {
    show(`<section class="panel center"><span class="result-icon">🌱</span><h1>${title}</h1><p>${text}</p><div class="actions">${U.button('きょうの ぼうけん', 'daily', {}, 'primary')}${U.button('おうちへ', 'home')}</div></section>`, 'empty');
  }
  function daily() {
    const today = K.localDay(); state = K.prepareDaily(state, countries, today); save();
    const session = K.buildSession(state, countries, today);
    quiz = { mode: 'flag', daily: true, day: today, ids: session.ids, introIds: session.introIds,
      introIndex: 0, index: 0, wrong: [], retriesAdded: false, correct: 0, answered: false, newMedals: [], newStickers: 0 };
    if (quiz.introIds.length) introduction();
    else if (quiz.ids.length) question();
    else result();
  }
  function introduction() {
    const c = byId(quiz.introIds[quiz.introIndex]);
    if (!c) { question(); return; }
    packs.preload([c.id]);
    state = K.recordActivity(state, K.localDay()); save();
    show(`${U.progress(quiz.introIndex, quiz.introIds.length, 'あたらしい おともだち')}<section class="panel center"><p class="eyebrow">🌱 はじめまして！</p><h1 class="country-title">${U.name(c, state.settings)}</h1>${U.flag(c, 'large')}${U.speaker('name', c.id)}<div class="actions">${U.button('🏰 しゅとを きく', 'speak', { kind: 'capital', id: c.id }, 'warm')}${U.button('🐾 おはなしを きく', 'speak', { kind: 'desc', id: c.id }, 'secondary')}</div></section><div class="actions">${U.button(quiz.introIndex + 1 < quiz.introIds.length ? 'つぎの おともだち ➜' : 'あそんで みよう！ ➜', 'intro-next', {}, 'primary')}</div>`, 'intro');
    speak('name', c.id);
  }
  function introNext() {
    const id = quiz.introIds[quiz.introIndex]; state = K.markIntro(state, id, quiz.day); save();
    quiz.introIndex++;
    if (quiz.introIndex < quiz.introIds.length) introduction(); else question();
  }
  function play(mode, custom) {
    let pool = custom || countries.filter(c => state.progress[c.id]);
    if (!pool.length) pool = countries.slice(0, 12);
    pool = K.shuffle(pool).slice(0, 10);
    if (!pool.length) { empty('まだ じゅんびちゅうだよ', 'くにの データが そろったら あそぼう！'); return; }
    quiz = { mode, daily: false, ids: pool.map(c => c.id), index: 0, wrong: [], retriesAdded: false,
      correct: 0, answered: false, newMedals: [], newStickers: 0 };
    question();
  }
  function question() {
    if (!quiz || quiz.index >= quiz.ids.length) { result(); return; }
    const c = byId(quiz.ids[quiz.index]); if (!c) { quiz.index++; question(); return; }
    packs.preload([c.id]);
    quiz.answered = false; quiz.revealed = false;
    const mode = quiz.mode;
    let prompt, choices = [], body = '', audioKind;
    if (mode === 'recall') {
      const v = show(`${U.progress(quiz.index, quiz.ids.length, '🎤 いえるかな？')}<section class="panel center"><h1>この こっき、いえるかな？</h1>${U.flag(c, 'large')}<p class="muted">こえに だして みよう！</p><div id="recall-answer" class="recall-answer">${U.button('🔊 こたえを きく', 'recall-reveal', {}, 'primary')}</div></section><p class="small muted center">おうちのかたと いっしょに あそぼう。こえは ろくおん されないよ。</p>`, 'quiz');
      if (v === view) speak('phrase', 'whichCountry'); return;
    }
    if (mode === 'continent') {
      prompt = 'どこの たいりく？'; audioKind = 'whichContinent';
      body = U.flag(c, 'medium');
      choices = Object.entries(K.CONTINENTS).map(([id, info]) => ({ id, label: `${info.icon}<br>${info.kana}`, kind: 'continent', color: info.color, correct: id === c.continent }));
    } else if (mode === 'capital') {
      prompt = `${U.name(c, state.settings)}の<br>しゅとは どこかな？`; audioKind = 'whichCapital';
      body = U.flag(c, 'medium');
      // Capitals always have three spoken choices; equivalent capital labels are deduplicated.
      const capitals = new Set([c.capital]);
      const distinct = [c, ...countries.filter(x => {
        if (capitals.has(x.capital)) return false; capitals.add(x.capital); return true;
      })];
      const options = K.selectChoices(c, distinct, state, Math.random, 3, { fixed: true, allowSimilar: true });
      const seen = new Set();
      choices = options.filter(x => { if (seen.has(x.capital)) return false; seen.add(x.capital); return true; }).map(x => ({ id: x.id, label: U.name(x, state.settings, true), kind: 'capname', correct: x.id === c.id }));
    } else {
      prompt = mode === 'name' ? 'この こっきの なまえは？' : `${U.name(c, state.settings)}の<br>こっきは どれかな？`;
      audioKind = mode === 'name' ? 'whichCountry' : null;
      if (mode === 'name') body = U.flag(c, 'medium');
      let options;
      if (mode === 'similar' && quiz.pairIds && quiz.pairIds.includes(c.id)) {
        options = quiz.pairIds.map(byId).filter(Boolean);
        if (options.length !== 2 || K.areTwins(options[0], options[1])) options = K.selectChoices(c, countries, state, Math.random, 2);
        else options = K.shuffle(options);
      } else options = K.selectChoices(c, countries, state);
      choices = options.map(x => ({ id: x.id, label: mode === 'name' ? U.name(x, state.settings) : U.flag(x), kind: mode === 'name' ? 'name' : null, correct: x.id === c.id }));
    }
    if (choices.length < 2) { empty('いっしょに ずかんを みよう', 'えらべる こっきが そろうまで、ずかんで あそんでね。'); return; }
    quiz.choices = choices;
    packs.preload(choices.filter(option => byId(option.id)).map(option => option.id));
    const v = show(`${U.progress(quiz.index, quiz.ids.length, quiz.daily ? 'きょうの ぼうけん' : 'じゆう あそび')}<div class="question-layout${mode === 'continent' ? ' continent-question' : ''}"><h1 class="quiz-prompt">${prompt}</h1>${body}${U.button('🔊 もういちど きく', 'question-audio', {}, 'question-audio')}<div class="choices count-${choices.length}${mode === 'name' ? ' name-choices' : ''}">${choices.map(option => `<div class="choice-card" data-choice="${U.escape(option.id)}"${option.color ? ` style="background:${option.color}55"` : ''}>${U.button(option.label, 'answer', { id: option.id }, 'answer')}${option.kind ? U.speaker(option.kind, option.id, 'えらぶまえに なまえを きく') : ''}</div>`).join('')}</div><div id="feedback" class="feedback" role="status" aria-live="polite"></div></div>`, 'quiz');
    narrateQuestion(v, c, audioKind);
  }
  async function narrateQuestion(v, c, phrase) {
    const mode = quiz.mode;
    if (mode === 'capital') {
      const named = await speak('name', c.id);
      if (!named || v !== view || quiz.answered) return;
    }
    const ok = phrase ? await speak('phrase', phrase) : await speak('question', c.id);
    if (!ok || v !== view || quiz.answered) return;
    if (mode === 'capital' || mode === 'name' || mode === 'continent') {
      for (const option of quiz.choices) {
        if (v !== view || quiz.answered) break;
        const element = app.querySelector(`[data-choice="${option.id}"]`);
        const playback = speak(option.kind, option.id, () => { if (element) element.classList.add('speaking'); });
        const ticket = player.ticket, played = await playback;
        if (element && ticket === player.ticket) element.classList.remove('speaking');
        if (!played) break;
      }
    }
  }
  function questionAudio() {
    if (!quiz || quiz.answered) return;
    const phrase = { name: 'whichCountry', capital: 'whichCapital', continent: 'whichContinent' }[quiz.mode];
    narrateQuestion(view, byId(quiz.ids[quiz.index]), phrase);
  }
  function afterAnswer(correct, recall) {
    const id = quiz.ids[quiz.index], today = K.localDay(), beforeStickers = K.stickerCount(state), beforeMedals = state.medals.slice();
    state = recall ? K.recordRecall(state, id, correct, today) : K.recordAnswer(state, id, correct, today, quiz.daily ? 'daily' : 'free');
    quiz.newStickers += K.stickerCount(state) - beforeStickers;
    quiz.newMedals.push(...state.medals.filter(n => !beforeMedals.includes(n))); save();
    if (correct) quiz.correct++; else if (!quiz.retriesAdded && !quiz.wrong.includes(id)) quiz.wrong.push(id);
  }
  async function answer(id) {
    if (!quiz || quiz.answered) return;
    const option = quiz.choices.find(c => c.id === id); if (!option) return;
    quiz.answered = true; player.cancel();
    const correct = option.correct, v = view, c = byId(quiz.ids[quiz.index]); afterAnswer(correct, false);
    app.querySelectorAll('.choice-card').forEach(element => {
      const entry = quiz.choices.find(x => x.id === element.dataset.choice);
      element.classList.toggle('correct', !!entry.correct); element.classList.toggle('selected', element.dataset.choice === id);
      element.querySelector('.answer').disabled = true; element.classList.remove('speaking');
    });
    $('feedback').innerHTML = `<h2>${correct ? '⭐ せいかい！' : '🌼 おしいね。これだよ'}</h2><p>${quiz.mode === 'capital' ? U.name(c, state.settings, true) : quiz.mode === 'continent' ? K.CONTINENTS[c.continent].kana : U.name(c, state.settings)}</p>${U.button('つぎへ ➜', 'next', {}, 'primary')}${quiz.mode === 'continent' ? U.map(c, countries, true) : ''}`;
    if (correct) { player.effect(); celebrate(); await speak('phrase', ['correct', 'great', 'yatta', 'wellDone'][quiz.index % 4]); }
    else {
      const played = await speak('phrase', 'oshii');
      if (played && view === v) {
        if (quiz.mode === 'continent') await speak('continent', c.continent);
        else await speak(quiz.mode === 'capital' ? 'capname' : 'name', c.id);
      }
    }
  }
  function recallReveal() {
    if (!quiz || quiz.mode !== 'recall' || quiz.revealed) return;
    quiz.revealed = true; const c = byId(quiz.ids[quiz.index]);
    $('recall-answer').innerHTML = `<h2 class="country-title">${U.name(c, state.settings)}</h2>${U.speaker('name', c.id)}<p>いえたかな？</p><div class="actions">${U.button('○ いえた！', 'recall-grade', { correct: 'yes' }, 'secondary')}${U.button('× また あそぼう', 'recall-grade', { correct: 'no' }, 'warm')}</div>`;
    speak('name', c.id);
  }
  function recallGrade(correct) {
    if (!quiz || !quiz.revealed || quiz.answered) return;
    quiz.answered = true; afterAnswer(correct, true);
    $('recall-answer').innerHTML = `<h2>${correct ? '🎤 いえたね！' : '🌱 また いっしょに あそぼう！'}</h2>${U.button('つぎへ ➜', 'next', {}, 'primary')}`;
    if (correct) { player.effect(); celebrate(); } speak('phrase', correct ? 'wellDone' : 'retry');
  }
  function next() {
    if (!quiz || !quiz.answered) return;
    quiz.index++;
    if (quiz.index >= quiz.ids.length && quiz.daily && !quiz.retriesAdded) {
      quiz.ids = K.appendRetries(quiz.ids, quiz.wrong); quiz.retriesAdded = true;
    }
    question();
  }
  async function result() {
    if (!quiz) { home(); return; }
    const remaining = quiz.daily ? K.buildSession(state, countries, K.localDay()).ids.length : 0;
    const v = show(`<section class="panel center"><span class="result-icon">${quiz.newMedals.length ? '🏅' : '🌈'}</span><p class="eyebrow">きょうも いっぽ すすんだね</p><h1>${quiz.index ? 'よく あそんだね！' : 'きょうの ぼうけんは ばっちり！'}</h1>${quiz.index ? `<p>${quiz.ids.length} もん あそんだよ。たのしかったね！</p>` : '<p>つぎの ぼうけんも おたのしみに。</p>'}${quiz.newStickers ? `<h2>🌟 シールが ${quiz.newStickers} こ ふえたよ！</h2>` : ''}${quiz.newMedals.map(n => `<h2>🏅 ${n} こ メダル！おめでとう！</h2>`).join('')}${remaining ? `<p>ふくしゅうが あと ${K.dueCountries(state, countries, K.localDay()).length} こ あるよ。<br>もういっかい あそぶ？ よるでも いいよ。</p>` : ''}<div class="actions">${remaining ? U.button('もういっかい あそぶ', 'daily', {}, 'primary') : ''}${U.button('🌟 シールちょう', 'stickers', {}, 'warm')}${U.button('🏠 おうちへ', 'home', {}, 'secondary')}</div></section>`, 'result');
    celebrate(); const played = await speak('phrase', quiz.newStickers ? 'sticker' : 'finish');
    if (played && view === v && quiz.newMedals.length) speak('phrase', 'great');
  }
  function flashSetup() {
    show(`<section class="panel"><h1>✨ フラッシュカード</h1><p>なまえを きいてから、つぎの こっきに すすむよ。</p><div class="toolbar"><label>どの こっき？${U.scopeSelect('flash-scope', 'today')}</label><label>たいりく${U.continentsSelect('flash-continent', 'all')}</label></div><div class="actions">${U.button('▶ はじめる', 'flash-start', {}, 'primary')}</div></section>`, 'flash-setup');
  }
  function flashStart() {
    const list = scopeCountries($('flash-scope').value, $('flash-continent').value);
    if (!list.length) { notice('この はんいには まだ こっきが ないよ。はんいを かえてね'); return; }
    flash = { ids: list.map(c => c.id), index: 0, playing: true }; flashCard();
  }
  function flashCard() {
    const c = byId(flash.ids[flash.index]);
    packs.preload([c.id]);
    state = K.recordActivity(state, K.localDay()); save();
    const v = show(`<div class="flash-card">${U.progress(flash.index + 1, flash.ids.length, '✨ フラッシュカード')}<section class="panel center">${U.flag(c, 'large')}<h1 class="country-title">${U.name(c, state.settings)}</h1>${U.speaker('name', c.id)}</section><div class="flash-controls">${U.button('<span class="big-icon">◀</span>まえへ', 'flash-prev')}${U.button(`<span class="big-icon">${flash.playing ? '⏸' : '▶'}</span>${flash.playing ? 'とめる' : 'つづける'}`, 'flash-toggle', {}, 'secondary')}${U.button('<span class="big-icon">▶</span>つぎへ', 'flash-next')}</div><div class="actions">${U.button('はんいを かえる', 'flash-setup', {}, 'quiet')}</div></div>`, 'flash');
    if (flash.playing) flashNarrate(v);
  }
  async function flashNarrate(v) {
    clearTimeout(timer);
    const played = await speak('name', flash.ids[flash.index]);
    if (played && v === view && flash.playing) timer = setTimeout(() => {
      if (v !== view || !flash.playing) return;
      if (flash.index + 1 >= flash.ids.length) {
        flash.playing = false; flashCard(); notice('ぜんぶ みたね！ もういちども あそべるよ');
      } else { flash.index++; flashCard(); }
    }, state.settings.flashDelay * 1000);
  }
  function flashMove(delta) {
    flash.index = (flash.index + delta + flash.ids.length) % flash.ids.length; flashCard();
  }
  function atlas() { show(U.atlas(state, countries, atlasFilter), 'atlas'); }
  function detail(id) {
    const c = byId(id); if (!c) return;
    state = K.recordActivity(state, K.localDay()); save();
    show(U.detail(c, state, countries), 'detail'); speak('name', id);
  }
  function similar(id) {
    const pairs = [], done = new Set();
    countries.forEach(c => (c.similar || []).forEach(other => {
      if (!byId(other)) return; const key = [c.id, other].sort().join('-');
      if (!done.has(key) && (!id || c.id === id || other === id)) { pairs.push([c, byId(other)]); done.add(key); }
    }));
    if (!pairs.length) { empty('こっきは みんな いろいろ', 'ずかんで すきな こっきを さがしてみよう！'); return; }
    show(`<h1>👀 にている こっき</h1><p>ならべて みると、どこが ちがうかな？</p><div class="mode-grid">${pairs.map(([a, b]) => U.button(`<span class="pair-grid">${U.flag(a, '', 'lazy')}${U.flag(b, '', 'lazy')}</span><span class="small">${U.name(a, state.settings)}・${U.name(b, state.settings)}</span>`, 'compare', { a: a.id, b: b.id }, 'pair-card')).join('')}</div>`, 'similar');
  }
  function compare(a, b) {
    const first = byId(a), second = byId(b); if (!first || !second) return;
    state = K.recordActivity(state, K.localDay()); save();
    pair = [a, b]; const twins = K.areTwins(first, second);
    show(`<h1>👀 よーく みてみよう</h1><div class="pair-grid">${[first, second].map(c => `<section class="panel pair-card center">${U.flag(c)}<h2 class="country-title">${U.name(c, state.settings)}</h2>${U.speaker('name', c.id)}</section>`).join('')}</div><p class="center">${twins ? 'とても そっくり！ くらべて たのしもう。<br>この ふたつを いっしょに クイズには ださないよ。' : 'いろや もよう、どこが ちがうかな？'}</p><div class="actions">${!twins ? U.button('この ふたつで あそぶ', 'compare-play', {}, 'primary') : ''}${U.button('ほかの こっきも みる', 'similar', {}, 'secondary')}</div>`, 'compare');
  }
  function parent() { show(U.parent(state, countries, K.localDay(), calendarMonth, storageOK, embedded), 'parent'); }
  function backup() {
    const json = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
    if (embedded) {
      $('backup-output').hidden = false; $('backup-json').value = json; $('backup-json').focus(); return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url;
    a.download = `こっきのぼうけん-${K.localDay()}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000); notice('バックアップを ほぞんしてね');
  }
  async function copyBackup() {
    const field = $('backup-json'), text = field.value;
    try {
      // Invoke directly in the click handler, while clipboard permission has
      // the user gesture. Some iframe and file:// environments reject it.
      await window.navigator.clipboard.writeText(text); notice('コピーしました');
    } catch (_) {
      if (field.value !== text || current !== 'parent') return;
      field.focus(); field.select(); field.setSelectionRange(0, text.length);
      notice('テキストを選びました。コピーして保存してください');
    }
  }
  function confirmAction(title, message, label, accept) {
    show(`<section class="panel confirmation" role="region" aria-labelledby="confirmation-title"><h1 id="confirmation-title">${U.escape(title)}</h1><p class="confirmation-message">${U.escape(message)}</p><div class="actions">${U.button('やめる', 'confirm-cancel', {}, 'secondary')}${U.button(U.escape(label), 'confirm-accept', {}, 'danger')}</div></section>`, 'confirmation');
    pendingConfirmation = accept;
  }
  function importText(text) {
    if (new Blob([text]).size > 8 * 1024 * 1024) throw new Error('データが大きすぎます（8MBまで）');
    const imported = K.validateBackup(JSON.parse(text), countries, K.localDay());
    const message = `開始日：${imported.startDate}\n紹介済み：${Object.keys(imported.progress).length}か国\nおぼえた：${K.learnedCount(imported)}か国\n現在の記録は上書きされます。先に書き出すことをおすすめします。`;
    confirmAction('バックアップを読み込みますか？', message, 'この記録に置き換える', () => {
      state = imported; save(); parent(); notice('バックアップを よみこみました');
    });
  }
  async function importBackup(file) {
    if (!file) return;
    const v = view;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('ファイルが大きすぎます（8MBまで）');
      const text = await file.text(); if (v !== view) return;
      importText(text);
    } catch (error) { if (v === view) notice(`読み込めません：${error.message}`); }
  }
  function importPaste() {
    try { importText($('backup-paste').value); }
    catch (error) { notice(`読み込めません：${error.message}`); }
  }
  function reset() {
    confirmAction('学習記録をリセットしますか？', '学習記録と設定をすべてリセットします。\nこの操作は取り消せません。先にバックアップを書き出してください。', 'すべてリセットする', () => {
      state = K.createState(K.localDay()); quiz = null; save(); parent(); notice('あたらしい ぼうけんを はじめよう');
    });
  }
  function printPreview() {
    if (embedded) return;
    printList = scopeCountries($('print-scope').value, $('print-continent').value);
    if (!printList.length) { notice('この はんいには こっきが ありません'); return; }
    const pages = [];
    for (let i = 0; i < printList.length; i += 12) pages.push(`<section class="print-page">${printList.slice(i, i + 12).map(c => `<div class="print-card"><img src="flags/${U.escape(c.id)}.svg" alt="${U.escape(c.name)}"><span class="print-name">${U.name(c, state.settings)}</span><span class="print-number">${c.order} / ${countries.length}</span></div>`).join('')}</section>`);
    $('print-area').innerHTML = pages.join('');
    show(`<div class="parent"><h1>🖨 国旗カードのプレビュー</h1><div class="print-summary">${printList.length}枚 ／ A4 ${pages.length}ページ（1ページ12枚）<br>印刷画面で A4たて・倍率100%・ヘッダーとフッターなしを選んでください。</div><div class="actions">${U.button('🖨 印刷画面を開く', 'print', {}, 'primary')}${U.button('設定に戻る', 'parent', {}, 'quiet')}</div><div class="flag-grid" style="margin-top:24px">${printList.map(c => U.tile(c, state, state.settings)).join('')}</div></div>`, 'print-preview');
  }
  function stopGate() {
    clearTimeout(gateTimer); gateTimer = null;
    if (gateButton) gateButton.classList.remove('holding'); gateButton = null; gatePoint = null;
  }
  function startGate(element, point) {
    stopGate(); gateButton = element; gatePoint = point; element.classList.add('holding');
    gateTimer = setTimeout(() => { stopGate(); parent(); }, 2000);
  }
  document.addEventListener('pointerdown', event => {
    const element = event.target.closest('[data-action="parent-gate"]');
    if (!element || (event.button !== undefined && event.button !== 0)) return;
    startGate(element, { x: event.clientX, y: event.clientY });
  });
  document.addEventListener('pointermove', event => {
    if (gatePoint && (Math.abs(event.clientX - gatePoint.x) > 18 || Math.abs(event.clientY - gatePoint.y) > 18)) stopGate();
  });
  ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, stopGate));
  document.addEventListener('keydown', event => {
    if (event.target.matches('[data-action="parent-gate"]') && [' ', 'Enter'].includes(event.key)) {
      event.preventDefault(); if (!event.repeat) startGate(event.target, null);
    }
  });
  document.addEventListener('keyup', event => { if ([' ', 'Enter'].includes(event.key)) stopGate(); });
  window.addEventListener('blur', stopGate);
  document.addEventListener('contextmenu', event => { if (event.target.closest('[data-action="parent-gate"]')) event.preventDefault(); });
  document.addEventListener('click', event => {
    const element = event.target.closest('[data-action]'); if (!element || element.disabled) return;
    event.preventDefault(); const d = element.dataset;
    if (d.action === 'unlock-audio') { player.replayBlocked(); return; }
    if (!countries.length) return;
    switch (d.action) {
      case 'start': player.unlock(); home(); speak('phrase', 'start'); break;
      case 'home': home(); break;
      case 'daily': daily(); break;
      case 'intro-next': introNext(); break;
      case 'play': play(d.mode); break;
      case 'answer': answer(d.id); break;
      case 'next': next(); break;
      case 'question-audio': questionAudio(); break;
      case 'recall-reveal': recallReveal(); break;
      case 'recall-grade': recallGrade(d.correct === 'yes'); break;
      case 'speak':
        if (current === 'flash') { if (flash.playing) flashNarrate(view); else speak(d.kind, d.id); }
        else {
          const playback = speak(d.kind, d.id, () => {
            app.querySelectorAll('.speaking').forEach(e => e.classList.remove('speaking'));
            const card = element.closest('.choice-card'); if (card) card.classList.add('speaking');
          });
          const ticket = player.ticket;
          playback.then(() => { const card = element.closest('.choice-card'); if (card && ticket === player.ticket) card.classList.remove('speaking'); });
        }
        break;
      case 'flash-setup': flashSetup(); break;
      case 'flash-start': flashStart(); break;
      case 'flash-toggle': flash.playing = !flash.playing; flashCard(); break;
      case 'flash-prev': flashMove(-1); break;
      case 'flash-next': flashMove(1); break;
      case 'atlas': atlas(); break;
      case 'detail': detail(d.id); break;
      case 'stickers': show(U.stickers(state, countries), 'stickers'); break;
      case 'similar': similar(); break;
      case 'compare-country': similar(d.id); break;
      case 'compare': compare(d.a, d.b); break;
      case 'compare-play':
        quiz = { mode: 'similar', daily: false, ids: K.shuffle([...pair, ...pair]), pairIds: pair.slice(), index: 0,
          wrong: [], retriesAdded: true, correct: 0, answered: false, newMedals: [], newStickers: 0 }; question(); break;
      case 'parent-gate': break;
      case 'parent': parent(); break;
      case 'weak-play': play('flag', K.weakCountries(state, countries)); break;
      case 'calendar': {
        const [y, m] = calendarMonth.split('-').map(Number), date = new Date(y, m - 1 + Number(d.delta), 1);
        if (date.getFullYear() >= 1900 && date.getFullYear() <= 2200) calendarMonth = K.localDay(date).slice(0, 7);
        parent(); break;
      }
      case 'backup': backup(); break;
      case 'backup-copy': copyBackup(); break;
      case 'backup-paste-import': importPaste(); break;
      case 'confirm-cancel': if (pendingConfirmation) parent(); break;
      case 'confirm-accept': {
        const accept = pendingConfirmation; pendingConfirmation = null; if (accept) accept(); break;
      }
      case 'reset': reset(); break;
      case 'print-preview': printPreview(); break;
      case 'print': if (!embedded) window.print(); break;
    }
  });
  document.addEventListener('change', event => {
    const element = event.target;
    if (element.dataset.setting) {
      const key = element.dataset.setting, value = element.type === 'checkbox' ? element.checked : Number(element.value);
      try { state.settings = K.normalizedSettings({ ...state.settings, [key]: value }); save(); notice('せっていを ほぞんしました'); }
      catch (error) { notice(error.message); }
    } else if (element.id === 'start-date') {
      try { K.dayNumber(element.value); state.startDate = element.value; save(); parent(); }
      catch (_) { notice('正しい開始日を選んでください'); element.value = state.startDate; }
    } else if (element.id === 'atlas-filter') { atlasFilter = element.value; atlas(); }
    else if (element.id === 'backup-import') { importBackup(element.files[0]); element.value = ''; }
  });
  document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement && event.target.closest('.flag')) {
      event.target.hidden = true; event.target.closest('.flag').classList.add('missing');
    }
  }, true);
  document.addEventListener('visibilitychange', () => {
    document.documentElement?.classList.toggle('page-hidden', document.hidden);
    if (document.hidden) { stopGate(); clearTimeout(timer); player.cancel(); if (flash) flash.playing = false; }
    else if (current === 'flash') flashCard();
  });
  if (!countries.length) {
    show('<section class="panel center"><span class="result-icon">🌱</span><h1>こっきは じゅんびちゅうだよ</h1><p>おうちのかたへ：国のデータがまだ見つかりません。<br>js/data.js を用意してから、もう一度開いてください。</p><p class="small muted">生成手順は README.md にあります。</p></section>', 'missing'); return;
  }
  try { storage = window.localStorage; } catch (_) { storageOK = false; }
  const loaded = K.loadState(storage, countries, K.localDay()); state = loaded.state;
  if (loaded.error) storageOK = false;
  $('save-warning').hidden = storageOK;
  show(`<section class="panel center welcome"><span class="result-icon">🌏</span><p class="eyebrow">こっきで せかいと おともだち</p><h1>こっきの ぼうけん</h1><p>みて、きいて、タッチして。<br>せかいへ あそびに いこう！</p>${U.button('▶ はじめる', 'start', {}, 'primary')}<p class="small muted" style="margin-top:24px">おとが でるよ。おうちのひとと あそぼうね。</p></section>`, 'welcome');
})();
