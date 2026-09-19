// Перебор ПОБЕДНЫХ состояний уровня. В набор тестов не входит — долгий, и
// вопрос у него другой: levels.test.js отвечает «победу можно получить», а
// этот — «получить её можно ровно тем, что задумано». Второй вопрос важнее:
// уровень с шестью проходными ответами вместо одного формально исправен, а
// урока не даёт.
//
//   node web/tests/_wins.js          — все уровни
//   node web/tests/_wins.js b_        — только те, чей id начинается на b_
const H=require('./_harness.js');
const {LevelRegistry,Circuit,clamp}=H;
const DT=1/120;
function fresh(spec){const P={};for(const r of spec.parts){const c={};for(const k of Object.keys(r)){const v=r[k];c[k]=(typeof v==='function')?v:(v&&typeof v==='object'?JSON.parse(JSON.stringify(v)):v);}P[r.id]=c;}return P;}
function axes(spec){const ax=[];for(const raw of spec.parts){const it=raw.interact;if(!it)continue;
 if(it.type==='toggle'||it.type==='press')ax.push({id:raw.id,f:'closed',vals:[false,true],lbl:['разомкн','замкн']});
 else if(it.type==='cycle')ax.push({id:raw.id,f:it.field,vals:it.values,lbl:it.values});
 else if(it.type==='flag')ax.push({id:raw.id,f:it.field,vals:[false,true],lbl:['нет','да']});
 else if(it.type==='flip')ax.push({id:raw.id,f:'flipped',vals:[false,true],lbl:['как есть','перевёрнут']});
 else if(it.type==='pick'){const o=typeof it.options==='function'?it.options(raw,{}):it.options;ax.push({id:raw.id,pick:o,lbl:o.map(x=>x.label)});}
 else if(it.type==='knob'){const v=[];for(let k=0;k<=1.0001;k+=0.05)v.push(it.map?it.map(k):k);ax.push({id:raw.id,f:'value',vals:v,lbl:v.map(x=>String(Math.round(x*100)/100))});}}
 return ax;}
function setState(P,ax,c){ax.forEach((a,i)=>{const v=c[i];if(a.pick){const o=a.pick[v];for(const f of ['content','value','choice','repaired','blown','flipped'])if(o[f]!==undefined)P[a.id][f]=o[f];}else P[a.id][a.f]=a.vals[v];});}
function play(spec,P,sec){let ci=new Circuit();let refs=spec.build(ci,P)||{};ci.setTimestep(DT);
 let held=0,scoreAt=0,winner=false;
 const steps=Math.round(sec/DT);
 for(let n=0;n<steps;n++){spec.apply(refs,P,ci);
  for(const id of Object.keys(P)){const p=P[id];if(p.burnt&&p.comp&&refs[p.comp]&&refs[p.comp].resistance!==undefined)ci.setResistance(refs[p.comp],1e9);}
  const sol=ci.step(DT);
  for(const id of Object.keys(P)){const p=P[id];
   if(p.nets){p.u=(sol.nodeVoltage[p.nets[0]]||0)-(sol.nodeVoltage[p.nets[1]]||0);p.i=p.comp?(sol.componentCurrent[p.comp]||0):0;p.p=Math.abs(p.u*p.i);}else{p.u=0;p.i=0;p.p=0;}
   if(p.comp){const i=Math.abs(sol.componentCurrent[p.comp]||0);if(i>(p.iMax||0))p.iMax=i;}
   if(p.rated&&p.rated.pMax&&!p.burnt){const t=p.p/p.rated.pMax;p.heat=t+((p.heat||0)-t)*Math.exp(-DT/(p.rated.tau||0.7));if(p.heat>1){p.burnt=true;p.heat=1;}}}
  const m=spec.read(sol,refs,P)||{};if(spec.tick)spec.tick(DT,P,m,refs,ci,{flash(){}});
  const g=spec.goal(m,P);
  if(g.ok){held+=DT;scoreAt=clamp(spec.score(m,P),0,1);if(held>=spec.hold){winner=true;}}
  else held=Math.max(0,held-DT*2.2);}
 return {winner,scoreAt};}
const only=process.argv[2];
for(const spec of LevelRegistry.list){
 if(spec.freeform)continue;
 if(only && !spec.id.startsWith(only))continue;
 const ax=axes(spec);const sizes=ax.map(a=>a.pick?a.pick.length:a.vals.length);
 const total=sizes.reduce((a,b)=>a*b,1);
 if(total>4000){console.log(spec.index+' '+spec.id+': состояний '+total+' — пропуск');continue;}
 const wins=[];const idx=new Array(sizes.length).fill(0);
 for(let n=0;n<total;n++){
  const P=fresh(spec);setState(P,ax,idx);
  const r=play(spec,P,spec.testSeconds||((spec.hold||0)+1.2));
  if(r.winner)wins.push(ax.map((a,i)=>a.id+'='+a.lbl[idx[i]]).join(' ')+'  score='+r.scoreAt.toFixed(2));
  for(let i=sizes.length-1;i>=0;i--){if(++idx[i]<sizes[i])break;idx[i]=0;}}
 console.log('\n'+spec.index+' '+spec.id+' — победных состояний '+wins.length+' из '+total);
 for(const w of wins.slice(0,8))console.log('   '+w);
 if(wins.length>8)console.log('   …');
}
