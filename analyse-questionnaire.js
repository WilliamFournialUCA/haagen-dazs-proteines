(function(){
'use strict';
let data,base='strict',priceVersion='all';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const f=(v,d=2)=>v===null||v===undefined||!Number.isFinite(v)?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(v);
const euro=v=>v===null||v===undefined?'—':f(v)+' €';
const pct=(a,n)=>a!==null&&a!==undefined&&n?f(100*a/n,1)+' %':'—';
const pv=v=>v===null||v===undefined?'Non interprétée':v<.001?'< 0,001':f(v,3);
const link=text=>{const a=el('a',String(text));a.href=data.source_url;a.target='_blank';a.rel='noopener noreferrer';a.title='Données : Google Sheet ; calculs décrits dans le protocole';return a;};
function table(id,headers,rows,caption){
 const root=$(id);root.replaceChildren();const wrap=el('div',undefined,'table-wrap'),t=el('table');
 if(caption)t.append(el('caption',caption));
 const h=el('thead'),hr=el('tr');headers.forEach(x=>{const c=el('th',x);c.scope='col';hr.append(c);});h.append(hr);t.append(h);
 const body=el('tbody');rows.forEach(row=>{const tr=el('tr');row.forEach((x,i)=>{const c=el(i?'td':'th');if(!i)c.scope='row';c.append(x instanceof Node?x:el('span',String(x)));tr.append(c);});body.append(tr);});t.append(body);wrap.append(t);root.append(wrap);
}
function phrase(id,text,source=true){$(id).replaceChildren(source?link(text):el('span',text));}
const current=()=>data.analysis.bases[base];
const range=r=>r?euro(r.low)+(Math.abs(r.high-r.low)>.005?' à '+euro(r.high):''):'Non publié';
function status(r){
 if(r.status==='sparse')return 'Chi² non interprété : au moins une case théorique < 5.';
 if(r.status==='constant')return 'Variances nulles : test non calculable.';
 if(r.p===null)return 'Données insuffisantes pour interpréter ce test.';
 const p=r.p_adjusted??r.p;
 return (r.status==='small_sample'?'Petit groupe : lecture fragile. ':'')+(p<.05?'Différence détectée ; portée exploratoire.':'H₀ non rejetée ; absence d’effet non démontrée.');
}
function tests(id,records,adjusted=true){
 table(id,['Variable / méthode','48 g : base et résultat','16 g : base et résultat','Statistique','p brute','p Holm','Taille d’effet','Écart et IC individuel 95 %','Lecture'],records.map(r=>{
  let a,b,interval;
  if(r.method==='Welch'){
   a='n = '+r.a.n+' ; moyenne '+f(r.a.mean)+' ; ET '+f(r.a.sd);b='n = '+r.b.n+' ; moyenne '+f(r.b.mean)+' ; ET '+f(r.b.sd);
   interval=f(r.difference)+(r.ci?' ['+f(r.ci[0])+' ; '+f(r.ci[1])+']':'');
  }else{
   a='n = '+r.n_a;b='n = '+r.n_b;
   a+=' ; '+r.categories.map((c,i)=>c+' : '+r.counts[0][i]).join(' / ');b+=' ; '+r.categories.map((c,i)=>c+' : '+r.counts[1][i]).join(' / ');
   interval='Effectif théorique minimum : '+f(r.min_expected);
  }
  const stat=r.method==='Welch'?'t = '+f(r.stat)+' ; ddl = '+f(r.df,1):'χ² = '+f(r.stat)+' ; ddl = '+f(r.df,0);
  return [r.label+' · '+r.method,link(a),link(b),link(stat),link(pv(r.p)),adjusted?link(pv(r.p_adjusted)):'Question séparée',link(r.effect_name+' = '+f(r.effect)),link(interval),status(r)];
 }),adjusted?'Tests exploratoires ; correction de Holm par famille.':'Contrôle de manipulation : test bilatéral séparé.');
}
function svgPlot(id,title,width=900,height=330){
 const root=$(id);root.replaceChildren();const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',title);svg.setAttribute('class','analysis-plot');
 const t=document.createElementNS(ns,'title');t.textContent=title;svg.append(t);root.append(svg);
 function add(tag,attrs,text){const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;svg.append(n);return n;}
 return add;
}
function manipulationPlot(r){
 const add=svgPlot('analysis-manipulation-chart','Score moyen de perception de la richesse en protéines, de 1 à 5. Détails dans le tableau suivant.',900,230);
 const x=v=>145+v/5*680;
 for(let v=0;v<=5;v++){add('line',{x1:x(v),x2:x(v),y1:35,y2:175,stroke:'#e4d9ce'});add('text',{x:x(v),y:204,'text-anchor':'middle','font-size':13},String(v));}
 [[r.b,90,'16 g','#b28b51'],[r.a,150,'48 g','#711b36']].forEach(([d,y,label,color])=>{
  add('text',{x:30,y:y+4,'font-size':16},label+' · n='+d.n);
  if(d.mean!==null){add('rect',{x:x(0),y:y-15,width:x(d.mean)-x(0),height:30,fill:color,rx:4});add('text',{x:x(d.mean)+10,y:y+5,'font-size':15},f(d.mean));}
 });
}
function quality(){
 const q=data.quality_control,a=data.analysis;
 table('analysis-flow',['Étape, dans l’ordre','Retraits à cette étape','Effectif restant'],[
  ['Réponses collectées',link('—'),link(q.received)],
  ...q.reasons.map((r,i)=>[r.label,link(r.count),link(q.received-q.reasons.slice(0,i+1).reduce((s,z)=>s+z.count,0))]),
  ...a.flow.map(r=>[r.label,link(r.removed),link(r.remaining)])
 ],'Journal agrégé ; le Sheet reste intact.');
 table('analysis-sensitivity',['Base','16 g / 48 g','Intention favorable','Écart moyen 48−16','p Holm · intention','d de Cohen'],['retained','strict'].map(k=>{
  const a=data.analysis.bases[k],d=a.distributions.intention_achat,r=a.outcomes[0],yes=d.counts.slice(-2).reduce((s,c)=>s+c.count,0);
  return [k==='strict'?'Cohérence des prix · CM3':'Retenue · Questionnaire',link(a.n_16+' / '+a.n_48),link(yes+' / '+d.n+' · '+pct(yes,d.n)),link(f(r.difference)),link(pv(r.p_adjusted)),link(f(r.effect))];
 }));
}
function descriptions(){
 const a=current();
 table('analysis-dictionary',['Variables','Nature','Traitement'],[
  ['Version, genre, CSP','Qualitative nominale','Effectifs, fréquences, chi² si conditions remplies'],
  ['Tranche d’âge, sport, fréquences','Qualitative ordinale','Modalités ordonnées ; aucun âge exact publié'],
  ['Culpabilité, perception, intention','Item ordinal à cinq échelons','Fréquences ; scores métriques pour Welch explicitement discutés'],
  ['Quatre seuils de prix','Quantitative · € TTC / 450 ml','Moyenne, médiane, dispersion, Welch, Van Westendorp'],
  ['Achat à trois prix','Ordinale, puis binaire dérivée','Top 2 = favorable ; autres = autre réponse'],
  ['Mémorisation des grammes','Oui/non puis nombre','Taux de rappel exact, sans exclusion individuelle']
 ]);
 const key=$('analysis-variable').value,d=a.distributions[key];
 if(d){let cumulative=0;const nominal=['genre','csp','variant','retenu_proteines'].includes(key);
  table('analysis-frequencies',['Modalité','Effectif','% de la base','% valide','% valide cumulé'],[
   ...d.counts.map(c=>{cumulative+=c.count;return [c.label,link(c.count),link(pct(c.count,a.n)),link(pct(c.count,d.n)),nominal?'Non pertinent':link(pct(cumulative,d.n))];}),
   ['Non renseigné / invalide',link(d.missing),link(pct(d.missing,a.n)),'—','—']
  ],data.variables[key].label+' · base totale '+a.n+' ; réponses valides '+d.n+'.');
 }
 const names=['Doute qualité','Bonne affaire','Cher envisageable','Trop cher'];
 table('analysis-descriptives',['Version / seuil','n','Moyenne','Médiane','ET','Q1–Q3','Min–max','Asymétrie / excès','Hors 1,5 IQR'],['16','48'].flatMap(v=>a.prices[v].thresholds.map((d,i)=>[
  v+' g · '+names[i],link(d.n),link(euro(d.mean)),link(euro(d.median)),link(euro(d.sd)),link(euro(d.q1)+' – '+euro(d.q3)),link(euro(d.min)+' – '+euro(d.max)),link(f(d.skew)+' / '+f(d.kurtosis)),link(d.iqr_flags===null?'—':d.iqr_flags)
 ])));
}
function prices(){
 const p=current().prices[priceVersion];
 if(p.curves.length){
  const add=svgPlot('analysis-vw-chart','Courbes Van Westendorp, base '+p.price_n+' quadruplets cohérents. Les quatre points figurent dans le tableau suivant.');
  const max=Math.max(1,...p.curves.map(c=>c.price)),x=v=>70+v/max*760,y=v=>265-v/100*215;
  for(const v of [0,25,50,75,100]){add('line',{x1:70,x2:830,y1:y(v),y2:y(v),stroke:'#e5dcd0'});add('text',{x:58,y:y(v)+4,'text-anchor':'end','font-size':12},v+' %');}
  for(let i=0;i<=5;i++)add('text',{x:x(i*max/5),y:290,'text-anchor':'middle','font-size':12},euro(i*max/5));
  for(const[key,color,label,i]of [['too_cheap','#711b36','Doute qualité',0],['bargain','#b28b51','Bonne affaire',1],['expensive','#568373','Cher',2],['too_expensive','#7b719e','Trop cher',3]]){
   add('polyline',{points:p.curves.map(c=>x(c.price)+','+y(c[key])).join(' '),fill:'none',stroke:color,'stroke-width':2.5});
   add('line',{x1:80+i*195,x2:100+i*195,y1:316,y2:316,stroke:color,'stroke-width':3});add('text',{x:106+i*195,y:320,'font-size':12},label);
  }
 }else phrase('analysis-vw-chart','Aucun quadruplet de prix exploitable.');
 table('analysis-vw-points',['Base','PMC · bas','OPP · égal rejet','IPP · indifférence','PME · haut'],[[link(p.price_n+' quadruplets'),...['PMC','OPP','IPP','PME'].map(k=>link(range(p.points[k])))]]);
 const pmc=p.points.PMC,pme=p.points.PME;
 if(pmc&&pme&&pmc.high<=pme.low)$( 'analysis-vw-points').append(link('Zone descriptive : '+range(pmc)+' à '+range(pme)+'.'));
 table('analysis-gg',['Prix public TTC','Favorable / base commune','Taux favorable','Prix × taux · TTC'],p.gg.map(r=>[link(euro(r.price)),link(r.yes+' / '+r.n),link(pct(r.yes,r.n)),link(euro(r.revenue_proxy))]));
 const add=svgPlot('analysis-gg-chart','Proportion de réponses favorables aux trois prix ; même base à chaque prix.',900,240);
 const y=v=>180-v*135;
 for(const v of [0,.5,1]){add('line',{x1:70,x2:840,y1:y(v),y2:y(v),stroke:'#e5dcd0'});add('text',{x:55,y:y(v)+4,'text-anchor':'end','font-size':12},f(v*100,0)+' %');}
 p.gg.forEach((r,i)=>{const x=180+i*265;if(r.n){const rate=r.yes/r.n;add('rect',{x,y:y(rate),width:100,height:180-y(rate),fill:i===0?'#711b36':i===1?'#a78044':'#568373',rx:3});add('text',{x:x+50,y:y(rate)-10,'text-anchor':'middle','font-size':14},pct(r.yes,r.n));}add('text',{x:x+50,y:212,'text-anchor':'middle','font-size':13},euro(r.price));});
 margin();
}
function margin(){
 const cost=$('analysis-cost'),net=$('analysis-net'),p=current().prices[priceVersion];
 if(cost.value===''||net.value===''||!cost.validity.valid||!net.validity.valid){phrase('analysis-margin','Renseignez des hypothèses valides et comparables pour calculer une marge indicatrice.',false);return;}
 const c=Number(cost.value),k=Number(net.value)/100,rows=p.gg.map(r=>({...r,margin:r.n?(r.price*k-c)*r.yes/r.n:null}));
 table('analysis-margin',['Prix public TTC','Recette nette HT supposée','Marge HT × taux favorable'],rows.map(r=>[link(euro(r.price)),el('span',euro(r.price*k)+' · hypothèse utilisateur'),el('span',euro(r.margin)+' · scénario')]));
 const valid=rows.filter(r=>r.margin!==null),max=valid.length?Math.max(...valid.map(r=>r.margin)):null,best=valid.filter(r=>Math.abs(r.margin-max)<1e-9);
 $('analysis-margin').append(el('p',best.length?'Maximum parmi ces seuls prix : '+best.map(r=>euro(r.price)).join(' / ')+'. '+(max<=0?'Aucune marge positive dans ce scénario.':'À confronter au taux d’achat réel et aux coûts fixes.'):'Base insuffisante.','analysis-hint'));
}
function conclusions(){
 const a=current(),m=a.manipulation,r=a.outcomes[0],root=$('analysis-conclusions');root.replaceChildren();
 const messages=[
  'Base sélectionnée : '+a.n+' réponses, dont '+a.n_16+' pour 16 g et '+a.n_48+' pour 48 g.',
  m.p===null?'La différence de perception n’est pas testable avec les données disponibles.':m.p<.05&&m.difference>0?'La perception protéinée diffère dans le sens attendu. L’effet ne peut pas être attribué au seul grammage.':m.p<.05?'La différence de perception va dans le sens inverse de l’attente : revoir les stimuli avant de conclure.':'Le contrôle de manipulation n’établit pas de différence nette : une absence d’effet A/B ne permet pas de conclure que le grammage est sans intérêt.',
  r.p_adjusted===null?'L’effet sur l’intention générale n’est pas interprétable.':r.p_adjusted<.05?'Une différence d’intention est détectée après correction : écart '+f(r.difference)+' point(s), d = '+f(r.effect)+'. La portée reste exploratoire.':'L’écart d’intention n’est pas significatif après correction (p Holm '+pv(r.p_adjusted)+') ; ce résultat ne démontre pas une équivalence.',
  'Pour un effet moyen fixé à d = 0,5, la puissance de planification du test t non corrigé est '+(r.power_medium===null?'non calculable':pct(r.power_medium,1))+'. '+(r.power_medium!==null&&r.power_medium<.8?'La collecte peut manquer des effets modérés.':'La puissance ne corrige pas les biais de recrutement.'),
  'Le prix de vente ne se décide pas avec l’OPP seul : comparer les repères de prix, les intentions aux trois tarifs et une marge calculée sur un même format et un même circuit.'
 ];messages.forEach(text=>{const li=el('li');li.append(link(text));root.append(li);});
}
function render(){
 const a=current(),q=data.quality_control;
 phrase('analysis-base-count',a.n+' réponses · 16 g : '+a.n_16+' · 48 g : '+a.n_48);
 phrase('analysis-takeaway','Un même fichier, deux lectures : '+q.retained+' réponses retenues dans le tableau de bord ; '+data.analysis.bases.strict.n+' dans la base avec cohérence des prix. Les conclusions restent exploratoires.');
 const cards=[['Collectées',q.received],['Base sélectionnée',a.n],['Retraits supplémentaires',data.analysis.bases.retained.n-a.n]],metrics=$('analysis-metrics');metrics.replaceChildren();
 cards.forEach(([label,value])=>{const c=el('div',undefined,'card');c.append(el('div',label,'label'));const n=el('div',undefined,'metric');n.append(link(value));c.append(n);metrics.append(c);});
 quality();descriptions();tests('analysis-manipulation-table',[a.manipulation],false);manipulationPlot(a.manipulation);
 const m=a.manipulation;phrase('analysis-manipulation-verdict',m.p===null?'Manipulation non vérifiable avec cette base.':m.p<.05?(m.difference>0?'Différence détectée dans le sens attendu : 48 g est perçue comme plus riche en protéines.':'Différence détectée en sens inverse : relire les versions et la question de contrôle.'):'Manipulation non vérifiée : le test ne met pas en évidence de différence nette entre les deux scores.');
 const mw=m.mw_p;
 if(mw!==null)$('analysis-manipulation-verdict').append(el('br'),link('Sensibilité ordinale : Mann–Whitney asymptotique, p '+pv(mw)+' ; corrélation bisérielle de rang = '+f(m.mw_effect)+'.'));
 table('analysis-memory',['Version','Rappel déclaré','Nombre saisi après oui','Rappel exact / nombres saisis'],['16','48'].map(k=>{const r=a.memory[k];return [k+' g',link(r.said_yes+' / '+r.n),link(r.numeric),link(r.correct+' / '+r.numeric+' · '+pct(r.correct,r.numeric))];}));
 tests('analysis-profiles',a.profiles);tests('analysis-outcomes',a.outcomes);
 const r=a.outcomes[0];phrase('analysis-power','Intention : puissance de planification pour un petit effet d = 0,2 : '+pct(r.power_small,1)+' ; pour un effet moyen d = 0,5 : '+pct(r.power_medium,1)+'. Calcul au seuil bilatéral de 5 %, sans correction, pour n48 = '+r.a.n+' et n16 = '+r.b.n+'.');
 $('analysis-outcomes').append(link('Sensibilité de l’intention sur les rangs : Mann–Whitney, p '+pv(r.mw_p)+' ; corrélation bisérielle de rang = '+f(r.mw_effect)+'.'));
 table('analysis-associations',['Question exploratoire','Paires valides','ρ de Spearman','p brute','p Holm'],a.associations.map(r=>[r.label,link(r.n),link(f(r.rho)),link(pv(r.p)),link(pv(r.p_adjusted))]));
 prices();conclusions();
}
QuestionnaireLive.subscribe(d=>{
 if(d.analysis?.version!==1)throw new Error('Analysis not yet prepared');
 const initial=!data;data=d;
 if(initial){
  for(const[k,v]of Object.entries(data.variables)){const o=el('option',v.label);o.value=k;$('analysis-variable').append(o);}$('analysis-variable').value='intention_achat';
  $('analysis-base').addEventListener('change',e=>{base=e.target.value;render();});
  $('analysis-variable').addEventListener('change',descriptions);
  $('analysis-price-version').addEventListener('change',e=>{priceVersion=e.target.value;prices();});
  ['analysis-cost','analysis-net'].forEach(id=>$(id).addEventListener('input',margin));
 }
 const date=new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(d.updated_at));
 phrase('analysis-date','Instantané commun préparé le '+date+' · Europe/Paris · '+(d.manual_update===false?'synchronisation horaire':'instantané manuel')+'.');
 render();$('analysis-loading').hidden=true;$('analysis-content').hidden=false;
},(error,hasData)=>{$('analysis-loading').hidden=false;$('analysis-loading').textContent=hasData?'Actualisation temporairement indisponible : les dernières analyses affichées sont conservées.':'Les analyses ne sont pas disponibles. Réessayez plus tard ; aucun résultat n’est inventé.';});
document.addEventListener('questionnaire:healthy',()=>{if(data)$('analysis-loading').hidden=true;});
})();
