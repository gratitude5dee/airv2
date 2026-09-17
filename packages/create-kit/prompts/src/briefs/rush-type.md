<!-- Brief for arlan/rush-type (goal-create-v12 §11.3). Source: arlan.me/vault (Arlan Marat), MIT, Tier A per kit.sources.json; supplied verbatim by the owner on 2026-09-17. Re-verify the vault license evidence at harvest. Harvest notes: WebGL1 → litePolicy "never" (lite: false); under lite / reduced motion / no WebGL render one crisp still of the resting word on --canvas; `var(--font-neue-montreal)` → var(--font-body); `../../lib/view-transition` → kit/arlan/holo/view-transition.ts; the scroll coupling (SCROLL_GAIN) is inert inside a Messages webview and may be left as is; WORDS becomes a prop with an even count enforced. -->

# Rush Type (`arlan/rush-type`)

## Build this

Build this: a single lowercase word on flat black that sits still long enough to read, then BLASTS: it stretches roughly twelve times taller and nearly three times wider, and the speed itself tears the colour out of it into vertical streaks of green and violet, before the next word of a short phrase falls back out of the blur. THE COLOUR IS NOT A TINT, IT IS A BYPRODUCT OF SPEED. This is the whole idea and everything else follows from it. Render the SAME white word three times into the three colour channels, each one accumulated over a DIFFERENT SHUTTER LENGTH (green longest at 1.0, red about 0.62 of green, blue about 0.34), and DIVIDE by the total sample weight rather than summing, so a longer shutter spreads the same ink over more pixels and comes out dimmer. Green then reaches furthest and goes faint, blue stays tight and bright, red sits between them, and every stroke ends up with a blue-white core and green escaping past both ends. Stop the word and all three shutters collapse to zero length, the three channels land on identical pixels, and it resolves to plain white. There is no colour constant anywhere in the code and no crossfade to a white state. Do NOT reach for an RGB-split filter or a chromatic-aberration pass, because those tint a still word and this one must be colourless at rest. Widening the gap between the three shutter lengths is the ONLY knob that makes the split more colourful, because saturation here is nothing but the distance between the channels. THE INVARIANT THAT GOVERNS EVERY OTHER DECISION: any term you add must be EXACTLY zero at rest. The resting word is the composition, it has to stay white and pixel-sharp, and anything that cannot switch itself off at p = 0 does not belong in the piece. Two ideas fail that test and are worth naming because both sound good. A feedback trail (a decaying buffer composited each frame) still ghosts after the word has stopped. An italic shear at speed tilts the stems so they smear too, which loses the contrast the whole thing is built on. Check every addition by freezing at rest and confirming the frame is still pure white and pixel-sharp. THE BLUR IS VERTICAL-ONLY. Never sweep x. This is not a detail, it is what makes the effect legible: a vertical stem smeared vertically is the same vertical stem, so stems survive the worst frame as hard white bars while everything with a horizontal edge (bowls, crossbars, terminals) shears into colour, and the contrast between the two is the entire texture of the thing. Blur both axes and it turns into an undifferentiated grey cloud. SWEEP THE SCALE, NOT THE POSITION. A motion blur of a scaling object is an accumulation across the range of SCALES it passes through during the shutter, not a smear along a direction. Sweeping position instead drags the centroid and the word visibly slides while it blurs; a scale sweep keeps every channel centred on the same point and makes the streaks radiate away from the middle of each stroke. Fit the scale across the shutter as a QUADRATIC through its start, middle and end, not a straight line: the word turns around at the peak, so start and end sit at nearly the same scale there and a linear fit reports almost no motion, which kills the blur at the exact moment the word is biggest and swapping. SHAPE THE SHUTTER RATHER THAN BOXING IT. Weight the samples towards the present instant and divide by the sum of the weights, not the count. Equal weights make a streak a uniform bar with a hard end and the word reads as smudged in place; weighted, it gets a bright head at the scale the word is at right now and tails falling away either side, so it reads as going somewhere. It stays energy-conserving, so speed still costs brightness. DRIVE THE BLUR FROM THE MOTION, NOT BY HAND. Compute the vertical scale at the start and end of the shutter and use the difference; never author a separate blur-amount curve. One clock drives the scale, the blur and the colour, so the word cannot be caught blurred while standing still or sharp while moving. The one honest exception is the turning point at the peak, where there is genuinely no velocity: add a second smear term proportional to how far the word is from rest, combined with the velocity term IN QUADRATURE so it can only ever add. Add it to the LINEAR term and not by widening the shutter, because a wider shutter samples further around the curve and near the peak that drags green further than blue, which inverts the fringing for a few frames. KEEP THE SHUTTER A FIXED DURATION, about 40ms, rather than tying it to the frame delta. A real camera shutter is a fraction of its frame, but this is a look, and tying it to the display quietly halves the smear on a 120Hz screen. DO NOT PUSH THE SAMPLE COUNT UNTIL IT IS SMOOTH. Around 28 samples a channel is right; the visible banding, where you can count the individual copies stepping down a descender, is part of the look and reads as deliberate. SWAP WORDS AT THE PEAK OF THE BLUR, never at rest, and get the swap for free: put both words in ONE texture as two stacked halves and let each sample choose its half by whether its own point in the shutter falls before or after the swap instant. The motion blur then dissolves one word into the next by construction, at the exact moment neither is readable, for one extra comparison and no extra fetches. A hard cut at any other moment pops, and a real crossfade doubles the fetch count for something nobody can see. BUT THE FREE DISSOLVE STOPS BEING FREE THE MOMENT YOU ADD THE HANG, and this is the one interaction between two good ideas in this piece that will bite you. The dissolve works because the word is MOVING through the swap, so the two words sit at different scales across the shutter and the accumulation blends them. A hang is a turning point, the scale sweep goes flat, and both words come out accumulated at the same size on the same pixels: not a dissolve, a double exposure, two legible words stacked on top of each other at the loudest moment in the loop. An automatic hold parked near the swap makes it worse again by holding that frame. So put the scale separation back BY HAND, at the swap and nowhere else. Push the outgoing word about a third larger and the incoming a third smaller, so the old word keeps growing past the peak and blows out of frame while the new one arrives from under it and the two are never the same size. Then add a brief surge of beam current over the top: not a dissolve and not a cut, just the display briefly unable to keep up, which is the same idea the rest of the glass is built on. Key BOTH to the same bump, and tie that bump to exactly the window the swap is inside the shutter, so it is precisely zero everywhere else. If the separation can fire on a frame with no swap in it, all the samples take one branch and the whole word scales, which pops. Keep the flash small, around half a stop: this is already the loudest frame in the loop, and a flash that reads as a flash is a transition, while one you only notice by removing it is an artefact. SIZE THE TEXTURE SO THE WORD IS ALWAYS MINIFIED HORIZONTALLY, even at the widest point, and remember the perspective below multiplies the widest point again. Vertical magnification at the peak is invisible because the peak is exactly where the vertical blur is worst, but horizontal is never blurred, so a magnified atlas softens the vertical stripes, and those stripes are the crispest thing on screen. Use a power-of-two texture with mipmaps for the same reason: at rest the word is minified several times over and unmipmapped sampling crawls on the glyph edges. PUT THE WORD ON A VERTICAL ORBIT AND USE A REAL PROJECTION. It is not a flat thing that scales, it is a quad on a circular path standing up in the YZ plane, seen through a pinhole. The path's NEAR point is the blast and its FAR point is the resting word, and that ordering is forced: at the peak the word is twelve times tall and running off the top and bottom, which is what something right against the lens looks like. So the loop is one continuous circuit. The word hangs in your face, climbs away over the top, comes down behind to the far point where it sits small and face-on and readable, then swings back under and up at you again. The path angle advances a full turn every cycle and NEVER reverses, which is what makes it a circuit rather than a bounce. Alternate the direction per word so consecutive words go over the top and under. KEEP THE PATH ON ONE AXIS. Vertical only, no lateral swing at all. Everything else this card does happens vertically, the stretch, the blur, the channel spread, and putting the path on the same axis makes the movement read as one gesture instead of two arguing with each other. TURN THE WORD AS IT TRAVELS, AND MAKE YAW THE DOMINANT ROTATION. That is not an aesthetic choice. Rotate a quad about its vertical axis and a vertical line on it projects to a vertical line on screen at a fixed x: yaw compresses the word horizontally and keystones it vertically, but it CANNOT tilt a stem. Rotate about the horizontal axis and vertical lines converge towards a vanishing point instead, which puts a lean on every stem, and a leaning stem smeared vertically is no longer the same stem. So pitch is the rotation that costs something here. Keep it small, around 15 degrees, and let yaw do the work at around 31. Use BOTH: two rotations in step are one rotation about a tilted axis, which is still a hinge, and only out of step does the word tumble. The keystone is the strongest depth cue in the piece, because it is the one thing a 2D transform of a picture cannot fake. LAG THE ROTATION BEHIND THE PATH. This is the part that makes it read as movement rather than as a pose, and it is the easiest thing to get wrong by doing the obvious. Line the turn up with the path and the word squares up exactly when it is biggest and closest, so the blast, the loudest frame in the loop, is the one frame where nothing is rotating. Give each rotation a phase lag instead and the word is caught mid-turn through the whole blast, still coming round, the way a body lags its own trajectory: about 72% of full yaw at the near point rather than zero. Use a DIFFERENT lag for each axis. Pin both to zero at the far point by subtracting their own value there, then normalise so the stated amplitude is still the real maximum. UN-PROJECT PER PIXEL, IN CLOSED FORM, ONCE PER PIXEL. For each fragment solve the projection backwards for the point ON THE QUAD it is looking at, then carry on downstream in the word's own flat space exactly as if there were no quad. The depth of a point on the quad is LINEAR in both of its coordinates, so multiplying each screen equation through by it leaves two linear equations in the two unknowns: a 2x2 solve, one reciprocal, no iteration. Do not try to chain them and get one coordinate out before the other. That works with a single rotation and it does not work with two, and trying leaves a cross term unaccounted for that shows up as the word shearing. The determinant sits near the focal length squared and cannot approach zero at any sane angle. Do this OUTSIDE the sample loop, and do NOT sweep the rotation across the shutter: a rotational motion blur would be nearly free here since the map is already per-sample, and it sweeps x, which turns every stem from a hard white bar into a smear. Fixed per frame is both cheaper and correct. At rest, with zero pitch and the word at exactly the focal distance, the whole un-projection must reduce to the identity. SPLIT THE GROWTH BETWEEN THE CURVE AND THE PERSPECTIVE. The divide contributes about 1.72x of its own at the near point, so the authored peaks are about 7.0 vertical and 1.57 horizontal, and the product still lands on the twelve and the 2.7 that the piece needs. Most of the growth is then something the geometry does rather than something a curve was told to do. HANG AT THE NEAR POINT, about 90ms, straddling the swap. A turning point has no velocity, and without a hang the word is caught big and SHARP at the exact instant it swaps, so you read both words straight through the blur. Given a hang it really is hanging there, and the smear really is what a camera does to something enormous and close that has stopped for a moment. Cut the cycle through the MIDDLE of the hang so a cycle boundary is still the swap instant. GIVE THE PATH ITS OWN EASING, DELIBERATELY NOT THE STRETCH'S. One pair of tables drives how big the word is, another drives where it is on the path. Lock position and size to a single curve and the eye reads a zoom no matter how good the perspective is; decoupling them is most of why the result reads as an object moving in space. Keep all of them as small sampled TABLES rather than analytic curves and resample them at a fractional index so the motion glides at the display rate instead of stepping. The stretch's fall drops to about a tenth of its range in the first 40% of its time and then crawls, which a fitted expo-out misses by a wide margin through the whole middle. The path's arrival is front-loaded, then decelerates hard, and then it must LAND AND HOLD. Do not let it creep the last few percent into place: the word looks still while it is still drifting, the eye will not settle on something that has not stopped, and it steals most of the readable beat. HOLD THE RESTING BEAT MUCH LONGER THAN FEELS NECESSARY. A word you have never seen, at 9% cap height, arriving out of a blur, needs longer than a word you are expecting. 200ms lands as a flicker of legibility rather than a beat you can rest on; about 380ms is where it stops feeling hurried. Rest should be comfortably the LONGEST phase in the cycle, which is right, because it is the only frame in the whole loop that carries the actual content. OFFSET EACH PIXEL'S POINT IN THE SHUTTER BY WHERE IT IS. Two terms, both constant per pixel and both zero on the centre lines. A rolling shutter reads the top of the frame earlier than the bottom, which breaks the perfect up-down symmetry the accumulation otherwise has and which was the most mechanical-looking thing about the blast. A lag measured ALONG THE WORD puts its right side later in the blast than its left, so the word tears apart along its own length instead of blowing up as one rigid block. Do not build that second one as per-letter rasters with their own transforms: that means an atlas rebuild, per-letter uniforms and a loop over letters, for a read one add gets nearly all of. It is also still one clock, because the lag shifts a sample WITHIN the shutter rather than starting a second timeline. THIN THE STROKES AT SPEED. Stretch real ink twelve times and it gets thinner; the accumulation alone only dims it, which comes out as a fat grey shape at the peak where it should be a bright thin skeleton. Apply it per tap as v * mix(1, v, thin), a mul-add rather than a pow, because this runs eighty-odd times per pixel and a pow there is real money. ADD A HALO OFF THE MIPS YOU ALREADY HAVE. Four taps at a coarse LOD bias over a much wider sweep, added on top, running through the same per-channel shutter ratio so green's halo reaches furthest and the violet core sits inside it. It deepens the colour story rather than sitting on top of it the way a neutral bloom pass would, and it costs four fetches at a level where they are nearly free. Gate it on distance from rest, because a resting word that glows is exactly the failure mode. GIVE THE BRIGHTNESS BACK CAREFULLY. Dividing by the sample weight is the honest model, but taken neat the blast lands around a fifth of white and the card reads grey. Multiply by a channel-NEUTRAL gain that rises with speed, so green stays dimmer than blue by exactly the amount its longer shutter earns and only the exposure moves. Then finish with a filmic rolloff, 1 - exp(-x * E), NORMALISED so a solid white texel still lands on exactly 1.0. That normalisation is what makes it safe at rest. What it changes is everything below white: the dense middle of a stroke is pushed up to saturate hot while the thin coloured tails, which sit far lower, are lifted much less, so the core goes whiter and the fringes go more saturated against it and the split reads as light rather than as tint. PUT IT BEHIND GLASS, BUT ONLY WHILE IT MOVES. The idea is that you are not watching the word, you are watching a monitor that is having trouble with it: at rest the display is perfect and invisible, and as the beam is asked to throw a hundred times the light in the same 40ms it starts to show what it is made of. Three parts, all scaled by distance from rest. An aperture grille, three phosphor stripes per triad 120 degrees apart in phase, in SCREEN space so the mask belongs to the glass and does not travel with the word, at about five device pixels per triad. Scanlines, horizontal, which is the one direction the piece otherwise never touches and exactly why they read as a grid over the image instead of as more smearing. And a hum bar, a soft band of extra beam current crawling slowly up the frame. Two rules make it work. MODULATE, NEVER ADD: the mask and the lines multiply what is already there, so no light is invented and the glass only decides where the existing light lands, which keeps it out of the way of the colour rule. And LET THE BEAM BLOOM: the scanline depth must fall away where the signal is hot, so the brightest part of the blast goes clean; without that the lines sit on the picture like a decal instead of belonging to it. SUBTLE IS THE ENTIRE BRIEF. Depths in the low tenths, and the mask should peak above 1.0 as well as below it so a white core clips back to white and only the mid-tones carry the stripes. A monitor filter that announces itself turns a piece about speed into a piece about nostalgia, and at that point it is wearing a costume. PUT A GROUND BEHIND THE WORD. A soft pool of neutral dark grey, following the word around the orbit, growing with it and brightening as it blasts. Flat black reads as an empty box rather than as a space the word is standing in, and additive white light with nothing behind it has nothing to be in front of. Keep it WEAK, peaking around 0.06 of full scale, and keep it NEUTRAL in all three channels, so the only thing on the card that carries a colour is still the word and still only while it moves. Composite it UNDER the type as a proper over, never added to it, or it lifts the type's own darks and flattens it. Put it in AFTER the rolloff, which is tuned for the word's dynamic range and would otherwise lift the ground well past what you set. Size it from the word's measured drawn width rather than the atlas width, with a floor so the resting word sits in a pool instead of on a dot and a ceiling on the vertical or the peak simply fades the frame to grey. LET THE WORD CATCH AND HANG AT THE PEAK, SOMETIMES ON ITS OWN AND ALWAYS WHEN POINTED AT. It parks there huge and turned and smeared with the colour all the way out, then falls back into the phrase. ONE mechanism, two triggers, taking the larger of the two, so pointing at the card during an automatic hold simply extends it rather than two systems racing each other. Build it as a RATE brake on the clock weighted by how close to the peak the word already is, which is the whole trick and the reason it needs no state machine and no second timeline. BOTH TRIGGERS MATTER AND THE AUTOMATIC ONE MATTERS MORE. Nobody hovers a card they have not already decided is interesting, so an interaction-only version is invisible to everyone who has not stopped, and the loop reads as a metronome: identical blasts forever, every one the same length. Give one word in four a hold of about 0.9s from a FIXED table, not a random draw, so the loop is identical every time round. That is what stops the phrase being a beat machine, and it also shows the held state to somebody scrolling past, which is how they find out it is something they can do themselves. Do NOT make it a pause button. Freezing whatever frame the pointer happens to arrive on will sooner or later freeze the readable one, and a card stopped on its resting frame is indistinguishable from a card that has crashed. Weight the brake by p to the FOURTH, not p squared: weighted too gently the clock starts braking while the word is still climbing and it asymptotes about four fifths of the way up, which reads as the animation bogging down rather than as the word being caught. Never let the floor reach zero, because a genuinely frozen frame reads as a crash while one creeping at a few percent reads as held. TWO THINGS ABOUT THE AUTOMATIC HOLD ARE EASY TO GET WRONG AND BOTH FAIL SILENTLY. Arm it ON THE WAY UP ONLY: a cycle opens in the back half of the previous blast's hang, so the progress value already reads 1 at the start of a cycle, and arming on that alone catches the word falling out of the last blast instead of climbing into this one. The brake is weighted by that same value, so armed there it evaporates within about 70ms as the word drops away and the hold never happens. And EASE THE BRAKE IN FAST AND OUT SLOW. A single couple-hundred-millisecond constant feels right for the pointer, where the hold is already fully on long before the word climbs, and it silently breaks the automatic one: the word passes its peak in about 100ms, so a brake taking two thirds of a second to reach full strength arrives after the word has fallen past, and a 900ms hold comes out as 240ms. Grabbing has to be quick enough to catch something moving that fast, about 50ms; letting go does not, and the slow release is what makes the word fall back into the phrase rather than get dropped. Arm well below the peak too, around 0.55, for runway. Use pointer events, so one pair of handlers covers hover on a desktop and press-and-hold on a touch screen, and do not preventDefault anywhere or holding the card eats the page's scroll. Run the monitor's hum bar off a SEPARATE clock that never stalls, or a held blast with a frozen hum bar looks like a dropped frame instead of like something being gripped. COUPLE THE CLOCK TO SCROLLING. The piece is about reading something too fast, and it should not ignore the reader. Let recent scrolling multiply the RATE the clock advances at, decaying back over a few hundred milliseconds, capped at a few times normal. Multiplying the rate rather than replacing the clock means a viewer who never scrolls still gets the whole loop, and there is no state reachable that the free-running loop could not also reach, so it adds no new failure modes and no scroll-linked jank. Accumulate the clock yourself rather than reading the animation frame timestamp, and clamp the per-frame delta, because a backgrounded tab hands you a delta big enough to skip whole words and the swap is the one thing that must not be jumped over. Lock the size by MEASURED cap height rather than by font size, so words never jump as they cycle, and set them all on one fixed baseline so the type does not bounce. Set in a plain neo-grotesque; the point is ordinary type behaving violently, and a characterful face fights it. Re-rasterise once the real face has loaded, because the glyph shapes are the entire content. Keep the phrase SHORT and the word count EVEN. A word lives in atlas half (index modulo 2), which only stays consistent across the loop point if the count is even. Short matters because the words are set to a fixed cap height, so a long word is a small word, and the resting frame is the only one anybody reads. Framework-free WebGL1: one full-screen triangle, one texture, one fragment shader, plus a rAF loop. White on a near black ground, because the accumulation is additive light and the effect simply does not exist on a light background. Mask the atlas lookup arithmetically rather than with a branch, since it runs per sample per channel and a real branch there is divergent and poisons the derivatives the mip selection needs. Take a single tap instead of the full loop when the shutter has collapsed, which is both cheaper and genuinely sharper than averaging the same value 28 times. Cap DPR, drop the sample count on coarse pointers, pause offscreen and when the tab is hidden, and under reduced motion draw one crisp still of the resting word, because a frozen mid-blast frame is an accident and the word at rest is the composition.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

