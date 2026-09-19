import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P
R='s01-root'
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.fx_css(R) + "\n" + P.chrome_css(R,'mark',560) + """
      #s01-root .blackout{position:absolute;inset:0;background:#000}
      #s01-root .seedot{position:absolute;left:944px;top:524px;width:32px;height:32px;border-radius:50%;
        background:#0C72D8;box-shadow:0 0 44px rgba(12,114,216,.85)}
      /* the name, drawn tiny and blown up so every pixel is a square, then resolved */
      #s01-root .namewrap{position:absolute;left:410px;top:300px;width:1100px;height:420px}
      #s01-root .px{width:1100px;height:420px}
      #s01-root .nameglow{position:absolute;left:410px;top:300px;width:1100px;height:420px;pointer-events:none;
        mix-blend-mode:screen}
      #s01-root .nameglow i{position:absolute;inset:0;display:block;background:
        radial-gradient(38% 34% at 50% 50%,rgba(255,236,200,.42),rgba(255,236,200,0) 70%)}
      #s01-root .markwrap{position:absolute;left:680px;top:686px;width:560px}
      #s01-root .banners{position:absolute;left:777px;top:64px;width:366px}
      #s01-root .bnr{position:absolute;left:0;top:0;width:366px;height:78px;border-radius:24px;
        background:rgba(28,30,36,.74);backdrop-filter:blur(26px) saturate(1.3);border:1px solid rgba(255,255,255,.15);
        box-shadow:0 18px 44px rgba(2,6,18,.5);display:flex;align-items:center;gap:11px;padding:0 14px;
        will-change:transform,opacity}
      #s01-root .bnr .orb{width:34px;height:34px;border-radius:9px;flex:0 0 auto;
        background:url('logos/air-icon.svg') center/contain no-repeat}
      #s01-root .bnr .tx{flex:1;min-width:0}
      #s01-root .bnr .hd{display:flex;align-items:baseline;gap:6px}
      #s01-root .bnr .ap{font-size:13px;font-weight:700;color:#fff;letter-spacing:.01em}
      #s01-root .bnr .ag{font-family:'Azeret Mono',monospace;font-size:11px;color:rgba(244,239,230,.62)}
      #s01-root .bnr .bd{font-size:15px;line-height:1.2;color:rgba(255,255,255,.94);margin-top:2px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #s01-root .seedbub{position:absolute;left:800px;top:509px;width:320px;height:62px;border-radius:22px;
        background:#0C72D8;box-shadow:0 22px 50px rgba(10,60,140,.55);will-change:transform,opacity}"""

BNR = ["your 9am moved to 10 — i told Sam.","invoice #218 paid · $1,200",
       "shop: 3 new orders overnight","want me to book Friday?"]
banners = "\n".join(
    f'        <div data-hf-id="hf-s01b{i}" class="bnr" id="s01-b{i}"><div data-hf-id="hf-s01bi{i}" class="orb"></div>'
    f'<div data-hf-id="hf-s01bt{i}" class="tx"><div data-hf-id="hf-s01bh{i}" class="hd"><span data-hf-id="hf-s01ba{i}" class="ap">air</span>'
    f'<span data-hf-id="hf-s01bg{i}" class="ag">now</span></div><div data-hf-id="hf-s01bb{i}" class="bd">{t}</div></div></div>'
    for i,t in enumerate(BNR))

BODY = f"""    <div data-hf-id="hf-s01frame" class="frame clip" id="s01-frame" data-layout-allow-overflow="" data-start="0" data-duration="10.17" data-track-index="1">
      <div data-hf-id="hf-s01st" class="stage" id="s01-stage">
        <div data-hf-id="hf-s01gl" class="nameglow" id="s01-glow"><i data-hf-id="hf-s01gi"></i></div>
        <div data-hf-id="hf-s01nw" class="namewrap" id="s01-namewrap">
          <canvas data-hf-id="hf-s01px" id="s01-px" class="px" width="1100" height="420"></canvas>
        </div>
        <div data-hf-id="hf-s01mw" class="markwrap" id="s01-markwrap">{P.chrome_html('s01-mark','mark')}</div>
        <div data-hf-id="hf-s01sp" class="seedot" id="s01-seedot"></div>
        <div data-hf-id="hf-s01bs" class="banners" id="s01-banners">
{banners}
        </div>
        <div data-hf-id="hf-s01sb" class="seedbub" id="s01-seed"></div>
      </div>
      <div data-hf-id="hf-s01hf" class="hitflash" id="s01-flash"></div>
      <div data-hf-id="hf-s01bo" class="blackout" id="s01-blackout"></div>
    </div>"""

