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
  }
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
    if (resolution.hpLost > 0 && !combat.contaminated) { raiseContamination(state, 1); combat.contaminated = true; }
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
  const before = combat.hp;
  combat.hp = Math.max(0, combat.hp - 2);
  combat.last = null;
  combat.lastBlade = { damage: Math.min(2, before), enemyHp: combat.hp };
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
      <div class="combat-outcome"><strong>La lame atteint sa cible.</strong><br>Tu infliges directement <strong>${combat.lastBlade.damage}</strong> point${combat.lastBlade.damage > 1 ? 's' : ''} de dégâts.</div>
      <div class="combat-life-line">Lames restantes : <strong>${state.throwingBlades || 0}</strong> · Vie adverse : <strong>${combat.hp} / ${enemy.maxHp}</strong></div>
    </div>`;
}

const BLADE_RESULT_PAGES = { observationPrisonerCorridor:'c150', shadowMass:'c122', rochebrumeMissing:'c123', isletCrawler:'c124', bridgeWalker:'c125', observationPrisoner:'c126' };
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
      label: `Lancer une lame de jet — ${qty} restante${qty > 1 ? 's' : ''} (2 dégâts)`,
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
            ? ` Ta protection a absorbé <strong>${r.protectionAbsorbed}</strong>${r.hpLost > 0 ? ` ; tu as perdu <strong>${r.hpLost}</strong> point${r.hpLost > 1 ? 's' : ''} de Vie.` : ' ; tu n’as perdu aucun point de Vie.'}`
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
  // L'injection est une modification indépendante des anciennes blessures.
  if (state.flags.labInjected) state.flags.labInjected = false;
  if ((state.dexPenalty || 0) > 0) state.dexPenalty -= 1;
  state.contamination = Math.max(0, contaminationLevel(state) - 4);
  state.flags.blackEarthContamination = state.contamination > 0;
  state.flags.usedWhiteAmpoule = true;
}
function injectBlackEarth(state) {
  if (state.flags.labInjected) return;
  state.flags.labInjected = true;
  raiseContamination(state, 2);
}
// V68 : la contamination module ce qui est entendu, jamais un jet de résistance.
// Une décision du joueur n'est pas forcée par ce niveau.
function dormantPerception(state, location) {
  const earth = contaminationLevel(state);
  if (location === 'avenue') {
    if (earth <= 4) return `<p>Brutalement, un murmure te parvient. Tu ne sais pas s’il vient du fond de l’avenue ou s’il résonne directement dans ta tête.</p>
      <blockquote>« Libère-moi…<br>Les esprits… ceux qui errent dans la vallée… je pourrai les apaiser…<br>Celui que tu cherches… je peux te conduire… jusqu’à lui… »</blockquote>
      <p>Le murmure s’éteint.</p>`;
    if (earth <= 8) return `<p>Un murmure surgit sans que tu puisses en situer l’origine.</p>
      <blockquote>« Libère… les esprits… apaiser… celui que tu cherches… »</blockquote>
      <p>Sur une borne, l’œil fermé est accompagné d’une mise en garde : « NE PAS OUVRIR LA PRISON. » Le murmure s’interrompt.</p>`;
    return `<p>Aucune voix ne t'accompagne. Sur les bornes de pierre, les Veilleurs ont gravé l'œil fermé et cette mise en garde : « NE PAS OUVRIR LA PRISON. »</p>`;
  }
  if (location === 'service') {
    if (earth <= 4) return `<p>La présence revient tandis que tu progresses sous les étais.</p>
      <blockquote>« Ils avaient peur de moi. Ils m'ont laissé seul ici. Laisse-moi sortir. »</blockquote>
      <p>Une flèche gravée par les Veilleurs indique pourtant une autre direction : le passage de service.</p>`;
    if (earth <= 8) return `<p>Tu perçois une phrase incomplète : « Ils m'ont laissé… » Puis le silence revient. Sur la paroi, une inscription des Veilleurs avertit : « SA PAROLE N'EST PAS UN ORDRE. »</p>`;
    return `<p>Sur la paroi, une inscription des Veilleurs avertit : « SA PAROLE N'EST PAS UN ORDRE. » Le couloir demeure silencieux.</p>`;
  }
  return '';
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
  const heroDice = roll2D6();
  const heroScore = currentDexterity(state) + heroDice[0] + heroDice[1];
  const report = [];
  let originalTargetDamage = 0;
  if (blade) {
    state.throwingBlades -= 1;
    syncThrowingBlades(state);
    originalTargetDamage = Math.min(2, f.hp[target]);
    f.hp[target] -= originalTargetDamage;
    report.push(`Ta lame touche la sentinelle ${target+1} : ${originalTargetDamage} dégâts.`);
  } else {
    const enemyDice = roll2D6();
    const enemyScore = SENTINELS.dexterity + enemyDice[0] + enemyDice[1];
    if (heroScore > enemyScore) {
      originalTargetDamage = Math.min(f.hp[target], forceDamageBonus(currentForce(state)) + (state.weapon === 'none' ? 0 : combatPower(state)));
      f.hp[target] -= originalTargetDamage;
      report.push(`Tu touches la sentinelle ${target+1} : ${originalTargetDamage} dégâts.`);
    } else if (heroScore < enemyScore) {
      const result = applyDamage(state, 1);
      if (result.hpLost > 0 && !f.contaminated) { raiseContamination(state, 1); f.contaminated = true; }
      report.push(`La sentinelle ${target+1} te touche : ${result.absorbed} absorbé, ${result.hpLost} Vie perdue.`);
    } else report.push(`Tu pares la sentinelle ${target+1} : égalité, aucun dégât.`);
  }
  // Chaque autre sentinelle encore vivante attaque indépendamment. Une lame
  // lancée laisse aussi la sentinelle visée attaquer si elle a survécu.
  for (let i = 0; i < 2; i++) {
    if (f.hp[i] <= 0 || (!blade && i === target) || state.hp <= 0) continue;
    const enemyDice = roll2D6();
    const enemyScore = SENTINELS.dexterity + enemyDice[0] + enemyDice[1];
    if (enemyScore > heroScore) {
      const result = applyDamage(state, 1);
      if (result.hpLost > 0 && !f.contaminated) { raiseContamination(state, 1); f.contaminated = true; }
      report.push(`La sentinelle ${i+1} t'attaque : ${result.absorbed} absorbé, ${result.hpLost} Vie perdue.`);
    } else report.push(`Tu évites l'attaque de la sentinelle ${i+1}.`);
  }
  f.round++;
  f.last = { heroDice, heroScore, report, target, blade, hp: [...f.hp], heroHp: state.hp };
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
  return `<div class="combat-roll-result"><div class="combat-roll-title">Échange n° ${f.round}</div><p>Ton jet : ${f.last.heroDice.join(' + ')} · Attaque : ${f.last.heroScore}</p>${f.last.report.map(r=>`<p>${r}</p>`).join('')}<p><strong>Ta Vie : ${state.hp}/${state.maxHp}. Terre noire : ${contaminationLevel(state)}/13.</strong></p></div>`;
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

