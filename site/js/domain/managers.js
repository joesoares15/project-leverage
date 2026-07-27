import { CONFIG } from "../config.js";
import {
  getDraftPicks,
  getLeague,
  getLeagueDrafts,
  getLeagueUsers,
} from "../services/sleeper.js";
import { isSuperflex } from "./leagues.js";

export async function loadLeagueChain(startLeague) {
  const chain = [];
  const seen = new Set();
  let current = startLeague;

  for (
    let index = 0;
    index < CONFIG.maxLeagueHistoryYears && current && !seen.has(current.league_id);
    index += 1
  ) {
    seen.add(current.league_id);
    chain.push(current);
    if (!current.previous_league_id) break;
    try {
      current = await getLeague(current.previous_league_id);
    } catch {
      break;
    }
  }
  return chain;
}

export async function loadDraftHistory(leagues, resolvePlayer) {
  const history = [];
  const seenDrafts = new Set();

  for (const current of leagues) {
    const chain = await loadLeagueChain(current.league);
    for (const league of chain) {
      let users;
      let drafts;
      try {
        [users, drafts] = await Promise.all([
          getLeagueUsers(league.league_id),
          getLeagueDrafts(league.league_id),
        ]);
      } catch {
        continue;
      }

      for (const draft of drafts || []) {
        if (seenDrafts.has(draft.draft_id) || draft.status !== "complete") continue;
        seenDrafts.add(draft.draft_id);

        let picks;
        try {
          picks = await getDraftPicks(draft.draft_id);
        } catch {
          continue;
        }

        const userNames = new Map(users.map((user) => [user.user_id, user.display_name]));
        const kind = (draft.settings?.rounds || 0) > 8 ? "startup" : "rookie";
        const superflex = isSuperflex(league);
        const rankedByCurrentMarket = [...picks]
          .map((pick) => ({ ...pick, player: resolvePlayer(pick.player_id, superflex) }))
          .sort((first, second) => second.player.value - first.player.value);
        const currentMarketRank = new Map(
          rankedByCurrentMarket.map((pick, index) => [pick.player_id, index + 1]),
        );

        history.push({
          draftId: draft.draft_id,
          leagueId: league.league_id,
          leagueName: league.name,
          season: Number(draft.season) || Number(league.season),
          kind,
          superflex,
          teams: league.total_rosters || draft.settings?.teams || 0,
          picks: picks.map((pick) => ({
            pickNumber: pick.pick_no,
            round: pick.round,
            rosterId: pick.roster_id,
            userId: pick.picked_by || null,
            manager:
              userNames.get(pick.picked_by) || pick.picked_by || `Roster ${pick.roster_id}`,
            player: resolvePlayer(pick.player_id, superflex),
            currentMarketRankProxy: currentMarketRank.get(pick.player_id) || null,
          })),
        });
      }
    }
  }
  return history;
}

function emptyPositionCounts() {
  return { QB: 0, RB: 0, WR: 0, TE: 0, OTHER: 0 };
}

export function buildManagerProfiles(history, leagues) {
  const currentSharedUsers = new Map();
  for (const league of leagues) {
    for (const user of league.users || []) {
      if (!user?.user_id) continue;
      if (!currentSharedUsers.has(user.user_id)) {
        currentSharedUsers.set(user.user_id, {
          name: user.display_name || user.user_id,
          leagues: new Set(),
        });
      }
      currentSharedUsers.get(user.user_id).leagues.add(league.league.name);
    }
  }

  const managers = new Map();
  for (const draft of history) {
    for (const pick of draft.picks) {
      if (!pick.userId || !currentSharedUsers.has(pick.userId)) continue;
      if (!managers.has(pick.userId)) {
        managers.set(pick.userId, {
          id: pick.userId,
          name: currentSharedUsers.get(pick.userId).name || pick.manager,
          picks: [],
          historicalLeagues: new Set(),
          drafts: new Set(),
          currentLeagues: new Set(currentSharedUsers.get(pick.userId).leagues),
        });
      }
      const manager = managers.get(pick.userId);
      manager.picks.push({
        ...pick,
        kind: draft.kind,
        season: draft.season,
        leagueName: draft.leagueName,
        teams: draft.teams,
      });
      manager.historicalLeagues.add(draft.leagueName);
      manager.drafts.add(draft.draftId);
    }
  }

  const profiles = [];
  for (const manager of managers.values()) {
    const counts = emptyPositionCounts();
    const rookieCounts = emptyPositionCounts();
    const startupCounts = emptyPositionCounts();
    const earlyCounts = { QB: 0, RB: 0, WR: 0 };
    let hindsightDifference = 0;
    let hindsightCount = 0;

    for (const pick of manager.picks) {
      const position = counts[pick.player.position] !== undefined ? pick.player.position : "OTHER";
      counts[position] += 1;
      (pick.kind === "startup" ? startupCounts : rookieCounts)[position] += 1;
      if (pick.currentMarketRankProxy) {
        hindsightDifference += pick.currentMarketRankProxy - pick.pickNumber;
        hindsightCount += 1;
      }
      if (pick.pickNumber <= Math.max(12, pick.teams) && earlyCounts[position] !== undefined) {
        earlyCounts[position] += 1;
      }
    }

    const totalPicks = manager.picks.length || 1;
    const [mostDraftedPosition, mostDraftedCount] = Object.entries(counts).sort(
      ([, first], [, second]) => second - first,
    )[0];
    const [earlyPosition, earlyCount] = Object.entries(earlyCounts).sort(
      ([, first], [, second]) => second - first,
    )[0];

    let tendency = `Drafts ${mostDraftedPosition} most often (${Math.round(
      (mostDraftedCount / totalPicks) * 100,
    )}% of selections).`;
    if (earlyCount > 0) tendency += ` Early-round lean: ${earlyPosition}.`;

    profiles.push({
      id: manager.id,
      name: manager.name,
      pickCount: manager.picks.length,
      draftCount: manager.drafts.size,
      leagueCount: manager.currentLeagues.size,
      historicalLeagueCount: manager.historicalLeagues.size,
      counts,
      rookieCounts,
      startupCounts,
      hindsightDifference: hindsightCount ? hindsightDifference / hindsightCount : null,
      confidence:
        manager.picks.length >= 40 ? "High" : manager.picks.length >= 15 ? "Medium" : "Low",
      sampleLabel:
        manager.historicalLeagues.size > 1 ? "Cross-league sample" : "Single-league sample",
      tendency,
      leagues: [...manager.currentLeagues].sort(),
      historicalLeagues: [...manager.historicalLeagues].sort(),
    });
  }

  return profiles.sort((first, second) => second.pickCount - first.pickCount);
}
