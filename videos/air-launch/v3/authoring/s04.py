import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P
R='s04-root'
ROWS=[('spotify.svg','listening','4,120 plays this month',0.92),
      ('strava.svg','training','tue / thu / sun, early',0.74),
      ('netflix.svg','watching','one episode, never two',0.61),
      ('notion.svg','notes','tour plans, then everything else',0.83),
      ('calendar.svg','calendar','never books over a workout',0.88),
      ('youtube.svg','watching','live sets, long form',0.55)]
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.fx_css(R) + """
      #s04-root .washL2{position:absolute;inset:0;pointer-events:none;
        background:linear-gradient(100deg,rgba(4,9,22,.56) 0%,rgba(4,9,22,.30) 44%,rgba(4,9,22,.10) 78%)}
      #s04-root .hub{position:absolute;left:112px;top:296px;width:470px;text-align:center;will-change:transform,opacity}
      #s04-root .hub .av{width:266px;height:266px;border-radius:50%;margin:0 auto;display:block;
        background:url('logos/onairos-avatar.png') center/cover no-repeat;
        box-shadow:0 34px 76px rgba(4,12,34,.62),0 0 0 1px rgba(255,255,255,.16)}
      #s04-root .hub .ring{position:absolute;left:50%;top:0;margin-left:-157px;width:314px;height:314px;
        margin-top:-24px;border-radius:50%;border:1px solid rgba(180,214,255,.34);pointer-events:none}
      #s04-root .hub .nm{margin-top:26px;font-family:'Azeret Mono',monospace;font-size:21px;letter-spacing:.10em;
        color:var(--ink);text-shadow:0 2px 14px rgba(3,7,18,.7)}
      #s04-root .hub .sb{margin-top:8px;font-family:'Azeret Mono',monospace;font-size:15px;letter-spacing:.04em;
        color:rgba(244,239,230,.68)}
      /* a signal board, not an orbit: each source lands on a beat and states its weight */
      #s04-root .board{position:absolute;left:672px;top:190px;width:1152px}
      #s04-root .row{display:flex;align-items:center;gap:24px;height:110px;will-change:transform,opacity}
      #s04-root .row .tile{width:74px;height:74px;border-radius:20px;flex:0 0 auto;display:flex;
        align-items:center;justify-content:center;background:rgba(9,15,32,.62);border:1px solid rgba(255,255,255,.16)}
      #s04-root .row .tile i{display:block;width:38px;height:38px;background-position:center;
        background-repeat:no-repeat;background-size:contain}
      #s04-root .row .tx{width:330px;flex:0 0 auto}
      #s04-root .row .k{font-family:'Azeret Mono',monospace;font-size:24px;letter-spacing:.06em;color:var(--ink)}
      #s04-root .row .v{font-family:'Azeret Mono',monospace;font-size:17px;color:rgba(244,239,230,.76);margin-top:5px}
      #s04-root .row .bar{flex:1;height:10px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}
      #s04-root .row .bar i{display:block;height:100%;border-radius:5px;
        background:linear-gradient(90deg,#3C8FE0,#9AD2FF);transform-origin:0% 50%;will-change:transform}
      #s04-root .cap{position:absolute;left:112px;top:862px;width:620px;text-align:center}
      /* STAR BORDER (React Bits) — the persona is not a static portrait; signal arrives at
         it. Sparks orbit the ring and twinkle as the sweep reaches them, so the hub reads
         as something being read from rather than a photograph. */
      #s04-root .starb{inset:auto;left:50%;margin-left:-157px;top:0;width:314px;height:314px}
      #s04-root .flash{position:absolute;inset:0;background:#DCE9FF;opacity:0}"""

rows="".join(
  f'<div data-hf-id="hf-s04r{i}" class="row" id="s04-r{i}">'
  f'<div data-hf-id="hf-s04t{i}" class="tile"><i data-hf-id="hf-s04g{i}" style="background-image:url(&quot;logos/{f}&quot;)"></i></div>'
  f'<div data-hf-id="hf-s04x{i}" class="tx"><div data-hf-id="hf-s04k{i}" class="k">{k}</div>'
  f'<div data-hf-id="hf-s04v{i}" class="v">{v}</div></div>'
  f'<div data-hf-id="hf-s04b{i}" class="bar"><i data-hf-id="hf-s04bi{i}" id="s04-bar{i}"></i></div></div>'
  for i,(f,k,v,w) in enumerate(ROWS))

