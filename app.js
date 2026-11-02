'use strict';
const KEY = 'garagelog.db';
const POS = ['FL', 'FR', 'RL', 'RR'];
const POS_NAME = { FL: 'Front Left', FR: 'Front Right', RL: 'Rear Left', RR: 'Rear Right', Stored: 'Stored', Retired: 'Retired' };
const TABS = [['home', '🔔', 'Due'], ['log', '🔧', 'Log'], ['tires', '🛞', 'Tires'], ['miles', '📋', 'Milestones'], ['car', '🚗', 'Car']];

// Generic, widely-used intervals. Always confirm against the owner's manual for the specific car.
const MILESTONES = [
  { name: 'Engine oil & filter', mi: 7500, mo: 12, note: 'Use 5,000 mi for turbo/GDI or severe use.' },
  { name: 'Tire rotation', mi: 6000, mo: 6, note: 'Rotate and check pressure and tread depth.' },
  { name: 'Engine air filter', mi: 20000, mo: 24, note: '' },
  { name: 'Cabin air filter', mi: 15000, mo: 12, note: '' },
  { name: 'Brake fluid', mi: 30000, mo: 24, note: 'Hygroscopic: time-based, change at least every 2-3 years.' },
  { name: 'Brake pads/rotors inspection', mi: 15000, mo: 12, note: 'Measure pad thickness and rotor wear.' },
  { name: 'Spark plugs', mi: 60000, mo: 0, note: 'Copper ~30k, platinum/iridium 60k-100k.' },
  { name: 'Transmission fluid', mi: 60000, mo: 0, note: 'Many OEMs say "lifetime" - 60k is a safe real-world interval. DCT/CVT: 40k-60k.' },
  { name: 'Coolant', mi: 60000, mo: 60, note: 'Long-life coolants: first at 100k-120k, then every 50k-60k.' },
  { name: 'Differential / transfer case oil', mi: 60000, mo: 0, note: 'AWD/4WD and RWD cars.' },
  { name: 'Serpentine/accessory belt', mi: 90000, mo: 72, note: 'Inspect for cracks at 60k.' },
  { name: 'Timing belt (+ water pump, tensioner)', mi: 90000, mo: 84, note: 'Typical 60k-105k or 7-10 yrs. Chain engines: inspect instead.' },
  { name: 'Power steering fluid', mi: 60000, mo: 48, note: 'Hydraulic systems only.' },
  { name: 'Fuel filter', mi: 60000, mo: 0, note: 'If serviceable on your car.' },
  { name: '12V battery', mi: 0, mo: 48, note: 'Test yearly after year 3.' },
  { name: 'Wiper blades', mi: 0, mo: 12, note: '' },
  { name: 'Tires replacement', mi: 50000, mo: 72, note: 'Replace at 2/32" tread or ~6-10 yrs from DOT date.' }
];

