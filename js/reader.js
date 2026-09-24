/* =====================================================================
   reader.js — Loren
   -----------------------------------------------------------------
   Everything PDF: pdf.js worker config, cover-thumbnail generation,
   book text retrieval/extraction, PDF file operations (download,
   external open, attach, delete, favorite-toggle), reading-position
   tracking, and the reading-session timer.

   Load this file after storage.js (uses getPDFBlob, getBookText,
   saveBookText, getCoverData, saveCoverData) and state.js (uses
   `state`, PREF, saveBooks, saveFavs, saveSession, saveTrash).

   Recovered here: the `pdfjsLib.GlobalWorkerOptions.workerSrc` line
   that used to sit at the very top of the original inline <script>,
   before any of the banner sections. It got orphaned when the big
   script was deleted from index.html in favor of the module tags —
   it belongs to whichever file configures pdf.js, so it's here now.
   Without it, pdf.js would still try to fetch its worker from a
   default relative path that doesn't exist in the split layout.

   NOT included here, on purpose:
   - `_warmUpClassifier()` (found sitting right before ensureBookText
     below) — it just calls `_initLorenClassifier()`, so it's
     loren-ai.js's job. It's what index.html's splash boot script
     calls on load; that call will silently no-op until loren-ai.js
     exists, which is expected mid-refactor.

   One boundary call worth a second look: `toggleFav`, `deleteBook`,
   `_enrichBookMetadata`, and `detectLibrarySeries` came bundled
   inside the original "PDF OPERATIONS" banner alongside genuine PDF
   operations (download/open/attach), but they're really library/
   book-record concerns more than PDF concerns. Kept them here for
   now since that's where the banner put them — say the word if
   you'd rather they move to library.js.
   ===================================================================== */

/* =============================
   PDF.js CONFIG
============================= */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

/* =============================
   PDF COVER GENERATION
============================= */
const coverCache = new Map();
const COVER_CACHE_MAX = 60; // never keep more than 60 cover JPEGs in RAM at once

// Concurrency limiter for cover generation.
// Without this, scrolling fast through 100+ books opens 20+ PDF.js instances
// simultaneously → OOM crash. Max 2 at once is enough to feel responsive.
let _coverInFlight = 0;
const COVER_MAX_CONCURRENT = 2;
const _coverWaiters = [];

function _coverSlotAvailable() {
  if (_coverInFlight < COVER_MAX_CONCURRENT) {
    _coverInFlight++;
    return Promise.resolve();
  }
  // No slot — queue the caller. _coverRelease() will increment and unblock it.
  return new Promise(resolve => _coverWaiters.push(resolve));
}
function _coverRelease() {
  if (_coverWaiters.length > 0) {
    // Hand the slot directly to the next waiter (count stays the same)
    _coverWaiters.shift()();
  } else {
    _coverInFlight--;
  }
}

/* ── _isBlandCover(canvas) ────────────────────────────────────────────
   Samples a 20×20 grid (400 points) evenly across the canvas and counts
   how many pixels are "significantly non-white" — i.e. not close to a
   pure white/near-white background (R,G,B all > 235).

   A plain title page is almost entirely white with a few thin text
   strokes, so fewer than 4% of samples will be non-white.
   Any designed cover — minimalist black, coloured, illustrated — has
   large non-white regions and will easily exceed the threshold.

   Returns true  → bland title page  → apply .cover-bland texture
   Returns false → real cover image  → show as-is
──────────────────────────────────────────────────────────────────────── */
function _isBlandCover(canvas, threshold) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const W = canvas.width;
  const H = canvas.height;
  const GRID = 20;           // 20×20 = 400 sample points
  const THRESHOLD = threshold || 235; // R, G, B all above this → "white"
  const BLAND_RATIO = 0.04;  // fewer than 4% non-white → bland

  let nonWhite = 0;

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const x = Math.floor((col / GRID) * W);
      const y = Math.floor((row / GRID) * H);
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      if (r < THRESHOLD || g < THRESHOLD || b < THRESHOLD) {
        nonWhite++;
      }
    }
  }

  return (nonWhite / (GRID * GRID)) < BLAND_RATIO;
}