SCRIPT = P.FX_JS + """
      var stage=$('#s01-stage'), flash=$('#s01-flash');
      var mark=$('#s01-markwrap'), sweep=$('#s01-mark-sweep'), seed=$('#s01-seed'), dot=$('#s01-seedot');
      var bnrs=$$('.bnr'), glow=$('#s01-glow');

      // Arcade pixel: one canvas, the word drawn at 1/block scale and blown back up.
      var px=$('#s01-px');
      var draw=pixelWord(px,'air',"300 300px 'Newsreader', Georgia, serif",'#F7F1E6');
      var pxs={b:46};
      function redraw(){ draw(pxs.b); }
      redraw();
      if(document.fonts && document.fonts.ready){ document.fonts.ready.then(redraw); }

      gsap.set('#s01-blackout',{autoAlpha:1});
      gsap.set(px,{autoAlpha:0,scale:1.06,transformOrigin:'50% 50%'});
      gsap.set(glow,{opacity:0});
      gsap.set(mark,{y:36,autoAlpha:0,scale:.96,transformOrigin:'50% 50%'});
      gsap.set(seed,{autoAlpha:0,scale:.7,transformOrigin:'50% 50%'});
      gsap.set(dot,{autoAlpha:0,scale:.2,transformOrigin:'50% 50%'});
      bnrs.forEach(function(b,i){ gsap.set(b,{y:-160+i*88,autoAlpha:0,scale:.96,transformOrigin:'50% 50%'}); });
      gsap.set(sweep,{xPercent:-120,opacity:0});
      gsap.set(flash,{opacity:0});
      gsap.set(stage,{scale:1.10,transformOrigin:'50% 50%'});

      // 0.0 — black, then one delivered dot: the smallest thing iMessage draws
      tl.to('#s01-blackout',{autoAlpha:0,duration:.55,ease:'power2.out'},0);
      tl.to(dot,{autoAlpha:1,scale:1,duration:.5,ease:'expo.out'},.55);
      tl.to(dot,{scale:.86,duration:1.1,ease:'sine.inOut'},1.2);

      // 2.415 — the name arrives as pixels and resolves. The dot is what it grew out of.
      tl.to(dot,{scale:9,autoAlpha:0,duration:.34,ease:'power3.in'},2.30);
      tl.to(px,{autoAlpha:1,duration:.12,ease:'none'},2.415);
      tl.to(pxs,{b:1,duration:.92,ease:'power3.out',onUpdate:redraw},2.415);
      tl.to(px,{scale:1,duration:1.0,ease:'expo.out'},2.415);
      tl.to(glow,{opacity:1,duration:.9,ease:'power2.out'},2.46);
      // the camera breathes back off the name instead of sitting still
      cam(tl,stage,2.415,{scale:1.0,d:1.5,e:'expo.out'});
      hit(tl,stage,2.415,{base:1.10,amt:.05,flash:flash,flashAmt:.30,flashD:.26});

      // 3.947 / 5.433 / 7.105 — one sky stop per downbeat, and the name answers each one
      [3.947,5.433,7.105].forEach(function(t,i){
        hit(tl,stage,t,{base:1.0,amt:.012});
        tl.to(glow,{opacity:1-.18*(i+1),duration:.5,ease:'power2.out'},t);
      });
      tl.fromTo(sweep,{xPercent:-120,opacity:.9},{xPercent:120,opacity:0,duration:.40,ease:'power2.inOut'},7.30);

      // 7.105 — the name lifts and the chrome mark rises under it: the film's lockup, stated
      // once at the top so the audience has the name before the product starts talking.
      tl.to('#s01-namewrap',{y:-92,scale:.62,duration:.86,ease:'expo.out'},7.105);
      tl.to(glow,{y:-92,scale:.62,duration:.86,ease:'expo.out'},7.105);
      tl.to(mark,{y:0,autoAlpha:1,scale:1,duration:.80,ease:'expo.out'},7.28);

      // 8.173 / 8.661 / 9.149 / 9.636 — the four accented hits. The product interrupts the
      // title card, one banner per hit, each one a small punch on the frame.
      var bt=[8.173,8.661,9.149,9.636];
      bnrs.forEach(function(b,i){
        tl.to(b,{y:i*88,autoAlpha:1,scale:1,duration:.44,ease:'expo.out'},bt[i]);
        hit(tl,stage,bt[i],{base:1.0,amt:.010});
      });
      tl.to(['#s01-namewrap','#s01-glow','#s01-markwrap'],{autoAlpha:0,y:'-=40',duration:.40,ease:'power3.in'},8.90);

      // 10.170 — the SURGE. Four banners become one bubble; shot 02 turns it into the phone.
      bnrs.forEach(function(b,i){
        tl.to(b,{y:445-i*88,scale:.24,autoAlpha:0,duration:.20,ease:'power3.in'},9.95+i*.012);
      });
      tl.to(seed,{autoAlpha:1,scale:1,duration:.16,ease:'power3.out'},10.02);"""
print(P.emit('compositions/shot-01-cold-open.html','shot-01-cold-open','s01',10.17,STYLE,BODY,SCRIPT))
