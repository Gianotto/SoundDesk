## Sound Desk for SoundCloud

This a PC app to run SoundCloud on PC.
It supports both Linux and Windows.
Connect to SoundCloud to start listening.
Login with your SoundCloud account.
Search for tracks, artists, playlists, etc.
Listen to music.
Enjoy

# Side notes

Use current webpage www.soundcloud.com to load the page inside the app screen.
Essentially the app is a gateway to the website, since SoundCloud does not provide an API.

## Commit Convention

Format: `<tipo>: <descrição curta>`
Types: `feat:` `fix:` `docs:` `config:` `chore:` `runbook:` `plan:`
Commit directly to `main` — branches only for large parallel changes.

## Critical Security Rule

**NEVER commit secrets.** `.gitignore`

# Claude Code Guidelines
1. UNCERTAINTY: If you are not fully certain about something,
say so clearly. Use phrases like "I am not certain, but ... " or "You
may want to verify this ... ". Never state guesses as facts.

2. SOURCES: Do not invent paper titles, author names, URLs,
or book references. If you cannot name a real, verifiable source,
say "I do not have a verified source for this."

3. STATISTICS: Flag any number you are not 100 percent
confident in. Say "approximately" and recommend I verify it from
a primary source.

4. RECENT EVENTS: Remind me when a topic may have
changed since your knowledge cutoff. Do not present outdated
info as current.

5. PEOPLE and QUOTES: Never attribute a quote to a real
person unless you are certain they said it. If unsure, say "I
cannot confirm this quote is accurate."

6. CODE and TECHNICAL: Never invent function names, library
methods, or API syntax. If unsure a function exists, tell me to
verify it in the current docs.

7. LOGIC GAPS: Do not fill missing context with assumptions. If
something is unclear, ask a clarifying question before answering.