import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
import parts as P
R='s07-root'
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.phone_css(R,'s07') + """
      #s07-root .ph{left:470px;top:103px;transform-style:preserve-3d}
      #s07-root .ph-body{backface-visibility:hidden}
      #s07-root .right{position:absolute;left:1010px;top:0;width:880px;height:1080px}
      #s07-root .slash{position:absolute;left:0;top:286px;font-family:'Azeret Mono',monospace;font-weight:500;
        font-size:190px;letter-spacing:-.05em;color:var(--ink);opacity:.34;white-space:nowrap;
        text-shadow:0 6px 40px rgba(3,7,18,.45)}
      #s07-root .own{position:absolute;left:0;top:268px;font-size:146px;line-height:.92}
      #s07-root .expl{position:absolute;left:4px;top:560px;width:840px}
      #s07-root .expl .mono{font-size:28px;line-height:1.5}
      /* the plan the owner approves, as a .md in Messages */
      #s07-root .att{display:flex;align-items:center;gap:11px;margin:0 14px 10px;padding:11px 13px;border-radius:13px;
        background:rgba(255,255,255,.07);border:1px solid var(--line)}
      #s07-root .att .fi{width:34px;height:42px;border-radius:5px;background:#EDE7DA;position:relative;flex:0 0 auto}
      #s07-root .att .fi::after{content:'MD';position:absolute;left:0;right:0;bottom:5px;text-align:center;
        font-family:'Azeret Mono',monospace;font-size:10px;font-weight:700;color:#2A2E36}
      #s07-root .att .fn{font-size:16px;font-weight:700;color:#fff}
      #s07-root .att .fs{font-family:'Azeret Mono',monospace;font-size:12px;color:rgba(244,239,230,.6);margin-top:2px}
      #s07-root .plan{margin:0 14px 12px;padding:12px 13px;border-radius:13px;background:rgba(4,9,22,.42);
        border:1px solid var(--line);font-family:'Azeret Mono',monospace;font-size:13px;line-height:1.72;
        color:rgba(244,239,230,.8)}
      #s07-root .plan b{color:#fff;font-weight:700}
      /* the progress card updates in place — it never re-sends */
      #s07-root .bar{height:8px;border-radius:5px;background:rgba(255,255,255,.12);margin:2px 14px 12px;overflow:hidden}
      #s07-root .bar i{display:block;height:100%;width:100%;border-radius:5px;background:var(--imsg);
        transform-origin:0% 50%;will-change:transform}
      #s07-root .steps{margin:0 14px 13px}
      #s07-root .st{display:flex;align-items:center;gap:10px;padding:4px 0;font-size:15px;color:rgba(244,239,230,.62)}
      #s07-root .st .dot{width:19px;height:19px;border-radius:50%;border:1.6px solid rgba(255,255,255,.28);
        display:flex;align-items:center;justify-content:center;font-size:12px;color:#06210E;flex:0 0 auto}
      #s07-root .st .dot.on{background:var(--ok);border-color:var(--ok)}
      #s07-root .pct{font-family:'Azeret Mono',monospace;font-size:13px;color:var(--ink)}
      /* the back of the phone: the app it just built, running */
      #s07-root .ph-back{transform-style:preserve-3d;background:#0A0B10;display:flex;flex-direction:column;
        align-items:center;justify-content:center;padding:0 26px}
      #s07-root .ph-back .nv{position:absolute;top:60px;left:0;right:0;text-align:center;
        font-family:'Azeret Mono',monospace;font-size:13px;letter-spacing:.14em;color:rgba(244,239,230,.55)}
      #s07-root .ph-back .ti{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:46px;line-height:1.02;
        color:#F4EFE6;text-align:center;margin-bottom:26px}
      #s07-root .ph-back .cd{font-family:'Azeret Mono',monospace;font-size:52px;letter-spacing:-.02em;color:#fff}
      #s07-root .ph-back .cl{font-family:'Azeret Mono',monospace;font-size:12px;letter-spacing:.22em;
        color:rgba(244,239,230,.5);margin-top:8px}
      #s07-root .ph-back .bt{margin-top:34px;padding:13px 30px;border-radius:999px;background:#F4EFE6;color:#0A0B10;
        font-size:17px;font-weight:700}
      #s07-root .ph-back .gl{position:absolute;left:-40%;top:-20%;width:180%;height:70%;
        background:radial-gradient(50% 50% at 50% 50%,rgba(90,150,255,.30),rgba(90,150,255,0) 70%)}"""

