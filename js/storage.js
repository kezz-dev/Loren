/* =====================================================================
   storage.js — Loren
   -----------------------------------------------------------------
   Pure persistence layer. Wraps IndexedDB for PDFs, extracted book
   text, cover thumbnails, and the dictionary/WordNet lookup tables.

   No knowledge of app state, the DOM, or pdf.js lives here — every
   function in this file takes primitive arguments (ids, blobs,
   strings) and returns primitive results. Callers (state.js,
   library.js, reader.js, loren-ai.js) are responsible for deciding
   *when* to call these and what to do with the result.

   Load this file before any module that calls into it.
   ===================================================================== */

const PDF_DB_NAME = 'ai_librarian_pdfs';
const PDF_STORE = 'pdf_files';
const TEXT_STORE = 'book_texts'; // v7fix: stores extracted text separately from RAM
const COVER_STORE = 'book_covers'; // v8: pre-rendered JPEG thumbnails, saved during import
const DICT_STORE = 'loren_dictionary'; // v9: word → definition lookup table
const WORDNET_STORE = 'loren_wordnet'; // v10: WordNet synonym/antonym lookup

function openPDFDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(PDF_DB_NAME, 5); // v5: added WORDNET_STORE
    req.onupgradeneeded = (e)=>{
      const db = req.result;
      if (!db.objectStoreNames.contains(PDF_STORE)) {
        db.createObjectStore(PDF_STORE);
      }
      if (!db.objectStoreNames.contains(TEXT_STORE)) {
        db.createObjectStore(TEXT_STORE);
      }
      if (!db.objectStoreNames.contains(COVER_STORE)) {
        db.createObjectStore(COVER_STORE);
      }
      if (!db.objectStoreNames.contains(DICT_STORE)) {
        db.createObjectStore(DICT_STORE);
      }
      if (!db.objectStoreNames.contains(WORDNET_STORE)) {
        db.createObjectStore(WORDNET_STORE);
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
    // Unblock if another tab has the DB open — prevents crash-loop on reload
    req.onblocked = ()=> {
      console.warn('[DB] blocked — another tab may have it open');
      reject(new Error('DB blocked'));
    };
  });
}

async function savePDFBlob(id, blob){
  let db;
  try {
    db = await openPDFDB();
    const tx = db.transaction(PDF_STORE, 'readwrite');
    tx.objectStore(PDF_STORE).put(blob, id);
    return await new Promise((resolve)=>{
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> resolve(false);
    });
  } catch(e) { return false; }
  finally { if (db) db.close(); }
}

async function getPDFBlob(id){
  let db;
  try {
    db = await openPDFDB();
    return await new Promise((resolve)=>{
      const tx = db.transaction(PDF_STORE, 'readonly');
      const req = tx.objectStore(PDF_STORE).get(id);
      req.onsuccess = ()=> resolve(req.result || null);
      req.onerror = ()=> resolve(null);
    });
  } catch(e) { return null; }
  finally { if (db) db.close(); }
}

