/* Écuyer 01 — La Grotte de Valombre
   Contenu narratif et règles spécifiques au livre.
   Le moteur commun ne contient aucune référence à Aldren, Gaspard ou Valombre. */
(function () {
  'use strict';

const ENEMIES = {
  shadowMass: {
    name: 'MASSE DANS L’OMBRE',
    maxHp: 6,
    force: 8,
    dexterity: 5
  },
  rochebrumeMissing: {
    name: 'DISPARU DE ROCHEBRUME',
    maxHp: 3,
    force: 3,
    dexterity: 8
  },
  bridgeWalker: {
    name: 'MARCHEUR SOUS LE PONT',
    maxHp: 5,
    force: 8,
    dexterity: 10
  },
  isletCrawler: {
    name: 'RAMPANT DE L’ÎLOT',
    maxHp: 12,
    force: 18,
    dexterity: 5
  },
  observationPrisoner: {
    name: 'CHEVALIER TRANSFORMÉ',
    maxHp: 8,
    force: 8,
    dexterity: 9
  },
  observationPrisonerCorridor: {
    name: 'CHEVALIER ENRAGÉ',
    maxHp: 8,
    force: 12,
    dexterity: 9
  },
  labyrinthWanderer: { name: 'ERRANT DU DÉDALE', maxHp: 8, force: 9, dexterity: 7 },
  labyrinthCaiman: { name: 'RAMPANT DE LA CORNICHE', maxHp: 7, force: 9, dexterity: 8 },
  reserveRat: { name: 'RAT DÉFORMÉ', maxHp: 6, force: 6, dexterity: 8, noContamination: true }
};

function roll2D6() {
  return [cryptoDie6(), cryptoDie6()];
}

function ensureCombats(state) {
  if (!state.combats || typeof state.combats !== 'object') state.combats = {};
}

function combatState(state, key, enemy) {
  ensureCombats(state);
  if (!state.combats[key] || typeof state.combats[key] !== 'object') {
    state.combats[key] = { hp: enemy.maxHp, round: 0, last: null, lastBlade: null };
  }
  const combat = state.combats[key];
  if (!Number.isFinite(combat.hp)) combat.hp = enemy.maxHp;
  combat.hp = Math.max(0, Math.min(enemy.maxHp, combat.hp));
  if (!Number.isInteger(combat.round)) combat.round = 0;
  return combat;
}

function forceDamageBonus(force) {
  return Math.max(1, Math.floor(Math.max(0, Number(force) || 0) / 4));
}

// Le bouclier encaisse avant les pièces d'armure déjà portées.
const PROTECTION_ITEMS = {
  bouclier_chevalier: { max: 6, name: 'Bouclier du chevalier' },
  casque_cabosse: { max: 2, name: 'Casque cabossé' },
  gantelet_veilleur: { max: 1, name: 'Gantelet de Veilleur' }
};

function shieldIsActive(state) {
  ensureProtectionState(state);
  return hasItem(state, 'bouclier_chevalier') &&
    Number(state.protectionItems.bouclier_chevalier?.remaining || 0) > 0;
}

function addKnightShield(state) {
  addProtectiveItem(state, 'bouclier_chevalier', 'Bouclier du chevalier',
    'Petit bouclier de métal : absorbe 6 dégâts au total. Dextérité −1 tant qu’il protège. Une fois brisé, il devient inutilisable et le malus disparaît.', 6);
  if (!state.flags || typeof state.flags !== 'object') state.flags = {};
  state.flags.knightShieldTaken = true;
}

function ensureProtectionState(state) {
  if (!state.protectionItems || typeof state.protectionItems !== 'object') state.protectionItems = {};
  Object.entries(PROTECTION_ITEMS).forEach(([id, def]) => {
    if (hasItem(state, id) && !state.protectionItems[id]) {
      state.protectionItems[id] = { max: def.max, remaining: def.max };
    }
  });
}

function addProtectiveItem(state, id, name, description, protection) {
  addItem(state, id, name, description, { protection });
  ensureProtectionState(state);
  if (!state.protectionItems[id]) state.protectionItems[id] = { max: protection, remaining: protection };
  state.protectionItems[id].max = protection;
  if (!Number.isFinite(state.protectionItems[id].remaining)) state.protectionItems[id].remaining = protection;
}

function removeProtectiveItem(state, id) {
  removeItem(state, id);
  ensureProtectionState(state);
  delete state.protectionItems[id];
}

function currentProtection(state) {
  ensureProtectionState(state);
  return Object.entries(PROTECTION_ITEMS).reduce((total, [id]) => {
    if (!hasItem(state, id)) return total;
    const source = state.protectionItems[id];
    return total + Math.max(0, Number(source && source.remaining) || 0);
  }, 0);
}

function maxProtection(state) {
  return Object.entries(PROTECTION_ITEMS).reduce((total, [id, def]) => total + (hasItem(state, id) ? def.max : 0), 0);
}

function applyDamage(state, amount) {
  ensureProtectionState(state);
  const incoming = Math.max(0, Math.floor(Number(amount) || 0));
  let remaining = incoming;
  let absorbed = 0;
  const before = currentProtection(state);
  const destroyedProtection = [];

  for (const id of Object.keys(PROTECTION_ITEMS)) {
    if (!hasItem(state, id) || remaining <= 0) continue;
    const source = state.protectionItems[id];
    const available = Math.max(0, Number(source && source.remaining) || 0);
    const used = Math.min(available, remaining);
    if (used > 0) {
      source.remaining -= used;
      remaining -= used;
      absorbed += used;
      if (available > 0 && source.remaining <= 0) {
        destroyedProtection.push(PROTECTION_ITEMS[id].name);
      }
    }
  }

  const hpLost = remaining;
  state.hp = Math.max(0, state.hp - hpLost);
  const result = {
    incoming,
    absorbed,
    hpLost,
    destroyedProtection,
    protectionBefore: before,
    protectionAfter: currentProtection(state),
    heroHp: state.hp
  };
  state.lastDamageResolution = result;
  return result;
}

function lakeTentacleDamageHtml(state, key) {
  if (!hasDamageRoll(state, key)) return '';
  const result = state.damageRollResults && state.damageRollResults[key];
  const broken = result && Array.isArray(result.destroyedProtection)
    ? result.destroyedProtection.map(name => `<p><strong>${name} est désormais trop endommagé pour te protéger.</strong> Tu le conserves dans ton inventaire, mais il est inutilisable.</p>`).join('')
    : '';
  return damageResultHtml(state, key) + broken;
}

function damageAbsorptionHtml(result) {
  if (!result) return '';
  let html = '';
  if (result.absorbed > 0 && result.hpLost > 0) {
    html = `<p><strong>Ta protection a absorbé ${result.absorbed} point${result.absorbed > 1 ? 's' : ''} de dégâts.</strong> Tu as perdu <strong>${result.hpLost}</strong> point${result.hpLost > 1 ? 's' : ''} de Vie.</p>`;
  } else if (result.absorbed > 0) {
    html = `<p><strong>Ta protection a entièrement absorbé le choc (${result.absorbed}).</strong> Tu n’as perdu aucun point de Vie.</p>`;
  } else {
    html = `<p><strong>Tu perds ${result.hpLost} point${result.hpLost > 1 ? 's' : ''} de Vie.</strong></p>`;
  }
  if (Array.isArray(result.destroyedProtection) && result.destroyedProtection.length) {
    html += result.destroyedProtection.map(name => `<p><strong>${name} est désormais trop endommagé pour te protéger.</strong> Tu le conserves dans ton inventaire, mais il est inutilisable.</p>`).join('');
  }
  return html;
}

function fightRound(state, key, enemy) {
  const combat = combatState(state, key, enemy);
  const heroDice = roll2D6();
  const enemyDice = roll2D6();
  const heroDexterity = currentDexterity(state);
  const enemyDexterity = enemy.dexterity;
  const heroAttack = heroDexterity + heroDice[0] + heroDice[1];
  const enemyAttack = enemyDexterity + enemyDice[0] + enemyDice[1];
  const heroWeaponPower = state.weapon && state.weapon !== 'none' ? combatPower(state) : 0;
  const heroForceBonus = forceDamageBonus(currentForce(state));
  const heroDamage = heroForceBonus + heroWeaponPower;
  const enemyWeaponPower = Number.isFinite(enemy.weaponPower) ? enemy.weaponPower : 0;
  const enemyForceBonus = forceDamageBonus(enemy.force);
  const enemyDamage = enemyForceBonus + enemyWeaponPower;

  let outcome = 'tie';
  let damage = 0;
  let protectionAbsorbed = 0;
  let hpLost = 0;
  let protectionBefore = currentProtection(state);
  let protectionAfter = protectionBefore;

  if (heroAttack > enemyAttack) {
    outcome = 'hero';
    damage = heroDamage;
    combat.hp = Math.max(0, combat.hp - damage);
  } else if (heroAttack < enemyAttack) {
    outcome = 'enemy';
    damage = enemyDamage;
    const resolution = applyDamage(state, damage);
    if (resolution.hpLost > 0 && !combat.contaminated && !enemy.noContamination) { raiseContamination(state, 1); combat.contaminated = true; }
    protectionAbsorbed = resolution.absorbed;
    hpLost = resolution.hpLost;
    protectionBefore = resolution.protectionBefore;
    protectionAfter = resolution.protectionAfter;
  }

  combat.round += 1;
  combat.last = {
    round: combat.round,
    heroDice,
    enemyDice,
    heroDexterity,
    enemyDexterity,
    heroAttack,
    enemyAttack,
    heroForce: currentForce(state),
    heroForceBonus,
    heroWeaponPower,
    heroDamage,
    enemyForce: enemy.force,
    enemyForceBonus,
    enemyWeaponPower,
    enemyDamage,
    damage,
    protectionAbsorbed,
    hpLost,
    protectionBefore,
    protectionAfter,
    outcome,
    heroHp: state.hp,
    enemyHp: combat.hp
  };
  state.lastCombatKey = key;
  state.lastCombatOutcome = outcome;
  combat.lastBlade = null;
  return combat.last;
}

function throwBladeAtEnemy(state, key, enemy) {
  if ((state.throwingBlades || 0) <= 0) return null;
  const combat = combatState(state, key, enemy);
  if (combat.hp <= 0) return null;
  state.throwingBlades -= 1;
  syncThrowingBlades(state);
  const success = roll3D6(state, 'Dextérité — lame de jet', currentDexterity(state));
  const before = combat.hp;
  combat.hp = Math.max(0, combat.hp - (success ? 2 : 0));
  combat.last = null;
  combat.lastBlade = {
    success, dice: [...state.lastDice], total: state.lastTotal, dexterity: state.lastStat,
    damage: before - combat.hp, enemyHp: combat.hp
  };
  state.lastCombatKey = key;
  state.lastCombatOutcome = 'throwing_blade';
  return combat.lastBlade;
}

function throwingBladeResultHtml(state, key, enemy) {
  const combat = combatState(state, key, enemy);
  if (!combat.lastBlade) return '';
  return `
    <div class="combat-roll-result">
      <div class="combat-roll-title">Lame de jet</div>
      <div class="combat-dice">${combat.lastBlade.dice.map(renderDie).join('')}</div>
      <p>Dextérité : ${combat.lastBlade.dexterity} · Dés : ${combat.lastBlade.total} (réussite si total ≤ Dextérité).</p>
      <div class="combat-outcome">${combat.lastBlade.success
        ? `<strong>La lame atteint sa cible.</strong> Tu infliges <strong>${combat.lastBlade.damage}</strong> point${combat.lastBlade.damage > 1 ? 's' : ''} de dégâts.`
        : '<strong>La lame manque sa cible.</strong> Aucun dégât.'}
        <br><strong>Tu restes hors de portée : aucune riposte sur ce lancer.</strong></div>
      <div class="combat-life-line">Lames restantes : <strong>${state.throwingBlades || 0}</strong> · Vie adverse : <strong>${combat.hp} / ${enemy.maxHp}</strong></div>
    </div>`;
}

const BLADE_RESULT_PAGES = { observationPrisonerCorridor:'c150', shadowMass:'c122', rochebrumeMissing:'c123', isletCrawler:'c124', bridgeWalker:'c125', observationPrisoner:'c126', labyrinthWanderer:'c154', labyrinthCaiman:'c162', reserveRat:'c193' };
function combatActionChoices(state, key, enemy, pageId, rollLabel = null) {
  const combat = combatState(state, key, enemy);
  if (combat.hp <= 0 || state.hp <= 0) return [];
  const list = [{
    label: rollLabel || (combat.round === 0 ? 'Lancer les dés de combat' : 'Continuer le combat'),
    to: pageId,
    effect: s => fightRound(s, key, enemy)
  }];
  if ((state.throwingBlades || 0) > 0) {
    const qty = state.throwingBlades || 0;
    list.push({
      label: `Lancer une lame de jet — ${qty} restante${qty > 1 ? 's' : ''} (jet de Dextérité, 2 dégâts si réussi, sans riposte)`,
      to: BLADE_RESULT_PAGES[key],
      effect: s => throwBladeAtEnemy(s, key, enemy)
    });
  }
  return list;
}

function enemyCardHtml(state, key, enemy) {
  const combat = combatState(state, key, enemy);
  return `
    <div class="enemy-card" aria-label="Fiche de l’adversaire">
      <div class="enemy-card-title">${enemy.name}</div>
      <div class="enemy-card-stats">
        <div><span class="enemy-icon">♥</span><span>Vie</span><strong>${combat.hp} / ${enemy.maxHp}</strong></div>
        <div><span class="enemy-icon">⚔</span><span>Force</span><strong>${enemy.force}</strong></div>
        <div><span class="enemy-icon">◆</span><span>Dextérité</span><strong>${enemy.dexterity}</strong></div>
        <div><span class="enemy-icon">⚔</span><span>Arme</span><strong>${enemy.weaponName || 'Aucune'}</strong></div>
        <div><span class="enemy-icon">✦</span><span>Dégâts</span><strong>${forceDamageBonus(enemy.force) + (Number.isFinite(enemy.weaponPower) ? enemy.weaponPower : 0)}</strong></div>
      </div>
    </div>`;
}

function combatRoundHtml(state, key, enemy) {
  const combat = combatState(state, key, enemy);
  const r = combat.last;
  if (!r) return '';

  const heroDamageDetail = r.heroWeaponPower > 0
    ? `Bonus de Force ${r.heroForceBonus} + Puissance de l’arme ${r.heroWeaponPower}`
    : `Bonus de Force ${r.heroForceBonus}`;
  const enemyDamageDetail = r.enemyWeaponPower > 0
    ? `Bonus de Force ${r.enemyForceBonus} + Puissance de l’arme ${r.enemyWeaponPower}`
    : `Bonus de Force ${r.enemyForceBonus}`;

  const outcomeText = r.outcome === 'hero'
    ? `<strong>Tu remportes l’échange.</strong><br>Tu infliges <strong>${r.damage}</strong> point${r.damage > 1 ? 's' : ''} de dégâts <span class="combat-detail">(${heroDamageDetail})</span>.`
    : r.outcome === 'enemy'
      ? (() => {
          const protectionLine = r.protectionAbsorbed > 0
            ? ` Ta protection a absorbé <strong>${r.protectionAbsorbed}</strong>${r.hpLost > 0 ? `, tu as perdu <strong>${r.hpLost}</strong> point${r.hpLost > 1 ? 's' : ''} de Vie.` : ', tu n’as perdu aucun point de Vie.'}`
            : ` Tu as perdu <strong>${r.hpLost}</strong> point${r.hpLost > 1 ? 's' : ''} de Vie.`;
          return `<strong>${enemy.name} remporte l’échange.</strong><br>Il inflige <strong>${r.damage}</strong> point${r.damage > 1 ? 's' : ''} de dégâts <span class="combat-detail">(${enemyDamageDetail})</span>.${protectionLine}`;
        })()
      : `<strong>Égalité.</strong><br>Les deux attaques se neutralisent. Aucun dégât.`;

  return `
    <div class="combat-roll-result">
      <div class="combat-roll-title">Échange n° ${r.round}</div>
      <div class="combat-roll-grid">
        <div class="combat-side">
          <strong>TOI</strong>
          <div class="combat-dice">${renderDie(r.heroDice[0])}${renderDie(r.heroDice[1])}</div>
          <p>Dextérité ${r.heroDexterity} + dés ${r.heroDice[0] + r.heroDice[1]}</p>
          <p class="combat-total">Attaque : <strong>${r.heroAttack}</strong></p>
        </div>
        <div class="combat-versus">VS</div>
        <div class="combat-side">
          <strong>${enemy.name}</strong>
          <div class="combat-dice">${renderDie(r.enemyDice[0])}${renderDie(r.enemyDice[1])}</div>
          <p>Dextérité ${r.enemyDexterity} + dés ${r.enemyDice[0] + r.enemyDice[1]}</p>
          <p class="combat-total">Attaque : <strong>${r.enemyAttack}</strong></p>
        </div>
      </div>
      <div class="combat-outcome">${outcomeText}</div>
      <div class="combat-life-line">Ta Vie : <strong>${state.hp} / ${state.maxHp}</strong> · Protection : <strong>${currentProtection(state)}</strong> · Vie adverse : <strong>${combat.hp} / ${enemy.maxHp}</strong></div>
    </div>`;
}

// Les défenses de la prison sont liées : la terre noire isole de l'appel,
// mais sa progression expose à la transformation. Pas de mort automatique au plafond
// tant que la suite du livre et son traitement définitif ne sont pas publiés.
function contaminationLevel(state) {
  return Math.max(0, Math.min(13, Number.isFinite(state.contamination) ? Math.floor(state.contamination) : (state.flags?.blackEarthContamination ? 2 : 0)));
}
function raiseContamination(state, amount = 1) {
  state.contamination = Math.min(13, contaminationLevel(state) + Math.max(0, amount));
  if (state.contamination >= 13) state.flags.blackEarthTransformed = true;
  state.flags.blackEarthContamination = state.contamination > 0;
}
// Le coffre derrière la grille est une prise de risque volontaire.
// Une seule exposition par partie, même si l’on revient lire les parchemins.
function exposeTabletGate(state) {
  if (!state.flags || typeof state.flags !== 'object') state.flags = {};
  // Une ancienne sauvegarde ayant déjà employé les gants ne reçoit pas une seconde exposition.
  if (state.flags.tabletsDustExposure || state.flags.tabletsGlovesUsed) return;
  state.flags.tabletsDustExposure = true;
  state.flags.tabletsExamined = true;
  raiseContamination(state, 2);
}
function blackEarthTreatment(state) {
  if (!hasItem(state, 'ampoule_blanche')) return;
  removeItem(state, 'ampoule_blanche');
  // Compatibilité : une ancienne ampoule du laboratoire n'efface pas les blessures du poignet.
  if (state.flags.labInjected) state.flags.labInjected = false;
  state.contamination = Math.max(0, contaminationLevel(state) - 4);
  state.flags.blackEarthContamination = state.contamination > 0;
  state.flags.usedWhiteAmpoule = true;
}
// Les ampoules sont des objets distincts : seule celle utilisée disparaît.
// L'ampoule du laboratoire conserve son traitement particulier ci-dessus.
function useWhiteAmpouleForContamination(state, id) {
  if (!hasItem(state, id) || contaminationLevel(state) <= 0) return false;
  removeItem(state, id);
  state.contamination = Math.max(0, contaminationLevel(state) - 4);
  state.flags.blackEarthContamination = state.contamination > 0;
  return true;
}
// V68.39 : le bras brisé ne peut se déclencher qu'une fois par aventure.
// Le test de Dextérité est résolu AVANT la découverte de la bague.
function triggerInjectionMechanism(s) {
  if (s.flags.labLeverBroken) return;
  const threshold = currentDexterity(s);
  const success = roll3D6(s, 'Dextérité', threshold);
  s.flags.labLeverBroken = true;
  s.flags.labLeverTried = true;
  s.flags.labLeverResultReady = true;
  s.flags.injectionDodged = success;
  s.flags.labLeverRoll = {
    success, dice: [...s.lastDice], total: s.lastTotal,
    stat: s.lastStat, rollCount: s.rollCount
  };
  if (!success) {
    s.hp = Math.max(0, s.hp - 1); // Aucune absorption par l'armure.
    raiseContamination(s, 2);
  }
}

function injectionRollHtml(s) {
  const r = s.flags.labLeverRoll;
  if (!r) return '';
  return `<div class="dice-result"><p class="roll-number">Épreuve de Dextérité</p><div class="dice-faces">${r.dice.map(renderDie).join('')}</div><p>Total : <strong>${r.total}</strong> · Seuil : <strong>${r.stat}</strong></p><p><strong>${r.success ? 'Réussite' : 'Échec'}</strong></p></div>`;
}

function reachForYoungKnight(s) {
  if (s.flags.youngKnightOutcome) return;
  const success = roll3D6(s, 'Dextérité', currentDexterity(s));
  s.flags.youngKnightOutcome = success ? 'defeated' : 'escaped';
  s.flags.youngKnightRoll = {
    success, dice: [...s.lastDice], total: s.lastTotal,
    stat: s.lastStat, rollCount: s.rollCount
  };
  if (!success) s.dexPenalty = (s.dexPenalty || 0) + 1;
}

function youngKnightRollHtml(s) {
  const r = s.flags.youngKnightRoll;
  if (!r) return '';
  return `<div class="dice-result"><p class="roll-number">Épreuve de Dextérité</p><div class="dice-faces">${r.dice.map(renderDie).join('')}</div><p>Total : <strong>${r.total}</strong> · Seuil : <strong>${r.stat}</strong></p><p><strong>${r.success ? 'Réussite' : 'Échec'}</strong></p></div>`;
}

// V68 : la contamination module ce qui est entendu, jamais un jet de résistance.
// Une décision du joueur n'est pas forcée par ce niveau.
// Dédale : la voix anticipe les pièges, mais ne protège jamais des combats.
function labyrinthVoiceTier(s) {
  const c = contaminationLevel(s);
  return c <= 3 ? 'clear' : c <= 8 ? 'faint' : 'silent';
}
function labyrinthTrap(s, key) {
  const tier = labyrinthVoiceTier(s);
  const success = tier === 'clear' ? true : roll3D6(s, 'Dextérité' + (tier === 'faint' ? ' (+1 grâce à la voix)' : ''), currentDexterity(s) + (tier === 'faint' ? 1 : 0));
  s.flags[key] = {
    tier, success,
    rollCount: tier === 'clear' ? null : s.rollCount,
    dice: tier === 'clear' ? null : [...s.lastDice],
    stat: tier === 'clear' ? null : s.lastStat,
    total: tier === 'clear' ? null : s.lastTotal,
    damaged: false
  };
  if (!success && !s.flags[key + 'DamageOnce']) {
    // Une chute coûte directement une Vie ; la protection d'armure ne prévient pas cette chute.
    s.hp = Math.max(0, s.hp - 1);
    s.flags[key + 'DamageOnce'] = true;
    s.flags[key].damaged = true;
  }
  return success;
}
function labyrinthTrapResult(s, key) {
  const r = s.flags[key];
  if (!r || r.tier === 'clear' || !Array.isArray(r.dice)) return '';
  return `<div class="dice-result"><p class="roll-number">Épreuve de Dextérité</p><div class="dice-faces">${r.dice.map(renderDie).join('')}</div><p>Total : <strong>${r.total}</strong> · Seuil : <strong>${r.stat}</strong></p><p><strong>${r.success ? 'Réussite' : 'Échec'}</strong></p></div>`;
}
function labyrinthTakeCorpseLoot(s) {
  if (s.flags.labyrinthCorpseLooted) return;
  s.flags.labyrinthCorpseLooted = true;
  addItem(s, 'potion_corniche', 'Potion de guérison — corniche', 'Restaure 1 dé de Vie. Trouvée dans la sacoche de la corniche.');
  s.throwingBlades = (s.throwingBlades || 0) + 3;
  syncThrowingBlades(s);
}
function labyrinthWomanGift(s) {
  if (s.flags.labyrinthWomanGiftTaken) return;
  s.flags.labyrinthWomanGiftTaken = true;
  addItem(s, 'ampoule_femme', 'Ampoule blanche — dédale', 'Usage unique : retire 4 points de terre noire, sans soigner les blessures.');
  addItem(s, 'terre_femme', 'Terre noire — dédale', 'Usage unique : ajoute 3 points de contamination. Risque de transformation à 13.');
  addItem(s, 'potion_femme', 'Potion de guérison — dédale', 'Restaure 1 dé de Vie.');
  addItem(s, 'epee_sorciere', 'Épée rouge du forgeron-sorcier', 'Puissance 8, Dextérité −1. Légère et très bien équilibrée.');
  s.weapon = 'sorcerer_sword';
}
function labyrinthUseWhite(s) {
  return useWhiteAmpouleForContamination(s, 'ampoule_femme');
}
function labyrinthUseEarth(s) {
  if (!hasItem(s, 'terre_femme')) return false;
  removeItem(s, 'terre_femme');
  raiseContamination(s, 3);
  return true;
}
function labyrinthHeal(s, id) {
  if (!hasItem(s, id) || s.hp >= s.maxHp) return false;
  const die = cryptoDie6();
  s.lastHealingDie = die;
  s.hp = Math.min(s.maxHp, s.hp + die);
  removeItem(s,id);
  return true;
}

function dormantPerception(state, location) {
  const earth = contaminationLevel(state);
  if (location === 'avenue') {
    if (earth <= 3) return `<p>Brutalement, un murmure te parvient. Tu ne sais pas s’il vient du fond de l’avenue ou s’il résonne directement dans ta tête.</p>
      <blockquote>« Libère-moi…<br>Les esprits… ceux qui errent dans la vallée… je pourrai les apaiser…<br>Celui que tu cherches… je peux te conduire… jusqu’à lui… »</blockquote>
      <p>Le murmure s’éteint.</p>`;
    if (earth <= 8) return `<p>Un murmure surgit sans que tu puisses en situer l’origine.</p>
      <blockquote>« Libère… les esprits… apaiser… celui que tu cherches… »</blockquote>
      <p>Sur une borne, l’œil fermé est accompagné d’une mise en garde : « NE PAS OUVRIR LA PRISON. » Le murmure s’interrompt.</p>`;
    return `<p>Aucune voix ne t'accompagne. Sur les bornes de pierre, les Veilleurs ont gravé l'œil fermé et cette mise en garde : « NE PAS OUVRIR LA PRISON. »</p>`;
  }
  if (location === 'service') {
    if (earth <= 3) return `<p>La présence revient tandis que tu progresses sous les étais.</p>
      <blockquote>« Ils avaient peur de moi. Ils m'ont laissé seul ici. Laisse-moi sortir. »</blockquote>
      <p>Une flèche gravée par les Veilleurs indique pourtant une autre direction : le passage de service.</p>`;
    if (earth <= 8) return `<p>Tu perçois une phrase incomplète : « Ils m'ont laissé… » Puis le silence revient. Sur la paroi, une inscription des Veilleurs avertit : « SA PAROLE N'EST PAS UN ORDRE. »</p>`;
    return `<p>Sur la paroi, une inscription des Veilleurs avertit : « SA PAROLE N'EST PAS UN ORDRE. » Le couloir demeure silencieux.</p>`;
  }
  return '';
}
function collectVeilleurBrassard(state) {
  if (state.flags.brassardPris || hasItem(state, 'brassard_veilleurs')) {
    state.flags.brassardPris = true;
    return false;
  }
  state.flags.brassardPris = true;
  addItem(state, 'brassard_veilleurs', 'Brassard des Veilleurs',
    'Un brassard sombre étonnamment léger une fois porté. +1 Force.');
  return true;
}
function equipVeilleurCollar(state) {
  if (state.flags.collarEquipped || state.flags.collarTorn) return;
  state.flags.collarEquipped = true;
  state.maxHp += 3;
  state.hp += 3;
  raiseContamination(state, 1); // La poudre entre sous la peau lors de la fixation.
  addItem(state, 'collier_vitalite', 'Collier de vitalité', 'Incrusté dans la peau : +3 Vie maximale et actuelle, −1 Dextérité, +1 contamination à la pose. L’arracher retire les 3 points supplémentaires et cause 1 blessure.');
}
const SENTINELS = { maxHp: 4, dexterity: 8, force: 4, name: 'SENTINELLE NOIRE' };
function ensureSentinels(state) {
  if (!state.sentinelFight || !Array.isArray(state.sentinelFight.hp))
    state.sentinelFight = { hp: [4, 4], round: 0, last: null };
  return state.sentinelFight;
}
function sentinelCardsHtml(state) {
  const f = ensureSentinels(state);
  return `<div class="enemy-card"><div class="enemy-card-title">DEUX SENTINELLES NOIRES</div><div class="enemy-card-stats"><div><span>Sentinelle 1</span><strong>${f.hp[0]}/4 Vie</strong></div><div><span>Sentinelle 2</span><strong>${f.hp[1]}/4 Vie</strong></div><div><span>Dextérité</span><strong>8 chacune</strong></div><div><span>Dégâts</span><strong>1 chacune</strong></div></div></div>`;
}
function sentinelRound(state, target, blade) {
  state.flags.sentinelResultAcknowledged = false;
  const f = ensureSentinels(state);
  if (state.hp <= 0 || f.hp.every(h => h <= 0) || f.hp[target] <= 0) return;
  if (blade && (state.throwingBlades || 0) <= 0) return;
  const report = [];
  let heroDice, heroScore, success = false;
  if (blade) {
    state.throwingBlades -= 1;
    syncThrowingBlades(state);
    success = roll3D6(state, 'Dextérité — lame de jet', currentDexterity(state));
    heroDice = [...state.lastDice];
    heroScore = state.lastTotal;
    const damage = success ? Math.min(2, f.hp[target]) : 0;
    f.hp[target] -= damage;
    report.push(success
      ? `Ta lame touche la sentinelle ${target + 1} : ${damage} dégâts.`
      : `Ta lame manque la sentinelle ${target + 1} : aucun dégât.`);
    report.push('Tu restes hors de portée. Aucune des sentinelles ne riposte pendant ce lancer.');
  } else {
    heroDice = roll2D6();
    heroScore = currentDexterity(state) + heroDice[0] + heroDice[1];
    const enemyDice = roll2D6();
    const enemyScore = SENTINELS.dexterity + enemyDice[0] + enemyDice[1];
    if (heroScore > enemyScore) {
      const damage = Math.min(f.hp[target], forceDamageBonus(currentForce(state)) + (state.weapon === 'none' ? 0 : combatPower(state)));
      f.hp[target] -= damage;
      report.push(`Tu touches la sentinelle ${target + 1} : ${damage} dégâts.`);
    } else if (heroScore < enemyScore) {
      const result = applyDamage(state, 1);
      if (result.hpLost > 0 && !f.contaminated) { raiseContamination(state, 1); f.contaminated = true; }
      report.push(`La sentinelle ${target + 1} te touche : ${result.absorbed} absorbé, ${result.hpLost} Vie perdue.`);
    } else report.push(`Tu pares la sentinelle ${target + 1} : égalité, aucun dégât.`);
    // Normal melee: the second sentinel gets an independent attack.
    for (let i = 0; i < 2; i++) {
      if (f.hp[i] <= 0 || i === target || state.hp <= 0) continue;
      const enemyDice = roll2D6();
      const enemyScore = SENTINELS.dexterity + enemyDice[0] + enemyDice[1];
      if (enemyScore > heroScore) {
        const result = applyDamage(state, 1);
        if (result.hpLost > 0 && !f.contaminated) { raiseContamination(state, 1); f.contaminated = true; }
        report.push(`La sentinelle ${i + 1} t'attaque : ${result.absorbed} absorbé, ${result.hpLost} Vie perdue.`);
      } else report.push(`Tu évites l'attaque de la sentinelle ${i + 1}.`);
    }
  }
  f.round++;
  f.last = { heroDice, heroScore, report, target, blade, success, bladeDexterity: blade ? state.lastStat : null, hp: [...f.hp], heroHp: state.hp };
}

function sentinelChoices(state) {
  const f = ensureSentinels(state);
  if (state.hp <= 0) return fatalChoices();
  if (f.hp.every(h => h <= 0)) return [{ label: 'Fouiller l’armurerie', to: 'c81' }];
  const choices = [];
  f.hp.forEach((hp, i) => {
    if (hp <= 0) return;
    choices.push({ label: `Attaquer la sentinelle ${i+1} à l’épée (${hp} Vie)`, to: i === 0 ? 'c132' : 'c134', effect: s => sentinelRound(s, i, false) });
    if ((state.throwingBlades || 0) > 0) choices.push({ label: `Lancer une lame sur la sentinelle ${i+1} (${state.throwingBlades} restantes)`, to: i === 0 ? 'c133' : 'c135', effect: s => sentinelRound(s, i, true) });
  });
  return choices;
}
function sentinelResultChoices(state) {
  const fight = ensureSentinels(state);
  if (state.hp <= 0) return fatalChoices();
  if (fight.hp.every(h => h <= 0)) return [{label:'Rejoindre l’armurerie',to:'c81'}];
  return [{label:'Poursuivre le combat',to:'c80'}];
}
function sentinelResultHtml(state) {
  const f = ensureSentinels(state);
  if (!f.last) return '';
  return `<div class="combat-roll-result"><div class="combat-roll-title">${f.last.blade ? 'Lame de jet' : `Échange n° ${f.round}`}</div><p>${f.last.blade ? `Jet de Dextérité : ${f.last.heroDice.join(' + ')} = ${f.last.heroScore} · Seuil : ${f.last.bladeDexterity}` : `Ton jet : ${f.last.heroDice.join(' + ')} · Attaque : ${f.last.heroScore}`}</p>${f.last.report.map(r=>`<p>${r}</p>`).join('')}<p><strong>Ta Vie : ${state.hp}/${state.maxHp}. Terre noire : ${contaminationLevel(state)}/13.</strong></p></div>`;
}

function heroGender(state) {
  return state.heroGender === 'male' ? 'male' : 'female';
}

function heroName(state) {
  return heroGender(state) === 'male' ? 'Aubin' : 'Aélis';
}

function heroRank(state) {
  return heroGender(state) === 'male'
    ? 'Écuyer de Sir Aldren de Rochebrune'
    : 'Écuyère de Sir Aldren de Rochebrune';
}

function heroPortraitFilename(state) {
  return heroGender(state) === 'male'
    ? 'La-Grotte-de-Valombre-Hero-Aubin.png'
    : 'La-Grotte-de-Valombre-Hero-Aelis.png';
}

function setHeroIdentity(state, gender) {
  state.heroGender = gender === 'male' ? 'male' : 'female';
  state.heroName = state.heroGender === 'male' ? 'Aubin' : 'Aélis';
}

// VERSION JOUEURS : une galerie déjà visitée ne peut pas être explorée de nouveau.
// Le flag couvre les nouvelles parties ; visited couvre également les sauvegardes existantes.
function campGalleryAvailable(state) { return !state.flags.galleryVisited && !state.flags.galleryAttempted && !state.visited?.c31; }
function campTunnelAvailable(state) { return true; }
function replayCombat(state, key) {
  if (state.combats && state.combats[key]) delete state.combats[key];
}
function replaySentinels(state) {
  delete state.sentinelFight;
  state.flags.sentinelResultAcknowledged = false;
}
function replayKnight(state, key, fate) {
  replayCombat(state, key);
  state.flags.knightFate = fate;
  state.flags.knightWellAttackDone = false;
  state.flags.knightBackstabDone = false;
}

function rememberCampJournalIfVisited(state) {
  // Laisser lire le journal si le joueur s'était d'abord dirigé vers une galerie.
  if (state.visited.c30) state.flags.campJournalRead = true;
}

const STORY = {
  start: {
    sheet: true,
    number: 'FICHE DU HÉROS',
    title: 'Choisis ton personnage',
    text: state => `
      <div class="hero-sheet">
        <div class="hero-selection-title">Qui veux-tu incarner ?</div>
        <div class="hero-selection-copy">Tu vivras la même aventure et disposeras des mêmes caractéristiques. Seuls ton identité et ton portrait changent.</div>

        <div class="hero-choice-grid">
          <label class="hero-choice-card ${heroGender(state) === 'female' ? 'selected' : ''}">
            <input class="hero-gender-input" type="radio" name="heroGenderChoice" value="female" ${heroGender(state) === 'female' ? 'checked' : ''}>
            <span class="hero-choice-portrait"><img src="./books/ecuyer/01-la-grotte-de-valombre/images/La-Grotte-de-Valombre-Hero-Aelis.png" alt="Portrait d’Aélis" onerror="this.parentElement.style.display='none'"></span>
            <span class="hero-choice-name">Aélis</span>
            <span class="hero-choice-rank">Écuyère de Sir Aldren de Rochebrune</span>
          </label>
          <label class="hero-choice-card ${heroGender(state) === 'male' ? 'selected' : ''}">
            <input class="hero-gender-input" type="radio" name="heroGenderChoice" value="male" ${heroGender(state) === 'male' ? 'checked' : ''}>
            <span class="hero-choice-portrait"><img src="./books/ecuyer/01-la-grotte-de-valombre/images/La-Grotte-de-Valombre-Hero-Aubin.png" alt="Portrait d’Aubin" onerror="this.parentElement.style.display='none'"></span>
            <span class="hero-choice-name">Aubin</span>
            <span class="hero-choice-rank">Écuyer de Sir Aldren de Rochebrune</span>
          </label>
        </div>

        <div class="hero-sheet-row"><span class="hero-label">Nom</span><span class="hero-value"><strong>${heroName(state)}</strong></span></div>
        <div class="hero-sheet-row"><span class="hero-label">Rang</span><span class="hero-value">${heroRank(state)}</span></div>
        <div class="hero-sheet-row"><span class="hero-label">Style</span><span class="hero-value">Vif, prudent et observateur</span></div>
        <div class="hero-sheet-row"><span class="hero-label">Technique de bataille</span><span class="hero-value">Esquive, déplacement rapide et contre-attaque</span></div>

        <div class="hero-sheet-grid">
          <div class="hero-stat"><strong>Vie</strong><span>${state.hp} / ${state.maxHp}</span></div>
          <div class="hero-stat"><strong>Protection</strong><span>${currentProtection(state)}</span></div>
          <div class="hero-stat"><strong>Force</strong><span>${currentForce(state)}</span></div>
          <div class="hero-stat"><strong>Dextérité</strong><span>${currentDexterity(state)}</span></div>
          ${contaminationLevel(state)>0 ? `<div class="hero-stat"><strong>Terre noire</strong><span>${contaminationLevel(state)}/13 · ${state.flags.physicianNotesRead ? contaminationLevel(state)>=9 ? "Danger" : contaminationLevel(state)>=4 ? "Équilibre précaire" : "Appel puissant" : "Effets inconnus"}</span></div>` : ""}
          <div class="hero-stat hero-stat-wide"><strong>Puissance de l’arme</strong><span>${state.weapon === 'none' ? 0 : combatPower(state)}</span></div>
        </div>

        <div class="hero-characteristics">
          <div class="hero-info-title">Tes caractéristiques</div>
          <p><strong>Vie :</strong> indique la santé du personnage. Lorsqu’elle atteint zéro, c’est la fin de votre aventure.</p>
          <p><strong>Protection :</strong> provient de certaines pièces d’équipement. Elle absorbe les dégâts avant la Vie et diminue lorsqu’elle encaisse un choc.</p>
          <p><strong>Force :</strong> représente sa puissance physique. Elle contribue aux dégâts infligés et permet de forcer, retenir ou briser ce qui barre la route.</p>
          ${state.flags.physicianNotesRead ? "<p><strong>Terre noire :</strong> 0–3 : appel puissant, 4–8 : équilibre précaire, 9–12 : transformation imminente, 13 : transformation définitive.</p>" : ""}
          <p><strong>Dextérité :</strong> représente son aisance et ses réflexes. Elle permet de prendre l’avantage au combat, mais aussi d’éviter pièges, chutes et autres dangers. Elle peut être affectée par ce qui est porté, par exemple une arme lourde.</p>
          <p><strong>Puissance de l’arme :</strong> valeur propre à l’arme équipée. Elle s’ajoute au bonus de Force lorsque le personnage remporte un échange.</p>
        </div>

        <div class="combat-rules-card">
          <div class="combat-rules-title">Règles des combats</div>
          <p><strong>Combats :</strong> personnage et adversaire lancent chacun 2 dés et ajoutent leur Dextérité.<br>Le meilleur score remporte l’échange.<br>En cas d’égalité, personne n’est blessé.<br>Le gagnant inflige son <strong>bonus de Force + la Puissance de son arme</strong> s’il en possède une.<br><span class="combat-detail">Bonus de Force = Force ÷ 4, arrondi à l’inférieur, avec un minimum de 1.</span></p>
        </div>

        <div class="hero-weapon">Au départ, tu ne portes encore aucune arme.</div>
        <div class="hero-characteristics" role="note">
          <div class="hero-info-title">Avant de commencer</div>
          <p>En bas de l’écran, tu peux consulter à tout moment ta fiche perso et ton inventaire. Tu y retrouveras tes caractéristiques, ton équipement et les objets découverts pendant l’aventure.</p>
        </div>
      </div>
    `,
    choices: [{ label: 'Commencer l’aventure', to: 'c0', effect: s => setHeroIdentity(s, heroGender(s)) }]
  },
  c0: {
    number: 'PAGE 0',
    title: 'Valombre',
    image: 'Le village oublié',
    text: state => `
      <p>Tu as toujours connu Valombre ainsi.</p>
      <p>Des maisons aux murs lézardés, des champs qui donnent juste assez pour passer l’hiver et des habitants qui comptent leurs pièces avant d’entrer chez le marchand.</p>
      <p>Les anciens assurent qu’il n’en a pas toujours été ainsi. Ils racontent qu’autrefois, Valombre prospérait. Ses artisans travaillaient pour les seigneurs des environs. Des marchands parcouraient ses routes et son nom était connu, admiré ou craint, bien au-delà de la vallée.</p>
      <p>Personne ne sait vraiment ce qui a changé. Les routes commerciales ont été abandonnées. Les familles les plus riches sont parties. Avec les générations, les récits de grandeur sont devenus des histoires qu’on raconte au coin du feu.</p>
      <p>Toi, tu n’as jamais connu cette époque. Depuis l’enfance, tu rêves de quitter Valombre, de parcourir le royaume et de découvrir ce qui existe au-delà de ces terres oubliées.</p>
      <p>La chevalerie t’a toujours semblé être le seul chemin possible.</p>
      <p>Lorsque Sir Aldren de Rochebrune t’a pris à son service comme ${heroGender(state) === 'male' ? 'écuyer' : 'écuyère'}, tu as cru tenir enfin ta chance. Tu as entretenu ses armes, soigné son cheval et appris tout ce que tu pouvais auprès de lui.</p>
      <p>Puis Aldren est parti seul vers la grotte qui domine la vallée. Il disait vouloir affronter une créature dont on parlait au village. Il t’a ordonné de rester.</p>
      <p>Trois jours ont passé.</p>
      <p>Ce matin, des sabots résonnent soudain au bout de la rue.</p>
    `,
    choices: [{ label: 'Rejoindre les écuries', to: 'c1' }]
  },

  c1: {
    number: 'PAGE 1',
    title: 'Les écuries de Valombre',
    image: 'Le cheval revenu seul',
    onEnter: s => equipHeavySword(s),
    text: state => `
      <p>Le cheval de <strong>Sir Aldren de Rochebrune</strong> apparaît au bout de la rue.</p>
      <p>Seul.</p>
      <p>De l’écume couvre son poitrail. La selle est entaillée. Du sang séché macule une sacoche.</p>
      <p>Aldren a disparu.</p>
      <p>Tu ne vas pas rester ici à attendre son retour.</p>
      <p>Contre le mur de l’écurie repose son ancienne épée.</p>
      <p>Tu l’as entretenue des centaines de fois. Aujourd’hui, tu la prends.</p>
      <p>Elle est lourde. Tu la soulèves à deux mains, puis la passes à ton côté.</p>
      <p>Tu regardes le chemin qui mène hors du village.</p>
      <p>Depuis l’enfance, tu rêves de partir. De découvrir le monde. De vivre autre chose que cette vie à Valombre.</p>
      <p>Cette fois, tu as une raison de le faire.</p>
      <p><strong>Tu vas retrouver Aldren.</strong></p>
      <p>Et rien ne te fera rester au village.</p>
    `,
    choices: [
      { label: 'Fouiller la sacoche de Sir Aldren', to: 'c2' },
      { label: 'Aller au village demander de l’aide', to: 'c3' },
      { label: 'Partir immédiatement vers la grotte', to: 'c8' }
    ]
  },

  c2: {
    number: 'PAGE 2',
    title: '',
    image: 'La sacoche de Sir Aldren',
    onEnter: s => {
      if (!s.flags.sacocheFouillee) {
        s.flags.sacocheFouillee = true;
        s.silver += 3;
        addItem(
          s,
          'parchemin',
          'Notes d’Aldren',
          'Une feuille couverte de mots griffonnés à la hâte par Sir Aldren. Elle peut être relue quand tu veux.'
        );
      }
    },
    text: state => `
      ${state.history?.filter(id => id === 'c2').length > 1
        ? '<p>Tu rouvres la sacoche d’Aldren. Les trois pièces et les notes ont déjà été récupérées, tu peux néanmoins relire le parchemin et revoir tes choix.</p>'
        : '<p>Tu ouvres la sacoche. À l’intérieur, tu trouves <strong>trois pièces d’argent</strong>, une petite <strong>fiole de liquide blanc</strong> et un morceau de parchemin plié plusieurs fois.</p>'}
      <p>Le papier est froissé, taché, presque déchiré par endroits. Certaines lignes ont été griffonnées si fort que la plume a failli percer la feuille.</p>
      <p>Tu le déplies. Ce n’est pas vraiment un message. Plutôt des notes jetées à la hâte, comme pour fixer des idées avant de les oublier.</p>

      <div class="parchment-verse">
        <strong>IL FAUT OUVRIR L’ŒIL FERMÉ</strong><br><br>
        <em>La lame noire. Trouver la lame noire.</em><br><br>
        <s>La terre noire…</s><br>
        <small>Ces mots sont barrés trois fois. Dans la marge, Aldren a ajouté : « ÉVITER ».</small><br><br>
        <strong>SOUFRE !!! ☠</strong><br>
        <small>Le mot est entouré trois fois de traits nerveux. Une tête de mort est dessinée à côté.</small>
      </div>

      <p>Les premières lignes ont été écrites avec une insistance presque fébrile. Les avertissements, eux, ne laissent guère de doute : Aldren voulait éviter la terre noire et le soufre.</p><p>Mais pourquoi voulait-il ouvrir cet œil fermé ?</p>
      ${state.history?.filter(id => id === 'c2').length > 1
        ? '<p>Tu refermes les notes et les remets avec tes affaires.</p>'
        : '<p>Tu replies soigneusement les notes et les ranges dans ton inventaire. Tu pourras les relire quand tu le souhaites.</p>'}
      ${hasItem(state,'fiole_rouge') || state.flags.fioleLaissee
        ? '<p>Tu peux revenir sur ce choix pour comparer les itinéraires, mais la fiole ne peut être récupérée qu’une fois.</p>'
        : '<p>La fiole blanche reste entre tes mains. Tu ignores encore à quoi elle sert.</p>'}
    `,
    choices: state => [
      { label: 'Prendre la fiole et aller au village', to: 'c118', effect: s => { if (!hasItem(s,'fiole_rouge') && !s.visited?.c118 && !s.visited?.c119) addItem(s,'fiole_rouge','Fiole inconnue — liquide blanc','Une fiole de liquide blanc opaque, trouvée dans la sacoche d’Aldren. Son utilité est inconnue.'); s.flags.fioleLaissee = false; updateVialKnowledge(s); } },
      { label: 'Prendre la fiole et partir vers les grottes', to: 'c119', effect: s => { if (!hasItem(s,'fiole_rouge') && !s.visited?.c118 && !s.visited?.c119) addItem(s,'fiole_rouge','Fiole inconnue — liquide blanc','Une fiole de liquide blanc opaque, trouvée dans la sacoche d’Aldren. Son utilité est inconnue.'); s.flags.fioleLaissee = false; updateVialKnowledge(s); } },
      { label: 'Laisser la fiole et aller au village', to: 'c3', effect: s => { removeItem(s,'fiole_rouge'); s.flags.fioleLaissee = true; } },
      { label: 'Laisser la fiole et partir vers les grottes', to: 'c8', effect: s => { removeItem(s,'fiole_rouge'); s.flags.fioleLaissee = true; } }
    ]
  },

  c3: {
    number: 'PAGE 3',
    title: 'La place de Valombre',
    image: 'La place de Valombre',
    text: state => {
      const merchantDone = !!(state.flags.merchantVisited || state.visited?.c4);
      const streetDone = !!(state.flags.valombreStreetVisited || state.visited?.c6 || state.visited?.c7);
      const details = [];
      if (!merchantDone) details.push('Le marchand se tient sous son auvent.');
      details.push('La forge donne toujours sur la place.');
      if (!streetDone) details.push('Une silhouette attend dans la ruelle.');
      return `
        <p>La place de Valombre est presque déserte. Les volets se ferment les uns après les autres.</p>
        <p>${details.join(' ')}</p>
        <p>Tu peux encore prendre le temps de faire ce qui te semble utile — ou quitter le village.</p>
      `;
    },
    choices: state => {
      const list = [];
      if (!state.flags.merchantVisited && !state.visited?.c4) list.push({ label: 'Voir le marchand', to: 'c4' });
      list.push({ label: 'Voir la forgeronne', to: 'c5' });
      if (!state.flags.valombreStreetVisited && !state.visited?.c6 && !state.visited?.c7) list.push({ label: 'Approcher la personne dans la ruelle', to: 'c6' });
      list.push({ label: 'Partir vers la grotte', to: 'c8' });
      return list;
    }
  },

  c4: {
    number: 'PAGE 4',
    title: '',
    noImage: true,
    image: 'Le marchand de Valombre',
    onEnter: s => { s.flags.merchantVisited = true; },
    text: state => {
      if (hasItem(state,'potion_guerison')) {
        return `
          <p>Le marchand reconnaît la potion qui dépasse de ton sac.</p>
          <blockquote>« Garde-la pour le moment où tu en auras vraiment besoin. »</blockquote>
        `;
      }
      if (state.silver >= 3) {
        return `
          <p>Le marchand t’écoute raconter le retour du cheval. Son visage devient grave.</p>
          <p>Il sort alors d’une petite caisse une fiole soigneusement bouchée.</p>
          <blockquote>« Une potion de guérison. Elle te rendra <strong>1 dé de Vie</strong>. Trois pièces d’argent. »</blockquote>
        `;
      }
      return `
        <p>Le marchand fouille rapidement ses étagères, puis secoue la tête.</p>
        <blockquote>« Sans argent, je ne peux rien faire pour toi, mon ami. »</blockquote>
      `;
    },
    choices: state => {
      if (!hasItem(state,'potion_guerison') && state.silver >= 3) {
        return [
          {
            label: 'Acheter la potion de guérison',
            to: 'c120',
            effect: s => {
              s.silver -= 3;
              addItem(
                s,
                'potion_guerison',
                'Potion de guérison',
                'Une potion achetée au marchand. Elle peut être utilisée à tout moment : lance un dé pour savoir combien de points de Vie tu récupères.'
              );
            }
          },
          { label: 'Ne rien acheter et repartir', to: 'c3' }
        ];
      }
      return [{ label: 'Retourner sur la place', to: 'c3' }];
    }
  },

  c5: {
    number: 'PAGE 5',
    title: 'La forge',
    image: 'La forgeronne de Valombre',
    onEnter: s => { s.flags.blacksmithVisited = true; },
    text: state => (state.history || []).filter(id => id === 'c5').length > 1 ? `
      <p>La forgeronne t’accueille d’un signe de tête. Les deux épées sont à ta disposition.</p>
      <p>« Alors, laquelle préfères-tu ? »</p>
      <p><strong>Épée lourde de Sir Aldren</strong> — Puissance : <strong>5</strong> · Dextérité de base avec cette arme : <strong>9</strong>.</p>
      <p><strong>Épée de la forgeronne</strong> — Puissance : <strong>2</strong> · Dextérité de base avec cette arme : <strong>12</strong>.</p>
    ` : `
      <p>La forgeronne lève immédiatement les yeux lorsque tu entres.</p>

      <blockquote>« Toi ? Où est Aldren ? »</blockquote>

      <p>Lorsqu’elle apprend ce qui s’est passé, son visage se ferme.</p>

      <p>Elle connaissait ton maître depuis des années.</p>

      <blockquote>« J’irais avec toi si je le pouvais. Mais ma jambe ne me mènerait même pas jusqu’au pied de la montagne. »</blockquote>

      <p>Son regard tombe alors sur l’ancienne épée de Sir Aldren.</p>

      <p>Elle sourit légèrement.</p>

      <blockquote>« Cette chose ? Aldren maniait ça comme une brindille. Toi, elle va te faire tomber avant ton adversaire. »</blockquote>

      <p>Elle disparaît dans l’arrière-boutique et revient avec une lame plus courte, parfaitement équilibrée.</p>

      <blockquote>« Je te propose un échange. Elle frappe moins fort… mais entre de bonnes mains, elle frappe beaucoup plus vite. »</blockquote>

      <p>Tu peux désormais choisir entre les deux armes.</p>
      <p><strong>Épée lourde de Sir Aldren</strong> — Puissance : <strong>5</strong> · Dextérité : <strong>9</strong>.</p>
      <p><strong>Épée de la forgeronne</strong> — Puissance : <strong>2</strong> · Dextérité : <strong>12</strong>.</p>
    `,
    choices: state => {
      if ((state.history || []).filter(id => id === 'c5').length > 1) {
        return [
          { label: 'Choisir l’épée lourde de Sir Aldren', to: 'c3', effect: s => { s.weapon = 'heavy'; } },
          { label: 'Choisir l’épée de la forgeronne', to: 'c3', effect: s => { s.weapon = 'light'; } }
        ];
      }
      return [
        {
          label: 'Accepter l’échange',
          to: 'c121',
          effect: s => { s.weapon = 'light'; }
        },
        {
          label: 'Garder l’épée lourde de Sir Aldren',
          to: 'c3',
          effect: s => { s.weapon = 'heavy'; }
        }
      ];
    }
  },

  c6: {
    number: 'PAGE 6',
    title: 'La ruelle',
    image: 'La silhouette dans la ruelle',
    onEnter: s => { s.flags.valombreStreetVisited = true; },
    text: `
      <p>Tu t’approches de la personne étrangement accoudée contre le mur.</p>
      <p>Elle semble parler seule, marmonnant quelque chose dans sa barbe. Sa silhouette est si maigre qu’elle paraît presque déformée.</p>
      <p>Plus tu avances, plus une odeur particulière devient nette.</p>
      <p><strong>Du soufre.</strong></p>
    `,
    choices: [
      { label: 'S’approcher encore davantage', to: 'c7' },
      { label: 'Repartir vers la place', to: 'c3' }
    ]
  },

  c7: {
    number: 'PAGE 7',
    title: '',
    image: 'Les yeux du fou',
    onEnter: s => { s.flags.avertissementSoufre = true; },
    text: `
      <p>Tu avances encore.</p>

      <p>La silhouette s’immobilise.</p>

      <p>Puis sa tête se tourne brusquement vers toi.</p>

      <p>Son visage est presque humain.</p>

      <p><em>Presque.</em></p>

      <p>Sa peau semble trop pâle. Ses joues trop creuses.</p>

      <p>Et ses yeux sont si largement ouverts que tu distingues le blanc tout autour de ses pupilles.</p>

      <p>Il recule contre le mur.</p>

      <blockquote>« Recule… »</blockquote>

      <p>Sa voix tremble.</p>

      <blockquote>« Recule si tu ne veux pas mourir… »</blockquote>

      <p>Il fixe quelque chose derrière toi.</p>

      <blockquote>« Ils arrivent. »</blockquote>

      <p>Puis il se met à rire.</p>

      <p>Un rire étouffé, presque douloureux.</p>

      <blockquote>« Vous ne voyez donc pas ? »</blockquote>

      <p>Son regard revient vers toi.</p>

      <blockquote><strong>« Ils arrivent… »</strong></blockquote>

      <p>Et soudain, quelque chose remue sous la peau de son cou.</p>
    `,
    choices: [
      { label: 'Reculer lentement et retourner sur la place', to: 'c3' },
      { label: 'Quitter Valombre et partir vers la grotte', to: 'c8' }
    ]
  },

  c8: {
    number: 'PAGE 8',
    title: 'Le chemin de la montagne',
    image: 'Le chemin de la montagne',
    text: `
      <p>Tu quittes Valombre.</p>

      <p>À mesure que tu t’éloignes du village, Valombre disparaît derrière les arbres.</p>
      <p>Devant toi, le chemin devient plus sauvage, plus silencieux.</p>

      <p>Le chemin monte lentement vers les collines.</p>

      <p>C’est alors que tu aperçois quelque chose sur le bas-côté.</p>

      <p>Un homme est étendu dans l’herbe.</p>

      <p>Quelques mètres plus loin, le chemin se divise.</p>

      <p>Le sentier principal continue de monter vers la montagne et l’entrée des grottes.</p>

      <p>L’autre chemin descend vers la forêt.</p>

      <p>Dans la boue, plusieurs <strong>traces de bottes</strong> s’éloignent dans cette direction.</p>
    `,
    choices: [
      { label: 'T’approcher du cadavre', to: 'c9' },
      { label: 'Continuer directement vers la grotte', to: 'c20' },
      { label: 'Suivre les traces de bottes vers la forêt', to: 'c14' }
    ]
  },

  c9: {
    number: 'PAGE 9',
    title: '',
    image: 'L’homme au bord du chemin',
    text: `
      <p>Tu t’approches lentement.</p>

      <p>À quelques pas du corps, tu reconnais les vêtements.</p>

      <p>Puis le visage.</p>

      <p>Ou plutôt ce qu’il en reste.</p>

      <p>C’est <strong>Gaspard Vellin</strong>, un marchand de Rochebrume, le village situé de l’autre côté de la forêt.</p>

      <p>Tu l’as déjà croisé plusieurs fois sur les marchés de Valombre. Un homme bruyant, toujours souriant, qui vendait aussi bien des étoffes que des outils ou des remèdes.</p>

      <p>Il est presque méconnaissable.</p>

      <p>Quelque chose semble avoir tiré ses traits vers le bas.</p>

      <p>Sa peau ne paraît ni brûlée, ni véritablement blessée. Pourtant son visage donne l’impression étrange d’avoir <strong>coulé autour de ses os</strong>, comme de la cire trop longtemps exposée à une flamme.</p>

      <p>Ses joues pendent mollement.</p>

      <p>Ses lèvres sont distendues.</p>

      <p>Et ses yeux, à demi ouverts, ne semblent plus regarder dans la même direction.</p>

      <p>Une odeur te parvient.</p>

      <p><strong>Du soufre.</strong></p>

      <p>Elle n’est pas seulement présente dans l’air.</p>

      <p>Elle paraît venir de lui.</p>

      <p>De ses vêtements.</p>

      <p>De sa peau.</p>

      <p>Peut-être même de l’intérieur de son corps.</p>

      <p>Tu te penches légèrement.</p>

      <p>Sa bouche est entrouverte.</p>

      <p>Quelque chose de noir emplit sa gorge.</p>

      <p>De la terre.</p>

      <p>Une terre sombre et humide, tassée entre ses dents jusque derrière sa langue.</p>

      <p>Pendant un instant, une pensée absurde te traverse : ce n’est peut-être pas de la terre qu’on lui a mise dans la bouche.</p>

      <p>Peut-être qu’elle est remontée de l’intérieur.</p>

      <p>Tu chasses immédiatement cette idée.</p>

      <p>Puis tu remarques sa main droite.</p>

      <p>Ses ongles sont cassés.</p>

      <p>Sous chacun d’eux se trouve la même terre noire.</p>

      <p>Comme s’il avait essayé de creuser quelque chose.</p>

      <p>Ou d’en sortir.</p>

      <p>Tu restes immobile.</p>

      <p>Tu ne saurais dire pourquoi, mais tu as soudain la certitude désagréable que <strong>Gaspard Vellin n’est peut-être pas mort</strong>.</p>
    `,
    choices: [
      { label: 'T’approcher encore et l’examiner', to: 'c10' },
      { label: 'T’éloigner et continuer vers la grotte', to: 'c20' },
      { label: 'Partir vers la forêt', to: 'c14' }
    ]
  },

  c10: {
    number: 'PAGE 10',
    title: '',
    noImage: true,
    image: 'Le dernier réflexe',
    text: `
      <p>Tu t’accroupis à côté de lui.</p>

      <p>Rien.</p>

      <p>Pas de respiration.</p>

      <p>Pas de mouvement.</p>

      <p>Tu avances lentement une main vers son cou.</p>

      <p>Ses doigts se referment brutalement autour de ton poignet.</p>

      <p>Tu étouffes un cri.</p>

      <p>Les yeux de Gaspard s’ouvrent entièrement.</p>

      <p>Ils sont injectés de sang.</p>

      <p>Mais ce n’est pas la douleur que tu y vois.</p>

      <p>C’est de la <strong>terreur</strong>.</p>

      <p>Une terreur si entière que, pendant une seconde, tu oublies même de dégager ton bras.</p>

      <p>Sa bouche s’entrouvre.</p>

      <p>La terre noire craque entre ses dents.</p>
    `,
    choices: [
      { label: 'Lui asséner un coup de pommeau avec ton épée', to: 'c11' },
      { label: 'Essayer de lui parler', to: 'c12' }
    ]
  },

  c11: {
    number: 'PAGE 11',
    title: '',
    noImage: true,
    image: 'Le coup',
    text: `
      <p>Tu tires brusquement ton bras et frappes.</p>

      <p>Le pommeau de ton épée heurte sa tempe.</p>

      <p>Le son qui accompagne le choc n’est pas celui auquel tu t’attendais.</p>

      <p>Ce n’est pas véritablement le craquement d’un os.</p>

      <p>C’est un bruit mat et sec.</p>

      <p>Comme une branche morte que l’on brise contre une pierre.</p>

      <p>Le crâne de Gaspard heurte le sol.</p>

      <p>Son corps se détend immédiatement.</p>

      <p>Quelque chose s’écoule lentement de son nez.</p>

      <p>Ce n’est pas du sang.</p>

      <p>La matière est noire, granuleuse.</p>

      <p>Elle ressemble encore à de la terre.</p>

      <p>Tu recules d’un pas.</p>

      <p>Il ne bouge plus.</p>
    `,
    choices: [
      { label: 'Fouiller le corps de Gaspard Vellin', to: 'c13' },
      { label: 'Continuer vers la grotte', to: 'c20' },
      { label: 'Partir vers la forêt', to: 'c14' }
    ]
  },

  c12: {
    number: 'PAGE 12',
    title: '',
    noImage: true,
    image: 'Une voix sous la terre',
    text: state => `
      <p>Tu maintiens son poignet.</p>

      <blockquote>« Gaspard ? »</blockquote>

      <p>Ses yeux bougent vers toi.</p>

      <blockquote>« Tu m’entends ? »</blockquote>

      <p>Ses lèvres tremblent.</p>

      <p>Pendant un instant, tu crois qu’il essaie réellement de répondre.</p>

      <p>Puis sa bouche s’ouvre brutalement.</p>

      <p>Un cri rauque et impossible s’en échappe.</p>

      <p>Avec lui, une gerbe de terre noire te frappe au visage.</p>

      <p>Tu lâches immédiatement son bras.</p>

      <p>La matière brûle ta peau.</p>

      <p>Tu fermes les yeux, mais trop tard.</p>

      <p>Des grains s’y sont glissés.</p>

      <p>La douleur est vive.</p>

      <p>Lorsque tu parviens enfin à rouvrir les yeux, Gaspard ne bouge plus.</p>

      <p>Sa tête est retombée lourdement en arrière.</p>

      <p>Son crâne a heurté un rocher.</p>

      <p>Cette fois, tu sais qu’il est mort.</p>

      <p>Ou du moins…</p>

      <p>tu ne vois plus rien qui ressemble encore à de la vie.</p>

      ${damageResultHtml(state, 'c12')}
    `,
    choices: state => {
      if (!hasDamageRoll(state, 'c12')) {
        return [{ label: 'Lancer le dé à 3 faces de blessure', action: 'damage', damageKey: 'c12', damageSides: 3 }];
      }
      if (state.hp <= 0) return fatalChoices();
      return [
        { label: 'Fouiller le corps', to: 'c13' },
        { label: 'Continuer vers la grotte', to: 'c20' },
        { label: 'Partir vers la forêt', to: 'c14' }
      ];
    }
  },

  c13: {
    number: 'PAGE 13',
    title: '',
    image: 'Les affaires de Gaspard Vellin',
    onEnter: s => {
      if (!s.flags.gaspardFouille) {
        s.flags.gaspardFouille = true;
        s.goldCoins += 3;
        addItem(
          s,
          'potion_sombre',
          'Fiole rouge sombre — inconnue',
          'Une fiole trouvée sur Gaspard, semblable à une potion de soin mais anormalement sombre. Effet inconnu.'
        );
        updateVialKnowledge(s);
      }
    },
    text: `
      <p>Tu fouilles rapidement ses vêtements.</p>

      <p>Dans une bourse, tu trouves :</p>

      <p><strong>3 pièces d’or.</strong></p>

      <p>Puis ta main rencontre une petite bouteille dans la doublure de son manteau.</p>

      <p>Tu la retires.</p>

      <p>La fiole ressemble à une potion de guérison.</p>

      <p>Tu en as déjà vu auparavant.</p>

      <p>Mais quelque chose t’inquiète.</p>

      <p>Le liquide devrait être rouge clair.</p>

      <p>Celui-ci est presque noir.</p>

      <p>Lorsque tu inclines la fiole, quelque chose semble flotter à l’intérieur.</p>

      <p>Tu regardes de plus près.</p>

      <p>Plus rien.</p>

      <p>Peut-être simplement un dépôt.</p>

      <p>Tu ranges néanmoins la fiole.</p>
    `,
    choices: [
      { label: 'Continuer vers la grotte', to: 'c20' },
      { label: 'Suivre les traces vers la forêt', to: 'c14' }
    ]
  },

  c14: {
    number: 'PAGE 14',
    title: 'La forêt de Rochebrume',
    image: 'La forêt de Rochebrume',
    text: `
      <p>Tu suis les traces de bottes.</p>

      <p>Le sentier descend rapidement entre les arbres.</p>

      <p>Tu connais cette forêt. Enfant, tu l’as traversée plusieurs fois pour rejoindre Rochebrume.</p>

      <p>Pourtant, ce soir, elle ne correspond plus tout à fait à ton souvenir.</p>

      <p>Les arbres paraissent trop proches les uns des autres. Leurs troncs se courbent selon des angles étranges, comme s’ils avaient lentement poussé autour de quelque chose enfoui sous la terre.</p>

      <p>Au-dessus de toi, les branches s’entrecroisent jusqu’à presque faire disparaître le ciel.</p>

      <p>Même les distances te troublent. Un arbre que tu crois proche semble reculer à mesure que tu avances.</p>

      <p>Tu continues sans t’attarder.</p>

      <p>Quelques minutes plus tard, les premières maisons de Rochebrume apparaissent enfin entre les troncs.</p>

      <p>Et là encore, quelque chose ne va pas.</p>
    `,
    choices: [{ label: 'Entrer dans Rochebrume', to: 'c15' }]
  },

  c15: {
    number: 'PAGE 15',
    title: 'Rochebrume',
    image: 'Rochebrume',
    text: state => {
      if (state.flags.strangerGone || state.visited?.c19) {
        return `
          <p>La rue de Rochebrume est toujours aussi vide.</p>
          <p>Au croisement, là où se tenait l’étranger, il n’y a plus personne.</p>
          ${!(state.flags.eliasVisited || state.visited?.c16) ? '<p>La taverne de Gaspard est encore ouverte.</p>' : '<p>Tu as déjà rencontré Élias. Plus rien ne te retient ici.</p>'}
        `;
      }
      if (state.flags.eliasVisited || state.visited?.c16) {
        return `
          <p>Le village est toujours désert.</p>
          <p>Tu as déjà parlé à Élias. Plus loin, la personne aperçue dans la rue est encore là.</p>
          <p>Rien d’autre ne semble devoir te retenir ici.</p>
        `;
      }
      return `
        <p>Le village est désert.</p>

        <p>Pas silencieux.</p>

        <p><strong>Désert.</strong></p>

        <p>Une porte est ouverte.</p>

        <p>Une brouette a été abandonnée au milieu de la rue.</p>

        <p>Du linge pend encore entre deux maisons.</p>

        <p>Sur une table, devant une habitation, une miche de pain a été laissée à moitié coupée.</p>

        <p>Comme si tous les habitants avaient simplement cessé ce qu’ils faisaient.</p>

        <p>Tu aperçois cependant deux signes de vie.</p>

        <p>La taverne de Gaspard Vellin est encore ouverte.</p>

        <p>Et plus loin, une personne se tient seule au milieu de la rue.</p>
      `;
    },
    choices: state => [
      ...(!(state.flags.eliasVisited || state.visited?.c16) ? [{ label: 'Entrer dans la taverne de Gaspard', to: 'c16' }] : []),
      ...(!(state.flags.strangerGone || state.visited?.c19) ? [{ label: 'Parler à la personne dans la rue', to: 'c19' }] : []),
      { label: 'Quitter Rochebrume et repartir vers la grotte', to: 'c20' }
    ]
  },

  c16: {
    number: 'PAGE 16',
    title: 'La taverne',
    noImage: true,
    image: 'La taverne de Rochebrume',
    onEnter: s => { s.flags.eliasVisited = true; },
    text: state => state.flags.gaspardDeathAnnounced ? `
      <p>Tu pousses de nouveau la porte de la taverne.</p>

      <p>Élias est toujours derrière le comptoir.</p>

      <p>Il a cessé de trembler, mais son visage s’est fermé.</p>

      <p>Lorsqu’il te voit revenir, il relève les yeux un instant.</p>

      <p>Il ne te demande rien.</p>

      <p>Le silence entre vous suffit.</p>
    ` : `
      <p>Tu pousses la porte.</p>

      <p>Un jeune homme lève immédiatement les yeux.</p>

      <p>Tu le reconnais vaguement.</p>

      <p>C’est <strong>Élias</strong>, l’assistant de Gaspard.</p>

      <p>Il sourit en te voyant.</p>

      <blockquote>« Ah ! Tu viens de Valombre ? »</blockquote>

      <p>Il regarde derrière toi.</p>

      <blockquote>« Tu n’aurais pas croisé Gaspard par hasard ? »</blockquote>

      <p>Ton estomac se noue.</p>

      <blockquote>« Il devait rentrer hier soir. »</blockquote>

      <p>Il hausse les épaules avec un sourire gêné.</p>

      <blockquote>« Avec lui, ça ne veut pas forcément dire grand-chose. Quand il trouve quelqu’un avec qui boire, il oublie parfois jusqu’au chemin de sa propre maison. »</blockquote>
    `,
    choices: state => [
      { label: 'Lui annoncer que Gaspard est mort', to: 'c17', effect: s => { s.flags.gaspardDeathAnnounced = true; } },
      { label: 'Ne rien lui dire', to: 'c18' }
    ]
  },

  c17: {
    number: 'PAGE 17',
    title: '',
    image: 'La nouvelle',
    onEnter: s => { s.flags.gaspardDeathAnnounced = true; },
    text: `
      <p>Tu lui expliques ce que tu as trouvé sur le chemin.</p>

      <p>À mesure que tu parles, le visage d’Élias se décompose.</p>

      <p>Il ne pose aucune question.</p>

      <p>Pas même sur la manière dont Gaspard est mort.</p>

      <p>Il s’assoit.</p>

      <p>Ses mains tremblent.</p>

      <blockquote>« Non… »</blockquote>

      <p>Puis plus bas :</p>

      <blockquote>« Pas lui aussi. »</blockquote>

      <p>Tu t’arrêtes.</p>

      <blockquote>« Lui aussi ? »</blockquote>

      <p>Élias relève brusquement les yeux.</p>

      <p>Pendant une fraction de seconde, tu crois voir autre chose que du chagrin.</p>

      <p>De la peur.</p>

      <blockquote>« Va-t’en. »</blockquote>

      <p>Tu hésites.</p>

      <blockquote>« Élias… »</blockquote>

      <blockquote>« S’il te plaît. Va-t’en. »</blockquote>

      <p>Il refuse désormais de répondre.</p>
    `,
    choices: [
      { label: 'Retourner dans la rue', to: 'c15' },
      { label: 'Quitter Rochebrume et repartir vers la grotte', to: 'c20' }
    ]
  },

  c18: {
    number: 'PAGE 18',
    title: '',
    image: 'Les lames d’Élias',
    text: state => state.flags.eliasBladesPurchased ? `
      <p>Élias enveloppe soigneusement les lames dans un morceau de cuir avant de te les tendre.</p>

      <blockquote>« Garde-les à portée de main. »</blockquote>

      <p>Tu possèdes maintenant <strong>${state.throwingBlades} lame${state.throwingBlades > 1 ? 's' : ''} de jet</strong>.</p>

      <p>Élias referme le tiroir. Il ne t’en proposera pas davantage.</p>
    ` : state.flags.gaspardDeathAnnounced ? `
      <p>Tu t’apprêtes à repartir.</p>

      <p>Le regard d’Élias tombe sur ton épée.</p>

      <blockquote>« Attends. »</blockquote>

      <p>Il hésite, puis ouvre un tiroir sous le comptoir.</p>

      <p>Plusieurs petites lames sont soigneusement alignées à l’intérieur.</p>

      <blockquote>« Gaspard gardait ça pour les voyageurs. »</blockquote>

      <blockquote>« Ça ne tue pas grand-chose, mais lancé au visage, ça peut te donner quelques secondes. »</blockquote>

      <p>Il garde les yeux sur les lames.</p>

      <blockquote>« Une pièce d’or la lame. »</blockquote>

      <p><strong>Tu possèdes ${state.goldCoins} pièce${state.goldCoins > 1 ? 's' : ''} d’or.</strong></p>
    ` : `
      <p>Tu ne lui dis rien.</p>

      <p>Élias soupire.</p>

      <blockquote>« Enfin… il reviendra bien. »</blockquote>

      <p>Son regard tombe sur ton épée.</p>

      <blockquote>« Tu vas vers la montagne ? »</blockquote>

      <p>Sans attendre ta réponse, il ouvre un tiroir sous le comptoir.</p>

      <p>Plusieurs petites lames sont soigneusement alignées à l’intérieur.</p>

      <blockquote>« Gaspard vend ça aux voyageurs. Ça ne tue pas grand-chose, mais lancé au visage, ça peut te donner quelques secondes. »</blockquote>

      <blockquote>« Une pièce d’or la lame. »</blockquote>

      <p><strong>Tu possèdes ${state.goldCoins} pièce${state.goldCoins > 1 ? 's' : ''} d’or.</strong></p>
    `,
    choices: state => {
      if (state.flags.eliasBladesPurchased) {
        return [
          { label: 'Retourner dans la rue', to: 'c15' },
          { label: 'Repartir vers la grotte', to: 'c20' }
        ];
      }

      const list = [];
      const maxBuy = Math.min(3, state.goldCoins);

      for (let qty = 1; qty <= maxBuy; qty++) {
        list.push({
          label: `Acheter ${qty} lame${qty > 1 ? 's' : ''} de jet — ${qty} pièce${qty > 1 ? 's' : ''} d’or`,
          stay: true,
          effect: s => {
            s.goldCoins -= qty;
            s.throwingBlades += qty;
            s.flags.eliasBladesPurchased = true;
            syncThrowingBlades(s);
          }
        });
      }

      list.push(
        { label: 'Ne rien acheter et retourner dans la rue', to: 'c15' },
        { label: 'Ne rien acheter et repartir vers la grotte', to: 'c20' }
      );

      return list;
    }
  },

  c19: {
    number: 'PAGE 19',
    title: '',
    image: 'L’étranger de Rochebrume',
    onEnter: s => { s.flags.strangerGone = true; },
    text: `
      <p>La personne se tient toujours au milieu de la rue.</p>

      <p>L’homme doit avoir une quarantaine d’années. Des cheveux sombres, une barbe de quelques jours, un manteau couvert de poussière.</p>

      <p>Rien chez lui ne paraît particulièrement remarquable.</p>

      <p>Pourtant, lorsque tu détournes les yeux une seconde, tu t’aperçois que tu serais incapable de décrire son visage.</p>

      <p>Tu le regardes de nouveau.</p>

      <p>Tout est là. Les yeux, le nez, la bouche.</p>

      <p>Mais dès que ton regard s’en éloigne, les détails disparaissent presque aussitôt de ta mémoire.</p>

      <p>Lui te regarde avec méfiance.</p>

      <p>Tu lui demandes où sont passés les habitants.</p>

      <p>Il hausse les épaules.</p>

      <blockquote>« Je n’en sais rien. »</blockquote>

      <p>Puis il observe les maisons.</p>

      <blockquote>« Ça a commencé il y a quelques jours. »</blockquote>

      <blockquote>« Les gens partent. Un par un. »</blockquote>

      <p>Tu lui demandes pourquoi.</p>

      <blockquote>« Certains disent qu’ils vont voir de la famille. D’autres ne disent rien du tout. »</blockquote>

      <p>Il hésite.</p>

      <blockquote>« Le plus étrange, c’est que personne ne semble vraiment s’en inquiéter. »</blockquote>

      <p>Tu regardes autour de toi.</p>

      <blockquote>« Et toi ? »</blockquote>

      <p>Il sourit faiblement.</p>

      <blockquote>« Moi ? Je ne suis que de passage. »</blockquote>

      <p>Puis son sourire disparaît.</p>

      <blockquote>« Mais je crois que je vais repartir plus tôt que prévu. »</blockquote>

      <p>L’homme te salue et s’éloigne.</p>

      <p>Tu le regardes tourner au coin d’une maison.</p>

      <p>Une seconde plus tard, tu avances jusqu’au croisement.</p>

      <p>Il n’y a personne.</p>

      <p>Seulement la route vide.</p>
    `,
    choices: state => [
      ...(!(state.flags.eliasVisited || state.visited?.c16) ? [{ label: 'Retourner sur la place', to: 'c15' }] : []),
      { label: 'Repartir vers la grotte', to: 'c20' }
    ]
  },

  c20: {
    number: 'PAGE 20',
    title: 'L’entrée de la grotte',
    image: 'L’entrée de la grotte',
    text: state => `
      <p>Tu reprends l’ascension.</p>

      <p>Le chemin devient rapidement escarpé, pierreux, difficile d’accès. Par endroits, il faut presque t’aider des mains pour progresser.</p>

      <p>Le vent semble s’éteindre à mesure que tu montes, comme si même l’air hésitait à venir jusque-là.</p>

      <p>Enfin, la roche s’ouvre devant toi.</p>

      <p>Tu es arrivé à l’entrée de la grotte.</p>

      <p>Tu t’y engages avec prudence. Après quelques pas à peine, deux chemins s’offrent à toi.</p>

      <p>L’un <strong>descend</strong> dans l’obscurité, et de ce passage monte une <strong>forte odeur de soufre</strong>.</p>

      <p>L’autre continue tout droit et semble s’enfoncer dans un passage beaucoup plus étroit.</p>
      ${hasItem(state, 'parchemin') ? '<p>Tu repenses aux avertissements d’Aldren : <strong>éviter le soufre</strong>.</p>' : ''}

    `,
    choices: [
      { label: 'Descendre dans le passage où l’odeur de soufre est la plus forte', to: 'c21' },
      { label: 'Prendre le passage étroit qui continue tout droit', to: 'c22' }
    ]
  },

  c21: {
    number: 'PAGE 21',
    title: '',
    image: 'Le souffle acide',
    text: `
      <p>Tu t’enfonces dans le passage qui descend.</p>

      <p>Très vite, l’odeur de soufre augmente. Elle te pique le nez, puis la gorge, puis les yeux.</p>

      <p>L’air devient épais. Presque liquide.</p>

      <p>Tu poursuis malgré tout, jusqu’à te retrouver dans une cavité fermée.</p>

      <p>Un cul-de-sac.</p>

      <p>Tu comprends aussitôt ton erreur et fais demi-tour, mais il est déjà trop tard.</p>

      <p>L’air acide a commencé son travail.</p>

      <p>Il te brûle les yeux. Il te ronge la gorge. Chaque inspiration paraît t’arracher quelque chose à l’intérieur de la poitrine.</p>

      <p>Tu tentes de remonter tant bien que mal.</p>

      <p>Mais la force te quitte peu à peu.</p>

      <p>Tu tombes à genoux.</p>

      <p>Puis sur les mains.</p>

      <p>Puis plus rien.</p>

      <p>Personne ne sait où tu es allé.</p>

      <p>Personne ne viendra te chercher.</p>
    `,    choices: [
      { label: 'Reprendre à l’entrée de la grotte', action: 'checkpoint' },
      { label: 'Recommencer depuis le début', action: 'restart' }
    ]
  },

  c22: {
    number: 'PAGE 22',
    title: 'La salle aux ombres mouvantes',
    image: 'La salle aux ombres mouvantes',
    text: `
      <p>Tu choisis l’autre passage.</p>

      <p>Tu avances dans un couloir de plus en plus étroit, au point que la roche semble vouloir se refermer sur toi.</p>

      <p>Puis, soudain, l’espace s’ouvre.</p>

      <p>Tu débouches dans une grande pièce sombre, creusée à même la pierre.</p>

      <p>La faible lumière venue de derrière toi n’éclaire la salle qu’à peine. Elle s’épuise avant d’atteindre le fond, et les ombres paraissent s’y mouvoir d’elles-mêmes.</p>

      <p>Tu as l’impression que les murs respirent, ou qu’ils ondulent faiblement, comme si la roche n’était pas tout à fait immobile.</p>

      <p>Tu avances encore de quelques pas dans la pénombre.</p>

      <p>C’est alors qu’un <strong>grondement</strong> retentit sur le côté.</p>
    `,
    choices: [
      { label: 'Retourner en arrière en courant', to: 'c23' },
      { label: 'Rester sur place et dégainer son épée', to: 'c24' }
    ]
  },

  c23: {
    number: 'PAGE 23',
    title: '',
    image: 'La fuite',
    text: `
      <p>Tu fais demi-tour et détales sans réfléchir.</p>

      <p>Derrière toi, tu sens aussitôt une présence qui te poursuit. Tu n’oses pas te retourner.</p>

      <p>Tu cours de plus en plus vite, trébuchant presque dans le passage étroit, jusqu’à surgir dehors dans l’air glacé de la montagne.</p>

      <p>Là seulement tu t’effondres.</p>

      <p>La peur te fait trembler les jambes pendant de longues heures. Tu restes incapable de repartir.</p>

      <p>À la tombée de la nuit, tes forces reviennent un peu… mais quelque chose en toi s’est déjà brisé.</p>

      <p>Tu te mets à parler à voix basse de monstres, de soufre, d’ombres qui bougent.</p>

      <p>Tu vois des mouvements partout. Tu contrôles mal ton corps. La peur ne te quitte plus.</p>

      <p>Finalement, tu redescends jusqu’au village, te caches dans l’écurie et attends que le temps passe… en espérant que la mort finira par tout faire taire.</p>
    `,    choices: [
      { label: 'Reprendre à l’entrée de la grotte', action: 'checkpoint' },
      { label: 'Recommencer depuis le début', action: 'restart' }
    ]
  },

  c24: {
    number: 'PAGE 24',
    title: '',
    noImage: true,
    image: 'Le grondement dans l’ombre',
    text: state => `
      <p>Tu restes sur place et dégaines ton épée. Le grondement vient toujours de l’obscurité, sur le côté.</p>
      <p>Quelque chose bouge dans l’obscurité.</p>
      <p>Ton esprit lui donne d’abord une forme simple : une masse lourde, ramassée, assez proche pour faire vibrer la pierre sous tes pieds.</p>
      <p>Puis cette première certitude se défait.</p>
      <p>Une partie paraît large lorsqu’elle passe devant la faible lumière, une autre beaucoup trop basse, et aucun contour ne reste à la même place assez longtemps pour que tu puisses les réunir.</p>
      <p>Tu sais seulement que quelque chose vient vers toi.</p>
      <p>Tout le reste devient moins certain à mesure que tu regardes.</p>
      ${state.throwingBlades > 0
        ? `<p>Tu possèdes encore <strong>${state.throwingBlades} lame${state.throwingBlades > 1 ? 's' : ''} de jet</strong>.</p>`
        : '<p>Tu n’as rien d’autre que ton épée.</p>'}
    `,
    choices: state => {
      const list = [];
      if (state.throwingBlades > 0) {
        list.push({
          label: `Lancer une lame dans l’ombre — ${state.throwingBlades} restante${state.throwingBlades > 1 ? 's' : ''} (jet de Dextérité, sans riposte)`,
          to: 'c25',
          effect: s => throwBladeAtEnemy(s, 'shadowMass', ENEMIES.shadowMass)
        });
      }
      list.push({ label: 'Te jeter en avant, l’épée levée', to: 'c26' });
      return list;
    }
  },

  c25: {
    number: 'PAGE 25',
    title: '',
    image: 'La lame de jet',
    text: state => {
      const combat = combatState(state, 'shadowMass', ENEMIES.shadowMass);
      return `
        ${enemyCardHtml(state, 'shadowMass', ENEMIES.shadowMass)}
        ${throwingBladeResultHtml(state, 'shadowMass', ENEMIES.shadowMass)}
        ${combat.lastBlade?.success
          ? '<p>La petite lame disparaît dans l’ombre et frappe quelque chose avec un bruit mat. La forme chancelle mais continue d’avancer.</p>'
          : '<p>La lame siffle dans le noir et heurte la pierre. La forme continue d’avancer.</p>'}
        <p>Tu lèves ton épée. Le combat va commencer.</p>
      `;
    },
    choices: [{ label: 'Lever ton épée et combattre', to: 'c26' }]
  },

  c26: {
    number: 'PAGE 26',
    title: '',
    image: 'Le choc',
    text: state => `
      <p>La masse se jette sur toi.</p>
      <p>Tu raffermis ta prise sur ton épée et cherches l’ouverture.</p>
      ${enemyCardHtml(state, 'shadowMass', ENEMIES.shadowMass)}
    `,
    choices: state => combatActionChoices(state, 'shadowMass', ENEMIES.shadowMass, 'c27')
  },

  c27: {
    number: 'PAGE 27',
    title: '',
    image: 'Le résultat du combat',
    text: state => {
      const combat = combatState(state, 'shadowMass', ENEMIES.shadowMass);
      const result = combat.lastBlade ? throwingBladeResultHtml(state, 'shadowMass', ENEMIES.shadowMass) : combatRoundHtml(state, 'shadowMass', ENEMIES.shadowMass);
      const card = enemyCardHtml(state, 'shadowMass', ENEMIES.shadowMass);

      if (combat.hp <= 0) {
        const finish = combat.lastBlade
          ? '<p>La dernière lame touche la masse. Cette fois, son mouvement s’interrompt.</p>'
          : '<p>Ton coup porte avec assez de force pour mettre fin au combat.</p>';
        return card + result + `
          ${finish}
          <p>La masse se contracte d’un seul bloc puis s’effondre contre la pierre.</p>
          <p>Dans sa chute, une partie de ce corps passe dans la faible lumière.</p>
          <p>Tu crois voir du tissu sous la terre noire.</p>
          <p>Une manche, peut-être.</p>
          <p>Lorsque tu regardes de nouveau, tu n’es déjà plus certain de ce que tu as vu.</p>
        `;
      }

      if (state.hp <= 0) {
        return card + result + `
          <p>Le choc te fait perdre pied.</p>
          <p>Ta vision se brouille tandis que la masse revient sur toi.</p>
        `;
      }

      if (combat.lastBlade) {
        return card + result + `
          ${combat.lastBlade.success?'<p>La petite lame disparaît presque entièrement dans la masse sombre. La chose continue d’avancer.</p>':'<p>La lame frappe une pierre. La masse avance toujours.</p>'}
        `;
      }

      if (combat.last && combat.last.outcome === 'enemy') {
        return card + result + `
          <p>La créature te percute. Tu recules contre la paroi, mais tu parviens à conserver ton arme.</p>
          <p>Elle ne marque aucune pause.</p>
          <p>Son mouvement se poursuit vers toi comme si le choc n’avait jamais eu lieu.</p>
        `;
      }

      if (combat.last && combat.last.outcome === 'tie') {
        return card + result + `
          <p>Vos mouvements se heurtent sans qu’aucun de vous ne trouve l’ouverture.</p>
          <p>La chose reprend aussitôt son mouvement, sans recul, sans hésitation.</p>
        `;
      }

      return card + result + `
        <p>Ton coup porte.</p>
        <p>Le corps plie sous l’impact d’une façon que tu ne parviens pas à comprendre, puis reprend immédiatement sa progression.</p>
        <p>Aucun geste de protection. Aucun recul volontaire. Rien qui ressemble à la peur.</p>
      `;
    },
    choices: state => {
      const combat = combatState(state, 'shadowMass', ENEMIES.shadowMass);
      if (combat.hp <= 0) return [{ label: 'Quitter la salle et poursuivre dans la grotte', to: 'c28' }];
      if (state.hp <= 0) return fatalChoices();
      return combatActionChoices(state, 'shadowMass', ENEMIES.shadowMass, 'c27', 'Continuer le combat');
    }
  },

  c28: {
    number: 'PAGE 28',
    title: 'Le camp sous la roche',
    image: 'Le camp sous la roche',
    onEnter: s => setCheckpoint(s, 'Le camp sous la roche'),
    text: `
      <p>Tu quittes enfin la salle du combat.</p>

      <p>Le passage descend en longues courbes entre des parois humides. À plusieurs reprises, tu crois entendre des pas derrière toi, mais chaque fois que tu t’arrêtes, le silence revient.</p>

      <p>Après quelques minutes, une faible lumière orangée apparaît entre les rochers.</p>

      <p>Tu débouches dans une cavité plus large. Un feu presque éteint brûle entre trois pierres noircies. Près de lui, un homme est adossé à la paroi.</p>

      <p>Sa barbe est longue, ses vêtements déchirés. Une de ses jambes est enveloppée de bandages raidis par le sang.</p>

      <p>Lorsqu’il te voit, il lève brusquement une main devant son visage.</p>

      <blockquote>« Non… pas encore. »</blockquote>

      <p>Puis il te fixe plus attentivement.</p>

      <blockquote>« Tu es réel ? »</blockquote>

      <p>Il dit s’appeler <strong>Anselme Varn</strong>.</p>

      <p>Tu lui demandes depuis combien de temps il se trouve ici.</p>

      <blockquote>« Deux jours… peut-être trois. »</blockquote>

      <p>Il baisse les yeux vers ses mains.</p>

      <blockquote>« Non… des mois. »</blockquote>

      <p>Son regard se perd un instant dans le feu.</p>

      <blockquote>« Ce n’est pas une grotte. Pas vraiment. »</blockquote>

      <blockquote>« Ceux qui disparaissent… personne ne les enlève. Ils viennent ici. »</blockquote>

      <blockquote>« La terre noire… ne la laisse pas entrer en toi. »</blockquote>

      <p>Soudain, son visage se fige.</p>

      <p>Il regarde derrière toi.</p>

      <blockquote>« Tu l’as amené avec toi. »</blockquote>

      <p>Tu te retournes.</p>

      <p>Il n’y a personne.</p>

      <p>Lorsque tu fais de nouveau face à Anselme, il marmonne déjà pour lui-même.</p>

      <p>La cavité se prolonge dans plusieurs directions. À quelques mètres du feu, tu distingues les restes d’un <strong>ancien campement</strong>. Sur la droite, une galerie est presque entièrement <strong>barrée par un énorme bloc de pierre</strong>. Plus loin, un <strong>tunnel étroit</strong> s’enfonce dans l’obscurité.</p>
    `,
    choices: state => {
      const list = [];
      list.push({ label: 'Examiner le vieux campement', to: 'c30' });
      if (campGalleryAvailable(state)) {
        list.push({ label: 'Explorer la galerie condamnée', to: 'c31' });
      }
      if (campTunnelAvailable(state)) {
        list.push({ label: 'Explorer le tunnel voisin', to: 'c34' });
      }
      list.push({ label: 'Quitter le camp et poursuivre vers les profondeurs', to: 'c37' });
      return list;
    }
  },

  c29: {
    number: 'PAGE 29',
    title: '',
    image: 'Le deuxième échange',
    text: `
      <p>La créature a encaissé ton premier coup.</p>

      <p>Elle recule d’un pas, heurte la paroi, puis revient immédiatement sur toi.</p>

      <p>Tu n’as plus l’espace nécessaire pour esquiver longtemps. Le prochain échange se fera presque au corps à corps.</p>
    `,
    choices: [{
      label: 'Lancer les trois dés',
      to: 'c33',
      effect: s => {
        if (roll3D6(s, 'Dextérité', currentDexterity(s))) {
          s.lastCombatOutcome = 'second_round_win';
        } else {
          s.lastCombatOutcome = 'second_round_wounded_win';
        }
      }
    }]
  },

  c30: {
    number: 'PAGE 30',
    title: '',
    image: 'Le journal d’Anselme',
    text: state => state.flags.campJournalRead ? `
      <p>Tu retrouves le croisement des galeries. Le feu du camp brûle toujours un peu plus loin, mais tu n'as pas besoin de retourner auprès d’Anselme.</p>
      <p>La galerie condamnée et le tunnel voisin s’ouvrent de part et d’autre.</p>
      ${campGalleryAvailable(state) || campTunnelAvailable(state)
        ? '<p>Il reste un passage que tu peux explorer avant de poursuivre la descente.</p>'
        : '<p>Tu as terminé ton exploration des alentours. La descente se poursuit devant toi.</p>'}
      ${hasItem(state, 'casque_cabosse') ? '<p>Le casque cabossé est maintenant dans ton équipement.</p>' : '<p>Le casque cabossé repose encore près de la couverture.</p>'}
    ` : `
      <p>Tu laisses Anselme près du feu et t’approches de l’ancien campement.</p>

      <p>Il semble abandonné depuis bien plus longtemps. Une couverture moisie s’est presque soudée au sol. Une tasse de métal repose près d’un cercle de cendres froides.</p>

      ${hasItem(state, 'casque_cabosse')
        ? '<p>Le casque cabossé que tu as ramassé reposait près de cette couverture.</p>'
        : '<p>À côté de la couverture, un <strong>casque de fer cabossé</strong> a été abandonné au sol. Il est lourd et terni, mais aucune fente ne traverse le métal.</p>'}

      <p>Sous la tasse, tu découvres un petit carnet protégé par une couverture de cuir.</p>

      <p>Les premières pages sont datées.</p>

      <blockquote>Premier jour. J’ai essayé le remède, la terre noire. Je me sens mieux. La voix a disparu.</blockquote>

      <blockquote>Deuxième jour. La voix est revenue. J’ai pris une dose plus forte. Elle s’est tue de nouveau.</blockquote>

      <blockquote>Troisième jour. Une douleur est apparue dans ma jambe. Quelque chose semble bouger tout seul sous ma peau. Est-ce qu’une bête m’a piqué ?</blockquote>

      <p>Plus loin, les dates disparaissent.</p>

      <p>Les phrases deviennent courtes, nerveuses. Certaines pages ne contiennent qu’un même mot répété jusqu’au bord du papier.</p>

      <p>La dernière ligne est écrite d’une main tremblante :</p>

      <blockquote>J’entends quelqu’un arriver. Peut-être enfin un autre vivant.</blockquote>

      <p>Sur la couverture intérieure, tu lis un nom.</p>

      <p><strong>ANSELME VARN.</strong></p>

      <p>Tu regardes vers l’homme assis près du feu.</p>

      <p>Il t’a pourtant affirmé être entré dans cette grotte il y a deux ou trois jours.</p>

      ${hasItem(state, 'casque_cabosse') ? '<p>Le casque n’est plus au sol : tu l’as ajouté à ton équipement.</p>' : ''}
    `,
    choices: state => {
      const list = [];
      if (!hasItem(state, 'casque_cabosse')) {
        list.push({
          label: 'Ramasser le casque cabossé (+2 Protection)',
          stay: true,
          effect: s => addProtectiveItem(s, 'casque_cabosse', 'Casque cabossé', 'Un casque de fer ancien mais encore solide. Il peut absorber 2 points de dégâts avant ta Vie.', 2)
        });
      }
      if (campGalleryAvailable(state)) {
        list.push({ label: 'Explorer la galerie condamnée', to: 'c31', effect: s => { s.flags.campJournalRead = true; } });
      }
      if (campTunnelAvailable(state)) {
        list.push({ label: 'Explorer le tunnel voisin', to: 'c34', effect: s => { s.flags.campJournalRead = true; } });
      }
      list.push({ label: 'Poursuivre vers les profondeurs', to: 'c37', effect: s => { s.flags.campJournalRead = true; } });
      return list;
    }
  },

  c31: {
    number: 'PAGE 31',
    title: 'La galerie condamnée',
    noImage: true,
    image: 'La galerie condamnée',
    onEnter: s => { s.flags.galleryVisited = true; },
    text: state => `
      <p>Tu t’engages dans la galerie de droite.</p>

      <p>Elle ne va pas loin. Après une vingtaine de pas, un bloc de pierre énorme bouche presque entièrement le passage.</p>

      <p>Une fente sombre subsiste sur le côté. Elle est trop étroite pour ton corps, mais suffisamment large pour laisser passer un courant d’air froid.</p>

      <p>En examinant la pierre, tu remarques qu’elle repose dans une sorte de logement circulaire. Avec assez de force, il est peut-être possible de la faire pivoter une fois.</p>
      ${state.flags.galleryAttempted ? '<p>Tu as déjà tenté de déplacer le bloc. Tu ne peux pas recommencer.</p>' : ''}

      <p><strong>Ta Force : ${currentForce(state)}</strong></p>
    `,
    choices: state => [
      ...(!state.flags.galleryAttempted ? [{
        label: 'Tenter de déplacer le bloc — lancer les trois dés',
        to: 'c32',
        effect: s => {
          if (s.flags.galleryAttempted) return;
          s.flags.galleryAttempted = true;
          s.lastCombatOutcome = roll3D6(s, 'Force', currentForce(s))
            ? 'force_success'
            : 'force_fail';
          s.flags.galleryBrassardJustWon = s.lastCombatOutcome === 'force_success'
            ? collectVeilleurBrassard(s)
            : false;
        }
      }] : []),
      { label: 'Renoncer et revenir au croisement des galeries', to: 'c30', effect: rememberCampJournalIfVisited }
    ]
  },

  c32: {
    number: 'PAGE 32',
    title: '',
    noImage: true,
    image: 'La pierre',
    // Secours pour les anciennes sauvegardes déjà placées après un jet réussi.
    onEnter: s => {
      if (s.lastCombatOutcome === 'force_success' && !s.flags.brassardPris) {
        s.flags.galleryBrassardJustWon = collectVeilleurBrassard(s);
      }
    },
    text: state => {
      const r = diceResultHtml(state);

      if (state.lastCombatOutcome === 'force_success') {
        return r + `
          <p>Tu cales ton épaule contre la pierre et pousses de toutes tes forces.</p>

          <p>Elle résiste longtemps.</p>

          <p>Puis un grondement profond traverse la galerie.</p>

          <p>Le bloc pivote de quelques dizaines de centimètres et libère juste assez d’espace pour te glisser de l’autre côté.</p>

          <p>La petite chambre derrière lui est sèche et parfaitement silencieuse.</p>

          <p>Un squelette est assis contre le mur. Autour de son avant-bras repose un brassard de métal sombre.</p>

          ${state.flags.galleryBrassardJustWon
            ? '<p>Tu le prends. Il paraît incroyablement lourd, puis son poids disparaît presque totalement une fois passé autour de ton bras.</p><p><strong>Brassard des Veilleurs : +1 Force.</strong></p>'
            : '<p>Le brassard a déjà été récupéré. Il n’y a aucun autre objet à prendre ici.</p>'}
        `;
      }

      return r + `
        <p>Tu prends appui contre la paroi et pousses jusqu’à sentir tes muscles trembler.</p>

        <p>La pierre bouge à peine.</p>

        <p>Un craquement sec retentit alors dans son logement. Le bloc s’affaisse de quelques centimètres et se coince définitivement contre la roche.</p>

        <p>Tu essaies encore de trouver une prise, mais il n’y en a plus.</p>

        <p>Cette galerie ne s’ouvrira pas pour toi.</p>
      `;
    },
    choices: [
      { label: 'Revenir au croisement des galeries', to: 'c30', effect: rememberCampJournalIfVisited }
    ]
  },

  c33: {
    number: 'PAGE 33',
    title: '',
    image: 'La fin du combat',
    text: state => {
      const r = diceResultHtml(state);

      if (state.lastCombatOutcome === 'second_round_win') {
        return r + `
          <p>Cette fois, tu anticipes son mouvement.</p>

          <p>Au moment où la masse se jette sur toi, tu te décales et frappes de toutes tes forces.</p>

          <p>La lame s’enfonce profondément.</p>

          <p>La créature se raidit, puis s’effondre contre la pierre.</p>

          <p>Dans sa chute, son bras passe dans la faible lumière.</p>

          <p>Sous la terre noire et la peau déformée, tu crois distinguer une manche de chemise.</p>

          <p>Quelque chose de parfaitement humain.</p>

          <p>Tu détournes les yeux avant d’en voir davantage.</p>
        `;
      }

      return r + `
        <p>Tu réagis une fraction de seconde trop tard.</p>

        <p>La créature te percute et une douleur vive traverse ton épaule.</p>

        <p>Vous tombez tous les deux contre la paroi.</p>

        <p>Pendant quelques secondes, il n’y a plus ni technique ni distance : seulement son poids contre toi, son souffle humide, et ta main qui cherche désespérément la garde de ton arme.</p>

        <p>Tu parviens finalement à libérer ton bras.</p>

        <p>Tu frappes presque au hasard.</p>

        <p>Une fois.</p>

        <p>Puis une seconde.</p>

        <p>La masse cesse enfin de bouger.</p>

        <p>Lorsque tu recules, haletant, tu aperçois sous la terre noire un morceau de vêtement qui ressemble terriblement à une chemise humaine.</p>

        <p>Tu viens de gagner.</p>

        <p>Mais tu n’es plus certain d’avoir combattu un monstre.</p>

        ${damageResultHtml(state, 'c33')}
      `;
    },
    choices: state => {
      if (state.lastCombatOutcome !== 'second_round_wounded_win') {
        return [{ label: 'Quitter la salle et poursuivre dans la grotte', to: 'c28' }];
      }
      if (!hasDamageRoll(state, 'c33')) {
        return [{ label: 'Lancer le dé de blessure', action: 'damage', damageKey: 'c33' }];
      }
      if (state.hp <= 0) return fatalChoices();
      return [{ label: 'Quitter la salle et poursuivre dans la grotte', to: 'c28' }];
    }
  },

  c34: {
    number: 'PAGE 34',
    title: 'Le tunnel voisin',
    noImage: true,
    image: 'Le tunnel voisin',
    onEnter: s => { s.flags.tunnelVisited = true; },
    text: `
      <p>Tu laisses la lumière du feu derrière toi et t’engages dans le tunnel voisin.</p>

      <p>Le passage descend doucement. La roche y est plus sombre et le sol couvert d’une fine poussière grise qui étouffe presque le bruit de tes pas.</p>

      <p>Tu avances prudemment.</p>

      <p>Après quelques dizaines de mètres, un son très faible te parvient.</p>

      <p>Des sanglots.</p>

      <p>Ils sont lointains au début, à peine perceptibles.</p>

      <p>Mais plus tu avances, plus ils deviennent distincts.</p>

      <p>Quelqu’un pleure dans l’obscurité.</p>

      <p>Le tunnel tourne une dernière fois.</p>

      <p>Tu tombes finalement sur une silhouette recroquevillée contre la roche.</p>

      <p>Elle porte encore ce qui ressemble à des vêtements humains.</p>

      <blockquote>« Ne me regarde pas… »</blockquote>

      <p>Sa voix est faible, presque brisée.</p>

      <blockquote>« S’il te plaît. Ne me regarde pas. »</blockquote>
    `,
    choices: [
      { label: 'Lui parler sans t’approcher', to: 'c35' },
      { label: 'T’approcher pour essayer de l’aider', to: 'c36' },
      { label: 'Reculer lentement et revenir au croisement', to: 'c30', effect: rememberCampJournalIfVisited }
    ]
  },

  c35: {
    number: 'PAGE 35',
    title: '',
    noImage: true,
    image: 'Une voix humaine',
    text: `
      <p>Tu restes à plusieurs pas de la silhouette.</p>

      <blockquote>« Je ne vais pas te faire de mal. »</blockquote>

      <p>Les sanglots cessent.</p>

      <p>Un long silence suit.</p>

      <blockquote>« Rochebrume… »</blockquote>

      <p>Tu lui demandes si elle vient du village.</p>

      <p>La silhouette redresse légèrement la tête, sans jamais te montrer complètement son visage.</p>

      <blockquote>« Je voulais rester chez moi. »</blockquote>

      <p>Ses doigts se crispent contre la pierre.</p>

      <blockquote>« Mais mes jambes avançaient toutes seules. Vers la montagne. »</blockquote>

      <p>Sa respiration devient irrégulière.</p>

      <blockquote>« Même maintenant… j’essaie encore de descendre. »</blockquote>

      <p>Un rire étouffé lui échappe.</p>

      <p>Ou peut-être recommence-t-elle simplement à pleurer.</p>

      <p>Tu recules sans la quitter des yeux, puis reprends le tunnel en sens inverse.</p>

      <p>Lorsque tu retrouves le croisement, les sanglots continuent encore derrière toi. Tu n'as aucune envie de retourner dans ce tunnel.</p>
    `,
    choices: [
      { label: 'Revenir au croisement des galeries', to: 'c30', effect: rememberCampJournalIfVisited }
    ]
  },

  c36: {
    number: 'PAGE 36',
    title: '',
    image: 'Sous la terre noire',
    text: state => `
      <p>Tu avances lentement, les mains bien visibles.</p>

      <blockquote>« Je veux seulement t’aider. »</blockquote>

      <p>La silhouette cesse de respirer pendant une seconde.</p>

      <p>Puis elle se retourne d’un seul mouvement.</p>

      <p>Elle bondit.</p>

      <p>Tu n’as qu’un instant pour regarder ce qui se tourne vers toi.</p>

      <p>Parce qu’il y avait une voix, des vêtements, une silhouette accroupie, ton esprit cherche encore un visage.</p>

      <p>Il croit parfois le trouver sous la terre noire : une ligne qui pourrait être une bouche, un creux qui pourrait contenir un œil.</p>

      <p>Mais dès que tu fixes l’un de ces détails, les autres cessent de tenir autour.</p>

      <p>Quelque chose de beaucoup plus certain apparaît pourtant sur sa poitrine.</p>

      <p>Un morceau de tissu bleu.</p>

      <p>Sur la poitrine, un petit écusson.</p>

      <p><strong>ROCHEBRUME.</strong></p>

      <p>Tu n’as pas le temps de comprendre davantage.</p>

      ${enemyCardHtml(state, 'rochebrumeMissing', ENEMIES.rochebrumeMissing)}
    `,
    choices: state => combatActionChoices(state, 'rochebrumeMissing', ENEMIES.rochebrumeMissing, 'c38')
  },

  c37: {
    number: 'PAGE 37',
    title: 'Le passage des fissures',
    image: 'Le passage des fissures',
    text: state => `
      <p>Tu quittes enfin le camp d’Anselme et reprends la descente.</p>

      <p>Le tunnel se resserre peu à peu jusqu’à ne plus être qu’une fente dans la roche.</p>

      <p>Tu dois avancer de profil, une épaule contre chaque paroi.</p>

      <p>Ton souffle te revient au visage.</p>

      <p>Puis tu entends un frottement.</p>

      <p>Pas devant toi.</p>

      <p><strong>Dans la pierre.</strong></p>

      <p>Quelque chose gratte derrière la paroi, très près de ton oreille.</p>

      <p>Quelques mètres plus loin, une fissure noire coupe la roche à hauteur de ton visage.</p>

      <p>Quelque chose de pâle apparaît dans la fente.</p>

      <p>Cela ressemble fortement à un œil qui te fixe. Un regard glacé, étrangement immobile.</p>

      <p>Mais tu n’en es pas certain.</p>

      <p>La chose se retire avant que tu puisses comprendre ce que tu as réellement vu.</p>

      <p>D’autres frottements lui répondent plus loin.</p>

      <p>Tu comprends alors que le passage n’est peut-être pas vide.</p>

      <p>Il est simplement trop étroit pour que ce qui vit dans ses parois puisse en sortir complètement.</p>

      <p><strong>Ta Dextérité actuelle : ${currentDexterity(state)}</strong></p>
    `,
    choices: [{
      label: 'Te glisser entre les fissures — lancer les trois dés de Dextérité',
      to: 'c39',
      effect: s => {
        const ok = roll3D6(s, 'Dextérité', currentDexterity(s));
        s.flags.fissurePass = ok ? 'success' : 'fail';
        if (!ok) s.flags.fissureDamage = applyDamage(s, 1);
      }
    }]
  },

  c38: {
    number: 'PAGE 38',
    title: '',
    image: 'Ce qui restait de lui',
    text: state => {
      const combat = combatState(state, 'rochebrumeMissing', ENEMIES.rochebrumeMissing);
      const result = combat.lastBlade ? throwingBladeResultHtml(state, 'rochebrumeMissing', ENEMIES.rochebrumeMissing) : combatRoundHtml(state, 'rochebrumeMissing', ENEMIES.rochebrumeMissing);
      const card = enemyCardHtml(state, 'rochebrumeMissing', ENEMIES.rochebrumeMissing);

      if (combat.hp <= 0) {
        const finish = combat.lastBlade
          ? '<p>La lame coupe son élan. La silhouette s’effondre avant d’arriver jusqu’à toi.</p>'
          : '<p>Tu te décales au dernier moment et ton coup l’atteint avant qu’il puisse refermer ses mains sur toi.</p>';
        return card + result + `
          ${finish}
          <p>La silhouette s’effondre lourdement.</p>
          <p>Pendant quelques secondes, tu restes immobile, l’arme levée.</p>
          <p>Elle ne bouge plus.</p>
          <p>La chose qui te faisait face repose maintenant de côté.</p>
          <p>Tu pensais que l’immobilité rendrait enfin ses traits plus faciles à comprendre. Elle ne fait que rendre chaque détail plus isolé du suivant.</p>
          <p>Sur sa poitrine, en revanche, l’écusson de Rochebrume est parfaitement visible.</p>
          <p>Celui-là ne laisse aucune place au doute.</p>
        `;
      }

      if (state.hp <= 0) {
        return card + result + `
          <p>La silhouette te percute et tu t’effondres dans la poussière.</p>
          <p>Le monde disparaît derrière son visage couvert de terre noire.</p>
        `;
      }

      if (combat.lastBlade) {
        return card + result + `
          ${combat.lastBlade.success?'<p>La lame se fiche dans ce qui devrait être une épaule. La silhouette reprend sa marche.</p>':'<p>La lame passe à côté de la silhouette et se perd dans l’obscurité. Son mouvement vers toi continue.</p>'}
        `;
      }

      if (combat.last && combat.last.outcome === 'enemy') {
        return card + result + `
          <p>La silhouette te percute et ses ongles labourent ton bras.</p>
          <p>Tu la repousses juste assez pour retrouver la garde de ton arme.</p>
          <p>Elle se ramasse déjà pour bondir de nouveau.</p>
        `;
      }

      if (combat.last && combat.last.outcome === 'tie') {
        return card + result + `
          <p>Tu bloques son mouvement au dernier instant.</p>
          <p>Vous vous séparez d’un pas, sans quitter l’autre des yeux.</p>
        `;
      }

      return card + result + `
        <p>Ton coup porte, mais il est encore capable de se battre.</p>
        <p>La silhouette chancelle puis revient vers toi.</p>
      `;
    },
    choices: state => {
      const combat = combatState(state, 'rochebrumeMissing', ENEMIES.rochebrumeMissing);
      if (combat.hp <= 0) return [{ label: 'Reprendre ton souffle et revenir au croisement', to: 'c30', effect: rememberCampJournalIfVisited }];
      if (state.hp <= 0) return fatalChoices();
      return combatActionChoices(state, 'rochebrumeMissing', ENEMIES.rochebrumeMissing, 'c38', 'Continuer le combat');
    }
  },

  c39: {
    number: 'PAGE 39',
    title: '',
    noImage: true,
    image: 'Ce qui vit entre les pierres',
    text: state => {
      const r = diceResultHtml(state);
      if (state.flags.fissurePass === 'success') {
        return r + `
          <p>Tu avances lentement, sans jamais t’arracher à la paroi.</p>

          <p>À plusieurs reprises, quelque chose de pâle affleure dans les fentes puis disparaît avant que tu puisses tourner la tête.</p>

          <p>Une fois, tu crois reconnaître un doigt. Plus loin, peut-être un œil. Un peu après, une rangée de petites formes blanches qui pourraient être des dents.</p>

          <p>Pris séparément, chacun de ces détails paraît presque familier.</p>

          <p>Tu n’en vois jamais assez pour comprendre à quoi ils appartiennent.</p>

          <p>Le plus difficile est de ne pas accélérer.</p>

          <p>Enfin, la roche s’écarte.</p>

          <p>Tu fais encore trois pas avant d’oser respirer normalement.</p>

          <p>Derrière toi, plusieurs petits coups secs répondent dans la pierre.</p>

          <p>Comme si quelque chose te suivait encore, de l’autre côté du mur.</p>
        `;
      }

      const weaponLine = state.weapon === 'heavy'
        ? `<p>La garde de la lourde épée accroche brutalement la roche et te bloque une fraction de seconde.</p>`
        : `<p>Ton équipement accroche la roche et te bloque une fraction de seconde.</p>`;

      return r + `
        ${weaponLine}

        <p>C’est suffisant.</p>

        <p>Une main grisâtre jaillit d’une fente et se referme sur ton avant-bras.</p>

        <p>Les doigts sont si fins que tu les sens presque se croiser autour de toi.</p>

        <p>Tu arraches ton bras et te jettes en avant.</p>

        <p>Quelque chose griffe ta peau avant de disparaître dans la pierre.</p>

        ${damageAbsorptionHtml(state.flags.fissureDamage)}

        <p>Lorsque le passage s’élargit enfin, tu ne t’arrêtes pas.</p>

        <p>Les petits frottements continuent derrière toi pendant encore longtemps.</p>
      `;
    },
    choices: state => state.hp <= 0
      ? fatalChoices()
      : [{ label: 'Poursuivre vers le courant d’air froid', to: 'c40' }]
  },

  c40: {
    number: 'PAGE 40',
    title: 'Le monde sous la montagne',
    image: 'Le monde sous la montagne',
    onEnter: s => setCheckpoint(s, 'Le monde sous la montagne'),
    text: `
      <p>La fissure s’élargit brusquement.</p>

      <p>Tu fais encore quelques pas.</p>

      <p>Et le monde s’ouvre devant toi.</p>

      <p>Tu avais cru atteindre une grande caverne.</p>

      <p>Ce n’est pas une caverne.</p>

      <p>Le plafond disparaît dans une brume lumineuse, peut-être à plusieurs kilomètres au-dessus de toi.</p>

      <p>Une clarté blanc-bleu baigne le paysage sans que tu puisses en identifier la source.</p>

      <p>Pas de torches.</p>

      <p>Pas de soleil.</p>

      <p>Très loin en contrebas, des falaises émergent de la brume comme des chaînes de montagnes.</p>

      <p>Tu te retournes.</p>

      <p>La fissure dont tu viens de sortir n’est plus qu’une ligne noire dans une paroi gigantesque.</p>

      <p>La montagne de Valombre ne pourrait pas contenir cet endroit.</p>

      <p>Cette certitude est presque rassurante tant elle est simple.</p>

      <p>Soit le soufre, la fatigue ou la peur ont fini par briser quelque chose dans ton esprit.</p>

      <p>Soit ce lieu est réel.</p>

      <p>Et cette seconde possibilité te paraît soudain bien pire.</p>

      <p>Trois voies s’enfoncent dans ce monde impossible.</p>

      <p>À gauche, un sentier descend vers une étendue d’eau parfaitement noire.</p>

      <p>Face à toi, un ancien escalier de pierre grimpe le long de la falaise.</p>

      <p>À droite, une corniche étroite rejoint un pont suspendu au-dessus d’un gouffre sans fond visible.</p>

      <p>Tu éprouves le besoin de continuer, de t’enfoncer plus profondément. Cette envie te surprend : tu étais venu pour retrouver Aldren, pas pour obéir à une direction que tu ne comprends pas.</p><p>Tu ne pourras pas explorer les trois.</p>

      <p>Il faut choisir.</p>

    `,
    choices: [
      { label: 'Descendre vers le lac noir', to: 'c41' },
      { label: 'Prendre l’escalier de pierre', to: 'c44' },
      { label: 'Longer la corniche vers le pont', to: 'c58' }
    ]
  },

  c41: {
    number: 'PAGE 41',
    title: 'Le lac noir',
    image: 'Le lac noir',
    onEnter: s => { s.flags.worldRoute = 'lake'; },
    text: `
      <p>Le sentier descend longtemps en lacets.</p>

      <p>Plus tu approches du fond, plus l’air devient froid.</p>

      <p>La lumière blanche du monde souterrain s’affaiblit jusqu’à ne plus former qu’un halo au-dessus des falaises.</p>

      <p>Puis tu atteins la rive.</p>

      <p>Le lac s’étend devant toi jusqu’à disparaître dans une brume noire.</p>

      <p>Il n’y a pas une vague.</p>

      <p>Pas même un frémissement.</p>

      <p>Très haut au-dessus de l’eau, presque perdu dans la brume, tu distingues la ligne d’un pont suspendu entre deux falaises.</p>

      <p>Quelque chose de sombre semble se déplacer dessous.</p>

      <p>À cette distance, tu n’es même pas certain qu’il s’agisse d’un être vivant.</p>

      <p>Tu t’accroupis près de l’eau.</p>

      <p>La surface reste noire un instant, sans rien renvoyer.</p>

      <p>Puis ton visage apparaît enfin.</p>

      <p>Tu tournes légèrement la tête.</p>

      <p>Ton reflet ne reproduit le mouvement qu’un bref instant plus tard.</p>

      <p>Tu te redresses aussitôt.</p>

      <p>Un peu plus loin, une vieille barque est attachée à un anneau de pierre.</p>

      <p>Le bois est gonflé par l’humidité, mais la corde paraît étonnamment solide.</p>

      <p>Tu embarques.</p>

      <p>Au bout de plusieurs minutes, la rive disparaît derrière toi.</p>

      <p>Il n’y a plus que l’eau.</p>

      <p>Alors un coup sec résonne contre le bois, sous tes pieds.</p>

      <p><strong>TOC.</strong></p>

      <p>Tu immobilises les rames.</p>

      <p>Un second coup frappe le flanc de la barque.</p>

      <p><strong>TOC.</strong></p>

      <p>Puis un troisième, juste sous le bord où repose ta main.</p>

      <p><strong>TOC.</strong></p>
    `,
    choices: [
      { label: 'Te pencher et regarder sous l’eau', to: 'c42' },
      {
        label: 'Ne pas regarder et recommencer à ramer',
        to: 'c45',
        effect: s => {
          s.flags.lakeTentacleOutcome = 'surprised';
          rollDamage(s, 'lakeTentacleSurprised', 3);
          /* Tentacule : choc physique, aucune contamination. */
        }
      }
    ]
  },

  c42: {
    number: 'PAGE 42',
    title: '',
    image: 'Les lueurs sous le lac',
    onEnter: s => { s.flags.lookedIntoLake = true; },
    text: state => `
      <p>Tu poses les rames et te penches au-dessus du bord.</p>

      <p>L’eau est si noire que tu ne distingues d’abord rien sous la surface.</p>

      <p>Puis quelques lueurs apparaissent, très loin en dessous.</p>

      <p>Entre elles, tu devines des formes pâles. Une ligne droite. Plus loin, ce qui pourrait être une arche.</p>

      <p>Tu essaies de mieux voir.</p>

      <p>Un nouveau coup résonne contre la coque.</p>

      <p>Cette fois, tu aperçois quelque chose juste sous la surface.</p>

      <p>Un long tentacule noir glisse le long de la barque. Épais comme une cuisse, il se replie lentement sur lui-même. Son extrémité vient heurter le bois.</p>

      <p>Tu comprends d’où venaient les coups.</p>

      <p>Soudain, le tentacule disparaît sous la barque.</p>

      <p>L’eau se soulève.</p>

      <p><strong>Il jaillit vers toi.</strong></p>

      <p><strong>Ta Dextérité actuelle : ${currentDexterity(state)}</strong></p>
    `,
    choices: state => [{
      label: state.weapon === 'none'
        ? 'Esquiver le tentacule — tester ta Dextérité'
        : 'Dégainer et frapper le tentacule — tester ta Dextérité',
      to: 'c46',
      effect: s => {
        const success = roll3D6(s, 'Dextérité', currentDexterity(s));
        s.flags.lakeTentacleOutcome = success ? 'counter' : 'lookHit';
        if (!success) rollDamage(s, 'lakeTentacleLookHit', 3);
          /* Tentacule : choc physique, aucune contamination. */
      }
    }]
  },

  c43: {
    number: 'PAGE 43',
    title: '',
    image: 'Les lames dans la poche',
    text: state => `
      <p>Élias enveloppe soigneusement les lames dans un morceau de cuir avant de te les tendre.</p>

      <blockquote>« Garde-les à portée de main. Si quelque chose te saute dessus, tu n’auras probablement pas le temps de fouiller ton sac. »</blockquote>

      <p>Tu possèdes maintenant <strong>${state.throwingBlades} lame${state.throwingBlades > 1 ? 's' : ''} de jet</strong>.</p>
    `,
    choices: [
      { label: 'Retourner dans la rue de Rochebrume', to: 'c15' },
      { label: 'Quitter Rochebrume et repartir vers la grotte', to: 'c20' }
    ]
  },

  c44: {
    number: 'PAGE 44',
    title: 'Les Grandes Marches',
    image: 'Les marches déformées',
    onEnter: s => { s.flags.worldRoute = 'stairs'; },
    text: state => `
      <p>Tu choisis l’escalier.</p>

      <p>Au début, rien ne paraît anormal.</p>

      <p>Les marches sont anciennes, usées au centre, mais assez régulières pour être montées sans difficulté.</p>

      <p>Puis, très progressivement, leur hauteur change.</p>

      <p>L’une est un peu trop haute. La suivante légèrement inclinée.</p>

      <p>Plus loin, leurs bords deviennent mousses et irréguliers, comme si la pierre avait lentement oublié la forme qu’on lui avait donnée.</p>

      <p>Après plusieurs dizaines de mètres, tu ne montes presque plus un escalier.</p>

      <p>Tu progresses sur une succession de ressauts de roche lisses, déformés et parfois glissants.</p>

      <p>Le mur à ta droite devrait t’aider.</p>

      <p>Mais lui aussi change.</p>

      <p>La pierre s’effrite sous tes doigts. Certaines prises se détachent dès que tu y mets ton poids.</p>

      <p>Plus tu avances, plus une impression désagréable s’impose : tout ici semble fait pour te pousser vers le vide.</p>

      <p>Devant toi, le passage se resserre sur une portion inclinée où les anciennes marches ne sont plus que des plaques de roche polie.</p>

      <p>Tu n’as aucun autre appui que cette paroi friable.</p>

      <p><strong>Ta Dextérité actuelle : ${currentDexterity(state)}</strong></p>
    `,
    choices: [{
      label: 'Traverser la portion glissante — tester ta Dextérité',
      to: 'c49',
      effect: s => {
        const ok = roll3D6(s, 'Dextérité', currentDexterity(s));
        s.flags.stairsCross = ok ? 'success' : 'fail';
        if (!ok) s.flags.stairsDamage = applyDamage(s, 2);
      }
    }]
  },

  c45: {
    number: 'PAGE 45',
    title: '',
    image: 'Le tentacule surgit',
    text: state => `
      <p>Tu resserres les mains sur les rames et poursuis ta route.</p>

      <p>Les coups cessent.</p>

      <p>Pendant quelques secondes, seule l’eau glisse contre la coque.</p>

      <p>Soudain, un tentacule noir, épais comme une cuisse, jaillit hors de l’eau et s’abat sur toi.</p>

      <p>Tu n’as pas le temps de saisir ton arme.</p>

      <p>Le choc te projette contre le bord de la barque. Le tentacule se rétracte aussitôt et disparaît sous la surface.</p>

      ${hasDamageRoll(state, 'lakeTentacleSurprised') ? lakeTentacleDamageHtml(state, 'lakeTentacleSurprised') : ''}
    `,
    choices: state => state.hp <= 0
      ? fatalChoices()
      : [{ label: 'Te relever et poursuivre la traversée', to: 'c46' }]
  },

  c46: {
    number: 'PAGE 46',
    title: '',
    image: 'Le lac se referme',
    text: state => {
      // L’îlot doit être découvert dans chaque issue de l’attaque, avant le choix de l’accoster.
      // Ne pas présenter de nouveaux choix d’exploration après une blessure mortelle.
      const isletDiscovery = state.hp > 0 ? `
        <p>Tu récupères les rames et reprends lentement ta route.</p>

        <p>Sur ta droite, la brume se déchire un instant.</p>

        <p>À quelques dizaines de mètres, une masse de pierre émerge de l’eau. Une bonne partie de l’îlot se perd dans la brume, mais tu distingues les vestiges de plusieurs murs.</p>

        <p>Un ancien quai forme un rebord assez bas pour y accoster.</p>

        <p>La brume commence déjà à se refermer sur l’îlot.</p>

        <p>Tu peux t’en approcher pour l’examiner, ou poursuivre ta traversée sans prendre le risque de t’arrêter.</p>
      ` : '';
      if (state.flags.lakeTentacleOutcome === 'counter') {
        return diceResultHtml(state) + (state.weapon === 'none'
          ? `
            <p>Tu te rejettes en arrière juste avant que le tentacule ne s’abatte sur toi.</p>

            <p>Il frappe le bord de la barque et replonge aussitôt.</p>
          `
          : `
            <p>Tu te rejettes en arrière et dégaines d’un même mouvement.</p>

            <p>Ta lame entaille le tentacule au moment où il franchit le bord.</p>

            <p>Il se replie brusquement et disparaît sous l’eau.</p>
          `) + `
            <p>Tu restes prêt à frapper, mais rien ne remonte.</p>

            <p>Le lac retrouve peu à peu son immobilité.</p>
          ` + isletDiscovery;
      }
      if (state.flags.lakeTentacleOutcome === 'lookHit') {
        return diceResultHtml(state) + `
          <p>Tu tentes de dégainer, mais le tentacule t’atteint avant que tu puisses frapper.</p>

          <p>Le choc te projette contre un banc de bois.</p>

          ${lakeTentacleDamageHtml(state, 'lakeTentacleLookHit')}

          <p>Lorsque tu te redresses, le tentacule a déjà replongé.</p>

          <p>Le lac redevient parfaitement immobile.</p>
        ` + isletDiscovery;
      }
      return `
        <p>Tu te remets péniblement en position.</p>

        <p>Tu surveilles l’eau quelques instants. Le tentacule ne revient pas.</p>

        <p>Le lac redevient parfaitement immobile.</p>
      ` + isletDiscovery;
    },
    choices: state => {
      if (state.hp <= 0) return fatalChoices();
      return [
        { label: 'Accoster le petit îlot de pierre aperçu dans la brume', to: 'c47', effect: s => { if (s.combats?.isletCrawler?.hp <= 0) replayCombat(s, 'isletCrawler'); } },
        { label: 'Ne plus t’arrêter avant l’autre rive', to: 'c48' }
      ];
    }
  },

  c47: {
    number: 'PAGE 47',
    title: 'L’îlot de l’œil fermé',
    image: 'L’îlot de l’œil fermé',
    text: state => {
      const enemy = ENEMIES.isletCrawler;
      const combat = combatState(state, 'isletCrawler', enemy);
      const card = enemyCardHtml(state, 'isletCrawler', enemy);

      if (combat.round === 0 && !combat.lastBlade) {
        return `
          <p>Tu accostes contre l’ancien quai de pierre et tires la barque hors de l’eau.</p>

          <p>L’îlot s’étend sur plusieurs dizaines de pas. Son sol irrégulier est parsemé de blocs effondrés et de vestiges de murs. À une extrémité, un escalier descend directement dans les eaux noires du lac.</p>

          <p>Tu avances parmi les ruines.</p>

          <p>Au centre de l’îlot, quatre piliers brisés entourent une large dalle de pierre blanche.</p>

          <p>Un œil fermé y est gravé.</p>

          <p>Dans une petite cavité, au milieu de la dalle, repose un anneau métallique couvert de dépôts gris.</p>

          <p>Tu t’approches pour l’examiner.</p>

          <p>Quelque chose racle la pierre derrière l’un des piliers.</p>

          <p>Une forme basse apparaît.</p>

          <p>Plus elle approche, moins tu comprends ce que tu regardes.</p>

          <p>À distance, ton esprit avait trouvé une comparaison rassurante : un grand reptile, peut-être un alligator.</p>

          <p>Maintenant, cette idée se défait.</p>

          <p>Chaque partie semble presque familière prise isolément. Pourtant, dès que tu essaies de les réunir, les proportions cessent de tenir. Les membres ne plient pas là où tu t’y attends. La tête change presque de forme lorsqu’elle tourne.</p>

          <p>Tu continues malgré toi à chercher quelque chose de connu dans cette silhouette.</p>

          <p>Il n’y a rien.</p>

          <p>La chose se place entre toi et la barque.</p>

          <p>Elle avance lentement, sans jamais détourner sa trajectoire.</p>

          <p>Un claquement bref part de l’avant de sa forme et la dalle résonne sous tes pieds.</p>

          ${card}
        `;
      }

      const result = combat.lastBlade ? throwingBladeResultHtml(state, 'isletCrawler', enemy) : combatRoundHtml(state, 'isletCrawler', enemy);
      if (combat.hp <= 0) {
        const finish = combat.lastBlade
          ? '<p>La lame frappe. La progression de la chose s’interrompt enfin.</p>'
          : '<p>Ton coup arrête enfin sa progression.</p>';
        return card + result + `
          ${finish}

          <p>La créature s’affaisse contre la dalle et reste immobile.</p>

          <p>Tu la regardes quelques secondes, certain que l’immobilité finira par lui rendre une forme compréhensible.</p>

          <p>C’est l’inverse.</p>

          <p>Sans le mouvement pour relier ses volumes entre eux, tu ne sais même plus quelle partie de ce corps tu avais prise pour une tête.</p>

          <p>Tu détournes les yeux.</p>

          <p>Près de la créature, quelques grains de terre noire se mêlent à la poussière de pierre.</p>

          <p>Dans la cavité au centre de l’îlot, l’anneau est toujours là.</p>

          <p>Rien ne brille. Rien ne vibre.</p>

          <p>Pourtant, lorsque tu le prends entre deux doigts, il paraît presque ne rien peser.</p>
        `;
      }

      if (state.hp <= 0) {
        return card + result + `
          <p>La masse difforme te renverse sur la dalle blanche.</p>
          <p>Sa mâchoire descend vers toi tandis que le lac noir remplit tout ton champ de vision.</p>
        `;
      }

      if (combat.lastBlade) {
        return card + result + `
          ${combat.lastBlade.success?'<p>La lame se plante dans sa forme indistincte. La chose se déforme autour de l’impact puis reprend sa progression.</p>':'<p>La lame manque cette forme impossible à viser. La chose reprend sa progression, sans hésitation.</p>'}
        `;
      }

      if (combat.last && combat.last.outcome === 'enemy') {
        return card + result + `
          <p>La créature te heurte et poursuit son mouvement jusqu’au bord de la dalle.</p>
          <p>Elle pivote sans pause et revient sur la même trajectoire, comme si rien ne pouvait modifier ce qu’elle a commencé.</p>
        `;
      }

      if (combat.last && combat.last.outcome === 'tie') {
        return card + result + `
          <p>Ton arme rencontre une partie dure de son corps dans un choc sec, mais elle dévie au même instant.</p>
          <p>La chose continue de ramper autour de la dalle. Tu ignores même si elle a compris qu’elle venait d’être frappée.</p>
        `;
      }

      return card + result + `
        <p>Ton coup l’atteint.</p>
        <p>Une partie de son corps s’écrase contre la pierre sous l’impact.</p>
        <p>Elle ne cherche ni à fuir ni à protéger la blessure. Le mouvement reprend simplement, au même rythme, dans ta direction.</p>
        <p>Elle n’est pas morte.</p>
      `;
    },
    choices: state => {
      const enemy = ENEMIES.isletCrawler;
      const combat = combatState(state, 'isletCrawler', enemy);
      if (state.hp <= 0) return fatalChoices();
      if (combat.hp <= 0) {
        if (hasItem(state, 'anneau_veilleurs')) return [{ label: 'Reprendre la barque', to: 'c48' }];
        return [
          {
            label: 'Prendre l’Anneau des Veilleurs (+1 Dextérité)',
            to: 'c127',
            effect: s => addItem(s, 'anneau_veilleurs', 'Anneau des Veilleurs', 'Un anneau ancien et très léger. +1 Dextérité. Son motif peut actionner certains mécanismes des Veilleurs.')
          },
          { label: 'Laisser l’anneau et reprendre la barque', to: 'c48' }
        ];
      }
      return combatActionChoices(state, 'isletCrawler', enemy, 'c47');
    }
  },

  c48: {
    number: 'PAGE 48',
    title: 'La rive basse',
    image: 'La rive basse',
    text: `
      <p>La traversée continue encore longtemps.</p>

      <p>Enfin, une ligne de pierre apparaît dans la brume.</p>

      <p>La barque heurte une marche noyée.</p>

      <p>Tu descends dans quelques centimètres d’eau noire et tires l’embarcation derrière toi.</p>

      <p>Devant toi, des arches de pierre portent une rue au-dessus de l’eau. Un escalier remonte depuis les quais, entre les maisons serrées sur la pente.</p>

      <p>Plus haut, tu distingues des ponts, des ruelles et des terrasses. Tout est à taille humaine : quelqu’un a bâti ce quartier pour y vivre.</p>

      <p>En levant les yeux, tu découvres une immense ouverture dans la voûte de la grotte. Le ciel apparaît très loin au-dessus du village. Le soleil entre à flots et éclaire les toits, les façades et les rues hautes.</p>

      <p>Ici, au bord de l’eau, les arches et les marches noyées restent dans l’ombre. Tu distingues à peine le bord de la pierre sous tes pieds.</p>

    `,
    choices: [
      { label: 'Entrer par les arches noyées', to: 'c66' }
    ]
  },

  c49: {
    number: 'PAGE 49',
    title: '',
    noImage: true,
    image: 'La paroi friable',
    text: state => {
      const r = diceResultHtml(state);
      if (state.flags.stairsCross === 'success') {
        return r + `
          <p>Tu avances lentement, presque de côté.</p>

          <p>Une première pierre cède sous ta main. Tu la laisses tomber sans chercher à la retenir.</p>

          <p>Quelques secondes plus tard, ton pied glisse à son tour.</p>

          <p>Tu transfères ton poids sur l’autre jambe avant que la roche ne t’emporte.</p>

          <p>Lorsque tu atteins enfin une plateforme plus stable, tes avant-bras tremblent.</p>

          <p>Derrière toi, plusieurs morceaux de paroi se détachent encore et disparaissent dans le vide.</p>

          <p>Tu continues.</p>
        `;
      }
      return r + `
        <p>Ton pied part brusquement sur la roche lisse.</p>

        <p>Tu te jettes contre la paroi et saisis une aspérité.</p>

        <p>Elle se pulvérise dans ta main.</p>

        <p>Tu glisses sur plusieurs mètres avant de heurter violemment un ressaut de pierre.</p>

        ${damageAbsorptionHtml(state.flags.stairsDamage)}

        <p>Tu restes un instant plaqué contre la roche, incapable de regarder le vide.</p>

        <p>Puis tu trouves une nouvelle prise et reprends l’ascension, beaucoup plus lentement.</p>
      `;
    },
    choices: state => state.hp <= 0
      ? fatalChoices()
      : [{ label: 'Continuer l’ascension', to: 'c50' }]
  },

  c50: {
    number: 'PAGE 50',
    title: '',
    noImage: true,
    image: 'Ceux qui sont descendus',
    text: `
      <p>L’escalier débouche sur une terrasse taillée dans la falaise.</p>
      <p>Une longue fresque couvre la paroi. Elle est divisée en plusieurs scènes que le temps a presque effacées.</p>
      <p>Dans la première, des hommes et des femmes quittent leurs maisons. Certains portent des épées, d’autres des outils ou de simples sacs.</p>
      <p>Tous marchent vers une montagne, la tête légèrement tournée, comme s’ils écoutaient quelque chose.</p>
      <p>Tu suis leurs silhouettes du doigt.</p>
      <p>Plus loin, ils descendent un escalier. Puis ils passent sous une arche marquée d’un œil fermé.</p>
      <p>Sur la scène suivante, plusieurs sont allongés au pied d’un passage. Leurs armes et leurs outils sont éparpillés autour d’eux.</p>
      <p>Un seul se tient encore debout, appuyé sur son épée. Son visage a disparu sous une fissure de la pierre.</p>
      <p>Tu regardes de nouveau les premiers voyageurs.</p>
      <p>Ils venaient d’endroits différents. Pourtant, ils ont tous pris la même direction.</p>
      <p>Tu ignores ce qui les attirait, et ce qu’ils ont trouvé au bout du chemin.</p>
    `,
    choices: [{ label: 'Examiner la gravure suivante', to: 'c51' }]
  },

  c51: {
    number: 'PAGE 51',
    title: '',
    image: 'La lame gravée',
    text: `
      <p>Un petit panneau a été gravé à part, près du bord de la terrasse.</p>
      <p>On y voit un voyageur devant une porte dont le contour se perd dans la roche.</p>
      <p>Dans sa main, une lame courte et entièrement noire.</p>
      <p>Il la lève vers un œil fermé, gravé au-dessus du passage.</p>
      <p>La scène suivante a été brisée. Il ne reste qu’une fissure et quelques éclats de pierre.</p>
      <p>Tu repenses aux notes d’Aldren : <em>« La lame noire. Trouver la lame noire. »</em></p>
      <p>Quelqu’un a donc cherché cette arme avant lui.</p>
      <p>Mais la fresque ne montre ni ce qu’il en a fait, ni ce qui l’attendait derrière la porte.</p>
    `,
    choices: [{ label: 'Reprendre l’ascension', to: 'c52' }]
  },

  c52: {
    number: 'PAGE 52',
    title: '',
    noImage: true,
    image: 'La silhouette au sommet',
    text: `
      <p>Tu quittes les fresques et reprends l’ascension.</p>

      <p>Plus haut, sur une portion encore régulière de l’escalier, une silhouette se tient debout près de la paroi.</p>

      <p>Une silhouette humaine.</p>

      <p>Après toutes les choses que tu as croisées dans ces profondeurs, sa posture presque ordinaire te surprend.</p>

      <p>Elle est trop loin pour que tu distingues son visage.</p>

      <p><strong>Et si c’était Aldren ?</strong></p>

      <p>L’homme ne semble pas t’avoir remarqué.</p>
    `,
    choices: [
      { label: 'Appeler la silhouette', to: 'c53', effect: s => { s.flags.stairsSilhouetteApproach = 'called'; } },
      { label: 'T’approcher discrètement', to: 'c54', effect: s => { s.flags.stairsSilhouetteApproach = 'stealth'; } }
    ]
  },

  c53: {
    number: 'PAGE 53',
    title: '',
    noImage: true,
    image: 'L’appel',
    text: `
      <p>« Aldren ! »</p>

      <p>Ta voix résonne entre les parois.</p>

      <p>La silhouette tourne brusquement la tête dans ta direction, puis disparaît entre deux avancées rocheuses.</p>

      <p>Tu gravis les dernières marches pour la rejoindre.</p>

      <p>À l’endroit où elle se tenait, tu découvres une fissure verticale, juste assez large pour t’y glisser de profil.</p>

      <p>Un courant d’air tiède en sort.</p>

      <p>Tu entends un frottement, quelque part à l’intérieur.</p>

      <p>Impossible de savoir si c’est bien là qu’elle s’est réfugiée.</p>
    `,
    choices: [{ label: 'Examiner les abords de la fissure', to: 'c55' }]
  },

  c54: {
    number: 'PAGE 54',
    title: '',
    image: 'La silhouette inhumaine',
    text: `
      <p>Tu avances lentement, en prenant soin de ne pas faire rouler les pierres sous tes pas.</p>

      <p>La silhouette reste immobile.</p>

      <p>À mesure que tu te rapproches, tu remarques que ses bras sont trop longs. Son dos présente une courbure anormale.</p>

      <p>Un bruit humide accompagne chacun de ses mouvements.</p>

      <p>Tu n’es plus qu’à quelques pas lorsqu’elle se retourne.</p>

      <p>Ses yeux sont injectés de sang. Sous un front presque humain, son visage présente des traits déformés que tu ne parviens pas à reconnaître.</p>

      <p>Elle pousse un râle grave et prolongé.</p>

      <p>Puis elle pivote vers la paroi et se glisse dans une étroite fissure, avec une souplesse impossible.</p>

      <p>Tu l’entends ramper quelques instants entre les pierres.</p>

      <p>Puis plus rien.</p>

      <p>Un courant d’air tiède sort de l’ouverture.</p>
    `,
    choices: [{ label: 'Rejoindre la fissure', to: 'c55' }]
  },

  c55: {
    number: 'PAGE 55',
    title: 'Devant la fissure',
    noImage: true,
    image: 'Devant la fissure',
    text: state => `
      <p>Tu t’arrêtes devant l’ouverture. La paroi est fendue sur toute la hauteur d’un homme, mais la fissure est à peine assez large pour te laisser passer de profil.</p>

      ${state.flags.stairsSilhouetteApproach === 'stealth'
        ? '<p>Tu sais que la chose au visage inhumain s’est glissée à l’intérieur. Un râle étouffé résonne encore au fond du passage.</p>'
        : '<p>La silhouette a disparu près d’ici. Un léger frottement parvient du fond du passage, mais tu ignores ce qui le produit.</p>'}

      <p>L’escalier se poursuit vers le haut, le long de la falaise.</p>

      <p>Tu peux entrer dans la fissure ou la laisser derrière toi et continuer à monter.</p>
    `,
    choices: [
      {
        label: 'T’aventurer dans la fissure',
        to: 'c56',
        effect: s => {
          if (!s.flags.stairsCrackEntered) {
            s.flags.stairsCrackEntered = true;
            s.flags.stairsCrackDamage = applyDamage(s, 2);
            s.dexPenalty = (s.dexPenalty || 0) + 1;
            raiseContamination(s, 2);
          }
        }
      },
      { label: 'Laisser la fissure derrière toi et poursuivre l’ascension', to: 'c57' }
    ]
  },

  c56: {
    number: 'PAGE 56',
    title: 'La fissure',
    image: 'La fissure',
    text: state => `
      <p>Tu t’engages de profil entre les deux parois.</p>

      <p>Après quelques pas, la lumière de l’escalier ne forme déjà plus qu’une ligne derrière toi.</p>

      <p>Tu poses une main devant toi pour chercher la roche.</p>

      <p>Une autre main se referme sur ton poignet.</p>

      <p>Tu n’as même pas le temps de crier.</p>

      <p>Quelque chose te tire brutalement dans l’obscurité.</p>

      <p>Ton épaule heurte la pierre. Ton arme racle la paroi. Tu te débats aussitôt, sans même savoir contre quoi.</p>

      <p>Tu frappes. Tu pousses avec les jambes. Tes doigts raclent la roche jusqu’à sentir la peau s’ouvrir.</p>

      <p>Autour de toi, ça fourmille.</p>

      <p>Des contacts brefs passent contre tes jambes, ton dos, ton visage. Tu ne parviens jamais à en saisir un seul assez longtemps pour comprendre ce qui te touche.</p>

      <p>Puis viennent les craquements.</p>

      <p>Un premier.</p>

      <p>Un autre.</p>

      <p>Beaucoup trop près.</p>

      <p>Tu ne sais bientôt plus s’ils viennent de la roche, de ce qui s’agite autour de toi… ou de ton propre corps.</p>

      <p>Tu continues pourtant à te débattre.</p>

      <p>Une de tes mains trouve une aspérité. Elle cède. Tu en trouves une autre. Tu tires de toutes tes forces tandis que quelque chose te retient encore dans le noir.</p>

      <p>Tu tires une dernière fois, avec tout ce qu’il te reste.</p>

      <p>Quelque chose cède dans l’obscurité.</p>

      <p>Tu bascules en arrière et parviens à t’arracher à la fissure in extremis.</p>

      <p>Tu restes à genoux contre la roche, les paumes ouvertes sur la pierre, incapable de reprendre ton souffle.</p>

      ${damageAbsorptionHtml(state.flags.stairsCrackDamage)}

      <p>De la terre noire est tassée sous tes ongles, jusque dans les chairs.</p>

      <p>Tu en as dans le coin des yeux et jusque sur les gencives. Lorsque tu tousses, tu en sens encore le goût humide au fond de ta gorge.</p>

      <p>Tu t’essuies du mieux que tu peux. Tu frottes tes doigts contre tes vêtements, puis contre la pierre.</p>

      <p>Il en reste toujours.</p>

      <p><strong>Terre noire : +2.</strong></p>

      <p><strong>Tu perds 1 point de Dextérité.</strong></p>

      <p>Tu finis par cesser de frotter.</p>

      <p>Le silence qui suit t’apaise plus qu’il ne devrait.</p>
    `,
    choices: state => state.hp <= 0
      ? fatalChoices()
      : [{ label: 'Te relever et poursuivre', to: 'c57' }]
  },

  c57: {
    number: 'PAGE 57',
    title: 'Au-dessus de la cité',
    image: 'Au-dessus de la cité',
    text: state => `
      <p>Les dernières portions de l’ascension débouchent sur une plateforme stable.</p>

      <p>Le vide s’ouvre devant toi.</p>

      <p>Et, très loin en contrebas, tu vois enfin où mènent les constructions.</p>

      <p>Un village de pierre s’étage sur les pentes de la cavité.</p>

      <p>De petites maisons bordent des rues étroites. Tu distingues une place, des escaliers entre les habitations et ce qui ressemble à des ateliers.</p>

      <p>Très haut, une immense ouverture laisse voir le ciel. Le soleil éclaire les toits, les terrasses et une grande partie des rues. Seuls les passages couverts et les quartiers adossés à la roche restent dans l’ombre.</p>
      <p>À cette distance, les portes et les fenêtres paraissent presque accueillantes.</p>
      <p>Un escalier taillé dans la falaise descend vers une porte du quartier haut.</p>

      <p>Juste avant la porte repose le squelette d’un homme.</p>

      <p>Une de ses mains porte encore un <strong>gantelet</strong> articulé de métal sombre — le gant d’armure d’un chevalier ou d’un Veilleur.</p>

      <p>Les plaques sont fines, mais intactes.</p>

      ${hasItem(state, 'gantelet_veilleur') ? '<p>Tu as déjà ajouté le gantelet à ton équipement.</p>' : '<p>Il pourrait encore encaisser un coup à ta place.</p>'}
    `,
    choices: state => hasItem(state, 'gantelet_veilleur')
      ? [{ label: 'Franchir la porte et entrer dans les quartiers hauts', to: 'c67' }]
      : [
          {
            label: 'Prendre le Gantelet de Veilleur (+1 Protection)',
            to: 'c128',
            effect: s => addProtectiveItem(s, 'gantelet_veilleur', 'Gantelet de Veilleur', 'Un gant d’armure articulé trouvé au-dessus de la Cité morte. Il peut absorber 1 point de dégâts avant ta Vie.', 1)
          },
          { label: 'Le laisser et franchir la porte', to: 'c67' }
        ]
  },

  c58: {
    number: 'PAGE 58',
    title: 'La corniche du vide',
    image: 'La corniche du vide',
    onEnter: s => { s.flags.worldRoute = 'bridge'; },
    text: `
      <p>Tu choisis la corniche.</p>

      <p>Elle ne fait parfois pas plus de deux pieds de large.</p>

      <p>À ta droite, la falaise.</p>

      <p>À ta gauche, un vide rempli d’une brume bleuâtre dont tu ne vois pas le fond.</p>

      <p>De vieux pitons sont encore plantés dans la roche.</p>

      <p>Certains portent des fragments de corde rouge durcie par le temps.</p>

      <p>La corniche contourne un éperon.</p>

      <p>Le pont est désormais devant toi.</p>

      <p>Long. Étroit. Suspendu entre deux masses de pierre.</p>

      <p>Ses planches sont noires et ses cordes presque minérales.</p>

      <p>De l’autre côté, une porte se devine dans la falaise.</p>

      <p>Tu poses un pied sur la première planche.</p>

      <p>Elle tient.</p>

      <p>Tu commences la traversée.</p>
    `,
    choices: [
      { label: 'Avancer sur le pont', to: 'c59' }
    ]
  },

  c59: {
    number: 'PAGE 59',
    title: '',
    image: 'Les pas sous tes pieds',
    text: state => `
      <p>Tu as parcouru presque un tiers du pont lorsque tu entends un pas.</p>

      <p>Pas derrière toi.</p>

      <p><strong>Sous toi.</strong></p>

      <p>Tu t’arrêtes.</p>

      <p>Le bruit s’arrête.</p>

      <p>Tu avances d’une planche.</p>

      <p>Un autre pas répond sous le bois.</p>

      <p>Tu regardes entre deux lattes.</p>

      <p>Quelque chose se déplace sur la face inférieure du pont.</p>

      <p>Comme si le vide était son ciel et les planches son sol.</p>

      <p>Tu ne distingues qu’un dos maigre, des membres trop longs et des doigts refermés autour des cordes.</p>

      <p>Il avance exactement à ton rythme.</p>

      ${state.throwingBlades > 0
        ? `<p>Tu as encore <strong>${state.throwingBlades} lame${state.throwingBlades > 1 ? 's' : ''} de jet</strong>.</p>`
        : ''}
    `,
    choices: state => {
      const list = [
        { label: 'Garder ton calme et continuer lentement', to: 'c129', effect: s => { s.flags.bridgeSolution = 'calm'; s.flags.bridgeCalmPassed = roll3D6(s, 'Dextérité', currentDexterity(s)); } }
      ];
      if (state.throwingBlades > 0) {
        list.push({
          label: 'Lancer une lame dans le vide pour l’attirer ailleurs',
          to: 'c130',
          effect: s => {
            s.throwingBlades -= 1;
            syncThrowingBlades(s);
            s.flags.bridgeSolution = 'blade';
          }
        });
      }
      list.push(
        {
          label: 'Courir jusqu’à l’autre côté',
          to: 'c60',
          effect: s => {
            const ok = roll3D6(s, 'Dextérité', currentDexterity(s));
            s.flags.bridgeRun = ok ? 'success' : 'fail';
            if (!ok) { s.flags.bridgeRunDamage = applyDamage(s, 1); /* Chute ordinaire : aucune contamination. */ }
          }
        },
        { label: 'Frapper la chose à travers les planches', to: 'c61', effect: s => { if (s.combats?.bridgeWalker?.hp <= 0) replayCombat(s, 'bridgeWalker'); } }
      );
      return list;
    }
  },

  c60: {
    number: 'PAGE 60',
    title: '',
    image: 'La course sur le pont',
    text: state => {
      const r = diceResultHtml(state);
      if (state.flags.bridgeRun === 'success') {
        return r + `
          <p>Tu pars d’un seul coup.</p>

          <p>Le pont se balance sous tes pas.</p>

          <p>La chose accélère immédiatement sous toi.</p>

          <p>Ses doigts frappent le bois comme une pluie sèche.</p>

          <p>Une planche cède derrière ton talon.</p>

          <p>Tu sautes la dernière longueur et t’écrases sur la pierre de l’autre côté.</p>

          <p>Lorsque tu te retournes, la créature est restée sous le pont.</p>

          <p>Elle ne te suit pas sur la roche.</p>
        `;
      }
      return r + `
        <p>Tu te mets à courir.</p>

        <p>Le pont se balance violemment.</p>

        <p>Ton pied traverse une planche pourrie.</p>

        <p>Tu t’effondres sur un genou.</p>

        ${damageAbsorptionHtml(state.flags.bridgeRunDamage)}

        <p>Avant que tu puisses te relever, deux longs doigts passent entre les lattes et se referment sur le bord.</p>

        <p>La chose remonte.</p>
      `;
    },
    choices: state => {
      if (state.hp <= 0) return fatalChoices();
      return state.flags.bridgeRun === 'success'
        ? [{ label: 'Reprendre ton souffle', to: 'c63' }]
        : [{ label: 'Te défendre', to: 'c61', effect: s => { if (s.combats?.bridgeWalker?.hp <= 0) replayCombat(s, 'bridgeWalker'); } }];
    }
  },

  c61: {
    number: 'PAGE 61',
    title: '',
    image: 'Le marcheur sous le pont',
    text: state => `
      <p>La créature pivote autour d’une corde avec une facilité déconcertante.</p>

      <p>Elle remonte jusqu’au bord du pont.</p>

      <p>De loin, sous les planches, ton esprit avait trouvé une explication : un corps très maigre, muni de membres trop longs.</p>

      <p>Maintenant qu’elle est près de toi, cette explication se défait à son tour.</p>

      <p>Tu reconnais par instants une articulation, une extrémité appuyée sur le bois, quelque chose qui pourrait être un torse.</p>

      <p>Mais lorsque ton regard essaie de suivre l’un de ces éléments jusqu’au suivant, l’ensemble cesse de tenir.</p>

      <p>Tu ne comprends pas comment elle reste sous le pont.</p>

      <p>Après quelques secondes, tu n’es même plus certain qu’elle possède un côté tourné vers toi.</p>

      <p>Puis trois coups secs résonnent dans toute la caverne.</p>

      <p><strong>TOC. TOC. TOC.</strong></p>


      <p>Le son descend très loin sous le pont.</p>

      <p>Quelques secondes plus tard, depuis les profondeurs où s’étend le lac noir, trois coups beaucoup plus faibles semblent lui répondre.</p>

      <p>Cette fois, il n’y a plus de place pour l’éviter.</p>

      ${enemyCardHtml(state, 'bridgeWalker', ENEMIES.bridgeWalker)}
    `,
    choices: state => combatActionChoices(state, 'bridgeWalker', ENEMIES.bridgeWalker, 'c62')
  },

  c62: {
    number: 'PAGE 62',
    title: '',
    image: 'Le combat au-dessus du vide',
    text: state => {
      const combat = combatState(state, 'bridgeWalker', ENEMIES.bridgeWalker);
      const result = combat.lastBlade ? throwingBladeResultHtml(state, 'bridgeWalker', ENEMIES.bridgeWalker) : combatRoundHtml(state, 'bridgeWalker', ENEMIES.bridgeWalker);
      const card = enemyCardHtml(state, 'bridgeWalker', ENEMIES.bridgeWalker);

      if (combat.hp <= 0) {
        const finish = combat.lastBlade
          ? '<p>La lame frappe. Une de ses prises cède, puis une autre. Son corps se décroche du pont.</p>'
          : '<p>Ton dernier coup le décroche du pont.</p>';
        return card + result + `
          ${finish}

          <p>Ses doigts cherchent une prise, mais son bras ne répond plus correctement.</p>

          <p>Son corps bascule et disparaît dans la brume.</p>

          <p>Tu restes quelques secondes à surveiller les cordes sous tes pieds.</p>

          <p>Rien ne remonte.</p>

          <p>Cette fois, tu es presque certain qu’il ne pourra pas revenir.</p>
        `;
      }

      if (state.hp <= 0) {
        return card + result + `
          <p>Le choc te fait perdre l’équilibre.</p>

          <p>La dernière chose que tu vois est la créature qui se replie sous le pont pendant que le vide t’emporte.</p>
        `;
      }

      if (combat.lastBlade) {
        return card + result + `
          ${combat.lastBlade.success?'<p>La lame frappe le haut de son corps. Un membre lâche une corde puis en retrouve une autre.</p>':'<p>La lame siffle dans le vide et disparaît dans la brume.</p>'}
          <p>La créature revient déjà vers toi.</p>
        `;
      }

      if (combat.last && combat.last.outcome === 'enemy') {
        return card + result + `
          <p>La créature te heurte puis disparaît sous le pont.</p>

          <p>Tu n’as pas le temps de souffler : quelques planches plus loin, une prise se referme déjà sur le bois.</p>

          <p>Elle revient immédiatement, sans ralentir, sans protéger quoi que ce soit de son propre corps.</p>
        `;
      }

      if (combat.last && combat.last.outcome === 'tie') {
        return card + result + `
          <p>Tu frappes au moment où elle se jette sur toi.</p>

          <p>Vos mouvements se neutralisent et vous vous séparez sans parvenir à prendre l’avantage.</p>

          <p>Le pont continue de se balancer tandis que la chose reprend prise sous les planches.</p>
        `;
      }

      return card + result + `
        <p>Ton coup porte.</p>

        <p>L’impact tord la créature autour d’une corde et une partie de son corps pend un instant dans le vide.</p>

        <p>Puis elle se hisse de nouveau vers toi.</p>

        <p>Ni plus lentement, ni plus prudemment.</p>

        <p>La blessure existe. Elle ne semble simplement avoir aucune importance pour elle.</p>
      `;
    },
    choices: state => {
      const combat = combatState(state, 'bridgeWalker', ENEMIES.bridgeWalker);
      if (combat.hp <= 0) return [{ label: 'Achever la traversée', to: 'c63' }];
      if (state.hp <= 0) return fatalChoices();
      return combatActionChoices(state, 'bridgeWalker', ENEMIES.bridgeWalker, 'c62', 'Continuer le combat');
    }
  },

  c63: {
    number: 'PAGE 63',
    title: 'L’autre extrémité du pont',
    image: 'L’autre extrémité du pont',
    text: state => {
      const intro = state.flags.bridgeSolution === 'calm'
        ? `<p>Tu continues à avancer sans accélérer.</p><p>La chose reste sous toi jusqu’aux dernières planches, puis s’arrête exactement à la limite de la roche.</p><p>Elle ne franchit pas le bord.</p>`
        : '';
      return `
        ${intro}

        <p>Tu atteins enfin l’autre extrémité du pont.</p>

        <p>Près d’un ancien point d’ancrage, un corps desséché repose contre la pierre.</p>

        <p>Des lambeaux de chair noire maintiennent encore une partie des os entre eux.</p>

        <p>Le crâne, lui, a roulé un peu plus loin, entre deux pierres.</p>

        <p>Autour de la taille, le mort porte encore une étrange ceinture faite de corde rouge tressée.</p>

        <p>Elle ressemble aux fragments aperçus sur les pitons de la corniche.</p>

        <p>Le nœud est intact malgré l’âge.</p>

        <p>Sur une petite plaque de cuivre est gravé l’œil fermé.</p>

        <p>Une sacoche de cuir desséché pend encore à son côté.</p>
      `;
    },
    choices: state => {
      const choices = [];
      choices.push({ label: state.flags.bridgeSatchelSearched ? 'Relire le parchemin dans la sacoche' : 'Fouiller la sacoche du mort', to: 'c65' });
      {
        choices.push({
          label: hasItem(state, 'ceinture_rouge') ? 'Réexaminer la Ceinture de corde rouge' : 'Prendre la Ceinture de corde rouge',
          to: 'c131',
          effect: s => {
            if (!s.flags.bridgeCordTaken && !s.visited?.c131 && !hasItem(s, 'ceinture_rouge')) addItem(
              s,
              'ceinture_rouge',
              'Ceinture de corde rouge',
              'Une ceinture des Veilleurs. Elle accorde +1 Force lors des tests pour grimper, retenir ou se suspendre.'
            );
          }
        });
      }
      choices.push({ label: 'Laisser le corps et rejoindre la porte', to: 'c64' });
      return choices;
    }
  },

  c64: {
    number: 'PAGE 64',
    title: 'La porte suspendue',
    image: 'La porte suspendue',
    text: `
      <p>Une porte de bois renforcé ferme le passage creusé dans la falaise. Sa hauteur suffit à peine à laisser passer un homme en armure.</p>

      <p>Derrière elle, un escalier descend en suivant la roche. À mesure que tu avances, la lumière du jour se fait de plus en plus présente.</p>

      <p>Une immense ouverture dans la voûte de la caverne laisse apparaître le ciel. Sous cette lumière se dévoilent les toits de pierre, les cheminées et les fenêtres du quartier haut. Rien ne distingue ces maisons de celles d’un village ordinaire, sinon l’immense caverne qui les abrite.</p>

      <p>L’escalier aboutit à une passerelle bordée d’un parapet. Tu la traverses et rejoins une rue étroite, bordée de maisons silencieuses.</p>

      <p>Une porte est restée entrouverte. Des seaux abandonnés reposent près du seuil. Pas une voix, pas un bruit d’atelier.</p>

      <p>Plus bas, un escalier descend vers une place baignée de soleil.</p>
    `,
    choices: [{ label: 'Rejoindre la place', to: 'c69' }]
  },

  // La rue haute de l'ancienne page 65 a été regroupée à la page 64.
  // La page 65 sert désormais à la découverte facultative de la sacoche du pont.
  c65: {
    number: 'PAGE 65',
    title: 'La sacoche du Veilleur',
    noImage: true,
    onEnter: s => {
      if (!s.flags.bridgeSatchelSearched) {
        s.flags.bridgeSatchelSearched = true;
        s.throwingBlades = (s.throwingBlades || 0) + 3;
        syncThrowingBlades(s);
      }
    },
    text: state => `
      ${state.history?.filter(id => id === 'c65').length > 1
        ? '<p>Tu rouvres la sacoche. L’emplacement des trois lames est vide, le parchemin est toujours là.</p>'
        : '<p>Tu ouvres la sacoche. À l’intérieur, trois lames de jet sont enveloppées dans un morceau de toile, à côté d’un parchemin plié.</p>'}

      <p>Un œil fermé est imprimé au bas du texte.</p>

      <blockquote>« Nouvel ordre reçu :<br>
      Garder le pont dans les deux sens.<br>
      Nul ne doit désormais quitter la cité.<br>
      Toute tentative de fuite sera punie de mort.<br>
      Tout garde refusant d’appliquer cet ordre subira la même peine. »</blockquote>

      ${state.history?.filter(id => id === 'c65').length > 1
        ? '<p>Les trois lames de cette sacoche ont déjà été récupérées.</p>'
        : `<p>Tu ranges les trois lames de jet dans ton équipement.</p><p><strong>Tu possèdes maintenant ${state.throwingBlades} lame${state.throwingBlades > 1 ? 's' : ''} de jet.</strong></p>`}
    `,
    choices: state => {
      return [
        {
          label: hasItem(state, 'ceinture_rouge') ? 'Réexaminer la Ceinture de corde rouge' : 'Prendre aussi la Ceinture de corde rouge',
          to: 'c131',
          effect: s => {
            if (!s.flags.bridgeCordTaken && !s.visited?.c131 && !hasItem(s, 'ceinture_rouge')) addItem(
              s,
              'ceinture_rouge',
              'Ceinture de corde rouge',
              'Une ceinture des Veilleurs. Elle accorde +1 Force lors des tests pour grimper, retenir ou se suspendre.'
            );
          }
        },
        { label: 'Laisser la ceinture et rejoindre la porte', to: 'c64' }
      ];
    }
  },


  c66: {
    number: 'PAGE 66',
    title: 'Les quartiers noyés',
    noImage: true,
    image: 'Les quartiers noyés',
    text: state => `
      <p>Tu passes sous les arches basses.</p>

      <p>L’eau noire recouvre encore le sol par endroits.</p>

      <p>Des marches descendent vers des portes dont le bas a disparu sous l’eau. Derrière une fenêtre, tu distingues encore le dossier d’une chaise.</p>

      <p>Tu avances sur les portions sèches de la rue. De petites enseignes de bois pourrissent au-dessus d’anciens ateliers, les seuils sont usés par des années de passage.</p>

      <p>L’eau sombre se confond presque avec les pierres. Le clapotis de tes bottes est le seul bruit dans ce quartier désert.</p>
      <p>Une rampe de pierre finit par remonter vers une rue plus élevée. Un peu de lumière chaude apparaît à son sommet.</p>

      <p>Au sommet, les rues deviennent sèches.</p>
    `,
    choices: [
      { label: 'Suivre la grande rue', to: 'c69' }
    ]
  },

  c67: {
    number: 'PAGE 67',
    title: 'Les quartiers hauts',
    image: 'Les quartiers hauts',
    text: `
      <p>Tu entres dans la cité par le haut.</p>

      <p>Les maisons sont bâties en terrasses le long de la pente. Un petit escalier mène d’une rue à l’autre, des murets retiennent les jardins aujourd’hui desséchés.</p>
      <p>Les passages couverts restent dans l’ombre. Plus bas, le soleil éclaire la place et les toits des maisons qui l’entourent.</p>
      <p>Tu passes devant un atelier. Des outils sont encore posés sur l’établi, près d’une porte fermée.</p>

      <p>Plus bas, des marques de craie et de petits symboles de l’œil fermé indiquent les passages utilisés par les Veilleurs.</p>

      <p>Tu les suis jusqu’à la grande rue centrale.</p>
    `,
    choices: [
      { label: 'Suivre la grande rue', to: 'c69' }
    ]
  },

  // Page retirée du parcours : une ancienne sauvegarde sur cette page reste lisible.
  c68: {
    number: 'PAGE 68',
    title: 'Vers la place',
    noImage: true,
    text: `<p>Tu achèves la descente du quartier haut. La place ensoleillée est toute proche.</p>`,
    choices: [{ label: 'Rejoindre la place', to: 'c69' }]
  },

  c69: {
    number: 'PAGE 69',
    title: 'La Cité morte',
    image: 'La Cité morte',
    onEnter: s => setCheckpoint(s, 'La Cité morte'),
    text: state => {
      const otherWays = [];
      if (state.flags.worldRoute !== 'lake') otherWays.push('une rampe remonte depuis les quartiers noyés');
      if (state.flags.worldRoute !== 'stairs') otherWays.push('un escalier descend entre les maisons des quartiers hauts');
      if (state.flags.worldRoute !== 'bridge') otherWays.push('une ruelle rejoint la passerelle d’accès au pont');
      const routesLine = otherWays.length
        ? `<p>Un peu plus loin, d’autres ouvertures rejoignent l’avenue. ${otherWays.join(', ')}.</p><p>Au sol, d’anciennes traces de passage convergent depuis chacune d’elles vers la place.</p>`
        : '';
      const contamination = state.flags.blackEarthContamination
        ? '<p>Le goût de terre resté au fond de ta gorge revient tandis que tu fixes la vasque.</p>'
        : '';
      return `
        <p>Le passage que tu suivais rejoint la rue principale.</p>
        <p>Des maisons de pierre se serrent de chaque côté. Leurs portes, leurs fenêtres et leurs cheminées ont des dimensions familières. Sous un auvent, des outils attendent encore sur un établi.</p>
        ${routesLine}
        <p>Une chaise est restée près d’un seuil. Tu pourrais presque croire que quelqu’un va sortir pour la rentrer.</p>
        <p>Des lanternes à huile, toutes éteintes, pendent devant certaines maisons.</p>
        <p>Mais aucune porte ne s’ouvre.</p>
        <p>La rue débouche sur une petite place circulaire. Très haut au-dessus des toits, la grande ouverture de la voûte laisse entrer le jour. Le soleil éclaire les pavés, les façades et les terrasses alentour.</p>
        <p>Au-delà de cette trouée lumineuse, la caverne demeure immense et sombre. Le village, lui, paraît presque prêt à reprendre vie.</p>
        <p>Au centre repose une large vasque de pierre. Une fine couche de sable noir en tapisse le fond.</p>
        <p>Tu t’en approches.</p>
        <p>Les grains semblent remuer, bien qu’aucun souffle ne traverse la place.</p>
        <p>Tu éprouves soudain le besoin d’y plonger la main. L’idée paraît parfaitement naturelle : tu es certain que quelque chose d’utile se trouve là.</p>
        ${contamination}
        <p>Tu tends les doigts.</p>
        ${contaminationLevel(state) >= 4
          ? '<p>Une force tente de rejeter ton bras en arrière, mais ton geste ne s’interrompt qu’après une douleur aiguë. Tu retires la main juste avant de toucher la poudre.</p>'
          : '<p>À quelques centimètres de la poudre, ton bras se replie brutalement contre ta poitrine, comme tiré par une main invisible. Une douleur fulgurante te traverse le crâne. Tu recules d’un bond et tombes à genoux.</p>'}
        <p>La douleur cesse aussitôt.</p>
        <p>Tu fixes la vasque. Quelques grains ont glissé sur le bord. Là où ils touchent la pierre, une tache sombre s’étend lentement.</p>
        <p>Tu aurais plongé la main dedans sans cette brusque injonction qui a arrêté ton geste.</p>
        <p>Qui vient de t’arrêter ?</p>
        <p>De l'autre côté de la place, une paroi entière est couverte de gravures monumentales.</p>
        <p>La dernière figure visible depuis ici porte le symbole de l'œil fermé.</p>
        <p>Tu traverses la place pour examiner ces scènes.</p>
      `;
    },
    choices: [{ label: 'Examiner les grandes gravures', to: 'c70' }]
  },

  c70: {
    number: 'PAGE 70',
    title: 'Les bâtisseurs',
    image: 'Les bâtisseurs de la cité',
    text: `
      <p>La première scène montre des hommes et des femmes bâtissant les maisons de la cité. Ils portent des blocs, posent des poutres et aménagent les rues.</p>
      <p>Tu reconnais la place et les façades qui l’entourent. Ce sont leurs ouvrages.</p>
      <p>Au bord de la gravure, plusieurs routes quittent la cité vers des vallées de surface. L’une semble suivre les collines de Valombre. Tu n’en es pas certain.</p>
      <p>Plus loin, les bâtisseurs abandonnent leurs outils. Ils se réunissent autour d'une ouverture qui descend sous la cité.</p>
      <p>Sur les vêtements de certains apparaît un signe que tu connais déjà : <strong>l'œil fermé</strong>.</p>
      <p>Tu avances vers la scène suivante.</p>
    `,
    choices: [{ label: 'Suivre la fresque', to: 'c71' }]
  },

  c71: {
    number: 'PAGE 71',
    title: 'La porte scellée',
    image: 'La construction de la prison',
    text: `
      <p>La gravure suivante montre une forme immense au fond d'une cavité.</p>
      <p>La pierre a été abîmée à cet endroit. Impossible de savoir ce que les bâtisseurs avaient voulu représenter.</p>
      <p>Autour de cette forme, les hommes dressent des murs, condamnent des galeries et placent d'énormes blocs au-dessus de la cavité.</p>
      <p>Dans la dernière scène, ils ferment une porte monumentale. L'œil fermé est gravé au centre de son battant.</p>
      <p>Les mêmes hommes portent ce symbole sur leurs vêtements.</p>
      <p><strong>Les premiers Veilleurs ont construit une prison sous la cité.</strong></p>
      <p>Mais rien, sur cette partie de la fresque, n'explique ce qui les a poussés à enfermer la forme immense.</p>
    `,
    choices: [{ label: 'Examiner la suite des gravures', to: 'c72' }]
  },

  c72: {
    number: 'PAGE 72',
    title: 'L’appel',
    noImage: true,
    image: 'L’appel à travers la pierre',
    text: `
      <p>La prison est achevée sur la scène suivante.</p>
      <p>De longues lignes partent de la forme enfermée. Elles traversent les murs et atteignent la tête de silhouettes éloignées.</p>
      <p>Sur la gravure d'après, ces personnes quittent leurs maisons. Certaines emportent des outils, d'autres des armes. Elles marchent vers la cité, puis vers la porte scellée.</p>
      <p>L'une d'elles tient une épée.</p>
      <p>Tu repenses au parchemin d'Aldren :</p>
      <blockquote>IL FAUT OUVRIR L’ŒIL FERMÉ.</blockquote>
      <p>Quelque chose appelle depuis sa prison et cherche à faire venir quelqu'un jusqu'à la porte.</p>
      <p>Est-ce la même volonté qui t'a repoussé de la vasque ?</p>
      <p>Et Aldren a-t-il lui aussi suivi cet appel ?</p>
    `,
    choices: [{ label: 'Regarder la dernière partie de la fresque', to: 'c73' }]
  },

  c73: {
    number: 'PAGE 73',
    title: 'Le seuil',
    image: 'Les voyageurs au seuil',
    text: `
      <p>La dernière scène représente plusieurs voyageurs au pied de la porte.</p>
      <p>Certains sont étendus sur le sol. Un autre avance encore, une main appuyée contre la pierre. Il tient une lame courte dont la surface a été noircie par le graveur.</p>
      <p>Le panneau qui aurait montré ce qui vient ensuite a été brisé. Il n'en reste que le bord.</p>
      <p>Tu sais maintenant que d'autres ont été attirés ici avant toi. La fresque ne dit pas s'ils ont réussi à ouvrir la porte, ni pourquoi tant d'entre eux sont tombés.</p>
      <p>Tu regardes une dernière fois l'œil fermé.</p>
      <p>Si quelque chose veut sortir, pourquoi les Veilleurs ont-ils fait tant d'efforts pour l'en empêcher ?</p>
      <p>La réponse ne figure pas sur cette paroi.</p>
      <p>Sur ta droite, un passage rejoint les anciennes salles habitées. Deux autres ouvertures s'enfoncent sous les bâtiments.</p>
    `,
    choices: [{ label: 'Rejoindre les trois accès', to: 'c74' }]
  },

  c74: {
    number: 'PAGE 74',
    title: 'Trois chemins dans la cité',
    image: 'Le carrefour des Veilleurs',
    text: `
      <p>Tu atteins un carrefour où trois passages s'éloignent de la place.</p>
      <p>Le premier conduit vers des pièces à taille humaine. Des tables et des bancs sont visibles derrière une porte restée ouverte.</p>
      <p>Le deuxième est bordé de cellules aux portes épaisses. Une plaque indique : QUARTIER D’OBSERVATION.</p>
      <p>Le troisième s’enfonce sous une arche de pierre portant l’œil fermé.</p>
      <p>Tu dois choisir par où continuer.</p>
    `,
    choices: [
      { label: 'Explorer les anciens quartiers des Veilleurs', to: 'c75', effect: s => { s.flags.cityRoute = 'quarters'; } },
      { label: 'Explorer le quartier d’observation', to: 'c92', effect: s => { s.flags.cityRoute = 'observation'; } },
      { label: 'Passer sous l’arche à l’œil fermé', to: 'c99', effect: s => { s.flags.cityRoute = 'laboratory'; } }
    ]
  },

  c75: {
    number: 'PAGE 75', title: 'Les quartiers des Veilleurs', noImage: true, image: 'Le carrefour des quartiers',
    text: `
      <p>Les anciennes salles d'habitation se déploient autour d'un petit vestibule. Une odeur de cendre froide flotte encore dans l'air. Des lampes à huile éteintes sont accrochées aux murs, les passages restent dans la pénombre.</p>
      <p>Une arche ouvre sur le réfectoire. Plus loin, le couloir dessert un poste de garde, puis les bureaux du commandement.</p>
      <p>Tu entres dans le réfectoire.</p>`,
    choices: [{ label: 'Entrer dans le réfectoire', to: 'c76' }]
  },
  c76: {
    number: 'PAGE 76', title: 'Le réfectoire', image: 'Le réfectoire des Veilleurs',
    text: `
      <p>De longues tables occupent la salle. Des bols d'argile sont alignés près d'une cheminée éteinte. Des manteaux pendent à des crochets.</p>
      <p>Sur un mur, quelqu'un a dessiné des maisons, des champs et des familles réunies autour d'un foyer.</p>
      <p>Sous le dessin, une devise est gravée :</p>
      <blockquote>QUE NOTRE VEILLE PRÉSERVE CEUX QUI VIVENT AU-DESSUS.</blockquote>
      <p>Les Veilleurs mangeaient et dormaient ici. Ils avaient des proches à la surface, tout comme toi.</p>
      <p>Au fond du réfectoire, un passage conduit au poste de garde.</p>`,
    choices: [{ label: 'Poursuivre vers la salle de garde', to: 'c77', effect: s => { s.flags.quartersRefectory = true; } }]
  },
  c77: {
    number: 'PAGE 77', title: 'Les consignes de garde', noImage: true, image: 'Le poste de garde',
    text: `
      <p>Un plan des galeries couvre le mur du poste. Sur un pupitre, les premiers registres parlent de rondes, de réserves et de surveillance des accès.</p>
      <p>Puis viennent des consignes concernant ceux qui entendent l'appel :</p>
      <blockquote>TOUTE PERSONNE ENTENDANT L’APPEL DOIT ÊTRE CONDUITE AUX SALLES DE SOINS.</blockquote>
      <p>Plus loin, une autre main ordonne d'isoler toute personne attirée vers la prison.</p>
      <p>D’autres manuscrits remplissent une étagère. Au vu de leur nombre, les examiner tous te prendrait beaucoup de temps. Tu ne sais toujours pas si Aldren est en vie.</p>`,
    choices: [
      { label: 'Rester et examiner les autres manuscrits', to: 'c78', effect: s => { s.flags.quartersGuard = true; s.flags.guardStayed = true; } },
      { label: 'Rejoindre les bureaux du commandement', to: 'c82', effect: s => { s.flags.quartersGuard = true; } }
    ]
  },
  c78: {
    number: 'PAGE 78', title: 'Les derniers manuscrits', noImage: true, image: 'Les registres oubliés',
    text: `
      <p>Tu ouvres un registre relié de cuir noir. Deux gardes y sont décrits après avoir reçu volontairement de la terre noire.</p>
      <blockquote>ILS NE RÉPONDENT PLUS À L'APPEL. LEURS ORDRES DE GARDE RESTENT MAL COMPRIS.</blockquote>
      <p>Une note plus récente indique qu'ils ont été enfermés près du poste. Leurs corps se sont déformés, mais ils réagissent encore au moindre mouvement.</p>
      <p>Tu tournes une autre page.</p>
      <p>Un grattement vient de la porte, derrière toi.</p>
      <p>Puis un second.</p>
      <p>La poignée s'abaisse.</p>`,
    choices: [{ label: 'Dégainer et faire face', to: 'c79', effect: s => { if (s.sentinelFight?.hp?.every(h => h <= 0)) replaySentinels(s); } }]
  },
  c79: {
    number: 'PAGE 79', title: 'Les deux sentinelles', image: 'Les sentinelles contaminées',
    text: s => `
      <p>Deux silhouettes entrent dans le poste de garde. Elles portent les restes d'un uniforme.</p>
      <p>Leurs traits demeurent presque humains. Une terre noire et épaisse coule de leurs bouches.</p>
      <p>L'une avance devant toi. L'autre contourne le pupitre.</p>
      <p>Tu dois affronter les deux. Au corps à corps, chacune peut te frapper tant qu'elle tient debout. Une lame de jet offre un tir sans riposte immédiate.</p>
      ${sentinelCardsHtml(s)}`,
    choices: s => sentinelChoices(s)
  },
  c80: {
    number: 'PAGE 80', title: 'Deux contre un', image: 'Le combat dans le poste de garde',
    text: s => `
      <p>Les deux sentinelles te pressent dans l'espace étroit du poste de garde.</p>
      ${sentinelCardsHtml(s)}
      ${s.flags.sentinelResultAcknowledged ? "" : sentinelResultHtml(s)}
      ${(s.sentinelFight && s.sentinelFight.hp.every(h => h <= 0)) ? '<p>Les deux gardiens sont tombés. Le silence revient. Une porte ouverte au fond du poste conduit à l’ancienne armurerie.</p>' : ''}`,
    choices: s => s.hp <= 0 ? fatalChoices() : (s.sentinelFight && s.sentinelFight.hp.every(h => h <= 0))
      ? [{ label: 'Fouiller l’armurerie', to: 'c81' }]
      : sentinelChoices(s)
  },
  c81: {
    number: 'PAGE 81', title: 'L’armurerie', image: 'La réserve d’armes',
    text: s => `
      <p>Des râteliers longent les murs. Les épées et les casques qu'ils supportent sont rongés par la rouille.</p>
      ${s.flags.armoryBladesTaken || s.visited?.c136
        ? '<p>La boîte où tu avais trouvé les cinq lames est maintenant vide.</p>'
        : '<p>Dans une boîte restée fermée, tu trouves cinq petites lames de jet encore en état de servir.</p><p>Tu peux les emporter. Aucun autre équipement ne paraît sûr.</p>'}`,
    choices: s => [
      ...(!(s.flags.armoryBladesTaken || s.visited?.c136)
        ? [{ label: 'Prendre les cinq lames de jet', to: 'c136', effect: t => {
            if (!t.flags.armoryBladesTaken && !t.visited?.c136) {
              t.throwingBlades += 5;
              syncThrowingBlades(t);
              t.flags.armoryBladesTaken = true;
            }
            t.flags.armoryLooted = true;
          } }]
        : []),
      { label: (s.flags.armoryBladesTaken || s.visited?.c136) ? 'Rejoindre les bureaux' : 'Laisser les lames et rejoindre les bureaux', to: 'c82', effect: t => { t.flags.armoryLooted = true; } }
    ]
  },
  c82: {
    number: 'PAGE 82', title: 'Le bureau fermé', noImage: true, image: 'La porte du commandement',
    text: `
      <p>Une porte renforcée ferme le bureau du commandement. Sa serrure ne répond plus. Au-delà, un passage permet de rejoindre les appartements sans y entrer.</p>
      <p>Des marques de coups autour du verrou montrent que quelqu'un a déjà essayé de forcer l'entrée.</p>
      <p>Tu peux tenter ta chance, ou poursuivre les recherches d'Aldren.</p>`,
    choices: s => [
          { label: 'Tenter d’enfoncer la porte — épreuve de Force', to: 'c83', effect: s => { s.flags.officeAttempted = true; s.flags.officeOpened = roll3D6(s, 'Force', currentForce(s)); s.flags.officeRollCount = s.rollCount; } },
          { label: 'Laisser la porte et gagner les appartements', to: 'c84' }
        ]
  },
  c83: {
    number: 'PAGE 83', title: '', noImage: true, image: 'Le bureau des ordres',
    text: s => s.flags.officeOpened ? `
      ${s.flags.officeRollCount === s.rollCount ? diceResultHtml(s) : ''}
      <p>La porte cède. Des tablettes et des registres sont restés ouverts sur un pupitre.</p>
      <p>Les premières instructions prévoient d'isoler les personnes contaminées et de chercher des soins. Les suivantes ont changé de ton :</p>
      <blockquote>AU PREMIER SOUPÇON, EXÉCUTER.</blockquote>
      <p>Plusieurs condamnations portent une seule justification : « Soupçon ».</p>
      <p>Dans la marge, une autre main a écrit : « Et si nous nous trompions ? » La phrase a été rayée jusqu'à creuser la pierre.</p>` : `
      ${s.flags.officeRollCount === s.rollCount ? diceResultHtml(s) : ''}
      <p>Tu pousses de toutes tes forces. La serrure grince, mais la porte tient bon.</p>
      <p>Tu renonces à t'acharner et rejoins le passage des appartements.</p>`,
    choices: [{ label: 'Rejoindre les appartements', to: 'c84' }]
  },
  c84: {
    number: 'PAGE 84', title: 'Les derniers jours', image: 'Les appartements désertés',
    text: `
      <p>Les lits sont renversés. Des vêtements gisent dans les couloirs. Un coup de hache a entaillé une porte.</p>
      <p>Dans une chambre, deux rapports datés du même jour se contredisent.</p>
      <p>L'un exige l'élimination de tous ceux qui refusent les condamnations. L'autre réclame des preuves avant de tuer, et la poursuite des soins.</p>
      <p>Au bas de ce second rapport : « Arrêté pour refus d'obéir. »</p>
      <p>Les Veilleurs avaient commencé par protéger les habitants. Ils ont fini par se retourner contre les leurs.</p>
      <p>Tu traverses les appartements vers la sortie.</p>`,
    choices: [{ label: 'Gagner la galerie de sortie', to: 'c85' }]
  },
  c85: {
    number: 'PAGE 85', title: 'La fissure des appartements', noImage: true, image: 'La fissure derrière l’armoire',
    text: `
      <p>Tu t'apprêtes à quitter les appartements lorsqu'un grattement résonne derrière le mur.</p>
      <p>Une fissure étroite traverse la pierre, presque dissimulée par une armoire renversée.</p>
      <p>Tu ignores où cette faille mène. Le grattement pourrait venir de très loin derrière la paroi.</p>
      <p>L'ouverture paraît juste assez large pour t'y glisser de profil. La sortie des quartiers est derrière toi.</p>`,
    choices: [
      { label: 'T’aventurer dans la fissure', to: 'c86' },
      { label: 'Quitter les quartiers et poursuivre ta route', to: 'c91' }
    ]
  },
  c86: {
    number: 'PAGE 86', title: 'Entre les parois', noImage: true, image: 'Le passage trop étroit',
    text: `
      <p>Tu progresses de profil. La roche frotte contre tes épaules et tu dois parfois tourner la tête pour avancer.</p>
      <p>Après plusieurs mètres, l'ouverture s'élargit.</p>
      <p>Tu débouches dans une pièce presque noire. Une lourde porte de fer occupe le mur opposé. Des barres semblent la bloquer de l'extérieur.</p>
      <p>Tes yeux s'habituent lentement à l'obscurité.</p>`,
    choices: [{ label: 'Examiner la pièce', to: 'c87' }]
  },
  c87: {
    number: 'PAGE 87', title: 'La chambre condamnée', image: 'La salle d’isolement',
    text: `
      <p>Des corps sont étendus sur le sol, vêtus de lambeaux d'uniformes ou d'habits de voyageurs.</p>
      <p>Une inscription à moitié effacée est gravée près de la porte :</p>
      <blockquote>« Salle d’ISOLEMENT »</blockquote>
      <p>Un grattement retentit.</p>
      <p>Une main se soulève. L'un des corps essaie lentement de se redresser. De la poussière noire s'échappe de sa bouche.</p>
      <p>Tu ne sais pas s'il cherche à t'atteindre ou simplement à se lever.</p>`,
    choices: [
      { label: 'Fuir par la fissure', to: 'c91', effect: s => { s.flags.isolationChoice = 'flee'; } },
      { label: 'Frapper avant qu’il se relève', to: 'c88', effect: s => { s.flags.isolationChoice = 'strike'; } }
    ]
  },
  c88: {
    number: 'PAGE 88', title: 'Le collier du prisonnier', noImage: true, image: 'Le collier de vitalité',
    text: `
      <p>Tu frappes d'un seul coup, sans laisser à l'homme le temps de se redresser.</p>
      <p>Sa tête roule sur les dalles. Le corps retombe.</p>
      <p>Un collier glisse de son cou. Son pendentif porte un emblème que tu as déjà vu sur certains bijoux de chevaliers : on leur prête le pouvoir de fortifier la vie.</p>
      <p>Une poussière noire s'est déposée autour du fermoir.</p>
      <p>Autour de toi, plusieurs corps commencent à remuer. Il faut partir.</p>`,
    choices: [
      { label: 'Prendre le collier et le passer autour de ton cou', to: 'c89' },
      { label: 'Laisser le collier et fuir', to: 'c90' }
    ]
  },
  c89: {
    number: 'PAGE 89', title: 'Le métal sous la peau', noImage: true, image: 'Le collier incrusté',
    onEnter: s => equipVeilleurCollar(s),
    text: s => `
      ${s.flags.collarTorn
        ? '<p>Tu reviens sur les lieux. Le collier a déjà été arraché et ne peut plus être porté, tu n’obtiens aucun nouveau bonus.</p>'
        : s.history?.filter(id => id === 'c89').length > 1
          ? '<p>Le collier est déjà incrusté autour de ton cou. Ses effets sont toujours ceux de la première fois : +3 Vie maximale, −1 Dextérité et +1 contamination à la pose. Aucun effet supplémentaire n’est appliqué.</p>'
          : `<p>Tu passes le collier autour de ton cou.</p>
      <p>Un regain de vitalité te traverse. Puis le métal se resserre. Ses bords s'enfoncent dans ta peau. La poussière noire accumulée au fermoir pénètre dans la blessure.</p>
      <p>Tu essaies de le soulever : il est incrusté dans la chair. L'arracher te blesserait gravement.</p>
      <p>Une raideur gagne tes épaules et tes mouvements perdent en précision.</p>
      <p><strong>Vie actuelle et maximale : +3. Dextérité : −1. Contamination : +1.</strong></p>
      <p>Le collier apparaît dans ton inventaire. Tu pourras tenter de l'arracher à tout moment, mais la blessure te coûtera encore un point de Vie en plus des trois points gagnés.</p>`}
      <p>Les autres corps remuent. Tu dois quitter la salle.</p>`,
    choices: [{ label: 'Fuir par la fissure', to: 'c91' }]
  },
  c90: {
    number: 'PAGE 90', title: 'La fuite', noImage: true, image: 'Les corps qui remuent',
    text: `
      <p>Tu recules vers la fissure.</p>
      <p>Derrière toi, plusieurs corps commencent à bouger. Une main racle les dalles.</p>
      <p>Tu t'engages de profil entre les parois et avances aussi vite que l'étroitesse du passage te le permet.</p>
      <p>La lumière de la galerie réapparaît enfin.</p>`,
    choices: [{ label: 'Quitter les anciens quartiers', to: 'c91' }]
  },
  c91: {
    number: 'PAGE 91', title: 'Quitter les quartiers', noImage: true, image: 'La galerie de service',
    text: s => `
      <p>Tu retrouves la galerie de sortie des appartements.</p>
      ${s.flags.isolationChoice === 'flee' ? '<p>Le grattement de la chambre d’isolement s’est tu derrière les parois.</p>' : ''}
      ${s.flags.collarEquipped ? '<p>Le collier tire sur ta peau chaque fois que tu tournes la tête.</p>' : ''}
      <p>Les Veilleurs vivaient, soignaient, condamnaient et enfermaient ici. Tu ignores encore ce qu’ils tentaient réellement d’empêcher.</p>
      <p>La galerie rejoint une salle ronde où convergent deux autres passages.</p>`,
    choices: [{ label: 'Entrer dans la salle ronde', to: 'c104' }]
  },
  c92: {
    number: 'PAGE 92', title: 'Le quartier d’observation', image: 'Le quartier d’observation',
    text: `
      <p>Un couloir étroit dessert des cellules. Certaines portes possèdent une ouverture à hauteur de visage. À travers celles-ci, tu aperçois une table, une chaise, parfois un cahier abandonné.</p>
      <p>L’une des portes est rayée de marques irrégulières. Un bruit léger vient de l’intérieur, suivi d’un raclement.</p>
      <p>Au bout du couloir, une arche permet de rejoindre la salle où convergent les trois chemins.</p>`,
    choices: [
      { label: 'T’approcher de la cellule d’où vient le bruit', to: 'c93' },
      { label: 'Garder tes distances et rejoindre la salle ronde', to: 'c98' }
    ]
  },
  c93: {
    number: 'PAGE 93', title: 'L’homme derrière la porte', image: 'Le dernier prisonnier',
    onEnter: s => { s.flags.observationMet = true; },
    text: `
      <p>La porte possède une ouverture à hauteur de visage. À travers cette ouverture, tu regardes à l’intérieur.</p>
      <p>Un homme en armure est assis à l’intérieur. Son visage reste dans l’ombre. Sous la table, une masse déformée heurte lentement les dalles.</p>
      <blockquote>« Aidez-moi… »</blockquote>
      <blockquote>« Je suis chevalier… Je suis arrivé ici il y a quelques jours. »</blockquote>
      <p>Il se rapproche de la porte et s’y agrippe.</p>
      <blockquote>« Vous pouvez m’aider ? Je vous en prie… »</blockquote>
      <p>Un ancien carnet médical est ouvert près de lui.</p>`,
    choices: [
      { label: 'Hésiter et lui demander de raconter son histoire', to: 'c94', effect: t => { t.flags.knightFate = null; } },
      { label: 'Ne pas lui faire confiance et partir', to: 'c149', effect: t => { replayKnight(t, 'observationPrisonerCorridor', 'hostile'); } }
    ]
  },
  c94: {
    number: 'PAGE 94', title: '', noImage: true, image: 'Le cahier du prisonnier',
    onEnter: s => { s.flags.observationRecordsHeard = true; s.flags.observationBodyHeard = true; s.flags.observationRead = true; },
    text: `
      <blockquote>« Je viens d’un village au-delà de la vallée. Une voix m’appelait. Elle me demandait de la libérer. J’ai toujours répondu aux appels à l’aide. »</blockquote>
      <blockquote>« Mais une fois arrivé ici, j’ai compris que quelque chose n’allait pas. Cet appel… c’est une malédiction. »</blockquote>
      <p>Il pose une main tremblante sur le carnet ouvert près de lui.</p>
      <blockquote>« J’ai trouvé ce carnet des Veilleurs. Ils étudiaient les voyageurs qui entendaient la voix. Ils notaient leurs gestes, leurs tentatives pour rejoindre la prison… Puis ils ont essayé la terre noire. »</blockquote>
      <p>Il te montre une ligne soulignée : l’emprise diminuait après l’injection, puis revenait.</p>
      <blockquote>« J’ai trouvé leurs aiguilles et leur réserve. J’ai cru pouvoir reprendre ma route. Je me suis injecté une première dose. J’ai repris le contrôle de mes gestes… pour un temps. Quand l’appel est revenu, j’ai recommencé. Encore et encore. »</blockquote>
      <p>Il soulève un pan de sa tunique. Ses jambes ont perdu leur forme humaine. Une masse sombre et noueuse les relie désormais au sol. Ses membres inférieurs raclent la pierre sans lui obéir.</p>
      <blockquote>« J’ai fermé cette porte avant de ne plus pouvoir me contrôler. Je ne veux pas finir comme eux… »</blockquote>`,
    choices: [{ label: 'Lui demander comment l’aider', to: 'c96' }]
  },
  c95: {
    number: 'PAGE 95', title: '', noImage: true, image: 'Les jambes du chevalier',
    onEnter: s => { s.flags.observationBodyHeard = true; s.flags.observationRecordsHeard = true; s.flags.observationRead = true; },
    text: `
      <p>Il soulève un pan de sa tunique. Ses jambes ont perdu leur forme humaine. Une masse sombre et noueuse les relie désormais au sol.</p>
      <blockquote>« J’ai compris, grâce aux carnets des Veilleurs, que la terre noire pouvait étouffer l’appel. Je me suis injecté une première dose. J’ai repris le contrôle de mes gestes… pour un temps. Quand l’appel est revenu, j’ai recommencé. Encore et encore. »</blockquote>
      <blockquote>« J’ai fermé cette porte avant de ne plus pouvoir me contrôler. Je ne veux pas finir comme eux… »</blockquote>`,
    choices: [{ label: 'Lui demander comment l’aider', to: 'c96' }]
  },
  c96: {
    number: 'PAGE 96', title: '', noImage: true, image: 'La dernière ampoule vide',
    onEnter: s => { s.flags.observationRead = true; },
    text: `
      <p>Près de sa chaise, une ampoule blanche vide roule entre les pierres.</p>
      <blockquote>« J’ai essayé leur remède aussi. La matière reculait… mais l’appel revenait. Je n’ai plus rien. »</blockquote>
      <p>Il fixe la porte. Ses jambes remuent avec un bruit sourd.</p>
      <blockquote>« Sortez-moi d’ici. Trouvez quelqu’un qui puisse me sauver… Ou entrez et achevez-moi. Mais ne me laissez pas comme ça. »</blockquote>`,
    choices: [
      { label: 'Entrer dans la cellule pour l’achever', to: 'c97', effect: s => { replayKnight(s, 'observationPrisoner', null); } },
      { label: 'Ouvrir la porte et le libérer', to: 'c137', effect: s => { replayKnight(s, 'observationPrisoner', 'freed'); } },
      { label: 'Le laisser enfermé et poursuivre ton chemin', to: 'c144', effect: s => { replayKnight(s, 'observationPrisoner', 'locked'); } }
    ]
  },
  c97: {
    number: 'PAGE 97', title: '', image: 'Le combat dans la cellule',
    text: s => {
      const enemy = ENEMIES.observationPrisoner;
      const combat = combatState(s, 'observationPrisoner', enemy);
      const card = enemyCardHtml(s, 'observationPrisoner', enemy);
      const result = combat.lastBlade ? throwingBladeResultHtml(s, 'observationPrisoner', enemy) : combatRoundHtml(s, 'observationPrisoner', enemy);
      if (combat.hp <= 0) return `${card}${result}<p>Le chevalier s’effondre contre la table. Ses membres déformés cessent de remuer. Tu as tenu ta promesse.</p><p>Un petit bouclier repose contre le pied de la table.</p>`;
      if (s.hp <= 0) return `${card}${result}<p>Pris au piège dans la cellule, tu t’écroules sous ses coups.</p>`;
      if (!combat.last && !combat.lastBlade) return `<p>Tu soulèves le loquet et entres, l’épée prête.</p><p>« Merci… » souffle-t-il. Puis le bas de son corps se tord, s’arrache au sol et se propulse vers toi. Ses mains cherchent ton arme.</p><p>Tu dois te défendre dans la cellule étroite.</p>${card}`;
      return `${card}${result}<p>Il se débat encore. Tu ne peux pas reculer sans lui tourner le dos.</p>`;
    },
    choices: s => {
      const combat = combatState(s, 'observationPrisoner', ENEMIES.observationPrisoner);
      if (s.hp <= 0) return fatalChoices();
      if (combat.hp <= 0) return [
        { label: 'Examiner le bouclier du chevalier', to: 'c145', effect: t => { t.flags.knightFate = 'dead'; } },
        { label: 'Quitter la cellule sans rien prendre', to: 'c98', effect: t => { t.flags.knightFate = 'dead'; } }
      ];
      return combatActionChoices(s, 'observationPrisoner', ENEMIES.observationPrisoner, 'c97');
    }
  },
  c98: {
    number: 'PAGE 98', title: 'La sortie du quartier', noImage: true, image: 'La fuite du quartier d’observation',
    text: s => {
      const fate = s.flags.knightFate;
      if (fate === 'dead') return `<p>Tu t’éloignes de la cellule. Le couloir est désormais silencieux.</p><p>Au-delà de l’arche, trois chemins se rejoignent dans une salle ronde.</p>`;
      if (fate === 'freed') return `<p>Tu t’éloignes de la cellule ouverte. Le chevalier est derrière toi, ses remerciements se sont tus.</p><p>Tu rejoins la salle ronde par l’arche.</p>`;
      if (fate === 'locked') return `<p>Tu laisses la porte fermée derrière toi. Les supplications du chevalier se perdent dans le couloir.</p><p>Au-delà de l’arche, trois chemins se rejoignent dans une salle ronde.</p>`;
      return `<p>Tu évites la cellule d’où proviennent les bruits et franchis l’arche.</p><p>Tu débouches dans une salle ronde où convergent trois chemins.</p>`;
    },
    choices: [{ label: 'Rejoindre la salle ronde', to: 'c104' }]
  },
  c99: {
    number: 'PAGE 99', title: 'La salle des registres', image: 'Le dispensaire',
    text: `
      <p>La salle est vaste, ordonnée, presque paisible au premier regard. Des rangées de pupitres, d’étagères et de casiers remplissent l’espace jusqu’au fond.</p>
      <p>Partout, des carnets s’empilent par dizaines. Certains sont rangés avec soin. D’autres sont ouverts, annotés, repliés sur eux-mêmes. Leur nombre dépasse tout ce que tu imaginais.</p>
      <p>Sur un panneau de bois est gravée une phrase simple :</p>
      <blockquote>Que nul ne soit livré à l’appel sans secours.</blockquote>
      <p>Les premiers cahiers accessibles ressemblent à des dossiers de suivi. Chaque volume porte un nom, une date d’arrivée et plusieurs observations successives.</p>`,
    choices: [{ label: 'Lire un des carnets', to: 'c100' }]
  },
  c100: {
    number: 'PAGE 100', title: 'Un carnet de suivi', noImage: true, image: 'Les carnets du dispensaire',
    text: `
      <p>Tu ouvres l’un des carnets. Une écriture régulière énumère les observations du médecin :</p>
      <blockquote>Jour 01 : Armand Varel est arrivé. Il entend la voix. Son corps résiste encore, son esprit aussi.</blockquote>
      <blockquote>Jour 02 : Le sujet a disparu pendant la nuit. Nous l’avons retrouvé prêt à descendre sous la cité. Nous l’avons stoppé juste à temps.</blockquote>
      <blockquote>Jour 03 : Première administration de terre noire. Il réagit plutôt bien. Il n’entend plus la voix.</blockquote>
      <blockquote>Jour 05 : Les voix reprennent. Nouvelle dose de terre noire.</blockquote>
      <blockquote>Jour 10 : Apparition de taches brunâtres sur tout le corps. Le médecin ne peut rien diagnostiquer pour l’instant.</blockquote>
      <blockquote>Jour 13 : Certaines difformités apparaissent. Nous ne savons pas si cela est dû au traitement ou à l’enfermement.</blockquote>
      <blockquote>Jour 15 : Malgré un traitement intensif, les voix finissent toujours par revenir. Il ne répond plus aux questions, semble ailleurs.</blockquote>
      <p>D’autres carnets racontent la même lente dérive, avec d’autres noms, d’autres dates, et presque toujours la même issue.</p>`,
    choices: [{ label: 'Consulter les derniers registres', to: 'c101' }]
  },
  c101: {
    number: 'PAGE 101', title: 'Les derniers registres', noImage: true, image: 'Le registre des expériences',
    text: `
      <p>Les derniers registres ne parlent plus vraiment de soins.</p>
      <blockquote>Sujet 17 : décès.</blockquote>
      <blockquote>Sujet 18 : décès.</blockquote>
      <blockquote>Sujet 19 : transformation. Ne répond plus à l’appel.</blockquote>
      <blockquote>Sujet 20 : transformation. Obéit aux signaux de garde.</blockquote>
      <p>Plus bas, une nouvelle instruction apparaît :</p>
      <blockquote>Début du protocole de transformation pour les sujets 122 à 127. Ils seront affectés à la surveillance du pont. À défaut de revenir parmi nous, ils seront au moins utiles à notre cause.</blockquote>
      <p>Dans la marge, quelqu’un a écrit : « Ce sont encore des hommes. »</p>
      <p>Une autre main a répondu : « Plus pour longtemps. »</p>
      <p>Au-delà d’une cloison, un bruit métallique résonne dans la salle suivante.</p>`,
    choices: [{ label: 'Passer dans la salle suivante', to: 'c102' }]
  },
  c102: {
    number: 'PAGE 102', title: 'La salle des injections', image: 'Les aiguilles des Veilleurs',
    text: `<p>Des tables de pierre sont équipées de lourdes sangles. Des aiguilles épaisses pendent au bout de bras articulés. Au centre, une cuve de terre noire alimente la machine.</p>
      <p>Des traces de lutte marquent les entraves. Ce lieu ressemble moins à un dispensaire qu’à une salle de torture. Qui pourrait infliger cela en prétendant sauver des vies ?</p>
      <p>Un morceau de tissu sombre, de la couleur du surcot de Sir Aldren, est resté accroché à une sangle tranchée. Il est passé ici.</p>
      <p>Un vieux mécanisme grince près d’une table. Une armoire éventrée occupe le mur opposé. Le couloir continue au-delà.</p>`,
    choices: [
      {label:'Inspecter le mécanisme d’injection',to:'c103'},
      {label:'Examiner l’armoire éventrée',to:'c138'},
      {label:'Avancer dans le couloir',to:'c197'}
    ]
  },
  c103: {
    number: 'PAGE 103', title: 'La machine d’injection', noImage: true,
    text: s => `<p>Tu t’approches du bras articulé. Un tuyau le relie à la cuve de terre noire. Son aiguille pointe vers une table à sangles.</p>
      <p>Le levier est coincé à mi-course. La rouille ronge l’articulation et le métal tremble à chaque grincement.</p>
      ${s.flags.labLeverBroken
        ? '<p>Le bras gît au sol, brisé. Tu ne pourras plus actionner cette machine.</p>'
        : '<p>Tu pourrais encore tenter d’actionner le levier.</p>'}`,
    choices: s => [
      ...(!s.flags.labLeverBroken ? [{label:'Tenter d’actionner le levier',to:'c151',effect:triggerInjectionMechanism}] : []),
      ...(s.flags.labLeverBroken ? [{label:'Examiner le bras brisé et sa lueur',to:'c196'}] : []),
      {label:'Examiner l’armoire éventrée',to:'c138'},
      {label:'Poursuivre dans le couloir',to:'c197'}
    ]
  },
  c104: {
    number: 'PAGE 111',
    title: 'Les défenses du sceau',
    image: 'Le mécanisme des gardiens',
    text: `
      <p>Les trois chemins débouchent dans une salle ronde.</p>
      <p>Au centre, une table de pierre porte un plan gravé de la grotte. Plusieurs chemins mènent vers la surface. Ils sont barrés d'un trait profond, comme si les Veilleurs en avaient condamné les accès.</p>
      <p>Ont-ils été fermés pour protéger la vallée ? Leur fermeture a-t-elle participé à son déclin ?</p>
      <p>Plus bas sur le plan, une porte monumentale est dessinée. À côté, une inscription :</p>
      <blockquote>LA TERRE NOIRE ENTRETIENT LE SCEAU. NE PAS LA TOUCHER.</blockquote>
      <p>Sur un panneau voisin, des silhouettes s'effondrent au contact d'une matière sombre. D'autres restent debout, le corps déformé.</p>
      <p>Près d'un passage vers les niveaux inférieurs, une petite lame noire est dessinée.</p>
      <p><strong>Fin de cette version test. La suite de l’aventure est en préparation.</strong></p>
    `,
    choices: [
      {label:'Reprendre au dernier point de sauvegarde',action:'checkpoint'},
      {label:'Recommencer depuis le début',action:'restart'}
    ]
  },

  c105: {
    number: 'PAGE 112', title: 'Le registre du médecin', noImage: true, image: 'Le registre du médecin',
    onEnter: s => { s.flags.physicianNotesRead=true; updateVialKnowledge(s); },
    text: `<p>Dans le couloir, un registre médical repose sur un pupitre. Des observations y comparent l'emprise et les effets de la terre noire.</p>
      <blockquote>« Plus la terre noire gagne le corps, plus l'appel faiblit. Mais la transformation progresse. »</blockquote>
      <p><strong>De 0 à 3 :</strong> l'appel demeure très présent.</p>
      <p><strong>De 4 à 8 :</strong> il devient intermittent. Le corps semble résister à la transformation.</p>
      <p><strong>De 9 à 12 :</strong> l'appel se tait presque, mais des transformations apparaissent.</p>
      <p><strong>À 13 :</strong> aucun retour n'a été observé.</p>
      <p>À la fin du registre, deux préparations sont décrites avec précision.</p>
      <blockquote>« Traitement blanc. Liquide blanc opaque, réduit de quatre points la contamination par la terre noire. Aucun effet sur les blessures. »</blockquote>
      <blockquote>« Potion de soin altérée. Rouge presque noir, présence de terre noire en suspension. Restaure trois points de Vie, mais augmente la contamination de deux points. Ne pas confondre avec les potions rouges ordinaires. »</blockquote>
      <p>Tu reconnais enfin la fiole blanche d’Aldren et la potion sombre retrouvée sur Gaspard, si tu les as conservées.</p>`,
    choices: [{label:'Quitter le registre',to:'c106'}]
  },
  c106: {
    number:'PAGE 113', title:'Le carrefour des soins', image:'Le carrefour des soins', noImage:true,
    text: s => `<p>Le couloir se sépare devant un escalier descendant. Une porte donne sur un poste de secours, l’autre sur une petite réserve.</p>
      ${s.flags.commonAmpouleOffered || s.flags.secretPassageOpened ? '<p>Tu reconnais la porte du poste de secours.</p>' : ''}
      ${s.flags.blackEarthBagOffered || s.flags.reserveRatAwakened ? '<p>La réserve sent encore le bois humide et la poussière.</p>' : ''}`,
    choices: [
      {label:'Fouiller le poste de secours',to:'c107'},
      {label:'Examiner la réserve',to:'c108'},
      {label:'Descendre sans poursuivre les recherches',to:'c109'}
    ]
  },
  c107: {
    number:'PAGE 114', title:'Le poste de secours',image:'Le poste de secours',
    text:s=>`<p>Une grande salle aux murs écaillés. Deux lits de soins sont repoussés contre la pierre. Des bandes de tissu séchées pendent au-dessus d’une table.</p>
      <p>Une haute armoire médicale est adossée au mur. Plus loin, une étagère porte quelques livres oubliés.</p>
      ${s.flags.commonAmpouleTaken || s.visited?.c139
        ? '<p>Dans l’armoire, l’emplacement de l’ampoule déjà prise est vide.</p>'
        : '<p>La porte de l’armoire est entrouverte. Tu distingues des flacons à l’intérieur.</p>'}
      ${s.flags.secretPassageOpened ? '<p>Entre deux étagères, la trappe secrète est désormais ouverte.</p>' : ''}`,
    choices:s=>[
      ...(!(s.flags.commonAmpouleTaken || s.visited?.c139)
        ? [{label:'Fouiller la grande armoire',to:'c139',effect:t=>{
          if (!t.flags.commonAmpouleTaken && !t.visited?.c139) {
            addItem(t,'ampoule_blanche_commune','Ampoule blanche — poste de secours','Terre noire : −4 points de contamination (minimum 0). Ne soigne pas les blessures.');
            t.flags.commonAmpouleTaken=true;
          }
          t.flags.commonAmpouleOffered=true;
        }}]
        : []),
      {label:s.flags.secretPassageOpened?'Examiner le faux livre et son mécanisme':'Examiner les livres de l’étagère',to:'c184'},
      ...(s.flags.secretPassageOpened?[{label:'Se glisser dans la trappe secrète',to:'c186'}]:[]),
      {label:'Revenir au carrefour',to:'c106'}
    ]
  },
  c108: {
    number:'PAGE 122',title:'La réserve de terre noire',image:'La réserve de terre noire',
    text:s=>`<p>La porte s’ouvre sur une pièce poussiéreuse. Le bois des étagères est abîmé par le temps. Des sacs s’entassent dans un coin.</p>
      <p>Sur une planche, un sachet noir est resté à l’écart. Plusieurs sacs plus volumineux semblent avoir été déplacés récemment.</p>
      ${s.flags.reserveRatAwakened
        ? (s.flags.reserveRatDead ? '<p>Le rat difforme gît entre les sacs déchirés. Il ne bougera plus.</p>' : '<p>Les sacs éventrés rappellent l’attaque du rat. Il est encore là.</p>')
        : '<p>Un faible couinement s’élève derrière les sacs. Quelque chose remue dans la poussière épaisse. L’endroit ne paraît pas sûr.</p>'}`,
    choices:s=>[
      {label:'Fouiller l’étagère avec précaution',to:'c190'},
      {label:s.flags.reserveRatDead?'Examiner les sacs éventrés':s.flags.reserveRatAwakened?'Faire face au rat':'Ouvrir les sacs malgré le couinement',to:s.flags.reserveRatDead?'c194':s.flags.reserveRatAwakened?'c192':'c191',effect:t=>{if (!t.flags.reserveRatDead) t.flags.reserveRatAwakened=true;}},
      {label:'Quitter la réserve',to:'c106'}
    ]
  },
  c109: {
    number: 'PAGE 130', title: 'La grille condamnée', noImage: true, image: 'La grille condamnée',
    text: s => `<p>Au bas de l’escalier, une épaisse grille de fer ferme l’accès à une petite pièce. Derrière les barreaux, tu aperçois un coffre de bois.</p>
      <p>La grille est recouverte d’une épaisse couche de terre noire, sèche et poudreuse. Quelques grains se détachent au moindre courant d’air.</p>
      ${s.flags.tabletsExamined ? '<p>La grille est désormais ouverte.</p>' : '<p>Pour atteindre le coffre, il faudrait forcer la grille. Tu risques alors de soulever cette poussière et d’en respirer.</p>'}
      <p>Une avenue descend vers les profondeurs de la cité.</p>`,
    choices: s => s.flags.tabletsExamined
      ? [
        { label: 'Retourner examiner le coffre', to: 'c110' },
        { label: 'Poursuivre par l’avenue', to: 'c112' }
      ]
      : [
        { label: 'Forcer la grille malgré la terre noire et examiner le coffre', to: 'c110', effect: exposeTabletGate },
        { label: 'Ne pas prendre ce risque et poursuivre la route', to: 'c112' }
      ]
  },
  c110: {
    number: 'PAGE 131', title: 'Les parchemins confisqués', image: 'Les parchemins confisqués',
    // La navigation libre en Travail applique la première exposition, sauf si la grille a déjà été ouverte.
    onEnter: s => { if (!s.flags.tabletsExamined) exposeTabletGate(s); },
    text: s => `${s.flags.tabletsDustExposure
      ? `<p>Tu tires de toutes tes forces sur la grille. Les gonds cèdent et une épaisse poussière noire se répand dans l’air.</p>
           <p>Tu recules en toussant. La poussière pénètre dans ta bouche et ta gorge.</p>
           <p><strong>Terre noire : +2.</strong></p>`
      : `<p>La grille est ouverte. Tu peux atteindre le coffre.</p>`}
      <p>Le coffre n’est pas verrouillé. À l’intérieur, des dizaines de petits parchemins sont empilés et maintenus par des ficelles.</p>
      <p>Tu en déplies un. Tous portent le même texte :</p>
      <blockquote>« L’esprit enfermé derrière cette porte n’est pas mauvais.<br><br>
      On nous ordonne de garder cette prison sans poser de questions. Nous obéissons parce que nos pères ont obéi avant nous. Nous voulons des preuves.<br><br>
      Cessez de croire aveuglément ce qu’on vous enseigne.<br><br>
      Ouvrez les yeux. Ouvrez la porte. Libérez l’esprit.<br><br>
      Nous voulons vivre libres. »</blockquote>
      <p>Les autres parchemins portent le même message. Ils ont été enfermés ici.</p>
      <p>À côté du coffre, un petit journal de bord repose sur un pupitre.</p>`,
    choices: [
      { label: 'Lire le journal de bord', to: 'c111' },
      { label: 'Laisser le journal et poursuivre vers les niveaux inférieurs', to: 'c112' }
    ]
  },
  c111: {
    number: 'PAGE 132',
    title: 'Le journal des confiscations',
    noImage: true,
    image: 'Le journal des confiscations',
    text: `<p>À côté du coffre, un petit journal de bord repose sur un pupitre.</p>
      <p>Les premières lignes ne sont que des listes de saisies, de fouilles et d’interrogatoires.</p>
      <p>Puis le ton change.</p>
      <p><em>« De nouveaux parchemins ont été découverts sur la place. J’ai fait confisquer l’ensemble et arrêter les responsables. »</em></p>
      <p><em>« Les appels à ouvrir la prison se multiplient. Plusieurs gardes refusent désormais d’obéir. Nous ne parvenons plus à contenir les troubles. »</em></p>
      <p><em>« J’ai interrogé l’un des prisonniers. Il m’a demandé si j’avais moi-même vu ce que nous gardons derrière cette porte. Je n’ai pas su lui répondre. »</em></p>
      <p><em>« J’ai passé ma vie à confisquer ces écrits. Aujourd’hui, je commence à douter… Et s’ils avaient raison ? »</em></p>
      <p>Les pages suivantes sont vierges.</p>`,
    choices: [{ label: 'Poursuivre vers les niveaux inférieurs', to: 'c112' }]
  },

  c112: {
    number: 'PAGE 133',
    title: 'L’avenue basse',
    image: 'L’avenue basse',
    text: state => `
      <p>Tu quittes le carrefour par une avenue qui descend lentement.</p>

      <p>Ici, la cité paraît moins intacte.</p>

      <p>Des pierres se sont détachées des façades. Les dalles sont fendues, l’eau a creusé les joints entre les pavés.</p>
      <p>Une porte pend sur un seul gond. Une hampe brisée et un bouclier fendu gisent près d’une charrette renversée. Des entailles marquent les murs à hauteur d’homme.</p>
      <p>La lumière du jour n’atteint plus ce quartier. Les passages entre les maisons restent plongés dans l’ombre.</p>
      <p>Tu avances entre les débris.</p>

      <p>Sur plusieurs pierres, tu retrouves l’œil fermé.</p>

      <p>Les marques ne sont pas décoratives. Elles ont été gravées à hauteur de main, parfois accompagnées d’un trait ou d’une flèche.</p>

      <p>Quelqu’un s’en servait pour se repérer.</p>

      ${dormantPerception(state, 'avenue')}

      <p>Plus bas, une partie entière de la rue s’est effondrée.</p>

      <p>Derrière les pierres brisées, tu distingues un mur de soutènement appuyé contre la roche.</p>

      <p>Une ouverture de service se dessine sous les débris. Quelqu’un a déjà tenté d’en dégager l’accès.</p>
    `,
    choices: [{ label: 'Examiner l’éboulement', to: 'c113' }]
  },

  c113: {
    number: 'PAGE 134',
    title: 'Le passage de service',
    image: 'Derrière le mur',
    text: state => `
      <p>Tu longes l’éboulement jusqu’à trouver une ouverture entre deux blocs.</p>

      <p>Elle est étroite, mais quelqu’un a déjà déplacé plusieurs pierres pour l’agrandir.</p>

      <p>Tu te glisses à l’intérieur.</p>

      <p>Derrière la façade de la cité court un ancien passage de service taillé à même la roche.</p>

      <p>Le plafond est bas. Les parois portent encore les traces régulières d’outils.</p>

      <p>À plusieurs endroits, des étais de bois se sont effondrés depuis longtemps. Tu dois escalader leurs restes, ramper sous une poutre puis te hisser sur une corniche étroite.</p>

      ${dormantPerception(state, 'service')}

      <p>Le passage se termine au bord d’un conduit vertical.</p>

      <p>Des prises ont été creusées dans la paroi. De vieux anneaux de fer sont scellés dans la pierre.</p>

      <p>Au fond, une plateforme apparaît une dizaine de mètres plus bas.</p>

      <p>Sur son bord, tu distingues encore le symbole de l’œil fermé.</p>
    `,
    choices: [{ label: 'Préparer la descente', to: 'c114' }]
  },

  c114: {
    number: 'PAGE 135',
    title: 'Le puits des Veilleurs',
    image: 'Le puits des Veilleurs',
    text: state => `
      <p>Tu t’accroupis au bord du conduit.</p>

      <p>Les prises de pierre sont usées mais encore praticables. Plusieurs ont toutefois perdu un morceau de leur bord.</p>

      <p>Les anneaux de fer semblent plus solides.</p>

      <p>En dessous, le puits s’enfonce dans une partie de la montagne qui ne ressemble plus à une ville.</p>

      <p>Seulement à un chantier très ancien.</p>

      ${hasItem(state, 'ceinture_rouge') ? '<p>La Ceinture de corde rouge peut te servir à t’assurer aux anneaux pendant la descente.</p>' : '<p>Sans corde, tu devras compter sur les prises et sur ton équilibre.</p>'}
      ${hasItem(state, 'anneau_veilleurs') ? '<p>À côté du puits, un petit logement circulaire reproduit exactement le motif de ton Anneau des Veilleurs. Il est relié à une échelle de service repliée dans la paroi.</p>' : ''}
    `,
    choices: state => {
      const list = [];
      if (hasItem(state, 'anneau_veilleurs')) {
        list.push({
          label: 'Actionner le mécanisme avec l’Anneau des Veilleurs',
          to: 'c115',
          effect: s => { s.flags.cityWellDescent = 'ring'; }
        });
      }
      if (hasItem(state, 'ceinture_rouge')) {
        list.push({
          label: 'T’assurer avec la Ceinture de corde rouge',
          to: 'c141',
          effect: s => { s.flags.cityWellDescent = 'rope'; }
        });
      }
      list.push({
        label: 'Descendre par les prises — lancer les trois dés de Dextérité',
        to: 'c143',
        effect: s => {
          const ok = roll3D6(s, 'Dextérité', currentDexterity(s));
          s.flags.cityWellDescent = ok ? 'success' : 'fail';
          if (!ok && s.flags.knightFate !== 'locked') s.flags.cityWellDamage = applyDamage(s, 2);
        }
      });
      return list;
    }
  },

  c115: {
    number: 'PAGE 136',
    title: 'Le palier inférieur',
    image: 'Le palier inférieur',
    onEnter: s => {
      if (s.flags.knightFate !== 'locked' || s.flags.knightWellAttackDone) return;
      s.flags.knightWellAttackDone = true;
      // La blessure de l'agression se produit même quand la corde arrête la chute.
      const before = s.hp;
      s.hp = Math.max(0, s.hp - 2);
      s.flags.knightWellLife = before - s.hp;
      raiseContamination(s, 1);
      // Conserver les conséquences de la tentative aux prises si les dés avaient échoué.
      if (s.flags.cityWellDescent === 'fail') s.flags.cityWellDamage = applyDamage(s, 2);
      s.flags.knightFate = 'fallen';
    },
    text: state => {
      const descent = state.flags.cityWellDescent;
      let intro = '';
      if (state.flags.knightWellAttackDone) {
        intro = `${descent === 'success' || descent === 'fail' ? diceResultHtml(state) : ''}
          ${descent === 'ring' ? '<p>Tu tournes l’Anneau des Veilleurs dans son logement. Une échelle de fer se déploie et tu t’y engages.</p>' : ''}
          <p>Alors que tu commences à descendre, un fracas éclate derrière toi. Le chevalier a brisé la porte de sa cellule. Sa silhouette déformée bondit depuis le bord du puits et te frappe dans le dos.</p>
          <p>Ses membres t’écrasent contre la roche. Une plaie s’ouvre sous ton armure et des grains de terre noire y pénètrent.</p>
          ${descent === 'rope'
            ? '<p>Tu bascules dans le vide. La corde rouge se tend et arrête ta chute, mais elle ne t’a pas protégé du coup. Tu repousses le chevalier, qui disparaît au-dessous de toi, et retrouves une prise.</p>'
            : descent === 'ring'
              ? '<p>Tu heurtes l’échelle déployée. Tu te retiens à un barreau tandis que le chevalier perd appui et disparaît plus bas. Tu reprends ta descente.</p>'
              : '<p>Arraché aux prises, tu glisses le long de la paroi. Tu repousses le chevalier, qui disparaît dans le conduit, puis tu retrouves un appui et rejoins la plateforme.</p>'}
          <p><strong>Attaque : −${state.flags.knightWellLife ?? 2} Vie. Terre noire : +1.</strong></p>
          ${descent === 'fail' ? `<p>Ta chute heurte aussi les derniers mètres de paroi.</p>${damageAbsorptionHtml(state.flags.cityWellDamage)}` : ''}
        `;
      } else if (descent === 'ring') {
        intro = `
          <p>Tu glisses l’anneau dans le logement de pierre et le tournes. Un cran s’enclenche.</p>
          <p>Une échelle de fer sort lentement de la paroi et se bloque au-dessus du vide. Tu récupères ton anneau.</p>
          <p>Tu descends prudemment et atteins la plateforme sans blessure.</p>
        `;
      } else if (descent === 'rope') {
        intro = `
          <p>Tu fixes la corde à l’un des anneaux et commences la descente.</p>
          <p>Deux prises cèdent brusquement sous tes bottes. Tu bascules dans le vide, mais la corde se tend et arrête ta chute.</p>
          <p>Suspendu au-dessus du puits, tu comprends que, sans elle, tu aurais pu tomber lourdement et perdre connaissance.</p>
          <p>Tu retrouves un appui et termines la descente sans blessure.</p>
        `;
      } else if (descent === 'success') {
        intro = diceResultHtml(state) + `
          <p>Tu descends en prenant le temps de tester chaque prise avant d’y mettre ton poids.</p>
          <p>La roche s’effrite parfois sous tes doigts, mais tu atteins la plateforme sans glisser.</p>
        `;
      } else if (descent === 'fail') {
        intro = diceResultHtml(state) + `
          <p>À quelques mètres du fond, une prise se détache sous ta main.</p>
          <p>Tu glisses, heurtes la paroi puis tombes lourdement sur la plateforme.</p>
          ${damageAbsorptionHtml(state.flags.cityWellDamage)}
          <p>Tu restes un instant au sol avant de te relever.</p>
        `;
      } else {
        intro = `<p>Tu descends en te retenant aux prises, puis rejoins la plateforme.</p>`;
      }
      if (state.hp <= 0) return intro + '<p>Tu ne parviens plus à te relever au fond du puits.</p>';
      return intro + `
        <p>La plateforme donne sur une galerie basse encombrée d’outils rongés par la rouille et de paniers de pierre effondrés.</p>
        <p>Les Veilleurs ont creusé ici.</p>
        <p>Plus loin, une flèche gravée sous un œil fermé indique une galerie descendante.</p>
      `;
    },
    choices: state => state.hp <= 0
      ? fatalChoices()
      : [{ label: 'Poursuivre dans la galerie', to: 'c116' }]
  },
  c116: {
    number: 'PAGE 137',
    title: 'La porte sous la ville',
    image: 'La porte sous la ville',
    text: state => `
      ${state.flags.usedWhiteAmpouleAtWell ? `
        <p>Le liquide blanc brûle légèrement lorsqu’il touche tes doigts.</p>

        <p>La terre noire tassée sous tes ongles se ramollit puis se détache en grains épais.</p>

        <p>Tu t’essuies longuement.</p>

        <p>Le goût terreux au fond de ta gorge finit lui aussi par s’atténuer.</p>

        <p>La contamination recule. Tu sens l’emprise retrouver de la force : le traitement a son prix.</p>
      ` : ''}

      <p>Tu suis la galerie indiquée par les Veilleurs.</p>

      <p>Elle descend entre des murs renforcés de blocs bruts. Des niches contiennent encore des coins de métal, des masses et des fragments de corde pétrifiée par l’âge.</p>

      <p>Au bout se trouve une porte de pierre noire, à peine plus haute que toi.</p>

      <p>Un œil fermé est gravé à hauteur d’homme.</p>

      <p>Juste en dessous, quelqu’un a ajouté le dessin sommaire d’une petite lame noire.</p>

      <p>La gravure est plus récente que le reste.</p>

      <p>Près du seuil, une empreinte de botte s’est imprimée dans une plaque de poussière humide.</p>

      <p>Elle va vers l’intérieur.</p>

      <p>Tu penses à Aldren.</p>

      <p>Tu n’as aucune preuve qu’elle lui appartienne.</p>

      <p>La porte résiste d’abord, puis cède sous ton épaule dans un grondement sourd.</p>
    `,
    choices: [{ label: 'Passer sous la cité', to: 'c117' }]
  },

  c117: {
    number: 'PAGE 138', title: 'Sous la Cité morte', image: 'Sous la Cité morte',
    onEnter: s => setCheckpoint(s, 'Sous la Cité morte'),
    text: `<p>Tu pousses la porte noire. L’escalier s’enfonce sous la cité, entre des blocs fendillés.</p>
      <p>Les marques des Veilleurs se multiplient : l’œil fermé, puis la petite lame noire. Une empreinte récente descend vers les profondeurs.</p>
      <p>L’air se réchauffe. Un coup sourd résonne plus bas. Tu resserres ta prise sur ton arme.</p>`,
    choices: [{ label: 'Descendre dans le dédale', to: 'c152' }]
  },

  c118: {
    number: 'PAGE 139', title: "La fiole emportée", noImage: true,
    text: `<p>Tu glisses la fiole blanche dans ta sacoche. Tu ignores encore ce qu’elle contient.</p><p>Tu rejoins la place du village.</p>`,
    choices: [{label: "Rejoindre la place", to: 'c3'}]
  },

  c119: {
    number: 'PAGE 140', title: "La fiole emportée", noImage: true,
    text: `<p>Tu protèges la fiole au fond de ta sacoche et quittes Valombre sans attendre.</p><p>Le sentier de la montagne t’attend.</p>`,
    choices: [{label: "Prendre le sentier de la grotte", to: 'c8'}]
  },

  c120: {
    number: 'PAGE 141', title: "La potion du marchand", noImage: true,
    text: `<p>Tu poses les trois pièces sur l’étal. Le marchand te remet la potion, que tu ranges soigneusement pour la suite du voyage.</p>`,
    choices: [{label: "Retourner sur la place", to: 'c3'}]
  },

  c121: {
    number: 'PAGE 142', title: "L’épée de la forgeronne", noImage: true,
    text: `<p>Tu rends l’épée lourde à la forgeronne et essaies quelques mouvements avec la lame plus courte. Ton bras retrouve de la liberté, même si l’arme frappera moins fort.</p><p>Tu la remercies et ressors sur la place.</p>`,
    choices: [{label: "Retourner sur la place", to: 'c3'}]
  },

  c122: {
    number: 'PAGE 143', title: "Une lame contre la masse", noImage: true,
    text: `<p>Tu lances une lame vers la masse sombre. Tu guettes l’effet de ton tir.</p>`,
    choices: [{label: "Voir le résultat du tir", to: 'c27'}]
  },

  c123: {
    number: 'PAGE 144', title: "Une lame contre le disparu", noImage: true,
    text: `<p>Ta lame file vers le disparu de Rochebrume. Tu guettes l’effet du projectile.</p>`,
    choices: [{label: "Voir le résultat du tir", to: 'c38'}]
  },

  c124: {
    number: 'PAGE 145', title: "Une lame sur l’îlot", noImage: true,
    text: `<p>Tu lances une lame vers la créature de l’îlot. Tu attends de voir si elle poursuivra sa marche.</p>`,
    choices: [{label: "Voir le résultat du tir", to: 'c47'}]
  },

  c125: {
    number: 'PAGE 146', title: "Une lame au-dessus du vide", noImage: true,
    text: `<p>Tu projettes une lame contre le marcheur qui grimpe sous le pont. La créature se replie autour d’une corde. Tu dois voir si elle tient encore.</p>`,
    choices: [{label: "Voir le résultat du tir", to: 'c62'}]
  },

  c126: {
    number: 'PAGE 147', title: "Une lame dans le couloir", noImage: true,
    text: `<p>Tu projettes une lame vers le chevalier transformé. Tu guettes sa réaction dans l’étroitesse de la cellule.</p>`,
    choices: [{label: "Voir le résultat du tir", to: 'c97'}]
  },

  c127: {
    number: 'PAGE 148', title: "L’anneau récupéré", noImage: true,
    text: `<p>Tu soulèves l’anneau de la dalle. Il semble presque ne rien peser. Le symbole de l’œil fermé apparaît sur sa tranche.</p><p>Tu regagnes la barque.</p>`,
    choices: [{label: "Reprendre la barque", to: 'c48'}]
  },

  c128: {
    number: 'PAGE 149', title: "Le gantelet du Veilleur", noImage: true,
    text: `<p>Tu détaches doucement le gantelet de la main du squelette. Les plaques sont encore solides, tu l’ajustes à ton bras avant de franchir la porte du quartier haut.</p>`,
    choices: [{label: "Franchir la porte", to: 'c67'}]
  },

  c130: {
    number: 'PAGE 151', title: "La lame de diversion", noImage: true,
    text: `<p>Tu projettes une lame au-delà du pont. Elle fend la brume et disparaît sous les planches.</p>
      <p>La lame de jet tinte contre une pierre très loin sous le pont.</p>
      <p>La chose lâche aussitôt la face inférieure du pont et disparaît dans la brume à sa poursuite.</p>
      <p>Tu peux poursuivre ta traversée sans l’affronter.</p>`,
    choices: [{label: "Achever la traversée", to: 'c63'}]
  },

  c131: {
    number: 'PAGE 152', title: "La corde du Veilleur", noImage: true,
    onEnter: s => { if (hasItem(s, 'ceinture_rouge')) s.flags.bridgeCordTaken = true; },
    text: state => hasItem(state, 'ceinture_rouge')
      ? `<p>Tu réexamines la ceinture de corde rouge déjà rangée dans ton équipement. Son tressage est intact.</p>`
      : `<p>Tu examines la ceinture de corde rouge du Veilleur. Son tressage est encore intact. Tu peux poursuivre vers la porte ou fouiller sa sacoche.</p>`,
    choices: state => [
      { label: state.flags.bridgeSatchelSearched ? 'Relire le parchemin de la sacoche' : 'Fouiller aussi la sacoche', to: 'c65' },
      { label: 'Gagner la porte', to: 'c64' }
    ]
  },

  c136: {
    number: 'PAGE 157', title: "Les lames récupérées", noImage: true,
    text: s => s.history?.filter(id => id === 'c136').length > 1
      ? `<p>La boîte de l’armurerie est vide. Les cinq lames ont déjà été récupérées.</p>`
      : `<p>Tu enveloppes les cinq lames dans un morceau de tissu et les glisses dans ton équipement. Tu repars vers les bureaux.</p>`,
    choices: [{label: "Rejoindre les bureaux", to: 'c82'}]
  },

  c137: {
    number: 'PAGE 158', title: '', noImage: true,
    text: `<p>Tu soulèves le loquet. Le chevalier tire son corps vers l’ouverture et se retient au montant.</p>
      <blockquote>« Merci… Je savais que vous ne me laisseriez pas ici. »</blockquote>
      <p>Tu t’écartes et reprends le couloir vers l’arche.</p>`,
    choices: [{ label: 'T’éloigner de la cellule', to: 'c147' }]
  },
  c138: {
    number:'PAGE 104',title:'Les réserves abandonnées',noImage:true,
    text:`<p>Les portes de l’armoire ont été arrachées. Des flacons brisés jonchent le sol et les tiroirs sont vides.</p>
      <p>Sur une étiquette déchirée, tu déchiffres quelques mots : « Traitement de la terre noire ». Il ne reste ici aucun remède intact.</p>
      <p>Une traînée de poussière se prolonge vers le couloir, comme si quelqu’un s’était éloigné en rampant.</p>`,
    choices:[
      {label:'Examiner la machine',to:'c103'},
      {label:'Suivre les traces dans le couloir',to:'c197'}
    ]
  },

  c139: {
    number: 'PAGE 115', title: "L’ampoule du poste de secours", noImage: true,
    text: `<p>Au milieu des flacons brisés, tu découvres une ampoule intacte. Sur l’étiquette : « Traitement de la terre noire ».</p><p>Tu la protèges dans ton sac. Les autres flacons sont vides ou inutilisables.</p>`,
    choices: [{label: "Poursuivre la fouille du poste", to: 'c107'}, {label:'Revenir au carrefour',to:'c106'}]
  },

  c140: {
    number: 'PAGE 124', title: "La sacoche de terre noire", noImage: true,
    text: `<p>Tu refermes soigneusement la sacoche, sans toucher à la poudre, puis la ranges dans ton sac.</p><p>Tu peux encore inspecter les autres recoins de la réserve, si tu oses.</p>`,
    choices: [{label:'Poursuivre la fouille de la réserve',to:'c108'}, {label: "Revenir au carrefour", to: 'c106'}]
  },

  c141: {
    number: 'PAGE 159', title: "La corde dans le puits", noImage: true,
    text: `<p>Tu noues la corde rouge à l’un des anneaux de fer, vérifies le nœud et t’engages dans le conduit.</p><p>Tu poses les bottes sur les premières prises.</p>`,
    choices: [{label: "Poursuivre la descente", to: 'c115'}]
  },

  c142: {
    number: 'PAGE 160', title: 'L’ancienne descente', noImage: true,
    // Réservée à la reprise d'une sauvegarde antérieure : plus aucun bracelet à obtenir.
    text: `<p>Tu reprends appui sur les anneaux et t’engages dans le conduit. Tu progresses en contrôlant chacune de tes prises.</p>`,
    choices: [{ label: 'Terminer la descente', to: 'c115', effect: s => { s.flags.cityWellDescent = 'success'; } }]
  },
  c143: {
    number: 'PAGE 161', title: "La descente à mains nues", noImage: true,
    text: `<p>Tu renonces aux mécanismes et attaques les prises une à une. La paroi s’effrite déjà sous tes doigts.</p><p>Tu poursuis la descente.</p>`,
    choices: [{label: "Poursuivre la descente", to: 'c115'}]
  },
  c144: {
    number: 'PAGE 162', title: '', noImage: true,
    text: `<p>« Attendez… Je vous en prie ! »</p><p>Tu t’éloignes sans toucher à la porte. Le chevalier frappe une fois contre le bois, puis ses appels deviennent indistincts.</p><p>Tu retrouves l’arche au bout du couloir.</p>`,
    choices: [{ label: 'Quitter le quartier d’observation', to: 'c98' }]
  },
  c145: {
    number: 'PAGE 163', title: '', image: 'Le bouclier du chevalier',
    text: s => s.flags.knightShieldTaken || hasItem(s, 'bouclier_chevalier')
      ? (shieldIsActive(s)
        ? `<p>Le petit bouclier est déjà dans ton équipement. Il lui reste ${s.protectionItems.bouclier_chevalier.remaining} point${s.protectionItems.bouclier_chevalier.remaining > 1 ? 's' : ''} de protection.</p>`
        : `<p>Le bouclier que tu avais récupéré est désormais brisé. Il ne peut plus te protéger.</p>`)
      : `<p>Contre le pied de la table repose un petit bouclier de métal cabossé. Ses sangles tiennent encore.</p>
         <p>Il pourrait absorber plusieurs coups, mais son poids ralentira tes mouvements.</p>`,
    choices: s => s.flags.knightShieldTaken || hasItem(s, 'bouclier_chevalier')
      ? [{ label: 'Quitter la cellule', to: 'c98' }]
      : [
        { label: 'Prendre le bouclier (Protection +6, Dextérité −1)', stay: true, effect: addKnightShield },
        { label: 'Laisser le bouclier et partir', to: 'c98' }
      ]
  },
  // Conservée uniquement pour reprendre les anciennes sauvegardes déjà situées page 146.
  // Aucun choix de la nouvelle version ne conduit ici.
  c146: {
    number: 'PAGE 164', title: '', noImage: true,
    text: `<p>Tu passes l’avant-bras dans les sangles du bouclier et regagnes le couloir. Son poids ralentit légèrement tes gestes, mais il pourra te protéger des prochains coups.</p>`,
    choices: [{ label: 'Rejoindre la salle ronde', to: 'c98' }]
  },
  c147: {
    number: 'PAGE 165', title: '', noImage: true,
    onEnter: s => {
      if (s.flags.knightFate !== 'freed' || s.flags.knightBackstabDone) return;
      s.flags.knightBackstabDone = true;
      const before = s.hp;
      s.hp = Math.max(0, s.hp - 2);
      s.flags.knightBackstabLife = before - s.hp;
      raiseContamination(s, 2);
      s.flags.knightFate = s.hp <= 0 ? 'freed' : 'dead';
    },
    text: s => `<p>Un choc te frappe entre les épaules. Le chevalier s’est jeté sur toi. Ses membres transformés se contractent autour de tes jambes, de la terre noire pénètre dans une entaille sous ton armure.</p>
      <p><strong>−${s.flags.knightBackstabLife ?? 2} Vie. Terre noire : +2.</strong></p>
      ${s.hp <= 0 ? '<p>Tu t’effondres avant de pouvoir lui échapper.</p>' : '<p>Tu te dégages, tires ton épée et lui tranches la tête d’un coup. Son corps s’affaisse et ne bouge plus.</p><p>Tu te relèves et gagnes l’arche.</p>'}`,
    choices: s => s.hp <= 0 ? fatalChoices() : [{ label: 'Quitter le quartier', to: 'c98' }]
  },
  c148: {
    number: 'PAGE 166', title: '', noImage: true,
    // Ancien point d'arrivée conservé pour les liens de travail, plus aucune branche ne mène ici.
    onEnter: s => { if (!s.flags.tabletsExamined) exposeTabletGate(s); },
    text: `<p>La grille a été ouverte. Tu peux maintenant atteindre le coffre.</p>`,
    choices: [{ label: 'Examiner le coffre', to: 'c110' }]
  },
  c149: {
    number: 'PAGE 167', title: '', image: 'Le chevalier enragé',
    onEnter: s => { if (!s.flags.knightFate) s.flags.knightFate = 'hostile'; },
    text: s => {
      const enemy = ENEMIES.observationPrisonerCorridor;
      const combat = combatState(s, 'observationPrisonerCorridor', enemy);
      const card = enemyCardHtml(s, 'observationPrisonerCorridor', enemy);
      const result = combat.lastBlade ? throwingBladeResultHtml(s, 'observationPrisonerCorridor', enemy) : combatRoundHtml(s, 'observationPrisonerCorridor', enemy);
      if (combat.hp <= 0) return `${card}${result}<p>Le chevalier s’écroule au milieu du couloir. Derrière lui, la porte de sa cellule est éventrée. Un petit bouclier est resté près de la table.</p>`;
      if (s.hp <= 0) return `${card}${result}<p>Le chevalier t’abat dans le couloir avant que tu puisses rejoindre l’arche.</p>`;
      if (!combat.last && !combat.lastBlade) return `<p>Tu recules sans répondre et te détournes de la cellule.</p><blockquote>« Non ! Revenez ! »</blockquote><p>Un cri se change en rugissement. Derrière la porte, des os craquent. La masse qui lui tient lieu de jambes se gonfle et heurte le bois. Les gonds cèdent, la porte s’abat dans le couloir.</p><p>Le chevalier se propulse vers toi. Tu dégaines juste à temps.</p>${card}`;
      return `${card}${result}<p>Il rampe vers toi avec une force terrible. Le passage est trop étroit pour le contourner.</p>`;
    },
    choices: s => {
      const combat = combatState(s, 'observationPrisonerCorridor', ENEMIES.observationPrisonerCorridor);
      if (s.hp <= 0) return fatalChoices();
      if (combat.hp <= 0) return [
        { label: 'Entrer et examiner son bouclier', to: 'c145', effect: t => { t.flags.knightFate = 'dead'; } },
        { label: 'Quitter le quartier sans rien prendre', to: 'c98', effect: t => { t.flags.knightFate = 'dead'; } }
      ];
      return combatActionChoices(s, 'observationPrisonerCorridor', ENEMIES.observationPrisonerCorridor, 'c149');
    }
  },
  c150: {
    number: 'PAGE 168', title: '', noImage: true,
    text: `<p>Tu projettes une lame vers le chevalier transformé. La lame le frappe dans le couloir, au milieu des débris de la porte.</p>`,
    choices: [{ label: 'Voir le résultat du tir', to: 'c149' }]
  },
  c151: {
    number:'PAGE 105',title:'Le bras qui cède',noImage:true,
    text:s=>!s.flags.labLeverBroken
      ? '<p>Le levier n’a pas été actionné. Le mécanisme grince encore dans la salle voisine.</p>'
      : `${injectionRollHtml(s)}
         ${s.flags.labLeverRoll?.success
           ? '<p>Le bras de métal se rabat. Tu te jettes sur le côté : l’aiguille ne rencontre que la pierre.</p>'
           : '<p>Le bras se rabat trop vite. L’aiguille te frappe et la terre noire pénètre dans la plaie. <strong>−1 Vie · +2 Terre noire.</strong></p>'}
         <p>Un craquement sec retentit. Usé par les années, le bras se brise à l’articulation et tombe au sol. Il ne fonctionnera plus.</p>
         <p>Tu suis les morceaux du regard. Parmi les débris, quelque chose brille faiblement : une bague, jusque-là prisonnière du mécanisme.</p>`,
    choices:s=>s.flags.labLeverBroken
      ? [{label:'Examiner la bague lumineuse',to:'c196'},{label:'Laisser les débris et avancer',to:'c197'}]
      : [{label:'Revenir devant le mécanisme',to:'c103'}]
  },
  c129: {
    number: 'PAGE 150', title: 'Avancer sans bruit', noImage: true,
    text: s => `${diceResultHtml(s)}${s.flags.bridgeCalmPassed
      ? '<p>Tu te forces à avancer sans accélérer. La chose accompagne tes pas sous les planches, puis finit par s’immobiliser. Tu atteins les dernières planches avant qu’elle ne remonte.</p>'
      : '<p>Tu avances en retenant ton souffle, mais une planche gémit sous ta botte. La chose s’immobilise sous toi, puis ses longs doigts se referment sur le bord du pont. Elle te barre la route.</p>'}`,
    choices: s => s.flags.bridgeCalmPassed
      ? [{ label: 'Achever la traversée', to: 'c63' }]
      : [{ label: 'Faire face au marcheur', to: 'c61', effect: t => { t.flags.bridgeSolution = 'fight'; if (t.combats?.bridgeWalker?.hp <= 0) replayCombat(t, 'bridgeWalker'); } }]
  },

  c132: {
    number: 'PAGE 153', title: 'La première sentinelle', noImage: true,
    onEnter: s => { s.flags.sentinelResultAcknowledged = true; },
    text: s => `<p>Tu affrontes la première sentinelle, l’épée levée.</p>${sentinelCardsHtml(s)}${sentinelResultHtml(s)}`,
    choices: s => sentinelResultChoices(s)
  },
  c133: {
    number: 'PAGE 154', title: 'Le tir sur la première sentinelle', noImage: true,
    onEnter: s => { s.flags.sentinelResultAcknowledged = true; },
    text: s => `<p>Tu vises la première sentinelle et lances ta lame.</p>${sentinelCardsHtml(s)}${sentinelResultHtml(s)}`,
    choices: s => sentinelResultChoices(s)
  },
  c134: {
    number: 'PAGE 155', title: 'La seconde sentinelle', noImage: true,
    onEnter: s => { s.flags.sentinelResultAcknowledged = true; },
    text: s => `<p>Tu te tournes vers la seconde sentinelle et frappes.</p>${sentinelCardsHtml(s)}${sentinelResultHtml(s)}`,
    choices: s => sentinelResultChoices(s)
  },
  // V68.32 : monde sous la cité, dédale défensif. Illustrations explicitement désactivées en attente de création WebP.
  c152: {
    number: 'PAGE 169', title: 'Le dédale des défenses', noImage: true,
    text: `<p>La galerie est brûlante. La poussière flotte entre les pierres sales. Dans des supports de fer, de petites flammes immobiles diffusent une lumière bleu pâle et or. Elles ne semblent rien consumer.</p>
      <p>Un pas traînant secoue le sol. Au coude suivant, une masse presque humaine avance vers toi. Un bras racle la paroi. Sa tête penche sans trouver ton regard.</p>
      <p>À gauche, une fente étroite s’ouvre dans la roche. À droite, un renfoncement peut te dissimuler. La chose approche.</p>`,
    choices: [
      { label: 'Te jeter sur la créature', to: 'c153', effect: s => { if (s.combats?.labyrinthWanderer?.hp <= 0) replayCombat(s,'labyrinthWanderer'); } },
      { label: 'Te cacher dans le renfoncement', to: 'c155' },
      { label: 'Te glisser dans la galerie étroite à gauche', to: 'c157' }
    ]
  },
  c153: {
    number: 'PAGE 170', title: '', noImage: true,
    text: s => { const e=ENEMIES.labyrinthWanderer, c=combatState(s,'labyrinthWanderer',e);
      if(c.hp<=0) return `${enemyCardHtml(s,'labyrinthWanderer',e)}${combatRoundHtml(s,'labyrinthWanderer',e)}${throwingBladeResultHtml(s,'labyrinthWanderer',e)}<p>Ton dernier coup abat la chose. Ses pas cessent de faire vibrer la galerie. Un grondement répond au loin.</p>`;
      if(s.hp<=0) return `${combatRoundHtml(s,'labyrinthWanderer',e)}<p>Tu t’effondres contre la paroi.</p>`;
      return `<p>Tu bondis, l’épée en avant. La créature relève la tête et frappe de tout son poids. Le passage ne permet plus de reculer.</p>${enemyCardHtml(s,'labyrinthWanderer',e)}${combatRoundHtml(s,'labyrinthWanderer',e)}${throwingBladeResultHtml(s,'labyrinthWanderer',e)}`; },
    choices: s => {const e=ENEMIES.labyrinthWanderer,c=combatState(s,'labyrinthWanderer',e);
      return s.hp<=0?fatalChoices():c.hp<=0?[{label:'Courir vers les galeries suivantes',to:'c168'}]:combatActionChoices(s,'labyrinthWanderer',e,'c153');}
  },
  c154: {
    number: 'PAGE 171', title: '', noImage: true,
    text: s => `<p>Ta lame file vers la créature.</p>${enemyCardHtml(s,'labyrinthWanderer',ENEMIES.labyrinthWanderer)}${throwingBladeResultHtml(s,'labyrinthWanderer',ENEMIES.labyrinthWanderer)}`,
    choices: s => {const e=ENEMIES.labyrinthWanderer,c=combatState(s,'labyrinthWanderer',e);
      return s.hp<=0?fatalChoices():c.hp<=0?[{label:'Poursuivre dans la galerie',to:'c168'}]:combatActionChoices(s,'labyrinthWanderer',e,'c153');}
  },
  c155: {
    number: 'PAGE 172', title: '', noImage: true,
    text: `<p>Tu t’aplatis dans la faille. Un pas. Puis un autre. Chaque choc fait tomber une pincée de poussière sur ton épaule.</p>
      <p>Ta paume glisse sur la poignée. Tu la resserres. Le souffle de la chose passe tout près. Son flanc découvre une ouverture.</p>`,
    choices:[{label:'Surgir et frapper',to:'c156'}]
  },
  c156: {
    number: 'PAGE 173', title: '', noImage: true,
    text:`<p>Tu jaillis du recoin. Ton coup atteint la créature avant qu’elle puisse se retourner. Elle heurte la paroi et s’affaisse.</p>
      <p>Plus loin, une pierre tombe. Quelque chose d’autre a entendu.</p>`,
    choices:[{label:'Continuer sans attendre',to:'c168'}]
  },
  c157: {
    number: 'PAGE 174', title: '', noImage: true,
    text:`<p>Tu te glisses de profil dans la fente. Derrière toi, le lourd pas s’arrête : la créature ne peut pas passer.</p>
      <p>Le tunnel s’ouvre soudain sur une salle immense. Une arête rocheuse traverse le vide. Sa surface luit d’humidité.</p>`,
    choices:[{label:'T’engager sur l’arête',to:'c158'}]
  },
  c158: {
    number: 'PAGE 175', title: '', noImage: true,
    text:s=>`<p>La traversée commence. Un faux pas suffirait à te précipiter plus bas.</p>
      ${labyrinthVoiceTier(s)==='clear'?'<p>Une voix souffle tout près : « La dalle claire… évite-la. » Une partie du passage se détache sous tes yeux.</p>':labyrinthVoiceTier(s)==='faint'?'<p>Un murmure traverse ta tête : « Pas… là… » Tu hésites devant les pierres humides.</p>':'<p>Aucun murmure. Seulement l’eau qui goutte dans le vide.</p>'}
      <p>Le chemin se rétrécit encore.</p>`,
    choices:[{label:'Franchir le passage glissant',to:'c159',effect:s=>labyrinthTrap(s,'labyrinthLedge')}]
  },
  c159: {
    number: 'PAGE 176', title: '', noImage: true,
    text:s=>{const r=s.flags.labyrinthLedge;
      if(!r)return '<p>Le passage vacille. Tu n’as pas encore franchi la dalle glissante.</p>';
      return `${labyrinthTrapResult(s,'labyrinthLedge')}${r.success?(r.tier==='clear'?'<p>La voix te fait déplacer ton pied juste à temps. La dalle s’effondre derrière toi. Tu atteins l’autre rive sans glisser.</p>':'<p>Tu prends appui sur une saillie sèche et franchis le vide. Tu tiens debout.</p>'):'<p>Ton pied dérape. Tu bascules, heurtes la paroi et te rattrapes de justesse à une corniche inférieure.</p>'}`;},
    choices:s=>s.hp<=0?fatalChoices():!s.flags.labyrinthLedge?[{label:'Revenir au passage',to:'c158'}]:s.flags.labyrinthLedge.success?[{label:'Gagner la sortie de la salle',to:'c167'}]:[{label:'Te hisser sur la corniche inférieure',to:'c160'}]
  },
  c160: {
    number: 'PAGE 177', title: '', noImage: true,
    text:s=>`<p>Tu retombes sur la corniche. ${s.flags.labyrinthLedge?.damaged?'La chute t’a coûté un point de Vie.':'Tu retrouves un appui.'}</p>
      <p>À peine redressé, tu entends des griffes sur la pierre. Un rampant au museau allongé se hisse hors de l’obscurité. Ses mâchoires claquent à la hauteur de tes jambes.</p>`,
    choices:s=>s.hp<=0?fatalChoices():[{label:'L’affronter avant qu’il ne bondisse',to:'c161',effect:s=>{if(s.combats?.labyrinthCaiman?.hp<=0)replayCombat(s,'labyrinthCaiman');}}]
  },
  c161: {
    number: 'PAGE 178', title: '', noImage: true,
    text:s=>{const e=ENEMIES.labyrinthCaiman,c=combatState(s,'labyrinthCaiman',e);
      if(c.hp<=0)return `${enemyCardHtml(s,'labyrinthCaiman',e)}${combatRoundHtml(s,'labyrinthCaiman',e)}${throwingBladeResultHtml(s,'labyrinthCaiman',e)}<p>Le rampant s’immobilise. Plusieurs corps sont étendus plus loin sur la corniche.</p>`;
      return `<p>La bête fond sur toi. Sa gueule frappe au ras du sol, près du vide.</p>${enemyCardHtml(s,'labyrinthCaiman',e)}${combatRoundHtml(s,'labyrinthCaiman',e)}${throwingBladeResultHtml(s,'labyrinthCaiman',e)}`;},
    choices:s=>{const e=ENEMIES.labyrinthCaiman,c=combatState(s,'labyrinthCaiman',e);
      return s.hp<=0?fatalChoices():c.hp<=0?[{label:'Examiner la corniche',to:'c163'}]:combatActionChoices(s,'labyrinthCaiman',e,'c161');}
  },
  c162: {
    number: 'PAGE 179', title: '', noImage: true,
    text:s=>`<p>Tu lances une lame vers le rampant.</p>${enemyCardHtml(s,'labyrinthCaiman',ENEMIES.labyrinthCaiman)}${throwingBladeResultHtml(s,'labyrinthCaiman',ENEMIES.labyrinthCaiman)}`,
    choices:s=>{const e=ENEMIES.labyrinthCaiman,c=combatState(s,'labyrinthCaiman',e);
      return s.hp<=0?fatalChoices():c.hp<=0?[{label:'Examiner la corniche',to:'c163'}]:combatActionChoices(s,'labyrinthCaiman',e,'c161');}
  },
  c163: {
    number: 'PAGE 180', title: '', noImage: true,
    text:s=>`<p>Des corps gisent contre la roche. Plusieurs ont les bottes tournées vers le vide.</p>
      ${s.flags.labyrinthCorpseLooted?'<p>La sacoche ouverte est vide.</p>':'<p>Une sacoche reste prise sous la sangle d’un manteau. Son fermoir tient encore.</p>'}
      <p>Un grondement roule dans le plafond. Tu dois repartir.</p>`,
    choices:s=>s.flags.labyrinthCorpseLooted?[{label:'Remonter',to:'c165'}]:[
      {label:'Saisir la sacoche',to:'c164',effect:labyrinthTakeCorpseLoot},
      {label:'Laisser les corps et remonter',to:'c165'}]
  },
  c164: {
    number: 'PAGE 181', title: '', noImage: true,
    text:s=>`<p>Tu arraches la sacoche à la sangle et l’ouvres : une potion de guérison et trois petites lames de jet.</p>
      <p>Une fissure s’étend juste au-dessus de toi.</p>`,
    choices:[{label:'Remonter avant l’effondrement',to:'c165'}]
  },
  c165: {
    number: 'PAGE 182', title: '', noImage: true,
    text:`<p>Tu plantes tes doigts dans les joints de la paroi et te hisses hors de la corniche. Un bloc se détache à l’endroit où tu te trouvais.</p>`,
    choices:[{label:'Rejoindre la passerelle supérieure',to:'c166'}]
  },
  c166: {
    number: 'PAGE 183', title: '', noImage: true,
    text:`<p>Tu agrippes le rebord, roules sur la pierre humide et retrouves le chemin étroit. Derrière toi, la corniche disparaît dans la poussière.</p>`,
    choices:[{label:'Atteindre l’autre bout de la salle',to:'c167'}]
  },
  c167: {
    number: 'PAGE 184', title: '', noImage: true,
    text:`<p>La fente s’élargit. Une dernière pierre cède derrière toi. Tu débouches sur la galerie principale, plus loin que la créature aux pas lourds.</p>`,
    choices:[{label:'Poursuivre dans les galeries',to:'c168'}]
  },
  c168: {
    number: 'PAGE 185', title: '', noImage: true,
    text:`<p>Deux virages. Une flamme surnaturelle tremble enfin dans son support.</p>
      <p>Un coup profond secoue la montagne. La galerie se fend devant toi : sous une arche tombée, un espace demeure. À côté, des dalles disjointes forment un passage plus direct au-dessus d’un gouffre.</p>
      <p>Le plafond commence à s’écrouler.</p>`,
    choices:[
      {label:'Glisser sous l’arche effondrée',to:'c169'},
      {label:'Bondir par-dessus les dalles brisées',to:'c170',effect:s=>labyrinthTrap(s,'labyrinthArch')}
    ]
  },
  c169: {
    number: 'PAGE 186', title: '', noImage: true,
    text:`<p>Tu te jettes sous l’arche. Une pluie de gravats s’écrase là où tu te trouvais. Tu rampes, déchires ta manche contre la roche et ressors de l’autre côté.</p>
      <p>Quelqu’un tousse au bout de la galerie.</p>`,
    choices:[{label:'Suivre la toux',to:'c172'}]
  },
  c170: {
    number: 'PAGE 187', title: '', noImage: true,
    text:s=>{const r=s.flags.labyrinthArch;
      if(!r)return '<p>Les dalles tremblent devant le vide.</p>';
      return `${labyrinthTrapResult(s,'labyrinthArch')}${r.success?(r.tier==='clear'?'<p>La voix t’indique une dalle solide. Tu bondis dessus, puis de l’autre côté, juste avant l’effondrement.</p>':'<p>Tu bonds. La dernière dalle tombe sous ton talon, mais tu atteins la rive opposée.</p>'):'<p>Une dalle s’abaisse sous ton pied. Tu glisses dans l’ouverture et heurtes une marche plus basse.</p>'}`;},
    choices:s=>s.hp<=0?fatalChoices():!s.flags.labyrinthArch?[{label:'Revenir à l’arche',to:'c168'}]:s.flags.labyrinthArch.success?[{label:'Suivre la toux dans le couloir',to:'c172'}]:[{label:'Te relever sans attendre',to:'c171'}]
  },
  c171: {
    number: 'PAGE 188', title: '', noImage: true,
    text:s=>`<p>Tu te hisses sur la marche. ${s.flags.labyrinthArch?.damaged?'La chute t’a coûté un point de Vie.':'Tu retrouves ton équilibre.'}</p>
      <p>Au-dessus de toi, la dernière dalle s’écrase et ferme le passage. Une toux retentit au bout du couloir.</p>`,
    choices:s=>s.hp<=0?fatalChoices():[{label:'Suivre la toux',to:'c172'}]
  },
  c172: {
    number: 'PAGE 189', title: 'La femme du dédale', noImage: true,
    text:`<p>Au troisième virage, une femme est accroupie sous une flamme immobile. Son visage reste dans l’ombre. Elle semble humaine.</p>
      <p>Un piège claque derrière toi. Elle lève les yeux.</p>
      <blockquote>« Vous aussi, vous cherchez quelqu’un ? Approchez. Je n’ai plus la force de courir. »</blockquote>`,
    choices:[{label:'Lui demander ce qui lui est arrivé',to:'c173'}]
  },
  c173: {
    number: 'PAGE 190', title: '', noImage: true,
    text:`<p>« J’ai perdu quelqu’un là-dessous. Je suis venue le chercher. »</p>
      <p>Elle désigne les galeries.</p>
      <blockquote>« Les pièges sont partout. Au début, la voix me prévenait : la pierre qui tombe, le sol qui cède… Mais elle me suivait partout. J’ai cru qu’elle voulait m’avaler. »</blockquote>
      <p>Une secousse la fait grimacer. Elle ne parvient pas à tendre la jambe.</p>`,
    choices:[{label:'Lui demander pourquoi la voix s’est tue',to:'c174'}]
  },
  c174: {
    number: 'PAGE 191', title: '', noImage: true,
    text:`<p>« J’ai avalé de la terre noire. Beaucoup. La voix a disparu. J’étais enfin seule dans ma tête. »</p>
      <p>Elle montre ses jambes blessées et rit sans joie.</p>
      <blockquote>« Libre, oui. Mais aveugle aux pièges. Sans ses avertissements, je suis tombée encore et encore. Maintenant je ne peux plus marcher. »</blockquote>
      <p>Une flamme étrange éclaire un sac posé contre son genou.</p>
      <blockquote>« Prenez ça. Je ne sortirai plus d’ici. »</blockquote>`,
    choices:[{label:'Prendre le sac qu’elle te tend',to:'c175',effect:labyrinthWomanGift}]
  },
  c175: {
    number: 'PAGE 192', title: '', noImage: true,
    text:s=>`<p>Son sac contient une ampoule de liquide blanc, un sachet de terre noire et une potion de guérison.</p>
      <p>Elle observe ton arme. « Vous comptiez vraiment descendre avec ça ? »</p>
      <p>Elle tire de son fourreau une épée à la lame rouge sombre, fine et solide.</p>
      <blockquote>« Un forgeron-sorcier l’a faite loin d’ici. Je ne connais pas sa magie. Mais elle m’a sortie de bien des impasses. »</blockquote>
      <p>La poignée trouve aussitôt sa place dans ta main. <strong>Épée équipée : puissance 8, Dextérité −1.</strong></p>
      <p>Elle retient ton bras une dernière fois.</p>`,
    choices:[{label:'Écouter sa dernière demande',to:'c176'}]
  },
  c176: {
    number: 'PAGE 193', title: '', noImage: true,
    text:`<p>Un grondement lui fait fermer les yeux.</p>
      <blockquote>« Je ne veux pas devenir l’une de ces choses. Je sens que ça approche… Achevez-moi. S’il vous plaît. »</blockquote>
      <p>Elle lâche ton bras. Au loin, les pas lourds reprennent.</p>`,
    choices:[
      {label:'Accéder à sa demande et lui promettre de libérer les prisonniers',to:'c177',effect:s=>{s.flags.labyrinthWomanFate='dead';}},
      {label:'Refuser de l’achever et partir',to:'c178',effect:s=>{s.flags.labyrinthWomanFate='spared';}}
    ]
  },
  c177: {
    number: 'PAGE 194', title: '', noImage: true,
    text:`<p>Tu lui promets de tenter de libérer ceux qui sont enfermés plus bas.</p>
      <p>Un coup bref. Son corps cesse de trembler. Une larme reste au bord de sa joue.</p>
      <p>Tu reprends la galerie. Derrière toi, la flamme ne vacille pas.</p>`,
    choices:[{label:'Poursuivre vers la prison',to:'c179'}]
  },
  c178: {
    number: 'PAGE 195', title: '', noImage: true,
    text:`<p>Tu ranges ton arme. Elle détourne la tête.</p>
      <blockquote>« Alors partez. Avant que je ne me relève autrement. »</blockquote>
      <p>Tu la laisses sous la flamme. Un cri étouffé te poursuit jusqu’au tournant.</p>`,
    choices:[{label:'Poursuivre vers la prison',to:'c179'}]
  },
  c179: {
    number: 'PAGE 196', title: '', noImage: true,
    text:s=>`<p>La dernière galerie s’incline vers une porte entrouverte. Au-delà, aucun bruit.</p>
      ${hasItem(s,'ampoule_femme')&&hasItem(s,'terre_femme')?'<p>Dans ton sac, le liquide blanc et la terre noire pèsent presque le même poids. L’un affaiblit l’emprise, l’autre étouffe la voix mais rapproche de la transformation.</p>':'<p>Tu fais l’inventaire de tes dernières ressources avant la porte.</p>'}
      ${labyrinthVoiceTier(s)==='clear'?'<p>La voix murmure encore : « Par ici… »</p>':labyrinthVoiceTier(s)==='faint'?'<p>Quelques syllabes se mêlent au bruit de ton souffle.</p>':'<p>Tu n’entends plus aucune voix.</p>'}
      <p>Il reste un instant avant de franchir la porte.</p>`,
    choices:s=>[
      ...(hasItem(s,'ampoule_femme')&&contaminationLevel(s)>0?[{label:'Utiliser l’ampoule blanche',to:'c180',effect:labyrinthUseWhite}]:[]),
      ...(hasItem(s,'terre_femme')?[{label:contaminationLevel(s)+3>=13?'Absorber la terre noire malgré le risque de transformation':'Absorber une dose de terre noire',to:'c181',effect:labyrinthUseEarth}]:[]),
      {label:'Ne rien prendre et avancer',to:'c182'}
    ]
  },
  c180: {
    number: 'PAGE 197', title: '', noImage: true,
    text:s=>`<p>Le liquide blanc coule sur ta langue. Son goût amer fait reculer la terre noire.</p>
      <p>La voix revient par bribes, ou devient plus distincte. Tu presses le pas vers la porte.</p><p><strong>Terre noire : ${contaminationLevel(s)}/13.</strong></p>`,
    choices:[{label:'Franchir la porte',to:'c183'}]
  },
  c181: {
    number: 'PAGE 198', title: '', noImage: true,
    text:s=>`<p>La poudre sèche colle à ta gorge. La voix s’éloigne, mais une douleur sourde s’installe sous ta peau.</p>
      <p><strong>Terre noire : ${contaminationLevel(s)}/13.</strong></p>
      ${s.flags.blackEarthTransformed?'<p>Tes doigts se crispent. La transformation commence avant que tu puisses avancer.</p>':'<p>Tu atteins la porte en serrant les dents.</p>'}`,
    choices:s=>s.flags.blackEarthTransformed?fatalChoices():[{label:'Franchir la porte',to:'c183'}]
  },
  c182: {
    number: 'PAGE 199', title: '', noImage: true,
    text:`<p>Tu repousses les deux substances au fond du sac. Ni l’une ni l’autre ne décidera pour toi, pas maintenant.</p>
      <p>La porte est juste devant.</p>`,
    choices:[{label:'Franchir la porte',to:'c183'}]
  },
  c183: {
    number: 'PAGE 200', title: 'Le silence après le dédale', noImage: true,
    text:`<p>Tu franchis le seuil. L’air devient frais. Les pas, les chutes et les grondements cessent enfin.</p>
      <p>Une immense cavité s’ouvre devant toi. Des constructions anciennes émergent d’une brume légère. Pour la première fois depuis la cité, tu peux t’arrêter et regarder.</p>
      <p>Ta respiration est courte. Tes mains tremblent encore sur l’épée rouge. Quelque part, plus loin, se trouve la prison.</p>
      <p><em>Fin de ce prototype du dédale. Le monde suivant reprendra dans le calme.</em></p>`,
    choices:[
      {label:'Reprendre au dernier point de sauvegarde',action:'checkpoint'},
      {label:'Recommencer depuis le début',action:'restart'}
    ]
  },


  c184: {
    number:'PAGE 116',title:'Le livre de bois',noImage:true,
    text:s=>`<p>Tu effleures les reliures couvertes de poussière. L’une d’elles ne s’ouvre pas.</p>
      <p>Ce n’est pas un livre : couverture et pages ont été taillées dans un même bloc de bois. Tu tires légèrement dessus. Une résistance vient de derrière l’étagère, comme si l’objet était relié à quelque chose.</p>
      ${s.flags.secretPassageOpened?'<p>Le mécanisme est déjà libéré. La trappe demeure ouverte entre les étagères.</p>':'<p>Il suffirait de tirer plus fort.</p>'}`,
    choices:s=>s.flags.secretPassageOpened
      ? [{label:'Se glisser dans la trappe',to:'c186'},{label:'Revenir dans la salle',to:'c107'}]
      : [{label:'Tirer doucement le faux livre',to:'c185',effect:t=>{t.flags.secretPassageOpened=true;}},
         {label:'Le laisser en place',to:'c107'}]
  },
  c185: {
    number:'PAGE 117',title:'Le verrou',noImage:true,
    text:`<p>Tu tires le livre vers toi. Un bruit sourd résonne derrière le mur : un verrou vient de se libérer.</p>
      <p>Entre deux étagères, une étroite trappe pivote lentement. L’ouverture laisse passer une seule personne. Aucun bruit ne vient de l’autre côté.</p>`,
    choices:[{label:'Se glisser par la trappe',to:'c186'},{label:'Rester dans le poste de secours',to:'c107'}]
  },
  c186: {
    number:'PAGE 118',title:'La cache du soignant',
    text:`<p>Tu te glisses dans l’ouverture. La pièce est petite, presque entièrement plongée dans le noir. L’air y est sec et immobile.</p>
      <p>Un grand coffre est ouvert contre le mur. Sur une tablette, un cahier couvert d’une écriture serrée attend près d’une chandelle consumée.</p>`,
    choices:[{label:'Lire le cahier',to:'c187'},{label:'Examiner le coffre ouvert',to:'c188'},{label:'Ressortir par la trappe',to:'c107'}]
  },
  c187: {
    number:'PAGE 119',title:'Le cahier du soignant',noImage:true,
    text:`<p>Tu ouvres le cahier. Une main tremblante a rempli les pages d’une écriture serrée.</p>
      <blockquote>« J’ai décidé de raconter cette histoire, même si personne ne doit jamais la lire. J’ai besoin de déposer ce poids quelque part.</blockquote>
      <blockquote>Je ne crois plus aux Veilleurs. Ils sont devenus pires que ce qu’ils prétendent combattre. D’ailleurs, nous ne savons même pas ce que nous combattons.</blockquote>
      <blockquote>J’ai vu tant d’hommes arriver ici en quête de secours. Nous leur avons promis de les sauver. Regardez ce que nous avons fait d’eux.</blockquote>
      <blockquote>Une révolte se prépare. Je sais que je n’y survivrai probablement pas. Mais si je trouve le courage de distribuer ces flacons aux prisonniers, peut-être auront-ils une chance de s’échapper.</blockquote>
      <blockquote>Si l’un d’entre vous lit ces lignes, pardonnez-nous. Pardonnez-moi.</blockquote>
      <blockquote>Les Veilleurs ont ordonné la destruction de toutes les potions capables de guérir la terre noire. J’ai réussi à en cacher une ici.</blockquote>
      <blockquote>Ce n’est presque rien.</blockquote>
      <blockquote>J’espère qu’elle vous sauvera. »</blockquote>
      <p>Les dernières lignes s’interrompent brusquement.</p>
      <p>Tu refermes le cahier et tournes les yeux vers le coffre ouvert.</p>`,
    choices:[{label:'Fouiller le coffre',to:'c188'},{label:'Revenir dans la cache',to:'c186'}]
  },
  c188: {
    number:'PAGE 120',title:'Le dernier remède',noImage:true,
    text:s=>`<p>Le coffre contient des étoffes moisies et des flacons brisés. Sous un morceau de toile, un emplacement a été ménagé dans le bois.</p>
      ${s.flags.secretAmpouleTaken
        ? '<p>L’emplacement de l’ampoule blanche est vide. Tu as déjà pris le dernier remède du soignant.</p>'
        : '<p>Une petite ampoule de liquide blanc repose dans la cavité, parfaitement intacte.</p><p>À côté, une étiquette : « Contamination par la terre noire. Une dose. »</p>'}`,
    choices:s=>[
      ...(!s.flags.secretAmpouleTaken?[{label:'Prendre l’ampoule blanche cachée',to:'c189',effect:t=>{
        if (!t.flags.secretAmpouleTaken) {
          addItem(t,'ampoule_blanche_cache','Ampoule blanche — cache du soignant','Usage unique : réduit la terre noire de 4 points, sans soigner les blessures.');
          t.flags.secretAmpouleTaken=true;
        }
      }}]:[]),
      {label:'Revenir dans la cache',to:'c186'},
      {label:'Quitter la cache',to:'c107'}
    ]
  },
  c189: {
    number:'PAGE 121',title:'L’ampoule du soignant',noImage:true,
    text:`<p>Tu enveloppes la petite ampoule dans un coin de ton vêtement et la ranges avec précaution. Le liquide blanc frémit derrière le verre.</p><p>Le soignant a peut-être perdu la vie pour préserver cette seule dose.</p>`,
    choices:[{label:'Revenir dans la cache',to:'c186'},{label:'Quitter la cache',to:'c107'}]
  },
  c190: {
    number:'PAGE 123',title:'Le sachet de terre noire',noImage:true,
    text:s=>`<p>Tu avances la main vers l’étagère en évitant les poussières épaisses qui couvrent le bois.</p>
      ${s.visited?.c140 || hasItem(s,'sacoche_terre_noire')
        ? '<p>La place du petit sachet est vide : tu as déjà emporté cette dose de terre noire.</p>'
        : '<p>Un petit sachet contient de la terre noire sèche. Une mention au dos indique : « Dose : trois points. » Tu pourrais le conserver sans le consommer.</p>'}
      <p>Un nouveau couinement monte derrière les sacs empilés.</p>`,
    choices:s=>[
      ...(!(s.visited?.c140 || hasItem(s,'sacoche_terre_noire'))?[{label:'Prendre le sachet sans consommer la poudre',to:'c140',effect:t=>{
        if (!t.visited?.c140 && !hasItem(t,'sacoche_terre_noire')) addItem(t,'sacoche_terre_noire','Sacoche de terre noire','Usage unique : +3 terre noire.');
        t.flags.blackEarthBagOffered=true;
      }}]:[]),
      {label:'Revenir dans la réserve',to:'c108'},
      {label:'Fouiller aussi les sacs',to:s.flags.reserveRatDead?'c194':s.flags.reserveRatAwakened?'c192':'c191',effect:t=>{if(!t.flags.reserveRatDead)t.flags.reserveRatAwakened=true;}}
    ]
  },
  c191: {
    number:'PAGE 125',title:'Quelque chose dans les sacs',noImage:true,
    text:s=>`<p>Tu ouvres un premier sac. Une poussière épaisse se soulève. Le couinement cesse.</p>
      <p>Tu tires sur la cordelette du suivant. Un rat difforme, beaucoup trop gros pour l’espace qu’il occupe, jaillit entre les plis. Il se jette sur toi, les pattes tendues.</p>
      <p>Tu recules juste assez pour dégainer. Il bondit à nouveau.</p>
      ${enemyCardHtml(s,'reserveRat',ENEMIES.reserveRat)}`,
    choices:s=>combatActionChoices(s,'reserveRat',ENEMIES.reserveRat,'c192')
  },
  c192: {
    number:'PAGE 126',title:'Le combat de la réserve',noImage:true,
    text:s=>`<p>Les sacs se déchirent autour de vous. Le rat attaque dans un froissement de toile et de bois.</p>
      ${enemyCardHtml(s,'reserveRat',ENEMIES.reserveRat)}
      ${s.combats?.reserveRat?.lastBlade?throwingBladeResultHtml(s,'reserveRat',ENEMIES.reserveRat):combatRoundHtml(s,'reserveRat',ENEMIES.reserveRat)}
      ${s.combats?.reserveRat?.hp<=0?'<p>La créature s’affaisse sur le sol. Le silence revient. Quelque chose brille dans le petit sac où elle se cachait.</p>':''}`,
    choices:s=>s.hp<=0?fatalChoices():s.combats?.reserveRat?.hp<=0
      ? [{label:'Examiner le sac du rat',to:'c194',effect:t=>{t.flags.reserveRatDead=true;}}]
      :combatActionChoices(s,'reserveRat',ENEMIES.reserveRat,'c192')
  },
  c193: {
    number:'PAGE 127',title:'La lame contre le rat',noImage:true,
    text:s=>`<p>Tu lances une lame avant que le rat puisse te rejoindre.</p>
      ${enemyCardHtml(s,'reserveRat',ENEMIES.reserveRat)}
      ${throwingBladeResultHtml(s,'reserveRat',ENEMIES.reserveRat)}
      ${s.combats?.reserveRat?.hp<=0?'<p>Le rat s’immobilise au milieu des sacs éventrés.</p>':'<p>Le rat cherche de nouveau à bondir.</p>'}`,
    choices:s=>s.hp<=0?fatalChoices():s.combats?.reserveRat?.hp<=0
      ? [{label:'Examiner le sac du rat',to:'c194',effect:t=>{t.flags.reserveRatDead=true;}}]
      :[{label:'Poursuivre le combat',to:'c192'}]
  },
  c194: {
    number:'PAGE 128',title:'Le sac du rat',noImage:true,
    onEnter:s=>{if(s.combats?.reserveRat?.hp<=0)s.flags.reserveRatDead=true;},
    text:s=>`${!s.combats?.reserveRat || s.combats.reserveRat.hp>0
        ? '<p>Le rat garde toujours son sac au milieu des débris. Impossible de l’atteindre tant qu’il est vivant.</p>'
        : '<p>Le rat ne bouge plus. Tu dégages le petit sac de toile au milieu des débris. Les coutures sont déchirées et l’intérieur porte des traces de griffes.</p>'}
      ${s.combats?.reserveRat?.hp>0 || !s.combats?.reserveRat?'<p>Il faudra vaincre le rat pour atteindre son sac.</p>':s.flags.reserveRatBladesTaken
        ? '<p>Le sac est vide. Tu as déjà emporté les lames.</p>'
        : '<p>Trois lames de jet reposent au fond, enveloppées dans un chiffon sale.</p>'}`,
    choices:s=>[
      ...(s.combats?.reserveRat?.hp===0 && !s.flags.reserveRatBladesTaken?[{label:'Prendre les trois lames de jet',to:'c195',effect:t=>{
        if (!t.flags.reserveRatBladesTaken) {
          t.throwingBlades=(t.throwingBlades||0)+3;
          syncThrowingBlades(t);
          t.flags.reserveRatBladesTaken=true;
        }
      }}]:[]),
      {label:'Retourner dans la réserve',to:'c108'},
      {label:'Quitter la réserve',to:'c106'}
    ]
  },
  c195: {
    number:'PAGE 129',title:'Les trois lames récupérées',noImage:true,
    text:s=>`<p>Tu essuies les trois lames et les ranges dans ton équipement.</p><p><strong>Tu possèdes maintenant ${s.throwingBlades} lame${s.throwingBlades>1?'s':''} de jet.</strong></p>`,
    choices:[{label:'Revenir dans la réserve',to:'c108'},{label:'Revenir au carrefour',to:'c106'}]
  },
  c135: {
    number: 'PAGE 156', title: 'Le tir sur la seconde sentinelle', noImage: true,
    onEnter: s => { s.flags.sentinelResultAcknowledged = true; },
    text: s => `<p>Tu vises la seconde sentinelle et lances ta lame.</p>${sentinelCardsHtml(s)}${sentinelResultHtml(s)}`,
    choices: s => sentinelResultChoices(s)
  },

  c196: {
    number:'PAGE 106',title:'La bague de lumière',image:'La bague de lumière',
    text:s=>s.flags.labLeverBroken
      ? `<p>Entre deux plaques rouillées repose une bague. Une lueur douce émane du métal et éclaire légèrement tout ce qui s’en approche.</p>
         ${s.flags.labRingTaken
           ? '<p>Tu as déjà récupéré cette bague. Il ne reste rien d’autre parmi les débris.</p>'
           : '<p>Quand tu approches les doigts, la bague semble alléger chacun de tes gestes. Tu pressens qu’elle te rendrait plus agile.</p>'}`
      : '<p>Le bras du mécanisme n’a pas cédé. Tu ne vois aucune bague au sol.</p>',
    choices:s=>[
      ...(s.flags.labLeverBroken && !s.flags.labRingTaken ? [{label:'Prendre la bague (+2 Dextérité)',stay:true,effect:t=>{
        if(t.flags.labLeverBroken && !t.flags.labRingTaken){
          addItem(t,'bague_lueur','Bague de lumière','Une aura pâle éclaire ce qui approche. Tant que tu la portes : +2 Dextérité.');
          t.flags.labRingTaken=true;
        }
      }}] : []),
      {label:'Poursuivre dans le couloir',to:'c197'},
      {label:'Examiner l’armoire éventrée',to:'c138'}
    ]
  },
  c197: {
    number:'PAGE 107',title:'Une silhouette dans le couloir',image:'Une silhouette dans le couloir',
    text:s=>`<p>Un peu plus loin, un corps est accroupi dans l’angle d’un mur. Tu entends des sanglots.</p>
      ${s.flags.youngKnightOutcome==='defeated'
        ? '<p>Le jeune chevalier ne bouge plus. Tu détournes les yeux.</p>'
        : s.flags.youngKnightOutcome==='escaped' || s.flags.youngKnightOutcome==='left'
          ? '<p>Tu reconnais l’endroit où tu as laissé le jeune chevalier. Le silence est revenu.</p>'
          : '<p>Quand tu fais un pas, il relève lentement la tête. C’est un chevalier presque de ton âge. Son visage ruisselle de larmes.</p>'}`,
    choices:s=>s.flags.youngKnightOutcome
      ? [{label:'Poursuivre vers la salle ronde',to:'c104'}]
      : [{label:'T’approcher du jeune chevalier',to:'c198'},
         {label:'Ne pas prendre le risque et continuer d’avancer',to:'c200',effect:t=>{t.flags.youngKnightOutcome='left';}}]
  },
  c198: {
    number:'PAGE 108',title:'Le jeune chevalier',noImage:true,
    text:`<p>Il essaie d’essuyer ses joues, mais ses épaules continuent de trembler.</p>
      <blockquote>« Je croyais être plus fort que les autres. Je suis venu défier la malédiction. »</blockquote>
      <p>Il regarde autour de lui, affolé.</p>
      <blockquote>« Je ne sais plus ce que j’ai fait… ni où je dois aller. Je ne sais même plus depuis combien de temps je suis ici. »</blockquote>
      <p>Il tend la main vers toi, sans parvenir à se lever.</p>
      <blockquote>« Aidez-moi. Je vous en prie. »</blockquote>`,
    choices:s=>s.flags.youngKnightOutcome
      ? [{label:'Quitter le couloir',to:'c104'}]
      : [{label:'L’aider à se relever (test de Dextérité)',to:'c199',effect:reachForYoungKnight},
         {label:'Lui dire que tu préfères continuer seul',to:'c200',effect:t=>{t.flags.youngKnightOutcome='left';}}]
  },
  c199: {
    number:'PAGE 109',title:'La main du chevalier',noImage:true,
    text:s=>!s.flags.youngKnightRoll
      ? '<p>Le jeune chevalier attend toujours que tu décides de lui tendre la main.</p>'
      : `<p>Tu saisis sa main. Sous tes doigts, la peau est rugueuse, irritante, épaisse et étrangement molle. Ce n’est pas une main : son bras s’étire comme un tentacule.</p>
         ${youngKnightRollHtml(s)}
         ${s.flags.youngKnightRoll.success
           ? '<p>Tu réagis avant qu’il ne t’agrippe. Tu dégaines ton épée et la lui enfonces en plein cœur. Il s’effondre, les yeux encore pleins de larmes.</p>'
           : '<p>Le tentacule se referme violemment sur ton poignet. Une douleur fulgurante te traverse le bras. Tu parviens à te dégager et recules, puis tu cours sans te retourner. <strong>−1 Dextérité permanent.</strong></p>'}`,
    choices:[{label:'Reprendre la route vers la salle ronde',to:'c104'}]
  },
  c200: {
    number:'PAGE 110',title:'Continuer seul',noImage:true,
    text:`<p>« Je suis désolé. Je dois continuer seul. »</p>
      <p>Le jeune chevalier laisse retomber sa main. Tu t’éloignes sans savoir s’il comprend encore tes paroles. Ses sanglots s’effacent derrière toi.</p>`,
    choices:[{label:'Rejoindre la salle ronde',to:'c104'}]
  },

};

  // Libellés complets de l’outil de navigation TEST.
  // Les titres narratifs de STORY restent volontairement masqués sur certaines pages.
  const PAGE_NAV_TITLES = {
    'c196': 'La bague de lumière', 'c197': 'La silhouette', 'c198': 'Le jeune chevalier', 'c199': 'La main du chevalier', 'c200': 'Continuer seul',
    'c105': 'Le registre du médecin', 'c106': 'Le carrefour des soins', 'c107': 'Le poste de secours', 'c108': 'La réserve de terre noire',
    "c0": "Prologue — Valombre",
    "c1": "Les écuries de Valombre",
    "c2": "La sacoche de Sir Aldren",
    "c3": "La place de Valombre",
    "c4": "Le marchand",
    "c5": "La forge",
    "c6": "La ruelle",
    "c7": "Ils arrivent",
    "c8": "Le chemin de la montagne",
    "c9": "L’homme au bord du chemin",
    "c10": "Le dernier réflexe",
    "c11": "Le coup",
    "c12": "Une voix sous la terre",
    "c13": "Les affaires de Gaspard Vellin",
    "c14": "La forêt de Rochebrume",
    "c15": "Rochebrume",
    "c16": "La taverne",
    "c17": "La nouvelle",
    "c18": "Les lames d’Élias",
    "c19": "L’étranger",
    "c20": "L’entrée de la grotte",
    "c21": "Le souffle acide",
    "c22": "La salle aux ombres mouvantes",
    "c23": "La fuite",
    "c24": "Le grondement dans l’ombre",
    "c25": "La lame de jet",
    "c26": "Le choc",
    "c27": "Le résultat du combat",
    "c28": "Le camp sous la roche",
    "c29": "Le deuxième échange",
    "c30": "Le journal d’Anselme",
    "c31": "La galerie condamnée",
    "c32": "La pierre",
    "c33": "La fin du combat",
    "c34": "Le tunnel voisin",
    "c35": "Le disparu de Rochebrume",
    "c36": "Sous la terre noire",
    "c37": "Le passage des fissures",
    "c38": "Ce qui restait de lui",
    "c39": "Ce qui vit entre les pierres",
    "c40": "Le monde sous la montagne",
    "c41": "Le lac noir",
    "c42": "Les lueurs sous le lac",
    "c43": "Les lames dans la poche",
    "c44": "Les Grandes Marches",
    "c45": "Le tentacule surgit",
    "c46": "Le lac se referme",
    "c47": "L’îlot de l’œil fermé",
    "c48": "La rive basse",
    "c49": "La paroi friable",
    "c50": "Ceux qui sont descendus",
    "c51": "La petite lame noire",
    "c52": "La silhouette au sommet",
    "c53": "L’appel",
    "c54": "La silhouette inhumaine",
    "c55": "Devant la fissure",
    "c56": "La fissure",
    "c57": "Au-dessus de la cité",
    "c58": "La corniche du vide",
    "c59": "Les pas sous tes pieds",
    "c60": "La course sur le pont",
    "c61": "Le marcheur sous le pont",
    "c62": "Le combat au-dessus du vide",
    "c63": "L’autre extrémité du pont",
    "c64": "La porte suspendue",
    "c65": "La sacoche du Veilleur",
    "c66": "Les quartiers noyés",
    "c67": "Les quartiers hauts",
    "c68": "Vers la place (ancien accès)",
    "c69": "La Cité morte",
    "c70": "Les bâtisseurs",
    "c71": "La porte scellée",
    "c72": "L’appel",
    "c73": "Le seuil",
    "c74": "Trois chemins dans la cité",
    "c75": "Les quartiers des Veilleurs",
    "c76": "Le réfectoire",
    "c77": "Les consignes de garde",
    "c78": "Les derniers manuscrits",
    "c79": "Les deux sentinelles",
    "c80": "Deux contre un",
    "c81": "L’armurerie",
    "c82": "Le bureau fermé",
    "c83": "Les ordres du commandement",
    "c84": "Les derniers jours",
    "c85": "La fissure des appartements",
    "c86": "Entre les parois",
    "c87": "La chambre condamnée",
    "c88": "Le collier du prisonnier",
    "c89": "Le métal sous la peau",
    "c90": "La fuite",
    "c91": "Quitter les quartiers",
    "c92": "Le quartier d’observation",
    "c93": "L’homme derrière la porte",
    "c94": "Les anciens carnets",
    "c95": "Sous la table",
    "c96": "La supplique",
    "c97": "Dans la cellule",
    "c98": "La sortie du quartier",
    "c99": "Le laboratoire des Veilleurs",
    "c100": "La machine d’injection",
    "c101": "La terre sous la peau",
    "c102": "L’ampoule blanche",
    "c103": "La fabrication des gardiens",
    "c104": "Les défenses du sceau",
    "c109": "La grille condamnée",
    "c110": "Les parchemins confisqués",
    "c111": "Le journal des confiscations",
    "c112": "L’avenue basse",
    "c113": "Le passage de service",
    "c114": "Le puits des Veilleurs",
    "c115": "Le palier inférieur",
    "c116": "La porte sous la ville",
    "c117": "Sous la Cité morte",
    "c118": "La fiole emportée",
    "c119": "La fiole emportée",
    "c120": "La potion du marchand",
    "c121": "L’épée de la forgeronne",
    "c122": "Une lame contre la masse",
    "c123": "Une lame contre le disparu",
    "c124": "Une lame sur l’îlot",
    "c125": "Une lame au-dessus du vide",
    "c126": "Une lame dans le couloir",
    "c127": "L’anneau récupéré",
    "c128": "Le gantelet du Veilleur",
    "c130": "La lame de diversion",
    "c131": "La corde du Veilleur",
    "c136": "Les lames récupérées",
    "c137": "La porte ouverte",
    "c138": "Le remède du laboratoire",
    "c139": "L’ampoule du poste de secours",
    "c140": "La sacoche de terre noire",
    "c141": "La corde dans le puits",
    "c142": "L’ancienne descente",
    "c143": "La descente à mains nues",
    "c129": "Avancer sans bruit",
    "c132": "La première sentinelle",
    "c133": "Le tir sur la première sentinelle",
    "c134": "La seconde sentinelle",
    "c135": "Le tir sur la seconde sentinelle",
    "c144": "Le laisser derrière toi",
    "c145": "Le bouclier du chevalier",
    "c146": "Le bouclier récupéré",
    "c147": "L’attaque dans le dos",
    "c148": "La grille ouverte",
    "c149": "La porte cède",
    "c150": "Une lame dans le couloir", "c151": "Le bras qui cède",
    "c152": "L’entrée du dédale", "c153": "Le combat contre l’errant", "c154": "Lame contre l’errant",
    "c155": "L’embuscade", "c156": "Le coup décisif", "c157": "La fente de gauche",
    "c158": "La traversée du vide", "c159": "Le résultat de la traversée", "c160": "La corniche inférieure",
    "c161": "Le rampant de la corniche", "c162": "Une lame contre le rampant", "c163": "Les corps de la corniche",
    "c164": "La sacoche trouvée", "c165": "La remontée", "c166": "Le rebord supérieur",
    "c167": "La galerie retrouvée", "c168": "L’effondrement", "c169": "Sous l’arche",
    "c170": "Le saut", "c171": "La marche inférieure", "c172": "La femme du dédale",
    "c173": "Son histoire", "c174": "Le prix du silence", "c175": "L’épée rouge",
    "c176": "La dernière demande", "c177": "L’achever", "c178": "La laisser",
    "c179": "Le choix de la terre noire", "c180": "Le liquide blanc", "c181": "La dose noire",
    "c182": "Refuser les deux", "c183": "Le calme retrouvé",
    "c184": "Le livre de bois", "c185": "Le verrou secret", "c186": "La cache du soignant",
    "c187": "Le cahier du soignant", "c188": "Le dernier remède", "c189": "L’ampoule cachée",
    "c190": "Le sachet noir", "c191": "Le rat difforme", "c192": "Combat contre le rat",
    "c193": "Lame contre le rat", "c194": "Le sac du rat", "c195": "Les lames récupérées"
};

  // L'ordre d'affichage peut changer ; les identifiants cN restent stables pour les liens et les sauvegardes.
  const PAGE_ORDER = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12', 'c13', 'c14', 'c15', 'c16', 'c17', 'c18', 'c19', 'c20', 'c21', 'c22', 'c23', 'c24', 'c25', 'c26', 'c27', 'c28', 'c29', 'c30', 'c31', 'c32', 'c33', 'c34', 'c35', 'c36', 'c37', 'c38', 'c39', 'c40', 'c41', 'c42', 'c43', 'c44', 'c45', 'c46', 'c47', 'c48', 'c49', 'c50', 'c51', 'c52', 'c53', 'c54', 'c55', 'c56', 'c57', 'c58', 'c59', 'c60', 'c61', 'c62', 'c63', 'c64', 'c65', 'c66', 'c67', 'c68', 'c69', 'c70', 'c71', 'c72', 'c73', 'c74', 'c75', 'c76', 'c77', 'c78', 'c79', 'c80', 'c81', 'c82', 'c83', 'c84', 'c85', 'c86', 'c87', 'c88', 'c89', 'c90', 'c91', 'c92', 'c93', 'c94', 'c95', 'c96', 'c97', 'c98', 'c99', 'c100', 'c101', 'c102', 'c103', 'c138', 'c151', 'c196', 'c197', 'c198', 'c199', 'c200', 'c104', 'c105', 'c106', 'c107', 'c139', 'c184', 'c185', 'c186', 'c187', 'c188', 'c189', 'c108', 'c190', 'c140', 'c191', 'c192', 'c193', 'c194', 'c195', 'c109', 'c110', 'c111', 'c112', 'c113', 'c114', 'c115', 'c116', 'c117', 'c118', 'c119', 'c120', 'c121', 'c122', 'c123', 'c124', 'c125', 'c126', 'c127', 'c128', 'c129', 'c130', 'c131', 'c132', 'c133', 'c134', 'c135', 'c136', 'c137', 'c141', 'c142', 'c143', 'c144', 'c145', 'c146', 'c147', 'c148', 'c149', 'c150', 'c152', 'c153', 'c154', 'c155', 'c156', 'c157', 'c158', 'c159', 'c160', 'c161', 'c162', 'c163', 'c164', 'c165', 'c166', 'c167', 'c168', 'c169', 'c170', 'c171', 'c172', 'c173', 'c174', 'c175', 'c176', 'c177', 'c178', 'c179', 'c180', 'c181', 'c182', 'c183'];
  const PAGE_BY_NODE = Object.fromEntries(PAGE_ORDER.map((id, i) => [id, i]));
  const padPage = n => String(n).padStart(3, '0');

  function equipHeavySword(state) {
    if (state.weapon === 'none') state.weapon = 'heavy';
  }

  function currentForce(state) {
    const itemBonus = hasItem(state, 'brassard_veilleurs') ? 1 : 0;
    return Math.max(3, state.baseForce + (state.forceBonus || 0) + itemBonus);
  }

  function currentDexterity(state) {
    const weaponModifier =
      state.weapon === 'heavy' ? -4 :
      state.weapon === 'light' || state.weapon === 'sorcerer_sword' ? -1 : 0;
    const itemBonus = (hasItem(state, 'anneau_veilleurs') ? 1 : 0) + (hasItem(state, 'bague_lueur') ? 2 : 0);
    const shieldPenalty = shieldIsActive(state) ? 1 : 0;
    return Math.max(3,
      state.baseDexterity +
      (state.dexBonus || 0) +
      itemBonus -
      (state.dexPenalty || 0) -
      (state.flags.collarEquipped ? 1 : 0) -
      shieldPenalty +
      weaponModifier
    );
  }

  function combatPower(state) {
    if (state.weapon === 'heavy') return 5;
    if (state.weapon === 'light') return 2;
    if (state.weapon === 'black_blade') return 6;
    if (state.weapon === 'sorcerer_sword') return 8;
    return 0;
  }

  function weaponLabel(state) {
    if (state.weapon === 'heavy') return 'Épée lourde de Sir Aldren';
    if (state.weapon === 'light') return 'Épée de la forgeronne';
    if (state.weapon === 'black_blade') return 'Lame noire';
    if (state.weapon === 'sorcerer_sword') return 'Épée rouge du forgeron-sorcier';
    return 'Aucune';
  }

  function syncThrowingBlades(state) {
    if ((state.throwingBlades || 0) > 0) {
      state.inventory.lames_jet = {
        name: 'Lames de jet',
        description: 'De petites lames destinées à être lancées au visage pour gagner quelques secondes.',
        quantity: state.throwingBlades
      };
    } else {
      delete state.inventory.lames_jet;
    }
  }

  function createInitialState(seriesProfile = {}) {
    const base = seriesProfile.baseStats || {};
    return {
      node: 'start',
      pageMapVersion: 77,
      heroGender: seriesProfile.heroGender === 'male' ? 'male' : 'female',
      heroName: seriesProfile.heroGender === 'male' ? 'Aubin' : 'Aélis',
      inventory: {},
      flags: {},
      visited: {},
      history: [],
      journal: '',
      hp: base.maxHp || 18,
      maxHp: base.maxHp || 18,
      baseForce: base.force || 8,
      baseDexterity: base.dexterity || 13,
      forceBonus: 0,
      dexBonus: 0,
      dexPenalty: 0,
      contamination: 0,
      weapon: 'none',
      silver: 0,
      goldCoins: 0,
      throwingBlades: 0,
      lastDice: null,
      lastTotal: null,
      lastStat: null,
      lastStatName: '',
      rollCount: 0,
      lastCombatOutcome: null,
      lastCombatKey: null,
      combats: {},
      damageRolls: {},
      lastDamageDie: null,
      lastDamageKey: null,
      lastHealingDie: null,
      protectionItems: {},
      lastDamageResolution: null,
      damageRollResults: {},
      currentCheckpoint: null
    };
  }

  // V53 : les anciennes pages c53...c88 deviennent c56...c91.
  // Conversion unique et idempotente des sauvegardes et checkpoints V52.
  function migratePageNumbersV53(state) {
    if (!state || typeof state !== 'object' || state.pageMapVersion >= 53) return state;
    const renumber = id => {
      if (typeof id !== 'string') return id;
      const match = /^c(\d+)$/.exec(id);
      if (!match) return id;
      const page = Number(match[1]);
      return page >= 53 && page <= 88 ? `c${page + 3}` : id;
    };
    state.node = renumber(state.node);
    if (state.visited && typeof state.visited === 'object' && !Array.isArray(state.visited)) {
      state.visited = Object.fromEntries(Object.entries(state.visited).map(([id, value]) => [renumber(id), value]));
    }
    if (Array.isArray(state.history)) state.history = state.history.map(renumber);
    state.pageMapVersion = 53;
    return state;
  }

  // V55 : après migration éventuelle V53, les anciennes pages 70 à 91 deviennent 75 à 96.
  // Les cinq nouvelles pages 070-074 restent le passage commun obligatoire.
  function migratePageNumbersV55(state) {
    if (!state || typeof state !== 'object') return state;
    if (!Number.isFinite(state.pageMapVersion) || state.pageMapVersion < 53) migratePageNumbersV53(state);
    if (state.pageMapVersion >= 55) return state;
    const renumber = id => {
      if (typeof id !== 'string') return id;
      const match = /^c(\d+)$/.exec(id);
      if (!match) return id;
      const number = Number(match[1]);
      return number >= 70 && number <= 91 ? `c${number + 5}` : id;
    };
    state.node = renumber(state.node);
    if (state.visited && typeof state.visited === 'object' && !Array.isArray(state.visited)) {
      state.visited = Object.fromEntries(Object.entries(state.visited).map(([id, wasVisited]) => [renumber(id), wasVisited]));
    }
    if (Array.isArray(state.history)) state.history = state.history.map(renumber);
    // Legacy route ID used by the old optional room. Preserve the player's chosen path.
    if (state.flags && state.flags.cityRoute === 'names') state.flags.cityRoute = 'quarters';
    state.pageMapVersion = 55;
    return state;
  }


  // V58 : refonte des 3 routes dans la cité. Les anciennes sauvegardes conservent
  // leurs données, mais pointent sur les nouvelles pages correspondantes.
  function migratePageNumbersV58(state) {
    if (!state || typeof state !== 'object') return state;
    migratePageNumbersV55(state);
    if (state.pageMapVersion >= 58) {
      if (!Number.isFinite(state.contamination)) state.contamination = state.flags?.blackEarthContamination ? 2 : 0;
      return state;
    }
    const map = {"c75": "c76", "c76": "c77", "c77": "c83", "c78": "c84", "c79": "c91", "c80": "c92", "c81": "c94", "c82": "c94", "c83": "c93", "c84": "c98", "c85": "c99", "c86": "c100", "c87": "c102", "c88": "c102", "c89": "c103", "c90": "c104", "c91": "c108", "c92": "c109", "c93": "c110", "c94": "c111", "c95": "c112", "c96": "c113"};
    const rename = id => (typeof id === 'string' && map[id]) ? map[id] : id;
    state.node = rename(state.node);
    if (state.visited && typeof state.visited === 'object' && !Array.isArray(state.visited)) {
      state.visited = Object.fromEntries(Object.entries(state.visited).map(([key, value]) => [rename(key), value]));
    }
    if (Array.isArray(state.history)) state.history = state.history.map(rename);
    if (!state.flags || typeof state.flags !== 'object') state.flags = {};
    state.flags.quartersRefectory = !!state.visited?.c76;
    state.flags.quartersGuard = !!state.visited?.c77;
    if (state.visited?.c83) state.flags.officeOpened = true;
    if (!Number.isFinite(state.contamination)) state.contamination = state.flags.blackEarthContamination ? 2 : 0;
    // Une partie commencée avant la jauge peut déjà avoir subi la projection de Gaspard.
    if (Number.isInteger(state.damageRolls?.c12) && !state.flags.gaspardEarthRegistered) {
      state.flags.gaspardEarthRegistered = true;
      state.contamination = Math.max(1, state.contamination);
      state.flags.blackEarthContamination = true;
    }
    state.pageMapVersion = 58;
    return state;
  }
  function migratePageNumbersV59(state) {
    migratePageNumbersV58(state);
    if (!state.flags || typeof state.flags !== 'object') state.flags = {};
    if (state.pageMapVersion >= 59) return state;
    if (state.node === 'c105' && !state.flags.physicianNotesRead) state.node='c114';
    // The original 113 page numbers are stable. Only new pages 114–116 are added.
    state.contamination = Math.max(0, Math.min(13, Math.floor(Number(state.contamination)||0)));
    if (state.contamination >= 13) state.flags.blackEarthTransformed = true;
    state.pageMapVersion = 59;
    return state;
  }
  // V62: put the doctor's mandatory register before the gate in page order.
  // Rename old V59–V61 saves and checkpoints only once; preserve items, flags and rolls.
  function migratePageNumbersV62(state) {
    migratePageNumbersV59(state);
    if (state.pageMapVersion >= 62) return state;
    const map = {"c114":"c105","c115":"c106","c116":"c107","c105":"c108","c106":"c109","c107":"c110","c108":"c111","c109":"c112","c110":"c113","c111":"c114","c112":"c115","c113":"c116"};
    const rename = id => typeof id === 'string' ? (map[id] || id) : id;
    state.node=rename(state.node);
    if (Array.isArray(state.history)) state.history=state.history.map(rename);
    for (const field of ['visited','damageRolls','damageRollResults']) {
      if (state[field] && typeof state[field] === 'object' && !Array.isArray(state[field])) {
        state[field]=Object.fromEntries(Object.entries(state[field]).map(([id,value])=>[rename(id),value]));
      }
    }
    state.pageMapVersion=62;
    return state;
  }
  // V63 : les pages 092–098 sont entièrement réécrites. Une sauvegarde V62.1
  // prise dans ce passage revient à son entrée pour ne pas mélanger les deux scènes.
  function migratePageNumbersV63(state) {
    migratePageNumbersV62(state);
    if (state.pageMapVersion >= 63) return state;
    if (!state.flags || typeof state.flags !== 'object') state.flags = {};
    const insideRewrittenScene = /^c9[2-8]$/.test(state.node || '');
    const exploredOldScene = !!(state.visited && ['c93','c94','c95','c96','c97'].some(id => state.visited[id]));
    if (insideRewrittenScene || exploredOldScene) {
      if (insideRewrittenScene) state.node = 'c92';
      if (!insideRewrittenScene) state.flags.observationLegacyVisit = true;
      for (let n = 92; n <= 98; n++) if (state.visited) delete state.visited[`c${n}`];
      if (Array.isArray(state.history)) state.history = state.history.filter(id => !/^c9[2-8]$/.test(id));
      for (const field of ['observationRead', 'observationMet', 'observationRecordsHeard',
        'observationBodyHeard', 'observationReflexRolled', 'observationReflexPassed',
        'observationReflexDamage', 'observationReflexContaminated', 'observationFight',
        'observationBraceletTaken', 'observationBraceletDeclined', 'observationBalanceAsked']) delete state.flags[field];
    }
    state.pageMapVersion = 63;
    return state;
  }
  // V68 : le passage 106 devient un carrefour facultatif. Le poste, la réserve
  // et la grille changent d'adresse ; une ancienne sauvegarde reste utilisable.
  function migratePageNumbersV68(state) {
    migratePageNumbersV63(state);
    if (state.pageMapVersion >= 68) return state;
    const map = {c106:'c107',c107:'c108',c108:'c109',c109:'c109'};
    const rename = id => typeof id === 'string' ? (map[id] || id) : id;
    state.node=rename(state.node);
    if (Array.isArray(state.history)) state.history=state.history.map(rename);
    for (const field of ['visited','damageRolls','damageRollResults']) {
      if (state[field] && typeof state[field] === 'object' && !Array.isArray(state[field])) {
        state[field]=Object.fromEntries(Object.entries(state[field]).map(([id,value])=>[rename(id),value]));
      }
    }
    if (!state.flags || typeof state.flags !== 'object') state.flags={};
    delete state.flags.commonVoiceChoice;
    delete state.flags.observationBraceletUsed;
    // Les objets et doses déjà obtenus ne sont jamais accordés une seconde fois.
    state.pageMapVersion=68;
    return state;
  }
  // V68.5 : le journal a sa propre page 111. Les anciennes pages 111–116
  // passent à 112–117, y compris les historiques et résultats de dés.
  function migratePageNumbersV69(state) {
    migratePageNumbersV68(state);
    if (state.pageMapVersion >= 69) return state;
    const oldToNew = {c117:'c111',c111:'c112',c112:'c113',c113:'c114',c114:'c115',c115:'c116',c116:'c117'};
    const rename = id => typeof id === 'string' ? (oldToNew[id] || id) : id;
    state.node = rename(state.node);
    if (Array.isArray(state.history)) state.history = state.history.map(rename);
    for (const field of ['visited','damageRolls','damageRollResults']) {
      if (state[field] && typeof state[field] === 'object' && !Array.isArray(state[field])) {
        state[field] = Object.fromEntries(Object.entries(state[field]).map(([key,val])=>[rename(key),val]));
      }
    }
    state.pageMapVersion = 69;
    return state;
  }
  // V68.13 : 65 est désormais la sacoche du pont ; 68 sort du parcours.
  // Une ancienne partie sur 65 ou 68 reprend sans faux gain de lames ni indice inventé.
  function migratePageNumbersV70(state) {
    migratePageNumbersV69(state);
    if (state.pageMapVersion >= 70) return state;
    const rename = id => id === 'c65' ? 'c64' : id === 'c68' ? 'c69' : id;
    state.node = rename(state.node);
    if (Array.isArray(state.history)) state.history = state.history.map(rename);
    if (state.visited && typeof state.visited === 'object') {
      delete state.visited.c65;
      delete state.visited.c68;
    }
    state.pageMapVersion = 70;
    return state;
  }
  // V68.15 : le dialogue 93–98 et les issues du chevalier sont réécrits.
  // Ramener une partie interrompue dans cette scène à son entrée sans confondre
  // l'ancien bracelet et les nouveaux gants ; ne pas attribuer une issue passée.
  function migratePageNumbersV71(state) {
    migratePageNumbersV70(state);
    if (state.pageMapVersion >= 71) return state;
    if (!state.flags || typeof state.flags !== 'object') state.flags = {};
    const oldScene = ['c93','c94','c95','c96','c97','c98','c126','c137'];
    if (oldScene.includes(state.node)) {
      state.node = 'c92';
      for (const id of oldScene) if (state.visited) delete state.visited[id];
      if (Array.isArray(state.history)) state.history = state.history.filter(id => !oldScene.includes(id));
      if (state.combats) delete state.combats.observationPrisoner;
    }
    if (state.node === 'c142') {
      state.flags.cityWellDescent = 'success';
    }
    if (state.inventory && state.inventory.bracelet_ancrage) delete state.inventory.bracelet_ancrage;
    for (const key of ['observationReflexRolled','observationReflexPassed','observationReflexDamage',
      'observationReflexContaminated','observationBraceletTaken','observationBraceletDeclined',
      'observationBalanceAsked','observationFight','observationRecordsHeard','observationBodyHeard',
      'observationRead','observationMet']) delete state.flags[key];
    state.pageMapVersion = 71;
    return state;
  }
  // V68.20 : échange des anciens gants contre le nouveau bouclier.
  // Une paire déjà utilisée devant la grille reste consommée : pas de bouclier gratuit.
  function migratePageNumbersV72(state) {
    migratePageNumbersV71(state);
    if (state.pageMapVersion >= 72) return state;
    if (!state.inventory || typeof state.inventory !== 'object') state.inventory = {};
    if (!state.flags || typeof state.flags !== 'object') state.flags = {};
    if (hasItem(state, 'gants_veilleurs')) {
      removeItem(state, 'gants_veilleurs');
      if (!hasItem(state, 'bouclier_chevalier')) addKnightShield(state);
    }
    if (hasItem(state, 'bouclier_chevalier')) state.flags.knightShieldTaken = true;
    delete state.flags.knightGlovesTaken;
    if (state.flags.tabletsGlovesUsed) state.flags.tabletsExamined = true;
    if (state.node === 'c148') state.node = 'c110';
    if (Array.isArray(state.history)) state.history = state.history.map(id => id === 'c148' ? 'c110' : id);
    state.pageMapVersion = 72;
    return state;
  }
  // V68.33 : migration d'inventaire uniquement, sans modifier les numéros de pages.
  // En V68.32, cocher l'ampoule de TEST créait par erreur celle du laboratoire.
  function migrateInventoryV73(state) {
    const oldVersion = Number(state.pageMapVersion || 0);
    migratePageNumbersV72(state);
    if (state.pageMapVersion >= 73) return state;
    if (!state.inventory || typeof state.inventory !== 'object') state.inventory = {};
    if (!state.flags || typeof state.flags !== 'object') state.flags = {};

    // La vraie prise au laboratoire posait systématiquement labAmpouleTaken.
    // Ne convertir que les sauvegardes V68.32, pour ne pas deviner sur les plus anciennes.
    if (oldVersion === 72 && hasItem(state, 'ampoule_blanche') && !state.flags.labAmpouleTaken) {
      addItem(state, 'ampoule_blanche_test', 'Ampoule blanche — test',
        'Simulation : retire 4 points de terre noire. Ne provient d’aucun lieu du récit.');
      removeItem(state, 'ampoule_blanche');
    }
    // Anciennes sauvegardes : le passage effectif page 139 et le drapeau d'offre
    // permettent de reconnaître la prise, sans confondre un simple saut de TEST.
    if (state.visited?.c139 && state.flags.commonAmpouleOffered) state.flags.commonAmpouleTaken = true;

    if (hasItem(state, 'ampoule_blanche')) state.inventory.ampoule_blanche.name = 'Ampoule blanche — laboratoire';
    if (hasItem(state, 'ampoule_blanche_commune')) state.inventory.ampoule_blanche_commune.name = 'Ampoule blanche — poste de secours';
    if (hasItem(state, 'ampoule_femme')) state.inventory.ampoule_femme.name = 'Ampoule blanche — dédale';
    state.pageMapVersion = 73;
    return state;
  }
  function migratePageNumbersV74(state) {
    migrateInventoryV73(state);
    if (state.pageMapVersion >= 74) return state;
    // No renumbering: new optional scenes are appended after page 183.
    state.pageMapVersion = 74;
    return state;
  }
  // V68.35 : changement de numérotation affichée uniquement.
  // Les clés cN restent identiques dans node, history, visited, checkpoints et journal.
  function migratePageNumbersV75(state) {
    migratePageNumbersV74(state);
    if (state.pageMapVersion >= 75) return state;
    state.pageMapVersion = 75;
    return state;
  }
  // V68.39 : même identité technique des pages, nouvelle pagination et mécanique de la machine.
  function migratePageNumbersV76(state) {
    migratePageNumbersV75(state);
    if (state.pageMapVersion >= 76) return state;
    state.flags = state.flags || {};
    // Une ancienne injection ne confère plus de Force/Dextérité : garder la contamination déjà acquise.
    state.flags.labInjected = false;
    // Une action de l'ancienne machine n'empêche pas la nouvelle découverte.
    if (!state.flags.labLeverBroken) {
      state.flags.labLeverTried = false;
      state.flags.labLeverResultReady = false;
      delete state.flags.labLeverRollCount;
      delete state.flags.labLeverNewInjection;
      delete state.flags.injectionDodged;
    }
    // Une ancienne ampoule déjà obtenue demeure dans l'inventaire ; aucune nouvelle n'apparaît ici.
    state.pageMapVersion = 76;
    return state;
  }

  // V68.45 : l'ID historique « fiole_rouge » reste inchangé afin de préserver
  // les anciennes sauvegardes. Sa couleur réelle est blanche dans le récit.
  function updateVialKnowledge(state) {
    state.inventory = state.inventory || {};
    const known = !!state.flags?.physicianNotesRead;
    if (hasItem(state, 'fiole_rouge')) {
      state.inventory.fiole_rouge.name = known ? 'Ampoule blanche — sacoche d’Aldren' : 'Fiole inconnue — liquide blanc';
      state.inventory.fiole_rouge.description = known
        ? 'Traitement identifié dans le registre du médecin. Usage unique : −4 points de terre noire. Ne soigne pas les blessures.'
        : 'Une fiole de liquide blanc opaque, trouvée dans la sacoche d’Aldren. Son utilité est inconnue.';
    }
    if (hasItem(state, 'potion_sombre')) {
      state.inventory.potion_sombre.name = known ? 'Potion de soin altérée — rouge sombre' : 'Fiole rouge sombre — inconnue';
      state.inventory.potion_sombre.description = known
        ? 'Potion identifiée dans le registre du médecin : +3 Vie (sans dépasser le maximum), +2 points de terre noire.'
        : 'Une fiole trouvée sur Gaspard, semblable à une potion de soin mais anormalement sombre. Effet inconnu.';
    }
  }

  function migrateVialKnowledgeV77(state) {
    migratePageNumbersV76(state);
    if (state.pageMapVersion >= 77) return state;
    state.flags = state.flags || {};
    // Une sauvegarde antérieure sur la page 112 a déjà découvert les préparations.
    if (state.visited?.c105) state.flags.physicianNotesRead = true;
    updateVialKnowledge(state);
    state.pageMapVersion = 77;
    return state;
  }

  const TEST_ITEM_CATALOG = [
    {
      id: 'parchemin',
      name: 'Notes d’Aldren',
      description: 'Un fragment ancien découvert dans les affaires de Sir Aldren. Il peut être relu quand tu veux.'
    },
    {
      id: 'fiole_rouge',
      name: 'Fiole inconnue — liquide blanc',
      description: 'Une fiole de liquide blanc opaque, trouvée dans la sacoche d’Aldren. Son utilité est inconnue.'
    },
    {
      id: 'potion_guerison',
      name: 'Potion de guérison',
      description: 'Une potion du marchand. Elle rend 1 dé de Vie lorsqu’elle est bue.'
    },
    {
      id: 'potion_sombre',
      name: 'Fiole rouge sombre — inconnue',
      description: 'Une fiole sombre trouvée sur Gaspard. Effet inconnu avant la lecture du registre médical.'
    },
    {
      id: 'brassard_veilleurs',
      name: 'Brassard des Veilleurs',
      description: 'Un brassard sombre étonnamment léger. Tant qu’il est coché : +1 Force.'
    },
    {
      id: 'anneau_veilleurs',
      name: 'Anneau des Veilleurs',
      description: 'Un anneau ancien et très léger. Tant qu’il est coché : +1 Dextérité. Peut actionner un mécanisme des Veilleurs.'
    },
    {
      id: 'bague_lueur',
      name: 'Bague de lumière',
      description: 'Bague trouvée sous la machine d’injection : +2 Dextérité tant qu’elle est possédée.'
    },
    {
      id: 'lames_jet',
      name: 'Lames de jet',
      description: 'En mode test, les cocher en donne 5.',
      special: 'throwingBlades'
    },
    {
      id: 'ceinture_rouge',
      name: 'Ceinture de corde rouge',
      description: 'Une ceinture des Veilleurs : +1 Force lors des tests pour grimper, retenir ou se suspendre.'
    },
    {
      id: 'casque_cabosse',
      name: 'Casque cabossé',
      description: 'Un casque de fer ancien. Donne 2 points de Protection qui encaissent les dégâts avant la Vie.',
      protection: 2
    },
    {
      id: 'gantelet_veilleur',
      name: 'Gantelet de Veilleur',
      description: 'Un gant d’armure articulé. Donne 1 point de Protection qui encaisse les dégâts avant la Vie.',
      protection: 1
    },
    {
      id: 'collier_vitalite',
      name: 'Collier de vitalité',
      description: 'Objet maudit : +3 PV à la pose, −1 Dextérité, arrachement douloureux.',
      special: 'collar'
    },
    {
      id: 'ampoule_blanche_test',
      name: 'Ampoule blanche — test',
      description: 'Ampoule fictive, indépendante des trois lieux du récit. Terre noire : −4 points, ne soigne pas les blessures.'
      },
    {
      id: 'bouclier_chevalier',
      name: 'Bouclier du chevalier',
      description: 'Protection : 6 points. Dextérité : −1 tant que le bouclier protège, le malus disparaît quand il est brisé.',
      protection: 6
    }
  ];

  function testItemOwned(state, entry) {
    if (entry.special === 'throwingBlades') return (state.throwingBlades || 0) > 0;
    if (entry.special === 'collar') return !!state.flags.collarEquipped;
    return hasItem(state, entry.id);
  }

  function setTestItem(state, entry, enabled) {
    if (entry.special === 'collar') { if (enabled) equipVeilleurCollar(state); return; }
    if (entry.special === 'throwingBlades') {
      state.throwingBlades = enabled ? Math.max(5, state.throwingBlades || 0) : 0;
      syncThrowingBlades(state);
      return;
    }
    if (entry.protection) {
      if (enabled) addProtectiveItem(state, entry.id, entry.name, entry.description, entry.protection);
      else removeProtectiveItem(state, entry.id);
      return;
    }
    if (enabled) addItem(state, entry.id, entry.name, entry.description);
    else removeItem(state, entry.id);
  }

  function testInventoryHtml(state) {
    const itemRows = TEST_ITEM_CATALOG.map(entry => {
      const checked = testItemOwned(state, entry);
      const quantity = entry.special === 'throwingBlades' && checked ? ` × ${state.throwingBlades}` : '';
      return `
        <label class="test-item-row">
          <input type="checkbox" data-action="test-toggle-item:${entry.id}" ${checked ? 'checked' : ''}>
          <span class="test-item-box" aria-hidden="true"></span>
          <span class="test-item-copy"><strong>${entry.name}${quantity}</strong><small>${entry.description}</small></span>
        </label>`;
    }).join('');

    const weaponOptions = [
      ['none', 'Aucune'],
      ['heavy', 'Grosse épée · DEX −4 · Puissance 5'],
      ['light', 'Petite épée · DEX −1 · Puissance 2'],
      ['sorcerer_sword', 'Épée rouge · DEX −1 · Puissance 8']
    ].map(([value, label]) => `
      <label class="test-weapon-option">
        <input type="radio" name="testWeapon" data-action="test-equip-weapon:${value}" ${state.weapon === value ? 'checked' : ''}>
        <span>${label}</span>
      </label>`).join('');

    return `
      <div class="test-inventory-panel">
        <div class="test-inventory-title">Mode test · objets disponibles</div>
        <p class="test-inventory-note">Coche ou décoche un objet pour simuler sa présence. L’ampoule de test ne bloque aucune des trois ampoules à récupérer dans le récit.</p>
        <div class="test-item-list">${itemRows}</div>
        <div class="test-weapon-panel">
          <strong>Arme équipée</strong>
          <div class="test-weapon-list">${weaponOptions}</div>
        </div>
      </div>`;
  }

  const inventory = {
    topLine(state) {
      return `Argent : ${state.silver} · Or : ${state.goldCoins} · Arme : ${weaponLabel(state)}`;
    },

    extraHtml(state) {
      const weaponDex = state.weapon === 'heavy' ? '−4' : ['light','sorcerer_sword'].includes(state.weapon) ? '−1' : '0';
      const equipment = `
        <div class="inventory-equipment-card">
          <div class="inventory-equipment-title">Équipement actuel</div>
          <div class="inventory-equipment-row"><span>Arme équipée</span><strong>${weaponLabel(state)}</strong></div>
          <div class="inventory-equipment-row"><span>Effet de l’arme</span><strong>DEX ${weaponDex} · Puissance ${state.weapon === 'none' ? 0 : combatPower(state)}</strong></div>
          <div class="inventory-equipment-row"><span>Protection restante</span><strong>${currentProtection(state)} / ${maxProtection(state)}</strong></div>
          ${shieldIsActive(state) ? '<div class="inventory-equipment-row"><span>Bouclier du chevalier</span><strong>Dextérité −1</strong></div>' : ''}
        </div>`;
      const healing = Number.isInteger(state.lastHealingDie)
        ? `<div class="dice-result"><p class="roll-number">Dernière potion</p><div class="dice-faces">${renderDie(state.lastHealingDie)}</div><p><strong>+${state.lastHealingDie} point${state.lastHealingDie > 1 ? 's' : ''} de Vie</strong></p><p>Vie : <strong>${state.hp} / ${state.maxHp}</strong></p></div>`
        : '';
      const testPanel = ''; // Version Joueurs : commandes d'inventaire TEST non affichées.
      const earth = contaminationLevel(state)>0 ? `<div class="inventory-equipment-card"><strong>Terre noire : ${contaminationLevel(state)}/13</strong><p>${state.flags.physicianNotesRead ? "0–3 : appel puissant · 4–8 : équilibre précaire · 9–12 : transformation imminente · 13 : transformation." : "Effets inconnus."}</p></div>` : "";
      return equipment + earth + testPanel + healing;
    },

    actionHtml(id, item, state) {
      if (id === 'parchemin') {
        return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="read-parchment">Relire les notes</button></div>`;
      }
      if (id === 'potion_guerison') {
        return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-potion" ${state.hp >= state.maxHp ? 'disabled' : ''}>Boire la potion (1 dé de Vie)</button></div>`;
      }
      if (['potion_corniche','potion_femme'].includes(id)) return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-labyrinth-heal:${id}" ${state.hp>=state.maxHp?'disabled':''}>Boire la potion (1 dé de Vie)</button></div>`;
      if (id === 'epee_sorciere') return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="equip-sorcerer-sword">Équiper : puissance 8 · DEX −1</button></div>`;
      if (id === 'ampoule_femme') return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-labyrinth-white" ${contaminationLevel(state)>0?'':'disabled'}>Utiliser : −4 terre noire</button></div>`;
      if (id === 'ampoule_blanche_test') return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-white-ampoule-test" ${contaminationLevel(state)>0?'':'disabled'}>Utiliser : −4 points de contamination (test)</button></div>`;
      if (id === 'terre_femme') return `<div class="inventory-actions"><p>Après absorption : ${Math.min(13,contaminationLevel(state)+3)}/13.</p><button class="inventory-action-btn" data-action="use-labyrinth-earth">Absorber la dose</button></div>`;
      if (id === 'lame_noire') {
        return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="equip-black-blade">Équiper la lame noire</button></div>`;
      }
      if (id === 'fiole_rouge') {
        if (!state.flags.physicianNotesRead) return '<p>Il te faut encore découvrir à quoi sert ce liquide blanc.</p>';
        return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-aldren-white" ${contaminationLevel(state)>0?'':'disabled'}>Utiliser : −4 terre noire</button></div>`;
      }
      if (id === 'potion_sombre') {
        if (!state.flags.physicianNotesRead) return '<p>Composition inconnue. Tu ignores encore les conséquences de son utilisation.</p>';
        return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-dark-potion" ${state.hp>=state.maxHp ? 'disabled' : ''}>Boire : +3 Vie, +2 terre noire${contaminationLevel(state)+2>=13 ? " — TRANSFORMATION" : ""}</button></div>`;
      }
      if (id === 'sacoche_terre_noire') return `<div class="inventory-actions"><p>Usage unique : +3 terre noire. Après absorption : ${Math.min(13, contaminationLevel(state)+3)}/13.</p><button class="inventory-action-btn" data-action="use-black-earth">Absorber la terre noire</button></div>`;
      if (id === 'ampoule_blanche_cache') return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-white-ampoule-cache" ${contaminationLevel(state)>0?'':'disabled'}>Utiliser : −4 points de contamination (Terre noire)</button></div>`;
      if (id === 'ampoule_blanche_commune') return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-white-ampoule-common" ${contaminationLevel(state)>0 ? '' : 'disabled'}>Utiliser : −4 points de contamination (Terre noire)</button></div>`;
      if (id === 'ampoule_blanche') {
        const useful = contaminationLevel(state) > 0;
        return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-white-ampoule" ${useful ? '' : 'disabled'}>Utiliser : −4 points de contamination (Terre noire)</button></div>`;
      }
      if (id === 'collier_vitalite') {
        return state.flags.collarEquipped
          ? `<div class="inventory-actions"><strong>Incrusté dans la peau · +3 Vie max. · −1 Dextérité.</strong><p>Le retirer enlève 3 PV supplémentaires et provoque 1 blessure. Il sera inutilisable.</p><button class="inventory-action-btn" data-action="collar-tear-ask">Tenter de l’arracher</button></div>`
          : '<div class="inventory-protection-state">Arraché — inutilisable.</div>';
      }
      if (id === 'sceau_silence') {
        return '<p>Ancien objet V60, usage unique : peut interrompre un instant l’appel devant la grille.</p>';
      }
      if (PROTECTION_ITEMS[id]) {
        ensureProtectionState(state);
        const source = state.protectionItems[id] || { remaining: 0, max: PROTECTION_ITEMS[id].max };
        const broken = source.remaining <= 0;
        return `<div class="inventory-protection-state">Protection restante : <strong>${source.remaining} / ${source.max}</strong>${id === 'bouclier_chevalier' ? (broken ? '<br>Malus de Dextérité annulé.' : '<br>Dextérité : −1 tant que le bouclier protège.') : ''}${broken ? '<br><strong>État : endommagé — désormais inutilisable.</strong>' : ''}</div>`;
      }
      return '';
    },

    handleAction(action, state, api) {
      if (action.startsWith('test-toggle-item:')) {
        const id = action.slice('test-toggle-item:'.length);
        const entry = TEST_ITEM_CATALOG.find(item => item.id === id);
        if (entry) {
          setTestItem(state, entry, !testItemOwned(state, entry));
          updateVialKnowledge(state);
          api.saveState();
          api.render();
          api.openInventory();
        }
        return true;
      }

      if (action.startsWith('test-equip-weapon:')) {
        const weapon = action.slice('test-equip-weapon:'.length);
        if (['none', 'heavy', 'light', 'sorcerer_sword'].includes(weapon)) {
          state.weapon = weapon;
          api.saveState();
          api.render();
          api.openInventory();
        }
        return true;
      }

      if (action === 'read-parchment') {
        api.showModal('Notes d’Aldren', `
          <img class="inventory-parchment-image" src="${api.book.assetBase}/objets/La-Grotte-de-Valombre-Parchemin.png" alt="Notes d’Aldren" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div class="inventory-image-fallback">Ton image apparaîtra ici dès que tu ajouteras :<br><strong>books/ecuyer/01-la-grotte-de-valombre/images/objets/La-Grotte-de-Valombre-Parchemin.png</strong></div>
          <div class="parchment-verse"><strong>IL FAUT OUVRIR L’ŒIL FERMÉ</strong><br><br><em>La lame noire. Trouver la lame noire.</em><br><br><s>La terre noire…</s><br><small>Ces mots sont barrés trois fois. Dans la marge, Aldren a ajouté : « ÉVITER ».</small><br><br><strong>SOUFRE !!! ☠</strong><br><small>Le mot est entouré trois fois de traits nerveux. Une tête de mort est dessinée à côté.</small></div>
          <button class="inventory-action-btn" data-action="back-inventory">Retour à l’inventaire</button>`);
        return true;
      }

      if (action === 'collar-tear-ask') {
        if (!state.flags.collarEquipped) { api.openInventory(); return true; }
        api.showModal('Arracher le collier ?', `<p>Le métal s'est fondu dans ta peau. L'arracher ôtera les 3 points de Vie qu'il t'a apportés, puis te coûtera 1 point supplémentaire.</p><p><strong>Vie actuelle : ${state.hp}/${state.maxHp} · Vie après : ${Math.max(0, state.hp-4)}/${state.maxHp-3}.</strong></p>${state.hp <= 4 ? '<p><strong>Attention : cette action te tuera.</strong></p>' : ''}<p>Tu récupéreras le point de Dextérité perdu à cause du collier. Ce choix est irréversible.</p><div class="inventory-actions"><button class="inventory-action-btn" data-action="collar-tear-confirm">Confirmer : arracher le collier</button><button class="inventory-action-btn" data-action="back-inventory">Renoncer</button></div>`);
        return true;
      }
      if (action === 'collar-tear-confirm') {
        if (!state.flags.collarEquipped) { api.openInventory(); return true; }
        state.flags.collarEquipped = false;
        state.flags.collarTorn = true;
        state.maxHp -= 3;
        state.hp = Math.max(0, Math.min(state.maxHp, state.hp - 4));
        if (hasItem(state, 'collier_vitalite')) {
          state.inventory.collier_vitalite.description = 'Arraché — inutilisable. Le métal s’est fendu et a laissé une blessure au cou.';
        }
        api.saveState(); api.render();
        if (state.hp <= 0) api.showModal('Le collier t’a tué', '<p>En arrachant le collier, tu as perdu tes dernières forces. Referme cette fenêtre pour reprendre au checkpoint ou recommencer.</p>');
        else api.showModal('Le collier est arraché', '<p>Tu arraches le métal. La blessure te coûte 1 point de Vie, en plus des 3 points qui disparaissent avec son pouvoir. Tes mouvements redeviennent plus précis. La terre noire passée sous ta peau, elle, demeure.</p><button class="inventory-action-btn" data-action="back-inventory">Retour à l’inventaire</button>');
        return true;
      }

      if (action.startsWith('use-labyrinth-heal:')) {
        const id = action.slice('use-labyrinth-heal:'.length);
        if (['potion_corniche','potion_femme'].includes(id) && labyrinthHeal(state,id)) {api.saveState();api.render();}
        api.openInventory();return true;
      }
      if (action === 'equip-sorcerer-sword') {
        if (hasItem(state,'epee_sorciere')) {state.weapon='sorcerer_sword';api.saveState();api.render();}
        api.openInventory();return true;
      }
      if (action === 'use-labyrinth-white') {
        if(labyrinthUseWhite(state)){api.saveState();api.render();}
        api.openInventory();return true;
      }
      if (action === 'use-labyrinth-earth') {
        if(hasItem(state,'terre_femme')) {
          api.showModal('Absorber la terre noire ?', `<p>Ta contamination passerait de ${contaminationLevel(state)} à ${Math.min(13,contaminationLevel(state)+3)}/13. ${contaminationLevel(state)+3>=13?'À 13, la transformation met fin à la partie.':'Cette décision peut modifier la voix et les pièges.'}</p><button class="inventory-action-btn" data-action="confirm-labyrinth-earth">Confirmer</button><button class="inventory-action-btn" data-action="back-inventory">Renoncer</button>`);return true;
        }api.openInventory();return true;
      }
      if(action==='confirm-labyrinth-earth') {
        if(labyrinthUseEarth(state)){api.saveState();api.render();}
        api.openInventory();return true;
      }
      if (action === 'use-potion') {
        if (!hasItem(state, 'potion_guerison') || state.hp >= state.maxHp) {
          api.openInventory();
          return true;
        }
        const healing = cryptoDie6();
        state.lastHealingDie = healing;
        state.hp = Math.min(state.maxHp, state.hp + healing);
        removeItem(state, 'potion_guerison');
        api.saveState();
        api.render();
        api.openInventory();
        return true;
      }

      if (action === 'equip-black-blade') {
        state.weapon = 'black_blade';
        api.saveState();
        api.render();
        api.openInventory();
        return true;
      }

      if (action === 'use-aldren-white') {
        if (state.flags.physicianNotesRead && useWhiteAmpouleForContamination(state,'fiole_rouge')) {
          api.saveState(); api.render();
        }
        api.openInventory(); return true;
      }
      if (action === 'use-dark-potion') {
        if (state.flags.physicianNotesRead && hasItem(state, 'potion_sombre') && state.hp < state.maxHp) { state.hp=Math.min(state.maxHp,state.hp+3); removeItem(state,'potion_sombre'); raiseContamination(state,2); api.saveState(); api.render(); }
        api.openInventory(); return true;
      }
      if (action === 'use-black-earth') {
        if (hasItem(state,'sacoche_terre_noire')) {
          if (!state.flags.blackEarthUseConfirmed) { state.flags.blackEarthUseConfirmed=true; api.showModal('Absorber la terre noire ?', `<p>Ton niveau passerait de ${contaminationLevel(state)} à ${Math.min(13,contaminationLevel(state)+3)}/13. ${contaminationLevel(state)+3>=13 ? 'Tu te transformerais immédiatement : fin de partie.' : 'Cette décision est irréversible sans traitement.'}</p><button class="inventory-action-btn" data-action="confirm-black-earth">Confirmer</button>`); return true; }
          removeItem(state,'sacoche_terre_noire'); raiseContamination(state,3); state.flags.blackEarthUseConfirmed=false; api.saveState(); api.render();
        } api.openInventory(); return true;
      }
      if (action === 'confirm-black-earth') {
        if (hasItem(state,'sacoche_terre_noire') && state.flags.blackEarthUseConfirmed) { removeItem(state,'sacoche_terre_noire'); raiseContamination(state,3); state.flags.blackEarthUseConfirmed=false; api.saveState(); api.render(); } return true;
      }
      if (action === 'use-white-ampoule-cache') {
        if (useWhiteAmpouleForContamination(state,'ampoule_blanche_cache')) {api.saveState();api.render();} api.openInventory();return true;
      }
      if (action === 'use-white-ampoule-common') {
        if (useWhiteAmpouleForContamination(state,'ampoule_blanche_commune')) {api.saveState();api.render();} api.openInventory();return true;
      }
      if (action === 'use-white-ampoule-test') {
        if (useWhiteAmpouleForContamination(state,'ampoule_blanche_test')) {api.saveState();api.render();} api.openInventory();return true;
      }
      if (action === 'use-white-ampoule') {
        if (!hasItem(state, 'ampoule_blanche') || !(contaminationLevel(state) > 0)) {
          api.openInventory();
          return true;
        }
        blackEarthTreatment(state);
        api.saveState();
        api.render();
        api.openInventory();
        return true;
      }

      return false;
    }
  };

  function characterSheetHtml(state) {
    const force = currentForce(state);
    const dexterity = currentDexterity(state);
    const weaponPower = state.weapon === 'none' ? 0 : combatPower(state);
    const damage = forceDamageBonus(force) + weaponPower;
    const armor = [];
    ensureProtectionState(state);
    if (hasItem(state, 'casque_cabosse')) {
      const remaining = state.protectionItems.casque_cabosse?.remaining || 0;
      armor.push(`Casque cabossé — ${remaining}/2${remaining <= 0 ? ' · endommagé' : ''}`);
    }
    if (hasItem(state, 'gantelet_veilleur')) {
      const remaining = state.protectionItems.gantelet_veilleur?.remaining || 0;
      armor.push(`Gantelet de Veilleur — ${remaining}/1${remaining <= 0 ? ' · endommagé' : ''}`);
    }
    if (hasItem(state, 'bouclier_chevalier')) {
      const remaining = state.protectionItems.bouclier_chevalier?.remaining || 0;
      armor.push(`Bouclier du chevalier — ${remaining}/6${remaining <= 0 ? ' · brisé, sans malus' : ' · Dextérité −1'}`);
    }
    return `
      <div class="character-modal-sheet">
        <div class="character-modal-portrait">
          <img src="./books/ecuyer/01-la-grotte-de-valombre/images/${heroPortraitFilename(state)}" alt="Portrait de ${heroName(state)}" onerror="this.parentElement.style.display='none'">
        </div>
        <div class="character-modal-name">${heroName(state)}</div>
        <div class="character-modal-rank">${heroRank(state)}</div>
        <div class="character-modal-stats">
          <div><span>♥ Vie</span><strong>${state.hp} / ${state.maxHp}</strong></div>
          <div><span>🛡 Protection</span><strong>${currentProtection(state)} / ${maxProtection(state)}</strong></div>
          <div><span>Force</span><strong>${force}</strong></div>
          <div><span>Dextérité</span><strong>${dexterity}</strong></div>
          ${contaminationLevel(state)>0 ? `<div><span>Terre noire</span><strong>${contaminationLevel(state)} / 13 · ${state.flags.physicianNotesRead ? "Voir les notes du médecin" : "Effets inconnus"}</strong></div>` : ""}
          <div><span>Puissance de l’arme</span><strong>${weaponPower}</strong></div>
        </div>
        <div class="character-modal-equipment">
          <p><strong>Arme :</strong> ${weaponLabel(state)}</p>
          <p><strong>Dégâts si tu remportes un échange :</strong> ${damage}</p>
          <p><strong>Protection portée :</strong> ${armor.length ? armor.join(' · ') : 'Aucune'}</p>
        </div>
      </div>`;
  }

  BookRegistry.register({
    id: 'ecuyer-01',
    seriesId: 'ecuyer',
    seriesLabel: 'ÉCUYER 01',
    episode: 1,
    orderInSeries: 1,
    slug: 'la-grotte-de-valombre',
    title: 'La Grotte de Valombre',
    description: 'Première aventure de la série de l’Écuyer.',
    access: 'free',
    contentVersion: 72,
    pageMapVersion: 77,
    saveVersion: 18,
    saveScope: 'joueurs', // Sauvegardes séparées du dépôt Travail sur un même domaine.
    assetBase: './books/ecuyer/01-la-grotte-de-valombre/images',
    showMissingIllustrationPlaceholder: false, // Joueurs : masquer les images indisponibles
    demoEndNode: 'c104',
    story: STORY,
    pageOrder: PAGE_ORDER,
    pageByNode: PAGE_BY_NODE,
    navigationTitles: PAGE_NAV_TITLES,
    padPage,
    imageBaseForPage: n => `La-Grotte-de-Valombre-${padPage(n)}`,
    // Règle V68.1 : une page n'affiche QUE le fichier portant son propre numéro.
    // Les anciens numéros de scènes et le suffixe historique -V63 sont exclus.
    imageCandidatesForPage: n => {
      const filename = `La-Grotte-de-Valombre-${padPage(n)}`;
      return n <= 47
        ? [filename, `pages/${filename}`]
        : [`pages/${filename}`, filename];
    },
    imageExtensions: ['webp', 'png', 'jpg', 'jpeg'],
    createInitialState,
    migrateState: migrateVialKnowledgeV77,
    rules: { currentForce, currentDexterity, combatPower, weaponLabel, currentProtection, maxProtection, applyDamage, raiseContamination },
    characterSheetHtml,
    inventory,
    checkpoints: [
      { node: 'c20', label: 'Entrée de la grotte', onlyIfNone: true }
    ],
    legacyStorageKeys: [], // Ne pas importer une ancienne sauvegarde Travail.
    legacyCheckpointKeys: [],
    exportSeriesMemory(state) {
      // Les décisions durables seront explicitement ajoutées ici lorsqu’elles
      // seront validées comme conséquences inter-livres. Rien n’est exporté
      // automatiquement afin d’éviter de figer trop tôt l’arbre narratif.
      return {};
    }
  });
})();
