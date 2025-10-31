const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const state = {
  teamAName: '', teamALogo: '', scoreA: 0, setsWonA: 0,
  teamBName: '', teamBLogo: '', scoreB: 0, setsWonB: 0,
  setScores: [], serve: null, timeoutA: false, timeoutB: false,
  matchStatus: 'WARMUP', updatedAt: '',
  penalty: { slots: 5, A: Array(5).fill('gray'), B: Array(5).fill('gray') }
};


async function load(){
  const res = await fetch('/api/score?_=' + Date.now());
  Object.assign(state, await res.json());
  paint();
}

function paintPenalty(sideId, arr) {
  const host = document.getElementById(sideId);
  host.innerHTML = '';
  arr.forEach((val, idx) => {
    const d = document.createElement('div');
    d.className = 'dot';
    d.dataset.index = idx;
    d.dataset.side = sideId === 'penA' ? 'A' : 'B';
    d.style.backgroundColor = val || '#808080';
    host.appendChild(d);
  });
}


function paint(){
  $('#teamAName').value = state.teamAName || '';
  $('#teamBName').value = state.teamBName || '';
  $('#scoreA').textContent = state.scoreA;
  $('#scoreB').textContent = state.scoreB;
  $('#setsWonA').value = state.setsWonA;
  $('#setsWonB').value = state.setsWonB;
  $('#matchStatus').value = state.matchStatus || 'WARMUP';
  $('#serve').value = state.serve || '';
  $('#timeoutA').checked = !!state.timeoutA;
  $('#timeoutB').checked = !!state.timeoutB;

  if (state.teamALogo) $('#logoA').src = state.teamALogo; else $('#logoA').removeAttribute('src');
  if (state.teamBLogo) $('#logoB').src = state.teamBLogo; else $('#logoB').removeAttribute('src');
  // penalties
  const slots = state.penalty?.slots ?? 5;
  if (!state.penalty?.A) state.penalty.A = Array(slots).fill('gray');
  if (!state.penalty?.B) state.penalty.B = Array(slots).fill('gray');
  paintPenalty('penA', state.penalty.A);
  paintPenalty('penB', state.penalty.B);

  // preview update
  document.getElementById('jsonPreview').textContent = JSON.stringify(state, null, 2);
  // render set rows
  const list = $('#setList');
  list.innerHTML = '';
  (state.setScores || []).forEach((val, idx) => {
    const row = document.createElement('div');
    row.className = 'setitem';
    row.innerHTML = `
      <span>Set ${idx+1}</span>
      <input data-setidx="${idx}" placeholder="25-23" value="${val}">
      <button data-delset="${idx}">Remove</button>
    `;
    list.appendChild(row);
  });

  $('#jsonPreview').textContent = JSON.stringify(state, null, 2);
}

function collect(){
  const setInputs = $$('#setList input');
  const setScores = setInputs.map(i => i.value.trim()).filter(Boolean);
  return {
    teamAName: $('#teamAName').value.trim() || 'TEAM A',
    teamALogo: state.teamALogo || '',
    teamBName: $('#teamBName').value.trim() || 'TEAM B',
    teamBLogo: state.teamBLogo || '',
    scoreA: parseInt($('#scoreA').textContent, 10) || 0,
    scoreB: parseInt($('#scoreB').textContent, 10) || 0,
    setsWonA: parseInt($('#setsWonA').value, 10) || 0,
    setsWonB: parseInt($('#setsWonB').value, 10) || 0,
    setScores,
    serve: $('#serve').value || null,
    timeoutA: $('#timeoutA').checked,
    timeoutB: $('#timeoutB').checked,
    matchStatus: $('#matchStatus').value
  };
}

async function saveAll(){
  const res = await fetch('/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(collect())
  });
  Object.assign(state, await res.json());
  paint();
}

async function resetAll(){
  if (!confirm('Reset to defaults and delete ALL uploaded logos?')) return;
  const res = await fetch('/api/reset-all', { method: 'POST' });
  const json = await res.json();
  if (json.ok) { Object.assign(state, json.data); paint(); }
  else { alert(json.error || 'Reset failed'); }
}

async function changeScore(team, dir){
  const url = dir === 'inc' ? '/api/score/increment' : '/api/score/decrement';
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team })
  });
  Object.assign(state, await res.json());
  paint();
}

async function uploadLogo(side){
  const input = side === 'A' ? $('#uploadA') : $('#uploadB');
  const file  = input.files[0];
  if (!file) return alert('Choose a file first');
  const fd = new FormData(); fd.append('logo', file);
  const res = await fetch('/api/upload-logo', { method: 'POST', body: fd });
  const data = await res.json();
  if (data.error) return alert(data.error);
  if (side === 'A') state.teamALogo = data.url; else state.teamBLogo = data.url;
  await saveAll(); // persist logo into score.json
}

function nextState(curr) {
  if (curr === '#808080') return '#00FF00';  // gray → green
  if (curr === '#00FF00') return '#FF0000';  // green → red
  return '#808080';                          // red → gray
}
async function setPenalty(side, index, value){
  const res = await fetch('/api/penalty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ side, index, state: value })
  });
  const data = await res.json();
  Object.assign(state, data);
  paint();
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('dot')) {
    const side = e.target.dataset.side;
    const index = Number(e.target.dataset.index);
    const curr = rgbToHex(window.getComputedStyle(e.target).backgroundColor);
    const next = nextState(curr);
    e.target.style.backgroundColor = next;
    fetch('/api/penalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ side, index, state: next })
    }).then(r => r.json()).then(data => {
      Object.assign(state, data);
      paint();
    });
  }
});

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return '#808080';
  return '#' + m.slice(0, 3).map(x => ('0' + parseInt(x).toString(16)).slice(-2)).join('').toUpperCase();
}


window.addEventListener('DOMContentLoaded', () => {
  load();

  // header actions
  $('#saveAll').addEventListener('click', saveAll);
  $('#resetAll').addEventListener('click', resetAll);
  $('#refresh').addEventListener('click', load);

  // score buttons
  document.querySelector('[data-inc="A"]').addEventListener('click', () => changeScore('A', 'inc'));
  document.querySelector('[data-inc="B"]').addEventListener('click', () => changeScore('B', 'inc'));
  document.querySelector('[data-dec="A"]').addEventListener('click', () => changeScore('A', 'dec'));
  document.querySelector('[data-dec="B"]').addEventListener('click', () => changeScore('B', 'dec'));

  // logo uploads
  document.querySelector('[data-upload="A"]').addEventListener('click', () => uploadLogo('A'));
  document.querySelector('[data-upload="B"]').addEventListener('click', () => uploadLogo('B'));

  // add/remove set rows
  $('#addSet').addEventListener('click', () => {
    state.setScores = state.setScores || [];
    state.setScores.push('');
    paint();
  });
  $('#setList').addEventListener('click', (e) => {
    const idx = e.target.getAttribute('data-delset');
    if (idx != null) {
      state.setScores.splice(Number(idx), 1);
      paint();
    }
  });

  // live preview update on inputs
  document.body.addEventListener('input', (e) => {
    if (e.target.matches('#teamAName, #teamBName, #setsWonA, #setsWonB, #setList input, #serve, #matchStatus, #timeoutA, #timeoutB')) {
      const merged = { ...state, ...collect() };
      $('#jsonPreview').textContent = JSON.stringify(merged, null, 2);
    }
  });
});
