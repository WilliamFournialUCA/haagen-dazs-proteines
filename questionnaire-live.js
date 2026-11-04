/* Shared snapshot reader: same source and cadence for results and analysis. */
(function(){
'use strict';
window.QuestionnaireLive={subscribe(onData,onError){
 let previous=null,busy=false,disposed=false;
 async function refresh(){
  if(busy||disposed||document.hidden)return;
  busy=true;
  try{
   const response=await fetch('data/questionnaire.json',{cache:'no-store'});
   if(!response.ok)throw new Error('Snapshot unavailable');
   const text=await response.text(),data=JSON.parse(text);
   if(data.schema_version!==3||!data.groups?.all||!data.quality_control)throw new Error('Unknown snapshot');
   if(text!==previous){onData(data);previous=text;}
   else document.dispatchEvent(new Event('questionnaire:healthy'));
  }catch(error){onError(error,previous!==null);}
  finally{busy=false;}
 }
 const timer=setInterval(refresh,60000);
 const visible=()=>{if(!document.hidden)refresh();};
 document.addEventListener('visibilitychange',visible);
 refresh();
 return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
}};
})();
