"""Exact three-way counts must preserve dependencies and missing-value bases."""
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from questionnaire_threeway import build_threeway


LABELS={'variant':('Version',['16 g','48 g','36 g']),
        'x':('X',['0','1']),'y':('Y',['0','1']),'z':('Z',['0','1'])}


class ThreeWayTests(unittest.TestCase):
    def test_versions_missing_and_no_source_mutation(self):
        rows=[{'variant':'16 g','x':'0','y':'1','z':'1'},
              {'variant':'16 g','x':'0','y':'1','z':'1'},
              {'variant':'16 g','x':'1','y':'0','z':None},
              {'variant':'48 g','x':'1','y':'0','z':'0'},
              {'variant':'36 g','x':'0','y':'0','z':'0'}]
        before=json.dumps(rows);data=build_threeway(rows,LABELS)
        self.assertEqual(data['triples'],[['x','y','z']])
        self.assertEqual(data['groups']['16'],{'n':3,'tables':[{'n':2,'cells':[[0,1,1,2]]}]})
        self.assertEqual(data['groups']['48'],{'n':1,'tables':[{'n':1,'cells':[[1,0,0,1]]}]})
        self.assertEqual(json.dumps(rows),before)
        self.assertNotIn('variant',sum(data['triples'],[]))

    def test_pair_tables_cannot_determine_three_way_counts(self):
        even=[(0,0,0),(0,1,1),(1,0,1),(1,1,0)]
        odd=[(0,0,1),(0,1,0),(1,0,0),(1,1,1)]
        from collections import Counter
        for a,b in [(0,1),(0,2),(1,2)]:
            self.assertEqual(Counter((r[a],r[b]) for r in even),Counter((r[a],r[b]) for r in odd))
        def build(bits):return build_threeway([dict(variant='16 g',**dict(zip(['x','y','z'],map(str,r)))) for r in bits],LABELS)
        self.assertNotEqual(build(even)['groups']['16']['tables'],build(odd)['groups']['16']['tables'])

    def test_empty_versions_are_explicit(self):
        data=build_threeway([],LABELS)
        for version in ('16','48'):
            self.assertEqual(data['groups'][version],{'n':0,'tables':[{'n':0,'cells':[]}]})
        json.dumps(data,allow_nan=False)


if __name__=='__main__':unittest.main()