// Une visite de chaque branche suffit : une fois revenue au croisement,
// elle ne doit plus être proposée, y compris sur une ancienne sauvegarde.
function campGalleryAvailable(state) {
  return !state.flags.galleryVisited && !state.flags.galleryAttempted &&
    !state.visited.c31 && !state.visited.c32;
}
function campTunnelAvailable(state) {
  return !state.flags.tunnelVisited && !state.visited.c34 &&
    !state.visited.c35 && !state.visited.c36 && !state.visited.c38;
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
          ${contaminationLevel(state)>0 ? `<div class="hero-stat"><strong>Terre noire</strong><span>${contaminationLevel(state)}/13 · ${state.flags.physicianNotesRead ? contaminationLevel(state)>=9 ? "Danger" : contaminationLevel(state)>=5 ? "Équilibre précaire" : "Appel puissant" : "Effets inconnus"}</span></div>` : ""}
          <div class="hero-stat hero-stat-wide"><strong>Puissance de l’arme</strong><span>${state.weapon === 'none' ? 0 : combatPower(state)}</span></div>
        </div>

        <div class="hero-characteristics">
          <div class="hero-info-title">Tes caractéristiques</div>
          <p><strong>Vie :</strong> indique la santé du personnage. Lorsqu’elle atteint zéro, c’est la fin de votre aventure.</p>
          <p><strong>Protection :</strong> provient de certaines pièces d’équipement. Elle absorbe les dégâts avant la Vie et diminue lorsqu’elle encaisse un choc.</p>
          <p><strong>Force :</strong> représente sa puissance physique. Elle contribue aux dégâts infligés et permet de forcer, retenir ou briser ce qui barre la route.</p>
          ${state.flags.physicianNotesRead ? "<p><strong>Terre noire :</strong> 0–4 : appel puissant ; 5–8 : équilibre précaire ; 9–12 : transformation imminente ; 13 : transformation définitive.</p>" : ""}
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
    number: 'PAGE 000',
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
      <p>Tu ouvres la sacoche. À l’intérieur, tu trouves <strong>trois pièces d’argent</strong>, une petite <strong>fiole rouge sombre</strong> et un morceau de parchemin plié plusieurs fois.</p>
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
      <p>Tu replies soigneusement les notes et les ranges dans ton inventaire. Tu pourras les relire quand tu le souhaites.</p>
      ${hasItem(state,'fiole_rouge') || state.flags.fioleLaissee
        ? '<p>Tu as déjà décidé quoi faire de la mystérieuse fiole rouge.</p>'
        : '<p>La fiole rouge reste entre tes mains. Tu ignores encore ce qu’elle contient.</p>'}
    `,
    choices: state => {
      if (!hasItem(state,'fiole_rouge') && !state.flags.fioleLaissee) {
        return [
          { label: 'Prendre la fiole et aller au village', to: 'c118', effect: s => { addItem(s,'fiole_rouge','Fiole rouge','Une petite fiole au liquide rouge sombre. Son utilité est encore inconnue.'); } },
          { label: 'Prendre la fiole et partir vers les grottes', to: 'c119', effect: s => { addItem(s,'fiole_rouge','Fiole rouge','Une petite fiole au liquide rouge sombre. Son utilité est encore inconnue.'); } },
          { label: 'Laisser la fiole et aller au village', to: 'c3', effect: s => { s.flags.fioleLaissee = true; } },
          { label: 'Laisser la fiole et partir vers les grottes', to: 'c8', effect: s => { s.flags.fioleLaissee = true; } }
        ];
      }
      return [
        { label: 'Aller au village', to: 'c3' },
        { label: 'Partir vers les grottes', to: 'c8' }
      ];
    }
  },

  c3: {
    number: 'PAGE 3',
    title: 'La place de Valombre',
    image: 'La place de Valombre',
    text: state => {
      const details = [];
      if (!state.flags.merchantVisited) {
        details.push('<p>Sous son auvent, le <strong>marchand</strong> termine de ranger ses affaires.</p>');
      }
      if (!state.flags.blacksmithVisited) {
        details.push('<p>Dans la forge, une lueur rouge éclaire encore les murs.</p>');
      }
      if (!state.flags.valombreStreetVisited) {
        details.push('<p>Plus loin, dans l’ombre d’une ruelle, une étrange silhouette semble parler toute seule.</p>');
      }
      return `
        <p>La place de Valombre est presque déserte. Les volets se ferment les uns après les autres.</p>
        ${details.join('')}
        <p>Tu peux encore prendre le temps de faire ce qui te semble utile — ou quitter le village.</p>
      `;
    },
    choices: state => {
      const list = [];
      if (!state.flags.merchantVisited) list.push({ label: 'Voir le marchand', to: 'c4' });
      if (!state.flags.blacksmithVisited) list.push({ label: 'Voir la forgeronne', to: 'c5' });
      if (!state.flags.valombreStreetVisited) list.push({ label: 'Approcher la personne dans la ruelle', to: 'c6' });
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
        <blockquote>« Sans argent, je ne peux rien faire pour toi, mon ami. Reviens quand tu auras de quoi payer. »</blockquote>
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
    text: state => `
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
      if (state.weapon === 'light') {
        return [
          { label: 'Remercier la forgeronne et retourner sur la place', to: 'c3' }
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
          'Fiole rouge sombre',
          'Une fiole trouvée sur Gaspard. Elle restaure 3 Vie mais ajoute 2 points de terre noire.'
        );
      }
    },
    text: `
      <p>Tu fouilles rapidement ses vêtements.</p>

      <p>Dans une bourse, tu trouves :</p>

      <p><strong>3 pièces d’or.</strong></p>

      <p>Puis ta main rencontre une petite bouteille dans la doublure de son manteau.</p>

      <p>Tu la retires.</p>

      <p>C’est une potion de guérison.</p>

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
      if (state.flags.strangerGone) {
        return `
          <p>La rue de Rochebrume est toujours aussi vide.</p>

          <p>Au croisement, là où se tenait l’étranger quelques instants plus tôt, il n’y a plus personne.</p>

          <p>Seulement la route vide.</p>
        `;
      }
      if (state.flags.eliasVisited) {
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
    choices: state => {
      const list = [];
      if (!state.flags.eliasVisited) {
        list.push({ label: 'Entrer dans la taverne de Gaspard', to: 'c16' });
      }
      if (!state.flags.strangerGone) {
        list.push({ label: 'Parler à la personne dans la rue', to: 'c19' });
      }
      if (state.flags.eliasVisited || state.flags.strangerGone) {
        list.push({ label: 'Quitter Rochebrume et repartir vers la grotte', to: 'c20' });
      }
      return list;
    }
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
    choices: state => {
      if (state.flags.gaspardDeathAnnounced) {
        const list = [];
        if (!state.flags.eliasBladesPurchased) {
          list.push({ label: 'Lui demander s’il a quelque chose qui pourrait t’aider pour la montagne', to: 'c18' });
        }
        if (!state.flags.strangerGone) {
          list.push({ label: 'Aller parler à la personne dans la rue', to: 'c19' });
        }
        list.push({ label: 'Quitter Rochebrume et repartir vers la grotte', to: 'c20' });
        return list;
      }
      if (state.flags.eliasBladesPurchased) {
        return [
          { label: 'Lui annoncer que Gaspard est mort', to: 'c17' },
          { label: 'Ne rien ajouter et retourner dans la rue', to: 'c15' },
          { label: 'Quitter Rochebrume et repartir vers la grotte', to: 'c20' }
        ];
      }
      return [
        { label: 'Lui annoncer que Gaspard est mort', to: 'c17' },
        { label: 'Ne rien lui dire', to: 'c18' }
      ];
    }
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
    choices: state => {
      const list = [];
      if (!state.flags.strangerGone) {
        list.push({ label: 'Aller parler à la personne dans la rue', to: 'c19' });
      }
      list.push({ label: 'Quitter Rochebrume et repartir vers la grotte', to: 'c20' });
      return list;
    }
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
    choices: state => {
      const list = [];
      if (!state.flags.eliasVisited) {
        list.push({ label: 'Entrer dans la taverne de Gaspard avant de repartir', to: 'c16' });
      }
      list.push({ label: 'Repartir vers la grotte', to: 'c20' });
      return list;
    }
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
          label: `Lancer une lame dans l’ombre — ${state.throwingBlades} restante${state.throwingBlades > 1 ? 's' : ''} (2 dégâts)`,
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
        <p>La petite lame disparaît dans l’ombre et frappe quelque chose avec un bruit mat.</p>
        <p>Le grondement ne cesse pas.</p>
        <p>La forme continue de venir vers toi.</p>
        <p>Tu sais seulement qu’elle est blessée.</p>
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
          ? '<p>La dernière lame disparaît dans la masse. Cette fois, son mouvement s’interrompt.</p>'
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
          <p>La petite lame disparaît presque entièrement dans la masse sombre.</p>
          <p>La chose ne cherche pas à l’arracher. Elle poursuit son mouvement vers toi comme si ce qui vient de la traverser ne méritait aucune réponse.</p>
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

      <p>Il se penche soudain et serre ton poignet.</p>

      <blockquote>« Et si tu entends Aldren… assure-toi d’abord que c’est bien lui. »</blockquote>

      <p>Puis son visage se fige.</p>

      <p>Il regarde derrière toi.</p>

      <blockquote>« Tu l’as amené avec toi. »</blockquote>

      <p>Tu te retournes.</p>

      <p>Il n’y a personne.</p>

      <p>Lorsque tu fais de nouveau face à Anselme, il marmonne déjà pour lui-même.</p>

      <p>La cavité se prolonge dans plusieurs directions. À quelques mètres du feu, tu distingues les restes d’un <strong>ancien campement</strong>. Sur la droite, une galerie est presque entièrement <strong>barrée par un énorme bloc de pierre</strong>. Plus loin, un <strong>tunnel étroit</strong> s’enfonce dans l’obscurité.</p>
    `,
    choices: state => {
      const list = [];
      if (!state.flags.campJournalRead && !state.visited.c30) {
        list.push({ label: 'Examiner le vieux campement', to: 'c30' });
      }
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

      <blockquote>Troisième jour. J’ai encore entendu ma femme cette nuit.</blockquote>

      <p>Plus loin :</p>

      <blockquote>Septième jour. Elle est morte depuis onze ans.</blockquote>

      <p>À partir de là, les dates disparaissent.</p>

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

      <p><strong>Ta Force : ${currentForce(state)}</strong></p>
    `,
    choices: state => state.flags.galleryAttempted ? [
      { label: 'Revenir au croisement des galeries', to: 'c30', effect: rememberCampJournalIfVisited }
    ] : [
      {
        label: 'Tenter de déplacer le bloc — lancer les trois dés',
        to: 'c32',
        effect: s => {
          s.flags.galleryAttempted = true;
          s.lastCombatOutcome = roll3D6(s, 'Force', currentForce(s))
            ? 'force_success'
            : 'force_fail';
        }
      },
      { label: 'Renoncer et revenir au croisement des galeries', to: 'c30', effect: rememberCampJournalIfVisited }
    ]
  },

  c32: {
    number: 'PAGE 32',
    title: '',
    noImage: true,
    image: 'La pierre',
    onEnter: s => {
      if (s.lastCombatOutcome === 'force_success' && !s.flags.brassardPris) {
        s.flags.brassardPris = true;
        addItem(
          s,
          'brassard_veilleurs',
          'Brassard des Veilleurs',
          'Un brassard sombre étonnamment léger une fois porté. +1 Force.'
        );
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

          <p>Lorsque tu le prends, il paraît incroyablement lourd.</p>

          <p>Une fois passé autour de ton bras, son poids disparaît presque totalement.</p>

          <p><strong>Brassard des Veilleurs : +1 Force.</strong></p>
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
          <p>La lame frappe la silhouette et reste un instant prise dans ce qui devrait être une épaule.</p>
          <p>Elle ne cherche pas à la retirer. Son mouvement vers toi reprend aussitôt.</p>
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
        { label: 'Accoster le petit îlot de pierre aperçu dans la brume', to: 'c47' },
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
          <p>La lame se plante dans une partie de sa forme que tu aurais été incapable de nommer.</p>
          <p>La chose se déforme autour de l’impact, puis reprend sa progression, sans fuite ni hésitation.</p>
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
        { label: 'Frapper la chose à travers les planches', to: 'c61' }
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
        : [{ label: 'Te défendre', to: 'c61' }];
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
          <p>La lame frappe ce que ton regard avait pris pour le haut de son corps.</p>
          <p>Un membre lâche une corde, puis en retrouve une autre sans que le mouvement général s’interrompe.</p>
          <p>Elle revient déjà vers toi.</p>
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
      if (!state.flags.bridgeSatchelSearched) {
        choices.push({ label: 'Fouiller la sacoche du mort', to: 'c65' });
      }
      if (!hasItem(state, 'ceinture_rouge')) {
        choices.push({
          label: 'Prendre la Ceinture de corde rouge',
          to: 'c131',
          effect: s => {
            addItem(
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
      <p>Tu ouvres la sacoche. À l’intérieur, trois lames de jet sont enveloppées dans un morceau de toile, à côté d’un parchemin plié.</p>

      <p>Un œil fermé est imprimé au bas du texte.</p>

      <blockquote>« Nouvel ordre reçu :<br>
      Garder le pont dans les deux sens.<br>
      Nul ne doit désormais quitter la cité.<br>
      Toute tentative de fuite sera punie de mort.<br>
      Tout garde refusant d’appliquer cet ordre subira la même peine. »</blockquote>

      <p>Tu ranges les trois lames de jet dans ton équipement.</p>

      <p><strong>Tu possèdes maintenant ${state.throwingBlades} lame${state.throwingBlades > 1 ? 's' : ''} de jet.</strong></p>
    `,
    choices: state => {
      if (hasItem(state, 'ceinture_rouge')) {
        return [{ label: 'Rejoindre la porte', to: 'c64' }];
      }
      return [
        {
          label: 'Prendre aussi la Ceinture de corde rouge',
          to: 'c131',
          effect: s => {
            addItem(
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

      <p>Tu avances sur les portions sèches de la rue. De petites enseignes de bois pourrissent au-dessus d’anciens ateliers ; les seuils sont usés par des années de passage.</p>

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

      <p>Les maisons sont bâties en terrasses le long de la pente. Un petit escalier mène d’une rue à l’autre ; des murets retiennent les jardins aujourd’hui desséchés.</p>
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
        ? `<p>Un peu plus loin, d’autres ouvertures rejoignent l’avenue. ${otherWays.join(' ; ')}.</p><p>Au sol, d’anciennes traces de passage convergent depuis chacune d’elles vers la place.</p>`
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
    noImage: true,
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
    text: state => `
      <p>Les anciennes salles d'habitation se déploient autour d'un petit vestibule. Une odeur de cendre froide flotte encore dans l'air. Des lampes à huile éteintes sont accrochées aux murs ; les passages restent dans la pénombre.</p>
      <p>À gauche, des tables sont visibles derrière une arche. À droite, une porte mène à un poste de garde encombré de registres.</p>
      <p>Au fond, un passage rejoint les pièces du commandement.</p>
      ${state.flags.quartersRefectory ? '<p>Tu as déjà parcouru le réfectoire.</p>' : ''}
      ${state.flags.quartersGuard ? '<p>Tu as déjà consulté les premières consignes de garde.</p>' : ''}
      <p>Aldren est quelque part plus bas. Tu peux aussi ne pas t’attarder.</p>`,
    choices: s => [
      ...(!s.flags.quartersRefectory ? [{ label: 'Explorer le réfectoire', to: 'c76' }] : []),
      ...(!s.flags.quartersGuard ? [{ label: 'Examiner la salle de garde', to: 'c77' }] : []),
      { label: 'Gagner les bureaux du commandement', to: 'c82' }
    ]
  },
  c76: {
    number: 'PAGE 76', title: 'Le réfectoire', image: 'Le réfectoire des Veilleurs',
    text: `
      <p>De longues tables occupent la salle. Des bols d'argile sont alignés près d'une cheminée éteinte. Des manteaux pendent à des crochets.</p>
      <p>Sur un mur, quelqu'un a dessiné des maisons, des champs et des familles réunies autour d'un foyer.</p>
      <p>Sous le dessin, une devise est gravée :</p>
      <blockquote>QUE NOTRE VEILLE PRÉSERVE CEUX QUI VIVENT AU-DESSUS.</blockquote>
      <p>Les Veilleurs mangeaient et dormaient ici. Ils avaient des proches à la surface, tout comme toi.</p>
      <p>Tu retournes vers les autres salles.</p>`,
    choices: [{ label: 'Revenir au vestibule', to: 'c75', effect: s => { s.flags.quartersRefectory = true; } }]
  },
  c77: {
    number: 'PAGE 77', title: 'Les consignes de garde', noImage: true, image: 'Le poste de garde',
    text: `
      <p>Un plan des galeries couvre le mur du poste. Sur un pupitre, les premiers registres parlent de rondes, de réserves et de surveillance des accès.</p>
      <p>Puis viennent des consignes concernant ceux qui entendent l'appel :</p>
      <blockquote>ÉVITER LA TERRE NOIRE. CONDUIRE LES PERSONNES ATTEINTES AUX SALLES DE SOINS.</blockquote>
      <p>Plus loin, une autre main ordonne d'isoler toute personne attirée vers la prison.</p>
      <p>D'autres manuscrits remplissent une étagère. Les lire te prendrait du temps. Aldren est encore introuvable.</p>`,
    choices: [
      { label: 'Rester et examiner les autres manuscrits', to: 'c78', effect: s => { s.flags.quartersGuard = true; s.flags.guardStayed = true; } },
      { label: 'Ne pas perdre de temps et rejoindre les bureaux', to: 'c82', effect: s => { s.flags.quartersGuard = true; } },
      { label: 'Revenir explorer les autres salles', to: 'c75', effect: s => { s.flags.quartersGuard = true; } }
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
    choices: [{ label: 'Dégainer et faire face', to: 'c79' }]
  },
  c79: {
    number: 'PAGE 79', title: 'Les deux sentinelles', image: 'Les sentinelles contaminées',
    text: s => `
      <p>Deux silhouettes entrent dans le poste de garde. Elles portent les restes d'un uniforme.</p>
      <p>Leurs traits demeurent presque humains. Une terre noire et épaisse coule de leurs bouches.</p>
      <p>L'une avance devant toi. L'autre contourne le pupitre.</p>
      <p>Tu dois affronter les deux. Tu ne peux en attaquer qu'une à la fois ; chacune peut te frapper tant qu'elle tient debout.</p>
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
    text: `
      <p>Des râteliers longent les murs. Les épées et les casques qu'ils supportent sont rongés par la rouille.</p>
      <p>Dans une boîte restée fermée, tu trouves cinq petites lames de jet encore en état de servir.</p>
      <p>Tu peux les emporter. Aucun autre équipement ne paraît sûr.</p>`,
    choices: s => s.flags.armoryLooted ? [{ label: 'Rejoindre les bureaux', to: 'c82' }] : [
      { label: 'Prendre les cinq lames de jet', to: 'c136', effect: s => { if (!s.flags.armoryLooted) { s.throwingBlades += 5; syncThrowingBlades(s); s.flags.armoryLooted = true; } } },
      { label: 'Laisser les lames et rejoindre les bureaux', to: 'c82', effect: s => { s.flags.armoryLooted = true; } }
    ]
  },
  c82: {
    number: 'PAGE 82', title: 'Le bureau fermé', noImage: true, image: 'La porte du commandement',
    text: `
      <p>Une porte renforcée ferme le bureau du commandement. Sa serrure ne répond plus. Au-delà, un passage permet de rejoindre les appartements sans y entrer.</p>
      <p>Des marques de coups autour du verrou montrent que quelqu'un a déjà essayé de forcer l'entrée.</p>
      <p>Tu peux tenter ta chance, ou poursuivre les recherches d'Aldren.</p>`,
    choices: s => s.flags.officeAttempted
      ? [{ label: 'Poursuivre vers les appartements', to: 'c84' }]
      : [
          { label: 'Tenter d’enfoncer la porte — épreuve de Force', to: 'c83', effect: s => { s.flags.officeAttempted = true; s.flags.officeOpened = roll3D6(s, 'Force', currentForce(s)); } },
          { label: 'Laisser la porte et gagner les appartements', to: 'c84' }
        ]
  },
  c83: {
    number: 'PAGE 83', title: 'Les ordres du commandement', noImage: true, image: 'Le bureau des ordres',
    text: s => s.flags.officeOpened || s.visited?.c83 && !s.flags.officeAttempted ? `
      ${s.flags.officeAttempted ? diceResultHtml(s) : ''}
      <p>La porte cède. Des tablettes et des registres sont restés ouverts sur un pupitre.</p>
      <p>Les premières instructions prévoient d'isoler les personnes contaminées et de chercher des soins. Les suivantes ont changé de ton :</p>
      <blockquote>AU PREMIER SOUPÇON, EXÉCUTER.</blockquote>
      <p>Plusieurs condamnations portent une seule justification : « Soupçon ».</p>
      <p>Dans la marge, une autre main a écrit : « Et si nous nous trompions ? » La phrase a été rayée jusqu'à creuser la pierre.</p>` : `
      ${diceResultHtml(s)}
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
      <p>Tu passes le collier autour de ton cou.</p>
      <p>Un regain de vitalité te traverse. Puis le métal se resserre. Ses bords s'enfoncent dans ta peau. La poussière noire accumulée au fermoir pénètre dans la blessure.</p>
      <p>Tu essaies de le soulever : il est incrusté dans la chair. L'arracher te blesserait gravement.</p>
      <p>Une raideur gagne tes épaules et tes mouvements perdent en précision.</p>
      <p><strong>Vie actuelle et maximale : +3. Dextérité : −1. Contamination : +1.</strong></p>
      <p>Le collier apparaît dans ton inventaire. Tu pourras tenter de l'arracher à tout moment, mais la blessure te coûtera encore un point de Vie en plus des trois points gagnés.</p>
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
      { label: 'Hésiter et lui demander de raconter son histoire', to: 'c94' },
      { label: 'Ne pas lui faire confiance et partir', to: 'c149', effect: t => { t.flags.knightFate = 'hostile'; } }
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
      { label: 'Entrer dans la cellule pour l’achever', to: 'c97' },
      { label: 'Ouvrir la porte et le libérer', to: 'c137', effect: s => { s.flags.knightFate = 'freed'; } },
      { label: 'Le laisser enfermé et poursuivre ton chemin', to: 'c144', effect: s => { s.flags.knightFate = 'locked'; } }
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
      if (fate === 'freed') return `<p>Tu t’éloignes de la cellule ouverte. Le chevalier est derrière toi ; ses remerciements se sont tus.</p><p>Tu rejoins la salle ronde par l’arche.</p>`;
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
    number: 'PAGE 100', title: 'Un carnet de suivi', image: 'Les carnets du dispensaire',
    text: `
      <p>Tu ouvres l’un des carnets. Sous le nom d’un homme venu chercher secours, une écriture régulière énumère les observations du médecin :</p>
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
    number: 'PAGE 101', title: 'Les derniers registres', image: 'Le registre des expériences',
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
    text: `
      <p>La pièce voisine est plus froide. Des tables à sangles entourent une cuve de terre noire. Derrière une cloison, un contrepoids heurte encore la pierre à intervalles réguliers.</p>
      <p>Sur l’une des sangles, une lanière a été tranchée net. Près de la table gît un morceau de tissu sombre, moins poussiéreux que le reste, de la couleur du surcot de Sir Aldren.</p>
      <p>Quelqu’un est donc passé ici avant toi — et s’est dégagé dans la hâte.</p>
      <p>D’un côté, le mécanisme d’injection reste prêt à fonctionner. De l’autre, une armoire de réserve a été forcée.</p>`,
    choices: [
      { label: 'Examiner le mécanisme', to: 'c103' },
      { label: 'Fouiller les réserves médicales', to: 'c138' }
    ]
  },
  c103: {
    number: 'PAGE 103', title: 'La terre sous la peau', image: 'L’injection',
    text: s => `
      <p>Le bruit vient d’un contrepoids suspendu à une chaîne. Le levier est resté à demi abaissé.</p>
      <p>Des schémas représentent un crâne traversé de lignes semblables à celles de la fresque de l’appel.</p>
      <blockquote>Le sujet peut à nouveau retenir ses gestes.</blockquote>
      <blockquote>L’emprise a repris au troisième jour.</blockquote>
      <p>Le réservoir contient encore de la terre noire. Ses conduits sont faits pour l’injecter.</p>
      ${s.flags.labLeverTried ? '<p>Le levier porte les marques de ta précédente tentative.</p>' : '<p>Le levier n’a pas encore été actionné depuis ton arrivée.</p>'}
      <p>Derrière le mécanisme, une étagère mène vers les réserves médicales.</p>`,
    choices: s => [
      ...(!s.flags.labLeverTried ? [{
        label: 'Actionner le levier avec prudence',
        to: 'c151',
        effect: t => {
          t.flags.labLeverTried = true;
          t.flags.injectionDodged = roll3D6(t, 'Dextérité', currentDexterity(t));
          t.flags.labLeverRollCount = t.rollCount;
          t.flags.labLeverResultReady = true;
          if (!t.flags.injectionDodged) injectBlackEarth(t);
        }
      }] : []),
      { label: 'Fouiller les réserves médicales', to: 'c138' },
      { label: 'Laisser la machine et quitter le laboratoire', to: 'c104' }
    ]
  },
  c104: {
    number: 'PAGE 104',
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
    `,
    choices: [{ label: 'Consulter les registres médicaux', to: 'c105' }]
  },

  c118: {
    number: 'PAGE 118', title: "La fiole emportée", noImage: true,
    text: `<p>Tu glisses la fiole rouge dans ta sacoche. Tu ignores encore ce qu’elle contient.</p><p>Tu rejoins la place du village.</p>`,
    choices: [{label: "Rejoindre la place", to: 'c3'}]
  },

  c119: {
    number: 'PAGE 119', title: "La fiole emportée", noImage: true,
    text: `<p>Tu protèges la fiole au fond de ta sacoche et quittes Valombre sans attendre.</p><p>Le sentier de la montagne t’attend.</p>`,
    choices: [{label: "Prendre le sentier de la grotte", to: 'c8'}]
  },

  c120: {
    number: 'PAGE 120', title: "La potion du marchand", noImage: true,
    text: `<p>Tu poses les trois pièces sur l’étal. Le marchand te remet la potion, que tu ranges soigneusement pour la suite du voyage.</p>`,
    choices: [{label: "Retourner sur la place", to: 'c3'}]
  },

  c121: {
    number: 'PAGE 121', title: "L’épée de la forgeronne", noImage: true,
    text: `<p>Tu rends l’épée lourde à la forgeronne et essaies quelques mouvements avec la lame plus courte. Ton bras retrouve de la liberté, même si l’arme frappera moins fort.</p><p>Tu la remercies et ressors sur la place.</p>`,
    choices: [{label: "Retourner sur la place", to: 'c3'}]
  },

  c122: {
    number: 'PAGE 122', title: "Une lame contre la masse", noImage: true,
    text: `<p>Tu lances une lame vers la masse. La pointe disparaît dans les plis de sa forme sombre.</p><p>Tu observes si ton tir l’a arrêtée.</p>`,
    choices: [{label: "Voir le résultat du tir", to: 'c27'}]
  },

  c123: {
    number: 'PAGE 123', title: "Une lame contre le disparu", noImage: true,
    text: `<p>Ta lame file vers le disparu de Rochebrume. Tu guettes l’effet du projectile.</p>`,
    choices: [{label: "Voir le résultat du tir", to: 'c38'}]
  },

  c124: {
    number: 'PAGE 124', title: "Une lame sur l’îlot", noImage: true,
    text: `<p>Tu lances une lame vers la créature de l’îlot. Elle heurte son corps déformé. Tu attends de voir si elle poursuivra sa marche.</p>`,
    choices: [{label: "Voir le résultat du tir", to: 'c47'}]
  },

  c125: {
    number: 'PAGE 125', title: "Une lame au-dessus du vide", noImage: true,
    text: `<p>Tu projettes une lame contre le marcheur qui grimpe sous le pont. La créature se replie autour d’une corde. Tu dois voir si elle tient encore.</p>`,
    choices: [{label: "Voir le résultat du tir", to: 'c62'}]
  },

  c126: {
    number: 'PAGE 126', title: "Une lame dans le couloir", noImage: true,
    text: `<p>Tu projettes une lame vers le chevalier transformé. Elle le frappe dans l’étroitesse de la cellule.</p>`,
    choices: [{label: "Voir le résultat du tir", to: 'c97'}]
  },

  c127: {
    number: 'PAGE 127', title: "L’anneau récupéré", noImage: true,
    text: `<p>Tu soulèves l’anneau de la dalle. Il semble presque ne rien peser. Le symbole de l’œil fermé apparaît sur sa tranche.</p><p>Tu regagnes la barque.</p>`,
    choices: [{label: "Reprendre la barque", to: 'c48'}]
  },

  c128: {
    number: 'PAGE 128', title: "Le gantelet du Veilleur", noImage: true,
    text: `<p>Tu détaches doucement le gantelet de la main du squelette. Les plaques sont encore solides ; tu l’ajustes à ton bras avant de franchir la porte du quartier haut.</p>`,
    choices: [{label: "Franchir la porte", to: 'c67'}]
  },

  c130: {
    number: 'PAGE 130', title: "La lame de diversion", noImage: true,
    text: `<p>Tu projettes une lame au-delà du pont. Elle fend la brume et disparaît sous les planches.</p>
      <p>La lame de jet tinte contre une pierre très loin sous le pont.</p>
      <p>La chose lâche aussitôt la face inférieure du pont et disparaît dans la brume à sa poursuite.</p>
      <p>Tu peux poursuivre ta traversée sans l’affronter.</p>`,
    choices: [{label: "Achever la traversée", to: 'c63'}]
  },

  c131: {
    number: 'PAGE 131', title: "La corde du Veilleur", noImage: true,
    text: `<p>Tu défais la ceinture de corde rouge du corps desséché. Le tressage est intact. Tu la ranges à portée de main.</p>`,
    choices: state => state.flags.bridgeSatchelSearched
      ? [{ label: 'Gagner la porte', to: 'c64' }]
      : [
          { label: 'Fouiller aussi la sacoche', to: 'c65' },
          { label: 'Gagner la porte', to: 'c64' }
        ]
  },

  c136: {
    number: 'PAGE 136', title: "Les lames récupérées", noImage: true,
    text: `<p>Tu enveloppes les cinq lames dans un morceau de tissu et les glisses dans ton équipement. Tu repars vers les bureaux.</p>`,
    choices: [{label: "Rejoindre les bureaux", to: 'c82'}]
  },

  c137: {
    number: 'PAGE 137', title: '', noImage: true,
    text: `<p>Tu soulèves le loquet. Le chevalier tire son corps vers l’ouverture et se retient au montant.</p>
      <blockquote>« Merci… Je savais que vous ne me laisseriez pas ici. »</blockquote>
      <p>Tu t’écartes et reprends le couloir vers l’arche.</p>`,
    choices: [{ label: 'T’éloigner de la cellule', to: 'c147' }]
  },
  c138: {
    number: 'PAGE 138', title: 'Le remède du laboratoire', noImage: true,
    text: s => `<p>L’armoire a été fouillée dans la hâte. Des tiroirs pendent de travers, et le loquet porte une marque de lame.</p>
      ${hasItem(s, 'ampoule_blanche') || s.flags.labAmpouleTaken
        ? '<p>L’emplacement de l’unique ampoule intacte est vide : tu l’as déjà emportée.</p>'
        : '<p>Une seule ampoule blanche est restée intacte. Son liquide a été mis au point pour réduire la contamination, sans soigner les blessures.</p>'}`,
    choices: s => [
      ...(!hasItem(s, 'ampoule_blanche') && !s.flags.labAmpouleTaken && !s.visited?.c138Taken
        ? [{ label: 'Prendre l’Ampoule blanche', stay: true, effect: t => {
            addItem(t, 'ampoule_blanche', 'Ampoule blanche', 'Terre noire : −4 points de contamination (minimum 0). Ne soigne pas les blessures.');
            t.flags.labAmpouleTaken = true;
          } }]
        : []),
      { label: 'Revenir dans la salle des injections', to: 'c102' },
      { label: 'Quitter le laboratoire', to: 'c104' }
    ]
  },

  c144: {
    number: 'PAGE 144', title: '', noImage: true,
    text: `<p>« Attendez… Je vous en prie ! »</p><p>Tu t’éloignes sans toucher à la porte. Le chevalier frappe une fois contre le bois ; puis ses appels deviennent indistincts.</p><p>Tu retrouves l’arche au bout du couloir.</p>`,
    choices: [{ label: 'Quitter le quartier d’observation', to: 'c98' }]
  },
  c145: {
    number: 'PAGE 145', title: '', image: 'Le bouclier du chevalier',
    text: s => hasItem(s, 'bouclier_chevalier')
      ? `<p>Tu passes l’avant-bras dans les sangles du petit bouclier. Il est désormais dans ton équipement.</p>`
      : `<p>Contre le pied de la table repose un petit bouclier de métal cabossé. Ses sangles tiennent encore.</p>
         <p>Il pourrait absorber plusieurs coups, mais son poids ralentira tes mouvements.</p>`,
    choices: s => hasItem(s, 'bouclier_chevalier')
      ? [{ label: 'Quitter la cellule', to: 'c98' }]
      : [
        { label: 'Prendre le bouclier (Protection +6, Dextérité −1)', stay: true, effect: addKnightShield },
        { label: 'Laisser le bouclier et partir', to: 'c98' }
      ]
  },
  // Conservée uniquement pour reprendre les anciennes sauvegardes déjà situées page 146.
  // Aucun choix de la nouvelle version ne conduit ici.
  c146: {
    number: 'PAGE 146', title: '', noImage: true,
    text: `<p>Tu passes l’avant-bras dans les sangles du bouclier et regagnes le couloir. Son poids ralentit légèrement tes gestes, mais il pourra te protéger des prochains coups.</p>`,
    choices: [{ label: 'Rejoindre la salle ronde', to: 'c98' }]
  },
  c147: {
    number: 'PAGE 147', title: '', noImage: true,
    onEnter: s => {
      if (s.flags.knightFate !== 'freed' || s.flags.knightBackstabDone) return;
      s.flags.knightBackstabDone = true;
      const before = s.hp;
      s.hp = Math.max(0, s.hp - 2);
      s.flags.knightBackstabLife = before - s.hp;
      raiseContamination(s, 2);
      s.flags.knightFate = s.hp <= 0 ? 'freed' : 'dead';
    },
    text: s => `<p>Un choc te frappe entre les épaules. Le chevalier s’est jeté sur toi. Ses membres transformés se contractent autour de tes jambes ; de la terre noire pénètre dans une entaille sous ton armure.</p>
      <p><strong>−${s.flags.knightBackstabLife ?? 2} Vie. Terre noire : +2.</strong></p>
      ${s.hp <= 0 ? '<p>Tu t’effondres avant de pouvoir lui échapper.</p>' : '<p>Tu te dégages, tires ton épée et lui tranches la tête d’un coup. Son corps s’affaisse et ne bouge plus.</p><p>Tu te relèves et gagnes l’arche.</p>'}`,
    choices: s => s.hp <= 0 ? fatalChoices() : [{ label: 'Quitter le quartier', to: 'c98' }]
  },
  c149: {
    number: 'PAGE 149', title: '', image: 'Le chevalier enragé',
    onEnter: s => { if (!s.flags.knightFate) s.flags.knightFate = 'hostile'; },
    text: s => {
      const enemy = ENEMIES.observationPrisonerCorridor;
      const combat = combatState(s, 'observationPrisonerCorridor', enemy);
      const card = enemyCardHtml(s, 'observationPrisonerCorridor', enemy);
      const result = combat.lastBlade ? throwingBladeResultHtml(s, 'observationPrisonerCorridor', enemy) : combatRoundHtml(s, 'observationPrisonerCorridor', enemy);
      if (combat.hp <= 0) return `${card}${result}<p>Le chevalier s’écroule au milieu du couloir. Derrière lui, la porte de sa cellule est éventrée. Un petit bouclier est resté près de la table.</p>`;
      if (s.hp <= 0) return `${card}${result}<p>Le chevalier t’abat dans le couloir avant que tu puisses rejoindre l’arche.</p>`;
      if (!combat.last && !combat.lastBlade) return `<p>Tu recules sans répondre et te détournes de la cellule.</p><blockquote>« Non ! Revenez ! »</blockquote><p>Un cri se change en rugissement. Derrière la porte, des os craquent. La masse qui lui tient lieu de jambes se gonfle et heurte le bois. Les gonds cèdent ; la porte s’abat dans le couloir.</p><p>Le chevalier se propulse vers toi. Tu dégaines juste à temps.</p>${card}`;
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
    number: 'PAGE 150', title: '', noImage: true,
    text: `<p>Tu projettes une lame vers le chevalier transformé. La lame le frappe dans le couloir, au milieu des débris de la porte.</p>`,
    choices: [{ label: 'Voir le résultat du tir', to: 'c149' }]
  },
  c151: {
    number: 'PAGE 151', title: '', noImage: true,
    text: s => !s.flags.labLeverResultReady || !Number.isInteger(s.flags.labLeverRollCount) ||
      s.flags.labLeverRollCount !== s.rollCount
      ? '<p>Aucun résultat du levier n’est disponible ici. Le mécanisme se trouve dans la salle voisine.</p>'
      : `${diceResultHtml(s)}
        ${s.flags.injectionDodged
          ? '<p>Tu actionnes le levier avec prudence, puis te jettes sur le côté. L’aiguille frappe la table et le mécanisme se bloque. Le contrepoids cesse enfin de heurter la cloison.</p>'
          : '<p>À peine le levier bouge-t-il que l’aiguille se détend et s’enfonce dans ton bras. Une brûlure remonte jusqu’à l’épaule.</p><p>Tu te dégages et recules. Tes muscles se contractent : une force nouvelle les parcourt. Pendant quelques secondes, tu ne sais plus où tu es. Tes gestes perdent en précision.</p><p><strong>+2 Force, −1 Dextérité. Terre noire : contamination accrue.</strong> Ces effets durent tant que l’injection n’a pas été traitée.</p>'}`,
    choices: [
      { label: 'Revenir examiner le mécanisme', to: 'c103' },
      { label: 'Fouiller les réserves médicales', to: 'c138' },
      { label: 'Quitter le laboratoire', to: 'c104' }
    ]
  },
  c129: {
    number: 'PAGE 129', title: 'Avancer sans bruit', noImage: true,
    text: s => `${diceResultHtml(s)}${s.flags.bridgeCalmPassed
      ? '<p>Tu te forces à avancer sans accélérer. La chose accompagne tes pas sous les planches, puis finit par s’immobiliser. Tu atteins les dernières planches avant qu’elle ne remonte.</p>'
      : '<p>Tu avances en retenant ton souffle, mais une planche gémit sous ta botte. La chose s’immobilise sous toi, puis ses longs doigts se referment sur le bord du pont. Elle te barre la route.</p>'}`,
    choices: s => s.flags.bridgeCalmPassed
      ? [{ label: 'Achever la traversée', to: 'c63' }]
      : [{ label: 'Faire face au marcheur', to: 'c61', effect: t => { t.flags.bridgeSolution = 'fight'; } }]
  },

  c132: {
    number: 'PAGE 132', title: 'La première sentinelle', noImage: true,
    onEnter: s => { s.flags.sentinelResultAcknowledged = true; },
    text: s => `<p>Tu affrontes la première sentinelle, l’épée levée.</p>${sentinelCardsHtml(s)}${sentinelResultHtml(s)}`,
    choices: s => sentinelResultChoices(s)
  },
  c133: {
    number: 'PAGE 133', title: 'Le tir sur la première sentinelle', noImage: true,
    onEnter: s => { s.flags.sentinelResultAcknowledged = true; },
    text: s => `<p>Tu vises la première sentinelle et lances ta lame.</p>${sentinelCardsHtml(s)}${sentinelResultHtml(s)}`,
    choices: s => sentinelResultChoices(s)
  },
  c134: {
    number: 'PAGE 134', title: 'La seconde sentinelle', noImage: true,
    onEnter: s => { s.flags.sentinelResultAcknowledged = true; },
    text: s => `<p>Tu te tournes vers la seconde sentinelle et frappes.</p>${sentinelCardsHtml(s)}${sentinelResultHtml(s)}`,
    choices: s => sentinelResultChoices(s)
  },
  c135: {
    number: 'PAGE 135', title: 'Le tir sur la seconde sentinelle', noImage: true,
    onEnter: s => { s.flags.sentinelResultAcknowledged = true; },
    text: s => `<p>Tu vises la seconde sentinelle et lances ta lame.</p>${sentinelCardsHtml(s)}${sentinelResultHtml(s)}`,
    choices: s => sentinelResultChoices(s)
  },

};

  // Libellés complets de l’outil de navigation TEST.
  // Les titres narratifs de STORY restent volontairement masqués sur certaines pages.
  // The player edition contains only pages published through 104, plus necessary side effects.
  const PAGE_NAV_TITLES = {};

  const PUBLISHED_MAIN_PAGE_COUNT = 104;
  const PUBLISHED_SIDE_PAGES = [...Array.from({ length: 21 }, (_, i) => `c${i + 118}`), 'c144', 'c145', 'c146', 'c147', 'c149', 'c150', 'c151'];
  const PAGE_ORDER = ['c0', ...Array.from({ length: PUBLISHED_MAIN_PAGE_COUNT }, (_, i) => `c${i + 1}`), ...PUBLISHED_SIDE_PAGES];
  const PAGE_BY_NODE = Object.fromEntries(PAGE_ORDER.map(id => [id, Number(id.slice(1))]));
  const padPage = n => String(n).padStart(3, '0');

  function equipHeavySword(state) {
    if (state.weapon === 'none') state.weapon = 'heavy';
  }

  function currentForce(state) {
    const itemBonus = hasItem(state, 'brassard_veilleurs') ? 1 : 0;
    return Math.max(3, state.baseForce + (state.forceBonus || 0) + (state.flags.labInjected ? 2 : 0) + itemBonus);
  }

  function currentDexterity(state) {
    const weaponModifier =
      state.weapon === 'heavy' ? -4 :
      state.weapon === 'light' ? -1 : 0;
    const itemBonus = hasItem(state, 'anneau_veilleurs') ? 1 : 0;
    const shieldPenalty = shieldIsActive(state) ? 1 : 0;
    return Math.max(3,
      state.baseDexterity +
      (state.dexBonus || 0) +
      itemBonus -
      (state.dexPenalty || 0) -
      (state.flags.labInjected ? 1 : 0) -
      (state.flags.collarEquipped ? 1 : 0) -
      shieldPenalty +
      weaponModifier
    );
  }

  function combatPower(state) {
    if (state.weapon === 'heavy') return 5;
    if (state.weapon === 'light') return 2;
    if (state.weapon === 'black_blade') return 6;
    return 0;
  }

  function weaponLabel(state) {
    if (state.weapon === 'heavy') return 'Épée lourde de Sir Aldren';
    if (state.weapon === 'light') return 'Épée de la forgeronne';
    if (state.weapon === 'black_blade') return 'Lame noire';
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
      pageMapVersion: 72,
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
  const inventory = {
    topLine(state) {
      return `Argent : ${state.silver} · Or : ${state.goldCoins} · Arme : ${weaponLabel(state)}`;
    },

    extraHtml(state) {
      const weaponDex = state.weapon === 'heavy' ? '−4' : state.weapon === 'light' ? '−1' : '0';
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
      const testPanel = '';
      const earth = contaminationLevel(state)>0 ? `<div class="inventory-equipment-card"><strong>Terre noire : ${contaminationLevel(state)}/13</strong><p>${state.flags.physicianNotesRead ? "0–4 : appel puissant · 5–8 : équilibre précaire · 9–12 : transformation imminente · 13 : transformation." : "Effets inconnus."}</p></div>` : "";
      return equipment + earth + testPanel + healing;
    },

    actionHtml(id, item, state) {
      if (id === 'parchemin') {
        return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="read-parchment">Relire les notes</button></div>`;
      }
      if (id === 'potion_guerison') {
        return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-potion" ${state.hp >= state.maxHp ? 'disabled' : ''}>Boire la potion (1 dé de Vie)</button></div>`;
      }
      if (id === 'lame_noire') {
        return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="equip-black-blade">Équiper la lame noire</button></div>`;
      }
      if (id === 'potion_sombre') return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-dark-potion" ${state.hp>=state.maxHp ? 'disabled' : ''}>Boire : +3 Vie, +2 terre noire${contaminationLevel(state)+2>=13 ? " — TRANSFORMATION" : ""}</button></div>`;
      if (id === 'sacoche_terre_noire') return `<div class="inventory-actions"><p>Usage unique : +3 terre noire. Après absorption : ${Math.min(13, contaminationLevel(state)+3)}/13.</p><button class="inventory-action-btn" data-action="use-black-earth">Absorber la terre noire</button></div>`;
      if (id === 'ampoule_blanche_commune') return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-white-ampoule-common" ${contaminationLevel(state)>0 ? '' : 'disabled'}>Utiliser : −4 points de contamination (Terre noire)</button></div>`;
      if (id === 'ampoule_blanche') {
        const useful = ((state.dexPenalty || 0) > 0 || state.flags.labInjected || contaminationLevel(state) > 0);
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

      if (action === 'use-dark-potion') {
        if (hasItem(state, 'potion_sombre') && state.hp < state.maxHp) { state.hp=Math.min(state.maxHp,state.hp+3); removeItem(state,'potion_sombre'); raiseContamination(state,2); api.saveState(); api.render(); }
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
      if (action === 'use-white-ampoule-common') {
        if (hasItem(state,'ampoule_blanche_commune') && contaminationLevel(state)>0) {removeItem(state,'ampoule_blanche_commune');state.contamination=Math.max(0,contaminationLevel(state)-4);state.flags.blackEarthContamination=state.contamination>0;api.saveState();api.render();} api.openInventory();return true;
      }
      if (action === 'use-white-ampoule') {
        if (!hasItem(state, 'ampoule_blanche') || !((state.dexPenalty || 0) > 0 || state.flags.labInjected || contaminationLevel(state) > 0)) {
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
    id: 'ecuyer-01-player-test',
    seriesId: 'ecuyer-playtest',
    seriesLabel: 'ÉCUYER 01',
    episode: 1,
    orderInSeries: 1,
    slug: 'la-grotte-de-valombre',
    title: 'La Grotte de Valombre',
    description: 'Première aventure de la série de l’Écuyer.',
    access: 'free',
    contentVersion: 60,
    stablePlayerSaves: true,
    playerRelease: true,
    demoEndNode: 'c104',
    pageMapVersion: 72,
    saveVersion: 18,
    assetBase: './books/ecuyer/01-la-grotte-de-valombre/images',
    showMissingIllustrationPlaceholder: false, // pas de placeholder visible dans la version Joueurs
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
    migrateState: migratePageNumbersV72,
    rules: { currentForce, currentDexterity, combatPower, weaponLabel, currentProtection, maxProtection, applyDamage, raiseContamination },
    characterSheetHtml,
    inventory,
    checkpoints: [
      { node: 'c20', label: 'Entrée de la grotte', onlyIfNone: true }
    ],
    legacyStorageKeys: ['ldveh.book.ecuyer-01-player-test.save.v18'],
    legacyCheckpointKeys: ['ldveh.book.ecuyer-01-player-test.checkpoint.v18'],
    exportSeriesMemory(state) {
      // Les décisions durables seront explicitement ajoutées ici lorsqu’elles
      // seront validées comme conséquences inter-livres. Rien n’est exporté
      // automatiquement afin d’éviter de figer trop tôt l’arbre narratif.
      return {};
    }
  });
})();
