import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
import parts as P
R='s14-root'
WALL=[['onairos.svg','coinbase.svg','stripe.svg','openai.svg','anthropic.svg','claude.svg'],
      ['cognition.svg','gmicloud.svg','tenkicloud.svg','omarchy.svg','vercel.svg','github.svg']]
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.phone_css(R,'s14') + "\n" + P.fx_css(R) + "\n" + P.chrome_css(R,'mark',760) + """
      #s14-root .ph{left:1151px;top:365px}
      #s14-root .cta{position:absolute;left:150px;top:378px;width:1100px}
      #s14-root .ctal{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:148px;letter-spacing:-.035em;
        line-height:.94;color:var(--ink);text-shadow:0 4px 34px rgba(3,7,18,.55)}
      /* the CTA pill: a real object (color depth), whose word puffs up (Amo) */
      #s14-root .ctapill{display:inline-flex;align-items:center;gap:18px;margin-top:44px;padding:26px 46px;
        border-radius:999px;background:linear-gradient(180deg,#2E86EA 0%,#1667C8 54%,#0C4C9E 100%);
        box-shadow:inset 0 2px 0 rgba(255,255,255,.55),inset 0 -3px 10px rgba(2,24,62,.55),
                   0 22px 48px rgba(6,54,124,.5);will-change:transform}
      #s14-root .ctapill .puff{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:56px;
        letter-spacing:-.01em;color:#FFFFFF}
      #s14-root .ctapill .pl{text-shadow:0 1px 0 rgba(255,255,255,.5)}
      #s14-root .ctapill .arrow{font-family:'Azeret Mono',monospace;font-size:40px;color:rgba(255,255,255,.86)}
      #s14-root .url{position:relative;display:inline-block;margin-top:38px;font-family:'Azeret Mono',monospace;
        font-size:46px;letter-spacing:.01em;color:var(--ink);text-shadow:0 2px 18px rgba(3,7,18,.6)}
      #s14-root .url .ul{position:absolute;left:0;right:0;bottom:-13px;height:2px;background:var(--ink);
        transform-origin:0% 50%;will-change:transform}
      #s14-root .lock{position:absolute;left:580px;top:186px;width:760px;text-align:center}
      #s14-root .lockicon{width:214px;height:214px;margin:0 auto 26px;position:relative;
        will-change:transform,opacity}
      #s14-root .lockicon svg{display:block;filter:drop-shadow(0 22px 52px rgba(4,26,62,.55))}
      #s14-root .lockicon .glint{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;
        background:linear-gradient(104deg,rgba(255,255,255,0) 38%,rgba(255,255,255,.7) 50%,rgba(255,255,255,0) 62%)}
      #s14-root .lockglow{position:absolute;left:0;right:0;top:-40px;height:280px;pointer-events:none;
        background:radial-gradient(36% 46% at 50% 44%,rgba(150,214,255,.34),rgba(150,214,255,0) 72%);
        mix-blend-mode:screen}
      #s14-root .airby{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:64px;letter-spacing:.12em;
        color:var(--ink);margin-bottom:26px;text-shadow:0 3px 22px rgba(3,7,18,.5)}
      #s14-root .wall{position:absolute;left:0;right:0;top:700px;text-align:center}
      #s14-root .wl{font-family:'Azeret Mono',monospace;font-size:20px;letter-spacing:.10em;
        color:#F4EFE6;margin-bottom:26px;text-shadow:0 2px 14px rgba(3,7,18,.7)}
      #s14-root .wr{display:flex;align-items:center;justify-content:center;gap:26px;margin-bottom:18px}
      #s14-root .wt{width:150px;height:74px;border-radius:16px;background:rgba(6,12,28,.44);
        border:1px solid rgba(255,255,255,.13);backdrop-filter:blur(12px);display:flex;align-items:center;
        justify-content:center;will-change:transform,opacity}
      #s14-root .wt i{display:block;width:84px;height:38px;background-position:center;background-repeat:no-repeat;
        background-size:contain;filter:brightness(0) invert(1);opacity:.88}
      /* the partner wall sits on the brightest sky in the film: it gets its own ground */
      #s14-root .footscrim{position:absolute;inset:0;pointer-events:none;
        background:linear-gradient(0deg,rgba(4,9,22,.68) 0%,rgba(4,9,22,.34) 26%,rgba(4,9,22,0) 48%)}
      #s14-root .blk{position:absolute;inset:0;background:#000;opacity:0}"""
rows="".join('<div data-hf-id="hf-s14r%d" class="wr" id="s14-r%d">' % (r,r)
             + "".join(f'<div data-hf-id="hf-s14t{r}{i}" class="wt" id="s14-t{r}{i}">'
                       f'<i data-hf-id="hf-s14ti{r}{i}" style="background-image:url(&quot;logos/{n}&quot;)"></i></div>'
                       for i,n in enumerate(row)) + '</div>' for r,row in enumerate(WALL))
