/* =====================================================================
   library.js — Loren
   -----------------------------------------------------------------
   Everything about the collection itself: folder colors, folder
   CRUD/merge/multi-select, and rendering the library grid (sorting,
   book cards, favorite cards, the trash view).

   Also now includes: the import pipeline (progress bar, file
   processing queue, quick-scan post-import review, add-menu and
   folder-import-choice flows), the metadata editor modal, and
   live per-panel search/filtering.

   Six more immediate-execution wiring blocks were found and pulled
   out of this batch — same category as the folder-selection-bar one
   above, all parked under pending-for-app/ for app.js's init:
   cancel-upload-btn-wiring.js, add-menu-buttons-wiring.js,
   empty-add-btn-wiring.js, drag-drop-wiring.js (wires up the
   #grid drag&drop handlers), editor-modal-delegation-wiring.js
   (two document-level click-delegation listeners for the editor),
   and search-input-wiring.js (the #searchInput input/click
   listeners + a swipe-to-edge-creates-folder gesture listener).
   This codebase wires nearly every button at parse time rather
   than in a dedicated init function — expect more of these in
   every remaining section.

   Load this file after state.js (uses `state.folders`, `state.books`,
   `state.isSelectionMode`, `state.selectedBooks`, `saveFolders`) and
   after ui.js (uses `toast`, `toastUndo`, `uid`).

   The render code below also calls a handful of functions that don't
   exist yet in any extracted file — `coverCache`/`getCoverData` and
   `_coverTextureEnabled` (reader.js/settings.js — cover thumbnails),
   `isBookRead`/`markBookRead` (loren-ai.js — reading-pattern tracking,
   despite living under the "PANELS & NAV" banner in the original).
   All safe: they're calls inside function bodies, only resolved when
   the function actually runs, long after every script has loaded.

   NOT included here, on purpose:
   - The "Wire merge modal / action bar buttons" block that sat right
     after _folderSelectConfirmMerge in the original file. It's a
     block of document.getElementById(...).addEventListener(...) calls
     that runs immediately at script-parse time — not a function, so
     it depends on DOM elements already existing when it runs. That
     kind of boot-time wiring is app.js's job (see the PATCH A4.1/A4.2
     note in state.js — same category of thing), so it's parked for
     app.js's init sequence rather than living here. Saved as
     pending-for-app/folder-selection-bar-wiring.js.
   ===================================================================== */

/* =============================
   FOLDER COLORS
   (originally sandwiched inside "ANIMATION HELPERS" — moved here
   because these assign colors to folder objects, not UI state)
============================= */
const COLOR_GRADIENTS = {
  '#0a1629': 'linear-gradient(145deg, #16243a, #4a6080, #16243a)',
  '#4a6fa5': 'linear-gradient(145deg, #304870, #6a8fba, #304870)',
  '#667761': 'linear-gradient(145deg, #3e4e40, #708268, #3e4e40)',
  '#8c5e58': 'linear-gradient(145deg, #583a36, #8e6058, #583a36)',
  '#9c6b98': 'linear-gradient(145deg, #503256, #866a8a, #503256)',
  '#3a8b8f': 'linear-gradient(145deg, #2a5c60, #5e9498, #2a5c60)',
  '#d4a574': 'linear-gradient(145deg, #6a4e2e, #b08056, #6a4e2e)',
  '#c44536': 'linear-gradient(145deg, #5a2018, #9a4a3a, #5a2018)',
  '#6a0572': 'linear-gradient(145deg, #3a1044, #784080, #3a1044)',
  '#b05c2a': 'linear-gradient(145deg, #6a3210, #c07040, #6a3210)',
  '#e9c46a': 'linear-gradient(145deg, #6a5018, #c09040, #6a5018)',
  '#2d5a27': 'linear-gradient(145deg, #1a3a14, #4a7a3e, #1a3a14)',
  '#1e6091': 'linear-gradient(145deg, #0d3352, #2e88c4, #0d3352)',
  '#7f4f24': 'linear-gradient(145deg, #4a2a0e, #b07038, #4a2a0e)',
  '#4a4e69': 'linear-gradient(145deg, #2a2e48, #6a70a0, #2a2e48)',
  '#386641': 'linear-gradient(145deg, #1e3a22, #52926a, #1e3a22)'
};

// Random color from the full palette
const _PALETTE_KEYS = Object.keys(COLOR_GRADIENTS);
function randomFolderColor() {
  return _PALETTE_KEYS[Math.floor(Math.random() * _PALETTE_KEYS.length)];
}
// Sequential color picker — cycles through palette so batch-created folders
// never share the same colour back-to-back
function _nextFolderColorKey() {
  const randomIdx = Math.floor(Math.random() * _PALETTE_KEYS.length);
  return _PALETTE_KEYS[randomIdx];
}



/* =============================
   FOLDERS (create/delete/merge/select)
============================= */
function createFolder(name, bookIds, color) {
  // Default: cycle through palette so batch-created folders get distinct colours
  if (!color) color = _nextFolderColorKey();
  // color may be a hex key or a gradient string — resolve against ALL 5 palettes
  const _cgth = {};
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
  ].forEach(([h, gs]) => { _cgth[h] = h; gs.forEach(g => { _cgth[g] = h; }); });
  let colorKey = null;
  let gradient = color;
  if (color && color.startsWith('#') && COLOR_GRADIENTS[color]) {
    colorKey = color;
    gradient = COLOR_GRADIENTS[color];
  } else if (color) {
    colorKey = _cgth[color.trim()] || null;
  }
  const folder = {
    id: uid(),
    name,
    bookIds: Array.from(bookIds),
    color: gradient,
    colorKey: colorKey || '#0a1629',
    createdAt: new Date().toISOString(),
    isEmpty: bookIds.size === 0
  };
  state.folders.push(folder);
  saveFolders();
  return folder;
}
  

function deleteFolder(folderId) {
  const folder = state.folders.find(f => f.id === folderId);
  if (!folder) return false;
  
  // Snapshot the folder before removing it
  const snapshot = JSON.parse(JSON.stringify(folder));
  
  state.folders = state.folders.filter(f => f.id !== folderId);
  saveFolders();

  // If the user was viewing this folder, step back to library
  if (currentFolderViewId === folderId) {
    currentRenderContext = 'LIBRARY';
    currentFolderViewId = null;
  }
  renderAll();

  toastUndo(`Folder \u201c${folder.name}\u201d deleted`, () => {
    // Restore the folder in its original position if possible
    state.folders.push(snapshot);
    saveFolders();
    renderAll();
  }, true); // permanent delete → blue bar, 3 s
  return true;
}

function getBooksInFolder(folderId) {
  const folder = state.folders.find(f => f.id === folderId);
  if (!folder) return [];
  return state.books.filter(book => folder.bookIds.includes(book.id));
}

/* ═══════════════════════════════════════════════════════════════
   FOLDER MULTI-SELECT — long-press a chip to enter select mode
   Actions: Recolor · Pin first · Merge · Delete
═══════════════════════════════════════════════════════════════ */
const folderSelect = {
  active: false,
  selected: new Set()  // Set of folder IDs
};

function _folderSelectEnter(firstFolderId) {
  folderSelect.active = true;
  folderSelect.selected.clear();
  folderSelect.selected.add(firstFolderId);

  const row = document.getElementById('folderChips');
  if (row) row.classList.add('folder-select-mode');
  _folderSelectRefreshChips();
  _folderSelectShowBar();
}

function _folderSelectExit() {
  folderSelect.active = false;
  folderSelect.selected.clear();
  const row = document.getElementById('folderChips');
  if (row) row.classList.remove('folder-select-mode');
  document.querySelectorAll('.folder-chip').forEach(c => {
    c.classList.remove('folder-selected', 'folder-select-mode-dim');
  });
  const bar = document.getElementById('folderMultiBar');
  if (bar) { bar.style.display = 'none'; bar.style.transform = ''; }
}

function _folderSelectToggle(folderId) {
  if (folderSelect.selected.has(folderId)) {
    folderSelect.selected.delete(folderId);
  } else {
    folderSelect.selected.add(folderId);
  }
  _folderSelectRefreshChips();
  _folderSelectShowBar();
}

function _folderSelectRefreshChips() {
  document.querySelectorAll('.folder-chip[data-folder-id]').forEach(chip => {
    const fid = chip.dataset.folderId;
    chip.classList.toggle('folder-selected', folderSelect.selected.has(fid));
    chip.classList.toggle('folder-select-mode-dim', folderSelect.active && !folderSelect.selected.has(fid));
  });
}

function _folderSelectShowBar() {
  const bar = document.getElementById('folderMultiBar');
  const countEl = document.getElementById('fmbCount');
  if (!bar) return;
  const n = folderSelect.selected.size;
  if (countEl) countEl.textContent = n === 1 ? '1 folder' : `${n} folders`;
  // Disable merge when only 1 selected
  const mergeBtn = document.getElementById('fmbMerge');
  if (mergeBtn) {
    mergeBtn.disabled = n < 2;
    mergeBtn.style.opacity = n < 2 ? '0.35' : '1';
  }
  // Pin button: show "Unpin" if all selected are already pinned
  const pinBtn = document.getElementById('fmbPin');
  if (pinBtn && n > 0) {
    const allPinned = [...folderSelect.selected].every(id => state.folders.find(f => f.id === id)?.pinned);
    pinBtn.textContent = allPinned ? '📌 Unpin' : '📌 Pin';
  }
  // Rename button: show only when exactly 1 selected
  const renameBtn = document.getElementById('fmbRename');
  if (renameBtn) renameBtn.style.display = n === 1 ? 'inline-flex' : 'none';
  // Select All button: toggle label based on whether all are selected
  const selAllBtn = document.getElementById('fmbSelectAll');
  if (selAllBtn) {
    const allSelected = state.folders.length > 0 && state.folders.every(f => folderSelect.selected.has(f.id));
    selAllBtn.textContent = allSelected ? '📋 Deselect' : '📋 All';
  }
  if (n === 0) { _folderSelectExit(); return; }
  // Show as topbar — same pattern as book selectionTopbar
  bar.style.display = 'flex';
  bar.style.transform = 'none';
}

