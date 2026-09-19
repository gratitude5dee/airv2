# Shared authoring partials for the air-launch v3 compositions.
# These are spliced into each composition file once, at authoring time; the emitted
# HTML in compositions/ is the source of truth afterwards.

FONTS = """      @font-face{font-family:'Inter';font-weight:400;font-style:normal;font-display:block;src:url('fonts/Inter-400-latin.woff2') format('woff2')}
      @font-face{font-family:'Inter';font-weight:700;font-style:normal;font-display:block;src:url('fonts/Inter-700-latin.woff2') format('woff2')}
      @font-face{font-family:'Newsreader';font-weight:200 800;font-style:normal;font-display:block;src:url('fonts/newsreader-latin.woff2') format('woff2')}
      @font-face{font-family:'Azeret Mono';font-weight:100 900;font-style:normal;font-display:block;src:url('fonts/azeret-mono-latin.woff2') format('woff2')}"""

def tokens(root):
    return f"""      #{root}{{--ink:#F4EFE6;--ink-dim:rgba(244,239,230,.62);--imsg:#0A84FF;--ok:#30D158;--glass:rgba(255,255,255,.08);--line:rgba(255,255,255,.12);
        position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent;
        font-family:'Inter',system-ui,-apple-system,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}}
      #{root} *,#{root} *::before,#{root} *::after{{box-sizing:border-box}}
      #{root} .frame{{position:absolute;inset:0;perspective:1800px}}
      /* parallax planes: the camera proxy moves, the planes follow it by depth */
      #{root} .plane{{position:absolute;inset:0;transform-style:preserve-3d;will-change:transform}}
      #{root} .giant{{font-family:'Newsreader',Georgia,serif;font-weight:300;letter-spacing:-.035em;line-height:.86;
        color:var(--ink);opacity:.92;white-space:nowrap;text-shadow:0 3px 26px rgba(3,7,18,.52)}}
      #{root} .giant .w{{display:inline-block;will-change:transform,opacity;transform-style:preserve-3d}}
      #{root} .wash{{position:absolute;inset:0;pointer-events:none;
        background:radial-gradient(64% 46% at 50% 44%,rgba(4,9,22,.46) 0%,rgba(4,9,22,.20) 56%,rgba(4,9,22,0) 100%)}}
      #{root} .washL{{position:absolute;inset:0;pointer-events:none;
        background:linear-gradient(100deg,rgba(4,9,22,.52) 0%,rgba(4,9,22,.30) 42%,rgba(4,9,22,0) 72%)}}
      #{root} .washR{{position:absolute;inset:0;pointer-events:none;
        background:linear-gradient(262deg,rgba(4,9,22,.54) 0%,rgba(4,9,22,.30) 44%,rgba(4,9,22,0) 76%)}}
      #{root} .cap{{font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:56px;line-height:1.08;color:var(--ink);
        text-shadow:0 3px 24px rgba(3,7,18,.52)}}
      #{root} .mono{{font-family:'Azeret Mono',ui-monospace,monospace;font-weight:400;font-size:25px;letter-spacing:.02em;
        color:rgba(244,239,230,.80);line-height:1.45;text-shadow:0 2px 16px rgba(3,7,18,.60)}}"""

