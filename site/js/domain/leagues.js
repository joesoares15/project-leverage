const NON_STARTER_SLOTS = new Set(["BN", "TAXI", "IR"]);

export function lineupSlots(league) {
  return (league.roster_positions || []).filter(
    (slot) => !NON_STARTER_SLOTS.has(slot),
  );
}

export function isSuperflex(league) {
  const slots = lineupSlots(league);
  return slots.includes("SUPER_FLEX") || slots.filter((slot) => slot === "QB").length > 1;
}

export function draftPickValue(year, round, superflex, currentYear = new Date().getFullYear()) {
  const discount = Math.pow(0.82, Math.max(0, Number(year) - currentYear));
  const base = round === 1 ? (superflex ? 4300 : 3700) : round === 2 ? 1500 : round === 3 ? 650 : 250;
  return base * discount;
}

function estimatePickCapital(bundle, rosterId, superflex) {
  const currentYear = new Date().getFullYear();
  const rounds = Math.min(4, bundle.league.settings?.draft_rounds || 4);
  let value = 0;

  for (let year = currentYear; year <= currentYear + 2; year += 1) {
    for (let round = 1; round <= rounds; round += 1) {
      value += draftPickValue(year, round, superflex, currentYear);
    }
  }

  for (const tradedPick of bundle.tradedPicks || []) {
    const pickValue = draftPickValue(
      tradedPick.season,
      tradedPick.round,
      superflex,
      currentYear,
    );
    if (tradedPick.owner_id === rosterId) value += pickValue;
    if (tradedPick.roster_id === rosterId && tradedPick.owner_id !== rosterId) value -= pickValue;
  }
  return Math.max(0, value);
}

function buildTradeIdeas(teams, myTeam) {
  if (!myTeam) return [];
  const ideas = [];
  const positionalNeeds = Object.entries(myTeam.positionValues)
    .sort(([, first], [, second]) => first - second)
    .map(([position]) => position);

  for (const opponent of teams.filter((team) => !team.isMine)) {
    for (const target of opponent.players.slice(0, 12)) {
      if (!positionalNeeds.slice(0, 2).includes(target.position) && ideas.length > 6) continue;

      const oneForOne = myTeam.players
        .filter((player) => player.id !== target.id && player.value > 0)
        .sort(
          (first, second) =>
            Math.abs(first.value - target.value) - Math.abs(second.value - target.value),
        )
        .find(
          (player) =>
            player.value >= target.value * 0.82 && player.value <= target.value * 1.18,
        );

      if (oneForOne) {
        ideas.push({
          opponent: opponent.name,
          receive: [target],
          send: [oneForOne],
          valueDifference: oneForOne.value - target.value,
          reason: `Targets your ${target.position} need with a similarly valued asset.`,
        });
        continue;
      }

      const pool = myTeam.players
        .filter((player) => player.value > 400 && player.value < target.value * 0.9)
        .slice(0, 18);

      let foundPackage = false;
      for (let first = 0; first < pool.length && !foundPackage; first += 1) {
        for (let second = first + 1; second < pool.length; second += 1) {
          const packageValue = pool[first].value + pool[second].value;
          if (packageValue >= target.value * 0.88 && packageValue <= target.value * 1.18) {
            ideas.push({
              opponent: opponent.name,
              receive: [target],
              send: [pool[first], pool[second]],
              valueDifference: packageValue - target.value,
              reason: "Aggressive consolidation: turn depth into the best player in the deal.",
            });
            foundPackage = true;
            break;
          }
        }
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const idea of ideas.sort(
    (first, second) => Math.abs(first.valueDifference) - Math.abs(second.valueDifference),
  )) {
    const key = `${idea.opponent}:${idea.receive[0].id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(idea);
    if (unique.length === 8) break;
  }
  return unique;
}

export function analyzeLeague(bundle, userId, resolvePlayer) {
  const superflex = isSuperflex(bundle.league);
  const slots = lineupSlots(bundle.league);
  const owners = new Map(bundle.users.map((user) => [user.user_id, user]));

  const teams = bundle.rosters.map((roster) => {
    const players = (roster.players || [])
      .map((playerId) => resolvePlayer(playerId, superflex))
      .sort((first, second) => second.value - first.value);
    const coreCount = Math.max(8, slots.length);
    const depthEnd = Math.max(16, slots.length + 8);
    const positionValues = { QB: 0, RB: 0, WR: 0, TE: 0 };

    for (const player of players) {
      if (positionValues[player.position] !== undefined) {
        positionValues[player.position] += player.value;
      }
    }

    return {
      rosterId: roster.roster_id,
      ownerId: roster.owner_id,
      name: owners.get(roster.owner_id)?.display_name || `Team ${roster.roster_id}`,
      isMine: roster.owner_id === userId,
      players,
      coreValue: players.slice(0, coreCount).reduce((sum, player) => sum + player.value, 0),
      depthValue: players
        .slice(coreCount, depthEnd)
        .reduce((sum, player) => sum + player.value, 0),
      pickValue: estimatePickCapital(bundle, roster.roster_id, superflex),
      positionValues,
      record: (roster.settings?.wins || 0) + (roster.settings?.ties || 0) * 0.5,
      points:
        (roster.settings?.fpts || 0) + (roster.settings?.fpts_decimal || 0) / 100,
    };
  });

  const maxCore = Math.max(...teams.map((team) => team.coreValue), 1);
  const maxDepth = Math.max(...teams.map((team) => team.depthValue), 1);
  for (const team of teams) {
    team.assessmentScore =
      100 *
      (0.62 * (team.coreValue / maxCore) +
        0.2 * (team.depthValue / maxDepth) +
        0.1 * Math.min(1, team.pickValue / 18000) +
        0.08 * Math.min(1, team.record / 10));
  }

  teams.sort((first, second) => second.assessmentScore - first.assessmentScore);
  teams.forEach((team, index) => {
    team.rank = index + 1;
  });

  const myTeam = teams.find((team) => team.isMine);
  const status = !myTeam
    ? "Unknown"
    : myTeam.rank <= 2
      ? "Elite contender"
      : myTeam.rank <= Math.ceil(teams.length * 0.35)
        ? "Contender"
        : myTeam.rank <= Math.ceil(teams.length * 0.65)
          ? "Fringe / retool"
          : "Rebuild";

  return {
    ...bundle,
    teams,
    myTeam,
    superflex,
    slots,
    status,
    tradeIdeas: buildTradeIdeas(teams, myTeam),
  };
}
