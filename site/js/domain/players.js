import { normalizeName } from "../utils.js";

export function createPlayerResolver(playerDirectory, marketValues) {
  return function resolvePlayer(playerId, superflex) {
    const sleeperPlayer = playerDirectory[playerId] || {};
    const candidateNames = [
      sleeperPlayer.full_name,
      `${sleeperPlayer.first_name || ""} ${sleeperPlayer.last_name || ""}`.trim(),
    ];

    let market = null;
    for (const name of candidateNames) {
      market = marketValues.get(normalizeName(name));
      if (market) break;
    }

    return {
      id: playerId,
      name: sleeperPlayer.full_name || sleeperPlayer.last_name || playerId,
      position: sleeperPlayer.position || market?.position || "?",
      age: sleeperPlayer.age || market?.age || null,
      value: superflex ? market?.superflex || 0 : market?.oneQb || 0,
      team: sleeperPlayer.team || market?.team || "",
    };
  };
}
