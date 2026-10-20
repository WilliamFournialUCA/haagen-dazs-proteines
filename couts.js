/* Modèle pédagogique : les références de prix et les hypothèses sont documentées dans couts.html. */
(function () {
'use strict';
const prices={cream:3,milk:3.2106,sugar:.5,yolk:7,vanilla:40,water:.004};
const fractions={cream:.40,milk:.08,sugar:.16,yolk:.04,vanilla:.01,water:.31};
function calculate({target=12,kind='wpc',volume=1000000,loss=2,shock=0}={}) {
 if (![4.3,9,12].includes(target)||!['wpc','wpi'].includes(kind)||!Number.isFinite(volume)||volume<1000||!Number.isFinite(loss)||loss<0||loss>10||!Number.isFinite(shock)||shock< -30||shock>50) throw Error('Paramètres hors limites');
 const concentration=(kind==='wpc'?.8:.9)*.95, powderPrice=(kind==='wpc'?21:25.75)*(1+shock/100);
 const powderKg=.4*(target/100-.043)/(concentration-.043),baseKg=.4-powderKg;
 const ingredients=Object.fromEntries(Object.keys(prices).map(k=>[k,{kg:baseKg*fractions[k],cost:baseKg*fractions[k]*prices[k]}]));
 const baseCost=Object.values(ingredients).reduce((s,x)=>s+x.cost,0),powderCost=powderKg*powderPrice,raw=baseCost+powderCost;
 const process={labour:47.7*4/3600,energy:.25*.1488,clean:.025,stabiliser:.02};
 // Le rendement s'applique aux matières et à la transformation avant conditionnement.
 const preLoss=raw+Object.values(process).reduce((a,b)=>a+b,0),lossCost=preLoss/(1-loss/100)-preLoss;
 const packaging={pot:.11,lid:.05,seal:.025,case:.035};
 const packageCost=Object.values(packaging).reduce((a,b)=>a+b,0);
 const inbound=.03,storage=.04,transport=.09;
 const variableFactory=preLoss+lossCost+packageCost+inbound;
 const variable=variableFactory+storage+transport;
 const fixed={maintenance:100000,quality:50000,equipment:0,admin:50000,marketing:0,development:60000/3};
 const fixedTotal=Object.values(fixed).reduce((a,b)=>a+b,0),full=variable+fixedTotal/volume;
 const production=variableFactory+(fixed.maintenance+fixed.quality+fixed.equipment+fixed.development)/volume;
 const recurringCash=variable*volume+fixedTotal-fixed.equipment-fixed.development;
 const launchCash=recurringCash+60000;
 return {target,kind,volume,loss,shock,concentration,powderPrice,powderKg,baseKg,ingredients,baseCost,powderCost,raw,process,preLoss,lossCost,packaging,packageCost,inbound,storage,transport,variableFactory,variable,fixed,fixedTotal,full,production,recurringCash,launchCash,annualFull:full*volume};
}
if(typeof module!=='undefined'&&module.exports) module.exports={calculate,prices,fractions};
if(typeof document==='undefined') return;
const euro=(x,n=2)=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:n,maximumFractionDigits:n}).format(x)+' €';
const number=(x,n=0)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:n}).format(x);
const form=document.querySelector('#cost-controls');if(!form)return;
const put=(id,text)=>{document.getElementById(id).textContent=text;};
function update(){
 const p={target:Number(form.elements.namedItem('target').value),kind:form.elements.namedItem('kind').value,volume:Number(form.elements.namedItem('volume').value),loss:Number(form.elements.namedItem('loss').value),shock:Number(form.elements.namedItem('shock').value)};
 const m=calculate(p);
 put('volume-display',number(m.volume)+' pots/an');put('loss-display',number(m.loss,1)+' %');put('shock-display',(m.shock>0?'+':'')+number(m.shock)+' %');
 for(const key of ['variable','full','production']) put('result-'+key,euro(m[key]));
 put('result-cash',euro(m.launchCash,0));put('result-annual',euro(m.annualFull,0));
 put('scenario-label',m.target+' g/100 g · '+m.kind.toUpperCase()+(m.kind==='wpc'?'80':'90')+' · '+number(m.volume)+' pots vendus/an');
 put('base-amount',number(m.baseKg*1000,2)+' g');
 for(const [k,v] of Object.entries(m.ingredients)){put('qty-'+k,number(v.kg*1000,2)+' g');put('cost-'+k,euro(v.cost,3));}
 put('qty-powder',number(m.powderKg*1000,2)+' g');put('price-powder',euro(m.powderPrice,2)+'/kg');put('cost-powder',euro(m.powderCost,3));
 const priceEl=document.getElementById('price-powder'); priceEl.href=m.kind==='wpc'?'https://vespertool.com/blog/commodity-price-risk-management/':'https://www.dcamarketintelligence.com/update/3442/dca-market-intelligence-launches-new-price-benchmarks-for-europe-s-fast-growing-whey-protein-market';
 document.querySelector('[data-protein-source]').href=priceEl.href;
 put('protein-net',number(m.concentration*100,1)+' % de la poudre livrée');
 put('cost-headroom',euro(3.5-m.full,2));
 put('target-message',m.full<=3.5?'Sous le plafond de 3,50 € HT dans ce scénario.':'Au-dessus du plafond de 3,50 € HT dans ce scénario. Revoir volume, recette ou achats.');
 const base=calculate({...p,target:4.3});
 put('extra-cost',euro(m.full-base.full,3));
 document.getElementById('price-powder').title='Calcul à partir du repère industriel (WPC80 : Vesper, 7 octobre 2026 ; WPI90 : DCA, 8 avril 2026) ; variation de scénario : '+m.shock+' %.';
 for(const k of ['raw','lossCost','variableFactory','variable','full','production','baseCost','packageCost']) put('cost-'+k,euro(m[k],3));
 for(const [k,v] of Object.entries(m.process))put('cost-'+k,euro(v,3));
 put('cost-fixed',euro(m.fixedTotal/m.volume,3));
 for(const [k,v]of Object.entries(m.fixed))put('fixed-'+k,euro(v/m.volume,3));
 put('cash-variable',euro(m.variable*m.volume,0));put('cash-recurring',euro(m.recurringCash,0));put('cash-launch',euro(m.launchCash,0));
 put('unit-annual',euro(m.annualFull,0));
 put('loss-formula',number(m.loss,1)+' % : '+euro(m.preLoss,3)+' ÷ '+number(1-m.loss/100,3)+' − '+euro(m.preLoss,3));
 const tbody=document.querySelector('#sensitivity tbody');tbody.replaceChildren();
 for(const volume of [100000,500000,1000000,5000000]){const n=calculate({...p,volume});const tr=document.createElement('tr');for(const text of [number(volume),euro(n.variable,3),euro(n.fixedTotal/volume,3),euro(n.full,3),euro(n.annualFull,0)]){const td=document.createElement('td');td.textContent=text;tr.append(td);}tbody.append(tr);}
 const bars=document.querySelector('#cost-bars');bars.replaceChildren();
 const groups=[['Matières',m.raw/(1-m.loss/100)],['Transformation',Object.values(m.process).reduce((a,b)=>a+b,0)/(1-m.loss/100)],['Emballage et réception',m.packageCost+m.inbound],['Froid et transport',m.storage+m.transport],['Charges fixes réparties',m.fixedTotal/m.volume]];
 for(const [label,value]of groups){const row=document.createElement('div');row.className='cost-bar-row';const text=document.createElement('span');text.textContent=label+' · '+euro(value,2);const track=document.createElement('div');track.className='cost-track';const bar=document.createElement('div');bar.className='cost-fill';bar.style.width=(100*value/m.full)+'%';track.append(bar);row.append(text,track);bars.append(row);}
}
form.addEventListener('input',update);form.addEventListener('reset',()=>setTimeout(update,0));update();
})();

