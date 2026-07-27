export function buildPortfolioSummary(leagues) {
  const exposure = new Map();
  let totalRosteredPlayers = 0;

  for (const league of leagues) {
    for (const player of league.myTeam?.players || []) {
      totalRosteredPlayers += 1;
      if (!exposure.has(player.id)) {
        exposure.set(player.id, {
          player,
          leagues: [],
          count: 0,
        });
      }
      const item = exposure.get(player.id);
      item.count += 1;
      item.leagues.push(league.league.name);
    }
  }

  return {
    leagueCount: leagues.length,
    totalRosteredPlayers,
    playerExposure: [...exposure.values()].sort(
      (first, second) => second.count - first.count || second.player.value - first.player.value,
    ),
  };
}
