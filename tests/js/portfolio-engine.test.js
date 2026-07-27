const fs=require("fs");
const vm=require("vm");
const assert=require("assert");
const source=fs.readFileSync("site/js/portfolio-engine.js","utf8");
const context={globalThis:{}};
vm.createContext(context);
vm.runInContext(source,context);
const E=context.globalThis.PortfolioEngine;

const league={league_id:"L1",name:"Test League",season:"2026",settings:{draft_rounds:4},roster_positions:["QB","RB","WR","TE","SUPER_FLEX"]};
const teams=[
 {rosterId:1,ownerId:"me",name:"Me",isMe:true,players:[{id:"p1",name:"Alpha",pos:"QB",team:"DEN",age:25,value:5000},{id:"p2",name:"Beta",pos:"WR",team:"",age:null,value:1000}]},
 {rosterId:2,ownerId:"other",name:"Other",players:[]}
];
const traded=[
 {season:"2027",round:1,roster_id:2,owner_id:1},
 {season:"2027",round:2,roster_id:1,owner_id:2}
];
const p=E.buildLeaguePortfolio({league,teams,tradedPicks:traded,currentUserId:"me",currentYear:2026});
assert.equal(p.rosterFound,true);
assert.equal(p.playerSummary.count,2);
assert.equal(p.playerSummary.totalMarketValue,6000);
assert.equal(p.players[1].team,"FA/Unknown");
const y2027=p.picks.matrix.find(x=>x.season===2027);
assert.equal(y2027.rounds.find(x=>x.round===1).total,2);
assert.equal(y2027.rounds.find(x=>x.round===1).original,1);
assert.equal(y2027.rounds.find(x=>x.round===2).total,0);
const summary=E.buildCrossLeagueSummary([p,{...p,leagueId:"L2",leagueName:"Second"}]);
assert.equal(summary.playerExposure[0].display,"2 of 2");
console.log("portfolio-engine tests passed");
