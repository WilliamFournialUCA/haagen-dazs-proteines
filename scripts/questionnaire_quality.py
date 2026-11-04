"""Deterministic response-quality flags; no source edits or respondent records exported."""
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

POLICY_PATH = Path(__file__).resolve().parents[1] / 'config/questionnaire-quality.json'
REASON_LABELS = {
    'manual_report': 'Exclusion manuelle sur signalement de l’équipe',
    'exact_duplicate': 'Copie technique exacte d’un enregistrement déjà présent',
}
FLAG_LABELS = {
    'age_atypical': 'Âge très atypique : vérification recommandée',
    'age_invalid': 'Âge absent ou hors des bornes du formulaire',
    'price_invalid': 'Prix incomplets, non numériques ou négatifs',
    'price_unordered': 'Seuils de prix dans un ordre incohérent',
    'price_extreme': 'Au moins un prix supérieur au seuil de vigilance',
    'purchase_increase': 'Intention à un prix supérieur plus élevée',
    'core_missing': 'Au moins une réponse de fond absente ou invalide',
}


def numeric(value):
    try:
        result = float(str(value).strip().replace(',', '.'))
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def load_policy():
    policy = json.loads(POLICY_PATH.read_text(encoding='utf-8'))
    if policy.get('version') != 1:
        raise ValueError('Configuration du contrôle qualité inconnue.')
    return policy


def record_fingerprint(raw):
    # Timestamp stays in memory only. Labels/cell positions do not enter the key.
    keys = ['variant_grams','genre','age','csp','sport','culpabilite',
            'frequence_glaces','proteines_habitude','prix_trop_bas','prix_bonne_affaire',
            'prix_cher','prix_trop_cher','achat_499','achat_549','achat_599',
            'retenu_proteines','protein_grams','perception_proteines','intention_achat']
    number_keys = {'variant_grams','age','culpabilite','prix_trop_bas',
                   'prix_bonne_affaire','prix_cher','prix_trop_cher','protein_grams','intention_achat'}
    values = [str(raw.get('_submitted_at', '')).strip()]
    for key in keys:
        value = str(raw.get(key, '')).strip().replace("'", '’')
        n = numeric(value) if key in number_keys else None
        values.append(format(n, '.12g') if n is not None else value)
    return hashlib.sha256(json.dumps(values, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def screen_records(raw_rows, cleaned_rows, policy=None):
    """exclure_analyse is a derived boolean, never written into the Sheet."""
    policy = load_policy() if policy is None else policy
    manual = policy.get('manual_exclusions', {})
    decisions = []
    seen = set()
    for raw, cleaned in zip(raw_rows, cleaned_rows):
        flags = []
        age = numeric(raw.get('age'))
        if age is None or not 1 <= age <= 120:
            flags.append('age_invalid')
        elif age >= policy.get('review_age_min', 90):
            flags.append('age_atypical')
        prices = cleaned['prices'] if cleaned else []
        if len(prices) != 4 or any(v is None or v < 0 for v in prices):
            flags.append('price_invalid')
        elif prices != sorted(prices):
            flags.append('price_unordered')
        if any(v is not None and v > policy.get('review_price_above', 100) for v in prices):
            flags.append('price_extreme')
        if cleaned:
            scale = ['Très faible','Faible','Moyenne','Élevée','Très élevée']
            purchase = [scale.index(cleaned[k]) if cleaned[k] in scale else None
                        for k in ['achat_499','achat_549','achat_599']]
            if all(v is not None for v in purchase) and purchase != sorted(purchase, reverse=True):
                flags.append('purchase_increase')
            if any(cleaned[k] is None for k in ['culpabilite','frequence_glaces',
                   'proteines_habitude','achat_499','achat_549','achat_599','intention_achat']):
                flags.append('core_missing')
        fingerprint = record_fingerprint(raw)
        reason = 'manual_report' if fingerprint in manual else None
        # Equal opinions are not duplicates. Require identical answers AND timestamp.
        if reason is None and str(raw.get('_submitted_at', '')).strip() and fingerprint in seen:
            reason = 'exact_duplicate'
        seen.add(fingerprint)
        decisions.append({'exclure_analyse': reason is not None,
                          'motif_exclusion': reason, 'motifs_signalement': flags})
    return decisions


def quality_counts(decisions):
    reasons = Counter(d['motif_exclusion'] for d in decisions if d['exclure_analyse'])
    flags = Counter(flag for d in decisions if not d['exclure_analyse'] for flag in d['motifs_signalement'])
    return {'received': len(decisions), 'excluded': sum(reasons.values()),
            'retained': len(decisions)-sum(reasons.values()),
            'flagged_retained': sum(not d['exclure_analyse'] and bool(d['motifs_signalement']) for d in decisions),
            'reasons': [{'key': key, 'label': label, 'count': reasons[key]} for key,label in REASON_LABELS.items()],
            'flags': [{'key': key, 'label': label, 'count': flags[key]} for key,label in FLAG_LABELS.items()]}
