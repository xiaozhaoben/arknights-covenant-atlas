const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const tierColors = ['', '#7f909b', '#6fae86', '#5aa8c9', '#a98cd0', '#cda664', '#dc7f6a'];
const KIND_LABEL = { stack: '叠层干员', combat: '作战能力', prep: '整备能力', special: '特异化' };

let data = null;
let type = 'all', tier = 0, query = '', bond = null, kindFilter = 'all', groupMode = 'bond';
let displayMode = 'compact', traitVersion = 'both', colorTraits = true;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

try {
  if (localStorage.getItem('operatorGrouping') === 'tier') groupMode = 'tier';
  const saved = JSON.parse(localStorage.getItem('traitDisplay') || '{}');
  if (['compact', 'inline'].includes(saved.mode)) displayMode = saved.mode;
  if (['normal', 'elite', 'both'].includes(saved.version)) traitVersion = saved.version;
  if (typeof saved.colors === 'boolean') colorTraits = saved.colors;
} catch {}

function saveGrouping() { try { localStorage.setItem('operatorGrouping', groupMode); } catch {} }
function saveDisplay() {
  try { localStorage.setItem('traitDisplay', JSON.stringify({ mode: displayMode, version: traitVersion, colors: colorTraits })); } catch {}
  syncControls(); if (data) render();
}

function traitKind(o) {
  const label = o.trait.split(' ')[0];
  return { label, kind: label.includes('叠加') ? 'stack' : label === '作战能力' ? 'combat' : label === '整备能力' ? 'prep' : 'special' };
}

function traitText(text) {
  const items = data.equipment || [];
  const names = items.map(x => x.name).sort((a, b) => b.length - a.length)
    .map(n => Array.from(n).map(c => '\\^$.*+?()[]{}|'.includes(c) ? '\\' + c : c).join(''));
  const pattern = new RegExp('(【[^【】]+】' + (names.length ? '|' + names.join('|') : '') + ')', 'g');
  return text.split(pattern).map(token => {
    if (token.startsWith('【') && token.endsWith('】')) {
      const name = token.slice(1, -1);
      if (data.bonds.some(b => b.name === name))
        return `<button type="button" class="bond-reference" data-effect="${esc(name)}" aria-label="查看${esc(name)}的盟约效果">${esc(token)}</button>`;
    }
    if (items.some(x => x.name === token))
      return `<button type="button" class="bond-reference" data-equipment="${esc(token)}" aria-label="查看${esc(token)}的装备效果">${esc(token)}</button>`;
    return esc(token);
  }).join('');
}

function effectMarkup(text) {
  return String(text).split(/\n+/).filter(Boolean).map(line => {
    const m = line.match(/^<([^>]+)>(.*)$/);
    return m
      ? `<div class="effect-part"><strong class="effect-condition">${esc(m[1])}</strong><p class="effect-paragraph">${traitText(m[2])}</p></div>`
      : `<p class="effect-paragraph">${traitText(line)}</p>`;
  }).join('');
}

function openSheet(id) { const d = $('#' + id); if (d && !d.open) d.showModal(); }

function showBondEffect(name) {
  const b = data.bonds.find(x => x.name === name);
  if (!b) return;
  $('#effectTitle').textContent = '盟约效果';
  $('#effectBody').innerHTML = `
    <div class="effect-hero">
      <span class="effect-icon"><img src="${b.icon}" alt=""></span>
      <div><h2>${esc(b.name)}</h2><p class="effect-meta">${esc(b.type)} · ${esc(b.activation)}</p></div>
    </div>
    <div class="effect-text">${effectMarkup(b.effect)}</div>`;
  openSheet('effectSheet');
}

