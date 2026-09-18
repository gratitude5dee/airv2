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
 dict(id='shot-01-cold-open', title='Cold open · night sky, WZRD mark, four notifications', start=0.0, end=10.170, track=1,
      mechanism='Sky brightens one stop per kick; four iMessage banners stack on the four-kick burst; collapse into one bubble on the SURGE.',
      anchors=[('night_black', 0.0), ('wzrd_mark_up', 2.415), ('sky_step_1', 3.947), ('sky_step_2', 5.433), ('sky_step_3', 7.105), ('mark_exit', 9.66, 'exact'),
               ('banner_1', 8.173, 'onset'), ('banner_2', 8.661, 'onset'), ('banner_3', 9.149, 'onset'), ('banner_4', 9.636, 'onset'), ('collapse_to_bubble', 10.170)]),
 dict(id='shot-02-imessage-thread', title='The thread · text it like a friend', start=10.170, end=24.358, track=2,
      mechanism='chat-thread on a CSS iPhone; giant parallax words TEXT IT / LIKE A / FRIEND. behind the phone; every bubble lands on a snare/downbeat; phone slams on the crash.',
      anchors=[('bubble_morphs_to_phone', 10.170), ('sent_bubble', 10.542, 'onset'), ('typing_dots_start', 11.587), ('recv_on_it', 13.189), ('word_TEXT_IT', 13.189),
               ('inbox_card', 14.721), ('held_8pm_fri', 16.277), ('word_LIKE_A', 16.277), ('decision_card', 17.786), ('decision_card_settle', 18.158),
               ('word_FRIEND', 19.319), ('approve_flip_published', 21.246, 'onset'), ('memory_chip', 22.430), ('slam_start', 24.108, 'exact'), ('phone_slam_crash', 24.358, 'exact')]),
 dict(id='shot-03-endowments', title='The drop · one word "air", then five nouns', start=24.358, end=33.344, track=3,
      mechanism='Fade-motion single word on the bass slam, then five endowment nouns land on downbeats; each noun carries one glyph + one leftward -230px exit.',
      anchors=[('crash', 24.358, 'exact'), ('bass_slam_snare', 25.310, 'onset'), ('bass_slam_kick', 25.496, 'onset'), ('noun_phone', 25.496, 'onset'), ('noun_email', 27.074),
               ('noun_wallet', 28.630), ('noun_key_vault', 30.209), ('noun_computer', 31.742), ('out', 33.344)]),
 dict(id='shot-04-hyperpersonal', title='Hyperpersonal · it already knows you', start=33.344, end=39.590, track=4,
      mechanism='Onairos persona chip at centre, carousel-orbit of taste tiles rotating one slot per downbeat; hihat peak at 39.753 is the hand-off flash.',
      anchors=[('persona_in', 33.344), ('orbit_slot_1', 34.9), ('orbit_slot_2', 36.46), ('orbit_slot_3', 38.02), ('handoff_flash', 39.59)]),
 dict(id='shot-05-connect-apps', title='Connect · 1000+ apps', start=39.590, end=45.813, track=5,
      mechanism='carousel-vision ring of partner logos; count-up 0→1000+ from the first downbeat; ring snaps to the /home phone on the phrase end.',
      anchors=[('ring_in', 39.590), ('counter_start', 39.962), ('ring_slot_2', 41.13), ('ring_slot_3', 42.69), ('counter_lands_1000', 44.25), ('snap_to_phone', 45.813)]),
 dict(id='shot-06-mini-apps', title='Mini-apps · /home /shop /trade /zap', start=45.813, end=70.682, track=6,
      mechanism='One persistent iPhone. Each slash command is typed with notes-typing cadence and sent on a downbeat; each card is a modal-morph out of the sent bubble; phone never cuts.',
      anchors=[('cmd_home', 45.813), ('home_card', 47.345), ('icon_grid_roll_start', 47.09), ('icon_grid_roll_end', 48.669), ('home_settle', 50.480),
               ('cmd_shop', 52.059), ('shop_listing', 53.615), ('shop_needs_you_approve', 55.147), ('shop_live', 55.519), ('shop_first_order', 56.703),
               ('cmd_trade', 58.259), ('trade_ticket', 59.791), ('trade_approve_tap', 61.068, 'onset'), ('trade_fill', 61.301), ('trade_settle', 62.880),
               ('cmd_zap', 64.412), ('zap_send', 65.991), ('zap_progress_roll_start', 66.757), ('zap_progress_roll_end', 67.524), ('zap_result', 67.524), ('zap_settle', 69.103), ('caption_make_your_own', 69.103)]),
 dict(id='shot-07-create', title='/create · build your own in the thread', start=70.682, end=89.536, track=7,
      mechanism='Longest single take. notes-typing prompt, ≤3 questions, plan.md attachment, "yes", stepper progress, dev URL, phone flips to reveal the running app, "ship it", decision card, Approve, live listing.',
      anchors=[('prompt_typing_start', 70.682), ('prompt_send', 72.214), ('q1', 73.770), ('q1_detail', 74.162), ('q2', 75.349), ('owner_answers', 76.138), ('plan_md_attachment', 76.974), ('yes', 78.530),
               ('progress_start', 78.530), ('progress_end', 82.477), ('dev_build_live', 83.244), ('phone_flip_reveal_app', 84.822), ('phone_flip_back', 86.006), ('ship_it', 86.378),
               ('decision_card', 86.936, 'onset'), ('approve', 87.957), ('live_listing', 89.536)]),
 dict(id='shot-08-yours', title='Yours · calm, guardian, private', start=89.536, end=95.829, track=8,
      mechanism='Energy dips (DROP at 90). Three calm words on downbeats over a widening sky; thin backend cards float at +1.5% parallax.',
      anchors=[('drop_breath', 89.536), ('word_1', 91.092), ('word_2', 92.671), ('word_3', 94.273), ('kicker_guardian_angel', 95.039, 'exact'),  ('out', 95.829)]),
 dict(id='shot-09-finale-montage', title='Finale montage · four hard cuts and a spin', start=95.829, end=102.168, track=9,
      mechanism='Four hard cuts on downbeats (thread / mini-apps / create / persona), fill at 99.869 tightens to the 100.589 turntable, spin resolves into the end card on 102.168.',
      anchors=[('cut_1_thread', 95.829), ('cut_2_miniapps', 97.408), ('cut_3_create', 98.987), ('fill', 99.869), ('cut_4_turntable', 100.589), ('spin_into_endcard', 102.168)]),
 dict(id='shot-10-end-card', title='End card · Text your agent. air.wzrd.tech · WZRD lockup', start=102.168, end=DUR, track=10,
      mechanism='cta-close: CTA line, URL on 103.77, TOTAL FREEZE on the hard stop, release rises the chrome WZRD mark and partner wall on the final kicks, lockup on 108.669, still by 113.755, silence to black.',
      anchors=[('cta_line', 102.168), ('url', 103.770), ('freeze', 104.606, 'onset'), ('release', 105.535, 'onset'), ('kick_rise_1', 106.812, 'onset'), ('kick_rise_2', 107.926, 'onset'),
               ('lockup', 108.669), ('last_tile', 111.293, 'onset'), ('still', 113.755, 'onset'), ('silence', 115.0), ('black', DUR)]),
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

seams.update([24.358, 104.606, 105.535, 108.669, 115.0, 119.6])
cut = {
  'version': 3, 'project': 'air-launch', 'track': 'assets/bgm.mp3 (vstar)', 'duration_sec': DUR, 'fps': 30,
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