ICON14 = P.inline_icon("s14icon", 214)

BODY = f"""    <div data-hf-id="hf-s14frame" class="frame clip" id="s14-frame" data-layout-allow-overflow="" data-start="0" data-duration="17.531" data-track-index="1">
      <div data-hf-id="hf-s14wa" class="washL"></div>
      <div data-hf-id="hf-s14fs" class="footscrim"></div>
      <div data-hf-id="hf-s14ct" class="cta" id="s14-cta">
        <div data-hf-id="hf-s14c1" class="ctal">Text your agent.</div>
        <div data-hf-id="hf-s14pw"><span data-hf-id="hf-s14cp" class="ctapill btn3" id="s14-ctapill"><span data-hf-id="hf-s14pf0" class="puff"><span data-hf-id="hf-s14pl0" class="pl" id="s14-pl0">a</span></span><span data-hf-id="hf-s14pf1" class="puff"><span data-hf-id="hf-s14pl1" class="pl" id="s14-pl1">i</span></span><span data-hf-id="hf-s14pf2" class="puff"><span data-hf-id="hf-s14pl2" class="pl" id="s14-pl2">r</span></span><span data-hf-id="hf-s14pf3" class="puff"><span data-hf-id="hf-s14pl3" class="pl" id="s14-pl3">.</span></span><span data-hf-id="hf-s14pf4" class="puff"><span data-hf-id="hf-s14pl4" class="pl" id="s14-pl4">w</span></span><span data-hf-id="hf-s14pf5" class="puff"><span data-hf-id="hf-s14pl5" class="pl" id="s14-pl5">z</span></span><span data-hf-id="hf-s14pf6" class="puff"><span data-hf-id="hf-s14pl6" class="pl" id="s14-pl6">r</span></span><span data-hf-id="hf-s14pf7" class="puff"><span data-hf-id="hf-s14pl7" class="pl" id="s14-pl7">d</span></span><span data-hf-id="hf-s14pf8" class="puff"><span data-hf-id="hf-s14pl8" class="pl" id="s14-pl8">.</span></span><span data-hf-id="hf-s14pf9" class="puff"><span data-hf-id="hf-s14pl9" class="pl" id="s14-pl9">t</span></span><span data-hf-id="hf-s14pf10" class="puff"><span data-hf-id="hf-s14pl10" class="pl" id="s14-pl10">e</span></span><span data-hf-id="hf-s14pf11" class="puff"><span data-hf-id="hf-s14pl11" class="pl" id="s14-pl11">c</span></span><span data-hf-id="hf-s14pf12" class="puff"><span data-hf-id="hf-s14pl12" class="pl" id="s14-pl12">h</span></span><span data-hf-id="hf-s14ar" class="arrow">&rarr;</span></span></div>
        <div data-hf-id="hf-s14uw"><span data-hf-id="hf-s14ur" class="url" id="s14-url">text it. it answers.<span data-hf-id="hf-s14ul" class="ul" id="s14-ul"></span></span></div>
      </div>
{P.PHONE_HTML.replace('%P%','s14')}
      <div data-hf-id="hf-s14lk" class="lock" id="s14-lock">
        <div data-hf-id="hf-s14lg" class="lockglow" id="s14-lockglow"></div>
        <div data-hf-id="hf-s14li" class="lockicon" id="s14-lockicon">{ICON14}<div data-hf-id="hf-s14gt" class="glint" id="s14-glint"></div></div>
        <div data-hf-id="hf-s14ab" class="airby" id="s14-airby">air by</div>
        {P.chrome_html('s14-mark','mark')}
      </div>
      <div data-hf-id="hf-s14wl" class="wall" id="s14-wall">
        <div data-hf-id="hf-s14wt" class="wl" id="s14-wline">BUILT ON ZAPS BY WZRD.TECH, IN PARTNERSHIP WITH</div>
        {rows}
      </div>
      <div data-hf-id="hf-s14bk" class="blk" id="s14-blk"></div>
    </div>"""
