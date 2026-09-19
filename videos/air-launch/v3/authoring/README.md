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
python3 v3/authoring/sfx.py            # the 84-cue foley bus -> a scratch .wav at 48 kHz
python3 v3/authoring/mix.py <that.wav> # track + bus + sidechain -> assets/bgm-mix.mp3
```

`sfx.py` owns how loud each cue is (a role table of dB-below-music, solved per cue against the
track's own level in the half second around it) and which ten seconds have none at all — the
cold open plays on music alone. `mix.py` owns the balance between the two buses, the sidechain,
and the one rate conversion in the whole chain. Neither reads the other's constants, so a level
note only ever changes one file.

`mix.py`'s limiter is true-peak aware, not sample-peak aware: it upsamples 4×, limits at that
rate, and decimates back down, because a sample-domain limiter shipped a mix that measured clean
in the pre-encode WAV and then clipped on playback anyway — MP3 encoding a hard-limited signal
can produce intersample peaks a plain `.max()` never sees. Verify any change to the ceiling by
decoding the actual `assets/bgm-mix.mp3` and checking its peak, not by trusting the WAV.

`assets/bgm-music-only.mp3` is the untouched track and the source of truth for the beat grid.
Never overwrite it.