## rush-type/params.ts

```ts
export const WORDS = ["gone", "before", "you", "look"];

export const FONT_VAR = "var(--font-neue-montreal)";

export const SY_PEAK = 7.0;

export const SX_PEAK = 1.57;

export const ARRIVE_S = 0.24;

export const REST_S = 0.38;

export const LEAVE_S = 0.14;

export const HANG_S = 0.09;
export const CYCLE_S = ARRIVE_S + REST_S + LEAVE_S + HANG_S;

export const SHUTTER_S = 0.04;

export const SMEAR_GAIN = 1.6;

export const SAMPLES = 28;

export const SHUTTER_K: [number, number, number] = [0.62, 1.0, 0.34];

export const REST_CAP_FRAC = 0.09;

export const DRIFT_DIR = [-1, 0.7, -0.45, 1];

export const FALL: number[] = [1.0, 0.557, 0.121, 0.049, 0.014, 0.0];

export const RISE: number[] = [0.0, 0.08, 0.8, 1.0];

export function sampleTable(table: number[], u: number): number {
  const n = table.length - 1;
  const x = Math.min(Math.max(u, 0), 1) * n;
  const i = Math.min(Math.floor(x), n - 1);
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

export const SHUTTER_SHAPE = 0.85;

export const ROLL_U = 0.38;

export const LAG_U = 0.55;

export const THIN = 0.55;

export const BLOOM_GAIN = 0.5;
export const BLOOM_SPREAD = 3.2;
export const BLOOM_BIAS = 3.5;

export const SPEED_GAIN = 0.95;

export const EXPOSURE = 1.75;

export const SCROLL_GAIN = 0.02;
export const SCROLL_MAX = 3.0;

export const SCROLL_DECAY = 4.0;

export const FOCAL = 1.0;

export const ORBIT_DEPTH = 0.42;

export const ORBIT_RISE = 0.16;

export const ORBIT_YAW = 0.55;
export const ORBIT_YAW_LAG = 0.6;

export const ORBIT_PITCH = 0.26;
export const ORBIT_PITCH_LAG = -0.9;

export function orbitTurn(psi: number, amp: number, lag: number): number {
  const pin = Math.sin(lag);
  return (amp * (Math.sin(psi - lag) - pin)) / (1 + Math.abs(pin));
}

export const ORBIT_HANG_ARC = 0.9;

export const PIVOT_FRAC = 0.07;

export const ORBIT_IN: number[] = [0.0, 0.5, 0.82, 0.95, 1.0, 1.0];

export const ORBIT_OUT: number[] = [0.0, 0.05, 0.14, 0.38, 1.0];

export const CRT_GAIN = 1.0;

export const CRT_PITCH = 5.0;
export const CRT_MASK = 0.16;

export const CRT_SCAN_PITCH = 3.0;
export const CRT_SCAN = 0.12;

export const CRT_BEAM = 0.7;

export const CRT_HUM = 0.035;
export const CRT_HUM_SPEED = 0.14;

export const GLOW_BASE = 0.03;
export const GLOW_SPEED = 0.028;

export const GLOW_SPREAD = 2.6;
export const GLOW_MIN = 0.34;
export const GLOW_MAX_Y = 1.2;

export const HOLD_STRENGTH = 0.96;

export const AUTO_HOLD = [0, 0, 0, 0.9];

export const AUTO_HOLD_AT = 0.55;

export const HOLD_EASE_IN = 0.05;
export const HOLD_EASE_OUT = 0.2;

export const SWAP_SPREAD = 0.35;

export const SWAP_FLASH = 0.5;
```

