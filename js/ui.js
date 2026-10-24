(function (root) {
  'use strict';
  const K = root.KQ;
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function name(c, settings, capital) {
    const surface = capital ? c.capital : c.name, kana = capital ? c.capitalKana : c.kana;
    if (settings.hiragana && kana) return escape(kana);
    if (/[一-龯々]/.test(surface) && kana) return `<ruby>${escape(surface)}<rt>${escape(kana)}</rt></ruby>`;
    return escape(surface);
  }
  function flag(c, size, loading) {
    return `<div class="flag ${escape(size || '')}"><span class="flag-fallback" aria-hidden="true">🏳️</span><img src="flags/${escape(c.id)}.svg" alt="${escape(c.kana || c.name)}の こっき" loading="${loading === 'lazy' ? 'lazy' : 'eager'}" draggable="false"></div>`;
  }
  function button(label, action, data, className, extra) {
    const attrs = Object.entries(data || {}).map(([key, value]) => ` data-${key}="${escape(value)}"`).join('');
    return `<button type="button" class="${escape(className || '')}" data-action="${escape(action)}"${attrs}${extra ? ` ${extra}` : ''}>${label}</button>`;
  }
  function speaker(kind, id, label) { return button('🔊<span class="sr-only">' + escape(label || 'もういちど きく') + '</span>', 'speak', { kind, id }, 'speaker'); }
  function progress(index, total, label) {
    return `<div class="progress-meta"><span>${escape(label || 'きょうの ぼうけん')}</span><span>${index} / ${total}</span></div><div class="progress-track"><div class="progress-fill" style="width:${total ? Math.min(100, index / total * 100) : 0}%"></div></div>`;
  }
  function continentsSelect(id, selected, all) {
    return `<select id="${id}" aria-label="たいりくを えらぶ">${all !== false ? '<option value="all">ぜんぶの たいりく</option>' : ''}${Object.entries(K.CONTINENTS).map(([key, c]) => `<option value="${key}" ${selected === key ? 'selected' : ''}>${c.icon} ${c.kana}</option>`).join('')}</select>`;
  }
  function scopeSelect(id, selected) {
    return `<select id="${id}" aria-label="はんいを えらぶ">${[['today', 'きょうの くに'], ['learned', 'おぼえた くに'], ['introduced', 'であった くに'], ['all', 'ぜんぶ']].map(([v, text]) => `<option value="${v}" ${selected === v ? 'selected' : ''}>${text}</option>`).join('')}</select>`;
  }
  function mode(icon, label, hint, action, value) {
    return button(`<span class="mode-icon" aria-hidden="true">${icon}</span><span><span class="label">${label}</span><span class="hint">${hint}</span></span>`, action, { mode: value }, 'mode-card');
  }
  function home(state, countries, today) {
    const d = state.days[today], introduced = Object.keys(state.progress).length, due = K.dueCountries(state, countries, today).length;
    return `<section class="hero"><div><p class="eyebrow">こっきで せかいと おともだち</p><h1>せかいへ、<br>しゅっぱつ！</h1><p>きょうは どんな くにに<br>であえるかな？</p>${button('<span>きょうの ぼうけん</span><span aria-hidden="true">➜</span>', 'daily', {}, 'primary adventure-button')}</div><div class="hero-art" aria-hidden="true"><span class="globe">🌏</span><span class="orbit one">🇯🇵</span><span class="orbit two">🇧🇷</span><span class="orbit three">🇨🇦</span></div></section>
      <div class="stats-row"><div class="stat"><strong>${d ? d.answers : 0}<small> もん</small></strong><span>きょう あそんだ</span></div><div class="stat"><strong>${introduced}<small> / ${countries.length}</small></strong><span>であった くに・ちいき</span></div><div class="stat"><strong>${K.learnedCount(state)}<small> こ</small></strong><span>おぼえた！</span></div></div>
      <p class="small muted center">${due > 0 ? `🌱 ふくしゅうが ${due} こ あるよ。すこしずつ あそぼう！` : '🌼 じぶんの ペースで たのしもう！'}</p>
      <div class="section-label"><h2>すきな あそびを えらぼう</h2><p>おとを きいて<br>タッチしてね</p></div><nav class="mode-grid" aria-label="あそびの メニュー">
      ${mode('🚩', 'こっきを さがそう', 'なまえを きいて タッチ', 'play', 'flag')}
      ${mode('🔊', 'なまえを あてよう', 'こっきを みて きいてみよう', 'play', 'name')}
      ${mode('🎤', 'いえるかな？', 'おうちのひとと こえに だそう', 'play', 'recall')}
      ${mode('✨', 'フラッシュカード', 'つぎつぎ こっきに であおう', 'flash-setup', '')}
      ${mode('📖', 'ずかん', 'くに・ちいきの おはなし', 'atlas', '')}
      ${mode('👀', 'にている こっき', 'どこが ちがうかな？', 'similar', '')}
      ${mode('🏰', 'しゅと クイズ', 'すこし おおきくなったら', 'play', 'capital')}
      ${mode('🌍', 'どこの たいりく？', 'ちずで せかいを みてみよう', 'play', 'continent')}
      ${mode('🌟', 'シールちょう', 'おぼえた こっきが いっぱい', 'stickers', '')}</nav>
      ${button('🔒 おうちのかたへ <small>（2びょう ながおし）</small>', 'parent-gate', {}, 'parent-gate', 'aria-describedby="gate-help"')}<p class="gate-help" id="gate-help">ボタンを 2びょう おしたままにしてね</p>`;
  }
  function tile(c, state, settings, sticker) {
    const p = state.progress[c.id], earned = p && p.sticker;
    const said = p ? p.said : ((state.practice || {})[c.id] || {}).said;
    return button(`${flag(c, '', 'lazy')}<span class="tile-name">${name(c, settings)}</span>${said || (p && p.box >= 4) ? `<span class="tile-badge" aria-label="${said ? 'いえた' : 'おぼえた'}">${said ? '🎤' : '⭐'}</span>` : ''}`, 'detail', { id: c.id }, `country-tile${sticker ? ` sticker-tile${earned ? ' earned' : ''}` : ''}`);
  }
  function atlas(state, countries, filter) {
    const list = countries.filter(c => filter === 'all' || c.continent === filter);
    return `<h1>📖 くに・ちいきの ずかん</h1><p class="muted">こっきを タッチして おはなしを きこう</p><div class="toolbar"><label>${continentsSelect('atlas-filter', filter)}</label><span class="small">${list.length} の くに・ちいき</span></div><div class="flag-grid">${list.map(c => tile(c, state, state.settings)).join('')}</div>`;
  }
  // Broad silhouettes keep the continent exercise useful even when worldmap.js is absent.
  const LAND = {
    north_america: 'M42 60L88 34 155 40 178 74 150 104 123 121 119 153 95 142 74 105 52 98Z M141 28L188 18 211 33 193 58 166 59Z',
    south_america: 'M127 156L153 149 177 173 188 196 171 222 158 257 145 241 142 207 125 180Z',
    europe: 'M287 67L309 47 333 49 342 72 323 95 294 92Z',
    africa: 'M282 104L318 98 343 120 353 155 332 190 313 210 302 187 298 157 278 133Z',
    asia: 'M337 48L376 31 444 36 499 54 534 80 505 104 469 113 455 151 433 145 411 117 393 139 367 115 345 105 323 89Z M467 159L490 152 520 168 508 178 484 174Z',
    oceania: 'M485 193L515 181 548 201 542 230 515 238 487 223Z M565 224L574 218 580 240 568 249Z'
  };
  function map(country, countries, colorful) {
    const world = root.WORLD_MAP, hasShapes = world && world.countries && world.width > 0 && world.height > 0;
    const width = hasShapes ? world.width : 600, height = hasShapes ? world.height : 300;
    const lookup = new Map(countries.map(c => [String(Number(c.num)), c]));
    let shapes = '';
    if (hasShapes) shapes = Object.entries(world.countries).map(([id, d]) => {
      const c = lookup.get(String(Number(id))), active = country && country.num != null && Number(country.num) === Number(id);
      const fill = active ? '#e99157' : colorful && c ? K.CONTINENTS[c.continent].color : '#b7d2c2';
      return `<path d="${escape(d)}" fill="${fill}" stroke="#fff" stroke-width="0.5"/>`;
    }).join('');
    else if (colorful) shapes = `<g transform="scale(${width / 600} ${height / 300})">${Object.entries(LAND).map(([key, path]) => `<path d="${path}" fill="${K.CONTINENTS[key].color}" stroke="#fff" stroke-width="2"/>`).join('')}</g>`;
    const grid = [1, 2, 3].map(n => `<path d="M0 ${height * n / 4}H${width}" stroke="#c3e2ed" stroke-width=".7"/>`).join('') + [1, 2, 3, 4, 5].map(n => `<path d="M${width * n / 6} 0V${height}" stroke="#c3e2ed" stroke-width=".7"/>`).join('');
    let dot = '';
    if (country) {
      const x = (country.lng + 180) / 360 * width, y = (90 - country.lat) / 180 * height, r = width / 100;
      dot = `<circle class="map-ring" cx="${x}" cy="${y}" r="${r * 1.8}"/><circle class="map-dot" cx="${x}" cy="${y}" r="${r}"/>`;
    }
    return `<svg class="world-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="${country ? escape(country.kana) + 'の ばしょ。あかい まるが めじるし' : 'たいりくを いろわけした せかいちず'}"><title>${country ? escape(country.name) + 'の位置（おおよその中心）' : '世界の6大陸'}</title>${grid}${shapes}${dot}</svg>${!hasShapes ? '<p class="small muted center">ちずの くわしい かたちは じゅんびちゅうだよ</p>' : ''}`;
  }
  function detail(c, state, countries) {
    const s = state.settings, continent = K.CONTINENTS[c.continent];
    return `<section class="panel center"><p class="eyebrow">${continent.icon} ${continent.kana} の ${c.type === 'region' ? 'ちいき' : 'くに'}</p><h1 class="country-title">${name(c, s)}</h1>${flag(c, 'large')}${speaker('name', c.id, 'くにの なまえを きく')}</section>
      <div class="detail-copy"><div class="listen-row"><div><p class="small muted">しゅと</p><h2 class="country-title">${name(c, s, true)}</h2>${c.capitalNote ? `<p class="small">${escape(c.capitalNote)}</p>` : ''}</div>${speaker('capital', c.id, 'しゅとの おはなしを きく')}</div>
      <div class="listen-row"><div><h2>どんな ところ？</h2><p class="description">${escape(c.desc)}</p></div>${speaker('desc', c.id, 'おはなしを きく')}</div><h2 class="center" style="margin-top:32px">🌏 ここに あるよ</h2>${map(c, countries)}<p class="small muted center">${escape(c.officialName)}<br>くに・ちいきの ばしょは おおよそだよ</p>
      ${(c.similar || []).length ? `<h2>👀 にている こっき</h2><div class="flag-grid">${c.similar.map(id => countries.find(x => x.id === id)).filter(Boolean).map(x => tile(x, state, s)).join('')}</div>` : ''}<div class="actions">${button('📖 ずかんへ', 'atlas', {}, 'secondary')}${button('👀 くらべる', 'compare-country', { id: c.id }, 'warm')}</div></div>`;
  }
  function stickers(state, countries) {
    const count = K.stickerCount(state);
    return `<h1>🌟 シールちょう</h1><p>おぼえた こっきが シールに なるよ！</p><div class="stats-row"><div class="stat"><strong>${count} / ${countries.length}</strong><span>あつめた シール</span></div><div class="stat"><strong>${K.saidCount(state)}</strong><span>🎤 いえた！</span></div></div><div class="medals">${[10, 25, 50, 100, 150, 199].map(n => `<div class="medal ${state.medals.includes(n) ? 'won' : ''}"><span class="big-icon">${state.medals.includes(n) ? '🏅' : '🌱'}</span>${n} こ</div>`).join('')}</div><div class="flag-grid">${countries.map(c => tile(c, state, state.settings, true)).join('')}</div>`;
  }
  function chart(state, countries, today) {
    const start = state.startDate, elapsed = Math.max(0, K.daysBetween(start, today)), max = countries.length;
    const plot = { x: 45, y: 20, w: 580, h: 190 };
    const x = n => plot.x + Math.max(0, Math.min(90, n)) / 90 * plot.w, y = n => plot.y + plot.h * (1 - n / max);
    const snapshots = Object.entries(state.days).sort(([a], [b]) => a.localeCompare(b));
    let last = 0, points = [];
    for (let n = 0; n <= Math.min(elapsed, 90); n++) {
      const day = K.addDays(start, n);
      const entry = snapshots.find(([d]) => d === day); if (entry) last = entry[1].learned;
      points.push(`${x(n)},${y(last)}`);
    }
    return `<svg class="chart" viewBox="0 0 650 260" role="img" aria-label="90日で${max}か国の目標線と、毎日の覚えた国の数"><title>3か月の学習記録</title>${[0, 50, 100, 150, max].map(n => `<path d="M45 ${y(n)}H625" stroke="#e4e8e5"/><text x="36" y="${y(n) + 5}" text-anchor="end">${n}</text>`).join('')}<path d="M45 210L625 20" fill="none" stroke="#b6bac2" stroke-width="3" stroke-dasharray="7 6"/><polyline points="${points.join(' ')}" fill="none" stroke="#258967" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${[0, 30, 60, 90].map(n => `<text x="${x(n)}" y="234" text-anchor="middle">${n}日</text>`).join('')}<text x="90" y="255">━ おぼえた数</text><text x="345" y="255">┄ 90日の目標（めやす）</text></svg>`;
  }
  function calendar(state, month, today) {
    const [year, m] = month.split('-').map(Number), first = new Date(year, m - 1, 1), days = new Date(year, m, 0).getDate();
    let cells = ['日', '月', '火', '水', '木', '金', '土'].map(d => `<div class="weekday">${d}</div>`).join('');
    cells += '<span></span>'.repeat(first.getDay());
    for (let n = 1; n <= days; n++) {
      const day = `${month}-${String(n).padStart(2, '0')}`, d = state.days[day], active = d && (d.active || d.answers > 0);
      cells += `<div class="${active ? 'active' : ''} ${day === today ? 'today' : ''}" aria-label="${day}${active ? ' ' + d.answers + '問学習' : ''}"><span>${n}</span>${active ? '<span class="stamp" aria-hidden="true">🌸</span>' : ''}</div>`;
    }
    return `<div class="calendar-nav">${button('◀<span class="sr-only">まえのつき</span>', 'calendar', { delta: -1 })}<h3>${year}年 ${m}月</h3>${button('▶<span class="sr-only">つぎのつき</span>', 'calendar', { delta: 1 })}</div><div class="calendar">${cells}</div>`;
  }
  function settingSelect(key, label, values, state) {
    return `<label>${label}<select data-setting="${key}">${values.map(([value, text]) => `<option value="${value}" ${state.settings[key] === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
  }
  function credits() {
    return `<div class="credits"><p>音声：<a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener noreferrer">VOICEVOX:春日部つむぎ</a><br>音声がない場合は端末の日本語読み上げを使用します。</p><p>国旗：<a href="https://github.com/lipis/flag-icons" target="_blank" rel="noopener noreferrer">flag-icons</a>（MIT License・© Lipis）<br>地図：<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a>（Public Domain）／<a href="https://github.com/topojson/world-atlas" target="_blank" rel="noopener noreferrer">world-atlas</a>（ISC License）</p><p>台湾・パレスチナを含め「くに・ちいき」と表記しています。地図は学習用の略図で、国境や領有権についての見解を示すものではありません。</p></div>`;
  }
  function parent(state, countries, today, month, storageOK, embedded) {
    const elapsed = Math.max(0, K.daysBetween(state.startDate, today) + 1), weak = K.weakCountries(state, countries);
    return `<div class="parent"><h1>🌱 おうちのかたへ</h1><p>朝と夜に1回ずつ、1回5〜10分を目安に。楽しいところで終わりましょう。</p>
      <section class="panel"><h2>3か月の歩み</h2><p>開始日：${escape(state.startDate)} ／ ${elapsed}日目（目標90日）</p><div class="stats-row"><div class="stat"><strong>${Object.keys(state.progress).length} / ${countries.length}</strong><span>紹介済み</span></div><div class="stat"><strong>${K.learnedCount(state)}</strong><span>おぼえた（box 4以上）</span></div><div class="stat"><strong>${K.saidCount(state)}</strong><span>声でいえた</span></div></div>${chart(state, countries, today)}<p class="small muted">目標線は目安です。苦手な国は戻って復習するため、実際の線が下がることもあります。</p><div class="continent-stats">${Object.entries(K.CONTINENTS).map(([key, c]) => {
        const all = countries.filter(x => x.continent === key), learned = all.filter(x => state.progress[x.id] && state.progress[x.id].box >= 4).length;
        return `<div class="continent-stat" style="background:${c.color}55">${c.icon} ${escape(c.name)}<strong>${learned} / ${all.length}</strong></div>`;
      }).join('')}</div></section>
      <section class="panel"><h2>学習カレンダー</h2>${calendar(state, month, today)}</section>
      <section class="panel"><h2>もう一度あそびたい国（${weak.length}）</h2><p class="small muted">直近5回までの正答率が60%未満、または2回以上続けて間違えた国です。</p><div class="weak-list">${weak.length ? weak.map(c => button(name(c, state.settings), 'detail', { id: c.id })).join('') : '<p>いまはありません。毎日の小さな一歩を大切に。</p>'}</div>${weak.length ? button('にがてな国であそぶ', 'weak-play', {}, 'secondary') : ''}</section>
      <section class="panel"><h2>設定</h2><div class="setting-grid">
      ${settingSelect('newPerDay', '1日の新しい国', [2, 3, 4, 5].map(n => [n, `${n}か国`]), state)}
      ${settingSelect('sessionLimit', '1回の問題数（復習を含む）', [10, 15, 20].map(n => [n, `${n}問まで`]), state)}
      ${settingSelect('choices', '選択肢の最大数', [2, 3, 4].map(n => [n, `${n}択`]), state)}
      ${settingSelect('audioRate', '音声の再生速度', [[0.7, 'ゆっくり（0.7倍）'], [0.9, 'すこしゆっくり（0.9倍）'], [1, '標準・おすすめ（1倍）'], [1.1, '1.1倍'], [1.25, '1.25倍']], state)}
      ${settingSelect('flashDelay', 'フラッシュカード：音声終了後の待ち時間', [[0.5, '0.5秒'], [1, '1秒'], [2, '2秒']], state)}
      <label>プランの開始日<input type="date" id="start-date" value="${escape(state.startDate)}" min="1900-01-01" max="2200-12-31"></label>
      <label class="toggle-label"><input type="checkbox" data-setting="hiragana" ${state.settings.hiragana ? 'checked' : ''}>国名・首都をひらがなで表示</label>
      <label class="toggle-label"><input type="checkbox" data-setting="sound" ${state.settings.sound ? 'checked' : ''}>やさしい正解の効果音</label></div><p class="small muted">設定は自動保存されます。新しい国はその日の最初の冒険で決まり、途中で変更した人数は翌日から反映されます。はじめの国は2択です。休み明けの復習が多い日は新しい国を1か国に減らします。</p></section>
      <section class="panel"><h2>バックアップと復元</h2><p>記録はこのブラウザに保存されます。別の端末とは共有されません。週1回を目安にバックアップを保存してください。</p>${!storageOK ? '<p class="parent-note">きろくが ほぞんできません。プライベートブラウズを解除し、サイトデータの保存を許可してください。いまの記録は画面を閉じる前にバックアップで保存できます。読み込みで異常な記録を検出した場合もこの案内を表示します。元の文字列は、保存できる場合に localStorage の kokki-quiz-broken-&lt;YYYYMMDDHHmmss&gt;（端末の日時）へ退避します。ブラウザの開発者ツールで取り出せます。</p>' : ''}<div class="actions">${button(embedded ? '💾 JSONを表示する' : '💾 JSONを書き出す', 'backup', {}, 'secondary')}<label class="file-label">📂 JSONを読み込む<input type="file" id="backup-import" accept="application/json,.json" aria-label="バックアップJSONを読み込む"></label></div>${embedded ? `<div id="backup-output" hidden><label for="backup-json">保存するバックアップJSON</label><textarea id="backup-json" rows="8" readonly spellcheck="false"></textarea><div class="actions">${button('コピー', 'backup-copy', {}, 'secondary')}</div></div><label for="backup-paste">バックアップJSONを貼り付ける</label><textarea id="backup-paste" rows="6" spellcheck="false" placeholder="ここにJSONを貼り付けてください"></textarea><div class="actions">${button('読み込む', 'backup-paste-import', {}, 'warm')}</div>` : ''}<p class="small muted">復元では現在の記録を置き換えます。形式・バージョン・国ID・日付・値を検証してから確認します。</p>${button('学習記録をリセット', 'reset', {}, 'danger')}</section>
      ${embedded ? '<section class="panel"><h2>国旗カードの印刷</h2><p>印刷は、デスクトップに保存したアプリ（index.html）から行えます</p></section>' : `<section class="panel"><h2>国旗カードを印刷</h2><p>A4たて・1ページ12枚。印刷ダイアログで用紙をA4、ヘッダーとフッターをオフにしてください。</p><div class="setting-grid"><label>大陸${continentsSelect('print-continent', 'all')}</label><label>範囲${scopeSelect('print-scope', 'all')}</label></div><div class="actions">${button('🖨 カードをプレビュー', 'print-preview', {}, 'warm')}</div></section>`}
      <section class="panel"><h2>素材・クレジット</h2>${credits()}</section></div>`;
  }
  root.KQUI = { escape, name, flag, button, speaker, progress, continentsSelect, scopeSelect, home, tile,
    atlas, map, detail, stickers, parent, credits };
})(window);
