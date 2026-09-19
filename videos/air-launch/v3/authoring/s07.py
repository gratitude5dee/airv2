import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P, mini_common as M
R='s07-root'; PFX='s07'
TEE_ART = '''<svg data-hf-id="hf-%ID%" viewBox="0 0 520 520" class="teeart" aria-hidden="true">
  <defs>
    <linearGradient id="%ID%-cloth" x1=".22" y1="0" x2=".82" y2="1">
      <stop offset="0" stop-color="#3A3E46"/><stop offset=".34" stop-color="#22262D"/>
      <stop offset=".72" stop-color="#14171C"/><stop offset="1" stop-color="#0B0D11"/></linearGradient>
    <linearGradient id="%ID%-fold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset=".26" stop-color="#000" stop-opacity="0"/>
      <stop offset=".62" stop-color="#FFF" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient>
    <radialGradient id="%ID%-sweep" cx=".46" cy=".30" r=".92">
      <stop offset="0" stop-color="#FFFCF4"/><stop offset=".52" stop-color="#F0E7D6"/>
      <stop offset="1" stop-color="#D9CDB8"/></radialGradient>
    <filter id="%ID%-shad" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="17"/></filter>
    <filter id="%ID%-soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <rect data-hf-id="hf-%ID%bg" x="0" y="0" width="520" height="520" fill="url(#%ID%-sweep)"/>
  <ellipse data-hf-id="hf-%ID%sh" cx="264" cy="432" rx="172" ry="30" fill="#6B5E49" opacity=".38" filter="url(#%ID%-shad)"/>
  <g data-hf-id="hf-%ID%g" transform="translate(260 252) rotate(-1.5) translate(-260 -252)">
    <path data-hf-id="hf-%ID%body" d="M188 96 148 112 96 158l38 44 30-25v217c0 7 5 12 12 12h168c7 0 12-5 12-12V177l30 25 38-44-52-46-40-16-31-9a44 44 0 0 1-82 0Z"
          fill="url(#%ID%-cloth)"/>
    <path data-hf-id="hf-%ID%fold" d="M188 96 148 112 96 158l38 44 30-25v217c0 7 5 12 12 12h168c7 0 12-5 12-12V177l30 25 38-44-52-46-40-16-31-9a44 44 0 0 1-82 0Z"
          fill="url(#%ID%-fold)"/>
    <path data-hf-id="hf-%ID%col" d="M219 87a44 44 0 0 0 82 0l-12-3a33 33 0 0 1-58 0Z" fill="#0A0C10" opacity=".9"/>
    <path data-hf-id="hf-%ID%colr" d="M217 86a46 46 0 0 0 86 0" fill="none" stroke="#565C66" stroke-opacity=".55" stroke-width="3.5"/>
    <path data-hf-id="hf-%ID%s1" d="M166 196v212" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>
    <path data-hf-id="hf-%ID%s2" d="M354 196v212" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>
    <path data-hf-id="hf-%ID%hl" d="M206 150c-14 60-16 150-8 244" fill="none" stroke="#FFF" stroke-opacity=".10" stroke-width="16" filter="url(#%ID%-soft)"/>
    <g data-hf-id="hf-%ID%pr" opacity=".93">
      <text data-hf-id="hf-%ID%t1" x="260" y="244" text-anchor="middle" font-family="Newsreader,Georgia,serif"
            font-size="34" font-weight="300" letter-spacing="1" fill="#E8DFCC">OCTOBER</text>
      <text data-hf-id="hf-%ID%t2" x="260" y="276" text-anchor="middle" font-family="Azeret Mono,monospace"
            font-size="12" letter-spacing="5" fill="#C2B9A6">TOUR &#183; MMXXVI</text>
      <path data-hf-id="hf-%ID%t3" d="M206 292h108" stroke="#C2B9A6" stroke-opacity=".7" stroke-width="1.6"/>
    </g>
  </g>
</svg>'''
def tee(pid): return TEE_ART.replace('%ID%', pid)
TEE = tee('s07teeA')
STYLE = M.base_style(R, """
      /* this shot is the mirror of the others: type left, phone right, product left */
      #s07-root .right{left:112px;width:860px}
      #s07-root .slash{left:0;top:236px}
      #s07-root .expl{left:4px;top:512px;width:790px}
      #s07-root .tee{width:100%;height:168px;border-radius:14px;overflow:hidden;display:flex;
        align-items:center;justify-content:center;background:#EFE6D6}
      #s07-root .tee .teeart{width:168px;height:168px;display:block}
      #s07-root .prow{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 0}
      #s07-root .prow .pn{font-size:17px;font-weight:700;color:#fff}
      #s07-root .prow .pp{font-family:'Azeret Mono',monospace;font-size:17px;color:var(--ink)}
      #s07-root .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;
        font-family:'Azeret Mono',monospace;font-size:12px;letter-spacing:.02em}
      #s07-root .pill.need{background:rgba(255,196,86,.16);border:1px solid rgba(255,196,86,.42);color:#FFC456}
      /* the hero listing: a real product frame, lifted out of the thread */
      #s07-root .hero{position:absolute;left:112px;top:150px;width:756px;border-radius:30px;overflow:hidden;
        background:rgba(8,14,30,.66);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(20px);
        box-shadow:0 50px 100px rgba(2,6,18,.62)}
      #s07-root .hero .shot{height:430px;overflow:hidden;display:flex;align-items:center;justify-content:center;
        background:#EFE6D6}
      #s07-root .hero .shot .teeart{width:430px;height:430px;display:block}
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
      #s07-root .livepill{position:absolute;left:112px;top:864px;display:inline-flex;align-items:center;gap:12px;
        padding:16px 26px;border-radius:999px;background:rgba(31,166,79,.16);border:1px solid rgba(63,216,119,.5);
        font-family:'Azeret Mono',monospace;font-size:21px;letter-spacing:.04em;color:#5BE585}
      #s07-root .ordertag{position:absolute;left:112px;top:952px;font-family:'Azeret Mono',monospace;
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
        {{side:'recv', text:'stripe payouts landed this morning.', pre:true, dim:true}},
        {{side:'sent', text:'good', pre:true, dim:true}},
        {{side:'recv', text:'two people asked about sizing on the last drop.', pre:true, dim:true}},
        {{side:'sent', text:'add a size chart next time', pre:true, dim:true}},
        {{side:'recv', text:'the tee mockups came back. i staged the black one.', pre:true, dim:true}},
        {{side:'sent', text:'how many did we sell last drop?', pre:true, dim:true}},
        {{side:'recv', text:'41, and 9 people asked when the next one lands.', pre:true, dim:true}},
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
          <div data-hf-id="hf-s07hs" class="shot">{tee('s07teeB')}</div>
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
      var threadEl=$('#s07-thread'); threadEl.setAttribute('data-bottom','622');
      var TH=buildThread(threadEl, ITEMS);
      var stage=rig('s07'), flash=$('#s07-flash');
      var hero=$('#s07-hero'), live=$('#s07-livepill'), order=$('#s07-order');
      gsap.set($('#s07-composer-txt'),{{textContent:'/shop'}});
      gsap.set(hero,{{autoAlpha:0,x:-40,y:30,scale:.92,transformOrigin:'50% 50%'}});
      gsap.set(live,{{autoAlpha:0,y:16}});
      gsap.set(order,{{autoAlpha:0,y:16}});
      gsap.set(stage,{{scale:1.0,transformOrigin:'50% 50%'}});
      gsap.set(flash,{{opacity:0}});
      gsap.set('#s07-ph',{{x:640}});

      // 52.059 — send, and the phone slides right to make room for the product
      showItem(tl,TH,0.000,8,{{slide:.30}});
      tl.set($('#s07-composer-txt'),{{textContent:''}},0.000);
      hit(tl,stage,0.000,{{amt:.020}});
      whipIn(tl,stage,0.000,210);
      rightIn(tl,'s07',0.06);
      // 53.615 — the listing lands in the thread and lifts out as the real product frame
      showItem(tl,TH,1.556,9,{{slide:.42}});
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
      tl.to('#s07-ph',{{x:460,autoAlpha:0,duration:.28,ease:'power4.in'}},5.92);
      whipOut(tl,stage,6.03,210);"""

print(P.emit('compositions/shot-07-shop.html','shot-07-shop','s07',6.2,STYLE,BODY,SCRIPT))