// ── Action: Recolor ──────────────────────────────────────────────
function _folderSelectRecolor() {
  const ids = [...folderSelect.selected];
  if (ids.length === 0) return;
  if (document.getElementById('fmbRecolorPopup')) document.getElementById('fmbRecolorPopup').remove();
  const popup = document.createElement('div');
  popup.id = 'fmbRecolorPopup';
  popup.style.cssText = 'position:fixed;z-index:500;background:var(--card);border:1px solid rgba(128,128,128,0.15);border-radius:14px;padding:12px;box-shadow:0 8px 30px rgba(0,0,0,0.18);display:flex;flex-wrap:wrap;gap:8px;max-width:240px;';
  // Position below the topbar
  const bar = document.getElementById('folderMultiBar');
  const barRect = bar.getBoundingClientRect();
  popup.style.top  = (barRect.bottom + 6) + 'px';
  popup.style.left = Math.max(10, Math.min(barRect.left + 60, window.innerWidth - 250)) + 'px';
  // Use the active palette's gradient for the dots
  const activePalette = localStorage.getItem('loren_palette') || 'foundry';
  const paletteMap = (window.FOLDER_PALETTE_DATA || {})[activePalette] || {};
  Object.keys(COLOR_GRADIENTS).forEach(hex => {
    const grad = paletteMap[hex] || COLOR_GRADIENTS[hex];
    const dot = document.createElement('div');
    dot.style.cssText = `width:28px;height:28px;border-radius:50%;background:${grad};cursor:pointer;border:2px solid transparent;transition:transform 0.15s,border-color 0.15s;`;
    dot.addEventListener('mouseenter', () => { dot.style.transform='scale(1.12)'; });
    dot.addEventListener('mouseleave', () => { dot.style.transform=''; });
    dot.addEventListener('click', () => {
      ids.forEach(id => {
        const f = state.folders.find(f => f.id === id);
        if (f) {
          f.color = grad;
          f.colorKey = hex; // keep palette switching working
        }
      });
      saveFolders();
      renderLibrary();
      // Also update chips live via applyPalette in case palette switcher is open
      if (typeof window._applyCurrentPalette === 'function') window._applyCurrentPalette();
      popup.remove();
      _folderSelectExit();
      toast(`Colour applied to ${ids.length} folder${ids.length > 1 ? 's' : ''}`);
    });
    popup.appendChild(dot);
  });
  document.body.appendChild(popup);
  setTimeout(() => {
    const close = (e) => { if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', close); } };
    document.addEventListener('click', close);
  }, 10);
}

// ── Action: Pin ──────────────────────────────────────────────────
function _folderSelectPin() {
  const ids = [...folderSelect.selected];
  if (ids.length === 0) return;
  // If all selected are already pinned → unpin; else pin all
  const allPinned = ids.every(id => state.folders.find(f => f.id === id)?.pinned);
  ids.forEach(id => {
    const f = state.folders.find(f => f.id === id);
    if (f) f.pinned = !allPinned;
  });
  // Re-sort: pinned folders first, preserving relative order within each group
  const pinned = state.folders.filter(f => f.pinned);
  const rest   = state.folders.filter(f => !f.pinned);
  state.folders = [...pinned, ...rest];
  saveFolders();
  renderLibrary();
  _folderSelectExit();
  toast(allPinned
    ? `${ids.length} folder${ids.length > 1 ? 's' : ''} unpinned`
    : `${ids.length} folder${ids.length > 1 ? 's' : ''} pinned`);
}

// ── Action: Delete ────────────────────────────────────────────────
function _folderSelectDelete() {
  const ids = [...folderSelect.selected];
  const n   = ids.length;
  lorenConfirm(`Delete ${n} folder${n > 1 ? 's' : ''}? The books inside will stay in your library.`, () => {
    ids.forEach(id => {
      state.folders = state.folders.filter(f => f.id !== id);
    });
    saveFolders();
    renderLibrary();
    _folderSelectExit();
    toast(`${n} folder${n > 1 ? 's' : ''} deleted`);
  });
}

// ── Action: Merge ────────────────────────────────────────────────
function _folderSelectOpenMerge() {
  const ids = [...folderSelect.selected];
  if (ids.length < 2) return;
  const folders = ids.map(id => state.folders.find(f => f.id === id)).filter(Boolean);
  // Suggest name = first selected folder's name
  const nameInput = document.getElementById('fmbMergeName');
  if (nameInput) nameInput.value = folders[0]?.name || 'Merged';
  const hint = document.getElementById('fmbMergeHint');
  if (hint) hint.textContent = `${folders.map(f => '"' + f.name + '"').join(', ')} → one folder`;
  const modal = document.getElementById('folderMergeModal');
  if (modal) modal.classList.add('open');
}

function _folderSelectConfirmMerge() {
  const ids = [...folderSelect.selected];
  const folders = ids.map(id => state.folders.find(f => f.id === id)).filter(Boolean);
  const nameInput = document.getElementById('fmbMergeName');
  const newName = (nameInput?.value || '').trim() || folders[0]?.name || 'Merged';
  // Collect all unique book IDs
  const allBookIds = [...new Set(folders.flatMap(f => f.bookIds))];
  const keepColor = folders[0]?.color || '#0a1629';
  // Remove old folders
  state.folders = state.folders.filter(f => !ids.includes(f.id));
  // Create merged folder
  const merged = createFolder(newName, new Set(allBookIds), keepColor);
  document.getElementById('folderMergeModal')?.classList.remove('open');
  renderLibrary();
  _folderSelectExit();
  toast(`Merged into "${newName}" · ${allBookIds.length} books`);
}

function startSelectionMode() {
  state.isSelectionMode = true;
  state.selectedBooks.clear();
  document.getElementById('selectionTopbar').classList.add('visible');
  updateSelectionCount();

  // Show "Move to..." only when inside a folder view
  const moveBtn = document.getElementById('selectionMoveToFolderBtn');
  if (moveBtn) moveBtn.style.display = currentRenderContext === 'FOLDER_VIEW' && currentFolderViewId ? '' : 'none';
  
  // Add selection mode class to grid
  const grid = document.getElementById('grid');
  if (grid) grid.classList.add('selection-mode');
  
  // Disable all open actions
  document.querySelectorAll('.action-bar.open-action').forEach(btn => {
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.5';
  });
  
  toast('Selection mode: Tap books to select');
}

function exitSelectionMode() {
  state.isSelectionMode = false;
  state.selectedBooks.clear();
  
  const selectionTopbar = document.getElementById('selectionTopbar');
  if (selectionTopbar) {
    selectionTopbar.classList.remove('visible');
  }

  const grid = document.getElementById('grid');
  if (grid) grid.classList.remove('selection-mode');

  cleanupOpenMenus();

  // Remove ALL selected classes and inline styles
  document.querySelectorAll('.card.selected').forEach(card => {
    card.classList.remove('selected');
    card.style.removeProperty('box-shadow');
    card.style.removeProperty('transform');
    card.style.removeProperty('border-color');
  });

  // Re-enable all open actions
  document.querySelectorAll('.action-bar.open-action').forEach(btn => {
    btn.style.pointerEvents = '';
    btn.style.opacity = '1';
  });

  toast('Selection mode ended');
  
  // Force re-render if needed
  if (currentRenderContext === 'LIBRARY_VIEW' || currentRenderContext === 'FOLDER_VIEW') {
    setTimeout(renderLibrary, 50);
  }
}

function toggleBookSelection(bookId) {
  if (state.selectedBooks.has(bookId)) {
    state.selectedBooks.delete(bookId);
  } else {
    state.selectedBooks.add(bookId);
  }
  
  const card = document.getElementById('book-' + bookId);
  if (card) {
    card.classList.toggle('selected', state.selectedBooks.has(bookId));
    card.style.boxShadow = state.selectedBooks.has(bookId) 
      ? '0 0 0 3px var(--select-border), 0 0 12px rgba(47,128,237,0.25), var(--shadow)' 
      : '';
  }
  
  updateSelectionCount();
  
  // Show selection topbar if we have selections
  if (state.selectedBooks.size > 0 && !state.isSelectionMode) {
    startSelectionMode();
  }
}

function updateSelectionCount() {
  const count = state.selectedBooks.size;
  document.getElementById('selectionCount').textContent = `${count} selected`;
  document.getElementById('folderBookCount').textContent = count;
  // Keep Move-to-folder button in sync with current context
  const moveBtn = document.getElementById('selectionMoveToFolderBtn');
  if (moveBtn) moveBtn.style.display = (currentRenderContext === 'FOLDER_VIEW' && currentFolderViewId) ? '' : 'none';
}


/* =============================
   RENDER LIBRARY (grid rendering, sorting, book cards)
============================= */
function getSort(){ 
  return localStorage.getItem(PREF.SORT) || 'import'; 
}

function sortBooks(booksArray) {
  const sort = getSort();
  const sorted = [...booksArray];
  if (sort === 'alpha') {
    sorted.sort((a,b) => (a.title||'').toLowerCase() > (b.title||'').toLowerCase() ? 1 : -1);
  } else if (sort === 'author') {
    sorted.sort((a,b) => {
      const authorA = (a.author||'').toLowerCase();
      const authorB = (b.author||'').toLowerCase();
      if (authorA === authorB) {
        return (a.title||'').toLowerCase() > (b.title||'').toLowerCase() ? 1 : -1;
      }
      return authorA > authorB ? 1 : -1;
    });
  } else { // import (recently added)
    sorted.sort((a,b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  }
  return sorted;
}

function renderLibrary(){
  // Flush any deferred progress ring update queued by closeInAppReader
  // when the library panel wasn't visible at close time
  if (window._pendingProgressRingUpdate) {
    const _pru = window._pendingProgressRingUpdate;
    window._pendingProgressRingUpdate = null;
    // Defer to after this render completes so the card exists in the DOM
    requestAnimationFrame(() => {
      const _card  = document.getElementById('book-' + _pru.bookId);
      const _cover = _card ? _card.querySelector('.cover') : null;
      if (_cover) _appendProgressRing(_cover, _pru.book);
    });
  }
  // Bump generation counter so any in-flight idle render from a previous call knows to stop
  renderLibrary._gen = (renderLibrary._gen || 0) + 1;
  const _myGen = renderLibrary._gen;

  // Clear grid and update counts
  grid.innerHTML = '';
  updateBookCount();

  // Ensure folderChips element exists
  let folderChips = document.getElementById('folderChips');
  if (!folderChips) {
    folderChips = document.createElement('div');
    folderChips.id = 'folderChips';
    folderChips.className = 'folder-chips-row';
    grid.parentNode.insertBefore(folderChips, grid);
  }
  folderChips.innerHTML = '';

  // ── v7: Smart filter chips row ──
  let smartFiltersRow = document.getElementById('smartFiltersRow');
  if (!smartFiltersRow) {
    smartFiltersRow = document.createElement('div');
    smartFiltersRow.id = 'smartFiltersRow';
    smartFiltersRow.className = 'smart-filters-row';
    grid.parentNode.insertBefore(smartFiltersRow, folderChips);
  }
  smartFiltersRow.innerHTML = '';

  // Keep legacy folderContainer (hidden)
  let folderContainer = document.getElementById('folderContainer');
  if (!folderContainer) {
    folderContainer = document.createElement('div');
    folderContainer.id = 'folderContainer';
    folderContainer.className = 'folder-container';
    grid.parentNode.insertBefore(folderContainer, grid);
  }
  folderContainer.style.display = 'none';
  folderContainer.innerHTML = '';

  // --- Build smart filters ---
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const _cirLog       = getCirculationLog();
  const _thirtyDays   = 30 * 24 * 60 * 60 * 1000;
  const _readingBooks = state.books.filter(b =>
    !b.isWishlist &&
    !isBookRead(b.id) &&
    _cirLog[b.id]?.checkedOut &&
    (now - _cirLog[b.id].checkedOut) < _thirtyDays &&
    getReaderPosition(b.id) > 2
  );

  const smartFilters = [
    { key: 'all',      icon: '📚', label: 'All',      count: _album._built ? Array.from(_album.byId.values()).filter(e => !e.isWishlist && !e.isTrashed).length : state.books.filter(b => !b.isWishlist).length },
    { key: 'wishlist', icon: '🛒', label: 'Wishlist', count: _album._built ? Array.from(_album.byId.values()).filter(e => e.isWishlist).length : state.books.filter(b => b.isWishlist).length },
    { key: 'reading',  icon: '📖', label: 'Reading',  count: _readingBooks.length },
    { key: 'unread',   icon: '📕', label: 'Unread',   count: state.books.filter(b => !b.isWishlist && !isBookRead(b.id) && !(_cirLog[b.id]?.checkedOut && (now - _cirLog[b.id].checkedOut) < _thirtyDays)).length },
    { key: 'read',     icon: '📗', label: 'Read',     count: state.books.filter(b => !b.isWishlist && isBookRead(b.id)).length },
    { key: 'short',    icon: LENGTH_DISPLAY.short.emoji,  label: LENGTH_DISPLAY.short.label,  count: _album._built ? (_album.byLength.get('short')  || []).length : state.books.filter(b => b.length === 'short').length,    iconScale: 1.3 },
    { key: 'medium',   icon: LENGTH_DISPLAY.medium.emoji, label: LENGTH_DISPLAY.medium.label, count: _album._built ? (_album.byLength.get('medium') || []).length : state.books.filter(b => b.length === 'medium' || !b.length).length, iconScale: 1.3 },
    { key: 'long',     icon: LENGTH_DISPLAY.long.emoji,   label: LENGTH_DISPLAY.long.label,   count: _album._built ? (_album.byLength.get('long')   || []).length : state.books.filter(b => b.length === 'long').length,    iconScale: 1.3 },
    { key: 'epic',     icon: LENGTH_DISPLAY.epic.emoji,   label: LENGTH_DISPLAY.epic.label,   count: _album._built ? (_album.byLength.get('epic')   || []).length : state.books.filter(b => b.length === 'epic').length,    iconScale: 1.3 },
    { key: 'recent',   icon: '🕐', label: 'Recent',   count: state.books.filter(b => b.addedAt && (now - b.addedAt) < sevenDays).length },
    { key: 'unknown',  icon: '👣', label: 'Unknown',  count: state.books.filter(b => {
        const a = (b.author || '').trim().toLowerCase();
        return !a || a === 'unknown' || a === 'unknown author' || a === 'n/a' || a === '-';
      }).length },
    { key: 'trash',    icon: '🗑️', label: 'Trash',    count: state.trash.length },
  ];

  smartFilters.forEach(sf => {
    if (sf.count === 0 && sf.key !== 'all' && sf.key !== 'trash') return;
    const chip = document.createElement('button');
    chip.className = 'smart-chip' + (currentSmartFilter === sf.key && !currentTagFilter ? ' active' : '');
    chip.dataset.filter = sf.key;
    // Scale up mountain/rock emojis to match optical size of other emoji
    const iconHtml = sf.iconScale
      ? `<span class="chip-icon" style="font-size:${sf.iconScale}em;line-height:1;">${sf.icon}</span>`
      : `<span class="chip-icon">${sf.icon}</span>`;
    chip.innerHTML = `${iconHtml} ${sf.label} <span style="opacity:0.6;font-size:11px;">${sf.count}</span>`;
    chip.addEventListener('click', () => {
      currentSmartFilter = sf.key;
      currentTagFilter = null;
      currentRenderContext = 'LIBRARY_VIEW';
      currentFolderViewId = null;
      requestAnimationFrame(() => renderLibrary());
    });
    smartFiltersRow.appendChild(chip);
  });

  // ── Tag filter chips ──
  const allTags = {};
  state.books.forEach(b => (b.tags || []).forEach(t => { allTags[t] = (allTags[t] || 0) + 1; }));
  const sortedTags = Object.entries(allTags).sort((a,b) => b[1]-a[1]);
  sortedTags.forEach(([tag, count]) => {
    const chip = document.createElement('button');
    chip.className = 'smart-chip' + (currentTagFilter === tag ? ' active' : '');
    chip.dataset.tag = tag;
    const icon = tag === 'to-read' ? '📌' : tag === 'favourite' ? '❤️' : tag === 'research' ? '🔬' : '#';
    chip.innerHTML = `<span class="chip-icon">${icon}</span> ${tag} <span style="opacity:0.6;font-size:11px;">${count}</span>`;
    chip.addEventListener('click', () => {
      currentTagFilter = currentTagFilter === tag ? null : tag;
      currentSmartFilter = currentTagFilter ? 'all' : currentSmartFilter;
      currentRenderContext = 'LIBRARY_VIEW';
      currentFolderViewId = null;
      requestAnimationFrame(() => renderLibrary());
    });
    smartFiltersRow.appendChild(chip);
  });

  // --- Empty state handling ---
  const emptyState = document.getElementById('libraryEmpty');

  // ── Trash view ──
  if (currentSmartFilter === 'trash') {
    grid.style.display = 'block';
    folderChips.style.display = 'none';
    emptyState.style.display = 'none';
    grid.style.gridTemplateColumns = '1fr';
    renderTrashView(grid);
    return;
  }

  const realBookCount = state.books.filter(b => !b.isWishlist).length;

  if (realBookCount === 0) {
    grid.style.display = 'none';
    folderChips.style.display = 'none';
    smartFiltersRow.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  } else {
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = ''; // reset trash override
    folderChips.style.display = 'flex';
    smartFiltersRow.style.display = '';
    emptyState.style.display = 'none';
  }

  // ----- Folder chips -----
  // Wishlist folders only appear in wishlist view; normal folders are hidden there
  const _isWishlistView = currentSmartFilter === 'wishlist';
  const _folderPool = state.folders.filter(f => _isWishlistView ? !!f.isWishlist : !f.isWishlist);

  // Apply folder sort order (pinned folders always first)
  const _folderSortPref = localStorage.getItem(PREF.FOLDER_SORT) || 'added';
  const _pinnedFolders = _folderPool.filter(f => f.pinned);
  let _unpinnedFolders = _folderPool.filter(f => !f.pinned);
  if (_folderSortPref === 'author') {
    _unpinnedFolders = _unpinnedFolders.slice().sort((a, b) =>
      (a.name || '').toLowerCase() > (b.name || '').toLowerCase() ? 1 : -1);
  } else if (_folderSortPref === 'color') {
    _unpinnedFolders = _unpinnedFolders.slice().sort((a, b) =>
      (a.colorKey || a.color || '').localeCompare(b.colorKey || b.color || ''));
  }
  // 'added' = original insertion order (no sort)
  const _sortedFolders = [..._pinnedFolders, ..._unpinnedFolders];
  _sortedFolders.forEach(folder => {
    const chip = document.createElement('div');
    chip.className = 'folder-chip';
    chip.dataset.folderId = folder.id;
    chip.dataset.colored = "true";
    
    // Use palette-aware color: look up colorKey in active palette, else fall back to stored gradient
    const _activePal = localStorage.getItem('loren_palette') || 'foundry';
    const _palMap = (window._PALETTE_GRADIENTS || {})[_activePal] || {};
    const colorVal = (folder.colorKey && _palMap[folder.colorKey])
      ? _palMap[folder.colorKey]
      : (folder.color && folder.color.trim() ? folder.color : '#3e4e40');
    chip.style.setProperty('--folder-color', colorVal);

    if (currentRenderContext === 'FOLDER_VIEW' && currentFolderViewId === folder.id) {
      chip.classList.add('active');
    }

    const name = document.createElement('span');
    name.className = 'folder-chip-name';
    name.textContent = folder.name;

    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = folder.bookIds.length || 0;

    chip.appendChild(name);
    chip.appendChild(count);

    // Pin badge
    if (folder.pinned) {
      const pin = document.createElement('span');
      pin.className = 'folder-chip-pin';
      pin.textContent = '📌';
      pin.setAttribute('aria-hidden', 'true');
      chip.appendChild(pin);
    }

    chip.addEventListener('click', () => {
      if (folderSelect.active) {
        _folderSelectToggle(folder.id);
        return;
      }
      currentRenderContext = 'FOLDER_VIEW';
      currentFolderViewId = folder.id;
      currentSmartFilter = 'all';
      renderLibrary();
    });

    folderChips.appendChild(chip);
  });

  // ── Smart Folder trigger (shown when ≥3 unorganized books exist, not in wishlist view) ──
  const unorganizedCount = state.books.filter(b =>
    !b.isWishlist && !state.folders.some(f => !f.isWishlist && f.bookIds.includes(b.id))
  ).length;
  if (!_isWishlistView && unorganizedCount >= 3) {
    const sfBtn = document.createElement('button');
    sfBtn.className = 'smart-folder-trigger';
    sfBtn.innerHTML = '✨ Smart Folders';
    sfBtn.title = 'Let Loren intelligently organize your library into folders';
    sfBtn.addEventListener('click', (e) => { e.stopPropagation(); openSmartFolderModal(); });
    folderChips.appendChild(sfBtn);
  }
  if (currentRenderContext === 'FOLDER_VIEW' && currentFolderViewId) {
    grid.innerHTML = '';
    const folder = state.folders.find(f => f.id === currentFolderViewId);
    if (!folder) {
      currentRenderContext = 'LIBRARY_VIEW';
      currentFolderViewId = null;
      _folderArrangeMode = false;
      renderLibrary();
      return;
    }

    if (folder.bookIds.length === 0) {
      _folderArrangeMode = false;
      grid.innerHTML = `
        <div style="padding:80px 24px;text-align:center;color:var(--muted);grid-column:1/-1;">
          <div style="font-size:48px;margin-bottom:16px;opacity:0.5;">📂</div>
          <div style="font-weight:600;font-size:16px;margin-bottom:8px;color:var(--text);">This folder is empty</div>
          <div style="font-size:14px;">Select books and add them to this folder</div>
        </div>
      `;
      return;
    }

    // ── Action bar: Gather hint (left) + Arrange button (right) ──
    const _gatherDismissKey = 'loren_gather_dismissed_' + folder.id;
    const _gatherDismissedAt = parseInt(localStorage.getItem(_gatherDismissKey) || '0', 10);
    const _folderSizeNow = folder.bookIds.length;
    const _gatherDismissed = _gatherDismissedAt > 0 && _gatherDismissedAt >= _folderSizeNow;

    let _folderOrphans = null;
    if (!_gatherDismissed) {
      const _allOrphans = findFolderOrphans();
      _folderOrphans = _allOrphans.find(g => g.folder.id === folder.id) || null;
    }

    const _showArrange = folder.bookIds.length >= 2;
    const _showGather  = _folderOrphans && _folderOrphans.books.length > 0;

    if (_showArrange || _showGather) {
      const folderActionBar = document.createElement('div');
      folderActionBar.style.cssText = 'grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;padding:0 2px 10px 2px;gap:8px;';

      // ── Left: gather hint pill ──
      if (_showGather) {
        const _orphanCount = _folderOrphans.books.length;
        const _orphanAuthors = [...new Set(_folderOrphans.books.map(b => b.author).filter(Boolean))];
        const _authorLabel = _orphanAuthors.length === 1
          ? _orphanAuthors[0]
          : _orphanAuthors.length === 2
            ? _orphanAuthors[0] + ' & ' + _orphanAuthors[1]
            : _orphanAuthors[0] + ' & others';

        const gatherPill = document.createElement('button');
        gatherPill.style.cssText = 'display:flex;align-items:center;gap:6px;background:transparent;border:1.5px solid rgba(128,128,128,0.2);border-radius:99px;padding:5px 12px;font-size:12px;font-weight:500;color:var(--muted);cursor:pointer;font-family:var(--font-sans);max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        gatherPill.title = `${_orphanCount} book${_orphanCount !== 1 ? 's' : ''} by ${_authorLabel} might belong here`;
        gatherPill.innerHTML = `<span style="opacity:0.8;">✦</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_orphanCount} unplaced book${_orphanCount !== 1 ? 's' : ''} · Gather</span>`;

        gatherPill.addEventListener('click', () => {
          openLibrarianModal();
          setTimeout(() => {
            const inp = document.getElementById('chatInput');
            if (inp) inp.value = 'gather';
            const sendBtn = document.getElementById('sendChatBtn');
            if (sendBtn) sendBtn.click();
            else if (typeof handleLorenMessage === 'function') handleLorenMessage('gather');
          }, 350);
        });

        // Long-press or right-click to dismiss
        let _gatherPressTimer;
        const _dismissGather = () => {
          localStorage.setItem(_gatherDismissKey, String(folder.bookIds.length));
          gatherPill.remove();
          if (!_showArrange) folderActionBar.remove();
        };
        gatherPill.addEventListener('contextmenu', e => { e.preventDefault(); _dismissGather(); });
        gatherPill.addEventListener('touchstart', () => { _gatherPressTimer = setTimeout(_dismissGather, 600); }, { passive: true });
        gatherPill.addEventListener('touchend', () => clearTimeout(_gatherPressTimer));
        gatherPill.addEventListener('touchmove', () => clearTimeout(_gatherPressTimer));

        folderActionBar.appendChild(gatherPill);
      } else {
        // Spacer so Arrange stays right-aligned
        folderActionBar.appendChild(document.createElement('span'));
      }

      // ── Right: arrange button ──
      if (_showArrange) {
        const arrangeBtn = document.createElement('button');
        arrangeBtn.innerHTML = '⠿ Arrange';
        arrangeBtn.style.cssText = 'background:transparent;border:1.5px solid rgba(128,128,128,0.2);border-radius:99px;padding:5px 14px;font-size:12px;font-weight:600;color:var(--muted);cursor:pointer;font-family:var(--font-sans);flex-shrink:0;';
        arrangeBtn.title = 'Drag books into your preferred order';
        arrangeBtn.addEventListener('click', () => enterFolderArrangeMode(currentFolderViewId));
        folderActionBar.appendChild(arrangeBtn);
      }

      grid.appendChild(folderActionBar);
    }

    folder.bookIds.forEach(bookId => {
      const book = state.books.find(b => b.id === bookId);
      if (!book) return;
      const card = createBookCard(book);
      grid.appendChild(card);
    });
    return;
  }

  // Default: render all books, or apply smart filter
  grid.innerHTML = '';
  let list = sortBooks(state.books);

// Apply smart filter
  const _filterCirLog    = getCirculationLog();
  const _filterThirtyDays = 30 * 24 * 60 * 60 * 1000;
  const _isReading = (b) =>
    !b.isWishlist &&
    !isBookRead(b.id) &&
    _filterCirLog[b.id]?.checkedOut &&
    (now - _filterCirLog[b.id].checkedOut) < _filterThirtyDays &&
    getReaderPosition(b.id) > 2;

  if (currentSmartFilter === 'reading') {
    list = list.filter(b => _isReading(b));
    // Last-opened book always first, regardless of user's chosen sort order
    list.sort((a, b) => {
      const tA = _filterCirLog[a.id]?.checkedOut || 0;
      const tB = _filterCirLog[b.id]?.checkedOut || 0;
      return tB - tA;
    });
  } else if (currentSmartFilter === 'wishlist') {
    list = list.filter(b => b.isWishlist);
  } else if (currentSmartFilter === 'unread') {
    // Unread = never opened in 30 days AND not read — excludes currently-reading
    list = list.filter(b => !b.isWishlist && !isBookRead(b.id) && !_isReading(b));
  } else if (currentSmartFilter === 'read') {
    list = list.filter(b => !b.isWishlist && isBookRead(b.id));
  } else if (currentSmartFilter === 'short') {
    list = list.filter(b => b.length === 'short');
  } else if (currentSmartFilter === 'medium') {
    list = list.filter(b => b.length === 'medium' || !b.length);
  } else if (currentSmartFilter === 'long') {
    list = list.filter(b => b.length === 'long');
  } else if (currentSmartFilter === 'epic') {
    list = list.filter(b => b.length === 'epic');
  } else if (currentSmartFilter === 'recent') {
    const sevenDaysCutoff = Date.now() - sevenDays;
    list = list.filter(b => b.addedAt && b.addedAt > sevenDaysCutoff);
  } else if (currentSmartFilter === 'unknown') {
    list = list.filter(b => {
      const a = (b.author || '').trim().toLowerCase();
      return !a || a === 'unknown' || a === 'unknown author' || a === 'n/a' || a === '-';
    });
  } else {
    // 'all' — exclude wishlist placeholders unless user explicitly chose wishlist
    list = list.filter(b => !b.isWishlist);
  }

  // Apply tag filter (stacks on top of smart filter)
  if (currentTagFilter) {
    list = list.filter(b => (b.tags || []).includes(currentTagFilter));
  }

  if (list.length === 0 && currentSmartFilter !== 'all') {
    grid.innerHTML = `<div style="padding:60px 24px;text-align:center;color:var(--muted);grid-column:1/-1;font-size:14px;">No books match this filter.</div>`;
    return;
  }

  // Render first 20 cards immediately so the view is responsive,
  // then append the rest in idle-time batches of 20 to avoid blocking the thread.
  const FIRST_BATCH = 20;
  const REST_BATCH  = 20;

  const firstSlice = list.slice(0, FIRST_BATCH);
  const restSlice  = list.slice(FIRST_BATCH);

  firstSlice.forEach(book => {
    const card = createBookCard(book);
    grid.appendChild(card);
  });

  if (restSlice.length > 0) {
    let restIdx = 0;
    function _renderNextChunk(deadline) {
      // Bail if a newer renderLibrary call has already cleared the grid
      if (renderLibrary._gen !== _myGen) return;
      let rendered = 0;
      while (restIdx < restSlice.length && rendered < 30) {
        // Stop if we're out of idle time
        if (deadline && deadline.timeRemaining && deadline.timeRemaining() < 2) break;
        const card = createBookCard(restSlice[restIdx++]);
        grid.appendChild(card);
        rendered++;
      }
      if (restIdx < restSlice.length) {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(_renderNextChunk, { timeout: 100 });
        } else {
          requestAnimationFrame(() => _renderNextChunk(null));
        }
      } else {
        _initCoverObserver();
        if (typeof window._applyCurrentPalette === 'function') window._applyCurrentPalette();
      }
    }
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(_renderNextChunk, { timeout: 100 });
    } else {
      requestAnimationFrame(() => _renderNextChunk(null));
    }
  }

  if (restSlice.length === 0) {
    _initCoverObserver();
    if (typeof window._applyCurrentPalette === 'function') window._applyCurrentPalette();
  }
} // end renderLibrary

function renderTrashView(container) {
  container.innerHTML = '';
  if (state.trash.length === 0) {
    container.innerHTML = `
      <div style="padding:80px 24px;text-align:center;color:var(--muted);">
        <div style="font-size:48px;margin-bottom:16px;opacity:0.4;">🗑️</div>
        <div style="font-weight:600;font-size:16px;color:var(--text);margin-bottom:6px;">Trash is empty</div>
        <div style="font-size:13px;">Books you remove will appear here for 30 days.</div>
      </div>`;
    return;
  }

  const header = document.createElement('div');
  header.style.cssText = 'padding:0 0 16px 0;display:flex;justify-content:space-between;align-items:center;';
  header.innerHTML = `
    <div style="font-size:13px;color:var(--muted);">Books are permanently removed after 30 days.</div>
    <button id="emptyTrashBtn" style="font-size:12px;color:#dc2626;background:none;border:1.5px solid rgba(220,38,38,0.25);padding:5px 12px;border-radius:8px;cursor:pointer;font-weight:600;">Empty Trash</button>
  `;
  container.appendChild(header);
  document.getElementById('emptyTrashBtn')?.addEventListener('click', async () => {
    lorenConfirm('Empty the trash? Every book in there will be gone for good.', async () => {
      for (const item of state.trash) {
        try { await deletePDFBlob(item.book.id); } catch(e) {}
        try { await deleteCoverData(item.book.id); } catch(e) {}
        coverCache.delete(item.book.id);
      }
      state.trash = [];
      saveTrash();
      renderLibrary();
      toast('Trash emptied');
    });
  });

  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

  state.trash.forEach(item => {
    const book = item.book;
    const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - item.deletedAt) / (24*60*60*1000)));
    
    const card = document.createElement('div');
    card.className = 'trash-card';

    const mini = document.createElement('div');
    mini.className = 'trash-cover-mini';
    mini.textContent = (book.title || '?').charAt(0).toUpperCase();
    mini._onCoverLoad = (url) => {
      if (url) { mini.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">`; }
      else { mini.textContent = (book.title || '?').charAt(0).toUpperCase(); }
    };
    // IDB-first: trash covers load instantly from saved data
    if (coverCache.has(book.id)) {
      mini._onCoverLoad(coverCache.get(book.id));
    } else {
      getCoverData(book.id).then(url => {
        if (url) {
          if (coverCache.size < COVER_CACHE_MAX) coverCache.set(book.id, url);
          mini._onCoverLoad(url);
        } else {
          mini.dataset.coverPending = book.id;
        }
      }).catch(() => { mini.dataset.coverPending = book.id; });
    }

    const info = document.createElement('div');
    info.className = 'trash-info';
    info.innerHTML = `
      <div class="trash-title">${book.title || 'Untitled'}</div>
      <div class="trash-meta">${book.author || 'Unknown author'}</div>
      <div class="trash-days">${daysLeft} day${daysLeft !== 1 ? 's' : ''} left to restore</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'trash-actions';

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'trash-restore-btn';
    restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => restoreFromTrash(book.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'trash-delete-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete permanently';
    deleteBtn.addEventListener('click', () => {
      lorenConfirm(`Permanently delete "${book.title}"? This can't be undone.`, () => permanentlyDeleteFromTrash(book.id));
    });

    actions.appendChild(restoreBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(mini);
    card.appendChild(info);
    card.appendChild(actions);
    list.appendChild(card);
  });

  container.appendChild(list);
}

  
// ── Progress ring + read badge helper ─────────────────────────
// Called after any cover.innerHTML = '' to re-append overlays.
// Safe to call multiple times — removes old ring first.
function _appendProgressRing(cover, book) {
  // Remove any existing ring/badge first (cover.innerHTML wipes them)
  cover.querySelectorAll('.progress-ring-wrap, [data-read-badge]').forEach(el => el.remove());

  // Read badge
  if (isBookRead(book.id)) {
    const badge = document.createElement('div');
    badge.dataset.readBadge = '1';
    badge.title = 'Read';
    badge.style.cssText = [
      'position:absolute;top:8px;left:8px;width:20px;height:20px;border-radius:50%;',
      'background:rgba(22,163,74,0.9);color:white;font-size:11px;font-weight:700;',
      'display:flex;align-items:center;justify-content:center;',
      'box-shadow:0 2px 6px rgba(0,0,0,0.25);z-index:2;pointer-events:none;',
      'backdrop-filter:blur(4px);',
    ].join('');
    badge.textContent = '✓';
    cover.appendChild(badge);
  }

  // Progress ring
  const pos   = getReaderPosition(book.id);
  const total = book.pageCount || 0;
  if (total > 0 && pos > 1) {
    const pct      = Math.min(1, (pos - 1) / total);
    const r        = 12;
    const circ     = 2 * Math.PI * r;
    const offset   = circ * (1 - pct);
    const complete = pct >= 0.97;
    const wrap     = document.createElement('div');
    wrap.className = 'progress-ring-wrap' + (complete ? ' progress-ring-complete' : '');
    wrap.title     = complete
      ? `Finished — ${book.title}`
      : `Page ${pos} of ${total} (${Math.round(pct * 100)}%)`;
    wrap.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle class="progress-ring-bg" cx="16" cy="16" r="${r}"/>
        <circle class="progress-ring-arc" cx="16" cy="16" r="${r}"
          stroke-dasharray="${circ.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}"/>
      </svg>`;
    cover.appendChild(wrap);
    if (complete && !isBookRead(book.id)) markBookRead(book.id);
  }
}

function createBookCard(book) {
  const card = document.createElement('div');
  card.className = 'card';
  if (book.isWishlist) card.classList.add('is-wishlist');
  card.id = 'book-' + book.id;
  card.dataset.bookId = book.id;
  card.dataset.title = book.title || 'Untitled';

  // Wishlist badge
  if (book.isWishlist) {
    const badge = document.createElement('div');
    badge.className = 'wishlist-badge';
    badge.textContent = '🛒 Wishlist';
    card.appendChild(badge);
  }

  const cover = document.createElement('div');
  cover.className = 'cover';
  cover.style.position = 'relative'; // 🔒 immediate guarantee

  // --- Create the favourite button ONCE and store it ---
  const favBtn = document.createElement('button');
  favBtn.className = 'favorite-btn';
  // Wishlist books: suppress the heart — they can't appear in Favorites panel
  if (book.isWishlist) {
    favBtn.style.display = 'none';
    favBtn.setAttribute('aria-hidden', 'true');
  } else {
    favBtn.innerHTML = state.favorites.has(book.id) ? '♥️' : '🤍';
    favBtn.title = state.favorites.has(book.id) ? 'Remove from favorites' : 'Add to favorites';
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasFavorite = state.favorites.has(book.id);
      // Cancel any in-flight 💔→🤍 transition for this book
      clearTimeout(_heartTimers.get(book.id));
      _heartTimers.delete(book.id);
      toggleFav(book.id);
      if (wasFavorite) {
        cover.classList.remove('favorited');
        favBtn.innerHTML = '💔';
        const t = setTimeout(() => { favBtn.innerHTML = '🤍'; _heartTimers.delete(book.id); }, 1000);
        _heartTimers.set(book.id, t);
      } else {
        cover.classList.add('favorited');
        favBtn.innerHTML = '♥️';
      }
      if (document.getElementById('favoritesPanel').style.display !== 'none') {
        setTimeout(() => renderFavorites(), 50);
      }
    });
  }

  if (state.favorites.has(book.id)) {
    cover.classList.add('favorited');
  }

  // Store the button reference – DO NOT DELETE IT
  cover._favBtn = favBtn;

  // --- Show placeholder immediately; try IDB cover first, then lazy observer ---
  cover.textContent = book.title ? book.title.charAt(0).toUpperCase() : '📘';
  // Apply bland texture immediately if already flagged AND texture is enabled
  if (book.coverIsBland && _coverTextureEnabled()) cover.classList.add('cover-bland');
  // favBtn lives on the CARD (not cover) so position:absolute always resolves to card corner

  cover._onCoverLoad = (coverUrl) => {
    const textureOn = _coverTextureEnabled();
    cover.innerHTML = '';
    if (coverUrl && book.coverIsBland === false) {
      // Confirmed real cover — always show image
      const img = document.createElement('img');
      img.src = coverUrl;
      img.alt = book.title;
      cover.appendChild(img);
      cover.classList.remove('cover-bland');
    } else if (!coverUrl || (book.coverIsBland === true && textureOn)) {
      // No cover, or confirmed bland with texture on — show texture
      cover.textContent = book.title ? book.title.charAt(0).toUpperCase() : '📘';
      cover.classList.add('cover-bland');
    } else if (book.coverIsBland === true && !textureOn) {
      // Confirmed bland but user prefers real image — show it anyway
      const img = document.createElement('img');
      img.src = coverUrl;
      img.alt = book.title;
      cover.appendChild(img);
      cover.classList.remove('cover-bland');
    } else {
      // coverIsBland is undefined — detect lazily
      cover.textContent = book.title ? book.title.charAt(0).toUpperCase() : '📘';
      const detector = new Image();
      detector.onload = () => {
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = detector.naturalWidth;
        tmpCanvas.height = detector.naturalHeight;
        const tmpCtx = tmpCanvas.getContext('2d');
        if (tmpCtx) {
          tmpCtx.drawImage(detector, 0, 0);
          book.coverIsBland = _isBlandCover(tmpCanvas, 248); // JPEG-compressed: use lenient threshold
        } else {
          book.coverIsBland = false;
        }
        tmpCanvas.width = 0; tmpCanvas.height = 0;
        saveBooks();
        cover.innerHTML = '';
        if (book.coverIsBland && _coverTextureEnabled()) {
          cover.textContent = book.title ? book.title.charAt(0).toUpperCase() : '📘';
          cover.classList.add('cover-bland');
        } else {
          const img = document.createElement('img');
          img.src = coverUrl;
          img.alt = book.title;
          cover.appendChild(img);
          cover.classList.remove('cover-bland');
        }
        _appendProgressRing(cover, book);
      };
      detector.onerror = () => {
        book.coverIsBland = false;
        cover.innerHTML = '';
        const img = document.createElement('img');
        img.src = coverUrl;
        cover.appendChild(img);
        _appendProgressRing(cover, book);
      };
      detector.src = coverUrl;
    }
    // favBtn is on card, not cover — do NOT re-append it here
    _appendProgressRing(cover, book);
  };

  // Fast path: check RAM cache first (synchronous — no flicker)
  if (coverCache.has(book.id)) {
    cover._onCoverLoad(coverCache.get(book.id));
  } else {
    // IDB path: covers saved during import load almost instantly (~1-5ms)
    // No PDF.js needed, no observer needed for already-imported books.
    getCoverData(book.id).then(dataUrl => {
      // Guard: card may have been removed from DOM during a re-render while
      // the async IDB read was in flight (e.g. search/filter/sort typed fast)
      if (!cover.isConnected) return;
      if (dataUrl) {
        // Seed RAM cache while we're here
        if (coverCache.size < COVER_CACHE_MAX) coverCache.set(book.id, dataUrl);
        cover._onCoverLoad(dataUrl);
      } else {
        // No cover in IDB yet — fall back to lazy observer (pre-v8 books or edge cases)
        cover.dataset.coverPending = book.id;
      }
    }).catch(() => {
      if (!cover.isConnected) return;
      cover.dataset.coverPending = book.id;
    });
  }

  card.appendChild(cover);
  card.appendChild(favBtn); // always on the card — position:absolute resolves to card corner

  // --- Info column — title, author, desc, tags, actions ---
  // card-info-col is the flex container used by List and Grid layouts
  const infoCol = document.createElement('div');
  infoCol.className = 'card-info-col';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = book.title || 'Untitled';
  infoCol.appendChild(title);

  const author = document.createElement('div');
  author.className = 'card-sub';
  author.textContent = book.author || 'Unknown author';
  infoCol.appendChild(author);

  const desc = document.createElement('div');
  desc.className = 'card-desc';
  desc.textContent = book.autoDesc || book.description || (book.text ? book.text.slice(0, 120) + '...' : 'No description available');
  infoCol.appendChild(desc);

  // ── v7: Tags display ──
  if (book.tags && book.tags.length > 0) {
    const tagsRow = document.createElement('div');
    tagsRow.className = 'book-tags-row';
    book.tags.slice(0, 3).forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.textContent = tag;
      tagsRow.appendChild(pill);
    });
    if (book.tags.length > 3) {
      const more = document.createElement('span');
      more.className = 'tag-pill';
      more.style.opacity = '0.6';
      more.textContent = `+${book.tags.length - 3}`;
      tagsRow.appendChild(more);
    }
    infoCol.appendChild(tagsRow);
  }

  const actionsBar = document.createElement('div');
  actionsBar.className = 'card-actions-bar';

  // ---- COMPACT ACTIONS for mobile 2×2 ----
  const compactActions = document.createElement('div');
  compactActions.className = 'compact-actions';

  const compactOpen = document.createElement('button');
  compactOpen.className = 'compact-open';
  compactOpen.innerHTML = '<span class="action-icon">📖</span> Open';
  compactOpen.addEventListener('click', (e) => {
  e.stopPropagation();
  e.preventDefault();
  if (book.isWishlist) { _showWishlistActionSheet(book); return; }
  cleanupOpenMenus();

  const splitMenu = document.createElement('div');
  splitMenu.className = 'open-split-menu';
  activeOpenMenu = splitMenu;

  const normalOption = document.createElement('button');
  normalOption.className = 'open-split-option';
  normalOption.innerHTML = '<div class="split-icon">📄</div><div class="split-label"><div class="split-label-main">Normal</div><div class="split-label-sub">Opens without a session</div></div>';
  normalOption.onclick = () => { cleanupOpenMenus(); openBook(book.id, 'normal'); };

  const sessionOption = document.createElement('button');
  sessionOption.className = 'open-split-option';
  sessionOption.innerHTML = '<div class="split-icon">⏱️</div><div class="split-label"><div class="split-label-main">Session</div><div class="split-label-sub">Timed, tracked reading</div></div>';
  sessionOption.onclick = () => { cleanupOpenMenus(); openBook(book.id, 'session'); };

  splitMenu.appendChild(normalOption);
  splitMenu.appendChild(sessionOption);
  document.body.appendChild(splitMenu);
  splitMenu.style.display = 'block';
  splitMenu.style.position = 'fixed';

  function _positionCompactOpenMenu() {
    const rect = compactOpen.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      cleanupOpenMenus();
      document.removeEventListener('scroll', _positionCompactOpenMenu, true);
      return;
    }
    splitMenu.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
    splitMenu.style.top = (rect.bottom + 6) + 'px';
  }
  _positionCompactOpenMenu();
  document.addEventListener('scroll', _positionCompactOpenMenu, true);

  setTimeout(() => {
    const closeMenu = (clickEvent) => {
      if (!splitMenu.contains(clickEvent.target) && !compactOpen.contains(clickEvent.target)) {
        cleanupOpenMenus();
        document.removeEventListener('click', closeMenu);
        document.removeEventListener('scroll', _positionCompactOpenMenu, true);
      }
    };
    document.addEventListener('click', closeMenu);
  }, 10);
});

  const compactMore = document.createElement('button');
  compactMore.className = 'compact-more';
  compactMore.innerHTML = '⋯';
  compactMore.addEventListener('click', (e) => {
    e.stopPropagation();
    showMoreMenu(book.id, compactMore);
  });

  compactActions.appendChild(compactOpen);
  compactActions.appendChild(compactMore);
  actionsBar.appendChild(compactActions);
  // -----------------------------------------

  // Full action rows (still exist, but will be hidden on mobile 2×2)
  const mainRow = document.createElement('div');
  mainRow.className = 'action-row-main';

  const openBtn = document.createElement('button');
openBtn.className = 'action-btn open-btn';
openBtn.innerHTML = '<span class="action-icon">📖</span><span class="action-text">Open</span>';
openBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  e.preventDefault();
  if (book.isWishlist) { _showWishlistActionSheet(book); return; }
  cleanupOpenMenus();

  const splitMenu = document.createElement('div');
  splitMenu.className = 'open-split-menu';
  activeOpenMenu = splitMenu;

  const normalOption = document.createElement('button');
  normalOption.className = 'open-split-option';
  normalOption.innerHTML = '<div class="split-icon">📄</div><div class="split-label"><div class="split-label-main">Normal</div><div class="split-label-sub">Opens without a session</div></div>';
  normalOption.onclick = () => { cleanupOpenMenus(); openBook(book.id, 'normal'); };

  const sessionOption = document.createElement('button');
  sessionOption.className = 'open-split-option';
  sessionOption.innerHTML = '<div class="split-icon">⏱️</div><div class="split-label"><div class="split-label-main">Session</div><div class="split-label-sub">Timed, tracked reading</div></div>';
  sessionOption.onclick = () => { cleanupOpenMenus(); openBook(book.id, 'session'); };

  splitMenu.appendChild(normalOption);
  splitMenu.appendChild(sessionOption);
  document.body.appendChild(splitMenu);
  splitMenu.style.display = 'block';
  splitMenu.style.position = 'fixed';
  splitMenu.style.zIndex = '1000';

  function _positionOpenBtnMenu() {
    const rect = openBtn.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      cleanupOpenMenus();
      document.removeEventListener('scroll', _positionOpenBtnMenu, true);
      return;
    }
    splitMenu.style.left = Math.min(rect.left, window.innerWidth - 150) + 'px';
    splitMenu.style.top = (rect.bottom + 4) + 'px';
  }
  _positionOpenBtnMenu();
  document.addEventListener('scroll', _positionOpenBtnMenu, true);

  setTimeout(() => {
    const closeMenu = (clickEvent) => {
      if (!splitMenu.contains(clickEvent.target) && !openBtn.contains(clickEvent.target)) {
        cleanupOpenMenus();
        document.removeEventListener('click', closeMenu);
        document.removeEventListener('scroll', _positionOpenBtnMenu, true);
      }
    };
    document.addEventListener('click', closeMenu);
  }, 10);
});
mainRow.appendChild(openBtn);

  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'action-btn download-btn';
  downloadBtn.innerHTML = '<span class="action-icon">⬇</span><span class="action-text">Download</span>';
  downloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadPdf(book.id);
  });
  mainRow.appendChild(downloadBtn);

  const notesBtn = document.createElement('button');
  notesBtn.className = 'action-btn notes-btn';
  notesBtn.innerHTML = '<span class="action-icon">📝</span><span class="action-text">Notes</span>';
  notesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openNotesModal(book.id);
  });
  mainRow.appendChild(notesBtn);

  const moreBtn = document.createElement('button');
  moreBtn.className = 'action-btn more-btn';
  moreBtn.innerHTML = '<span class="action-icon">•••</span>';
  moreBtn.title = 'More options';
  moreBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  showMoreMenu(book.id, moreBtn);
});
  mainRow.appendChild(moreBtn);

  actionsBar.appendChild(mainRow);

  const secondaryRow = document.createElement('div');
  secondaryRow.className = 'action-row-secondary';

  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn secondary';
  editBtn.innerHTML = '<span class="action-icon">✒️</span><span class="action-text">Edit</span>';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openEditor(book.id);
  });
  secondaryRow.appendChild(editBtn);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'action-btn secondary';
  removeBtn.innerHTML = '<span class="action-icon">🗑️</span><span class="action-text">Remove</span>';
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const bookFolders = state.folders.filter(f => f.bookIds.includes(book.id));
    if (bookFolders.length > 0) {
      showRemoveMenu(book.id, bookFolders, removeBtn);
    } else {
      lorenConfirm(`Remove this book? It will move to Trash and be recoverable for 30 days.`, () => deleteBook(book.id), {okLabel: 'Move to Trash'});
    }
  });
  secondaryRow.appendChild(removeBtn);

  actionsBar.appendChild(secondaryRow);
  infoCol.appendChild(actionsBar);
  card.appendChild(infoCol);

  // --- long-press for selection mode ---
  let pressTimer;
  card.addEventListener('touchstart', (e) => {
    if (state.isSelectionMode) return;
    pressTimer = setTimeout(() => {
      if (!state.isSelectionMode) {
        startSelectionMode();
        toggleBookSelection(book.id);
      }
    }, 800);
  });
  card.addEventListener('touchend', () => clearTimeout(pressTimer));
  card.addEventListener('touchmove', () => clearTimeout(pressTimer));

  card.addEventListener('mousedown', (e) => {
    if (state.isSelectionMode || e.button !== 0) return;
    pressTimer = setTimeout(() => {
      if (!state.isSelectionMode) {
        startSelectionMode();
        toggleBookSelection(book.id);
      }
    }, 800);
  });
  card.addEventListener('mouseup', () => clearTimeout(pressTimer));
  card.addEventListener('mouseleave', () => clearTimeout(pressTimer));

  // ── Poster overlay (Grid/Shelf layouts) ─────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';
  overlay.innerHTML = `
    <div class="ov-title">${book.title || 'Untitled'}</div>
    <div class="ov-author">${book.author || 'Unknown author'}</div>
    <div class="ov-actions">
      <button class="ov-btn ov-open">📖 Open</button>
      <button class="ov-btn ov-download">⬇ Download</button>
      <button class="ov-btn ov-notes">📝 Notes</button>
      <button class="ov-btn ov-edit">✒️ Edit</button>
      <button class="ov-btn ov-remove">🗑️ Remove</button>
      <button class="ov-btn ov-more">⋯</button>
    </div>`;

  overlay.querySelector('.ov-open').addEventListener('click', e => {
    e.stopPropagation();
    card.classList.remove('overlay-open');
    if (book.isWishlist) { _showWishlistActionSheet(book); return; }
    cleanupOpenMenus();
    const splitMenu = document.createElement('div');
    splitMenu.className = 'open-split-menu';
    activeOpenMenu = splitMenu;
    const normalOption = document.createElement('button');
    normalOption.className = 'open-split-option';
    normalOption.innerHTML = '<div class="split-icon">📄</div><div class="split-label"><div class="split-label-main">Normal</div><div class="split-label-sub">Opens without a session</div></div>';
    normalOption.onclick = () => { cleanupOpenMenus(); openBook(book.id, 'normal'); };
    const sessionOption = document.createElement('button');
    sessionOption.className = 'open-split-option';
    sessionOption.innerHTML = '<div class="split-icon">⏱️</div><div class="split-label"><div class="split-label-main">Session</div><div class="split-label-sub">Timed, tracked reading</div></div>';
    sessionOption.onclick = () => { cleanupOpenMenus(); openBook(book.id, 'session'); };
    splitMenu.appendChild(normalOption);
    splitMenu.appendChild(sessionOption);
    document.body.appendChild(splitMenu);
    splitMenu.style.display = 'block';
    splitMenu.style.position = 'fixed';

    const btn = overlay.querySelector('.ov-open');
    function _positionOvOpenMenu() {
      if (!btn.isConnected) { cleanupOpenMenus(); document.removeEventListener('scroll', _positionOvOpenMenu, true); return; }
      const r = btn.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) { cleanupOpenMenus(); document.removeEventListener('scroll', _positionOvOpenMenu, true); return; }
      splitMenu.style.left = Math.min(r.left, window.innerWidth - 220) + 'px';
      splitMenu.style.top = (r.bottom + 6) + 'px';
    }
    _positionOvOpenMenu();
    document.addEventListener('scroll', _positionOvOpenMenu, true);

    setTimeout(() => {
      const close = ev => {
        if (!splitMenu.contains(ev.target)) {
          cleanupOpenMenus();
          document.removeEventListener('click', close);
          document.removeEventListener('scroll', _positionOvOpenMenu, true);
        }
      };
      document.addEventListener('click', close);
    }, 10);
  });
  overlay.querySelector('.ov-download').addEventListener('click', e => {
    e.stopPropagation();
    card.classList.remove('overlay-open');
    downloadPdf(book.id);
  });
  overlay.querySelector('.ov-notes').addEventListener('click', e => {
    e.stopPropagation();
    card.classList.remove('overlay-open');
    openNotesModal(book.id);
  });
  overlay.querySelector('.ov-edit').addEventListener('click', e => {
    e.stopPropagation();
    card.classList.remove('overlay-open');
    openEditor(book.id);
  });
  overlay.querySelector('.ov-remove').addEventListener('click', e => {
    e.stopPropagation();
    card.classList.remove('overlay-open');
    const bookFolders = state.folders.filter(f => f.bookIds.includes(book.id));
    if (bookFolders.length > 0) {
      showRemoveMenu(book.id, bookFolders, overlay.querySelector('.ov-remove'));
    } else {
      lorenConfirm(`Remove this book? It will move to Trash and be recoverable for 30 days.`, () => deleteBook(book.id), {okLabel: 'Move to Trash'});
    }
  });
  overlay.querySelector('.ov-more').addEventListener('click', e => {
    e.stopPropagation();
    showMoreMenu(book.id, overlay.querySelector('.ov-more'));
  });
  card.appendChild(overlay);

  // Tap in Grid/Shelf: first tap opens overlay, second tap (on overlay) does nothing extra
  card.addEventListener('click', (e) => {
    if (e.target.closest('.action-btn') ||
        e.target.closest('.favorite-btn') ||
        e.target.closest('.open-split-menu') ||
        e.target.closest('.compact-more') ||
        e.target.closest('.compact-open') ||
        e.target.closest('.ov-btn') ||
        e.target.closest('.wishlist-badge')) {
      return;
    }
    // Wishlist books — show action sheet instead of opening
    if (book.isWishlist) {
      _showWishlistActionSheet(book);
      return;
    }
    const layout = document.getElementById('grid')?.dataset?.layout || '1';
    if (state.isSelectionMode) {
      toggleBookSelection(book.id);
      return;
    }
    if (layout === '2' || layout === '3') {
      // Toggle overlay on first tap; dismiss all others
      const isOpen = card.classList.contains('overlay-open');
      document.querySelectorAll('.card.overlay-open').forEach(c => {
        c.classList.remove('overlay-open');
        if (c._overlayHideTimer) { clearTimeout(c._overlayHideTimer); c._overlayHideTimer = null; }
      });
      if (!isOpen) {
        card.classList.add('overlay-open');
        // Auto-hide overlay after 2 seconds
        card._overlayHideTimer = setTimeout(() => {
          card.classList.remove('overlay-open');
          card._overlayHideTimer = null;
        }, 2000);
      }
      return;
    }
  });

  return card;
}
// ── Dismiss poster overlays when tapping outside ────────────────────
document.addEventListener('click', e => {
  if (!e.target.closest('.card')) {
    document.querySelectorAll('.card.overlay-open').forEach(c => c.classList.remove('overlay-open'));
  }
}, true);

function createFavoriteCard(book) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'book-' + book.id;
  card.dataset.bookId = book.id;
  card.style.cssText = `
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    min-height: 88px !important;
    padding: 8px 12px !important;
    gap: 14px !important;
    border-radius: 12px;
    background: var(--card);
    box-shadow: var(--shadow);
    border: 1px solid rgba(0,0,0,0.05);
    position: relative !important;
  `;

  // ----- HEART BUTTON (positioned on card, not cover) -----
  const favBtn = document.createElement('button');
  favBtn.className = 'favorite-btn';
  favBtn.innerHTML = state.favorites.has(book.id) ? '♥️' : '🤍';
  favBtn.title = state.favorites.has(book.id) ? 'Remove from favorites' : 'Add to favorites';
  favBtn.style.cssText = `
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    z-index: 100 !important;
    width: 28px !important;
    height: 28px !important;
    background: transparent;
    border: none;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: none;
    font-size: 14px !important;
    transition: all 0.2s ease;
  `;
  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasFavorite = state.favorites.has(book.id);
    clearTimeout(_heartTimers.get(book.id));
    _heartTimers.delete(book.id);
    toggleFav(book.id);
    if (wasFavorite) {
      favBtn.innerHTML = '💔';
      const t = setTimeout(() => { favBtn.innerHTML = '🤍'; _heartTimers.delete(book.id); }, 1000);
      _heartTimers.set(book.id, t);
    } else {
      favBtn.innerHTML = '♥️';
    }
    // Re-render favorites view to remove unfavourited card
    if (document.getElementById('favoritesPanel').style.display !== 'none') {
      setTimeout(() => renderFavorites(), 50);
    }
  });

  if (state.favorites.has(book.id)) {
    favBtn.innerHTML = '♥️';
  }

  card.appendChild(favBtn);

// ----- COVER: fixed size, image centered (NO HEART INSIDE) -----
const cover = document.createElement('div');
cover.className = 'cover';
cover.style.cssText = `
  width: 60px !important;
  min-width: 60px !important;
  height: 80px !important;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 0 !important;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
`;

// Try to load cover image — IDB first, then lazy observer fallback
cover.textContent = book.title ? book.title.charAt(0).toUpperCase() : '📘';
if (book.coverIsBland && _coverTextureEnabled()) cover.classList.add('cover-bland');
cover._onCoverLoad = (coverUrl) => {
  const textureOn = _coverTextureEnabled();
  if (coverUrl && book.coverIsBland === false) {
    // Confirmed real cover — always show image
    cover.innerHTML = '';
    const img = document.createElement('img');
    img.src = coverUrl;
    img.alt = book.title;
    cover.appendChild(img);
    cover.classList.remove('cover-bland');
  } else if (!coverUrl || (book.coverIsBland === true && textureOn)) {
    // No cover, or confirmed bland with texture on
    cover.textContent = book.title ? book.title.charAt(0).toUpperCase() : '📘';
    cover.classList.add('cover-bland');
  } else if (book.coverIsBland === true && !textureOn) {
    // Confirmed bland but user prefers real image
    cover.innerHTML = '';
    const img = document.createElement('img');
    img.src = coverUrl;
    img.alt = book.title;
    cover.appendChild(img);
    cover.classList.remove('cover-bland');
  } else {
    // Undefined — detect lazily, show initial letter while detecting
    cover.textContent = book.title ? book.title.charAt(0).toUpperCase() : '📘';
    const detector = new Image();
    detector.onload = () => {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = detector.naturalWidth;
      tmpCanvas.height = detector.naturalHeight;
      const tmpCtx = tmpCanvas.getContext('2d');
      if (tmpCtx) {
        tmpCtx.drawImage(detector, 0, 0);
        book.coverIsBland = _isBlandCover(tmpCanvas, 248); // JPEG-compressed: use lenient threshold
      } else {
        book.coverIsBland = false;
      }
      tmpCanvas.width = 0; tmpCanvas.height = 0;
      saveBooks();
      cover.innerHTML = '';
      if (book.coverIsBland && _coverTextureEnabled()) {
        cover.textContent = book.title ? book.title.charAt(0).toUpperCase() : '📘';
        cover.classList.add('cover-bland');
      } else {
        const img = document.createElement('img');
        img.src = coverUrl;
        img.alt = book.title;
        cover.appendChild(img);
        cover.classList.remove('cover-bland');
      }
    };
    detector.onerror = () => {
      book.coverIsBland = false;
      cover.innerHTML = '';
      const img = document.createElement('img');
      img.src = coverUrl;
      cover.appendChild(img);
    };
    detector.src = coverUrl;
  }
};
if (coverCache.has(book.id)) {
  cover._onCoverLoad(coverCache.get(book.id));
} else {
  getCoverData(book.id).then(dataUrl => {
    // Guard: card may have been removed from DOM during a re-render while
    // the async IDB read was in flight
    if (!cover.isConnected) return;
    if (dataUrl) {
      if (coverCache.size < COVER_CACHE_MAX) coverCache.set(book.id, dataUrl);
      cover._onCoverLoad(dataUrl);
    } else {
      cover.dataset.coverPending = book.id;
    }
  }).catch(() => { if (!cover.isConnected) return; cover.dataset.coverPending = book.id; });
}

  card.appendChild(cover);

  // ----- RIGHT COLUMN (flex column) -----
  const rightCol = document.createElement('div');
  rightCol.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    padding-right: 28px; /* make room for the heart button */
  `;

  // Title – single line, truncated
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = book.title || 'Untitled';
  title.style.cssText = `
    font-size: 15px !important;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 2px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;
  rightCol.appendChild(title);

  // Author – single line, truncated
  const author = document.createElement('div');
  author.className = 'card-sub';
  author.textContent = book.author || 'Unknown author';
  author.style.cssText = `
    font-size: 12px !important;
    color: var(--muted);
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;
  rightCol.appendChild(author);

  // ----- ACTION ROW (Open + Notes) -----
  const actionRow = document.createElement('div');
  actionRow.style.cssText = `
    display: flex;
    gap: 8px;
    margin-top: 2px;
  `;

  // Open button – compact style
  const openBtn = document.createElement('button');
  openBtn.className = 'action-btn';
  openBtn.innerHTML = '<span class="action-icon">📖</span><span class="action-text">Open</span>';
  openBtn.style.cssText = `
    height: 28px !important;
    padding: 0 12px !important;
    border-radius: 20px !important;
    font-size: 12px !important;
    background: rgba(20, 28, 45, 0.9);
    color: white;
    border: 1px solid rgba(255,255,255,0.08);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  `;
  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openExternalPdf(book.id);
  });
  actionRow.appendChild(openBtn);

  // Notes button – compact style
  const notesBtn = document.createElement('button');
  notesBtn.className = 'action-btn';
  notesBtn.innerHTML = '<span class="action-icon">📝</span><span class="action-text">Notes</span>';
  notesBtn.style.cssText = openBtn.style.cssText;
  notesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openNotesModal(book.id);
  });
  actionRow.appendChild(notesBtn);

  rightCol.appendChild(actionRow);
  card.appendChild(rightCol);

  return card;
}


