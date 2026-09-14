# Loren

**A private, offline-first librarian for your personal book collection.**

Loren is a local-first reading environment for organizing, reading, searching, and returning to your own PDFs — in the browser, without an account, and without sending your library to a server.

**Made for readers. Not a chatbot product. Not a productivity dashboard.**

> This started as a first serious project: a way to keep track of what I was reading. It grew into a full local library, reader, and on-device search engine. The early structure is still a single HTML file on purpose. The next step is to modularize that file without changing how Loren feels.

Screenshots and a short demo will be added in a later pass.

## Why Loren

Loren is designed around reading, not engagement. It does not use streaks, leaderboards, social comparison, or loops meant to keep you inside the app.

Its intelligence exists to reduce friction: find a book, open it, remember where you stopped, and notice useful patterns in a library that already belongs to you.

## Features

- Personal PDF library with folders, smart folders, favorites, notes, trash, and a wishlist
- In-browser reader with saved reading position, session tracking, and reading insights
- Local search and natural-language discovery over *your* books
- Discover views, including mosaic and genre shelves
- Recall and trivia drawn from the local library
- Contextual prompts and quiet in-session observations, rate-limited and dismissible
- Offline PWA using IndexedDB for books and state, with a service worker for the app shell
- Light / dark theme, Warm Night tint, and auto-generated covers when a book has none

Insights and observations are optional supporting information. They are not a scoring system.

## Architecture

Loren is currently a single-file application (`Loren.html`) with a small PWA shell around it.

```text
                         Loren
                           │
              ┌────────────┼────────────┐
              │            │            │
         Library UI    PDF Reader    Loren AI
              │            │            │
              └────────────┼────────────┘
                           │
                    Application Core
                           │
              ┌────────────┼────────────┐
              │            │            │
          IndexedDB      PDF.js     Local Intelligence
              │                         │
       Books / State             Search / Ranking
              │                         │
              │                    Recommendations
              │                         │
              └────────────┬────────────┘
                           │
                    Local-first PWA
                      ┌────┴────┐
                      │         │
                  manifest    Service
                   .json      Worker
```

There is **no application backend**. PDFs, extracted text, notes, reading history, and personalization state remain in the browser.

## Local Intelligence / Search

Loren's “AI” is a local NLP, retrieval, and recommendation engine. It is **not a hosted language model**.

A typical request moves through:

```text
Natural language
      ↓
Intent detection
      ↓
Entity / constraint extraction
      ↓
Candidate retrieval
      ↓
TF-IDF / metadata scoring
      ↓
Personalization
      ↓
Response text
```

This supports search, recommendations, comparisons, follow-ups, folder actions, notes, reading questions, and similar library tasks.

The full query surface is documented in [`docs/query-reference.md`](docs/query-reference.md).

`dictionary.json` was compiled for this project. Its original upstream source and license have not yet been verified, so its provenance remains documented as a follow-up task rather than being attributed here without verification.

## Privacy and Offline Design

Loren keeps the library in the browser.

### Kept locally

- PDFs
- Extracted book data and text
- Notes
- Reading history
- Personalization and library state

Recommendations and search results are generated from this local data rather than being produced by a remote application backend.

This gives Loren:

- Privacy by default
- Offline use
- No account requirement
- No server dependency for the core library
- A simple deployment model: serve the app locally and open it in a browser

There are tradeoffs. Loren does not currently provide intentional cross-device synchronization, browser storage is limited, very large PDFs can be heavy, and its local intelligence is rule/classifier/retrieval-based rather than an LLM.

## Technical Decisions

### Vanilla HTML, CSS, and JavaScript

Loren currently uses no framework and no build step.

The single-file structure made it easy to run, experiment, and iterate while the product was still forming.

### IndexedDB

IndexedDB stores the user's books and application state in the browser.

### PDF.js

PDF.js handles local PDF rendering and text extraction.

### PWA

`manifest.json` and `sw.js` provide the standalone and offline application shell.

### Current library view

The default library view is **List**. Grid and Shelf views are available in Settings.

### Modularization

Modularization is planned, not started.

The goal is to split the large `Loren.html` into maintainable modules **without changing Loren's current behavior or product philosophy**.

See [issue #8](https://github.com/kezz-dev/Loren/issues/8).

## Project Structure

```text
Loren/
├── Loren.html
├── manifest.json
├── sw.js
├── dictionary.json
├── icon-192.png
├── icon-512.png
├── LICENSE
├── README.md
├── .gitignore
└── docs/
```

Icons and `dictionary.json` remain at the repository root because `manifest.json`, `sw.js`, and the application load them from there.

## Running Loren

Clone the repository and serve the folder locally.

```bash
git clone https://github.com/kezz-dev/Loren.git
cd Loren
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/Loren.html
```

Serving Loren over a local HTTP server is recommended for full PWA behavior, including the manifest and service worker. Opening `Loren.html` directly with a `file://` URL may not provide the same behavior.

## Documentation

Detailed documentation will be expanded alongside the modularization work.

Current documentation includes:

- [`docs/query-reference.md`](docs/query-reference.md) — Loren AI query surface

Additional documentation areas planned:

- Panels
- Book management
- Reading experience
- Discover
- Recall
- Loren AI
- Contextual prompts
- Observations
- Settings
- Search

## Limitations

Loren is intentionally local-first, but that comes with real constraints:

- **One browser profile, by design** — there is no built-in cross-device sync
- **Browser storage limits** — large libraries can eventually run into storage constraints
- **Large PDFs can be heavy** — rendering and extracting text from very large files may be slow
- **Local ranking has limits** — useful for library search and discovery, but not a substitute for a large language model
- **Dictionary provenance is incomplete** — the original upstream source and license for `dictionary.json` still need to be verified
- **The application is still a monolith** — `Loren.html` is large and harder to navigate and maintain than a modular codebase

These limitations are part of the current state of the project, not hidden behind the product description.

## Roadmap

- [ ] Modularize the monolith without changing behavior — [issue #8](https://github.com/kezz-dev/Loren/issues/8)
- [ ] Add product screenshots and a short demo
- [ ] Record `dictionary.json` provenance once its source and license are verified
- [ ] Continue improving local search and library discovery
- [ ] Keep the product calm: no gamification of reading

## License

MIT