SCRIPT = """      var cta=$('#s14-cta'), url=$('#s14-url'), ul=$('#s14-ul'), ph=$('#s14-ph');
      var lock=$('#s14-lock'), airby=$('#s14-airby'), mark=$('#s14-mark'), sweep=$('#s14-mark-sweep');
      var wline=$('#s14-wline'), tiles=$$('.wt');
      var lockicon=$('#s14-lockicon'), lockglow=$('#s14-lockglow'), glint=$('#s14-glint');
      var iwaves=$$('#s14icon-air-waves path');
      var pill=$('#s14-ctapill'), pls=$$('#s14-ctapill .pl');
      var ctal=$('.ctal');

      gsap.set(ph,{scale:.42,rotationY:-14,rotationX:5,transformOrigin:'50% 50%'});
      gsap.set(ctal,{y:26,autoAlpha:0});
      gsap.set(url,{y:18,autoAlpha:0});
      gsap.set(pill,{y:26,autoAlpha:0,scale:.94,transformOrigin:'50% 50%'});
      gsap.set(pls,{transformOrigin:'50% 100%'});
      gsap.set(ul,{scaleX:0});
      gsap.set(lock,{autoAlpha:0,y:170});
      gsap.set(airby,{autoAlpha:0,y:18});
      gsap.set(lockicon,{autoAlpha:0,y:34,scale:.88,transformOrigin:'50% 50%'});
      gsap.set(lockglow,{autoAlpha:0});
      gsap.set(glint,{xPercent:-130,opacity:0});
      gsap.set(sweep,{xPercent:-120,opacity:0});
      gsap.set(wline,{autoAlpha:0,y:14});
      gsap.set(tiles,{autoAlpha:0,y:34,transformOrigin:'50% 50%'});
      gsap.set('#s14-blk',{opacity:0});

      // 102.168 — the ask, in the film's own voice
      tl.to(ctal,{y:0,autoAlpha:1,duration:.78,ease:'expo.out'},0);
      // 103.770 — the address arrives as a thing you could press, and its letters puff up
      // one at a time, the way the Amo pill does on hover.
      tl.to(pill,{y:0,autoAlpha:1,scale:1,duration:.62,ease:'expo.out'},1.602);
      pls.forEach(function(l,i){
        tl.to(l,{scaleY:1.16,scaleX:1.06,y:-5,duration:.10,ease:'power2.out'},1.70+i*.028);
        tl.to(l,{scaleY:1,scaleX:1,y:0,duration:.34,ease:'back.out(2.2)'},1.80+i*.028);
      });
      tl.to(url,{y:0,autoAlpha:1,duration:.56,ease:'expo.out'},2.30);
      tl.to(ul,{scaleX:1,duration:.36,ease:'power2.out'},2.44);
      // 104.606 -> 105.535 — THE FREEZE. The track stops; so does every tween in the film.
      // Nothing is scheduled in this window on purpose.
      // 105.535 — the release kick lifts the CTA out and brings the mark up
      tl.to([cta,ph],{y:-120,autoAlpha:0,duration:.30,ease:'power4.in'},3.367);
      tl.to(lock,{autoAlpha:1,y:0,duration:.90,ease:'expo.out'},3.42);
      // 105.535 — the mark comes up icon first, the way the product is actually recognised
      tl.to(lockicon,{autoAlpha:1,y:0,scale:1,duration:.86,ease:'expo.out'},3.50);
      tl.to(lockglow,{autoAlpha:1,duration:1.1,ease:'power2.out'},3.60);
      iwaves.forEach(function(w,i){
        tl.fromTo(w,{x:-10-i*4},{x:10+i*4,duration:11.0,ease:'sine.inOut'},3.50);
      });
      // 106.812 / 107.950 — the partner wall rises on the last two kicks
      tl.to(wline,{autoAlpha:1,y:0,duration:.44,ease:'expo.out'},4.50);
      $$('#s14-r0 .wt').forEach(function(t,i){ tl.to(t,{autoAlpha:1,y:0,duration:.50,ease:'expo.out'},4.644+i*.035); });
      $$('#s14-r1 .wt').forEach(function(t,i){ tl.to(t,{autoAlpha:1,y:0,duration:.50,ease:'expo.out'},5.782+i*.035); });
      // 108.669 — the lockup the brand film ends on, and the last spectral moment of four
      tl.to(airby,{autoAlpha:1,y:0,duration:.66,ease:'expo.out'},6.501);
      tl.fromTo(sweep,{xPercent:-120,opacity:.9},{xPercent:120,opacity:0,duration:.36,ease:'power2.inOut'},6.60);
      // the icon catches the same light, a beat behind the wordmark
      tl.fromTo(glint,{xPercent:-130,opacity:.95},{xPercent:130,opacity:0,duration:.70,ease:'power2.inOut'},6.62);
      tl.to(lockicon,{scale:1.035,duration:.12,ease:'power2.out'},6.501);
      tl.to(lockicon,{scale:1,duration:.7,ease:'power2.out'},6.621);
      // 111.293 — the last tile settles and the frame is done moving
      tl.to(lock,{y:-8,duration:2.2,ease:'sine.inOut'},6.70);
      tl.to('#s14-wall',{y:-6,duration:2.2,ease:'sine.inOut'},6.90);
      // 113.755 -> silence -> black
      tl.to('#s14-blk',{opacity:1,duration:4.36,ease:'power1.in'},12.832);"""
print(P.emit('compositions/shot-14-end-card.html','shot-14-end-card','s14',17.531,STYLE,BODY,SCRIPT))
