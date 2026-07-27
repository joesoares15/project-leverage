import { byId, escapeHtml } from "../utils.js";

export function renderPortfolioSummary(summary) {
  if (!summary.leagueCount) return;
  byId("portfolioSection").classList.remove("hidden");
  const topExposure = summary.playerExposure.slice(0, 12);
  byId("portfolioMetrics").innerHTML = [
    ["Leagues", summary.leagueCount],
    ["Rostered player slots", summary.totalRosteredPlayers],
    ["Unique players", summary.playerExposure.length],
    ["Highest exposure", topExposure[0] ? `${topExposure[0].count}/${summary.leagueCount}` : "—"],
  ]
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(
          value,
        )}</b></div>`,
    )
    .join("");

  byId("playerExposure").innerHTML = topExposure
    .map(
      (item) => `<div class="rank-row"><b>${item.count}</b><span>${escapeHtml(
        item.player.name,
      )}</span><span>${Math.round((item.count / summary.leagueCount) * 100)}%</span><span class="hide-mobile">${escapeHtml(
        item.leagues.join(", "),
      )}</span></div>`,
    )
    .join("");
}