// Adapts the generic list to the decoded VIN data (powertrain, transmission, drivetrain).
function getMilestones(v) {
  let L = MILESTONES.map(m => ({ ...m }));
  const i = v.info || {};
  if (!i.make) return L;
  const f = (n, fn) => { const m = L.find(x => x.name === n); if (m) fn(m); };
  const drop = (...ns) => { L = L.filter(m => !ns.includes(m.name)); };
  const ev = /electric/i.test(i.fuel || '') && !/gasoline|diesel/i.test(i.fuel || '');
  const diesel = /diesel/i.test(i.fuel || '');
  const hybrid = /hybrid|PHEV|HEV/i.test(i.elec || '');
  const trans = i.trans || '';
  if (ev) {
    drop('Engine oil & filter', 'Spark plugs', 'Timing belt (+ water pump, tensioner)', 'Serpentine/accessory belt', 'Fuel filter', 'Power steering fluid', 'Engine air filter', 'Transmission fluid', 'Differential / transfer case oil');
    L.push({ name: 'Reduction gear oil', mi: 100000, mo: 0, note: 'Single-speed drive unit; many makers say lifetime, 100k is conservative.' });
    f('Coolant', m => { m.note = 'Covers battery/inverter loop - follow the OEM spec closely.'; });
    f('Brake pads/rotors inspection', m => { m.note = 'Regen braking lowers wear, but rust builds up - clean/lube slides yearly.'; });
  } else {
    if (diesel) {
      f('Engine oil & filter', m => { m.mi = 7500; m.note = 'Use low-ash (CK-4/C3) oil per OEM spec.'; });
      f('Fuel filter', m => { m.mi = 20000; m.mo = 12; m.note = 'Diesel fuel filter + drain water separator.'; });
      drop('Spark plugs');
      L.push({ name: 'DPF / EGR inspection', mi: 60000, mo: 0, note: 'Check DPF soot load, EGR valve and intake cleanliness.' });
    }
    if (i.turbo || i.gdi) f('Engine oil & filter', m => { m.mi = 5000; m.mo = 6; m.note = (i.turbo ? 'Turbo' : 'Direct-injection') + ' engine: shorter interval protects the turbo/valves.'; });
    if (i.turbo) f('Spark plugs', m => { m.mi = 40000; m.note = 'Turbo engines wear plugs faster.'; });
    if (i.gdi) L.push({ name: 'Intake valve carbon cleaning', mi: 80000, mo: 0, note: 'Direct injection has no fuel washing the valves - walnut blasting if rough idle.' });
  }
  if (hybrid) {
    f('Brake pads/rotors inspection', m => { m.mi = 30000; m.note = 'Regen braking extends pad life.'; });
    L.push({ name: 'Hybrid battery / inverter coolant', mi: 100000, mo: 120, note: 'Separate loop on most hybrids.' });
  }
  if (!ev) {
    if (/cvt/i.test(trans)) f('Transmission fluid', m => { m.mi = 40000; m.note = 'CVT: use only the OEM fluid; do not skip.'; });
    else if (/dual|dct|dsg/i.test(trans)) f('Transmission fluid', m => { m.mi = 40000; m.note = 'DCT: fluid (and often filter) at 40k.'; });
    else if (/manual/i.test(trans)) f('Transmission fluid', m => { m.mi = 45000; m.note = 'Manual gear oil: 30k-60k depending on OEM.'; });
    if (/manual/i.test(trans)) L.push({ name: 'Clutch inspection', mi: 60000, mo: 0, note: 'Check pedal feel, slip, and fluid.' });
  }
  const drive = (i.drive || '').toUpperCase();
  if (/FWD|FRONT/.test(drive) && !/ALL|4/.test(drive)) drop('Differential / transfer case oil');
  else if (/AWD|4WD|ALL|4X4/.test(drive)) f('Differential / transfer case oil', m => { m.mi = 40000; m.note = 'AWD/4WD: front + rear diff and transfer case.'; });
  const cyl = +i.cyl || 0;
  if (cyl >= 6) f('Spark plugs', m => { m.note += ' ' + cyl + '-cyl: more plugs, check for hard-to-reach rear bank.'; });
  return L;
}

let db = JSON.parse(localStorage.getItem(KEY) || 'null') || { vehicles: [], sel: null, tab: 'home' };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = n => Number(n).toLocaleString();
const save = () => { db.ts = Date.now(); localStorage.setItem(KEY, JSON.stringify(db)); scheduleCloud(); };

