/* =====================================================================
   settings.js — Loren
   -----------------------------------------------------------------
   Font, theme (light/dark/warm-night), color palette, and the
   settings panel: snapshot/dirty-tracking, open/close, plus the
   per-book "more menu" (three dots).

   Load this file after state.js (PREF) and ui.js (applyAnimationSetting,
   toast).

   One structural change from the original file: the color-palette
   code used to be wrapped in an immediately-invoked function
   `(function initPalette() { ... })()`, which ran at script-parse
   time. I unwrapped it — `PREF_PALETTE`, `PALETTE_GRADIENTS`, and
   `applyPalette()` are now plain top-level declarations here, same
   as everything else in this file, since they're real preference
   logic, not boot behavior. Only the two lines that actually DO
   something immediately (reading localStorage and applying the
   saved palette, and wiring the palette-switcher click) got pulled
   out — see palette-init-wiring.js below.

   SIX wiring landmines came out of this section (most yet, but the
   pattern's fully confirmed now) — all parked under pending-for-app/:
   - theme-toggles-wiring.js (dark mode + warm-night toggles)
   - warmnight-schedule-boot.js — `checkWarmNightSchedule()` called
     immediately AND put on a `setInterval(..., 60000)`. This is the
     first landmine that's not just event wiring — it's a recurring
     timer that needs to actually start at boot, so app.js's init
     needs to call this, not just define it.
   - settings-panel-wiring.js (font/tab-switching/save-settings)
   - palette-init-wiring.js (palette init + switcher click)
   - settingsbtn-wiring.js (open/close settings panel buttons)
   - bookdetail-open-split-menu-wiring.js (the Normal/Session open
     choice menu on the book detail panel) — this one calls
     `openBook`, `cleanupOpenMenus`, `activeOpenMenu`, none of which
     exist in any module yet. They're somewhere in the still-unmapped
     middle of the original file (probably near "SINGLE OPEN ENTRY
     POINT" or "BOOK DETAIL MODAL HANDLERS") — deferred call, so no
     problem now, just noting where to look later.
   ===================================================================== */

function applyFont(name){ 
  // Set data attribute for CSS selectors
  if (name === 'merriweather' || name === 'lora' || name === 'mont' || name === 'courier') {
    document.body.setAttribute('data-font', name);
  } else {
    document.body.removeAttribute('data-font');
  }
  
  if(name==='merriweather') document.body.style.fontFamily='Merriweather, serif'; 
  else if(name==='lora') document.body.style.fontFamily='Lora, serif';
  else if(name==='mont') document.body.style.fontFamily='Montserrat, sans-serif';
  else if(name==='courier') document.body.style.fontFamily='"Courier Prime", monospace';
  else document.body.style.fontFamily='Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial'; 
  localStorage.setItem(PREF.FONT, name); 
}

function applyTheme(theme){ 
  if(theme==='dark'){ 
    document.body.classList.add('dark'); 
    localStorage.setItem(PREF.THEME,'dark'); 
  } else { 
    document.body.classList.remove('dark'); 
    localStorage.setItem(PREF.THEME,'light'); 
  } 
}

function inkBloomTheme(triggerEl, toDark) {
  _themeOverlaySoak(
    toDark,
    () => {
      document.body.classList.toggle('dark', toDark);
      localStorage.setItem(PREF.THEME, toDark ? 'dark' : 'light');
    }
  );
}

function _themeOverlaySoak(toDark, swapFn) {
  const isWarm = document.body.classList.contains('warm-night');
  const destBg = toDark
    ? (isWarm ? '#0f0d0b' : '#111318')
    : (isWarm ? '#f5ead4' : '#f4f1eb');

  // Get or create the overlay div
  let ov = document.getElementById('themeOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'themeOverlay';
    document.body.appendChild(ov);
  }
  if (ov._running) return;
  ov._running = true;

  ov.style.background = destBg;

  // Use CSS transitions on the overlay itself — fast in, slightly slower out
  ov.style.transition = 'opacity 0.22s ease-in';
  ov.style.opacity = '1';

  // After soak-in completes, swap theme, then soak back out
  setTimeout(() => {
    swapFn();
    // One rAF so the new theme colours are painted before we reveal
    requestAnimationFrame(() => {
      ov.style.transition = 'opacity 0.36s ease-out';
      ov.style.opacity = '0';
      setTimeout(() => { ov._running = false; }, 380);
    });
  }, 230);
}

