import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P
R='s05-root'
MARKS=['gmail.svg','slack.svg','notion.svg','shopify.svg','stripe.svg','github.svg','figma.svg','spotify.svg',
 'drive.svg','calendar.svg','instagram.svg','x.svg','tiktok.svg','youtube.svg','discord.svg','telegram.svg',
 'whatsapp.svg','reddit.svg','salesforce.svg','hubspot.svg','jira.svg','asana.svg','quickbooks.svg','square.svg',
 'dropbox.svg','box.svg','trello.svg','zoom.svg','linkedin.svg' if False else 'meta.svg','airbnb.svg','uber.svg',
 'doordash.svg','etsy.svg','ebay.svg','target.svg','walmart.svg','nike.svg','adidas.svg','peloton.svg','strava.svg',
 'duolingo.svg','twitch.svg','steam.svg','pinterest.svg','yelp.svg']
COLS, ROWS_N = 9, 5
TILE, GAP = 122, 20
W = COLS*TILE + (COLS-1)*GAP
H = ROWS_N*TILE + (ROWS_N-1)*GAP
LEFT = (1920-W)//2
TOP  = 148
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.fx_css(R) + f"""
      #s05-root .wall{{position:absolute;left:{LEFT}px;top:{TOP}px;width:{W}px;height:{H}px;
        display:grid;grid-template-columns:repeat({COLS},{TILE}px);grid-auto-rows:{TILE}px;gap:{GAP}px}}
      #s05-root .mk{{position:relative;border-radius:28px;background:rgba(9,15,32,.52);
        border:1px solid rgba(255,255,255,.10);display:flex;align-items:center;justify-content:center;
        will-change:transform,opacity}}
      #s05-root .mk i{{display:block;width:58px;height:58px;background-position:center;background-repeat:no-repeat;
        background-size:contain;filter:grayscale(1) brightness(.55);opacity:.55;will-change:filter,opacity}}
      #s05-root .mk.on{{background:rgba(16,28,56,.72);border-color:rgba(255,255,255,.22)}}
      #s05-root .scrim{{position:absolute;left:0;right:0;top:{TOP-40}px;height:{H+80}px;pointer-events:none;
        background:radial-gradient(32% 44% at 50% 50%,rgba(4,9,22,.94) 0%,rgba(4,9,22,.66) 44%,rgba(4,9,22,0) 76%)}}
      #s05-root .num{{position:absolute;left:0;right:0;top:362px;text-align:center;font-family:'Azeret Mono',monospace;
        font-weight:500;font-size:226px;letter-spacing:-.05em;color:var(--ink);
        text-shadow:0 10px 60px rgba(3,7,18,.86);font-variant-numeric:tabular-nums}}
      #s05-root .cap{{position:absolute;left:0;right:0;top:902px;text-align:center}}"""

tiles="".join(f'<div data-hf-id="hf-s05m{i}" class="mk" id="s05-m{i}">'
              f'<i data-hf-id="hf-s05i{i}" style="background-image:url(&quot;logos/{MARKS[i%len(MARKS)]}&quot;)"></i></div>'
              for i in range(COLS*ROWS_N))
BODY = f"""    <div data-hf-id="hf-s05frame" class="frame clip" id="s05-frame" data-layout-allow-overflow="" data-start="0" data-duration="6.223" data-track-index="1">
      <div data-hf-id="hf-s05st" class="stage" id="s05-stage">
        <div data-hf-id="hf-s05wl" class="wall" id="s05-wall">{tiles}</div>
        <div data-hf-id="hf-s05sc" class="scrim"></div>
        <div data-hf-id="hf-s05nm" class="num" id="s05-num">0</div>
        <div data-hf-id="hf-s05cp" class="cap" id="s05-cap">connect your apps.</div>
      </div>
      <div data-hf-id="hf-s05hf" class="hitflash" id="s05-hitflash"></div>
      <div data-hf-id="hf-s05sd" class="seed" id="s05-seed"></div>
    </div>"""
BODY = BODY.replace('<div data-hf-id="hf-s05sd" class="seed" id="s05-seed"></div>',
 '<div data-hf-id="hf-s05sd" class="seed" id="s05-seed"></div>')
