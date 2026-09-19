import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
import parts as P
R='s02-root'
STYLE = P.FONTS + "\n" + P.tokens(R) + "\n" + P.fx_css(R) + "\n" + P.phone_css(R,'s02') + """
      #s02-root .ph{left:1180px;top:103px}
      #s02-root .seed{position:absolute;left:1180px;top:103px;width:402px;height:874px;border-radius:56px;
        background:#0C72D8;box-shadow:0 22px 60px rgba(10,60,140,.5);will-change:transform,opacity}
      #s02-root .stanza{position:absolute;left:150px;top:252px;width:900px}
      #s02-root .ln{font-size:170px;margin-bottom:6px}
      #s02-root .caps{position:absolute;left:152px;top:842px;width:820px}
      #s02-root .caps .mono{margin-top:10px}
      #s02-root .dotswrap{position:absolute;left:14px;bottom:78px;z-index:3}
      #s02-root .slamblack{position:absolute;inset:0;background:#000;opacity:0}"""

def card(cid, glyph, title, sub, body=None, rows=None, fixed=None):
    h = f' style="height:{fixed}px"' if fixed else ''
    b = f'<div data-hf-id="hf-{cid}bd" class="bd">{body}</div>' if body else ''
    r = rows or ''
    return (f'<div data-hf-id="hf-{cid}hd" class="hd"><div data-hf-id="hf-{cid}ic" class="ic">'
            f'<div data-hf-id="hf-{cid}ig" class="gly" style="background-image:url(&quot;logos/{glyph}&quot;)"></div></div>'
            f'<div data-hf-id="hf-{cid}tw"><div data-hf-id="hf-{cid}ti" class="ti">{title}</div>'
            f'<div data-hf-id="hf-{cid}sb" class="sb">{sub}</div></div></div>{b}{r}')

DECISION = ('<div data-hf-id="hf-s02df" class="fa" id="s02-face-a">'
  + card('s02d','glyph-phone.svg','Text Sam?','draft · tap to send',
         '“dinner fri 8pm, usual spot. see you there.”',
         '<div data-hf-id="hf-s02drow" class="row"><div data-hf-id="hf-s02dok" class="btn ok" id="s02-approve">Approve</div>'
         '<div data-hf-id="hf-s02ded" class="btn gh">Edit</div></div>')
  + '</div><div data-hf-id="hf-s02db" class="fb" id="s02-face-b">'
  + card('s02e','glyph-phone.svg','Text Sam?','sent · 2 min ago',None,
         '<div data-hf-id="hf-s02done" class="done"><span data-hf-id="hf-s02dk">✓</span><span data-hf-id="hf-s02dt">Sent to Sam</span></div>')
  + '</div><div data-hf-id="hf-s02dsp" class="spec" id="s02-spec"></div>')

ITEMS = f"""      var ITEMS=[
        {{kind:'sys', text:'Today · 8:42 AM', pre:true}},
        {{side:'recv', text:'flights for the 12th are held, not booked.', pre:true, dim:true}},
        {{side:'sent', text:'hold them till friday', pre:true, dim:true}},
        {{side:'recv', text:'done. also the invoice from thursday cleared.', pre:true, dim:true}},
        {{side:'recv', text:'morning — your inbox is clear. three things need you today.', pre:true, dim:true}},
        {{side:'sent', text:'nice. i&rsquo;ll look after lunch.', pre:true, dim:true}},
        {{side:'sent', text:'dinner fri 8pm at the usual spot. tell Sam.'}},
        {{side:'recv', text:'on it.'}},
        {{kind:'card', side:'recv', html:{card('s02a','glyph-mail.svg','Reservation request','sent from your inbox')!r}}},
        {{kind:'card', side:'recv', html:{card('s02b','glyph-calendar-check.svg','Held · Fri 8:00 pm','table for 2 · the usual spot')!r}}},
        {{kind:'card', side:'recv', html:{DECISION!r}}},
        {{kind:'sys', text:'remembered: Sam · Fridays · the usual spot'}}
      ];"""

# MASKED HEADING (React Bits): the hero line is not filled with a flat colour — a drifting
# colour mesh shows through the glyphs, and each word is uncovered from under its own clip
# rather than faded up. The line arrives the way a title sequence arrives.
STANZA = ''.join(f'<div data-hf-id="hf-s02l{i}" class="giant ln mhead mesh" id="s02-l{i}">'
                 + ''.join(f'<span data-hf-id="hf-s02mw{i}{j}" class="mw">'
                           f'<span data-hf-id="hf-s02w{i}{j}" class="w">{w}</span></span>&nbsp;'
                           for j,w in enumerate(t.split()))
                 + '</div>' for i,t in enumerate(['TEXT IT','LIKE A','FRIEND.']))

