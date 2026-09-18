import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
import parts as P
R='s06-root'
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.phone_css(R,'s06') + """
      #s06-root .ph{left:470px;top:103px}
      #s06-root .right{position:absolute;left:1010px;top:0;width:860px;height:1080px}
      #s06-root .slash{position:absolute;left:0;top:286px;font-family:'Azeret Mono',monospace;font-weight:500;
        font-size:190px;letter-spacing:-.05em;color:var(--ink);opacity:.34;white-space:nowrap;
        text-shadow:0 6px 40px rgba(3,7,18,.45)}
      #s06-root .expl{position:absolute;left:4px;top:560px;width:800px}
      #s06-root .expl .mono{font-size:28px;line-height:1.5}
      #s06-root .endcap{position:absolute;left:4px;top:556px;width:820px}
      /* the clay app grid: the first-party apps, one text away */
      #s06-root .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:11px;padding:2px 14px 14px}
      #s06-root .gi{position:relative;aspect-ratio:1/1;border-radius:16px;background-size:cover;background-position:center;
        will-change:transform,opacity}
      #s06-root .gl{position:absolute;left:0;right:0;bottom:-19px;text-align:center;font-family:'Azeret Mono',monospace;
        font-size:10px;color:rgba(244,239,230,.75)}
      #s06-root .tee{width:100%;height:150px;border-radius:14px;background:linear-gradient(170deg,#F3EADA,#DCCFBC);
        display:flex;align-items:center;justify-content:center}
      #s06-root .tee svg{width:104px;height:104px;display:block}
      #s06-root .tee svg path{fill:#14161C}
      #s06-root .prow{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 0}
      #s06-root .prow .pn{font-size:17px;font-weight:700;color:#fff}
      #s06-root .prow .pp{font-family:'Azeret Mono',monospace;font-size:17px;color:var(--ink)}
      #s06-root .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;
        font-family:'Azeret Mono',monospace;font-size:12px;letter-spacing:.02em}
      #s06-root .pill.need{background:rgba(255,196,86,.16);border:1px solid rgba(255,196,86,.42);color:#FFC456}
      #s06-root .pill.live{background:rgba(48,209,88,.16);border:1px solid rgba(48,209,88,.42);color:#5BE585}
      #s06-root .tk{display:flex;align-items:baseline;justify-content:space-between;padding:2px 14px 8px}
      #s06-root .tk .big{font-family:'Azeret Mono',monospace;font-size:26px;color:#fff}
      #s06-root .tk .sm{font-family:'Azeret Mono',monospace;font-size:13px;color:rgba(244,239,230,.80)}
      /* halftone progress: one column per hihat hit of the 66.80-67.27 roll */
      #s06-root .half{display:grid;grid-template-columns:repeat(14,1fr);gap:7px;padding:4px 14px 12px}
      #s06-root .half i{display:block;width:100%;aspect-ratio:1/1;border-radius:50%;background:var(--ink);opacity:.18}
      #s06-root .zres{position:relative;width:100%;height:172px;border-radius:14px;overflow:hidden;
        background:linear-gradient(180deg,#2F5EA8 0%,#6E9AD4 52%,#C8DCF0 100%)}
      #s06-root .zres .cl{position:absolute;border-radius:50%;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.92),rgba(255,255,255,0) 70%)}
      #s06-root .zres .orb{position:absolute;left:50%;margin-left:-34px;width:68px;height:68px;border-radius:50%;
        box-shadow:0 10px 26px rgba(8,24,60,.5)}
      #s06-root .zres .badge{position:absolute;left:10px;bottom:9px;font-family:'Azeret Mono',monospace;font-size:11px;
        color:rgba(255,255,255,.9);background:rgba(4,9,22,.5);border-radius:6px;padding:3px 7px}"""

TEE = ('<svg data-hf-id="hf-s06tee" viewBox="0 0 24 24" aria-hidden="true"><path data-hf-id="hf-s06teep" '
       'd="M8.6 2.4 6 3.3 2.4 6.6l2.7 2.9 1.3-1.1V21.6h11.2V8.4l1.3 1.1 2.7-2.9L18 3.3l-2.6-.9a3.5 3.5 0 0 1-6.8 0Z"/></svg>')
