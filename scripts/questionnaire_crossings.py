"""Precomputed categorical segment aggregates for a static, private-source site.

No individual response vectors, IDs, dates, exact ages or exact prices are exported.
Six profile criteria can be combined with AND; displayed variables are independent
of those criteria. Reuse identical subsets privately to keep the public payload small.
"""
from collections import Counter, defaultdict
from itertools import combinations
import math

import numpy as np
from scipy import stats

FILTER_KEYS = ['genre','age_band','csp','sport','frequence_glaces','proteines_habitude']
REVERSE = {'sport','frequence_glaces','proteines_habitude'}
NOMINAL = {'variant','genre','csp','retenu_proteines'}
MIN_SEGMENT = 5


def pair_summary(records,x,y,options):
    pairs=Counter((options[x].index(r[x]),options[y].index(r[y]))
                  for r in records if r[x] in options[x] and r[y] in options[y])
    n=sum(pairs.values())
    result={'n':n,'cells':[], 'method':'Spearman' if x not in NOMINAL and y not in NOMINAL else 'Chi²',
            'effect':None,'p':None,'stat':None,'df':None,'min_expected':None,
            'status':'small'}
    if n<MIN_SEGMENT:
        return result
    result['cells']=[[a,b,count] for (a,b),count in sorted(pairs.items())]
    xs=sorted({a for a,b in pairs});ys=sorted({b for a,b in pairs})
    if min(len(xs),len(ys))<2:
        result['status']='constant';return result
    if result['method']=='Spearman':
        # Retain ties; higher rank means older/more frequent/higher score.
        values=[]
        for (a,b),count in pairs.items():
            av=len(options[x])-a if x in REVERSE else a+1
            bv=len(options[y])-b if y in REVERSE else b+1
            values.extend([(av,bv)]*count)
        rho,p=stats.spearmanr(np.asarray(values),axis=0)
        result['effect']=float(rho)
        result['status']='ok' if n>=30 else 'descriptive'
        if n>=30:result['p']=float(p)
    else:
        observed=[[pairs[a,b] for b in ys] for a in xs]
        chi,p,df,expected=stats.chi2_contingency(observed,correction=False)
        result.update({'stat':float(chi),'df':int(df),'min_expected':float(expected.min()),
                       'effect':math.sqrt(chi/(n*(min(len(xs),len(ys))-1))),
                       'status':'ok' if expected.min()>=5 else 'sparse'})
        if expected.min()>=5:result['p']=float(p)
    return result


def build_crossings(retained,strict,labels):
    options={k:v[1] for k,v in labels.items()}
    keys=list(labels)
    pair_keys=list(combinations(keys,2))
    pool=[];lookup={};segments={}
    for base,records in [('retained',retained),('strict',strict)]:
        segments[base]={}
        # Private indices only used to reuse equal subsets, never serialized.
        # Identity maps into retained; strict holds references to the same dicts.
        positions={id(r):i for i,r in enumerate(retained)}
        for concept in ('all','16','48'):
            groups=defaultdict(list)
            for r in records:
                if concept!='all' and r['variant']!=concept+' g':continue
                coordinates=[options[k].index(r[k]) if r[k] in options[k] else len(options[k]) for k in FILTER_KEYS]
                for mask in range(1<<len(FILTER_KEYS)):
                    key='&'.join(str(i)+'='+str(coordinates[i]) for i in range(len(FILTER_KEYS)) if mask&(1<<i)) or '*'
                    groups[key].append(r)
            groups.setdefault('*',[])
            index={}
            for key,subset in sorted(groups.items()):
                if key!='*' and len(subset)<MIN_SEGMENT:continue
                signature=tuple(positions[id(r)] for r in subset)
                if signature not in lookup:
                    lookup[signature]=len(pool)
                    pool.append({'n':len(subset),'pairs':[pair_summary(subset,x,y,options) for x,y in pair_keys]})
                index[key]=lookup[signature]
            segments[base][concept]=index
    return {'version':1,'min_segment_n':MIN_SEGMENT,'filter_keys':FILTER_KEYS,
            'reverse_order':sorted(REVERSE),'nominal':sorted(NOMINAL),
            'pairs':[list(p) for p in pair_keys],'segments':segments,'pool':pool}