# ---------------------------------------------------------------- the phone
# A DOM/CSS iPhone. Squircle via an SVG superellipse mask, titanium rim, Dynamic Island,
# iOS dark Messages inside. Never a screenshot: every pixel is live DOM so it can be timed.
def phone_css(root, pre):
    return f"""      #{root} .ph{{position:absolute;width:402px;height:874px;will-change:transform}}
      #{root} .ph-body{{position:absolute;inset:0;border-radius:56px;background:linear-gradient(160deg,#3a3f4a 0%,#171b22 38%,#0f1218 100%);
        padding:3px;box-shadow:0 60px 120px rgba(2,6,18,.62),0 12px 30px rgba(2,6,18,.5),inset 0 1px 0 rgba(255,255,255,.16)}}
      #{root} .ph-screen{{position:absolute;inset:3px;border-radius:53px;overflow:hidden;background:#000}}
      #{root} .ph-status{{position:absolute;top:0;left:0;right:0;height:56px;z-index:8;
        display:flex;align-items:center;justify-content:space-between;padding:0 30px;
        font-family:-apple-system,'Inter',system-ui,sans-serif;font-size:16px;font-weight:600;color:#fff;
        letter-spacing:.01em}}
      #{root} .ph-status .ico{{display:flex;align-items:center;gap:7px}}
      #{root} .ph-status svg{{display:block}}
      /* the screen is glass, not a hole: one raking reflection and a soft top light */
      #{root} .ph-sheen{{position:absolute;inset:0;z-index:7;pointer-events:none;
        background:
          linear-gradient(116deg,rgba(255,255,255,.085) 0%,rgba(255,255,255,.02) 22%,
                          rgba(255,255,255,0) 44%,rgba(255,255,255,0) 72%,rgba(255,255,255,.05) 100%),
          radial-gradient(120% 44% at 50% -6%,rgba(190,220,255,.10),rgba(190,220,255,0) 70%)}}
      #{root} .ph-island{{position:absolute;top:14px;left:50%;margin-left:-63px;width:126px;height:37px;border-radius:19px;background:#000;z-index:6}}
      #{root} .ph-nav{{position:absolute;top:0;left:0;right:0;height:134px;z-index:5;
        background:rgba(18,18,20,.82);backdrop-filter:blur(24px) saturate(1.3);border-bottom:1px solid rgba(255,255,255,.08);
        display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:8px;padding-top:56px}}
      #{root} .orb{{background:url('logos/air-icon.svg') center/contain no-repeat;border-radius:50%;flex:0 0 auto}}
      #{root} .gly{{background-position:center;background-repeat:no-repeat;background-size:contain}}
      #{root} .ph-nav .orb{{width:44px;height:44px}}
      #{root} .ph-nav .who{{font-size:13px;font-weight:600;color:#fff;margin-top:3px;letter-spacing:.01em}}
      #{root} .ph-fade{{position:absolute;top:134px;left:0;right:0;height:52px;z-index:4;pointer-events:none;
        background:linear-gradient(180deg,rgba(0,0,0,.88) 0%,rgba(0,0,0,0) 100%)}}
      #{root} .ph-home{{position:absolute;bottom:9px;left:50%;margin-left:-67px;width:134px;height:5px;border-radius:3px;background:rgba(255,255,255,.34);z-index:6}}
      #{root} .ph-composer{{position:absolute;bottom:26px;left:12px;right:12px;height:44px;border-radius:22px;z-index:5;
        border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);display:flex;align-items:center;padding:0 14px;overflow:hidden}}
      #{root} .ph-composer .txt{{font-size:17px;color:#fff;white-space:nowrap;overflow:hidden}}
      #{root} .ph-composer .car{{width:2px;height:19px;background:var(--imsg);margin-left:2px;flex:0 0 auto}}
      #{root} .ph-composer .glow{{position:absolute;inset:-1px;border-radius:22px;pointer-events:none;
        background:linear-gradient(96deg,rgba(10,132,255,.36),rgba(244,239,230,.14) 48%,rgba(10,132,255,.30));opacity:0}}
      /* the thread: a flow column translated by the timeline — never scrollTop */
      #{root} .ph-scroll{{position:absolute;top:134px;left:0;right:0;bottom:0;overflow:hidden;z-index:3}}
      #{root} .ph-thread{{position:absolute;left:0;right:0;top:0;padding:0 14px;display:flex;flex-direction:column;
        align-items:stretch;gap:9px;will-change:transform}}
      #{root} .it{{display:flex;width:100%;will-change:transform,opacity}}
      #{root} .it.sent{{justify-content:flex-end}}
      #{root} .it.recv{{justify-content:flex-start}}
      #{root} .it.sys{{justify-content:center}}
      #{root} .bub{{max-width:78%;padding:9px 14px 10px;font-size:19px;line-height:1.28;border-radius:20px;
        will-change:transform,opacity;transform-origin:100% 100%}}
      #{root} .sent .bub{{background:#0C72D8;color:#fff;border-bottom-right-radius:7px}}
      #{root} .recv .bub{{background:rgba(255,255,255,.14);color:var(--ink);border-bottom-left-radius:7px}}
      #{root} .it.dim{{opacity:.56}}
      #{root} .sys .bub{{background:none;font-family:'Azeret Mono',monospace;font-size:13px;color:rgba(244,239,230,.55);
        text-align:center;max-width:94%;letter-spacing:.01em;line-height:1.35}}
      #{root} .dots{{display:flex;gap:6px;padding:13px 16px;background:rgba(255,255,255,.14);border-radius:20px;border-bottom-left-radius:7px}}
      #{root} .dots i{{width:8px;height:8px;border-radius:50%;background:rgba(244,239,230,.62);display:block;will-change:transform,opacity}}
      /* owner-only mini-app card — the film shows one owner, so cards only ever appear here */
      #{root} .card{{position:relative;width:100%;border-radius:22px;border:1px solid var(--line);background:rgba(255,255,255,.08);
        backdrop-filter:blur(18px) saturate(1.2);overflow:hidden;will-change:transform,opacity;transform-origin:50% 100%}}
      #{root} .card .hd{{display:flex;align-items:center;gap:10px;padding:12px 14px 10px}}
      #{root} .card .hd .art{{width:36px;height:36px;border-radius:10px;flex:0 0 auto;background-size:cover;background-position:center}}
      #{root} .card .hd .ic{{width:36px;height:36px;border-radius:10px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;
        background:rgba(255,255,255,.10);border:1px solid var(--line)}}
      #{root} .card .hd .ic .gly{{width:20px;height:20px;opacity:.92}}
      #{root} .card .ti{{font-size:17px;font-weight:700;color:#fff;letter-spacing:-.005em}}
      #{root} .card .sb{{font-family:'Azeret Mono',monospace;font-size:13px;color:rgba(244,239,230,.78);margin-top:2px}}
      #{root} .card .bd{{padding:0 14px 12px;font-size:16px;line-height:1.35;color:rgba(244,239,230,.86)}}
      #{root} .card .row{{display:flex;gap:8px;padding:0 14px 13px}}
      #{root} .btn{{flex:1;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;
        font-size:16px;font-weight:700;letter-spacing:-.005em;will-change:transform}}
      #{root} .btn.ok{{background:#1FA64F;color:#FFFFFF}}
      #{root} .btn.gh{{background:rgba(255,255,255,.07);border:1px solid var(--line);color:rgba(244,239,230,.82)}}
      #{root} .card .done{{display:flex;align-items:center;gap:8px;padding:0 14px 13px;font-size:16px;font-weight:700;color:var(--ok)}}
      #{root} .card.flip{{transform-style:preserve-3d}}
      #{root} .card .fa{{position:relative}}
      #{root} .card .fb{{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center}}
      /* holo: one moving specular line on a landed card, no rainbow */
      #{root} .card .spec{{position:absolute;inset:0;pointer-events:none;opacity:0;
        background:linear-gradient(104deg,rgba(255,255,255,0) 40%,rgba(255,255,255,.22) 50%,rgba(255,255,255,0) 60%)}}
      /* the four spectral moments, and nowhere else */
      #{root} .spectral{{position:absolute;inset:-1px;border-radius:23px;pointer-events:none;opacity:0;padding:1px;
        background:conic-gradient(from 210deg,#ffd6a5,#fdffb6,#caffbf,#9bf6ff,#bdb2ff,#ffc6ff,#ffd6a5);
        -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}}
      #{root} .ph-back{{position:absolute;inset:0;border-radius:56px;overflow:hidden;background:#07070A;
        border:3px solid #23262d;backface-visibility:hidden;z-index:7;
        box-shadow:0 60px 120px rgba(2,6,18,.62),inset 0 1px 0 rgba(255,255,255,.14)}}"""

