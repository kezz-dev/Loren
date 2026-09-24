/* =====================================================================
   ui.js — Loren
   -----------------------------------------------------------------
   Generic, feature-agnostic UI plumbing: toast notifications, the
   scroll-in card animation, and the animation on/off setting that
   gates it. Nothing here knows about books, folders, or notes —
   only about the DOM and localStorage's ANIMATIONS/... prefs (via
   PREF, from state.js).

   Load this file after state.js (uses PREF.ANIMATIONS) and after
   any panel toggling has set up #libraryPanel / #favoritesPanel /
   #discoverPanel / #toast in the DOM.

   Still to fold in here later, from further down the original file:
   more-menu, panels & nav, long-press detection, folder context
   menu, nav collapse & footer, grid layout, keyboard shortcuts.

   Deliberately NOT included, even though it sat right next to this
   code in the original file:
   - COLOR_GRADIENTS / randomFolderColor / _nextFolderColorKey — these
     assign colors to folder objects, so they're going to library.js
     with the rest of the folders feature, not here.
   - LENGTH_DISPLAY / classifyLength / GENRE_KEYWORDS /
     TITLE_GENRE_SIGNALS / _WORDNET_GENRE_SEEDS / _wordnetGenreForWord /
     _wordnetEmergentGenre / detectGenres / _scoreAndRank — this is
     book-metadata classification run at import time, not UI. Also
     going to library.js.
   ===================================================================== */

/* =============================
   ANIMATION HELPERS
============================= */
function getAnimationEnabled() {
  return localStorage.getItem(PREF.ANIMATIONS) !== 'false';
}

function applyAnimationSetting(enabled) {
  document.body.classList.toggle('no-animations', !enabled);
}

let scrollObserver = null;
let _discoverShelfObservers = []; // track per-shelf horizontal observers

function applyScrollAnimation() {
  if (!getAnimationEnabled()) return;

  const libraryVisible   = document.getElementById('libraryPanel').style.display   !== 'none';
  const favoritesVisible = document.getElementById('favoritesPanel').style.display !== 'none';
  const discoverVisible  = document.getElementById('discoverPanel').style.display  !== 'none';

  let gridId = 'grid';
  if (favoritesVisible) gridId = 'favGrid';
  if (discoverVisible)  gridId = 'recGrid';

  const g = document.getElementById(gridId);
  if (!g) return;

  if (scrollObserver) scrollObserver.disconnect();
  // Disconnect old horizontal shelf observers
  _discoverShelfObservers.forEach(o => o.disconnect());
  _discoverShelfObservers = [];

  let animIndex = 0;

  scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      // Guard: card may have been removed during a re-render while observer was pending
      if (!card.isConnected) { scrollObserver.unobserve(card); return; }
      if (card.classList.contains('entering')) return;
      card.style.animationDelay = Math.min(animIndex * 50, 300) + 'ms';
      card.classList.add('entering');
      animIndex++;
      scrollObserver.unobserve(card);
      card.addEventListener('animationend', () => {
        card.classList.remove('entering');
        card.style.animationDelay = '';
      }, { once: true });
    });
  }, { threshold: 0.05, rootMargin: '60px 0px' });

  g.querySelectorAll('.card').forEach(card => {
    const rect = card.getBoundingClientRect();
    if (rect.top > window.innerHeight) {
      scrollObserver.observe(card);
    }
    // Cards already on screen appear instantly, no flash
  });

  // ── Discover: vertical fade-up for each shelf section ─────────────
  if (discoverVisible) {
    const sectionObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const sec = entry.target;
        if (!sec.isConnected) { sectionObs.unobserve(sec); return; }
        if (sec.classList.contains('entering')) return;
        sec.classList.add('entering');
        sectionObs.unobserve(sec);
        sec.addEventListener('animationend', () => sec.classList.remove('entering'), { once: true });
      });
    }, { threshold: 0.05, rootMargin: '40px 0px' });

    g.querySelectorAll('.disc-shelf-section').forEach(section => {
      const rect = section.getBoundingClientRect();
      if (rect.top > window.innerHeight) sectionObs.observe(section);
    });
    _discoverShelfObservers.push(sectionObs);

    // ── Horizontal scroll animation per shelf ──────────────────────
    g.querySelectorAll('.disc-shelf').forEach(shelf => {
      let hAnimIdx = 0;
      const hObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const card = entry.target;
          if (!card.isConnected) { hObs.unobserve(card); return; }
          if (card.classList.contains('h-entering')) return;
          card.style.animationDelay = Math.min(hAnimIdx * 40, 200) + 'ms';
          card.classList.add('h-entering');
          hAnimIdx++;
          hObs.unobserve(card);
          card.addEventListener('animationend', () => {
            card.classList.remove('h-entering');
            card.style.animationDelay = '';
          }, { once: true });
        });
      }, { root: shelf, threshold: 0.1, rootMargin: '0px 40px' });

      shelf.querySelectorAll('.disc-shelf-card').forEach(card => hObs.observe(card));
      _discoverShelfObservers.push(hObs);
    });
  }
}

