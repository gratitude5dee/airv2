import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
import parts as P
R='s10-root'
WALL=[['onairos.svg','coinbase.svg','stripe.svg','openai.svg','anthropic.svg','claude.svg'],
      ['cognition.svg','gmicloud.svg','tenkicloud.svg','omarchy.svg','vercel.svg','github.svg']]
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.phone_css(R,'s10') + "\n" + P.chrome_css(R,'mark',880) + """
      #s10-root .ph{left:1151px;top:365px}
      #s10-root .cta{position:absolute;left:150px;top:378px;width:1100px}
      #s10-root .ctal{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:148px;letter-spacing:-.035em;
        line-height:.94;color:var(--ink);text-shadow:0 4px 34px rgba(3,7,18,.55)}
      #s10-root .url{position:relative;display:inline-block;margin-top:38px;font-family:'Azeret Mono',monospace;
        font-size:46px;letter-spacing:.01em;color:var(--ink);text-shadow:0 2px 18px rgba(3,7,18,.6)}
      #s10-root .url .ul{position:absolute;left:0;right:0;bottom:-13px;height:2px;background:var(--ink);
        transform-origin:0% 50%;will-change:transform}
      #s10-root .lock{position:absolute;left:520px;top:326px;width:880px;text-align:center}
      #s10-root .airby{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:64px;letter-spacing:.12em;
        color:var(--ink);margin-bottom:26px;text-shadow:0 3px 22px rgba(3,7,18,.5)}
      #s10-root .wall{position:absolute;left:0;right:0;top:700px;text-align:center}
      #s10-root .wl{font-family:'Azeret Mono',monospace;font-size:20px;letter-spacing:.10em;
        color:#F4EFE6;margin-bottom:26px;text-shadow:0 2px 14px rgba(3,7,18,.7)}
      #s10-root .wr{display:flex;align-items:center;justify-content:center;gap:26px;margin-bottom:18px}
      #s10-root .wt{width:150px;height:74px;border-radius:16px;background:rgba(6,12,28,.44);
        border:1px solid rgba(255,255,255,.13);backdrop-filter:blur(12px);display:flex;align-items:center;
        justify-content:center;will-change:transform,opacity}
      #s10-root .wt i{display:block;width:84px;height:38px;background-position:center;background-repeat:no-repeat;
        background-size:contain;filter:brightness(0) invert(1);opacity:.88}
      /* the partner wall sits on the brightest sky in the film: it gets its own ground */
      #s10-root .footscrim{position:absolute;inset:0;pointer-events:none;
        background:linear-gradient(0deg,rgba(4,9,22,.68) 0%,rgba(4,9,22,.34) 26%,rgba(4,9,22,0) 48%)}
      #s10-root .blk{position:absolute;inset:0;background:#000;opacity:0}"""
rows="".join('<div data-hf-id="hf-s10r%d" class="wr" id="s10-r%d">' % (r,r)
             + "".join(f'<div data-hf-id="hf-s10t{r}{i}" class="wt" id="s10-t{r}{i}">'
                       f'<i data-hf-id="hf-s10ti{r}{i}" style="background-image:url(&quot;logos/{n}&quot;)"></i></div>'
                       for i,n in enumerate(row)) + '</div>' for r,row in enumerate(WALL))
BODY = f"""    <div data-hf-id="hf-s10frame" class="frame clip" id="s10-frame" data-layout-allow-overflow="" data-start="0" data-duration="17.531" data-track-index="1">
      <div data-hf-id="hf-s10wa" class="washL"></div>
      <div data-hf-id="hf-s10fs" class="footscrim"></div>
      <div data-hf-id="hf-s10ct" class="cta" id="s10-cta">
        <div data-hf-id="hf-s10c1" class="ctal">Text your agent.</div>
        <div data-hf-id="hf-s10uw"><span data-hf-id="hf-s10ur" class="url" id="s10-url">air.wzrd.tech<span data-hf-id="hf-s10ul" class="ul" id="s10-ul"></span></span></div>
      </div>
{P.PHONE_HTML.replace('%P%','s10')}
      <div data-hf-id="hf-s10lk" class="lock" id="s10-lock">
        <div data-hf-id="hf-s10ab" class="airby" id="s10-airby">air by</div>
        {P.chrome_html('s10-mark','mark')}
      </div>
      <div data-hf-id="hf-s10wl" class="wall" id="s10-wall">
        <div data-hf-id="hf-s10wt" class="wl" id="s10-wline">BUILT ON ZAPS BY WZRD.TECH, IN PARTNERSHIP WITH</div>
        {rows}
      </div>
      <div data-hf-id="hf-s10bk" class="blk" id="s10-blk"></div>
    </div>"""
