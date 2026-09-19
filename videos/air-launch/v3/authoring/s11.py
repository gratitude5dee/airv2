import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P, mini_common as M
R='s11-root'; PFX='s11'
STYLE = M.base_style(R, """
      #s11-root .slash{top:250px;font-size:186px}
      /* the build, at the scale of the thing being built */
      #s11-root .build{position:absolute;left:236px;top:128px;width:1448px;border-radius:32px;padding:40px 46px 44px;
        background:rgba(6,12,28,.70);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(22px);
        box-shadow:0 54px 110px rgba(2,6,18,.62)}
      #s11-root .build .top{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:26px}
      #s11-root .build .nm{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:58px;color:var(--ink)}
      #s11-root .build .pc{font-family:'Azeret Mono',monospace;font-size:58px;color:var(--ink);
        font-variant-numeric:tabular-nums}
      #s11-root .build .bar{height:14px;border-radius:9px;background:rgba(255,255,255,.12);overflow:hidden}
      #s11-root .build .bar i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#2C7FE0,#6FB4FF);
        transform-origin:0% 50%;will-change:transform}
      #s11-root .build .log{margin-top:30px;height:236px;border-radius:18px;background:rgba(2,6,16,.58);
        border:1px solid rgba(255,255,255,.10);padding:20px 24px;overflow:hidden;
        font-family:'Azeret Mono',monospace;font-size:17px;line-height:1.95;color:rgba(244,239,230,.62)}
      #s11-root .build .log .ll{display:flex;gap:16px;will-change:transform,opacity}
      #s11-root .build .log .ll b{color:#6FB4FF;font-weight:500;min-width:112px;display:inline-block}
      #s11-root .build .log .ll i{font-style:normal;color:rgba(244,239,230,.86)}
      #s11-root .build .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:26px}
      #s11-root .build .st{display:flex;align-items:center;gap:12px;font-family:'Azeret Mono',monospace;font-size:19px;
        color:rgba(244,239,230,.58)}
      #s11-root .build .st .dot{width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.26);
        display:flex;align-items:center;justify-content:center;font-size:15px;color:#04240F;flex:0 0 auto}
      #s11-root .build .st.on .dot{background:#3FD877;border-color:#3FD877}
      #s11-root .build .st.on{color:var(--ink)}
      /* the app it built, full bleed */
      #s11-root .app{position:absolute;left:520px;top:96px;width:880px;height:888px;border-radius:40px;overflow:hidden;
        background:#0A0B10;border:1px solid rgba(255,255,255,.14);box-shadow:0 60px 120px rgba(2,6,18,.66)}
      #s11-root .app .gl{position:absolute;left:-30%;top:-26%;width:160%;height:78%;
        background:radial-gradient(50% 50% at 50% 50%,rgba(90,150,255,.34),rgba(90,150,255,0) 70%)}
      #s11-root .app .nv{position:absolute;top:46px;left:0;right:0;text-align:center;font-family:'Azeret Mono',monospace;
        font-size:17px;letter-spacing:.22em;color:rgba(244,239,230,.6)}
      #s11-root .app .in{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
        justify-content:center;padding:0 60px}
      #s11-root .app .ti{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:74px;line-height:1.04;
        color:#F4EFE6;text-align:center;margin-bottom:38px}
      #s11-root .app .cd{font-family:'Azeret Mono',monospace;font-size:86px;color:#fff;font-variant-numeric:tabular-nums}
      #s11-root .app .cl{font-family:'Azeret Mono',monospace;font-size:16px;letter-spacing:.3em;
        color:rgba(244,239,230,.52);margin-top:12px}
      #s11-root .app .bt{margin-top:48px;padding:20px 48px;border-radius:999px;background:#F4EFE6;color:#0A0B10;
        font-size:25px;font-weight:700}
      #s11-root .urlpill{position:absolute;left:0;right:0;top:1006px;text-align:center;font-family:'Azeret Mono',monospace;
        font-size:25px;letter-spacing:.05em;color:rgba(244,239,230,.86);text-shadow:0 2px 16px rgba(3,7,18,.7)}
      /* the decision, glossy and physical */
      #s11-root .dec{position:absolute;left:400px;top:318px;width:1120px;border-radius:32px;padding:38px 42px 40px;
        background:rgba(6,12,28,.74);border:1px solid rgba(255,255,255,.17);backdrop-filter:blur(22px);
        box-shadow:0 54px 110px rgba(2,6,18,.66)}
      #s11-root .dec .lb{font-family:'Azeret Mono',monospace;font-size:16px;letter-spacing:.14em;
        color:rgba(244,239,230,.62);margin-bottom:14px}
      #s11-root .dec .hh{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:64px;color:var(--ink);line-height:1.04}
      #s11-root .dec .sub{font-family:'Azeret Mono',monospace;font-size:19px;color:rgba(244,239,230,.76);margin-top:14px}
      #s11-root .dec .act{display:flex;gap:16px;margin-top:32px}
      #s11-root .dec .big3{flex:1;height:88px;border-radius:22px;display:flex;align-items:center;justify-content:center;
        font-size:27px;font-weight:700;will-change:transform}
      #s11-root .dec .gh{width:220px;height:88px;border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:23px}
      #s11-root .live{position:absolute;left:0;right:0;top:396px;text-align:center}
      #s11-root .live .l1{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:104px;color:var(--ink);line-height:1.02}
      #s11-root .live .l2{margin-top:26px;font-family:'Azeret Mono',monospace;font-size:28px;letter-spacing:.04em;color:#5BE585}
      #s11-root .live .l3{margin-top:14px;font-family:'Azeret Mono',monospace;font-size:19px;color:rgba(244,239,230,.72)}""")

