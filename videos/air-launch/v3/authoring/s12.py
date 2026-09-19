import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P
R='s12-root'
CARDS=[('Custom sandbox','its own isolated machine, per person','glyph-computer.svg'),
       ('Local task router','a custom quantized model, on the machine','glyph-remote.svg'),
       ('Zero data retention','clean, content-zero data retention','glyph-vault.svg')]
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.fx_css(R) + """
      #s12-root .iconwrap{position:absolute;left:700px;top:64px;width:520px;height:520px;
        display:flex;align-items:center;justify-content:center;will-change:transform,opacity}
      #s12-root .iconwrap svg{display:block;filter:drop-shadow(0 40px 90px rgba(4,26,62,.55))}
      #s12-root .iconglow{position:absolute;left:650px;top:14px;width:620px;height:620px;pointer-events:none;
        border-radius:50%;background:radial-gradient(48% 48% at 50% 50%,rgba(150,214,255,.40),rgba(150,214,255,0) 72%);
        mix-blend-mode:screen;will-change:opacity,transform}
      #s12-root .glint{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;
        background:linear-gradient(104deg,rgba(255,255,255,0) 38%,rgba(255,255,255,.62) 50%,rgba(255,255,255,0) 62%);
        mix-blend-mode:screen;opacity:0}
      #s12-root .lines{position:absolute;left:0;right:0;top:614px;text-align:center}
      #s12-root .gl{font-size:90px;line-height:1.08;margin-bottom:2px}
      #s12-root .kick{position:absolute;left:0;right:0;top:934px;text-align:center;
        font-family:'Azeret Mono',monospace;font-size:25px;letter-spacing:.14em;
        color:rgba(244,239,230,.92);text-shadow:0 2px 16px rgba(3,7,18,.78)}
      #s12-root .bcard{position:absolute;width:404px;padding:17px 20px;border-radius:20px;
        background:rgba(6,12,28,.50);border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(16px);
        display:flex;gap:14px;align-items:flex-start;will-change:transform,opacity}
      #s12-root .bcard .ic{width:36px;height:36px;border-radius:10px;flex:0 0 auto;display:flex;
        align-items:center;justify-content:center;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.14)}
      #s12-root .bcard .ic i{display:block;width:20px;height:20px;background-position:center;
        background-repeat:no-repeat;background-size:contain}
      #s12-root .bcard .ti{font-size:18px;font-weight:700;color:#fff}
      #s12-root .bcard .sb{font-family:'Azeret Mono',monospace;font-size:13px;line-height:1.5;
        color:rgba(244,239,230,.74);margin-top:3px}
      #s12-root .c0{left:84px;top:176px}
      #s12-root .c1{left:1432px;top:262px}
      #s12-root .c2{left:84px;top:404px}"""

LINES=['Your agent,','your RL environment,','your model, your weights.']
lines="".join(f'<div data-hf-id="hf-s12l{i}" class="giant gl" id="s12-l{i}">'
              + "".join(f'<span data-hf-id="hf-s12w{i}{j}" class="w">{w}&nbsp;</span>' for j,w in enumerate(t.split()))
              + '</div>' for i,t in enumerate(LINES))
cards="".join(f'<div data-hf-id="hf-s12c{i}" class="bcard c{i}" id="s12-c{i}">'
              f'<div data-hf-id="hf-s12ci{i}" class="ic"><i data-hf-id="hf-s12cg{i}" style="background-image:url(&quot;logos/{g}&quot;)"></i></div>'
              f'<div data-hf-id="hf-s12cw{i}"><div data-hf-id="hf-s12ct{i}" class="ti">{t}</div>'
              f'<div data-hf-id="hf-s12cs{i}" class="sb">{s}</div></div></div>' for i,(t,s,g) in enumerate(CARDS))

BODY = f"""    <div data-hf-id="hf-s12frame" class="frame clip" id="s12-frame" data-layout-allow-overflow="" data-start="0" data-duration="6.293" data-track-index="1">
      <div data-hf-id="hf-s12st" class="stage" id="s12-stage">
        <div data-hf-id="hf-s12ig" class="iconglow" id="s12-iconglow"></div>
        <div data-hf-id="hf-s12iw" class="iconwrap" id="s12-iconwrap">
          {P.inline_icon('s12icon', 430)}
          <div data-hf-id="hf-s12gt" class="glint" id="s12-glint"></div>
        </div>
        <div data-hf-id="hf-s12ln" class="lines" id="s12-lines">{lines}</div>
        <div data-hf-id="hf-s12kk" class="kick" id="s12-kick">air, your guardian angel</div>
        {cards}
      </div>
      <div data-hf-id="hf-s12hf" class="hitflash" id="s12-hitflash"></div>
    </div>"""

