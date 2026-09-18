import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
import parts as P
R='s03-root'
NOUNS=[('a phone.','glyph-phone.svg','text it like a friend — it answers on iMessage.'),
       ('an email.','glyph-mail.svg','its own email address, working around the clock.'),
       ('a wallet.','glyph-wallet.svg',None),
       ('an encrypted key vault.','glyph-vault.svg',None),
       ('a composable computer.','glyph-computer.svg','a real machine that remembers everything for you.')]
STYLE = P.FONTS + "\n" + P.tokens(R) + """
      #s03-root .flash{position:absolute;inset:0;background:#F7EFE2;opacity:0}
      #s03-root .airmark{position:absolute;left:96px;top:74px;font-family:'Newsreader',Georgia,serif;font-weight:300;
        font-size:64px;letter-spacing:-.03em;color:var(--ink);opacity:.9}
      #s03-root .airbig{position:absolute;left:0;right:0;top:322px;text-align:center;font-family:'Newsreader',Georgia,serif;
        font-weight:300;font-size:420px;letter-spacing:-.045em;line-height:1;color:var(--ink);text-shadow:0 6px 44px rgba(3,7,18,.5)}
      #s03-root .airbig span{display:inline-block;will-change:opacity,transform}
      #s03-root .hero{position:absolute;left:260px;right:260px;top:300px;text-align:center;will-change:transform,opacity}
      #s03-root .hero .gl{width:112px;height:112px;display:block;margin:0 auto 34px;overflow:visible}
      #s03-root .hero .nm{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:148px;letter-spacing:-.035em;
        line-height:.94;color:var(--ink);text-shadow:0 3px 28px rgba(3,7,18,.55)}
      #s03-root .hero .sl{margin-top:26px;font-family:'Azeret Mono',monospace;font-size:25px;letter-spacing:.02em;
        color:var(--ink-dim)}
      #s03-root .chips{position:absolute;left:0;right:0;top:880px;display:flex;align-items:center;justify-content:center;gap:24px}
      #s03-root .chip{display:flex;align-items:center;gap:11px;padding:11px 20px;border-radius:999px;
        border:1px solid rgba(255,255,255,.18);background:rgba(4,9,22,.42);backdrop-filter:blur(10px);
        will-change:transform,opacity}
      #s03-root .chip svg{width:26px;height:26px;display:block;flex:0 0 auto}
      #s03-root .chip span{font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:30px;letter-spacing:-.01em;
        color:var(--ink);opacity:.94;white-space:nowrap}
      #s03-root .gs{stroke:#F4EFE6}"""

heroes = "\n".join(
  f'      <div data-hf-id="hf-s03h{i}" class="hero" id="s03-h{i}">{P.inline_glyph(g,"gl",f"s03-hg{i}",1.35)}'
  f'<div data-hf-id="hf-s03n{i}" class="nm">{n}</div>'
  + (f'<div data-hf-id="hf-s03s{i}" class="sl">{s}</div>' if s else '')
  + '</div>' for i,(n,g,s) in enumerate(NOUNS))
chips = "".join(
  f'<div data-hf-id="hf-s03c{i}" class="chip" id="s03-c{i}">{P.inline_glyph(g,"",f"s03-cg{i}",1.9)}'
  f'<span data-hf-id="hf-s03ct{i}">{n[:-1]}</span></div>' for i,(n,g,s) in enumerate(NOUNS))

BODY = f"""    <div data-hf-id="hf-s03frame" class="frame clip" id="s03-frame" data-layout-allow-overflow="" data-start="0" data-duration="8.986" data-track-index="1">
      <div data-hf-id="hf-s03wa" class="wash"></div>
      <div data-hf-id="hf-s03ab" class="airbig" id="s03-airbig"><span data-hf-id="hf-s03a1">a</span><span data-hf-id="hf-s03a2">i</span><span data-hf-id="hf-s03a3">r</span></div>
      <div data-hf-id="hf-s03am" class="airmark" id="s03-airmark">air</div>
{heroes}
      <div data-hf-id="hf-s03ch" class="chips" id="s03-chips">{chips}</div>
      <div data-hf-id="hf-s03fl" class="flash" id="s03-flash"></div>
    </div>"""

SCRIPT = """      var heroes=[0,1,2,3,4].map(function(i){return $('#s03-h'+i);});
      var chips=[0,1,2,3,4].map(function(i){return $('#s03-c'+i);});
      var big=$$('#s03-airbig span'), mark=$('#s03-airmark');

      // draw-on for every glyph stroke, measured from the real geometry
      function armStrokes(node){
        var gs=Array.prototype.slice.call(node.querySelectorAll('.gs'));
        gs.forEach(function(g){
          var len=(g.getTotalLength?g.getTotalLength():120)||120;
          gsap.set(g,{strokeDasharray:len,strokeDashoffset:len});
        });
        return gs;
      }
      gsap.set('#s03-flash',{opacity:0});
      gsap.set(big,{autoAlpha:0,y:0});
      gsap.set(mark,{autoAlpha:0,y:10});
      heroes.forEach(function(h,i){ gsap.set(h,{autoAlpha:0,x:230,scale:.96}); });
      chips.forEach(function(c){ gsap.set(c,{autoAlpha:0,scale:.82,transformOrigin:'50% 50%'}); armStrokes(c); });
      var heroStrokes=heroes.map(function(h){ return armStrokes(h); });

      // 24.358 — the crash. The sky crests underneath; the frame takes one near-white hit.
      tl.fromTo('#s03-flash',{opacity:.85},{opacity:0,duration:.30,ease:'power2.out'},0);
      // the one soft entrance in the film: a single word, no movement, on the bass
      tl.to(big,{autoAlpha:1,duration:.46,ease:'power2.out',stagger:.07},.06);
      // 25.310 — the snare takes the word to the corner and the nouns start landing
      tl.to(big,{autoAlpha:0,scale:.28,y:-190,x:-560,duration:.26,ease:'power3.in'},.952);
      tl.to(mark,{autoAlpha:1,y:0,duration:.30,ease:'expo.out'},1.06);

      var AT=[1.138,2.716,4.272,5.851,7.384];
      AT.forEach(function(t,i){
        // the noun lands on its kick, its glyph draws itself over the next third of a bar
        tl.to(heroes[i],{autoAlpha:1,x:0,scale:1,duration:.58,ease:'expo.out'},t);
        tl.to(heroStrokes[i],{strokeDashoffset:0,duration:.42,ease:'power2.out',stagger:.05},t+.04);
        // then it demotes into the sentence assembling along the bottom
        var out=(i<4)?AT[i+1]-.22:8.62;
        tl.to(heroes[i],{autoAlpha:0,scale:.42,y:300,duration:.24,ease:'power3.in'},out);
        tl.to(chips[i],{autoAlpha:1,scale:1,duration:.34,ease:'expo.out'},out+.10);
        tl.to(chips[i].querySelectorAll('.gs'),{strokeDashoffset:0,duration:.28,ease:'power2.out'},out+.10);
      });

      // camera: a slow leftward drift all through the drop, then the film's exit vector
      tl.to('#s03-chips',{x:-16,duration:8.6,ease:'none'},0);
      tl.to(mark,{x:-14,duration:8.6,ease:'none'},0);
      tl.to(['#s03-chips','#s03-airmark'],{x:-230,autoAlpha:0,duration:.32,ease:'power4.in'},8.66);"""
print(P.emit('compositions/shot-03-endowments.html','shot-03-endowments','s03',8.986,STYLE,BODY,SCRIPT))