// Cloud backup: private GitHub Gist, written by the user's own token (stored only on this device).
const CK = 'garagelog.cloud';
const cloud = () => JSON.parse(localStorage.getItem(CK) || '{}');
const setCloud = c => localStorage.setItem(CK, JSON.stringify(c));
let cloudTimer;
function scheduleCloud() {
  if (!cloud().token) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => backupNow(true), 4000);
}
async function gh(path, opt = {}) {
  const r = await fetch('https://api.github.com' + path, { ...opt, headers: { Authorization: 'Bearer ' + cloud().token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } });
  if (!r.ok) throw new Error(r.status === 401 ? 'Invalid token' : 'GitHub error ' + r.status);
  return r.json();
}
async function backupNow(quiet) {
  const c = cloud(); if (!c.token) return;
  db.ts = db.ts || Date.now();
  const body = { files: { 'garagelog.json': { content: JSON.stringify(db) } } };
  try {
    if (c.gist) await gh('/gists/' + c.gist, { method: 'PATCH', body: JSON.stringify(body) });
    else c.gist = (await gh('/gists', { method: 'POST', body: JSON.stringify({ description: 'GarageLog backup', public: false, ...body }) })).id;
    c.last = new Date().toLocaleString(); c.err = ''; setCloud(c);
  } catch (e) { c.err = e.message; setCloud(c); if (!quiet) toast(e.message); }
  if (db.tab === 'car') render();
}
function connectCloud(e) {
  e.preventDefault();
  const token = new FormData(e.target).get('token').trim();
  const c = cloud(); setCloud({ ...c, token });
  gh('/gists?per_page=100').then(async list => {
    const found = list.find(g => g.description === 'GarageLog backup' && g.files['garagelog.json']);
    const nc = cloud();
    if (found) {
      nc.gist = found.id; setCloud(nc);
      if (confirm('An existing cloud backup was found. Restore it onto this device? (Cancel keeps this device\'s data and overwrites the backup.)')) return restoreCloud();
    }
    await backupNow(); render();
  }).catch(err => { setCloud({}); toast(err.message); });
}
async function restoreCloud() {
  try {
    const g = await gh('/gists/' + cloud().gist);
    const f = g.files['garagelog.json'];
    const d = JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content);
    if (!Array.isArray(d.vehicles)) throw new Error('Backup is invalid');
    db = d; localStorage.setItem(KEY, JSON.stringify(db)); render(); toast('Restored from cloud.');
  } catch (e) { toast(e.message); }
}
// Cross-device sync: newest copy (db.ts) wins. Runs on open and whenever the app regains focus.
let syncing = false;
async function syncCloud() {
  const c = cloud(); if (!c.token || !c.gist || syncing || cloudTimer) return;
  syncing = true;
  try {
    const g = await gh('/gists/' + c.gist), f = g.files['garagelog.json'];
    const remote = JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content);
    if (Array.isArray(remote.vehicles) && (remote.ts || 0) > (db.ts || 0)) {
      const { sel, tab } = db;
      db = remote; db.tab = tab || 'home';
      db.sel = remote.vehicles.some(v => v.id === sel) ? sel : remote.vehicles[0]?.id || null;
      localStorage.setItem(KEY, JSON.stringify(db));
      const n = cloud(); n.last = new Date().toLocaleString(); n.err = ''; setCloud(n);
      if (!document.activeElement || !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName || '')) render();
    } else if ((db.ts || 0) > (remote.ts || 0)) await backupNow(true);
  } catch (e) { const n = cloud(); n.err = e.message; setCloud(n); }
  syncing = false;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncCloud(); });
window.addEventListener && window.addEventListener('focus', syncCloud);

function disconnectCloud() { if (confirm('Disconnect cloud backup? The backup copy stays in your GitHub account.')) { setCloud({}); render(); } }
const veh = () => db.vehicles.find(v => v.id === db.sel);
const addMonths = (d, m) => { const x = new Date(d + 'T12:00:00'); x.setMonth(x.getMonth() + m); return x; };
const daysTo = d => Math.round((d - new Date()) / 864e5);

function lastLog(v, name) {
  return v.logs.filter(l => l.type.toLowerCase() === name.toLowerCase())
    .sort((a, b) => b.odo - a.odo || b.date.localeCompare(a.date))[0];
}

function status(v, name, mi, mo) {
  const last = lastLog(v, name);
  if (!last) return { cls: 'none', label: 'No record', sort: -1e9, text: 'Never logged' };
  const parts = []; let cls = 'ok', sort = 1e9;
  if (mi) {
    const left = last.odo + mi - v.odo; sort = Math.min(sort, left);
    parts.push(left < 0 ? `${fmt(-left)} mi overdue` : `${fmt(left)} mi left`);
    if (left < 0) cls = 'over'; else if (left <= Math.max(500, mi * 0.1)) cls = 'soon';
  }
  if (mo) {
    const days = daysTo(addMonths(last.date, mo)); sort = Math.min(sort, days * 40);
    parts.push(days < 0 ? `${-days} days overdue` : `${days} days left`);
    if (days < 0) cls = 'over'; else if (days <= 30 && cls === 'ok') cls = 'soon';
  }
  return { cls, sort, label: cls === 'over' ? 'Overdue' : cls === 'soon' ? 'Soon' : 'OK', text: `${parts.join(' / ')} · last ${last.date} @ ${fmt(last.odo)} mi` };
}

function tireMiles(v, t) {
  return (t.offset || 0) + t.hist.reduce((s, h) => s + Math.max(0, (h.end ?? v.odo) - h.start), 0);
}

function setPos(v, t, pos) {
  const open = t.hist.find(h => h.end == null);
  if (open) open.end = v.odo;
  t.pos = pos;
  if (POS.includes(pos)) t.hist.push({ pos, start: v.odo, end: null, date: today() });
}

