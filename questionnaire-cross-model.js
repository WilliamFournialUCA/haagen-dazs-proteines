/* Pure read-only table projection. Three-way counts cannot be inferred from pairs. */
(function(root){
'use strict';
function project(data,version,x,y,z=''){
 const keys=[x,y,...(z?[z]:[])];
 if(new Set(keys).size!==keys.length||keys.some(k=>k==='variant'||!data.variables[k]))throw Error('distinct');
 const group=data.groups[version];
 if(!group)throw Error('version');
 if(!z){
  const table=group.cross[x+'|'+y];if(!table)throw Error('pending');
  const cells=[];
  table.rows.forEach((row,i)=>table.columns.forEach((column,j)=>{const n=table.counts[i][j];if(n)cells.push([data.variables[x].options.indexOf(row),data.variables[y].options.indexOf(column),0,n]);}));
  return {n:table.n,total:group.n,missing:group.n-table.n,cells};
 }
 const extra=data.three_way;
 if(extra?.version!==1)throw Error('pending');
 const id=extra.triples.findIndex(triple=>keys.every(k=>triple.includes(k)));
 if(id<0||!extra.groups[version]?.tables[id])throw Error('pending');
 const source=extra.groups[version].tables[id],triple=extra.triples[id],axes=keys.map(k=>triple.indexOf(k));
 return {n:source.n,total:group.n,missing:group.n-source.n,cells:source.cells.map(cell=>[cell[axes[0]],cell[axes[1]],cell[axes[2]],cell[3]])};
}
const api={project};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.QuestionnaireCrossModel=api;
})(typeof window!=='undefined'?window:this);
