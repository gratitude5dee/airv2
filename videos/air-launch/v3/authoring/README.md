# Authoring scripts (historical)

These wrote `compositions/*.html` once, from the shared partials in `parts.py` — the phone shell,
the iMessage spec, the thread engine, the type tokens. They are kept so a reader can see where the
shared pieces came from, and so a sweeping change (a token, the phone chrome) can be made in one
place.

**The HTML in `compositions/` is the source of truth.** It has been hand-tuned since these ran.
Re-running a script overwrites that file wholesale and will discard any later edit to it. If you
do regenerate, run from the project root so the relative asset paths resolve:

```bash
cd videos/air-launch && python3 v3/authoring/s06.py
```

Then re-run `npm run check` and re-snapshot the shot's seams before trusting the result.
