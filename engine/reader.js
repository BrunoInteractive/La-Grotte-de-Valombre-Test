/* Lecteur commun de la collection. Il charge un livre enregistré dans BookRegistry. */
(function () {
'use strict';

const catalog = window.COLLECTION_CATALOG;
const BOOK = BookRegistry.get(catalog.defaultBookId);
if (!BOOK) throw new Error(`Livre introuvable : ${catalog.defaultBookId}`);
GameRuntime.setActiveBook(BOOK);

const STORY = BOOK.story;
const PAGE_BY_NODE = BOOK.pageByNode;
const padPage = BOOK.padPage;
const STORAGE_KEY = `ldveh.book.${BOOK.id}.save.v${BOOK.saveVersion || 1}`;
const CHECKPOINT_KEY = `ldveh.book.${BOOK.id}.checkpoint.v${BOOK.saveVersion || 1}`;
const SERIES_KEY = `ldveh.series.${BOOK.seriesId}.profile.v2`;

const chapterNumber = document.getElementById('chapterNumber');
const chapterTitle = document.getElementById('chapterTitle');
const storyText = document.getElementById('storyText');
const choices = document.getElementById('choices');
const storyImage = document.getElementById('storyImage');
const imageFrame = document.getElementById('imageFrame');
const imagePlaceholder = document.getElementById('imagePlaceholder');
const imageLabel = document.getElementById('imageLabel');
const statusTags = document.getElementById('statusTags');
const inventoryCount = document.getElementById('inventoryCount');
const inventoryBtn = document.getElementById('inventoryBtn');
const characterBtn = document.getElementById('characterBtn');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.getElementById('menuBtn');
const drawer = document.getElementById('drawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const pageNavList = document.getElementById('pageNavList');
const modalBackdrop = document.getElementById('modalBackdrop');
const modal = document.getElementById('modal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');
const journalBtn = document.getElementById('journalBtn');
const journalPanel = document.getElementById('journalPanel');
const journalCloseBtn = document.getElementById('journalCloseBtn');
const journalText = document.getElementById('journalText');
const journalStatus = document.getElementById('journalStatus');
const bookTitle = document.getElementById('bookTitle');
const bookEyebrow = document.getElementById('bookEyebrow');

bookTitle.textContent = BOOK.title;
bookEyebrow.textContent = `${BOOK.seriesLabel || ''}${BOOK.seriesLabel ? ' · ' : ''}LIVRE-JEU INTERACTIF`;
document.title = `${BOOK.title} — Livre-jeu`;

function defaultSeriesProfile() {
  return {
    version: 2,
    seriesId: BOOK.seriesId,
    heroGender: 'female',
    heroName: 'Aélis',
    baseStats: { maxHp: 18, chance: 12, force: 8, dexterity: 13 },
    memory: {},
    completedBooks: []
  };
}

function loadSeriesProfile() {
  try {
    const saved = localStorage.getItem(SERIES_KEY);
    return saved ? { ...defaultSeriesProfile(), ...JSON.parse(saved) } : defaultSeriesProfile();
  } catch { return defaultSeriesProfile(); }
}
let seriesProfile = loadSeriesProfile();

function defaultState() { return BOOK.createInitialState(seriesProfile); }

function migrateLegacySaveIfNeeded() {
  try {
    if (!localStorage.getItem(STORAGE_KEY)) {
      for (const key of (BOOK.legacyStorageKeys || [])) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          localStorage.setItem(STORAGE_KEY, legacy);
          break;
        }
      }
    }
    if (!localStorage.getItem(CHECKPOINT_KEY)) {
      for (const key of (BOOK.legacyCheckpointKeys || [])) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          localStorage.setItem(CHECKPOINT_KEY, legacy);
          break;
        }
      }
    }
  } catch (e) {}
}
migrateLegacySaveIfNeeded();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultState(), ...JSON.parse(saved) } : defaultState();
  } catch { return defaultState(); }
}
let state = loadState();

