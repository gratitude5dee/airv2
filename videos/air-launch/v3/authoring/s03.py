import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P
R='s03-root'
NOUNS=[('a phone.','glyph-phone.svg','text it like a friend — it answers on iMessage.'),
       ('an email.','glyph-mail.svg','its own email address, working around the clock.'),
       ('a wallet.','glyph-wallet.svg',None),
       ('an encrypted key vault.','glyph-vault.svg',None),
       ('a composable computer.','glyph-computer.svg','a real machine that remembers everything for you.')]
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.fx_css(R) + "\n" + P.TYPER_CSS.replace('%R%',R) + """
      #s03-root .flash{position:absolute;inset:0;background:#FFF6E6;opacity:0}
      /* LIGHT RAYS (React Bits) — the crest throws light instead of only brightening. The
         fan is anchored on the horizon behind the word, so the beams rake up past it. */
      #s03-root .rays{left:960px;top:640px;width:0;height:0}
      #s03-root .rayglow{left:460px;top:300px;width:1000px;height:680px}

      #s03-root .airbig{position:absolute;left:0;right:0;top:238px;text-align:center;font-family:'Newsreader',Georgia,serif;
        font-weight:200;font-size:452px;letter-spacing:-.05em;line-height:1;color:#FFFBF2}
      #s03-root .airmark{position:absolute;left:104px;top:72px;font-family:'Newsreader',Georgia,serif;font-weight:300;
        font-size:72px;letter-spacing:-.03em;color:var(--ink);opacity:.92;text-shadow:0 3px 20px rgba(3,7,18,.5)}
      #s03-root .hero{position:absolute;left:180px;right:180px;top:268px;text-align:center;will-change:transform,opacity}
      #s03-root .hero .gl{width:132px;height:132px;display:block;margin:0 auto 38px;overflow:visible}
      #s03-root .hero .nm{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:176px;letter-spacing:-.038em;
        line-height:.94;color:var(--ink);text-shadow:0 4px 34px rgba(3,7,18,.55)}
      #s03-root .hero .sl{margin-top:34px;font-family:'Azeret Mono',monospace;font-size:27px;letter-spacing:.02em;
        color:rgba(244,239,230,.92);text-shadow:0 2px 16px rgba(3,7,18,.62)}
      #s03-root .chips{position:absolute;left:0;right:0;top:884px;display:flex;align-items:center;justify-content:center;gap:22px}
      #s03-root .chip{display:flex;align-items:center;gap:11px;padding:12px 21px;border-radius:999px;
        border:1px solid rgba(255,255,255,.20);background:rgba(4,9,22,.46);backdrop-filter:blur(10px);
        will-change:transform,opacity}
      #s03-root .chip svg{width:26px;height:26px;display:block;flex:0 0 auto}
      #s03-root .chip span{font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:31px;letter-spacing:-.01em;
        color:var(--ink);opacity:.96;white-space:nowrap}
      #s03-root .gs{stroke:#F4EFE6}"""

heroes = "\n".join(
  f'        <div data-hf-id="hf-s03h{i}" class="hero" id="s03-h{i}">{P.inline_glyph(g,"gl",f"s03-hg{i}",1.3)}'
  f'<div data-hf-id="hf-s03n{i}" class="nm">{n}</div>'
  + (f'<div data-hf-id="hf-s03s{i}" class="sl">{P.typer(f"s03-t{i}", s)}</div>' if s else '')
  + '</div>' for i,(n,g,s) in enumerate(NOUNS))
chips = "".join(
  f'<div data-hf-id="hf-s03c{i}" class="chip" id="s03-c{i}">{P.inline_glyph(g,"",f"s03-cg{i}",1.9)}'
  f'<span data-hf-id="hf-s03ct{i}">{n[:-1]}</span></div>' for i,(n,g,s) in enumerate(NOUNS))

BODY = f"""    <div data-hf-id="hf-s03frame" class="frame clip" id="s03-frame" data-layout-allow-overflow="" data-start="0" data-duration="8.986" data-track-index="1">
      <div data-hf-id="hf-s03wa" class="wash"></div>
      <div data-hf-id="hf-s03st" class="stage" id="s03-stage">
        <div data-hf-id="hf-s03rg" class="rayglow" id="s03-rayglow" data-layout-ignore=""></div>
        {P.light_rays('s03-rays', n=11, w=150, h=1240, spread=96)}
        <div data-hf-id="hf-s03ab" class="airbig" id="s03-airbig">{P.cg('s03-cgair','air')}</div>
        <div data-hf-id="hf-s03am" class="airmark" id="s03-airmark">air</div>
{heroes}
        <div data-hf-id="hf-s03ch" class="chips" id="s03-chips">{chips}</div>
      </div>
      <div data-hf-id="hf-s03hf" class="hitflash" id="s03-hitflash"></div>
      <div data-hf-id="hf-s03fl" class="flash" id="s03-flash"></div>
    </div>"""

