/* =====================================================================
   recall.js — Loren
   -----------------------------------------------------------------
   Notes and quotes attached to a book: add/get/delete/edit a note,
   tag suggestions, rendering the notes list, and opening the book
   detail view (which shows the book's notes).

   Load this file after state.js (`state.notes`, `state.books`,
   `state.currentSession`, `saveNotes`) and ui.js (`toast`,
   `toastUndo`).

   No wiring landmines in this section — clean.

   Same kind of boundary call as reader.js's toggleFav/deleteBook:
   `openBookDetail` is included here because it's grouped with note
   rendering in the original file (it calls renderNotes), but it's
   really "show the book detail panel," not strictly a notes concern.
   There's also a separate "NOTES MODAL" section much further down in
   the original file that likely belongs here too — not reached yet,
   will fold in when we get to that part of the file.
   ===================================================================== */

function addNote(bookId, text, quote = null, opts = {}) {
  const note = {
    id: uid(),
    bookId,
    type: opts.type || 'note',          // 'note' | 'quote'
    text,
    quote,
    quoteAuthor: opts.quoteAuthor || null, // attributed author for standalone quotes
    createdAt: new Date().toISOString(),
    sessionId: state.currentSession?.active ? state.currentSession.id : null,
    inSession: !!state.currentSession?.active
  };
  if (opts.page  != null) note.page  = opts.page;
  if (opts.tags  != null) note.tags  = opts.tags;

  state.notes.push(note);
  saveNotes();
  // Refresh note count badge on the book card instantly
  requestAnimationFrame(() => {
    const card = document.querySelector('.card[data-book-id="' + bookId + '"]');
    if (card) {
      const noteCount = state.notes.filter(n => n.bookId === bookId).length;
      let badge = card.querySelector('.card-note-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'card-note-badge';
        card.appendChild(badge);
      }
      badge.textContent = noteCount + (noteCount === 1 ? ' note' : ' notes');
      badge.style.display = noteCount > 0 ? '' : 'none';
    }
  });
  
  if (state.currentSession?.active) {
    addSessionNote(bookId, note.id);
  }
  
  return note;
}

function getNotesForBook(bookId) {
  return state.notes.filter(note => note.bookId === bookId);
}

function deleteNote(noteId) {
  state.notes = state.notes.filter(note => note.id !== noteId);
  saveNotes();
}

function editNote(noteId, newText) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return;
  note.text = newText.trim();
  note.editedAt = new Date().toISOString();
  saveNotes();
}

let _newNotePendingTags = [];

// ── v8: NOTE TAGS ─────────────────────────────────────────────────
const NOTE_TAG_PALETTE = [
  { color: '#4a6fa5', bg: 'rgba(74,111,165,0.15)' },
  { color: '#d4a574', bg: 'rgba(212,165,116,0.18)' },
  { color: '#2d7a4f', bg: 'rgba(45,122,79,0.15)'  },
  { color: '#c0392b', bg: 'rgba(192,57,43,0.14)'  },
  { color: '#7b68ee', bg: 'rgba(123,104,238,0.15)' },
  { color: '#e67e22', bg: 'rgba(230,126,34,0.14)'  },
  { color: '#16a085', bg: 'rgba(22,160,133,0.14)'  },
  { color: '#8e44ad', bg: 'rgba(142,68,173,0.14)'  },
];

function _tagStyle(tagText) {
  // Deterministically pick a color from the palette based on tag text
  let hash = 0;
  for (let i = 0; i < tagText.length; i++) hash = (hash * 31 + tagText.charCodeAt(i)) >>> 0;
  const p = NOTE_TAG_PALETTE[hash % NOTE_TAG_PALETTE.length];
  return { color: p.color, background: p.bg };
}

function _getAllNoteTags() {
  const all = new Set();
  state.notes.forEach(n => (n.tags || []).forEach(t => all.add(t)));
  return [...all].sort();
}

