import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
import parts as P
R='s04-root'
TILES=[('spotify.svg','listening'),('strava.svg','training'),('netflix.svg','watching'),('notion.svg','notes'),
       ('youtube.svg','watching'),('duolingo.svg','learning'),('peloton.svg','training'),('calendar.svg','calendar')]
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.fx_css(R) + """
      #s04-root .hub{position:absolute;left:760px;top:330px;width:400px;text-align:center;will-change:transform,opacity}
      #s04-root .hub .av{width:190px;height:190px;border-radius:50%;margin:0 auto;display:block;
        background:url('logos/onairos-avatar.png') center/cover no-repeat;
        box-shadow:0 26px 60px rgba(4,12,34,.55),0 0 0 1px rgba(255,255,255,.14)}
      #s04-root .hub .nm{margin-top:20px;font-family:'Azeret Mono',monospace;font-size:20px;letter-spacing:.06em;
        color:var(--ink);text-shadow:0 2px 14px rgba(3,7,18,.6)}
      #s04-root .tile{position:absolute;left:0;top:0;width:128px;will-change:transform,opacity}
      #s04-root .tile .sq{width:128px;height:128px;border-radius:30px;background:rgba(9,15,32,.62);
        border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center}
      #s04-root .tile .sq .lg{width:62px;height:62px;background-position:center;background-repeat:no-repeat;background-size:contain}
      #s04-root .tile .lb{margin-top:9px;text-align:center;font-family:'Azeret Mono',monospace;letter-spacing:.04em;color:rgba(244,239,230,.86);font-size:15px;text-shadow:0 2px 12px rgba(3,7,18,.7)}
      #s04-root .cap{position:absolute;left:0;right:0;top:856px;text-align:center}
      #s04-root .flash{position:absolute;inset:0;background:#DCE9FF;opacity:0}"""
tiles="".join(f'<div data-hf-id="hf-s04t{i}" class="tile" id="s04-t{i}"><div data-hf-id="hf-s04q{i}" class="sq">'
               f'<div data-hf-id="hf-s04g{i}" class="lg" style="background-image:url(&quot;logos/{f}&quot;)"></div></div>'
               f'<div data-hf-id="hf-s04l{i}" class="lb">{l}</div></div>' for i,(f,l) in enumerate(TILES))
BODY = f"""    <div data-hf-id="hf-s04frame" class="frame clip" id="s04-frame" data-layout-allow-overflow="" data-start="0" data-duration="6.246" data-track-index="1">
      <div data-hf-id="hf-s04stg" class="stage" id="s04-stage">
      <div data-hf-id="hf-s04wa" class="wash"></div>
      <div data-hf-id="hf-s04ts" class="plane" id="s04-tiles">{tiles}</div>
      <div data-hf-id="hf-s04hb" class="hub" id="s04-hub"><div data-hf-id="hf-s04av" class="av"></div>
        <div data-hf-id="hf-s04nm" class="nm">ONAIROS PERSONA</div></div>
      <div data-hf-id="hf-s04cp" class="cap" id="s04-cap">hyperpersonalization.</div>
      <div data-hf-id="hf-s04fl" class="flash" id="s04-flash"></div>
      </div>
      <div data-hf-id="hf-s04hf" class="hitflash" id="s04-hitflash"></div>
    </div>"""
SCRIPT = P.FX_JS + """
      var stage=$('#s04-stage'), hf=$('#s04-hitflash');
      gsap.set(hf,{opacity:0});
      gsap.set(stage,{scale:1.0,transformOrigin:'50% 50%'});
      hit(tl,stage,0.0,{amt:.028});
      hit(tl,stage,1.556,{amt:.016});
      hit(tl,stage,3.135,{amt:.016});
      hit(tl,stage,4.714,{amt:.016});
      cam(tl,stage,0.10,{scale:1.035,d:5.8,e:'none'});
      var tiles=[0,1,2,3,4,5,6,7].map(function(i){return $('#s04-t'+i);});
      var CX=960, CY=470, RX=645, RY=238, N=8;
      // Depth is read off sin(angle): tiles behind the persona shrink, dim and blur; tiles in
      // front pass over it. The ellipse is fixed, so every seek lands on the same pose.
      function pose(i, step){
        var a=(i/N)*Math.PI*2 + step*(Math.PI*2/N) - Math.PI/2;
        var d=(Math.sin(a)+1)/2;
        return {x:CX+RX*Math.cos(a)-64, y:CY+RY*Math.sin(a)-64,
                scale:.62+.52*d, autoAlpha:.34+.66*d, filter:'blur('+((1-d)*3.2).toFixed(2)+'px)'};
      }
      tiles.forEach(function(t,i){ var p=pose(i,0); gsap.set(t,{x:p.x,y:p.y,scale:p.scale*.72,autoAlpha:0,filter:p.filter,transformOrigin:'50% 50%'}); });
      gsap.set('#s04-hub',{autoAlpha:0,scale:.9,transformOrigin:'50% 50%'});
      gsap.set('#s04-cap',{autoAlpha:0,y:16});
      gsap.set('#s04-flash',{opacity:0});

      // 33.344 — the persona lands first: everything else is what it already knows about you
      tl.to('#s04-hub',{autoAlpha:1,scale:1,duration:.66,ease:'expo.out'},0);
      tl.to('#s04-cap',{autoAlpha:1,y:0,duration:.60,ease:'expo.out'},.22);
      tiles.forEach(function(t,i){
        var p=pose(i,0);
        tl.to(t,{x:p.x,y:p.y,scale:p.scale,autoAlpha:p.autoAlpha,duration:.62,ease:'expo.out'},.10+i*.045);
      });
      // 34.900 / 36.479 / 38.058 — one slot per downbeat, and only on the downbeat
      [1.556,3.135,4.714].forEach(function(t,k){
        tiles.forEach(function(el,i){
          var p=pose(i,k+1);
          tl.to(el,{x:p.x,y:p.y,scale:p.scale,autoAlpha:p.autoAlpha,filter:p.filter,duration:.74,ease:'expo.out'},t);
        });
        tl.to('#s04-hub',{scale:1.03,duration:.14,ease:'power2.out'},t);
        tl.to('#s04-hub',{scale:1,duration:.5,ease:'power2.inOut'},t+.14);
      });
      // 39.590 — the hand-off: the orbit collapses to the ring shot 05 blooms back out of
      tl.to(tiles,{x:896,y:470,scale:.12,autoAlpha:0,duration:.30,ease:'power3.in'},5.95);
      tl.to(['#s04-hub','#s04-cap'],{autoAlpha:0,x:-230,duration:.30,ease:'power4.in'},5.95);
      tl.fromTo('#s04-flash',{opacity:0},{opacity:.30,duration:.10,ease:'power2.out'},6.14);"""
print(P.emit('compositions/shot-04-hyperpersonal.html','shot-04-hyperpersonal','s04',6.246,STYLE,BODY,SCRIPT))