BODY = f"""    <div data-hf-id="hf-s02frame" class="frame clip" id="s02-frame" data-layout-allow-overflow="" data-start="0" data-duration="14.188" data-track-index="1">
      <div data-hf-id="hf-s02stg" class="stage" id="s02-stage">
      <div data-hf-id="hf-s02st" class="stanza" id="s02-stanza">{STANZA}</div>
      <div data-hf-id="hf-s02cp" class="caps" id="s02-caps">
        <div data-hf-id="hf-s02c1" class="mono" id="s02-cap1">its own email address, working around the clock.</div>
        <div data-hf-id="hf-s02c2" class="mono" id="s02-cap2">a real machine that remembers everything for you.</div>
      </div>
      <div data-hf-id="hf-s02sd" class="seed" id="s02-seed"></div>
{P.PHONE_HTML.replace('%P%','s02')}
      </div>
      <div data-hf-id="hf-s02hf" class="hitflash" id="s02-hitflash"></div>
      <div data-hf-id="hf-s02sl" class="slamblack" id="s02-slam"></div>
    </div>"""

SCRIPT = P.THREAD_JS + P.FX_JS + f"""
{ITEMS}
      var threadEl=$('#s02-thread'); threadEl.setAttribute('data-bottom','614');
      var TH=buildThread(threadEl, ITEMS); TH.el=threadEl;
      

      // the typing indicator lives outside the flow so it can vanish without moving the column
      var dw=el('div','dotswrap'); var dots=el('div','dots');
      for(var d=0;d<3;d++) dots.appendChild(el('i'));
      dw.appendChild(dots); $('#s02-screen').appendChild(dw);
      gsap.set(dw,{{autoAlpha:0}}); gsap.set(dots.querySelectorAll('i'),{{opacity:.55}});

      var ph=$('#s02-ph'), seed=$('#s02-seed'), stanza=$('#s02-stanza');
      var lines=[$$('#s02-l0 .w'),$$('#s02-l1 .w'),$$('#s02-l2 .w')];
      var caps=[$('#s02-cap1'),$('#s02-cap2')];
      // SPLIT TEXT (React Bits): the captions arrive a character at a time, so the line
      // reads as something being said rather than something being displayed.
      caps.forEach(function(c){{
        var txt=c.textContent; c.textContent='';
        for(var i=0;i<txt.length;i++){{
          var sp=document.createElement('span');
          sp.className='ch'; sp.textContent=txt[i]==' '?'\u00a0':txt[i];
          c.appendChild(sp);
        }}
        c.classList.add('split');
      }});
      var capChs=[$$('#s02-cap1 .ch'),$$('#s02-cap2 .ch')];

      gsap.set(ph,{{autoAlpha:0,rotationY:-9,rotationX:4,scale:1.06,transformOrigin:'50% 50%'}});
      gsap.set(seed,{{x:-421,scaleX:.796,scaleY:.071,transformOrigin:'50% 50%'}});
      lines.forEach(function(ws){{ gsap.set(ws,{{yPercent:114,autoAlpha:0,backgroundPosition:'0% 50%'}}); }});
      gsap.set(caps,{{autoAlpha:1,y:0}});
      capChs.forEach(function(cs){{ gsap.set(cs,{{y:14,autoAlpha:0,rotationX:-38,transformOrigin:'50% 100%'}}); }});
      gsap.set($('#s02-face-b'),{{autoAlpha:0}});
      gsap.set($('#s02-spec'),{{opacity:0}});
      gsap.set($('#s02-slam'),{{opacity:0}});
      var stage=$('#s02-stage'), hf=$('#s02-hitflash');
      gsap.set(hf,{{opacity:0}});
      gsap.set(stage,{{scale:1.38,x:-430,y:20,transformOrigin:'50% 50%'}});

      // 10.170 (0.000) — the bubble the four banners collapsed into becomes the phone.
      // One object across the seam: no dissolve, no cut you can see.
      tl.to(seed,{{x:0,scaleX:1,scaleY:1,duration:.45,ease:'expo.out'}},0);
      tl.to(ph,{{autoAlpha:1,duration:.30,ease:'power2.out'}},.28);
      tl.to(seed,{{autoAlpha:0,duration:.22,ease:'power2.inOut'}},.34);

      // the camera: tight on the first message, open for the stanza, macro for the tap
      cam(tl,stage,0.349,{{scale:1.38,x:-430,y:20,d:.8,e:'expo.out'}});
      cam(tl,stage,3.019,{{scale:1.0,x:0,y:0,d:1.6,e:'expo.out'}});
      cam(tl,stage,10.60,{{scale:1.46,x:-360,y:-40,d:1.1,e:'expo.out'}});
      cam(tl,stage,12.10,{{scale:1.0,x:0,y:0,d:1.3,e:'expo.out'}});
      var T=[.349, 3.019, 4.551, 6.107, 7.616, 12.260];
      // 10.519 — the first thing you see it do is the thing you already do
      hit(tl,stage,.349,{{base:1.38,amt:.018}});
      showItem(tl,TH,T[0],3,{{slide:.36}});
      // 11.587 — typing dots ride the sustained hihat fill 9.543-13.259 (absolute)
      tl.to(dw,{{autoAlpha:1,duration:.2,ease:'power2.out'}},1.417);
      typeDots(tl,dots,[1.44,1.63,1.82,2.01,2.20,2.39,2.58,2.77,2.96]);
      tl.to(dw,{{autoAlpha:0,duration:.14,ease:'power2.in'}},2.98);
      // 13.189 — "on it." and the first line of the stanza land on the same downbeat
      hit(tl,stage,3.019,{{amt:.026}});
      showItem(tl,TH,T[1],4,{{slide:.36}});
      // 14.721 / 16.277 / 17.786 — inbox, the hold, the decision
      hit(tl,stage,4.551,{{amt:.016}});
      showItem(tl,TH,T[2],5,{{slide:.42}});
      hit(tl,stage,6.107,{{amt:.022}});
      showItem(tl,TH,T[3],6,{{slide:.42}});
      hit(tl,stage,7.616,{{amt:.018}});
      showItem(tl,TH,T[4],7,{{slide:.42}});
      // 18.158 — the decision card settles with one specular pass (holo, no rainbow)
      tl.fromTo($('#s02-spec'),{{xPercent:-60,opacity:0}},{{xPercent:60,opacity:.5,duration:.34,ease:'power2.out'}},7.988);
      tl.to($('#s02-spec'),{{opacity:0,duration:.3,ease:'power2.in'}},8.33);
      // 22.430 — the memory chip: the computer that remembers
      hit(tl,stage,12.260,{{amt:.016}});
      showItem(tl,TH,T[5],8,{{slide:.42}});

      // the stanza: the hero line, one clause per downbeat, behind the phone at depth 0
      [3.019,6.107,9.149].forEach(function(t,i){{
        tl.to(lines[i],{{yPercent:0,autoAlpha:1,duration:.74,ease:'expo.out',stagger:.075}},t);
        // the mesh keeps moving under the glyphs long after the word has landed
        tl.to(lines[i],{{backgroundPosition:'190% 50%',duration:5.4,ease:'sine.inOut',stagger:.075}},t);
      }});
      tl.to(capChs[0],{{y:0,autoAlpha:1,rotationX:0,duration:.46,ease:'back.out(1.7)',stagger:.011}},4.551);
      tl.to(capChs[1],{{y:0,autoAlpha:1,rotationX:0,duration:.46,ease:'back.out(1.7)',stagger:.011}},12.260);

      // 21.223 — the tap. Nothing moves money or messages without this gesture.
      hit(tl,stage,11.053,{{base:1.46,amt:.020}});
      tl.to($('#s02-approve'),{{scale:.92,duration:.066,ease:'power2.out'}},11.053);
      tl.to($('#s02-approve'),{{scale:1,duration:.12,ease:'power2.inOut'}},11.128);
      tl.to(TH.items[10].inner,{{rotationX:-90,duration:.22,ease:'power2.in'}},11.22);
      tl.set($('#s02-face-a'),{{autoAlpha:0}},11.44);
      tl.set($('#s02-face-b'),{{autoAlpha:1}},11.44);
      tl.to(TH.items[10].inner,{{rotationX:0,duration:.23,ease:'power2.out'}},11.44);

      // slow camera: the world drifts left under the phone, 1.2% across the shot
      tl.to(stanza,{{x:-22,duration:13.9,ease:'none'}},0);
      tl.to(ph,{{x:-9,duration:13.9,ease:'none'}},0);

      // 24.358 — the crash. The phone comes at camera and its black screen becomes the cut;
      // S03 opens on the sunrise crest one frame later.
      tl.to(stanza,{{x:-230,autoAlpha:0,duration:.30,ease:'power4.in'}},13.90);
      tl.to(caps,{{autoAlpha:0,duration:.2,ease:'power2.in'}},13.90);
      hit(tl,stage,13.938,{{amt:.05,flash:hf,flashAmt:.34,flashD:.24,shake:10}});
      tl.to(ph,{{scale:2.9,rotationY:0,rotationX:0,x:-160,duration:.25,ease:'power4.in'}},13.938);
      tl.to($('#s02-slam'),{{opacity:1,duration:.10,ease:'power2.in'}},14.088);"""
print(P.emit('compositions/shot-02-imessage-thread.html','shot-02-imessage-thread','s02',14.188,STYLE,BODY,SCRIPT))