BODY = f"""    <div data-hf-id="hf-s04frame" class="frame clip" id="s04-frame" data-layout-allow-overflow="" data-start="0" data-duration="6.246" data-track-index="1">
      <div data-hf-id="hf-s04wa" class="washL2"></div>
      <div data-hf-id="hf-s04st" class="stage" id="s04-stage">
        <div data-hf-id="hf-s04hb" class="hub" id="s04-hub"><div data-hf-id="hf-s04av" class="av"></div>
          <div data-hf-id="hf-s04rg" class="ring" id="s04-ring"></div>
          {P.star_border('s04-star', n=16)}
          <div data-hf-id="hf-s04nm" class="nm">ONAIROS PERSONA</div>
          <div data-hf-id="hf-s04sb" class="sb">imported, not guessed</div></div>
        <div data-hf-id="hf-s04bd" class="board" id="s04-board">{rows}</div>
        <div data-hf-id="hf-s04cp" class="cap" id="s04-cap">hyperpersonalization.</div>
      </div>
      <div data-hf-id="hf-s04hf" class="hitflash" id="s04-hitflash"></div>
      <div data-hf-id="hf-s04fl" class="flash" id="s04-flash"></div>
    </div>"""

WEIGHTS=[w for _,_,_,w in ROWS]
SCRIPT = P.FX_JS + f"""
      var stage=$('#s04-stage'), hf=$('#s04-hitflash');
      var rows=[0,1,2,3,4,5].map(function(i){{return $('#s04-r'+i);}});
      var bars=[0,1,2,3,4,5].map(function(i){{return $('#s04-bar'+i);}});
      var W={WEIGHTS};
      gsap.set(hf,{{opacity:0}});
      gsap.set('#s04-flash',{{opacity:0}});
      gsap.set(stage,{{scale:1.0,transformOrigin:'50% 50%'}});
      gsap.set('#s04-hub',{{autoAlpha:0,scale:.92,x:-40,transformOrigin:'50% 50%'}});
      gsap.set('#s04-ring',{{autoAlpha:0,scale:.86,transformOrigin:'50% 50%'}});
      gsap.set('#s04-cap',{{autoAlpha:0,y:16}});
      rows.forEach(function(r){{ gsap.set(r,{{autoAlpha:0,x:54}}); }});
      bars.forEach(function(b){{ gsap.set(b,{{scaleX:0}}); }});

      // 33.344 — the persona lands first: everything after it is what it already knows
      tl.to('#s04-hub',{{autoAlpha:1,scale:1,x:0,duration:.74,ease:'expo.out'}},0);
      tl.to('#s04-ring',{{autoAlpha:1,scale:1,duration:1.0,ease:'expo.out'}},.12);
      starBorder(tl,'s04-star',.30,{{r:157,d:5.0,ringOpacity:.7}});
      tl.to('#s04-cap',{{autoAlpha:1,y:0,duration:.60,ease:'expo.out'}},.30);
      hit(tl,stage,0,{{amt:.026}});

      // one source per half bar, each stating what it actually knows and how much it weighs
      var AT=[0.778,1.556,2.334,3.135,3.913,4.714];
      AT.forEach(function(t,i){{
        tl.to(rows[i],{{autoAlpha:1,x:0,duration:.52,ease:'expo.out'}},t);
        tl.to(bars[i],{{scaleX:W[i],duration:.66,ease:'power3.out'}},t+.08);
        hit(tl,stage,t,{{amt:i%2?.010:.016}});
      }});
      cam(tl,stage,0,{{scale:1.035,d:6.1,e:'none'}});

      // 39.590 — the hand-off into the connector wall
      tl.to(rows,{{autoAlpha:0,x:-90,duration:.26,ease:'power4.in',stagger:.014}},5.94);
      tl.to(['#s04-hub','#s04-cap','#s04-ring','#s04-star'],{{autoAlpha:0,x:-230,duration:.30,ease:'power4.in'}},5.94);
      tl.fromTo('#s04-flash',{{opacity:0}},{{opacity:.26,duration:.10,ease:'power2.out'}},6.14);"""
print(P.emit('compositions/shot-04-hyperpersonal.html','shot-04-hyperpersonal','s04',6.246,STYLE,BODY,SCRIPT))