ITEMS = f"""      var ITEMS=[
        {{kind:'sys', text:'Today · 9:44 AM', pre:true}},
        {{side:'recv', text:'the clip is in your camera roll.', pre:true, dim:true}},
        {{side:'sent', text:'got it', pre:true, dim:true}},
        {{side:'recv', text:'i can put it on the page too, once it exists.', pre:true, dim:true}},
        {{side:'recv', text:'here&rsquo;s the plan for &ldquo;October tour&rdquo; &rarr; link.wzrd.tech/gratitude/tour when it&rsquo;s ready.', pre:true, dim:true}},
        {{side:'recv', text:'reply yes to build, or tell me what to change.', pre:true, dim:true}},
        {{side:'sent', text:'make the countdown the hero. yes.'}},
        {{side:'recv', text:'Creating your app …'}}
      ];"""

STEPS=['plan approved','app scaffolded','kit resolved','deployed to dev']
steps=''.join(f'<div data-hf-id="hf-s11s{i}" class="st" id="s11-st{i}">'
              f'<div data-hf-id="hf-s11sd{i}" class="dot" id="s11-sd{i}">&check;</div>'
              f'<span data-hf-id="hf-s11sx{i}">{s}</span></div>' for i,s in enumerate(STEPS))

BODY = f"""    <div data-hf-id="hf-s11frame" class="frame clip" id="s11-frame" data-layout-allow-overflow="" data-start="0" data-duration="11.006" data-track-index="1">
      <div data-hf-id="hf-s11wa" class="washL"></div>
      <div data-hf-id="hf-s11wb" class="washR"></div>
      <div data-hf-id="hf-s11st" class="stage" id="s11-stage">
{M.right_plane(PFX,'/create','describe it. approve the plan. it ships.')}
{M.phone(PFX)}
        <div data-hf-id="hf-s11bd" class="build" id="s11-build">
          <div data-hf-id="hf-s11tp" class="top"><span data-hf-id="hf-s11nm" class="nm">October tour</span>
            <span data-hf-id="hf-s11pc" class="pc" id="s11-pct">10%</span></div>
          <div data-hf-id="hf-s11br" class="bar"><i data-hf-id="hf-s11bi" id="s11-bar"></i></div>
          <div data-hf-id="hf-s11lgw" class="log" id="s11-log"><div data-hf-id="hf-s11lg0" class="ll" id="s11-lg0"><b data-hf-id="hf-s11lb0">resolve</b><i data-hf-id="hf-s11li0">air-kit@12 · next · tailwind</i></div><div data-hf-id="hf-s11lg1" class="ll" id="s11-lg1"><b data-hf-id="hf-s11lb1">scaffold</b><i data-hf-id="hf-s11li1">app/page.tsx · countdown.tsx</i></div><div data-hf-id="hf-s11lg2" class="ll" id="s11-lg2"><b data-hf-id="hf-s11lb2">build</b><i data-hf-id="hf-s11li2">12 routes · 0 errors</i></div><div data-hf-id="hf-s11lg3" class="ll" id="s11-lg3"><b data-hf-id="hf-s11lb3">csp</b><i data-hf-id="hf-s11li3">policy ok · no inline script</i></div><div data-hf-id="hf-s11lg4" class="ll" id="s11-lg4"><b data-hf-id="hf-s11lb4">deploy</b><i data-hf-id="hf-s11li4">link.wzrd.tech/gratitude/tour</i></div></div>
          <div data-hf-id="hf-s11sw" class="steps">{steps}</div>
        </div>
        <div data-hf-id="hf-s11ap" class="app" id="s11-app">
          <div data-hf-id="hf-s11ag" class="gl"></div>
          <div data-hf-id="hf-s11an" class="nv">OCTOBER TOUR</div>
          <div data-hf-id="hf-s11ai" class="in">
            <div data-hf-id="hf-s11at" class="ti"><div data-hf-id="hf-s11at1">Every date,</div>
              <div data-hf-id="hf-s11at2">every ticket,</div><div data-hf-id="hf-s11at3">one link.</div></div>
            <div data-hf-id="hf-s11ac" class="cd" id="s11-count">07:14:22:09</div>
            <div data-hf-id="hf-s11al" class="cl">DAYS HRS MIN SEC</div>
            <div data-hf-id="hf-s11ab" class="bt">Tickets</div>
          </div>
        </div>
        <div data-hf-id="hf-s11up" class="urlpill" id="s11-url">link.wzrd.tech/gratitude/tour &middot; live for anyone</div>
        <div data-hf-id="hf-s11dc" class="dec" id="s11-dec">
          <div data-hf-id="hf-s11dl" class="lb">PUBLISH TO PRODUCTION</div>
          <div data-hf-id="hf-s11dh" class="hh">mini.wzrd.tech/gratitude/tour</div>
          <div data-hf-id="hf-s11ds" class="sub">public &middot; listed in the App Store</div>
          <div data-hf-id="hf-s11da" class="act" id="s11-dec-act">
            <div data-hf-id="hf-s11do" class="big3 btn3 ok3" id="s11-dec-ok">Approve</div>
            <div data-hf-id="hf-s11de" class="gh btn3 gh3">Edit</div></div>
        </div>
        <div data-hf-id="hf-s11lv" class="live" id="s11-live">
          <div data-hf-id="hf-s11l1" class="l1">It&rsquo;s live.</div>
          <div data-hf-id="hf-s11l2" class="l2">mini.wzrd.tech/gratitude/tour</div>
          <div data-hf-id="hf-s11l3" class="l3">listed in the App Store</div>
        </div>
      </div>
      <div data-hf-id="hf-s11hf" class="hitflash" id="s11-flash"></div>
    </div>"""

