import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts as P, mini_common as M
R='s09-root'; PFX='s09'
STYLE = M.base_style(R, """
      /* the generation takes the frame: a canvas the shot builds out of symbols, then resolves */
      #s09-root .gen{position:absolute;left:200px;top:150px;width:1520px;height:790px;border-radius:26px;
        overflow:hidden;box-shadow:0 60px 120px rgba(2,6,18,.62),0 0 0 1px rgba(255,255,255,.12)}
      #s09-root .gen canvas{display:block;width:1520px;height:790px}
      #s09-root .gen.ghosty{-webkit-mask-size:var(--m,300%) var(--m,300%);mask-size:var(--m,300%) var(--m,300%)}
      #s09-root .genbar{position:absolute;left:200px;top:966px;width:1520px;display:flex;align-items:center;
        justify-content:space-between;font-family:'Azeret Mono',monospace;font-size:19px;letter-spacing:.08em;
        color:rgba(244,239,230,.80);text-shadow:0 2px 14px rgba(3,7,18,.7)}
      #s09-root .genbar .st{display:flex;align-items:center;gap:14px}
      #s09-root .genbar .dot{width:10px;height:10px;border-radius:50%;background:#5BE585}
      #s09-root .endcap{position:absolute;left:0;right:0;top:404px;text-align:center}
      #s09-root .endcap .cap{font-size:96px;line-height:1.02}""")

ITEMS = f"""      var ITEMS=[
        {{kind:'sys', text:'Today · 9:34 AM', pre:true}},
        {{side:'sent', text:'/zap the orb rising over clouds, 6s'}},
        {{side:'recv', text:'on it — about 40s.'}}
      ];"""

BODY = f"""    <div data-hf-id="hf-s09frame" class="frame clip" id="s09-frame" data-layout-allow-overflow="" data-start="0" data-duration="6.27" data-track-index="1">
      <div data-hf-id="hf-s09wa" class="washL"></div>
      <div data-hf-id="hf-s09wb" class="washR"></div>
      <div data-hf-id="hf-s09st" class="stage" id="s09-stage">
{M.right_plane(PFX,'/zap','video, images, animation — creative lanes in the thread.')}
{M.phone(PFX)}
        <div data-hf-id="hf-s09gn" class="gen ghosty" id="s09-gen">
          <canvas data-hf-id="hf-s09cv" id="s09-canvas" width="1520" height="790"></canvas>
        </div>
        <div data-hf-id="hf-s09gb" class="genbar" id="s09-genbar">
          <span data-hf-id="hf-s09g1" class="st"><span data-hf-id="hf-s09gd" class="dot"></span>
            <span data-hf-id="hf-s09gt" id="s09-genstate">RENDERING</span></span>
          <span data-hf-id="hf-s09g2">1080&times;1080 &middot; 6s &middot; fal</span>
        </div>
        <div data-hf-id="hf-s09ec" class="endcap" id="s09-endcap">
          <div data-hf-id="hf-s09e1" class="cap">mini-apps.</div>
          <div data-hf-id="hf-s09e2" class="cap">make your own.</div>
        </div>
      </div>
      <div data-hf-id="hf-s09hf" class="hitflash" id="s09-flash"></div>
    </div>"""