SCRIPT = P.FX_JS + P.TYPER_JS + """
      var stage=$('#s03-stage'), hf=$('#s03-hitflash');
      var heroes=[0,1,2,3,4].map(function(i){return $('#s03-h'+i);});
      var chips=[0,1,2,3,4].map(function(i){return $('#s03-c'+i);});
      var big=$('#s03-airbig'), mark=$('#s03-airmark');

      function armStrokes(node){
        var gs=Array.prototype.slice.call(node.querySelectorAll('.gs'));
        gs.forEach(function(g){
          var len=(g.getTotalLength?g.getTotalLength():120)||120;
          gsap.set(g,{strokeDasharray:len,strokeDashoffset:len});
        });
        return gs;
      }
      gsap.set('#s03-flash',{opacity:0});
      gsap.set(hf,{opacity:0});
      gsap.set(big,{autoAlpha:0,scale:1.16,transformOrigin:'50% 50%'});
      cgSet('s03-cgair',0);
      gsap.set(mark,{autoAlpha:0,y:12});
      heroes.forEach(function(h){ gsap.set(h,{autoAlpha:0,x:240,scale:.96}); });
      chips.forEach(function(c){ gsap.set(c,{autoAlpha:0,scale:.82,transformOrigin:'50% 50%'}); armStrokes(c); });
      var heroStrokes=heroes.map(function(h){ return armStrokes(h); });
      gsap.set(stage,{scale:1.0,transformOrigin:'50% 50%'});

      // 24.358 — THE CRASH. The sun crests behind, the frame takes a near-white hit, and the
      // name arrives at the size of the whole screen with its colour pulled apart at the edges.
      tl.fromTo('#s03-flash',{opacity:.92},{opacity:0,duration:.34,ease:'power2.out'},0);
      // the sun crests and throws a fan of light up through the word
      gsap.set('#s03-rays',{rotation:180,transformOrigin:'50% 0%'});
      gsap.set('#s03-rayglow',{opacity:0,scale:.7,transformOrigin:'50% 62%'});
      raysOpen(tl,'s03-rays',0,{peak:.66,d:1.00,step:.030,hold:4.4,out:1.10});
      tl.to('#s03-rayglow',{opacity:.72,scale:1,duration:1.10,ease:'expo.out'},0);
      tl.to('#s03-rayglow',{opacity:.34,scale:1.10,duration:4.6,ease:'sine.inOut'},1.10);
      tl.to('#s03-rayglow',{opacity:0,duration:1.20,ease:'power2.in'},5.70);
      tl.to(big,{autoAlpha:1,scale:1,duration:.90,ease:'expo.out'},0);
      cgPulse(tl,'s03-cgair',0,44,1.10);
      hit(tl,stage,0,{amt:.055,shake:9});
      cam(tl,stage,0,{scale:1.0,d:1.2,e:'expo.out'});
      // 25.310 — the bass snare re-opens the split for one beat
      cgPulse(tl,'s03-cgair',.952,22,.60);
      hit(tl,stage,.952,{amt:.024});

      // 25.496 — the kick. The name snaps to the corner and the endowments start landing.
      tl.to(big,{scale:.16,x:-720,y:-368,autoAlpha:0,duration:.26,ease:'power3.in'},1.138);
      tl.to(mark,{autoAlpha:1,y:0,duration:.30,ease:'expo.out'},1.30);

      var AT=[1.138,2.716,4.272,5.851,7.384];
      AT.forEach(function(t,i){
        tl.to(heroes[i],{autoAlpha:1,x:0,scale:1,duration:.60,ease:'expo.out'},t);
        tl.to(heroStrokes[i],{strokeDashoffset:0,duration:.44,ease:'power2.out',stagger:.05},t+.04);
        hit(tl,stage,t,{amt:i===0?.034:.020,flash:i===0?hf:null,flashAmt:.14,flashD:.22});
        var out=(i<4)?AT[i+1]-.24:8.60;
        tl.to(heroes[i],{autoAlpha:0,scale:.46,y:330,duration:.24,ease:'power3.in'},out);
        tl.to(chips[i],{autoAlpha:1,scale:1,duration:.34,ease:'expo.out'},out+.10);
        tl.to(chips[i].querySelectorAll('.gs'),{strokeDashoffset:0,duration:.28,ease:'power2.out'},out+.10);
      });
      // the three sublines type themselves in, letter by letter, on the Arlan wave
      typerWave(tl,'s03-t0',1.36,.020);
      typerWave(tl,'s03-t1',2.94,.020);
      typerWave(tl,'s03-t4',7.60,.020);

      // a slow push through the whole drop, then the exit vector
      cam(tl,stage,1.138,{scale:1.035,d:6.6,e:'none'});
      tl.to(['#s03-chips','#s03-airmark'],{x:-230,autoAlpha:0,duration:.32,ease:'power4.in'},8.66);"""
print(P.emit('compositions/shot-03-drop.html','shot-03-drop','s03',8.986,STYLE,BODY,SCRIPT))