function showEquipmentEffect(name) {
  const item = (data.equipment || []).find(x => x.name === name);
  if (!item) return;
  $('#effectTitle').textContent = '装备效果';
  $('#effectBody').innerHTML = `
    <div class="effect-hero">
      <div><h2>${esc(item.name)}</h2><p class="effect-meta">${roman[item.tier]} 阶装备 · ${esc(item.price)}</p></div>
    </div>
    ${item.note ? `<p class="equipment-note">${traitText(item.note)}</p>` : ''}
    <section class="trait-block"><h3>普通效果</h3><p>${effectMarkup(item.effect)}</p></section>
    <section class="trait-block"><h3>进阶效果</h3><p>${item.advanced === '无' ? '无进阶效果' : effectMarkup(item.advanced)}</p></section>`;
  openSheet('effectSheet');
}

function detail(name) {
  const o = data.operators.find(x => x.name === name);
  if (!o) return;
  $('#detailBody').innerHTML = `
    <div class="detail-hero">
      <span class="detail-portrait"><img src="${o.image}" alt=""></span>
      <div class="detail-meta">
        <h2>${esc(o.name)}</h2>
        <p class="detail-sub">${roman[o.tier]} 阶 · ${o.rarity}★</p>
        <div class="detail-tags">${o.bonds.map(b => `<button type="button" class="bond-tag" data-bond="${esc(b)}">${esc(b)}</button>`).join('')}</div>
      </div>
    </div>
    <section class="trait-block"><h3>普通特质</h3><p>${traitText(o.trait)}</p></section>
    <section class="trait-block"><h3>精锐特质</h3><p>${traitText(o.elite)}</p></section>
    <a class="detail-link" href="${o.url}" target="_blank" rel="noopener">查看原站干员资料 ↗</a>`;
  openSheet('detailSheet');
}

function opCard(o, currentBond) {
  const k = traitKind(o);
  const bonds = o.bonds.map(b => `<span class="bond-tag${b === currentBond ? ' match' : ''}">${esc(b)}</span>`).join('');
  const traits = displayMode === 'inline'
    ? `<div class="op-traits">${traitVersion !== 'elite' ? `<div class="op-trait"><h4>普通特质</h4><p>${traitText(o.trait)}</p></div>` : ''}${traitVersion !== 'normal' ? `<div class="op-trait"><h4>精锐特质</h4><p>${traitText(o.elite)}</p></div>` : ''}</div>`
    : '';
  return `<article class="op kind-${k.kind}">
    <button type="button" class="op-main" data-op="${esc(o.name)}" aria-label="查看 ${esc(o.name)} 的详情">
      <span class="op-portrait">
        <img src="${o.image}" alt="" loading="lazy" decoding="async" width="96" height="96">
        <span class="op-tier" style="--tier:${tierColors[o.tier]}">${roman[o.tier]}</span>
      </span>
      <span class="op-name">${esc(o.name)}</span>
      <span class="op-bonds">${bonds}</span>
      <span class="op-kind">${esc(k.label)}</span>
    </button>${traits}</article>`;
}

function bondGroup(b) {
  const members = data.operators.filter(o => o.bonds.includes(b.name) && matches(o) &&
    (!query.trim() || o.name.toLowerCase().includes(query.trim().toLowerCase()) || b.name.includes(query.trim())));
  if (!members.length && (query || tier || kindFilter !== 'all')) return null;
  return {
    members,
    html: `<section class="grp${members.length ? '' : ' is-empty'}" id="bond-${data.bonds.indexOf(b)}">
      <header class="grp-head">
        <span class="grp-icon"><img src="${b.icon}" alt=""></span>
        <span class="grp-meta"><b>${esc(b.name)}</b><small>${esc(b.type)} · ${esc(b.activation)}</small></span>
        <span class="grp-count"><b>${members.length}</b><small>名干员</small></span>
      </header>
      <details class="grp-effect"><summary>盟约效果 · 点击展开</summary><div class="effect-body">${effectMarkup(b.effect)}</div></details>
      ${members.length ? `<div class="roster">${members.map(o => opCard(o, b.name)).join('')}</div>` : '<p class="empty">暂无专属干员；所有干员的精锐状态均可激活。</p>'}
    </section>`
  };
}

