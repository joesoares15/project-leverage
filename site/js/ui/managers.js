import { byId, escapeHtml } from "../utils.js";

function positionSummary(counts) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
  return ["QB", "RB", "WR", "TE"]
    .map((position) => `${position} ${Math.round(((counts[position] || 0) / total) * 100)}%`)
    .join(" · ");
}

function confidenceClass(confidence) {
  return confidence === "High" ? "elite" : confidence === "Medium" ? "contender" : "fringe";
}

export function renderManagerProfiles(profiles) {
  if (!profiles.length) return;
  byId("managerSection").classList.remove("hidden");
  byId("managerProfiles").innerHTML = profiles
    .map(
      (profile) => `<div class="manager-card">
        <div class="manager-head">
          <div><h4>${escapeHtml(profile.name)}</h4><div class="small">${
            profile.leagueCount
          } shared league${profile.leagueCount === 1 ? "" : "s"} · ${
            profile.draftCount
          } draft${profile.draftCount === 1 ? "" : "s"} · ${profile.pickCount} picks</div></div>
          <span class="badge ${confidenceClass(profile.confidence)}">${escapeHtml(
            profile.confidence,
          )} confidence</span>
        </div>
        <div class="manager-grid">
          <div class="manager-stat"><b>${positionSummary(
            profile.rookieCounts,
          )}</b><span>Rookie draft mix</span></div>
          <div class="manager-stat"><b>${positionSummary(
            profile.startupCounts,
          )}</b><span>Startup draft mix</span></div>
          <div class="manager-stat"><b>${profile.leagueCount}</b><span>Cross-league sample</span></div>
          <div class="manager-stat"><b>${
            profile.hindsightDifference === null
              ? "—"
              : `${profile.hindsightDifference > 0 ? "+" : ""}${profile.hindsightDifference.toFixed(
                  1,
                )}`
          }</b><span>Current-market hindsight delta*</span></div>
        </div>
        <div class="tendency">${escapeHtml(profile.tendency)} ${escapeHtml(
          profile.sampleLabel,
        )}.<br><small>*Not historical consensus ADP. This remains a provisional hindsight signal until historical ADP is connected.</small></div>
      </div>`,
    )
    .join("");
}