function toast(m) { alert(m); }
function render() {
  const sel = $('#veh');
  sel.innerHTML = db.vehicles.map(v => `<option value="${v.id}" ${v.id === db.sel ? 'selected' : ''}>${esc(v.name)}</option>`).join('') || '<option>No cars yet</option>';
  $('#nav').innerHTML = TABS.map(([k, i, l]) => `<button class="${db.tab === k ? 'on' : ''}" onclick="go('${k}')"><b>${i}</b>${l}</button>`).join('');
  const v = veh();
  $('#main').innerHTML = !v ? `<div class="card"><h2>Welcome</h2><p>Add your first car with <b>+ Car</b>. Enter a VIN to auto-fill its specs.</p></div>${backupCards()}` : views[db.tab](v);
}
function go(t) { db.tab = t; save(); render(); window.scrollTo(0, 0); }
$('#veh').onchange = e => { db.sel = e.target.value; save(); render(); };
$('#addveh').onclick = addVehicle;

function addVehicle() {
  const name = prompt('Car nickname (e.g. "Miata"):');
  if (!name) return;
  const v = { id: uid(), name, vin: '', odo: 0, info: {}, logs: [], reminders: [], tires: [] };
  db.vehicles.push(v); db.sel = v.id; db.tab = 'car'; save(); render();
}

