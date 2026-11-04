"""Numerical and policy checks for the course report (synthetic fixtures only)."""
import json
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from questionnaire_analysis import contingency, crosspoint, describe, holm, power, welch, build_analysis
from build_questionnaire_data import clean, group_stats


class AnalysisTests(unittest.TestCase):
    def test_welch_known_difference_ci_and_degenerate_samples(self):
        # Same dispersion, +1 shift; exact t=1 and Cohen d=1/sqrt(2.5).
        r=welch([2,3,4,5,6],[1,2,3,4,5],'fixture')
        self.assertAlmostEqual(r['stat'],1)
        self.assertAlmostEqual(r['effect'],1/math.sqrt(2.5))
        self.assertAlmostEqual(r['df'],8)
        self.assertAlmostEqual(r['p'],.3465935071,places=8)
        self.assertLess(r['ci'][0],0)
        self.assertGreater(r['ci'][1],0)
        self.assertEqual(r['status'],'small_sample')
        self.assertIsNone(welch([1],[2],'tiny')['p'])
        self.assertEqual(welch([2,2],[2,2],'constant')['status'],'constant')

    def test_chi_expected_condition_and_cramer(self):
        r=contingency(['yes']*30+['no']*20,['yes']*20+['no']*30,'fixture')
        self.assertAlmostEqual(r['stat'],4)
        self.assertAlmostEqual(r['p'],.0455002639,places=8)
        self.assertAlmostEqual(r['effect'],.2)
        self.assertEqual(r['min_expected'],25)
        sparse=contingency(['yes']*2+['no']*8,['yes']+['no']*9,'sparse')
        self.assertEqual(sparse['status'],'sparse')
        self.assertIsNone(sparse['p'])
        self.assertIsNotNone(sparse['effect'])

    def test_multiplicity_and_fixed_effect_planning(self):
        r=holm([{'p':.01},{'p':.04},{'p':.03},{'p':None}])
        self.assertEqual([x['p_adjusted'] for x in r],[.03,.06,.06,None])
        self.assertGreater(power(64,64,.5),.79)
        self.assertLess(power(64,64,.5),.81)
        self.assertIsNone(power(1,20,.5))

    def test_points_plateaus_no_crossing_and_descriptives(self):
        c=[{'price':1,'a':100,'b':0},{'price':2,'a':50,'b':50},
           {'price':3,'a':50,'b':50},{'price':4,'a':0,'b':100}]
        self.assertEqual(crosspoint(c,'a','b'),{'low':2,'high':3})
        self.assertIsNone(crosspoint(c[:1],'a','b'))
        d=describe([1,2,3,4,100]);self.assertEqual(d['median'],3)
        self.assertEqual(d['iqr_flags'],1)
        self.assertIsNone(describe([])['mean'])

    def test_course_base_is_separate_and_flow_no_double_count(self):
        def row(grams=16,prices=(1,3,5,8),buy=('Élevée','Faible','Très faible')):
            raw={'variant_grams':grams,'prix_trop_bas':prices[0],'prix_bonne_affaire':prices[1],
                 'prix_cher':prices[2],'prix_trop_cher':prices[3],'achat_499':buy[0],
                 'achat_549':buy[1],'achat_599':buy[2],'intention_achat':'3','perception_proteines':'4'}
            return clean(raw)
        records=[row(),row(48),row(prices=(4,2,5,8),buy=('Faible','Élevée','Faible')),
                 row(buy=('Faible','Élevée','Faible')),row(buy=('Faible','Moyenne','Faible')),row(36)]
        before=json.dumps(records,ensure_ascii=False)
        r=build_analysis(records,group_stats)
        self.assertEqual(r['bases']['retained']['n'],5)
        self.assertEqual(r['bases']['strict']['n'],3)
        self.assertEqual([x['removed'] for x in r['flow']],[0,1,1,0,1])
        self.assertEqual(json.dumps(records,ensure_ascii=False),before)
        public=json.dumps(r,ensure_ascii=False,allow_nan=False)
        self.assertNotIn('_submitted_at',public)
        self.assertNotIn('fingerprint',public)
        self.assertNotIn('protein_grams',public)
        self.assertIsNone(r['bases']['strict']['prices']['all']['points']['OPP'])
        self.assertEqual(r['bases']['strict']['prices']['all']['gg'][0]['n'],3)


if __name__=='__main__':unittest.main()