/* =============================
   IMPORT PIPELINE — progress bar, file queue, quick-scan review
============================= */
let cancelRequested = false;

const SHELVING_PHRASES = [
  'Pressing pages…', 'Binding chapters…', 'Dusting covers…',
  'Cataloguing…', 'Filing away…', 'Archiving…', 'Inking spines…',
  'Arranging shelves…', 'Sorting volumes…', 'Registering titles…'
];
let _shelvingInterval = null;
let _shelvingIdx = 0;

function showProgress() {
  const container = document.getElementById('uploadProgressContainer');
  if (!container) return;
  container.style.display = 'block';
  const _pBar = document.getElementById('progressBar');
  const _pTxt = document.getElementById('progressText');
  const _pCnl = document.getElementById('cancelUploadBtn');
  const _pPause = document.getElementById('pauseUploadBtn');
  if (_pBar) _pBar.style.width = '0%';
  if (_pTxt) _pTxt.textContent = 'Starting… 0%';
  if (_pCnl) _pCnl.style.display = 'inline-block';
  if (_pPause) { _pPause.style.display = 'inline-block'; _pPause.textContent = 'Pause'; }
  const track = document.getElementById('progressTrack');
  if (track) track.style.opacity = '1';
  _shelvingIdx = 0;
  if (_shelvingInterval) clearInterval(_shelvingInterval);
  _shelvingInterval = setInterval(() => {
  _shelvingIdx = (_shelvingIdx + 1) % SHELVING_PHRASES.length;
  const bar = document.getElementById('progressBar');
  const pct = bar ? Math.round(parseFloat(bar.style.width) || 0) : 0;
  updateProgress(pct);  // This will handle the fade and update text
}, 1500);    
}
function updateProgress(percent) {
  const bar = document.getElementById('progressBar');
  const txt = document.getElementById('progressText');
  if (bar) bar.style.width = Math.round(percent) + '%';
  if (txt) {
    const phrase = SHELVING_PHRASES[_shelvingIdx] || 'Shelving…';
    const newText = phrase + ' ' + Math.round(percent) + '%';
    if (txt.textContent !== newText) {
      // Fade out, change text, fade in
      txt.style.opacity = '0';
      setTimeout(() => {
        txt.textContent = newText;
        txt.style.opacity = '1';
      }, 150);
    }
  }
}

