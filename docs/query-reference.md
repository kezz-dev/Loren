*Complete Query Reference*

# Everything You Can Ask Loren

Every type of question or command Loren understands — with example phrasings and what happens in response. Loren is flexible: you don't need to use exact words.

### 🔍 Search & Discovery

#### 📚 Keyword / Genre / Mood Search

Find books in your library matching a topic, genre, mood, or author. The default intent — anything not matching a more specific command falls here.

Example queries: "a short fantasy", "something dark", "find me history books", "philosophy, not too long", "Ursula Le Guin", "inspiring"

  - Response (Loren's response): Returns up to 5 matching books with a match reason per book (e.g. "Genre: fantasy · short read · you haven't opened this one"). If more than 5 match, a "＋N more" button expands the list.

  - Branch [If results found]: "Here are some [genre] picks from your library —" followed by book cards.
  - Branch [If no strong matches]: Shows best available books with a softer intro: "I couldn't find an exact match, but these might be close —"
  - Branch [With exclusion]: "not horror", "nothing long" — hard-filters those genres/lengths before scoring.

#### 🎯 Recommend (based on your library)

Asks for a personalized recommendation using favorites, read history, and fitness scoring.

Example queries: "what should I read?", "recommend something", "based on my favorites", "what would you pick?", "suggest a mystery"

  - Response (Loren's response): Uses genre of recent favorites, cross-references with unread books, applies genre diversity rotation to avoid recommending the same genre repeatedly. Shows 1–3 picks with reasons.

  - Branch [Genre signal present]: "recommend a mystery" → recommends from the mystery section of your library.
  - Branch [No signal]: Picks a genre from your most-favorited/read genre, rotates if that genre dominated recent recommendations.

#### 🎲 Surprise Me

Loren picks something unexpected — deliberately from a genre you haven't explored much.

Example queries: "surprise me", "just pick something", "you choose", "dealer's choice", "pick anything"

  - Response (Loren's response): Picks a book from a genre you haven't engaged with recently — outside your usual reading. Flags it with "outside your usual reading" as the match reason.

#### ⚖️ Compare Two Books

Side-by-side comparison of two books in your library — genre, length, author, shared themes, and a reading recommendation.

Example queries: "compare Dune and 1984", "Dune vs 1984", "what's the difference between X and Y?", "which is better, X or Y?"

  - Response (Loren's response): Compares author, shared/unique genres, length difference, text-level theme overlap (shared keywords), and gives a mood-based reading recommendation ("if you want tension and pace, go with…").

  - Branch [Same author]: "Both are by [author], so you're in the same authorial voice either way."
  - Branch [Book not found]: "I couldn't find [title] in your library — did you mean something else?"

#### 🔢 Superlative Query

Find the extreme end of your library — longest, shortest, newest, oldest, most opened, most annotated.

Example queries: "longest book", "shortest book", "oldest book", "newest", "most pages", "most annotated", "most opened"

  - Response (Loren's response): Returns the single book that matches the superlative with a one-line explanation ("At [N] pages, this is the longest book in your library.").

#### 📜 Quote Search

You remember a line from something you read but can't remember which book. Loren searches the text of every book to find it.

Example queries: "find 'we are all stardust'", "which book has this passage: …", "I read somewhere that…", "locate 'the wound is the gift'"

  - Response (Loren's response): Tries exact match first, then fuzzy sliding-window match. Returns book title + location (chapter/line number) if found.

  - Branch [Exact match]: "Found it in [Book], in [Chapter], around line [N]."
  - Branch [Fuzzy match]: "This sounds close to a passage in [Book] …" with the matched text shown.
  - Branch [Not found]: "I couldn't find that passage in any book with extracted text."

### 🔄 Follow-Up & Conversation

#### ➕ Show More / Something Different

Get more results from the same search, or continue a conversation using the last used genre/length/author filters.

Example queries: "show me more", "something else", "more like this", "any others?", "keep going", "similar books"

#### 📌 Ordinal / Anaphora Reference

Refer to a result by its position in the last set of results.

Example queries: "the second one", "open the third result", "tell me about the first one"

  - Response (Loren's response): Looks up the 1st/2nd/3rd/etc. book from the last result set. If a length modifier is also present ("the second one but shorter"), applies it as a filter.

#### 🔎 Tell Me More / What's It About

Get a description of the last mentioned book or a specific one by name.

Example queries: "tell me more about that", "what is Dune about?", "describe that book"

#### ❓ Why This?

Ask Loren to explain why she recommended a particular book.

Example queries: "why that?", "why did you pick this?", "explain your recommendation"

  - Response (Loren's response): Rebuilds the reason from the scoring criteria used at the time — genre match, mood match, open count, read status, fitness signal.

### 📚 Library Actions

#### 🚀 Open a Book

Tell Loren to open a specific book by name and she'll launch the reader.

Example queries: "open Dune", "take me to 1984", "read War and Peace", "go to Foundation"

#### ✓ Mark as Read

Tell Loren you've finished a book. Also supports checking if you've already read something.

Example queries: "I finished Dune", "mark 1984 as read", "I just completed Foundation", "have I read Brave New World?", "did I finish Dune?"

  - Response (Loren's response): Marks the book as read and acknowledges it. For queries ("have I read…?") returns current read status with date if available.

#### 📁 Folder Commands

Create folders or add books to them directly from the chat.

Example queries: "add Dune to Classics folder", "create a folder called TBR", "move 1984 to my Fiction folder", "put it in the Philosophy folder"

#### 📝 Add a Note

Save a reading note for a specific book through the chat.

Example queries: "add note to Dune: the worm symbolism is heavy here", "note: the ending felt rushed", "save note for 1984 p.42: doublethink introduced", "jot down: loved the first chapter"

  - Response (Loren's response): Saves the note to the book's notes database and confirms. If book is ambiguous (multiple matches), Loren asks you to clarify which one.

#### 🔗 Find Series

Detect multi-book series in your library and optionally group them into a folder.

Example queries: "find series", "detect series in my library", "group series into folders", "my series"

#### 📎 Export Notes as PDF

Export all notes for a book (or all books) as a downloadable PDF file.

Example queries: "export notes", "export notes for Dune as PDF", "download notes", "save all notes to PDF"

### 📊 Reading Intelligence

#### 📈 Reading Insights

Opens the full Reading Insights dashboard with genre breakdown, session stats, weekly chart, and personality analysis.

Example queries: "reading insights", "my reading stats", "show my stats", "library report", "reading habits"

#### 🔖 Where Did I Leave Off?

Find the last book you were reading and resume from where you stopped.

Example queries: "where did I leave off?", "what was I reading?", "pick up where I left off", "continue reading", "my last book"

  - Response (Loren's response): Returns the most recently opened unfinished book with current page, progress percentage, and time since last opened. Offers to open it.

#### ⏱ Reading Pace

Estimate how long it will take to finish a specific book based on your actual reading speed.

Example queries: "how long to finish Dune?", "time left in 1984", "pages left in Foundation", "how many sessions to finish?", "almost done with this?"

  - Response (Loren's response): Uses pages-per-minute from past sessions × pages remaining. Returns estimated minutes and sessions left. Requires at least 2 recorded sessions for a reliable estimate.

  - Branch [Enough data]: "At your pace, you have about [N] minutes left — roughly [X] sessions."
  - Branch [Not enough sessions]: "I don't have enough reading sessions for [book] to estimate yet."

#### 📍 Reading Progress

Ask how far you are in a specific book.

Example queries: "how far am I in Dune?", "what page am I on in 1984?", "where am I in Foundation?", "my progress on Brave New World"

#### 📅 Date Query

Find books added or read during a specific month or time period.

Example queries: "books added in January", "what did I add last month?", "what I read in 2023", "added this year"

#### 🗓 Year in Review

Full annual reading recap — total books, pages, favorite genres, most-opened.

Example queries: "year in review", "how much did I read this year?", "annual reading wrap-up", "books this year"

#### 📊 Month Comparison

Compare your reading activity between this month and last month.

Example queries: "this month vs last month", "how am I doing?", "compare reading this month"

#### 🧬 Reading Personality

Get a personalized description of your reading style based on your library patterns.

Example queries: "what kind of reader am I?", "my reading personality", "describe my reading style", "reading profile"

  - Response (Loren's response): Generates a short paragraph synthesizing genre distribution, reading pace, time-of-day patterns, and return frequency. Example: "You're a deep diver — you tend to revisit a small set of authors rather than constantly exploring new territory."

### 🔬 Text & Notes

#### 🔍 Full-Text Search Inside a Book

Search for a specific word or phrase within a book's extracted text — useful for finding exact passages or references.

Example queries: "find 'water' in Dune", "search for spice in this book", "where is 'prescience' mentioned in Foundation?", "look for memory in it"

#### 🗒 Note Search

Search through all your notes across all books for a keyword or topic.

Example queries: "find my notes about themes", "show notes containing 'ending'", "what did I write about the character?", "notes tagged 'important'"

#### ℹ️ Book Information

Look up metadata for a specific book — year published, publisher, series membership.

Example queries: "when was Dune published?", "who published Foundation?", "what series is 1984 in?", "information on Brave New World"

#### 📖 Word Definition

Look up the definition of a word — useful while reading dense or unfamiliar texts.

Example queries: "define prescience", "what does solipsism mean?", "meaning of apotheosis", "look up laconic"

### ⏱ Reading Sessions

#### ▶️ Session Commands

Start, end, or pause a timed reading session. Sessions are logged for pace estimation and insights.

Example queries: "start a session with Dune", "begin reading session", "end session", "stop session", "pause session"
