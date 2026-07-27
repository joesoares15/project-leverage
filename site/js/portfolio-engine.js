(function(global){
  "use strict";

  const DEFAULT_POSITIONS=["QB","RB","WR","TE"];

  function number(value){
    const n=Number(value);
    return Number.isFinite(n)?n:0;
  }

  function normalizeTeam(team){
    return team&&String(team).trim()?String(team).trim():"FA/Unknown";
  }

  function summarizeCounts(items,keyFn,valueFn=()=>1){
    const map=new Map();
    for(const item of items||[]){
      const key=keyFn(item);
      map.set(key,(map.get(key)||0)+number(valueFn(item)));
    }
    return [...map.entries()].map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value||String(a.key).localeCompare(String(b.key)));
  }

  function buildPickLedger({league,teams,tradedPicks,currentUserId,currentYear}){
    const myTeam=(teams||[]).find(team=>team.ownerId===currentUserId||team.isMe);
    if(!myTeam)return {picks:[],matrix:[],years:[],rounds:[],warnings:["Your roster could not be identified for draft-pick inventory."]};

    const settings=league?.settings||{};
    const startYear=Number(currentYear||league?.season||new Date().getFullYear());
    const horizon=Math.max(3,number(settings.draft_years)||0);
    const latestTradedYear=Math.max(0,...(tradedPicks||[]).map(pick=>number(pick.season)));
    const endYear=Math.max(startYear+horizon-1,latestTradedYear);
    const maxRound=Math.max(1,number(settings.draft_rounds)||4);
    const teamByRoster=new Map((teams||[]).map(team=>[number(team.rosterId),team]));
    const tradeByOriginal=new Map();

    for(const trade of tradedPicks||[]){
      const season=number(trade.season);
      const round=number(trade.round);
      const originalRoster=number(trade.roster_id);
      if(!season||!round||!originalRoster)continue;
      tradeByOriginal.set(`${season}:${round}:${originalRoster}`,number(trade.owner_id));
    }

    const picks=[];
    for(let season=startYear;season<=endYear;season++){
      for(let round=1;round<=maxRound;round++){
        for(const originalTeam of teams||[]){
          const originalRoster=number(originalTeam.rosterId);
          if(!originalRoster)continue;
          const currentOwner=tradeByOriginal.get(`${season}:${round}:${originalRoster}`)??originalRoster;
          if(currentOwner!==number(myTeam.rosterId))continue;
          picks.push({
            leagueId:String(league?.league_id||""),
            leagueName:league?.name||"Unknown league",
            season,
            round,
            originalRosterId:originalRoster,
            originalOwnerId:originalTeam.ownerId||null,
            originalOwnerName:originalTeam.name||`Roster ${originalRoster}`,
            isOriginal:originalRoster===number(myTeam.rosterId),
            label:`${season} Round ${round}`
          });
        }
      }
    }

    const years=Array.from({length:endYear-startYear+1},(_,i)=>startYear+i);
    const rounds=Array.from({length:maxRound},(_,i)=>i+1);
    const matrix=years.map(season=>({
      season,
      rounds:rounds.map(round=>{
        const cell=picks.filter(p=>p.season===season&&p.round===round);
        return {round,total:cell.length,original:cell.filter(p=>p.isOriginal).length,picks:cell};
      })
    }));

    return {picks,matrix,years,rounds,warnings:[]};
  }

  function buildLeaguePortfolio({league,teams,tradedPicks,currentUserId,currentYear}){
    const myTeam=(teams||[]).find(team=>team.ownerId===currentUserId||team.isMe);
    if(!myTeam){
      return {
        leagueId:String(league?.league_id||""),
        leagueName:league?.name||"Unknown league",
        rosterFound:false,
        warnings:["Your roster could not be identified."],
        players:[],
        picks:buildPickLedger({league,teams,tradedPicks,currentUserId,currentYear})
      };
    }

    const players=(myTeam.players||[]).map(player=>({
      ...player,
      pos:player.pos||"OTHER",
      team:normalizeTeam(player.team),
      age:Number.isFinite(Number(player.age))?Number(player.age):null,
      value:number(player.value)
    }));
    const valuedPlayers=players.filter(p=>p.value>0);
    const agedPlayers=players.filter(p=>p.age!==null);
    const totalValue=valuedPlayers.reduce((sum,p)=>sum+p.value,0);
    const topValues=[...valuedPlayers].sort((a,b)=>b.value-a.value);
    const top3Value=topValues.slice(0,3).reduce((sum,p)=>sum+p.value,0);
    const top5Value=topValues.slice(0,5).reduce((sum,p)=>sum+p.value,0);
    const positionCounts=summarizeCounts(players,p=>DEFAULT_POSITIONS.includes(p.pos)?p.pos:"OTHER");
    const positionValues=summarizeCounts(players,p=>DEFAULT_POSITIONS.includes(p.pos)?p.pos:"OTHER",p=>p.value);
    const nflTeamCounts=summarizeCounts(players,p=>p.team);
    const pickInventory=buildPickLedger({league,teams,tradedPicks,currentUserId,currentYear});

    return {
      leagueId:String(league?.league_id||""),
      leagueName:league?.name||"Unknown league",
      rosterFound:true,
      rosterId:myTeam.rosterId,
      format:{
        teams:(teams||[]).length,
        superflex:Boolean(league?.roster_positions?.includes?.("SUPER_FLEX")),
        rounds:pickInventory.rounds.length
      },
      players,
      playerSummary:{
        count:players.length,
        valuedCount:valuedPlayers.length,
        totalMarketValue:totalValue,
        averageAge:agedPlayers.length?agedPlayers.reduce((sum,p)=>sum+p.age,0)/agedPlayers.length:null,
        top3ValueShare:totalValue?top3Value/totalValue:0,
        top5ValueShare:totalValue?top5Value/totalValue:0,
        positionCounts,
        positionValues,
        nflTeamCounts
      },
      picks:pickInventory,
      warnings:[
        ...(players.some(p=>p.age===null)?["Some players are missing age data."]:[]),
        ...(players.some(p=>p.value===0)?["Some players did not match the current market-value dataset."]:[]),
        ...pickInventory.warnings
      ]
    };
  }

  function buildAllLeaguePortfolios({leagues,currentUserId,currentYear}){
    return (leagues||[]).map(entry=>buildLeaguePortfolio({
      league:entry.league,
      teams:entry.teams,
      tradedPicks:entry.traded||entry.tradedPicks||[],
      currentUserId,
      currentYear
    }));
  }

  function buildCrossLeagueSummary(portfolios){
    const valid=(portfolios||[]).filter(p=>p.rosterFound);
    const leagueCount=valid.length;
    const playerMap=new Map();
    for(const portfolio of valid){
      for(const player of portfolio.players){
        if(!playerMap.has(player.id))playerMap.set(player.id,{id:player.id,name:player.name,pos:player.pos,team:player.team,leagueIds:new Set(),leagueNames:new Set()});
        const row=playerMap.get(player.id);
        row.leagueIds.add(portfolio.leagueId);
        row.leagueNames.add(portfolio.leagueName);
      }
    }
    const playerExposure=[...playerMap.values()].map(row=>({
      id:row.id,name:row.name,pos:row.pos,team:row.team,
      leagueCount:row.leagueIds.size,totalLeagues:leagueCount,
      display:`${row.leagueIds.size} of ${leagueCount}`,
      leagues:[...row.leagueNames].sort()
    })).sort((a,b)=>b.leagueCount-a.leagueCount||a.name.localeCompare(b.name));

    return {leagueCount,playerExposure};
  }

  global.PortfolioEngine={buildPickLedger,buildLeaguePortfolio,buildAllLeaguePortfolios,buildCrossLeagueSummary};
})(typeof window!=="undefined"?window:globalThis);