function _renderTagSuggestions(pendingTags, containerId, pendingContainerId) {
  const existing = _getAllNoteTags().filter(t => !pendingTags.includes(t));
  const row = document.getElementById(containerId);
  const pendingRow = document.getElementById(pendingContainerId);
  if (!row) return;
  row.innerHTML = '';
  if (pendingTags.length >= 3) return; // max 3
  existing.slice(0, 8).forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'note-tag-suggestion';
    btn.textContent = '#' + tag;
    const s = _tagStyle(tag);
    btn.style.color = s.color;
    btn.addEventListener('click', () => {
      if (pendingTags.length >= 3) { toast('Max 3 tags per note'); return; }
      pendingTags.push(tag);
      _renderPendingTags(pendingTags, pendingContainerId, containerId);
      _renderTagSuggestions(pendingTags, containerId, pendingContainerId);
    });
    row.appendChild(btn);
  });
  // Always show a "new tag" mini input if under limit
  if (pendingTags.length < 3) {
    const inp = document.createElement('input');
    inp.placeholder = '+ new tag';
    inp.style.cssText = 'border:none;background:transparent;font-size:12px;color:var(--muted);outline:none;width:72px;padding:2px 4px;';
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = inp.value.trim().replace(/[#,\s]+/g, '').toLowerCase();
        if (!val) return;
        if (pendingTags.length >= 3) { toast('Max 3 tags'); return; }
        if (!pendingTags.includes(val)) pendingTags.push(val);
        inp.value = '';
        _renderPendingTags(pendingTags, pendingContainerId, containerId);
        _renderTagSuggestions(pendingTags, containerId, pendingContainerId);
      }
    });
    row.appendChild(inp);
  }
}

function _renderPendingTags(pendingTags, containerId, suggestId) {
  const row = document.getElementById(containerId);
  if (!row) return;
  row.innerHTML = '';
  pendingTags.forEach((tag, idx) => {
    const pill = document.createElement('span');
    pill.className = 'note-tag';
    const s = _tagStyle(tag);
    pill.style.color = s.color;
    pill.style.background = s.background;
    pill.textContent = '#' + tag;
    const rm = document.createElement('button');
    rm.className = 'note-tag-remove';
    rm.textContent = '×';
    rm.addEventListener('click', () => {
      pendingTags.splice(idx, 1);
      _renderPendingTags(pendingTags, containerId, suggestId);
      _renderTagSuggestions(pendingTags, suggestId, containerId);
    });
    pill.appendChild(rm);
    row.appendChild(pill);
  });
}

