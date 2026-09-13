"use strict";(()=>{var VM=Object.create;var Z0=Object.defineProperty;var HM=Object.getOwnPropertyDescriptor;var GM=Object.getOwnPropertyNames;var kM=Object.getPrototypeOf,XM=Object.prototype.hasOwnProperty;var Ni=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var WM=(e,t,n,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of GM(t))!XM.call(e,s)&&s!==n&&Z0(e,s,{get:()=>t[s],enumerable:!(i=HM(t,s))||i.enumerable});return e};var wc=(e,t,n)=>(n=e!=null?VM(kM(e)):{},WM(t||!e||!e.__esModule?Z0(n,"default",{value:e,enumerable:!0}):n,e));var av=Ni(Xt=>{"use strict";var Ad=Symbol.for("react.transitional.element"),qM=Symbol.for("react.portal"),YM=Symbol.for("react.fragment"),ZM=Symbol.for("react.strict_mode"),JM=Symbol.for("react.profiler"),KM=Symbol.for("react.consumer"),jM=Symbol.for("react.context"),QM=Symbol.for("react.forward_ref"),$M=Symbol.for("react.suspense"),t1=Symbol.for("react.memo"),$0=Symbol.for("react.lazy"),e1=Symbol.for("react.activity"),J0=Symbol.iterator;function n1(e){return e===null||typeof e!="object"?null:(e=J0&&e[J0]||e["@@iterator"],typeof e=="function"?e:null)}var tv={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},ev=Object.assign,nv={};function ur(e,t,n){this.props=e,this.context=t,this.refs=nv,this.updater=n||tv}ur.prototype.isReactComponent={};ur.prototype.setState=function(e,t){if(typeof e!="object"&&typeof e!="function"&&e!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,t,"setState")};ur.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};function iv(){}iv.prototype=ur.prototype;function wd(e,t,n){this.props=e,this.context=t,this.refs=nv,this.updater=n||tv}var Cd=wd.prototype=new iv;Cd.constructor=wd;ev(Cd,ur.prototype);Cd.isPureReactComponent=!0;var K0=Array.isArray;function Td(){}var Ae={H:null,A:null,T:null,S:null},sv=Object.prototype.hasOwnProperty;function Rd(e,t,n){var i=n.ref;return{$$typeof:Ad,type:e,key:t,ref:i!==void 0?i:null,props:n}}function i1(e,t){return Rd(e.type,t,e.props)}function Dd(e){return typeof e=="object"&&e!==null&&e.$$typeof===Ad}function s1(e){var t={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,function(n){return t[n]})}var j0=/\/+/g;function Ed(e,t){return typeof e=="object"&&e!==null&&e.key!=null?s1(""+e.key):t.toString(36)}function a1(e){switch(e.status){case"fulfilled":return e.value;case"rejected":throw e.reason;default:switch(typeof e.status=="string"?e.then(Td,Td):(e.status="pending",e.then(function(t){e.status==="pending"&&(e.status="fulfilled",e.value=t)},function(t){e.status==="pending"&&(e.status="rejected",e.reason=t)})),e.status){case"fulfilled":return e.value;case"rejected":throw e.reason}}throw e}function cr(e,t,n,i,s){var a=typeof e;(a==="undefined"||a==="boolean")&&(e=null);var r=!1;if(e===null)r=!0;else switch(a){case"bigint":case"string":case"number":r=!0;break;case"object":switch(e.$$typeof){case Ad:case qM:r=!0;break;case $0:return r=e._init,cr(r(e._payload),t,n,i,s)}}if(r)return s=s(e),r=i===""?"."+Ed(e,0):i,K0(s)?(n="",r!=null&&(n=r.replace(j0,"$&/")+"/"),cr(s,t,n,"",function(l){return l})):s!=null&&(Dd(s)&&(s=i1(s,n+(s.key==null||e&&e.key===s.key?"":(""+s.key).replace(j0,"$&/")+"/")+r)),t.push(s)),1;r=0;var o=i===""?".":i+":";if(K0(e))for(var c=0;c<e.length;c++)i=e[c],a=o+Ed(i,c),r+=cr(i,t,n,a,s);else if(c=n1(e),typeof c=="function")for(e=c.call(e),c=0;!(i=e.next()).done;)i=i.value,a=o+Ed(i,c++),r+=cr(i,t,n,a,s);else if(a==="object"){if(typeof e.then=="function")return cr(a1(e),t,n,i,s);throw t=String(e),Error("Objects are not valid as a React child (found: "+(t==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":t)+"). If you meant to render a collection of children, use an array instead.")}return r}function Cc(e,t,n){if(e==null)return e;var i=[],s=0;return cr(e,i,"","",function(a){return t.call(n,a,s++)}),i}function r1(e){if(e._status===-1){var t=e._result;t=t(),t.then(function(n){(e._status===0||e._status===-1)&&(e._status=1,e._result=n)},function(n){(e._status===0||e._status===-1)&&(e._status=2,e._result=n)}),e._status===-1&&(e._status=0,e._result=t)}if(e._status===1)return e._result.default;throw e._result}var Q0=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},o1={map:Cc,forEach:function(e,t,n){Cc(e,function(){t.apply(this,arguments)},n)},count:function(e){var t=0;return Cc(e,function(){t++}),t},toArray:function(e){return Cc(e,function(t){return t})||[]},only:function(e){if(!Dd(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};Xt.Activity=e1;Xt.Children=o1;Xt.Component=ur;Xt.Fragment=YM;Xt.Profiler=JM;Xt.PureComponent=wd;Xt.StrictMode=ZM;Xt.Suspense=$M;Xt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=Ae;Xt.__COMPILER_RUNTIME={__proto__:null,c:function(e){return Ae.H.useMemoCache(e)}};Xt.cache=function(e){return function(){return e.apply(null,arguments)}};Xt.cacheSignal=function(){return null};Xt.cloneElement=function(e,t,n){if(e==null)throw Error("The argument must be a React element, but you passed "+e+".");var i=ev({},e.props),s=e.key;if(t!=null)for(a in t.key!==void 0&&(s=""+t.key),t)!sv.call(t,a)||a==="key"||a==="__self"||a==="__source"||a==="ref"&&t.ref===void 0||(i[a]=t[a]);var a=arguments.length-2;if(a===1)i.children=n;else if(1<a){for(var r=Array(a),o=0;o<a;o++)r[o]=arguments[o+2];i.children=r}return Rd(e.type,s,i)};Xt.createContext=function(e){return e={$$typeof:jM,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null},e.Provider=e,e.Consumer={$$typeof:KM,_context:e},e};Xt.createElement=function(e,t,n){var i,s={},a=null;if(t!=null)for(i in t.key!==void 0&&(a=""+t.key),t)sv.call(t,i)&&i!=="key"&&i!=="__self"&&i!=="__source"&&(s[i]=t[i]);var r=arguments.length-2;if(r===1)s.children=n;else if(1<r){for(var o=Array(r),c=0;c<r;c++)o[c]=arguments[c+2];s.children=o}if(e&&e.defaultProps)for(i in r=e.defaultProps,r)s[i]===void 0&&(s[i]=r[i]);return Rd(e,a,s)};Xt.createRef=function(){return{current:null}};Xt.forwardRef=function(e){return{$$typeof:QM,render:e}};Xt.isValidElement=Dd;Xt.lazy=function(e){return{$$typeof:$0,_payload:{_status:-1,_result:e},_init:r1}};Xt.memo=function(e,t){return{$$typeof:t1,type:e,compare:t===void 0?null:t}};Xt.startTransition=function(e){var t=Ae.T,n={};Ae.T=n;try{var i=e(),s=Ae.S;s!==null&&s(n,i),typeof i=="object"&&i!==null&&typeof i.then=="function"&&i.then(Td,Q0)}catch(a){Q0(a)}finally{t!==null&&n.types!==null&&(t.types=n.types),Ae.T=t}};Xt.unstable_useCacheRefresh=function(){return Ae.H.useCacheRefresh()};Xt.use=function(e){return Ae.H.use(e)};Xt.useActionState=function(e,t,n){return Ae.H.useActionState(e,t,n)};Xt.useCallback=function(e,t){return Ae.H.useCallback(e,t)};Xt.useContext=function(e){return Ae.H.useContext(e)};Xt.useDebugValue=function(){};Xt.useDeferredValue=function(e,t){return Ae.H.useDeferredValue(e,t)};Xt.useEffect=function(e,t){return Ae.H.useEffect(e,t)};Xt.useEffectEvent=function(e){return Ae.H.useEffectEvent(e)};Xt.useId=function(){return Ae.H.useId()};Xt.useImperativeHandle=function(e,t,n){return Ae.H.useImperativeHandle(e,t,n)};Xt.useInsertionEffect=function(e,t){return Ae.H.useInsertionEffect(e,t)};Xt.useLayoutEffect=function(e,t){return Ae.H.useLayoutEffect(e,t)};Xt.useMemo=function(e,t){return Ae.H.useMemo(e,t)};Xt.useOptimistic=function(e,t){return Ae.H.useOptimistic(e,t)};Xt.useReducer=function(e,t,n){return Ae.H.useReducer(e,t,n)};Xt.useRef=function(e){return Ae.H.useRef(e)};Xt.useState=function(e){return Ae.H.useState(e)};Xt.useSyncExternalStore=function(e,t,n){return Ae.H.useSyncExternalStore(e,t,n)};Xt.useTransition=function(){return Ae.H.useTransition()};Xt.version="19.2.8"});var Rc=Ni((D3,rv)=>{"use strict";rv.exports=av()});var gv=Ni(Ne=>{"use strict";function Id(e,t){var n=e.length;e.push(t);t:for(;0<n;){var i=n-1>>>1,s=e[i];if(0<Dc(s,t))e[i]=t,e[n]=s,n=i;else break t}}function Ui(e){return e.length===0?null:e[0]}function Uc(e){if(e.length===0)return null;var t=e[0],n=e.pop();if(n!==t){e[0]=n;t:for(var i=0,s=e.length,a=s>>>1;i<a;){var r=2*(i+1)-1,o=e[r],c=r+1,l=e[c];if(0>Dc(o,n))c<s&&0>Dc(l,o)?(e[i]=l,e[c]=n,i=c):(e[i]=o,e[r]=n,i=r);else if(c<s&&0>Dc(l,n))e[i]=l,e[c]=n,i=c;else break t}}return t}function Dc(e,t){var n=e.sortIndex-t.sortIndex;return n!==0?n:e.id-t.id}Ne.unstable_now=void 0;typeof performance=="object"&&typeof performance.now=="function"?(ov=performance,Ne.unstable_now=function(){return ov.now()}):(Nd=Date,lv=Nd.now(),Ne.unstable_now=function(){return Nd.now()-lv});var ov,Nd,lv,Qi=[],Ns=[],l1=1,ai=null,vn=3,Od=!1,Ro=!1,Do=!1,Pd=!1,hv=typeof setTimeout=="function"?setTimeout:null,fv=typeof clearTimeout=="function"?clearTimeout:null,cv=typeof setImmediate<"u"?setImmediate:null;function Nc(e){for(var t=Ui(Ns);t!==null;){if(t.callback===null)Uc(Ns);else if(t.startTime<=e)Uc(Ns),t.sortIndex=t.expirationTime,Id(Qi,t);else break;t=Ui(Ns)}}function zd(e){if(Do=!1,Nc(e),!Ro)if(Ui(Qi)!==null)Ro=!0,fr||(fr=!0,hr());else{var t=Ui(Ns);t!==null&&Bd(zd,t.startTime-e)}}var fr=!1,No=-1,dv=5,pv=-1;function mv(){return Pd?!0:!(Ne.unstable_now()-pv<dv)}function Ud(){if(Pd=!1,fr){var e=Ne.unstable_now();pv=e;var t=!0;try{t:{Ro=!1,Do&&(Do=!1,fv(No),No=-1),Od=!0;var n=vn;try{e:{for(Nc(e),ai=Ui(Qi);ai!==null&&!(ai.expirationTime>e&&mv());){var i=ai.callback;if(typeof i=="function"){ai.callback=null,vn=ai.priorityLevel;var s=i(ai.expirationTime<=e);if(e=Ne.unstable_now(),typeof s=="function"){ai.callback=s,Nc(e),t=!0;break e}ai===Ui(Qi)&&Uc(Qi),Nc(e)}else Uc(Qi);ai=Ui(Qi)}if(ai!==null)t=!0;else{var a=Ui(Ns);a!==null&&Bd(zd,a.startTime-e),t=!1}}break t}finally{ai=null,vn=n,Od=!1}t=void 0}}finally{t?hr():fr=!1}}}var hr;typeof cv=="function"?hr=function(){cv(Ud)}:typeof MessageChannel<"u"?(Ld=new MessageChannel,uv=Ld.port2,Ld.port1.onmessage=Ud,hr=function(){uv.postMessage(null)}):hr=function(){hv(Ud,0)};var Ld,uv;function Bd(e,t){No=hv(function(){e(Ne.unstable_now())},t)}Ne.unstable_IdlePriority=5;Ne.unstable_ImmediatePriority=1;Ne.unstable_LowPriority=4;Ne.unstable_NormalPriority=3;Ne.unstable_Profiling=null;Ne.unstable_UserBlockingPriority=2;Ne.unstable_cancelCallback=function(e){e.callback=null};Ne.unstable_forceFrameRate=function(e){0>e||125<e?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):dv=0<e?Math.floor(1e3/e):5};Ne.unstable_getCurrentPriorityLevel=function(){return vn};Ne.unstable_next=function(e){switch(vn){case 1:case 2:case 3:var t=3;break;default:t=vn}var n=vn;vn=t;try{return e()}finally{vn=n}};Ne.unstable_requestPaint=function(){Pd=!0};Ne.unstable_runWithPriority=function(e,t){switch(e){case 1:case 2:case 3:case 4:case 5:break;default:e=3}var n=vn;vn=e;try{return t()}finally{vn=n}};Ne.unstable_scheduleCallback=function(e,t,n){var i=Ne.unstable_now();switch(typeof n=="object"&&n!==null?(n=n.delay,n=typeof n=="number"&&0<n?i+n:i):n=i,e){case 1:var s=-1;break;case 2:s=250;break;case 5:s=1073741823;break;case 4:s=1e4;break;default:s=5e3}return s=n+s,e={id:l1++,callback:t,priorityLevel:e,startTime:n,expirationTime:s,sortIndex:-1},n>i?(e.sortIndex=n,Id(Ns,e),Ui(Qi)===null&&e===Ui(Ns)&&(Do?(fv(No),No=-1):Do=!0,Bd(zd,n-i))):(e.sortIndex=s,Id(Qi,e),Ro||Od||(Ro=!0,fr||(fr=!0,hr()))),e};Ne.unstable_shouldYield=mv;Ne.unstable_wrapCallback=function(e){var t=vn;return function(){var n=vn;vn=t;try{return e.apply(this,arguments)}finally{vn=n}}}});var _v=Ni((U3,vv)=>{"use strict";vv.exports=gv()});var xv=Ni(Tn=>{"use strict";var c1=Rc();function yv(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function Us(){}var En={d:{f:Us,r:function(){throw Error(yv(522))},D:Us,C:Us,L:Us,m:Us,X:Us,S:Us,M:Us},p:0,findDOMNode:null},u1=Symbol.for("react.portal");function h1(e,t,n){var i=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:u1,key:i==null?null:""+i,children:e,containerInfo:t,implementation:n}}var Uo=c1.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function Lc(e,t){if(e==="font")return"";if(typeof t=="string")return t==="use-credentials"?t:""}Tn.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=En;Tn.createPortal=function(e,t){var n=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!t||t.nodeType!==1&&t.nodeType!==9&&t.nodeType!==11)throw Error(yv(299));return h1(e,t,null,n)};Tn.flushSync=function(e){var t=Uo.T,n=En.p;try{if(Uo.T=null,En.p=2,e)return e()}finally{Uo.T=t,En.p=n,En.d.f()}};Tn.preconnect=function(e,t){typeof e=="string"&&(t?(t=t.crossOrigin,t=typeof t=="string"?t==="use-credentials"?t:"":void 0):t=null,En.d.C(e,t))};Tn.prefetchDNS=function(e){typeof e=="string"&&En.d.D(e)};Tn.preinit=function(e,t){if(typeof e=="string"&&t&&typeof t.as=="string"){var n=t.as,i=Lc(n,t.crossOrigin),s=typeof t.integrity=="string"?t.integrity:void 0,a=typeof t.fetchPriority=="string"?t.fetchPriority:void 0;n==="style"?En.d.S(e,typeof t.precedence=="string"?t.precedence:void 0,{crossOrigin:i,integrity:s,fetchPriority:a}):n==="script"&&En.d.X(e,{crossOrigin:i,integrity:s,fetchPriority:a,nonce:typeof t.nonce=="string"?t.nonce:void 0})}};Tn.preinitModule=function(e,t){if(typeof e=="string")if(typeof t=="object"&&t!==null){if(t.as==null||t.as==="script"){var n=Lc(t.as,t.crossOrigin);En.d.M(e,{crossOrigin:n,integrity:typeof t.integrity=="string"?t.integrity:void 0,nonce:typeof t.nonce=="string"?t.nonce:void 0})}}else t==null&&En.d.M(e)};Tn.preload=function(e,t){if(typeof e=="string"&&typeof t=="object"&&t!==null&&typeof t.as=="string"){var n=t.as,i=Lc(n,t.crossOrigin);En.d.L(e,n,{crossOrigin:i,integrity:typeof t.integrity=="string"?t.integrity:void 0,nonce:typeof t.nonce=="string"?t.nonce:void 0,type:typeof t.type=="string"?t.type:void 0,fetchPriority:typeof t.fetchPriority=="string"?t.fetchPriority:void 0,referrerPolicy:typeof t.referrerPolicy=="string"?t.referrerPolicy:void 0,imageSrcSet:typeof t.imageSrcSet=="string"?t.imageSrcSet:void 0,imageSizes:typeof t.imageSizes=="string"?t.imageSizes:void 0,media:typeof t.media=="string"?t.media:void 0})}};Tn.preloadModule=function(e,t){if(typeof e=="string")if(t){var n=Lc(t.as,t.crossOrigin);En.d.m(e,{as:typeof t.as=="string"&&t.as!=="script"?t.as:void 0,crossOrigin:n,integrity:typeof t.integrity=="string"?t.integrity:void 0})}else En.d.m(e)};Tn.requestFormReset=function(e){En.d.r(e)};Tn.unstable_batchedUpdates=function(e,t){return e(t)};Tn.useFormState=function(e,t,n){return Uo.H.useFormState(e,t,n)};Tn.useFormStatus=function(){return Uo.H.useHostTransitionStatus()};Tn.version="19.2.8"});var Mv=Ni((I3,Sv)=>{"use strict";function bv(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(bv)}catch(e){console.error(e)}}bv(),Sv.exports=xv()});var Ob=Ni(sh=>{"use strict";var $e=_v(),J_=Rc(),f1=Mv();function st(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function K_(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function _l(e){var t=e,n=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(n=t.return),e=t.return;while(e)}return t.tag===3?n:null}function j_(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function Q_(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function Ev(e){if(_l(e)!==e)throw Error(st(188))}function d1(e){var t=e.alternate;if(!t){if(t=_l(e),t===null)throw Error(st(188));return t!==e?null:e}for(var n=e,i=t;;){var s=n.return;if(s===null)break;var a=s.alternate;if(a===null){if(i=s.return,i!==null){n=i;continue}break}if(s.child===a.child){for(a=s.child;a;){if(a===n)return Ev(s),e;if(a===i)return Ev(s),t;a=a.sibling}throw Error(st(188))}if(n.return!==i.return)n=s,i=a;else{for(var r=!1,o=s.child;o;){if(o===n){r=!0,n=s,i=a;break}if(o===i){r=!0,i=s,n=a;break}o=o.sibling}if(!r){for(o=a.child;o;){if(o===n){r=!0,n=a,i=s;break}if(o===i){r=!0,i=a,n=s;break}o=o.sibling}if(!r)throw Error(st(189))}}if(n.alternate!==i)throw Error(st(190))}if(n.tag!==3)throw Error(st(188));return n.stateNode.current===n?e:t}function $_(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=$_(e),t!==null)return t;e=e.sibling}return null}var Re=Object.assign,p1=Symbol.for("react.element"),Ic=Symbol.for("react.transitional.element"),Vo=Symbol.for("react.portal"),_r=Symbol.for("react.fragment"),ty=Symbol.for("react.strict_mode"),_p=Symbol.for("react.profiler"),ey=Symbol.for("react.consumer"),rs=Symbol.for("react.context"),dm=Symbol.for("react.forward_ref"),yp=Symbol.for("react.suspense"),xp=Symbol.for("react.suspense_list"),pm=Symbol.for("react.memo"),Ls=Symbol.for("react.lazy");Symbol.for("react.scope");var bp=Symbol.for("react.activity");Symbol.for("react.legacy_hidden");Symbol.for("react.tracing_marker");var m1=Symbol.for("react.memo_cache_sentinel");Symbol.for("react.view_transition");var Tv=Symbol.iterator;function Lo(e){return e===null||typeof e!="object"?null:(e=Tv&&e[Tv]||e["@@iterator"],typeof e=="function"?e:null)}var g1=Symbol.for("react.client.reference");function Sp(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===g1?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case _r:return"Fragment";case _p:return"Profiler";case ty:return"StrictMode";case yp:return"Suspense";case xp:return"SuspenseList";case bp:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case Vo:return"Portal";case rs:return e.displayName||"Context";case ey:return(e._context.displayName||"Context")+".Consumer";case dm:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case pm:return t=e.displayName||null,t!==null?t:Sp(e.type)||"Memo";case Ls:t=e._payload,e=e._init;try{return Sp(e(t))}catch{}}return null}var Ho=Array.isArray,Bt=J_.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,he=f1.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,Na={pending:!1,data:null,method:null,action:null},Mp=[],yr=-1;function zi(e){return{current:e}}function on(e){0>yr||(e.current=Mp[yr],Mp[yr]=null,yr--)}function Ee(e,t){yr++,Mp[yr]=e.current,e.current=t}var Pi=zi(null),sl=zi(null),Xs=zi(null),du=zi(null);function pu(e,t){switch(Ee(Xs,t),Ee(sl,e),Ee(Pi,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?U_(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=U_(t),e=bb(t,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}on(Pi),Ee(Pi,e)}function zr(){on(Pi),on(sl),on(Xs)}function Ep(e){e.memoizedState!==null&&Ee(du,e);var t=Pi.current,n=bb(t,e.type);t!==n&&(Ee(sl,e),Ee(Pi,n))}function mu(e){sl.current===e&&(on(Pi),on(sl)),du.current===e&&(on(du),ml._currentValue=Na)}var Fd,Av;function wa(e){if(Fd===void 0)try{throw Error()}catch(n){var t=n.stack.trim().match(/\n( *(at )?)/);Fd=t&&t[1]||"",Av=-1<n.stack.indexOf(`
    at`)?" (<anonymous>)":-1<n.stack.indexOf("@")?"@unknown:0:0":""}return`
`+Fd+e+Av}var Vd=!1;function Hd(e,t){if(!e||Vd)return"";Vd=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var i={DetermineComponentFrameRoot:function(){try{if(t){var d=function(){throw Error()};if(Object.defineProperty(d.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(d,[])}catch(p){var u=p}Reflect.construct(e,[],d)}else{try{d.call()}catch(p){u=p}e.call(d.prototype)}}else{try{throw Error()}catch(p){u=p}(d=e())&&typeof d.catch=="function"&&d.catch(function(){})}}catch(p){if(p&&u&&typeof p.stack=="string")return[p.stack,u.stack]}return[null,null]}};i.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var s=Object.getOwnPropertyDescriptor(i.DetermineComponentFrameRoot,"name");s&&s.configurable&&Object.defineProperty(i.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var a=i.DetermineComponentFrameRoot(),r=a[0],o=a[1];if(r&&o){var c=r.split(`
`),l=o.split(`
`);for(s=i=0;i<c.length&&!c[i].includes("DetermineComponentFrameRoot");)i++;for(;s<l.length&&!l[s].includes("DetermineComponentFrameRoot");)s++;if(i===c.length||s===l.length)for(i=c.length-1,s=l.length-1;1<=i&&0<=s&&c[i]!==l[s];)s--;for(;1<=i&&0<=s;i--,s--)if(c[i]!==l[s]){if(i!==1||s!==1)do if(i--,s--,0>s||c[i]!==l[s]){var h=`
`+c[i].replace(" at new "," at ");return e.displayName&&h.includes("<anonymous>")&&(h=h.replace("<anonymous>",e.displayName)),h}while(1<=i&&0<=s);break}}}finally{Vd=!1,Error.prepareStackTrace=n}return(n=e?e.displayName||e.name:"")?wa(n):""}function v1(e,t){switch(e.tag){case 26:case 27:case 5:return wa(e.type);case 16:return wa("Lazy");case 13:return e.child!==t&&t!==null?wa("Suspense Fallback"):wa("Suspense");case 19:return wa("SuspenseList");case 0:case 15:return Hd(e.type,!1);case 11:return Hd(e.type.render,!1);case 1:return Hd(e.type,!0);case 31:return wa("Activity");default:return""}}function wv(e){try{var t="",n=null;do t+=v1(e,n),n=e,e=e.return;while(e);return t}catch(i){return`
Error generating stack: `+i.message+`
`+i.stack}}var Tp=Object.prototype.hasOwnProperty,mm=$e.unstable_scheduleCallback,Gd=$e.unstable_cancelCallback,_1=$e.unstable_shouldYield,y1=$e.unstable_requestPaint,kn=$e.unstable_now,x1=$e.unstable_getCurrentPriorityLevel,ny=$e.unstable_ImmediatePriority,iy=$e.unstable_UserBlockingPriority,gu=$e.unstable_NormalPriority,b1=$e.unstable_LowPriority,sy=$e.unstable_IdlePriority,S1=$e.log,M1=$e.unstable_setDisableYieldValue,yl=null,Xn=null;function Fs(e){if(typeof S1=="function"&&M1(e),Xn&&typeof Xn.setStrictMode=="function")try{Xn.setStrictMode(yl,e)}catch{}}var Wn=Math.clz32?Math.clz32:A1,E1=Math.log,T1=Math.LN2;function A1(e){return e>>>=0,e===0?32:31-(E1(e)/T1|0)|0}var Oc=256,Pc=262144,zc=4194304;function Ca(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function Gu(e,t,n){var i=e.pendingLanes;if(i===0)return 0;var s=0,a=e.suspendedLanes,r=e.pingedLanes;e=e.warmLanes;var o=i&134217727;return o!==0?(i=o&~a,i!==0?s=Ca(i):(r&=o,r!==0?s=Ca(r):n||(n=o&~e,n!==0&&(s=Ca(n))))):(o=i&~a,o!==0?s=Ca(o):r!==0?s=Ca(r):n||(n=i&~e,n!==0&&(s=Ca(n)))),s===0?0:t!==0&&t!==s&&(t&a)===0&&(a=s&-s,n=t&-t,a>=n||a===32&&(n&4194048)!==0)?t:s}function xl(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function w1(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function ay(){var e=zc;return zc<<=1,(zc&62914560)===0&&(zc=4194304),e}function kd(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function bl(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function C1(e,t,n,i,s,a){var r=e.pendingLanes;e.pendingLanes=n,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=n,e.entangledLanes&=n,e.errorRecoveryDisabledLanes&=n,e.shellSuspendCounter=0;var o=e.entanglements,c=e.expirationTimes,l=e.hiddenUpdates;for(n=r&~n;0<n;){var h=31-Wn(n),d=1<<h;o[h]=0,c[h]=-1;var u=l[h];if(u!==null)for(l[h]=null,h=0;h<u.length;h++){var p=u[h];p!==null&&(p.lane&=-536870913)}n&=~d}i!==0&&ry(e,i,0),a!==0&&s===0&&e.tag!==0&&(e.suspendedLanes|=a&~(r&~t))}function ry(e,t,n){e.pendingLanes|=t,e.suspendedLanes&=~t;var i=31-Wn(t);e.entangledLanes|=t,e.entanglements[i]=e.entanglements[i]|1073741824|n&261930}function oy(e,t){var n=e.entangledLanes|=t;for(e=e.entanglements;n;){var i=31-Wn(n),s=1<<i;s&t|e[i]&t&&(e[i]|=t),n&=~s}}function ly(e,t){var n=t&-t;return n=(n&42)!==0?1:gm(n),(n&(e.suspendedLanes|t))!==0?0:n}function gm(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function vm(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function cy(){var e=he.p;return e!==0?e:(e=window.event,e===void 0?32:Ub(e.type))}function Cv(e,t){var n=he.p;try{return he.p=e,t()}finally{he.p=n}}var ia=Math.random().toString(36).slice(2),hn="__reactFiber$"+ia,In="__reactProps$"+ia,Zr="__reactContainer$"+ia,Ap="__reactEvents$"+ia,R1="__reactListeners$"+ia,D1="__reactHandles$"+ia,Rv="__reactResources$"+ia,Sl="__reactMarker$"+ia;function _m(e){delete e[hn],delete e[In],delete e[Ap],delete e[R1],delete e[D1]}function xr(e){var t=e[hn];if(t)return t;for(var n=e.parentNode;n;){if(t=n[Zr]||n[hn]){if(n=t.alternate,t.child!==null||n!==null&&n.child!==null)for(e=z_(e);e!==null;){if(n=e[hn])return n;e=z_(e)}return t}e=n,n=e.parentNode}return null}function Jr(e){if(e=e[hn]||e[Zr]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function Go(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(st(33))}function Dr(e){var t=e[Rv];return t||(t=e[Rv]={hoistableStyles:new Map,hoistableScripts:new Map}),t}function rn(e){e[Sl]=!0}var uy=new Set,hy={};function Ha(e,t){Br(e,t),Br(e+"Capture",t)}function Br(e,t){for(hy[e]=t,e=0;e<t.length;e++)uy.add(t[e])}var N1=RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"),Dv={},Nv={};function U1(e){return Tp.call(Nv,e)?!0:Tp.call(Dv,e)?!1:N1.test(e)?Nv[e]=!0:(Dv[e]=!0,!1)}function Qc(e,t,n){if(U1(t))if(n===null)e.removeAttribute(t);else{switch(typeof n){case"undefined":case"function":case"symbol":e.removeAttribute(t);return;case"boolean":var i=t.toLowerCase().slice(0,5);if(i!=="data-"&&i!=="aria-"){e.removeAttribute(t);return}}e.setAttribute(t,""+n)}}function Bc(e,t,n){if(n===null)e.removeAttribute(t);else{switch(typeof n){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(t);return}e.setAttribute(t,""+n)}}function $i(e,t,n,i){if(i===null)e.removeAttribute(n);else{switch(typeof i){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(n);return}e.setAttributeNS(t,n,""+i)}}function oi(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function fy(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function L1(e,t,n){var i=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&typeof i<"u"&&typeof i.get=="function"&&typeof i.set=="function"){var s=i.get,a=i.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return s.call(this)},set:function(r){n=""+r,a.call(this,r)}}),Object.defineProperty(e,t,{enumerable:i.enumerable}),{getValue:function(){return n},setValue:function(r){n=""+r},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function wp(e){if(!e._valueTracker){var t=fy(e)?"checked":"value";e._valueTracker=L1(e,t,""+e[t])}}function dy(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),i="";return e&&(i=fy(e)?e.checked?"true":"false":e.value),e=i,e!==n?(t.setValue(e),!0):!1}function vu(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var I1=/[\n"\\]/g;function ui(e){return e.replace(I1,function(t){return"\\"+t.charCodeAt(0).toString(16)+" "})}function Cp(e,t,n,i,s,a,r,o){e.name="",r!=null&&typeof r!="function"&&typeof r!="symbol"&&typeof r!="boolean"?e.type=r:e.removeAttribute("type"),t!=null?r==="number"?(t===0&&e.value===""||e.value!=t)&&(e.value=""+oi(t)):e.value!==""+oi(t)&&(e.value=""+oi(t)):r!=="submit"&&r!=="reset"||e.removeAttribute("value"),t!=null?Rp(e,r,oi(t)):n!=null?Rp(e,r,oi(n)):i!=null&&e.removeAttribute("value"),s==null&&a!=null&&(e.defaultChecked=!!a),s!=null&&(e.checked=s&&typeof s!="function"&&typeof s!="symbol"),o!=null&&typeof o!="function"&&typeof o!="symbol"&&typeof o!="boolean"?e.name=""+oi(o):e.removeAttribute("name")}function py(e,t,n,i,s,a,r,o){if(a!=null&&typeof a!="function"&&typeof a!="symbol"&&typeof a!="boolean"&&(e.type=a),t!=null||n!=null){if(!(a!=="submit"&&a!=="reset"||t!=null)){wp(e);return}n=n!=null?""+oi(n):"",t=t!=null?""+oi(t):n,o||t===e.value||(e.value=t),e.defaultValue=t}i=i??s,i=typeof i!="function"&&typeof i!="symbol"&&!!i,e.checked=o?e.checked:!!i,e.defaultChecked=!!i,r!=null&&typeof r!="function"&&typeof r!="symbol"&&typeof r!="boolean"&&(e.name=r),wp(e)}function Rp(e,t,n){t==="number"&&vu(e.ownerDocument)===e||e.defaultValue===""+n||(e.defaultValue=""+n)}function Nr(e,t,n,i){if(e=e.options,t){t={};for(var s=0;s<n.length;s++)t["$"+n[s]]=!0;for(n=0;n<e.length;n++)s=t.hasOwnProperty("$"+e[n].value),e[n].selected!==s&&(e[n].selected=s),s&&i&&(e[n].defaultSelected=!0)}else{for(n=""+oi(n),t=null,s=0;s<e.length;s++){if(e[s].value===n){e[s].selected=!0,i&&(e[s].defaultSelected=!0);return}t!==null||e[s].disabled||(t=e[s])}t!==null&&(t.selected=!0)}}function my(e,t,n){if(t!=null&&(t=""+oi(t),t!==e.value&&(e.value=t),n==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=n!=null?""+oi(n):""}function gy(e,t,n,i){if(t==null){if(i!=null){if(n!=null)throw Error(st(92));if(Ho(i)){if(1<i.length)throw Error(st(93));i=i[0]}n=i}n==null&&(n=""),t=n}n=oi(t),e.defaultValue=n,i=e.textContent,i===n&&i!==""&&i!==null&&(e.value=i),wp(e)}function Fr(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&n.nodeType===3){n.nodeValue=t;return}}e.textContent=t}var O1=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function Uv(e,t,n){var i=t.indexOf("--")===0;n==null||typeof n=="boolean"||n===""?i?e.setProperty(t,""):t==="float"?e.cssFloat="":e[t]="":i?e.setProperty(t,n):typeof n!="number"||n===0||O1.has(t)?t==="float"?e.cssFloat=n:e[t]=(""+n).trim():e[t]=n+"px"}function vy(e,t,n){if(t!=null&&typeof t!="object")throw Error(st(62));if(e=e.style,n!=null){for(var i in n)!n.hasOwnProperty(i)||t!=null&&t.hasOwnProperty(i)||(i.indexOf("--")===0?e.setProperty(i,""):i==="float"?e.cssFloat="":e[i]="");for(var s in t)i=t[s],t.hasOwnProperty(s)&&n[s]!==i&&Uv(e,s,i)}else for(var a in t)t.hasOwnProperty(a)&&Uv(e,a,t[a])}function ym(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var P1=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),z1=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function $c(e){return z1.test(""+e)?"javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')":e}function os(){}var Dp=null;function xm(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var br=null,Ur=null;function Lv(e){var t=Jr(e);if(t&&(e=t.stateNode)){var n=e[In]||null;t:switch(e=t.stateNode,t.type){case"input":if(Cp(e,n.value,n.defaultValue,n.defaultValue,n.checked,n.defaultChecked,n.type,n.name),t=n.name,n.type==="radio"&&t!=null){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll('input[name="'+ui(""+t)+'"][type="radio"]'),t=0;t<n.length;t++){var i=n[t];if(i!==e&&i.form===e.form){var s=i[In]||null;if(!s)throw Error(st(90));Cp(i,s.value,s.defaultValue,s.defaultValue,s.checked,s.defaultChecked,s.type,s.name)}}for(t=0;t<n.length;t++)i=n[t],i.form===e.form&&dy(i)}break t;case"textarea":my(e,n.value,n.defaultValue);break t;case"select":t=n.value,t!=null&&Nr(e,!!n.multiple,t,!1)}}}var Xd=!1;function _y(e,t,n){if(Xd)return e(t,n);Xd=!0;try{var i=e(t);return i}finally{if(Xd=!1,(br!==null||Ur!==null)&&(th(),br&&(t=br,e=Ur,Ur=br=null,Lv(t),e)))for(t=0;t<e.length;t++)Lv(e[t])}}function al(e,t){var n=e.stateNode;if(n===null)return null;var i=n[In]||null;if(i===null)return null;n=i[t];t:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(e=e.type,i=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!i;break t;default:e=!1}if(e)return null;if(n&&typeof n!="function")throw Error(st(231,t,typeof n));return n}var fs=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Np=!1;if(fs)try{dr={},Object.defineProperty(dr,"passive",{get:function(){Np=!0}}),window.addEventListener("test",dr,dr),window.removeEventListener("test",dr,dr)}catch{Np=!1}var dr,Vs=null,bm=null,tu=null;function yy(){if(tu)return tu;var e,t=bm,n=t.length,i,s="value"in Vs?Vs.value:Vs.textContent,a=s.length;for(e=0;e<n&&t[e]===s[e];e++);var r=n-e;for(i=1;i<=r&&t[n-i]===s[a-i];i++);return tu=s.slice(e,1<i?1-i:void 0)}function eu(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Fc(){return!0}function Iv(){return!1}function On(e){function t(n,i,s,a,r){this._reactName=n,this._targetInst=s,this.type=i,this.nativeEvent=a,this.target=r,this.currentTarget=null;for(var o in e)e.hasOwnProperty(o)&&(n=e[o],this[o]=n?n(a):a[o]);return this.isDefaultPrevented=(a.defaultPrevented!=null?a.defaultPrevented:a.returnValue===!1)?Fc:Iv,this.isPropagationStopped=Iv,this}return Re(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var n=this.nativeEvent;n&&(n.preventDefault?n.preventDefault():typeof n.returnValue!="unknown"&&(n.returnValue=!1),this.isDefaultPrevented=Fc)},stopPropagation:function(){var n=this.nativeEvent;n&&(n.stopPropagation?n.stopPropagation():typeof n.cancelBubble!="unknown"&&(n.cancelBubble=!0),this.isPropagationStopped=Fc)},persist:function(){},isPersistent:Fc}),t}var Ga={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},ku=On(Ga),Ml=Re({},Ga,{view:0,detail:0}),B1=On(Ml),Wd,qd,Io,Xu=Re({},Ml,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Sm,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==Io&&(Io&&e.type==="mousemove"?(Wd=e.screenX-Io.screenX,qd=e.screenY-Io.screenY):qd=Wd=0,Io=e),Wd)},movementY:function(e){return"movementY"in e?e.movementY:qd}}),Ov=On(Xu),F1=Re({},Xu,{dataTransfer:0}),V1=On(F1),H1=Re({},Ml,{relatedTarget:0}),Yd=On(H1),G1=Re({},Ga,{animationName:0,elapsedTime:0,pseudoElement:0}),k1=On(G1),X1=Re({},Ga,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),W1=On(X1),q1=Re({},Ga,{data:0}),Pv=On(q1),Y1={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Z1={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},J1={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function K1(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=J1[e])?!!t[e]:!1}function Sm(){return K1}var j1=Re({},Ml,{key:function(e){if(e.key){var t=Y1[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=eu(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?Z1[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Sm,charCode:function(e){return e.type==="keypress"?eu(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?eu(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),Q1=On(j1),$1=Re({},Xu,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),zv=On($1),tE=Re({},Ml,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Sm}),eE=On(tE),nE=Re({},Ga,{propertyName:0,elapsedTime:0,pseudoElement:0}),iE=On(nE),sE=Re({},Xu,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),aE=On(sE),rE=Re({},Ga,{newState:0,oldState:0}),oE=On(rE),lE=[9,13,27,32],Mm=fs&&"CompositionEvent"in window,Wo=null;fs&&"documentMode"in document&&(Wo=document.documentMode);var cE=fs&&"TextEvent"in window&&!Wo,xy=fs&&(!Mm||Wo&&8<Wo&&11>=Wo),Bv=" ",Fv=!1;function by(e,t){switch(e){case"keyup":return lE.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function Sy(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var Sr=!1;function uE(e,t){switch(e){case"compositionend":return Sy(t);case"keypress":return t.which!==32?null:(Fv=!0,Bv);case"textInput":return e=t.data,e===Bv&&Fv?null:e;default:return null}}function hE(e,t){if(Sr)return e==="compositionend"||!Mm&&by(e,t)?(e=yy(),tu=bm=Vs=null,Sr=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return xy&&t.locale!=="ko"?null:t.data;default:return null}}var fE={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function Vv(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!fE[e.type]:t==="textarea"}function My(e,t,n,i){br?Ur?Ur.push(i):Ur=[i]:br=i,t=Ou(t,"onChange"),0<t.length&&(n=new ku("onChange","change",null,n,i),e.push({event:n,listeners:t}))}var qo=null,rl=null;function dE(e){_b(e,0)}function Wu(e){var t=Go(e);if(dy(t))return e}function Hv(e,t){if(e==="change")return t}var Ey=!1;fs&&(fs?(Hc="oninput"in document,Hc||(Zd=document.createElement("div"),Zd.setAttribute("oninput","return;"),Hc=typeof Zd.oninput=="function"),Vc=Hc):Vc=!1,Ey=Vc&&(!document.documentMode||9<document.documentMode));var Vc,Hc,Zd;function Gv(){qo&&(qo.detachEvent("onpropertychange",Ty),rl=qo=null)}function Ty(e){if(e.propertyName==="value"&&Wu(rl)){var t=[];My(t,rl,e,xm(e)),_y(dE,t)}}function pE(e,t,n){e==="focusin"?(Gv(),qo=t,rl=n,qo.attachEvent("onpropertychange",Ty)):e==="focusout"&&Gv()}function mE(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return Wu(rl)}function gE(e,t){if(e==="click")return Wu(t)}function vE(e,t){if(e==="input"||e==="change")return Wu(t)}function _E(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Yn=typeof Object.is=="function"?Object.is:_E;function ol(e,t){if(Yn(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var n=Object.keys(e),i=Object.keys(t);if(n.length!==i.length)return!1;for(i=0;i<n.length;i++){var s=n[i];if(!Tp.call(t,s)||!Yn(e[s],t[s]))return!1}return!0}function kv(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function Xv(e,t){var n=kv(e);e=0;for(var i;n;){if(n.nodeType===3){if(i=e+n.textContent.length,e<=t&&i>=t)return{node:n,offset:t-e};e=i}t:{for(;n;){if(n.nextSibling){n=n.nextSibling;break t}n=n.parentNode}n=void 0}n=kv(n)}}function Ay(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?Ay(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function wy(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=vu(e.document);t instanceof e.HTMLIFrameElement;){try{var n=typeof t.contentWindow.location.href=="string"}catch{n=!1}if(n)e=t.contentWindow;else break;t=vu(e.document)}return t}function Em(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}var yE=fs&&"documentMode"in document&&11>=document.documentMode,Mr=null,Up=null,Yo=null,Lp=!1;function Wv(e,t,n){var i=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;Lp||Mr==null||Mr!==vu(i)||(i=Mr,"selectionStart"in i&&Em(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),Yo&&ol(Yo,i)||(Yo=i,i=Ou(Up,"onSelect"),0<i.length&&(t=new ku("onSelect","select",null,t,n),e.push({event:t,listeners:i}),t.target=Mr)))}function Aa(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n["Webkit"+e]="webkit"+t,n["Moz"+e]="moz"+t,n}var Er={animationend:Aa("Animation","AnimationEnd"),animationiteration:Aa("Animation","AnimationIteration"),animationstart:Aa("Animation","AnimationStart"),transitionrun:Aa("Transition","TransitionRun"),transitionstart:Aa("Transition","TransitionStart"),transitioncancel:Aa("Transition","TransitionCancel"),transitionend:Aa("Transition","TransitionEnd")},Jd={},Cy={};fs&&(Cy=document.createElement("div").style,"AnimationEvent"in window||(delete Er.animationend.animation,delete Er.animationiteration.animation,delete Er.animationstart.animation),"TransitionEvent"in window||delete Er.transitionend.transition);function ka(e){if(Jd[e])return Jd[e];if(!Er[e])return e;var t=Er[e],n;for(n in t)if(t.hasOwnProperty(n)&&n in Cy)return Jd[e]=t[n];return e}var Ry=ka("animationend"),Dy=ka("animationiteration"),Ny=ka("animationstart"),xE=ka("transitionrun"),bE=ka("transitionstart"),SE=ka("transitioncancel"),Uy=ka("transitionend"),Ly=new Map,Ip="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");Ip.push("scrollEnd");function Si(e,t){Ly.set(e,t),Ha(t,[e])}var _u=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},ri=[],Tr=0,Tm=0;function qu(){for(var e=Tr,t=Tm=Tr=0;t<e;){var n=ri[t];ri[t++]=null;var i=ri[t];ri[t++]=null;var s=ri[t];ri[t++]=null;var a=ri[t];if(ri[t++]=null,i!==null&&s!==null){var r=i.pending;r===null?s.next=s:(s.next=r.next,r.next=s),i.pending=s}a!==0&&Iy(n,s,a)}}function Yu(e,t,n,i){ri[Tr++]=e,ri[Tr++]=t,ri[Tr++]=n,ri[Tr++]=i,Tm|=i,e.lanes|=i,e=e.alternate,e!==null&&(e.lanes|=i)}function Am(e,t,n,i){return Yu(e,t,n,i),yu(e)}function Xa(e,t){return Yu(e,null,null,t),yu(e)}function Iy(e,t,n){e.lanes|=n;var i=e.alternate;i!==null&&(i.lanes|=n);for(var s=!1,a=e.return;a!==null;)a.childLanes|=n,i=a.alternate,i!==null&&(i.childLanes|=n),a.tag===22&&(e=a.stateNode,e===null||e._visibility&1||(s=!0)),e=a,a=a.return;return e.tag===3?(a=e.stateNode,s&&t!==null&&(s=31-Wn(n),e=a.hiddenUpdates,i=e[s],i===null?e[s]=[t]:i.push(t),t.lane=n|536870912),a):null}function yu(e){if(50<nl)throw nl=0,em=null,Error(st(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var Ar={};function ME(e,t,n,i){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Hn(e,t,n,i){return new ME(e,t,n,i)}function wm(e){return e=e.prototype,!(!e||!e.isReactComponent)}function cs(e,t){var n=e.alternate;return n===null?(n=Hn(e.tag,t,e.key,e.mode),n.elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=e.flags&65011712,n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n.refCleanup=e.refCleanup,n}function Oy(e,t){e.flags&=65011714;var n=e.alternate;return n===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=n.childLanes,e.lanes=n.lanes,e.child=n.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=n.memoizedProps,e.memoizedState=n.memoizedState,e.updateQueue=n.updateQueue,e.type=n.type,t=n.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function nu(e,t,n,i,s,a){var r=0;if(i=e,typeof e=="function")wm(e)&&(r=1);else if(typeof e=="string")r=AT(e,n,Pi.current)?26:e==="html"||e==="head"||e==="body"?27:5;else t:switch(e){case bp:return e=Hn(31,n,t,s),e.elementType=bp,e.lanes=a,e;case _r:return Ua(n.children,s,a,t);case ty:r=8,s|=24;break;case _p:return e=Hn(12,n,t,s|2),e.elementType=_p,e.lanes=a,e;case yp:return e=Hn(13,n,t,s),e.elementType=yp,e.lanes=a,e;case xp:return e=Hn(19,n,t,s),e.elementType=xp,e.lanes=a,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case rs:r=10;break t;case ey:r=9;break t;case dm:r=11;break t;case pm:r=14;break t;case Ls:r=16,i=null;break t}r=29,n=Error(st(130,e===null?"null":typeof e,"")),i=null}return t=Hn(r,n,t,s),t.elementType=e,t.type=i,t.lanes=a,t}function Ua(e,t,n,i){return e=Hn(7,e,i,t),e.lanes=n,e}function Kd(e,t,n){return e=Hn(6,e,null,t),e.lanes=n,e}function Py(e){var t=Hn(18,null,null,0);return t.stateNode=e,t}function jd(e,t,n){return t=Hn(4,e.children!==null?e.children:[],e.key,t),t.lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var qv=new WeakMap;function hi(e,t){if(typeof e=="object"&&e!==null){var n=qv.get(e);return n!==void 0?n:(t={value:e,source:t,stack:wv(t)},qv.set(e,t),t)}return{value:e,source:t,stack:wv(t)}}var wr=[],Cr=0,xu=null,ll=0,li=[],ci=0,$s=null,Li=1,Ii="";function ss(e,t){wr[Cr++]=ll,wr[Cr++]=xu,xu=e,ll=t}function zy(e,t,n){li[ci++]=Li,li[ci++]=Ii,li[ci++]=$s,$s=e;var i=Li;e=Ii;var s=32-Wn(i)-1;i&=~(1<<s),n+=1;var a=32-Wn(t)+s;if(30<a){var r=s-s%5;a=(i&(1<<r)-1).toString(32),i>>=r,s-=r,Li=1<<32-Wn(t)+s|n<<s|i,Ii=a+e}else Li=1<<a|n<<s|i,Ii=e}function Cm(e){e.return!==null&&(ss(e,1),zy(e,1,0))}function Rm(e){for(;e===xu;)xu=wr[--Cr],wr[Cr]=null,ll=wr[--Cr],wr[Cr]=null;for(;e===$s;)$s=li[--ci],li[ci]=null,Ii=li[--ci],li[ci]=null,Li=li[--ci],li[ci]=null}function By(e,t){li[ci++]=Li,li[ci++]=Ii,li[ci++]=$s,Li=t.id,Ii=t.overflow,$s=e}var fn=null,Ce=null,re=!1,Ws=null,fi=!1,Op=Error(st(519));function ta(e){var t=Error(st(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw cl(hi(t,e)),Op}function Yv(e){var t=e.stateNode,n=e.type,i=e.memoizedProps;switch(t[hn]=e,t[In]=i,n){case"dialog":jt("cancel",t),jt("close",t);break;case"iframe":case"object":case"embed":jt("load",t);break;case"video":case"audio":for(n=0;n<dl.length;n++)jt(dl[n],t);break;case"source":jt("error",t);break;case"img":case"image":case"link":jt("error",t),jt("load",t);break;case"details":jt("toggle",t);break;case"input":jt("invalid",t),py(t,i.value,i.defaultValue,i.checked,i.defaultChecked,i.type,i.name,!0);break;case"select":jt("invalid",t);break;case"textarea":jt("invalid",t),gy(t,i.value,i.defaultValue,i.children)}n=i.children,typeof n!="string"&&typeof n!="number"&&typeof n!="bigint"||t.textContent===""+n||i.suppressHydrationWarning===!0||xb(t.textContent,n)?(i.popover!=null&&(jt("beforetoggle",t),jt("toggle",t)),i.onScroll!=null&&jt("scroll",t),i.onScrollEnd!=null&&jt("scrollend",t),i.onClick!=null&&(t.onclick=os),t=!0):t=!1,t||ta(e,!0)}function Zv(e){for(fn=e.return;fn;)switch(fn.tag){case 5:case 31:case 13:fi=!1;return;case 27:case 3:fi=!0;return;default:fn=fn.return}}function pr(e){if(e!==fn)return!1;if(!re)return Zv(e),re=!0,!1;var t=e.tag,n;if((n=t!==3&&t!==27)&&((n=t===5)&&(n=e.type,n=!(n!=="form"&&n!=="button")||rm(e.type,e.memoizedProps)),n=!n),n&&Ce&&ta(e),Zv(e),t===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(st(317));Ce=P_(e)}else if(t===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(st(317));Ce=P_(e)}else t===27?(t=Ce,sa(e.type)?(e=um,um=null,Ce=e):Ce=t):Ce=fn?pi(e.stateNode.nextSibling):null;return!0}function Pa(){Ce=fn=null,re=!1}function Qd(){var e=Ws;return e!==null&&(Un===null?Un=e:Un.push.apply(Un,e),Ws=null),e}function cl(e){Ws===null?Ws=[e]:Ws.push(e)}var Pp=zi(null),Wa=null,ls=null;function Os(e,t,n){Ee(Pp,t._currentValue),t._currentValue=n}function us(e){e._currentValue=Pp.current,on(Pp)}function zp(e,t,n){for(;e!==null;){var i=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,i!==null&&(i.childLanes|=t)):i!==null&&(i.childLanes&t)!==t&&(i.childLanes|=t),e===n)break;e=e.return}}function Bp(e,t,n,i){var s=e.child;for(s!==null&&(s.return=e);s!==null;){var a=s.dependencies;if(a!==null){var r=s.child;a=a.firstContext;t:for(;a!==null;){var o=a;a=s;for(var c=0;c<t.length;c++)if(o.context===t[c]){a.lanes|=n,o=a.alternate,o!==null&&(o.lanes|=n),zp(a.return,n,e),i||(r=null);break t}a=o.next}}else if(s.tag===18){if(r=s.return,r===null)throw Error(st(341));r.lanes|=n,a=r.alternate,a!==null&&(a.lanes|=n),zp(r,n,e),r=null}else r=s.child;if(r!==null)r.return=s;else for(r=s;r!==null;){if(r===e){r=null;break}if(s=r.sibling,s!==null){s.return=r.return,r=s;break}r=r.return}s=r}}function Kr(e,t,n,i){e=null;for(var s=t,a=!1;s!==null;){if(!a){if((s.flags&524288)!==0)a=!0;else if((s.flags&262144)!==0)break}if(s.tag===10){var r=s.alternate;if(r===null)throw Error(st(387));if(r=r.memoizedProps,r!==null){var o=s.type;Yn(s.pendingProps.value,r.value)||(e!==null?e.push(o):e=[o])}}else if(s===du.current){if(r=s.alternate,r===null)throw Error(st(387));r.memoizedState.memoizedState!==s.memoizedState.memoizedState&&(e!==null?e.push(ml):e=[ml])}s=s.return}e!==null&&Bp(t,e,n,i),t.flags|=262144}function bu(e){for(e=e.firstContext;e!==null;){if(!Yn(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function za(e){Wa=e,ls=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function dn(e){return Fy(Wa,e)}function Gc(e,t){return Wa===null&&za(e),Fy(e,t)}function Fy(e,t){var n=t._currentValue;if(t={context:t,memoizedValue:n,next:null},ls===null){if(e===null)throw Error(st(308));ls=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else ls=ls.next=t;return n}var EE=typeof AbortController<"u"?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(n,i){e.push(i)}};this.abort=function(){t.aborted=!0,e.forEach(function(n){return n()})}},TE=$e.unstable_scheduleCallback,AE=$e.unstable_NormalPriority,Ze={$$typeof:rs,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function Dm(){return{controller:new EE,data:new Map,refCount:0}}function El(e){e.refCount--,e.refCount===0&&TE(AE,function(){e.controller.abort()})}var Zo=null,Fp=0,Vr=0,Lr=null;function wE(e,t){if(Zo===null){var n=Zo=[];Fp=0,Vr=eg(),Lr={status:"pending",value:void 0,then:function(i){n.push(i)}}}return Fp++,t.then(Jv,Jv),t}function Jv(){if(--Fp===0&&Zo!==null){Lr!==null&&(Lr.status="fulfilled");var e=Zo;Zo=null,Vr=0,Lr=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function CE(e,t){var n=[],i={status:"pending",value:null,reason:null,then:function(s){n.push(s)}};return e.then(function(){i.status="fulfilled",i.value=t;for(var s=0;s<n.length;s++)(0,n[s])(t)},function(s){for(i.status="rejected",i.reason=s,s=0;s<n.length;s++)(0,n[s])(void 0)}),i}var Kv=Bt.S;Bt.S=function(e,t){$x=kn(),typeof t=="object"&&t!==null&&typeof t.then=="function"&&wE(e,t),Kv!==null&&Kv(e,t)};var La=zi(null);function Nm(){var e=La.current;return e!==null?e:Se.pooledCache}function iu(e,t){t===null?Ee(La,La.current):Ee(La,t.pool)}function Vy(){var e=Nm();return e===null?null:{parent:Ze._currentValue,pool:e}}var jr=Error(st(460)),Um=Error(st(474)),Zu=Error(st(542)),Su={then:function(){}};function jv(e){return e=e.status,e==="fulfilled"||e==="rejected"}function Hy(e,t,n){switch(n=e[n],n===void 0?e.push(t):n!==t&&(t.then(os,os),t=n),t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,$v(e),e;default:if(typeof t.status=="string")t.then(os,os);else{if(e=Se,e!==null&&100<e.shellSuspendCounter)throw Error(st(482));e=t,e.status="pending",e.then(function(i){if(t.status==="pending"){var s=t;s.status="fulfilled",s.value=i}},function(i){if(t.status==="pending"){var s=t;s.status="rejected",s.reason=i}})}switch(t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,$v(e),e}throw Ia=t,jr}}function Ra(e){try{var t=e._init;return t(e._payload)}catch(n){throw n!==null&&typeof n=="object"&&typeof n.then=="function"?(Ia=n,jr):n}}var Ia=null;function Qv(){if(Ia===null)throw Error(st(459));var e=Ia;return Ia=null,e}function $v(e){if(e===jr||e===Zu)throw Error(st(483))}var Ir=null,ul=0;function kc(e){var t=ul;return ul+=1,Ir===null&&(Ir=[]),Hy(Ir,e,t)}function Oo(e,t){t=t.props.ref,e.ref=t!==void 0?t:null}function Xc(e,t){throw t.$$typeof===p1?Error(st(525)):(e=Object.prototype.toString.call(t),Error(st(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)))}function Gy(e){function t(f,g){if(e){var y=f.deletions;y===null?(f.deletions=[g],f.flags|=16):y.push(g)}}function n(f,g){if(!e)return null;for(;g!==null;)t(f,g),g=g.sibling;return null}function i(f){for(var g=new Map;f!==null;)f.key!==null?g.set(f.key,f):g.set(f.index,f),f=f.sibling;return g}function s(f,g){return f=cs(f,g),f.index=0,f.sibling=null,f}function a(f,g,y){return f.index=y,e?(y=f.alternate,y!==null?(y=y.index,y<g?(f.flags|=67108866,g):y):(f.flags|=67108866,g)):(f.flags|=1048576,g)}function r(f){return e&&f.alternate===null&&(f.flags|=67108866),f}function o(f,g,y,_){return g===null||g.tag!==6?(g=Kd(y,f.mode,_),g.return=f,g):(g=s(g,y),g.return=f,g)}function c(f,g,y,_){var T=y.type;return T===_r?h(f,g,y.props.children,_,y.key):g!==null&&(g.elementType===T||typeof T=="object"&&T!==null&&T.$$typeof===Ls&&Ra(T)===g.type)?(g=s(g,y.props),Oo(g,y),g.return=f,g):(g=nu(y.type,y.key,y.props,null,f.mode,_),Oo(g,y),g.return=f,g)}function l(f,g,y,_){return g===null||g.tag!==4||g.stateNode.containerInfo!==y.containerInfo||g.stateNode.implementation!==y.implementation?(g=jd(y,f.mode,_),g.return=f,g):(g=s(g,y.children||[]),g.return=f,g)}function h(f,g,y,_,T){return g===null||g.tag!==7?(g=Ua(y,f.mode,_,T),g.return=f,g):(g=s(g,y),g.return=f,g)}function d(f,g,y){if(typeof g=="string"&&g!==""||typeof g=="number"||typeof g=="bigint")return g=Kd(""+g,f.mode,y),g.return=f,g;if(typeof g=="object"&&g!==null){switch(g.$$typeof){case Ic:return y=nu(g.type,g.key,g.props,null,f.mode,y),Oo(y,g),y.return=f,y;case Vo:return g=jd(g,f.mode,y),g.return=f,g;case Ls:return g=Ra(g),d(f,g,y)}if(Ho(g)||Lo(g))return g=Ua(g,f.mode,y,null),g.return=f,g;if(typeof g.then=="function")return d(f,kc(g),y);if(g.$$typeof===rs)return d(f,Gc(f,g),y);Xc(f,g)}return null}function u(f,g,y,_){var T=g!==null?g.key:null;if(typeof y=="string"&&y!==""||typeof y=="number"||typeof y=="bigint")return T!==null?null:o(f,g,""+y,_);if(typeof y=="object"&&y!==null){switch(y.$$typeof){case Ic:return y.key===T?c(f,g,y,_):null;case Vo:return y.key===T?l(f,g,y,_):null;case Ls:return y=Ra(y),u(f,g,y,_)}if(Ho(y)||Lo(y))return T!==null?null:h(f,g,y,_,null);if(typeof y.then=="function")return u(f,g,kc(y),_);if(y.$$typeof===rs)return u(f,g,Gc(f,y),_);Xc(f,y)}return null}function p(f,g,y,_,T){if(typeof _=="string"&&_!==""||typeof _=="number"||typeof _=="bigint")return f=f.get(y)||null,o(g,f,""+_,T);if(typeof _=="object"&&_!==null){switch(_.$$typeof){case Ic:return f=f.get(_.key===null?y:_.key)||null,c(g,f,_,T);case Vo:return f=f.get(_.key===null?y:_.key)||null,l(g,f,_,T);case Ls:return _=Ra(_),p(f,g,y,_,T)}if(Ho(_)||Lo(_))return f=f.get(y)||null,h(g,f,_,T,null);if(typeof _.then=="function")return p(f,g,y,kc(_),T);if(_.$$typeof===rs)return p(f,g,y,Gc(g,_),T);Xc(g,_)}return null}function m(f,g,y,_){for(var T=null,A=null,w=g,x=g=0,M=null;w!==null&&x<y.length;x++){w.index>x?(M=w,w=null):M=w.sibling;var R=u(f,w,y[x],_);if(R===null){w===null&&(w=M);break}e&&w&&R.alternate===null&&t(f,w),g=a(R,g,x),A===null?T=R:A.sibling=R,A=R,w=M}if(x===y.length)return n(f,w),re&&ss(f,x),T;if(w===null){for(;x<y.length;x++)w=d(f,y[x],_),w!==null&&(g=a(w,g,x),A===null?T=w:A.sibling=w,A=w);return re&&ss(f,x),T}for(w=i(w);x<y.length;x++)M=p(w,f,x,y[x],_),M!==null&&(e&&M.alternate!==null&&w.delete(M.key===null?x:M.key),g=a(M,g,x),A===null?T=M:A.sibling=M,A=M);return e&&w.forEach(function(D){return t(f,D)}),re&&ss(f,x),T}function S(f,g,y,_){if(y==null)throw Error(st(151));for(var T=null,A=null,w=g,x=g=0,M=null,R=y.next();w!==null&&!R.done;x++,R=y.next()){w.index>x?(M=w,w=null):M=w.sibling;var D=u(f,w,R.value,_);if(D===null){w===null&&(w=M);break}e&&w&&D.alternate===null&&t(f,w),g=a(D,g,x),A===null?T=D:A.sibling=D,A=D,w=M}if(R.done)return n(f,w),re&&ss(f,x),T;if(w===null){for(;!R.done;x++,R=y.next())R=d(f,R.value,_),R!==null&&(g=a(R,g,x),A===null?T=R:A.sibling=R,A=R);return re&&ss(f,x),T}for(w=i(w);!R.done;x++,R=y.next())R=p(w,f,x,R.value,_),R!==null&&(e&&R.alternate!==null&&w.delete(R.key===null?x:R.key),g=a(R,g,x),A===null?T=R:A.sibling=R,A=R);return e&&w.forEach(function(I){return t(f,I)}),re&&ss(f,x),T}function v(f,g,y,_){if(typeof y=="object"&&y!==null&&y.type===_r&&y.key===null&&(y=y.props.children),typeof y=="object"&&y!==null){switch(y.$$typeof){case Ic:t:{for(var T=y.key;g!==null;){if(g.key===T){if(T=y.type,T===_r){if(g.tag===7){n(f,g.sibling),_=s(g,y.props.children),_.return=f,f=_;break t}}else if(g.elementType===T||typeof T=="object"&&T!==null&&T.$$typeof===Ls&&Ra(T)===g.type){n(f,g.sibling),_=s(g,y.props),Oo(_,y),_.return=f,f=_;break t}n(f,g);break}else t(f,g);g=g.sibling}y.type===_r?(_=Ua(y.props.children,f.mode,_,y.key),_.return=f,f=_):(_=nu(y.type,y.key,y.props,null,f.mode,_),Oo(_,y),_.return=f,f=_)}return r(f);case Vo:t:{for(T=y.key;g!==null;){if(g.key===T)if(g.tag===4&&g.stateNode.containerInfo===y.containerInfo&&g.stateNode.implementation===y.implementation){n(f,g.sibling),_=s(g,y.children||[]),_.return=f,f=_;break t}else{n(f,g);break}else t(f,g);g=g.sibling}_=jd(y,f.mode,_),_.return=f,f=_}return r(f);case Ls:return y=Ra(y),v(f,g,y,_)}if(Ho(y))return m(f,g,y,_);if(Lo(y)){if(T=Lo(y),typeof T!="function")throw Error(st(150));return y=T.call(y),S(f,g,y,_)}if(typeof y.then=="function")return v(f,g,kc(y),_);if(y.$$typeof===rs)return v(f,g,Gc(f,y),_);Xc(f,y)}return typeof y=="string"&&y!==""||typeof y=="number"||typeof y=="bigint"?(y=""+y,g!==null&&g.tag===6?(n(f,g.sibling),_=s(g,y),_.return=f,f=_):(n(f,g),_=Kd(y,f.mode,_),_.return=f,f=_),r(f)):n(f,g)}return function(f,g,y,_){try{ul=0;var T=v(f,g,y,_);return Ir=null,T}catch(w){if(w===jr||w===Zu)throw w;var A=Hn(29,w,null,f.mode);return A.lanes=_,A.return=f,A}finally{}}}var Ba=Gy(!0),ky=Gy(!1),Is=!1;function Lm(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function Vp(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function qs(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function Ys(e,t,n){var i=e.updateQueue;if(i===null)return null;if(i=i.shared,(ue&2)!==0){var s=i.pending;return s===null?t.next=t:(t.next=s.next,s.next=t),i.pending=t,t=yu(e),Iy(e,null,n),t}return Yu(e,i,t,n),yu(e)}function Jo(e,t,n){if(t=t.updateQueue,t!==null&&(t=t.shared,(n&4194048)!==0)){var i=t.lanes;i&=e.pendingLanes,n|=i,t.lanes=n,oy(e,n)}}function $d(e,t){var n=e.updateQueue,i=e.alternate;if(i!==null&&(i=i.updateQueue,n===i)){var s=null,a=null;if(n=n.firstBaseUpdate,n!==null){do{var r={lane:n.lane,tag:n.tag,payload:n.payload,callback:null,next:null};a===null?s=a=r:a=a.next=r,n=n.next}while(n!==null);a===null?s=a=t:a=a.next=t}else s=a=t;n={baseState:i.baseState,firstBaseUpdate:s,lastBaseUpdate:a,shared:i.shared,callbacks:i.callbacks},e.updateQueue=n;return}e=n.lastBaseUpdate,e===null?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}var Hp=!1;function Ko(){if(Hp){var e=Lr;if(e!==null)throw e}}function jo(e,t,n,i){Hp=!1;var s=e.updateQueue;Is=!1;var a=s.firstBaseUpdate,r=s.lastBaseUpdate,o=s.shared.pending;if(o!==null){s.shared.pending=null;var c=o,l=c.next;c.next=null,r===null?a=l:r.next=l,r=c;var h=e.alternate;h!==null&&(h=h.updateQueue,o=h.lastBaseUpdate,o!==r&&(o===null?h.firstBaseUpdate=l:o.next=l,h.lastBaseUpdate=c))}if(a!==null){var d=s.baseState;r=0,h=l=c=null,o=a;do{var u=o.lane&-536870913,p=u!==o.lane;if(p?(ee&u)===u:(i&u)===u){u!==0&&u===Vr&&(Hp=!0),h!==null&&(h=h.next={lane:0,tag:o.tag,payload:o.payload,callback:null,next:null});t:{var m=e,S=o;u=t;var v=n;switch(S.tag){case 1:if(m=S.payload,typeof m=="function"){d=m.call(v,d,u);break t}d=m;break t;case 3:m.flags=m.flags&-65537|128;case 0:if(m=S.payload,u=typeof m=="function"?m.call(v,d,u):m,u==null)break t;d=Re({},d,u);break t;case 2:Is=!0}}u=o.callback,u!==null&&(e.flags|=64,p&&(e.flags|=8192),p=s.callbacks,p===null?s.callbacks=[u]:p.push(u))}else p={lane:u,tag:o.tag,payload:o.payload,callback:o.callback,next:null},h===null?(l=h=p,c=d):h=h.next=p,r|=u;if(o=o.next,o===null){if(o=s.shared.pending,o===null)break;p=o,o=p.next,p.next=null,s.lastBaseUpdate=p,s.shared.pending=null}}while(!0);h===null&&(c=d),s.baseState=c,s.firstBaseUpdate=l,s.lastBaseUpdate=h,a===null&&(s.shared.lanes=0),na|=r,e.lanes=r,e.memoizedState=d}}function Xy(e,t){if(typeof e!="function")throw Error(st(191,e));e.call(t)}function Wy(e,t){var n=e.callbacks;if(n!==null)for(e.callbacks=null,e=0;e<n.length;e++)Xy(n[e],t)}var Hr=zi(null),Mu=zi(0);function t_(e,t){e=gs,Ee(Mu,e),Ee(Hr,t),gs=e|t.baseLanes}function Gp(){Ee(Mu,gs),Ee(Hr,Hr.current)}function Im(){gs=Mu.current,on(Hr),on(Mu)}var Zn=zi(null),di=null;function Ps(e){var t=e.alternate;Ee(ke,ke.current&1),Ee(Zn,e),di===null&&(t===null||Hr.current!==null||t.memoizedState!==null)&&(di=e)}function kp(e){Ee(ke,ke.current),Ee(Zn,e),di===null&&(di=e)}function qy(e){e.tag===22?(Ee(ke,ke.current),Ee(Zn,e),di===null&&(di=e)):zs(e)}function zs(){Ee(ke,ke.current),Ee(Zn,Zn.current)}function Vn(e){on(Zn),di===e&&(di=null),on(ke)}var ke=zi(0);function Eu(e){for(var t=e;t!==null;){if(t.tag===13){var n=t.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||lm(n)||cm(n)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder==="forwards"||t.memoizedProps.revealOrder==="backwards"||t.memoizedProps.revealOrder==="unstable_legacy-backwards"||t.memoizedProps.revealOrder==="together")){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var ds=0,Yt=null,ye=null,qe=null,Tu=!1,Or=!1,Fa=!1,Au=0,hl=0,Pr=null,RE=0;function Be(){throw Error(st(321))}function Om(e,t){if(t===null)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!Yn(e[n],t[n]))return!1;return!0}function Pm(e,t,n,i,s,a){return ds=a,Yt=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,Bt.H=e===null||e.memoizedState===null?Mx:Ym,Fa=!1,a=n(i,s),Fa=!1,Or&&(a=Zy(t,n,i,s)),Yy(e),a}function Yy(e){Bt.H=fl;var t=ye!==null&&ye.next!==null;if(ds=0,qe=ye=Yt=null,Tu=!1,hl=0,Pr=null,t)throw Error(st(300));e===null||Je||(e=e.dependencies,e!==null&&bu(e)&&(Je=!0))}function Zy(e,t,n,i){Yt=e;var s=0;do{if(Or&&(Pr=null),hl=0,Or=!1,25<=s)throw Error(st(301));if(s+=1,qe=ye=null,e.updateQueue!=null){var a=e.updateQueue;a.lastEffect=null,a.events=null,a.stores=null,a.memoCache!=null&&(a.memoCache.index=0)}Bt.H=Ex,a=t(n,i)}while(Or);return a}function DE(){var e=Bt.H,t=e.useState()[0];return t=typeof t.then=="function"?Tl(t):t,e=e.useState()[0],(ye!==null?ye.memoizedState:null)!==e&&(Yt.flags|=1024),t}function zm(){var e=Au!==0;return Au=0,e}function Bm(e,t,n){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~n}function Fm(e){if(Tu){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}Tu=!1}ds=0,qe=ye=Yt=null,Or=!1,hl=Au=0,Pr=null}function An(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return qe===null?Yt.memoizedState=qe=e:qe=qe.next=e,qe}function Xe(){if(ye===null){var e=Yt.alternate;e=e!==null?e.memoizedState:null}else e=ye.next;var t=qe===null?Yt.memoizedState:qe.next;if(t!==null)qe=t,ye=e;else{if(e===null)throw Yt.alternate===null?Error(st(467)):Error(st(310));ye=e,e={memoizedState:ye.memoizedState,baseState:ye.baseState,baseQueue:ye.baseQueue,queue:ye.queue,next:null},qe===null?Yt.memoizedState=qe=e:qe=qe.next=e}return qe}function Ju(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function Tl(e){var t=hl;return hl+=1,Pr===null&&(Pr=[]),e=Hy(Pr,e,t),t=Yt,(qe===null?t.memoizedState:qe.next)===null&&(t=t.alternate,Bt.H=t===null||t.memoizedState===null?Mx:Ym),e}function Ku(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return Tl(e);if(e.$$typeof===rs)return dn(e)}throw Error(st(438,String(e)))}function Vm(e){var t=null,n=Yt.updateQueue;if(n!==null&&(t=n.memoCache),t==null){var i=Yt.alternate;i!==null&&(i=i.updateQueue,i!==null&&(i=i.memoCache,i!=null&&(t={data:i.data.map(function(s){return s.slice()}),index:0})))}if(t==null&&(t={data:[],index:0}),n===null&&(n=Ju(),Yt.updateQueue=n),n.memoCache=t,n=t.data[t.index],n===void 0)for(n=t.data[t.index]=Array(e),i=0;i<e;i++)n[i]=m1;return t.index++,n}function ps(e,t){return typeof t=="function"?t(e):t}function su(e){var t=Xe();return Hm(t,ye,e)}function Hm(e,t,n){var i=e.queue;if(i===null)throw Error(st(311));i.lastRenderedReducer=n;var s=e.baseQueue,a=i.pending;if(a!==null){if(s!==null){var r=s.next;s.next=a.next,a.next=r}t.baseQueue=s=a,i.pending=null}if(a=e.baseState,s===null)e.memoizedState=a;else{t=s.next;var o=r=null,c=null,l=t,h=!1;do{var d=l.lane&-536870913;if(d!==l.lane?(ee&d)===d:(ds&d)===d){var u=l.revertLane;if(u===0)c!==null&&(c=c.next={lane:0,revertLane:0,gesture:null,action:l.action,hasEagerState:l.hasEagerState,eagerState:l.eagerState,next:null}),d===Vr&&(h=!0);else if((ds&u)===u){l=l.next,u===Vr&&(h=!0);continue}else d={lane:0,revertLane:l.revertLane,gesture:null,action:l.action,hasEagerState:l.hasEagerState,eagerState:l.eagerState,next:null},c===null?(o=c=d,r=a):c=c.next=d,Yt.lanes|=u,na|=u;d=l.action,Fa&&n(a,d),a=l.hasEagerState?l.eagerState:n(a,d)}else u={lane:d,revertLane:l.revertLane,gesture:l.gesture,action:l.action,hasEagerState:l.hasEagerState,eagerState:l.eagerState,next:null},c===null?(o=c=u,r=a):c=c.next=u,Yt.lanes|=d,na|=d;l=l.next}while(l!==null&&l!==t);if(c===null?r=a:c.next=o,!Yn(a,e.memoizedState)&&(Je=!0,h&&(n=Lr,n!==null)))throw n;e.memoizedState=a,e.baseState=r,e.baseQueue=c,i.lastRenderedState=a}return s===null&&(i.lanes=0),[e.memoizedState,i.dispatch]}function tp(e){var t=Xe(),n=t.queue;if(n===null)throw Error(st(311));n.lastRenderedReducer=e;var i=n.dispatch,s=n.pending,a=t.memoizedState;if(s!==null){n.pending=null;var r=s=s.next;do a=e(a,r.action),r=r.next;while(r!==s);Yn(a,t.memoizedState)||(Je=!0),t.memoizedState=a,t.baseQueue===null&&(t.baseState=a),n.lastRenderedState=a}return[a,i]}function Jy(e,t,n){var i=Yt,s=Xe(),a=re;if(a){if(n===void 0)throw Error(st(407));n=n()}else n=t();var r=!Yn((ye||s).memoizedState,n);if(r&&(s.memoizedState=n,Je=!0),s=s.queue,Gm(Qy.bind(null,i,s,e),[e]),s.getSnapshot!==t||r||qe!==null&&qe.memoizedState.tag&1){if(i.flags|=2048,Gr(9,{destroy:void 0},jy.bind(null,i,s,n,t),null),Se===null)throw Error(st(349));a||(ds&127)!==0||Ky(i,t,n)}return n}function Ky(e,t,n){e.flags|=16384,e={getSnapshot:t,value:n},t=Yt.updateQueue,t===null?(t=Ju(),Yt.updateQueue=t,t.stores=[e]):(n=t.stores,n===null?t.stores=[e]:n.push(e))}function jy(e,t,n,i){t.value=n,t.getSnapshot=i,$y(t)&&tx(e)}function Qy(e,t,n){return n(function(){$y(t)&&tx(e)})}function $y(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!Yn(e,n)}catch{return!0}}function tx(e){var t=Xa(e,2);t!==null&&Ln(t,e,2)}function Xp(e){var t=An();if(typeof e=="function"){var n=e;if(e=n(),Fa){Fs(!0);try{n()}finally{Fs(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:ps,lastRenderedState:e},t}function ex(e,t,n,i){return e.baseState=n,Hm(e,ye,typeof i=="function"?i:ps)}function NE(e,t,n,i,s){if(Qu(e))throw Error(st(485));if(e=t.action,e!==null){var a={payload:s,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(r){a.listeners.push(r)}};Bt.T!==null?n(!0):a.isTransition=!1,i(a),n=t.pending,n===null?(a.next=t.pending=a,nx(t,a)):(a.next=n.next,t.pending=n.next=a)}}function nx(e,t){var n=t.action,i=t.payload,s=e.state;if(t.isTransition){var a=Bt.T,r={};Bt.T=r;try{var o=n(s,i),c=Bt.S;c!==null&&c(r,o),e_(e,t,o)}catch(l){Wp(e,t,l)}finally{a!==null&&r.types!==null&&(a.types=r.types),Bt.T=a}}else try{a=n(s,i),e_(e,t,a)}catch(l){Wp(e,t,l)}}function e_(e,t,n){n!==null&&typeof n=="object"&&typeof n.then=="function"?n.then(function(i){n_(e,t,i)},function(i){return Wp(e,t,i)}):n_(e,t,n)}function n_(e,t,n){t.status="fulfilled",t.value=n,ix(t),e.state=n,t=e.pending,t!==null&&(n=t.next,n===t?e.pending=null:(n=n.next,t.next=n,nx(e,n)))}function Wp(e,t,n){var i=e.pending;if(e.pending=null,i!==null){i=i.next;do t.status="rejected",t.reason=n,ix(t),t=t.next;while(t!==i)}e.action=null}function ix(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function sx(e,t){return t}function i_(e,t){if(re){var n=Se.formState;if(n!==null){t:{var i=Yt;if(re){if(Ce){e:{for(var s=Ce,a=fi;s.nodeType!==8;){if(!a){s=null;break e}if(s=pi(s.nextSibling),s===null){s=null;break e}}a=s.data,s=a==="F!"||a==="F"?s:null}if(s){Ce=pi(s.nextSibling),i=s.data==="F!";break t}}ta(i)}i=!1}i&&(t=n[0])}}return n=An(),n.memoizedState=n.baseState=t,i={pending:null,lanes:0,dispatch:null,lastRenderedReducer:sx,lastRenderedState:t},n.queue=i,n=xx.bind(null,Yt,i),i.dispatch=n,i=Xp(!1),a=qm.bind(null,Yt,!1,i.queue),i=An(),s={state:t,dispatch:null,action:e,pending:null},i.queue=s,n=NE.bind(null,Yt,s,a,n),s.dispatch=n,i.memoizedState=e,[t,n,!1]}function s_(e){var t=Xe();return ax(t,ye,e)}function ax(e,t,n){if(t=Hm(e,t,sx)[0],e=su(ps)[0],typeof t=="object"&&t!==null&&typeof t.then=="function")try{var i=Tl(t)}catch(r){throw r===jr?Zu:r}else i=t;t=Xe();var s=t.queue,a=s.dispatch;return n!==t.memoizedState&&(Yt.flags|=2048,Gr(9,{destroy:void 0},UE.bind(null,s,n),null)),[i,a,e]}function UE(e,t){e.action=t}function a_(e){var t=Xe(),n=ye;if(n!==null)return ax(t,n,e);Xe(),t=t.memoizedState,n=Xe();var i=n.queue.dispatch;return n.memoizedState=e,[t,i,!1]}function Gr(e,t,n,i){return e={tag:e,create:n,deps:i,inst:t,next:null},t=Yt.updateQueue,t===null&&(t=Ju(),Yt.updateQueue=t),n=t.lastEffect,n===null?t.lastEffect=e.next=e:(i=n.next,n.next=e,e.next=i,t.lastEffect=e),e}function rx(){return Xe().memoizedState}function au(e,t,n,i){var s=An();Yt.flags|=e,s.memoizedState=Gr(1|t,{destroy:void 0},n,i===void 0?null:i)}function ju(e,t,n,i){var s=Xe();i=i===void 0?null:i;var a=s.memoizedState.inst;ye!==null&&i!==null&&Om(i,ye.memoizedState.deps)?s.memoizedState=Gr(t,a,n,i):(Yt.flags|=e,s.memoizedState=Gr(1|t,a,n,i))}function r_(e,t){au(8390656,8,e,t)}function Gm(e,t){ju(2048,8,e,t)}function LE(e){Yt.flags|=4;var t=Yt.updateQueue;if(t===null)t=Ju(),Yt.updateQueue=t,t.events=[e];else{var n=t.events;n===null?t.events=[e]:n.push(e)}}function ox(e){var t=Xe().memoizedState;return LE({ref:t,nextImpl:e}),function(){if((ue&2)!==0)throw Error(st(440));return t.impl.apply(void 0,arguments)}}function lx(e,t){return ju(4,2,e,t)}function cx(e,t){return ju(4,4,e,t)}function ux(e,t){if(typeof t=="function"){e=e();var n=t(e);return function(){typeof n=="function"?n():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function hx(e,t,n){n=n!=null?n.concat([e]):null,ju(4,4,ux.bind(null,t,e),n)}function km(){}function fx(e,t){var n=Xe();t=t===void 0?null:t;var i=n.memoizedState;return t!==null&&Om(t,i[1])?i[0]:(n.memoizedState=[e,t],e)}function dx(e,t){var n=Xe();t=t===void 0?null:t;var i=n.memoizedState;if(t!==null&&Om(t,i[1]))return i[0];if(i=e(),Fa){Fs(!0);try{e()}finally{Fs(!1)}}return n.memoizedState=[i,t],i}function Xm(e,t,n){return n===void 0||(ds&1073741824)!==0&&(ee&261930)===0?e.memoizedState=t:(e.memoizedState=n,e=eb(),Yt.lanes|=e,na|=e,n)}function px(e,t,n,i){return Yn(n,t)?n:Hr.current!==null?(e=Xm(e,n,i),Yn(e,t)||(Je=!0),e):(ds&42)===0||(ds&1073741824)!==0&&(ee&261930)===0?(Je=!0,e.memoizedState=n):(e=eb(),Yt.lanes|=e,na|=e,t)}function mx(e,t,n,i,s){var a=he.p;he.p=a!==0&&8>a?a:8;var r=Bt.T,o={};Bt.T=o,qm(e,!1,t,n);try{var c=s(),l=Bt.S;if(l!==null&&l(o,c),c!==null&&typeof c=="object"&&typeof c.then=="function"){var h=CE(c,i);Qo(e,t,h,qn(e))}else Qo(e,t,i,qn(e))}catch(d){Qo(e,t,{then:function(){},status:"rejected",reason:d},qn())}finally{he.p=a,r!==null&&o.types!==null&&(r.types=o.types),Bt.T=r}}function IE(){}function qp(e,t,n,i){if(e.tag!==5)throw Error(st(476));var s=gx(e).queue;mx(e,s,t,Na,n===null?IE:function(){return vx(e),n(i)})}function gx(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:Na,baseState:Na,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:ps,lastRenderedState:Na},next:null};var n={};return t.next={memoizedState:n,baseState:n,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:ps,lastRenderedState:n},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function vx(e){var t=gx(e);t.next===null&&(t=e.alternate.memoizedState),Qo(e,t.next.queue,{},qn())}function Wm(){return dn(ml)}function _x(){return Xe().memoizedState}function yx(){return Xe().memoizedState}function OE(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var n=qn();e=qs(n);var i=Ys(t,e,n);i!==null&&(Ln(i,t,n),Jo(i,t,n)),t={cache:Dm()},e.payload=t;return}t=t.return}}function PE(e,t,n){var i=qn();n={lane:i,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null},Qu(e)?bx(t,n):(n=Am(e,t,n,i),n!==null&&(Ln(n,e,i),Sx(n,t,i)))}function xx(e,t,n){var i=qn();Qo(e,t,n,i)}function Qo(e,t,n,i){var s={lane:i,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null};if(Qu(e))bx(t,s);else{var a=e.alternate;if(e.lanes===0&&(a===null||a.lanes===0)&&(a=t.lastRenderedReducer,a!==null))try{var r=t.lastRenderedState,o=a(r,n);if(s.hasEagerState=!0,s.eagerState=o,Yn(o,r))return Yu(e,t,s,0),Se===null&&qu(),!1}catch{}finally{}if(n=Am(e,t,s,i),n!==null)return Ln(n,e,i),Sx(n,t,i),!0}return!1}function qm(e,t,n,i){if(i={lane:2,revertLane:eg(),gesture:null,action:i,hasEagerState:!1,eagerState:null,next:null},Qu(e)){if(t)throw Error(st(479))}else t=Am(e,n,i,2),t!==null&&Ln(t,e,2)}function Qu(e){var t=e.alternate;return e===Yt||t!==null&&t===Yt}function bx(e,t){Or=Tu=!0;var n=e.pending;n===null?t.next=t:(t.next=n.next,n.next=t),e.pending=t}function Sx(e,t,n){if((n&4194048)!==0){var i=t.lanes;i&=e.pendingLanes,n|=i,t.lanes=n,oy(e,n)}}var fl={readContext:dn,use:Ku,useCallback:Be,useContext:Be,useEffect:Be,useImperativeHandle:Be,useLayoutEffect:Be,useInsertionEffect:Be,useMemo:Be,useReducer:Be,useRef:Be,useState:Be,useDebugValue:Be,useDeferredValue:Be,useTransition:Be,useSyncExternalStore:Be,useId:Be,useHostTransitionStatus:Be,useFormState:Be,useActionState:Be,useOptimistic:Be,useMemoCache:Be,useCacheRefresh:Be};fl.useEffectEvent=Be;var Mx={readContext:dn,use:Ku,useCallback:function(e,t){return An().memoizedState=[e,t===void 0?null:t],e},useContext:dn,useEffect:r_,useImperativeHandle:function(e,t,n){n=n!=null?n.concat([e]):null,au(4194308,4,ux.bind(null,t,e),n)},useLayoutEffect:function(e,t){return au(4194308,4,e,t)},useInsertionEffect:function(e,t){au(4,2,e,t)},useMemo:function(e,t){var n=An();t=t===void 0?null:t;var i=e();if(Fa){Fs(!0);try{e()}finally{Fs(!1)}}return n.memoizedState=[i,t],i},useReducer:function(e,t,n){var i=An();if(n!==void 0){var s=n(t);if(Fa){Fs(!0);try{n(t)}finally{Fs(!1)}}}else s=t;return i.memoizedState=i.baseState=s,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:s},i.queue=e,e=e.dispatch=PE.bind(null,Yt,e),[i.memoizedState,e]},useRef:function(e){var t=An();return e={current:e},t.memoizedState=e},useState:function(e){e=Xp(e);var t=e.queue,n=xx.bind(null,Yt,t);return t.dispatch=n,[e.memoizedState,n]},useDebugValue:km,useDeferredValue:function(e,t){var n=An();return Xm(n,e,t)},useTransition:function(){var e=Xp(!1);return e=mx.bind(null,Yt,e.queue,!0,!1),An().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,n){var i=Yt,s=An();if(re){if(n===void 0)throw Error(st(407));n=n()}else{if(n=t(),Se===null)throw Error(st(349));(ee&127)!==0||Ky(i,t,n)}s.memoizedState=n;var a={value:n,getSnapshot:t};return s.queue=a,r_(Qy.bind(null,i,a,e),[e]),i.flags|=2048,Gr(9,{destroy:void 0},jy.bind(null,i,a,n,t),null),n},useId:function(){var e=An(),t=Se.identifierPrefix;if(re){var n=Ii,i=Li;n=(i&~(1<<32-Wn(i)-1)).toString(32)+n,t="_"+t+"R_"+n,n=Au++,0<n&&(t+="H"+n.toString(32)),t+="_"}else n=RE++,t="_"+t+"r_"+n.toString(32)+"_";return e.memoizedState=t},useHostTransitionStatus:Wm,useFormState:i_,useActionState:i_,useOptimistic:function(e){var t=An();t.memoizedState=t.baseState=e;var n={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=n,t=qm.bind(null,Yt,!0,n),n.dispatch=t,[e,t]},useMemoCache:Vm,useCacheRefresh:function(){return An().memoizedState=OE.bind(null,Yt)},useEffectEvent:function(e){var t=An(),n={impl:e};return t.memoizedState=n,function(){if((ue&2)!==0)throw Error(st(440));return n.impl.apply(void 0,arguments)}}},Ym={readContext:dn,use:Ku,useCallback:fx,useContext:dn,useEffect:Gm,useImperativeHandle:hx,useInsertionEffect:lx,useLayoutEffect:cx,useMemo:dx,useReducer:su,useRef:rx,useState:function(){return su(ps)},useDebugValue:km,useDeferredValue:function(e,t){var n=Xe();return px(n,ye.memoizedState,e,t)},useTransition:function(){var e=su(ps)[0],t=Xe().memoizedState;return[typeof e=="boolean"?e:Tl(e),t]},useSyncExternalStore:Jy,useId:_x,useHostTransitionStatus:Wm,useFormState:s_,useActionState:s_,useOptimistic:function(e,t){var n=Xe();return ex(n,ye,e,t)},useMemoCache:Vm,useCacheRefresh:yx};Ym.useEffectEvent=ox;var Ex={readContext:dn,use:Ku,useCallback:fx,useContext:dn,useEffect:Gm,useImperativeHandle:hx,useInsertionEffect:lx,useLayoutEffect:cx,useMemo:dx,useReducer:tp,useRef:rx,useState:function(){return tp(ps)},useDebugValue:km,useDeferredValue:function(e,t){var n=Xe();return ye===null?Xm(n,e,t):px(n,ye.memoizedState,e,t)},useTransition:function(){var e=tp(ps)[0],t=Xe().memoizedState;return[typeof e=="boolean"?e:Tl(e),t]},useSyncExternalStore:Jy,useId:_x,useHostTransitionStatus:Wm,useFormState:a_,useActionState:a_,useOptimistic:function(e,t){var n=Xe();return ye!==null?ex(n,ye,e,t):(n.baseState=e,[e,n.queue.dispatch])},useMemoCache:Vm,useCacheRefresh:yx};Ex.useEffectEvent=ox;function ep(e,t,n,i){t=e.memoizedState,n=n(i,t),n=n==null?t:Re({},t,n),e.memoizedState=n,e.lanes===0&&(e.updateQueue.baseState=n)}var Yp={enqueueSetState:function(e,t,n){e=e._reactInternals;var i=qn(),s=qs(i);s.payload=t,n!=null&&(s.callback=n),t=Ys(e,s,i),t!==null&&(Ln(t,e,i),Jo(t,e,i))},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var i=qn(),s=qs(i);s.tag=1,s.payload=t,n!=null&&(s.callback=n),t=Ys(e,s,i),t!==null&&(Ln(t,e,i),Jo(t,e,i))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=qn(),i=qs(n);i.tag=2,t!=null&&(i.callback=t),t=Ys(e,i,n),t!==null&&(Ln(t,e,n),Jo(t,e,n))}};function o_(e,t,n,i,s,a,r){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(i,a,r):t.prototype&&t.prototype.isPureReactComponent?!ol(n,i)||!ol(s,a):!0}function l_(e,t,n,i){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(n,i),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(n,i),t.state!==e&&Yp.enqueueReplaceState(t,t.state,null)}function Va(e,t){var n=t;if("ref"in t){n={};for(var i in t)i!=="ref"&&(n[i]=t[i])}if(e=e.defaultProps){n===t&&(n=Re({},n));for(var s in e)n[s]===void 0&&(n[s]=e[s])}return n}function Tx(e){_u(e)}function Ax(e){console.error(e)}function wx(e){_u(e)}function wu(e,t){try{var n=e.onUncaughtError;n(t.value,{componentStack:t.stack})}catch(i){setTimeout(function(){throw i})}}function c_(e,t,n){try{var i=e.onCaughtError;i(n.value,{componentStack:n.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(s){setTimeout(function(){throw s})}}function Zp(e,t,n){return n=qs(n),n.tag=3,n.payload={element:null},n.callback=function(){wu(e,t)},n}function Cx(e){return e=qs(e),e.tag=3,e}function Rx(e,t,n,i){var s=n.type.getDerivedStateFromError;if(typeof s=="function"){var a=i.value;e.payload=function(){return s(a)},e.callback=function(){c_(t,n,i)}}var r=n.stateNode;r!==null&&typeof r.componentDidCatch=="function"&&(e.callback=function(){c_(t,n,i),typeof s!="function"&&(Zs===null?Zs=new Set([this]):Zs.add(this));var o=i.stack;this.componentDidCatch(i.value,{componentStack:o!==null?o:""})})}function zE(e,t,n,i,s){if(n.flags|=32768,i!==null&&typeof i=="object"&&typeof i.then=="function"){if(t=n.alternate,t!==null&&Kr(t,n,s,!0),n=Zn.current,n!==null){switch(n.tag){case 31:case 13:return di===null?Uu():n.alternate===null&&Fe===0&&(Fe=3),n.flags&=-257,n.flags|=65536,n.lanes=s,i===Su?n.flags|=16384:(t=n.updateQueue,t===null?n.updateQueue=new Set([i]):t.add(i),fp(e,i,s)),!1;case 22:return n.flags|=65536,i===Su?n.flags|=16384:(t=n.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([i])},n.updateQueue=t):(n=t.retryQueue,n===null?t.retryQueue=new Set([i]):n.add(i)),fp(e,i,s)),!1}throw Error(st(435,n.tag))}return fp(e,i,s),Uu(),!1}if(re)return t=Zn.current,t!==null?((t.flags&65536)===0&&(t.flags|=256),t.flags|=65536,t.lanes=s,i!==Op&&(e=Error(st(422),{cause:i}),cl(hi(e,n)))):(i!==Op&&(t=Error(st(423),{cause:i}),cl(hi(t,n))),e=e.current.alternate,e.flags|=65536,s&=-s,e.lanes|=s,i=hi(i,n),s=Zp(e.stateNode,i,s),$d(e,s),Fe!==4&&(Fe=2)),!1;var a=Error(st(520),{cause:i});if(a=hi(a,n),el===null?el=[a]:el.push(a),Fe!==4&&(Fe=2),t===null)return!0;i=hi(i,n),n=t;do{switch(n.tag){case 3:return n.flags|=65536,e=s&-s,n.lanes|=e,e=Zp(n.stateNode,i,e),$d(n,e),!1;case 1:if(t=n.type,a=n.stateNode,(n.flags&128)===0&&(typeof t.getDerivedStateFromError=="function"||a!==null&&typeof a.componentDidCatch=="function"&&(Zs===null||!Zs.has(a))))return n.flags|=65536,s&=-s,n.lanes|=s,s=Cx(s),Rx(s,e,n,i),$d(n,s),!1}n=n.return}while(n!==null);return!1}var Zm=Error(st(461)),Je=!1;function un(e,t,n,i){t.child=e===null?ky(t,null,n,i):Ba(t,e.child,n,i)}function u_(e,t,n,i,s){n=n.render;var a=t.ref;if("ref"in i){var r={};for(var o in i)o!=="ref"&&(r[o]=i[o])}else r=i;return za(t),i=Pm(e,t,n,r,a,s),o=zm(),e!==null&&!Je?(Bm(e,t,s),ms(e,t,s)):(re&&o&&Cm(t),t.flags|=1,un(e,t,i,s),t.child)}function h_(e,t,n,i,s){if(e===null){var a=n.type;return typeof a=="function"&&!wm(a)&&a.defaultProps===void 0&&n.compare===null?(t.tag=15,t.type=a,Dx(e,t,a,i,s)):(e=nu(n.type,null,i,t,t.mode,s),e.ref=t.ref,e.return=t,t.child=e)}if(a=e.child,!Jm(e,s)){var r=a.memoizedProps;if(n=n.compare,n=n!==null?n:ol,n(r,i)&&e.ref===t.ref)return ms(e,t,s)}return t.flags|=1,e=cs(a,i),e.ref=t.ref,e.return=t,t.child=e}function Dx(e,t,n,i,s){if(e!==null){var a=e.memoizedProps;if(ol(a,i)&&e.ref===t.ref)if(Je=!1,t.pendingProps=i=a,Jm(e,s))(e.flags&131072)!==0&&(Je=!0);else return t.lanes=e.lanes,ms(e,t,s)}return Jp(e,t,n,i,s)}function Nx(e,t,n,i){var s=i.children,a=e!==null?e.memoizedState:null;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),i.mode==="hidden"){if((t.flags&128)!==0){if(a=a!==null?a.baseLanes|n:n,e!==null){for(i=t.child=e.child,s=0;i!==null;)s=s|i.lanes|i.childLanes,i=i.sibling;i=s&~a}else i=0,t.child=null;return f_(e,t,a,n,i)}if((n&536870912)!==0)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&iu(t,a!==null?a.cachePool:null),a!==null?t_(t,a):Gp(),qy(t);else return i=t.lanes=536870912,f_(e,t,a!==null?a.baseLanes|n:n,n,i)}else a!==null?(iu(t,a.cachePool),t_(t,a),zs(t),t.memoizedState=null):(e!==null&&iu(t,null),Gp(),zs(t));return un(e,t,s,n),t.child}function ko(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function f_(e,t,n,i,s){var a=Nm();return a=a===null?null:{parent:Ze._currentValue,pool:a},t.memoizedState={baseLanes:n,cachePool:a},e!==null&&iu(t,null),Gp(),qy(t),e!==null&&Kr(e,t,i,!0),t.childLanes=s,null}function ru(e,t){return t=Cu({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function d_(e,t,n){return Ba(t,e.child,null,n),e=ru(t,t.pendingProps),e.flags|=2,Vn(t),t.memoizedState=null,e}function BE(e,t,n){var i=t.pendingProps,s=(t.flags&128)!==0;if(t.flags&=-129,e===null){if(re){if(i.mode==="hidden")return e=ru(t,i),t.lanes=536870912,ko(null,e);if(kp(t),(e=Ce)?(e=Mb(e,fi),e=e!==null&&e.data==="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:$s!==null?{id:Li,overflow:Ii}:null,retryLane:536870912,hydrationErrors:null},n=Py(e),n.return=t,t.child=n,fn=t,Ce=null)):e=null,e===null)throw ta(t);return t.lanes=536870912,null}return ru(t,i)}var a=e.memoizedState;if(a!==null){var r=a.dehydrated;if(kp(t),s)if(t.flags&256)t.flags&=-257,t=d_(e,t,n);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(st(558));else if(Je||Kr(e,t,n,!1),s=(n&e.childLanes)!==0,Je||s){if(i=Se,i!==null&&(r=ly(i,n),r!==0&&r!==a.retryLane))throw a.retryLane=r,Xa(e,r),Ln(i,e,r),Zm;Uu(),t=d_(e,t,n)}else e=a.treeContext,Ce=pi(r.nextSibling),fn=t,re=!0,Ws=null,fi=!1,e!==null&&By(t,e),t=ru(t,i),t.flags|=4096;return t}return e=cs(e.child,{mode:i.mode,children:i.children}),e.ref=t.ref,t.child=e,e.return=t,e}function ou(e,t){var n=t.ref;if(n===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof n!="function"&&typeof n!="object")throw Error(st(284));(e===null||e.ref!==n)&&(t.flags|=4194816)}}function Jp(e,t,n,i,s){return za(t),n=Pm(e,t,n,i,void 0,s),i=zm(),e!==null&&!Je?(Bm(e,t,s),ms(e,t,s)):(re&&i&&Cm(t),t.flags|=1,un(e,t,n,s),t.child)}function p_(e,t,n,i,s,a){return za(t),t.updateQueue=null,n=Zy(t,i,n,s),Yy(e),i=zm(),e!==null&&!Je?(Bm(e,t,a),ms(e,t,a)):(re&&i&&Cm(t),t.flags|=1,un(e,t,n,a),t.child)}function m_(e,t,n,i,s){if(za(t),t.stateNode===null){var a=Ar,r=n.contextType;typeof r=="object"&&r!==null&&(a=dn(r)),a=new n(i,a),t.memoizedState=a.state!==null&&a.state!==void 0?a.state:null,a.updater=Yp,t.stateNode=a,a._reactInternals=t,a=t.stateNode,a.props=i,a.state=t.memoizedState,a.refs={},Lm(t),r=n.contextType,a.context=typeof r=="object"&&r!==null?dn(r):Ar,a.state=t.memoizedState,r=n.getDerivedStateFromProps,typeof r=="function"&&(ep(t,n,r,i),a.state=t.memoizedState),typeof n.getDerivedStateFromProps=="function"||typeof a.getSnapshotBeforeUpdate=="function"||typeof a.UNSAFE_componentWillMount!="function"&&typeof a.componentWillMount!="function"||(r=a.state,typeof a.componentWillMount=="function"&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount=="function"&&a.UNSAFE_componentWillMount(),r!==a.state&&Yp.enqueueReplaceState(a,a.state,null),jo(t,i,a,s),Ko(),a.state=t.memoizedState),typeof a.componentDidMount=="function"&&(t.flags|=4194308),i=!0}else if(e===null){a=t.stateNode;var o=t.memoizedProps,c=Va(n,o);a.props=c;var l=a.context,h=n.contextType;r=Ar,typeof h=="object"&&h!==null&&(r=dn(h));var d=n.getDerivedStateFromProps;h=typeof d=="function"||typeof a.getSnapshotBeforeUpdate=="function",o=t.pendingProps!==o,h||typeof a.UNSAFE_componentWillReceiveProps!="function"&&typeof a.componentWillReceiveProps!="function"||(o||l!==r)&&l_(t,a,i,r),Is=!1;var u=t.memoizedState;a.state=u,jo(t,i,a,s),Ko(),l=t.memoizedState,o||u!==l||Is?(typeof d=="function"&&(ep(t,n,d,i),l=t.memoizedState),(c=Is||o_(t,n,c,i,u,l,r))?(h||typeof a.UNSAFE_componentWillMount!="function"&&typeof a.componentWillMount!="function"||(typeof a.componentWillMount=="function"&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount=="function"&&a.UNSAFE_componentWillMount()),typeof a.componentDidMount=="function"&&(t.flags|=4194308)):(typeof a.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=i,t.memoizedState=l),a.props=i,a.state=l,a.context=r,i=c):(typeof a.componentDidMount=="function"&&(t.flags|=4194308),i=!1)}else{a=t.stateNode,Vp(e,t),r=t.memoizedProps,h=Va(n,r),a.props=h,d=t.pendingProps,u=a.context,l=n.contextType,c=Ar,typeof l=="object"&&l!==null&&(c=dn(l)),o=n.getDerivedStateFromProps,(l=typeof o=="function"||typeof a.getSnapshotBeforeUpdate=="function")||typeof a.UNSAFE_componentWillReceiveProps!="function"&&typeof a.componentWillReceiveProps!="function"||(r!==d||u!==c)&&l_(t,a,i,c),Is=!1,u=t.memoizedState,a.state=u,jo(t,i,a,s),Ko();var p=t.memoizedState;r!==d||u!==p||Is||e!==null&&e.dependencies!==null&&bu(e.dependencies)?(typeof o=="function"&&(ep(t,n,o,i),p=t.memoizedState),(h=Is||o_(t,n,h,i,u,p,c)||e!==null&&e.dependencies!==null&&bu(e.dependencies))?(l||typeof a.UNSAFE_componentWillUpdate!="function"&&typeof a.componentWillUpdate!="function"||(typeof a.componentWillUpdate=="function"&&a.componentWillUpdate(i,p,c),typeof a.UNSAFE_componentWillUpdate=="function"&&a.UNSAFE_componentWillUpdate(i,p,c)),typeof a.componentDidUpdate=="function"&&(t.flags|=4),typeof a.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof a.componentDidUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=1024),t.memoizedProps=i,t.memoizedState=p),a.props=i,a.state=p,a.context=c,i=h):(typeof a.componentDidUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=1024),i=!1)}return a=i,ou(e,t),i=(t.flags&128)!==0,a||i?(a=t.stateNode,n=i&&typeof n.getDerivedStateFromError!="function"?null:a.render(),t.flags|=1,e!==null&&i?(t.child=Ba(t,e.child,null,s),t.child=Ba(t,null,n,s)):un(e,t,n,s),t.memoizedState=a.state,e=t.child):e=ms(e,t,s),e}function g_(e,t,n,i){return Pa(),t.flags|=256,un(e,t,n,i),t.child}var np={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function ip(e){return{baseLanes:e,cachePool:Vy()}}function sp(e,t,n){return e=e!==null?e.childLanes&~n:0,t&&(e|=Gn),e}function Ux(e,t,n){var i=t.pendingProps,s=!1,a=(t.flags&128)!==0,r;if((r=a)||(r=e!==null&&e.memoizedState===null?!1:(ke.current&2)!==0),r&&(s=!0,t.flags&=-129),r=(t.flags&32)!==0,t.flags&=-33,e===null){if(re){if(s?Ps(t):zs(t),(e=Ce)?(e=Mb(e,fi),e=e!==null&&e.data!=="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:$s!==null?{id:Li,overflow:Ii}:null,retryLane:536870912,hydrationErrors:null},n=Py(e),n.return=t,t.child=n,fn=t,Ce=null)):e=null,e===null)throw ta(t);return cm(e)?t.lanes=32:t.lanes=536870912,null}var o=i.children;return i=i.fallback,s?(zs(t),s=t.mode,o=Cu({mode:"hidden",children:o},s),i=Ua(i,s,n,null),o.return=t,i.return=t,o.sibling=i,t.child=o,i=t.child,i.memoizedState=ip(n),i.childLanes=sp(e,r,n),t.memoizedState=np,ko(null,i)):(Ps(t),Kp(t,o))}var c=e.memoizedState;if(c!==null&&(o=c.dehydrated,o!==null)){if(a)t.flags&256?(Ps(t),t.flags&=-257,t=ap(e,t,n)):t.memoizedState!==null?(zs(t),t.child=e.child,t.flags|=128,t=null):(zs(t),o=i.fallback,s=t.mode,i=Cu({mode:"visible",children:i.children},s),o=Ua(o,s,n,null),o.flags|=2,i.return=t,o.return=t,i.sibling=o,t.child=i,Ba(t,e.child,null,n),i=t.child,i.memoizedState=ip(n),i.childLanes=sp(e,r,n),t.memoizedState=np,t=ko(null,i));else if(Ps(t),cm(o)){if(r=o.nextSibling&&o.nextSibling.dataset,r)var l=r.dgst;r=l,i=Error(st(419)),i.stack="",i.digest=r,cl({value:i,source:null,stack:null}),t=ap(e,t,n)}else if(Je||Kr(e,t,n,!1),r=(n&e.childLanes)!==0,Je||r){if(r=Se,r!==null&&(i=ly(r,n),i!==0&&i!==c.retryLane))throw c.retryLane=i,Xa(e,i),Ln(r,e,i),Zm;lm(o)||Uu(),t=ap(e,t,n)}else lm(o)?(t.flags|=192,t.child=e.child,t=null):(e=c.treeContext,Ce=pi(o.nextSibling),fn=t,re=!0,Ws=null,fi=!1,e!==null&&By(t,e),t=Kp(t,i.children),t.flags|=4096);return t}return s?(zs(t),o=i.fallback,s=t.mode,c=e.child,l=c.sibling,i=cs(c,{mode:"hidden",children:i.children}),i.subtreeFlags=c.subtreeFlags&65011712,l!==null?o=cs(l,o):(o=Ua(o,s,n,null),o.flags|=2),o.return=t,i.return=t,i.sibling=o,t.child=i,ko(null,i),i=t.child,o=e.child.memoizedState,o===null?o=ip(n):(s=o.cachePool,s!==null?(c=Ze._currentValue,s=s.parent!==c?{parent:c,pool:c}:s):s=Vy(),o={baseLanes:o.baseLanes|n,cachePool:s}),i.memoizedState=o,i.childLanes=sp(e,r,n),t.memoizedState=np,ko(e.child,i)):(Ps(t),n=e.child,e=n.sibling,n=cs(n,{mode:"visible",children:i.children}),n.return=t,n.sibling=null,e!==null&&(r=t.deletions,r===null?(t.deletions=[e],t.flags|=16):r.push(e)),t.child=n,t.memoizedState=null,n)}function Kp(e,t){return t=Cu({mode:"visible",children:t},e.mode),t.return=e,e.child=t}function Cu(e,t){return e=Hn(22,e,null,t),e.lanes=0,e}function ap(e,t,n){return Ba(t,e.child,null,n),e=Kp(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function v_(e,t,n){e.lanes|=t;var i=e.alternate;i!==null&&(i.lanes|=t),zp(e.return,t,n)}function rp(e,t,n,i,s,a){var r=e.memoizedState;r===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:i,tail:n,tailMode:s,treeForkCount:a}:(r.isBackwards=t,r.rendering=null,r.renderingStartTime=0,r.last=i,r.tail=n,r.tailMode=s,r.treeForkCount=a)}function Lx(e,t,n){var i=t.pendingProps,s=i.revealOrder,a=i.tail;i=i.children;var r=ke.current,o=(r&2)!==0;if(o?(r=r&1|2,t.flags|=128):r&=1,Ee(ke,r),un(e,t,i,n),i=re?ll:0,!o&&e!==null&&(e.flags&128)!==0)t:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&v_(e,n,t);else if(e.tag===19)v_(e,n,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break t;for(;e.sibling===null;){if(e.return===null||e.return===t)break t;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(s){case"forwards":for(n=t.child,s=null;n!==null;)e=n.alternate,e!==null&&Eu(e)===null&&(s=n),n=n.sibling;n=s,n===null?(s=t.child,t.child=null):(s=n.sibling,n.sibling=null),rp(t,!1,s,n,a,i);break;case"backwards":case"unstable_legacy-backwards":for(n=null,s=t.child,t.child=null;s!==null;){if(e=s.alternate,e!==null&&Eu(e)===null){t.child=s;break}e=s.sibling,s.sibling=n,n=s,s=e}rp(t,!0,n,null,a,i);break;case"together":rp(t,!1,null,null,void 0,i);break;default:t.memoizedState=null}return t.child}function ms(e,t,n){if(e!==null&&(t.dependencies=e.dependencies),na|=t.lanes,(n&t.childLanes)===0)if(e!==null){if(Kr(e,t,n,!1),(n&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(st(153));if(t.child!==null){for(e=t.child,n=cs(e,e.pendingProps),t.child=n,n.return=t;e.sibling!==null;)e=e.sibling,n=n.sibling=cs(e,e.pendingProps),n.return=t;n.sibling=null}return t.child}function Jm(e,t){return(e.lanes&t)!==0?!0:(e=e.dependencies,!!(e!==null&&bu(e)))}function FE(e,t,n){switch(t.tag){case 3:pu(t,t.stateNode.containerInfo),Os(t,Ze,e.memoizedState.cache),Pa();break;case 27:case 5:Ep(t);break;case 4:pu(t,t.stateNode.containerInfo);break;case 10:Os(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,kp(t),null;break;case 13:var i=t.memoizedState;if(i!==null)return i.dehydrated!==null?(Ps(t),t.flags|=128,null):(n&t.child.childLanes)!==0?Ux(e,t,n):(Ps(t),e=ms(e,t,n),e!==null?e.sibling:null);Ps(t);break;case 19:var s=(e.flags&128)!==0;if(i=(n&t.childLanes)!==0,i||(Kr(e,t,n,!1),i=(n&t.childLanes)!==0),s){if(i)return Lx(e,t,n);t.flags|=128}if(s=t.memoizedState,s!==null&&(s.rendering=null,s.tail=null,s.lastEffect=null),Ee(ke,ke.current),i)break;return null;case 22:return t.lanes=0,Nx(e,t,n,t.pendingProps);case 24:Os(t,Ze,e.memoizedState.cache)}return ms(e,t,n)}function Ix(e,t,n){if(e!==null)if(e.memoizedProps!==t.pendingProps)Je=!0;else{if(!Jm(e,n)&&(t.flags&128)===0)return Je=!1,FE(e,t,n);Je=(e.flags&131072)!==0}else Je=!1,re&&(t.flags&1048576)!==0&&zy(t,ll,t.index);switch(t.lanes=0,t.tag){case 16:t:{var i=t.pendingProps;if(e=Ra(t.elementType),t.type=e,typeof e=="function")wm(e)?(i=Va(e,i),t.tag=1,t=m_(null,t,e,i,n)):(t.tag=0,t=Jp(null,t,e,i,n));else{if(e!=null){var s=e.$$typeof;if(s===dm){t.tag=11,t=u_(null,t,e,i,n);break t}else if(s===pm){t.tag=14,t=h_(null,t,e,i,n);break t}}throw t=Sp(e)||e,Error(st(306,t,""))}}return t;case 0:return Jp(e,t,t.type,t.pendingProps,n);case 1:return i=t.type,s=Va(i,t.pendingProps),m_(e,t,i,s,n);case 3:t:{if(pu(t,t.stateNode.containerInfo),e===null)throw Error(st(387));i=t.pendingProps;var a=t.memoizedState;s=a.element,Vp(e,t),jo(t,i,null,n);var r=t.memoizedState;if(i=r.cache,Os(t,Ze,i),i!==a.cache&&Bp(t,[Ze],n,!0),Ko(),i=r.element,a.isDehydrated)if(a={element:i,isDehydrated:!1,cache:r.cache},t.updateQueue.baseState=a,t.memoizedState=a,t.flags&256){t=g_(e,t,i,n);break t}else if(i!==s){s=hi(Error(st(424)),t),cl(s),t=g_(e,t,i,n);break t}else{switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName==="HTML"?e.ownerDocument.body:e}for(Ce=pi(e.firstChild),fn=t,re=!0,Ws=null,fi=!0,n=ky(t,null,i,n),t.child=n;n;)n.flags=n.flags&-3|4096,n=n.sibling}else{if(Pa(),i===s){t=ms(e,t,n);break t}un(e,t,i,n)}t=t.child}return t;case 26:return ou(e,t),e===null?(n=F_(t.type,null,t.pendingProps,null))?t.memoizedState=n:re||(n=t.type,e=t.pendingProps,i=Pu(Xs.current).createElement(n),i[hn]=t,i[In]=e,pn(i,n,e),rn(i),t.stateNode=i):t.memoizedState=F_(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return Ep(t),e===null&&re&&(i=t.stateNode=Eb(t.type,t.pendingProps,Xs.current),fn=t,fi=!0,s=Ce,sa(t.type)?(um=s,Ce=pi(i.firstChild)):Ce=s),un(e,t,t.pendingProps.children,n),ou(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&re&&((s=i=Ce)&&(i=dT(i,t.type,t.pendingProps,fi),i!==null?(t.stateNode=i,fn=t,Ce=pi(i.firstChild),fi=!1,s=!0):s=!1),s||ta(t)),Ep(t),s=t.type,a=t.pendingProps,r=e!==null?e.memoizedProps:null,i=a.children,rm(s,a)?i=null:r!==null&&rm(s,r)&&(t.flags|=32),t.memoizedState!==null&&(s=Pm(e,t,DE,null,null,n),ml._currentValue=s),ou(e,t),un(e,t,i,n),t.child;case 6:return e===null&&re&&((e=n=Ce)&&(n=pT(n,t.pendingProps,fi),n!==null?(t.stateNode=n,fn=t,Ce=null,e=!0):e=!1),e||ta(t)),null;case 13:return Ux(e,t,n);case 4:return pu(t,t.stateNode.containerInfo),i=t.pendingProps,e===null?t.child=Ba(t,null,i,n):un(e,t,i,n),t.child;case 11:return u_(e,t,t.type,t.pendingProps,n);case 7:return un(e,t,t.pendingProps,n),t.child;case 8:return un(e,t,t.pendingProps.children,n),t.child;case 12:return un(e,t,t.pendingProps.children,n),t.child;case 10:return i=t.pendingProps,Os(t,t.type,i.value),un(e,t,i.children,n),t.child;case 9:return s=t.type._context,i=t.pendingProps.children,za(t),s=dn(s),i=i(s),t.flags|=1,un(e,t,i,n),t.child;case 14:return h_(e,t,t.type,t.pendingProps,n);case 15:return Dx(e,t,t.type,t.pendingProps,n);case 19:return Lx(e,t,n);case 31:return BE(e,t,n);case 22:return Nx(e,t,n,t.pendingProps);case 24:return za(t),i=dn(Ze),e===null?(s=Nm(),s===null&&(s=Se,a=Dm(),s.pooledCache=a,a.refCount++,a!==null&&(s.pooledCacheLanes|=n),s=a),t.memoizedState={parent:i,cache:s},Lm(t),Os(t,Ze,s)):((e.lanes&n)!==0&&(Vp(e,t),jo(t,null,null,n),Ko()),s=e.memoizedState,a=t.memoizedState,s.parent!==i?(s={parent:i,cache:i},t.memoizedState=s,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=s),Os(t,Ze,i)):(i=a.cache,Os(t,Ze,i),i!==s.cache&&Bp(t,[Ze],n,!0))),un(e,t,t.pendingProps.children,n),t.child;case 29:throw t.pendingProps}throw Error(st(156,t.tag))}function ts(e){e.flags|=4}function op(e,t,n,i,s){if((t=(e.mode&32)!==0)&&(t=!1),t){if(e.flags|=16777216,(s&335544128)===s)if(e.stateNode.complete)e.flags|=8192;else if(sb())e.flags|=8192;else throw Ia=Su,Um}else e.flags&=-16777217}function __(e,t){if(t.type!=="stylesheet"||(t.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!wb(t))if(sb())e.flags|=8192;else throw Ia=Su,Um}function Wc(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag!==22?ay():536870912,e.lanes|=t,kr|=t)}function Po(e,t){if(!re)switch(e.tailMode){case"hidden":t=e.tail;for(var n=null;t!==null;)t.alternate!==null&&(n=t),t=t.sibling;n===null?e.tail=null:n.sibling=null;break;case"collapsed":n=e.tail;for(var i=null;n!==null;)n.alternate!==null&&(i=n),n=n.sibling;i===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:i.sibling=null}}function we(e){var t=e.alternate!==null&&e.alternate.child===e.child,n=0,i=0;if(t)for(var s=e.child;s!==null;)n|=s.lanes|s.childLanes,i|=s.subtreeFlags&65011712,i|=s.flags&65011712,s.return=e,s=s.sibling;else for(s=e.child;s!==null;)n|=s.lanes|s.childLanes,i|=s.subtreeFlags,i|=s.flags,s.return=e,s=s.sibling;return e.subtreeFlags|=i,e.childLanes=n,t}function VE(e,t,n){var i=t.pendingProps;switch(Rm(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return we(t),null;case 1:return we(t),null;case 3:return n=t.stateNode,i=null,e!==null&&(i=e.memoizedState.cache),t.memoizedState.cache!==i&&(t.flags|=2048),us(Ze),zr(),n.pendingContext&&(n.context=n.pendingContext,n.pendingContext=null),(e===null||e.child===null)&&(pr(t)?ts(t):e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,Qd())),we(t),null;case 26:var s=t.type,a=t.memoizedState;return e===null?(ts(t),a!==null?(we(t),__(t,a)):(we(t),op(t,s,null,i,n))):a?a!==e.memoizedState?(ts(t),we(t),__(t,a)):(we(t),t.flags&=-16777217):(e=e.memoizedProps,e!==i&&ts(t),we(t),op(t,s,e,i,n)),null;case 27:if(mu(t),n=Xs.current,s=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&ts(t);else{if(!i){if(t.stateNode===null)throw Error(st(166));return we(t),null}e=Pi.current,pr(t)?Yv(t,e):(e=Eb(s,i,n),t.stateNode=e,ts(t))}return we(t),null;case 5:if(mu(t),s=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&ts(t);else{if(!i){if(t.stateNode===null)throw Error(st(166));return we(t),null}if(a=Pi.current,pr(t))Yv(t,a);else{var r=Pu(Xs.current);switch(a){case 1:a=r.createElementNS("http://www.w3.org/2000/svg",s);break;case 2:a=r.createElementNS("http://www.w3.org/1998/Math/MathML",s);break;default:switch(s){case"svg":a=r.createElementNS("http://www.w3.org/2000/svg",s);break;case"math":a=r.createElementNS("http://www.w3.org/1998/Math/MathML",s);break;case"script":a=r.createElement("div"),a.innerHTML="<script><\/script>",a=a.removeChild(a.firstChild);break;case"select":a=typeof i.is=="string"?r.createElement("select",{is:i.is}):r.createElement("select"),i.multiple?a.multiple=!0:i.size&&(a.size=i.size);break;default:a=typeof i.is=="string"?r.createElement(s,{is:i.is}):r.createElement(s)}}a[hn]=t,a[In]=i;t:for(r=t.child;r!==null;){if(r.tag===5||r.tag===6)a.appendChild(r.stateNode);else if(r.tag!==4&&r.tag!==27&&r.child!==null){r.child.return=r,r=r.child;continue}if(r===t)break t;for(;r.sibling===null;){if(r.return===null||r.return===t)break t;r=r.return}r.sibling.return=r.return,r=r.sibling}t.stateNode=a;t:switch(pn(a,s,i),s){case"button":case"input":case"select":case"textarea":i=!!i.autoFocus;break t;case"img":i=!0;break t;default:i=!1}i&&ts(t)}}return we(t),op(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,n),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==i&&ts(t);else{if(typeof i!="string"&&t.stateNode===null)throw Error(st(166));if(e=Xs.current,pr(t)){if(e=t.stateNode,n=t.memoizedProps,i=null,s=fn,s!==null)switch(s.tag){case 27:case 5:i=s.memoizedProps}e[hn]=t,e=!!(e.nodeValue===n||i!==null&&i.suppressHydrationWarning===!0||xb(e.nodeValue,n)),e||ta(t,!0)}else e=Pu(e).createTextNode(i),e[hn]=t,t.stateNode=e}return we(t),null;case 31:if(n=t.memoizedState,e===null||e.memoizedState!==null){if(i=pr(t),n!==null){if(e===null){if(!i)throw Error(st(318));if(e=t.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(st(557));e[hn]=t}else Pa(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;we(t),e=!1}else n=Qd(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=n),e=!0;if(!e)return t.flags&256?(Vn(t),t):(Vn(t),null);if((t.flags&128)!==0)throw Error(st(558))}return we(t),null;case 13:if(i=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(s=pr(t),i!==null&&i.dehydrated!==null){if(e===null){if(!s)throw Error(st(318));if(s=t.memoizedState,s=s!==null?s.dehydrated:null,!s)throw Error(st(317));s[hn]=t}else Pa(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;we(t),s=!1}else s=Qd(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=s),s=!0;if(!s)return t.flags&256?(Vn(t),t):(Vn(t),null)}return Vn(t),(t.flags&128)!==0?(t.lanes=n,t):(n=i!==null,e=e!==null&&e.memoizedState!==null,n&&(i=t.child,s=null,i.alternate!==null&&i.alternate.memoizedState!==null&&i.alternate.memoizedState.cachePool!==null&&(s=i.alternate.memoizedState.cachePool.pool),a=null,i.memoizedState!==null&&i.memoizedState.cachePool!==null&&(a=i.memoizedState.cachePool.pool),a!==s&&(i.flags|=2048)),n!==e&&n&&(t.child.flags|=8192),Wc(t,t.updateQueue),we(t),null);case 4:return zr(),e===null&&ng(t.stateNode.containerInfo),we(t),null;case 10:return us(t.type),we(t),null;case 19:if(on(ke),i=t.memoizedState,i===null)return we(t),null;if(s=(t.flags&128)!==0,a=i.rendering,a===null)if(s)Po(i,!1);else{if(Fe!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(a=Eu(e),a!==null){for(t.flags|=128,Po(i,!1),e=a.updateQueue,t.updateQueue=e,Wc(t,e),t.subtreeFlags=0,e=n,n=t.child;n!==null;)Oy(n,e),n=n.sibling;return Ee(ke,ke.current&1|2),re&&ss(t,i.treeForkCount),t.child}e=e.sibling}i.tail!==null&&kn()>Du&&(t.flags|=128,s=!0,Po(i,!1),t.lanes=4194304)}else{if(!s)if(e=Eu(a),e!==null){if(t.flags|=128,s=!0,e=e.updateQueue,t.updateQueue=e,Wc(t,e),Po(i,!0),i.tail===null&&i.tailMode==="hidden"&&!a.alternate&&!re)return we(t),null}else 2*kn()-i.renderingStartTime>Du&&n!==536870912&&(t.flags|=128,s=!0,Po(i,!1),t.lanes=4194304);i.isBackwards?(a.sibling=t.child,t.child=a):(e=i.last,e!==null?e.sibling=a:t.child=a,i.last=a)}return i.tail!==null?(e=i.tail,i.rendering=e,i.tail=e.sibling,i.renderingStartTime=kn(),e.sibling=null,n=ke.current,Ee(ke,s?n&1|2:n&1),re&&ss(t,i.treeForkCount),e):(we(t),null);case 22:case 23:return Vn(t),Im(),i=t.memoizedState!==null,e!==null?e.memoizedState!==null!==i&&(t.flags|=8192):i&&(t.flags|=8192),i?(n&536870912)!==0&&(t.flags&128)===0&&(we(t),t.subtreeFlags&6&&(t.flags|=8192)):we(t),n=t.updateQueue,n!==null&&Wc(t,n.retryQueue),n=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),i=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(i=t.memoizedState.cachePool.pool),i!==n&&(t.flags|=2048),e!==null&&on(La),null;case 24:return n=null,e!==null&&(n=e.memoizedState.cache),t.memoizedState.cache!==n&&(t.flags|=2048),us(Ze),we(t),null;case 25:return null;case 30:return null}throw Error(st(156,t.tag))}function HE(e,t){switch(Rm(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return us(Ze),zr(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return mu(t),null;case 31:if(t.memoizedState!==null){if(Vn(t),t.alternate===null)throw Error(st(340));Pa()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(Vn(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(st(340));Pa()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return on(ke),null;case 4:return zr(),null;case 10:return us(t.type),null;case 22:case 23:return Vn(t),Im(),e!==null&&on(La),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return us(Ze),null;case 25:return null;default:return null}}function Ox(e,t){switch(Rm(t),t.tag){case 3:us(Ze),zr();break;case 26:case 27:case 5:mu(t);break;case 4:zr();break;case 31:t.memoizedState!==null&&Vn(t);break;case 13:Vn(t);break;case 19:on(ke);break;case 10:us(t.type);break;case 22:case 23:Vn(t),Im(),e!==null&&on(La);break;case 24:us(Ze)}}function Al(e,t){try{var n=t.updateQueue,i=n!==null?n.lastEffect:null;if(i!==null){var s=i.next;n=s;do{if((n.tag&e)===e){i=void 0;var a=n.create,r=n.inst;i=a(),r.destroy=i}n=n.next}while(n!==s)}}catch(o){ge(t,t.return,o)}}function ea(e,t,n){try{var i=t.updateQueue,s=i!==null?i.lastEffect:null;if(s!==null){var a=s.next;i=a;do{if((i.tag&e)===e){var r=i.inst,o=r.destroy;if(o!==void 0){r.destroy=void 0,s=t;var c=n,l=o;try{l()}catch(h){ge(s,c,h)}}}i=i.next}while(i!==a)}}catch(h){ge(t,t.return,h)}}function Px(e){var t=e.updateQueue;if(t!==null){var n=e.stateNode;try{Wy(t,n)}catch(i){ge(e,e.return,i)}}}function zx(e,t,n){n.props=Va(e.type,e.memoizedProps),n.state=e.memoizedState;try{n.componentWillUnmount()}catch(i){ge(e,t,i)}}function $o(e,t){try{var n=e.ref;if(n!==null){switch(e.tag){case 26:case 27:case 5:var i=e.stateNode;break;case 30:i=e.stateNode;break;default:i=e.stateNode}typeof n=="function"?e.refCleanup=n(i):n.current=i}}catch(s){ge(e,t,s)}}function Oi(e,t){var n=e.ref,i=e.refCleanup;if(n!==null)if(typeof i=="function")try{i()}catch(s){ge(e,t,s)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof n=="function")try{n(null)}catch(s){ge(e,t,s)}else n.current=null}function Bx(e){var t=e.type,n=e.memoizedProps,i=e.stateNode;try{t:switch(t){case"button":case"input":case"select":case"textarea":n.autoFocus&&i.focus();break t;case"img":n.src?i.src=n.src:n.srcSet&&(i.srcset=n.srcSet)}}catch(s){ge(e,e.return,s)}}function lp(e,t,n){try{var i=e.stateNode;oT(i,e.type,n,t),i[In]=t}catch(s){ge(e,e.return,s)}}function Fx(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&sa(e.type)||e.tag===4}function cp(e){t:for(;;){for(;e.sibling===null;){if(e.return===null||Fx(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&sa(e.type)||e.flags&2||e.child===null||e.tag===4)continue t;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function jp(e,t,n){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?(n.nodeType===9?n.body:n.nodeName==="HTML"?n.ownerDocument.body:n).insertBefore(e,t):(t=n.nodeType===9?n.body:n.nodeName==="HTML"?n.ownerDocument.body:n,t.appendChild(e),n=n._reactRootContainer,n!=null||t.onclick!==null||(t.onclick=os));else if(i!==4&&(i===27&&sa(e.type)&&(n=e.stateNode,t=null),e=e.child,e!==null))for(jp(e,t,n),e=e.sibling;e!==null;)jp(e,t,n),e=e.sibling}function Ru(e,t,n){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?n.insertBefore(e,t):n.appendChild(e);else if(i!==4&&(i===27&&sa(e.type)&&(n=e.stateNode),e=e.child,e!==null))for(Ru(e,t,n),e=e.sibling;e!==null;)Ru(e,t,n),e=e.sibling}function Vx(e){var t=e.stateNode,n=e.memoizedProps;try{for(var i=e.type,s=t.attributes;s.length;)t.removeAttributeNode(s[0]);pn(t,i,n),t[hn]=e,t[In]=n}catch(a){ge(e,e.return,a)}}var as=!1,Ye=!1,up=!1,y_=typeof WeakSet=="function"?WeakSet:Set,an=null;function GE(e,t){if(e=e.containerInfo,sm=Vu,e=wy(e),Em(e)){if("selectionStart"in e)var n={start:e.selectionStart,end:e.selectionEnd};else t:{n=(n=e.ownerDocument)&&n.defaultView||window;var i=n.getSelection&&n.getSelection();if(i&&i.rangeCount!==0){n=i.anchorNode;var s=i.anchorOffset,a=i.focusNode;i=i.focusOffset;try{n.nodeType,a.nodeType}catch{n=null;break t}var r=0,o=-1,c=-1,l=0,h=0,d=e,u=null;e:for(;;){for(var p;d!==n||s!==0&&d.nodeType!==3||(o=r+s),d!==a||i!==0&&d.nodeType!==3||(c=r+i),d.nodeType===3&&(r+=d.nodeValue.length),(p=d.firstChild)!==null;)u=d,d=p;for(;;){if(d===e)break e;if(u===n&&++l===s&&(o=r),u===a&&++h===i&&(c=r),(p=d.nextSibling)!==null)break;d=u,u=d.parentNode}d=p}n=o===-1||c===-1?null:{start:o,end:c}}else n=null}n=n||{start:0,end:0}}else n=null;for(am={focusedElem:e,selectionRange:n},Vu=!1,an=t;an!==null;)if(t=an,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,an=e;else for(;an!==null;){switch(t=an,a=t.alternate,e=t.flags,t.tag){case 0:if((e&4)!==0&&(e=t.updateQueue,e=e!==null?e.events:null,e!==null))for(n=0;n<e.length;n++)s=e[n],s.ref.impl=s.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&a!==null){e=void 0,n=t,s=a.memoizedProps,a=a.memoizedState,i=n.stateNode;try{var m=Va(n.type,s);e=i.getSnapshotBeforeUpdate(m,a),i.__reactInternalSnapshotBeforeUpdate=e}catch(S){ge(n,n.return,S)}}break;case 3:if((e&1024)!==0){if(e=t.stateNode.containerInfo,n=e.nodeType,n===9)om(e);else if(n===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":om(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error(st(163))}if(e=t.sibling,e!==null){e.return=t.return,an=e;break}an=t.return}}function Hx(e,t,n){var i=n.flags;switch(n.tag){case 0:case 11:case 15:ns(e,n),i&4&&Al(5,n);break;case 1:if(ns(e,n),i&4)if(e=n.stateNode,t===null)try{e.componentDidMount()}catch(r){ge(n,n.return,r)}else{var s=Va(n.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(s,t,e.__reactInternalSnapshotBeforeUpdate)}catch(r){ge(n,n.return,r)}}i&64&&Px(n),i&512&&$o(n,n.return);break;case 3:if(ns(e,n),i&64&&(e=n.updateQueue,e!==null)){if(t=null,n.child!==null)switch(n.child.tag){case 27:case 5:t=n.child.stateNode;break;case 1:t=n.child.stateNode}try{Wy(e,t)}catch(r){ge(n,n.return,r)}}break;case 27:t===null&&i&4&&Vx(n);case 26:case 5:ns(e,n),t===null&&i&4&&Bx(n),i&512&&$o(n,n.return);break;case 12:ns(e,n);break;case 31:ns(e,n),i&4&&Xx(e,n);break;case 13:ns(e,n),i&4&&Wx(e,n),i&64&&(e=n.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(n=jE.bind(null,n),mT(e,n))));break;case 22:if(i=n.memoizedState!==null||as,!i){t=t!==null&&t.memoizedState!==null||Ye,s=as;var a=Ye;as=i,(Ye=t)&&!a?is(e,n,(n.subtreeFlags&8772)!==0):ns(e,n),as=s,Ye=a}break;case 30:break;default:ns(e,n)}}function Gx(e){var t=e.alternate;t!==null&&(e.alternate=null,Gx(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&_m(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var Ue=null,Nn=!1;function es(e,t,n){for(n=n.child;n!==null;)kx(e,t,n),n=n.sibling}function kx(e,t,n){if(Xn&&typeof Xn.onCommitFiberUnmount=="function")try{Xn.onCommitFiberUnmount(yl,n)}catch{}switch(n.tag){case 26:Ye||Oi(n,t),es(e,t,n),n.memoizedState?n.memoizedState.count--:n.stateNode&&(n=n.stateNode,n.parentNode.removeChild(n));break;case 27:Ye||Oi(n,t);var i=Ue,s=Nn;sa(n.type)&&(Ue=n.stateNode,Nn=!1),es(e,t,n),il(n.stateNode),Ue=i,Nn=s;break;case 5:Ye||Oi(n,t);case 6:if(i=Ue,s=Nn,Ue=null,es(e,t,n),Ue=i,Nn=s,Ue!==null)if(Nn)try{(Ue.nodeType===9?Ue.body:Ue.nodeName==="HTML"?Ue.ownerDocument.body:Ue).removeChild(n.stateNode)}catch(a){ge(n,t,a)}else try{Ue.removeChild(n.stateNode)}catch(a){ge(n,t,a)}break;case 18:Ue!==null&&(Nn?(e=Ue,I_(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,n.stateNode),Yr(e)):I_(Ue,n.stateNode));break;case 4:i=Ue,s=Nn,Ue=n.stateNode.containerInfo,Nn=!0,es(e,t,n),Ue=i,Nn=s;break;case 0:case 11:case 14:case 15:ea(2,n,t),Ye||ea(4,n,t),es(e,t,n);break;case 1:Ye||(Oi(n,t),i=n.stateNode,typeof i.componentWillUnmount=="function"&&zx(n,t,i)),es(e,t,n);break;case 21:es(e,t,n);break;case 22:Ye=(i=Ye)||n.memoizedState!==null,es(e,t,n),Ye=i;break;default:es(e,t,n)}}function Xx(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Yr(e)}catch(n){ge(t,t.return,n)}}}function Wx(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Yr(e)}catch(n){ge(t,t.return,n)}}function kE(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new y_),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new y_),t;default:throw Error(st(435,e.tag))}}function qc(e,t){var n=kE(e);t.forEach(function(i){if(!n.has(i)){n.add(i);var s=QE.bind(null,e,i);i.then(s,s)}})}function Rn(e,t){var n=t.deletions;if(n!==null)for(var i=0;i<n.length;i++){var s=n[i],a=e,r=t,o=r;t:for(;o!==null;){switch(o.tag){case 27:if(sa(o.type)){Ue=o.stateNode,Nn=!1;break t}break;case 5:Ue=o.stateNode,Nn=!1;break t;case 3:case 4:Ue=o.stateNode.containerInfo,Nn=!0;break t}o=o.return}if(Ue===null)throw Error(st(160));kx(a,r,s),Ue=null,Nn=!1,a=s.alternate,a!==null&&(a.return=null),s.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)qx(t,e),t=t.sibling}var bi=null;function qx(e,t){var n=e.alternate,i=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:Rn(t,e),Dn(e),i&4&&(ea(3,e,e.return),Al(3,e),ea(5,e,e.return));break;case 1:Rn(t,e),Dn(e),i&512&&(Ye||n===null||Oi(n,n.return)),i&64&&as&&(e=e.updateQueue,e!==null&&(i=e.callbacks,i!==null&&(n=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=n===null?i:n.concat(i))));break;case 26:var s=bi;if(Rn(t,e),Dn(e),i&512&&(Ye||n===null||Oi(n,n.return)),i&4){var a=n!==null?n.memoizedState:null;if(i=e.memoizedState,n===null)if(i===null)if(e.stateNode===null){t:{i=e.type,n=e.memoizedProps,s=s.ownerDocument||s;e:switch(i){case"title":a=s.getElementsByTagName("title")[0],(!a||a[Sl]||a[hn]||a.namespaceURI==="http://www.w3.org/2000/svg"||a.hasAttribute("itemprop"))&&(a=s.createElement(i),s.head.insertBefore(a,s.querySelector("head > title"))),pn(a,i,n),a[hn]=e,rn(a),i=a;break t;case"link":var r=H_("link","href",s).get(i+(n.href||""));if(r){for(var o=0;o<r.length;o++)if(a=r[o],a.getAttribute("href")===(n.href==null||n.href===""?null:n.href)&&a.getAttribute("rel")===(n.rel==null?null:n.rel)&&a.getAttribute("title")===(n.title==null?null:n.title)&&a.getAttribute("crossorigin")===(n.crossOrigin==null?null:n.crossOrigin)){r.splice(o,1);break e}}a=s.createElement(i),pn(a,i,n),s.head.appendChild(a);break;case"meta":if(r=H_("meta","content",s).get(i+(n.content||""))){for(o=0;o<r.length;o++)if(a=r[o],a.getAttribute("content")===(n.content==null?null:""+n.content)&&a.getAttribute("name")===(n.name==null?null:n.name)&&a.getAttribute("property")===(n.property==null?null:n.property)&&a.getAttribute("http-equiv")===(n.httpEquiv==null?null:n.httpEquiv)&&a.getAttribute("charset")===(n.charSet==null?null:n.charSet)){r.splice(o,1);break e}}a=s.createElement(i),pn(a,i,n),s.head.appendChild(a);break;default:throw Error(st(468,i))}a[hn]=e,rn(a),i=a}e.stateNode=i}else G_(s,e.type,e.stateNode);else e.stateNode=V_(s,i,e.memoizedProps);else a!==i?(a===null?n.stateNode!==null&&(n=n.stateNode,n.parentNode.removeChild(n)):a.count--,i===null?G_(s,e.type,e.stateNode):V_(s,i,e.memoizedProps)):i===null&&e.stateNode!==null&&lp(e,e.memoizedProps,n.memoizedProps)}break;case 27:Rn(t,e),Dn(e),i&512&&(Ye||n===null||Oi(n,n.return)),n!==null&&i&4&&lp(e,e.memoizedProps,n.memoizedProps);break;case 5:if(Rn(t,e),Dn(e),i&512&&(Ye||n===null||Oi(n,n.return)),e.flags&32){s=e.stateNode;try{Fr(s,"")}catch(m){ge(e,e.return,m)}}i&4&&e.stateNode!=null&&(s=e.memoizedProps,lp(e,s,n!==null?n.memoizedProps:s)),i&1024&&(up=!0);break;case 6:if(Rn(t,e),Dn(e),i&4){if(e.stateNode===null)throw Error(st(162));i=e.memoizedProps,n=e.stateNode;try{n.nodeValue=i}catch(m){ge(e,e.return,m)}}break;case 3:if(uu=null,s=bi,bi=zu(t.containerInfo),Rn(t,e),bi=s,Dn(e),i&4&&n!==null&&n.memoizedState.isDehydrated)try{Yr(t.containerInfo)}catch(m){ge(e,e.return,m)}up&&(up=!1,Yx(e));break;case 4:i=bi,bi=zu(e.stateNode.containerInfo),Rn(t,e),Dn(e),bi=i;break;case 12:Rn(t,e),Dn(e);break;case 31:Rn(t,e),Dn(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,qc(e,i)));break;case 13:Rn(t,e),Dn(e),e.child.flags&8192&&e.memoizedState!==null!=(n!==null&&n.memoizedState!==null)&&($u=kn()),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,qc(e,i)));break;case 22:s=e.memoizedState!==null;var c=n!==null&&n.memoizedState!==null,l=as,h=Ye;if(as=l||s,Ye=h||c,Rn(t,e),Ye=h,as=l,Dn(e),i&8192)t:for(t=e.stateNode,t._visibility=s?t._visibility&-2:t._visibility|1,s&&(n===null||c||as||Ye||Da(e)),n=null,t=e;;){if(t.tag===5||t.tag===26){if(n===null){c=n=t;try{if(a=c.stateNode,s)r=a.style,typeof r.setProperty=="function"?r.setProperty("display","none","important"):r.display="none";else{o=c.stateNode;var d=c.memoizedProps.style,u=d!=null&&d.hasOwnProperty("display")?d.display:null;o.style.display=u==null||typeof u=="boolean"?"":(""+u).trim()}}catch(m){ge(c,c.return,m)}}}else if(t.tag===6){if(n===null){c=t;try{c.stateNode.nodeValue=s?"":c.memoizedProps}catch(m){ge(c,c.return,m)}}}else if(t.tag===18){if(n===null){c=t;try{var p=c.stateNode;s?O_(p,!0):O_(c.stateNode,!1)}catch(m){ge(c,c.return,m)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break t;for(;t.sibling===null;){if(t.return===null||t.return===e)break t;n===t&&(n=null),t=t.return}n===t&&(n=null),t.sibling.return=t.return,t=t.sibling}i&4&&(i=e.updateQueue,i!==null&&(n=i.retryQueue,n!==null&&(i.retryQueue=null,qc(e,n))));break;case 19:Rn(t,e),Dn(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,qc(e,i)));break;case 30:break;case 21:break;default:Rn(t,e),Dn(e)}}function Dn(e){var t=e.flags;if(t&2){try{for(var n,i=e.return;i!==null;){if(Fx(i)){n=i;break}i=i.return}if(n==null)throw Error(st(160));switch(n.tag){case 27:var s=n.stateNode,a=cp(e);Ru(e,a,s);break;case 5:var r=n.stateNode;n.flags&32&&(Fr(r,""),n.flags&=-33);var o=cp(e);Ru(e,o,r);break;case 3:case 4:var c=n.stateNode.containerInfo,l=cp(e);jp(e,l,c);break;default:throw Error(st(161))}}catch(h){ge(e,e.return,h)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function Yx(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;Yx(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function ns(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)Hx(e,t.alternate,t),t=t.sibling}function Da(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:ea(4,t,t.return),Da(t);break;case 1:Oi(t,t.return);var n=t.stateNode;typeof n.componentWillUnmount=="function"&&zx(t,t.return,n),Da(t);break;case 27:il(t.stateNode);case 26:case 5:Oi(t,t.return),Da(t);break;case 22:t.memoizedState===null&&Da(t);break;case 30:Da(t);break;default:Da(t)}e=e.sibling}}function is(e,t,n){for(n=n&&(t.subtreeFlags&8772)!==0,t=t.child;t!==null;){var i=t.alternate,s=e,a=t,r=a.flags;switch(a.tag){case 0:case 11:case 15:is(s,a,n),Al(4,a);break;case 1:if(is(s,a,n),i=a,s=i.stateNode,typeof s.componentDidMount=="function")try{s.componentDidMount()}catch(l){ge(i,i.return,l)}if(i=a,s=i.updateQueue,s!==null){var o=i.stateNode;try{var c=s.shared.hiddenCallbacks;if(c!==null)for(s.shared.hiddenCallbacks=null,s=0;s<c.length;s++)Xy(c[s],o)}catch(l){ge(i,i.return,l)}}n&&r&64&&Px(a),$o(a,a.return);break;case 27:Vx(a);case 26:case 5:is(s,a,n),n&&i===null&&r&4&&Bx(a),$o(a,a.return);break;case 12:is(s,a,n);break;case 31:is(s,a,n),n&&r&4&&Xx(s,a);break;case 13:is(s,a,n),n&&r&4&&Wx(s,a);break;case 22:a.memoizedState===null&&is(s,a,n),$o(a,a.return);break;case 30:break;default:is(s,a,n)}t=t.sibling}}function Km(e,t){var n=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==n&&(e!=null&&e.refCount++,n!=null&&El(n))}function jm(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&El(e))}function xi(e,t,n,i){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)Zx(e,t,n,i),t=t.sibling}function Zx(e,t,n,i){var s=t.flags;switch(t.tag){case 0:case 11:case 15:xi(e,t,n,i),s&2048&&Al(9,t);break;case 1:xi(e,t,n,i);break;case 3:xi(e,t,n,i),s&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&El(e)));break;case 12:if(s&2048){xi(e,t,n,i),e=t.stateNode;try{var a=t.memoizedProps,r=a.id,o=a.onPostCommit;typeof o=="function"&&o(r,t.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(c){ge(t,t.return,c)}}else xi(e,t,n,i);break;case 31:xi(e,t,n,i);break;case 13:xi(e,t,n,i);break;case 23:break;case 22:a=t.stateNode,r=t.alternate,t.memoizedState!==null?a._visibility&2?xi(e,t,n,i):tl(e,t):a._visibility&2?xi(e,t,n,i):(a._visibility|=2,gr(e,t,n,i,(t.subtreeFlags&10256)!==0||!1)),s&2048&&Km(r,t);break;case 24:xi(e,t,n,i),s&2048&&jm(t.alternate,t);break;default:xi(e,t,n,i)}}function gr(e,t,n,i,s){for(s=s&&((t.subtreeFlags&10256)!==0||!1),t=t.child;t!==null;){var a=e,r=t,o=n,c=i,l=r.flags;switch(r.tag){case 0:case 11:case 15:gr(a,r,o,c,s),Al(8,r);break;case 23:break;case 22:var h=r.stateNode;r.memoizedState!==null?h._visibility&2?gr(a,r,o,c,s):tl(a,r):(h._visibility|=2,gr(a,r,o,c,s)),s&&l&2048&&Km(r.alternate,r);break;case 24:gr(a,r,o,c,s),s&&l&2048&&jm(r.alternate,r);break;default:gr(a,r,o,c,s)}t=t.sibling}}function tl(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var n=e,i=t,s=i.flags;switch(i.tag){case 22:tl(n,i),s&2048&&Km(i.alternate,i);break;case 24:tl(n,i),s&2048&&jm(i.alternate,i);break;default:tl(n,i)}t=t.sibling}}var Xo=8192;function mr(e,t,n){if(e.subtreeFlags&Xo)for(e=e.child;e!==null;)Jx(e,t,n),e=e.sibling}function Jx(e,t,n){switch(e.tag){case 26:mr(e,t,n),e.flags&Xo&&e.memoizedState!==null&&wT(n,bi,e.memoizedState,e.memoizedProps);break;case 5:mr(e,t,n);break;case 3:case 4:var i=bi;bi=zu(e.stateNode.containerInfo),mr(e,t,n),bi=i;break;case 22:e.memoizedState===null&&(i=e.alternate,i!==null&&i.memoizedState!==null?(i=Xo,Xo=16777216,mr(e,t,n),Xo=i):mr(e,t,n));break;default:mr(e,t,n)}}function Kx(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function zo(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var n=0;n<t.length;n++){var i=t[n];an=i,Qx(i,e)}Kx(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)jx(e),e=e.sibling}function jx(e){switch(e.tag){case 0:case 11:case 15:zo(e),e.flags&2048&&ea(9,e,e.return);break;case 3:zo(e);break;case 12:zo(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,lu(e)):zo(e);break;default:zo(e)}}function lu(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var n=0;n<t.length;n++){var i=t[n];an=i,Qx(i,e)}Kx(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:ea(8,t,t.return),lu(t);break;case 22:n=t.stateNode,n._visibility&2&&(n._visibility&=-3,lu(t));break;default:lu(t)}e=e.sibling}}function Qx(e,t){for(;an!==null;){var n=an;switch(n.tag){case 0:case 11:case 15:ea(8,n,t);break;case 23:case 22:if(n.memoizedState!==null&&n.memoizedState.cachePool!==null){var i=n.memoizedState.cachePool.pool;i!=null&&i.refCount++}break;case 24:El(n.memoizedState.cache)}if(i=n.child,i!==null)i.return=n,an=i;else t:for(n=e;an!==null;){i=an;var s=i.sibling,a=i.return;if(Gx(i),i===n){an=null;break t}if(s!==null){s.return=a,an=s;break t}an=a}}}var XE={getCacheForType:function(e){var t=dn(Ze),n=t.data.get(e);return n===void 0&&(n=e(),t.data.set(e,n)),n},cacheSignal:function(){return dn(Ze).controller.signal}},WE=typeof WeakMap=="function"?WeakMap:Map,ue=0,Se=null,Qt=null,ee=0,me=0,Fn=null,Hs=!1,Qr=!1,Qm=!1,gs=0,Fe=0,na=0,Oa=0,$m=0,Gn=0,kr=0,el=null,Un=null,Qp=!1,$u=0,$x=0,Du=1/0,Nu=null,Zs=null,Qe=0,Js=null,Xr=null,hs=0,$p=0,tm=null,tb=null,nl=0,em=null;function qn(){return(ue&2)!==0&&ee!==0?ee&-ee:Bt.T!==null?eg():cy()}function eb(){if(Gn===0)if((ee&536870912)===0||re){var e=Pc;Pc<<=1,(Pc&3932160)===0&&(Pc=262144),Gn=e}else Gn=536870912;return e=Zn.current,e!==null&&(e.flags|=32),Gn}function Ln(e,t,n){(e===Se&&(me===2||me===9)||e.cancelPendingCommit!==null)&&(Wr(e,0),Gs(e,ee,Gn,!1)),bl(e,n),((ue&2)===0||e!==Se)&&(e===Se&&((ue&2)===0&&(Oa|=n),Fe===4&&Gs(e,ee,Gn,!1)),Bi(e))}function nb(e,t,n){if((ue&6)!==0)throw Error(st(327));var i=!n&&(t&127)===0&&(t&e.expiredLanes)===0||xl(e,t),s=i?ZE(e,t):hp(e,t,!0),a=i;do{if(s===0){Qr&&!i&&Gs(e,t,0,!1);break}else{if(n=e.current.alternate,a&&!qE(n)){s=hp(e,t,!1),a=!1;continue}if(s===2){if(a=t,e.errorRecoveryDisabledLanes&a)var r=0;else r=e.pendingLanes&-536870913,r=r!==0?r:r&536870912?536870912:0;if(r!==0){t=r;t:{var o=e;s=el;var c=o.current.memoizedState.isDehydrated;if(c&&(Wr(o,r).flags|=256),r=hp(o,r,!1),r!==2){if(Qm&&!c){o.errorRecoveryDisabledLanes|=a,Oa|=a,s=4;break t}a=Un,Un=s,a!==null&&(Un===null?Un=a:Un.push.apply(Un,a))}s=r}if(a=!1,s!==2)continue}}if(s===1){Wr(e,0),Gs(e,t,0,!0);break}t:{switch(i=e,a=s,a){case 0:case 1:throw Error(st(345));case 4:if((t&4194048)!==t)break;case 6:Gs(i,t,Gn,!Hs);break t;case 2:Un=null;break;case 3:case 5:break;default:throw Error(st(329))}if((t&62914560)===t&&(s=$u+300-kn(),10<s)){if(Gs(i,t,Gn,!Hs),Gu(i,0,!0)!==0)break t;hs=t,i.timeoutHandle=Sb(x_.bind(null,i,n,Un,Nu,Qp,t,Gn,Oa,kr,Hs,a,"Throttled",-0,0),s);break t}x_(i,n,Un,Nu,Qp,t,Gn,Oa,kr,Hs,a,null,-0,0)}}break}while(!0);Bi(e)}function x_(e,t,n,i,s,a,r,o,c,l,h,d,u,p){if(e.timeoutHandle=-1,d=t.subtreeFlags,d&8192||(d&16785408)===16785408){d={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:os},Jx(t,a,d);var m=(a&62914560)===a?$u-kn():(a&4194048)===a?$x-kn():0;if(m=CT(d,m),m!==null){hs=a,e.cancelPendingCommit=m(S_.bind(null,e,t,a,n,i,s,r,o,c,h,d,null,u,p)),Gs(e,a,r,!l);return}}S_(e,t,a,n,i,s,r,o,c)}function qE(e){for(var t=e;;){var n=t.tag;if((n===0||n===11||n===15)&&t.flags&16384&&(n=t.updateQueue,n!==null&&(n=n.stores,n!==null)))for(var i=0;i<n.length;i++){var s=n[i],a=s.getSnapshot;s=s.value;try{if(!Yn(a(),s))return!1}catch{return!1}}if(n=t.child,t.subtreeFlags&16384&&n!==null)n.return=t,t=n;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function Gs(e,t,n,i){t&=~$m,t&=~Oa,e.suspendedLanes|=t,e.pingedLanes&=~t,i&&(e.warmLanes|=t),i=e.expirationTimes;for(var s=t;0<s;){var a=31-Wn(s),r=1<<a;i[a]=-1,s&=~r}n!==0&&ry(e,n,t)}function th(){return(ue&6)===0?(wl(0,!1),!1):!0}function tg(){if(Qt!==null){if(me===0)var e=Qt.return;else e=Qt,ls=Wa=null,Fm(e),Ir=null,ul=0,e=Qt;for(;e!==null;)Ox(e.alternate,e),e=e.return;Qt=null}}function Wr(e,t){var n=e.timeoutHandle;n!==-1&&(e.timeoutHandle=-1,uT(n)),n=e.cancelPendingCommit,n!==null&&(e.cancelPendingCommit=null,n()),hs=0,tg(),Se=e,Qt=n=cs(e.current,null),ee=t,me=0,Fn=null,Hs=!1,Qr=xl(e,t),Qm=!1,kr=Gn=$m=Oa=na=Fe=0,Un=el=null,Qp=!1,(t&8)!==0&&(t|=t&32);var i=e.entangledLanes;if(i!==0)for(e=e.entanglements,i&=t;0<i;){var s=31-Wn(i),a=1<<s;t|=e[s],i&=~a}return gs=t,qu(),n}function ib(e,t){Yt=null,Bt.H=fl,t===jr||t===Zu?(t=Qv(),me=3):t===Um?(t=Qv(),me=4):me=t===Zm?8:t!==null&&typeof t=="object"&&typeof t.then=="function"?6:1,Fn=t,Qt===null&&(Fe=1,wu(e,hi(t,e.current)))}function sb(){var e=Zn.current;return e===null?!0:(ee&4194048)===ee?di===null:(ee&62914560)===ee||(ee&536870912)!==0?e===di:!1}function ab(){var e=Bt.H;return Bt.H=fl,e===null?fl:e}function rb(){var e=Bt.A;return Bt.A=XE,e}function Uu(){Fe=4,Hs||(ee&4194048)!==ee&&Zn.current!==null||(Qr=!0),(na&134217727)===0&&(Oa&134217727)===0||Se===null||Gs(Se,ee,Gn,!1)}function hp(e,t,n){var i=ue;ue|=2;var s=ab(),a=rb();(Se!==e||ee!==t)&&(Nu=null,Wr(e,t)),t=!1;var r=Fe;t:do try{if(me!==0&&Qt!==null){var o=Qt,c=Fn;switch(me){case 8:tg(),r=6;break t;case 3:case 2:case 9:case 6:Zn.current===null&&(t=!0);var l=me;if(me=0,Fn=null,Rr(e,o,c,l),n&&Qr){r=0;break t}break;default:l=me,me=0,Fn=null,Rr(e,o,c,l)}}YE(),r=Fe;break}catch(h){ib(e,h)}while(!0);return t&&e.shellSuspendCounter++,ls=Wa=null,ue=i,Bt.H=s,Bt.A=a,Qt===null&&(Se=null,ee=0,qu()),r}function YE(){for(;Qt!==null;)ob(Qt)}function ZE(e,t){var n=ue;ue|=2;var i=ab(),s=rb();Se!==e||ee!==t?(Nu=null,Du=kn()+500,Wr(e,t)):Qr=xl(e,t);t:do try{if(me!==0&&Qt!==null){t=Qt;var a=Fn;e:switch(me){case 1:me=0,Fn=null,Rr(e,t,a,1);break;case 2:case 9:if(jv(a)){me=0,Fn=null,b_(t);break}t=function(){me!==2&&me!==9||Se!==e||(me=7),Bi(e)},a.then(t,t);break t;case 3:me=7;break t;case 4:me=5;break t;case 7:jv(a)?(me=0,Fn=null,b_(t)):(me=0,Fn=null,Rr(e,t,a,7));break;case 5:var r=null;switch(Qt.tag){case 26:r=Qt.memoizedState;case 5:case 27:var o=Qt;if(r?wb(r):o.stateNode.complete){me=0,Fn=null;var c=o.sibling;if(c!==null)Qt=c;else{var l=o.return;l!==null?(Qt=l,eh(l)):Qt=null}break e}}me=0,Fn=null,Rr(e,t,a,5);break;case 6:me=0,Fn=null,Rr(e,t,a,6);break;case 8:tg(),Fe=6;break t;default:throw Error(st(462))}}JE();break}catch(h){ib(e,h)}while(!0);return ls=Wa=null,Bt.H=i,Bt.A=s,ue=n,Qt!==null?0:(Se=null,ee=0,qu(),Fe)}function JE(){for(;Qt!==null&&!_1();)ob(Qt)}function ob(e){var t=Ix(e.alternate,e,gs);e.memoizedProps=e.pendingProps,t===null?eh(e):Qt=t}function b_(e){var t=e,n=t.alternate;switch(t.tag){case 15:case 0:t=p_(n,t,t.pendingProps,t.type,void 0,ee);break;case 11:t=p_(n,t,t.pendingProps,t.type.render,t.ref,ee);break;case 5:Fm(t);default:Ox(n,t),t=Qt=Oy(t,gs),t=Ix(n,t,gs)}e.memoizedProps=e.pendingProps,t===null?eh(e):Qt=t}function Rr(e,t,n,i){ls=Wa=null,Fm(t),Ir=null,ul=0;var s=t.return;try{if(zE(e,s,t,n,ee)){Fe=1,wu(e,hi(n,e.current)),Qt=null;return}}catch(a){if(s!==null)throw Qt=s,a;Fe=1,wu(e,hi(n,e.current)),Qt=null;return}t.flags&32768?(re||i===1?e=!0:Qr||(ee&536870912)!==0?e=!1:(Hs=e=!0,(i===2||i===9||i===3||i===6)&&(i=Zn.current,i!==null&&i.tag===13&&(i.flags|=16384))),lb(t,e)):eh(t)}function eh(e){var t=e;do{if((t.flags&32768)!==0){lb(t,Hs);return}e=t.return;var n=VE(t.alternate,t,gs);if(n!==null){Qt=n;return}if(t=t.sibling,t!==null){Qt=t;return}Qt=t=e}while(t!==null);Fe===0&&(Fe=5)}function lb(e,t){do{var n=HE(e.alternate,e);if(n!==null){n.flags&=32767,Qt=n;return}if(n=e.return,n!==null&&(n.flags|=32768,n.subtreeFlags=0,n.deletions=null),!t&&(e=e.sibling,e!==null)){Qt=e;return}Qt=e=n}while(e!==null);Fe=6,Qt=null}function S_(e,t,n,i,s,a,r,o,c){e.cancelPendingCommit=null;do nh();while(Qe!==0);if((ue&6)!==0)throw Error(st(327));if(t!==null){if(t===e.current)throw Error(st(177));if(a=t.lanes|t.childLanes,a|=Tm,C1(e,n,a,r,o,c),e===Se&&(Qt=Se=null,ee=0),Xr=t,Js=e,hs=n,$p=a,tm=s,tb=i,(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,$E(gu,function(){return db(),null})):(e.callbackNode=null,e.callbackPriority=0),i=(t.flags&13878)!==0,(t.subtreeFlags&13878)!==0||i){i=Bt.T,Bt.T=null,s=he.p,he.p=2,r=ue,ue|=4;try{GE(e,t,n)}finally{ue=r,he.p=s,Bt.T=i}}Qe=1,cb(),ub(),hb()}}function cb(){if(Qe===1){Qe=0;var e=Js,t=Xr,n=(t.flags&13878)!==0;if((t.subtreeFlags&13878)!==0||n){n=Bt.T,Bt.T=null;var i=he.p;he.p=2;var s=ue;ue|=4;try{qx(t,e);var a=am,r=wy(e.containerInfo),o=a.focusedElem,c=a.selectionRange;if(r!==o&&o&&o.ownerDocument&&Ay(o.ownerDocument.documentElement,o)){if(c!==null&&Em(o)){var l=c.start,h=c.end;if(h===void 0&&(h=l),"selectionStart"in o)o.selectionStart=l,o.selectionEnd=Math.min(h,o.value.length);else{var d=o.ownerDocument||document,u=d&&d.defaultView||window;if(u.getSelection){var p=u.getSelection(),m=o.textContent.length,S=Math.min(c.start,m),v=c.end===void 0?S:Math.min(c.end,m);!p.extend&&S>v&&(r=v,v=S,S=r);var f=Xv(o,S),g=Xv(o,v);if(f&&g&&(p.rangeCount!==1||p.anchorNode!==f.node||p.anchorOffset!==f.offset||p.focusNode!==g.node||p.focusOffset!==g.offset)){var y=d.createRange();y.setStart(f.node,f.offset),p.removeAllRanges(),S>v?(p.addRange(y),p.extend(g.node,g.offset)):(y.setEnd(g.node,g.offset),p.addRange(y))}}}}for(d=[],p=o;p=p.parentNode;)p.nodeType===1&&d.push({element:p,left:p.scrollLeft,top:p.scrollTop});for(typeof o.focus=="function"&&o.focus(),o=0;o<d.length;o++){var _=d[o];_.element.scrollLeft=_.left,_.element.scrollTop=_.top}}Vu=!!sm,am=sm=null}finally{ue=s,he.p=i,Bt.T=n}}e.current=t,Qe=2}}function ub(){if(Qe===2){Qe=0;var e=Js,t=Xr,n=(t.flags&8772)!==0;if((t.subtreeFlags&8772)!==0||n){n=Bt.T,Bt.T=null;var i=he.p;he.p=2;var s=ue;ue|=4;try{Hx(e,t.alternate,t)}finally{ue=s,he.p=i,Bt.T=n}}Qe=3}}function hb(){if(Qe===4||Qe===3){Qe=0,y1();var e=Js,t=Xr,n=hs,i=tb;(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?Qe=5:(Qe=0,Xr=Js=null,fb(e,e.pendingLanes));var s=e.pendingLanes;if(s===0&&(Zs=null),vm(n),t=t.stateNode,Xn&&typeof Xn.onCommitFiberRoot=="function")try{Xn.onCommitFiberRoot(yl,t,void 0,(t.current.flags&128)===128)}catch{}if(i!==null){t=Bt.T,s=he.p,he.p=2,Bt.T=null;try{for(var a=e.onRecoverableError,r=0;r<i.length;r++){var o=i[r];a(o.value,{componentStack:o.stack})}}finally{Bt.T=t,he.p=s}}(hs&3)!==0&&nh(),Bi(e),s=e.pendingLanes,(n&261930)!==0&&(s&42)!==0?e===em?nl++:(nl=0,em=e):nl=0,wl(0,!1)}}function fb(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,El(t)))}function nh(){return cb(),ub(),hb(),db()}function db(){if(Qe!==5)return!1;var e=Js,t=$p;$p=0;var n=vm(hs),i=Bt.T,s=he.p;try{he.p=32>n?32:n,Bt.T=null,n=tm,tm=null;var a=Js,r=hs;if(Qe=0,Xr=Js=null,hs=0,(ue&6)!==0)throw Error(st(331));var o=ue;if(ue|=4,jx(a.current),Zx(a,a.current,r,n),ue=o,wl(0,!1),Xn&&typeof Xn.onPostCommitFiberRoot=="function")try{Xn.onPostCommitFiberRoot(yl,a)}catch{}return!0}finally{he.p=s,Bt.T=i,fb(e,t)}}function M_(e,t,n){t=hi(n,t),t=Zp(e.stateNode,t,2),e=Ys(e,t,2),e!==null&&(bl(e,2),Bi(e))}function ge(e,t,n){if(e.tag===3)M_(e,e,n);else for(;t!==null;){if(t.tag===3){M_(t,e,n);break}else if(t.tag===1){var i=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(Zs===null||!Zs.has(i))){e=hi(n,e),n=Cx(2),i=Ys(t,n,2),i!==null&&(Rx(n,i,t,e),bl(i,2),Bi(i));break}}t=t.return}}function fp(e,t,n){var i=e.pingCache;if(i===null){i=e.pingCache=new WE;var s=new Set;i.set(t,s)}else s=i.get(t),s===void 0&&(s=new Set,i.set(t,s));s.has(n)||(Qm=!0,s.add(n),e=KE.bind(null,e,t,n),t.then(e,e))}function KE(e,t,n){var i=e.pingCache;i!==null&&i.delete(t),e.pingedLanes|=e.suspendedLanes&n,e.warmLanes&=~n,Se===e&&(ee&n)===n&&(Fe===4||Fe===3&&(ee&62914560)===ee&&300>kn()-$u?(ue&2)===0&&Wr(e,0):$m|=n,kr===ee&&(kr=0)),Bi(e)}function pb(e,t){t===0&&(t=ay()),e=Xa(e,t),e!==null&&(bl(e,t),Bi(e))}function jE(e){var t=e.memoizedState,n=0;t!==null&&(n=t.retryLane),pb(e,n)}function QE(e,t){var n=0;switch(e.tag){case 31:case 13:var i=e.stateNode,s=e.memoizedState;s!==null&&(n=s.retryLane);break;case 19:i=e.stateNode;break;case 22:i=e.stateNode._retryCache;break;default:throw Error(st(314))}i!==null&&i.delete(t),pb(e,n)}function $E(e,t){return mm(e,t)}var Lu=null,vr=null,nm=!1,Iu=!1,dp=!1,ks=0;function Bi(e){e!==vr&&e.next===null&&(vr===null?Lu=vr=e:vr=vr.next=e),Iu=!0,nm||(nm=!0,eT())}function wl(e,t){if(!dp&&Iu){dp=!0;do for(var n=!1,i=Lu;i!==null;){if(!t)if(e!==0){var s=i.pendingLanes;if(s===0)var a=0;else{var r=i.suspendedLanes,o=i.pingedLanes;a=(1<<31-Wn(42|e)+1)-1,a&=s&~(r&~o),a=a&201326741?a&201326741|1:a?a|2:0}a!==0&&(n=!0,E_(i,a))}else a=ee,a=Gu(i,i===Se?a:0,i.cancelPendingCommit!==null||i.timeoutHandle!==-1),(a&3)===0||xl(i,a)||(n=!0,E_(i,a));i=i.next}while(n);dp=!1}}function tT(){mb()}function mb(){Iu=nm=!1;var e=0;ks!==0&&cT()&&(e=ks);for(var t=kn(),n=null,i=Lu;i!==null;){var s=i.next,a=gb(i,t);a===0?(i.next=null,n===null?Lu=s:n.next=s,s===null&&(vr=n)):(n=i,(e!==0||(a&3)!==0)&&(Iu=!0)),i=s}Qe!==0&&Qe!==5||wl(e,!1),ks!==0&&(ks=0)}function gb(e,t){for(var n=e.suspendedLanes,i=e.pingedLanes,s=e.expirationTimes,a=e.pendingLanes&-62914561;0<a;){var r=31-Wn(a),o=1<<r,c=s[r];c===-1?((o&n)===0||(o&i)!==0)&&(s[r]=w1(o,t)):c<=t&&(e.expiredLanes|=o),a&=~o}if(t=Se,n=ee,n=Gu(e,e===t?n:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i=e.callbackNode,n===0||e===t&&(me===2||me===9)||e.cancelPendingCommit!==null)return i!==null&&i!==null&&Gd(i),e.callbackNode=null,e.callbackPriority=0;if((n&3)===0||xl(e,n)){if(t=n&-n,t===e.callbackPriority)return t;switch(i!==null&&Gd(i),vm(n)){case 2:case 8:n=iy;break;case 32:n=gu;break;case 268435456:n=sy;break;default:n=gu}return i=vb.bind(null,e),n=mm(n,i),e.callbackPriority=t,e.callbackNode=n,t}return i!==null&&i!==null&&Gd(i),e.callbackPriority=2,e.callbackNode=null,2}function vb(e,t){if(Qe!==0&&Qe!==5)return e.callbackNode=null,e.callbackPriority=0,null;var n=e.callbackNode;if(nh()&&e.callbackNode!==n)return null;var i=ee;return i=Gu(e,e===Se?i:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i===0?null:(nb(e,i,t),gb(e,kn()),e.callbackNode!=null&&e.callbackNode===n?vb.bind(null,e):null)}function E_(e,t){if(nh())return null;nb(e,t,!0)}function eT(){hT(function(){(ue&6)!==0?mm(ny,tT):mb()})}function eg(){if(ks===0){var e=Vr;e===0&&(e=Oc,Oc<<=1,(Oc&261888)===0&&(Oc=256)),ks=e}return ks}function T_(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:$c(""+e)}function A_(e,t){var n=t.ownerDocument.createElement("input");return n.name=t.name,n.value=t.value,e.id&&n.setAttribute("form",e.id),t.parentNode.insertBefore(n,t),e=new FormData(e),n.parentNode.removeChild(n),e}function nT(e,t,n,i,s){if(t==="submit"&&n&&n.stateNode===s){var a=T_((s[In]||null).action),r=i.submitter;r&&(t=(t=r[In]||null)?T_(t.formAction):r.getAttribute("formAction"),t!==null&&(a=t,r=null));var o=new ku("action","action",null,i,s);e.push({event:o,listeners:[{instance:null,listener:function(){if(i.defaultPrevented){if(ks!==0){var c=r?A_(s,r):new FormData(s);qp(n,{pending:!0,data:c,method:s.method,action:a},null,c)}}else typeof a=="function"&&(o.preventDefault(),c=r?A_(s,r):new FormData(s),qp(n,{pending:!0,data:c,method:s.method,action:a},a,c))},currentTarget:s}]})}}for(Yc=0;Yc<Ip.length;Yc++)Zc=Ip[Yc],w_=Zc.toLowerCase(),C_=Zc[0].toUpperCase()+Zc.slice(1),Si(w_,"on"+C_);var Zc,w_,C_,Yc;Si(Ry,"onAnimationEnd");Si(Dy,"onAnimationIteration");Si(Ny,"onAnimationStart");Si("dblclick","onDoubleClick");Si("focusin","onFocus");Si("focusout","onBlur");Si(xE,"onTransitionRun");Si(bE,"onTransitionStart");Si(SE,"onTransitionCancel");Si(Uy,"onTransitionEnd");Br("onMouseEnter",["mouseout","mouseover"]);Br("onMouseLeave",["mouseout","mouseover"]);Br("onPointerEnter",["pointerout","pointerover"]);Br("onPointerLeave",["pointerout","pointerover"]);Ha("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));Ha("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));Ha("onBeforeInput",["compositionend","keypress","textInput","paste"]);Ha("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));Ha("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));Ha("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var dl="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),iT=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(dl));function _b(e,t){t=(t&4)!==0;for(var n=0;n<e.length;n++){var i=e[n],s=i.event;i=i.listeners;t:{var a=void 0;if(t)for(var r=i.length-1;0<=r;r--){var o=i[r],c=o.instance,l=o.currentTarget;if(o=o.listener,c!==a&&s.isPropagationStopped())break t;a=o,s.currentTarget=l;try{a(s)}catch(h){_u(h)}s.currentTarget=null,a=c}else for(r=0;r<i.length;r++){if(o=i[r],c=o.instance,l=o.currentTarget,o=o.listener,c!==a&&s.isPropagationStopped())break t;a=o,s.currentTarget=l;try{a(s)}catch(h){_u(h)}s.currentTarget=null,a=c}}}}function jt(e,t){var n=t[Ap];n===void 0&&(n=t[Ap]=new Set);var i=e+"__bubble";n.has(i)||(yb(t,e,2,!1),n.add(i))}function pp(e,t,n){var i=0;t&&(i|=4),yb(n,e,i,t)}var Jc="_reactListening"+Math.random().toString(36).slice(2);function ng(e){if(!e[Jc]){e[Jc]=!0,uy.forEach(function(n){n!=="selectionchange"&&(iT.has(n)||pp(n,!1,e),pp(n,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[Jc]||(t[Jc]=!0,pp("selectionchange",!1,t))}}function yb(e,t,n,i){switch(Ub(t)){case 2:var s=NT;break;case 8:s=UT;break;default:s=rg}n=s.bind(null,t,n,e),s=void 0,!Np||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(s=!0),i?s!==void 0?e.addEventListener(t,n,{capture:!0,passive:s}):e.addEventListener(t,n,!0):s!==void 0?e.addEventListener(t,n,{passive:s}):e.addEventListener(t,n,!1)}function mp(e,t,n,i,s){var a=i;if((t&1)===0&&(t&2)===0&&i!==null)t:for(;;){if(i===null)return;var r=i.tag;if(r===3||r===4){var o=i.stateNode.containerInfo;if(o===s)break;if(r===4)for(r=i.return;r!==null;){var c=r.tag;if((c===3||c===4)&&r.stateNode.containerInfo===s)return;r=r.return}for(;o!==null;){if(r=xr(o),r===null)return;if(c=r.tag,c===5||c===6||c===26||c===27){i=a=r;continue t}o=o.parentNode}}i=i.return}_y(function(){var l=a,h=xm(n),d=[];t:{var u=Ly.get(e);if(u!==void 0){var p=ku,m=e;switch(e){case"keypress":if(eu(n)===0)break t;case"keydown":case"keyup":p=Q1;break;case"focusin":m="focus",p=Yd;break;case"focusout":m="blur",p=Yd;break;case"beforeblur":case"afterblur":p=Yd;break;case"click":if(n.button===2)break t;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":p=Ov;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":p=V1;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":p=eE;break;case Ry:case Dy:case Ny:p=k1;break;case Uy:p=iE;break;case"scroll":case"scrollend":p=B1;break;case"wheel":p=aE;break;case"copy":case"cut":case"paste":p=W1;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":p=zv;break;case"toggle":case"beforetoggle":p=oE}var S=(t&4)!==0,v=!S&&(e==="scroll"||e==="scrollend"),f=S?u!==null?u+"Capture":null:u;S=[];for(var g=l,y;g!==null;){var _=g;if(y=_.stateNode,_=_.tag,_!==5&&_!==26&&_!==27||y===null||f===null||(_=al(g,f),_!=null&&S.push(pl(g,_,y))),v)break;g=g.return}0<S.length&&(u=new p(u,m,null,n,h),d.push({event:u,listeners:S}))}}if((t&7)===0){t:{if(u=e==="mouseover"||e==="pointerover",p=e==="mouseout"||e==="pointerout",u&&n!==Dp&&(m=n.relatedTarget||n.fromElement)&&(xr(m)||m[Zr]))break t;if((p||u)&&(u=h.window===h?h:(u=h.ownerDocument)?u.defaultView||u.parentWindow:window,p?(m=n.relatedTarget||n.toElement,p=l,m=m?xr(m):null,m!==null&&(v=_l(m),S=m.tag,m!==v||S!==5&&S!==27&&S!==6)&&(m=null)):(p=null,m=l),p!==m)){if(S=Ov,_="onMouseLeave",f="onMouseEnter",g="mouse",(e==="pointerout"||e==="pointerover")&&(S=zv,_="onPointerLeave",f="onPointerEnter",g="pointer"),v=p==null?u:Go(p),y=m==null?u:Go(m),u=new S(_,g+"leave",p,n,h),u.target=v,u.relatedTarget=y,_=null,xr(h)===l&&(S=new S(f,g+"enter",m,n,h),S.target=y,S.relatedTarget=v,_=S),v=_,p&&m)e:{for(S=sT,f=p,g=m,y=0,_=f;_;_=S(_))y++;_=0;for(var T=g;T;T=S(T))_++;for(;0<y-_;)f=S(f),y--;for(;0<_-y;)g=S(g),_--;for(;y--;){if(f===g||g!==null&&f===g.alternate){S=f;break e}f=S(f),g=S(g)}S=null}else S=null;p!==null&&R_(d,u,p,S,!1),m!==null&&v!==null&&R_(d,v,m,S,!0)}}t:{if(u=l?Go(l):window,p=u.nodeName&&u.nodeName.toLowerCase(),p==="select"||p==="input"&&u.type==="file")var A=Hv;else if(Vv(u))if(Ey)A=vE;else{A=mE;var w=pE}else p=u.nodeName,!p||p.toLowerCase()!=="input"||u.type!=="checkbox"&&u.type!=="radio"?l&&ym(l.elementType)&&(A=Hv):A=gE;if(A&&(A=A(e,l))){My(d,A,n,h);break t}w&&w(e,u,l),e==="focusout"&&l&&u.type==="number"&&l.memoizedProps.value!=null&&Rp(u,"number",u.value)}switch(w=l?Go(l):window,e){case"focusin":(Vv(w)||w.contentEditable==="true")&&(Mr=w,Up=l,Yo=null);break;case"focusout":Yo=Up=Mr=null;break;case"mousedown":Lp=!0;break;case"contextmenu":case"mouseup":case"dragend":Lp=!1,Wv(d,n,h);break;case"selectionchange":if(yE)break;case"keydown":case"keyup":Wv(d,n,h)}var x;if(Mm)t:{switch(e){case"compositionstart":var M="onCompositionStart";break t;case"compositionend":M="onCompositionEnd";break t;case"compositionupdate":M="onCompositionUpdate";break t}M=void 0}else Sr?by(e,n)&&(M="onCompositionEnd"):e==="keydown"&&n.keyCode===229&&(M="onCompositionStart");M&&(xy&&n.locale!=="ko"&&(Sr||M!=="onCompositionStart"?M==="onCompositionEnd"&&Sr&&(x=yy()):(Vs=h,bm="value"in Vs?Vs.value:Vs.textContent,Sr=!0)),w=Ou(l,M),0<w.length&&(M=new Pv(M,e,null,n,h),d.push({event:M,listeners:w}),x?M.data=x:(x=Sy(n),x!==null&&(M.data=x)))),(x=cE?uE(e,n):hE(e,n))&&(M=Ou(l,"onBeforeInput"),0<M.length&&(w=new Pv("onBeforeInput","beforeinput",null,n,h),d.push({event:w,listeners:M}),w.data=x)),nT(d,e,l,n,h)}_b(d,t)})}function pl(e,t,n){return{instance:e,listener:t,currentTarget:n}}function Ou(e,t){for(var n=t+"Capture",i=[];e!==null;){var s=e,a=s.stateNode;if(s=s.tag,s!==5&&s!==26&&s!==27||a===null||(s=al(e,n),s!=null&&i.unshift(pl(e,s,a)),s=al(e,t),s!=null&&i.push(pl(e,s,a))),e.tag===3)return i;e=e.return}return[]}function sT(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function R_(e,t,n,i,s){for(var a=t._reactName,r=[];n!==null&&n!==i;){var o=n,c=o.alternate,l=o.stateNode;if(o=o.tag,c!==null&&c===i)break;o!==5&&o!==26&&o!==27||l===null||(c=l,s?(l=al(n,a),l!=null&&r.unshift(pl(n,l,c))):s||(l=al(n,a),l!=null&&r.push(pl(n,l,c)))),n=n.return}r.length!==0&&e.push({event:t,listeners:r})}var aT=/\r\n?/g,rT=/\u0000|\uFFFD/g;function D_(e){return(typeof e=="string"?e:""+e).replace(aT,`
`).replace(rT,"")}function xb(e,t){return t=D_(t),D_(e)===t}function _e(e,t,n,i,s,a){switch(n){case"children":typeof i=="string"?t==="body"||t==="textarea"&&i===""||Fr(e,i):(typeof i=="number"||typeof i=="bigint")&&t!=="body"&&Fr(e,""+i);break;case"className":Bc(e,"class",i);break;case"tabIndex":Bc(e,"tabindex",i);break;case"dir":case"role":case"viewBox":case"width":case"height":Bc(e,n,i);break;case"style":vy(e,i,a);break;case"data":if(t!=="object"){Bc(e,"data",i);break}case"src":case"href":if(i===""&&(t!=="a"||n!=="href")){e.removeAttribute(n);break}if(i==null||typeof i=="function"||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(n);break}i=$c(""+i),e.setAttribute(n,i);break;case"action":case"formAction":if(typeof i=="function"){e.setAttribute(n,"javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");break}else typeof a=="function"&&(n==="formAction"?(t!=="input"&&_e(e,t,"name",s.name,s,null),_e(e,t,"formEncType",s.formEncType,s,null),_e(e,t,"formMethod",s.formMethod,s,null),_e(e,t,"formTarget",s.formTarget,s,null)):(_e(e,t,"encType",s.encType,s,null),_e(e,t,"method",s.method,s,null),_e(e,t,"target",s.target,s,null)));if(i==null||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(n);break}i=$c(""+i),e.setAttribute(n,i);break;case"onClick":i!=null&&(e.onclick=os);break;case"onScroll":i!=null&&jt("scroll",e);break;case"onScrollEnd":i!=null&&jt("scrollend",e);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(st(61));if(n=i.__html,n!=null){if(s.children!=null)throw Error(st(60));e.innerHTML=n}}break;case"multiple":e.multiple=i&&typeof i!="function"&&typeof i!="symbol";break;case"muted":e.muted=i&&typeof i!="function"&&typeof i!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(i==null||typeof i=="function"||typeof i=="boolean"||typeof i=="symbol"){e.removeAttribute("xlink:href");break}n=$c(""+i),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",n);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,""+i):e.removeAttribute(n);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":i&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,""):e.removeAttribute(n);break;case"capture":case"download":i===!0?e.setAttribute(n,""):i!==!1&&i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,i):e.removeAttribute(n);break;case"cols":case"rows":case"size":case"span":i!=null&&typeof i!="function"&&typeof i!="symbol"&&!isNaN(i)&&1<=i?e.setAttribute(n,i):e.removeAttribute(n);break;case"rowSpan":case"start":i==null||typeof i=="function"||typeof i=="symbol"||isNaN(i)?e.removeAttribute(n):e.setAttribute(n,i);break;case"popover":jt("beforetoggle",e),jt("toggle",e),Qc(e,"popover",i);break;case"xlinkActuate":$i(e,"http://www.w3.org/1999/xlink","xlink:actuate",i);break;case"xlinkArcrole":$i(e,"http://www.w3.org/1999/xlink","xlink:arcrole",i);break;case"xlinkRole":$i(e,"http://www.w3.org/1999/xlink","xlink:role",i);break;case"xlinkShow":$i(e,"http://www.w3.org/1999/xlink","xlink:show",i);break;case"xlinkTitle":$i(e,"http://www.w3.org/1999/xlink","xlink:title",i);break;case"xlinkType":$i(e,"http://www.w3.org/1999/xlink","xlink:type",i);break;case"xmlBase":$i(e,"http://www.w3.org/XML/1998/namespace","xml:base",i);break;case"xmlLang":$i(e,"http://www.w3.org/XML/1998/namespace","xml:lang",i);break;case"xmlSpace":$i(e,"http://www.w3.org/XML/1998/namespace","xml:space",i);break;case"is":Qc(e,"is",i);break;case"innerText":case"textContent":break;default:(!(2<n.length)||n[0]!=="o"&&n[0]!=="O"||n[1]!=="n"&&n[1]!=="N")&&(n=P1.get(n)||n,Qc(e,n,i))}}function im(e,t,n,i,s,a){switch(n){case"style":vy(e,i,a);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(st(61));if(n=i.__html,n!=null){if(s.children!=null)throw Error(st(60));e.innerHTML=n}}break;case"children":typeof i=="string"?Fr(e,i):(typeof i=="number"||typeof i=="bigint")&&Fr(e,""+i);break;case"onScroll":i!=null&&jt("scroll",e);break;case"onScrollEnd":i!=null&&jt("scrollend",e);break;case"onClick":i!=null&&(e.onclick=os);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!hy.hasOwnProperty(n))t:{if(n[0]==="o"&&n[1]==="n"&&(s=n.endsWith("Capture"),t=n.slice(2,s?n.length-7:void 0),a=e[In]||null,a=a!=null?a[n]:null,typeof a=="function"&&e.removeEventListener(t,a,s),typeof i=="function")){typeof a!="function"&&a!==null&&(n in e?e[n]=null:e.hasAttribute(n)&&e.removeAttribute(n)),e.addEventListener(t,i,s);break t}n in e?e[n]=i:i===!0?e.setAttribute(n,""):Qc(e,n,i)}}}function pn(e,t,n){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":jt("error",e),jt("load",e);var i=!1,s=!1,a;for(a in n)if(n.hasOwnProperty(a)){var r=n[a];if(r!=null)switch(a){case"src":i=!0;break;case"srcSet":s=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error(st(137,t));default:_e(e,t,a,r,n,null)}}s&&_e(e,t,"srcSet",n.srcSet,n,null),i&&_e(e,t,"src",n.src,n,null);return;case"input":jt("invalid",e);var o=a=r=s=null,c=null,l=null;for(i in n)if(n.hasOwnProperty(i)){var h=n[i];if(h!=null)switch(i){case"name":s=h;break;case"type":r=h;break;case"checked":c=h;break;case"defaultChecked":l=h;break;case"value":a=h;break;case"defaultValue":o=h;break;case"children":case"dangerouslySetInnerHTML":if(h!=null)throw Error(st(137,t));break;default:_e(e,t,i,h,n,null)}}py(e,a,o,c,l,r,s,!1);return;case"select":jt("invalid",e),i=r=a=null;for(s in n)if(n.hasOwnProperty(s)&&(o=n[s],o!=null))switch(s){case"value":a=o;break;case"defaultValue":r=o;break;case"multiple":i=o;default:_e(e,t,s,o,n,null)}t=a,n=r,e.multiple=!!i,t!=null?Nr(e,!!i,t,!1):n!=null&&Nr(e,!!i,n,!0);return;case"textarea":jt("invalid",e),a=s=i=null;for(r in n)if(n.hasOwnProperty(r)&&(o=n[r],o!=null))switch(r){case"value":i=o;break;case"defaultValue":s=o;break;case"children":a=o;break;case"dangerouslySetInnerHTML":if(o!=null)throw Error(st(91));break;default:_e(e,t,r,o,n,null)}gy(e,i,s,a);return;case"option":for(c in n)if(n.hasOwnProperty(c)&&(i=n[c],i!=null))switch(c){case"selected":e.selected=i&&typeof i!="function"&&typeof i!="symbol";break;default:_e(e,t,c,i,n,null)}return;case"dialog":jt("beforetoggle",e),jt("toggle",e),jt("cancel",e),jt("close",e);break;case"iframe":case"object":jt("load",e);break;case"video":case"audio":for(i=0;i<dl.length;i++)jt(dl[i],e);break;case"image":jt("error",e),jt("load",e);break;case"details":jt("toggle",e);break;case"embed":case"source":case"link":jt("error",e),jt("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(l in n)if(n.hasOwnProperty(l)&&(i=n[l],i!=null))switch(l){case"children":case"dangerouslySetInnerHTML":throw Error(st(137,t));default:_e(e,t,l,i,n,null)}return;default:if(ym(t)){for(h in n)n.hasOwnProperty(h)&&(i=n[h],i!==void 0&&im(e,t,h,i,n,void 0));return}}for(o in n)n.hasOwnProperty(o)&&(i=n[o],i!=null&&_e(e,t,o,i,n,null))}function oT(e,t,n,i){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var s=null,a=null,r=null,o=null,c=null,l=null,h=null;for(p in n){var d=n[p];if(n.hasOwnProperty(p)&&d!=null)switch(p){case"checked":break;case"value":break;case"defaultValue":c=d;default:i.hasOwnProperty(p)||_e(e,t,p,null,i,d)}}for(var u in i){var p=i[u];if(d=n[u],i.hasOwnProperty(u)&&(p!=null||d!=null))switch(u){case"type":a=p;break;case"name":s=p;break;case"checked":l=p;break;case"defaultChecked":h=p;break;case"value":r=p;break;case"defaultValue":o=p;break;case"children":case"dangerouslySetInnerHTML":if(p!=null)throw Error(st(137,t));break;default:p!==d&&_e(e,t,u,p,i,d)}}Cp(e,r,o,c,l,h,a,s);return;case"select":p=r=o=u=null;for(a in n)if(c=n[a],n.hasOwnProperty(a)&&c!=null)switch(a){case"value":break;case"multiple":p=c;default:i.hasOwnProperty(a)||_e(e,t,a,null,i,c)}for(s in i)if(a=i[s],c=n[s],i.hasOwnProperty(s)&&(a!=null||c!=null))switch(s){case"value":u=a;break;case"defaultValue":o=a;break;case"multiple":r=a;default:a!==c&&_e(e,t,s,a,i,c)}t=o,n=r,i=p,u!=null?Nr(e,!!n,u,!1):!!i!=!!n&&(t!=null?Nr(e,!!n,t,!0):Nr(e,!!n,n?[]:"",!1));return;case"textarea":p=u=null;for(o in n)if(s=n[o],n.hasOwnProperty(o)&&s!=null&&!i.hasOwnProperty(o))switch(o){case"value":break;case"children":break;default:_e(e,t,o,null,i,s)}for(r in i)if(s=i[r],a=n[r],i.hasOwnProperty(r)&&(s!=null||a!=null))switch(r){case"value":u=s;break;case"defaultValue":p=s;break;case"children":break;case"dangerouslySetInnerHTML":if(s!=null)throw Error(st(91));break;default:s!==a&&_e(e,t,r,s,i,a)}my(e,u,p);return;case"option":for(var m in n)if(u=n[m],n.hasOwnProperty(m)&&u!=null&&!i.hasOwnProperty(m))switch(m){case"selected":e.selected=!1;break;default:_e(e,t,m,null,i,u)}for(c in i)if(u=i[c],p=n[c],i.hasOwnProperty(c)&&u!==p&&(u!=null||p!=null))switch(c){case"selected":e.selected=u&&typeof u!="function"&&typeof u!="symbol";break;default:_e(e,t,c,u,i,p)}return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var S in n)u=n[S],n.hasOwnProperty(S)&&u!=null&&!i.hasOwnProperty(S)&&_e(e,t,S,null,i,u);for(l in i)if(u=i[l],p=n[l],i.hasOwnProperty(l)&&u!==p&&(u!=null||p!=null))switch(l){case"children":case"dangerouslySetInnerHTML":if(u!=null)throw Error(st(137,t));break;default:_e(e,t,l,u,i,p)}return;default:if(ym(t)){for(var v in n)u=n[v],n.hasOwnProperty(v)&&u!==void 0&&!i.hasOwnProperty(v)&&im(e,t,v,void 0,i,u);for(h in i)u=i[h],p=n[h],!i.hasOwnProperty(h)||u===p||u===void 0&&p===void 0||im(e,t,h,u,i,p);return}}for(var f in n)u=n[f],n.hasOwnProperty(f)&&u!=null&&!i.hasOwnProperty(f)&&_e(e,t,f,null,i,u);for(d in i)u=i[d],p=n[d],!i.hasOwnProperty(d)||u===p||u==null&&p==null||_e(e,t,d,u,i,p)}function N_(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function lT(){if(typeof performance.getEntriesByType=="function"){for(var e=0,t=0,n=performance.getEntriesByType("resource"),i=0;i<n.length;i++){var s=n[i],a=s.transferSize,r=s.initiatorType,o=s.duration;if(a&&o&&N_(r)){for(r=0,o=s.responseEnd,i+=1;i<n.length;i++){var c=n[i],l=c.startTime;if(l>o)break;var h=c.transferSize,d=c.initiatorType;h&&N_(d)&&(c=c.responseEnd,r+=h*(c<o?1:(o-l)/(c-l)))}if(--i,t+=8*(a+r)/(s.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var sm=null,am=null;function Pu(e){return e.nodeType===9?e:e.ownerDocument}function U_(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function bb(e,t){if(e===0)switch(t){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&t==="foreignObject"?0:e}function rm(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.children=="bigint"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var gp=null;function cT(){var e=window.event;return e&&e.type==="popstate"?e===gp?!1:(gp=e,!0):(gp=null,!1)}var Sb=typeof setTimeout=="function"?setTimeout:void 0,uT=typeof clearTimeout=="function"?clearTimeout:void 0,L_=typeof Promise=="function"?Promise:void 0,hT=typeof queueMicrotask=="function"?queueMicrotask:typeof L_<"u"?function(e){return L_.resolve(null).then(e).catch(fT)}:Sb;function fT(e){setTimeout(function(){throw e})}function sa(e){return e==="head"}function I_(e,t){var n=t,i=0;do{var s=n.nextSibling;if(e.removeChild(n),s&&s.nodeType===8)if(n=s.data,n==="/$"||n==="/&"){if(i===0){e.removeChild(s),Yr(t);return}i--}else if(n==="$"||n==="$?"||n==="$~"||n==="$!"||n==="&")i++;else if(n==="html")il(e.ownerDocument.documentElement);else if(n==="head"){n=e.ownerDocument.head,il(n);for(var a=n.firstChild;a;){var r=a.nextSibling,o=a.nodeName;a[Sl]||o==="SCRIPT"||o==="STYLE"||o==="LINK"&&a.rel.toLowerCase()==="stylesheet"||n.removeChild(a),a=r}}else n==="body"&&il(e.ownerDocument.body);n=s}while(n);Yr(t)}function O_(e,t){var n=e;e=0;do{var i=n.nextSibling;if(n.nodeType===1?t?(n._stashedDisplay=n.style.display,n.style.display="none"):(n.style.display=n._stashedDisplay||"",n.getAttribute("style")===""&&n.removeAttribute("style")):n.nodeType===3&&(t?(n._stashedText=n.nodeValue,n.nodeValue=""):n.nodeValue=n._stashedText||""),i&&i.nodeType===8)if(n=i.data,n==="/$"){if(e===0)break;e--}else n!=="$"&&n!=="$?"&&n!=="$~"&&n!=="$!"||e++;n=i}while(n)}function om(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var n=t;switch(t=t.nextSibling,n.nodeName){case"HTML":case"HEAD":case"BODY":om(n),_m(n);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(n.rel.toLowerCase()==="stylesheet")continue}e.removeChild(n)}}function dT(e,t,n,i){for(;e.nodeType===1;){var s=n;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!i&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(i){if(!e[Sl])switch(t){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(a=e.getAttribute("rel"),a==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(a!==s.rel||e.getAttribute("href")!==(s.href==null||s.href===""?null:s.href)||e.getAttribute("crossorigin")!==(s.crossOrigin==null?null:s.crossOrigin)||e.getAttribute("title")!==(s.title==null?null:s.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(a=e.getAttribute("src"),(a!==(s.src==null?null:s.src)||e.getAttribute("type")!==(s.type==null?null:s.type)||e.getAttribute("crossorigin")!==(s.crossOrigin==null?null:s.crossOrigin))&&a&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(t==="input"&&e.type==="hidden"){var a=s.name==null?null:""+s.name;if(s.type==="hidden"&&e.getAttribute("name")===a)return e}else return e;if(e=pi(e.nextSibling),e===null)break}return null}function pT(e,t,n){if(t==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!n||(e=pi(e.nextSibling),e===null))return null;return e}function Mb(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!t||(e=pi(e.nextSibling),e===null))return null;return e}function lm(e){return e.data==="$?"||e.data==="$~"}function cm(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function mT(e,t){var n=e.ownerDocument;if(e.data==="$~")e._reactRetry=t;else if(e.data!=="$?"||n.readyState!=="loading")t();else{var i=function(){t(),n.removeEventListener("DOMContentLoaded",i)};n.addEventListener("DOMContentLoaded",i),e._reactRetry=i}}function pi(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?"||t==="$~"||t==="&"||t==="F!"||t==="F")break;if(t==="/$"||t==="/&")return null}}return e}var um=null;function P_(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="/$"||n==="/&"){if(t===0)return pi(e.nextSibling);t--}else n!=="$"&&n!=="$!"&&n!=="$?"&&n!=="$~"&&n!=="&"||t++}e=e.nextSibling}return null}function z_(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="$"||n==="$!"||n==="$?"||n==="$~"||n==="&"){if(t===0)return e;t--}else n!=="/$"&&n!=="/&"||t++}e=e.previousSibling}return null}function Eb(e,t,n){switch(t=Pu(n),e){case"html":if(e=t.documentElement,!e)throw Error(st(452));return e;case"head":if(e=t.head,!e)throw Error(st(453));return e;case"body":if(e=t.body,!e)throw Error(st(454));return e;default:throw Error(st(451))}}function il(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);_m(e)}var mi=new Map,B_=new Set;function zu(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var vs=he.d;he.d={f:gT,r:vT,D:_T,C:yT,L:xT,m:bT,X:MT,S:ST,M:ET};function gT(){var e=vs.f(),t=th();return e||t}function vT(e){var t=Jr(e);t!==null&&t.tag===5&&t.type==="form"?vx(t):vs.r(e)}var $r=typeof document>"u"?null:document;function Tb(e,t,n){var i=$r;if(i&&typeof t=="string"&&t){var s=ui(t);s='link[rel="'+e+'"][href="'+s+'"]',typeof n=="string"&&(s+='[crossorigin="'+n+'"]'),B_.has(s)||(B_.add(s),e={rel:e,crossOrigin:n,href:t},i.querySelector(s)===null&&(t=i.createElement("link"),pn(t,"link",e),rn(t),i.head.appendChild(t)))}}function _T(e){vs.D(e),Tb("dns-prefetch",e,null)}function yT(e,t){vs.C(e,t),Tb("preconnect",e,t)}function xT(e,t,n){vs.L(e,t,n);var i=$r;if(i&&e&&t){var s='link[rel="preload"][as="'+ui(t)+'"]';t==="image"&&n&&n.imageSrcSet?(s+='[imagesrcset="'+ui(n.imageSrcSet)+'"]',typeof n.imageSizes=="string"&&(s+='[imagesizes="'+ui(n.imageSizes)+'"]')):s+='[href="'+ui(e)+'"]';var a=s;switch(t){case"style":a=qr(e);break;case"script":a=to(e)}mi.has(a)||(e=Re({rel:"preload",href:t==="image"&&n&&n.imageSrcSet?void 0:e,as:t},n),mi.set(a,e),i.querySelector(s)!==null||t==="style"&&i.querySelector(Cl(a))||t==="script"&&i.querySelector(Rl(a))||(t=i.createElement("link"),pn(t,"link",e),rn(t),i.head.appendChild(t)))}}function bT(e,t){vs.m(e,t);var n=$r;if(n&&e){var i=t&&typeof t.as=="string"?t.as:"script",s='link[rel="modulepreload"][as="'+ui(i)+'"][href="'+ui(e)+'"]',a=s;switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":a=to(e)}if(!mi.has(a)&&(e=Re({rel:"modulepreload",href:e},t),mi.set(a,e),n.querySelector(s)===null)){switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(n.querySelector(Rl(a)))return}i=n.createElement("link"),pn(i,"link",e),rn(i),n.head.appendChild(i)}}}function ST(e,t,n){vs.S(e,t,n);var i=$r;if(i&&e){var s=Dr(i).hoistableStyles,a=qr(e);t=t||"default";var r=s.get(a);if(!r){var o={loading:0,preload:null};if(r=i.querySelector(Cl(a)))o.loading=5;else{e=Re({rel:"stylesheet",href:e,"data-precedence":t},n),(n=mi.get(a))&&ig(e,n);var c=r=i.createElement("link");rn(c),pn(c,"link",e),c._p=new Promise(function(l,h){c.onload=l,c.onerror=h}),c.addEventListener("load",function(){o.loading|=1}),c.addEventListener("error",function(){o.loading|=2}),o.loading|=4,cu(r,t,i)}r={type:"stylesheet",instance:r,count:1,state:o},s.set(a,r)}}}function MT(e,t){vs.X(e,t);var n=$r;if(n&&e){var i=Dr(n).hoistableScripts,s=to(e),a=i.get(s);a||(a=n.querySelector(Rl(s)),a||(e=Re({src:e,async:!0},t),(t=mi.get(s))&&sg(e,t),a=n.createElement("script"),rn(a),pn(a,"link",e),n.head.appendChild(a)),a={type:"script",instance:a,count:1,state:null},i.set(s,a))}}function ET(e,t){vs.M(e,t);var n=$r;if(n&&e){var i=Dr(n).hoistableScripts,s=to(e),a=i.get(s);a||(a=n.querySelector(Rl(s)),a||(e=Re({src:e,async:!0,type:"module"},t),(t=mi.get(s))&&sg(e,t),a=n.createElement("script"),rn(a),pn(a,"link",e),n.head.appendChild(a)),a={type:"script",instance:a,count:1,state:null},i.set(s,a))}}function F_(e,t,n,i){var s=(s=Xs.current)?zu(s):null;if(!s)throw Error(st(446));switch(e){case"meta":case"title":return null;case"style":return typeof n.precedence=="string"&&typeof n.href=="string"?(t=qr(n.href),n=Dr(s).hoistableStyles,i=n.get(t),i||(i={type:"style",instance:null,count:0,state:null},n.set(t,i)),i):{type:"void",instance:null,count:0,state:null};case"link":if(n.rel==="stylesheet"&&typeof n.href=="string"&&typeof n.precedence=="string"){e=qr(n.href);var a=Dr(s).hoistableStyles,r=a.get(e);if(r||(s=s.ownerDocument||s,r={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},a.set(e,r),(a=s.querySelector(Cl(e)))&&!a._p&&(r.instance=a,r.state.loading=5),mi.has(e)||(n={rel:"preload",as:"style",href:n.href,crossOrigin:n.crossOrigin,integrity:n.integrity,media:n.media,hrefLang:n.hrefLang,referrerPolicy:n.referrerPolicy},mi.set(e,n),a||TT(s,e,n,r.state))),t&&i===null)throw Error(st(528,""));return r}if(t&&i!==null)throw Error(st(529,""));return null;case"script":return t=n.async,n=n.src,typeof n=="string"&&t&&typeof t!="function"&&typeof t!="symbol"?(t=to(n),n=Dr(s).hoistableScripts,i=n.get(t),i||(i={type:"script",instance:null,count:0,state:null},n.set(t,i)),i):{type:"void",instance:null,count:0,state:null};default:throw Error(st(444,e))}}function qr(e){return'href="'+ui(e)+'"'}function Cl(e){return'link[rel="stylesheet"]['+e+"]"}function Ab(e){return Re({},e,{"data-precedence":e.precedence,precedence:null})}function TT(e,t,n,i){e.querySelector('link[rel="preload"][as="style"]['+t+"]")?i.loading=1:(t=e.createElement("link"),i.preload=t,t.addEventListener("load",function(){return i.loading|=1}),t.addEventListener("error",function(){return i.loading|=2}),pn(t,"link",n),rn(t),e.head.appendChild(t))}function to(e){return'[src="'+ui(e)+'"]'}function Rl(e){return"script[async]"+e}function V_(e,t,n){if(t.count++,t.instance===null)switch(t.type){case"style":var i=e.querySelector('style[data-href~="'+ui(n.href)+'"]');if(i)return t.instance=i,rn(i),i;var s=Re({},n,{"data-href":n.href,"data-precedence":n.precedence,href:null,precedence:null});return i=(e.ownerDocument||e).createElement("style"),rn(i),pn(i,"style",s),cu(i,n.precedence,e),t.instance=i;case"stylesheet":s=qr(n.href);var a=e.querySelector(Cl(s));if(a)return t.state.loading|=4,t.instance=a,rn(a),a;i=Ab(n),(s=mi.get(s))&&ig(i,s),a=(e.ownerDocument||e).createElement("link"),rn(a);var r=a;return r._p=new Promise(function(o,c){r.onload=o,r.onerror=c}),pn(a,"link",i),t.state.loading|=4,cu(a,n.precedence,e),t.instance=a;case"script":return a=to(n.src),(s=e.querySelector(Rl(a)))?(t.instance=s,rn(s),s):(i=n,(s=mi.get(a))&&(i=Re({},n),sg(i,s)),e=e.ownerDocument||e,s=e.createElement("script"),rn(s),pn(s,"link",i),e.head.appendChild(s),t.instance=s);case"void":return null;default:throw Error(st(443,t.type))}else t.type==="stylesheet"&&(t.state.loading&4)===0&&(i=t.instance,t.state.loading|=4,cu(i,n.precedence,e));return t.instance}function cu(e,t,n){for(var i=n.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'),s=i.length?i[i.length-1]:null,a=s,r=0;r<i.length;r++){var o=i[r];if(o.dataset.precedence===t)a=o;else if(a!==s)break}a?a.parentNode.insertBefore(e,a.nextSibling):(t=n.nodeType===9?n.head:n,t.insertBefore(e,t.firstChild))}function ig(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.title==null&&(e.title=t.title)}function sg(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.integrity==null&&(e.integrity=t.integrity)}var uu=null;function H_(e,t,n){if(uu===null){var i=new Map,s=uu=new Map;s.set(n,i)}else s=uu,i=s.get(n),i||(i=new Map,s.set(n,i));if(i.has(e))return i;for(i.set(e,null),n=n.getElementsByTagName(e),s=0;s<n.length;s++){var a=n[s];if(!(a[Sl]||a[hn]||e==="link"&&a.getAttribute("rel")==="stylesheet")&&a.namespaceURI!=="http://www.w3.org/2000/svg"){var r=a.getAttribute(t)||"";r=e+r;var o=i.get(r);o?o.push(a):i.set(r,[a])}}return i}function G_(e,t,n){e=e.ownerDocument||e,e.head.insertBefore(n,t==="title"?e.querySelector("head > title"):null)}function AT(e,t,n){if(n===1||t.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof t.precedence!="string"||typeof t.href!="string"||t.href==="")break;return!0;case"link":if(typeof t.rel!="string"||typeof t.href!="string"||t.href===""||t.onLoad||t.onError)break;switch(t.rel){case"stylesheet":return e=t.disabled,typeof t.precedence=="string"&&e==null;default:return!0}case"script":if(t.async&&typeof t.async!="function"&&typeof t.async!="symbol"&&!t.onLoad&&!t.onError&&t.src&&typeof t.src=="string")return!0}return!1}function wb(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function wT(e,t,n,i){if(n.type==="stylesheet"&&(typeof i.media!="string"||matchMedia(i.media).matches!==!1)&&(n.state.loading&4)===0){if(n.instance===null){var s=qr(i.href),a=t.querySelector(Cl(s));if(a){t=a._p,t!==null&&typeof t=="object"&&typeof t.then=="function"&&(e.count++,e=Bu.bind(e),t.then(e,e)),n.state.loading|=4,n.instance=a,rn(a);return}a=t.ownerDocument||t,i=Ab(i),(s=mi.get(s))&&ig(i,s),a=a.createElement("link"),rn(a);var r=a;r._p=new Promise(function(o,c){r.onload=o,r.onerror=c}),pn(a,"link",i),n.instance=a}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(n,t),(t=n.state.preload)&&(n.state.loading&3)===0&&(e.count++,n=Bu.bind(e),t.addEventListener("load",n),t.addEventListener("error",n))}}var vp=0;function CT(e,t){return e.stylesheets&&e.count===0&&hu(e,e.stylesheets),0<e.count||0<e.imgCount?function(n){var i=setTimeout(function(){if(e.stylesheets&&hu(e,e.stylesheets),e.unsuspend){var a=e.unsuspend;e.unsuspend=null,a()}},6e4+t);0<e.imgBytes&&vp===0&&(vp=62500*lT());var s=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&hu(e,e.stylesheets),e.unsuspend)){var a=e.unsuspend;e.unsuspend=null,a()}},(e.imgBytes>vp?50:800)+t);return e.unsuspend=n,function(){e.unsuspend=null,clearTimeout(i),clearTimeout(s)}}:null}function Bu(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)hu(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var Fu=null;function hu(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,Fu=new Map,t.forEach(RT,e),Fu=null,Bu.call(e))}function RT(e,t){if(!(t.state.loading&4)){var n=Fu.get(e);if(n)var i=n.get(null);else{n=new Map,Fu.set(e,n);for(var s=e.querySelectorAll("link[data-precedence],style[data-precedence]"),a=0;a<s.length;a++){var r=s[a];(r.nodeName==="LINK"||r.getAttribute("media")!=="not all")&&(n.set(r.dataset.precedence,r),i=r)}i&&n.set(null,i)}s=t.instance,r=s.getAttribute("data-precedence"),a=n.get(r)||i,a===i&&n.set(null,s),n.set(r,s),this.count++,i=Bu.bind(this),s.addEventListener("load",i),s.addEventListener("error",i),a?a.parentNode.insertBefore(s,a.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(s,e.firstChild)),t.state.loading|=4}}var ml={$$typeof:rs,Provider:null,Consumer:null,_currentValue:Na,_currentValue2:Na,_threadCount:0};function DT(e,t,n,i,s,a,r,o,c){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=kd(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=kd(0),this.hiddenUpdates=kd(null),this.identifierPrefix=i,this.onUncaughtError=s,this.onCaughtError=a,this.onRecoverableError=r,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=c,this.incompleteTransitions=new Map}function Cb(e,t,n,i,s,a,r,o,c,l,h,d){return e=new DT(e,t,n,r,c,l,h,d,o),t=1,a===!0&&(t|=24),a=Hn(3,null,null,t),e.current=a,a.stateNode=e,t=Dm(),t.refCount++,e.pooledCache=t,t.refCount++,a.memoizedState={element:i,isDehydrated:n,cache:t},Lm(a),e}function Rb(e){return e?(e=Ar,e):Ar}function Db(e,t,n,i,s,a){s=Rb(s),i.context===null?i.context=s:i.pendingContext=s,i=qs(t),i.payload={element:n},a=a===void 0?null:a,a!==null&&(i.callback=a),n=Ys(e,i,t),n!==null&&(Ln(n,e,t),Jo(n,e,t))}function k_(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var n=e.retryLane;e.retryLane=n!==0&&n<t?n:t}}function ag(e,t){k_(e,t),(e=e.alternate)&&k_(e,t)}function Nb(e){if(e.tag===13||e.tag===31){var t=Xa(e,67108864);t!==null&&Ln(t,e,67108864),ag(e,67108864)}}function X_(e){if(e.tag===13||e.tag===31){var t=qn();t=gm(t);var n=Xa(e,t);n!==null&&Ln(n,e,t),ag(e,t)}}var Vu=!0;function NT(e,t,n,i){var s=Bt.T;Bt.T=null;var a=he.p;try{he.p=2,rg(e,t,n,i)}finally{he.p=a,Bt.T=s}}function UT(e,t,n,i){var s=Bt.T;Bt.T=null;var a=he.p;try{he.p=8,rg(e,t,n,i)}finally{he.p=a,Bt.T=s}}function rg(e,t,n,i){if(Vu){var s=hm(i);if(s===null)mp(e,t,i,Hu,n),W_(e,i);else if(IT(s,e,t,n,i))i.stopPropagation();else if(W_(e,i),t&4&&-1<LT.indexOf(e)){for(;s!==null;){var a=Jr(s);if(a!==null)switch(a.tag){case 3:if(a=a.stateNode,a.current.memoizedState.isDehydrated){var r=Ca(a.pendingLanes);if(r!==0){var o=a;for(o.pendingLanes|=2,o.entangledLanes|=2;r;){var c=1<<31-Wn(r);o.entanglements[1]|=c,r&=~c}Bi(a),(ue&6)===0&&(Du=kn()+500,wl(0,!1))}}break;case 31:case 13:o=Xa(a,2),o!==null&&Ln(o,a,2),th(),ag(a,2)}if(a=hm(i),a===null&&mp(e,t,i,Hu,n),a===s)break;s=a}s!==null&&i.stopPropagation()}else mp(e,t,i,null,n)}}function hm(e){return e=xm(e),og(e)}var Hu=null;function og(e){if(Hu=null,e=xr(e),e!==null){var t=_l(e);if(t===null)e=null;else{var n=t.tag;if(n===13){if(e=j_(t),e!==null)return e;e=null}else if(n===31){if(e=Q_(t),e!==null)return e;e=null}else if(n===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return Hu=e,null}function Ub(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(x1()){case ny:return 2;case iy:return 8;case gu:case b1:return 32;case sy:return 268435456;default:return 32}default:return 32}}var fm=!1,Ks=null,js=null,Qs=null,gl=new Map,vl=new Map,Bs=[],LT="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function W_(e,t){switch(e){case"focusin":case"focusout":Ks=null;break;case"dragenter":case"dragleave":js=null;break;case"mouseover":case"mouseout":Qs=null;break;case"pointerover":case"pointerout":gl.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":vl.delete(t.pointerId)}}function Bo(e,t,n,i,s,a){return e===null||e.nativeEvent!==a?(e={blockedOn:t,domEventName:n,eventSystemFlags:i,nativeEvent:a,targetContainers:[s]},t!==null&&(t=Jr(t),t!==null&&Nb(t)),e):(e.eventSystemFlags|=i,t=e.targetContainers,s!==null&&t.indexOf(s)===-1&&t.push(s),e)}function IT(e,t,n,i,s){switch(t){case"focusin":return Ks=Bo(Ks,e,t,n,i,s),!0;case"dragenter":return js=Bo(js,e,t,n,i,s),!0;case"mouseover":return Qs=Bo(Qs,e,t,n,i,s),!0;case"pointerover":var a=s.pointerId;return gl.set(a,Bo(gl.get(a)||null,e,t,n,i,s)),!0;case"gotpointercapture":return a=s.pointerId,vl.set(a,Bo(vl.get(a)||null,e,t,n,i,s)),!0}return!1}function Lb(e){var t=xr(e.target);if(t!==null){var n=_l(t);if(n!==null){if(t=n.tag,t===13){if(t=j_(n),t!==null){e.blockedOn=t,Cv(e.priority,function(){X_(n)});return}}else if(t===31){if(t=Q_(n),t!==null){e.blockedOn=t,Cv(e.priority,function(){X_(n)});return}}else if(t===3&&n.stateNode.current.memoizedState.isDehydrated){e.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}e.blockedOn=null}function fu(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var n=hm(e.nativeEvent);if(n===null){n=e.nativeEvent;var i=new n.constructor(n.type,n);Dp=i,n.target.dispatchEvent(i),Dp=null}else return t=Jr(n),t!==null&&Nb(t),e.blockedOn=n,!1;t.shift()}return!0}function q_(e,t,n){fu(e)&&n.delete(t)}function OT(){fm=!1,Ks!==null&&fu(Ks)&&(Ks=null),js!==null&&fu(js)&&(js=null),Qs!==null&&fu(Qs)&&(Qs=null),gl.forEach(q_),vl.forEach(q_)}function Kc(e,t){e.blockedOn===t&&(e.blockedOn=null,fm||(fm=!0,$e.unstable_scheduleCallback($e.unstable_NormalPriority,OT)))}var jc=null;function Y_(e){jc!==e&&(jc=e,$e.unstable_scheduleCallback($e.unstable_NormalPriority,function(){jc===e&&(jc=null);for(var t=0;t<e.length;t+=3){var n=e[t],i=e[t+1],s=e[t+2];if(typeof i!="function"){if(og(i||n)===null)continue;break}var a=Jr(n);a!==null&&(e.splice(t,3),t-=3,qp(a,{pending:!0,data:s,method:n.method,action:i},i,s))}}))}function Yr(e){function t(c){return Kc(c,e)}Ks!==null&&Kc(Ks,e),js!==null&&Kc(js,e),Qs!==null&&Kc(Qs,e),gl.forEach(t),vl.forEach(t);for(var n=0;n<Bs.length;n++){var i=Bs[n];i.blockedOn===e&&(i.blockedOn=null)}for(;0<Bs.length&&(n=Bs[0],n.blockedOn===null);)Lb(n),n.blockedOn===null&&Bs.shift();if(n=(e.ownerDocument||e).$$reactFormReplay,n!=null)for(i=0;i<n.length;i+=3){var s=n[i],a=n[i+1],r=s[In]||null;if(typeof a=="function")r||Y_(n);else if(r){var o=null;if(a&&a.hasAttribute("formAction")){if(s=a,r=a[In]||null)o=r.formAction;else if(og(s)!==null)continue}else o=r.action;typeof o=="function"?n[i+1]=o:(n.splice(i,3),i-=3),Y_(n)}}}function Ib(){function e(a){a.canIntercept&&a.info==="react-transition"&&a.intercept({handler:function(){return new Promise(function(r){return s=r})},focusReset:"manual",scroll:"manual"})}function t(){s!==null&&(s(),s=null),i||setTimeout(n,20)}function n(){if(!i&&!navigation.transition){var a=navigation.currentEntry;a&&a.url!=null&&navigation.navigate(a.url,{state:a.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var i=!1,s=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",t),navigation.addEventListener("navigateerror",t),setTimeout(n,100),function(){i=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",t),navigation.removeEventListener("navigateerror",t),s!==null&&(s(),s=null)}}}function lg(e){this._internalRoot=e}ih.prototype.render=lg.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(st(409));var n=t.current,i=qn();Db(n,i,e,t,null,null)};ih.prototype.unmount=lg.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;Db(e.current,2,null,e,null,null),th(),t[Zr]=null}};function ih(e){this._internalRoot=e}ih.prototype.unstable_scheduleHydration=function(e){if(e){var t=cy();e={blockedOn:null,target:e,priority:t};for(var n=0;n<Bs.length&&t!==0&&t<Bs[n].priority;n++);Bs.splice(n,0,e),n===0&&Lb(e)}};var Z_=J_.version;if(Z_!=="19.2.8")throw Error(st(527,Z_,"19.2.8"));he.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(st(188)):(e=Object.keys(e).join(","),Error(st(268,e)));return e=d1(t),e=e!==null?$_(e):null,e=e===null?null:e.stateNode,e};var PT={bundleType:0,version:"19.2.8",rendererPackageName:"react-dom",currentDispatcherRef:Bt,reconcilerVersion:"19.2.8"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"&&(Fo=__REACT_DEVTOOLS_GLOBAL_HOOK__,!Fo.isDisabled&&Fo.supportsFiber))try{yl=Fo.inject(PT),Xn=Fo}catch{}var Fo;sh.createRoot=function(e,t){if(!K_(e))throw Error(st(299));var n=!1,i="",s=Tx,a=Ax,r=wx;return t!=null&&(t.unstable_strictMode===!0&&(n=!0),t.identifierPrefix!==void 0&&(i=t.identifierPrefix),t.onUncaughtError!==void 0&&(s=t.onUncaughtError),t.onCaughtError!==void 0&&(a=t.onCaughtError),t.onRecoverableError!==void 0&&(r=t.onRecoverableError)),t=Cb(e,1,!1,null,null,n,i,null,s,a,r,Ib),e[Zr]=t.current,ng(e),new lg(t)};sh.hydrateRoot=function(e,t,n){if(!K_(e))throw Error(st(299));var i=!1,s="",a=Tx,r=Ax,o=wx,c=null;return n!=null&&(n.unstable_strictMode===!0&&(i=!0),n.identifierPrefix!==void 0&&(s=n.identifierPrefix),n.onUncaughtError!==void 0&&(a=n.onUncaughtError),n.onCaughtError!==void 0&&(r=n.onCaughtError),n.onRecoverableError!==void 0&&(o=n.onRecoverableError),n.formState!==void 0&&(c=n.formState)),t=Cb(e,1,!0,t,n??null,i,s,c,a,r,o,Ib),t.context=Rb(null),n=t.current,i=qn(),i=gm(i),s=qs(i),s.callback=null,Ys(n,s,i),n=i,t.current.lanes=n,bl(t,n),Bi(t),e[Zr]=t.current,ng(e),new ih(t)};sh.version="19.2.8"});var Bb=Ni((P3,zb)=>{"use strict";function Pb(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(Pb)}catch(e){console.error(e)}}Pb(),zb.exports=Ob()});var wM=Ni(_d=>{"use strict";var f3=Symbol.for("react.transitional.element"),d3=Symbol.for("react.fragment");function AM(e,t,n){var i=null;if(n!==void 0&&(i=""+n),t.key!==void 0&&(i=""+t.key),"key"in t){n={};for(var s in t)s!=="key"&&(n[s]=t[s])}else n=t;return t=n.ref,{$$typeof:f3,type:e,key:i,ref:t!==void 0?t:null,props:n}}_d.Fragment=d3;_d.jsx=AM;_d.jsxs=AM});var L0=Ni((rL,CM)=>{"use strict";CM.exports=wM()});var at=wc(Rc()),NM=wc(Bb());var Sf="185";var uS=0,Xg=1,hS=2;var lc=1,fS=2,So=3,Ts=0,Cn=1,ni=2,Zi=0,Qa=1,Wg=2,qg=3,Yg=4,dS=5;var ha=100,pS=101,mS=102,gS=103,vS=104,_S=200,yS=201,xS=202,bS=203,Uh=204,Lh=205,SS=206,MS=207,ES=208,TS=209,AS=210,wS=211,CS=212,RS=213,DS=214,Ih=0,Oh=1,Ph=2,$a=3,zh=4,Bh=5,Fh=6,Vh=7,Zg=0,NS=1,US=2,wi=0,Jg=1,Kg=2,jg=3,Qg=4,$g=5,t0=6,e0=7;var n0=300,ya=301,nr=302,Mf=303,Ef=304,cc=306,Hh=1e3,Hi=1001,Gh=1002,cn=1003,LS=1004;var uc=1005;var mn=1006,Tf=1007;var xa=1008;var ii=1009,i0=1010,s0=1011,Mo=1012,Af=1013,Ci=1014,Ri=1015,Ji=1016,wf=1017,Cf=1018,Eo=1020,a0=35902,r0=35899,o0=1021,l0=1022,yi=1023,ki=1026,ba=1027,c0=1028,Rf=1029,Sa=1030,Df=1031;var Nf=1033,hc=33776,fc=33777,dc=33778,pc=33779,Uf=35840,Lf=35841,If=35842,Of=35843,Pf=36196,zf=37492,Bf=37496,Ff=37488,Vf=37489,mc=37490,Hf=37491,Gf=37808,kf=37809,Xf=37810,Wf=37811,qf=37812,Yf=37813,Zf=37814,Jf=37815,Kf=37816,jf=37817,Qf=37818,$f=37819,td=37820,ed=37821,nd=36492,id=36494,sd=36495,ad=36283,rd=36284,gc=36285,od=36286;var Bl=2300,kh=2301,Dh=2302,Pg=2303,zg=2400,Bg=2401,Fg=2402;var IS=3200;var u0=0,OS=1,ws="",wn="srgb",Fl="srgb-linear",Vl="linear",fe="srgb";var Ka=7680;var Vg=519,PS=512,zS=513,BS=514,ld=515,FS=516,VS=517,cd=518,HS=519,Hg=35044;var h0="300 es",Ai=2e3,Hl=2001;function zT(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function BT(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function Gl(e){return document.createElementNS("http://www.w3.org/1999/xhtml",e)}function GS(){let e=Gl("canvas");return e.style.display="block",e}var Fb={},mo=null;function f0(...e){let t="THREE."+e.shift();mo?mo("log",t,...e):console.log(t,...e)}function kS(e){let t=e[0];if(typeof t=="string"&&t.startsWith("TSL:")){let n=e[1];n&&n.isStackTrace?e[0]+=" "+n.getLocation():e[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return e}function It(...e){e=kS(e);let t="THREE."+e.shift();if(mo)mo("warn",t,...e);else{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function zt(...e){e=kS(e);let t="THREE."+e.shift();if(mo)mo("error",t,...e);else{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function ja(...e){let t=e.join(" ");t in Fb||(Fb[t]=!0,It(...e))}function XS(e,t,n){return new Promise(function(i,s){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:s();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:i()}}setTimeout(a,n)})}var WS={[Ih]:Oh,[Ph]:Fh,[zh]:Vh,[$a]:Bh,[Oh]:Ih,[Fh]:Ph,[Vh]:zh,[Bh]:$a},Xi=class{addEventListener(t,n){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[t]===void 0&&(i[t]=[]),i[t].indexOf(n)===-1&&i[t].push(n)}hasEventListener(t,n){let i=this._listeners;return i===void 0?!1:i[t]!==void 0&&i[t].indexOf(n)!==-1}removeEventListener(t,n){let i=this._listeners;if(i===void 0)return;let s=i[t];if(s!==void 0){let a=s.indexOf(n);a!==-1&&s.splice(a,1)}}dispatchEvent(t){let n=this._listeners;if(n===void 0)return;let i=n[t.type];if(i!==void 0){t.target=this;let s=i.slice(0);for(let a=0,r=s.length;a<r;a++)s[a].call(this,t);t.target=null}}},_n=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var Nh=Math.PI/180,Xh=180/Math.PI;function vc(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(_n[e&255]+_n[e>>8&255]+_n[e>>16&255]+_n[e>>24&255]+"-"+_n[t&255]+_n[t>>8&255]+"-"+_n[t>>16&15|64]+_n[t>>24&255]+"-"+_n[n&63|128]+_n[n>>8&255]+"-"+_n[n>>16&255]+_n[n>>24&255]+_n[i&255]+_n[i>>8&255]+_n[i>>16&255]+_n[i>>24&255]).toLowerCase()}function $t(e,t,n){return Math.max(t,Math.min(n,e))}function FT(e,t){return(e%t+t)%t}function cg(e,t,n){return(1-n)*e+n*t}function Dl(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Pn(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Lt=class e{static{e.prototype.isVector2=!0}constructor(t=0,n=0){this.x=t,this.y=n}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,n){return this.x=t,this.y=n,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let n=this.x,i=this.y,s=t.elements;return this.x=s[0]*n+s[3]*i+s[6],this.y=s[1]*n+s[4]*i+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,n){return this.x=$t(this.x,t.x,n.x),this.y=$t(this.y,t.y,n.y),this}clampScalar(t,n){return this.x=$t(this.x,t,n),this.y=$t(this.y,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar($t(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let n=Math.sqrt(this.lengthSq()*t.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(t)/n;return Math.acos($t(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let n=this.x-t.x,i=this.y-t.y;return n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this}rotateAround(t,n){let i=Math.cos(n),s=Math.sin(n),a=this.x-t.x,r=this.y-t.y;return this.x=a*i-r*s+t.x,this.y=a*s+r*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Wi=class{constructor(t=0,n=0,i=0,s=1){this.isQuaternion=!0,this._x=t,this._y=n,this._z=i,this._w=s}static slerpFlat(t,n,i,s,a,r,o){let c=i[s+0],l=i[s+1],h=i[s+2],d=i[s+3],u=a[r+0],p=a[r+1],m=a[r+2],S=a[r+3];if(d!==S||c!==u||l!==p||h!==m){let v=c*u+l*p+h*m+d*S;v<0&&(u=-u,p=-p,m=-m,S=-S,v=-v);let f=1-o;if(v<.9995){let g=Math.acos(v),y=Math.sin(g);f=Math.sin(f*g)/y,o=Math.sin(o*g)/y,c=c*f+u*o,l=l*f+p*o,h=h*f+m*o,d=d*f+S*o}else{c=c*f+u*o,l=l*f+p*o,h=h*f+m*o,d=d*f+S*o;let g=1/Math.sqrt(c*c+l*l+h*h+d*d);c*=g,l*=g,h*=g,d*=g}}t[n]=c,t[n+1]=l,t[n+2]=h,t[n+3]=d}static multiplyQuaternionsFlat(t,n,i,s,a,r){let o=i[s],c=i[s+1],l=i[s+2],h=i[s+3],d=a[r],u=a[r+1],p=a[r+2],m=a[r+3];return t[n]=o*m+h*d+c*p-l*u,t[n+1]=c*m+h*u+l*d-o*p,t[n+2]=l*m+h*p+o*u-c*d,t[n+3]=h*m-o*d-c*u-l*p,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,n,i,s){return this._x=t,this._y=n,this._z=i,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,n=!0){let i=t._x,s=t._y,a=t._z,r=t._order,o=Math.cos,c=Math.sin,l=o(i/2),h=o(s/2),d=o(a/2),u=c(i/2),p=c(s/2),m=c(a/2);switch(r){case"XYZ":this._x=u*h*d+l*p*m,this._y=l*p*d-u*h*m,this._z=l*h*m+u*p*d,this._w=l*h*d-u*p*m;break;case"YXZ":this._x=u*h*d+l*p*m,this._y=l*p*d-u*h*m,this._z=l*h*m-u*p*d,this._w=l*h*d+u*p*m;break;case"ZXY":this._x=u*h*d-l*p*m,this._y=l*p*d+u*h*m,this._z=l*h*m+u*p*d,this._w=l*h*d-u*p*m;break;case"ZYX":this._x=u*h*d-l*p*m,this._y=l*p*d+u*h*m,this._z=l*h*m-u*p*d,this._w=l*h*d+u*p*m;break;case"YZX":this._x=u*h*d+l*p*m,this._y=l*p*d+u*h*m,this._z=l*h*m-u*p*d,this._w=l*h*d-u*p*m;break;case"XZY":this._x=u*h*d-l*p*m,this._y=l*p*d-u*h*m,this._z=l*h*m+u*p*d,this._w=l*h*d+u*p*m;break;default:It("Quaternion: .setFromEuler() encountered an unknown order: "+r)}return n===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,n){let i=n/2,s=Math.sin(i);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(t){let n=t.elements,i=n[0],s=n[4],a=n[8],r=n[1],o=n[5],c=n[9],l=n[2],h=n[6],d=n[10],u=i+o+d;if(u>0){let p=.5/Math.sqrt(u+1);this._w=.25/p,this._x=(h-c)*p,this._y=(a-l)*p,this._z=(r-s)*p}else if(i>o&&i>d){let p=2*Math.sqrt(1+i-o-d);this._w=(h-c)/p,this._x=.25*p,this._y=(s+r)/p,this._z=(a+l)/p}else if(o>d){let p=2*Math.sqrt(1+o-i-d);this._w=(a-l)/p,this._x=(s+r)/p,this._y=.25*p,this._z=(c+h)/p}else{let p=2*Math.sqrt(1+d-i-o);this._w=(r-s)/p,this._x=(a+l)/p,this._y=(c+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(t,n){let i=t.dot(n)+1;return i<1e-8?(i=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=i):(this._x=0,this._y=-t.z,this._z=t.y,this._w=i)):(this._x=t.y*n.z-t.z*n.y,this._y=t.z*n.x-t.x*n.z,this._z=t.x*n.y-t.y*n.x,this._w=i),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs($t(this.dot(t),-1,1)))}rotateTowards(t,n){let i=this.angleTo(t);if(i===0)return this;let s=Math.min(1,n/i);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,n){let i=t._x,s=t._y,a=t._z,r=t._w,o=n._x,c=n._y,l=n._z,h=n._w;return this._x=i*h+r*o+s*l-a*c,this._y=s*h+r*c+a*o-i*l,this._z=a*h+r*l+i*c-s*o,this._w=r*h-i*o-s*c-a*l,this._onChangeCallback(),this}slerp(t,n){let i=t._x,s=t._y,a=t._z,r=t._w,o=this.dot(t);o<0&&(i=-i,s=-s,a=-a,r=-r,o=-o);let c=1-n;if(o<.9995){let l=Math.acos(o),h=Math.sin(l);c=Math.sin(c*l)/h,n=Math.sin(n*l)/h,this._x=this._x*c+i*n,this._y=this._y*c+s*n,this._z=this._z*c+a*n,this._w=this._w*c+r*n,this._onChangeCallback()}else this._x=this._x*c+i*n,this._y=this._y*c+s*n,this._z=this._z*c+a*n,this._w=this._w*c+r*n,this.normalize();return this}slerpQuaternions(t,n,i){return this.copy(t).slerp(n,i)}random(){let t=2*Math.PI*Math.random(),n=2*Math.PI*Math.random(),i=Math.random(),s=Math.sqrt(1-i),a=Math.sqrt(i);return this.set(s*Math.sin(t),s*Math.cos(t),a*Math.sin(n),a*Math.cos(n))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,n=0){return this._x=t[n],this._y=t[n+1],this._z=t[n+2],this._w=t[n+3],this._onChangeCallback(),this}toArray(t=[],n=0){return t[n]=this._x,t[n+1]=this._y,t[n+2]=this._z,t[n+3]=this._w,t}fromBufferAttribute(t,n){return this._x=t.getX(n),this._y=t.getY(n),this._z=t.getZ(n),this._w=t.getW(n),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},L=class e{static{e.prototype.isVector3=!0}constructor(t=0,n=0,i=0){this.x=t,this.y=n,this.z=i}set(t,n,i){return i===void 0&&(i=this.z),this.x=t,this.y=n,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this.z=t.z+n.z,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this.z+=t.z*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this.z=t.z-n.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,n){return this.x=t.x*n.x,this.y=t.y*n.y,this.z=t.z*n.z,this}applyEuler(t){return this.applyQuaternion(Vb.setFromEuler(t))}applyAxisAngle(t,n){return this.applyQuaternion(Vb.setFromAxisAngle(t,n))}applyMatrix3(t){let n=this.x,i=this.y,s=this.z,a=t.elements;return this.x=a[0]*n+a[3]*i+a[6]*s,this.y=a[1]*n+a[4]*i+a[7]*s,this.z=a[2]*n+a[5]*i+a[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let n=this.x,i=this.y,s=this.z,a=t.elements,r=1/(a[3]*n+a[7]*i+a[11]*s+a[15]);return this.x=(a[0]*n+a[4]*i+a[8]*s+a[12])*r,this.y=(a[1]*n+a[5]*i+a[9]*s+a[13])*r,this.z=(a[2]*n+a[6]*i+a[10]*s+a[14])*r,this}applyQuaternion(t){let n=this.x,i=this.y,s=this.z,a=t.x,r=t.y,o=t.z,c=t.w,l=2*(r*s-o*i),h=2*(o*n-a*s),d=2*(a*i-r*n);return this.x=n+c*l+r*d-o*h,this.y=i+c*h+o*l-a*d,this.z=s+c*d+a*h-r*l,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let n=this.x,i=this.y,s=this.z,a=t.elements;return this.x=a[0]*n+a[4]*i+a[8]*s,this.y=a[1]*n+a[5]*i+a[9]*s,this.z=a[2]*n+a[6]*i+a[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,n){return this.x=$t(this.x,t.x,n.x),this.y=$t(this.y,t.y,n.y),this.z=$t(this.z,t.z,n.z),this}clampScalar(t,n){return this.x=$t(this.x,t,n),this.y=$t(this.y,t,n),this.z=$t(this.z,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar($t(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this.z+=(t.z-this.z)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this.z=t.z+(n.z-t.z)*i,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,n){let i=t.x,s=t.y,a=t.z,r=n.x,o=n.y,c=n.z;return this.x=s*c-a*o,this.y=a*r-i*c,this.z=i*o-s*r,this}projectOnVector(t){let n=t.lengthSq();if(n===0)return this.set(0,0,0);let i=t.dot(this)/n;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return ug.copy(this).projectOnVector(t),this.sub(ug)}reflect(t){return this.sub(ug.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let n=Math.sqrt(this.lengthSq()*t.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(t)/n;return Math.acos($t(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let n=this.x-t.x,i=this.y-t.y,s=this.z-t.z;return n*n+i*i+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,n,i){let s=Math.sin(n)*t;return this.x=s*Math.sin(i),this.y=Math.cos(n)*t,this.z=s*Math.cos(i),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,n,i){return this.x=t*Math.sin(n),this.y=i,this.z=t*Math.cos(n),this}setFromMatrixPosition(t){let n=t.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this}setFromMatrixScale(t){let n=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=n,this.y=i,this.z=s,this}setFromMatrixColumn(t,n){return this.fromArray(t.elements,n*4)}setFromMatrix3Column(t,n){return this.fromArray(t.elements,n*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this.z=t[n+2],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t[n+2]=this.z,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this.z=t.getZ(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,n=Math.random()*2-1,i=Math.sqrt(1-n*n);return this.x=i*Math.cos(t),this.y=n,this.z=i*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},ug=new L,Vb=new Wi,Vt=class e{static{e.prototype.isMatrix3=!0}constructor(t,n,i,s,a,r,o,c,l){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,n,i,s,a,r,o,c,l)}set(t,n,i,s,a,r,o,c,l){let h=this.elements;return h[0]=t,h[1]=s,h[2]=o,h[3]=n,h[4]=a,h[5]=c,h[6]=i,h[7]=r,h[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let n=this.elements,i=t.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],this}extractBasis(t,n,i){return t.setFromMatrix3Column(this,0),n.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let n=t.elements;return this.set(n[0],n[4],n[8],n[1],n[5],n[9],n[2],n[6],n[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,n){let i=t.elements,s=n.elements,a=this.elements,r=i[0],o=i[3],c=i[6],l=i[1],h=i[4],d=i[7],u=i[2],p=i[5],m=i[8],S=s[0],v=s[3],f=s[6],g=s[1],y=s[4],_=s[7],T=s[2],A=s[5],w=s[8];return a[0]=r*S+o*g+c*T,a[3]=r*v+o*y+c*A,a[6]=r*f+o*_+c*w,a[1]=l*S+h*g+d*T,a[4]=l*v+h*y+d*A,a[7]=l*f+h*_+d*w,a[2]=u*S+p*g+m*T,a[5]=u*v+p*y+m*A,a[8]=u*f+p*_+m*w,this}multiplyScalar(t){let n=this.elements;return n[0]*=t,n[3]*=t,n[6]*=t,n[1]*=t,n[4]*=t,n[7]*=t,n[2]*=t,n[5]*=t,n[8]*=t,this}determinant(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],c=t[6],l=t[7],h=t[8];return n*r*h-n*o*l-i*a*h+i*o*c+s*a*l-s*r*c}invert(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],c=t[6],l=t[7],h=t[8],d=h*r-o*l,u=o*c-h*a,p=l*a-r*c,m=n*d+i*u+s*p;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);let S=1/m;return t[0]=d*S,t[1]=(s*l-h*i)*S,t[2]=(o*i-s*r)*S,t[3]=u*S,t[4]=(h*n-s*c)*S,t[5]=(s*a-o*n)*S,t[6]=p*S,t[7]=(i*c-l*n)*S,t[8]=(r*n-i*a)*S,this}transpose(){let t,n=this.elements;return t=n[1],n[1]=n[3],n[3]=t,t=n[2],n[2]=n[6],n[6]=t,t=n[5],n[5]=n[7],n[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let n=this.elements;return t[0]=n[0],t[1]=n[3],t[2]=n[6],t[3]=n[1],t[4]=n[4],t[5]=n[7],t[6]=n[2],t[7]=n[5],t[8]=n[8],this}setUvTransform(t,n,i,s,a,r,o){let c=Math.cos(a),l=Math.sin(a);return this.set(i*c,i*l,-i*(c*r+l*o)+r+t,-s*l,s*c,-s*(-l*r+c*o)+o+n,0,0,1),this}scale(t,n){return ja("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(hg.makeScale(t,n)),this}rotate(t){return ja("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(hg.makeRotation(-t)),this}translate(t,n){return ja("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(hg.makeTranslation(t,n)),this}makeTranslation(t,n){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,n,0,0,1),this}makeRotation(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,-i,0,i,n,0,0,0,1),this}makeScale(t,n){return this.set(t,0,0,0,n,0,0,0,1),this}equals(t){let n=this.elements,i=t.elements;for(let s=0;s<9;s++)if(n[s]!==i[s])return!1;return!0}fromArray(t,n=0){for(let i=0;i<9;i++)this.elements[i]=t[i+n];return this}toArray(t=[],n=0){let i=this.elements;return t[n]=i[0],t[n+1]=i[1],t[n+2]=i[2],t[n+3]=i[3],t[n+4]=i[4],t[n+5]=i[5],t[n+6]=i[6],t[n+7]=i[7],t[n+8]=i[8],t}clone(){return new this.constructor().fromArray(this.elements)}},hg=new Vt,Hb=new Vt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Gb=new Vt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function VT(){let e={enabled:!0,workingColorSpace:Fl,spaces:{},convert:function(s,a,r){return this.enabled===!1||a===r||!a||!r||(this.spaces[a].transfer===fe&&(s.r=Es(s.r),s.g=Es(s.g),s.b=Es(s.b)),this.spaces[a].primaries!==this.spaces[r].primaries&&(s.applyMatrix3(this.spaces[a].toXYZ),s.applyMatrix3(this.spaces[r].fromXYZ)),this.spaces[r].transfer===fe&&(s.r=po(s.r),s.g=po(s.g),s.b=po(s.b))),s},workingToColorSpace:function(s,a){return this.convert(s,this.workingColorSpace,a)},colorSpaceToWorking:function(s,a){return this.convert(s,a,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===ws?Vl:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,a=this.workingColorSpace){return s.fromArray(this.spaces[a].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,a,r){return s.copy(this.spaces[a].toXYZ).multiply(this.spaces[r].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,a){return ja("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),e.workingToColorSpace(s,a)},toWorkingColorSpace:function(s,a){return ja("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),e.colorSpaceToWorking(s,a)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],i=[.3127,.329];return e.define({[Fl]:{primaries:t,whitePoint:i,transfer:Vl,toXYZ:Hb,fromXYZ:Gb,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:wn},outputColorSpaceConfig:{drawingBufferColorSpace:wn}},[wn]:{primaries:t,whitePoint:i,transfer:fe,toXYZ:Hb,fromXYZ:Gb,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:wn}}}),e}var ne=VT();function Es(e){return e<.04045?e*.0773993808:Math.pow(e*.9478672986+.0521327014,2.4)}function po(e){return e<.0031308?e*12.92:1.055*Math.pow(e,.41666)-.055}var eo,Wh=class{static getDataURL(t,n="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let i;if(t instanceof HTMLCanvasElement)i=t;else{eo===void 0&&(eo=Gl("canvas")),eo.width=t.width,eo.height=t.height;let s=eo.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),i=eo}return i.toDataURL(n)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let n=Gl("canvas");n.width=t.width,n.height=t.height;let i=n.getContext("2d");i.drawImage(t,0,0,t.width,t.height);let s=i.getImageData(0,0,t.width,t.height),a=s.data;for(let r=0;r<a.length;r++)a[r]=Es(a[r]/255)*255;return i.putImageData(s,0,0),n}else if(t.data){let n=t.data.slice(0);for(let i=0;i<n.length;i++)n instanceof Uint8Array||n instanceof Uint8ClampedArray?n[i]=Math.floor(Es(n[i]/255)*255):n[i]=Es(n[i]);return{data:n,width:t.width,height:t.height}}else return It("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},HT=0,go=class{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:HT++}),this.uuid=vc(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let n=this.data;return typeof HTMLVideoElement<"u"&&n instanceof HTMLVideoElement?t.set(n.videoWidth,n.videoHeight,0):typeof VideoFrame<"u"&&n instanceof VideoFrame?t.set(n.displayWidth,n.displayHeight,0):n!==null?t.set(n.width,n.height,n.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let n=t===void 0||typeof t=="string";if(!n&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let i={uuid:this.uuid,url:""},s=this.data;if(s!==null){let a;if(Array.isArray(s)){a=[];for(let r=0,o=s.length;r<o;r++)s[r].isDataTexture?a.push(fg(s[r].image)):a.push(fg(s[r]))}else a=fg(s);i.url=a}return n||(t.images[this.uuid]=i),i}};function fg(e){return typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap?Wh.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(It("Texture: Unable to serialize Texture."),{})}var GT=0,dg=new L,bn=class e extends Xi{constructor(t=e.DEFAULT_IMAGE,n=e.DEFAULT_MAPPING,i=Hi,s=Hi,a=mn,r=xa,o=yi,c=ii,l=e.DEFAULT_ANISOTROPY,h=ws){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:GT++}),this.uuid=vc(),this.name="",this.source=new go(t),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=i,this.wrapT=s,this.magFilter=a,this.minFilter=r,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=c,this.offset=new Lt(0,0),this.repeat=new Lt(1,1),this.center=new Lt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Vt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(dg).x}get height(){return this.source.getSize(dg).y}get depth(){return this.source.getSize(dg).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,n){this.updateRanges.push({start:t,count:n})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let n in t){let i=t[n];if(i===void 0){It(`Texture.setValues(): parameter '${n}' has value of undefined.`);continue}let s=this[n];if(s===void 0){It(`Texture.setValues(): property '${n}' does not exist.`);continue}s&&i&&s.isVector2&&i.isVector2||s&&i&&s.isVector3&&i.isVector3||s&&i&&s.isMatrix3&&i.isMatrix3?s.copy(i):this[n]=i}}toJSON(t){let n=t===void 0||typeof t=="string";if(!n&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),n||(t.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==n0)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Hh:t.x=t.x-Math.floor(t.x);break;case Hi:t.x=t.x<0?0:1;break;case Gh:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Hh:t.y=t.y-Math.floor(t.y);break;case Hi:t.y=t.y<0?0:1;break;case Gh:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};bn.DEFAULT_IMAGE=null;bn.DEFAULT_MAPPING=n0;bn.DEFAULT_ANISOTROPY=1;var Oe=class e{static{e.prototype.isVector4=!0}constructor(t=0,n=0,i=0,s=1){this.x=t,this.y=n,this.z=i,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,n,i,s){return this.x=t,this.y=n,this.z=i,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;case 3:this.w=n;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this.z=t.z+n.z,this.w=t.w+n.w,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this.z+=t.z*n,this.w+=t.w*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this.z=t.z-n.z,this.w=t.w-n.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let n=this.x,i=this.y,s=this.z,a=this.w,r=t.elements;return this.x=r[0]*n+r[4]*i+r[8]*s+r[12]*a,this.y=r[1]*n+r[5]*i+r[9]*s+r[13]*a,this.z=r[2]*n+r[6]*i+r[10]*s+r[14]*a,this.w=r[3]*n+r[7]*i+r[11]*s+r[15]*a,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let n=Math.sqrt(1-t.w*t.w);return n<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/n,this.y=t.y/n,this.z=t.z/n),this}setAxisAngleFromRotationMatrix(t){let n,i,s,a,c=t.elements,l=c[0],h=c[4],d=c[8],u=c[1],p=c[5],m=c[9],S=c[2],v=c[6],f=c[10];if(Math.abs(h-u)<.01&&Math.abs(d-S)<.01&&Math.abs(m-v)<.01){if(Math.abs(h+u)<.1&&Math.abs(d+S)<.1&&Math.abs(m+v)<.1&&Math.abs(l+p+f-3)<.1)return this.set(1,0,0,0),this;n=Math.PI;let y=(l+1)/2,_=(p+1)/2,T=(f+1)/2,A=(h+u)/4,w=(d+S)/4,x=(m+v)/4;return y>_&&y>T?y<.01?(i=0,s=.707106781,a=.707106781):(i=Math.sqrt(y),s=A/i,a=w/i):_>T?_<.01?(i=.707106781,s=0,a=.707106781):(s=Math.sqrt(_),i=A/s,a=x/s):T<.01?(i=.707106781,s=.707106781,a=0):(a=Math.sqrt(T),i=w/a,s=x/a),this.set(i,s,a,n),this}let g=Math.sqrt((v-m)*(v-m)+(d-S)*(d-S)+(u-h)*(u-h));return Math.abs(g)<.001&&(g=1),this.x=(v-m)/g,this.y=(d-S)/g,this.z=(u-h)/g,this.w=Math.acos((l+p+f-1)/2),this}setFromMatrixPosition(t){let n=t.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this.w=n[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,n){return this.x=$t(this.x,t.x,n.x),this.y=$t(this.y,t.y,n.y),this.z=$t(this.z,t.z,n.z),this.w=$t(this.w,t.w,n.w),this}clampScalar(t,n){return this.x=$t(this.x,t,n),this.y=$t(this.y,t,n),this.z=$t(this.z,t,n),this.w=$t(this.w,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar($t(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this.z+=(t.z-this.z)*n,this.w+=(t.w-this.w)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this.z=t.z+(n.z-t.z)*i,this.w=t.w+(n.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this.z=t[n+2],this.w=t[n+3],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t[n+2]=this.z,t[n+3]=this.w,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this.z=t.getZ(n),this.w=t.getW(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},qh=class extends Xi{constructor(t=1,n=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:mn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=t,this.height=n,this.depth=i.depth,this.scissor=new Oe(0,0,t,n),this.scissorTest=!1,this.viewport=new Oe(0,0,t,n),this.textures=[];let s={width:t,height:n,depth:i.depth},a=new bn(s),r=i.count;for(let o=0;o<r;o++)this.textures[o]=a.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(t={}){let n={minFilter:mn,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(n.mapping=t.mapping),t.wrapS!==void 0&&(n.wrapS=t.wrapS),t.wrapT!==void 0&&(n.wrapT=t.wrapT),t.wrapR!==void 0&&(n.wrapR=t.wrapR),t.magFilter!==void 0&&(n.magFilter=t.magFilter),t.minFilter!==void 0&&(n.minFilter=t.minFilter),t.format!==void 0&&(n.format=t.format),t.type!==void 0&&(n.type=t.type),t.anisotropy!==void 0&&(n.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(n.colorSpace=t.colorSpace),t.flipY!==void 0&&(n.flipY=t.flipY),t.generateMipmaps!==void 0&&(n.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(n.internalFormat=t.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(n)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),t!==null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,n,i=1){if(this.width!==t||this.height!==n||this.depth!==i){this.width=t,this.height=n,this.depth=i;for(let s=0,a=this.textures.length;s<a;s++)this.textures[s].image.width=t,this.textures[s].image.height=n,this.textures[s].image.depth=i,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,n),this.scissor.set(0,0,t,n)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,i=t.textures.length;n<i;n++){this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0,this.textures[n].renderTarget=this;let s=Object.assign({},t.textures[n].image);this.textures[n].source=new go(s)}return this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},Qn=class extends qh{constructor(t=1,n=1,i={}){super(t,n,i),this.isWebGLRenderTarget=!0}},kl=class extends bn{constructor(t=null,n=1,i=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:n,height:i,depth:s},this.magFilter=cn,this.minFilter=cn,this.wrapR=Hi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var Yh=class extends bn{constructor(t=null,n=1,i=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:n,height:i,depth:s},this.magFilter=cn,this.minFilter=cn,this.wrapR=Hi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ie=class e{static{e.prototype.isMatrix4=!0}constructor(t,n,i,s,a,r,o,c,l,h,d,u,p,m,S,v){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,n,i,s,a,r,o,c,l,h,d,u,p,m,S,v)}set(t,n,i,s,a,r,o,c,l,h,d,u,p,m,S,v){let f=this.elements;return f[0]=t,f[4]=n,f[8]=i,f[12]=s,f[1]=a,f[5]=r,f[9]=o,f[13]=c,f[2]=l,f[6]=h,f[10]=d,f[14]=u,f[3]=p,f[7]=m,f[11]=S,f[15]=v,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(t){let n=this.elements,i=t.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],n[9]=i[9],n[10]=i[10],n[11]=i[11],n[12]=i[12],n[13]=i[13],n[14]=i[14],n[15]=i[15],this}copyPosition(t){let n=this.elements,i=t.elements;return n[12]=i[12],n[13]=i[13],n[14]=i[14],this}setFromMatrix3(t){let n=t.elements;return this.set(n[0],n[3],n[6],0,n[1],n[4],n[7],0,n[2],n[5],n[8],0,0,0,0,1),this}extractBasis(t,n,i){return this.determinantAffine()===0?(t.set(1,0,0),n.set(0,1,0),i.set(0,0,1),this):(t.setFromMatrixColumn(this,0),n.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(t,n,i){return this.set(t.x,n.x,i.x,0,t.y,n.y,i.y,0,t.z,n.z,i.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let n=this.elements,i=t.elements,s=1/no.setFromMatrixColumn(t,0).length(),a=1/no.setFromMatrixColumn(t,1).length(),r=1/no.setFromMatrixColumn(t,2).length();return n[0]=i[0]*s,n[1]=i[1]*s,n[2]=i[2]*s,n[3]=0,n[4]=i[4]*a,n[5]=i[5]*a,n[6]=i[6]*a,n[7]=0,n[8]=i[8]*r,n[9]=i[9]*r,n[10]=i[10]*r,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromEuler(t){let n=this.elements,i=t.x,s=t.y,a=t.z,r=Math.cos(i),o=Math.sin(i),c=Math.cos(s),l=Math.sin(s),h=Math.cos(a),d=Math.sin(a);if(t.order==="XYZ"){let u=r*h,p=r*d,m=o*h,S=o*d;n[0]=c*h,n[4]=-c*d,n[8]=l,n[1]=p+m*l,n[5]=u-S*l,n[9]=-o*c,n[2]=S-u*l,n[6]=m+p*l,n[10]=r*c}else if(t.order==="YXZ"){let u=c*h,p=c*d,m=l*h,S=l*d;n[0]=u+S*o,n[4]=m*o-p,n[8]=r*l,n[1]=r*d,n[5]=r*h,n[9]=-o,n[2]=p*o-m,n[6]=S+u*o,n[10]=r*c}else if(t.order==="ZXY"){let u=c*h,p=c*d,m=l*h,S=l*d;n[0]=u-S*o,n[4]=-r*d,n[8]=m+p*o,n[1]=p+m*o,n[5]=r*h,n[9]=S-u*o,n[2]=-r*l,n[6]=o,n[10]=r*c}else if(t.order==="ZYX"){let u=r*h,p=r*d,m=o*h,S=o*d;n[0]=c*h,n[4]=m*l-p,n[8]=u*l+S,n[1]=c*d,n[5]=S*l+u,n[9]=p*l-m,n[2]=-l,n[6]=o*c,n[10]=r*c}else if(t.order==="YZX"){let u=r*c,p=r*l,m=o*c,S=o*l;n[0]=c*h,n[4]=S-u*d,n[8]=m*d+p,n[1]=d,n[5]=r*h,n[9]=-o*h,n[2]=-l*h,n[6]=p*d+m,n[10]=u-S*d}else if(t.order==="XZY"){let u=r*c,p=r*l,m=o*c,S=o*l;n[0]=c*h,n[4]=-d,n[8]=l*h,n[1]=u*d+S,n[5]=r*h,n[9]=p*d-m,n[2]=m*d-p,n[6]=o*h,n[10]=S*d+u}return n[3]=0,n[7]=0,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromQuaternion(t){return this.compose(kT,t,XT)}lookAt(t,n,i){let s=this.elements;return Jn.subVectors(t,n),Jn.lengthSq()===0&&(Jn.z=1),Jn.normalize(),aa.crossVectors(i,Jn),aa.lengthSq()===0&&(Math.abs(i.z)===1?Jn.x+=1e-4:Jn.z+=1e-4,Jn.normalize(),aa.crossVectors(i,Jn)),aa.normalize(),ah.crossVectors(Jn,aa),s[0]=aa.x,s[4]=ah.x,s[8]=Jn.x,s[1]=aa.y,s[5]=ah.y,s[9]=Jn.y,s[2]=aa.z,s[6]=ah.z,s[10]=Jn.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,n){let i=t.elements,s=n.elements,a=this.elements,r=i[0],o=i[4],c=i[8],l=i[12],h=i[1],d=i[5],u=i[9],p=i[13],m=i[2],S=i[6],v=i[10],f=i[14],g=i[3],y=i[7],_=i[11],T=i[15],A=s[0],w=s[4],x=s[8],M=s[12],R=s[1],D=s[5],I=s[9],q=s[13],J=s[2],z=s[6],B=s[10],V=s[14],j=s[3],lt=s[7],ut=s[11],ct=s[15];return a[0]=r*A+o*R+c*J+l*j,a[4]=r*w+o*D+c*z+l*lt,a[8]=r*x+o*I+c*B+l*ut,a[12]=r*M+o*q+c*V+l*ct,a[1]=h*A+d*R+u*J+p*j,a[5]=h*w+d*D+u*z+p*lt,a[9]=h*x+d*I+u*B+p*ut,a[13]=h*M+d*q+u*V+p*ct,a[2]=m*A+S*R+v*J+f*j,a[6]=m*w+S*D+v*z+f*lt,a[10]=m*x+S*I+v*B+f*ut,a[14]=m*M+S*q+v*V+f*ct,a[3]=g*A+y*R+_*J+T*j,a[7]=g*w+y*D+_*z+T*lt,a[11]=g*x+y*I+_*B+T*ut,a[15]=g*M+y*q+_*V+T*ct,this}multiplyScalar(t){let n=this.elements;return n[0]*=t,n[4]*=t,n[8]*=t,n[12]*=t,n[1]*=t,n[5]*=t,n[9]*=t,n[13]*=t,n[2]*=t,n[6]*=t,n[10]*=t,n[14]*=t,n[3]*=t,n[7]*=t,n[11]*=t,n[15]*=t,this}determinant(){let t=this.elements,n=t[0],i=t[4],s=t[8],a=t[12],r=t[1],o=t[5],c=t[9],l=t[13],h=t[2],d=t[6],u=t[10],p=t[14],m=t[3],S=t[7],v=t[11],f=t[15],g=c*p-l*u,y=o*p-l*d,_=o*u-c*d,T=r*p-l*h,A=r*u-c*h,w=r*d-o*h;return n*(S*g-v*y+f*_)-i*(m*g-v*T+f*A)+s*(m*y-S*T+f*w)-a*(m*_-S*A+v*w)}determinantAffine(){let t=this.elements,n=t[0],i=t[4],s=t[8],a=t[1],r=t[5],o=t[9],c=t[2],l=t[6],h=t[10];return n*(r*h-o*l)-i*(a*h-o*c)+s*(a*l-r*c)}transpose(){let t=this.elements,n;return n=t[1],t[1]=t[4],t[4]=n,n=t[2],t[2]=t[8],t[8]=n,n=t[6],t[6]=t[9],t[9]=n,n=t[3],t[3]=t[12],t[12]=n,n=t[7],t[7]=t[13],t[13]=n,n=t[11],t[11]=t[14],t[14]=n,this}setPosition(t,n,i){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=n,s[14]=i),this}invert(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],c=t[6],l=t[7],h=t[8],d=t[9],u=t[10],p=t[11],m=t[12],S=t[13],v=t[14],f=t[15],g=n*o-i*r,y=n*c-s*r,_=n*l-a*r,T=i*c-s*o,A=i*l-a*o,w=s*l-a*c,x=h*S-d*m,M=h*v-u*m,R=h*f-p*m,D=d*v-u*S,I=d*f-p*S,q=u*f-p*v,J=g*q-y*I+_*D+T*R-A*M+w*x;if(J===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let z=1/J;return t[0]=(o*q-c*I+l*D)*z,t[1]=(s*I-i*q-a*D)*z,t[2]=(S*w-v*A+f*T)*z,t[3]=(u*A-d*w-p*T)*z,t[4]=(c*R-r*q-l*M)*z,t[5]=(n*q-s*R+a*M)*z,t[6]=(v*_-m*w-f*y)*z,t[7]=(h*w-u*_+p*y)*z,t[8]=(r*I-o*R+l*x)*z,t[9]=(i*R-n*I-a*x)*z,t[10]=(m*A-S*_+f*g)*z,t[11]=(d*_-h*A-p*g)*z,t[12]=(o*M-r*D-c*x)*z,t[13]=(n*D-i*M+s*x)*z,t[14]=(S*y-m*T-v*g)*z,t[15]=(h*T-d*y+u*g)*z,this}scale(t){let n=this.elements,i=t.x,s=t.y,a=t.z;return n[0]*=i,n[4]*=s,n[8]*=a,n[1]*=i,n[5]*=s,n[9]*=a,n[2]*=i,n[6]*=s,n[10]*=a,n[3]*=i,n[7]*=s,n[11]*=a,this}getMaxScaleOnAxis(){let t=this.elements,n=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(n,i,s))}makeTranslation(t,n,i){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,n,0,0,1,i,0,0,0,1),this}makeRotationX(t){let n=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,n,-i,0,0,i,n,0,0,0,0,1),this}makeRotationY(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,0,i,0,0,1,0,0,-i,0,n,0,0,0,0,1),this}makeRotationZ(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,-i,0,0,i,n,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,n){let i=Math.cos(n),s=Math.sin(n),a=1-i,r=t.x,o=t.y,c=t.z,l=a*r,h=a*o;return this.set(l*r+i,l*o-s*c,l*c+s*o,0,l*o+s*c,h*o+i,h*c-s*r,0,l*c-s*o,h*c+s*r,a*c*c+i,0,0,0,0,1),this}makeScale(t,n,i){return this.set(t,0,0,0,0,n,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,n,i,s,a,r){return this.set(1,i,a,0,t,1,r,0,n,s,1,0,0,0,0,1),this}compose(t,n,i){let s=this.elements,a=n._x,r=n._y,o=n._z,c=n._w,l=a+a,h=r+r,d=o+o,u=a*l,p=a*h,m=a*d,S=r*h,v=r*d,f=o*d,g=c*l,y=c*h,_=c*d,T=i.x,A=i.y,w=i.z;return s[0]=(1-(S+f))*T,s[1]=(p+_)*T,s[2]=(m-y)*T,s[3]=0,s[4]=(p-_)*A,s[5]=(1-(u+f))*A,s[6]=(v+g)*A,s[7]=0,s[8]=(m+y)*w,s[9]=(v-g)*w,s[10]=(1-(u+S))*w,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,n,i){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let a=this.determinantAffine();if(a===0)return i.set(1,1,1),n.identity(),this;let r=no.set(s[0],s[1],s[2]).length(),o=no.set(s[4],s[5],s[6]).length(),c=no.set(s[8],s[9],s[10]).length();a<0&&(r=-r),Mi.copy(this);let l=1/r,h=1/o,d=1/c;return Mi.elements[0]*=l,Mi.elements[1]*=l,Mi.elements[2]*=l,Mi.elements[4]*=h,Mi.elements[5]*=h,Mi.elements[6]*=h,Mi.elements[8]*=d,Mi.elements[9]*=d,Mi.elements[10]*=d,n.setFromRotationMatrix(Mi),i.x=r,i.y=o,i.z=c,this}makePerspective(t,n,i,s,a,r,o=Ai,c=!1){let l=this.elements,h=2*a/(n-t),d=2*a/(i-s),u=(n+t)/(n-t),p=(i+s)/(i-s),m,S;if(c)m=a/(r-a),S=r*a/(r-a);else if(o===Ai)m=-(r+a)/(r-a),S=-2*r*a/(r-a);else if(o===Hl)m=-r/(r-a),S=-r*a/(r-a);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=h,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=d,l[9]=p,l[13]=0,l[2]=0,l[6]=0,l[10]=m,l[14]=S,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,n,i,s,a,r,o=Ai,c=!1){let l=this.elements,h=2/(n-t),d=2/(i-s),u=-(n+t)/(n-t),p=-(i+s)/(i-s),m,S;if(c)m=1/(r-a),S=r/(r-a);else if(o===Ai)m=-2/(r-a),S=-(r+a)/(r-a);else if(o===Hl)m=-1/(r-a),S=-a/(r-a);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=h,l[4]=0,l[8]=0,l[12]=u,l[1]=0,l[5]=d,l[9]=0,l[13]=p,l[2]=0,l[6]=0,l[10]=m,l[14]=S,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){let n=this.elements,i=t.elements;for(let s=0;s<16;s++)if(n[s]!==i[s])return!1;return!0}fromArray(t,n=0){for(let i=0;i<16;i++)this.elements[i]=t[i+n];return this}toArray(t=[],n=0){let i=this.elements;return t[n]=i[0],t[n+1]=i[1],t[n+2]=i[2],t[n+3]=i[3],t[n+4]=i[4],t[n+5]=i[5],t[n+6]=i[6],t[n+7]=i[7],t[n+8]=i[8],t[n+9]=i[9],t[n+10]=i[10],t[n+11]=i[11],t[n+12]=i[12],t[n+13]=i[13],t[n+14]=i[14],t[n+15]=i[15],t}},no=new L,Mi=new Ie,kT=new L(0,0,0),XT=new L(1,1,1),aa=new L,ah=new L,Jn=new L,kb=new Ie,Xb=new Wi,fa=class e{constructor(t=0,n=0,i=0,s=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=i,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,n,i,s=this._order){return this._x=t,this._y=n,this._z=i,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,n=this._order,i=!0){let s=t.elements,a=s[0],r=s[4],o=s[8],c=s[1],l=s[5],h=s[9],d=s[2],u=s[6],p=s[10];switch(n){case"XYZ":this._y=Math.asin($t(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-r,a)):(this._x=Math.atan2(u,l),this._z=0);break;case"YXZ":this._x=Math.asin(-$t(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-d,a),this._z=0);break;case"ZXY":this._x=Math.asin($t(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-d,p),this._z=Math.atan2(-r,l)):(this._y=0,this._z=Math.atan2(c,a));break;case"ZYX":this._y=Math.asin(-$t(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(u,p),this._z=Math.atan2(c,a)):(this._x=0,this._z=Math.atan2(-r,l));break;case"YZX":this._z=Math.asin($t(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,l),this._y=Math.atan2(-d,a)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-$t(r,-1,1)),Math.abs(r)<.9999999?(this._x=Math.atan2(u,l),this._y=Math.atan2(o,a)):(this._x=Math.atan2(-h,p),this._y=0);break;default:It("Euler: .setFromRotationMatrix() encountered an unknown order: "+n)}return this._order=n,i===!0&&this._onChangeCallback(),this}setFromQuaternion(t,n,i){return kb.makeRotationFromQuaternion(t),this.setFromRotationMatrix(kb,n,i)}setFromVector3(t,n=this._order){return this.set(t.x,t.y,t.z,n)}reorder(t){return Xb.setFromEuler(this),this.setFromQuaternion(Xb,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],n=0){return t[n]=this._x,t[n+1]=this._y,t[n+2]=this._z,t[n+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};fa.DEFAULT_ORDER="XYZ";var Xl=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},WT=0,Wb=new L,io=new Wi,_s=new Ie,rh=new L,Nl=new L,qT=new L,YT=new Wi,qb=new L(1,0,0),Yb=new L(0,1,0),Zb=new L(0,0,1),Jb={type:"added"},ZT={type:"removed"},so={type:"childadded",child:null},pg={type:"childremoved",child:null},$n=class e extends Xi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:WT++}),this.uuid=vc(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new L,n=new fa,i=new Wi,s=new L(1,1,1);function a(){i.setFromEuler(n,!1)}function r(){n.setFromQuaternion(i,void 0,!1)}n._onChange(a),i._onChange(r),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Ie},normalMatrix:{value:new Vt}}),this.matrix=new Ie,this.matrixWorld=new Ie,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Xl,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,n){this.quaternion.setFromAxisAngle(t,n)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,n){return io.setFromAxisAngle(t,n),this.quaternion.multiply(io),this}rotateOnWorldAxis(t,n){return io.setFromAxisAngle(t,n),this.quaternion.premultiply(io),this}rotateX(t){return this.rotateOnAxis(qb,t)}rotateY(t){return this.rotateOnAxis(Yb,t)}rotateZ(t){return this.rotateOnAxis(Zb,t)}translateOnAxis(t,n){return Wb.copy(t).applyQuaternion(this.quaternion),this.position.add(Wb.multiplyScalar(n)),this}translateX(t){return this.translateOnAxis(qb,t)}translateY(t){return this.translateOnAxis(Yb,t)}translateZ(t){return this.translateOnAxis(Zb,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(_s.copy(this.matrixWorld).invert())}lookAt(t,n,i){t.isVector3?rh.copy(t):rh.set(t,n,i);let s=this.parent;this.updateWorldMatrix(!0,!1),Nl.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?_s.lookAt(Nl,rh,this.up):_s.lookAt(rh,Nl,this.up),this.quaternion.setFromRotationMatrix(_s),s&&(_s.extractRotation(s.matrixWorld),io.setFromRotationMatrix(_s),this.quaternion.premultiply(io.invert()))}add(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.add(arguments[n]);return this}return t===this?(zt("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Jb),so.child=t,this.dispatchEvent(so),so.child=null):zt("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let n=this.children.indexOf(t);return n!==-1&&(t.parent=null,this.children.splice(n,1),t.dispatchEvent(ZT),pg.child=t,this.dispatchEvent(pg),pg.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),_s.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),_s.multiply(t.parent.matrixWorld)),t.applyMatrix4(_s),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Jb),so.child=t,this.dispatchEvent(so),so.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,n){if(this[t]===n)return this;for(let i=0,s=this.children.length;i<s;i++){let r=this.children[i].getObjectByProperty(t,n);if(r!==void 0)return r}}getObjectsByProperty(t,n,i=[]){this[t]===n&&i.push(this);let s=this.children;for(let a=0,r=s.length;a<r;a++)s[a].getObjectsByProperty(t,n,i);return i}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Nl,t,qT),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Nl,YT,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let n=this.matrixWorld.elements;return t.set(n[8],n[9],n[10]).normalize()}raycast(){}traverse(t){t(this);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].traverseVisible(t)}traverseAncestors(t){let n=this.parent;n!==null&&(t(n),n.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let n=t.x,i=t.y,s=t.z,a=this.matrix.elements;a[12]+=n-a[0]*n-a[4]*i-a[8]*s,a[13]+=i-a[1]*n-a[5]*i-a[9]*s,a[14]+=s-a[2]*n-a[6]*i-a[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].updateMatrixWorld(t)}updateWorldMatrix(t,n,i=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),n===!0){let a=this.children;for(let r=0,o=a.length;r<o;r++)a[r].updateWorldMatrix(!1,!0,i)}}toJSON(t){let n=t===void 0||typeof t=="string",i={};n&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function a(o,c){return o[c.uuid]===void 0&&(o[c.uuid]=c.toJSON(t)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=a(t.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let c=o.shapes;if(Array.isArray(c))for(let l=0,h=c.length;l<h;l++){let d=c[l];a(t.shapes,d)}else a(t.shapes,c)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(a(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let c=0,l=this.material.length;c<l;c++)o.push(a(t.materials,this.material[c]));s.material=o}else s.material=a(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let c=this.animations[o];s.animations.push(a(t.animations,c))}}if(n){let o=r(t.geometries),c=r(t.materials),l=r(t.textures),h=r(t.images),d=r(t.shapes),u=r(t.skeletons),p=r(t.animations),m=r(t.nodes);o.length>0&&(i.geometries=o),c.length>0&&(i.materials=c),l.length>0&&(i.textures=l),h.length>0&&(i.images=h),d.length>0&&(i.shapes=d),u.length>0&&(i.skeletons=u),p.length>0&&(i.animations=p),m.length>0&&(i.nodes=m)}return i.object=s,i;function r(o){let c=[];for(let l in o){let h=o[l];delete h.metadata,c.push(h)}return c}}clone(t){return new this.constructor().copy(this,t)}copy(t,n=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),n===!0)for(let i=0;i<t.children.length;i++){let s=t.children[i];this.add(s.clone())}return this}};$n.DEFAULT_UP=new L(0,1,0);$n.DEFAULT_MATRIX_AUTO_UPDATE=!0;$n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Gi=class extends $n{constructor(){super(),this.isGroup=!0,this.type="Group"}},JT={type:"move"},vo=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Gi,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Gi,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new L,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new L),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Gi,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new L,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new L,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let n=this._hand;if(n)for(let i of t.hand.values())this._getHandJoint(n,i)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,n,i){let s=null,a=null,r=null,o=this._targetRay,c=this._grip,l=this._hand;if(t&&n.session.visibilityState!=="visible-blurred"){if(l&&t.hand){r=!0;for(let S of t.hand.values()){let v=n.getJointPose(S,i),f=this._getHandJoint(l,S);v!==null&&(f.matrix.fromArray(v.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=v.radius),f.visible=v!==null}let h=l.joints["index-finger-tip"],d=l.joints["thumb-tip"],u=h.position.distanceTo(d.position),p=.02,m=.005;l.inputState.pinching&&u>p+m?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!l.inputState.pinching&&u<=p-m&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else c!==null&&t.gripSpace&&(a=n.getPose(t.gripSpace,i),a!==null&&(c.matrix.fromArray(a.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,a.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(a.linearVelocity)):c.hasLinearVelocity=!1,a.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(a.angularVelocity)):c.hasAngularVelocity=!1,c.eventsEnabled&&c.dispatchEvent({type:"gripUpdated",data:t,target:this})));o!==null&&(s=n.getPose(t.targetRaySpace,i),s===null&&a!==null&&(s=a),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(JT)))}return o!==null&&(o.visible=s!==null),c!==null&&(c.visible=a!==null),l!==null&&(l.visible=r!==null),this}_getHandJoint(t,n){if(t.joints[n.jointName]===void 0){let i=new Gi;i.matrixAutoUpdate=!1,i.visible=!1,t.joints[n.jointName]=i,t.add(i)}return t.joints[n.jointName]}},qS={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ra={h:0,s:0,l:0},oh={h:0,s:0,l:0};function mg(e,t,n){return n<0&&(n+=1),n>1&&(n-=1),n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var te=class{constructor(t,n,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,n,i)}set(t,n,i){if(n===void 0&&i===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,n,i);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,n=wn){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,ne.colorSpaceToWorking(this,n),this}setRGB(t,n,i,s=ne.workingColorSpace){return this.r=t,this.g=n,this.b=i,ne.colorSpaceToWorking(this,s),this}setHSL(t,n,i,s=ne.workingColorSpace){if(t=FT(t,1),n=$t(n,0,1),i=$t(i,0,1),n===0)this.r=this.g=this.b=i;else{let a=i<=.5?i*(1+n):i+n-i*n,r=2*i-a;this.r=mg(r,a,t+1/3),this.g=mg(r,a,t),this.b=mg(r,a,t-1/3)}return ne.colorSpaceToWorking(this,s),this}setStyle(t,n=wn){function i(a){a!==void 0&&parseFloat(a)<1&&It("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let a,r=s[1],o=s[2];switch(r){case"rgb":case"rgba":if(a=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setRGB(Math.min(255,parseInt(a[1],10))/255,Math.min(255,parseInt(a[2],10))/255,Math.min(255,parseInt(a[3],10))/255,n);if(a=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setRGB(Math.min(100,parseInt(a[1],10))/100,Math.min(100,parseInt(a[2],10))/100,Math.min(100,parseInt(a[3],10))/100,n);break;case"hsl":case"hsla":if(a=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setHSL(parseFloat(a[1])/360,parseFloat(a[2])/100,parseFloat(a[3])/100,n);break;default:It("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let a=s[1],r=a.length;if(r===3)return this.setRGB(parseInt(a.charAt(0),16)/15,parseInt(a.charAt(1),16)/15,parseInt(a.charAt(2),16)/15,n);if(r===6)return this.setHex(parseInt(a,16),n);It("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,n);return this}setColorName(t,n=wn){let i=qS[t.toLowerCase()];return i!==void 0?this.setHex(i,n):It("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Es(t.r),this.g=Es(t.g),this.b=Es(t.b),this}copyLinearToSRGB(t){return this.r=po(t.r),this.g=po(t.g),this.b=po(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=wn){return ne.workingToColorSpace(yn.copy(this),t),Math.round($t(yn.r*255,0,255))*65536+Math.round($t(yn.g*255,0,255))*256+Math.round($t(yn.b*255,0,255))}getHexString(t=wn){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,n=ne.workingColorSpace){ne.workingToColorSpace(yn.copy(this),n);let i=yn.r,s=yn.g,a=yn.b,r=Math.max(i,s,a),o=Math.min(i,s,a),c,l,h=(o+r)/2;if(o===r)c=0,l=0;else{let d=r-o;switch(l=h<=.5?d/(r+o):d/(2-r-o),r){case i:c=(s-a)/d+(s<a?6:0);break;case s:c=(a-i)/d+2;break;case a:c=(i-s)/d+4;break}c/=6}return t.h=c,t.s=l,t.l=h,t}getRGB(t,n=ne.workingColorSpace){return ne.workingToColorSpace(yn.copy(this),n),t.r=yn.r,t.g=yn.g,t.b=yn.b,t}getStyle(t=wn){ne.workingToColorSpace(yn.copy(this),t);let n=yn.r,i=yn.g,s=yn.b;return t!==wn?`color(${t} ${n.toFixed(3)} ${i.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(n*255)},${Math.round(i*255)},${Math.round(s*255)})`}offsetHSL(t,n,i){return this.getHSL(ra),this.setHSL(ra.h+t,ra.s+n,ra.l+i)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,n){return this.r=t.r+n.r,this.g=t.g+n.g,this.b=t.b+n.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,n){return this.r+=(t.r-this.r)*n,this.g+=(t.g-this.g)*n,this.b+=(t.b-this.b)*n,this}lerpColors(t,n,i){return this.r=t.r+(n.r-t.r)*i,this.g=t.g+(n.g-t.g)*i,this.b=t.b+(n.b-t.b)*i,this}lerpHSL(t,n){this.getHSL(ra),t.getHSL(oh);let i=cg(ra.h,oh.h,n),s=cg(ra.s,oh.s,n),a=cg(ra.l,oh.l,n);return this.setHSL(i,s,a),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let n=this.r,i=this.g,s=this.b,a=t.elements;return this.r=a[0]*n+a[3]*i+a[6]*s,this.g=a[1]*n+a[4]*i+a[7]*s,this.b=a[2]*n+a[5]*i+a[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,n=0){return this.r=t[n],this.g=t[n+1],this.b=t[n+2],this}toArray(t=[],n=0){return t[n]=this.r,t[n+1]=this.g,t[n+2]=this.b,t}fromBufferAttribute(t,n){return this.r=t.getX(n),this.g=t.getY(n),this.b=t.getZ(n),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},yn=new te;te.NAMES=qS;var Wl=class e{constructor(t,n=1,i=1e3){this.isFog=!0,this.name="",this.color=new te(t),this.near=n,this.far=i}clone(){return new e(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},ql=class extends $n{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new fa,this.environmentIntensity=1,this.environmentRotation=new fa,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,n){return super.copy(t,n),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let n=super.toJSON(t);return this.fog!==null&&(n.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(n.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(n.object.backgroundIntensity=this.backgroundIntensity),n.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(n.object.environmentIntensity=this.environmentIntensity),n.object.environmentRotation=this.environmentRotation.toArray(),n}},Ei=new L,ys=new L,gg=new L,xs=new L,ao=new L,ro=new L,Kb=new L,vg=new L,_g=new L,yg=new L,xg=new Oe,bg=new Oe,Sg=new Oe,Ms=class e{constructor(t=new L,n=new L,i=new L){this.a=t,this.b=n,this.c=i}static getNormal(t,n,i,s){s.subVectors(i,n),Ei.subVectors(t,n),s.cross(Ei);let a=s.lengthSq();return a>0?s.multiplyScalar(1/Math.sqrt(a)):s.set(0,0,0)}static getBarycoord(t,n,i,s,a){Ei.subVectors(s,n),ys.subVectors(i,n),gg.subVectors(t,n);let r=Ei.dot(Ei),o=Ei.dot(ys),c=Ei.dot(gg),l=ys.dot(ys),h=ys.dot(gg),d=r*l-o*o;if(d===0)return a.set(0,0,0),null;let u=1/d,p=(l*c-o*h)*u,m=(r*h-o*c)*u;return a.set(1-p-m,m,p)}static containsPoint(t,n,i,s){return this.getBarycoord(t,n,i,s,xs)===null?!1:xs.x>=0&&xs.y>=0&&xs.x+xs.y<=1}static getInterpolation(t,n,i,s,a,r,o,c){return this.getBarycoord(t,n,i,s,xs)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(a,xs.x),c.addScaledVector(r,xs.y),c.addScaledVector(o,xs.z),c)}static getInterpolatedAttribute(t,n,i,s,a,r){return xg.setScalar(0),bg.setScalar(0),Sg.setScalar(0),xg.fromBufferAttribute(t,n),bg.fromBufferAttribute(t,i),Sg.fromBufferAttribute(t,s),r.setScalar(0),r.addScaledVector(xg,a.x),r.addScaledVector(bg,a.y),r.addScaledVector(Sg,a.z),r}static isFrontFacing(t,n,i,s){return Ei.subVectors(i,n),ys.subVectors(t,n),Ei.cross(ys).dot(s)<0}set(t,n,i){return this.a.copy(t),this.b.copy(n),this.c.copy(i),this}setFromPointsAndIndices(t,n,i,s){return this.a.copy(t[n]),this.b.copy(t[i]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,n,i,s){return this.a.fromBufferAttribute(t,n),this.b.fromBufferAttribute(t,i),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Ei.subVectors(this.c,this.b),ys.subVectors(this.a,this.b),Ei.cross(ys).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,i,s,a){return e.getInterpolation(t,this.a,this.b,this.c,n,i,s,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,n){let i=this.a,s=this.b,a=this.c,r,o;ao.subVectors(s,i),ro.subVectors(a,i),vg.subVectors(t,i);let c=ao.dot(vg),l=ro.dot(vg);if(c<=0&&l<=0)return n.copy(i);_g.subVectors(t,s);let h=ao.dot(_g),d=ro.dot(_g);if(h>=0&&d<=h)return n.copy(s);let u=c*d-h*l;if(u<=0&&c>=0&&h<=0)return r=c/(c-h),n.copy(i).addScaledVector(ao,r);yg.subVectors(t,a);let p=ao.dot(yg),m=ro.dot(yg);if(m>=0&&p<=m)return n.copy(a);let S=p*l-c*m;if(S<=0&&l>=0&&m<=0)return o=l/(l-m),n.copy(i).addScaledVector(ro,o);let v=h*m-p*d;if(v<=0&&d-h>=0&&p-m>=0)return Kb.subVectors(a,s),o=(d-h)/(d-h+(p-m)),n.copy(s).addScaledVector(Kb,o);let f=1/(v+S+u);return r=S*f,o=u*f,n.copy(i).addScaledVector(ao,r).addScaledVector(ro,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},da=class{constructor(t=new L(1/0,1/0,1/0),n=new L(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=n}set(t,n){return this.min.copy(t),this.max.copy(n),this}setFromArray(t){this.makeEmpty();for(let n=0,i=t.length;n<i;n+=3)this.expandByPoint(Ti.fromArray(t,n));return this}setFromBufferAttribute(t){this.makeEmpty();for(let n=0,i=t.count;n<i;n++)this.expandByPoint(Ti.fromBufferAttribute(t,n));return this}setFromPoints(t){this.makeEmpty();for(let n=0,i=t.length;n<i;n++)this.expandByPoint(t[n]);return this}setFromCenterAndSize(t,n){let i=Ti.copy(n).multiplyScalar(.5);return this.min.copy(t).sub(i),this.max.copy(t).add(i),this}setFromObject(t,n=!1){return this.makeEmpty(),this.expandByObject(t,n)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,n=!1){t.updateWorldMatrix(!1,!1);let i=t.geometry;if(i!==void 0){let a=i.getAttribute("position");if(n===!0&&a!==void 0&&t.isInstancedMesh!==!0)for(let r=0,o=a.count;r<o;r++)t.isMesh===!0?t.getVertexPosition(r,Ti):Ti.fromBufferAttribute(a,r),Ti.applyMatrix4(t.matrixWorld),this.expandByPoint(Ti);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),lh.copy(t.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),lh.copy(i.boundingBox)),lh.applyMatrix4(t.matrixWorld),this.union(lh)}let s=t.children;for(let a=0,r=s.length;a<r;a++)this.expandByObject(s[a],n);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,n){return n.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,Ti),Ti.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let n,i;return t.normal.x>0?(n=t.normal.x*this.min.x,i=t.normal.x*this.max.x):(n=t.normal.x*this.max.x,i=t.normal.x*this.min.x),t.normal.y>0?(n+=t.normal.y*this.min.y,i+=t.normal.y*this.max.y):(n+=t.normal.y*this.max.y,i+=t.normal.y*this.min.y),t.normal.z>0?(n+=t.normal.z*this.min.z,i+=t.normal.z*this.max.z):(n+=t.normal.z*this.max.z,i+=t.normal.z*this.min.z),n<=-t.constant&&i>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Ul),ch.subVectors(this.max,Ul),oo.subVectors(t.a,Ul),lo.subVectors(t.b,Ul),co.subVectors(t.c,Ul),oa.subVectors(lo,oo),la.subVectors(co,lo),qa.subVectors(oo,co);let n=[0,-oa.z,oa.y,0,-la.z,la.y,0,-qa.z,qa.y,oa.z,0,-oa.x,la.z,0,-la.x,qa.z,0,-qa.x,-oa.y,oa.x,0,-la.y,la.x,0,-qa.y,qa.x,0];return!Mg(n,oo,lo,co,ch)||(n=[1,0,0,0,1,0,0,0,1],!Mg(n,oo,lo,co,ch))?!1:(uh.crossVectors(oa,la),n=[uh.x,uh.y,uh.z],Mg(n,oo,lo,co,ch))}clampPoint(t,n){return n.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Ti).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Ti).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(bs[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),bs[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),bs[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),bs[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),bs[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),bs[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),bs[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),bs[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(bs),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},bs=[new L,new L,new L,new L,new L,new L,new L,new L],Ti=new L,lh=new da,oo=new L,lo=new L,co=new L,oa=new L,la=new L,qa=new L,Ul=new L,ch=new L,uh=new L,Ya=new L;function Mg(e,t,n,i,s){for(let a=0,r=e.length-3;a<=r;a+=3){Ya.fromArray(e,a);let o=s.x*Math.abs(Ya.x)+s.y*Math.abs(Ya.y)+s.z*Math.abs(Ya.z),c=t.dot(Ya),l=n.dot(Ya),h=i.dot(Ya);if(Math.max(-Math.max(c,l,h),Math.min(c,l,h))>o)return!1}return!0}var Ke=new L,hh=new Lt,KT=0,jn=class extends Xi{constructor(t,n,i=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:KT++}),this.name="",this.array=t,this.itemSize=n,this.count=t!==void 0?t.length/n:0,this.normalized=i,this.usage=Hg,this.updateRanges=[],this.gpuType=Ri,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,n){this.updateRanges.push({start:t,count:n})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,n,i){t*=this.itemSize,i*=n.itemSize;for(let s=0,a=this.itemSize;s<a;s++)this.array[t+s]=n.array[i+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let n=0,i=this.count;n<i;n++)hh.fromBufferAttribute(this,n),hh.applyMatrix3(t),this.setXY(n,hh.x,hh.y);else if(this.itemSize===3)for(let n=0,i=this.count;n<i;n++)Ke.fromBufferAttribute(this,n),Ke.applyMatrix3(t),this.setXYZ(n,Ke.x,Ke.y,Ke.z);return this}applyMatrix4(t){for(let n=0,i=this.count;n<i;n++)Ke.fromBufferAttribute(this,n),Ke.applyMatrix4(t),this.setXYZ(n,Ke.x,Ke.y,Ke.z);return this}applyNormalMatrix(t){for(let n=0,i=this.count;n<i;n++)Ke.fromBufferAttribute(this,n),Ke.applyNormalMatrix(t),this.setXYZ(n,Ke.x,Ke.y,Ke.z);return this}transformDirection(t){for(let n=0,i=this.count;n<i;n++)Ke.fromBufferAttribute(this,n),Ke.transformDirection(t),this.setXYZ(n,Ke.x,Ke.y,Ke.z);return this}set(t,n=0){return this.array.set(t,n),this}getComponent(t,n){let i=this.array[t*this.itemSize+n];return this.normalized&&(i=Dl(i,this.array)),i}setComponent(t,n,i){return this.normalized&&(i=Pn(i,this.array)),this.array[t*this.itemSize+n]=i,this}getX(t){let n=this.array[t*this.itemSize];return this.normalized&&(n=Dl(n,this.array)),n}setX(t,n){return this.normalized&&(n=Pn(n,this.array)),this.array[t*this.itemSize]=n,this}getY(t){let n=this.array[t*this.itemSize+1];return this.normalized&&(n=Dl(n,this.array)),n}setY(t,n){return this.normalized&&(n=Pn(n,this.array)),this.array[t*this.itemSize+1]=n,this}getZ(t){let n=this.array[t*this.itemSize+2];return this.normalized&&(n=Dl(n,this.array)),n}setZ(t,n){return this.normalized&&(n=Pn(n,this.array)),this.array[t*this.itemSize+2]=n,this}getW(t){let n=this.array[t*this.itemSize+3];return this.normalized&&(n=Dl(n,this.array)),n}setW(t,n){return this.normalized&&(n=Pn(n,this.array)),this.array[t*this.itemSize+3]=n,this}setXY(t,n,i){return t*=this.itemSize,this.normalized&&(n=Pn(n,this.array),i=Pn(i,this.array)),this.array[t+0]=n,this.array[t+1]=i,this}setXYZ(t,n,i,s){return t*=this.itemSize,this.normalized&&(n=Pn(n,this.array),i=Pn(i,this.array),s=Pn(s,this.array)),this.array[t+0]=n,this.array[t+1]=i,this.array[t+2]=s,this}setXYZW(t,n,i,s,a){return t*=this.itemSize,this.normalized&&(n=Pn(n,this.array),i=Pn(i,this.array),s=Pn(s,this.array),a=Pn(a,this.array)),this.array[t+0]=n,this.array[t+1]=i,this.array[t+2]=s,this.array[t+3]=a,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Hg&&(t.usage=this.usage),t}dispose(){this.dispatchEvent({type:"dispose"})}};var Yl=class extends jn{constructor(t,n,i){super(new Uint16Array(t),n,i)}};var Zl=class extends jn{constructor(t,n,i){super(new Uint32Array(t),n,i)}};var Te=class extends jn{constructor(t,n,i){super(new Float32Array(t),n,i)}},jT=new da,Ll=new L,Eg=new L,tr=class{constructor(t=new L,n=-1){this.isSphere=!0,this.center=t,this.radius=n}set(t,n){return this.center.copy(t),this.radius=n,this}setFromPoints(t,n){let i=this.center;n!==void 0?i.copy(n):jT.setFromPoints(t).getCenter(i);let s=0;for(let a=0,r=t.length;a<r;a++)s=Math.max(s,i.distanceToSquared(t[a]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let n=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=n*n}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,n){let i=this.center.distanceToSquared(t);return n.copy(t),i>this.radius*this.radius&&(n.sub(this.center).normalize(),n.multiplyScalar(this.radius).add(this.center)),n}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Ll.subVectors(t,this.center);let n=Ll.lengthSq();if(n>this.radius*this.radius){let i=Math.sqrt(n),s=(i-this.radius)*.5;this.center.addScaledVector(Ll,s/i),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Eg.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Ll.copy(t.center).add(Eg)),this.expandByPoint(Ll.copy(t.center).sub(Eg))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},QT=0,gi=new Ie,Tg=new $n,uo=new L,Kn=new da,Il=new da,ln=new L,Ve=class e extends Xi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:QT++}),this.uuid=vc(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(zT(t)?Zl:Yl)(t,1):this.index=t,this}setIndirect(t,n=0){return this.indirect=t,this.indirectOffset=n,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,n){return this.attributes[t]=n,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,n,i=0){this.groups.push({start:t,count:n,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(t,n){this.drawRange.start=t,this.drawRange.count=n}applyMatrix4(t){let n=this.attributes.position;n!==void 0&&(n.applyMatrix4(t),n.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let a=new Vt().getNormalMatrix(t);i.applyNormalMatrix(a),i.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return gi.makeRotationFromQuaternion(t),this.applyMatrix4(gi),this}rotateX(t){return gi.makeRotationX(t),this.applyMatrix4(gi),this}rotateY(t){return gi.makeRotationY(t),this.applyMatrix4(gi),this}rotateZ(t){return gi.makeRotationZ(t),this.applyMatrix4(gi),this}translate(t,n,i){return gi.makeTranslation(t,n,i),this.applyMatrix4(gi),this}scale(t,n,i){return gi.makeScale(t,n,i),this.applyMatrix4(gi),this}lookAt(t){return Tg.lookAt(t),Tg.updateMatrix(),this.applyMatrix4(Tg.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(uo).negate(),this.translate(uo.x,uo.y,uo.z),this}setFromPoints(t){let n=this.getAttribute("position");if(n===void 0){let i=[];for(let s=0,a=t.length;s<a;s++){let r=t[s];i.push(r.x,r.y,r.z||0)}this.setAttribute("position",new Te(i,3))}else{let i=Math.min(t.length,n.count);for(let s=0;s<i;s++){let a=t[s];n.setXYZ(s,a.x,a.y,a.z||0)}t.length>n.count&&It("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),n.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new da);let t=this.attributes.position,n=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){zt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new L(-1/0,-1/0,-1/0),new L(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),n)for(let i=0,s=n.length;i<s;i++){let a=n[i];Kn.setFromBufferAttribute(a),this.morphTargetsRelative?(ln.addVectors(this.boundingBox.min,Kn.min),this.boundingBox.expandByPoint(ln),ln.addVectors(this.boundingBox.max,Kn.max),this.boundingBox.expandByPoint(ln)):(this.boundingBox.expandByPoint(Kn.min),this.boundingBox.expandByPoint(Kn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&zt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new tr);let t=this.attributes.position,n=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){zt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new L,1/0);return}if(t){let i=this.boundingSphere.center;if(Kn.setFromBufferAttribute(t),n)for(let a=0,r=n.length;a<r;a++){let o=n[a];Il.setFromBufferAttribute(o),this.morphTargetsRelative?(ln.addVectors(Kn.min,Il.min),Kn.expandByPoint(ln),ln.addVectors(Kn.max,Il.max),Kn.expandByPoint(ln)):(Kn.expandByPoint(Il.min),Kn.expandByPoint(Il.max))}Kn.getCenter(i);let s=0;for(let a=0,r=t.count;a<r;a++)ln.fromBufferAttribute(t,a),s=Math.max(s,i.distanceToSquared(ln));if(n)for(let a=0,r=n.length;a<r;a++){let o=n[a],c=this.morphTargetsRelative;for(let l=0,h=o.count;l<h;l++)ln.fromBufferAttribute(o,l),c&&(uo.fromBufferAttribute(t,l),ln.add(uo)),s=Math.max(s,i.distanceToSquared(ln))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&zt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,n=this.attributes;if(t===null||n.position===void 0||n.normal===void 0||n.uv===void 0){zt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=n.position,s=n.normal,a=n.uv,r=this.getAttribute("tangent");(r===void 0||r.count!==i.count)&&(r=new jn(new Float32Array(4*i.count),4),this.setAttribute("tangent",r));let o=[],c=[];for(let x=0;x<i.count;x++)o[x]=new L,c[x]=new L;let l=new L,h=new L,d=new L,u=new Lt,p=new Lt,m=new Lt,S=new L,v=new L;function f(x,M,R){l.fromBufferAttribute(i,x),h.fromBufferAttribute(i,M),d.fromBufferAttribute(i,R),u.fromBufferAttribute(a,x),p.fromBufferAttribute(a,M),m.fromBufferAttribute(a,R),h.sub(l),d.sub(l),p.sub(u),m.sub(u);let D=1/(p.x*m.y-m.x*p.y);isFinite(D)&&(S.copy(h).multiplyScalar(m.y).addScaledVector(d,-p.y).multiplyScalar(D),v.copy(d).multiplyScalar(p.x).addScaledVector(h,-m.x).multiplyScalar(D),o[x].add(S),o[M].add(S),o[R].add(S),c[x].add(v),c[M].add(v),c[R].add(v))}let g=this.groups;g.length===0&&(g=[{start:0,count:t.count}]);for(let x=0,M=g.length;x<M;++x){let R=g[x],D=R.start,I=R.count;for(let q=D,J=D+I;q<J;q+=3)f(t.getX(q+0),t.getX(q+1),t.getX(q+2))}let y=new L,_=new L,T=new L,A=new L;function w(x){T.fromBufferAttribute(s,x),A.copy(T);let M=o[x];y.copy(M),y.sub(T.multiplyScalar(T.dot(M))).normalize(),_.crossVectors(A,M);let D=_.dot(c[x])<0?-1:1;r.setXYZW(x,y.x,y.y,y.z,D)}for(let x=0,M=g.length;x<M;++x){let R=g[x],D=R.start,I=R.count;for(let q=D,J=D+I;q<J;q+=3)w(t.getX(q+0)),w(t.getX(q+1)),w(t.getX(q+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,n=this.getAttribute("position");if(n!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==n.count)i=new jn(new Float32Array(n.count*3),3),this.setAttribute("normal",i);else for(let u=0,p=i.count;u<p;u++)i.setXYZ(u,0,0,0);let s=new L,a=new L,r=new L,o=new L,c=new L,l=new L,h=new L,d=new L;if(t)for(let u=0,p=t.count;u<p;u+=3){let m=t.getX(u+0),S=t.getX(u+1),v=t.getX(u+2);s.fromBufferAttribute(n,m),a.fromBufferAttribute(n,S),r.fromBufferAttribute(n,v),h.subVectors(r,a),d.subVectors(s,a),h.cross(d),o.fromBufferAttribute(i,m),c.fromBufferAttribute(i,S),l.fromBufferAttribute(i,v),o.add(h),c.add(h),l.add(h),i.setXYZ(m,o.x,o.y,o.z),i.setXYZ(S,c.x,c.y,c.z),i.setXYZ(v,l.x,l.y,l.z)}else for(let u=0,p=n.count;u<p;u+=3)s.fromBufferAttribute(n,u+0),a.fromBufferAttribute(n,u+1),r.fromBufferAttribute(n,u+2),h.subVectors(r,a),d.subVectors(s,a),h.cross(d),i.setXYZ(u+0,h.x,h.y,h.z),i.setXYZ(u+1,h.x,h.y,h.z),i.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let n=0,i=t.count;n<i;n++)ln.fromBufferAttribute(t,n),ln.normalize(),t.setXYZ(n,ln.x,ln.y,ln.z)}toNonIndexed(){function t(o,c){let l=o.array,h=o.itemSize,d=o.normalized,u=new l.constructor(c.length*h),p=0,m=0;for(let S=0,v=c.length;S<v;S++){o.isInterleavedBufferAttribute?p=c[S]*o.data.stride+o.offset:p=c[S]*h;for(let f=0;f<h;f++)u[m++]=l[p++]}return new jn(u,h,d)}if(this.index===null)return It("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let n=new e,i=this.index.array,s=this.attributes;for(let o in s){let c=s[o],l=t(c,i);n.setAttribute(o,l)}let a=this.morphAttributes;for(let o in a){let c=[],l=a[o];for(let h=0,d=l.length;h<d;h++){let u=l[h],p=t(u,i);c.push(p)}n.morphAttributes[o]=c}n.morphTargetsRelative=this.morphTargetsRelative;let r=this.groups;for(let o=0,c=r.length;o<c;o++){let l=r[o];n.addGroup(l.start,l.count,l.materialIndex)}return n}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let c=this.parameters;for(let l in c)c[l]!==void 0&&(t[l]=c[l]);return t}t.data={attributes:{}};let n=this.index;n!==null&&(t.data.index={type:n.array.constructor.name,array:Array.prototype.slice.call(n.array)});let i=this.attributes;for(let c in i){let l=i[c];t.data.attributes[c]=l.toJSON(t.data)}let s={},a=!1;for(let c in this.morphAttributes){let l=this.morphAttributes[c],h=[];for(let d=0,u=l.length;d<u;d++){let p=l[d];h.push(p.toJSON(t.data))}h.length>0&&(s[c]=h,a=!0)}a&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let r=this.groups;r.length>0&&(t.data.groups=JSON.parse(JSON.stringify(r)));let o=this.boundingSphere;return o!==null&&(t.data.boundingSphere=o.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let n={};this.name=t.name;let i=t.index;i!==null&&this.setIndex(i.clone());let s=t.attributes;for(let l in s){let h=s[l];this.setAttribute(l,h.clone(n))}let a=t.morphAttributes;for(let l in a){let h=[],d=a[l];for(let u=0,p=d.length;u<p;u++)h.push(d[u].clone(n));this.morphAttributes[l]=h}this.morphTargetsRelative=t.morphTargetsRelative;let r=t.groups;for(let l=0,h=r.length;l<h;l++){let d=r[l];this.addGroup(d.start,d.count,d.materialIndex)}let o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());let c=t.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var $T=0,pa=class extends Xi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:$T++}),this.uuid=vc(),this.name="",this.type="Material",this.blending=Qa,this.side=Ts,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Uh,this.blendDst=Lh,this.blendEquation=ha,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new te(0,0,0),this.blendAlpha=0,this.depthFunc=$a,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Vg,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ka,this.stencilZFail=Ka,this.stencilZPass=Ka,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let n in t){let i=t[n];if(i===void 0){It(`Material: parameter '${n}' has value of undefined.`);continue}let s=this[n];if(s===void 0){It(`Material: '${n}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(i):s&&s.isVector2&&i&&i.isVector2||s&&s.isEuler&&i&&i.isEuler||s&&s.isVector3&&i&&i.isVector3?s.copy(i):this[n]=i}}toJSON(t){let n=t===void 0||typeof t=="string";n&&(t={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(t).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(t).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(t).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(t).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(t).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Qa&&(i.blending=this.blending),this.side!==Ts&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Uh&&(i.blendSrc=this.blendSrc),this.blendDst!==Lh&&(i.blendDst=this.blendDst),this.blendEquation!==ha&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==$a&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Vg&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Ka&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Ka&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Ka&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function s(a){let r=[];for(let o in a){let c=a[o];delete c.metadata,r.push(c)}return r}if(n){let a=s(t.textures),r=s(t.images);a.length>0&&(i.textures=a),r.length>0&&(i.images=r)}return i}fromJSON(t,n){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new te().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=n[t.map]||null),t.matcap!==void 0&&(this.matcap=n[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=n[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=n[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=n[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let i=t.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new Lt().fromArray(i)}return t.displacementMap!==void 0&&(this.displacementMap=n[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=n[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=n[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=n[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=n[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=n[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=n[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=n[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=n[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=n[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=n[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=n[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=n[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=n[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Lt().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=n[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=n[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=n[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=n[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=n[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=n[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=n[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let n=t.clippingPlanes,i=null;if(n!==null){let s=n.length;i=new Array(s);for(let a=0;a!==s;++a)i[a]=n[a].clone()}return this.clippingPlanes=i,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var Ss=new L,Ag=new L,fh=new L,ca=new L,wg=new L,dh=new L,Cg=new L,Jl=class{constructor(t=new L,n=new L(0,0,-1)){this.origin=t,this.direction=n}set(t,n){return this.origin.copy(t),this.direction.copy(n),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,n){return n.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Ss)),this}closestPointToPoint(t,n){n.subVectors(t,this.origin);let i=n.dot(this.direction);return i<0?n.copy(this.origin):n.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let n=Ss.subVectors(t,this.origin).dot(this.direction);return n<0?this.origin.distanceToSquared(t):(Ss.copy(this.origin).addScaledVector(this.direction,n),Ss.distanceToSquared(t))}distanceSqToSegment(t,n,i,s){Ag.copy(t).add(n).multiplyScalar(.5),fh.copy(n).sub(t).normalize(),ca.copy(this.origin).sub(Ag);let a=t.distanceTo(n)*.5,r=-this.direction.dot(fh),o=ca.dot(this.direction),c=-ca.dot(fh),l=ca.lengthSq(),h=Math.abs(1-r*r),d,u,p,m;if(h>0)if(d=r*c-o,u=r*o-c,m=a*h,d>=0)if(u>=-m)if(u<=m){let S=1/h;d*=S,u*=S,p=d*(d+r*u+2*o)+u*(r*d+u+2*c)+l}else u=a,d=Math.max(0,-(r*u+o)),p=-d*d+u*(u+2*c)+l;else u=-a,d=Math.max(0,-(r*u+o)),p=-d*d+u*(u+2*c)+l;else u<=-m?(d=Math.max(0,-(-r*a+o)),u=d>0?-a:Math.min(Math.max(-a,-c),a),p=-d*d+u*(u+2*c)+l):u<=m?(d=0,u=Math.min(Math.max(-a,-c),a),p=u*(u+2*c)+l):(d=Math.max(0,-(r*a+o)),u=d>0?a:Math.min(Math.max(-a,-c),a),p=-d*d+u*(u+2*c)+l);else u=r>0?-a:a,d=Math.max(0,-(r*u+o)),p=-d*d+u*(u+2*c)+l;return i&&i.copy(this.origin).addScaledVector(this.direction,d),s&&s.copy(Ag).addScaledVector(fh,u),p}intersectSphere(t,n){Ss.subVectors(t.center,this.origin);let i=Ss.dot(this.direction),s=Ss.dot(Ss)-i*i,a=t.radius*t.radius;if(s>a)return null;let r=Math.sqrt(a-s),o=i-r,c=i+r;return c<0?null:o<0?this.at(c,n):this.at(o,n)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let n=t.normal.dot(this.direction);if(n===0)return t.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(t.normal)+t.constant)/n;return i>=0?i:null}intersectPlane(t,n){let i=this.distanceToPlane(t);return i===null?null:this.at(i,n)}intersectsPlane(t){let n=t.distanceToPoint(this.origin);return n===0||t.normal.dot(this.direction)*n<0}intersectBox(t,n){let i,s,a,r,o,c,l=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,u=this.origin;return l>=0?(i=(t.min.x-u.x)*l,s=(t.max.x-u.x)*l):(i=(t.max.x-u.x)*l,s=(t.min.x-u.x)*l),h>=0?(a=(t.min.y-u.y)*h,r=(t.max.y-u.y)*h):(a=(t.max.y-u.y)*h,r=(t.min.y-u.y)*h),i>r||a>s||((a>i||isNaN(i))&&(i=a),(r<s||isNaN(s))&&(s=r),d>=0?(o=(t.min.z-u.z)*d,c=(t.max.z-u.z)*d):(o=(t.max.z-u.z)*d,c=(t.min.z-u.z)*d),i>c||o>s)||((o>i||i!==i)&&(i=o),(c<s||s!==s)&&(s=c),s<0)?null:this.at(i>=0?i:s,n)}intersectsBox(t){return this.intersectBox(t,Ss)!==null}intersectTriangle(t,n,i,s,a){wg.subVectors(n,t),dh.subVectors(i,t),Cg.crossVectors(wg,dh);let r=this.direction.dot(Cg),o;if(r>0){if(s)return null;o=1}else if(r<0)o=-1,r=-r;else return null;ca.subVectors(this.origin,t);let c=o*this.direction.dot(dh.crossVectors(ca,dh));if(c<0)return null;let l=o*this.direction.dot(wg.cross(ca));if(l<0||c+l>r)return null;let h=-o*ca.dot(Cg);return h<0?null:this.at(h/r,a)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},vi=class extends pa{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new te(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new fa,this.combine=Zg,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},jb=new Ie,Za=new Jl,ph=new tr,Qb=new L,mh=new L,gh=new L,vh=new L,Rg=new L,_h=new L,$b=new L,yh=new L,je=class extends $n{constructor(t=new Ve,n=new vi){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=n,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,n){return super.copy(t,n),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let n=this.geometry.morphAttributes,i=Object.keys(n);if(i.length>0){let s=n[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let a=0,r=s.length;a<r;a++){let o=s[a].name||String(a);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=a}}}}getVertexPosition(t,n){let i=this.geometry,s=i.attributes.position,a=i.morphAttributes.position,r=i.morphTargetsRelative;n.fromBufferAttribute(s,t);let o=this.morphTargetInfluences;if(a&&o){_h.set(0,0,0);for(let c=0,l=a.length;c<l;c++){let h=o[c],d=a[c];h!==0&&(Rg.fromBufferAttribute(d,t),r?_h.addScaledVector(Rg,h):_h.addScaledVector(Rg.sub(n),h))}n.add(_h)}return n}raycast(t,n){let i=this.geometry,s=this.material,a=this.matrixWorld;s!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),ph.copy(i.boundingSphere),ph.applyMatrix4(a),Za.copy(t.ray).recast(t.near),!(ph.containsPoint(Za.origin)===!1&&(Za.intersectSphere(ph,Qb)===null||Za.origin.distanceToSquared(Qb)>(t.far-t.near)**2))&&(jb.copy(a).invert(),Za.copy(t.ray).applyMatrix4(jb),!(i.boundingBox!==null&&Za.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(t,n,Za)))}_computeIntersections(t,n,i){let s,a=this.geometry,r=this.material,o=a.index,c=a.attributes.position,l=a.attributes.uv,h=a.attributes.uv1,d=a.attributes.normal,u=a.groups,p=a.drawRange;if(o!==null)if(Array.isArray(r))for(let m=0,S=u.length;m<S;m++){let v=u[m],f=r[v.materialIndex],g=Math.max(v.start,p.start),y=Math.min(o.count,Math.min(v.start+v.count,p.start+p.count));for(let _=g,T=y;_<T;_+=3){let A=o.getX(_),w=o.getX(_+1),x=o.getX(_+2);s=xh(this,f,t,i,l,h,d,A,w,x),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=v.materialIndex,n.push(s))}}else{let m=Math.max(0,p.start),S=Math.min(o.count,p.start+p.count);for(let v=m,f=S;v<f;v+=3){let g=o.getX(v),y=o.getX(v+1),_=o.getX(v+2);s=xh(this,r,t,i,l,h,d,g,y,_),s&&(s.faceIndex=Math.floor(v/3),n.push(s))}}else if(c!==void 0)if(Array.isArray(r))for(let m=0,S=u.length;m<S;m++){let v=u[m],f=r[v.materialIndex],g=Math.max(v.start,p.start),y=Math.min(c.count,Math.min(v.start+v.count,p.start+p.count));for(let _=g,T=y;_<T;_+=3){let A=_,w=_+1,x=_+2;s=xh(this,f,t,i,l,h,d,A,w,x),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=v.materialIndex,n.push(s))}}else{let m=Math.max(0,p.start),S=Math.min(c.count,p.start+p.count);for(let v=m,f=S;v<f;v+=3){let g=v,y=v+1,_=v+2;s=xh(this,r,t,i,l,h,d,g,y,_),s&&(s.faceIndex=Math.floor(v/3),n.push(s))}}}};function tA(e,t,n,i,s,a,r,o){let c;if(t.side===Cn?c=i.intersectTriangle(r,a,s,!0,o):c=i.intersectTriangle(s,a,r,t.side===Ts,o),c===null)return null;yh.copy(o),yh.applyMatrix4(e.matrixWorld);let l=n.ray.origin.distanceTo(yh);return l<n.near||l>n.far?null:{distance:l,point:yh.clone(),object:e}}function xh(e,t,n,i,s,a,r,o,c,l){e.getVertexPosition(o,mh),e.getVertexPosition(c,gh),e.getVertexPosition(l,vh);let h=tA(e,t,n,i,mh,gh,vh,$b);if(h){let d=new L;Ms.getBarycoord($b,mh,gh,vh,d),s&&(h.uv=Ms.getInterpolatedAttribute(s,o,c,l,d,new Lt)),a&&(h.uv1=Ms.getInterpolatedAttribute(a,o,c,l,d,new Lt)),r&&(h.normal=Ms.getInterpolatedAttribute(r,o,c,l,d,new L),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));let u={a:o,b:c,c:l,normal:new L,materialIndex:0};Ms.getNormal(mh,gh,vh,u.normal),h.face=u,h.barycoord=d}return h}var Zh=class extends bn{constructor(t=null,n=1,i=1,s,a,r,o,c,l=cn,h=cn,d,u){super(null,r,o,c,l,h,s,a,d,u),this.isDataTexture=!0,this.image={data:t,width:n,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Dg=new L,eA=new L,nA=new Vt,Vi=class{constructor(t=new L(1,0,0),n=0){this.isPlane=!0,this.normal=t,this.constant=n}set(t,n){return this.normal.copy(t),this.constant=n,this}setComponents(t,n,i,s){return this.normal.set(t,n,i),this.constant=s,this}setFromNormalAndCoplanarPoint(t,n){return this.normal.copy(t),this.constant=-n.dot(this.normal),this}setFromCoplanarPoints(t,n,i){let s=Dg.subVectors(i,n).cross(eA.subVectors(t,n)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,n){return n.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,n,i=!0){let s=t.delta(Dg),a=this.normal.dot(s);if(a===0)return this.distanceToPoint(t.start)===0?n.copy(t.start):null;let r=-(t.start.dot(this.normal)+this.constant)/a;return i===!0&&(r<0||r>1)?null:n.copy(t.start).addScaledVector(s,r)}intersectsLine(t){let n=this.distanceToPoint(t.start),i=this.distanceToPoint(t.end);return n<0&&i>0||i<0&&n>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,n){let i=n||nA.getNormalMatrix(t),s=this.coplanarPoint(Dg).applyMatrix4(t),a=this.normal.applyMatrix3(i).normalize();return this.constant=-s.dot(a),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},Ja=new tr,iA=new Lt(.5,.5),bh=new L,Kl=class{constructor(t=new Vi,n=new Vi,i=new Vi,s=new Vi,a=new Vi,r=new Vi){this.planes=[t,n,i,s,a,r]}set(t,n,i,s,a,r){let o=this.planes;return o[0].copy(t),o[1].copy(n),o[2].copy(i),o[3].copy(s),o[4].copy(a),o[5].copy(r),this}copy(t){let n=this.planes;for(let i=0;i<6;i++)n[i].copy(t.planes[i]);return this}setFromProjectionMatrix(t,n=Ai,i=!1){let s=this.planes,a=t.elements,r=a[0],o=a[1],c=a[2],l=a[3],h=a[4],d=a[5],u=a[6],p=a[7],m=a[8],S=a[9],v=a[10],f=a[11],g=a[12],y=a[13],_=a[14],T=a[15];if(s[0].setComponents(l-r,p-h,f-m,T-g).normalize(),s[1].setComponents(l+r,p+h,f+m,T+g).normalize(),s[2].setComponents(l+o,p+d,f+S,T+y).normalize(),s[3].setComponents(l-o,p-d,f-S,T-y).normalize(),i)s[4].setComponents(c,u,v,_).normalize(),s[5].setComponents(l-c,p-u,f-v,T-_).normalize();else if(s[4].setComponents(l-c,p-u,f-v,T-_).normalize(),n===Ai)s[5].setComponents(l+c,p+u,f+v,T+_).normalize();else if(n===Hl)s[5].setComponents(c,u,v,_).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+n);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Ja.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let n=t.geometry;n.boundingSphere===null&&n.computeBoundingSphere(),Ja.copy(n.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Ja)}intersectsSprite(t){Ja.center.set(0,0,0);let n=iA.distanceTo(t.center);return Ja.radius=.7071067811865476+n,Ja.applyMatrix4(t.matrixWorld),this.intersectsSphere(Ja)}intersectsSphere(t){let n=this.planes,i=t.center,s=-t.radius;for(let a=0;a<6;a++)if(n[a].distanceToPoint(i)<s)return!1;return!0}intersectsBox(t){let n=this.planes;for(let i=0;i<6;i++){let s=n[i];if(bh.x=s.normal.x>0?t.max.x:t.min.x,bh.y=s.normal.y>0?t.max.y:t.min.y,bh.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(bh)<0)return!1}return!0}containsPoint(t){let n=this.planes;for(let i=0;i<6;i++)if(n[i].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var qi=class extends pa{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new te(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}},Jh=new L,Kh=new L,tS=new Ie,Ol=new Jl,Sh=new tr,Ng=new L,eS=new L,Yi=class extends $n{constructor(t=new Ve,n=new qi){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=n,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,n){return super.copy(t,n),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){let t=this.geometry;if(t.index===null){let n=t.attributes.position,i=[0];for(let s=1,a=n.count;s<a;s++)Jh.fromBufferAttribute(n,s-1),Kh.fromBufferAttribute(n,s),i[s]=i[s-1],i[s]+=Jh.distanceTo(Kh);t.setAttribute("lineDistance",new Te(i,1))}else It("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,n){let i=this.geometry,s=this.matrixWorld,a=t.params.Line.threshold,r=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Sh.copy(i.boundingSphere),Sh.applyMatrix4(s),Sh.radius+=a,t.ray.intersectsSphere(Sh)===!1)return;tS.copy(s).invert(),Ol.copy(t.ray).applyMatrix4(tS);let o=a/((this.scale.x+this.scale.y+this.scale.z)/3),c=o*o,l=this.isLineSegments?2:1,h=i.index,u=i.attributes.position;if(h!==null){let p=Math.max(0,r.start),m=Math.min(h.count,r.start+r.count);for(let S=p,v=m-1;S<v;S+=l){let f=h.getX(S),g=h.getX(S+1),y=Mh(this,t,Ol,c,f,g,S);y&&n.push(y)}if(this.isLineLoop){let S=h.getX(m-1),v=h.getX(p),f=Mh(this,t,Ol,c,S,v,m-1);f&&n.push(f)}}else{let p=Math.max(0,r.start),m=Math.min(u.count,r.start+r.count);for(let S=p,v=m-1;S<v;S+=l){let f=Mh(this,t,Ol,c,S,S+1,S);f&&n.push(f)}if(this.isLineLoop){let S=Mh(this,t,Ol,c,m-1,p,m-1);S&&n.push(S)}}}updateMorphTargets(){let n=this.geometry.morphAttributes,i=Object.keys(n);if(i.length>0){let s=n[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let a=0,r=s.length;a<r;a++){let o=s[a].name||String(a);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=a}}}}};function Mh(e,t,n,i,s,a,r){let o=e.geometry.attributes.position;if(Jh.fromBufferAttribute(o,s),Kh.fromBufferAttribute(o,a),n.distanceSqToSegment(Jh,Kh,Ng,eS)>i)return;Ng.applyMatrix4(e.matrixWorld);let l=t.ray.origin.distanceTo(Ng);if(!(l<t.near||l>t.far))return{distance:l,point:eS.clone().applyMatrix4(e.matrixWorld),index:r,face:null,faceIndex:null,barycoord:null,object:e}}var nS=new L,iS=new L,_o=class extends Yi{constructor(t,n){super(t,n),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let t=this.geometry;if(t.index===null){let n=t.attributes.position,i=[];for(let s=0,a=n.count;s<a;s+=2)nS.fromBufferAttribute(n,s),iS.fromBufferAttribute(n,s+1),i[s]=s===0?0:i[s-1],i[s+1]=i[s]+nS.distanceTo(iS);t.setAttribute("lineDistance",new Te(i,1))}else It("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var jl=class extends bn{constructor(t=[],n=ya,i,s,a,r,o,c,l,h){super(t,n,i,s,a,r,o,c,l,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}};var As=class extends bn{constructor(t,n,i=Ci,s,a,r,o=cn,c=cn,l,h=ki,d=1){if(h!==ki&&h!==ba)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:t,height:n,depth:d};super(u,s,a,r,o,c,h,i,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new go(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let n=super.toJSON(t);return this.compareFunction!==null&&(n.compareFunction=this.compareFunction),n}},jh=class extends As{constructor(t,n=Ci,i=ya,s,a,r=cn,o=cn,c,l=ki){let h={width:t,height:t,depth:1},d=[h,h,h,h,h,h];super(t,t,n,i,s,a,r,o,c,l),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},Ql=class extends bn{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},yo=class e extends Ve{constructor(t=1,n=1,i=1,s=1,a=1,r=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:n,depth:i,widthSegments:s,heightSegments:a,depthSegments:r};let o=this;s=Math.floor(s),a=Math.floor(a),r=Math.floor(r);let c=[],l=[],h=[],d=[],u=0,p=0;m("z","y","x",-1,-1,i,n,t,r,a,0),m("z","y","x",1,-1,i,n,-t,r,a,1),m("x","z","y",1,1,t,i,n,s,r,2),m("x","z","y",1,-1,t,i,-n,s,r,3),m("x","y","z",1,-1,t,n,i,s,a,4),m("x","y","z",-1,-1,t,n,-i,s,a,5),this.setIndex(c),this.setAttribute("position",new Te(l,3)),this.setAttribute("normal",new Te(h,3)),this.setAttribute("uv",new Te(d,2));function m(S,v,f,g,y,_,T,A,w,x,M){let R=_/w,D=T/x,I=_/2,q=T/2,J=A/2,z=w+1,B=x+1,V=0,j=0,lt=new L;for(let ut=0;ut<B;ut++){let ct=ut*D-q;for(let ot=0;ot<z;ot++){let Nt=ot*R-I;lt[S]=Nt*g,lt[v]=ct*y,lt[f]=J,l.push(lt.x,lt.y,lt.z),lt[S]=0,lt[v]=0,lt[f]=A>0?1:-1,h.push(lt.x,lt.y,lt.z),d.push(ot/w),d.push(1-ut/x),V+=1}}for(let ut=0;ut<x;ut++)for(let ct=0;ct<w;ct++){let ot=u+ct+z*ut,Nt=u+ct+z*(ut+1),Wt=u+(ct+1)+z*(ut+1),kt=u+(ct+1)+z*ut;c.push(ot,Nt,kt),c.push(Nt,Wt,kt),j+=6}o.addGroup(p,j,M),p+=j,u+=V}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};var Qh=class e extends Ve{constructor(t=1,n=1,i=1,s=32,a=1,r=!1,o=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:n,height:i,radialSegments:s,heightSegments:a,openEnded:r,thetaStart:o,thetaLength:c};let l=this;s=Math.floor(s),a=Math.floor(a);let h=[],d=[],u=[],p=[],m=0,S=[],v=i/2,f=0;g(),r===!1&&(t>0&&y(!0),n>0&&y(!1)),this.setIndex(h),this.setAttribute("position",new Te(d,3)),this.setAttribute("normal",new Te(u,3)),this.setAttribute("uv",new Te(p,2));function g(){let _=new L,T=new L,A=0,w=(n-t)/i;for(let x=0;x<=a;x++){let M=[],R=x/a,D=R*(n-t)+t;for(let I=0;I<=s;I++){let q=I/s,J=q*c+o,z=Math.sin(J),B=Math.cos(J);T.x=D*z,T.y=-R*i+v,T.z=D*B,d.push(T.x,T.y,T.z),_.set(z,w,B).normalize(),u.push(_.x,_.y,_.z),p.push(q,1-R),M.push(m++)}S.push(M)}for(let x=0;x<s;x++)for(let M=0;M<a;M++){let R=S[M][x],D=S[M+1][x],I=S[M+1][x+1],q=S[M][x+1];(t>0||M!==0)&&(h.push(R,D,q),A+=3),(n>0||M!==a-1)&&(h.push(D,I,q),A+=3)}l.addGroup(f,A,0),f+=A}function y(_){let T=m,A=new Lt,w=new L,x=0,M=_===!0?t:n,R=_===!0?1:-1;for(let I=1;I<=s;I++)d.push(0,v*R,0),u.push(0,R,0),p.push(.5,.5),m++;let D=m;for(let I=0;I<=s;I++){let J=I/s*c+o,z=Math.cos(J),B=Math.sin(J);w.x=M*B,w.y=v*R,w.z=M*z,d.push(w.x,w.y,w.z),u.push(0,R,0),A.x=z*.5+.5,A.y=B*.5*R+.5,p.push(A.x,A.y),m++}for(let I=0;I<s;I++){let q=T+I,J=D+I;_===!0?h.push(J,J+1,q):h.push(J+1,J,q),x+=3}l.addGroup(f,x,_===!0?1:2),f+=x}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},$l=class e extends Qh{constructor(t=1,n=1,i=32,s=1,a=!1,r=0,o=Math.PI*2){super(0,t,n,i,s,a,r,o),this.type="ConeGeometry",this.parameters={radius:t,height:n,radialSegments:i,heightSegments:s,openEnded:a,thetaStart:r,thetaLength:o}}static fromJSON(t){return new e(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}};var Eh=new L,Th=new L,Ug=new L,Ah=new Ms,tc=class extends Ve{constructor(t=null,n=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:t,thresholdAngle:n},t!==null){let s=Math.pow(10,4),a=Math.cos(Nh*n),r=t.getIndex(),o=t.getAttribute("position"),c=r?r.count:o.count,l=[0,0,0],h=["a","b","c"],d=new Array(3),u={},p=[];for(let m=0;m<c;m+=3){r?(l[0]=r.getX(m),l[1]=r.getX(m+1),l[2]=r.getX(m+2)):(l[0]=m,l[1]=m+1,l[2]=m+2);let{a:S,b:v,c:f}=Ah;if(S.fromBufferAttribute(o,l[0]),v.fromBufferAttribute(o,l[1]),f.fromBufferAttribute(o,l[2]),Ah.getNormal(Ug),d[0]=`${Math.round(S.x*s)},${Math.round(S.y*s)},${Math.round(S.z*s)}`,d[1]=`${Math.round(v.x*s)},${Math.round(v.y*s)},${Math.round(v.z*s)}`,d[2]=`${Math.round(f.x*s)},${Math.round(f.y*s)},${Math.round(f.z*s)}`,!(d[0]===d[1]||d[1]===d[2]||d[2]===d[0]))for(let g=0;g<3;g++){let y=(g+1)%3,_=d[g],T=d[y],A=Ah[h[g]],w=Ah[h[y]],x=`${_}_${T}`,M=`${T}_${_}`;M in u&&u[M]?(Ug.dot(u[M].normal)<=a&&(p.push(A.x,A.y,A.z),p.push(w.x,w.y,w.z)),u[M]=null):x in u||(u[x]={index0:l[g],index1:l[y],normal:Ug.clone()})}}for(let m in u)if(u[m]){let{index0:S,index1:v}=u[m];Eh.fromBufferAttribute(o,S),Th.fromBufferAttribute(o,v),p.push(Eh.x,Eh.y,Eh.z),p.push(Th.x,Th.y,Th.z)}this.setAttribute("position",new Te(p,3))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}},_i=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){It("Curve: .getPoint() not implemented.")}getPointAt(t,n){let i=this.getUtoTmapping(t);return this.getPoint(i,n)}getPoints(t=5){let n=[];for(let i=0;i<=t;i++)n.push(this.getPoint(i/t));return n}getSpacedPoints(t=5){let n=[];for(let i=0;i<=t;i++)n.push(this.getPointAt(i/t));return n}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let n=[],i,s=this.getPoint(0),a=0;n.push(0);for(let r=1;r<=t;r++)i=this.getPoint(r/t),a+=i.distanceTo(s),n.push(a),s=i;return this.cacheArcLengths=n,n}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,n=null){let i=this.getLengths(),s=0,a=i.length,r;n?r=n:r=t*i[a-1];let o=0,c=a-1,l;for(;o<=c;)if(s=Math.floor(o+(c-o)/2),l=i[s]-r,l<0)o=s+1;else if(l>0)c=s-1;else{c=s;break}if(s=c,i[s]===r)return s/(a-1);let h=i[s],u=i[s+1]-h,p=(r-h)/u;return(s+p)/(a-1)}getTangent(t,n){let s=t-1e-4,a=t+1e-4;s<0&&(s=0),a>1&&(a=1);let r=this.getPoint(s),o=this.getPoint(a),c=n||(r.isVector2?new Lt:new L);return c.copy(o).sub(r).normalize(),c}getTangentAt(t,n){let i=this.getUtoTmapping(t);return this.getTangent(i,n)}computeFrenetFrames(t,n=!1){let i=new L,s=[],a=[],r=[],o=new L,c=new Ie;for(let p=0;p<=t;p++){let m=p/t;s[p]=this.getTangentAt(m,new L)}a[0]=new L,r[0]=new L;let l=Number.MAX_VALUE,h=Math.abs(s[0].x),d=Math.abs(s[0].y),u=Math.abs(s[0].z);h<=l&&(l=h,i.set(1,0,0)),d<=l&&(l=d,i.set(0,1,0)),u<=l&&i.set(0,0,1),o.crossVectors(s[0],i).normalize(),a[0].crossVectors(s[0],o),r[0].crossVectors(s[0],a[0]);for(let p=1;p<=t;p++){if(a[p]=a[p-1].clone(),r[p]=r[p-1].clone(),o.crossVectors(s[p-1],s[p]),o.length()>Number.EPSILON){o.normalize();let m=Math.acos($t(s[p-1].dot(s[p]),-1,1));a[p].applyMatrix4(c.makeRotationAxis(o,m))}r[p].crossVectors(s[p],a[p])}if(n===!0){let p=Math.acos($t(a[0].dot(a[t]),-1,1));p/=t,s[0].dot(o.crossVectors(a[0],a[t]))>0&&(p=-p);for(let m=1;m<=t;m++)a[m].applyMatrix4(c.makeRotationAxis(s[m],p*m)),r[m].crossVectors(s[m],a[m])}return{tangents:s,normals:a,binormals:r}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},ec=class extends _i{constructor(t=0,n=0,i=1,s=1,a=0,r=Math.PI*2,o=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=n,this.xRadius=i,this.yRadius=s,this.aStartAngle=a,this.aEndAngle=r,this.aClockwise=o,this.aRotation=c}getPoint(t,n=new Lt){let i=n,s=Math.PI*2,a=this.aEndAngle-this.aStartAngle,r=Math.abs(a)<Number.EPSILON;for(;a<0;)a+=s;for(;a>s;)a-=s;a<Number.EPSILON&&(r?a=0:a=s),this.aClockwise===!0&&!r&&(a===s?a=-s:a=a-s);let o=this.aStartAngle+t*a,c=this.aX+this.xRadius*Math.cos(o),l=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),d=Math.sin(this.aRotation),u=c-this.aX,p=l-this.aY;c=u*h-p*d+this.aX,l=u*d+p*h+this.aY}return i.set(c,l)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},$h=class extends ec{constructor(t,n,i,s,a,r){super(t,n,i,i,s,a,r),this.isArcCurve=!0,this.type="ArcCurve"}};function d0(){let e=0,t=0,n=0,i=0;function s(a,r,o,c){e=a,t=o,n=-3*a+3*r-2*o-c,i=2*a-2*r+o+c}return{initCatmullRom:function(a,r,o,c,l){s(r,o,l*(o-a),l*(c-r))},initNonuniformCatmullRom:function(a,r,o,c,l,h,d){let u=(r-a)/l-(o-a)/(l+h)+(o-r)/h,p=(o-r)/h-(c-r)/(h+d)+(c-o)/d;u*=h,p*=h,s(r,o,u,p)},calc:function(a){let r=a*a,o=r*a;return e+t*a+n*r+i*o}}}var sS=new L,aS=new L,Lg=new d0,Ig=new d0,Og=new d0,xo=class extends _i{constructor(t=[],n=!1,i="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=n,this.curveType=i,this.tension=s}getPoint(t,n=new L){let i=n,s=this.points,a=s.length,r=(a-(this.closed?0:1))*t,o=Math.floor(r),c=r-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/a)+1)*a:c===0&&o===a-1&&(o=a-2,c=1);let l,h;this.closed||o>0?l=s[(o-1)%a]:(aS.subVectors(s[0],s[1]).add(s[0]),l=aS);let d=s[o%a],u=s[(o+1)%a];if(this.closed||o+2<a?h=s[(o+2)%a]:(sS.subVectors(s[a-1],s[a-2]).add(s[a-1]),h=sS),this.curveType==="centripetal"||this.curveType==="chordal"){let p=this.curveType==="chordal"?.5:.25,m=Math.pow(l.distanceToSquared(d),p),S=Math.pow(d.distanceToSquared(u),p),v=Math.pow(u.distanceToSquared(h),p);S<1e-4&&(S=1),m<1e-4&&(m=S),v<1e-4&&(v=S),Lg.initNonuniformCatmullRom(l.x,d.x,u.x,h.x,m,S,v),Ig.initNonuniformCatmullRom(l.y,d.y,u.y,h.y,m,S,v),Og.initNonuniformCatmullRom(l.z,d.z,u.z,h.z,m,S,v)}else this.curveType==="catmullrom"&&(Lg.initCatmullRom(l.x,d.x,u.x,h.x,this.tension),Ig.initCatmullRom(l.y,d.y,u.y,h.y,this.tension),Og.initCatmullRom(l.z,d.z,u.z,h.z,this.tension));return i.set(Lg.calc(c),Ig.calc(c),Og.calc(c)),i}copy(t){super.copy(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let n=0,i=this.points.length;n<i;n++){let s=this.points[n];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(new L().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function rS(e,t,n,i,s){let a=(i-t)*.5,r=(s-n)*.5,o=e*e,c=e*o;return(2*n-2*i+a+r)*c+(-3*n+3*i-2*a-r)*o+a*e+n}function sA(e,t){let n=1-e;return n*n*t}function aA(e,t){return 2*(1-e)*e*t}function rA(e,t){return e*e*t}function Pl(e,t,n,i){return sA(e,t)+aA(e,n)+rA(e,i)}function oA(e,t){let n=1-e;return n*n*n*t}function lA(e,t){let n=1-e;return 3*n*n*e*t}function cA(e,t){return 3*(1-e)*e*e*t}function uA(e,t){return e*e*e*t}function zl(e,t,n,i,s){return oA(e,t)+lA(e,n)+cA(e,i)+uA(e,s)}var tf=class extends _i{constructor(t=new Lt,n=new Lt,i=new Lt,s=new Lt){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=n,this.v2=i,this.v3=s}getPoint(t,n=new Lt){let i=n,s=this.v0,a=this.v1,r=this.v2,o=this.v3;return i.set(zl(t,s.x,a.x,r.x,o.x),zl(t,s.y,a.y,r.y,o.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},ef=class extends _i{constructor(t=new L,n=new L,i=new L,s=new L){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=n,this.v2=i,this.v3=s}getPoint(t,n=new L){let i=n,s=this.v0,a=this.v1,r=this.v2,o=this.v3;return i.set(zl(t,s.x,a.x,r.x,o.x),zl(t,s.y,a.y,r.y,o.y),zl(t,s.z,a.z,r.z,o.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},nf=class extends _i{constructor(t=new Lt,n=new Lt){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=n}getPoint(t,n=new Lt){let i=n;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,n){return this.getPoint(t,n)}getTangent(t,n=new Lt){return n.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,n){return this.getTangent(t,n)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},sf=class extends _i{constructor(t=new L,n=new L){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=n}getPoint(t,n=new L){let i=n;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,n){return this.getPoint(t,n)}getTangent(t,n=new L){return n.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,n){return this.getTangent(t,n)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},af=class extends _i{constructor(t=new Lt,n=new Lt,i=new Lt){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=n,this.v2=i}getPoint(t,n=new Lt){let i=n,s=this.v0,a=this.v1,r=this.v2;return i.set(Pl(t,s.x,a.x,r.x),Pl(t,s.y,a.y,r.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},nc=class extends _i{constructor(t=new L,n=new L,i=new L){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=n,this.v2=i}getPoint(t,n=new L){let i=n,s=this.v0,a=this.v1,r=this.v2;return i.set(Pl(t,s.x,a.x,r.x),Pl(t,s.y,a.y,r.y),Pl(t,s.z,a.z,r.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},rf=class extends _i{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,n=new Lt){let i=n,s=this.points,a=(s.length-1)*t,r=Math.floor(a),o=a-r,c=s[r===0?r:r-1],l=s[r],h=s[r>s.length-2?s.length-1:r+1],d=s[r>s.length-3?s.length-1:r+2];return i.set(rS(o,c.x,l.x,h.x,d.x),rS(o,c.y,l.y,h.y,d.y)),i}copy(t){super.copy(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let n=0,i=this.points.length;n<i;n++){let s=this.points[n];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(new Lt().fromArray(s))}return this}},hA=Object.freeze({__proto__:null,ArcCurve:$h,CatmullRomCurve3:xo,CubicBezierCurve:tf,CubicBezierCurve3:ef,EllipseCurve:ec,LineCurve:nf,LineCurve3:sf,QuadraticBezierCurve:af,QuadraticBezierCurve3:nc,SplineCurve:rf});var ma=class e extends Ve{constructor(t=1,n=1,i=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:n,widthSegments:i,heightSegments:s};let a=t/2,r=n/2,o=Math.floor(i),c=Math.floor(s),l=o+1,h=c+1,d=t/o,u=n/c,p=[],m=[],S=[],v=[];for(let f=0;f<h;f++){let g=f*u-r;for(let y=0;y<l;y++){let _=y*d-a;m.push(_,-g,0),S.push(0,0,1),v.push(y/o),v.push(1-f/c)}}for(let f=0;f<c;f++)for(let g=0;g<o;g++){let y=g+l*f,_=g+l*(f+1),T=g+1+l*(f+1),A=g+1+l*f;p.push(y,_,A),p.push(_,T,A)}this.setIndex(p),this.setAttribute("position",new Te(m,3)),this.setAttribute("normal",new Te(S,3)),this.setAttribute("uv",new Te(v,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}};var bo=class e extends Ve{constructor(t=1,n=32,i=16,s=0,a=Math.PI*2,r=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:n,heightSegments:i,phiStart:s,phiLength:a,thetaStart:r,thetaLength:o},n=Math.max(3,Math.floor(n)),i=Math.max(2,Math.floor(i));let c=Math.min(r+o,Math.PI),l=0,h=[],d=new L,u=new L,p=[],m=[],S=[],v=[];for(let f=0;f<=i;f++){let g=[],y=f/i,_=r+y*o,T=t*Math.cos(_),A=Math.sqrt(t*t-T*T),w=0;f===0&&r===0?w=.5/n:f===i&&c===Math.PI&&(w=-.5/n);for(let x=0;x<=n;x++){let M=x/n,R=s+M*a;d.x=-A*Math.cos(R),d.y=T,d.z=A*Math.sin(R),m.push(d.x,d.y,d.z),u.copy(d).normalize(),S.push(u.x,u.y,u.z),v.push(M+w,1-y),g.push(l++)}h.push(g)}for(let f=0;f<i;f++)for(let g=0;g<n;g++){let y=h[f][g+1],_=h[f][g],T=h[f+1][g],A=h[f+1][g+1];(f!==0||r>0)&&p.push(y,_,A),(f!==i-1||c<Math.PI)&&p.push(_,T,A)}this.setIndex(p),this.setAttribute("position",new Te(m,3)),this.setAttribute("normal",new Te(S,3)),this.setAttribute("uv",new Te(v,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};var ic=class e extends Ve{constructor(t=new nc(new L(-1,-1,0),new L(-1,1,0),new L(1,1,0)),n=64,i=1,s=8,a=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:n,radius:i,radialSegments:s,closed:a};let r=t.computeFrenetFrames(n,a);this.tangents=r.tangents,this.normals=r.normals,this.binormals=r.binormals;let o=new L,c=new L,l=new Lt,h=new L,d=[],u=[],p=[],m=[];S(),this.setIndex(m),this.setAttribute("position",new Te(d,3)),this.setAttribute("normal",new Te(u,3)),this.setAttribute("uv",new Te(p,2));function S(){for(let y=0;y<n;y++)v(y);v(a===!1?n:0),g(),f()}function v(y){h=t.getPointAt(y/n,h);let _=r.normals[y],T=r.binormals[y];for(let A=0;A<=s;A++){let w=A/s*Math.PI*2,x=Math.sin(w),M=-Math.cos(w);c.x=M*_.x+x*T.x,c.y=M*_.y+x*T.y,c.z=M*_.z+x*T.z,c.normalize(),u.push(c.x,c.y,c.z),o.x=h.x+i*c.x,o.y=h.y+i*c.y,o.z=h.z+i*c.z,d.push(o.x,o.y,o.z)}}function f(){for(let y=1;y<=n;y++)for(let _=1;_<=s;_++){let T=(s+1)*(y-1)+(_-1),A=(s+1)*y+(_-1),w=(s+1)*y+_,x=(s+1)*(y-1)+_;m.push(T,A,x),m.push(A,w,x)}}function g(){for(let y=0;y<=n;y++)for(let _=0;_<=s;_++)l.x=y/n,l.y=_/s,p.push(l.x,l.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new e(new hA[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}};function ir(e){let t={};for(let n in e){t[n]={};for(let i in e[n]){let s=e[n][i];if(oS(s))s.isRenderTargetTexture?(It("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[n][i]=null):t[n][i]=s.clone();else if(Array.isArray(s))if(oS(s[0])){let a=[];for(let r=0,o=s.length;r<o;r++)a[r]=s[r].clone();t[n][i]=a}else t[n][i]=s.slice();else t[n][i]=s}}return t}function Sn(e){let t={};for(let n=0;n<e.length;n++){let i=ir(e[n]);for(let s in i)t[s]=i[s]}return t}function oS(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function fA(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function p0(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:ne.workingColorSpace}var YS={clone:ir,merge:Sn},dA=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,pA=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,ti=class extends pa{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=dA,this.fragmentShader=pA,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=ir(t.uniforms),this.uniformsGroups=fA(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let n=super.toJSON(t);n.glslVersion=this.glslVersion,n.uniforms={};for(let s in this.uniforms){let r=this.uniforms[s].value;r&&r.isTexture?n.uniforms[s]={type:"t",value:r.toJSON(t).uuid}:r&&r.isColor?n.uniforms[s]={type:"c",value:r.getHex()}:r&&r.isVector2?n.uniforms[s]={type:"v2",value:r.toArray()}:r&&r.isVector3?n.uniforms[s]={type:"v3",value:r.toArray()}:r&&r.isVector4?n.uniforms[s]={type:"v4",value:r.toArray()}:r&&r.isMatrix3?n.uniforms[s]={type:"m3",value:r.toArray()}:r&&r.isMatrix4?n.uniforms[s]={type:"m4",value:r.toArray()}:n.uniforms[s]={value:r}}Object.keys(this.defines).length>0&&(n.defines=this.defines),n.vertexShader=this.vertexShader,n.fragmentShader=this.fragmentShader,n.lights=this.lights,n.clipping=this.clipping;let i={};for(let s in this.extensions)this.extensions[s]===!0&&(i[s]=!0);return Object.keys(i).length>0&&(n.extensions=i),n}fromJSON(t,n){if(super.fromJSON(t,n),t.uniforms!==void 0)for(let i in t.uniforms){let s=t.uniforms[i];switch(this.uniforms[i]={},s.type){case"t":this.uniforms[i].value=n[s.value]||null;break;case"c":this.uniforms[i].value=new te().setHex(s.value);break;case"v2":this.uniforms[i].value=new Lt().fromArray(s.value);break;case"v3":this.uniforms[i].value=new L().fromArray(s.value);break;case"v4":this.uniforms[i].value=new Oe().fromArray(s.value);break;case"m3":this.uniforms[i].value=new Vt().fromArray(s.value);break;case"m4":this.uniforms[i].value=new Ie().fromArray(s.value);break;default:this.uniforms[i].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let i in t.extensions)this.extensions[i]=t.extensions[i];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},of=class extends ti{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}};var lf=class extends pa{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=IS,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},cf=class extends pa{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};var er=class extends qi{constructor(t){super(),this.isLineDashedMaterial=!0,this.type="LineDashedMaterial",this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(t)}copy(t){return super.copy(t),this.scale=t.scale,this.dashSize=t.dashSize,this.gapSize=t.gapSize,this}};function wh(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT=="number"?new t(e):Array.prototype.slice.call(e)}var ga=class{constructor(t,n,i,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new n.constructor(i),this.sampleValues=n,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(t){let n=this.parameterPositions,i=this._cachedIndex,s=n[i],a=n[i-1];t:{e:{let r;n:{i:if(!(t<s)){for(let o=i+2;;){if(s===void 0){if(t<a)break i;return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===o)break;if(a=s,s=n[++i],t<s)break e}r=n.length;break n}if(!(t>=a)){let o=n[1];t<o&&(i=2,a=o);for(let c=i-2;;){if(a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===c)break;if(s=a,a=n[--i-1],t>=a)break e}r=i,i=0;break n}break t}for(;i<r;){let o=i+r>>>1;t<n[o]?r=o:i=o+1}if(s=n[i],a=n[i-1],a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,a,s)}return this.interpolate_(i,a,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let n=this.resultBuffer,i=this.sampleValues,s=this.valueSize,a=t*s;for(let r=0;r!==s;++r)n[r]=i[a+r];return n}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},uf=class extends ga{constructor(t,n,i,s){super(t,n,i,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:zg,endingEnd:zg}}intervalChanged_(t,n,i){let s=this.parameterPositions,a=t-2,r=t+1,o=s[a],c=s[r];if(o===void 0)switch(this.getSettings_().endingStart){case Bg:a=t,o=2*n-i;break;case Fg:a=s.length-2,o=n+s[a]-s[a+1];break;default:a=t,o=i}if(c===void 0)switch(this.getSettings_().endingEnd){case Bg:r=t,c=2*i-n;break;case Fg:r=1,c=i+s[1]-s[0];break;default:r=t-1,c=n}let l=(i-n)*.5,h=this.valueSize;this._weightPrev=l/(n-o),this._weightNext=l/(c-i),this._offsetPrev=a*h,this._offsetNext=r*h}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,c=t*o,l=c-o,h=this._offsetPrev,d=this._offsetNext,u=this._weightPrev,p=this._weightNext,m=(i-n)/(s-n),S=m*m,v=S*m,f=-u*v+2*u*S-u*m,g=(1+u)*v+(-1.5-2*u)*S+(-.5+u)*m+1,y=(-1-p)*v+(1.5+p)*S+.5*m,_=p*v-p*S;for(let T=0;T!==o;++T)a[T]=f*r[h+T]+g*r[l+T]+y*r[c+T]+_*r[d+T];return a}},hf=class extends ga{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,c=t*o,l=c-o,h=(i-n)/(s-n),d=1-h;for(let u=0;u!==o;++u)a[u]=r[l+u]*d+r[c+u]*h;return a}},ff=class extends ga{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t){return this.copySampleValue_(t-1)}},df=class extends ga{interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,c=t*o,l=c-o,h=this.inTangents,d=this.outTangents;if(!h||!d){let m=(i-n)/(s-n),S=1-m;for(let v=0;v!==o;++v)a[v]=r[l+v]*S+r[c+v]*m;return a}let u=o*2,p=t-1;for(let m=0;m!==o;++m){let S=r[l+m],v=r[c+m],f=p*u+m*2,g=d[f],y=d[f+1],_=t*u+m*2,T=h[_],A=h[_+1],w=(i-n)/(s-n),x,M,R,D,I;for(let q=0;q<8;q++){x=w*w,M=x*w,R=1-w,D=R*R,I=D*R;let z=I*n+3*D*w*g+3*R*x*T+M*s-i;if(Math.abs(z)<1e-10)break;let B=3*D*(g-n)+6*R*w*(T-g)+3*x*(s-T);if(Math.abs(B)<1e-10)break;w=w-z/B,w=Math.max(0,Math.min(1,w))}a[m]=I*S+3*D*w*y+3*R*x*A+M*v}return a}},ei=class{constructor(t,n,i,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(n===void 0||n.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=wh(n,this.TimeBufferType),this.values=wh(i,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let n=t.constructor,i;if(n.toJSON!==this.toJSON)i=n.toJSON(t);else{i={name:t.name,times:wh(t.times,Array),values:wh(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(i.interpolation=s)}return i.type=t.ValueTypeName,i}InterpolantFactoryMethodDiscrete(t){return new ff(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new hf(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new uf(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let n=new df(this.times,this.values,this.getValueSize(),t);return this.settings&&(n.inTangents=this.settings.inTangents,n.outTangents=this.settings.outTangents),n}setInterpolation(t){let n;switch(t){case Bl:n=this.InterpolantFactoryMethodDiscrete;break;case kh:n=this.InterpolantFactoryMethodLinear;break;case Dh:n=this.InterpolantFactoryMethodSmooth;break;case Pg:n=this.InterpolantFactoryMethodBezier;break}if(n===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return It("KeyframeTrack:",i),this}return this.createInterpolant=n,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Bl;case this.InterpolantFactoryMethodLinear:return kh;case this.InterpolantFactoryMethodSmooth:return Dh;case this.InterpolantFactoryMethodBezier:return Pg}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let n=this.times;for(let i=0,s=n.length;i!==s;++i)n[i]+=t}return this}scale(t){if(t!==1){let n=this.times;for(let i=0,s=n.length;i!==s;++i)n[i]*=t}return this}trim(t,n){let i=this.times,s=i.length,a=0,r=s-1;for(;a!==s&&i[a]<t;)++a;for(;r!==-1&&i[r]>n;)--r;if(++r,a!==0||r!==s){a>=r&&(r=Math.max(r,1),a=r-1);let o=this.getValueSize();this.times=i.slice(a,r),this.values=this.values.slice(a*o,r*o)}return this}validate(){let t=!0,n=this.getValueSize();n-Math.floor(n)!==0&&(zt("KeyframeTrack: Invalid value size in track.",this),t=!1);let i=this.times,s=this.values,a=i.length;a===0&&(zt("KeyframeTrack: Track is empty.",this),t=!1);let r=null;for(let o=0;o!==a;o++){let c=i[o];if(typeof c=="number"&&isNaN(c)){zt("KeyframeTrack: Time is not a valid number.",this,o,c),t=!1;break}if(r!==null&&r>c){zt("KeyframeTrack: Out of order keys.",this,o,c,r),t=!1;break}r=c}if(s!==void 0&&BT(s))for(let o=0,c=s.length;o!==c;++o){let l=s[o];if(isNaN(l)){zt("KeyframeTrack: Value is not a valid number.",this,o,l),t=!1;break}}return t}optimize(){let t=this.times.slice(),n=this.values.slice(),i=this.getValueSize(),s=this.getInterpolation()===Dh,a=t.length-1,r=1;for(let o=1;o<a;++o){let c=!1,l=t[o],h=t[o+1];if(l!==h&&(o!==1||l!==t[0]))if(s)c=!0;else{let d=o*i,u=d-i,p=d+i;for(let m=0;m!==i;++m){let S=n[d+m];if(S!==n[u+m]||S!==n[p+m]){c=!0;break}}}if(c){if(o!==r){t[r]=t[o];let d=o*i,u=r*i;for(let p=0;p!==i;++p)n[u+p]=n[d+p]}++r}}if(a>0){t[r]=t[a];for(let o=a*i,c=r*i,l=0;l!==i;++l)n[c+l]=n[o+l];++r}return r!==t.length?(this.times=t.slice(0,r),this.values=n.slice(0,r*i)):(this.times=t,this.values=n),this}clone(){let t=this.times.slice(),n=this.values.slice(),i=this.constructor,s=new i(this.name,t,n);return s.createInterpolant=this.createInterpolant,s}};ei.prototype.ValueTypeName="";ei.prototype.TimeBufferType=Float32Array;ei.prototype.ValueBufferType=Float32Array;ei.prototype.DefaultInterpolation=kh;var va=class extends ei{constructor(t,n,i){super(t,n,i)}};va.prototype.ValueTypeName="bool";va.prototype.ValueBufferType=Array;va.prototype.DefaultInterpolation=Bl;va.prototype.InterpolantFactoryMethodLinear=void 0;va.prototype.InterpolantFactoryMethodSmooth=void 0;var pf=class extends ei{constructor(t,n,i,s){super(t,n,i,s)}};pf.prototype.ValueTypeName="color";var mf=class extends ei{constructor(t,n,i,s){super(t,n,i,s)}};mf.prototype.ValueTypeName="number";var gf=class extends ga{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,c=(i-n)/(s-n),l=t*o;for(let h=l+o;l!==h;l+=4)Wi.slerpFlat(a,0,r,l-o,r,l,c);return a}},sc=class extends ei{constructor(t,n,i,s){super(t,n,i,s)}InterpolantFactoryMethodLinear(t){return new gf(this.times,this.values,this.getValueSize(),t)}};sc.prototype.ValueTypeName="quaternion";sc.prototype.InterpolantFactoryMethodSmooth=void 0;var _a=class extends ei{constructor(t,n,i){super(t,n,i)}};_a.prototype.ValueTypeName="string";_a.prototype.ValueBufferType=Array;_a.prototype.DefaultInterpolation=Bl;_a.prototype.InterpolantFactoryMethodLinear=void 0;_a.prototype.InterpolantFactoryMethodSmooth=void 0;var vf=class extends ei{constructor(t,n,i,s){super(t,n,i,s)}};vf.prototype.ValueTypeName="vector";var _f=class{constructor(t,n,i){let s=this,a=!1,r=0,o=0,c,l=[];this.onStart=void 0,this.onLoad=t,this.onProgress=n,this.onError=i,this._abortController=null,this.itemStart=function(h){o++,a===!1&&s.onStart!==void 0&&s.onStart(h,r,o),a=!0},this.itemEnd=function(h){r++,s.onProgress!==void 0&&s.onProgress(h,r,o),r===o&&(a=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),c?c(h):h},this.setURLModifier=function(h){return c=h,this},this.addHandler=function(h,d){return l.push(h,d),this},this.removeHandler=function(h){let d=l.indexOf(h);return d!==-1&&l.splice(d,2),this},this.getHandler=function(h){for(let d=0,u=l.length;d<u;d+=2){let p=l[d],m=l[d+1];if(p.global&&(p.lastIndex=0),p.test(h))return m}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},ZS=new _f,yf=class{constructor(t){this.manager=t!==void 0?t:ZS,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,n){let i=this;return new Promise(function(s,a){i.load(t,s,n,a)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};yf.DEFAULT_MATERIAL_NAME="__DEFAULT";var Ch=new L,Rh=new Wi,Fi=new L,ac=class extends $n{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ie,this.projectionMatrix=new Ie,this.projectionMatrixInverse=new Ie,this.coordinateSystem=Ai,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,n){return super.copy(t,n),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(Ch,Rh,Fi),Fi.x===1&&Fi.y===1&&Fi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ch,Rh,Fi.set(1,1,1)).invert()}updateWorldMatrix(t,n,i=!1){super.updateWorldMatrix(t,n,i),this.matrixWorld.decompose(Ch,Rh,Fi),Fi.x===1&&Fi.y===1&&Fi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ch,Rh,Fi.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},ua=new L,lS=new Lt,cS=new Lt,xn=class extends ac{constructor(t=50,n=1,i=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=i,this.far=s,this.focus=10,this.aspect=n,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,n){return super.copy(t,n),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let n=.5*this.getFilmHeight()/t;this.fov=Xh*2*Math.atan(n),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(Nh*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Xh*2*Math.atan(Math.tan(Nh*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,n,i){ua.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(ua.x,ua.y).multiplyScalar(-t/ua.z),ua.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(ua.x,ua.y).multiplyScalar(-t/ua.z)}getViewSize(t,n){return this.getViewBounds(t,lS,cS),n.subVectors(cS,lS)}setViewOffset(t,n,i,s,a,r){this.aspect=t/n,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=n,this.view.offsetX=i,this.view.offsetY=s,this.view.width=a,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,n=t*Math.tan(Nh*.5*this.fov)/this.zoom,i=2*n,s=this.aspect*i,a=-.5*s,r=this.view;if(this.view!==null&&this.view.enabled){let c=r.fullWidth,l=r.fullHeight;a+=r.offsetX*s/c,n-=r.offsetY*i/l,s*=r.width/c,i*=r.height/l}let o=this.filmOffset;o!==0&&(a+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(a,a+s,n,n-i,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let n=super.toJSON(t);return n.object.fov=this.fov,n.object.zoom=this.zoom,n.object.near=this.near,n.object.far=this.far,n.object.focus=this.focus,n.object.aspect=this.aspect,this.view!==null&&(n.object.view=Object.assign({},this.view)),n.object.filmGauge=this.filmGauge,n.object.filmOffset=this.filmOffset,n}};var rc=class extends ac{constructor(t=-1,n=1,i=1,s=-1,a=.1,r=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=n,this.top=i,this.bottom=s,this.near=a,this.far=r,this.updateProjectionMatrix()}copy(t,n){return super.copy(t,n),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,n,i,s,a,r){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=n,this.view.offsetX=i,this.view.offsetY=s,this.view.width=a,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),n=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,s=(this.top+this.bottom)/2,a=i-t,r=i+t,o=s+n,c=s-n;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;a+=l*this.view.offsetX,r=a+l*this.view.width,o-=h*this.view.offsetY,c=o-h*this.view.height}this.projectionMatrix.makeOrthographic(a,r,o,c,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let n=super.toJSON(t);return n.object.zoom=this.zoom,n.object.left=this.left,n.object.right=this.right,n.object.top=this.top,n.object.bottom=this.bottom,n.object.near=this.near,n.object.far=this.far,this.view!==null&&(n.object.view=Object.assign({},this.view)),n}};var ho=-90,fo=1,xf=class extends $n{constructor(t,n,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new xn(ho,fo,t,n);s.layers=this.layers,this.add(s);let a=new xn(ho,fo,t,n);a.layers=this.layers,this.add(a);let r=new xn(ho,fo,t,n);r.layers=this.layers,this.add(r);let o=new xn(ho,fo,t,n);o.layers=this.layers,this.add(o);let c=new xn(ho,fo,t,n);c.layers=this.layers,this.add(c);let l=new xn(ho,fo,t,n);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let t=this.coordinateSystem,n=this.children.concat(),[i,s,a,r,o,c]=n;for(let l of n)this.remove(l);if(t===Ai)i.up.set(0,1,0),i.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),a.up.set(0,0,-1),a.lookAt(0,1,0),r.up.set(0,0,1),r.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(t===Hl)i.up.set(0,-1,0),i.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),a.up.set(0,0,1),a.lookAt(0,1,0),r.up.set(0,0,-1),r.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let l of n)this.add(l),l.updateMatrixWorld()}update(t,n){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[a,r,o,c,l,h]=this.children,d=t.getRenderTarget(),u=t.getActiveCubeFace(),p=t.getActiveMipmapLevel(),m=t.xr.enabled;t.xr.enabled=!1;let S=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let v=!1;t.isWebGLRenderer===!0?v=t.state.buffers.depth.getReversed():v=t.reversedDepthBuffer,t.setRenderTarget(i,0,s),v&&t.autoClear===!1&&t.clearDepth(),t.render(n,a),t.setRenderTarget(i,1,s),v&&t.autoClear===!1&&t.clearDepth(),t.render(n,r),t.setRenderTarget(i,2,s),v&&t.autoClear===!1&&t.clearDepth(),t.render(n,o),t.setRenderTarget(i,3,s),v&&t.autoClear===!1&&t.clearDepth(),t.render(n,c),t.setRenderTarget(i,4,s),v&&t.autoClear===!1&&t.clearDepth(),t.render(n,l),i.texture.generateMipmaps=S,t.setRenderTarget(i,5,s),v&&t.autoClear===!1&&t.clearDepth(),t.render(n,h),t.setRenderTarget(d,u,p),t.xr.enabled=m,i.texture.needsPMREMUpdate=!0}},bf=class extends xn{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}};var m0="\\[\\]\\.:\\/",mA=new RegExp("["+m0+"]","g"),g0="[^"+m0+"]",gA="[^"+m0.replace("\\.","")+"]",vA=/((?:WC+[\/:])*)/.source.replace("WC",g0),_A=/(WCOD+)?/.source.replace("WCOD",gA),yA=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",g0),xA=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",g0),bA=new RegExp("^"+vA+_A+yA+xA+"$"),SA=["material","materials","bones","map"],Gg=class{constructor(t,n,i){let s=i||De.parseTrackName(n);this._targetGroup=t,this._bindings=t.subscribe_(n,s)}getValue(t,n){this.bind();let i=this._targetGroup.nCachedObjects_,s=this._bindings[i];s!==void 0&&s.getValue(t,n)}setValue(t,n){let i=this._bindings;for(let s=this._targetGroup.nCachedObjects_,a=i.length;s!==a;++s)i[s].setValue(t,n)}bind(){let t=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=t.length;n!==i;++n)t[n].bind()}unbind(){let t=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=t.length;n!==i;++n)t[n].unbind()}},De=class e{constructor(t,n,i){this.path=n,this.parsedPath=i||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,i){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,i):new e(t,n,i)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(mA,"")}static parseTrackName(t){let n=bA.exec(t);if(n===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let i={nodeName:n[2],objectName:n[3],objectIndex:n[4],propertyName:n[5],propertyIndex:n[6]},s=i.nodeName&&i.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let a=i.nodeName.substring(s+1);SA.indexOf(a)!==-1&&(i.nodeName=i.nodeName.substring(0,s),i.objectName=a)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return i}static findNode(t,n){if(n===void 0||n===""||n==="."||n===-1||n===t.name||n===t.uuid)return t;if(t.skeleton){let i=t.skeleton.getBoneByName(n);if(i!==void 0)return i}if(t.children){let i=function(a){for(let r=0;r<a.length;r++){let o=a[r];if(o.name===n||o.uuid===n)return o;let c=i(o.children);if(c)return c}return null},s=i(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,n){t[n]=this.targetObject[this.propertyName]}_getValue_array(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)t[n++]=i[s]}_getValue_arrayElement(t,n){t[n]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,n){this.resolvedProperty.toArray(t,n)}_setValue_direct(t,n){this.targetObject[this.propertyName]=t[n]}_setValue_direct_setNeedsUpdate(t,n){this.targetObject[this.propertyName]=t[n],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,n){this.targetObject[this.propertyName]=t[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++]}_setValue_array_setNeedsUpdate(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,n){this.resolvedProperty[this.propertyIndex]=t[n]}_setValue_arrayElement_setNeedsUpdate(t,n){this.resolvedProperty[this.propertyIndex]=t[n],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,n){this.resolvedProperty[this.propertyIndex]=t[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,n){this.resolvedProperty.fromArray(t,n)}_setValue_fromArray_setNeedsUpdate(t,n){this.resolvedProperty.fromArray(t,n),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,n){this.resolvedProperty.fromArray(t,n),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,n){this.bind(),this.getValue(t,n)}_setValue_unbound(t,n){this.bind(),this.setValue(t,n)}bind(){let t=this.node,n=this.parsedPath,i=n.objectName,s=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){It("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let l=n.objectIndex;switch(i){case"materials":if(!t.material){zt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){zt("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){zt("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===l){l=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){zt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){zt("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[i]===void 0){zt("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[i]}if(l!==void 0){if(t[l]===void 0){zt("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[l]}}let r=t[s];if(r===void 0){let l=n.nodeName;zt("PropertyBinding: Trying to update property for track: "+l+"."+s+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?o=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(a!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){zt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){zt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}c=this.BindingType.ArrayElement,this.resolvedProperty=r,this.propertyIndex=a}else r.fromArray!==void 0&&r.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=r):Array.isArray(r)?(c=this.BindingType.EntireArray,this.resolvedProperty=r):this.propertyName=s;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};De.Composite=Gg;De.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};De.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};De.prototype.GetterByBindingType=[De.prototype._getValue_direct,De.prototype._getValue_array,De.prototype._getValue_arrayElement,De.prototype._getValue_toArray];De.prototype.SetterByBindingTypeAndVersioning=[[De.prototype._setValue_direct,De.prototype._setValue_direct_setNeedsUpdate,De.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[De.prototype._setValue_array,De.prototype._setValue_array_setNeedsUpdate,De.prototype._setValue_array_setMatrixWorldNeedsUpdate],[De.prototype._setValue_arrayElement,De.prototype._setValue_arrayElement_setNeedsUpdate,De.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[De.prototype._setValue_fromArray,De.prototype._setValue_fromArray_setNeedsUpdate,De.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var z3=new Float32Array(1);var kg=class e{static{e.prototype.isMatrix2=!0}constructor(t,n,i,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,n,i,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,n=0){for(let i=0;i<4;i++)this.elements[i]=t[i+n];return this}set(t,n,i,s){let a=this.elements;return a[0]=t,a[2]=n,a[1]=i,a[3]=s,this}};var oc=class extends _o{constructor(t=10,n=10,i=4473924,s=8947848){i=new te(i),s=new te(s);let a=n/2,r=t/n,o=t/2,c=[],l=[];for(let u=0,p=0,m=-o;u<=n;u++,m+=r){c.push(-o,0,m,o,0,m),c.push(m,0,-o,m,0,o);let S=u===a?i:s;S.toArray(l,p),p+=3,S.toArray(l,p),p+=3,S.toArray(l,p),p+=3,S.toArray(l,p),p+=3}let h=new Ve;h.setAttribute("position",new Te(c,3)),h.setAttribute("color",new Te(l,3));let d=new qi({vertexColors:!0,toneMapped:!1});super(h,d),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}};function v0(e,t,n,i){let s=MA(i);switch(n){case o0:return e*t;case c0:return e*t/s.components*s.byteLength;case Rf:return e*t/s.components*s.byteLength;case Sa:return e*t*2/s.components*s.byteLength;case Df:return e*t*2/s.components*s.byteLength;case l0:return e*t*3/s.components*s.byteLength;case yi:return e*t*4/s.components*s.byteLength;case Nf:return e*t*4/s.components*s.byteLength;case hc:case fc:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case dc:case pc:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Lf:case Of:return Math.max(e,16)*Math.max(t,8)/4;case Uf:case If:return Math.max(e,8)*Math.max(t,8)/2;case Pf:case zf:case Ff:case Vf:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case Bf:case mc:case Hf:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Gf:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case kf:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case Xf:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case Wf:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case qf:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case Yf:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case Zf:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case Jf:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case Kf:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case jf:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case Qf:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case $f:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case td:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case ed:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case nd:case id:case sd:return Math.ceil(e/4)*Math.ceil(t/4)*16;case ad:case rd:return Math.ceil(e/4)*Math.ceil(t/4)*8;case gc:case od:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${n} format.`)}function MA(e){switch(e){case ii:case i0:return{byteLength:1,components:1};case Mo:case s0:case Ji:return{byteLength:2,components:1};case wf:case Cf:return{byteLength:2,components:4};case Ci:case Af:case Ri:return{byteLength:4,components:1};case a0:case r0:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Sf}}));typeof window<"u"&&(window.__THREE__?It("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Sf);function vM(){let e=null,t=!1,n=null,i=null;function s(a,r){n(a,r),i=e.requestAnimationFrame(s)}return{start:function(){t!==!0&&n!==null&&e!==null&&(i=e.requestAnimationFrame(s),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(i),t=!1},setAnimationLoop:function(a){n=a},setContext:function(a){e=a}}}function EA(e){let t=new WeakMap;function n(o,c){let l=o.array,h=o.usage,d=l.byteLength,u=e.createBuffer();e.bindBuffer(c,u),e.bufferData(c,l,h),o.onUploadCallback();let p;if(l instanceof Float32Array)p=e.FLOAT;else if(typeof Float16Array<"u"&&l instanceof Float16Array)p=e.HALF_FLOAT;else if(l instanceof Uint16Array)o.isFloat16BufferAttribute?p=e.HALF_FLOAT:p=e.UNSIGNED_SHORT;else if(l instanceof Int16Array)p=e.SHORT;else if(l instanceof Uint32Array)p=e.UNSIGNED_INT;else if(l instanceof Int32Array)p=e.INT;else if(l instanceof Int8Array)p=e.BYTE;else if(l instanceof Uint8Array)p=e.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)p=e.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:u,type:p,bytesPerElement:l.BYTES_PER_ELEMENT,version:o.version,size:d}}function i(o,c,l){let h=c.array,d=c.updateRanges;if(e.bindBuffer(l,o),d.length===0)e.bufferSubData(l,0,h);else{d.sort((p,m)=>p.start-m.start);let u=0;for(let p=1;p<d.length;p++){let m=d[u],S=d[p];S.start<=m.start+m.count+1?m.count=Math.max(m.count,S.start+S.count-m.start):(++u,d[u]=S)}d.length=u+1;for(let p=0,m=d.length;p<m;p++){let S=d[p];e.bufferSubData(l,S.start*h.BYTES_PER_ELEMENT,h,S.start,S.count)}c.clearUpdateRanges()}c.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function a(o){o.isInterleavedBufferAttribute&&(o=o.data);let c=t.get(o);c&&(e.deleteBuffer(c.buffer),t.delete(o))}function r(o,c){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let l=t.get(o);if(l===void 0)t.set(o,n(o,c));else if(l.version<o.version){if(l.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(l.buffer,o,c),l.version=o.version}}return{get:s,remove:a,update:r}}var TA=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,AA=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,wA=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,CA=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,RA=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,DA=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,NA=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,UA=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,LA=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,IA=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,OA=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,PA=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,zA=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,BA=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,FA=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,VA=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,HA=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,GA=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,kA=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,XA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,WA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,qA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,YA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,ZA=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,JA=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,KA=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,jA=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,QA=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,$A=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,tw=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,ew="gl_FragColor = linearToOutputTexel( gl_FragColor );",nw=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,iw=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,sw=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,aw=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,rw=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,ow=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,lw=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,cw=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,uw=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,hw=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,fw=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,dw=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,pw=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,mw=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,gw=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,vw=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,_w=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,yw=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,xw=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,bw=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Sw=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Mw=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Ew=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Tw=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Aw=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,ww=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Cw=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Rw=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Dw=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Nw=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Uw=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Lw=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Iw=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Ow=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Pw=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,zw=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Bw=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Fw=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Vw=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Hw=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Gw=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,kw=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Xw=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Ww=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,qw=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Yw=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Zw=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Jw=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Kw=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,jw=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Qw=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,$w=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,tC=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,eC=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,nC=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,iC=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,sC=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,aC=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,rC=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,oC=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,lC=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,cC=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,uC=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,hC=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,fC=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,dC=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,pC=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,mC=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,gC=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,vC=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,_C=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,yC=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,xC=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,bC=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,SC=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,MC=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,EC=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,TC=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,AC=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,wC=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,CC=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,RC=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,DC=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,NC=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,UC=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,LC=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,IC=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,OC=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,PC=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,zC=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,BC=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,FC=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,VC=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,HC=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,GC=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,kC=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,XC=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,WC=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,qC=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,YC=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ZC=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,JC=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,KC=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,jC=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,QC=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,$C=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,tR=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,eR=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,nR=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,iR=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sR=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Zt={alphahash_fragment:TA,alphahash_pars_fragment:AA,alphamap_fragment:wA,alphamap_pars_fragment:CA,alphatest_fragment:RA,alphatest_pars_fragment:DA,aomap_fragment:NA,aomap_pars_fragment:UA,batching_pars_vertex:LA,batching_vertex:IA,begin_vertex:OA,beginnormal_vertex:PA,bsdfs:zA,iridescence_fragment:BA,bumpmap_pars_fragment:FA,clipping_planes_fragment:VA,clipping_planes_pars_fragment:HA,clipping_planes_pars_vertex:GA,clipping_planes_vertex:kA,color_fragment:XA,color_pars_fragment:WA,color_pars_vertex:qA,color_vertex:YA,common:ZA,cube_uv_reflection_fragment:JA,defaultnormal_vertex:KA,displacementmap_pars_vertex:jA,displacementmap_vertex:QA,emissivemap_fragment:$A,emissivemap_pars_fragment:tw,colorspace_fragment:ew,colorspace_pars_fragment:nw,envmap_fragment:iw,envmap_common_pars_fragment:sw,envmap_pars_fragment:aw,envmap_pars_vertex:rw,envmap_physical_pars_fragment:vw,envmap_vertex:ow,fog_vertex:lw,fog_pars_vertex:cw,fog_fragment:uw,fog_pars_fragment:hw,gradientmap_pars_fragment:fw,lightmap_pars_fragment:dw,lights_lambert_fragment:pw,lights_lambert_pars_fragment:mw,lights_pars_begin:gw,lights_toon_fragment:_w,lights_toon_pars_fragment:yw,lights_phong_fragment:xw,lights_phong_pars_fragment:bw,lights_physical_fragment:Sw,lights_physical_pars_fragment:Mw,lights_fragment_begin:Ew,lights_fragment_maps:Tw,lights_fragment_end:Aw,lightprobes_pars_fragment:ww,logdepthbuf_fragment:Cw,logdepthbuf_pars_fragment:Rw,logdepthbuf_pars_vertex:Dw,logdepthbuf_vertex:Nw,map_fragment:Uw,map_pars_fragment:Lw,map_particle_fragment:Iw,map_particle_pars_fragment:Ow,metalnessmap_fragment:Pw,metalnessmap_pars_fragment:zw,morphinstance_vertex:Bw,morphcolor_vertex:Fw,morphnormal_vertex:Vw,morphtarget_pars_vertex:Hw,morphtarget_vertex:Gw,normal_fragment_begin:kw,normal_fragment_maps:Xw,normal_pars_fragment:Ww,normal_pars_vertex:qw,normal_vertex:Yw,normalmap_pars_fragment:Zw,clearcoat_normal_fragment_begin:Jw,clearcoat_normal_fragment_maps:Kw,clearcoat_pars_fragment:jw,iridescence_pars_fragment:Qw,opaque_fragment:$w,packing:tC,premultiplied_alpha_fragment:eC,project_vertex:nC,dithering_fragment:iC,dithering_pars_fragment:sC,roughnessmap_fragment:aC,roughnessmap_pars_fragment:rC,shadowmap_pars_fragment:oC,shadowmap_pars_vertex:lC,shadowmap_vertex:cC,shadowmask_pars_fragment:uC,skinbase_vertex:hC,skinning_pars_vertex:fC,skinning_vertex:dC,skinnormal_vertex:pC,specularmap_fragment:mC,specularmap_pars_fragment:gC,tonemapping_fragment:vC,tonemapping_pars_fragment:_C,transmission_fragment:yC,transmission_pars_fragment:xC,uv_pars_fragment:bC,uv_pars_vertex:SC,uv_vertex:MC,worldpos_vertex:EC,background_vert:TC,background_frag:AC,backgroundCube_vert:wC,backgroundCube_frag:CC,cube_vert:RC,cube_frag:DC,depth_vert:NC,depth_frag:UC,distance_vert:LC,distance_frag:IC,equirect_vert:OC,equirect_frag:PC,linedashed_vert:zC,linedashed_frag:BC,meshbasic_vert:FC,meshbasic_frag:VC,meshlambert_vert:HC,meshlambert_frag:GC,meshmatcap_vert:kC,meshmatcap_frag:XC,meshnormal_vert:WC,meshnormal_frag:qC,meshphong_vert:YC,meshphong_frag:ZC,meshphysical_vert:JC,meshphysical_frag:KC,meshtoon_vert:jC,meshtoon_frag:QC,points_vert:$C,points_frag:tR,shadow_vert:eR,shadow_frag:nR,sprite_vert:iR,sprite_frag:sR},_t={common:{diffuse:{value:new te(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Vt},alphaMap:{value:null},alphaMapTransform:{value:new Vt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Vt}},envmap:{envMap:{value:null},envMapRotation:{value:new Vt},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Vt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Vt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Vt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Vt},normalScale:{value:new Lt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Vt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Vt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Vt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Vt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new te(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new L},probesMax:{value:new L},probesResolution:{value:new L}},points:{diffuse:{value:new te(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Vt},alphaTest:{value:0},uvTransform:{value:new Vt}},sprite:{diffuse:{value:new te(16777215)},opacity:{value:1},center:{value:new Lt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Vt},alphaMap:{value:null},alphaMapTransform:{value:new Vt},alphaTest:{value:0}}},ji={basic:{uniforms:Sn([_t.common,_t.specularmap,_t.envmap,_t.aomap,_t.lightmap,_t.fog]),vertexShader:Zt.meshbasic_vert,fragmentShader:Zt.meshbasic_frag},lambert:{uniforms:Sn([_t.common,_t.specularmap,_t.envmap,_t.aomap,_t.lightmap,_t.emissivemap,_t.bumpmap,_t.normalmap,_t.displacementmap,_t.fog,_t.lights,{emissive:{value:new te(0)},envMapIntensity:{value:1}}]),vertexShader:Zt.meshlambert_vert,fragmentShader:Zt.meshlambert_frag},phong:{uniforms:Sn([_t.common,_t.specularmap,_t.envmap,_t.aomap,_t.lightmap,_t.emissivemap,_t.bumpmap,_t.normalmap,_t.displacementmap,_t.fog,_t.lights,{emissive:{value:new te(0)},specular:{value:new te(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Zt.meshphong_vert,fragmentShader:Zt.meshphong_frag},standard:{uniforms:Sn([_t.common,_t.envmap,_t.aomap,_t.lightmap,_t.emissivemap,_t.bumpmap,_t.normalmap,_t.displacementmap,_t.roughnessmap,_t.metalnessmap,_t.fog,_t.lights,{emissive:{value:new te(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Zt.meshphysical_vert,fragmentShader:Zt.meshphysical_frag},toon:{uniforms:Sn([_t.common,_t.aomap,_t.lightmap,_t.emissivemap,_t.bumpmap,_t.normalmap,_t.displacementmap,_t.gradientmap,_t.fog,_t.lights,{emissive:{value:new te(0)}}]),vertexShader:Zt.meshtoon_vert,fragmentShader:Zt.meshtoon_frag},matcap:{uniforms:Sn([_t.common,_t.bumpmap,_t.normalmap,_t.displacementmap,_t.fog,{matcap:{value:null}}]),vertexShader:Zt.meshmatcap_vert,fragmentShader:Zt.meshmatcap_frag},points:{uniforms:Sn([_t.points,_t.fog]),vertexShader:Zt.points_vert,fragmentShader:Zt.points_frag},dashed:{uniforms:Sn([_t.common,_t.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Zt.linedashed_vert,fragmentShader:Zt.linedashed_frag},depth:{uniforms:Sn([_t.common,_t.displacementmap]),vertexShader:Zt.depth_vert,fragmentShader:Zt.depth_frag},normal:{uniforms:Sn([_t.common,_t.bumpmap,_t.normalmap,_t.displacementmap,{opacity:{value:1}}]),vertexShader:Zt.meshnormal_vert,fragmentShader:Zt.meshnormal_frag},sprite:{uniforms:Sn([_t.sprite,_t.fog]),vertexShader:Zt.sprite_vert,fragmentShader:Zt.sprite_frag},background:{uniforms:{uvTransform:{value:new Vt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Zt.background_vert,fragmentShader:Zt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Vt}},vertexShader:Zt.backgroundCube_vert,fragmentShader:Zt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Zt.cube_vert,fragmentShader:Zt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Zt.equirect_vert,fragmentShader:Zt.equirect_frag},distance:{uniforms:Sn([_t.common,_t.displacementmap,{referencePosition:{value:new L},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Zt.distance_vert,fragmentShader:Zt.distance_frag},shadow:{uniforms:Sn([_t.lights,_t.fog,{color:{value:new te(0)},opacity:{value:1}}]),vertexShader:Zt.shadow_vert,fragmentShader:Zt.shadow_frag}};ji.physical={uniforms:Sn([ji.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Vt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Vt},clearcoatNormalScale:{value:new Lt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Vt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Vt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Vt},sheen:{value:0},sheenColor:{value:new te(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Vt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Vt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Vt},transmissionSamplerSize:{value:new Lt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Vt},attenuationDistance:{value:0},attenuationColor:{value:new te(0)},specularColor:{value:new te(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Vt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Vt},anisotropyVector:{value:new Lt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Vt}}]),vertexShader:Zt.meshphysical_vert,fragmentShader:Zt.meshphysical_frag};var ud={r:0,b:0,g:0},aR=new Ie,_M=new Vt;_M.set(-1,0,0,0,1,0,0,0,1);function rR(e,t,n,i,s,a){let r=new te(0),o=s===!0?0:1,c,l,h=null,d=0,u=null;function p(g){let y=g.isScene===!0?g.background:null;if(y&&y.isTexture){let _=g.backgroundBlurriness>0;y=t.get(y,_)}return y}function m(g){let y=!1,_=p(g);_===null?v(r,o):_&&_.isColor&&(v(_,1),y=!0);let T=e.xr.getEnvironmentBlendMode();T==="additive"?n.buffers.color.setClear(0,0,0,1,a):T==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||y)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function S(g,y){let _=p(y);_&&(_.isCubeTexture||_.mapping===cc)?(l===void 0&&(l=new je(new yo(1,1,1),new ti({name:"BackgroundCubeMaterial",uniforms:ir(ji.backgroundCube.uniforms),vertexShader:ji.backgroundCube.vertexShader,fragmentShader:ji.backgroundCube.fragmentShader,side:Cn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),l.geometry.deleteAttribute("uv"),l.onBeforeRender=function(T,A,w){this.matrixWorld.copyPosition(w.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(l)),l.material.uniforms.envMap.value=_,l.material.uniforms.backgroundBlurriness.value=y.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(aR.makeRotationFromEuler(y.backgroundRotation)).transpose(),_.isCubeTexture&&_.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(_M),l.material.toneMapped=ne.getTransfer(_.colorSpace)!==fe,(h!==_||d!==_.version||u!==e.toneMapping)&&(l.material.needsUpdate=!0,h=_,d=_.version,u=e.toneMapping),l.layers.enableAll(),g.unshift(l,l.geometry,l.material,0,0,null)):_&&_.isTexture&&(c===void 0&&(c=new je(new ma(2,2),new ti({name:"BackgroundMaterial",uniforms:ir(ji.background.uniforms),vertexShader:ji.background.vertexShader,fragmentShader:ji.background.fragmentShader,side:Ts,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(c)),c.material.uniforms.t2D.value=_,c.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,c.material.toneMapped=ne.getTransfer(_.colorSpace)!==fe,_.matrixAutoUpdate===!0&&_.updateMatrix(),c.material.uniforms.uvTransform.value.copy(_.matrix),(h!==_||d!==_.version||u!==e.toneMapping)&&(c.material.needsUpdate=!0,h=_,d=_.version,u=e.toneMapping),c.layers.enableAll(),g.unshift(c,c.geometry,c.material,0,0,null))}function v(g,y){g.getRGB(ud,p0(e)),n.buffers.color.setClear(ud.r,ud.g,ud.b,y,a)}function f(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return r},setClearColor:function(g,y=1){r.set(g),o=y,v(r,o)},getClearAlpha:function(){return o},setClearAlpha:function(g){o=g,v(r,o)},render:m,addToRenderList:S,dispose:f}}function oR(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},s=u(null),a=s,r=!1;function o(D,I,q,J,z){let B=!1,V=d(D,J,q,I);a!==V&&(a=V,l(a.object)),B=p(D,J,q,z),B&&m(D,J,q,z),z!==null&&t.update(z,e.ELEMENT_ARRAY_BUFFER),(B||r)&&(r=!1,_(D,I,q,J),z!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(z).buffer))}function c(){return e.createVertexArray()}function l(D){return e.bindVertexArray(D)}function h(D){return e.deleteVertexArray(D)}function d(D,I,q,J){let z=J.wireframe===!0,B=i[I.id];B===void 0&&(B={},i[I.id]=B);let V=D.isInstancedMesh===!0?D.id:0,j=B[V];j===void 0&&(j={},B[V]=j);let lt=j[q.id];lt===void 0&&(lt={},j[q.id]=lt);let ut=lt[z];return ut===void 0&&(ut=u(c()),lt[z]=ut),ut}function u(D){let I=[],q=[],J=[];for(let z=0;z<n;z++)I[z]=0,q[z]=0,J[z]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:I,enabledAttributes:q,attributeDivisors:J,object:D,attributes:{},index:null}}function p(D,I,q,J){let z=a.attributes,B=I.attributes,V=0,j=q.getAttributes();for(let lt in j)if(j[lt].location>=0){let ct=z[lt],ot=B[lt];if(ot===void 0&&(lt==="instanceMatrix"&&D.instanceMatrix&&(ot=D.instanceMatrix),lt==="instanceColor"&&D.instanceColor&&(ot=D.instanceColor)),ct===void 0||ct.attribute!==ot||ot&&ct.data!==ot.data)return!0;V++}return a.attributesNum!==V||a.index!==J}function m(D,I,q,J){let z={},B=I.attributes,V=0,j=q.getAttributes();for(let lt in j)if(j[lt].location>=0){let ct=B[lt];ct===void 0&&(lt==="instanceMatrix"&&D.instanceMatrix&&(ct=D.instanceMatrix),lt==="instanceColor"&&D.instanceColor&&(ct=D.instanceColor));let ot={};ot.attribute=ct,ct&&ct.data&&(ot.data=ct.data),z[lt]=ot,V++}a.attributes=z,a.attributesNum=V,a.index=J}function S(){let D=a.newAttributes;for(let I=0,q=D.length;I<q;I++)D[I]=0}function v(D){f(D,0)}function f(D,I){let q=a.newAttributes,J=a.enabledAttributes,z=a.attributeDivisors;q[D]=1,J[D]===0&&(e.enableVertexAttribArray(D),J[D]=1),z[D]!==I&&(e.vertexAttribDivisor(D,I),z[D]=I)}function g(){let D=a.newAttributes,I=a.enabledAttributes;for(let q=0,J=I.length;q<J;q++)I[q]!==D[q]&&(e.disableVertexAttribArray(q),I[q]=0)}function y(D,I,q,J,z,B,V){V===!0?e.vertexAttribIPointer(D,I,q,z,B):e.vertexAttribPointer(D,I,q,J,z,B)}function _(D,I,q,J){S();let z=J.attributes,B=q.getAttributes(),V=I.defaultAttributeValues;for(let j in B){let lt=B[j];if(lt.location>=0){let ut=z[j];if(ut===void 0&&(j==="instanceMatrix"&&D.instanceMatrix&&(ut=D.instanceMatrix),j==="instanceColor"&&D.instanceColor&&(ut=D.instanceColor)),ut!==void 0){let ct=ut.normalized,ot=ut.itemSize,Nt=t.get(ut);if(Nt===void 0)continue;let Wt=Nt.buffer,kt=Nt.type,K=Nt.bytesPerElement,et=kt===e.INT||kt===e.UNSIGNED_INT||ut.gpuType===Af;if(ut.isInterleavedBufferAttribute){let nt=ut.data,Mt=nt.stride,Ut=ut.offset;if(nt.isInstancedInterleavedBuffer){for(let wt=0;wt<lt.locationSize;wt++)f(lt.location+wt,nt.meshPerAttribute);D.isInstancedMesh!==!0&&J._maxInstanceCount===void 0&&(J._maxInstanceCount=nt.meshPerAttribute*nt.count)}else for(let wt=0;wt<lt.locationSize;wt++)v(lt.location+wt);e.bindBuffer(e.ARRAY_BUFFER,Wt);for(let wt=0;wt<lt.locationSize;wt++)y(lt.location+wt,ot/lt.locationSize,kt,ct,Mt*K,(Ut+ot/lt.locationSize*wt)*K,et)}else{if(ut.isInstancedBufferAttribute){for(let nt=0;nt<lt.locationSize;nt++)f(lt.location+nt,ut.meshPerAttribute);D.isInstancedMesh!==!0&&J._maxInstanceCount===void 0&&(J._maxInstanceCount=ut.meshPerAttribute*ut.count)}else for(let nt=0;nt<lt.locationSize;nt++)v(lt.location+nt);e.bindBuffer(e.ARRAY_BUFFER,Wt);for(let nt=0;nt<lt.locationSize;nt++)y(lt.location+nt,ot/lt.locationSize,kt,ct,ot*K,ot/lt.locationSize*nt*K,et)}}else if(V!==void 0){let ct=V[j];if(ct!==void 0)switch(ct.length){case 2:e.vertexAttrib2fv(lt.location,ct);break;case 3:e.vertexAttrib3fv(lt.location,ct);break;case 4:e.vertexAttrib4fv(lt.location,ct);break;default:e.vertexAttrib1fv(lt.location,ct)}}}}g()}function T(){M();for(let D in i){let I=i[D];for(let q in I){let J=I[q];for(let z in J){let B=J[z];for(let V in B)h(B[V].object),delete B[V];delete J[z]}}delete i[D]}}function A(D){if(i[D.id]===void 0)return;let I=i[D.id];for(let q in I){let J=I[q];for(let z in J){let B=J[z];for(let V in B)h(B[V].object),delete B[V];delete J[z]}}delete i[D.id]}function w(D){for(let I in i){let q=i[I];for(let J in q){let z=q[J];if(z[D.id]===void 0)continue;let B=z[D.id];for(let V in B)h(B[V].object),delete B[V];delete z[D.id]}}}function x(D){for(let I in i){let q=i[I],J=D.isInstancedMesh===!0?D.id:0,z=q[J];if(z!==void 0){for(let B in z){let V=z[B];for(let j in V)h(V[j].object),delete V[j];delete z[B]}delete q[J],Object.keys(q).length===0&&delete i[I]}}}function M(){R(),r=!0,a!==s&&(a=s,l(a.object))}function R(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:M,resetDefaultState:R,dispose:T,releaseStatesOfGeometry:A,releaseStatesOfObject:x,releaseStatesOfProgram:w,initAttributes:S,enableAttribute:v,disableUnusedAttributes:g}}function lR(e,t,n){let i;function s(c){i=c}function a(c,l){e.drawArrays(i,c,l),n.update(l,i,1)}function r(c,l,h){h!==0&&(e.drawArraysInstanced(i,c,l,h),n.update(l,i,h))}function o(c,l,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,l,0,h);let u=0;for(let p=0;p<h;p++)u+=l[p];n.update(u,i,1)}this.setMode=s,this.render=a,this.renderInstances=r,this.renderMultiDraw=o}function cR(e,t,n,i){let s;function a(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let w=t.get("EXT_texture_filter_anisotropic");s=e.getParameter(w.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function r(w){return!(w!==yi&&i.convert(w)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(w){let x=w===Ji&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(w!==ii&&i.convert(w)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE)&&w!==Ri&&!x)}function c(w){if(w==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";w="mediump"}return w==="mediump"&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=n.precision!==void 0?n.precision:"highp",h=c(l);h!==l&&(It("WebGLRenderer:",l,"not supported, using",h,"instead."),l=h);let d=n.logarithmicDepthBuffer===!0,u=n.reversedDepthBuffer===!0&&t.has("EXT_clip_control");n.reversedDepthBuffer===!0&&u===!1&&It("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),S=e.getParameter(e.MAX_TEXTURE_SIZE),v=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),f=e.getParameter(e.MAX_VERTEX_ATTRIBS),g=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),_=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),T=e.getParameter(e.MAX_SAMPLES),A=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:r,textureTypeReadable:o,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:u,maxTextures:p,maxVertexTextures:m,maxTextureSize:S,maxCubemapSize:v,maxAttributes:f,maxVertexUniforms:g,maxVaryings:y,maxFragmentUniforms:_,maxSamples:T,samples:A}}function uR(e){let t=this,n=null,i=0,s=!1,a=!1,r=new Vi,o=new Vt,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(d,u){let p=d.length!==0||u||i!==0||s;return s=u,i=d.length,p},this.beginShadows=function(){a=!0,h(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(d,u){n=h(d,u,0)},this.setState=function(d,u,p){let m=d.clippingPlanes,S=d.clipIntersection,v=d.clipShadows,f=e.get(d);if(!s||m===null||m.length===0||a&&!v)a?h(null):l();else{let g=a?0:i,y=g*4,_=f.clippingState||null;c.value=_,_=h(m,u,y,p);for(let T=0;T!==y;++T)_[T]=n[T];f.clippingState=_,this.numIntersection=S?this.numPlanes:0,this.numPlanes+=g}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=i>0),t.numPlanes=i,t.numIntersection=0}function h(d,u,p,m){let S=d!==null?d.length:0,v=null;if(S!==0){if(v=c.value,m!==!0||v===null){let f=p+S*4,g=u.matrixWorldInverse;o.getNormalMatrix(g),(v===null||v.length<f)&&(v=new Float32Array(f));for(let y=0,_=p;y!==S;++y,_+=4)r.copy(d[y]).applyMatrix4(g,o),r.normal.toArray(v,_),v[_+3]=r.constant}c.value=v,c.needsUpdate=!0}return t.numPlanes=S,t.numIntersection=0,v}}var Ma=4,JS=[.125,.215,.35,.446,.526,.582],sr=20,hR=256,_c=new rc,KS=new te,_0=null,y0=0,x0=0,b0=!1,fR=new L,fd=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,n=0,i=.1,s=100,a={}){let{size:r=256,position:o=fR}=a;_0=this._renderer.getRenderTarget(),y0=this._renderer.getActiveCubeFace(),x0=this._renderer.getActiveMipmapLevel(),b0=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(r);let c=this._allocateTargets();return c.depthBuffer=!0,this._sceneToCubeUV(t,i,s,c,o),n>0&&this._blur(c,0,0,n),this._applyPMREM(c),this._cleanup(c),c}fromEquirectangular(t,n=null){return this._fromTexture(t,n)}fromCubemap(t,n=null){return this._fromTexture(t,n)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=$S(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=QS(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(_0,y0,x0),this._renderer.xr.enabled=b0,t.scissorTest=!1,To(t,0,0,t.width,t.height)}_fromTexture(t,n){t.mapping===ya||t.mapping===nr?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),_0=this._renderer.getRenderTarget(),y0=this._renderer.getActiveCubeFace(),x0=this._renderer.getActiveMipmapLevel(),b0=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=n||this._allocateTargets();return this._textureToCubeUV(t,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),n=4*this._cubeSize,i={magFilter:mn,minFilter:mn,generateMipmaps:!1,type:Ji,format:yi,colorSpace:Fl,depthBuffer:!1},s=jS(t,n,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==n){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=jS(t,n,i);let{_lodMax:a}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=dR(a)),this._blurMaterial=mR(a,t,n),this._ggxMaterial=pR(a,t,n)}return s}_compileMaterial(t){let n=new je(new Ve,t);this._renderer.compile(n,_c)}_sceneToCubeUV(t,n,i,s,a){let c=new xn(90,1,n,i),l=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],d=this._renderer,u=d.autoClear,p=d.toneMapping;d.getClearColor(KS),d.toneMapping=wi,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(s),d.clearDepth(),d.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new je(new yo,new vi({name:"PMREM.Background",side:Cn,depthWrite:!1,depthTest:!1})));let S=this._backgroundBox,v=S.material,f=!1,g=t.background;g?g.isColor&&(v.color.copy(g),t.background=null,f=!0):(v.color.copy(KS),f=!0);for(let y=0;y<6;y++){let _=y%3;_===0?(c.up.set(0,l[y],0),c.position.set(a.x,a.y,a.z),c.lookAt(a.x+h[y],a.y,a.z)):_===1?(c.up.set(0,0,l[y]),c.position.set(a.x,a.y,a.z),c.lookAt(a.x,a.y+h[y],a.z)):(c.up.set(0,l[y],0),c.position.set(a.x,a.y,a.z),c.lookAt(a.x,a.y,a.z+h[y]));let T=this._cubeSize;To(s,_*T,y>2?T:0,T,T),d.setRenderTarget(s),f&&d.render(S,c),d.render(t,c)}d.toneMapping=p,d.autoClear=u,t.background=g}_textureToCubeUV(t,n){let i=this._renderer,s=t.mapping===ya||t.mapping===nr;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=$S()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=QS());let a=s?this._cubemapMaterial:this._equirectMaterial,r=this._lodMeshes[0];r.material=a;let o=a.uniforms;o.envMap.value=t;let c=this._cubeSize;To(n,0,0,3*c,2*c),i.setRenderTarget(n),i.render(r,_c)}_applyPMREM(t){let n=this._renderer,i=n.autoClear;n.autoClear=!1;let s=this._lodMeshes.length;for(let a=1;a<s;a++)this._applyGGXFilter(t,a-1,a);n.autoClear=i}_applyGGXFilter(t,n,i){let s=this._renderer,a=this._pingPongRenderTarget,r=this._ggxMaterial,o=this._lodMeshes[i];o.material=r;let c=r.uniforms,l=i/(this._lodMeshes.length-1),h=n/(this._lodMeshes.length-1),d=Math.sqrt(l*l-h*h),u=0+l*1.25,p=d*u,{_lodMax:m}=this,S=this._sizeLods[i],v=3*S*(i>m-Ma?i-m+Ma:0),f=4*(this._cubeSize-S);c.envMap.value=t.texture,c.roughness.value=p,c.mipInt.value=m-n,To(a,v,f,3*S,2*S),s.setRenderTarget(a),s.render(o,_c),c.envMap.value=a.texture,c.roughness.value=0,c.mipInt.value=m-i,To(t,v,f,3*S,2*S),s.setRenderTarget(t),s.render(o,_c)}_blur(t,n,i,s,a){let r=this._pingPongRenderTarget;this._halfBlur(t,r,n,i,s,"latitudinal",a),this._halfBlur(r,t,i,i,s,"longitudinal",a)}_halfBlur(t,n,i,s,a,r,o){let c=this._renderer,l=this._blurMaterial;r!=="latitudinal"&&r!=="longitudinal"&&zt("blur direction must be either latitudinal or longitudinal!");let h=3,d=this._lodMeshes[s];d.material=l;let u=l.uniforms,p=this._sizeLods[i]-1,m=isFinite(a)?Math.PI/(2*p):2*Math.PI/(2*sr-1),S=a/m,v=isFinite(a)?1+Math.floor(h*S):sr;v>sr&&It(`sigmaRadians, ${a}, is too large and will clip, as it requested ${v} samples when the maximum is set to ${sr}`);let f=[],g=0;for(let w=0;w<sr;++w){let x=w/S,M=Math.exp(-x*x/2);f.push(M),w===0?g+=M:w<v&&(g+=2*M)}for(let w=0;w<f.length;w++)f[w]=f[w]/g;u.envMap.value=t.texture,u.samples.value=v,u.weights.value=f,u.latitudinal.value=r==="latitudinal",o&&(u.poleAxis.value=o);let{_lodMax:y}=this;u.dTheta.value=m,u.mipInt.value=y-i;let _=this._sizeLods[s],T=3*_*(s>y-Ma?s-y+Ma:0),A=4*(this._cubeSize-_);To(n,T,A,3*_,2*_),c.setRenderTarget(n),c.render(d,_c)}};function dR(e){let t=[],n=[],i=[],s=e,a=e-Ma+1+JS.length;for(let r=0;r<a;r++){let o=Math.pow(2,s);t.push(o);let c=1/o;r>e-Ma?c=JS[r-e+Ma-1]:r===0&&(c=0),n.push(c);let l=1/(o-2),h=-l,d=1+l,u=[h,h,d,h,d,d,h,h,d,d,h,d],p=6,m=6,S=3,v=2,f=1,g=new Float32Array(S*m*p),y=new Float32Array(v*m*p),_=new Float32Array(f*m*p);for(let A=0;A<p;A++){let w=A%3*2/3-1,x=A>2?0:-1,M=[w,x,0,w+2/3,x,0,w+2/3,x+1,0,w,x,0,w+2/3,x+1,0,w,x+1,0];g.set(M,S*m*A),y.set(u,v*m*A);let R=[A,A,A,A,A,A];_.set(R,f*m*A)}let T=new Ve;T.setAttribute("position",new jn(g,S)),T.setAttribute("uv",new jn(y,v)),T.setAttribute("faceIndex",new jn(_,f)),i.push(new je(T,null)),s>Ma&&s--}return{lodMeshes:i,sizeLods:t,sigmas:n}}function jS(e,t,n){let i=new Qn(e,t,n);return i.texture.mapping=cc,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function To(e,t,n,i,s){e.viewport.set(t,n,i,s),e.scissor.set(t,n,i,s)}function pR(e,t,n){return new ti({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:hR,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:md(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Zi,depthTest:!1,depthWrite:!1})}function mR(e,t,n){let i=new Float32Array(sr),s=new L(0,1,0);return new ti({name:"SphericalGaussianBlur",defines:{n:sr,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:md(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Zi,depthTest:!1,depthWrite:!1})}function QS(){return new ti({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:md(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Zi,depthTest:!1,depthWrite:!1})}function $S(){return new ti({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:md(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Zi,depthTest:!1,depthWrite:!1})}function md(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var dd=class extends Qn{constructor(t=1,n={}){super(t,t,n),this.isWebGLCubeRenderTarget=!0;let i={width:t,height:t,depth:1},s=[i,i,i,i,i,i];this.texture=new jl(s),this._setTextureOptions(n),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,n){this.texture.type=n.type,this.texture.colorSpace=n.colorSpace,this.texture.generateMipmaps=n.generateMipmaps,this.texture.minFilter=n.minFilter,this.texture.magFilter=n.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new yo(5,5,5),a=new ti({name:"CubemapFromEquirect",uniforms:ir(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Cn,blending:Zi});a.uniforms.tEquirect.value=n;let r=new je(s,a),o=n.minFilter;return n.minFilter===xa&&(n.minFilter=mn),new xf(1,10,this).update(t,r),n.minFilter=o,r.geometry.dispose(),r.material.dispose(),this}clear(t,n=!0,i=!0,s=!0){let a=t.getRenderTarget();for(let r=0;r<6;r++)t.setRenderTarget(this,r),t.clear(n,i,s);t.setRenderTarget(a)}};function gR(e){let t=new WeakMap,n=new WeakMap,i=null;function s(u,p=!1){return u==null?null:p?r(u):a(u)}function a(u){if(u&&u.isTexture){let p=u.mapping;if(p===Mf||p===Ef)if(t.has(u)){let m=t.get(u).texture;return o(m,u.mapping)}else{let m=u.image;if(m&&m.height>0){let S=new dd(m.height);return S.fromEquirectangularTexture(e,u),t.set(u,S),u.addEventListener("dispose",l),o(S.texture,u.mapping)}else return null}}return u}function r(u){if(u&&u.isTexture){let p=u.mapping,m=p===Mf||p===Ef,S=p===ya||p===nr;if(m||S){let v=n.get(u),f=v!==void 0?v.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==f)return i===null&&(i=new fd(e)),v=m?i.fromEquirectangular(u,v):i.fromCubemap(u,v),v.texture.pmremVersion=u.pmremVersion,n.set(u,v),v.texture;if(v!==void 0)return v.texture;{let g=u.image;return m&&g&&g.height>0||S&&g&&c(g)?(i===null&&(i=new fd(e)),v=m?i.fromEquirectangular(u):i.fromCubemap(u),v.texture.pmremVersion=u.pmremVersion,n.set(u,v),u.addEventListener("dispose",h),v.texture):null}}}return u}function o(u,p){return p===Mf?u.mapping=ya:p===Ef&&(u.mapping=nr),u}function c(u){let p=0,m=6;for(let S=0;S<m;S++)u[S]!==void 0&&p++;return p===m}function l(u){let p=u.target;p.removeEventListener("dispose",l);let m=t.get(p);m!==void 0&&(t.delete(p),m.dispose())}function h(u){let p=u.target;p.removeEventListener("dispose",h);let m=n.get(p);m!==void 0&&(n.delete(p),m.dispose())}function d(){t=new WeakMap,n=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:s,dispose:d}}function vR(e){let t={};function n(i){if(t[i]!==void 0)return t[i];let s=e.getExtension(i);return t[i]=s,s}return{has:function(i){return n(i)!==null},init:function(){n("EXT_color_buffer_float"),n("WEBGL_clip_cull_distance"),n("OES_texture_float_linear"),n("EXT_color_buffer_half_float"),n("WEBGL_multisampled_render_to_texture"),n("WEBGL_render_shared_exponent")},get:function(i){let s=n(i);return s===null&&ja("WebGLRenderer: "+i+" extension not supported."),s}}}function _R(e,t,n,i){let s={},a=new WeakMap;function r(d){let u=d.target;u.index!==null&&t.remove(u.index);for(let m in u.attributes)t.remove(u.attributes[m]);u.removeEventListener("dispose",r),delete s[u.id];let p=a.get(u);p&&(t.remove(p),a.delete(u)),i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,n.memory.geometries--}function o(d,u){return s[u.id]===!0||(u.addEventListener("dispose",r),s[u.id]=!0,n.memory.geometries++),u}function c(d){let u=d.attributes;for(let p in u)t.update(u[p],e.ARRAY_BUFFER)}function l(d){let u=[],p=d.index,m=d.attributes.position,S=0;if(m===void 0)return;if(p!==null){let g=p.array;S=p.version;for(let y=0,_=g.length;y<_;y+=3){let T=g[y+0],A=g[y+1],w=g[y+2];u.push(T,A,A,w,w,T)}}else{let g=m.array;S=m.version;for(let y=0,_=g.length/3-1;y<_;y+=3){let T=y+0,A=y+1,w=y+2;u.push(T,A,A,w,w,T)}}let v=new(m.count>=65535?Zl:Yl)(u,1);v.version=S;let f=a.get(d);f&&t.remove(f),a.set(d,v)}function h(d){let u=a.get(d);if(u){let p=d.index;p!==null&&u.version<p.version&&l(d)}else l(d);return a.get(d)}return{get:o,update:c,getWireframeAttribute:h}}function yR(e,t,n){let i;function s(d){i=d}let a,r;function o(d){a=d.type,r=d.bytesPerElement}function c(d,u){e.drawElements(i,u,a,d*r),n.update(u,i,1)}function l(d,u,p){p!==0&&(e.drawElementsInstanced(i,u,a,d*r,p),n.update(u,i,p))}function h(d,u,p){if(p===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,a,d,0,p);let S=0;for(let v=0;v<p;v++)S+=u[v];n.update(S,i,1)}this.setMode=s,this.setIndex=o,this.render=c,this.renderInstances=l,this.renderMultiDraw=h}function xR(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function i(a,r,o){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=o*(a/3);break;case e.LINES:n.lines+=o*(a/2);break;case e.LINE_STRIP:n.lines+=o*(a-1);break;case e.LINE_LOOP:n.lines+=o*a;break;case e.POINTS:n.points+=o*a;break;default:zt("WebGLInfo: Unknown draw mode:",r);break}}function s(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:s,update:i}}function bR(e,t,n){let i=new WeakMap,s=new Oe;function a(r,o,c){let l=r.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,d=h!==void 0?h.length:0,u=i.get(o);if(u===void 0||u.count!==d){let M=function(){w.dispose(),i.delete(o),o.removeEventListener("dispose",M)};u!==void 0&&u.texture.dispose();let p=o.morphAttributes.position!==void 0,m=o.morphAttributes.normal!==void 0,S=o.morphAttributes.color!==void 0,v=o.morphAttributes.position||[],f=o.morphAttributes.normal||[],g=o.morphAttributes.color||[],y=0;p===!0&&(y=1),m===!0&&(y=2),S===!0&&(y=3);let _=o.attributes.position.count*y,T=1;_>t.maxTextureSize&&(T=Math.ceil(_/t.maxTextureSize),_=t.maxTextureSize);let A=new Float32Array(_*T*4*d),w=new kl(A,_,T,d);w.type=Ri,w.needsUpdate=!0;let x=y*4;for(let R=0;R<d;R++){let D=v[R],I=f[R],q=g[R],J=_*T*4*R;for(let z=0;z<D.count;z++){let B=z*x;p===!0&&(s.fromBufferAttribute(D,z),A[J+B+0]=s.x,A[J+B+1]=s.y,A[J+B+2]=s.z,A[J+B+3]=0),m===!0&&(s.fromBufferAttribute(I,z),A[J+B+4]=s.x,A[J+B+5]=s.y,A[J+B+6]=s.z,A[J+B+7]=0),S===!0&&(s.fromBufferAttribute(q,z),A[J+B+8]=s.x,A[J+B+9]=s.y,A[J+B+10]=s.z,A[J+B+11]=q.itemSize===4?s.w:1)}}u={count:d,texture:w,size:new Lt(_,T)},i.set(o,u),o.addEventListener("dispose",M)}if(r.isInstancedMesh===!0&&r.morphTexture!==null)c.getUniforms().setValue(e,"morphTexture",r.morphTexture,n);else{let p=0;for(let S=0;S<l.length;S++)p+=l[S];let m=o.morphTargetsRelative?1:1-p;c.getUniforms().setValue(e,"morphTargetBaseInfluence",m),c.getUniforms().setValue(e,"morphTargetInfluences",l)}c.getUniforms().setValue(e,"morphTargetsTexture",u.texture,n),c.getUniforms().setValue(e,"morphTargetsTextureSize",u.size)}return{update:a}}function SR(e,t,n,i,s){let a=new WeakMap;function r(l){let h=s.render.frame,d=l.geometry,u=t.get(l,d);if(a.get(u)!==h&&(t.update(u),a.set(u,h)),l.isInstancedMesh&&(l.hasEventListener("dispose",c)===!1&&l.addEventListener("dispose",c),a.get(l)!==h&&(n.update(l.instanceMatrix,e.ARRAY_BUFFER),l.instanceColor!==null&&n.update(l.instanceColor,e.ARRAY_BUFFER),a.set(l,h))),l.isSkinnedMesh){let p=l.skeleton;a.get(p)!==h&&(p.update(),a.set(p,h))}return u}function o(){a=new WeakMap}function c(l){let h=l.target;h.removeEventListener("dispose",c),i.releaseStatesOfObject(h),n.remove(h.instanceMatrix),h.instanceColor!==null&&n.remove(h.instanceColor)}return{update:r,dispose:o}}var MR={[Jg]:"LINEAR_TONE_MAPPING",[Kg]:"REINHARD_TONE_MAPPING",[jg]:"CINEON_TONE_MAPPING",[Qg]:"ACES_FILMIC_TONE_MAPPING",[t0]:"AGX_TONE_MAPPING",[e0]:"NEUTRAL_TONE_MAPPING",[$g]:"CUSTOM_TONE_MAPPING"};function ER(e,t,n,i,s,a){let r=new Qn(t,n,{type:e,depthBuffer:s,stencilBuffer:a,samples:i?4:0,depthTexture:s?new As(t,n):void 0}),o=new Qn(t,n,{type:Ji,depthBuffer:!1,stencilBuffer:!1}),c=new Ve;c.setAttribute("position",new Te([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new Te([0,2,0,0,2,0],2));let l=new of({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),h=new je(c,l),d=new rc(-1,1,1,-1,0,1),u=null,p=null,m=!1,S,v=null,f=[],g=!1;this.setSize=function(y,_){r.setSize(y,_),o.setSize(y,_);for(let T=0;T<f.length;T++){let A=f[T];A.setSize&&A.setSize(y,_)}},this.setEffects=function(y){f=y,g=f.length>0&&f[0].isRenderPass===!0;let _=r.width,T=r.height;for(let A=0;A<f.length;A++){let w=f[A];w.setSize&&w.setSize(_,T)}},this.begin=function(y,_){if(m||y.toneMapping===wi&&f.length===0)return!1;if(v=_,_!==null){let T=_.width,A=_.height;(r.width!==T||r.height!==A)&&this.setSize(T,A)}return g===!1&&y.setRenderTarget(r),S=y.toneMapping,y.toneMapping=wi,!0},this.hasRenderPass=function(){return g},this.end=function(y,_){y.toneMapping=S,m=!0;let T=r,A=o;for(let w=0;w<f.length;w++){let x=f[w];if(x.enabled!==!1&&(x.render(y,A,T,_),x.needsSwap!==!1)){let M=T;T=A,A=M}}if(u!==y.outputColorSpace||p!==y.toneMapping){u=y.outputColorSpace,p=y.toneMapping,l.defines={},ne.getTransfer(u)===fe&&(l.defines.SRGB_TRANSFER="");let w=MR[p];w&&(l.defines[w]=""),l.needsUpdate=!0}l.uniforms.tDiffuse.value=T.texture,y.setRenderTarget(v),y.render(h,d),v=null,m=!1},this.isCompositing=function(){return m},this.dispose=function(){r.depthTexture&&r.depthTexture.dispose(),r.dispose(),o.dispose(),c.dispose(),l.dispose()}}var yM=new bn,E0=new As(1,1),xM=new kl,bM=new Yh,SM=new jl,tM=[],eM=[],nM=new Float32Array(16),iM=new Float32Array(9),sM=new Float32Array(4);function wo(e,t,n){let i=e[0];if(i<=0||i>0)return e;let s=t*n,a=tM[s];if(a===void 0&&(a=new Float32Array(s),tM[s]=a),t!==0){i.toArray(a,0);for(let r=1,o=0;r!==t;++r)o+=n,e[r].toArray(a,o)}return a}function tn(e,t){if(e.length!==t.length)return!1;for(let n=0,i=e.length;n<i;n++)if(e[n]!==t[n])return!1;return!0}function en(e,t){for(let n=0,i=t.length;n<i;n++)e[n]=t[n]}function gd(e,t){let n=eM[t];n===void 0&&(n=new Int32Array(t),eM[t]=n);for(let i=0;i!==t;++i)n[i]=e.allocateTextureUnit();return n}function TR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function AR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(tn(n,t))return;e.uniform2fv(this.addr,t),en(n,t)}}function wR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(tn(n,t))return;e.uniform3fv(this.addr,t),en(n,t)}}function CR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(tn(n,t))return;e.uniform4fv(this.addr,t),en(n,t)}}function RR(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(tn(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),en(n,t)}else{if(tn(n,i))return;sM.set(i),e.uniformMatrix2fv(this.addr,!1,sM),en(n,i)}}function DR(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(tn(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),en(n,t)}else{if(tn(n,i))return;iM.set(i),e.uniformMatrix3fv(this.addr,!1,iM),en(n,i)}}function NR(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(tn(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),en(n,t)}else{if(tn(n,i))return;nM.set(i),e.uniformMatrix4fv(this.addr,!1,nM),en(n,i)}}function UR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function LR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(tn(n,t))return;e.uniform2iv(this.addr,t),en(n,t)}}function IR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(tn(n,t))return;e.uniform3iv(this.addr,t),en(n,t)}}function OR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(tn(n,t))return;e.uniform4iv(this.addr,t),en(n,t)}}function PR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function zR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(tn(n,t))return;e.uniform2uiv(this.addr,t),en(n,t)}}function BR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(tn(n,t))return;e.uniform3uiv(this.addr,t),en(n,t)}}function FR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(tn(n,t))return;e.uniform4uiv(this.addr,t),en(n,t)}}function VR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s);let a;this.type===e.SAMPLER_2D_SHADOW?(E0.compareFunction=n.isReversedDepthBuffer()?cd:ld,a=E0):a=yM,n.setTexture2D(t||a,s)}function HR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTexture3D(t||bM,s)}function GR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTextureCube(t||SM,s)}function kR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTexture2DArray(t||xM,s)}function XR(e){switch(e){case 5126:return TR;case 35664:return AR;case 35665:return wR;case 35666:return CR;case 35674:return RR;case 35675:return DR;case 35676:return NR;case 5124:case 35670:return UR;case 35667:case 35671:return LR;case 35668:case 35672:return IR;case 35669:case 35673:return OR;case 5125:return PR;case 36294:return zR;case 36295:return BR;case 36296:return FR;case 35678:case 36198:case 36298:case 36306:case 35682:return VR;case 35679:case 36299:case 36307:return HR;case 35680:case 36300:case 36308:case 36293:return GR;case 36289:case 36303:case 36311:case 36292:return kR}}function WR(e,t){e.uniform1fv(this.addr,t)}function qR(e,t){let n=wo(t,this.size,2);e.uniform2fv(this.addr,n)}function YR(e,t){let n=wo(t,this.size,3);e.uniform3fv(this.addr,n)}function ZR(e,t){let n=wo(t,this.size,4);e.uniform4fv(this.addr,n)}function JR(e,t){let n=wo(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function KR(e,t){let n=wo(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function jR(e,t){let n=wo(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function QR(e,t){e.uniform1iv(this.addr,t)}function $R(e,t){e.uniform2iv(this.addr,t)}function t2(e,t){e.uniform3iv(this.addr,t)}function e2(e,t){e.uniform4iv(this.addr,t)}function n2(e,t){e.uniform1uiv(this.addr,t)}function i2(e,t){e.uniform2uiv(this.addr,t)}function s2(e,t){e.uniform3uiv(this.addr,t)}function a2(e,t){e.uniform4uiv(this.addr,t)}function r2(e,t,n){let i=this.cache,s=t.length,a=gd(n,s);tn(i,a)||(e.uniform1iv(this.addr,a),en(i,a));let r;this.type===e.SAMPLER_2D_SHADOW?r=E0:r=yM;for(let o=0;o!==s;++o)n.setTexture2D(t[o]||r,a[o])}function o2(e,t,n){let i=this.cache,s=t.length,a=gd(n,s);tn(i,a)||(e.uniform1iv(this.addr,a),en(i,a));for(let r=0;r!==s;++r)n.setTexture3D(t[r]||bM,a[r])}function l2(e,t,n){let i=this.cache,s=t.length,a=gd(n,s);tn(i,a)||(e.uniform1iv(this.addr,a),en(i,a));for(let r=0;r!==s;++r)n.setTextureCube(t[r]||SM,a[r])}function c2(e,t,n){let i=this.cache,s=t.length,a=gd(n,s);tn(i,a)||(e.uniform1iv(this.addr,a),en(i,a));for(let r=0;r!==s;++r)n.setTexture2DArray(t[r]||xM,a[r])}function u2(e){switch(e){case 5126:return WR;case 35664:return qR;case 35665:return YR;case 35666:return ZR;case 35674:return JR;case 35675:return KR;case 35676:return jR;case 5124:case 35670:return QR;case 35667:case 35671:return $R;case 35668:case 35672:return t2;case 35669:case 35673:return e2;case 5125:return n2;case 36294:return i2;case 36295:return s2;case 36296:return a2;case 35678:case 36198:case 36298:case 36306:case 35682:return r2;case 35679:case 36299:case 36307:return o2;case 35680:case 36300:case 36308:case 36293:return l2;case 36289:case 36303:case 36311:case 36292:return c2}}var T0=class{constructor(t,n,i){this.id=t,this.addr=i,this.cache=[],this.type=n.type,this.setValue=XR(n.type)}},A0=class{constructor(t,n,i){this.id=t,this.addr=i,this.cache=[],this.type=n.type,this.size=n.size,this.setValue=u2(n.type)}},w0=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,n,i){let s=this.seq;for(let a=0,r=s.length;a!==r;++a){let o=s[a];o.setValue(t,n[o.id],i)}}},S0=/(\w+)(\])?(\[|\.)?/g;function aM(e,t){e.seq.push(t),e.map[t.id]=t}function h2(e,t,n){let i=e.name,s=i.length;for(S0.lastIndex=0;;){let a=S0.exec(i),r=S0.lastIndex,o=a[1],c=a[2]==="]",l=a[3];if(c&&(o=o|0),l===void 0||l==="["&&r+2===s){aM(n,l===void 0?new T0(o,e,t):new A0(o,e,t));break}else{let d=n.map[o];d===void 0&&(d=new w0(o),aM(n,d)),n=d}}}var Ao=class{constructor(t,n){this.seq=[],this.map={};let i=t.getProgramParameter(n,t.ACTIVE_UNIFORMS);for(let r=0;r<i;++r){let o=t.getActiveUniform(n,r),c=t.getUniformLocation(n,o.name);h2(o,c,this)}let s=[],a=[];for(let r of this.seq)r.type===t.SAMPLER_2D_SHADOW||r.type===t.SAMPLER_CUBE_SHADOW||r.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(r):a.push(r);s.length>0&&(this.seq=s.concat(a))}setValue(t,n,i,s){let a=this.map[n];a!==void 0&&a.setValue(t,i,s)}setOptional(t,n,i){let s=n[i];s!==void 0&&this.setValue(t,i,s)}static upload(t,n,i,s){for(let a=0,r=n.length;a!==r;++a){let o=n[a],c=i[o.id];c.needsUpdate!==!1&&o.setValue(t,c.value,s)}}static seqWithValue(t,n){let i=[];for(let s=0,a=t.length;s!==a;++s){let r=t[s];r.id in n&&i.push(r)}return i}};function rM(e,t,n){let i=e.createShader(t);return e.shaderSource(i,n),e.compileShader(i),i}var f2=37297,d2=0;function p2(e,t){let n=e.split(`
`),i=[],s=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let r=s;r<a;r++){let o=r+1;i.push(`${o===t?">":" "} ${o}: ${n[r]}`)}return i.join(`
`)}var oM=new Vt;function m2(e){ne._getMatrix(oM,ne.workingColorSpace,e);let t=`mat3( ${oM.elements.map(n=>n.toFixed(4))} )`;switch(ne.getTransfer(e)){case Vl:return[t,"LinearTransferOETF"];case fe:return[t,"sRGBTransferOETF"];default:return It("WebGLProgram: Unsupported color space: ",e),[t,"LinearTransferOETF"]}}function lM(e,t,n){let i=e.getShaderParameter(t,e.COMPILE_STATUS),a=(e.getShaderInfoLog(t)||"").trim();if(i&&a==="")return"";let r=/ERROR: 0:(\d+)/.exec(a);if(r){let o=parseInt(r[1]);return n.toUpperCase()+`

`+a+`

`+p2(e.getShaderSource(t),o)}else return a}function g2(e,t){let n=m2(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,"}"].join(`
`)}var v2={[Jg]:"Linear",[Kg]:"Reinhard",[jg]:"Cineon",[Qg]:"ACESFilmic",[t0]:"AgX",[e0]:"Neutral",[$g]:"Custom"};function _2(e,t){let n=v2[t];return n===void 0?(It("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+e+"( vec3 color ) { return "+n+"ToneMapping( color ); }"}var hd=new L;function y2(){ne.getLuminanceCoefficients(hd);let e=hd.x.toFixed(4),t=hd.y.toFixed(4),n=hd.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${t}, ${n} );`,"	return dot( weights, rgb );","}"].join(`
`)}function x2(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(xc).join(`
`)}function b2(e){let t=[];for(let n in e){let i=e[n];i!==!1&&t.push("#define "+n+" "+i)}return t.join(`
`)}function S2(e,t){let n={},i=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let s=0;s<i;s++){let a=e.getActiveAttrib(t,s),r=a.name,o=1;a.type===e.FLOAT_MAT2&&(o=2),a.type===e.FLOAT_MAT3&&(o=3),a.type===e.FLOAT_MAT4&&(o=4),n[r]={type:a.type,location:e.getAttribLocation(t,r),locationSize:o}}return n}function xc(e){return e!==""}function cM(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function uM(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var M2=/^[ \t]*#include +<([\w\d./]+)>/gm;function C0(e){return e.replace(M2,T2)}var E2=new Map;function T2(e,t){let n=Zt[t];if(n===void 0){let i=E2.get(t);if(i!==void 0)n=Zt[i],It('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return C0(n)}var A2=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function hM(e){return e.replace(A2,w2)}function w2(e,t,n,i){let s="";for(let a=parseInt(t);a<parseInt(n);a++)s+=i.replace(/\[\s*i\s*\]/g,"[ "+a+" ]").replace(/UNROLLED_LOOP_INDEX/g,a);return s}function fM(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision==="highp"?t+=`
#define HIGH_PRECISION`:e.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:e.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}var C2={[lc]:"SHADOWMAP_TYPE_PCF",[So]:"SHADOWMAP_TYPE_VSM"};function R2(e){return C2[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var D2={[ya]:"ENVMAP_TYPE_CUBE",[nr]:"ENVMAP_TYPE_CUBE",[cc]:"ENVMAP_TYPE_CUBE_UV"};function N2(e){return e.envMap===!1?"ENVMAP_TYPE_CUBE":D2[e.envMapMode]||"ENVMAP_TYPE_CUBE"}var U2={[nr]:"ENVMAP_MODE_REFRACTION"};function L2(e){return e.envMap===!1?"ENVMAP_MODE_REFLECTION":U2[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}var I2={[Zg]:"ENVMAP_BLENDING_MULTIPLY",[NS]:"ENVMAP_BLENDING_MIX",[US]:"ENVMAP_BLENDING_ADD"};function O2(e){return e.envMap===!1?"ENVMAP_BLENDING_NONE":I2[e.combine]||"ENVMAP_BLENDING_NONE"}function P2(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,n),7*16)),texelHeight:i,maxMip:n}}function z2(e,t,n,i){let s=e.getContext(),a=n.defines,r=n.vertexShader,o=n.fragmentShader,c=R2(n),l=N2(n),h=L2(n),d=O2(n),u=P2(n),p=x2(n),m=b2(a),S=s.createProgram(),v,f,g=n.glslVersion?"#version "+n.glslVersion+`
`:"";n.isRawShaderMaterial?(v=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,m].filter(xc).join(`
`),v.length>0&&(v+=`
`),f=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,m].filter(xc).join(`
`),f.length>0&&(f+=`
`)):(v=[fM(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,m,n.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",n.batching?"#define USE_BATCHING":"",n.batchingColor?"#define USE_BATCHING_COLOR":"",n.instancing?"#define USE_INSTANCING":"",n.instancingColor?"#define USE_INSTANCING_COLOR":"",n.instancingMorph?"#define USE_INSTANCING_MORPH":"",n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.map?"#define USE_MAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+h:"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.displacementMap?"#define USE_DISPLACEMENTMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.mapUv?"#define MAP_UV "+n.mapUv:"",n.alphaMapUv?"#define ALPHAMAP_UV "+n.alphaMapUv:"",n.lightMapUv?"#define LIGHTMAP_UV "+n.lightMapUv:"",n.aoMapUv?"#define AOMAP_UV "+n.aoMapUv:"",n.emissiveMapUv?"#define EMISSIVEMAP_UV "+n.emissiveMapUv:"",n.bumpMapUv?"#define BUMPMAP_UV "+n.bumpMapUv:"",n.normalMapUv?"#define NORMALMAP_UV "+n.normalMapUv:"",n.displacementMapUv?"#define DISPLACEMENTMAP_UV "+n.displacementMapUv:"",n.metalnessMapUv?"#define METALNESSMAP_UV "+n.metalnessMapUv:"",n.roughnessMapUv?"#define ROUGHNESSMAP_UV "+n.roughnessMapUv:"",n.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+n.anisotropyMapUv:"",n.clearcoatMapUv?"#define CLEARCOATMAP_UV "+n.clearcoatMapUv:"",n.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+n.clearcoatNormalMapUv:"",n.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+n.clearcoatRoughnessMapUv:"",n.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+n.iridescenceMapUv:"",n.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+n.iridescenceThicknessMapUv:"",n.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+n.sheenColorMapUv:"",n.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+n.sheenRoughnessMapUv:"",n.specularMapUv?"#define SPECULARMAP_UV "+n.specularMapUv:"",n.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+n.specularColorMapUv:"",n.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+n.specularIntensityMapUv:"",n.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+n.transmissionMapUv:"",n.thicknessMapUv?"#define THICKNESSMAP_UV "+n.thicknessMapUv:"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexNormals?"#define HAS_NORMAL":"",n.vertexColors?"#define USE_COLOR":"",n.vertexAlphas?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.flatShading?"#define FLAT_SHADED":"",n.skinning?"#define USE_SKINNING":"",n.morphTargets?"#define USE_MORPHTARGETS":"",n.morphNormals&&n.flatShading===!1?"#define USE_MORPHNORMALS":"",n.morphColors?"#define USE_MORPHCOLORS":"",n.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+n.morphTextureStride:"",n.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+n.morphTargetsCount:"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+c:"",n.sizeAttenuation?"#define USE_SIZEATTENUATION":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(xc).join(`
`),f=[fM(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,m,n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",n.map?"#define USE_MAP":"",n.matcap?"#define USE_MATCAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+l:"",n.envMap?"#define "+h:"",n.envMap?"#define "+d:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoat?"#define USE_CLEARCOAT":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.dispersion?"#define USE_DISPERSION":"",n.iridescence?"#define USE_IRIDESCENCE":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaTest?"#define USE_ALPHATEST":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.sheen?"#define USE_SHEEN":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexColors||n.instancingColor?"#define USE_COLOR":"",n.vertexAlphas||n.batchingColor?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.gradientMap?"#define USE_GRADIENTMAP":"",n.flatShading?"#define FLAT_SHADED":"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+c:"",n.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",n.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",n.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",n.toneMapping!==wi?"#define TONE_MAPPING":"",n.toneMapping!==wi?Zt.tonemapping_pars_fragment:"",n.toneMapping!==wi?_2("toneMapping",n.toneMapping):"",n.dithering?"#define DITHERING":"",n.opaque?"#define OPAQUE":"",Zt.colorspace_pars_fragment,g2("linearToOutputTexel",n.outputColorSpace),y2(),n.useDepthPacking?"#define DEPTH_PACKING "+n.depthPacking:"",`
`].filter(xc).join(`
`)),r=C0(r),r=cM(r,n),r=uM(r,n),o=C0(o),o=cM(o,n),o=uM(o,n),r=hM(r),o=hM(o),n.isRawShaderMaterial!==!0&&(g=`#version 300 es
`,v=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+v,f=["#define varying in",n.glslVersion===h0?"":"layout(location = 0) out highp vec4 pc_fragColor;",n.glslVersion===h0?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);let y=g+v+r,_=g+f+o,T=rM(s,s.VERTEX_SHADER,y),A=rM(s,s.FRAGMENT_SHADER,_);s.attachShader(S,T),s.attachShader(S,A),n.index0AttributeName!==void 0?s.bindAttribLocation(S,0,n.index0AttributeName):n.hasPositionAttribute===!0&&s.bindAttribLocation(S,0,"position"),s.linkProgram(S);function w(D){if(e.debug.checkShaderErrors){let I=s.getProgramInfoLog(S)||"",q=s.getShaderInfoLog(T)||"",J=s.getShaderInfoLog(A)||"",z=I.trim(),B=q.trim(),V=J.trim(),j=!0,lt=!0;if(s.getProgramParameter(S,s.LINK_STATUS)===!1)if(j=!1,typeof e.debug.onShaderError=="function")e.debug.onShaderError(s,S,T,A);else{let ut=lM(s,T,"vertex"),ct=lM(s,A,"fragment");zt("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(S,s.VALIDATE_STATUS)+`

Material Name: `+D.name+`
Material Type: `+D.type+`

Program Info Log: `+z+`
`+ut+`
`+ct)}else z!==""?It("WebGLProgram: Program Info Log:",z):(B===""||V==="")&&(lt=!1);lt&&(D.diagnostics={runnable:j,programLog:z,vertexShader:{log:B,prefix:v},fragmentShader:{log:V,prefix:f}})}s.deleteShader(T),s.deleteShader(A),x=new Ao(s,S),M=S2(s,S)}let x;this.getUniforms=function(){return x===void 0&&w(this),x};let M;this.getAttributes=function(){return M===void 0&&w(this),M};let R=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return R===!1&&(R=s.getProgramParameter(S,f2)),R},this.destroy=function(){i.releaseStatesOfProgram(this),s.deleteProgram(S),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=d2++,this.cacheKey=t,this.usedTimes=1,this.program=S,this.vertexShader=T,this.fragmentShader=A,this}var B2=0,R0=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,n,i){let s=this._getShaderCacheForMaterial(t);return s.has(n)===!1&&(s.add(n),n.usedTimes++),s.has(i)===!1&&(s.add(i),i.usedTimes++),this}remove(t){let n=this.materialCache.get(t);for(let i of n)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let n=this.materialCache,i=n.get(t);return i===void 0&&(i=new Set,n.set(t,i)),i}_getShaderStage(t){let n=this.shaderCache,i=n.get(t);return i===void 0&&(i=new D0(t),n.set(t,i)),i}},D0=class{constructor(t){this.id=B2++,this.code=t,this.usedTimes=0}};function F2(e){return e===Sa||e===mc||e===gc}function V2(e,t,n,i,s,a){let r=new Xl,o=new R0,c=new Set,l=[],h=new Map,d=i.logarithmicDepthBuffer,u=i.precision,p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function m(x){return c.add(x),x===0?"uv":`uv${x}`}function S(x,M,R,D,I,q){let J=D.fog,z=I.geometry,B=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?D.environment:null,V=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,j=t.get(x.envMap||B,V),lt=j&&j.mapping===cc?j.image.height:null,ut=p[x.type];x.precision!==null&&(u=i.getMaxPrecision(x.precision),u!==x.precision&&It("WebGLProgram.getParameters:",x.precision,"not supported, using",u,"instead."));let ct=z.morphAttributes.position||z.morphAttributes.normal||z.morphAttributes.color,ot=ct!==void 0?ct.length:0,Nt=0;z.morphAttributes.position!==void 0&&(Nt=1),z.morphAttributes.normal!==void 0&&(Nt=2),z.morphAttributes.color!==void 0&&(Nt=3);let Wt,kt,K,et;if(ut){let pt=ji[ut];Wt=pt.vertexShader,kt=pt.fragmentShader}else{Wt=x.vertexShader,kt=x.fragmentShader;let pt=o.getVertexShaderStage(x),Gt=o.getFragmentShaderStage(x);o.update(x,pt,Gt),K=pt.id,et=Gt.id}let nt=e.getRenderTarget(),Mt=e.state.buffers.depth.getReversed(),Ut=I.isInstancedMesh===!0,wt=I.isBatchedMesh===!0,se=!!x.map,Pt=!!x.matcap,Ft=!!j,Jt=!!x.aoMap,Ht=!!x.lightMap,de=!!x.bumpMap&&x.wireframe===!1,Pe=!!x.normalMap,pe=!!x.displacementMap,We=!!x.emissiveMap,le=!!x.metalnessMap,Le=!!x.roughnessMap,P=x.anisotropy>0,sn=x.clearcoat>0,oe=x.dispersion>0,C=x.iridescence>0,b=x.sheen>0,H=x.transmission>0,X=P&&!!x.anisotropyMap,Q=sn&&!!x.clearcoatMap,ft=sn&&!!x.clearcoatNormalMap,mt=sn&&!!x.clearcoatRoughnessMap,tt=C&&!!x.iridescenceMap,it=C&&!!x.iridescenceThicknessMap,gt=b&&!!x.sheenColorMap,Et=b&&!!x.sheenRoughnessMap,vt=!!x.specularMap,dt=!!x.specularColorMap,Ct=!!x.specularIntensityMap,Tt=H&&!!x.transmissionMap,Ot=H&&!!x.thicknessMap,O=!!x.gradientMap,N=!!x.alphaMap,U=x.alphaTest>0,rt=!!x.alphaHash,$=!!x.extensions,Z=wi;x.toneMapped&&(nt===null||nt.isXRRenderTarget===!0)&&(Z=e.toneMapping);let ht={shaderID:ut,shaderType:x.type,shaderName:x.name,vertexShader:Wt,fragmentShader:kt,defines:x.defines,customVertexShaderID:K,customFragmentShaderID:et,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:u,batching:wt,batchingColor:wt&&I._colorsTexture!==null,instancing:Ut,instancingColor:Ut&&I.instanceColor!==null,instancingMorph:Ut&&I.morphTexture!==null,outputColorSpace:nt===null?e.outputColorSpace:nt.isXRRenderTarget===!0?nt.texture.colorSpace:ne.workingColorSpace,alphaToCoverage:!!x.alphaToCoverage,map:se,matcap:Pt,envMap:Ft,envMapMode:Ft&&j.mapping,envMapCubeUVHeight:lt,aoMap:Jt,lightMap:Ht,bumpMap:de,normalMap:Pe,displacementMap:pe,emissiveMap:We,normalMapObjectSpace:Pe&&x.normalMapType===OS,normalMapTangentSpace:Pe&&x.normalMapType===u0,packedNormalMap:Pe&&x.normalMapType===u0&&F2(x.normalMap.format),metalnessMap:le,roughnessMap:Le,anisotropy:P,anisotropyMap:X,clearcoat:sn,clearcoatMap:Q,clearcoatNormalMap:ft,clearcoatRoughnessMap:mt,dispersion:oe,iridescence:C,iridescenceMap:tt,iridescenceThicknessMap:it,sheen:b,sheenColorMap:gt,sheenRoughnessMap:Et,specularMap:vt,specularColorMap:dt,specularIntensityMap:Ct,transmission:H,transmissionMap:Tt,thicknessMap:Ot,gradientMap:O,opaque:x.transparent===!1&&x.blending===Qa&&x.alphaToCoverage===!1,alphaMap:N,alphaTest:U,alphaHash:rt,combine:x.combine,mapUv:se&&m(x.map.channel),aoMapUv:Jt&&m(x.aoMap.channel),lightMapUv:Ht&&m(x.lightMap.channel),bumpMapUv:de&&m(x.bumpMap.channel),normalMapUv:Pe&&m(x.normalMap.channel),displacementMapUv:pe&&m(x.displacementMap.channel),emissiveMapUv:We&&m(x.emissiveMap.channel),metalnessMapUv:le&&m(x.metalnessMap.channel),roughnessMapUv:Le&&m(x.roughnessMap.channel),anisotropyMapUv:X&&m(x.anisotropyMap.channel),clearcoatMapUv:Q&&m(x.clearcoatMap.channel),clearcoatNormalMapUv:ft&&m(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:mt&&m(x.clearcoatRoughnessMap.channel),iridescenceMapUv:tt&&m(x.iridescenceMap.channel),iridescenceThicknessMapUv:it&&m(x.iridescenceThicknessMap.channel),sheenColorMapUv:gt&&m(x.sheenColorMap.channel),sheenRoughnessMapUv:Et&&m(x.sheenRoughnessMap.channel),specularMapUv:vt&&m(x.specularMap.channel),specularColorMapUv:dt&&m(x.specularColorMap.channel),specularIntensityMapUv:Ct&&m(x.specularIntensityMap.channel),transmissionMapUv:Tt&&m(x.transmissionMap.channel),thicknessMapUv:Ot&&m(x.thicknessMap.channel),alphaMapUv:N&&m(x.alphaMap.channel),vertexTangents:!!z.attributes.tangent&&(Pe||P),vertexNormals:!!z.attributes.normal,vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!z.attributes.color&&z.attributes.color.itemSize===4,pointsUvs:I.isPoints===!0&&!!z.attributes.uv&&(se||N),fog:!!J,useFog:x.fog===!0,fogExp2:!!J&&J.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||z.attributes.normal===void 0&&Pe===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:Mt,skinning:I.isSkinnedMesh===!0,hasPositionAttribute:z.attributes.position!==void 0,morphTargets:z.morphAttributes.position!==void 0,morphNormals:z.morphAttributes.normal!==void 0,morphColors:z.morphAttributes.color!==void 0,morphTargetsCount:ot,morphTextureStride:Nt,numDirLights:M.directional.length,numPointLights:M.point.length,numSpotLights:M.spot.length,numSpotLightMaps:M.spotLightMap.length,numRectAreaLights:M.rectArea.length,numHemiLights:M.hemi.length,numDirLightShadows:M.directionalShadowMap.length,numPointLightShadows:M.pointShadowMap.length,numSpotLightShadows:M.spotShadowMap.length,numSpotLightShadowsWithMaps:M.numSpotLightShadowsWithMaps,numLightProbes:M.numLightProbes,numLightProbeGrids:q.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:x.dithering,shadowMapEnabled:e.shadowMap.enabled&&R.length>0,shadowMapType:e.shadowMap.type,toneMapping:Z,decodeVideoTexture:se&&x.map.isVideoTexture===!0&&ne.getTransfer(x.map.colorSpace)===fe,decodeVideoTextureEmissive:We&&x.emissiveMap.isVideoTexture===!0&&ne.getTransfer(x.emissiveMap.colorSpace)===fe,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===ni,flipSided:x.side===Cn,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:$&&x.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:($&&x.extensions.multiDraw===!0||wt)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return ht.vertexUv1s=c.has(1),ht.vertexUv2s=c.has(2),ht.vertexUv3s=c.has(3),c.clear(),ht}function v(x){let M=[];if(x.shaderID?M.push(x.shaderID):(M.push(x.customVertexShaderID),M.push(x.customFragmentShaderID)),x.defines!==void 0)for(let R in x.defines)M.push(R),M.push(x.defines[R]);return x.isRawShaderMaterial===!1&&(f(M,x),g(M,x),M.push(e.outputColorSpace)),M.push(x.customProgramCacheKey),M.join()}function f(x,M){x.push(M.precision),x.push(M.outputColorSpace),x.push(M.envMapMode),x.push(M.envMapCubeUVHeight),x.push(M.mapUv),x.push(M.alphaMapUv),x.push(M.lightMapUv),x.push(M.aoMapUv),x.push(M.bumpMapUv),x.push(M.normalMapUv),x.push(M.displacementMapUv),x.push(M.emissiveMapUv),x.push(M.metalnessMapUv),x.push(M.roughnessMapUv),x.push(M.anisotropyMapUv),x.push(M.clearcoatMapUv),x.push(M.clearcoatNormalMapUv),x.push(M.clearcoatRoughnessMapUv),x.push(M.iridescenceMapUv),x.push(M.iridescenceThicknessMapUv),x.push(M.sheenColorMapUv),x.push(M.sheenRoughnessMapUv),x.push(M.specularMapUv),x.push(M.specularColorMapUv),x.push(M.specularIntensityMapUv),x.push(M.transmissionMapUv),x.push(M.thicknessMapUv),x.push(M.combine),x.push(M.fogExp2),x.push(M.sizeAttenuation),x.push(M.morphTargetsCount),x.push(M.morphAttributeCount),x.push(M.numDirLights),x.push(M.numPointLights),x.push(M.numSpotLights),x.push(M.numSpotLightMaps),x.push(M.numHemiLights),x.push(M.numRectAreaLights),x.push(M.numDirLightShadows),x.push(M.numPointLightShadows),x.push(M.numSpotLightShadows),x.push(M.numSpotLightShadowsWithMaps),x.push(M.numLightProbes),x.push(M.shadowMapType),x.push(M.toneMapping),x.push(M.numClippingPlanes),x.push(M.numClipIntersection),x.push(M.depthPacking)}function g(x,M){r.disableAll(),M.instancing&&r.enable(0),M.instancingColor&&r.enable(1),M.instancingMorph&&r.enable(2),M.matcap&&r.enable(3),M.envMap&&r.enable(4),M.normalMapObjectSpace&&r.enable(5),M.normalMapTangentSpace&&r.enable(6),M.clearcoat&&r.enable(7),M.iridescence&&r.enable(8),M.alphaTest&&r.enable(9),M.vertexColors&&r.enable(10),M.vertexAlphas&&r.enable(11),M.vertexUv1s&&r.enable(12),M.vertexUv2s&&r.enable(13),M.vertexUv3s&&r.enable(14),M.vertexTangents&&r.enable(15),M.anisotropy&&r.enable(16),M.alphaHash&&r.enable(17),M.batching&&r.enable(18),M.dispersion&&r.enable(19),M.batchingColor&&r.enable(20),M.gradientMap&&r.enable(21),M.packedNormalMap&&r.enable(22),M.vertexNormals&&r.enable(23),x.push(r.mask),r.disableAll(),M.fog&&r.enable(0),M.useFog&&r.enable(1),M.flatShading&&r.enable(2),M.logarithmicDepthBuffer&&r.enable(3),M.reversedDepthBuffer&&r.enable(4),M.skinning&&r.enable(5),M.morphTargets&&r.enable(6),M.morphNormals&&r.enable(7),M.morphColors&&r.enable(8),M.premultipliedAlpha&&r.enable(9),M.shadowMapEnabled&&r.enable(10),M.doubleSided&&r.enable(11),M.flipSided&&r.enable(12),M.useDepthPacking&&r.enable(13),M.dithering&&r.enable(14),M.transmission&&r.enable(15),M.sheen&&r.enable(16),M.opaque&&r.enable(17),M.pointsUvs&&r.enable(18),M.decodeVideoTexture&&r.enable(19),M.decodeVideoTextureEmissive&&r.enable(20),M.alphaToCoverage&&r.enable(21),M.numLightProbeGrids>0&&r.enable(22),M.hasPositionAttribute&&r.enable(23),x.push(r.mask)}function y(x){let M=p[x.type],R;if(M){let D=ji[M];R=YS.clone(D.uniforms)}else R=x.uniforms;return R}function _(x,M){let R=h.get(M);return R!==void 0?++R.usedTimes:(R=new z2(e,M,x,s),l.push(R),h.set(M,R)),R}function T(x){if(--x.usedTimes===0){let M=l.indexOf(x);l[M]=l[l.length-1],l.pop(),h.delete(x.cacheKey),x.destroy()}}function A(x){o.remove(x)}function w(){o.dispose()}return{getParameters:S,getProgramCacheKey:v,getUniforms:y,acquireProgram:_,releaseProgram:T,releaseShaderCache:A,programs:l,dispose:w}}function H2(){let e=new WeakMap;function t(r){return e.has(r)}function n(r){let o=e.get(r);return o===void 0&&(o={},e.set(r,o)),o}function i(r){e.delete(r)}function s(r,o,c){e.get(r)[o]=c}function a(){e=new WeakMap}return{has:t,get:n,remove:i,update:s,dispose:a}}function G2(e,t){return e.groupOrder!==t.groupOrder?e.groupOrder-t.groupOrder:e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.material.id!==t.material.id?e.material.id-t.material.id:e.materialVariant!==t.materialVariant?e.materialVariant-t.materialVariant:e.z!==t.z?e.z-t.z:e.id-t.id}function dM(e,t){return e.groupOrder!==t.groupOrder?e.groupOrder-t.groupOrder:e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.z!==t.z?t.z-e.z:e.id-t.id}function pM(){let e=[],t=0,n=[],i=[],s=[];function a(){t=0,n.length=0,i.length=0,s.length=0}function r(u){let p=0;return u.isInstancedMesh&&(p+=2),u.isSkinnedMesh&&(p+=1),p}function o(u,p,m,S,v,f){let g=e[t];return g===void 0?(g={id:u.id,object:u,geometry:p,material:m,materialVariant:r(u),groupOrder:S,renderOrder:u.renderOrder,z:v,group:f},e[t]=g):(g.id=u.id,g.object=u,g.geometry=p,g.material=m,g.materialVariant=r(u),g.groupOrder=S,g.renderOrder=u.renderOrder,g.z=v,g.group=f),t++,g}function c(u,p,m,S,v,f){let g=o(u,p,m,S,v,f);m.transmission>0?i.push(g):m.transparent===!0?s.push(g):n.push(g)}function l(u,p,m,S,v,f){let g=o(u,p,m,S,v,f);m.transmission>0?i.unshift(g):m.transparent===!0?s.unshift(g):n.unshift(g)}function h(u,p,m){n.length>1&&n.sort(u||G2),i.length>1&&i.sort(p||dM),s.length>1&&s.sort(p||dM),m&&(n.reverse(),i.reverse(),s.reverse())}function d(){for(let u=t,p=e.length;u<p;u++){let m=e[u];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:n,transmissive:i,transparent:s,init:a,push:c,unshift:l,finish:d,sort:h}}function k2(){let e=new WeakMap;function t(i,s){let a=e.get(i),r;return a===void 0?(r=new pM,e.set(i,[r])):s>=a.length?(r=new pM,a.push(r)):r=a[s],r}function n(){e=new WeakMap}return{get:t,dispose:n}}function X2(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"DirectionalLight":n={direction:new L,color:new te};break;case"SpotLight":n={position:new L,direction:new L,color:new te,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":n={position:new L,color:new te,distance:0,decay:0};break;case"HemisphereLight":n={direction:new L,skyColor:new te,groundColor:new te};break;case"RectAreaLight":n={color:new te,position:new L,halfWidth:new L,halfHeight:new L};break}return e[t.id]=n,n}}}function W2(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"DirectionalLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Lt};break;case"SpotLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Lt};break;case"PointLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Lt,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[t.id]=n,n}}}var q2=0;function Y2(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+(t.map?1:0)-(e.map?1:0)}function Z2(e){let t=new X2,n=W2(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)i.probe.push(new L);let s=new L,a=new Ie,r=new Ie;function o(l){let h=0,d=0,u=0;for(let M=0;M<9;M++)i.probe[M].set(0,0,0);let p=0,m=0,S=0,v=0,f=0,g=0,y=0,_=0,T=0,A=0,w=0;l.sort(Y2);for(let M=0,R=l.length;M<R;M++){let D=l[M],I=D.color,q=D.intensity,J=D.distance,z=null;if(D.shadow&&D.shadow.map&&(D.shadow.map.texture.format===Sa?z=D.shadow.map.texture:z=D.shadow.map.depthTexture||D.shadow.map.texture),D.isAmbientLight)h+=I.r*q,d+=I.g*q,u+=I.b*q;else if(D.isLightProbe){for(let B=0;B<9;B++)i.probe[B].addScaledVector(D.sh.coefficients[B],q);w++}else if(D.isDirectionalLight){let B=t.get(D);if(B.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){let V=D.shadow,j=n.get(D);j.shadowIntensity=V.intensity,j.shadowBias=V.bias,j.shadowNormalBias=V.normalBias,j.shadowRadius=V.radius,j.shadowMapSize=V.mapSize,i.directionalShadow[p]=j,i.directionalShadowMap[p]=z,i.directionalShadowMatrix[p]=D.shadow.matrix,g++}i.directional[p]=B,p++}else if(D.isSpotLight){let B=t.get(D);B.position.setFromMatrixPosition(D.matrixWorld),B.color.copy(I).multiplyScalar(q),B.distance=J,B.coneCos=Math.cos(D.angle),B.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),B.decay=D.decay,i.spot[S]=B;let V=D.shadow;if(D.map&&(i.spotLightMap[T]=D.map,T++,V.updateMatrices(D),D.castShadow&&A++),i.spotLightMatrix[S]=V.matrix,D.castShadow){let j=n.get(D);j.shadowIntensity=V.intensity,j.shadowBias=V.bias,j.shadowNormalBias=V.normalBias,j.shadowRadius=V.radius,j.shadowMapSize=V.mapSize,i.spotShadow[S]=j,i.spotShadowMap[S]=z,_++}S++}else if(D.isRectAreaLight){let B=t.get(D);B.color.copy(I).multiplyScalar(q),B.halfWidth.set(D.width*.5,0,0),B.halfHeight.set(0,D.height*.5,0),i.rectArea[v]=B,v++}else if(D.isPointLight){let B=t.get(D);if(B.color.copy(D.color).multiplyScalar(D.intensity),B.distance=D.distance,B.decay=D.decay,D.castShadow){let V=D.shadow,j=n.get(D);j.shadowIntensity=V.intensity,j.shadowBias=V.bias,j.shadowNormalBias=V.normalBias,j.shadowRadius=V.radius,j.shadowMapSize=V.mapSize,j.shadowCameraNear=V.camera.near,j.shadowCameraFar=V.camera.far,i.pointShadow[m]=j,i.pointShadowMap[m]=z,i.pointShadowMatrix[m]=D.shadow.matrix,y++}i.point[m]=B,m++}else if(D.isHemisphereLight){let B=t.get(D);B.skyColor.copy(D.color).multiplyScalar(q),B.groundColor.copy(D.groundColor).multiplyScalar(q),i.hemi[f]=B,f++}}v>0&&(e.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=_t.LTC_FLOAT_1,i.rectAreaLTC2=_t.LTC_FLOAT_2):(i.rectAreaLTC1=_t.LTC_HALF_1,i.rectAreaLTC2=_t.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=d,i.ambient[2]=u;let x=i.hash;(x.directionalLength!==p||x.pointLength!==m||x.spotLength!==S||x.rectAreaLength!==v||x.hemiLength!==f||x.numDirectionalShadows!==g||x.numPointShadows!==y||x.numSpotShadows!==_||x.numSpotMaps!==T||x.numLightProbes!==w)&&(i.directional.length=p,i.spot.length=S,i.rectArea.length=v,i.point.length=m,i.hemi.length=f,i.directionalShadow.length=g,i.directionalShadowMap.length=g,i.pointShadow.length=y,i.pointShadowMap.length=y,i.spotShadow.length=_,i.spotShadowMap.length=_,i.directionalShadowMatrix.length=g,i.pointShadowMatrix.length=y,i.spotLightMatrix.length=_+T-A,i.spotLightMap.length=T,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=w,x.directionalLength=p,x.pointLength=m,x.spotLength=S,x.rectAreaLength=v,x.hemiLength=f,x.numDirectionalShadows=g,x.numPointShadows=y,x.numSpotShadows=_,x.numSpotMaps=T,x.numLightProbes=w,i.version=q2++)}function c(l,h){let d=0,u=0,p=0,m=0,S=0,v=h.matrixWorldInverse;for(let f=0,g=l.length;f<g;f++){let y=l[f];if(y.isDirectionalLight){let _=i.directional[d];_.direction.setFromMatrixPosition(y.matrixWorld),s.setFromMatrixPosition(y.target.matrixWorld),_.direction.sub(s),_.direction.transformDirection(v),d++}else if(y.isSpotLight){let _=i.spot[p];_.position.setFromMatrixPosition(y.matrixWorld),_.position.applyMatrix4(v),_.direction.setFromMatrixPosition(y.matrixWorld),s.setFromMatrixPosition(y.target.matrixWorld),_.direction.sub(s),_.direction.transformDirection(v),p++}else if(y.isRectAreaLight){let _=i.rectArea[m];_.position.setFromMatrixPosition(y.matrixWorld),_.position.applyMatrix4(v),r.identity(),a.copy(y.matrixWorld),a.premultiply(v),r.extractRotation(a),_.halfWidth.set(y.width*.5,0,0),_.halfHeight.set(0,y.height*.5,0),_.halfWidth.applyMatrix4(r),_.halfHeight.applyMatrix4(r),m++}else if(y.isPointLight){let _=i.point[u];_.position.setFromMatrixPosition(y.matrixWorld),_.position.applyMatrix4(v),u++}else if(y.isHemisphereLight){let _=i.hemi[S];_.direction.setFromMatrixPosition(y.matrixWorld),_.direction.transformDirection(v),S++}}}return{setup:o,setupView:c,state:i}}function mM(e){let t=new Z2(e),n=[],i=[],s=[];function a(u){d.camera=u,n.length=0,i.length=0,s.length=0}function r(u){n.push(u)}function o(u){i.push(u)}function c(u){s.push(u)}function l(){t.setup(n)}function h(u){t.setupView(n,u)}let d={lightsArray:n,shadowsArray:i,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:d,setupLights:l,setupLightsView:h,pushLight:r,pushShadow:o,pushLightProbeGrid:c}}function J2(e){let t=new WeakMap;function n(s,a=0){let r=t.get(s),o;return r===void 0?(o=new mM(e),t.set(s,[o])):a>=r.length?(o=new mM(e),r.push(o)):o=r[a],o}function i(){t=new WeakMap}return{get:n,dispose:i}}var K2=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,j2=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Q2=[new L(1,0,0),new L(-1,0,0),new L(0,1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1)],$2=[new L(0,-1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1),new L(0,-1,0),new L(0,-1,0)],gM=new Ie,yc=new L,M0=new L;function t3(e,t,n){let i=new Kl,s=new Lt,a=new Lt,r=new Oe,o=new lf,c=new cf,l={},h=n.maxTextureSize,d={[Ts]:Cn,[Cn]:Ts,[ni]:ni},u=new ti({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Lt},radius:{value:4}},vertexShader:K2,fragmentShader:j2}),p=u.clone();p.defines.HORIZONTAL_PASS=1;let m=new Ve;m.setAttribute("position",new jn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let S=new je(m,u),v=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=lc;let f=this.type;this.render=function(A,w,x){if(v.enabled===!1||v.autoUpdate===!1&&v.needsUpdate===!1||A.length===0)return;this.type===fS&&(It("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=lc);let M=e.getRenderTarget(),R=e.getActiveCubeFace(),D=e.getActiveMipmapLevel(),I=e.state;I.setBlending(Zi),I.buffers.depth.getReversed()===!0?I.buffers.color.setClear(0,0,0,0):I.buffers.color.setClear(1,1,1,1),I.buffers.depth.setTest(!0),I.setScissorTest(!1);let q=f!==this.type;q&&w.traverse(function(J){J.material&&(Array.isArray(J.material)?J.material.forEach(z=>z.needsUpdate=!0):J.material.needsUpdate=!0)});for(let J=0,z=A.length;J<z;J++){let B=A[J],V=B.shadow;if(V===void 0){It("WebGLShadowMap:",B,"has no shadow.");continue}if(V.autoUpdate===!1&&V.needsUpdate===!1)continue;s.copy(V.mapSize);let j=V.getFrameExtents();s.multiply(j),a.copy(V.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(a.x=Math.floor(h/j.x),s.x=a.x*j.x,V.mapSize.x=a.x),s.y>h&&(a.y=Math.floor(h/j.y),s.y=a.y*j.y,V.mapSize.y=a.y));let lt=e.state.buffers.depth.getReversed();if(V.camera._reversedDepth=lt,V.map===null||q===!0){if(V.map!==null&&(V.map.depthTexture!==null&&(V.map.depthTexture.dispose(),V.map.depthTexture=null),V.map.dispose()),this.type===So){if(B.isPointLight){It("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}V.map=new Qn(s.x,s.y,{format:Sa,type:Ji,minFilter:mn,magFilter:mn,generateMipmaps:!1}),V.map.texture.name=B.name+".shadowMap",V.map.depthTexture=new As(s.x,s.y,Ri),V.map.depthTexture.name=B.name+".shadowMapDepth",V.map.depthTexture.format=ki,V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=cn,V.map.depthTexture.magFilter=cn}else B.isPointLight?(V.map=new dd(s.x),V.map.depthTexture=new jh(s.x,Ci)):(V.map=new Qn(s.x,s.y),V.map.depthTexture=new As(s.x,s.y,Ci)),V.map.depthTexture.name=B.name+".shadowMap",V.map.depthTexture.format=ki,this.type===lc?(V.map.depthTexture.compareFunction=lt?cd:ld,V.map.depthTexture.minFilter=mn,V.map.depthTexture.magFilter=mn):(V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=cn,V.map.depthTexture.magFilter=cn);V.camera.updateProjectionMatrix()}let ut=V.map.isWebGLCubeRenderTarget?6:1;for(let ct=0;ct<ut;ct++){if(V.map.isWebGLCubeRenderTarget)e.setRenderTarget(V.map,ct),e.clear();else{ct===0&&(e.setRenderTarget(V.map),e.clear());let ot=V.getViewport(ct);r.set(a.x*ot.x,a.y*ot.y,a.x*ot.z,a.y*ot.w),I.viewport(r)}if(B.isPointLight){let ot=V.camera,Nt=V.matrix,Wt=B.distance||ot.far;Wt!==ot.far&&(ot.far=Wt,ot.updateProjectionMatrix()),yc.setFromMatrixPosition(B.matrixWorld),ot.position.copy(yc),M0.copy(ot.position),M0.add(Q2[ct]),ot.up.copy($2[ct]),ot.lookAt(M0),ot.updateMatrixWorld(),Nt.makeTranslation(-yc.x,-yc.y,-yc.z),gM.multiplyMatrices(ot.projectionMatrix,ot.matrixWorldInverse),V._frustum.setFromProjectionMatrix(gM,ot.coordinateSystem,ot.reversedDepth)}else V.updateMatrices(B);i=V.getFrustum(),_(w,x,V.camera,B,this.type)}V.isPointLightShadow!==!0&&this.type===So&&g(V,x),V.needsUpdate=!1}f=this.type,v.needsUpdate=!1,e.setRenderTarget(M,R,D)};function g(A,w){let x=t.update(S);u.defines.VSM_SAMPLES!==A.blurSamples&&(u.defines.VSM_SAMPLES=A.blurSamples,p.defines.VSM_SAMPLES=A.blurSamples,u.needsUpdate=!0,p.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new Qn(s.x,s.y,{format:Sa,type:Ji})),u.uniforms.shadow_pass.value=A.map.depthTexture,u.uniforms.resolution.value=A.mapSize,u.uniforms.radius.value=A.radius,e.setRenderTarget(A.mapPass),e.clear(),e.renderBufferDirect(w,null,x,u,S,null),p.uniforms.shadow_pass.value=A.mapPass.texture,p.uniforms.resolution.value=A.mapSize,p.uniforms.radius.value=A.radius,e.setRenderTarget(A.map),e.clear(),e.renderBufferDirect(w,null,x,p,S,null)}function y(A,w,x,M){let R=null,D=x.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(D!==void 0)R=D;else if(R=x.isPointLight===!0?c:o,e.localClippingEnabled&&w.clipShadows===!0&&Array.isArray(w.clippingPlanes)&&w.clippingPlanes.length!==0||w.displacementMap&&w.displacementScale!==0||w.alphaMap&&w.alphaTest>0||w.map&&w.alphaTest>0||w.alphaToCoverage===!0){let I=R.uuid,q=w.uuid,J=l[I];J===void 0&&(J={},l[I]=J);let z=J[q];z===void 0&&(z=R.clone(),J[q]=z,w.addEventListener("dispose",T)),R=z}if(R.visible=w.visible,R.wireframe=w.wireframe,M===So?R.side=w.shadowSide!==null?w.shadowSide:w.side:R.side=w.shadowSide!==null?w.shadowSide:d[w.side],R.alphaMap=w.alphaMap,R.alphaTest=w.alphaToCoverage===!0?.5:w.alphaTest,R.map=w.map,R.clipShadows=w.clipShadows,R.clippingPlanes=w.clippingPlanes,R.clipIntersection=w.clipIntersection,R.displacementMap=w.displacementMap,R.displacementScale=w.displacementScale,R.displacementBias=w.displacementBias,R.wireframeLinewidth=w.wireframeLinewidth,R.linewidth=w.linewidth,x.isPointLight===!0&&R.isMeshDistanceMaterial===!0){let I=e.properties.get(R);I.light=x}return R}function _(A,w,x,M,R){if(A.visible===!1)return;if(A.layers.test(w.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&R===So)&&(!A.frustumCulled||i.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(x.matrixWorldInverse,A.matrixWorld);let q=t.update(A),J=A.material;if(Array.isArray(J)){let z=q.groups;for(let B=0,V=z.length;B<V;B++){let j=z[B],lt=J[j.materialIndex];if(lt&&lt.visible){let ut=y(A,lt,M,R);A.onBeforeShadow(e,A,w,x,q,ut,j),e.renderBufferDirect(x,null,q,ut,A,j),A.onAfterShadow(e,A,w,x,q,ut,j)}}}else if(J.visible){let z=y(A,J,M,R);A.onBeforeShadow(e,A,w,x,q,z,null),e.renderBufferDirect(x,null,q,z,A,null),A.onAfterShadow(e,A,w,x,q,z,null)}}let I=A.children;for(let q=0,J=I.length;q<J;q++)_(I[q],w,x,M,R)}function T(A){A.target.removeEventListener("dispose",T);for(let x in l){let M=l[x],R=A.target.uuid;R in M&&(M[R].dispose(),delete M[R])}}}function e3(e,t){function n(){let O=!1,N=new Oe,U=null,rt=new Oe(0,0,0,0);return{setMask:function($){U!==$&&!O&&(e.colorMask($,$,$,$),U=$)},setLocked:function($){O=$},setClear:function($,Z,ht,pt,Gt){Gt===!0&&($*=pt,Z*=pt,ht*=pt),N.set($,Z,ht,pt),rt.equals(N)===!1&&(e.clearColor($,Z,ht,pt),rt.copy(N))},reset:function(){O=!1,U=null,rt.set(-1,0,0,0)}}}function i(){let O=!1,N=!1,U=null,rt=null,$=null;return{setReversed:function(Z){if(N!==Z){let ht=t.get("EXT_clip_control");Z?ht.clipControlEXT(ht.LOWER_LEFT_EXT,ht.ZERO_TO_ONE_EXT):ht.clipControlEXT(ht.LOWER_LEFT_EXT,ht.NEGATIVE_ONE_TO_ONE_EXT),N=Z;let pt=$;$=null,this.setClear(pt)}},getReversed:function(){return N},setTest:function(Z){Z?nt(e.DEPTH_TEST):Mt(e.DEPTH_TEST)},setMask:function(Z){U!==Z&&!O&&(e.depthMask(Z),U=Z)},setFunc:function(Z){if(N&&(Z=WS[Z]),rt!==Z){switch(Z){case Ih:e.depthFunc(e.NEVER);break;case Oh:e.depthFunc(e.ALWAYS);break;case Ph:e.depthFunc(e.LESS);break;case $a:e.depthFunc(e.LEQUAL);break;case zh:e.depthFunc(e.EQUAL);break;case Bh:e.depthFunc(e.GEQUAL);break;case Fh:e.depthFunc(e.GREATER);break;case Vh:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}rt=Z}},setLocked:function(Z){O=Z},setClear:function(Z){$!==Z&&($=Z,N&&(Z=1-Z),e.clearDepth(Z))},reset:function(){O=!1,U=null,rt=null,$=null,N=!1}}}function s(){let O=!1,N=null,U=null,rt=null,$=null,Z=null,ht=null,pt=null,Gt=null;return{setTest:function(ae){O||(ae?nt(e.STENCIL_TEST):Mt(e.STENCIL_TEST))},setMask:function(ae){N!==ae&&!O&&(e.stencilMask(ae),N=ae)},setFunc:function(ae,Mn,zn){(U!==ae||rt!==Mn||$!==zn)&&(e.stencilFunc(ae,Mn,zn),U=ae,rt=Mn,$=zn)},setOp:function(ae,Mn,zn){(Z!==ae||ht!==Mn||pt!==zn)&&(e.stencilOp(ae,Mn,zn),Z=ae,ht=Mn,pt=zn)},setLocked:function(ae){O=ae},setClear:function(ae){Gt!==ae&&(e.clearStencil(ae),Gt=ae)},reset:function(){O=!1,N=null,U=null,rt=null,$=null,Z=null,ht=null,pt=null,Gt=null}}}let a=new n,r=new i,o=new s,c=new WeakMap,l=new WeakMap,h={},d={},u={},p=new WeakMap,m=[],S=null,v=!1,f=null,g=null,y=null,_=null,T=null,A=null,w=null,x=new te(0,0,0),M=0,R=!1,D=null,I=null,q=null,J=null,z=null,B=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),V=!1,j=0,lt=e.getParameter(e.VERSION);lt.indexOf("WebGL")!==-1?(j=parseFloat(/^WebGL (\d)/.exec(lt)[1]),V=j>=1):lt.indexOf("OpenGL ES")!==-1&&(j=parseFloat(/^OpenGL ES (\d)/.exec(lt)[1]),V=j>=2);let ut=null,ct={},ot=e.getParameter(e.SCISSOR_BOX),Nt=e.getParameter(e.VIEWPORT),Wt=new Oe().fromArray(ot),kt=new Oe().fromArray(Nt);function K(O,N,U,rt){let $=new Uint8Array(4),Z=e.createTexture();e.bindTexture(O,Z),e.texParameteri(O,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(O,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let ht=0;ht<U;ht++)O===e.TEXTURE_3D||O===e.TEXTURE_2D_ARRAY?e.texImage3D(N,0,e.RGBA,1,1,rt,0,e.RGBA,e.UNSIGNED_BYTE,$):e.texImage2D(N+ht,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,$);return Z}let et={};et[e.TEXTURE_2D]=K(e.TEXTURE_2D,e.TEXTURE_2D,1),et[e.TEXTURE_CUBE_MAP]=K(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),et[e.TEXTURE_2D_ARRAY]=K(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),et[e.TEXTURE_3D]=K(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),r.setClear(1),o.setClear(0),nt(e.DEPTH_TEST),r.setFunc($a),de(!1),Pe(Xg),nt(e.CULL_FACE),Jt(Zi);function nt(O){h[O]!==!0&&(e.enable(O),h[O]=!0)}function Mt(O){h[O]!==!1&&(e.disable(O),h[O]=!1)}function Ut(O,N){return u[O]!==N?(e.bindFramebuffer(O,N),u[O]=N,O===e.DRAW_FRAMEBUFFER&&(u[e.FRAMEBUFFER]=N),O===e.FRAMEBUFFER&&(u[e.DRAW_FRAMEBUFFER]=N),!0):!1}function wt(O,N){let U=m,rt=!1;if(O){U=p.get(N),U===void 0&&(U=[],p.set(N,U));let $=O.textures;if(U.length!==$.length||U[0]!==e.COLOR_ATTACHMENT0){for(let Z=0,ht=$.length;Z<ht;Z++)U[Z]=e.COLOR_ATTACHMENT0+Z;U.length=$.length,rt=!0}}else U[0]!==e.BACK&&(U[0]=e.BACK,rt=!0);rt&&e.drawBuffers(U)}function se(O){return S!==O?(e.useProgram(O),S=O,!0):!1}let Pt={[ha]:e.FUNC_ADD,[pS]:e.FUNC_SUBTRACT,[mS]:e.FUNC_REVERSE_SUBTRACT};Pt[gS]=e.MIN,Pt[vS]=e.MAX;let Ft={[_S]:e.ZERO,[yS]:e.ONE,[xS]:e.SRC_COLOR,[Uh]:e.SRC_ALPHA,[AS]:e.SRC_ALPHA_SATURATE,[ES]:e.DST_COLOR,[SS]:e.DST_ALPHA,[bS]:e.ONE_MINUS_SRC_COLOR,[Lh]:e.ONE_MINUS_SRC_ALPHA,[TS]:e.ONE_MINUS_DST_COLOR,[MS]:e.ONE_MINUS_DST_ALPHA,[wS]:e.CONSTANT_COLOR,[CS]:e.ONE_MINUS_CONSTANT_COLOR,[RS]:e.CONSTANT_ALPHA,[DS]:e.ONE_MINUS_CONSTANT_ALPHA};function Jt(O,N,U,rt,$,Z,ht,pt,Gt,ae){if(O===Zi){v===!0&&(Mt(e.BLEND),v=!1);return}if(v===!1&&(nt(e.BLEND),v=!0),O!==dS){if(O!==f||ae!==R){if((g!==ha||T!==ha)&&(e.blendEquation(e.FUNC_ADD),g=ha,T=ha),ae)switch(O){case Qa:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Wg:e.blendFunc(e.ONE,e.ONE);break;case qg:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case Yg:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:zt("WebGLState: Invalid blending: ",O);break}else switch(O){case Qa:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Wg:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case qg:zt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Yg:zt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:zt("WebGLState: Invalid blending: ",O);break}y=null,_=null,A=null,w=null,x.set(0,0,0),M=0,f=O,R=ae}return}$=$||N,Z=Z||U,ht=ht||rt,(N!==g||$!==T)&&(e.blendEquationSeparate(Pt[N],Pt[$]),g=N,T=$),(U!==y||rt!==_||Z!==A||ht!==w)&&(e.blendFuncSeparate(Ft[U],Ft[rt],Ft[Z],Ft[ht]),y=U,_=rt,A=Z,w=ht),(pt.equals(x)===!1||Gt!==M)&&(e.blendColor(pt.r,pt.g,pt.b,Gt),x.copy(pt),M=Gt),f=O,R=!1}function Ht(O,N){O.side===ni?Mt(e.CULL_FACE):nt(e.CULL_FACE);let U=O.side===Cn;N&&(U=!U),de(U),O.blending===Qa&&O.transparent===!1?Jt(Zi):Jt(O.blending,O.blendEquation,O.blendSrc,O.blendDst,O.blendEquationAlpha,O.blendSrcAlpha,O.blendDstAlpha,O.blendColor,O.blendAlpha,O.premultipliedAlpha),r.setFunc(O.depthFunc),r.setTest(O.depthTest),r.setMask(O.depthWrite),a.setMask(O.colorWrite);let rt=O.stencilWrite;o.setTest(rt),rt&&(o.setMask(O.stencilWriteMask),o.setFunc(O.stencilFunc,O.stencilRef,O.stencilFuncMask),o.setOp(O.stencilFail,O.stencilZFail,O.stencilZPass)),We(O.polygonOffset,O.polygonOffsetFactor,O.polygonOffsetUnits),O.alphaToCoverage===!0?nt(e.SAMPLE_ALPHA_TO_COVERAGE):Mt(e.SAMPLE_ALPHA_TO_COVERAGE)}function de(O){D!==O&&(O?e.frontFace(e.CW):e.frontFace(e.CCW),D=O)}function Pe(O){O!==uS?(nt(e.CULL_FACE),O!==I&&(O===Xg?e.cullFace(e.BACK):O===hS?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))):Mt(e.CULL_FACE),I=O}function pe(O){O!==q&&(V&&e.lineWidth(O),q=O)}function We(O,N,U){O?(nt(e.POLYGON_OFFSET_FILL),(J!==N||z!==U)&&(J=N,z=U,r.getReversed()&&(N=-N),e.polygonOffset(N,U))):Mt(e.POLYGON_OFFSET_FILL)}function le(O){O?nt(e.SCISSOR_TEST):Mt(e.SCISSOR_TEST)}function Le(O){O===void 0&&(O=e.TEXTURE0+B-1),ut!==O&&(e.activeTexture(O),ut=O)}function P(O,N,U){U===void 0&&(ut===null?U=e.TEXTURE0+B-1:U=ut);let rt=ct[U];rt===void 0&&(rt={type:void 0,texture:void 0},ct[U]=rt),(rt.type!==O||rt.texture!==N)&&(ut!==U&&(e.activeTexture(U),ut=U),e.bindTexture(O,N||et[O]),rt.type=O,rt.texture=N)}function sn(){let O=ct[ut];O!==void 0&&O.type!==void 0&&(e.bindTexture(O.type,null),O.type=void 0,O.texture=void 0)}function oe(){try{e.compressedTexImage2D(...arguments)}catch(O){zt("WebGLState:",O)}}function C(){try{e.compressedTexImage3D(...arguments)}catch(O){zt("WebGLState:",O)}}function b(){try{e.texSubImage2D(...arguments)}catch(O){zt("WebGLState:",O)}}function H(){try{e.texSubImage3D(...arguments)}catch(O){zt("WebGLState:",O)}}function X(){try{e.compressedTexSubImage2D(...arguments)}catch(O){zt("WebGLState:",O)}}function Q(){try{e.compressedTexSubImage3D(...arguments)}catch(O){zt("WebGLState:",O)}}function ft(){try{e.texStorage2D(...arguments)}catch(O){zt("WebGLState:",O)}}function mt(){try{e.texStorage3D(...arguments)}catch(O){zt("WebGLState:",O)}}function tt(){try{e.texImage2D(...arguments)}catch(O){zt("WebGLState:",O)}}function it(){try{e.texImage3D(...arguments)}catch(O){zt("WebGLState:",O)}}function gt(O){return d[O]!==void 0?d[O]:e.getParameter(O)}function Et(O,N){d[O]!==N&&(e.pixelStorei(O,N),d[O]=N)}function vt(O){Wt.equals(O)===!1&&(e.scissor(O.x,O.y,O.z,O.w),Wt.copy(O))}function dt(O){kt.equals(O)===!1&&(e.viewport(O.x,O.y,O.z,O.w),kt.copy(O))}function Ct(O,N){let U=l.get(N);U===void 0&&(U=new WeakMap,l.set(N,U));let rt=U.get(O);rt===void 0&&(rt=e.getUniformBlockIndex(N,O.name),U.set(O,rt))}function Tt(O,N){let rt=l.get(N).get(O);c.get(N)!==rt&&(e.uniformBlockBinding(N,rt,O.__bindingPointIndex),c.set(N,rt))}function Ot(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),r.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),h={},d={},ut=null,ct={},u={},p=new WeakMap,m=[],S=null,v=!1,f=null,g=null,y=null,_=null,T=null,A=null,w=null,x=new te(0,0,0),M=0,R=!1,D=null,I=null,q=null,J=null,z=null,Wt.set(0,0,e.canvas.width,e.canvas.height),kt.set(0,0,e.canvas.width,e.canvas.height),a.reset(),r.reset(),o.reset()}return{buffers:{color:a,depth:r,stencil:o},enable:nt,disable:Mt,bindFramebuffer:Ut,drawBuffers:wt,useProgram:se,setBlending:Jt,setMaterial:Ht,setFlipSided:de,setCullFace:Pe,setLineWidth:pe,setPolygonOffset:We,setScissorTest:le,activeTexture:Le,bindTexture:P,unbindTexture:sn,compressedTexImage2D:oe,compressedTexImage3D:C,texImage2D:tt,texImage3D:it,pixelStorei:Et,getParameter:gt,updateUBOMapping:Ct,uniformBlockBinding:Tt,texStorage2D:ft,texStorage3D:mt,texSubImage2D:b,texSubImage3D:H,compressedTexSubImage2D:X,compressedTexSubImage3D:Q,scissor:vt,viewport:dt,reset:Ot}}function n3(e,t,n,i,s,a,r){let o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new Lt,h=new WeakMap,d=new Set,u,p=new WeakMap,m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function S(C,b){return m?new OffscreenCanvas(C,b):Gl("canvas")}function v(C,b,H){let X=1,Q=oe(C);if((Q.width>H||Q.height>H)&&(X=H/Math.max(Q.width,Q.height)),X<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){let ft=Math.floor(X*Q.width),mt=Math.floor(X*Q.height);u===void 0&&(u=S(ft,mt));let tt=b?S(ft,mt):u;return tt.width=ft,tt.height=mt,tt.getContext("2d").drawImage(C,0,0,ft,mt),It("WebGLRenderer: Texture has been resized from ("+Q.width+"x"+Q.height+") to ("+ft+"x"+mt+")."),tt}else return"data"in C&&It("WebGLRenderer: Image in DataTexture is too big ("+Q.width+"x"+Q.height+")."),C;return C}function f(C){return C.generateMipmaps}function g(C){e.generateMipmap(C)}function y(C){return C.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:C.isWebGL3DRenderTarget?e.TEXTURE_3D:C.isWebGLArrayRenderTarget||C.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function _(C,b,H,X,Q,ft=!1){if(C!==null){if(e[C]!==void 0)return e[C];It("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let mt;X&&(mt=t.get("EXT_texture_norm16"),mt||It("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let tt=b;if(b===e.RED&&(H===e.FLOAT&&(tt=e.R32F),H===e.HALF_FLOAT&&(tt=e.R16F),H===e.UNSIGNED_BYTE&&(tt=e.R8),H===e.UNSIGNED_SHORT&&mt&&(tt=mt.R16_EXT),H===e.SHORT&&mt&&(tt=mt.R16_SNORM_EXT)),b===e.RED_INTEGER&&(H===e.UNSIGNED_BYTE&&(tt=e.R8UI),H===e.UNSIGNED_SHORT&&(tt=e.R16UI),H===e.UNSIGNED_INT&&(tt=e.R32UI),H===e.BYTE&&(tt=e.R8I),H===e.SHORT&&(tt=e.R16I),H===e.INT&&(tt=e.R32I)),b===e.RG&&(H===e.FLOAT&&(tt=e.RG32F),H===e.HALF_FLOAT&&(tt=e.RG16F),H===e.UNSIGNED_BYTE&&(tt=e.RG8),H===e.UNSIGNED_SHORT&&mt&&(tt=mt.RG16_EXT),H===e.SHORT&&mt&&(tt=mt.RG16_SNORM_EXT)),b===e.RG_INTEGER&&(H===e.UNSIGNED_BYTE&&(tt=e.RG8UI),H===e.UNSIGNED_SHORT&&(tt=e.RG16UI),H===e.UNSIGNED_INT&&(tt=e.RG32UI),H===e.BYTE&&(tt=e.RG8I),H===e.SHORT&&(tt=e.RG16I),H===e.INT&&(tt=e.RG32I)),b===e.RGB_INTEGER&&(H===e.UNSIGNED_BYTE&&(tt=e.RGB8UI),H===e.UNSIGNED_SHORT&&(tt=e.RGB16UI),H===e.UNSIGNED_INT&&(tt=e.RGB32UI),H===e.BYTE&&(tt=e.RGB8I),H===e.SHORT&&(tt=e.RGB16I),H===e.INT&&(tt=e.RGB32I)),b===e.RGBA_INTEGER&&(H===e.UNSIGNED_BYTE&&(tt=e.RGBA8UI),H===e.UNSIGNED_SHORT&&(tt=e.RGBA16UI),H===e.UNSIGNED_INT&&(tt=e.RGBA32UI),H===e.BYTE&&(tt=e.RGBA8I),H===e.SHORT&&(tt=e.RGBA16I),H===e.INT&&(tt=e.RGBA32I)),b===e.RGB&&(H===e.UNSIGNED_SHORT&&mt&&(tt=mt.RGB16_EXT),H===e.SHORT&&mt&&(tt=mt.RGB16_SNORM_EXT),H===e.UNSIGNED_INT_5_9_9_9_REV&&(tt=e.RGB9_E5),H===e.UNSIGNED_INT_10F_11F_11F_REV&&(tt=e.R11F_G11F_B10F)),b===e.RGBA){let it=ft?Vl:ne.getTransfer(Q);H===e.FLOAT&&(tt=e.RGBA32F),H===e.HALF_FLOAT&&(tt=e.RGBA16F),H===e.UNSIGNED_BYTE&&(tt=it===fe?e.SRGB8_ALPHA8:e.RGBA8),H===e.UNSIGNED_SHORT&&mt&&(tt=mt.RGBA16_EXT),H===e.SHORT&&mt&&(tt=mt.RGBA16_SNORM_EXT),H===e.UNSIGNED_SHORT_4_4_4_4&&(tt=e.RGBA4),H===e.UNSIGNED_SHORT_5_5_5_1&&(tt=e.RGB5_A1)}return(tt===e.R16F||tt===e.R32F||tt===e.RG16F||tt===e.RG32F||tt===e.RGBA16F||tt===e.RGBA32F)&&t.get("EXT_color_buffer_float"),tt}function T(C,b){let H;return C?b===null||b===Ci||b===Eo?H=e.DEPTH24_STENCIL8:b===Ri?H=e.DEPTH32F_STENCIL8:b===Mo&&(H=e.DEPTH24_STENCIL8,It("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):b===null||b===Ci||b===Eo?H=e.DEPTH_COMPONENT24:b===Ri?H=e.DEPTH_COMPONENT32F:b===Mo&&(H=e.DEPTH_COMPONENT16),H}function A(C,b){return f(C)===!0||C.isFramebufferTexture&&C.minFilter!==cn&&C.minFilter!==mn?Math.log2(Math.max(b.width,b.height))+1:C.mipmaps!==void 0&&C.mipmaps.length>0?C.mipmaps.length:C.isCompressedTexture&&Array.isArray(C.image)?b.mipmaps.length:1}function w(C){let b=C.target;b.removeEventListener("dispose",w),M(b),b.isVideoTexture&&h.delete(b),b.isHTMLTexture&&d.delete(b)}function x(C){let b=C.target;b.removeEventListener("dispose",x),D(b)}function M(C){let b=i.get(C);if(b.__webglInit===void 0)return;let H=C.source,X=p.get(H);if(X){let Q=X[b.__cacheKey];Q.usedTimes--,Q.usedTimes===0&&R(C),Object.keys(X).length===0&&p.delete(H)}i.remove(C)}function R(C){let b=i.get(C);e.deleteTexture(b.__webglTexture);let H=C.source,X=p.get(H);delete X[b.__cacheKey],r.memory.textures--}function D(C){let b=i.get(C);if(C.depthTexture&&(C.depthTexture.dispose(),i.remove(C.depthTexture)),C.isWebGLCubeRenderTarget)for(let X=0;X<6;X++){if(Array.isArray(b.__webglFramebuffer[X]))for(let Q=0;Q<b.__webglFramebuffer[X].length;Q++)e.deleteFramebuffer(b.__webglFramebuffer[X][Q]);else e.deleteFramebuffer(b.__webglFramebuffer[X]);b.__webglDepthbuffer&&e.deleteRenderbuffer(b.__webglDepthbuffer[X])}else{if(Array.isArray(b.__webglFramebuffer))for(let X=0;X<b.__webglFramebuffer.length;X++)e.deleteFramebuffer(b.__webglFramebuffer[X]);else e.deleteFramebuffer(b.__webglFramebuffer);if(b.__webglDepthbuffer&&e.deleteRenderbuffer(b.__webglDepthbuffer),b.__webglMultisampledFramebuffer&&e.deleteFramebuffer(b.__webglMultisampledFramebuffer),b.__webglColorRenderbuffer)for(let X=0;X<b.__webglColorRenderbuffer.length;X++)b.__webglColorRenderbuffer[X]&&e.deleteRenderbuffer(b.__webglColorRenderbuffer[X]);b.__webglDepthRenderbuffer&&e.deleteRenderbuffer(b.__webglDepthRenderbuffer)}let H=C.textures;for(let X=0,Q=H.length;X<Q;X++){let ft=i.get(H[X]);ft.__webglTexture&&(e.deleteTexture(ft.__webglTexture),r.memory.textures--),i.remove(H[X])}i.remove(C)}let I=0;function q(){I=0}function J(){return I}function z(C){I=C}function B(){let C=I;return C>=s.maxTextures&&It("WebGLTextures: Trying to use "+C+" texture units while this GPU supports only "+s.maxTextures),I+=1,C}function V(C){let b=[];return b.push(C.wrapS),b.push(C.wrapT),b.push(C.wrapR||0),b.push(C.magFilter),b.push(C.minFilter),b.push(C.anisotropy),b.push(C.internalFormat),b.push(C.format),b.push(C.type),b.push(C.generateMipmaps),b.push(C.premultiplyAlpha),b.push(C.flipY),b.push(C.unpackAlignment),b.push(C.colorSpace),b.join()}function j(C,b){let H=i.get(C);if(C.isVideoTexture&&P(C),C.isRenderTargetTexture===!1&&C.isExternalTexture!==!0&&C.version>0&&H.__version!==C.version){let X=C.image;if(X===null)It("WebGLRenderer: Texture marked for update but no image data found.");else if(X.complete===!1)It("WebGLRenderer: Texture marked for update but image is incomplete");else{Mt(H,C,b);return}}else C.isExternalTexture&&(H.__webglTexture=C.sourceTexture?C.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,H.__webglTexture,e.TEXTURE0+b)}function lt(C,b){let H=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&H.__version!==C.version){Mt(H,C,b);return}else C.isExternalTexture&&(H.__webglTexture=C.sourceTexture?C.sourceTexture:null);n.bindTexture(e.TEXTURE_2D_ARRAY,H.__webglTexture,e.TEXTURE0+b)}function ut(C,b){let H=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&H.__version!==C.version){Mt(H,C,b);return}n.bindTexture(e.TEXTURE_3D,H.__webglTexture,e.TEXTURE0+b)}function ct(C,b){let H=i.get(C);if(C.isCubeDepthTexture!==!0&&C.version>0&&H.__version!==C.version){Ut(H,C,b);return}n.bindTexture(e.TEXTURE_CUBE_MAP,H.__webglTexture,e.TEXTURE0+b)}let ot={[Hh]:e.REPEAT,[Hi]:e.CLAMP_TO_EDGE,[Gh]:e.MIRRORED_REPEAT},Nt={[cn]:e.NEAREST,[LS]:e.NEAREST_MIPMAP_NEAREST,[uc]:e.NEAREST_MIPMAP_LINEAR,[mn]:e.LINEAR,[Tf]:e.LINEAR_MIPMAP_NEAREST,[xa]:e.LINEAR_MIPMAP_LINEAR},Wt={[PS]:e.NEVER,[HS]:e.ALWAYS,[zS]:e.LESS,[ld]:e.LEQUAL,[BS]:e.EQUAL,[cd]:e.GEQUAL,[FS]:e.GREATER,[VS]:e.NOTEQUAL};function kt(C,b){if(b.type===Ri&&t.has("OES_texture_float_linear")===!1&&(b.magFilter===mn||b.magFilter===Tf||b.magFilter===uc||b.magFilter===xa||b.minFilter===mn||b.minFilter===Tf||b.minFilter===uc||b.minFilter===xa)&&It("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),e.texParameteri(C,e.TEXTURE_WRAP_S,ot[b.wrapS]),e.texParameteri(C,e.TEXTURE_WRAP_T,ot[b.wrapT]),(C===e.TEXTURE_3D||C===e.TEXTURE_2D_ARRAY)&&e.texParameteri(C,e.TEXTURE_WRAP_R,ot[b.wrapR]),e.texParameteri(C,e.TEXTURE_MAG_FILTER,Nt[b.magFilter]),e.texParameteri(C,e.TEXTURE_MIN_FILTER,Nt[b.minFilter]),b.compareFunction&&(e.texParameteri(C,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(C,e.TEXTURE_COMPARE_FUNC,Wt[b.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(b.magFilter===cn||b.minFilter!==uc&&b.minFilter!==xa||b.type===Ri&&t.has("OES_texture_float_linear")===!1)return;if(b.anisotropy>1||i.get(b).__currentAnisotropy){let H=t.get("EXT_texture_filter_anisotropic");e.texParameterf(C,H.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(b.anisotropy,s.getMaxAnisotropy())),i.get(b).__currentAnisotropy=b.anisotropy}}}function K(C,b){let H=!1;C.__webglInit===void 0&&(C.__webglInit=!0,b.addEventListener("dispose",w));let X=b.source,Q=p.get(X);Q===void 0&&(Q={},p.set(X,Q));let ft=V(b);if(ft!==C.__cacheKey){Q[ft]===void 0&&(Q[ft]={texture:e.createTexture(),usedTimes:0},r.memory.textures++,H=!0),Q[ft].usedTimes++;let mt=Q[C.__cacheKey];mt!==void 0&&(Q[C.__cacheKey].usedTimes--,mt.usedTimes===0&&R(b)),C.__cacheKey=ft,C.__webglTexture=Q[ft].texture}return H}function et(C,b,H){return Math.floor(Math.floor(C/H)/b)}function nt(C,b,H,X){let ft=C.updateRanges;if(ft.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,b.width,b.height,H,X,b.data);else{ft.sort((Et,vt)=>Et.start-vt.start);let mt=0;for(let Et=1;Et<ft.length;Et++){let vt=ft[mt],dt=ft[Et],Ct=vt.start+vt.count,Tt=et(dt.start,b.width,4),Ot=et(vt.start,b.width,4);dt.start<=Ct+1&&Tt===Ot&&et(dt.start+dt.count-1,b.width,4)===Tt?vt.count=Math.max(vt.count,dt.start+dt.count-vt.start):(++mt,ft[mt]=dt)}ft.length=mt+1;let tt=n.getParameter(e.UNPACK_ROW_LENGTH),it=n.getParameter(e.UNPACK_SKIP_PIXELS),gt=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,b.width);for(let Et=0,vt=ft.length;Et<vt;Et++){let dt=ft[Et],Ct=Math.floor(dt.start/4),Tt=Math.ceil(dt.count/4),Ot=Ct%b.width,O=Math.floor(Ct/b.width),N=Tt,U=1;n.pixelStorei(e.UNPACK_SKIP_PIXELS,Ot),n.pixelStorei(e.UNPACK_SKIP_ROWS,O),n.texSubImage2D(e.TEXTURE_2D,0,Ot,O,N,U,H,X,b.data)}C.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,tt),n.pixelStorei(e.UNPACK_SKIP_PIXELS,it),n.pixelStorei(e.UNPACK_SKIP_ROWS,gt)}}function Mt(C,b,H){let X=e.TEXTURE_2D;(b.isDataArrayTexture||b.isCompressedArrayTexture)&&(X=e.TEXTURE_2D_ARRAY),b.isData3DTexture&&(X=e.TEXTURE_3D);let Q=K(C,b),ft=b.source;n.bindTexture(X,C.__webglTexture,e.TEXTURE0+H);let mt=i.get(ft);if(ft.version!==mt.__version||Q===!0){if(n.activeTexture(e.TEXTURE0+H),(typeof ImageBitmap<"u"&&b.image instanceof ImageBitmap)===!1){let U=ne.getPrimaries(ne.workingColorSpace),rt=b.colorSpace===ws?null:ne.getPrimaries(b.colorSpace),$=b.colorSpace===ws||U===rt?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,b.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,$)}n.pixelStorei(e.UNPACK_ALIGNMENT,b.unpackAlignment);let it=v(b.image,!1,s.maxTextureSize);it=sn(b,it);let gt=a.convert(b.format,b.colorSpace),Et=a.convert(b.type),vt=_(b.internalFormat,gt,Et,b.normalized,b.colorSpace,b.isVideoTexture);kt(X,b);let dt,Ct=b.mipmaps,Tt=b.isVideoTexture!==!0,Ot=mt.__version===void 0||Q===!0,O=ft.dataReady,N=A(b,it);if(b.isDepthTexture)vt=T(b.format===ba,b.type),Ot&&(Tt?n.texStorage2D(e.TEXTURE_2D,1,vt,it.width,it.height):n.texImage2D(e.TEXTURE_2D,0,vt,it.width,it.height,0,gt,Et,null));else if(b.isDataTexture)if(Ct.length>0){Tt&&Ot&&n.texStorage2D(e.TEXTURE_2D,N,vt,Ct[0].width,Ct[0].height);for(let U=0,rt=Ct.length;U<rt;U++)dt=Ct[U],Tt?O&&n.texSubImage2D(e.TEXTURE_2D,U,0,0,dt.width,dt.height,gt,Et,dt.data):n.texImage2D(e.TEXTURE_2D,U,vt,dt.width,dt.height,0,gt,Et,dt.data);b.generateMipmaps=!1}else Tt?(Ot&&n.texStorage2D(e.TEXTURE_2D,N,vt,it.width,it.height),O&&nt(b,it,gt,Et)):n.texImage2D(e.TEXTURE_2D,0,vt,it.width,it.height,0,gt,Et,it.data);else if(b.isCompressedTexture)if(b.isCompressedArrayTexture){Tt&&Ot&&n.texStorage3D(e.TEXTURE_2D_ARRAY,N,vt,Ct[0].width,Ct[0].height,it.depth);for(let U=0,rt=Ct.length;U<rt;U++)if(dt=Ct[U],b.format!==yi)if(gt!==null)if(Tt){if(O)if(b.layerUpdates.size>0){let $=v0(dt.width,dt.height,b.format,b.type);for(let Z of b.layerUpdates){let ht=dt.data.subarray(Z*$/dt.data.BYTES_PER_ELEMENT,(Z+1)*$/dt.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,U,0,0,Z,dt.width,dt.height,1,gt,ht)}b.clearLayerUpdates()}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,U,0,0,0,dt.width,dt.height,it.depth,gt,dt.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,U,vt,dt.width,dt.height,it.depth,0,dt.data,0,0);else It("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Tt?O&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,U,0,0,0,dt.width,dt.height,it.depth,gt,Et,dt.data):n.texImage3D(e.TEXTURE_2D_ARRAY,U,vt,dt.width,dt.height,it.depth,0,gt,Et,dt.data)}else{Tt&&Ot&&n.texStorage2D(e.TEXTURE_2D,N,vt,Ct[0].width,Ct[0].height);for(let U=0,rt=Ct.length;U<rt;U++)dt=Ct[U],b.format!==yi?gt!==null?Tt?O&&n.compressedTexSubImage2D(e.TEXTURE_2D,U,0,0,dt.width,dt.height,gt,dt.data):n.compressedTexImage2D(e.TEXTURE_2D,U,vt,dt.width,dt.height,0,dt.data):It("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Tt?O&&n.texSubImage2D(e.TEXTURE_2D,U,0,0,dt.width,dt.height,gt,Et,dt.data):n.texImage2D(e.TEXTURE_2D,U,vt,dt.width,dt.height,0,gt,Et,dt.data)}else if(b.isDataArrayTexture)if(Tt){if(Ot&&n.texStorage3D(e.TEXTURE_2D_ARRAY,N,vt,it.width,it.height,it.depth),O)if(b.layerUpdates.size>0){let U=v0(it.width,it.height,b.format,b.type);for(let rt of b.layerUpdates){let $=it.data.subarray(rt*U/it.data.BYTES_PER_ELEMENT,(rt+1)*U/it.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,rt,it.width,it.height,1,gt,Et,$)}b.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,it.width,it.height,it.depth,gt,Et,it.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,vt,it.width,it.height,it.depth,0,gt,Et,it.data);else if(b.isData3DTexture)Tt?(Ot&&n.texStorage3D(e.TEXTURE_3D,N,vt,it.width,it.height,it.depth),O&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,it.width,it.height,it.depth,gt,Et,it.data)):n.texImage3D(e.TEXTURE_3D,0,vt,it.width,it.height,it.depth,0,gt,Et,it.data);else if(b.isFramebufferTexture){if(Ot)if(Tt)n.texStorage2D(e.TEXTURE_2D,N,vt,it.width,it.height);else{let U=it.width,rt=it.height;for(let $=0;$<N;$++)n.texImage2D(e.TEXTURE_2D,$,vt,U,rt,0,gt,Et,null),U>>=1,rt>>=1}}else if(b.isHTMLTexture){if("texElementImage2D"in e){let U=e.canvas;if(U.hasAttribute("layoutsubtree")||U.setAttribute("layoutsubtree","true"),it.parentNode!==U){U.appendChild(it),d.add(b),U.onpaint=rt=>{let $=rt.changedElements;for(let Z of d)$.includes(Z.image)&&(Z.needsUpdate=!0)},U.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,it);else{let $=e.RGBA,Z=e.RGBA,ht=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,$,Z,ht,it)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(Ct.length>0){if(Tt&&Ot){let U=oe(Ct[0]);n.texStorage2D(e.TEXTURE_2D,N,vt,U.width,U.height)}for(let U=0,rt=Ct.length;U<rt;U++)dt=Ct[U],Tt?O&&n.texSubImage2D(e.TEXTURE_2D,U,0,0,gt,Et,dt):n.texImage2D(e.TEXTURE_2D,U,vt,gt,Et,dt);b.generateMipmaps=!1}else if(Tt){if(Ot){let U=oe(it);n.texStorage2D(e.TEXTURE_2D,N,vt,U.width,U.height)}O&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,gt,Et,it)}else n.texImage2D(e.TEXTURE_2D,0,vt,gt,Et,it);f(b)&&g(X),mt.__version=ft.version,b.onUpdate&&b.onUpdate(b)}C.__version=b.version}function Ut(C,b,H){if(b.image.length!==6)return;let X=K(C,b),Q=b.source;n.bindTexture(e.TEXTURE_CUBE_MAP,C.__webglTexture,e.TEXTURE0+H);let ft=i.get(Q);if(Q.version!==ft.__version||X===!0){n.activeTexture(e.TEXTURE0+H);let mt=ne.getPrimaries(ne.workingColorSpace),tt=b.colorSpace===ws?null:ne.getPrimaries(b.colorSpace),it=b.colorSpace===ws||mt===tt?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,b.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,b.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,it);let gt=b.isCompressedTexture||b.image[0].isCompressedTexture,Et=b.image[0]&&b.image[0].isDataTexture,vt=[];for(let Z=0;Z<6;Z++)!gt&&!Et?vt[Z]=v(b.image[Z],!0,s.maxCubemapSize):vt[Z]=Et?b.image[Z].image:b.image[Z],vt[Z]=sn(b,vt[Z]);let dt=vt[0],Ct=a.convert(b.format,b.colorSpace),Tt=a.convert(b.type),Ot=_(b.internalFormat,Ct,Tt,b.normalized,b.colorSpace),O=b.isVideoTexture!==!0,N=ft.__version===void 0||X===!0,U=Q.dataReady,rt=A(b,dt);kt(e.TEXTURE_CUBE_MAP,b);let $;if(gt){O&&N&&n.texStorage2D(e.TEXTURE_CUBE_MAP,rt,Ot,dt.width,dt.height);for(let Z=0;Z<6;Z++){$=vt[Z].mipmaps;for(let ht=0;ht<$.length;ht++){let pt=$[ht];b.format!==yi?Ct!==null?O?U&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,ht,0,0,pt.width,pt.height,Ct,pt.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,ht,Ot,pt.width,pt.height,0,pt.data):It("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):O?U&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,ht,0,0,pt.width,pt.height,Ct,Tt,pt.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,ht,Ot,pt.width,pt.height,0,Ct,Tt,pt.data)}}}else{if($=b.mipmaps,O&&N){$.length>0&&rt++;let Z=oe(vt[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,rt,Ot,Z.width,Z.height)}for(let Z=0;Z<6;Z++)if(Et){O?U&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0,0,0,vt[Z].width,vt[Z].height,Ct,Tt,vt[Z].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0,Ot,vt[Z].width,vt[Z].height,0,Ct,Tt,vt[Z].data);for(let ht=0;ht<$.length;ht++){let Gt=$[ht].image[Z].image;O?U&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,ht+1,0,0,Gt.width,Gt.height,Ct,Tt,Gt.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,ht+1,Ot,Gt.width,Gt.height,0,Ct,Tt,Gt.data)}}else{O?U&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0,0,0,Ct,Tt,vt[Z]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0,Ot,Ct,Tt,vt[Z]);for(let ht=0;ht<$.length;ht++){let pt=$[ht];O?U&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,ht+1,0,0,Ct,Tt,pt.image[Z]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,ht+1,Ot,Ct,Tt,pt.image[Z])}}}f(b)&&g(e.TEXTURE_CUBE_MAP),ft.__version=Q.version,b.onUpdate&&b.onUpdate(b)}C.__version=b.version}function wt(C,b,H,X,Q,ft){let mt=a.convert(H.format,H.colorSpace),tt=a.convert(H.type),it=_(H.internalFormat,mt,tt,H.normalized,H.colorSpace),gt=i.get(b),Et=i.get(H);if(Et.__renderTarget=b,!gt.__hasExternalTextures){let vt=Math.max(1,b.width>>ft),dt=Math.max(1,b.height>>ft);Q===e.TEXTURE_3D||Q===e.TEXTURE_2D_ARRAY?n.texImage3D(Q,ft,it,vt,dt,b.depth,0,mt,tt,null):n.texImage2D(Q,ft,it,vt,dt,0,mt,tt,null)}n.bindFramebuffer(e.FRAMEBUFFER,C),Le(b)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,X,Q,Et.__webglTexture,0,le(b)):(Q===e.TEXTURE_2D||Q>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&Q<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,X,Q,Et.__webglTexture,ft),n.bindFramebuffer(e.FRAMEBUFFER,null)}function se(C,b,H){if(e.bindRenderbuffer(e.RENDERBUFFER,C),b.depthBuffer){let X=b.depthTexture,Q=X&&X.isDepthTexture?X.type:null,ft=T(b.stencilBuffer,Q),mt=b.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;Le(b)?o.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,le(b),ft,b.width,b.height):H?e.renderbufferStorageMultisample(e.RENDERBUFFER,le(b),ft,b.width,b.height):e.renderbufferStorage(e.RENDERBUFFER,ft,b.width,b.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,mt,e.RENDERBUFFER,C)}else{let X=b.textures;for(let Q=0;Q<X.length;Q++){let ft=X[Q],mt=a.convert(ft.format,ft.colorSpace),tt=a.convert(ft.type),it=_(ft.internalFormat,mt,tt,ft.normalized,ft.colorSpace);Le(b)?o.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,le(b),it,b.width,b.height):H?e.renderbufferStorageMultisample(e.RENDERBUFFER,le(b),it,b.width,b.height):e.renderbufferStorage(e.RENDERBUFFER,it,b.width,b.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function Pt(C,b,H){let X=b.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,C),!(b.depthTexture&&b.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let Q=i.get(b.depthTexture);if(Q.__renderTarget=b,(!Q.__webglTexture||b.depthTexture.image.width!==b.width||b.depthTexture.image.height!==b.height)&&(b.depthTexture.image.width=b.width,b.depthTexture.image.height=b.height,b.depthTexture.needsUpdate=!0),X){if(Q.__webglInit===void 0&&(Q.__webglInit=!0,b.depthTexture.addEventListener("dispose",w)),Q.__webglTexture===void 0){Q.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,Q.__webglTexture),kt(e.TEXTURE_CUBE_MAP,b.depthTexture);let gt=a.convert(b.depthTexture.format),Et=a.convert(b.depthTexture.type),vt;b.depthTexture.format===ki?vt=e.DEPTH_COMPONENT24:b.depthTexture.format===ba&&(vt=e.DEPTH24_STENCIL8);for(let dt=0;dt<6;dt++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+dt,0,vt,b.width,b.height,0,gt,Et,null)}}else j(b.depthTexture,0);let ft=Q.__webglTexture,mt=le(b),tt=X?e.TEXTURE_CUBE_MAP_POSITIVE_X+H:e.TEXTURE_2D,it=b.depthTexture.format===ba?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(b.depthTexture.format===ki)Le(b)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,it,tt,ft,0,mt):e.framebufferTexture2D(e.FRAMEBUFFER,it,tt,ft,0);else if(b.depthTexture.format===ba)Le(b)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,it,tt,ft,0,mt):e.framebufferTexture2D(e.FRAMEBUFFER,it,tt,ft,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Ft(C){let b=i.get(C),H=C.isWebGLCubeRenderTarget===!0;if(b.__boundDepthTexture!==C.depthTexture){let X=C.depthTexture;if(b.__depthDisposeCallback&&b.__depthDisposeCallback(),X){let Q=()=>{delete b.__boundDepthTexture,delete b.__depthDisposeCallback,X.removeEventListener("dispose",Q)};X.addEventListener("dispose",Q),b.__depthDisposeCallback=Q}b.__boundDepthTexture=X}if(C.depthTexture&&!b.__autoAllocateDepthBuffer)if(H)for(let X=0;X<6;X++)Pt(b.__webglFramebuffer[X],C,X);else{let X=C.texture.mipmaps;X&&X.length>0?Pt(b.__webglFramebuffer[0],C,0):Pt(b.__webglFramebuffer,C,0)}else if(H){b.__webglDepthbuffer=[];for(let X=0;X<6;X++)if(n.bindFramebuffer(e.FRAMEBUFFER,b.__webglFramebuffer[X]),b.__webglDepthbuffer[X]===void 0)b.__webglDepthbuffer[X]=e.createRenderbuffer(),se(b.__webglDepthbuffer[X],C,!1);else{let Q=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ft=b.__webglDepthbuffer[X];e.bindRenderbuffer(e.RENDERBUFFER,ft),e.framebufferRenderbuffer(e.FRAMEBUFFER,Q,e.RENDERBUFFER,ft)}}else{let X=C.texture.mipmaps;if(X&&X.length>0?n.bindFramebuffer(e.FRAMEBUFFER,b.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,b.__webglFramebuffer),b.__webglDepthbuffer===void 0)b.__webglDepthbuffer=e.createRenderbuffer(),se(b.__webglDepthbuffer,C,!1);else{let Q=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ft=b.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,ft),e.framebufferRenderbuffer(e.FRAMEBUFFER,Q,e.RENDERBUFFER,ft)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function Jt(C,b,H){let X=i.get(C);b!==void 0&&wt(X.__webglFramebuffer,C,C.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),H!==void 0&&Ft(C)}function Ht(C){let b=C.texture,H=i.get(C),X=i.get(b);C.addEventListener("dispose",x);let Q=C.textures,ft=C.isWebGLCubeRenderTarget===!0,mt=Q.length>1;if(mt||(X.__webglTexture===void 0&&(X.__webglTexture=e.createTexture()),X.__version=b.version,r.memory.textures++),ft){H.__webglFramebuffer=[];for(let tt=0;tt<6;tt++)if(b.mipmaps&&b.mipmaps.length>0){H.__webglFramebuffer[tt]=[];for(let it=0;it<b.mipmaps.length;it++)H.__webglFramebuffer[tt][it]=e.createFramebuffer()}else H.__webglFramebuffer[tt]=e.createFramebuffer()}else{if(b.mipmaps&&b.mipmaps.length>0){H.__webglFramebuffer=[];for(let tt=0;tt<b.mipmaps.length;tt++)H.__webglFramebuffer[tt]=e.createFramebuffer()}else H.__webglFramebuffer=e.createFramebuffer();if(mt)for(let tt=0,it=Q.length;tt<it;tt++){let gt=i.get(Q[tt]);gt.__webglTexture===void 0&&(gt.__webglTexture=e.createTexture(),r.memory.textures++)}if(C.samples>0&&Le(C)===!1){H.__webglMultisampledFramebuffer=e.createFramebuffer(),H.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,H.__webglMultisampledFramebuffer);for(let tt=0;tt<Q.length;tt++){let it=Q[tt];H.__webglColorRenderbuffer[tt]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,H.__webglColorRenderbuffer[tt]);let gt=a.convert(it.format,it.colorSpace),Et=a.convert(it.type),vt=_(it.internalFormat,gt,Et,it.normalized,it.colorSpace,C.isXRRenderTarget===!0),dt=le(C);e.renderbufferStorageMultisample(e.RENDERBUFFER,dt,vt,C.width,C.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+tt,e.RENDERBUFFER,H.__webglColorRenderbuffer[tt])}e.bindRenderbuffer(e.RENDERBUFFER,null),C.depthBuffer&&(H.__webglDepthRenderbuffer=e.createRenderbuffer(),se(H.__webglDepthRenderbuffer,C,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(ft){n.bindTexture(e.TEXTURE_CUBE_MAP,X.__webglTexture),kt(e.TEXTURE_CUBE_MAP,b);for(let tt=0;tt<6;tt++)if(b.mipmaps&&b.mipmaps.length>0)for(let it=0;it<b.mipmaps.length;it++)wt(H.__webglFramebuffer[tt][it],C,b,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,it);else wt(H.__webglFramebuffer[tt],C,b,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,0);f(b)&&g(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(mt){for(let tt=0,it=Q.length;tt<it;tt++){let gt=Q[tt],Et=i.get(gt),vt=e.TEXTURE_2D;(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(vt=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(vt,Et.__webglTexture),kt(vt,gt),wt(H.__webglFramebuffer,C,gt,e.COLOR_ATTACHMENT0+tt,vt,0),f(gt)&&g(vt)}n.unbindTexture()}else{let tt=e.TEXTURE_2D;if((C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(tt=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(tt,X.__webglTexture),kt(tt,b),b.mipmaps&&b.mipmaps.length>0)for(let it=0;it<b.mipmaps.length;it++)wt(H.__webglFramebuffer[it],C,b,e.COLOR_ATTACHMENT0,tt,it);else wt(H.__webglFramebuffer,C,b,e.COLOR_ATTACHMENT0,tt,0);f(b)&&g(tt),n.unbindTexture()}C.depthBuffer&&Ft(C)}function de(C){let b=C.textures;for(let H=0,X=b.length;H<X;H++){let Q=b[H];if(f(Q)){let ft=y(C),mt=i.get(Q).__webglTexture;n.bindTexture(ft,mt),g(ft),n.unbindTexture()}}}let Pe=[],pe=[];function We(C){if(C.samples>0){if(Le(C)===!1){let b=C.textures,H=C.width,X=C.height,Q=e.COLOR_BUFFER_BIT,ft=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,mt=i.get(C),tt=b.length>1;if(tt)for(let gt=0;gt<b.length;gt++)n.bindFramebuffer(e.FRAMEBUFFER,mt.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+gt,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,mt.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+gt,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,mt.__webglMultisampledFramebuffer);let it=C.texture.mipmaps;it&&it.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,mt.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,mt.__webglFramebuffer);for(let gt=0;gt<b.length;gt++){if(C.resolveDepthBuffer&&(C.depthBuffer&&(Q|=e.DEPTH_BUFFER_BIT),C.stencilBuffer&&C.resolveStencilBuffer&&(Q|=e.STENCIL_BUFFER_BIT)),tt){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,mt.__webglColorRenderbuffer[gt]);let Et=i.get(b[gt]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,Et,0)}e.blitFramebuffer(0,0,H,X,0,0,H,X,Q,e.NEAREST),c===!0&&(Pe.length=0,pe.length=0,Pe.push(e.COLOR_ATTACHMENT0+gt),C.depthBuffer&&C.resolveDepthBuffer===!1&&(Pe.push(ft),pe.push(ft),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,pe)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,Pe))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),tt)for(let gt=0;gt<b.length;gt++){n.bindFramebuffer(e.FRAMEBUFFER,mt.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+gt,e.RENDERBUFFER,mt.__webglColorRenderbuffer[gt]);let Et=i.get(b[gt]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,mt.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+gt,e.TEXTURE_2D,Et,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,mt.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.resolveDepthBuffer===!1&&c){let b=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[b])}}}function le(C){return Math.min(s.maxSamples,C.samples)}function Le(C){let b=i.get(C);return C.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&b.__useRenderToTexture!==!1}function P(C){let b=r.render.frame;h.get(C)!==b&&(h.set(C,b),C.update())}function sn(C,b){let H=C.colorSpace,X=C.format,Q=C.type;return C.isCompressedTexture===!0||C.isVideoTexture===!0||H!==Fl&&H!==ws&&(ne.getTransfer(H)===fe?(X!==yi||Q!==ii)&&It("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):zt("WebGLTextures: Unsupported texture color space:",H)),b}function oe(C){return typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement?(l.width=C.naturalWidth||C.width,l.height=C.naturalHeight||C.height):typeof VideoFrame<"u"&&C instanceof VideoFrame?(l.width=C.displayWidth,l.height=C.displayHeight):(l.width=C.width,l.height=C.height),l}this.allocateTextureUnit=B,this.resetTextureUnits=q,this.getTextureUnits=J,this.setTextureUnits=z,this.setTexture2D=j,this.setTexture2DArray=lt,this.setTexture3D=ut,this.setTextureCube=ct,this.rebindTextures=Jt,this.setupRenderTarget=Ht,this.updateRenderTargetMipmap=de,this.updateMultisampleRenderTarget=We,this.setupDepthRenderbuffer=Ft,this.setupFrameBufferTexture=wt,this.useMultisampledRTT=Le,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function i3(e,t){function n(i,s=ws){let a,r=ne.getTransfer(s);if(i===ii)return e.UNSIGNED_BYTE;if(i===wf)return e.UNSIGNED_SHORT_4_4_4_4;if(i===Cf)return e.UNSIGNED_SHORT_5_5_5_1;if(i===a0)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===r0)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===i0)return e.BYTE;if(i===s0)return e.SHORT;if(i===Mo)return e.UNSIGNED_SHORT;if(i===Af)return e.INT;if(i===Ci)return e.UNSIGNED_INT;if(i===Ri)return e.FLOAT;if(i===Ji)return e.HALF_FLOAT;if(i===o0)return e.ALPHA;if(i===l0)return e.RGB;if(i===yi)return e.RGBA;if(i===ki)return e.DEPTH_COMPONENT;if(i===ba)return e.DEPTH_STENCIL;if(i===c0)return e.RED;if(i===Rf)return e.RED_INTEGER;if(i===Sa)return e.RG;if(i===Df)return e.RG_INTEGER;if(i===Nf)return e.RGBA_INTEGER;if(i===hc||i===fc||i===dc||i===pc)if(r===fe)if(a=t.get("WEBGL_compressed_texture_s3tc_srgb"),a!==null){if(i===hc)return a.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===fc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===dc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===pc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(a=t.get("WEBGL_compressed_texture_s3tc"),a!==null){if(i===hc)return a.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===fc)return a.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===dc)return a.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===pc)return a.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Uf||i===Lf||i===If||i===Of)if(a=t.get("WEBGL_compressed_texture_pvrtc"),a!==null){if(i===Uf)return a.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Lf)return a.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===If)return a.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Of)return a.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Pf||i===zf||i===Bf||i===Ff||i===Vf||i===mc||i===Hf)if(a=t.get("WEBGL_compressed_texture_etc"),a!==null){if(i===Pf||i===zf)return r===fe?a.COMPRESSED_SRGB8_ETC2:a.COMPRESSED_RGB8_ETC2;if(i===Bf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:a.COMPRESSED_RGBA8_ETC2_EAC;if(i===Ff)return a.COMPRESSED_R11_EAC;if(i===Vf)return a.COMPRESSED_SIGNED_R11_EAC;if(i===mc)return a.COMPRESSED_RG11_EAC;if(i===Hf)return a.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Gf||i===kf||i===Xf||i===Wf||i===qf||i===Yf||i===Zf||i===Jf||i===Kf||i===jf||i===Qf||i===$f||i===td||i===ed)if(a=t.get("WEBGL_compressed_texture_astc"),a!==null){if(i===Gf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:a.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===kf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:a.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Xf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:a.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Wf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:a.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===qf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:a.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Yf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:a.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Zf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:a.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Jf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:a.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Kf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:a.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===jf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:a.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Qf)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:a.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===$f)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:a.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===td)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:a.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===ed)return r===fe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:a.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===nd||i===id||i===sd)if(a=t.get("EXT_texture_compression_bptc"),a!==null){if(i===nd)return r===fe?a.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:a.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===id)return a.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===sd)return a.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===ad||i===rd||i===gc||i===od)if(a=t.get("EXT_texture_compression_rgtc"),a!==null){if(i===ad)return a.COMPRESSED_RED_RGTC1_EXT;if(i===rd)return a.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===gc)return a.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===od)return a.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Eo?e.UNSIGNED_INT_24_8:e[i]!==void 0?e[i]:null}return{convert:n}}var s3=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,a3=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,N0=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,n){if(this.texture===null){let i=new Ql(t.texture);(t.depthNear!==n.depthNear||t.depthFar!==n.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=i}}getMesh(t){if(this.texture!==null&&this.mesh===null){let n=t.cameras[0].viewport,i=new ti({vertexShader:s3,fragmentShader:a3,uniforms:{depthColor:{value:this.texture},depthWidth:{value:n.z},depthHeight:{value:n.w}}});this.mesh=new je(new ma(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},U0=class extends Xi{constructor(t,n){super();let i=this,s=null,a=1,r=null,o="local-floor",c=1,l=null,h=null,d=null,u=null,p=null,m=null,S=typeof XRWebGLBinding<"u",v=new N0,f={},g=n.getContextAttributes(),y=null,_=null,T=[],A=[],w=new Lt,x=null,M=new xn;M.viewport=new Oe;let R=new xn;R.viewport=new Oe;let D=[M,R],I=new bf,q=null,J=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(K){let et=T[K];return et===void 0&&(et=new vo,T[K]=et),et.getTargetRaySpace()},this.getControllerGrip=function(K){let et=T[K];return et===void 0&&(et=new vo,T[K]=et),et.getGripSpace()},this.getHand=function(K){let et=T[K];return et===void 0&&(et=new vo,T[K]=et),et.getHandSpace()};function z(K){let et=A.indexOf(K.inputSource);if(et===-1)return;let nt=T[et];nt!==void 0&&(nt.update(K.inputSource,K.frame,l||r),nt.dispatchEvent({type:K.type,data:K.inputSource}))}function B(){s.removeEventListener("select",z),s.removeEventListener("selectstart",z),s.removeEventListener("selectend",z),s.removeEventListener("squeeze",z),s.removeEventListener("squeezestart",z),s.removeEventListener("squeezeend",z),s.removeEventListener("end",B),s.removeEventListener("inputsourceschange",V);for(let K=0;K<T.length;K++){let et=A[K];et!==null&&(A[K]=null,T[K].disconnect(et))}q=null,J=null,v.reset();for(let K in f)delete f[K];t.setRenderTarget(y),p=null,u=null,d=null,s=null,_=null,kt.stop(),i.isPresenting=!1,t.setPixelRatio(x),t.setSize(w.width,w.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(K){a=K,i.isPresenting===!0&&It("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(K){o=K,i.isPresenting===!0&&It("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||r},this.setReferenceSpace=function(K){l=K},this.getBaseLayer=function(){return u!==null?u:p},this.getBinding=function(){return d===null&&S&&(d=new XRWebGLBinding(s,n)),d},this.getFrame=function(){return m},this.getSession=function(){return s},this.setSession=async function(K){if(s=K,s!==null){if(y=t.getRenderTarget(),s.addEventListener("select",z),s.addEventListener("selectstart",z),s.addEventListener("selectend",z),s.addEventListener("squeeze",z),s.addEventListener("squeezestart",z),s.addEventListener("squeezeend",z),s.addEventListener("end",B),s.addEventListener("inputsourceschange",V),g.xrCompatible!==!0&&await n.makeXRCompatible(),x=t.getPixelRatio(),t.getSize(w),S&&"createProjectionLayer"in XRWebGLBinding.prototype){let nt=null,Mt=null,Ut=null;g.depth&&(Ut=g.stencil?n.DEPTH24_STENCIL8:n.DEPTH_COMPONENT24,nt=g.stencil?ba:ki,Mt=g.stencil?Eo:Ci);let wt={colorFormat:n.RGBA8,depthFormat:Ut,scaleFactor:a};d=this.getBinding(),u=d.createProjectionLayer(wt),s.updateRenderState({layers:[u]}),t.setPixelRatio(1),t.setSize(u.textureWidth,u.textureHeight,!1),_=new Qn(u.textureWidth,u.textureHeight,{format:yi,type:ii,depthTexture:new As(u.textureWidth,u.textureHeight,Mt,void 0,void 0,void 0,void 0,void 0,void 0,nt),stencilBuffer:g.stencil,colorSpace:t.outputColorSpace,samples:g.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{let nt={antialias:g.antialias,alpha:!0,depth:g.depth,stencil:g.stencil,framebufferScaleFactor:a};p=new XRWebGLLayer(s,n,nt),s.updateRenderState({baseLayer:p}),t.setPixelRatio(1),t.setSize(p.framebufferWidth,p.framebufferHeight,!1),_=new Qn(p.framebufferWidth,p.framebufferHeight,{format:yi,type:ii,colorSpace:t.outputColorSpace,stencilBuffer:g.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}_.isXRRenderTarget=!0,this.setFoveation(c),l=null,r=await s.requestReferenceSpace(o),kt.setContext(s),kt.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return v.getDepthTexture()};function V(K){for(let et=0;et<K.removed.length;et++){let nt=K.removed[et],Mt=A.indexOf(nt);Mt>=0&&(A[Mt]=null,T[Mt].disconnect(nt))}for(let et=0;et<K.added.length;et++){let nt=K.added[et],Mt=A.indexOf(nt);if(Mt===-1){for(let wt=0;wt<T.length;wt++)if(wt>=A.length){A.push(nt),Mt=wt;break}else if(A[wt]===null){A[wt]=nt,Mt=wt;break}if(Mt===-1)break}let Ut=T[Mt];Ut&&Ut.connect(nt)}}let j=new L,lt=new L;function ut(K,et,nt){j.setFromMatrixPosition(et.matrixWorld),lt.setFromMatrixPosition(nt.matrixWorld);let Mt=j.distanceTo(lt),Ut=et.projectionMatrix.elements,wt=nt.projectionMatrix.elements,se=Ut[14]/(Ut[10]-1),Pt=Ut[14]/(Ut[10]+1),Ft=(Ut[9]+1)/Ut[5],Jt=(Ut[9]-1)/Ut[5],Ht=(Ut[8]-1)/Ut[0],de=(wt[8]+1)/wt[0],Pe=se*Ht,pe=se*de,We=Mt/(-Ht+de),le=We*-Ht;if(et.matrixWorld.decompose(K.position,K.quaternion,K.scale),K.translateX(le),K.translateZ(We),K.matrixWorld.compose(K.position,K.quaternion,K.scale),K.matrixWorldInverse.copy(K.matrixWorld).invert(),Ut[10]===-1)K.projectionMatrix.copy(et.projectionMatrix),K.projectionMatrixInverse.copy(et.projectionMatrixInverse);else{let Le=se+We,P=Pt+We,sn=Pe-le,oe=pe+(Mt-le),C=Ft*Pt/P*Le,b=Jt*Pt/P*Le;K.projectionMatrix.makePerspective(sn,oe,C,b,Le,P),K.projectionMatrixInverse.copy(K.projectionMatrix).invert()}}function ct(K,et){et===null?K.matrixWorld.copy(K.matrix):K.matrixWorld.multiplyMatrices(et.matrixWorld,K.matrix),K.matrixWorldInverse.copy(K.matrixWorld).invert()}this.updateCamera=function(K){if(s===null)return;let et=K.near,nt=K.far;v.texture!==null&&(v.depthNear>0&&(et=v.depthNear),v.depthFar>0&&(nt=v.depthFar)),I.near=R.near=M.near=et,I.far=R.far=M.far=nt,(q!==I.near||J!==I.far)&&(s.updateRenderState({depthNear:I.near,depthFar:I.far}),q=I.near,J=I.far),I.layers.mask=K.layers.mask|6,M.layers.mask=I.layers.mask&-5,R.layers.mask=I.layers.mask&-3;let Mt=K.parent,Ut=I.cameras;ct(I,Mt);for(let wt=0;wt<Ut.length;wt++)ct(Ut[wt],Mt);Ut.length===2?ut(I,M,R):I.projectionMatrix.copy(M.projectionMatrix),ot(K,I,Mt)};function ot(K,et,nt){nt===null?K.matrix.copy(et.matrixWorld):(K.matrix.copy(nt.matrixWorld),K.matrix.invert(),K.matrix.multiply(et.matrixWorld)),K.matrix.decompose(K.position,K.quaternion,K.scale),K.updateMatrixWorld(!0),K.projectionMatrix.copy(et.projectionMatrix),K.projectionMatrixInverse.copy(et.projectionMatrixInverse),K.isPerspectiveCamera&&(K.fov=Xh*2*Math.atan(1/K.projectionMatrix.elements[5]),K.zoom=1)}this.getCamera=function(){return I},this.getFoveation=function(){if(!(u===null&&p===null))return c},this.setFoveation=function(K){c=K,u!==null&&(u.fixedFoveation=K),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=K)},this.hasDepthSensing=function(){return v.texture!==null},this.getDepthSensingMesh=function(){return v.getMesh(I)},this.getCameraTexture=function(K){return f[K]};let Nt=null;function Wt(K,et){if(h=et.getViewerPose(l||r),m=et,h!==null){let nt=h.views;p!==null&&(t.setRenderTargetFramebuffer(_,p.framebuffer),t.setRenderTarget(_));let Mt=!1;nt.length!==I.cameras.length&&(I.cameras.length=0,Mt=!0);for(let Pt=0;Pt<nt.length;Pt++){let Ft=nt[Pt],Jt=null;if(p!==null)Jt=p.getViewport(Ft);else{let de=d.getViewSubImage(u,Ft);Jt=de.viewport,Pt===0&&(t.setRenderTargetTextures(_,de.colorTexture,de.depthStencilTexture),t.setRenderTarget(_))}let Ht=D[Pt];Ht===void 0&&(Ht=new xn,Ht.layers.enable(Pt),Ht.viewport=new Oe,D[Pt]=Ht),Ht.matrix.fromArray(Ft.transform.matrix),Ht.matrix.decompose(Ht.position,Ht.quaternion,Ht.scale),Ht.projectionMatrix.fromArray(Ft.projectionMatrix),Ht.projectionMatrixInverse.copy(Ht.projectionMatrix).invert(),Ht.viewport.set(Jt.x,Jt.y,Jt.width,Jt.height),Pt===0&&(I.matrix.copy(Ht.matrix),I.matrix.decompose(I.position,I.quaternion,I.scale)),Mt===!0&&I.cameras.push(Ht)}let Ut=s.enabledFeatures;if(Ut&&Ut.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&S){d=i.getBinding();let Pt=d.getDepthInformation(nt[0]);Pt&&Pt.isValid&&Pt.texture&&v.init(Pt,s.renderState)}if(Ut&&Ut.includes("camera-access")&&S){t.state.unbindTexture(),d=i.getBinding();for(let Pt=0;Pt<nt.length;Pt++){let Ft=nt[Pt].camera;if(Ft){let Jt=f[Ft];Jt||(Jt=new Ql,f[Ft]=Jt);let Ht=d.getCameraImage(Ft);Jt.sourceTexture=Ht}}}}for(let nt=0;nt<T.length;nt++){let Mt=A[nt],Ut=T[nt];Mt!==null&&Ut!==void 0&&Ut.update(Mt,et,l||r)}Nt&&Nt(K,et),et.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:et}),m=null}let kt=new vM;kt.setAnimationLoop(Wt),this.setAnimationLoop=function(K){Nt=K},this.dispose=function(){}}},r3=new Ie,MM=new Vt;MM.set(-1,0,0,0,1,0,0,0,1);function o3(e,t){function n(v,f){v.matrixAutoUpdate===!0&&v.updateMatrix(),f.value.copy(v.matrix)}function i(v,f){f.color.getRGB(v.fogColor.value,p0(e)),f.isFog?(v.fogNear.value=f.near,v.fogFar.value=f.far):f.isFogExp2&&(v.fogDensity.value=f.density)}function s(v,f,g,y,_){f.isNodeMaterial?f.uniformsNeedUpdate=!1:f.isMeshBasicMaterial?a(v,f):f.isMeshLambertMaterial?(a(v,f),f.envMap&&(v.envMapIntensity.value=f.envMapIntensity)):f.isMeshToonMaterial?(a(v,f),d(v,f)):f.isMeshPhongMaterial?(a(v,f),h(v,f),f.envMap&&(v.envMapIntensity.value=f.envMapIntensity)):f.isMeshStandardMaterial?(a(v,f),u(v,f),f.isMeshPhysicalMaterial&&p(v,f,_)):f.isMeshMatcapMaterial?(a(v,f),m(v,f)):f.isMeshDepthMaterial?a(v,f):f.isMeshDistanceMaterial?(a(v,f),S(v,f)):f.isMeshNormalMaterial?a(v,f):f.isLineBasicMaterial?(r(v,f),f.isLineDashedMaterial&&o(v,f)):f.isPointsMaterial?c(v,f,g,y):f.isSpriteMaterial?l(v,f):f.isShadowMaterial?(v.color.value.copy(f.color),v.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function a(v,f){v.opacity.value=f.opacity,f.color&&v.diffuse.value.copy(f.color),f.emissive&&v.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(v.map.value=f.map,n(f.map,v.mapTransform)),f.alphaMap&&(v.alphaMap.value=f.alphaMap,n(f.alphaMap,v.alphaMapTransform)),f.bumpMap&&(v.bumpMap.value=f.bumpMap,n(f.bumpMap,v.bumpMapTransform),v.bumpScale.value=f.bumpScale,f.side===Cn&&(v.bumpScale.value*=-1)),f.normalMap&&(v.normalMap.value=f.normalMap,n(f.normalMap,v.normalMapTransform),v.normalScale.value.copy(f.normalScale),f.side===Cn&&v.normalScale.value.negate()),f.displacementMap&&(v.displacementMap.value=f.displacementMap,n(f.displacementMap,v.displacementMapTransform),v.displacementScale.value=f.displacementScale,v.displacementBias.value=f.displacementBias),f.emissiveMap&&(v.emissiveMap.value=f.emissiveMap,n(f.emissiveMap,v.emissiveMapTransform)),f.specularMap&&(v.specularMap.value=f.specularMap,n(f.specularMap,v.specularMapTransform)),f.alphaTest>0&&(v.alphaTest.value=f.alphaTest);let g=t.get(f),y=g.envMap,_=g.envMapRotation;y&&(v.envMap.value=y,v.envMapRotation.value.setFromMatrix4(r3.makeRotationFromEuler(_)).transpose(),y.isCubeTexture&&y.isRenderTargetTexture===!1&&v.envMapRotation.value.premultiply(MM),v.reflectivity.value=f.reflectivity,v.ior.value=f.ior,v.refractionRatio.value=f.refractionRatio),f.lightMap&&(v.lightMap.value=f.lightMap,v.lightMapIntensity.value=f.lightMapIntensity,n(f.lightMap,v.lightMapTransform)),f.aoMap&&(v.aoMap.value=f.aoMap,v.aoMapIntensity.value=f.aoMapIntensity,n(f.aoMap,v.aoMapTransform))}function r(v,f){v.diffuse.value.copy(f.color),v.opacity.value=f.opacity,f.map&&(v.map.value=f.map,n(f.map,v.mapTransform))}function o(v,f){v.dashSize.value=f.dashSize,v.totalSize.value=f.dashSize+f.gapSize,v.scale.value=f.scale}function c(v,f,g,y){v.diffuse.value.copy(f.color),v.opacity.value=f.opacity,v.size.value=f.size*g,v.scale.value=y*.5,f.map&&(v.map.value=f.map,n(f.map,v.uvTransform)),f.alphaMap&&(v.alphaMap.value=f.alphaMap,n(f.alphaMap,v.alphaMapTransform)),f.alphaTest>0&&(v.alphaTest.value=f.alphaTest)}function l(v,f){v.diffuse.value.copy(f.color),v.opacity.value=f.opacity,v.rotation.value=f.rotation,f.map&&(v.map.value=f.map,n(f.map,v.mapTransform)),f.alphaMap&&(v.alphaMap.value=f.alphaMap,n(f.alphaMap,v.alphaMapTransform)),f.alphaTest>0&&(v.alphaTest.value=f.alphaTest)}function h(v,f){v.specular.value.copy(f.specular),v.shininess.value=Math.max(f.shininess,1e-4)}function d(v,f){f.gradientMap&&(v.gradientMap.value=f.gradientMap)}function u(v,f){v.metalness.value=f.metalness,f.metalnessMap&&(v.metalnessMap.value=f.metalnessMap,n(f.metalnessMap,v.metalnessMapTransform)),v.roughness.value=f.roughness,f.roughnessMap&&(v.roughnessMap.value=f.roughnessMap,n(f.roughnessMap,v.roughnessMapTransform)),f.envMap&&(v.envMapIntensity.value=f.envMapIntensity)}function p(v,f,g){v.ior.value=f.ior,f.sheen>0&&(v.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),v.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(v.sheenColorMap.value=f.sheenColorMap,n(f.sheenColorMap,v.sheenColorMapTransform)),f.sheenRoughnessMap&&(v.sheenRoughnessMap.value=f.sheenRoughnessMap,n(f.sheenRoughnessMap,v.sheenRoughnessMapTransform))),f.clearcoat>0&&(v.clearcoat.value=f.clearcoat,v.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(v.clearcoatMap.value=f.clearcoatMap,n(f.clearcoatMap,v.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(v.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,n(f.clearcoatRoughnessMap,v.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(v.clearcoatNormalMap.value=f.clearcoatNormalMap,n(f.clearcoatNormalMap,v.clearcoatNormalMapTransform),v.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===Cn&&v.clearcoatNormalScale.value.negate())),f.dispersion>0&&(v.dispersion.value=f.dispersion),f.iridescence>0&&(v.iridescence.value=f.iridescence,v.iridescenceIOR.value=f.iridescenceIOR,v.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],v.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(v.iridescenceMap.value=f.iridescenceMap,n(f.iridescenceMap,v.iridescenceMapTransform)),f.iridescenceThicknessMap&&(v.iridescenceThicknessMap.value=f.iridescenceThicknessMap,n(f.iridescenceThicknessMap,v.iridescenceThicknessMapTransform))),f.transmission>0&&(v.transmission.value=f.transmission,v.transmissionSamplerMap.value=g.texture,v.transmissionSamplerSize.value.set(g.width,g.height),f.transmissionMap&&(v.transmissionMap.value=f.transmissionMap,n(f.transmissionMap,v.transmissionMapTransform)),v.thickness.value=f.thickness,f.thicknessMap&&(v.thicknessMap.value=f.thicknessMap,n(f.thicknessMap,v.thicknessMapTransform)),v.attenuationDistance.value=f.attenuationDistance,v.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(v.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(v.anisotropyMap.value=f.anisotropyMap,n(f.anisotropyMap,v.anisotropyMapTransform))),v.specularIntensity.value=f.specularIntensity,v.specularColor.value.copy(f.specularColor),f.specularColorMap&&(v.specularColorMap.value=f.specularColorMap,n(f.specularColorMap,v.specularColorMapTransform)),f.specularIntensityMap&&(v.specularIntensityMap.value=f.specularIntensityMap,n(f.specularIntensityMap,v.specularIntensityMapTransform))}function m(v,f){f.matcap&&(v.matcap.value=f.matcap)}function S(v,f){let g=t.get(f).light;v.referencePosition.value.setFromMatrixPosition(g.matrixWorld),v.nearDistance.value=g.shadow.camera.near,v.farDistance.value=g.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:s}}function l3(e,t,n,i){let s={},a={},r=[],o=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(_,T){let A=T.program;i.uniformBlockBinding(_,A)}function l(_,T){let A=s[_.id];A===void 0&&(v(_),A=h(_),s[_.id]=A,_.addEventListener("dispose",g));let w=T.program;i.updateUBOMapping(_,w);let x=t.render.frame;a[_.id]!==x&&(u(_),a[_.id]=x)}function h(_){let T=d();_.__bindingPointIndex=T;let A=e.createBuffer(),w=_.__size,x=_.usage;return e.bindBuffer(e.UNIFORM_BUFFER,A),e.bufferData(e.UNIFORM_BUFFER,w,x),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,T,A),A}function d(){for(let _=0;_<o;_++)if(r.indexOf(_)===-1)return r.push(_),_;return zt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(_){let T=s[_.id],A=_.uniforms,w=_.__cache;e.bindBuffer(e.UNIFORM_BUFFER,T);for(let x=0,M=A.length;x<M;x++){let R=A[x];if(Array.isArray(R))for(let D=0,I=R.length;D<I;D++)p(R[D],x,D,w);else p(R,x,0,w)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(_,T,A,w){if(S(_,T,A,w)===!0){let x=_.__offset,M=_.value;if(Array.isArray(M)){let R=0;for(let D=0;D<M.length;D++){let I=M[D],q=f(I);m(I,_.__data,R),typeof I!="number"&&typeof I!="boolean"&&!I.isMatrix3&&!ArrayBuffer.isView(I)&&(R+=q.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(M,_.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,x,_.__data)}}function m(_,T,A){typeof _=="number"||typeof _=="boolean"?T[0]=_:_.isMatrix3?(T[0]=_.elements[0],T[1]=_.elements[1],T[2]=_.elements[2],T[3]=0,T[4]=_.elements[3],T[5]=_.elements[4],T[6]=_.elements[5],T[7]=0,T[8]=_.elements[6],T[9]=_.elements[7],T[10]=_.elements[8],T[11]=0):ArrayBuffer.isView(_)?T.set(new _.constructor(_.buffer,_.byteOffset,T.length)):_.toArray(T,A)}function S(_,T,A,w){let x=_.value,M=T+"_"+A;if(w[M]===void 0)return typeof x=="number"||typeof x=="boolean"?w[M]=x:ArrayBuffer.isView(x)?w[M]=x.slice():w[M]=x.clone(),!0;{let R=w[M];if(typeof x=="number"||typeof x=="boolean"){if(R!==x)return w[M]=x,!0}else{if(ArrayBuffer.isView(x))return!0;if(R.equals(x)===!1)return R.copy(x),!0}}return!1}function v(_){let T=_.uniforms,A=0,w=16;for(let M=0,R=T.length;M<R;M++){let D=Array.isArray(T[M])?T[M]:[T[M]];for(let I=0,q=D.length;I<q;I++){let J=D[I],z=Array.isArray(J.value)?J.value:[J.value];for(let B=0,V=z.length;B<V;B++){let j=z[B],lt=f(j),ut=A%w,ct=ut%lt.boundary,ot=ut+ct;A+=ct,ot!==0&&w-ot<lt.storage&&(A+=w-ot),J.__data=new Float32Array(lt.storage/Float32Array.BYTES_PER_ELEMENT),J.__offset=A,A+=lt.storage}}}let x=A%w;return x>0&&(A+=w-x),_.__size=A,_.__cache={},this}function f(_){let T={boundary:0,storage:0};return typeof _=="number"||typeof _=="boolean"?(T.boundary=4,T.storage=4):_.isVector2?(T.boundary=8,T.storage=8):_.isVector3||_.isColor?(T.boundary=16,T.storage=12):_.isVector4?(T.boundary=16,T.storage=16):_.isMatrix3?(T.boundary=48,T.storage=48):_.isMatrix4?(T.boundary=64,T.storage=64):_.isTexture?It("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(_)?(T.boundary=16,T.storage=_.byteLength):It("WebGLRenderer: Unsupported uniform value type.",_),T}function g(_){let T=_.target;T.removeEventListener("dispose",g);let A=r.indexOf(T.__bindingPointIndex);r.splice(A,1),e.deleteBuffer(s[T.id]),delete s[T.id],delete a[T.id]}function y(){for(let _ in s)e.deleteBuffer(s[_]);r=[],s={},a={}}return{bind:c,update:l,dispose:y}}var c3=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Ki=null;function u3(){return Ki===null&&(Ki=new Zh(c3,16,16,Sa,Ji),Ki.name="DFG_LUT",Ki.minFilter=mn,Ki.magFilter=mn,Ki.wrapS=Hi,Ki.wrapT=Hi,Ki.generateMipmaps=!1,Ki.needsUpdate=!0),Ki}var pd=class{constructor(t={}){let{canvas:n=GS(),context:i=null,depth:s=!0,stencil:a=!1,alpha:r=!1,antialias:o=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:u=!1,outputBufferType:p=ii}=t;this.isWebGLRenderer=!0;let m;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");m=i.getContextAttributes().alpha}else m=r;let S=p,v=new Set([Nf,Df,Rf]),f=new Set([ii,Ci,Mo,Eo,wf,Cf]),g=new Uint32Array(4),y=new Int32Array(4),_=new L,T=null,A=null,w=[],x=[],M=null;this.domElement=n,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=wi,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let R=this,D=!1,I=null,q=null,J=null,z=null;this._outputColorSpace=wn;let B=0,V=0,j=null,lt=-1,ut=null,ct=new Oe,ot=new Oe,Nt=null,Wt=new te(0),kt=0,K=n.width,et=n.height,nt=1,Mt=null,Ut=null,wt=new Oe(0,0,K,et),se=new Oe(0,0,K,et),Pt=!1,Ft=new Kl,Jt=!1,Ht=!1,de=new Ie,Pe=new L,pe=new Oe,We={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},le=!1;function Le(){return j===null?nt:1}let P=i;function sn(E,F){return n.getContext(E,F)}try{let E={alpha:!0,depth:s,stencil:a,antialias:o,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in n&&n.setAttribute("data-engine",`three.js r${Sf}`),n.addEventListener("webglcontextlost",Gt,!1),n.addEventListener("webglcontextrestored",ae,!1),n.addEventListener("webglcontextcreationerror",Mn,!1),P===null){let F="webgl2";if(P=sn(F,E),P===null)throw sn(F)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(E){throw zt("WebGLRenderer: "+E.message),E}let oe,C,b,H,X,Q,ft,mt,tt,it,gt,Et,vt,dt,Ct,Tt,Ot,O,N,U,rt,$,Z;function ht(){oe=new vR(P),oe.init(),rt=new i3(P,oe),C=new cR(P,oe,t,rt),b=new e3(P,oe),C.reversedDepthBuffer&&u&&b.buffers.depth.setReversed(!0),q=P.createFramebuffer(),J=P.createFramebuffer(),z=P.createFramebuffer(),H=new xR(P),X=new H2,Q=new n3(P,oe,b,X,C,rt,H),ft=new gR(R),mt=new EA(P),$=new oR(P,mt),tt=new _R(P,mt,H,$),it=new SR(P,tt,mt,$,H),O=new bR(P,C,Q),Ct=new uR(X),gt=new V2(R,ft,oe,C,$,Ct),Et=new o3(R,X),vt=new k2,dt=new J2(oe),Ot=new rR(R,ft,b,it,m,c),Tt=new t3(R,it,C),Z=new l3(P,H,C,b),N=new lR(P,oe,H),U=new yR(P,oe,H),H.programs=gt.programs,R.capabilities=C,R.extensions=oe,R.properties=X,R.renderLists=vt,R.shadowMap=Tt,R.state=b,R.info=H}ht(),S!==ii&&(M=new ER(S,n.width,n.height,o,s,a));let pt=new U0(R,P);this.xr=pt,this.getContext=function(){return P},this.getContextAttributes=function(){return P.getContextAttributes()},this.forceContextLoss=function(){let E=oe.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){let E=oe.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return nt},this.setPixelRatio=function(E){E!==void 0&&(nt=E,this.setSize(K,et,!1))},this.getSize=function(E){return E.set(K,et)},this.setSize=function(E,F,W=!0){if(pt.isPresenting){It("WebGLRenderer: Can't change size while VR device is presenting.");return}K=E,et=F,n.width=Math.floor(E*nt),n.height=Math.floor(F*nt),W===!0&&(n.style.width=E+"px",n.style.height=F+"px"),M!==null&&M.setSize(n.width,n.height),this.setViewport(0,0,E,F)},this.getDrawingBufferSize=function(E){return E.set(K*nt,et*nt).floor()},this.setDrawingBufferSize=function(E,F,W){K=E,et=F,nt=W,n.width=Math.floor(E*W),n.height=Math.floor(F*W),this.setViewport(0,0,E,F)},this.setEffects=function(E){if(S===ii){zt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(E){for(let F=0;F<E.length;F++)if(E[F].isOutputPass===!0){It("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}M.setEffects(E||[])},this.getCurrentViewport=function(E){return E.copy(ct)},this.getViewport=function(E){return E.copy(wt)},this.setViewport=function(E,F,W,G){E.isVector4?wt.set(E.x,E.y,E.z,E.w):wt.set(E,F,W,G),b.viewport(ct.copy(wt).multiplyScalar(nt).round())},this.getScissor=function(E){return E.copy(se)},this.setScissor=function(E,F,W,G){E.isVector4?se.set(E.x,E.y,E.z,E.w):se.set(E,F,W,G),b.scissor(ot.copy(se).multiplyScalar(nt).round())},this.getScissorTest=function(){return Pt},this.setScissorTest=function(E){b.setScissorTest(Pt=E)},this.setOpaqueSort=function(E){Mt=E},this.setTransparentSort=function(E){Ut=E},this.getClearColor=function(E){return E.copy(Ot.getClearColor())},this.setClearColor=function(){Ot.setClearColor(...arguments)},this.getClearAlpha=function(){return Ot.getClearAlpha()},this.setClearAlpha=function(){Ot.setClearAlpha(...arguments)},this.clear=function(E=!0,F=!0,W=!0){let G=0;if(E){let k=!1;if(j!==null){let xt=j.texture.format;k=v.has(xt)}if(k){let xt=j.texture.type,St=f.has(xt),yt=Ot.getClearColor(),At=Ot.getClearAlpha(),Rt=yt.r,qt=yt.g,Kt=yt.b;St?(g[0]=Rt,g[1]=qt,g[2]=Kt,g[3]=At,P.clearBufferuiv(P.COLOR,0,g)):(y[0]=Rt,y[1]=qt,y[2]=Kt,y[3]=At,P.clearBufferiv(P.COLOR,0,y))}else G|=P.COLOR_BUFFER_BIT}F&&(G|=P.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),W&&(G|=P.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),G!==0&&P.clear(G)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(E){E.setRenderer(this),I=E},this.dispose=function(){n.removeEventListener("webglcontextlost",Gt,!1),n.removeEventListener("webglcontextrestored",ae,!1),n.removeEventListener("webglcontextcreationerror",Mn,!1),Ot.dispose(),vt.dispose(),dt.dispose(),X.dispose(),ft.dispose(),it.dispose(),$.dispose(),Z.dispose(),gt.dispose(),pt.dispose(),pt.removeEventListener("sessionstart",V0),pt.removeEventListener("sessionend",H0),Ta.stop()};function Gt(E){E.preventDefault(),f0("WebGLRenderer: Context Lost."),D=!0}function ae(){f0("WebGLRenderer: Context Restored."),D=!1;let E=H.autoReset,F=Tt.enabled,W=Tt.autoUpdate,G=Tt.needsUpdate,k=Tt.type;ht(),H.autoReset=E,Tt.enabled=F,Tt.autoUpdate=W,Tt.needsUpdate=G,Tt.type=k}function Mn(E){zt("WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function zn(E){let F=E.target;F.removeEventListener("dispose",zn),LM(F)}function LM(E){IM(E),X.remove(E)}function IM(E){let F=X.get(E).programs;F!==void 0&&(F.forEach(function(W){gt.releaseProgram(W)}),E.isShaderMaterial&&gt.releaseShaderCache(E))}this.renderBufferDirect=function(E,F,W,G,k,xt){F===null&&(F=We);let St=k.isMesh&&k.matrixWorld.determinantAffine()<0,yt=zM(E,F,W,G,k);b.setMaterial(G,St);let At=W.index,Rt=1;if(G.wireframe===!0){if(At=tt.getWireframeAttribute(W),At===void 0)return;Rt=2}let qt=W.drawRange,Kt=W.attributes.position,Dt=qt.start*Rt,ve=(qt.start+qt.count)*Rt;xt!==null&&(Dt=Math.max(Dt,xt.start*Rt),ve=Math.min(ve,(xt.start+xt.count)*Rt)),At!==null?(Dt=Math.max(Dt,0),ve=Math.min(ve,At.count)):Kt!=null&&(Dt=Math.max(Dt,0),ve=Math.min(ve,Kt.count));let He=ve-Dt;if(He<0||He===1/0)return;$.setup(k,G,yt,W,At);let ze,xe=N;if(At!==null&&(ze=mt.get(At),xe=U,xe.setIndex(ze)),k.isMesh)G.wireframe===!0?(b.setLineWidth(G.wireframeLinewidth*Le()),xe.setMode(P.LINES)):xe.setMode(P.TRIANGLES);else if(k.isLine){let gn=G.linewidth;gn===void 0&&(gn=1),b.setLineWidth(gn*Le()),k.isLineSegments?xe.setMode(P.LINES):k.isLineLoop?xe.setMode(P.LINE_LOOP):xe.setMode(P.LINE_STRIP)}else k.isPoints?xe.setMode(P.POINTS):k.isSprite&&xe.setMode(P.TRIANGLES);if(k.isBatchedMesh)if(oe.get("WEBGL_multi_draw"))xe.renderMultiDraw(k._multiDrawStarts,k._multiDrawCounts,k._multiDrawCount);else{let gn=k._multiDrawStarts,bt=k._multiDrawCounts,Bn=k._multiDrawCount,ce=At?mt.get(At).bytesPerElement:1,si=X.get(G).currentProgram.getUniforms();for(let Di=0;Di<Bn;Di++)si.setValue(P,"_gl_DrawID",Di),xe.render(gn[Di]/ce,bt[Di])}else if(k.isInstancedMesh)xe.renderInstances(Dt,He,k.count);else if(W.isInstancedBufferGeometry){let gn=W._maxInstanceCount!==void 0?W._maxInstanceCount:1/0,bt=Math.min(W.instanceCount,gn);xe.renderInstances(Dt,He,bt)}else xe.render(Dt,He)};function F0(E,F,W){E.transparent===!0&&E.side===ni&&E.forceSinglePass===!1?(E.side=Cn,E.needsUpdate=!0,Ac(E,F,W),E.side=Ts,E.needsUpdate=!0,Ac(E,F,W),E.side=ni):Ac(E,F,W)}this.compile=function(E,F,W=null){W===null&&(W=E),A=dt.get(W),A.init(F),x.push(A),W.traverseVisible(function(k){k.isLight&&k.layers.test(F.layers)&&(A.pushLight(k),k.castShadow&&A.pushShadow(k))}),E!==W&&E.traverseVisible(function(k){k.isLight&&k.layers.test(F.layers)&&(A.pushLight(k),k.castShadow&&A.pushShadow(k))}),A.setupLights();let G=new Set;return E.traverse(function(k){if(!(k.isMesh||k.isPoints||k.isLine||k.isSprite))return;let xt=k.material;if(xt)if(Array.isArray(xt))for(let St=0;St<xt.length;St++){let yt=xt[St];F0(yt,W,k),G.add(yt)}else F0(xt,W,k),G.add(xt)}),A=x.pop(),G},this.compileAsync=function(E,F,W=null){let G=this.compile(E,F,W);return new Promise(k=>{function xt(){if(G.forEach(function(St){X.get(St).currentProgram.isReady()&&G.delete(St)}),G.size===0){k(E);return}setTimeout(xt,10)}oe.get("KHR_parallel_shader_compile")!==null?xt():setTimeout(xt,10)})};let Sd=null;function OM(E){Sd&&Sd(E)}function V0(){Ta.stop()}function H0(){Ta.start()}let Ta=new vM;Ta.setAnimationLoop(OM),typeof self<"u"&&Ta.setContext(self),this.setAnimationLoop=function(E){Sd=E,pt.setAnimationLoop(E),E===null?Ta.stop():Ta.start()},pt.addEventListener("sessionstart",V0),pt.addEventListener("sessionend",H0),this.render=function(E,F){if(F!==void 0&&F.isCamera!==!0){zt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(D===!0)return;I!==null&&I.renderStart(E,F);let W=pt.enabled===!0&&pt.isPresenting===!0,G=M!==null&&(j===null||W)&&M.begin(R,j);if(E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),F.parent===null&&F.matrixWorldAutoUpdate===!0&&F.updateMatrixWorld(),pt.enabled===!0&&pt.isPresenting===!0&&(M===null||M.isCompositing()===!1)&&(pt.cameraAutoUpdate===!0&&pt.updateCamera(F),F=pt.getCamera()),E.isScene===!0&&E.onBeforeRender(R,E,F,j),A=dt.get(E,x.length),A.init(F),A.state.textureUnits=Q.getTextureUnits(),x.push(A),de.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),Ft.setFromProjectionMatrix(de,Ai,F.reversedDepth),Ht=this.localClippingEnabled,Jt=Ct.init(this.clippingPlanes,Ht),T=vt.get(E,w.length),T.init(),w.push(T),pt.enabled===!0&&pt.isPresenting===!0){let St=R.xr.getDepthSensingMesh();St!==null&&Md(St,F,-1/0,R.sortObjects)}Md(E,F,0,R.sortObjects),T.finish(),R.sortObjects===!0&&T.sort(Mt,Ut,F.reversedDepth),le=pt.enabled===!1||pt.isPresenting===!1||pt.hasDepthSensing()===!1,le&&Ot.addToRenderList(T,E),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Jt===!0&&Ct.beginShadows();let k=A.state.shadowsArray;if(Tt.render(k,E,F),Jt===!0&&Ct.endShadows(),(G&&M.hasRenderPass())===!1){let St=T.opaque,yt=T.transmissive;if(A.setupLights(),F.isArrayCamera){let At=F.cameras;if(yt.length>0)for(let Rt=0,qt=At.length;Rt<qt;Rt++){let Kt=At[Rt];k0(St,yt,E,Kt)}le&&Ot.render(E);for(let Rt=0,qt=At.length;Rt<qt;Rt++){let Kt=At[Rt];G0(T,E,Kt,Kt.viewport)}}else yt.length>0&&k0(St,yt,E,F),le&&Ot.render(E),G0(T,E,F)}j!==null&&V===0&&(Q.updateMultisampleRenderTarget(j),Q.updateRenderTargetMipmap(j)),G&&M.end(R),E.isScene===!0&&E.onAfterRender(R,E,F),$.resetDefaultState(),lt=-1,ut=null,x.pop(),x.length>0?(A=x[x.length-1],Q.setTextureUnits(A.state.textureUnits),Jt===!0&&Ct.setGlobalState(R.clippingPlanes,A.state.camera)):A=null,w.pop(),w.length>0?T=w[w.length-1]:T=null,I!==null&&I.renderEnd()};function Md(E,F,W,G){if(E.visible===!1)return;if(E.layers.test(F.layers)){if(E.isGroup)W=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(F);else if(E.isLightProbeGrid)A.pushLightProbeGrid(E);else if(E.isLight)A.pushLight(E),E.castShadow&&A.pushShadow(E);else if(E.isSprite){if(!E.frustumCulled||Ft.intersectsSprite(E)){G&&pe.setFromMatrixPosition(E.matrixWorld).applyMatrix4(de);let St=it.update(E),yt=E.material;yt.visible&&T.push(E,St,yt,W,pe.z,null)}}else if((E.isMesh||E.isLine||E.isPoints)&&(!E.frustumCulled||Ft.intersectsObject(E))){let St=it.update(E),yt=E.material;if(G&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),pe.copy(E.boundingSphere.center)):(St.boundingSphere===null&&St.computeBoundingSphere(),pe.copy(St.boundingSphere.center)),pe.applyMatrix4(E.matrixWorld).applyMatrix4(de)),Array.isArray(yt)){let At=St.groups;for(let Rt=0,qt=At.length;Rt<qt;Rt++){let Kt=At[Rt],Dt=yt[Kt.materialIndex];Dt&&Dt.visible&&T.push(E,St,Dt,W,pe.z,Kt)}}else yt.visible&&T.push(E,St,yt,W,pe.z,null)}}let xt=E.children;for(let St=0,yt=xt.length;St<yt;St++)Md(xt[St],F,W,G)}function G0(E,F,W,G){let{opaque:k,transmissive:xt,transparent:St}=E;A.setupLightsView(W),Jt===!0&&Ct.setGlobalState(R.clippingPlanes,W),G&&b.viewport(ct.copy(G)),k.length>0&&Tc(k,F,W),xt.length>0&&Tc(xt,F,W),St.length>0&&Tc(St,F,W),b.buffers.depth.setTest(!0),b.buffers.depth.setMask(!0),b.buffers.color.setMask(!0),b.setPolygonOffset(!1)}function k0(E,F,W,G){if((W.isScene===!0?W.overrideMaterial:null)!==null)return;if(A.state.transmissionRenderTarget[G.id]===void 0){let Dt=oe.has("EXT_color_buffer_half_float")||oe.has("EXT_color_buffer_float");A.state.transmissionRenderTarget[G.id]=new Qn(1,1,{generateMipmaps:!0,type:Dt?Ji:ii,minFilter:xa,samples:Math.max(4,C.samples),stencilBuffer:a,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:ne.workingColorSpace})}let xt=A.state.transmissionRenderTarget[G.id],St=G.viewport||ct;xt.setSize(St.z*R.transmissionResolutionScale,St.w*R.transmissionResolutionScale);let yt=R.getRenderTarget(),At=R.getActiveCubeFace(),Rt=R.getActiveMipmapLevel();R.setRenderTarget(xt),R.getClearColor(Wt),kt=R.getClearAlpha(),kt<1&&R.setClearColor(16777215,.5),R.clear(),le&&Ot.render(W);let qt=R.toneMapping;R.toneMapping=wi;let Kt=G.viewport;if(G.viewport!==void 0&&(G.viewport=void 0),A.setupLightsView(G),Jt===!0&&Ct.setGlobalState(R.clippingPlanes,G),Tc(E,W,G),Q.updateMultisampleRenderTarget(xt),Q.updateRenderTargetMipmap(xt),oe.has("WEBGL_multisampled_render_to_texture")===!1){let Dt=!1;for(let ve=0,He=F.length;ve<He;ve++){let ze=F[ve],{object:xe,geometry:gn,material:bt,group:Bn}=ze;if(bt.side===ni&&xe.layers.test(G.layers)){let ce=bt.side;bt.side=Cn,bt.needsUpdate=!0,X0(xe,W,G,gn,bt,Bn),bt.side=ce,bt.needsUpdate=!0,Dt=!0}}Dt===!0&&(Q.updateMultisampleRenderTarget(xt),Q.updateRenderTargetMipmap(xt))}R.setRenderTarget(yt,At,Rt),R.setClearColor(Wt,kt),Kt!==void 0&&(G.viewport=Kt),R.toneMapping=qt}function Tc(E,F,W){let G=F.isScene===!0?F.overrideMaterial:null;for(let k=0,xt=E.length;k<xt;k++){let St=E[k],{object:yt,geometry:At,group:Rt}=St,qt=St.material;qt.allowOverride===!0&&G!==null&&(qt=G),yt.layers.test(W.layers)&&X0(yt,F,W,At,qt,Rt)}}function X0(E,F,W,G,k,xt){E.onBeforeRender(R,F,W,G,k,xt),E.modelViewMatrix.multiplyMatrices(W.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),k.onBeforeRender(R,F,W,G,E,xt),k.transparent===!0&&k.side===ni&&k.forceSinglePass===!1?(k.side=Cn,k.needsUpdate=!0,R.renderBufferDirect(W,F,G,k,E,xt),k.side=Ts,k.needsUpdate=!0,R.renderBufferDirect(W,F,G,k,E,xt),k.side=ni):R.renderBufferDirect(W,F,G,k,E,xt),E.onAfterRender(R,F,W,G,k,xt)}function Ac(E,F,W){F.isScene!==!0&&(F=We);let G=X.get(E),k=A.state.lights,xt=A.state.shadowsArray,St=k.state.version,yt=gt.getParameters(E,k.state,xt,F,W,A.state.lightProbeGridArray),At=gt.getProgramCacheKey(yt),Rt=G.programs;G.environment=E.isMeshStandardMaterial||E.isMeshLambertMaterial||E.isMeshPhongMaterial?F.environment:null,G.fog=F.fog;let qt=E.isMeshStandardMaterial||E.isMeshLambertMaterial&&!E.envMap||E.isMeshPhongMaterial&&!E.envMap;G.envMap=ft.get(E.envMap||G.environment,qt),G.envMapRotation=G.environment!==null&&E.envMap===null?F.environmentRotation:E.envMapRotation,Rt===void 0&&(E.addEventListener("dispose",zn),Rt=new Map,G.programs=Rt);let Kt=Rt.get(At);if(Kt!==void 0){if(G.currentProgram===Kt&&G.lightsStateVersion===St)return q0(E,yt),Kt}else yt.uniforms=gt.getUniforms(E),I!==null&&E.isNodeMaterial&&I.build(E,W,yt),E.onBeforeCompile(yt,R),Kt=gt.acquireProgram(yt,At),Rt.set(At,Kt),G.uniforms=yt.uniforms;let Dt=G.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(Dt.clippingPlanes=Ct.uniform),q0(E,yt),G.needsLights=FM(E),G.lightsStateVersion=St,G.needsLights&&(Dt.ambientLightColor.value=k.state.ambient,Dt.lightProbe.value=k.state.probe,Dt.directionalLights.value=k.state.directional,Dt.directionalLightShadows.value=k.state.directionalShadow,Dt.spotLights.value=k.state.spot,Dt.spotLightShadows.value=k.state.spotShadow,Dt.rectAreaLights.value=k.state.rectArea,Dt.ltc_1.value=k.state.rectAreaLTC1,Dt.ltc_2.value=k.state.rectAreaLTC2,Dt.pointLights.value=k.state.point,Dt.pointLightShadows.value=k.state.pointShadow,Dt.hemisphereLights.value=k.state.hemi,Dt.directionalShadowMatrix.value=k.state.directionalShadowMatrix,Dt.spotLightMatrix.value=k.state.spotLightMatrix,Dt.spotLightMap.value=k.state.spotLightMap,Dt.pointShadowMatrix.value=k.state.pointShadowMatrix),G.lightProbeGrid=A.state.lightProbeGridArray.length>0,G.currentProgram=Kt,G.uniformsList=null,Kt}function W0(E){if(E.uniformsList===null){let F=E.currentProgram.getUniforms();E.uniformsList=Ao.seqWithValue(F.seq,E.uniforms)}return E.uniformsList}function q0(E,F){let W=X.get(E);W.outputColorSpace=F.outputColorSpace,W.batching=F.batching,W.batchingColor=F.batchingColor,W.instancing=F.instancing,W.instancingColor=F.instancingColor,W.instancingMorph=F.instancingMorph,W.skinning=F.skinning,W.morphTargets=F.morphTargets,W.morphNormals=F.morphNormals,W.morphColors=F.morphColors,W.morphTargetsCount=F.morphTargetsCount,W.numClippingPlanes=F.numClippingPlanes,W.numIntersection=F.numClipIntersection,W.vertexAlphas=F.vertexAlphas,W.vertexTangents=F.vertexTangents,W.toneMapping=F.toneMapping}function PM(E,F){if(E.length===0)return null;if(E.length===1)return E[0].texture!==null?E[0]:null;_.setFromMatrixPosition(F.matrixWorld);for(let W=0,G=E.length;W<G;W++){let k=E[W];if(k.texture!==null&&k.boundingBox.containsPoint(_))return k}return null}function zM(E,F,W,G,k){F.isScene!==!0&&(F=We),Q.resetTextureUnits();let xt=F.fog,St=G.isMeshStandardMaterial||G.isMeshLambertMaterial||G.isMeshPhongMaterial?F.environment:null,yt=j===null?R.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:ne.workingColorSpace,At=G.isMeshStandardMaterial||G.isMeshLambertMaterial&&!G.envMap||G.isMeshPhongMaterial&&!G.envMap,Rt=ft.get(G.envMap||St,At),qt=G.vertexColors===!0&&!!W.attributes.color&&W.attributes.color.itemSize===4,Kt=!!W.attributes.tangent&&(!!G.normalMap||G.anisotropy>0),Dt=!!W.morphAttributes.position,ve=!!W.morphAttributes.normal,He=!!W.morphAttributes.color,ze=wi;G.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(ze=R.toneMapping);let xe=W.morphAttributes.position||W.morphAttributes.normal||W.morphAttributes.color,gn=xe!==void 0?xe.length:0,bt=X.get(G),Bn=A.state.lights;if(Jt===!0&&(Ht===!0||E!==ut)){let Me=E===ut&&G.id===lt;Ct.setState(G,E,Me)}let ce=!1;G.version===bt.__version?(bt.needsLights&&bt.lightsStateVersion!==Bn.state.version||bt.outputColorSpace!==yt||k.isBatchedMesh&&bt.batching===!1||!k.isBatchedMesh&&bt.batching===!0||k.isBatchedMesh&&bt.batchingColor===!0&&k.colorTexture===null||k.isBatchedMesh&&bt.batchingColor===!1&&k.colorTexture!==null||k.isInstancedMesh&&bt.instancing===!1||!k.isInstancedMesh&&bt.instancing===!0||k.isSkinnedMesh&&bt.skinning===!1||!k.isSkinnedMesh&&bt.skinning===!0||k.isInstancedMesh&&bt.instancingColor===!0&&k.instanceColor===null||k.isInstancedMesh&&bt.instancingColor===!1&&k.instanceColor!==null||k.isInstancedMesh&&bt.instancingMorph===!0&&k.morphTexture===null||k.isInstancedMesh&&bt.instancingMorph===!1&&k.morphTexture!==null||bt.envMap!==Rt||G.fog===!0&&bt.fog!==xt||bt.numClippingPlanes!==void 0&&(bt.numClippingPlanes!==Ct.numPlanes||bt.numIntersection!==Ct.numIntersection)||bt.vertexAlphas!==qt||bt.vertexTangents!==Kt||bt.morphTargets!==Dt||bt.morphNormals!==ve||bt.morphColors!==He||bt.toneMapping!==ze||bt.morphTargetsCount!==gn||!!bt.lightProbeGrid!=A.state.lightProbeGridArray.length>0)&&(ce=!0):(ce=!0,bt.__version=G.version);let si=bt.currentProgram;ce===!0&&(si=Ac(G,F,k),I&&G.isNodeMaterial&&I.onUpdateProgram(G,si,bt));let Di=!1,Cs=!1,or=!1,be=si.getUniforms(),Ge=bt.uniforms;if(b.useProgram(si.program)&&(Di=!0,Cs=!0,or=!0),G.id!==lt&&(lt=G.id,Cs=!0),bt.needsLights){let Me=PM(A.state.lightProbeGridArray,k);bt.lightProbeGrid!==Me&&(bt.lightProbeGrid=Me,Cs=!0)}if(Di||ut!==E){b.buffers.depth.getReversed()&&E.reversedDepth!==!0&&(E._reversedDepth=!0,E.updateProjectionMatrix()),be.setValue(P,"projectionMatrix",E.projectionMatrix),be.setValue(P,"viewMatrix",E.matrixWorldInverse);let Ds=be.map.cameraPosition;Ds!==void 0&&Ds.setValue(P,Pe.setFromMatrixPosition(E.matrixWorld)),C.logarithmicDepthBuffer&&be.setValue(P,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(G.isMeshPhongMaterial||G.isMeshToonMaterial||G.isMeshLambertMaterial||G.isMeshBasicMaterial||G.isMeshStandardMaterial||G.isShaderMaterial)&&be.setValue(P,"isOrthographic",E.isOrthographicCamera===!0),ut!==E&&(ut=E,Cs=!0,or=!0)}if(bt.needsLights&&(Bn.state.directionalShadowMap.length>0&&be.setValue(P,"directionalShadowMap",Bn.state.directionalShadowMap,Q),Bn.state.spotShadowMap.length>0&&be.setValue(P,"spotShadowMap",Bn.state.spotShadowMap,Q),Bn.state.pointShadowMap.length>0&&be.setValue(P,"pointShadowMap",Bn.state.pointShadowMap,Q)),k.isSkinnedMesh){be.setOptional(P,k,"bindMatrix"),be.setOptional(P,k,"bindMatrixInverse");let Me=k.skeleton;Me&&(Me.boneTexture===null&&Me.computeBoneTexture(),be.setValue(P,"boneTexture",Me.boneTexture,Q))}k.isBatchedMesh&&(be.setOptional(P,k,"batchingTexture"),be.setValue(P,"batchingTexture",k._matricesTexture,Q),be.setOptional(P,k,"batchingIdTexture"),be.setValue(P,"batchingIdTexture",k._indirectTexture,Q),be.setOptional(P,k,"batchingColorTexture"),k._colorsTexture!==null&&be.setValue(P,"batchingColorTexture",k._colorsTexture,Q));let Rs=W.morphAttributes;if((Rs.position!==void 0||Rs.normal!==void 0||Rs.color!==void 0)&&O.update(k,W,si),(Cs||bt.receiveShadow!==k.receiveShadow)&&(bt.receiveShadow=k.receiveShadow,be.setValue(P,"receiveShadow",k.receiveShadow)),(G.isMeshStandardMaterial||G.isMeshLambertMaterial||G.isMeshPhongMaterial)&&G.envMap===null&&F.environment!==null&&(Ge.envMapIntensity.value=F.environmentIntensity),Ge.dfgLUT!==void 0&&(Ge.dfgLUT.value=u3()),Cs){if(be.setValue(P,"toneMappingExposure",R.toneMappingExposure),bt.needsLights&&BM(Ge,or),xt&&G.fog===!0&&Et.refreshFogUniforms(Ge,xt),Et.refreshMaterialUniforms(Ge,G,nt,et,A.state.transmissionRenderTarget[E.id]),bt.needsLights&&bt.lightProbeGrid){let Me=bt.lightProbeGrid;Ge.probesSH.value=Me.texture,Ge.probesMin.value.copy(Me.boundingBox.min),Ge.probesMax.value.copy(Me.boundingBox.max),Ge.probesResolution.value.copy(Me.resolution)}Ao.upload(P,W0(bt),Ge,Q)}if(G.isShaderMaterial&&G.uniformsNeedUpdate===!0&&(Ao.upload(P,W0(bt),Ge,Q),G.uniformsNeedUpdate=!1),G.isSpriteMaterial&&be.setValue(P,"center",k.center),be.setValue(P,"modelViewMatrix",k.modelViewMatrix),be.setValue(P,"normalMatrix",k.normalMatrix),be.setValue(P,"modelMatrix",k.matrixWorld),G.uniformsGroups!==void 0){let Me=G.uniformsGroups;for(let Ds=0,lr=Me.length;Ds<lr;Ds++){let Y0=Me[Ds];Z.update(Y0,si),Z.bind(Y0,si)}}return si}function BM(E,F){E.ambientLightColor.needsUpdate=F,E.lightProbe.needsUpdate=F,E.directionalLights.needsUpdate=F,E.directionalLightShadows.needsUpdate=F,E.pointLights.needsUpdate=F,E.pointLightShadows.needsUpdate=F,E.spotLights.needsUpdate=F,E.spotLightShadows.needsUpdate=F,E.rectAreaLights.needsUpdate=F,E.hemisphereLights.needsUpdate=F}function FM(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return B},this.getActiveMipmapLevel=function(){return V},this.getRenderTarget=function(){return j},this.setRenderTargetTextures=function(E,F,W){let G=X.get(E);G.__autoAllocateDepthBuffer=E.resolveDepthBuffer===!1,G.__autoAllocateDepthBuffer===!1&&(G.__useRenderToTexture=!1),X.get(E.texture).__webglTexture=F,X.get(E.depthTexture).__webglTexture=G.__autoAllocateDepthBuffer?void 0:W,G.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(E,F){let W=X.get(E);W.__webglFramebuffer=F,W.__useDefaultFramebuffer=F===void 0},this.setRenderTarget=function(E,F=0,W=0){j=E,B=F,V=W;let G=null,k=!1,xt=!1;if(E){let yt=X.get(E);if(yt.__useDefaultFramebuffer!==void 0){b.bindFramebuffer(P.FRAMEBUFFER,yt.__webglFramebuffer),ct.copy(E.viewport),ot.copy(E.scissor),Nt=E.scissorTest,b.viewport(ct),b.scissor(ot),b.setScissorTest(Nt),lt=-1;return}else if(yt.__webglFramebuffer===void 0)Q.setupRenderTarget(E);else if(yt.__hasExternalTextures)Q.rebindTextures(E,X.get(E.texture).__webglTexture,X.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){let qt=E.depthTexture;if(yt.__boundDepthTexture!==qt){if(qt!==null&&X.has(qt)&&(E.width!==qt.image.width||E.height!==qt.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Q.setupDepthRenderbuffer(E)}}let At=E.texture;(At.isData3DTexture||At.isDataArrayTexture||At.isCompressedArrayTexture)&&(xt=!0);let Rt=X.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(Rt[F])?G=Rt[F][W]:G=Rt[F],k=!0):E.samples>0&&Q.useMultisampledRTT(E)===!1?G=X.get(E).__webglMultisampledFramebuffer:Array.isArray(Rt)?G=Rt[W]:G=Rt,ct.copy(E.viewport),ot.copy(E.scissor),Nt=E.scissorTest}else ct.copy(wt).multiplyScalar(nt).floor(),ot.copy(se).multiplyScalar(nt).floor(),Nt=Pt;if(W!==0&&(G=q),b.bindFramebuffer(P.FRAMEBUFFER,G)&&b.drawBuffers(E,G),b.viewport(ct),b.scissor(ot),b.setScissorTest(Nt),k){let yt=X.get(E.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_CUBE_MAP_POSITIVE_X+F,yt.__webglTexture,W)}else if(xt){let yt=F;for(let At=0;At<E.textures.length;At++){let Rt=X.get(E.textures[At]);P.framebufferTextureLayer(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0+At,Rt.__webglTexture,W,yt)}}else if(E!==null&&W!==0){let yt=X.get(E.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,yt.__webglTexture,W)}lt=-1},this.readRenderTargetPixels=function(E,F,W,G,k,xt,St,yt=0){if(!(E&&E.isWebGLRenderTarget)){zt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let At=X.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&St!==void 0&&(At=At[St]),At){b.bindFramebuffer(P.FRAMEBUFFER,At);try{let Rt=E.textures[yt],qt=Rt.format,Kt=Rt.type;if(E.textures.length>1&&P.readBuffer(P.COLOR_ATTACHMENT0+yt),!C.textureFormatReadable(qt)){zt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!C.textureTypeReadable(Kt)){zt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}F>=0&&F<=E.width-G&&W>=0&&W<=E.height-k&&P.readPixels(F,W,G,k,rt.convert(qt),rt.convert(Kt),xt)}finally{let Rt=j!==null?X.get(j).__webglFramebuffer:null;b.bindFramebuffer(P.FRAMEBUFFER,Rt)}}},this.readRenderTargetPixelsAsync=async function(E,F,W,G,k,xt,St,yt=0){if(!(E&&E.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let At=X.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&St!==void 0&&(At=At[St]),At)if(F>=0&&F<=E.width-G&&W>=0&&W<=E.height-k){b.bindFramebuffer(P.FRAMEBUFFER,At);let Rt=E.textures[yt],qt=Rt.format,Kt=Rt.type;if(E.textures.length>1&&P.readBuffer(P.COLOR_ATTACHMENT0+yt),!C.textureFormatReadable(qt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!C.textureTypeReadable(Kt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Dt=P.createBuffer();P.bindBuffer(P.PIXEL_PACK_BUFFER,Dt),P.bufferData(P.PIXEL_PACK_BUFFER,xt.byteLength,P.STREAM_READ),P.readPixels(F,W,G,k,rt.convert(qt),rt.convert(Kt),0);let ve=j!==null?X.get(j).__webglFramebuffer:null;b.bindFramebuffer(P.FRAMEBUFFER,ve);let He=P.fenceSync(P.SYNC_GPU_COMMANDS_COMPLETE,0);return P.flush(),await XS(P,He,4),P.bindBuffer(P.PIXEL_PACK_BUFFER,Dt),P.getBufferSubData(P.PIXEL_PACK_BUFFER,0,xt),P.deleteBuffer(Dt),P.deleteSync(He),xt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(E,F=null,W=0){let G=Math.pow(2,-W),k=Math.floor(E.image.width*G),xt=Math.floor(E.image.height*G),St=F!==null?F.x:0,yt=F!==null?F.y:0;Q.setTexture2D(E,0),P.copyTexSubImage2D(P.TEXTURE_2D,W,0,0,St,yt,k,xt),b.unbindTexture()},this.copyTextureToTexture=function(E,F,W=null,G=null,k=0,xt=0){let St,yt,At,Rt,qt,Kt,Dt,ve,He,ze=E.isCompressedTexture?E.mipmaps[xt]:E.image;if(W!==null)St=W.max.x-W.min.x,yt=W.max.y-W.min.y,At=W.isBox3?W.max.z-W.min.z:1,Rt=W.min.x,qt=W.min.y,Kt=W.isBox3?W.min.z:0;else{let Ge=Math.pow(2,-k);St=Math.floor(ze.width*Ge),yt=Math.floor(ze.height*Ge),E.isDataArrayTexture?At=ze.depth:E.isData3DTexture?At=Math.floor(ze.depth*Ge):At=1,Rt=0,qt=0,Kt=0}G!==null?(Dt=G.x,ve=G.y,He=G.z):(Dt=0,ve=0,He=0);let xe=rt.convert(F.format),gn=rt.convert(F.type),bt;F.isData3DTexture?(Q.setTexture3D(F,0),bt=P.TEXTURE_3D):F.isDataArrayTexture||F.isCompressedArrayTexture?(Q.setTexture2DArray(F,0),bt=P.TEXTURE_2D_ARRAY):(Q.setTexture2D(F,0),bt=P.TEXTURE_2D),b.activeTexture(P.TEXTURE0),b.pixelStorei(P.UNPACK_FLIP_Y_WEBGL,F.flipY),b.pixelStorei(P.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),b.pixelStorei(P.UNPACK_ALIGNMENT,F.unpackAlignment);let Bn=b.getParameter(P.UNPACK_ROW_LENGTH),ce=b.getParameter(P.UNPACK_IMAGE_HEIGHT),si=b.getParameter(P.UNPACK_SKIP_PIXELS),Di=b.getParameter(P.UNPACK_SKIP_ROWS),Cs=b.getParameter(P.UNPACK_SKIP_IMAGES);b.pixelStorei(P.UNPACK_ROW_LENGTH,ze.width),b.pixelStorei(P.UNPACK_IMAGE_HEIGHT,ze.height),b.pixelStorei(P.UNPACK_SKIP_PIXELS,Rt),b.pixelStorei(P.UNPACK_SKIP_ROWS,qt),b.pixelStorei(P.UNPACK_SKIP_IMAGES,Kt);let or=E.isDataArrayTexture||E.isData3DTexture,be=F.isDataArrayTexture||F.isData3DTexture;if(E.isDepthTexture){let Ge=X.get(E),Rs=X.get(F),Me=X.get(Ge.__renderTarget),Ds=X.get(Rs.__renderTarget);b.bindFramebuffer(P.READ_FRAMEBUFFER,Me.__webglFramebuffer),b.bindFramebuffer(P.DRAW_FRAMEBUFFER,Ds.__webglFramebuffer);for(let lr=0;lr<At;lr++)or&&(P.framebufferTextureLayer(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,X.get(E).__webglTexture,k,Kt+lr),P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,X.get(F).__webglTexture,xt,He+lr)),P.blitFramebuffer(Rt,qt,St,yt,Dt,ve,St,yt,P.DEPTH_BUFFER_BIT,P.NEAREST);b.bindFramebuffer(P.READ_FRAMEBUFFER,null),b.bindFramebuffer(P.DRAW_FRAMEBUFFER,null)}else if(k!==0||E.isRenderTargetTexture||X.has(E)){let Ge=X.get(E),Rs=X.get(F);b.bindFramebuffer(P.READ_FRAMEBUFFER,J),b.bindFramebuffer(P.DRAW_FRAMEBUFFER,z);for(let Me=0;Me<At;Me++)or?P.framebufferTextureLayer(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,Ge.__webglTexture,k,Kt+Me):P.framebufferTexture2D(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,Ge.__webglTexture,k),be?P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,Rs.__webglTexture,xt,He+Me):P.framebufferTexture2D(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,Rs.__webglTexture,xt),k!==0?P.blitFramebuffer(Rt,qt,St,yt,Dt,ve,St,yt,P.COLOR_BUFFER_BIT,P.NEAREST):be?P.copyTexSubImage3D(bt,xt,Dt,ve,He+Me,Rt,qt,St,yt):P.copyTexSubImage2D(bt,xt,Dt,ve,Rt,qt,St,yt);b.bindFramebuffer(P.READ_FRAMEBUFFER,null),b.bindFramebuffer(P.DRAW_FRAMEBUFFER,null)}else be?E.isDataTexture||E.isData3DTexture?P.texSubImage3D(bt,xt,Dt,ve,He,St,yt,At,xe,gn,ze.data):F.isCompressedArrayTexture?P.compressedTexSubImage3D(bt,xt,Dt,ve,He,St,yt,At,xe,ze.data):P.texSubImage3D(bt,xt,Dt,ve,He,St,yt,At,xe,gn,ze):E.isDataTexture?P.texSubImage2D(P.TEXTURE_2D,xt,Dt,ve,St,yt,xe,gn,ze.data):E.isCompressedTexture?P.compressedTexSubImage2D(P.TEXTURE_2D,xt,Dt,ve,ze.width,ze.height,xe,ze.data):P.texSubImage2D(P.TEXTURE_2D,xt,Dt,ve,St,yt,xe,gn,ze);b.pixelStorei(P.UNPACK_ROW_LENGTH,Bn),b.pixelStorei(P.UNPACK_IMAGE_HEIGHT,ce),b.pixelStorei(P.UNPACK_SKIP_PIXELS,si),b.pixelStorei(P.UNPACK_SKIP_ROWS,Di),b.pixelStorei(P.UNPACK_SKIP_IMAGES,Cs),xt===0&&F.generateMipmaps&&P.generateMipmap(bt),b.unbindTexture()},this.initRenderTarget=function(E){X.get(E).__webglFramebuffer===void 0&&Q.setupRenderTarget(E)},this.initTexture=function(E){E.isCubeTexture?Q.setTextureCube(E,0):E.isData3DTexture?Q.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?Q.setTexture2DArray(E,0):Q.setTexture2D(E,0),b.unbindTexture()},this.resetState=function(){B=0,V=0,j=null,b.reset(),$.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Ai}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let n=this.getContext();n.drawingBufferColorSpace=ne._getDrawingBufferColorSpace(t),n.unpackColorSpace=ne._getUnpackColorSpace()}};var vd=12;var ie=(e,t,n=0)=>({time:e,azimuth:t||0,elevation:n,distance:1}),EM=e=>[...Array.from({length:9},(t,n)=>ie(Number((n*5/48).toFixed(6)),e*n*45)),ie(1,e*360)],bc=(e,t=0)=>[ie(0,0),ie(.2,e/2,t/2),ie(.4,e,t),ie(.6,e/2,t/2),ie(.8,0),ie(1,0)],TM=e=>[...Array.from({length:9},(t,n)=>ie(Number((n*5/48).toFixed(6)),e*n*45,n===8?0:Number((25*Math.sin(Math.PI*n/8)).toFixed(3)))),ie(1,e*360)],iL=[{id:"swing",name:"Side Arc",description:"A 65-degree arc around the frame.",duration:5,returnsToStart:!1,trajectory:[ie(0,0),ie(1,65,8)]},{id:"rise",name:"Hero Rise",description:"A new angle on the action.",duration:5,returnsToStart:!1,trajectory:[ie(0,0),ie(1,35,30)]},{id:"orbit",name:"Full Orbit",description:"A full right orbit back to the starting pose.",duration:6,returnsToStart:!0,trajectory:EM(1)},{id:"arc-return",name:"Arc Return",description:"Sweep 45 degrees to the side, then retrace to the starting pose.",duration:5,returnsToStart:!0,trajectory:[ie(0,0),ie(.2,22.5),ie(.45,45),ie(.7,22.5),ie(.9,0),ie(1,0)]},{id:"rise-return",name:"Rise Return",description:"Rise 25 degrees, then descend to the starting pose.",duration:5,returnsToStart:!0,trajectory:[ie(0,0),ie(.2,0,12.5),ie(.45,0,25),ie(.7,0,12.5),ie(.9,0),ie(1,0)]},{id:"orbit-left",name:"Orbit Left",description:"A full left orbit back to the starting pose.",duration:6,returnsToStart:!0,trajectory:EM(-1)},{id:"arc-left-return",name:"Left Return",description:"Sweep 45 degrees left, then retrace to the opening view.",duration:5,returnsToStart:!0,trajectory:bc(-45)},{id:"wide-return",name:"Wide Return",description:"Reach a 90-degree side view, then return to the opening pose.",duration:5,returnsToStart:!0,trajectory:bc(90)},{id:"dip-return",name:"Dip Return",description:"Dip 20 degrees below the subject, then rise back to the opening view.",duration:5,returnsToStart:!0,trajectory:bc(0,-20)},{id:"high-arc-return",name:"High Return",description:"Arc 45 degrees right and 25 degrees up, then retrace home.",duration:5,returnsToStart:!0,trajectory:bc(45,25)},{id:"low-arc-return",name:"Low Return",description:"Arc 45 degrees left and 20 degrees down, then retrace home.",duration:5,returnsToStart:!0,trajectory:bc(-45,-20)},{id:"sway-return",name:"Side to Side",description:"Sway left, cross through the opening view to the right, then return.",duration:5,returnsToStart:!0,trajectory:[ie(0,0),ie(.2,-30),ie(.4,0),ie(.6,30),ie(.8,0),ie(1,0)]},{id:"halo",name:"High Orbit",description:"Orbit right through a raised viewpoint, descending to the exact opening pose.",duration:6,returnsToStart:!0,trajectory:TM(1)},{id:"halo-left",name:"High Orbit Left",description:"Orbit left through a raised viewpoint, descending to the exact opening pose.",duration:6,returnsToStart:!0,trajectory:TM(-1)},{id:"arc-left",name:"Left Arc",description:"A 65-degree left arc that finishes at a new angle.",duration:5,returnsToStart:!1,trajectory:[ie(0,0),ie(1,-65,8)]},{id:"low-angle",name:"Low Reveal",description:"Sweep 40 degrees right and descend 20 degrees for a low-angle finish.",duration:5,returnsToStart:!1,trajectory:[ie(0,0),ie(1,40,-20)]}];var Y=wc(L0());async function rr(e){let t=e instanceof FormData?e:new FormData;if(!(e instanceof FormData))for(let[n,i]of Object.entries(e))t.set(n,i);t.set("format","json");try{return await(await fetch(window.location.pathname,{method:"POST",body:t,credentials:"same-origin"})).json()}catch{return null}}var Mc=Math.PI/180;function nn(e,t,n){return Math.max(t,Math.min(n,e))}function Ec(e,t){if(t<=e[0].time)return e[0];let n=e[e.length-1];if(t>=n.time)return n;let i=1;for(;e[i].time<t;)i++;let s=e[i-1],a=e[i],r=Math.max(1e-6,a.time-s.time),o=(t-s.time)/r,c=o*o*(3-2*o),l=a.azimuth-s.azimuth;return l=((l%360+540)%360+360)%360-180,{time:t,azimuth:s.azimuth+l*c,elevation:s.elevation+(a.elevation-s.elevation)*c,distance:s.distance+(a.distance-s.distance)*c}}var z0={time:0,azimuth:0,elevation:0,distance:1},p3={...z0,time:1},Sc=1024,RM=["#f8fbff","#ffd166","#ff5d8f","#4db0ff","#39d98a"],m3=[{id:"fast",label:"Flare Fast"},{id:"detailed",label:"Flare Detailed"},{id:"turbo",label:"Turbo"},{id:"hq",label:"Sunburst HQ"}];function g3(e){let t=(0,at.useRef)(null),n=(0,at.useRef)([]),i=(0,at.useRef)(!1),[s,a]=(0,at.useState)(RM[0]),[r,o]=(0,at.useState)(14),[c,l]=(0,at.useState)(!1),[h,d]=(0,at.useState)(""),[u,p]=(0,at.useState)("fast"),[,m]=(0,at.useState)(0),S=(0,at.useCallback)(()=>{let g=t.current,y=g?.getContext("2d");if(!(!g||!y)){y.fillStyle="#0a1120",y.fillRect(0,0,Sc,Sc);for(let _ of n.current){y.save(),y.globalCompositeOperation=_.erase?"destination-out":"source-over",y.strokeStyle=_.color,y.fillStyle=_.color,y.lineWidth=_.width,y.lineCap="round",y.lineJoin="round";let[T,...A]=_.points;if(!T){y.restore();continue}y.beginPath(),y.arc(T.x,T.y,_.width/2,0,Math.PI*2),y.fill(),y.beginPath(),y.moveTo(T.x,T.y);for(let w of A)y.lineTo(w.x,w.y);y.stroke(),y.restore()}}},[]);(0,at.useEffect)(()=>S(),[S]);let v=g=>{let y=g.currentTarget.getBoundingClientRect(),_=Sc/Math.max(1,Math.min(y.width,y.height));return{x:(g.clientX-y.left)*_,y:(g.clientY-y.top)*_}},f=n.current.length===0;return(0,Y.jsxs)("div",{className:"fz-sketch",children:[(0,Y.jsx)("canvas",{ref:t,className:"fz-sketch-canvas",width:Sc,height:Sc,onPointerDown:g=>{g.currentTarget.setPointerCapture(g.pointerId),i.current=!0,n.current.push({points:[v(g)],color:s,width:r,erase:c}),S()},onPointerMove:g=>{i.current&&(n.current[n.current.length-1]?.points.push(v(g)),S())},onPointerUp:()=>{i.current=!1,m(g=>g+1)}}),(0,Y.jsxs)("div",{className:"fz-tools",children:[RM.map(g=>(0,Y.jsx)("button",{type:"button",className:`fz-swatch${!c&&s===g?" selected":""}`,style:{background:g},"aria-label":`paint ${g}`,onClick:()=>{a(g),l(!1)}},g)),(0,Y.jsx)("button",{type:"button",className:`fz-ghost${c?" selected":""}`,onClick:()=>l(g=>!g),children:"erase"}),(0,Y.jsx)("input",{className:"fz-size",type:"range",min:4,max:60,value:r,onChange:g=>o(Number(g.target.value)),"aria-label":"brush size"}),(0,Y.jsx)("button",{type:"button",className:"fz-ghost",disabled:f,onClick:()=>{n.current=[],S(),m(g=>g+1)},children:"clear"})]}),(0,Y.jsx)("textarea",{className:"fz-prompt",placeholder:"describe the scene \u2014 'two friends at a diner, neon light'",value:h,maxLength:2e3,onChange:g=>d(g.target.value)}),(0,Y.jsx)("div",{className:"fz-modes",children:m3.map(g=>(0,Y.jsx)("button",{type:"button",className:u===g.id?"active":"",onClick:()=>p(g.id),children:g.label},g.id))}),(0,Y.jsx)("button",{type:"button",className:"fz-primary",disabled:e.busy||!h.trim(),onClick:()=>{let g=t.current;n.current.length>0&&g?g.toBlob(_=>e.onGenerate(_,h.trim(),u),"image/png"):e.onGenerate(null,h.trim(),u)},children:e.busy?"generating\u2026":"generate the still"})]})}var yd=1/30,DM=10*1024*1024,ar=30,v3=250*1024*1024,I0={mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm"};async function _3(e){let t=e.slice(0,8388608),n=await crypto.subtle.digest("SHA-256",await new Blob([t,`:${e.size}`]).arrayBuffer());return Array.from(new Uint8Array(n)).map(i=>i.toString(16).padStart(2,"0")).join("")}function y3(e,t,n=1e4){return new Promise((i,s)=>{if(Math.abs(e.currentTime-t)<.001&&e.readyState>=2){i();return}let a=window.setTimeout(()=>{e.removeEventListener("seeked",r),s(new Error("couldn't read that frame"))},n);function r(){window.clearTimeout(a),i()}e.addEventListener("seeked",r,{once:!0}),e.currentTime=t})}function UM(e,t){let n=document.createElement("canvas");n.width=Math.min(t,e.videoWidth),n.height=Math.round(n.width*e.videoHeight/Math.max(1,e.videoWidth));let i=n.getContext("2d");return!i||!n.width?null:(i.drawImage(e,0,0,n.width,n.height),n)}async function x3(e,t,n=1e4){try{await y3(e,t,n);let i=UM(e,160);return i?i.toDataURL("image/jpeg",.8):null}catch{return null}}function b3(e){let{busy:t,onFrame:n}=e,i=(0,at.useRef)(null),s=(0,at.useRef)(null),a=(0,at.useRef)(null),r=(0,at.useRef)(null),o=(0,at.useRef)(!1),c=(0,at.useRef)(0),[l,h]=(0,at.useState)(null),[d,u]=(0,at.useState)(0),[p,m]=(0,at.useState)(0),[S,v]=(0,at.useState)(0),[f,g]=(0,at.useState)(!1),[y,_]=(0,at.useState)([]),[T,A]=(0,at.useState)(!1),[w,x]=(0,at.useState)(!1),[M,R]=(0,at.useState)(null);(0,at.useEffect)(()=>()=>{c.current++,a.current&&URL.revokeObjectURL(a.current)},[]);let D=(0,at.useCallback)(async B=>{if(!B)return;R(null);let V=B.name.split(".").pop()?.toLowerCase()??"",j=I0[V]??B.type;if(!Object.values(I0).includes(j)){R("choose a video \u2014 mp4, mov, or webm");return}if(B.size>v3){R("choose a clip under 250mb");return}A(!0);let lt=++c.current,ut=URL.createObjectURL(B),ct=()=>c.current!==lt;try{let ot=document.createElement("video");if(ot.preload="auto",ot.muted=!0,ot.playsInline=!0,await new Promise((K,et)=>{let nt=window.setTimeout(()=>et(new Error("that clip took too long to read")),2e4);ot.onloadeddata=()=>{window.clearTimeout(nt),K()},ot.onerror=()=>{window.clearTimeout(nt),et(new Error("can't decode that video \u2014 try an h.264 mp4"))},ot.src=ut}),!Number.isFinite(ot.duration)||ot.duration<=0||ot.duration>15*60)throw new Error("choose a clip under fifteen minutes");if(ct()){ot.removeAttribute("src"),ot.load(),URL.revokeObjectURL(ut);return}let Nt=[],Wt=Date.now()+15e3;for(let K=0;K<10&&!ct();K++){let et=Wt-Date.now();if(et<=0)break;let nt=Math.max(0,Math.min(ot.duration-.05,ot.duration*K/10)),Mt=await x3(ot,nt,et);Mt&&Nt.push({src:Mt,time:nt})}if(ct()){ot.removeAttribute("src"),ot.load(),URL.revokeObjectURL(ut);return}a.current&&URL.revokeObjectURL(a.current),a.current=ut,r.current=B,h(ut),u(ot.duration);let kt=Math.min(ar,ot.duration)/2;v(Math.max(0,ot.duration/2-kt)),m(ot.duration/2),_(Nt),ot.removeAttribute("src"),ot.load()}catch(ot){URL.revokeObjectURL(ut),ct()||R(ot instanceof Error?ot.message:"that video didn't load")}finally{ct()||A(!1)}},[]),I=Math.min(d,S+ar),q=(0,at.useCallback)(B=>{let V=nn(B,S,I);m(V);let j=s.current;j&&(j.pause(),o.current=!0,j.currentTime=V)},[S,I]),J=(0,at.useCallback)(B=>{(B<S||B>I)&&v(nn(B-ar/2,0,Math.max(0,d-ar))),m(B);let V=s.current;V&&(V.pause(),o.current=!0,V.currentTime=B)},[d,S,I]),z=(0,at.useCallback)(async()=>{let B=s.current;if(!(!B||w||t)){x(!0);try{(o.current||B.readyState<2||Math.abs(B.currentTime-p)>.001)&&await new Promise((ct,ot)=>{let Nt=window.setTimeout(()=>{B.removeEventListener("seeked",Wt),ot(new Error("couldn't read that frame"))},1e4),Wt=()=>{window.clearTimeout(Nt),ct()};B.addEventListener("seeked",Wt,{once:!0}),o.current||(B.currentTime=p)});let V=Math.min(1920,B.videoWidth),j=null;for(;V>0;){let ct=UM(B,V);if(!ct)throw new Error("frame capture isn't available");if(j=await new Promise(ot=>ct.toBlob(Nt=>ot(Nt),"image/jpeg",.94)),!j)throw new Error("frame capture isn't available");if(j.size<=DM||V<=320)break;V=Math.floor(V*.75)}if(!j||j.size>DM)throw new Error("that frame is too large \u2014 try a smaller clip");let lt=new File([j],"freeze-frame.jpg",{type:"image/jpeg"}),ut=r.current;if(ut){g(!0);try{let ct=ut.name.split(".").pop()?.toLowerCase()??"",ot=I0[ct]??ut.type,Nt=await rr({action:"clip",mime:ot});if(Nt?.clipPath&&Nt.uploadUrl){let Wt=await _3(ut),kt=new FormData;kt.append("cacheControl","3600"),kt.append("",ut);let K=await fetch(Nt.uploadUrl,{method:"PUT",body:kt});if(!K.ok)throw new Error(`clip upload ${K.status}`);n(lt,{path:Nt.clipPath,sha:Wt,bytes:ut.size,clipIn:S,clipOut:I,freezeAt:p});return}throw new Error(Nt?.line??"the clip upload didn't start")}catch(ct){R(`${ct instanceof Error?ct.message:"the clip didn't upload"} \u2014 the freeze still works, it just won't splice into the footage`)}finally{g(!1)}}n(lt,null)}catch(V){R(V instanceof Error?V.message:"couldn't capture the frame")}finally{x(!1)}}},[p,w,t,n,S,I]);return(0,Y.jsxs)("div",{className:"fz-framepick",children:[(0,Y.jsx)("input",{ref:i,type:"file",accept:"video/*",hidden:!0,onChange:B=>void D(B.target.files?.[0]??null)}),l?(0,Y.jsxs)(Y.Fragment,{children:[(0,Y.jsx)("video",{ref:s,className:"fz-video",src:l,muted:!0,playsInline:!0,preload:"auto",onLoadedData:B=>{o.current=!0,B.currentTarget.currentTime=p},onSeeked:()=>{o.current=!1}}),y.length>0&&(0,Y.jsx)("div",{className:"fz-strip",children:y.map((B,V)=>(0,Y.jsx)("img",{src:B.src,alt:"",onClick:()=>J(B.time)},V))}),d>ar&&(0,Y.jsxs)("div",{className:"fz-win",children:[(0,Y.jsx)("input",{type:"range",className:"fz-scrub",min:0,max:Math.max(yd,d-ar),step:yd,value:S,onChange:B=>{let V=Number(B.target.value);v(V);let j=nn(p,V,V+ar);m(j);let lt=s.current;lt&&(lt.pause(),o.current=!0,lt.currentTime=j)},"aria-label":"which 30 seconds to keep"}),(0,Y.jsxs)("span",{className:"fz-meta",children:["keeping ",S.toFixed(1),"s \u2013 ",I.toFixed(1),"s of"," ",d.toFixed(1),"s"]})]}),(0,Y.jsx)("input",{type:"range",className:"fz-scrub",min:S,max:Math.max(S+yd,I),step:yd,value:p,onChange:B=>q(Number(B.target.value)),"aria-label":"pick the frame"}),(0,Y.jsxs)("div",{className:"fz-row",children:[(0,Y.jsx)("button",{type:"button",className:"fz-ghost",disabled:T,onClick:()=>i.current?.click(),children:"different clip"}),(0,Y.jsx)("button",{type:"button",className:"fz-primary",disabled:w||t||f,onClick:()=>void z(),children:w?"capturing\u2026":f?"saving the clip\u2026":`freeze at ${p.toFixed(2)}s`})]})]}):(0,Y.jsxs)("div",{className:"fz-video-empty",children:[(0,Y.jsx)("p",{className:"fz-sub",children:"pick the clip \u2014 then scrub to the moment to freeze"}),(0,Y.jsx)("button",{type:"button",className:"fz-primary",disabled:T,onClick:()=>i.current?.click(),children:T?"reading the clip\u2026":"choose a video"})]}),M&&(0,Y.jsx)("p",{className:"fz-err",children:M})]})}function O0(e){let t=(0,at.useRef)(null),n=(0,at.useRef)(null);return(0,at.useEffect)(()=>{let i=t.current,s=n.current,a=s?.getContext("2d");if(!i||!s||!a)return;let r=window.matchMedia("(prefers-reduced-motion: reduce)").matches,o=6,c=["#dff5ec","#8fd4bd","#3d7a5f","#1b2f28"],l=[],h=()=>{let S=i.getBoundingClientRect();s.width=Math.max(1,Math.floor(S.width)),s.height=Math.max(1,Math.floor(S.height)),l=[];for(let v=0;v<s.width;v+=o)for(let f=0;f<s.height;f+=o){let g=Math.hypot(v-s.width/2,f-s.height/2);l.push({x:v,y:f,color:c[Math.floor(Math.random()*c.length)],max:.6+Math.random()*1.6,delay:r?0:g,counter:0,step:Math.random()*4+(s.width+s.height)*.01,phase:Math.random()*Math.PI*2,speed:.0016+Math.random()*.0028})}};h();let d=0,u=performance.now(),p=S=>{d=requestAnimationFrame(p);let v=S-u;if(!(v<1e3/60)){u=S-v%(1e3/60),a.clearRect(0,0,s.width,s.height);for(let f of l){let g;if(f.counter<=f.delay){f.counter+=f.step;continue}else r?g=f.max:g=f.max*(.55+.45*Math.sin(S*f.speed+f.phase));let y=f.max-g/2;a.fillStyle=f.color,a.fillRect(f.x+y,f.y+y,Math.max(.4,g),Math.max(.4,g))}}};d=requestAnimationFrame(p);let m=new ResizeObserver(h);return m.observe(i),()=>{m.disconnect(),cancelAnimationFrame(d)}},[]),(0,Y.jsxs)("div",{ref:t,className:"fz-dither",role:"status","aria-live":"polite",children:[(0,Y.jsx)("canvas",{ref:n,className:"fz-dither-canvas"}),(0,Y.jsxs)("div",{className:"fz-dither-label",children:[(0,Y.jsx)("b",{children:e.label}),e.sub&&(0,Y.jsx)("span",{children:e.sub})]})]})}function xd(e,t,n,i){let s=t/2,a=n*.46+(i?.tilt??0)*n*.24,r=i?.zoom??1,o=t*.36*e.distance,c=n*.11*e.distance,l=(e.azimuth+(i?.yaw??0))*Mc;return{x:s+Math.sin(l)*o*r,y:a+n*.16+(Math.cos(l)*c-Math.sin(e.elevation*Mc)*n*.3)*r,depth:Math.cos(l)}}var Ea=.95,B0=2.3;function bd(e,t){let n=e.azimuth*Mc,i=e.elevation*Mc,s=B0*e.distance;return t.set(Math.sin(n)*Math.cos(i)*s,Ea+Math.sin(i)*s,Math.cos(n)*Math.cos(i)*s),t}function S3(e){let t=new pd({antialias:!0,alpha:!0});t.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),e.appendChild(t.domElement),t.domElement.style.position="absolute",t.domElement.style.inset="0";let n=[],i=et=>(n.push(et),et),s=new ql;s.fog=new Wl(725009,6.5,16);let a=new xn(54,1,.05,80),r=new L(0,1.12,0),o={yaw:.52,pitch:.19,dist:5.2},c={...o},l=()=>{let et=Math.cos(c.pitch);a.position.set(r.x+Math.sin(c.yaw)*et*c.dist,r.y+Math.sin(c.pitch)*c.dist,r.z+Math.cos(c.yaw)*et*c.dist),a.lookAt(r)};l();let h=i(new oc(14,28,4612956,2372656));s.add(h);let d=i(new er({color:4482140,dashSize:.16,gapSize:.12,transparent:!0,opacity:.55})),u=[];for(let et=0;et<=128;et++){let nt=et/128*Math.PI*2;u.push(new L(Math.sin(nt)*B0,Ea,Math.cos(nt)*B0))}let p=new Yi(i(new Ve().setFromPoints(u)),d);p.computeLineDistances(),s.add(p);let m=i(new Ve().setFromPoints([new L(0,.02,0),new L(0,Ea,0)]));s.add(new Yi(m,i(new qi({color:4020818,transparent:!0,opacity:.6}))));let S=[];for(let et=0;et<=64;et++){let nt=et/64*Math.PI*2;S.push(new L(Math.sin(nt)*.55,.02,Math.cos(nt)*.55))}s.add(new Yi(i(new Ve().setFromPoints(S)),i(new qi({color:4020818,transparent:!0,opacity:.7}))));let v=1.9,f=v*.72,g=new je(i(new ma(v*1.07,f*1.1)),i(new vi({color:858139,side:ni})));g.position.set(0,Ea,0);let y=i(new vi({color:4874585,side:ni})),_=i(new ma(v,f)),T=new je(_,y);T.position.set(0,Ea,.001);let A=new je(_,y);A.position.set(0,Ea,-.001),A.rotation.y=Math.PI;let w=new _o(i(new tc(_)),i(new qi({color:8366235})));w.position.copy(T.position),s.add(g,T,A,w);let x=i(new vi({color:9426109})),M=null,R=i(new Ve),D=new Yi(R,i(new er({color:9426109,dashSize:.12,gapSize:.1,transparent:!0,opacity:.28})));D.visible=!1,s.add(D);let I=new Gi;s.add(I);let q=i(new bo(.066,16,12)),J=i(new vi({color:9426109})),z=i(new vi({color:15791604})),B=i(new vi({color:16765286,transparent:!0})),V=new Gi;V.add(new je(i(new bo(.1,18,14)),B));let j=new je(i(new $l(.062,.22,12)),B);j.rotation.x=Math.PI/2,j.position.z=.18,V.add(j),s.add(V);let lt=i(new Ve().setFromPoints([new L,new L(0,Ea,0)])),ut=new Yi(lt,i(new er({color:16765286,dashSize:.09,gapSize:.09,transparent:!0,opacity:.45})));ut.computeLineDistances(),s.add(ut);let ct=new L,ot=new L(0,Ea,0),Nt=[],Wt=()=>{let et=e.clientWidth,nt=e.clientHeight;if(et===0||nt===0)return;let Mt=new Lt;t.getSize(Mt),(Mt.x!==et||Mt.y!==nt)&&(t.setSize(et,nt,!1),a.aspect=et/nt,a.updateProjectionMatrix()),t.render(s,a)},kt=new ResizeObserver(Wt);kt.observe(e);let K=null;return{setImage(et){if(K?.dispose(),et){let nt=new bn(et);nt.colorSpace=wn,nt.needsUpdate=!0,K=nt,y.map=nt,y.color.set(16777215)}else K=null,y.map=null,y.color.set(4874585);y.needsUpdate=!0,Wt()},update(et,nt,Mt){Nt=et;let Ut=[];for(let se=0;se<=96;se++){let Pt=bd(Ec(et,se/96),new L),Ft=Ut[Ut.length-1];Ft&&Pt.distanceToSquared(Ft)<1e-8||Ut.push(Pt)}if(Ut.length>=2){let se=new xo(Ut),Pt=new ic(se,120,.03,8,!1),Ft=new je(Pt,x);M&&(s.remove(M),M.geometry.dispose()),M=Ft,s.add(M),R.setFromPoints(Ut.map(Jt=>new L(Jt.x,.02,Jt.z))),D.computeLineDistances(),D.visible=!0}else M&&(s.remove(M),M.geometry.dispose(),M=null,D.visible=!1);I.clear(),et.forEach((se,Pt)=>{let Ft=new je(q,Pt===Mt?z:J);Ft.position.copy(bd(se,ct)),Pt===Mt&&Ft.scale.setScalar(1.3),Ft.userData.index=Pt,I.add(Ft)});let wt=Ec(et,nt);V.position.copy(bd(wt,ct)),V.lookAt(ot),B.opacity=Math.cos(wt.azimuth*Mc)<-.05?.45:1,lt.setFromPoints([V.position.clone(),ot.clone()]),ut.computeLineDistances(),Wt()},orbit(et,nt){c.yaw-=et*.0075,c.pitch=nn(c.pitch+nt*.006,-.15,1.35),l(),Wt()},zoom(et){c.dist=nn(c.dist/et,3.2,10),l(),Wt()},viewDirty(){return Math.abs(c.yaw-o.yaw)>.01||Math.abs(c.pitch-o.pitch)>.01||Math.abs(c.dist-o.dist)>.05},resetView(){return Math.abs(c.yaw-o.yaw)<=.01&&Math.abs(c.pitch-o.pitch)<=.01&&Math.abs(c.dist-o.dist)<=.05?!1:(Object.assign(c,o),l(),Wt(),!0)},pick(et,nt){let Mt=e.clientWidth,Ut=e.clientHeight,wt=null,se=30;return Nt.forEach((Pt,Ft)=>{bd(Pt,ct).project(a);let Jt=(ct.x*.5+.5)*Mt,Ht=(-ct.y*.5+.5)*Ut,de=Math.hypot(Jt-et,Ht-nt);de<se&&(se=de,wt=Ft)}),wt},dispose(){kt.disconnect(),K?.dispose(),n.forEach(et=>et.dispose()),M?.geometry.dispose(),t.dispose(),t.domElement.remove()}}}var Co=14;function M3(e){let t=(0,at.useRef)(null),n=(0,at.useRef)(null),[i,s]=(0,at.useState)(!1),a=(0,at.useRef)(null),r=(0,at.useRef)(new Map),o=(0,at.useRef)(e);o.current=e;let c=()=>{let l=a.current;l?.mode==="draw"&&l.snapshot&&l.travel>=Co&&l.samples.length>=2&&o.current.onDrawRevert(l.snapshot,l.snapshotSel)};return(0,at.useEffect)(()=>{let l=t.current;if(!l||o.current.lite)return;let h=null;try{h=S3(l)}catch{return}n.current=h;let d={reset:()=>h.resetView()?(o.current.onViewChange(!1),!0):!1};return o.current.viewCtl.current=d,o.current.onViewChange(!1),s(!0),()=>{n.current=null,o.current.viewCtl.current===d&&(o.current.viewCtl.current=null),h.dispose()}},[]),(0,at.useEffect)(()=>{n.current?.setImage(e.image)},[i,e.image]),(0,at.useEffect)(()=>{n.current?.update(e.keyframes,e.scrubT,e.selected)},[i,e.keyframes,e.scrubT,e.selected]),(0,Y.jsx)("div",{ref:t,className:"fz-stage-canvas",onPointerDown:l=>{if(!i)return;if(r.current.set(l.pointerId,{x:l.clientX,y:l.clientY}),l.currentTarget.setPointerCapture(l.pointerId),r.current.size>=2){c();let p=[...r.current.values()];a.current={mode:"view",picked:null,moved:!0,lastX:p.reduce((m,S)=>m+S.x,0)/p.length,lastY:p.reduce((m,S)=>m+S.y,0)/p.length,az:0,el:0,travel:0,samples:[],pinchD:p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0,snapshot:null,snapshotSel:null};return}if(o.current.mode==="look"){a.current={mode:"view",picked:null,moved:!1,lastX:l.clientX,lastY:l.clientY,az:0,el:0,travel:0,samples:[],pinchD:0,snapshot:null,snapshotSel:null};return}let h=l.currentTarget.getBoundingClientRect(),d=n.current?.pick(l.clientX-h.left,l.clientY-h.top)??null;d!==null&&o.current.onPick(d);let u=d!==null&&(o.current.keyframes[d]?.time===0||o.current.keyframes[d]?.time===1);a.current={mode:o.current.mode==="draw"?"draw":d===null||u?"none":"edit",picked:d,moved:!1,lastX:l.clientX,lastY:l.clientY,az:0,el:0,travel:0,samples:[{azimuth:0,elevation:0}],pinchD:0,snapshot:o.current.keyframes,snapshotSel:o.current.selected}},onPointerMove:l=>{let h=a.current;if(!h||!i)return;if(r.current.has(l.pointerId)&&r.current.set(l.pointerId,{x:l.clientX,y:l.clientY}),h.mode==="view"){let p=n.current,m=[...r.current.values()];if(!p||m.length===0)return;let S=m.reduce((f,g)=>f+g.x,0)/m.length,v=m.reduce((f,g)=>f+g.y,0)/m.length;if(p.orbit(S-h.lastX,v-h.lastY),h.lastX=S,h.lastY=v,m.length===2){let f=Math.hypot(m[0].x-m[1].x,m[0].y-m[1].y);h.pinchD>0&&p.zoom(f/h.pinchD),h.pinchD=f}else h.pinchD=0;o.current.onViewChange(p.viewDirty());return}let d=l.clientX-h.lastX,u=l.clientY-h.lastY;if(!(Math.abs(d)+Math.abs(u)<.5)){if(h.lastX=l.clientX,h.lastY=l.clientY,h.moved=!0,h.mode==="edit"){o.current.onDragPose(d*.6,-u*.4,h.picked);return}h.mode!=="none"&&(h.travel+=Math.abs(d)+Math.abs(u),h.az=nn(h.az+d*.6,-360,360),h.el=nn(h.el-u*.4,-90,90),h.samples.length<600?h.samples.push({azimuth:h.az,elevation:h.el}):h.samples[h.samples.length-1]={azimuth:h.az,elevation:h.el},h.travel>=Co&&h.samples.length>=2&&(h.samples.length<4||h.samples.length%4===0)&&o.current.onDrawPath(h.samples))}},onPointerUp:l=>{r.current.delete(l.pointerId);let h=a.current;if(h?.mode==="view"){if(r.current.size===0)a.current=null;else{let d=[...r.current.values()];h.lastX=d.reduce((u,p)=>u+p.x,0)/d.length,h.lastY=d.reduce((u,p)=>u+p.y,0)/d.length,h.pinchD=d.length===2?Math.hypot(d[0].x-d[1].x,d[0].y-d[1].y):0}return}if(a.current=null,!(!h||!i)){if(!h.moved){o.current.onPick(h.picked);return}h.mode==="draw"&&h.travel>=Co&&h.samples.length>=2&&o.current.onDrawPath(h.samples,!0)}},onPointerCancel:l=>{r.current.delete(l.pointerId);let h=a.current;if(h?.mode==="view"&&r.current.size>0){let d=[...r.current.values()];h.lastX=d.reduce((u,p)=>u+p.x,0)/d.length,h.lastY=d.reduce((u,p)=>u+p.y,0)/d.length,h.pinchD=d.length===2?Math.hypot(d[0].x-d[1].x,d[0].y-d[1].y):0;return}c(),a.current=null},children:!i&&(0,Y.jsx)(E3,{...e})})}function E3(e){let t=(0,at.useRef)(null),n=(0,at.useRef)(null),i=(0,at.useRef)(new Map),s=(0,at.useRef)({yaw:0,tilt:0,zoom:1}),a=(0,at.useRef)(e);a.current=e;let r=()=>{let c=n.current;c?.mode==="draw"&&c.snapshot&&c.travel>=Co&&c.samples.length>=2&&a.current.onDrawRevert(c.snapshot,c.snapshotSel)},o=(0,at.useCallback)(()=>{let c=t.current,l=c?.getContext("2d");if(!c||!l)return;let h=Math.min(2,window.devicePixelRatio||1),d=c.clientWidth,u=c.clientHeight;(c.width!==d*h||c.height!==u*h)&&(c.width=d*h,c.height=u*h),l.setTransform(h,0,0,h,0,0),l.clearRect(0,0,d,u),l.strokeStyle="rgba(160,196,182,0.10)",l.lineWidth=1;let p=u*.62;for(let M=0;M<=12;M++){let R=p+Math.pow(M/12,1.6)*(u-p);l.beginPath(),l.moveTo(0,R),l.lineTo(d,R),l.stroke()}for(let M=-8;M<=8;M++)l.beginPath(),l.moveTo(d/2+M*d*.07,p),l.lineTo(d/2+M*d*.22,u),l.stroke();let m=s.current,S=d/2,v=u*.46+m.tilt*u*.24,f=d*.36*m.zoom,g=u*.11*m.zoom;l.strokeStyle="rgba(159,216,197,0.22)",l.setLineDash([4,6]),l.beginPath(),l.ellipse(S,v+u*.16,f,g,0,0,Math.PI*2),l.stroke(),l.setLineDash([]);let y=e.keyframes;if(y.length>=2){l.strokeStyle="rgba(143,212,189,0.9)",l.lineWidth=3,l.lineCap="round",l.beginPath();let M=96;for(let R=0;R<=M;R++){let D=xd(Ec(y,R/M),d,u,m);R===0?l.moveTo(D.x,D.y):l.lineTo(D.x,D.y)}l.stroke()}let _=Math.min(d*.4,u*.4*(4/3))*m.zoom,T=_*.72;if(l.save(),l.shadowColor="rgba(0,0,0,0.6)",l.shadowBlur=24,l.fillStyle="#0d181b",l.fillRect(S-_/2,v-T/2,_,T),l.restore(),e.image){let M=e.image,R=Math.min(_/M.width,T/M.height),D=M.width*R,I=M.height*R;l.drawImage(M,S-D/2,v-I/2,D,I)}else l.fillStyle="rgba(214,233,226,0.5)",l.font="13px ui-monospace, monospace",l.textAlign="center",l.fillText("no photo",S,v);l.strokeStyle="rgba(159,216,197,0.45)",l.strokeRect(S-_/2,v-T/2,_,T),y.forEach((M,R)=>{let D=xd(M,d,u,m);l.beginPath(),l.arc(D.x,D.y,R===e.selected?7:5,0,Math.PI*2),l.fillStyle=R===e.selected?"#f0f5f4":"#8fd4bd",l.fill(),R===e.selected&&(l.strokeStyle="rgba(143,212,189,0.6)",l.lineWidth=2,l.stroke())});let A=Ec(y,e.scrubT),w=xd(A,d,u,m),x=w.depth<-.05;l.globalAlpha=x?.45:1,l.beginPath(),l.arc(w.x,w.y,13,0,Math.PI*2),l.fillStyle="#ffd166",l.fill(),l.beginPath(),l.arc(w.x,w.y,5,0,Math.PI*2),l.fillStyle="#0a1120",l.fill(),l.strokeStyle="rgba(255,209,102,0.35)",l.setLineDash([3,5]),l.beginPath(),l.moveTo(w.x,w.y),l.lineTo(S,v),l.stroke(),l.setLineDash([]),l.globalAlpha=1},[e.image,e.keyframes,e.scrubT,e.selected]);return(0,at.useEffect)(()=>{let c=()=>{let h=s.current;return Math.abs(h.yaw)>.5||Math.abs(h.tilt)>.02||Math.abs(h.zoom-1)>.02},l={reset:()=>c()?(s.current={yaw:0,tilt:0,zoom:1},o(),a.current.onViewChange(!1),!0):!1};return a.current.viewCtl.current=l,a.current.onViewChange(c()),()=>{a.current.viewCtl.current===l&&(a.current.viewCtl.current=null)}},[o]),(0,at.useEffect)(()=>{o()},[o]),(0,at.useEffect)(()=>{let c=()=>o();return window.addEventListener("resize",c),()=>window.removeEventListener("resize",c)},[o]),(0,Y.jsx)("canvas",{ref:t,className:"fz-stage-canvas",onPointerDown:c=>{if(i.current.set(c.pointerId,{x:c.clientX,y:c.clientY}),c.currentTarget.setPointerCapture(c.pointerId),i.current.size>=2){r();let m=[...i.current.values()];n.current={mode:"view",picked:null,moved:!0,lastX:m.reduce((S,v)=>S+v.x,0)/m.length,lastY:m.reduce((S,v)=>S+v.y,0)/m.length,az:0,el:0,travel:0,samples:[],pinchD:m.length===2?Math.hypot(m[0].x-m[1].x,m[0].y-m[1].y):0,snapshot:null,snapshotSel:null};return}if(e.mode==="look"){n.current={mode:"view",picked:null,moved:!1,lastX:c.clientX,lastY:c.clientY,az:0,el:0,travel:0,samples:[],pinchD:0,snapshot:null,snapshotSel:null};return}let l=c.currentTarget.getBoundingClientRect(),h=c.clientX-l.left,d=c.clientY-l.top,u=e.keyframes.findIndex(m=>{let S=xd(m,l.width,l.height,s.current);return Math.hypot(S.x-h,S.y-d)<20});u>=0&&e.onPick(u);let p=u>=0&&(e.keyframes[u]?.time===0||e.keyframes[u]?.time===1);n.current={mode:e.mode==="draw"?"draw":u<0||p?"none":"edit",picked:u>=0?u:null,moved:!1,lastX:c.clientX,lastY:c.clientY,az:0,el:0,travel:0,samples:[{azimuth:0,elevation:0}],pinchD:0,snapshot:e.keyframes,snapshotSel:e.selected}},onPointerMove:c=>{let l=n.current;if(!l)return;if(i.current.has(c.pointerId)&&i.current.set(c.pointerId,{x:c.clientX,y:c.clientY}),l.mode==="view"){let u=[...i.current.values()];if(u.length===0)return;let p=u.reduce((g,y)=>g+y.x,0)/u.length,m=u.reduce((g,y)=>g+y.y,0)/u.length,S=p-l.lastX,v=m-l.lastY,f=s.current;if(f.yaw-=S*.3,f.tilt=nn(f.tilt+v*.0035,-.5,.7),l.lastX=p,l.lastY=m,u.length===2){let g=Math.hypot(u[0].x-u[1].x,u[0].y-u[1].y);l.pinchD>0&&(f.zoom=nn(f.zoom*(g/l.pinchD),.7,2.2)),l.pinchD=g}else l.pinchD=0;o(),a.current.onViewChange(Math.abs(f.yaw)>.5||Math.abs(f.tilt)>.02||Math.abs(f.zoom-1)>.02);return}let h=c.clientX-l.lastX,d=c.clientY-l.lastY;if(!(Math.abs(h)+Math.abs(d)<.5)){if(l.lastX=c.clientX,l.lastY=c.clientY,l.moved=!0,l.mode==="edit"){e.onDragPose(h*.6,-d*.4,l.picked);return}l.mode!=="none"&&(l.travel+=Math.abs(h)+Math.abs(d),l.az=nn(l.az+h*.6,-360,360),l.el=nn(l.el-d*.4,-90,90),l.samples.length<600?l.samples.push({azimuth:l.az,elevation:l.el}):l.samples[l.samples.length-1]={azimuth:l.az,elevation:l.el},l.travel>=Co&&l.samples.length>=2&&(l.samples.length<4||l.samples.length%4===0)&&e.onDrawPath(l.samples))}},onPointerUp:c=>{i.current.delete(c.pointerId);let l=n.current;if(l?.mode==="view"){if(i.current.size===0)n.current=null;else{let h=[...i.current.values()];l.lastX=h.reduce((d,u)=>d+u.x,0)/h.length,l.lastY=h.reduce((d,u)=>d+u.y,0)/h.length,l.pinchD=h.length===2?Math.hypot(h[0].x-h[1].x,h[0].y-h[1].y):0}return}if(n.current=null,!!l){if(!l.moved){e.onPick(l.picked);return}l.mode==="draw"&&l.travel>=Co&&l.samples.length>=2&&e.onDrawPath(l.samples,!0)}},onPointerCancel:c=>{i.current.delete(c.pointerId);let l=n.current;if(l?.mode==="view"&&i.current.size>0){let h=[...i.current.values()];l.lastX=h.reduce((d,u)=>d+u.x,0)/h.length,l.lastY=h.reduce((d,u)=>d+u.y,0)/h.length,l.pinchD=h.length===2?Math.hypot(h[0].x-h[1].x,h[0].y-h[1].y):0;return}r(),n.current=null}})}function T3({kind:e}){let t={orbit:"M50 43a34 13 0 1 1 1 0l-5-4m5 4-5 3","orbit-left":"M50 43a34 13 0 1 0-1 0l5-4m-5 4 5 3",swing:"M50 43Q84 44 84 30Q82 20 67 19",rise:"M50 43Q88 43 77 18Q68 4 50 7","arc-return":"M50 43Q84 44 84 30Q82 20 67 19M67 23Q78 24 79 30Q79 39 50 39l5-4m-5 4 5 3","rise-return":"M46 43V10l-4 5m4-5 4 5M56 10v33l-4-5m4 5 4-5","arc-left-return":"M50 43Q16 44 16 30Q18 20 33 19M33 23Q22 24 21 30Q21 39 50 39l-5-4m5 4-5 3","wide-return":"M50 43C5 43 5 17 50 17C90 17 90 39 50 39l5-4m-5 4 5 3","dip-return":"M46 16v32l-4-5m4 5 4-5M56 48V16l-4 5m4-5 4 5","high-arc-return":"M50 43Q84 30 72 8M72 8Q76 30 50 39l5-5","low-arc-return":"M50 24Q16 30 28 49M28 49Q24 30 50 28l-5-4","sway-return":"M50 43Q16 43 16 30Q50 8 84 30Q84 43 50 43l5-4m-5 4 5 3",halo:"M50 43C96 43 91 5 50 5C9 5 4 43 50 43l-5-4m5 4-5 3","halo-left":"M50 43C4 43 9 5 50 5C91 5 96 43 50 43l5-4m-5 4 5 3","arc-left":"M50 43Q16 44 16 30Q18 20 33 19","low-angle":"M50 20Q85 20 78 48l-5-4m5 4 3-5"};return(0,Y.jsxs)("svg",{className:"fz-path",viewBox:"0 0 100 56","aria-hidden":"true",children:[(0,Y.jsx)("ellipse",{cx:"50",cy:"30",rx:"34",ry:"13",className:"fz-path-guide"}),(0,Y.jsx)("path",{d:"M50 13v25M43 33l7 5 7-5",className:"fz-path-axis"}),(0,Y.jsx)("circle",{cx:"50",cy:"29",r:"4",className:"fz-path-subject"}),(0,Y.jsx)("path",{className:"fz-path-motion",d:t[e]??t.orbit}),(0,Y.jsx)("circle",{cx:"50",cy:"43",r:"3",className:"fz-path-camera"})]})}function A3(e){let[t,n]=(0,at.useState)(e.initial.sourceAssetId?"camera":"source"),[i,s]=(0,at.useState)(e.initial.sourceUrl),[a,r]=(0,at.useState)(e.initial.sourceAssetId),[o,c]=(0,at.useState)(e.initial.hasClip===!0),[l,h]=(0,at.useState)(e.initial.renders),[d,u]=(0,at.useState)(e.initial.activeJob),[p,m]=(0,at.useState)(e.initial.latest),[S,v]=(0,at.useState)(!1),[f,g]=(0,at.useState)(null),[y,_]=(0,at.useState)(!1),[T,A]=(0,at.useState)(!1),[w,x]=(0,at.useState)(!1),[M,R]=(0,at.useState)(null),[D,I]=(0,at.useState)([z0,{time:.5,azimuth:65,elevation:8,distance:1},p3]),[q,J]=(0,at.useState)(0),[z,B]=(0,at.useState)(null),[V,j]=(0,at.useState)("draw"),[lt,ut]=(0,at.useState)(!1),ct=(0,at.useRef)(null),[ot,Nt]=(0,at.useState)(null),[Wt,kt]=(0,at.useState)(5),[K,et]=(0,at.useState)("768P"),[nt]=(0,at.useState)(()=>Math.floor(Math.random()*1e6)),Mt=(0,at.useRef)(null),[,Ut]=(0,at.useState)(0),wt=(0,at.useRef)(null),se=(0,at.useRef)(null),Pt=(0,at.useRef)(0),Ft=(0,at.useRef)(e.initial.sourceAssetId),Jt=(0,at.useRef)(null),Ht=(0,at.useRef)(null),de=(0,at.useCallback)(N=>{let U=Ht.current;U&&U!==N&&(URL.revokeObjectURL(U),Ht.current=null),N.startsWith("blob:")&&(Ht.current=N),s(N)},[]),Pe=(0,at.useCallback)(()=>{Ht.current&&(URL.revokeObjectURL(Ht.current),Ht.current=null),s(null)},[]);(0,at.useEffect)(()=>()=>{Ht.current&&URL.revokeObjectURL(Ht.current)},[]);let pe=(0,at.useCallback)((N,U=!1)=>{if(typeof N.latest=="number"&&m(N.latest),u(N.activeJob??null),N.line&&g(N.line),N.sourceUrl&&(U||N.sourceAssetId!==Ft.current)&&de(N.sourceUrl),N.sourceAssetId&&(Ft.current=N.sourceAssetId,r(N.sourceAssetId)),typeof N.hasClip=="boolean"&&c(N.hasClip),N.renders&&h(N.renders),M&&!N.activeJob){let $=(M.kind==="render"?N.renders:N.sketches)?.find(Z=>Z.jobId===M.id);$&&($.state==="delivered"||$.state==="failed")&&(R(null),$.state==="delivered"?M.kind==="render"?(g(null),n("result")):(_(!1),g("still delivered \u2014 set the camera move"),n("camera")):g($.error??"that didn't come out \u2014 try again?"))}},[M,de]);(0,at.useEffect)(()=>{let N=Jt.current;if(!N)return;let U=0,rt=()=>{U=0;let ht=N.getBoundingClientRect().left+N.clientWidth/2;for(let pt of Array.from(N.children)){let Gt=pt.getBoundingClientRect(),ae=(Gt.left+Gt.width/2-ht)/N.clientWidth*2.4,Mn=nn(ae,-1,1);pt.style.setProperty("--tilt",`${(-Mn*10).toFixed(2)}deg`),pt.style.setProperty("--pop",(1-Math.abs(Mn)*.12).toFixed(3))}},$=()=>{U||(U=requestAnimationFrame(rt))};return rt(),N.addEventListener("scroll",$,{passive:!0}),window.addEventListener("resize",$),()=>{N.removeEventListener("scroll",$),window.removeEventListener("resize",$),U&&cancelAnimationFrame(U)}},[t]);let We=(0,at.useRef)(0),le=(0,at.useCallback)(async()=>{let N=++We.current,U=await rr({action:"status",after:String(p)});if(!(!U||N!==We.current))return pe(U),U},[p,pe]),Le=(0,at.useCallback)(async N=>{for(let U=0;U<10;U++){if(Ft.current!==N)return;let rt=await le();if(Ft.current!==N)return;if(rt&&rt.sourceAssetId===N&&(pe(rt,!0),rt.sourceUrl)){g(null);return}await new Promise($=>setTimeout($,1200))}Ft.current===N&&g("still converting \u2014 back out and re-upload if it stalls")},[le,pe]),P=(0,at.useCallback)(()=>{let N=Date.now();N-Pt.current<3e4||(Pt.current=N,le().then(U=>{U&&pe(U,!0)}))},[le,pe]),sn=(0,at.useRef)(0);(0,at.useEffect)(()=>{let N=++sn.current;if(!i){Mt.current=null,Ut(rt=>rt+1);return}let U=new Image;U.crossOrigin="anonymous",U.onload=()=>{N===sn.current&&(Mt.current=U,Ut(rt=>rt+1))},U.onerror=()=>{N===sn.current&&P()},U.src=i},[i,P]),(0,at.useEffect)(()=>{if(!d)return;let N=!1,U=window.setInterval(()=>{N||(N=!0,le().finally(()=>{N=!1}))},2500);return()=>window.clearInterval(U)},[d,le]);let oe=(N,U)=>g(N?.line??U),C=(0,at.useCallback)(async(N,U)=>{if(!N||S)return;v(!0),g("reading the photo\u2026");let $=N.type.startsWith("image/")&&!/hei[cf]/i.test(N.type)?URL.createObjectURL(N):null,Z=new FormData;Z.set("action","source"),Z.set("file",N),U&&(Z.set("clipPath",U.path),Z.set("clipSha",U.sha),Z.set("clipBytes",String(U.bytes)),Z.set("clipIn",String(U.clipIn)),Z.set("clipOut",String(U.clipOut)),Z.set("freezeAt",String(U.freezeAt)));let ht=await rr(Z);if(v(!1),!ht||ht.error||ht.sourceAssetId===void 0){$&&URL.revokeObjectURL($),oe(ht,"that photo didn't come through \u2014 try another.");return}g(null),r(ht.sourceAssetId),typeof ht.hasClip=="boolean"&&c(ht.hasClip),_(!1),A(!1),Ft.current=ht.sourceAssetId,ht.sourceUrl?($&&URL.revokeObjectURL($),de(ht.sourceUrl)):$?de($):(Pe(),g("converting the photo\u2026")),n("camera"),le(),!ht.sourceUrl&&!$&&ht.sourceAssetId&&Le(ht.sourceAssetId)},[S,le,de,Pe,Le]),b=(0,at.useCallback)(async(N,U,rt)=>{if(S)return;v(!0),g("generating the still \u2014 about a minute");let $=new FormData;$.set("action","source"),$.set("kind","sketch"),$.set("prompt",U),$.set("mode",rt),N&&$.set("canvas",N,"sketch.png");let Z=await rr($);if(v(!1),!Z||Z.error||!Z.jobId){oe(Z,"that didn't work \u2014 try again?");return}R({id:Z.jobId,kind:"sketch"}),pe(Z),g("generating the still \u2014 about a minute")},[S,pe]),H=(0,at.useCallback)(N=>{Nt(N.id),kt(N.duration===6?6:5),I(N.trajectory.map(U=>({...U}))),B(null),J(0)},[]),X=(0,at.useCallback)(()=>{let N=nn(q,.02,.98);if(D.length>=vd||D.some($=>Math.abs($.time-N)<.01))return;let U=Ec(D,N),rt=[...D,{...U,time:N}].sort(($,Z)=>$.time-Z.time).map($=>({...$}));I(rt),B(null),Nt(null)},[D,q]),Q=(0,at.useCallback)(()=>{I(N=>{if(z===null||N.length<=2)return N;let U=N[z];return!U||U.time===0||U.time===1?N:N.filter((rt,$)=>$!==z)}),B(null),Nt(null)},[z]),ft=(0,at.useCallback)((N,U,rt)=>{x(!0),Nt(null),I($=>{let Z=rt??z;if(Z===null){let Gt=1/0;$.forEach((ae,Mn)=>{let zn=Math.abs(ae.time-q);zn<Gt&&(Gt=zn,Z=Mn)})}if(Z===null)return $;let ht=$[Z];if(!ht||ht.time===0||ht.time===1)return $;let pt=$.map((Gt,ae)=>ae===Z?{...Gt,azimuth:nn(Gt.azimuth+N,-360,360),elevation:nn(Gt.elevation+U,-90,90)}:Gt);return B(Z),pt})},[z,q]),mt=(0,at.useCallback)((N,U=!1)=>{if(N.length===0)return;let rt=Math.min(N.length,vd-1),$=[{...z0}];for(let pt=0;pt<rt-1;pt++){let Gt=Math.floor(pt*(N.length-1)/Math.max(1,rt-1)),ae=N[Math.min(Gt,N.length-1)];$.push({time:Number(((pt+1)/rt).toFixed(4)),azimuth:Math.round(ae.azimuth*10)/10,elevation:Math.round(ae.elevation*10)/10,distance:1})}let Z=N[N.length-1];$.push({time:1,azimuth:Math.round(Z.azimuth*10)/10,elevation:Math.round(Z.elevation*10)/10,distance:1});let ht=[];for(let pt of $){let Gt=ht[ht.length-1];Gt&&Math.abs(pt.azimuth-Gt.azimuth)<.05&&Math.abs(pt.elevation-Gt.elevation)<.05?ht[ht.length-1]={...Gt,time:ht.length===1?Gt.time:pt.time}:ht.push(pt)}ht.length<2||(I(ht),U?(x(!0),Nt(null),B(null),J(1)):B(pt=>pt!==null&&pt>=ht.length?null:pt))},[]),tt=(0,at.useCallback)((N,U)=>{I(N.map(rt=>({...rt}))),B(typeof U=="number"&&U>=0&&U<N.length?U:null)},[]),it=(0,at.useCallback)((N,U)=>{Nt(null),x(!0),I(rt=>rt.map(($,Z)=>Z!==N||$.time===0||$.time===1?$:{...$,...U.azimuth!==void 0?{azimuth:nn(U.azimuth,-360,360)}:{},...U.elevation!==void 0?{elevation:nn(U.elevation,-90,90)}:{}}))},[]),gt=(0,at.useCallback)(async()=>{if(S||!a||!i)return;v(!0),g("rendering the freeze \u2014 a few minutes");let N={action:"render",duration:String(Wt),resolution:K,seed:String(nt)};ot?N.preset=ot:N.trajectory=JSON.stringify(D);let U=await rr(N);if(v(!1),!U||U.error||!U.jobId){oe(U,"that render didn't start \u2014 try again?");return}R({id:U.jobId,kind:"render"}),pe(U),g("freezing \u2014 a few minutes")},[S,a,i,ot,K,nt,D,Wt,pe]),Et=(0,at.useCallback)(async N=>{if(S)return;v(!0),g("sending to iMessage\u2026");let U=await rr({action:"save",job:N});if(v(!1),!U||U.error){oe(U,"couldn't send it \u2014 try again");return}U.downloadUrl?(window.open(U.downloadUrl,"_blank","noopener"),g("sent the link \u2014 it's only good for a little while")):g("sent to iMessage")},[S]),vt=(0,at.useCallback)(async()=>{await rr({action:"cancel"}),R(null),g(null),await le()},[le]),dt=(0,at.useMemo)(()=>l.filter(N=>N.state==="delivered"&&N.outputUrl),[l]),Ct=dt[dt.length-1],Tt=z!==null&&z<D.length?z:null;if(Tt===null){let N=1/0;D.forEach((U,rt)=>{if(U.time===0||U.time===1)return;let $=Math.abs(U.time-q);$<N&&(N=$,Tt=rt)})}let Ot=Tt!==null?D[Tt]:void 0,O=!!Ot&&Ot.time!==0&&Ot.time!==1;return(0,Y.jsxs)("div",{className:"fz",children:[(0,Y.jsx)("div",{className:"fz-tabs",children:["source","camera","result"].map(N=>(0,Y.jsx)("button",{type:"button",className:t===N?"active":"",disabled:N==="camera"&&!a||N==="result"&&dt.length===0,onClick:()=>n(N),children:N==="source"?"1 \xB7 photo":N==="camera"?"2 \xB7 camera":"3 \xB7 freeze"},N))}),d&&(0,Y.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>void vt(),children:"cancel the running job"}),t==="source"&&(0,Y.jsx)("div",{className:"fz-stage",children:!y&&!T?(0,Y.jsxs)(Y.Fragment,{children:[(0,Y.jsxs)("div",{className:"fz-hero",children:[(0,Y.jsx)("p",{className:"fz-title",children:"freeze the scene"}),(0,Y.jsx)("p",{className:"fz-sub",children:"pick the still \u2014 the camera moves, the moment doesn\u2019t"})]}),(0,Y.jsxs)("div",{className:"fz-source-grid",children:[(0,Y.jsxs)("button",{type:"button",className:"fz-card",disabled:S,onClick:()=>se.current?.click(),children:[(0,Y.jsx)("span",{className:"fz-card-icon",children:"\u25C9"}),"take a photo"]}),(0,Y.jsxs)("button",{type:"button",className:"fz-card",disabled:S,onClick:()=>wt.current?.click(),children:[(0,Y.jsx)("span",{className:"fz-card-icon",children:"\u25A4"}),"upload a photo"]}),(0,Y.jsxs)("button",{type:"button",className:"fz-card",disabled:S,onClick:()=>_(!0),children:[(0,Y.jsx)("span",{className:"fz-card-icon",children:"\u270E"}),"sketch + generate"]}),(0,Y.jsxs)("button",{type:"button",className:"fz-card",disabled:S,onClick:()=>A(!0),children:[(0,Y.jsx)("span",{className:"fz-card-icon",children:"\u25B6"}),"video \u2192 freeze a frame",(0,Y.jsx)("span",{className:"fz-card-sub",children:"the clip splices back around it"})]})]}),(0,Y.jsx)("input",{ref:se,type:"file",accept:"image/*,.heic,.heif",capture:"environment",hidden:!0,onChange:N=>void C(N.target.files?.[0]??null)}),(0,Y.jsx)("input",{ref:wt,type:"file",accept:"image/*,.heic,.heif",hidden:!0,onChange:N=>void C(N.target.files?.[0]??null)}),dt.length>0&&(0,Y.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>n("result"),children:"see your freezes \u2192"})]}):y?(0,Y.jsxs)(Y.Fragment,{children:[(0,Y.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>_(!1),children:"\u2190 back"}),M?.kind==="sketch"&&(0,Y.jsx)(O0,{label:"generating the still",sub:"the camera stage opens when it lands"}),(0,Y.jsx)(g3,{busy:S||M?.kind==="sketch",onGenerate:b})]}):(0,Y.jsxs)(Y.Fragment,{children:[(0,Y.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>A(!1),children:"\u2190 back"}),(0,Y.jsx)(b3,{busy:S,onFrame:(N,U)=>void C(N,U)})]})}),t==="camera"&&(0,Y.jsxs)("div",{className:"fz-stage fz-cam",children:[(0,Y.jsxs)("div",{className:"fz-stage-wrap",children:[(0,Y.jsx)(M3,{image:Mt.current,keyframes:D,scrubT:q,selected:z,lite:e.initial.lite,mode:V,onViewChange:ut,viewCtl:ct,onDragPose:ft,onDrawPath:mt,onDrawRevert:tt,onPick:B}),lt&&(0,Y.jsx)("button",{type:"button",className:"fz-viewreset",onClick:()=>ct.current?.reset(),children:"reset view"}),!w&&(0,Y.jsxs)("div",{className:"fz-stage-hint",children:[(0,Y.jsx)("span",{className:"fz-stage-dot"}),V==="draw"?"drag to draw the camera path":V==="look"?"drag to look \u2014 pinch to zoom":"drag a dot to move it"]})]}),(0,Y.jsxs)("div",{className:"fz-modebar",role:"group","aria-label":"stage gesture",children:[(0,Y.jsx)("span",{className:"fz-ctl-label",children:"stage"}),(0,Y.jsxs)("div",{className:"fz-seg",children:[(0,Y.jsx)("button",{type:"button",className:V==="draw"?"active":"","aria-pressed":V==="draw",onClick:()=>j("draw"),children:"draw path"}),(0,Y.jsx)("button",{type:"button",className:V==="edit"?"active":"","aria-pressed":V==="edit",onClick:()=>j("edit"),children:"move dot"}),(0,Y.jsx)("button",{type:"button",className:V==="look"?"active":"","aria-pressed":V==="look",onClick:()=>j("look"),children:"look"})]})]}),(0,Y.jsx)("div",{className:"fz-ctl-label",children:"camera move"}),(0,Y.jsx)("div",{className:"fz-prail",ref:Jt,children:e.initial.presets.map(N=>(0,Y.jsxs)("button",{type:"button",className:`fz-preset${ot===N.id?" active":""}`,title:N.description,"aria-pressed":ot===N.id,onClick:()=>H(N),children:[(0,Y.jsx)(T3,{kind:N.id}),(0,Y.jsx)("span",{className:"fz-preset-name",children:N.name}),(0,Y.jsx)("span",{className:"fz-preset-return",children:N.returnsToStart?"returns to start":"new angle"})]},N.id))}),(0,Y.jsxs)("div",{className:"fz-timeline",children:[(0,Y.jsxs)("div",{className:"fz-timeline-meta",children:[(0,Y.jsxs)("span",{children:[(q*Wt).toFixed(2),"s / ",Wt,"s"]}),(0,Y.jsxs)("span",{children:[D.length," keyframes",ot?` \xB7 ${e.initial.presets.find(N=>N.id===ot)?.name??ot}`:" \xB7 drawn",z!==null&&(D[z].time===0||D[z].time===1?" \xB7 endpoint":` \xB7 kf ${z+1}`)]})]}),(0,Y.jsxs)("div",{className:"fz-track",onPointerDown:N=>{let U=N.currentTarget.getBoundingClientRect(),rt=N.clientX-U.left,$=null,Z=23;D.forEach((ht,pt)=>{let Gt=Math.abs(ht.time*U.width-rt);Gt<Z&&(Z=Gt,$=pt)}),$!==null?(B($),J(D[$].time)):J(nn(rt/U.width,0,1)),N.currentTarget.setPointerCapture(N.pointerId)},onPointerMove:N=>{if(N.buttons!==1)return;let U=N.currentTarget.getBoundingClientRect();J(nn((N.clientX-U.left)/U.width,0,1))},children:[(0,Y.jsx)("div",{className:"fz-track-ticks"}),D.map((N,U)=>(0,Y.jsx)("button",{type:"button",className:`fz-kf${z===U?" selected":""}`,style:{left:`${N.time*100}%`},onClick:()=>{B(U),J(N.time)},"aria-label":`keyframe ${U+1} at ${Math.round(N.time*100)}%`},U)),(0,Y.jsx)("div",{className:"fz-head",style:{left:`${q*100}%`},children:(0,Y.jsx)("i",{})})]}),(0,Y.jsxs)("div",{className:"fz-timeline-row",children:[(0,Y.jsx)("span",{className:"fz-meta",children:z!==null?D[z].time===0||D[z].time===1?"endpoints hold the framing":"move this dot with the sliders or the scene":V==="draw"?"drag the scene to sketch the path":V==="look"?"drag to look around \u2014 pinch to zoom":"drag a dot to move it"}),(0,Y.jsxs)("div",{className:"fz-timeline-actions",children:[(0,Y.jsx)("button",{type:"button",className:"fz-ghost",disabled:D.length>=vd,onClick:X,children:"+ keyframe"}),(0,Y.jsx)("button",{type:"button",className:"fz-ghost",disabled:z===null||D[z]?.time===0||D[z]?.time===1,onClick:Q,children:"\u2212 remove"})]})]})]}),(0,Y.jsxs)("div",{className:"fz-aim",children:[(0,Y.jsx)("div",{className:"fz-ctl-label",children:O?`aim \u2014 keyframe ${(Tt??0)+1}`:"aim \u2014 tap a middle dot on the timeline"}),(0,Y.jsxs)("div",{className:"fz-aim-row",children:[(0,Y.jsx)("span",{className:"fz-aim-label",children:"orbit"}),(0,Y.jsx)("input",{type:"range",min:-360,max:360,step:1,value:Ot?.azimuth??0,disabled:!O,"aria-label":"orbit angle in degrees",onChange:N=>{Tt!==null&&it(Tt,{azimuth:Number(N.target.value)})}}),(0,Y.jsx)("span",{className:"fz-aim-val",children:O&&Ot?`${Math.round(Ot.azimuth)}\xB0`:"\u2014"})]}),(0,Y.jsxs)("div",{className:"fz-aim-row",children:[(0,Y.jsx)("span",{className:"fz-aim-label",children:"height"}),(0,Y.jsx)("input",{type:"range",min:-90,max:90,step:1,value:Ot?.elevation??0,disabled:!O,"aria-label":"camera height in degrees",onChange:N=>{Tt!==null&&it(Tt,{elevation:Number(N.target.value)})}}),(0,Y.jsx)("span",{className:"fz-aim-val",children:O&&Ot?`${Math.round(Ot.elevation)}\xB0`:"\u2014"})]})]}),M?.kind==="render"&&(0,Y.jsx)(O0,{label:o?"freezing into your clip":"freezing",sub:"a few minutes \u2014 the result tab lights up"}),o&&!M&&(0,Y.jsx)("p",{className:"fz-meta",children:"this freeze splices back into your clip"}),(0,Y.jsxs)("div",{className:"fz-render-row",children:[(0,Y.jsx)("div",{className:"fz-seg",children:[5,6].map(N=>(0,Y.jsxs)("button",{type:"button",className:Wt===N?"active":"",onClick:()=>kt(N),children:[N,"s"]},N))}),(0,Y.jsx)("div",{className:"fz-seg",children:["480P","768P","1080P"].map(N=>(0,Y.jsx)("button",{type:"button",className:K===N?"active":"",onClick:()=>et(N),children:N==="480P"?"480":N==="768P"?"720":"1080"},N))}),(0,Y.jsx)("button",{type:"button",className:"fz-primary",disabled:S||!a||!i||M!==null,onClick:()=>void gt(),children:M?.kind==="render"||S?"freezing\u2026":"freeze it"})]})]}),t==="result"&&(0,Y.jsxs)("div",{className:"fz-stage",children:[Ct?(0,Y.jsxs)("div",{className:"fz-result",children:[(0,Y.jsx)("video",{className:"fz-video",src:Ct.outputUrl??void 0,controls:!0,playsInline:!0,loop:!0,autoPlay:!0,muted:!0,onError:P}),(0,Y.jsxs)("div",{className:"fz-actions",children:[(0,Y.jsx)("button",{type:"button",className:"fz-primary",disabled:S,onClick:()=>void Et(Ct.jobId),children:"send to iMessage"}),(0,Y.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>n("camera"),children:"new camera move"})]})]}):d?(0,Y.jsx)(O0,{label:o?"freezing into your clip":"freezing",sub:"the camera move renders, then splices in \u2014 a few minutes"}):(0,Y.jsx)("p",{className:"fz-sub",children:"nothing rendered yet"}),dt.length>1&&(0,Y.jsx)("div",{className:"fz-history",children:dt.slice(0,-1).reverse().map(N=>(0,Y.jsxs)("div",{className:"fz-history-row",children:[(0,Y.jsx)("video",{className:"fz-thumb",src:N.outputUrl??void 0,muted:!0,playsInline:!0,preload:"metadata",onError:P}),(0,Y.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>void Et(N.jobId),children:"send"})]},N.jobId))})]}),(0,Y.jsx)("p",{className:"fz-line",children:f??""})]})}var w3=`
.fz{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;font-family:var(--font-ui,ui-monospace,monospace);color:#d6e9e2}
.fz-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:#101415;border:1px solid #2c3c35;border-radius:12px;padding:3px}
.fz-tabs button{min-height:40px;border:0;border-radius:9px;background:transparent;color:#7f9090;font-weight:700;font-size:0.72rem;letter-spacing:0.04em;text-transform:uppercase}
.fz-tabs button.active{background:#20382e;color:#d1eadd}
.fz-tabs button:disabled{opacity:0.35}
.fz-stage{display:flex;flex-direction:column;gap:10px;flex:1;min-height:0}
.fz-cam{background:#101415;border:1px solid #2c3c35;border-radius:18px;padding:12px}
.fz-hero{text-align:center;padding:14px 8px 4px}
.fz-title{margin:0;color:#f0f5f4;font-size:1.5rem;font-weight:800;letter-spacing:-0.02em}
.fz-sub{margin:6px 0 0;color:#8da59b;font-size:0.8rem}
.fz-source-grid{display:grid;grid-template-columns:1fr;gap:10px;padding:10px 4px}
.fz-card{display:flex;align-items:center;gap:14px;min-height:84px;padding:16px;border:1px solid #344943;border-radius:14px;background:#1b2925;color:#d6e9e2;font-size:1rem;font-weight:700;text-align:left;box-shadow:0 8px 24px #0005}
.fz-card-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;background:#14211d;border:1px solid #2c3c35;color:#cbe4d9;font-size:1.3rem;flex:0 0 46px}
.fz-card:active{transform:translateY(1px)}
.fz-card:disabled{opacity:0.5}
.fz-sketch{display:flex;flex-direction:column;gap:8px}
.fz-sketch-canvas{width:100%;aspect-ratio:1;border-radius:14px;background:#0b1011;border:1px solid #344943;touch-action:none}
.fz-tools{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.fz-swatch{display:block;width:32px;min-height:32px;padding:0;border:2px solid #d6e9e233;border-radius:50%;flex:0 0 32px}
.fz-swatch.selected{border-color:#f0f5f4;outline:2px solid #cbe4d9;outline-offset:2px}
.fz-size{flex:1;min-width:70px;accent-color:#8fd4bd}
.fz-prompt{width:100%;min-height:3rem;max-height:6rem;font-size:1rem;padding:10px 12px;background:#14211d;border:1px solid #2c3c35;border-radius:10px;color:#d6e9e2;font-family:inherit;resize:vertical}
.fz-prompt::placeholder{color:#5f7169}
.fz-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;background:#101415;border:1px solid #2c3c35;border-radius:12px;padding:3px}
.fz-modes button{display:grid;place-items:center;min-height:44px;border:0;border-radius:9px;background:transparent;color:#7f9090;font-size:0.66rem;font-weight:700;padding:4px}
.fz-modes button.active{background:#20382e;color:#d1eadd}
.fz-stage-wrap{position:relative;flex:1;min-height:240px;border-radius:16px;overflow:hidden;background:radial-gradient(120% 90% at 50% 12%,#131f1d 0%,#0b1011 62%);border:1px solid #2c3c35}
.fz-stage-canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair}
.fz-modebar{display:flex;align-items:center;gap:10px;padding:0 2px}
.fz-modebar .fz-seg{flex:1}
.fz-modebar .fz-seg button{flex:1}
.fz-viewreset{position:absolute;bottom:10px;right:10px;z-index:3;min-width:0;min-height:0;border:1px solid #35524b;border-radius:16px;padding:7px 12px;background:#0d181bd9;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-size:10.5px;font-weight:700;color:#b9e8d4;letter-spacing:.04em;text-transform:uppercase}
.fz-viewreset:active{background:#20382e;color:#dff5ec}
.fz-stage-hint{position:absolute;left:50%;top:12px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;border-radius:20px;padding:8px 12px;background:#0d181bc7;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-size:11px;color:#dbe7e4;pointer-events:none;z-index:2;white-space:nowrap}
.fz-stage-dot{width:5px;height:5px;border-radius:50%;background:#b4dcce;flex:0 0 5px}
.fz-ctl-label{color:#8d9e9c;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;padding:0 2px}
.fz-prail{display:flex;gap:8px;overflow-x:auto;padding:6px 2px 10px;-webkit-overflow-scrolling:touch;scrollbar-width:none;perspective:640px}
.fz-prail::-webkit-scrollbar{display:none}
.fz-preset{flex:0 0 118px;display:flex;flex-direction:column;gap:3px;padding:10px 10px 9px;border:1px solid #344943;border-radius:14px;background:#1b2925;color:#9fc4b4;text-align:left;transform:rotateY(var(--tilt,0deg)) scale(var(--pop,1));will-change:transform}
.fz-preset.active{background:#20382e;border-color:#5f8577;color:#d1eadd}
.fz-path{display:block;width:100%;height:auto;max-height:64px}
.fz-path-guide,.fz-path-axis{stroke:currentColor;stroke-width:0.7;opacity:0.25;fill:none}
.fz-path-subject{fill:currentColor;opacity:0.6}
.fz-path-motion{stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round}
.fz-path-camera{fill:currentColor}
.fz-preset-name{font-size:12px;font-weight:600;color:#d6e9e2;white-space:nowrap}
.fz-preset-return{font-size:10px;color:#8da59b;white-space:nowrap}
.fz-timeline{display:flex;flex-direction:column;gap:6px;padding:0 2px}
.fz-timeline-meta{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:#9aa9a8}
.fz-timeline-meta span:last-child{font-variant-numeric:tabular-nums;color:#c5d2d0;text-align:right}
.fz-track{position:relative;height:44px;touch-action:none;cursor:pointer;background:#1d2728;border-radius:7px}
.fz-track-ticks{position:absolute;inset:12px 8px;background:repeating-linear-gradient(90deg,#354445 0,#354445 1px,transparent 1px,transparent 14px);opacity:0.65;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);pointer-events:none}
.fz-kf{position:absolute;top:50%;width:14px;height:14px;min-width:0;min-height:0;margin:-7px 0 0 -7px;padding:0;border:2px solid #8fd4bd;border-radius:50%;background:#0d181b;pointer-events:none}
/* The ring reads as the touch affordance; the track resolves the tap */
.fz-kf::after{content:"";position:absolute;inset:-16px;border-radius:50%}
.fz-kf.selected{background:#d1eadd;border-color:#d1eadd}
.fz-head{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:#d1eadd;box-shadow:0 0 12px #d1eadd30;pointer-events:none}
.fz-head i{position:absolute;top:-4px;left:-3px;width:8px;height:8px;border-radius:2px;background:#d1eadd}
.fz-aim{display:flex;flex-direction:column;gap:4px;padding:8px 12px 10px;border:1px solid #2c3c35;border-radius:12px;background:#0f1514}
.fz-aim .fz-ctl-label{padding:0 0 2px}
.fz-aim-row{display:flex;align-items:center;gap:10px}
.fz-aim-label{flex:0 0 46px;font-size:0.64rem;letter-spacing:0.08em;text-transform:uppercase;color:#8da59b}
.fz-aim input[type="range"]{flex:1;appearance:none;-webkit-appearance:none;height:40px;margin:0;background:transparent}
.fz-aim input[type="range"]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:#2c3c35}
.fz-aim input[type="range"]::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:26px;height:26px;margin-top:-11px;border:0;border-radius:50%;background:#8fd4bd}
.fz-aim input[type="range"]::-moz-range-track{height:4px;border-radius:2px;background:#2c3c35}
.fz-aim input[type="range"]::-moz-range-thumb{width:26px;height:26px;border:0;border-radius:50%;background:#8fd4bd}
.fz-aim input[type="range"]:disabled{opacity:0.35}
.fz-aim-val{flex:0 0 42px;text-align:right;font-size:0.68rem;color:#c5d2d0;font-variant-numeric:tabular-nums}
.fz-timeline-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.fz-meta{color:#8da59b;font-size:0.66rem}
.fz-timeline-actions{display:flex;gap:6px}
.fz-render-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fz-seg{display:flex;background:#101415;border:1px solid #2c3c35;border-radius:10px;padding:2px;flex:0 0 auto}
.fz-seg button{min-width:44px;min-height:38px;border:0;border-radius:8px;background:transparent;color:#7f9090;font-size:0.7rem;font-weight:700}
.fz-seg button.active{background:#20382e;color:#d1eadd}
.fz-primary{flex:1 1 100%;min-height:46px;border:0;border-radius:26px;background:#cbe4d9;color:#193329;font-weight:600;font-size:0.9rem;letter-spacing:0.01em}
.fz-primary:disabled{opacity:0.4}
.fz-ghost{min-height:38px;padding:8px 12px;border:1px solid #344943;border-radius:10px;background:transparent;color:#a6b9b5;font-weight:600;font-size:0.7rem;letter-spacing:0.04em;text-transform:uppercase}
.fz-ghost:disabled{opacity:0.35}
.fz-ghost.selected{border-color:#5f8577;color:#d1eadd}
.fz-result{display:flex;flex-direction:column;gap:10px}
.fz-video{width:100%;border-radius:14px;background:#000;max-height:56vh}
.fz-framepick{display:flex;flex-direction:column;gap:8px}
.fz-video-empty{display:flex;flex-direction:column;gap:10px;align-items:center;padding:18px 8px}
.fz-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.fz-strip img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;border:1px solid #2c3c35;display:block;filter:brightness(0.85)}
.fz-scrub{width:100%;min-height:36px;accent-color:#cbe4d9;touch-action:pan-x}
.fz-win{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:1px dashed #35524b;border-radius:10px;background:#14211d}
.fz-card-sub{display:block;font-size:0.66rem;font-weight:500;color:#8da59b;letter-spacing:0.02em}
.fz-dither{position:relative;min-height:150px;border-radius:16px;overflow:hidden;border:1px solid #2c3c35;background:#0d1312;isolation:isolate}
.fz-dither-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.fz-dither-label{position:relative;z-index:1;display:flex;flex-direction:column;gap:3px;align-items:center;justify-content:center;min-height:150px;padding:14px;text-align:center}
.fz-dither-label b{color:#e6f5ee;font-size:0.85rem;letter-spacing:0.02em}
.fz-dither-label span{color:#8da59b;font-size:0.7rem}
.fz-row{display:flex;gap:8px;align-items:center}
.fz-err{margin:0;text-align:center;font-size:0.72rem;color:#e8a9a9}
.fz-actions{display:flex;gap:8px;flex-wrap:wrap}
.fz-history{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.fz-history-row{display:flex;align-items:center;gap:10px}
.fz-thumb{width:88px;border-radius:8px;background:#000}
.fz-line{margin:0;min-height:1rem;text-align:center;font-size:0.72rem;color:#83968f}
@media(prefers-reduced-motion:reduce){.fz-card,.fz-primary{transition:none}}
`,P0=document.getElementById("freeze-studio");if(P0){let e=null;try{e=JSON.parse(P0.dataset.payload??"")}catch{e=null}if(e){let t=document.createElement("style");t.textContent=w3,document.head.appendChild(t),(0,NM.createRoot)(P0).render((0,Y.jsx)(at.StrictMode,{children:(0,Y.jsx)(A3,{initial:e})}))}}})();
/*! Bundled license information:

react/cjs/react.production.js:
  (**
   * @license React
   * react.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

scheduler/cjs/scheduler.production.js:
  (**
   * @license React
   * scheduler.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-dom/cjs/react-dom.production.js:
  (**
   * @license React
   * react-dom.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-dom/cjs/react-dom-client.production.js:
  (**
   * @license React
   * react-dom-client.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react-jsx-runtime.production.js:
  (**
   * @license React
   * react-jsx-runtime.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

three/build/three.core.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)

three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