PHONE_HTML = """      <div data-hf-id="hf-%P%ph" class="ph" id="%P%-ph">
        <div data-hf-id="hf-%P%phb" class="ph-body" id="%P%-phb">
          <div data-hf-id="hf-%P%scr" class="ph-screen" id="%P%-screen">
            <div data-hf-id="hf-%P%scl" class="ph-scroll" id="%P%-scroll"><div data-hf-id="hf-%P%thr" class="ph-thread" id="%P%-thread"></div></div>
            <div data-hf-id="hf-%P%fade" class="ph-fade"></div>
            <div data-hf-id="hf-%P%nav" class="ph-nav" data-layout-allow-overlap="" data-layout-allow-occlusion=""><div data-hf-id="hf-%P%navi" class="orb"></div><div data-hf-id="hf-%P%navw" class="who">air</div></div>
            <div data-hf-id="hf-%P%sb" class="ph-status" data-layout-allow-overlap="" data-layout-allow-occlusion=""><span data-hf-id="hf-%P%sbt">9:41</span><span data-hf-id="hf-%P%sbi" class="ico"><svg data-hf-id="hf-%P%sg" width="19" height="13" viewBox="0 0 19 13" aria-hidden="true"><rect data-hf-id="hf-%P%s1" x="0" y="9" width="3" height="4" rx="1" fill="#fff"/><rect data-hf-id="hf-%P%s2" x="5" y="6.5" width="3" height="6.5" rx="1" fill="#fff"/><rect data-hf-id="hf-%P%s3" x="10" y="3.5" width="3" height="9.5" rx="1" fill="#fff"/><rect data-hf-id="hf-%P%s4" x="15" y="0" width="3" height="13" rx="1" fill="#fff"/></svg><svg data-hf-id="hf-%P%wf" width="17" height="13" viewBox="0 0 17 13" aria-hidden="true"><path data-hf-id="hf-%P%w1" d="M8.5 11.6 6.2 9.1a3.4 3.4 0 0 1 4.6 0Z" fill="#fff"/><path data-hf-id="hf-%P%w2" d="M3.7 6.4a7.1 7.1 0 0 1 9.6 0l-1.5 1.7a5 5 0 0 0-6.6 0Z" fill="#fff" opacity=".95"/><path data-hf-id="hf-%P%w3" d="M1.1 3.5a10.9 10.9 0 0 1 14.8 0l-1.5 1.7a8.7 8.7 0 0 0-11.8 0Z" fill="#fff" opacity=".9"/></svg><svg data-hf-id="hf-%P%bt" width="27" height="13" viewBox="0 0 27 13" aria-hidden="true"><rect data-hf-id="hf-%P%b1" x=".6" y=".6" width="22" height="11.8" rx="3.4" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="1.2"/><rect data-hf-id="hf-%P%b2" x="2.2" y="2.2" width="16.4" height="8.6" rx="2.2" fill="#fff"/><path data-hf-id="hf-%P%b3" d="M24.4 4.4a2.6 2.6 0 0 1 0 4.2Z" fill="#fff" opacity=".42"/></svg></span></div><div data-hf-id="hf-%P%isl" class="ph-island"></div>
            <div data-hf-id="hf-%P%cmp" class="ph-composer" id="%P%-composer"><div data-hf-id="hf-%P%cmpg" class="glow" id="%P%-composer-glow"></div><div data-hf-id="hf-%P%cmpt" class="txt" id="%P%-composer-txt"></div><div data-hf-id="hf-%P%cmpc" class="car" id="%P%-composer-caret"></div></div>
            <div data-hf-id="hf-%P%shn" class="ph-sheen"></div><div data-hf-id="hf-%P%hb" class="ph-home"></div>
          </div>
        </div>
      </div>"""

# ---------------------------------------------------------------- thread engine
# Builds the thread from a data array at load (synchronously, deterministically), measures
# every item, then drives one column translate per arrival so the newest item always sits on
# the composer. No scrollTop, no rAF, no clocks: a seek reconstructs the exact state.
THREAD_JS = """
      // ---- thread engine (deterministic; see PLAN-v3 3.5) ----
      function el(tag, cls, html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
      function buildThread(threadEl, items){
        var built=[];
        items.forEach(function(it, i){
          var wrap=el('div','it '+(it.kind==='sys'?'sys':(it.side||'recv'))+(it.dim?' dim':''));
          var inner;
          if(it.kind==='dots'){ inner=el('div','dots'); for(var d=0;d<3;d++) inner.appendChild(el('i')); }
          else if(it.kind==='card'){ inner=el('div','card'); inner.innerHTML=it.html; }
          else { inner=el('div','bub', it.text); }
          // a thread genuinely slides under the translucent nav: that layering is the design
          wrap.appendChild(inner); threadEl.appendChild(wrap);
          built.push({wrap:wrap, inner:inner, spec:it});
        });
        // measure once, after the whole column exists
        var gap=9, bottom=Number(threadEl.getAttribute('data-bottom')||760), acc=0, stops=[];
        built.forEach(function(b){ acc += b.wrap.offsetHeight + gap; stops.push(bottom - acc + gap); });
        var th={el:threadEl, items:built, stops:stops, bottom:bottom, start:bottom};
        built.forEach(function(b,i){
          if(b.spec.pre){ gsap.set(b.wrap,{autoAlpha:b.spec.dim?.56:1}); th.start=stops[i]; }
          else gsap.set(b.wrap,{autoAlpha:0});
        });
        gsap.set(threadEl,{y:th.start});
        return th;
      }
      // auto slide duration: never let two column moves overlap on the same property
      function slideFor(times, i){
        var d=.42; if(times[i+1]!=null) d=Math.min(d, Math.max(.16, times[i+1]-times[i]-.02)); return d;
      }
      // Reveal item i: the column rides up by exactly that item's height, the bubble pops.
      function showItem(tl, thread, t, i, opts){
        opts=opts||{};
        var b=thread.items[i], y=thread.stops[i];
        if(b.spec.hold){ y=thread.stops[i]+b.spec.hold; }
        tl.to(thread.el,{y:y,duration:opts.slide||.42,ease:'power3.out'}, t);
        tl.set(b.wrap,{autoAlpha:1}, t);
        if(b.spec.kind==='card'){
          tl.fromTo(b.inner,{y:28,autoAlpha:0,rotationX:12},{y:0,autoAlpha:1,rotationX:0,duration:.55,ease:'expo.out'}, t);
        } else if(b.spec.dim){
          tl.fromTo(b.inner,{y:14,autoAlpha:0},{y:0,autoAlpha:.56,duration:.34,ease:'power3.out'}, t);
        } else if(b.spec.side==='sent'){
          // the one overshoot in the film, because iMessage does it
          tl.fromTo(b.inner,{scale:.86,autoAlpha:0},{scale:1,autoAlpha:1,duration:.32,ease:'back.out(1.4)'}, t);
        } else {
          tl.fromTo(b.inner,{y:14,autoAlpha:0},{y:0,autoAlpha:1,duration:.34,ease:'power3.out'}, t);
        }
      }
      // typing dots ride the hihat hits of a named roll — one lift per hit, never a loop
      function typeDots(tl, dotsEl, hits){
        var ds=dotsEl.querySelectorAll('i');
        hits.forEach(function(h,i){
          var d=ds[i%3];
          tl.to(d,{y:-3,opacity:1,duration:.07,ease:'power2.out'}, h);
          tl.to(d,{y:0,opacity:.55,duration:.16,ease:'power2.inOut'}, h+.07);
        });
      }
      // per-character reveal at a fixed cadence, always landing on the send downbeat
      function typeText(tl, node, text, start, end){
        var per=(end-start)/Math.max(1,text.length);
        for(var c=1;c<=text.length;c++){
          (function(n){ tl.set(node,{textContent:text.slice(0,n)}, start+per*n); })(c);
        }
      }
"""