## rush-type/engine.ts

```ts
import {
  ARRIVE_S,
  BLOOM_BIAS,
  BLOOM_GAIN,
  AUTO_HOLD,
  AUTO_HOLD_AT,
  BLOOM_SPREAD,
  CRT_BEAM,
  CRT_GAIN,
  CRT_HUM,
  CRT_HUM_SPEED,
  CRT_MASK,
  CRT_PITCH,
  CRT_SCAN,
  CRT_SCAN_PITCH,
  CYCLE_S,
  DRIFT_DIR,
  EXPOSURE,
  FALL,
  FOCAL,
  FONT_VAR,
  GLOW_BASE,
  GLOW_MAX_Y,
  GLOW_MIN,
  GLOW_SPEED,
  GLOW_SPREAD,
  HANG_S,
  HOLD_EASE_IN,
  HOLD_EASE_OUT,
  HOLD_STRENGTH,
  LAG_U,
  LEAVE_S,
  ORBIT_DEPTH,
  ORBIT_HANG_ARC,
  ORBIT_IN,
  ORBIT_OUT,
  ORBIT_PITCH,
  ORBIT_PITCH_LAG,
  ORBIT_RISE,
  ORBIT_YAW,
  ORBIT_YAW_LAG,
  PIVOT_FRAC,
  REST_CAP_FRAC,
  REST_S,
  RISE,
  ROLL_U,
  SAMPLES,
  SCROLL_DECAY,
  SCROLL_GAIN,
  SCROLL_MAX,
  SHUTTER_K,
  SHUTTER_S,
  SHUTTER_SHAPE,
  SMEAR_GAIN,
  SPEED_GAIN,
  SWAP_FLASH,
  SWAP_SPREAD,
  SX_PEAK,
  SY_PEAK,
  THIN,
  WORDS,
  orbitTurn,
  sampleTable,
} from "./params";

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = (samples: number, bloomSpread: number, bloomBias: number) => `
precision highp float;
varying vec2 vUv;

