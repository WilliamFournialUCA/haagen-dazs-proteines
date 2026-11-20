(function(){
'use strict';
let data,selected='all';
const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const fmt=(n,d=1)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n),pct=(a,n)=>n?fmt(100*a/n)+' %':'—',euro=v=>v===null?'—':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(v);
const linked=(text,title)=>{const a=node('a',text);a.href=data.source_url;a.target='_blank';a.rel='noopener noreferrer';if(title)a.title=title;return a;};
const pretty=(k,l)=>k==='variant'&&l==='36 g'?'36 g · ancien concept':k==='perception_proteines'?({'1':'1 · Pas du tout d’accord','2':'2 · Pas d’accord','3':'3 · Ni d’accord ni en désaccord / sans opinion','4':'4 · D’accord','5':'5 · Tout à fait d’accord'}[l]||l):k==='culpabilite'?({'1':'1 · Aucune','2':'2 · Faible','3':'3 · Modérée','4':'4 · Importante','5':'5 · Très importante'}[l]||l):k==='intention_achat'?({'1':'1 · Pas du tout susceptible','2':'2 · Peu susceptible','3':'3 · Neutre','4':'4 · Assez susceptible','5':'5 · Tout à fait susceptible'}[l]||l):k==='retenu_proteines'?({'oui':'Oui','non':'Non'}[l]||l):l;
function clear(id){$(id).replaceChildren();return $(id);}
function cell(tr,text,head=false){const e=node(head?'th':'td');if(head)e.scope='row';e.append(typeof text==='string'?node('span',text):text);tr.append(e);return e;}
function table(id,headers,rows){const root=clear(id),wrap=node('div',undefined,'table-wrap'),t=node('table'),thead=node('thead'),tr=node('tr');for(const h of headers){const th=node('th',h);th.scope='col';tr.append(th);}thead.append(tr);t.append(thead);const body=node('tbody');for(const row of rows){const tr=node('tr');row.forEach((v,i)=>cell(tr,v,i===0));body.append(tr);}t.append(body);wrap.append(t);root.append(wrap);}
function dist(target,key,g,kind='bars'){
 const root=clear(target),d=g.distributions[key];root.append(node('p','Base : '+d.n+' réponse(s) renseignée(s) · '+d.missing+' non renseignée(s).','label'));
 if(!d.n){root.append(node('p','Aucune réponse pour cette question dans la sélection.','muted'));return;}
 const colors=['#711b36','#b28b51','#568373','#8c729c','#c67c65','#576a8b','#986878','#69897d','#b59a77','#66808a'];
 if(kind==='donut'){
  const used=d.counts.filter(c=>c.count);let cursor=0;const parts=used.map((c,i)=>{const start=cursor;cursor+=100*c.count/d.n;return colors[i%colors.length]+' '+start+'% '+cursor+'%';});
  const ring=node('div',undefined,'survey-donut');ring.style.background='conic-gradient('+parts.join(',')+')';ring.setAttribute('role','img');ring.setAttribute('aria-label',used.map(c=>pretty(key,c.label)+' : '+pct(c.count,d.n)).join(', '));const center=node('div',String(d.n));center.append(node('small','réponse(s)'));ring.append(center);root.append(ring);
 }
 const list=node('div',undefined,'response-bars');d.counts.filter(c=>key!=='variant'||c.label!=='36 g'||c.count).forEach((c,i)=>{const row=node('div',undefined,'response-row'),line=node('div');line.append(node('span',pretty(key,c.label)),linked(c.count+' / '+d.n+' · '+pct(c.count,d.n)));row.append(line);const track=node('div',undefined,'response-track'),bar=node('span');bar.style.width=(100*c.count/d.n)+'%';if(kind==='donut')bar.style.background=colors[d.counts.filter(v=>v.count).findIndex(v=>v.label===c.label)%colors.length]||'#eee';track.setAttribute('aria-hidden','true');track.append(bar);row.append(track);list.append(row);});root.append(list);
}
function curves(g){
 const root=clear('price-curves'),p=g.prices;
 if(!p.n){root.append(node('p','Aucun quadruplet de prix complet et ordonné pour cette sélection.'));return;}
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 900 350');svg.setAttribute('role','img');svg.setAttribute('aria-label','Courbes descriptives des quatre seuils de prix, base '+p.n+' réponse(s).');
 const s=(tag,attrs,text)=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);return e;};
 const max=Math.max(1,...p.curves.map(c=>c.price)),x=v=>65+v/max*790,y=v=>290-v/100*250;
 for(const v of [0,25,50,75,100]){s('line',{x1:65,y1:y(v),x2:855,y2:y(v),stroke:'#dfd5ca'});s('text',{x:52,y:y(v)+4,'text-anchor':'end','font-size':12},v+' %');}
 for(let i=0;i<=5;i++){const v=max*i/5;s('text',{x:x(v),y:315,'text-anchor':'middle','font-size':12},euro(v));}
 for(const[k,color]of [['too_cheap','#711b36'],['bargain','#b28b51'],['expensive','#568373'],['too_expensive','#7b719e']])s('polyline',{points:p.curves.map(c=>x(c.price)+','+y(c[k])).join(' '),fill:'none',stroke:color,'stroke-width':3});
 root.append(svg);
 const labels=node('div',undefined,'curve-legend');[['Trop bas','#711b36'],['Bonne affaire','#b28b51'],['Cher','#568373'],['Trop cher','#7b719e']].forEach(([label,c])=>{const e=node('span',label);e.style.borderColor=c;labels.append(e);});root.append(labels);
 const details=node('details'),sum=node('summary','Voir les valeurs du graphique');details.append(sum);const wrap=node('div',undefined,'table-wrap'),t=node('table');let tr=node('tr');for(const h of ['Prix TTC','Trop bas','Bonne affaire','Cher','Trop cher']){const th=node('th',h);th.scope='col';tr.append(th);}const head=node('thead');head.append(tr);t.append(head);const body=node('tbody');for(const c of p.curves){tr=node('tr');cell(tr,linked(euro(c.price)),true);for(const k of ['too_cheap','bargain','expensive','too_expensive'])cell(tr,linked(fmt(c[k])+' %'));body.append(tr);}t.append(body);wrap.append(t);details.append(wrap);root.append(details);
}
function crossing(){
 const root=clear('cross-table'),x=$('cross-x').value,y=$('cross-y').value,z=$('cross-z').value;
 const versions=$('cross-version').value==='both'?['16','48']:[$('cross-version').value];
 let views;
 try{views=versions.map(version=>({version,...QuestionnaireCrossModel.project(data,version,x,y,z)}));}
 catch(error){root.append(node('p',error.message==='distinct'?'Choisissez des variables différentes dans les trois menus.':'Les tableaux à trois variables sont en préparation. Ils apparaîtront avec le prochain instantané publié.'));$('cross-note').textContent='';return;}
 const facets=z?data.variables[z].options.map((label,i)=>i).filter(i=>views.some(view=>view.cells.some(c=>c[2]===i))):[0];
 if(!facets.length){root.append(node('p','Aucune réponse renseignée pour ces trois variables dans les versions sélectionnées.'));}
 for(const facet of facets){
  const section=node('div',undefined,'cross-facet');
  if(z)section.append(node('h3',data.variables[z].label+' : '+pretty(z,data.variables[z].options[facet])));
  const panel=node('div',undefined,versions.length===2?'cross-version-grid':'cross-single-grid');
  const xs=[...new Set(views.flatMap(v=>v.cells.filter(c=>c[2]===facet).map(c=>c[0])))].sort((a,b)=>a-b);
  const ys=[...new Set(views.flatMap(v=>v.cells.filter(c=>c[2]===facet).map(c=>c[1])))].sort((a,b)=>a-b);
  for(const view of views){
   const card=node('article',undefined,'card'),heading=node(z?'h4':'h3','Concept '+view.version+' g');card.append(heading);
   const cells=view.cells.filter(c=>c[2]===facet),n=cells.reduce((sum,c)=>sum+c[3],0),base=node('p',undefined,'label');
   base.append(linked('Base de ce tableau : '+n+' réponse(s)'+(z?' · base complète des trois variables : '+view.n:'')));card.append(base);
   if(!n){card.append(node('p','Aucune réponse complète dans ce tableau pour cette version.'));panel.append(card);continue;}
   const counts=new Map(cells.map(c=>[c[0]+'|'+c[1],c[3]]));
   const wrap=node('div',undefined,'table-wrap'),t=node('table');t.append(node('caption',data.variables[x].label+' en lignes × '+data.variables[y].label+' en colonnes'+(z?' · '+pretty(z,data.variables[z].options[facet]):'')+' · '+view.version+' g. Effectif et % de chaque ligne.'));
   const head=node('thead'),headrow=node('tr');[data.variables[x].label+' ↓ / '+data.variables[y].label+' →',...ys.map(j=>pretty(y,data.variables[y].options[j])),'Total ligne'].forEach(label=>{const th=node('th',label);th.scope='col';headrow.append(th);});head.append(headrow);t.append(head);
   const body=node('tbody');
   for(const i of xs){const tr=node('tr'),total=ys.reduce((sum,j)=>sum+(counts.get(i+'|'+j)||0),0);cell(tr,pretty(x,data.variables[x].options[i]),true);for(const j of ys){const count=counts.get(i+'|'+j)||0;cell(tr,linked(count+' · '+pct(count,total)));}cell(tr,linked(String(total)));body.append(tr);}
   const totalrow=node('tr');cell(totalrow,'Total valide',true);ys.forEach(j=>cell(totalrow,linked(String(xs.reduce((sum,i)=>sum+(counts.get(i+'|'+j)||0),0)))));cell(totalrow,linked(String(n)));body.append(totalrow);t.append(body);wrap.append(t);card.append(wrap);panel.append(card);
  }
  section.append(panel);root.append(section);
 }
 const note=$('cross-note');note.replaceChildren();
 views.forEach((view,i)=>{if(i)note.append(node('br'));note.append(linked('Concept '+view.version+' g : '+view.n+' réponse(s) complète(s) sur '+view.total+' retenue(s) ; '+view.missing+' non utilisée(s) pour valeur manquante dans ce croisement.'));});
}
function render(){
 const g=data.groups[selected];$('selected-base').textContent='Sélection : '+(selected==='all'?'réponses retenues, ensemble':selected+' g')+' · n = '+g.n;
 $('n-total').replaceChildren(linked(String(g.n)));$('n-price').replaceChildren(linked(g.prices.n+' / '+g.n));
 const d=g.distributions.intention_achat,top=d.counts.slice(-2).reduce((s,c)=>s+c.count,0);$('n-positive').replaceChildren(linked(pct(top,d.n)));$('positive-base').textContent=top+' sur '+d.n+' réponses renseignées · scores 4 ou 5.';
 dist('chart-variant','variant',g,'donut');dist('chart-genre','genre',g,'donut');
 for(const k of ['perception_proteines','age_band','csp','sport','culpabilite','frequence_glaces','proteines_habitude','intention_achat','retenu_proteines'])dist('chart-'+k,k,g);
 table('price-summary',['Seuil','Médiane TTC','Base'],['Trop bas','Bonne affaire','Cher','Trop cher'].map((l,i)=>[l,linked(euro(g.prices.medians[i])),linked(String(g.prices.n))]));
 $('price-quality').textContent='Base des prix : '+g.prices.n+' réponses complètes et ordonnées sur '+g.n+'.';
 curves(g);$('opp').textContent=g.prices.equal_rejection?'Point d’égal rejet interpolé : '+euro(g.prices.equal_rejection.low)+(Math.abs(g.prices.equal_rejection.high-g.prices.equal_rejection.low)>.001?' à '+euro(g.prices.equal_rejection.high):'')+'.':g.prices.n<30?'Point d’égal rejet non affiché : moins de 30 réponses cohérentes.':'Aucun point d’égal rejet calculable.';
 for(const p of g.purchase)dist('chart-'+p.key,p.key,g);
 table('purchase-summary',['Prix TTC','Probabilité élevée ou très élevée','Base'],g.purchase.map(p=>[linked(euro(p.price)),linked(p.top2+' · '+pct(p.top2,p.n)),linked(String(p.n))]));
 table('version-comparison',['Version','Effectif','Bonne affaire médiane','Intention favorable','Mémorisation exacte*','Perçue riche en protéines'],['16','48',...(data.groups['36'].n?['36']:[])].map(v=>{const z=data.groups[v],d=z.distributions.intention_achat,t=d.counts.slice(-2).reduce((s,c)=>s+c.count,0);const perception=z.distributions.perception_proteines,agree=perception.counts.slice(-2).reduce((s,c)=>s+c.count,0);return[v==='36'?'36 g · ancien concept':v+' g',linked(String(z.n)),linked(euro(z.prices.medians[1])),linked(pct(t,d.n)+' (n='+d.n+')'),linked(pct(z.memory.correct,z.memory.numeric)+' (n='+z.memory.numeric+')'),linked(pct(agree,perception.n)+' (n='+perception.n+')')];}));
 const perception=g.distributions.perception_proteines,agree=perception.counts.slice(-2).reduce((s,c)=>s+c.count,0);table('perception-summary',['Indicateur','Valeur'],[['D’accord ou tout à fait d’accord',linked(agree+' / '+perception.n+' · '+pct(agree,perception.n))],['Base renseignée',linked(String(perception.n))],['Valeur absente',linked(String(perception.missing))]]);
 const m=g.memory;table('memory-summary',['Indicateur','Valeur'],[['Déclare avoir retenu',linked(m.said_yes+' / '+g.distributions.retenu_proteines.n+' · '+pct(m.said_yes,g.distributions.retenu_proteines.n))],['Saisit un nombre après « Oui »',linked(m.numeric+' / '+m.said_yes)],['Nombre exact parmi les réponses numériques',linked(m.correct+' / '+m.numeric+' · '+pct(m.correct,m.numeric))]]);
 crossing();
}
QuestionnaireLive.subscribe(d=>{
 if(d.schema_version!==3||!d.groups?.all)throw Error('Format non reconnu');
 const initial=!data;data=d;
 const date=new Date(data.updated_at);$('snapshot-date').textContent='Dernière mise à jour des résultats : '+new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'}).format(date)+'.';
 const q=data.quality_control;
 $('quality-status').replaceChildren(linked(String(q.received)),' réponses collectées · ',linked(String(q.retained)),' retenues · ',linked(String(q.excluded)),' exclues.');
 $('variant-filter').querySelector('option[value="36"]').hidden=!data.groups['36'].n;
 if(selected==='36'&&!data.groups['36'].n){selected='all';$('variant-filter').value='all';}
 if(initial){
  for(const id of ['cross-x','cross-y','cross-z']){const s=$(id);for(const[k,v]of Object.entries(data.variables)){if(k==='variant')continue;const o=node('option',v.label);o.value=k;s.append(o);}}$('cross-x').value='sport';$('cross-y').value='intention_achat';
  $('variant-filter').addEventListener('change',e=>{selected=e.target.value;render();});for(const id of ['cross-version','cross-x','cross-y','cross-z'])$(id).addEventListener('change',crossing);
 }
 $('loading').hidden=true;$('survey-dashboard').hidden=false;render();
},(error,hasData)=>{$('loading').hidden=false;$('loading').textContent=hasData?'Actualisation temporairement indisponible : le dernier instantané affiché est conservé.':'Les statistiques ne sont pas disponibles. Consultez le volet des sources ou réessayez plus tard.';});
document.addEventListener('questionnaire:healthy',()=>{if(data)$('loading').hidden=true;});
function revealSources(){
 const id=location.hash.slice(1);
 if(id!=='qualite-reponses'&&id!=='sources-resultats')return;
 $('sources-resultats').open=true;
 if(id==='qualite-reponses')$('qualite-reponses').scrollIntoView();
}
window.addEventListener('hashchange',revealSources);
revealSources();
})();