/* ─── COLOUR FINISH (palette) ─────────────────────────────────────
   Persisted as 'loren_palette' in localStorage.
   Applied by setting data-palette on <body>.
   Each palette changes .color-option swatches + folder chip filters.
─────────────────────────────────────────────────────────────────── */
  const PREF_PALETTE = 'loren_palette';
  const VALID = ['foundry','gallery','dusk','manuscript','carbon'];

  // Full per-palette gradient map (mirrors FOLDER_PALETTE_DATA / CSS palettes)
  const PALETTE_GRADIENTS = {
    foundry: {
      '#0a1629':'linear-gradient(145deg,#16243a,#4a6080,#16243a)',
      '#4a6fa5':'linear-gradient(145deg,#304870,#6a8fba,#304870)',
      '#667761':'linear-gradient(145deg,#3e4e40,#708268,#3e4e40)',
      '#8c5e58':'linear-gradient(145deg,#583a36,#8e6058,#583a36)',
      '#9c6b98':'linear-gradient(145deg,#503256,#866a8a,#503256)',
      '#3a8b8f':'linear-gradient(145deg,#2a5c60,#5e9498,#2a5c60)',
      '#d4a574':'linear-gradient(145deg,#6a4e2e,#b08056,#6a4e2e)',
      '#c44536':'linear-gradient(145deg,#5a2018,#9a4a3a,#5a2018)',
      '#6a0572':'linear-gradient(145deg,#3a1044,#784080,#3a1044)',
      '#b05c2a':'linear-gradient(145deg,#6a3210,#c07040,#6a3210)',
      '#e9c46a':'linear-gradient(145deg,#6a5018,#c09040,#6a5018)',
      '#2d5a27':'linear-gradient(145deg,#1a3a14,#4a7a3e,#1a3a14)',
    },
    gallery: {
      '#0a1629':'linear-gradient(135deg,#0a1629,#1a2b4a)',
      '#4a6fa5':'linear-gradient(135deg,#4a6fa5,#5d82b8)',
      '#667761':'linear-gradient(135deg,#667761,#7a8c75)',
      '#8c5e58':'linear-gradient(135deg,#8c5e58,#a0726c)',
      '#9c6b98':'linear-gradient(135deg,#9c6b98,#b080ac)',
      '#3a8b8f':'linear-gradient(135deg,#3a8b8f,#4da0a4)',
      '#d4a574':'linear-gradient(135deg,#d4a574,#e0b688)',
      '#c44536':'linear-gradient(135deg,#c44536,#d85a4b)',
      '#6a0572':'linear-gradient(135deg,#6a0572,#8a1891)',
      '#b05c2a':'linear-gradient(135deg,#b05c2a,#d0783e)',
      '#e9c46a':'linear-gradient(135deg,#e9c46a,#f0d080)',
      '#2d5a27':'linear-gradient(135deg,#2d5a27,#3e7a36)',
    },
    dusk: {
      '#0a1629':'#394655','#4a6fa5':'#5c7a96','#667761':'#6d7d6e',
      '#8c5e58':'#826260','#9c6b98':'#7a6a80','#3a8b8f':'#557c82',
      '#d4a574':'#9e8a72','#c44536':'#8a5550','#6a0572':'#604868',
      '#b05c2a':'#8a6050','#e9c46a':'#a09060','#2d5a27':'#4a6a44',
    },
    manuscript: {
      '#0a1629':'linear-gradient(135deg,#2a1f14,#3d3020)',
      '#4a6fa5':'linear-gradient(135deg,#3e4e6c,#56688e)',
      '#667761':'linear-gradient(135deg,#5c6644,#726e50)',
      '#8c5e58':'linear-gradient(135deg,#7a4a3a,#9a6252)',
      '#9c6b98':'linear-gradient(135deg,#6e4c5a,#8e6470)',
      '#3a8b8f':'linear-gradient(135deg,#3a6658,#507a6e)',
      '#d4a574':'linear-gradient(135deg,#b07c40,#c89a5c)',
      '#c44536':'linear-gradient(135deg,#8a2e20,#b04438)',
      '#6a0572':'linear-gradient(135deg,#4a2040,#6e3a5e)',
      '#b05c2a':'linear-gradient(135deg,#8a3a10,#b05a28)',
      '#e9c46a':'linear-gradient(135deg,#c8922a,#e0b048)',
      '#2d5a27':'linear-gradient(135deg,#1e4018,#326430)',
    },
    carbon: {
      '#0a1629':'linear-gradient(145deg,#111418,#202832,#111418)',
      '#4a6fa5':'linear-gradient(145deg,#18202a,#28303e,#18202a)',
      '#667761':'linear-gradient(145deg,#1a201a,#282e28,#1a201a)',
      '#8c5e58':'linear-gradient(145deg,#201a18,#302824,#201a18)',
      '#9c6b98':'linear-gradient(145deg,#1e1820,#2c2430,#1e1820)',
      '#3a8b8f':'linear-gradient(145deg,#161e20,#22282a,#161e20)',
      '#d4a574':'linear-gradient(145deg,#1e1a14,#2c2620,#1e1a14)',
      '#c44536':'linear-gradient(145deg,#201412,#302018,#201412)',
      '#6a0572':'linear-gradient(145deg,#1a101e,#281a2c,#1a101e)',
      '#b05c2a':'linear-gradient(145deg,#1e1410,#2c1e16,#1e1410)',
      '#e9c46a':'linear-gradient(145deg,#1c1810,#2a2418,#1c1810)',
      '#2d5a27':'linear-gradient(145deg,#121814,#1e2820,#121814)',
    },
  };

  function applyPalette(name) {
    const p = VALID.includes(name) ? name : 'foundry';
    document.body.dataset.palette = p;

    // Update switcher active state
    document.querySelectorAll('#paletteSwitcher .palette-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.palette === p);
    });

    // Re-render ALL folder chip colors live using colorKey
    const map = PALETTE_GRADIENTS[p] || PALETTE_GRADIENTS.foundry;
    document.querySelectorAll('.folder-chip[data-folder-id]').forEach(chip => {
      const fid = chip.dataset.folderId;
      const folder = (typeof state !== 'undefined' ? state : {folders:[]}).folders?.find(f => f.id === fid);
      if (folder && folder.colorKey && map[folder.colorKey]) {
        chip.style.setProperty('--folder-color', map[folder.colorKey]);
      }
    });
  }

  // Expose for use by render functions
  window._PALETTE_GRADIENTS = PALETTE_GRADIENTS;
  window._applyCurrentPalette = () => applyPalette(localStorage.getItem(PREF_PALETTE) || 'foundry');

