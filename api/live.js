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
 * Plano gratuito da API-Football: 100 requisições/dia. Este endpoint usa
 * cache de borda (Cache-Control) de 30 min, então o consumo real fica bem
 * abaixo do limite mesmo com muitos visitantes.
 *
 * League ID 1 = FIFA World Cup (API-Football). Season = 2026.
 */

const BASE_URL = "https://v3.football.api-sports.io";
const LEAGUE_ID = 1;
const SEASON = 2026;

async function apiGet(path, key) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-apisports-key": key },
  });
  if (!res.ok) throw new Error(`API-Football error ${res.status} on ${path}`);
  const json = await res.json();
  return json.response;
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
      flag: "",
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
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    res.status(200).json({ configured: false });
    return;
  }

  const type = (req.query?.type || "all").toString();
  const out = { configured: true };

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
