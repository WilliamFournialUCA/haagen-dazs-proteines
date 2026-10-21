# Actualiser les résultats du questionnaire

## Synchronisation horaire (connexion Google à terminer)

Le workflow `.github/workflows/questionnaire-sync.yml` lit l’onglet **Réponses** toutes les heures (minute 17 UTC), recalcule les graphiques et croisements, puis demande explicitement un déploiement GitHub Pages. Les exécutions planifiées peuvent être retardées par GitHub. Le site continue à utiliser `data/questionnaire.json` : aucune donnée brute ou clé Google n’est envoyée au navigateur.

Le Google Sheet est privé. Une connexion initiale est nécessaire avant la première exécution réussie :

1. Dans [Google Cloud](https://console.cloud.google.com/), créer ou sélectionner un projet et activer **Google Sheets API**.
2. Créer un compte de service dédié, sans rôle IAM de projet et sans délégation de domaine. Créer une clé JSON pour ce compte de service. Ne jamais déposer cette clé dans le dépôt ou dans un message.
3. Dans le Google Sheet, partager uniquement ce fichier avec l’adresse `client_email` du compte de service, en rôle **Lecteur**. Conserver l’accès général actuel du fichier.
4. Dans [Settings → Secrets and variables → Actions](https://github.com/WilliamFournialUCA/haagen-dazs-proteines/settings/secrets/actions), ajouter un **Repository secret** nommé exactement `GOOGLE_SHEETS_CREDENTIALS`, contenant le JSON complet de la clé. Le périmètre API du script est `spreadsheets.readonly`.
5. Ouvrir [Actions → Actualiser les résultats du questionnaire](https://github.com/WilliamFournialUCA/haagen-dazs-proteines/actions/workflows/questionnaire-sync.yml), choisir **Run workflow** sur `main`. Vérifier que toutes les étapes passent, puis que le déploiement Pages aboutit et que la page affiche « synchronisation horaire » avec le bon effectif.

Le dépôt utilise GitHub Pages depuis la branche `main`, à la racine. Le workflow conserve ce mode et demande une construction via l’API Pages : un commit avec `GITHUB_TOKEN` ne déclenche pas à lui seul le déploiement habituel. Les permissions demandées sont `contents: write` pour le JSON agrégé et `pages: write` pour la demande de construction. Si une règle de branche interdit les commits du bot, le workflow échoue : il faut alors adapter le mode de publication, sans désactiver silencieusement cette règle.

Seul `data/questionnaire.json` peut être ajouté par le workflow. La lecture et les calculs restent en mémoire ; aucun CSV brut n’est conservé en artefact. Les colonnes inconnues sont ignorées. Des en-têtes manquants, des versions inconnues, une erreur réseau ou un refus Google interrompent la publication et conservent le dernier instantané. Les corrections et suppressions de réponses dans le Sheet sont aussi répercutées lors d’une lecture valide. Sans changement des statistiques, il n’y a aucun nouveau commit ; la date affichée reste celle du dernier changement, pas celle de la dernière tentative de lecture.

GitHub désactive les workflows planifiés des dépôts publics après une longue période sans activité (actuellement 60 jours) : les réactiver dans Actions si nécessaire. La rotation/révocation de la clé se fait dans Google Cloud et le secret GitHub doit être remplacé en conséquence.

Références techniques : [API Google Sheets](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get), [comptes de service](https://cloud.google.com/iam/docs/creating-managing-service-account-keys), [secrets GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions), [demande de construction Pages](https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build).

## Mise à jour manuelle de secours

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
