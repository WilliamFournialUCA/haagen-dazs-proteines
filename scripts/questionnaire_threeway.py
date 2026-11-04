"""Aggregate all three-variable categorical tables for the two current concepts."""
from collections import Counter
from itertools import combinations


def build_threeway(rows,labels):
    keys=[k for k in labels if k!='variant']
    triples=list(combinations(keys,3))
    positions={key:i for i,key in enumerate(keys)}
    groups={}
    for version in ('16','48'):
        records=[r for r in rows if r['variant']==version+' g']
        encoded=[[labels[k][1].index(r[k]) if r[k] in labels[k][1] else None for k in keys] for r in records]
        tables=[]
        for triple in triples:
            indices=[positions[k] for k in triple]
            counts=Counter(tuple(row[i] for i in indices) for row in encoded if all(row[i] is not None for i in indices))
            tables.append({'n':sum(counts.values()),'cells':[[*values,n] for values,n in sorted(counts.items())]})
        groups[version]={'n':len(records),'tables':tables}
    return {'version':1,'triples':[list(t) for t in triples],'groups':groups}
