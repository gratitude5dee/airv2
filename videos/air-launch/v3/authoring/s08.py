import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P, mini_common as M
R='s08-root'; PFX='s08'
STYLE = M.base_style(R, """
      #s08-root .tk{display:flex;align-items:baseline;justify-content:space-between;padding:2px 14px 8px}
      #s08-root .tk .big{font-family:'Azeret Mono',monospace;font-size:26px;color:#fff}
      #s08-root .tk .sm{font-family:'Azeret Mono',monospace;font-size:13px;color:rgba(244,239,230,.80)}
      /* the macro plate: the ticket, at the size a decision actually feels */
      #s08-root .macro{position:absolute;left:250px;top:214px;width:1420px;border-radius:34px;
        background:rgba(8,14,30,.72);border:1px solid rgba(255,255,255,.17);backdrop-filter:blur(22px);
        box-shadow:0 56px 110px rgba(2,6,18,.66);padding:38px 44px 40px}
      #s08-root .macro .lbl{font-family:'Azeret Mono',monospace;font-size:17px;letter-spacing:.14em;
        color:rgba(244,239,230,.62);margin-bottom:16px}
      #s08-root .macro .amt{font-family:'Azeret Mono',monospace;font-size:104px;letter-spacing:-.04em;
        color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
      #s08-root .macro .sub{font-family:'Azeret Mono',monospace;font-size:21px;color:rgba(244,239,230,.74);
        margin-top:14px;display:flex;gap:26px;flex-wrap:wrap}
      #s08-root .macro .act{display:flex;gap:16px;margin-top:32px}
      #s08-root .macro .big3{flex:1;height:92px;border-radius:24px;display:flex;align-items:center;
        justify-content:center;font-size:28px;font-weight:700;will-change:transform}
      #s08-root .macro .gh{width:240px;height:92px;border-radius:24px;display:flex;align-items:center;
        justify-content:center;font-size:24px}
      #s08-root .filled{position:absolute;left:250px;top:300px;width:1420px;text-align:center}
      #s08-root .filled .w{font-family:'Azeret Mono',monospace;font-size:150px;letter-spacing:-.05em;
        color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
      #s08-root .filled .l{margin-top:22px;font-family:'Azeret Mono',monospace;font-size:26px;letter-spacing:.16em;
        color:#5BE585}
      #s08-root .filled .b{margin-top:16px;font-family:'Azeret Mono',monospace;font-size:20px;
        letter-spacing:.06em;color:rgba(244,239,230,.72)}""")

TRADE = (M.hd('s08tr','glyph-wallet.svg','Buy 0.05 BTC','paper mode · preview expires in 5:00')
         + '<div data-hf-id="hf-s08tk" class="tk"><span data-hf-id="hf-s08tb" class="big">0.05 BTC</span>'
           '<span data-hf-id="hf-s08ts" class="sm">est. $3,140</span></div>')
ITEMS = f"""      var ITEMS=[
        {{kind:'sys', text:'Today · 9:28 AM', pre:true}},
        {{side:'recv', text:'nothing needs you in the inbox.', pre:true, dim:true}},
        {{side:'sent', text:'ok', pre:true, dim:true}},
        {{side:'recv', text:'coinbase is connected in paper mode only.', pre:true, dim:true}},
        {{side:'sent', text:'keep it that way', pre:true, dim:true}},
        {{side:'recv', text:'paper balance is $10,000. nothing open.', pre:true, dim:true}},
        {{side:'sent', text:'what did btc do overnight?', pre:true, dim:true}},
        {{side:'recv', text:'down 1.4%, then flat since 6am.', pre:true, dim:true}},
        {{side:'sent', text:'/trade'}},
        {{kind:'card', side:'recv', html:{TRADE!r}}}
      ];"""