function saveSeriesProfile() {
  try { localStorage.setItem(SERIES_KEY, JSON.stringify(seriesProfile)); } catch (e) {}
}
function syncSeriesFromState() {
  seriesProfile.heroGender = state.heroGender === 'male' ? 'male' : 'female';
  seriesProfile.heroName = state.heroName || (seriesProfile.heroGender === 'male' ? 'Aubin' : 'Aélis');
  seriesProfile.baseStats = {
    maxHp: state.maxHp || seriesProfile.baseStats.maxHp,
    chance: state.chance || seriesProfile.baseStats.chance,
    force: state.baseForce || seriesProfile.baseStats.force,
    dexterity: state.baseDexterity || seriesProfile.baseStats.dexterity
  };
  if (typeof BOOK.exportSeriesMemory === 'function') {
    seriesProfile.memory = { ...seriesProfile.memory, ...BOOK.exportSeriesMemory(state) };
  }
  saveSeriesProfile();
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  syncSeriesFromState();
}

function setCheckpoint(targetState, label) {
  targetState.currentCheckpoint = label;
  try { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(targetState)); } catch (e) {}
}
window.setCheckpoint = setCheckpoint;

function hasCheckpoint() {
  try { return !!localStorage.getItem(CHECKPOINT_KEY); } catch (e) { return false; }
}

function restartFromCheckpoint() {
  try {
    const saved = localStorage.getItem(CHECKPOINT_KEY);
    if (!saved) return restartGame();
    const journalBackup = state.journal || '';
    state = { ...defaultState(), ...JSON.parse(saved) };
    state.journal = journalBackup || state.journal || '';
    saveState(); closeDrawer(); closeModal(); closeJournal(); render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) { restartGame(); }
}

function maybeAutoCheckpoint(id) {
  const config = (BOOK.checkpoints || []).find(cp => cp.node === id);
  if (!config) return;
  if (config.onlyIfNone && hasCheckpoint()) return;
  setCheckpoint(state, config.label);
}