function renderNotes(bookId = null, searchQuery = '') {
  const isAllView = !bookId;
  const notesList = document.getElementById(isAllView ? 'notesList' : 'bookNotesList');
  if (!notesList) return;

  notesList.innerHTML = '';

  let notes = isAllView ? state.notes : getNotesForBook(bookId);

  // Apply search filter
  if (searchQuery) {
    const sq = searchQuery.toLowerCase();
    notes = notes.filter(n =>
      (n.text || '').toLowerCase().includes(sq) ||
      (n.quote || '').toLowerCase().includes(sq) ||
      (n.tags || []).some(t => t.includes(sq.replace('#','')))
    );
  }

  if (notes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'note-item';
    empty.textContent = isAllView ? 'No notes in your library yet.' : 'No notes yet.';
    empty.style.cssText = 'text-align:center;color:var(--muted);';
    notesList.appendChild(empty);
    return;
  }

  notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(note => {
    const isQuote = note.type === 'quote';
    const noteEl = document.createElement('div');
    noteEl.className = 'note-item' + (note.sessionId ? ' session-note' : '') + (isQuote ? ' is-quote' : '');

    // ── Book attribution (all-notes view only) ──
    if (isAllView) {
      const book = state.books.find(b => b.id === note.bookId);
      if (book) {
        const attrEl = document.createElement('div');
        attrEl.style.cssText = 'font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:var(--accent);opacity:0.7;margin-bottom:5px;';
        attrEl.textContent = `📖 ${book.title}`;
        noteEl.appendChild(attrEl);
      }
    }

    if (isQuote) {
      // ── Quote blockquote rendering ──
      const quoteBlock = document.createElement('div');
      quoteBlock.className = 'note-quote-block';
      quoteBlock.textContent = `"${note.text}"`;
      noteEl.appendChild(quoteBlock);

      // Attribution line: quoteAuthor or book author
      const book = state.books.find(b => b.id === note.bookId);
      const attributedTo = note.quoteAuthor || (book && book.author ? book.author : null);
      if (attributedTo) {
        const attrLine = document.createElement('div');
        attrLine.className = 'note-quote-attribution';
        attrLine.textContent = `— ${attributedTo}`;
        noteEl.appendChild(attrLine);
      }
    } else {
      // ── Legacy quote attachment (if any) ──
      if (note.quote) {
        const quoteEl = document.createElement('div');
        quoteEl.className = 'note-quote';
        quoteEl.textContent = `"${note.quote}"`;
        noteEl.appendChild(quoteEl);
      }

      // ── Tags ──
      if (note.tags && note.tags.length > 0) {
        const tagsRow = document.createElement('div');
        tagsRow.className = 'note-tags-row';
        note.tags.forEach(tag => {
          const pill = document.createElement('span');
          pill.className = 'note-tag';
          const s = _tagStyle(tag);
          pill.style.color = s.color;
          pill.style.background = s.background;
          pill.textContent = '#' + tag;
          tagsRow.appendChild(pill);
        });
        noteEl.appendChild(tagsRow);
      }

      // ── Note text — static display ──
      const textEl = document.createElement('div');
      textEl.className = 'note-text';
      textEl.textContent = note.text;
      noteEl.appendChild(textEl);

      // ── Inline edit area (hidden by default) ──
      const editArea = document.createElement('textarea');
      editArea.value = note.text;
      editArea.style.cssText = 'display:none;width:100%;padding:8px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);background:var(--bg);color:var(--text);font-size:14px;line-height:1.5;resize:vertical;min-height:60px;box-sizing:border-box;margin-top:6px;';
      noteEl.appendChild(editArea);
    }

    // ── Meta: date + time + edited flag + session badge ──
    const metaEl = document.createElement('div');
    metaEl.className = 'note-meta';

    const createdDate = new Date(note.createdAt);
    const dateStr = createdDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = createdDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const editedStr = note.editedAt ? ' · edited' : '';

    const dateEl = document.createElement('span');
    dateEl.textContent = `${dateStr} at ${timeStr}${editedStr}`;
    metaEl.appendChild(dateEl);

    if (note.sessionId) {
      const badge = document.createElement('span');
      badge.className = 'note-session-badge';
      badge.textContent = 'Session';
      metaEl.appendChild(badge);
    }

    noteEl.appendChild(metaEl);

    // ── Actions ──
    const actionsEl = document.createElement('div');
    actionsEl.className = 'note-actions';

    // Edit button (notes only, all-notes view)
    if (isAllView && !isQuote) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn ghost';
      editBtn.textContent = 'Edit';
      editBtn.style.fontSize = '12px';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn';
      saveBtn.textContent = 'Save';
      saveBtn.style.cssText = 'font-size:12px;display:none;';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn ghost';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = 'font-size:12px;display:none;';

      editBtn.addEventListener('click', () => {
        textEl.style.display = 'none';
        editArea.style.display = 'block';
        editArea.focus();
        editBtn.style.display = 'none';
        saveBtn.style.display = '';
        cancelBtn.style.display = '';
      });

      saveBtn.addEventListener('click', () => {
        const newText = editArea.value.trim();
        if (!newText) { toast('Note cannot be empty'); return; }
        editNote(note.id, newText);
        textEl.textContent = newText;
        note.text = newText;
        textEl.style.display = '';
        editArea.style.display = 'none';
        editBtn.style.display = '';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        // Update edited marker
        const editedNote = state.notes.find(n => n.id === note.id);
        if (editedNote) dateEl.textContent = `${dateStr} at ${timeStr} · edited`;
        toast('Note updated');
      });

      cancelBtn.addEventListener('click', () => {
        editArea.value = note.text;
        textEl.style.display = '';
        editArea.style.display = 'none';
        editBtn.style.display = '';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
      });

      actionsEl.appendChild(editBtn);
      actionsEl.appendChild(saveBtn);
      actionsEl.appendChild(cancelBtn);
    }

    // Delete button (both views)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn ghost';
    deleteBtn.textContent = 'Remove';
    deleteBtn.style.fontSize = '12px';
    deleteBtn.addEventListener('click', () => {
      // Capture the full note object before deletion so undo can restore it exactly
      const deletedNote = { ...note };
      deleteNote(note.id);
      renderNotes(bookId);
      toastUndo('Note removed', () => {
        // Undo: push the note back and re-render
        state.notes.push(deletedNote);
        saveNotes();
        renderNotes(bookId);
      }, true); // permanent note delete → blue bar, 3 s
    });

    actionsEl.appendChild(deleteBtn);
    noteEl.appendChild(actionsEl);
    notesList.appendChild(noteEl);
  });
}