uniform sampler2D uText;
uniform vec2  uRes;
uniform vec2  uHalfPx;
uniform float uSx;
uniform vec3  uSyQ;

uniform float uCenterY;
uniform float uSwapU;
uniform float uHalfA;
uniform float uHalfB;
uniform vec3  uK;
uniform vec2  uSwapScl;
uniform float uShape;
uniform float uRoll;
uniform float uLag;
uniform float uThin;
uniform float uBloom;
uniform float uGain;
uniform float uExp;
uniform float uFocal;
uniform vec3  uPos;
uniform vec4  uRot;
uniform float uCrt;
uniform float uTime;
uniform vec4  uGlow;
uniform float uGlowAmp;

#define SAMPLES ${samples}
#define BLOOM_TAPS 4
#define BLOOM_SPREAD ${bloomSpread.toFixed(3)}
#define BLOOM_BIAS ${bloomBias.toFixed(3)}
#define TAU 6.2831853
#define CRT_PITCH ${CRT_PITCH.toFixed(3)}
#define CRT_MASK ${CRT_MASK.toFixed(4)}
#define CRT_SCAN_PITCH ${CRT_SCAN_PITCH.toFixed(3)}
#define CRT_SCAN ${CRT_SCAN.toFixed(4)}
#define CRT_BEAM ${CRT_BEAM.toFixed(4)}
#define CRT_HUM ${CRT_HUM.toFixed(4)}
#define CRT_HUM_SPEED ${CRT_HUM_SPEED.toFixed(4)}