function hideProgress() {
  if (_shelvingInterval) { clearInterval(_shelvingInterval); _shelvingInterval = null; }
  const container = document.getElementById('uploadProgressContainer');
  if (container) container.style.display = 'none';
  const cancelBtn = document.getElementById('cancelUploadBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  const pauseBtn = document.getElementById('pauseUploadBtn');
  if (pauseBtn) pauseBtn.style.display = 'none';
}

async function enqueueFiles(files) {
  if (!files || files.length === 0) {
    toast('No files selected');
    return;
  }

  // Reset the per-import tracking set so Quick Scan knows exactly which
  // books arrived in this batch (not books from previous imports).
  state._lastImportIds = new Set();

  const rawFiles = Array.from(files);
  const pdfFiles = rawFiles.filter(f => {
    if (!f || !f.name) return false;
    const name = f.name.toLowerCase().trim();
    return (
      name.endsWith('.pdf') ||
      f.type === 'application/pdf' ||
      f.type.includes('pdf')
    );
  });

  if (pdfFiles.length === 0) {
    toast('No PDF files found in selection or folder');
    return;
  }


  // Large import: process in batches of 30.
  // Pressure valve (breathing delays, error backoff, sequential processing)
  // handles memory safety — batch size only controls save checkpoint frequency.
  const BATCH_SIZE = 30;
  if (pdfFiles.length > BATCH_SIZE) {
    const totalBatches = Math.ceil(pdfFiles.length / BATCH_SIZE);
    toast(`${pdfFiles.length} PDFs — importing in ${totalBatches} batches…`);

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      if (cancelRequested) break;

      const batch = pdfFiles.slice(batchNum * BATCH_SIZE, (batchNum + 1) * BATCH_SIZE);

      state.processingQueue.push(...batch);
      state._cancelledMidBatch = false;
      await processQueue();
      const wasCancelled = state._cancelledMidBatch;

      if (wasCancelled) break;

      // Between batches: save and wait — do NOT call renderAll().
      // Every renderAll() creates a new IntersectionObserver but old ones are
      // never disconnected, so they keep holding ~100 old DOM nodes each.
      // By batch 6 that's 600+ leaked nodes + closures = crash.
      // One final renderAll() happens after all batches complete.
      if (batchNum < totalBatches - 1) {
        saveBooks();
        const _cnt = document.getElementById('bookCount');
        if (_cnt) _cnt.textContent = `${state.books.filter(b=>!b.isWishlist).length} books`;
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    if (!state._cancelledMidBatch) {
      toast(`✅ All ${pdfFiles.length} PDFs imported`);
    }
    state._cancelledMidBatch = false;
    return;
  }

  // Small import: queue everything and run once
  toast(`${pdfFiles.length} PDF file(s) queued`);
  state.processingQueue.push(...pdfFiles);
  if (!state.processing) {
    await processQueue();
  }
}

async function processQueue() {
  if (state.processingQueue.length === 0) {
    state.processing = false;    
    hideProgress();
    saveBooks();
    renderAll();
    return;
  }

  state.processing = true;
  showProgress();
  updateProgress(0);

  const total = state.processingQueue.length;
  let processed = 0;
  state._progressTotal = total;
  state._progressDone = 0;

  while (state.processingQueue.length > 0 && !cancelRequested) {
    const file = state.processingQueue.shift();

    try {
      await processSinglePdf(file);
      processed++;
      state._progressDone = processed;
      const percent = Math.min(100, (processed / total) * 100);
      updateProgress(percent);
      // Save every 5 books for crash recovery.
      // Only saveBooks() here — renderAll() during import triggers
      // generateBookCover() for every imported book which opens extra
      // PDF.js documents and causes memory crashes.
      // renderAll() runs once after the whole queue finishes.
      if (processed % 5 === 0) { saveBooks(); }
      // Adaptive breathing delay: longer pauses for very large imports
      // to give the browser GC time to reclaim PDF.js internal state.
      // 150ms for small queues, 300ms for 100+, 500ms for 500+.
      const _breathDelay = total >= 500 ? 500 : total >= 100 ? 300 : 150;
      await new Promise(resolve => setTimeout(resolve, _breathDelay));
    } catch (e) {
      console.error(`Error processing file "${file?.name || 'unknown'}":`, e);
      processed++;
      updateProgress((processed / total) * 100);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  updateProgress(100);
  state.processing = false;
  hideProgress();
  saveBooks();

  // Auto-create folder if requested from OS folder import
  let folderCreated = false;
  let createdFolderName = '';
  if (state.pendingFolderCreation && !cancelRequested) {
    const { folderName, existingIds, color: pendingColor } = state.pendingFolderCreation;
    const newIds = state.books.filter(b => !existingIds.has(b.id)).map(b => b.id);
    if (newIds.length > 0) {
      state.folders.push({
        id: uid(),
        name: folderName,
        bookIds: newIds,
        color: pendingColor || randomFolderColor(),
        createdAt: new Date().toISOString()
      });
      saveFolders();
      folderCreated = true;
      createdFolderName = folderName;
    }
  }
  state.pendingFolderCreation = null;

  // Force library render regardless of which panel is visible —
  // renderAll is visibility-aware and may skip it
  renderLibrary();
  renderAll();

  if (cancelRequested) {
    toast('Processing cancelled');
  } else if (folderCreated) {
    toast(`📁 "${createdFolderName}" created as a folder`);
    // Quick Scan still runs after a folder-creation toast — it may have
    // additional duplicates or suggestions beyond the auto-created folder.
    setTimeout(() => _maybeShowQuickScan(), 600);
  } else {
    // Quick Scan decides whether to show itself or fall back to plain toast.
    // Runs on next tick so the library has rendered first.
    setTimeout(() => _maybeShowQuickScan(), 400);
  }
  cancelRequested = false;
}

// ── Guard: only show when conditions are genuinely met ────────────────
function _maybeShowQuickScan() {
  const ids = state._lastImportIds;
  if (!ids || ids.size < 1) {
    toast('All files processed');
    return;
  }

  const dupes   = _quickScanDuplicates(ids);
  // Folder suggestions only make sense with 2+ new books
  const folders = ids.size >= 2 ? _quickScanFolders(ids) : [];

  if (dupes.length === 0 && folders.length === 0) {
    toast('All files processed');
    return;
  }

  showQuickScan(ids, dupes, folders);
}

// ── Scoped duplicate check ────────────────────────────────────────────
// Only checks new books against the rest of the library (not new vs new).
// Returns an array of { newBook, existingBook, tier } objects.
// Tier 'hard' = exact normalised title + same author. 'soft' = near match.
function _quickScanDuplicates(newIds) {
  const results = [];
  const _trashedIds = new Set((state.trash || []).map(t => t.book && t.book.id).filter(Boolean));

  const newBooks      = state.books.filter(b => newIds.has(b.id));
  const existingBooks = state.books.filter(b => !newIds.has(b.id) && !b.isWishlist && !_trashedIds.has(b.id));

  for (const nb of newBooks) {
    if (nb.isWishlist) continue;
    const nT = _normTitle(nb.title || nb.fileName || '');
    const nA = (nb.author || '').toLowerCase().trim();

    for (const eb of existingBooks) {
      const eT = _normTitle(eb.title || eb.fileName || '');
      const eA = (eb.author || '').toLowerCase().trim();

      // Hard: exact normalised title + same author (or both unknown)
      if (nT === eT && nT.length > 1) {
        const authorMatch = (!nA && !eA) || (nA && eA && nA === eA);
        if (authorMatch) {
          results.push({ newBook: nb, existingBook: eb, tier: 'hard',
            reason: 'Same title and author' });
          break;
        }
        // Same title, different/missing author — still worth flagging
        results.push({ newBook: nb, existingBook: eb, tier: 'soft',
          reason: 'Same title' });
        break;
      }

      // Soft: Levenshtein distance ≤ 2 on normalised title, same author
      if (nT.length > 4 && eT.length > 4 && nA && eA && nA === eA) {
        if (Math.abs(nT.length - eT.length) <= 3 && !_hasSeparatingToken(nT, eT)) {
          const dist = _levenshtein(nT, eT);
          if (dist <= 2) {
            results.push({ newBook: nb, existingBook: eb, tier: 'soft',
              reason: 'Very similar title, same author' });
            break;
          }
        }
      }
    }
  }

  // One match per new book — dedupe by newBook.id keeping the highest-tier
  const seen = new Map();
  for (const r of results) {
    const existing = seen.get(r.newBook.id);
    if (!existing || (r.tier === 'hard' && existing.tier !== 'hard')) {
      seen.set(r.newBook.id, r);
    }
  }
  return Array.from(seen.values());
}

// ── Scoped smart folder suggestions ──────────────────────────────────
// Runs analyzeSmartFolders() idea but restricted to new books only,
// and also detects "add to existing folder" opportunities.
// Returns array of { name, icon, color, bookIds, reason, existingFolderId? }
function _quickScanFolders(newIds) {
  const newBooks = state.books.filter(b => newIds.has(b.id) && !b.isWishlist);
  if (newBooks.length < 2) return [];

  const suggestions = [];
  const used = new Set();

  // ── 1. Does a new book match an existing folder by author? ─────────
  for (const folder of (state.folders || [])) {
    if (folder.isWishlist) continue;
    const folderAuthors = new Set();
    for (const bid of folder.bookIds) {
      const b = state.books.find(x => x.id === bid);
      const a = (b?.author || '').trim();
      if (a && a.toLowerCase() !== 'unknown') folderAuthors.add(a.toLowerCase());
    }
    if (!folderAuthors.size) continue;

    const matches = newBooks.filter(b => {
      const a = (b.author || '').trim().toLowerCase();
      return a && folderAuthors.has(a) && !used.has(b.id);
    });
    if (matches.length > 0) {
      matches.forEach(b => used.add(b.id));
      suggestions.push({
        name: folder.name,
        icon: '📁',
        color: folder.colorKey || folder.color,
        bookIds: matches.map(b => b.id),
        reason: `${matches.length} book${matches.length > 1 ? 's' : ''} match this folder`,
        existingFolderId: folder.id,
      });
    }
  }

  // ── 2. Author groups among new books ──────────────────────────────
  const byAuthor = {};
  newBooks.forEach(b => {
    const a = (b.author || '').trim();
    if (!a || a.toLowerCase() === 'unknown') return;
    if (!byAuthor[a]) byAuthor[a] = [];
    byAuthor[a].push(b);
  });
  Object.entries(byAuthor)
    .filter(([, books]) => books.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([author, books]) => {
      const fresh = books.filter(b => !used.has(b.id));
      if (fresh.length < 2) return;
      fresh.forEach(b => used.add(b.id));
      suggestions.push({
        name: author,
        icon: '✍️',
        color: null, // will use default
        bookIds: fresh.map(b => b.id),
        reason: `${fresh.length} books by the same author`,
      });
    });

  // ── 3. Genre groups among new books ───────────────────────────────
  const byGenre = {};
  newBooks.forEach(b => {
    (b.genres || []).forEach(g => {
      const k = g.trim();
      if (!k) return;
      if (!byGenre[k]) byGenre[k] = [];
      byGenre[k].push(b);
    });
  });
  Object.entries(byGenre)
    .filter(([, books]) => books.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([genre, books]) => {
      const fresh = books.filter(b => !used.has(b.id));
      if (fresh.length < 2) return;
      fresh.forEach(b => used.add(b.id));
      const icons = { fantasy:'🧝', scifi:'🚀', mystery:'🔍', romance:'💕', horror:'🎃', history:'🏛️', thriller:'🎯', biography:'🎭', poetry:'🌸', philosophy:'💭', psychology:'🧠', adventure:'⚔️' };
      suggestions.push({
        name: genre.charAt(0).toUpperCase() + genre.slice(1),
        icon: icons[genre.toLowerCase()] || '📚',
        color: null,
        bookIds: fresh.map(b => b.id),
        reason: `${fresh.length} ${genre} books`,
      });
    });

  // Cap at 4 — any more overwhelms the modal
  return suggestions.slice(0, 4);
}

// ── The modal itself ──────────────────────────────────────────────────
function showQuickScan(newIds, dupes, folders) {
  document.getElementById('_qsBackdrop')?.remove();

  const bookCount = newIds.size;
  const dupeDecisions   = new Map(); // newBook.id → 'keep'|'replace'
  const folderDecisions = new Map(); // index → true|false
  dupes.forEach(d => dupeDecisions.set(d.newBook.id, 'keep'));
  folders.forEach((_, i) => folderDecisions.set(i, false));

  // ── Backdrop (centered, blurred — matches showFolderImportChoice) ──
  const backdrop = document.createElement('div');
  backdrop.id = '_qsBackdrop';
  backdrop.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.48);
    backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
    z-index:170;display:flex;align-items:center;
    justify-content:center;padding:20px;
    animation:fadeInBackdrop 0.2s ease forwards;
  `;

  // ── Panel ──────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.style.cssText = `
    width:100%;max-width:400px;max-height:82vh;
    background:var(--card);border-radius:20px;
    box-shadow:0 24px 60px rgba(0,0,0,0.22),0 6px 20px rgba(0,0,0,0.1);
    border:1px solid rgba(255,255,255,0.08);
    display:flex;flex-direction:column;overflow:hidden;
    animation:slideUpModal 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards;
  `;

  // ── Styles injected once ───────────────────────────────────────────
  panel.innerHTML = `<style>
    @keyframes fadeInBackdrop { from{opacity:0} to{opacity:1} }
    @keyframes slideUpModal { from{transform:translateY(24px);opacity:0} to{transform:none;opacity:1} }
    ._qs-row {
      display:flex;align-items:flex-start;gap:14px;
      padding:12px 16px;border-radius:14px;cursor:default;
      border:2px solid rgba(0,0,0,0.07);background:transparent;
      margin-bottom:8px;text-align:left;width:100%;
      transition:border-color 0.16s,background 0.16s;
      font-family:var(--font-sans);
    }
    ._qs-row:last-of-type{margin-bottom:0;}
    body.dark ._qs-row{border-color:rgba(255,255,255,0.08);}
    ._qs-icon{
      width:40px;height:40px;border-radius:11px;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;
      font-size:18px;background:rgba(10,22,41,0.07);
      transition:background 0.16s;overflow:hidden;
    }
    body.dark ._qs-icon{background:rgba(255,255,255,0.07);}
    ._qs-icon img{width:100%;height:100%;object-fit:cover;border-radius:8px;}
    ._qs-info{flex:1;min-width:0;}
    ._qs-name{font-size:13px;font-weight:700;color:var(--text);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;}
    ._qs-sub{font-size:11px;color:var(--muted);margin-top:2px;line-height:1.4;}
    ._qs-note{font-size:10.5px;color:var(--muted);margin-top:3px;opacity:0.7;}
    /* Pill toggles — replace segmented control */
    ._qs-pills{display:flex;gap:5px;flex-shrink:0;align-self:center;}
    ._qs-pill{display:flex;align-items:center;gap:5px;padding:4px 11px;
      border-radius:999px;border:1.5px solid rgba(128,128,128,0.15);
      font-size:11.5px;font-weight:600;color:var(--muted);
      background:transparent;cursor:pointer;font-family:var(--font-sans);
      transition:all 0.14s;white-space:nowrap;}
    ._qs-pill-dot{width:6px;height:6px;border-radius:50%;
      background:rgba(128,128,128,0.2);flex-shrink:0;transition:background 0.14s;}
    ._qs-pill._qs-keep{background:rgba(10,22,41,0.07);
      border-color:rgba(10,22,41,0.28);color:var(--accent);}
    ._qs-pill._qs-keep ._qs-pill-dot{background:var(--accent);}
    ._qs-pill._qs-replace{background:rgba(220,38,38,0.06);
      border-color:rgba(220,38,38,0.22);color:#dc2626;}
    ._qs-pill._qs-replace ._qs-pill-dot{background:#dc2626;}
    body.dark ._qs-pill._qs-keep{background:rgba(180,200,235,0.1);
      border-color:rgba(180,200,235,0.3);color:rgba(180,200,235,0.95);}
    body.dark ._qs-pill._qs-keep ._qs-pill-dot{background:rgba(180,200,235,0.85);}
    /* Check */
    ._qs-check{width:22px;height:22px;border-radius:7px;
      border:2px solid rgba(0,0,0,0.12);background:transparent;
      cursor:pointer;flex-shrink:0;align-self:center;
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:700;color:#fff;
      transition:background 0.13s,border-color 0.13s;font-family:var(--font-sans);}
    body.dark ._qs-check{border-color:rgba(255,255,255,0.18);}
    ._qs-check._qs-checked{background:var(--accent);border-color:var(--accent);}
    body.dark ._qs-check._qs-checked{background:rgba(180,200,235,0.85);
      border-color:rgba(180,200,235,0.85);color:#0a1629;}
    /* Loren speaks — replaces section labels */
    ._qs-loren-says{padding:6px 4px 8px;font-size:12.5px;
      color:var(--muted);line-height:1.55;}
    ._qs-loren-says strong{color:var(--text);font-weight:600;}
    ._qs-divider{height:1px;background:rgba(128,128,128,0.08);margin:6px 0;}
  </style>`;

  // ── Header ─────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.style.cssText = 'padding:16px 20px 14px;border-bottom:1px solid rgba(128,128,128,0.08);flex-shrink:0;display:flex;justify-content:space-between;align-items:flex-start;';
  header.innerHTML = `
    <div>
      <div style="font-size:12px;color:var(--muted);display:flex;align-items:center;
        gap:5px;margin-bottom:5px;">
        <span style="color:var(--accent);font-size:9px;">✦</span>
        Loren &nbsp;·&nbsp; <strong style="color:var(--text);font-weight:600;">just now</strong>
      </div>
      <div style="font-size:19px;font-weight:800;color:var(--text);letter-spacing:-0.01em;margin-bottom:2px;">Quick Scan</div>
      <div style="font-size:11px;color:var(--muted);letter-spacing:0.01em;">
        ${bookCount} book${bookCount !== 1 ? 's' : ''} added — a couple of things worth checking
      </div>
    </div>
    <button id="_qsX" style="background:none;border:none;cursor:pointer;padding:2px;
      color:var(--muted);font-size:17px;line-height:1;margin:-2px -4px 0 0;opacity:0.55;">✕</button>
  `;

  // ── Body ───────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:5px;overflow-x:hidden;';

  // Helper: mini cover
  function _miniCover(book) {
    const el = document.createElement('div');
    el.className = '_qs-icon';
    el.textContent = (book.title || '?').charAt(0).toUpperCase();
    const cached = coverCache.get(book.id);
    if (cached) {
      const img = document.createElement('img'); img.src = cached; el.textContent = ''; el.appendChild(img);
    } else {
      getCoverData(book.id).then(url => {
        if (url && el.isConnected) {
          const img = document.createElement('img'); img.src = url; el.textContent = ''; el.appendChild(img);
        }
      }).catch(() => {});
    }
    return el;
  }

  // Duplicates section
  if (dupes.length > 0) {
    const sec = document.createElement('div');
    sec.style.marginBottom = '4px';
    const intro = document.createElement('div');
    intro.className = '_qs-loren-says';
    intro.textContent = 'These look like books you might already have.';
    sec.appendChild(intro);

    dupes.forEach(({ newBook, existingBook, reason }) => {
      const row = document.createElement('div');
      row.className = '_qs-row';
      row.style.cursor = 'default';

      const left = document.createElement('div');
      left.style.cssText = 'display:flex;align-items:center;gap:10px;flex:1;min-width:0;';
      left.appendChild(_miniCover(newBook));
      const info = document.createElement('div');
      info.className = '_qs-info';
      info.innerHTML = `
        <div class="_qs-name">${newBook.title || 'Untitled'}</div>
        <div class="_qs-sub">${newBook.author || 'Unknown author'}</div>
        <div class="_qs-note">${reason}</div>
      `;
      left.appendChild(info);

      // Pill toggles — Keep (default) / Replace
      const pills = document.createElement('div');
      pills.className = '_qs-pills';

      const keepPill = document.createElement('button');
      keepPill.className = '_qs-pill _qs-keep';
      keepPill.innerHTML = '<span class="_qs-pill-dot"></span>Keep';

      const repPill = document.createElement('button');
      repPill.className = '_qs-pill';
      repPill.innerHTML = '<span class="_qs-pill-dot"></span>Replace';

      [keepPill, repPill].forEach((pill, idx) => {
        pill.addEventListener('click', () => {
          keepPill.className = '_qs-pill' + (idx === 0 ? ' _qs-keep' : '');
          repPill.className  = '_qs-pill' + (idx === 1 ? ' _qs-replace' : '');
          dupeDecisions.set(newBook.id, idx === 1 ? 'replace' : 'keep');
        });
      });

      pills.appendChild(keepPill);
      pills.appendChild(repPill);
      row.appendChild(left);
      row.appendChild(pills);
      sec.appendChild(row);
    });

    body.appendChild(sec);

    // Divider before folder section if both exist
    if (folders.length > 0) {
      const div = document.createElement('div');
      div.className = '_qs-divider';
      body.appendChild(div);
    }
  }

  // Folder suggestions section
  if (folders.length > 0) {
    const sec = document.createElement('div');
    const intro = document.createElement('div');
    intro.className = '_qs-loren-says';
    intro.textContent = 'These books look like they belong together.';
    sec.appendChild(intro);

    folders.forEach((sug, i) => {
      const row = document.createElement('div');
      row.className = '_qs-row';

      const icon = document.createElement('div');
      icon.className = '_qs-icon'; icon.textContent = sug.icon;

      const info = document.createElement('div');
      info.className = '_qs-info';
      const actionLabel = sug.existingFolderId ? 'add to your existing folder' : 'create a new folder';
      info.innerHTML = `
        <div class="_qs-name">${sug.name}</div>
        <div class="_qs-sub">${sug.reason} · ${actionLabel}</div>
      `;

      const check = document.createElement('button');
      check.className = '_qs-check';
      check.addEventListener('click', () => {
        const v = !folderDecisions.get(i);
        folderDecisions.set(i, v);
        check.classList.toggle('_qs-checked', v);
        check.textContent = v ? '✓' : '';
      });

      row.appendChild(icon); row.appendChild(info); row.appendChild(check);
      sec.appendChild(row);
    });

    body.appendChild(sec);
  }

  // ── Footer ─────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.style.cssText = 'padding:11px 16px 26px;border-top:1px solid rgba(128,128,128,0.08);flex-shrink:0;display:flex;gap:9px;align-items:center;';

  const applyBtn = document.createElement('button');
  applyBtn.style.cssText = `
    flex:1;height:46px;background:var(--accent);color:#fff;
    border:none;border-radius:14px;font-size:15px;font-weight:700;
    cursor:pointer;font-family:var(--font-sans);transition:opacity 0.15s;letter-spacing:-0.01em;
  `;
  applyBtn.textContent = 'Looks good';

  const skipBtn = document.createElement('button');
  skipBtn.style.cssText = `
    font-size:13px;color:var(--muted);background:none;border:none;
    cursor:pointer;font-weight:600;padding:0 4px;font-family:var(--font-sans);
    flex-shrink:0;transition:color 0.13s;
  `;
  skipBtn.textContent = 'Skip';

  footer.appendChild(skipBtn); footer.appendChild(applyBtn);

  // ── Dismiss + Apply ────────────────────────────────────────────────
  const _close = () => {
    backdrop.style.animation = 'fadeInBackdrop 0.15s ease reverse forwards';
    setTimeout(() => backdrop.remove(), 140);
  };

  const _apply = () => {
    let n = 0;
    dupes.forEach(({ newBook, existingBook }) => {
      if (dupeDecisions.get(newBook.id) === 'replace') { deleteBook(existingBook.id); n++; }
    });
    folders.forEach((sug, i) => {
      if (!folderDecisions.get(i)) return;
      if (sug.existingFolderId) {
        const f = state.folders.find(x => x.id === sug.existingFolderId);
        if (f) { sug.bookIds.filter(id => !f.bookIds.includes(id)).forEach(id => f.bookIds.push(id)); saveFolders(); n++; }
      } else {
        createFolder(sug.name, new Set(sug.bookIds), sug.color || null); n++;
      }
    });
    if (n > 0) { renderAll(); toast(n === 1 ? '1 action applied' : `${n} actions applied`); }
    _close();
  };

  applyBtn.addEventListener('click', _apply);
  skipBtn.addEventListener('click', _close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) _close(); });

  // ── Assemble ───────────────────────────────────────────────────────
  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);

  panel.querySelector('#_qsX').addEventListener('click', _close);
}

// ── Quick Scan ends ───────────────────────────────────────────────────

// Wraps a promise with a timeout. If the promise doesn't resolve within
// `ms` milliseconds, it rejects with a timeout error instead of hanging forever.
function withTimeout(promise, ms, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function processSinglePdf(file) {
  let pdf = null;
  try {
    let arr = await file.arrayBuffer();
    // 30-second timeout — if PDF.js worker is killed by the OS (OOM on mobile),
    // the promise hangs forever with no error. This ensures the queue moves on.
    pdf = await withTimeout(
      pdfjsLib.getDocument({ data: arr }).promise,
      30000,
      `Loading "${file.name}"`
    );

    // PDF loaded successfully — from this point on we NEVER skip the book.
    // Any failure in extraction, blob save, or cover gen is caught locally.
    // Only a failure BEFORE this line (PDF unreadable/corrupted) skips the book.
    let bookPushed = false;
    try {

    // --- Filename cleanup helper (Tier 4 fallback) ---
    // Strips ISBNs, version tags, underscores, hyphens, and formats properly.
    function _cleanFilename(name) {
      let s = name.replace(/\.pdf$/i, '');
      // Remove leading/trailing ISBNs (10 or 13 digits)
      s = s.replace(/^\d{10,13}[-_\s]*/,'').replace(/[-_\s]*\d{10,13}$/,'');
      // Remove version/edition noise
      s = s.replace(/[-_\s]*(?:v\d+|final|print|web|draft|ebook|epub|scan|ocr|rev\d*|\(?\d{4}\)?)\s*$/gi, '');
      // Replace separators with spaces
      s = s.replace(/[_\-]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
      // Title-case if all-lowercase or all-uppercase
      if (s === s.toLowerCase() || s === s.toUpperCase()) {
        s = s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      }
      return s || name.replace(/\.pdf$/i, '') || 'Untitled';
    }

    // --- Metadata noise filter ---
    // Returns true if a metadata string is junk and should be ignored.
    function _isNoisyMeta(str) {
      if (!str || !str.trim()) return true;
      const s = str.trim();
      // Pure numeric (ISBN, ID)
      if (/^\d+$/.test(s)) return true;
      // Word export artifacts
      if (/^microsoft\s+word/i.test(s)) return true;
      if (/^untitled/i.test(s)) return true;
      if (/^document\d*$/i.test(s)) return true;
      // Generic software titles
      if (/^(adobe|indesign|quark|pages|openoffice|libreoffice)/i.test(s)) return true;
      // Filename leaked into metadata
      if (/\.(doc|docx|indd|pages|odt|tex)$/i.test(s)) return true;
      // Just a file path
      if (/[\/\\]/.test(s)) return true;
      return false;
    }

    // --- Author name validator ---
    // Returns true if a candidate string looks like a real author name.
    const _AUTHOR_BLOCKLIST = new Set([
      'chapter','part','section','prologue','epilogue','introduction','preface',
      'foreword','contents','index','appendix','bibliography','acknowledgements',
      'acknowledgments','table of contents','new york','los angeles','san francisco',
      'oxford university press','cambridge university press','penguin books',
      'harper collins','harpercollins','random house','simon schuster',
      'all rights reserved','printed in','first published','published by',
      'copyright','isbn','library of congress','cataloging','publisher',
    ]);
    // First-word structural prefixes — "Chapter One", "Part Three", "Book II" etc.
    const _STRUCTURAL_PREFIXES = new Set([
      'chapter','part','section','book','volume','act','scene','unit',
      'lesson','module','appendix','exhibit','figure','table','note',
    ]);
    function _isValidAuthor(str) {
      if (!str || str.length < 4) return false;
      const s = str.trim();
      if (_AUTHOR_BLOCKLIST.has(s.toLowerCase())) return false;
      const words = s.split(/\s+/);
      if (words.length < 2) return false;
      // Must not be suspiciously long (> 5 words is likely a title/phrase)
      if (words.length > 5) return false;
      // Must not contain digits
      if (/\d/.test(s)) return false;
      // Must not be all-caps (likely a section header)
      if (s === s.toUpperCase() && s.length > 6) return false;
      // Reject "Chapter One", "Part Three", "Book II" style structural phrases
      if (_STRUCTURAL_PREFIXES.has(words[0].toLowerCase())) return false;
      return true;
    }

    let title  = _cleanFilename(file.name);
    let author = '';

    let book_year = null, book_pub = null, book_series = null, book_autoDesc = null;

    // --- Step 1: Read metadata — validated, not blind ---
    let metadataInfo = {};
    let metadataSetTitle = false;
    try {
      const md = await pdf.getMetadata();
      if (md && md.info) {
        metadataInfo = md.info;
        // Only accept title if it doesn't look like software noise
        if (md.info.Title && !_isNoisyMeta(md.info.Title)) {
          title = md.info.Title.trim();
          metadataSetTitle = true;
        }
        // Only accept author if it passes the name validator
        if (md.info.Author && !_isNoisyMeta(md.info.Author) && _isValidAuthor(md.info.Author.trim())) {
          author = md.info.Author.trim();
        }
      }
    } catch (e) {
      // metadata unavailable — will try text fallback below
    }

    // --- Step 2: Text extraction (first 30 pages during import) ---
    // 30 pages is ample for genre detection, length classification, and author
    // fallback. Full text is saved to IndexedDB via saveBookText below and can
    // be re-extracted on demand by ensureBookText() for quote search / trivia.
    // Keeping this low prevents ~200KB string allocations per book during import.
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 30);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const txt  = await page.getTextContent();
      fullText  += txt.items.map(it => it.str).join(' ') + '\n\n';
    }
    if (pdf.numPages > maxPages) {
      fullText += `\n\n[Text extraction limited to first ${maxPages} pages during import — full text loads on demand]`;
    }

    // --- Step 2b: Font-size heuristic on page 1 ---
    // PDF.js exposes the transform matrix for every text item.
    // transform[3] encodes the font scale — larger = more prominent.
    // On a properly typeset title page: largest text = title, second = author.
    // We only use this when metadata left us with nothing better.
    // Only run font heuristic if metadata didn't give us a valid title.
    // Using a flag (not string comparison) avoids a false-positive when the
    // metadata title coincidentally matches the cleaned filename.
    const _needsTitle  = !metadataSetTitle;
    const _needsAuthor = !author;
    if (_needsTitle || _needsAuthor) {
      try {
        const pg1   = await pdf.getPage(1);
        const tc    = await pg1.getTextContent({ includeMarkedContent: false });
        // Build items: { text, size } filtering out whitespace-only
        const items = tc.items
          .filter(it => it.str && it.str.trim().length > 1)
          .map(it => ({
            text: it.str.trim(),
            size: it.transform ? Math.abs(it.transform[3]) : 0
          }))
          .filter(it => it.size > 4); // ignore hairline/invisible text

        if (items.length > 0) {
          // Group by size — merge items within 1pt of each other into clusters
          const clusters = [];
          const sorted = [...items].sort((a,b) => b.size - a.size);
          for (const item of sorted) {
            const existing = clusters.find(c => Math.abs(c.size - item.size) <= 1.5);
            if (existing) {
              existing.texts.push(item.text);
            } else {
              clusters.push({ size: item.size, texts: [item.text] });
            }
          }
          // Largest cluster = title candidate, second = author candidate
          const titleCluster  = clusters[0];
          const authorCluster = clusters[1];

          if (_needsTitle && titleCluster) {
            const candidate = titleCluster.texts.slice(0, 3).join(' ').trim();
            if (candidate.length > 2 && !_isNoisyMeta(candidate)) {
              title = candidate;
            }
          }
          if (_needsAuthor && authorCluster) {
            const candidate = authorCluster.texts.slice(0, 2).join(' ').trim();
            if (_isValidAuthor(candidate)) {
              author = candidate;
            }
          }
        }
      } catch(e) {
        // font heuristic failed — text patterns will try next
      }
    }

    // --- Step 3: Author fallback from text patterns ---
    // Only runs if font heuristic didn't find an author.
    // Tightened patterns with a blocklist filter on every candidate.
    if (!author) {
      try {
        let scanText = '';
        const scanPages = Math.min(pdf.numPages, 3);
        for (let i = 1; i <= scanPages; i++) {
          const page = await pdf.getPage(i);
          const txt  = await page.getTextContent();
          scanText  += txt.items.map(it => it.str).join(' ') + ' ';
          if (scanText.length > 5000) break;
        }

        const nameCore = '([A-Z](?:\\.[A-Z])*\\.?(?:\\s+(?:van|de|le|la|von|der|den))?(?:\\s+[A-Z](?:\\.[A-Z])*\\.?|\\s+[A-Z][a-z\'\\-]+){1,4}|[A-Z][a-z\'\\-]+(?:\\s+(?:van|de|le|la|von|der|den))?(?:\\s+[A-Z][a-z\'\\-]+){1,3})';
        const patterns = [
          new RegExp('\\bby\\s+' + nameCore),
          new RegExp('\\bwritten\\s+by\\s+' + nameCore, 'i'),
          new RegExp('\\bauthor[:\\s]+' + nameCore, 'i'),
          /([A-Z][a-z'\-]+(?:\s+[A-Z][a-z'\-]+){1,3})\s+(?:Author|Writer)/,
        ];

        for (const pat of patterns) {
          const m = scanText.match(pat);
          if (m && m[1]) {
            const candidate = m[1].trim();
            if (_isValidAuthor(candidate)) {
              author = candidate;
              break;
            }
          }
        }

        // Last resort: find a standalone name-like line in the first 1000 chars
        // but only if it passes the strict validator (blocklist + word count + no digits)
        if (!author) {
          const lines = scanText.slice(0, 1000).split(/[\n\r]+|(?<=[.!?])\s+/);
          for (const line of lines) {
            const s = line.trim();
            if (_isValidAuthor(s) && /^[A-Z]/.test(s)) {
              author = s;
              break;
            }
          }
        }
      } catch (e) {
        // author stays empty — better than crashing
      }
    }

    // --- Step 3b: Enrich metadata from text (year, publisher, series, auto-description) ---
    // Runs AFTER all existing steps complete. Pure read-only on fullText — no PDF.js calls,
    // no blob writes, no state changes. Wrapped so ANY failure is silently swallowed
    // and the import continues exactly as if Step 3b didn't exist.
    try {
      const _enriched = _enrichBookMetadata(fullText, title);
      if (_enriched.year      && !book_year)   book_year      = _enriched.year;
      if (_enriched.publisher && !book_pub)    book_pub       = _enriched.publisher;
      if (_enriched.series)                    book_series    = _enriched.series;
      if (_enriched.autoDesc)                  book_autoDesc  = _enriched.autoDesc;
    } catch(e) {
      // Enrichment failed — import continues normally with nulls
    }

    // --- Step 3c: Normalize "Last, First" author format ---
    // PDF metadata sometimes stores authors as "Riordan, Rick" (bibliographic style).
    // Detect the pattern and flip it to "Rick Riordan" for display.
    if (author) {
      const _commaFlip = author.match(/^([A-Za-zÀ-ÿ'\-\.]+(?:\s+[A-Za-zÀ-ÿ'\-\.]+)*),\s*(.+)$/);
      if (_commaFlip) {
        // Only flip if it looks like a name (not "Jr., III" or similar edge cases)
        const _last = _commaFlip[1].trim();
        const _first = _commaFlip[2].trim();
        if (_first.length > 0 && _last.length > 1) {
          author = _first + ' ' + _last;
        }
      }
    }

    // --- Step 4: Build book object ---
    const genres = detectGenres(fullText, metadataInfo);
    const length = classifyLength(fullText, pdf.numPages);

    const book = {
      id: uid(),
      title,
      author,
      text: fullText,
      dateAdded: new Date().toISOString(),
      addedAt: Date.now(),
      fileName: file.name,
      hasBlob: true,
      description: book_autoDesc || fullText.slice(0, 160),
      autoDesc: book_autoDesc || null,
      year:     book_year      || null,
      publisher:book_pub       || null,
      series:   book_series    || null,
      genres,
      length,
      pageCount: pdf.numPages || 0,
      tags: []
    };

    // --- Duplicate check ---
    const _dupExisting = state.books.find(b => {
      const sameFile = b.fileName && book.fileName &&
        b.fileName.toLowerCase() === book.fileName.toLowerCase();
      if (sameFile) return true;
      const nA = _normTitle(b.title || b.fileName || '');
      const nB = _normTitle(book.title || book.fileName || '');
      if (!nA || !nB || nA !== nB) return false;
      if (_hasSeparatingToken(nA, nB)) return false;
      if (_pageCountDistinct(b, book)) return false;
      const aA = (b.author || '').toLowerCase().trim();
      const aB = (book.author || '').toLowerCase().trim();
      if (aA && aB && aA !== aB) return false;
      return true;
    });
    if (_dupExisting) {
      try {
        const _existing = JSON.parse(localStorage.getItem(LOREN_NOTIF_KEY) || 'null');
        if (!_existing || _existing.type !== 'duplicate') {
          localStorage.setItem(LOREN_NOTIF_KEY, JSON.stringify({
            type: 'duplicate',
            msg: `Just noticed — "${book.title}" might already be in your library. Ask me to "find duplicates" anytime and I'll pull up the full list.`
          }));
          showLorenDot();
        }
      } catch(e) {}
    }

    state.books.push(book);
    albumInsert(book); // Album: index new book immediately — don't wait for saveBooks()
    if (!state._lastImportIds) state._lastImportIds = new Set();
    state._lastImportIds.add(book.id); // Quick Scan: track this import session
    _checkBookMilestone(state.books.length);
      bookPushed = true;

    // --- Series folder suggestion (once per detected series, fires after save) ---
    if (book.series) {
      try {
        const SERIES_KEY = 'loren_series_suggested_' + book.series.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (!localStorage.getItem(SERIES_KEY)) {
          const seriesGroup = detectLibrarySeries().find(g => g.name.toLowerCase() === book.series.toLowerCase());
          if (seriesGroup && seriesGroup.books.length >= 2) {
            localStorage.setItem(SERIES_KEY, '1');
            const existing = JSON.parse(localStorage.getItem(LOREN_NOTIF_KEY) || 'null');
            if (!existing) {
              localStorage.setItem(LOREN_NOTIF_KEY, JSON.stringify({
                type: 'series',
                msg: `"${book.title}" looks like part of the "${book.series}" series — I can see ${seriesGroup.books.length} books in that group. Ask me to "create a series folder" and I\'ll set it up.`
              }));
              showLorenDot();
            }
          }
        }
      } catch(e) {}
    }

    try {
      await savePDFBlob(book.id, new Blob([arr], { type: 'application/pdf' }));
    } catch (e) {
      console.error('savePDFBlob failed:', e);
      book.hasBlob = false;
    }
    arr = null; // Release the ArrayBuffer so GC can reclaim it immediately

    // Save text to IndexedDB text store, then FREE it from RAM.
    // Without this, every imported book's text stays in state.books forever —
    // 197 books × ~200KB each = ~40MB of strings that never gets collected.
    // ensureBookText() will reload it on demand when a feature actually needs it.
    try {
      await saveBookText(book.id, fullText);
    } catch(e) {
      console.warn('saveBookText failed (text will be re-extracted on demand):', e);
    }
    book.hasText = true; // Text saved to IndexedDB — mark so games can find it
    book.text = null; // ← the key line — unpin from RAM now

    // --- Step 5: Generate cover while PDF is still open ---
    // The PDF.js document is already in memory here, so this costs nothing
    // extra to open. We render page 1 to a small canvas (max 400px wide),
    // encode as JPEG, and save to IndexedDB. On every future load, the cover
    // is retrieved instantly from IDB — no PDF.js needed at display time.
    try {
      const coverPage     = await pdf.getPage(1);
      const rawVp         = coverPage.getViewport({ scale: 1 });
      const MAX_W         = 400;
      const coverScale    = Math.min(1.5, MAX_W / rawVp.width);
      const coverVp       = coverPage.getViewport({ scale: coverScale });
      const coverCanvas   = document.createElement('canvas');
      coverCanvas.width   = Math.round(coverVp.width);
      coverCanvas.height  = Math.round(coverVp.height);
      const coverCtx      = coverCanvas.getContext('2d');
      if (coverCtx) {
        await coverPage.render({ canvasContext: coverCtx, viewport: coverVp }).promise;
        // Detect bland cover on the original uncompressed canvas — must happen before
        // toDataURL compresses it to JPEG (artifacts would corrupt the white-pixel test).
        book.coverIsBland = _isBlandCover(coverCanvas);
        const coverDataUrl = coverCanvas.toDataURL('image/jpeg', 0.7);
        await saveCoverData(book.id, coverDataUrl);
        // Seed the in-memory cache so the first render is instant even before
        // IDB responds (covers show the moment renderAll() fires after import).
        if (coverCache.size < COVER_CACHE_MAX) {
          coverCache.set(book.id, coverDataUrl);
        }
      }
      // Release the canvas immediately — we don't need it anymore
      coverCanvas.width = 0; coverCanvas.height = 0;
    } catch(e) {
      // Cover generation is best-effort — a failure here never stops the import
      console.warn('[Cover] Failed for "' + book.title + '":', e.message);
    }

    saveBooks();

    } catch (innerErr) {
      // Something failed after the PDF was open.
      // If the book was already pushed, log and continue — don't lose it.
      // If it failed before push (e.g. during extraction), push a minimal record
      // so the book still appears in the library rather than vanishing silently.
      console.warn(`[Import] Processing error for "${file?.name}" — saving what we have:`, innerErr);
      try { arr = null; } catch(e) {} // release ArrayBuffer regardless of failure point
      if (!bookPushed) {
        const fallbackTitle = file?.name?.replace(/\.pdf$/i,'').replace(/[_\-]+/g,' ').trim() || 'Untitled';
        const fallback = {
          id: uid(), title: fallbackTitle, author: '', text: null,
          dateAdded: new Date().toISOString(), addedAt: Date.now(),
          fileName: file.name, hasBlob: false, hasText: false,
          description: '', genres: [], length: 'unknown', pageCount: 0, tags: []
        };
        state.books.push(fallback);
        albumInsert(fallback); // Album: index fallback book
        if (!state._lastImportIds) state._lastImportIds = new Set();
        state._lastImportIds.add(fallback.id); // Quick Scan: track fallback
        _checkBookMilestone(state.books.length);
        saveBooks();
      }
    }

  } catch (err) {
    // Only reaches here if the PDF itself couldn't be opened (corrupted, not a PDF,
    // or timeout). These are genuine zero-data files — safe to skip.
    console.error(`[Import] Unreadable PDF "${file?.name}" — skipping:`, err);
    throw err;
  } finally {
    // --- CRITICAL: destroy the PDF document to free memory ---
    // Without this, every PDF loaded during a bulk import stays in RAM.
    // By book 20+, the browser runs out of memory and crashes.
    if (pdf) {
      try { pdf.destroy(); } catch(e) {}
    }
  }
}

