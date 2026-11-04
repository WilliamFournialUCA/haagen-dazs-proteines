# Analyse du questionnaire — protocole du 4 novembre 2026

Page : `analyse-questionnaire.html`. Projet universitaire indépendant, sans affiliation
à Häagen-Dazs/General Mills. Règles exploratoires définies après observation de la
collecte ; aucune prétention de préenregistrement ou de détection certaine de fraude.

## Références consultées

Site complet publié : https://data.iae-mod.fr/index.html ; CM1, TD1, CM2, CM3,
TD2, CM4, CM5 et évaluation. Les séances de pratique n'ajoutent pas de tests.
Les TD annoncés mais sans page publiée ne sont pas anticipés.

- TD1 : https://data.iae-mod.fr/seances/seance-td-1.html
- CM2 : https://data.iae-mod.fr/seances/seance-cm-2.html
- CM3 : https://data.iae-mod.fr/seances/seance-cm-3.html
- Squelette consulté (non modifié) :
  https://github.com/VincentFavarin/analyse-projet-prix/tree/6deb7a41345b1f22abcd64fd46bc7cbfb25e57f1

Implémentation distincte adaptée à un site statique et au questionnaire réel :
`scripts/questionnaire_analysis.py`, calcul SciPy/NumPy. Les exemples fictifs du cours
ne sont jamais incorporés aux réponses réelles.

## Deux bases explicites

Le contrôle général `exclure_analyse` reste inchangé : voir
`controle-qualite-questionnaire.md`. Le Google Sheet est lu uniquement ; ni colonne,
ni ligne, ni format n'est écrit. Les données individuelles restent en mémoire.

L'analyse ne compare que les versions actuelles 16 g et 48 g. L'ancien concept 36 g
reste dans son propre groupe du tableau de bord, hors comparaison expérimentale.

La base « retenue » utilise toutes les réponses actuelles après contrôle général,
avec exclusion locale des prix incomplets/non numériques/négatifs/désordonnés.

La base « cohérence des prix » (par défaut sur la nouvelle page) retire dans l'ordre :

1. Quadruplets VW incomplets, négatifs ou non ordonnés ; égalités autorisées.
2. Réponses absentes/invalides à un des trois prix proposés.
3. Inversion « favorable après autre réponse » à un prix plus élevé, après recodage
   des deux modalités supérieures en favorable. Les catégories inférieures, dont
   « moyenne », ne sont pas des refus observés : c'est une convention déclarée.

Les remontées ordinales restant du même côté du seuil sont signalées par le contrôle
général mais ne retirent personne de cette base supplémentaire. Retraits séquentiels
sans double compte, effectifs par version et sensibilité entre les deux bases publiés.
Une incohérence de prix n'est pas une preuve de participation fictive.

Il n'y a pas de durée de réponse, identifiant fiable, question d'attention à réponse
imposée ou filtre M1 dans l'export : ces conditions sont non vérifiables. Aucun âge ou
métier ne devient un critère automatique d'exclusion. Aucune mauvaise mémorisation,
perception ou opinion négative n'est supprimée pour faciliter un résultat.

## Nature, descriptifs, tests

Les effectifs et pourcentages valides sont distincts des effectifs totaux. Manquants
non imputés. Les variables nominales n'ont pas de cumul ni moyenne de codes.
Les items 1–5 sont ordinaux ; le traitement métrique de leurs scores pour Welch est
un choix explicite suivant le cours, vérifié secondairement sur les rangs.

Descriptifs des prix cohérents : n, moyenne, médiane, ET (ddof=1), quartiles linéaires,
minimum, maximum, asymétrie corrigée, excès de kurtosis corrigé (normale : zéro).
Les observations hors Q1−1,5IQR / Q3+1,5IQR sont comptées, sans retrait automatique.
Chaque seuil a son propre comptage : ne pas les additionner comme des personnes.

Welch bilatéral compare 48 g moins 16 g. ddl de Satterthwaite, IC individuel 95 % de
la différence et d de Cohen à ET combiné pondéré publiés. Ce d diffère légèrement
de l'ET à variances moyennées du squelette. Au moins deux observations par groupe
et une variance d'erreur positive sont nécessaires. À moins de 30 par groupe,
signalement explicite : 30 est une convention de prudence, pas une normalité prouvée.
Mann–Whitney asymptotique bilatéral avec correction d'ex æquo et de continuité,
et effet bisériel de rang 2U/(n48*n16)−1 : sensibilité secondaire des scores.
Ce test vise les distributions et n'est pas automatiquement un test de médianes.

Contrôle de manipulation : score de richesse en protéines, indépendamment du rappel.
Attente théorique 48 > 16, test bilatéral séparé faute d'hypothèse préenregistrée.
Le verdict exige p<0,05 et direction attendue ; sinon différence inversée ou non
vérifiée. Ne jamais exclure les « échecs » individuels à ce contrôle. Les visuels et
l'instruction d'observation diffèrent aussi : effet du seul grammage non isolé.

