/* ===================================================================
   COPA 2026 — Jundiaí/SP — app.js
   - Carrega dados estáticos (/data/matches.json)
   - Tenta carregar dados em tempo real via /api/live (placar, classificação,
     artilheiros). Se a API não estiver configurada, mostra estado vazio
     explicando como ativar.
=================================================================== */

const TEAM_EN = {
  "México":"Mexico","África do Sul":"South Africa","Coreia do Sul":"South Korea","República Tcheca":"Czech Republic",
  "Canadá":"Canada","Catar":"Qatar","Suíça":"Switzerland","Bósnia e Herzegovina":"Bosnia and Herzegovina",
  "Brasil":"Brazil","Marrocos":"Morocco","Haiti":"Haiti","Escócia":"Scotland",
  "Estados Unidos":"USA","Paraguai":"Paraguay","Austrália":"Australia","Turquia":"Turkey",
  "Alemanha":"Germany","Curaçao":"Curacao","Costa do Marfim":"Ivory Coast","Equador":"Ecuador",
  "Holanda":"Netherlands","Japão":"Japan","Tunísia":"Tunisia","Suécia":"Sweden",
  "Bélgica":"Belgium","Egito":"Egypt","Irã":"Iran","Nova Zelândia":"New Zealand",
  "Espanha":"Spain","Cabo Verde":"Cape Verde","Arábia Saudita":"Saudi Arabia","Uruguai":"Uruguay",
  "França":"France","Senegal":"Senegal","Noruega":"Norway","Iraque":"Iraq",
  "Argentina":"Argentina","Argélia":"Algeria","Áustria":"Austria","Jordânia":"Jordan",
  "Portugal":"Portugal","Uzbequistão":"Uzbekistan","Colômbia":"Colombia","RD Congo":"DR Congo",
  "Inglaterra":"England","Croácia":"Croatia","Gana":"Ghana","Panamá":"Panama",
};

const CHANNELS = [
  {name:"CazéTV (YouTube)", desc:"Transmite os 104 jogos da Copa, com narração própria.", live:true},
  {name:"TV Globo", desc:"Jogos do Brasil e principais confrontos da Copa em TV aberta."},
  {name:"SporTV", desc:"Cobertura ampliada em TV fechada, incluindo jogos extras."},
  {name:"Globoplay / ge TV", desc:"Streaming com jogos simultâneos aos da Globo/SporTV."},
  {name:"SBT", desc:"Parte dos jogos do Brasil e grandes confrontos em TV aberta."},
  {name:"N Sports (YouTube)", desc:"Transmissão alternativa de jogos selecionados."},
];

let DATA = {matches:[], groups:{}};
let LIVE = {fixtures:null, standings:null, topscorers:null, configured:null};

