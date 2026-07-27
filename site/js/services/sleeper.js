import { CONFIG } from "../config.js";
import { getJson } from "./http.js";

const endpoint = (path) => `${CONFIG.sleeperApi}${path}`;

export const getSleeperUser = (username) =>
  getJson(endpoint(`/user/${encodeURIComponent(username)}`));

export const getPlayerDirectory = () => getJson(endpoint("/players/nfl"));

export async function getLeagueBundle(leagueId) {
  const [league, users, rosters, tradedPicks] = await Promise.all([
    getJson(endpoint(`/league/${leagueId}`)),
    getJson(endpoint(`/league/${leagueId}/users`)),
    getJson(endpoint(`/league/${leagueId}/rosters`)),
    getJson(endpoint(`/league/${leagueId}/traded_picks`)),
  ]);
  return { league, users, rosters, tradedPicks };
}

export const getLeague = (leagueId) => getJson(endpoint(`/league/${leagueId}`));
export const getLeagueUsers = (leagueId) =>
  getJson(endpoint(`/league/${leagueId}/users`));
export const getLeagueDrafts = (leagueId) =>
  getJson(endpoint(`/league/${leagueId}/drafts`));
export const getDraftPicks = (draftId) => getJson(endpoint(`/draft/${draftId}/picks`));
