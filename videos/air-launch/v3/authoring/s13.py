import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
import parts as P
R='s13-root'
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.phone_css(R,'s13') + """
      #s13-root .ph{left:759px;top:103px;transform-style:preserve-3d}
      #s13-root .ph-body{backface-visibility:hidden}
      #s13-root .scn{position:absolute;inset:0;z-index:2;padding:138px 14px 118px;display:flex;flex-direction:column;
        justify-content:center;gap:9px}
      #s13-root .ph-back{transform-style:preserve-3d;background:#0A0B10;display:flex;flex-direction:column;
        align-items:center;justify-content:center;padding:0 26px}
      #s13-root .ph-back .ti{font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:44px;line-height:1.02;
        color:#F4EFE6;text-align:center;margin-bottom:24px}
      #s13-root .ph-back .cd{font-family:'Azeret Mono',monospace;font-size:50px;color:#fff}
      #s13-root .ph-back .bt{margin-top:32px;padding:13px 30px;border-radius:999px;background:#F4EFE6;color:#0A0B10;
        font-size:17px;font-weight:700}
      #s13-root .ph-back .gl{position:absolute;left:-40%;top:-20%;width:180%;height:70%;
        background:radial-gradient(50% 50% at 50% 50%,rgba(90,150,255,.30),rgba(90,150,255,0) 70%)}
      #s13-root .footscrim{position:absolute;inset:0;pointer-events:none;
        background:linear-gradient(0deg,rgba(4,9,22,.56) 0%,rgba(4,9,22,.20) 28%,rgba(4,9,22,0) 52%)}
      #s13-root .lbl{position:absolute;left:104px;top:944px;font-family:'Azeret Mono',monospace;
        font-size:30px;letter-spacing:.12em;color:var(--ink);text-shadow:0 2px 18px rgba(3,7,18,.82)}"""

def hd(pid, glyph, title, sub, art=None):
    ic = (f'<div data-hf-id="hf-{pid}a" class="art" style="background-image:url(&quot;assets/icons/{art}.png&quot;)"></div>'
          if art else f'<div data-hf-id="hf-{pid}i" class="ic"><div data-hf-id="hf-{pid}g" class="gly" style="background-image:url(&quot;logos/{glyph}&quot;)"></div></div>')
    return (f'<div data-hf-id="hf-{pid}h" class="hd">{ic}<div data-hf-id="hf-{pid}w">'
            f'<div data-hf-id="hf-{pid}t" class="ti">{title}</div><div data-hf-id="hf-{pid}s" class="sb">{sub}</div></div></div>')
def bub(pid, side, text):
    A=' data-layout-allow-overlap="" data-layout-allow-occlusion=""'
    return f'<div data-hf-id="hf-{pid}" class="it {side}"{A}><div data-hf-id="hf-{pid}b" class="bub"{A}>{text}</div></div>'
def card(pid, inner):
    A=' data-layout-allow-overlap="" data-layout-allow-occlusion=""'
    return (f'<div data-hf-id="hf-{pid}" class="it recv"{A}>'
            f'<div data-hf-id="hf-{pid}c" class="card"{A}>{inner}</div></div>')

SC1 = (bub('s09a1','sent','dinner fri 8pm at the usual spot. tell Sam.')
       + bub('s09a2','recv','on it.')
       + card('s09a3', hd('s09a4','glyph-calendar-check.svg','Held · Fri 8:00 pm','table for 2 · the usual spot'))
       + card('s09a5', hd('s09a6','glyph-phone.svg','Text Sam?','sent · 2 min ago')
              + '<div data-hf-id="hf-s13a7" class="done"><span data-hf-id="hf-s13a8">✓</span><span data-hf-id="hf-s13a9">Sent to Sam</span></div>'))
SC2 = (bub('s09b1','sent','/trade')
       + card('s09b2', hd('s09b3','glyph-wallet.svg','Filled · paper','0.05 BTC @ $62,800 · balance $6,860')
              + '<div data-hf-id="hf-s13b4" class="done"><span data-hf-id="hf-s13b5">✓</span><span data-hf-id="hf-s13b6">Order filled</span></div>')
       + bub('s09b7','recv','1 order · $35. shipping label ready.'))
SC3 = (bub('s09c1','sent','confirmed, let&rsquo;s ship it')
       + card('s09c2', hd('s09c3','glyph-miniapp.svg','live · October tour','mini.wzrd.tech/gratitude/tour')
              + '<div data-hf-id="hf-s13c4" class="done"><span data-hf-id="hf-s13c5">✓</span><span data-hf-id="hf-s13c6">Listed in the App Store</span></div>')
       + '<div data-hf-id="hf-s13c7" class="it sys"><div data-hf-id="hf-s13c8" class="bub">source: github.com/gratitude5dee/wzrd-create</div></div>')
BACK = ('<div data-hf-id="hf-s13bk" class="ph-back" id="s13-back" data-layout-allow-overlap="" data-layout-allow-occlusion=""><div data-hf-id="hf-s13bg" class="gl"></div>'
        '<div data-hf-id="hf-s13bt" class="ti"><div data-hf-id="hf-s13bt1">Every date,</div>'
        '<div data-hf-id="hf-s13bt2">every ticket,</div><div data-hf-id="hf-s13bt3">one link.</div></div>'
        '<div data-hf-id="hf-s13bc" class="cd">07:14:22:06</div>'
        '<div data-hf-id="hf-s13bb" class="bt">Tickets</div></div>')

