/**
 * /api/live
 * Busca dados em tempo real da Copa do Mundo 2026 via football-data.org (API v4).
 *
 * Por que football-data.org?
 *  - O plano GRATUITO inclui a competição "FIFA World Cup" (code "WC") sem
 *    restrição de temporada (diferente da API-Football, cujo plano free só
 *    libera temporadas 2022-2024).
 *  - Limite gratuito: 10 requisições/minuto - dá folga para atualizar a
 *    cada 30-60s durante os jogos.
 *
 * Configuração necessária na Vercel (Project Settings > Environment Variables):
 *   FOOTBALL_DATA_TOKEN = <seu token gratuito de football-data.org>
 *
 * Sem o token configurado, retorna { configured: false } e o site usa apenas
 * os dados estáticos (tabela, grupos, onde assistir).
 *
 * CACHE DINÂMICO:
 *  - Fora de horário de jogo: cache de 10 min (s-maxage=600)
 *  - Durante uma partida (10 min antes do horário até 150 min depois):
 *    cache de 30s (s-maxage=30) - bem perto de "tempo real"
 */

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION = "WC";

const LIVE_WINDOW_MS = 150 * 60 * 1000;
const PRE_WINDOW_MS = 10 * 60 * 1000;

const matchesData = require("../data/matches.json");

function isLiveWindowNow() {
  const now = Date.now();
  return matchesData.matches.some((m) => {
    const kickoffUTC = new Date(`${m.date}T${m.time}:00-03:00`).getTime();
    return now >= kickoffUTC - PRE_WINDOW_MS && now <= kickoffUTC + LIVE_WINDOW_MS;
  });
}

async function apiGet(path, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": token },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: json.message || `HTTP ${res.status}`, status: res.status };
  }
  return { data: json };
}

const ISO_BY_NAME = {
  "mexico":"mx","south africa":"za","south korea":"kr","korea republic":"kr","czech republic":"cz","czechia":"cz",
  "canada":"ca","qatar":"qa","switzerland":"ch","bosnia and herzegovina":"ba","bosnia & herzegovina":"ba","bosnia-herzegovina":"ba",
  "brazil":"br","morocco":"ma","haiti":"ht","scotland":"gb-sct",
  "usa":"us","united states":"us","united states of america":"us","paraguay":"py","australia":"au","turkey":"tr","türkiye":"tr",
  "germany":"de","curacao":"cw","curaçao":"cw","ivory coast":"ci","côte d'ivoire":"ci","cote d'ivoire":"ci","ecuador":"ec",
  "netherlands":"nl","japan":"jp","tunisia":"tn","sweden":"se",
  "belgium":"be","egypt":"eg","iran":"ir","ir iran":"ir","new zealand":"nz",
  "spain":"es","cape verde":"cv","cabo verde":"cv","cape verde islands":"cv","saudi arabia":"sa","uruguay":"uy",
  "france":"fr","senegal":"sn","norway":"no","iraq":"iq",
  "argentina":"ar","algeria":"dz","austria":"at","jordan":"jo",
  "portugal":"pt","uzbekistan":"uz","colombia":"co","dr congo":"cd","congo dr":"cd","democratic republic of the congo":"cd",
  "england":"gb-eng","croatia":"hr","ghana":"gh","panama":"pa","czechia":"cz","czech republic":"cz",
};

function isoFor(name) {
  return ISO_BY_NAME[(name || "").toLowerCase().trim()] || "";
}

// Normaliza status do football-data.org para os códigos curtos que o front já espera
function mapStatus(status) {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
      return "LIVE";
    case "FINISHED":
    case "AWARDED":
      return "FT";
    case "POSTPONED":
    case "SUSPENDED":
    case "CANCELLED":
      return "PST";
    case "SCHEDULED":
    case "TIMED":
    default:
      return "NS";
  }
}

function mapFixtures(matches) {
  if (!Array.isArray(matches)) return [];
  return matches.map((m) => {
    const ft = m.score?.fullTime || {};
    return {
      teams: {
        home: { name: m.homeTeam?.name },
        away: { name: m.awayTeam?.name },
      },
      goals: {
        home: ft.home ?? null,
        away: ft.away ?? null,
      },
      fixture: {
        status: { short: mapStatus(m.status) },
        date: m.utcDate,
      },
    };
  });
}

function mapStandings(standingsArr) {
  const out = {};
  if (!Array.isArray(standingsArr)) return out;
  for (const grp of standingsArr) {
    const match = (grp.group || "").match(/([A-L])\s*$/i);
    const letter = match ? match[1].toUpperCase() : "";
    if (!letter) continue;
    out[letter] = (grp.table || []).map((t) => ({
      team: t.team?.name,
      flagCode: isoFor(t.team?.name),
      p: t.playedGames ?? "-",
      v: t.won ?? "-",
      e: t.draw ?? "-",
      d: t.lost ?? "-",
      gp: t.goalsFor ?? "-",
      gc: t.goalsAgainst ?? "-",
      sg: t.goalDifference ?? "-",
      pts: t.points ?? "-",
    }));
  }
  return out;
}

function mapTopscorers(scorers) {
  if (!Array.isArray(scorers)) return [];
  return scorers.slice(0, 15).map((s) => ({
    name: s.player?.name,
    team: s.team?.name,
    goals: s.goals ?? 0,
    assists: s.assists ?? 0,
  }));
}

module.exports = async (req, res) => {
  const live = isLiveWindowNow();
  const cache = live
    ? "s-maxage=30, stale-while-revalidate=60"
    : "s-maxage=600, stale-while-revalidate=1200";
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    res.setHeader("Cache-Control", cache);
    res.status(200).json({ configured: false });
    return;
  }

  const type = (req.query?.type || "all").toString();
  const out = { configured: true, liveWindow: live, debug: {} };

  try {
    if (type === "all" || type === "fixtures") {
      const r = await apiGet(`/competitions/${COMPETITION}/matches`, token);
      if (r.error) out.debug.fixtures_error = r.error;
      out.fixtures = mapFixtures(r.data?.matches);
    }
    if (type === "all" || type === "standings") {
      const r = await apiGet(`/competitions/${COMPETITION}/standings`, token);
      if (r.error) out.debug.standings_error = r.error;
      out.standings = mapStandings(r.data?.standings);
    }
    if (type === "all" || type === "topscorers") {
      const r = await apiGet(`/competitions/${COMPETITION}/scorers?limit=15`, token);
      if (r.error) out.debug.topscorers_error = r.error;
      out.topscorers = mapTopscorers(r.data?.scorers);
    }
    // Só aplica cache se NÃO houve nenhum erro - evita guardar erros temporários
    // (ex: rate limit) e repeti-los por minutos.
    const hasError = Object.keys(out.debug).length > 0;
    res.setHeader("Cache-Control", hasError ? "s-maxage=5, stale-while-revalidate=10" : cache);
    res.status(200).json(out);
  } catch (err) {
    res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");
    res.status(200).json({ configured: true, error: String(err) });
  }
};
