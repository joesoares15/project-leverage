
const USERNAME="joesoares";
const LEAGUE_IDS=["1315874422917181441","1312098881235853312","1317240083270598656","1312092252037718016","1312061222975176704","1312098646744924160","1377108259638358016"];
const SLEEPER="https://api.sleeper.app/v1";
const VALUES="https://raw.githubusercontent.com/dynastyprocess/data/master/files/values.csv";
let state={leagues:[],players:{},values:new Map(),valueDate:null,managerProfiles:[],draftHistory:[],portfolioSummary:null};

const $=id=>document.getElementById(id);
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
const fmt=n=>Math.round(n||0).toLocaleString();
async function get(url){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(`${r.status}: ${url}`);return r.json()}
function csvRows(text){const rows=[];let row=[],field="",q=false;for(let i=0;i<text.length;i++){let c=text[i];if(q){if(c=='"'&&text[i+1]=='"'){field+='"';i++}else if(c=='"')q=false;else field+=c}else{if(c=='"')q=true;else if(c==','){row.push(field);field=""}else if(c=='\n'){row.push(field);rows.push(row);row=[];field=""}else if(c!='\r')field+=c}}if(field||row.length){row.push(field);rows.push(row)}return rows}
async function loadValues(){const r=await fetch(VALUES,{cache:"no-store"});if(!r.ok)throw new Error("Could not load dynasty values");const rows=csvRows(await r.text()),h=rows.shift();const ix=Object.fromEntries(h.map((x,i)=>[x,i]));state.values=new Map();for(const x of rows){const name=x[ix.player];if(!name)continue;state.values.set(norm(name),{name,pos:x[ix.pos],team:x[ix.team],age:+x[ix.age]||null,v1:+x[ix.value_1qb]||0,v2:+x[ix.value_2qb]||0})}state.valueDate=rows[0]?.[ix.scrape_date]||null}
function progress(n,msg){$("progressBar").style.width=n+"%";$("statusText").textContent=msg}
async function refresh(){
 $("refreshBtn").disabled=true;
 try{
  progress(4,"Loading current dynasty market values…");await loadValues();
  progress(10,"Loading Sleeper player directory…");state.players=await get(`${SLEEPER}/players/nfl`);
  const user=await get(`${SLEEPER}/user/${USERNAME}`); state.userId=user.user_id;
  state.leagues=[];
  for(let i=0;i<LEAGUE_IDS.length;i++){
   const id=LEAGUE_IDS[i];progress(15+Math.round(i/LEAGUE_IDS.length*75),`Importing league ${i+1} of ${LEAGUE_IDS.length}…`);
   const [league,users,rosters,traded]=await Promise.all([get(`${SLEEPER}/league/${id}`),get(`${SLEEPER}/league/${id}/users`),get(`${SLEEPER}/league/${id}/rosters`),get(`${SLEEPER}/league/${id}/traded_picks`)]);
   const analyzed=analyzeLeague({league,users,rosters,traded});
   analyzed.portfolio=PortfolioEngine.buildLeaguePortfolio({league:analyzed.league,teams:analyzed.teams,tradedPicks:traded,currentUserId:state.userId,currentYear:+league.season||new Date().getFullYear()});
   state.leagues.push(analyzed);
  }
  state.portfolioSummary=PortfolioEngine.buildCrossLeagueSummary(state.leagues.map(l=>l.portfolio));
  progress(91,"Analyzing historical drafts and manager tendencies…");
  state.draftHistory=await loadDraftHistory(state.leagues);
  state.managerProfiles=buildManagerProfiles(state.draftHistory,state.leagues);
  localStorage.setItem(CACHE_KEY,JSON.stringify({saved:Date.now(),leagues:state.leagues,valueDate:state.valueDate,managerProfiles:state.managerProfiles,draftHistory:state.draftHistory,portfolioSummary:state.portfolioSummary}));
  progress(100,"Refresh complete.");
  $("lastUpdated").textContent=`Updated ${new Date().toLocaleString()} · values ${state.valueDate||"current"}`;
  renderSummary(); populateFilter(); renderManagerProfiles();
 }catch(e){console.error(e);progress(0,"Refresh failed: "+e.message+". Open the deployed HTTPS site—not a downloaded local HTML file.");}
 finally{$("refreshBtn").disabled=false}
}