const views = {
  home(v) {
    const list = v.reminders.map(r => ({ r, s: status(v, r.name, r.mi, r.mo) })).sort((a, b) => a.s.sort - b.s.sort);
    return `<div class="card"><div class="row"><div><h3>Odometer</h3><div class="mu">Update before each task</div></div>
      <form class="row" onsubmit="setOdo(event)" style="width:55%"><input name="odo" type="number" inputmode="numeric" value="${v.odo}" required><button>Save</button></form></div></div>
      <h2>Upcoming maintenance</h2>
      ${list.map(({ r, s }) => `<div class="card"><div class="row"><h3>${esc(r.name)}</h3><span class="tag ${s.cls}">${s.label}</span></div>
        <div class="mu">Every ${[r.mi && fmt(r.mi) + ' mi', r.mo && r.mo + ' mo'].filter(Boolean).join(' or ')}</div><div>${s.text}</div>
        <div class="row"><button class="sec" onclick="quickLog('${esc(r.name).replace(/'/g, '')}')">Log it now</button><button class="del" onclick="delRem('${r.id}')">Remove</button></div></div>`).join('')
        || '<div class="card mu">No reminders yet. Open <b>Milestones</b> to add OEM-style reminders, or add your own in <b>Log</b>.</div>'}`;
  },
  log(v) {
    const logs = [...v.logs].sort((a, b) => b.odo - a.odo || b.date.localeCompare(a.date));
    const names = [...new Set([...getMilestones(v).map(m => m.name), ...v.logs.map(l => l.type)])];
    return `<datalist id="types">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="card"><h2>Add service record</h2><form id="logform" onsubmit="addLog(event)">
        <input name="type" list="types" placeholder="What did you do? (e.g. Engine oil & filter)" required>
        <div class="grid"><input name="date" type="date" value="${today()}" required><input name="odo" type="number" inputmode="numeric" placeholder="Mileage" value="${v.odo || ''}" required></div>
        <div class="grid"><input name="cost" type="number" step="0.01" inputmode="decimal" placeholder="Cost (optional)"><input name="parts" placeholder="Parts / brand"></div>
        <textarea name="notes" rows="2" placeholder="Notes"></textarea>
        <details><summary class="mu">Set repeat reminder</summary>
          <div class="grid"><input name="rmi" type="number" inputmode="numeric" placeholder="Every __ miles"><input name="rmo" type="number" inputmode="numeric" placeholder="Every __ months"></div></details>
        <button>Save record</button></form></div>
      <h2>History (${logs.length})</h2>
      ${logs.map(l => `<div class="card"><div class="row"><h3>${esc(l.type)}</h3><button class="del" onclick="delLog('${l.id}')">✕</button></div>
        <div class="mu">${l.date} · ${fmt(l.odo)} mi${l.cost ? ' · $' + Number(l.cost).toFixed(2) : ''}${l.parts ? ' · ' + esc(l.parts) : ''}</div>${l.notes ? `<div>${esc(l.notes)}</div>` : ''}</div>`).join('') || '<div class="mu">Nothing logged yet.</div>'}`;
  },
  tires(v) {
    const sets = [...new Set(v.tires.map(t => t.set))];
    const mounted = POS.map(p => ({ p, t: v.tires.find(t => t.pos === p) }));
    const optsOf = t => ['Stored', ...POS, 'Retired'].map(p => `<option value="${p}" ${t.pos === p ? 'selected' : ''}>${POS_NAME[p]}</option>`).join('');
    return `<h2>On the car now</h2><div class="card"><div class="grid">${mounted.map(({ p, t }) =>
      `<div><span class="mu">${POS_NAME[p]}</span><br>${t ? `<b>${esc(t.set)}</b> · ${fmt(tireMiles(v, t))}${t.unk ? '+' : ''} mi` : '—'}</div>`).join('')}</div></div>
      <div class="card"><h3 id="addtitle">Add tires</h3><form id="tireform" onsubmit="addTires(event)">
        <div class="grid"><input name="set" list="sets" placeholder="Set name (Winter, Summer...)" required><input name="brand" placeholder="Brand / model"></div>
        <datalist id="sets">${sets.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
        <div class="grid"><input name="size" placeholder="Size 225/45R17"><input name="dot" placeholder="DOT date (e.g. 2423)"></div>
        <div class="mu" style="margin-top:6px"><b>Miles already on the tires</b></div>
        <input name="offset" type="number" inputmode="numeric" placeholder="Miles before using this app (0 if brand new)">
        <label class="mu"><input type="checkbox" name="unk" style="width:auto" onchange="this.form.offset.disabled=this.checked"> I don't know - just count from today</label>
        <div class="mu" style="margin-top:8px"><b>Which wheels?</b> Enter the set once - pick a status for each wheel. Leave "—" for tires you don't have (add a single replacement by choosing just one wheel).</div>
        <div class="grid">${POS.map(p => `<label class="mu">${POS_NAME[p]}<select name="w_${p}"><option value="on">On the car now</option><option value="st">Stored (was here)</option><option value="">—</option></select></label>`).join('')}</div>
        <button>Add tires</button></form>
        <div class="mu">Replacing a flat? Press <b>Retire tire</b> on the old tire's card, then <b>Copy</b> on any tire of the set. The form fills in; choose the wheel and leave miles at 0 for a new tire.</div></div>
      ${sets.map(s => `<div class="row"><h2>${esc(s)}</h2>${v.tires.some(t => t.set === s && t.pos === 'Stored') ? `<button onclick="mountSet('${esc(s).replace(/'/g, '')}')">Put this set on the car</button>` : v.tires.some(t => t.set === s && POS.includes(t.pos)) ? `<button class="sec" onclick="storeSet('${esc(s).replace(/'/g, '')}')">Take off & store</button>` : ''}</div>` + v.tires.filter(t => t.set === s).map(t => `<div class="card"><div class="row"><h3>${esc(t.brand || 'Tire')} ${esc(t.size || '')}</h3><b>${fmt(tireMiles(v, t))}${t.unk ? '+' : ''} mi</b></div>
        <div class="mu">${t.dot ? 'DOT ' + esc(t.dot) + ' · ' : ''}${t.unk ? 'Earlier miles unknown (counting from when added)' : 'Started with ' + fmt(t.offset || 0) + ' mi'} · <a href="#" style="color:var(--ac)" onclick="editOffset('${t.id}');return false">edit</a></div>
        <div>${t.pos === 'Retired' ? '⛔ Retired' : POS.includes(t.pos) ? '📍 On car: ' + POS_NAME[t.pos] : '📦 Stored · last on: <b>' + (POS_NAME[lastPosOf(t)] || 'unknown') + '</b>'}</div>
        ${t.pos === 'Stored' && !t.hist.length ? `<select onchange="setLastPos('${t.id}',this.value)"><option value="">Set last wheel position...</option>${POS.map(p => `<option value="${p}" ${t.lastPos === p ? 'selected' : ''}>${POS_NAME[p]}</option>`).join('')}</select>` : ''}
        <select onchange="movTire('${t.id}',this.value)">${optsOf(t)}</select>
        <details><summary class="mu">Position history</summary>${t.hist.map(h => `<div class="mu">${POS_NAME[h.pos]}: ${fmt(h.start)} → ${h.end == null ? 'now' : fmt(h.end)} mi (${fmt((h.end ?? v.odo) - h.start)} mi)</div>`).join('') || '<div class="mu">Never mounted</div>'}</details>
        ${t.pos !== 'Retired' ? `<button class="sec" onclick="retireTire('${t.id}')">Retire tire</button> ` : ''}<button class="sec" onclick="copyTire('${t.id}')">Copy</button> <button class="del" onclick="delTire('${t.id}')">Delete</button></div>`).join('')).join('')}`;
  },
  miles(v) {
    const ML = getMilestones(v);
    const i = v.info || {};
    const items = ML.map(m => {
      const last = lastLog(v, m.name);
      const next = m.mi ? (last ? last.odo + m.mi : Math.ceil((v.odo + 1) / m.mi) * m.mi) : null;
      const has = v.reminders.some(r => r.name.toLowerCase() === m.name.toLowerCase());
      return { m, last, next, has };
    }).sort((a, b) => (a.next ?? 1e9) - (b.next ?? 1e9));
    const profile = [i.year, i.make, i.model, i.engine, i.trans, i.drive].filter(Boolean).join(' · ');
    const rc = v.recalls;
    return `<h2>Recommended maintenance</h2><div class="mu" style="margin-bottom:8px">${profile ? `Tailored for: ${esc(profile)}.` : 'Generic intervals - load your VIN in the Car tab to tailor this list.'} Always confirm against the owner's manual.</div>
      ${v.vin ? `<div class="card"><div class="row"><h3>Recalls</h3><button class="sec" onclick="loadRecalls()">Refresh</button></div>${rc == null ? '<div class="mu">Not checked yet.</div>' : rc.length ? rc.map(r => `<div style="margin-top:6px"><b>${esc(r.Component)}</b> <span class="mu">${esc(r.NHTSACampaignNumber)}</span><div class="mu">${esc(r.Summary).slice(0, 220)}…</div></div>`).join('') : '<div class="mu">No open recalls found for this model/year.</div>'}</div>` : ''}
      ${items.map(({ m, last, next, has }) => `<div class="card"><div class="row"><h3>${esc(m.name)}</h3>${next != null ? `<span class="tag ${next - v.odo < 0 ? 'over' : next - v.odo < 3000 ? 'soon' : 'ok'}">${fmt(next)} mi</span>` : ''}</div>
        <div class="mu">Every ${[m.mi && fmt(m.mi) + ' mi', m.mo && m.mo + ' mo'].filter(Boolean).join(' or ')}${last ? ' · last done at ' + fmt(last.odo) + ' mi' : ' · no record'}</div>
        ${m.note ? `<div>${esc(m.note)}</div>` : ''}
        ${has ? '<div class="mu">✔ Reminder active</div>' : `<button class="sec" onclick="        addMile('${ML.indexOf(m)}')">Add reminder</button>`}
        <details><summary style="color:var(--ac);padding:6px 0">+ Add to history (past or present)</summary>
                  <form onsubmit="addPast(event,${ML.indexOf(m)})">
            <div class="grid"><input name="date" type="date" max="${today()}" required><input name="odo" type="number" inputmode="numeric" placeholder="Mileage" required></div>
            <input name="notes" placeholder="Notes / parts (optional)">
            <label class="mu"><input type="checkbox" name="rem" ${has ? '' : 'checked'} style="width:auto"> Keep reminder active</label><br>
            <button>Save to history</button></form></details>
        ${last ? `<div class="mu">${v.logs.filter(l => l.type.toLowerCase() === m.name.toLowerCase()).length} record(s) logged</div>` : ''}</div>`).join('')}`;
  },
  car(v) {
    const i = v.info || {};
    const rows = [['Year', i.year], ['Make', i.make], ['Model', i.model], ['Trim', i.trim], ['Engine', i.engine], ['Fuel', i.fuel], ['Drive', i.drive], ['Trans.', i.trans], ['Body', i.body], ['Built in', i.plant]].filter(r => r[1]);
    return `<div class="card"><h2>${esc(v.name)}</h2>
      <form onsubmit="decodeVin(event)"><input name="vin" value="${esc(v.vin)}" placeholder="17-character VIN" maxlength="17" autocapitalize="characters" required><button>Load info from VIN</button></form>
      ${rows.length ? `<div class="car" style="margin-top:10px">${rows.map(([k, x]) => `<div><span>${k}</span><br>${esc(x)}</div>`).join('')}</div>` : ''}
      <div style="margin-top:10px"><button class="sec" onclick="renameCar()">Rename</button> <button class="del" onclick="delCar()">Delete car</button></div></div>
      ${backupCards()}`;
  }
};