/* =============================
   FILE INPUT & ADD MENU
============================= */
function openAddMenuReel() {
  const menu = document.getElementById('addMenu');
  const btn = document.getElementById('addBtn');
  const r = btn.getBoundingClientRect();
  const menuW = 200; // approximate menu width
  const rawLeft = r.left - 40;
  const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - menuW - 8));
  menu.style.top = (r.bottom + 8) + 'px';
  menu.style.left = clampedLeft + 'px';
  menu.style.display = 'block';
  menu.classList.remove('reel-out');
  menu.classList.add('reel-in');
}

function closeAddMenuReel() {
  const menu = document.getElementById('addMenu');
  menu.classList.remove('reel-in');
  menu.classList.add('reel-out');
  setTimeout(() => {
    menu.style.display = 'none';
    menu.classList.remove('reel-out');
  }, 200);
}

function showFolderImportChoice(files, folderName) {
  // Capture choice BEFORE close() can affect anything
  let selectedOption = 'keep';

  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.48);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    z-index: 170; display: flex; align-items: center;
    justify-content: center; padding: 20px;
    animation: fadeInBackdrop 0.2s ease forwards;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    width: 100%; max-width: 380px;
    background: var(--card);
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.22), 0 6px 20px rgba(0,0,0,0.1);
    border: 1px solid rgba(255,255,255,0.08);
    animation: slideUpModal 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards;
  `;

  panel.innerHTML = `
    <style>
      @keyframes fadeInBackdrop { from { opacity:0 } to { opacity:1 } }
      @keyframes slideUpModal { from { transform:translateY(24px);opacity:0 } to { transform:none;opacity:1 } }
      @keyframes slideUpPanel { from { transform:translateY(100%);opacity:0 } to { transform:translateY(0);opacity:1 } }
      ._import-opt {
        display: flex; align-items: flex-start; gap: 14px;
        padding: 14px 16px; border-radius: 14px; cursor: pointer;
        border: 2px solid rgba(0,0,0,0.08);
        background: transparent;
        transition: all 0.18s ease; margin-bottom: 10px;
        text-align: left; width: 100%;
      }
      ._import-opt:last-of-type { margin-bottom: 0; }
      ._import-opt._selected {
        border-color: var(--accent);
        background: rgba(10,22,41,0.05);
      }
      body.dark ._import-opt { border-color: rgba(255,255,255,0.1); }
      body.dark ._import-opt._selected {
        border-color: #4a6fa5;
        background: rgba(74,111,165,0.12);
      }
      ._import-icon {
        width: 40px; height: 40px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; flex-shrink: 0;
        background: rgba(10,22,41,0.07);
        transition: background 0.18s ease;
      }
      ._import-opt._selected ._import-icon {
        background: var(--accent); color: white;
      }
      ._import-label-main { font-size: 14px; font-weight: 700; line-height: 1.3; color: var(--text); }
      ._import-label-sub  { font-size: 12px; color: var(--muted); margin-top: 2px; line-height: 1.4; }
    


