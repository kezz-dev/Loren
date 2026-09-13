# Loren
A single-file, offline-first web app for tracking your personal book library and reading habits with AI-assisted search and discovery.

 # Loren

Loren is a personal book library and reading tracker, built as a single self-contained HTML/JS app. No backend, no build step — just open the file and your library lives in the browser.

This is my first project on GitHub. It started as a way to keep track of what I'm reading and grew into something bigger, including a small AI-assisted search layer for finding books by description rather than exact title.

## Features

- **Library management** — organize books into folders, drag-and-drop to sort, color-coded folder chips
- **Reading tracker** — track progress, reading sessions, and streaks
- **AI-assisted discovery** — ask for books in natural language (e.g. "something like a slow mystery") using WordNet-powered synonym expansion and a lightweight intent classifier, with keyword matching as a fallback
- **PDF support** — import PDFs, extract text with pdf.js, and store them locally
- **Offline-first / PWA** — works offline; data is stored in IndexedDB (books, covers, extracted text, dictionary/WordNet data all cached locally)
- **Theming** — light/dark mode and alternate palettes (e.g. a "Warm Night" theme), with a smooth animated theme-switch transition
- **Auto-generated covers** for books without one

## Tech

- Vanilla HTML/CSS/JS — no framework, no build tools
- [pdf.js](https://mozilla.github.io/pdf.js/) for PDF text extraction
- IndexedDB for local storage (books, PDFs, covers, dictionary, WordNet data)
- Google Fonts (Inter, Merriweather, Lora, Montserrat, Courier Prime)

## Status

This is a personal project and a work in progress — I'm actively building and fixing things as I use it myself. Expect rough edges.

## Running it

Loren is a single HTML file. Clone the repo and open `Loren.html` in a browser, or serve the folder locally for full PWA/manifest support:

## Documentation

The `docs/` folder has the full feature reference, converted from the original docs page into per-topic Markdown files:

- [Panels](docs/panels.md) — the four main navigation panels
- [Book Management](docs/book-management.md) — adding, editing, organizing, folders, duplicates, wishlist
- [Reading Experience](docs/reading-experience.md) — PDF reader, session tracking, insights dashboard
- [Discover](docs/discover.md) — mosaic and genre-shelf browsing
- [Recall (Trivia)](docs/recall-trivia.md) — book trivia game and question types
- [Loren AI](docs/loren-ai.md) — the built-in AI librarian
- [Query Reference](docs/query-reference.md) — every query Loren understands, with examples and responses
- [Proactive Notifications](docs/proactive-notifications.md) — moments where Loren speaks first
- [Observations](docs/observations.md) — in-session behavioral asides
- [Settings](docs/settings.md) — customization options
- [Search](docs/search.md) — how the search bar behaves per panel

  
## License

Not yet decided, feel free to open an issue if you have thoughts.
