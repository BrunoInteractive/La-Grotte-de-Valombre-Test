/* Moteur commun de la collection — aucune donnée narrative propre à Valombre. */
(function () {
  'use strict';

  const books = new Map();
  window.BookRegistry = {
    register(book) {
      if (!book || !book.id) throw new Error('Un livre doit posséder un identifiant.');
      books.set(book.id, book);
      return book;
    },
    get(id) { return books.get(id); },
    list() { return Array.from(books.values()); }
  };

  window.GameRuntime = {
    activeBook: null,
    setActiveBook(book) { this.activeBook = book; }
  };
})();

function addItem(state, id, name, description, extra = {}) {
  if (!state.inventory[id]) state.inventory[id] = { name, description, ...extra };
}
function removeItem(state, id) { delete state.inventory[id]; }
function hasItem(state, id) { return !!state.inventory[id]; }

function cryptoDie(sides = 6) {
  const faces = Math.max(2, Math.floor(Number(sides) || 6));
  if (window.crypto && window.crypto.getRandomValues) {
    const buffer = new Uint32Array(1);
    const range = 4294967296;
    const limit = range - (range % faces);
    let value;
    do {
      window.crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return (value % faces) + 1;
  }
  return Math.floor(Math.random() * faces) + 1;
}

function cryptoDie6() { return cryptoDie(6); }

function roll3D6(state, statName, statValue) {
  const dice = [cryptoDie6(), cryptoDie6(), cryptoDie6()];
  state.rollCount = (state.rollCount || 0) + 1;
  state.lastDice = dice;
  state.lastTotal = dice.reduce((a, b) => a + b, 0);
  state.lastStatName = statName;
  state.lastStat = statValue;
  return state.lastTotal <= statValue;
}

function ensureDamageRolls(state) {
  if (!state.damageRolls || typeof state.damageRolls !== 'object') state.damageRolls = {};
}
function hasDamageRoll(state, key) {
  ensureDamageRolls(state);
  return Number.isInteger(state.damageRolls[key]);
}
function rollDamage(state, key, sides = 6) {
  ensureDamageRolls(state);
  if (hasDamageRoll(state, key)) return state.damageRolls[key];
  const faces = Math.max(2, Math.floor(Number(sides) || 6));
  const damage = cryptoDie(faces);
  state.damageRolls[key] = damage;
  if (!state.damageRollSides || typeof state.damageRollSides !== 'object') state.damageRollSides = {};
  state.damageRollSides[key] = faces;
  state.lastDamageDie = damage;
  state.lastDamageSides = faces;
  state.lastDamageKey = key;
  if (!state.damageRollResults || typeof state.damageRollResults !== 'object') state.damageRollResults = {};
  const book = window.GameRuntime && GameRuntime.activeBook;
  const resolver = book && book.rules && typeof book.rules.applyDamage === 'function'
    ? book.rules.applyDamage
    : null;
  const resolution = resolver
    ? resolver(state, damage)
    : { incoming: damage, absorbed: 0, hpLost: damage, heroHp: Math.max(0, state.hp - damage) };
  if (!resolver) state.hp = resolution.heroHp;
  state.damageRollResults[key] = resolution;
  return damage;
}

function renderDie(value) {
  const layouts = {1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
  const active = new Set(layouts[value] || []);
  let cells = '';
  for (let i = 1; i <= 9; i++) cells += `<span class="die-cell">${active.has(i) ? '<i></i>' : ''}</span>`;
  return `<span class="die-visual" aria-label="Dé : ${value}">${cells}</span>`;
}

function damageResultHtml(state, key) {
  ensureDamageRolls(state);
  const damage = state.damageRolls[key];
  if (!Number.isInteger(damage)) {
    return `<div class="dice-result"><p><strong>Tu es blessé.</strong></p><p>Lance un dé pour déterminer la gravité de la blessure.</p></div>`;
  }
  const resolution = state.damageRollResults && state.damageRollResults[key]
    ? state.damageRollResults[key]
    : { absorbed: 0, hpLost: damage };
  const loss = Number.isFinite(resolution.hpLost) ? resolution.hpLost : damage;
  const protectionLine = resolution.absorbed > 0
    ? `<p><strong>Ta protection a absorbé ${resolution.absorbed} point${resolution.absorbed > 1 ? 's' : ''}.</strong>${loss > 0 ? ` Tu as perdu ${loss} point${loss > 1 ? 's' : ''} de Vie.` : ' Tu n’as perdu aucun point de Vie.'}</p>`
    : `<p><strong>Tu as perdu ${loss} point${loss > 1 ? 's' : ''} de Vie.</strong></p>`;
  const fatal = state.hp <= 0 ? `<p><strong>Ta Vie tombe à 0.</strong></p>` : '';
  const sides = state.damageRollSides && Number.isInteger(state.damageRollSides[key]) ? state.damageRollSides[key] : 6;
  const dieLabel = sides === 6 ? 'Dé de blessure' : `Dé de blessure à ${sides} faces`;
  return `<div class="dice-result"><p class="roll-number">${dieLabel}</p><div class="dice-faces">${renderDie(damage)}</div><p><strong>Résultat : ${damage}</strong></p>${protectionLine}<p>Vie : <strong>${state.hp} / ${state.maxHp}</strong></p>${fatal}</div>`;
}

function fatalChoices() {
  return [
    { label: 'Reprendre au dernier point de sauvegarde', action: 'checkpoint' },
    { label: 'Recommencer depuis le début', action: 'restart' }
  ];
}

function diceResultHtml(state) {
  if (!state.lastDice) return '';
  const [d1,d2,d3] = state.lastDice;
  return `<div class="dice-result"><p class="roll-number">Jet n° ${state.rollCount || 1}</p><div class="dice-faces">${renderDie(d1)}${renderDie(d2)}${renderDie(d3)}</div><p class="dice-values">Dé 1 : <strong>${d1}</strong> &nbsp;·&nbsp; Dé 2 : <strong>${d2}</strong> &nbsp;·&nbsp; Dé 3 : <strong>${d3}</strong></p><p><strong>Total : ${state.lastTotal}</strong></p><p><strong>${state.lastStatName} : ${state.lastStat}</strong></p></div>`;
}

function escapeHtml(value) {
  return String(value || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

function activeRules() {
  const book = window.GameRuntime && GameRuntime.activeBook;
  if (!book || !book.rules) throw new Error('Aucun livre actif ou règles absentes.');
  return book.rules;
}
function currentForce(state) { return activeRules().currentForce(state); }
function currentDexterity(state) { return activeRules().currentDexterity(state); }
function combatPower(state) { return activeRules().combatPower(state); }
function weaponLabel(state) { return activeRules().weaponLabel(state); }
