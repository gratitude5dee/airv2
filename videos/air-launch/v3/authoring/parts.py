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
      #{root} .ph-island{{position:absolute;top:14px;left:50%;margin-left:-63px;width:126px;height:37px;border-radius:19px;background:#000;z-index:6}}
      #{root} .ph-nav{{position:absolute;top:0;left:0;right:0;height:122px;z-index:5;
        background:rgba(18,18,20,.82);backdrop-filter:blur(24px) saturate(1.3);border-bottom:1px solid rgba(255,255,255,.08);
        display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:8px}}
      #{root} .orb{{background:url('logos/air-brand.png') center/cover no-repeat;border-radius:50%;flex:0 0 auto}}
      #{root} .gly{{background-position:center;background-repeat:no-repeat;background-size:contain}}
      #{root} .ph-nav .orb{{width:44px;height:44px}}
      #{root} .ph-nav .who{{font-size:13px;font-weight:600;color:#fff;margin-top:3px;letter-spacing:.01em}}
      #{root} .ph-fade{{position:absolute;top:122px;left:0;right:0;height:52px;z-index:4;pointer-events:none;
        background:linear-gradient(180deg,rgba(0,0,0,.88) 0%,rgba(0,0,0,0) 100%)}}
      #{root} .ph-home{{position:absolute;bottom:9px;left:50%;margin-left:-67px;width:134px;height:5px;border-radius:3px;background:rgba(255,255,255,.34);z-index:6}}
      #{root} .ph-composer{{position:absolute;bottom:26px;left:12px;right:12px;height:44px;border-radius:22px;z-index:5;
        border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);display:flex;align-items:center;padding:0 14px;overflow:hidden}}
      #{root} .ph-composer .txt{{font-size:17px;color:#fff;white-space:nowrap;overflow:hidden}}
      #{root} .ph-composer .car{{width:2px;height:19px;background:var(--imsg);margin-left:2px;flex:0 0 auto}}
      #{root} .ph-composer .glow{{position:absolute;inset:-1px;border-radius:22px;pointer-events:none;
        background:linear-gradient(96deg,rgba(10,132,255,.36),rgba(244,239,230,.14) 48%,rgba(10,132,255,.30));opacity:0}}
      /* the thread: a flow column translated by the timeline — never scrollTop */
      #{root} .ph-scroll{{position:absolute;top:122px;left:0;right:0;bottom:0;overflow:hidden;z-index:3}}
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
            <div data-hf-id="hf-%P%isl" class="ph-island"></div>
            <div data-hf-id="hf-%P%cmp" class="ph-composer" id="%P%-composer"><div data-hf-id="hf-%P%cmpg" class="glow" id="%P%-composer-glow"></div><div data-hf-id="hf-%P%cmpt" class="txt" id="%P%-composer-txt"></div><div data-hf-id="hf-%P%cmpc" class="car" id="%P%-composer-caret"></div></div>
            <div data-hf-id="hf-%P%hb" class="ph-home"></div>
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
      #{root} .hero-card{{position:absolute;will-change:transform,opacity;transform-origin:50% 50%}}"""

# One chromatic-glow word: bloom stack + warm/cool split + crisp core.
def cg(pid, text, cls=""):
    layers = "".join(
        f'<span data-hf-id="hf-{pid}{k}" class="cg-l cg-{k}" id="{pid}-{k}" aria-hidden="true" '
        f'data-layout-allow-overlap="" data-layout-allow-occlusion="" data-layout-ignore="">{text}</span>'
        for k in ("b3","b2","b1","warm","cool"))
    return (f'<span data-hf-id="hf-{pid}" class="cg {cls}" id="{pid}">{layers}'
            f'<span data-hf-id="hf-{pid}c" class="cg-core" id="{pid}-core" '
            f'data-layout-allow-overlap="" data-layout-allow-occlusion="">{text}</span></span>')

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
