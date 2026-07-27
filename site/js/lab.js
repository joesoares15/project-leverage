import { CONFIG } from "./config.js";
import { byId, escapeHtml, formatDate, formatPercent } from "./utils.js";

let labPayload = null;

function scoringLabel(mode) {
  if (mode === "ppr") return "Full PPR";
  if (mode === "standard") return "Standard";
  return "Half PPR";
}

function renderLab(result, window, scoring, rbRange, wrRange, metadata = {}) {
  byId("labResults").classList.remove("hidden");
  const lift = result.RB.combined.hit - result.RB.neither.hit;

  byId("labMetrics").innerHTML = [
    ["RB24+ player-week rate", formatPercent(result.RB.hitRate)],
    ["RBs with ≥1 RB24+ week", formatPercent(result.RB.playerHitRate)],
    ["Avg RB24+ weeks / player-season", result.RB.avgUsableWeeks.toFixed(2)],
    ["Combined-signal lift", `${(100 * lift).toFixed(1)} pts`],
  ]
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(
          value,
        )}</b></div>`,
    )
    .join("");

  byId("labOutcomeTable").innerHTML = `
    <div class="rank-row"><b>RB</b><span>Prior-year RB${escapeHtml(
      rbRange,
    )}; RB24+ outcome</span><span>${formatPercent(
      result.RB.hitRate,
    )}</span><span class="hide-mobile">${result.RB.observations} weeks</span></div>
    <div class="rank-row"><b>WR</b><span>Prior-year WR${escapeHtml(
      wrRange,
    )}; WR36+ outcome</span><span>${formatPercent(
      result.WR.hitRate,
    )}</span><span class="hide-mobile">${result.WR.observations} weeks</span></div>`;

  const signalRows = [
    ["Recent workload", result.RB.workload],
    ["Role-weighted teammate injury", result.RB.injury],
    ["Recent receiving involvement", result.RB.receiving],
    ["Any opportunity signal", result.RB.combined],
    ["No opportunity signal", result.RB.neither],
    ["Opportunity Delta ≥50", result.RB.highDelta],
    ["Opportunity Delta <50", result.RB.lowDelta],
  ];
  byId("labSignalTable").innerHTML = signalRows
    .map(
      ([name, signal]) => `<div class="rank-row"><b>${signal.n}</b><span>${escapeHtml(
        name,
      )}</span><span>${formatPercent(
        signal.hit,
      )}</span><span class="hide-mobile">RB24+ rate</span></div>`,
    )
    .join("");

  const examples = result.examples || [];
  byId("labExamples").innerHTML = examples.length
    ? examples
        .map(
          (example) => `<div class="trade"><strong>${example.season} W${
            example.week
          }: ${escapeHtml(example.name)} (${escapeHtml(
            example.team,
          )}) · Opportunity Delta ${example.opportunityDelta}</strong><div>Outcome: RB${
            example.weekRank
          }, ${example.fp.toFixed(1)} ${scoringLabel(
            scoring,
          )} points</div><p>Trailing-three-week carries + targets: ${example.avg3.toFixed(
            1,
          )} · estimated vacated backfield opportunity: ${example.vacated.toFixed(1)}${
            example.injuryNames?.length
              ? ` · affected teammates: ${example.injuryNames.map(escapeHtml).join(", ")}`
              : ""
          }</p></div>`,
        )
        .join("")
    : "<p>No qualifying injury-driven examples in this configuration.</p>";

  const direction = lift > 0 ? "higher" : "lower";
  byId("labInterpretation").innerHTML = `<p>In this descriptive sample, weeks with at least one pre-kickoff opportunity signal had an RB24+ rate <b>${Math.abs(
    100 * lift,
  ).toFixed(1)} percentage points ${direction}</b> than weeks with none.</p><p>This is not yet proof that the score predicts future weeks. The next research step is season-based holdout testing and calibration, without changing thresholds after seeing holdout results.</p>`;

  const assumptions = (metadata.assumptions || [])
    .map((assumption) => `<li>${escapeHtml(assumption)}</li>`)
    .join("");
  byId("labMethod").innerHTML = `<p><b>Study:</b> PL-001. <b>Window:</b> ${escapeHtml(
    window,
  )}. <b>Scoring:</b> ${scoringLabel(
    scoring,
  )}. <b>Cohorts:</b> prior-season RB${escapeHtml(
    rbRange,
  )} and WR${escapeHtml(
    wrRange,
  )}. <b>Outcomes:</b> RB24+ and WR36+ weekly finishes.</p><p><b>Pre-kickoff features:</b> recent workload, workload acceleration, receiving involvement, teammate practice/game status, and role-weighted estimated vacated opportunity.</p><p><b>Build:</b> ${formatDate(
    metadata.built_at,
  )}. Source: ${escapeHtml(metadata.source || "nflverse")}. Methodology ${escapeHtml(
    metadata.methodology_version || "unknown",
  )}. Injury seasons: ${escapeHtml(
    (metadata.injury_seasons || []).join(", ") || "none",
  )}.</p><p><b>Explicit assumptions:</b></p><ul>${assumptions}</ul>`;
}

export async function runLab() {
  const button = byId("runLabBtn");
  button.disabled = true;
  try {
    byId("labStatus").textContent = "Loading the bundled PL-001 research dataset…";
    if (!labPayload) {
      const response = await fetch(CONFIG.labDataPath, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(
          `Bundled research data is not available (${response.status}). Run the GitHub Actions deployment workflow.`,
        );
      }
      labPayload = await response.json();
    }

    const window = byId("labSeasons").value;
    const scoring = byId("labScoring").value;
    const rbRange = byId("labRbRange").value;
    const wrRange = byId("labWrRange").value;
    const key = `${window}|${scoring}|${rbRange}|${wrRange}`;
    const result = labPayload.studies?.[key];
    if (!result) throw new Error(`This build does not contain study configuration ${key}.`);

    renderLab(result, window, scoring, rbRange, wrRange, labPayload.metadata || {});
    byId("labStatus").textContent = `PL-001 loaded: ${
      result.RB.observations + result.WR.observations
    } player-week observations · ${window} · ${scoringLabel(scoring)}. Built ${formatDate(
      labPayload.metadata?.built_at,
    )}.`;
  } catch (error) {
    console.error(error);
    byId("labStatus").textContent = `Study could not run: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}