function backupCards() {
  return `<div class="card"><h3>Cloud backup</h3>${cloud().token ? `<div>✔ Automatic backup on (private GitHub Gist)</div><div class="mu">Last: ${esc(cloud().last || 'not yet')}${cloud().err ? ' · <span style="color:var(--bad)">' + esc(cloud().err) + '</span>' : ''}</div>
        <button onclick="backupNow()">Back up now</button> <button class="sec" onclick="restoreCloud()">Restore</button> <button class="del" onclick="disconnectCloud()">Disconnect</button>`
        : `<div class="mu">Every change is saved automatically to a private GitHub Gist in your account. Create a token at github.com/settings/tokens (classic) with only the <b>gist</b> permission, paste it here. On a new phone or PC, enter the same token and choose Restore.</div>
        <form onsubmit="connectCloud(event)"><input name="token" type="password" placeholder="GitHub token (gist scope)" required autocomplete="off"><button>Connect</button></form>`}</div>
      <div class="card"><h3>Backup file</h3><div class="mu">Manual copy. Export regularly too.</div>
        <button class="sec" onclick="exportData()">Export</button> <button class="sec" onclick="$('#imp').click()">Import</button>
        <input id="imp" type="file" accept="application/json" hidden onchange="importData(event)"></div>`;
}

