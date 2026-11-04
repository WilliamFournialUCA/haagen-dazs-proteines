# Contrôle qualité des réponses au questionnaire

## Décision et périmètre

Protocole défini le 4 novembre 2026, après examen des données : il s’agit d’un traitement après collecte, pas d’un protocole préenregistré ni d’un détecteur validé de fraude. Le Sheet reste intégralement inchangé. La préparation du code a bénéficié d’une assistance IA ; les règles ci-dessous sont déterministes et les exclusions manuelles proviennent de l’équipe, pas d’un classement des répondants par un modèle.

Le lecteur crée en mémoire, pour chaque enregistrement, `exclure_analyse` (booléen), `motif_exclusion` et `motifs_signalement`. Seuls les dénombrements agrégés et des résumés de sensibilité sont publiés dans `quality_control` du JSON. Aucun dossier individuel, âge exact ou horodatage de participation n’est ajouté au site.

Tous les graphiques, les bases des pourcentages, les courbes, les commentaires, les comparaisons de concepts et les croisements utilisent les lignes dont `exclure_analyse` vaut faux. Une valeur absente reste manquante ; aucune opinion n’est imputée.

## Exclusions globales

- **Signalement manuel de l’équipe** : la participation explicitement désignée comme non fiable par l’équipe est écartée. Ce n’est pas une conclusion automatique à partir d’un âge ou d’une profession. L’exclusion est ciblée sur une empreinte SHA-256 du contenu normalisé et de son horodatage. Le registre `config/questionnaire-quality.json` en conserve la date et le motif, sans publier les réponses brutes. Corriger le contenu d’une participation modifie son empreinte et impose donc une nouvelle vérification de la décision. Aucun profil futur n’est écarté automatiquement par ressemblance avec ce cas.
- **Copie technique exacte** : après le premier exemplaire, un enregistrement ayant exactement la même empreinte, réponses et horodatage non vide est écarté. Des opinions identiques avec des horodatages différents restent comptées. Cela ne vérifie pas qu’une personne n’a répondu qu’une fois.

Les motifs d’exclusion sont exclusifs pour le bilan de flux : le signalement manuel est prioritaire sur une éventuelle copie technique. Le total collecté est toujours égal au total retenu plus le total exclu. Les types de questionnaire inconnus continuent à bloquer l’actualisation pour vérification, au lieu d’être reclassés arbitrairement.

## Signaux sans exclusion automatique

Conventions de vigilance de cette étude, ni seuils universels ni preuves de réponse fictive :

- âge déclaré à partir de 90 ans ; âge absent ou hors de l’intervalle du formulaire (1 à 120 ans) ;
- prix absents, non numériques, négatifs, non ordonnés, ou supérieur à 100 € par pot ;
- probabilité d’achat plus élevée à un prix supérieur ;
- au moins une réponse de fond absente ou invalide parmi culpabilité, habitudes, probabilités d’achat ou intention générale.

Les signaux peuvent se cumuler. Le nombre de personnes signalées est calculé séparément de la somme des motifs. Ces participations restent dans l’analyse. Une mauvaise mémorisation des grammes est une variable étudiée, pas un critère de nettoyage. Une opinion défavorable et l’uniformité sur quelques items ne sont pas assimilées à du sabotage. Aucun filtre « moins de 30 ans » ou de profession n’est appliqué après collecte.

Les quatre seuils de prix complets doivent rester ordonnés : trop bas ≤ bonne affaire ≤ cher ≤ trop cher. Un quadruplet invalide est exclu uniquement de l’analyse des prix, conformément à la méthode déjà utilisée, sans supprimer les autres réponses de cette personne.

## Prix transformés en dates dans le Sheet

Le contrôle a révélé que certaines saisies décimales étaient stockées comme dates avec un format Google Sheets `d.m`. Le lecteur conserve les valeurs brutes en mémoire, lit les métadonnées de format des seules colonnes de prix, puis restitue la décimale affichée uniquement si :

1. le type de format est DATE ou DATE_TIME et le motif est exactement `d.m` ;
2. le texte affiché comporte un jour et un mois séparés par un point ;
3. le jour et le mois correspondent à la date calculée à partir de la valeur sérielle stockée.

Par exemple, une cellule prix affichée `2.5` mais stockée comme une date correspondante redevient 2,50 € dans l’analyse. Une cellule contenant un vrai nombre élevé au format numérique n’est pas modifiée. Un format de date différent ou incohérent bloque la publication. Le nombre de cellules restituées est indiqué sur le site. Le Sheet n’est jamais réécrit. Les corrections techniques interviennent avant les indicateurs et les exclusions afin de ne pas qualifier de trolls des artefacts d’export.

## Sensibilité et limites

Le bas de page compare l’effectif, la proportion d’intentions favorables (scores 4 ou 5) et la médiane « bonne affaire » avant/après exclusions globales, pour l’ensemble et pour la version sélectionnée. Les deux bases bénéficient exactement de la même restitution des prix et des mêmes règles de valeurs manquantes. Cette comparaison isole l’effet du filtre, sans transformer un échantillon de convenance en échantillon représentatif.

Il n’existe ni durée de passation, ni contrôle d’attention dédié, ni identifiant de répondant fiable dans l’export utilisé. Les participations multiples d’une même personne et l’authenticité d’un profil ne sont pas établies. Le classement « à vérifier » reste une invitation à une revue humaine ; toute nouvelle exclusion doit être motivée et tracée.

## Références et vérification

- [AAPOR — Disclosure Standards](https://aapor.org/standards-and-ethics/disclosure-standards/) : déclarer les traitements, les règles de validité et les exclusions.
- [ESOMAR/GRBN — Online Sample Quality](https://shop.esomar.org/what-we-do/code-guidelines/esomargrbn-guideline-on-online-sample-quality) : validation, engagement et transparence des exclusions.
- [Google Sheets API — spreadsheets.get](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/get) : lecture ciblée des métadonnées de format.

Les références cadrent la transparence et le contrôle, sans prescrire les seuils éditoriaux choisis ici. Tests : `python -m unittest discover -s tests -v`.
