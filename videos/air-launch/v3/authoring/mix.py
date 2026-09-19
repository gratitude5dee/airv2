"""Assemble what the film plays: the vstar track, the foley bus, and the sidechain between them.

`sfx.py` writes the foley bus; this script is the mix. Keeping it as a script rather than a
one-off shell pipeline means the balance is a thing you can read, diff and re-derive.

The whole chain stays at the source rate. Resampling the music to match a 48 kHz bus once
produced a 24 dB measurement error that sent an entire pass chasing the wrong problem.

The limiter here is TRUE-PEAK aware, not sample-peak aware, and its ceiling is chosen by
measuring the delivered MP3 itself rather than trusting the pre-encode WAV. A sample-peak
limiter at -0.5 dBFS still shipped audible clipping: MP3's synthesis filter bank overshoots
a hard-limited signal between samples, and the decoded file measured +1 to +2 dBFS peak —
real digital clipping — even though the WAV that went into the encoder never exceeded 0.94.
"""
import numpy as np, soundfile as sf, subprocess, sys, os
from math import gcd
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SFX_WAV = sys.argv[1] if len(sys.argv) > 1 else '/tmp/sfx.wav'
OUT_MP3 = os.path.join(ROOT, 'assets/bgm-mix.mp3')

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

MUSIC_G, SFX_G = 0.86, 0.95
buf = music * duck[:, None] * MUSIC_G + sfx * SFX_G


def true_peak(x, factor=4):
    """Intersample peak: what a D/A converter (or a lossy codec's synthesis filter) can
    actually produce between two encoded samples, which a plain np.abs(x).max() misses."""
    up = resample_poly(x, factor, 1, axis=0)
    return float(np.abs(up).max())


def limit(x, ceil_db):
    """A true-peak-aware limiter. Downsampling a gain envelope computed at the oversampled
    rate back down to the original rate let peaks slip back through — the dip in the gain
    curve got smoothed away by the same interpolation that made it visible in the first
    place. The fix: apply the gain at the oversampled rate, to the oversampled signal, and
    only then come back down, so what ships is a signal already verified peak-safe at 4x."""
    ceil = 10 ** (ceil_db / 20.0)
    factor = 4
    up = resample_poly(x, factor, 1, axis=0)
    over_up = np.abs(up).max(axis=1)
    g_up = np.ones(len(up))
    m = over_up > ceil
    g_up[m] = ceil / over_up[m]
    k_up = int(0.010 * sr * factor)
    g_up = np.minimum(g_up, np.convolve(g_up, np.ones(k_up) / k_up, mode='same'))
    limited_up = up * g_up[:, None]
    out = resample_poly(limited_up, 1, factor, axis=0)[:len(x)]
    # the downsample filter can ring a hair past the ceiling at a hard edge; a final
    # sample-domain clamp with no further smoothing catches that last fraction of a dB
    return np.clip(out, -ceil, ceil)


# The pre-encode ceiling has to leave enough true-peak headroom that MP3 encoding cannot
# push the decoded file back over 0 dBFS. -0.5 dBTP pre-encode measured +1.0 dBFS after
# encoding last time; each step down here is verified against the actual decoded file
# below, not assumed.
CEIL_DB = -3.0
buf = limit(buf, CEIL_DB)

tmp = '/tmp/bgm-mix.wav'
sf.write(tmp, buf, sr)
subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', tmp,
                '-c:a', 'libmp3lame', '-b:a', '256k', OUT_MP3], check=True)

# Verify against the file that actually ships, not the intermediate WAV.
decoded, dsr = sf.read(OUT_MP3, always_2d=True)
post_peak_db = 20 * np.log10(max(1e-9, float(np.abs(decoded).max())))
pre_tp_db = 20 * np.log10(max(1e-9, true_peak(buf)))
print('mix written · %d Hz · pre-encode true peak %.2f dBTP · ceiling %.1f dB'
      % (sr, pre_tp_db, CEIL_DB))
print('decoded mp3 peak: %.2f dBFS%s' %
      (post_peak_db, '  *** STILL CLIPPING ***' if post_peak_db > -0.2 else '  (clean)'))
