"""Regression checks for the 16 g / 48 g questionnaire and legacy responses."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_questionnaire_data import build
from sync_questionnaire import REQUIRED, rows_from_values, save_aggregates


def row(grams, perception=None):
    result = {'variant_grams': grams, 'age': 22, 'intention_achat': '4',
              'retenu_proteines': 'oui', 'protein_grams': grams,
              'prix_trop_bas': 2, 'prix_bonne_affaire': 4,
              'prix_cher': 6, 'prix_trop_cher': 8}
    if perception is not None:
        result['perception_proteines'] = perception
    return result


class QuestionnaireDataTests(unittest.TestCase):
    def test_variants_are_not_merged_and_recall_uses_assigned_grams(self):
        d = build([row(16), row(36), row(48)])
        self.assertEqual(d['schema_version'], 2)
        self.assertEqual(d['groups']['all']['n'], 3)
        for variant in ('16', '36', '48'):
            self.assertEqual(d['groups'][variant]['n'], 1)
            self.assertEqual(d['groups'][variant]['memory']['correct'], 1)

    def test_new_perception_values_and_missing_answers(self):
        d = build([row(16, "4 - D'accord"), row(48, "5 - Tout à fait d'accord"),
                   row(36), row(16, 'unexpected')])['groups']['all']
        p = d['distributions']['perception_proteines']
        self.assertEqual((p['n'], p['missing']), (2, 2))
        self.assertEqual([c['count'] for c in p['counts']], [0, 0, 0, 1, 1])
        self.assertEqual(d['cross']['perception_proteines|intention_achat']['n'], 2)
        self.assertEqual(d['cross']['variant|perception_proteines']['n'], 2)

    def test_empty_perception_does_not_mean_neutral_or_disagree(self):
        d = build([row(16)])
        self.assertFalse(d['quality']['perception_column_present'])
        self.assertEqual(d['groups']['16']['distributions']['perception_proteines']['n'], 0)
        self.assertEqual(d['groups']['48']['n'], 0)
        self.assertEqual(d['groups']['48']['prices']['medians'], [None]*4)

    def test_sheet_mapping_ignores_blank_and_personal_columns(self):
        headers = sorted(REQUIRED) + ['', '', 'perception_proteines', 'email']
        r = row(16, "3 - Ni d'accord ni en désaccord (ou Sans opinion)")
        values = [headers, [r.get(k, 'private@example.test' if k=='email' else '') for k in headers]]
        mapped = rows_from_values(values)
        self.assertNotIn('email', mapped[0])
        self.assertNotIn('', mapped[0])
        d = build(mapped, headers)
        self.assertTrue(d['quality']['perception_column_present'])
        self.assertEqual(d['groups']['all']['distributions']['perception_proteines']['counts'][2]['count'], 1)
        self.assertNotIn('private@example.test', json.dumps(d))

    def test_sync_idempotency_and_last_good_snapshot(self):
        headers = sorted(REQUIRED) + ['perception_proteines']
        r = row(16, '4')
        values = [headers, [r.get(k, '') for k in headers]]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'questionnaire.json'
            self.assertTrue(save_aggregates(values, path))
            previous = path.read_bytes()
            self.assertFalse(save_aggregates(values, path))
            self.assertEqual(path.read_bytes(), previous)
            with self.assertRaises(ValueError):
                save_aggregates([['invalid']], path)
            self.assertEqual(path.read_bytes(), previous)


if __name__ == '__main__':
    unittest.main()
