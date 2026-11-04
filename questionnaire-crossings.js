/* Segment filters and all selected categorical pairs, from public aggregates only. */
(function(){
'use strict';
const $=id=>document.getElementById(id),defaults=['sport','culpabilite','perception_proteines','intention_achat'];
let payload=null,payloadHash=null,pendingHash=null;
let data,base,initialized=false,selected=new Set(defaults),shown=8,opened=new Set();
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const fmt=(v,d=2)=>v===null||v===undefined||!Number.isFinite(v)?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(v);
const percent=(a,n)=>n?fmt(100*a/n,1)+' %':'—';
const pvalue=p=>p===null||p===undefined?'Non interprétée':p<.001?'< 0,001':fmt(p,3);
const linked=text=>{const a=node('a',String(text));a.href=data.source_url;a.target='_blank';a.rel='noopener noreferrer';return a;};
const label=key=>data.variables[key].label;
const explorer=()=>payload;
function makeTable(headers,rows,caption){
 const wrap=node('div',undefined,'table-wrap'),table=node('table');
 if(caption)table.append(node('caption',caption));
 const head=node('thead'),tr=node('tr');headers.forEach(t=>{const th=node('th',t);th.scope='col';tr.append(th);});head.append(tr);table.append(head);
 const body=node('tbody');rows.forEach(row=>{const tr=node('tr');row.forEach((value,i)=>{const cell=node(i?'td':'th');if(!i)cell.scope='row';cell.append(value instanceof Node?value:node('span',String(value)));tr.append(cell);});body.append(tr);});table.append(body);wrap.append(table);return wrap;
}
function holm(records){
 const valid=records.filter(r=>r.result.p!==null).sort((a,b)=>a.result.p-b.result.p);let maximum=0;const adjusted=new Map();
 valid.forEach((r,i)=>{maximum=Math.max(maximum,Math.min(1,(valid.length-i)*r.result.p));adjusted.set(r.id,maximum);});return adjusted;
}
function profileKey(){
 return explorer().filter_keys.flatMap((key,i)=>{const value=$('crossings-filter-'+key).value;return value==='all'?[]:[i+'='+value];}).join('&')||'*';
}
function profileDescription(){
 const names=explorer().filter_keys.flatMap(key=>{const s=$('crossings-filter-'+key);return s.value==='all'?[]:[label(key)+' : '+s.options[s.selectedIndex].text];});
 return names.length?names.join(' · '):'Tous les profils';
}
function segment(){
 const ids=explorer().segments[base]?.[$('crossings-concept').value],id=ids?.[profileKey()];
 return id===undefined?null:explorer().pool[id];
}
function filterSearch(){
 const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const term=normalize($('crossings-search').value);
 for(const item of $('crossings-variables').children)item.hidden=!normalize(item.textContent).includes(term);
}
function setSelected(keys){selected=new Set(keys);for(const input of $('crossings-variables').querySelectorAll('input'))input.checked=selected.has(input.value);opened.clear();shown=8;render();}
function initialize(){
 const e=explorer(),root=$('crossings-profile-filters');root.replaceChildren();
 for(const key of e.filter_keys){
  const wrap=node('div'),l=node('label',label(key)),select=node('select');select.id='crossings-filter-'+key;l.htmlFor=select.id;
  const any=node('option','Tous / toutes');any.value='all';select.append(any);
  [...data.variables[key].options,'Non renseigné / invalide'].forEach((text,i)=>{const option=node('option',text);option.value=String(i);select.append(option);});
  select.addEventListener('change',()=>{opened.clear();shown=8;render();});wrap.append(l,select);root.append(wrap);
 }
 const variables=$('crossings-variables');variables.replaceChildren();
 Object.entries(data.variables).forEach(([key,v])=>{const l=node('label',undefined,'crossings-check'),input=node('input');input.type='checkbox';input.value=key;input.checked=selected.has(key);
  input.addEventListener('change',()=>{if(input.checked)selected.add(key);else selected.delete(key);opened.clear();shown=8;render();});l.append(input,node('span',v.label));variables.append(l);
 });
 $('crossings-concept').addEventListener('change',()=>{opened.clear();shown=8;render();});
 $('crossings-reset-filters').addEventListener('click',()=>{for(const key of e.filter_keys)$('crossings-filter-'+key).value='all';opened.clear();shown=8;render();});
 $('crossings-search').addEventListener('input',filterSearch);
 $('crossings-select-all').addEventListener('click',()=>setSelected(Object.keys(data.variables)));
 $('crossings-select-none').addEventListener('click',()=>setSelected([]));
 $('crossings-select-default').addEventListener('click',()=>setSelected(defaults));
 $('crossings-display').addEventListener('change',render);
 $('crossings-show-more').addEventListener('click',()=>{shown+=8;render();});
 initialized=true;
}
function verdict(r,p){
 if(r.status==='small')return 'Moins de '+explorer().min_segment_n+' paires : tableau non détaillé.';
 if(r.status==='constant')return 'Une variable est constante : aucun test de lien.';
 if(r.status==='sparse')return 'Chi² non interprété : cellule théorique < 5.';
 if(r.status==='descriptive')return 'Spearman descriptif : moins de 30 paires.';
 if(p===undefined)return 'Test non interprétable.';
 return p<.05?'Association détectée après Holm ; exploratoire.':'H₀ non rejetée ; absence de lien non démontrée.';
}
function pairTable(record,group,adjusted){
 const {x,y,result:r}=record,root=node('div');
 const context=node('p',undefined,'analysis-hint');context.append(linked('Segment : '+group.n+' réponse(s) · paires renseignées : '+r.n+' · au moins une valeur absente / invalide : '+(group.n-r.n)+'.'));root.append(context);
 if(!r.cells.length){root.append(node('p',verdict(r,adjusted.get(record.id))));return root;}
 const xs=[...new Set(r.cells.map(c=>c[0]))].sort((a,b)=>a-b),ys=[...new Set(r.cells.map(c=>c[1]))].sort((a,b)=>a-b);
 const counts=new Map(r.cells.map(([a,b,n])=>[a+'|'+b,n])),rt=new Map(xs.map(a=>[a,0])),ct=new Map(ys.map(b=>[b,0]));
 r.cells.forEach(([a,b,n])=>{rt.set(a,rt.get(a)+n);ct.set(b,ct.get(b)+n);});
 const mode=$('crossings-display').value;
 const rows=xs.map(a=>[data.variables[x].options[a],...ys.map(b=>{
  const n=counts.get(a+'|'+b)||0,denominator=mode==='row'?rt.get(a):mode==='column'?ct.get(b):r.n;
  const cell=linked(mode==='count'?String(n):n+' · '+percent(n,denominator));
  cell.title='Effectif : '+n+' ; base ligne : '+rt.get(a)+' ; base colonne : '+ct.get(b)+' ; total valide : '+r.n;
  if(mode!=='count')cell.style.backgroundColor='rgba(113,27,54,'+(0.025+.15*n/Math.max(1,denominator))+')';
  return cell;
 }),linked(rt.get(a))]);
 rows.push(['Total valide',...ys.map(b=>linked(ct.get(b))),linked(r.n)]);
 const modeText={row:'pourcentage de chaque ligne',column:'pourcentage de chaque colonne',total:'pourcentage du total des paires valides',count:'effectifs uniquement'}[mode];
 root.append(makeTable([label(x)+' ↓ / '+label(y)+' →',...ys.map(b=>data.variables[y].options[b]),'Total ligne'],rows,'Effectif et '+modeText+'. Zéro = aucune observation dans cette cellule ; « — » = non calculable.'));
 const stat=node('p',undefined,'analysis-hint'),effectName=r.method==='Spearman'?'ρ de Spearman':'V de Cramer';
 stat.append(linked(effectName+' = '+fmt(r.effect)+' · p brute '+pvalue(r.p)+' · p Holm '+pvalue(adjusted.get(record.id))+(r.method==='Chi²'?' · χ² = '+fmt(r.stat)+' · ddl = '+fmt(r.df,0)+' · effectif théorique minimum = '+fmt(r.min_expected):'')),node('br'),node('span',verdict(r,adjusted.get(record.id))));root.append(stat);
 if(explorer().reverse_order.includes(x)||explorer().reverse_order.includes(y))root.append(node('p','Pour les fréquences, le rang est inversé par rapport à l’ordre visuel des modalités : un rang élevé correspond à une fréquence plus élevée.','analysis-hint'));
 return root;
}
function render(){
 const group=segment(),e=explorer(),concept=$('crossings-concept').options[$('crossings-concept').selectedIndex].text;
 const state=$('crossings-segment');state.replaceChildren();
 state.append(node('strong',group?group.n+' réponse(s) dans le groupe':'Groupe non détaillé'),node('p',profileDescription()+' · '+concept+' · '+(base==='strict'?'base avec cohérence des prix':'base retenue Questionnaire')+'.'));
 if(!group)state.append(node('p','Cette combinaison n’atteint pas le seuil de publication de '+e.min_segment_n+' réponses. Cela ne signifie pas zéro réponse. Retirez un critère ou choisissez un groupe plus large.'));
 else if(group.n<30)state.append(node('p','Petit groupe : descriptifs à lire avec prudence ; les tests ne sont pas tous interprétables.'));
 const pairs=e.pairs.map(([x,y],id)=>({x,y,id,result:group?.pairs[id]})).filter(p=>selected.has(p.x)&&selected.has(p.y));
 $('crossings-selection-count').replaceChildren(linked(selected.size+' variable(s) sélectionnée(s) · '+pairs.length+' croisement(s) par paires.'));
 const results=$('crossings-results'),summary=$('crossings-summary');results.replaceChildren();summary.replaceChildren();$('crossings-show-more').hidden=true;
 if(selected.size<2){results.append(node('p','Cochez au moins deux variables pour afficher un croisement.'));return;}
 if(!group)return;
 const adjusted=holm(pairs),interpretable=pairs.filter(p=>p.result.p!==null).length;
 summary.append(node('p',pairs.length+' croisements calculés sur cette sélection ; '+interpretable+' test(s) avec p-value interprétable. La correction de Holm porte sur ces '+interpretable+' tests, même si seuls certains tableaux sont dépliés.','analysis-hint'));
 const overview=node('details',undefined,'crossings-overview');overview.open=pairs.length<=10;overview.append(node('summary','Synthèse des '+pairs.length+' croisements sélectionnés'));
 overview.append(makeTable(['Croisement','Paires valides','Méthode','Taille d’effet','p brute','p Holm','Lecture'],pairs.map(p=>[
  label(p.x)+' × '+label(p.y),linked(p.result.n),p.result.method,linked((p.result.method==='Spearman'?'ρ = ':'V = ')+fmt(p.result.effect)),linked(pvalue(p.result.p)),linked(pvalue(adjusted.get(p.id))),verdict(p.result,adjusted.get(p.id))
 ]),'Résultats exploratoires de toutes les paires sélectionnées.'));summary.append(overview);
 for(const p of pairs.slice(0,shown)){
  const details=node('details',undefined,'crossings-pair'),title=node('summary',label(p.x)+' × '+label(p.y)+' · n = '+p.result.n);details.append(title);
  const body=node('div');details.append(body);details.open=opened.has(p.id);
  if(details.open)body.append(pairTable(p,group,adjusted));
  details.addEventListener('toggle',()=>{if(details.open){opened.add(p.id);if(!body.children.length)body.append(pairTable(p,group,adjusted));}else opened.delete(p.id);});
  results.append(details);
 }
 if(shown<pairs.length){$('crossings-show-more').hidden=false;$('crossings-show-more').textContent='Afficher les '+Math.min(8,pairs.length-shown)+' croisements suivants ('+Math.min(shown,pairs.length)+' / '+pairs.length+')';}
}
function update(snapshot,selectedBase){
 data=snapshot;base=selectedBase;
 const meta=data.analysis?.explorer;
 if(meta?.version!==1){$('crossings-pending').hidden=false;$('crossings-explorer').hidden=true;return;}
 if(meta.pool){payload=meta;display();return;}
 if(payloadHash===meta.sha256){display();return;}
 $('crossings-pending').hidden=false;$('crossings-pending').textContent='Chargement des agrégats de croisements pour cet instantané…';$('crossings-explorer').hidden=true;
 if(pendingHash===meta.sha256)return;
 pendingHash=meta.sha256;
 const expected=meta.sha256;
 (async()=>{
  try{
   if(meta.url!=='data/questionnaire-crossings.json'||!/^[a-f0-9]{64}$/.test(expected))throw Error('Unknown aggregate source');
   const response=await fetch(meta.url+'?snapshot='+expected,{cache:'no-store'});
   if(!response.ok)throw Error('Unavailable aggregates');
   const text=await response.text();
   const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
   const actual=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
   if(actual!==expected)throw Error('Snapshot mismatch');
   const parsed=JSON.parse(text);
   if(parsed.version!==1||!parsed.pool||!parsed.segments)throw Error('Unknown format');
   if(data.analysis?.explorer?.sha256!==expected)return;
   payload=parsed;payloadHash=expected;display();
  }catch(error){
   if(data.analysis?.explorer?.sha256===expected){$('crossings-pending').hidden=false;$('crossings-pending').textContent='Les croisements de cet instantané ne sont pas encore disponibles. Nouvelle tentative à la prochaine vérification ; aucun ancien groupe n’est mélangé aux nouvelles données.';}
  }finally{if(pendingHash===expected)pendingHash=null;}
 })();
}
function display(){
 if(!initialized)initialize();
 $('crossings-pending').hidden=true;$('crossings-explorer').hidden=false;render();
}
window.QuestionnaireCrossings={render:update};
document.addEventListener('questionnaire:healthy',()=>{if(data&&payloadHash!==data.analysis?.explorer?.sha256)update(data,base);});
})();