vec2 atlasUv(float sy, float halfIdx, vec2 W, out float inside) {
  float sx = max(uSx, 1e-4);
  float sv = max(abs(sy), 1e-4);
  vec2 q = vec2(
    (W.x / sx + uHalfPx.x * 0.5) / uHalfPx.x,
    (W.y / sv + uHalfPx.y * 0.5) / uHalfPx.y
  );

  inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  return vec2(clamp(q.x, 0.0, 1.0), (clamp(q.y, 0.0, 1.0) + halfIdx) * 0.5);
}

float tap(float sy, float halfIdx, vec2 W, float front) {
  float inside;
  vec2 t = atlasUv(sy, halfIdx, W, inside);
  inside *= front;
  float v = texture2D(uText, t).r * inside;

  return v * mix(1.0, v, uThin);
}

float tapBlur(float sy, float halfIdx, vec2 W, float front) {
  float inside;
  vec2 t = atlasUv(sy, halfIdx, W, inside);
  inside *= front;
  return texture2D(uText, t, BLOOM_BIAS).r * inside;
}

void main() {
  vec2 P = vUv * uRes;
  vec2 C = vec2(uRes.x * 0.5, uRes.y * uCenterY);
  vec2 sp = P - C;

  float sy = uRot.x, cy = uRot.y, sps = uRot.z, cps = uRot.w;
  float a1 = -(sp.x * sy + uFocal * cy);
  float b1 = sps * (sp.x * cy - uFocal * sy);
  float c1 = uFocal * uPos.x - sp.x * uPos.z;
  float a2 = -sp.y * sy;
  float b2 = sp.y * sps * cy - uFocal * cps;
  float c2 = uFocal * uPos.y - sp.y * uPos.z;
  float det = a1 * b2 - a2 * b1;
  float inv = 1.0 / (abs(det) < 1e-4 ? 1e-4 : det);
  float a = (c1 * b2 - c2 * b1) * inv;
  float b = (a1 * c2 - a2 * c1) * inv;
  float Zc = uPos.z - a * sy + b * sps * cy;
  vec2 W = vec2(a, b);

  float front = step(uFocal * 0.05, Zc);

  vec3 acc = vec3(0.0);

  if (abs(uSyQ.y) + abs(uSyQ.z) < 1e-5) {
    acc = vec3(tap(uSyQ.x, uHalfA, W, front));
  } else {

    float off = uLag * (W.x / uRes.x) - uRoll * (sp.y / uRes.y);

    float wsum = 0.0;
    for (int i = 0; i < SAMPLES; i++) {
      float u = float(i) / float(SAMPLES - 1) - 0.5;

      float w = 1.0 - uShape * abs(u) * 2.0;
      wsum += w;

      float us = u + off;

      vec3 uk = us * uK;
      vec3 sy = uSyQ.x + uSyQ.y * uk + uSyQ.z * uk * uk;
      acc.r += w * tap(
        sy.r * (uk.r < uSwapU ? uSwapScl.x : uSwapScl.y),
        uk.r < uSwapU ? uHalfA : uHalfB, W, front);
      acc.g += w * tap(
        sy.g * (uk.g < uSwapU ? uSwapScl.x : uSwapScl.y),
        uk.g < uSwapU ? uHalfA : uHalfB, W, front);
      acc.b += w * tap(
        sy.b * (uk.b < uSwapU ? uSwapScl.x : uSwapScl.y),
        uk.b < uSwapU ? uHalfA : uHalfB, W, front);
    }

    acc /= max(wsum, 1e-4);

    vec3 halo = vec3(0.0);
    for (int j = 0; j < BLOOM_TAPS; j++) {
      float u = (float(j) / float(BLOOM_TAPS - 1) - 0.5) * BLOOM_SPREAD + off;
      vec3 uk = u * uK;
      vec3 sy = uSyQ.x + uSyQ.y * uk + uSyQ.z * uk * uk;
      halo.r += tapBlur(
        sy.r * (uk.r < uSwapU ? uSwapScl.x : uSwapScl.y),
        uk.r < uSwapU ? uHalfA : uHalfB, W, front);
      halo.g += tapBlur(
        sy.g * (uk.g < uSwapU ? uSwapScl.x : uSwapScl.y),
        uk.g < uSwapU ? uHalfA : uHalfB, W, front);
      halo.b += tapBlur(
        sy.b * (uk.b < uSwapU ? uSwapScl.x : uSwapScl.y),
        uk.b < uSwapU ? uHalfA : uHalfB, W, front);
    }
    acc += halo * (uBloom / float(BLOOM_TAPS));

    acc *= uGain;
  }

  acc = (1.0 - exp(-acc * uExp)) / (1.0 - exp(-uExp));

  vec2 gd = (P - uGlow.xy) / max(uGlow.zw, vec2(1.0));
  float ground = uGlowAmp * (1.0 - smoothstep(0.0, 1.0, length(gd)));
  acc += ground * (1.0 - acc);

  if (uCrt > 0.0) {
    float lum = max(max(acc.r, acc.g), acc.b);

    vec3 m = 0.5 + 0.5 * cos(TAU * (P.x / CRT_PITCH - vec3(0.0, 0.33333, 0.66667)));
    vec3 mask = mix(vec3(1.0), m * 2.0, CRT_MASK * uCrt);

    float s = 0.5 + 0.5 * cos(TAU * P.y / CRT_SCAN_PITCH);
    float scan = 1.0 - CRT_SCAN * uCrt * (1.0 - CRT_BEAM * lum) * (1.0 - s);

    float bar = 0.5 + 0.5 * cos(TAU * (P.y / uRes.y - uTime * CRT_HUM_SPEED));
    float hum = 1.0 + CRT_HUM * uCrt * (bar * 2.0 - 1.0);

    acc *= mask * scan * hum;
  }

  gl_FragColor = vec4(acc, 1.0);
}
`;

const SEQ = WORDS.length % 2 ? [...WORDS, ...WORDS] : WORDS;

interface Frame {
  p: number;
  psi: number;
  idx: number;

  rising: boolean;
}

const HANG_H = HANG_S * 0.5;
const ARRIVE_END = HANG_H + ARRIVE_S;
const REST_END = ARRIVE_END + REST_S;
const LEAVE_END = REST_END + LEAVE_S;

const SWING_ARC = Math.PI - ORBIT_HANG_ARC;

function frameAt(tSec: number): Frame {
  const total = CYCLE_S * SEQ.length;
  let t = tSec % total;
  if (t < 0) t += total;
  const idx = Math.floor(t / CYCLE_S);
  const tau = t - idx * CYCLE_S;

  let p: number;
  let psi: number;
  let rising = false;
  if (tau < HANG_H) {

    p = 1;
    psi = ORBIT_HANG_ARC * (tau / HANG_H);
  } else if (tau < ARRIVE_END) {
    const u = (tau - HANG_H) / ARRIVE_S;
    p = sampleTable(FALL, u);
    psi = ORBIT_HANG_ARC + SWING_ARC * sampleTable(ORBIT_IN, u);
  } else if (tau < REST_END) {
    p = 0;
    psi = Math.PI;
  } else if (tau < LEAVE_END) {
    const u = (tau - REST_END) / LEAVE_S;
    p = sampleTable(RISE, u);
    psi = Math.PI + SWING_ARC * sampleTable(ORBIT_OUT, u);
    rising = true;
  } else {

    p = 1;
    psi = 2 * Math.PI - ORBIT_HANG_ARC * (1 - (tau - LEAVE_END) / HANG_H);
    rising = true;
  }
  return { p, psi, idx, rising };
}

function resolveFamily(cssVar: string): string {
  if (typeof document === "undefined") return "sans-serif";
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;font-family:${cssVar}`;
  probe.textContent = "Ag";
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily;
  document.body.removeChild(probe);
  return fam || "sans-serif";
}