SCRIPT = M.COMMON_JS + f"""
{ITEMS}
      var threadEl=$('#s09-thread'); threadEl.setAttribute('data-bottom','634');
      var TH=buildThread(threadEl, ITEMS);
      var stage=rig('s09'), flash=$('#s09-flash');
      var gen=$('#s09-gen'), genbar=$('#s09-genbar'), endcap=$('#s09-endcap');

      // ---- the generated clip, built rather than fetched: a sky, clouds, and the brand orb
      // rising through them. Then Symbols: four brightness bands, each stamped with its own
      // mark and tint, resolving into the picture as the render completes.
      var cv=$('#s09-canvas'), cx=cv.getContext('2d'), W=1520, H=790;
      var off=document.createElement('canvas'), ox=off.getContext('2d');
      var CELL=25, CW=Math.ceil(W/CELL), CH=Math.ceil(H/CELL);
      off.width=CW; off.height=CH;
      var MARKS=['·','+','\\u00d7','\\u25a0'];
      var TINTS=['#3D6AB0','#6C9BDC','#B8D4F5','#FFFFFF'];
      function scene(g, w, h, t, orbRise){{
        var sky=g.createLinearGradient(0,0,0,h);
        sky.addColorStop(0,'#1E3F7E'); sky.addColorStop(.52,'#5C8CC9'); sky.addColorStop(1,'#CBDEF2');
        g.fillStyle=sky; g.fillRect(0,0,w,h);
        var cl=[[0.10,0.84,0.30],[0.36,0.92,0.34],[0.64,0.86,0.30],[0.88,0.94,0.28],[0.24,0.70,0.16],[0.76,0.66,0.18]];
        for(var i=0;i<cl.length;i++){{
          var cxp=(cl[i][0]*w + t*11*(i%2?1:-1)+w)%(w*1.2)-w*0.1, cyp=cl[i][1]*h, r=cl[i][2]*w*0.5;
          var rg=g.createRadialGradient(cxp,cyp,0,cxp,cyp,r);
          rg.addColorStop(0,'rgba(255,255,255,.95)'); rg.addColorStop(.5,'rgba(244,250,255,.55)');
          rg.addColorStop(1,'rgba(230,242,255,0)');
          g.fillStyle=rg; g.fillRect(cxp-r,cyp-r,r*2,r*2);
        }}
        var oy=h*(0.82-0.42*orbRise), orr=h*0.13;
        var og=g.createRadialGradient(w*0.5-orr*0.32,oy-orr*0.38,orr*0.08,w*0.5,oy,orr);
        og.addColorStop(0,'#EAF4FF'); og.addColorStop(.28,'#67A8F2'); og.addColorStop(.72,'#1C5BC4'); og.addColorStop(1,'#0B2C74');
        g.beginPath(); g.arc(w*0.5,oy,orr,0,6.2832); g.fillStyle=og; g.fill();
        var hl=g.createRadialGradient(w*0.5-orr*0.34,oy-orr*0.44,0,w*0.5-orr*0.34,oy-orr*0.44,orr*0.5);
        hl.addColorStop(0,'rgba(255,255,255,.92)'); hl.addColorStop(1,'rgba(255,255,255,0)');
        g.beginPath(); g.arc(w*0.5,oy,orr,0,6.2832); g.fillStyle=hl; g.fill();
      }}
      var state={{t:0, resolve:0, orb:0, cols:0}};
      function render(){{
        scene(ox, CW, CH, state.t, state.orb);
        var data=ox.getImageData(0,0,CW,CH).data;
        cx.clearRect(0,0,W,H);
        cx.fillStyle='#0A1430'; cx.fillRect(0,0,W,H);
        if(state.resolve<1){{
          cx.save(); cx.globalAlpha=1-state.resolve;
          cx.font='700 '+(CELL-4)+'px "Azeret Mono", monospace';
          cx.textAlign='center'; cx.textBaseline='middle';
          var lim=Math.round(CW*state.cols);
          // the columns still to come read as a faint lattice, not a black hole
          cx.globalAlpha=(1-state.resolve)*.26;
          for(var gx=lim;gx<CW;gx++){{ for(var gy=0;gy<CH;gy++){{
            cx.fillStyle='#4E7CC4'; cx.fillRect(gx*CELL+CELL/2-1, gy*CELL+CELL/2-1, 2, 2); }} }}
          cx.globalAlpha=1-state.resolve;
          for(var y=0;y<CH;y++){{
            for(var x=0;x<lim;x++){{
              var i=(y*CW+x)*4;
              var b=(data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114)/255;
              var band=b<0.34?0:(b<0.58?1:(b<0.80?2:3));
              cx.fillStyle=TINTS[band];
              cx.fillText(MARKS[band], x*CELL+CELL/2, y*CELL+CELL/2);
            }}
          }}
          cx.restore();
        }}
        if(state.resolve>0){{
          cx.save(); cx.globalAlpha=state.resolve;
          scene(cx, W, H, state.t, state.orb);
          cx.restore();
        }}
      }}
      render();

      gsap.set(gen,{{autoAlpha:0,scale:.93,transformOrigin:'50% 50%'}});
      gsap.set(genbar,{{autoAlpha:0,y:14}});
      gsap.set(endcap,{{autoAlpha:0,y:22}});
      gsap.set($('#s09-composer-txt'),{{textContent:'/zap the orb rising over clouds, 6s'}});
      gsap.set(flash,{{opacity:0}});
      gsap.set(stage,{{scale:1.0,transformOrigin:'50% 50%'}});
      gsap.set(gen,{{'--m':'52%'}});

      // 64.412 — send. 65.991 — it answers with a time, the way a person would.
      showItem(tl,TH,0.000,1,{{slide:.30}});
      tl.set($('#s09-composer-txt'),{{textContent:''}},0.000);
      hit(tl,stage,0.000,{{amt:.020}});
      rightIn(tl,'s09',0.06);
      showItem(tl,TH,1.579,2,{{slide:.34}});
      hit(tl,stage,1.579,{{amt:.014}});

      // 66.757 -> 67.524 — the render takes the frame as symbols, one column band per hihat
      // hit of the accel roll, then resolves into the picture it was asked for.
      tl.to('#s09-ph',{{autoAlpha:0,scale:.9,duration:.30,ease:'power3.in'}},2.20);
      rightOut(tl,'s09',2.16);
      tl.to(gen,{{autoAlpha:1,scale:1,duration:.54,ease:'expo.out'}},2.345);
      tl.to(genbar,{{autoAlpha:1,y:0,duration:.44,ease:'expo.out'}},2.40);
      tl.to(state,{{cols:1,duration:.767,ease:'none',onUpdate:render}},2.345);
      hit(tl,stage,2.345,{{amt:.024}});
      // the mask opens like fog clearing (Ghosty reveal)
      tl.to(gen,{{'--m':'300%',duration:1.30,ease:'power2.out'}},2.345);
      // 67.524 — resolved
      tl.to(state,{{resolve:1,duration:1.05,ease:'power2.inOut',onUpdate:render}},3.30);
      tl.to(state,{{orb:1,duration:2.5,ease:'none',onUpdate:render}},3.112);
      tl.to(state,{{t:8,duration:3.0,ease:'none',onUpdate:render}},3.112);
      tl.set($('#s09-genstate'),{{textContent:'READY · 00:06'}},4.35);
      hit(tl,stage,3.112,{{amt:.030,flash:flash,flashAmt:.20,flashD:.24}});

      // 69.103 — the turn into /create
      tl.to([gen,genbar],{{autoAlpha:0,scale:.96,duration:.34,ease:'power3.in'}},4.691);
      tl.to(endcap,{{autoAlpha:1,y:0,duration:.64,ease:'expo.out'}},4.760);
      hit(tl,stage,4.691,{{amt:.020}});
      cam(tl,stage,4.760,{{scale:1.04,d:1.3,e:'expo.out'}});
      tl.to(endcap,{{autoAlpha:0,x:-200,duration:.30,ease:'power4.in'}},5.98);"""
print(P.emit('compositions/shot-09-zap.html','shot-09-zap','s09',6.27,STYLE,BODY,SCRIPT))