/* =============================
   WARM NIGHT SCHEDULE
============================= */
function checkWarmNightSchedule() {
  const h = new Date().getHours();
  const shouldBeOn = h >= 19 || h < 7;
  const isOn = document.body.classList.contains('warm-night');

  // Manual override: user explicitly toggled warm night themselves.
  // We respect their choice until the natural schedule crosses a boundary
  // and AGREES with what they set — at that point the override self-clears
  // and normal scheduling resumes from the next boundary onward.
  const manualOverride = localStorage.getItem('loren_warm_override');
  if (manualOverride !== null) {
    const overrideWantsOn = manualOverride === 'on';
    if (overrideWantsOn !== shouldBeOn) {
      // Schedule disagrees with the user's manual choice — leave it alone.
      return;
    }
    // Schedule now agrees with the user's choice — clear the override so
    // future automatic transitions (next 7am / 7pm) work normally again.
    localStorage.removeItem('loren_warm_override');
    // Fall through — already in the correct state, no forced toggle needed.
  }

  if (shouldBeOn === isOn) return;
  document.body.classList.toggle('warm-night', shouldBeOn);
  localStorage.setItem('warm_night', shouldBeOn ? 'on' : 'off');
  const tog = document.getElementById('warmNightToggle');
  if (tog) tog.checked = shouldBeOn;
}

/* =============================
   SETTINGS PANEL (snapshot / dirty tracking / open-close)
============================= */
function captureSettingsSnapshot() {
  return JSON.stringify({
    dark:       document.getElementById('darkToggle').checked,
    font:       document.getElementById('uiFont').value,
    layout:     document.getElementById('gridLayoutSelect').value,
    session:    document.getElementById('sessionLengthInput').value,
    anim:       document.getElementById('animationToggle').checked,
    sort:       document.querySelector('input[name="sortOrder"]:checked')?.value || 'import',
    folderSort: document.getElementById('folderSortSelect')?.value || 'added'
  });
}

