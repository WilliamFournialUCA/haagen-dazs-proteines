"""Course-aligned analysis. Aggregate outputs only; no edits to source responses.

Independent implementation adapted to this questionnaire, following data.iae-mod.fr.
The standard dashboard base is preserved; a separately documented complete-price
base applies the course's price-consistency restrictions for sensitivity analysis.
"""
import math
import warnings
from collections import Counter

import numpy as np
from scipy import stats

PURCHASE = ['achat_499', 'achat_549', 'achat_599']
SCALE = ['Très faible', 'Faible', 'Moyenne', 'Élevée', 'Très élevée']
PRICE_NAMES = ['Prix suscitant un doute sur la qualité', 'Prix « bonne affaire »', 'Prix cher mais envisageable', 'Prix trop cher']


def finite(value):
    return float(value) if value is not None and math.isfinite(value) else None


def describe(values):
    x = np.asarray(values, dtype=float)
    if not len(x):
        return {'n': 0, **{k: None for k in ['mean','median','sd','q1','q3','min','max','skew','kurtosis','iqr_flags']}}
    q1, q3 = np.quantile(x, [.25, .75], method='linear')
    spread = q3-q1
    varied = len(x)>1 and np.ptp(x)>0
    return {'n':len(x), 'mean':float(x.mean()), 'median':float(np.median(x)),
            'sd':float(x.std(ddof=1)) if len(x)>1 else None, 'q1':float(q1), 'q3':float(q3),
            'min':float(x.min()), 'max':float(x.max()),
            'skew':finite(stats.skew(x, bias=False)) if varied and len(x)>=3 else None,
            'kurtosis':finite(stats.kurtosis(x, fisher=True, bias=False)) if varied and len(x)>=4 else None,
            'iqr_flags':int(np.sum((x<q1-1.5*spread)|(x>q3+1.5*spread)))}


def power(n_a, n_b, d):
    if min(n_a,n_b)<2:
        return None
    df=n_a+n_b-2
    critical=stats.t.ppf(.975,df)
    ncp=d/math.sqrt(1/n_a+1/n_b)
    return finite(stats.nct.sf(critical,df,ncp)+stats.nct.cdf(-critical,df,ncp))


def welch(a,b,label):
    a=np.asarray(a,dtype=float);b=np.asarray(b,dtype=float)
    out={'label':label,'method':'Welch','a':describe(a),'b':describe(b),
         'p':None,'stat':None,'df':None,'effect':None,'effect_name':'d de Cohen',
         'ci':None,'difference':None,'status':'insufficient','mw_p':None,'mw_effect':None,
         'power_medium':power(len(a),len(b),.5),'power_small':power(len(a),len(b),.2)}
    if min(len(a),len(b))<2:
        return out
    delta=float(a.mean()-b.mean());va=float(a.var(ddof=1));vb=float(b.var(ddof=1))
    out['difference']=delta
    pooled=((len(a)-1)*va+(len(b)-1)*vb)/(len(a)+len(b)-2)
    out['effect']=delta/math.sqrt(pooled) if pooled>0 else None
    if va/len(a)+vb/len(b)==0:
        out['status']='constant';return out
    with warnings.catch_warnings():
        warnings.simplefilter('ignore',RuntimeWarning)
        result=stats.ttest_ind(a,b,equal_var=False)
        mw=stats.mannwhitneyu(a,b,alternative='two-sided',method='asymptotic')
    se=math.sqrt(va/len(a)+vb/len(b))
    df=(va/len(a)+vb/len(b))**2/((va/len(a))**2/(len(a)-1)+(vb/len(b))**2/(len(b)-1))
    margin=float(stats.t.ppf(.975,df))*se
    out.update({'p':finite(result.pvalue),'stat':finite(result.statistic),'df':finite(df),
                'ci':[delta-margin,delta+margin],'status':'ok' if min(len(a),len(b))>=30 else 'small_sample',
                'mw_p':finite(mw.pvalue),'mw_effect':float(2*mw.statistic/(len(a)*len(b))-1)})
    return out