SCRIPT = P.FX_JS + """
      var stage=$('#s12-stage'), hf=$('#s12-hitflash');
      var iconw=$('#s12-iconwrap'), glow=$('#s12-iconglow'), glint=$('#s12-glint');
      var waves=$$('#s12icon-air-waves path');
      var lines=[$$('#s12-l0 .w'),$$('#s12-l1 .w'),$$('#s12-l2 .w')];
      var cards=[$('#s12-c0'),$('#s12-c1'),$('#s12-c2')];

      gsap.set(hf,{opacity:0});
      gsap.set(stage,{scale:1.0,transformOrigin:'50% 44%'});
      gsap.set(iconw,{autoAlpha:0,scale:1.22,y:-18,transformOrigin:'50% 50%'});
      gsap.set(glow,{autoAlpha:0,scale:.82,transformOrigin:'50% 50%'});
      gsap.set(glint,{xPercent:-130,opacity:0});
      lines.forEach(function(ws){ gsap.set(ws,{y:'0.6em',autoAlpha:0,rotationX:24,transformOrigin:'50% 80%'}); });
      gsap.set('#s12-kick',{autoAlpha:0,y:12});
      gsap.set(cards,{autoAlpha:0,y:22,scale:.96,transformOrigin:'50% 50%'});

      // 89.536 — the DROP at 90 is the film's one breath, and the product sits in it.
      tl.to(iconw,{autoAlpha:1,scale:1,y:0,duration:1.05,ease:'expo.out'},0);
      tl.to(glow,{autoAlpha:1,scale:1,duration:1.2,ease:'expo.out'},0);
      hit(tl,stage,0,{amt:.026,flash:hf,flashAmt:.14,flashD:.30});
      // the glass catches the light once, on the way in
      tl.fromTo(glint,{xPercent:-130,opacity:.9},{xPercent:130,opacity:0,duration:1.0,ease:'power2.inOut'},.30);
      // the waves inside the mark drift for the whole shot: the thing is alive, not a logo plate
      waves.forEach(function(w,i){
        gsap.set(w,{transformOrigin:'50% 50%'});
        tl.fromTo(w,{x:-16-i*6},{x:16+i*6,duration:6.2,ease:'sine.inOut'},0);
      });
      // one slow push all the way through, so the frame never sits still
      cam(tl,stage,0,{scale:1.035,d:6.2,e:'none'});

      // 91.092 / 92.671 / 94.273 — one clause per downbeat; the icon answers each one
      [1.556,3.135,4.737].forEach(function(t,i){
        tl.to(lines[i],{y:0,autoAlpha:1,rotationX:0,duration:.74,ease:'expo.out',stagger:.045},t);
        if(i>0) tl.to(lines[i-1],{autoAlpha:.34,filter:'blur(2px)',duration:.5,ease:'power2.out'},t);
        tl.to(iconw,{scale:1.028,duration:.10,ease:'power2.out'},t);
        tl.to(iconw,{scale:1,duration:.62,ease:'power2.out'},t+.10);
        tl.to(glow,{opacity:.85,duration:.10,ease:'power2.out'},t);
        tl.to(glow,{opacity:.55,duration:.62,ease:'power2.out'},t+.10);
        hit(tl,stage,t,{amt:.012});
      });
      // 94.767 — the claim is one sentence, so it has to exist as one. The focus pull that
      // carried each clause in releases on the kicker: all three come back to full and sharp,
      // and the film's identity line finally reads as a block.
      tl.to(lines,{autoAlpha:1,filter:'blur(0px)',duration:.46,ease:'power2.out'},5.231);
      tl.to('#s12-kick',{autoAlpha:1,y:0,duration:.56,ease:'expo.out'},5.503);

      // the backend, stated once, at the edges where it belongs
      [0.52,1.20,1.94].forEach(function(t,i){
        tl.to(cards[i],{autoAlpha:.92,y:0,scale:1,duration:.70,ease:'expo.out'},t);
      });
      tl.to(cards,{y:-14,duration:5.2,ease:'none'},.6);

      // hard cut into the montage
      tl.to([iconw,glow],{autoAlpha:0,scale:.94,duration:.28,ease:'power4.in'},5.99);
      tl.to(['#s12-lines','#s12-kick'],{x:-230,autoAlpha:0,duration:.30,ease:'power4.in'},5.99);
      tl.to(cards,{autoAlpha:0,x:-120,duration:.26,ease:'power4.in'},5.99);"""
print(P.emit('compositions/shot-12-yours.html','shot-12-yours','s12',6.293,STYLE,BODY,SCRIPT))