export class RushType {
  ok = false;

  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private quad: WebGLBuffer | null = null;
  private tex: WebGLTexture | null = null;
  private uni: Record<string, WebGLUniformLocation | null> = {};

  private aw = 1024;
  private hh = 256;
  private texCap = 164;
  private scratch: HTMLCanvasElement | null = null;

  private halfWord: [string | null, string | null] = [null, null];

  private wordHalfW = 1;

  private rasteredFor = Number.NaN;

  private family = "sans-serif";
  private raf = 0;
  private running = false;
  private last = 0;

  private readonly startOffset = ARRIVE_END + REST_S * 0.5;

  private clock = this.startOffset;

  private vel = 0;
  private lastY = 0;

  private held = false;
  private hold = 0;

  private autoUntil = 0;
  private autoCycle = -1;

  private wall = 0;

  constructor(host: HTMLElement) {
    this.host = host;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(this.canvas);
    this.family = resolveFamily(FONT_VAR);
    this.init();
  }

  private init() {
    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    }) as WebGLRenderingContext | null;
    if (!gl) return;
    this.gl = gl;

    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;
    const prog = this.link(VERT, FRAG(coarse ? 18 : SAMPLES, BLOOM_SPREAD, BLOOM_BIAS));
    if (!prog) return;
    this.prog = prog;

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    for (const n of [
      "uText", "uRes", "uHalfPx", "uSx", "uSyQ",
      "uCenterY", "uSwapU", "uHalfA", "uHalfB", "uK",
      "uShape", "uRoll", "uLag", "uThin", "uBloom", "uGain", "uExp", "uSwapScl",
      "uFocal", "uPos", "uRot", "uCrt", "uTime", "uGlow", "uGlowAmp",
    ]) {
      this.uni[n] = gl.getUniformLocation(prog, n);
    }

    gl.clearColor(0, 0, 0, 1);
    this.resize();
    this.ok = true;
  }

  private link(vs: string, fs: string): WebGLProgram | null {
    const gl = this.gl!;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    };
    const v = compile(gl.VERTEX_SHADER, vs);
    const f = compile(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      gl.deleteProgram(p);
      return null;
    }
    return p;
  }

  private allocAtlas() {
    const gl = this.gl!;

    const needed = this.canvas.width * (SX_PEAK / (1 - ORBIT_DEPTH)) * 1.3;
    const aw = needed > 1000 ? 2048 : 1024;
    const hh = aw / 4;
    const changed = aw !== this.aw || !this.tex;
    this.aw = aw;
    this.hh = hh;

    this.texCap = Math.round(hh * 0.64);

    if (changed) {
      if (this.tex) gl.deleteTexture(this.tex);
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, aw, hh * 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.scratch = document.createElement("canvas");
      this.scratch.width = aw;
      this.scratch.height = hh;
      this.halfWord = [null, null];
      this.rasteredFor = Number.NaN;
    }
  }

  private rasterWord(word: string, half: 0 | 1) {
    const gl = this.gl;
    const c = this.scratch;
    if (!gl || !c || !this.tex) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);

    const text = (word || "").trim();
    if (text) {

      let size = this.texCap * 1.4;
      ctx.font = `400 ${size}px ${this.family}`;
      const capOf = () => {
        const m = ctx.measureText("H");
        return m.actualBoundingBoxAscent || size * 0.72;
      };
      size *= this.texCap / capOf();
      ctx.font = `400 ${size}px ${this.family}`;

      const maxW = c.width * 0.92;
      const w = ctx.measureText(text).width;
      if (w > maxW) {
        size *= maxW / w;
        ctx.font = `400 ${size}px ${this.family}`;
      }
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      ctx.fillText(text, c.width / 2, c.height / 2 + this.texCap / 2);
      this.wordHalfW = ctx.measureText(text).width * 0.5;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, half * this.hh, gl.RGBA, gl.UNSIGNED_BYTE, c,
    );
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.halfWord[half] = word;
  }

  private resize() {
    const gl = this.gl;
    if (!gl) return;
    const r = this.host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (w === this.canvas.width && h === this.canvas.height && this.tex) return;
    this.canvas.width = w;
    this.canvas.height = h;
    gl.viewport(0, 0, w, h);
    this.allocAtlas();

    this.rasterWord(SEQ[0], 0);
    this.rasterWord(SEQ[1 % SEQ.length], 1);
    this.rasteredFor = 0;
  }

  onResize() {
    this.resize();
    if (!this.running) this.draw(this.clock);
  }

  refreshFont() {
    this.family = resolveFamily(FONT_VAR);
    const a = this.halfWord[0];
    const b = this.halfWord[1];
    if (a) this.rasterWord(a, 0);
    if (b) this.rasterWord(b, 1);
    if (!this.running) this.draw(this.clock);
  }

  private draw(tSec: number) {
    const gl = this.gl;
    const prog = this.prog;
    if (!gl || !prog || !this.tex) return;

    const half = SHUTTER_S * 0.5;
    const here = frameAt(tSec);
    const before = frameAt(tSec - half);
    const after = frameAt(tSec + half);

    const total = CYCLE_S * SEQ.length;
    let tw = tSec % total;
    if (tw < 0) tw += total;
    const k = Math.floor(tw / CYCLE_S);
    if (this.rasteredFor !== k && tw - k * CYCLE_S >= ARRIVE_END) {
      const nextIdx = (k + 1) % SEQ.length;
      this.rasterWord(SEQ[nextIdx], (nextIdx % 2) as 0 | 1);
      this.rasteredFor = k;
    }

    const k0 = Math.floor((tSec - half) / CYCLE_S);
    const k1 = Math.floor((tSec + half) / CYCLE_S);
    const swapU = k1 > k0 ? (k1 * CYCLE_S - tSec) / SHUTTER_S : 2;

    const swapSep = Math.max(0, 1 - (2 * (tSec - Math.round(tSec / CYCLE_S) * CYCLE_S)) ** 2 / SHUTTER_S ** 2);

    const restCap = this.canvas.height * REST_CAP_FRAC;
    const unit = restCap / this.texCap;
    const syOf = (f: Frame) => unit * (1 + f.p * (SY_PEAK - 1));

    const syB = syOf(before);
    const syC = syOf(here);
    const syA = syOf(after);
    const qa = syC;
    const qc = 2 * (syA + syB - 2 * syC);

    const qbT = syA - syB;
    const extra = SMEAR_GAIN * here.p * syC;
    const mag = Math.sqrt(qbT * qbT + extra * extra);
    const qb = qbT < 0 ? -mag : mag;
    const sx = unit * (1 + here.p * (SX_PEAK - 1));

    const pivot = PIVOT_FRAC * here.p;

    const cw = DRIFT_DIR[here.idx % DRIFT_DIR.length] ?? 1;
    const psi = here.psi * Math.sign(cw || 1);
    const amp = Math.abs(cw);
    const f = this.canvas.height * FOCAL;

    const z = f * (1 - ORBIT_DEPTH * (1 + Math.cos(psi)) * 0.5);

    const x = 0;
    const y = f * ORBIT_RISE * amp * Math.sin(psi);

    const yaw = orbitTurn(psi, ORBIT_YAW, ORBIT_YAW_LAG);
    const pitch = orbitTurn(psi, ORBIT_PITCH, ORBIT_PITCH_LAG);

    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);

    gl.uniform1i(this.uni.uText, 0);
    gl.uniform2f(this.uni.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.uni.uHalfPx, this.aw, this.hh);
    gl.uniform1f(this.uni.uSx, sx);
    gl.uniform3f(this.uni.uSyQ, qa, qb, qc);
    gl.uniform1f(this.uni.uCenterY, 0.5 + pivot);
    gl.uniform1f(this.uni.uSwapU, swapU);
    gl.uniform1f(this.uni.uHalfA, before.idx % 2);
    gl.uniform1f(this.uni.uHalfB, after.idx % 2);
    gl.uniform3f(this.uni.uK, SHUTTER_K[0], SHUTTER_K[1], SHUTTER_K[2]);
    gl.uniform1f(this.uni.uShape, SHUTTER_SHAPE);
    gl.uniform1f(this.uni.uRoll, ROLL_U);
    gl.uniform1f(this.uni.uLag, LAG_U);

    gl.uniform1f(this.uni.uThin, THIN * here.p);
    gl.uniform1f(this.uni.uBloom, BLOOM_GAIN * here.p);

    gl.uniform1f(
      this.uni.uGain,
      (1 + SPEED_GAIN * here.p) * (1 + SWAP_FLASH * swapSep),
    );
    gl.uniform2f(
      this.uni.uSwapScl,
      1 + SWAP_SPREAD * swapSep,
      1 - SWAP_SPREAD * swapSep,
    );
    gl.uniform1f(this.uni.uExp, EXPOSURE);
    gl.uniform1f(this.uni.uFocal, f);
    gl.uniform3f(this.uni.uPos, x, y, z);
    gl.uniform4f(
      this.uni.uRot,
      Math.sin(yaw), Math.cos(yaw),
      Math.sin(pitch), Math.cos(pitch),
    );
    gl.uniform1f(this.uni.uCrt, CRT_GAIN * here.p);

    const gx = this.canvas.width * 0.5 + (f * x) / z;
    const gy = this.canvas.height * (0.5 + pivot) + (f * y) / z;
    const persp = f / z;
    const wordW = this.wordHalfW * sx * persp;
    const wordH = this.texCap * syC * persp;
    gl.uniform4f(
      this.uni.uGlow,
      gx,
      gy,
      Math.max(wordW * GLOW_SPREAD, this.canvas.width * GLOW_MIN),
      Math.min(
        Math.max(wordH * GLOW_SPREAD, this.canvas.height * GLOW_MIN),
        this.canvas.height * GLOW_MAX_Y,
      ),
    );
    gl.uniform1f(this.uni.uGlowAmp, GLOW_BASE + GLOW_SPEED * here.p);

    gl.uniform1f(this.uni.uTime, this.wall % (1 / CRT_HUM_SPEED));

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private onScroll = () => {
    const y = window.scrollY;
    this.vel = Math.min(this.vel + Math.abs(y - this.lastY), SCROLL_MAX / SCROLL_GAIN);
    this.lastY = y;
  };

  private tick = (now: number) => {
    if (!this.running) return;

    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 0;
    this.last = now;
    this.wall += dt;
    this.vel *= Math.exp(-SCROLL_DECAY * dt);

    const fr = frameAt(this.clock);
    const auto = AUTO_HOLD[fr.idx % AUTO_HOLD.length] ?? 0;
    const cycle = Math.floor(this.clock / CYCLE_S);
    if (auto > 0 && fr.rising && fr.p > AUTO_HOLD_AT && this.autoCycle !== cycle) {
      this.autoCycle = cycle;
      this.autoUntil = this.wall + auto;
    }

    const want = Math.max(this.held ? 1 : 0, this.wall < this.autoUntil ? 1 : 0);
    const ease = want > this.hold ? HOLD_EASE_IN : HOLD_EASE_OUT;
    const k = dt > 0 ? 1 - Math.exp(-dt / ease) : 0;
    this.hold += (want - this.hold) * k;

    const pp = fr.p * fr.p;
    const brake = 1 - this.hold * HOLD_STRENGTH * pp * pp;
    this.clock += dt * (1 + Math.min(SCROLL_GAIN * this.vel, SCROLL_MAX)) * brake;
    this.draw(this.clock);
    this.raf = requestAnimationFrame(this.tick);
  };

  start() {
    if (this.running || !this.ok) return;
    this.running = true;
    this.last = 0;
    this.lastY = window.scrollY;
    this.vel = 0;
    window.addEventListener("scroll", this.onScroll, { passive: true });
    this.raf = requestAnimationFrame(this.tick);
  }

  setHeld(v: boolean) {
    this.held = v;
  }

  stop() {
    if (this.running) window.removeEventListener("scroll", this.onScroll);
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  renderStill() {
    this.draw(this.clock);
  }

  destroy() {
    this.stop();
    const gl = this.gl;
    if (gl) {
      if (this.prog) gl.deleteProgram(this.prog);
      if (this.quad) gl.deleteBuffer(this.quad);
      if (this.tex) gl.deleteTexture(this.tex);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.gl = null;
    this.prog = null;
    this.quad = null;
    this.tex = null;
    this.scratch = null;
    this.canvas.remove();
  }
}
```

## rush-type/RushTypeCard.tsx

```tsx
"use client";

import { useEffect, useRef } from "react";
import { RushType } from "./engine";
import { FONT_VAR, WORDS } from "./params";
import { onTransitionChange } from "../../lib/view-transition";

export function RushTypeCard({
  bare = false,
  viewTransitionName,
}: {
  bare?: boolean;
  viewTransitionName?: string;
} = {}) {
  void bare;
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let engine: RushType | null = null;
    let onScreen = false;
    let hidden = false;
    let inTransition = false;

    const sync = () => {
      if (!engine || reduced) return;
      if (onScreen && !hidden && !inTransition) engine.start();
      else engine.stop();
    };

    const raf = requestAnimationFrame(() => {
      if (!hostRef.current) return;
      engine = new RushType(host);
      if (!engine.ok) return;

      engine.renderStill();
      if (!reduced) sync();

      if (document.fonts?.load) {
        const probe = document.createElement("span");
        probe.style.cssText = `position:absolute;visibility:hidden;font-family:${FONT_VAR}`;
        probe.textContent = "Ag";
        document.body.appendChild(probe);
        const fam = getComputedStyle(probe)
          .fontFamily.split(",")[0]
          .replace(/["']/g, "")
          .trim();
        document.body.removeChild(probe);
        document.fonts.load(`400 1em "${fam}"`).then(
          () => engine?.refreshFont(),
          () => {},
        );
      }
    });

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es[0]?.isIntersecting ?? false;
        sync();
      },
      { threshold: 0.2 },
    );
    io.observe(host);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);

    const grab = () => engine?.setHeld(true);
    const release = () => engine?.setHeld(false);
    host.addEventListener("pointerenter", grab);
    host.addEventListener("pointerdown", grab);
    host.addEventListener("pointerleave", release);
    host.addEventListener("pointerup", release);
    host.addEventListener("pointercancel", release);
    const offTransition = onTransitionChange((active) => {
      inTransition = active;
      sync();
    });

    let rt = 0;
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => engine?.onResize(), 120);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      host.removeEventListener("pointerenter", grab);
      host.removeEventListener("pointerdown", grab);
      host.removeEventListener("pointerleave", release);
      host.removeEventListener("pointerup", release);
      host.removeEventListener("pointercancel", release);
      document.removeEventListener("visibilitychange", onVis);
      offTransition();
      window.removeEventListener("resize", onResize);
      window.clearTimeout(rt);
      engine?.destroy();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      data-canvas-card
      role="img"
      aria-label={`The words ${WORDS.join(", ")} one at a time on a dark field. Each word holds still and sharp for a beat, then swings up and toward you, turning, until it stretches off the top and bottom of the frame and tears into vertical streaks of green and violet light, and the next word falls back out of the blur. Pointing at it holds the word at its largest.`}
      style={viewTransitionName ? { viewTransitionName } : undefined}
      className="relative mx-auto aspect-[1344/820] w-full cursor-pointer select-none overflow-hidden rounded-[12px] border border-[var(--border-line)] bg-black"
    />
  );
}
```