# The supplied chrome blackletter lives inside a 1920x1080 transparent plate; its ink
# occupies x 87..1797, y 379..801. Frame it by cropping to that ink so the lockup can be
# placed by its optical edges instead of the plate's.
CH_X0, CH_Y0, CH_W, CH_H, CH_PW, CH_PH = 87, 379, 1711, 423, 1920, 1080
def chrome_css(root, cls, width):
    s = width / CH_W
    return (f"      #{root} .{cls}{{position:relative;width:{width:.0f}px;height:{CH_H*s:.1f}px;overflow:hidden;will-change:transform,opacity}}\n"
            f"      #{root} .{cls} img{{position:absolute;left:{-CH_X0*s:.1f}px;top:{-CH_Y0*s:.1f}px;width:{CH_PW*s:.1f}px;height:auto;display:block;\n"
            f"        filter:brightness(1.22) contrast(1.06) drop-shadow(0 0 18px rgba(150,196,255,.34))}}\n"
            f"      #{root} .{cls} .sweep{{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;\n"
            f"        background:linear-gradient(104deg,rgba(255,255,255,0) 38%,rgba(214,236,255,.62) 50%,rgba(255,255,255,0) 62%)}}")
def chrome_html(pid, cls, extra=""):
    return (f'<div data-hf-id="hf-{pid}m" class="{cls}" id="{pid}"{extra}>'
            f'<img data-hf-id="hf-{pid}i" src="logos/wzrdtech-chrome.png" alt="WZRD.tech">'
            f'<div data-hf-id="hf-{pid}s" class="sweep" id="{pid}-sweep"></div></div>')

HEAD = """<template id="%ID%-template">
  <div data-hf-id="hf-%P%root" id="%P%-root" data-composition-id="%ID%" data-start="0" data-width="1920" data-height="1080" data-duration="%DUR%">
    <style>
%STYLE%
    </style>

%BODY%

    <script src="vendor/gsap.min.js"></script>
    <script>
    (function(){
      var root=document.querySelector('[data-composition-id="%ID%"]');
      var $=function(s){return root.querySelector(s);};
      var $$=function(s){return Array.prototype.slice.call(root.querySelectorAll(s));};
      var tl=gsap.timeline({paused:true,defaults:{immediateRender:false}});
%SCRIPT%
      window.__timelines=window.__timelines||{};
      window.__timelines['%ID%']=tl;
      var q=new URLSearchParams(location.search);
      if(q.has('t')){tl.seek(parseFloat(q.get('t'))||0);}else if(q.get('dev')==='1'){tl.play();}
    })();
    </script>
  </div>
</template>
"""
def emit(path, cid, pfx, dur, style, body, script):
    html = (HEAD.replace('%ID%', cid).replace('%P%', pfx).replace('%DUR%', str(dur))
                .replace('%STYLE%', style).replace('%BODY%', body).replace('%SCRIPT%', script))
    html = html.replace('%P%', pfx)
    open(path, 'w').write(html)
    return len(html)

import re as _re
def inline_glyph(name, cls, pid, stroke=1.6):
    """Inline a logos/glyph-*.svg so its strokes can be drawn on the beat."""
    s = open('logos/'+name).read()
    inner = s[s.index('>', s.index('<svg'))+1 : s.rindex('</svg>')]
    inner = inner.replace('stroke-width="1.6"', f'stroke-width="{stroke}"')
    inner = _re.sub(r'(<(?:path|rect|circle|line|polyline|ellipse)\b)', r'\1 class="gs"', inner)
    return f'<svg data-hf-id="hf-{pid}" id="{pid}" class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{inner}</svg>'

# ======================================================================================
# v3.1 — the launch-film kit. Camera, beat punctuation, and the Arlan Vault effects
# re-authored for linear time. Every one of these is deterministic and seek-safe.
# ======================================================================================

