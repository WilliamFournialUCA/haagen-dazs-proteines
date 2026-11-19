/* Scénario pédagogique du 19 novembre 2026. En euros HT sauf mention contraire.
   Recalcul : node budget-lancement.js
   Les volumes, conditions commerciales et enveloppes marketing sont des hypothèses
   du groupe : aucun devis ni contrat Häagen-Dazs n'est utilisé. */
'use strict';

const { calculate } = require('./couts.js');

const plan = {
  stores: 2000,
  weeklySalesPerStore: 10,
  weeks: 50,
  shelfPriceTtc: 4.99,
  vat: 0.055, // BOFiP BOI-ANNX-000495 : pot familial non destiné à une consommation immédiate.
  retailShare: 0.30, // Part simulée du prix public HT, conditions commerciales nettes incluses.
  launchDevelopment: 60000, // H4 sur couts.html : alloué à la première année.
};

// Objectifs et plafonds proposés, à confirmer par devis ou par un test.
const marketing = [
  { label: 'Études et suivi', qty: 2, unit: 6000, detail: 'Deux vagues pour mesurer l’essai puis le réachat.' },
  { label: 'Création des supports', qty: 1, unit: 13000, detail: 'Un lot : photos, vidéos courtes et adaptation des supports rayon. Le pot lui-même est déjà budgété en production.' },
  { label: 'Médias numériques et enseignes', qty: 3, unit: 15000, detail: 'Trois vagues sur les réseaux sociaux et les supports numériques des enseignes.' },
  { label: 'Visibilité en rayon', qty: 500, unit: 40, detail: 'Kits de signalétique et leur mise en place dans 500 magasins du réseau.' },
  { label: 'Dégustations', qty: 100, unit: 400, detail: 'Une animation dans chacun de 100 magasins, personnel et échantillons inclus dans le forfait.' },
  { label: 'Réserve', qty: 1, unit: 20000, detail: 'Enveloppe mobilisable après lecture du test : réassort de supports ou deuxième vague locale.' },
].map(line => ({ ...line, total: line.qty * line.unit }));

const volume = plan.stores * plan.weeklySalesPerStore * plan.weeks;
const cost = calculate({ target: 12, kind: 'wpc', volume, loss: 2, shock: 0 });
const marketingBudget = marketing.reduce((sum, item) => sum + item.total, 0);
const costs = {
  materials: cost.raw * volume,
  transformationAndLosses: (cost.preLoss - cost.raw + cost.lossCost) * volume,
  packagingAndInbound: (cost.packageCost + cost.inbound) * volume,
  maintenanceAndQuality: cost.fixed.maintenance + cost.fixed.quality,
  development: plan.launchDevelopment,
  distribution: (cost.storage + cost.transport) * volume,
  admin: cost.fixed.admin,
  equipment: cost.fixed.equipment,
  marketing: marketingBudget,
};
const production = costs.materials + costs.transformationAndLosses
  + costs.packagingAndInbound + costs.maintenanceAndQuality + costs.development;
const fixed = cost.fixed.maintenance + cost.fixed.quality + cost.fixed.admin
  + plan.launchDevelopment + marketingBudget;
const budget = production + costs.distribution + costs.admin + costs.marketing + costs.equipment;
const shelfPriceHt = plan.shelfPriceTtc / (1 + plan.vat);
const factoryRevenue = shelfPriceHt * (1 - plan.retailShare);
const contribution = factoryRevenue - cost.variable;
const breakEven = Math.ceil(fixed / contribution);
const minFactoryRevenue = budget / volume;
const maxRetailShare = 1 - minFactoryRevenue / shelfPriceHt;

function scenario(label, { sold = volume, produced = sold, costIncrease = 0, retailShare = plan.retailShare } = {}) {
  const sales = sold * shelfPriceHt * (1 - retailShare);
  const expense = produced * cost.variable * (1 + costIncrease) + fixed;
  return { label, sold, produced, costIncrease, retailShare, sales, expense, result: sales - expense };
}
const cases = [
  scenario('Central'),
  scenario('Ventes inférieures', { sold: 600000 }),
  scenario('Coûts variables en hausse', { costIncrease: 0.15 }),
  scenario('Ventes et coûts dégradés', { sold: 600000, costIncrease: 0.15 }),
  scenario('Part enseigne plus élevée', { retailShare: 0.35 }),
];
// Exposition sur l'année si le premier programme industriel est engagé intégralement.
// Sans revente ni valeur de récupération retenue pour le stock restant.
const surplusStock = scenario('Production non ajustée', { sold: 600000, produced: volume });

const result = { plan, volume, cost, marketing, costs, production, fixed, budget, shelfPriceHt,
  factoryRevenue, contribution, breakEven, minFactoryRevenue, maxRetailShare, cases, surplusStock };
if (require.main === module) console.log(JSON.stringify(result, null, 2));
module.exports = result;
