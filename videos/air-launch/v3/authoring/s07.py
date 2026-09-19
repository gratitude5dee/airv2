import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P, mini_common as M
R='s07-root'; PFX='s07'
TEE = ('<svg data-hf-id="hf-s07tee" viewBox="0 0 24 24" aria-hidden="true"><path data-hf-id="hf-s07teep" '
       'd="M8.6 2.4 6 3.3 2.4 6.6l2.7 2.9 1.3-1.1V21.6h11.2V8.4l1.3 1.1 2.7-2.9L18 3.3l-2.6-.9a3.5 3.5 0 0 1-6.8 0Z"/></svg>')
STYLE = M.base_style(R, """
      #s07-root .tee{width:100%;height:150px;border-radius:14px;background:linear-gradient(170deg,#F3EADA,#DCCFBC);
        display:flex;align-items:center;justify-content:center}
      #s07-root .tee svg{width:104px;height:104px;display:block}
      #s07-root .tee svg path{fill:#14161C}
      #s07-root .prow{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 0}
      #s07-root .prow .pn{font-size:17px;font-weight:700;color:#fff}
      #s07-root .prow .pp{font-family:'Azeret Mono',monospace;font-size:17px;color:var(--ink)}
      #s07-root .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;
        font-family:'Azeret Mono',monospace;font-size:12px;letter-spacing:.02em}
      #s07-root .pill.need{background:rgba(255,196,86,.16);border:1px solid rgba(255,196,86,.42);color:#FFC456}
      /* the hero listing: a real product frame, lifted out of the thread */
      #s07-root .hero{position:absolute;left:104px;top:186px;width:716px;border-radius:30px;overflow:hidden;
        background:rgba(8,14,30,.66);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(20px);
        box-shadow:0 50px 100px rgba(2,6,18,.62)}
      #s07-root .hero .shot{height:392px;background:linear-gradient(168deg,#F6EEDF 0%,#D9CBB6 100%);
        display:flex;align-items:center;justify-content:center}
      #s07-root .hero .shot svg{width:250px;height:250px}
      #s07-root .hero .shot svg path{fill:#14161C}
      #s07-root .hero .meta{padding:26px 30px 8px;display:flex;align-items:baseline;justify-content:space-between}
      #s07-root .hero .nm{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:50px;letter-spacing:-.02em;color:var(--ink)}
      #s07-root .hero .pr{font-family:'Azeret Mono',monospace;font-size:38px;color:var(--ink)}
      #s07-root .hero .state{padding:0 30px 22px;display:flex;align-items:center;gap:14px}
      #s07-root .hero .state .lbl{font-family:'Azeret Mono',monospace;font-size:15px;letter-spacing:.08em;
        color:rgba(244,239,230,.7)}
      #s07-root .hero .act{padding:0 30px 30px;display:flex;gap:14px}
      #s07-root .hero .big{flex:1;height:76px;border-radius:20px;display:flex;align-items:center;justify-content:center;
        font-size:23px;font-weight:700;letter-spacing:-.01em;will-change:transform}
      #s07-root .hero .ghost{width:190px;height:76px;border-radius:20px;display:flex;align-items:center;
        justify-content:center;font-size:21px}
      #s07-root .livepill{position:absolute;left:104px;top:838px;display:inline-flex;align-items:center;gap:12px;
        padding:16px 26px;border-radius:999px;background:rgba(31,166,79,.16);border:1px solid rgba(63,216,119,.5);
        font-family:'Azeret Mono',monospace;font-size:21px;letter-spacing:.04em;color:#5BE585}
      #s07-root .ordertag{position:absolute;left:104px;top:920px;font-family:'Azeret Mono',monospace;
        font-size:27px;letter-spacing:.05em;color:var(--ink);text-shadow:0 2px 16px rgba(3,7,18,.7)}
      #s07-root .ordertag b{font-weight:500;font-size:44px}""")

SHOP = ('<div data-hf-id="hf-s07sfa" class="fa" id="s07-shop-a">'
        + M.hd('s07sh', None, 'October tour tee', 'staged listing · not public yet', 'shop')
        + f'<div data-hf-id="hf-s07sbd" class="bd"><div data-hf-id="hf-s07tw" class="tee">{TEE}</div>'
          '<div data-hf-id="hf-s07pr" class="prow"><span data-hf-id="hf-s07pn" class="pn">tour tee · black</span>'
          '<span data-hf-id="hf-s07pp" class="pp">$35.00</span></div>'
          '<div data-hf-id="hf-s07pw" style="padding:9px 0 0"><span data-hf-id="hf-s07pl" class="pill need">Needs you</span></div></div></div>')

ITEMS = f"""      var ITEMS=[
        {{kind:'sys', text:'Today · 9:21 AM', pre:true}},
        {{side:'sent', text:'/shop'}},
        {{kind:'card', side:'recv', html:{SHOP!r}}}
      ];"""

