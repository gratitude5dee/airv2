import json, bisect
A = json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'audiomap.json')))
beats = A['grid']['beats_sec']; downs = A['grid']['downbeats_sec']
events = A['events']; ev_t = [e['t'] for e in events]
phr = [p['start'] for p in A['phrases']] + [A['audio']['duration_sec']]
DUR = A['audio']['duration_sec']

def nearest(arr, t):
    i = bisect.bisect_left(arr, t)
    c = [arr[j] for j in (i-1, i) if 0 <= j < len(arr)]
    return min(c, key=lambda x: abs(x-t)) if c else None

def snap(t, tol=0.06, mode='grid'):
    """grid: prefer downbeat, then beat, then any onset within tol. onset: nearest onset within 30ms. exact: keep t."""
    if mode == 'exact': return round(t,3), 'exact'
    if mode == 'onset':
        e = nearest(ev_t, t)
        if e is not None and abs(e-t) <= 0.03:
            ev = events[ev_t.index(e)]
            return round(e,3), f"onset:{ev['drum']}"
        return round(t,3), 'free'
    d = nearest(downs, t)
    if d is not None and abs(d-t) <= tol: return round(d,3), 'downbeat'
    b = nearest(beats, t)
    if b is not None and abs(b-t) <= tol: return round(b,3), 'beat'
    e = nearest(ev_t, t)
    if e is not None and abs(e-t) <= tol:
        ev = events[ev_t.index(e)]
        return round(e,3), f"onset:{ev['drum']}"
    return round(t,3), 'free'

def ev_at(t, tol=0.03):
    e = nearest(ev_t, t)
    if e is not None and abs(e-t) <= tol:
        ev = events[ev_t.index(e)]
        return {'drum': ev['drum'], 'energy': ev['energy'], 'grid': ev['grid']}
    return None

