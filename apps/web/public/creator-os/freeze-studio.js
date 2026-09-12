"use strict";(()=>{var IM=Object.create;var V0=Object.defineProperty;var OM=Object.getOwnPropertyDescriptor;var PM=Object.getOwnPropertyNames;var zM=Object.getPrototypeOf,BM=Object.prototype.hasOwnProperty;var Ri=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var FM=(e,t,n,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of PM(t))!BM.call(e,s)&&s!==n&&V0(e,s,{get:()=>t[s],enumerable:!(i=OM(t,s))||i.enumerable});return e};var Tc=(e,t,n)=>(n=e!=null?IM(zM(e)):{},FM(t||!e||!e.__esModule?V0(n,"default",{value:e,enumerable:!0}):n,e));var j0=Ri(zt=>{"use strict";var Sd=Symbol.for("react.transitional.element"),VM=Symbol.for("react.portal"),HM=Symbol.for("react.fragment"),GM=Symbol.for("react.strict_mode"),kM=Symbol.for("react.profiler"),XM=Symbol.for("react.consumer"),WM=Symbol.for("react.context"),qM=Symbol.for("react.forward_ref"),YM=Symbol.for("react.suspense"),ZM=Symbol.for("react.memo"),W0=Symbol.for("react.lazy"),JM=Symbol.for("react.activity"),H0=Symbol.iterator;function KM(e){return e===null||typeof e!="object"?null:(e=H0&&e[H0]||e["@@iterator"],typeof e=="function"?e:null)}var q0={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},Y0=Object.assign,Z0={};function sr(e,t,n){this.props=e,this.context=t,this.refs=Z0,this.updater=n||q0}sr.prototype.isReactComponent={};sr.prototype.setState=function(e,t){if(typeof e!="object"&&typeof e!="function"&&e!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,t,"setState")};sr.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};function J0(){}J0.prototype=sr.prototype;function bd(e,t,n){this.props=e,this.context=t,this.refs=Z0,this.updater=n||q0}var Md=bd.prototype=new J0;Md.constructor=bd;Y0(Md,sr.prototype);Md.isPureReactComponent=!0;var G0=Array.isArray;function xd(){}var Se={H:null,A:null,T:null,S:null},K0=Object.prototype.hasOwnProperty;function Ed(e,t,n){var i=n.ref;return{$$typeof:Sd,type:e,key:t,ref:i!==void 0?i:null,props:n}}function jM(e,t){return Ed(e.type,t,e.props)}function Td(e){return typeof e=="object"&&e!==null&&e.$$typeof===Sd}function QM(e){var t={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,function(n){return t[n]})}var k0=/\/+/g;function yd(e,t){return typeof e=="object"&&e!==null&&e.key!=null?QM(""+e.key):t.toString(36)}function $M(e){switch(e.status){case"fulfilled":return e.value;case"rejected":throw e.reason;default:switch(typeof e.status=="string"?e.then(xd,xd):(e.status="pending",e.then(function(t){e.status==="pending"&&(e.status="fulfilled",e.value=t)},function(t){e.status==="pending"&&(e.status="rejected",e.reason=t)})),e.status){case"fulfilled":return e.value;case"rejected":throw e.reason}}throw e}function ir(e,t,n,i,s){var a=typeof e;(a==="undefined"||a==="boolean")&&(e=null);var r=!1;if(e===null)r=!0;else switch(a){case"bigint":case"string":case"number":r=!0;break;case"object":switch(e.$$typeof){case Sd:case VM:r=!0;break;case W0:return r=e._init,ir(r(e._payload),t,n,i,s)}}if(r)return s=s(e),r=i===""?"."+yd(e,0):i,G0(s)?(n="",r!=null&&(n=r.replace(k0,"$&/")+"/"),ir(s,t,n,"",function(c){return c})):s!=null&&(Td(s)&&(s=jM(s,n+(s.key==null||e&&e.key===s.key?"":(""+s.key).replace(k0,"$&/")+"/")+r)),t.push(s)),1;r=0;var o=i===""?".":i+":";if(G0(e))for(var l=0;l<e.length;l++)i=e[l],a=o+yd(i,l),r+=ir(i,t,n,a,s);else if(l=KM(e),typeof l=="function")for(e=l.call(e),l=0;!(i=e.next()).done;)i=i.value,a=o+yd(i,l++),r+=ir(i,t,n,a,s);else if(a==="object"){if(typeof e.then=="function")return ir($M(e),t,n,i,s);throw t=String(e),Error("Objects are not valid as a React child (found: "+(t==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":t)+"). If you meant to render a collection of children, use an array instead.")}return r}function Ac(e,t,n){if(e==null)return e;var i=[],s=0;return ir(e,i,"","",function(a){return t.call(n,a,s++)}),i}function t1(e){if(e._status===-1){var t=e._result;t=t(),t.then(function(n){(e._status===0||e._status===-1)&&(e._status=1,e._result=n)},function(n){(e._status===0||e._status===-1)&&(e._status=2,e._result=n)}),e._status===-1&&(e._status=0,e._result=t)}if(e._status===1)return e._result.default;throw e._result}var X0=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},e1={map:Ac,forEach:function(e,t,n){Ac(e,function(){t.apply(this,arguments)},n)},count:function(e){var t=0;return Ac(e,function(){t++}),t},toArray:function(e){return Ac(e,function(t){return t})||[]},only:function(e){if(!Td(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};zt.Activity=JM;zt.Children=e1;zt.Component=sr;zt.Fragment=HM;zt.Profiler=kM;zt.PureComponent=bd;zt.StrictMode=GM;zt.Suspense=YM;zt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=Se;zt.__COMPILER_RUNTIME={__proto__:null,c:function(e){return Se.H.useMemoCache(e)}};zt.cache=function(e){return function(){return e.apply(null,arguments)}};zt.cacheSignal=function(){return null};zt.cloneElement=function(e,t,n){if(e==null)throw Error("The argument must be a React element, but you passed "+e+".");var i=Y0({},e.props),s=e.key;if(t!=null)for(a in t.key!==void 0&&(s=""+t.key),t)!K0.call(t,a)||a==="key"||a==="__self"||a==="__source"||a==="ref"&&t.ref===void 0||(i[a]=t[a]);var a=arguments.length-2;if(a===1)i.children=n;else if(1<a){for(var r=Array(a),o=0;o<a;o++)r[o]=arguments[o+2];i.children=r}return Ed(e.type,s,i)};zt.createContext=function(e){return e={$$typeof:WM,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null},e.Provider=e,e.Consumer={$$typeof:XM,_context:e},e};zt.createElement=function(e,t,n){var i,s={},a=null;if(t!=null)for(i in t.key!==void 0&&(a=""+t.key),t)K0.call(t,i)&&i!=="key"&&i!=="__self"&&i!=="__source"&&(s[i]=t[i]);var r=arguments.length-2;if(r===1)s.children=n;else if(1<r){for(var o=Array(r),l=0;l<r;l++)o[l]=arguments[l+2];s.children=o}if(e&&e.defaultProps)for(i in r=e.defaultProps,r)s[i]===void 0&&(s[i]=r[i]);return Ed(e,a,s)};zt.createRef=function(){return{current:null}};zt.forwardRef=function(e){return{$$typeof:qM,render:e}};zt.isValidElement=Td;zt.lazy=function(e){return{$$typeof:W0,_payload:{_status:-1,_result:e},_init:t1}};zt.memo=function(e,t){return{$$typeof:ZM,type:e,compare:t===void 0?null:t}};zt.startTransition=function(e){var t=Se.T,n={};Se.T=n;try{var i=e(),s=Se.S;s!==null&&s(n,i),typeof i=="object"&&i!==null&&typeof i.then=="function"&&i.then(xd,X0)}catch(a){X0(a)}finally{t!==null&&n.types!==null&&(t.types=n.types),Se.T=t}};zt.unstable_useCacheRefresh=function(){return Se.H.useCacheRefresh()};zt.use=function(e){return Se.H.use(e)};zt.useActionState=function(e,t,n){return Se.H.useActionState(e,t,n)};zt.useCallback=function(e,t){return Se.H.useCallback(e,t)};zt.useContext=function(e){return Se.H.useContext(e)};zt.useDebugValue=function(){};zt.useDeferredValue=function(e,t){return Se.H.useDeferredValue(e,t)};zt.useEffect=function(e,t){return Se.H.useEffect(e,t)};zt.useEffectEvent=function(e){return Se.H.useEffectEvent(e)};zt.useId=function(){return Se.H.useId()};zt.useImperativeHandle=function(e,t,n){return Se.H.useImperativeHandle(e,t,n)};zt.useInsertionEffect=function(e,t){return Se.H.useInsertionEffect(e,t)};zt.useLayoutEffect=function(e,t){return Se.H.useLayoutEffect(e,t)};zt.useMemo=function(e,t){return Se.H.useMemo(e,t)};zt.useOptimistic=function(e,t){return Se.H.useOptimistic(e,t)};zt.useReducer=function(e,t,n){return Se.H.useReducer(e,t,n)};zt.useRef=function(e){return Se.H.useRef(e)};zt.useState=function(e){return Se.H.useState(e)};zt.useSyncExternalStore=function(e,t,n){return Se.H.useSyncExternalStore(e,t,n)};zt.useTransition=function(){return Se.H.useTransition()};zt.version="19.2.8"});var wc=Ri((b3,Q0)=>{"use strict";Q0.exports=j0()});var l_=Ri(Ce=>{"use strict";function Rd(e,t){var n=e.length;e.push(t);t:for(;0<n;){var i=n-1>>>1,s=e[i];if(0<Cc(s,t))e[i]=t,e[n]=s,n=i;else break t}}function Di(e){return e.length===0?null:e[0]}function Dc(e){if(e.length===0)return null;var t=e[0],n=e.pop();if(n!==t){e[0]=n;t:for(var i=0,s=e.length,a=s>>>1;i<a;){var r=2*(i+1)-1,o=e[r],l=r+1,c=e[l];if(0>Cc(o,n))l<s&&0>Cc(c,o)?(e[i]=c,e[l]=n,i=l):(e[i]=o,e[r]=n,i=r);else if(l<s&&0>Cc(c,n))e[i]=c,e[l]=n,i=l;else break t}}return t}function Cc(e,t){var n=e.sortIndex-t.sortIndex;return n!==0?n:e.id-t.id}Ce.unstable_now=void 0;typeof performance=="object"&&typeof performance.now=="function"?($0=performance,Ce.unstable_now=function(){return $0.now()}):(Ad=Date,t_=Ad.now(),Ce.unstable_now=function(){return Ad.now()-t_});var $0,Ad,t_,Ji=[],Cs=[],n1=1,ei=null,gn=3,Dd=!1,Eo=!1,To=!1,Ud=!1,i_=typeof setTimeout=="function"?setTimeout:null,s_=typeof clearTimeout=="function"?clearTimeout:null,e_=typeof setImmediate<"u"?setImmediate:null;function Rc(e){for(var t=Di(Cs);t!==null;){if(t.callback===null)Dc(Cs);else if(t.startTime<=e)Dc(Cs),t.sortIndex=t.expirationTime,Rd(Ji,t);else break;t=Di(Cs)}}function Nd(e){if(To=!1,Rc(e),!Eo)if(Di(Ji)!==null)Eo=!0,rr||(rr=!0,ar());else{var t=Di(Cs);t!==null&&Ld(Nd,t.startTime-e)}}var rr=!1,Ao=-1,a_=5,r_=-1;function o_(){return Ud?!0:!(Ce.unstable_now()-r_<a_)}function wd(){if(Ud=!1,rr){var e=Ce.unstable_now();r_=e;var t=!0;try{t:{Eo=!1,To&&(To=!1,s_(Ao),Ao=-1),Dd=!0;var n=gn;try{e:{for(Rc(e),ei=Di(Ji);ei!==null&&!(ei.expirationTime>e&&o_());){var i=ei.callback;if(typeof i=="function"){ei.callback=null,gn=ei.priorityLevel;var s=i(ei.expirationTime<=e);if(e=Ce.unstable_now(),typeof s=="function"){ei.callback=s,Rc(e),t=!0;break e}ei===Di(Ji)&&Dc(Ji),Rc(e)}else Dc(Ji);ei=Di(Ji)}if(ei!==null)t=!0;else{var a=Di(Cs);a!==null&&Ld(Nd,a.startTime-e),t=!1}}break t}finally{ei=null,gn=n,Dd=!1}t=void 0}}finally{t?ar():rr=!1}}}var ar;typeof e_=="function"?ar=function(){e_(wd)}:typeof MessageChannel<"u"?(Cd=new MessageChannel,n_=Cd.port2,Cd.port1.onmessage=wd,ar=function(){n_.postMessage(null)}):ar=function(){i_(wd,0)};var Cd,n_;function Ld(e,t){Ao=i_(function(){e(Ce.unstable_now())},t)}Ce.unstable_IdlePriority=5;Ce.unstable_ImmediatePriority=1;Ce.unstable_LowPriority=4;Ce.unstable_NormalPriority=3;Ce.unstable_Profiling=null;Ce.unstable_UserBlockingPriority=2;Ce.unstable_cancelCallback=function(e){e.callback=null};Ce.unstable_forceFrameRate=function(e){0>e||125<e?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):a_=0<e?Math.floor(1e3/e):5};Ce.unstable_getCurrentPriorityLevel=function(){return gn};Ce.unstable_next=function(e){switch(gn){case 1:case 2:case 3:var t=3;break;default:t=gn}var n=gn;gn=t;try{return e()}finally{gn=n}};Ce.unstable_requestPaint=function(){Ud=!0};Ce.unstable_runWithPriority=function(e,t){switch(e){case 1:case 2:case 3:case 4:case 5:break;default:e=3}var n=gn;gn=e;try{return t()}finally{gn=n}};Ce.unstable_scheduleCallback=function(e,t,n){var i=Ce.unstable_now();switch(typeof n=="object"&&n!==null?(n=n.delay,n=typeof n=="number"&&0<n?i+n:i):n=i,e){case 1:var s=-1;break;case 2:s=250;break;case 5:s=1073741823;break;case 4:s=1e4;break;default:s=5e3}return s=n+s,e={id:n1++,callback:t,priorityLevel:e,startTime:n,expirationTime:s,sortIndex:-1},n>i?(e.sortIndex=n,Rd(Cs,e),Di(Ji)===null&&e===Di(Cs)&&(To?(s_(Ao),Ao=-1):To=!0,Ld(Nd,n-i))):(e.sortIndex=s,Rd(Ji,e),Eo||Dd||(Eo=!0,rr||(rr=!0,ar()))),e};Ce.unstable_shouldYield=o_;Ce.unstable_wrapCallback=function(e){var t=gn;return function(){var n=gn;gn=t;try{return e.apply(this,arguments)}finally{gn=n}}}});var u_=Ri((E3,c_)=>{"use strict";c_.exports=l_()});var f_=Ri(Mn=>{"use strict";var i1=wc();function h_(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function Rs(){}var bn={d:{f:Rs,r:function(){throw Error(h_(522))},D:Rs,C:Rs,L:Rs,m:Rs,X:Rs,S:Rs,M:Rs},p:0,findDOMNode:null},s1=Symbol.for("react.portal");function a1(e,t,n){var i=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:s1,key:i==null?null:""+i,children:e,containerInfo:t,implementation:n}}var wo=i1.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function Uc(e,t){if(e==="font")return"";if(typeof t=="string")return t==="use-credentials"?t:""}Mn.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=bn;Mn.createPortal=function(e,t){var n=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!t||t.nodeType!==1&&t.nodeType!==9&&t.nodeType!==11)throw Error(h_(299));return a1(e,t,null,n)};Mn.flushSync=function(e){var t=wo.T,n=bn.p;try{if(wo.T=null,bn.p=2,e)return e()}finally{wo.T=t,bn.p=n,bn.d.f()}};Mn.preconnect=function(e,t){typeof e=="string"&&(t?(t=t.crossOrigin,t=typeof t=="string"?t==="use-credentials"?t:"":void 0):t=null,bn.d.C(e,t))};Mn.prefetchDNS=function(e){typeof e=="string"&&bn.d.D(e)};Mn.preinit=function(e,t){if(typeof e=="string"&&t&&typeof t.as=="string"){var n=t.as,i=Uc(n,t.crossOrigin),s=typeof t.integrity=="string"?t.integrity:void 0,a=typeof t.fetchPriority=="string"?t.fetchPriority:void 0;n==="style"?bn.d.S(e,typeof t.precedence=="string"?t.precedence:void 0,{crossOrigin:i,integrity:s,fetchPriority:a}):n==="script"&&bn.d.X(e,{crossOrigin:i,integrity:s,fetchPriority:a,nonce:typeof t.nonce=="string"?t.nonce:void 0})}};Mn.preinitModule=function(e,t){if(typeof e=="string")if(typeof t=="object"&&t!==null){if(t.as==null||t.as==="script"){var n=Uc(t.as,t.crossOrigin);bn.d.M(e,{crossOrigin:n,integrity:typeof t.integrity=="string"?t.integrity:void 0,nonce:typeof t.nonce=="string"?t.nonce:void 0})}}else t==null&&bn.d.M(e)};Mn.preload=function(e,t){if(typeof e=="string"&&typeof t=="object"&&t!==null&&typeof t.as=="string"){var n=t.as,i=Uc(n,t.crossOrigin);bn.d.L(e,n,{crossOrigin:i,integrity:typeof t.integrity=="string"?t.integrity:void 0,nonce:typeof t.nonce=="string"?t.nonce:void 0,type:typeof t.type=="string"?t.type:void 0,fetchPriority:typeof t.fetchPriority=="string"?t.fetchPriority:void 0,referrerPolicy:typeof t.referrerPolicy=="string"?t.referrerPolicy:void 0,imageSrcSet:typeof t.imageSrcSet=="string"?t.imageSrcSet:void 0,imageSizes:typeof t.imageSizes=="string"?t.imageSizes:void 0,media:typeof t.media=="string"?t.media:void 0})}};Mn.preloadModule=function(e,t){if(typeof e=="string")if(t){var n=Uc(t.as,t.crossOrigin);bn.d.m(e,{as:typeof t.as=="string"&&t.as!=="script"?t.as:void 0,crossOrigin:n,integrity:typeof t.integrity=="string"?t.integrity:void 0})}else bn.d.m(e)};Mn.requestFormReset=function(e){bn.d.r(e)};Mn.unstable_batchedUpdates=function(e,t){return e(t)};Mn.useFormState=function(e,t,n){return wo.H.useFormState(e,t,n)};Mn.useFormStatus=function(){return wo.H.useHostTransitionStatus()};Mn.version="19.2.8"});var m_=Ri((A3,p_)=>{"use strict";function d_(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(d_)}catch(e){console.error(e)}}d_(),p_.exports=f_()});var wS=Ri(nh=>{"use strict";var je=u_(),Hv=wc(),r1=m_();function $(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function Gv(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function dl(e){var t=e,n=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(n=t.return),e=t.return;while(e)}return t.tag===3?n:null}function kv(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function Xv(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function g_(e){if(dl(e)!==e)throw Error($(188))}function o1(e){var t=e.alternate;if(!t){if(t=dl(e),t===null)throw Error($(188));return t!==e?null:e}for(var n=e,i=t;;){var s=n.return;if(s===null)break;var a=s.alternate;if(a===null){if(i=s.return,i!==null){n=i;continue}break}if(s.child===a.child){for(a=s.child;a;){if(a===n)return g_(s),e;if(a===i)return g_(s),t;a=a.sibling}throw Error($(188))}if(n.return!==i.return)n=s,i=a;else{for(var r=!1,o=s.child;o;){if(o===n){r=!0,n=s,i=a;break}if(o===i){r=!0,i=s,n=a;break}o=o.sibling}if(!r){for(o=a.child;o;){if(o===n){r=!0,n=a,i=s;break}if(o===i){r=!0,i=a,n=s;break}o=o.sibling}if(!r)throw Error($(189))}}if(n.alternate!==i)throw Error($(190))}if(n.tag!==3)throw Error($(188));return n.stateNode.current===n?e:t}function Wv(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=Wv(e),t!==null)return t;e=e.sibling}return null}var Ee=Object.assign,l1=Symbol.for("react.element"),Nc=Symbol.for("react.transitional.element"),Oo=Symbol.for("react.portal"),fr=Symbol.for("react.fragment"),qv=Symbol.for("react.strict_mode"),dp=Symbol.for("react.profiler"),Yv=Symbol.for("react.consumer"),is=Symbol.for("react.context"),lm=Symbol.for("react.forward_ref"),pp=Symbol.for("react.suspense"),mp=Symbol.for("react.suspense_list"),cm=Symbol.for("react.memo"),Ds=Symbol.for("react.lazy");Symbol.for("react.scope");var gp=Symbol.for("react.activity");Symbol.for("react.legacy_hidden");Symbol.for("react.tracing_marker");var c1=Symbol.for("react.memo_cache_sentinel");Symbol.for("react.view_transition");var __=Symbol.iterator;function Co(e){return e===null||typeof e!="object"?null:(e=__&&e[__]||e["@@iterator"],typeof e=="function"?e:null)}var u1=Symbol.for("react.client.reference");function _p(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===u1?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case fr:return"Fragment";case dp:return"Profiler";case qv:return"StrictMode";case pp:return"Suspense";case mp:return"SuspenseList";case gp:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case Oo:return"Portal";case is:return e.displayName||"Context";case Yv:return(e._context.displayName||"Context")+".Consumer";case lm:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case cm:return t=e.displayName||null,t!==null?t:_p(e.type)||"Memo";case Ds:t=e._payload,e=e._init;try{return _p(e(t))}catch{}}return null}var Po=Array.isArray,It=Hv.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,re=r1.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,Ca={pending:!1,data:null,method:null,action:null},vp=[],dr=-1;function Oi(e){return{current:e}}function sn(e){0>dr||(e.current=vp[dr],vp[dr]=null,dr--)}function ye(e,t){dr++,vp[dr]=e.current,e.current=t}var Ii=Oi(null),$o=Oi(null),Hs=Oi(null),hu=Oi(null);function fu(e,t){switch(ye(Hs,t),ye($o,e),ye(Ii,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?Ev(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=Ev(t),e=dS(t,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}sn(Ii),ye(Ii,e)}function Ur(){sn(Ii),sn($o),sn(Hs)}function yp(e){e.memoizedState!==null&&ye(hu,e);var t=Ii.current,n=dS(t,e.type);t!==n&&(ye($o,e),ye(Ii,n))}function du(e){$o.current===e&&(sn(Ii),sn($o)),hu.current===e&&(sn(hu),ul._currentValue=Ca)}var Id,v_;function Ea(e){if(Id===void 0)try{throw Error()}catch(n){var t=n.stack.trim().match(/\n( *(at )?)/);Id=t&&t[1]||"",v_=-1<n.stack.indexOf(`
    at`)?" (<anonymous>)":-1<n.stack.indexOf("@")?"@unknown:0:0":""}return`
`+Id+e+v_}var Od=!1;function Pd(e,t){if(!e||Od)return"";Od=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var i={DetermineComponentFrameRoot:function(){try{if(t){var p=function(){throw Error()};if(Object.defineProperty(p.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(p,[])}catch(d){var u=d}Reflect.construct(e,[],p)}else{try{p.call()}catch(d){u=d}e.call(p.prototype)}}else{try{throw Error()}catch(d){u=d}(p=e())&&typeof p.catch=="function"&&p.catch(function(){})}}catch(d){if(d&&u&&typeof d.stack=="string")return[d.stack,u.stack]}return[null,null]}};i.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var s=Object.getOwnPropertyDescriptor(i.DetermineComponentFrameRoot,"name");s&&s.configurable&&Object.defineProperty(i.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var a=i.DetermineComponentFrameRoot(),r=a[0],o=a[1];if(r&&o){var l=r.split(`
`),c=o.split(`
`);for(s=i=0;i<l.length&&!l[i].includes("DetermineComponentFrameRoot");)i++;for(;s<c.length&&!c[s].includes("DetermineComponentFrameRoot");)s++;if(i===l.length||s===c.length)for(i=l.length-1,s=c.length-1;1<=i&&0<=s&&l[i]!==c[s];)s--;for(;1<=i&&0<=s;i--,s--)if(l[i]!==c[s]){if(i!==1||s!==1)do if(i--,s--,0>s||l[i]!==c[s]){var h=`
`+l[i].replace(" at new "," at ");return e.displayName&&h.includes("<anonymous>")&&(h=h.replace("<anonymous>",e.displayName)),h}while(1<=i&&0<=s);break}}}finally{Od=!1,Error.prepareStackTrace=n}return(n=e?e.displayName||e.name:"")?Ea(n):""}function h1(e,t){switch(e.tag){case 26:case 27:case 5:return Ea(e.type);case 16:return Ea("Lazy");case 13:return e.child!==t&&t!==null?Ea("Suspense Fallback"):Ea("Suspense");case 19:return Ea("SuspenseList");case 0:case 15:return Pd(e.type,!1);case 11:return Pd(e.type.render,!1);case 1:return Pd(e.type,!0);case 31:return Ea("Activity");default:return""}}function y_(e){try{var t="",n=null;do t+=h1(e,n),n=e,e=e.return;while(e);return t}catch(i){return`
Error generating stack: `+i.message+`
`+i.stack}}var xp=Object.prototype.hasOwnProperty,um=je.unstable_scheduleCallback,zd=je.unstable_cancelCallback,f1=je.unstable_shouldYield,d1=je.unstable_requestPaint,Vn=je.unstable_now,p1=je.unstable_getCurrentPriorityLevel,Zv=je.unstable_ImmediatePriority,Jv=je.unstable_UserBlockingPriority,pu=je.unstable_NormalPriority,m1=je.unstable_LowPriority,Kv=je.unstable_IdlePriority,g1=je.log,_1=je.unstable_setDisableYieldValue,pl=null,Hn=null;function Ps(e){if(typeof g1=="function"&&_1(e),Hn&&typeof Hn.setStrictMode=="function")try{Hn.setStrictMode(pl,e)}catch{}}var Gn=Math.clz32?Math.clz32:x1,v1=Math.log,y1=Math.LN2;function x1(e){return e>>>=0,e===0?32:31-(v1(e)/y1|0)|0}var Lc=256,Ic=262144,Oc=4194304;function Ta(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function Vu(e,t,n){var i=e.pendingLanes;if(i===0)return 0;var s=0,a=e.suspendedLanes,r=e.pingedLanes;e=e.warmLanes;var o=i&134217727;return o!==0?(i=o&~a,i!==0?s=Ta(i):(r&=o,r!==0?s=Ta(r):n||(n=o&~e,n!==0&&(s=Ta(n))))):(o=i&~a,o!==0?s=Ta(o):r!==0?s=Ta(r):n||(n=i&~e,n!==0&&(s=Ta(n)))),s===0?0:t!==0&&t!==s&&(t&a)===0&&(a=s&-s,n=t&-t,a>=n||a===32&&(n&4194048)!==0)?t:s}function ml(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function S1(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function jv(){var e=Oc;return Oc<<=1,(Oc&62914560)===0&&(Oc=4194304),e}function Bd(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function gl(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function b1(e,t,n,i,s,a){var r=e.pendingLanes;e.pendingLanes=n,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=n,e.entangledLanes&=n,e.errorRecoveryDisabledLanes&=n,e.shellSuspendCounter=0;var o=e.entanglements,l=e.expirationTimes,c=e.hiddenUpdates;for(n=r&~n;0<n;){var h=31-Gn(n),p=1<<h;o[h]=0,l[h]=-1;var u=c[h];if(u!==null)for(c[h]=null,h=0;h<u.length;h++){var d=u[h];d!==null&&(d.lane&=-536870913)}n&=~p}i!==0&&Qv(e,i,0),a!==0&&s===0&&e.tag!==0&&(e.suspendedLanes|=a&~(r&~t))}function Qv(e,t,n){e.pendingLanes|=t,e.suspendedLanes&=~t;var i=31-Gn(t);e.entangledLanes|=t,e.entanglements[i]=e.entanglements[i]|1073741824|n&261930}function $v(e,t){var n=e.entangledLanes|=t;for(e=e.entanglements;n;){var i=31-Gn(n),s=1<<i;s&t|e[i]&t&&(e[i]|=t),n&=~s}}function ty(e,t){var n=t&-t;return n=(n&42)!==0?1:hm(n),(n&(e.suspendedLanes|t))!==0?0:n}function hm(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function fm(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function ey(){var e=re.p;return e!==0?e:(e=window.event,e===void 0?32:ES(e.type))}function x_(e,t){var n=re.p;try{return re.p=e,t()}finally{re.p=n}}var ta=Math.random().toString(36).slice(2),cn="__reactFiber$"+ta,Nn="__reactProps$"+ta,Gr="__reactContainer$"+ta,Sp="__reactEvents$"+ta,M1="__reactListeners$"+ta,E1="__reactHandles$"+ta,S_="__reactResources$"+ta,_l="__reactMarker$"+ta;function dm(e){delete e[cn],delete e[Nn],delete e[Sp],delete e[M1],delete e[E1]}function pr(e){var t=e[cn];if(t)return t;for(var n=e.parentNode;n;){if(t=n[Gr]||n[cn]){if(n=t.alternate,t.child!==null||n!==null&&n.child!==null)for(e=Rv(e);e!==null;){if(n=e[cn])return n;e=Rv(e)}return t}e=n,n=e.parentNode}return null}function kr(e){if(e=e[cn]||e[Gr]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function zo(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error($(33))}function Er(e){var t=e[S_];return t||(t=e[S_]={hoistableStyles:new Map,hoistableScripts:new Map}),t}function nn(e){e[_l]=!0}var ny=new Set,iy={};function Ba(e,t){Nr(e,t),Nr(e+"Capture",t)}function Nr(e,t){for(iy[e]=t,e=0;e<t.length;e++)ny.add(t[e])}var T1=RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"),b_={},M_={};function A1(e){return xp.call(M_,e)?!0:xp.call(b_,e)?!1:T1.test(e)?M_[e]=!0:(b_[e]=!0,!1)}function Kc(e,t,n){if(A1(t))if(n===null)e.removeAttribute(t);else{switch(typeof n){case"undefined":case"function":case"symbol":e.removeAttribute(t);return;case"boolean":var i=t.toLowerCase().slice(0,5);if(i!=="data-"&&i!=="aria-"){e.removeAttribute(t);return}}e.setAttribute(t,""+n)}}function Pc(e,t,n){if(n===null)e.removeAttribute(t);else{switch(typeof n){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(t);return}e.setAttribute(t,""+n)}}function Ki(e,t,n,i){if(i===null)e.removeAttribute(n);else{switch(typeof i){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(n);return}e.setAttributeNS(t,n,""+i)}}function ii(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function sy(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function w1(e,t,n){var i=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&typeof i<"u"&&typeof i.get=="function"&&typeof i.set=="function"){var s=i.get,a=i.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return s.call(this)},set:function(r){n=""+r,a.call(this,r)}}),Object.defineProperty(e,t,{enumerable:i.enumerable}),{getValue:function(){return n},setValue:function(r){n=""+r},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function bp(e){if(!e._valueTracker){var t=sy(e)?"checked":"value";e._valueTracker=w1(e,t,""+e[t])}}function ay(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),i="";return e&&(i=sy(e)?e.checked?"true":"false":e.value),e=i,e!==n?(t.setValue(e),!0):!1}function mu(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var C1=/[\n"\\]/g;function ri(e){return e.replace(C1,function(t){return"\\"+t.charCodeAt(0).toString(16)+" "})}function Mp(e,t,n,i,s,a,r,o){e.name="",r!=null&&typeof r!="function"&&typeof r!="symbol"&&typeof r!="boolean"?e.type=r:e.removeAttribute("type"),t!=null?r==="number"?(t===0&&e.value===""||e.value!=t)&&(e.value=""+ii(t)):e.value!==""+ii(t)&&(e.value=""+ii(t)):r!=="submit"&&r!=="reset"||e.removeAttribute("value"),t!=null?Ep(e,r,ii(t)):n!=null?Ep(e,r,ii(n)):i!=null&&e.removeAttribute("value"),s==null&&a!=null&&(e.defaultChecked=!!a),s!=null&&(e.checked=s&&typeof s!="function"&&typeof s!="symbol"),o!=null&&typeof o!="function"&&typeof o!="symbol"&&typeof o!="boolean"?e.name=""+ii(o):e.removeAttribute("name")}function ry(e,t,n,i,s,a,r,o){if(a!=null&&typeof a!="function"&&typeof a!="symbol"&&typeof a!="boolean"&&(e.type=a),t!=null||n!=null){if(!(a!=="submit"&&a!=="reset"||t!=null)){bp(e);return}n=n!=null?""+ii(n):"",t=t!=null?""+ii(t):n,o||t===e.value||(e.value=t),e.defaultValue=t}i=i??s,i=typeof i!="function"&&typeof i!="symbol"&&!!i,e.checked=o?e.checked:!!i,e.defaultChecked=!!i,r!=null&&typeof r!="function"&&typeof r!="symbol"&&typeof r!="boolean"&&(e.name=r),bp(e)}function Ep(e,t,n){t==="number"&&mu(e.ownerDocument)===e||e.defaultValue===""+n||(e.defaultValue=""+n)}function Tr(e,t,n,i){if(e=e.options,t){t={};for(var s=0;s<n.length;s++)t["$"+n[s]]=!0;for(n=0;n<e.length;n++)s=t.hasOwnProperty("$"+e[n].value),e[n].selected!==s&&(e[n].selected=s),s&&i&&(e[n].defaultSelected=!0)}else{for(n=""+ii(n),t=null,s=0;s<e.length;s++){if(e[s].value===n){e[s].selected=!0,i&&(e[s].defaultSelected=!0);return}t!==null||e[s].disabled||(t=e[s])}t!==null&&(t.selected=!0)}}function oy(e,t,n){if(t!=null&&(t=""+ii(t),t!==e.value&&(e.value=t),n==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=n!=null?""+ii(n):""}function ly(e,t,n,i){if(t==null){if(i!=null){if(n!=null)throw Error($(92));if(Po(i)){if(1<i.length)throw Error($(93));i=i[0]}n=i}n==null&&(n=""),t=n}n=ii(t),e.defaultValue=n,i=e.textContent,i===n&&i!==""&&i!==null&&(e.value=i),bp(e)}function Lr(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&n.nodeType===3){n.nodeValue=t;return}}e.textContent=t}var R1=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function E_(e,t,n){var i=t.indexOf("--")===0;n==null||typeof n=="boolean"||n===""?i?e.setProperty(t,""):t==="float"?e.cssFloat="":e[t]="":i?e.setProperty(t,n):typeof n!="number"||n===0||R1.has(t)?t==="float"?e.cssFloat=n:e[t]=(""+n).trim():e[t]=n+"px"}function cy(e,t,n){if(t!=null&&typeof t!="object")throw Error($(62));if(e=e.style,n!=null){for(var i in n)!n.hasOwnProperty(i)||t!=null&&t.hasOwnProperty(i)||(i.indexOf("--")===0?e.setProperty(i,""):i==="float"?e.cssFloat="":e[i]="");for(var s in t)i=t[s],t.hasOwnProperty(s)&&n[s]!==i&&E_(e,s,i)}else for(var a in t)t.hasOwnProperty(a)&&E_(e,a,t[a])}function pm(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var D1=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),U1=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function jc(e){return U1.test(""+e)?"javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')":e}function ss(){}var Tp=null;function mm(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var mr=null,Ar=null;function T_(e){var t=kr(e);if(t&&(e=t.stateNode)){var n=e[Nn]||null;t:switch(e=t.stateNode,t.type){case"input":if(Mp(e,n.value,n.defaultValue,n.defaultValue,n.checked,n.defaultChecked,n.type,n.name),t=n.name,n.type==="radio"&&t!=null){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll('input[name="'+ri(""+t)+'"][type="radio"]'),t=0;t<n.length;t++){var i=n[t];if(i!==e&&i.form===e.form){var s=i[Nn]||null;if(!s)throw Error($(90));Mp(i,s.value,s.defaultValue,s.defaultValue,s.checked,s.defaultChecked,s.type,s.name)}}for(t=0;t<n.length;t++)i=n[t],i.form===e.form&&ay(i)}break t;case"textarea":oy(e,n.value,n.defaultValue);break t;case"select":t=n.value,t!=null&&Tr(e,!!n.multiple,t,!1)}}}var Fd=!1;function uy(e,t,n){if(Fd)return e(t,n);Fd=!0;try{var i=e(t);return i}finally{if(Fd=!1,(mr!==null||Ar!==null)&&(Qu(),mr&&(t=mr,e=Ar,Ar=mr=null,T_(t),e)))for(t=0;t<e.length;t++)T_(e[t])}}function tl(e,t){var n=e.stateNode;if(n===null)return null;var i=n[Nn]||null;if(i===null)return null;n=i[t];t:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(e=e.type,i=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!i;break t;default:e=!1}if(e)return null;if(n&&typeof n!="function")throw Error($(231,t,typeof n));return n}var cs=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Ap=!1;if(cs)try{or={},Object.defineProperty(or,"passive",{get:function(){Ap=!0}}),window.addEventListener("test",or,or),window.removeEventListener("test",or,or)}catch{Ap=!1}var or,zs=null,gm=null,Qc=null;function hy(){if(Qc)return Qc;var e,t=gm,n=t.length,i,s="value"in zs?zs.value:zs.textContent,a=s.length;for(e=0;e<n&&t[e]===s[e];e++);var r=n-e;for(i=1;i<=r&&t[n-i]===s[a-i];i++);return Qc=s.slice(e,1<i?1-i:void 0)}function $c(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function zc(){return!0}function A_(){return!1}function Ln(e){function t(n,i,s,a,r){this._reactName=n,this._targetInst=s,this.type=i,this.nativeEvent=a,this.target=r,this.currentTarget=null;for(var o in e)e.hasOwnProperty(o)&&(n=e[o],this[o]=n?n(a):a[o]);return this.isDefaultPrevented=(a.defaultPrevented!=null?a.defaultPrevented:a.returnValue===!1)?zc:A_,this.isPropagationStopped=A_,this}return Ee(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var n=this.nativeEvent;n&&(n.preventDefault?n.preventDefault():typeof n.returnValue!="unknown"&&(n.returnValue=!1),this.isDefaultPrevented=zc)},stopPropagation:function(){var n=this.nativeEvent;n&&(n.stopPropagation?n.stopPropagation():typeof n.cancelBubble!="unknown"&&(n.cancelBubble=!0),this.isPropagationStopped=zc)},persist:function(){},isPersistent:zc}),t}var Fa={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},Hu=Ln(Fa),vl=Ee({},Fa,{view:0,detail:0}),N1=Ln(vl),Vd,Hd,Ro,Gu=Ee({},vl,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:_m,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==Ro&&(Ro&&e.type==="mousemove"?(Vd=e.screenX-Ro.screenX,Hd=e.screenY-Ro.screenY):Hd=Vd=0,Ro=e),Vd)},movementY:function(e){return"movementY"in e?e.movementY:Hd}}),w_=Ln(Gu),L1=Ee({},Gu,{dataTransfer:0}),I1=Ln(L1),O1=Ee({},vl,{relatedTarget:0}),Gd=Ln(O1),P1=Ee({},Fa,{animationName:0,elapsedTime:0,pseudoElement:0}),z1=Ln(P1),B1=Ee({},Fa,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),F1=Ln(B1),V1=Ee({},Fa,{data:0}),C_=Ln(V1),H1={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},G1={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},k1={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function X1(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=k1[e])?!!t[e]:!1}function _m(){return X1}var W1=Ee({},vl,{key:function(e){if(e.key){var t=H1[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=$c(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?G1[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:_m,charCode:function(e){return e.type==="keypress"?$c(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?$c(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),q1=Ln(W1),Y1=Ee({},Gu,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),R_=Ln(Y1),Z1=Ee({},vl,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:_m}),J1=Ln(Z1),K1=Ee({},Fa,{propertyName:0,elapsedTime:0,pseudoElement:0}),j1=Ln(K1),Q1=Ee({},Gu,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),$1=Ln(Q1),tE=Ee({},Fa,{newState:0,oldState:0}),eE=Ln(tE),nE=[9,13,27,32],vm=cs&&"CompositionEvent"in window,Vo=null;cs&&"documentMode"in document&&(Vo=document.documentMode);var iE=cs&&"TextEvent"in window&&!Vo,fy=cs&&(!vm||Vo&&8<Vo&&11>=Vo),D_=" ",U_=!1;function dy(e,t){switch(e){case"keyup":return nE.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function py(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var gr=!1;function sE(e,t){switch(e){case"compositionend":return py(t);case"keypress":return t.which!==32?null:(U_=!0,D_);case"textInput":return e=t.data,e===D_&&U_?null:e;default:return null}}function aE(e,t){if(gr)return e==="compositionend"||!vm&&dy(e,t)?(e=hy(),Qc=gm=zs=null,gr=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return fy&&t.locale!=="ko"?null:t.data;default:return null}}var rE={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function N_(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!rE[e.type]:t==="textarea"}function my(e,t,n,i){mr?Ar?Ar.push(i):Ar=[i]:mr=i,t=Lu(t,"onChange"),0<t.length&&(n=new Hu("onChange","change",null,n,i),e.push({event:n,listeners:t}))}var Ho=null,el=null;function oE(e){uS(e,0)}function ku(e){var t=zo(e);if(ay(t))return e}function L_(e,t){if(e==="change")return t}var gy=!1;cs&&(cs?(Fc="oninput"in document,Fc||(kd=document.createElement("div"),kd.setAttribute("oninput","return;"),Fc=typeof kd.oninput=="function"),Bc=Fc):Bc=!1,gy=Bc&&(!document.documentMode||9<document.documentMode));var Bc,Fc,kd;function I_(){Ho&&(Ho.detachEvent("onpropertychange",_y),el=Ho=null)}function _y(e){if(e.propertyName==="value"&&ku(el)){var t=[];my(t,el,e,mm(e)),uy(oE,t)}}function lE(e,t,n){e==="focusin"?(I_(),Ho=t,el=n,Ho.attachEvent("onpropertychange",_y)):e==="focusout"&&I_()}function cE(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return ku(el)}function uE(e,t){if(e==="click")return ku(t)}function hE(e,t){if(e==="input"||e==="change")return ku(t)}function fE(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Xn=typeof Object.is=="function"?Object.is:fE;function nl(e,t){if(Xn(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var n=Object.keys(e),i=Object.keys(t);if(n.length!==i.length)return!1;for(i=0;i<n.length;i++){var s=n[i];if(!xp.call(t,s)||!Xn(e[s],t[s]))return!1}return!0}function O_(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function P_(e,t){var n=O_(e);e=0;for(var i;n;){if(n.nodeType===3){if(i=e+n.textContent.length,e<=t&&i>=t)return{node:n,offset:t-e};e=i}t:{for(;n;){if(n.nextSibling){n=n.nextSibling;break t}n=n.parentNode}n=void 0}n=O_(n)}}function vy(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?vy(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function yy(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=mu(e.document);t instanceof e.HTMLIFrameElement;){try{var n=typeof t.contentWindow.location.href=="string"}catch{n=!1}if(n)e=t.contentWindow;else break;t=mu(e.document)}return t}function ym(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}var dE=cs&&"documentMode"in document&&11>=document.documentMode,_r=null,wp=null,Go=null,Cp=!1;function z_(e,t,n){var i=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;Cp||_r==null||_r!==mu(i)||(i=_r,"selectionStart"in i&&ym(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),Go&&nl(Go,i)||(Go=i,i=Lu(wp,"onSelect"),0<i.length&&(t=new Hu("onSelect","select",null,t,n),e.push({event:t,listeners:i}),t.target=_r)))}function Ma(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n["Webkit"+e]="webkit"+t,n["Moz"+e]="moz"+t,n}var vr={animationend:Ma("Animation","AnimationEnd"),animationiteration:Ma("Animation","AnimationIteration"),animationstart:Ma("Animation","AnimationStart"),transitionrun:Ma("Transition","TransitionRun"),transitionstart:Ma("Transition","TransitionStart"),transitioncancel:Ma("Transition","TransitionCancel"),transitionend:Ma("Transition","TransitionEnd")},Xd={},xy={};cs&&(xy=document.createElement("div").style,"AnimationEvent"in window||(delete vr.animationend.animation,delete vr.animationiteration.animation,delete vr.animationstart.animation),"TransitionEvent"in window||delete vr.transitionend.transition);function Va(e){if(Xd[e])return Xd[e];if(!vr[e])return e;var t=vr[e],n;for(n in t)if(t.hasOwnProperty(n)&&n in xy)return Xd[e]=t[n];return e}var Sy=Va("animationend"),by=Va("animationiteration"),My=Va("animationstart"),pE=Va("transitionrun"),mE=Va("transitionstart"),gE=Va("transitioncancel"),Ey=Va("transitionend"),Ty=new Map,Rp="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");Rp.push("scrollEnd");function vi(e,t){Ty.set(e,t),Ba(t,[e])}var gu=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},ni=[],yr=0,xm=0;function Xu(){for(var e=yr,t=xm=yr=0;t<e;){var n=ni[t];ni[t++]=null;var i=ni[t];ni[t++]=null;var s=ni[t];ni[t++]=null;var a=ni[t];if(ni[t++]=null,i!==null&&s!==null){var r=i.pending;r===null?s.next=s:(s.next=r.next,r.next=s),i.pending=s}a!==0&&Ay(n,s,a)}}function Wu(e,t,n,i){ni[yr++]=e,ni[yr++]=t,ni[yr++]=n,ni[yr++]=i,xm|=i,e.lanes|=i,e=e.alternate,e!==null&&(e.lanes|=i)}function Sm(e,t,n,i){return Wu(e,t,n,i),_u(e)}function Ha(e,t){return Wu(e,null,null,t),_u(e)}function Ay(e,t,n){e.lanes|=n;var i=e.alternate;i!==null&&(i.lanes|=n);for(var s=!1,a=e.return;a!==null;)a.childLanes|=n,i=a.alternate,i!==null&&(i.childLanes|=n),a.tag===22&&(e=a.stateNode,e===null||e._visibility&1||(s=!0)),e=a,a=a.return;return e.tag===3?(a=e.stateNode,s&&t!==null&&(s=31-Gn(n),e=a.hiddenUpdates,i=e[s],i===null?e[s]=[t]:i.push(t),t.lane=n|536870912),a):null}function _u(e){if(50<jo)throw jo=0,Kp=null,Error($(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var xr={};function _E(e,t,n,i){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Bn(e,t,n,i){return new _E(e,t,n,i)}function bm(e){return e=e.prototype,!(!e||!e.isReactComponent)}function rs(e,t){var n=e.alternate;return n===null?(n=Bn(e.tag,t,e.key,e.mode),n.elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=e.flags&65011712,n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n.refCleanup=e.refCleanup,n}function wy(e,t){e.flags&=65011714;var n=e.alternate;return n===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=n.childLanes,e.lanes=n.lanes,e.child=n.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=n.memoizedProps,e.memoizedState=n.memoizedState,e.updateQueue=n.updateQueue,e.type=n.type,t=n.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function tu(e,t,n,i,s,a){var r=0;if(i=e,typeof e=="function")bm(e)&&(r=1);else if(typeof e=="string")r=xT(e,n,Ii.current)?26:e==="html"||e==="head"||e==="body"?27:5;else t:switch(e){case gp:return e=Bn(31,n,t,s),e.elementType=gp,e.lanes=a,e;case fr:return Ra(n.children,s,a,t);case qv:r=8,s|=24;break;case dp:return e=Bn(12,n,t,s|2),e.elementType=dp,e.lanes=a,e;case pp:return e=Bn(13,n,t,s),e.elementType=pp,e.lanes=a,e;case mp:return e=Bn(19,n,t,s),e.elementType=mp,e.lanes=a,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case is:r=10;break t;case Yv:r=9;break t;case lm:r=11;break t;case cm:r=14;break t;case Ds:r=16,i=null;break t}r=29,n=Error($(130,e===null?"null":typeof e,"")),i=null}return t=Bn(r,n,t,s),t.elementType=e,t.type=i,t.lanes=a,t}function Ra(e,t,n,i){return e=Bn(7,e,i,t),e.lanes=n,e}function Wd(e,t,n){return e=Bn(6,e,null,t),e.lanes=n,e}function Cy(e){var t=Bn(18,null,null,0);return t.stateNode=e,t}function qd(e,t,n){return t=Bn(4,e.children!==null?e.children:[],e.key,t),t.lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var B_=new WeakMap;function oi(e,t){if(typeof e=="object"&&e!==null){var n=B_.get(e);return n!==void 0?n:(t={value:e,source:t,stack:y_(t)},B_.set(e,t),t)}return{value:e,source:t,stack:y_(t)}}var Sr=[],br=0,vu=null,il=0,si=[],ai=0,Ks=null,Ui=1,Ni="";function es(e,t){Sr[br++]=il,Sr[br++]=vu,vu=e,il=t}function Ry(e,t,n){si[ai++]=Ui,si[ai++]=Ni,si[ai++]=Ks,Ks=e;var i=Ui;e=Ni;var s=32-Gn(i)-1;i&=~(1<<s),n+=1;var a=32-Gn(t)+s;if(30<a){var r=s-s%5;a=(i&(1<<r)-1).toString(32),i>>=r,s-=r,Ui=1<<32-Gn(t)+s|n<<s|i,Ni=a+e}else Ui=1<<a|n<<s|i,Ni=e}function Mm(e){e.return!==null&&(es(e,1),Ry(e,1,0))}function Em(e){for(;e===vu;)vu=Sr[--br],Sr[br]=null,il=Sr[--br],Sr[br]=null;for(;e===Ks;)Ks=si[--ai],si[ai]=null,Ni=si[--ai],si[ai]=null,Ui=si[--ai],si[ai]=null}function Dy(e,t){si[ai++]=Ui,si[ai++]=Ni,si[ai++]=Ks,Ui=t.id,Ni=t.overflow,Ks=e}var un=null,Me=null,ne=!1,Gs=null,li=!1,Dp=Error($(519));function js(e){var t=Error($(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw sl(oi(t,e)),Dp}function F_(e){var t=e.stateNode,n=e.type,i=e.memoizedProps;switch(t[cn]=e,t[Nn]=i,n){case"dialog":Yt("cancel",t),Yt("close",t);break;case"iframe":case"object":case"embed":Yt("load",t);break;case"video":case"audio":for(n=0;n<ll.length;n++)Yt(ll[n],t);break;case"source":Yt("error",t);break;case"img":case"image":case"link":Yt("error",t),Yt("load",t);break;case"details":Yt("toggle",t);break;case"input":Yt("invalid",t),ry(t,i.value,i.defaultValue,i.checked,i.defaultChecked,i.type,i.name,!0);break;case"select":Yt("invalid",t);break;case"textarea":Yt("invalid",t),ly(t,i.value,i.defaultValue,i.children)}n=i.children,typeof n!="string"&&typeof n!="number"&&typeof n!="bigint"||t.textContent===""+n||i.suppressHydrationWarning===!0||fS(t.textContent,n)?(i.popover!=null&&(Yt("beforetoggle",t),Yt("toggle",t)),i.onScroll!=null&&Yt("scroll",t),i.onScrollEnd!=null&&Yt("scrollend",t),i.onClick!=null&&(t.onclick=ss),t=!0):t=!1,t||js(e,!0)}function V_(e){for(un=e.return;un;)switch(un.tag){case 5:case 31:case 13:li=!1;return;case 27:case 3:li=!0;return;default:un=un.return}}function lr(e){if(e!==un)return!1;if(!ne)return V_(e),ne=!0,!1;var t=e.tag,n;if((n=t!==3&&t!==27)&&((n=t===5)&&(n=e.type,n=!(n!=="form"&&n!=="button")||em(e.type,e.memoizedProps)),n=!n),n&&Me&&js(e),V_(e),t===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error($(317));Me=Cv(e)}else if(t===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error($(317));Me=Cv(e)}else t===27?(t=Me,ea(e.type)?(e=am,am=null,Me=e):Me=t):Me=un?ui(e.stateNode.nextSibling):null;return!0}function La(){Me=un=null,ne=!1}function Yd(){var e=Gs;return e!==null&&(Dn===null?Dn=e:Dn.push.apply(Dn,e),Gs=null),e}function sl(e){Gs===null?Gs=[e]:Gs.push(e)}var Up=Oi(null),Ga=null,as=null;function Ns(e,t,n){ye(Up,t._currentValue),t._currentValue=n}function os(e){e._currentValue=Up.current,sn(Up)}function Np(e,t,n){for(;e!==null;){var i=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,i!==null&&(i.childLanes|=t)):i!==null&&(i.childLanes&t)!==t&&(i.childLanes|=t),e===n)break;e=e.return}}function Lp(e,t,n,i){var s=e.child;for(s!==null&&(s.return=e);s!==null;){var a=s.dependencies;if(a!==null){var r=s.child;a=a.firstContext;t:for(;a!==null;){var o=a;a=s;for(var l=0;l<t.length;l++)if(o.context===t[l]){a.lanes|=n,o=a.alternate,o!==null&&(o.lanes|=n),Np(a.return,n,e),i||(r=null);break t}a=o.next}}else if(s.tag===18){if(r=s.return,r===null)throw Error($(341));r.lanes|=n,a=r.alternate,a!==null&&(a.lanes|=n),Np(r,n,e),r=null}else r=s.child;if(r!==null)r.return=s;else for(r=s;r!==null;){if(r===e){r=null;break}if(s=r.sibling,s!==null){s.return=r.return,r=s;break}r=r.return}s=r}}function Xr(e,t,n,i){e=null;for(var s=t,a=!1;s!==null;){if(!a){if((s.flags&524288)!==0)a=!0;else if((s.flags&262144)!==0)break}if(s.tag===10){var r=s.alternate;if(r===null)throw Error($(387));if(r=r.memoizedProps,r!==null){var o=s.type;Xn(s.pendingProps.value,r.value)||(e!==null?e.push(o):e=[o])}}else if(s===hu.current){if(r=s.alternate,r===null)throw Error($(387));r.memoizedState.memoizedState!==s.memoizedState.memoizedState&&(e!==null?e.push(ul):e=[ul])}s=s.return}e!==null&&Lp(t,e,n,i),t.flags|=262144}function yu(e){for(e=e.firstContext;e!==null;){if(!Xn(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function Ia(e){Ga=e,as=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function hn(e){return Uy(Ga,e)}function Vc(e,t){return Ga===null&&Ia(e),Uy(e,t)}function Uy(e,t){var n=t._currentValue;if(t={context:t,memoizedValue:n,next:null},as===null){if(e===null)throw Error($(308));as=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else as=as.next=t;return n}var vE=typeof AbortController<"u"?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(n,i){e.push(i)}};this.abort=function(){t.aborted=!0,e.forEach(function(n){return n()})}},yE=je.unstable_scheduleCallback,xE=je.unstable_NormalPriority,qe={$$typeof:is,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function Tm(){return{controller:new vE,data:new Map,refCount:0}}function yl(e){e.refCount--,e.refCount===0&&yE(xE,function(){e.controller.abort()})}var ko=null,Ip=0,Ir=0,wr=null;function SE(e,t){if(ko===null){var n=ko=[];Ip=0,Ir=Km(),wr={status:"pending",value:void 0,then:function(i){n.push(i)}}}return Ip++,t.then(H_,H_),t}function H_(){if(--Ip===0&&ko!==null){wr!==null&&(wr.status="fulfilled");var e=ko;ko=null,Ir=0,wr=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function bE(e,t){var n=[],i={status:"pending",value:null,reason:null,then:function(s){n.push(s)}};return e.then(function(){i.status="fulfilled",i.value=t;for(var s=0;s<n.length;s++)(0,n[s])(t)},function(s){for(i.status="rejected",i.reason=s,s=0;s<n.length;s++)(0,n[s])(void 0)}),i}var G_=It.S;It.S=function(e,t){Wx=Vn(),typeof t=="object"&&t!==null&&typeof t.then=="function"&&SE(e,t),G_!==null&&G_(e,t)};var Da=Oi(null);function Am(){var e=Da.current;return e!==null?e:ge.pooledCache}function eu(e,t){t===null?ye(Da,Da.current):ye(Da,t.pool)}function Ny(){var e=Am();return e===null?null:{parent:qe._currentValue,pool:e}}var Wr=Error($(460)),wm=Error($(474)),qu=Error($(542)),xu={then:function(){}};function k_(e){return e=e.status,e==="fulfilled"||e==="rejected"}function Ly(e,t,n){switch(n=e[n],n===void 0?e.push(t):n!==t&&(t.then(ss,ss),t=n),t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,W_(e),e;default:if(typeof t.status=="string")t.then(ss,ss);else{if(e=ge,e!==null&&100<e.shellSuspendCounter)throw Error($(482));e=t,e.status="pending",e.then(function(i){if(t.status==="pending"){var s=t;s.status="fulfilled",s.value=i}},function(i){if(t.status==="pending"){var s=t;s.status="rejected",s.reason=i}})}switch(t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,W_(e),e}throw Ua=t,Wr}}function Aa(e){try{var t=e._init;return t(e._payload)}catch(n){throw n!==null&&typeof n=="object"&&typeof n.then=="function"?(Ua=n,Wr):n}}var Ua=null;function X_(){if(Ua===null)throw Error($(459));var e=Ua;return Ua=null,e}function W_(e){if(e===Wr||e===qu)throw Error($(483))}var Cr=null,al=0;function Hc(e){var t=al;return al+=1,Cr===null&&(Cr=[]),Ly(Cr,e,t)}function Do(e,t){t=t.props.ref,e.ref=t!==void 0?t:null}function Gc(e,t){throw t.$$typeof===l1?Error($(525)):(e=Object.prototype.toString.call(t),Error($(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)))}function Iy(e){function t(f,v){if(e){var S=f.deletions;S===null?(f.deletions=[v],f.flags|=16):S.push(v)}}function n(f,v){if(!e)return null;for(;v!==null;)t(f,v),v=v.sibling;return null}function i(f){for(var v=new Map;f!==null;)f.key!==null?v.set(f.key,f):v.set(f.index,f),f=f.sibling;return v}function s(f,v){return f=rs(f,v),f.index=0,f.sibling=null,f}function a(f,v,S){return f.index=S,e?(S=f.alternate,S!==null?(S=S.index,S<v?(f.flags|=67108866,v):S):(f.flags|=67108866,v)):(f.flags|=1048576,v)}function r(f){return e&&f.alternate===null&&(f.flags|=67108866),f}function o(f,v,S,y){return v===null||v.tag!==6?(v=Wd(S,f.mode,y),v.return=f,v):(v=s(v,S),v.return=f,v)}function l(f,v,S,y){var E=S.type;return E===fr?h(f,v,S.props.children,y,S.key):v!==null&&(v.elementType===E||typeof E=="object"&&E!==null&&E.$$typeof===Ds&&Aa(E)===v.type)?(v=s(v,S.props),Do(v,S),v.return=f,v):(v=tu(S.type,S.key,S.props,null,f.mode,y),Do(v,S),v.return=f,v)}function c(f,v,S,y){return v===null||v.tag!==4||v.stateNode.containerInfo!==S.containerInfo||v.stateNode.implementation!==S.implementation?(v=qd(S,f.mode,y),v.return=f,v):(v=s(v,S.children||[]),v.return=f,v)}function h(f,v,S,y,E){return v===null||v.tag!==7?(v=Ra(S,f.mode,y,E),v.return=f,v):(v=s(v,S),v.return=f,v)}function p(f,v,S){if(typeof v=="string"&&v!==""||typeof v=="number"||typeof v=="bigint")return v=Wd(""+v,f.mode,S),v.return=f,v;if(typeof v=="object"&&v!==null){switch(v.$$typeof){case Nc:return S=tu(v.type,v.key,v.props,null,f.mode,S),Do(S,v),S.return=f,S;case Oo:return v=qd(v,f.mode,S),v.return=f,v;case Ds:return v=Aa(v),p(f,v,S)}if(Po(v)||Co(v))return v=Ra(v,f.mode,S,null),v.return=f,v;if(typeof v.then=="function")return p(f,Hc(v),S);if(v.$$typeof===is)return p(f,Vc(f,v),S);Gc(f,v)}return null}function u(f,v,S,y){var E=v!==null?v.key:null;if(typeof S=="string"&&S!==""||typeof S=="number"||typeof S=="bigint")return E!==null?null:o(f,v,""+S,y);if(typeof S=="object"&&S!==null){switch(S.$$typeof){case Nc:return S.key===E?l(f,v,S,y):null;case Oo:return S.key===E?c(f,v,S,y):null;case Ds:return S=Aa(S),u(f,v,S,y)}if(Po(S)||Co(S))return E!==null?null:h(f,v,S,y,null);if(typeof S.then=="function")return u(f,v,Hc(S),y);if(S.$$typeof===is)return u(f,v,Vc(f,S),y);Gc(f,S)}return null}function d(f,v,S,y,E){if(typeof y=="string"&&y!==""||typeof y=="number"||typeof y=="bigint")return f=f.get(S)||null,o(v,f,""+y,E);if(typeof y=="object"&&y!==null){switch(y.$$typeof){case Nc:return f=f.get(y.key===null?S:y.key)||null,l(v,f,y,E);case Oo:return f=f.get(y.key===null?S:y.key)||null,c(v,f,y,E);case Ds:return y=Aa(y),d(f,v,S,y,E)}if(Po(y)||Co(y))return f=f.get(S)||null,h(v,f,y,E,null);if(typeof y.then=="function")return d(f,v,S,Hc(y),E);if(y.$$typeof===is)return d(f,v,S,Vc(v,y),E);Gc(v,y)}return null}function _(f,v,S,y){for(var E=null,A=null,w=v,x=v=0,T=null;w!==null&&x<S.length;x++){w.index>x?(T=w,w=null):T=w.sibling;var R=u(f,w,S[x],y);if(R===null){w===null&&(w=T);break}e&&w&&R.alternate===null&&t(f,w),v=a(R,v,x),A===null?E=R:A.sibling=R,A=R,w=T}if(x===S.length)return n(f,w),ne&&es(f,x),E;if(w===null){for(;x<S.length;x++)w=p(f,S[x],y),w!==null&&(v=a(w,v,x),A===null?E=w:A.sibling=w,A=w);return ne&&es(f,x),E}for(w=i(w);x<S.length;x++)T=d(w,f,x,S[x],y),T!==null&&(e&&T.alternate!==null&&w.delete(T.key===null?x:T.key),v=a(T,v,x),A===null?E=T:A.sibling=T,A=T);return e&&w.forEach(function(D){return t(f,D)}),ne&&es(f,x),E}function b(f,v,S,y){if(S==null)throw Error($(151));for(var E=null,A=null,w=v,x=v=0,T=null,R=S.next();w!==null&&!R.done;x++,R=S.next()){w.index>x?(T=w,w=null):T=w.sibling;var D=u(f,w,R.value,y);if(D===null){w===null&&(w=T);break}e&&w&&D.alternate===null&&t(f,w),v=a(D,v,x),A===null?E=D:A.sibling=D,A=D,w=T}if(R.done)return n(f,w),ne&&es(f,x),E;if(w===null){for(;!R.done;x++,R=S.next())R=p(f,R.value,y),R!==null&&(v=a(R,v,x),A===null?E=R:A.sibling=R,A=R);return ne&&es(f,x),E}for(w=i(w);!R.done;x++,R=S.next())R=d(w,f,x,R.value,y),R!==null&&(e&&R.alternate!==null&&w.delete(R.key===null?x:R.key),v=a(R,v,x),A===null?E=R:A.sibling=R,A=R);return e&&w.forEach(function(L){return t(f,L)}),ne&&es(f,x),E}function g(f,v,S,y){if(typeof S=="object"&&S!==null&&S.type===fr&&S.key===null&&(S=S.props.children),typeof S=="object"&&S!==null){switch(S.$$typeof){case Nc:t:{for(var E=S.key;v!==null;){if(v.key===E){if(E=S.type,E===fr){if(v.tag===7){n(f,v.sibling),y=s(v,S.props.children),y.return=f,f=y;break t}}else if(v.elementType===E||typeof E=="object"&&E!==null&&E.$$typeof===Ds&&Aa(E)===v.type){n(f,v.sibling),y=s(v,S.props),Do(y,S),y.return=f,f=y;break t}n(f,v);break}else t(f,v);v=v.sibling}S.type===fr?(y=Ra(S.props.children,f.mode,y,S.key),y.return=f,f=y):(y=tu(S.type,S.key,S.props,null,f.mode,y),Do(y,S),y.return=f,f=y)}return r(f);case Oo:t:{for(E=S.key;v!==null;){if(v.key===E)if(v.tag===4&&v.stateNode.containerInfo===S.containerInfo&&v.stateNode.implementation===S.implementation){n(f,v.sibling),y=s(v,S.children||[]),y.return=f,f=y;break t}else{n(f,v);break}else t(f,v);v=v.sibling}y=qd(S,f.mode,y),y.return=f,f=y}return r(f);case Ds:return S=Aa(S),g(f,v,S,y)}if(Po(S))return _(f,v,S,y);if(Co(S)){if(E=Co(S),typeof E!="function")throw Error($(150));return S=E.call(S),b(f,v,S,y)}if(typeof S.then=="function")return g(f,v,Hc(S),y);if(S.$$typeof===is)return g(f,v,Vc(f,S),y);Gc(f,S)}return typeof S=="string"&&S!==""||typeof S=="number"||typeof S=="bigint"?(S=""+S,v!==null&&v.tag===6?(n(f,v.sibling),y=s(v,S),y.return=f,f=y):(n(f,v),y=Wd(S,f.mode,y),y.return=f,f=y),r(f)):n(f,v)}return function(f,v,S,y){try{al=0;var E=g(f,v,S,y);return Cr=null,E}catch(w){if(w===Wr||w===qu)throw w;var A=Bn(29,w,null,f.mode);return A.lanes=y,A.return=f,A}finally{}}}var Oa=Iy(!0),Oy=Iy(!1),Us=!1;function Cm(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function Op(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function ks(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function Xs(e,t,n){var i=e.updateQueue;if(i===null)return null;if(i=i.shared,(ae&2)!==0){var s=i.pending;return s===null?t.next=t:(t.next=s.next,s.next=t),i.pending=t,t=_u(e),Ay(e,null,n),t}return Wu(e,i,t,n),_u(e)}function Xo(e,t,n){if(t=t.updateQueue,t!==null&&(t=t.shared,(n&4194048)!==0)){var i=t.lanes;i&=e.pendingLanes,n|=i,t.lanes=n,$v(e,n)}}function Zd(e,t){var n=e.updateQueue,i=e.alternate;if(i!==null&&(i=i.updateQueue,n===i)){var s=null,a=null;if(n=n.firstBaseUpdate,n!==null){do{var r={lane:n.lane,tag:n.tag,payload:n.payload,callback:null,next:null};a===null?s=a=r:a=a.next=r,n=n.next}while(n!==null);a===null?s=a=t:a=a.next=t}else s=a=t;n={baseState:i.baseState,firstBaseUpdate:s,lastBaseUpdate:a,shared:i.shared,callbacks:i.callbacks},e.updateQueue=n;return}e=n.lastBaseUpdate,e===null?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}var Pp=!1;function Wo(){if(Pp){var e=wr;if(e!==null)throw e}}function qo(e,t,n,i){Pp=!1;var s=e.updateQueue;Us=!1;var a=s.firstBaseUpdate,r=s.lastBaseUpdate,o=s.shared.pending;if(o!==null){s.shared.pending=null;var l=o,c=l.next;l.next=null,r===null?a=c:r.next=c,r=l;var h=e.alternate;h!==null&&(h=h.updateQueue,o=h.lastBaseUpdate,o!==r&&(o===null?h.firstBaseUpdate=c:o.next=c,h.lastBaseUpdate=l))}if(a!==null){var p=s.baseState;r=0,h=c=l=null,o=a;do{var u=o.lane&-536870913,d=u!==o.lane;if(d?(Qt&u)===u:(i&u)===u){u!==0&&u===Ir&&(Pp=!0),h!==null&&(h=h.next={lane:0,tag:o.tag,payload:o.payload,callback:null,next:null});t:{var _=e,b=o;u=t;var g=n;switch(b.tag){case 1:if(_=b.payload,typeof _=="function"){p=_.call(g,p,u);break t}p=_;break t;case 3:_.flags=_.flags&-65537|128;case 0:if(_=b.payload,u=typeof _=="function"?_.call(g,p,u):_,u==null)break t;p=Ee({},p,u);break t;case 2:Us=!0}}u=o.callback,u!==null&&(e.flags|=64,d&&(e.flags|=8192),d=s.callbacks,d===null?s.callbacks=[u]:d.push(u))}else d={lane:u,tag:o.tag,payload:o.payload,callback:o.callback,next:null},h===null?(c=h=d,l=p):h=h.next=d,r|=u;if(o=o.next,o===null){if(o=s.shared.pending,o===null)break;d=o,o=d.next,d.next=null,s.lastBaseUpdate=d,s.shared.pending=null}}while(!0);h===null&&(l=p),s.baseState=l,s.firstBaseUpdate=c,s.lastBaseUpdate=h,a===null&&(s.shared.lanes=0),$s|=r,e.lanes=r,e.memoizedState=p}}function Py(e,t){if(typeof e!="function")throw Error($(191,e));e.call(t)}function zy(e,t){var n=e.callbacks;if(n!==null)for(e.callbacks=null,e=0;e<n.length;e++)Py(n[e],t)}var Or=Oi(null),Su=Oi(0);function q_(e,t){e=ds,ye(Su,e),ye(Or,t),ds=e|t.baseLanes}function zp(){ye(Su,ds),ye(Or,Or.current)}function Rm(){ds=Su.current,sn(Or),sn(Su)}var Wn=Oi(null),ci=null;function Ls(e){var t=e.alternate;ye(He,He.current&1),ye(Wn,e),ci===null&&(t===null||Or.current!==null||t.memoizedState!==null)&&(ci=e)}function Bp(e){ye(He,He.current),ye(Wn,e),ci===null&&(ci=e)}function By(e){e.tag===22?(ye(He,He.current),ye(Wn,e),ci===null&&(ci=e)):Is(e)}function Is(){ye(He,He.current),ye(Wn,Wn.current)}function zn(e){sn(Wn),ci===e&&(ci=null),sn(He)}var He=Oi(0);function bu(e){for(var t=e;t!==null;){if(t.tag===13){var n=t.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||im(n)||sm(n)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder==="forwards"||t.memoizedProps.revealOrder==="backwards"||t.memoizedProps.revealOrder==="unstable_legacy-backwards"||t.memoizedProps.revealOrder==="together")){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var us=0,Vt=null,fe=null,Xe=null,Mu=!1,Rr=!1,Pa=!1,Eu=0,rl=0,Dr=null,ME=0;function Pe(){throw Error($(321))}function Dm(e,t){if(t===null)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!Xn(e[n],t[n]))return!1;return!0}function Um(e,t,n,i,s,a){return us=a,Vt=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,It.H=e===null||e.memoizedState===null?mx:Gm,Pa=!1,a=n(i,s),Pa=!1,Rr&&(a=Vy(t,n,i,s)),Fy(e),a}function Fy(e){It.H=ol;var t=fe!==null&&fe.next!==null;if(us=0,Xe=fe=Vt=null,Mu=!1,rl=0,Dr=null,t)throw Error($(300));e===null||Ye||(e=e.dependencies,e!==null&&yu(e)&&(Ye=!0))}function Vy(e,t,n,i){Vt=e;var s=0;do{if(Rr&&(Dr=null),rl=0,Rr=!1,25<=s)throw Error($(301));if(s+=1,Xe=fe=null,e.updateQueue!=null){var a=e.updateQueue;a.lastEffect=null,a.events=null,a.stores=null,a.memoCache!=null&&(a.memoCache.index=0)}It.H=gx,a=t(n,i)}while(Rr);return a}function EE(){var e=It.H,t=e.useState()[0];return t=typeof t.then=="function"?xl(t):t,e=e.useState()[0],(fe!==null?fe.memoizedState:null)!==e&&(Vt.flags|=1024),t}function Nm(){var e=Eu!==0;return Eu=0,e}function Lm(e,t,n){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~n}function Im(e){if(Mu){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}Mu=!1}us=0,Xe=fe=Vt=null,Rr=!1,rl=Eu=0,Dr=null}function En(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return Xe===null?Vt.memoizedState=Xe=e:Xe=Xe.next=e,Xe}function Ge(){if(fe===null){var e=Vt.alternate;e=e!==null?e.memoizedState:null}else e=fe.next;var t=Xe===null?Vt.memoizedState:Xe.next;if(t!==null)Xe=t,fe=e;else{if(e===null)throw Vt.alternate===null?Error($(467)):Error($(310));fe=e,e={memoizedState:fe.memoizedState,baseState:fe.baseState,baseQueue:fe.baseQueue,queue:fe.queue,next:null},Xe===null?Vt.memoizedState=Xe=e:Xe=Xe.next=e}return Xe}function Yu(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function xl(e){var t=rl;return rl+=1,Dr===null&&(Dr=[]),e=Ly(Dr,e,t),t=Vt,(Xe===null?t.memoizedState:Xe.next)===null&&(t=t.alternate,It.H=t===null||t.memoizedState===null?mx:Gm),e}function Zu(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return xl(e);if(e.$$typeof===is)return hn(e)}throw Error($(438,String(e)))}function Om(e){var t=null,n=Vt.updateQueue;if(n!==null&&(t=n.memoCache),t==null){var i=Vt.alternate;i!==null&&(i=i.updateQueue,i!==null&&(i=i.memoCache,i!=null&&(t={data:i.data.map(function(s){return s.slice()}),index:0})))}if(t==null&&(t={data:[],index:0}),n===null&&(n=Yu(),Vt.updateQueue=n),n.memoCache=t,n=t.data[t.index],n===void 0)for(n=t.data[t.index]=Array(e),i=0;i<e;i++)n[i]=c1;return t.index++,n}function hs(e,t){return typeof t=="function"?t(e):t}function nu(e){var t=Ge();return Pm(t,fe,e)}function Pm(e,t,n){var i=e.queue;if(i===null)throw Error($(311));i.lastRenderedReducer=n;var s=e.baseQueue,a=i.pending;if(a!==null){if(s!==null){var r=s.next;s.next=a.next,a.next=r}t.baseQueue=s=a,i.pending=null}if(a=e.baseState,s===null)e.memoizedState=a;else{t=s.next;var o=r=null,l=null,c=t,h=!1;do{var p=c.lane&-536870913;if(p!==c.lane?(Qt&p)===p:(us&p)===p){var u=c.revertLane;if(u===0)l!==null&&(l=l.next={lane:0,revertLane:0,gesture:null,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null}),p===Ir&&(h=!0);else if((us&u)===u){c=c.next,u===Ir&&(h=!0);continue}else p={lane:0,revertLane:c.revertLane,gesture:null,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null},l===null?(o=l=p,r=a):l=l.next=p,Vt.lanes|=u,$s|=u;p=c.action,Pa&&n(a,p),a=c.hasEagerState?c.eagerState:n(a,p)}else u={lane:p,revertLane:c.revertLane,gesture:c.gesture,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null},l===null?(o=l=u,r=a):l=l.next=u,Vt.lanes|=p,$s|=p;c=c.next}while(c!==null&&c!==t);if(l===null?r=a:l.next=o,!Xn(a,e.memoizedState)&&(Ye=!0,h&&(n=wr,n!==null)))throw n;e.memoizedState=a,e.baseState=r,e.baseQueue=l,i.lastRenderedState=a}return s===null&&(i.lanes=0),[e.memoizedState,i.dispatch]}function Jd(e){var t=Ge(),n=t.queue;if(n===null)throw Error($(311));n.lastRenderedReducer=e;var i=n.dispatch,s=n.pending,a=t.memoizedState;if(s!==null){n.pending=null;var r=s=s.next;do a=e(a,r.action),r=r.next;while(r!==s);Xn(a,t.memoizedState)||(Ye=!0),t.memoizedState=a,t.baseQueue===null&&(t.baseState=a),n.lastRenderedState=a}return[a,i]}function Hy(e,t,n){var i=Vt,s=Ge(),a=ne;if(a){if(n===void 0)throw Error($(407));n=n()}else n=t();var r=!Xn((fe||s).memoizedState,n);if(r&&(s.memoizedState=n,Ye=!0),s=s.queue,zm(Xy.bind(null,i,s,e),[e]),s.getSnapshot!==t||r||Xe!==null&&Xe.memoizedState.tag&1){if(i.flags|=2048,Pr(9,{destroy:void 0},ky.bind(null,i,s,n,t),null),ge===null)throw Error($(349));a||(us&127)!==0||Gy(i,t,n)}return n}function Gy(e,t,n){e.flags|=16384,e={getSnapshot:t,value:n},t=Vt.updateQueue,t===null?(t=Yu(),Vt.updateQueue=t,t.stores=[e]):(n=t.stores,n===null?t.stores=[e]:n.push(e))}function ky(e,t,n,i){t.value=n,t.getSnapshot=i,Wy(t)&&qy(e)}function Xy(e,t,n){return n(function(){Wy(t)&&qy(e)})}function Wy(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!Xn(e,n)}catch{return!0}}function qy(e){var t=Ha(e,2);t!==null&&Un(t,e,2)}function Fp(e){var t=En();if(typeof e=="function"){var n=e;if(e=n(),Pa){Ps(!0);try{n()}finally{Ps(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:hs,lastRenderedState:e},t}function Yy(e,t,n,i){return e.baseState=n,Pm(e,fe,typeof i=="function"?i:hs)}function TE(e,t,n,i,s){if(Ku(e))throw Error($(485));if(e=t.action,e!==null){var a={payload:s,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(r){a.listeners.push(r)}};It.T!==null?n(!0):a.isTransition=!1,i(a),n=t.pending,n===null?(a.next=t.pending=a,Zy(t,a)):(a.next=n.next,t.pending=n.next=a)}}function Zy(e,t){var n=t.action,i=t.payload,s=e.state;if(t.isTransition){var a=It.T,r={};It.T=r;try{var o=n(s,i),l=It.S;l!==null&&l(r,o),Y_(e,t,o)}catch(c){Vp(e,t,c)}finally{a!==null&&r.types!==null&&(a.types=r.types),It.T=a}}else try{a=n(s,i),Y_(e,t,a)}catch(c){Vp(e,t,c)}}function Y_(e,t,n){n!==null&&typeof n=="object"&&typeof n.then=="function"?n.then(function(i){Z_(e,t,i)},function(i){return Vp(e,t,i)}):Z_(e,t,n)}function Z_(e,t,n){t.status="fulfilled",t.value=n,Jy(t),e.state=n,t=e.pending,t!==null&&(n=t.next,n===t?e.pending=null:(n=n.next,t.next=n,Zy(e,n)))}function Vp(e,t,n){var i=e.pending;if(e.pending=null,i!==null){i=i.next;do t.status="rejected",t.reason=n,Jy(t),t=t.next;while(t!==i)}e.action=null}function Jy(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function Ky(e,t){return t}function J_(e,t){if(ne){var n=ge.formState;if(n!==null){t:{var i=Vt;if(ne){if(Me){e:{for(var s=Me,a=li;s.nodeType!==8;){if(!a){s=null;break e}if(s=ui(s.nextSibling),s===null){s=null;break e}}a=s.data,s=a==="F!"||a==="F"?s:null}if(s){Me=ui(s.nextSibling),i=s.data==="F!";break t}}js(i)}i=!1}i&&(t=n[0])}}return n=En(),n.memoizedState=n.baseState=t,i={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Ky,lastRenderedState:t},n.queue=i,n=fx.bind(null,Vt,i),i.dispatch=n,i=Fp(!1),a=Hm.bind(null,Vt,!1,i.queue),i=En(),s={state:t,dispatch:null,action:e,pending:null},i.queue=s,n=TE.bind(null,Vt,s,a,n),s.dispatch=n,i.memoizedState=e,[t,n,!1]}function K_(e){var t=Ge();return jy(t,fe,e)}function jy(e,t,n){if(t=Pm(e,t,Ky)[0],e=nu(hs)[0],typeof t=="object"&&t!==null&&typeof t.then=="function")try{var i=xl(t)}catch(r){throw r===Wr?qu:r}else i=t;t=Ge();var s=t.queue,a=s.dispatch;return n!==t.memoizedState&&(Vt.flags|=2048,Pr(9,{destroy:void 0},AE.bind(null,s,n),null)),[i,a,e]}function AE(e,t){e.action=t}function j_(e){var t=Ge(),n=fe;if(n!==null)return jy(t,n,e);Ge(),t=t.memoizedState,n=Ge();var i=n.queue.dispatch;return n.memoizedState=e,[t,i,!1]}function Pr(e,t,n,i){return e={tag:e,create:n,deps:i,inst:t,next:null},t=Vt.updateQueue,t===null&&(t=Yu(),Vt.updateQueue=t),n=t.lastEffect,n===null?t.lastEffect=e.next=e:(i=n.next,n.next=e,e.next=i,t.lastEffect=e),e}function Qy(){return Ge().memoizedState}function iu(e,t,n,i){var s=En();Vt.flags|=e,s.memoizedState=Pr(1|t,{destroy:void 0},n,i===void 0?null:i)}function Ju(e,t,n,i){var s=Ge();i=i===void 0?null:i;var a=s.memoizedState.inst;fe!==null&&i!==null&&Dm(i,fe.memoizedState.deps)?s.memoizedState=Pr(t,a,n,i):(Vt.flags|=e,s.memoizedState=Pr(1|t,a,n,i))}function Q_(e,t){iu(8390656,8,e,t)}function zm(e,t){Ju(2048,8,e,t)}function wE(e){Vt.flags|=4;var t=Vt.updateQueue;if(t===null)t=Yu(),Vt.updateQueue=t,t.events=[e];else{var n=t.events;n===null?t.events=[e]:n.push(e)}}function $y(e){var t=Ge().memoizedState;return wE({ref:t,nextImpl:e}),function(){if((ae&2)!==0)throw Error($(440));return t.impl.apply(void 0,arguments)}}function tx(e,t){return Ju(4,2,e,t)}function ex(e,t){return Ju(4,4,e,t)}function nx(e,t){if(typeof t=="function"){e=e();var n=t(e);return function(){typeof n=="function"?n():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function ix(e,t,n){n=n!=null?n.concat([e]):null,Ju(4,4,nx.bind(null,t,e),n)}function Bm(){}function sx(e,t){var n=Ge();t=t===void 0?null:t;var i=n.memoizedState;return t!==null&&Dm(t,i[1])?i[0]:(n.memoizedState=[e,t],e)}function ax(e,t){var n=Ge();t=t===void 0?null:t;var i=n.memoizedState;if(t!==null&&Dm(t,i[1]))return i[0];if(i=e(),Pa){Ps(!0);try{e()}finally{Ps(!1)}}return n.memoizedState=[i,t],i}function Fm(e,t,n){return n===void 0||(us&1073741824)!==0&&(Qt&261930)===0?e.memoizedState=t:(e.memoizedState=n,e=Yx(),Vt.lanes|=e,$s|=e,n)}function rx(e,t,n,i){return Xn(n,t)?n:Or.current!==null?(e=Fm(e,n,i),Xn(e,t)||(Ye=!0),e):(us&42)===0||(us&1073741824)!==0&&(Qt&261930)===0?(Ye=!0,e.memoizedState=n):(e=Yx(),Vt.lanes|=e,$s|=e,t)}function ox(e,t,n,i,s){var a=re.p;re.p=a!==0&&8>a?a:8;var r=It.T,o={};It.T=o,Hm(e,!1,t,n);try{var l=s(),c=It.S;if(c!==null&&c(o,l),l!==null&&typeof l=="object"&&typeof l.then=="function"){var h=bE(l,i);Yo(e,t,h,kn(e))}else Yo(e,t,i,kn(e))}catch(p){Yo(e,t,{then:function(){},status:"rejected",reason:p},kn())}finally{re.p=a,r!==null&&o.types!==null&&(r.types=o.types),It.T=r}}function CE(){}function Hp(e,t,n,i){if(e.tag!==5)throw Error($(476));var s=lx(e).queue;ox(e,s,t,Ca,n===null?CE:function(){return cx(e),n(i)})}function lx(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:Ca,baseState:Ca,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:hs,lastRenderedState:Ca},next:null};var n={};return t.next={memoizedState:n,baseState:n,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:hs,lastRenderedState:n},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function cx(e){var t=lx(e);t.next===null&&(t=e.alternate.memoizedState),Yo(e,t.next.queue,{},kn())}function Vm(){return hn(ul)}function ux(){return Ge().memoizedState}function hx(){return Ge().memoizedState}function RE(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var n=kn();e=ks(n);var i=Xs(t,e,n);i!==null&&(Un(i,t,n),Xo(i,t,n)),t={cache:Tm()},e.payload=t;return}t=t.return}}function DE(e,t,n){var i=kn();n={lane:i,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null},Ku(e)?dx(t,n):(n=Sm(e,t,n,i),n!==null&&(Un(n,e,i),px(n,t,i)))}function fx(e,t,n){var i=kn();Yo(e,t,n,i)}function Yo(e,t,n,i){var s={lane:i,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null};if(Ku(e))dx(t,s);else{var a=e.alternate;if(e.lanes===0&&(a===null||a.lanes===0)&&(a=t.lastRenderedReducer,a!==null))try{var r=t.lastRenderedState,o=a(r,n);if(s.hasEagerState=!0,s.eagerState=o,Xn(o,r))return Wu(e,t,s,0),ge===null&&Xu(),!1}catch{}finally{}if(n=Sm(e,t,s,i),n!==null)return Un(n,e,i),px(n,t,i),!0}return!1}function Hm(e,t,n,i){if(i={lane:2,revertLane:Km(),gesture:null,action:i,hasEagerState:!1,eagerState:null,next:null},Ku(e)){if(t)throw Error($(479))}else t=Sm(e,n,i,2),t!==null&&Un(t,e,2)}function Ku(e){var t=e.alternate;return e===Vt||t!==null&&t===Vt}function dx(e,t){Rr=Mu=!0;var n=e.pending;n===null?t.next=t:(t.next=n.next,n.next=t),e.pending=t}function px(e,t,n){if((n&4194048)!==0){var i=t.lanes;i&=e.pendingLanes,n|=i,t.lanes=n,$v(e,n)}}var ol={readContext:hn,use:Zu,useCallback:Pe,useContext:Pe,useEffect:Pe,useImperativeHandle:Pe,useLayoutEffect:Pe,useInsertionEffect:Pe,useMemo:Pe,useReducer:Pe,useRef:Pe,useState:Pe,useDebugValue:Pe,useDeferredValue:Pe,useTransition:Pe,useSyncExternalStore:Pe,useId:Pe,useHostTransitionStatus:Pe,useFormState:Pe,useActionState:Pe,useOptimistic:Pe,useMemoCache:Pe,useCacheRefresh:Pe};ol.useEffectEvent=Pe;var mx={readContext:hn,use:Zu,useCallback:function(e,t){return En().memoizedState=[e,t===void 0?null:t],e},useContext:hn,useEffect:Q_,useImperativeHandle:function(e,t,n){n=n!=null?n.concat([e]):null,iu(4194308,4,nx.bind(null,t,e),n)},useLayoutEffect:function(e,t){return iu(4194308,4,e,t)},useInsertionEffect:function(e,t){iu(4,2,e,t)},useMemo:function(e,t){var n=En();t=t===void 0?null:t;var i=e();if(Pa){Ps(!0);try{e()}finally{Ps(!1)}}return n.memoizedState=[i,t],i},useReducer:function(e,t,n){var i=En();if(n!==void 0){var s=n(t);if(Pa){Ps(!0);try{n(t)}finally{Ps(!1)}}}else s=t;return i.memoizedState=i.baseState=s,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:s},i.queue=e,e=e.dispatch=DE.bind(null,Vt,e),[i.memoizedState,e]},useRef:function(e){var t=En();return e={current:e},t.memoizedState=e},useState:function(e){e=Fp(e);var t=e.queue,n=fx.bind(null,Vt,t);return t.dispatch=n,[e.memoizedState,n]},useDebugValue:Bm,useDeferredValue:function(e,t){var n=En();return Fm(n,e,t)},useTransition:function(){var e=Fp(!1);return e=ox.bind(null,Vt,e.queue,!0,!1),En().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,n){var i=Vt,s=En();if(ne){if(n===void 0)throw Error($(407));n=n()}else{if(n=t(),ge===null)throw Error($(349));(Qt&127)!==0||Gy(i,t,n)}s.memoizedState=n;var a={value:n,getSnapshot:t};return s.queue=a,Q_(Xy.bind(null,i,a,e),[e]),i.flags|=2048,Pr(9,{destroy:void 0},ky.bind(null,i,a,n,t),null),n},useId:function(){var e=En(),t=ge.identifierPrefix;if(ne){var n=Ni,i=Ui;n=(i&~(1<<32-Gn(i)-1)).toString(32)+n,t="_"+t+"R_"+n,n=Eu++,0<n&&(t+="H"+n.toString(32)),t+="_"}else n=ME++,t="_"+t+"r_"+n.toString(32)+"_";return e.memoizedState=t},useHostTransitionStatus:Vm,useFormState:J_,useActionState:J_,useOptimistic:function(e){var t=En();t.memoizedState=t.baseState=e;var n={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=n,t=Hm.bind(null,Vt,!0,n),n.dispatch=t,[e,t]},useMemoCache:Om,useCacheRefresh:function(){return En().memoizedState=RE.bind(null,Vt)},useEffectEvent:function(e){var t=En(),n={impl:e};return t.memoizedState=n,function(){if((ae&2)!==0)throw Error($(440));return n.impl.apply(void 0,arguments)}}},Gm={readContext:hn,use:Zu,useCallback:sx,useContext:hn,useEffect:zm,useImperativeHandle:ix,useInsertionEffect:tx,useLayoutEffect:ex,useMemo:ax,useReducer:nu,useRef:Qy,useState:function(){return nu(hs)},useDebugValue:Bm,useDeferredValue:function(e,t){var n=Ge();return rx(n,fe.memoizedState,e,t)},useTransition:function(){var e=nu(hs)[0],t=Ge().memoizedState;return[typeof e=="boolean"?e:xl(e),t]},useSyncExternalStore:Hy,useId:ux,useHostTransitionStatus:Vm,useFormState:K_,useActionState:K_,useOptimistic:function(e,t){var n=Ge();return Yy(n,fe,e,t)},useMemoCache:Om,useCacheRefresh:hx};Gm.useEffectEvent=$y;var gx={readContext:hn,use:Zu,useCallback:sx,useContext:hn,useEffect:zm,useImperativeHandle:ix,useInsertionEffect:tx,useLayoutEffect:ex,useMemo:ax,useReducer:Jd,useRef:Qy,useState:function(){return Jd(hs)},useDebugValue:Bm,useDeferredValue:function(e,t){var n=Ge();return fe===null?Fm(n,e,t):rx(n,fe.memoizedState,e,t)},useTransition:function(){var e=Jd(hs)[0],t=Ge().memoizedState;return[typeof e=="boolean"?e:xl(e),t]},useSyncExternalStore:Hy,useId:ux,useHostTransitionStatus:Vm,useFormState:j_,useActionState:j_,useOptimistic:function(e,t){var n=Ge();return fe!==null?Yy(n,fe,e,t):(n.baseState=e,[e,n.queue.dispatch])},useMemoCache:Om,useCacheRefresh:hx};gx.useEffectEvent=$y;function Kd(e,t,n,i){t=e.memoizedState,n=n(i,t),n=n==null?t:Ee({},t,n),e.memoizedState=n,e.lanes===0&&(e.updateQueue.baseState=n)}var Gp={enqueueSetState:function(e,t,n){e=e._reactInternals;var i=kn(),s=ks(i);s.payload=t,n!=null&&(s.callback=n),t=Xs(e,s,i),t!==null&&(Un(t,e,i),Xo(t,e,i))},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var i=kn(),s=ks(i);s.tag=1,s.payload=t,n!=null&&(s.callback=n),t=Xs(e,s,i),t!==null&&(Un(t,e,i),Xo(t,e,i))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=kn(),i=ks(n);i.tag=2,t!=null&&(i.callback=t),t=Xs(e,i,n),t!==null&&(Un(t,e,n),Xo(t,e,n))}};function $_(e,t,n,i,s,a,r){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(i,a,r):t.prototype&&t.prototype.isPureReactComponent?!nl(n,i)||!nl(s,a):!0}function tv(e,t,n,i){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(n,i),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(n,i),t.state!==e&&Gp.enqueueReplaceState(t,t.state,null)}function za(e,t){var n=t;if("ref"in t){n={};for(var i in t)i!=="ref"&&(n[i]=t[i])}if(e=e.defaultProps){n===t&&(n=Ee({},n));for(var s in e)n[s]===void 0&&(n[s]=e[s])}return n}function _x(e){gu(e)}function vx(e){console.error(e)}function yx(e){gu(e)}function Tu(e,t){try{var n=e.onUncaughtError;n(t.value,{componentStack:t.stack})}catch(i){setTimeout(function(){throw i})}}function ev(e,t,n){try{var i=e.onCaughtError;i(n.value,{componentStack:n.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(s){setTimeout(function(){throw s})}}function kp(e,t,n){return n=ks(n),n.tag=3,n.payload={element:null},n.callback=function(){Tu(e,t)},n}function xx(e){return e=ks(e),e.tag=3,e}function Sx(e,t,n,i){var s=n.type.getDerivedStateFromError;if(typeof s=="function"){var a=i.value;e.payload=function(){return s(a)},e.callback=function(){ev(t,n,i)}}var r=n.stateNode;r!==null&&typeof r.componentDidCatch=="function"&&(e.callback=function(){ev(t,n,i),typeof s!="function"&&(Ws===null?Ws=new Set([this]):Ws.add(this));var o=i.stack;this.componentDidCatch(i.value,{componentStack:o!==null?o:""})})}function UE(e,t,n,i,s){if(n.flags|=32768,i!==null&&typeof i=="object"&&typeof i.then=="function"){if(t=n.alternate,t!==null&&Xr(t,n,s,!0),n=Wn.current,n!==null){switch(n.tag){case 31:case 13:return ci===null?Du():n.alternate===null&&ze===0&&(ze=3),n.flags&=-257,n.flags|=65536,n.lanes=s,i===xu?n.flags|=16384:(t=n.updateQueue,t===null?n.updateQueue=new Set([i]):t.add(i),op(e,i,s)),!1;case 22:return n.flags|=65536,i===xu?n.flags|=16384:(t=n.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([i])},n.updateQueue=t):(n=t.retryQueue,n===null?t.retryQueue=new Set([i]):n.add(i)),op(e,i,s)),!1}throw Error($(435,n.tag))}return op(e,i,s),Du(),!1}if(ne)return t=Wn.current,t!==null?((t.flags&65536)===0&&(t.flags|=256),t.flags|=65536,t.lanes=s,i!==Dp&&(e=Error($(422),{cause:i}),sl(oi(e,n)))):(i!==Dp&&(t=Error($(423),{cause:i}),sl(oi(t,n))),e=e.current.alternate,e.flags|=65536,s&=-s,e.lanes|=s,i=oi(i,n),s=kp(e.stateNode,i,s),Zd(e,s),ze!==4&&(ze=2)),!1;var a=Error($(520),{cause:i});if(a=oi(a,n),Ko===null?Ko=[a]:Ko.push(a),ze!==4&&(ze=2),t===null)return!0;i=oi(i,n),n=t;do{switch(n.tag){case 3:return n.flags|=65536,e=s&-s,n.lanes|=e,e=kp(n.stateNode,i,e),Zd(n,e),!1;case 1:if(t=n.type,a=n.stateNode,(n.flags&128)===0&&(typeof t.getDerivedStateFromError=="function"||a!==null&&typeof a.componentDidCatch=="function"&&(Ws===null||!Ws.has(a))))return n.flags|=65536,s&=-s,n.lanes|=s,s=xx(s),Sx(s,e,n,i),Zd(n,s),!1}n=n.return}while(n!==null);return!1}var km=Error($(461)),Ye=!1;function ln(e,t,n,i){t.child=e===null?Oy(t,null,n,i):Oa(t,e.child,n,i)}function nv(e,t,n,i,s){n=n.render;var a=t.ref;if("ref"in i){var r={};for(var o in i)o!=="ref"&&(r[o]=i[o])}else r=i;return Ia(t),i=Um(e,t,n,r,a,s),o=Nm(),e!==null&&!Ye?(Lm(e,t,s),fs(e,t,s)):(ne&&o&&Mm(t),t.flags|=1,ln(e,t,i,s),t.child)}function iv(e,t,n,i,s){if(e===null){var a=n.type;return typeof a=="function"&&!bm(a)&&a.defaultProps===void 0&&n.compare===null?(t.tag=15,t.type=a,bx(e,t,a,i,s)):(e=tu(n.type,null,i,t,t.mode,s),e.ref=t.ref,e.return=t,t.child=e)}if(a=e.child,!Xm(e,s)){var r=a.memoizedProps;if(n=n.compare,n=n!==null?n:nl,n(r,i)&&e.ref===t.ref)return fs(e,t,s)}return t.flags|=1,e=rs(a,i),e.ref=t.ref,e.return=t,t.child=e}function bx(e,t,n,i,s){if(e!==null){var a=e.memoizedProps;if(nl(a,i)&&e.ref===t.ref)if(Ye=!1,t.pendingProps=i=a,Xm(e,s))(e.flags&131072)!==0&&(Ye=!0);else return t.lanes=e.lanes,fs(e,t,s)}return Xp(e,t,n,i,s)}function Mx(e,t,n,i){var s=i.children,a=e!==null?e.memoizedState:null;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),i.mode==="hidden"){if((t.flags&128)!==0){if(a=a!==null?a.baseLanes|n:n,e!==null){for(i=t.child=e.child,s=0;i!==null;)s=s|i.lanes|i.childLanes,i=i.sibling;i=s&~a}else i=0,t.child=null;return sv(e,t,a,n,i)}if((n&536870912)!==0)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&eu(t,a!==null?a.cachePool:null),a!==null?q_(t,a):zp(),By(t);else return i=t.lanes=536870912,sv(e,t,a!==null?a.baseLanes|n:n,n,i)}else a!==null?(eu(t,a.cachePool),q_(t,a),Is(t),t.memoizedState=null):(e!==null&&eu(t,null),zp(),Is(t));return ln(e,t,s,n),t.child}function Bo(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function sv(e,t,n,i,s){var a=Am();return a=a===null?null:{parent:qe._currentValue,pool:a},t.memoizedState={baseLanes:n,cachePool:a},e!==null&&eu(t,null),zp(),By(t),e!==null&&Xr(e,t,i,!0),t.childLanes=s,null}function su(e,t){return t=Au({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function av(e,t,n){return Oa(t,e.child,null,n),e=su(t,t.pendingProps),e.flags|=2,zn(t),t.memoizedState=null,e}function NE(e,t,n){var i=t.pendingProps,s=(t.flags&128)!==0;if(t.flags&=-129,e===null){if(ne){if(i.mode==="hidden")return e=su(t,i),t.lanes=536870912,Bo(null,e);if(Bp(t),(e=Me)?(e=mS(e,li),e=e!==null&&e.data==="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Ks!==null?{id:Ui,overflow:Ni}:null,retryLane:536870912,hydrationErrors:null},n=Cy(e),n.return=t,t.child=n,un=t,Me=null)):e=null,e===null)throw js(t);return t.lanes=536870912,null}return su(t,i)}var a=e.memoizedState;if(a!==null){var r=a.dehydrated;if(Bp(t),s)if(t.flags&256)t.flags&=-257,t=av(e,t,n);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error($(558));else if(Ye||Xr(e,t,n,!1),s=(n&e.childLanes)!==0,Ye||s){if(i=ge,i!==null&&(r=ty(i,n),r!==0&&r!==a.retryLane))throw a.retryLane=r,Ha(e,r),Un(i,e,r),km;Du(),t=av(e,t,n)}else e=a.treeContext,Me=ui(r.nextSibling),un=t,ne=!0,Gs=null,li=!1,e!==null&&Dy(t,e),t=su(t,i),t.flags|=4096;return t}return e=rs(e.child,{mode:i.mode,children:i.children}),e.ref=t.ref,t.child=e,e.return=t,e}function au(e,t){var n=t.ref;if(n===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof n!="function"&&typeof n!="object")throw Error($(284));(e===null||e.ref!==n)&&(t.flags|=4194816)}}function Xp(e,t,n,i,s){return Ia(t),n=Um(e,t,n,i,void 0,s),i=Nm(),e!==null&&!Ye?(Lm(e,t,s),fs(e,t,s)):(ne&&i&&Mm(t),t.flags|=1,ln(e,t,n,s),t.child)}function rv(e,t,n,i,s,a){return Ia(t),t.updateQueue=null,n=Vy(t,i,n,s),Fy(e),i=Nm(),e!==null&&!Ye?(Lm(e,t,a),fs(e,t,a)):(ne&&i&&Mm(t),t.flags|=1,ln(e,t,n,a),t.child)}function ov(e,t,n,i,s){if(Ia(t),t.stateNode===null){var a=xr,r=n.contextType;typeof r=="object"&&r!==null&&(a=hn(r)),a=new n(i,a),t.memoizedState=a.state!==null&&a.state!==void 0?a.state:null,a.updater=Gp,t.stateNode=a,a._reactInternals=t,a=t.stateNode,a.props=i,a.state=t.memoizedState,a.refs={},Cm(t),r=n.contextType,a.context=typeof r=="object"&&r!==null?hn(r):xr,a.state=t.memoizedState,r=n.getDerivedStateFromProps,typeof r=="function"&&(Kd(t,n,r,i),a.state=t.memoizedState),typeof n.getDerivedStateFromProps=="function"||typeof a.getSnapshotBeforeUpdate=="function"||typeof a.UNSAFE_componentWillMount!="function"&&typeof a.componentWillMount!="function"||(r=a.state,typeof a.componentWillMount=="function"&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount=="function"&&a.UNSAFE_componentWillMount(),r!==a.state&&Gp.enqueueReplaceState(a,a.state,null),qo(t,i,a,s),Wo(),a.state=t.memoizedState),typeof a.componentDidMount=="function"&&(t.flags|=4194308),i=!0}else if(e===null){a=t.stateNode;var o=t.memoizedProps,l=za(n,o);a.props=l;var c=a.context,h=n.contextType;r=xr,typeof h=="object"&&h!==null&&(r=hn(h));var p=n.getDerivedStateFromProps;h=typeof p=="function"||typeof a.getSnapshotBeforeUpdate=="function",o=t.pendingProps!==o,h||typeof a.UNSAFE_componentWillReceiveProps!="function"&&typeof a.componentWillReceiveProps!="function"||(o||c!==r)&&tv(t,a,i,r),Us=!1;var u=t.memoizedState;a.state=u,qo(t,i,a,s),Wo(),c=t.memoizedState,o||u!==c||Us?(typeof p=="function"&&(Kd(t,n,p,i),c=t.memoizedState),(l=Us||$_(t,n,l,i,u,c,r))?(h||typeof a.UNSAFE_componentWillMount!="function"&&typeof a.componentWillMount!="function"||(typeof a.componentWillMount=="function"&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount=="function"&&a.UNSAFE_componentWillMount()),typeof a.componentDidMount=="function"&&(t.flags|=4194308)):(typeof a.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=i,t.memoizedState=c),a.props=i,a.state=c,a.context=r,i=l):(typeof a.componentDidMount=="function"&&(t.flags|=4194308),i=!1)}else{a=t.stateNode,Op(e,t),r=t.memoizedProps,h=za(n,r),a.props=h,p=t.pendingProps,u=a.context,c=n.contextType,l=xr,typeof c=="object"&&c!==null&&(l=hn(c)),o=n.getDerivedStateFromProps,(c=typeof o=="function"||typeof a.getSnapshotBeforeUpdate=="function")||typeof a.UNSAFE_componentWillReceiveProps!="function"&&typeof a.componentWillReceiveProps!="function"||(r!==p||u!==l)&&tv(t,a,i,l),Us=!1,u=t.memoizedState,a.state=u,qo(t,i,a,s),Wo();var d=t.memoizedState;r!==p||u!==d||Us||e!==null&&e.dependencies!==null&&yu(e.dependencies)?(typeof o=="function"&&(Kd(t,n,o,i),d=t.memoizedState),(h=Us||$_(t,n,h,i,u,d,l)||e!==null&&e.dependencies!==null&&yu(e.dependencies))?(c||typeof a.UNSAFE_componentWillUpdate!="function"&&typeof a.componentWillUpdate!="function"||(typeof a.componentWillUpdate=="function"&&a.componentWillUpdate(i,d,l),typeof a.UNSAFE_componentWillUpdate=="function"&&a.UNSAFE_componentWillUpdate(i,d,l)),typeof a.componentDidUpdate=="function"&&(t.flags|=4),typeof a.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof a.componentDidUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=1024),t.memoizedProps=i,t.memoizedState=d),a.props=i,a.state=d,a.context=l,i=h):(typeof a.componentDidUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=1024),i=!1)}return a=i,au(e,t),i=(t.flags&128)!==0,a||i?(a=t.stateNode,n=i&&typeof n.getDerivedStateFromError!="function"?null:a.render(),t.flags|=1,e!==null&&i?(t.child=Oa(t,e.child,null,s),t.child=Oa(t,null,n,s)):ln(e,t,n,s),t.memoizedState=a.state,e=t.child):e=fs(e,t,s),e}function lv(e,t,n,i){return La(),t.flags|=256,ln(e,t,n,i),t.child}var jd={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function Qd(e){return{baseLanes:e,cachePool:Ny()}}function $d(e,t,n){return e=e!==null?e.childLanes&~n:0,t&&(e|=Fn),e}function Ex(e,t,n){var i=t.pendingProps,s=!1,a=(t.flags&128)!==0,r;if((r=a)||(r=e!==null&&e.memoizedState===null?!1:(He.current&2)!==0),r&&(s=!0,t.flags&=-129),r=(t.flags&32)!==0,t.flags&=-33,e===null){if(ne){if(s?Ls(t):Is(t),(e=Me)?(e=mS(e,li),e=e!==null&&e.data!=="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Ks!==null?{id:Ui,overflow:Ni}:null,retryLane:536870912,hydrationErrors:null},n=Cy(e),n.return=t,t.child=n,un=t,Me=null)):e=null,e===null)throw js(t);return sm(e)?t.lanes=32:t.lanes=536870912,null}var o=i.children;return i=i.fallback,s?(Is(t),s=t.mode,o=Au({mode:"hidden",children:o},s),i=Ra(i,s,n,null),o.return=t,i.return=t,o.sibling=i,t.child=o,i=t.child,i.memoizedState=Qd(n),i.childLanes=$d(e,r,n),t.memoizedState=jd,Bo(null,i)):(Ls(t),Wp(t,o))}var l=e.memoizedState;if(l!==null&&(o=l.dehydrated,o!==null)){if(a)t.flags&256?(Ls(t),t.flags&=-257,t=tp(e,t,n)):t.memoizedState!==null?(Is(t),t.child=e.child,t.flags|=128,t=null):(Is(t),o=i.fallback,s=t.mode,i=Au({mode:"visible",children:i.children},s),o=Ra(o,s,n,null),o.flags|=2,i.return=t,o.return=t,i.sibling=o,t.child=i,Oa(t,e.child,null,n),i=t.child,i.memoizedState=Qd(n),i.childLanes=$d(e,r,n),t.memoizedState=jd,t=Bo(null,i));else if(Ls(t),sm(o)){if(r=o.nextSibling&&o.nextSibling.dataset,r)var c=r.dgst;r=c,i=Error($(419)),i.stack="",i.digest=r,sl({value:i,source:null,stack:null}),t=tp(e,t,n)}else if(Ye||Xr(e,t,n,!1),r=(n&e.childLanes)!==0,Ye||r){if(r=ge,r!==null&&(i=ty(r,n),i!==0&&i!==l.retryLane))throw l.retryLane=i,Ha(e,i),Un(r,e,i),km;im(o)||Du(),t=tp(e,t,n)}else im(o)?(t.flags|=192,t.child=e.child,t=null):(e=l.treeContext,Me=ui(o.nextSibling),un=t,ne=!0,Gs=null,li=!1,e!==null&&Dy(t,e),t=Wp(t,i.children),t.flags|=4096);return t}return s?(Is(t),o=i.fallback,s=t.mode,l=e.child,c=l.sibling,i=rs(l,{mode:"hidden",children:i.children}),i.subtreeFlags=l.subtreeFlags&65011712,c!==null?o=rs(c,o):(o=Ra(o,s,n,null),o.flags|=2),o.return=t,i.return=t,i.sibling=o,t.child=i,Bo(null,i),i=t.child,o=e.child.memoizedState,o===null?o=Qd(n):(s=o.cachePool,s!==null?(l=qe._currentValue,s=s.parent!==l?{parent:l,pool:l}:s):s=Ny(),o={baseLanes:o.baseLanes|n,cachePool:s}),i.memoizedState=o,i.childLanes=$d(e,r,n),t.memoizedState=jd,Bo(e.child,i)):(Ls(t),n=e.child,e=n.sibling,n=rs(n,{mode:"visible",children:i.children}),n.return=t,n.sibling=null,e!==null&&(r=t.deletions,r===null?(t.deletions=[e],t.flags|=16):r.push(e)),t.child=n,t.memoizedState=null,n)}function Wp(e,t){return t=Au({mode:"visible",children:t},e.mode),t.return=e,e.child=t}function Au(e,t){return e=Bn(22,e,null,t),e.lanes=0,e}function tp(e,t,n){return Oa(t,e.child,null,n),e=Wp(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function cv(e,t,n){e.lanes|=t;var i=e.alternate;i!==null&&(i.lanes|=t),Np(e.return,t,n)}function ep(e,t,n,i,s,a){var r=e.memoizedState;r===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:i,tail:n,tailMode:s,treeForkCount:a}:(r.isBackwards=t,r.rendering=null,r.renderingStartTime=0,r.last=i,r.tail=n,r.tailMode=s,r.treeForkCount=a)}function Tx(e,t,n){var i=t.pendingProps,s=i.revealOrder,a=i.tail;i=i.children;var r=He.current,o=(r&2)!==0;if(o?(r=r&1|2,t.flags|=128):r&=1,ye(He,r),ln(e,t,i,n),i=ne?il:0,!o&&e!==null&&(e.flags&128)!==0)t:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&cv(e,n,t);else if(e.tag===19)cv(e,n,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break t;for(;e.sibling===null;){if(e.return===null||e.return===t)break t;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(s){case"forwards":for(n=t.child,s=null;n!==null;)e=n.alternate,e!==null&&bu(e)===null&&(s=n),n=n.sibling;n=s,n===null?(s=t.child,t.child=null):(s=n.sibling,n.sibling=null),ep(t,!1,s,n,a,i);break;case"backwards":case"unstable_legacy-backwards":for(n=null,s=t.child,t.child=null;s!==null;){if(e=s.alternate,e!==null&&bu(e)===null){t.child=s;break}e=s.sibling,s.sibling=n,n=s,s=e}ep(t,!0,n,null,a,i);break;case"together":ep(t,!1,null,null,void 0,i);break;default:t.memoizedState=null}return t.child}function fs(e,t,n){if(e!==null&&(t.dependencies=e.dependencies),$s|=t.lanes,(n&t.childLanes)===0)if(e!==null){if(Xr(e,t,n,!1),(n&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error($(153));if(t.child!==null){for(e=t.child,n=rs(e,e.pendingProps),t.child=n,n.return=t;e.sibling!==null;)e=e.sibling,n=n.sibling=rs(e,e.pendingProps),n.return=t;n.sibling=null}return t.child}function Xm(e,t){return(e.lanes&t)!==0?!0:(e=e.dependencies,!!(e!==null&&yu(e)))}function LE(e,t,n){switch(t.tag){case 3:fu(t,t.stateNode.containerInfo),Ns(t,qe,e.memoizedState.cache),La();break;case 27:case 5:yp(t);break;case 4:fu(t,t.stateNode.containerInfo);break;case 10:Ns(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,Bp(t),null;break;case 13:var i=t.memoizedState;if(i!==null)return i.dehydrated!==null?(Ls(t),t.flags|=128,null):(n&t.child.childLanes)!==0?Ex(e,t,n):(Ls(t),e=fs(e,t,n),e!==null?e.sibling:null);Ls(t);break;case 19:var s=(e.flags&128)!==0;if(i=(n&t.childLanes)!==0,i||(Xr(e,t,n,!1),i=(n&t.childLanes)!==0),s){if(i)return Tx(e,t,n);t.flags|=128}if(s=t.memoizedState,s!==null&&(s.rendering=null,s.tail=null,s.lastEffect=null),ye(He,He.current),i)break;return null;case 22:return t.lanes=0,Mx(e,t,n,t.pendingProps);case 24:Ns(t,qe,e.memoizedState.cache)}return fs(e,t,n)}function Ax(e,t,n){if(e!==null)if(e.memoizedProps!==t.pendingProps)Ye=!0;else{if(!Xm(e,n)&&(t.flags&128)===0)return Ye=!1,LE(e,t,n);Ye=(e.flags&131072)!==0}else Ye=!1,ne&&(t.flags&1048576)!==0&&Ry(t,il,t.index);switch(t.lanes=0,t.tag){case 16:t:{var i=t.pendingProps;if(e=Aa(t.elementType),t.type=e,typeof e=="function")bm(e)?(i=za(e,i),t.tag=1,t=ov(null,t,e,i,n)):(t.tag=0,t=Xp(null,t,e,i,n));else{if(e!=null){var s=e.$$typeof;if(s===lm){t.tag=11,t=nv(null,t,e,i,n);break t}else if(s===cm){t.tag=14,t=iv(null,t,e,i,n);break t}}throw t=_p(e)||e,Error($(306,t,""))}}return t;case 0:return Xp(e,t,t.type,t.pendingProps,n);case 1:return i=t.type,s=za(i,t.pendingProps),ov(e,t,i,s,n);case 3:t:{if(fu(t,t.stateNode.containerInfo),e===null)throw Error($(387));i=t.pendingProps;var a=t.memoizedState;s=a.element,Op(e,t),qo(t,i,null,n);var r=t.memoizedState;if(i=r.cache,Ns(t,qe,i),i!==a.cache&&Lp(t,[qe],n,!0),Wo(),i=r.element,a.isDehydrated)if(a={element:i,isDehydrated:!1,cache:r.cache},t.updateQueue.baseState=a,t.memoizedState=a,t.flags&256){t=lv(e,t,i,n);break t}else if(i!==s){s=oi(Error($(424)),t),sl(s),t=lv(e,t,i,n);break t}else{switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName==="HTML"?e.ownerDocument.body:e}for(Me=ui(e.firstChild),un=t,ne=!0,Gs=null,li=!0,n=Oy(t,null,i,n),t.child=n;n;)n.flags=n.flags&-3|4096,n=n.sibling}else{if(La(),i===s){t=fs(e,t,n);break t}ln(e,t,i,n)}t=t.child}return t;case 26:return au(e,t),e===null?(n=Uv(t.type,null,t.pendingProps,null))?t.memoizedState=n:ne||(n=t.type,e=t.pendingProps,i=Iu(Hs.current).createElement(n),i[cn]=t,i[Nn]=e,fn(i,n,e),nn(i),t.stateNode=i):t.memoizedState=Uv(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return yp(t),e===null&&ne&&(i=t.stateNode=gS(t.type,t.pendingProps,Hs.current),un=t,li=!0,s=Me,ea(t.type)?(am=s,Me=ui(i.firstChild)):Me=s),ln(e,t,t.pendingProps.children,n),au(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&ne&&((s=i=Me)&&(i=oT(i,t.type,t.pendingProps,li),i!==null?(t.stateNode=i,un=t,Me=ui(i.firstChild),li=!1,s=!0):s=!1),s||js(t)),yp(t),s=t.type,a=t.pendingProps,r=e!==null?e.memoizedProps:null,i=a.children,em(s,a)?i=null:r!==null&&em(s,r)&&(t.flags|=32),t.memoizedState!==null&&(s=Um(e,t,EE,null,null,n),ul._currentValue=s),au(e,t),ln(e,t,i,n),t.child;case 6:return e===null&&ne&&((e=n=Me)&&(n=lT(n,t.pendingProps,li),n!==null?(t.stateNode=n,un=t,Me=null,e=!0):e=!1),e||js(t)),null;case 13:return Ex(e,t,n);case 4:return fu(t,t.stateNode.containerInfo),i=t.pendingProps,e===null?t.child=Oa(t,null,i,n):ln(e,t,i,n),t.child;case 11:return nv(e,t,t.type,t.pendingProps,n);case 7:return ln(e,t,t.pendingProps,n),t.child;case 8:return ln(e,t,t.pendingProps.children,n),t.child;case 12:return ln(e,t,t.pendingProps.children,n),t.child;case 10:return i=t.pendingProps,Ns(t,t.type,i.value),ln(e,t,i.children,n),t.child;case 9:return s=t.type._context,i=t.pendingProps.children,Ia(t),s=hn(s),i=i(s),t.flags|=1,ln(e,t,i,n),t.child;case 14:return iv(e,t,t.type,t.pendingProps,n);case 15:return bx(e,t,t.type,t.pendingProps,n);case 19:return Tx(e,t,n);case 31:return NE(e,t,n);case 22:return Mx(e,t,n,t.pendingProps);case 24:return Ia(t),i=hn(qe),e===null?(s=Am(),s===null&&(s=ge,a=Tm(),s.pooledCache=a,a.refCount++,a!==null&&(s.pooledCacheLanes|=n),s=a),t.memoizedState={parent:i,cache:s},Cm(t),Ns(t,qe,s)):((e.lanes&n)!==0&&(Op(e,t),qo(t,null,null,n),Wo()),s=e.memoizedState,a=t.memoizedState,s.parent!==i?(s={parent:i,cache:i},t.memoizedState=s,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=s),Ns(t,qe,i)):(i=a.cache,Ns(t,qe,i),i!==s.cache&&Lp(t,[qe],n,!0))),ln(e,t,t.pendingProps.children,n),t.child;case 29:throw t.pendingProps}throw Error($(156,t.tag))}function ji(e){e.flags|=4}function np(e,t,n,i,s){if((t=(e.mode&32)!==0)&&(t=!1),t){if(e.flags|=16777216,(s&335544128)===s)if(e.stateNode.complete)e.flags|=8192;else if(Kx())e.flags|=8192;else throw Ua=xu,wm}else e.flags&=-16777217}function uv(e,t){if(t.type!=="stylesheet"||(t.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!yS(t))if(Kx())e.flags|=8192;else throw Ua=xu,wm}function kc(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag!==22?jv():536870912,e.lanes|=t,zr|=t)}function Uo(e,t){if(!ne)switch(e.tailMode){case"hidden":t=e.tail;for(var n=null;t!==null;)t.alternate!==null&&(n=t),t=t.sibling;n===null?e.tail=null:n.sibling=null;break;case"collapsed":n=e.tail;for(var i=null;n!==null;)n.alternate!==null&&(i=n),n=n.sibling;i===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:i.sibling=null}}function be(e){var t=e.alternate!==null&&e.alternate.child===e.child,n=0,i=0;if(t)for(var s=e.child;s!==null;)n|=s.lanes|s.childLanes,i|=s.subtreeFlags&65011712,i|=s.flags&65011712,s.return=e,s=s.sibling;else for(s=e.child;s!==null;)n|=s.lanes|s.childLanes,i|=s.subtreeFlags,i|=s.flags,s.return=e,s=s.sibling;return e.subtreeFlags|=i,e.childLanes=n,t}function IE(e,t,n){var i=t.pendingProps;switch(Em(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return be(t),null;case 1:return be(t),null;case 3:return n=t.stateNode,i=null,e!==null&&(i=e.memoizedState.cache),t.memoizedState.cache!==i&&(t.flags|=2048),os(qe),Ur(),n.pendingContext&&(n.context=n.pendingContext,n.pendingContext=null),(e===null||e.child===null)&&(lr(t)?ji(t):e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,Yd())),be(t),null;case 26:var s=t.type,a=t.memoizedState;return e===null?(ji(t),a!==null?(be(t),uv(t,a)):(be(t),np(t,s,null,i,n))):a?a!==e.memoizedState?(ji(t),be(t),uv(t,a)):(be(t),t.flags&=-16777217):(e=e.memoizedProps,e!==i&&ji(t),be(t),np(t,s,e,i,n)),null;case 27:if(du(t),n=Hs.current,s=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&ji(t);else{if(!i){if(t.stateNode===null)throw Error($(166));return be(t),null}e=Ii.current,lr(t)?F_(t,e):(e=gS(s,i,n),t.stateNode=e,ji(t))}return be(t),null;case 5:if(du(t),s=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&ji(t);else{if(!i){if(t.stateNode===null)throw Error($(166));return be(t),null}if(a=Ii.current,lr(t))F_(t,a);else{var r=Iu(Hs.current);switch(a){case 1:a=r.createElementNS("http://www.w3.org/2000/svg",s);break;case 2:a=r.createElementNS("http://www.w3.org/1998/Math/MathML",s);break;default:switch(s){case"svg":a=r.createElementNS("http://www.w3.org/2000/svg",s);break;case"math":a=r.createElementNS("http://www.w3.org/1998/Math/MathML",s);break;case"script":a=r.createElement("div"),a.innerHTML="<script><\/script>",a=a.removeChild(a.firstChild);break;case"select":a=typeof i.is=="string"?r.createElement("select",{is:i.is}):r.createElement("select"),i.multiple?a.multiple=!0:i.size&&(a.size=i.size);break;default:a=typeof i.is=="string"?r.createElement(s,{is:i.is}):r.createElement(s)}}a[cn]=t,a[Nn]=i;t:for(r=t.child;r!==null;){if(r.tag===5||r.tag===6)a.appendChild(r.stateNode);else if(r.tag!==4&&r.tag!==27&&r.child!==null){r.child.return=r,r=r.child;continue}if(r===t)break t;for(;r.sibling===null;){if(r.return===null||r.return===t)break t;r=r.return}r.sibling.return=r.return,r=r.sibling}t.stateNode=a;t:switch(fn(a,s,i),s){case"button":case"input":case"select":case"textarea":i=!!i.autoFocus;break t;case"img":i=!0;break t;default:i=!1}i&&ji(t)}}return be(t),np(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,n),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==i&&ji(t);else{if(typeof i!="string"&&t.stateNode===null)throw Error($(166));if(e=Hs.current,lr(t)){if(e=t.stateNode,n=t.memoizedProps,i=null,s=un,s!==null)switch(s.tag){case 27:case 5:i=s.memoizedProps}e[cn]=t,e=!!(e.nodeValue===n||i!==null&&i.suppressHydrationWarning===!0||fS(e.nodeValue,n)),e||js(t,!0)}else e=Iu(e).createTextNode(i),e[cn]=t,t.stateNode=e}return be(t),null;case 31:if(n=t.memoizedState,e===null||e.memoizedState!==null){if(i=lr(t),n!==null){if(e===null){if(!i)throw Error($(318));if(e=t.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error($(557));e[cn]=t}else La(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;be(t),e=!1}else n=Yd(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=n),e=!0;if(!e)return t.flags&256?(zn(t),t):(zn(t),null);if((t.flags&128)!==0)throw Error($(558))}return be(t),null;case 13:if(i=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(s=lr(t),i!==null&&i.dehydrated!==null){if(e===null){if(!s)throw Error($(318));if(s=t.memoizedState,s=s!==null?s.dehydrated:null,!s)throw Error($(317));s[cn]=t}else La(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;be(t),s=!1}else s=Yd(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=s),s=!0;if(!s)return t.flags&256?(zn(t),t):(zn(t),null)}return zn(t),(t.flags&128)!==0?(t.lanes=n,t):(n=i!==null,e=e!==null&&e.memoizedState!==null,n&&(i=t.child,s=null,i.alternate!==null&&i.alternate.memoizedState!==null&&i.alternate.memoizedState.cachePool!==null&&(s=i.alternate.memoizedState.cachePool.pool),a=null,i.memoizedState!==null&&i.memoizedState.cachePool!==null&&(a=i.memoizedState.cachePool.pool),a!==s&&(i.flags|=2048)),n!==e&&n&&(t.child.flags|=8192),kc(t,t.updateQueue),be(t),null);case 4:return Ur(),e===null&&jm(t.stateNode.containerInfo),be(t),null;case 10:return os(t.type),be(t),null;case 19:if(sn(He),i=t.memoizedState,i===null)return be(t),null;if(s=(t.flags&128)!==0,a=i.rendering,a===null)if(s)Uo(i,!1);else{if(ze!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(a=bu(e),a!==null){for(t.flags|=128,Uo(i,!1),e=a.updateQueue,t.updateQueue=e,kc(t,e),t.subtreeFlags=0,e=n,n=t.child;n!==null;)wy(n,e),n=n.sibling;return ye(He,He.current&1|2),ne&&es(t,i.treeForkCount),t.child}e=e.sibling}i.tail!==null&&Vn()>Cu&&(t.flags|=128,s=!0,Uo(i,!1),t.lanes=4194304)}else{if(!s)if(e=bu(a),e!==null){if(t.flags|=128,s=!0,e=e.updateQueue,t.updateQueue=e,kc(t,e),Uo(i,!0),i.tail===null&&i.tailMode==="hidden"&&!a.alternate&&!ne)return be(t),null}else 2*Vn()-i.renderingStartTime>Cu&&n!==536870912&&(t.flags|=128,s=!0,Uo(i,!1),t.lanes=4194304);i.isBackwards?(a.sibling=t.child,t.child=a):(e=i.last,e!==null?e.sibling=a:t.child=a,i.last=a)}return i.tail!==null?(e=i.tail,i.rendering=e,i.tail=e.sibling,i.renderingStartTime=Vn(),e.sibling=null,n=He.current,ye(He,s?n&1|2:n&1),ne&&es(t,i.treeForkCount),e):(be(t),null);case 22:case 23:return zn(t),Rm(),i=t.memoizedState!==null,e!==null?e.memoizedState!==null!==i&&(t.flags|=8192):i&&(t.flags|=8192),i?(n&536870912)!==0&&(t.flags&128)===0&&(be(t),t.subtreeFlags&6&&(t.flags|=8192)):be(t),n=t.updateQueue,n!==null&&kc(t,n.retryQueue),n=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),i=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(i=t.memoizedState.cachePool.pool),i!==n&&(t.flags|=2048),e!==null&&sn(Da),null;case 24:return n=null,e!==null&&(n=e.memoizedState.cache),t.memoizedState.cache!==n&&(t.flags|=2048),os(qe),be(t),null;case 25:return null;case 30:return null}throw Error($(156,t.tag))}function OE(e,t){switch(Em(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return os(qe),Ur(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return du(t),null;case 31:if(t.memoizedState!==null){if(zn(t),t.alternate===null)throw Error($(340));La()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(zn(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error($(340));La()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return sn(He),null;case 4:return Ur(),null;case 10:return os(t.type),null;case 22:case 23:return zn(t),Rm(),e!==null&&sn(Da),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return os(qe),null;case 25:return null;default:return null}}function wx(e,t){switch(Em(t),t.tag){case 3:os(qe),Ur();break;case 26:case 27:case 5:du(t);break;case 4:Ur();break;case 31:t.memoizedState!==null&&zn(t);break;case 13:zn(t);break;case 19:sn(He);break;case 10:os(t.type);break;case 22:case 23:zn(t),Rm(),e!==null&&sn(Da);break;case 24:os(qe)}}function Sl(e,t){try{var n=t.updateQueue,i=n!==null?n.lastEffect:null;if(i!==null){var s=i.next;n=s;do{if((n.tag&e)===e){i=void 0;var a=n.create,r=n.inst;i=a(),r.destroy=i}n=n.next}while(n!==s)}}catch(o){ce(t,t.return,o)}}function Qs(e,t,n){try{var i=t.updateQueue,s=i!==null?i.lastEffect:null;if(s!==null){var a=s.next;i=a;do{if((i.tag&e)===e){var r=i.inst,o=r.destroy;if(o!==void 0){r.destroy=void 0,s=t;var l=n,c=o;try{c()}catch(h){ce(s,l,h)}}}i=i.next}while(i!==a)}}catch(h){ce(t,t.return,h)}}function Cx(e){var t=e.updateQueue;if(t!==null){var n=e.stateNode;try{zy(t,n)}catch(i){ce(e,e.return,i)}}}function Rx(e,t,n){n.props=za(e.type,e.memoizedProps),n.state=e.memoizedState;try{n.componentWillUnmount()}catch(i){ce(e,t,i)}}function Zo(e,t){try{var n=e.ref;if(n!==null){switch(e.tag){case 26:case 27:case 5:var i=e.stateNode;break;case 30:i=e.stateNode;break;default:i=e.stateNode}typeof n=="function"?e.refCleanup=n(i):n.current=i}}catch(s){ce(e,t,s)}}function Li(e,t){var n=e.ref,i=e.refCleanup;if(n!==null)if(typeof i=="function")try{i()}catch(s){ce(e,t,s)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof n=="function")try{n(null)}catch(s){ce(e,t,s)}else n.current=null}function Dx(e){var t=e.type,n=e.memoizedProps,i=e.stateNode;try{t:switch(t){case"button":case"input":case"select":case"textarea":n.autoFocus&&i.focus();break t;case"img":n.src?i.src=n.src:n.srcSet&&(i.srcset=n.srcSet)}}catch(s){ce(e,e.return,s)}}function ip(e,t,n){try{var i=e.stateNode;eT(i,e.type,n,t),i[Nn]=t}catch(s){ce(e,e.return,s)}}function Ux(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&ea(e.type)||e.tag===4}function sp(e){t:for(;;){for(;e.sibling===null;){if(e.return===null||Ux(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&ea(e.type)||e.flags&2||e.child===null||e.tag===4)continue t;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function qp(e,t,n){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?(n.nodeType===9?n.body:n.nodeName==="HTML"?n.ownerDocument.body:n).insertBefore(e,t):(t=n.nodeType===9?n.body:n.nodeName==="HTML"?n.ownerDocument.body:n,t.appendChild(e),n=n._reactRootContainer,n!=null||t.onclick!==null||(t.onclick=ss));else if(i!==4&&(i===27&&ea(e.type)&&(n=e.stateNode,t=null),e=e.child,e!==null))for(qp(e,t,n),e=e.sibling;e!==null;)qp(e,t,n),e=e.sibling}function wu(e,t,n){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?n.insertBefore(e,t):n.appendChild(e);else if(i!==4&&(i===27&&ea(e.type)&&(n=e.stateNode),e=e.child,e!==null))for(wu(e,t,n),e=e.sibling;e!==null;)wu(e,t,n),e=e.sibling}function Nx(e){var t=e.stateNode,n=e.memoizedProps;try{for(var i=e.type,s=t.attributes;s.length;)t.removeAttributeNode(s[0]);fn(t,i,n),t[cn]=e,t[Nn]=n}catch(a){ce(e,e.return,a)}}var ns=!1,We=!1,ap=!1,hv=typeof WeakSet=="function"?WeakSet:Set,en=null;function PE(e,t){if(e=e.containerInfo,$p=Bu,e=yy(e),ym(e)){if("selectionStart"in e)var n={start:e.selectionStart,end:e.selectionEnd};else t:{n=(n=e.ownerDocument)&&n.defaultView||window;var i=n.getSelection&&n.getSelection();if(i&&i.rangeCount!==0){n=i.anchorNode;var s=i.anchorOffset,a=i.focusNode;i=i.focusOffset;try{n.nodeType,a.nodeType}catch{n=null;break t}var r=0,o=-1,l=-1,c=0,h=0,p=e,u=null;e:for(;;){for(var d;p!==n||s!==0&&p.nodeType!==3||(o=r+s),p!==a||i!==0&&p.nodeType!==3||(l=r+i),p.nodeType===3&&(r+=p.nodeValue.length),(d=p.firstChild)!==null;)u=p,p=d;for(;;){if(p===e)break e;if(u===n&&++c===s&&(o=r),u===a&&++h===i&&(l=r),(d=p.nextSibling)!==null)break;p=u,u=p.parentNode}p=d}n=o===-1||l===-1?null:{start:o,end:l}}else n=null}n=n||{start:0,end:0}}else n=null;for(tm={focusedElem:e,selectionRange:n},Bu=!1,en=t;en!==null;)if(t=en,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,en=e;else for(;en!==null;){switch(t=en,a=t.alternate,e=t.flags,t.tag){case 0:if((e&4)!==0&&(e=t.updateQueue,e=e!==null?e.events:null,e!==null))for(n=0;n<e.length;n++)s=e[n],s.ref.impl=s.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&a!==null){e=void 0,n=t,s=a.memoizedProps,a=a.memoizedState,i=n.stateNode;try{var _=za(n.type,s);e=i.getSnapshotBeforeUpdate(_,a),i.__reactInternalSnapshotBeforeUpdate=e}catch(b){ce(n,n.return,b)}}break;case 3:if((e&1024)!==0){if(e=t.stateNode.containerInfo,n=e.nodeType,n===9)nm(e);else if(n===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":nm(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error($(163))}if(e=t.sibling,e!==null){e.return=t.return,en=e;break}en=t.return}}function Lx(e,t,n){var i=n.flags;switch(n.tag){case 0:case 11:case 15:$i(e,n),i&4&&Sl(5,n);break;case 1:if($i(e,n),i&4)if(e=n.stateNode,t===null)try{e.componentDidMount()}catch(r){ce(n,n.return,r)}else{var s=za(n.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(s,t,e.__reactInternalSnapshotBeforeUpdate)}catch(r){ce(n,n.return,r)}}i&64&&Cx(n),i&512&&Zo(n,n.return);break;case 3:if($i(e,n),i&64&&(e=n.updateQueue,e!==null)){if(t=null,n.child!==null)switch(n.child.tag){case 27:case 5:t=n.child.stateNode;break;case 1:t=n.child.stateNode}try{zy(e,t)}catch(r){ce(n,n.return,r)}}break;case 27:t===null&&i&4&&Nx(n);case 26:case 5:$i(e,n),t===null&&i&4&&Dx(n),i&512&&Zo(n,n.return);break;case 12:$i(e,n);break;case 31:$i(e,n),i&4&&Px(e,n);break;case 13:$i(e,n),i&4&&zx(e,n),i&64&&(e=n.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(n=WE.bind(null,n),cT(e,n))));break;case 22:if(i=n.memoizedState!==null||ns,!i){t=t!==null&&t.memoizedState!==null||We,s=ns;var a=We;ns=i,(We=t)&&!a?ts(e,n,(n.subtreeFlags&8772)!==0):$i(e,n),ns=s,We=a}break;case 30:break;default:$i(e,n)}}function Ix(e){var t=e.alternate;t!==null&&(e.alternate=null,Ix(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&dm(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var Re=null,Rn=!1;function Qi(e,t,n){for(n=n.child;n!==null;)Ox(e,t,n),n=n.sibling}function Ox(e,t,n){if(Hn&&typeof Hn.onCommitFiberUnmount=="function")try{Hn.onCommitFiberUnmount(pl,n)}catch{}switch(n.tag){case 26:We||Li(n,t),Qi(e,t,n),n.memoizedState?n.memoizedState.count--:n.stateNode&&(n=n.stateNode,n.parentNode.removeChild(n));break;case 27:We||Li(n,t);var i=Re,s=Rn;ea(n.type)&&(Re=n.stateNode,Rn=!1),Qi(e,t,n),Qo(n.stateNode),Re=i,Rn=s;break;case 5:We||Li(n,t);case 6:if(i=Re,s=Rn,Re=null,Qi(e,t,n),Re=i,Rn=s,Re!==null)if(Rn)try{(Re.nodeType===9?Re.body:Re.nodeName==="HTML"?Re.ownerDocument.body:Re).removeChild(n.stateNode)}catch(a){ce(n,t,a)}else try{Re.removeChild(n.stateNode)}catch(a){ce(n,t,a)}break;case 18:Re!==null&&(Rn?(e=Re,Av(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,n.stateNode),Hr(e)):Av(Re,n.stateNode));break;case 4:i=Re,s=Rn,Re=n.stateNode.containerInfo,Rn=!0,Qi(e,t,n),Re=i,Rn=s;break;case 0:case 11:case 14:case 15:Qs(2,n,t),We||Qs(4,n,t),Qi(e,t,n);break;case 1:We||(Li(n,t),i=n.stateNode,typeof i.componentWillUnmount=="function"&&Rx(n,t,i)),Qi(e,t,n);break;case 21:Qi(e,t,n);break;case 22:We=(i=We)||n.memoizedState!==null,Qi(e,t,n),We=i;break;default:Qi(e,t,n)}}function Px(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Hr(e)}catch(n){ce(t,t.return,n)}}}function zx(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Hr(e)}catch(n){ce(t,t.return,n)}}function zE(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new hv),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new hv),t;default:throw Error($(435,e.tag))}}function Xc(e,t){var n=zE(e);t.forEach(function(i){if(!n.has(i)){n.add(i);var s=qE.bind(null,e,i);i.then(s,s)}})}function wn(e,t){var n=t.deletions;if(n!==null)for(var i=0;i<n.length;i++){var s=n[i],a=e,r=t,o=r;t:for(;o!==null;){switch(o.tag){case 27:if(ea(o.type)){Re=o.stateNode,Rn=!1;break t}break;case 5:Re=o.stateNode,Rn=!1;break t;case 3:case 4:Re=o.stateNode.containerInfo,Rn=!0;break t}o=o.return}if(Re===null)throw Error($(160));Ox(a,r,s),Re=null,Rn=!1,a=s.alternate,a!==null&&(a.return=null),s.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)Bx(t,e),t=t.sibling}var _i=null;function Bx(e,t){var n=e.alternate,i=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:wn(t,e),Cn(e),i&4&&(Qs(3,e,e.return),Sl(3,e),Qs(5,e,e.return));break;case 1:wn(t,e),Cn(e),i&512&&(We||n===null||Li(n,n.return)),i&64&&ns&&(e=e.updateQueue,e!==null&&(i=e.callbacks,i!==null&&(n=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=n===null?i:n.concat(i))));break;case 26:var s=_i;if(wn(t,e),Cn(e),i&512&&(We||n===null||Li(n,n.return)),i&4){var a=n!==null?n.memoizedState:null;if(i=e.memoizedState,n===null)if(i===null)if(e.stateNode===null){t:{i=e.type,n=e.memoizedProps,s=s.ownerDocument||s;e:switch(i){case"title":a=s.getElementsByTagName("title")[0],(!a||a[_l]||a[cn]||a.namespaceURI==="http://www.w3.org/2000/svg"||a.hasAttribute("itemprop"))&&(a=s.createElement(i),s.head.insertBefore(a,s.querySelector("head > title"))),fn(a,i,n),a[cn]=e,nn(a),i=a;break t;case"link":var r=Lv("link","href",s).get(i+(n.href||""));if(r){for(var o=0;o<r.length;o++)if(a=r[o],a.getAttribute("href")===(n.href==null||n.href===""?null:n.href)&&a.getAttribute("rel")===(n.rel==null?null:n.rel)&&a.getAttribute("title")===(n.title==null?null:n.title)&&a.getAttribute("crossorigin")===(n.crossOrigin==null?null:n.crossOrigin)){r.splice(o,1);break e}}a=s.createElement(i),fn(a,i,n),s.head.appendChild(a);break;case"meta":if(r=Lv("meta","content",s).get(i+(n.content||""))){for(o=0;o<r.length;o++)if(a=r[o],a.getAttribute("content")===(n.content==null?null:""+n.content)&&a.getAttribute("name")===(n.name==null?null:n.name)&&a.getAttribute("property")===(n.property==null?null:n.property)&&a.getAttribute("http-equiv")===(n.httpEquiv==null?null:n.httpEquiv)&&a.getAttribute("charset")===(n.charSet==null?null:n.charSet)){r.splice(o,1);break e}}a=s.createElement(i),fn(a,i,n),s.head.appendChild(a);break;default:throw Error($(468,i))}a[cn]=e,nn(a),i=a}e.stateNode=i}else Iv(s,e.type,e.stateNode);else e.stateNode=Nv(s,i,e.memoizedProps);else a!==i?(a===null?n.stateNode!==null&&(n=n.stateNode,n.parentNode.removeChild(n)):a.count--,i===null?Iv(s,e.type,e.stateNode):Nv(s,i,e.memoizedProps)):i===null&&e.stateNode!==null&&ip(e,e.memoizedProps,n.memoizedProps)}break;case 27:wn(t,e),Cn(e),i&512&&(We||n===null||Li(n,n.return)),n!==null&&i&4&&ip(e,e.memoizedProps,n.memoizedProps);break;case 5:if(wn(t,e),Cn(e),i&512&&(We||n===null||Li(n,n.return)),e.flags&32){s=e.stateNode;try{Lr(s,"")}catch(_){ce(e,e.return,_)}}i&4&&e.stateNode!=null&&(s=e.memoizedProps,ip(e,s,n!==null?n.memoizedProps:s)),i&1024&&(ap=!0);break;case 6:if(wn(t,e),Cn(e),i&4){if(e.stateNode===null)throw Error($(162));i=e.memoizedProps,n=e.stateNode;try{n.nodeValue=i}catch(_){ce(e,e.return,_)}}break;case 3:if(lu=null,s=_i,_i=Ou(t.containerInfo),wn(t,e),_i=s,Cn(e),i&4&&n!==null&&n.memoizedState.isDehydrated)try{Hr(t.containerInfo)}catch(_){ce(e,e.return,_)}ap&&(ap=!1,Fx(e));break;case 4:i=_i,_i=Ou(e.stateNode.containerInfo),wn(t,e),Cn(e),_i=i;break;case 12:wn(t,e),Cn(e);break;case 31:wn(t,e),Cn(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Xc(e,i)));break;case 13:wn(t,e),Cn(e),e.child.flags&8192&&e.memoizedState!==null!=(n!==null&&n.memoizedState!==null)&&(ju=Vn()),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Xc(e,i)));break;case 22:s=e.memoizedState!==null;var l=n!==null&&n.memoizedState!==null,c=ns,h=We;if(ns=c||s,We=h||l,wn(t,e),We=h,ns=c,Cn(e),i&8192)t:for(t=e.stateNode,t._visibility=s?t._visibility&-2:t._visibility|1,s&&(n===null||l||ns||We||wa(e)),n=null,t=e;;){if(t.tag===5||t.tag===26){if(n===null){l=n=t;try{if(a=l.stateNode,s)r=a.style,typeof r.setProperty=="function"?r.setProperty("display","none","important"):r.display="none";else{o=l.stateNode;var p=l.memoizedProps.style,u=p!=null&&p.hasOwnProperty("display")?p.display:null;o.style.display=u==null||typeof u=="boolean"?"":(""+u).trim()}}catch(_){ce(l,l.return,_)}}}else if(t.tag===6){if(n===null){l=t;try{l.stateNode.nodeValue=s?"":l.memoizedProps}catch(_){ce(l,l.return,_)}}}else if(t.tag===18){if(n===null){l=t;try{var d=l.stateNode;s?wv(d,!0):wv(l.stateNode,!1)}catch(_){ce(l,l.return,_)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break t;for(;t.sibling===null;){if(t.return===null||t.return===e)break t;n===t&&(n=null),t=t.return}n===t&&(n=null),t.sibling.return=t.return,t=t.sibling}i&4&&(i=e.updateQueue,i!==null&&(n=i.retryQueue,n!==null&&(i.retryQueue=null,Xc(e,n))));break;case 19:wn(t,e),Cn(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Xc(e,i)));break;case 30:break;case 21:break;default:wn(t,e),Cn(e)}}function Cn(e){var t=e.flags;if(t&2){try{for(var n,i=e.return;i!==null;){if(Ux(i)){n=i;break}i=i.return}if(n==null)throw Error($(160));switch(n.tag){case 27:var s=n.stateNode,a=sp(e);wu(e,a,s);break;case 5:var r=n.stateNode;n.flags&32&&(Lr(r,""),n.flags&=-33);var o=sp(e);wu(e,o,r);break;case 3:case 4:var l=n.stateNode.containerInfo,c=sp(e);qp(e,c,l);break;default:throw Error($(161))}}catch(h){ce(e,e.return,h)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function Fx(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;Fx(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function $i(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)Lx(e,t.alternate,t),t=t.sibling}function wa(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:Qs(4,t,t.return),wa(t);break;case 1:Li(t,t.return);var n=t.stateNode;typeof n.componentWillUnmount=="function"&&Rx(t,t.return,n),wa(t);break;case 27:Qo(t.stateNode);case 26:case 5:Li(t,t.return),wa(t);break;case 22:t.memoizedState===null&&wa(t);break;case 30:wa(t);break;default:wa(t)}e=e.sibling}}function ts(e,t,n){for(n=n&&(t.subtreeFlags&8772)!==0,t=t.child;t!==null;){var i=t.alternate,s=e,a=t,r=a.flags;switch(a.tag){case 0:case 11:case 15:ts(s,a,n),Sl(4,a);break;case 1:if(ts(s,a,n),i=a,s=i.stateNode,typeof s.componentDidMount=="function")try{s.componentDidMount()}catch(c){ce(i,i.return,c)}if(i=a,s=i.updateQueue,s!==null){var o=i.stateNode;try{var l=s.shared.hiddenCallbacks;if(l!==null)for(s.shared.hiddenCallbacks=null,s=0;s<l.length;s++)Py(l[s],o)}catch(c){ce(i,i.return,c)}}n&&r&64&&Cx(a),Zo(a,a.return);break;case 27:Nx(a);case 26:case 5:ts(s,a,n),n&&i===null&&r&4&&Dx(a),Zo(a,a.return);break;case 12:ts(s,a,n);break;case 31:ts(s,a,n),n&&r&4&&Px(s,a);break;case 13:ts(s,a,n),n&&r&4&&zx(s,a);break;case 22:a.memoizedState===null&&ts(s,a,n),Zo(a,a.return);break;case 30:break;default:ts(s,a,n)}t=t.sibling}}function Wm(e,t){var n=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==n&&(e!=null&&e.refCount++,n!=null&&yl(n))}function qm(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&yl(e))}function gi(e,t,n,i){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)Vx(e,t,n,i),t=t.sibling}function Vx(e,t,n,i){var s=t.flags;switch(t.tag){case 0:case 11:case 15:gi(e,t,n,i),s&2048&&Sl(9,t);break;case 1:gi(e,t,n,i);break;case 3:gi(e,t,n,i),s&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&yl(e)));break;case 12:if(s&2048){gi(e,t,n,i),e=t.stateNode;try{var a=t.memoizedProps,r=a.id,o=a.onPostCommit;typeof o=="function"&&o(r,t.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(l){ce(t,t.return,l)}}else gi(e,t,n,i);break;case 31:gi(e,t,n,i);break;case 13:gi(e,t,n,i);break;case 23:break;case 22:a=t.stateNode,r=t.alternate,t.memoizedState!==null?a._visibility&2?gi(e,t,n,i):Jo(e,t):a._visibility&2?gi(e,t,n,i):(a._visibility|=2,ur(e,t,n,i,(t.subtreeFlags&10256)!==0||!1)),s&2048&&Wm(r,t);break;case 24:gi(e,t,n,i),s&2048&&qm(t.alternate,t);break;default:gi(e,t,n,i)}}function ur(e,t,n,i,s){for(s=s&&((t.subtreeFlags&10256)!==0||!1),t=t.child;t!==null;){var a=e,r=t,o=n,l=i,c=r.flags;switch(r.tag){case 0:case 11:case 15:ur(a,r,o,l,s),Sl(8,r);break;case 23:break;case 22:var h=r.stateNode;r.memoizedState!==null?h._visibility&2?ur(a,r,o,l,s):Jo(a,r):(h._visibility|=2,ur(a,r,o,l,s)),s&&c&2048&&Wm(r.alternate,r);break;case 24:ur(a,r,o,l,s),s&&c&2048&&qm(r.alternate,r);break;default:ur(a,r,o,l,s)}t=t.sibling}}function Jo(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var n=e,i=t,s=i.flags;switch(i.tag){case 22:Jo(n,i),s&2048&&Wm(i.alternate,i);break;case 24:Jo(n,i),s&2048&&qm(i.alternate,i);break;default:Jo(n,i)}t=t.sibling}}var Fo=8192;function cr(e,t,n){if(e.subtreeFlags&Fo)for(e=e.child;e!==null;)Hx(e,t,n),e=e.sibling}function Hx(e,t,n){switch(e.tag){case 26:cr(e,t,n),e.flags&Fo&&e.memoizedState!==null&&ST(n,_i,e.memoizedState,e.memoizedProps);break;case 5:cr(e,t,n);break;case 3:case 4:var i=_i;_i=Ou(e.stateNode.containerInfo),cr(e,t,n),_i=i;break;case 22:e.memoizedState===null&&(i=e.alternate,i!==null&&i.memoizedState!==null?(i=Fo,Fo=16777216,cr(e,t,n),Fo=i):cr(e,t,n));break;default:cr(e,t,n)}}function Gx(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function No(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var n=0;n<t.length;n++){var i=t[n];en=i,Xx(i,e)}Gx(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)kx(e),e=e.sibling}function kx(e){switch(e.tag){case 0:case 11:case 15:No(e),e.flags&2048&&Qs(9,e,e.return);break;case 3:No(e);break;case 12:No(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,ru(e)):No(e);break;default:No(e)}}function ru(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var n=0;n<t.length;n++){var i=t[n];en=i,Xx(i,e)}Gx(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:Qs(8,t,t.return),ru(t);break;case 22:n=t.stateNode,n._visibility&2&&(n._visibility&=-3,ru(t));break;default:ru(t)}e=e.sibling}}function Xx(e,t){for(;en!==null;){var n=en;switch(n.tag){case 0:case 11:case 15:Qs(8,n,t);break;case 23:case 22:if(n.memoizedState!==null&&n.memoizedState.cachePool!==null){var i=n.memoizedState.cachePool.pool;i!=null&&i.refCount++}break;case 24:yl(n.memoizedState.cache)}if(i=n.child,i!==null)i.return=n,en=i;else t:for(n=e;en!==null;){i=en;var s=i.sibling,a=i.return;if(Ix(i),i===n){en=null;break t}if(s!==null){s.return=a,en=s;break t}en=a}}}var BE={getCacheForType:function(e){var t=hn(qe),n=t.data.get(e);return n===void 0&&(n=e(),t.data.set(e,n)),n},cacheSignal:function(){return hn(qe).controller.signal}},FE=typeof WeakMap=="function"?WeakMap:Map,ae=0,ge=null,Zt=null,Qt=0,le=0,Pn=null,Bs=!1,qr=!1,Ym=!1,ds=0,ze=0,$s=0,Na=0,Zm=0,Fn=0,zr=0,Ko=null,Dn=null,Yp=!1,ju=0,Wx=0,Cu=1/0,Ru=null,Ws=null,Ke=0,qs=null,Br=null,ls=0,Zp=0,Jp=null,qx=null,jo=0,Kp=null;function kn(){return(ae&2)!==0&&Qt!==0?Qt&-Qt:It.T!==null?Km():ey()}function Yx(){if(Fn===0)if((Qt&536870912)===0||ne){var e=Ic;Ic<<=1,(Ic&3932160)===0&&(Ic=262144),Fn=e}else Fn=536870912;return e=Wn.current,e!==null&&(e.flags|=32),Fn}function Un(e,t,n){(e===ge&&(le===2||le===9)||e.cancelPendingCommit!==null)&&(Fr(e,0),Fs(e,Qt,Fn,!1)),gl(e,n),((ae&2)===0||e!==ge)&&(e===ge&&((ae&2)===0&&(Na|=n),ze===4&&Fs(e,Qt,Fn,!1)),Pi(e))}function Zx(e,t,n){if((ae&6)!==0)throw Error($(327));var i=!n&&(t&127)===0&&(t&e.expiredLanes)===0||ml(e,t),s=i?GE(e,t):rp(e,t,!0),a=i;do{if(s===0){qr&&!i&&Fs(e,t,0,!1);break}else{if(n=e.current.alternate,a&&!VE(n)){s=rp(e,t,!1),a=!1;continue}if(s===2){if(a=t,e.errorRecoveryDisabledLanes&a)var r=0;else r=e.pendingLanes&-536870913,r=r!==0?r:r&536870912?536870912:0;if(r!==0){t=r;t:{var o=e;s=Ko;var l=o.current.memoizedState.isDehydrated;if(l&&(Fr(o,r).flags|=256),r=rp(o,r,!1),r!==2){if(Ym&&!l){o.errorRecoveryDisabledLanes|=a,Na|=a,s=4;break t}a=Dn,Dn=s,a!==null&&(Dn===null?Dn=a:Dn.push.apply(Dn,a))}s=r}if(a=!1,s!==2)continue}}if(s===1){Fr(e,0),Fs(e,t,0,!0);break}t:{switch(i=e,a=s,a){case 0:case 1:throw Error($(345));case 4:if((t&4194048)!==t)break;case 6:Fs(i,t,Fn,!Bs);break t;case 2:Dn=null;break;case 3:case 5:break;default:throw Error($(329))}if((t&62914560)===t&&(s=ju+300-Vn(),10<s)){if(Fs(i,t,Fn,!Bs),Vu(i,0,!0)!==0)break t;ls=t,i.timeoutHandle=pS(fv.bind(null,i,n,Dn,Ru,Yp,t,Fn,Na,zr,Bs,a,"Throttled",-0,0),s);break t}fv(i,n,Dn,Ru,Yp,t,Fn,Na,zr,Bs,a,null,-0,0)}}break}while(!0);Pi(e)}function fv(e,t,n,i,s,a,r,o,l,c,h,p,u,d){if(e.timeoutHandle=-1,p=t.subtreeFlags,p&8192||(p&16785408)===16785408){p={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:ss},Hx(t,a,p);var _=(a&62914560)===a?ju-Vn():(a&4194048)===a?Wx-Vn():0;if(_=bT(p,_),_!==null){ls=a,e.cancelPendingCommit=_(pv.bind(null,e,t,a,n,i,s,r,o,l,h,p,null,u,d)),Fs(e,a,r,!c);return}}pv(e,t,a,n,i,s,r,o,l)}function VE(e){for(var t=e;;){var n=t.tag;if((n===0||n===11||n===15)&&t.flags&16384&&(n=t.updateQueue,n!==null&&(n=n.stores,n!==null)))for(var i=0;i<n.length;i++){var s=n[i],a=s.getSnapshot;s=s.value;try{if(!Xn(a(),s))return!1}catch{return!1}}if(n=t.child,t.subtreeFlags&16384&&n!==null)n.return=t,t=n;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function Fs(e,t,n,i){t&=~Zm,t&=~Na,e.suspendedLanes|=t,e.pingedLanes&=~t,i&&(e.warmLanes|=t),i=e.expirationTimes;for(var s=t;0<s;){var a=31-Gn(s),r=1<<a;i[a]=-1,s&=~r}n!==0&&Qv(e,n,t)}function Qu(){return(ae&6)===0?(bl(0,!1),!1):!0}function Jm(){if(Zt!==null){if(le===0)var e=Zt.return;else e=Zt,as=Ga=null,Im(e),Cr=null,al=0,e=Zt;for(;e!==null;)wx(e.alternate,e),e=e.return;Zt=null}}function Fr(e,t){var n=e.timeoutHandle;n!==-1&&(e.timeoutHandle=-1,sT(n)),n=e.cancelPendingCommit,n!==null&&(e.cancelPendingCommit=null,n()),ls=0,Jm(),ge=e,Zt=n=rs(e.current,null),Qt=t,le=0,Pn=null,Bs=!1,qr=ml(e,t),Ym=!1,zr=Fn=Zm=Na=$s=ze=0,Dn=Ko=null,Yp=!1,(t&8)!==0&&(t|=t&32);var i=e.entangledLanes;if(i!==0)for(e=e.entanglements,i&=t;0<i;){var s=31-Gn(i),a=1<<s;t|=e[s],i&=~a}return ds=t,Xu(),n}function Jx(e,t){Vt=null,It.H=ol,t===Wr||t===qu?(t=X_(),le=3):t===wm?(t=X_(),le=4):le=t===km?8:t!==null&&typeof t=="object"&&typeof t.then=="function"?6:1,Pn=t,Zt===null&&(ze=1,Tu(e,oi(t,e.current)))}function Kx(){var e=Wn.current;return e===null?!0:(Qt&4194048)===Qt?ci===null:(Qt&62914560)===Qt||(Qt&536870912)!==0?e===ci:!1}function jx(){var e=It.H;return It.H=ol,e===null?ol:e}function Qx(){var e=It.A;return It.A=BE,e}function Du(){ze=4,Bs||(Qt&4194048)!==Qt&&Wn.current!==null||(qr=!0),($s&134217727)===0&&(Na&134217727)===0||ge===null||Fs(ge,Qt,Fn,!1)}function rp(e,t,n){var i=ae;ae|=2;var s=jx(),a=Qx();(ge!==e||Qt!==t)&&(Ru=null,Fr(e,t)),t=!1;var r=ze;t:do try{if(le!==0&&Zt!==null){var o=Zt,l=Pn;switch(le){case 8:Jm(),r=6;break t;case 3:case 2:case 9:case 6:Wn.current===null&&(t=!0);var c=le;if(le=0,Pn=null,Mr(e,o,l,c),n&&qr){r=0;break t}break;default:c=le,le=0,Pn=null,Mr(e,o,l,c)}}HE(),r=ze;break}catch(h){Jx(e,h)}while(!0);return t&&e.shellSuspendCounter++,as=Ga=null,ae=i,It.H=s,It.A=a,Zt===null&&(ge=null,Qt=0,Xu()),r}function HE(){for(;Zt!==null;)$x(Zt)}function GE(e,t){var n=ae;ae|=2;var i=jx(),s=Qx();ge!==e||Qt!==t?(Ru=null,Cu=Vn()+500,Fr(e,t)):qr=ml(e,t);t:do try{if(le!==0&&Zt!==null){t=Zt;var a=Pn;e:switch(le){case 1:le=0,Pn=null,Mr(e,t,a,1);break;case 2:case 9:if(k_(a)){le=0,Pn=null,dv(t);break}t=function(){le!==2&&le!==9||ge!==e||(le=7),Pi(e)},a.then(t,t);break t;case 3:le=7;break t;case 4:le=5;break t;case 7:k_(a)?(le=0,Pn=null,dv(t)):(le=0,Pn=null,Mr(e,t,a,7));break;case 5:var r=null;switch(Zt.tag){case 26:r=Zt.memoizedState;case 5:case 27:var o=Zt;if(r?yS(r):o.stateNode.complete){le=0,Pn=null;var l=o.sibling;if(l!==null)Zt=l;else{var c=o.return;c!==null?(Zt=c,$u(c)):Zt=null}break e}}le=0,Pn=null,Mr(e,t,a,5);break;case 6:le=0,Pn=null,Mr(e,t,a,6);break;case 8:Jm(),ze=6;break t;default:throw Error($(462))}}kE();break}catch(h){Jx(e,h)}while(!0);return as=Ga=null,It.H=i,It.A=s,ae=n,Zt!==null?0:(ge=null,Qt=0,Xu(),ze)}function kE(){for(;Zt!==null&&!f1();)$x(Zt)}function $x(e){var t=Ax(e.alternate,e,ds);e.memoizedProps=e.pendingProps,t===null?$u(e):Zt=t}function dv(e){var t=e,n=t.alternate;switch(t.tag){case 15:case 0:t=rv(n,t,t.pendingProps,t.type,void 0,Qt);break;case 11:t=rv(n,t,t.pendingProps,t.type.render,t.ref,Qt);break;case 5:Im(t);default:wx(n,t),t=Zt=wy(t,ds),t=Ax(n,t,ds)}e.memoizedProps=e.pendingProps,t===null?$u(e):Zt=t}function Mr(e,t,n,i){as=Ga=null,Im(t),Cr=null,al=0;var s=t.return;try{if(UE(e,s,t,n,Qt)){ze=1,Tu(e,oi(n,e.current)),Zt=null;return}}catch(a){if(s!==null)throw Zt=s,a;ze=1,Tu(e,oi(n,e.current)),Zt=null;return}t.flags&32768?(ne||i===1?e=!0:qr||(Qt&536870912)!==0?e=!1:(Bs=e=!0,(i===2||i===9||i===3||i===6)&&(i=Wn.current,i!==null&&i.tag===13&&(i.flags|=16384))),tS(t,e)):$u(t)}function $u(e){var t=e;do{if((t.flags&32768)!==0){tS(t,Bs);return}e=t.return;var n=IE(t.alternate,t,ds);if(n!==null){Zt=n;return}if(t=t.sibling,t!==null){Zt=t;return}Zt=t=e}while(t!==null);ze===0&&(ze=5)}function tS(e,t){do{var n=OE(e.alternate,e);if(n!==null){n.flags&=32767,Zt=n;return}if(n=e.return,n!==null&&(n.flags|=32768,n.subtreeFlags=0,n.deletions=null),!t&&(e=e.sibling,e!==null)){Zt=e;return}Zt=e=n}while(e!==null);ze=6,Zt=null}function pv(e,t,n,i,s,a,r,o,l){e.cancelPendingCommit=null;do th();while(Ke!==0);if((ae&6)!==0)throw Error($(327));if(t!==null){if(t===e.current)throw Error($(177));if(a=t.lanes|t.childLanes,a|=xm,b1(e,n,a,r,o,l),e===ge&&(Zt=ge=null,Qt=0),Br=t,qs=e,ls=n,Zp=a,Jp=s,qx=i,(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,YE(pu,function(){return aS(),null})):(e.callbackNode=null,e.callbackPriority=0),i=(t.flags&13878)!==0,(t.subtreeFlags&13878)!==0||i){i=It.T,It.T=null,s=re.p,re.p=2,r=ae,ae|=4;try{PE(e,t,n)}finally{ae=r,re.p=s,It.T=i}}Ke=1,eS(),nS(),iS()}}function eS(){if(Ke===1){Ke=0;var e=qs,t=Br,n=(t.flags&13878)!==0;if((t.subtreeFlags&13878)!==0||n){n=It.T,It.T=null;var i=re.p;re.p=2;var s=ae;ae|=4;try{Bx(t,e);var a=tm,r=yy(e.containerInfo),o=a.focusedElem,l=a.selectionRange;if(r!==o&&o&&o.ownerDocument&&vy(o.ownerDocument.documentElement,o)){if(l!==null&&ym(o)){var c=l.start,h=l.end;if(h===void 0&&(h=c),"selectionStart"in o)o.selectionStart=c,o.selectionEnd=Math.min(h,o.value.length);else{var p=o.ownerDocument||document,u=p&&p.defaultView||window;if(u.getSelection){var d=u.getSelection(),_=o.textContent.length,b=Math.min(l.start,_),g=l.end===void 0?b:Math.min(l.end,_);!d.extend&&b>g&&(r=g,g=b,b=r);var f=P_(o,b),v=P_(o,g);if(f&&v&&(d.rangeCount!==1||d.anchorNode!==f.node||d.anchorOffset!==f.offset||d.focusNode!==v.node||d.focusOffset!==v.offset)){var S=p.createRange();S.setStart(f.node,f.offset),d.removeAllRanges(),b>g?(d.addRange(S),d.extend(v.node,v.offset)):(S.setEnd(v.node,v.offset),d.addRange(S))}}}}for(p=[],d=o;d=d.parentNode;)d.nodeType===1&&p.push({element:d,left:d.scrollLeft,top:d.scrollTop});for(typeof o.focus=="function"&&o.focus(),o=0;o<p.length;o++){var y=p[o];y.element.scrollLeft=y.left,y.element.scrollTop=y.top}}Bu=!!$p,tm=$p=null}finally{ae=s,re.p=i,It.T=n}}e.current=t,Ke=2}}function nS(){if(Ke===2){Ke=0;var e=qs,t=Br,n=(t.flags&8772)!==0;if((t.subtreeFlags&8772)!==0||n){n=It.T,It.T=null;var i=re.p;re.p=2;var s=ae;ae|=4;try{Lx(e,t.alternate,t)}finally{ae=s,re.p=i,It.T=n}}Ke=3}}function iS(){if(Ke===4||Ke===3){Ke=0,d1();var e=qs,t=Br,n=ls,i=qx;(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?Ke=5:(Ke=0,Br=qs=null,sS(e,e.pendingLanes));var s=e.pendingLanes;if(s===0&&(Ws=null),fm(n),t=t.stateNode,Hn&&typeof Hn.onCommitFiberRoot=="function")try{Hn.onCommitFiberRoot(pl,t,void 0,(t.current.flags&128)===128)}catch{}if(i!==null){t=It.T,s=re.p,re.p=2,It.T=null;try{for(var a=e.onRecoverableError,r=0;r<i.length;r++){var o=i[r];a(o.value,{componentStack:o.stack})}}finally{It.T=t,re.p=s}}(ls&3)!==0&&th(),Pi(e),s=e.pendingLanes,(n&261930)!==0&&(s&42)!==0?e===Kp?jo++:(jo=0,Kp=e):jo=0,bl(0,!1)}}function sS(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,yl(t)))}function th(){return eS(),nS(),iS(),aS()}function aS(){if(Ke!==5)return!1;var e=qs,t=Zp;Zp=0;var n=fm(ls),i=It.T,s=re.p;try{re.p=32>n?32:n,It.T=null,n=Jp,Jp=null;var a=qs,r=ls;if(Ke=0,Br=qs=null,ls=0,(ae&6)!==0)throw Error($(331));var o=ae;if(ae|=4,kx(a.current),Vx(a,a.current,r,n),ae=o,bl(0,!1),Hn&&typeof Hn.onPostCommitFiberRoot=="function")try{Hn.onPostCommitFiberRoot(pl,a)}catch{}return!0}finally{re.p=s,It.T=i,sS(e,t)}}function mv(e,t,n){t=oi(n,t),t=kp(e.stateNode,t,2),e=Xs(e,t,2),e!==null&&(gl(e,2),Pi(e))}function ce(e,t,n){if(e.tag===3)mv(e,e,n);else for(;t!==null;){if(t.tag===3){mv(t,e,n);break}else if(t.tag===1){var i=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(Ws===null||!Ws.has(i))){e=oi(n,e),n=xx(2),i=Xs(t,n,2),i!==null&&(Sx(n,i,t,e),gl(i,2),Pi(i));break}}t=t.return}}function op(e,t,n){var i=e.pingCache;if(i===null){i=e.pingCache=new FE;var s=new Set;i.set(t,s)}else s=i.get(t),s===void 0&&(s=new Set,i.set(t,s));s.has(n)||(Ym=!0,s.add(n),e=XE.bind(null,e,t,n),t.then(e,e))}function XE(e,t,n){var i=e.pingCache;i!==null&&i.delete(t),e.pingedLanes|=e.suspendedLanes&n,e.warmLanes&=~n,ge===e&&(Qt&n)===n&&(ze===4||ze===3&&(Qt&62914560)===Qt&&300>Vn()-ju?(ae&2)===0&&Fr(e,0):Zm|=n,zr===Qt&&(zr=0)),Pi(e)}function rS(e,t){t===0&&(t=jv()),e=Ha(e,t),e!==null&&(gl(e,t),Pi(e))}function WE(e){var t=e.memoizedState,n=0;t!==null&&(n=t.retryLane),rS(e,n)}function qE(e,t){var n=0;switch(e.tag){case 31:case 13:var i=e.stateNode,s=e.memoizedState;s!==null&&(n=s.retryLane);break;case 19:i=e.stateNode;break;case 22:i=e.stateNode._retryCache;break;default:throw Error($(314))}i!==null&&i.delete(t),rS(e,n)}function YE(e,t){return um(e,t)}var Uu=null,hr=null,jp=!1,Nu=!1,lp=!1,Vs=0;function Pi(e){e!==hr&&e.next===null&&(hr===null?Uu=hr=e:hr=hr.next=e),Nu=!0,jp||(jp=!0,JE())}function bl(e,t){if(!lp&&Nu){lp=!0;do for(var n=!1,i=Uu;i!==null;){if(!t)if(e!==0){var s=i.pendingLanes;if(s===0)var a=0;else{var r=i.suspendedLanes,o=i.pingedLanes;a=(1<<31-Gn(42|e)+1)-1,a&=s&~(r&~o),a=a&201326741?a&201326741|1:a?a|2:0}a!==0&&(n=!0,gv(i,a))}else a=Qt,a=Vu(i,i===ge?a:0,i.cancelPendingCommit!==null||i.timeoutHandle!==-1),(a&3)===0||ml(i,a)||(n=!0,gv(i,a));i=i.next}while(n);lp=!1}}function ZE(){oS()}function oS(){Nu=jp=!1;var e=0;Vs!==0&&iT()&&(e=Vs);for(var t=Vn(),n=null,i=Uu;i!==null;){var s=i.next,a=lS(i,t);a===0?(i.next=null,n===null?Uu=s:n.next=s,s===null&&(hr=n)):(n=i,(e!==0||(a&3)!==0)&&(Nu=!0)),i=s}Ke!==0&&Ke!==5||bl(e,!1),Vs!==0&&(Vs=0)}function lS(e,t){for(var n=e.suspendedLanes,i=e.pingedLanes,s=e.expirationTimes,a=e.pendingLanes&-62914561;0<a;){var r=31-Gn(a),o=1<<r,l=s[r];l===-1?((o&n)===0||(o&i)!==0)&&(s[r]=S1(o,t)):l<=t&&(e.expiredLanes|=o),a&=~o}if(t=ge,n=Qt,n=Vu(e,e===t?n:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i=e.callbackNode,n===0||e===t&&(le===2||le===9)||e.cancelPendingCommit!==null)return i!==null&&i!==null&&zd(i),e.callbackNode=null,e.callbackPriority=0;if((n&3)===0||ml(e,n)){if(t=n&-n,t===e.callbackPriority)return t;switch(i!==null&&zd(i),fm(n)){case 2:case 8:n=Jv;break;case 32:n=pu;break;case 268435456:n=Kv;break;default:n=pu}return i=cS.bind(null,e),n=um(n,i),e.callbackPriority=t,e.callbackNode=n,t}return i!==null&&i!==null&&zd(i),e.callbackPriority=2,e.callbackNode=null,2}function cS(e,t){if(Ke!==0&&Ke!==5)return e.callbackNode=null,e.callbackPriority=0,null;var n=e.callbackNode;if(th()&&e.callbackNode!==n)return null;var i=Qt;return i=Vu(e,e===ge?i:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i===0?null:(Zx(e,i,t),lS(e,Vn()),e.callbackNode!=null&&e.callbackNode===n?cS.bind(null,e):null)}function gv(e,t){if(th())return null;Zx(e,t,!0)}function JE(){aT(function(){(ae&6)!==0?um(Zv,ZE):oS()})}function Km(){if(Vs===0){var e=Ir;e===0&&(e=Lc,Lc<<=1,(Lc&261888)===0&&(Lc=256)),Vs=e}return Vs}function _v(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:jc(""+e)}function vv(e,t){var n=t.ownerDocument.createElement("input");return n.name=t.name,n.value=t.value,e.id&&n.setAttribute("form",e.id),t.parentNode.insertBefore(n,t),e=new FormData(e),n.parentNode.removeChild(n),e}function KE(e,t,n,i,s){if(t==="submit"&&n&&n.stateNode===s){var a=_v((s[Nn]||null).action),r=i.submitter;r&&(t=(t=r[Nn]||null)?_v(t.formAction):r.getAttribute("formAction"),t!==null&&(a=t,r=null));var o=new Hu("action","action",null,i,s);e.push({event:o,listeners:[{instance:null,listener:function(){if(i.defaultPrevented){if(Vs!==0){var l=r?vv(s,r):new FormData(s);Hp(n,{pending:!0,data:l,method:s.method,action:a},null,l)}}else typeof a=="function"&&(o.preventDefault(),l=r?vv(s,r):new FormData(s),Hp(n,{pending:!0,data:l,method:s.method,action:a},a,l))},currentTarget:s}]})}}for(Wc=0;Wc<Rp.length;Wc++)qc=Rp[Wc],yv=qc.toLowerCase(),xv=qc[0].toUpperCase()+qc.slice(1),vi(yv,"on"+xv);var qc,yv,xv,Wc;vi(Sy,"onAnimationEnd");vi(by,"onAnimationIteration");vi(My,"onAnimationStart");vi("dblclick","onDoubleClick");vi("focusin","onFocus");vi("focusout","onBlur");vi(pE,"onTransitionRun");vi(mE,"onTransitionStart");vi(gE,"onTransitionCancel");vi(Ey,"onTransitionEnd");Nr("onMouseEnter",["mouseout","mouseover"]);Nr("onMouseLeave",["mouseout","mouseover"]);Nr("onPointerEnter",["pointerout","pointerover"]);Nr("onPointerLeave",["pointerout","pointerover"]);Ba("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));Ba("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));Ba("onBeforeInput",["compositionend","keypress","textInput","paste"]);Ba("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));Ba("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));Ba("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var ll="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),jE=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(ll));function uS(e,t){t=(t&4)!==0;for(var n=0;n<e.length;n++){var i=e[n],s=i.event;i=i.listeners;t:{var a=void 0;if(t)for(var r=i.length-1;0<=r;r--){var o=i[r],l=o.instance,c=o.currentTarget;if(o=o.listener,l!==a&&s.isPropagationStopped())break t;a=o,s.currentTarget=c;try{a(s)}catch(h){gu(h)}s.currentTarget=null,a=l}else for(r=0;r<i.length;r++){if(o=i[r],l=o.instance,c=o.currentTarget,o=o.listener,l!==a&&s.isPropagationStopped())break t;a=o,s.currentTarget=c;try{a(s)}catch(h){gu(h)}s.currentTarget=null,a=l}}}}function Yt(e,t){var n=t[Sp];n===void 0&&(n=t[Sp]=new Set);var i=e+"__bubble";n.has(i)||(hS(t,e,2,!1),n.add(i))}function cp(e,t,n){var i=0;t&&(i|=4),hS(n,e,i,t)}var Yc="_reactListening"+Math.random().toString(36).slice(2);function jm(e){if(!e[Yc]){e[Yc]=!0,ny.forEach(function(n){n!=="selectionchange"&&(jE.has(n)||cp(n,!1,e),cp(n,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[Yc]||(t[Yc]=!0,cp("selectionchange",!1,t))}}function hS(e,t,n,i){switch(ES(t)){case 2:var s=TT;break;case 8:s=AT;break;default:s=eg}n=s.bind(null,t,n,e),s=void 0,!Ap||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(s=!0),i?s!==void 0?e.addEventListener(t,n,{capture:!0,passive:s}):e.addEventListener(t,n,!0):s!==void 0?e.addEventListener(t,n,{passive:s}):e.addEventListener(t,n,!1)}function up(e,t,n,i,s){var a=i;if((t&1)===0&&(t&2)===0&&i!==null)t:for(;;){if(i===null)return;var r=i.tag;if(r===3||r===4){var o=i.stateNode.containerInfo;if(o===s)break;if(r===4)for(r=i.return;r!==null;){var l=r.tag;if((l===3||l===4)&&r.stateNode.containerInfo===s)return;r=r.return}for(;o!==null;){if(r=pr(o),r===null)return;if(l=r.tag,l===5||l===6||l===26||l===27){i=a=r;continue t}o=o.parentNode}}i=i.return}uy(function(){var c=a,h=mm(n),p=[];t:{var u=Ty.get(e);if(u!==void 0){var d=Hu,_=e;switch(e){case"keypress":if($c(n)===0)break t;case"keydown":case"keyup":d=q1;break;case"focusin":_="focus",d=Gd;break;case"focusout":_="blur",d=Gd;break;case"beforeblur":case"afterblur":d=Gd;break;case"click":if(n.button===2)break t;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":d=w_;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":d=I1;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":d=J1;break;case Sy:case by:case My:d=z1;break;case Ey:d=j1;break;case"scroll":case"scrollend":d=N1;break;case"wheel":d=$1;break;case"copy":case"cut":case"paste":d=F1;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":d=R_;break;case"toggle":case"beforetoggle":d=eE}var b=(t&4)!==0,g=!b&&(e==="scroll"||e==="scrollend"),f=b?u!==null?u+"Capture":null:u;b=[];for(var v=c,S;v!==null;){var y=v;if(S=y.stateNode,y=y.tag,y!==5&&y!==26&&y!==27||S===null||f===null||(y=tl(v,f),y!=null&&b.push(cl(v,y,S))),g)break;v=v.return}0<b.length&&(u=new d(u,_,null,n,h),p.push({event:u,listeners:b}))}}if((t&7)===0){t:{if(u=e==="mouseover"||e==="pointerover",d=e==="mouseout"||e==="pointerout",u&&n!==Tp&&(_=n.relatedTarget||n.fromElement)&&(pr(_)||_[Gr]))break t;if((d||u)&&(u=h.window===h?h:(u=h.ownerDocument)?u.defaultView||u.parentWindow:window,d?(_=n.relatedTarget||n.toElement,d=c,_=_?pr(_):null,_!==null&&(g=dl(_),b=_.tag,_!==g||b!==5&&b!==27&&b!==6)&&(_=null)):(d=null,_=c),d!==_)){if(b=w_,y="onMouseLeave",f="onMouseEnter",v="mouse",(e==="pointerout"||e==="pointerover")&&(b=R_,y="onPointerLeave",f="onPointerEnter",v="pointer"),g=d==null?u:zo(d),S=_==null?u:zo(_),u=new b(y,v+"leave",d,n,h),u.target=g,u.relatedTarget=S,y=null,pr(h)===c&&(b=new b(f,v+"enter",_,n,h),b.target=S,b.relatedTarget=g,y=b),g=y,d&&_)e:{for(b=QE,f=d,v=_,S=0,y=f;y;y=b(y))S++;y=0;for(var E=v;E;E=b(E))y++;for(;0<S-y;)f=b(f),S--;for(;0<y-S;)v=b(v),y--;for(;S--;){if(f===v||v!==null&&f===v.alternate){b=f;break e}f=b(f),v=b(v)}b=null}else b=null;d!==null&&Sv(p,u,d,b,!1),_!==null&&g!==null&&Sv(p,g,_,b,!0)}}t:{if(u=c?zo(c):window,d=u.nodeName&&u.nodeName.toLowerCase(),d==="select"||d==="input"&&u.type==="file")var A=L_;else if(N_(u))if(gy)A=hE;else{A=cE;var w=lE}else d=u.nodeName,!d||d.toLowerCase()!=="input"||u.type!=="checkbox"&&u.type!=="radio"?c&&pm(c.elementType)&&(A=L_):A=uE;if(A&&(A=A(e,c))){my(p,A,n,h);break t}w&&w(e,u,c),e==="focusout"&&c&&u.type==="number"&&c.memoizedProps.value!=null&&Ep(u,"number",u.value)}switch(w=c?zo(c):window,e){case"focusin":(N_(w)||w.contentEditable==="true")&&(_r=w,wp=c,Go=null);break;case"focusout":Go=wp=_r=null;break;case"mousedown":Cp=!0;break;case"contextmenu":case"mouseup":case"dragend":Cp=!1,z_(p,n,h);break;case"selectionchange":if(dE)break;case"keydown":case"keyup":z_(p,n,h)}var x;if(vm)t:{switch(e){case"compositionstart":var T="onCompositionStart";break t;case"compositionend":T="onCompositionEnd";break t;case"compositionupdate":T="onCompositionUpdate";break t}T=void 0}else gr?dy(e,n)&&(T="onCompositionEnd"):e==="keydown"&&n.keyCode===229&&(T="onCompositionStart");T&&(fy&&n.locale!=="ko"&&(gr||T!=="onCompositionStart"?T==="onCompositionEnd"&&gr&&(x=hy()):(zs=h,gm="value"in zs?zs.value:zs.textContent,gr=!0)),w=Lu(c,T),0<w.length&&(T=new C_(T,e,null,n,h),p.push({event:T,listeners:w}),x?T.data=x:(x=py(n),x!==null&&(T.data=x)))),(x=iE?sE(e,n):aE(e,n))&&(T=Lu(c,"onBeforeInput"),0<T.length&&(w=new C_("onBeforeInput","beforeinput",null,n,h),p.push({event:w,listeners:T}),w.data=x)),KE(p,e,c,n,h)}uS(p,t)})}function cl(e,t,n){return{instance:e,listener:t,currentTarget:n}}function Lu(e,t){for(var n=t+"Capture",i=[];e!==null;){var s=e,a=s.stateNode;if(s=s.tag,s!==5&&s!==26&&s!==27||a===null||(s=tl(e,n),s!=null&&i.unshift(cl(e,s,a)),s=tl(e,t),s!=null&&i.push(cl(e,s,a))),e.tag===3)return i;e=e.return}return[]}function QE(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function Sv(e,t,n,i,s){for(var a=t._reactName,r=[];n!==null&&n!==i;){var o=n,l=o.alternate,c=o.stateNode;if(o=o.tag,l!==null&&l===i)break;o!==5&&o!==26&&o!==27||c===null||(l=c,s?(c=tl(n,a),c!=null&&r.unshift(cl(n,c,l))):s||(c=tl(n,a),c!=null&&r.push(cl(n,c,l)))),n=n.return}r.length!==0&&e.push({event:t,listeners:r})}var $E=/\r\n?/g,tT=/\u0000|\uFFFD/g;function bv(e){return(typeof e=="string"?e:""+e).replace($E,`
`).replace(tT,"")}function fS(e,t){return t=bv(t),bv(e)===t}function he(e,t,n,i,s,a){switch(n){case"children":typeof i=="string"?t==="body"||t==="textarea"&&i===""||Lr(e,i):(typeof i=="number"||typeof i=="bigint")&&t!=="body"&&Lr(e,""+i);break;case"className":Pc(e,"class",i);break;case"tabIndex":Pc(e,"tabindex",i);break;case"dir":case"role":case"viewBox":case"width":case"height":Pc(e,n,i);break;case"style":cy(e,i,a);break;case"data":if(t!=="object"){Pc(e,"data",i);break}case"src":case"href":if(i===""&&(t!=="a"||n!=="href")){e.removeAttribute(n);break}if(i==null||typeof i=="function"||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(n);break}i=jc(""+i),e.setAttribute(n,i);break;case"action":case"formAction":if(typeof i=="function"){e.setAttribute(n,"javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");break}else typeof a=="function"&&(n==="formAction"?(t!=="input"&&he(e,t,"name",s.name,s,null),he(e,t,"formEncType",s.formEncType,s,null),he(e,t,"formMethod",s.formMethod,s,null),he(e,t,"formTarget",s.formTarget,s,null)):(he(e,t,"encType",s.encType,s,null),he(e,t,"method",s.method,s,null),he(e,t,"target",s.target,s,null)));if(i==null||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(n);break}i=jc(""+i),e.setAttribute(n,i);break;case"onClick":i!=null&&(e.onclick=ss);break;case"onScroll":i!=null&&Yt("scroll",e);break;case"onScrollEnd":i!=null&&Yt("scrollend",e);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error($(61));if(n=i.__html,n!=null){if(s.children!=null)throw Error($(60));e.innerHTML=n}}break;case"multiple":e.multiple=i&&typeof i!="function"&&typeof i!="symbol";break;case"muted":e.muted=i&&typeof i!="function"&&typeof i!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(i==null||typeof i=="function"||typeof i=="boolean"||typeof i=="symbol"){e.removeAttribute("xlink:href");break}n=jc(""+i),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",n);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,""+i):e.removeAttribute(n);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":i&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,""):e.removeAttribute(n);break;case"capture":case"download":i===!0?e.setAttribute(n,""):i!==!1&&i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,i):e.removeAttribute(n);break;case"cols":case"rows":case"size":case"span":i!=null&&typeof i!="function"&&typeof i!="symbol"&&!isNaN(i)&&1<=i?e.setAttribute(n,i):e.removeAttribute(n);break;case"rowSpan":case"start":i==null||typeof i=="function"||typeof i=="symbol"||isNaN(i)?e.removeAttribute(n):e.setAttribute(n,i);break;case"popover":Yt("beforetoggle",e),Yt("toggle",e),Kc(e,"popover",i);break;case"xlinkActuate":Ki(e,"http://www.w3.org/1999/xlink","xlink:actuate",i);break;case"xlinkArcrole":Ki(e,"http://www.w3.org/1999/xlink","xlink:arcrole",i);break;case"xlinkRole":Ki(e,"http://www.w3.org/1999/xlink","xlink:role",i);break;case"xlinkShow":Ki(e,"http://www.w3.org/1999/xlink","xlink:show",i);break;case"xlinkTitle":Ki(e,"http://www.w3.org/1999/xlink","xlink:title",i);break;case"xlinkType":Ki(e,"http://www.w3.org/1999/xlink","xlink:type",i);break;case"xmlBase":Ki(e,"http://www.w3.org/XML/1998/namespace","xml:base",i);break;case"xmlLang":Ki(e,"http://www.w3.org/XML/1998/namespace","xml:lang",i);break;case"xmlSpace":Ki(e,"http://www.w3.org/XML/1998/namespace","xml:space",i);break;case"is":Kc(e,"is",i);break;case"innerText":case"textContent":break;default:(!(2<n.length)||n[0]!=="o"&&n[0]!=="O"||n[1]!=="n"&&n[1]!=="N")&&(n=D1.get(n)||n,Kc(e,n,i))}}function Qp(e,t,n,i,s,a){switch(n){case"style":cy(e,i,a);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error($(61));if(n=i.__html,n!=null){if(s.children!=null)throw Error($(60));e.innerHTML=n}}break;case"children":typeof i=="string"?Lr(e,i):(typeof i=="number"||typeof i=="bigint")&&Lr(e,""+i);break;case"onScroll":i!=null&&Yt("scroll",e);break;case"onScrollEnd":i!=null&&Yt("scrollend",e);break;case"onClick":i!=null&&(e.onclick=ss);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!iy.hasOwnProperty(n))t:{if(n[0]==="o"&&n[1]==="n"&&(s=n.endsWith("Capture"),t=n.slice(2,s?n.length-7:void 0),a=e[Nn]||null,a=a!=null?a[n]:null,typeof a=="function"&&e.removeEventListener(t,a,s),typeof i=="function")){typeof a!="function"&&a!==null&&(n in e?e[n]=null:e.hasAttribute(n)&&e.removeAttribute(n)),e.addEventListener(t,i,s);break t}n in e?e[n]=i:i===!0?e.setAttribute(n,""):Kc(e,n,i)}}}function fn(e,t,n){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":Yt("error",e),Yt("load",e);var i=!1,s=!1,a;for(a in n)if(n.hasOwnProperty(a)){var r=n[a];if(r!=null)switch(a){case"src":i=!0;break;case"srcSet":s=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error($(137,t));default:he(e,t,a,r,n,null)}}s&&he(e,t,"srcSet",n.srcSet,n,null),i&&he(e,t,"src",n.src,n,null);return;case"input":Yt("invalid",e);var o=a=r=s=null,l=null,c=null;for(i in n)if(n.hasOwnProperty(i)){var h=n[i];if(h!=null)switch(i){case"name":s=h;break;case"type":r=h;break;case"checked":l=h;break;case"defaultChecked":c=h;break;case"value":a=h;break;case"defaultValue":o=h;break;case"children":case"dangerouslySetInnerHTML":if(h!=null)throw Error($(137,t));break;default:he(e,t,i,h,n,null)}}ry(e,a,o,l,c,r,s,!1);return;case"select":Yt("invalid",e),i=r=a=null;for(s in n)if(n.hasOwnProperty(s)&&(o=n[s],o!=null))switch(s){case"value":a=o;break;case"defaultValue":r=o;break;case"multiple":i=o;default:he(e,t,s,o,n,null)}t=a,n=r,e.multiple=!!i,t!=null?Tr(e,!!i,t,!1):n!=null&&Tr(e,!!i,n,!0);return;case"textarea":Yt("invalid",e),a=s=i=null;for(r in n)if(n.hasOwnProperty(r)&&(o=n[r],o!=null))switch(r){case"value":i=o;break;case"defaultValue":s=o;break;case"children":a=o;break;case"dangerouslySetInnerHTML":if(o!=null)throw Error($(91));break;default:he(e,t,r,o,n,null)}ly(e,i,s,a);return;case"option":for(l in n)if(n.hasOwnProperty(l)&&(i=n[l],i!=null))switch(l){case"selected":e.selected=i&&typeof i!="function"&&typeof i!="symbol";break;default:he(e,t,l,i,n,null)}return;case"dialog":Yt("beforetoggle",e),Yt("toggle",e),Yt("cancel",e),Yt("close",e);break;case"iframe":case"object":Yt("load",e);break;case"video":case"audio":for(i=0;i<ll.length;i++)Yt(ll[i],e);break;case"image":Yt("error",e),Yt("load",e);break;case"details":Yt("toggle",e);break;case"embed":case"source":case"link":Yt("error",e),Yt("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(c in n)if(n.hasOwnProperty(c)&&(i=n[c],i!=null))switch(c){case"children":case"dangerouslySetInnerHTML":throw Error($(137,t));default:he(e,t,c,i,n,null)}return;default:if(pm(t)){for(h in n)n.hasOwnProperty(h)&&(i=n[h],i!==void 0&&Qp(e,t,h,i,n,void 0));return}}for(o in n)n.hasOwnProperty(o)&&(i=n[o],i!=null&&he(e,t,o,i,n,null))}function eT(e,t,n,i){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var s=null,a=null,r=null,o=null,l=null,c=null,h=null;for(d in n){var p=n[d];if(n.hasOwnProperty(d)&&p!=null)switch(d){case"checked":break;case"value":break;case"defaultValue":l=p;default:i.hasOwnProperty(d)||he(e,t,d,null,i,p)}}for(var u in i){var d=i[u];if(p=n[u],i.hasOwnProperty(u)&&(d!=null||p!=null))switch(u){case"type":a=d;break;case"name":s=d;break;case"checked":c=d;break;case"defaultChecked":h=d;break;case"value":r=d;break;case"defaultValue":o=d;break;case"children":case"dangerouslySetInnerHTML":if(d!=null)throw Error($(137,t));break;default:d!==p&&he(e,t,u,d,i,p)}}Mp(e,r,o,l,c,h,a,s);return;case"select":d=r=o=u=null;for(a in n)if(l=n[a],n.hasOwnProperty(a)&&l!=null)switch(a){case"value":break;case"multiple":d=l;default:i.hasOwnProperty(a)||he(e,t,a,null,i,l)}for(s in i)if(a=i[s],l=n[s],i.hasOwnProperty(s)&&(a!=null||l!=null))switch(s){case"value":u=a;break;case"defaultValue":o=a;break;case"multiple":r=a;default:a!==l&&he(e,t,s,a,i,l)}t=o,n=r,i=d,u!=null?Tr(e,!!n,u,!1):!!i!=!!n&&(t!=null?Tr(e,!!n,t,!0):Tr(e,!!n,n?[]:"",!1));return;case"textarea":d=u=null;for(o in n)if(s=n[o],n.hasOwnProperty(o)&&s!=null&&!i.hasOwnProperty(o))switch(o){case"value":break;case"children":break;default:he(e,t,o,null,i,s)}for(r in i)if(s=i[r],a=n[r],i.hasOwnProperty(r)&&(s!=null||a!=null))switch(r){case"value":u=s;break;case"defaultValue":d=s;break;case"children":break;case"dangerouslySetInnerHTML":if(s!=null)throw Error($(91));break;default:s!==a&&he(e,t,r,s,i,a)}oy(e,u,d);return;case"option":for(var _ in n)if(u=n[_],n.hasOwnProperty(_)&&u!=null&&!i.hasOwnProperty(_))switch(_){case"selected":e.selected=!1;break;default:he(e,t,_,null,i,u)}for(l in i)if(u=i[l],d=n[l],i.hasOwnProperty(l)&&u!==d&&(u!=null||d!=null))switch(l){case"selected":e.selected=u&&typeof u!="function"&&typeof u!="symbol";break;default:he(e,t,l,u,i,d)}return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var b in n)u=n[b],n.hasOwnProperty(b)&&u!=null&&!i.hasOwnProperty(b)&&he(e,t,b,null,i,u);for(c in i)if(u=i[c],d=n[c],i.hasOwnProperty(c)&&u!==d&&(u!=null||d!=null))switch(c){case"children":case"dangerouslySetInnerHTML":if(u!=null)throw Error($(137,t));break;default:he(e,t,c,u,i,d)}return;default:if(pm(t)){for(var g in n)u=n[g],n.hasOwnProperty(g)&&u!==void 0&&!i.hasOwnProperty(g)&&Qp(e,t,g,void 0,i,u);for(h in i)u=i[h],d=n[h],!i.hasOwnProperty(h)||u===d||u===void 0&&d===void 0||Qp(e,t,h,u,i,d);return}}for(var f in n)u=n[f],n.hasOwnProperty(f)&&u!=null&&!i.hasOwnProperty(f)&&he(e,t,f,null,i,u);for(p in i)u=i[p],d=n[p],!i.hasOwnProperty(p)||u===d||u==null&&d==null||he(e,t,p,u,i,d)}function Mv(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function nT(){if(typeof performance.getEntriesByType=="function"){for(var e=0,t=0,n=performance.getEntriesByType("resource"),i=0;i<n.length;i++){var s=n[i],a=s.transferSize,r=s.initiatorType,o=s.duration;if(a&&o&&Mv(r)){for(r=0,o=s.responseEnd,i+=1;i<n.length;i++){var l=n[i],c=l.startTime;if(c>o)break;var h=l.transferSize,p=l.initiatorType;h&&Mv(p)&&(l=l.responseEnd,r+=h*(l<o?1:(o-c)/(l-c)))}if(--i,t+=8*(a+r)/(s.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var $p=null,tm=null;function Iu(e){return e.nodeType===9?e:e.ownerDocument}function Ev(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function dS(e,t){if(e===0)switch(t){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&t==="foreignObject"?0:e}function em(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.children=="bigint"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var hp=null;function iT(){var e=window.event;return e&&e.type==="popstate"?e===hp?!1:(hp=e,!0):(hp=null,!1)}var pS=typeof setTimeout=="function"?setTimeout:void 0,sT=typeof clearTimeout=="function"?clearTimeout:void 0,Tv=typeof Promise=="function"?Promise:void 0,aT=typeof queueMicrotask=="function"?queueMicrotask:typeof Tv<"u"?function(e){return Tv.resolve(null).then(e).catch(rT)}:pS;function rT(e){setTimeout(function(){throw e})}function ea(e){return e==="head"}function Av(e,t){var n=t,i=0;do{var s=n.nextSibling;if(e.removeChild(n),s&&s.nodeType===8)if(n=s.data,n==="/$"||n==="/&"){if(i===0){e.removeChild(s),Hr(t);return}i--}else if(n==="$"||n==="$?"||n==="$~"||n==="$!"||n==="&")i++;else if(n==="html")Qo(e.ownerDocument.documentElement);else if(n==="head"){n=e.ownerDocument.head,Qo(n);for(var a=n.firstChild;a;){var r=a.nextSibling,o=a.nodeName;a[_l]||o==="SCRIPT"||o==="STYLE"||o==="LINK"&&a.rel.toLowerCase()==="stylesheet"||n.removeChild(a),a=r}}else n==="body"&&Qo(e.ownerDocument.body);n=s}while(n);Hr(t)}function wv(e,t){var n=e;e=0;do{var i=n.nextSibling;if(n.nodeType===1?t?(n._stashedDisplay=n.style.display,n.style.display="none"):(n.style.display=n._stashedDisplay||"",n.getAttribute("style")===""&&n.removeAttribute("style")):n.nodeType===3&&(t?(n._stashedText=n.nodeValue,n.nodeValue=""):n.nodeValue=n._stashedText||""),i&&i.nodeType===8)if(n=i.data,n==="/$"){if(e===0)break;e--}else n!=="$"&&n!=="$?"&&n!=="$~"&&n!=="$!"||e++;n=i}while(n)}function nm(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var n=t;switch(t=t.nextSibling,n.nodeName){case"HTML":case"HEAD":case"BODY":nm(n),dm(n);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(n.rel.toLowerCase()==="stylesheet")continue}e.removeChild(n)}}function oT(e,t,n,i){for(;e.nodeType===1;){var s=n;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!i&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(i){if(!e[_l])switch(t){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(a=e.getAttribute("rel"),a==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(a!==s.rel||e.getAttribute("href")!==(s.href==null||s.href===""?null:s.href)||e.getAttribute("crossorigin")!==(s.crossOrigin==null?null:s.crossOrigin)||e.getAttribute("title")!==(s.title==null?null:s.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(a=e.getAttribute("src"),(a!==(s.src==null?null:s.src)||e.getAttribute("type")!==(s.type==null?null:s.type)||e.getAttribute("crossorigin")!==(s.crossOrigin==null?null:s.crossOrigin))&&a&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(t==="input"&&e.type==="hidden"){var a=s.name==null?null:""+s.name;if(s.type==="hidden"&&e.getAttribute("name")===a)return e}else return e;if(e=ui(e.nextSibling),e===null)break}return null}function lT(e,t,n){if(t==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!n||(e=ui(e.nextSibling),e===null))return null;return e}function mS(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!t||(e=ui(e.nextSibling),e===null))return null;return e}function im(e){return e.data==="$?"||e.data==="$~"}function sm(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function cT(e,t){var n=e.ownerDocument;if(e.data==="$~")e._reactRetry=t;else if(e.data!=="$?"||n.readyState!=="loading")t();else{var i=function(){t(),n.removeEventListener("DOMContentLoaded",i)};n.addEventListener("DOMContentLoaded",i),e._reactRetry=i}}function ui(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?"||t==="$~"||t==="&"||t==="F!"||t==="F")break;if(t==="/$"||t==="/&")return null}}return e}var am=null;function Cv(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="/$"||n==="/&"){if(t===0)return ui(e.nextSibling);t--}else n!=="$"&&n!=="$!"&&n!=="$?"&&n!=="$~"&&n!=="&"||t++}e=e.nextSibling}return null}function Rv(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="$"||n==="$!"||n==="$?"||n==="$~"||n==="&"){if(t===0)return e;t--}else n!=="/$"&&n!=="/&"||t++}e=e.previousSibling}return null}function gS(e,t,n){switch(t=Iu(n),e){case"html":if(e=t.documentElement,!e)throw Error($(452));return e;case"head":if(e=t.head,!e)throw Error($(453));return e;case"body":if(e=t.body,!e)throw Error($(454));return e;default:throw Error($(451))}}function Qo(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);dm(e)}var hi=new Map,Dv=new Set;function Ou(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var ps=re.d;re.d={f:uT,r:hT,D:fT,C:dT,L:pT,m:mT,X:_T,S:gT,M:vT};function uT(){var e=ps.f(),t=Qu();return e||t}function hT(e){var t=kr(e);t!==null&&t.tag===5&&t.type==="form"?cx(t):ps.r(e)}var Yr=typeof document>"u"?null:document;function _S(e,t,n){var i=Yr;if(i&&typeof t=="string"&&t){var s=ri(t);s='link[rel="'+e+'"][href="'+s+'"]',typeof n=="string"&&(s+='[crossorigin="'+n+'"]'),Dv.has(s)||(Dv.add(s),e={rel:e,crossOrigin:n,href:t},i.querySelector(s)===null&&(t=i.createElement("link"),fn(t,"link",e),nn(t),i.head.appendChild(t)))}}function fT(e){ps.D(e),_S("dns-prefetch",e,null)}function dT(e,t){ps.C(e,t),_S("preconnect",e,t)}function pT(e,t,n){ps.L(e,t,n);var i=Yr;if(i&&e&&t){var s='link[rel="preload"][as="'+ri(t)+'"]';t==="image"&&n&&n.imageSrcSet?(s+='[imagesrcset="'+ri(n.imageSrcSet)+'"]',typeof n.imageSizes=="string"&&(s+='[imagesizes="'+ri(n.imageSizes)+'"]')):s+='[href="'+ri(e)+'"]';var a=s;switch(t){case"style":a=Vr(e);break;case"script":a=Zr(e)}hi.has(a)||(e=Ee({rel:"preload",href:t==="image"&&n&&n.imageSrcSet?void 0:e,as:t},n),hi.set(a,e),i.querySelector(s)!==null||t==="style"&&i.querySelector(Ml(a))||t==="script"&&i.querySelector(El(a))||(t=i.createElement("link"),fn(t,"link",e),nn(t),i.head.appendChild(t)))}}function mT(e,t){ps.m(e,t);var n=Yr;if(n&&e){var i=t&&typeof t.as=="string"?t.as:"script",s='link[rel="modulepreload"][as="'+ri(i)+'"][href="'+ri(e)+'"]',a=s;switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":a=Zr(e)}if(!hi.has(a)&&(e=Ee({rel:"modulepreload",href:e},t),hi.set(a,e),n.querySelector(s)===null)){switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(n.querySelector(El(a)))return}i=n.createElement("link"),fn(i,"link",e),nn(i),n.head.appendChild(i)}}}function gT(e,t,n){ps.S(e,t,n);var i=Yr;if(i&&e){var s=Er(i).hoistableStyles,a=Vr(e);t=t||"default";var r=s.get(a);if(!r){var o={loading:0,preload:null};if(r=i.querySelector(Ml(a)))o.loading=5;else{e=Ee({rel:"stylesheet",href:e,"data-precedence":t},n),(n=hi.get(a))&&Qm(e,n);var l=r=i.createElement("link");nn(l),fn(l,"link",e),l._p=new Promise(function(c,h){l.onload=c,l.onerror=h}),l.addEventListener("load",function(){o.loading|=1}),l.addEventListener("error",function(){o.loading|=2}),o.loading|=4,ou(r,t,i)}r={type:"stylesheet",instance:r,count:1,state:o},s.set(a,r)}}}function _T(e,t){ps.X(e,t);var n=Yr;if(n&&e){var i=Er(n).hoistableScripts,s=Zr(e),a=i.get(s);a||(a=n.querySelector(El(s)),a||(e=Ee({src:e,async:!0},t),(t=hi.get(s))&&$m(e,t),a=n.createElement("script"),nn(a),fn(a,"link",e),n.head.appendChild(a)),a={type:"script",instance:a,count:1,state:null},i.set(s,a))}}function vT(e,t){ps.M(e,t);var n=Yr;if(n&&e){var i=Er(n).hoistableScripts,s=Zr(e),a=i.get(s);a||(a=n.querySelector(El(s)),a||(e=Ee({src:e,async:!0,type:"module"},t),(t=hi.get(s))&&$m(e,t),a=n.createElement("script"),nn(a),fn(a,"link",e),n.head.appendChild(a)),a={type:"script",instance:a,count:1,state:null},i.set(s,a))}}function Uv(e,t,n,i){var s=(s=Hs.current)?Ou(s):null;if(!s)throw Error($(446));switch(e){case"meta":case"title":return null;case"style":return typeof n.precedence=="string"&&typeof n.href=="string"?(t=Vr(n.href),n=Er(s).hoistableStyles,i=n.get(t),i||(i={type:"style",instance:null,count:0,state:null},n.set(t,i)),i):{type:"void",instance:null,count:0,state:null};case"link":if(n.rel==="stylesheet"&&typeof n.href=="string"&&typeof n.precedence=="string"){e=Vr(n.href);var a=Er(s).hoistableStyles,r=a.get(e);if(r||(s=s.ownerDocument||s,r={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},a.set(e,r),(a=s.querySelector(Ml(e)))&&!a._p&&(r.instance=a,r.state.loading=5),hi.has(e)||(n={rel:"preload",as:"style",href:n.href,crossOrigin:n.crossOrigin,integrity:n.integrity,media:n.media,hrefLang:n.hrefLang,referrerPolicy:n.referrerPolicy},hi.set(e,n),a||yT(s,e,n,r.state))),t&&i===null)throw Error($(528,""));return r}if(t&&i!==null)throw Error($(529,""));return null;case"script":return t=n.async,n=n.src,typeof n=="string"&&t&&typeof t!="function"&&typeof t!="symbol"?(t=Zr(n),n=Er(s).hoistableScripts,i=n.get(t),i||(i={type:"script",instance:null,count:0,state:null},n.set(t,i)),i):{type:"void",instance:null,count:0,state:null};default:throw Error($(444,e))}}function Vr(e){return'href="'+ri(e)+'"'}function Ml(e){return'link[rel="stylesheet"]['+e+"]"}function vS(e){return Ee({},e,{"data-precedence":e.precedence,precedence:null})}function yT(e,t,n,i){e.querySelector('link[rel="preload"][as="style"]['+t+"]")?i.loading=1:(t=e.createElement("link"),i.preload=t,t.addEventListener("load",function(){return i.loading|=1}),t.addEventListener("error",function(){return i.loading|=2}),fn(t,"link",n),nn(t),e.head.appendChild(t))}function Zr(e){return'[src="'+ri(e)+'"]'}function El(e){return"script[async]"+e}function Nv(e,t,n){if(t.count++,t.instance===null)switch(t.type){case"style":var i=e.querySelector('style[data-href~="'+ri(n.href)+'"]');if(i)return t.instance=i,nn(i),i;var s=Ee({},n,{"data-href":n.href,"data-precedence":n.precedence,href:null,precedence:null});return i=(e.ownerDocument||e).createElement("style"),nn(i),fn(i,"style",s),ou(i,n.precedence,e),t.instance=i;case"stylesheet":s=Vr(n.href);var a=e.querySelector(Ml(s));if(a)return t.state.loading|=4,t.instance=a,nn(a),a;i=vS(n),(s=hi.get(s))&&Qm(i,s),a=(e.ownerDocument||e).createElement("link"),nn(a);var r=a;return r._p=new Promise(function(o,l){r.onload=o,r.onerror=l}),fn(a,"link",i),t.state.loading|=4,ou(a,n.precedence,e),t.instance=a;case"script":return a=Zr(n.src),(s=e.querySelector(El(a)))?(t.instance=s,nn(s),s):(i=n,(s=hi.get(a))&&(i=Ee({},n),$m(i,s)),e=e.ownerDocument||e,s=e.createElement("script"),nn(s),fn(s,"link",i),e.head.appendChild(s),t.instance=s);case"void":return null;default:throw Error($(443,t.type))}else t.type==="stylesheet"&&(t.state.loading&4)===0&&(i=t.instance,t.state.loading|=4,ou(i,n.precedence,e));return t.instance}function ou(e,t,n){for(var i=n.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'),s=i.length?i[i.length-1]:null,a=s,r=0;r<i.length;r++){var o=i[r];if(o.dataset.precedence===t)a=o;else if(a!==s)break}a?a.parentNode.insertBefore(e,a.nextSibling):(t=n.nodeType===9?n.head:n,t.insertBefore(e,t.firstChild))}function Qm(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.title==null&&(e.title=t.title)}function $m(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.integrity==null&&(e.integrity=t.integrity)}var lu=null;function Lv(e,t,n){if(lu===null){var i=new Map,s=lu=new Map;s.set(n,i)}else s=lu,i=s.get(n),i||(i=new Map,s.set(n,i));if(i.has(e))return i;for(i.set(e,null),n=n.getElementsByTagName(e),s=0;s<n.length;s++){var a=n[s];if(!(a[_l]||a[cn]||e==="link"&&a.getAttribute("rel")==="stylesheet")&&a.namespaceURI!=="http://www.w3.org/2000/svg"){var r=a.getAttribute(t)||"";r=e+r;var o=i.get(r);o?o.push(a):i.set(r,[a])}}return i}function Iv(e,t,n){e=e.ownerDocument||e,e.head.insertBefore(n,t==="title"?e.querySelector("head > title"):null)}function xT(e,t,n){if(n===1||t.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof t.precedence!="string"||typeof t.href!="string"||t.href==="")break;return!0;case"link":if(typeof t.rel!="string"||typeof t.href!="string"||t.href===""||t.onLoad||t.onError)break;switch(t.rel){case"stylesheet":return e=t.disabled,typeof t.precedence=="string"&&e==null;default:return!0}case"script":if(t.async&&typeof t.async!="function"&&typeof t.async!="symbol"&&!t.onLoad&&!t.onError&&t.src&&typeof t.src=="string")return!0}return!1}function yS(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function ST(e,t,n,i){if(n.type==="stylesheet"&&(typeof i.media!="string"||matchMedia(i.media).matches!==!1)&&(n.state.loading&4)===0){if(n.instance===null){var s=Vr(i.href),a=t.querySelector(Ml(s));if(a){t=a._p,t!==null&&typeof t=="object"&&typeof t.then=="function"&&(e.count++,e=Pu.bind(e),t.then(e,e)),n.state.loading|=4,n.instance=a,nn(a);return}a=t.ownerDocument||t,i=vS(i),(s=hi.get(s))&&Qm(i,s),a=a.createElement("link"),nn(a);var r=a;r._p=new Promise(function(o,l){r.onload=o,r.onerror=l}),fn(a,"link",i),n.instance=a}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(n,t),(t=n.state.preload)&&(n.state.loading&3)===0&&(e.count++,n=Pu.bind(e),t.addEventListener("load",n),t.addEventListener("error",n))}}var fp=0;function bT(e,t){return e.stylesheets&&e.count===0&&cu(e,e.stylesheets),0<e.count||0<e.imgCount?function(n){var i=setTimeout(function(){if(e.stylesheets&&cu(e,e.stylesheets),e.unsuspend){var a=e.unsuspend;e.unsuspend=null,a()}},6e4+t);0<e.imgBytes&&fp===0&&(fp=62500*nT());var s=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&cu(e,e.stylesheets),e.unsuspend)){var a=e.unsuspend;e.unsuspend=null,a()}},(e.imgBytes>fp?50:800)+t);return e.unsuspend=n,function(){e.unsuspend=null,clearTimeout(i),clearTimeout(s)}}:null}function Pu(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)cu(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var zu=null;function cu(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,zu=new Map,t.forEach(MT,e),zu=null,Pu.call(e))}function MT(e,t){if(!(t.state.loading&4)){var n=zu.get(e);if(n)var i=n.get(null);else{n=new Map,zu.set(e,n);for(var s=e.querySelectorAll("link[data-precedence],style[data-precedence]"),a=0;a<s.length;a++){var r=s[a];(r.nodeName==="LINK"||r.getAttribute("media")!=="not all")&&(n.set(r.dataset.precedence,r),i=r)}i&&n.set(null,i)}s=t.instance,r=s.getAttribute("data-precedence"),a=n.get(r)||i,a===i&&n.set(null,s),n.set(r,s),this.count++,i=Pu.bind(this),s.addEventListener("load",i),s.addEventListener("error",i),a?a.parentNode.insertBefore(s,a.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(s,e.firstChild)),t.state.loading|=4}}var ul={$$typeof:is,Provider:null,Consumer:null,_currentValue:Ca,_currentValue2:Ca,_threadCount:0};function ET(e,t,n,i,s,a,r,o,l){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=Bd(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Bd(0),this.hiddenUpdates=Bd(null),this.identifierPrefix=i,this.onUncaughtError=s,this.onCaughtError=a,this.onRecoverableError=r,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=l,this.incompleteTransitions=new Map}function xS(e,t,n,i,s,a,r,o,l,c,h,p){return e=new ET(e,t,n,r,l,c,h,p,o),t=1,a===!0&&(t|=24),a=Bn(3,null,null,t),e.current=a,a.stateNode=e,t=Tm(),t.refCount++,e.pooledCache=t,t.refCount++,a.memoizedState={element:i,isDehydrated:n,cache:t},Cm(a),e}function SS(e){return e?(e=xr,e):xr}function bS(e,t,n,i,s,a){s=SS(s),i.context===null?i.context=s:i.pendingContext=s,i=ks(t),i.payload={element:n},a=a===void 0?null:a,a!==null&&(i.callback=a),n=Xs(e,i,t),n!==null&&(Un(n,e,t),Xo(n,e,t))}function Ov(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var n=e.retryLane;e.retryLane=n!==0&&n<t?n:t}}function tg(e,t){Ov(e,t),(e=e.alternate)&&Ov(e,t)}function MS(e){if(e.tag===13||e.tag===31){var t=Ha(e,67108864);t!==null&&Un(t,e,67108864),tg(e,67108864)}}function Pv(e){if(e.tag===13||e.tag===31){var t=kn();t=hm(t);var n=Ha(e,t);n!==null&&Un(n,e,t),tg(e,t)}}var Bu=!0;function TT(e,t,n,i){var s=It.T;It.T=null;var a=re.p;try{re.p=2,eg(e,t,n,i)}finally{re.p=a,It.T=s}}function AT(e,t,n,i){var s=It.T;It.T=null;var a=re.p;try{re.p=8,eg(e,t,n,i)}finally{re.p=a,It.T=s}}function eg(e,t,n,i){if(Bu){var s=rm(i);if(s===null)up(e,t,i,Fu,n),zv(e,i);else if(CT(s,e,t,n,i))i.stopPropagation();else if(zv(e,i),t&4&&-1<wT.indexOf(e)){for(;s!==null;){var a=kr(s);if(a!==null)switch(a.tag){case 3:if(a=a.stateNode,a.current.memoizedState.isDehydrated){var r=Ta(a.pendingLanes);if(r!==0){var o=a;for(o.pendingLanes|=2,o.entangledLanes|=2;r;){var l=1<<31-Gn(r);o.entanglements[1]|=l,r&=~l}Pi(a),(ae&6)===0&&(Cu=Vn()+500,bl(0,!1))}}break;case 31:case 13:o=Ha(a,2),o!==null&&Un(o,a,2),Qu(),tg(a,2)}if(a=rm(i),a===null&&up(e,t,i,Fu,n),a===s)break;s=a}s!==null&&i.stopPropagation()}else up(e,t,i,null,n)}}function rm(e){return e=mm(e),ng(e)}var Fu=null;function ng(e){if(Fu=null,e=pr(e),e!==null){var t=dl(e);if(t===null)e=null;else{var n=t.tag;if(n===13){if(e=kv(t),e!==null)return e;e=null}else if(n===31){if(e=Xv(t),e!==null)return e;e=null}else if(n===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return Fu=e,null}function ES(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(p1()){case Zv:return 2;case Jv:return 8;case pu:case m1:return 32;case Kv:return 268435456;default:return 32}default:return 32}}var om=!1,Ys=null,Zs=null,Js=null,hl=new Map,fl=new Map,Os=[],wT="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function zv(e,t){switch(e){case"focusin":case"focusout":Ys=null;break;case"dragenter":case"dragleave":Zs=null;break;case"mouseover":case"mouseout":Js=null;break;case"pointerover":case"pointerout":hl.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":fl.delete(t.pointerId)}}function Lo(e,t,n,i,s,a){return e===null||e.nativeEvent!==a?(e={blockedOn:t,domEventName:n,eventSystemFlags:i,nativeEvent:a,targetContainers:[s]},t!==null&&(t=kr(t),t!==null&&MS(t)),e):(e.eventSystemFlags|=i,t=e.targetContainers,s!==null&&t.indexOf(s)===-1&&t.push(s),e)}function CT(e,t,n,i,s){switch(t){case"focusin":return Ys=Lo(Ys,e,t,n,i,s),!0;case"dragenter":return Zs=Lo(Zs,e,t,n,i,s),!0;case"mouseover":return Js=Lo(Js,e,t,n,i,s),!0;case"pointerover":var a=s.pointerId;return hl.set(a,Lo(hl.get(a)||null,e,t,n,i,s)),!0;case"gotpointercapture":return a=s.pointerId,fl.set(a,Lo(fl.get(a)||null,e,t,n,i,s)),!0}return!1}function TS(e){var t=pr(e.target);if(t!==null){var n=dl(t);if(n!==null){if(t=n.tag,t===13){if(t=kv(n),t!==null){e.blockedOn=t,x_(e.priority,function(){Pv(n)});return}}else if(t===31){if(t=Xv(n),t!==null){e.blockedOn=t,x_(e.priority,function(){Pv(n)});return}}else if(t===3&&n.stateNode.current.memoizedState.isDehydrated){e.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}e.blockedOn=null}function uu(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var n=rm(e.nativeEvent);if(n===null){n=e.nativeEvent;var i=new n.constructor(n.type,n);Tp=i,n.target.dispatchEvent(i),Tp=null}else return t=kr(n),t!==null&&MS(t),e.blockedOn=n,!1;t.shift()}return!0}function Bv(e,t,n){uu(e)&&n.delete(t)}function RT(){om=!1,Ys!==null&&uu(Ys)&&(Ys=null),Zs!==null&&uu(Zs)&&(Zs=null),Js!==null&&uu(Js)&&(Js=null),hl.forEach(Bv),fl.forEach(Bv)}function Zc(e,t){e.blockedOn===t&&(e.blockedOn=null,om||(om=!0,je.unstable_scheduleCallback(je.unstable_NormalPriority,RT)))}var Jc=null;function Fv(e){Jc!==e&&(Jc=e,je.unstable_scheduleCallback(je.unstable_NormalPriority,function(){Jc===e&&(Jc=null);for(var t=0;t<e.length;t+=3){var n=e[t],i=e[t+1],s=e[t+2];if(typeof i!="function"){if(ng(i||n)===null)continue;break}var a=kr(n);a!==null&&(e.splice(t,3),t-=3,Hp(a,{pending:!0,data:s,method:n.method,action:i},i,s))}}))}function Hr(e){function t(l){return Zc(l,e)}Ys!==null&&Zc(Ys,e),Zs!==null&&Zc(Zs,e),Js!==null&&Zc(Js,e),hl.forEach(t),fl.forEach(t);for(var n=0;n<Os.length;n++){var i=Os[n];i.blockedOn===e&&(i.blockedOn=null)}for(;0<Os.length&&(n=Os[0],n.blockedOn===null);)TS(n),n.blockedOn===null&&Os.shift();if(n=(e.ownerDocument||e).$$reactFormReplay,n!=null)for(i=0;i<n.length;i+=3){var s=n[i],a=n[i+1],r=s[Nn]||null;if(typeof a=="function")r||Fv(n);else if(r){var o=null;if(a&&a.hasAttribute("formAction")){if(s=a,r=a[Nn]||null)o=r.formAction;else if(ng(s)!==null)continue}else o=r.action;typeof o=="function"?n[i+1]=o:(n.splice(i,3),i-=3),Fv(n)}}}function AS(){function e(a){a.canIntercept&&a.info==="react-transition"&&a.intercept({handler:function(){return new Promise(function(r){return s=r})},focusReset:"manual",scroll:"manual"})}function t(){s!==null&&(s(),s=null),i||setTimeout(n,20)}function n(){if(!i&&!navigation.transition){var a=navigation.currentEntry;a&&a.url!=null&&navigation.navigate(a.url,{state:a.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var i=!1,s=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",t),navigation.addEventListener("navigateerror",t),setTimeout(n,100),function(){i=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",t),navigation.removeEventListener("navigateerror",t),s!==null&&(s(),s=null)}}}function ig(e){this._internalRoot=e}eh.prototype.render=ig.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error($(409));var n=t.current,i=kn();bS(n,i,e,t,null,null)};eh.prototype.unmount=ig.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;bS(e.current,2,null,e,null,null),Qu(),t[Gr]=null}};function eh(e){this._internalRoot=e}eh.prototype.unstable_scheduleHydration=function(e){if(e){var t=ey();e={blockedOn:null,target:e,priority:t};for(var n=0;n<Os.length&&t!==0&&t<Os[n].priority;n++);Os.splice(n,0,e),n===0&&TS(e)}};var Vv=Hv.version;if(Vv!=="19.2.8")throw Error($(527,Vv,"19.2.8"));re.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error($(188)):(e=Object.keys(e).join(","),Error($(268,e)));return e=o1(t),e=e!==null?Wv(e):null,e=e===null?null:e.stateNode,e};var DT={bundleType:0,version:"19.2.8",rendererPackageName:"react-dom",currentDispatcherRef:It,reconcilerVersion:"19.2.8"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"&&(Io=__REACT_DEVTOOLS_GLOBAL_HOOK__,!Io.isDisabled&&Io.supportsFiber))try{pl=Io.inject(DT),Hn=Io}catch{}var Io;nh.createRoot=function(e,t){if(!Gv(e))throw Error($(299));var n=!1,i="",s=_x,a=vx,r=yx;return t!=null&&(t.unstable_strictMode===!0&&(n=!0),t.identifierPrefix!==void 0&&(i=t.identifierPrefix),t.onUncaughtError!==void 0&&(s=t.onUncaughtError),t.onCaughtError!==void 0&&(a=t.onCaughtError),t.onRecoverableError!==void 0&&(r=t.onRecoverableError)),t=xS(e,1,!1,null,null,n,i,null,s,a,r,AS),e[Gr]=t.current,jm(e),new ig(t)};nh.hydrateRoot=function(e,t,n){if(!Gv(e))throw Error($(299));var i=!1,s="",a=_x,r=vx,o=yx,l=null;return n!=null&&(n.unstable_strictMode===!0&&(i=!0),n.identifierPrefix!==void 0&&(s=n.identifierPrefix),n.onUncaughtError!==void 0&&(a=n.onUncaughtError),n.onCaughtError!==void 0&&(r=n.onCaughtError),n.onRecoverableError!==void 0&&(o=n.onRecoverableError),n.formState!==void 0&&(l=n.formState)),t=xS(e,1,!0,t,n??null,i,s,l,a,r,o,AS),t.context=SS(null),n=t.current,i=kn(),i=hm(i),s=ks(i),s.callback=null,Xs(n,s,i),n=i,t.current.lanes=n,gl(t,n),Pi(t),e[Gr]=t.current,jm(e),new eh(t)};nh.version="19.2.8"});var DS=Ri((C3,RS)=>{"use strict";function CS(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(CS)}catch(e){console.error(e)}}CS(),RS.exports=wS()});var yM=Ri(md=>{"use strict";var r3=Symbol.for("react.transitional.element"),o3=Symbol.for("react.fragment");function vM(e,t,n){var i=null;if(n!==void 0&&(i=""+n),t.key!==void 0&&(i=""+t.key),"key"in t){n={};for(var s in t)s!=="key"&&(n[s]=t[s])}else n=t;return t=n.ref,{$$typeof:r3,type:e,key:i,ref:t!==void 0?t:null,props:n}}md.Fragment=o3;md.jsx=vM;md.jsxs=vM});var R0=Ri(($N,xM)=>{"use strict";xM.exports=yM()});var st=Tc(wc()),EM=Tc(DS());var xf="185";var nb=0,Fg=1,ib=2;var ic=1,sb=2,_o=3,bs=0,An=1,Xi=2,Wi=0,Ja=1,Vg=2,Hg=3,Gg=4,ab=5;var la=100,rb=101,ob=102,lb=103,cb=104,ub=200,hb=201,fb=202,db=203,Dh=204,Uh=205,pb=206,mb=207,gb=208,_b=209,vb=210,yb=211,xb=212,Sb=213,bb=214,Nh=0,Lh=1,Ih=2,Ka=3,Oh=4,Ph=5,zh=6,Bh=7,kg=0,Mb=1,Eb=2,Mi=0,Xg=1,Wg=2,qg=3,Yg=4,Zg=5,Jg=6,Kg=7;var jg=300,_a=301,Qa=302,Sf=303,bf=304,sc=306,Fh=1e3,Fi=1001,Vh=1002,rn=1003,Tb=1004;var ac=1005;var dn=1006,Mf=1007;var va=1008;var $n=1009,Qg=1010,$g=1011,vo=1012,Ef=1013,Ei=1014,Ti=1015,qi=1016,Tf=1017,Af=1018,yo=1020,t0=35902,e0=35899,n0=1021,i0=1022,mi=1023,Hi=1026,ya=1027,s0=1028,wf=1029,xa=1030,Cf=1031;var Rf=1033,rc=33776,oc=33777,lc=33778,cc=33779,Df=35840,Uf=35841,Nf=35842,Lf=35843,If=36196,Of=37492,Pf=37496,zf=37488,Bf=37489,uc=37490,Ff=37491,Vf=37808,Hf=37809,Gf=37810,kf=37811,Xf=37812,Wf=37813,qf=37814,Yf=37815,Zf=37816,Jf=37817,Kf=37818,jf=37819,Qf=37820,$f=37821,td=36492,ed=36494,nd=36495,id=36283,sd=36284,hc=36285,ad=36286;var Ll=2300,Hh=2301,Ch=2302,Ug=2303,Ng=2400,Lg=2401,Ig=2402;var Ab=3200;var a0=0,wb=1,Es="",Tn="srgb",Il="srgb-linear",Ol="linear",oe="srgb";var Ya=7680;var Og=519,Cb=512,Rb=513,Db=514,rd=515,Ub=516,Nb=517,od=518,Lb=519,Pg=35044;var r0="300 es",bi=2e3,Pl=2001;function UT(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function NT(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function zl(e){return document.createElementNS("http://www.w3.org/1999/xhtml",e)}function Ib(){let e=zl("canvas");return e.style.display="block",e}var US={},lo=null;function o0(...e){let t="THREE."+e.shift();lo?lo("log",t,...e):console.log(t,...e)}function Ob(e){let t=e[0];if(typeof t=="string"&&t.startsWith("TSL:")){let n=e[1];n&&n.isStackTrace?e[0]+=" "+n.getLocation():e[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return e}function Ut(...e){e=Ob(e);let t="THREE."+e.shift();if(lo)lo("warn",t,...e);else{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function Lt(...e){e=Ob(e);let t="THREE."+e.shift();if(lo)lo("error",t,...e);else{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function Za(...e){let t=e.join(" ");t in US||(US[t]=!0,Ut(...e))}function Pb(e,t,n){return new Promise(function(i,s){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:s();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:i()}}setTimeout(a,n)})}var zb={[Nh]:Lh,[Ih]:zh,[Oh]:Bh,[Ka]:Ph,[Lh]:Nh,[zh]:Ih,[Bh]:Oh,[Ph]:Ka},Gi=class{addEventListener(t,n){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[t]===void 0&&(i[t]=[]),i[t].indexOf(n)===-1&&i[t].push(n)}hasEventListener(t,n){let i=this._listeners;return i===void 0?!1:i[t]!==void 0&&i[t].indexOf(n)!==-1}removeEventListener(t,n){let i=this._listeners;if(i===void 0)return;let s=i[t];if(s!==void 0){let a=s.indexOf(n);a!==-1&&s.splice(a,1)}}dispatchEvent(t){let n=this._listeners;if(n===void 0)return;let i=n[t.type];if(i!==void 0){t.target=this;let s=i.slice(0);for(let a=0,r=s.length;a<r;a++)s[a].call(this,t);t.target=null}}},_n=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var Rh=Math.PI/180,Gh=180/Math.PI;function fc(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(_n[e&255]+_n[e>>8&255]+_n[e>>16&255]+_n[e>>24&255]+"-"+_n[t&255]+_n[t>>8&255]+"-"+_n[t>>16&15|64]+_n[t>>24&255]+"-"+_n[n&63|128]+_n[n>>8&255]+"-"+_n[n>>16&255]+_n[n>>24&255]+_n[i&255]+_n[i>>8&255]+_n[i>>16&255]+_n[i>>24&255]).toLowerCase()}function Jt(e,t,n){return Math.max(t,Math.min(n,e))}function LT(e,t){return(e%t+t)%t}function sg(e,t,n){return(1-n)*e+n*t}function Tl(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function In(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Dt=class e{static{e.prototype.isVector2=!0}constructor(t=0,n=0){this.x=t,this.y=n}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,n){return this.x=t,this.y=n,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let n=this.x,i=this.y,s=t.elements;return this.x=s[0]*n+s[3]*i+s[6],this.y=s[1]*n+s[4]*i+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,n){return this.x=Jt(this.x,t.x,n.x),this.y=Jt(this.y,t.y,n.y),this}clampScalar(t,n){return this.x=Jt(this.x,t,n),this.y=Jt(this.y,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Jt(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let n=Math.sqrt(this.lengthSq()*t.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(t)/n;return Math.acos(Jt(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let n=this.x-t.x,i=this.y-t.y;return n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this}rotateAround(t,n){let i=Math.cos(n),s=Math.sin(n),a=this.x-t.x,r=this.y-t.y;return this.x=a*i-r*s+t.x,this.y=a*s+r*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},ki=class{constructor(t=0,n=0,i=0,s=1){this.isQuaternion=!0,this._x=t,this._y=n,this._z=i,this._w=s}static slerpFlat(t,n,i,s,a,r,o){let l=i[s+0],c=i[s+1],h=i[s+2],p=i[s+3],u=a[r+0],d=a[r+1],_=a[r+2],b=a[r+3];if(p!==b||l!==u||c!==d||h!==_){let g=l*u+c*d+h*_+p*b;g<0&&(u=-u,d=-d,_=-_,b=-b,g=-g);let f=1-o;if(g<.9995){let v=Math.acos(g),S=Math.sin(v);f=Math.sin(f*v)/S,o=Math.sin(o*v)/S,l=l*f+u*o,c=c*f+d*o,h=h*f+_*o,p=p*f+b*o}else{l=l*f+u*o,c=c*f+d*o,h=h*f+_*o,p=p*f+b*o;let v=1/Math.sqrt(l*l+c*c+h*h+p*p);l*=v,c*=v,h*=v,p*=v}}t[n]=l,t[n+1]=c,t[n+2]=h,t[n+3]=p}static multiplyQuaternionsFlat(t,n,i,s,a,r){let o=i[s],l=i[s+1],c=i[s+2],h=i[s+3],p=a[r],u=a[r+1],d=a[r+2],_=a[r+3];return t[n]=o*_+h*p+l*d-c*u,t[n+1]=l*_+h*u+c*p-o*d,t[n+2]=c*_+h*d+o*u-l*p,t[n+3]=h*_-o*p-l*u-c*d,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,n,i,s){return this._x=t,this._y=n,this._z=i,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,n=!0){let i=t._x,s=t._y,a=t._z,r=t._order,o=Math.cos,l=Math.sin,c=o(i/2),h=o(s/2),p=o(a/2),u=l(i/2),d=l(s/2),_=l(a/2);switch(r){case"XYZ":this._x=u*h*p+c*d*_,this._y=c*d*p-u*h*_,this._z=c*h*_+u*d*p,this._w=c*h*p-u*d*_;break;case"YXZ":this._x=u*h*p+c*d*_,this._y=c*d*p-u*h*_,this._z=c*h*_-u*d*p,this._w=c*h*p+u*d*_;break;case"ZXY":this._x=u*h*p-c*d*_,this._y=c*d*p+u*h*_,this._z=c*h*_+u*d*p,this._w=c*h*p-u*d*_;break;case"ZYX":this._x=u*h*p-c*d*_,this._y=c*d*p+u*h*_,this._z=c*h*_-u*d*p,this._w=c*h*p+u*d*_;break;case"YZX":this._x=u*h*p+c*d*_,this._y=c*d*p+u*h*_,this._z=c*h*_-u*d*p,this._w=c*h*p-u*d*_;break;case"XZY":this._x=u*h*p-c*d*_,this._y=c*d*p-u*h*_,this._z=c*h*_+u*d*p,this._w=c*h*p+u*d*_;break;default:Ut("Quaternion: .setFromEuler() encountered an unknown order: "+r)}return n===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,n){let i=n/2,s=Math.sin(i);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(t){let n=t.elements,i=n[0],s=n[4],a=n[8],r=n[1],o=n[5],l=n[9],c=n[2],h=n[6],p=n[10],u=i+o+p;if(u>0){let d=.5/Math.sqrt(u+1);this._w=.25/d,this._x=(h-l)*d,this._y=(a-c)*d,this._z=(r-s)*d}else if(i>o&&i>p){let d=2*Math.sqrt(1+i-o-p);this._w=(h-l)/d,this._x=.25*d,this._y=(s+r)/d,this._z=(a+c)/d}else if(o>p){let d=2*Math.sqrt(1+o-i-p);this._w=(a-c)/d,this._x=(s+r)/d,this._y=.25*d,this._z=(l+h)/d}else{let d=2*Math.sqrt(1+p-i-o);this._w=(r-s)/d,this._x=(a+c)/d,this._y=(l+h)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(t,n){let i=t.dot(n)+1;return i<1e-8?(i=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=i):(this._x=0,this._y=-t.z,this._z=t.y,this._w=i)):(this._x=t.y*n.z-t.z*n.y,this._y=t.z*n.x-t.x*n.z,this._z=t.x*n.y-t.y*n.x,this._w=i),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Jt(this.dot(t),-1,1)))}rotateTowards(t,n){let i=this.angleTo(t);if(i===0)return this;let s=Math.min(1,n/i);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,n){let i=t._x,s=t._y,a=t._z,r=t._w,o=n._x,l=n._y,c=n._z,h=n._w;return this._x=i*h+r*o+s*c-a*l,this._y=s*h+r*l+a*o-i*c,this._z=a*h+r*c+i*l-s*o,this._w=r*h-i*o-s*l-a*c,this._onChangeCallback(),this}slerp(t,n){let i=t._x,s=t._y,a=t._z,r=t._w,o=this.dot(t);o<0&&(i=-i,s=-s,a=-a,r=-r,o=-o);let l=1-n;if(o<.9995){let c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,n=Math.sin(n*c)/h,this._x=this._x*l+i*n,this._y=this._y*l+s*n,this._z=this._z*l+a*n,this._w=this._w*l+r*n,this._onChangeCallback()}else this._x=this._x*l+i*n,this._y=this._y*l+s*n,this._z=this._z*l+a*n,this._w=this._w*l+r*n,this.normalize();return this}slerpQuaternions(t,n,i){return this.copy(t).slerp(n,i)}random(){let t=2*Math.PI*Math.random(),n=2*Math.PI*Math.random(),i=Math.random(),s=Math.sqrt(1-i),a=Math.sqrt(i);return this.set(s*Math.sin(t),s*Math.cos(t),a*Math.sin(n),a*Math.cos(n))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,n=0){return this._x=t[n],this._y=t[n+1],this._z=t[n+2],this._w=t[n+3],this._onChangeCallback(),this}toArray(t=[],n=0){return t[n]=this._x,t[n+1]=this._y,t[n+2]=this._z,t[n+3]=this._w,t}fromBufferAttribute(t,n){return this._x=t.getX(n),this._y=t.getY(n),this._z=t.getZ(n),this._w=t.getW(n),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},N=class e{static{e.prototype.isVector3=!0}constructor(t=0,n=0,i=0){this.x=t,this.y=n,this.z=i}set(t,n,i){return i===void 0&&(i=this.z),this.x=t,this.y=n,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this.z=t.z+n.z,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this.z+=t.z*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this.z=t.z-n.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,n){return this.x=t.x*n.x,this.y=t.y*n.y,this.z=t.z*n.z,this}applyEuler(t){return this.applyQuaternion(NS.setFromEuler(t))}applyAxisAngle(t,n){return this.applyQuaternion(NS.setFromAxisAngle(t,n))}applyMatrix3(t){let n=this.x,i=this.y,s=this.z,a=t.elements;return this.x=a[0]*n+a[3]*i+a[6]*s,this.y=a[1]*n+a[4]*i+a[7]*s,this.z=a[2]*n+a[5]*i+a[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let n=this.x,i=this.y,s=this.z,a=t.elements,r=1/(a[3]*n+a[7]*i+a[11]*s+a[15]);return this.x=(a[0]*n+a[4]*i+a[8]*s+a[12])*r,this.y=(a[1]*n+a[5]*i+a[9]*s+a[13])*r,this.z=(a[2]*n+a[6]*i+a[10]*s+a[14])*r,this}applyQuaternion(t){let n=this.x,i=this.y,s=this.z,a=t.x,r=t.y,o=t.z,l=t.w,c=2*(r*s-o*i),h=2*(o*n-a*s),p=2*(a*i-r*n);return this.x=n+l*c+r*p-o*h,this.y=i+l*h+o*c-a*p,this.z=s+l*p+a*h-r*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let n=this.x,i=this.y,s=this.z,a=t.elements;return this.x=a[0]*n+a[4]*i+a[8]*s,this.y=a[1]*n+a[5]*i+a[9]*s,this.z=a[2]*n+a[6]*i+a[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,n){return this.x=Jt(this.x,t.x,n.x),this.y=Jt(this.y,t.y,n.y),this.z=Jt(this.z,t.z,n.z),this}clampScalar(t,n){return this.x=Jt(this.x,t,n),this.y=Jt(this.y,t,n),this.z=Jt(this.z,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Jt(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this.z+=(t.z-this.z)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this.z=t.z+(n.z-t.z)*i,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,n){let i=t.x,s=t.y,a=t.z,r=n.x,o=n.y,l=n.z;return this.x=s*l-a*o,this.y=a*r-i*l,this.z=i*o-s*r,this}projectOnVector(t){let n=t.lengthSq();if(n===0)return this.set(0,0,0);let i=t.dot(this)/n;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return ag.copy(this).projectOnVector(t),this.sub(ag)}reflect(t){return this.sub(ag.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let n=Math.sqrt(this.lengthSq()*t.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(t)/n;return Math.acos(Jt(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let n=this.x-t.x,i=this.y-t.y,s=this.z-t.z;return n*n+i*i+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,n,i){let s=Math.sin(n)*t;return this.x=s*Math.sin(i),this.y=Math.cos(n)*t,this.z=s*Math.cos(i),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,n,i){return this.x=t*Math.sin(n),this.y=i,this.z=t*Math.cos(n),this}setFromMatrixPosition(t){let n=t.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this}setFromMatrixScale(t){let n=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=n,this.y=i,this.z=s,this}setFromMatrixColumn(t,n){return this.fromArray(t.elements,n*4)}setFromMatrix3Column(t,n){return this.fromArray(t.elements,n*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this.z=t[n+2],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t[n+2]=this.z,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this.z=t.getZ(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,n=Math.random()*2-1,i=Math.sqrt(1-n*n);return this.x=i*Math.cos(t),this.y=n,this.z=i*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},ag=new N,NS=new ki,Pt=class e{static{e.prototype.isMatrix3=!0}constructor(t,n,i,s,a,r,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,n,i,s,a,r,o,l,c)}set(t,n,i,s,a,r,o,l,c){let h=this.elements;return h[0]=t,h[1]=s,h[2]=o,h[3]=n,h[4]=a,h[5]=l,h[6]=i,h[7]=r,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let n=this.elements,i=t.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],this}extractBasis(t,n,i){return t.setFromMatrix3Column(this,0),n.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let n=t.elements;return this.set(n[0],n[4],n[8],n[1],n[5],n[9],n[2],n[6],n[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,n){let i=t.elements,s=n.elements,a=this.elements,r=i[0],o=i[3],l=i[6],c=i[1],h=i[4],p=i[7],u=i[2],d=i[5],_=i[8],b=s[0],g=s[3],f=s[6],v=s[1],S=s[4],y=s[7],E=s[2],A=s[5],w=s[8];return a[0]=r*b+o*v+l*E,a[3]=r*g+o*S+l*A,a[6]=r*f+o*y+l*w,a[1]=c*b+h*v+p*E,a[4]=c*g+h*S+p*A,a[7]=c*f+h*y+p*w,a[2]=u*b+d*v+_*E,a[5]=u*g+d*S+_*A,a[8]=u*f+d*y+_*w,this}multiplyScalar(t){let n=this.elements;return n[0]*=t,n[3]*=t,n[6]*=t,n[1]*=t,n[4]*=t,n[7]*=t,n[2]*=t,n[5]*=t,n[8]*=t,this}determinant(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return n*r*h-n*o*c-i*a*h+i*o*l+s*a*c-s*r*l}invert(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],l=t[6],c=t[7],h=t[8],p=h*r-o*c,u=o*l-h*a,d=c*a-r*l,_=n*p+i*u+s*d;if(_===0)return this.set(0,0,0,0,0,0,0,0,0);let b=1/_;return t[0]=p*b,t[1]=(s*c-h*i)*b,t[2]=(o*i-s*r)*b,t[3]=u*b,t[4]=(h*n-s*l)*b,t[5]=(s*a-o*n)*b,t[6]=d*b,t[7]=(i*l-c*n)*b,t[8]=(r*n-i*a)*b,this}transpose(){let t,n=this.elements;return t=n[1],n[1]=n[3],n[3]=t,t=n[2],n[2]=n[6],n[6]=t,t=n[5],n[5]=n[7],n[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let n=this.elements;return t[0]=n[0],t[1]=n[3],t[2]=n[6],t[3]=n[1],t[4]=n[4],t[5]=n[7],t[6]=n[2],t[7]=n[5],t[8]=n[8],this}setUvTransform(t,n,i,s,a,r,o){let l=Math.cos(a),c=Math.sin(a);return this.set(i*l,i*c,-i*(l*r+c*o)+r+t,-s*c,s*l,-s*(-c*r+l*o)+o+n,0,0,1),this}scale(t,n){return Za("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(rg.makeScale(t,n)),this}rotate(t){return Za("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(rg.makeRotation(-t)),this}translate(t,n){return Za("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(rg.makeTranslation(t,n)),this}makeTranslation(t,n){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,n,0,0,1),this}makeRotation(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,-i,0,i,n,0,0,0,1),this}makeScale(t,n){return this.set(t,0,0,0,n,0,0,0,1),this}equals(t){let n=this.elements,i=t.elements;for(let s=0;s<9;s++)if(n[s]!==i[s])return!1;return!0}fromArray(t,n=0){for(let i=0;i<9;i++)this.elements[i]=t[i+n];return this}toArray(t=[],n=0){let i=this.elements;return t[n]=i[0],t[n+1]=i[1],t[n+2]=i[2],t[n+3]=i[3],t[n+4]=i[4],t[n+5]=i[5],t[n+6]=i[6],t[n+7]=i[7],t[n+8]=i[8],t}clone(){return new this.constructor().fromArray(this.elements)}},rg=new Pt,LS=new Pt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),IS=new Pt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function IT(){let e={enabled:!0,workingColorSpace:Il,spaces:{},convert:function(s,a,r){return this.enabled===!1||a===r||!a||!r||(this.spaces[a].transfer===oe&&(s.r=Ss(s.r),s.g=Ss(s.g),s.b=Ss(s.b)),this.spaces[a].primaries!==this.spaces[r].primaries&&(s.applyMatrix3(this.spaces[a].toXYZ),s.applyMatrix3(this.spaces[r].fromXYZ)),this.spaces[r].transfer===oe&&(s.r=oo(s.r),s.g=oo(s.g),s.b=oo(s.b))),s},workingToColorSpace:function(s,a){return this.convert(s,this.workingColorSpace,a)},colorSpaceToWorking:function(s,a){return this.convert(s,a,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Es?Ol:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,a=this.workingColorSpace){return s.fromArray(this.spaces[a].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,a,r){return s.copy(this.spaces[a].toXYZ).multiply(this.spaces[r].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,a){return Za("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),e.workingToColorSpace(s,a)},toWorkingColorSpace:function(s,a){return Za("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),e.colorSpaceToWorking(s,a)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],i=[.3127,.329];return e.define({[Il]:{primaries:t,whitePoint:i,transfer:Ol,toXYZ:LS,fromXYZ:IS,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:Tn},outputColorSpaceConfig:{drawingBufferColorSpace:Tn}},[Tn]:{primaries:t,whitePoint:i,transfer:oe,toXYZ:LS,fromXYZ:IS,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:Tn}}}),e}var $t=IT();function Ss(e){return e<.04045?e*.0773993808:Math.pow(e*.9478672986+.0521327014,2.4)}function oo(e){return e<.0031308?e*12.92:1.055*Math.pow(e,.41666)-.055}var Jr,kh=class{static getDataURL(t,n="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let i;if(t instanceof HTMLCanvasElement)i=t;else{Jr===void 0&&(Jr=zl("canvas")),Jr.width=t.width,Jr.height=t.height;let s=Jr.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),i=Jr}return i.toDataURL(n)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let n=zl("canvas");n.width=t.width,n.height=t.height;let i=n.getContext("2d");i.drawImage(t,0,0,t.width,t.height);let s=i.getImageData(0,0,t.width,t.height),a=s.data;for(let r=0;r<a.length;r++)a[r]=Ss(a[r]/255)*255;return i.putImageData(s,0,0),n}else if(t.data){let n=t.data.slice(0);for(let i=0;i<n.length;i++)n instanceof Uint8Array||n instanceof Uint8ClampedArray?n[i]=Math.floor(Ss(n[i]/255)*255):n[i]=Ss(n[i]);return{data:n,width:t.width,height:t.height}}else return Ut("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},OT=0,co=class{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:OT++}),this.uuid=fc(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let n=this.data;return typeof HTMLVideoElement<"u"&&n instanceof HTMLVideoElement?t.set(n.videoWidth,n.videoHeight,0):typeof VideoFrame<"u"&&n instanceof VideoFrame?t.set(n.displayWidth,n.displayHeight,0):n!==null?t.set(n.width,n.height,n.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let n=t===void 0||typeof t=="string";if(!n&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let i={uuid:this.uuid,url:""},s=this.data;if(s!==null){let a;if(Array.isArray(s)){a=[];for(let r=0,o=s.length;r<o;r++)s[r].isDataTexture?a.push(og(s[r].image)):a.push(og(s[r]))}else a=og(s);i.url=a}return n||(t.images[this.uuid]=i),i}};function og(e){return typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap?kh.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(Ut("Texture: Unable to serialize Texture."),{})}var PT=0,lg=new N,xn=class e extends Gi{constructor(t=e.DEFAULT_IMAGE,n=e.DEFAULT_MAPPING,i=Fi,s=Fi,a=dn,r=va,o=mi,l=$n,c=e.DEFAULT_ANISOTROPY,h=Es){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:PT++}),this.uuid=fc(),this.name="",this.source=new co(t),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=i,this.wrapT=s,this.magFilter=a,this.minFilter=r,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Dt(0,0),this.repeat=new Dt(1,1),this.center=new Dt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Pt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(lg).x}get height(){return this.source.getSize(lg).y}get depth(){return this.source.getSize(lg).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,n){this.updateRanges.push({start:t,count:n})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let n in t){let i=t[n];if(i===void 0){Ut(`Texture.setValues(): parameter '${n}' has value of undefined.`);continue}let s=this[n];if(s===void 0){Ut(`Texture.setValues(): property '${n}' does not exist.`);continue}s&&i&&s.isVector2&&i.isVector2||s&&i&&s.isVector3&&i.isVector3||s&&i&&s.isMatrix3&&i.isMatrix3?s.copy(i):this[n]=i}}toJSON(t){let n=t===void 0||typeof t=="string";if(!n&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),n||(t.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==jg)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Fh:t.x=t.x-Math.floor(t.x);break;case Fi:t.x=t.x<0?0:1;break;case Vh:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Fh:t.y=t.y-Math.floor(t.y);break;case Fi:t.y=t.y<0?0:1;break;case Vh:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};xn.DEFAULT_IMAGE=null;xn.DEFAULT_MAPPING=jg;xn.DEFAULT_ANISOTROPY=1;var Ue=class e{static{e.prototype.isVector4=!0}constructor(t=0,n=0,i=0,s=1){this.x=t,this.y=n,this.z=i,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,n,i,s){return this.x=t,this.y=n,this.z=i,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;case 3:this.w=n;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this.z=t.z+n.z,this.w=t.w+n.w,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this.z+=t.z*n,this.w+=t.w*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this.z=t.z-n.z,this.w=t.w-n.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let n=this.x,i=this.y,s=this.z,a=this.w,r=t.elements;return this.x=r[0]*n+r[4]*i+r[8]*s+r[12]*a,this.y=r[1]*n+r[5]*i+r[9]*s+r[13]*a,this.z=r[2]*n+r[6]*i+r[10]*s+r[14]*a,this.w=r[3]*n+r[7]*i+r[11]*s+r[15]*a,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let n=Math.sqrt(1-t.w*t.w);return n<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/n,this.y=t.y/n,this.z=t.z/n),this}setAxisAngleFromRotationMatrix(t){let n,i,s,a,l=t.elements,c=l[0],h=l[4],p=l[8],u=l[1],d=l[5],_=l[9],b=l[2],g=l[6],f=l[10];if(Math.abs(h-u)<.01&&Math.abs(p-b)<.01&&Math.abs(_-g)<.01){if(Math.abs(h+u)<.1&&Math.abs(p+b)<.1&&Math.abs(_+g)<.1&&Math.abs(c+d+f-3)<.1)return this.set(1,0,0,0),this;n=Math.PI;let S=(c+1)/2,y=(d+1)/2,E=(f+1)/2,A=(h+u)/4,w=(p+b)/4,x=(_+g)/4;return S>y&&S>E?S<.01?(i=0,s=.707106781,a=.707106781):(i=Math.sqrt(S),s=A/i,a=w/i):y>E?y<.01?(i=.707106781,s=0,a=.707106781):(s=Math.sqrt(y),i=A/s,a=x/s):E<.01?(i=.707106781,s=.707106781,a=0):(a=Math.sqrt(E),i=w/a,s=x/a),this.set(i,s,a,n),this}let v=Math.sqrt((g-_)*(g-_)+(p-b)*(p-b)+(u-h)*(u-h));return Math.abs(v)<.001&&(v=1),this.x=(g-_)/v,this.y=(p-b)/v,this.z=(u-h)/v,this.w=Math.acos((c+d+f-1)/2),this}setFromMatrixPosition(t){let n=t.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this.w=n[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,n){return this.x=Jt(this.x,t.x,n.x),this.y=Jt(this.y,t.y,n.y),this.z=Jt(this.z,t.z,n.z),this.w=Jt(this.w,t.w,n.w),this}clampScalar(t,n){return this.x=Jt(this.x,t,n),this.y=Jt(this.y,t,n),this.z=Jt(this.z,t,n),this.w=Jt(this.w,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Jt(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this.z+=(t.z-this.z)*n,this.w+=(t.w-this.w)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this.z=t.z+(n.z-t.z)*i,this.w=t.w+(n.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this.z=t[n+2],this.w=t[n+3],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t[n+2]=this.z,t[n+3]=this.w,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this.z=t.getZ(n),this.w=t.getW(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Xh=class extends Gi{constructor(t=1,n=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:dn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=t,this.height=n,this.depth=i.depth,this.scissor=new Ue(0,0,t,n),this.scissorTest=!1,this.viewport=new Ue(0,0,t,n),this.textures=[];let s={width:t,height:n,depth:i.depth},a=new xn(s),r=i.count;for(let o=0;o<r;o++)this.textures[o]=a.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(t={}){let n={minFilter:dn,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(n.mapping=t.mapping),t.wrapS!==void 0&&(n.wrapS=t.wrapS),t.wrapT!==void 0&&(n.wrapT=t.wrapT),t.wrapR!==void 0&&(n.wrapR=t.wrapR),t.magFilter!==void 0&&(n.magFilter=t.magFilter),t.minFilter!==void 0&&(n.minFilter=t.minFilter),t.format!==void 0&&(n.format=t.format),t.type!==void 0&&(n.type=t.type),t.anisotropy!==void 0&&(n.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(n.colorSpace=t.colorSpace),t.flipY!==void 0&&(n.flipY=t.flipY),t.generateMipmaps!==void 0&&(n.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(n.internalFormat=t.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(n)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),t!==null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,n,i=1){if(this.width!==t||this.height!==n||this.depth!==i){this.width=t,this.height=n,this.depth=i;for(let s=0,a=this.textures.length;s<a;s++)this.textures[s].image.width=t,this.textures[s].image.height=n,this.textures[s].image.depth=i,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,n),this.scissor.set(0,0,t,n)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,i=t.textures.length;n<i;n++){this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0,this.textures[n].renderTarget=this;let s=Object.assign({},t.textures[n].image);this.textures[n].source=new co(s)}return this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},Jn=class extends Xh{constructor(t=1,n=1,i={}){super(t,n,i),this.isWebGLRenderTarget=!0}},Bl=class extends xn{constructor(t=null,n=1,i=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:n,height:i,depth:s},this.magFilter=rn,this.minFilter=rn,this.wrapR=Fi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var Wh=class extends xn{constructor(t=null,n=1,i=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:n,height:i,depth:s},this.magFilter=rn,this.minFilter=rn,this.wrapR=Fi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var De=class e{static{e.prototype.isMatrix4=!0}constructor(t,n,i,s,a,r,o,l,c,h,p,u,d,_,b,g){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,n,i,s,a,r,o,l,c,h,p,u,d,_,b,g)}set(t,n,i,s,a,r,o,l,c,h,p,u,d,_,b,g){let f=this.elements;return f[0]=t,f[4]=n,f[8]=i,f[12]=s,f[1]=a,f[5]=r,f[9]=o,f[13]=l,f[2]=c,f[6]=h,f[10]=p,f[14]=u,f[3]=d,f[7]=_,f[11]=b,f[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(t){let n=this.elements,i=t.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],n[9]=i[9],n[10]=i[10],n[11]=i[11],n[12]=i[12],n[13]=i[13],n[14]=i[14],n[15]=i[15],this}copyPosition(t){let n=this.elements,i=t.elements;return n[12]=i[12],n[13]=i[13],n[14]=i[14],this}setFromMatrix3(t){let n=t.elements;return this.set(n[0],n[3],n[6],0,n[1],n[4],n[7],0,n[2],n[5],n[8],0,0,0,0,1),this}extractBasis(t,n,i){return this.determinantAffine()===0?(t.set(1,0,0),n.set(0,1,0),i.set(0,0,1),this):(t.setFromMatrixColumn(this,0),n.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(t,n,i){return this.set(t.x,n.x,i.x,0,t.y,n.y,i.y,0,t.z,n.z,i.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let n=this.elements,i=t.elements,s=1/Kr.setFromMatrixColumn(t,0).length(),a=1/Kr.setFromMatrixColumn(t,1).length(),r=1/Kr.setFromMatrixColumn(t,2).length();return n[0]=i[0]*s,n[1]=i[1]*s,n[2]=i[2]*s,n[3]=0,n[4]=i[4]*a,n[5]=i[5]*a,n[6]=i[6]*a,n[7]=0,n[8]=i[8]*r,n[9]=i[9]*r,n[10]=i[10]*r,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromEuler(t){let n=this.elements,i=t.x,s=t.y,a=t.z,r=Math.cos(i),o=Math.sin(i),l=Math.cos(s),c=Math.sin(s),h=Math.cos(a),p=Math.sin(a);if(t.order==="XYZ"){let u=r*h,d=r*p,_=o*h,b=o*p;n[0]=l*h,n[4]=-l*p,n[8]=c,n[1]=d+_*c,n[5]=u-b*c,n[9]=-o*l,n[2]=b-u*c,n[6]=_+d*c,n[10]=r*l}else if(t.order==="YXZ"){let u=l*h,d=l*p,_=c*h,b=c*p;n[0]=u+b*o,n[4]=_*o-d,n[8]=r*c,n[1]=r*p,n[5]=r*h,n[9]=-o,n[2]=d*o-_,n[6]=b+u*o,n[10]=r*l}else if(t.order==="ZXY"){let u=l*h,d=l*p,_=c*h,b=c*p;n[0]=u-b*o,n[4]=-r*p,n[8]=_+d*o,n[1]=d+_*o,n[5]=r*h,n[9]=b-u*o,n[2]=-r*c,n[6]=o,n[10]=r*l}else if(t.order==="ZYX"){let u=r*h,d=r*p,_=o*h,b=o*p;n[0]=l*h,n[4]=_*c-d,n[8]=u*c+b,n[1]=l*p,n[5]=b*c+u,n[9]=d*c-_,n[2]=-c,n[6]=o*l,n[10]=r*l}else if(t.order==="YZX"){let u=r*l,d=r*c,_=o*l,b=o*c;n[0]=l*h,n[4]=b-u*p,n[8]=_*p+d,n[1]=p,n[5]=r*h,n[9]=-o*h,n[2]=-c*h,n[6]=d*p+_,n[10]=u-b*p}else if(t.order==="XZY"){let u=r*l,d=r*c,_=o*l,b=o*c;n[0]=l*h,n[4]=-p,n[8]=c*h,n[1]=u*p+b,n[5]=r*h,n[9]=d*p-_,n[2]=_*p-d,n[6]=o*h,n[10]=b*p+u}return n[3]=0,n[7]=0,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromQuaternion(t){return this.compose(zT,t,BT)}lookAt(t,n,i){let s=this.elements;return qn.subVectors(t,n),qn.lengthSq()===0&&(qn.z=1),qn.normalize(),na.crossVectors(i,qn),na.lengthSq()===0&&(Math.abs(i.z)===1?qn.x+=1e-4:qn.z+=1e-4,qn.normalize(),na.crossVectors(i,qn)),na.normalize(),ih.crossVectors(qn,na),s[0]=na.x,s[4]=ih.x,s[8]=qn.x,s[1]=na.y,s[5]=ih.y,s[9]=qn.y,s[2]=na.z,s[6]=ih.z,s[10]=qn.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,n){let i=t.elements,s=n.elements,a=this.elements,r=i[0],o=i[4],l=i[8],c=i[12],h=i[1],p=i[5],u=i[9],d=i[13],_=i[2],b=i[6],g=i[10],f=i[14],v=i[3],S=i[7],y=i[11],E=i[15],A=s[0],w=s[4],x=s[8],T=s[12],R=s[1],D=s[5],L=s[9],k=s[13],X=s[2],z=s[6],G=s[10],W=s[14],Q=s[3],et=s[7],at=s[11],ot=s[15];return a[0]=r*A+o*R+l*X+c*Q,a[4]=r*w+o*D+l*z+c*et,a[8]=r*x+o*L+l*G+c*at,a[12]=r*T+o*k+l*W+c*ot,a[1]=h*A+p*R+u*X+d*Q,a[5]=h*w+p*D+u*z+d*et,a[9]=h*x+p*L+u*G+d*at,a[13]=h*T+p*k+u*W+d*ot,a[2]=_*A+b*R+g*X+f*Q,a[6]=_*w+b*D+g*z+f*et,a[10]=_*x+b*L+g*G+f*at,a[14]=_*T+b*k+g*W+f*ot,a[3]=v*A+S*R+y*X+E*Q,a[7]=v*w+S*D+y*z+E*et,a[11]=v*x+S*L+y*G+E*at,a[15]=v*T+S*k+y*W+E*ot,this}multiplyScalar(t){let n=this.elements;return n[0]*=t,n[4]*=t,n[8]*=t,n[12]*=t,n[1]*=t,n[5]*=t,n[9]*=t,n[13]*=t,n[2]*=t,n[6]*=t,n[10]*=t,n[14]*=t,n[3]*=t,n[7]*=t,n[11]*=t,n[15]*=t,this}determinant(){let t=this.elements,n=t[0],i=t[4],s=t[8],a=t[12],r=t[1],o=t[5],l=t[9],c=t[13],h=t[2],p=t[6],u=t[10],d=t[14],_=t[3],b=t[7],g=t[11],f=t[15],v=l*d-c*u,S=o*d-c*p,y=o*u-l*p,E=r*d-c*h,A=r*u-l*h,w=r*p-o*h;return n*(b*v-g*S+f*y)-i*(_*v-g*E+f*A)+s*(_*S-b*E+f*w)-a*(_*y-b*A+g*w)}determinantAffine(){let t=this.elements,n=t[0],i=t[4],s=t[8],a=t[1],r=t[5],o=t[9],l=t[2],c=t[6],h=t[10];return n*(r*h-o*c)-i*(a*h-o*l)+s*(a*c-r*l)}transpose(){let t=this.elements,n;return n=t[1],t[1]=t[4],t[4]=n,n=t[2],t[2]=t[8],t[8]=n,n=t[6],t[6]=t[9],t[9]=n,n=t[3],t[3]=t[12],t[12]=n,n=t[7],t[7]=t[13],t[13]=n,n=t[11],t[11]=t[14],t[14]=n,this}setPosition(t,n,i){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=n,s[14]=i),this}invert(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],l=t[6],c=t[7],h=t[8],p=t[9],u=t[10],d=t[11],_=t[12],b=t[13],g=t[14],f=t[15],v=n*o-i*r,S=n*l-s*r,y=n*c-a*r,E=i*l-s*o,A=i*c-a*o,w=s*c-a*l,x=h*b-p*_,T=h*g-u*_,R=h*f-d*_,D=p*g-u*b,L=p*f-d*b,k=u*f-d*g,X=v*k-S*L+y*D+E*R-A*T+w*x;if(X===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let z=1/X;return t[0]=(o*k-l*L+c*D)*z,t[1]=(s*L-i*k-a*D)*z,t[2]=(b*w-g*A+f*E)*z,t[3]=(u*A-p*w-d*E)*z,t[4]=(l*R-r*k-c*T)*z,t[5]=(n*k-s*R+a*T)*z,t[6]=(g*y-_*w-f*S)*z,t[7]=(h*w-u*y+d*S)*z,t[8]=(r*L-o*R+c*x)*z,t[9]=(i*R-n*L-a*x)*z,t[10]=(_*A-b*y+f*v)*z,t[11]=(p*y-h*A-d*v)*z,t[12]=(o*T-r*D-l*x)*z,t[13]=(n*D-i*T+s*x)*z,t[14]=(b*S-_*E-g*v)*z,t[15]=(h*E-p*S+u*v)*z,this}scale(t){let n=this.elements,i=t.x,s=t.y,a=t.z;return n[0]*=i,n[4]*=s,n[8]*=a,n[1]*=i,n[5]*=s,n[9]*=a,n[2]*=i,n[6]*=s,n[10]*=a,n[3]*=i,n[7]*=s,n[11]*=a,this}getMaxScaleOnAxis(){let t=this.elements,n=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(n,i,s))}makeTranslation(t,n,i){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,n,0,0,1,i,0,0,0,1),this}makeRotationX(t){let n=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,n,-i,0,0,i,n,0,0,0,0,1),this}makeRotationY(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,0,i,0,0,1,0,0,-i,0,n,0,0,0,0,1),this}makeRotationZ(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,-i,0,0,i,n,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,n){let i=Math.cos(n),s=Math.sin(n),a=1-i,r=t.x,o=t.y,l=t.z,c=a*r,h=a*o;return this.set(c*r+i,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+i,h*l-s*r,0,c*l-s*o,h*l+s*r,a*l*l+i,0,0,0,0,1),this}makeScale(t,n,i){return this.set(t,0,0,0,0,n,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,n,i,s,a,r){return this.set(1,i,a,0,t,1,r,0,n,s,1,0,0,0,0,1),this}compose(t,n,i){let s=this.elements,a=n._x,r=n._y,o=n._z,l=n._w,c=a+a,h=r+r,p=o+o,u=a*c,d=a*h,_=a*p,b=r*h,g=r*p,f=o*p,v=l*c,S=l*h,y=l*p,E=i.x,A=i.y,w=i.z;return s[0]=(1-(b+f))*E,s[1]=(d+y)*E,s[2]=(_-S)*E,s[3]=0,s[4]=(d-y)*A,s[5]=(1-(u+f))*A,s[6]=(g+v)*A,s[7]=0,s[8]=(_+S)*w,s[9]=(g-v)*w,s[10]=(1-(u+b))*w,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,n,i){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let a=this.determinantAffine();if(a===0)return i.set(1,1,1),n.identity(),this;let r=Kr.set(s[0],s[1],s[2]).length(),o=Kr.set(s[4],s[5],s[6]).length(),l=Kr.set(s[8],s[9],s[10]).length();a<0&&(r=-r),yi.copy(this);let c=1/r,h=1/o,p=1/l;return yi.elements[0]*=c,yi.elements[1]*=c,yi.elements[2]*=c,yi.elements[4]*=h,yi.elements[5]*=h,yi.elements[6]*=h,yi.elements[8]*=p,yi.elements[9]*=p,yi.elements[10]*=p,n.setFromRotationMatrix(yi),i.x=r,i.y=o,i.z=l,this}makePerspective(t,n,i,s,a,r,o=bi,l=!1){let c=this.elements,h=2*a/(n-t),p=2*a/(i-s),u=(n+t)/(n-t),d=(i+s)/(i-s),_,b;if(l)_=a/(r-a),b=r*a/(r-a);else if(o===bi)_=-(r+a)/(r-a),b=-2*r*a/(r-a);else if(o===Pl)_=-r/(r-a),b=-r*a/(r-a);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=p,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=_,c[14]=b,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,n,i,s,a,r,o=bi,l=!1){let c=this.elements,h=2/(n-t),p=2/(i-s),u=-(n+t)/(n-t),d=-(i+s)/(i-s),_,b;if(l)_=1/(r-a),b=r/(r-a);else if(o===bi)_=-2/(r-a),b=-(r+a)/(r-a);else if(o===Pl)_=-1/(r-a),b=-a/(r-a);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=p,c[9]=0,c[13]=d,c[2]=0,c[6]=0,c[10]=_,c[14]=b,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){let n=this.elements,i=t.elements;for(let s=0;s<16;s++)if(n[s]!==i[s])return!1;return!0}fromArray(t,n=0){for(let i=0;i<16;i++)this.elements[i]=t[i+n];return this}toArray(t=[],n=0){let i=this.elements;return t[n]=i[0],t[n+1]=i[1],t[n+2]=i[2],t[n+3]=i[3],t[n+4]=i[4],t[n+5]=i[5],t[n+6]=i[6],t[n+7]=i[7],t[n+8]=i[8],t[n+9]=i[9],t[n+10]=i[10],t[n+11]=i[11],t[n+12]=i[12],t[n+13]=i[13],t[n+14]=i[14],t[n+15]=i[15],t}},Kr=new N,yi=new De,zT=new N(0,0,0),BT=new N(1,1,1),na=new N,ih=new N,qn=new N,OS=new De,PS=new ki,ca=class e{constructor(t=0,n=0,i=0,s=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=i,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,n,i,s=this._order){return this._x=t,this._y=n,this._z=i,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,n=this._order,i=!0){let s=t.elements,a=s[0],r=s[4],o=s[8],l=s[1],c=s[5],h=s[9],p=s[2],u=s[6],d=s[10];switch(n){case"XYZ":this._y=Math.asin(Jt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,d),this._z=Math.atan2(-r,a)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Jt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,d),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-p,a),this._z=0);break;case"ZXY":this._x=Math.asin(Jt(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-p,d),this._z=Math.atan2(-r,c)):(this._y=0,this._z=Math.atan2(l,a));break;case"ZYX":this._y=Math.asin(-Jt(p,-1,1)),Math.abs(p)<.9999999?(this._x=Math.atan2(u,d),this._z=Math.atan2(l,a)):(this._x=0,this._z=Math.atan2(-r,c));break;case"YZX":this._z=Math.asin(Jt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-p,a)):(this._x=0,this._y=Math.atan2(o,d));break;case"XZY":this._z=Math.asin(-Jt(r,-1,1)),Math.abs(r)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(o,a)):(this._x=Math.atan2(-h,d),this._y=0);break;default:Ut("Euler: .setFromRotationMatrix() encountered an unknown order: "+n)}return this._order=n,i===!0&&this._onChangeCallback(),this}setFromQuaternion(t,n,i){return OS.makeRotationFromQuaternion(t),this.setFromRotationMatrix(OS,n,i)}setFromVector3(t,n=this._order){return this.set(t.x,t.y,t.z,n)}reorder(t){return PS.setFromEuler(this),this.setFromQuaternion(PS,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],n=0){return t[n]=this._x,t[n+1]=this._y,t[n+2]=this._z,t[n+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};ca.DEFAULT_ORDER="XYZ";var Fl=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},FT=0,zS=new N,jr=new ki,ms=new De,sh=new N,Al=new N,VT=new N,HT=new ki,BS=new N(1,0,0),FS=new N(0,1,0),VS=new N(0,0,1),HS={type:"added"},GT={type:"removed"},Qr={type:"childadded",child:null},cg={type:"childremoved",child:null},Kn=class e extends Gi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:FT++}),this.uuid=fc(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new N,n=new ca,i=new ki,s=new N(1,1,1);function a(){i.setFromEuler(n,!1)}function r(){n.setFromQuaternion(i,void 0,!1)}n._onChange(a),i._onChange(r),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new De},normalMatrix:{value:new Pt}}),this.matrix=new De,this.matrixWorld=new De,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Fl,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,n){this.quaternion.setFromAxisAngle(t,n)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,n){return jr.setFromAxisAngle(t,n),this.quaternion.multiply(jr),this}rotateOnWorldAxis(t,n){return jr.setFromAxisAngle(t,n),this.quaternion.premultiply(jr),this}rotateX(t){return this.rotateOnAxis(BS,t)}rotateY(t){return this.rotateOnAxis(FS,t)}rotateZ(t){return this.rotateOnAxis(VS,t)}translateOnAxis(t,n){return zS.copy(t).applyQuaternion(this.quaternion),this.position.add(zS.multiplyScalar(n)),this}translateX(t){return this.translateOnAxis(BS,t)}translateY(t){return this.translateOnAxis(FS,t)}translateZ(t){return this.translateOnAxis(VS,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(ms.copy(this.matrixWorld).invert())}lookAt(t,n,i){t.isVector3?sh.copy(t):sh.set(t,n,i);let s=this.parent;this.updateWorldMatrix(!0,!1),Al.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?ms.lookAt(Al,sh,this.up):ms.lookAt(sh,Al,this.up),this.quaternion.setFromRotationMatrix(ms),s&&(ms.extractRotation(s.matrixWorld),jr.setFromRotationMatrix(ms),this.quaternion.premultiply(jr.invert()))}add(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.add(arguments[n]);return this}return t===this?(Lt("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(HS),Qr.child=t,this.dispatchEvent(Qr),Qr.child=null):Lt("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let n=this.children.indexOf(t);return n!==-1&&(t.parent=null,this.children.splice(n,1),t.dispatchEvent(GT),cg.child=t,this.dispatchEvent(cg),cg.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),ms.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),ms.multiply(t.parent.matrixWorld)),t.applyMatrix4(ms),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(HS),Qr.child=t,this.dispatchEvent(Qr),Qr.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,n){if(this[t]===n)return this;for(let i=0,s=this.children.length;i<s;i++){let r=this.children[i].getObjectByProperty(t,n);if(r!==void 0)return r}}getObjectsByProperty(t,n,i=[]){this[t]===n&&i.push(this);let s=this.children;for(let a=0,r=s.length;a<r;a++)s[a].getObjectsByProperty(t,n,i);return i}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Al,t,VT),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Al,HT,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let n=this.matrixWorld.elements;return t.set(n[8],n[9],n[10]).normalize()}raycast(){}traverse(t){t(this);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].traverseVisible(t)}traverseAncestors(t){let n=this.parent;n!==null&&(t(n),n.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let n=t.x,i=t.y,s=t.z,a=this.matrix.elements;a[12]+=n-a[0]*n-a[4]*i-a[8]*s,a[13]+=i-a[1]*n-a[5]*i-a[9]*s,a[14]+=s-a[2]*n-a[6]*i-a[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].updateMatrixWorld(t)}updateWorldMatrix(t,n,i=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),n===!0){let a=this.children;for(let r=0,o=a.length;r<o;r++)a[r].updateWorldMatrix(!1,!0,i)}}toJSON(t){let n=t===void 0||typeof t=="string",i={};n&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function a(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=a(t.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let p=l[c];a(t.shapes,p)}else a(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(a(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(a(t.materials,this.material[l]));s.material=o}else s.material=a(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];s.animations.push(a(t.animations,l))}}if(n){let o=r(t.geometries),l=r(t.materials),c=r(t.textures),h=r(t.images),p=r(t.shapes),u=r(t.skeletons),d=r(t.animations),_=r(t.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),p.length>0&&(i.shapes=p),u.length>0&&(i.skeletons=u),d.length>0&&(i.animations=d),_.length>0&&(i.nodes=_)}return i.object=s,i;function r(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,n=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),n===!0)for(let i=0;i<t.children.length;i++){let s=t.children[i];this.add(s.clone())}return this}};Kn.DEFAULT_UP=new N(0,1,0);Kn.DEFAULT_MATRIX_AUTO_UPDATE=!0;Kn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Vi=class extends Kn{constructor(){super(),this.isGroup=!0,this.type="Group"}},kT={type:"move"},uo=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Vi,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Vi,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new N,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new N),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Vi,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new N,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new N,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let n=this._hand;if(n)for(let i of t.hand.values())this._getHandJoint(n,i)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,n,i){let s=null,a=null,r=null,o=this._targetRay,l=this._grip,c=this._hand;if(t&&n.session.visibilityState!=="visible-blurred"){if(c&&t.hand){r=!0;for(let b of t.hand.values()){let g=n.getJointPose(b,i),f=this._getHandJoint(c,b);g!==null&&(f.matrix.fromArray(g.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=g.radius),f.visible=g!==null}let h=c.joints["index-finger-tip"],p=c.joints["thumb-tip"],u=h.position.distanceTo(p.position),d=.02,_=.005;c.inputState.pinching&&u>d+_?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&u<=d-_&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(a=n.getPose(t.gripSpace,i),a!==null&&(l.matrix.fromArray(a.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,a.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(a.linearVelocity)):l.hasLinearVelocity=!1,a.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(a.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:t,target:this})));o!==null&&(s=n.getPose(t.targetRaySpace,i),s===null&&a!==null&&(s=a),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(kT)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=a!==null),c!==null&&(c.visible=r!==null),this}_getHandJoint(t,n){if(t.joints[n.jointName]===void 0){let i=new Vi;i.matrixAutoUpdate=!1,i.visible=!1,t.joints[n.jointName]=i,t.add(i)}return t.joints[n.jointName]}},Bb={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ia={h:0,s:0,l:0},ah={h:0,s:0,l:0};function ug(e,t,n){return n<0&&(n+=1),n>1&&(n-=1),n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var te=class{constructor(t,n,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,n,i)}set(t,n,i){if(n===void 0&&i===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,n,i);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,n=Tn){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,$t.colorSpaceToWorking(this,n),this}setRGB(t,n,i,s=$t.workingColorSpace){return this.r=t,this.g=n,this.b=i,$t.colorSpaceToWorking(this,s),this}setHSL(t,n,i,s=$t.workingColorSpace){if(t=LT(t,1),n=Jt(n,0,1),i=Jt(i,0,1),n===0)this.r=this.g=this.b=i;else{let a=i<=.5?i*(1+n):i+n-i*n,r=2*i-a;this.r=ug(r,a,t+1/3),this.g=ug(r,a,t),this.b=ug(r,a,t-1/3)}return $t.colorSpaceToWorking(this,s),this}setStyle(t,n=Tn){function i(a){a!==void 0&&parseFloat(a)<1&&Ut("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let a,r=s[1],o=s[2];switch(r){case"rgb":case"rgba":if(a=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setRGB(Math.min(255,parseInt(a[1],10))/255,Math.min(255,parseInt(a[2],10))/255,Math.min(255,parseInt(a[3],10))/255,n);if(a=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setRGB(Math.min(100,parseInt(a[1],10))/100,Math.min(100,parseInt(a[2],10))/100,Math.min(100,parseInt(a[3],10))/100,n);break;case"hsl":case"hsla":if(a=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setHSL(parseFloat(a[1])/360,parseFloat(a[2])/100,parseFloat(a[3])/100,n);break;default:Ut("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let a=s[1],r=a.length;if(r===3)return this.setRGB(parseInt(a.charAt(0),16)/15,parseInt(a.charAt(1),16)/15,parseInt(a.charAt(2),16)/15,n);if(r===6)return this.setHex(parseInt(a,16),n);Ut("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,n);return this}setColorName(t,n=Tn){let i=Bb[t.toLowerCase()];return i!==void 0?this.setHex(i,n):Ut("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Ss(t.r),this.g=Ss(t.g),this.b=Ss(t.b),this}copyLinearToSRGB(t){return this.r=oo(t.r),this.g=oo(t.g),this.b=oo(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Tn){return $t.workingToColorSpace(vn.copy(this),t),Math.round(Jt(vn.r*255,0,255))*65536+Math.round(Jt(vn.g*255,0,255))*256+Math.round(Jt(vn.b*255,0,255))}getHexString(t=Tn){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,n=$t.workingColorSpace){$t.workingToColorSpace(vn.copy(this),n);let i=vn.r,s=vn.g,a=vn.b,r=Math.max(i,s,a),o=Math.min(i,s,a),l,c,h=(o+r)/2;if(o===r)l=0,c=0;else{let p=r-o;switch(c=h<=.5?p/(r+o):p/(2-r-o),r){case i:l=(s-a)/p+(s<a?6:0);break;case s:l=(a-i)/p+2;break;case a:l=(i-s)/p+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,n=$t.workingColorSpace){return $t.workingToColorSpace(vn.copy(this),n),t.r=vn.r,t.g=vn.g,t.b=vn.b,t}getStyle(t=Tn){$t.workingToColorSpace(vn.copy(this),t);let n=vn.r,i=vn.g,s=vn.b;return t!==Tn?`color(${t} ${n.toFixed(3)} ${i.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(n*255)},${Math.round(i*255)},${Math.round(s*255)})`}offsetHSL(t,n,i){return this.getHSL(ia),this.setHSL(ia.h+t,ia.s+n,ia.l+i)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,n){return this.r=t.r+n.r,this.g=t.g+n.g,this.b=t.b+n.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,n){return this.r+=(t.r-this.r)*n,this.g+=(t.g-this.g)*n,this.b+=(t.b-this.b)*n,this}lerpColors(t,n,i){return this.r=t.r+(n.r-t.r)*i,this.g=t.g+(n.g-t.g)*i,this.b=t.b+(n.b-t.b)*i,this}lerpHSL(t,n){this.getHSL(ia),t.getHSL(ah);let i=sg(ia.h,ah.h,n),s=sg(ia.s,ah.s,n),a=sg(ia.l,ah.l,n);return this.setHSL(i,s,a),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let n=this.r,i=this.g,s=this.b,a=t.elements;return this.r=a[0]*n+a[3]*i+a[6]*s,this.g=a[1]*n+a[4]*i+a[7]*s,this.b=a[2]*n+a[5]*i+a[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,n=0){return this.r=t[n],this.g=t[n+1],this.b=t[n+2],this}toArray(t=[],n=0){return t[n]=this.r,t[n+1]=this.g,t[n+2]=this.b,t}fromBufferAttribute(t,n){return this.r=t.getX(n),this.g=t.getY(n),this.b=t.getZ(n),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},vn=new te;te.NAMES=Bb;var Vl=class extends Kn{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ca,this.environmentIntensity=1,this.environmentRotation=new ca,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,n){return super.copy(t,n),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let n=super.toJSON(t);return this.fog!==null&&(n.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(n.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(n.object.backgroundIntensity=this.backgroundIntensity),n.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(n.object.environmentIntensity=this.environmentIntensity),n.object.environmentRotation=this.environmentRotation.toArray(),n}},xi=new N,gs=new N,hg=new N,_s=new N,$r=new N,to=new N,GS=new N,fg=new N,dg=new N,pg=new N,mg=new Ue,gg=new Ue,_g=new Ue,xs=class e{constructor(t=new N,n=new N,i=new N){this.a=t,this.b=n,this.c=i}static getNormal(t,n,i,s){s.subVectors(i,n),xi.subVectors(t,n),s.cross(xi);let a=s.lengthSq();return a>0?s.multiplyScalar(1/Math.sqrt(a)):s.set(0,0,0)}static getBarycoord(t,n,i,s,a){xi.subVectors(s,n),gs.subVectors(i,n),hg.subVectors(t,n);let r=xi.dot(xi),o=xi.dot(gs),l=xi.dot(hg),c=gs.dot(gs),h=gs.dot(hg),p=r*c-o*o;if(p===0)return a.set(0,0,0),null;let u=1/p,d=(c*l-o*h)*u,_=(r*h-o*l)*u;return a.set(1-d-_,_,d)}static containsPoint(t,n,i,s){return this.getBarycoord(t,n,i,s,_s)===null?!1:_s.x>=0&&_s.y>=0&&_s.x+_s.y<=1}static getInterpolation(t,n,i,s,a,r,o,l){return this.getBarycoord(t,n,i,s,_s)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(a,_s.x),l.addScaledVector(r,_s.y),l.addScaledVector(o,_s.z),l)}static getInterpolatedAttribute(t,n,i,s,a,r){return mg.setScalar(0),gg.setScalar(0),_g.setScalar(0),mg.fromBufferAttribute(t,n),gg.fromBufferAttribute(t,i),_g.fromBufferAttribute(t,s),r.setScalar(0),r.addScaledVector(mg,a.x),r.addScaledVector(gg,a.y),r.addScaledVector(_g,a.z),r}static isFrontFacing(t,n,i,s){return xi.subVectors(i,n),gs.subVectors(t,n),xi.cross(gs).dot(s)<0}set(t,n,i){return this.a.copy(t),this.b.copy(n),this.c.copy(i),this}setFromPointsAndIndices(t,n,i,s){return this.a.copy(t[n]),this.b.copy(t[i]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,n,i,s){return this.a.fromBufferAttribute(t,n),this.b.fromBufferAttribute(t,i),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return xi.subVectors(this.c,this.b),gs.subVectors(this.a,this.b),xi.cross(gs).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,i,s,a){return e.getInterpolation(t,this.a,this.b,this.c,n,i,s,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,n){let i=this.a,s=this.b,a=this.c,r,o;$r.subVectors(s,i),to.subVectors(a,i),fg.subVectors(t,i);let l=$r.dot(fg),c=to.dot(fg);if(l<=0&&c<=0)return n.copy(i);dg.subVectors(t,s);let h=$r.dot(dg),p=to.dot(dg);if(h>=0&&p<=h)return n.copy(s);let u=l*p-h*c;if(u<=0&&l>=0&&h<=0)return r=l/(l-h),n.copy(i).addScaledVector($r,r);pg.subVectors(t,a);let d=$r.dot(pg),_=to.dot(pg);if(_>=0&&d<=_)return n.copy(a);let b=d*c-l*_;if(b<=0&&c>=0&&_<=0)return o=c/(c-_),n.copy(i).addScaledVector(to,o);let g=h*_-d*p;if(g<=0&&p-h>=0&&d-_>=0)return GS.subVectors(a,s),o=(p-h)/(p-h+(d-_)),n.copy(s).addScaledVector(GS,o);let f=1/(g+b+u);return r=b*f,o=u*f,n.copy(i).addScaledVector($r,r).addScaledVector(to,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},ua=class{constructor(t=new N(1/0,1/0,1/0),n=new N(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=n}set(t,n){return this.min.copy(t),this.max.copy(n),this}setFromArray(t){this.makeEmpty();for(let n=0,i=t.length;n<i;n+=3)this.expandByPoint(Si.fromArray(t,n));return this}setFromBufferAttribute(t){this.makeEmpty();for(let n=0,i=t.count;n<i;n++)this.expandByPoint(Si.fromBufferAttribute(t,n));return this}setFromPoints(t){this.makeEmpty();for(let n=0,i=t.length;n<i;n++)this.expandByPoint(t[n]);return this}setFromCenterAndSize(t,n){let i=Si.copy(n).multiplyScalar(.5);return this.min.copy(t).sub(i),this.max.copy(t).add(i),this}setFromObject(t,n=!1){return this.makeEmpty(),this.expandByObject(t,n)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,n=!1){t.updateWorldMatrix(!1,!1);let i=t.geometry;if(i!==void 0){let a=i.getAttribute("position");if(n===!0&&a!==void 0&&t.isInstancedMesh!==!0)for(let r=0,o=a.count;r<o;r++)t.isMesh===!0?t.getVertexPosition(r,Si):Si.fromBufferAttribute(a,r),Si.applyMatrix4(t.matrixWorld),this.expandByPoint(Si);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),rh.copy(t.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),rh.copy(i.boundingBox)),rh.applyMatrix4(t.matrixWorld),this.union(rh)}let s=t.children;for(let a=0,r=s.length;a<r;a++)this.expandByObject(s[a],n);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,n){return n.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,Si),Si.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let n,i;return t.normal.x>0?(n=t.normal.x*this.min.x,i=t.normal.x*this.max.x):(n=t.normal.x*this.max.x,i=t.normal.x*this.min.x),t.normal.y>0?(n+=t.normal.y*this.min.y,i+=t.normal.y*this.max.y):(n+=t.normal.y*this.max.y,i+=t.normal.y*this.min.y),t.normal.z>0?(n+=t.normal.z*this.min.z,i+=t.normal.z*this.max.z):(n+=t.normal.z*this.max.z,i+=t.normal.z*this.min.z),n<=-t.constant&&i>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(wl),oh.subVectors(this.max,wl),eo.subVectors(t.a,wl),no.subVectors(t.b,wl),io.subVectors(t.c,wl),sa.subVectors(no,eo),aa.subVectors(io,no),ka.subVectors(eo,io);let n=[0,-sa.z,sa.y,0,-aa.z,aa.y,0,-ka.z,ka.y,sa.z,0,-sa.x,aa.z,0,-aa.x,ka.z,0,-ka.x,-sa.y,sa.x,0,-aa.y,aa.x,0,-ka.y,ka.x,0];return!vg(n,eo,no,io,oh)||(n=[1,0,0,0,1,0,0,0,1],!vg(n,eo,no,io,oh))?!1:(lh.crossVectors(sa,aa),n=[lh.x,lh.y,lh.z],vg(n,eo,no,io,oh))}clampPoint(t,n){return n.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Si).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Si).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(vs[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),vs[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),vs[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),vs[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),vs[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),vs[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),vs[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),vs[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(vs),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},vs=[new N,new N,new N,new N,new N,new N,new N,new N],Si=new N,rh=new ua,eo=new N,no=new N,io=new N,sa=new N,aa=new N,ka=new N,wl=new N,oh=new N,lh=new N,Xa=new N;function vg(e,t,n,i,s){for(let a=0,r=e.length-3;a<=r;a+=3){Xa.fromArray(e,a);let o=s.x*Math.abs(Xa.x)+s.y*Math.abs(Xa.y)+s.z*Math.abs(Xa.z),l=t.dot(Xa),c=n.dot(Xa),h=i.dot(Xa);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var Ze=new N,ch=new Dt,XT=0,Zn=class extends Gi{constructor(t,n,i=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:XT++}),this.name="",this.array=t,this.itemSize=n,this.count=t!==void 0?t.length/n:0,this.normalized=i,this.usage=Pg,this.updateRanges=[],this.gpuType=Ti,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,n){this.updateRanges.push({start:t,count:n})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,n,i){t*=this.itemSize,i*=n.itemSize;for(let s=0,a=this.itemSize;s<a;s++)this.array[t+s]=n.array[i+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let n=0,i=this.count;n<i;n++)ch.fromBufferAttribute(this,n),ch.applyMatrix3(t),this.setXY(n,ch.x,ch.y);else if(this.itemSize===3)for(let n=0,i=this.count;n<i;n++)Ze.fromBufferAttribute(this,n),Ze.applyMatrix3(t),this.setXYZ(n,Ze.x,Ze.y,Ze.z);return this}applyMatrix4(t){for(let n=0,i=this.count;n<i;n++)Ze.fromBufferAttribute(this,n),Ze.applyMatrix4(t),this.setXYZ(n,Ze.x,Ze.y,Ze.z);return this}applyNormalMatrix(t){for(let n=0,i=this.count;n<i;n++)Ze.fromBufferAttribute(this,n),Ze.applyNormalMatrix(t),this.setXYZ(n,Ze.x,Ze.y,Ze.z);return this}transformDirection(t){for(let n=0,i=this.count;n<i;n++)Ze.fromBufferAttribute(this,n),Ze.transformDirection(t),this.setXYZ(n,Ze.x,Ze.y,Ze.z);return this}set(t,n=0){return this.array.set(t,n),this}getComponent(t,n){let i=this.array[t*this.itemSize+n];return this.normalized&&(i=Tl(i,this.array)),i}setComponent(t,n,i){return this.normalized&&(i=In(i,this.array)),this.array[t*this.itemSize+n]=i,this}getX(t){let n=this.array[t*this.itemSize];return this.normalized&&(n=Tl(n,this.array)),n}setX(t,n){return this.normalized&&(n=In(n,this.array)),this.array[t*this.itemSize]=n,this}getY(t){let n=this.array[t*this.itemSize+1];return this.normalized&&(n=Tl(n,this.array)),n}setY(t,n){return this.normalized&&(n=In(n,this.array)),this.array[t*this.itemSize+1]=n,this}getZ(t){let n=this.array[t*this.itemSize+2];return this.normalized&&(n=Tl(n,this.array)),n}setZ(t,n){return this.normalized&&(n=In(n,this.array)),this.array[t*this.itemSize+2]=n,this}getW(t){let n=this.array[t*this.itemSize+3];return this.normalized&&(n=Tl(n,this.array)),n}setW(t,n){return this.normalized&&(n=In(n,this.array)),this.array[t*this.itemSize+3]=n,this}setXY(t,n,i){return t*=this.itemSize,this.normalized&&(n=In(n,this.array),i=In(i,this.array)),this.array[t+0]=n,this.array[t+1]=i,this}setXYZ(t,n,i,s){return t*=this.itemSize,this.normalized&&(n=In(n,this.array),i=In(i,this.array),s=In(s,this.array)),this.array[t+0]=n,this.array[t+1]=i,this.array[t+2]=s,this}setXYZW(t,n,i,s,a){return t*=this.itemSize,this.normalized&&(n=In(n,this.array),i=In(i,this.array),s=In(s,this.array),a=In(a,this.array)),this.array[t+0]=n,this.array[t+1]=i,this.array[t+2]=s,this.array[t+3]=a,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Pg&&(t.usage=this.usage),t}dispose(){this.dispatchEvent({type:"dispose"})}};var Hl=class extends Zn{constructor(t,n,i){super(new Uint16Array(t),n,i)}};var Gl=class extends Zn{constructor(t,n,i){super(new Uint32Array(t),n,i)}};var xe=class extends Zn{constructor(t,n,i){super(new Float32Array(t),n,i)}},WT=new ua,Cl=new N,yg=new N,ja=class{constructor(t=new N,n=-1){this.isSphere=!0,this.center=t,this.radius=n}set(t,n){return this.center.copy(t),this.radius=n,this}setFromPoints(t,n){let i=this.center;n!==void 0?i.copy(n):WT.setFromPoints(t).getCenter(i);let s=0;for(let a=0,r=t.length;a<r;a++)s=Math.max(s,i.distanceToSquared(t[a]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let n=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=n*n}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,n){let i=this.center.distanceToSquared(t);return n.copy(t),i>this.radius*this.radius&&(n.sub(this.center).normalize(),n.multiplyScalar(this.radius).add(this.center)),n}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Cl.subVectors(t,this.center);let n=Cl.lengthSq();if(n>this.radius*this.radius){let i=Math.sqrt(n),s=(i-this.radius)*.5;this.center.addScaledVector(Cl,s/i),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(yg.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Cl.copy(t.center).add(yg)),this.expandByPoint(Cl.copy(t.center).sub(yg))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},qT=0,fi=new De,xg=new Kn,so=new N,Yn=new ua,Rl=new ua,an=new N,on=class e extends Gi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:qT++}),this.uuid=fc(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(UT(t)?Gl:Hl)(t,1):this.index=t,this}setIndirect(t,n=0){return this.indirect=t,this.indirectOffset=n,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,n){return this.attributes[t]=n,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,n,i=0){this.groups.push({start:t,count:n,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(t,n){this.drawRange.start=t,this.drawRange.count=n}applyMatrix4(t){let n=this.attributes.position;n!==void 0&&(n.applyMatrix4(t),n.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let a=new Pt().getNormalMatrix(t);i.applyNormalMatrix(a),i.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return fi.makeRotationFromQuaternion(t),this.applyMatrix4(fi),this}rotateX(t){return fi.makeRotationX(t),this.applyMatrix4(fi),this}rotateY(t){return fi.makeRotationY(t),this.applyMatrix4(fi),this}rotateZ(t){return fi.makeRotationZ(t),this.applyMatrix4(fi),this}translate(t,n,i){return fi.makeTranslation(t,n,i),this.applyMatrix4(fi),this}scale(t,n,i){return fi.makeScale(t,n,i),this.applyMatrix4(fi),this}lookAt(t){return xg.lookAt(t),xg.updateMatrix(),this.applyMatrix4(xg.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(so).negate(),this.translate(so.x,so.y,so.z),this}setFromPoints(t){let n=this.getAttribute("position");if(n===void 0){let i=[];for(let s=0,a=t.length;s<a;s++){let r=t[s];i.push(r.x,r.y,r.z||0)}this.setAttribute("position",new xe(i,3))}else{let i=Math.min(t.length,n.count);for(let s=0;s<i;s++){let a=t[s];n.setXYZ(s,a.x,a.y,a.z||0)}t.length>n.count&&Ut("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),n.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ua);let t=this.attributes.position,n=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Lt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new N(-1/0,-1/0,-1/0),new N(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),n)for(let i=0,s=n.length;i<s;i++){let a=n[i];Yn.setFromBufferAttribute(a),this.morphTargetsRelative?(an.addVectors(this.boundingBox.min,Yn.min),this.boundingBox.expandByPoint(an),an.addVectors(this.boundingBox.max,Yn.max),this.boundingBox.expandByPoint(an)):(this.boundingBox.expandByPoint(Yn.min),this.boundingBox.expandByPoint(Yn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Lt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ja);let t=this.attributes.position,n=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Lt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new N,1/0);return}if(t){let i=this.boundingSphere.center;if(Yn.setFromBufferAttribute(t),n)for(let a=0,r=n.length;a<r;a++){let o=n[a];Rl.setFromBufferAttribute(o),this.morphTargetsRelative?(an.addVectors(Yn.min,Rl.min),Yn.expandByPoint(an),an.addVectors(Yn.max,Rl.max),Yn.expandByPoint(an)):(Yn.expandByPoint(Rl.min),Yn.expandByPoint(Rl.max))}Yn.getCenter(i);let s=0;for(let a=0,r=t.count;a<r;a++)an.fromBufferAttribute(t,a),s=Math.max(s,i.distanceToSquared(an));if(n)for(let a=0,r=n.length;a<r;a++){let o=n[a],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)an.fromBufferAttribute(o,c),l&&(so.fromBufferAttribute(t,c),an.add(so)),s=Math.max(s,i.distanceToSquared(an))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Lt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,n=this.attributes;if(t===null||n.position===void 0||n.normal===void 0||n.uv===void 0){Lt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=n.position,s=n.normal,a=n.uv,r=this.getAttribute("tangent");(r===void 0||r.count!==i.count)&&(r=new Zn(new Float32Array(4*i.count),4),this.setAttribute("tangent",r));let o=[],l=[];for(let x=0;x<i.count;x++)o[x]=new N,l[x]=new N;let c=new N,h=new N,p=new N,u=new Dt,d=new Dt,_=new Dt,b=new N,g=new N;function f(x,T,R){c.fromBufferAttribute(i,x),h.fromBufferAttribute(i,T),p.fromBufferAttribute(i,R),u.fromBufferAttribute(a,x),d.fromBufferAttribute(a,T),_.fromBufferAttribute(a,R),h.sub(c),p.sub(c),d.sub(u),_.sub(u);let D=1/(d.x*_.y-_.x*d.y);isFinite(D)&&(b.copy(h).multiplyScalar(_.y).addScaledVector(p,-d.y).multiplyScalar(D),g.copy(p).multiplyScalar(d.x).addScaledVector(h,-_.x).multiplyScalar(D),o[x].add(b),o[T].add(b),o[R].add(b),l[x].add(g),l[T].add(g),l[R].add(g))}let v=this.groups;v.length===0&&(v=[{start:0,count:t.count}]);for(let x=0,T=v.length;x<T;++x){let R=v[x],D=R.start,L=R.count;for(let k=D,X=D+L;k<X;k+=3)f(t.getX(k+0),t.getX(k+1),t.getX(k+2))}let S=new N,y=new N,E=new N,A=new N;function w(x){E.fromBufferAttribute(s,x),A.copy(E);let T=o[x];S.copy(T),S.sub(E.multiplyScalar(E.dot(T))).normalize(),y.crossVectors(A,T);let D=y.dot(l[x])<0?-1:1;r.setXYZW(x,S.x,S.y,S.z,D)}for(let x=0,T=v.length;x<T;++x){let R=v[x],D=R.start,L=R.count;for(let k=D,X=D+L;k<X;k+=3)w(t.getX(k+0)),w(t.getX(k+1)),w(t.getX(k+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,n=this.getAttribute("position");if(n!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==n.count)i=new Zn(new Float32Array(n.count*3),3),this.setAttribute("normal",i);else for(let u=0,d=i.count;u<d;u++)i.setXYZ(u,0,0,0);let s=new N,a=new N,r=new N,o=new N,l=new N,c=new N,h=new N,p=new N;if(t)for(let u=0,d=t.count;u<d;u+=3){let _=t.getX(u+0),b=t.getX(u+1),g=t.getX(u+2);s.fromBufferAttribute(n,_),a.fromBufferAttribute(n,b),r.fromBufferAttribute(n,g),h.subVectors(r,a),p.subVectors(s,a),h.cross(p),o.fromBufferAttribute(i,_),l.fromBufferAttribute(i,b),c.fromBufferAttribute(i,g),o.add(h),l.add(h),c.add(h),i.setXYZ(_,o.x,o.y,o.z),i.setXYZ(b,l.x,l.y,l.z),i.setXYZ(g,c.x,c.y,c.z)}else for(let u=0,d=n.count;u<d;u+=3)s.fromBufferAttribute(n,u+0),a.fromBufferAttribute(n,u+1),r.fromBufferAttribute(n,u+2),h.subVectors(r,a),p.subVectors(s,a),h.cross(p),i.setXYZ(u+0,h.x,h.y,h.z),i.setXYZ(u+1,h.x,h.y,h.z),i.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let n=0,i=t.count;n<i;n++)an.fromBufferAttribute(t,n),an.normalize(),t.setXYZ(n,an.x,an.y,an.z)}toNonIndexed(){function t(o,l){let c=o.array,h=o.itemSize,p=o.normalized,u=new c.constructor(l.length*h),d=0,_=0;for(let b=0,g=l.length;b<g;b++){o.isInterleavedBufferAttribute?d=l[b]*o.data.stride+o.offset:d=l[b]*h;for(let f=0;f<h;f++)u[_++]=c[d++]}return new Zn(u,h,p)}if(this.index===null)return Ut("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let n=new e,i=this.index.array,s=this.attributes;for(let o in s){let l=s[o],c=t(l,i);n.setAttribute(o,c)}let a=this.morphAttributes;for(let o in a){let l=[],c=a[o];for(let h=0,p=c.length;h<p;h++){let u=c[h],d=t(u,i);l.push(d)}n.morphAttributes[o]=l}n.morphTargetsRelative=this.morphTargetsRelative;let r=this.groups;for(let o=0,l=r.length;o<l;o++){let c=r[o];n.addGroup(c.start,c.count,c.materialIndex)}return n}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let n=this.index;n!==null&&(t.data.index={type:n.array.constructor.name,array:Array.prototype.slice.call(n.array)});let i=this.attributes;for(let l in i){let c=i[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},a=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let p=0,u=c.length;p<u;p++){let d=c[p];h.push(d.toJSON(t.data))}h.length>0&&(s[l]=h,a=!0)}a&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let r=this.groups;r.length>0&&(t.data.groups=JSON.parse(JSON.stringify(r)));let o=this.boundingSphere;return o!==null&&(t.data.boundingSphere=o.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let n={};this.name=t.name;let i=t.index;i!==null&&this.setIndex(i.clone());let s=t.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(n))}let a=t.morphAttributes;for(let c in a){let h=[],p=a[c];for(let u=0,d=p.length;u<d;u++)h.push(p[u].clone(n));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let r=t.groups;for(let c=0,h=r.length;c<h;c++){let p=r[c];this.addGroup(p.start,p.count,p.materialIndex)}let o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var YT=0,ha=class extends Gi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:YT++}),this.uuid=fc(),this.name="",this.type="Material",this.blending=Ja,this.side=bs,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Dh,this.blendDst=Uh,this.blendEquation=la,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new te(0,0,0),this.blendAlpha=0,this.depthFunc=Ka,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Og,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ya,this.stencilZFail=Ya,this.stencilZPass=Ya,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let n in t){let i=t[n];if(i===void 0){Ut(`Material: parameter '${n}' has value of undefined.`);continue}let s=this[n];if(s===void 0){Ut(`Material: '${n}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(i):s&&s.isVector2&&i&&i.isVector2||s&&s.isEuler&&i&&i.isEuler||s&&s.isVector3&&i&&i.isVector3?s.copy(i):this[n]=i}}toJSON(t){let n=t===void 0||typeof t=="string";n&&(t={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(t).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(t).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(t).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(t).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(t).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Ja&&(i.blending=this.blending),this.side!==bs&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Dh&&(i.blendSrc=this.blendSrc),this.blendDst!==Uh&&(i.blendDst=this.blendDst),this.blendEquation!==la&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Ka&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Og&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Ya&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Ya&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Ya&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function s(a){let r=[];for(let o in a){let l=a[o];delete l.metadata,r.push(l)}return r}if(n){let a=s(t.textures),r=s(t.images);a.length>0&&(i.textures=a),r.length>0&&(i.images=r)}return i}fromJSON(t,n){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new te().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=n[t.map]||null),t.matcap!==void 0&&(this.matcap=n[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=n[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=n[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=n[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let i=t.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new Dt().fromArray(i)}return t.displacementMap!==void 0&&(this.displacementMap=n[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=n[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=n[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=n[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=n[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=n[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=n[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=n[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=n[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=n[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=n[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=n[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=n[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=n[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Dt().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=n[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=n[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=n[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=n[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=n[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=n[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=n[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let n=t.clippingPlanes,i=null;if(n!==null){let s=n.length;i=new Array(s);for(let a=0;a!==s;++a)i[a]=n[a].clone()}return this.clippingPlanes=i,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var ys=new N,Sg=new N,uh=new N,ra=new N,bg=new N,hh=new N,Mg=new N,kl=class{constructor(t=new N,n=new N(0,0,-1)){this.origin=t,this.direction=n}set(t,n){return this.origin.copy(t),this.direction.copy(n),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,n){return n.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,ys)),this}closestPointToPoint(t,n){n.subVectors(t,this.origin);let i=n.dot(this.direction);return i<0?n.copy(this.origin):n.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let n=ys.subVectors(t,this.origin).dot(this.direction);return n<0?this.origin.distanceToSquared(t):(ys.copy(this.origin).addScaledVector(this.direction,n),ys.distanceToSquared(t))}distanceSqToSegment(t,n,i,s){Sg.copy(t).add(n).multiplyScalar(.5),uh.copy(n).sub(t).normalize(),ra.copy(this.origin).sub(Sg);let a=t.distanceTo(n)*.5,r=-this.direction.dot(uh),o=ra.dot(this.direction),l=-ra.dot(uh),c=ra.lengthSq(),h=Math.abs(1-r*r),p,u,d,_;if(h>0)if(p=r*l-o,u=r*o-l,_=a*h,p>=0)if(u>=-_)if(u<=_){let b=1/h;p*=b,u*=b,d=p*(p+r*u+2*o)+u*(r*p+u+2*l)+c}else u=a,p=Math.max(0,-(r*u+o)),d=-p*p+u*(u+2*l)+c;else u=-a,p=Math.max(0,-(r*u+o)),d=-p*p+u*(u+2*l)+c;else u<=-_?(p=Math.max(0,-(-r*a+o)),u=p>0?-a:Math.min(Math.max(-a,-l),a),d=-p*p+u*(u+2*l)+c):u<=_?(p=0,u=Math.min(Math.max(-a,-l),a),d=u*(u+2*l)+c):(p=Math.max(0,-(r*a+o)),u=p>0?a:Math.min(Math.max(-a,-l),a),d=-p*p+u*(u+2*l)+c);else u=r>0?-a:a,p=Math.max(0,-(r*u+o)),d=-p*p+u*(u+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,p),s&&s.copy(Sg).addScaledVector(uh,u),d}intersectSphere(t,n){ys.subVectors(t.center,this.origin);let i=ys.dot(this.direction),s=ys.dot(ys)-i*i,a=t.radius*t.radius;if(s>a)return null;let r=Math.sqrt(a-s),o=i-r,l=i+r;return l<0?null:o<0?this.at(l,n):this.at(o,n)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let n=t.normal.dot(this.direction);if(n===0)return t.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(t.normal)+t.constant)/n;return i>=0?i:null}intersectPlane(t,n){let i=this.distanceToPlane(t);return i===null?null:this.at(i,n)}intersectsPlane(t){let n=t.distanceToPoint(this.origin);return n===0||t.normal.dot(this.direction)*n<0}intersectBox(t,n){let i,s,a,r,o,l,c=1/this.direction.x,h=1/this.direction.y,p=1/this.direction.z,u=this.origin;return c>=0?(i=(t.min.x-u.x)*c,s=(t.max.x-u.x)*c):(i=(t.max.x-u.x)*c,s=(t.min.x-u.x)*c),h>=0?(a=(t.min.y-u.y)*h,r=(t.max.y-u.y)*h):(a=(t.max.y-u.y)*h,r=(t.min.y-u.y)*h),i>r||a>s||((a>i||isNaN(i))&&(i=a),(r<s||isNaN(s))&&(s=r),p>=0?(o=(t.min.z-u.z)*p,l=(t.max.z-u.z)*p):(o=(t.max.z-u.z)*p,l=(t.min.z-u.z)*p),i>l||o>s)||((o>i||i!==i)&&(i=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(i>=0?i:s,n)}intersectsBox(t){return this.intersectBox(t,ys)!==null}intersectTriangle(t,n,i,s,a){bg.subVectors(n,t),hh.subVectors(i,t),Mg.crossVectors(bg,hh);let r=this.direction.dot(Mg),o;if(r>0){if(s)return null;o=1}else if(r<0)o=-1,r=-r;else return null;ra.subVectors(this.origin,t);let l=o*this.direction.dot(hh.crossVectors(ra,hh));if(l<0)return null;let c=o*this.direction.dot(bg.cross(ra));if(c<0||l+c>r)return null;let h=-o*ra.dot(Mg);return h<0?null:this.at(h/r,a)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},di=class extends ha{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new te(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ca,this.combine=kg,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},kS=new De,Wa=new kl,fh=new ja,XS=new N,dh=new N,ph=new N,mh=new N,Eg=new N,gh=new N,WS=new N,_h=new N,Qe=class extends Kn{constructor(t=new on,n=new di){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=n,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,n){return super.copy(t,n),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let n=this.geometry.morphAttributes,i=Object.keys(n);if(i.length>0){let s=n[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let a=0,r=s.length;a<r;a++){let o=s[a].name||String(a);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=a}}}}getVertexPosition(t,n){let i=this.geometry,s=i.attributes.position,a=i.morphAttributes.position,r=i.morphTargetsRelative;n.fromBufferAttribute(s,t);let o=this.morphTargetInfluences;if(a&&o){gh.set(0,0,0);for(let l=0,c=a.length;l<c;l++){let h=o[l],p=a[l];h!==0&&(Eg.fromBufferAttribute(p,t),r?gh.addScaledVector(Eg,h):gh.addScaledVector(Eg.sub(n),h))}n.add(gh)}return n}raycast(t,n){let i=this.geometry,s=this.material,a=this.matrixWorld;s!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),fh.copy(i.boundingSphere),fh.applyMatrix4(a),Wa.copy(t.ray).recast(t.near),!(fh.containsPoint(Wa.origin)===!1&&(Wa.intersectSphere(fh,XS)===null||Wa.origin.distanceToSquared(XS)>(t.far-t.near)**2))&&(kS.copy(a).invert(),Wa.copy(t.ray).applyMatrix4(kS),!(i.boundingBox!==null&&Wa.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(t,n,Wa)))}_computeIntersections(t,n,i){let s,a=this.geometry,r=this.material,o=a.index,l=a.attributes.position,c=a.attributes.uv,h=a.attributes.uv1,p=a.attributes.normal,u=a.groups,d=a.drawRange;if(o!==null)if(Array.isArray(r))for(let _=0,b=u.length;_<b;_++){let g=u[_],f=r[g.materialIndex],v=Math.max(g.start,d.start),S=Math.min(o.count,Math.min(g.start+g.count,d.start+d.count));for(let y=v,E=S;y<E;y+=3){let A=o.getX(y),w=o.getX(y+1),x=o.getX(y+2);s=vh(this,f,t,i,c,h,p,A,w,x),s&&(s.faceIndex=Math.floor(y/3),s.face.materialIndex=g.materialIndex,n.push(s))}}else{let _=Math.max(0,d.start),b=Math.min(o.count,d.start+d.count);for(let g=_,f=b;g<f;g+=3){let v=o.getX(g),S=o.getX(g+1),y=o.getX(g+2);s=vh(this,r,t,i,c,h,p,v,S,y),s&&(s.faceIndex=Math.floor(g/3),n.push(s))}}else if(l!==void 0)if(Array.isArray(r))for(let _=0,b=u.length;_<b;_++){let g=u[_],f=r[g.materialIndex],v=Math.max(g.start,d.start),S=Math.min(l.count,Math.min(g.start+g.count,d.start+d.count));for(let y=v,E=S;y<E;y+=3){let A=y,w=y+1,x=y+2;s=vh(this,f,t,i,c,h,p,A,w,x),s&&(s.faceIndex=Math.floor(y/3),s.face.materialIndex=g.materialIndex,n.push(s))}}else{let _=Math.max(0,d.start),b=Math.min(l.count,d.start+d.count);for(let g=_,f=b;g<f;g+=3){let v=g,S=g+1,y=g+2;s=vh(this,r,t,i,c,h,p,v,S,y),s&&(s.faceIndex=Math.floor(g/3),n.push(s))}}}};function ZT(e,t,n,i,s,a,r,o){let l;if(t.side===An?l=i.intersectTriangle(r,a,s,!0,o):l=i.intersectTriangle(s,a,r,t.side===bs,o),l===null)return null;_h.copy(o),_h.applyMatrix4(e.matrixWorld);let c=n.ray.origin.distanceTo(_h);return c<n.near||c>n.far?null:{distance:c,point:_h.clone(),object:e}}function vh(e,t,n,i,s,a,r,o,l,c){e.getVertexPosition(o,dh),e.getVertexPosition(l,ph),e.getVertexPosition(c,mh);let h=ZT(e,t,n,i,dh,ph,mh,WS);if(h){let p=new N;xs.getBarycoord(WS,dh,ph,mh,p),s&&(h.uv=xs.getInterpolatedAttribute(s,o,l,c,p,new Dt)),a&&(h.uv1=xs.getInterpolatedAttribute(a,o,l,c,p,new Dt)),r&&(h.normal=xs.getInterpolatedAttribute(r,o,l,c,p,new N),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));let u={a:o,b:l,c,normal:new N,materialIndex:0};xs.getNormal(dh,ph,mh,u.normal),h.face=u,h.barycoord=p}return h}var qh=class extends xn{constructor(t=null,n=1,i=1,s,a,r,o,l,c=rn,h=rn,p,u){super(null,r,o,l,c,h,s,a,p,u),this.isDataTexture=!0,this.image={data:t,width:n,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Tg=new N,JT=new N,KT=new Pt,Bi=class{constructor(t=new N(1,0,0),n=0){this.isPlane=!0,this.normal=t,this.constant=n}set(t,n){return this.normal.copy(t),this.constant=n,this}setComponents(t,n,i,s){return this.normal.set(t,n,i),this.constant=s,this}setFromNormalAndCoplanarPoint(t,n){return this.normal.copy(t),this.constant=-n.dot(this.normal),this}setFromCoplanarPoints(t,n,i){let s=Tg.subVectors(i,n).cross(JT.subVectors(t,n)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,n){return n.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,n,i=!0){let s=t.delta(Tg),a=this.normal.dot(s);if(a===0)return this.distanceToPoint(t.start)===0?n.copy(t.start):null;let r=-(t.start.dot(this.normal)+this.constant)/a;return i===!0&&(r<0||r>1)?null:n.copy(t.start).addScaledVector(s,r)}intersectsLine(t){let n=this.distanceToPoint(t.start),i=this.distanceToPoint(t.end);return n<0&&i>0||i<0&&n>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,n){let i=n||KT.getNormalMatrix(t),s=this.coplanarPoint(Tg).applyMatrix4(t),a=this.normal.applyMatrix3(i).normalize();return this.constant=-s.dot(a),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},qa=new ja,jT=new Dt(.5,.5),yh=new N,Xl=class{constructor(t=new Bi,n=new Bi,i=new Bi,s=new Bi,a=new Bi,r=new Bi){this.planes=[t,n,i,s,a,r]}set(t,n,i,s,a,r){let o=this.planes;return o[0].copy(t),o[1].copy(n),o[2].copy(i),o[3].copy(s),o[4].copy(a),o[5].copy(r),this}copy(t){let n=this.planes;for(let i=0;i<6;i++)n[i].copy(t.planes[i]);return this}setFromProjectionMatrix(t,n=bi,i=!1){let s=this.planes,a=t.elements,r=a[0],o=a[1],l=a[2],c=a[3],h=a[4],p=a[5],u=a[6],d=a[7],_=a[8],b=a[9],g=a[10],f=a[11],v=a[12],S=a[13],y=a[14],E=a[15];if(s[0].setComponents(c-r,d-h,f-_,E-v).normalize(),s[1].setComponents(c+r,d+h,f+_,E+v).normalize(),s[2].setComponents(c+o,d+p,f+b,E+S).normalize(),s[3].setComponents(c-o,d-p,f-b,E-S).normalize(),i)s[4].setComponents(l,u,g,y).normalize(),s[5].setComponents(c-l,d-u,f-g,E-y).normalize();else if(s[4].setComponents(c-l,d-u,f-g,E-y).normalize(),n===bi)s[5].setComponents(c+l,d+u,f+g,E+y).normalize();else if(n===Pl)s[5].setComponents(l,u,g,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+n);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),qa.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let n=t.geometry;n.boundingSphere===null&&n.computeBoundingSphere(),qa.copy(n.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(qa)}intersectsSprite(t){qa.center.set(0,0,0);let n=jT.distanceTo(t.center);return qa.radius=.7071067811865476+n,qa.applyMatrix4(t.matrixWorld),this.intersectsSphere(qa)}intersectsSphere(t){let n=this.planes,i=t.center,s=-t.radius;for(let a=0;a<6;a++)if(n[a].distanceToPoint(i)<s)return!1;return!0}intersectsBox(t){let n=this.planes;for(let i=0;i<6;i++){let s=n[i];if(yh.x=s.normal.x>0?t.max.x:t.min.x,yh.y=s.normal.y>0?t.max.y:t.min.y,yh.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(yh)<0)return!1}return!0}containsPoint(t){let n=this.planes;for(let i=0;i<6;i++)if(n[i].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var fa=class extends ha{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new te(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}},Yh=new N,Zh=new N,qS=new De,Dl=new kl,xh=new ja,Ag=new N,YS=new N,ho=class extends Kn{constructor(t=new on,n=new fa){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=n,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,n){return super.copy(t,n),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){let t=this.geometry;if(t.index===null){let n=t.attributes.position,i=[0];for(let s=1,a=n.count;s<a;s++)Yh.fromBufferAttribute(n,s-1),Zh.fromBufferAttribute(n,s),i[s]=i[s-1],i[s]+=Yh.distanceTo(Zh);t.setAttribute("lineDistance",new xe(i,1))}else Ut("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,n){let i=this.geometry,s=this.matrixWorld,a=t.params.Line.threshold,r=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),xh.copy(i.boundingSphere),xh.applyMatrix4(s),xh.radius+=a,t.ray.intersectsSphere(xh)===!1)return;qS.copy(s).invert(),Dl.copy(t.ray).applyMatrix4(qS);let o=a/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=i.index,u=i.attributes.position;if(h!==null){let d=Math.max(0,r.start),_=Math.min(h.count,r.start+r.count);for(let b=d,g=_-1;b<g;b+=c){let f=h.getX(b),v=h.getX(b+1),S=Sh(this,t,Dl,l,f,v,b);S&&n.push(S)}if(this.isLineLoop){let b=h.getX(_-1),g=h.getX(d),f=Sh(this,t,Dl,l,b,g,_-1);f&&n.push(f)}}else{let d=Math.max(0,r.start),_=Math.min(u.count,r.start+r.count);for(let b=d,g=_-1;b<g;b+=c){let f=Sh(this,t,Dl,l,b,b+1,b);f&&n.push(f)}if(this.isLineLoop){let b=Sh(this,t,Dl,l,_-1,d,_-1);b&&n.push(b)}}}updateMorphTargets(){let n=this.geometry.morphAttributes,i=Object.keys(n);if(i.length>0){let s=n[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let a=0,r=s.length;a<r;a++){let o=s[a].name||String(a);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=a}}}}};function Sh(e,t,n,i,s,a,r){let o=e.geometry.attributes.position;if(Yh.fromBufferAttribute(o,s),Zh.fromBufferAttribute(o,a),n.distanceSqToSegment(Yh,Zh,Ag,YS)>i)return;Ag.applyMatrix4(e.matrixWorld);let c=t.ray.origin.distanceTo(Ag);if(!(c<t.near||c>t.far))return{distance:c,point:YS.clone().applyMatrix4(e.matrixWorld),index:r,face:null,faceIndex:null,barycoord:null,object:e}}var ZS=new N,JS=new N,fo=class extends ho{constructor(t,n){super(t,n),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let t=this.geometry;if(t.index===null){let n=t.attributes.position,i=[];for(let s=0,a=n.count;s<a;s+=2)ZS.fromBufferAttribute(n,s),JS.fromBufferAttribute(n,s+1),i[s]=s===0?0:i[s-1],i[s+1]=i[s]+ZS.distanceTo(JS);t.setAttribute("lineDistance",new xe(i,1))}else Ut("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var Wl=class extends xn{constructor(t=[],n=_a,i,s,a,r,o,l,c,h){super(t,n,i,s,a,r,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}};var Ms=class extends xn{constructor(t,n,i=Ei,s,a,r,o=rn,l=rn,c,h=Hi,p=1){if(h!==Hi&&h!==ya)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:t,height:n,depth:p};super(u,s,a,r,o,l,h,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new co(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let n=super.toJSON(t);return this.compareFunction!==null&&(n.compareFunction=this.compareFunction),n}},Jh=class extends Ms{constructor(t,n=Ei,i=_a,s,a,r=rn,o=rn,l,c=Hi){let h={width:t,height:t,depth:1},p=[h,h,h,h,h,h];super(t,t,n,i,s,a,r,o,l,c),this.image=p,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},ql=class extends xn{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},po=class e extends on{constructor(t=1,n=1,i=1,s=1,a=1,r=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:n,depth:i,widthSegments:s,heightSegments:a,depthSegments:r};let o=this;s=Math.floor(s),a=Math.floor(a),r=Math.floor(r);let l=[],c=[],h=[],p=[],u=0,d=0;_("z","y","x",-1,-1,i,n,t,r,a,0),_("z","y","x",1,-1,i,n,-t,r,a,1),_("x","z","y",1,1,t,i,n,s,r,2),_("x","z","y",1,-1,t,i,-n,s,r,3),_("x","y","z",1,-1,t,n,i,s,a,4),_("x","y","z",-1,-1,t,n,-i,s,a,5),this.setIndex(l),this.setAttribute("position",new xe(c,3)),this.setAttribute("normal",new xe(h,3)),this.setAttribute("uv",new xe(p,2));function _(b,g,f,v,S,y,E,A,w,x,T){let R=y/w,D=E/x,L=y/2,k=E/2,X=A/2,z=w+1,G=x+1,W=0,Q=0,et=new N;for(let at=0;at<G;at++){let ot=at*D-k;for(let vt=0;vt<z;vt++){let kt=vt*R-L;et[b]=kt*v,et[g]=ot*S,et[f]=X,c.push(et.x,et.y,et.z),et[b]=0,et[g]=0,et[f]=A>0?1:-1,h.push(et.x,et.y,et.z),p.push(vt/w),p.push(1-at/x),W+=1}}for(let at=0;at<x;at++)for(let ot=0;ot<w;ot++){let vt=u+ot+z*at,kt=u+ot+z*(at+1),de=u+(ot+1)+z*(at+1),Ht=u+(ot+1)+z*at;l.push(vt,kt,Ht),l.push(kt,de,Ht),Q+=6}o.addGroup(d,Q,T),d+=Q,u+=W}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};var Kh=class e extends on{constructor(t=1,n=1,i=1,s=32,a=1,r=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:n,height:i,radialSegments:s,heightSegments:a,openEnded:r,thetaStart:o,thetaLength:l};let c=this;s=Math.floor(s),a=Math.floor(a);let h=[],p=[],u=[],d=[],_=0,b=[],g=i/2,f=0;v(),r===!1&&(t>0&&S(!0),n>0&&S(!1)),this.setIndex(h),this.setAttribute("position",new xe(p,3)),this.setAttribute("normal",new xe(u,3)),this.setAttribute("uv",new xe(d,2));function v(){let y=new N,E=new N,A=0,w=(n-t)/i;for(let x=0;x<=a;x++){let T=[],R=x/a,D=R*(n-t)+t;for(let L=0;L<=s;L++){let k=L/s,X=k*l+o,z=Math.sin(X),G=Math.cos(X);E.x=D*z,E.y=-R*i+g,E.z=D*G,p.push(E.x,E.y,E.z),y.set(z,w,G).normalize(),u.push(y.x,y.y,y.z),d.push(k,1-R),T.push(_++)}b.push(T)}for(let x=0;x<s;x++)for(let T=0;T<a;T++){let R=b[T][x],D=b[T+1][x],L=b[T+1][x+1],k=b[T][x+1];(t>0||T!==0)&&(h.push(R,D,k),A+=3),(n>0||T!==a-1)&&(h.push(D,L,k),A+=3)}c.addGroup(f,A,0),f+=A}function S(y){let E=_,A=new Dt,w=new N,x=0,T=y===!0?t:n,R=y===!0?1:-1;for(let L=1;L<=s;L++)p.push(0,g*R,0),u.push(0,R,0),d.push(.5,.5),_++;let D=_;for(let L=0;L<=s;L++){let X=L/s*l+o,z=Math.cos(X),G=Math.sin(X);w.x=T*G,w.y=g*R,w.z=T*z,p.push(w.x,w.y,w.z),u.push(0,R,0),A.x=z*.5+.5,A.y=G*.5*R+.5,d.push(A.x,A.y),_++}for(let L=0;L<s;L++){let k=E+L,X=D+L;y===!0?h.push(X,X+1,k):h.push(X+1,X,k),x+=3}c.addGroup(f,x,y===!0?1:2),f+=x}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Yl=class e extends Kh{constructor(t=1,n=1,i=32,s=1,a=!1,r=0,o=Math.PI*2){super(0,t,n,i,s,a,r,o),this.type="ConeGeometry",this.parameters={radius:t,height:n,radialSegments:i,heightSegments:s,openEnded:a,thetaStart:r,thetaLength:o}}static fromJSON(t){return new e(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}};var bh=new N,Mh=new N,wg=new N,Eh=new xs,Zl=class extends on{constructor(t=null,n=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:t,thresholdAngle:n},t!==null){let s=Math.pow(10,4),a=Math.cos(Rh*n),r=t.getIndex(),o=t.getAttribute("position"),l=r?r.count:o.count,c=[0,0,0],h=["a","b","c"],p=new Array(3),u={},d=[];for(let _=0;_<l;_+=3){r?(c[0]=r.getX(_),c[1]=r.getX(_+1),c[2]=r.getX(_+2)):(c[0]=_,c[1]=_+1,c[2]=_+2);let{a:b,b:g,c:f}=Eh;if(b.fromBufferAttribute(o,c[0]),g.fromBufferAttribute(o,c[1]),f.fromBufferAttribute(o,c[2]),Eh.getNormal(wg),p[0]=`${Math.round(b.x*s)},${Math.round(b.y*s)},${Math.round(b.z*s)}`,p[1]=`${Math.round(g.x*s)},${Math.round(g.y*s)},${Math.round(g.z*s)}`,p[2]=`${Math.round(f.x*s)},${Math.round(f.y*s)},${Math.round(f.z*s)}`,!(p[0]===p[1]||p[1]===p[2]||p[2]===p[0]))for(let v=0;v<3;v++){let S=(v+1)%3,y=p[v],E=p[S],A=Eh[h[v]],w=Eh[h[S]],x=`${y}_${E}`,T=`${E}_${y}`;T in u&&u[T]?(wg.dot(u[T].normal)<=a&&(d.push(A.x,A.y,A.z),d.push(w.x,w.y,w.z)),u[T]=null):x in u||(u[x]={index0:c[v],index1:c[S],normal:wg.clone()})}}for(let _ in u)if(u[_]){let{index0:b,index1:g}=u[_];bh.fromBufferAttribute(o,b),Mh.fromBufferAttribute(o,g),d.push(bh.x,bh.y,bh.z),d.push(Mh.x,Mh.y,Mh.z)}this.setAttribute("position",new xe(d,3))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}},pi=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Ut("Curve: .getPoint() not implemented.")}getPointAt(t,n){let i=this.getUtoTmapping(t);return this.getPoint(i,n)}getPoints(t=5){let n=[];for(let i=0;i<=t;i++)n.push(this.getPoint(i/t));return n}getSpacedPoints(t=5){let n=[];for(let i=0;i<=t;i++)n.push(this.getPointAt(i/t));return n}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let n=[],i,s=this.getPoint(0),a=0;n.push(0);for(let r=1;r<=t;r++)i=this.getPoint(r/t),a+=i.distanceTo(s),n.push(a),s=i;return this.cacheArcLengths=n,n}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,n=null){let i=this.getLengths(),s=0,a=i.length,r;n?r=n:r=t*i[a-1];let o=0,l=a-1,c;for(;o<=l;)if(s=Math.floor(o+(l-o)/2),c=i[s]-r,c<0)o=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,i[s]===r)return s/(a-1);let h=i[s],u=i[s+1]-h,d=(r-h)/u;return(s+d)/(a-1)}getTangent(t,n){let s=t-1e-4,a=t+1e-4;s<0&&(s=0),a>1&&(a=1);let r=this.getPoint(s),o=this.getPoint(a),l=n||(r.isVector2?new Dt:new N);return l.copy(o).sub(r).normalize(),l}getTangentAt(t,n){let i=this.getUtoTmapping(t);return this.getTangent(i,n)}computeFrenetFrames(t,n=!1){let i=new N,s=[],a=[],r=[],o=new N,l=new De;for(let d=0;d<=t;d++){let _=d/t;s[d]=this.getTangentAt(_,new N)}a[0]=new N,r[0]=new N;let c=Number.MAX_VALUE,h=Math.abs(s[0].x),p=Math.abs(s[0].y),u=Math.abs(s[0].z);h<=c&&(c=h,i.set(1,0,0)),p<=c&&(c=p,i.set(0,1,0)),u<=c&&i.set(0,0,1),o.crossVectors(s[0],i).normalize(),a[0].crossVectors(s[0],o),r[0].crossVectors(s[0],a[0]);for(let d=1;d<=t;d++){if(a[d]=a[d-1].clone(),r[d]=r[d-1].clone(),o.crossVectors(s[d-1],s[d]),o.length()>Number.EPSILON){o.normalize();let _=Math.acos(Jt(s[d-1].dot(s[d]),-1,1));a[d].applyMatrix4(l.makeRotationAxis(o,_))}r[d].crossVectors(s[d],a[d])}if(n===!0){let d=Math.acos(Jt(a[0].dot(a[t]),-1,1));d/=t,s[0].dot(o.crossVectors(a[0],a[t]))>0&&(d=-d);for(let _=1;_<=t;_++)a[_].applyMatrix4(l.makeRotationAxis(s[_],d*_)),r[_].crossVectors(s[_],a[_])}return{tangents:s,normals:a,binormals:r}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},Jl=class extends pi{constructor(t=0,n=0,i=1,s=1,a=0,r=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=n,this.xRadius=i,this.yRadius=s,this.aStartAngle=a,this.aEndAngle=r,this.aClockwise=o,this.aRotation=l}getPoint(t,n=new Dt){let i=n,s=Math.PI*2,a=this.aEndAngle-this.aStartAngle,r=Math.abs(a)<Number.EPSILON;for(;a<0;)a+=s;for(;a>s;)a-=s;a<Number.EPSILON&&(r?a=0:a=s),this.aClockwise===!0&&!r&&(a===s?a=-s:a=a-s);let o=this.aStartAngle+t*a,l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),p=Math.sin(this.aRotation),u=l-this.aX,d=c-this.aY;l=u*h-d*p+this.aX,c=u*p+d*h+this.aY}return i.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},jh=class extends Jl{constructor(t,n,i,s,a,r){super(t,n,i,i,s,a,r),this.isArcCurve=!0,this.type="ArcCurve"}};function l0(){let e=0,t=0,n=0,i=0;function s(a,r,o,l){e=a,t=o,n=-3*a+3*r-2*o-l,i=2*a-2*r+o+l}return{initCatmullRom:function(a,r,o,l,c){s(r,o,c*(o-a),c*(l-r))},initNonuniformCatmullRom:function(a,r,o,l,c,h,p){let u=(r-a)/c-(o-a)/(c+h)+(o-r)/h,d=(o-r)/h-(l-r)/(h+p)+(l-o)/p;u*=h,d*=h,s(r,o,u,d)},calc:function(a){let r=a*a,o=r*a;return e+t*a+n*r+i*o}}}var KS=new N,jS=new N,Cg=new l0,Rg=new l0,Dg=new l0,mo=class extends pi{constructor(t=[],n=!1,i="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=n,this.curveType=i,this.tension=s}getPoint(t,n=new N){let i=n,s=this.points,a=s.length,r=(a-(this.closed?0:1))*t,o=Math.floor(r),l=r-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/a)+1)*a:l===0&&o===a-1&&(o=a-2,l=1);let c,h;this.closed||o>0?c=s[(o-1)%a]:(jS.subVectors(s[0],s[1]).add(s[0]),c=jS);let p=s[o%a],u=s[(o+1)%a];if(this.closed||o+2<a?h=s[(o+2)%a]:(KS.subVectors(s[a-1],s[a-2]).add(s[a-1]),h=KS),this.curveType==="centripetal"||this.curveType==="chordal"){let d=this.curveType==="chordal"?.5:.25,_=Math.pow(c.distanceToSquared(p),d),b=Math.pow(p.distanceToSquared(u),d),g=Math.pow(u.distanceToSquared(h),d);b<1e-4&&(b=1),_<1e-4&&(_=b),g<1e-4&&(g=b),Cg.initNonuniformCatmullRom(c.x,p.x,u.x,h.x,_,b,g),Rg.initNonuniformCatmullRom(c.y,p.y,u.y,h.y,_,b,g),Dg.initNonuniformCatmullRom(c.z,p.z,u.z,h.z,_,b,g)}else this.curveType==="catmullrom"&&(Cg.initCatmullRom(c.x,p.x,u.x,h.x,this.tension),Rg.initCatmullRom(c.y,p.y,u.y,h.y,this.tension),Dg.initCatmullRom(c.z,p.z,u.z,h.z,this.tension));return i.set(Cg.calc(l),Rg.calc(l),Dg.calc(l)),i}copy(t){super.copy(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let n=0,i=this.points.length;n<i;n++){let s=this.points[n];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(new N().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function QS(e,t,n,i,s){let a=(i-t)*.5,r=(s-n)*.5,o=e*e,l=e*o;return(2*n-2*i+a+r)*l+(-3*n+3*i-2*a-r)*o+a*e+n}function QT(e,t){let n=1-e;return n*n*t}function $T(e,t){return 2*(1-e)*e*t}function tA(e,t){return e*e*t}function Ul(e,t,n,i){return QT(e,t)+$T(e,n)+tA(e,i)}function eA(e,t){let n=1-e;return n*n*n*t}function nA(e,t){let n=1-e;return 3*n*n*e*t}function iA(e,t){return 3*(1-e)*e*e*t}function sA(e,t){return e*e*e*t}function Nl(e,t,n,i,s){return eA(e,t)+nA(e,n)+iA(e,i)+sA(e,s)}var Qh=class extends pi{constructor(t=new Dt,n=new Dt,i=new Dt,s=new Dt){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=n,this.v2=i,this.v3=s}getPoint(t,n=new Dt){let i=n,s=this.v0,a=this.v1,r=this.v2,o=this.v3;return i.set(Nl(t,s.x,a.x,r.x,o.x),Nl(t,s.y,a.y,r.y,o.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},$h=class extends pi{constructor(t=new N,n=new N,i=new N,s=new N){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=n,this.v2=i,this.v3=s}getPoint(t,n=new N){let i=n,s=this.v0,a=this.v1,r=this.v2,o=this.v3;return i.set(Nl(t,s.x,a.x,r.x,o.x),Nl(t,s.y,a.y,r.y,o.y),Nl(t,s.z,a.z,r.z,o.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},tf=class extends pi{constructor(t=new Dt,n=new Dt){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=n}getPoint(t,n=new Dt){let i=n;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,n){return this.getPoint(t,n)}getTangent(t,n=new Dt){return n.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,n){return this.getTangent(t,n)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},ef=class extends pi{constructor(t=new N,n=new N){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=n}getPoint(t,n=new N){let i=n;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,n){return this.getPoint(t,n)}getTangent(t,n=new N){return n.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,n){return this.getTangent(t,n)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},nf=class extends pi{constructor(t=new Dt,n=new Dt,i=new Dt){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=n,this.v2=i}getPoint(t,n=new Dt){let i=n,s=this.v0,a=this.v1,r=this.v2;return i.set(Ul(t,s.x,a.x,r.x),Ul(t,s.y,a.y,r.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Kl=class extends pi{constructor(t=new N,n=new N,i=new N){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=n,this.v2=i}getPoint(t,n=new N){let i=n,s=this.v0,a=this.v1,r=this.v2;return i.set(Ul(t,s.x,a.x,r.x),Ul(t,s.y,a.y,r.y),Ul(t,s.z,a.z,r.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},sf=class extends pi{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,n=new Dt){let i=n,s=this.points,a=(s.length-1)*t,r=Math.floor(a),o=a-r,l=s[r===0?r:r-1],c=s[r],h=s[r>s.length-2?s.length-1:r+1],p=s[r>s.length-3?s.length-1:r+2];return i.set(QS(o,l.x,c.x,h.x,p.x),QS(o,l.y,c.y,h.y,p.y)),i}copy(t){super.copy(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let n=0,i=this.points.length;n<i;n++){let s=this.points[n];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(new Dt().fromArray(s))}return this}},aA=Object.freeze({__proto__:null,ArcCurve:jh,CatmullRomCurve3:mo,CubicBezierCurve:Qh,CubicBezierCurve3:$h,EllipseCurve:Jl,LineCurve:tf,LineCurve3:ef,QuadraticBezierCurve:nf,QuadraticBezierCurve3:Kl,SplineCurve:sf});var da=class e extends on{constructor(t=1,n=1,i=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:n,widthSegments:i,heightSegments:s};let a=t/2,r=n/2,o=Math.floor(i),l=Math.floor(s),c=o+1,h=l+1,p=t/o,u=n/l,d=[],_=[],b=[],g=[];for(let f=0;f<h;f++){let v=f*u-r;for(let S=0;S<c;S++){let y=S*p-a;_.push(y,-v,0),b.push(0,0,1),g.push(S/o),g.push(1-f/l)}}for(let f=0;f<l;f++)for(let v=0;v<o;v++){let S=v+c*f,y=v+c*(f+1),E=v+1+c*(f+1),A=v+1+c*f;d.push(S,y,A),d.push(y,E,A)}this.setIndex(d),this.setAttribute("position",new xe(_,3)),this.setAttribute("normal",new xe(b,3)),this.setAttribute("uv",new xe(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}};var go=class e extends on{constructor(t=1,n=32,i=16,s=0,a=Math.PI*2,r=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:n,heightSegments:i,phiStart:s,phiLength:a,thetaStart:r,thetaLength:o},n=Math.max(3,Math.floor(n)),i=Math.max(2,Math.floor(i));let l=Math.min(r+o,Math.PI),c=0,h=[],p=new N,u=new N,d=[],_=[],b=[],g=[];for(let f=0;f<=i;f++){let v=[],S=f/i,y=r+S*o,E=t*Math.cos(y),A=Math.sqrt(t*t-E*E),w=0;f===0&&r===0?w=.5/n:f===i&&l===Math.PI&&(w=-.5/n);for(let x=0;x<=n;x++){let T=x/n,R=s+T*a;p.x=-A*Math.cos(R),p.y=E,p.z=A*Math.sin(R),_.push(p.x,p.y,p.z),u.copy(p).normalize(),b.push(u.x,u.y,u.z),g.push(T+w,1-S),v.push(c++)}h.push(v)}for(let f=0;f<i;f++)for(let v=0;v<n;v++){let S=h[f][v+1],y=h[f][v],E=h[f+1][v],A=h[f+1][v+1];(f!==0||r>0)&&d.push(S,y,A),(f!==i-1||l<Math.PI)&&d.push(y,E,A)}this.setIndex(d),this.setAttribute("position",new xe(_,3)),this.setAttribute("normal",new xe(b,3)),this.setAttribute("uv",new xe(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};var jl=class e extends on{constructor(t=new Kl(new N(-1,-1,0),new N(-1,1,0),new N(1,1,0)),n=64,i=1,s=8,a=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:n,radius:i,radialSegments:s,closed:a};let r=t.computeFrenetFrames(n,a);this.tangents=r.tangents,this.normals=r.normals,this.binormals=r.binormals;let o=new N,l=new N,c=new Dt,h=new N,p=[],u=[],d=[],_=[];b(),this.setIndex(_),this.setAttribute("position",new xe(p,3)),this.setAttribute("normal",new xe(u,3)),this.setAttribute("uv",new xe(d,2));function b(){for(let S=0;S<n;S++)g(S);g(a===!1?n:0),v(),f()}function g(S){h=t.getPointAt(S/n,h);let y=r.normals[S],E=r.binormals[S];for(let A=0;A<=s;A++){let w=A/s*Math.PI*2,x=Math.sin(w),T=-Math.cos(w);l.x=T*y.x+x*E.x,l.y=T*y.y+x*E.y,l.z=T*y.z+x*E.z,l.normalize(),u.push(l.x,l.y,l.z),o.x=h.x+i*l.x,o.y=h.y+i*l.y,o.z=h.z+i*l.z,p.push(o.x,o.y,o.z)}}function f(){for(let S=1;S<=n;S++)for(let y=1;y<=s;y++){let E=(s+1)*(S-1)+(y-1),A=(s+1)*S+(y-1),w=(s+1)*S+y,x=(s+1)*(S-1)+y;_.push(E,A,x),_.push(A,w,x)}}function v(){for(let S=0;S<=n;S++)for(let y=0;y<=s;y++)c.x=S/n,c.y=y/s,d.push(c.x,c.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new e(new aA[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}};function $a(e){let t={};for(let n in e){t[n]={};for(let i in e[n]){let s=e[n][i];if($S(s))s.isRenderTargetTexture?(Ut("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[n][i]=null):t[n][i]=s.clone();else if(Array.isArray(s))if($S(s[0])){let a=[];for(let r=0,o=s.length;r<o;r++)a[r]=s[r].clone();t[n][i]=a}else t[n][i]=s.slice();else t[n][i]=s}}return t}function Sn(e){let t={};for(let n=0;n<e.length;n++){let i=$a(e[n]);for(let s in i)t[s]=i[s]}return t}function $S(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function rA(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function c0(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:$t.workingColorSpace}var Fb={clone:$a,merge:Sn},oA=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,lA=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,jn=class extends ha{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=oA,this.fragmentShader=lA,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=$a(t.uniforms),this.uniformsGroups=rA(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let n=super.toJSON(t);n.glslVersion=this.glslVersion,n.uniforms={};for(let s in this.uniforms){let r=this.uniforms[s].value;r&&r.isTexture?n.uniforms[s]={type:"t",value:r.toJSON(t).uuid}:r&&r.isColor?n.uniforms[s]={type:"c",value:r.getHex()}:r&&r.isVector2?n.uniforms[s]={type:"v2",value:r.toArray()}:r&&r.isVector3?n.uniforms[s]={type:"v3",value:r.toArray()}:r&&r.isVector4?n.uniforms[s]={type:"v4",value:r.toArray()}:r&&r.isMatrix3?n.uniforms[s]={type:"m3",value:r.toArray()}:r&&r.isMatrix4?n.uniforms[s]={type:"m4",value:r.toArray()}:n.uniforms[s]={value:r}}Object.keys(this.defines).length>0&&(n.defines=this.defines),n.vertexShader=this.vertexShader,n.fragmentShader=this.fragmentShader,n.lights=this.lights,n.clipping=this.clipping;let i={};for(let s in this.extensions)this.extensions[s]===!0&&(i[s]=!0);return Object.keys(i).length>0&&(n.extensions=i),n}fromJSON(t,n){if(super.fromJSON(t,n),t.uniforms!==void 0)for(let i in t.uniforms){let s=t.uniforms[i];switch(this.uniforms[i]={},s.type){case"t":this.uniforms[i].value=n[s.value]||null;break;case"c":this.uniforms[i].value=new te().setHex(s.value);break;case"v2":this.uniforms[i].value=new Dt().fromArray(s.value);break;case"v3":this.uniforms[i].value=new N().fromArray(s.value);break;case"v4":this.uniforms[i].value=new Ue().fromArray(s.value);break;case"m3":this.uniforms[i].value=new Pt().fromArray(s.value);break;case"m4":this.uniforms[i].value=new De().fromArray(s.value);break;default:this.uniforms[i].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let i in t.extensions)this.extensions[i]=t.extensions[i];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},af=class extends jn{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}};var rf=class extends ha{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Ab,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},of=class extends ha{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};var Ql=class extends fa{constructor(t){super(),this.isLineDashedMaterial=!0,this.type="LineDashedMaterial",this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(t)}copy(t){return super.copy(t),this.scale=t.scale,this.dashSize=t.dashSize,this.gapSize=t.gapSize,this}};function Th(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT=="number"?new t(e):Array.prototype.slice.call(e)}var pa=class{constructor(t,n,i,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new n.constructor(i),this.sampleValues=n,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(t){let n=this.parameterPositions,i=this._cachedIndex,s=n[i],a=n[i-1];t:{e:{let r;n:{i:if(!(t<s)){for(let o=i+2;;){if(s===void 0){if(t<a)break i;return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===o)break;if(a=s,s=n[++i],t<s)break e}r=n.length;break n}if(!(t>=a)){let o=n[1];t<o&&(i=2,a=o);for(let l=i-2;;){if(a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(s=a,a=n[--i-1],t>=a)break e}r=i,i=0;break n}break t}for(;i<r;){let o=i+r>>>1;t<n[o]?r=o:i=o+1}if(s=n[i],a=n[i-1],a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,a,s)}return this.interpolate_(i,a,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let n=this.resultBuffer,i=this.sampleValues,s=this.valueSize,a=t*s;for(let r=0;r!==s;++r)n[r]=i[a+r];return n}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},lf=class extends pa{constructor(t,n,i,s){super(t,n,i,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Ng,endingEnd:Ng}}intervalChanged_(t,n,i){let s=this.parameterPositions,a=t-2,r=t+1,o=s[a],l=s[r];if(o===void 0)switch(this.getSettings_().endingStart){case Lg:a=t,o=2*n-i;break;case Ig:a=s.length-2,o=n+s[a]-s[a+1];break;default:a=t,o=i}if(l===void 0)switch(this.getSettings_().endingEnd){case Lg:r=t,l=2*i-n;break;case Ig:r=1,l=i+s[1]-s[0];break;default:r=t-1,l=n}let c=(i-n)*.5,h=this.valueSize;this._weightPrev=c/(n-o),this._weightNext=c/(l-i),this._offsetPrev=a*h,this._offsetNext=r*h}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this._offsetPrev,p=this._offsetNext,u=this._weightPrev,d=this._weightNext,_=(i-n)/(s-n),b=_*_,g=b*_,f=-u*g+2*u*b-u*_,v=(1+u)*g+(-1.5-2*u)*b+(-.5+u)*_+1,S=(-1-d)*g+(1.5+d)*b+.5*_,y=d*g-d*b;for(let E=0;E!==o;++E)a[E]=f*r[h+E]+v*r[c+E]+S*r[l+E]+y*r[p+E];return a}},cf=class extends pa{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=(i-n)/(s-n),p=1-h;for(let u=0;u!==o;++u)a[u]=r[c+u]*p+r[l+u]*h;return a}},uf=class extends pa{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t){return this.copySampleValue_(t-1)}},hf=class extends pa{interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this.inTangents,p=this.outTangents;if(!h||!p){let _=(i-n)/(s-n),b=1-_;for(let g=0;g!==o;++g)a[g]=r[c+g]*b+r[l+g]*_;return a}let u=o*2,d=t-1;for(let _=0;_!==o;++_){let b=r[c+_],g=r[l+_],f=d*u+_*2,v=p[f],S=p[f+1],y=t*u+_*2,E=h[y],A=h[y+1],w=(i-n)/(s-n),x,T,R,D,L;for(let k=0;k<8;k++){x=w*w,T=x*w,R=1-w,D=R*R,L=D*R;let z=L*n+3*D*w*v+3*R*x*E+T*s-i;if(Math.abs(z)<1e-10)break;let G=3*D*(v-n)+6*R*w*(E-v)+3*x*(s-E);if(Math.abs(G)<1e-10)break;w=w-z/G,w=Math.max(0,Math.min(1,w))}a[_]=L*b+3*D*w*S+3*R*x*A+T*g}return a}},Qn=class{constructor(t,n,i,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(n===void 0||n.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=Th(n,this.TimeBufferType),this.values=Th(i,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let n=t.constructor,i;if(n.toJSON!==this.toJSON)i=n.toJSON(t);else{i={name:t.name,times:Th(t.times,Array),values:Th(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(i.interpolation=s)}return i.type=t.ValueTypeName,i}InterpolantFactoryMethodDiscrete(t){return new uf(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new cf(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new lf(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let n=new hf(this.times,this.values,this.getValueSize(),t);return this.settings&&(n.inTangents=this.settings.inTangents,n.outTangents=this.settings.outTangents),n}setInterpolation(t){let n;switch(t){case Ll:n=this.InterpolantFactoryMethodDiscrete;break;case Hh:n=this.InterpolantFactoryMethodLinear;break;case Ch:n=this.InterpolantFactoryMethodSmooth;break;case Ug:n=this.InterpolantFactoryMethodBezier;break}if(n===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return Ut("KeyframeTrack:",i),this}return this.createInterpolant=n,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Ll;case this.InterpolantFactoryMethodLinear:return Hh;case this.InterpolantFactoryMethodSmooth:return Ch;case this.InterpolantFactoryMethodBezier:return Ug}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let n=this.times;for(let i=0,s=n.length;i!==s;++i)n[i]+=t}return this}scale(t){if(t!==1){let n=this.times;for(let i=0,s=n.length;i!==s;++i)n[i]*=t}return this}trim(t,n){let i=this.times,s=i.length,a=0,r=s-1;for(;a!==s&&i[a]<t;)++a;for(;r!==-1&&i[r]>n;)--r;if(++r,a!==0||r!==s){a>=r&&(r=Math.max(r,1),a=r-1);let o=this.getValueSize();this.times=i.slice(a,r),this.values=this.values.slice(a*o,r*o)}return this}validate(){let t=!0,n=this.getValueSize();n-Math.floor(n)!==0&&(Lt("KeyframeTrack: Invalid value size in track.",this),t=!1);let i=this.times,s=this.values,a=i.length;a===0&&(Lt("KeyframeTrack: Track is empty.",this),t=!1);let r=null;for(let o=0;o!==a;o++){let l=i[o];if(typeof l=="number"&&isNaN(l)){Lt("KeyframeTrack: Time is not a valid number.",this,o,l),t=!1;break}if(r!==null&&r>l){Lt("KeyframeTrack: Out of order keys.",this,o,l,r),t=!1;break}r=l}if(s!==void 0&&NT(s))for(let o=0,l=s.length;o!==l;++o){let c=s[o];if(isNaN(c)){Lt("KeyframeTrack: Value is not a valid number.",this,o,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),n=this.values.slice(),i=this.getValueSize(),s=this.getInterpolation()===Ch,a=t.length-1,r=1;for(let o=1;o<a;++o){let l=!1,c=t[o],h=t[o+1];if(c!==h&&(o!==1||c!==t[0]))if(s)l=!0;else{let p=o*i,u=p-i,d=p+i;for(let _=0;_!==i;++_){let b=n[p+_];if(b!==n[u+_]||b!==n[d+_]){l=!0;break}}}if(l){if(o!==r){t[r]=t[o];let p=o*i,u=r*i;for(let d=0;d!==i;++d)n[u+d]=n[p+d]}++r}}if(a>0){t[r]=t[a];for(let o=a*i,l=r*i,c=0;c!==i;++c)n[l+c]=n[o+c];++r}return r!==t.length?(this.times=t.slice(0,r),this.values=n.slice(0,r*i)):(this.times=t,this.values=n),this}clone(){let t=this.times.slice(),n=this.values.slice(),i=this.constructor,s=new i(this.name,t,n);return s.createInterpolant=this.createInterpolant,s}};Qn.prototype.ValueTypeName="";Qn.prototype.TimeBufferType=Float32Array;Qn.prototype.ValueBufferType=Float32Array;Qn.prototype.DefaultInterpolation=Hh;var ma=class extends Qn{constructor(t,n,i){super(t,n,i)}};ma.prototype.ValueTypeName="bool";ma.prototype.ValueBufferType=Array;ma.prototype.DefaultInterpolation=Ll;ma.prototype.InterpolantFactoryMethodLinear=void 0;ma.prototype.InterpolantFactoryMethodSmooth=void 0;var ff=class extends Qn{constructor(t,n,i,s){super(t,n,i,s)}};ff.prototype.ValueTypeName="color";var df=class extends Qn{constructor(t,n,i,s){super(t,n,i,s)}};df.prototype.ValueTypeName="number";var pf=class extends pa{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=(i-n)/(s-n),c=t*o;for(let h=c+o;c!==h;c+=4)ki.slerpFlat(a,0,r,c-o,r,c,l);return a}},$l=class extends Qn{constructor(t,n,i,s){super(t,n,i,s)}InterpolantFactoryMethodLinear(t){return new pf(this.times,this.values,this.getValueSize(),t)}};$l.prototype.ValueTypeName="quaternion";$l.prototype.InterpolantFactoryMethodSmooth=void 0;var ga=class extends Qn{constructor(t,n,i){super(t,n,i)}};ga.prototype.ValueTypeName="string";ga.prototype.ValueBufferType=Array;ga.prototype.DefaultInterpolation=Ll;ga.prototype.InterpolantFactoryMethodLinear=void 0;ga.prototype.InterpolantFactoryMethodSmooth=void 0;var mf=class extends Qn{constructor(t,n,i,s){super(t,n,i,s)}};mf.prototype.ValueTypeName="vector";var gf=class{constructor(t,n,i){let s=this,a=!1,r=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=n,this.onError=i,this._abortController=null,this.itemStart=function(h){o++,a===!1&&s.onStart!==void 0&&s.onStart(h,r,o),a=!0},this.itemEnd=function(h){r++,s.onProgress!==void 0&&s.onProgress(h,r,o),r===o&&(a=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,p){return c.push(h,p),this},this.removeHandler=function(h){let p=c.indexOf(h);return p!==-1&&c.splice(p,2),this},this.getHandler=function(h){for(let p=0,u=c.length;p<u;p+=2){let d=c[p],_=c[p+1];if(d.global&&(d.lastIndex=0),d.test(h))return _}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Vb=new gf,_f=class{constructor(t){this.manager=t!==void 0?t:Vb,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,n){let i=this;return new Promise(function(s,a){i.load(t,s,n,a)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};_f.DEFAULT_MATERIAL_NAME="__DEFAULT";var Ah=new N,wh=new ki,zi=new N,tc=class extends Kn{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new De,this.projectionMatrix=new De,this.projectionMatrixInverse=new De,this.coordinateSystem=bi,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,n){return super.copy(t,n),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(Ah,wh,zi),zi.x===1&&zi.y===1&&zi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ah,wh,zi.set(1,1,1)).invert()}updateWorldMatrix(t,n,i=!1){super.updateWorldMatrix(t,n,i),this.matrixWorld.decompose(Ah,wh,zi),zi.x===1&&zi.y===1&&zi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ah,wh,zi.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},oa=new N,tb=new Dt,eb=new Dt,yn=class extends tc{constructor(t=50,n=1,i=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=i,this.far=s,this.focus=10,this.aspect=n,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,n){return super.copy(t,n),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let n=.5*this.getFilmHeight()/t;this.fov=Gh*2*Math.atan(n),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(Rh*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Gh*2*Math.atan(Math.tan(Rh*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,n,i){oa.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(oa.x,oa.y).multiplyScalar(-t/oa.z),oa.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(oa.x,oa.y).multiplyScalar(-t/oa.z)}getViewSize(t,n){return this.getViewBounds(t,tb,eb),n.subVectors(eb,tb)}setViewOffset(t,n,i,s,a,r){this.aspect=t/n,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=n,this.view.offsetX=i,this.view.offsetY=s,this.view.width=a,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,n=t*Math.tan(Rh*.5*this.fov)/this.zoom,i=2*n,s=this.aspect*i,a=-.5*s,r=this.view;if(this.view!==null&&this.view.enabled){let l=r.fullWidth,c=r.fullHeight;a+=r.offsetX*s/l,n-=r.offsetY*i/c,s*=r.width/l,i*=r.height/c}let o=this.filmOffset;o!==0&&(a+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(a,a+s,n,n-i,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let n=super.toJSON(t);return n.object.fov=this.fov,n.object.zoom=this.zoom,n.object.near=this.near,n.object.far=this.far,n.object.focus=this.focus,n.object.aspect=this.aspect,this.view!==null&&(n.object.view=Object.assign({},this.view)),n.object.filmGauge=this.filmGauge,n.object.filmOffset=this.filmOffset,n}};var ec=class extends tc{constructor(t=-1,n=1,i=1,s=-1,a=.1,r=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=n,this.top=i,this.bottom=s,this.near=a,this.far=r,this.updateProjectionMatrix()}copy(t,n){return super.copy(t,n),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,n,i,s,a,r){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=n,this.view.offsetX=i,this.view.offsetY=s,this.view.width=a,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),n=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,s=(this.top+this.bottom)/2,a=i-t,r=i+t,o=s+n,l=s-n;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;a+=c*this.view.offsetX,r=a+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(a,r,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let n=super.toJSON(t);return n.object.zoom=this.zoom,n.object.left=this.left,n.object.right=this.right,n.object.top=this.top,n.object.bottom=this.bottom,n.object.near=this.near,n.object.far=this.far,this.view!==null&&(n.object.view=Object.assign({},this.view)),n}};var ao=-90,ro=1,vf=class extends Kn{constructor(t,n,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new yn(ao,ro,t,n);s.layers=this.layers,this.add(s);let a=new yn(ao,ro,t,n);a.layers=this.layers,this.add(a);let r=new yn(ao,ro,t,n);r.layers=this.layers,this.add(r);let o=new yn(ao,ro,t,n);o.layers=this.layers,this.add(o);let l=new yn(ao,ro,t,n);l.layers=this.layers,this.add(l);let c=new yn(ao,ro,t,n);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,n=this.children.concat(),[i,s,a,r,o,l]=n;for(let c of n)this.remove(c);if(t===bi)i.up.set(0,1,0),i.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),a.up.set(0,0,-1),a.lookAt(0,1,0),r.up.set(0,0,1),r.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===Pl)i.up.set(0,-1,0),i.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),a.up.set(0,0,1),a.lookAt(0,1,0),r.up.set(0,0,-1),r.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of n)this.add(c),c.updateMatrixWorld()}update(t,n){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[a,r,o,l,c,h]=this.children,p=t.getRenderTarget(),u=t.getActiveCubeFace(),d=t.getActiveMipmapLevel(),_=t.xr.enabled;t.xr.enabled=!1;let b=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let g=!1;t.isWebGLRenderer===!0?g=t.state.buffers.depth.getReversed():g=t.reversedDepthBuffer,t.setRenderTarget(i,0,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,a),t.setRenderTarget(i,1,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,r),t.setRenderTarget(i,2,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,o),t.setRenderTarget(i,3,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,l),t.setRenderTarget(i,4,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,c),i.texture.generateMipmaps=b,t.setRenderTarget(i,5,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,h),t.setRenderTarget(p,u,d),t.xr.enabled=_,i.texture.needsPMREMUpdate=!0}},yf=class extends yn{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}};var u0="\\[\\]\\.:\\/",cA=new RegExp("["+u0+"]","g"),h0="[^"+u0+"]",uA="[^"+u0.replace("\\.","")+"]",hA=/((?:WC+[\/:])*)/.source.replace("WC",h0),fA=/(WCOD+)?/.source.replace("WCOD",uA),dA=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",h0),pA=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",h0),mA=new RegExp("^"+hA+fA+dA+pA+"$"),gA=["material","materials","bones","map"],zg=class{constructor(t,n,i){let s=i||Te.parseTrackName(n);this._targetGroup=t,this._bindings=t.subscribe_(n,s)}getValue(t,n){this.bind();let i=this._targetGroup.nCachedObjects_,s=this._bindings[i];s!==void 0&&s.getValue(t,n)}setValue(t,n){let i=this._bindings;for(let s=this._targetGroup.nCachedObjects_,a=i.length;s!==a;++s)i[s].setValue(t,n)}bind(){let t=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=t.length;n!==i;++n)t[n].bind()}unbind(){let t=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=t.length;n!==i;++n)t[n].unbind()}},Te=class e{constructor(t,n,i){this.path=n,this.parsedPath=i||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,i){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,i):new e(t,n,i)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(cA,"")}static parseTrackName(t){let n=mA.exec(t);if(n===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let i={nodeName:n[2],objectName:n[3],objectIndex:n[4],propertyName:n[5],propertyIndex:n[6]},s=i.nodeName&&i.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let a=i.nodeName.substring(s+1);gA.indexOf(a)!==-1&&(i.nodeName=i.nodeName.substring(0,s),i.objectName=a)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return i}static findNode(t,n){if(n===void 0||n===""||n==="."||n===-1||n===t.name||n===t.uuid)return t;if(t.skeleton){let i=t.skeleton.getBoneByName(n);if(i!==void 0)return i}if(t.children){let i=function(a){for(let r=0;r<a.length;r++){let o=a[r];if(o.name===n||o.uuid===n)return o;let l=i(o.children);if(l)return l}return null},s=i(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,n){t[n]=this.targetObject[this.propertyName]}_getValue_array(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)t[n++]=i[s]}_getValue_arrayElement(t,n){t[n]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,n){this.resolvedProperty.toArray(t,n)}_setValue_direct(t,n){this.targetObject[this.propertyName]=t[n]}_setValue_direct_setNeedsUpdate(t,n){this.targetObject[this.propertyName]=t[n],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,n){this.targetObject[this.propertyName]=t[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++]}_setValue_array_setNeedsUpdate(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,n){this.resolvedProperty[this.propertyIndex]=t[n]}_setValue_arrayElement_setNeedsUpdate(t,n){this.resolvedProperty[this.propertyIndex]=t[n],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,n){this.resolvedProperty[this.propertyIndex]=t[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,n){this.resolvedProperty.fromArray(t,n)}_setValue_fromArray_setNeedsUpdate(t,n){this.resolvedProperty.fromArray(t,n),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,n){this.resolvedProperty.fromArray(t,n),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,n){this.bind(),this.getValue(t,n)}_setValue_unbound(t,n){this.bind(),this.setValue(t,n)}bind(){let t=this.node,n=this.parsedPath,i=n.objectName,s=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Ut("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=n.objectIndex;switch(i){case"materials":if(!t.material){Lt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){Lt("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){Lt("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){Lt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){Lt("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[i]===void 0){Lt("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[i]}if(c!==void 0){if(t[c]===void 0){Lt("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let r=t[s];if(r===void 0){let c=n.nodeName;Lt("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?o=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(a!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){Lt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){Lt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}l=this.BindingType.ArrayElement,this.resolvedProperty=r,this.propertyIndex=a}else r.fromArray!==void 0&&r.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=r):Array.isArray(r)?(l=this.BindingType.EntireArray,this.resolvedProperty=r):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Te.Composite=zg;Te.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Te.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Te.prototype.GetterByBindingType=[Te.prototype._getValue_direct,Te.prototype._getValue_array,Te.prototype._getValue_arrayElement,Te.prototype._getValue_toArray];Te.prototype.SetterByBindingTypeAndVersioning=[[Te.prototype._setValue_direct,Te.prototype._setValue_direct_setNeedsUpdate,Te.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Te.prototype._setValue_array,Te.prototype._setValue_array_setNeedsUpdate,Te.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Te.prototype._setValue_arrayElement,Te.prototype._setValue_arrayElement_setNeedsUpdate,Te.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Te.prototype._setValue_fromArray,Te.prototype._setValue_fromArray_setNeedsUpdate,Te.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var R3=new Float32Array(1);var Bg=class e{static{e.prototype.isMatrix2=!0}constructor(t,n,i,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,n,i,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,n=0){for(let i=0;i<4;i++)this.elements[i]=t[i+n];return this}set(t,n,i,s){let a=this.elements;return a[0]=t,a[2]=n,a[1]=i,a[3]=s,this}};var nc=class extends fo{constructor(t=10,n=10,i=4473924,s=8947848){i=new te(i),s=new te(s);let a=n/2,r=t/n,o=t/2,l=[],c=[];for(let u=0,d=0,_=-o;u<=n;u++,_+=r){l.push(-o,0,_,o,0,_),l.push(_,0,-o,_,0,o);let b=u===a?i:s;b.toArray(c,d),d+=3,b.toArray(c,d),d+=3,b.toArray(c,d),d+=3,b.toArray(c,d),d+=3}let h=new on;h.setAttribute("position",new xe(l,3)),h.setAttribute("color",new xe(c,3));let p=new fa({vertexColors:!0,toneMapped:!1});super(h,p),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}};function f0(e,t,n,i){let s=_A(i);switch(n){case n0:return e*t;case s0:return e*t/s.components*s.byteLength;case wf:return e*t/s.components*s.byteLength;case xa:return e*t*2/s.components*s.byteLength;case Cf:return e*t*2/s.components*s.byteLength;case i0:return e*t*3/s.components*s.byteLength;case mi:return e*t*4/s.components*s.byteLength;case Rf:return e*t*4/s.components*s.byteLength;case rc:case oc:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case lc:case cc:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Uf:case Lf:return Math.max(e,16)*Math.max(t,8)/4;case Df:case Nf:return Math.max(e,8)*Math.max(t,8)/2;case If:case Of:case zf:case Bf:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case Pf:case uc:case Ff:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Vf:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Hf:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case Gf:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case kf:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case Xf:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case Wf:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case qf:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case Yf:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case Zf:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case Jf:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case Kf:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case jf:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case Qf:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case $f:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case td:case ed:case nd:return Math.ceil(e/4)*Math.ceil(t/4)*16;case id:case sd:return Math.ceil(e/4)*Math.ceil(t/4)*8;case hc:case ad:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${n} format.`)}function _A(e){switch(e){case $n:case Qg:return{byteLength:1,components:1};case vo:case $g:case qi:return{byteLength:2,components:1};case Tf:case Af:return{byteLength:2,components:4};case Ei:case Ef:case Ti:return{byteLength:4,components:1};case t0:case e0:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:xf}}));typeof window<"u"&&(window.__THREE__?Ut("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=xf);function cM(){let e=null,t=!1,n=null,i=null;function s(a,r){n(a,r),i=e.requestAnimationFrame(s)}return{start:function(){t!==!0&&n!==null&&e!==null&&(i=e.requestAnimationFrame(s),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(i),t=!1},setAnimationLoop:function(a){n=a},setContext:function(a){e=a}}}function vA(e){let t=new WeakMap;function n(o,l){let c=o.array,h=o.usage,p=c.byteLength,u=e.createBuffer();e.bindBuffer(l,u),e.bufferData(l,c,h),o.onUploadCallback();let d;if(c instanceof Float32Array)d=e.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)d=e.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?d=e.HALF_FLOAT:d=e.UNSIGNED_SHORT;else if(c instanceof Int16Array)d=e.SHORT;else if(c instanceof Uint32Array)d=e.UNSIGNED_INT;else if(c instanceof Int32Array)d=e.INT;else if(c instanceof Int8Array)d=e.BYTE;else if(c instanceof Uint8Array)d=e.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)d=e.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:d,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:p}}function i(o,l,c){let h=l.array,p=l.updateRanges;if(e.bindBuffer(c,o),p.length===0)e.bufferSubData(c,0,h);else{p.sort((d,_)=>d.start-_.start);let u=0;for(let d=1;d<p.length;d++){let _=p[u],b=p[d];b.start<=_.start+_.count+1?_.count=Math.max(_.count,b.start+b.count-_.start):(++u,p[u]=b)}p.length=u+1;for(let d=0,_=p.length;d<_;d++){let b=p[d];e.bufferSubData(c,b.start*h.BYTES_PER_ELEMENT,h,b.start,b.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function a(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=t.get(o);l&&(e.deleteBuffer(l.buffer),t.delete(o))}function r(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=t.get(o);if(c===void 0)t.set(o,n(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:s,remove:a,update:r}}var yA=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,xA=`#ifdef USE_ALPHAHASH
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
#endif`,SA=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,bA=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,MA=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,EA=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,TA=`#ifdef USE_AOMAP
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
#endif`,AA=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,wA=`#ifdef USE_BATCHING
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
#endif`,CA=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,RA=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,DA=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,UA=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,NA=`#ifdef USE_IRIDESCENCE
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
#endif`,LA=`#ifdef USE_BUMPMAP
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
#endif`,IA=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,OA=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,PA=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,zA=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,BA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,FA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,VA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,HA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,GA=`#define PI 3.141592653589793
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
} // validated`,kA=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,XA=`vec3 transformedNormal = objectNormal;
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
#endif`,WA=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,qA=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,YA=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,ZA=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,JA="gl_FragColor = linearToOutputTexel( gl_FragColor );",KA=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,jA=`#ifdef USE_ENVMAP
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
#endif`,QA=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,$A=`#ifdef USE_ENVMAP
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
#endif`,tw=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,ew=`#ifdef USE_ENVMAP
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
#endif`,nw=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,iw=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,sw=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,aw=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,rw=`#ifdef USE_GRADIENTMAP
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
}`,ow=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lw=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,cw=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,uw=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,hw=`#ifdef USE_ENVMAP
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
#endif`,fw=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,dw=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,pw=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,mw=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,gw=`PhysicalMaterial material;
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
#endif`,_w=`uniform sampler2D dfgLUT;
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
}`,vw=`
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
#endif`,yw=`#if defined( RE_IndirectDiffuse )
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
#endif`,xw=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Sw=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,bw=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Mw=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Ew=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Tw=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Aw=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,ww=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Cw=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Rw=`#if defined( USE_POINTS_UV )
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
#endif`,Dw=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Uw=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Nw=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Lw=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Iw=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ow=`#ifdef USE_MORPHTARGETS
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
#endif`,Pw=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,zw=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Bw=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Fw=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Vw=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Hw=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Gw=`#ifdef USE_NORMALMAP
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
#endif`,kw=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Xw=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Ww=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,qw=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Yw=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Zw=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Jw=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Kw=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,jw=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Qw=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,$w=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,tC=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,eC=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,nC=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,iC=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,sC=`float getShadowMask() {
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
}`,aC=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,rC=`#ifdef USE_SKINNING
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
#endif`,oC=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,lC=`#ifdef USE_SKINNING
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
#endif`,cC=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,uC=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,hC=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,fC=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,dC=`#ifdef USE_TRANSMISSION
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
#endif`,pC=`#ifdef USE_TRANSMISSION
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
#endif`,mC=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,gC=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,_C=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,vC=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,yC=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,xC=`uniform sampler2D t2D;
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
}`,SC=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,bC=`#ifdef ENVMAP_TYPE_CUBE
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
}`,MC=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,EC=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,TC=`#include <common>
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
}`,AC=`#if DEPTH_PACKING == 3200
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
}`,wC=`#define DISTANCE
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
}`,CC=`#define DISTANCE
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
}`,RC=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,DC=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,UC=`uniform float scale;
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
}`,NC=`uniform vec3 diffuse;
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
}`,LC=`#include <common>
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
}`,IC=`uniform vec3 diffuse;
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
}`,OC=`#define LAMBERT
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
}`,PC=`#define LAMBERT
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
}`,zC=`#define MATCAP
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
}`,BC=`#define MATCAP
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
}`,FC=`#define NORMAL
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
}`,VC=`#define NORMAL
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
}`,HC=`#define PHONG
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
}`,GC=`#define PHONG
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
}`,kC=`#define STANDARD
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
}`,XC=`#define STANDARD
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
}`,WC=`#define TOON
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
}`,qC=`#define TOON
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
}`,YC=`uniform float size;
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
}`,ZC=`uniform vec3 diffuse;
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
}`,JC=`#include <common>
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
}`,KC=`uniform vec3 color;
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
}`,jC=`uniform float rotation;
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
}`,QC=`uniform vec3 diffuse;
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
}`,Xt={alphahash_fragment:yA,alphahash_pars_fragment:xA,alphamap_fragment:SA,alphamap_pars_fragment:bA,alphatest_fragment:MA,alphatest_pars_fragment:EA,aomap_fragment:TA,aomap_pars_fragment:AA,batching_pars_vertex:wA,batching_vertex:CA,begin_vertex:RA,beginnormal_vertex:DA,bsdfs:UA,iridescence_fragment:NA,bumpmap_pars_fragment:LA,clipping_planes_fragment:IA,clipping_planes_pars_fragment:OA,clipping_planes_pars_vertex:PA,clipping_planes_vertex:zA,color_fragment:BA,color_pars_fragment:FA,color_pars_vertex:VA,color_vertex:HA,common:GA,cube_uv_reflection_fragment:kA,defaultnormal_vertex:XA,displacementmap_pars_vertex:WA,displacementmap_vertex:qA,emissivemap_fragment:YA,emissivemap_pars_fragment:ZA,colorspace_fragment:JA,colorspace_pars_fragment:KA,envmap_fragment:jA,envmap_common_pars_fragment:QA,envmap_pars_fragment:$A,envmap_pars_vertex:tw,envmap_physical_pars_fragment:hw,envmap_vertex:ew,fog_vertex:nw,fog_pars_vertex:iw,fog_fragment:sw,fog_pars_fragment:aw,gradientmap_pars_fragment:rw,lightmap_pars_fragment:ow,lights_lambert_fragment:lw,lights_lambert_pars_fragment:cw,lights_pars_begin:uw,lights_toon_fragment:fw,lights_toon_pars_fragment:dw,lights_phong_fragment:pw,lights_phong_pars_fragment:mw,lights_physical_fragment:gw,lights_physical_pars_fragment:_w,lights_fragment_begin:vw,lights_fragment_maps:yw,lights_fragment_end:xw,lightprobes_pars_fragment:Sw,logdepthbuf_fragment:bw,logdepthbuf_pars_fragment:Mw,logdepthbuf_pars_vertex:Ew,logdepthbuf_vertex:Tw,map_fragment:Aw,map_pars_fragment:ww,map_particle_fragment:Cw,map_particle_pars_fragment:Rw,metalnessmap_fragment:Dw,metalnessmap_pars_fragment:Uw,morphinstance_vertex:Nw,morphcolor_vertex:Lw,morphnormal_vertex:Iw,morphtarget_pars_vertex:Ow,morphtarget_vertex:Pw,normal_fragment_begin:zw,normal_fragment_maps:Bw,normal_pars_fragment:Fw,normal_pars_vertex:Vw,normal_vertex:Hw,normalmap_pars_fragment:Gw,clearcoat_normal_fragment_begin:kw,clearcoat_normal_fragment_maps:Xw,clearcoat_pars_fragment:Ww,iridescence_pars_fragment:qw,opaque_fragment:Yw,packing:Zw,premultiplied_alpha_fragment:Jw,project_vertex:Kw,dithering_fragment:jw,dithering_pars_fragment:Qw,roughnessmap_fragment:$w,roughnessmap_pars_fragment:tC,shadowmap_pars_fragment:eC,shadowmap_pars_vertex:nC,shadowmap_vertex:iC,shadowmask_pars_fragment:sC,skinbase_vertex:aC,skinning_pars_vertex:rC,skinning_vertex:oC,skinnormal_vertex:lC,specularmap_fragment:cC,specularmap_pars_fragment:uC,tonemapping_fragment:hC,tonemapping_pars_fragment:fC,transmission_fragment:dC,transmission_pars_fragment:pC,uv_pars_fragment:mC,uv_pars_vertex:gC,uv_vertex:_C,worldpos_vertex:vC,background_vert:yC,background_frag:xC,backgroundCube_vert:SC,backgroundCube_frag:bC,cube_vert:MC,cube_frag:EC,depth_vert:TC,depth_frag:AC,distance_vert:wC,distance_frag:CC,equirect_vert:RC,equirect_frag:DC,linedashed_vert:UC,linedashed_frag:NC,meshbasic_vert:LC,meshbasic_frag:IC,meshlambert_vert:OC,meshlambert_frag:PC,meshmatcap_vert:zC,meshmatcap_frag:BC,meshnormal_vert:FC,meshnormal_frag:VC,meshphong_vert:HC,meshphong_frag:GC,meshphysical_vert:kC,meshphysical_frag:XC,meshtoon_vert:WC,meshtoon_frag:qC,points_vert:YC,points_frag:ZC,shadow_vert:JC,shadow_frag:KC,sprite_vert:jC,sprite_frag:QC},pt={common:{diffuse:{value:new te(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Pt},alphaMap:{value:null},alphaMapTransform:{value:new Pt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Pt}},envmap:{envMap:{value:null},envMapRotation:{value:new Pt},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Pt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Pt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Pt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Pt},normalScale:{value:new Dt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Pt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Pt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Pt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Pt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new te(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new N},probesMax:{value:new N},probesResolution:{value:new N}},points:{diffuse:{value:new te(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Pt},alphaTest:{value:0},uvTransform:{value:new Pt}},sprite:{diffuse:{value:new te(16777215)},opacity:{value:1},center:{value:new Dt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Pt},alphaMap:{value:null},alphaMapTransform:{value:new Pt},alphaTest:{value:0}}},Zi={basic:{uniforms:Sn([pt.common,pt.specularmap,pt.envmap,pt.aomap,pt.lightmap,pt.fog]),vertexShader:Xt.meshbasic_vert,fragmentShader:Xt.meshbasic_frag},lambert:{uniforms:Sn([pt.common,pt.specularmap,pt.envmap,pt.aomap,pt.lightmap,pt.emissivemap,pt.bumpmap,pt.normalmap,pt.displacementmap,pt.fog,pt.lights,{emissive:{value:new te(0)},envMapIntensity:{value:1}}]),vertexShader:Xt.meshlambert_vert,fragmentShader:Xt.meshlambert_frag},phong:{uniforms:Sn([pt.common,pt.specularmap,pt.envmap,pt.aomap,pt.lightmap,pt.emissivemap,pt.bumpmap,pt.normalmap,pt.displacementmap,pt.fog,pt.lights,{emissive:{value:new te(0)},specular:{value:new te(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Xt.meshphong_vert,fragmentShader:Xt.meshphong_frag},standard:{uniforms:Sn([pt.common,pt.envmap,pt.aomap,pt.lightmap,pt.emissivemap,pt.bumpmap,pt.normalmap,pt.displacementmap,pt.roughnessmap,pt.metalnessmap,pt.fog,pt.lights,{emissive:{value:new te(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Xt.meshphysical_vert,fragmentShader:Xt.meshphysical_frag},toon:{uniforms:Sn([pt.common,pt.aomap,pt.lightmap,pt.emissivemap,pt.bumpmap,pt.normalmap,pt.displacementmap,pt.gradientmap,pt.fog,pt.lights,{emissive:{value:new te(0)}}]),vertexShader:Xt.meshtoon_vert,fragmentShader:Xt.meshtoon_frag},matcap:{uniforms:Sn([pt.common,pt.bumpmap,pt.normalmap,pt.displacementmap,pt.fog,{matcap:{value:null}}]),vertexShader:Xt.meshmatcap_vert,fragmentShader:Xt.meshmatcap_frag},points:{uniforms:Sn([pt.points,pt.fog]),vertexShader:Xt.points_vert,fragmentShader:Xt.points_frag},dashed:{uniforms:Sn([pt.common,pt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Xt.linedashed_vert,fragmentShader:Xt.linedashed_frag},depth:{uniforms:Sn([pt.common,pt.displacementmap]),vertexShader:Xt.depth_vert,fragmentShader:Xt.depth_frag},normal:{uniforms:Sn([pt.common,pt.bumpmap,pt.normalmap,pt.displacementmap,{opacity:{value:1}}]),vertexShader:Xt.meshnormal_vert,fragmentShader:Xt.meshnormal_frag},sprite:{uniforms:Sn([pt.sprite,pt.fog]),vertexShader:Xt.sprite_vert,fragmentShader:Xt.sprite_frag},background:{uniforms:{uvTransform:{value:new Pt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Xt.background_vert,fragmentShader:Xt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Pt}},vertexShader:Xt.backgroundCube_vert,fragmentShader:Xt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Xt.cube_vert,fragmentShader:Xt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Xt.equirect_vert,fragmentShader:Xt.equirect_frag},distance:{uniforms:Sn([pt.common,pt.displacementmap,{referencePosition:{value:new N},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Xt.distance_vert,fragmentShader:Xt.distance_frag},shadow:{uniforms:Sn([pt.lights,pt.fog,{color:{value:new te(0)},opacity:{value:1}}]),vertexShader:Xt.shadow_vert,fragmentShader:Xt.shadow_frag}};Zi.physical={uniforms:Sn([Zi.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Pt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Pt},clearcoatNormalScale:{value:new Dt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Pt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Pt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Pt},sheen:{value:0},sheenColor:{value:new te(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Pt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Pt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Pt},transmissionSamplerSize:{value:new Dt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Pt},attenuationDistance:{value:0},attenuationColor:{value:new te(0)},specularColor:{value:new te(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Pt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Pt},anisotropyVector:{value:new Dt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Pt}}]),vertexShader:Xt.meshphysical_vert,fragmentShader:Xt.meshphysical_frag};var ld={r:0,b:0,g:0},$C=new De,uM=new Pt;uM.set(-1,0,0,0,1,0,0,0,1);function tR(e,t,n,i,s,a){let r=new te(0),o=s===!0?0:1,l,c,h=null,p=0,u=null;function d(v){let S=v.isScene===!0?v.background:null;if(S&&S.isTexture){let y=v.backgroundBlurriness>0;S=t.get(S,y)}return S}function _(v){let S=!1,y=d(v);y===null?g(r,o):y&&y.isColor&&(g(y,1),S=!0);let E=e.xr.getEnvironmentBlendMode();E==="additive"?n.buffers.color.setClear(0,0,0,1,a):E==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||S)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function b(v,S){let y=d(S);y&&(y.isCubeTexture||y.mapping===sc)?(c===void 0&&(c=new Qe(new po(1,1,1),new jn({name:"BackgroundCubeMaterial",uniforms:$a(Zi.backgroundCube.uniforms),vertexShader:Zi.backgroundCube.vertexShader,fragmentShader:Zi.backgroundCube.fragmentShader,side:An,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(E,A,w){this.matrixWorld.copyPosition(w.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=y,c.material.uniforms.backgroundBlurriness.value=S.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4($C.makeRotationFromEuler(S.backgroundRotation)).transpose(),y.isCubeTexture&&y.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(uM),c.material.toneMapped=$t.getTransfer(y.colorSpace)!==oe,(h!==y||p!==y.version||u!==e.toneMapping)&&(c.material.needsUpdate=!0,h=y,p=y.version,u=e.toneMapping),c.layers.enableAll(),v.unshift(c,c.geometry,c.material,0,0,null)):y&&y.isTexture&&(l===void 0&&(l=new Qe(new da(2,2),new jn({name:"BackgroundMaterial",uniforms:$a(Zi.background.uniforms),vertexShader:Zi.background.vertexShader,fragmentShader:Zi.background.fragmentShader,side:bs,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=y,l.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,l.material.toneMapped=$t.getTransfer(y.colorSpace)!==oe,y.matrixAutoUpdate===!0&&y.updateMatrix(),l.material.uniforms.uvTransform.value.copy(y.matrix),(h!==y||p!==y.version||u!==e.toneMapping)&&(l.material.needsUpdate=!0,h=y,p=y.version,u=e.toneMapping),l.layers.enableAll(),v.unshift(l,l.geometry,l.material,0,0,null))}function g(v,S){v.getRGB(ld,c0(e)),n.buffers.color.setClear(ld.r,ld.g,ld.b,S,a)}function f(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return r},setClearColor:function(v,S=1){r.set(v),o=S,g(r,o)},getClearAlpha:function(){return o},setClearAlpha:function(v){o=v,g(r,o)},render:_,addToRenderList:b,dispose:f}}function eR(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},s=u(null),a=s,r=!1;function o(D,L,k,X,z){let G=!1,W=p(D,X,k,L);a!==W&&(a=W,c(a.object)),G=d(D,X,k,z),G&&_(D,X,k,z),z!==null&&t.update(z,e.ELEMENT_ARRAY_BUFFER),(G||r)&&(r=!1,y(D,L,k,X),z!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(z).buffer))}function l(){return e.createVertexArray()}function c(D){return e.bindVertexArray(D)}function h(D){return e.deleteVertexArray(D)}function p(D,L,k,X){let z=X.wireframe===!0,G=i[L.id];G===void 0&&(G={},i[L.id]=G);let W=D.isInstancedMesh===!0?D.id:0,Q=G[W];Q===void 0&&(Q={},G[W]=Q);let et=Q[k.id];et===void 0&&(et={},Q[k.id]=et);let at=et[z];return at===void 0&&(at=u(l()),et[z]=at),at}function u(D){let L=[],k=[],X=[];for(let z=0;z<n;z++)L[z]=0,k[z]=0,X[z]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:L,enabledAttributes:k,attributeDivisors:X,object:D,attributes:{},index:null}}function d(D,L,k,X){let z=a.attributes,G=L.attributes,W=0,Q=k.getAttributes();for(let et in Q)if(Q[et].location>=0){let ot=z[et],vt=G[et];if(vt===void 0&&(et==="instanceMatrix"&&D.instanceMatrix&&(vt=D.instanceMatrix),et==="instanceColor"&&D.instanceColor&&(vt=D.instanceColor)),ot===void 0||ot.attribute!==vt||vt&&ot.data!==vt.data)return!0;W++}return a.attributesNum!==W||a.index!==X}function _(D,L,k,X){let z={},G=L.attributes,W=0,Q=k.getAttributes();for(let et in Q)if(Q[et].location>=0){let ot=G[et];ot===void 0&&(et==="instanceMatrix"&&D.instanceMatrix&&(ot=D.instanceMatrix),et==="instanceColor"&&D.instanceColor&&(ot=D.instanceColor));let vt={};vt.attribute=ot,ot&&ot.data&&(vt.data=ot.data),z[et]=vt,W++}a.attributes=z,a.attributesNum=W,a.index=X}function b(){let D=a.newAttributes;for(let L=0,k=D.length;L<k;L++)D[L]=0}function g(D){f(D,0)}function f(D,L){let k=a.newAttributes,X=a.enabledAttributes,z=a.attributeDivisors;k[D]=1,X[D]===0&&(e.enableVertexAttribArray(D),X[D]=1),z[D]!==L&&(e.vertexAttribDivisor(D,L),z[D]=L)}function v(){let D=a.newAttributes,L=a.enabledAttributes;for(let k=0,X=L.length;k<X;k++)L[k]!==D[k]&&(e.disableVertexAttribArray(k),L[k]=0)}function S(D,L,k,X,z,G,W){W===!0?e.vertexAttribIPointer(D,L,k,z,G):e.vertexAttribPointer(D,L,k,X,z,G)}function y(D,L,k,X){b();let z=X.attributes,G=k.getAttributes(),W=L.defaultAttributeValues;for(let Q in G){let et=G[Q];if(et.location>=0){let at=z[Q];if(at===void 0&&(Q==="instanceMatrix"&&D.instanceMatrix&&(at=D.instanceMatrix),Q==="instanceColor"&&D.instanceColor&&(at=D.instanceColor)),at!==void 0){let ot=at.normalized,vt=at.itemSize,kt=t.get(at);if(kt===void 0)continue;let de=kt.buffer,Ht=kt.type,Z=kt.bytesPerElement,rt=Ht===e.INT||Ht===e.UNSIGNED_INT||at.gpuType===Ef;if(at.isInterleavedBufferAttribute){let it=at.data,At=it.stride,Ot=at.offset;if(it.isInstancedInterleavedBuffer){for(let St=0;St<et.locationSize;St++)f(et.location+St,it.meshPerAttribute);D.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=it.meshPerAttribute*it.count)}else for(let St=0;St<et.locationSize;St++)g(et.location+St);e.bindBuffer(e.ARRAY_BUFFER,de);for(let St=0;St<et.locationSize;St++)S(et.location+St,vt/et.locationSize,Ht,ot,At*Z,(Ot+vt/et.locationSize*St)*Z,rt)}else{if(at.isInstancedBufferAttribute){for(let it=0;it<et.locationSize;it++)f(et.location+it,at.meshPerAttribute);D.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=at.meshPerAttribute*at.count)}else for(let it=0;it<et.locationSize;it++)g(et.location+it);e.bindBuffer(e.ARRAY_BUFFER,de);for(let it=0;it<et.locationSize;it++)S(et.location+it,vt/et.locationSize,Ht,ot,vt*Z,vt/et.locationSize*it*Z,rt)}}else if(W!==void 0){let ot=W[Q];if(ot!==void 0)switch(ot.length){case 2:e.vertexAttrib2fv(et.location,ot);break;case 3:e.vertexAttrib3fv(et.location,ot);break;case 4:e.vertexAttrib4fv(et.location,ot);break;default:e.vertexAttrib1fv(et.location,ot)}}}}v()}function E(){T();for(let D in i){let L=i[D];for(let k in L){let X=L[k];for(let z in X){let G=X[z];for(let W in G)h(G[W].object),delete G[W];delete X[z]}}delete i[D]}}function A(D){if(i[D.id]===void 0)return;let L=i[D.id];for(let k in L){let X=L[k];for(let z in X){let G=X[z];for(let W in G)h(G[W].object),delete G[W];delete X[z]}}delete i[D.id]}function w(D){for(let L in i){let k=i[L];for(let X in k){let z=k[X];if(z[D.id]===void 0)continue;let G=z[D.id];for(let W in G)h(G[W].object),delete G[W];delete z[D.id]}}}function x(D){for(let L in i){let k=i[L],X=D.isInstancedMesh===!0?D.id:0,z=k[X];if(z!==void 0){for(let G in z){let W=z[G];for(let Q in W)h(W[Q].object),delete W[Q];delete z[G]}delete k[X],Object.keys(k).length===0&&delete i[L]}}}function T(){R(),r=!0,a!==s&&(a=s,c(a.object))}function R(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:T,resetDefaultState:R,dispose:E,releaseStatesOfGeometry:A,releaseStatesOfObject:x,releaseStatesOfProgram:w,initAttributes:b,enableAttribute:g,disableUnusedAttributes:v}}function nR(e,t,n){let i;function s(l){i=l}function a(l,c){e.drawArrays(i,l,c),n.update(c,i,1)}function r(l,c,h){h!==0&&(e.drawArraysInstanced(i,l,c,h),n.update(c,i,h))}function o(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,h);let u=0;for(let d=0;d<h;d++)u+=c[d];n.update(u,i,1)}this.setMode=s,this.render=a,this.renderInstances=r,this.renderMultiDraw=o}function iR(e,t,n,i){let s;function a(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let w=t.get("EXT_texture_filter_anisotropic");s=e.getParameter(w.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function r(w){return!(w!==mi&&i.convert(w)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(w){let x=w===qi&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(w!==$n&&i.convert(w)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE)&&w!==Ti&&!x)}function l(w){if(w==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";w="mediump"}return w==="mediump"&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=n.precision!==void 0?n.precision:"highp",h=l(c);h!==c&&(Ut("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let p=n.logarithmicDepthBuffer===!0,u=n.reversedDepthBuffer===!0&&t.has("EXT_clip_control");n.reversedDepthBuffer===!0&&u===!1&&Ut("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let d=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),_=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),b=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),f=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),S=e.getParameter(e.MAX_VARYING_VECTORS),y=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),E=e.getParameter(e.MAX_SAMPLES),A=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:l,textureFormatReadable:r,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:p,reversedDepthBuffer:u,maxTextures:d,maxVertexTextures:_,maxTextureSize:b,maxCubemapSize:g,maxAttributes:f,maxVertexUniforms:v,maxVaryings:S,maxFragmentUniforms:y,maxSamples:E,samples:A}}function sR(e){let t=this,n=null,i=0,s=!1,a=!1,r=new Bi,o=new Pt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(p,u){let d=p.length!==0||u||i!==0||s;return s=u,i=p.length,d},this.beginShadows=function(){a=!0,h(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(p,u){n=h(p,u,0)},this.setState=function(p,u,d){let _=p.clippingPlanes,b=p.clipIntersection,g=p.clipShadows,f=e.get(p);if(!s||_===null||_.length===0||a&&!g)a?h(null):c();else{let v=a?0:i,S=v*4,y=f.clippingState||null;l.value=y,y=h(_,u,S,d);for(let E=0;E!==S;++E)y[E]=n[E];f.clippingState=y,this.numIntersection=b?this.numPlanes:0,this.numPlanes+=v}};function c(){l.value!==n&&(l.value=n,l.needsUpdate=i>0),t.numPlanes=i,t.numIntersection=0}function h(p,u,d,_){let b=p!==null?p.length:0,g=null;if(b!==0){if(g=l.value,_!==!0||g===null){let f=d+b*4,v=u.matrixWorldInverse;o.getNormalMatrix(v),(g===null||g.length<f)&&(g=new Float32Array(f));for(let S=0,y=d;S!==b;++S,y+=4)r.copy(p[S]).applyMatrix4(v,o),r.normal.toArray(g,y),g[y+3]=r.constant}l.value=g,l.needsUpdate=!0}return t.numPlanes=b,t.numIntersection=0,g}}var Sa=4,Hb=[.125,.215,.35,.446,.526,.582],tr=20,aR=256,dc=new ec,Gb=new te,d0=null,p0=0,m0=0,g0=!1,rR=new N,ud=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,n=0,i=.1,s=100,a={}){let{size:r=256,position:o=rR}=a;d0=this._renderer.getRenderTarget(),p0=this._renderer.getActiveCubeFace(),m0=this._renderer.getActiveMipmapLevel(),g0=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(r);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(t,i,s,l,o),n>0&&this._blur(l,0,0,n),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(t,n=null){return this._fromTexture(t,n)}fromCubemap(t,n=null){return this._fromTexture(t,n)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Wb(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Xb(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(d0,p0,m0),this._renderer.xr.enabled=g0,t.scissorTest=!1,xo(t,0,0,t.width,t.height)}_fromTexture(t,n){t.mapping===_a||t.mapping===Qa?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),d0=this._renderer.getRenderTarget(),p0=this._renderer.getActiveCubeFace(),m0=this._renderer.getActiveMipmapLevel(),g0=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=n||this._allocateTargets();return this._textureToCubeUV(t,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),n=4*this._cubeSize,i={magFilter:dn,minFilter:dn,generateMipmaps:!1,type:qi,format:mi,colorSpace:Il,depthBuffer:!1},s=kb(t,n,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==n){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=kb(t,n,i);let{_lodMax:a}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=oR(a)),this._blurMaterial=cR(a,t,n),this._ggxMaterial=lR(a,t,n)}return s}_compileMaterial(t){let n=new Qe(new on,t);this._renderer.compile(n,dc)}_sceneToCubeUV(t,n,i,s,a){let l=new yn(90,1,n,i),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],p=this._renderer,u=p.autoClear,d=p.toneMapping;p.getClearColor(Gb),p.toneMapping=Mi,p.autoClear=!1,p.state.buffers.depth.getReversed()&&(p.setRenderTarget(s),p.clearDepth(),p.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Qe(new po,new di({name:"PMREM.Background",side:An,depthWrite:!1,depthTest:!1})));let b=this._backgroundBox,g=b.material,f=!1,v=t.background;v?v.isColor&&(g.color.copy(v),t.background=null,f=!0):(g.color.copy(Gb),f=!0);for(let S=0;S<6;S++){let y=S%3;y===0?(l.up.set(0,c[S],0),l.position.set(a.x,a.y,a.z),l.lookAt(a.x+h[S],a.y,a.z)):y===1?(l.up.set(0,0,c[S]),l.position.set(a.x,a.y,a.z),l.lookAt(a.x,a.y+h[S],a.z)):(l.up.set(0,c[S],0),l.position.set(a.x,a.y,a.z),l.lookAt(a.x,a.y,a.z+h[S]));let E=this._cubeSize;xo(s,y*E,S>2?E:0,E,E),p.setRenderTarget(s),f&&p.render(b,l),p.render(t,l)}p.toneMapping=d,p.autoClear=u,t.background=v}_textureToCubeUV(t,n){let i=this._renderer,s=t.mapping===_a||t.mapping===Qa;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Wb()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Xb());let a=s?this._cubemapMaterial:this._equirectMaterial,r=this._lodMeshes[0];r.material=a;let o=a.uniforms;o.envMap.value=t;let l=this._cubeSize;xo(n,0,0,3*l,2*l),i.setRenderTarget(n),i.render(r,dc)}_applyPMREM(t){let n=this._renderer,i=n.autoClear;n.autoClear=!1;let s=this._lodMeshes.length;for(let a=1;a<s;a++)this._applyGGXFilter(t,a-1,a);n.autoClear=i}_applyGGXFilter(t,n,i){let s=this._renderer,a=this._pingPongRenderTarget,r=this._ggxMaterial,o=this._lodMeshes[i];o.material=r;let l=r.uniforms,c=i/(this._lodMeshes.length-1),h=n/(this._lodMeshes.length-1),p=Math.sqrt(c*c-h*h),u=0+c*1.25,d=p*u,{_lodMax:_}=this,b=this._sizeLods[i],g=3*b*(i>_-Sa?i-_+Sa:0),f=4*(this._cubeSize-b);l.envMap.value=t.texture,l.roughness.value=d,l.mipInt.value=_-n,xo(a,g,f,3*b,2*b),s.setRenderTarget(a),s.render(o,dc),l.envMap.value=a.texture,l.roughness.value=0,l.mipInt.value=_-i,xo(t,g,f,3*b,2*b),s.setRenderTarget(t),s.render(o,dc)}_blur(t,n,i,s,a){let r=this._pingPongRenderTarget;this._halfBlur(t,r,n,i,s,"latitudinal",a),this._halfBlur(r,t,i,i,s,"longitudinal",a)}_halfBlur(t,n,i,s,a,r,o){let l=this._renderer,c=this._blurMaterial;r!=="latitudinal"&&r!=="longitudinal"&&Lt("blur direction must be either latitudinal or longitudinal!");let h=3,p=this._lodMeshes[s];p.material=c;let u=c.uniforms,d=this._sizeLods[i]-1,_=isFinite(a)?Math.PI/(2*d):2*Math.PI/(2*tr-1),b=a/_,g=isFinite(a)?1+Math.floor(h*b):tr;g>tr&&Ut(`sigmaRadians, ${a}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${tr}`);let f=[],v=0;for(let w=0;w<tr;++w){let x=w/b,T=Math.exp(-x*x/2);f.push(T),w===0?v+=T:w<g&&(v+=2*T)}for(let w=0;w<f.length;w++)f[w]=f[w]/v;u.envMap.value=t.texture,u.samples.value=g,u.weights.value=f,u.latitudinal.value=r==="latitudinal",o&&(u.poleAxis.value=o);let{_lodMax:S}=this;u.dTheta.value=_,u.mipInt.value=S-i;let y=this._sizeLods[s],E=3*y*(s>S-Sa?s-S+Sa:0),A=4*(this._cubeSize-y);xo(n,E,A,3*y,2*y),l.setRenderTarget(n),l.render(p,dc)}};function oR(e){let t=[],n=[],i=[],s=e,a=e-Sa+1+Hb.length;for(let r=0;r<a;r++){let o=Math.pow(2,s);t.push(o);let l=1/o;r>e-Sa?l=Hb[r-e+Sa-1]:r===0&&(l=0),n.push(l);let c=1/(o-2),h=-c,p=1+c,u=[h,h,p,h,p,p,h,h,p,p,h,p],d=6,_=6,b=3,g=2,f=1,v=new Float32Array(b*_*d),S=new Float32Array(g*_*d),y=new Float32Array(f*_*d);for(let A=0;A<d;A++){let w=A%3*2/3-1,x=A>2?0:-1,T=[w,x,0,w+2/3,x,0,w+2/3,x+1,0,w,x,0,w+2/3,x+1,0,w,x+1,0];v.set(T,b*_*A),S.set(u,g*_*A);let R=[A,A,A,A,A,A];y.set(R,f*_*A)}let E=new on;E.setAttribute("position",new Zn(v,b)),E.setAttribute("uv",new Zn(S,g)),E.setAttribute("faceIndex",new Zn(y,f)),i.push(new Qe(E,null)),s>Sa&&s--}return{lodMeshes:i,sizeLods:t,sigmas:n}}function kb(e,t,n){let i=new Jn(e,t,n);return i.texture.mapping=sc,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function xo(e,t,n,i,s){e.viewport.set(t,n,i,s),e.scissor.set(t,n,i,s)}function lR(e,t,n){return new jn({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:aR,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:dd(),fragmentShader:`

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
		`,blending:Wi,depthTest:!1,depthWrite:!1})}function cR(e,t,n){let i=new Float32Array(tr),s=new N(0,1,0);return new jn({name:"SphericalGaussianBlur",defines:{n:tr,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:dd(),fragmentShader:`

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
		`,blending:Wi,depthTest:!1,depthWrite:!1})}function Xb(){return new jn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:dd(),fragmentShader:`

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
		`,blending:Wi,depthTest:!1,depthWrite:!1})}function Wb(){return new jn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:dd(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Wi,depthTest:!1,depthWrite:!1})}function dd(){return`

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
	`}var hd=class extends Jn{constructor(t=1,n={}){super(t,t,n),this.isWebGLCubeRenderTarget=!0;let i={width:t,height:t,depth:1},s=[i,i,i,i,i,i];this.texture=new Wl(s),this._setTextureOptions(n),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,n){this.texture.type=n.type,this.texture.colorSpace=n.colorSpace,this.texture.generateMipmaps=n.generateMipmaps,this.texture.minFilter=n.minFilter,this.texture.magFilter=n.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new po(5,5,5),a=new jn({name:"CubemapFromEquirect",uniforms:$a(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:An,blending:Wi});a.uniforms.tEquirect.value=n;let r=new Qe(s,a),o=n.minFilter;return n.minFilter===va&&(n.minFilter=dn),new vf(1,10,this).update(t,r),n.minFilter=o,r.geometry.dispose(),r.material.dispose(),this}clear(t,n=!0,i=!0,s=!0){let a=t.getRenderTarget();for(let r=0;r<6;r++)t.setRenderTarget(this,r),t.clear(n,i,s);t.setRenderTarget(a)}};function uR(e){let t=new WeakMap,n=new WeakMap,i=null;function s(u,d=!1){return u==null?null:d?r(u):a(u)}function a(u){if(u&&u.isTexture){let d=u.mapping;if(d===Sf||d===bf)if(t.has(u)){let _=t.get(u).texture;return o(_,u.mapping)}else{let _=u.image;if(_&&_.height>0){let b=new hd(_.height);return b.fromEquirectangularTexture(e,u),t.set(u,b),u.addEventListener("dispose",c),o(b.texture,u.mapping)}else return null}}return u}function r(u){if(u&&u.isTexture){let d=u.mapping,_=d===Sf||d===bf,b=d===_a||d===Qa;if(_||b){let g=n.get(u),f=g!==void 0?g.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==f)return i===null&&(i=new ud(e)),g=_?i.fromEquirectangular(u,g):i.fromCubemap(u,g),g.texture.pmremVersion=u.pmremVersion,n.set(u,g),g.texture;if(g!==void 0)return g.texture;{let v=u.image;return _&&v&&v.height>0||b&&v&&l(v)?(i===null&&(i=new ud(e)),g=_?i.fromEquirectangular(u):i.fromCubemap(u),g.texture.pmremVersion=u.pmremVersion,n.set(u,g),u.addEventListener("dispose",h),g.texture):null}}}return u}function o(u,d){return d===Sf?u.mapping=_a:d===bf&&(u.mapping=Qa),u}function l(u){let d=0,_=6;for(let b=0;b<_;b++)u[b]!==void 0&&d++;return d===_}function c(u){let d=u.target;d.removeEventListener("dispose",c);let _=t.get(d);_!==void 0&&(t.delete(d),_.dispose())}function h(u){let d=u.target;d.removeEventListener("dispose",h);let _=n.get(d);_!==void 0&&(n.delete(d),_.dispose())}function p(){t=new WeakMap,n=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:s,dispose:p}}function hR(e){let t={};function n(i){if(t[i]!==void 0)return t[i];let s=e.getExtension(i);return t[i]=s,s}return{has:function(i){return n(i)!==null},init:function(){n("EXT_color_buffer_float"),n("WEBGL_clip_cull_distance"),n("OES_texture_float_linear"),n("EXT_color_buffer_half_float"),n("WEBGL_multisampled_render_to_texture"),n("WEBGL_render_shared_exponent")},get:function(i){let s=n(i);return s===null&&Za("WebGLRenderer: "+i+" extension not supported."),s}}}function fR(e,t,n,i){let s={},a=new WeakMap;function r(p){let u=p.target;u.index!==null&&t.remove(u.index);for(let _ in u.attributes)t.remove(u.attributes[_]);u.removeEventListener("dispose",r),delete s[u.id];let d=a.get(u);d&&(t.remove(d),a.delete(u)),i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,n.memory.geometries--}function o(p,u){return s[u.id]===!0||(u.addEventListener("dispose",r),s[u.id]=!0,n.memory.geometries++),u}function l(p){let u=p.attributes;for(let d in u)t.update(u[d],e.ARRAY_BUFFER)}function c(p){let u=[],d=p.index,_=p.attributes.position,b=0;if(_===void 0)return;if(d!==null){let v=d.array;b=d.version;for(let S=0,y=v.length;S<y;S+=3){let E=v[S+0],A=v[S+1],w=v[S+2];u.push(E,A,A,w,w,E)}}else{let v=_.array;b=_.version;for(let S=0,y=v.length/3-1;S<y;S+=3){let E=S+0,A=S+1,w=S+2;u.push(E,A,A,w,w,E)}}let g=new(_.count>=65535?Gl:Hl)(u,1);g.version=b;let f=a.get(p);f&&t.remove(f),a.set(p,g)}function h(p){let u=a.get(p);if(u){let d=p.index;d!==null&&u.version<d.version&&c(p)}else c(p);return a.get(p)}return{get:o,update:l,getWireframeAttribute:h}}function dR(e,t,n){let i;function s(p){i=p}let a,r;function o(p){a=p.type,r=p.bytesPerElement}function l(p,u){e.drawElements(i,u,a,p*r),n.update(u,i,1)}function c(p,u,d){d!==0&&(e.drawElementsInstanced(i,u,a,p*r,d),n.update(u,i,d))}function h(p,u,d){if(d===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,a,p,0,d);let b=0;for(let g=0;g<d;g++)b+=u[g];n.update(b,i,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function pR(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function i(a,r,o){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=o*(a/3);break;case e.LINES:n.lines+=o*(a/2);break;case e.LINE_STRIP:n.lines+=o*(a-1);break;case e.LINE_LOOP:n.lines+=o*a;break;case e.POINTS:n.points+=o*a;break;default:Lt("WebGLInfo: Unknown draw mode:",r);break}}function s(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:s,update:i}}function mR(e,t,n){let i=new WeakMap,s=new Ue;function a(r,o,l){let c=r.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,p=h!==void 0?h.length:0,u=i.get(o);if(u===void 0||u.count!==p){let T=function(){w.dispose(),i.delete(o),o.removeEventListener("dispose",T)};u!==void 0&&u.texture.dispose();let d=o.morphAttributes.position!==void 0,_=o.morphAttributes.normal!==void 0,b=o.morphAttributes.color!==void 0,g=o.morphAttributes.position||[],f=o.morphAttributes.normal||[],v=o.morphAttributes.color||[],S=0;d===!0&&(S=1),_===!0&&(S=2),b===!0&&(S=3);let y=o.attributes.position.count*S,E=1;y>t.maxTextureSize&&(E=Math.ceil(y/t.maxTextureSize),y=t.maxTextureSize);let A=new Float32Array(y*E*4*p),w=new Bl(A,y,E,p);w.type=Ti,w.needsUpdate=!0;let x=S*4;for(let R=0;R<p;R++){let D=g[R],L=f[R],k=v[R],X=y*E*4*R;for(let z=0;z<D.count;z++){let G=z*x;d===!0&&(s.fromBufferAttribute(D,z),A[X+G+0]=s.x,A[X+G+1]=s.y,A[X+G+2]=s.z,A[X+G+3]=0),_===!0&&(s.fromBufferAttribute(L,z),A[X+G+4]=s.x,A[X+G+5]=s.y,A[X+G+6]=s.z,A[X+G+7]=0),b===!0&&(s.fromBufferAttribute(k,z),A[X+G+8]=s.x,A[X+G+9]=s.y,A[X+G+10]=s.z,A[X+G+11]=k.itemSize===4?s.w:1)}}u={count:p,texture:w,size:new Dt(y,E)},i.set(o,u),o.addEventListener("dispose",T)}if(r.isInstancedMesh===!0&&r.morphTexture!==null)l.getUniforms().setValue(e,"morphTexture",r.morphTexture,n);else{let d=0;for(let b=0;b<c.length;b++)d+=c[b];let _=o.morphTargetsRelative?1:1-d;l.getUniforms().setValue(e,"morphTargetBaseInfluence",_),l.getUniforms().setValue(e,"morphTargetInfluences",c)}l.getUniforms().setValue(e,"morphTargetsTexture",u.texture,n),l.getUniforms().setValue(e,"morphTargetsTextureSize",u.size)}return{update:a}}function gR(e,t,n,i,s){let a=new WeakMap;function r(c){let h=s.render.frame,p=c.geometry,u=t.get(c,p);if(a.get(u)!==h&&(t.update(u),a.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),a.get(c)!==h&&(n.update(c.instanceMatrix,e.ARRAY_BUFFER),c.instanceColor!==null&&n.update(c.instanceColor,e.ARRAY_BUFFER),a.set(c,h))),c.isSkinnedMesh){let d=c.skeleton;a.get(d)!==h&&(d.update(),a.set(d,h))}return u}function o(){a=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),n.remove(h.instanceMatrix),h.instanceColor!==null&&n.remove(h.instanceColor)}return{update:r,dispose:o}}var _R={[Xg]:"LINEAR_TONE_MAPPING",[Wg]:"REINHARD_TONE_MAPPING",[qg]:"CINEON_TONE_MAPPING",[Yg]:"ACES_FILMIC_TONE_MAPPING",[Jg]:"AGX_TONE_MAPPING",[Kg]:"NEUTRAL_TONE_MAPPING",[Zg]:"CUSTOM_TONE_MAPPING"};function vR(e,t,n,i,s,a){let r=new Jn(t,n,{type:e,depthBuffer:s,stencilBuffer:a,samples:i?4:0,depthTexture:s?new Ms(t,n):void 0}),o=new Jn(t,n,{type:qi,depthBuffer:!1,stencilBuffer:!1}),l=new on;l.setAttribute("position",new xe([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new xe([0,2,0,0,2,0],2));let c=new af({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),h=new Qe(l,c),p=new ec(-1,1,1,-1,0,1),u=null,d=null,_=!1,b,g=null,f=[],v=!1;this.setSize=function(S,y){r.setSize(S,y),o.setSize(S,y);for(let E=0;E<f.length;E++){let A=f[E];A.setSize&&A.setSize(S,y)}},this.setEffects=function(S){f=S,v=f.length>0&&f[0].isRenderPass===!0;let y=r.width,E=r.height;for(let A=0;A<f.length;A++){let w=f[A];w.setSize&&w.setSize(y,E)}},this.begin=function(S,y){if(_||S.toneMapping===Mi&&f.length===0)return!1;if(g=y,y!==null){let E=y.width,A=y.height;(r.width!==E||r.height!==A)&&this.setSize(E,A)}return v===!1&&S.setRenderTarget(r),b=S.toneMapping,S.toneMapping=Mi,!0},this.hasRenderPass=function(){return v},this.end=function(S,y){S.toneMapping=b,_=!0;let E=r,A=o;for(let w=0;w<f.length;w++){let x=f[w];if(x.enabled!==!1&&(x.render(S,A,E,y),x.needsSwap!==!1)){let T=E;E=A,A=T}}if(u!==S.outputColorSpace||d!==S.toneMapping){u=S.outputColorSpace,d=S.toneMapping,c.defines={},$t.getTransfer(u)===oe&&(c.defines.SRGB_TRANSFER="");let w=_R[d];w&&(c.defines[w]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=E.texture,S.setRenderTarget(g),S.render(h,p),g=null,_=!1},this.isCompositing=function(){return _},this.dispose=function(){r.depthTexture&&r.depthTexture.dispose(),r.dispose(),o.dispose(),l.dispose(),c.dispose()}}var hM=new xn,y0=new Ms(1,1),fM=new Bl,dM=new Wh,pM=new Wl,qb=[],Yb=[],Zb=new Float32Array(16),Jb=new Float32Array(9),Kb=new Float32Array(4);function bo(e,t,n){let i=e[0];if(i<=0||i>0)return e;let s=t*n,a=qb[s];if(a===void 0&&(a=new Float32Array(s),qb[s]=a),t!==0){i.toArray(a,0);for(let r=1,o=0;r!==t;++r)o+=n,e[r].toArray(a,o)}return a}function $e(e,t){if(e.length!==t.length)return!1;for(let n=0,i=e.length;n<i;n++)if(e[n]!==t[n])return!1;return!0}function tn(e,t){for(let n=0,i=t.length;n<i;n++)e[n]=t[n]}function pd(e,t){let n=Yb[t];n===void 0&&(n=new Int32Array(t),Yb[t]=n);for(let i=0;i!==t;++i)n[i]=e.allocateTextureUnit();return n}function yR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function xR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if($e(n,t))return;e.uniform2fv(this.addr,t),tn(n,t)}}function SR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if($e(n,t))return;e.uniform3fv(this.addr,t),tn(n,t)}}function bR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if($e(n,t))return;e.uniform4fv(this.addr,t),tn(n,t)}}function MR(e,t){let n=this.cache,i=t.elements;if(i===void 0){if($e(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),tn(n,t)}else{if($e(n,i))return;Kb.set(i),e.uniformMatrix2fv(this.addr,!1,Kb),tn(n,i)}}function ER(e,t){let n=this.cache,i=t.elements;if(i===void 0){if($e(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),tn(n,t)}else{if($e(n,i))return;Jb.set(i),e.uniformMatrix3fv(this.addr,!1,Jb),tn(n,i)}}function TR(e,t){let n=this.cache,i=t.elements;if(i===void 0){if($e(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),tn(n,t)}else{if($e(n,i))return;Zb.set(i),e.uniformMatrix4fv(this.addr,!1,Zb),tn(n,i)}}function AR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function wR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if($e(n,t))return;e.uniform2iv(this.addr,t),tn(n,t)}}function CR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if($e(n,t))return;e.uniform3iv(this.addr,t),tn(n,t)}}function RR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if($e(n,t))return;e.uniform4iv(this.addr,t),tn(n,t)}}function DR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function UR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if($e(n,t))return;e.uniform2uiv(this.addr,t),tn(n,t)}}function NR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if($e(n,t))return;e.uniform3uiv(this.addr,t),tn(n,t)}}function LR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if($e(n,t))return;e.uniform4uiv(this.addr,t),tn(n,t)}}function IR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s);let a;this.type===e.SAMPLER_2D_SHADOW?(y0.compareFunction=n.isReversedDepthBuffer()?od:rd,a=y0):a=hM,n.setTexture2D(t||a,s)}function OR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTexture3D(t||dM,s)}function PR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTextureCube(t||pM,s)}function zR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTexture2DArray(t||fM,s)}function BR(e){switch(e){case 5126:return yR;case 35664:return xR;case 35665:return SR;case 35666:return bR;case 35674:return MR;case 35675:return ER;case 35676:return TR;case 5124:case 35670:return AR;case 35667:case 35671:return wR;case 35668:case 35672:return CR;case 35669:case 35673:return RR;case 5125:return DR;case 36294:return UR;case 36295:return NR;case 36296:return LR;case 35678:case 36198:case 36298:case 36306:case 35682:return IR;case 35679:case 36299:case 36307:return OR;case 35680:case 36300:case 36308:case 36293:return PR;case 36289:case 36303:case 36311:case 36292:return zR}}function FR(e,t){e.uniform1fv(this.addr,t)}function VR(e,t){let n=bo(t,this.size,2);e.uniform2fv(this.addr,n)}function HR(e,t){let n=bo(t,this.size,3);e.uniform3fv(this.addr,n)}function GR(e,t){let n=bo(t,this.size,4);e.uniform4fv(this.addr,n)}function kR(e,t){let n=bo(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function XR(e,t){let n=bo(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function WR(e,t){let n=bo(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function qR(e,t){e.uniform1iv(this.addr,t)}function YR(e,t){e.uniform2iv(this.addr,t)}function ZR(e,t){e.uniform3iv(this.addr,t)}function JR(e,t){e.uniform4iv(this.addr,t)}function KR(e,t){e.uniform1uiv(this.addr,t)}function jR(e,t){e.uniform2uiv(this.addr,t)}function QR(e,t){e.uniform3uiv(this.addr,t)}function $R(e,t){e.uniform4uiv(this.addr,t)}function t2(e,t,n){let i=this.cache,s=t.length,a=pd(n,s);$e(i,a)||(e.uniform1iv(this.addr,a),tn(i,a));let r;this.type===e.SAMPLER_2D_SHADOW?r=y0:r=hM;for(let o=0;o!==s;++o)n.setTexture2D(t[o]||r,a[o])}function e2(e,t,n){let i=this.cache,s=t.length,a=pd(n,s);$e(i,a)||(e.uniform1iv(this.addr,a),tn(i,a));for(let r=0;r!==s;++r)n.setTexture3D(t[r]||dM,a[r])}function n2(e,t,n){let i=this.cache,s=t.length,a=pd(n,s);$e(i,a)||(e.uniform1iv(this.addr,a),tn(i,a));for(let r=0;r!==s;++r)n.setTextureCube(t[r]||pM,a[r])}function i2(e,t,n){let i=this.cache,s=t.length,a=pd(n,s);$e(i,a)||(e.uniform1iv(this.addr,a),tn(i,a));for(let r=0;r!==s;++r)n.setTexture2DArray(t[r]||fM,a[r])}function s2(e){switch(e){case 5126:return FR;case 35664:return VR;case 35665:return HR;case 35666:return GR;case 35674:return kR;case 35675:return XR;case 35676:return WR;case 5124:case 35670:return qR;case 35667:case 35671:return YR;case 35668:case 35672:return ZR;case 35669:case 35673:return JR;case 5125:return KR;case 36294:return jR;case 36295:return QR;case 36296:return $R;case 35678:case 36198:case 36298:case 36306:case 35682:return t2;case 35679:case 36299:case 36307:return e2;case 35680:case 36300:case 36308:case 36293:return n2;case 36289:case 36303:case 36311:case 36292:return i2}}var x0=class{constructor(t,n,i){this.id=t,this.addr=i,this.cache=[],this.type=n.type,this.setValue=BR(n.type)}},S0=class{constructor(t,n,i){this.id=t,this.addr=i,this.cache=[],this.type=n.type,this.size=n.size,this.setValue=s2(n.type)}},b0=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,n,i){let s=this.seq;for(let a=0,r=s.length;a!==r;++a){let o=s[a];o.setValue(t,n[o.id],i)}}},_0=/(\w+)(\])?(\[|\.)?/g;function jb(e,t){e.seq.push(t),e.map[t.id]=t}function a2(e,t,n){let i=e.name,s=i.length;for(_0.lastIndex=0;;){let a=_0.exec(i),r=_0.lastIndex,o=a[1],l=a[2]==="]",c=a[3];if(l&&(o=o|0),c===void 0||c==="["&&r+2===s){jb(n,c===void 0?new x0(o,e,t):new S0(o,e,t));break}else{let p=n.map[o];p===void 0&&(p=new b0(o),jb(n,p)),n=p}}}var So=class{constructor(t,n){this.seq=[],this.map={};let i=t.getProgramParameter(n,t.ACTIVE_UNIFORMS);for(let r=0;r<i;++r){let o=t.getActiveUniform(n,r),l=t.getUniformLocation(n,o.name);a2(o,l,this)}let s=[],a=[];for(let r of this.seq)r.type===t.SAMPLER_2D_SHADOW||r.type===t.SAMPLER_CUBE_SHADOW||r.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(r):a.push(r);s.length>0&&(this.seq=s.concat(a))}setValue(t,n,i,s){let a=this.map[n];a!==void 0&&a.setValue(t,i,s)}setOptional(t,n,i){let s=n[i];s!==void 0&&this.setValue(t,i,s)}static upload(t,n,i,s){for(let a=0,r=n.length;a!==r;++a){let o=n[a],l=i[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,s)}}static seqWithValue(t,n){let i=[];for(let s=0,a=t.length;s!==a;++s){let r=t[s];r.id in n&&i.push(r)}return i}};function Qb(e,t,n){let i=e.createShader(t);return e.shaderSource(i,n),e.compileShader(i),i}var r2=37297,o2=0;function l2(e,t){let n=e.split(`
`),i=[],s=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let r=s;r<a;r++){let o=r+1;i.push(`${o===t?">":" "} ${o}: ${n[r]}`)}return i.join(`
`)}var $b=new Pt;function c2(e){$t._getMatrix($b,$t.workingColorSpace,e);let t=`mat3( ${$b.elements.map(n=>n.toFixed(4))} )`;switch($t.getTransfer(e)){case Ol:return[t,"LinearTransferOETF"];case oe:return[t,"sRGBTransferOETF"];default:return Ut("WebGLProgram: Unsupported color space: ",e),[t,"LinearTransferOETF"]}}function tM(e,t,n){let i=e.getShaderParameter(t,e.COMPILE_STATUS),a=(e.getShaderInfoLog(t)||"").trim();if(i&&a==="")return"";let r=/ERROR: 0:(\d+)/.exec(a);if(r){let o=parseInt(r[1]);return n.toUpperCase()+`

`+a+`

`+l2(e.getShaderSource(t),o)}else return a}function u2(e,t){let n=c2(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,"}"].join(`
`)}var h2={[Xg]:"Linear",[Wg]:"Reinhard",[qg]:"Cineon",[Yg]:"ACESFilmic",[Jg]:"AgX",[Kg]:"Neutral",[Zg]:"Custom"};function f2(e,t){let n=h2[t];return n===void 0?(Ut("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+e+"( vec3 color ) { return "+n+"ToneMapping( color ); }"}var cd=new N;function d2(){$t.getLuminanceCoefficients(cd);let e=cd.x.toFixed(4),t=cd.y.toFixed(4),n=cd.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${t}, ${n} );`,"	return dot( weights, rgb );","}"].join(`
`)}function p2(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(mc).join(`
`)}function m2(e){let t=[];for(let n in e){let i=e[n];i!==!1&&t.push("#define "+n+" "+i)}return t.join(`
`)}function g2(e,t){let n={},i=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let s=0;s<i;s++){let a=e.getActiveAttrib(t,s),r=a.name,o=1;a.type===e.FLOAT_MAT2&&(o=2),a.type===e.FLOAT_MAT3&&(o=3),a.type===e.FLOAT_MAT4&&(o=4),n[r]={type:a.type,location:e.getAttribLocation(t,r),locationSize:o}}return n}function mc(e){return e!==""}function eM(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function nM(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var _2=/^[ \t]*#include +<([\w\d./]+)>/gm;function M0(e){return e.replace(_2,y2)}var v2=new Map;function y2(e,t){let n=Xt[t];if(n===void 0){let i=v2.get(t);if(i!==void 0)n=Xt[i],Ut('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return M0(n)}var x2=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function iM(e){return e.replace(x2,S2)}function S2(e,t,n,i){let s="";for(let a=parseInt(t);a<parseInt(n);a++)s+=i.replace(/\[\s*i\s*\]/g,"[ "+a+" ]").replace(/UNROLLED_LOOP_INDEX/g,a);return s}function sM(e){let t=`precision ${e.precision} float;
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
#define LOW_PRECISION`),t}var b2={[ic]:"SHADOWMAP_TYPE_PCF",[_o]:"SHADOWMAP_TYPE_VSM"};function M2(e){return b2[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var E2={[_a]:"ENVMAP_TYPE_CUBE",[Qa]:"ENVMAP_TYPE_CUBE",[sc]:"ENVMAP_TYPE_CUBE_UV"};function T2(e){return e.envMap===!1?"ENVMAP_TYPE_CUBE":E2[e.envMapMode]||"ENVMAP_TYPE_CUBE"}var A2={[Qa]:"ENVMAP_MODE_REFRACTION"};function w2(e){return e.envMap===!1?"ENVMAP_MODE_REFLECTION":A2[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}var C2={[kg]:"ENVMAP_BLENDING_MULTIPLY",[Mb]:"ENVMAP_BLENDING_MIX",[Eb]:"ENVMAP_BLENDING_ADD"};function R2(e){return e.envMap===!1?"ENVMAP_BLENDING_NONE":C2[e.combine]||"ENVMAP_BLENDING_NONE"}function D2(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,n),7*16)),texelHeight:i,maxMip:n}}function U2(e,t,n,i){let s=e.getContext(),a=n.defines,r=n.vertexShader,o=n.fragmentShader,l=M2(n),c=T2(n),h=w2(n),p=R2(n),u=D2(n),d=p2(n),_=m2(a),b=s.createProgram(),g,f,v=n.glslVersion?"#version "+n.glslVersion+`
`:"";n.isRawShaderMaterial?(g=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,_].filter(mc).join(`
`),g.length>0&&(g+=`
`),f=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,_].filter(mc).join(`
`),f.length>0&&(f+=`
`)):(g=[sM(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,_,n.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",n.batching?"#define USE_BATCHING":"",n.batchingColor?"#define USE_BATCHING_COLOR":"",n.instancing?"#define USE_INSTANCING":"",n.instancingColor?"#define USE_INSTANCING_COLOR":"",n.instancingMorph?"#define USE_INSTANCING_MORPH":"",n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.map?"#define USE_MAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+h:"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.displacementMap?"#define USE_DISPLACEMENTMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.mapUv?"#define MAP_UV "+n.mapUv:"",n.alphaMapUv?"#define ALPHAMAP_UV "+n.alphaMapUv:"",n.lightMapUv?"#define LIGHTMAP_UV "+n.lightMapUv:"",n.aoMapUv?"#define AOMAP_UV "+n.aoMapUv:"",n.emissiveMapUv?"#define EMISSIVEMAP_UV "+n.emissiveMapUv:"",n.bumpMapUv?"#define BUMPMAP_UV "+n.bumpMapUv:"",n.normalMapUv?"#define NORMALMAP_UV "+n.normalMapUv:"",n.displacementMapUv?"#define DISPLACEMENTMAP_UV "+n.displacementMapUv:"",n.metalnessMapUv?"#define METALNESSMAP_UV "+n.metalnessMapUv:"",n.roughnessMapUv?"#define ROUGHNESSMAP_UV "+n.roughnessMapUv:"",n.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+n.anisotropyMapUv:"",n.clearcoatMapUv?"#define CLEARCOATMAP_UV "+n.clearcoatMapUv:"",n.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+n.clearcoatNormalMapUv:"",n.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+n.clearcoatRoughnessMapUv:"",n.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+n.iridescenceMapUv:"",n.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+n.iridescenceThicknessMapUv:"",n.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+n.sheenColorMapUv:"",n.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+n.sheenRoughnessMapUv:"",n.specularMapUv?"#define SPECULARMAP_UV "+n.specularMapUv:"",n.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+n.specularColorMapUv:"",n.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+n.specularIntensityMapUv:"",n.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+n.transmissionMapUv:"",n.thicknessMapUv?"#define THICKNESSMAP_UV "+n.thicknessMapUv:"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexNormals?"#define HAS_NORMAL":"",n.vertexColors?"#define USE_COLOR":"",n.vertexAlphas?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.flatShading?"#define FLAT_SHADED":"",n.skinning?"#define USE_SKINNING":"",n.morphTargets?"#define USE_MORPHTARGETS":"",n.morphNormals&&n.flatShading===!1?"#define USE_MORPHNORMALS":"",n.morphColors?"#define USE_MORPHCOLORS":"",n.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+n.morphTextureStride:"",n.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+n.morphTargetsCount:"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.sizeAttenuation?"#define USE_SIZEATTENUATION":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(mc).join(`
`),f=[sM(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,_,n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",n.map?"#define USE_MAP":"",n.matcap?"#define USE_MATCAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+c:"",n.envMap?"#define "+h:"",n.envMap?"#define "+p:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoat?"#define USE_CLEARCOAT":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.dispersion?"#define USE_DISPERSION":"",n.iridescence?"#define USE_IRIDESCENCE":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaTest?"#define USE_ALPHATEST":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.sheen?"#define USE_SHEEN":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexColors||n.instancingColor?"#define USE_COLOR":"",n.vertexAlphas||n.batchingColor?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.gradientMap?"#define USE_GRADIENTMAP":"",n.flatShading?"#define FLAT_SHADED":"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",n.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",n.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",n.toneMapping!==Mi?"#define TONE_MAPPING":"",n.toneMapping!==Mi?Xt.tonemapping_pars_fragment:"",n.toneMapping!==Mi?f2("toneMapping",n.toneMapping):"",n.dithering?"#define DITHERING":"",n.opaque?"#define OPAQUE":"",Xt.colorspace_pars_fragment,u2("linearToOutputTexel",n.outputColorSpace),d2(),n.useDepthPacking?"#define DEPTH_PACKING "+n.depthPacking:"",`
`].filter(mc).join(`
`)),r=M0(r),r=eM(r,n),r=nM(r,n),o=M0(o),o=eM(o,n),o=nM(o,n),r=iM(r),o=iM(o),n.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,g=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,f=["#define varying in",n.glslVersion===r0?"":"layout(location = 0) out highp vec4 pc_fragColor;",n.glslVersion===r0?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);let S=v+g+r,y=v+f+o,E=Qb(s,s.VERTEX_SHADER,S),A=Qb(s,s.FRAGMENT_SHADER,y);s.attachShader(b,E),s.attachShader(b,A),n.index0AttributeName!==void 0?s.bindAttribLocation(b,0,n.index0AttributeName):n.hasPositionAttribute===!0&&s.bindAttribLocation(b,0,"position"),s.linkProgram(b);function w(D){if(e.debug.checkShaderErrors){let L=s.getProgramInfoLog(b)||"",k=s.getShaderInfoLog(E)||"",X=s.getShaderInfoLog(A)||"",z=L.trim(),G=k.trim(),W=X.trim(),Q=!0,et=!0;if(s.getProgramParameter(b,s.LINK_STATUS)===!1)if(Q=!1,typeof e.debug.onShaderError=="function")e.debug.onShaderError(s,b,E,A);else{let at=tM(s,E,"vertex"),ot=tM(s,A,"fragment");Lt("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(b,s.VALIDATE_STATUS)+`

Material Name: `+D.name+`
Material Type: `+D.type+`

Program Info Log: `+z+`
`+at+`
`+ot)}else z!==""?Ut("WebGLProgram: Program Info Log:",z):(G===""||W==="")&&(et=!1);et&&(D.diagnostics={runnable:Q,programLog:z,vertexShader:{log:G,prefix:g},fragmentShader:{log:W,prefix:f}})}s.deleteShader(E),s.deleteShader(A),x=new So(s,b),T=g2(s,b)}let x;this.getUniforms=function(){return x===void 0&&w(this),x};let T;this.getAttributes=function(){return T===void 0&&w(this),T};let R=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return R===!1&&(R=s.getProgramParameter(b,r2)),R},this.destroy=function(){i.releaseStatesOfProgram(this),s.deleteProgram(b),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=o2++,this.cacheKey=t,this.usedTimes=1,this.program=b,this.vertexShader=E,this.fragmentShader=A,this}var N2=0,E0=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,n,i){let s=this._getShaderCacheForMaterial(t);return s.has(n)===!1&&(s.add(n),n.usedTimes++),s.has(i)===!1&&(s.add(i),i.usedTimes++),this}remove(t){let n=this.materialCache.get(t);for(let i of n)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let n=this.materialCache,i=n.get(t);return i===void 0&&(i=new Set,n.set(t,i)),i}_getShaderStage(t){let n=this.shaderCache,i=n.get(t);return i===void 0&&(i=new T0(t),n.set(t,i)),i}},T0=class{constructor(t){this.id=N2++,this.code=t,this.usedTimes=0}};function L2(e){return e===xa||e===uc||e===hc}function I2(e,t,n,i,s,a){let r=new Fl,o=new E0,l=new Set,c=[],h=new Map,p=i.logarithmicDepthBuffer,u=i.precision,d={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(x){return l.add(x),x===0?"uv":`uv${x}`}function b(x,T,R,D,L,k){let X=D.fog,z=L.geometry,G=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?D.environment:null,W=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,Q=t.get(x.envMap||G,W),et=Q&&Q.mapping===sc?Q.image.height:null,at=d[x.type];x.precision!==null&&(u=i.getMaxPrecision(x.precision),u!==x.precision&&Ut("WebGLProgram.getParameters:",x.precision,"not supported, using",u,"instead."));let ot=z.morphAttributes.position||z.morphAttributes.normal||z.morphAttributes.color,vt=ot!==void 0?ot.length:0,kt=0;z.morphAttributes.position!==void 0&&(kt=1),z.morphAttributes.normal!==void 0&&(kt=2),z.morphAttributes.color!==void 0&&(kt=3);let de,Ht,Z,rt;if(at){let bt=Zi[at];de=bt.vertexShader,Ht=bt.fragmentShader}else{de=x.vertexShader,Ht=x.fragmentShader;let bt=o.getVertexShaderStage(x),Ie=o.getFragmentShaderStage(x);o.update(x,bt,Ie),Z=bt.id,rt=Ie.id}let it=e.getRenderTarget(),At=e.state.buffers.depth.getReversed(),Ot=L.isInstancedMesh===!0,St=L.isBatchedMesh===!0,Ae=!!x.map,Gt=!!x.matcap,se=!!Q,Kt=!!x.aoMap,qt=!!x.lightMap,Ne=!!x.bumpMap&&x.wireframe===!1,Be=!!x.normalMap,ke=!!x.displacementMap,Je=!!x.emissiveMap,we=!!x.metalnessMap,Le=!!x.roughnessMap,O=x.anisotropy>0,pn=x.clearcoat>0,jt=x.dispersion>0,C=x.iridescence>0,m=x.sheen>0,U=x.transmission>0,P=O&&!!x.anisotropyMap,F=pn&&!!x.clearcoatMap,j=pn&&!!x.clearcoatNormalMap,lt=pn&&!!x.clearcoatRoughnessMap,Y=C&&!!x.iridescenceMap,J=C&&!!x.iridescenceThicknessMap,ct=m&&!!x.sheenColorMap,Mt=m&&!!x.sheenRoughnessMap,dt=!!x.specularMap,ht=!!x.specularColorMap,Rt=!!x.specularIntensityMap,Nt=U&&!!x.transmissionMap,Bt=U&&!!x.thicknessMap,I=!!x.gradientMap,ut=!!x.alphaMap,K=x.alphaTest>0,ft=!!x.alphaHash,_t=!!x.extensions,tt=Mi;x.toneMapped&&(it===null||it.isXRRenderTarget===!0)&&(tt=e.toneMapping);let Tt={shaderID:at,shaderType:x.type,shaderName:x.name,vertexShader:de,fragmentShader:Ht,defines:x.defines,customVertexShaderID:Z,customFragmentShaderID:rt,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:u,batching:St,batchingColor:St&&L._colorsTexture!==null,instancing:Ot,instancingColor:Ot&&L.instanceColor!==null,instancingMorph:Ot&&L.morphTexture!==null,outputColorSpace:it===null?e.outputColorSpace:it.isXRRenderTarget===!0?it.texture.colorSpace:$t.workingColorSpace,alphaToCoverage:!!x.alphaToCoverage,map:Ae,matcap:Gt,envMap:se,envMapMode:se&&Q.mapping,envMapCubeUVHeight:et,aoMap:Kt,lightMap:qt,bumpMap:Ne,normalMap:Be,displacementMap:ke,emissiveMap:Je,normalMapObjectSpace:Be&&x.normalMapType===wb,normalMapTangentSpace:Be&&x.normalMapType===a0,packedNormalMap:Be&&x.normalMapType===a0&&L2(x.normalMap.format),metalnessMap:we,roughnessMap:Le,anisotropy:O,anisotropyMap:P,clearcoat:pn,clearcoatMap:F,clearcoatNormalMap:j,clearcoatRoughnessMap:lt,dispersion:jt,iridescence:C,iridescenceMap:Y,iridescenceThicknessMap:J,sheen:m,sheenColorMap:ct,sheenRoughnessMap:Mt,specularMap:dt,specularColorMap:ht,specularIntensityMap:Rt,transmission:U,transmissionMap:Nt,thicknessMap:Bt,gradientMap:I,opaque:x.transparent===!1&&x.blending===Ja&&x.alphaToCoverage===!1,alphaMap:ut,alphaTest:K,alphaHash:ft,combine:x.combine,mapUv:Ae&&_(x.map.channel),aoMapUv:Kt&&_(x.aoMap.channel),lightMapUv:qt&&_(x.lightMap.channel),bumpMapUv:Ne&&_(x.bumpMap.channel),normalMapUv:Be&&_(x.normalMap.channel),displacementMapUv:ke&&_(x.displacementMap.channel),emissiveMapUv:Je&&_(x.emissiveMap.channel),metalnessMapUv:we&&_(x.metalnessMap.channel),roughnessMapUv:Le&&_(x.roughnessMap.channel),anisotropyMapUv:P&&_(x.anisotropyMap.channel),clearcoatMapUv:F&&_(x.clearcoatMap.channel),clearcoatNormalMapUv:j&&_(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:lt&&_(x.clearcoatRoughnessMap.channel),iridescenceMapUv:Y&&_(x.iridescenceMap.channel),iridescenceThicknessMapUv:J&&_(x.iridescenceThicknessMap.channel),sheenColorMapUv:ct&&_(x.sheenColorMap.channel),sheenRoughnessMapUv:Mt&&_(x.sheenRoughnessMap.channel),specularMapUv:dt&&_(x.specularMap.channel),specularColorMapUv:ht&&_(x.specularColorMap.channel),specularIntensityMapUv:Rt&&_(x.specularIntensityMap.channel),transmissionMapUv:Nt&&_(x.transmissionMap.channel),thicknessMapUv:Bt&&_(x.thicknessMap.channel),alphaMapUv:ut&&_(x.alphaMap.channel),vertexTangents:!!z.attributes.tangent&&(Be||O),vertexNormals:!!z.attributes.normal,vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!z.attributes.color&&z.attributes.color.itemSize===4,pointsUvs:L.isPoints===!0&&!!z.attributes.uv&&(Ae||ut),fog:!!X,useFog:x.fog===!0,fogExp2:!!X&&X.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||z.attributes.normal===void 0&&Be===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:p,reversedDepthBuffer:At,skinning:L.isSkinnedMesh===!0,hasPositionAttribute:z.attributes.position!==void 0,morphTargets:z.morphAttributes.position!==void 0,morphNormals:z.morphAttributes.normal!==void 0,morphColors:z.morphAttributes.color!==void 0,morphTargetsCount:vt,morphTextureStride:kt,numDirLights:T.directional.length,numPointLights:T.point.length,numSpotLights:T.spot.length,numSpotLightMaps:T.spotLightMap.length,numRectAreaLights:T.rectArea.length,numHemiLights:T.hemi.length,numDirLightShadows:T.directionalShadowMap.length,numPointLightShadows:T.pointShadowMap.length,numSpotLightShadows:T.spotShadowMap.length,numSpotLightShadowsWithMaps:T.numSpotLightShadowsWithMaps,numLightProbes:T.numLightProbes,numLightProbeGrids:k.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:x.dithering,shadowMapEnabled:e.shadowMap.enabled&&R.length>0,shadowMapType:e.shadowMap.type,toneMapping:tt,decodeVideoTexture:Ae&&x.map.isVideoTexture===!0&&$t.getTransfer(x.map.colorSpace)===oe,decodeVideoTextureEmissive:Je&&x.emissiveMap.isVideoTexture===!0&&$t.getTransfer(x.emissiveMap.colorSpace)===oe,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===Xi,flipSided:x.side===An,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:_t&&x.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(_t&&x.extensions.multiDraw===!0||St)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return Tt.vertexUv1s=l.has(1),Tt.vertexUv2s=l.has(2),Tt.vertexUv3s=l.has(3),l.clear(),Tt}function g(x){let T=[];if(x.shaderID?T.push(x.shaderID):(T.push(x.customVertexShaderID),T.push(x.customFragmentShaderID)),x.defines!==void 0)for(let R in x.defines)T.push(R),T.push(x.defines[R]);return x.isRawShaderMaterial===!1&&(f(T,x),v(T,x),T.push(e.outputColorSpace)),T.push(x.customProgramCacheKey),T.join()}function f(x,T){x.push(T.precision),x.push(T.outputColorSpace),x.push(T.envMapMode),x.push(T.envMapCubeUVHeight),x.push(T.mapUv),x.push(T.alphaMapUv),x.push(T.lightMapUv),x.push(T.aoMapUv),x.push(T.bumpMapUv),x.push(T.normalMapUv),x.push(T.displacementMapUv),x.push(T.emissiveMapUv),x.push(T.metalnessMapUv),x.push(T.roughnessMapUv),x.push(T.anisotropyMapUv),x.push(T.clearcoatMapUv),x.push(T.clearcoatNormalMapUv),x.push(T.clearcoatRoughnessMapUv),x.push(T.iridescenceMapUv),x.push(T.iridescenceThicknessMapUv),x.push(T.sheenColorMapUv),x.push(T.sheenRoughnessMapUv),x.push(T.specularMapUv),x.push(T.specularColorMapUv),x.push(T.specularIntensityMapUv),x.push(T.transmissionMapUv),x.push(T.thicknessMapUv),x.push(T.combine),x.push(T.fogExp2),x.push(T.sizeAttenuation),x.push(T.morphTargetsCount),x.push(T.morphAttributeCount),x.push(T.numDirLights),x.push(T.numPointLights),x.push(T.numSpotLights),x.push(T.numSpotLightMaps),x.push(T.numHemiLights),x.push(T.numRectAreaLights),x.push(T.numDirLightShadows),x.push(T.numPointLightShadows),x.push(T.numSpotLightShadows),x.push(T.numSpotLightShadowsWithMaps),x.push(T.numLightProbes),x.push(T.shadowMapType),x.push(T.toneMapping),x.push(T.numClippingPlanes),x.push(T.numClipIntersection),x.push(T.depthPacking)}function v(x,T){r.disableAll(),T.instancing&&r.enable(0),T.instancingColor&&r.enable(1),T.instancingMorph&&r.enable(2),T.matcap&&r.enable(3),T.envMap&&r.enable(4),T.normalMapObjectSpace&&r.enable(5),T.normalMapTangentSpace&&r.enable(6),T.clearcoat&&r.enable(7),T.iridescence&&r.enable(8),T.alphaTest&&r.enable(9),T.vertexColors&&r.enable(10),T.vertexAlphas&&r.enable(11),T.vertexUv1s&&r.enable(12),T.vertexUv2s&&r.enable(13),T.vertexUv3s&&r.enable(14),T.vertexTangents&&r.enable(15),T.anisotropy&&r.enable(16),T.alphaHash&&r.enable(17),T.batching&&r.enable(18),T.dispersion&&r.enable(19),T.batchingColor&&r.enable(20),T.gradientMap&&r.enable(21),T.packedNormalMap&&r.enable(22),T.vertexNormals&&r.enable(23),x.push(r.mask),r.disableAll(),T.fog&&r.enable(0),T.useFog&&r.enable(1),T.flatShading&&r.enable(2),T.logarithmicDepthBuffer&&r.enable(3),T.reversedDepthBuffer&&r.enable(4),T.skinning&&r.enable(5),T.morphTargets&&r.enable(6),T.morphNormals&&r.enable(7),T.morphColors&&r.enable(8),T.premultipliedAlpha&&r.enable(9),T.shadowMapEnabled&&r.enable(10),T.doubleSided&&r.enable(11),T.flipSided&&r.enable(12),T.useDepthPacking&&r.enable(13),T.dithering&&r.enable(14),T.transmission&&r.enable(15),T.sheen&&r.enable(16),T.opaque&&r.enable(17),T.pointsUvs&&r.enable(18),T.decodeVideoTexture&&r.enable(19),T.decodeVideoTextureEmissive&&r.enable(20),T.alphaToCoverage&&r.enable(21),T.numLightProbeGrids>0&&r.enable(22),T.hasPositionAttribute&&r.enable(23),x.push(r.mask)}function S(x){let T=d[x.type],R;if(T){let D=Zi[T];R=Fb.clone(D.uniforms)}else R=x.uniforms;return R}function y(x,T){let R=h.get(T);return R!==void 0?++R.usedTimes:(R=new U2(e,T,x,s),c.push(R),h.set(T,R)),R}function E(x){if(--x.usedTimes===0){let T=c.indexOf(x);c[T]=c[c.length-1],c.pop(),h.delete(x.cacheKey),x.destroy()}}function A(x){o.remove(x)}function w(){o.dispose()}return{getParameters:b,getProgramCacheKey:g,getUniforms:S,acquireProgram:y,releaseProgram:E,releaseShaderCache:A,programs:c,dispose:w}}function O2(){let e=new WeakMap;function t(r){return e.has(r)}function n(r){let o=e.get(r);return o===void 0&&(o={},e.set(r,o)),o}function i(r){e.delete(r)}function s(r,o,l){e.get(r)[o]=l}function a(){e=new WeakMap}return{has:t,get:n,remove:i,update:s,dispose:a}}function P2(e,t){return e.groupOrder!==t.groupOrder?e.groupOrder-t.groupOrder:e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.material.id!==t.material.id?e.material.id-t.material.id:e.materialVariant!==t.materialVariant?e.materialVariant-t.materialVariant:e.z!==t.z?e.z-t.z:e.id-t.id}function aM(e,t){return e.groupOrder!==t.groupOrder?e.groupOrder-t.groupOrder:e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.z!==t.z?t.z-e.z:e.id-t.id}function rM(){let e=[],t=0,n=[],i=[],s=[];function a(){t=0,n.length=0,i.length=0,s.length=0}function r(u){let d=0;return u.isInstancedMesh&&(d+=2),u.isSkinnedMesh&&(d+=1),d}function o(u,d,_,b,g,f){let v=e[t];return v===void 0?(v={id:u.id,object:u,geometry:d,material:_,materialVariant:r(u),groupOrder:b,renderOrder:u.renderOrder,z:g,group:f},e[t]=v):(v.id=u.id,v.object=u,v.geometry=d,v.material=_,v.materialVariant=r(u),v.groupOrder=b,v.renderOrder=u.renderOrder,v.z=g,v.group=f),t++,v}function l(u,d,_,b,g,f){let v=o(u,d,_,b,g,f);_.transmission>0?i.push(v):_.transparent===!0?s.push(v):n.push(v)}function c(u,d,_,b,g,f){let v=o(u,d,_,b,g,f);_.transmission>0?i.unshift(v):_.transparent===!0?s.unshift(v):n.unshift(v)}function h(u,d,_){n.length>1&&n.sort(u||P2),i.length>1&&i.sort(d||aM),s.length>1&&s.sort(d||aM),_&&(n.reverse(),i.reverse(),s.reverse())}function p(){for(let u=t,d=e.length;u<d;u++){let _=e[u];if(_.id===null)break;_.id=null,_.object=null,_.geometry=null,_.material=null,_.group=null}}return{opaque:n,transmissive:i,transparent:s,init:a,push:l,unshift:c,finish:p,sort:h}}function z2(){let e=new WeakMap;function t(i,s){let a=e.get(i),r;return a===void 0?(r=new rM,e.set(i,[r])):s>=a.length?(r=new rM,a.push(r)):r=a[s],r}function n(){e=new WeakMap}return{get:t,dispose:n}}function B2(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"DirectionalLight":n={direction:new N,color:new te};break;case"SpotLight":n={position:new N,direction:new N,color:new te,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":n={position:new N,color:new te,distance:0,decay:0};break;case"HemisphereLight":n={direction:new N,skyColor:new te,groundColor:new te};break;case"RectAreaLight":n={color:new te,position:new N,halfWidth:new N,halfHeight:new N};break}return e[t.id]=n,n}}}function F2(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"DirectionalLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Dt};break;case"SpotLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Dt};break;case"PointLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Dt,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[t.id]=n,n}}}var V2=0;function H2(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+(t.map?1:0)-(e.map?1:0)}function G2(e){let t=new B2,n=F2(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new N);let s=new N,a=new De,r=new De;function o(c){let h=0,p=0,u=0;for(let T=0;T<9;T++)i.probe[T].set(0,0,0);let d=0,_=0,b=0,g=0,f=0,v=0,S=0,y=0,E=0,A=0,w=0;c.sort(H2);for(let T=0,R=c.length;T<R;T++){let D=c[T],L=D.color,k=D.intensity,X=D.distance,z=null;if(D.shadow&&D.shadow.map&&(D.shadow.map.texture.format===xa?z=D.shadow.map.texture:z=D.shadow.map.depthTexture||D.shadow.map.texture),D.isAmbientLight)h+=L.r*k,p+=L.g*k,u+=L.b*k;else if(D.isLightProbe){for(let G=0;G<9;G++)i.probe[G].addScaledVector(D.sh.coefficients[G],k);w++}else if(D.isDirectionalLight){let G=t.get(D);if(G.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){let W=D.shadow,Q=n.get(D);Q.shadowIntensity=W.intensity,Q.shadowBias=W.bias,Q.shadowNormalBias=W.normalBias,Q.shadowRadius=W.radius,Q.shadowMapSize=W.mapSize,i.directionalShadow[d]=Q,i.directionalShadowMap[d]=z,i.directionalShadowMatrix[d]=D.shadow.matrix,v++}i.directional[d]=G,d++}else if(D.isSpotLight){let G=t.get(D);G.position.setFromMatrixPosition(D.matrixWorld),G.color.copy(L).multiplyScalar(k),G.distance=X,G.coneCos=Math.cos(D.angle),G.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),G.decay=D.decay,i.spot[b]=G;let W=D.shadow;if(D.map&&(i.spotLightMap[E]=D.map,E++,W.updateMatrices(D),D.castShadow&&A++),i.spotLightMatrix[b]=W.matrix,D.castShadow){let Q=n.get(D);Q.shadowIntensity=W.intensity,Q.shadowBias=W.bias,Q.shadowNormalBias=W.normalBias,Q.shadowRadius=W.radius,Q.shadowMapSize=W.mapSize,i.spotShadow[b]=Q,i.spotShadowMap[b]=z,y++}b++}else if(D.isRectAreaLight){let G=t.get(D);G.color.copy(L).multiplyScalar(k),G.halfWidth.set(D.width*.5,0,0),G.halfHeight.set(0,D.height*.5,0),i.rectArea[g]=G,g++}else if(D.isPointLight){let G=t.get(D);if(G.color.copy(D.color).multiplyScalar(D.intensity),G.distance=D.distance,G.decay=D.decay,D.castShadow){let W=D.shadow,Q=n.get(D);Q.shadowIntensity=W.intensity,Q.shadowBias=W.bias,Q.shadowNormalBias=W.normalBias,Q.shadowRadius=W.radius,Q.shadowMapSize=W.mapSize,Q.shadowCameraNear=W.camera.near,Q.shadowCameraFar=W.camera.far,i.pointShadow[_]=Q,i.pointShadowMap[_]=z,i.pointShadowMatrix[_]=D.shadow.matrix,S++}i.point[_]=G,_++}else if(D.isHemisphereLight){let G=t.get(D);G.skyColor.copy(D.color).multiplyScalar(k),G.groundColor.copy(D.groundColor).multiplyScalar(k),i.hemi[f]=G,f++}}g>0&&(e.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=pt.LTC_FLOAT_1,i.rectAreaLTC2=pt.LTC_FLOAT_2):(i.rectAreaLTC1=pt.LTC_HALF_1,i.rectAreaLTC2=pt.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=p,i.ambient[2]=u;let x=i.hash;(x.directionalLength!==d||x.pointLength!==_||x.spotLength!==b||x.rectAreaLength!==g||x.hemiLength!==f||x.numDirectionalShadows!==v||x.numPointShadows!==S||x.numSpotShadows!==y||x.numSpotMaps!==E||x.numLightProbes!==w)&&(i.directional.length=d,i.spot.length=b,i.rectArea.length=g,i.point.length=_,i.hemi.length=f,i.directionalShadow.length=v,i.directionalShadowMap.length=v,i.pointShadow.length=S,i.pointShadowMap.length=S,i.spotShadow.length=y,i.spotShadowMap.length=y,i.directionalShadowMatrix.length=v,i.pointShadowMatrix.length=S,i.spotLightMatrix.length=y+E-A,i.spotLightMap.length=E,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=w,x.directionalLength=d,x.pointLength=_,x.spotLength=b,x.rectAreaLength=g,x.hemiLength=f,x.numDirectionalShadows=v,x.numPointShadows=S,x.numSpotShadows=y,x.numSpotMaps=E,x.numLightProbes=w,i.version=V2++)}function l(c,h){let p=0,u=0,d=0,_=0,b=0,g=h.matrixWorldInverse;for(let f=0,v=c.length;f<v;f++){let S=c[f];if(S.isDirectionalLight){let y=i.directional[p];y.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),y.direction.sub(s),y.direction.transformDirection(g),p++}else if(S.isSpotLight){let y=i.spot[d];y.position.setFromMatrixPosition(S.matrixWorld),y.position.applyMatrix4(g),y.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),y.direction.sub(s),y.direction.transformDirection(g),d++}else if(S.isRectAreaLight){let y=i.rectArea[_];y.position.setFromMatrixPosition(S.matrixWorld),y.position.applyMatrix4(g),r.identity(),a.copy(S.matrixWorld),a.premultiply(g),r.extractRotation(a),y.halfWidth.set(S.width*.5,0,0),y.halfHeight.set(0,S.height*.5,0),y.halfWidth.applyMatrix4(r),y.halfHeight.applyMatrix4(r),_++}else if(S.isPointLight){let y=i.point[u];y.position.setFromMatrixPosition(S.matrixWorld),y.position.applyMatrix4(g),u++}else if(S.isHemisphereLight){let y=i.hemi[b];y.direction.setFromMatrixPosition(S.matrixWorld),y.direction.transformDirection(g),b++}}}return{setup:o,setupView:l,state:i}}function oM(e){let t=new G2(e),n=[],i=[],s=[];function a(u){p.camera=u,n.length=0,i.length=0,s.length=0}function r(u){n.push(u)}function o(u){i.push(u)}function l(u){s.push(u)}function c(){t.setup(n)}function h(u){t.setupView(n,u)}let p={lightsArray:n,shadowsArray:i,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:p,setupLights:c,setupLightsView:h,pushLight:r,pushShadow:o,pushLightProbeGrid:l}}function k2(e){let t=new WeakMap;function n(s,a=0){let r=t.get(s),o;return r===void 0?(o=new oM(e),t.set(s,[o])):a>=r.length?(o=new oM(e),r.push(o)):o=r[a],o}function i(){t=new WeakMap}return{get:n,dispose:i}}var X2=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,W2=`uniform sampler2D shadow_pass;
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
}`,q2=[new N(1,0,0),new N(-1,0,0),new N(0,1,0),new N(0,-1,0),new N(0,0,1),new N(0,0,-1)],Y2=[new N(0,-1,0),new N(0,-1,0),new N(0,0,1),new N(0,0,-1),new N(0,-1,0),new N(0,-1,0)],lM=new De,pc=new N,v0=new N;function Z2(e,t,n){let i=new Xl,s=new Dt,a=new Dt,r=new Ue,o=new rf,l=new of,c={},h=n.maxTextureSize,p={[bs]:An,[An]:bs,[Xi]:Xi},u=new jn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Dt},radius:{value:4}},vertexShader:X2,fragmentShader:W2}),d=u.clone();d.defines.HORIZONTAL_PASS=1;let _=new on;_.setAttribute("position",new Zn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let b=new Qe(_,u),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=ic;let f=this.type;this.render=function(A,w,x){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||A.length===0)return;this.type===sb&&(Ut("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=ic);let T=e.getRenderTarget(),R=e.getActiveCubeFace(),D=e.getActiveMipmapLevel(),L=e.state;L.setBlending(Wi),L.buffers.depth.getReversed()===!0?L.buffers.color.setClear(0,0,0,0):L.buffers.color.setClear(1,1,1,1),L.buffers.depth.setTest(!0),L.setScissorTest(!1);let k=f!==this.type;k&&w.traverse(function(X){X.material&&(Array.isArray(X.material)?X.material.forEach(z=>z.needsUpdate=!0):X.material.needsUpdate=!0)});for(let X=0,z=A.length;X<z;X++){let G=A[X],W=G.shadow;if(W===void 0){Ut("WebGLShadowMap:",G,"has no shadow.");continue}if(W.autoUpdate===!1&&W.needsUpdate===!1)continue;s.copy(W.mapSize);let Q=W.getFrameExtents();s.multiply(Q),a.copy(W.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(a.x=Math.floor(h/Q.x),s.x=a.x*Q.x,W.mapSize.x=a.x),s.y>h&&(a.y=Math.floor(h/Q.y),s.y=a.y*Q.y,W.mapSize.y=a.y));let et=e.state.buffers.depth.getReversed();if(W.camera._reversedDepth=et,W.map===null||k===!0){if(W.map!==null&&(W.map.depthTexture!==null&&(W.map.depthTexture.dispose(),W.map.depthTexture=null),W.map.dispose()),this.type===_o){if(G.isPointLight){Ut("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}W.map=new Jn(s.x,s.y,{format:xa,type:qi,minFilter:dn,magFilter:dn,generateMipmaps:!1}),W.map.texture.name=G.name+".shadowMap",W.map.depthTexture=new Ms(s.x,s.y,Ti),W.map.depthTexture.name=G.name+".shadowMapDepth",W.map.depthTexture.format=Hi,W.map.depthTexture.compareFunction=null,W.map.depthTexture.minFilter=rn,W.map.depthTexture.magFilter=rn}else G.isPointLight?(W.map=new hd(s.x),W.map.depthTexture=new Jh(s.x,Ei)):(W.map=new Jn(s.x,s.y),W.map.depthTexture=new Ms(s.x,s.y,Ei)),W.map.depthTexture.name=G.name+".shadowMap",W.map.depthTexture.format=Hi,this.type===ic?(W.map.depthTexture.compareFunction=et?od:rd,W.map.depthTexture.minFilter=dn,W.map.depthTexture.magFilter=dn):(W.map.depthTexture.compareFunction=null,W.map.depthTexture.minFilter=rn,W.map.depthTexture.magFilter=rn);W.camera.updateProjectionMatrix()}let at=W.map.isWebGLCubeRenderTarget?6:1;for(let ot=0;ot<at;ot++){if(W.map.isWebGLCubeRenderTarget)e.setRenderTarget(W.map,ot),e.clear();else{ot===0&&(e.setRenderTarget(W.map),e.clear());let vt=W.getViewport(ot);r.set(a.x*vt.x,a.y*vt.y,a.x*vt.z,a.y*vt.w),L.viewport(r)}if(G.isPointLight){let vt=W.camera,kt=W.matrix,de=G.distance||vt.far;de!==vt.far&&(vt.far=de,vt.updateProjectionMatrix()),pc.setFromMatrixPosition(G.matrixWorld),vt.position.copy(pc),v0.copy(vt.position),v0.add(q2[ot]),vt.up.copy(Y2[ot]),vt.lookAt(v0),vt.updateMatrixWorld(),kt.makeTranslation(-pc.x,-pc.y,-pc.z),lM.multiplyMatrices(vt.projectionMatrix,vt.matrixWorldInverse),W._frustum.setFromProjectionMatrix(lM,vt.coordinateSystem,vt.reversedDepth)}else W.updateMatrices(G);i=W.getFrustum(),y(w,x,W.camera,G,this.type)}W.isPointLightShadow!==!0&&this.type===_o&&v(W,x),W.needsUpdate=!1}f=this.type,g.needsUpdate=!1,e.setRenderTarget(T,R,D)};function v(A,w){let x=t.update(b);u.defines.VSM_SAMPLES!==A.blurSamples&&(u.defines.VSM_SAMPLES=A.blurSamples,d.defines.VSM_SAMPLES=A.blurSamples,u.needsUpdate=!0,d.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new Jn(s.x,s.y,{format:xa,type:qi})),u.uniforms.shadow_pass.value=A.map.depthTexture,u.uniforms.resolution.value=A.mapSize,u.uniforms.radius.value=A.radius,e.setRenderTarget(A.mapPass),e.clear(),e.renderBufferDirect(w,null,x,u,b,null),d.uniforms.shadow_pass.value=A.mapPass.texture,d.uniforms.resolution.value=A.mapSize,d.uniforms.radius.value=A.radius,e.setRenderTarget(A.map),e.clear(),e.renderBufferDirect(w,null,x,d,b,null)}function S(A,w,x,T){let R=null,D=x.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(D!==void 0)R=D;else if(R=x.isPointLight===!0?l:o,e.localClippingEnabled&&w.clipShadows===!0&&Array.isArray(w.clippingPlanes)&&w.clippingPlanes.length!==0||w.displacementMap&&w.displacementScale!==0||w.alphaMap&&w.alphaTest>0||w.map&&w.alphaTest>0||w.alphaToCoverage===!0){let L=R.uuid,k=w.uuid,X=c[L];X===void 0&&(X={},c[L]=X);let z=X[k];z===void 0&&(z=R.clone(),X[k]=z,w.addEventListener("dispose",E)),R=z}if(R.visible=w.visible,R.wireframe=w.wireframe,T===_o?R.side=w.shadowSide!==null?w.shadowSide:w.side:R.side=w.shadowSide!==null?w.shadowSide:p[w.side],R.alphaMap=w.alphaMap,R.alphaTest=w.alphaToCoverage===!0?.5:w.alphaTest,R.map=w.map,R.clipShadows=w.clipShadows,R.clippingPlanes=w.clippingPlanes,R.clipIntersection=w.clipIntersection,R.displacementMap=w.displacementMap,R.displacementScale=w.displacementScale,R.displacementBias=w.displacementBias,R.wireframeLinewidth=w.wireframeLinewidth,R.linewidth=w.linewidth,x.isPointLight===!0&&R.isMeshDistanceMaterial===!0){let L=e.properties.get(R);L.light=x}return R}function y(A,w,x,T,R){if(A.visible===!1)return;if(A.layers.test(w.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&R===_o)&&(!A.frustumCulled||i.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(x.matrixWorldInverse,A.matrixWorld);let k=t.update(A),X=A.material;if(Array.isArray(X)){let z=k.groups;for(let G=0,W=z.length;G<W;G++){let Q=z[G],et=X[Q.materialIndex];if(et&&et.visible){let at=S(A,et,T,R);A.onBeforeShadow(e,A,w,x,k,at,Q),e.renderBufferDirect(x,null,k,at,A,Q),A.onAfterShadow(e,A,w,x,k,at,Q)}}}else if(X.visible){let z=S(A,X,T,R);A.onBeforeShadow(e,A,w,x,k,z,null),e.renderBufferDirect(x,null,k,z,A,null),A.onAfterShadow(e,A,w,x,k,z,null)}}let L=A.children;for(let k=0,X=L.length;k<X;k++)y(L[k],w,x,T,R)}function E(A){A.target.removeEventListener("dispose",E);for(let x in c){let T=c[x],R=A.target.uuid;R in T&&(T[R].dispose(),delete T[R])}}}function J2(e,t){function n(){let I=!1,ut=new Ue,K=null,ft=new Ue(0,0,0,0);return{setMask:function(_t){K!==_t&&!I&&(e.colorMask(_t,_t,_t,_t),K=_t)},setLocked:function(_t){I=_t},setClear:function(_t,tt,Tt,bt,Ie){Ie===!0&&(_t*=bt,tt*=bt,Tt*=bt),ut.set(_t,tt,Tt,bt),ft.equals(ut)===!1&&(e.clearColor(_t,tt,Tt,bt),ft.copy(ut))},reset:function(){I=!1,K=null,ft.set(-1,0,0,0)}}}function i(){let I=!1,ut=!1,K=null,ft=null,_t=null;return{setReversed:function(tt){if(ut!==tt){let Tt=t.get("EXT_clip_control");tt?Tt.clipControlEXT(Tt.LOWER_LEFT_EXT,Tt.ZERO_TO_ONE_EXT):Tt.clipControlEXT(Tt.LOWER_LEFT_EXT,Tt.NEGATIVE_ONE_TO_ONE_EXT),ut=tt;let bt=_t;_t=null,this.setClear(bt)}},getReversed:function(){return ut},setTest:function(tt){tt?it(e.DEPTH_TEST):At(e.DEPTH_TEST)},setMask:function(tt){K!==tt&&!I&&(e.depthMask(tt),K=tt)},setFunc:function(tt){if(ut&&(tt=zb[tt]),ft!==tt){switch(tt){case Nh:e.depthFunc(e.NEVER);break;case Lh:e.depthFunc(e.ALWAYS);break;case Ih:e.depthFunc(e.LESS);break;case Ka:e.depthFunc(e.LEQUAL);break;case Oh:e.depthFunc(e.EQUAL);break;case Ph:e.depthFunc(e.GEQUAL);break;case zh:e.depthFunc(e.GREATER);break;case Bh:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}ft=tt}},setLocked:function(tt){I=tt},setClear:function(tt){_t!==tt&&(_t=tt,ut&&(tt=1-tt),e.clearDepth(tt))},reset:function(){I=!1,K=null,ft=null,_t=null,ut=!1}}}function s(){let I=!1,ut=null,K=null,ft=null,_t=null,tt=null,Tt=null,bt=null,Ie=null;return{setTest:function(_e){I||(_e?it(e.STENCIL_TEST):At(e.STENCIL_TEST))},setMask:function(_e){ut!==_e&&!I&&(e.stencilMask(_e),ut=_e)},setFunc:function(_e,Ai,wi){(K!==_e||ft!==Ai||_t!==wi)&&(e.stencilFunc(_e,Ai,wi),K=_e,ft=Ai,_t=wi)},setOp:function(_e,Ai,wi){(tt!==_e||Tt!==Ai||bt!==wi)&&(e.stencilOp(_e,Ai,wi),tt=_e,Tt=Ai,bt=wi)},setLocked:function(_e){I=_e},setClear:function(_e){Ie!==_e&&(e.clearStencil(_e),Ie=_e)},reset:function(){I=!1,ut=null,K=null,ft=null,_t=null,tt=null,Tt=null,bt=null,Ie=null}}}let a=new n,r=new i,o=new s,l=new WeakMap,c=new WeakMap,h={},p={},u={},d=new WeakMap,_=[],b=null,g=!1,f=null,v=null,S=null,y=null,E=null,A=null,w=null,x=new te(0,0,0),T=0,R=!1,D=null,L=null,k=null,X=null,z=null,G=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),W=!1,Q=0,et=e.getParameter(e.VERSION);et.indexOf("WebGL")!==-1?(Q=parseFloat(/^WebGL (\d)/.exec(et)[1]),W=Q>=1):et.indexOf("OpenGL ES")!==-1&&(Q=parseFloat(/^OpenGL ES (\d)/.exec(et)[1]),W=Q>=2);let at=null,ot={},vt=e.getParameter(e.SCISSOR_BOX),kt=e.getParameter(e.VIEWPORT),de=new Ue().fromArray(vt),Ht=new Ue().fromArray(kt);function Z(I,ut,K,ft){let _t=new Uint8Array(4),tt=e.createTexture();e.bindTexture(I,tt),e.texParameteri(I,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(I,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let Tt=0;Tt<K;Tt++)I===e.TEXTURE_3D||I===e.TEXTURE_2D_ARRAY?e.texImage3D(ut,0,e.RGBA,1,1,ft,0,e.RGBA,e.UNSIGNED_BYTE,_t):e.texImage2D(ut+Tt,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,_t);return tt}let rt={};rt[e.TEXTURE_2D]=Z(e.TEXTURE_2D,e.TEXTURE_2D,1),rt[e.TEXTURE_CUBE_MAP]=Z(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),rt[e.TEXTURE_2D_ARRAY]=Z(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),rt[e.TEXTURE_3D]=Z(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),r.setClear(1),o.setClear(0),it(e.DEPTH_TEST),r.setFunc(Ka),Ne(!1),Be(Fg),it(e.CULL_FACE),Kt(Wi);function it(I){h[I]!==!0&&(e.enable(I),h[I]=!0)}function At(I){h[I]!==!1&&(e.disable(I),h[I]=!1)}function Ot(I,ut){return u[I]!==ut?(e.bindFramebuffer(I,ut),u[I]=ut,I===e.DRAW_FRAMEBUFFER&&(u[e.FRAMEBUFFER]=ut),I===e.FRAMEBUFFER&&(u[e.DRAW_FRAMEBUFFER]=ut),!0):!1}function St(I,ut){let K=_,ft=!1;if(I){K=d.get(ut),K===void 0&&(K=[],d.set(ut,K));let _t=I.textures;if(K.length!==_t.length||K[0]!==e.COLOR_ATTACHMENT0){for(let tt=0,Tt=_t.length;tt<Tt;tt++)K[tt]=e.COLOR_ATTACHMENT0+tt;K.length=_t.length,ft=!0}}else K[0]!==e.BACK&&(K[0]=e.BACK,ft=!0);ft&&e.drawBuffers(K)}function Ae(I){return b!==I?(e.useProgram(I),b=I,!0):!1}let Gt={[la]:e.FUNC_ADD,[rb]:e.FUNC_SUBTRACT,[ob]:e.FUNC_REVERSE_SUBTRACT};Gt[lb]=e.MIN,Gt[cb]=e.MAX;let se={[ub]:e.ZERO,[hb]:e.ONE,[fb]:e.SRC_COLOR,[Dh]:e.SRC_ALPHA,[vb]:e.SRC_ALPHA_SATURATE,[gb]:e.DST_COLOR,[pb]:e.DST_ALPHA,[db]:e.ONE_MINUS_SRC_COLOR,[Uh]:e.ONE_MINUS_SRC_ALPHA,[_b]:e.ONE_MINUS_DST_COLOR,[mb]:e.ONE_MINUS_DST_ALPHA,[yb]:e.CONSTANT_COLOR,[xb]:e.ONE_MINUS_CONSTANT_COLOR,[Sb]:e.CONSTANT_ALPHA,[bb]:e.ONE_MINUS_CONSTANT_ALPHA};function Kt(I,ut,K,ft,_t,tt,Tt,bt,Ie,_e){if(I===Wi){g===!0&&(At(e.BLEND),g=!1);return}if(g===!1&&(it(e.BLEND),g=!0),I!==ab){if(I!==f||_e!==R){if((v!==la||E!==la)&&(e.blendEquation(e.FUNC_ADD),v=la,E=la),_e)switch(I){case Ja:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Vg:e.blendFunc(e.ONE,e.ONE);break;case Hg:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case Gg:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:Lt("WebGLState: Invalid blending: ",I);break}else switch(I){case Ja:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Vg:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case Hg:Lt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Gg:Lt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Lt("WebGLState: Invalid blending: ",I);break}S=null,y=null,A=null,w=null,x.set(0,0,0),T=0,f=I,R=_e}return}_t=_t||ut,tt=tt||K,Tt=Tt||ft,(ut!==v||_t!==E)&&(e.blendEquationSeparate(Gt[ut],Gt[_t]),v=ut,E=_t),(K!==S||ft!==y||tt!==A||Tt!==w)&&(e.blendFuncSeparate(se[K],se[ft],se[tt],se[Tt]),S=K,y=ft,A=tt,w=Tt),(bt.equals(x)===!1||Ie!==T)&&(e.blendColor(bt.r,bt.g,bt.b,Ie),x.copy(bt),T=Ie),f=I,R=!1}function qt(I,ut){I.side===Xi?At(e.CULL_FACE):it(e.CULL_FACE);let K=I.side===An;ut&&(K=!K),Ne(K),I.blending===Ja&&I.transparent===!1?Kt(Wi):Kt(I.blending,I.blendEquation,I.blendSrc,I.blendDst,I.blendEquationAlpha,I.blendSrcAlpha,I.blendDstAlpha,I.blendColor,I.blendAlpha,I.premultipliedAlpha),r.setFunc(I.depthFunc),r.setTest(I.depthTest),r.setMask(I.depthWrite),a.setMask(I.colorWrite);let ft=I.stencilWrite;o.setTest(ft),ft&&(o.setMask(I.stencilWriteMask),o.setFunc(I.stencilFunc,I.stencilRef,I.stencilFuncMask),o.setOp(I.stencilFail,I.stencilZFail,I.stencilZPass)),Je(I.polygonOffset,I.polygonOffsetFactor,I.polygonOffsetUnits),I.alphaToCoverage===!0?it(e.SAMPLE_ALPHA_TO_COVERAGE):At(e.SAMPLE_ALPHA_TO_COVERAGE)}function Ne(I){D!==I&&(I?e.frontFace(e.CW):e.frontFace(e.CCW),D=I)}function Be(I){I!==nb?(it(e.CULL_FACE),I!==L&&(I===Fg?e.cullFace(e.BACK):I===ib?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))):At(e.CULL_FACE),L=I}function ke(I){I!==k&&(W&&e.lineWidth(I),k=I)}function Je(I,ut,K){I?(it(e.POLYGON_OFFSET_FILL),(X!==ut||z!==K)&&(X=ut,z=K,r.getReversed()&&(ut=-ut),e.polygonOffset(ut,K))):At(e.POLYGON_OFFSET_FILL)}function we(I){I?it(e.SCISSOR_TEST):At(e.SCISSOR_TEST)}function Le(I){I===void 0&&(I=e.TEXTURE0+G-1),at!==I&&(e.activeTexture(I),at=I)}function O(I,ut,K){K===void 0&&(at===null?K=e.TEXTURE0+G-1:K=at);let ft=ot[K];ft===void 0&&(ft={type:void 0,texture:void 0},ot[K]=ft),(ft.type!==I||ft.texture!==ut)&&(at!==K&&(e.activeTexture(K),at=K),e.bindTexture(I,ut||rt[I]),ft.type=I,ft.texture=ut)}function pn(){let I=ot[at];I!==void 0&&I.type!==void 0&&(e.bindTexture(I.type,null),I.type=void 0,I.texture=void 0)}function jt(){try{e.compressedTexImage2D(...arguments)}catch(I){Lt("WebGLState:",I)}}function C(){try{e.compressedTexImage3D(...arguments)}catch(I){Lt("WebGLState:",I)}}function m(){try{e.texSubImage2D(...arguments)}catch(I){Lt("WebGLState:",I)}}function U(){try{e.texSubImage3D(...arguments)}catch(I){Lt("WebGLState:",I)}}function P(){try{e.compressedTexSubImage2D(...arguments)}catch(I){Lt("WebGLState:",I)}}function F(){try{e.compressedTexSubImage3D(...arguments)}catch(I){Lt("WebGLState:",I)}}function j(){try{e.texStorage2D(...arguments)}catch(I){Lt("WebGLState:",I)}}function lt(){try{e.texStorage3D(...arguments)}catch(I){Lt("WebGLState:",I)}}function Y(){try{e.texImage2D(...arguments)}catch(I){Lt("WebGLState:",I)}}function J(){try{e.texImage3D(...arguments)}catch(I){Lt("WebGLState:",I)}}function ct(I){return p[I]!==void 0?p[I]:e.getParameter(I)}function Mt(I,ut){p[I]!==ut&&(e.pixelStorei(I,ut),p[I]=ut)}function dt(I){de.equals(I)===!1&&(e.scissor(I.x,I.y,I.z,I.w),de.copy(I))}function ht(I){Ht.equals(I)===!1&&(e.viewport(I.x,I.y,I.z,I.w),Ht.copy(I))}function Rt(I,ut){let K=c.get(ut);K===void 0&&(K=new WeakMap,c.set(ut,K));let ft=K.get(I);ft===void 0&&(ft=e.getUniformBlockIndex(ut,I.name),K.set(I,ft))}function Nt(I,ut){let ft=c.get(ut).get(I);l.get(ut)!==ft&&(e.uniformBlockBinding(ut,ft,I.__bindingPointIndex),l.set(ut,ft))}function Bt(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),r.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),h={},p={},at=null,ot={},u={},d=new WeakMap,_=[],b=null,g=!1,f=null,v=null,S=null,y=null,E=null,A=null,w=null,x=new te(0,0,0),T=0,R=!1,D=null,L=null,k=null,X=null,z=null,de.set(0,0,e.canvas.width,e.canvas.height),Ht.set(0,0,e.canvas.width,e.canvas.height),a.reset(),r.reset(),o.reset()}return{buffers:{color:a,depth:r,stencil:o},enable:it,disable:At,bindFramebuffer:Ot,drawBuffers:St,useProgram:Ae,setBlending:Kt,setMaterial:qt,setFlipSided:Ne,setCullFace:Be,setLineWidth:ke,setPolygonOffset:Je,setScissorTest:we,activeTexture:Le,bindTexture:O,unbindTexture:pn,compressedTexImage2D:jt,compressedTexImage3D:C,texImage2D:Y,texImage3D:J,pixelStorei:Mt,getParameter:ct,updateUBOMapping:Rt,uniformBlockBinding:Nt,texStorage2D:j,texStorage3D:lt,texSubImage2D:m,texSubImage3D:U,compressedTexSubImage2D:P,compressedTexSubImage3D:F,scissor:dt,viewport:ht,reset:Bt}}function K2(e,t,n,i,s,a,r){let o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Dt,h=new WeakMap,p=new Set,u,d=new WeakMap,_=!1;try{_=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function b(C,m){return _?new OffscreenCanvas(C,m):zl("canvas")}function g(C,m,U){let P=1,F=jt(C);if((F.width>U||F.height>U)&&(P=U/Math.max(F.width,F.height)),P<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){let j=Math.floor(P*F.width),lt=Math.floor(P*F.height);u===void 0&&(u=b(j,lt));let Y=m?b(j,lt):u;return Y.width=j,Y.height=lt,Y.getContext("2d").drawImage(C,0,0,j,lt),Ut("WebGLRenderer: Texture has been resized from ("+F.width+"x"+F.height+") to ("+j+"x"+lt+")."),Y}else return"data"in C&&Ut("WebGLRenderer: Image in DataTexture is too big ("+F.width+"x"+F.height+")."),C;return C}function f(C){return C.generateMipmaps}function v(C){e.generateMipmap(C)}function S(C){return C.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:C.isWebGL3DRenderTarget?e.TEXTURE_3D:C.isWebGLArrayRenderTarget||C.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function y(C,m,U,P,F,j=!1){if(C!==null){if(e[C]!==void 0)return e[C];Ut("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let lt;P&&(lt=t.get("EXT_texture_norm16"),lt||Ut("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Y=m;if(m===e.RED&&(U===e.FLOAT&&(Y=e.R32F),U===e.HALF_FLOAT&&(Y=e.R16F),U===e.UNSIGNED_BYTE&&(Y=e.R8),U===e.UNSIGNED_SHORT&&lt&&(Y=lt.R16_EXT),U===e.SHORT&&lt&&(Y=lt.R16_SNORM_EXT)),m===e.RED_INTEGER&&(U===e.UNSIGNED_BYTE&&(Y=e.R8UI),U===e.UNSIGNED_SHORT&&(Y=e.R16UI),U===e.UNSIGNED_INT&&(Y=e.R32UI),U===e.BYTE&&(Y=e.R8I),U===e.SHORT&&(Y=e.R16I),U===e.INT&&(Y=e.R32I)),m===e.RG&&(U===e.FLOAT&&(Y=e.RG32F),U===e.HALF_FLOAT&&(Y=e.RG16F),U===e.UNSIGNED_BYTE&&(Y=e.RG8),U===e.UNSIGNED_SHORT&&lt&&(Y=lt.RG16_EXT),U===e.SHORT&&lt&&(Y=lt.RG16_SNORM_EXT)),m===e.RG_INTEGER&&(U===e.UNSIGNED_BYTE&&(Y=e.RG8UI),U===e.UNSIGNED_SHORT&&(Y=e.RG16UI),U===e.UNSIGNED_INT&&(Y=e.RG32UI),U===e.BYTE&&(Y=e.RG8I),U===e.SHORT&&(Y=e.RG16I),U===e.INT&&(Y=e.RG32I)),m===e.RGB_INTEGER&&(U===e.UNSIGNED_BYTE&&(Y=e.RGB8UI),U===e.UNSIGNED_SHORT&&(Y=e.RGB16UI),U===e.UNSIGNED_INT&&(Y=e.RGB32UI),U===e.BYTE&&(Y=e.RGB8I),U===e.SHORT&&(Y=e.RGB16I),U===e.INT&&(Y=e.RGB32I)),m===e.RGBA_INTEGER&&(U===e.UNSIGNED_BYTE&&(Y=e.RGBA8UI),U===e.UNSIGNED_SHORT&&(Y=e.RGBA16UI),U===e.UNSIGNED_INT&&(Y=e.RGBA32UI),U===e.BYTE&&(Y=e.RGBA8I),U===e.SHORT&&(Y=e.RGBA16I),U===e.INT&&(Y=e.RGBA32I)),m===e.RGB&&(U===e.UNSIGNED_SHORT&&lt&&(Y=lt.RGB16_EXT),U===e.SHORT&&lt&&(Y=lt.RGB16_SNORM_EXT),U===e.UNSIGNED_INT_5_9_9_9_REV&&(Y=e.RGB9_E5),U===e.UNSIGNED_INT_10F_11F_11F_REV&&(Y=e.R11F_G11F_B10F)),m===e.RGBA){let J=j?Ol:$t.getTransfer(F);U===e.FLOAT&&(Y=e.RGBA32F),U===e.HALF_FLOAT&&(Y=e.RGBA16F),U===e.UNSIGNED_BYTE&&(Y=J===oe?e.SRGB8_ALPHA8:e.RGBA8),U===e.UNSIGNED_SHORT&&lt&&(Y=lt.RGBA16_EXT),U===e.SHORT&&lt&&(Y=lt.RGBA16_SNORM_EXT),U===e.UNSIGNED_SHORT_4_4_4_4&&(Y=e.RGBA4),U===e.UNSIGNED_SHORT_5_5_5_1&&(Y=e.RGB5_A1)}return(Y===e.R16F||Y===e.R32F||Y===e.RG16F||Y===e.RG32F||Y===e.RGBA16F||Y===e.RGBA32F)&&t.get("EXT_color_buffer_float"),Y}function E(C,m){let U;return C?m===null||m===Ei||m===yo?U=e.DEPTH24_STENCIL8:m===Ti?U=e.DEPTH32F_STENCIL8:m===vo&&(U=e.DEPTH24_STENCIL8,Ut("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):m===null||m===Ei||m===yo?U=e.DEPTH_COMPONENT24:m===Ti?U=e.DEPTH_COMPONENT32F:m===vo&&(U=e.DEPTH_COMPONENT16),U}function A(C,m){return f(C)===!0||C.isFramebufferTexture&&C.minFilter!==rn&&C.minFilter!==dn?Math.log2(Math.max(m.width,m.height))+1:C.mipmaps!==void 0&&C.mipmaps.length>0?C.mipmaps.length:C.isCompressedTexture&&Array.isArray(C.image)?m.mipmaps.length:1}function w(C){let m=C.target;m.removeEventListener("dispose",w),T(m),m.isVideoTexture&&h.delete(m),m.isHTMLTexture&&p.delete(m)}function x(C){let m=C.target;m.removeEventListener("dispose",x),D(m)}function T(C){let m=i.get(C);if(m.__webglInit===void 0)return;let U=C.source,P=d.get(U);if(P){let F=P[m.__cacheKey];F.usedTimes--,F.usedTimes===0&&R(C),Object.keys(P).length===0&&d.delete(U)}i.remove(C)}function R(C){let m=i.get(C);e.deleteTexture(m.__webglTexture);let U=C.source,P=d.get(U);delete P[m.__cacheKey],r.memory.textures--}function D(C){let m=i.get(C);if(C.depthTexture&&(C.depthTexture.dispose(),i.remove(C.depthTexture)),C.isWebGLCubeRenderTarget)for(let P=0;P<6;P++){if(Array.isArray(m.__webglFramebuffer[P]))for(let F=0;F<m.__webglFramebuffer[P].length;F++)e.deleteFramebuffer(m.__webglFramebuffer[P][F]);else e.deleteFramebuffer(m.__webglFramebuffer[P]);m.__webglDepthbuffer&&e.deleteRenderbuffer(m.__webglDepthbuffer[P])}else{if(Array.isArray(m.__webglFramebuffer))for(let P=0;P<m.__webglFramebuffer.length;P++)e.deleteFramebuffer(m.__webglFramebuffer[P]);else e.deleteFramebuffer(m.__webglFramebuffer);if(m.__webglDepthbuffer&&e.deleteRenderbuffer(m.__webglDepthbuffer),m.__webglMultisampledFramebuffer&&e.deleteFramebuffer(m.__webglMultisampledFramebuffer),m.__webglColorRenderbuffer)for(let P=0;P<m.__webglColorRenderbuffer.length;P++)m.__webglColorRenderbuffer[P]&&e.deleteRenderbuffer(m.__webglColorRenderbuffer[P]);m.__webglDepthRenderbuffer&&e.deleteRenderbuffer(m.__webglDepthRenderbuffer)}let U=C.textures;for(let P=0,F=U.length;P<F;P++){let j=i.get(U[P]);j.__webglTexture&&(e.deleteTexture(j.__webglTexture),r.memory.textures--),i.remove(U[P])}i.remove(C)}let L=0;function k(){L=0}function X(){return L}function z(C){L=C}function G(){let C=L;return C>=s.maxTextures&&Ut("WebGLTextures: Trying to use "+C+" texture units while this GPU supports only "+s.maxTextures),L+=1,C}function W(C){let m=[];return m.push(C.wrapS),m.push(C.wrapT),m.push(C.wrapR||0),m.push(C.magFilter),m.push(C.minFilter),m.push(C.anisotropy),m.push(C.internalFormat),m.push(C.format),m.push(C.type),m.push(C.generateMipmaps),m.push(C.premultiplyAlpha),m.push(C.flipY),m.push(C.unpackAlignment),m.push(C.colorSpace),m.join()}function Q(C,m){let U=i.get(C);if(C.isVideoTexture&&O(C),C.isRenderTargetTexture===!1&&C.isExternalTexture!==!0&&C.version>0&&U.__version!==C.version){let P=C.image;if(P===null)Ut("WebGLRenderer: Texture marked for update but no image data found.");else if(P.complete===!1)Ut("WebGLRenderer: Texture marked for update but image is incomplete");else{At(U,C,m);return}}else C.isExternalTexture&&(U.__webglTexture=C.sourceTexture?C.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,U.__webglTexture,e.TEXTURE0+m)}function et(C,m){let U=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&U.__version!==C.version){At(U,C,m);return}else C.isExternalTexture&&(U.__webglTexture=C.sourceTexture?C.sourceTexture:null);n.bindTexture(e.TEXTURE_2D_ARRAY,U.__webglTexture,e.TEXTURE0+m)}function at(C,m){let U=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&U.__version!==C.version){At(U,C,m);return}n.bindTexture(e.TEXTURE_3D,U.__webglTexture,e.TEXTURE0+m)}function ot(C,m){let U=i.get(C);if(C.isCubeDepthTexture!==!0&&C.version>0&&U.__version!==C.version){Ot(U,C,m);return}n.bindTexture(e.TEXTURE_CUBE_MAP,U.__webglTexture,e.TEXTURE0+m)}let vt={[Fh]:e.REPEAT,[Fi]:e.CLAMP_TO_EDGE,[Vh]:e.MIRRORED_REPEAT},kt={[rn]:e.NEAREST,[Tb]:e.NEAREST_MIPMAP_NEAREST,[ac]:e.NEAREST_MIPMAP_LINEAR,[dn]:e.LINEAR,[Mf]:e.LINEAR_MIPMAP_NEAREST,[va]:e.LINEAR_MIPMAP_LINEAR},de={[Cb]:e.NEVER,[Lb]:e.ALWAYS,[Rb]:e.LESS,[rd]:e.LEQUAL,[Db]:e.EQUAL,[od]:e.GEQUAL,[Ub]:e.GREATER,[Nb]:e.NOTEQUAL};function Ht(C,m){if(m.type===Ti&&t.has("OES_texture_float_linear")===!1&&(m.magFilter===dn||m.magFilter===Mf||m.magFilter===ac||m.magFilter===va||m.minFilter===dn||m.minFilter===Mf||m.minFilter===ac||m.minFilter===va)&&Ut("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),e.texParameteri(C,e.TEXTURE_WRAP_S,vt[m.wrapS]),e.texParameteri(C,e.TEXTURE_WRAP_T,vt[m.wrapT]),(C===e.TEXTURE_3D||C===e.TEXTURE_2D_ARRAY)&&e.texParameteri(C,e.TEXTURE_WRAP_R,vt[m.wrapR]),e.texParameteri(C,e.TEXTURE_MAG_FILTER,kt[m.magFilter]),e.texParameteri(C,e.TEXTURE_MIN_FILTER,kt[m.minFilter]),m.compareFunction&&(e.texParameteri(C,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(C,e.TEXTURE_COMPARE_FUNC,de[m.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(m.magFilter===rn||m.minFilter!==ac&&m.minFilter!==va||m.type===Ti&&t.has("OES_texture_float_linear")===!1)return;if(m.anisotropy>1||i.get(m).__currentAnisotropy){let U=t.get("EXT_texture_filter_anisotropic");e.texParameterf(C,U.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(m.anisotropy,s.getMaxAnisotropy())),i.get(m).__currentAnisotropy=m.anisotropy}}}function Z(C,m){let U=!1;C.__webglInit===void 0&&(C.__webglInit=!0,m.addEventListener("dispose",w));let P=m.source,F=d.get(P);F===void 0&&(F={},d.set(P,F));let j=W(m);if(j!==C.__cacheKey){F[j]===void 0&&(F[j]={texture:e.createTexture(),usedTimes:0},r.memory.textures++,U=!0),F[j].usedTimes++;let lt=F[C.__cacheKey];lt!==void 0&&(F[C.__cacheKey].usedTimes--,lt.usedTimes===0&&R(m)),C.__cacheKey=j,C.__webglTexture=F[j].texture}return U}function rt(C,m,U){return Math.floor(Math.floor(C/U)/m)}function it(C,m,U,P){let j=C.updateRanges;if(j.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,m.width,m.height,U,P,m.data);else{j.sort((Mt,dt)=>Mt.start-dt.start);let lt=0;for(let Mt=1;Mt<j.length;Mt++){let dt=j[lt],ht=j[Mt],Rt=dt.start+dt.count,Nt=rt(ht.start,m.width,4),Bt=rt(dt.start,m.width,4);ht.start<=Rt+1&&Nt===Bt&&rt(ht.start+ht.count-1,m.width,4)===Nt?dt.count=Math.max(dt.count,ht.start+ht.count-dt.start):(++lt,j[lt]=ht)}j.length=lt+1;let Y=n.getParameter(e.UNPACK_ROW_LENGTH),J=n.getParameter(e.UNPACK_SKIP_PIXELS),ct=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,m.width);for(let Mt=0,dt=j.length;Mt<dt;Mt++){let ht=j[Mt],Rt=Math.floor(ht.start/4),Nt=Math.ceil(ht.count/4),Bt=Rt%m.width,I=Math.floor(Rt/m.width),ut=Nt,K=1;n.pixelStorei(e.UNPACK_SKIP_PIXELS,Bt),n.pixelStorei(e.UNPACK_SKIP_ROWS,I),n.texSubImage2D(e.TEXTURE_2D,0,Bt,I,ut,K,U,P,m.data)}C.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,Y),n.pixelStorei(e.UNPACK_SKIP_PIXELS,J),n.pixelStorei(e.UNPACK_SKIP_ROWS,ct)}}function At(C,m,U){let P=e.TEXTURE_2D;(m.isDataArrayTexture||m.isCompressedArrayTexture)&&(P=e.TEXTURE_2D_ARRAY),m.isData3DTexture&&(P=e.TEXTURE_3D);let F=Z(C,m),j=m.source;n.bindTexture(P,C.__webglTexture,e.TEXTURE0+U);let lt=i.get(j);if(j.version!==lt.__version||F===!0){if(n.activeTexture(e.TEXTURE0+U),(typeof ImageBitmap<"u"&&m.image instanceof ImageBitmap)===!1){let K=$t.getPrimaries($t.workingColorSpace),ft=m.colorSpace===Es?null:$t.getPrimaries(m.colorSpace),_t=m.colorSpace===Es||K===ft?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,m.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,m.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,_t)}n.pixelStorei(e.UNPACK_ALIGNMENT,m.unpackAlignment);let J=g(m.image,!1,s.maxTextureSize);J=pn(m,J);let ct=a.convert(m.format,m.colorSpace),Mt=a.convert(m.type),dt=y(m.internalFormat,ct,Mt,m.normalized,m.colorSpace,m.isVideoTexture);Ht(P,m);let ht,Rt=m.mipmaps,Nt=m.isVideoTexture!==!0,Bt=lt.__version===void 0||F===!0,I=j.dataReady,ut=A(m,J);if(m.isDepthTexture)dt=E(m.format===ya,m.type),Bt&&(Nt?n.texStorage2D(e.TEXTURE_2D,1,dt,J.width,J.height):n.texImage2D(e.TEXTURE_2D,0,dt,J.width,J.height,0,ct,Mt,null));else if(m.isDataTexture)if(Rt.length>0){Nt&&Bt&&n.texStorage2D(e.TEXTURE_2D,ut,dt,Rt[0].width,Rt[0].height);for(let K=0,ft=Rt.length;K<ft;K++)ht=Rt[K],Nt?I&&n.texSubImage2D(e.TEXTURE_2D,K,0,0,ht.width,ht.height,ct,Mt,ht.data):n.texImage2D(e.TEXTURE_2D,K,dt,ht.width,ht.height,0,ct,Mt,ht.data);m.generateMipmaps=!1}else Nt?(Bt&&n.texStorage2D(e.TEXTURE_2D,ut,dt,J.width,J.height),I&&it(m,J,ct,Mt)):n.texImage2D(e.TEXTURE_2D,0,dt,J.width,J.height,0,ct,Mt,J.data);else if(m.isCompressedTexture)if(m.isCompressedArrayTexture){Nt&&Bt&&n.texStorage3D(e.TEXTURE_2D_ARRAY,ut,dt,Rt[0].width,Rt[0].height,J.depth);for(let K=0,ft=Rt.length;K<ft;K++)if(ht=Rt[K],m.format!==mi)if(ct!==null)if(Nt){if(I)if(m.layerUpdates.size>0){let _t=f0(ht.width,ht.height,m.format,m.type);for(let tt of m.layerUpdates){let Tt=ht.data.subarray(tt*_t/ht.data.BYTES_PER_ELEMENT,(tt+1)*_t/ht.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,K,0,0,tt,ht.width,ht.height,1,ct,Tt)}m.clearLayerUpdates()}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,K,0,0,0,ht.width,ht.height,J.depth,ct,ht.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,K,dt,ht.width,ht.height,J.depth,0,ht.data,0,0);else Ut("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Nt?I&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,K,0,0,0,ht.width,ht.height,J.depth,ct,Mt,ht.data):n.texImage3D(e.TEXTURE_2D_ARRAY,K,dt,ht.width,ht.height,J.depth,0,ct,Mt,ht.data)}else{Nt&&Bt&&n.texStorage2D(e.TEXTURE_2D,ut,dt,Rt[0].width,Rt[0].height);for(let K=0,ft=Rt.length;K<ft;K++)ht=Rt[K],m.format!==mi?ct!==null?Nt?I&&n.compressedTexSubImage2D(e.TEXTURE_2D,K,0,0,ht.width,ht.height,ct,ht.data):n.compressedTexImage2D(e.TEXTURE_2D,K,dt,ht.width,ht.height,0,ht.data):Ut("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Nt?I&&n.texSubImage2D(e.TEXTURE_2D,K,0,0,ht.width,ht.height,ct,Mt,ht.data):n.texImage2D(e.TEXTURE_2D,K,dt,ht.width,ht.height,0,ct,Mt,ht.data)}else if(m.isDataArrayTexture)if(Nt){if(Bt&&n.texStorage3D(e.TEXTURE_2D_ARRAY,ut,dt,J.width,J.height,J.depth),I)if(m.layerUpdates.size>0){let K=f0(J.width,J.height,m.format,m.type);for(let ft of m.layerUpdates){let _t=J.data.subarray(ft*K/J.data.BYTES_PER_ELEMENT,(ft+1)*K/J.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,ft,J.width,J.height,1,ct,Mt,_t)}m.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,ct,Mt,J.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,dt,J.width,J.height,J.depth,0,ct,Mt,J.data);else if(m.isData3DTexture)Nt?(Bt&&n.texStorage3D(e.TEXTURE_3D,ut,dt,J.width,J.height,J.depth),I&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,ct,Mt,J.data)):n.texImage3D(e.TEXTURE_3D,0,dt,J.width,J.height,J.depth,0,ct,Mt,J.data);else if(m.isFramebufferTexture){if(Bt)if(Nt)n.texStorage2D(e.TEXTURE_2D,ut,dt,J.width,J.height);else{let K=J.width,ft=J.height;for(let _t=0;_t<ut;_t++)n.texImage2D(e.TEXTURE_2D,_t,dt,K,ft,0,ct,Mt,null),K>>=1,ft>>=1}}else if(m.isHTMLTexture){if("texElementImage2D"in e){let K=e.canvas;if(K.hasAttribute("layoutsubtree")||K.setAttribute("layoutsubtree","true"),J.parentNode!==K){K.appendChild(J),p.add(m),K.onpaint=ft=>{let _t=ft.changedElements;for(let tt of p)_t.includes(tt.image)&&(tt.needsUpdate=!0)},K.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,J);else{let _t=e.RGBA,tt=e.RGBA,Tt=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,_t,tt,Tt,J)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(Rt.length>0){if(Nt&&Bt){let K=jt(Rt[0]);n.texStorage2D(e.TEXTURE_2D,ut,dt,K.width,K.height)}for(let K=0,ft=Rt.length;K<ft;K++)ht=Rt[K],Nt?I&&n.texSubImage2D(e.TEXTURE_2D,K,0,0,ct,Mt,ht):n.texImage2D(e.TEXTURE_2D,K,dt,ct,Mt,ht);m.generateMipmaps=!1}else if(Nt){if(Bt){let K=jt(J);n.texStorage2D(e.TEXTURE_2D,ut,dt,K.width,K.height)}I&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,ct,Mt,J)}else n.texImage2D(e.TEXTURE_2D,0,dt,ct,Mt,J);f(m)&&v(P),lt.__version=j.version,m.onUpdate&&m.onUpdate(m)}C.__version=m.version}function Ot(C,m,U){if(m.image.length!==6)return;let P=Z(C,m),F=m.source;n.bindTexture(e.TEXTURE_CUBE_MAP,C.__webglTexture,e.TEXTURE0+U);let j=i.get(F);if(F.version!==j.__version||P===!0){n.activeTexture(e.TEXTURE0+U);let lt=$t.getPrimaries($t.workingColorSpace),Y=m.colorSpace===Es?null:$t.getPrimaries(m.colorSpace),J=m.colorSpace===Es||lt===Y?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,m.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,m.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,m.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,J);let ct=m.isCompressedTexture||m.image[0].isCompressedTexture,Mt=m.image[0]&&m.image[0].isDataTexture,dt=[];for(let tt=0;tt<6;tt++)!ct&&!Mt?dt[tt]=g(m.image[tt],!0,s.maxCubemapSize):dt[tt]=Mt?m.image[tt].image:m.image[tt],dt[tt]=pn(m,dt[tt]);let ht=dt[0],Rt=a.convert(m.format,m.colorSpace),Nt=a.convert(m.type),Bt=y(m.internalFormat,Rt,Nt,m.normalized,m.colorSpace),I=m.isVideoTexture!==!0,ut=j.__version===void 0||P===!0,K=F.dataReady,ft=A(m,ht);Ht(e.TEXTURE_CUBE_MAP,m);let _t;if(ct){I&&ut&&n.texStorage2D(e.TEXTURE_CUBE_MAP,ft,Bt,ht.width,ht.height);for(let tt=0;tt<6;tt++){_t=dt[tt].mipmaps;for(let Tt=0;Tt<_t.length;Tt++){let bt=_t[Tt];m.format!==mi?Rt!==null?I?K&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,Tt,0,0,bt.width,bt.height,Rt,bt.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,Tt,Bt,bt.width,bt.height,0,bt.data):Ut("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):I?K&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,Tt,0,0,bt.width,bt.height,Rt,Nt,bt.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,Tt,Bt,bt.width,bt.height,0,Rt,Nt,bt.data)}}}else{if(_t=m.mipmaps,I&&ut){_t.length>0&&ft++;let tt=jt(dt[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,ft,Bt,tt.width,tt.height)}for(let tt=0;tt<6;tt++)if(Mt){I?K&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,0,0,0,dt[tt].width,dt[tt].height,Rt,Nt,dt[tt].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,0,Bt,dt[tt].width,dt[tt].height,0,Rt,Nt,dt[tt].data);for(let Tt=0;Tt<_t.length;Tt++){let Ie=_t[Tt].image[tt].image;I?K&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,Tt+1,0,0,Ie.width,Ie.height,Rt,Nt,Ie.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,Tt+1,Bt,Ie.width,Ie.height,0,Rt,Nt,Ie.data)}}else{I?K&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,0,0,0,Rt,Nt,dt[tt]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,0,Bt,Rt,Nt,dt[tt]);for(let Tt=0;Tt<_t.length;Tt++){let bt=_t[Tt];I?K&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,Tt+1,0,0,Rt,Nt,bt.image[tt]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+tt,Tt+1,Bt,Rt,Nt,bt.image[tt])}}}f(m)&&v(e.TEXTURE_CUBE_MAP),j.__version=F.version,m.onUpdate&&m.onUpdate(m)}C.__version=m.version}function St(C,m,U,P,F,j){let lt=a.convert(U.format,U.colorSpace),Y=a.convert(U.type),J=y(U.internalFormat,lt,Y,U.normalized,U.colorSpace),ct=i.get(m),Mt=i.get(U);if(Mt.__renderTarget=m,!ct.__hasExternalTextures){let dt=Math.max(1,m.width>>j),ht=Math.max(1,m.height>>j);F===e.TEXTURE_3D||F===e.TEXTURE_2D_ARRAY?n.texImage3D(F,j,J,dt,ht,m.depth,0,lt,Y,null):n.texImage2D(F,j,J,dt,ht,0,lt,Y,null)}n.bindFramebuffer(e.FRAMEBUFFER,C),Le(m)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,P,F,Mt.__webglTexture,0,we(m)):(F===e.TEXTURE_2D||F>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&F<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,P,F,Mt.__webglTexture,j),n.bindFramebuffer(e.FRAMEBUFFER,null)}function Ae(C,m,U){if(e.bindRenderbuffer(e.RENDERBUFFER,C),m.depthBuffer){let P=m.depthTexture,F=P&&P.isDepthTexture?P.type:null,j=E(m.stencilBuffer,F),lt=m.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;Le(m)?o.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,we(m),j,m.width,m.height):U?e.renderbufferStorageMultisample(e.RENDERBUFFER,we(m),j,m.width,m.height):e.renderbufferStorage(e.RENDERBUFFER,j,m.width,m.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,lt,e.RENDERBUFFER,C)}else{let P=m.textures;for(let F=0;F<P.length;F++){let j=P[F],lt=a.convert(j.format,j.colorSpace),Y=a.convert(j.type),J=y(j.internalFormat,lt,Y,j.normalized,j.colorSpace);Le(m)?o.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,we(m),J,m.width,m.height):U?e.renderbufferStorageMultisample(e.RENDERBUFFER,we(m),J,m.width,m.height):e.renderbufferStorage(e.RENDERBUFFER,J,m.width,m.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function Gt(C,m,U){let P=m.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,C),!(m.depthTexture&&m.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let F=i.get(m.depthTexture);if(F.__renderTarget=m,(!F.__webglTexture||m.depthTexture.image.width!==m.width||m.depthTexture.image.height!==m.height)&&(m.depthTexture.image.width=m.width,m.depthTexture.image.height=m.height,m.depthTexture.needsUpdate=!0),P){if(F.__webglInit===void 0&&(F.__webglInit=!0,m.depthTexture.addEventListener("dispose",w)),F.__webglTexture===void 0){F.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,F.__webglTexture),Ht(e.TEXTURE_CUBE_MAP,m.depthTexture);let ct=a.convert(m.depthTexture.format),Mt=a.convert(m.depthTexture.type),dt;m.depthTexture.format===Hi?dt=e.DEPTH_COMPONENT24:m.depthTexture.format===ya&&(dt=e.DEPTH24_STENCIL8);for(let ht=0;ht<6;ht++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ht,0,dt,m.width,m.height,0,ct,Mt,null)}}else Q(m.depthTexture,0);let j=F.__webglTexture,lt=we(m),Y=P?e.TEXTURE_CUBE_MAP_POSITIVE_X+U:e.TEXTURE_2D,J=m.depthTexture.format===ya?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(m.depthTexture.format===Hi)Le(m)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,J,Y,j,0,lt):e.framebufferTexture2D(e.FRAMEBUFFER,J,Y,j,0);else if(m.depthTexture.format===ya)Le(m)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,J,Y,j,0,lt):e.framebufferTexture2D(e.FRAMEBUFFER,J,Y,j,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function se(C){let m=i.get(C),U=C.isWebGLCubeRenderTarget===!0;if(m.__boundDepthTexture!==C.depthTexture){let P=C.depthTexture;if(m.__depthDisposeCallback&&m.__depthDisposeCallback(),P){let F=()=>{delete m.__boundDepthTexture,delete m.__depthDisposeCallback,P.removeEventListener("dispose",F)};P.addEventListener("dispose",F),m.__depthDisposeCallback=F}m.__boundDepthTexture=P}if(C.depthTexture&&!m.__autoAllocateDepthBuffer)if(U)for(let P=0;P<6;P++)Gt(m.__webglFramebuffer[P],C,P);else{let P=C.texture.mipmaps;P&&P.length>0?Gt(m.__webglFramebuffer[0],C,0):Gt(m.__webglFramebuffer,C,0)}else if(U){m.__webglDepthbuffer=[];for(let P=0;P<6;P++)if(n.bindFramebuffer(e.FRAMEBUFFER,m.__webglFramebuffer[P]),m.__webglDepthbuffer[P]===void 0)m.__webglDepthbuffer[P]=e.createRenderbuffer(),Ae(m.__webglDepthbuffer[P],C,!1);else{let F=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,j=m.__webglDepthbuffer[P];e.bindRenderbuffer(e.RENDERBUFFER,j),e.framebufferRenderbuffer(e.FRAMEBUFFER,F,e.RENDERBUFFER,j)}}else{let P=C.texture.mipmaps;if(P&&P.length>0?n.bindFramebuffer(e.FRAMEBUFFER,m.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,m.__webglFramebuffer),m.__webglDepthbuffer===void 0)m.__webglDepthbuffer=e.createRenderbuffer(),Ae(m.__webglDepthbuffer,C,!1);else{let F=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,j=m.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,j),e.framebufferRenderbuffer(e.FRAMEBUFFER,F,e.RENDERBUFFER,j)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function Kt(C,m,U){let P=i.get(C);m!==void 0&&St(P.__webglFramebuffer,C,C.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),U!==void 0&&se(C)}function qt(C){let m=C.texture,U=i.get(C),P=i.get(m);C.addEventListener("dispose",x);let F=C.textures,j=C.isWebGLCubeRenderTarget===!0,lt=F.length>1;if(lt||(P.__webglTexture===void 0&&(P.__webglTexture=e.createTexture()),P.__version=m.version,r.memory.textures++),j){U.__webglFramebuffer=[];for(let Y=0;Y<6;Y++)if(m.mipmaps&&m.mipmaps.length>0){U.__webglFramebuffer[Y]=[];for(let J=0;J<m.mipmaps.length;J++)U.__webglFramebuffer[Y][J]=e.createFramebuffer()}else U.__webglFramebuffer[Y]=e.createFramebuffer()}else{if(m.mipmaps&&m.mipmaps.length>0){U.__webglFramebuffer=[];for(let Y=0;Y<m.mipmaps.length;Y++)U.__webglFramebuffer[Y]=e.createFramebuffer()}else U.__webglFramebuffer=e.createFramebuffer();if(lt)for(let Y=0,J=F.length;Y<J;Y++){let ct=i.get(F[Y]);ct.__webglTexture===void 0&&(ct.__webglTexture=e.createTexture(),r.memory.textures++)}if(C.samples>0&&Le(C)===!1){U.__webglMultisampledFramebuffer=e.createFramebuffer(),U.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,U.__webglMultisampledFramebuffer);for(let Y=0;Y<F.length;Y++){let J=F[Y];U.__webglColorRenderbuffer[Y]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,U.__webglColorRenderbuffer[Y]);let ct=a.convert(J.format,J.colorSpace),Mt=a.convert(J.type),dt=y(J.internalFormat,ct,Mt,J.normalized,J.colorSpace,C.isXRRenderTarget===!0),ht=we(C);e.renderbufferStorageMultisample(e.RENDERBUFFER,ht,dt,C.width,C.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+Y,e.RENDERBUFFER,U.__webglColorRenderbuffer[Y])}e.bindRenderbuffer(e.RENDERBUFFER,null),C.depthBuffer&&(U.__webglDepthRenderbuffer=e.createRenderbuffer(),Ae(U.__webglDepthRenderbuffer,C,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(j){n.bindTexture(e.TEXTURE_CUBE_MAP,P.__webglTexture),Ht(e.TEXTURE_CUBE_MAP,m);for(let Y=0;Y<6;Y++)if(m.mipmaps&&m.mipmaps.length>0)for(let J=0;J<m.mipmaps.length;J++)St(U.__webglFramebuffer[Y][J],C,m,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Y,J);else St(U.__webglFramebuffer[Y],C,m,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Y,0);f(m)&&v(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(lt){for(let Y=0,J=F.length;Y<J;Y++){let ct=F[Y],Mt=i.get(ct),dt=e.TEXTURE_2D;(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(dt=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(dt,Mt.__webglTexture),Ht(dt,ct),St(U.__webglFramebuffer,C,ct,e.COLOR_ATTACHMENT0+Y,dt,0),f(ct)&&v(dt)}n.unbindTexture()}else{let Y=e.TEXTURE_2D;if((C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(Y=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(Y,P.__webglTexture),Ht(Y,m),m.mipmaps&&m.mipmaps.length>0)for(let J=0;J<m.mipmaps.length;J++)St(U.__webglFramebuffer[J],C,m,e.COLOR_ATTACHMENT0,Y,J);else St(U.__webglFramebuffer,C,m,e.COLOR_ATTACHMENT0,Y,0);f(m)&&v(Y),n.unbindTexture()}C.depthBuffer&&se(C)}function Ne(C){let m=C.textures;for(let U=0,P=m.length;U<P;U++){let F=m[U];if(f(F)){let j=S(C),lt=i.get(F).__webglTexture;n.bindTexture(j,lt),v(j),n.unbindTexture()}}}let Be=[],ke=[];function Je(C){if(C.samples>0){if(Le(C)===!1){let m=C.textures,U=C.width,P=C.height,F=e.COLOR_BUFFER_BIT,j=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,lt=i.get(C),Y=m.length>1;if(Y)for(let ct=0;ct<m.length;ct++)n.bindFramebuffer(e.FRAMEBUFFER,lt.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ct,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,lt.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ct,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,lt.__webglMultisampledFramebuffer);let J=C.texture.mipmaps;J&&J.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,lt.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,lt.__webglFramebuffer);for(let ct=0;ct<m.length;ct++){if(C.resolveDepthBuffer&&(C.depthBuffer&&(F|=e.DEPTH_BUFFER_BIT),C.stencilBuffer&&C.resolveStencilBuffer&&(F|=e.STENCIL_BUFFER_BIT)),Y){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,lt.__webglColorRenderbuffer[ct]);let Mt=i.get(m[ct]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,Mt,0)}e.blitFramebuffer(0,0,U,P,0,0,U,P,F,e.NEAREST),l===!0&&(Be.length=0,ke.length=0,Be.push(e.COLOR_ATTACHMENT0+ct),C.depthBuffer&&C.resolveDepthBuffer===!1&&(Be.push(j),ke.push(j),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,ke)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,Be))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),Y)for(let ct=0;ct<m.length;ct++){n.bindFramebuffer(e.FRAMEBUFFER,lt.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ct,e.RENDERBUFFER,lt.__webglColorRenderbuffer[ct]);let Mt=i.get(m[ct]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,lt.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ct,e.TEXTURE_2D,Mt,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,lt.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.resolveDepthBuffer===!1&&l){let m=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[m])}}}function we(C){return Math.min(s.maxSamples,C.samples)}function Le(C){let m=i.get(C);return C.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&m.__useRenderToTexture!==!1}function O(C){let m=r.render.frame;h.get(C)!==m&&(h.set(C,m),C.update())}function pn(C,m){let U=C.colorSpace,P=C.format,F=C.type;return C.isCompressedTexture===!0||C.isVideoTexture===!0||U!==Il&&U!==Es&&($t.getTransfer(U)===oe?(P!==mi||F!==$n)&&Ut("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Lt("WebGLTextures: Unsupported texture color space:",U)),m}function jt(C){return typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement?(c.width=C.naturalWidth||C.width,c.height=C.naturalHeight||C.height):typeof VideoFrame<"u"&&C instanceof VideoFrame?(c.width=C.displayWidth,c.height=C.displayHeight):(c.width=C.width,c.height=C.height),c}this.allocateTextureUnit=G,this.resetTextureUnits=k,this.getTextureUnits=X,this.setTextureUnits=z,this.setTexture2D=Q,this.setTexture2DArray=et,this.setTexture3D=at,this.setTextureCube=ot,this.rebindTextures=Kt,this.setupRenderTarget=qt,this.updateRenderTargetMipmap=Ne,this.updateMultisampleRenderTarget=Je,this.setupDepthRenderbuffer=se,this.setupFrameBufferTexture=St,this.useMultisampledRTT=Le,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function j2(e,t){function n(i,s=Es){let a,r=$t.getTransfer(s);if(i===$n)return e.UNSIGNED_BYTE;if(i===Tf)return e.UNSIGNED_SHORT_4_4_4_4;if(i===Af)return e.UNSIGNED_SHORT_5_5_5_1;if(i===t0)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===e0)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===Qg)return e.BYTE;if(i===$g)return e.SHORT;if(i===vo)return e.UNSIGNED_SHORT;if(i===Ef)return e.INT;if(i===Ei)return e.UNSIGNED_INT;if(i===Ti)return e.FLOAT;if(i===qi)return e.HALF_FLOAT;if(i===n0)return e.ALPHA;if(i===i0)return e.RGB;if(i===mi)return e.RGBA;if(i===Hi)return e.DEPTH_COMPONENT;if(i===ya)return e.DEPTH_STENCIL;if(i===s0)return e.RED;if(i===wf)return e.RED_INTEGER;if(i===xa)return e.RG;if(i===Cf)return e.RG_INTEGER;if(i===Rf)return e.RGBA_INTEGER;if(i===rc||i===oc||i===lc||i===cc)if(r===oe)if(a=t.get("WEBGL_compressed_texture_s3tc_srgb"),a!==null){if(i===rc)return a.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===oc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===lc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===cc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(a=t.get("WEBGL_compressed_texture_s3tc"),a!==null){if(i===rc)return a.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===oc)return a.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===lc)return a.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===cc)return a.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Df||i===Uf||i===Nf||i===Lf)if(a=t.get("WEBGL_compressed_texture_pvrtc"),a!==null){if(i===Df)return a.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Uf)return a.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Nf)return a.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Lf)return a.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===If||i===Of||i===Pf||i===zf||i===Bf||i===uc||i===Ff)if(a=t.get("WEBGL_compressed_texture_etc"),a!==null){if(i===If||i===Of)return r===oe?a.COMPRESSED_SRGB8_ETC2:a.COMPRESSED_RGB8_ETC2;if(i===Pf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:a.COMPRESSED_RGBA8_ETC2_EAC;if(i===zf)return a.COMPRESSED_R11_EAC;if(i===Bf)return a.COMPRESSED_SIGNED_R11_EAC;if(i===uc)return a.COMPRESSED_RG11_EAC;if(i===Ff)return a.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Vf||i===Hf||i===Gf||i===kf||i===Xf||i===Wf||i===qf||i===Yf||i===Zf||i===Jf||i===Kf||i===jf||i===Qf||i===$f)if(a=t.get("WEBGL_compressed_texture_astc"),a!==null){if(i===Vf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:a.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Hf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:a.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Gf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:a.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===kf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:a.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Xf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:a.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Wf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:a.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===qf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:a.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Yf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:a.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Zf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:a.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Jf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:a.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Kf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:a.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===jf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:a.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Qf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:a.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===$f)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:a.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===td||i===ed||i===nd)if(a=t.get("EXT_texture_compression_bptc"),a!==null){if(i===td)return r===oe?a.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:a.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===ed)return a.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===nd)return a.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===id||i===sd||i===hc||i===ad)if(a=t.get("EXT_texture_compression_rgtc"),a!==null){if(i===id)return a.COMPRESSED_RED_RGTC1_EXT;if(i===sd)return a.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===hc)return a.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===ad)return a.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===yo?e.UNSIGNED_INT_24_8:e[i]!==void 0?e[i]:null}return{convert:n}}var Q2=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,$2=`
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

}`,A0=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,n){if(this.texture===null){let i=new ql(t.texture);(t.depthNear!==n.depthNear||t.depthFar!==n.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=i}}getMesh(t){if(this.texture!==null&&this.mesh===null){let n=t.cameras[0].viewport,i=new jn({vertexShader:Q2,fragmentShader:$2,uniforms:{depthColor:{value:this.texture},depthWidth:{value:n.z},depthHeight:{value:n.w}}});this.mesh=new Qe(new da(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},w0=class extends Gi{constructor(t,n){super();let i=this,s=null,a=1,r=null,o="local-floor",l=1,c=null,h=null,p=null,u=null,d=null,_=null,b=typeof XRWebGLBinding<"u",g=new A0,f={},v=n.getContextAttributes(),S=null,y=null,E=[],A=[],w=new Dt,x=null,T=new yn;T.viewport=new Ue;let R=new yn;R.viewport=new Ue;let D=[T,R],L=new yf,k=null,X=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Z){let rt=E[Z];return rt===void 0&&(rt=new uo,E[Z]=rt),rt.getTargetRaySpace()},this.getControllerGrip=function(Z){let rt=E[Z];return rt===void 0&&(rt=new uo,E[Z]=rt),rt.getGripSpace()},this.getHand=function(Z){let rt=E[Z];return rt===void 0&&(rt=new uo,E[Z]=rt),rt.getHandSpace()};function z(Z){let rt=A.indexOf(Z.inputSource);if(rt===-1)return;let it=E[rt];it!==void 0&&(it.update(Z.inputSource,Z.frame,c||r),it.dispatchEvent({type:Z.type,data:Z.inputSource}))}function G(){s.removeEventListener("select",z),s.removeEventListener("selectstart",z),s.removeEventListener("selectend",z),s.removeEventListener("squeeze",z),s.removeEventListener("squeezestart",z),s.removeEventListener("squeezeend",z),s.removeEventListener("end",G),s.removeEventListener("inputsourceschange",W);for(let Z=0;Z<E.length;Z++){let rt=A[Z];rt!==null&&(A[Z]=null,E[Z].disconnect(rt))}k=null,X=null,g.reset();for(let Z in f)delete f[Z];t.setRenderTarget(S),d=null,u=null,p=null,s=null,y=null,Ht.stop(),i.isPresenting=!1,t.setPixelRatio(x),t.setSize(w.width,w.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Z){a=Z,i.isPresenting===!0&&Ut("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Z){o=Z,i.isPresenting===!0&&Ut("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||r},this.setReferenceSpace=function(Z){c=Z},this.getBaseLayer=function(){return u!==null?u:d},this.getBinding=function(){return p===null&&b&&(p=new XRWebGLBinding(s,n)),p},this.getFrame=function(){return _},this.getSession=function(){return s},this.setSession=async function(Z){if(s=Z,s!==null){if(S=t.getRenderTarget(),s.addEventListener("select",z),s.addEventListener("selectstart",z),s.addEventListener("selectend",z),s.addEventListener("squeeze",z),s.addEventListener("squeezestart",z),s.addEventListener("squeezeend",z),s.addEventListener("end",G),s.addEventListener("inputsourceschange",W),v.xrCompatible!==!0&&await n.makeXRCompatible(),x=t.getPixelRatio(),t.getSize(w),b&&"createProjectionLayer"in XRWebGLBinding.prototype){let it=null,At=null,Ot=null;v.depth&&(Ot=v.stencil?n.DEPTH24_STENCIL8:n.DEPTH_COMPONENT24,it=v.stencil?ya:Hi,At=v.stencil?yo:Ei);let St={colorFormat:n.RGBA8,depthFormat:Ot,scaleFactor:a};p=this.getBinding(),u=p.createProjectionLayer(St),s.updateRenderState({layers:[u]}),t.setPixelRatio(1),t.setSize(u.textureWidth,u.textureHeight,!1),y=new Jn(u.textureWidth,u.textureHeight,{format:mi,type:$n,depthTexture:new Ms(u.textureWidth,u.textureHeight,At,void 0,void 0,void 0,void 0,void 0,void 0,it),stencilBuffer:v.stencil,colorSpace:t.outputColorSpace,samples:v.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{let it={antialias:v.antialias,alpha:!0,depth:v.depth,stencil:v.stencil,framebufferScaleFactor:a};d=new XRWebGLLayer(s,n,it),s.updateRenderState({baseLayer:d}),t.setPixelRatio(1),t.setSize(d.framebufferWidth,d.framebufferHeight,!1),y=new Jn(d.framebufferWidth,d.framebufferHeight,{format:mi,type:$n,colorSpace:t.outputColorSpace,stencilBuffer:v.stencil,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(l),c=null,r=await s.requestReferenceSpace(o),Ht.setContext(s),Ht.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return g.getDepthTexture()};function W(Z){for(let rt=0;rt<Z.removed.length;rt++){let it=Z.removed[rt],At=A.indexOf(it);At>=0&&(A[At]=null,E[At].disconnect(it))}for(let rt=0;rt<Z.added.length;rt++){let it=Z.added[rt],At=A.indexOf(it);if(At===-1){for(let St=0;St<E.length;St++)if(St>=A.length){A.push(it),At=St;break}else if(A[St]===null){A[St]=it,At=St;break}if(At===-1)break}let Ot=E[At];Ot&&Ot.connect(it)}}let Q=new N,et=new N;function at(Z,rt,it){Q.setFromMatrixPosition(rt.matrixWorld),et.setFromMatrixPosition(it.matrixWorld);let At=Q.distanceTo(et),Ot=rt.projectionMatrix.elements,St=it.projectionMatrix.elements,Ae=Ot[14]/(Ot[10]-1),Gt=Ot[14]/(Ot[10]+1),se=(Ot[9]+1)/Ot[5],Kt=(Ot[9]-1)/Ot[5],qt=(Ot[8]-1)/Ot[0],Ne=(St[8]+1)/St[0],Be=Ae*qt,ke=Ae*Ne,Je=At/(-qt+Ne),we=Je*-qt;if(rt.matrixWorld.decompose(Z.position,Z.quaternion,Z.scale),Z.translateX(we),Z.translateZ(Je),Z.matrixWorld.compose(Z.position,Z.quaternion,Z.scale),Z.matrixWorldInverse.copy(Z.matrixWorld).invert(),Ot[10]===-1)Z.projectionMatrix.copy(rt.projectionMatrix),Z.projectionMatrixInverse.copy(rt.projectionMatrixInverse);else{let Le=Ae+Je,O=Gt+Je,pn=Be-we,jt=ke+(At-we),C=se*Gt/O*Le,m=Kt*Gt/O*Le;Z.projectionMatrix.makePerspective(pn,jt,C,m,Le,O),Z.projectionMatrixInverse.copy(Z.projectionMatrix).invert()}}function ot(Z,rt){rt===null?Z.matrixWorld.copy(Z.matrix):Z.matrixWorld.multiplyMatrices(rt.matrixWorld,Z.matrix),Z.matrixWorldInverse.copy(Z.matrixWorld).invert()}this.updateCamera=function(Z){if(s===null)return;let rt=Z.near,it=Z.far;g.texture!==null&&(g.depthNear>0&&(rt=g.depthNear),g.depthFar>0&&(it=g.depthFar)),L.near=R.near=T.near=rt,L.far=R.far=T.far=it,(k!==L.near||X!==L.far)&&(s.updateRenderState({depthNear:L.near,depthFar:L.far}),k=L.near,X=L.far),L.layers.mask=Z.layers.mask|6,T.layers.mask=L.layers.mask&-5,R.layers.mask=L.layers.mask&-3;let At=Z.parent,Ot=L.cameras;ot(L,At);for(let St=0;St<Ot.length;St++)ot(Ot[St],At);Ot.length===2?at(L,T,R):L.projectionMatrix.copy(T.projectionMatrix),vt(Z,L,At)};function vt(Z,rt,it){it===null?Z.matrix.copy(rt.matrixWorld):(Z.matrix.copy(it.matrixWorld),Z.matrix.invert(),Z.matrix.multiply(rt.matrixWorld)),Z.matrix.decompose(Z.position,Z.quaternion,Z.scale),Z.updateMatrixWorld(!0),Z.projectionMatrix.copy(rt.projectionMatrix),Z.projectionMatrixInverse.copy(rt.projectionMatrixInverse),Z.isPerspectiveCamera&&(Z.fov=Gh*2*Math.atan(1/Z.projectionMatrix.elements[5]),Z.zoom=1)}this.getCamera=function(){return L},this.getFoveation=function(){if(!(u===null&&d===null))return l},this.setFoveation=function(Z){l=Z,u!==null&&(u.fixedFoveation=Z),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=Z)},this.hasDepthSensing=function(){return g.texture!==null},this.getDepthSensingMesh=function(){return g.getMesh(L)},this.getCameraTexture=function(Z){return f[Z]};let kt=null;function de(Z,rt){if(h=rt.getViewerPose(c||r),_=rt,h!==null){let it=h.views;d!==null&&(t.setRenderTargetFramebuffer(y,d.framebuffer),t.setRenderTarget(y));let At=!1;it.length!==L.cameras.length&&(L.cameras.length=0,At=!0);for(let Gt=0;Gt<it.length;Gt++){let se=it[Gt],Kt=null;if(d!==null)Kt=d.getViewport(se);else{let Ne=p.getViewSubImage(u,se);Kt=Ne.viewport,Gt===0&&(t.setRenderTargetTextures(y,Ne.colorTexture,Ne.depthStencilTexture),t.setRenderTarget(y))}let qt=D[Gt];qt===void 0&&(qt=new yn,qt.layers.enable(Gt),qt.viewport=new Ue,D[Gt]=qt),qt.matrix.fromArray(se.transform.matrix),qt.matrix.decompose(qt.position,qt.quaternion,qt.scale),qt.projectionMatrix.fromArray(se.projectionMatrix),qt.projectionMatrixInverse.copy(qt.projectionMatrix).invert(),qt.viewport.set(Kt.x,Kt.y,Kt.width,Kt.height),Gt===0&&(L.matrix.copy(qt.matrix),L.matrix.decompose(L.position,L.quaternion,L.scale)),At===!0&&L.cameras.push(qt)}let Ot=s.enabledFeatures;if(Ot&&Ot.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&b){p=i.getBinding();let Gt=p.getDepthInformation(it[0]);Gt&&Gt.isValid&&Gt.texture&&g.init(Gt,s.renderState)}if(Ot&&Ot.includes("camera-access")&&b){t.state.unbindTexture(),p=i.getBinding();for(let Gt=0;Gt<it.length;Gt++){let se=it[Gt].camera;if(se){let Kt=f[se];Kt||(Kt=new ql,f[se]=Kt);let qt=p.getCameraImage(se);Kt.sourceTexture=qt}}}}for(let it=0;it<E.length;it++){let At=A[it],Ot=E[it];At!==null&&Ot!==void 0&&Ot.update(At,rt,c||r)}kt&&kt(Z,rt),rt.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:rt}),_=null}let Ht=new cM;Ht.setAnimationLoop(de),this.setAnimationLoop=function(Z){kt=Z},this.dispose=function(){}}},t3=new De,mM=new Pt;mM.set(-1,0,0,0,1,0,0,0,1);function e3(e,t){function n(g,f){g.matrixAutoUpdate===!0&&g.updateMatrix(),f.value.copy(g.matrix)}function i(g,f){f.color.getRGB(g.fogColor.value,c0(e)),f.isFog?(g.fogNear.value=f.near,g.fogFar.value=f.far):f.isFogExp2&&(g.fogDensity.value=f.density)}function s(g,f,v,S,y){f.isNodeMaterial?f.uniformsNeedUpdate=!1:f.isMeshBasicMaterial?a(g,f):f.isMeshLambertMaterial?(a(g,f),f.envMap&&(g.envMapIntensity.value=f.envMapIntensity)):f.isMeshToonMaterial?(a(g,f),p(g,f)):f.isMeshPhongMaterial?(a(g,f),h(g,f),f.envMap&&(g.envMapIntensity.value=f.envMapIntensity)):f.isMeshStandardMaterial?(a(g,f),u(g,f),f.isMeshPhysicalMaterial&&d(g,f,y)):f.isMeshMatcapMaterial?(a(g,f),_(g,f)):f.isMeshDepthMaterial?a(g,f):f.isMeshDistanceMaterial?(a(g,f),b(g,f)):f.isMeshNormalMaterial?a(g,f):f.isLineBasicMaterial?(r(g,f),f.isLineDashedMaterial&&o(g,f)):f.isPointsMaterial?l(g,f,v,S):f.isSpriteMaterial?c(g,f):f.isShadowMaterial?(g.color.value.copy(f.color),g.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function a(g,f){g.opacity.value=f.opacity,f.color&&g.diffuse.value.copy(f.color),f.emissive&&g.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(g.map.value=f.map,n(f.map,g.mapTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,n(f.alphaMap,g.alphaMapTransform)),f.bumpMap&&(g.bumpMap.value=f.bumpMap,n(f.bumpMap,g.bumpMapTransform),g.bumpScale.value=f.bumpScale,f.side===An&&(g.bumpScale.value*=-1)),f.normalMap&&(g.normalMap.value=f.normalMap,n(f.normalMap,g.normalMapTransform),g.normalScale.value.copy(f.normalScale),f.side===An&&g.normalScale.value.negate()),f.displacementMap&&(g.displacementMap.value=f.displacementMap,n(f.displacementMap,g.displacementMapTransform),g.displacementScale.value=f.displacementScale,g.displacementBias.value=f.displacementBias),f.emissiveMap&&(g.emissiveMap.value=f.emissiveMap,n(f.emissiveMap,g.emissiveMapTransform)),f.specularMap&&(g.specularMap.value=f.specularMap,n(f.specularMap,g.specularMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest);let v=t.get(f),S=v.envMap,y=v.envMapRotation;S&&(g.envMap.value=S,g.envMapRotation.value.setFromMatrix4(t3.makeRotationFromEuler(y)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1&&g.envMapRotation.value.premultiply(mM),g.reflectivity.value=f.reflectivity,g.ior.value=f.ior,g.refractionRatio.value=f.refractionRatio),f.lightMap&&(g.lightMap.value=f.lightMap,g.lightMapIntensity.value=f.lightMapIntensity,n(f.lightMap,g.lightMapTransform)),f.aoMap&&(g.aoMap.value=f.aoMap,g.aoMapIntensity.value=f.aoMapIntensity,n(f.aoMap,g.aoMapTransform))}function r(g,f){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,f.map&&(g.map.value=f.map,n(f.map,g.mapTransform))}function o(g,f){g.dashSize.value=f.dashSize,g.totalSize.value=f.dashSize+f.gapSize,g.scale.value=f.scale}function l(g,f,v,S){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,g.size.value=f.size*v,g.scale.value=S*.5,f.map&&(g.map.value=f.map,n(f.map,g.uvTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,n(f.alphaMap,g.alphaMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest)}function c(g,f){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,g.rotation.value=f.rotation,f.map&&(g.map.value=f.map,n(f.map,g.mapTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,n(f.alphaMap,g.alphaMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest)}function h(g,f){g.specular.value.copy(f.specular),g.shininess.value=Math.max(f.shininess,1e-4)}function p(g,f){f.gradientMap&&(g.gradientMap.value=f.gradientMap)}function u(g,f){g.metalness.value=f.metalness,f.metalnessMap&&(g.metalnessMap.value=f.metalnessMap,n(f.metalnessMap,g.metalnessMapTransform)),g.roughness.value=f.roughness,f.roughnessMap&&(g.roughnessMap.value=f.roughnessMap,n(f.roughnessMap,g.roughnessMapTransform)),f.envMap&&(g.envMapIntensity.value=f.envMapIntensity)}function d(g,f,v){g.ior.value=f.ior,f.sheen>0&&(g.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),g.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(g.sheenColorMap.value=f.sheenColorMap,n(f.sheenColorMap,g.sheenColorMapTransform)),f.sheenRoughnessMap&&(g.sheenRoughnessMap.value=f.sheenRoughnessMap,n(f.sheenRoughnessMap,g.sheenRoughnessMapTransform))),f.clearcoat>0&&(g.clearcoat.value=f.clearcoat,g.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(g.clearcoatMap.value=f.clearcoatMap,n(f.clearcoatMap,g.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,n(f.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(g.clearcoatNormalMap.value=f.clearcoatNormalMap,n(f.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===An&&g.clearcoatNormalScale.value.negate())),f.dispersion>0&&(g.dispersion.value=f.dispersion),f.iridescence>0&&(g.iridescence.value=f.iridescence,g.iridescenceIOR.value=f.iridescenceIOR,g.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(g.iridescenceMap.value=f.iridescenceMap,n(f.iridescenceMap,g.iridescenceMapTransform)),f.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=f.iridescenceThicknessMap,n(f.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),f.transmission>0&&(g.transmission.value=f.transmission,g.transmissionSamplerMap.value=v.texture,g.transmissionSamplerSize.value.set(v.width,v.height),f.transmissionMap&&(g.transmissionMap.value=f.transmissionMap,n(f.transmissionMap,g.transmissionMapTransform)),g.thickness.value=f.thickness,f.thicknessMap&&(g.thicknessMap.value=f.thicknessMap,n(f.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=f.attenuationDistance,g.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(g.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(g.anisotropyMap.value=f.anisotropyMap,n(f.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=f.specularIntensity,g.specularColor.value.copy(f.specularColor),f.specularColorMap&&(g.specularColorMap.value=f.specularColorMap,n(f.specularColorMap,g.specularColorMapTransform)),f.specularIntensityMap&&(g.specularIntensityMap.value=f.specularIntensityMap,n(f.specularIntensityMap,g.specularIntensityMapTransform))}function _(g,f){f.matcap&&(g.matcap.value=f.matcap)}function b(g,f){let v=t.get(f).light;g.referencePosition.value.setFromMatrixPosition(v.matrixWorld),g.nearDistance.value=v.shadow.camera.near,g.farDistance.value=v.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:s}}function n3(e,t,n,i){let s={},a={},r=[],o=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function l(y,E){let A=E.program;i.uniformBlockBinding(y,A)}function c(y,E){let A=s[y.id];A===void 0&&(g(y),A=h(y),s[y.id]=A,y.addEventListener("dispose",v));let w=E.program;i.updateUBOMapping(y,w);let x=t.render.frame;a[y.id]!==x&&(u(y),a[y.id]=x)}function h(y){let E=p();y.__bindingPointIndex=E;let A=e.createBuffer(),w=y.__size,x=y.usage;return e.bindBuffer(e.UNIFORM_BUFFER,A),e.bufferData(e.UNIFORM_BUFFER,w,x),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,E,A),A}function p(){for(let y=0;y<o;y++)if(r.indexOf(y)===-1)return r.push(y),y;return Lt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(y){let E=s[y.id],A=y.uniforms,w=y.__cache;e.bindBuffer(e.UNIFORM_BUFFER,E);for(let x=0,T=A.length;x<T;x++){let R=A[x];if(Array.isArray(R))for(let D=0,L=R.length;D<L;D++)d(R[D],x,D,w);else d(R,x,0,w)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function d(y,E,A,w){if(b(y,E,A,w)===!0){let x=y.__offset,T=y.value;if(Array.isArray(T)){let R=0;for(let D=0;D<T.length;D++){let L=T[D],k=f(L);_(L,y.__data,R),typeof L!="number"&&typeof L!="boolean"&&!L.isMatrix3&&!ArrayBuffer.isView(L)&&(R+=k.storage/Float32Array.BYTES_PER_ELEMENT)}}else _(T,y.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,x,y.__data)}}function _(y,E,A){typeof y=="number"||typeof y=="boolean"?E[0]=y:y.isMatrix3?(E[0]=y.elements[0],E[1]=y.elements[1],E[2]=y.elements[2],E[3]=0,E[4]=y.elements[3],E[5]=y.elements[4],E[6]=y.elements[5],E[7]=0,E[8]=y.elements[6],E[9]=y.elements[7],E[10]=y.elements[8],E[11]=0):ArrayBuffer.isView(y)?E.set(new y.constructor(y.buffer,y.byteOffset,E.length)):y.toArray(E,A)}function b(y,E,A,w){let x=y.value,T=E+"_"+A;if(w[T]===void 0)return typeof x=="number"||typeof x=="boolean"?w[T]=x:ArrayBuffer.isView(x)?w[T]=x.slice():w[T]=x.clone(),!0;{let R=w[T];if(typeof x=="number"||typeof x=="boolean"){if(R!==x)return w[T]=x,!0}else{if(ArrayBuffer.isView(x))return!0;if(R.equals(x)===!1)return R.copy(x),!0}}return!1}function g(y){let E=y.uniforms,A=0,w=16;for(let T=0,R=E.length;T<R;T++){let D=Array.isArray(E[T])?E[T]:[E[T]];for(let L=0,k=D.length;L<k;L++){let X=D[L],z=Array.isArray(X.value)?X.value:[X.value];for(let G=0,W=z.length;G<W;G++){let Q=z[G],et=f(Q),at=A%w,ot=at%et.boundary,vt=at+ot;A+=ot,vt!==0&&w-vt<et.storage&&(A+=w-vt),X.__data=new Float32Array(et.storage/Float32Array.BYTES_PER_ELEMENT),X.__offset=A,A+=et.storage}}}let x=A%w;return x>0&&(A+=w-x),y.__size=A,y.__cache={},this}function f(y){let E={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(E.boundary=4,E.storage=4):y.isVector2?(E.boundary=8,E.storage=8):y.isVector3||y.isColor?(E.boundary=16,E.storage=12):y.isVector4?(E.boundary=16,E.storage=16):y.isMatrix3?(E.boundary=48,E.storage=48):y.isMatrix4?(E.boundary=64,E.storage=64):y.isTexture?Ut("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(y)?(E.boundary=16,E.storage=y.byteLength):Ut("WebGLRenderer: Unsupported uniform value type.",y),E}function v(y){let E=y.target;E.removeEventListener("dispose",v);let A=r.indexOf(E.__bindingPointIndex);r.splice(A,1),e.deleteBuffer(s[E.id]),delete s[E.id],delete a[E.id]}function S(){for(let y in s)e.deleteBuffer(s[y]);r=[],s={},a={}}return{bind:l,update:c,dispose:S}}var i3=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Yi=null;function s3(){return Yi===null&&(Yi=new qh(i3,16,16,xa,qi),Yi.name="DFG_LUT",Yi.minFilter=dn,Yi.magFilter=dn,Yi.wrapS=Fi,Yi.wrapT=Fi,Yi.generateMipmaps=!1,Yi.needsUpdate=!0),Yi}var fd=class{constructor(t={}){let{canvas:n=Ib(),context:i=null,depth:s=!0,stencil:a=!1,alpha:r=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:p=!1,reversedDepthBuffer:u=!1,outputBufferType:d=$n}=t;this.isWebGLRenderer=!0;let _;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");_=i.getContextAttributes().alpha}else _=r;let b=d,g=new Set([Rf,Cf,wf]),f=new Set([$n,Ei,vo,yo,Tf,Af]),v=new Uint32Array(4),S=new Int32Array(4),y=new N,E=null,A=null,w=[],x=[],T=null;this.domElement=n,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Mi,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let R=this,D=!1,L=null,k=null,X=null,z=null;this._outputColorSpace=Tn;let G=0,W=0,Q=null,et=-1,at=null,ot=new Ue,vt=new Ue,kt=null,de=new te(0),Ht=0,Z=n.width,rt=n.height,it=1,At=null,Ot=null,St=new Ue(0,0,Z,rt),Ae=new Ue(0,0,Z,rt),Gt=!1,se=new Xl,Kt=!1,qt=!1,Ne=new De,Be=new N,ke=new Ue,Je={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},we=!1;function Le(){return Q===null?it:1}let O=i;function pn(M,B){return n.getContext(M,B)}try{let M={alpha:!0,depth:s,stencil:a,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:p};if("setAttribute"in n&&n.setAttribute("data-engine",`three.js r${xf}`),n.addEventListener("webglcontextlost",Ie,!1),n.addEventListener("webglcontextrestored",_e,!1),n.addEventListener("webglcontextcreationerror",Ai,!1),O===null){let B="webgl2";if(O=pn(B,M),O===null)throw pn(B)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(M){throw Lt("WebGLRenderer: "+M.message),M}let jt,C,m,U,P,F,j,lt,Y,J,ct,Mt,dt,ht,Rt,Nt,Bt,I,ut,K,ft,_t,tt;function Tt(){jt=new hR(O),jt.init(),ft=new j2(O,jt),C=new iR(O,jt,t,ft),m=new J2(O,jt),C.reversedDepthBuffer&&u&&m.buffers.depth.setReversed(!0),k=O.createFramebuffer(),X=O.createFramebuffer(),z=O.createFramebuffer(),U=new pR(O),P=new O2,F=new K2(O,jt,m,P,C,ft,U),j=new uR(R),lt=new vA(O),_t=new eR(O,lt),Y=new fR(O,lt,U,_t),J=new gR(O,Y,lt,_t,U),I=new mR(O,C,F),Rt=new sR(P),ct=new I2(R,j,jt,C,_t,Rt),Mt=new e3(R,P),dt=new z2,ht=new k2(jt),Bt=new tR(R,j,m,J,_,l),Nt=new Z2(R,J,C),tt=new n3(O,U,C,m),ut=new nR(O,jt,U),K=new dR(O,jt,U),U.programs=ct.programs,R.capabilities=C,R.extensions=jt,R.properties=P,R.renderLists=dt,R.shadowMap=Nt,R.state=m,R.info=U}Tt(),b!==$n&&(T=new vR(b,n.width,n.height,o,s,a));let bt=new w0(R,O);this.xr=bt,this.getContext=function(){return O},this.getContextAttributes=function(){return O.getContextAttributes()},this.forceContextLoss=function(){let M=jt.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){let M=jt.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return it},this.setPixelRatio=function(M){M!==void 0&&(it=M,this.setSize(Z,rt,!1))},this.getSize=function(M){return M.set(Z,rt)},this.setSize=function(M,B,q=!0){if(bt.isPresenting){Ut("WebGLRenderer: Can't change size while VR device is presenting.");return}Z=M,rt=B,n.width=Math.floor(M*it),n.height=Math.floor(B*it),q===!0&&(n.style.width=M+"px",n.style.height=B+"px"),T!==null&&T.setSize(n.width,n.height),this.setViewport(0,0,M,B)},this.getDrawingBufferSize=function(M){return M.set(Z*it,rt*it).floor()},this.setDrawingBufferSize=function(M,B,q){Z=M,rt=B,it=q,n.width=Math.floor(M*q),n.height=Math.floor(B*q),this.setViewport(0,0,M,B)},this.setEffects=function(M){if(b===$n){Lt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(M){for(let B=0;B<M.length;B++)if(M[B].isOutputPass===!0){Ut("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}T.setEffects(M||[])},this.getCurrentViewport=function(M){return M.copy(ot)},this.getViewport=function(M){return M.copy(St)},this.setViewport=function(M,B,q,V){M.isVector4?St.set(M.x,M.y,M.z,M.w):St.set(M,B,q,V),m.viewport(ot.copy(St).multiplyScalar(it).round())},this.getScissor=function(M){return M.copy(Ae)},this.setScissor=function(M,B,q,V){M.isVector4?Ae.set(M.x,M.y,M.z,M.w):Ae.set(M,B,q,V),m.scissor(vt.copy(Ae).multiplyScalar(it).round())},this.getScissorTest=function(){return Gt},this.setScissorTest=function(M){m.setScissorTest(Gt=M)},this.setOpaqueSort=function(M){At=M},this.setTransparentSort=function(M){Ot=M},this.getClearColor=function(M){return M.copy(Bt.getClearColor())},this.setClearColor=function(){Bt.setClearColor(...arguments)},this.getClearAlpha=function(){return Bt.getClearAlpha()},this.setClearAlpha=function(){Bt.setClearAlpha(...arguments)},this.clear=function(M=!0,B=!0,q=!0){let V=0;if(M){let H=!1;if(Q!==null){let gt=Q.texture.format;H=g.has(gt)}if(H){let gt=Q.texture.type,xt=f.has(gt),mt=Bt.getClearColor(),Et=Bt.getClearAlpha(),wt=mt.r,Ft=mt.g,Wt=mt.b;xt?(v[0]=wt,v[1]=Ft,v[2]=Wt,v[3]=Et,O.clearBufferuiv(O.COLOR,0,v)):(S[0]=wt,S[1]=Ft,S[2]=Wt,S[3]=Et,O.clearBufferiv(O.COLOR,0,S))}else V|=O.COLOR_BUFFER_BIT}B&&(V|=O.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),q&&(V|=O.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),V!==0&&O.clear(V)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(M){M.setRenderer(this),L=M},this.dispose=function(){n.removeEventListener("webglcontextlost",Ie,!1),n.removeEventListener("webglcontextrestored",_e,!1),n.removeEventListener("webglcontextcreationerror",Ai,!1),Bt.dispose(),dt.dispose(),ht.dispose(),P.dispose(),j.dispose(),J.dispose(),_t.dispose(),tt.dispose(),ct.dispose(),bt.dispose(),bt.removeEventListener("sessionstart",N0),bt.removeEventListener("sessionend",L0),ba.stop()};function Ie(M){M.preventDefault(),o0("WebGLRenderer: Context Lost."),D=!0}function _e(){o0("WebGLRenderer: Context Restored."),D=!1;let M=U.autoReset,B=Nt.enabled,q=Nt.autoUpdate,V=Nt.needsUpdate,H=Nt.type;Tt(),U.autoReset=M,Nt.enabled=B,Nt.autoUpdate=q,Nt.needsUpdate=V,Nt.type=H}function Ai(M){Lt("WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function wi(M){let B=M.target;B.removeEventListener("dispose",wi),wM(B)}function wM(M){CM(M),P.remove(M)}function CM(M){let B=P.get(M).programs;B!==void 0&&(B.forEach(function(q){ct.releaseProgram(q)}),M.isShaderMaterial&&ct.releaseShaderCache(M))}this.renderBufferDirect=function(M,B,q,V,H,gt){B===null&&(B=Je);let xt=H.isMesh&&H.matrixWorld.determinantAffine()<0,mt=UM(M,B,q,V,H);m.setMaterial(V,xt);let Et=q.index,wt=1;if(V.wireframe===!0){if(Et=Y.getWireframeAttribute(q),Et===void 0)return;wt=2}let Ft=q.drawRange,Wt=q.attributes.position,Ct=Ft.start*wt,ue=(Ft.start+Ft.count)*wt;gt!==null&&(Ct=Math.max(Ct,gt.start*wt),ue=Math.min(ue,(gt.start+gt.count)*wt)),Et!==null?(Ct=Math.max(Ct,0),ue=Math.min(ue,Et.count)):Wt!=null&&(Ct=Math.max(Ct,0),ue=Math.min(ue,Wt.count));let Fe=ue-Ct;if(Fe<0||Fe===1/0)return;_t.setup(H,V,mt,q,Et);let Oe,pe=ut;if(Et!==null&&(Oe=lt.get(Et),pe=K,pe.setIndex(Oe)),H.isMesh)V.wireframe===!0?(m.setLineWidth(V.wireframeLinewidth*Le()),pe.setMode(O.LINES)):pe.setMode(O.TRIANGLES);else if(H.isLine){let mn=V.linewidth;mn===void 0&&(mn=1),m.setLineWidth(mn*Le()),H.isLineSegments?pe.setMode(O.LINES):H.isLineLoop?pe.setMode(O.LINE_LOOP):pe.setMode(O.LINE_STRIP)}else H.isPoints?pe.setMode(O.POINTS):H.isSprite&&pe.setMode(O.TRIANGLES);if(H.isBatchedMesh)if(jt.get("WEBGL_multi_draw"))pe.renderMultiDraw(H._multiDrawStarts,H._multiDrawCounts,H._multiDrawCount);else{let mn=H._multiDrawStarts,yt=H._multiDrawCounts,On=H._multiDrawCount,ie=Et?lt.get(Et).bytesPerElement:1,ti=P.get(V).currentProgram.getUniforms();for(let Ci=0;Ci<On;Ci++)ti.setValue(O,"_gl_DrawID",Ci),pe.render(mn[Ci]/ie,yt[Ci])}else if(H.isInstancedMesh)pe.renderInstances(Ct,Fe,H.count);else if(q.isInstancedBufferGeometry){let mn=q._maxInstanceCount!==void 0?q._maxInstanceCount:1/0,yt=Math.min(q.instanceCount,mn);pe.renderInstances(Ct,Fe,yt)}else pe.render(Ct,Fe)};function U0(M,B,q){M.transparent===!0&&M.side===Xi&&M.forceSinglePass===!1?(M.side=An,M.needsUpdate=!0,Ec(M,B,q),M.side=bs,M.needsUpdate=!0,Ec(M,B,q),M.side=Xi):Ec(M,B,q)}this.compile=function(M,B,q=null){q===null&&(q=M),A=ht.get(q),A.init(B),x.push(A),q.traverseVisible(function(H){H.isLight&&H.layers.test(B.layers)&&(A.pushLight(H),H.castShadow&&A.pushShadow(H))}),M!==q&&M.traverseVisible(function(H){H.isLight&&H.layers.test(B.layers)&&(A.pushLight(H),H.castShadow&&A.pushShadow(H))}),A.setupLights();let V=new Set;return M.traverse(function(H){if(!(H.isMesh||H.isPoints||H.isLine||H.isSprite))return;let gt=H.material;if(gt)if(Array.isArray(gt))for(let xt=0;xt<gt.length;xt++){let mt=gt[xt];U0(mt,q,H),V.add(mt)}else U0(gt,q,H),V.add(gt)}),A=x.pop(),V},this.compileAsync=function(M,B,q=null){let V=this.compile(M,B,q);return new Promise(H=>{function gt(){if(V.forEach(function(xt){P.get(xt).currentProgram.isReady()&&V.delete(xt)}),V.size===0){H(M);return}setTimeout(gt,10)}jt.get("KHR_parallel_shader_compile")!==null?gt():setTimeout(gt,10)})};let _d=null;function RM(M){_d&&_d(M)}function N0(){ba.stop()}function L0(){ba.start()}let ba=new cM;ba.setAnimationLoop(RM),typeof self<"u"&&ba.setContext(self),this.setAnimationLoop=function(M){_d=M,bt.setAnimationLoop(M),M===null?ba.stop():ba.start()},bt.addEventListener("sessionstart",N0),bt.addEventListener("sessionend",L0),this.render=function(M,B){if(B!==void 0&&B.isCamera!==!0){Lt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(D===!0)return;L!==null&&L.renderStart(M,B);let q=bt.enabled===!0&&bt.isPresenting===!0,V=T!==null&&(Q===null||q)&&T.begin(R,Q);if(M.matrixWorldAutoUpdate===!0&&M.updateMatrixWorld(),B.parent===null&&B.matrixWorldAutoUpdate===!0&&B.updateMatrixWorld(),bt.enabled===!0&&bt.isPresenting===!0&&(T===null||T.isCompositing()===!1)&&(bt.cameraAutoUpdate===!0&&bt.updateCamera(B),B=bt.getCamera()),M.isScene===!0&&M.onBeforeRender(R,M,B,Q),A=ht.get(M,x.length),A.init(B),A.state.textureUnits=F.getTextureUnits(),x.push(A),Ne.multiplyMatrices(B.projectionMatrix,B.matrixWorldInverse),se.setFromProjectionMatrix(Ne,bi,B.reversedDepth),qt=this.localClippingEnabled,Kt=Rt.init(this.clippingPlanes,qt),E=dt.get(M,w.length),E.init(),w.push(E),bt.enabled===!0&&bt.isPresenting===!0){let xt=R.xr.getDepthSensingMesh();xt!==null&&vd(xt,B,-1/0,R.sortObjects)}vd(M,B,0,R.sortObjects),E.finish(),R.sortObjects===!0&&E.sort(At,Ot,B.reversedDepth),we=bt.enabled===!1||bt.isPresenting===!1||bt.hasDepthSensing()===!1,we&&Bt.addToRenderList(E,M),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Kt===!0&&Rt.beginShadows();let H=A.state.shadowsArray;if(Nt.render(H,M,B),Kt===!0&&Rt.endShadows(),(V&&T.hasRenderPass())===!1){let xt=E.opaque,mt=E.transmissive;if(A.setupLights(),B.isArrayCamera){let Et=B.cameras;if(mt.length>0)for(let wt=0,Ft=Et.length;wt<Ft;wt++){let Wt=Et[wt];O0(xt,mt,M,Wt)}we&&Bt.render(M);for(let wt=0,Ft=Et.length;wt<Ft;wt++){let Wt=Et[wt];I0(E,M,Wt,Wt.viewport)}}else mt.length>0&&O0(xt,mt,M,B),we&&Bt.render(M),I0(E,M,B)}Q!==null&&W===0&&(F.updateMultisampleRenderTarget(Q),F.updateRenderTargetMipmap(Q)),V&&T.end(R),M.isScene===!0&&M.onAfterRender(R,M,B),_t.resetDefaultState(),et=-1,at=null,x.pop(),x.length>0?(A=x[x.length-1],F.setTextureUnits(A.state.textureUnits),Kt===!0&&Rt.setGlobalState(R.clippingPlanes,A.state.camera)):A=null,w.pop(),w.length>0?E=w[w.length-1]:E=null,L!==null&&L.renderEnd()};function vd(M,B,q,V){if(M.visible===!1)return;if(M.layers.test(B.layers)){if(M.isGroup)q=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(B);else if(M.isLightProbeGrid)A.pushLightProbeGrid(M);else if(M.isLight)A.pushLight(M),M.castShadow&&A.pushShadow(M);else if(M.isSprite){if(!M.frustumCulled||se.intersectsSprite(M)){V&&ke.setFromMatrixPosition(M.matrixWorld).applyMatrix4(Ne);let xt=J.update(M),mt=M.material;mt.visible&&E.push(M,xt,mt,q,ke.z,null)}}else if((M.isMesh||M.isLine||M.isPoints)&&(!M.frustumCulled||se.intersectsObject(M))){let xt=J.update(M),mt=M.material;if(V&&(M.boundingSphere!==void 0?(M.boundingSphere===null&&M.computeBoundingSphere(),ke.copy(M.boundingSphere.center)):(xt.boundingSphere===null&&xt.computeBoundingSphere(),ke.copy(xt.boundingSphere.center)),ke.applyMatrix4(M.matrixWorld).applyMatrix4(Ne)),Array.isArray(mt)){let Et=xt.groups;for(let wt=0,Ft=Et.length;wt<Ft;wt++){let Wt=Et[wt],Ct=mt[Wt.materialIndex];Ct&&Ct.visible&&E.push(M,xt,Ct,q,ke.z,Wt)}}else mt.visible&&E.push(M,xt,mt,q,ke.z,null)}}let gt=M.children;for(let xt=0,mt=gt.length;xt<mt;xt++)vd(gt[xt],B,q,V)}function I0(M,B,q,V){let{opaque:H,transmissive:gt,transparent:xt}=M;A.setupLightsView(q),Kt===!0&&Rt.setGlobalState(R.clippingPlanes,q),V&&m.viewport(ot.copy(V)),H.length>0&&Mc(H,B,q),gt.length>0&&Mc(gt,B,q),xt.length>0&&Mc(xt,B,q),m.buffers.depth.setTest(!0),m.buffers.depth.setMask(!0),m.buffers.color.setMask(!0),m.setPolygonOffset(!1)}function O0(M,B,q,V){if((q.isScene===!0?q.overrideMaterial:null)!==null)return;if(A.state.transmissionRenderTarget[V.id]===void 0){let Ct=jt.has("EXT_color_buffer_half_float")||jt.has("EXT_color_buffer_float");A.state.transmissionRenderTarget[V.id]=new Jn(1,1,{generateMipmaps:!0,type:Ct?qi:$n,minFilter:va,samples:Math.max(4,C.samples),stencilBuffer:a,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:$t.workingColorSpace})}let gt=A.state.transmissionRenderTarget[V.id],xt=V.viewport||ot;gt.setSize(xt.z*R.transmissionResolutionScale,xt.w*R.transmissionResolutionScale);let mt=R.getRenderTarget(),Et=R.getActiveCubeFace(),wt=R.getActiveMipmapLevel();R.setRenderTarget(gt),R.getClearColor(de),Ht=R.getClearAlpha(),Ht<1&&R.setClearColor(16777215,.5),R.clear(),we&&Bt.render(q);let Ft=R.toneMapping;R.toneMapping=Mi;let Wt=V.viewport;if(V.viewport!==void 0&&(V.viewport=void 0),A.setupLightsView(V),Kt===!0&&Rt.setGlobalState(R.clippingPlanes,V),Mc(M,q,V),F.updateMultisampleRenderTarget(gt),F.updateRenderTargetMipmap(gt),jt.has("WEBGL_multisampled_render_to_texture")===!1){let Ct=!1;for(let ue=0,Fe=B.length;ue<Fe;ue++){let Oe=B[ue],{object:pe,geometry:mn,material:yt,group:On}=Oe;if(yt.side===Xi&&pe.layers.test(V.layers)){let ie=yt.side;yt.side=An,yt.needsUpdate=!0,P0(pe,q,V,mn,yt,On),yt.side=ie,yt.needsUpdate=!0,Ct=!0}}Ct===!0&&(F.updateMultisampleRenderTarget(gt),F.updateRenderTargetMipmap(gt))}R.setRenderTarget(mt,Et,wt),R.setClearColor(de,Ht),Wt!==void 0&&(V.viewport=Wt),R.toneMapping=Ft}function Mc(M,B,q){let V=B.isScene===!0?B.overrideMaterial:null;for(let H=0,gt=M.length;H<gt;H++){let xt=M[H],{object:mt,geometry:Et,group:wt}=xt,Ft=xt.material;Ft.allowOverride===!0&&V!==null&&(Ft=V),mt.layers.test(q.layers)&&P0(mt,B,q,Et,Ft,wt)}}function P0(M,B,q,V,H,gt){M.onBeforeRender(R,B,q,V,H,gt),M.modelViewMatrix.multiplyMatrices(q.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),H.onBeforeRender(R,B,q,V,M,gt),H.transparent===!0&&H.side===Xi&&H.forceSinglePass===!1?(H.side=An,H.needsUpdate=!0,R.renderBufferDirect(q,B,V,H,M,gt),H.side=bs,H.needsUpdate=!0,R.renderBufferDirect(q,B,V,H,M,gt),H.side=Xi):R.renderBufferDirect(q,B,V,H,M,gt),M.onAfterRender(R,B,q,V,H,gt)}function Ec(M,B,q){B.isScene!==!0&&(B=Je);let V=P.get(M),H=A.state.lights,gt=A.state.shadowsArray,xt=H.state.version,mt=ct.getParameters(M,H.state,gt,B,q,A.state.lightProbeGridArray),Et=ct.getProgramCacheKey(mt),wt=V.programs;V.environment=M.isMeshStandardMaterial||M.isMeshLambertMaterial||M.isMeshPhongMaterial?B.environment:null,V.fog=B.fog;let Ft=M.isMeshStandardMaterial||M.isMeshLambertMaterial&&!M.envMap||M.isMeshPhongMaterial&&!M.envMap;V.envMap=j.get(M.envMap||V.environment,Ft),V.envMapRotation=V.environment!==null&&M.envMap===null?B.environmentRotation:M.envMapRotation,wt===void 0&&(M.addEventListener("dispose",wi),wt=new Map,V.programs=wt);let Wt=wt.get(Et);if(Wt!==void 0){if(V.currentProgram===Wt&&V.lightsStateVersion===xt)return B0(M,mt),Wt}else mt.uniforms=ct.getUniforms(M),L!==null&&M.isNodeMaterial&&L.build(M,q,mt),M.onBeforeCompile(mt,R),Wt=ct.acquireProgram(mt,Et),wt.set(Et,Wt),V.uniforms=mt.uniforms;let Ct=V.uniforms;return(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(Ct.clippingPlanes=Rt.uniform),B0(M,mt),V.needsLights=LM(M),V.lightsStateVersion=xt,V.needsLights&&(Ct.ambientLightColor.value=H.state.ambient,Ct.lightProbe.value=H.state.probe,Ct.directionalLights.value=H.state.directional,Ct.directionalLightShadows.value=H.state.directionalShadow,Ct.spotLights.value=H.state.spot,Ct.spotLightShadows.value=H.state.spotShadow,Ct.rectAreaLights.value=H.state.rectArea,Ct.ltc_1.value=H.state.rectAreaLTC1,Ct.ltc_2.value=H.state.rectAreaLTC2,Ct.pointLights.value=H.state.point,Ct.pointLightShadows.value=H.state.pointShadow,Ct.hemisphereLights.value=H.state.hemi,Ct.directionalShadowMatrix.value=H.state.directionalShadowMatrix,Ct.spotLightMatrix.value=H.state.spotLightMatrix,Ct.spotLightMap.value=H.state.spotLightMap,Ct.pointShadowMatrix.value=H.state.pointShadowMatrix),V.lightProbeGrid=A.state.lightProbeGridArray.length>0,V.currentProgram=Wt,V.uniformsList=null,Wt}function z0(M){if(M.uniformsList===null){let B=M.currentProgram.getUniforms();M.uniformsList=So.seqWithValue(B.seq,M.uniforms)}return M.uniformsList}function B0(M,B){let q=P.get(M);q.outputColorSpace=B.outputColorSpace,q.batching=B.batching,q.batchingColor=B.batchingColor,q.instancing=B.instancing,q.instancingColor=B.instancingColor,q.instancingMorph=B.instancingMorph,q.skinning=B.skinning,q.morphTargets=B.morphTargets,q.morphNormals=B.morphNormals,q.morphColors=B.morphColors,q.morphTargetsCount=B.morphTargetsCount,q.numClippingPlanes=B.numClippingPlanes,q.numIntersection=B.numClipIntersection,q.vertexAlphas=B.vertexAlphas,q.vertexTangents=B.vertexTangents,q.toneMapping=B.toneMapping}function DM(M,B){if(M.length===0)return null;if(M.length===1)return M[0].texture!==null?M[0]:null;y.setFromMatrixPosition(B.matrixWorld);for(let q=0,V=M.length;q<V;q++){let H=M[q];if(H.texture!==null&&H.boundingBox.containsPoint(y))return H}return null}function UM(M,B,q,V,H){B.isScene!==!0&&(B=Je),F.resetTextureUnits();let gt=B.fog,xt=V.isMeshStandardMaterial||V.isMeshLambertMaterial||V.isMeshPhongMaterial?B.environment:null,mt=Q===null?R.outputColorSpace:Q.isXRRenderTarget===!0?Q.texture.colorSpace:$t.workingColorSpace,Et=V.isMeshStandardMaterial||V.isMeshLambertMaterial&&!V.envMap||V.isMeshPhongMaterial&&!V.envMap,wt=j.get(V.envMap||xt,Et),Ft=V.vertexColors===!0&&!!q.attributes.color&&q.attributes.color.itemSize===4,Wt=!!q.attributes.tangent&&(!!V.normalMap||V.anisotropy>0),Ct=!!q.morphAttributes.position,ue=!!q.morphAttributes.normal,Fe=!!q.morphAttributes.color,Oe=Mi;V.toneMapped&&(Q===null||Q.isXRRenderTarget===!0)&&(Oe=R.toneMapping);let pe=q.morphAttributes.position||q.morphAttributes.normal||q.morphAttributes.color,mn=pe!==void 0?pe.length:0,yt=P.get(V),On=A.state.lights;if(Kt===!0&&(qt===!0||M!==at)){let ve=M===at&&V.id===et;Rt.setState(V,M,ve)}let ie=!1;V.version===yt.__version?(yt.needsLights&&yt.lightsStateVersion!==On.state.version||yt.outputColorSpace!==mt||H.isBatchedMesh&&yt.batching===!1||!H.isBatchedMesh&&yt.batching===!0||H.isBatchedMesh&&yt.batchingColor===!0&&H.colorTexture===null||H.isBatchedMesh&&yt.batchingColor===!1&&H.colorTexture!==null||H.isInstancedMesh&&yt.instancing===!1||!H.isInstancedMesh&&yt.instancing===!0||H.isSkinnedMesh&&yt.skinning===!1||!H.isSkinnedMesh&&yt.skinning===!0||H.isInstancedMesh&&yt.instancingColor===!0&&H.instanceColor===null||H.isInstancedMesh&&yt.instancingColor===!1&&H.instanceColor!==null||H.isInstancedMesh&&yt.instancingMorph===!0&&H.morphTexture===null||H.isInstancedMesh&&yt.instancingMorph===!1&&H.morphTexture!==null||yt.envMap!==wt||V.fog===!0&&yt.fog!==gt||yt.numClippingPlanes!==void 0&&(yt.numClippingPlanes!==Rt.numPlanes||yt.numIntersection!==Rt.numIntersection)||yt.vertexAlphas!==Ft||yt.vertexTangents!==Wt||yt.morphTargets!==Ct||yt.morphNormals!==ue||yt.morphColors!==Fe||yt.toneMapping!==Oe||yt.morphTargetsCount!==mn||!!yt.lightProbeGrid!=A.state.lightProbeGridArray.length>0)&&(ie=!0):(ie=!0,yt.__version=V.version);let ti=yt.currentProgram;ie===!0&&(ti=Ec(V,B,H),L&&V.isNodeMaterial&&L.onUpdateProgram(V,ti,yt));let Ci=!1,Ts=!1,er=!1,me=ti.getUniforms(),Ve=yt.uniforms;if(m.useProgram(ti.program)&&(Ci=!0,Ts=!0,er=!0),V.id!==et&&(et=V.id,Ts=!0),yt.needsLights){let ve=DM(A.state.lightProbeGridArray,H);yt.lightProbeGrid!==ve&&(yt.lightProbeGrid=ve,Ts=!0)}if(Ci||at!==M){m.buffers.depth.getReversed()&&M.reversedDepth!==!0&&(M._reversedDepth=!0,M.updateProjectionMatrix()),me.setValue(O,"projectionMatrix",M.projectionMatrix),me.setValue(O,"viewMatrix",M.matrixWorldInverse);let ws=me.map.cameraPosition;ws!==void 0&&ws.setValue(O,Be.setFromMatrixPosition(M.matrixWorld)),C.logarithmicDepthBuffer&&me.setValue(O,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),(V.isMeshPhongMaterial||V.isMeshToonMaterial||V.isMeshLambertMaterial||V.isMeshBasicMaterial||V.isMeshStandardMaterial||V.isShaderMaterial)&&me.setValue(O,"isOrthographic",M.isOrthographicCamera===!0),at!==M&&(at=M,Ts=!0,er=!0)}if(yt.needsLights&&(On.state.directionalShadowMap.length>0&&me.setValue(O,"directionalShadowMap",On.state.directionalShadowMap,F),On.state.spotShadowMap.length>0&&me.setValue(O,"spotShadowMap",On.state.spotShadowMap,F),On.state.pointShadowMap.length>0&&me.setValue(O,"pointShadowMap",On.state.pointShadowMap,F)),H.isSkinnedMesh){me.setOptional(O,H,"bindMatrix"),me.setOptional(O,H,"bindMatrixInverse");let ve=H.skeleton;ve&&(ve.boneTexture===null&&ve.computeBoneTexture(),me.setValue(O,"boneTexture",ve.boneTexture,F))}H.isBatchedMesh&&(me.setOptional(O,H,"batchingTexture"),me.setValue(O,"batchingTexture",H._matricesTexture,F),me.setOptional(O,H,"batchingIdTexture"),me.setValue(O,"batchingIdTexture",H._indirectTexture,F),me.setOptional(O,H,"batchingColorTexture"),H._colorsTexture!==null&&me.setValue(O,"batchingColorTexture",H._colorsTexture,F));let As=q.morphAttributes;if((As.position!==void 0||As.normal!==void 0||As.color!==void 0)&&I.update(H,q,ti),(Ts||yt.receiveShadow!==H.receiveShadow)&&(yt.receiveShadow=H.receiveShadow,me.setValue(O,"receiveShadow",H.receiveShadow)),(V.isMeshStandardMaterial||V.isMeshLambertMaterial||V.isMeshPhongMaterial)&&V.envMap===null&&B.environment!==null&&(Ve.envMapIntensity.value=B.environmentIntensity),Ve.dfgLUT!==void 0&&(Ve.dfgLUT.value=s3()),Ts){if(me.setValue(O,"toneMappingExposure",R.toneMappingExposure),yt.needsLights&&NM(Ve,er),gt&&V.fog===!0&&Mt.refreshFogUniforms(Ve,gt),Mt.refreshMaterialUniforms(Ve,V,it,rt,A.state.transmissionRenderTarget[M.id]),yt.needsLights&&yt.lightProbeGrid){let ve=yt.lightProbeGrid;Ve.probesSH.value=ve.texture,Ve.probesMin.value.copy(ve.boundingBox.min),Ve.probesMax.value.copy(ve.boundingBox.max),Ve.probesResolution.value.copy(ve.resolution)}So.upload(O,z0(yt),Ve,F)}if(V.isShaderMaterial&&V.uniformsNeedUpdate===!0&&(So.upload(O,z0(yt),Ve,F),V.uniformsNeedUpdate=!1),V.isSpriteMaterial&&me.setValue(O,"center",H.center),me.setValue(O,"modelViewMatrix",H.modelViewMatrix),me.setValue(O,"normalMatrix",H.normalMatrix),me.setValue(O,"modelMatrix",H.matrixWorld),V.uniformsGroups!==void 0){let ve=V.uniformsGroups;for(let ws=0,nr=ve.length;ws<nr;ws++){let F0=ve[ws];tt.update(F0,ti),tt.bind(F0,ti)}}return ti}function NM(M,B){M.ambientLightColor.needsUpdate=B,M.lightProbe.needsUpdate=B,M.directionalLights.needsUpdate=B,M.directionalLightShadows.needsUpdate=B,M.pointLights.needsUpdate=B,M.pointLightShadows.needsUpdate=B,M.spotLights.needsUpdate=B,M.spotLightShadows.needsUpdate=B,M.rectAreaLights.needsUpdate=B,M.hemisphereLights.needsUpdate=B}function LM(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return G},this.getActiveMipmapLevel=function(){return W},this.getRenderTarget=function(){return Q},this.setRenderTargetTextures=function(M,B,q){let V=P.get(M);V.__autoAllocateDepthBuffer=M.resolveDepthBuffer===!1,V.__autoAllocateDepthBuffer===!1&&(V.__useRenderToTexture=!1),P.get(M.texture).__webglTexture=B,P.get(M.depthTexture).__webglTexture=V.__autoAllocateDepthBuffer?void 0:q,V.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(M,B){let q=P.get(M);q.__webglFramebuffer=B,q.__useDefaultFramebuffer=B===void 0},this.setRenderTarget=function(M,B=0,q=0){Q=M,G=B,W=q;let V=null,H=!1,gt=!1;if(M){let mt=P.get(M);if(mt.__useDefaultFramebuffer!==void 0){m.bindFramebuffer(O.FRAMEBUFFER,mt.__webglFramebuffer),ot.copy(M.viewport),vt.copy(M.scissor),kt=M.scissorTest,m.viewport(ot),m.scissor(vt),m.setScissorTest(kt),et=-1;return}else if(mt.__webglFramebuffer===void 0)F.setupRenderTarget(M);else if(mt.__hasExternalTextures)F.rebindTextures(M,P.get(M.texture).__webglTexture,P.get(M.depthTexture).__webglTexture);else if(M.depthBuffer){let Ft=M.depthTexture;if(mt.__boundDepthTexture!==Ft){if(Ft!==null&&P.has(Ft)&&(M.width!==Ft.image.width||M.height!==Ft.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");F.setupDepthRenderbuffer(M)}}let Et=M.texture;(Et.isData3DTexture||Et.isDataArrayTexture||Et.isCompressedArrayTexture)&&(gt=!0);let wt=P.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(Array.isArray(wt[B])?V=wt[B][q]:V=wt[B],H=!0):M.samples>0&&F.useMultisampledRTT(M)===!1?V=P.get(M).__webglMultisampledFramebuffer:Array.isArray(wt)?V=wt[q]:V=wt,ot.copy(M.viewport),vt.copy(M.scissor),kt=M.scissorTest}else ot.copy(St).multiplyScalar(it).floor(),vt.copy(Ae).multiplyScalar(it).floor(),kt=Gt;if(q!==0&&(V=k),m.bindFramebuffer(O.FRAMEBUFFER,V)&&m.drawBuffers(M,V),m.viewport(ot),m.scissor(vt),m.setScissorTest(kt),H){let mt=P.get(M.texture);O.framebufferTexture2D(O.FRAMEBUFFER,O.COLOR_ATTACHMENT0,O.TEXTURE_CUBE_MAP_POSITIVE_X+B,mt.__webglTexture,q)}else if(gt){let mt=B;for(let Et=0;Et<M.textures.length;Et++){let wt=P.get(M.textures[Et]);O.framebufferTextureLayer(O.FRAMEBUFFER,O.COLOR_ATTACHMENT0+Et,wt.__webglTexture,q,mt)}}else if(M!==null&&q!==0){let mt=P.get(M.texture);O.framebufferTexture2D(O.FRAMEBUFFER,O.COLOR_ATTACHMENT0,O.TEXTURE_2D,mt.__webglTexture,q)}et=-1},this.readRenderTargetPixels=function(M,B,q,V,H,gt,xt,mt=0){if(!(M&&M.isWebGLRenderTarget)){Lt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Et=P.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&xt!==void 0&&(Et=Et[xt]),Et){m.bindFramebuffer(O.FRAMEBUFFER,Et);try{let wt=M.textures[mt],Ft=wt.format,Wt=wt.type;if(M.textures.length>1&&O.readBuffer(O.COLOR_ATTACHMENT0+mt),!C.textureFormatReadable(Ft)){Lt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!C.textureTypeReadable(Wt)){Lt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}B>=0&&B<=M.width-V&&q>=0&&q<=M.height-H&&O.readPixels(B,q,V,H,ft.convert(Ft),ft.convert(Wt),gt)}finally{let wt=Q!==null?P.get(Q).__webglFramebuffer:null;m.bindFramebuffer(O.FRAMEBUFFER,wt)}}},this.readRenderTargetPixelsAsync=async function(M,B,q,V,H,gt,xt,mt=0){if(!(M&&M.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Et=P.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&xt!==void 0&&(Et=Et[xt]),Et)if(B>=0&&B<=M.width-V&&q>=0&&q<=M.height-H){m.bindFramebuffer(O.FRAMEBUFFER,Et);let wt=M.textures[mt],Ft=wt.format,Wt=wt.type;if(M.textures.length>1&&O.readBuffer(O.COLOR_ATTACHMENT0+mt),!C.textureFormatReadable(Ft))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!C.textureTypeReadable(Wt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Ct=O.createBuffer();O.bindBuffer(O.PIXEL_PACK_BUFFER,Ct),O.bufferData(O.PIXEL_PACK_BUFFER,gt.byteLength,O.STREAM_READ),O.readPixels(B,q,V,H,ft.convert(Ft),ft.convert(Wt),0);let ue=Q!==null?P.get(Q).__webglFramebuffer:null;m.bindFramebuffer(O.FRAMEBUFFER,ue);let Fe=O.fenceSync(O.SYNC_GPU_COMMANDS_COMPLETE,0);return O.flush(),await Pb(O,Fe,4),O.bindBuffer(O.PIXEL_PACK_BUFFER,Ct),O.getBufferSubData(O.PIXEL_PACK_BUFFER,0,gt),O.deleteBuffer(Ct),O.deleteSync(Fe),gt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(M,B=null,q=0){let V=Math.pow(2,-q),H=Math.floor(M.image.width*V),gt=Math.floor(M.image.height*V),xt=B!==null?B.x:0,mt=B!==null?B.y:0;F.setTexture2D(M,0),O.copyTexSubImage2D(O.TEXTURE_2D,q,0,0,xt,mt,H,gt),m.unbindTexture()},this.copyTextureToTexture=function(M,B,q=null,V=null,H=0,gt=0){let xt,mt,Et,wt,Ft,Wt,Ct,ue,Fe,Oe=M.isCompressedTexture?M.mipmaps[gt]:M.image;if(q!==null)xt=q.max.x-q.min.x,mt=q.max.y-q.min.y,Et=q.isBox3?q.max.z-q.min.z:1,wt=q.min.x,Ft=q.min.y,Wt=q.isBox3?q.min.z:0;else{let Ve=Math.pow(2,-H);xt=Math.floor(Oe.width*Ve),mt=Math.floor(Oe.height*Ve),M.isDataArrayTexture?Et=Oe.depth:M.isData3DTexture?Et=Math.floor(Oe.depth*Ve):Et=1,wt=0,Ft=0,Wt=0}V!==null?(Ct=V.x,ue=V.y,Fe=V.z):(Ct=0,ue=0,Fe=0);let pe=ft.convert(B.format),mn=ft.convert(B.type),yt;B.isData3DTexture?(F.setTexture3D(B,0),yt=O.TEXTURE_3D):B.isDataArrayTexture||B.isCompressedArrayTexture?(F.setTexture2DArray(B,0),yt=O.TEXTURE_2D_ARRAY):(F.setTexture2D(B,0),yt=O.TEXTURE_2D),m.activeTexture(O.TEXTURE0),m.pixelStorei(O.UNPACK_FLIP_Y_WEBGL,B.flipY),m.pixelStorei(O.UNPACK_PREMULTIPLY_ALPHA_WEBGL,B.premultiplyAlpha),m.pixelStorei(O.UNPACK_ALIGNMENT,B.unpackAlignment);let On=m.getParameter(O.UNPACK_ROW_LENGTH),ie=m.getParameter(O.UNPACK_IMAGE_HEIGHT),ti=m.getParameter(O.UNPACK_SKIP_PIXELS),Ci=m.getParameter(O.UNPACK_SKIP_ROWS),Ts=m.getParameter(O.UNPACK_SKIP_IMAGES);m.pixelStorei(O.UNPACK_ROW_LENGTH,Oe.width),m.pixelStorei(O.UNPACK_IMAGE_HEIGHT,Oe.height),m.pixelStorei(O.UNPACK_SKIP_PIXELS,wt),m.pixelStorei(O.UNPACK_SKIP_ROWS,Ft),m.pixelStorei(O.UNPACK_SKIP_IMAGES,Wt);let er=M.isDataArrayTexture||M.isData3DTexture,me=B.isDataArrayTexture||B.isData3DTexture;if(M.isDepthTexture){let Ve=P.get(M),As=P.get(B),ve=P.get(Ve.__renderTarget),ws=P.get(As.__renderTarget);m.bindFramebuffer(O.READ_FRAMEBUFFER,ve.__webglFramebuffer),m.bindFramebuffer(O.DRAW_FRAMEBUFFER,ws.__webglFramebuffer);for(let nr=0;nr<Et;nr++)er&&(O.framebufferTextureLayer(O.READ_FRAMEBUFFER,O.COLOR_ATTACHMENT0,P.get(M).__webglTexture,H,Wt+nr),O.framebufferTextureLayer(O.DRAW_FRAMEBUFFER,O.COLOR_ATTACHMENT0,P.get(B).__webglTexture,gt,Fe+nr)),O.blitFramebuffer(wt,Ft,xt,mt,Ct,ue,xt,mt,O.DEPTH_BUFFER_BIT,O.NEAREST);m.bindFramebuffer(O.READ_FRAMEBUFFER,null),m.bindFramebuffer(O.DRAW_FRAMEBUFFER,null)}else if(H!==0||M.isRenderTargetTexture||P.has(M)){let Ve=P.get(M),As=P.get(B);m.bindFramebuffer(O.READ_FRAMEBUFFER,X),m.bindFramebuffer(O.DRAW_FRAMEBUFFER,z);for(let ve=0;ve<Et;ve++)er?O.framebufferTextureLayer(O.READ_FRAMEBUFFER,O.COLOR_ATTACHMENT0,Ve.__webglTexture,H,Wt+ve):O.framebufferTexture2D(O.READ_FRAMEBUFFER,O.COLOR_ATTACHMENT0,O.TEXTURE_2D,Ve.__webglTexture,H),me?O.framebufferTextureLayer(O.DRAW_FRAMEBUFFER,O.COLOR_ATTACHMENT0,As.__webglTexture,gt,Fe+ve):O.framebufferTexture2D(O.DRAW_FRAMEBUFFER,O.COLOR_ATTACHMENT0,O.TEXTURE_2D,As.__webglTexture,gt),H!==0?O.blitFramebuffer(wt,Ft,xt,mt,Ct,ue,xt,mt,O.COLOR_BUFFER_BIT,O.NEAREST):me?O.copyTexSubImage3D(yt,gt,Ct,ue,Fe+ve,wt,Ft,xt,mt):O.copyTexSubImage2D(yt,gt,Ct,ue,wt,Ft,xt,mt);m.bindFramebuffer(O.READ_FRAMEBUFFER,null),m.bindFramebuffer(O.DRAW_FRAMEBUFFER,null)}else me?M.isDataTexture||M.isData3DTexture?O.texSubImage3D(yt,gt,Ct,ue,Fe,xt,mt,Et,pe,mn,Oe.data):B.isCompressedArrayTexture?O.compressedTexSubImage3D(yt,gt,Ct,ue,Fe,xt,mt,Et,pe,Oe.data):O.texSubImage3D(yt,gt,Ct,ue,Fe,xt,mt,Et,pe,mn,Oe):M.isDataTexture?O.texSubImage2D(O.TEXTURE_2D,gt,Ct,ue,xt,mt,pe,mn,Oe.data):M.isCompressedTexture?O.compressedTexSubImage2D(O.TEXTURE_2D,gt,Ct,ue,Oe.width,Oe.height,pe,Oe.data):O.texSubImage2D(O.TEXTURE_2D,gt,Ct,ue,xt,mt,pe,mn,Oe);m.pixelStorei(O.UNPACK_ROW_LENGTH,On),m.pixelStorei(O.UNPACK_IMAGE_HEIGHT,ie),m.pixelStorei(O.UNPACK_SKIP_PIXELS,ti),m.pixelStorei(O.UNPACK_SKIP_ROWS,Ci),m.pixelStorei(O.UNPACK_SKIP_IMAGES,Ts),gt===0&&B.generateMipmaps&&O.generateMipmap(yt),m.unbindTexture()},this.initRenderTarget=function(M){P.get(M).__webglFramebuffer===void 0&&F.setupRenderTarget(M)},this.initTexture=function(M){M.isCubeTexture?F.setTextureCube(M,0):M.isData3DTexture?F.setTexture3D(M,0):M.isDataArrayTexture||M.isCompressedArrayTexture?F.setTexture2DArray(M,0):F.setTexture2D(M,0),m.unbindTexture()},this.resetState=function(){G=0,W=0,Q=null,m.reset(),_t.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return bi}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let n=this.getContext();n.drawingBufferColorSpace=$t._getDrawingBufferColorSpace(t),n.unpackColorSpace=$t._getUnpackColorSpace()}};var C0=12;var ee=(e,t,n=0)=>({time:e,azimuth:t||0,elevation:n,distance:1}),gM=e=>[...Array.from({length:9},(t,n)=>ee(Number((n*5/48).toFixed(6)),e*n*45)),ee(1,e*360)],gc=(e,t=0)=>[ee(0,0),ee(.2,e/2,t/2),ee(.4,e,t),ee(.6,e/2,t/2),ee(.8,0),ee(1,0)],_M=e=>[...Array.from({length:9},(t,n)=>ee(Number((n*5/48).toFixed(6)),e*n*45,n===8?0:Number((25*Math.sin(Math.PI*n/8)).toFixed(3)))),ee(1,e*360)],KN=[{id:"swing",name:"Side Arc",description:"A 65-degree arc around the frame.",duration:5,returnsToStart:!1,trajectory:[ee(0,0),ee(1,65,8)]},{id:"rise",name:"Hero Rise",description:"A new angle on the action.",duration:5,returnsToStart:!1,trajectory:[ee(0,0),ee(1,35,30)]},{id:"orbit",name:"Full Orbit",description:"A full right orbit back to the starting pose.",duration:6,returnsToStart:!0,trajectory:gM(1)},{id:"arc-return",name:"Arc Return",description:"Sweep 45 degrees to the side, then retrace to the starting pose.",duration:5,returnsToStart:!0,trajectory:[ee(0,0),ee(.2,22.5),ee(.45,45),ee(.7,22.5),ee(.9,0),ee(1,0)]},{id:"rise-return",name:"Rise Return",description:"Rise 25 degrees, then descend to the starting pose.",duration:5,returnsToStart:!0,trajectory:[ee(0,0),ee(.2,0,12.5),ee(.45,0,25),ee(.7,0,12.5),ee(.9,0),ee(1,0)]},{id:"orbit-left",name:"Orbit Left",description:"A full left orbit back to the starting pose.",duration:6,returnsToStart:!0,trajectory:gM(-1)},{id:"arc-left-return",name:"Left Return",description:"Sweep 45 degrees left, then retrace to the opening view.",duration:5,returnsToStart:!0,trajectory:gc(-45)},{id:"wide-return",name:"Wide Return",description:"Reach a 90-degree side view, then return to the opening pose.",duration:5,returnsToStart:!0,trajectory:gc(90)},{id:"dip-return",name:"Dip Return",description:"Dip 20 degrees below the subject, then rise back to the opening view.",duration:5,returnsToStart:!0,trajectory:gc(0,-20)},{id:"high-arc-return",name:"High Return",description:"Arc 45 degrees right and 25 degrees up, then retrace home.",duration:5,returnsToStart:!0,trajectory:gc(45,25)},{id:"low-arc-return",name:"Low Return",description:"Arc 45 degrees left and 20 degrees down, then retrace home.",duration:5,returnsToStart:!0,trajectory:gc(-45,-20)},{id:"sway-return",name:"Side to Side",description:"Sway left, cross through the opening view to the right, then return.",duration:5,returnsToStart:!0,trajectory:[ee(0,0),ee(.2,-30),ee(.4,0),ee(.6,30),ee(.8,0),ee(1,0)]},{id:"halo",name:"High Orbit",description:"Orbit right through a raised viewpoint, descending to the exact opening pose.",duration:6,returnsToStart:!0,trajectory:_M(1)},{id:"halo-left",name:"High Orbit Left",description:"Orbit left through a raised viewpoint, descending to the exact opening pose.",duration:6,returnsToStart:!0,trajectory:_M(-1)},{id:"arc-left",name:"Left Arc",description:"A 65-degree left arc that finishes at a new angle.",duration:5,returnsToStart:!1,trajectory:[ee(0,0),ee(1,-65,8)]},{id:"low-angle",name:"Low Reveal",description:"Sweep 40 degrees right and descend 20 degrees for a low-angle finish.",duration:5,returnsToStart:!1,trajectory:[ee(0,0),ee(1,40,-20)]}];var nt=Tc(R0());async function Mo(e){let t=e instanceof FormData?e:new FormData;if(!(e instanceof FormData))for(let[n,i]of Object.entries(e))t.set(n,i);t.set("format","json");try{return await(await fetch(window.location.pathname,{method:"POST",body:t,credentials:"same-origin"})).json()}catch{return null}}var Sc=Math.PI/180;function _c(e,t,n){return Math.max(t,Math.min(n,e))}function bc(e,t){if(t<=e[0].time)return e[0];let n=e[e.length-1];if(t>=n.time)return n;let i=1;for(;e[i].time<t;)i++;let s=e[i-1],a=e[i],r=Math.max(1e-6,a.time-s.time),o=(t-s.time)/r,l=o*o*(3-2*o),c=a.azimuth-s.azimuth;return c=((c%360+540)%360+360)%360-180,{time:t,azimuth:s.azimuth+c*l,elevation:s.elevation+(a.elevation-s.elevation)*l,distance:s.distance+(a.distance-s.distance)*l}}var TM={time:0,azimuth:0,elevation:0,distance:1},l3={...TM,time:1},vc=1024,SM=["#f8fbff","#ffd166","#ff5d8f","#4db0ff","#39d98a"],c3=[{id:"fast",label:"Flare Fast"},{id:"detailed",label:"Flare Detailed"},{id:"turbo",label:"Turbo"},{id:"hq",label:"Sunburst HQ"}];function u3(e){let t=(0,st.useRef)(null),n=(0,st.useRef)([]),i=(0,st.useRef)(!1),[s,a]=(0,st.useState)(SM[0]),[r,o]=(0,st.useState)(14),[l,c]=(0,st.useState)(!1),[h,p]=(0,st.useState)(""),[u,d]=(0,st.useState)("fast"),[,_]=(0,st.useState)(0),b=(0,st.useCallback)(()=>{let v=t.current,S=v?.getContext("2d");if(!(!v||!S)){S.fillStyle="#0a1120",S.fillRect(0,0,vc,vc);for(let y of n.current){S.save(),S.globalCompositeOperation=y.erase?"destination-out":"source-over",S.strokeStyle=y.color,S.fillStyle=y.color,S.lineWidth=y.width,S.lineCap="round",S.lineJoin="round";let[E,...A]=y.points;if(!E){S.restore();continue}S.beginPath(),S.arc(E.x,E.y,y.width/2,0,Math.PI*2),S.fill(),S.beginPath(),S.moveTo(E.x,E.y);for(let w of A)S.lineTo(w.x,w.y);S.stroke(),S.restore()}}},[]);(0,st.useEffect)(()=>b(),[b]);let g=v=>{let S=v.currentTarget.getBoundingClientRect(),y=vc/Math.max(1,Math.min(S.width,S.height));return{x:(v.clientX-S.left)*y,y:(v.clientY-S.top)*y}},f=n.current.length===0;return(0,nt.jsxs)("div",{className:"fz-sketch",children:[(0,nt.jsx)("canvas",{ref:t,className:"fz-sketch-canvas",width:vc,height:vc,onPointerDown:v=>{v.currentTarget.setPointerCapture(v.pointerId),i.current=!0,n.current.push({points:[g(v)],color:s,width:r,erase:l}),b()},onPointerMove:v=>{i.current&&(n.current[n.current.length-1]?.points.push(g(v)),b())},onPointerUp:()=>{i.current=!1,_(v=>v+1)}}),(0,nt.jsxs)("div",{className:"fz-tools",children:[SM.map(v=>(0,nt.jsx)("button",{type:"button",className:`fz-swatch${!l&&s===v?" selected":""}`,style:{background:v},"aria-label":`paint ${v}`,onClick:()=>{a(v),c(!1)}},v)),(0,nt.jsx)("button",{type:"button",className:`fz-ghost${l?" selected":""}`,onClick:()=>c(v=>!v),children:"erase"}),(0,nt.jsx)("input",{className:"fz-size",type:"range",min:4,max:60,value:r,onChange:v=>o(Number(v.target.value)),"aria-label":"brush size"}),(0,nt.jsx)("button",{type:"button",className:"fz-ghost",disabled:f,onClick:()=>{n.current=[],b(),_(v=>v+1)},children:"clear"})]}),(0,nt.jsx)("textarea",{className:"fz-prompt",placeholder:"describe the scene \u2014 'two friends at a diner, neon light'",value:h,maxLength:2e3,onChange:v=>p(v.target.value)}),(0,nt.jsx)("div",{className:"fz-modes",children:c3.map(v=>(0,nt.jsx)("button",{type:"button",className:u===v.id?"active":"",onClick:()=>d(v.id),children:v.label},v.id))}),(0,nt.jsx)("button",{type:"button",className:"fz-primary",disabled:e.busy||!h.trim(),onClick:()=>{let v=t.current;n.current.length>0&&v?v.toBlob(y=>e.onGenerate(y,h.trim(),u),"image/png"):e.onGenerate(null,h.trim(),u)},children:e.busy?"generating\u2026":"generate the still"})]})}var bM=1/30,MM=10*1024*1024;function h3(e,t){return new Promise((n,i)=>{if(Math.abs(e.currentTime-t)<.001&&e.readyState>=2){n();return}let s=window.setTimeout(()=>{e.removeEventListener("seeked",a),i(new Error("couldn't read that frame"))},1e4);function a(){window.clearTimeout(s),n()}e.addEventListener("seeked",a,{once:!0}),e.currentTime=t})}function AM(e,t){let n=document.createElement("canvas");n.width=Math.min(t,e.videoWidth),n.height=Math.round(n.width*e.videoHeight/Math.max(1,e.videoWidth));let i=n.getContext("2d");return!i||!n.width?null:(i.drawImage(e,0,0,n.width,n.height),n)}async function f3(e,t){try{await h3(e,t);let n=AM(e,160);return n?n.toDataURL("image/jpeg",.8):null}catch{return null}}function d3(e){let{busy:t,onFrame:n}=e,i=(0,st.useRef)(null),s=(0,st.useRef)(null),a=(0,st.useRef)(null),r=(0,st.useRef)(!1),[o,l]=(0,st.useState)(null),[c,h]=(0,st.useState)(0),[p,u]=(0,st.useState)(0),[d,_]=(0,st.useState)([]),[b,g]=(0,st.useState)(!1),[f,v]=(0,st.useState)(!1),[S,y]=(0,st.useState)(null);(0,st.useEffect)(()=>()=>{a.current&&URL.revokeObjectURL(a.current)},[]);let E=(0,st.useCallback)(async x=>{if(!x)return;if(y(null),!x.type.startsWith("video/")){y("choose a video \u2014 mp4, mov, or webm");return}if(x.size>150*1024*1024){y("choose a clip under 150mb");return}g(!0);let T=URL.createObjectURL(x);try{let R=document.createElement("video");if(R.preload="auto",R.muted=!0,R.playsInline=!0,await new Promise((L,k)=>{let X=window.setTimeout(()=>k(new Error("that clip took too long to read")),2e4);R.onloadeddata=()=>{window.clearTimeout(X),L()},R.onerror=()=>{window.clearTimeout(X),k(new Error("can't decode that video \u2014 try an h.264 mp4"))},R.src=T}),!Number.isFinite(R.duration)||R.duration<=0||R.duration>120)throw new Error("choose a clip under two minutes");let D=[];for(let L=0;L<10;L++){let k=Math.max(0,Math.min(R.duration-.05,R.duration*L/10)),X=await f3(R,k);X&&D.push(X)}a.current&&URL.revokeObjectURL(a.current),a.current=T,l(T),h(R.duration),u(R.duration/2),_(D),R.removeAttribute("src"),R.load()}catch(R){URL.revokeObjectURL(T),y(R instanceof Error?R.message:"that video didn't load")}finally{g(!1)}},[]),A=(0,st.useCallback)(x=>{u(x);let T=s.current;T&&(T.pause(),r.current=!0,T.currentTime=x)},[]),w=(0,st.useCallback)(async()=>{let x=s.current;if(!(!x||f||t)){v(!0);try{(r.current||x.readyState<2||Math.abs(x.currentTime-p)>.001)&&await new Promise((D,L)=>{let k=window.setTimeout(()=>{x.removeEventListener("seeked",X),L(new Error("couldn't read that frame"))},1e4),X=()=>{window.clearTimeout(k),D()};x.addEventListener("seeked",X,{once:!0}),r.current||(x.currentTime=p)});let T=Math.min(1920,x.videoWidth),R=null;for(;T>0;){let D=AM(x,T);if(!D)throw new Error("frame capture isn't available");if(R=await new Promise(L=>D.toBlob(k=>L(k),"image/jpeg",.94)),!R)throw new Error("frame capture isn't available");if(R.size<=MM||T<=320)break;T=Math.floor(T*.75)}if(!R||R.size>MM)throw new Error("that frame is too large \u2014 try a smaller clip");n(new File([R],"freeze-frame.jpg",{type:"image/jpeg"}))}catch(T){y(T instanceof Error?T.message:"couldn't capture the frame")}finally{v(!1)}}},[p,f,t,n]);return(0,nt.jsxs)("div",{className:"fz-framepick",children:[(0,nt.jsx)("input",{ref:i,type:"file",accept:"video/*",hidden:!0,onChange:x=>void E(x.target.files?.[0]??null)}),o?(0,nt.jsxs)(nt.Fragment,{children:[(0,nt.jsx)("video",{ref:s,className:"fz-video",src:o,muted:!0,playsInline:!0,preload:"auto",onLoadedData:x=>{r.current=!0,x.currentTarget.currentTime=p},onSeeked:()=>{r.current=!1}}),d.length>0&&(0,nt.jsx)("div",{className:"fz-strip",children:d.map((x,T)=>(0,nt.jsx)("img",{src:x,alt:"",onClick:()=>A(Math.max(0,Math.min(c-.05,c*T/Math.max(1,d.length))))},T))}),(0,nt.jsx)("input",{type:"range",className:"fz-scrub",min:0,max:Math.max(bM,c),step:bM,value:p,onChange:x=>A(Number(x.target.value)),"aria-label":"pick the frame"}),(0,nt.jsxs)("div",{className:"fz-row",children:[(0,nt.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>i.current?.click(),children:"different clip"}),(0,nt.jsx)("button",{type:"button",className:"fz-primary",disabled:f||t,onClick:()=>void w(),children:f?"capturing\u2026":`freeze at ${p.toFixed(2)}s`})]})]}):(0,nt.jsxs)("div",{className:"fz-video-empty",children:[(0,nt.jsx)("p",{className:"fz-sub",children:"pick the clip \u2014 then scrub to the moment to freeze"}),(0,nt.jsx)("button",{type:"button",className:"fz-primary",disabled:b,onClick:()=>i.current?.click(),children:b?"reading the clip\u2026":"choose a video"})]}),S&&(0,nt.jsx)("p",{className:"fz-err",children:S})]})}function yc(e,t,n){let i=t/2,s=n*.46,a=t*.36*e.distance,r=n*.11*e.distance,o=e.azimuth*Sc;return{x:i+Math.sin(o)*a,y:s+n*.16+Math.cos(o)*r-Math.sin(e.elevation*Sc)*n*.3,depth:Math.cos(o)}}var xc=.95,p3=2.3;function gd(e,t){let n=e.azimuth*Sc,i=e.elevation*Sc,s=p3*e.distance;return t.set(Math.sin(n)*Math.cos(i)*s,xc+Math.sin(i)*s,Math.cos(n)*Math.cos(i)*s),t}function m3(e){let t=new fd({antialias:!0,alpha:!0});t.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),e.appendChild(t.domElement),t.domElement.style.position="absolute",t.domElement.style.inset="0";let n=[],i=z=>(n.push(z),z),s=new Vl,a=new yn(42,1,.05,80);a.position.set(3.15,2.05,3.55),a.lookAt(0,.85,0);let r=i(new nc(14,28,2902638,1451582));s.add(r);let o=1.7,l=o*.72,c=new Qe(i(new da(o*1.07,l*1.1)),i(new di({color:924208})));c.position.set(0,xc,0);let h=i(new di({color:4479370})),p=i(new da(o,l)),u=new Qe(p,h);u.position.set(0,xc,.001);let d=new fo(i(new Zl(p)),i(new fa({color:8240895})));d.position.copy(u.position),s.add(c,u,d);let _=i(new di({color:6348031})),b=null,g=new Vi;s.add(g);let f=i(new go(.05,16,12)),v=i(new di({color:6348031})),S=i(new di({color:16777215})),y=i(new di({color:16765286,transparent:!0})),E=new Vi;E.add(new Qe(i(new go(.075,18,14)),y));let A=new Qe(i(new Yl(.048,.17,12)),y);A.rotation.x=Math.PI/2,A.position.z=.14,E.add(A),s.add(E);let w=i(new on().setFromPoints([new N,new N(0,xc,0)])),x=new ho(w,i(new Ql({color:16765286,dashSize:.09,gapSize:.09,transparent:!0,opacity:.45})));x.computeLineDistances(),s.add(x);let T=new N,R=new N(0,xc,0),D=[],L=()=>{let z=e.clientWidth,G=e.clientHeight;if(z===0||G===0)return;let W=new Dt;t.getSize(W),(W.x!==z||W.y!==G)&&(t.setSize(z,G,!1),a.aspect=z/G,a.updateProjectionMatrix()),t.render(s,a)},k=new ResizeObserver(L);k.observe(e);let X=null;return{setImage(z){if(X?.dispose(),z){let G=new xn(z);G.colorSpace=Tn,G.needsUpdate=!0,X=G,h.map=G,h.color.set(16777215)}else X=null,h.map=null,h.color.set(4479370);h.needsUpdate=!0,L()},update(z,G,W){if(D=z,z.length>=2){let et=[];for(let kt=0;kt<=96;kt++)et.push(gd(bc(z,kt/96),new N));let at=new mo(et),ot=new jl(at,120,.018,8,!1),vt=new Qe(ot,_);b&&(s.remove(b),b.geometry.dispose()),b=vt,s.add(b)}else b&&(s.remove(b),b.geometry.dispose(),b=null);g.clear(),z.forEach((et,at)=>{let ot=new Qe(f,at===W?S:v);ot.position.copy(gd(et,T)),at===W&&ot.scale.setScalar(1.3),ot.userData.index=at,g.add(ot)});let Q=bc(z,G);E.position.copy(gd(Q,T)),E.lookAt(R),y.opacity=Math.cos(Q.azimuth*Sc)<-.05?.45:1,w.setFromPoints([E.position.clone(),R.clone()]),x.computeLineDistances(),L()},pick(z,G){let W=e.clientWidth,Q=e.clientHeight,et=null,at=30;return D.forEach((ot,vt)=>{gd(ot,T).project(a);let kt=(T.x*.5+.5)*W,de=(-T.y*.5+.5)*Q,Ht=Math.hypot(kt-z,de-G);Ht<at&&(at=Ht,et=vt)}),et},dispose(){k.disconnect(),X?.dispose(),n.forEach(z=>z.dispose()),b?.geometry.dispose(),t.dispose(),t.domElement.remove()}}}function g3(e){let t=(0,st.useRef)(null),n=(0,st.useRef)(null),[i,s]=(0,st.useState)(!1),a=(0,st.useRef)(null),r=(0,st.useRef)(e);return r.current=e,(0,st.useEffect)(()=>{let o=t.current;if(!o||r.current.lite)return;let l=null;try{l=m3(o)}catch{return}return n.current=l,s(!0),()=>{n.current=null,l.dispose()}},[]),(0,st.useEffect)(()=>{n.current?.setImage(e.image)},[i,e.image]),(0,st.useEffect)(()=>{n.current?.update(e.keyframes,e.scrubT,e.selected)}),(0,nt.jsx)("div",{ref:t,className:"fz-stage-canvas",onPointerDown:o=>{if(!i)return;o.currentTarget.setPointerCapture(o.pointerId);let l=o.currentTarget.getBoundingClientRect(),c=n.current?.pick(o.clientX-l.left,o.clientY-l.top)??null;c!==null&&r.current.onPick(c),a.current={moved:!1,picked:c}},onPointerMove:o=>{let l=a.current;if(!l||!i)return;let c=o.movementX,h=o.movementY;Math.abs(c)+Math.abs(h)<.5||(l.moved=!0,r.current.onDragPose(c*.6,-h*.4))},onPointerUp:()=>{let o=a.current;a.current=null,!(!o||o.moved||!i)&&r.current.onPick(o.picked)},children:!i&&(0,nt.jsx)(_3,{...e})})}function _3(e){let t=(0,st.useRef)(null),n=(0,st.useRef)(null),i=(0,st.useCallback)(()=>{let s=t.current,a=s?.getContext("2d");if(!s||!a)return;let r=Math.min(2,window.devicePixelRatio||1),o=s.clientWidth,l=s.clientHeight;(s.width!==o*r||s.height!==l*r)&&(s.width=o*r,s.height=l*r),a.setTransform(r,0,0,r,0,0),a.clearRect(0,0,o,l),a.strokeStyle="rgba(120,170,255,0.10)",a.lineWidth=1;let c=l*.62;for(let y=0;y<=12;y++){let E=c+Math.pow(y/12,1.6)*(l-c);a.beginPath(),a.moveTo(0,E),a.lineTo(o,E),a.stroke()}for(let y=-8;y<=8;y++)a.beginPath(),a.moveTo(o/2+y*o*.07,c),a.lineTo(o/2+y*o*.22,l),a.stroke();let h=o/2,p=l*.46,u=o*.36,d=l*.11;a.strokeStyle="rgba(125,190,255,0.22)",a.setLineDash([4,6]),a.beginPath(),a.ellipse(h,p+l*.16,u,d,0,0,Math.PI*2),a.stroke(),a.setLineDash([]);let _=e.keyframes;if(_.length>=2){a.strokeStyle="rgba(96,220,255,0.9)",a.lineWidth=3,a.lineCap="round",a.beginPath();let y=96;for(let E=0;E<=y;E++){let A=yc(bc(_,E/y),o,l);E===0?a.moveTo(A.x,A.y):a.lineTo(A.x,A.y)}a.stroke()}let b=Math.min(o*.4,l*.4*(4/3)),g=b*.72;if(a.save(),a.shadowColor="rgba(0,0,0,0.6)",a.shadowBlur=24,a.fillStyle="#0e1a30",a.fillRect(h-b/2,p-g/2,b,g),a.restore(),e.image){let y=e.image,E=Math.min(b/y.width,g/y.height),A=y.width*E,w=y.height*E;a.drawImage(y,h-A/2,p-w/2,A,w)}else a.fillStyle="rgba(219,232,255,0.5)",a.font="13px ui-monospace, monospace",a.textAlign="center",a.fillText("no photo",h,p);a.strokeStyle="rgba(125,190,255,0.5)",a.strokeRect(h-b/2,p-g/2,b,g),_.forEach((y,E)=>{let A=yc(y,o,l);a.beginPath(),a.arc(A.x,A.y,E===e.selected?7:5,0,Math.PI*2),a.fillStyle=E===e.selected?"#ffffff":"#60dcff",a.fill(),E===e.selected&&(a.strokeStyle="rgba(96,220,255,0.6)",a.lineWidth=2,a.stroke())});let f=bc(_,e.scrubT),v=yc(f,o,l),S=v.depth<-.05;a.globalAlpha=S?.45:1,a.beginPath(),a.arc(v.x,v.y,13,0,Math.PI*2),a.fillStyle="#ffd166",a.fill(),a.beginPath(),a.arc(v.x,v.y,5,0,Math.PI*2),a.fillStyle="#0a1120",a.fill(),a.strokeStyle="rgba(255,209,102,0.35)",a.setLineDash([3,5]),a.beginPath(),a.moveTo(v.x,v.y),a.lineTo(h,p),a.stroke(),a.setLineDash([]),a.globalAlpha=1},[e.image,e.keyframes,e.scrubT,e.selected]);return(0,st.useEffect)(()=>{i()},[i]),(0,st.useEffect)(()=>{let s=()=>i();return window.addEventListener("resize",s),()=>window.removeEventListener("resize",s)},[i]),(0,nt.jsx)("canvas",{ref:t,className:"fz-stage-canvas",onPointerDown:s=>{s.currentTarget.setPointerCapture(s.pointerId);let a=s.currentTarget.getBoundingClientRect(),r=s.clientX-a.left,o=s.clientY-a.top,l=e.keyframes.findIndex(c=>{let h=yc(c,a.width,a.height);return Math.hypot(h.x-r,h.y-o)<20});l>=0&&e.onPick(l),n.current={x:r,y:o,moved:!1}},onPointerMove:s=>{let a=n.current;if(!a)return;let r=s.movementX??s.clientX-a.x,o=s.movementY??s.clientY-a.y;Math.abs(r)+Math.abs(o)<.5||(a.moved=!0,a.x=s.clientX,a.y=s.clientY,e.onDragPose(r*.6,-o*.4))},onPointerUp:s=>{let a=n.current;if(n.current=null,a&&!a.moved){let r=s.currentTarget.getBoundingClientRect(),o=e.keyframes.findIndex(l=>{let c=yc(l,r.width,r.height);return Math.hypot(c.x-(s.clientX-r.left),c.y-(s.clientY-r.top))<20});e.onPick(o>=0?o:null)}}})}function v3(e){let[t,n]=(0,st.useState)(e.initial.sourceAssetId?"camera":"source"),[i,s]=(0,st.useState)(e.initial.sourceUrl),[a,r]=(0,st.useState)(e.initial.sourceAssetId),[o,l]=(0,st.useState)(e.initial.renders),[c,h]=(0,st.useState)(e.initial.activeJob),[p,u]=(0,st.useState)(e.initial.latest),[d,_]=(0,st.useState)(!1),[b,g]=(0,st.useState)(null),[f,v]=(0,st.useState)(!1),[S,y]=(0,st.useState)(!1),[E,A]=(0,st.useState)(null),[w,x]=(0,st.useState)([TM,{time:.5,azimuth:65,elevation:8,distance:1},l3]),[T,R]=(0,st.useState)(0),[D,L]=(0,st.useState)(null),[k,X]=(0,st.useState)(null),[z,G]=(0,st.useState)(5),[W,Q]=(0,st.useState)("768P"),[et]=(0,st.useState)(()=>Math.floor(Math.random()*1e6)),at=(0,st.useRef)(null),[,ot]=(0,st.useState)(0),vt=(0,st.useRef)(null),kt=(0,st.useRef)(null),de=(0,st.useRef)(0),Ht=(0,st.useRef)(e.initial.sourceAssetId),Z=(0,st.useRef)(null),rt=(0,st.useCallback)(m=>{let U=Z.current;U&&U!==m&&(URL.revokeObjectURL(U),Z.current=null),m.startsWith("blob:")&&(Z.current=m),s(m)},[]),it=(0,st.useCallback)(()=>{Z.current&&(URL.revokeObjectURL(Z.current),Z.current=null),s(null)},[]);(0,st.useEffect)(()=>()=>{Z.current&&URL.revokeObjectURL(Z.current)},[]);let At=(0,st.useCallback)((m,U=!1)=>{if(typeof m.latest=="number"&&u(m.latest),h(m.activeJob??null),m.line&&g(m.line),m.sourceUrl&&(U||m.sourceAssetId!==Ht.current)&&rt(m.sourceUrl),m.sourceAssetId&&(Ht.current=m.sourceAssetId,r(m.sourceAssetId)),m.renders&&l(m.renders),E&&!m.activeJob){let F=(E.kind==="render"?m.renders:m.sketches)?.find(j=>j.jobId===E.id);F&&(F.state==="delivered"||F.state==="failed")&&(A(null),F.state==="delivered"?E.kind==="render"?(g(null),n("result")):(v(!1),g("still delivered \u2014 set the camera move"),n("camera")):g(F.error??"that didn't come out \u2014 try again?"))}},[E,rt]),Ot=(0,st.useRef)(0),St=(0,st.useCallback)(async()=>{let m=++Ot.current,U=await Mo({action:"status",after:String(p)});if(!(!U||m!==Ot.current))return At(U),U},[p,At]),Ae=(0,st.useCallback)(async m=>{for(let U=0;U<10;U++){if(Ht.current!==m)return;let P=await St();if(Ht.current!==m)return;if(P&&P.sourceAssetId===m&&(At(P,!0),P.sourceUrl)){g(null);return}await new Promise(F=>setTimeout(F,1200))}Ht.current===m&&g("still converting \u2014 back out and re-upload if it stalls")},[St,At]),Gt=(0,st.useCallback)(()=>{let m=Date.now();m-de.current<3e4||(de.current=m,St().then(U=>{U&&At(U,!0)}))},[St,At]),se=(0,st.useRef)(0);(0,st.useEffect)(()=>{let m=++se.current;if(!i){at.current=null,ot(P=>P+1);return}let U=new Image;U.crossOrigin="anonymous",U.onload=()=>{m===se.current&&(at.current=U,ot(P=>P+1))},U.onerror=()=>{m===se.current&&Gt()},U.src=i},[i,Gt]),(0,st.useEffect)(()=>{if(!c)return;let m=!1,U=window.setInterval(()=>{m||(m=!0,St().finally(()=>{m=!1}))},2500);return()=>window.clearInterval(U)},[c,St]);let Kt=(m,U)=>g(m?.line??U),qt=(0,st.useCallback)(async m=>{if(!m||d)return;_(!0),g("reading the photo\u2026");let P=m.type.startsWith("image/")&&!/hei[cf]/i.test(m.type)?URL.createObjectURL(m):null,F=new FormData;F.set("action","source"),F.set("file",m);let j=await Mo(F);if(_(!1),!j||j.error||j.sourceAssetId===void 0){P&&URL.revokeObjectURL(P),Kt(j,"that photo didn't come through \u2014 try another.");return}g(null),r(j.sourceAssetId),v(!1),y(!1),Ht.current=j.sourceAssetId,j.sourceUrl?(P&&URL.revokeObjectURL(P),rt(j.sourceUrl)):P?rt(P):(it(),g("converting the photo\u2026")),n("camera"),St(),!j.sourceUrl&&!P&&j.sourceAssetId&&Ae(j.sourceAssetId)},[d,St,rt,it,Ae]),Ne=(0,st.useCallback)(async(m,U,P)=>{if(d)return;_(!0),g("generating the still \u2014 about a minute");let F=new FormData;F.set("action","source"),F.set("kind","sketch"),F.set("prompt",U),F.set("mode",P),m&&F.set("canvas",m,"sketch.png");let j=await Mo(F);if(_(!1),!j||j.error||!j.jobId){Kt(j,"that didn't work \u2014 try again?");return}A({id:j.jobId,kind:"sketch"}),At(j),g("generating the still \u2014 about a minute")},[d,At]),Be=(0,st.useCallback)(m=>{X(m.id),G(m.duration===6?6:5),x(m.trajectory.map(U=>({...U}))),L(null),R(0)},[]),ke=(0,st.useCallback)(()=>{x(m=>{if(m.length>=C0)return m;let U=_c(T,.02,.98);if(m.some(j=>Math.abs(j.time-U)<.01))return m;let P=bc(m,U);return[...m,{...P,time:U}].sort((j,lt)=>j.time-lt.time).map(j=>({...j}))}),X(null)},[T]),Je=(0,st.useCallback)(()=>{x(m=>{if(D===null||m.length<=2)return m;let U=m[D];return!U||U.time===0||U.time===1?m:m.filter((P,F)=>F!==D)}),L(null),X(null)},[D]),we=(0,st.useCallback)((m,U)=>{X(null),x(P=>{let F=D;if(F===null){let Y=1/0;P.forEach((J,ct)=>{let Mt=Math.abs(J.time-T);Mt<Y&&(Y=Mt,F=ct)})}if(F===null)return P;let j=P[F];if(!j||j.time===0||j.time===1)return P;let lt=P.map((Y,J)=>J===F?{...Y,azimuth:_c(Y.azimuth+m,-360,360),elevation:_c(Y.elevation+U,-90,90)}:Y);return L(F),lt})},[D,T]),Le=(0,st.useCallback)(async()=>{if(d||!a||!i)return;_(!0),g("rendering the freeze \u2014 a few minutes");let m={action:"render",duration:String(z),resolution:W,seed:String(et)};k?m.preset=k:m.trajectory=JSON.stringify(w);let U=await Mo(m);if(_(!1),!U||U.error||!U.jobId){Kt(U,"that render didn't start \u2014 try again?");return}A({id:U.jobId,kind:"render"}),At(U),g("freezing \u2014 a few minutes")},[d,a,i,k,W,et,w,z,At]),O=(0,st.useCallback)(async m=>{if(d)return;_(!0),g("sending to iMessage\u2026");let U=await Mo({action:"save",job:m});if(_(!1),!U||U.error){Kt(U,"couldn't send it \u2014 try again");return}U.downloadUrl?(window.open(U.downloadUrl,"_blank","noopener"),g("sent the link \u2014 it's only good for a little while")):g("sent to iMessage")},[d]),pn=(0,st.useCallback)(async()=>{await Mo({action:"cancel"}),A(null),g(null),await St()},[St]),jt=(0,st.useMemo)(()=>o.filter(m=>m.state==="delivered"&&m.outputUrl),[o]),C=jt[jt.length-1];return(0,nt.jsxs)("div",{className:"fz",children:[(0,nt.jsx)("div",{className:"fz-tabs",children:["source","camera","result"].map(m=>(0,nt.jsx)("button",{type:"button",className:t===m?"active":"",disabled:m==="camera"&&!a||m==="result"&&jt.length===0,onClick:()=>n(m),children:m==="source"?"1 \xB7 photo":m==="camera"?"2 \xB7 camera":"3 \xB7 freeze"},m))}),c&&(0,nt.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>void pn(),children:"cancel the running job"}),t==="source"&&(0,nt.jsx)("div",{className:"fz-stage",children:!f&&!S?(0,nt.jsxs)(nt.Fragment,{children:[(0,nt.jsxs)("div",{className:"fz-hero",children:[(0,nt.jsx)("p",{className:"fz-title",children:"freeze the scene"}),(0,nt.jsx)("p",{className:"fz-sub",children:"pick the still \u2014 the camera moves, the moment doesn\u2019t"})]}),(0,nt.jsxs)("div",{className:"fz-source-grid",children:[(0,nt.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>kt.current?.click(),children:[(0,nt.jsx)("span",{className:"fz-card-icon",children:"\u25C9"}),"take a photo"]}),(0,nt.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>vt.current?.click(),children:[(0,nt.jsx)("span",{className:"fz-card-icon",children:"\u25A4"}),"upload a photo"]}),(0,nt.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>v(!0),children:[(0,nt.jsx)("span",{className:"fz-card-icon",children:"\u270E"}),"sketch + generate"]}),(0,nt.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>y(!0),children:[(0,nt.jsx)("span",{className:"fz-card-icon",children:"\u25B6"}),"video \u2192 freeze a frame"]})]}),(0,nt.jsx)("input",{ref:kt,type:"file",accept:"image/*,.heic,.heif",capture:"environment",hidden:!0,onChange:m=>void qt(m.target.files?.[0]??null)}),(0,nt.jsx)("input",{ref:vt,type:"file",accept:"image/*,.heic,.heif",hidden:!0,onChange:m=>void qt(m.target.files?.[0]??null)}),jt.length>0&&(0,nt.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>n("result"),children:"see your freezes \u2192"})]}):f?(0,nt.jsxs)(nt.Fragment,{children:[(0,nt.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>v(!1),children:"\u2190 back"}),(0,nt.jsx)(u3,{busy:d||E?.kind==="sketch",onGenerate:Ne})]}):(0,nt.jsxs)(nt.Fragment,{children:[(0,nt.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>y(!1),children:"\u2190 back"}),(0,nt.jsx)(d3,{busy:d,onFrame:m=>void qt(m)})]})}),t==="camera"&&(0,nt.jsxs)("div",{className:"fz-stage",children:[(0,nt.jsx)("div",{className:"fz-stage-wrap",children:(0,nt.jsx)(g3,{image:at.current,keyframes:w,scrubT:T,selected:D,lite:e.initial.lite,onDragPose:we,onPick:L})}),(0,nt.jsx)("div",{className:"fz-presets",children:e.initial.presets.map(m=>(0,nt.jsx)("button",{type:"button",className:`fz-chip${k===m.id?" active":""}`,title:m.description,onClick:()=>Be(m),children:m.name},m.id))}),(0,nt.jsxs)("div",{className:"fz-timeline",children:[(0,nt.jsxs)("div",{className:"fz-track",onPointerDown:m=>{let U=m.currentTarget.getBoundingClientRect();R(_c((m.clientX-U.left)/U.width,0,1)),m.currentTarget.setPointerCapture(m.pointerId)},onPointerMove:m=>{if(m.buttons!==1)return;let U=m.currentTarget.getBoundingClientRect();R(_c((m.clientX-U.left)/U.width,0,1))},children:[(0,nt.jsx)("div",{className:"fz-track-line"}),w.map((m,U)=>(0,nt.jsx)("button",{type:"button",className:`fz-kf${D===U?" selected":""}`,style:{left:`${m.time*100}%`},onPointerDown:P=>{P.stopPropagation(),L(U),R(m.time)},onClick:P=>P.stopPropagation(),"aria-label":`keyframe ${U+1} at ${Math.round(m.time*100)}%`},U)),(0,nt.jsx)("div",{className:"fz-head",style:{left:`${T*100}%`}})]}),(0,nt.jsxs)("div",{className:"fz-timeline-row",children:[(0,nt.jsxs)("span",{className:"fz-meta",children:[w.length," keyframes \xB7 ",z,"s",D!==null?` \xB7 keyframe ${D+1}: ${w[D].time===0||w[D].time===1?"endpoints stay":"drag the stage to change it"}`:" \xB7 tap a dot, drag the stage"]}),(0,nt.jsxs)("div",{className:"fz-timeline-actions",children:[(0,nt.jsx)("button",{type:"button",className:"fz-ghost",disabled:w.length>=C0,onClick:ke,children:"+ keyframe"}),(0,nt.jsx)("button",{type:"button",className:"fz-ghost",disabled:D===null||w[D]?.time===0||w[D]?.time===1,onClick:Je,children:"\u2212 remove"})]})]})]}),(0,nt.jsxs)("div",{className:"fz-render-row",children:[(0,nt.jsx)("div",{className:"fz-seg",children:[5,6].map(m=>(0,nt.jsxs)("button",{type:"button",className:z===m?"active":"",onClick:()=>G(m),children:[m,"s"]},m))}),(0,nt.jsx)("div",{className:"fz-seg",children:["480P","768P","1080P"].map(m=>(0,nt.jsx)("button",{type:"button",className:W===m?"active":"",onClick:()=>Q(m),children:m==="480P"?"480":m==="768P"?"720":"1080"},m))}),(0,nt.jsx)("button",{type:"button",className:"fz-primary",disabled:d||!a||!i||E!==null,onClick:()=>void Le(),children:E?.kind==="render"||d?"freezing\u2026":"freeze it"})]})]}),t==="result"&&(0,nt.jsxs)("div",{className:"fz-stage",children:[C?(0,nt.jsxs)("div",{className:"fz-result",children:[(0,nt.jsx)("video",{className:"fz-video",src:C.outputUrl??void 0,controls:!0,playsInline:!0,loop:!0,autoPlay:!0,muted:!0,onError:Gt}),(0,nt.jsxs)("div",{className:"fz-actions",children:[(0,nt.jsx)("button",{type:"button",className:"fz-primary",disabled:d,onClick:()=>void O(C.jobId),children:"send to iMessage"}),(0,nt.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>n("camera"),children:"new camera move"})]})]}):c?(0,nt.jsx)("p",{className:"fz-sub",children:"rendering \u2014 this takes a few minutes"}):(0,nt.jsx)("p",{className:"fz-sub",children:"nothing rendered yet"}),jt.length>1&&(0,nt.jsx)("div",{className:"fz-history",children:jt.slice(0,-1).reverse().map(m=>(0,nt.jsxs)("div",{className:"fz-history-row",children:[(0,nt.jsx)("video",{className:"fz-thumb",src:m.outputUrl??void 0,muted:!0,playsInline:!0,preload:"metadata",onError:Gt}),(0,nt.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>void O(m.jobId),children:"send"})]},m.jobId))})]}),(0,nt.jsx)("p",{className:"fz-line",children:b??""})]})}var y3=`
.fz{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;font-family:var(--font-ui,ui-monospace,monospace)}
.fz-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:#070a12;border-radius:12px;padding:3px}
.fz-tabs button{min-height:40px;border:0;border-radius:9px;background:transparent;color:#7d94bb;font-weight:750;font-size:0.72rem;letter-spacing:0.04em;text-transform:uppercase}
.fz-tabs button.active{background:#123d72c7;color:#9dd8ff;box-shadow:inset 0 0 0 1px #4db0ff55}
.fz-tabs button:disabled{opacity:0.35}
.fz-stage{display:flex;flex-direction:column;gap:10px;flex:1;min-height:0}
.fz-hero{text-align:center;padding:14px 8px 4px}
.fz-title{margin:0;color:#f8fbff;font-size:1.5rem;font-weight:850;letter-spacing:-0.02em}
.fz-sub{margin:6px 0 0;color:#7d94bb;font-size:0.8rem}
.fz-source-grid{display:grid;grid-template-columns:1fr;gap:10px;padding:10px 4px}
.fz-card{display:flex;align-items:center;gap:14px;min-height:84px;padding:16px;border:1px solid #75baff44;border-radius:16px;background:linear-gradient(135deg,#111d35d9,#080d1ae8);color:#f8fbff;font-size:1rem;font-weight:750;text-align:left;box-shadow:inset 0 1px #e6f4ff1c,0 14px 34px #0006}
.fz-card-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;background:#123d72c7;color:#9dd8ff;font-size:1.3rem;flex:0 0 46px}
.fz-card:active{transform:translateY(1px)}
.fz-card:disabled{opacity:0.5}
.fz-sketch{display:flex;flex-direction:column;gap:8px}
.fz-sketch-canvas{width:100%;aspect-ratio:1;border-radius:14px;background:#0a1120;border:1px solid #75baff44;touch-action:none}
.fz-tools{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.fz-swatch{display:block;width:32px;min-height:32px;padding:0;border:2px solid #f8fbff33;border-radius:50%;flex:0 0 32px}
.fz-swatch.selected{border-color:#f8fbff;outline:2px solid #4db0ff;outline-offset:2px}
.fz-size{flex:1;min-width:70px;accent-color:#3ca7ff}
.fz-prompt{width:100%;min-height:3rem;max-height:6rem;font-size:1rem;padding:10px 12px;background:#12213a9c;border:1px solid #7dbfff55;border-radius:10px;color:#f8fbff;font-family:inherit;resize:vertical}
.fz-prompt::placeholder{color:#5d739a}
.fz-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;background:#070a12;border-radius:12px;padding:3px}
.fz-modes button{display:grid;place-items:center;min-height:44px;border:0;border-radius:9px;background:transparent;color:#7d94bb;font-size:0.66rem;font-weight:700;padding:4px}
.fz-modes button.active{background:#123d72c7;color:#9dd8ff;box-shadow:inset 0 0 0 1px #4db0ff55}
.fz-stage-wrap{position:relative;flex:1;min-height:240px;border-radius:16px;overflow:hidden;background:radial-gradient(120% 90% at 50% 10%,#101d36 0%,#070b15 70%);border:1px solid #75baff33}
.fz-stage-canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
.fz-presets{display:flex;gap:6px;overflow-x:auto;padding:2px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.fz-presets::-webkit-scrollbar{display:none}
.fz-chip{flex:0 0 auto;min-height:36px;padding:6px 13px;border:1px solid #6facf144;border-radius:999px;background:#0b1425c9;color:#dbe8ff;font-size:0.72rem;font-weight:700;white-space:nowrap}
.fz-chip.active{background:#123d72c7;color:#9dd8ff;border-color:#4db0ff;box-shadow:0 0 0 1px #3ca7ff55,0 0 14px #3ca7ff44}
.fz-timeline{display:flex;flex-direction:column;gap:4px;padding:0 2px}
.fz-track{position:relative;height:44px;touch-action:none;cursor:pointer}
.fz-track-line{position:absolute;left:0;right:0;top:50%;height:2px;background:#2a4a78;border-radius:2px}
.fz-kf{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;padding:0;border:2px solid #60dcff;border-radius:50%;background:#0a1120}
.fz-kf.selected{background:#ffd166;border-color:#ffd166}
.fz-head{position:absolute;top:6px;bottom:6px;width:2px;margin-left:-1px;background:#ffd166;border-radius:2px;pointer-events:none}
.fz-timeline-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.fz-meta{color:#7d94bb;font-size:0.66rem}
.fz-timeline-actions{display:flex;gap:6px}
.fz-render-row{display:flex;align-items:center;gap:8px}
.fz-seg{display:flex;background:#070a12;border-radius:10px;padding:2px}
.fz-seg button{min-width:44px;min-height:38px;border:0;border-radius:8px;background:transparent;color:#7d94bb;font-size:0.7rem;font-weight:750}
.fz-seg button.active{background:#123d72c7;color:#9dd8ff}
.fz-primary{flex:1;min-height:46px;border:0;border-radius:12px;background:linear-gradient(135deg,#2f8be8,#1760c8);color:#f8fbff;font-weight:850;font-size:0.9rem;letter-spacing:0.02em;box-shadow:inset 0 1px #eff9ff4a,0 10px 22px #0a52b64c}
.fz-primary:disabled{opacity:0.5}
.fz-ghost{min-height:38px;padding:8px 12px;border:1px solid #6facf144;border-radius:10px;background:#183354aa;color:#f8fbff;font-weight:700;font-size:0.7rem;letter-spacing:0.04em;text-transform:uppercase}
.fz-ghost:disabled{opacity:0.35}
.fz-ghost.selected{border-color:#4db0ff;color:#9dd8ff}
.fz-result{display:flex;flex-direction:column;gap:10px}
.fz-video{width:100%;border-radius:14px;background:#000;max-height:56vh}
.fz-framepick{display:flex;flex-direction:column;gap:8px}
.fz-video-empty{display:flex;flex-direction:column;gap:10px;align-items:center;padding:18px 8px}
.fz-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.fz-strip img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;border:1px solid #75baff33;display:block}
.fz-scrub{width:100%;min-height:36px;accent-color:#3ca7ff;touch-action:pan-x}
.fz-row{display:flex;gap:8px;align-items:center}
.fz-err{margin:0;text-align:center;font-size:0.72rem;color:#ff9d9d}
.fz-actions{display:flex;gap:8px}
.fz-history{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.fz-history-row{display:flex;align-items:center;gap:10px}
.fz-thumb{width:88px;border-radius:8px;background:#000}
.fz-line{margin:0;min-height:1rem;text-align:center;font-size:0.72rem;color:#dbe8ff}
@media(prefers-reduced-motion:reduce){.fz-card,.fz-primary{transition:none}}
`,D0=document.getElementById("freeze-studio");if(D0){let e=null;try{e=JSON.parse(D0.dataset.payload??"")}catch{e=null}if(e){let t=document.createElement("style");t.textContent=y3,document.head.appendChild(t),(0,EM.createRoot)(D0).render((0,nt.jsx)(st.StrictMode,{children:(0,nt.jsx)(v3,{initial:e})}))}}})();
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