def hd(pid, glyph, title, sub, art=None):
    ic = (f'<div data-hf-id="hf-{pid}a" class="art" style="background-image:url(&quot;assets/icons/{art}.png&quot;)"></div>'
          if art else f'<div data-hf-id="hf-{pid}i" class="ic"><div data-hf-id="hf-{pid}g" class="gly" style="background-image:url(&quot;logos/{glyph}&quot;)"></div></div>')
    return (f'<div data-hf-id="hf-{pid}h" class="hd">{ic}<div data-hf-id="hf-{pid}w">'
            f'<div data-hf-id="hf-{pid}t" class="ti">{title}</div><div data-hf-id="hf-{pid}s" class="sb">{sub}</div></div></div>')

PLAN = (hd('s07pl', None, 'October tour', 'plan · reply yes to build', 'onboarding')
        + '<div data-hf-id="hf-s07att" class="att"><div data-hf-id="hf-s07fi" class="fi"></div>'
          '<div data-hf-id="hf-s07fw"><div data-hf-id="hf-s07fn" class="fn">tour-plan.md</div>'
          '<div data-hf-id="hf-s07fs" class="fs">4 KB · tap to read</div></div></div>'
        '<div data-hf-id="hf-s07pb" class="plan">'
        '<div data-hf-id="hf-s07pl1"><b data-hf-id="hf-s07p1">hero</b> countdown to Oct 4</div>'
        '<div data-hf-id="hf-s07pl2">one scroll · dark · tickets &rarr; dice.fm/xyz</div>'
        '<div data-hf-id="hf-s07pl3"><b data-hf-id="hf-s07p2">dev</b> link.wzrd.tech/gratitude/tour</div></div>')

STEPS=['plan approved','app scaffolded','build · kit resolved','deployed to dev']
steps=''.join(f'<div data-hf-id="hf-s07s{i}" class="st" id="s07-st{i}">'
              f'<div data-hf-id="hf-s07sd{i}" class="dot" id="s07-sd{i}">✓</div>'
              f'<span data-hf-id="hf-s07sx{i}">{s}</span></div>' for i,s in enumerate(STEPS))
PROG = (hd('s07pg', None, 'October tour', 'building', 'onboarding').replace('class="sb">building',
        'class="sb" id="s07-substate">building')
        + '<div data-hf-id="hf-s07bar" class="bar"><i data-hf-id="hf-s07bi" id="s07-bar"></i></div>'
        + f'<div data-hf-id="hf-s07sw" class="steps">{steps}</div>')

DEC = ('<div data-hf-id="hf-s07dfa" class="fa" id="s07-dec-a">'
       + hd('s07dc', 'glyph-miniapp.svg', 'Publish October tour', 'mini.wzrd.tech/gratitude/tour')
       + '<div data-hf-id="hf-s07dbd" class="bd">public · listed in the App Store · source mirrored to wzrd-create</div>'
       '<div data-hf-id="hf-s07drw" class="row"><div data-hf-id="hf-s07dok" class="btn ok" id="s07-dec-ok">Approve</div>'
       '<div data-hf-id="hf-s07ded" class="btn gh">Edit</div></div></div>'
       '<div data-hf-id="hf-s07dfb" class="fb" id="s07-dec-b">'
       + hd('s07dl', 'glyph-miniapp.svg', 'live · October tour', 'mini.wzrd.tech/gratitude/tour')
       + '<div data-hf-id="hf-s07dd" class="done"><span data-hf-id="hf-s07ddk">✓</span>'
         '<span data-hf-id="hf-s07ddt">Listed in the App Store</span></div></div>'
       '<div data-hf-id="hf-s07dsp" class="spectral" id="s07-dec-spectral"></div>')

ITEMS = f"""      var ITEMS=[
        {{kind:'sys', text:'Today · 9:41 AM', pre:true}},
        {{side:'recv', text:'the clip is in your camera roll. want it on a page people can actually buy from?', pre:true, dim:true}},
        {{side:'sent', text:'/create a landing page for my October tour with a ticket link and a countdown'}},
        {{side:'recv', text:'got it — 2 quick questions before I plan this:'}},
        {{side:'recv', text:'1. landing page (one scroll, one call to action), or a product page with a store?'}},
        {{side:'recv', text:'2. dark and cinematic, or bright and simple? (or send a screenshot you like)'}},
        {{side:'sent', text:'landing page. dark. tickets are on dice.fm/xyz'}},
        {{kind:'card', side:'recv', html:{PLAN!r}}},
        {{side:'sent', text:'make the countdown the hero. yes.'}},
        {{kind:'card', side:'recv', html:{PROG!r}}},
        {{side:'recv', text:'dev build is live: link.wzrd.tech/gratitude/tour — share it with anyone. say ship it when you want it in production.'}},
        {{side:'sent', text:'confirmed, let&rsquo;s ship it'}},
        {{kind:'card', side:'recv', html:{DEC!r}}},
        {{kind:'sys', text:'source: github.com/gratitude5dee/wzrd-create/apps/gratitude/tour'}}
      ];"""

