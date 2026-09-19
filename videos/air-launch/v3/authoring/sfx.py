"""Procedural UI foley for the air launch film.

Everything here is synthesised — no samples, no library. Each cue is a small
physical idea: a send is air moving away from you, a receive is a struck bell,
an approval is a switch closing, the drop is a body hitting a floor.
"""
import numpy as np, soundfile as sf, json, math

SR = 48000
DUR = 119.699
N = int(DUR * SR) + SR
buf = np.zeros((N, 2), dtype=np.float64)
rng = np.random.default_rng(11)   # fixed seed: the mix is reproducible

def env(n, a=0.004, d=0.10, s=0.0, r=0.10, curve=2.2):
    """attack / decay / sustain / release, in seconds."""
    at, dt, rt = int(a*SR), int(d*SR), int(r*SR)
    st = max(0, n - at - dt - rt)
    e = np.concatenate([
        np.linspace(0, 1, at, endpoint=False) ** 0.6,
        s + (1 - s) * (1 - np.linspace(0, 1, dt, endpoint=False)) ** curve,
        np.full(st, s),
        s * (1 - np.linspace(0, 1, rt)) ** curve if s > 0 else np.zeros(rt)])
    return np.pad(e, (0, max(0, n - len(e))))[:n]

def noise(n): return rng.normal(0, 1, n)

def onepole_lp(x, cut):
    a = math.exp(-2*math.pi*cut/SR); y = np.empty_like(x); z = 0.0
    for i in range(len(x)):
        z = (1-a)*x[i] + a*z; y[i] = z
    return y

def sweep_lp(x, c0, c1):
    """time-varying one-pole: the whole point of a whoosh."""
    cuts = np.geomspace(max(40,c0), max(40,c1), len(x))
    y = np.empty_like(x); z = 0.0
    for i in range(len(x)):
        a = math.exp(-2*math.pi*cuts[i]/SR)
        z = (1-a)*x[i] + a*z; y[i] = z
    return y

def hp(x, cut):
    return x - onepole_lp(x, cut)

def sine(n, f0, f1=None, phase=0.0):
    t = np.arange(n)/SR
    f = np.full(n, f0) if f1 is None else np.geomspace(f0, f1, n)
    return np.sin(2*np.pi*np.cumsum(f)/SR + phase)

def place(sig, t, gain=1.0, pan=0.0):
    i = int(t*SR)
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), N-i)
    if n <= 0: return
    l = gain*(1-max(0.0,pan))*0.5 + gain*0.5*(1-abs(pan))
    r = gain*(1+min(0.0,pan)*-1)*0.0 + gain*0.5*(1+abs(pan)) if pan>0 else gain*0.5*(1+abs(pan))
    gl = gain*math.sqrt(0.5*(1-pan)); gr = gain*math.sqrt(0.5*(1+pan))
    buf[i:i+n,0] += sig[:n]*gl
    buf[i:i+n,1] += sig[:n]*gr

# ------------------------------------------------------------------ the cues
def s_send(dur=0.20):
    n=int(dur*SR)
    air = sweep_lp(noise(n), 700, 5200) * env(n, .004, .12, 0, .08, 2.6)
    chirp = sine(n, 620, 1500) * env(n, .003, .09, 0, .06, 3.0) * .5
    return (air*.55 + chirp*.32)

def s_recv(dur=0.46):
    n=int(dur*SR)
    e = env(n, .002, .34, 0, .12, 2.6)
    b = (sine(n, 1174.7)*.6 + sine(n, 1760.0)*.33 + sine(n, 2637.0)*.12) * e
    click = hp(noise(int(.01*SR)), 2500) * env(int(.01*SR), .0005, .008, 0, .002)
    out = b*.42
    out[:len(click)] += click*.22
    return out

def s_tap(dur=0.07):
    n=int(dur*SR)
    c = hp(noise(n), 1400) * env(n, .0006, .022, 0, .03, 3.4)
    body = sine(n, 240, 150) * env(n, .001, .03, 0, .02, 3.0) * .5
    return (c*.5 + body*.35)

def s_land(dur=0.30, f=96):
    n=int(dur*SR)
    thud = sine(n, f, f*0.72) * env(n, .003, .16, 0, .12, 2.4)
    tick = hp(noise(int(.014*SR)), 1800) * env(int(.014*SR), .0005, .01, 0, .003)
    out = thud*.42
    out[:len(tick)] += tick*.10
    return out

