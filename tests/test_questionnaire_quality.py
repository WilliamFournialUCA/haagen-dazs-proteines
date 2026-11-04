"""Checks that screening cannot silently discard unusual but valid opinions."""
import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_questionnaire_data import build
from questionnaire_quality import record_fingerprint, screen_records
from questionnaire_price_formats import restore_price_dates, column_letter
from test_questionnaire_data import row

POLICY={'version':1,'policy_date':'2026-11-04','manual_exclusions':{},'review_age_min':90,'review_price_above':100}

class QualityTests(unittest.TestCase):
    def test_manual_exclusion_is_exact_and_all_statistics_are_filtered(self):
        rejected=row(16,'5');rejected.update(age=98,csp='Ouvrier / Ouvrière',_submitted_at='synthetic-rejected')
        other=dict(rejected,_submitted_at='synthetic-other')
        policy=copy.deepcopy(POLICY);policy['manual_exclusions'][record_fingerprint(rejected)]={'reason':'manual_report'}
        d=build([rejected,other],quality_policy=policy)
        self.assertEqual(d['quality_control']['received'],2)
        self.assertEqual(d['quality_control']['excluded'],1)
        self.assertEqual(d['groups']['all']['n'],1)
        self.assertEqual(d['groups']['16']['distributions']['intention_achat']['n'],1)
        self.assertEqual(d['groups']['16']['cross']['perception_proteines|intention_achat']['n'],1)
        self.assertEqual(d['quality_control']['sensitivity']['all']['before']['n'],2)
        self.assertEqual(d['quality_control']['sensitivity']['all']['after']['n'],1)
        self.assertNotIn('synthetic-rejected',json.dumps(d))
        self.assertNotIn(record_fingerprint(rejected),json.dumps(d))
        self.assertEqual(build([other,rejected],quality_policy=policy)['groups'],d['groups'])

    def test_flags_are_not_proof_of_a_troll(self):
        unusual=row(48,'1');unusual.update(age=99,csp='Étudiant(e) ou élève',protein_grams=0,
           prix_trop_bas=80,prix_bonne_affaire=3,achat_499='Faible',achat_549='Élevée',achat_599='Très élevée')
        d=build([unusual],quality_policy=POLICY)
        self.assertEqual(d['quality_control']['excluded'],0)
        self.assertEqual(d['quality_control']['flagged_retained'],1)
        self.assertEqual(d['groups']['48']['n'],1)
        self.assertEqual(d['groups']['48']['prices']['n'],0)
        self.assertEqual(d['groups']['48']['memory']['correct'],0)

    def test_only_exact_copies_with_same_timestamp_are_removed(self):
        original=row(16);original['_submitted_at']='synthetic-original'
        d=build([original,dict(original),dict(original,_submitted_at='synthetic-different')],quality_policy=POLICY)
        self.assertEqual(d['quality_control']['excluded'],1)
        self.assertEqual(d['quality_control']['reasons'][1]['count'],1)
        self.assertEqual(d['groups']['all']['n'],2)
        self.assertEqual(build([row(16),row(16)],quality_policy=POLICY)['groups']['all']['n'],2)

    def test_date_format_is_restored_without_changing_source(self):
        values=[['prix'],[46144],[46297],[46144]]
        cells=[{'data':[{'startRow':1,'rowData':[{'values':[{'formattedValue':'2.5','effectiveFormat':{'numberFormat':{'type':'DATE','pattern':'d.m'}}}]},
          {'values':[{'formattedValue':'2.10','effectiveFormat':{'numberFormat':{'type':'DATE','pattern':'d.m'}}}]},
          {'values':[{'formattedValue':'46144','effectiveFormat':{'numberFormat':{'type':'NUMBER'}}}]}]}]}]
        restored,n=restore_price_dates(values,cells,[0])
        self.assertEqual(n,2)
        self.assertEqual(restored[1:],[ [2.5],[2.1],[46144]])
        self.assertEqual(values[1],[46144])
        self.assertEqual([column_letter(i) for i in [0,10,25,26]],['A','K','Z','AA'])

    def test_unknown_date_format_is_not_guessed(self):
        cell={'formattedValue':'02/05/2026','effectiveFormat':{'numberFormat':{'type':'DATE','pattern':'dd/mm/yyyy'}}}
        grid=[{'data':[{'startRow':1,'rowData':[{'values':[cell]}]}]}]
        with self.assertRaises(ValueError):restore_price_dates([['prix'],[46144]],grid,[0])
        cell['formattedValue']='5.2';cell['effectiveFormat']['numberFormat']['pattern']='d.m'
        with self.assertRaises(ValueError):restore_price_dates([['prix'],[46144]],grid,[0])

if __name__=='__main__':unittest.main()
