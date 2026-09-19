import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P, mini_common as M
R='s06-root'; PFX='s06'
ICONS=[('home','home'),('shop','shop'),('pay','pay'),('inbox','inbox'),('calendar','calendar'),
       ('vault','key vault'),('computer','computer'),('image','imagine'),('video','zap'),('persona','persona')]
STYLE = M.base_style(R, """
      #s06-root .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:11px;padding:2px 14px 14px}
      #s06-root .gi{position:relative;aspect-ratio:1/1;border-radius:16px;background-size:cover;
        background-position:center;will-change:transform,opacity}
      /* the family shot: the grid lifts out of the phone and owns the frame */
      #s06-root .hero{position:absolute;left:214px;top:146px;width:1492px}
      #s06-root .hgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:30px}
      #s06-root .hi{position:relative;will-change:transform,opacity}
      #s06-root .hi .art{width:100%;aspect-ratio:1/1;border-radius:38px;background-size:cover;background-position:center;
        box-shadow:0 26px 54px rgba(3,8,22,.52),0 0 0 1px rgba(255,255,255,.10)}
      #s06-root .hi .nm{margin-top:14px;text-align:center;font-family:'Azeret Mono',monospace;font-size:17px;
        letter-spacing:.06em;color:rgba(244,239,230,.86);text-shadow:0 2px 12px rgba(3,7,18,.7)}
      #s06-root .herocap{position:absolute;left:0;right:0;top:846px;text-align:center}
      #s06-root .herocap .cap{font-size:76px;line-height:1.02}""")

grid = ''.join(f'<div data-hf-id="hf-s06g{i}" class="gi" id="s06-g{i}" style="background-image:url(&quot;assets/icons/{n}.png&quot;)"></div>' for i,(n,_) in enumerate(ICONS))
hero = ''.join(f'<div data-hf-id="hf-s06h{i}" class="hi" id="s06-h{i}">'
               f'<div data-hf-id="hf-s06ha{i}" class="art" style="background-image:url(&quot;assets/icons/{n}.png&quot;)"></div>'
               f'<div data-hf-id="hf-s06hn{i}" class="nm">{lbl}</div></div>' for i,(n,lbl) in enumerate(ICONS))
HOME = M.hd('s06hm', None, 'your apps', 'published · tap to open', 'home') + f'<div data-hf-id="hf-s06grid" class="grid" id="s06-grid">{grid}</div>'

ITEMS = f"""      var ITEMS=[
        {{kind:'sys', text:'Today · 9:14 AM', pre:true}},
        {{side:'recv', text:'shipping label for #218 is printed.', pre:true, dim:true}},
        {{side:'sent', text:'thanks', pre:true, dim:true}},
        {{side:'recv', text:'flights for the 12th are held, not booked.', pre:true, dim:true}},
        {{side:'sent', text:'hold them till friday', pre:true, dim:true}},
        {{side:'recv', text:'morning. inbox is clear, and the invoice from thursday cleared overnight.', pre:true, dim:true}},
        {{side:'sent', text:'anything i need to look at?', pre:true, dim:true}},
        {{side:'recv', text:'nothing urgent. the tour page is up — 2,140 visits since friday.', pre:true, dim:true}},
        {{side:'sent', text:'nice.', pre:true, dim:true}},
        {{side:'sent', text:'/home'}},
        {{kind:'card', side:'recv', html:{HOME!r}}}
      ];"""

