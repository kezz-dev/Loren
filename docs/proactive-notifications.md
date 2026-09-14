*Contextual Prompts*

# When Loren Speaks First

These are contextual prompts, not a notification feed. Loren uses local signals — library state, reading history, time of day — and only speaks first when something seems useful.

A dot appears on the librarian button when a prompt is waiting. Opening chat shows it. Prompts are dismissible, rate-limited, and meant to stay quiet. Each type has its own cooldown so the app does not nag.

- **👋 First Launch Welcome** [✓ Yes/No response armed]
  - Trigger: Very first time the app is opened. Fires once ever.
  - Message: "Hi [name] — I'm Loren, your personal librarian. Tap the Add button to bring in your first book, or just ask me anything. Would you like to know what I can (and can't) do?"
- **📋 Circulation Desk Reminder**
  - Trigger: A book has been "checked out" (opened) for 5+ days without being marked read or re-opened.
  - Message: "[Book title] is still on your desk. It's there whenever you're ready."
- **🌙 Unusual Time-of-Day**
  - Trigger: You open Loren at a time of day significantly different from your usual reading time. Once per 7 days.
  - Message: "You usually read in the [morning/evening]. It's a little unusual to see you reading in the [afternoon/night]."
- **♥ Repeat Opener (Suggest Favorite)** [✓ Yes/No response armed]
  - Trigger: You've opened a book 8+ times but never saved it to Favorites. Respects snooze and explicit decline.
  - Message: "You've opened '[Book]' 8 times — it seems like one you keep coming back to. Want me to add it to your favorites?"
- **📦 Unread Books (Long-Added)**
  - Trigger: One or more books were added 30+ days ago and have never been opened. Once per 30 days.
  - Message: "[Book A], [Book B] and [Book C] have been in your library for over a month without being opened. Want me to suggest one to start with?"
- **🕰 Forgotten Book**
  - Trigger: A book that was once opened hasn't been touched for 60+ days. Once per 7 days.
  - Message: "[Book] has been waiting quietly for 2 months. It's still there whenever you're ready."
- **🍂 Seasonal / Holiday Moment**
  - Trigger: Current date falls near a seasonal or cultural moment (New Year, Ramadan, Eid, harvest season, etc.). Once per 28 days per seasonal window.
  - Message: Seasonal message tied to the period + a book suggestion from your library matching the mood, if available.
- **🎮 Friday/Saturday Trivia Nudge**
  - Trigger: Friday or Saturday evening (after 6pm), and at least 2 books in your library. Once per 5 days.
  - Message: "It's a quiet Friday evening — the perfect time for a round of Book Trivia. Tap ⏳ Recall to play."
- **📂 Gather Orphans**
  - Trigger: A book exists in your library that shares an author with books in a folder but isn't in that folder itself. Once per 14 days.
  - Message: "I noticed '[Book]' might belong in your '[Folder]' folder — it shares the same author. Ask me to 'gather' and I'll show you the full list."