SCRIPT = """      var cta=$('#s10-cta'), url=$('#s10-url'), ul=$('#s10-ul'), ph=$('#s10-ph');
      var lock=$('#s10-lock'), airby=$('#s10-airby'), mark=$('#s10-mark'), sweep=$('#s10-mark-sweep');
      var wline=$('#s10-wline'), tiles=$$('.wt');
      var ctal=$('.ctal');

      gsap.set(ph,{scale:.42,rotationY:-14,rotationX:5,transformOrigin:'50% 50%'});
      gsap.set(ctal,{y:26,autoAlpha:0});
      gsap.set(url,{y:18,autoAlpha:0});
      gsap.set(ul,{scaleX:0});
      gsap.set(lock,{autoAlpha:0,y:170});
      gsap.set(airby,{autoAlpha:0,y:18});
      gsap.set(sweep,{xPercent:-120,opacity:0});
      gsap.set(wline,{autoAlpha:0,y:14});
      gsap.set(tiles,{autoAlpha:0,y:34,transformOrigin:'50% 50%'});
      gsap.set('#s10-blk',{opacity:0});

      // 102.168 — the ask, in the film's own voice
      tl.to(ctal,{y:0,autoAlpha:1,duration:.78,ease:'expo.out'},0);
      // 103.770 — the address, underlined left to right
      tl.to(url,{y:0,autoAlpha:1,duration:.62,ease:'expo.out'},1.602);
      tl.to(ul,{scaleX:1,duration:.40,ease:'power2.out'},1.74);
      // 104.606 -> 105.535 — THE FREEZE. The track stops; so does every tween in the film.
      // Nothing is scheduled in this window on purpose.
      // 105.535 — the release kick lifts the CTA out and brings the mark up
      tl.to([cta,ph],{y:-120,autoAlpha:0,duration:.30,ease:'power4.in'},3.367);
      tl.to(lock,{autoAlpha:1,y:0,duration:.90,ease:'expo.out'},3.42);
      // 106.812 / 107.950 — the partner wall rises on the last two kicks
      tl.to(wline,{autoAlpha:1,y:0,duration:.44,ease:'expo.out'},4.50);
      $$('#s10-r0 .wt').forEach(function(t,i){ tl.to(t,{autoAlpha:1,y:0,duration:.50,ease:'expo.out'},4.644+i*.035); });
      $$('#s10-r1 .wt').forEach(function(t,i){ tl.to(t,{autoAlpha:1,y:0,duration:.50,ease:'expo.out'},5.782+i*.035); });
      // 108.669 — the lockup the brand film ends on, and the last spectral moment of four
      tl.to(airby,{autoAlpha:1,y:0,duration:.66,ease:'expo.out'},6.501);
      tl.fromTo(sweep,{xPercent:-120,opacity:.9},{xPercent:120,opacity:0,duration:.36,ease:'power2.inOut'},6.60);
      // 111.293 — the last tile settles and the frame is done moving
      tl.to(lock,{y:-8,duration:2.2,ease:'sine.inOut'},6.70);
      tl.to('#s10-wall',{y:-6,duration:2.2,ease:'sine.inOut'},6.90);
      // 113.755 -> silence -> black
      tl.to('#s10-blk',{opacity:1,duration:4.36,ease:'power1.in'},12.832);"""
print(P.emit('compositions/shot-10-end-card.html','shot-10-end-card','s10',17.531,STYLE,BODY,SCRIPT))