async function loadLeagueChain(startLeague,maxYears=10){
 const chain=[];let current=startLeague,seen=new Set();
 for(let i=0;i<maxYears&&current&&!seen.has(current.league_id);i++){
  seen.add(current.league_id);chain.push(current);
  if(!current.previous_league_id)break;
  try{current=await get(`${SLEEPER}/league/${current.previous_league_id}`)}catch{break}
 }
 return chain
}
async function loadDraftHistory(leagues){
 const history=[];const seenDrafts=new Set();
 for(const current of leagues){
  const chain=await loadLeagueChain(current.league);
  for(const lg of chain){
   let users=[],drafts=[];
   try{[users,drafts]=await Promise.all([get(`${SLEEPER}/league/${lg.league_id}/users`),get(`${SLEEPER}/league/${lg.league_id}/drafts`)])}catch{continue}
   for(const draft of drafts||[]){
    if(seenDrafts.has(draft.draft_id)||draft.status!=="complete")continue;seenDrafts.add(draft.draft_id);
    let picks=[];try{picks=await get(`${SLEEPER}/draft/${draft.draft_id}/picks`)}catch{continue}
    const userMap=new Map(users.map(u=>[u.user_id,u.display_name]));
    const kind=(draft.settings?.rounds||0)>8?"startup":"rookie";
    const sf=isSF(lg);
    const ranked=[...picks].map(pk=>{const pv=playerValue(pk.player_id,sf);return {...pk,player:pv}}).sort((a,b)=>b.player.value-a.player.value);
    const proxyRank=new Map(ranked.map((x,i)=>[x.player_id,i+1]));
    history.push({draftId:draft.draft_id,leagueId:lg.league_id,leagueName:lg.name,season:+draft.season||+lg.season,kind,sf,teams:lg.total_rosters||draft.settings?.teams||0,picks:picks.map(pk=>({pickNo:pk.pick_no,round:pk.round,rosterId:pk.roster_id,userId:pk.picked_by||null,manager:userMap.get(pk.picked_by)||pk.picked_by||`Roster ${pk.roster_id}`,player:playerValue(pk.player_id,sf),currentMarketRankProxy:proxyRank.get(pk.player_id)||null}))})
   }
  }
 }
 return history
}
function buildManagerProfiles(history,leagues){
 // Only profile people who are currently members of at least one of the user's
 // configured active leagues. Historical picks remain useful for those people,
 // but departed managers are excluded from the dashboard.
 const currentSharedUsers=new Map();
 for(const l of leagues){
  for(const u of l.users||[]){
   if(!u?.user_id)continue;
   if(!currentSharedUsers.has(u.user_id))currentSharedUsers.set(u.user_id,{name:u.display_name||u.user_id,leagues:new Set()});
   currentSharedUsers.get(u.user_id).leagues.add(l.league.name);
  }
 }
 const map=new Map();
 for(const d of history)for(const p of d.picks){
  if(!p.userId||!currentSharedUsers.has(p.userId))continue;
  const key=p.userId;if(!map.has(key))map.set(key,{id:key,name:currentSharedUsers.get(key).name||p.manager,picks:[],leagues:new Set(),drafts:new Set(),currentLeagues:new Set(currentSharedUsers.get(key).leagues)});
  const m=map.get(key);m.picks.push({...p,kind:d.kind,season:d.season,leagueName:d.leagueName,teams:d.teams});m.leagues.add(d.leagueName);m.drafts.add(d.draftId)
 }
 const out=[];
 for(const m of map.values()){
  const counts={QB:0,RB:0,WR:0,TE:0,OTHER:0},rookie={QB:0,RB:0,WR:0,TE:0,OTHER:0},startup={QB:0,RB:0,WR:0,TE:0,OTHER:0};
  let reachSum=0,reachN=0,earlyRB=0,earlyWR=0,earlyQB=0;
  for(const p of m.picks){const pos=counts[p.player.pos]!=null?p.player.pos:"OTHER";counts[pos]++;(p.kind==="startup"?startup:rookie)[pos]++;if(p.currentMarketRankProxy){reachSum+=p.currentMarketRankProxy-p.pickNo;reachN++}if(p.pickNo<=Math.max(12,p.teams)){if(pos==="RB")earlyRB++;if(pos==="WR")earlyWR++;if(pos==="QB")earlyQB++}}
  const total=m.picks.length||1,top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  const leagueConsistency=m.leagues.size>1?"Cross-league sample":"Single-league sample";
  let tendency=`Drafts ${top[0]} most often (${Math.round(top[1]/total*100)}% of selections).`;
  const early=Math.max(earlyRB,earlyWR,earlyQB);if(early){const ep=early===earlyRB?"RB":early===earlyWR?"WR":"QB";tendency+=` Early-round lean: ${ep}.`}
  out.push({id:m.id,name:m.name,pickCount:m.picks.length,draftCount:m.drafts.size,leagueCount:m.currentLeagues.size,historicalLeagueCount:m.leagues.size,counts,rookie,startup,hindsightDelta:reachN?reachSum/reachN:null,confidence:m.picks.length>=40?"High":m.picks.length>=15?"Medium":"Low",sample:leagueConsistency,tendency,leagues:[...m.currentLeagues].sort(),historicalLeagues:[...m.leagues].sort()})
 }
 return out.sort((a,b)=>b.pickCount-a.pickCount)
}
function posSummary(x){const total=Object.values(x).reduce((a,b)=>a+b,0)||1;return ["QB","RB","WR","TE"].map(p=>`${p} ${Math.round((x[p]||0)/total*100)}%`).join(" · ")}
function renderManagerProfiles(){
 if(!state.managerProfiles?.length)return;
 $("managerSection").classList.remove("hidden");
 $("managerProfiles").innerHTML=state.managerProfiles.map(m=>`<div class="manager-card"><div class="manager-head"><div><h4>${m.name}</h4><div class="small">${m.leagueCount} shared league${m.leagueCount===1?"":"s"} · ${m.draftCount} draft${m.draftCount===1?"":"s"} · ${m.pickCount} picks</div></div><span class="badge ${m.confidence==="High"?"elite":m.confidence==="Medium"?"contender":"fringe"}">${m.confidence} confidence</span></div><div class="manager-grid"><div class="manager-stat"><b>${posSummary(m.rookie)}</b><span>Rookie draft mix</span></div><div class="manager-stat"><b>${posSummary(m.startup)}</b><span>Startup draft mix</span></div><div class="manager-stat"><b>${m.leagueCount}</b><span>Cross-league sample</span></div><div class="manager-stat"><b>${m.hindsightDelta==null?"—":(m.hindsightDelta>0?"+":"")+m.hindsightDelta.toFixed(1)}</b><span>Current-market hindsight delta*</span></div></div><div class="tendency">${m.tendency} ${m.sample}.<br><small>*Not historical consensus ADP. Positive means the player’s current market rank is later than where selected; this is a provisional hindsight signal until historical ADP is connected.</small></div></div>`).join("")
}

