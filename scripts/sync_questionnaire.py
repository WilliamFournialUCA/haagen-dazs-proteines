"""Read the private Sheet in memory and publish aggregates only."""
import json
import os
from pathlib import Path
from urllib.parse import quote
from build_questionnaire_data import build, PRICE_KEYS

SHEET_ID = '1OYrRl9a1m4ecisvPufCnD8QVC_Vc8PwsiJupL_eqD7Y'
OUTPUT = Path(__file__).resolve().parents[1] / 'data/questionnaire.json'
REQUIRED = {'variant_grams', 'genre', 'age', 'csp', 'sport', 'culpabilite',
            'frequence_glaces', 'proteines_habitude', *PRICE_KEYS,
            'achat_499', 'achat_549', 'achat_599', 'retenu_proteines',
            'protein_grams', 'intention_achat'}
OPTIONAL = {'perception_proteines'}


def rows_from_values(values):
    if not isinstance(values, list) or not values or not isinstance(values[0], list):
        raise ValueError('En-têtes absents : aucune donnée publiée.')
    headers = [str(v).strip() for v in values[0]]
    if len([h for h in headers if h]) != len({h for h in headers if h}) or not REQUIRED <= set(headers):
        raise ValueError('Colonnes manquantes ou dupliquées : aucune donnée publiée.')
    rows = []
    for cells in values[1:]:
        if not isinstance(cells, list) or len(cells) > len(headers):
            raise ValueError('Structure de ligne invalide : aucune donnée publiée.')
        if any(str(v).strip() for v in cells):
            # Ignore any unrelated or identifying columns before aggregation.
            rows.append({key: cells[i] if i < len(cells) else ''
                         for i, key in enumerate(headers) if key in REQUIRED | OPTIONAL})
    return rows


def save_aggregates(values, output=OUTPUT):
    data = build(rows_from_values(values), values[0])
    if data['quality']['ignored_invalid_variant']:
        raise ValueError('Version de questionnaire inconnue : vérifier le Sheet avant publication.')
    data['manual_update'] = False
    data['refresh_interval_minutes'] = 60
    previous = json.loads(output.read_text()) if output.exists() else None
    if previous:
        # A timestamp alone must not generate a new commit every hour.
        comparable = lambda d: {k: v for k, v in d.items() if k != 'updated_at'}
        if comparable(previous) == comparable(data):
            return False
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    temporary.replace(output)
    return True


def main():
    secret = os.environ.get('GOOGLE_SHEETS_CREDENTIALS', '')
    if not secret:
        raise SystemExit('Secret GOOGLE_SHEETS_CREDENTIALS absent. Suivre docs/mise-a-jour-questionnaire.md ; le dernier instantané est conservé.')
    try:
        from google.oauth2.service_account import Credentials
        from google.auth.transport.requests import AuthorizedSession
        info = json.loads(secret)
        if info.get('type') != 'service_account' or info.get('token_uri') != 'https://oauth2.googleapis.com/token':
            raise ValueError('Configuration de compte de service invalide.')
        credentials = Credentials.from_service_account_info(
            info, scopes=['https://www.googleapis.com/auth/spreadsheets.readonly'])
        with AuthorizedSession(credentials) as session:
            response = session.get(
                f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/'
                + quote("'Réponses'", safe=''),
                params={'valueRenderOption': 'UNFORMATTED_VALUE'}, timeout=60)
            if response.status_code != 200:
                raise ValueError(f'Lecture Google Sheets refusée (HTTP {response.status_code}). Vérifier API activée et partage Lecteur.')
            changed = save_aggregates(response.json().get('values'))
    except Exception as error:
        # Never log response bodies, credentials or participant records.
        if isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError):
            message = str(error) if str(error).startswith(('En-têtes', 'Colonnes', 'Structure', 'Version', 'Configuration', 'Lecture')) else type(error).__name__
        else:
            message = type(error).__name__
        raise SystemExit(f'Échec de synchronisation : {message}. Dernières statistiques conservées.') from None
    print('Statistiques agrégées mises à jour.' if changed else 'Aucun changement des statistiques.')


if __name__ == '__main__':
    main()