function setOdo(e) { e.preventDefault(); veh().odo = +new FormData(e.target).get('odo'); save(); render(); }
function quickLog(name) { db.tab = 'log'; save(); render(); document.querySelector('[name=type]').value = name; document.querySelector('[name=notes]').focus(); }
function delRem(id) { const v = veh(); v.reminders = v.reminders.filter(r => r.id !== id); save(); render(); }
function addMile(i) { const m = getMilestones(veh())[i]; veh().reminders.push({ id: uid(), name: m.name, mi: m.mi, mo: m.mo }); save(); render(); }

function addPast(e, i) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), v = veh(), m = getMilestones(veh())[i];
  v.logs.push({ id: uid(), type: m.name, date: f.date, odo: +f.odo, cost: '', parts: '', notes: f.notes });
  if (+f.odo > v.odo) v.odo = +f.odo;
  if (f.rem && !v.reminders.some(r => r.name.toLowerCase() === m.name.toLowerCase())) v.reminders.push({ id: uid(), name: m.name, mi: m.mi, mo: m.mo });
  save(); render();
}

function addLog(e) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), v = veh();
  const l = { id: uid(), type: f.type.trim(), date: f.date, odo: +f.odo, cost: f.cost, parts: f.parts, notes: f.notes };
  v.logs.push(l);
  if (l.odo > v.odo) v.odo = l.odo;
  if (f.rmi || f.rmo) {
    const ex = v.reminders.find(r => r.name.toLowerCase() === l.type.toLowerCase());
    if (ex) { ex.mi = +f.rmi || 0; ex.mo = +f.rmo || 0; } else v.reminders.push({ id: uid(), name: l.type, mi: +f.rmi || 0, mo: +f.rmo || 0 });
  }
  save(); render();
}
function delLog(id) { if (confirm('Delete this record?')) { const v = veh(); v.logs = v.logs.filter(l => l.id !== id); save(); render(); } }

function addTires(e) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), v = veh();
  const wheels = POS.filter(p => f['w_' + p]);
  if (!wheels.length) return toast('Pick at least one wheel.');
  const mountTo = wheels.filter(p => f['w_' + p] === 'on');
  const busy = v.tires.filter(t => mountTo.includes(t.pos) && t.set !== f.set.trim());
  if (busy.length && !confirm(`${busy.length} tire(s) from another set are on those wheels. Move them to Stored?`)) return;
  busy.forEach(t => setPos(v, t, 'Stored'));
  const replaced = v.tires.filter(t => mountTo.includes(t.pos));
  replaced.forEach(t => setPos(v, t, 'Stored'));
  wheels.forEach(p => {
    const t = { id: uid(), set: f.set.trim(), brand: f.brand, size: f.size, dot: f.dot, offset: f.unk ? 0 : +f.offset || 0, unk: !!f.unk, pos: 'Stored', lastPos: p, hist: [] };
    v.tires.push(t);
    if (f['w_' + p] === 'on') setPos(v, t, p);
  });
  save(); render();
}
function copyTire(id) {
  const t = veh().tires.find(x => x.id === id), form = $('#tireform');
  form.set.value = t.set; form.brand.value = t.brand || ''; form.size.value = t.size || ''; form.dot.value = t.dot || '';
  form.offset.value = 0; form.unk.checked = false; form.offset.disabled = false;
  POS.forEach(p => form['w_' + p].value = '');
  $('#addtitle').textContent = 'Add tire (copied from ' + (t.brand || t.set) + ') - pick the wheel';
  window.scrollTo(0, 0);
}
function editOffset(id) {
  const t = veh().tires.find(x => x.id === id);
  const a = prompt('Miles on this tire before using the app. Leave blank if unknown:', t.unk ? '' : t.offset || 0);
  if (a === null) return;
  t.unk = a.trim() === ''; t.offset = t.unk ? 0 : +a || 0; save(); render();
}
const lastPosOf = t => t.hist.length ? t.hist[t.hist.length - 1].pos : (t.lastPos || '');
function setLastPos(id, p) { const t = veh().tires.find(x => x.id === id); t.lastPos = p; save(); render(); }
function retireTire(id) { if (confirm('Retire this tire (flat/worn out/discarded)? Its miles are kept in the history.')) movTire(id, 'Retired'); }