SHOTS = [
 dict(id='shot-01-cold-open', title='Cold open · the name resolves out of pixels', start=0.0, end=10.170, track=1,
      mechanism='Black, one delivered dot, then "air" resolving from an arcade-pixel canvas with a chromatic bloom; the chrome mark rises under it; four notification banners on the four accented hits; collapse to one bubble on the SURGE.',
      anchors=[('night_black', 0.0), ('dot_up', 0.55), ('name_pixel_in', 2.415), ('sky_step_1', 3.947),
               ('sky_step_2', 5.433), ('lockup_forms', 7.105), ('banner_1', 8.173, 'onset'), ('banner_2', 8.661, 'onset'),
               ('banner_3', 9.149, 'onset'), ('banner_4', 9.636, 'onset'), ('mark_exit', 9.66, 'exact'),
               ('collapse_to_bubble', 10.170)]),
 dict(id='shot-02-imessage-thread', title='The thread · text it like a friend', start=10.170, end=24.358, track=2,
      mechanism='Opens tight on the phone, opens out for the giant stanza on the third downbeat, goes macro for the Approve tap, and slams to camera on the crash.',
      anchors=[('bubble_morphs_to_phone', 10.170), ('sent_bubble', 10.542, 'onset'), ('typing_dots_start', 11.587),
               ('recv_on_it', 13.189), ('camera_opens', 13.189), ('inbox_card', 14.721), ('held_8pm_fri', 16.277),
               ('decision_card', 17.786), ('word_FRIEND', 19.319), ('camera_macro', 20.770),
               ('approve_flip_published', 21.246, 'onset'), ('memory_chip', 22.430), ('slam_start', 24.108, 'exact'),
               ('phone_slam_crash', 24.358, 'exact')]),
 dict(id='shot-03-drop', title='The drop · the name at full frame, then five nouns', start=24.358, end=33.344, track=3,
      mechanism='The crash whites the frame, the sun crests, and "air" arrives at 452px with its colour pulled apart. The snare re-opens the split; the kick snaps the name to the corner and starts the endowments, whose sublines type themselves in on the Arlan wave.',
      anchors=[('crash', 24.358, 'exact'), ('chromatic_open', 24.358, 'exact'), ('bass_slam_snare', 25.310, 'onset'),
               ('bass_slam_kick', 25.496, 'onset'), ('noun_phone', 25.496, 'onset'), ('noun_email', 27.074),
               ('noun_wallet', 28.630), ('noun_key_vault', 30.209), ('noun_computer', 31.742), ('out', 33.344)]),
 dict(id='shot-04-hyperpersonal', title='Hyperpersonal · it already knows you', start=33.344, end=39.590, track=4,
      mechanism='Onairos persona at centre with a taste orbit advancing one slot per downbeat; depth read off sin(angle).',
      anchors=[('persona_in', 33.344), ('orbit_slot_1', 34.900), ('orbit_slot_2', 36.479), ('orbit_slot_3', 38.058),
               ('handoff_flash', 39.590)]),
 dict(id='shot-05-connect-apps', title='Connect · 1000+ apps', start=39.590, end=45.813, track=5,
      mechanism='Three concentric rings of real connectors bloom out of a point; the count lands on the downbeat; everything collapses into the silhouette of the phone shot 06 opens on.',
      anchors=[('ring_in', 39.590), ('counter_start', 39.962), ('ring_slot_2', 41.146), ('ring_slot_3', 42.701),
               ('counter_lands_1000', 44.257), ('phone_silhouette', 45.51, 'exact'), ('snap_to_phone', 45.813)]),
 dict(id='shot-06-home', title='/home · the family shot', start=45.813, end=52.059, track=6,
      mechanism='The launcher card lands, the clay icons pop one per hihat hit, then the grid leaves the phone and takes the whole frame at ten times the size.',
      anchors=[('cmd_home', 45.813), ('icon_grid_roll_start', 47.090, 'onset'), ('home_card', 47.345),
               ('icon_grid_roll_end', 48.669, 'onset'), ('grid_takeover', 48.901), ('home_settle', 50.480)]),
 dict(id='shot-07-shop', title='/shop · the product frame', start=52.059, end=58.259, track=7,
      mechanism='The staged listing lifts out of the thread as a real product frame with a glossy Approve; the tap makes it public and the first order lands on the loudest kick of the bar.',
      anchors=[('cmd_shop', 52.059), ('shop_listing', 53.615), ('shop_needs_you_approve', 55.147),
               ('shop_live', 55.519), ('shop_first_order', 56.703)]),
 dict(id='shot-08-trade', title='/trade · the decision, at size', start=58.259, end=64.412, track=8,
      mechanism='Opens tight. The preview becomes a macro plate the size of the frame, the Approve is a physical object, and the fill is the loudest frame of the act: flash, shake, and a number that fills the screen.',
      anchors=[('cmd_trade', 58.259), ('trade_ticket', 59.791), ('macro_plate', 59.993),
               ('trade_approve_tap', 61.068, 'onset'), ('trade_fill', 61.301), ('trade_settle', 62.880)]),
 dict(id='shot-09-zap', title='/zap · the render', start=64.412, end=70.682, track=9,
      mechanism='The generation takes the frame as four brightness bands stamped with symbols, filling one column band per hihat hit of the accel roll, then resolving into the clip it was asked for through a fog mask.',
      anchors=[('cmd_zap', 64.412), ('zap_reply', 65.991), ('symbols_takeover', 66.757),
               ('zap_progress_roll_end', 67.524), ('zap_resolve', 67.712), ('caption_make_your_own', 69.103)]),
 dict(id='shot-10-create-plan', title='/create · the plan', start=70.682, end=78.530, track=10,
      mechanism='The prompt types itself, at most three questions, and the plan arrives as a file the film actually opens and reads.',
      anchors=[('prompt_typing_start', 70.682), ('prompt_send', 72.214), ('q1', 73.770), ('q1_detail', 74.162),
               ('q2', 75.349), ('owner_answers', 76.138), ('plan_md_attachment', 76.974), ('yes', 78.530)]),
 dict(id='shot-11-create-ship', title='/create · the build and the ship', start=78.530, end=89.536, track=11,
      mechanism='The build card takes the frame with a live console; the app it built plays full-bleed with its countdown on the beat; the publish decision is a physical object and Approve is the biggest hit of the act.',
      anchors=[('progress_start', 78.530), ('log_line_1', 79.830), ('progress_end', 82.477),
               ('dev_build_live', 83.244), ('app_full_bleed', 83.244), ('ship_it', 86.378),
               ('decision_card', 86.936, 'onset'), ('approve', 87.957), ('live_listing', 89.536)]),
 dict(id='shot-12-yours', title='Yours · calm, guardian, private', start=89.536, end=95.829, track=12,
      mechanism='The DROP at 90 is a breath. The approved stanza lands one clause per downbeat over the widening sky, with the backend stated once.',
      anchors=[('drop_breath', 89.536), ('word_1', 91.092), ('word_2', 92.671), ('word_3', 94.273),
               ('kicker_guardian_angel', 95.039, 'exact'), ('out', 95.829)]),
 dict(id='shot-13-montage', title='Finale montage · six cuts and a turn', start=95.829, end=102.168, track=13,
      mechanism='The film\'s fastest passage: a cut every half bar, each one a re-pose rather than a transition, then a full turntable on the DROP that resolves into the end card.',
      anchors=[('cut_1_thread', 95.829), ('cut_2_tight', 96.619), ('cut_3_miniapps', 97.408),
               ('cut_4_tight', 98.198), ('cut_5_create', 98.987), ('cut_6_tight', 99.777),
               ('fill', 99.869, 'onset'), ('cut_turntable', 100.589), ('spin_into_endcard', 102.168)]),
 dict(id='shot-14-end-card', title='End card · the CTA, the freeze, the lockup', start=102.168, end=DUR, track=14,
      mechanism='The ask, then the address as a pressable object whose letters puff up one at a time. Total freeze on the hard stop. The release kick lifts the chrome mark and the partner wall, and the lockup lands on the brightest sky.',
      anchors=[('cta_line', 102.168), ('cta_pill', 103.770), ('url_line', 104.468), ('freeze', 104.606, 'onset'),
               ('release', 105.535, 'onset'), ('kick_rise_1', 106.812, 'onset'), ('kick_rise_2', 107.926, 'onset'),
               ('lockup', 108.669), ('last_tile', 111.293, 'onset'), ('still', 113.755, 'onset'),
               ('silence', 115.0), ('black', DUR)]),
]
out_shots = []
seams = set()
for s in SHOTS:
    anchors = []
    for a in s['anchors']:
        name, t = a[0], a[1]; mode = a[2] if len(a) > 2 else 'grid'
        st, src = snap(t, mode=mode)
        anchors.append({'name': name, 'target': round(t,3), 't': st, 'snap': src, 'event': ev_at(st), 'rel': round(st - s['start'], 3)})
    dbs = [round(d,3) for d in downs if s['start'] - 0.01 <= d < s['end'] - 0.01]
    rolls = [r for r in A['rolls'] if s['start'] <= r['start'] < s['end']]
    stops = [h for h in A['hard_stops'] if s['start'] <= h['t'] < s['end']]
    kms = [k for k in A['key_moments'] if s['start'] <= k['t'] < s['end']]
    phases = [p for p in A['energy_phases'] if p['end'] > s['start'] and p['start'] < s['end']]
    lv = {}
    for p in phases: lv[p['level']] = lv.get(p['level'],0) + (min(p['end'],s['end']) - max(p['start'],s['start']))
    out_shots.append({
        'id': s['id'], 'title': s['title'], 'track': s['track'],
        'start': round(s['start'],3), 'end': round(s['end'],3), 'duration': round(s['end']-s['start'],3),
        'bars': round((s['end']-s['start'])/1.5789, 2),
        'mechanism': s['mechanism'],
        'energy_mix_sec': {k: round(v,2) for k,v in sorted(lv.items(), key=lambda kv:-kv[1])},
        'downbeats': dbs, 'rolls': rolls, 'hard_stops': stops, 'key_moments': kms, 'anchors': anchors,
    })
    seams.update([round(s['start'],3), round(s['end'],3)])

