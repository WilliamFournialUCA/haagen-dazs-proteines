"""AND filters, statistical conditions and paired-publication integrity."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_questionnaire_data import LABELS, clean, group_stats
from questionnaire_crossings import build_crossings, pair_summary
from questionnaire_export import write_snapshot


class CrossingTests(unittest.TestCase):
    def records(self):
        rows=[]
        for i in range(12):
            r={key:options[0] for key,(_,options) in LABELS.items()}
            r.update(variant='16 g' if i%2==0 else '48 g',genre='Une femme' if i<8 else 'Un homme',
                     age_band='18–24 ans',csp='Étudiant(e) ou élève' if i<8 else 'Employé(e)',
                     sport=LABELS['sport'][1][0 if i<8 else 3],
                     intention_achat=str(i%5+1),perception_proteines=str((i+1)%5+1),
                     prices=[1,3,5,8],protein_grams=16)
            rows.append(r)
        return rows

    def test_all_six_filters_and_bases_concepts_and_minimum(self):
        rows=self.records();strict=rows[:6]+rows[8:10]
        original=json.dumps(rows,ensure_ascii=False)
        e=build_crossings(rows,strict,LABELS)
        def lookup(base,concept,key):
            idx=e['segments'][base][concept].get(key)
            return None if idx is None else e['pool'][idx]
        key='0=1&1=1&2=7&3=0&4=0&5=0'
        self.assertEqual(lookup('retained','all',key)['n'],8)
        self.assertEqual(lookup('strict','all',key)['n'],6)
        self.assertEqual(lookup('retained','all','*')['n'],12)
        self.assertEqual(lookup('strict','all','*')['n'],8)
        self.assertEqual(lookup('retained','16','*')['n'],6)
        self.assertIsNone(lookup('retained','16',key)) # four women, no false zero
        self.assertIsNone(lookup('retained','all','0=0')) # four men, same rule
        self.assertEqual(json.dumps(rows,ensure_ascii=False),original)
        self.assertEqual(len(e['pairs']),91)
        for payload in e['pool']:
            for r in payload['pairs']:
                if r['n']>=5:self.assertEqual(sum(c[2] for c in r['cells']),r['n'])
                else:self.assertEqual(r['cells'],[])
        exported=json.dumps(e,ensure_ascii=False,allow_nan=False)
        for forbidden in ['protein_grams','prices','_submitted_at','fingerprint','session_id']:
            self.assertNotIn(forbidden,exported)

    def test_aggregate_matches_existing_dashboard(self):
        rows=self.records();e=build_crossings(rows,rows,LABELS)
        p=e['pool'][e['segments']['retained']['all']['*']]
        i=e['pairs'].index(['sport','intention_achat']);r=p['pairs'][i]
        old=group_stats(rows)['cross']['sport|intention_achat']
        expected={(LABELS['sport'][1].index(a),LABELS['intention_achat'][1].index(b)):old['counts'][i][j]
                  for i,a in enumerate(old['rows']) for j,b in enumerate(old['columns']) if old['counts'][i][j]}
        self.assertEqual({(a,b):n for a,b,n in r['cells']},expected)

    def test_ordered_ranks_constant_sparse_and_missing(self):
        options={k:v[1] for k,v in LABELS.items()}
        rows=[{'sport':options['sport'][3-i//10],'intention_achat':str(i//10+1)} for i in range(40)]
        r=pair_summary(rows,'sport','intention_achat',options)
        self.assertAlmostEqual(r['effect'],1)
        self.assertLess(r['p'],1e-100)
        r=pair_summary(rows[:20],'sport','intention_achat',options)
        self.assertEqual(r['status'],'descriptive');self.assertIsNone(r['p'])
        constant=pair_summary([{'sport':options['sport'][0],'intention_achat':'1'}]*8,'sport','intention_achat',options)
        self.assertEqual(constant['status'],'constant')
        sparse=pair_summary([{'genre':options['genre'][i%2],'intention_achat':str(i%2+1)} for i in range(8)],'genre','intention_achat',options)
        self.assertEqual(sparse['status'],'sparse');self.assertIsNone(sparse['p'])
        missing=pair_summary([{'sport':None,'intention_achat':'1'}]*8,'sport','intention_achat',options)
        self.assertEqual(missing['n'],0);self.assertEqual(missing['cells'],[])

    def test_split_export_hash_idempotency_and_repair(self):
        rows=self.records();e=build_crossings(rows,rows,LABELS)
        def data(date):return {'updated_at':date,'analysis':{'explorer':e},'groups':{'all':{'n':12}}}
        with tempfile.TemporaryDirectory() as tmp:
            main=Path(tmp)/'questionnaire.json';extra=main.with_name('questionnaire-crossings.json')
            self.assertTrue(write_snapshot(data('first'),main))
            public=json.loads(main.read_text());meta=public['analysis']['explorer']
            self.assertNotIn('pool',meta)
            self.assertEqual(hashlib.sha256(extra.read_bytes()).hexdigest(),meta['sha256'])
            self.assertFalse(write_snapshot(data('second'),main))
            self.assertEqual(json.loads(main.read_text())['updated_at'],'first')
            extra.unlink();self.assertTrue(write_snapshot(data('third'),main))
            self.assertEqual(hashlib.sha256(extra.read_bytes()).hexdigest(),meta['sha256'])


if __name__=='__main__':unittest.main()
