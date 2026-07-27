import { byId, escapeHtml, formatInteger } from "../utils.js";

function statusClass(status) {
  if (status.startsWith("Elite")) return "elite";
  if (status === "Contender") return "contender";
  if (status.startsWith("Fringe")) return "fringe";
  return "retool";
}

function suggestedAction(league) {
  if (league.status === "Elite contender") return "Consolidate for stars";
  if (league.status === "Contender") return "Buy one impact starter";
  if (league.status.startsWith("Fringe")) return "Review roster architecture";
  return "Sell aging production";
}

export function updateProgress(percent, message) {
  byId("progressBar").style.width = `${percent}%`;
  byId("statusText").textContent = message;
}

export function renderLeagueFilter(leagues) {
  const filter = byId("leagueFilter");
  const current = filter.value;
  filter.innerHTML = [
    '<option value="all">All leagues</option>',
    ...leagues.map(
      (league) =>
        `<option value="${escapeHtml(league.league.league_id)}">${escapeHtml(
          league.league.name,
        )}</option>`,
    ),
  ].join("");
  filter.value = [...filter.options].some((option) => option.value === current)
    ? current
    : "all";
}

export function renderLeagueSummary(leagues, onSelectLeague) {
  const filter = byId("leagueFilter").value || "all";
  const visible = leagues.filter(
    (league) => filter === "all" || league.league.league_id === filter,
  );

  byId("summaryBody").innerHTML =
    visible
      .map((league) => {
        const myTeam = league.myTeam;
        return `<tr data-league-id="${escapeHtml(league.league.league_id)}">
          <td><b>${escapeHtml(league.league.name)}</b><div class="small">${
            league.superflex ? "Superflex" : "1QB"
          } · ${league.teams.length} teams</div></td>
          <td><span class="badge ${statusClass(league.status)}">${escapeHtml(
            league.status,
          )}</span></td>
          <td class="score">${myTeam?.rank || "—"}/${league.teams.length}</td>
          <td>${formatInteger(myTeam?.coreValue)}</td>
          <td>${formatInteger(myTeam?.depthValue)}</td>
          <td>${formatInteger(myTeam?.pickValue)}</td>
          <td>${suggestedAction(league)}</td>
        </tr>`;
      })
      .join("") || '<tr><td colspan="7" class="empty">No leagues found.</td></tr>';

  document.querySelectorAll("#summaryBody tr[data-league-id]").forEach((row) => {
    row.addEventListener("click", () => onSelectLeague(row.dataset.leagueId));
  });
}

export function renderLeagueDetail(league) {
  if (!league?.myTeam) return;
  const myTeam = league.myTeam;
  byId("detailSection").classList.remove("hidden");
  byId("detailTitle").textContent = league.league.name;
  byId("leagueCards").innerHTML = [
    ["Roster assessment", league.status],
    ["Power rank", `${myTeam.rank} of ${league.teams.length}`],
    ["Roster value", formatInteger(myTeam.coreValue + myTeam.depthValue)],
    ["Future picks", formatInteger(myTeam.pickValue)],
  ]
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(
          value,
        )}</b></div>`,
    )
    .join("");

  const groups = { QB: [], RB: [], WR: [], TE: [], OTHER: [] };
  for (const player of myTeam.players) {
    (groups[player.position] || groups.OTHER).push(player);
  }
  byId("myRoster").innerHTML = Object.entries(groups)
    .filter(([, players]) => players.length)
    .map(
      ([position, players]) => `<div class="position"><h4>${position}</h4>${players
        .slice(0, 12)
        .map(
          (player) => `<div class="player"><span>${escapeHtml(player.name)}<small> ${escapeHtml(
            player.team || "",
          )}${player.age ? ` · ${player.age}` : ""}</small></span><span>${formatInteger(
            player.value,
          )}</span></div>`,
        )
        .join("")}</div>`,
    )
    .join("");

  byId("tradeIdeas").innerHTML = league.tradeIdeas.length
    ? league.tradeIdeas
        .map(
          (idea, index) => `<div class="trade"><strong>${index + 1}. Send to ${escapeHtml(
            idea.opponent,
          )}</strong><div>You get: ${idea.receive
            .map((player) => escapeHtml(player.name))
            .join(" + ")}</div><div>You give: ${idea.send
            .map((player) => escapeHtml(player.name))
            .join(" + ")}</div><p>${escapeHtml(idea.reason)} Market difference: ${
            idea.valueDifference >= 0 ? "+" : ""
          }${formatInteger(idea.valueDifference)} from your side.</p></div>`,
        )
        .join("")
    : "<p>No clean value-matched offers found.</p>";

  byId("powerRankings").innerHTML = league.teams
    .map(
      (team) => `<div class="rank-row"><b>${team.rank}</b><span>${escapeHtml(
        team.name,
      )}${team.isMine ? " (you)" : ""}</span><span>${Math.round(
        team.assessmentScore,
      )}</span><span class="hide-mobile">${formatInteger(
        team.coreValue + team.depthValue,
      )}</span></div>`,
    )
    .join("");

  byId("detailSection").scrollIntoView({ behavior: "smooth" });
}
