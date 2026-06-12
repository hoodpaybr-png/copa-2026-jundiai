/**
 * /api/live
 * Busca dados em tempo real da Copa do Mundo 2026 via API-Football (api-sports.io).
 *
 * Configuração necessária na Vercel (Project Settings > Environment Variables):
 *   API_FOOTBALL_KEY = <sua chave da api-sports.io>
 *
 * Sem a chave configurada, retorna { configured: false } e o site usa apenas
 * os dados estáticos (tabela, grupos, onde assistir).
 *
 * CACHE DINÂMICO (plano gratuito = 100 req/dia):
 *  - Fora de horário de jogo: cache de 30 min (s-maxage=1800)
 *  - Durante uma partida (10 min antes do horário até 150 min depois): cache de 5 min
 *
 * Para se aproximar do "tempo real" tipo 365Scores (atualização a cada 30-60s),
 * é necessário um plano pago da API-Football (ex: plano "Ultra", ~7.500 req/dia).
 * Nesse caso, basta reduzir os valores de s-maxage abaixo (ex: 60 / 300).
 *
 * League ID 1 = FIFA World Cup (API-Football). Season = 2026.
 */

const BASE_URL = "https://v3.football.api-sports.io";
const LEAGUE_ID = 1;
const SEASON = 2026;

// Janela de "jogo ao vivo": do início até 150 min depois (tempo + intervalo + acréscimos)
const LIVE_WINDOW_MS = 150 * 60 * 1000;
const PRE_WINDOW_MS = 10 * 60 * 1000; // considera "ao vivo" 10min antes do horário oficial

const matchesData = require("../data/matches.json");

function isLiveWindowNow() {
  const now = Date.now();
  return matchesData.matches.some((m) => {
    const kickoffUTC = new Date(`${m.date}T${m.time}:00-03:00`).getTime();
    return now >= kickoffUTC - PRE_WINDOW_MS && now <= kickoffUTC + LIVE_WINDOW_MS;
  });
}

async function apiGet(path, key) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-apisports-key": key },
  });
  if (!res.ok) throw new Error(`API-Football error ${res.status} on ${path}`);
  const json = await res.json();
  return json.response;
}

const ISO_BY_NAME = {
  "mexico":"mx","south africa":"za","south korea":"kr","korea republic":"kr","czech republic":"cz","czechia":"cz",
  "canada":"ca","qatar":"qa","switzerland":"ch","bosnia and herzegovina":"ba","bosnia & herzegovina":"ba",
  "brazil":"br","morocco":"ma","haiti":"ht","scotland":"gb-sct",
  "usa":"us","united states":"us","paraguay":"py","australia":"au","turkey":"tr","türkiye":"tr",
  "germany":"de","curacao":"cw","curaçao":"cw","ivory coast":"ci","côte d'ivoire":"ci","cote d'ivoire":"ci","ecuador":"ec",
  "netherlands":"nl","japan":"jp","tunisia":"tn","sweden":"se",
  "belgium":"be","egypt":"eg","iran":"ir","new zealand":"nz",
  "spain":"es","cape verde":"cv","saudi arabia":"sa","uruguay":"uy",
  "france":"fr","senegal":"sn","norway":"no","iraq":"iq",
  "argentina":"ar","algeria":"dz","austria":"at","jordan":"jo",
  "portugal":"pt","uzbekistan":"uz","colombia":"co","dr congo":"cd","congo dr":"cd",
  "england":"gb-eng","croatia":"hr","ghana":"gh","panama":"pa",
};

function isoFor(name) {
  return ISO_BY_NAME[(name || "").toLowerCase().trim()] || "";
}

function mapStandings(raw) {
  // raw: array of arrays (one per group), each item has group "Group A", team{name}, etc.
  const out = {};
  if (!Array.isArray(raw)) return out;
  for (const group of raw) {
    if (!Array.isArray(group) || !group.length) continue;
    const groupName = group[0].group || "";
    const letter = groupName.trim().slice(-1).toUpperCase();
    out[letter] = group.map((t) => ({
      team: t.team?.name,
      flagCode: isoFor(t.team?.name),
      p: t.all?.played ?? "-",
      v: t.all?.win ?? "-",
      e: t.all?.draw ?? "-",
      d: t.all?.lose ?? "-",
      gp: t.all?.goals?.for ?? "-",
      gc: t.all?.goals?.against ?? "-",
      sg: t.goalsDiff ?? "-",
      pts: t.points ?? "-",
    }));
  }
  return out;
}

function mapTopscorers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 15).map((p) => ({
    name: p.player?.name,
    team: p.statistics?.[0]?.team?.name,
    goals: p.statistics?.[0]?.goals?.total ?? 0,
    assists: p.statistics?.[0]?.goals?.assists ?? 0,
  }));
}

module.exports = async (req, res) => {
  const live = isLiveWindowNow();
  // Fora de jogo: cache de 30 min. Durante janela de jogo: cache de 5 min
  // (mantém o consumo dentro do limite gratuito de 100 req/dia da API-Football).
  const cache = live
    ? "s-maxage=300, stale-while-revalidate=600"
    : "s-maxage=1800, stale-while-revalidate=3600";
  res.setHeader("Cache-Control", cache);
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    res.status(200).json({ configured: false });
    return;
  }

  const type = (req.query?.type || "all").toString();
  const out = { configured: true, liveWindow: live };

  try {
    if (type === "all" || type === "fixtures") {
      out.fixtures = await apiGet(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`, key);
    }
    if (type === "all" || type === "standings") {
      const standingsRaw = await apiGet(`/standings?league=${LEAGUE_ID}&season=${SEASON}`, key);
      out.standings = mapStandings(standingsRaw?.[0]?.league?.standings?.[0] ? standingsRaw[0].league.standings.flat() : standingsRaw?.[0]?.league?.standings);
      // Some API responses nest groups one level deeper; normalize defensively.
      if (Object.keys(out.standings || {}).length === 0 && standingsRaw?.[0]?.league?.standings) {
        out.standings = mapStandings(standingsRaw[0].league.standings);
      }
    }
    if (type === "all" || type === "topscorers") {
      const topRaw = await apiGet(`/players/topscorers?league=${LEAGUE_ID}&season=${SEASON}`, key);
      out.topscorers = mapTopscorers(topRaw);
    }
    res.status(200).json(out);
  } catch (err) {
    res.status(200).json({ configured: true, error: String(err) });
  }
};
