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

const PROTECTION_ITEMS = {
  casque_cabosse: { max: 2, name: 'Casque cabossé' },
  gantelet_veilleur: { max: 1, name: 'Gantelet de Veilleur' }
};

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
      to: pageId,
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
          <div class="hero-stat"><strong>Chance</strong><span>${state.chance}</span></div>
          <div class="hero-stat"><strong>Force</strong><span>${currentForce(state)}</span></div>
          <div class="hero-stat"><strong>Dextérité</strong><span>${currentDexterity(state)}</span></div>
          <div class="hero-stat hero-stat-wide"><strong>Puissance de l’arme</strong><span>${state.weapon === 'none' ? 0 : combatPower(state)}</span></div>
        </div>

        <div class="hero-characteristics">
          <div class="hero-info-title">Tes caractéristiques</div>
          <p><strong>Vie :</strong> indique la santé du personnage. Lorsqu’elle atteint zéro, c’est la fin de votre aventure.</p>
          <p><strong>Protection :</strong> provient de certaines pièces d’équipement. Elle absorbe les dégâts avant la Vie et diminue lorsqu’elle encaisse un choc.</p>
          <p><strong>Chance :</strong> permet de se sortir habilement d’un mauvais tour ou d’une situation qui semblait mal engagée.</p>
          <p><strong>Force :</strong> représente sa puissance physique. Elle contribue aux dégâts infligés et permet de forcer, retenir ou briser ce qui barre la route.</p>
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
      <p>Sir Aldren t’a ordonné de rester au village. Pourtant, il aurait déjà dû être revenu, et son cheval vient de rentrer seul.</p>
    `,
    choices: [{ label: 'Commencer l’aventure', to: 'c1', effect: s => setHeroIdentity(s, heroGender(s)) }]
  },
  c1: {
    number: 'PAGE 1',
    title: 'Les écuries de Valombre',
    image: 'Le cheval revenu seul',
    onEnter: s => equipHeavySword(s),
    text: state => `
      <p>Des sabots résonnent soudain sur les pavés de Valombre.</p>
      <p>Le cheval de <strong>Sir Aldren de Rochebrune</strong> apparaît au bout de la rue. Seul.</p>
      <p>De l’écume couvre son poitrail. Une longue entaille traverse la selle et du sang séché macule l’une des sacoches.</p>

      <p>Ton regard se pose alors sur l’ancienne épée de Sir Aldren, appuyée contre le mur de l’écurie.</p>
      <p>Tu l’as vu la manier des centaines de fois.</p>
      <p>Pourtant, lorsque tes doigts se referment sur sa poignée, tu ressens quelque chose d’étrange.</p>
      <p>Un mélange de <strong>crainte et de fierté</strong>.</p>
      <p>Jusqu’à aujourd’hui, cette arme appartenait à ton maître. La prendre donne soudain à son absence une réalité que tu aurais préféré repousser encore un peu.</p>
      <p>Tu soulèves la lame.</p>
      <p>Elle est lourde. Beaucoup plus lourde que les armes avec lesquelles Aldren t’a appris à combattre.</p>
      <p>Mais lorsque tu la tiens devant toi, tu sens également sa puissance.</p>
      <p>Ce n’est pas une arme faite pour être rapide.</p>
      <p>C’est une arme faite pour <strong>frapper fort</strong>.</p>
      <p>Tu la passes à ton côté.</p>
      <p>Si Sir Aldren est encore vivant quelque part dans cette montagne, tu comptes bien le retrouver.</p>
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
        <em>ne pas ouvrir l’œil</em><br><br>
        <s><strong>soufre</strong></s><br>
        <small>Le mot est barré plusieurs fois. Une petite tête de mort est dessinée à côté.</small><br><br>
        <em>lame noire</em><br><br>
        <em>derrière la paroi</em><br>
        <em>terre noire</em><br>
        <em>ne pas écouter</em><br>
        <em>surtout ne pas—</em>
      </div>

      <p>La dernière ligne s’interrompt dans une traînée d’encre. Tu relis la feuille sans mieux comprendre.</p>
      <p>Tu replies soigneusement les notes et les ranges dans ton inventaire. Tu pourras les relire quand tu le souhaites.</p>
      ${hasItem(state,'fiole_rouge') || state.flags.fioleLaissee
        ? '<p>Tu as déjà décidé quoi faire de la mystérieuse fiole rouge.</p>'
        : '<p>La fiole rouge reste entre tes mains. Tu ignores encore ce qu’elle contient.</p>'}
    `,
    choices: state => {
      if (!hasItem(state,'fiole_rouge') && !state.flags.fioleLaissee) {
        return [
          { label: 'Prendre la fiole et aller au village', to: 'c3', effect: s => { addItem(s,'fiole_rouge','Fiole rouge','Une petite fiole au liquide rouge sombre. Son utilité est encore inconnue.'); } },
          { label: 'Prendre la fiole et partir vers les grottes', to: 'c8', effect: s => { addItem(s,'fiole_rouge','Fiole rouge','Une petite fiole au liquide rouge sombre. Son utilité est encore inconnue.'); } },
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
            to: 'c3',
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

      <p><strong>Pour comparer les deux armes :</strong></p>
      <p><strong>Épée lourde de Sir Aldren</strong> — Puissance : <strong>5</strong> · Dextérité : <strong>9</strong>.</p>
      <p><strong>Épée de la forgeronne</strong> — Puissance : <strong>2</strong> · Dextérité : <strong>12</strong>.</p>
      <p>Choisis ci-dessous quelle arme tu souhaites emporter.</p>
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
          to: 'c3',
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
          'Potion de guérison sombre',
          'Une potion de guérison dont le liquide paraît presque noir. Quelque chose semble parfois flotter à l’intérieur.'
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
      const list = [
        { label: 'Examiner le vieux campement', to: 'c30' }
      ];

      if (!state.flags.galleryAttempted) {
        list.push({ label: 'Explorer la galerie bloquée par une pierre', to: 'c31' });
      }

      list.push(
        { label: 'Aller dans le tunnel voisin', to: 'c34' },
        { label: 'Quitter le camp et poursuivre la descente', to: 'c37' }
      );

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
    text: state => `
      <p>Tu laisses Anselme près du feu et t’approches de l’ancien campement.</p>

      <p>Il semble abandonné depuis bien plus longtemps. Une couverture moisie s’est presque soudée au sol. Une tasse de métal repose près d’un cercle de cendres froides.</p>

      <p>À côté de la couverture, un <strong>casque de fer cabossé</strong> a été abandonné au sol. Il est lourd et terni, mais aucune fente ne traverse le métal.</p>

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
      list.push({ label: 'Continuer vers les profondeurs', to: 'c37' });
      if (!state.flags.galleryAttempted) list.push({ label: 'Explorer la galerie bloquée', to: 'c31' });
      list.push({ label: 'Aller dans le tunnel voisin', to: 'c34' });
      return list;
    }
  },

  c31: {
    number: 'PAGE 31',
    title: 'La galerie condamnée',
    noImage: true,
    image: 'La galerie condamnée',
    text: state => `
      <p>Tu t’engages dans la galerie de droite.</p>

      <p>Elle ne va pas loin. Après une vingtaine de pas, un bloc de pierre énorme bouche presque entièrement le passage.</p>

      <p>Une fente sombre subsiste sur le côté. Elle est trop étroite pour ton corps, mais suffisamment large pour laisser passer un courant d’air froid.</p>

      <p>En examinant la pierre, tu remarques qu’elle repose dans une sorte de logement circulaire. Avec assez de force, il est peut-être possible de la faire pivoter une fois.</p>

      <p><strong>Ta Force : ${currentForce(state)}</strong></p>
    `,
    choices: [
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
      { label: 'Ne pas prendre le risque et poursuivre vers les profondeurs', to: 'c37' }
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
      { label: 'Poursuivre vers les profondeurs', to: 'c37' }
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
      { label: 'Reculer lentement et repartir', to: 'c37' }
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

      <blockquote>« Ils ont dit que ma fille m’appelait. »</blockquote>

      <p>Ses doigts se crispent contre la pierre.</p>

      <blockquote>« Je l’ai suivie jusque-là. »</blockquote>

      <p>Sa respiration devient irrégulière.</p>

      <blockquote>« Je n’ai pas de fille. »</blockquote>

      <p>Un rire étouffé lui échappe.</p>

      <p>Ou peut-être recommence-t-elle simplement à pleurer.</p>

      <p>Tu recules sans la quitter des yeux, puis reprends le tunnel en sens inverse.</p>

      <p>Lorsque tu retrouves la galerie principale, les sanglots continuent encore derrière toi.</p>
    `,
    choices: [
      { label: 'Poursuivre vers les profondeurs', to: 'c37' }
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
      if (combat.hp <= 0) return [{ label: 'Reprendre ton souffle et poursuivre', to: 'c37' }];
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

      <p>Tu ne pourras pas explorer les trois.</p>

      <p>Il faut choisir.</p>

    `,
    // Les choix sont automatiquement masqués par le lecteur tant que les
    // pages 41, 44 et 55 ne font pas partie de PAGE_ORDER. Ils apparaîtront
    // à la prochaine publication, sans modifier cette page ni la sauvegarde.
    choices: [
      { label: 'Descendre vers le lac noir', to: 'c41' },
      { label: 'Prendre l’escalier de pierre', to: 'c44' },
      { label: 'Longer la corniche vers le pont', to: 'c55' }
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

      <p>Alors un coup sec résonne.</p>

      <p><strong>TOC.</strong></p>

      <p>Tu lèves les yeux. Il t’a semblé venir de très haut, peut-être du pont aperçu depuis la rive.</p>

      <p>Un second coup répond, plus proche.</p>

      <p><strong>TOC.</strong></p>

      <p>Puis un troisième frappe directement sous la coque.</p>

      <p><strong>TOC.</strong></p>

      <p>Le même rythme exact que les trois notes entendues dans la forêt de Rochebrume.</p>
    `,
    choices: [
      { label: 'Te pencher et regarder sous l’eau', to: 'c42' },
      { label: 'Ne surtout pas regarder et recommencer à ramer', to: 'c45' }
    ]
  },

  c42: {
    number: 'PAGE 42',
    title: '',
    image: 'Un visage sous l’eau',
    onEnter: s => { s.flags.lookedIntoLake = true; },
    text: `
      <p>Tu poses les rames et te penches lentement au-dessus du bord.</p>

      <p>La surface est si sombre qu’elle ressemble davantage à une ouverture qu’à de l’eau.</p>

      <p>Puis des points lumineux apparaissent très loin sous toi.</p>

      <p>Des dizaines.</p>

      <p>Des centaines.</p>

      <p>Ils ressemblent à des étoiles dans un ciel nocturne.</p>

      <p>Mais elles sont sous le bateau.</p>

      <p>Et beaucoup trop loin.</p>

      <p>Tu te penches davantage.</p>

      <p>Un visage apparaît entre les lumières.</p>

      <p><strong>Sir Aldren.</strong></p>

      <p>Il flotte plusieurs mètres sous la surface, parfaitement immobile.</p>

      <p>Ses yeux s’ouvrent.</p>

      <p>Sa bouche prononce quelque chose.</p>

      <p>Tu n’entends rien.</p>

      <p>Puis le visage recule dans l’obscurité.</p>

      <p>Trop vite.</p>

      <p>Comme s’il n’avait jamais appartenu à un corps.</p>

      <p>Tu te redresses.</p>

      <p>Au même instant, la barque cesse de flotter normalement.</p>
    `,
    choices: [
      { label: 'Reprendre les rames', to: 'c45' }
    ]
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
    image: 'Quelque chose sous la coque',
    text: state => `
      <p>Tu reprends les rames.</p>

      <p>Tu essaies de ne plus regarder l’eau.</p>

      <p>Alors le lac change de forme.</p>

      <p>À une dizaine de mètres devant toi, la surface se soulève lentement.</p>

      <p>Pas une vague.</p>

      <p>Une bosse immense.</p>

      <p>Elle avance sous l’eau sans produire le moindre bruit.</p>

      <p>Elle passe sous la barque.</p>

      <p>Le bois monte de presque un mètre.</p>

      <p>Pendant une seconde, tu distingues sous tes pieds quelque chose de plus sombre encore que l’eau.</p>

      <p>Ton esprit cherche aussitôt une taille à lui donner.</p>

      <p>Plus large que la barque. Puis qu’une maison. Puis davantage encore.</p>

      <p>Mais aucune comparaison ne tient : la courbure aperçue sous l’eau ne semble jamais appartenir au même volume.</p>

      <p>Tu renonces à comprendre ce qui vient de passer sous toi.</p>

      <p>Puis la présence continue sa route.</p>

      <p>La barque retombe brutalement.</p>

      <p><strong>Ta Dextérité actuelle : ${currentDexterity(state)}</strong></p>
    `,
    choices: [{
      label: 'T’agripper et garder l’équilibre — lancer les trois dés de Dextérité',
      to: 'c46',
      effect: s => {
        const ok = roll3D6(s, 'Dextérité', currentDexterity(s));
        s.flags.lakeBalance = ok ? 'success' : 'fail';
        if (!ok) s.flags.lakeImpactDamage = applyDamage(s, 2);
      }
    }]
  },

  c46: {
    number: 'PAGE 46',
    title: '',
    image: 'Le lac se referme',
    text: state => {
      const r = diceResultHtml(state);
      if (state.flags.lakeBalance === 'success') {
        return r + `
          <p>Tu te jettes au fond de la barque et agrippes les deux bords.</p>

          <p>L’embarcation retombe dans un claquement violent.</p>

          <p>De l’eau noire passe par-dessus le plat-bord, mais tu conserves l’équilibre.</p>

          <p>La masse continue sa route sous la surface.</p>

          <p>Puis elle disparaît.</p>

          <p>En quelques secondes, le lac redevient parfaitement plat.</p>

          <p>Comme si rien n’avait jamais bougé.</p>
        `;
      }
      return r + `
        <p>Tu cherches un appui trop tard.</p>

        <p>La barque retombe et tu es projeté contre un banc de bois.</p>

        <p>La douleur te coupe le souffle.</p>

        ${damageAbsorptionHtml(state.flags.lakeImpactDamage)}

        <p>Lorsque tu parviens à te relever, la masse a déjà disparu.</p>

        <p>Le lac est redevenu parfaitement lisse.</p>

        <p>Cette immobilité te paraît désormais plus effrayante que le mouvement.</p>
      `;
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
          <p>L’îlot n’est guère plus grand qu’une chambre.</p>

          <p>Quatre piliers brisés entourent une dalle de pierre blanche.</p>

          <p>Au centre est gravé un œil fermé.</p>

          <p>Dans une petite cavité repose un anneau métallique couvert de dépôts gris.</p>

          <p>Tu fais un pas vers lui.</p>

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
            to: 'c48',
            effect: s => addItem(s, 'anneau_veilleurs', 'Anneau des Veilleurs', 'Un anneau ancien et très léger. +1 Dextérité.')
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

      <p>Tu n’entends plus aucun coup sous la coque.</p>

      <p>Tu aurais presque préféré.</p>

      <p>Enfin, une ligne de pierre apparaît dans la brume.</p>

      <p>La barque heurte une marche noyée.</p>

      <p>Tu descends dans quelques centimètres d’eau noire et tires l’embarcation derrière toi.</p>

      <p>Devant toi s’ouvre une série d’arches basses.</p>

      <p>Au-delà, tu aperçois des murs.</p>

      <p>Des angles droits.</p>

      <p>Des escaliers.</p>

      <p>Une architecture entière surgit de l’ombre.</p>

      <p>Pour la première fois depuis ton arrivée dans ce monde impossible, tu as devant toi quelque chose qui ressemble à une ville.</p>
    `,
    choices: [
      { label: 'Entrer par les arches noyées', to: 'c63' }
    ]
  },

  c49: {
    number: 'PAGE 49',
    title: '',
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
    image: 'Les bâtisseurs',
    text: `
      <p>L’escalier débouche sur une terrasse verticale taillée dans la falaise.</p>

      <p>Des fresques couvrent la paroi sur plusieurs dizaines de mètres.</p>

      <p>Tu distingues de minuscules silhouettes humaines disposées autour d’une forme immense.</p>

      <p>Au premier regard, tu crois assister à une cérémonie.</p>

      <p>Des fidèles autour de leur dieu.</p>

      <p>Puis tu remarques les outils.</p>

      <p>Les cordes.</p>

      <p>Les blocs de pierre.</p>

      <p>Les hommes ne sont pas agenouillés.</p>

      <p>Ils travaillent.</p>

      <p>Ils élèvent des murs autour de la forme.</p>

      <p>Ils ferment des passages.</p>

      <p>Ils construisent quelque chose d’énorme autour d’elle.</p>

      <p><strong>Une prison.</strong></p>

      <p>Au-dessus de chaque scène revient le même symbole.</p>

      <p>L’œil fermé.</p>

      <p>Pour la première fois, une idée simple s’impose à toi.</p>

      <p>Ce symbole n’est peut-être pas celui de ce qui dort sous la montagne.</p>

      <p>Il pourrait être celui de ceux qui ont essayé de l’empêcher de se réveiller.</p>
    `,
    choices: [
      { label: 'Examiner la fresque suivante', to: 'c51' }
    ]
  },

  c51: {
    number: 'PAGE 51',
    title: '',
    image: 'La petite lame noire',
    text: `
      <p>La fresque suivante est beaucoup plus petite.</p>

      <p>Un homme y est représenté de profil.</p>

      <p>Dans sa main : une lame courte, entièrement noire.</p>

      <p>Devant lui, plusieurs silhouettes humaines sont reliées à une masse immense par de minces traits gravés dans la pierre.</p>

      <p>L’homme approche la lame de l’un de ces traits.</p>

      <p>Sur l’image suivante, le trait est coupé.</p>

      <p>La silhouette humaine tombe à genoux.</p>

      <p>Mais elle est toujours humaine.</p>

      <p>Tu repenses aux mots griffonnés dans la sacoche d’Aldren.</p>

      <p>Parmi les notes d’Aldren, ces deux mots te reviennent : <em>lame noire</em>.</p>

      <p>Tu avais imaginé une arme capable de tuer.</p>

      <p>La fresque suggère autre chose.</p>

      <p>Quelque chose qui <strong>coupe un lien</strong>.</p>
    `,
    choices: [
      { label: 'Reprendre l’ascension', to: 'c52' }
    ]
  },

  c52: {
    number: 'PAGE 52',
    title: '',
    image: 'La silhouette au sommet',
    text: `
      <p>Tu quittes les fresques et retrouves ce qu’il reste de l’escalier.</p>

      <p>C’est alors que tu la vois.</p>

      <p>Très haut au-dessus de toi, une silhouette se tient sur une portion encore régulière de la montée.</p>

      <p>Immobile.</p>

      <p>Trop loin pour distinguer un visage.</p>

      <p>Tu continues à monter.</p>

      <p>La silhouette est toujours là.</p>

      <p>À exactement la même distance.</p>

      <p>Tu accélères.</p>

      <p>Elle ne se rapproche pas.</p>

      <p>Tu t’arrêtes.</p>

      <p>Tu lèves lentement une main.</p>

      <p>Très loin, la silhouette lève la sienne.</p>

      <p>Du même côté.</p>

      <p>Tu baisses le bras.</p>

      <p>Elle disparaît.</p>

      <p>Il n’y a aucun endroit où elle aurait pu se cacher.</p>

      <p>Quelques mètres plus loin, tu remarques une fissure verticale dans la paroi.</p>

      <p>Elle est juste assez large pour t’y glisser de profil.</p>

      <p>Un courant d’air tiède en sort.</p>

      <p>Et, très loin à l’intérieur, quelque chose gratte doucement la pierre.</p>
    `,
    choices: [
      { label: 'T’aventurer dans la fissure', to: 'c53', effect: s => { if (!s.flags.stairsCrackEntered) { s.flags.stairsCrackEntered = true; s.flags.stairsCrackDamage = applyDamage(s, 2); s.dexPenalty = (s.dexPenalty || 0) + 1; s.flags.blackEarthContamination = true; } } },
      { label: 'Ne pas t’y aventurer et poursuivre l’ascension', to: 'c54' }
    ]
  },

  c53: {
    number: 'PAGE 53',
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

      <p>Tu sais que tu t’en es sorti par toi-même.</p>

      <p>Pourtant, les derniers instants refusent déjà de reprendre une forme nette dans ta mémoire.</p>

      ${damageAbsorptionHtml(state.flags.stairsCrackDamage)}

      <p>De la terre noire est tassée sous tes ongles, jusque dans les chairs.</p>

      <p>Tu en as dans le coin des yeux et jusque sur les gencives. Lorsque tu tousses, tu en sens encore le goût humide au fond de ta gorge.</p>

      <p>Tu t’essuies du mieux que tu peux. Tu frottes tes doigts contre tes vêtements, puis contre la pierre.</p>

      <p>Il en reste toujours.</p>

      <p><strong>Tu perds 1 point de Dextérité.</strong></p>

      <p>Tu finis par cesser de frotter.</p>

      <p>Le silence qui suit t’apaise plus qu’il ne devrait.</p>
    `,
    choices: state => state.hp <= 0
      ? fatalChoices()
      : [{ label: 'Te relever et poursuivre', to: 'c54' }]
  },

  c54: {
    number: 'PAGE 54',
    title: 'Au-dessus de la cité',
    image: 'Au-dessus de la cité',
    text: state => `
      <p>Les dernières portions de l’ascension débouchent sur une plateforme stable.</p>

      <p>Le vide s’ouvre devant toi.</p>

      <p>Et, très loin en contrebas, tu vois enfin où mènent les constructions.</p>

      <p>Une cité entière occupe la vallée de pierre.</p>

      <p>Des rues droites disparaissent sous des arches. Des escaliers montent vers des murs sans porte. Des portes isolées se dressent au milieu de places vides.</p>

      <p>Certaines structures semblent continuer jusque sur les parois verticales.</p>

      <p>D’autres paraissent suspendues au plafond invisible.</p>

      <p>Un escalier plus récent, clairement taillé à taille humaine, descend vers une petite porte percée à la base d’une arche.</p>

      <p>Juste avant la porte repose le squelette d’un homme.</p>

      <p>Une de ses mains porte encore un <strong>gantelet</strong> articulé de métal sombre — le gant d’armure d’un chevalier ou d’un Veilleur.</p>

      <p>Les plaques sont fines, mais intactes.</p>

      ${hasItem(state, 'gantelet_veilleur') ? '<p>Tu as déjà ajouté le gantelet à ton équipement.</p>' : '<p>Il pourrait encore encaisser un coup à ta place.</p>'}
    `,
    choices: state => hasItem(state, 'gantelet_veilleur')
      ? [{ label: 'Franchir la porte et entrer dans les quartiers hauts', to: 'c64' }]
      : [
          {
            label: 'Prendre le Gantelet de Veilleur (+1 Protection)',
            to: 'c64',
            effect: s => addProtectiveItem(s, 'gantelet_veilleur', 'Gantelet de Veilleur', 'Un gant d’armure articulé trouvé au-dessus de la Cité morte. Il peut absorber 1 point de dégâts avant ta Vie.', 1)
          },
          { label: 'Le laisser et franchir la porte', to: 'c64' }
        ]
  },

  c55: {
    number: 'PAGE 55',
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

      <p>Le pont apparaît.</p>

      <p>Long. Étroit. Suspendu entre deux masses de pierre.</p>

      <p>Ses planches sont noires et ses cordes presque minérales.</p>

      <p>De l’autre côté, une porte se devine dans la falaise.</p>

      <p>Tu poses un pied sur la première planche.</p>

      <p>Elle tient.</p>

      <p>Tu commences la traversée.</p>
    `,
    choices: [
      { label: 'Avancer sur le pont', to: 'c56' }
    ]
  },

  c56: {
    number: 'PAGE 56',
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
        { label: 'Garder ton calme et continuer lentement', to: 'c60', effect: s => { s.flags.bridgeSolution = 'calm'; } }
      ];
      if (state.throwingBlades > 0) {
        list.push({
          label: 'Lancer une lame dans le vide pour l’attirer ailleurs',
          to: 'c60',
          effect: s => {
            s.throwingBlades -= 1;
            syncThrowingBlades(s);
            s.flags.bridgeSolution = 'blade';
          }
        });
      }
      list.push(
        {
          label: 'Courir jusqu’à l’autre côté — tester ta Dextérité',
          to: 'c57',
          effect: s => {
            const ok = roll3D6(s, 'Dextérité', currentDexterity(s));
            s.flags.bridgeRun = ok ? 'success' : 'fail';
            if (!ok) s.flags.bridgeRunDamage = applyDamage(s, 1);
          }
        },
        { label: 'Frapper la chose à travers les planches', to: 'c58' }
      );
      return list;
    }
  },

  c57: {
    number: 'PAGE 57',
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
        ? [{ label: 'Reprendre ton souffle', to: 'c60' }]
        : [{ label: 'Te défendre', to: 'c58' }];
    }
  },

  c58: {
    number: 'PAGE 58',
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

      <p>Tu reconnais immédiatement le rythme exact des trois notes entendues dans la forêt de Rochebrume.</p>

      <p>Le son descend très loin sous le pont.</p>

      <p>Quelques secondes plus tard, depuis les profondeurs où s’étend le lac noir, trois coups beaucoup plus faibles semblent lui répondre.</p>

      <p>Cette fois, il n’y a plus de place pour l’éviter.</p>

      ${enemyCardHtml(state, 'bridgeWalker', ENEMIES.bridgeWalker)}
    `,
    choices: state => combatActionChoices(state, 'bridgeWalker', ENEMIES.bridgeWalker, 'c59')
  },

  c59: {
    number: 'PAGE 59',
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
      if (combat.hp <= 0) return [{ label: 'Achever la traversée', to: 'c60' }];
      if (state.hp <= 0) return fatalChoices();
      return combatActionChoices(state, 'bridgeWalker', ENEMIES.bridgeWalker, 'c59', 'Continuer le combat');
    }
  },

  c60: {
    number: 'PAGE 60',
    title: 'L’autre extrémité du pont',
    image: 'L’autre extrémité du pont',
    text: state => {
      const intro = state.flags.bridgeSolution === 'blade'
        ? `<p>La lame de jet tinte contre une pierre très loin sous le pont.</p><p>La chose lâche aussitôt la face inférieure du pont et disparaît dans la brume à sa poursuite.</p>`
        : state.flags.bridgeSolution === 'calm'
          ? `<p>Tu continues à avancer sans accélérer.</p><p>La chose reste sous toi jusqu’aux dernières planches, puis s’arrête exactement à la limite de la roche.</p><p>Elle ne franchit pas le bord.</p>`
          : '';
      return `
        ${intro}

        <p>Tu atteins enfin l’autre extrémité du pont.</p>

        <p>Près d’un ancien point d’ancrage, un squelette est assis contre la pierre.</p>

        <p>Il porte encore autour de la taille une étrange ceinture faite de corde rouge tressée.</p>

        <p>Elle ressemble aux fragments aperçus sur les pitons de la corniche.</p>

        <p>Le nœud est intact malgré l’âge.</p>

        <p>Sur une petite plaque de cuivre est gravé l’œil fermé.</p>
      `;
    },
    choices: state => hasItem(state, 'ceinture_rouge')
      ? [{ label: 'Continuer vers la porte', to: 'c61' }]
      : [
          {
            label: 'Prendre la Ceinture de corde rouge',
            to: 'c61',
            effect: s => {
              addItem(
                s,
                'ceinture_rouge',
                'Ceinture de corde rouge',
                'Une ceinture des Veilleurs. Elle accorde +1 Force lors des tests pour grimper, retenir ou se suspendre.'
              );
            }
          },
          { label: 'La laisser', to: 'c61' }
        ]
  },

  c61: {
    number: 'PAGE 61',
    title: 'La porte suspendue',
    image: 'La porte suspendue',
    text: `
      <p>La porte creusée dans la falaise est beaucoup plus petite que les structures alentour.</p>

      <p>Elle a manifestement été ajoutée plus tard.</p>

      <p>À l’intérieur, un couloir descend en spirale.</p>

      <p>De longues ouvertures donnent parfois sur le vide.</p>

      <p>À travers elles, tu aperçois peu à peu des toits qui ne sont pas des toits, des rues verticales et des arches empilées les unes sur les autres.</p>

      <p>La cité se rapproche.</p>

      <p>Puis le couloir s’interrompt devant une passerelle de pierre qui rejoint une construction latérale.</p>
    `,
    choices: [
      { label: 'Traverser la passerelle', to: 'c62' }
    ]
  },

  c62: {
    number: 'PAGE 62',
    title: 'La rue suspendue',
    image: 'La rue suspendue',
    text: `
      <p>Tu débouches dans ce qui ressemble à une rue.</p>

      <p>Mais elle longe une paroi verticale à plusieurs centaines de mètres au-dessus du fond.</p>

      <p>Des portes s’ouvrent sur le vide.</p>

      <p>D’autres sont couchées à plat dans le sol.</p>

      <p>Tu progresses entre ces ouvertures impossibles jusqu’à trouver un escalier plus récent, taillé à taille humaine.</p>

      <p>Il descend vers les niveaux centraux.</p>

      <p>Le silence de la ville commence à t’envelopper.</p>
    `,
    choices: [
      { label: 'Descendre vers le centre', to: 'c65' }
    ]
  },

  c63: {
    number: 'PAGE 63',
    title: 'Les quartiers noyés',
    image: 'Les quartiers noyés',
    text: `
      <p>Tu passes sous les arches basses.</p>

      <p>L’eau noire recouvre encore le sol par endroits.</p>

      <p>Des escaliers descendent dans des bassins sans fond visible.</p>

      <p>Des portes sont à moitié immergées dans les murs.</p>

      <p>Tu marches dans ce quartier noyé en suivant les parties sèches.</p>

      <p>À plusieurs reprises, tu crois voir des lumières très loin sous l’eau des rues.</p>

      <p>Les mêmes étoiles impossibles que dans le lac.</p>

      <p>Tu refuses de regarder longtemps.</p>

      <p>Une rampe de pierre finit par remonter vers un niveau plus élevé.</p>

      <p>Au sommet, les rues deviennent sèches.</p>
    `,
    choices: [
      { label: 'Suivre la grande rue', to: 'c66' }
    ]
  },

  c64: {
    number: 'PAGE 64',
    title: 'Les quartiers hauts',
    image: 'Les quartiers hauts',
    text: `
      <p>Tu entres dans la cité par le haut.</p>

      <p>D’ici, les rues ressemblent à des tranchées géométriques creusées entre des blocs noirs.</p>

      <p>Tu descends plusieurs rampes.</p>

      <p>À chaque niveau, les proportions changent.</p>

      <p>Une porte minuscule mène à une salle gigantesque.</p>

      <p>Un escalier assez large pour cinquante hommes se termine contre un mur parfaitement lisse.</p>

      <p>Plus bas, tu retrouves enfin des traces humaines : marques de craie, anciennes cordes, petits symboles de l’œil fermé gravés près des passages praticables.</p>

      <p>Les Veilleurs ont parcouru cette ville.</p>

      <p>Tu suis leurs marques jusqu’à une grande rue centrale.</p>
    `,
    choices: [
      { label: 'Suivre la grande rue', to: 'c66' }
    ]
  },

  c65: {
    number: 'PAGE 65',
    title: 'La porte latérale',
    image: 'La porte latérale',
    text: `
      <p>L’escalier humain t’amène devant une ouverture étroite percée dans un mur gigantesque.</p>

      <p>Tu la franchis.</p>

      <p>De l’autre côté, une avenue s’étend dans les deux directions.</p>

      <p>Des colonnes apparaissent puis disparaissent dans la brume.</p>

      <p>Au-dessus de toi, une seconde rue traverse l’espace à angle droit.</p>

      <p>Elle est construite sur le plafond d’une arche.</p>

      <p>Tu ne sais plus exactement ce qui est en haut ou en bas dans cette ville.</p>

      <p>Pourtant, au sol, tu retrouves un petit œil fermé gravé dans une dalle.</p>

      <p>Une flèche grossière pointe vers le centre.</p>

      <p>Tu la suis.</p>
    `,
    choices: [
      { label: 'Atteindre le centre de la cité', to: 'c66' }
    ]
  },

  c66: {
    number: 'PAGE 66',
    title: 'La Cité morte',
    image: 'La Cité morte',
    onEnter: s => setCheckpoint(s, 'La Cité morte'),
    text: state => {
      const otherWays = [];
      if (state.flags.worldRoute !== 'lake') otherWays.push('une rampe luisante d’humidité remonte depuis des quartiers noyés');
      if (state.flags.worldRoute !== 'stairs') otherWays.push('un escalier étroit descend des niveaux supérieurs');
      if (state.flags.worldRoute !== 'bridge') otherWays.push('une porte latérale s’ouvre vers le vide et laisse entrevoir, très loin, la ligne d’un pont');
      const routesLine = otherWays.length
        ? `<p>Un peu plus loin, d’autres ouvertures rejoignent l’avenue. ${otherWays.join(' ; ')}.</p><p>Au sol, d’anciennes traces de passage convergent depuis chacune d’elles vers la place.</p>`
        : '';
      const contamination = state.flags.blackEarthContamination
        ? `<p>Le goût de terre resté au fond de ta gorge te paraît soudain moins étranger.</p><p>Cette pensée te vient sans raison. Tu la chasses aussitôt.</p>`
        : '';

      return `
        <p>Le passage que tu suivais finit par s’élargir.</p>

        <p>Sans véritable seuil, tu te retrouves dans une avenue assez vaste pour qu’un village entier y tienne.</p>

        ${routesLine}

        <p>Les façades montent si haut que leur sommet se dissout dans la lumière blanche.</p>

        <p>Il n’y a aucune fenêtre.</p>

        <p>Seulement des portes.</p>

        <p>Des centaines.</p>

        <p>Certaines sont trop petites pour un enfant. D’autres ont la hauteur d’un clocher.</p>

        <p>Au bout de l’avenue, l’espace s’ouvre sur une place circulaire.</p>

        <p>En son centre se dresse une vasque de pierre sèche.</p>

        <p>Une poussière noire repose au fond.</p>

        <p>Tu t’arrêtes à plusieurs pas.</p>

        <p>Rien ne bouge.</p>

        <p>Plus tu la regardes, moins ta fatigue paraît importante.</p>

        <p>La douleur de tes épaules s’éloigne. Ta peur aussi.</p>

        <p>Une idée se forme avec une douceur qui n’a rien à faire ici : il suffirait de plonger les doigts dans cette poussière pour continuer plus facilement.</p>

        <p>Pour devenir un peu plus fort.</p>

        <p>Peut-être assez pour ne plus avoir peur du reste.</p>

        ${contamination}

        <p>Ta main se soulève légèrement avant que tu t’en rendes compte.</p>

        <p>Tu la rabats contre toi.</p>


        <p>En reculant, tu éprouves un bref regret.</p>

        <p>C’est ce regret qui te fait quitter la vasque.</p>

        <p>Trois passages s’ouvrent autour de la place.</p>

        <p>Le premier est couvert de noms gravés dans la pierre.</p>

        <p>Le second aligne une suite de portes étroites, toutes fermées.</p>

        <p>Le dernier laisse filtrer une lumière blanche sous une arche marquée de l’œil fermé.</p>
      `;
    },
    choices: [
      { label: 'Suivre le passage couvert de noms', to: 'c67', effect: s => { s.flags.cityRoute = 'names'; } },
      { label: 'Entrer dans le couloir aux portes étroites', to: 'c72', effect: s => { s.flags.cityRoute = 'voices'; } },
      { label: 'Suivre la lumière blanche sous l’arche', to: 'c77', effect: s => { s.flags.cityRoute = 'laboratory'; } }
    ]
  },

  c67: {
    number: 'PAGE 67',
    title: 'La salle des noms',
    image: 'La salle des noms',
    text: `
      <p>Le passage se rétrécit, puis s’ouvre sur une longue galerie aux murs parfaitement lisses.</p>

      <p>Ils sont couverts de noms.</p>

      <p>Des centaines d’abord.</p>

      <p>Puis des milliers.</p>

      <p>Certains sont presque effacés. D’autres paraissent beaucoup plus récents.</p>

      <p>À côté de plusieurs inscriptions, tu remarques de petits signes répétés : un œil fermé, trois traits courts, parfois une ligne interrompue.</p>

      <p>Ce n’est pas un monument funéraire.</p>

      <p>Les noms ont été classés.</p>

      <p>Notés.</p>

      <p>Suivis.</p>

      <p>Plus loin, une inscription plus grande a été gravée au-dessus d’une série de colonnes.</p>

      <blockquote>CEUX QUI ENTENDENT L’APPEL DOIVENT ÊTRE INSCRITS AVANT LA DESCENTE.</blockquote>

      <p>Tu relis lentement.</p>

      <p>Puis un nom familier attire ton regard.</p>
    `,
    choices: [{ label: 'T’approcher', to: 'c68' }]
  },

  c68: {
    number: 'PAGE 68',
    title: '',
    image: 'Ceux qui sont venus',
    text: `
      <p><strong>GASPARD VELLIN.</strong></p>

      <p>À côté de son nom, trois traits courts ont été gravés dans la pierre.</p>

      <p>Un peu plus loin :</p>

      <p><strong>ANSELME VARN.</strong></p>

      <p>Le même signe.</p>

      <p>Tu poursuis le long du mur.</p>

      <p><strong>ALDREN DE ROCHEBRUNE.</strong></p>

      <p>Cette fois, l’œil fermé accompagne son nom.</p>

      <p>La gravure est plus usée que celles de Gaspard et d’Anselme.</p>

      <p>Tu ne sais pas ce que signifient encore ces marques, mais une chose devient difficile à ignorer :</p>

      <p>Gaspard, Anselme et Aldren ne sont pas arrivés ici par hasard.</p>

      <p>Les Veilleurs connaissaient les gens qui entendaient cet appel.</p>

      <p>Ils inscrivaient leurs noms avant qu’ils ne descendent plus profondément sous la montagne.</p>

      <p>Tu continues malgré toi à parcourir la liste.</p>

      <p>Et tu trouves le tien.</p>
    `,
    choices: [{ label: 'Lire ton nom', to: 'c69' }]
  },

  c69: {
    number: 'PAGE 69',
    title: '',
    image: 'Ton nom',
    text: state => {
      const hero = escapeHtml(heroName(state)).toUpperCase();
      return `
        <p><strong>${hero}.</strong></p>

        <p>Ton nom est déjà gravé dans la pierre.</p>

        <p>Tu restes immobile.</p>

        <p>Les traits ne sont pas frais. Une fine poussière s’est déposée au fond des lettres.</p>

        <p>Personne ici ne devrait connaître ton nom.</p>

        <p>Personne ne t’a vu entrer dans la montagne.</p>

        <p>Et pourtant il est là, parmi ceux de Gaspard, d’Anselme et d’Aldren.</p>

        <p>À côté, le même signe que près du nom de Gaspard : trois entailles courtes.</p>

        <p>Tu repenses à la poussière noire de la place.</p>

        <p>À la terre sous les ongles.</p>

        <p>Aux voix qui semblent parfois savoir plus de choses qu’elles ne devraient.</p>

        <p>Pour la première fois, l’idée te vient que tu n’es peut-être plus seulement à la recherche d’Aldren.</p>

        <p>Quelque chose, ici, t’a peut-être déjà reconnu.</p>
      `;
    },
    choices: [
      { label: 'Toucher ton nom', to: 'c70', effect: s => { s.flags.touchedOwnName = true; } },
      { label: 'Ne pas le toucher et continuer', to: 'c70' }
    ]
  },

  c70: {
    number: 'PAGE 70',
    title: '',
    image: 'Le dernier Veilleur',
    text: state => `
      ${state.flags.touchedOwnName ? `
        <p>La pierre est tiède sous tes doigts.</p>

        <p>Tu retires aussitôt la main.</p>
      ` : ''}

      <p>Au bout de la galerie, un squelette est assis contre le mur.</p>

      <p>Une cotte de mailles noircie recouvre encore ses épaules.</p>

      <p>Autour de son cou pend une petite plaque de bronze portant l’œil fermé.</p>

      <p>À côté de lui, une tablette de pierre a glissé au sol.</p>

      <p>Quelques lignes restent lisibles :</p>

      <blockquote>NE PAS LES LAISSER DESCENDRE APRÈS L’APPEL.</blockquote>

      <blockquote>LES CONDUIRE AUX SALLES BLANCHES.</blockquote>

      <blockquote>SI LA TERRE PARAÎT DANS LA BOUCHE OU SOUS LES ONGLES, COMMENCER L’EXTRACTION.</blockquote>

      <p>Tu regardes de nouveau les milliers de noms.</p>

      <p>Les Veilleurs ne se contentaient pas de surveiller la montagne.</p>

      <p>Ils attendaient ceux qu’elle attirait.</p>

      <p>Et ils essayaient de les arrêter avant qu’ils ne descendent plus bas.</p>
    `,
    choices: state => hasItem(state, 'plaque_veilleur')
      ? [{ label: 'Quitter la salle des noms', to: 'c71' }]
      : [
          {
            label: 'Prendre la Plaque du Veilleur',
            to: 'c71',
            effect: s => addItem(s, 'plaque_veilleur', 'Plaque du Veilleur', 'Une petite plaque de bronze portant l’œil fermé. Elle appartenait à l’un des Veilleurs qui recensait les personnes attirées sous la montagne.')
          },
          { label: 'La laisser', to: 'c71' }
        ]
  },

  c71: {
    number: 'PAGE 71',
    title: '',
    image: 'Les appelés',
    text: `
      <p>Avant de quitter la galerie, tu regardes une dernière fois les murs.</p>

      <p>Tu comprends maintenant ce que représente cette liste.</p>

      <p>Ce ne sont pas les noms des morts.</p>

      <p>Ce sont les noms de ceux qui ont entendu quelque chose.</p>

      <p>De ceux qui ont commencé à venir vers la montagne.</p>

      <p>Les Veilleurs les recensaient, puis tentaient de les conduire vers leurs salles de soin avant qu’ils n’aillent plus loin.</p>

      <p>Gaspard en faisait partie.</p>

      <p>Anselme aussi.</p>

      <p>Aldren également.</p>

      <p>Et désormais, ton nom figure parmi les leurs.</p>

      <p>La question n’est plus seulement de savoir ce qui se trouve sous la montagne.</p>

      <p>Il faut aussi comprendre pourquoi elle connaît déjà ton nom.</p>
    `,
    choices: [{ label: 'Poursuivre dans la cité', to: 'c82' }]
  },

  c72: {
    number: 'PAGE 72',
    title: 'Le couloir des portes',
    image: 'Le couloir des portes',
    text: state => `
      <p>Les portes sont toutes à taille humaine.</p>

      <p>C’est presque rassurant après les proportions de la cité.</p>

      <p>Entre deux portes, des phrases ont été gravées directement dans la pierre.</p>

      <p>La première est maladroite, comme tracée par une main tremblante :</p>

      <blockquote>J’ENTENDS LÉONIE DEPUIS TROIS NUITS.</blockquote>

      <p>Plus bas :</p>

      <blockquote>JE SAIS QU’ELLE EST MORTE.</blockquote>

      <p>Une autre phrase a été ajoutée plus tard.</p>

      <blockquote>QUAND ELLE M’APPELLE, JE ME LÈVE AVANT MÊME D’AVOIR DÉCIDÉ DE LE FAIRE.</blockquote>

      <p>Tu continues.</p>

      <p>Derrière une porte, une femme murmure un prénom.</p>

      <p>Derrière une autre, un enfant rit.</p>

      <p>Puis, à ta droite :</p>

      <blockquote>« ${escapeHtml(heroName(state))} ? »</blockquote>

      <p>La voix de Sir Aldren.</p>

      <p>Faible. Épuisée.</p>

      <blockquote>« Je suis ici. Ouvre. »</blockquote>
    `,
    choices: [
      { label: 'Ouvrir la porte', to: 'c73', effect: s => {
          const ok = roll3D6(s, 'Dextérité', currentDexterity(s));
          s.flags.voiceDoorDex = ok ? 'success' : 'fail';
          if (!ok) s.flags.voiceDoorDamage = applyDamage(s, 2);
        }
      },
      { label: 'Ne pas répondre et continuer', to: 'c75' }
    ]
  },

  c73: {
    number: 'PAGE 73',
    title: '',
    image: 'La porte d’Aldren',
    text: state => {
      const r = diceResultHtml(state);
      if (state.flags.voiceDoorDex === 'success') {
        return r + `
          <p>Tu soulèves le loquet.</p>

          <p>La porte s’ouvre brusquement.</p>

          <p>Ton pied allait avancer lorsque tu aperçois le vide.</p>

          <p>Il n’y a pas de pièce derrière la porte.</p>

          <p>Seulement un puits vertical qui plonge dans l’obscurité.</p>

          <p>Tu recules juste avant que ton poids ne passe le seuil.</p>

          <p>La voix d’Aldren monte d’en bas.</p>

          <blockquote>« Tu m’as trouvé. »</blockquote>

          <p>Le ton n’a pas changé.</p>

          <p>Ni peur. Ni soulagement.</p>

          <p>Seulement cette voix parfaitement reconnaissable.</p>
        `;
      }
      return r + `
        <p>Tu soulèves le loquet.</p>

        <p>La porte s’ouvre plus vite que prévu.</p>

        <p>Ton pied plonge dans le vide.</p>

        <p>Tu te jettes contre le chambranle et heurtes violemment la pierre avant de parvenir à te retenir.</p>

        ${damageAbsorptionHtml(state.flags.voiceDoorDamage)}

        <p>Sous toi, très loin, la voix d’Aldren continue.</p>

        <blockquote>« Encore un peu. »</blockquote>

        <p>Tu refermes la porte.</p>
      `;
    },
    choices: state => state.hp <= 0 ? fatalChoices() : [{ label: 'T’éloigner de cette porte', to: 'c74' }]
  },

  c74: {
    number: 'PAGE 74',
    title: '',
    image: 'Ceux qui ont répondu',
    text: `
      <p>Tu t’éloignes de la porte jusqu’à ne plus voir sa poignée.</p>

      <p>Dans une alcôve, tu découvres un paquet de vêtements, une gourde vide et un morceau de charbon.</p>

      <p>Le mur est couvert de phrases courtes.</p>

      <blockquote>ELLE M’A DIT DE VENIR.</blockquote>

      <blockquote>LES VEILLEURS DISENT QUE CE N’EST PAS ELLE.</blockquote>

      <blockquote>JE LE SAIS.</blockquote>

      <blockquote>JE L’ENTENDS QUAND MÊME.</blockquote>

      <p>La dernière phrase est presque effacée à force d’avoir été frottée :</p>

      <blockquote>NOUS NE SOMMES PAS ENLEVÉS. NOUS VENONS.</blockquote>

      <p>Tu restes un instant devant ces mots.</p>

      <p>À Rochebrume, les gens disparaissaient sans que personne sache pourquoi.</p>

      <p>Peut-être qu’aucune force ne les traînait jusqu’ici.</p>

      <p>Peut-être qu’on leur donnait simplement une voix qu’ils ne pouvaient pas se résoudre à abandonner.</p>
    `,
    choices: [{ label: 'Continuer dans le couloir', to: 'c76' }]
  },

  c75: {
    number: 'PAGE 75',
    title: '',
    image: 'Ne pas répondre',
    text: state => `
      <p>Tu continues sans toucher la poignée.</p>

      <blockquote>« ${escapeHtml(heroName(state))}… »</blockquote>

      <p>La voix d’Aldren reste derrière toi.</p>

      <p>Puis elle devient celle d’Élias.</p>

      <p>Plus loin, elle prend le timbre rauque de Gaspard.</p>

      <p>Tu accélères.</p>

      <p>Dans une alcôve, tu aperçois un paquet de vêtements et plusieurs phrases écrites au charbon.</p>

      <blockquote>ELLE M’A DIT DE VENIR.</blockquote>

      <blockquote>LES VEILLEURS DISENT QUE CE N’EST PAS ELLE.</blockquote>

      <blockquote>JE LE SAIS.</blockquote>

      <blockquote>JE L’ENTENDS QUAND MÊME.</blockquote>

      <p>La dernière phrase est plus profonde que les autres :</p>

      <blockquote>NOUS NE SOMMES PAS ENLEVÉS. NOUS VENONS.</blockquote>

      <p>Tu comprends alors quelque chose de simple et de terrible.</p>

      <p>Les disparus ne sont peut-être pas conduits de force jusqu’à la montagne.</p>

      <p>Quelque chose leur donne une raison d’y venir.</p>
    `,
    choices: [{ label: 'Atteindre le bout du couloir', to: 'c76' }]
  },

  c76: {
    number: 'PAGE 76',
    title: '',
    image: 'L’avertissement',
    text: `
      <p>Le couloir se termine sous une arche basse.</p>

      <p>Juste avant de la franchir, tu remarques une inscription plus nette que les autres.</p>

      <blockquote>NE CROIS PAS UNE VOIX QUI CONNAÎT TON NOM AVANT QUE TU LE LUI AIES DONNÉ.</blockquote>

      <p>Tu relis la phrase.</p>

      <p>Les fragments s’assemblent.</p>

      <p>Quelque chose sous la montagne apprend les noms, les voix et les souvenirs de ceux qu’il atteint.</p>

      <p>Puis il s’en sert pour les attirer.</p>

      <p>Les disparus de Rochebrume n’ont peut-être jamais été poursuivis.</p>

      <p>Ils ont entendu quelqu’un qu’ils voulaient retrouver.</p>

      <p>Ou quelqu’un qu’ils croyaient pouvoir sauver.</p>

      <p>Et ils ont suivi la voix.</p>

      <p>Tu penses à Aldren.</p>

      <p>S’il t’appelle plus bas, il faudra d’abord t’assurer que c’est bien lui.</p>
    `,
    choices: [{ label: 'Franchir l’arche', to: 'c82' }]
  },

  c77: {
    number: 'PAGE 77',
    title: 'Le laboratoire des Veilleurs',
    image: 'L’arche blanche',
    text: `
      <p>La lumière vient de petites plaques pâles incrustées dans les murs.</p>

      <p>Le passage débouche dans une grande salle.</p>

      <p>Des tables de pierre sont alignées contre les parois.</p>

      <p>Des sangles desséchées pendent encore à certaines.</p>

      <p>Au-dessus, de longs bras articulés portent des aiguilles de pierre.</p>

      <p>Tu penses d’abord à une salle de torture.</p>

      <p>Puis tu remarques les bassins, les rigoles et les récipients soigneusement rangés.</p>

      <p>Sur plusieurs tables, les sangles sont accompagnées de coussins de cuir pour maintenir la tête et les épaules.</p>

      <p>Dans une cuve fermée, une matière noire a séché en une couche épaisse.</p>

      <p>Le même dépôt apparaît au bout de certaines aiguilles.</p>

      <p>Ce lieu n’a pas été construit pour faire souffrir.</p>

      <p>Les Veilleurs cherchaient à retirer quelque chose du corps de ceux qu’ils attachaient ici.</p>
    `,
    choices: [{ label: 'Examiner les appareils', to: 'c78' }]
  },

  c78: {
    number: 'PAGE 78',
    title: '',
    image: 'Les aiguilles de pierre',
    text: `
      <p>Tu t’approches d’une des tables.</p>

      <p>Les aiguilles convergent vers les bras, la poitrine et la gorge.</p>

      <p>Au bout de chacune, une matière noire a séché en croûtes très fines.</p>

      <p>Dans un renfoncement du mur, plusieurs ampoules de verre sont rangées dans une boîte de pierre.</p>

      <p>Presque toutes sont brisées.</p>

      <p>Une seule paraît intacte.</p>

      <p>Un liquide blanc et trouble remplit encore son fond.</p>

      <p>Tu avances la main.</p>

      <p>La dalle sous ta botte s’abaisse de quelques millimètres.</p>

      <p>Un déclic sec répond dans le mur.</p>

      <p>Un mécanisme ancien se réveille.</p>

      <p>Un bras de pierre pivote vers toi.</p>
    `,
    choices: [{
      label: 'Éviter le bras — lancer les trois dés de Dextérité',
      to: 'c79',
      effect: s => {
        const ok = roll3D6(s, 'Dextérité', currentDexterity(s));
        s.flags.labTrap = ok ? 'success' : 'fail';
        if (!ok) s.flags.labTrapDamage = applyDamage(s, 2);
      }
    }]
  },

  c79: {
    number: 'PAGE 79',
    title: '',
    image: 'Le bras de pierre',
    text: state => {
      const r = diceResultHtml(state);
      if (state.flags.labTrap === 'success') {
        return r + `
          <p>Tu te jettes de côté.</p>

          <p>L’aiguille traverse l’endroit où se trouvait ta gorge et s’arrête dans un claquement sec.</p>

          <p>Le mécanisme essaie de revenir à sa position initiale, puis se bloque.</p>

          <p>Après quelques secondes, le silence revient.</p>
        `;
      }
      return r + `
        <p>Tu recules trop tard.</p>

        <p>Le bras de pierre te frappe à l’épaule et t’écrase contre le bord de la table.</p>

        ${damageAbsorptionHtml(state.flags.labTrapDamage)}

        <p>L’aiguille passe à quelques doigts de ton cou.</p>

        <p>Le mécanisme grince encore une fois puis s’immobilise.</p>
      `;
    },
    choices: state => state.hp <= 0 ? fatalChoices() : [{ label: 'Prendre l’ampoule', to: 'c80' }]
  },

  c80: {
    number: 'PAGE 80',
    title: '',
    image: 'L’ampoule blanche',
    text: `
      <p>Le verre est froid.</p>

      <p>Le liquide blanc ne remplit qu’un tiers de l’ampoule.</p>

      <p>Lorsque tu la retournes, il s’écoule lentement sur la paroi intérieure.</p>

      <p>Aucune inscription.</p>

      <p>Seulement l’œil fermé, gravé si finement qu’il faut incliner le verre pour le voir.</p>

      <p>Autour de toi, les autres ampoules sont toutes vides ou brisées.</p>

      <p>Tu ne sais pas ce que celle-ci peut encore soigner.</p>

      <p>Tu sais seulement que les machines de cette salle cherchaient à extraire un mal inconnu.</p>
    `,
    choices: state => hasItem(state, 'ampoule_blanche')
      ? [{ label: 'Examiner les gravures de la salle', to: 'c81' }]
      : [
          {
            label: 'Prendre l’Ampoule blanche',
            to: 'c81',
            effect: s => addItem(s, 'ampoule_blanche', 'Ampoule blanche', 'Une ampoule des Veilleurs contenant un liquide blanc. Elle semble avoir servi au traitement de ceux que la montagne avait atteints.')
          },
          { label: 'La laisser', to: 'c81' }
        ]
  },

  c81: {
    number: 'PAGE 81',
    title: '',
    image: 'Ce qu’ils essayaient de sauver',
    text: `
      <p>Sur le mur du fond, une série de silhouettes raconte ce qui se passait ici.</p>

      <p>La première représente un homme tourné vers une montagne.</p>

      <p>Trois traits partent de sa tête, comme s’il écoutait quelque chose.</p>

      <p>Dans la seconde, une matière sombre apparaît autour de sa bouche, de ses mains et de sa poitrine.</p>

      <p>Dans la troisième, il est attaché sur une table semblable à celles qui t’entourent.</p>

      <p>Les aiguilles entrent dans son corps.</p>

      <p>La matière noire en ressort et coule vers un récipient.</p>

      <p>Dans la dernière image, l’homme est debout. L’œil fermé est gravé au-dessus de lui.</p>

      <p>Sous les dessins, quelques mots sont encore lisibles :</p>

      <blockquote>À L’APPEL, RETENIR.</blockquote>

      <blockquote>EXTRAIRE AVANT LA DESCENTE.</blockquote>

      <blockquote>APRÈS L’EXTRACTION, LE SILENCE REVIENT CHEZ CERTAINS.</blockquote>

      <p>Une dernière ligne a été ajoutée plus tard :</p>

      <blockquote>S’ILS ENTENDENT ENCORE, NE PAS LES LAISSER DESCENDRE.</blockquote>

      <p>Tu regardes les sangles avec un malaise nouveau.</p>

      <p>Les Veilleurs ne torturaient pas les gens attirés sous la montagne.</p>

      <p>Ils tentaient de les sauver.</p>

      <p>Ils avaient compris que l’appel et la terre noire faisaient partie du même mal.</p>

      <p>Et parfois, ils parvenaient à faire taire la voix.</p>
    `,
    choices: [{ label: 'Quitter le laboratoire', to: 'c82' }]
  },

  c82: {
    number: 'PAGE 82',
    title: 'La salle de veille',
    image: 'La salle de veille',
    text: state => {
      let routeMemory = '';
      if (state.flags.cityRoute === 'names') {
        routeMemory = '<p>La liste des appelés te revient en mémoire. Ton propre nom parmi les leurs rend cette histoire beaucoup trop proche.</p>';
      } else if (state.flags.cityRoute === 'voices') {
        routeMemory = '<p>Tu repenses aux voix derrière les portes. Tu sais maintenant qu’une partie de l’appel consiste à donner aux victimes une raison de continuer.</p>';
      } else if (state.flags.cityRoute === 'laboratory') {
        routeMemory = '<p>Les tables et les aiguilles du laboratoire te reviennent en mémoire. Les Veilleurs avaient trouvé un moyen d’arracher au moins une partie du mal.</p>';
      }
      return `
        <p>Le passage débouche dans une salle ronde.</p>

        <p>Trois accès y arrivent.</p>

        <p>Sur l’un, tu reconnais les noms gravés.</p>

        <p>Un autre mène au couloir des portes.</p>

        <p>Le troisième est marqué par les plaques blanches du laboratoire.</p>

        <p>Les trois chemins se rejoignent ici.</p>

        <p>Au centre, une grande dalle dressée porte quatre scènes simples.</p>

        <p>Un homme entend quelque chose depuis la montagne.</p>

        <p>Dans la scène suivante, de la matière noire apparaît autour de sa bouche et de ses mains.</p>

        <p>Puis des Veilleurs le retiennent et tentent d’extraire cette matière.</p>

        <p>Enfin, un œil fermé se dresse devant un passage qui descend sous terre.</p>

        <p>Cette fois, tu n’as plus besoin de deviner l’essentiel.</p>

        <p>Les disparus entendent un appel.</p>

        <p>Quelque chose utilise leurs souvenirs, leurs voix ou leurs désirs pour les attirer jusqu’à la montagne.</p>

        <p>La terre noire apparaît chez certains d’entre eux à mesure que le mal progresse.</p>

        <p>Les Veilleurs les recensaient, les interceptaient ici et tentaient de les soigner avant qu’ils ne descendent plus profondément.</p>

        ${routeMemory}

        <p>Tu ne sais toujours pas ce qui appelle.</p>

        <p>Mais tu sais désormais ce que les Veilleurs essayaient d’empêcher.</p>

        <p>Au bas de la dalle, une dernière gravure montre une petite lame noire coupant plusieurs traits qui relient un homme à quelque chose laissé hors du dessin.</p>

        <p>À côté, une flèche pointe vers les niveaux inférieurs de la cité.</p>

        <p>Si Aldren a continué, c’est probablement par là.</p>
      `;
    },
    choices: [{ label: 'Suivre la direction indiquée par les Veilleurs', to: 'c83' }]
  },

  c83: {
    number: 'PAGE 83',
    title: 'L’avenue basse',
    image: 'L’avenue basse',
    text: `
      <p>Tu quittes le carrefour par une avenue qui descend lentement.</p>

      <p>Ici, la cité paraît moins intacte.</p>

      <p>Des blocs se sont détachés des façades. Des dalles sont fendues. Par endroits, des racines minérales ont soulevé le sol.</p>

      <p>Tu avances entre les débris.</p>

      <p>Sur plusieurs pierres, tu retrouves l’œil fermé.</p>

      <p>Les marques ne sont pas décoratives. Elles ont été gravées à hauteur de main, parfois accompagnées d’un trait ou d’une flèche.</p>

      <p>Quelqu’un s’en servait pour se repérer.</p>

      <p>Plus bas, une partie entière de la rue s’est effondrée.</p>

      <p>Derrière les pierres brisées apparaît une maçonnerie plus ancienne, grossière, directement appuyée contre la roche.</p>

      <p>La cité n’a pas été construite d’un seul bloc.</p>

      <p>Quelque chose existait déjà ici lorsqu’on a élevé ses rues.</p>
    `,
    choices: [{ label: 'Examiner l’éboulement', to: 'c84' }]
  },

  c84: {
    number: 'PAGE 84',
    title: 'Le passage de service',
    image: 'Derrière le mur',
    text: `
      <p>Tu longes l’éboulement jusqu’à trouver une ouverture entre deux blocs.</p>

      <p>Elle est étroite, mais quelqu’un a déjà déplacé plusieurs pierres pour l’agrandir.</p>

      <p>Tu te glisses à l’intérieur.</p>

      <p>Derrière la façade de la cité court un ancien passage de service taillé à même la roche.</p>

      <p>Le plafond est bas. Les parois portent encore les traces régulières d’outils.</p>

      <p>À plusieurs endroits, des étais de bois se sont effondrés depuis longtemps. Tu dois escalader leurs restes, ramper sous une poutre puis te hisser sur une corniche étroite.</p>

      <p>Le passage se termine au bord d’un conduit vertical.</p>

      <p>Des prises ont été creusées dans la paroi. De vieux anneaux de fer sont scellés dans la pierre.</p>

      <p>Au fond, une plateforme apparaît une dizaine de mètres plus bas.</p>

      <p>Sur son bord, tu distingues encore le symbole de l’œil fermé.</p>
    `,
    choices: [{ label: 'Préparer la descente', to: 'c85' }]
  },

  c85: {
    number: 'PAGE 85',
    title: 'Le puits des Veilleurs',
    image: 'Le puits des Veilleurs',
    text: state => `
      <p>Tu t’accroupis au bord du conduit.</p>

      <p>Les prises de pierre sont usées mais encore praticables. Plusieurs ont toutefois perdu un morceau de leur bord.</p>

      <p>Les anneaux de fer semblent plus solides.</p>

      <p>En dessous, le puits s’enfonce dans une partie de la montagne qui ne ressemble plus à une ville.</p>

      <p>Seulement à un chantier très ancien.</p>

      ${hasItem(state, 'ceinture_corde_rouge') ? '<p>La Ceinture de corde rouge peut te servir à t’assurer aux anneaux pendant la descente.</p>' : '<p>Sans corde, tu devras compter sur les prises et sur ton équilibre.</p>'}
    `,
    choices: state => {
      const list = [];
      if (hasItem(state, 'ceinture_corde_rouge')) {
        list.push({
          label: 'T’assurer avec la Ceinture de corde rouge',
          to: 'c86',
          effect: s => { s.flags.cityWellDescent = 'rope'; }
        });
      }
      list.push({
        label: 'Descendre par les prises — lancer les trois dés de Dextérité',
        to: 'c86',
        effect: s => {
          const ok = roll3D6(s, 'Dextérité', currentDexterity(s));
          s.flags.cityWellDescent = ok ? 'success' : 'fail';
          if (!ok) s.flags.cityWellDamage = applyDamage(s, 2);
        }
      });
      return list;
    }
  },

  c86: {
    number: 'PAGE 86',
    title: 'Le palier inférieur',
    image: 'Le palier inférieur',
    text: state => {
      const descent = state.flags.cityWellDescent;
      const canCleanse = hasItem(state, 'ampoule_blanche') && ((state.dexPenalty || 0) > 0 || state.flags.blackEarthContamination);
      let intro = '';
      if (descent === 'rope') {
        intro = `
          <p>Tu fixes la corde à l’un des anneaux et descends lentement.</p>

          <p>Deux prises cèdent sous tes bottes, mais la corde retient ton poids.</p>

          <p>Tu atteins la plateforme sans blessure.</p>
        `;
      } else if (descent === 'success') {
        intro = diceResultHtml(state) + `
          <p>Tu descends en prenant le temps de tester chaque prise avant d’y mettre ton poids.</p>

          <p>La roche s’effrite parfois sous tes doigts, mais tu atteins la plateforme sans glisser.</p>
        `;
      } else {
        intro = diceResultHtml(state) + `
          <p>À quelques mètres du fond, une prise se détache sous ta main.</p>

          <p>Tu glisses, heurtes la paroi puis tombes lourdement sur la plateforme.</p>

          ${damageAbsorptionHtml(state.flags.cityWellDamage)}

          <p>Tu restes un instant au sol avant de te relever.</p>
        `;
      }
      return intro + `
        <p>La plateforme donne sur une galerie basse encombrée d’outils rongés par la rouille et de paniers de pierre effondrés.</p>

        <p>Les Veilleurs ont creusé ici.</p>

        <p>Dans un renfoncement, une petite dalle porte plusieurs cavités de la taille des ampoules du laboratoire.</p>

        <p>Le bord de certaines est taché de noir.</p>

        ${canCleanse ? '<p>L’Ampoule blanche que tu transportes s’adapte exactement à l’une de ces cavités.</p><p>Tu repenses à la terre restée sous tes ongles et au goût qui revient parfois au fond de ta gorge.</p>' : ''}

        <p>Plus loin, une flèche gravée sous un œil fermé indique une galerie descendante.</p>
      `;
    },
    choices: state => {
      if (state.hp <= 0) return fatalChoices();
      const list = [];
      if (hasItem(state, 'ampoule_blanche') && ((state.dexPenalty || 0) > 0 || state.flags.blackEarthContamination)) {
        list.push({
          label: 'Utiliser l’Ampoule blanche',
          to: 'c87',
          effect: s => {
            removeItem(s, 'ampoule_blanche');
            if ((s.dexPenalty || 0) > 0) s.dexPenalty = Math.max(0, s.dexPenalty - 1);
            s.flags.blackEarthContamination = false;
            s.flags.usedWhiteAmpouleAtWell = true;
          }
        });
      }
      list.push({ label: 'Conserver ce que tu possèdes et suivre la galerie', to: 'c87' });
      return list;
    }
  },

  c87: {
    number: 'PAGE 87',
    title: 'La porte sous la ville',
    image: 'La porte sous la ville',
    text: state => `
      ${state.flags.usedWhiteAmpouleAtWell ? `
        <p>Le liquide blanc brûle légèrement lorsqu’il touche tes doigts.</p>

        <p>La terre noire tassée sous tes ongles se ramollit puis se détache en grains épais.</p>

        <p>Tu t’essuies longuement.</p>

        <p>Le goût terreux au fond de ta gorge finit lui aussi par s’atténuer.</p>

        <p>Pour la première fois depuis la fissure, tu as l’impression d’en être débarrassé.</p>
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
    choices: [{ label: 'Passer sous la cité', to: 'c88' }]
  },

  c88: {
    number: 'PAGE 88',
    title: 'Sous la Cité morte',
    image: 'Sous la Cité morte',
    onEnter: s => setCheckpoint(s, 'Sous la Cité morte'),
    text: `
      <p>Derrière la porte, un escalier grossier s’enfonce dans la roche.</p>

      <p>Tu descends.</p>

      <p>La pierre travaillée de la cité disparaît rapidement. Ici, les galeries ont été creusées à la main puis renforcées là où la montagne menaçait de reprendre sa place.</p>

      <p>Des rainures courent au sol pour évacuer une eau qui ne coule plus.</p>

      <p>Des anneaux de fer ponctuent les parois. Certains portent encore des lambeaux de corde.</p>

      <p>Tu passes sous un étai brisé, franchis une tranchée étroite et dois te hisser sur un ancien front de taille pour poursuivre.</p>

      <p>Les marques laissées par les Veilleurs deviennent plus nombreuses.</p>

      <p>L’œil fermé.</p>

      <p>Puis, de plus en plus souvent, la petite lame noire.</p>

      <p>Sur une paroi, quelqu’un a gravé la lame au-dessus d’une ligne qui descend encore.</p>

      <p>À côté, une seconde empreinte de botte marque la poussière.</p>

      <p>Plus nette que la première.</p>

      <p>Quelqu’un est passé par ici.</p>

      <p>Tu resserres ta prise sur ton arme et t’engages dans la galerie.</p>

      <p>Devant toi, la roche descend vers des niveaux plus anciens encore.</p>

      <p><strong>Fin de cette version test.</strong></p>
    `,
    choices: [
      { label: 'Reprendre au dernier point de sauvegarde', action: 'checkpoint' },
      { label: 'Recommencer depuis le début', action: 'restart' }
    ]
  }

};

  // Publication progressive : pour ouvrir la suite plus tard, augmenter
  // UNIQUEMENT ce nombre (par ex. 66) dans la prochaine version joueurs.
  // Les identifiants c1, c2... ne doivent pas changer : les sauvegardes
  // pointent vers ces identifiants et conservent toutes les décisions prises.
  const PUBLISHED_PAGE_COUNT = 40;
  const PAGE_ORDER = Array.from({ length: PUBLISHED_PAGE_COUNT }, (_, i) => `c${i + 1}`);
  const PAGE_BY_NODE = Object.fromEntries(PAGE_ORDER.map((id, i) => [id, i + 1]));
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
      state.weapon === 'light' ? -1 : 0;
    const itemBonus = hasItem(state, 'anneau_veilleurs') ? 1 : 0;
    return Math.max(3,
      state.baseDexterity +
      (state.dexBonus || 0) +
      itemBonus -
      (state.dexPenalty || 0) +
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
      heroGender: seriesProfile.heroGender === 'male' ? 'male' : 'female',
      heroName: seriesProfile.heroGender === 'male' ? 'Aubin' : 'Aélis',
      inventory: {},
      flags: {},
      visited: {},
      history: [],
      journal: '',
      hp: base.maxHp || 18,
      maxHp: base.maxHp || 18,
      chance: base.chance || 12,
      baseForce: base.force || 8,
      baseDexterity: base.dexterity || 13,
      forceBonus: 0,
      dexBonus: 0,
      dexPenalty: 0,
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

  const TEST_ITEM_CATALOG = [
    {
      id: 'parchemin',
      name: 'Notes d’Aldren',
      description: 'Un fragment ancien découvert dans les affaires de Sir Aldren. Il peut être relu quand tu veux.'
    },
    {
      id: 'fiole_rouge',
      name: 'Fiole rouge',
      description: 'Une petite fiole au liquide rouge sombre. Son utilité est encore inconnue.'
    },
    {
      id: 'potion_guerison',
      name: 'Potion de guérison',
      description: 'Une potion du marchand. Elle rend 1 dé de Vie lorsqu’elle est bue.'
    },
    {
      id: 'potion_sombre',
      name: 'Potion de guérison sombre',
      description: 'La fiole trouvée sur Gaspard. Son liquide est presque noir.'
    },
    {
      id: 'brassard_veilleurs',
      name: 'Brassard des Veilleurs',
      description: 'Un brassard sombre étonnamment léger. Tant qu’il est coché : +1 Force.'
    },
    {
      id: 'anneau_veilleurs',
      name: 'Anneau des Veilleurs',
      description: 'Un anneau ancien et très léger. Tant qu’il est coché : +1 Dextérité.'
    },
    {
      id: 'lames_jet',
      name: 'Lames de jet',
      description: 'Petites lames vendues par Élias. En mode test, les cocher en donne 3.',
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
      id: 'plaque_veilleur',
      name: 'Plaque du Veilleur',
      description: 'Une petite plaque de bronze portant l’œil fermé. Son usage reste inconnu.'
    },
    {
      id: 'ampoule_blanche',
      name: 'Ampoule blanche',
      description: 'Une ampoule des Veilleurs liée au traitement de la terre noire.'
    }
  ];

  function testItemOwned(state, entry) {
    if (entry.special === 'throwingBlades') return (state.throwingBlades || 0) > 0;
    return hasItem(state, entry.id);
  }

  function setTestItem(state, entry, enabled) {
    if (entry.special === 'throwingBlades') {
      state.throwingBlades = enabled ? Math.max(3, state.throwingBlades || 0) : 0;
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
      ['light', 'Petite épée · DEX −1 · Puissance 2']
    ].map(([value, label]) => `
      <label class="test-weapon-option">
        <input type="radio" name="testWeapon" data-action="test-equip-weapon:${value}" ${state.weapon === value ? 'checked' : ''}>
        <span>${label}</span>
      </label>`).join('');

    return `
      <div class="test-inventory-panel">
        <div class="test-inventory-title">Mode test · objets disponibles</div>
        <p class="test-inventory-note">Tous les objets déjà introduits dans cette version sont visibles ici. Coche ou décoche un objet pour simuler immédiatement sa présence dans ton inventaire.</p>
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
      const weaponDex = state.weapon === 'heavy' ? '−4' : state.weapon === 'light' ? '−1' : '0';
      const equipment = `
        <div class="inventory-equipment-card">
          <div class="inventory-equipment-title">Équipement actuel</div>
          <div class="inventory-equipment-row"><span>Arme équipée</span><strong>${weaponLabel(state)}</strong></div>
          <div class="inventory-equipment-row"><span>Effet de l’arme</span><strong>DEX ${weaponDex} · Puissance ${state.weapon === 'none' ? 0 : combatPower(state)}</strong></div>
          <div class="inventory-equipment-row"><span>Protection restante</span><strong>${currentProtection(state)} / ${maxProtection(state)}</strong></div>
        </div>`;
      const healing = Number.isInteger(state.lastHealingDie)
        ? `<div class="dice-result"><p class="roll-number">Dernière potion</p><div class="dice-faces">${renderDie(state.lastHealingDie)}</div><p><strong>+${state.lastHealingDie} point${state.lastHealingDie > 1 ? 's' : ''} de Vie</strong></p><p>Vie : <strong>${state.hp} / ${state.maxHp}</strong></p></div>`
        : '';
      return equipment + healing;
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
      if (id === 'ampoule_blanche') {
        const useful = ((state.dexPenalty || 0) > 0 || state.flags.blackEarthContamination);
        return `<div class="inventory-actions"><button class="inventory-action-btn" data-action="use-white-ampoule" ${useful ? '' : 'disabled'}>Utiliser l’Ampoule blanche</button></div>`;
      }
      if (PROTECTION_ITEMS[id]) {
        ensureProtectionState(state);
        const source = state.protectionItems[id] || { remaining: 0, max: PROTECTION_ITEMS[id].max };
        const broken = source.remaining <= 0;
        return `<div class="inventory-protection-state">Protection restante : <strong>${source.remaining} / ${source.max}</strong>${broken ? '<br><strong>État : endommagé — désormais inutilisable.</strong>' : ''}</div>`;
      }
      return '';
    },

    handleAction(action, state, api) {
      if (action.startsWith('test-toggle-item:')) {
        const id = action.slice('test-toggle-item:'.length);
        const entry = TEST_ITEM_CATALOG.find(item => item.id === id);
        if (entry) {
          setTestItem(state, entry, !testItemOwned(state, entry));
          api.saveState();
          api.render();
          api.openInventory();
        }
        return true;
      }

      if (action.startsWith('test-equip-weapon:')) {
        const weapon = action.slice('test-equip-weapon:'.length);
        if (['none', 'heavy', 'light'].includes(weapon)) {
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
          <div class="parchment-verse"><em>ne pas ouvrir l’œil</em><br><br><s><strong>soufre</strong></s><br><small>barré plusieurs fois, avec une tête de mort dessinée à côté</small><br><br><em>lame noire</em><br><br><em>derrière la paroi</em><br><em>terre noire</em><br><em>ne pas écouter</em><br><em>surtout ne pas—</em></div>
          <button class="inventory-action-btn" data-action="back-inventory">Retour à l’inventaire</button>`);
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

      if (action === 'use-white-ampoule') {
        if (!hasItem(state, 'ampoule_blanche') || !((state.dexPenalty || 0) > 0 || state.flags.blackEarthContamination)) {
          api.openInventory();
          return true;
        }
        removeItem(state, 'ampoule_blanche');
        if ((state.dexPenalty || 0) > 0) state.dexPenalty = Math.max(0, state.dexPenalty - 1);
        state.flags.blackEarthContamination = false;
        state.flags.usedWhiteAmpoule = true;
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
          <div><span>Chance</span><strong>${state.chance}</strong></div>
          <div><span>Force</span><strong>${force}</strong></div>
          <div><span>Dextérité</span><strong>${dexterity}</strong></div>
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
    contentVersion: 23,
    saveVersion: 18, // Ancien identifiant V40 : migration uniquement. Ne plus l'incrémenter pour une publication.
    stablePlayerSaves: true,
    playerRelease: true,
    assetBase: './books/ecuyer/01-la-grotte-de-valombre/images',
    story: STORY,
    pageOrder: PAGE_ORDER,
    pageByNode: PAGE_BY_NODE,
    padPage,
    imageBaseForPage: n => `La-Grotte-de-Valombre-${padPage(n)}`,
    imageExtensions: ['png'],
    createInitialState,
    rules: { currentForce, currentDexterity, combatPower, weaponLabel, currentProtection, maxProtection, applyDamage },
    characterSheetHtml,
    inventory,
    checkpoints: [
      { node: 'c20', label: 'Entrée de la grotte', onlyIfNone: true }
    ],
    // Migration automatique des parties V40 (ancienne clé versionnée).
    // Ne pas supprimer ces références dans les prochaines versions : un
    // joueur peut passer directement de V40 à V45 sans installer les étapes.
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