</style>

    <div style="margin-bottom:20px;">
      <div style="font-weight:700;font-size:17px;margin-bottom:4px;color:var(--text);">Import "${folderName}"</div>
      <div style="font-size:13px;color:var(--muted);">${files.length} PDF file${files.length !== 1 ? 's' : ''} ready to add</div>
    </div>

    <button class="_import-opt _selected" data-choice="keep">
      <div class="_import-icon">📁</div>
      <div>
        <div class="_import-label-main">Keep as a folder</div>
        <div class="_import-label-sub">Creates a folder called "${folderName}" — books grouped together in your library</div>
      </div>
    </button>

    <button class="_import-opt" data-choice="flat">
      <div class="_import-icon">📚</div>
      <div>
        <div class="_import-label-main">Add to library only</div>
        <div class="_import-label-sub">Books are added freely, without creating a folder</div>
      </div>
    </button>

    <div style="display:flex;gap:10px;margin-top:20px;">
      <button id="_impOk" style="
        flex:1; padding:13px; background:var(--accent); color:white;
        border:none; border-radius:12px; font-size:14px; font-weight:700;
        cursor:pointer; transition:opacity 0.15s;
      ">Confirm</button>
      <button id="_impCancel" style="
        padding:13px 18px; background:transparent; color:var(--muted);
        border:1.5px solid rgba(0,0,0,0.1); border-radius:12px;
        font-size:14px; cursor:pointer; transition:background 0.15s;
      ">Cancel</button>
    </div>
  `;

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.style.animation = 'fadeInBackdrop 0.15s ease reverse forwards';
    setTimeout(() => { if (backdrop.parentNode) document.body.removeChild(backdrop); }, 140);
  };

  // Option selection
  const opts = panel.querySelectorAll('._import-opt');
  opts.forEach(opt => {
    opt.addEventListener('click', () => {
      opts.forEach(o => o.classList.remove('_selected'));
      opt.classList.add('_selected');
      selectedOption = opt.dataset.choice; // Capture immediately on click
    });
  });

  panel.querySelector('#_impOk').addEventListener('click', () => {
    // Read selectedOption BEFORE closing
    const choice = selectedOption;
    close();

    if (choice === 'keep') {
      state.pendingFolderCreation = {
        folderName,
        existingIds: new Set(state.books.map(b => b.id)),
        color: randomFolderColor()
      };
    }
    enqueueFiles(files);
  });

  panel.querySelector('#_impCancel').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
}

/* =============================
   EDITOR MODAL
============================= */
let currentEditId = null;

async function openEditor(id) {
  const b = state.books.find(x => x.id === id);
  if (!b) return;
  currentEditId = id;

  // Ensure text is in memory before we render it into the editor
  await ensureBookText(id);
  
  const editorPanel = document.querySelector('.editor-panel');
  if (editorPanel) {
    editorPanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div id="editorTitle" style="font-weight:700">Edit Book</div>
        <div style="display:flex;gap:8px;align-items:center">
          <button id="exportTextBtn" class="btn ghost">Export</button>
          <button id="closeEditorBtn" class="btn">Close</button>
        </div>
      </div>
      
      <!-- Book Metadata Section -->
      <div class="book-meta-display">
        <div class="book-meta-row">
          <span class="book-meta-label">Title:</span>
          <span class="book-meta-value" id="displayTitle">${b.title || 'Untitled'}</span>
        </div>
        <div class="book-meta-row">
          <span class="book-meta-label">Author:</span>
          <span class="book-meta-value" id="displayAuthor">${b.author || 'Unknown author'}</span>
        </div>
        <div class="book-meta-row">
          <span class="book-meta-label">Length:</span>
          <span class="book-meta-value" id="displayLength">${b.length || classifyLength(b.text)}</span>
        </div>
        <div class="book-meta-row" style="flex-direction: column; align-items: flex-start;">
          <span class="book-meta-label" style="margin-bottom: 6px;">Genres:</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;" id="genreTags">
            ${(b.genres || []).map(g => `<span style="background: var(--accent); color: white; padding: 4px 10px; border-radius: 999px; font-size: 12px;">${g}</span>`).join('') || '<span style="color: var(--muted); font-size: 13px;">No genres detected</span>'}
          </div>
          <button id="editGenresBtn" class="edit-toggle-btn" style="margin-top: 4px;">
            <span style="font-size:14px">🏷️</span> Edit Genres
          </button>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <button id="editMetaBtn" class="edit-toggle-btn">
            <span style="font-size:14px">✏️</span> Edit Title & Author
          </button>
          <button id="editTagsBtn" class="edit-toggle-btn">
            <span style="font-size:14px">🔖</span> Tags
          </button>
        </div>
      </div>
      
      <!-- Edit Tags Form (Initially Hidden) -->
      <div id="editTagsForm" class="edit-book-form" style="display:none;">
        <div class="form-row">
          <label class="form-label">Tags (press Enter to add)</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;" id="tagDisplay">
            ${(b.tags || []).map(t => `<span class="tag-pill" data-tag="${t}">${t} <button onclick="removeTagFromEditor('${t}')" style="background:none;border:none;color:inherit;cursor:pointer;padding:0 2px;font-size:11px;">×</button></span>`).join('')}
          </div>
          <div style="display:flex;gap:8px;">
            <input type="text" id="tagInput" class="form-input" placeholder="Add a tag…" style="flex:1;">
            <button id="addTagBtn" class="edit-save-btn" style="padding:8px 16px;">Add</button>
          </div>
          <div style="margin-top:8px;font-size:12px;color:var(--muted);">Suggestions: to-read, favourite, research, gift, fiction, non-fiction</div>
        </div>
        <div class="form-actions">
          <button id="saveTagsBtn" class="edit-save-btn"><span style="font-size:14px">💾</span> Done</button>
        </div>
      </div>
      
      <!-- Edit Title/Author Form (Initially Hidden) -->
      <div id="editMetaForm" class="edit-book-form" style="display:none;">
        <div class="form-row">
          <label class="form-label">Book Title</label>
          <input type="text" id="editTitleInput" class="form-input" value="${b.title || ''}" placeholder="Enter book title">
        </div>
        <div class="form-row">
          <label class="form-label">Author</label>
          <input type="text" id="editAuthorInput" class="form-input" value="${b.author || ''}" placeholder="Enter author name">
        </div>
        <div class="form-actions">
          <button id="saveMetaBtn" class="edit-save-btn">
            <span style="font-size:14px">💾</span> Save Changes
          </button>
          <button id="cancelEditBtn" class="edit-cancel-btn">Cancel</button>
        </div>
      </div>
      
      <!-- Edit Genres Form (Initially Hidden) -->
      <div id="editGenresForm" class="edit-book-form" style="display:none;">
        <div class="form-row">
          <label class="form-label">Select Genres (click to toggle)</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0;" id="genreSelector">
            ${Object.keys(GENRE_KEYWORDS).map(g => `
              <button class="genre-toggle-btn ${(b.genres || []).includes(g) ? 'selected' : ''}" data-genre="${g}" style="
                padding: 8px 14px;
                border-radius: 999px;
                border: 1px solid rgba(0,0,0,0.1);
                background: ${(b.genres || []).includes(g) ? 'var(--accent)' : 'transparent'};
                color: ${(b.genres || []).includes(g) ? 'white' : 'var(--text)'};
                font-size: 12px;
                cursor: pointer;
                transition: all 0.15s;
              ">${g}</button>
            `).join('')}
          </div>
        </div>
        <div class="form-actions">
          <button id="saveGenresBtn" class="edit-save-btn">
            <span style="font-size:14px">💾</span> Save Genres
          </button>
          <button id="cancelGenresBtn" class="edit-cancel-btn">Cancel</button>
        </div>
      </div>
      
      <!-- Text Editor Controls -->
      <div style="display:flex;gap:8px;align-items:center;margin-top:16px;">
        <button data-cmd="bold" class="btn ghost">B</button>
        <button data-cmd="italic" class="btn ghost">I</button>
        <button data-cmd="underline" class="btn ghost">U</button>
        <select id="fontSelect" style="margin-left:auto;padding:8px;border-radius:8px;">
          <option value="sans">Sans</option>
          <option value="serif">Serif</option>
          <option value="mono">Mono</option>
        </select>
      </div>
      
      <!-- Main Text Editor -->
      <div id="editorArea" class="editor-area" contenteditable="true" spellcheck="true">${b.text || ''}</div>
    `;
  }
  
  document.getElementById('editorModal').style.display = 'flex';
  setupEditFormListeners(id);
  setupGenreEditListeners(id);
}