function tierGroup(level, members) {
  return {
    members,
    html: `<section class="grp" id="tier-${level}">
      <header class="grp-head">
        <span class="grp-icon" style="color:${tierColors[level]};font:700 16px/1 ui-monospace,monospace">${roman[level]}</span>
        <span class="grp-meta"><b>${roman[level]} 阶干员</b><small>按干员等阶分组 · 每名干员仅出现一次</small></span>
        <span class="grp-count"><b>${members.length}</b><small>名干员</small></span>
      </header>
      <div class="roster">${members.map(o => opCard(o, null)).join('')}</div>
    </section>`
  };
}

function matches(o) {
  return (!tier || o.tier === tier) && (kindFilter === 'all' || traitKind(o).kind === kindFilter);
}

function render() {
  if (!data) return;
  const q = query.trim().toLowerCase();
  const visible = data.bonds.filter(b => (type === 'all' || b.type === type) && (!bond || bond === b.name));
  let groups = [], names = new Set();

  if (groupMode === 'tier') {
    const allowed = new Set(visible.map(b => b.name));
    const filtered = data.operators.filter(o => matches(o) && o.bonds.some(b => allowed.has(b)) &&
      (!q || o.name.toLowerCase().includes(q) || o.bonds.some(b => b.toLowerCase().includes(q))));
    for (let level = 1; level <= 6; level++) {
      const members = filtered.filter(o => o.tier === level);
      if (!members.length) continue;
      members.forEach(o => names.add(o.name));
      groups.push(tierGroup(level, members));
    }
  } else {
    for (const b of visible) {
      const g = bondGroup(b);
      if (!g) continue;
      g.members.forEach(o => names.add(o.name));
      groups.push(g);
    }
  }

  $('#groups').innerHTML = groups.length
    ? groups.map(g => g.html).join('')
    : '<p class="empty">没有匹配的干员或盟约。<br>试试更换关键词，或<a href="#" data-clear="all">重置筛选</a>。</p>';

  $('#resultCount').innerHTML = `显示 <b>${groups.length}</b> 个${groupMode === 'tier' ? '等阶' : '盟约'} · <b>${names.size}</b> 名干员${bond ? ' · ' + esc(bond) : ''}`;

  syncControls();
  renderActive();
}

function syncControls() {
  $$('[data-type]').forEach(b => { const on = b.dataset.type === type; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); });
  $$('[data-tier]').forEach(b => { const on = +b.dataset.tier === tier; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); });
  $$('[data-kind]').forEach(b => { const on = b.dataset.kind === kindFilter; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); });
  $$('[data-group]').forEach(b => { const on = b.dataset.group === groupMode; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); });
  $$('[data-display]').forEach(b => { const on = b.dataset.display === displayMode; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); });
  $$('[data-bond]').forEach(b => { const on = b.dataset.bond === bond; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); });
  const v = $('#traitVersion');
  if (v) { v.value = traitVersion; v.disabled = displayMode !== 'inline'; }
  const c = $('#colorTraits');
  if (c) c.checked = colorTraits;
  const legend = $('#traitLegend');
  if (legend) legend.hidden = !colorTraits;
  document.body.classList.toggle('show-kinds', colorTraits);
  document.body.classList.toggle('inline-mode', displayMode === 'inline');
}

function renderActive() {
  const chips = [];
  if (bond) chips.push(['bond', bond]);
  if (tier) chips.push(['tier', roman[tier] + ' 阶']);
  if (kindFilter !== 'all') chips.push(['kind', KIND_LABEL[kindFilter]]);
  if (groupMode !== 'bond') chips.push(['group', '按等阶浏览']);
  const box = $('#activeFilters');
  box.innerHTML = chips.map(([k, label]) => `<button type="button" class="filter-chip" data-clear="${k}">${esc(label)}<i aria-hidden="true">×</i></button>`).join('');
  box.hidden = chips.length === 0;
  const badge = $('#filterCount');
  badge.textContent = String(chips.length);
  badge.hidden = chips.length === 0;
}