STYLE += """
      /* the silhouette of the phone shot 06 opens on: the wall collapses into this shape */
      #s05-root .seed{position:absolute;left:470px;top:103px;width:402px;height:874px;border-radius:56px;
        background:linear-gradient(160deg,#3a3f4a 0%,#171b22 38%,#0f1218 100%);
        box-shadow:0 60px 120px rgba(2,6,18,.62);will-change:transform,opacity}"""

SCRIPT = P.FX_JS + f"""
      var stage=$('#s05-stage'), hf=$('#s05-hitflash');
      var N={COLS*ROWS_N};
      var mk=[]; for(var i=0;i<N;i++) mk.push($('#s05-m'+i));
      gsap.set(hf,{{opacity:0}});
      gsap.set(stage,{{scale:1.02,transformOrigin:'50% 46%'}});
      gsap.set('#s05-cap',{{autoAlpha:0,y:16}});
      gsap.set('#s05-seed',{{autoAlpha:0,scale:.08,x:13,y:-40,transformOrigin:'50% 50%'}});
      mk.forEach(function(m){{ gsap.set(m,{{autoAlpha:0,scale:.80,transformOrigin:'50% 50%'}}); }});
      var n={{v:0}}, numEl=$('#s05-num');
      gsap.set(numEl,{{autoAlpha:0,scale:.92,transformOrigin:'50% 50%'}});

      // A wall coming online, not a carousel: nothing rotates. A fixed shuffle decides the
      // order so the board fills unevenly, the way a real integration list would.
      var seed=9, order=[];
      for(var i=0;i<N;i++) order.push(i);
      for(var i=N-1;i>0;i--){{ seed=(seed*1103515245+12345)&0x7fffffff; var j=seed%(i+1);
        var t=order[i]; order[i]=order[j]; order[j]=t; }}
      order.forEach(function(idx,k){{
        var u=k/(N-1);
        var t=0.06 + 4.30*Math.pow(u,0.72);          // fills faster as the bar goes on
        tl.to(mk[idx],{{autoAlpha:1,scale:1,duration:.34,ease:'back.out(1.8)'}},t);
        tl.to(mk[idx].querySelector('i'),{{opacity:1,filter:'grayscale(0) brightness(1)',duration:.30,ease:'power2.out'}},t+.05);
      }});
      // 39.962 -> 44.257 — the count lands exactly on the downbeat, then stops dead
      tl.to(numEl,{{autoAlpha:1,scale:1,duration:.5,ease:'expo.out'}},.22);
      tl.to(n,{{v:1000,duration:4.30,ease:'power2.out',onUpdate:function(){{
        numEl.textContent = Math.round(n.v).toLocaleString('en-US');
      }}}},.372);
      tl.set(numEl,{{textContent:'1,000+'}},4.667);
      tl.to(numEl,{{scale:1.05,duration:.12,ease:'power2.out'}},4.667);
      tl.to(numEl,{{scale:1,duration:.42,ease:'power2.inOut'}},4.787);
      tl.to('#s05-cap',{{autoAlpha:1,y:0,duration:.60,ease:'expo.out'}},4.667);
      hit(tl,stage,0,{{base:1.02,amt:.026}});
      [1.556,3.111,4.667].forEach(function(t){{ hit(tl,stage,t,{{base:1.02,amt:.014}}); }});
      cam(tl,stage,0,{{scale:1.0,d:4.6,e:'expo.out'}});

      // 45.813 — the wall collapses into the phone shot 06 opens with
      tl.to(mk,{{autoAlpha:0,scale:.12,x:0,y:0,duration:.30,ease:'power3.in',stagger:{{each:.004,from:'edges'}}}},5.72);
      tl.to(['#s05-num','#s05-cap'],{{autoAlpha:0,scale:.92,duration:.26,ease:'power4.in'}},5.78);
      tl.to('#s05-seed',{{autoAlpha:1,scale:1.06,x:0,y:0,duration:.30,ease:'expo.out'}},5.92);"""
print(P.emit('compositions/shot-05-connect-apps.html','shot-05-connect-apps','s05',6.223,STYLE,BODY,SCRIPT))