/* =============================
   HELPERS
============================= */
function uid(){ 
  return crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2,9); 
}

// ── Undo state — declared here so both toast() and toastUndo() can reference them ──
let _undoToastTimer = null;  // active dismiss timer for the undo toast
let _undoFnPending  = null;  // currently pending undo function
const _heartTimers  = new Map(); // bookId → pending 💔→🤍 transition timer

function toast(msg, t=1400){ 
  const el = document.getElementById('toast'); 
  if(!el) return;
  // Only clear undo state if the undo pill is NOT currently showing.
  // A plain toast firing while the pill is live must not erase the pending undo.
  const undoPillLive = !!document.querySelector('.loren-undo-pill');
  if (!undoPillLive) {
    _undoFnPending = null;
    clearTimeout(_undoToastTimer);
  }
  el.textContent = msg; 
  el.style.display='block'; 
  clearTimeout(el._to); 
  clearTimeout(el._fadeOut);
  requestAnimationFrame(() => {
    el.classList.add('visible');
    el._fadeOut = setTimeout(() => {
      el.classList.remove('visible');
      el._to = setTimeout(() => el.style.display='none', 200);
    }, t);
  });
}

/* ── toastUndo — floating Ink Line pill ──────────────────────────────
   isDelete = false  →  2 s pill, no bar  (regular reversible actions)
   isDelete = true   →  3 s pill, blue draining bar  (permanent deletes)
─────────────────────────────────────────────────────────────────────── */
function toastUndo(msg, undoFn, isDelete) {
  // Remove any existing undo pill
  const existing = document.querySelector('.loren-undo-pill');
  if (existing) existing.remove();
  _undoFnPending = null;
  clearTimeout(_undoToastTimer);

  _undoFnPending = undoFn || null;
  const duration = 3000; // 3 s for all undo actions

  // ── Build pill ──────────────────────────────────────────────────────
  const pill = document.createElement('div');
  pill.className = 'loren-undo-pill' + (isDelete ? ' lup-delete' : '');

  if (isDelete) {
    pill.innerHTML =
      '<div class="lup-inner">' +
        '<div class="lup-top">' +
          '<span class="lup-msg">' + msg + '</span>' +
          '<div class="lup-sep"></div>' +
          '<span class="lup-undo">Undo</span>' +
        '</div>' +
        '<div class="lup-bar-track"><div class="lup-bar-fill" id="_lupBar"></div></div>' +
      '</div>';
  } else {
    pill.innerHTML =
      '<div class="lup-inner">' +
        '<span class="lup-msg">' + msg + '</span>' +
        '<div class="lup-sep"></div>' +
        '<span class="lup-undo">Undo</span>' +
      '</div>';
  }

  document.body.appendChild(pill);

  // ── Close helper ────────────────────────────────────────────────────
  const _close = (doUndo) => {
    clearTimeout(_undoToastTimer);
    pill.style.opacity = '0';
    pill.style.transform = 'translateX(-50%) translateY(-6px)';
    setTimeout(() => { if (pill.parentNode) pill.remove(); }, 200);
    if (doUndo && _undoFnPending) {
      const fn = _undoFnPending;
      _undoFnPending = null;
      try { fn(); } catch(e) { console.warn('[toastUndo]', e); }
    } else {
      _undoFnPending = null;
    }
  };

  // Tap pill body = dismiss without undo
  pill.addEventListener('click', () => _close(false));

  // Tap "Undo" = perform undo + dismiss
  const undoSpan = pill.querySelector('.lup-undo');
  if (undoSpan) {
    undoSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      _close(true);
    });
  }

  // Animate in
  requestAnimationFrame(() => requestAnimationFrame(() => {
    pill.classList.add('lup-visible');
    if (isDelete) {
      const bar = document.getElementById('_lupBar');
      if (bar) setTimeout(() => bar.classList.add('lup-draining'), 30);
    }
  }));

  // Auto-dismiss when time expires — action becomes permanent
  _undoToastTimer = setTimeout(() => _close(false), duration);
}