/* Returns true if the cover texture feature is enabled (default: on) */
function _coverTextureEnabled() {
  return localStorage.getItem(PREF.COVER_TEXTURE) !== 'false';
}

async function generateBookCover(bookId) {
  // Do not generate covers during an active import.
  // Cover generation opens its own PDF.js document per book and competes
  // for memory with the import — this was causing crashes at ~53%.
  if (state.processing) return null;

  // 1. RAM cache — fastest path
  if (coverCache.has(bookId)) return coverCache.get(bookId);

  // 2. IDB cache — covers saved during import; no PDF.js needed
  const stored = await getCoverData(bookId);
  if (stored) {
    if (coverCache.size >= COVER_CACHE_MAX) {
      coverCache.delete(coverCache.keys().next().value);
    }
    coverCache.set(bookId, stored);
    return stored;
  }

  // 3. Fallback — re-render from PDF blob (books imported before this version)
  //    Uses concurrency limiter so at most 2 run at once.
  await _coverSlotAvailable();

  let pdf = null;
  try {
    const blob = await getPDFBlob(bookId);
    if (!blob) return null;

    const arrayBuffer = await blob.arrayBuffer();
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const page        = await pdf.getPage(1);
    const rawViewport = page.getViewport({ scale: 1 });
    const MAX_W       = 400;
    const scale       = Math.min(1.5, MAX_W / rawViewport.width);
    const viewport    = page.getViewport({ scale });
    const canvas      = document.createElement('canvas');
    canvas.width      = Math.round(viewport.width);
    canvas.height     = Math.round(viewport.height);
    const ctx         = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Detect bland cover (plain title page) before wiping the canvas.
    // Stamps book.coverIsBland so card renderers can apply the texture fallback.
    const book = state.books.find(b => b.id === bookId);
    if (book) {
      book.coverIsBland = _isBlandCover(canvas);
      saveBooks();
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    canvas.width = 0; canvas.height = 0; // release canvas memory

    // Persist so next reload skips the PDF.js path entirely
    await saveCoverData(bookId, dataUrl);

    if (coverCache.size >= COVER_CACHE_MAX) {
      coverCache.delete(coverCache.keys().next().value);
    }
    coverCache.set(bookId, dataUrl);
    return dataUrl;

  } catch (e) {
    return null;
  } finally {
    if (pdf) { try { pdf.destroy(); } catch(e) {} }
    _coverRelease();
  }
}

// Global cover observer — tracked so we can disconnect it before creating a new one.
// Without this, every renderLibrary() call creates a NEW observer that holds
// references to all old DOM elements forever. With 7 renderAll() calls during
// import that's 700+ leaked nodes.
let _activeCoverObserver = null;

function _initCoverObserver() {
  // Disconnect the previous observer first so it releases its element references
  if (_activeCoverObserver) {
    _activeCoverObserver.disconnect();
    _activeCoverObserver = null;
  }

  const pending = document.querySelectorAll('[data-cover-pending]');
  if (!pending.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      // Guard: element may have been removed from DOM since observer was set up
      if (!el.isConnected) { obs.unobserve(el); return; }
      obs.unobserve(el);
      const bookId = el.dataset.coverPending;
      delete el.dataset.coverPending;
      const cb = el._onCoverLoad;
      if (!bookId || !cb) return;
      // Stagger cover loads: small random delay (0–400ms) so IntersectionObserver
      // firing for 20 visible books at once doesn't launch all 20 simultaneously.
      const jitter = Math.floor(Math.random() * 400);
      const run = () => generateBookCover(bookId).then(cb).catch(() => cb(null));
      if (typeof requestIdleCallback !== 'undefined') {
        setTimeout(() => requestIdleCallback(run, { timeout: 4000 }), jitter);
      } else {
        setTimeout(run, 100 + jitter);
      }
    });
  }, { rootMargin: '300px 0px', threshold: 0 });

  pending.forEach(el => obs.observe(el));
  _activeCoverObserver = obs;
}