/* ---------- Helpers ---------- */
function todaySP(){
  return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
}
function matchDate(m){
  return new Date(`${m.date}T${m.time}:00-03:00`);
}
function fmtDate(m){
  const [y,mo,d] = m.date.split('-');
  return `${d}/${mo} · ${m.weekday}`;
}
function normalize(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

/* ---------- Live data matching ---------- */
function findLiveFixture(m){
  if(!LIVE.fixtures) return null;
  const en1 = normalize(TEAM_EN[m.team1]||m.team1);
  const en2 = normalize(TEAM_EN[m.team2]||m.team2);
  return LIVE.fixtures.find(fx=>{
    const h = normalize(fx.teams?.home?.name);
    const a = normalize(fx.teams?.away?.name);
    return (h.includes(en1) && a.includes(en2)) || (h.includes(en2) && a.includes(en1));
  }) || null;
}

/* ---------- Ticket card ---------- */
function ticketHTML(m){
  const isBrasil = m.team1==='Brasil' || m.team2==='Brasil';
  const fx = findLiveFixture(m);
  let statusHTML = '';
  let scoreHTML = '';

  if(fx){
    const status = fx.fixture?.status?.short; // e.g. 1H, 2H, FT, NS
    const g1 = fx.goals?.home, g2 = fx.goals?.away;
    if(status && status!=='NS' && status!=='TBD' && status!=='PST'){
      if(['1H','2H','HT','ET','P','LIVE'].includes(status)){
        statusHTML = `<span class="live-badge"><span class="dot"></span> Em andamento</span>`;
      } else if(status==='FT' || status==='AET' || status==='PEN'){
        statusHTML = `<span class="chip">Encerrado</span>`;
      }
      if(g1!==null && g1!==undefined){
        scoreHTML = `<div class="score">${g1} – ${g2}</div>`;
      }
    }
  }

  const broadcastChips = m.broadcast.split(',').map(c=>c.trim()).filter(Boolean)
    .map(c=>`<span class="chip ${c.toLowerCase().includes('cazétv')||c.toLowerCase().includes('cazetv')?'live-tv':''}">${c}</span>`).join('');

  return `
  <article class="ticket ${isBrasil?'brasil':''}">
    <div class="ticket-top">
      <div class="ticket-meta-row">
        <span class="stage-tag ${m.group?'':'knockout'}">${m.stage}</span>
        ${statusHTML || `<span class="game-num">Jogo ${m.num}</span>`}
      </div>
      <div class="matchup">
        <div class="team"><span class="flag">${m.flag1}</span><span class="name">${m.team1}</span></div>
        ${scoreHTML || `<div class="vs">x</div>`}
        <div class="team"><span class="flag">${m.flag2}</span><span class="name">${m.team2}</span></div>
      </div>
      <div class="ticket-info">
        <span class="item"><span class="ico">📅</span> ${fmtDate(m)}</span>
        <span class="item time"><span class="ico">⏰</span> ${m.time} (Brasília)</span>
        <span class="item"><span class="ico">📍</span> ${m.stadium_real || m.stadium} — ${m.city}</span>
      </div>
    </div>
    <div class="ticket-divider"></div>
    <div class="ticket-bottom">
      <span class="broadcast-label">Onde assistir:</span>
      ${broadcastChips}
    </div>
  </article>`;
}

/* ---------- Hoje / Próximos ---------- */
function renderHomeLists(){
  const today = todaySP();
  const now = new Date();
  const hoje = DATA.matches.filter(m=>m.date===today);
  const proximos = DATA.matches.filter(m=>matchDate(m) > now && m.date!==today).slice(0,6);

  document.getElementById('count-hoje').textContent = hoje.length;
  document.getElementById('count-proximos').textContent = proximos.length;
  document.getElementById('list-hoje').innerHTML = hoje.length
    ? hoje.map(ticketHTML).join('')
    : `<div class="empty-state"><div class="display">Sem jogos hoje</div><p>Confira a aba "Tabela Completa" para ver todos os próximos confrontos.</p></div>`;
  document.getElementById('list-proximos').innerHTML = proximos.map(ticketHTML).join('');

  renderHeroTicket(hoje, proximos);
}

function renderHeroTicket(hoje, proximos){
  const el = document.getElementById('hero-ticket');
  const now = new Date();
  // "próximo jogo" = primeiro jogo (hoje ou futuro) que ainda não terminou
  // (considera ~2h de duração média por partida)
  const all = [...hoje, ...proximos].sort((a,b)=>matchDate(a)-matchDate(b));
  const next = all.find(m => (matchDate(m).getTime() + 2*60*60*1000) > now.getTime()) || all[0];
  if(!next){ el.innerHTML = ''; return; }
  el.innerHTML = ticketHTML(next);
  startCountdown(next);
}

let countdownTimer = null;
function startCountdown(match){
  if(countdownTimer) clearInterval(countdownTimer);
  const target = matchDate(match);
  const ticket = document.querySelector('#hero-ticket .ticket-top');
  if(!ticket) return;
  const cdEl = document.createElement('div');
  cdEl.className = 'countdown';
  ticket.appendChild(cdEl);
  function tick(){
    const diff = target - new Date();
    if(diff <= 0){ cdEl.innerHTML = '<strong>Começou!</strong>'; clearInterval(countdownTimer); return; }
    const d = Math.floor(diff/86400000);
    const h = Math.floor(diff%86400000/3600000);
    const mi = Math.floor(diff%3600000/60000);
    const s = Math.floor(diff%60000/1000);
    cdEl.innerHTML = `
      <div class="cd"><span class="num">${String(d).padStart(2,'0')}</span><span class="lbl">dias</span></div>
      <div class="cd"><span class="num">${String(h).padStart(2,'0')}</span><span class="lbl">horas</span></div>
      <div class="cd"><span class="num">${String(mi).padStart(2,'0')}</span><span class="lbl">min</span></div>
      <div class="cd"><span class="num">${String(s).padStart(2,'0')}</span><span class="lbl">seg</span></div>`;
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

/* ---------- Tabela completa ---------- */
function renderTabela(){
  const stageSel = document.getElementById('filter-stage');
  const teamSel = document.getElementById('filter-team');

  const stages = [...new Set(DATA.matches.map(m=>m.stage))];
  stageSel.innerHTML = `<option value="">Todas as fases/grupos</option>` +
    stages.map(s=>`<option value="${s}">${s}</option>`).join('');

  const teams = [...new Set(DATA.matches.flatMap(m=>[m.team1,m.team2]))].sort((a,b)=>a.localeCompare(b,'pt'));
  teamSel.innerHTML = `<option value="">Todas as seleções</option>` +
    teams.map(t=>`<option value="${t}">${t}</option>`).join('');

  function apply(){
    const stage = stageSel.value;
    const team = teamSel.value;
    const q = normalize(document.getElementById('filter-search').value);
    const filtered = DATA.matches.filter(m=>{
      if(stage && m.stage!==stage) return false;
      if(team && m.team1!==team && m.team2!==team) return false;
      if(q && !(normalize(m.stadium_real)+normalize(m.city)+normalize(m.stadium)).includes(q)) return false;
      return true;
    });
    document.getElementById('count-tabela').textContent = filtered.length;
    document.getElementById('list-tabela').innerHTML = filtered.map(ticketHTML).join('');
  }
  stageSel.onchange = apply;
  teamSel.onchange = apply;
  document.getElementById('filter-search').oninput = apply;
  apply();
}

/* ---------- Grupos ---------- */
function renderGroups(){
  const grid = document.getElementById('group-grid');
  grid.innerHTML = Object.entries(DATA.groups).map(([letter, teams])=>{
    const standings = LIVE.standings ? LIVE.standings[letter] : null;
    const rows = (standings || teams.map(t=>({team:t.team, flag:t.flag, p:'-', v:'-', e:'-', d:'-', gp:'-', gc:'-', sg:'-', pts:'-'})))
      .map(r=>`<tr>
        <td class="team-cell">${r.flag||''} ${r.team}</td>
        <td>${r.p}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td>
        <td>${r.gp}</td><td>${r.gc}</td><td>${r.sg}</td><td><strong>${r.pts}</strong></td>
      </tr>`).join('');
    return `<div class="group-card">
      <h3><span class="letter">${letter}</span> Grupo ${letter}</h3>
      <table class="standings-table">
        <thead><tr><th style="text-align:left">Seleção</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>Pts</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');
}

/* ---------- Onde assistir ---------- */
function renderChannels(){
  document.getElementById('channel-grid').innerHTML = CHANNELS.map(c=>`
    <div class="channel-card">
      <p class="ch-name display">${c.name}</p>
      <p>${c.desc}</p>
    </div>`).join('');
}

/* ---------- Artilheiros ---------- */
function renderTopscorers(){
  const el = document.getElementById('topscorers-content');
  if(LIVE.topscorers && LIVE.topscorers.length){
    el.innerHTML = `<table class="topscorers-table">
      <thead><tr><th class="num-col">#</th><th>Jogador</th><th>Seleção</th><th class="num-col">Gols</th><th class="num-col">Assist.</th></tr></thead>
      <tbody>${LIVE.topscorers.map((p,i)=>`<tr>
        <td class="num-col">${i+1}</td><td>${p.player?.name||p.name}</td><td>${p.team||p.statistics?.[0]?.team?.name||''}</td>
        <td class="num-col">${p.goals ?? p.statistics?.[0]?.goals?.total ?? '-'}</td>
        <td class="num-col">${p.assists ?? p.statistics?.[0]?.goals?.assists ?? '-'}</td>
      </tr>`).join('')}</tbody>
    </table>`;
    return;
  }
  el.innerHTML = `<div class="empty-state">
    <div class="display">Artilheiros ainda não disponíveis</div>
    <p>Esses dados aparecem aqui automaticamente assim que a chave de API de dados em tempo real estiver configurada e os primeiros gols da Copa forem registrados.</p>
    <p>Sem a API configurada, peça a atualização manual a qualquer momento.</p>
  </div>`;
}

/* ---------- Tabs ---------- */
function setupTabs(){
  document.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected','false'));
      tab.setAttribute('aria-selected','true');
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
      document.getElementById('panel-'+tab.dataset.panel).classList.add('active');
    });
  });
}

/* ---------- Clock ---------- */
function startClock(){
  function tick(){
    const now = new Date();
    document.getElementById('clock-time').textContent =
      new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(now);
    document.getElementById('clock-date').textContent =
      new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(now);
  }
  tick();
  setInterval(tick, 1000);
}

/* ---------- Live data fetch ---------- */
async function loadLiveData(){
  try{
    const res = await fetch('/api/live?type=all');
    if(!res.ok) throw new Error('api error');
    const json = await res.json();
    LIVE.configured = json.configured;
    LIVE.fixtures = json.fixtures || null;
    LIVE.standings = json.standings || null;
    LIVE.topscorers = json.topscorers || null;
  }catch(e){
    LIVE.configured = false;
  }
  const status = document.getElementById('data-status');
  if(LIVE.configured===false){
    status.innerHTML = 'Placares, classificação e artilheiros em tempo real: <strong>não configurados</strong>. ' +
      '<a href="https://github.com" target="_blank" rel="noopener">Veja o README do projeto</a> para ativar com uma API de futebol.';
  } else if(LIVE.configured===true){
    status.textContent = `Dados em tempo real atualizados em ${new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} (horário de Brasília).`;
  }
  // re-render with whatever live data we have
  renderHomeLists();
  renderTabela();
  renderGroups();
  renderTopscorers();
}

/* ---------- Init ---------- */
async function init(){
  setupTabs();
  startClock();
  renderChannels();
  try{
    const res = await fetch('/data/matches.json');
    DATA = await res.json();
  }catch(e){
    document.getElementById('list-hoje').innerHTML = '<div class="empty-state"><div class="display">Erro ao carregar dados</div></div>';
    return;
  }
  renderHomeLists();
  renderTabela();
  renderGroups();
  renderTopscorers();
  loadLiveData();
}

document.addEventListener('DOMContentLoaded', init);
