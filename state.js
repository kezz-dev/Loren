/* =====================================================================
   state.js — Loren
   -----------------------------------------------------------------
   The shared in-memory `state` object, its localStorage-backed
   persistence keys (PREF), current-view context, and the load/save
   functions that move data between `state` and localStorage.

   This file freely calls into other modules (album rebuild, font
   application, session indicator UI, cover cache, etc.) from inside
   its functions — that's safe because those are deferred calls, not
   executed until the app is actually running, by which point every
   module has loaded. The only hard rule for this codebase's
   "global script" split: nothing here runs immediately at the top
   level that depends on another file, and nothing else may run
   immediately at the top level before this file has loaded, since
   `state`, `PREF`, and the render-context variables below are
   declared with let/const (no hoisted value until this file runs).

   Load this file after storage.js, before anything that reads or
   writes `state`.

   NOT included here, on purpose:
   - Animation helpers (getAnimationEnabled, applyScrollAnimation,
     COLOR_GRADIENTS, randomFolderColor) — these are DOM/UI concerns
     that happened to sit next to PREF in the original file. → ui.js
   - The general HELPERS block (toast, uid, genre/length detection)
     right after this section in the original file → ui.js / library.js
   - The "PATCH A4.1 / A4.2" immediate-execution DOM reset that
     followed saveSession() in the original file — it resets
     currentRenderContext and wires up folder color-picker clicks at
     script-parse time, not inside a function. That's boot wiring,
     not state, so it belongs in app.js's init sequence, not here.
   ===================================================================== */

const PREF = {
  BOOKS:'ai_books_final', 
  FAVS:'ai_favs_final', 
  AI:'ai_name_final', 
  USER:'user_name_final',
  THEME:'ai_theme_final', 
  FONT:'ai_font_final', 
  TUTOR:'ai_tutor_done_final', 
  SHOW_INTRO:'ai_show_intro_final', 
  SORT:'ai_sort_final',
  SESSION_LENGTH:'ai_session_length_final',
  NOTES:'ai_notes_final',
  FOLDERS:'ai_folders_final',
  FOLDER_SORT:'loren_folder_sort_v1',
  SESSION:'ai_current_session_final',
  ANIMATIONS:'ai_animations_final',
  TRASH:'loren_trash_v7',
  SMART_FILTER:'loren_smart_filter_v7',
  BOOKMARKS:'loren_bookmarks_v1',
  HIGHLIGHTS:'loren_highlights_v1',
  COVER_TEXTURE:'loren_cover_texture_v1',
  NAV_LOCKED:'loren_nav_locked_v1'
};
const SESSION_DB_KEY = 'ai_sessions_history_final';

let state = { 
  books: [], 
  favorites: new Set(), 
  notes: [], // v2: Notes & Quotes
  bookmarks: [], // v8: Reader bookmarks
  highlights: [], // v8: Saved passages
  folders: [], // v2: Manual folders
  selectedBooks: new Set(), // v2: Multi-selection
  isSelectionMode: false, // v2: Selection mode
  currentSession: null, // v2: Session mode
  sessionTimer: null, // v3.2: Timer reference
  sessionPaused: false, // v7: Session pause
  sessionPausedAt: null, // v7: When paused
  sessionElapsedMs: 0, // v7: Accumulated elapsed before pause
  pendingFolderCreation: null, // v5.1: folder-from-OS
  trash: [], // v7: Soft-deleted books
  aiName:'',
  userName:'', 
  processingQueue:[], 
  processing:false 
};

let currentRenderContext = 'LIBRARY_VIEW'; // LIBRARY_VIEW, FOLDER_VIEW, or FAVORITES_VIEW
let currentFolderViewId = null; // Only set when in FOLDER_VIEW
let _folderArrangeMode  = false; // true while in arrange mode for a folder
let favsBooksHidden = false;
let currentSmartFilter = 'all'; // v7: 'all', 'unread', 'read', 'short', 'long', 'recent', 'trash'
let currentTagFilter = null; // v8: tag string or null

