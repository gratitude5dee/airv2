"""Assemble what the film plays: the vstar track, the foley bus, and the sidechain between them.

`sfx.py` writes the foley bus; this script is the mix. Keeping it as a script rather than a
one-off shell pipeline means the balance is a thing you can read, diff and re-derive — the
6 dB first-half trim in sfx.py lands here and nowhere else.

The whole chain stays at the source rate. Resampling the music to match a 48 kHz bus once
produced a 24 dB measurement error that sent an entire pass chasing the wrong problem.
"""
import numpy as np, soundfile as sf, subprocess, sys, os
from math import gcd
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SFX_WAV = sys.argv[1] if len(sys.argv) > 1 else '/tmp/sfx.wav'

music, sr = sf.read(os.path.join(ROOT, 'assets/bgm-music-only.mp3'), always_2d=True)
sfx,  ssr = sf.read(SFX_WAV, always_2d=True)
# sfx.py synthesises at 48 kHz; the mix lives at the music's rate, so the bus comes down
# through a polyphase filter here rather than being read at the wrong rate downstream. An
# earlier pass compared a 48 kHz mix against a 44.1 kHz source under one variable and read
# the balance 24 dB wrong; the conversion belongs in exactly one place, and this is it.
if ssr != sr:
    d = gcd(sr, ssr)
    sfx = resample_poly(sfx, sr // d, ssr // d, axis=0)

n = max(len(music), len(sfx))
def fit(a):
    if a.shape[1] == 1: a = np.repeat(a, 2, axis=1)
    return np.pad(a, ((0, max(0, n - len(a))), (0, 0)))[:n]
music, sfx = fit(music), fit(sfx)

# Sidechain: the track steps back where the foley speaks, never more than 2 dB. At 4 dB the
# duck was audible as pumping on the dense shots; half of it is enough to open a seat for a
# cue without the listener hearing the track move.
DUCK_DB = 2.0
atk, rel = int(0.008 * sr), int(0.140 * sr)
# one-pole release so the track comes back gradually rather than stepping
e, out = 0.0, np.empty(n, dtype=np.float32)
raw = np.convolve(np.abs(sfx).max(axis=1), np.ones(atk) / atk, mode='same')
ra = np.exp(-1.0 / rel)
for i in range(n):
    x = raw[i]
    e = x if x > e else e * ra + x * (1 - ra)
    out[i] = e
env = out / max(1e-6, float(out.max()))
duck = 1.0 - (1.0 - 10 ** (-DUCK_DB / 20.0)) * env

MUSIC_G, SFX_G, CEIL = 0.86, 0.95, 0.94
buf = music * duck[:, None] * MUSIC_G + sfx * SFX_G

# Tame only what exceeds the ceiling, smoothed so it does not pump.
over = np.abs(buf).max(axis=1)
g = np.ones(n)
m = over > CEIL
g[m] = CEIL / over[m]
k = int(0.010 * sr)
g = np.minimum(g, np.convolve(g, np.ones(k) / k, mode='same'))
buf = buf * g[:, None]

tmp = '/tmp/bgm-mix.wav'
sf.write(tmp, buf, sr)
subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', tmp,
                '-c:a', 'libmp3lame', '-b:a', '256k',
                os.path.join(ROOT, 'assets/bgm-mix.mp3')], check=True)
print('mix written · %d Hz · peak %.3f · duck to %.2f · sfx %.2f' %
      (sr, float(np.abs(buf).max()), float(duck.min()), SFX_G))