async function deletePDFBlob(id){
  let db;
  try {
    db = await openPDFDB();
    const tx = db.transaction(PDF_STORE, 'readwrite');
    tx.objectStore(PDF_STORE).delete(id);
    return await new Promise((resolve)=>{
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> resolve(false);
    });
  } catch(e) { return false; }
  finally { if (db) db.close(); }
}
/* =============================
   BOOK TEXT STORAGE (IndexedDB)
   Text lives here, NOT in RAM. Freed after import, loaded on demand.
============================= */
async function saveBookText(id, text) {
  let db;
  try {
    db = await openPDFDB();
    const tx = db.transaction(TEXT_STORE, 'readwrite');
    tx.objectStore(TEXT_STORE).put(text, id);
    return await new Promise(resolve => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch(e) { return false; }
  finally { if (db) db.close(); }
}

async function getBookText(id) {
  let db;
  try {
    db = await openPDFDB();
    return await new Promise(resolve => {
      const tx = db.transaction(TEXT_STORE, 'readonly');
      const req = tx.objectStore(TEXT_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch(e) { return null; }
  finally { if (db) db.close(); }
}

async function deleteBookText(id) {
  let db;
  try {
    db = await openPDFDB();
    const tx = db.transaction(TEXT_STORE, 'readwrite');
    tx.objectStore(TEXT_STORE).delete(id);
    return await new Promise(resolve => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch(e) { return false; }
  finally { if (db) db.close(); }
}

/* =============================
   COVER DATA STORAGE (IndexedDB)
   JPEG data-URLs saved during import. Instant retrieval on every load.
============================= */
async function saveCoverData(id, dataUrl) {
  let db;
  try {
    db = await openPDFDB();
    const tx = db.transaction(COVER_STORE, 'readwrite');
    tx.objectStore(COVER_STORE).put(dataUrl, id);
    return await new Promise(resolve => {
      tx.oncomplete = () => resolve(true);
      tx.onerror   = () => resolve(false);
    });
  } catch(e) { return false; }
  finally { if (db) db.close(); }
}

async function getCoverData(id) {
  let db;
  try {
    db = await openPDFDB();
    return await new Promise(resolve => {
      const tx  = db.transaction(COVER_STORE, 'readonly');
      const req = tx.objectStore(COVER_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
  } catch(e) { return null; }
  finally { if (db) db.close(); }
}

async function deleteCoverData(id) {
  let db;
  try {
    db = await openPDFDB();
    const tx = db.transaction(COVER_STORE, 'readwrite');
    tx.objectStore(COVER_STORE).delete(id);
    return await new Promise(resolve => {
      tx.oncomplete = () => resolve(true);
      tx.onerror   = () => resolve(false);
    });
  } catch(e) { return false; }
  finally { if (db) db.close(); }
}

/* =============================
   DICTIONARY STORAGE (IndexedDB)
   A flat { word: definition } object stored under the key 'main'.
   Load order:
     1. In-memory cache (instant — same session)
     2. IndexedDB (fast — persists across sessions)
     3. ./dictionary.json (first-time only — fetched once, then cached to IndexedDB)
============================= */
let lorenDict = null; // in-memory cache — populated on first lookup
let _dictLoadPromise = null; // prevents parallel fetches

async function _loadDictionary() {
  // 1. Already in memory
  if (lorenDict !== null) return lorenDict;

  // 2. Deduplicate concurrent calls — only one load at a time
  if (_dictLoadPromise) return _dictLoadPromise;

  _dictLoadPromise = (async () => {
    let db;
    try {
      // ── Step 1: try IndexedDB ──
      db = await openPDFDB();
      const stored = await new Promise(resolve => {
        const tx  = db.transaction(DICT_STORE, 'readonly');
        const req = tx.objectStore(DICT_STORE).get('main');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      });
      if (db) { db.close(); db = null; }

      if (stored && Object.keys(stored).length > 0) {
        lorenDict = stored;
        return lorenDict;
      }

      // ── Step 2: fetch dictionary.json (first-time load) ──
      // Build absolute URL from current location so it works on
      // Android content:// and file:// URLs, not just http://
      let fetched = null;
      try {
        const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
        const dictUrl = base + 'dictionary.json';
        const res = await fetch(dictUrl);
        if (res.ok) {
          fetched = await res.json();
        }
      } catch(fetchErr) {
        // File not present or network unavailable — silent fail
      }

      if (fetched && typeof fetched === 'object' && Object.keys(fetched).length > 0) {
        lorenDict = fetched;
        // Cache to IndexedDB — failure here is non-fatal, lorenDict is already set
        try { await saveDictionary(fetched); } catch(saveErr) { /* quota or write error — dict still works in-memory */ }
        return lorenDict;
      }

      // ── Step 3: nothing available ──
      lorenDict = {};
      return lorenDict;

    } catch(e) {
      // Only reach here if IndexedDB itself failed to open
      // lorenDict may already be set from fetch — preserve it
      if (db) db.close();
      if (lorenDict && Object.keys(lorenDict).length > 0) return lorenDict;
      lorenDict = {};
      return lorenDict;
    } finally {
      _dictLoadPromise = null;
    }
  })();

  return _dictLoadPromise;
}

async function saveDictionary(dictObj) {
  lorenDict = dictObj; // update cache
  let db;
  try {
    db = await openPDFDB();
    const tx = db.transaction(DICT_STORE, 'readwrite');
    tx.objectStore(DICT_STORE).put(dictObj, 'main');
    return await new Promise(resolve => {
      tx.oncomplete = () => resolve(true);
      tx.onerror   = () => resolve(false);
    });
  } catch(e) { return false; }
  finally { if (db) db.close(); }
}

async function lookupWord(word) {
  const dict = await _loadDictionary();
  const key  = word.trim().toLowerCase();
  // exact match first
  if (dict[key]) return dict[key];
  // try without trailing punctuation
  const bare = key.replace(/[^a-z'-]/g, '');
  if (dict[bare]) return dict[bare];
  return null;
}

function isDictionaryLoaded() {
  return lorenDict !== null && Object.keys(lorenDict).length > 0;
}

/* ═══════════════════════════════════════════════════════════════
   WORDNET STORAGE (IndexedDB)
   Stores synonym/antonym data from wordnet.json.
   Same load pattern as the dictionary — fetch once, cache forever.
   Expected format: { "word": { "synonyms": [...], "antonyms": [...], "definition": "..." }, ... }
   Compatible with fluhus/wordnet-to-json output.
═══════════════════════════════════════════════════════════════ */
let lorenWordnet = null;
let _wordnetLoadPromise = null;

async function _loadWordnet() {
  if (lorenWordnet !== null) return lorenWordnet;
  if (_wordnetLoadPromise) return _wordnetLoadPromise;

  _wordnetLoadPromise = (async () => {
    let db;
    try {
      // ── Try IndexedDB first ──
      db = await openPDFDB();
      const stored = await new Promise(resolve => {
        const tx  = db.transaction(WORDNET_STORE, 'readonly');
        const req = tx.objectStore(WORDNET_STORE).get('main');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      });
      if (db) { db.close(); db = null; }

      if (stored && Object.keys(stored).length > 0) {
        lorenWordnet = stored;
        return lorenWordnet;
      }

      // ── Fetch wordnet.json first-time ──
      // Use absolute URL derived from current location for Android compatibility
      let fetched = null;
      try {
        const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
        const res = await fetch(base + 'wordnet.json');
        if (res.ok) fetched = await res.json();
      } catch(e) { /* not present — silent */ }

      if (fetched && typeof fetched === 'object' && Object.keys(fetched).length > 0) {
        lorenWordnet = fetched;
        // Cache to IndexedDB — failure here is non-fatal
        try {
          db = await openPDFDB();
          const tx = db.transaction(WORDNET_STORE, 'readwrite');
          tx.objectStore(WORDNET_STORE).put(fetched, 'main');
          await new Promise(resolve => {
            tx.oncomplete = () => resolve(true);
            tx.onerror    = () => resolve(false);
          });
        } catch(e) { /* cache failure — still works in-memory */ }
        finally { if (db) db.close(); }
        return lorenWordnet;
      }

      lorenWordnet = {};
      return lorenWordnet;
    } catch(e) {
      if (db) db.close();
      if (lorenWordnet && Object.keys(lorenWordnet).length > 0) return lorenWordnet;
      lorenWordnet = {};
      return lorenWordnet;
    } finally {
      _wordnetLoadPromise = null;
    }
  })();

  return _wordnetLoadPromise;
}

// ── Look up synonyms for a word ────────────────────────────────
// Collects from all meanings: meanings[n].synonyms,
// meanings[n].wordnet_ptrs.similar_to, and .also_see
// Returns a deduplicated lowercase array, empty if not found.
async function lookupSynonyms(word) {
  const wn  = await _loadWordnet();
  const key = word.trim().toLowerCase();
  const entry = wn[key] || wn[word.trim()]; // try lowercase then original case
  if (!entry || !Array.isArray(entry.meanings)) return [];

  const seen = new Set();
  const result = [];

  for (const meaning of entry.meanings) {
    // Direct synonyms at meaning level
    for (const s of (meaning.synonyms || [])) {
      const w = (typeof s === 'string' ? s : s.word || '').toLowerCase().trim();
      if (w && !seen.has(w) && w !== key) { seen.add(w); result.push(w); }
    }
    // similar_to — richest source for adjectives
    for (const s of (meaning.wordnet_ptrs?.similar_to || [])) {
      const w = (typeof s === 'string' ? s : s.word || '').toLowerCase().trim();
      if (w && !seen.has(w) && w !== key) { seen.add(w); result.push(w); }
    }
    // also_see — related concepts
    for (const s of (meaning.wordnet_ptrs?.also_see || [])) {
      const w = (typeof s === 'string' ? s : s.word || '').toLowerCase().trim();
      if (w && !seen.has(w) && w !== key) { seen.add(w); result.push(w); }
    }
  }

  return result;
}

// ── Look up antonyms for a word ─────────────────────────────────
// Useful for negated queries like "not boring" → exciting
async function lookupAntonyms(word) {
  const wn  = await _loadWordnet();
  const key = word.trim().toLowerCase();
  const entry = wn[key] || wn[word.trim()];
  if (!entry || !Array.isArray(entry.meanings)) return [];

  const seen = new Set();
  const result = [];

  for (const meaning of entry.meanings) {
    for (const s of (meaning.wordnet_ptrs?.antonym || [])) {
      const w = (typeof s === 'string' ? s : s.word || '').toLowerCase().trim();
      if (w && !seen.has(w) && w !== key) { seen.add(w); result.push(w); }
    }
  }

  return result;
}