ICONS=['home','shop','pay','inbox','calendar','vault','computer','image','video','persona']
grid = ''.join(f'<div data-hf-id="hf-s06g{i}" class="gi" id="s06-g{i}" style="background-image:url(&quot;assets/icons/{n}.png&quot;)"></div>' for i,n in enumerate(ICONS))

def hd(pid, glyph, title, sub, art=None):
    ic = (f'<div data-hf-id="hf-{pid}a" class="art" style="background-image:url(&quot;assets/icons/{art}.png&quot;)"></div>'
          if art else f'<div data-hf-id="hf-{pid}i" class="ic"><div data-hf-id="hf-{pid}g" class="gly" style="background-image:url(&quot;logos/{glyph}&quot;)"></div></div>')
    return (f'<div data-hf-id="hf-{pid}h" class="hd">{ic}<div data-hf-id="hf-{pid}w">'
            f'<div data-hf-id="hf-{pid}t" class="ti">{title}</div><div data-hf-id="hf-{pid}s" class="sb">{sub}</div></div></div>')

HOME = hd('s06hm', None, 'your apps', 'published · tap to open', 'home') + f'<div data-hf-id="hf-s06grid" class="grid" id="s06-grid">{grid}</div>'

SHOP = ('<div data-hf-id="hf-s06sfa" class="fa" id="s06-shop-a">'
        + hd('s06sh', None, 'October tour tee', 'staged listing · not public yet', 'shop')
        + f'<div data-hf-id="hf-s06sbd" class="bd"><div data-hf-id="hf-s06tw" class="tee">{TEE}</div>'
          '<div data-hf-id="hf-s06pr" class="prow"><span data-hf-id="hf-s06pn" class="pn">tour tee · black</span>'
          '<span data-hf-id="hf-s06pp" class="pp">$35.00</span></div>'
          '<div data-hf-id="hf-s06pw" style="padding:9px 0 0"><span data-hf-id="hf-s06pl" class="pill need">Needs you</span></div></div>'
        '<div data-hf-id="hf-s06srw" class="row"><div data-hf-id="hf-s06sok" class="btn ok" id="s06-shop-ok">Approve</div>'
        '<div data-hf-id="hf-s06sed" class="btn gh">Edit</div></div></div>'
        '<div data-hf-id="hf-s06sfb" class="fb" id="s06-shop-b">'
        + hd('s06sl', None, 'October tour tee', 'live · mini.wzrd.tech/gratitude-shop', 'shop')
        + '<div data-hf-id="hf-s06sd" class="done"><span data-hf-id="hf-s06sk">✓</span>'
          '<span data-hf-id="hf-s06st">Listed · Stripe connected</span></div></div>')

TRADE = ('<div data-hf-id="hf-s06tfa" class="fa" id="s06-trade-a">'
         + hd('s06tr','glyph-wallet.svg','Buy 0.05 BTC','paper mode · preview expires in 5:00')
         + '<div data-hf-id="hf-s06tk" class="tk"><span data-hf-id="hf-s06tb" class="big">0.05 BTC</span>'
           '<span data-hf-id="hf-s06ts" class="sm">est. $3,140 · balance $10,000</span></div>'
         '<div data-hf-id="hf-s06trw" class="row"><div data-hf-id="hf-s06tok" class="btn ok" id="s06-trade-ok">Approve</div>'
         '<div data-hf-id="hf-s06ted" class="btn gh">Edit</div></div></div>'
         '<div data-hf-id="hf-s06tfb" class="fb" id="s06-trade-b">'
         + hd('s06tf','glyph-wallet.svg','Filled · paper','0.05 BTC @ $62,800 · balance $6,860')
         + '<div data-hf-id="hf-s06td" class="done"><span data-hf-id="hf-s06tdk">✓</span>'
           '<span data-hf-id="hf-s06tdt">Order filled</span></div></div>'
         '<div data-hf-id="hf-s06tsp" class="spectral" id="s06-trade-spectral"></div>')