function enterNode(id) {
  const node = STORY[id];
  if (!node) return;
  state.node = id;
  if (!state.visited[id]) {
    state.visited[id] = true;
    if (typeof node.onEnter === 'function') node.onEnter(state);
  }
  state.history.push(id);
  maybeAutoCheckpoint(id);
  saveState(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadPageImage(pageNumber, title) {
  const base = BOOK.imageBaseForPage(pageNumber);
  imageLabel.textContent = base;
  storyImage.classList.add('hidden');
  imagePlaceholder.style.display = 'grid';
  storyImage.alt = title ? `Illustration — ${title}` : `Illustration page ${padPage(pageNumber)}`;
  let index = 0;
  const extensions = BOOK.imageExtensions || ['webp','png','jpg','jpeg'];
  const tryNext = () => {
    if (index >= extensions.length) {
      storyImage.removeAttribute('src'); storyImage.classList.add('hidden'); imagePlaceholder.style.display = 'grid'; return;
    }
    const ext = extensions[index++];
    storyImage.onload = () => { storyImage.classList.remove('hidden'); imagePlaceholder.style.display = 'none'; };
    storyImage.onerror = tryNext;
    storyImage.src = `${BOOK.assetBase}/${base}.${ext}`;
  };
  tryNext();
}

function ensureJournal() { if (typeof state.journal !== 'string') state.journal = ''; }
let journalTimer = null;
function saveJournalNow() { ensureJournal(); state.journal = journalText.value; saveState(); journalStatus.textContent = 'Sauvegardé'; }
function openJournal() { ensureJournal(); journalText.value = state.journal; journalPanel.classList.remove('hidden'); journalPanel.setAttribute('aria-hidden','false'); }
function closeJournal() { if (!journalPanel.classList.contains('hidden')) saveJournalNow(); journalPanel.classList.add('hidden'); journalPanel.setAttribute('aria-hidden','true'); }
function scheduleJournalSave() { journalStatus.textContent = 'Sauvegarde…'; clearTimeout(journalTimer); journalTimer = setTimeout(saveJournalNow, 250); }
journalText.addEventListener('input', scheduleJournalSave);

function render() {
  const node = STORY[state.node] || STORY.start;
  if (node.sheet) {
    chapterNumber.textContent = 'FICHE DU HÉROS';
    imageFrame.classList.add('hidden');
  } else {
    const mappedPage = PAGE_BY_NODE[state.node];
    const declaredPage = node.number ? parseInt(String(node.number).replace(/\D/g, ''), 10) : NaN;
    const pageNumber = mappedPage || (Number.isFinite(declaredPage) ? declaredPage : 1);
    chapterNumber.textContent = `PAGE ${padPage(pageNumber)}`;
    if (node.noImage) {
      imageFrame.classList.add('hidden');
      storyImage.removeAttribute('src');
      storyImage.classList.add('hidden');
    } else {
      imageFrame.classList.remove('hidden');
      loadPageImage(pageNumber, node.title || '');
    }
  }
  chapterTitle.textContent = node.title || '';
  storyText.innerHTML = typeof node.text === 'function' ? node.text(state) : node.text;

  document.querySelectorAll('.hero-gender-input').forEach(input => {
    input.addEventListener('change', event => {
      state.heroGender = event.target.value === 'male' ? 'male' : 'female';
      state.heroName = state.heroGender === 'male' ? 'Aubin' : 'Aélis';
      saveState();
      render();
    });
  });

  inventoryCount.textContent = Object.keys(state.inventory).length;
  statusTags.innerHTML = '';
  if (!node.sheet) {
    const protection = BOOK.rules && typeof BOOK.rules.currentProtection === 'function' ? BOOK.rules.currentProtection(state) : 0;
    const labels = [`♥ ${state.hp}/${state.maxHp}`, `🛡 ${protection}`, `Chance ${state.chance}`, `Force ${currentForce(state)}`, `Dextérité ${currentDexterity(state)}`, `Puissance de l’arme ${state.weapon === 'none' ? 0 : combatPower(state)}`];
    if (state.silver > 0) labels.push(`${state.silver} argent`);
    if (state.goldCoins > 0) labels.push(`${state.goldCoins} or`);
    labels.forEach(label => { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = label; statusTags.appendChild(tag); });
  }

  const availableChoices = typeof node.choices === 'function' ? node.choices(state) : (node.choices || []);
  choices.innerHTML = '';
  availableChoices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    const destinationPage = choice.stay ? null : PAGE_BY_NODE[choice.to];
    const destination = destinationPage ? `<span class="choice-dest">Rendez-vous à la page ${padPage(destinationPage)}</span>` : '';
    btn.innerHTML = `<span class="choice-index">${i + 1}</span><span class="choice-copy"><span>${choice.label}</span>${destination}</span>`;
    btn.addEventListener('click', () => {
      if (choice.action === 'checkpoint') return restartFromCheckpoint();
      if (choice.action === 'restart') return restartGame();
      if (choice.action === 'damage') { rollDamage(state, choice.damageKey || state.node, choice.damageSides || 6); saveState(); render(); return; }
      if (typeof choice.effect === 'function') choice.effect(state);
      if (choice.stay) { saveState(); render(); return; }
      enterNode(choice.to);
    });
    choices.appendChild(btn);
  });
}

function restartGame() {
  state = defaultState();
  try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(CHECKPOINT_KEY); } catch (e) {}
  saveState(); closeDrawer(); closeModal(); closeJournal(); render();
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0,0); }
}

function showModal(title, html) {
  modalTitle.textContent = title;
  modalContent.innerHTML = html;
  modal.classList.remove('hidden');
  modalBackdrop.classList.remove('hidden');
}

function openCharacterSheet() {
  const html = typeof BOOK.characterSheetHtml === 'function'
    ? BOOK.characterSheetHtml(state)
    : '<p>Fiche indisponible.</p>';
  showModal('Fiche perso', html);
}