Chi² de Pearson sans Yates : tableaux observés, minimum théorique, ddl et V de
Cramer. P non interprétée si une seule cellule théorique <5 (condition du cours).
Pas de fusion opportuniste de modalités ; pas de test si colonne constante ou
groupe vide. Le V reste descriptif même quand la condition du chi² échoue.

Familles de tests fixées, avec correction de Holm sur les p interprétables :

- Profils : genre, tranche d'âge, sport, consommation de glaces, habitudes protéinées.
- A/B : intention, quatre prix, trois probabilités recodées en favorable/autre.
- Liens : perception×intention, culpabilité×intention, sport×intention.

Les IC individuels ne sont pas corrigés pour la multiplicité. Les Mann–Whitney
secondaires ne produisent pas de décision automatique de significativité.
H0 non rejetée ne signifie ni équivalence ni absence d'effet ni recrutement validé.

Puissance pour d=0,2 et d=0,5 fixés : calcul exact via t non centrale à variances
égales, alpha=0,05 bilatéral, ddl=n48+n16−2, noncentralité=d/sqrt(1/n48+1/n16).
Approximation de planification pour Welch, sans correction de Holm. Ni puissance
observée utilisant l'effet estimé, ni garantie de représentativité.

Spearman sur paires complètes, ex æquo conservés ; sport recodé 1=rarement/jamais,
4=plusieurs fois par semaine. P asymptotique non affichée avant 30 paires (convention,
non garantie de justesse), rho non défini si variable constante. Liens non causaux.

## Prix

VW reprend exactement les courbes de l'agrégateur du tableau de bord, sur les seuils
observés en centimes et un point de fermeture. Pas de troncature au 97e percentile
contrairement à la grille illustrative du squelette. Intersections linéaires,
plateaux publiés comme plages : PMC trop bas/cher, OPP trop bas/trop cher,
IPP bonne affaire/cher, PME bonne affaire/trop cher. Au moins 30 quadruplets cohérents
pour publier les points, convention éditoriale déjà utilisée dans le tableau de bord.
Zone publiée uniquement si PMC.haut <= PME.bas. L'OPP n'optimise aucune marge.

Adaptation de GG, car la question demande cinq niveaux et non un oui/non. Top 2,
trois prix réellement proposés, même base complète aux trois prix ; pas de courbe
de demande interpolée. Prix*Taux est un indicateur TTC hypothétique, pas une recette
fabricant, pas des ventes prévues. Protocole à ordre croissant non assimilé à un
protocole GG aléatoire séquentiel classique. Les prix répétés ne sont pas des groupes
indépendants ; aucun test t indépendant ne les compare.

Simulation optionnelle côté navigateur : coût variable HT du même pot de 450 ml,
et coefficient de passage du prix TTC à la recette nette fabricant HT fournis par
l'utilisateur, sans défaut. Marge = (prix TTC*coefficient - coût variable HT)*taux.
Maximum parmi trois prix seulement ; hypothèses non conservées, pas de validation
commerciale. Le coût 400g du site n'est pas copié dans un format 450ml.

## Méthodes non appliquées

Pas d'échelle multi-items d'un même construit : pas d'alpha, CFA, CR, AVE ou HTMT.
Les probabilités à trois prix ne sont pas trois items équivalents à prix constant.
Pas d'ANOVA incluant une ancienne version de collecte. Pas de modèle structurel,
médiation ou régression multivariée automatique sans hypothèses, contrôles, mesures
et diagnostics justifiés. Les méthodes non adaptées sont expliquées, jamais inventées.

## Mise à jour, confidentialité, vérification

`build()` ajoute `analysis` au même `data/questionnaire.json`. Le workflow horaire
installe `requirements-questionnaire.txt`, exécute les tests, lit le Sheet privé,
calcule tous les agrégats et publie atomiquement un unique fichier. Une défaillance
conserve le dernier instantané. Le JSON ne contient aucune réponse brute, aucun
identifiant, empreinte individuelle, âge exact ou horodatage individuel.

Le lecteur `questionnaire-live.js` est commun aux deux pages : lecture sans cache
à l'ouverture, vérification chaque minute si la page est visible, relecture au retour
sur l'onglet. Les erreurs d'actualisation sont signalées, affichage précédent conservé.
Une synchronisation inchangée ne crée pas de commit pour sa seule date. Le premier
ajout de l'analyse conserve la date du même instantané déjà publié.

Tests : statistiques connues de Welch/chi², cellules théoriques insuffisantes,
IC et variances nulles, Holm, puissance, plateaux VW, effectifs séquentiels,
non-mutation des réponses, absence d'identifiants dans la sortie, compatibilité de
l'ancien tableau de bord et lecture commune des instantanés.