function playerValue(pid,sf){
 const p=state.players[pid]||{}; const names=[p.full_name,`${p.first_name||""} ${p.last_name||""}`.trim()];
 let v=null;for(const n of names){v=state.values.get(norm(n));if(v)break}
 return {id:pid,name:p.full_name||p.last_name||pid,pos:p.position||v?.pos||"?",age:p.age||v?.age||null,value:sf?(v?.v2||0):(v?.v1||0),team:p.team||v?.team||""}
}
function lineupSlots(l){return (l.roster_positions||[]).filter(x=>!["BN","TAXI","IR"].includes(x))}
function isSF(l){return lineupSlots(l).includes("SUPER_FLEX")||lineupSlots(l).filter(x=>x==="QB").length>1}
function analyzeLeague(d){
 const sf=isSF(d.league), slots=lineupSlots(d.league), owners=new Map(d.users.map(u=>[u.user_id,u]));
 const teams=d.rosters.map(r=>{
  const players=(r.players||[]).map(id=>playerValue(id,sf)).sort((a,b)=>b.value-a.value);
  const starters=new Set(r.starters||[]); const starterPlayers=players.filter(p=>starters.has(p.id));
  const core=players.slice(0,Math.max(8,slots.length)).reduce((s,p)=>s+p.value,0);
  const depth=players.slice(Math.max(8,slots.length),Math.max(16,slots.length+8)).reduce((s,p)=>s+p.value,0);
  const pos={QB:0,RB:0,WR:0,TE:0};players.forEach(p=>{if(pos[p.pos]!=null)pos[p.pos]+=p.value});
  let picks=0; for(let y=new Date().getFullYear();y<=new Date().getFullYear()+2;y++)for(let rd=1;rd<=Math.min(4,d.league.settings?.draft_rounds||4);rd++)picks+=pickBase(y,rd,sf);
  d.traded.forEach(t=>{const val=pickBase(t.season,t.round,sf);if(t.owner_id===r.roster_id)picks+=val;if(t.roster_id===r.roster_id&&t.owner_id!==r.roster_id)picks-=val});
  const record=(r.settings?.wins||0)+(r.settings?.ties||0)*.5;
  return {rosterId:r.roster_id,ownerId:r.owner_id,name:owners.get(r.owner_id)?.display_name||`Team ${r.roster_id}`,isMe:r.owner_id===state.userId,players,core,depth,picks:Math.max(0,picks),pos,record,points:(r.settings?.fpts||0)+(r.settings?.fpts_decimal||0)/100};
 });
 const maxCore=Math.max(...teams.map(t=>t.core),1),maxDepth=Math.max(...teams.map(t=>t.depth),1);
 teams.forEach(t=>{t.score=100*(.62*t.core/maxCore+.20*t.depth/maxDepth+.10*Math.min(1,t.picks/18000)+.08*Math.min(1,t.record/10))});
 teams.sort((a,b)=>b.score-a.score);teams.forEach((t,i)=>t.rank=i+1);
 const me=teams.find(t=>t.isMe);
 const status=me.rank<=2?"Elite contender":me.rank<=Math.ceil(teams.length*.35)?"Contender":me.rank<=Math.ceil(teams.length*.65)?"Fringe / retool":"Rebuild";
 return {...d,teams,me,sf,slots,status,trades:buildTrades(teams,me,sf)};
}
function pickBase(year,round,sf){const now=new Date().getFullYear(),discount=Math.pow(.82,Math.max(0,year-now));const base=round===1?(sf?4300:3700):round===2?1500:round===3?650:250;return base*discount}
function buildTrades(teams,me,sf){
 if(!me)return[];const ideas=[];const need=Object.entries(me.pos).sort((a,b)=>a[1]-b[1]).map(x=>x[0]);
 for(const opp of teams.filter(t=>!t.isMe)){
  for(const target of opp.players.slice(0,12)){
   if(!need.slice(0,2).includes(target.pos)&&ideas.length>6)continue;
   const offers=me.players.filter(p=>p.id!==target.id&&p.value>0).sort((a,b)=>Math.abs(b.value-target.value)-Math.abs(a.value-target.value));
   let best=offers.find(p=>p.value>=target.value*.82&&p.value<=target.value*1.18);
   if(best){ideas.push({opp:opp.name,get:[target],give:[best],delta:best.value-target.value,reason:`Targets your ${target.pos} need while offering ${opp.name} a similarly valued asset.`});continue}
   const pool=me.players.filter(p=>p.value>400&&p.value<target.value*.9).slice(0,18);
   outer:for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){const sum=pool[i].value+pool[j].value;if(sum>=target.value*.88&&sum<=target.value*1.18){ideas.push({opp:opp.name,get:[target],give:[pool[i],pool[j]],delta:sum-target.value,reason:"Aggressive consolidation: turn depth into the best player in the deal."});break outer}}
  }
 }
 const uniq=[];const seen=new Set();for(const x of ideas.sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta))){const k=x.opp+x.get[0].id;if(!seen.has(k)){seen.add(k);uniq.push(x)}if(uniq.length===8)break}return uniq
}
function cls(s){return s.startsWith("Elite")?"elite":s==="Contender"?"contender":s.startsWith("Fringe")?"fringe":"retool"}
function action(l){if(l.status==="Elite contender")return"Consolidate for stars";if(l.status==="Contender")return"Buy one impact starter";if(l.status.startsWith("Fringe"))return"Choose a direction";return"Sell aging production"}
function pickInventoryLabel(portfolio){
 if(!portfolio?.picks?.picks?.length)return "No future picks";
 const firsts=portfolio.picks.picks.filter(p=>p.round===1).length;
 const seconds=portfolio.picks.picks.filter(p=>p.round===2).length;
 return `${firsts} 1st${firsts===1?"":"s"} · ${seconds} 2nd${seconds===1?"":"s"}`;
}
function pct1(value){return `${(100*(value||0)).toFixed(1)}%`}
function renderLeaguePortfolio(portfolio){
 if(!portfolio?.rosterFound){$("portfolioPanel").innerHTML="<h3>League portfolio</h3><p>Your roster could not be identified.</p>";return}
 const posCounts=Object.fromEntries(portfolio.playerSummary.positionCounts.map(x=>[x.key,x.value]));
 const positionText=["QB","RB","WR","TE"].map(pos=>`${pos}: ${posCounts[pos]||0}`).join(" · ");
 const matrix=portfolio.picks.matrix||[];
 const rounds=portfolio.picks.rounds||[];
 const header=rounds.map(round=>`<th>${round}${round===1?"st":round===2?"nd":round===3?"rd":"th"}</th>`).join("");
 const rows=matrix.map(year=>`<tr><th>${year.season}</th>${year.rounds.map(cell=>`<td><button class="pick-cell" data-season="${year.season}" data-round="${cell.round}" ${cell.total?"":"disabled"}>${cell.total} (${cell.original})</button></td>`).join("")}</tr>`).join("");
 $("portfolioPanel").innerHTML=`<h3>League portfolio</h3><div class="portfolio-metrics"><div><span>Roster assets</span><b>${portfolio.playerSummary.count}</b></div><div><span>Average age</span><b>${portfolio.playerSummary.averageAge==null?"—":portfolio.playerSummary.averageAge.toFixed(1)}</b></div><div><span>Top-3 value concentration</span><b>${pct1(portfolio.playerSummary.top3ValueShare)}</b></div><div><span>Position count</span><b class="compact-value">${positionText}</b></div></div><h4>Draft capital</h4><p class="small">Each cell shows total picks owned, with your original picks in parentheses.</p><div class="pick-table-wrap"><table class="pick-table"><thead><tr><th>Year</th>${header}</tr></thead><tbody>${rows}</tbody></table></div><div id="pickDetails" class="pick-details"><span class="small">Select a non-zero cell to see the original owners.</span></div>${portfolio.warnings.length?`<details class="portfolio-warnings"><summary>Data notes (${portfolio.warnings.length})</summary><ul>${portfolio.warnings.map(w=>`<li>${w}</li>`).join("")}</ul></details>`:""}`;
 document.querySelectorAll(".pick-cell:not([disabled])").forEach(button=>button.onclick=()=>{
   const season=+button.dataset.season,round=+button.dataset.round;
   const cell=portfolio.picks.matrix.find(y=>y.season===season)?.rounds.find(r=>r.round===round);
   $("pickDetails").innerHTML=`<h4>${season} Round ${round}</h4><table class="pick-detail-table"><thead><tr><th>Pick</th><th>Original owner</th></tr></thead><tbody>${cell.picks.map((pick,index)=>`<tr><td>${season} Round ${round}${cell.picks.length>1?` #${index+1}`:""}</td><td>${pick.isOriginal?"You":pick.originalOwnerName}</td></tr>`).join("")}</tbody></table>`;
 });
}
function renderSummary(){
 const filter=$("leagueFilter").value||"all";const list=state.leagues.filter(l=>filter==="all"||l.league.league_id===filter);
 $("summaryBody").innerHTML=list.map(l=>`<tr data-id="${l.league.league_id}"><td><b>${l.league.name}</b><div class="small">${l.sf?"Superflex":"1QB"} · ${l.teams.length} teams</div></td><td><span class="badge ${cls(l.status)}">${l.status}</span></td><td class="score">${l.me?.rank||"—"}/${l.teams.length}</td><td>${fmt(l.me?.core)}</td><td>${fmt(l.me?.depth)}</td><td>${pickInventoryLabel(l.portfolio)}</td><td>${action(l)}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">No leagues found.</td></tr>`;
 document.querySelectorAll("#summaryBody tr[data-id]").forEach(r=>r.onclick=()=>showLeague(r.dataset.id))
}
function populateFilter(){const f=$("leagueFilter");const cur=f.value;f.innerHTML='<option value="all">All leagues</option>'+state.leagues.map(l=>`<option value="${l.league.league_id}">${l.league.name}</option>`).join("");f.value=cur&&[...f.options].some(o=>o.value===cur)?cur:"all"}
function showLeague(id){
 const l=state.leagues.find(x=>x.league.league_id===id);if(!l)return;$("detailSection").classList.remove("hidden");$("detailTitle").textContent=l.league.name;
 $("leagueCards").innerHTML=[["Contender status",l.status],["Power rank",`${l.me.rank} of ${l.teams.length}`],["Roster value",fmt(l.me.core+l.me.depth)],["Draft capital",pickInventoryLabel(l.portfolio)]].map(x=>`<div class="metric"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
 renderLeaguePortfolio(l.portfolio);
 const groups={QB:[],RB:[],WR:[],TE:[],OTHER:[]};l.me.players.forEach(p=>(groups[p.pos]||groups.OTHER).push(p));
 $("myRoster").innerHTML=Object.entries(groups).filter(([,v])=>v.length).map(([pos,ps])=>`<div class="position"><h4>${pos}</h4>${ps.slice(0,12).map(p=>`<div class="player"><span>${p.name}<small> ${p.team||""}${p.age?" · "+p.age:""}</small></span><span>${fmt(p.value)}</span></div>`).join("")}</div>`).join("");
 $("tradeIdeas").innerHTML=l.trades.length?l.trades.map((t,i)=>`<div class="trade"><strong>${i+1}. Send to ${t.opp}</strong><div>You get: ${t.get.map(p=>p.name).join(" + ")}</div><div>You give: ${t.give.map(p=>p.name).join(" + ")}</div><p>${t.reason} Market difference: ${t.delta>=0?"+":""}${fmt(t.delta)} from your side.</p></div>`).join(""):"<p>No clean value-matched offers found.</p>";
 $("powerRankings").innerHTML=l.teams.map(t=>`<div class="rank-row"><b>${t.rank}</b><span>${t.name}${t.isMe?" (you)":""}</span><span>${Math.round(t.score)}</span><span class="hide-mobile">${fmt(t.core+t.depth)}</span></div>`).join("");
 $("detailSection").scrollIntoView({behavior:"smooth"})
}
function exportData(){const b=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),username:USERNAME,leagues:state.leagues,managerProfiles:state.managerProfiles,draftHistory:state.draftHistory},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="joesoares-dynasty-command-center.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$("refreshBtn").onclick=refresh;$("exportBtn").onclick=exportData;$("leagueFilter").onchange=renderSummary;$("strategy").onchange=()=>{if(state.leagues.length)renderSummary()};
const CACHE_KEY="project-leverage-cache-v2";
const cached=localStorage.getItem(CACHE_KEY);if(cached){try{const c=JSON.parse(cached);state.leagues=c.leagues||[];state.valueDate=c.valueDate;state.managerProfiles=c.managerProfiles||[];state.draftHistory=c.draftHistory||[];state.portfolioSummary=c.portfolioSummary||PortfolioEngine.buildCrossLeagueSummary(state.leagues.map(l=>l.portfolio).filter(Boolean));if(state.leagues.length){renderSummary();populateFilter();renderManagerProfiles();$("statusText").textContent="Showing your most recent saved refresh.";$("lastUpdated").textContent="Saved "+new Date(c.saved).toLocaleString()}}catch{}}
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js");

// --- Dynasty Lab: PL-001 AnyRBOnA53 weekly utility study ---
function pct(x){return (100*(x||0)).toFixed(1)+"%"}
let labPayload=null;
async function runLab(){
 const btn=$("runLabBtn");btn.disabled=true;
 try{
  $("labStatus").textContent="Loading the bundled PL-001 research dataset…";
  if(!labPayload){
   const response=await fetch("data/anyrbona53.json",{cache:"no-store"});
   if(!response.ok)throw new Error(`Bundled research data is not available (${response.status}). Open the GitHub Actions page and run “Build data and deploy site.”`);
   labPayload=await response.json();
  }
  const window=$("labSeasons").value,scoring=$("labScoring").value,rbRange=$("labRbRange").value,wrRange=$("labWrRange").value;
  const key=`${window}|${scoring}|${rbRange}|${wrRange}`;
  const result=labPayload.studies?.[key];
  if(!result)throw new Error(`This build does not contain study configuration ${key}.`);
  renderLab(result,window,scoring,rbRange,wrRange,labPayload.metadata||{});
  $("labStatus").textContent=`PL-001 loaded: ${result.RB.observations+result.WR.observations} player-week observations · ${window} · ${scoringLabel(scoring)}. Built ${formatDate(labPayload.metadata?.built_at)}.`;
 }catch(error){console.error(error);$("labStatus").textContent="Study could not run: "+error.message}
 finally{btn.disabled=false}
}
function scoringLabel(mode){return mode==="ppr"?"Full PPR":mode==="standard"?"Standard":"Half PPR"}
function formatDate(value){if(!value)return"recently";const d=new Date(value);return Number.isNaN(d.valueOf())?value:d.toLocaleString()}
function renderLab(result,window,scoring,rbRange,wrRange,metadata={}){
 $("labResults").classList.remove("hidden");
 const lift=result.RB.combined.hit-result.RB.neither.hit;
 $("labMetrics").innerHTML=[
  ["RB24+ player-week rate",pct(result.RB.hitRate)],
  ["RBs with ≥1 RB24+ week",pct(result.RB.playerHitRate)],
  ["Avg RB24+ weeks / player-season",result.RB.avgUsableWeeks.toFixed(2)],
  ["Combined-signal lift",(100*lift).toFixed(1)+" pts"]
 ].map(item=>`<div class="metric"><span>${item[0]}</span><b>${item[1]}</b></div>`).join("");
 $("labOutcomeTable").innerHTML=`<div class="rank-row"><b>RB</b><span>Prior-year RB${rbRange}; RB24+ outcome</span><span>${pct(result.RB.hitRate)}</span><span class="hide-mobile">${result.RB.observations} weeks</span></div><div class="rank-row"><b>WR</b><span>Prior-year WR${wrRange}; WR36+ outcome</span><span>${pct(result.WR.hitRate)}</span><span class="hide-mobile">${result.WR.observations} weeks</span></div>`;
 const signalRows=[
  ["Recent workload",result.RB.workload],
  ["Role-weighted teammate injury",result.RB.injury],
  ["Recent receiving involvement",result.RB.receiving],
  ["Any opportunity signal",result.RB.combined],
  ["No opportunity signal",result.RB.neither],
  ["Opportunity Delta ≥50",result.RB.highDelta],
  ["Opportunity Delta <50",result.RB.lowDelta]
 ];
 $("labSignalTable").innerHTML=signalRows.map(([name,x])=>`<div class="rank-row"><b>${x.n}</b><span>${name}</span><span>${pct(x.hit)}</span><span class="hide-mobile">RB24+ rate</span></div>`).join("");
 const examples=result.examples||[];
 $("labExamples").innerHTML=examples.length?examples.map(example=>`<div class="trade"><strong>${example.season} W${example.week}: ${example.name} (${example.team}) · Opportunity Delta ${example.opportunityDelta}</strong><div>Outcome: RB${example.weekRank}, ${example.fp.toFixed(1)} ${scoringLabel(scoring)} points</div><p>Trailing-three-week carries + targets: ${example.avg3.toFixed(1)} · estimated vacated backfield opportunity: ${example.vacated.toFixed(1)}${example.injuryNames?.length?` · affected teammates: ${example.injuryNames.join(", ")}`:""}</p></div>`).join(""):"<p>No qualifying injury-driven examples in this configuration.</p>";
 const direction=lift>0?"higher":"lower";
 $("labInterpretation").innerHTML=`<p>In this descriptive sample, weeks with at least one pre-kickoff opportunity signal had an RB24+ rate <b>${Math.abs(100*lift).toFixed(1)} percentage points ${direction}</b> than weeks with none.</p><p>This is not yet proof that the score predicts future weeks. The next research step is season-based holdout testing and calibration, without changing thresholds after seeing holdout results.</p>`;
 const assumptions=(metadata.assumptions||[]).map(item=>`<li>${item}</li>`).join("");
 $("labMethod").innerHTML=`<p><b>Study:</b> PL-001. <b>Window:</b> ${window}. <b>Scoring:</b> ${scoringLabel(scoring)}. <b>Cohorts:</b> prior-season RB${rbRange} and WR${wrRange}. <b>Outcomes:</b> RB24+ and WR36+ weekly finishes.</p><p><b>Pre-kickoff features:</b> recent workload, workload acceleration, receiving involvement, teammate practice/game status, and role-weighted estimated vacated opportunity.</p><p><b>Build:</b> ${formatDate(metadata.built_at)}. Source: ${metadata.source||"nflverse"}. Methodology ${metadata.methodology_version||"unknown"}. Injury seasons: ${(metadata.injury_seasons||[]).join(", ")||"none"}.</p><p><b>Explicit assumptions:</b></p><ul>${assumptions}</ul>`;
}
if($("runLabBtn"))$("runLabBtn").onclick=runLab;