def contingency(a,b,label):
    categories=sorted(set(a)|set(b))
    table=[[Counter(x)[k] for k in categories] for x in (a,b)]
    out={'label':label,'method':'Chi²','n_a':len(a),'n_b':len(b),'categories':categories,
         'counts':table,'expected':None,'min_expected':None,'p':None,'stat':None,
         'df':None,'effect':None,'effect_name':'V de Cramer','status':'insufficient'}
    if not a or not b or len(categories)<2:
        return out
    chi,p,df,expected=stats.chi2_contingency(table,correction=False)
    out.update({'expected':expected.tolist(),'min_expected':float(expected.min()),
                'stat':float(chi),'df':int(df),'effect':float(math.sqrt(chi/(len(a)+len(b)))),
                'status':'ok' if expected.min()>=5 else 'sparse'})
    # Course condition: ALL expected cells >=5. Do not interpret an invalid p.
    if expected.min()>=5:
        out['p']=float(p)
    return out


def holm(tests):
    valid=sorted((r for r in tests if r.get('p') is not None),key=lambda r:r['p'])
    running=0
    for i,r in enumerate(valid):
        running=max(running,min(1,(len(valid)-i)*r['p']))
        r['p_adjusted']=running
    for r in tests:
        r.setdefault('p_adjusted',None)
    return tests


def crosspoint(curves,left,right):
    roots=[]
    for point in curves:
        if abs(point[left]-point[right])<1e-10:
            roots.append(point['price'])
    for a,b in zip(curves,curves[1:]):
        da=a[left]-a[right];db=b[left]-b[right]
        if da*db<0:
            roots.append(a['price']+(b['price']-a['price'])*da/(da-db))
    return {'low':min(roots),'high':max(roots)} if roots else None


def numeric(row,key):
    try:
        value=float(row.get(key))
        return value if math.isfinite(value) else None
    except (ValueError,TypeError):
        return None


def price_valid(row):
    p=row['prices']
    return all(v is not None and v>=0 for v in p) and p==sorted(p)


def prices_report(rows,group_stats):
    report={}
    for name,records in [('all',rows),('16',[r for r in rows if r['variant']=='16 g']),('48',[r for r in rows if r['variant']=='48 g'])]:
        g=group_stats(records);p=g['prices']
        points={name:crosspoint(p['curves'],a,b) if p['n']>=30 else None for name,a,b in [
            ('PMC','too_cheap','expensive'),('OPP','too_cheap','too_expensive'),
            ('IPP','bargain','expensive'),('PME','bargain','too_expensive')]}
        # Same people at all three prices: do not mix changing denominators.
        complete=[r for r in records if all(r[k] is not None for k in PURCHASE)]
        gg=[]
        for key,price in zip(PURCHASE,[4.99,5.49,5.99]):
            yes=sum(r[key] in SCALE[-2:] for r in complete)
            gg.append({'price':price,'n':len(complete),'yes':yes,
                       'revenue_proxy':price*yes/len(complete) if complete else None})
        report[name]={'n':len(records),'price_n':p['n'],'points':points,'curves':p['curves'],
                      'thresholds':[describe([r['prices'][i] for r in records if price_valid(r)]) for i in range(4)],'gg':gg}
    return report