def fx_css(root):
    return f"""      /* --- camera: one stage every layer sits in, so a punch-in is a real move --- */
      #{root} .stage{{position:absolute;inset:0;will-change:transform;transform-origin:50% 50%}}
      /* --- Chromatic glow (Arlan Vault): the word is bloomed at three radii and split into
             a warm and a cool copy drifting opposite ways; the gap is the rainbow edge --- */
      #{root} .cg{{position:relative;display:inline-block}}
      #{root} .cg .cg-l{{position:absolute;left:0;top:0;width:100%;white-space:nowrap;
        will-change:transform,opacity;pointer-events:none}}
      #{root} .cg .cg-warm{{color:#FF8A4C;mix-blend-mode:screen;filter:blur(.6px)}}
      #{root} .cg .cg-cool{{color:#4CC3FF;mix-blend-mode:screen;filter:blur(.6px)}}
      #{root} .cg .cg-b1{{color:#FFF6E8;filter:blur(7px);opacity:.55;mix-blend-mode:screen}}
      #{root} .cg .cg-b2{{color:#FFF0D8;filter:blur(22px);opacity:.42;mix-blend-mode:screen}}
      #{root} .cg .cg-b3{{color:#FFE9C4;filter:blur(54px);opacity:.34;mix-blend-mode:screen}}
      #{root} .cg .cg-core{{position:relative}}
      /* --- The art of color depth (Arlan Vault): a button as a real object — gradient body,
             inset bevel and glow, a brighter layer, and a bar of light along the top --- */
      #{root} .btn3{{position:relative;overflow:hidden;isolation:isolate}}
      #{root} .btn3::before{{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
        background:linear-gradient(180deg,rgba(255,255,255,.34) 0%,rgba(255,255,255,.06) 44%,rgba(0,0,0,.18) 100%)}}
      #{root} .btn3::after{{content:'';position:absolute;left:8%;right:8%;top:2px;height:36%;border-radius:999px;
        pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.52),rgba(255,255,255,0));
        filter:blur(.4px)}}
      #{root} .btn3.ok3{{background:linear-gradient(180deg,#34B767 0%,#1C8F4C 52%,#0F7038 100%);color:#FFFFFF;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -2px 6px rgba(0,40,14,.45),
                   0 8px 20px rgba(9,90,40,.40),0 1px 0 rgba(255,255,255,.12)}}
      #{root} .btn3.gh3{{background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.04));
        color:rgba(244,239,230,.88);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -2px 5px rgba(0,0,0,.35)}}
      /* --- Amo (Arlan Vault): the pill's word puffs up into glossy dimensional letters --- */
      #{root} .puff{{display:inline-block;position:relative;transform-style:preserve-3d;will-change:transform}}
      #{root} .puff .pl{{display:inline-block;will-change:transform,text-shadow,letter-spacing}}
      /* --- Arcade pixel (Arlan Vault): drawn tiny and blown up, so each pixel is a big square --- */
      #{root} .px{{display:block;image-rendering:pixelated}}
      /* --- Ghosty reveal (Arlan Vault): images bleed in through a cloudy edge --- */
      #{root} .ghosty{{-webkit-mask-image:radial-gradient(120% 120% at 50% 50%,#000 0%,#000 40%,transparent 72%);
        mask-image:radial-gradient(120% 120% at 50% 50%,#000 0%,#000 40%,transparent 72%);
        -webkit-mask-size:260% 260%;mask-size:260% 260%;-webkit-mask-position:50% 50%;mask-position:50% 50%}}
      /* --- beat punctuation: a flash plate and a chromatic pulse over the whole frame --- */
      #{root} .hitflash{{position:absolute;inset:0;pointer-events:none;background:#EAF2FF;opacity:0;
        mix-blend-mode:screen}}
      #{root} .hero-card{{position:absolute;will-change:transform,opacity;transform-origin:50% 50%}}

      /* ====================== v3.4 component kit ======================
         React Bits studies, re-authored for linear time. Every one of them is a pointer,
         scroll or hover effect at the source; here the input is the timeline clock, so the
         behaviour is deterministic and a seek reconstructs it exactly. */

      /* --- DEPTH TEXT: layered extruded type. The source parallaxes against the pointer;
             here the extrusion is a fixed stack of offset copies and the parallax is a
             slow push on the stage, so the slash words read as objects with mass. --- */
      #{root} .dpt{{position:relative;display:inline-block;will-change:transform}}
      #{root} .dpt .dl{{position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;
        will-change:transform,opacity}}
      #{root} .dpt .dface{{position:relative;color:var(--ink)}}
      #{root} .dpt .dsh{{color:rgba(3,9,24,.42);filter:blur(.4px)}}

      /* --- SHINY TEXT: a metallic sheen crosses the glyphs. Masked to the text itself,
             so the highlight is in the letterform and not a bar sliding over it. --- */
      #{root} .shiny{{position:relative;display:inline-block}}
      #{root} .shiny .sh{{position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;
        background:linear-gradient(104deg,rgba(255,255,255,0) 40%,rgba(255,255,255,.95) 50%,rgba(255,255,255,0) 60%);
        -webkit-background-clip:text;background-clip:text;color:transparent;
        background-size:260% 100%;will-change:background-position;opacity:0}}

      /* --- MASKED HEADING: a drifting colour mesh shows through the glyphs, and the line
             is uncovered word by word rather than faded in whole. --- */
      #{root} .mhead{{display:inline-block}}
      #{root} .mhead .mw{{display:inline-block;overflow:hidden;vertical-align:bottom}}
      #{root} .mhead .mw > span{{display:inline-block;will-change:transform,opacity}}
      #{root} .mhead.mesh .mw > span{{
        background:linear-gradient(96deg,#FFF4E4 0%,#CFE3FF 26%,#FFE2C0 52%,#BBD6FF 74%,#FFF4E4 100%);
        background-size:280% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;
        will-change:transform,opacity,background-position}}

      /* --- SPLIT TEXT: per-character staggered entrance. --- */
      #{root} .split .ch{{display:inline-block;white-space:pre;will-change:transform,opacity}}

      /* --- STAR BORDER: sparkles orbit the edge of a thing with a twinkle pulse. The
             source animates a gradient on hover; here each spark is a real element placed
             on the ring and lit on its own beat. --- */
      #{root} .starb{{position:absolute;inset:-14px;pointer-events:none}}
      #{root} .starb .sp{{position:absolute;left:50%;top:50%;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;
        border-radius:50%;background:#FFFFFF;opacity:0;mix-blend-mode:screen;
        box-shadow:0 0 10px rgba(198,226,255,.95),0 0 22px rgba(120,180,255,.55);
        will-change:transform,opacity}}
      #{root} .starb .ring{{position:absolute;inset:0;border-radius:50%;opacity:0;
        background:conic-gradient(from 0deg,rgba(150,200,255,0) 0deg,rgba(190,224,255,.60) 40deg,
                   rgba(150,200,255,0) 110deg,rgba(150,200,255,0) 360deg);
        -webkit-mask:radial-gradient(closest-side,transparent 92%,#000 93%);
        mask:radial-gradient(closest-side,transparent 92%,#000 93%);will-change:transform,opacity}}

      /* --- SPECULAR BUTTON: a rim light sweeps the edge of the glass. The source tracks
             the cursor; here the sweep is on the approval's own beat, which is better —
             the light arrives when the decision does. --- */
      #{root} .spec{{position:relative;isolation:isolate}}
      #{root} .spec .rim{{position:absolute;inset:-1px;border-radius:inherit;pointer-events:none;opacity:0;
        background:conic-gradient(from 0deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,.92) 26deg,
                   rgba(255,255,255,0) 74deg,rgba(255,255,255,0) 360deg);
        -webkit-mask:linear-gradient(#000,#000) content-box,linear-gradient(#000,#000);
        -webkit-mask-composite:xor;mask-composite:exclude;padding:1.6px;
        will-change:transform,opacity}}
      #{root} .spec .gl{{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;
        background:linear-gradient(100deg,rgba(255,255,255,0) 38%,rgba(255,255,255,.42) 50%,rgba(255,255,255,0) 62%);
        will-change:transform,opacity;mix-blend-mode:screen}}

      /* --- LIGHT RAYS / SIDE RAYS: volumetric beams. Each ray is a masked gradient wedge
             anchored at the source, so the crest throws light instead of just brightening. --- */
      #{root} .rays{{position:absolute;pointer-events:none;mix-blend-mode:screen;
        transform-origin:50% 0%;will-change:transform,opacity}}
      #{root} .rays .ray{{position:absolute;left:50%;top:0;transform-origin:50% 0%;opacity:0;
        background:linear-gradient(180deg,rgba(255,231,196,.78) 0%,rgba(255,214,160,.22) 42%,rgba(255,200,140,0) 100%);
        filter:blur(9px);will-change:transform,opacity}}
      #{root} .rayglow{{position:absolute;pointer-events:none;mix-blend-mode:screen;opacity:0;
        background:radial-gradient(50% 50% at 50% 50%,rgba(255,236,206,.92) 0%,rgba(255,206,150,.34) 38%,rgba(255,190,120,0) 72%);
        will-change:transform,opacity}}


      /* --- HALFTONE REVEAL: a print dot matrix that resolves into the picture. The source
             resolves around the cursor; here the dot radius closes on the beat. --- */
      #{root} .halft{{position:absolute;inset:0;pointer-events:none;will-change:opacity;
        background-image:radial-gradient(circle,rgba(6,12,28,.92) 46%,rgba(6,12,28,0) 52%);
        background-size:14px 14px;background-position:0 0}}

      /* --- MAGIC BENTO: a spotlight crosses a grid and the tile under it lifts. --- */
      #{root} .bento-spot{{position:absolute;pointer-events:none;mix-blend-mode:screen;opacity:0;
        background:radial-gradient(50% 50% at 50% 50%,rgba(210,232,255,.42) 0%,rgba(160,200,255,.12) 44%,rgba(160,200,255,0) 74%);
        will-change:transform,opacity}}"""