def s_confirm(dur=0.72):
    n=int(dur*SR); out=np.zeros(n)
    for k,(f,t0,g) in enumerate([(880,0.0,.5),(1174.7,.075,.45),(1760.0,.15,.38)]):
        i=int(t0*SR); m=n-i
        out[i:] += sine(m,f)*env(m,.002,.30,0,.22,2.4)*g
    return out*.34

def s_impact(dur=1.3):
    n=int(dur*SR)
    sub = sine(n, 58, 34) * env(n, .002, .42, 0, .55, 1.8)
    body = sweep_lp(noise(n), 900, 90) * env(n, .001, .22, 0, .5, 2.2)
    crack = hp(noise(int(.05*SR)), 2600) * env(int(.05*SR), .0004, .03, 0, .02)
    out = sub*.62 + body*.30
    out[:len(crack)] += crack*.24
    return out

def s_whoosh(dur=0.52, up=True):
    n=int(dur*SR)
    a,b = (400, 4200) if up else (4200, 400)
    w = sweep_lp(hp(noise(n), 200), a, b) * env(n, .10, .18, .18, .22, 1.6)
    return w*.40

def s_riser(dur=1.15):
    n=int(dur*SR)
    r = sweep_lp(hp(noise(n), 300), 320, 7000) * (np.linspace(0,1,n)**2.1)
    tone = sine(n, 220, 880) * (np.linspace(0,1,n)**3) * .28
    return (r*.34 + tone*.22)

def s_shimmer(dur=1.7):
    n=int(dur*SR); out=np.zeros(n)
    for f,g,off in [(1760,.34,0),(2349,.26,.05),(2637,.22,.11),(3520,.16,.18),(4699,.10,.26)]:
        i=int(off*SR); m=n-i
        out[i:] += sine(m,f)*env(m,.006,.9,0,.7,1.8)*g
    return out*.20

def s_tick(dur=0.05):
    n=int(dur*SR)
    return hp(noise(n), 3000)*env(n,.0004,.016,0,.012,3.2)*.30

def s_grain(dur=0.80):
    """the render: granular, machine-like, not musical."""
    n=int(dur*SR); out=np.zeros(n)
    for k in range(34):
        i=int(rng.uniform(0, dur-0.03)*SR); m=int(.022*SR)
        g = sine(m, rng.uniform(900, 4200))*env(m,.001,.016,0,.004,3.0)
        out[i:i+m] += g*rng.uniform(.25,1.0)
    return out*.16

def s_swell(dur=1.6, f=196):
    n=int(dur*SR)
    return (sine(n,f)*.5+sine(n,f*1.5)*.22)*env(n,.5,.4,.25,.6,1.4)*.13

