import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
import parts as P
R='s12-root'
CARDS=[('Custom sandbox','Its own isolated machine, per person.','glyph-computer.svg'),
       ('Local task router','A custom quantized model, on the machine.','glyph-remote.svg'),
       ('Zero data retention','Clean, content-zero data retention.','glyph-vault.svg')]
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.fx_css(R) + """
      #s12-root .lines{position:absolute;left:150px;top:300px;width:1180px}
      #s12-root .gl{font-size:112px;margin-bottom:10px}
      #s12-root .kick{position:absolute;left:156px;top:664px;font-family:'Azeret Mono',monospace;font-size:27px;
        letter-spacing:.06em;color:rgba(244,239,230,.86);text-shadow:0 2px 16px rgba(3,7,18,.7)}
      #s12-root .cards{position:absolute;left:1362px;top:286px;width:440px}
      #s12-root .bcard{margin-bottom:18px;padding:20px 22px;border-radius:22px;background:rgba(6,12,28,.50);
        border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(16px);display:flex;gap:15px;align-items:flex-start;
        will-change:transform,opacity}
      #s12-root .bcard .ic{width:40px;height:40px;border-radius:11px;flex:0 0 auto;display:flex;align-items:center;
        justify-content:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13)}
      #s12-root .bcard .ic i{display:block;width:22px;height:22px;background-position:center;background-repeat:no-repeat;background-size:contain}
      #s12-root .bcard .ti{font-size:19px;font-weight:700;color:#fff}
      #s12-root .bcard .sb{font-family:'Azeret Mono',monospace;font-size:14px;line-height:1.5;
        color:rgba(244,239,230,.68);margin-top:4px}"""
LINES=['Your agent,','your RL environment,','your model, your weights.']
lines="".join(f'<div data-hf-id="hf-s12l{i}" class="giant gl" id="s12-l{i}">'
              + "".join(f'<span data-hf-id="hf-s12w{i}{j}" class="w">{w}&nbsp;</span>' for j,w in enumerate(t.split()))
              + '</div>' for i,t in enumerate(LINES))
cards="".join(f'<div data-hf-id="hf-s12c{i}" class="bcard" id="s12-c{i}">'
              f'<div data-hf-id="hf-s12ci{i}" class="ic"><i data-hf-id="hf-s12cg{i}" style="background-image:url(&quot;logos/{g}&quot;)"></i></div>'
              f'<div data-hf-id="hf-s12cw{i}"><div data-hf-id="hf-s12ct{i}" class="ti">{t}</div>'
              f'<div data-hf-id="hf-s12cs{i}" class="sb">{s}</div></div></div>' for i,(t,s,g) in enumerate(CARDS))
BODY = f"""    <div data-hf-id="hf-s12frame" class="frame clip" id="s12-frame" data-layout-allow-overflow="" data-start="0" data-duration="6.293" data-track-index="1">
      <div data-hf-id="hf-s12stg" class="stage" id="s12-stage">
      <div data-hf-id="hf-s12wa" class="washL"></div>
      <div data-hf-id="hf-s12ln" class="lines" id="s12-lines">{lines}</div>
      <div data-hf-id="hf-s12kk" class="kick" id="s12-kick">air, your guardian angel</div>
      <div data-hf-id="hf-s12cd" class="cards" id="s12-cards">{cards}</div>
      </div>
      <div data-hf-id="hf-s12hf" class="hitflash" id="s12-hitflash"></div>
    </div>"""
SCRIPT = P.FX_JS + """
      var stage=$('#s12-stage'), hf=$('#s12-hitflash');
      gsap.set(hf,{opacity:0});
      gsap.set(stage,{scale:1.0,transformOrigin:'50% 50%'});
      hit(tl,stage,0.0,{amt:.028});
      hit(tl,stage,1.556,{amt:.016});
      hit(tl,stage,3.135,{amt:.016});
      hit(tl,stage,4.737,{amt:.016});
      cam(tl,stage,0.10,{scale:1.035,d:5.8,e:'none'});
      var lines=[$$('#s12-l0 .w'),$$('#s12-l1 .w'),$$('#s12-l2 .w')];
      var cards=[$('#s12-c0'),$('#s12-c1'),$('#s12-c2')];
      lines.forEach(function(ws){ gsap.set(ws,{y:'0.6em',autoAlpha:0,rotationX:24,transformOrigin:'50% 80%'}); });
      gsap.set('#s12-kick',{autoAlpha:0,y:12});
      gsap.set(cards,{autoAlpha:0,x:60,transformOrigin:'50% 50%'});

      // 89.536 — the DROP at 90 is a breath. One clause per downbeat, nothing hurried.
      [1.556,3.135,4.737].forEach(function(t,i){
        tl.to(lines[i],{y:0,autoAlpha:1,rotationX:0,duration:.72,ease:'expo.out',stagger:.045},t);
        if(i>0) tl.to(lines[i-1],{autoAlpha:.34,filter:'blur(2px)',duration:.5,ease:'power2.out'},t);
      });
      tl.to('#s12-kick',{autoAlpha:1,y:0,duration:.52,ease:'expo.out'},5.039);
      // the backend, stated plainly and only once
      [0.62,2.20,3.78].forEach(function(t,i){
        tl.to(cards[i],{autoAlpha:1,x:0,duration:.66,ease:'expo.out'},t);
      });
      tl.to('#s12-cards',{y:-10,duration:5.0,ease:'none'},.62);
      tl.to(['#s12-lines','#s12-kick'],{x:-12,duration:6.0,ease:'none'},0);
      // hard cut into the montage
      tl.to(['#s12-lines','#s12-kick','#s12-cards'],{x:-230,autoAlpha:0,duration:.30,ease:'power4.in'},5.99);"""
print(P.emit('compositions/shot-12-yours.html','shot-12-yours','s12',6.293,STYLE,BODY,SCRIPT))