function loadState(){
  try{
    const raw = localStorage.getItem(PREF.BOOKS); 
if(raw) {
  state.books = JSON.parse(raw);
  // Text is NOT loaded at startup — it lives in IndexedDB and is loaded
  // on demand via ensureBookText(bookId) when a feature actually needs it.
  // This replaces the old loop that fired 200 concurrent PDF.js re-extractions
  // on every app load, which was causing freezes and memory pressure.

  // ── Versioned migration system ────────────────────────────────────────────
  // Each key is a data-schema version. When Loren boots, every migration with
  // a version newer than the stored one runs in order, then the stored version
  // is bumped. This is how existing books and data stay in sync with new
  // features — no user action required.
  //
  // To add a migration for a future release: add a new key (e.g. '9.2') with a
  // function. Keep migrations idempotent — they must be safe to re-run.
  // ─────────────────────────────────────────────────────────────────────────
  const LOREN_DATA_SCHEMA = '9.1';
  const LOREN_SCHEMA_KEY  = 'loren_schema_version';

  const _migrations = {

    // v9.0 → absorbs old ad-hoc bland migration (loren_bland_v2)
    // Reset coverIsBland so all covers are re-evaluated with the correct
    // detection threshold (uncompressed canvas, not JPEG-compressed).
    '9.0': () => {
      state.books.forEach(b => { delete b.coverIsBland; });
      saveBooks();
      localStorage.removeItem('loren_bland_v2'); // retire the old key
    },

    // v9.1 → Discover cover rendering fix.
    // The coverIsBland suppress-logic was inverted in Discover (it was hiding
    // real images when texture was OFF). Clear all coverIsBland flags so every
    // book's cover gets freshly evaluated on next render with the corrected code.
    // Also evicts the RAM cover cache so stale suppressed images don't persist.
    // Also cleans up ghost favorites from any wishlist books (heart was visible
    // on wishlist cards before this fix, creating invisible Favorites entries).
    '9.1': () => {
      let changed = false;
      state.books.forEach(b => {
        if (b.coverIsBland !== undefined) { delete b.coverIsBland; changed = true; }
      });
      if (changed) saveBooks();
      coverCache.clear();
      // Remove any favorites that belong to wishlist books
      const wishlistIds = new Set(state.books.filter(b => b.isWishlist).map(b => b.id));
      if (wishlistIds.size > 0) {
        let favChanged = false;
        wishlistIds.forEach(id => { if (state.favorites.has(id)) { state.favorites.delete(id); favChanged = true; } });
        if (favChanged) saveFavs();
      }
    },

  };

  function _compareSchemaVersions(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  const _storedSchema = localStorage.getItem(LOREN_SCHEMA_KEY) || '0';
  if (_compareSchemaVersions(_storedSchema, LOREN_DATA_SCHEMA) < 0) {
    const _pendingVersions = Object.keys(_migrations)
      .filter(v => _compareSchemaVersions(_storedSchema, v) < 0)
      .sort(_compareSchemaVersions);

    for (const ver of _pendingVersions) {
      try {
        _migrations[ver]();
        console.log(`[Loren] Migration ${ver} applied`);
      } catch (e) {
        console.warn(`[Loren] Migration ${ver} failed:`, e);
      }
    }
    localStorage.setItem(LOREN_SCHEMA_KEY, LOREN_DATA_SCHEMA);
  }
  // ── End migration system ──────────────────────────────────────────────────
}
    
    // FIX: Love icon color state - Ensure favorites load correctly
const fav = localStorage.getItem(PREF.FAVS); 
if(fav) {
  try {
    const parsed = JSON.parse(fav);
    if (parsed && Array.isArray(parsed)) {
      state.favorites = new Set(parsed);
    }
  } catch(e) {
    console.warn('Could not parse favorites:', e);
    state.favorites = new Set();
  }
} else {
  state.favorites = new Set();
}
 
    try { const notes = localStorage.getItem(PREF.NOTES); if(notes) state.notes = JSON.parse(notes); } catch(e) { console.warn('notes parse failed'); state.notes = []; }
    try { const bk = localStorage.getItem(PREF.BOOKMARKS); if(bk) state.bookmarks = JSON.parse(bk); } catch(e){}
    try { const hl = localStorage.getItem(PREF.HIGHLIGHTS); if(hl) state.highlights = JSON.parse(hl); } catch(e){}
    
    try {
      const folders = localStorage.getItem(PREF.FOLDERS);
      if(folders) state.folders = JSON.parse(folders);
    } catch(e) { console.warn('folders parse failed'); state.folders = []; }
    // --- MIGRATE FOLDERS: resolve colorKey across all 5 palettes ---
    {
  const _GRAD_TO_HEX = {};
  [['#0a1629',['linear-gradient(145deg,#16243a,#4a6080,#16243a)','linear-gradient(135deg,#0a1629,#1a2b4a)','#394655','linear-gradient(135deg,#2a1f14,#3d3020)','linear-gradient(145deg,#111418,#202832,#111418)']],
   ['#4a6fa5',['linear-gradient(145deg,#304870,#6a8fba,#304870)','linear-gradient(135deg,#4a6fa5,#5d82b8)','#5c7a96','linear-gradient(135deg,#3e4e6c,#56688e)','linear-gradient(145deg,#18202a,#28303e,#18202a)']],
   ['#667761',['linear-gradient(145deg,#3e4e40,#708268,#3e4e40)','linear-gradient(135deg,#667761,#7a8c75)','#6d7d6e','linear-gradient(135deg,#5c6644,#726e50)','linear-gradient(145deg,#1a201a,#282e28,#1a201a)']],
   ['#8c5e58',['linear-gradient(145deg,#583a36,#8e6058,#583a36)','linear-gradient(135deg,#8c5e58,#a0726c)','#826260','linear-gradient(135deg,#7a4a3a,#9a6252)','linear-gradient(145deg,#201a18,#302824,#201a18)']],
   ['#9c6b98',['linear-gradient(145deg,#503256,#866a8a,#503256)','linear-gradient(135deg,#9c6b98,#b080ac)','#7a6a80','linear-gradient(135deg,#6e4c5a,#8e6470)','linear-gradient(145deg,#1e1820,#2c2430,#1e1820)']],
   ['#3a8b8f',['linear-gradient(145deg,#2a5c60,#5e9498,#2a5c60)','linear-gradient(135deg,#3a8b8f,#4da0a4)','#557c82','linear-gradient(135deg,#3a6658,#507a6e)','linear-gradient(145deg,#161e20,#22282a,#161e20)']],
   ['#d4a574',['linear-gradient(145deg,#6a4e2e,#b08056,#6a4e2e)','linear-gradient(135deg,#d4a574,#e0b688)','#9e8a72','linear-gradient(135deg,#b07c40,#c89a5c)','linear-gradient(145deg,#1e1a14,#2c2620,#1e1a14)']],
   ['#c44536',['linear-gradient(145deg,#5a2018,#9a4a3a,#5a2018)','linear-gradient(135deg,#c44536,#d85a4b)','#8a5550','linear-gradient(135deg,#8a2e20,#b04438)','linear-gradient(145deg,#201412,#302018,#201412)']],
   ['#6a0572',['linear-gradient(145deg,#3a1044,#784080,#3a1044)','linear-gradient(135deg,#6a0572,#8a1891)','#604868','linear-gradient(135deg,#4a2040,#6e3a5e)','linear-gradient(145deg,#1a101e,#281a2c,#1a101e)']],
   ['#b05c2a',['linear-gradient(145deg,#6a3210,#c07040,#6a3210)','linear-gradient(135deg,#b05c2a,#d0783e)','#8a6050','linear-gradient(135deg,#8a3a10,#b05a28)','linear-gradient(145deg,#1e1410,#2c1e16,#1e1410)']],
   ['#e9c46a',['linear-gradient(145deg,#6a5018,#c09040,#6a5018)','linear-gradient(135deg,#e9c46a,#f0d080)','#a09060','linear-gradient(135deg,#c8922a,#e0b048)','linear-gradient(145deg,#1c1810,#2a2418,#1c1810)']],
   ['#2d5a27',['linear-gradient(145deg,#1a3a14,#4a7a3e,#1a3a14)','linear-gradient(135deg,#2d5a27,#3e7a36)','#4a6a44','linear-gradient(135deg,#1e4018,#326430)','linear-gradient(145deg,#121814,#1e2820,#121814)']],
   ['#1e6091',['linear-gradient(145deg,#0d3352,#2e88c4,#0d3352)']],
   ['#7f4f24',['linear-gradient(145deg,#4a2a0e,#b07038,#4a2a0e)']],
   ['#4a4e69',['linear-gradient(145deg,#2a2e48,#6a70a0,#2a2e48)']],
   ['#386641',['linear-gradient(145deg,#1e3a22,#52926a,#1e3a22)']],
  ].forEach(([hex, grads]) => { _GRAD_TO_HEX[hex] = hex; grads.forEach(g => { _GRAD_TO_HEX[g] = hex; }); });
state.folders = (state.folders || []).map(folder => {
  if (!folder.color) return folder;
  if (folder.color.startsWith('#') && COLOR_GRADIENTS[folder.color]) {
    folder.colorKey = folder.color;
    folder.color = COLOR_GRADIENTS[folder.color];
    return folder;
  }
  if (!folder.colorKey) folder.colorKey = _GRAD_TO_HEX[folder.color.trim()] || null;
  return folder;
});
    } 
    try { const session = localStorage.getItem(PREF.SESSION); if(session) state.currentSession = JSON.parse(session); } catch(e) { console.warn('session parse failed'); }
    
    state.aiName = localStorage.getItem(PREF.AI) || '';
    state.userName = localStorage.getItem(PREF.USER) || '';
    
    if(localStorage.getItem(PREF.THEME)==='dark') document.body.classList.add('dark');
    applyAnimationSetting(localStorage.getItem(PREF.ANIMATIONS) !== 'false');
    
    applyFont(localStorage.getItem(PREF.FONT) || 'sans');
    
    const sort = localStorage.getItem(PREF.SORT) || 'import';
document.getElementById('sortImport').checked = sort==='import';
document.getElementById('sortAlpha').checked = sort==='alpha';
document.getElementById('sortAuthor').checked = sort==='author';
    const folderSortEl = document.getElementById('folderSortSelect');
    if (folderSortEl) folderSortEl.value = localStorage.getItem(PREF.FOLDER_SORT) || 'added';


    
    const sessionLength = localStorage.getItem(PREF.SESSION_LENGTH) || '';
    document.getElementById('sessionLengthInput').value = sessionLength;
     
    // Update session indicator if there's an active session
    if(state.currentSession && state.currentSession.active) {
      updateSessionIndicator();
    }
    
    // ENSURE selection UI is hidden on load
    const selectionTopbar = document.getElementById('selectionTopbar');
    if (selectionTopbar) {
      selectionTopbar.classList.remove('visible');
    }
    
    const grid = document.getElementById('grid');
    if (grid) {
      grid.classList.remove('selection-mode');
    }
    
    const folderModal = document.getElementById('folderModal');
    if (folderModal) {
      folderModal.style.display = 'none';
    }
    
  }catch(e){ console.error('load', e); }
  
  // Build caches after books are loaded
  setTimeout(() => { buildFitnessCache(); buildAuthorIndex(); buildTfIdfIndex(); albumRebuild(); loadTrash(); }, 0);
}

function saveBooks(){
  try {
    // Strip full text before saving — text can be hundreds of KB per book
    // and will quickly overflow the 5MB localStorage limit.
    // Text lives in IndexedDB and is loaded on demand via ensureBookText().
    const slim = state.books.map(b => {
      const { text, ...meta } = b;
      return meta;
    });
    localStorage.setItem(PREF.BOOKS, JSON.stringify(slim));
  } catch(e) {
    console.error('saveBooks failed (quota?):', e);
  }
  updateBookCount();
  // Don't rebuild caches on every save during a bulk import —
  // they iterate all books each call, causing O(n²) slowdown by book 100.
  // They run once when the full import finishes instead.
  if (!state.processing) {
    buildFitnessCache();
    buildAuthorIndex();
    buildTfIdfIndex();
    albumRebuild();
  }
}

function saveFavs(){ 
  localStorage.setItem(PREF.FAVS, JSON.stringify(Array.from(state.favorites))); 
}

function saveNotes() {
  localStorage.setItem(PREF.NOTES, JSON.stringify(state.notes));
}
function saveBookmarks() {
  localStorage.setItem(PREF.BOOKMARKS, JSON.stringify(state.bookmarks));
}
function saveHighlights() {
  localStorage.setItem(PREF.HIGHLIGHTS, JSON.stringify(state.highlights));
}

function saveTrash() {
  try {
    // Strip full text from trashed books before saving — text can be 50KB+
    // per book and we're already at the edge of the 5MB localStorage limit.
    // Text is still in IndexedDB; restoreFromTrash() recovers it via ensureBookText().
    const slim = state.trash.map(item => ({
      ...item,
      book: item.book ? (({ text, ...rest }) => rest)(item.book) : item.book
    }));
    localStorage.setItem(PREF.TRASH, JSON.stringify(slim));
  } catch(e) {
    console.warn('saveTrash failed (quota?):', e);
  }
}

function loadTrash() {
  try {
    const raw = localStorage.getItem(PREF.TRASH);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Auto-purge items older than 30 days
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      state.trash = parsed.filter(item => {
        return item.deletedAt && (Date.now() - item.deletedAt) < thirtyDays;
      });
      saveTrash(); // save purged list
    }
  } catch(e) { state.trash = []; }
}

function restoreFromTrash(bookId) {
  const item = state.trash.find(t => t.book.id === bookId);
  if (!item) return;
  state.books.push(item.book);
  albumInsert(item.book); // Album: re-index the restored book
  state.trash = state.trash.filter(t => t.book.id !== bookId);
  saveBooks();
  saveTrash();
  renderAll();
  toast('Book restored to library');
}

async function permanentlyDeleteFromTrash(bookId) {
  state.trash = state.trash.filter(t => t.book.id !== bookId);
  albumRemove(bookId); // Album: ensure entry is fully gone (may already be null'd)
  try { await deletePDFBlob(bookId); } catch(e) {}
  try { await deleteBookText(bookId); } catch(e) {}
  try { await deleteCoverData(bookId); } catch(e) {}
  coverCache.delete(bookId);
  saveTrash();
  if (currentSmartFilter === 'trash') renderLibrary();
  toast('Permanently deleted');
}

function saveFolders() {
  localStorage.setItem(PREF.FOLDERS, JSON.stringify(state.folders));
}

function saveSession() {
  localStorage.setItem(PREF.SESSION, JSON.stringify(state.currentSession));
}
