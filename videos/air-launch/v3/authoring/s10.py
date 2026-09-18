import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P, mini_common as M
R='s10-root'; PFX='s10'
STYLE = M.base_style(R, """
      #s10-root .slash{top:250px;font-size:186px}
      #s10-root .att{display:flex;align-items:center;gap:11px;margin:0 14px 10px;padding:11px 13px;border-radius:13px;
        background:rgba(255,255,255,.07);border:1px solid var(--line)}
      #s10-root .att .fi{width:34px;height:42px;border-radius:5px;background:#EDE7DA;position:relative;flex:0 0 auto}
      #s10-root .att .fi::after{content:'MD';position:absolute;left:0;right:0;bottom:5px;text-align:center;
        font-family:'Azeret Mono',monospace;font-size:10px;font-weight:700;color:#2A2E36}
      #s10-root .att .fn{font-size:16px;font-weight:700;color:#fff}
      #s10-root .att .fs{font-family:'Azeret Mono',monospace;font-size:12px;color:rgba(244,239,230,.7);margin-top:2px}
      #s10-root .plan{margin:0 14px 12px;padding:12px 13px;border-radius:13px;background:rgba(4,9,22,.42);
        border:1px solid var(--line);font-family:'Azeret Mono',monospace;font-size:13px;line-height:1.72;
        color:rgba(244,239,230,.84)}
      #s10-root .plan b{color:#fff;font-weight:700}
      /* the plan, at the size a person actually reads it */
      #s10-root .doc{position:absolute;left:1080px;top:150px;width:720px;border-radius:26px;padding:34px 38px 30px;
        background:rgba(6,12,28,.72);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(20px);
        box-shadow:0 46px 96px rgba(2,6,18,.6)}
      #s10-root .doc .fh{display:flex;align-items:center;gap:14px;margin-bottom:22px}
      #s10-root .doc .fh .fi{width:46px;height:56px;border-radius:7px;background:#EDE7DA;position:relative;flex:0 0 auto}
      #s10-root .doc .fh .fi::after{content:'MD';position:absolute;left:0;right:0;bottom:7px;text-align:center;
        font-family:'Azeret Mono',monospace;font-size:13px;font-weight:700;color:#2A2E36}
      #s10-root .doc .fh .fn{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:38px;color:var(--ink)}
      #s10-root .doc .ln{font-family:'Azeret Mono',monospace;font-size:19px;line-height:2.0;
        color:rgba(244,239,230,.82);display:flex;gap:14px;will-change:transform,opacity}
      #s10-root .doc .ln b{color:#fff;font-weight:500;min-width:74px;display:inline-block}""")

PLAN = (M.hd('s10pl', None, 'October tour', 'plan · reply yes to build', 'onboarding')
        + '<div data-hf-id="hf-s10att" class="att"><div data-hf-id="hf-s10fi" class="fi"></div>'
          '<div data-hf-id="hf-s10fw"><div data-hf-id="hf-s10fn" class="fn">tour-plan.md</div>'
          '<div data-hf-id="hf-s10fs" class="fs">4 KB · tap to read</div></div></div>')

ITEMS = f"""      var ITEMS=[
        {{kind:'sys', text:'Today · 9:41 AM', pre:true}},
        {{side:'recv', text:'the clip is in your camera roll. want it on a page people can actually buy from?', pre:true, dim:true}},
        {{side:'sent', text:'/create a landing page for my October tour with a ticket link and a countdown'}},
        {{side:'recv', text:'got it — 2 quick questions before I plan this:'}},
        {{side:'recv', text:'1. landing page (one scroll, one call to action), or a product page with a store?'}},
        {{side:'recv', text:'2. dark and cinematic, or bright and simple? (or send a screenshot you like)'}},
        {{side:'sent', text:'landing page. dark. tickets are on dice.fm/xyz'}},
        {{kind:'card', side:'recv', html:{PLAN!r}}}
      ];"""