# One chromatic-glow word: bloom stack + warm/cool split + crisp core.
def cg(pid, text, cls=""):
    layers = "".join(
        f'<span data-hf-id="hf-{pid}{k}" class="cg-l cg-{k}" id="{pid}-{k}" aria-hidden="true" '
        f'data-layout-allow-overlap="" data-layout-allow-occlusion="" data-layout-ignore="">{text}</span>'
        for k in ("b3","b2","b1","warm","cool"))
    return (f'<span data-hf-id="hf-{pid}" class="cg {cls}" id="{pid}">{layers}'
            f'<span data-hf-id="hf-{pid}c" class="cg-core" id="{pid}-core" '
            f'data-layout-allow-overlap="" data-layout-allow-occlusion="">{text}</span></span>')


# ====================== v3.4 component builders ======================
# React Bits studies as markup. Each returns a fragment whose animation is driven by the
# matching helper in FX_JS, off the timeline clock — never a pointer, scroll or hover.

def depth_text(pid, text, layers=7, dx=2.0, dy=2.6, cls=""):
    """DEPTH TEXT — a face over a fixed stack of offset copies, so the word has a side."""
    stack = "".join(
        f'<span data-hf-id="hf-{pid}d{i}" class="dl dsh" id="{pid}-d{i}" aria-hidden="true" '
        f'style="transform:translate3d({dx*(layers-i):.1f}px,{dy*(layers-i):.1f}px,0);'
        f'opacity:{0.13 + 0.055*i:.3f}" data-layout-ignore="">{text}</span>'
        for i in range(layers))
    return (f'<span data-hf-id="hf-{pid}" class="dpt {cls}" id="{pid}">{stack}'
            f'<span data-hf-id="hf-{pid}f" class="dface" id="{pid}-face">{text}</span></span>')

def shiny_text(pid, text, cls=""):
    """SHINY TEXT — a sheen clipped to the glyphs, swept once on a named beat."""
    return (f'<span data-hf-id="hf-{pid}" class="shiny {cls}" id="{pid}">'
            f'<span data-hf-id="hf-{pid}b" class="sbase" id="{pid}-base">{text}</span>'
            f'<span data-hf-id="hf-{pid}s" class="sh" id="{pid}-sh" aria-hidden="true" '
            f'data-layout-ignore="">{text}</span></span>')

def masked_heading(pid, words, cls="mesh"):
    """MASKED HEADING — a colour mesh through the glyphs, uncovered word by word."""
    ws = "".join(
        f'<span data-hf-id="hf-{pid}w{i}" class="mw"><span data-hf-id="hf-{pid}s{i}" '
        f'id="{pid}-w{i}">{w}</span></span>' + ('&nbsp;' if i < len(words)-1 else '')
        for i, w in enumerate(words))
    return f'<span data-hf-id="hf-{pid}" class="mhead {cls}" id="{pid}">{ws}</span>'

def split_text(pid, text, cls=""):
    """SPLIT TEXT — one span per character for a staggered entrance."""
    chs = "".join(
        f'<span data-hf-id="hf-{pid}c{i}" class="ch" id="{pid}-c{i}">'
        f'{"&nbsp;" if c == " " else c}</span>'
        for i, c in enumerate(text))
    return f'<span data-hf-id="hf-{pid}" class="split {cls}" id="{pid}">{chs}</span>'

def star_border(pid, n=14):
    """STAR BORDER — sparks placed round a ring, plus the arc that carries them."""
    sp = "".join(f'<span data-hf-id="hf-{pid}s{i}" class="sp" id="{pid}-s{i}"></span>'
                 for i in range(n))
    return (f'<span data-hf-id="hf-{pid}" class="starb" id="{pid}" data-layout-ignore="">'
            f'<span data-hf-id="hf-{pid}r" class="ring" id="{pid}-ring"></span>{sp}</span>')

def specular(pid):
    """SPECULAR BUTTON — the rim light and the glass sweep, as children of the button."""
    return (f'<span data-hf-id="hf-{pid}r" class="rim" id="{pid}-rim" data-layout-ignore=""></span>'
            f'<span data-hf-id="hf-{pid}g" class="gl" id="{pid}-gl" data-layout-ignore=""></span>')

def light_rays(pid, n=9, w=132, h=1180, spread=78):
    """LIGHT RAYS — volumetric wedges fanned from one source."""
    rs = []
    for i in range(n):
        a = -spread/2 + spread * (i/(n-1) if n > 1 else 0.5)
        rw = w * (0.55 + 0.45*abs(((i/(n-1) if n > 1 else .5)*2)-1) ** 0.6)
        rs.append(f'<span data-hf-id="hf-{pid}r{i}" class="ray" id="{pid}-r{i}" '
                  f'style="width:{rw:.0f}px;height:{h}px;margin-left:{-rw/2:.0f}px;'
                  f'transform:rotate({a:.1f}deg) scaleY(.2)"></span>')
    return (f'<span data-hf-id="hf-{pid}" class="rays" id="{pid}" data-layout-ignore="">'
            + "".join(rs) + '</span>')