function tryCloseSettings() {
  // Auto-save all settings on close (no confirmation needed)
  const sort = document.querySelector('input[name="sortOrder"]:checked')?.value || 'import';
  localStorage.setItem(PREF.SORT, sort);

  const sessionLength = document.getElementById('sessionLengthInput').value;
  if (sessionLength && parseInt(sessionLength) >= 5 && parseInt(sessionLength) <= 240) {
    localStorage.setItem(PREF.SESSION_LENGTH, sessionLength);
  }

  const animEnabled = document.getElementById('animationToggle').checked;
  localStorage.setItem(PREF.ANIMATIONS, animEnabled ? 'true' : 'false');
  applyAnimationSetting(animEnabled);

  const coverTexElClose = document.getElementById('coverTextureToggle');
  if (coverTexElClose) localStorage.setItem(PREF.COVER_TEXTURE, coverTexElClose.checked ? 'true' : 'false');

  const folderSortSelClose = document.getElementById('folderSortSelect');
  if (folderSortSelClose) localStorage.setItem(PREF.FOLDER_SORT, folderSortSelClose.value);

  settingsSnapshot = null;
  closeSettingsReel();
  renderAll();
}

function openSettingsReel() {
  const panel = document.getElementById('settingsPanel');
  panel.style.display = 'block';
  panel.classList.remove('reel-out');
  panel.classList.add('reel-in');
  settingsSnapshot = captureSettingsSnapshot();
}

function closeSettingsReel() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.remove('reel-in');
  panel.classList.add('reel-out');
  setTimeout(() => {
    panel.style.display = 'none';
    panel.classList.remove('reel-out');
  }, 260);
}

/* =============================
   MORE MENU (three dots, per-book)
============================= */
let activeMoreMenu = null;

function showMoreMenu(bookId, anchor) {
  // Remove any existing menu
  if (activeMoreMenu) activeMoreMenu.remove();

  const menu = document.createElement('div');
  menu.className = 'open-split-menu'; // reuse the same style as the open split menu
  menu.style.minWidth = '140px';
  activeMoreMenu = menu;

  const actions = [
    { icon: '⬇', label: 'Download', handler: () => downloadPdf(bookId) },
    { icon: '📝', label: 'Notes', handler: () => openNotesModal(bookId) },
    { icon: '✒️', label: 'Edit', handler: () => openEditor(bookId) },
    { icon: isBookRead(bookId) ? '○' : '✓', label: isBookRead(bookId) ? 'Mark unread' : 'Mark read', handler: () => {
        const nowRead = !isBookRead(bookId);
        markBookRead(bookId, nowRead);
        renderLibrary();
        toastUndo(nowRead ? 'Marked as read' : 'Marked as unread', () => {
          markBookRead(bookId, !nowRead);
          renderLibrary();
        });
      }
    },
    { icon: '🗑️', label: 'Remove', handler: () => {
        const bookFolders = state.folders.filter(f => f.bookIds.includes(bookId));
        if (bookFolders.length > 0) {
          showRemoveMenu(bookId, bookFolders, anchor);
        } else {
          lorenConfirm('Move this to Trash?', () => deleteBook(bookId));
        }
      }
    }
  ];

  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'open-split-option';
    btn.innerHTML = `<span style="font-size:14px">${action.icon}</span> ${action.label}`;
    btn.onclick = (e) => {
      e.stopPropagation();
      action.handler();
      menu.remove();
      activeMoreMenu = null;
    };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  menu.style.display = 'block';

  // Position relative to anchor using a live-update function
  function _positionMoreMenu() {
    const rect = anchor.getBoundingClientRect();
    // If anchor has scrolled off screen, hide menu
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      menu.remove();
      activeMoreMenu = null;
      document.removeEventListener('scroll', _positionMoreMenu, true);
      return;
    }
    menu.style.left = Math.min(rect.left, window.innerWidth - 160) + 'px';
    menu.style.top  = (rect.bottom + 4) + 'px';
  }

  menu.style.position = 'fixed';
  _positionMoreMenu();

  // Reposition on scroll so the menu follows the card
  document.addEventListener('scroll', _positionMoreMenu, true);

  // Close on outside click — also remove scroll listener
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!menu.contains(e.target) && !anchor.contains(e.target)) {
        menu.remove();
        activeMoreMenu = null;
        document.removeEventListener('click', closeHandler);
        document.removeEventListener('scroll', _positionMoreMenu, true);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 10);
}
