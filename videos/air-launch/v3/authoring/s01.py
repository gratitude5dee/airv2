import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
import parts as P
R='s01-root'
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.chrome_css(R,'mark',820) + """
      #s01-root .blackout{position:absolute;inset:0;background:#000}
      #s01-root .markwrap{position:absolute;left:550px;top:452px;width:820px;will-change:transform,opacity}
      #s01-root .banners{position:absolute;left:777px;top:58px;width:366px}
      #s01-root .bnr{position:absolute;left:0;top:0;width:366px;height:78px;border-radius:24px;
        background:rgba(28,30,36,.72);backdrop-filter:blur(26px) saturate(1.3);border:1px solid rgba(255,255,255,.13);
        box-shadow:0 18px 44px rgba(2,6,18,.46);display:flex;align-items:center;gap:11px;padding:0 14px;will-change:transform,opacity}
      #s01-root .bnr .orb{width:34px;height:34px;border-radius:9px;flex:0 0 auto;
        background:url('logos/air-brand.png') center/cover no-repeat}
      #s01-root .bnr .tx{flex:1;min-width:0}
      #s01-root .bnr .hd{display:flex;align-items:baseline;gap:6px}
      #s01-root .bnr .ap{font-size:13px;font-weight:700;color:#fff;letter-spacing:.01em}
      #s01-root .bnr .ag{font-family:'Azeret Mono',monospace;font-size:11px;color:rgba(244,239,230,.62)}
      #s01-root .bnr .bd{font-size:15px;line-height:1.2;color:rgba(255,255,255,.92);margin-top:2px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #s01-root .seedbub{position:absolute;left:800px;top:509px;width:320px;height:62px;border-radius:22px;
        background:#0C72D8;box-shadow:0 22px 50px rgba(10,60,140,.5);will-change:transform,opacity}"""

BNR = [("your 9am moved to 10 — i told Sam.",), ("invoice #218 paid · $1,200",),
       ("shop: 3 new orders overnight",), ("want me to book Friday?",)]
banners = "\n".join(
    f'        <div data-hf-id="hf-s01b{i}" class="bnr" id="s01-b{i}"><div data-hf-id="hf-s01bi{i}" class="orb"></div>'
    f'<div data-hf-id="hf-s01bt{i}" class="tx"><div data-hf-id="hf-s01bh{i}" class="hd"><span data-hf-id="hf-s01ba{i}" class="ap">air</span>'
    f'<span data-hf-id="hf-s01bg{i}" class="ag">now</span></div><div data-hf-id="hf-s01bb{i}" class="bd">{t[0]}</div></div></div>'
    for i,t in enumerate(BNR))

BODY = f"""    <div data-hf-id="hf-s01frame" class="frame clip" id="s01-frame" data-layout-allow-overflow="" data-start="0" data-duration="10.17" data-track-index="1">
      <div data-hf-id="hf-s01mw" class="markwrap" id="s01-markwrap">{P.chrome_html('s01-mark','mark')}</div>
      <div data-hf-id="hf-s01bs" class="banners" id="s01-banners">
{banners}
      </div>
      <div data-hf-id="hf-s01sb" class="seedbub" id="s01-seed"></div>
      <div data-hf-id="hf-s01bo" class="blackout" id="s01-blackout"></div>
    </div>"""

SCRIPT = """      var mark=$('#s01-markwrap'), sweep=$('#s01-mark-sweep'), seed=$('#s01-seed');
      var bnrs=$$('.bnr');

      gsap.set('#s01-blackout',{autoAlpha:1});
      gsap.set(mark,{y:44,autoAlpha:0,scale:.965,transformOrigin:'50% 50%'});
      gsap.set(seed,{autoAlpha:0,scale:.7,transformOrigin:'50% 50%'});
      bnrs.forEach(function(b,i){ gsap.set(b,{y:-150+i*88,autoAlpha:0,scale:.96,transformOrigin:'50% 50%'}); });
      gsap.set(sweep,{xPercent:-120,opacity:0});

      // 0.0 — the film opens on the night the brand film opens on
      tl.to('#s01-blackout',{autoAlpha:0,duration:.62,ease:'power2.out'},0);

      // 2.415 — first downbeat: the mark comes up, exactly as the intro film brings it up
      tl.to(mark,{y:0,autoAlpha:1,scale:1,duration:.92,ease:'expo.out'},2.415);

      // 3.947 / 5.433 / 7.105 — the sky steps one stop per downbeat (in sky.html); the chrome
      // picks up each new key light. One mechanism, three repeats: nothing else moves.
      [3.947,5.433,7.105].forEach(function(t){
        tl.fromTo(sweep,{xPercent:-120,opacity:.85},{xPercent:120,opacity:0,duration:.34,ease:'power2.inOut'},t);
      });
      tl.to(mark,{y:-7,duration:2.4,ease:'sine.inOut'},3.6);
      tl.to(mark,{y:0,duration:1.9,ease:'sine.inOut'},6.0);

      // 8.173 / 8.661 / 9.149 / 9.636 — the four accented hits of the cold open. One banner
      // each, stacking down. This is the product interrupting the brand film.
      var bt=[8.173,8.661,9.149,9.636];
      bnrs.forEach(function(b,i){
        tl.to(b,{y:i*88,autoAlpha:1,scale:1,duration:.46,ease:'expo.out'},bt[i]);
      });

      // 9.83 — the mark leaves on the film's vector so the SURGE lands on an empty sky
      tl.to(mark,{x:-230,autoAlpha:0,duration:.40,ease:'power3.in'},9.66);

      // 9.95 -> 10.17 — the four banners collapse into one blue bubble. S02 opens on that
      // bubble and morphs it into the phone: one continuous object across the seam.
      bnrs.forEach(function(b,i){
        tl.to(b,{y:451-i*88,x:0,scale:.26,autoAlpha:0,duration:.20,ease:'power3.in'},9.95+i*.012);
      });
      tl.to(seed,{autoAlpha:1,scale:1,duration:.16,ease:'power3.out'},10.02);"""
print(P.emit('compositions/shot-01-cold-open.html','shot-01-cold-open','s01',10.17,STYLE,BODY,SCRIPT))