DOCLINES=[('hero','countdown to Oct 4'),('page','one scroll · dark'),('tickets','dice.fm/xyz'),('dev','link.wzrd.tech/gratitude/tour')]
doc = "".join(f'<div data-hf-id="hf-s10d{i}" class="ln" id="s10-d{i}"><b data-hf-id="hf-s10db{i}">{a}</b>'
              f'<span data-hf-id="hf-s10ds{i}">{b}</span></div>' for i,(a,b) in enumerate(DOCLINES))

BODY = f"""    <div data-hf-id="hf-s10frame" class="frame clip" id="s10-frame" data-layout-allow-overflow="" data-start="0" data-duration="7.848" data-track-index="1">
      <div data-hf-id="hf-s10wa" class="washL"></div>
      <div data-hf-id="hf-s10wb" class="washR"></div>
      <div data-hf-id="hf-s10st" class="stage" id="s10-stage">
{M.right_plane(PFX,'/create','describe it. approve the plan. it ships.')}
{M.phone(PFX)}
        <div data-hf-id="hf-s10dc" class="doc" id="s10-doc">
          <div data-hf-id="hf-s10fh" class="fh"><div data-hf-id="hf-s10dfi" class="fi"></div>
            <div data-hf-id="hf-s10dfn" class="fn">tour-plan.md</div></div>
          {doc}
        </div>
      </div>
      <div data-hf-id="hf-s10hf" class="hitflash" id="s10-flash"></div>
    </div>"""

SCRIPT = M.COMMON_JS + f"""
{ITEMS}
      var threadEl=$('#s10-thread'); threadEl.setAttribute('data-bottom','634');
      var TH=buildThread(threadEl, ITEMS);
      var stage=rig('s10'), flash=$('#s10-flash');
      var comp=$('#s10-composer-txt'), cglow=$('#s10-composer-glow'), doc=$('#s10-doc');
      var dlines=$$('#s10-doc .ln');
      gsap.set(doc,{{autoAlpha:0,x:48,y:20}});
      gsap.set(dlines,{{autoAlpha:0,x:22}});
      gsap.set(flash,{{opacity:0}});
      gsap.set(stage,{{scale:1.0,transformOrigin:'50% 50%'}});

      // 70.682 — the prompt types itself, the way the product actually starts
      tl.to(cglow,{{opacity:.55,duration:.3,ease:'power2.out'}},0);
      typeText(tl,comp,'/create a landing page for my October tour with a ticket link and a countdown',0,1.42);
      tl.to(cglow,{{opacity:0,duration:.2,ease:'power2.in'}},1.46);
      tl.set(comp,{{textContent:''}},1.532);
      rightIn(tl,'s10',0.10);

      // 72.214 -> 76.185 — at most three questions
      showItem(tl,TH,1.532,2,{{slide:.30}}); hit(tl,stage,1.532,{{amt:.020}});
      showItem(tl,TH,3.088,3,{{slide:.30}}); hit(tl,stage,3.088,{{amt:.012}});
      showItem(tl,TH,3.480,4,{{slide:.38}});
      showItem(tl,TH,4.667,5,{{slide:.42}}); hit(tl,stage,4.667,{{amt:.012}});
      showItem(tl,TH,5.503,6,{{slide:.34}});

      // 76.974 — the plan arrives as a file, and the film shows you the file
      showItem(tl,TH,6.292,7,{{slide:.42}});
      tl.to(doc,{{autoAlpha:1,x:0,y:0,duration:.70,ease:'expo.out'}},6.292);
      rightOut(tl,'s10',6.24);
      dlines.forEach(function(l,i){{
        tl.to(l,{{autoAlpha:1,x:0,duration:.46,ease:'expo.out'}},6.42+i*.13);
      }});
      hit(tl,stage,6.292,{{amt:.022,flash:flash,flashAmt:.12,flashD:.22}});
      cam(tl,stage,6.292,{{scale:1.03,d:1.3,e:'expo.out'}});"""
print(P.emit('compositions/shot-10-create-plan.html','shot-10-create-plan','s10',7.848,STYLE,BODY,SCRIPT))
