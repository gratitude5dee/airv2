"use strict";(()=>{var f="#30d158",T="#ff375f",l="rgba(255,255,255,0.92)",b="rgba(255,255,255,0.45)",ot="rgba(255,255,255,0.14)";var at=document.getElementById("trade-tape");at&&bt(at);function bt(S){let H=JSON.parse(S.dataset.payload??"{}"),s=null,L=H.product||"BTC-USD",y="25",g=!1,d=null,E=!1;S.className="ttape",S.innerHTML=`
<div class="tt-head">
  <div class="tt-chiprow">
    <button class="tt-chip tt-prod" type="button"></button>
    <span class="tt-px"></span>
    <span class="tt-chg"></span>
  </div>
</div>
<div class="tt-stage">
  <canvas class="tt-canvas"></canvas>
  <div class="tt-rail"></div>
  <div class="tt-pos" hidden></div>
  <div class="tt-banner" hidden></div>
  <div class="tt-welcome" hidden>
    <div class="tt-welcome-card">
      <div class="tt-welcome-kicker">demo balance \xB7 $10,000</div>
      <h3>Trade with your thumb</h3>
      <p><b>UP</b> buys that dollar stake. <b>DOWN</b> sells it back \u2014 it never shorts.</p>
      <p>Every order still lands on your approval \u2014 nothing moves until you tap <b>Approve</b>.</p>
      <button class="tt-go" type="button">Got it</button>
    </div>
  </div>
</div>
<div class="tt-posctl" hidden>
  <span class="tt-poslabel"></span>
  <button class="tt-ctl" data-ctl="target" type="button">Target</button>
  <button class="tt-ctl tt-ctl-down" data-ctl="close" type="button">Close</button>
</div>
<div class="tt-target" hidden>
  <input class="tt-target-in" inputmode="decimal" placeholder="price $" />
  <button class="tt-ctl" data-ctl="arm" type="button">Arm watch</button>
</div>
<div class="tt-ledger"></div>
<div class="tt-stakes"></div>
<div class="tt-pending" hidden></div>
<div class="tt-buttons">
  <button class="tt-btn tt-down" type="button"><span>DOWN</span><em></em></button>
  <button class="tt-btn tt-up" type="button"><span>UP</span><em></em></button>
</div>
<div class="tt-hint"></div>`;let c=t=>S.querySelector(t),v=c(".tt-canvas"),st=c(".tt-prod"),it=c(".tt-px"),N=c(".tt-chg"),B=c(".tt-rail"),O=c(".tt-pos"),R=c(".tt-posctl"),rt=c(".tt-poslabel"),q=c(".tt-target"),W=q.querySelector("input"),M=c(".tt-banner"),lt=c(".tt-ledger"),C=c(".tt-stakes"),A=c(".tt-pending"),_=c(".tt-buttons"),j=_.querySelector(".tt-down"),z=_.querySelector(".tt-up"),dt=c(".tt-hint"),G=c(".tt-welcome"),V=document.createElement("style");V.textContent=mt,S.appendChild(V);let Z=t=>t==null||!Number.isFinite(t)?"\u2014":`$${t.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,J=t=>t==null||!Number.isFinite(t)?"\u2014":t>=1e3?t.toLocaleString("en-US",{maximumFractionDigits:0}):t>=1?t.toLocaleString("en-US",{maximumFractionDigits:2}):t.toPrecision(4),ct=t=>t>=1?t.toLocaleString("en-US",{maximumFractionDigits:4}):t.toPrecision(3);async function P(t,n){let o=new FormData;o.set("action",t);for(let[e,p]of Object.entries(n))o.set(e,p);try{return await(await fetch(window.location.pathname,{method:"POST",body:o,credentials:"same-origin"})).json()}catch{return{ok:!1,error:"No connection \u2014 try again."}}}function Y(t){d={text:t,tone:"down",share:null},F(),window.setTimeout(()=>{d?.text===t&&(d=null,F())},6e3)}function K(){if(!s)return;if(st.textContent=s.product,it.textContent=`$${J(s.price)}`,s.changePct!==null&&s.changePct!==void 0){let e=s.changePct>=0;N.textContent=`${e?"\u25B2":"\u25BC"} ${Math.abs(s.changePct).toFixed(2)}%`,N.style.color=e?f:T}else N.textContent="";let t=s.position;if(O.hidden=!t,R.hidden=!t,_.classList.toggle("tt-holding",!!t),t){let e=t.pnlUsd,p=e===null?l:e>=0?f:T;O.innerHTML="";let i=document.createElement("span");i.className="tt-pos-chip",i.style.borderColor=p,i.innerHTML=`${ct(t.qty)} ${t.asset} \xB7 <b style="color:${p}">${e===null?"\u2014":`${e>=0?"+":"\u2212"}$${Math.abs(e).toFixed(2)}`}</b>`,O.appendChild(i),rt.textContent=`${t.asset} position`}let n=s.cashUsd,o=s.equityUsd;lt.innerHTML=`<span>${Z(n)} cash</span><span>${Z(o)} equity</span><span class="tt-mode">${s.mode==="live"?"live":"paper"}</span>`,j.disabled=g||!!s.pending||!t,z.disabled=g||!!s.pending||n!==null&&n<1,j.querySelector("em").textContent=t?`sell $${y}`:"flat",z.querySelector("em").textContent=`buy $${y}`;for(let e of Array.from(C.children))e.classList.toggle("on",e.dataset.stake===y);dt.textContent=s.pending?"":"every order waits for your approve \u2014 nothing auto-fires",tt(),et()}function tt(){let t=s?.pending;if(A.hidden=!t,!t){A.innerHTML="";return}let n=t.expiresAt?Date.parse(t.expiresAt)-Date.now():0,o=t.expiresAt!==null&&n<=0,e=Math.max(0,Math.floor(n/1e3)),p=Math.floor(e/60),i=String(e%60).padStart(2,"0"),r=t.caps?`<div class="tt-caps"><span style="width:${Math.min(100,t.caps.spentToday/t.caps.daily*100)}%"></span></div><div class="tt-capline">today $${t.caps.spentToday.toFixed(0)} of $${t.caps.daily} \xB7 per-order max $${t.caps.perOrder}</div>`:"";A.innerHTML=`
<div class="tt-pcard">
  <div class="tt-pkick">${t.mode} \xB7 approval${o?" expired":` \xB7 ${p}:${i}`}</div>
  <div class="tt-plabel">${t.label}</div>
  <table class="tt-ptable"><tbody>
    <tr><td>Est. price</td><td>${t.est.price??"\u2014"}</td></tr>
    <tr><td>Est. fill</td><td>${t.est.fill??"\u2014"}</td></tr>
    <tr><td>Fee</td><td>${t.est.fee??"\u2014"}</td></tr>
    <tr><td>Total</td><td><b>${t.est.total??"\u2014"} ${t.est.currency??""}</b></td></tr>
  </tbody></table>
  ${r}
  <div class="tt-prow">
    <button class="tt-ctl" data-res="dismiss" type="button"${g?" disabled":""}>Deny</button>
    <button class="tt-ctl tt-approve" data-res="approve" type="button"${g||o?" disabled":""}>${o?"Expired":"Approve"}</button>
  </div>
</div>`;for(let h of Array.from(A.querySelectorAll("[data-res]")))h.addEventListener("click",()=>ut(t,h.dataset.res))}function F(){if(!d){M.hidden=!0,M.innerHTML="";return}M.hidden=!1;let t=d.tone==="up"?f:d.tone==="down"?T:l;M.innerHTML=`<span class="tt-bpill" style="border-color:${t};color:${t}">${d.text}${d.share?' <button class="tt-share" type="button">Share win</button>':""}</span>`;let n=M.querySelector(".tt-share");n&&d.share&&n.addEventListener("click",()=>{navigator.clipboard?.writeText(d.share).catch(()=>{}),n.textContent="copied"})}function et(){let t=window.devicePixelRatio||1,n=v.clientWidth,o=v.clientHeight;if(!n||!o)return;(v.width!==n*t||v.height!==o*t)&&(v.width=n*t,v.height=o*t);let e=v.getContext("2d");if(!e)return;e.setTransform(t,0,0,t,0,0),e.clearRect(0,0,n,o);let i=n-58,r=(s?.candles??[]).map(([,a])=>a),h=s?.price??r[r.length-1]??null,m=s?.position,x=r.length?Math.min(...r):h??0,k=r.length?Math.max(...r):h??1;m?.avgCostUsd&&(x=Math.min(x,m.avgCostUsd),k=Math.max(k,m.avgCostUsd)),k>x||(k=x+Math.max(x*.001,1e-8));let nt=(k-x)*.08;x-=nt,k+=nt;let Q=a=>o-(a-x)/(k-x)*o,gt=(a,u)=>u<=1?i:a/(u-1)*i;e.strokeStyle=ot,e.fillStyle=ot,e.setLineDash([2,5]),e.lineWidth=1;for(let a=1;a<=4;a++){let u=o/5*a;e.beginPath(),e.moveTo(0,u),e.lineTo(n,u),e.stroke()}for(let a=1;a<=5;a++){let u=i/6*a;e.beginPath(),e.moveTo(u,0),e.lineTo(u,o),e.stroke()}e.setLineDash([]);let U=(m?.pnlUsd!==null&&m?.pnlUsd!==void 0?m.pnlUsd>=0:r.length>1?r[r.length-1]>=r[0]:!0)?f:T;if(r.length>1){let a=e.createLinearGradient(0,0,0,o);a.addColorStop(0,U+"33"),a.addColorStop(1,U+"00"),e.beginPath(),r.forEach((u,I)=>{let w=gt(I,r.length),D=Q(u);I===0?e.moveTo(w,D):e.lineTo(w,D)}),e.strokeStyle=U,e.lineWidth=2,e.lineJoin="round",e.stroke(),e.lineTo(i,o),e.lineTo(0,o),e.closePath(),e.fillStyle=a,e.fill()}else e.fillStyle=b,e.font="12px ui-monospace, monospace",e.textAlign="center",e.fillText("waiting for ticks\u2026",i/2,o/2);if(m?.avgCostUsd){let a=Q(m.avgCostUsd);e.strokeStyle=l,e.setLineDash([6,5]),e.lineWidth=1.5,e.beginPath(),e.moveTo(0,a),e.lineTo(i,a),e.stroke(),e.setLineDash([]),pt(e,`BE ${J(m.avgCostUsd)}`,i+4,a,l)}if(h!==null){let a=Q(h);e.strokeStyle=U,e.setLineDash([2,4]),e.beginPath(),e.moveTo(0,a),e.lineTo(i,a),e.stroke(),e.setLineDash([]),e.fillStyle=U;let u=J(h);e.font="600 11px ui-monospace, monospace";let I=e.measureText(u).width+10,w=18,D=Math.min(Math.max(a-w/2,2),o-w-2);e.beginPath(),e.roundRect(i+3,D,I,w,9),e.fill(),e.fillStyle="#0b0b0e",e.textAlign="left",e.textBaseline="middle",e.fillText(u,i+8,D+w/2+.5)}}function pt(t,n,o,e,p){t.font="9px ui-monospace, monospace",t.fillStyle=p,t.textAlign="left",t.textBaseline="middle",t.fillText(n,o,e)}async function $(){if(document.hidden)return;let t=await P("tape_state",{product:L});t.ok&&(s=t,K())}async function X(t){if(g||s?.pending)return;g=!0,K();let n=await P("tape_intent",{product:L,side:t,stake:y});if(g=!1,n.ok&&n.pending){await $();return}n.ok===!1&&Y(String(n.error??"Didn't file \u2014 try again.")),await $()}async function ut(t,n){if(g)return;g=!0,tt();let o=await P("tape_resolve",{decision:t.decisionId,choice:n});if(g=!1,o.ok){let e=String(o.state??"");if(n==="dismiss")d={text:"Denied \u2014 nothing was placed.",tone:"flat",share:null};else if(e==="filled"||e==="submitted"){let p=o.pnlUsd;if(typeof p=="number"&&Number.isFinite(p)){let r=`${p>=0?"+":"\u2212"}$${Math.abs(p).toFixed(2)} USD realized`;d={text:r,tone:p>=0?"up":"down",share:`${r} on ${t.productId} \u2014 air /trade`}}else d={text:`${t.side==="BUY"?"Bought":"Sold"} \u2014 ${String(o.detail??t.label)}`,tone:"up",share:null}}else e==="rejected"||e==="uncertain"?d={text:String(o.detail??"Rejected by the venue."),tone:"down",share:null}:d={text:String(o.detail??"Done."),tone:"flat",share:null};F(),window.setTimeout(()=>{d=null,F()},8e3)}else Y(String(o.error??"Didn't go through \u2014 try again."));await $()}z.addEventListener("click",()=>void X("up")),j.addEventListener("click",()=>void X("down")),R.querySelector('[data-ctl="close"]').addEventListener("click",()=>{y="max";for(let t of Array.from(C.children))t.classList.toggle("on",t===C.lastElementChild);X("down")}),R.querySelector('[data-ctl="target"]').addEventListener("click",()=>{E=!E,q.hidden=!E,E&&s?.price&&(W.value=(s.price*1.05).toPrecision(6),W.focus())}),q.querySelector('[data-ctl="arm"]').addEventListener("click",async()=>{let t=W.value.replace(/[$,\s]/g,"");if(!t||Number(t)<=0)return;E=!1,q.hidden=!0;let n=await P("tape_target",{symbol:L.split("-")[0],op:">",price:t});Y(n.ok?`Watching ${L.split("-")[0]} > $${t} \u2014 iMessage when it crosses.`:String(n.error??"Couldn't set the watch."))}),C.innerHTML="";for(let t of[...H.mode==="live"?[10,25,100]:[10,25,100],0,-1]){let n=document.createElement("button");n.type="button",n.className="tt-stake",t===0?(n.textContent="\xBD",n.dataset.stake="half"):t===-1?(n.textContent="MAX",n.dataset.stake="max"):(n.textContent=`$${t}`,n.dataset.stake=String(t)),n.dataset.stake===y&&n.classList.add("on"),n.addEventListener("click",()=>{y=n.dataset.stake,K()}),C.appendChild(n)}B.innerHTML="";for(let t of H.markets??[]){let n=document.createElement("button");n.type="button",n.className="tt-mkt",n.textContent=t.symbol,t.productId===L&&n.classList.add("on"),n.addEventListener("click",()=>{L=t.productId;for(let o of Array.from(B.children))o.classList.toggle("on",o.textContent===t.symbol);$()}),B.appendChild(n)}H.welcomed||(G.hidden=!1,G.querySelector(".tt-go").addEventListener("click",()=>{G.hidden=!0,P("tape_seen",{})})),window.addEventListener("resize",et),document.addEventListener("visibilitychange",()=>{document.hidden||$()}),window.setInterval(()=>void $(),2500),$()}var mt=`
.ttape{position:relative;width:100%;color:${l};font-variant-numeric:tabular-nums}
.tt-head{display:flex;justify-content:space-between;align-items:center;padding:0 2px 6px}
.tt-chiprow{display:flex;align-items:baseline;gap:8px}
.tt-chip{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:3px 10px;font:600 12px ui-monospace,monospace;color:${l}}
.tt-px{font:700 20px/1 ui-monospace,monospace}
.tt-chg{font:600 12px ui-monospace,monospace}
.tt-stage{position:relative;width:100%}
.tt-canvas{display:block;width:100%;height:min(300px,60vw);border-radius:12px;background:rgba(255,255,255,0.025)}
.tt-rail{position:absolute;left:6px;top:8px;bottom:8px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;scrollbar-width:none}
.tt-rail::-webkit-scrollbar{display:none}
.tt-mkt{background:rgba(10,10,14,0.55);border:1px solid rgba(255,255,255,0.1);color:${b};border-radius:8px;padding:4px 7px;font:600 10px ui-monospace,monospace;cursor:pointer;backdrop-filter:blur(4px)}
.tt-mkt.on{color:${l};border-color:rgba(255,255,255,0.4)}
.tt-pos{position:absolute;left:56px;top:8px}
.tt-pos-chip{display:inline-block;background:rgba(10,10,14,0.6);border:1px solid ${l};border-left-width:3px;border-radius:8px;padding:4px 8px;font:600 11px ui-monospace,monospace;backdrop-filter:blur(4px)}
.tt-banner{position:absolute;top:8px;left:0;right:0;display:flex;justify-content:center;pointer-events:none}
.tt-bpill{pointer-events:auto;background:rgba(10,10,14,0.85);border:1.5px solid ${l};border-radius:999px;padding:5px 12px;font:700 12px ui-monospace,monospace;backdrop-filter:blur(6px)}
.tt-share{margin-left:8px;background:none;border:none;border-left:1px solid rgba(255,255,255,0.2);padding-left:8px;color:inherit;font:inherit;cursor:pointer;text-decoration:underline}
.tt-ledger{display:flex;gap:12px;align-items:baseline;padding:8px 4px 4px;font:500 11px ui-monospace,monospace;color:${b}}
.tt-mode{margin-left:auto;text-transform:uppercase;letter-spacing:0.08em}
.tt-stakes{display:flex;gap:6px;padding:4px 2px}
.tt-stake{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:${b};border-radius:10px;padding:8px 0;font:600 12px ui-monospace,monospace;cursor:pointer}
.tt-stake.on{color:#0b0b0e;background:${l};border-color:${l}}
.tt-buttons{display:flex;gap:8px;padding:4px 0 2px}
.tt-btn{flex:1;border:none;border-radius:16px;padding:16px 0 14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;transition:opacity .15s}
.tt-btn span{font:800 18px/1 ui-monospace,monospace;letter-spacing:0.06em}
.tt-btn em{font:500 10px ui-monospace,monospace;font-style:normal;opacity:0.75}
.tt-btn.tt-up{background:${f};color:#06130a}
.tt-btn.tt-down{background:${T};color:#170409}
.tt-btn:disabled{opacity:0.28;cursor:default}
.tt-hint{text-align:center;font:500 10px ui-monospace,monospace;color:${b};padding:4px 0 0;min-height:14px}
.tt-posctl{display:flex;align-items:center;gap:6px;padding:6px 2px 0}
.tt-poslabel{font:600 11px ui-monospace,monospace;color:${b};flex:1;text-transform:uppercase;letter-spacing:0.08em}
.tt-ctl{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);color:${l};border-radius:10px;padding:8px 14px;font:700 12px ui-monospace,monospace;cursor:pointer}
.tt-ctl-down{border-color:${T}66;color:${T}}
.tt-approve{background:${f};border-color:${f};color:#06130a}
.tt-target{display:flex;gap:6px;padding:6px 2px 0}
.tt-target-in{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.14);border-radius:10px;color:${l};padding:8px 10px;font:600 12px ui-monospace,monospace}
.tt-pending{padding:4px 0}
.tt-pcard{border:1.5px dashed rgba(255,255,255,0.35);border-radius:14px;padding:12px;background:rgba(255,255,255,0.03)}
.tt-pkick{font:600 10px ui-monospace,monospace;color:${b};text-transform:uppercase;letter-spacing:0.1em}
.tt-plabel{font:700 16px/1.3 ui-monospace,monospace;margin:6px 0 8px}
.tt-ptable{width:100%;border-collapse:collapse;font:500 12px ui-monospace,monospace}
.tt-ptable td{padding:2px 0;color:${b}}
.tt-ptable td+td{text-align:right;color:${l}}
.tt-caps{height:4px;border-radius:2px;background:rgba(255,255,255,0.08);margin-top:8px;overflow:hidden}
.tt-caps span{display:block;height:100%;background:${l}}
.tt-capline{font:500 10px ui-monospace,monospace;color:${b};margin-top:3px}
.tt-prow{display:flex;gap:8px;margin-top:10px}
.tt-prow .tt-ctl{flex:1;padding:11px 0}
.tt-welcome{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,8,12,0.82);border-radius:12px;backdrop-filter:blur(6px);z-index:3}
.tt-welcome-card{max-width:280px;text-align:center;padding:20px}
.tt-welcome-kicker{font:600 10px ui-monospace,monospace;color:${f};text-transform:uppercase;letter-spacing:0.12em}
.tt-welcome-card h3{font:800 22px/1.2 inherit;margin:8px 0 10px;color:${l}}
.tt-welcome-card p{font:500 12px/1.5 inherit;color:${b};margin:0 0 8px}
.tt-welcome-card b{color:${l}}
.tt-go{margin-top:8px;background:${f};border:none;color:#06130a;border-radius:12px;padding:11px 26px;font:800 13px ui-monospace,monospace;cursor:pointer}
`;})();