/* =============================
   BOOK TEXT RETRIEVAL
============================= */
async function ensureBookText(bookId) {
  const book = state.books.find(b => b.id === bookId);
  if (!book) return null;
  if (book.text) return book.text;

  // Fast path: text store
  const stored = await getBookText(bookId);
  if (stored) {
    book.text = stored;
    return stored;
  }

  // Slow path: re-extract from blob (old books that pre-date the text store)
  if (book.hasBlob) {
    let pdf = null;
    try {
      const blob = await getPDFBlob(bookId);
      if (!blob) return null;
      const arr = await blob.arrayBuffer();
      pdf = await pdfjsLib.getDocument({ data: arr }).promise;
      let fullText = '';
      const maxPages = Math.min(pdf.numPages, 150);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const txt = await page.getTextContent();
        fullText += txt.items.map(it => it.str).join(' ') + '\n\n';
      }
      book.text = fullText;
      // Cache it so the next call is instant
      await saveBookText(bookId, fullText);
      return fullText;
    } catch(e) {
      console.warn('ensureBookText: extraction failed for', book.title, e);
      return null;
    } finally {
      if (pdf) { try { pdf.destroy(); } catch(e) {} }
    }
  }
  return null;
}

/* =============================
   READER POSITION TRACKING
============================= */
const READER_POS_KEY  = 'loren_reader_pos';

function getReaderPositions() {
  try { return JSON.parse(localStorage.getItem(READER_POS_KEY) || '{}'); } catch(e) { return {}; }
}
function saveReaderPosition(bookId, page) {
  const pos = getReaderPositions(); pos[bookId] = page;
  localStorage.setItem(READER_POS_KEY, JSON.stringify(pos));
  // Live-update the hero ring if this book's card is visible in the Discover hero
  _updateHeroRing(bookId, page);
}
function getReaderPosition(bookId) { return getReaderPositions()[bookId] || 1; }

// Update the progress ring on a hero card without re-rendering the whole mosaic
function _updateHeroRing(bookId, page) {
  const book = state.books.find(b => b.id === bookId);
  if (!book || !book.pageCount || book.pageCount < 1) return;

  // Hero cards: each dm-hero-card contains a dm-hero-bg with data-book-id
  // We store bookId on the bgDiv so we can find it
  document.querySelectorAll('.dm-hero-bg[data-hero-book="' + bookId + '"]').forEach(function(bgDiv) {
    // Remove existing ring
    var old = bgDiv.querySelector('.progress-ring-wrap.hero-ring');
    if (old) old.remove();

    var pct      = Math.min(1, (page - 1) / book.pageCount);
    var r        = 15;
    var circ     = 2 * Math.PI * r;
    var offset   = circ * (1 - pct);
    var complete = pct >= 0.97;

    if (page <= 1) return; // no ring at page 1

    var ringWrap = document.createElement('div');
    ringWrap.className = 'progress-ring-wrap hero-ring' + (complete ? ' progress-ring-complete' : '');
    ringWrap.title     = complete
      ? 'Finished \u2014 ' + book.title
      : 'Page ' + page + ' of ' + book.pageCount + ' \u00b7 ' + Math.round(pct * 100) + '%';
    ringWrap.innerHTML =
      '<svg width="40" height="40" viewBox="0 0 40 40">' +
      '<circle class="progress-ring-bg" cx="20" cy="20" r="' + r + '"/>' +
      '<circle class="progress-ring-arc" cx="20" cy="20" r="' + r + '"' +
      ' stroke-dasharray="' + circ.toFixed(2) + '"' +
      ' stroke-dashoffset="' + offset.toFixed(2) + '"/>' +
      '</svg>';
    bgDiv.appendChild(ringWrap);
  });
}

function closeReader() { /* no-op: in-app reader removed */ }

