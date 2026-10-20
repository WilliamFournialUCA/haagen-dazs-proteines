# Actualiser les résultats manuellement

Aucune automatisation n’est installée. Les graphiques utilisent uniquement `data/questionnaire.json`.

1. Dans le Google Sheet « Réponses au questionnaire », sélectionner l’onglet **Réponses** et télécharger son export CSV, sans renommer les en-têtes.
2. Depuis le dossier du site, lancer :

   `python scripts/build_questionnaire_data.py /chemin/vers/reponses.csv`

   Un TSV est également accepté. Le script utilise uniquement la bibliothèque standard de Python. Les réponses restent dans le fichier local ; seules les distributions, médianes, courbes et tables de contingence sont exportées.
3. Vérifier le nombre de réponses, les variantes et les exclusions dans la page, puis mettre à jour **uniquement** `data/questionnaire.json` dans GitHub. Ne pas ajouter le CSV/TSV de réponses au dépôt public.
4. GitHub Pages republiera le fichier. Aucun changement HTML/JavaScript n’est nécessaire pour intégrer les nouvelles réponses conformes au questionnaire actuel.

Les données agrégées peuvent refléter une seule personne dans un très petit groupe. La publication de ces petits effectifs a été demandée pour le suivi pédagogique. L’âge exact et l’horodatage individuel ne sont jamais exportés. Les cellules des croisements contiennent uniquement des effectifs.

## Colonnes attendues

`variant_grams`, `genre`, `age`, `csp`, `sport`, `culpabilite`, `frequence_glaces`, `proteines_habitude`, `prix_trop_bas`, `prix_bonne_affaire`, `prix_cher`, `prix_trop_cher`, `achat_499`, `achat_549`, `achat_599`, `retenu_proteines`, `protein_grams`, `intention_achat`.

La colonne d’horodatage peut être présente mais n’est pas publiée. Les noms, adresses ou autres nouvelles colonnes éventuelles ne sont pas repris.

Les comparaisons et interprétations sont descriptives. L’analyse du prix utilise les quadruplets complets, non négatifs et ordonnés. Le point d’égal rejet n’est publié qu’à partir de 30 quadruplets cohérents : seuil éditorial de prudence, sans garantie statistique. Les courbes emploient une interpolation linéaire entre les seuils observés ; l’intersection n’optimise ni profit ni ventes.
