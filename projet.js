/* Evidence follows the questionnaire; target and proposed price remain group choices. */
(function(){
'use strict';
const $=id=>document.getElementById(id),proposed=4.99;
const fmt=(n,d=1)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
const euros=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n);
const pct=(yes,n)=>n?fmt(100*yes/n)+' %':'—';
let data;
function node(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
function link(text){const a=node('a',text);a.href=data.source_url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function append(id,...parts){const root=$(id);root.replaceChildren();parts.forEach(part=>root.append(typeof part==='string'?document.createTextNode(part):part));}
function rates(labels){
 let n=0,yes=0;
 for(const v of ['16','48']){
  const cross=data.groups[v].cross['proteines_habitude|intention_achat'];
  cross.rows.forEach((label,i)=>{if(labels.includes(label))cross.counts[i].forEach((count,j)=>{n+=count;if(['4','5'].includes(cross.columns[j]))yes+=count;});});
 }
 return {n,yes};
}
const range=p=>Math.abs(p.high-p.low)>.005?euros(p.low)+' à '+euros(p.high):euros(p.low);
function render(snapshot){
 data=snapshot;
 const regular=rates(['Oui, régulièrement']),other=rates(['Rarement','Jamais']);
 append('project-target-evidence','Dans les deux concepts actuels réunis, l’intention générale favorable atteint ',link(pct(regular.yes,regular.n)+' chez les consommateurs réguliers de produits protéinés ('+regular.yes+'/'+regular.n+')'),', contre ',link(pct(other.yes,other.n)+' chez ceux qui en consomment rarement ou jamais ('+other.yes+'/'+other.n+')'),'. Lecture descriptive de l’échantillon.');
 const price=data.analysis?.bases?.retained?.prices?.['48'],p=price?.points;
 if(p?.OPP&&p.IPP&&p.PMC&&p.PME){
  append('project-vw-evidence','Sur ',link(price.price_n+' quadruplets de prix cohérents'),' pour le concept enrichi, le point d’égal rejet est d’environ ',link(range(p.OPP)),', le prix d’indifférence d’environ ',link(range(p.IPP)),', la borne basse acceptable de ',link(range(p.PMC)),' et la borne haute d’environ ',link(range(p.PME)),'. ',p.PMC.high<=proposed&&proposed<=p.PME.low?'Notre proposition reste dans cette zone descriptive.':'Notre proposition est à réexaminer au regard de ces repères.',' Le point d’égal rejet n’est pas un optimum de bénéfice.');
 }
 else append('project-vw-evidence','Les repères de Van Westendorp du concept enrichi ne sont pas publiables dans cet instantané. La proposition de lancement reste à confirmer avec la poursuite de la collecte.');
 const rows=$('project-purchase-rows');rows.replaceChildren();
 for(const r of data.groups['48'].purchase){const tr=node('tr');[euros(r.price),r.top2+'/'+r.n+' · '+pct(r.top2,r.n),String(r.n)].forEach(text=>{const td=node('td');td.append(link(text));tr.append(td);});rows.append(tr);}
 const date=new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(data.updated_at));
 append('project-data-date','Orientations formulées le 18 novembre 2026. Indicateurs du questionnaire préparés le ',link(date+' (Europe/Paris)'),' : ',link(String(data.quality_control.retained)+' réponses retenues'),'. Les indicateurs suivent les actualisations du questionnaire ; le prix et la cible restent des choix éditoriaux du groupe.');
 $('project-data-status').hidden=true;
}
QuestionnaireLive.subscribe(render,()=>{$('project-data-status').hidden=false;$('project-data-status').textContent='Actualisation temporairement indisponible : les derniers indicateurs affichés sont conservés, avec leur date.';});
document.addEventListener('questionnaire:healthy',()=>{$('project-data-status').hidden=true;});
})();