seams.update([24.358, 48.901, 61.301, 66.757, 83.244, 87.957, 100.589, 104.606, 105.535, 108.669, 115.0, 119.6])
cut = {
  'version': 3.1, 'project': 'air-launch', 'track': 'assets/bgm.mp3 (vstar)', 'duration_sec': DUR, 'fps': 30,
  'tempo': {'bpm': 152.0, 'beat_sec': 0.3947, 'bar_sec': 1.5789, 'downbeat_phase': 0},
  'phrases': [round(p,3) for p in phr],
  'snapshot_seams': sorted(seams),
  'parallax_stack': {'sky': -1.0, 'giant_type': 0.0, 'phone': 1.0, 'captions': 1.5, 'grade': 0.0,
                     'note': 'Percent of stage width the layer translates against the camera vector per shot; camera vector is the shot exit vector (-230px leftward) unless the shot says otherwise.'},
  'shots': out_shots,
}
json.dump(cut, open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'cutsheet.json'),'w'), indent=2)

# summary table for the plan
print(f"{'shot':26} {'start':>8} {'end':>8} {'dur':>6} {'bars':>5}  energy")
for s in out_shots:
    print(f"{s['id']:26} {s['start']:8.3f} {s['end']:8.3f} {s['duration']:6.2f} {s['bars']:5.1f}  {s['energy_mix_sec']}")
print()
for s in out_shots:
    print('##', s['id'])
    for a in s['anchors']:
        e = a['event']; es = f"{e['drum']} e={e['energy']:.2f}" if e else '-'
        flag = '' if abs(a['t']-a['target'])<0.001 else f" (target {a['target']})"
        print(f"  {a['t']:8.3f}  +{a['rel']:6.3f}  {a['name']:26} {a['snap']:14} {es}{flag}")
    print('  downbeats:', s['downbeats'])
    if s['rolls']: print('  rolls:', [(r['start'], r['end'], r['kind'], r['drum'], r['leads_to']) for r in s['rolls']])
    if s['hard_stops']: print('  hard_stops:', s['hard_stops'])
    if s['key_moments']: print('  key_moments:', s['key_moments'])
print('seams:', cut['snapshot_seams'])
