import { CONFIG } from "./config.js";
import { state } from "./state.js";
import { downloadJson, byId } from "./utils.js";
import { loadMarketValues } from "./services/market-values.js";
import {
  getLeagueBundle,
  getPlayerDirectory,
  getSleeperUser,
} from "./services/sleeper.js";
import { createPlayerResolver } from "./domain/players.js";
import { analyzeLeague } from "./domain/leagues.js";
import { buildManagerProfiles, loadDraftHistory } from "./domain/managers.js";
import { buildPortfolioSummary } from "./domain/portfolio.js";
import {
  renderLeagueDetail,
  renderLeagueFilter,
  renderLeagueSummary,
  updateProgress,
} from "./ui/dashboard.js";
import { renderManagerProfiles } from "./ui/managers.js";
import { renderPortfolioSummary } from "./ui/portfolio.js";
import { runLab } from "./lab.js";

function renderAll() {
  renderLeagueFilter(state.leagues);
  renderLeagueSummary(state.leagues, showLeague);
  renderManagerProfiles(state.managerProfiles);
  renderPortfolioSummary(buildPortfolioSummary(state.leagues));
}

function showLeague(leagueId) {
  renderLeagueDetail(
    state.leagues.find((league) => league.league.league_id === leagueId),
  );
}

function saveCache() {
  localStorage.setItem(
    CONFIG.cacheKey,
    JSON.stringify({
      saved: Date.now(),
      leagues: state.leagues,
      valueDate: state.valueDate,
      managerProfiles: state.managerProfiles,
      draftHistory: state.draftHistory,
    }),
  );
}

function restoreCache() {
  const cached = localStorage.getItem(CONFIG.cacheKey);
  if (!cached) return;
  try {
    const parsed = JSON.parse(cached);
    state.leagues = parsed.leagues || [];
    state.valueDate = parsed.valueDate || null;
    state.managerProfiles = parsed.managerProfiles || [];
    state.draftHistory = parsed.draftHistory || [];
    if (state.leagues.length) {
      renderAll();
      byId("statusText").textContent = "Showing your most recent saved refresh.";
      byId("lastUpdated").textContent = `Saved ${new Date(parsed.saved).toLocaleString()}`;
    }
  } catch (error) {
    console.warn("Ignoring invalid cached data", error);
    localStorage.removeItem(CONFIG.cacheKey);
  }
}

async function refreshAll() {
  const refreshButton = byId("refreshBtn");
  refreshButton.disabled = true;
  try {
    updateProgress(4, "Loading current dynasty market values…");
    const market = await loadMarketValues();
    state.values = market.values;
    state.valueDate = market.valueDate;

    updateProgress(10, "Loading Sleeper player directory…");
    state.players = await getPlayerDirectory();
    const user = await getSleeperUser(CONFIG.username);
    state.userId = user.user_id;
    const resolvePlayer = createPlayerResolver(state.players, state.values);

    state.leagues = [];
    for (let index = 0; index < CONFIG.leagueIds.length; index += 1) {
      updateProgress(
        15 + Math.round((index / CONFIG.leagueIds.length) * 75),
        `Importing league ${index + 1} of ${CONFIG.leagueIds.length}…`,
      );
      const bundle = await getLeagueBundle(CONFIG.leagueIds[index]);
      state.leagues.push(analyzeLeague(bundle, state.userId, resolvePlayer));
    }

    updateProgress(91, "Analyzing historical drafts and manager tendencies…");
    state.draftHistory = await loadDraftHistory(state.leagues, resolvePlayer);
    state.managerProfiles = buildManagerProfiles(state.draftHistory, state.leagues);
    saveCache();
    renderAll();

    updateProgress(100, "Refresh complete.");
    byId("lastUpdated").textContent = `Updated ${new Date().toLocaleString()} · values ${
      state.valueDate || "current"
    }`;
  } catch (error) {
    console.error(error);
    updateProgress(0, `Refresh failed: ${error.message}`);
  } finally {
    refreshButton.disabled = false;
  }
}

function exportData() {
  downloadJson(
    {
      exportedAt: new Date().toISOString(),
      username: CONFIG.username,
      leagues: state.leagues,
      managerProfiles: state.managerProfiles,
      draftHistory: state.draftHistory,
    },
    "joesoares-project-leverage.json",
  );
}

function registerEvents() {
  byId("refreshBtn").addEventListener("click", refreshAll);
  byId("exportBtn").addEventListener("click", exportData);
  byId("leagueFilter").addEventListener("change", () =>
    renderLeagueSummary(state.leagues, showLeague),
  );
  byId("runLabBtn").addEventListener("click", runLab);
}

registerEvents();
restoreCache();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((error) =>
    console.warn("Service worker registration failed", error),
  );
}