halfdots=''.join(f'<i data-hf-id="hf-s06hd{i}" id="s06-hd{i}"></i>' for i in range(70))
clouds=''.join(f'<div data-hf-id="hf-s06zc{i}" class="cl" id="s06-zc{i}"></div>' for i in range(5))
ZAP = ('<div data-hf-id="hf-s06zfa" class="fa" id="s06-zap-a">'
       + hd('s06zp','glyph-sparkle.svg','/zap · video','rendering · 6s · 1080x1080', 'video')
       + f'<div data-hf-id="hf-s06hf" class="half" id="s06-half">{halfdots}</div></div>'
       '<div data-hf-id="hf-s06zfb" class="fb" id="s06-zap-b">'
       + hd('s06zr','glyph-sparkle.svg','/zap · video','ready · 6s · tap to send anywhere', 'video')
       + f'<div data-hf-id="hf-s06zbd" class="bd"><div data-hf-id="hf-s06zres" class="zres" id="s06-zres">{clouds}'
         '<div data-hf-id="hf-s06zorb" class="orb" id="s06-zorb" style="background-image:url(&quot;logos/air-brand.png&quot;);background-size:cover"></div>'
         '<div data-hf-id="hf-s06zbg" class="badge">00:06 · generated</div></div></div></div>')

ITEMS = f"""      var ITEMS=[
        {{kind:'sys', text:'Today · 9:14 AM', pre:true}},
        {{side:'recv', text:'the tour page is up. 2,140 visits since friday.', pre:true, dim:true}},
        {{side:'sent', text:'what else is live?', pre:true, dim:true}},
        {{side:'sent', text:'/home'}},
        {{kind:'card', side:'recv', html:{HOME!r}}},
        {{side:'sent', text:'/shop'}},
        {{kind:'card', side:'recv', html:{SHOP!r}}},
        {{side:'recv', text:'1 order · $35. shipping label ready.'}},
        {{side:'sent', text:'/trade'}},
        {{kind:'card', side:'recv', html:{TRADE!r}}},
        {{side:'sent', text:'/zap the orb rising over clouds, 6s'}},
        {{side:'recv', text:'on it — about 40s.'}},
        {{kind:'card', side:'recv', html:{ZAP!r}}}
      ];"""

BODY = f"""    <div data-hf-id="hf-s06frame" class="frame clip" id="s06-frame" data-layout-allow-overflow="" data-start="0" data-duration="24.869" data-track-index="1">
      <div data-hf-id="hf-s06wa" class="washL"></div>
      <div data-hf-id="hf-s06wb" class="washR"></div>
      <div data-hf-id="hf-s06rt" class="right" id="s06-right">
        <div data-hf-id="hf-s06sl0" class="slash" id="s06-slash0">/home</div>
        <div data-hf-id="hf-s06sl1" class="slash" id="s06-slash1">/shop</div>
        <div data-hf-id="hf-s06sl2" class="slash" id="s06-slash2">/trade</div>
        <div data-hf-id="hf-s06sl3" class="slash" id="s06-slash3">/zap</div>
        <div data-hf-id="hf-s06e0" class="expl" id="s06-expl0"><div data-hf-id="hf-s06em0" class="mono">your first-party apps, one text away.</div></div>
        <div data-hf-id="hf-s06e1" class="expl" id="s06-expl1"><div data-hf-id="hf-s06em1" class="mono">a storefront on Stripe. you approve every listing.</div></div>
        <div data-hf-id="hf-s06e2" class="expl" id="s06-expl2"><div data-hf-id="hf-s06em2" class="mono">every order previewed. you approve. paper mode first.</div></div>
        <div data-hf-id="hf-s06e3" class="expl" id="s06-expl3"><div data-hf-id="hf-s06em3" class="mono">video, images, animation — creative lanes in the thread.</div></div>
        <div data-hf-id="hf-s06ec" class="endcap" id="s06-endcap"><div data-hf-id="hf-s06ect" class="cap">mini-apps.</div><div data-hf-id="hf-s06ect2" class="cap">make your own.</div></div>
      </div>
{P.PHONE_HTML.replace('%P%','s06')}
    </div>"""

