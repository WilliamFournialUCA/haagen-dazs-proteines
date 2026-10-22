"""Regression checks for the 16 g / 48 g questionnaire and legacy responses."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_questionnaire_data import build, LEGACY_COLUMNS, CURRENT_COLUMNS, canonical_header
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

    def test_verified_shifted_export_preserves_question_meanings(self):
        new = row(16, "4 - D'accord")
        new.update(variant_condition='16 g de protéines et réduit en sucre',
                   genre='Un homme', sport='Rarement ou jamais')
        old = row(36)
        shifted = [new.get(k, '') for k in CURRENT_COLUMNS]
        values = [LEGACY_COLUMNS, [old.get(k, '') for k in LEGACY_COLUMNS], shifted]
        mapped = rows_from_values(values)
        d = build(mapped, LEGACY_COLUMNS)
        self.assertEqual(d['quality']['recovered_layout_rows'], 1)
        self.assertTrue(d['quality']['perception_data_available'])
        self.assertFalse(d['quality']['perception_column_present'])
        self.assertEqual(mapped[1]['genre'], 'Un homme')
        self.assertEqual(mapped[1]['sport'], 'Rarement ou jamais')
        self.assertEqual(mapped[1]['intention_achat'], '4')
        self.assertEqual(d['groups']['16']['prices']['medians'], [2,4,6,8])
        self.assertEqual(d['groups']['16']['memory']['correct'], 1)
        self.assertEqual(d['groups']['36']['n'], 1)
        self.assertEqual(d['groups']['16']['distributions']['perception_proteines']['counts'][3]['count'], 1)

    def test_realigned_headers_are_supported_without_recovery(self):
        new = row(48, "5 - Tout à fait d'accord")
        new['variant_condition'] = '48 g de protéines et réduit en sucre'
        d = build(rows_from_values([CURRENT_COLUMNS, [new.get(k, '') for k in CURRENT_COLUMNS]]), CURRENT_COLUMNS)
        self.assertEqual(d['quality']['recovered_layout_rows'], 0)
        self.assertTrue(d['quality']['perception_column_present'])
        self.assertEqual(d['groups']['48']['distributions']['perception_proteines']['counts'][4]['count'], 1)

    def test_unrecognized_or_incomplete_overflow_is_rejected(self):
        for cells in [[16]*21, ['',16,'16 g de protéines et réduit en sucre']+['']*17]:
            with self.assertRaises(ValueError):
                rows_from_values([LEGACY_COLUMNS, cells])

    def test_french_sheet_headers_preserve_all_answers(self):
        headers = ['Date et Heure','Variante','Variante du grammage','genre','Âge ',
                   'CSP','Activité physique','Culpabilité','Fréquence consommation glaces',
                   'Consommation produits protéinés','Prix_doute','Prix_bonne_affaire',
                   'Prix_cher_envisageable','Prix_trop_cher','Achat_4,99','Achat_549',
                   'Achat_5,99','Protéines retenues','Nombre de protéines saisi',
                   'Valeur protéinée forte','Achat_produit']
        self.assertEqual([canonical_header(h) for h in headers], CURRENT_COLUMNS)
        new = row(48, "5 - Tout à fait d'accord")
        new.update(genre='Une femme', sport='Plusieurs fois par semaine',
                   achat_499='Très élevée', achat_549='Élevée', achat_599='Faible')
        cells = [new.get(k,'') for k in CURRENT_COLUMNS]
        english = build(rows_from_values([CURRENT_COLUMNS,cells]),CURRENT_COLUMNS)
        french = build(rows_from_values([headers,cells]),headers)
        self.assertEqual(french['groups'], english['groups'])
        self.assertEqual(french['quality'], english['quality'])
        self.assertTrue(french['quality']['perception_column_present'])

    def test_header_accents_spacing_and_price_commas(self):
        self.assertEqual(canonical_header('  ACTIVITE PHYSIQUE  '),'sport')
        self.assertEqual(canonical_header('Achat_4,99'),'achat_499')
        self.assertEqual(canonical_header('prix-bonne-affaire'),'prix_bonne_affaire')
        self.assertEqual(canonical_header('unknown'),'unknown')

    def test_duplicate_aliases_remain_an_error(self):
        with self.assertRaisesRegex(ValueError,'dupliquées'):
            rows_from_values([CURRENT_COLUMNS+['Âge '], [48]*22])
        with self.assertRaisesRegex(ValueError,'Colonnes manquantes'):
            rows_from_values([['Variante'],[48]])

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
