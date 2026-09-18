# air-launch v2 — music-driven redesign plan

Current state: PR #1 (108s, silent, 13 shots on a WebGL cloud sky, `npm run check` clean).
v2 goal: retime the whole film to **Passwords.mp3 (103.0s)**, swap in the two provided logos, and raise the design/motion bar shot-by-shot.

## 1. The music decides the structure

`analyze-beatgrid.py` (music-to-video skill) on Passwords.mp3 → `audiomap.json`:

- 83.4 BPM, 4/4 · high-energy from ~2s to ~66s (SURGEs at 6s, 10s, **51s**; DROPs at 18s, 24s)
- **Hard stops at 67s and 69s** (biggest DROP of the track at 69s)
- Wind-down 69–89s with micro-silences at 75–76, 79–80, 87–88
- **Near-silence 89–103s** — a long airy tail

New master timing (film total 103.0s, cuts snapped to beat/phrase anchors):

| # | Shot | Old | New | Music anchor |
|---|------|-----|-----|--------------|
| 1 | Open (logo + hero) | 0–9 | 0–6.0 | cold open in the 0–1s void; SURGE at 6s fires the first cut |
| 2 | "invisible, as light as air" | 9–17 | 6.0–13.8 | phrase 1 (SURGE 6 → phrase edge 13.77) |
| 3 | Endowments (5 nouns + icons) | 17–25.5 | 13.8–25.3 | phrase 2; each noun lands on a downbeat; DROP at 24s = "composable computer" |
| 4 | 1) Hyperpersonalization | 25.5–34 | 25.3–33.0 | phrase 3 opens |
| 5 | 2) Import Context | 34–42.5 | 33.0–40.5 | beat-cut wire connections |
| 6 | 3) Connect your Apps | 42.5–51 | 40.5–48.5 | swarm density rides the sustained perc roll |
| 7 | 4) Composable computer | 51–59.5 | 48.5–56.0 | **SURGE at 51s = the three cards slam in** |
| 8 | 5) Knock off Knowledge Work | 59.5–68.5 | 56.0–63.5 | checklist ticks on snare hits |
| 9 | 6) Remote control | 68.5–76.5 | 63.5–69.0 | accel-roll 64.3–66.7 drives the swarm; **hard stop 67/69 = freeze** |
| 10 | Guardian angel backend | 76.5–86.5 | 69.0–81.0 | the 69s DROP opens the quiet backend chapter; wire pulses on the sparse snares |
| 11 | "Your agent, your weights" | 86.5–93 | 81.0–89.0 | micro-silence 87–88 = beat of stillness |
| 12 | "air, your guardian angel" | 93–99 | 89.0–96.0 | near-silence — pure sky |
| 13 | End card + partner wall | 99–108 | 96.0–103.0 | logos settle in the silent tail; audio fades with the sky |

`assets/bgm.mp3` mounted on its own track in the master with a 1.5s fade-out at 101.5–103 (hyperframes-audio fade), sky `uProgress` re-keyed to the new chapter edges.

## 2. Logos

- **Onairos** — use the provided gradient-silhouette PNG (`onairos-logo-v1.png`) as the shot-04 hub avatar and on the end-card wall, replacing my simplified mark. New treatment: the silhouette breathes inside a glass ring; the three service tiles orbit on a tilted 3D ellipse (rotateX perspective) with depth-scaled size/blur/opacity, each tile pulsing as it passes behind the head; taste-graph particles stream from the tiles into the silhouette.
- **WZRD.tech** — use the provided chrome blackletter PNG in shot 01 ("air **by WZRD.tech**" lockup), shot 13 ("Built on Zaps by **WZRD.tech**"), replacing the plain-text wordmark. On dark sky it reads well; I'll add a soft white glow pass behind it for separation. (PNG has a white background — I'll knock it out to transparency first.)

## 3. 100x design/motion pass (per shot)

- **Global:** grade the whole film with a subtle vignette + film grain layer; unify glass panels (1px inner stroke, 24px blur, 8% white); all beat-cut entrances get a 2-frame micro-scale overshoot (1.04 → 1.0) synced to the hit; parallax: sky drifts −1%, mid layer +0%, foreground +1.5% per shot so cuts have depth continuity.
- **S1:** chrome WZRD.tech mark materializes from 6 blurred shards; app icons now stagger-drop on the 2–6s bass hits with squash-settle.
- **S2:** per-word kinetic type on onset times; "air" resolves with a wind-streak particle wipe.
- **S3:** nouns punch on downbeats, icons orbit-in from the noun's motion vector, held nouns drift as a constellation.
- **S4:** new Onairos treatment above.
- **S5:** wires draw with light-pulse heads on beats; imported items stack into a "context" glass stack.
- **S6:** swarm becomes a phyllotaxis spiral (deterministic golden-angle layout) that condenses from 120 icons into the three hero tiles; density keyed to the perc roll.
- **S7:** three cards slam on the 51s SURGE with camera shake (2px, 3 frames); coming-soon card flips in on the after-beat.
- **S8:** rebuild surface on the Buoy references: light iMessage-style thread, blue user bubble, Send/Cancel action buttons, "Memory updated" chip; checklist ticks land on snare onsets.
- **S9:** remote buttons depress on kicks; mesh nodes light in radial waves; the 67/69s hard stops freeze the mesh for 2 beats — cut on silence.
- **S10:** wings feather-in one path per sparse snare; wire pulses travel the chain in tempo (one card per bar).
- **S11–12:** words surface from the sky with long soft parallax; halo ring-out replaces the pop.
- **S13:** partner wall tiles rise in 3 rows on a soft grid cascade; Onairos + WZRD marks swapped for the real artwork; end on a slow push-in as audio and sky fade together.

## 4. Verification

`npm run check` (lint/runtime/layout/contrast) + snapshot review at every new cut point and both hard stops, re-render `renders/air-launch.mp4` (now with audio), update PR #1.

Not doing unless asked: regenerating other brand marks, changing resolution/fps, publishing.
