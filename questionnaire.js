(function(){
'use strict';
let data,selected='all';
const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const fmt=(n,d=1)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n),pct=(a,n)=>n?fmt(100*a/n)+' %':'—',euro=v=>v===null?'—':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(v);
const linked=(text,title)=>{const a=node('a',text);a.href=data.source_url;a.target='_blank';a.rel='noopener noreferrer';if(title)a.title=title;return a;};
const pretty=(k,l)=>k==='culpabilite'?({'1':'1 · Aucune','2':'2 · Faible','3':'3 · Modérée','4':'4 · Importante','5':'5 · Très importante'}[l]||l):k==='intention_achat'?({'1':'1 · Pas du tout susceptible','2':'2 · Peu susceptible','3':'3 · Neutre','4':'4 · Assez susceptible','5':'5 · Tout à fait susceptible'}[l]||l):k==='retenu_proteines'?({'oui':'Oui','non':'Non'}[l]||l):l;
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
 const list=node('div',undefined,'response-bars');d.counts.forEach((c,i)=>{const row=node('div',undefined,'response-row'),line=node('div');line.append(node('span',pretty(key,c.label)),linked(c.count+' / '+d.n+' · '+pct(c.count,d.n)));row.append(line);const track=node('div',undefined,'response-track'),bar=node('span');bar.style.width=(100*c.count/d.n)+'%';if(kind==='donut')bar.style.background=colors[d.counts.filter(v=>v.count).findIndex(v=>v.label===c.label)%colors.length]||'#eee';track.setAttribute('aria-hidden','true');track.append(bar);row.append(track);list.append(row);});root.append(list);
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
 root.append(svg,node('p','Trop bas · Bonne affaire · Cher · Trop cher. Traits interpolés entre les seuils observés ; ils ne prédisent pas les ventes.','label'));
 const labels=node('div',undefined,'curve-legend');[['Trop bas','#711b36'],['Bonne affaire','#b28b51'],['Cher','#568373'],['Trop cher','#7b719e']].forEach(([label,c])=>{const e=node('span',label);e.style.borderColor=c;labels.append(e);});root.append(labels);
 const details=node('details'),sum=node('summary','Voir les valeurs du graphique');details.append(sum);const wrap=node('div',undefined,'table-wrap'),t=node('table');let tr=node('tr');for(const h of ['Prix TTC','Trop bas','Bonne affaire','Cher','Trop cher']){const th=node('th',h);th.scope='col';tr.append(th);}const head=node('thead');head.append(tr);t.append(head);const body=node('tbody');for(const c of p.curves){tr=node('tr');cell(tr,linked(euro(c.price)),true);for(const k of ['too_cheap','bargain','expensive','too_expensive'])cell(tr,linked(fmt(c[k])+' %'));body.append(tr);}t.append(body);wrap.append(t);details.append(wrap);root.append(details);
}
function crossing(g){
 const x=$('cross-x').value,y=$('cross-y').value;
 if(x===y){clear('cross-table').append(node('p','Choisir deux variables différentes.'));$('cross-note').textContent='';return;}
 const c=g.cross[x+'|'+y];if(!c.n){clear('cross-table').append(node('p','Aucune réponse renseignée pour ces deux variables dans la sélection.'));$('cross-note').textContent='';return;}
 table('cross-table',[data.variables[x].label+' × '+data.variables[y].label,...c.columns.map(l=>pretty(y,l)),'Total ligne'],c.rows.map((label,i)=>{const total=c.counts[i].reduce((a,b)=>a+b,0);return[pretty(x,label),...c.counts[i].map(v=>linked(v+' · '+pct(v,total))),linked(String(total))];}));
 $('cross-note').textContent='Base complète pour ce croisement : '+c.n+' réponse(s). Pourcentages calculés dans chaque ligne, pas sur le total général. '+(g.n-c.n)+' réponse(s) exclue(s) pour valeur manquante. Croisement descriptif : aucune causalité ou significativité n’est démontrée.';
}
function interpretations(g){
 const list=clear('interpretations');
 const add=t=>list.append(node('li',t));
 if(!g.n){add('Aucune réponse dans la sélection : aucun pourcentage ni comparaison ne peut être calculé.');return;}
 add('Échantillon affiché : '+g.n+' réponse(s). Une personne représente '+fmt(100/g.n)+' points de pourcentage. '+(g.n<30?'Effectif très faible : les graphiques sont affichés pour suivre la collecte, sans conclusion de marché.':'Les résultats restent descriptifs ; la représentativité du recrutement n’est pas démontrée.'));
 if(g.prices.n)add('Prix « bonne affaire » médian : '+euro(g.prices.medians[1])+' sur '+g.prices.n+' réponse(s) ordonnée(s). Ce montant n’est pas un prix optimal ni une recommandation commerciale.');
 const p=g.purchase[0];if(p.n)add('À 4,99 € TTC, '+p.top2+' personne(s) sur '+p.n+' déclarent une probabilité d’achat élevée ou très élevée ('+pct(p.top2,p.n)+'). Il s’agit d’une intention, pas d’un achat observé.');
 const a=data.groups['36'],b=data.groups['48'];
 if(!a.n||!b.n)add('La comparaison des versions est impossible pour le moment : il manque des réponses dans au moins un groupe.');
 else{const x=a.distributions.intention_achat,y=b.distributions.intention_achat;if(x.n&&y.n){const nx=x.counts.slice(-2).reduce((s,c)=>s+c.count,0),ny=y.counts.slice(-2).reduce((s,c)=>s+c.count,0);add('Intention générale favorable : '+pct(nx,x.n)+' pour 36 g (n='+x.n+') et '+pct(ny,y.n)+' pour 48 g (n='+y.n+'). Écart descriptif : '+fmt(100*ny/y.n-100*nx/x.n)+' points en faveur de la version 48 g si positif. Aucun effet statistiquement établi.');}}
 add('Les présentations visuelles des deux versions diffèrent : un écart éventuel ne peut pas être attribué au seul nombre de grammes. Les participations multiples et les abandons ne sont pas contrôlés dans cet export.');
}
function render(){
 const g=data.groups[selected];$('selected-base').textContent='Sélection : '+(selected==='all'?'ensemble des réponses':selected+' g')+' · n = '+g.n;
 $('n-total').replaceChildren(linked(String(g.n)));$('n-price').replaceChildren(linked(g.prices.n+' / '+g.n));
 const d=g.distributions.intention_achat,top=d.counts.slice(-2).reduce((s,c)=>s+c.count,0);$('n-positive').replaceChildren(linked(pct(top,d.n)));$('positive-base').textContent=top+' sur '+d.n+' réponses renseignées · scores 4 ou 5.';
 $('sample-warning').textContent=g.n===0?'Aucune réponse pour cette sélection. Les graphiques restent vides.':g.n<30?'Collecte en cours : n = '+g.n+'. Un pourcentage élevé peut correspondre à une seule personne. Les croisements décrivent cet échantillon, sans permettre de conclure sur le marché.':'Lecture descriptive : recrutement et représentativité à documenter. Un grand effectif ne supprime pas les biais de sélection.';
 dist('chart-variant','variant',g,'donut');dist('chart-genre','genre',g,'donut');
 for(const k of ['age_band','csp','sport','culpabilite','frequence_glaces','proteines_habitude','intention_achat','retenu_proteines'])dist('chart-'+k,k,g);
 table('price-summary',['Seuil','Médiane TTC','Base'],['Trop bas','Bonne affaire','Cher','Trop cher'].map((l,i)=>[l,linked(euro(g.prices.medians[i])),linked(String(g.prices.n))]));
 $('price-quality').textContent='Prix cohérents : '+g.prices.n+' / '+g.n+'. Incomplets, non numériques ou négatifs : '+g.prices.missing_or_negative+'. Ordre incohérent : '+g.prices.unordered+'. Les autres réponses restent utilisées pour leurs questions renseignées.';
 curves(g);$('opp').textContent=g.prices.equal_rejection?'Point d’égal rejet interpolé : '+euro(g.prices.equal_rejection.low)+(Math.abs(g.prices.equal_rejection.high-g.prices.equal_rejection.low)>.001?' à '+euro(g.prices.equal_rejection.high):'')+'. Repère de perception, pas optimum commercial.':'Point d’égal rejet non publié avant 30 quadruplets cohérents dans la sélection. Ce seuil éditorial n’est pas une garantie de validité statistique.';
 for(const p of g.purchase)dist('chart-'+p.key,p.key,g);
 table('purchase-summary',['Prix TTC','Probabilité élevée ou très élevée','Base'],g.purchase.map(p=>[linked(euro(p.price)),linked(p.top2+' · '+pct(p.top2,p.n)),linked(String(p.n))]));
 table('version-comparison',['Version','Effectif','Bonne affaire médiane','Intention favorable','Mémorisation exacte*'],['36','48'].map(v=>{const z=data.groups[v],d=z.distributions.intention_achat,t=d.counts.slice(-2).reduce((s,c)=>s+c.count,0);return[v+' g',linked(String(z.n)),linked(euro(z.prices.medians[1])),linked(pct(t,d.n)+' (n='+d.n+')'),linked(pct(z.memory.correct,z.memory.numeric)+' (n='+z.memory.numeric+')')];}));
 const m=g.memory;table('memory-summary',['Indicateur','Valeur'],[['Déclare avoir retenu',linked(m.said_yes+' / '+g.distributions.retenu_proteines.n+' · '+pct(m.said_yes,g.distributions.retenu_proteines.n))],['Saisit un nombre après « Oui »',linked(m.numeric+' / '+m.said_yes)],['Nombre exact parmi les réponses numériques',linked(m.correct+' / '+m.numeric+' · '+pct(m.correct,m.numeric))]]);
 crossing(g);interpretations(g);
}
fetch('data/questionnaire.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(d=>{
 if(d.schema_version!==1||!d.groups?.all)throw Error('Format non reconnu');data=d;
 const date=new Date(data.updated_at);$('snapshot-date').textContent='Données préparées le '+new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'}).format(date)+' · instantané manuel.';
 for(const id of ['cross-x','cross-y']){const s=$(id);for(const[k,v]of Object.entries(data.variables)){const o=node('option',v.label);o.value=k;s.append(o);}}$('cross-x').value='sport';$('cross-y').value='intention_achat';
 $('variant-filter').addEventListener('change',e=>{selected=e.target.value;render();});$('cross-x').addEventListener('change',()=>crossing(data.groups[selected]));$('cross-y').addEventListener('change',()=>crossing(data.groups[selected]));
 $('loading').hidden=true;$('survey-dashboard').hidden=false;render();
}).catch(()=>{$('loading').textContent='Les statistiques ne sont pas disponibles. Consultez le fichier source ou réessayez plus tard. Aucun résultat de remplacement n’est inventé.';});
})();