_ph = P.PHONE_HTML.replace('%P%','s13')
_tail = '\n          </div>\n        </div>\n      </div>'
SCREENS = (f'<div data-hf-id="hf-s13s1" class="scn" id="s13-scn1" data-layout-allow-overlap="" data-layout-allow-occlusion="">{SC1}</div>'
           f'<div data-hf-id="hf-s13s2" class="scn" id="s13-scn2" data-layout-allow-overlap="" data-layout-allow-occlusion="">{SC2}</div>'
           f'<div data-hf-id="hf-s13s3" class="scn" id="s13-scn3" data-layout-allow-overlap="" data-layout-allow-occlusion="">{SC3}</div>')
PHONE9 = _ph[:-len(_tail)] + '\n            ' + SCREENS + '\n          </div>\n        </div>\n        ' + BACK + '\n      </div>'

BODY = f"""    <div data-hf-id="hf-s13frame" class="frame clip" id="s13-frame" data-layout-allow-overflow="" data-start="0" data-duration="6.339" data-track-index="1">
      <div data-hf-id="hf-s13wa" class="footscrim"></div>
{PHONE9}
      <div data-hf-id="hf-s13lb" class="lbl" id="s13-lbl" data-layout-allow-overlap="" data-layout-allow-occlusion="">one thread</div>
    </div>"""

SCRIPT = """      var ph=$('#s13-ph'), back=$('#s13-back'), lbl=$('#s13-lbl');
      var scn=[$('#s13-scn1'),$('#s13-scn2'),$('#s13-scn3')];
      gsap.set(back,{rotationY:180,autoAlpha:0});
      // the turn shows the back only while it faces camera; the front steps out for that half
      // once the turn starts the front is edge-on and then gone: clear it rather than
      // leaving a face the audit has to reason about through a 360-degree rotation
      tl.set(scn,{autoAlpha:0},5.18);
      tl.set(back,{autoAlpha:1},5.30);
      tl.set($('#s13-phb'),{autoAlpha:0},5.36);
      tl.set($('#s13-phb'),{autoAlpha:1},5.84);
      tl.set(back,{autoAlpha:0},5.90);
      gsap.set(scn,{autoAlpha:0});
      gsap.set(scn[0],{autoAlpha:1});
      gsap.set(ph,{scale:1.12,rotationY:-14,rotationX:5,x:0,y:0,transformOrigin:'50% 50%'});
      gsap.set(lbl,{autoAlpha:0,y:10});

      // Four hard cuts on four downbeats. A cut here is a re-pose, not a transition: the phone
      // is already at rest in the new attitude on the first frame of the bar.
      function cut(t, pose, which, label){
        tl.set(ph, pose, t);
        tl.set(scn[0],{autoAlpha:which===0?1:0}, t);
        tl.set(scn[1],{autoAlpha:which===1?1:0}, t);
        tl.set(scn[2],{autoAlpha:which===2?1:0}, t);
        if(label!=null){ tl.set(lbl,{textContent:label}, t); tl.fromTo(lbl,{autoAlpha:0,y:10},{autoAlpha:1,y:0,duration:.34,ease:'expo.out'}, t); }
      }
      // Six cuts, one every half bar: the film's fastest passage, and the only place it cuts
      // inside the bar. Each cut re-poses the phone rather than transitioning to it.
      cut(0.000,{scale:1.16,rotationY:-16,rotationX:6,x:-120,y:0},0,'one thread');
      cut(0.790,{scale:1.42,rotationY:-4,rotationX:2,x:190,y:70},0,null);
      cut(1.579,{scale:1.16,rotationY:16,rotationX:-5,x:130,y:0},1,'five mini-apps');
      cut(2.369,{scale:1.52,rotationY:2,rotationX:-2,x:-210,y:-60},1,null);
      cut(3.158,{scale:1.16,rotationY:0,rotationX:0,x:0,y:0},2,'one you built');
      cut(3.948,{scale:1.62,rotationY:-8,rotationX:4,x:150,y:110},2,null);
      // 99.869 — the snare fill tightens the frame for the turn
      tl.to(ph,{scale:1.72,duration:.24,ease:'power2.out'},4.040);
      // 100.589 — the DROP: one full turn, and the app it built is on the back of the phone
      tl.set(lbl,{textContent:'air.'},4.760);
      tl.fromTo(lbl,{autoAlpha:0,y:10},{autoAlpha:1,y:0,duration:.4,ease:'expo.out'},4.760);
      tl.to(ph,{rotationY:346,duration:1.579,ease:'power2.inOut'},4.760);
      tl.to(ph,{scale:.42,y:262,x:392,rotationX:0,duration:1.579,ease:'power2.inOut'},4.760);
      tl.to(lbl,{autoAlpha:0,duration:.3,ease:'power2.in'},6.05);"""
print(P.emit('compositions/shot-13-montage.html','shot-13-montage','s13',6.339,STYLE,BODY,SCRIPT))
