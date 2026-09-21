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
const STORAGE_KEY = `ldveh.book.${BOOK.id}.${BOOK.saveScope ? BOOK.saveScope + '.' : ''}save.v${BOOK.saveVersion || 1}`;
const CHECKPOINT_KEY = `ldveh.book.${BOOK.id}.${BOOK.saveScope ? BOOK.saveScope + '.' : ''}checkpoint.v${BOOK.saveVersion || 1}`;
const SERIES_KEY = `ldveh.series.${BOOK.seriesId}.${BOOK.saveScope ? BOOK.saveScope + '.' : ''}profile.v2`;

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
    baseStats: { maxHp: 18, force: 8, dexterity: 13 },
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
    if (!saved) return defaultState();
    const previous = JSON.parse(saved);
    if (typeof BOOK.migrateState === 'function' && previous.pageMapVersion !== (BOOK.pageMapVersion || 58)) {
      try {
        if (!localStorage.getItem(`${STORAGE_KEY}.backup-v68`)) localStorage.setItem(`${STORAGE_KEY}.backup-v68`, saved);
      } catch (e) {}
      BOOK.migrateState(previous);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(previous));
    }
    return { ...defaultState(), ...previous };
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
    const previous = JSON.parse(saved);
    if (typeof BOOK.migrateState === 'function' && previous.pageMapVersion !== (BOOK.pageMapVersion || 58)) {
      try {
        if (!localStorage.getItem(`${CHECKPOINT_KEY}.backup-v68`)) localStorage.setItem(`${CHECKPOINT_KEY}.backup-v68`, saved);
      } catch (e) {}
      BOOK.migrateState(previous);
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(previous));
    }
    state = { ...defaultState(), ...previous };
    if (BOOK.demoEndNode && state.node === BOOK.demoEndNode) state.node = 'start';
    if (typeof atlasMemory !== 'undefined') {atlasMemory.lastShown=''; atlasSaveMemory();}
    state.journal = journalBackup || state.journal || '';
    saveState(); closeDrawer(); closeModal(); closeAtlas(); render();
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
  if (!node || (BOOK.demoEndNode && state.node === BOOK.demoEndNode)) return;
  state.node = id;
  if (!state.visited[id]) {
    state.visited[id] = true;
    if (typeof node.onEnter === 'function') node.onEnter(state);
  } else if (id === 'c115' && state.flags?.knightFate === 'locked' &&
             !state.flags.knightWellAttackDone && typeof node.onEnter === 'function') {
    // Travail uniquement : une nouvelle décision lors d'un essai relance
    // la conséquence différée du chevalier, même si ce palier était déjà visité.
    node.onEnter(state);
  }
  state.history.push(id);
  maybeAutoCheckpoint(id);
  saveState(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

let pageImageLoadToken = 0;
function loadPageImage(pageNumber, title) {
  const token = ++pageImageLoadToken;
  const base = BOOK.imageBaseForPage(pageNumber);
  const candidates = typeof BOOK.imageCandidatesForPage === 'function'
    ? BOOK.imageCandidatesForPage(pageNumber)
    : [base];
  imageLabel.textContent = candidates[0]?.split('/').pop() || base;
  storyImage.classList.add('hidden');
  imagePlaceholder.style.display = 'grid';
  storyImage.alt = title ? `Illustration — ${title}` : `Illustration page ${padPage(pageNumber)}`;
  const extensions = BOOK.imageExtensions || ['webp','png','jpg','jpeg'];
  const attempts = candidates.flatMap(candidate => extensions.map(ext => `${BOOK.assetBase}/${candidate}.${ext}`));
  let index = 0;
  const tryNext = () => {
    if (token !== pageImageLoadToken) return;
    if (index >= attempts.length) {
      // En Travail, distinguer visuellement une illustration manquante
      // d'une illustration que Bruno a explicitement demandé de masquer.
      // Pour les Joueurs, conserver l'ancien comportement discret.
      storyImage.removeAttribute('src');
      storyImage.classList.add('hidden');
      if (BOOK.showMissingIllustrationPlaceholder) {
        imageFrame.classList.remove('hidden');
        imagePlaceholder.style.display = 'grid';
      } else {
        imagePlaceholder.style.display = 'none';
        imageFrame.classList.add('hidden');
      }
      return;
    }
    storyImage.onload = () => {
      if (token !== pageImageLoadToken) return;
      storyImage.classList.remove('hidden');
      imagePlaceholder.style.display = 'none';
    };
    storyImage.onerror = tryNext;
    storyImage.src = attempts[index++];
  };
  tryNext();
}

/* Carte narrative V62. Sauvegarde indépendante pour garder les découvertes entre les essais. */
const ATLAS = BOOK.adventureMap;
const ATLAS_KEY = `ldveh.book.${BOOK.id}.${BOOK.saveScope ? BOOK.saveScope + '.' : ''}atlas.v1`;
const atlasDetails = document.getElementById('atlasDetails');
const atlasPoints = document.getElementById('atlasPoints');
const atlasLines = document.getElementById('atlasLines');
const atlasCanvas = document.getElementById('atlasCanvas');
const atlasScroller = document.getElementById('atlasScroller');
const atlasNodes = new Map((ATLAS?.nodes || []).map(node => [node.id, node]));
const atlasPageAreas = new Map();
for (const area of (ATLAS?.nodes || [])) for (const page of area.pages) atlasPageAreas.set(page, area.id);
const atlasKnownEdges = new Set((ATLAS?.edges || []).map(([a,b]) => [a,b].sort().join('|')));
function atlasEdgeKey(a,b) { return [a,b].sort().join('|'); }
function atlasDefaultMemory() {return {version:3,pageMapVersion:71,visited:[],facts:[],edges:[],deaths:[],lastShown:''};}
function atlasLoadMemory() {
  try {
    const saved = JSON.parse(localStorage.getItem(ATLAS_KEY));
    if (!saved || typeof saved !== 'object') return atlasDefaultMemory();
    const initial = atlasDefaultMemory();
    for (const key of ['visited','facts','edges','deaths']) {
      initial[key] = Array.isArray(saved[key]) ? saved[key].filter(value => typeof value === 'string') : [];
    }
    initial.lastShown = typeof saved.lastShown === 'string' ? saved.lastShown : '';
    // V62: migrate saved discovery keys and death markers along with the page numbers.
    if (Number(saved.pageMapVersion || 0) < 62 && ATLAS?.mode === 'work') {
      const map={c114:'c105',c115:'c106',c116:'c107',c105:'c108',c106:'c109',
                 c107:'c110',c108:'c111',c109:'c112',c110:'c113',c111:'c114',
                 c112:'c115',c113:'c116'};
      const rename=id=>map[id]||id;
      initial.facts=initial.facts.map(key=>{
        const at=key.lastIndexOf(':');
        return at < 0 ? key : key.slice(0,at+1)+rename(key.slice(at+1));
      });
      initial.deaths=initial.deaths.map(rename);
    }
    if (ATLAS?.mode === 'work' && Number(saved.pageMapVersion || 0) < 63) {
      initial.facts=initial.facts.filter(key => !key.startsWith('observation:') && !key.startsWith('cahiers:'));
      initial.lastShown='';
    }
    if (ATLAS?.mode === 'work' && Number(saved.pageMapVersion || 0) < 68) {
      const renumber={c106:'c107',c107:'c108',c108:'c109'};
      initial.facts=initial.facts.map(key=>{
        const at=key.lastIndexOf(':');
        if (at<0) return key;
        const page=key.slice(at+1);
        return key.slice(0,at+1)+(renumber[page]||page);
      });
      initial.deaths=initial.deaths.map(page=>renumber[page]||page);
      initial.lastShown='';
    }
    if (ATLAS?.mode === 'work' && Number(saved.pageMapVersion || 0) < 69) {
      const renumber={c117:'c111',c111:'c112',c112:'c113',c113:'c114',c114:'c115',c115:'c116',c116:'c117'};
      initial.facts=initial.facts.map(key=>{
        const at=key.lastIndexOf(':');
        if (at<0) return key;
        const page=key.slice(at+1);
        return key.slice(0,at+1)+(renumber[page]||page);
      });
      initial.deaths=initial.deaths.map(page=>renumber[page]||page);
      initial.lastShown='';
    }
    if (ATLAS?.mode === 'work' && Number(saved.pageMapVersion || 0) < 71) {
      initial.facts = initial.facts.filter(key => !key.startsWith('observation:') && !key.startsWith('cahiers:'));
      initial.lastShown = '';
    }
    initial.pageMapVersion=ATLAS?.mode === 'work' ? 71 : 59;
    return initial;
  } catch {return atlasDefaultMemory();}
}
let atlasMemory = atlasLoadMemory();
function atlasSaveMemory() {try {localStorage.setItem(ATLAS_KEY, JSON.stringify(atlasMemory));} catch (e) {}}
function atlasRoute() {
  const sequence = Array.isArray(state.history) ? state.history.slice() : [];
  if (state.node && !sequence.includes(state.node)) sequence.push(state.node);
  const areas = [];
  for (const page of sequence) {
    const area = atlasPageAreas.get(page);
    if (area && areas[areas.length-1] !== area) areas.push(area);
  }
  return areas;
}
function atlasSync() {
  if (!ATLAS) return false;
  let changed = false;
  const discovered = new Set(atlasMemory.visited);
  const facts = new Set(atlasMemory.facts);
  const edges = new Set(atlasMemory.edges);
  const deathPages = new Set(atlasMemory.deaths);
  const sequence = Array.isArray(state.history) ? state.history.slice() : [];
  if (state.node && !sequence.includes(state.node) && state.node !== 'start') sequence.push(state.node);
  let lastArea = '';
  for (const page of sequence) {
    const area = atlasPageAreas.get(page);
    if (!area) {lastArea='';continue;}
    if (!discovered.has(area)) {discovered.add(area);changed=true;}
    const info = atlasNodes.get(area);
    for (const note of (info.notes || [])) {
      const key = `${area}:${note.page}`;
      if (note.page === page && (!note.requiresFlag || !!state.flags?.[note.requiresFlag]) && !facts.has(key)) {facts.add(key);changed=true;}
    }
    if (lastArea && lastArea !== area) {
      const key = atlasEdgeKey(lastArea,area);
      // Un saut du menu de test ne doit jamais inventer une nouvelle branche.
      if (atlasKnownEdges.has(key) && !edges.has(key)) {edges.add(key);changed=true;}
    }
    lastArea = area;
  }
  const isDead = (ATLAS.deathPages || []).includes(state.node) || state.hp <= 0 || !!state.flags?.blackEarthTransformed;
  if (isDead && atlasPageAreas.has(state.node) && !deathPages.has(state.node)) {
    deathPages.add(state.node);changed=true;
  }
  if (changed) {
    atlasMemory.visited=[...discovered];atlasMemory.facts=[...facts];atlasMemory.edges=[...edges];atlasMemory.deaths=[...deathPages];atlasSaveMemory();
  }
  // La dernière page publiée est un bilan d'étape, pas la fin du livre.
  const isEnding = (ATLAS.endingPages || []).includes(state.node) && state.hp > 0;
  if (!isDead && !isEnding) return false;
  const token = `${state.node}:${(state.history || []).length}:${isDead ? 'mort' : 'étape'}`;
  if (atlasMemory.lastShown === token) return false;
  atlasMemory.lastShown=token;atlasSaveMemory();
  return true;
}
function atlasSvgPath(start,end,stroke,dash,width) {
  const svgNS='http://www.w3.org/2000/svg';
  const line=document.createElementNS(svgNS,'path');
  line.setAttribute('d',`M ${start.x} ${start.y} L ${end.x} ${end.y}`);
  line.setAttribute('fill','none');line.setAttribute('stroke',stroke);
  line.setAttribute('stroke-width',String(width || 3));
  line.setAttribute('stroke-linecap','round');
  if (dash) line.setAttribute('stroke-dasharray',dash);
  atlasLines.appendChild(line);
}
function atlasStub(from,to) {
  const dx=to.x-from.x,dy=to.y-from.y;
  const length=Math.hypot(dx,dy)||1;
  const distance=Math.min(23,length*.39);
  atlasSvgPath(from,{x:from.x+dx/length*distance,y:from.y+dy/length*distance},'#907653','5 5',1);
}
function atlasShowDetails(area) {
  atlasDetails.replaceChildren();
  const heading=document.createElement('h4');heading.textContent=area.label;atlasDetails.appendChild(heading);
  const facts=area.notes.filter(note => ATLAS.mode === 'work' || atlasMemory.facts.includes(`${area.id}:${note.page}`));
  if (!facts.length) {
    const hint=document.createElement('p');hint.className='atlas-hint';hint.textContent='Aucune découverte narrative enregistrée dans ce lieu.';atlasDetails.appendChild(hint);
    return;
  }
  facts.forEach(note => {
    const item=document.createElement('div');item.className='atlas-fact';
    const text=document.createElement('p');text.textContent=note.text;item.appendChild(text);
    if (ATLAS.mode === 'work') {
      const page=document.createElement('small');page.textContent=`Page ${padPage(PAGE_BY_NODE[note.page] ?? Number(note.page.slice(1)))}`;item.appendChild(page);
    }
    atlasDetails.appendChild(item);
  });
}
// Mobile: remap both axes (not just CSS width). Labels retain their normal font size.
// The original scene graph, choices, memories and desktop positions remain untouched.
let atlasPositions = new Map();
function atlasLayout() {
  const available=atlasScroller.clientWidth;
  if (!available || window.innerWidth>620) {
    const width=Math.min(600,Math.max(280,(available||608)-8));
    const scale=width/ATLAS.width;
    return {width,height:ATLAS.height,positions:new Map(ATLAS.nodes.map(n=>[n.id,{x:Math.round(n.x*scale),y:n.y}]))};
  }
  const width=Math.min(400,Math.max(280,available-8));
  const rows=[];
  for (const node of [...ATLAS.nodes].sort((a,b)=>a.y-b.y || a.x-b.x)) {
    let row=rows[rows.length-1];
    if (!row || node.y-row.y>18) {row={y:node.y,nodes:[]};rows.push(row);}
    row.nodes.push(node);
  }
  const positions=new Map();
  rows.forEach((row,index)=>{
    // A single central choice stays on the centreline: straight vertical path.
    const group=row.nodes.slice().sort((a,b)=>a.x-b.x);
    const left=width/2;
    const factor=(width-80)/520;
    const xs=group.map(node=>group.length===1
      ?left : left+(node.x-340)*factor);
    for (let i=1;i<xs.length;i++) xs[i]=Math.max(xs[i],xs[i-1]+85);
    if (xs[xs.length-1]>width-42) {
      const excess=xs[xs.length-1]-(width-42);
      for(let i=0;i<xs.length;i++)xs[i]-=excess;
    }
    if(xs[0]<42) {
      const deficit=42-xs[0];
      for(let i=0;i<xs.length;i++)xs[i]+=deficit;
    }
    group.forEach((node,i)=>positions.set(node.id,{x:Math.round(xs[i]),y:36+index*46}));
  });
  return {width,height:36+Math.max(0,rows.length-1)*46+48,positions};
}
function atlasDraw() {
  if (!ATLAS) return;
  const layout=atlasLayout();
  atlasPositions=layout.positions;
  atlasCanvas.style.width=`${layout.width}px`;
  atlasCanvas.style.height=`${layout.height}px`;
  atlasLines.setAttribute('viewBox',`0 0 ${layout.width} ${layout.height}`);
  atlasLines.replaceChildren();atlasPoints.replaceChildren();
  const fullyVisible=ATLAS.mode === 'work';
  const seen=new Set(atlasMemory.visited);
  const walked=new Set(atlasMemory.edges);
  const route=atlasRoute();const currentEdges=new Set();
  for (let i=1;i<route.length;i++) currentEdges.add(atlasEdgeKey(route[i-1],route[i]));
  const visible=id => fullyVisible || seen.has(id);
  (ATLAS.edges || []).forEach(([a,b]) => {
    const first=atlasPositions.get(a),second=atlasPositions.get(b);
    if (!first || !second) return;
    const used=walked.has(atlasEdgeKey(a,b)),active=currentEdges.has(atlasEdgeKey(a,b));
    if (used && visible(a) && visible(b)) atlasSvgPath(first,second,active?'#795632':'#a58a62','',active?1.8:1.25);
    else if (fullyVisible) atlasSvgPath(first,second,'#baaa8b','4 6',.9);
    else {
      if (visible(a)) atlasStub(first,second);
      if (visible(b)) atlasStub(second,first);
    }
  });
  // Au terme de la version d'essai, les trois amorces visibles dans la scène
  // sont dessinées sans révéler les pages ou les noms des lieux à venir.
  if (ATLAS.mode === 'player' && seen.has('monde')) {
    const origin=atlasPositions.get('monde');
    for (const [dx,dy] of [[-80,55],[0,65],[80,55]]) {
      const length=Math.hypot(dx,dy);atlasSvgPath(origin,{x:origin.x+dx/length*31,y:origin.y+dy/length*31},'#907653','5 5',1);
    }
  }
  for (const area of ATLAS.nodes) {
    if (!visible(area.id)) continue;
    const notes=area.notes.filter(note => fullyVisible || atlasMemory.facts.includes(`${area.id}:${note.page}`));
    const clickable=notes.length>0;
    const el=document.createElement(clickable?'button':'div');
    if (clickable) {el.type='button';el.addEventListener('click',()=>atlasShowDetails(area));
      el.setAttribute('aria-label',`Découvertes : ${area.label}`);}
    el.className='atlas-location'+(clickable?' atlas-clickable':'')+(seen.has(area.id)?' atlas-discovered':'')+
      (atlasPageAreas.get(state.node)===area.id?' atlas-active':'');
    const position=atlasPositions.get(area.id);
    el.style.left=`${position.x}px`;el.style.top=`${position.y}px`;
    const dot=document.createElement('span');dot.className='atlas-dot';dot.setAttribute('aria-hidden','true');el.appendChild(dot);
    const label=document.createElement('span');label.className='atlas-name';label.textContent=area.label;el.appendChild(label);
    if (clickable){const clue=document.createElement('span');clue.className='atlas-clue';clue.textContent='◆';clue.setAttribute('aria-hidden','true');el.appendChild(clue);}
    if (area.pages.some(page=>atlasMemory.deaths.includes(page))){const cross=document.createElement('span');cross.className='atlas-death';cross.textContent='☠';cross.setAttribute('aria-label','Mort sur ce chemin');el.appendChild(cross);}
    atlasPoints.appendChild(el);
  }
  const hint=document.createElement('p');hint.className='atlas-hint';
  hint.textContent=fullyVisible ? 'Carte complète de travail. Les points ◆ ouvrent les indices et indiquent leurs pages. Cette carte ne modifie pas le parcours du héros.' : 'Les lieux et les découvertes s’ajoutent à mesure que tu avances. Les petits traits indiquent d’autres chemins possibles.';
  atlasDetails.replaceChildren(hint);
}
function openAtlas(summary=false) {
  if (!ATLAS) return;
  atlasSync();
  // Measure the actual mobile viewport after making the panel visible.
  journalPanel.classList.remove('hidden');journalPanel.setAttribute('aria-hidden','false');
  atlasDraw();
  if (summary) {
    const notice=document.createElement('p');notice.className='atlas-hint';
    notice.textContent=state.hp<=0 || state.flags?.blackEarthTransformed || (ATLAS.deathPages || []).includes(state.node)
      ? 'Ton aventure s’arrête ici. La carte conserve cette tentative et les chemins à explorer.'
      : ATLAS.mode==='player'?'Fin de cette étape de l’aventure. La suite n’est pas encore publiée.':'Bilan de ce parcours : les autres branches restent consultables.';
    atlasDetails.replaceChildren(notice);
  }
  const current=atlasPositions.get(atlasPageAreas.get(state.node));
  if (current) {
    // Centre la zone en cours, sans dépendre d'une fonction de défilement du navigateur.
    atlasScroller.scrollLeft=Math.max(0,current.x-atlasScroller.clientWidth/2);
    atlasScroller.scrollTop=Math.max(0,current.y-atlasScroller.clientHeight/2);
  } else {atlasScroller.scrollTop=0;atlasScroller.scrollLeft=0;}
  journalCloseBtn.focus();
}
function closeAtlas() {journalPanel.classList.add('hidden');journalPanel.setAttribute('aria-hidden','true');}

function render() {
  const node = STORY[state.node] || STORY.start;
  if (node.sheet) {
    ++pageImageLoadToken; // annule une éventuelle image de la page précédente
    chapterNumber.textContent = 'FICHE DU HÉROS';
    imageFrame.classList.add('hidden');
  } else {
    const mappedPage = PAGE_BY_NODE[state.node];
    const declaredPage = node.number ? parseInt(String(node.number).replace(/\D/g, ''), 10) : NaN;
    const pageNumber = Number.isInteger(mappedPage) ? mappedPage : (Number.isFinite(declaredPage) ? declaredPage : 1);
    chapterNumber.textContent = pageNumber === 0 ? 'PROLOGUE · 000' : `PAGE ${padPage(pageNumber)}`;
    if (node.noImage) {
      ++pageImageLoadToken;
      imageFrame.classList.add('hidden');
      storyImage.removeAttribute('src');
      storyImage.classList.add('hidden');
    } else {
      imageFrame.classList.remove('hidden');
      loadPageImage(pageNumber, node.title || '');
    }
  }
  chapterTitle.textContent = node.title || '';
  chapterTitle.classList.toggle('hidden', !node.title);
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
    const labels = [`♥ ${state.hp}/${state.maxHp}`, `🛡 ${protection}`, `Force ${currentForce(state)}`, `Dextérité ${currentDexterity(state)}`, `Puissance de l’arme ${state.weapon === 'none' ? 0 : combatPower(state)}`, ...(state.contamination>0 ? [`Terre noire ${state.contamination}/13`] : [])];
    if (state.flags?.physicianNotesRead && state.contamination >= 9 && state.contamination < 13) labels.push(state.contamination >= 12 ? '⚠ Transformation très proche' : '⚠ Risque de transformation');
    if (state.silver > 0) labels.push(`${state.silver} argent`);
    if (state.goldCoins > 0) labels.push(`${state.goldCoins} or`);
    labels.forEach(label => { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = label; statusTags.appendChild(tag); });
  }

  const availableChoices = state.flags?.blackEarthTransformed && !node.sheet ? [{label:"Reprendre au dernier point de sauvegarde",action:"checkpoint"},{label:"Recommencer depuis le début",action:"restart"}] : state.hp <= 0 && !node.sheet ? fatalChoices() : typeof node.choices === 'function' ? node.choices(state) : (node.choices || []);
  if (state.flags?.blackEarthTransformed && !node.sheet) {
    storyText.innerHTML = '<p>La terre noire gagne ton corps. Tes membres se déforment, et la voix du Dormeur s’éteint pour toujours. Tu es devenu l’un des gardiens de la prison.</p><p><strong>Fin de l’aventure : transformation à 13 points.</strong></p>';
  }
  choices.innerHTML = '';
  availableChoices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    const destinationPage = choice.stay ? null : PAGE_BY_NODE[choice.to];
    const destination = destinationPage === 0 ? '<span class="choice-dest">Lire le prologue</span>' : destinationPage ? `<span class="choice-dest">Rendez-vous à la page ${padPage(destinationPage)}</span>` : '';
    btn.innerHTML = `<span class="choice-index">${i + 1}</span><span class="choice-copy"><span>${choice.label}</span>${destination}</span>`;
    btn.addEventListener('click', () => {
      if (choice.action === 'checkpoint') return restartFromCheckpoint();
      if (choice.action === 'restart') return restartGame();
      if (choice.action === 'damage') {
        const key = choice.damageKey || state.node;
        rollDamage(state, key, choice.damageSides || 6);
        if (key === 'c12' && !state.flags.gaspardEarthRegistered) {
          state.flags.gaspardEarthRegistered = true;
          if (typeof BOOK.rules.raiseContamination === 'function') BOOK.rules.raiseContamination(state, 1);
        }
        saveState(); render(); return;
      }
      if (typeof choice.effect === 'function') choice.effect(state);
      if (choice.stay) { saveState(); render(); return; }
      enterNode(choice.to);
    });
    choices.appendChild(btn);
  });
  atlasSync();
}

function restartGame() {
  atlasMemory.lastShown=''; atlasSaveMemory();
  state = defaultState();
  try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(CHECKPOINT_KEY); } catch (e) {}
  saveState(); closeDrawer(); closeModal(); closeAtlas(); render();
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
      // Le titre visible du récit est la source de vérité. Le libellé TEST
      // sert uniquement de description quand la page n'a pas de titre.
      // Le prologue conserve son libellé explicite dans la navigation.
      title: (pageNumber === 0 ? BOOK.navigationTitles?.[nodeId] : STORY[nodeId]?.title?.trim())
        || BOOK.navigationTitles?.[nodeId]
        || `Page ${padPage(pageNumber)}`
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
  if (!STORY[nodeId] || !Number.isInteger(PAGE_BY_NODE[nodeId])) return;
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
window.addEventListener('resize', () => {
  if (!journalPanel.classList.contains('hidden')) atlasDraw();
});
journalBtn.addEventListener('click', () => openAtlas());
journalCloseBtn.addEventListener('click', closeAtlas);
restartBtn.addEventListener('click', restartGame);
if (menuBtn && !BOOK.demoEndNode) menuBtn.addEventListener('click', openDrawer);
if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);
closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); closeModal(); closeAtlas(); } });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
render();
})();