BODY = f"""    <div data-hf-id="hf-s06frame" class="frame clip" id="s06-frame" data-layout-allow-overflow="" data-start="0" data-duration="6.246" data-track-index="1">
      <div data-hf-id="hf-s06wa" class="washL"></div>
      <div data-hf-id="hf-s06wb" class="washR"></div>
      <div data-hf-id="hf-s06st" class="stage" id="s06-stage">
{M.right_plane(PFX,'/home','your first-party apps, one text away.')}
{M.phone(PFX)}
        <div data-hf-id="hf-s06hr" class="hero" id="s06-hero"><div data-hf-id="hf-s06hg" class="hgrid">{hero}</div></div>
        <div data-hf-id="hf-s06hc" class="herocap" id="s06-herocap"><div data-hf-id="hf-s06hct" class="cap">your apps. one thread.</div></div>
      </div>
      <div data-hf-id="hf-s06hf" class="hitflash" id="s06-flash"></div>
    </div>"""

SCRIPT = M.COMMON_JS + f"""
{ITEMS}
      var threadEl=$('#s06-thread'); threadEl.setAttribute('data-bottom','622');
      var TH=buildThread(threadEl, ITEMS);
      var stage=rig('s06'), flash=$('#s06-flash');
      var hero=$('#s06-hero'), herocap=$('#s06-herocap'), tiles=$$('#s06-hero .hi');
      gsap.set($$('#s06-grid .gi'),{{autoAlpha:0,scale:.66,transformOrigin:'50% 50%'}});
      gsap.set(hero,{{autoAlpha:0}});
      gsap.set(tiles,{{autoAlpha:0,y:64,scale:.82,transformOrigin:'50% 50%'}});
      gsap.set(herocap,{{autoAlpha:0,y:18}});
      gsap.set($('#s06-composer-txt'),{{textContent:'/home'}});
      gsap.set(stage,{{scale:.965,transformOrigin:'50% 50%'}});
      gsap.set(flash,{{opacity:0}});

      // 45.813 — the command is already typed: the cut lands on send
      showItem(tl,TH,0.000,9,{{slide:.30}});
      tl.set($('#s06-composer-txt'),{{textContent:''}},0.000);
      hit(tl,stage,0.000,{{base:.965,amt:.020}});
      rightIn(tl,'s06',0.06);
      // 47.345 — the launcher card
      showItem(tl,TH,1.532,10,{{slide:.42}});
      hit(tl,stage,1.532,{{base:.965,amt:.016}});
      // 47.09 -> 48.669 — the icons pop one per hihat hit of the sustained fill
      $$('#s06-grid .gi').forEach(function(g,i){{
        tl.to(g,{{autoAlpha:1,scale:1,duration:.32,ease:'back.out(1.7)'}},1.277+i*.158);
      }});

      // 48.901 — THE FAMILY SHOT. The grid leaves the phone and takes the whole frame:
      // the first time in the film the product is bigger than the device.
      tl.to(hero,{{autoAlpha:1,duration:.01}},3.088);
      tl.to('#s06-ph',{{autoAlpha:0,scale:.86,duration:.36,ease:'power3.in'}},3.030);
      rightOut(tl,'s06',3.020);
      tiles.forEach(function(t,i){{
        tl.to(t,{{autoAlpha:1,y:0,scale:1,duration:.62,ease:'expo.out'}},3.088+i*.036);
      }});
      cam(tl,stage,3.088,{{scale:1.02,d:1.4,e:'expo.out'}});
      hit(tl,stage,3.088,{{base:1.02,amt:.030,flash:flash,flashAmt:.20,flashD:.24}});
      tl.to(herocap,{{autoAlpha:1,y:0,duration:.60,ease:'expo.out'}},3.560);
      // 50.480 — one more breath on the downbeat, then the film moves on
      hit(tl,stage,4.667,{{base:1.02,amt:.014}});
      cam(tl,stage,5.10,{{scale:1.06,d:1.1,e:'none'}});
      tl.to(tiles,{{autoAlpha:0,y:-40,duration:.30,ease:'power4.in',stagger:.012}},5.94);
      tl.to(herocap,{{autoAlpha:0,y:-16,duration:.26,ease:'power3.in'}},5.94);"""
print(P.emit('compositions/shot-06-home.html','shot-06-home','s06',6.246,STYLE,BODY,SCRIPT))