BODY = f"""    <div data-hf-id="hf-s07frame" class="frame clip" id="s07-frame" data-layout-allow-overflow="" data-start="0" data-duration="6.2" data-track-index="1">
      <div data-hf-id="hf-s07wa" class="washL"></div>
      <div data-hf-id="hf-s07wb" class="washR"></div>
      <div data-hf-id="hf-s07st" class="stage" id="s07-stage">
{M.right_plane(PFX,'/shop','a storefront on Stripe. you approve every listing.')}
{M.phone(PFX)}
        <div data-hf-id="hf-s07hr" class="hero" id="s07-hero">
          <div data-hf-id="hf-s07hs" class="shot">{TEE.replace('hf-s07tee','hf-s07tee2').replace('hf-s07teep','hf-s07teep2')}</div>
          <div data-hf-id="hf-s07hm" class="meta"><span data-hf-id="hf-s07hn" class="nm">tour tee · black</span>
            <span data-hf-id="hf-s07hp" class="pr">$35.00</span></div>
          <div data-hf-id="hf-s07hst" class="state" id="s07-hstate"><span data-hf-id="hf-s07hpl" class="pill need">Needs you</span>
            <span data-hf-id="hf-s07hl" class="lbl">staged · only you can see this</span></div>
          <div data-hf-id="hf-s07ha" class="act" id="s07-hact">
            <div data-hf-id="hf-s07hok" class="big btn3 ok3" id="s07-hero-ok">Approve</div>
            <div data-hf-id="hf-s07hed" class="ghost btn3 gh3">Edit</div></div>
        </div>
        <div data-hf-id="hf-s07lp" class="livepill" id="s07-livepill">LIVE · mini.wzrd.tech/gratitude-shop</div>
        <div data-hf-id="hf-s07ot" class="ordertag" id="s07-order"><b data-hf-id="hf-s07otb">1 order</b> · $35 · label ready</div>
      </div>
      <div data-hf-id="hf-s07hf" class="hitflash" id="s07-flash"></div>
    </div>"""

SCRIPT = M.COMMON_JS + f"""
{ITEMS}
      var threadEl=$('#s07-thread'); threadEl.setAttribute('data-bottom','634');
      var TH=buildThread(threadEl, ITEMS);
      var stage=rig('s07'), flash=$('#s07-flash');
      var hero=$('#s07-hero'), live=$('#s07-livepill'), order=$('#s07-order');
      gsap.set($('#s07-composer-txt'),{{textContent:'/shop'}});
      gsap.set(hero,{{autoAlpha:0,x:-40,y:30,scale:.92,transformOrigin:'50% 50%'}});
      gsap.set(live,{{autoAlpha:0,y:16}});
      gsap.set(order,{{autoAlpha:0,y:16}});
      gsap.set(stage,{{scale:1.0,transformOrigin:'50% 50%'}});
      gsap.set(flash,{{opacity:0}});
      gsap.set('#s07-ph',{{x:600}});

      // 52.059 — send, and the phone slides right to make room for the product
      showItem(tl,TH,0.000,1,{{slide:.30}});
      tl.set($('#s07-composer-txt'),{{textContent:''}},0.000);
      hit(tl,stage,0.000,{{amt:.020}});
      whipIn(tl,stage,0.000,210);
      rightIn(tl,'s07',0.06);
      // 53.615 — the listing lands in the thread and lifts out as the real product frame
      showItem(tl,TH,1.556,2,{{slide:.42}});
      tl.to(hero,{{autoAlpha:1,x:0,y:0,scale:1,duration:.70,ease:'expo.out'}},1.556);
      hit(tl,stage,1.556,{{amt:.018}});
      rightOut(tl,'s07',1.24);
      // 55.147 — the tap. A staged listing is private until the owner says otherwise.
      tl.to('#s07-hero-ok',{{scale:.94,duration:.07,ease:'power2.out'}},3.088);
      tl.to('#s07-hero-ok',{{scale:1,duration:.16,ease:'power2.inOut'}},3.166);
      hit(tl,stage,3.088,{{amt:.012}});
      // 55.519 — live, with the film's second spectral moment carried on the flash
      tl.to('#s07-hact',{{autoAlpha:0,y:10,duration:.20,ease:'power3.in'}},3.34);
      tl.to('#s07-hstate',{{autoAlpha:0,duration:.16,ease:'power2.in'}},3.34);
      tl.to(live,{{autoAlpha:1,y:0,duration:.52,ease:'expo.out'}},3.460);
      hit(tl,stage,3.460,{{amt:.026,flash:flash,flashAmt:.16,flashD:.22}});
      // 56.703 — the first order, on the loudest kick of the bar
      tl.to(order,{{autoAlpha:1,y:0,duration:.50,ease:'expo.out'}},4.644);
      hit(tl,stage,4.644,{{amt:.022}});
      cam(tl,stage,4.644,{{scale:1.035,d:1.3,e:'expo.out'}});
      tl.to([hero,live,order],{{autoAlpha:0,x:-180,duration:.30,ease:'power4.in'}},5.90);
      tl.to('#s07-ph',{{x:420,autoAlpha:0,duration:.28,ease:'power4.in'}},5.92);
      whipOut(tl,stage,6.03,210);"""

print(P.emit('compositions/shot-07-shop.html','shot-07-shop','s07',6.2,STYLE,BODY,SCRIPT))