function reset() {
  type = 'all'; tier = 0; query = ''; bond = null; kindFilter = 'all';
  const s = $('#search'); if (s) s.value = '';
  render();
}

function buildBondGrid() {
  $('#bondGrid').innerHTML = data.bonds.map(b => {
    const n = data.operators.filter(o => o.bonds.includes(b.name)).length;
    return `<button type="button" class="bond-cell" data-bond="${esc(b.name)}" aria-pressed="false">
      <img src="${b.icon}" alt=""><span class="bc-text"><span class="bc-name">${esc(b.name)}</span><span class="bc-count">${n} 名</span></span>
    </button>`;
  }).join('');
}

document.addEventListener('click', e => {
  const close = e.target.closest('[data-close]');
  if (close) { const d = close.closest('dialog'); if (d) d.close(); return; }

  const clear = e.target.closest('[data-clear]');
  if (clear) {
    if (clear.tagName === 'A') e.preventDefault();
    const k = clear.dataset.clear;
    if (k === 'bond') bond = null;
    else if (k === 'tier') tier = 0;
    else if (k === 'kind') kindFilter = 'all';
    else if (k === 'group') { groupMode = 'bond'; saveGrouping(); }
    else if (k === 'all') return reset();
    render();
    return;
  }

  const effect = e.target.closest('[data-effect]');
  if (effect) { showBondEffect(effect.dataset.effect); return; }
  const equipment = e.target.closest('[data-equipment]');
  if (equipment) { showEquipmentEffect(equipment.dataset.equipment); return; }

  const op = e.target.closest('[data-op]');
  if (op) { detail(op.dataset.op); return; }

  const b = e.target.closest('[data-bond]');
  if (b) {
    const sheet = b.closest('dialog'); if (sheet) sheet.close();
    bond = bond === b.dataset.bond ? null : b.dataset.bond;
    render();
    return;
  }
  const t = e.target.closest('[data-type]');
  if (t) { type = t.dataset.type; bond = null; render(); return; }
  const r = e.target.closest('[data-tier]');
  if (r) { tier = +r.dataset.tier; render(); return; }
  const k = e.target.closest('[data-kind]');
  if (k) { kindFilter = k.dataset.kind; render(); return; }
  const g = e.target.closest('[data-group]');
  if (g) { groupMode = g.dataset.group; saveGrouping(); render(); return; }
  const d = e.target.closest('[data-display]');
  if (d) { displayMode = d.dataset.display; saveDisplay(); return; }
});

$('#search').addEventListener('input', e => {
  query = e.target.value;
  clearTimeout($('#search')._t);
  $('#search')._t = setTimeout(render, 110);
});
$('#reset').addEventListener('click', reset);
$('#openFilter').addEventListener('click', () => openSheet('filterSheet'));
$('#traitVersion').addEventListener('change', e => { traitVersion = e.target.value; saveDisplay(); });
$('#colorTraits').addEventListener('change', e => { colorTraits = e.target.checked; saveDisplay(); });

$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

document.addEventListener('keydown', e => {
  if (e.key === '/' && e.target.tagName !== 'INPUT' && !document.querySelector('dialog[open]')) {
    e.preventDefault(); $('#search').focus();
  }
});

const dataSource = window.__DATA__
  ? Promise.resolve(window.__DATA__)
  : fetch('data.json').then(r => { if (!r.ok) throw Error('http'); return r.json(); });

dataSource.then(d => {
  data = d;
  buildBondGrid();
  render();
}).catch(() => {
  $('#groups').innerHTML = '<p class="empty">资料加载失败，请刷新页面重试。</p>';
  $('#resultCount').textContent = '载入失败';
});