function openInventory() {
  modalTitle.textContent = 'Inventaire';
  const items = Object.entries(state.inventory);
  const topText = BOOK.inventory && BOOK.inventory.topLine ? BOOK.inventory.topLine(state) : '';
  const moneyLine = topText ? `<div class="inventory-topline">${topText}</div>` : '';
  const extraLine = BOOK.inventory && BOOK.inventory.extraHtml ? BOOK.inventory.extraHtml(state) : '';
  const list = items.length
    ? `<div class="inventory-owned-section"><div class="inventory-owned-title">Objets</div><div class="inventory-list">${items.map(([id,item]) => {
        const action = BOOK.inventory && BOOK.inventory.actionHtml ? BOOK.inventory.actionHtml(id,item,state) : '';
        return `<div class="inventory-item"><strong>${item.name}${item.quantity ? ` × ${item.quantity}` : ''}</strong><p>${item.description}</p>${action}</div>`;
      }).join('')}</div></div>`
    : `<div class="inventory-empty">Ton inventaire est vide.</div>`;
  modalContent.innerHTML = moneyLine + extraLine + list;
  modal.classList.remove('hidden'); modalBackdrop.classList.remove('hidden');
}

function closeModal() { modal.classList.add('hidden'); modalBackdrop.classList.add('hidden'); }

function pageNavigationEntries() {
  return Object.entries(PAGE_BY_NODE)
    .map(([nodeId, pageNumber]) => ({
      nodeId,
      pageNumber,
      title: (STORY[nodeId] && STORY[nodeId].title) ? STORY[nodeId].title : `Page ${padPage(pageNumber)}`
    }))
    .sort((a, b) => a.pageNumber - b.pageNumber);
}

function renderPageNavigation() {
  if (!pageNavList) return;
  const entries = pageNavigationEntries();
  pageNavList.innerHTML = '';
  entries.forEach(entry => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `page-nav-btn${state.node === entry.nodeId ? ' current' : ''}`;
    btn.dataset.node = entry.nodeId;
    btn.innerHTML = `<span class="page-nav-number">${padPage(entry.pageNumber)}</span><span class="page-nav-title"></span>`;
    btn.querySelector('.page-nav-title').textContent = entry.title;
    btn.addEventListener('click', () => jumpToPageForTest(entry.nodeId));
    pageNavList.appendChild(btn);
  });
}

function jumpToPageForTest(nodeId) {
  if (!STORY[nodeId] || !PAGE_BY_NODE[nodeId]) return;
  // Outil de test : on change uniquement la page courante.
  // Aucun effet de choix/onEnter/checkpoint antérieur n'est déclenché automatiquement.
  state.node = nodeId;
  state.history.push(nodeId);
  saveState();
  closeDrawer();
  render();
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0,0); }
}

function openDrawer() {
  renderPageNavigation();
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden','false');
  drawerBackdrop.classList.remove('hidden');
  requestAnimationFrame(() => {
    const current = pageNavList && pageNavList.querySelector('.page-nav-btn.current');
    if (current) current.scrollIntoView({ block: 'center' });
  });
}
function closeDrawer() {
  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
  }
  if (drawerBackdrop) drawerBackdrop.classList.add('hidden');
}

const bookApi = { book: BOOK, saveState, render, openInventory, showModal, closeModal };
modalContent.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'back-inventory') return openInventory();
  if (BOOK.inventory && typeof BOOK.inventory.handleAction === 'function') BOOK.inventory.handleAction(action, state, bookApi);
});

inventoryBtn.addEventListener('click', openInventory);
characterBtn.addEventListener('click', openCharacterSheet);
journalBtn.addEventListener('click', openJournal);
journalCloseBtn.addEventListener('click', closeJournal);
restartBtn.addEventListener('click', restartGame);
if (menuBtn) menuBtn.addEventListener('click', openDrawer);
if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);
closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); closeModal(); closeJournal(); } });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
render();
})();