SCRIPT = M.COMMON_JS + f"""
{ITEMS}
      var threadEl=$('#s11-thread'); threadEl.setAttribute('data-bottom','622');
      var TH=buildThread(threadEl, ITEMS);
      var stage=rig('s11'), flash=$('#s11-flash');
      var build=$('#s11-build'), app=$('#s11-app'), url=$('#s11-url'), dec=$('#s11-dec'), live=$('#s11-live');
      gsap.set(build,{{autoAlpha:0,y:40,scale:.95,transformOrigin:'50% 50%'}});
      gsap.set(app,{{autoAlpha:0,y:70,scale:.90,transformOrigin:'50% 50%'}});
      gsap.set(url,{{autoAlpha:0,y:14}});
      gsap.set(dec,{{autoAlpha:0,y:40,scale:.95,transformOrigin:'50% 50%'}});
      gsap.set(live,{{autoAlpha:0,scale:.94,transformOrigin:'50% 50%'}});
      gsap.set('#s11-bar',{{scaleX:.10}});
      gsap.set($$('#s11-log .ll'),{{autoAlpha:0,x:18}});
      gsap.set($$('#s11-sd0,#s11-sd1,#s11-sd2,#s11-sd3'),{{autoAlpha:.001}});
      gsap.set(flash,{{opacity:0}});
      gsap.set(stage,{{scale:1.0,transformOrigin:'50% 50%'}});

      // 78.530 — "yes" is the whole approval. The build takes the frame immediately.
      showItem(tl,TH,0.000,6,{{slide:.30}});
      hit(tl,stage,0.000,{{amt:.022}});
      showItem(tl,TH,0.420,7,{{slide:.34}});
      tl.to('#s11-ph',{{autoAlpha:0,scale:.9,duration:.34,ease:'power3.in'}},0.86);
      rightOut(tl,'s11',0.80);
      tl.to(build,{{autoAlpha:1,y:0,scale:1,duration:.72,ease:'expo.out'}},0.96);

      // 78.530 -> 82.477 — one card, counting, with a step checked on each downbeat
      var pct={{v:10}}, pctEl=$('#s11-pct');
      tl.to(pct,{{v:100,duration:3.40,ease:'power1.inOut',onUpdate:function(){{
        pctEl.textContent=Math.round(pct.v)+'%';
      }}}},1.10);
      tl.to('#s11-bar',{{scaleX:1,duration:3.40,ease:'power1.inOut'}},1.10);
      // the console fills on the eighths: the machine is visibly doing the work
      $$('#s11-log .ll').forEach(function(l,i){{
        tl.to(l,{{autoAlpha:1,x:0,duration:.30,ease:'power3.out'}},1.30+i*.592);
      }});
      [[0,1.30],[1,1.579],[2,3.158],[3,3.947]].forEach(function(s){{
        tl.to('#s11-sd'+s[0],{{autoAlpha:1,duration:.001}},s[1]);
        tl.to('#s11-st'+s[0],{{className:'st on',duration:.001}},s[1]);
        hit(tl,stage,s[1],{{amt:.010}});
      }});

      // 83.244 — the dev build is live, and the film shows the app rather than describing it
      tl.to(build,{{autoAlpha:0,y:-40,scale:.96,duration:.30,ease:'power3.in'}},4.560);
      tl.to(app,{{autoAlpha:1,y:0,scale:1,duration:.86,ease:'expo.out'}},4.714);
      tl.to(url,{{autoAlpha:1,y:0,duration:.52,ease:'expo.out'}},5.00);
      hit(tl,stage,4.714,{{amt:.030,flash:flash,flashAmt:.18,flashD:.24}});
      ['07:14:22:08','07:14:22:07','07:14:22:06','07:14:22:05','07:14:22:04'].forEach(function(v,i){{
        tl.set('#s11-count',{{textContent:v}},5.10+i*.3947);
      }});
      cam(tl,stage,4.714,{{scale:1.04,d:1.6,e:'expo.out'}});

      // 86.378 — "ship it". 86.936 — the decision, as an object you could press.
      tl.to([app,url],{{autoAlpha:0,scale:.94,duration:.28,ease:'power3.in'}},7.700);
      tl.to(dec,{{autoAlpha:1,y:0,scale:1,duration:.70,ease:'expo.out'}},7.848);
      hit(tl,stage,7.848,{{amt:.024}});
      tl.to('#s11-dec-ok',{{scale:.955,duration:.07,ease:'power2.out'}},9.230);
      tl.to('#s11-dec-ok',{{scale:1,duration:.16,ease:'power2.inOut'}},9.309);
      // 87.957 — Approve. Spectral moment 3 of 4, and the biggest hit of the act.
      tl.to(dec,{{autoAlpha:0,scale:1.06,duration:.10,ease:'power2.in'}},9.427);
      tl.to(live,{{autoAlpha:1,scale:1,duration:.62,ease:'expo.out'}},9.532);
      hit(tl,stage,9.427,{{amt:.044,flash:flash,flashAmt:.30,flashD:.30,shake:8}});
      cam(tl,stage,9.60,{{scale:1.05,d:1.5,e:'expo.out'}});
      tl.to(live,{{autoAlpha:0,y:-60,duration:.30,ease:'power4.in'}},10.71);"""
print(P.emit('compositions/shot-11-create-ship.html','shot-11-create-ship','s11',11.006,STYLE,BODY,SCRIPT))