function setupGenreEditListeners(bookId) {
  const editGenresBtn = document.getElementById('editGenresBtn');
  const editGenresForm = document.getElementById('editGenresForm');
  const bookMetaDisplay = document.querySelector('.book-meta-display');
  
  if (editGenresBtn && editGenresForm) {
    editGenresBtn.addEventListener('click', () => {
      editGenresForm.style.display = 'block';
      bookMetaDisplay.style.display = 'none';
    });
  }
  
  const cancelGenresBtn = document.getElementById('cancelGenresBtn');
  if (cancelGenresBtn) {
    cancelGenresBtn.addEventListener('click', () => {
      editGenresForm.style.display = 'none';
      bookMetaDisplay.style.display = 'block';
    });
  }
  
  // Toggle genre buttons
  document.querySelectorAll('.genre-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      if (btn.classList.contains('selected')) {
        btn.style.background = 'var(--accent)';
        btn.style.color = 'white';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text)';
      }
    });
  });
  
  // Save genres
  const saveGenresBtn = document.getElementById('saveGenresBtn');
  if (saveGenresBtn) {
    saveGenresBtn.addEventListener('click', () => {
      const selected = [];
      document.querySelectorAll('.genre-toggle-btn.selected').forEach(btn => {
        selected.push(btn.dataset.genre);
      });
      
      const book = state.books.find(b => b.id === bookId);
      if (book) {
        book.genres = selected;
        saveBooks();
        albumInsert(book); // Album: re-index with updated genres
        
        const genreTags = document.getElementById('genreTags');
        if (genreTags) {
          genreTags.innerHTML = selected.map(g => 
            `<span style="background: var(--accent); color: white; padding: 4px 10px; border-radius: 999px; font-size: 12px;">${g}</span>`
          ).join('') || '<span style="color: var(--muted); font-size: 13px;">No genres selected</span>';
        }
        
        editGenresForm.style.display = 'none';
        bookMetaDisplay.style.display = 'block';
        toast('Genres updated');
        renderAll();
      }
    });
  }
}