FX_JS = """
      // ---- camera: punch in and out on the beat, one transform on one stage ----
      function cam(tl, stage, t, o){
        o=o||{};
        tl.to(stage,{scale:o.scale!=null?o.scale:1, x:o.x||0, y:o.y||0,
          rotation:o.rot||0, duration:o.d||.6, ease:o.e||'expo.out'}, t);
      }
      // ---- a hit: the frame answers the transient. Scale pop, optional flash, optional shake.
      function hit(tl, stage, t, o){
        o=o||{};
        var s=o.base!=null?o.base:1, amt=o.amt!=null?o.amt:.018;
        tl.to(stage,{scale:s+amt,duration:.055,ease:'power2.out'},t);
        tl.to(stage,{scale:s,duration:.30,ease:'power2.out'},t+.055);
        if(o.flash){ tl.fromTo(o.flash,{opacity:o.flashAmt||.22},{opacity:0,duration:o.flashD||.20,ease:'power2.out'},t); }
        if(o.shake){
          var a=o.shake;
          tl.to(stage,{x:'+='+a,duration:.033,ease:'none'},t);
          tl.to(stage,{x:'-='+(a*2),duration:.033,ease:'none'},t+.033);
          tl.to(stage,{x:'+='+a,duration:.033,ease:'none'},t+.066);
        }
      }
      // ---- chromatic glow: the split opens on a transient and settles back ----
      function cgPulse(tl, id, t, amt, dur){
        amt=amt||16; dur=dur||.9;
        var w=document.getElementById(id+'-warm'), c=document.getElementById(id+'-cool');
        tl.to(w,{x:-amt,y:-amt*.22,duration:.09,ease:'power2.out'},t);
        tl.to(c,{x:amt,y:amt*.22,duration:.09,ease:'power2.out'},t);
        tl.to(w,{x:-amt*.18,y:0,duration:dur,ease:'power3.out'},t+.09);
        tl.to(c,{x:amt*.18,y:0,duration:dur,ease:'power3.out'},t+.09);
      }
      function cgSet(id, amt){
        var w=document.getElementById(id+'-warm'), c=document.getElementById(id+'-cool');
        gsap.set(w,{x:-amt,y:0}); gsap.set(c,{x:amt,y:0});
      }
      // ---- Arcade pixel: draw the word tiny on a canvas, blow it up, and let the block size
      //      fall to 1 so the letters resolve out of the grid. No pixel grid is ever drawn.
      function pixelWord(canvas, text, font, color){
        var W=canvas.width, H=canvas.height, ctx=canvas.getContext('2d');
        return function(block){
          block=Math.max(1,Math.round(block));
          var w=Math.max(1,Math.round(W/block)), h=Math.max(1,Math.round(H/block));
          var off=pixelWord._o||(pixelWord._o=document.createElement('canvas'));
          off.width=w; off.height=h;
          var octx=off.getContext('2d');
          octx.clearRect(0,0,w,h);
          octx.fillStyle=color; octx.textAlign='center'; octx.textBaseline='middle';
          octx.font=font.replace(/(\\d+)px/, function(m,n){ return Math.max(1,Math.round(n/block))+'px'; });
          octx.fillText(text, w/2, h/2);
          ctx.clearRect(0,0,W,H);
          ctx.imageSmoothingEnabled=false;
          ctx.drawImage(off,0,0,w,h,0,0,W,H);
        };
      }
      // ---- a card lifts out of the phone and takes the frame ----
      function takeover(tl, el, t, from, to){
        tl.fromTo(el,{x:from.x,y:from.y,scale:from.s,autoAlpha:0,rotationX:10},
                     {x:to.x,y:to.y,scale:to.s,autoAlpha:1,rotationX:0,duration:to.d||.62,ease:'expo.out'},t);
      }

      // =================== v3.4 component drivers ===================
      // Each one takes a timeline and a beat. Nothing here reads a pointer or a clock of
      // its own, so every effect reconstructs exactly on a seek.

      // DEPTH TEXT — the extrusion builds outward from the face, then the whole block
      // parallaxes a few pixels so the depth is something you see rather than infer.
      function depthIn(tl, pid, t, o){
        o=o||{};
        var face=$('#'+pid+'-face'), wrap=$('#'+pid), ls=$$('#'+pid+' .dl');
        gsap.set(wrap,{transformPerspective:900});
        gsap.set(face,{y:o.y!=null?o.y:34,autoAlpha:0});
        tl.to(face,{y:0,autoAlpha:1,duration:o.d||.70,ease:'expo.out'},t);
        ls.forEach(function(l,i){
          var k=ls.length-i;                       // deepest layer last
          gsap.set(l,{autoAlpha:0});
          tl.to(l,{autoAlpha:Number(l.style.opacity)||.3,duration:.34,ease:'power2.out'},t+.05+k*0.022);
        });
        // the slow push that makes the stack read as depth
        tl.fromTo(wrap,{rotationY:o.ry0!=null?o.ry0:-7,rotationX:2.4},
                       {rotationY:o.ry1!=null?o.ry1:3,rotationX:-1.2,
                        duration:o.pd||4.4,ease:'sine.inOut'},t);
      }

      // SHINY TEXT — one sheen pass across the glyphs.
      function shine(tl, pid, t, d){
        var sh=$('#'+pid+'-sh');
        gsap.set(sh,{backgroundPosition:'190% 0'});
        tl.to(sh,{opacity:1,duration:.06,ease:'none'},t);
        tl.to(sh,{backgroundPosition:'-90% 0',duration:d||.72,ease:'power2.inOut'},t);
        tl.to(sh,{opacity:0,duration:.10,ease:'none'},t+(d||.72)-.06);
      }

      // MASKED HEADING — each word is uncovered from under its own clip, and the mesh
      // behind the glyphs keeps drifting after the line has landed.
      function maskedIn(tl, pid, t, n, o){
        o=o||{};
        var step=o.step||.085;
        for(var i=0;i<n;i++){
          var w=$('#'+pid+'-w'+i);
          gsap.set(w,{yPercent:112,autoAlpha:0,backgroundPosition:'0% 50%'});
          tl.to(w,{yPercent:0,autoAlpha:1,duration:o.d||.74,ease:'expo.out'},t+i*step);
          tl.to(w,{backgroundPosition:'190% 50%',duration:o.md||5.2,ease:'sine.inOut'},t+i*step);
        }
      }

      // SPLIT TEXT — per-character entrance on a fixed stagger.
      function splitIn(tl, pid, t, o){
        o=o||{};
        var chs=$$('#'+pid+' .ch');
        chs.forEach(function(c,i){
          gsap.set(c,{y:o.y!=null?o.y:18,autoAlpha:0,rotationX:o.rx!=null?o.rx:-40,
                      transformOrigin:'50% 100%'});
          tl.to(c,{y:0,autoAlpha:1,rotationX:0,duration:o.d||.46,ease:'back.out(1.7)'},
                t+i*(o.step||.024));
        });
      }

      // STAR BORDER — the arc sweeps the ring and each spark twinkles as it passes.
      function starBorder(tl, pid, t, o){
        o=o||{};
        var R=o.r||150, dur=o.d||4.2, ring=$('#'+pid+'-ring'), sps=$$('#'+pid+' .sp');
        gsap.set(ring,{rotation:0,transformOrigin:'50% 50%'});
        tl.to(ring,{opacity:o.ringOpacity!=null?o.ringOpacity:.85,duration:.4,ease:'power2.out'},t);
        tl.to(ring,{rotation:360,duration:dur,ease:'none'},t);
        sps.forEach(function(sp,i){
          var a=(i/sps.length)*Math.PI*2;
          gsap.set(sp,{x:Math.cos(a)*R,y:Math.sin(a)*R,scale:.6});
          // each spark lights as the arc reaches it, then falls back
          var at=t+(i/sps.length)*dur;
          tl.to(sp,{opacity:1,scale:1.35,duration:.12,ease:'power2.out'},at);
          tl.to(sp,{opacity:.32,scale:.78,duration:.46,ease:'power2.inOut'},at+.12);
        });
      }

      // SPECULAR BUTTON — the rim light travels the edge and the glass takes a sweep, on
      // the beat the approval lands.
      function specSweep(tl, pid, t, o){
        o=o||{};
        var rim=$('#'+pid+'-rim'), gl=$('#'+pid+'-gl');
        gsap.set(rim,{rotation:0,transformOrigin:'50% 50%'});
        gsap.set(gl,{xPercent:-130});
        tl.to(rim,{opacity:1,duration:.10,ease:'power2.out'},t);
        tl.to(rim,{rotation:360,duration:o.d||1.10,ease:'power2.inOut'},t);
        tl.to(rim,{opacity:0,duration:.26,ease:'power2.in'},t+(o.d||1.10)-.24);
        tl.to(gl,{opacity:1,duration:.06,ease:'none'},t+.04);
        tl.to(gl,{xPercent:130,duration:.56,ease:'power2.inOut'},t+.04);
        tl.to(gl,{opacity:0,duration:.10,ease:'none'},t+.52);
      }

      // LIGHT RAYS — the fan opens from the source, breathes, and closes.
      function raysOpen(tl, pid, t, o){
        o=o||{};
        var rs=$$('#'+pid+' .ray'), hold=o.hold||3.0;
        rs.forEach(function(r,i){
          var mid=Math.abs(i-(rs.length-1)/2)/((rs.length-1)/2||1);
          var peak=(o.peak||.62)*(1-mid*0.55);
          tl.to(r,{opacity:peak,scaleY:1,duration:o.d||.90,ease:'expo.out'},t+i*(o.step||.026));
          tl.to(r,{opacity:peak*0.55,scaleY:0.92,duration:hold,ease:'sine.inOut'},t+(o.d||.90));
          tl.to(r,{opacity:0,scaleY:0.6,duration:o.out||.70,ease:'power2.in'},t+(o.d||.90)+hold);
        });
      }

      // HALFTONE REVEAL — the dot matrix closes and the picture comes through it.
      function halftoneOut(tl, el, t, o){
        o=o||{};
        var px={v:o.from!=null?o.from:14};
        gsap.set(el,{opacity:1});
        tl.to(px,{v:o.to!=null?o.to:2,duration:o.d||1.10,ease:'power2.inOut',onUpdate:function(){
          el.style.backgroundSize=px.v.toFixed(2)+'px '+px.v.toFixed(2)+'px';
        }},t);
        tl.to(el,{opacity:0,duration:o.fade||.42,ease:'power2.in'},t+(o.d||1.10)-.30);
      }

      // MAGIC BENTO — a spotlight crosses the grid; the tile it is over lifts as it passes.
      function bentoSweep(tl, spotSel, tiles, t, o){
        o=o||{};
        var spot=$(spotSel), dur=o.d||2.6;
        gsap.set(spot,{x:o.x0||0,y:o.y||0});
        tl.to(spot,{opacity:1,duration:.34,ease:'power2.out'},t);
        tl.to(spot,{x:o.x1||1200,duration:dur,ease:'sine.inOut'},t);
        tl.to(spot,{opacity:0,duration:.44,ease:'power2.in'},t+dur-.30);
        tiles.forEach(function(el,i){
          var at=t+(i/Math.max(1,tiles.length-1))*dur*0.86;
          tl.to(el,{y:-9,scale:1.035,duration:.20,ease:'power2.out'},at);
          tl.to(el,{y:0,scale:1,duration:.52,ease:'power2.inOut'},at+.20);
        });
      }
"""