BACK = ('<div data-hf-id="hf-s07bk" class="ph-back" id="s07-back" data-layout-allow-overlap="" data-layout-allow-occlusion="">'
        '<div data-hf-id="hf-s07bg" class="gl"></div>'
        '<div data-hf-id="hf-s07bn" class="nv">OCTOBER TOUR</div>'
        '<div data-hf-id="hf-s07bt" class="ti"><div data-hf-id="hf-s07bt1">Every date,</div>'
        '<div data-hf-id="hf-s07bt2">every ticket,</div><div data-hf-id="hf-s07bt3">one link.</div></div>'
        '<div data-hf-id="hf-s07bc" class="cd" id="s07-count">07:14:22:09</div>'
        '<div data-hf-id="hf-s07bl" class="cl">DAYS HRS MIN SEC</div>'
        '<div data-hf-id="hf-s07bb" class="bt">Tickets</div></div>')

_ph = P.PHONE_HTML.replace('%P%','s07')
_tail = '\n          </div>\n        </div>\n      </div>'
assert _ph.endswith(_tail), _ph[-90:]
# the back face is a SIBLING of the body inside the 3D-preserving .ph, not a child of it:
# a backface-hidden parent would take its children with it on the flip.
PHONE7 = _ph[:-len(_tail)] + '\n          </div>\n        </div>\n        ' + BACK + '\n      </div>'

BODY = f"""    <div data-hf-id="hf-s07frame" class="frame clip" id="s07-frame" data-layout-allow-overflow="" data-start="0" data-duration="18.854" data-track-index="1">
      <div data-hf-id="hf-s07wa" class="washL"></div>
      <div data-hf-id="hf-s07wb" class="washR"></div>
      <div data-hf-id="hf-s07rt" class="right" id="s07-right">
        <div data-hf-id="hf-s07sl" class="slash" id="s07-slash">/create</div>
        <div data-hf-id="hf-s07ow" class="giant own" id="s07-own"><span data-hf-id="hf-s07w1" class="w">YOUR&nbsp;</span><span data-hf-id="hf-s07w2" class="w">OWN.</span></div>
        <div data-hf-id="hf-s07ex" class="expl" id="s07-expl"><div data-hf-id="hf-s07em" class="mono">describe it. approve the plan. it ships.</div></div>
      </div>
{PHONE7}
    </div>"""

