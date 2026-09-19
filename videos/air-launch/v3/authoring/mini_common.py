import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P

def base_style(R, extra=""):
    return (P.FONTS + "\n" + P.tokens(R) + "\n" + P.phone_css(R,R[:3]) + "\n" + P.fx_css(R) + f"""
      #{R} .ph{{left:470px;top:103px}}
      #{R} .right{{position:absolute;left:1010px;top:0;width:880px;height:1080px}}
      #{R} .slash{{position:absolute;left:0;top:262px;font-family:'Azeret Mono',monospace;font-weight:500;
        font-size:196px;letter-spacing:-.05em;color:var(--ink);opacity:.36;white-space:nowrap;
        text-shadow:0 6px 40px rgba(3,7,18,.45)}}
      #{R} .expl{{position:absolute;left:4px;top:548px;width:840px}}
      #{R} .expl .mono{{font-size:29px;line-height:1.48}}
      #{R} .btn.ok{{background:none}}
""" + extra)

def hd(pid, glyph, title, sub, art=None):
    ic = (f'<div data-hf-id="hf-{pid}a" class="art" style="background-image:url(&quot;assets/icons/{art}.png&quot;)"></div>'
          if art else f'<div data-hf-id="hf-{pid}i" class="ic"><div data-hf-id="hf-{pid}g" class="gly" style="background-image:url(&quot;logos/{glyph}&quot;)"></div></div>')
    return (f'<div data-hf-id="hf-{pid}h" class="hd">{ic}<div data-hf-id="hf-{pid}w">'
            f'<div data-hf-id="hf-{pid}t" class="ti">{title}</div><div data-hf-id="hf-{pid}s" class="sb">{sub}</div></div></div>')

def right_plane(pfx, slash, expl):
    return f"""      <div data-hf-id="hf-{pfx}rt" class="right" id="{pfx}-right">
        <div data-hf-id="hf-{pfx}sl" class="slash" id="{pfx}-slash">{slash}</div>
        <div data-hf-id="hf-{pfx}ex" class="expl" id="{pfx}-expl"><div data-hf-id="hf-{pfx}em" class="mono">{expl}</div></div>
      </div>"""

def phone(pfx, back=None):
    ph = P.PHONE_HTML.replace('%P%', pfx)
    if back:
        tail = '\n          </div>\n        </div>\n      </div>'
        ph = ph[:-len(tail)] + '\n          </div>\n        </div>\n        ' + back + '\n      </div>'
    return ph

COMMON_JS = P.THREAD_JS + P.FX_JS + """
      // every mini-app shot shares the same rig: one stage, one phone pose, one right plane
      function rig(pfx){
        var st=document.getElementById(pfx+'-stage');
        gsap.set(document.getElementById(pfx+'-ph'),{rotationY:-9,rotationX:4,scale:1.06,transformOrigin:'50% 50%'});
        gsap.set(document.getElementById(pfx+'-slash'),{autoAlpha:0,x:60});
        gsap.set(document.getElementById(pfx+'-expl'),{autoAlpha:0,y:14});
        return st;
      }
      // A whip: the outgoing shot is still travelling when the cut happens and the incoming
      // one picks the move up mid-flight, blurred, for two frames. It is the only transition
      // in the film that is not a straight cut.
      function whipIn(tl, stage, t, dist){
        dist = dist==null ? 210 : dist;
        tl.fromTo(stage,{x:dist,filter:'blur(13px)'},
                        {x:0,filter:'blur(0px)',duration:.20,ease:'power3.out'}, t);
      }
      function whipOut(tl, stage, t, dist){
        dist = dist==null ? 210 : dist;
        tl.to(stage,{x:-dist,filter:'blur(13px)',duration:.17,ease:'power3.in'}, t);
      }
      function rightIn(tl, pfx, t){
        tl.to('#'+pfx+'-slash',{autoAlpha:1,x:0,duration:.60,ease:'expo.out'},t);
        tl.to('#'+pfx+'-expl',{autoAlpha:1,y:0,duration:.58,ease:'expo.out'},t+.26);
      }
      function rightOut(tl, pfx, t){
        tl.to('#'+pfx+'-slash',{autoAlpha:0,x:-130,duration:.30,ease:'power4.in'},t);
        tl.to('#'+pfx+'-expl',{autoAlpha:0,y:-12,duration:.26,ease:'power3.in'},t);
      }
"""