# --- The typer (Arlan Vault): a wave crosses the line and each letter flickers through a
# filled pill and a highlight before landing on plain text. Adjacent letters in the same
# state read as one long rounded bar.
def typer(pid, text):
    out=[]
    for i,ch in enumerate(text):
        c = '&nbsp;' if ch == ' ' else (ch if ch not in '<>&' else {'<':'&lt;','>':'&gt;','&':'&amp;'}[ch])
        out.append(f'<span data-hf-id="hf-{pid}{i}" class="ty" id="{pid}-{i}">{c}</span>')
    return f'<span data-hf-id="hf-{pid}" class="typer" id="{pid}">' + "".join(out) + '</span>'

TYPER_CSS = """      #%R% .typer .ty{display:inline-block;border-radius:5px;padding:1px 0;
        background:rgba(244,239,230,0);color:inherit;will-change:background-color,color,transform}"""

TYPER_JS = """
      // the wave: each letter is a pill, then a highlight, then plain text
      function typerWave(tl, pid, t, per, dur){
        per=per||.026; dur=dur||.42;
        var n=0, el;
        while((el=document.getElementById(pid+'-'+n))){
          var at=t+n*per;
          tl.to(el,{backgroundColor:'rgba(244,239,230,0.92)',color:'rgba(8,14,30,1)',duration:.001},at);
          tl.to(el,{backgroundColor:'rgba(244,239,230,0.28)',color:'rgba(244,239,230,1)',duration:.09,ease:'none'},at+.10);
          tl.to(el,{backgroundColor:'rgba(244,239,230,0)',duration:.18,ease:'power2.out'},at+.20);
          n++;
        }
        return t+n*per+dur;
      }
"""

def inline_icon(pid, size, cls=""):
    """The supplied app icon, inlined so the film can animate what is inside it:
    the wave bands drift, the specular tracks the light, the rim catches the beat."""
    s = open('logos/air-icon.svg').read()
    s = s.replace('<svg ', f'<svg id="{pid}" class="{cls}" ', 1)
    s = s.replace('width="1024" height="1024"', f'width="{size}" height="{size}"')
    # ids must be unique once several icons share one document
    for old in ['tile','orb','core','spec','rim','orbclip','soft','softer','air-waves']:
        s = s.replace(f'id="{old}"', f'id="{pid}-{old}"')
        s = s.replace(f'url(#{old})', f'url(#{pid}-{old})')
    s = s.replace('<path d=', f'<path data-hf-id="hf-{pid}p" d=', 1)
    return s