function setupEditFormListeners(bookId) {
  const editMetaBtn   = document.getElementById('editMetaBtn');
  const editMetaForm  = document.getElementById('editMetaForm');
  const bookMetaDisp  = document.querySelector('.book-meta-display');
  const saveMetaBtn   = document.getElementById('saveMetaBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const titleInput    = document.getElementById('editTitleInput');
  const authorInput   = document.getElementById('editAuthorInput');

  if (editMetaBtn && editMetaForm) {
    editMetaBtn.addEventListener('click', () => {
      editMetaForm.style.display = 'block';
      if (bookMetaDisp) bookMetaDisp.style.display = 'none';
    });
  }
  if (cancelEditBtn && editMetaForm) {
    cancelEditBtn.addEventListener('click', () => {
      editMetaForm.style.display = 'none';
      if (bookMetaDisp) bookMetaDisp.style.display = 'block';
    });
  }
  if (saveMetaBtn) {
    saveMetaBtn.addEventListener('click', () => {
      const book = state.books.find(b => b.id === bookId);
      if (!book) return;
      const newTitle  = titleInput?.value.trim() || '';
      const newAuthor = authorInput?.value.trim() || '';
      const hadNoAuthor = !book.author || !book.author.trim();
      book.title  = newTitle  || book.title;
      book.author = newAuthor;

      // If the book now has an author and previously had none,
      // remove it from any folder that groups unknown-author books
      // (i.e. a folder whose members are exclusively unknown-author books
      // or whose name suggests it — we use the simpler heuristic: if
      // every OTHER member of the folder also has no author, it's an
      // unknown-author folder and this book no longer belongs there).
      if (newAuthor && hadNoAuthor) {
        state.folders.forEach(folder => {
          if (!folder.bookIds.includes(book.id)) return;
          const otherMembers = state.books.filter(b =>
            b.id !== book.id && folder.bookIds.includes(b.id)
          );
          const allOthersUnknown = otherMembers.length > 0 &&
            otherMembers.every(b => !b.author || !b.author.trim());
          if (allOthersUnknown) {
            folder.bookIds = folder.bookIds.filter(id => id !== book.id);
          }
        });
        saveFolders();
      }

      saveBooks();
      albumInsert(book); // Album: re-index with updated title/author/genres
      renderAll();
      const dispTitle  = document.getElementById('displayTitle');
      const dispAuthor = document.getElementById('displayAuthor');
      if (dispTitle)  dispTitle.textContent  = book.title || 'Untitled';
      if (dispAuthor) dispAuthor.textContent = book.author || 'Unknown author';
      if (editMetaForm) editMetaForm.style.display = 'none';
      if (bookMetaDisp) bookMetaDisp.style.display = 'block';
      toast('Saved');
    });
  }
  const saveOnEnter = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveMetaBtn?.click(); }
  };
  titleInput?.addEventListener('keydown', saveOnEnter);
  authorInput?.addEventListener('keydown', saveOnEnter);

  // ── v7: Tags editing ──
  const editTagsBtn = document.getElementById('editTagsBtn');
  const editTagsForm = document.getElementById('editTagsForm');
  const tagInput = document.getElementById('tagInput');
  const addTagBtn = document.getElementById('addTagBtn');
  const saveTagsBtn = document.getElementById('saveTagsBtn');

  if (editTagsBtn && editTagsForm) {
    editTagsBtn.addEventListener('click', () => {
      editTagsForm.style.display = 'block';
    });
  }

  function addTagToEditor(tag) {
    const book = state.books.find(b => b.id === bookId);
    if (!book) return;
    tag = tag.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '');
    if (!tag) return;
    if (!book.tags) book.tags = [];
    if (book.tags.includes(tag)) return;
    book.tags.push(tag);
    saveBooks();
    albumInsert(book); // Album: re-index with new tag
    refreshTagDisplay(book);
  }

  window.removeTagFromEditor = function(tag) {
    const book = state.books.find(b => b.id === bookId);
    if (!book || !book.tags) return;
    book.tags = book.tags.filter(t => t !== tag);
    saveBooks();
    albumInsert(book); // Album: re-index with tag removed
    refreshTagDisplay(book);
  };

  function refreshTagDisplay(book) {
    const display = document.getElementById('tagDisplay');
    if (!display) return;
    display.innerHTML = (book.tags || []).map(t =>
      `<span class="tag-pill" data-tag="${t}">${t} <button onclick="removeTagFromEditor('${t}')" style="background:none;border:none;color:inherit;cursor:pointer;padding:0 2px;font-size:11px;">×</button></span>`
    ).join('');
  }

  addTagBtn?.addEventListener('click', () => {
    if (tagInput?.value.trim()) { addTagToEditor(tagInput.value); tagInput.value = ''; }
  });
  tagInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTagBtn?.click(); }
  });
  saveTagsBtn?.addEventListener('click', () => {
    if (editTagsForm) editTagsForm.style.display = 'none';
    renderAll();
    toast('Tags saved');
  });
}

/* =============================
   SEARCH — live, per-panel
============================= */
/* --- Generic grid filter --- */
function filterGrid(gridId, query) {
  const g = document.getElementById(gridId);
  if (!g) return;

  // Bump generation counter to cancel any in-flight idle renders
  renderLibrary._gen = (renderLibrary._gen || 0) + 1;

  // Re-render from state — never hunt stale DOM cards
  g.innerHTML = '';

  const q = query.toLowerCase().trim();
  if (!q) return; // empty query handled by caller

  // ── Album fast path: O(1/log-n) prefix lookups instead of linear scan ──
  let matches;
  if (_album._built && _album.byId.size > 0) {
    const norm = _albumNorm(q);
    const seen = new Set();
    const add = (id) => {
      if (seen.has(id)) return;
      const book = state.books.find(b => b.id === id);
      if (book && !book.isWishlist) { seen.add(id); matches = matches || []; matches.push(book); }
    };

    // Tier 1: exact title match (O(1))
    const exactId = _album.byExactTitle.get(norm);
    if (exactId) add(exactId);

    // Tier 2: title prefix (O(k) on sorted array)
    _albumBinaryPrefix(_album.titlesSorted, norm).forEach(add);

    // Tier 3: author prefix
    _albumBinaryPrefix(_album.authorsSorted, norm).forEach(id => {
      if (seen.has(id)) return;
      const e = _album.byId.get(id);
      if (e && !e.isWishlist && !e.isTrashed) add(id);
    });

    // Tier 4: genre prefix (catches "fantasy", "mystery" etc.)
    for (const [genre, ids] of _album.byGenre) {
      if (genre.startsWith(norm) || genre.includes(norm)) ids.forEach(add);
    }

    // Tier 5: title/author contains (catches mid-word matches the prefix search misses)
    // Only run when query is meaningful length AND we don't already have enough results
    if ((!matches || matches.length < 3) && norm.length >= 4) {
      for (const e of _album.byId.values()) {
        if (e.isWishlist || e.isTrashed) continue;
        if (seen.has(e.id)) continue;
        if (e.titleNorm.includes(norm) || e.authorNorm.includes(norm)) add(e.id);
      }
    }

    matches = matches || [];
  } else {
    // Fallback: Album not ready yet — use original linear scan
    matches = state.books.filter(book =>
      !book.isWishlist && (
      (book.title  || '').toLowerCase().includes(q) ||
      (book.author || '').toLowerCase().includes(q)
      )
    );
  }

  if (matches.length === 0) {
    const empty = document.createElement('div');
    empty.id = 'searchEmptyState';
    empty.style.cssText = 'padding:80px 24px;text-align:center;color:var(--muted);grid-column:1/-1;';
    empty.innerHTML = `
      <div style="font-size:40px;margin-bottom:12px;opacity:0.4;">🔍</div>
      <div style="font-weight:600;font-size:15px;color:var(--text);margin-bottom:6px;">No results</div>
      <div style="font-size:13px;">Try a different keyword</div>
    `;
    g.appendChild(empty);
    return;
  }

  matches.forEach(book => {
    const card = createBookCard(book);
    g.appendChild(card);
  });
  _initCoverObserver();
}

/* --- Favorites search --- */
function filterFavorites(query) {
  const g = document.getElementById('favGrid');
  if (!g) return;

  const old = document.getElementById('favSearchEmpty');
  if (old) old.remove();

  if (!query) { renderFavorites(); return; }

  const cards = Array.from(g.querySelectorAll('.card[data-book-id]'));
  let visible = 0;
  cards.forEach(card => {
    const book = state.books.find(b => b.id === card.dataset.bookId);
    if (!book) { card.style.display = 'none'; return; }
    const match =
      (book.title  || '').toLowerCase().includes(query) ||
      authorMatches(book.author || '', query);
    card.style.display = match ? '' : 'none';
    if (match) visible++;
  });

  if (visible === 0 && state.favorites.size > 0) {
    const empty = document.createElement('div');
    empty.id = 'favSearchEmpty';
    empty.style.cssText = 'padding:60px 24px;text-align:center;color:var(--muted);';
    empty.innerHTML = `
      <div style="font-size:36px;margin-bottom:10px;opacity:0.4;">🔍</div>
      <div style="font-weight:600;font-size:15px;color:var(--text);">No favorites match</div>
    `;
    g.appendChild(empty);
  }
}

/* --- Discover search --- */
function filterDiscover(query) {
  const mosaic = document.getElementById('discoverMosaic');
  const isMosaic = mosaic && mosaic.style.display !== 'none';

  // Mosaic layout has no search — auto-switch to Shelf so filtering works
  if (isMosaic) {
    const oldEmp = document.getElementById('discoverSearchEmpty');
    if (oldEmp) oldEmp.remove();
    if (query && query.trim().length > 0) {
      // Auto-switch to shelf view for search, then re-run filter
      _discoverLayout = 'shelf';
      _switchDiscoverLayout();
      // Re-run after layout switch settles
      setTimeout(function() { filterDiscover(query); }, 60);
    }
    return;
  }

  // ── Shelf: search genres ───────────────────────────────────────
  document.getElementById('searchInput').placeholder = 'Search genres...';
  const g = document.getElementById('recGrid');
  if (!g) return;
  const old = document.getElementById('discoverSearchEmpty');
  if (old) old.remove();
  if (!query) { renderRecommendations(); return; }
  const q = query.toLowerCase().trim();
  let visible = 0;
  g.querySelectorAll('.disc-shelf-section').forEach(section => {
    const labelEl = section.querySelector('.disc-shelf-hdr-label');
    const genreName = (labelEl ? labelEl.textContent : '').toLowerCase();
    const match = genreName.includes(q);
    section.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  g.querySelectorAll('.disc-section-hdr').forEach(hdr => {
    const match = hdr.textContent.toLowerCase().includes(q);
    let el = hdr.nextElementSibling;
    hdr.style.display = match ? '' : 'none';
    while (el && !el.classList.contains('disc-section-hdr')) {
      el.style.display = match ? '' : 'none';
      if (match) visible++;
      el = el.nextElementSibling;
    }
  });
  if (visible === 0) {
    const empty = document.createElement('div');
    empty.id = 'discoverSearchEmpty';
    empty.style.cssText = 'padding:60px 24px;text-align:center;color:var(--muted);';
    empty.innerHTML = '<div style="font-size:36px;margin-bottom:10px;opacity:0.4;">🔍</div>' +
      '<div style="font-weight:600;font-size:15px;color:var(--text);">No genre found for “' + query + '”</div>' +
      '<div style="font-size:13px;margin-top:6px;">Try “fantasy”, “mystery”, “romance”…</div>';
    g.appendChild(empty);
  }
}

// Keep alias so nothing else breaks
function filterBooks(query) { filterGrid('grid', query); }