def evaluate(rows,group_stats):
    a=[r for r in rows if r['variant']=='48 g'];b=[r for r in rows if r['variant']=='16 g']
    def values(records,key):
        return [v for r in records if (v:=numeric(r,key)) is not None]
    manipulation=welch(values(a,'perception_proteines'),values(b,'perception_proteines'),'Perception de la richesse en protéines (1–5)')
    outcomes=[welch(values(a,'intention_achat'),values(b,'intention_achat'),'Intention générale d’achat (1–5)')]
    for i,label in enumerate(PRICE_NAMES):
        outcomes.append(welch([r['prices'][i] for r in a if price_valid(r)],
                              [r['prices'][i] for r in b if price_valid(r)],label+' (€)'))
    for key,price in zip(PURCHASE,[4.99,5.49,5.99]):
        outcomes.append(contingency(['Favorable' if r[key] in SCALE[-2:] else 'Autre réponse' for r in a if r[key] is not None],
                                   ['Favorable' if r[key] in SCALE[-2:] else 'Autre réponse' for r in b if r[key] is not None],
                                   f'Achat favorable à {price:.2f} €'))
    profiles=[]
    for key,label in [('genre','Genre'),('age_band','Tranche d’âge'),('sport','Pratique sportive'),
                      ('frequence_glaces','Consommation de glaces'),('proteines_habitude','Habitudes protéinées')]:
        profiles.append(contingency([r[key] for r in a if r[key] is not None],
                                    [r[key] for r in b if r[key] is not None],label))
    associations=[]
    # Score ordering is explicit: sport recoded high=more frequent activity.
    for key,label in [('perception_proteines','Perception protéinée × intention'),('culpabilite','Culpabilité × intention'),('sport','Fréquence sportive × intention')]:
        pairs=[]
        for r in rows:
            x=None
            if key=='sport':
                options=['Plusieurs fois par semaine','Environ une fois par semaine','Moins d’une fois par semaine','Rarement ou jamais']
                x=4-options.index(r[key]) if r[key] in options else None
            else:
                x=numeric(r,key)
            y=numeric(r,'intention_achat')
            if x is not None and y is not None:pairs.append((x,y))
        result={'label':label,'n':len(pairs),'rho':None,'p':None}
        if len(pairs)>=3 and len(set(p[0] for p in pairs))>1 and len(set(p[1] for p in pairs))>1:
            rho,p=stats.spearmanr(np.array(pairs),axis=0)
            result['rho']=finite(rho)
            # Asymptotic p needs more observations: publish coefficient only below 30.
            if len(pairs)>=30:result['p']=finite(p)
        associations.append(result)
    return {'n':len(rows),'n_48':len(a),'n_16':len(b),'manipulation':manipulation,
            'outcomes':holm(outcomes),'profiles':holm(profiles),'associations':holm(associations),
            'prices':prices_report(rows,group_stats),
            'memory':{k:group_stats(v)['memory'] for k,v in [('16',b),('48',a)]},
            'distributions':group_stats(rows)['distributions']}


def build_analysis(rows,group_stats):
    current=[r for r in rows if r['variant'] in ('16 g','48 g')]
    valid_vw=[r for r in current if price_valid(r)]
    complete=[r for r in valid_vw if all(r[k] in SCALE for k in PURCHASE)]
    def inversion(row):
        binary=[int(row[k] in SCALE[-2:]) for k in PURCHASE]
        return any(b>a for a,b in zip(binary,binary[1:]))
    strict=[r for r in complete if not inversion(r)]
    return {'version':1,'policy_date':'2026-11-04','direction':'48 g moins 16 g',
            'flow':[{'label':'Base retenue sur la page Questionnaire','removed':0,'remaining':len(rows)},
                    {'label':'Ancienne version 36 g, hors comparaison actuelle','removed':len(rows)-len(current),'remaining':len(current)},
                    {'label':'VW : quatre seuils absents, négatifs ou désordonnés','removed':len(current)-len(valid_vw),'remaining':len(valid_vw)},
                    {'label':'Achat : au moins une des trois réponses absente','removed':len(valid_vw)-len(complete),'remaining':len(complete)},
                    {'label':'Achat : favorable à un prix après un prix inférieur non favorable','removed':len(complete)-len(strict),'remaining':len(strict)}],
            'bases':{'retained':evaluate(current,group_stats),'strict':evaluate(strict,group_stats)}}
