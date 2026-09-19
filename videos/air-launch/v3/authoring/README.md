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

## The audio chain

Two scripts, in order, from the project root:

```bash
python3 v3/authoring/sfx.py            # the 94-cue foley bus -> a scratch .wav at 48 kHz
python3 v3/authoring/mix.py <that.wav> # track + bus + sidechain -> assets/bgm-mix.mp3
```

`sfx.py` owns how loud each cue is: a role table of dB-below-music, solved per cue against the
track's own level in the half second around it, plus the first-half trim. `mix.py` owns the
balance between the two buses and the one rate conversion in the whole chain. Neither reads the
other's constants, so a level note only ever changes one file.

`assets/bgm-music-only.mp3` is the untouched track and the source of truth for the beat grid.
Never overwrite it.
