import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
import parts as P
R='s05-root'
RING1=['gmail.svg','slack.svg','notion.svg','shopify.svg','stripe.svg','github.svg','figma.svg','spotify.svg','drive.svg','calendar.svg']
RING2=['instagram.svg','x.svg','tiktok.svg','youtube.svg','discord.svg','telegram.svg','whatsapp.svg','reddit.svg']
RING3=['salesforce.svg','hubspot.svg','jira.svg','asana.svg','quickbooks.svg','square.svg']
STYLE = P.FONTS + "\n" + P.tokens(R) + """
      #s05-root .ring{position:absolute;left:0;top:0;width:1920px;height:1080px}
      #s05-root .lg{position:absolute;left:0;top:0;width:96px;height:96px;border-radius:24px;
        background:rgba(9,15,32,.60);border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(12px);
        display:flex;align-items:center;justify-content:center;will-change:transform,opacity}
      #s05-root .lg i{display:block;width:48px;height:48px;background-position:center;background-repeat:no-repeat;background-size:contain}
      #s05-root .num{position:absolute;left:0;right:0;top:392px;text-align:center;font-family:'Azeret Mono',monospace;
        font-weight:500;font-size:216px;letter-spacing:-.05em;color:var(--ink);text-shadow:0 6px 44px rgba(3,7,18,.6)}
      #s05-root .cap{position:absolute;left:0;right:0;top:856px;text-align:center}
      /* the silhouette of the phone shot 06 opens with: the ring collapses into this shape,
         and the next composition picks it up at exactly this rect */
      #s05-root .seed{position:absolute;left:470px;top:103px;width:402px;height:874px;border-radius:56px;
        background:linear-gradient(160deg,#3a3f4a 0%,#171b22 38%,#0f1218 100%);
        box-shadow:0 60px 120px rgba(2,6,18,.62);will-change:transform,opacity}"""
def ring(idx, names, start):
    return "".join(f'<div data-hf-id="hf-s05r{idx}{i}" class="lg" id="s05-l{start+i}">'
                   f'<i data-hf-id="hf-s05i{idx}{i}" style="background-image:url(&quot;logos/{n}&quot;)"></i></div>'
                   for i,n in enumerate(names))
ALL = ring(0,RING1,0)+ring(1,RING2,len(RING1))+ring(2,RING3,len(RING1)+len(RING2))
BODY = f"""    <div data-hf-id="hf-s05frame" class="frame clip" id="s05-frame" data-layout-allow-overflow="" data-start="0" data-duration="6.223" data-track-index="1">
      <div data-hf-id="hf-s05wa" class="wash"></div>
      <div data-hf-id="hf-s05rg" class="ring" id="s05-ring">{ALL}</div>
      <div data-hf-id="hf-s05sd" class="seed" id="s05-seed"></div>
      <div data-hf-id="hf-s05nm" class="num" id="s05-num">0</div>
      <div data-hf-id="hf-s05cp" class="cap" id="s05-cap">connect your apps — across 1000+ apps.</div>
    </div>"""
SCRIPT = f"""      var R1={len(RING1)}, R2={len(RING2)}, R3={len(RING3)};
      var rings=[[R1,645,262,-90],[R2,905,348,18],[R3,1130,198,54]];
      var els=[]; for(var i=0;i<R1+R2+R3;i++) els.push($('#s05-l'+i));
      var CX=960, CY=496;
      // three concentric rings of real connectors; each advances one slot on a downbeat
      function seat(i, step){{
        var o=0, ri=0;
        for(var r=0;r<rings.length;r++){{ if(i<o+rings[r][0]){{ ri=r; break; }} o+=rings[r][0]; }}
        var n=rings[ri][0], k=i-o, RX=rings[ri][1], RY=rings[ri][2], ph=rings[ri][3]*Math.PI/180;
        var dir=(ri===1)?-1:1;
        var a=(k/n)*Math.PI*2 + ph + dir*step*(Math.PI*2/n);
        var d=(Math.sin(a)+1)/2;
        return {{x:CX+RX*Math.cos(a)-48, y:CY+RY*Math.sin(a)-48, scale:.66+.44*d, autoAlpha:.30+.62*d}};
      }}
      els.forEach(function(e,i){{ gsap.set(e,{{x:CX-48,y:CY-48,scale:.06,autoAlpha:0,transformOrigin:'50% 50%'}}); }});
      gsap.set('#s05-cap',{{autoAlpha:0,y:16}});
      gsap.set('#s05-seed',{{autoAlpha:0,scale:.08,x:13,y:-40,transformOrigin:'50% 50%'}});
      var n={{v:0}}, numEl=$('#s05-num');
      gsap.set(numEl,{{autoAlpha:0,scale:.9,transformOrigin:'50% 50%'}});

      // 39.590 — the ring blooms out of the point shot 04 collapsed into
      els.forEach(function(e,i){{
        var p=seat(i,0);
        tl.to(e,{{x:p.x,y:p.y,scale:p.scale,autoAlpha:p.autoAlpha,duration:.70,ease:'expo.out'}},0.02+i*.016);
      }});
      tl.to(numEl,{{autoAlpha:1,scale:1,duration:.5,ease:'expo.out'}},.30);
      // 39.962 -> 44.257 — the count lands exactly on the downbeat, then stops dead
      tl.to(n,{{v:1000,duration:4.30,ease:'power2.out',onUpdate:function(){{
        numEl.textContent = Math.round(n.v).toLocaleString('en-US');
      }}}},.372);
      tl.set(numEl,{{textContent:'1,000+'}},4.667);
      tl.to(numEl,{{scale:1.04,duration:.12,ease:'power2.out'}},4.667);
      tl.to(numEl,{{scale:1,duration:.4,ease:'power2.inOut'}},4.787);
      tl.to('#s05-cap',{{autoAlpha:1,y:0,duration:.60,ease:'expo.out'}},4.667);
      // 41.146 / 42.701 — one slot per downbeat, nothing else moves
      [1.556,3.111].forEach(function(t,k){{
        els.forEach(function(e,i){{
          var p=seat(i,k+1);
          tl.to(e,{{x:p.x,y:p.y,scale:p.scale,autoAlpha:p.autoAlpha,duration:.78,ease:'expo.out'}},t);
        }});
      }});
      // 45.813 — everything converges on the phone shot 06 opens with
      tl.to(els,{{x:684,y:500,scale:.10,autoAlpha:0,duration:.34,ease:'power3.in'}},5.88);
      tl.to(['#s05-num','#s05-cap'],{{autoAlpha:0,scale:.92,duration:.26,ease:'power4.in'}},5.78);
      tl.to('#s05-seed',{{autoAlpha:1,scale:1.06,x:0,y:0,duration:.30,ease:'expo.out'}},5.92);"""
print(P.emit('compositions/shot-05-connect-apps.html','shot-05-connect-apps','s05',6.223,STYLE,BODY,SCRIPT))