/* =============================
   PDF OPERATIONS (download, open, attach, delete, favorite)
============================= */
async function downloadPdf(id){
  const b = state.books.find(x=>x.id===id); 
  if(!b){ toast('Missing'); return; }
  try{
    const blob = await getPDFBlob(id);
    if(!blob){ toast('No PDF stored'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = b.fileName || (b.title || 'book') + '.pdf'; 
    document.body.appendChild(a); 
    a.click(); 
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 30000);
  }catch(e){ console.error(e); toast('Download failed'); }
}

function toggleFav(id){ 
  if(state.favorites.has(id)) {
    state.favorites.delete(id); 
    saveFavs();
    toastUndo('Removed from favorites', () => {
      state.favorites.add(id);
      saveFavs();
      renderFavorites();
      // Cancel any pending 💔→🤍 timer and restore the heart silently
      clearTimeout(_heartTimers.get(id)); _heartTimers.delete(id);
      const card = document.getElementById('book-' + id);
      if (card) { const btn = card.querySelector('.favorite-btn'); if (btn) btn.innerHTML = '♥️'; }
    });
  } else { 
    state.favorites.add(id); 
    saveFavs();
    toastUndo('Added to favorites', () => {
      state.favorites.delete(id);
      saveFavs();
      renderFavorites();
      // Revert heart silently — no animation
      clearTimeout(_heartTimers.get(id)); _heartTimers.delete(id);
      const card = document.getElementById('book-' + id);
      if (card) { const btn = card.querySelector('.favorite-btn'); if (btn) btn.innerHTML = '🤍'; }
    });
  } 
}

async function deleteBook(id){ 
  const book = state.books.find(b => b.id === id);
  if (!book) return;

  // Move to trash (soft delete) — keeps PDF blob for possible restore
  state.trash.push({ book: { ...book }, deletedAt: Date.now() });
  saveTrash();
  
  // Remove from folders (keep folder even if it becomes empty)
  state.folders = state.folders.map(folder => ({
    ...folder,
    bookIds: folder.bookIds.filter(bookId => bookId !== id)
  }));
  
  // Remove from favorites
  state.favorites.delete(id);
  
  // Remove notes
  state.notes = state.notes.filter(note => note.bookId !== id);
  
  // Remove from books
  state.books = state.books.filter(b=>b.id!==id);
  albumRemove(id); // Album: remove entry so searches don't surface trashed books
  
  // Remove from session if active
  if (state.currentSession?.active) {
    state.currentSession.books.delete(id);
    saveSession();
    updateSessionIndicator();
  }
  
  // Do NOT delete PDF blob yet — restore needs it
  saveBooks();
  saveFolders();
  saveNotes();
  saveFavs();
  renderAll();
  toast('Moved to Trash · restore within 30 days');
}

// ── METADATA ENRICHMENT ──────────────────────────────────────────────
// Called at import time on the first 30 pages of extracted text.
// Mines: publication year, publisher, series hint, auto-description.
// All heuristic — gracefully returns nulls when nothing is found.

function _enrichBookMetadata(text, title) {
  const result = { year: null, publisher: null, series: null, autoDesc: null };
  const head = text.slice(0, 3000); // first ~3 pages

  // ── Publication year ── look for © YYYY or "Published YYYY" or "First published YYYY"
  const yearM = head.match(/(?:©|\bcopyright\b|\bpublished\b|\bfirst\s+published\b)[^\d]{0,10}((?:19|20)\d{2})/i)
             || head.match(/\b((?:19|20)\d{2})\b/);
  if (yearM) {
    const y = parseInt(yearM[1]);
    if (y >= 1800 && y <= new Date().getFullYear() + 1) result.year = y;
  }

  // ── Publisher ── "Published by X" / "X Publishing" / "X Press" / "X Books"
  const pubM = head.match(/(?:published\s+by|publisher[s]?[:\s]+)\s*([A-Z][A-Za-z\s&]{2,40}?)(?:\n|,|\.|Ltd|LLC|Inc)/i)
            || head.match(/([A-Z][A-Za-z\s]{2,30}?(?:Press|Publishing|Publishers|Books|House))(?:\n|,|\.)/);
  if (pubM) {
    const raw = pubM[1].trim().replace(/\s+/g, ' ');
    if (raw.length > 3 && raw.length < 50) result.publisher = raw;
  }

  // ── Series ── "Book [N] of/in the X series" / "A X Novel" / "X, #N"
  const seriesM = title.match(/#(\d+)$/)
               || title.match(/,\s*(?:Book|Vol\.?|Volume)\s*(\d+)$/i)
               || head.match(/(?:book\s+(?:one|two|three|four|\d+)\s+(?:of|in)\s+the\s+)([A-Z][A-Za-z\s]{2,40}?)(?:\s+series|\n)/i)
               || head.match(/A\s+([A-Z][A-Za-z\s]{2,30}?)\s+Novel/);
  if (seriesM) {
    const raw = (seriesM[1] || '').trim();
    if (raw.length > 1 && raw.length < 60) result.series = raw;
  }
  // Also detect from title pattern: "Title: Book N of Series"
  const titleSeriesM = title.match(/(?:^|:\s+)(?:Book|Vol(?:ume)?)\.?\s*(\d+)/i);
  if (!result.series && titleSeriesM) result.series = titleSeriesM[0].trim();

  // ── Auto-description ── extract the most information-dense sentence from
  // the first 800 words (usually the blurb, dedication, or opening paragraph).
  // Picks the longest complete sentence that doesn't start with a common stopword.
  const words = text.slice(0, 4000);
  const sentences = words.match(/[A-Z][^.!?]{30,180}[.!?]/g) || [];
  const stopStarters = /^(The|A|An|This|That|It|He|She|They|We|I|In|On|At|But|And|Or|For|If|When|While|After|Before|\d)/;
  const candidates = sentences
    .filter(s => !stopStarters.test(s.trim()) && s.split(' ').length >= 8)
    .slice(0, 10);
  if (candidates.length) {
    // Pick the sentence with the most unique meaningful words
    result.autoDesc = candidates.sort((a, b) => {
      const score = s => new Set(s.toLowerCase().match(/[a-z]{4,}/g) || []).size;
      return score(b) - score(a);
    })[0].trim().slice(0, 200);
  }

  return result;
}

// ── SERIES DETECTION ACROSS LIBRARY ─────────────────────────────────
// Scans all book titles for series patterns and suggests grouping.
// Returns array of { seriesName, books[] } for groups of 2+ books.

function detectLibrarySeries() {
  const groups = {};

  state.books.forEach(b => {
    const t = b.title || '';
    // Pattern 1: stored series field from import enrichment
    if (b.series) {
      const key = b.series.toLowerCase().trim();
      if (!groups[key]) groups[key] = { name: b.series, books: [] };
      groups[key].books.push(b);
      return;
    }
    // Pattern 2: "Title, Book N" / "Title #N" / "Title: Book N"
    const m = t.match(/^(.+?)(?:[:,\s]+(?:Book|Vol(?:ume)?|Part|#)\s*\d+|\s+#\d+)\s*$/i)
           || t.match(/^(.+?)\s+\d+$/);
    if (m) {
      const key = m[1].toLowerCase().trim();
      if (!groups[key]) groups[key] = { name: m[1].trim(), books: [] };
      groups[key].books.push(b);
    }
  });

  return Object.values(groups).filter(g => g.books.length >= 2);
}

async function openExternalPdf(id, inSession = false) {
  const b = state.books.find(x => x.id === id);
  if (!b) {
    toast('Book not found');
    return false;
  }

  try {
    const blob = await getPDFBlob(id);
    if (!blob) {
      lorenConfirm("No PDF on file. Want to attach the original now?", async () => {
        await attachPdf(id);
        // Retry after attaching
        setTimeout(() => openExternalPdf(id, inSession), 500);
      }, {safe: true});
      return false;
    }

    // Session handling
    if (inSession) {
      if (state.currentSession?.active) {
        if (state.currentSession.books.size >= MAX_SESSION_BOOKS) {
          toast(`Session limit reached (${MAX_SESSION_BOOKS} books)`);
          return false;
        }
        state.currentSession.books.add(id);
        saveSession();
        updateSessionIndicator();
      } else {
        if (!startSession(id)) {
          return false;
        }
      }
    } else {
      if (state.currentSession?.active) {
        endSession();
      }
    }

    // Open using the device's native PDF reader
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    return true;
    
  } catch (e) {
    console.error('Error opening PDF:', e);
    toast('Failed to open PDF');
    return false;
  }
}

async function attachPdf(id){
  return new Promise((res)=>{
    const inp = document.createElement('input'); 
    inp.type='file'; 
    inp.accept='.pdf';
    inp.onchange = async (e)=>{ 
      const f = e.target.files[0]; 
      if(!f) return res(false); 
      const arr = await f.arrayBuffer(); 
      const blob = new Blob([arr], {type:'application/pdf'}); 
      try{ 
        await savePDFBlob(id, blob); 
      }catch(e){ 
        console.error(e); 
      } 
      const b = state.books.find(x=>x.id===id); 
      if(b){ 
        b.hasBlob=true; 
        b.fileName=f.name; 
        saveBooks(); 
        renderAll(); 
      } 
      res(true); 
    };
    inp.click();
  });
}

/* =============================
   V2: SESSION MODE
============================= */
const MAX_SESSION_BOOKS = 5;
function promptSessionDuration() {
  const savedDuration = localStorage.getItem(PREF.SESSION_LENGTH);
  
  if (savedDuration && parseInt(savedDuration) >= 5 && parseInt(savedDuration) <= 240) {
    return {
      hasTimer: true,
      timerDuration: parseInt(savedDuration),
      skipPrompt: true
    };
  }
  
  // Ask user for duration
  const duration = prompt(
    'Session Reading: Set a timer (minutes)\n' +
    'Leave blank for untimed session\n' +
    'Recommended: 25-45 minutes\n\n' +
    'Enter minutes (5-240) or press Cancel for no timer:',
    savedDuration || '25'
  );
  
  if (duration === null) {
    return {
      hasTimer: false,
      timerDuration: 0,
      skipPrompt: false
    };
  }
  
  if (duration.trim() === '') {
    return {
      hasTimer: false,
      timerDuration: 0,
      skipPrompt: false
    };
  }
  
  const minutes = parseInt(duration);
  if (isNaN(minutes) || minutes < 5 || minutes > 240) {
    // Invalid input, proceed without timer
    return {
      hasTimer: false,
      timerDuration: 0,
      skipPrompt: false
    };
  }
  
  // Save for future use
  localStorage.setItem(PREF.SESSION_LENGTH, minutes.toString());
  document.getElementById('sessionLengthInput').value = minutes;
  
  return {
    hasTimer: true,
    timerDuration: minutes,
    skipPrompt: false
  };
}

function startSessionTimer(minutes) {
  // Clear any existing timer
  if (state.sessionTimer) {
    clearTimeout(state.sessionTimer);
    state.sessionTimer = null;
  }
  
  state.sessionPaused = false;
  state.sessionPausedAt = null;
  state.sessionElapsedMs = 0;
  const totalMs = minutes * 60 * 1000;

  function scheduleRemaining() {
    const remaining = totalMs - state.sessionElapsedMs;
    if (remaining <= 0) {
      if (state.currentSession?.active) {
        toast(`Session timer completed (${minutes} minutes)`);
        endSession();
      }
      return;
    }
    state.sessionTimer = setTimeout(() => {
      if (state.sessionPaused) return; // safety check
      if (state.currentSession?.active) {
        toast(`Session timer completed (${minutes} minutes)`);
        endSession();
      }
    }, remaining);
  }

  state._sessionTimerStart = Date.now();
  state._sessionTimerMinutes = minutes;
  state._scheduleRemaining = scheduleRemaining;
  scheduleRemaining();
}

function pauseSessionTimer() {
  if (!state.sessionPaused && state.sessionTimer) {
    clearTimeout(state.sessionTimer);
    state.sessionTimer = null;
    state.sessionElapsedMs += Date.now() - (state._sessionTimerStart || Date.now());
    state.sessionPaused = true;
    state.sessionPausedAt = Date.now();
    updatePauseBtn();
    toast('Session paused');
  }
}

function resumeSessionTimer() {
  if (state.sessionPaused) {
    state.sessionPaused = false;
    state._sessionTimerStart = Date.now();
    if (state._scheduleRemaining) state._scheduleRemaining();
    updatePauseBtn();
    toast('Session resumed');
  }
}

function updatePauseBtn() {
  const btn = document.getElementById('sessionPauseBtn');
  if (!btn) return;
  if (state.sessionPaused) {
    btn.textContent = '▶';
    btn.classList.add('paused');
    btn.title = 'Resume session';
  } else {
    btn.textContent = '⏸';
    btn.classList.remove('paused');
    btn.title = 'Pause session';
  }
}

function saveSessionToHistory() {
  if (!state.currentSession || !state.currentSession.id) return;
  
  try {
    // Clone session data without active flag
    const sessionToSave = {
      id: state.currentSession.id,
      startTime: state.currentSession.startTime,
      endTime: state.currentSession.endTime || null,
      duration: state.currentSession.duration || 0,
      hasTimer: state.currentSession.hasTimer || false,
      timerDuration: state.currentSession.timerDuration || 0,
      books: Array.from(state.currentSession.books || []),
      notes: state.currentSession.notes || [],
      metadata: state.currentSession.metadata || {}
    };
    
    // Get existing sessions
    let sessions = [];
    try {
      const saved = localStorage.getItem(SESSION_DB_KEY);
      if (saved) sessions = JSON.parse(saved);
    } catch (e) {
      console.warn('Error loading session history:', e);
    }
    
    // Add new session
    sessions.push(sessionToSave);
    
    // Keep only last 50 sessions
    if (sessions.length > 50) {
      sessions = sessions.slice(-50);
    }
    
    // Save back
    localStorage.setItem(SESSION_DB_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Error saving session history:', e);
  }
}

function startSession(bookId) {
  // Check if already at max
  if (state.currentSession?.active && 
      state.currentSession.books.size >= MAX_SESSION_BOOKS) {
    toast(`Session limit reached (${MAX_SESSION_BOOKS} books)`);
    return false;
  }

  // If no active session, prompt for duration
  if (!state.currentSession?.active) {
    const sessionConfig = promptSessionDuration();
    
    state.currentSession = {
      id: uid(),
      startTime: new Date().toISOString(),
      endTime: null,
      duration: null,
      hasTimer: sessionConfig.hasTimer,
      timerDuration: sessionConfig.timerDuration,
      books: new Set([bookId]),
      notes: [],
      active: true,
      metadata: {
        skippedPrompt: sessionConfig.skipPrompt
      }
    };

    saveSession();
    updateSessionIndicator();

    // Start timer if configured
    if (sessionConfig.hasTimer && sessionConfig.timerDuration > 0) {
      startSessionTimer(sessionConfig.timerDuration);
    }

    // Add subtle UI tightening
    document.body.classList.add('in-session');
    setTimeout(() => {
      document.body.classList.remove('in-session');
    }, 300);
  } else {
    // Add to existing session
    state.currentSession.books.add(bookId);
    saveSession();
    updateSessionIndicator();
  }

  return true;
}

function endSession() {
  if (state.currentSession && state.currentSession.active) {
    const endTime = new Date();
    const startTime = new Date(state.currentSession.startTime);
    const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
    
    state.currentSession.active = false;
    state.currentSession.endTime = endTime.toISOString();
    state.currentSession.duration = durationMinutes;
    
    // Save session to history
    saveSessionToHistory();
    
    // Clear timer
    if (state.sessionTimer) {
      clearTimeout(state.sessionTimer);
      state.sessionTimer = null;
    }
    
    saveSession();
    updateSessionIndicator();
    
    // Show session notes summary if notes were taken, otherwise plain toast
    const _sNotes = (state.currentSession.notes || []);
    if (_sNotes.length > 0) {
      setTimeout(() => _showSessionNotesModal(state.currentSession), 400);
    } else {
      toast(`Session ended (${durationMinutes} min)`);
    }
  }
}

function _showSessionNotesModal(session) {
  const sessionNoteIds = new Set((session.notes || []).map(n => n.noteId));
  const notes = state.notes.filter(n => sessionNoteIds.has(n.id));
  const durationMin = session.duration || 0;
  const books = Array.from(session.books || []).map(id => state.books.find(b => b.id === id)).filter(Boolean);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:300;display:flex;align-items:flex-end;justify-content:center;';
  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--card);border-radius:18px 18px 0 0;padding:22px 18px 32px;max-width:500px;width:100%;max-height:72vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,0.22);';
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
      <div>
        <div style="font-weight:700;font-size:16px;color:var(--text);">Session complete</div>
        <div style="font-size:12px;color:var(--muted);margin-top:3px;">${durationMin} min · ${books.length} book${books.length!==1?'s':''} · ${notes.length} note${notes.length!==1?'s':''}</div>
        ${books.length ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;font-style:italic;">${books.map(b=>b.title).join(', ')}</div>` : ''}
      </div>
      <button id="_snClose" style="background:none;border:0;font-size:18px;cursor:pointer;color:var(--muted);padding:4px 8px;flex-shrink:0;">✕</button>
    </div>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Notes from this session</div>
    <div id="_snList"></div>`;
  const list = modal.querySelector('#_snList');
  notes.forEach(note => {
    const book = state.books.find(b => b.id === note.bookId);
    const item = document.createElement('div');
    item.style.cssText = 'background:var(--glass);border-radius:12px;padding:14px;margin-bottom:8px;border-left:3px solid var(--accent);';
    const pageTag = note.page ? ` · p. ${note.page}` : '';
    item.innerHTML = `
      <div style="font-size:11px;font-weight:600;color:var(--accent);opacity:0.7;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.04em;">📖 ${book?book.title:'Unknown'}${pageTag}</div>
      ${note.quote?`<div style="font-style:italic;color:var(--accent);font-size:13px;margin-bottom:4px;padding-left:8px;border-left:2px solid rgba(10,22,41,0.2);">"${note.quote}"</div>`:''}
      <div style="font-size:14px;line-height:1.5;color:var(--text);">${note.text}</div>`;
    list.appendChild(item);
  });
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  const close = () => document.body.removeChild(overlay);
  modal.querySelector('#_snClose').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target===overlay) close(); });
}

function updateSessionIndicator() {
  const indicator = document.getElementById('sessionIndicator');
  const sessionBooks = document.getElementById('sessionBooks');
  
  if (state.currentSession && state.currentSession.active) {
    indicator.style.display = 'flex';
    
    // Update session books dots
    sessionBooks.innerHTML = '';
    const bookCount = state.currentSession.books.size;
    for (let i = 0; i < Math.min(bookCount, 8); i++) {
      const dot = document.createElement('div');
      dot.className = 'session-book-dot';
      sessionBooks.appendChild(dot);
    }
    
    if (bookCount > 8) {
      const more = document.createElement('span');
      more.textContent = `+${bookCount - 8}`;
      more.style.fontSize = '10px';
      more.style.marginLeft = '4px';
      sessionBooks.appendChild(more);
    }
  } else {
    indicator.style.display = 'none';
  }
}

function addSessionNote(bookId, noteId) {
  if (state.currentSession && state.currentSession.active) {
    if (!state.currentSession.notes) {
      state.currentSession.notes = [];
    }
    state.currentSession.notes.push({
      bookId,
      noteId,
      timestamp: new Date().toISOString()
    });
    saveSession();
  }
}