SCRIPT = P.THREAD_JS + f"""
{ITEMS}
      var threadEl=$('#s06-thread'); threadEl.setAttribute('data-bottom','634');
      var TH=buildThread(threadEl, ITEMS);
      var ph=$('#s06-ph'), comp=$('#s06-composer-txt'), cglow=$('#s06-composer-glow'), caret=$('#s06-composer-caret');
      var slash=[0,1,2,3].map(function(i){{return $('#s06-slash'+i);}});
      var expl=[0,1,2,3].map(function(i){{return $('#s06-expl'+i);}});
      var endcap=$('#s06-endcap');

      gsap.set(ph,{{rotationY:-9,rotationX:4,scale:1.06,transformOrigin:'50% 50%'}});
      gsap.set(slash,{{autoAlpha:0,x:60}});
      gsap.set(expl,{{autoAlpha:0,y:14}});
      gsap.set(endcap,{{autoAlpha:0,y:18}});
      gsap.set(['#s06-shop-b','#s06-zap-b'],{{autoAlpha:0}});
      gsap.set('#s06-trade-b',{{autoAlpha:0}});
      gsap.set('#s06-trade-spectral',{{opacity:0}});
      gsap.set(comp,{{textContent:'/home'}});
      gsap.set($$('#s06-grid .gi'),{{autoAlpha:0,scale:.66,transformOrigin:'50% 50%'}});
      gsap.set($$('#s06-half i'),{{opacity:.10}});
      gsap.set('#s06-zorb',{{y:120,autoAlpha:0}});
      var zc=[[14,120,150],[58,74,108],[46,150,92],[22,44,120],[70,132,84]];
      $$('#s06-zres .cl').forEach(function(c,i){{
        gsap.set(c,{{left:zc[i][0]+'%',top:zc[i][1]+'px',width:zc[i][2]+'px',height:(zc[i][2]*.62)+'px',x:'-50%',opacity:.75}});
      }});

      // one command, one card, one settle — four times, and the phone never cuts
      function command(i, tSend, tCard, nextTyped, tType){{
        showItem(tl,TH,tSend,1+i*0,{{slide:.34}});
      }}
      // thread indices: 1 /home, 2 home card, 3 /shop, 4 shop card, 5 order, 6 /trade,
      // 7 trade card, 8 /zap, 9 reply, 10 zap card
      showItem(tl,TH,0.000,3,{{slide:.30}});
      tl.set(comp,{{textContent:''}},0.000);
      showItem(tl,TH,1.532,4,{{slide:.42}});
      showItem(tl,TH,6.246,5,{{slide:.34}});
      showItem(tl,TH,7.802,6,{{slide:.42}});
      showItem(tl,TH,10.890,7,{{slide:.42}});
      showItem(tl,TH,12.446,8,{{slide:.34}});
      showItem(tl,TH,13.978,9,{{slide:.42}});
      showItem(tl,TH,18.599,10,{{slide:.34}});
      showItem(tl,TH,20.178,11,{{slide:.34}});
      showItem(tl,TH,21.711,12,{{slide:.42}});

      // the composer types the next command in the bar before it sends
      function typeCmd(text, tSend){{
        var t0=tSend-1.15;
        tl.set(comp,{{textContent:''}},t0-.02);
        tl.to(cglow,{{opacity:.5,duration:.24,ease:'power2.out'}},t0);
        typeText(tl,comp,text,t0,tSend-.10);
        tl.to(cglow,{{opacity:0,duration:.2,ease:'power2.in'}},tSend-.06);
        tl.set(comp,{{textContent:''}},tSend);
      }}
      typeCmd('/shop',6.246);
      typeCmd('/trade',12.446);
      typeCmd('/zap the orb rising over clouds, 6s',18.599);
      tl.to(caret,{{opacity:.25,duration:.4,ease:'none'}},23.6);

      // 47.09-48.669 — the clay icons pop one per hihat hit of the sustained fill
      $$('#s06-grid .gi').forEach(function(g,i){{
        tl.to(g,{{autoAlpha:1,scale:1,duration:.34,ease:'back.out(1.7)'}},1.277+i*.158);
      }});

      // 55.147 -> 55.519 — staged becomes live only because the owner tapped Approve
      tl.to('#s06-shop-ok',{{scale:.92,duration:.066,ease:'power2.out'}},9.334);
      tl.to('#s06-shop-ok',{{scale:1,duration:.12,ease:'power2.inOut'}},9.408);
      tl.to(TH.items[6].inner,{{rotationX:-90,duration:.20,ease:'power2.in'}},9.506);
      tl.set('#s06-shop-a',{{autoAlpha:0}},9.706);
      tl.set('#s06-shop-b',{{autoAlpha:1}},9.706);
      tl.to(TH.items[6].inner,{{rotationX:0,duration:.22,ease:'power2.out'}},9.706);

      // 61.068 -> 61.301 — the trade tap and the fill. Spectral moment 2 of 4.
      tl.to('#s06-trade-ok',{{scale:.92,duration:.066,ease:'power2.out'}},15.255);
      tl.to('#s06-trade-ok',{{scale:1,duration:.12,ease:"power2.inOut"}},15.330);
      tl.to(TH.items[9].inner,{{rotationX:-90,duration:.20,ease:'power2.in'}},15.288);
      tl.set('#s06-trade-a',{{autoAlpha:0}},15.488);
      tl.set('#s06-trade-b',{{autoAlpha:1}},15.488);
      tl.to(TH.items[9].inner,{{rotationX:0,duration:.22,ease:'power2.out'}},15.488);
      tl.fromTo('#s06-trade-spectral',{{opacity:0}},{{opacity:.9,duration:.14,ease:'power2.out'}},15.488);
      tl.to('#s06-trade-spectral',{{opacity:0,duration:.62,ease:'power2.inOut'}},15.70);

      // 66.80-67.27 — the halftone field fills one column per hit of the accel roll
      for(var c=0;c<14;c++){{
        var col=[]; for(var r=0;r<5;r++) col.push($('#s06-hd'+(r*14+c)));
        tl.to(col,{{opacity:.92,duration:.16,ease:'power2.out'}},20.944+c*.0548);
      }}
      // 67.524 — the result. The orb rises through the clouds it was asked for.
      tl.to(TH.items[12].inner,{{rotationX:-90,duration:.18,ease:'power2.in'}},21.531);
      tl.set('#s06-zap-a',{{autoAlpha:0}},21.711);
      tl.set('#s06-zap-b',{{autoAlpha:1}},21.711);
      tl.to(TH.items[12].inner,{{rotationX:0,duration:.20,ease:'power2.out'}},21.711);
      tl.to('#s06-zorb',{{y:52,autoAlpha:1,duration:.5,ease:'power2.out'}},21.76);
      tl.to('#s06-zorb',{{y:-6,duration:2.6,ease:'none'}},22.26);
      $$('#s06-zres .cl').forEach(function(c,i){{
        tl.to(c,{{x:'-=38',duration:3.0,ease:'none'}},21.76+i*.08);
      }});

      // the right plane: one giant command at a time, its explainer under it
      var CMD=[0.000,6.246,12.446,18.599], OUT=[5.95,12.15,18.30,23.10];
      CMD.forEach(function(t,i){{
        tl.to(slash[i],{{autoAlpha:1,x:0,duration:.62,ease:'expo.out'}},t);
        tl.to(expl[i],{{autoAlpha:1,y:0,duration:.60,ease:'expo.out'}},t+.30);
        tl.to(slash[i],{{autoAlpha:0,x:-120,duration:.30,ease:'power4.in'}},OUT[i]);
        tl.to(expl[i],{{autoAlpha:0,y:-10,duration:.26,ease:'power3.in'}},OUT[i]);
      }});
      // 69.103 — the turn: these are the apps air ships. Next you make your own.
      tl.to(endcap,{{autoAlpha:1,y:0,duration:.62,ease:'expo.out'}},23.290);

      // camera drift, then the exit vector into /create
      tl.to('#s06-right',{{x:-26,duration:24.5,ease:'none'}},0);
      tl.to(ph,{{x:-12,duration:24.5,ease:'none'}},0);"""
print(P.emit('compositions/shot-06-mini-apps.html','shot-06-mini-apps','s06',24.869,STYLE,BODY,SCRIPT))