BODY = f"""    <div data-hf-id="hf-s08frame" class="frame clip" id="s08-frame" data-layout-allow-overflow="" data-start="0" data-duration="6.153" data-track-index="1">
      <div data-hf-id="hf-s08wa" class="washL"></div>
      <div data-hf-id="hf-s08wb" class="washR"></div>
      <div data-hf-id="hf-s08st" class="stage" id="s08-stage">
{M.right_plane(PFX,'/trade','every order previewed. you approve. paper mode first.')}
{M.phone(PFX)}
        <div data-hf-id="hf-s08mc" class="macro" id="s08-macro">
          <div data-hf-id="hf-s08ml" class="lbl">ORDER PREVIEW · PAPER</div>
          <div data-hf-id="hf-s08ma" class="amt">BUY 0.05 BTC</div>
          <div data-hf-id="hf-s08ms" class="sub"><span data-hf-id="hf-s08m1">est. $3,140</span>
            <span data-hf-id="hf-s08m2">balance $10,000</span><span data-hf-id="hf-s08m3">expires 4:58</span></div>
          <div data-hf-id="hf-s08mact" class="act" id="s08-act">
            <div data-hf-id="hf-s08mok" class="big3 btn3 ok3" id="s08-macro-ok">Approve</div>
            <div data-hf-id="hf-s08med" class="gh btn3 gh3">Edit</div></div>
        </div>
        <div data-hf-id="hf-s08fl" class="filled" id="s08-filled">
          <div data-hf-id="hf-s08fw" class="w">0.05 BTC</div>
          <div data-hf-id="hf-s08fl2" class="l">FILLED &middot; PAPER</div>
          <div data-hf-id="hf-s08fb" class="b">@ $62,800 &middot; balance $6,860</div>
        </div>
      </div>
      <div data-hf-id="hf-s08hf" class="hitflash" id="s08-flash"></div>
    </div>"""

SCRIPT = M.COMMON_JS + f"""
{ITEMS}
      var threadEl=$('#s08-thread'); threadEl.setAttribute('data-bottom','622');
      var TH=buildThread(threadEl, ITEMS);
      var stage=rig('s08'), flash=$('#s08-flash');
      var macro=$('#s08-macro'), filled=$('#s08-filled');
      gsap.set($('#s08-composer-txt'),{{textContent:'/trade'}});
      gsap.set(macro,{{autoAlpha:0,y:46,scale:.94,transformOrigin:'50% 40%'}});
      gsap.set(filled,{{autoAlpha:0,scale:.9,transformOrigin:'50% 50%'}});
      gsap.set(flash,{{opacity:0}});
      // this shot opens tight and ends wide: the only camera move like it in the film
      gsap.set(stage,{{scale:1.16,x:-120,y:-40,transformOrigin:'50% 50%'}});

      // 58.259 — send
      showItem(tl,TH,0.000,8,{{slide:.30}});
      tl.set($('#s08-composer-txt'),{{textContent:''}},0.000);
      hit(tl,stage,0.000,{{base:1.16,amt:.020}});
      whipIn(tl,stage,0.000,210);
      rightIn(tl,'s08',0.06);
      // 59.791 — the ticket, then the same ticket at the size the decision deserves
      showItem(tl,TH,1.532,9,{{slide:.42}});
      tl.to('#s08-ph',{{autoAlpha:0,scale:.9,duration:.34,ease:'power3.in'}},1.66);
      rightOut(tl,'s08',1.60);
      tl.to(macro,{{autoAlpha:1,y:0,scale:1,duration:.72,ease:'expo.out'}},1.74);
      cam(tl,stage,1.74,{{scale:1.0,x:0,y:0,d:1.1,e:'expo.out'}});
      hit(tl,stage,1.532,{{base:1.16,amt:.016}});
      // 61.068 — the tap, held on a glossy object that reads as a real button
      tl.to('#s08-macro-ok',{{scale:.955,duration:.07,ease:'power2.out'}},2.809);
      tl.to('#s08-macro-ok',{{scale:1,duration:.16,ease:'power2.inOut'}},2.888);
      hit(tl,stage,2.809,{{amt:.014}});
      // 61.301 — the fill. Spectral moment 2 of 4, and the loudest frame of this act.
      tl.to(macro,{{autoAlpha:0,scale:1.09,duration:.10,ease:'power3.in'}},3.000);
      tl.to(filled,{{autoAlpha:1,scale:1,duration:.54,ease:'expo.out'}},3.105);
      hit(tl,stage,3.042,{{amt:.040,flash:flash,flashAmt:.26,flashD:.26,shake:7}});
      // 62.880 — settle, and the frame opens back out
      hit(tl,stage,4.621,{{amt:.014}});
      cam(tl,stage,4.621,{{scale:1.03,d:1.2,e:'expo.out'}});
      tl.to(filled,{{autoAlpha:0,y:-40,duration:.28,ease:'power4.in'}},5.86);
      whipOut(tl,stage,5.983,230);"""

print(P.emit('compositions/shot-08-trade.html','shot-08-trade','s08',6.153,STYLE,BODY,SCRIPT))