# ------------------------------------------------------------------ the score
CUES = [
  # shot 01 — the dot, the name, the four banners, the surge
  (0.550, s_tap(), 'tap', 0.0),
  (2.180, s_riser(1.05), 'riser', 0.0),
  (2.415, s_shimmer(2.2), 'send', 0.0),
  (2.415, s_impact(1.0), 'whoosh', 0.0),
  (7.105, s_whoosh(.46), 'whoosh', -0.1),
  (8.173, s_recv(), 'recv', 0.22),
  (8.661, s_recv(), 'recv', 0.16),
  (9.149, s_recv(), 'recv', 0.10),
  (9.636, s_recv(), 'recv', 0.04),
  (10.100, s_whoosh(.40), 'whoosh', 0.0),
  # shot 02 — the thread
  (10.519, s_send(), 'send', 0.18),
  (13.189, s_recv(), 'recv', -0.14),
  (14.721, s_land(.30,104), 'land', -0.12),
  (16.277, s_land(.30,92), 'land', -0.12),
  (17.786, s_land(.34,84), 'land', -0.10),
  (21.223, s_tap(), 'tap', 0.0),
  (21.320, s_confirm(), 'confirm', 0.0),
  (22.430, s_tick(), 'tick', -0.1),
  (24.020, s_whoosh(.36), 'whoosh', 0.0),
  # shot 03 — the drop
  (24.358, s_impact(1.5), 'impact', 0.0),
  (24.358, s_shimmer(2.0), 'shimmer', 0.0),
  (25.496, s_land(.34,120), 'land', 0.0),
  (27.074, s_land(.32,112), 'land', 0.0),
  (28.630, s_land(.32,104), 'land', 0.0),
  (30.209, s_land(.32,96), 'land', 0.0),
  (31.742, s_land(.36,88), 'land', 0.0),
  # shot 04 / 05
  (33.344, s_tick(), 'tick', 0.0),
  (34.900, s_tick(), 'tick', 0.15),
  (36.479, s_tick(), 'tick', -0.15),
  (38.058, s_tick(), 'tick', 0.10),
  (39.590, s_whoosh(.46), 'whoosh', 0.0),
  (44.257, s_confirm(.62), 'confirm', 0.0),
  (45.510, s_whoosh(.34,False), 'whoosh', 0.0),
  # shot 06 — /home and the family shot
  (45.813, s_send(), 'send', 0.18),
  (47.345, s_land(.30,100), 'land', -0.10),
  (48.901, s_whoosh(.50), 'whoosh', 0.0),
  (48.901, s_shimmer(1.4), 'shimmer', 0.0),
  # shot 07 — /shop
  (52.059, s_send(), 'send', 0.18),
  (53.615, s_land(.32,96), 'land', -0.16),
  (55.147, s_tap(), 'tap', 0.0),
  (55.519, s_confirm(), 'confirm', -0.12),
  (56.703, s_recv(), 'recv', 0.12),
  # shot 08 — /trade
  (58.259, s_send(), 'send', 0.18),
  (59.791, s_land(.34,88), 'land', 0.0),
  (61.068, s_tap(), 'tap', 0.0),
  (61.301, s_impact(.95), 'impact', 0.0),
  (61.301, s_confirm(), 'confirm', 0.0),
  # shot 09 — /zap
  (64.412, s_send(), 'send', 0.18),
  (65.991, s_recv(), 'recv', -0.14),
  (66.757, s_grain(.82), 'grain', 0.0),
  (67.524, s_grain(.40), 'grain', 0.0),
  (67.712, s_shimmer(1.8), 'shimmer', 0.0),
  (67.712, s_whoosh(.44), 'whoosh', 0.0),
  # shot 10 — /create, the plan
  (72.214, s_send(), 'send', 0.18),
  (73.770, s_recv(), 'recv', -0.14),
  (74.165, s_recv(), 'recv', -0.10),
  (75.349, s_recv(), 'recv', -0.14),
  (76.185, s_send(), 'send', 0.18),
  (76.974, s_land(.36,92), 'land', -0.06),
  # shot 11 — the build and the ship
  (78.530, s_send(), 'send', 0.18),
  (79.853, s_tick(), 'tick', -0.2),
  (80.445, s_tick(), 'tick', 0.2),
  (81.037, s_tick(), 'tick', -0.2),
  (81.629, s_tick(), 'tick', 0.2),
  (82.221, s_tick(), 'tick', -0.2),
  (82.477, s_confirm(.58), 'confirm', 0.0),
  (83.244, s_whoosh(.48), 'whoosh', 0.0),
  (83.244, s_shimmer(1.5), 'shimmer', 0.0),
  (86.378, s_send(), 'send', 0.18),
  (86.936, s_land(.34,86), 'land', 0.0),
  (87.957, s_tap(), 'tap', 0.0),
  (87.957, s_impact(1.2), 'impact', 0.0),
  (88.050, s_confirm(.90), 'confirm', 0.0),
  # shot 12 — the breath
  (89.536, s_swell(1.8,147), 'swell', 0.0),
  (91.092, s_swell(1.6,196), 'swell', -0.15),
  (92.671, s_swell(1.6,220), 'swell', 0.15),
  (94.273, s_swell(1.8,262), 'swell', 0.0),
  # shot 13 — the montage
  (95.829, s_tick(), 'tick', 0.0),
  (96.618, s_tick(), 'tick', 0.18),
  (97.408, s_tick(), 'tick', -0.18),
  (98.220, s_tick(), 'tick', 0.14),
  (98.987, s_tick(), 'tick', -0.14),
  (99.799, s_tick(), 'tick', 0.0),
  (100.589, s_whoosh(.72), 'whoosh', 0.0),
  # shot 14 — the close
  (102.168, s_whoosh(.40,False), 'whoosh', 0.0),
  (103.770, s_land(.30,120), 'land', 0.0),
  (103.770, s_tick(), 'tick', 0.0),
  (104.606, s_whoosh(.30,False), 'whoosh', 0.0),
  (105.535, s_impact(1.4), 'impact', 0.0),
  (106.812, s_land(.34,80), 'land', -0.2),
  (107.950, s_land(.34,90), 'land', 0.2),
  (108.669, s_shimmer(2.6), 'shimmer', 0.0),
  (108.669, s_impact(1.6), 'whoosh', 0.0),
  (111.293, s_tick(), 'tick', 0.0),
]
# ---- mix to picture -------------------------------------------------------------
# A fixed gain is wrong: the same tap is lost under the chorus and deafening in the
# gap at 7s. Each cue declares how far below the music it should sit, and the script
# solves its gain against the music's own level at that moment.
import soundfile as _sf
_mus, _msr = _sf.read('assets/bgm-music-only.mp3')
if _mus.ndim > 1: _mus = _mus.mean(axis=1)
WIN = 0.45
def music_rms(t, w=WIN):
    i = int(max(0, t-0.05)*_msr); j = int(min(len(_mus)/_msr, t+w)*_msr)
    seg = _mus[i:j]
    return float(np.sqrt((seg**2).mean())) if len(seg) else 0.12