function openBookDetail(bookId) {
  const b = state.books.find(x => x.id === bookId);
  if (!b) {
    toast('Book not found');
    return;
  }
  
  document.getElementById('bookDetailTitle').textContent = b.title || 'Book Details';
  document.getElementById('bookDetailCover').textContent = b.title && b.title[0] ? b.title[0].toUpperCase() : '📘';
  document.getElementById('bookDetailName').textContent = b.title || 'Untitled';
  document.getElementById('bookDetailAuthor').textContent = b.author || 'Unknown author';
  document.getElementById('bookContentText').textContent = b.text || 'No text content available.';
  document.getElementById('bookInfoDate').textContent = new Date(b.dateAdded).toLocaleDateString();
  document.getElementById('bookInfoFile').textContent = b.fileName || 'Unknown file';
  document.getElementById('bookInfoLength').textContent = b.length || classifyLength(b.text || '');
  document.getElementById('bookInfoGenres').textContent = (b.genres || []).join(', ') || 'None detected';
  // Enriched metadata — only show rows when data exists
  const _iyRow = document.getElementById('bookInfoYearRow');
  const _ipRow = document.getElementById('bookInfoPubRow');
  const _isRow = document.getElementById('bookInfoSeriesRow');
  if (_iyRow) { document.getElementById('bookInfoYear').textContent = b.year || ''; _iyRow.style.display = b.year ? '' : 'none'; }
  if (_ipRow) { document.getElementById('bookInfoPublisher').textContent = b.publisher || ''; _ipRow.style.display = b.publisher ? '' : 'none'; }
  if (_isRow) { document.getElementById('bookInfoSeries').textContent = b.series || ''; _isRow.style.display = b.series ? '' : 'none'; }
  
  // Set current book ID for notes
  document.getElementById('bookDetailModal').dataset.bookId = bookId;

  // Reset note type toggle to 'note' each time a book is opened
  // (prevents stale 'quote' state from carrying over between books)
  _currentBookNoteType = 'note';
  const _bNoteTypeNote = document.getElementById('bookNoteTypeNote');
  const _bNoteTypeQuote = document.getElementById('bookNoteTypeQuote');
  if (_bNoteTypeNote) { _bNoteTypeNote.classList.add('active'); }
  if (_bNoteTypeQuote) { _bNoteTypeQuote.classList.remove('active'); }
  const _bNoteAuthor = document.getElementById('bookNewQuoteAuthor');
  if (_bNoteAuthor) { _bNoteAuthor.style.display = 'none'; _bNoteAuthor.value = ''; }
  const _bSaveBtn = document.getElementById('bookSaveNoteBtn');
  if (_bSaveBtn) _bSaveBtn.textContent = 'Save Note';
  const _bNoteTextarea = document.getElementById('bookNewNoteText');
  if (_bNoteTextarea) { _bNoteTextarea.value = ''; _bNoteTextarea.placeholder = 'Add a note about this book…'; }

  // Render notes for this book
  renderNotes(bookId);
  renderSimilarBooks(bookId);
  
  // Show the modal
  document.getElementById('bookDetailModal').style.display = 'flex';

  // Async cover — replace gradient placeholder with real cover if available
  (async () => {
    const coverEl = document.getElementById('bookDetailCover');
    if (!coverEl) return;
    try {
      const dataUrl = await generateBookCover(bookId);
      if (!dataUrl) return;
      // Only update if this modal is still showing the same book
      if (document.getElementById('bookDetailModal').dataset.bookId !== bookId) return;
      coverEl.textContent = '';
      coverEl.style.background = 'none';
      coverEl.style.padding = '0';
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:16px;display:block;';
      coverEl.appendChild(img);
    } catch(e) { /* keep gradient fallback */ }
  })();

// "Find Similar" button — seeds Loren with this book
  const similarBtn = document.getElementById('bookDetailSimilar');
  if (similarBtn) {
    similarBtn.onclick = () => openLibrarianWithSeed(bookId);
  }

  // "Mark as read" toggle
  const markReadBtn  = document.getElementById('bookDetailMarkRead');
  const readIcon     = document.getElementById('bookDetailReadIcon');
  const readLabel    = document.getElementById('bookDetailReadLabel');

  function syncReadBtn() {
    const read = isBookRead(bookId);
    readIcon.textContent  = read ? '✓' : '○';
    readLabel.textContent = read ? 'Read' : 'Mark as read';
    markReadBtn.style.opacity = read ? '0.6' : '1';
  }

  syncReadBtn();
  markReadBtn.onclick = () => {
    const nowRead = !isBookRead(bookId);
    markBookRead(bookId, nowRead);
    syncReadBtn();
    toastUndo(nowRead ? 'Marked as read' : 'Marked as unread', () => {
      markBookRead(bookId, !nowRead);
      syncReadBtn();
      renderLibrary();
    });
  };
}