SCRIPT = P.THREAD_JS + f"""
{ITEMS}
      var threadEl=$('#s07-thread'); threadEl.setAttribute('data-bottom','634');
      var TH=buildThread(threadEl, ITEMS);
      var ph=$('#s07-ph'), comp=$('#s07-composer-txt'), cglow=$('#s07-composer-glow');
      var back=$('#s07-back'), slash=$('#s07-slash'), own=$$('#s07-own .w'), expl=$('#s07-expl');

      gsap.set(ph,{{rotationY:-9,rotationX:4,scale:1.06,transformOrigin:'50% 50%'}});
      // the back face is only in the frame for the flip: hidden otherwise, so it can never
      // be mistaken for a layer sitting on top of the thread
      gsap.set(back,{{rotationY:180,autoAlpha:0}});
      tl.set(back,{{autoAlpha:1}},14.32);
      tl.set(back,{{autoAlpha:0}},15.62);
      // and the front leaves with it: it is already backface-hidden, this only makes that explicit
      tl.set($('#s07-phb'),{{autoAlpha:0}},14.34);
      tl.set($('#s07-phb'),{{autoAlpha:1}},15.60);
      gsap.set(slash,{{autoAlpha:0,x:60}});
      gsap.set(own,{{y:'0.6em',autoAlpha:0,rotationX:24,transformOrigin:'50% 80%'}});
      gsap.set(expl,{{autoAlpha:0,y:14}});
      gsap.set('#s07-dec-b',{{autoAlpha:0}});
      gsap.set('#s07-dec-spectral',{{opacity:0}});
      gsap.set('#s07-bar',{{scaleX:.10}});
      gsap.set($$('#s07-sd0,#s07-sd1,#s07-sd2,#s07-sd3'),{{autoAlpha:.001}});
      gsap.set($$('.st'),{{opacity:.5}});

      // 70.682 — the prompt types itself in the composer, on the notes-typing cadence
      tl.to(cglow,{{opacity:.5,duration:.3,ease:'power2.out'}},0);
      typeText(tl,comp,'/create a landing page for my October tour with a ticket link and a countdown',0,1.42);
      tl.to(cglow,{{opacity:0,duration:.2,ease:'power2.in'}},1.46);
      tl.set(comp,{{textContent:''}},1.532);

      // 72.214 -> 76.974 — at most three questions, then a plan as a .md you can read
      showItem(tl,TH,1.532,2,{{slide:.34}});
      showItem(tl,TH,3.088,3,{{slide:.30}});
      showItem(tl,TH,3.48,4,{{slide:.40}});
      showItem(tl,TH,4.667,5,{{slide:.42}});
      showItem(tl,TH,5.503,6,{{slide:.34}});
      showItem(tl,TH,6.292,7,{{slide:.42}});
      // 78.530 — "yes" is the only thing standing between a plan and a running app
      showItem(tl,TH,7.848,8,{{slide:.30}});
      showItem(tl,TH,8.05,9,{{slide:.42}});

      // 78.530 -> 82.477 — one card, updated in place: 10% to 100% and four steps checked
      var pct={{v:10}}, pctEl=$('#s07-substate');
      tl.to(pct,{{v:100,duration:3.75,ease:'power1.inOut',onUpdate:function(){{
        pctEl.textContent='building · '+Math.round(pct.v)+'%';
      }}}},8.05);
      tl.to('#s07-bar',{{scaleX:1,duration:3.75,ease:'power1.inOut'}},8.05);
      [[0,8.30],[1,9.427],[2,11.006],[3,11.795]].forEach(function(s){{
        tl.to('#s07-sd'+s[0],{{autoAlpha:1,duration:.001}},s[1]);
        tl.to('#s07-sd'+s[0],{{className:'dot on',duration:.001}},s[1]);
        tl.to('#s07-st'+s[0],{{opacity:1,duration:.26,ease:'power2.out'}},s[1]);
      }});
      tl.set(pctEl,{{textContent:'dev build live · 100%'}},11.90);

      // 83.244 — the dev URL is real and shareable before anything ships
      showItem(tl,TH,12.562,10,{{slide:.42}});

      // 84.822 — the phone turns over: the app it just built, running, countdown as the hero
      tl.to(ph,{{rotationY:171,duration:.70,ease:'expo.inOut'}},14.140);
      tl.to(ph,{{scale:1.12,duration:.35,ease:'power2.out'}},14.140);
      tl.to(ph,{{scale:1.06,duration:.35,ease:'power2.in'}},14.490);
      ['07:14:22:08','07:14:22:07','07:14:22:06'].forEach(function(v,i){{
        tl.set('#s07-count',{{textContent:v}},14.60+i*.3947);
      }});
      tl.to(ph,{{rotationY:-9,duration:.62,ease:'expo.inOut'}},15.301);

      // 86.378 — the DROP at 86: nothing else moves on this line
      showItem(tl,TH,15.696,11,{{slide:.34}});
      // 86.936 — the decision card. Publishing is a tap, and only the owner can make it.
      showItem(tl,TH,16.254,12,{{slide:.42}});
      tl.to('#s07-dec-ok',{{scale:.92,duration:.066,ease:'power2.out'}},17.275);
      tl.to('#s07-dec-ok',{{scale:1,duration:.12,ease:'power2.inOut'}},17.350);
      tl.to(TH.items[12].inner,{{rotationX:-90,duration:.20,ease:'power2.in'}},17.34);
      tl.set('#s07-dec-a',{{autoAlpha:0}},17.54);
      tl.set('#s07-dec-b',{{autoAlpha:1}},17.54);
      tl.to(TH.items[12].inner,{{rotationX:0,duration:.22,ease:'power2.out'}},17.54);
      // spectral moment 3 of 4
      tl.fromTo('#s07-dec-spectral',{{opacity:0}},{{opacity:.9,duration:.14,ease:'power2.out'}},17.54);
      tl.to('#s07-dec-spectral',{{opacity:0,duration:.66,ease:'power2.inOut'}},17.76);
      showItem(tl,TH,18.50,13,{{slide:.30}});

      // the right plane: /create holds the whole build, then the payoff word on the flip
      tl.to(slash,{{autoAlpha:1,x:0,duration:.64,ease:'expo.out'}},0.10);
      tl.to(expl,{{autoAlpha:1,y:0,duration:.60,ease:'expo.out'}},0.50);
      tl.to(slash,{{autoAlpha:0,x:-120,duration:.30,ease:'power4.in'}},13.90);
      tl.to(expl,{{autoAlpha:0,y:-10,duration:.26,ease:'power3.in'}},13.90);
      tl.to(own,{{y:0,autoAlpha:1,rotationX:0,duration:.70,ease:'expo.out',stagger:.05}},14.140);

      // camera drift, then the exit vector into "yours"
      tl.to('#s07-right',{{x:-24,duration:18.4,ease:'none'}},0);
      tl.to(ph,{{x:-10,duration:18.4,ease:'none'}},0);
      tl.to('#s07-right',{{x:-230,autoAlpha:0,duration:.30,ease:'power4.in'}},18.55);"""
print(P.emit('compositions/shot-07-create.html','shot-07-create','s07',18.854,STYLE,BODY,SCRIPT))