# how far below the music each role sits, in dB
# Tucked behind the song: every role sits 6 dB further down than the first mix, so the
# foley reads as texture under the track rather than as a second track beside it.
ROLE_DB = {'tick':-17.0,'tap':-15.0,'send':-14.0,'recv':-13.0,'land':-15.0,'confirm':-12.0,
           'whoosh':-13.0,'impact':-4.0,'shimmer':-10.0,'riser':-11.0,'grain':-14.0,'swell':-15.0}

def cue_rms(sig):
    w = int(WIN*SR)
    seg = np.pad(sig, (0, max(0, w-len(sig))))[:w]
    return float(np.sqrt((seg**2).mean())) or 1e-6

# The first half runs another 6 dB down. The opening is sparse — a night sky, one phone,
# one word — so foley that reads as texture under the chorus reads as clatter under it.
# The trim lifts across /shop so the second half is untouched and the change is never a
# step you can hear.
FH_FULL, FH_CLEAR, FH_DB = 52.059, 62.0, -6.0
def half_trim(t):
    if t <= FH_FULL: return FH_DB
    if t >= FH_CLEAR: return 0.0
    u = (t - FH_FULL) / (FH_CLEAR - FH_FULL)
    return FH_DB * (1.0 - u*u*(3.0 - 2.0*u))

for t, sig, role, pan in CUES:
    target = ROLE_DB.get(role, -10.0) + half_trim(t)
    m = max(0.035, music_rms(t))
    want = m * (10 ** (target/20.0))
    g = want / max(1e-6, cue_rms(sig))
    g = float(np.clip(g, 0.05, 26.0))
    place(sig, t, g, pan)

# the freeze is a hole in the mix, not a sound: duck everything hard across it
i0, i1 = int(104.606*SR), int(105.500*SR)
duck = np.ones(N)
duck[i0:i1] = 0.06
ramp = int(0.02*SR)
duck[i0-ramp:i0] = np.linspace(1, .06, ramp)
duck[i1:i1+ramp] = np.linspace(.06, 1, ramp)
buf *= duck[:,None]

# Never normalise the whole bus: one loud impact would drag every solved gain down with it.
# Tame only what exceeds the ceiling, and smooth the gain so it does not pump.
ceil = 0.86
over = np.abs(buf).max(axis=1)
g = np.ones(len(buf))
m = over > ceil
g[m] = ceil / over[m]
k = int(0.010*SR)
g = np.minimum(g, np.convolve(g, np.ones(k)/k, mode='same'))
peak = over.max()
buf = buf * g[:, None]
sf.write('/tmp/claude-0/-home-user-airv2/a7eafabd-9637-56fe-8f72-5ef513e55d13/scratchpad/sfx.wav', buf, SR)
print('sfx written, peak was %.3f, cues %d' % (peak, len(CUES)))