// Swap sets: stores whatever is on the car, then puts each tire of this set back where it was last.
function mountSet(set) {
  const v = veh(), tires = v.tires.filter(t => t.set === set && t.pos === 'Stored');
  const plan = tires.map(t => ({ t, p: lastPosOf(t) }));
  if (plan.some(x => !POS.includes(x.p)) && !confirm('Some tires have no known last position and will stay stored. Continue?')) return;
  const targets = plan.filter(x => POS.includes(x.p)).map(x => x.p);
  v.tires.filter(t => targets.includes(t.pos) && t.set !== set).forEach(t => setPos(v, t, 'Stored'));
  plan.filter(x => POS.includes(x.p)).forEach(x => setPos(v, x.t, x.p));
  save(); render();
}
function storeSet(set) { const v = veh(); v.tires.filter(t => t.set === set && POS.includes(t.pos)).forEach(t => setPos(v, t, 'Stored')); save(); render(); }
function movTire(id, pos) {
  const v = veh(), t = v.tires.find(x => x.id === id);
  const other = POS.includes(pos) && v.tires.find(x => x.pos === pos && x.id !== id);
  if (other) {
    if (!confirm(`${POS_NAME[pos]} is occupied by a tire from "${other.set}". Move it to Stored?`)) { render(); return; }
    setPos(v, other, 'Stored');
  }
  setPos(v, t, pos); save(); render();
}
function delTire(id) { if (confirm('Delete this tire and its history?')) { const v = veh(); v.tires = v.tires.filter(t => t.id !== id); save(); render(); } }

async function decodeVin(e) {
  e.preventDefault();
  const v = veh(), vin = new FormData(e.target).get('vin').trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return toast('VIN must be 17 characters (no I, O or Q).');
  try {
    const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`);
    const d = (await r.json()).Results[0];
    const eng = [d.DisplacementL && (+d.DisplacementL).toFixed(1) + 'L', d.EngineCylinders && d.EngineCylinders + 'cyl', d.EngineHP && d.EngineHP + 'hp', d.Turbo && /turbo/i.test(d.Turbo) ? 'Turbo' : ''].filter(Boolean).join(' ');
    v.vin = vin;
    v.info = { year: d.ModelYear, make: d.Make, model: d.Model, trim: d.Trim, engine: eng, fuel: d.FuelTypePrimary, drive: d.DriveType, trans: d.TransmissionStyle, body: d.BodyClass,     plant: [d.PlantCity, d.PlantCountry].filter(Boolean).join(', '),
          elec: d.ElectrificationLevel, turbo: !!d.Turbo && /turbo/i.test(d.Turbo), gdi: /direct/i.test(d.FuelInjectionType || ''), cyl: d.EngineCylinders };
        v.recalls = null;
        if (d.ErrorCode && d.ErrorCode !== '0' && !d.Make) toast('VIN not recognized: ' + d.ErrorText);
        save(); render();
        loadRecalls();
      } catch { toast('Could not reach the VIN service. Check your connection.'); }
    }
    async function loadRecalls() {
      const v = veh(), i = v.info || {};
      if (!i.make) return;
      try {
        const u = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(i.make)}&model=${encodeURIComponent(i.model)}&modelYear=${encodeURIComponent(i.year)}`;
        v.recalls = ((await (await fetch(u)).json()).results || []).slice(0, 15);
        save(); render();
      } catch { toast('Could not load recalls.'); }
    }
function renameCar() { const n = prompt('New name:', veh().name); if (n) { veh().name = n; save(); render(); } }
function delCar() { if (confirm('Delete this car and ALL its data?')) { db.vehicles = db.vehicles.filter(v => v.id !== db.sel); db.sel = db.vehicles[0]?.id || null; save(); render(); } }

function exportData() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }));
  a.download = `garagelog-${today()}.json`; a.click();
}
function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { const d = JSON.parse(t); if (!Array.isArray(d.vehicles)) throw 0; db = d; save(); render(); }).catch(() => toast('Invalid backup file.'));
}

if (!db.sel && db.vehicles[0]) db.sel = db.vehicles[0].id;
render();
syncCloud();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js');
