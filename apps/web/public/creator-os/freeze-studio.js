"use strict";(()=>{var OM=Object.create;var G0=Object.defineProperty;var PM=Object.getOwnPropertyDescriptor;var zM=Object.getOwnPropertyNames;var BM=Object.getPrototypeOf,FM=Object.prototype.hasOwnProperty;var Di=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var VM=(e,t,n,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of zM(t))!FM.call(e,s)&&s!==n&&G0(e,s,{get:()=>t[s],enumerable:!(i=PM(t,s))||i.enumerable});return e};var Ec=(e,t,n)=>(n=e!=null?OM(BM(e)):{},VM(t||!e||!e.__esModule?G0(n,"default",{value:e,enumerable:!0}):n,e));var $0=Di(Ft=>{"use strict";var Md=Symbol.for("react.transitional.element"),HM=Symbol.for("react.portal"),GM=Symbol.for("react.fragment"),kM=Symbol.for("react.strict_mode"),XM=Symbol.for("react.profiler"),WM=Symbol.for("react.consumer"),qM=Symbol.for("react.context"),YM=Symbol.for("react.forward_ref"),ZM=Symbol.for("react.suspense"),JM=Symbol.for("react.memo"),Y0=Symbol.for("react.lazy"),KM=Symbol.for("react.activity"),k0=Symbol.iterator;function jM(e){return e===null||typeof e!="object"?null:(e=k0&&e[k0]||e["@@iterator"],typeof e=="function"?e:null)}var Z0={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},J0=Object.assign,K0={};function ar(e,t,n){this.props=e,this.context=t,this.refs=K0,this.updater=n||Z0}ar.prototype.isReactComponent={};ar.prototype.setState=function(e,t){if(typeof e!="object"&&typeof e!="function"&&e!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,t,"setState")};ar.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};function j0(){}j0.prototype=ar.prototype;function Ed(e,t,n){this.props=e,this.context=t,this.refs=K0,this.updater=n||Z0}var Td=Ed.prototype=new j0;Td.constructor=Ed;J0(Td,ar.prototype);Td.isPureReactComponent=!0;var X0=Array.isArray;function Sd(){}var Se={H:null,A:null,T:null,S:null},Q0=Object.prototype.hasOwnProperty;function Ad(e,t,n){var i=n.ref;return{$$typeof:Md,type:e,key:t,ref:i!==void 0?i:null,props:n}}function QM(e,t){return Ad(e.type,t,e.props)}function wd(e){return typeof e=="object"&&e!==null&&e.$$typeof===Md}function $M(e){var t={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,function(n){return t[n]})}var W0=/\/+/g;function bd(e,t){return typeof e=="object"&&e!==null&&e.key!=null?$M(""+e.key):t.toString(36)}function t1(e){switch(e.status){case"fulfilled":return e.value;case"rejected":throw e.reason;default:switch(typeof e.status=="string"?e.then(Sd,Sd):(e.status="pending",e.then(function(t){e.status==="pending"&&(e.status="fulfilled",e.value=t)},function(t){e.status==="pending"&&(e.status="rejected",e.reason=t)})),e.status){case"fulfilled":return e.value;case"rejected":throw e.reason}}throw e}function sr(e,t,n,i,s){var a=typeof e;(a==="undefined"||a==="boolean")&&(e=null);var r=!1;if(e===null)r=!0;else switch(a){case"bigint":case"string":case"number":r=!0;break;case"object":switch(e.$$typeof){case Md:case HM:r=!0;break;case Y0:return r=e._init,sr(r(e._payload),t,n,i,s)}}if(r)return s=s(e),r=i===""?"."+bd(e,0):i,X0(s)?(n="",r!=null&&(n=r.replace(W0,"$&/")+"/"),sr(s,t,n,"",function(c){return c})):s!=null&&(wd(s)&&(s=QM(s,n+(s.key==null||e&&e.key===s.key?"":(""+s.key).replace(W0,"$&/")+"/")+r)),t.push(s)),1;r=0;var o=i===""?".":i+":";if(X0(e))for(var l=0;l<e.length;l++)i=e[l],a=o+bd(i,l),r+=sr(i,t,n,a,s);else if(l=jM(e),typeof l=="function")for(e=l.call(e),l=0;!(i=e.next()).done;)i=i.value,a=o+bd(i,l++),r+=sr(i,t,n,a,s);else if(a==="object"){if(typeof e.then=="function")return sr(t1(e),t,n,i,s);throw t=String(e),Error("Objects are not valid as a React child (found: "+(t==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":t)+"). If you meant to render a collection of children, use an array instead.")}return r}function Tc(e,t,n){if(e==null)return e;var i=[],s=0;return sr(e,i,"","",function(a){return t.call(n,a,s++)}),i}function e1(e){if(e._status===-1){var t=e._result;t=t(),t.then(function(n){(e._status===0||e._status===-1)&&(e._status=1,e._result=n)},function(n){(e._status===0||e._status===-1)&&(e._status=2,e._result=n)}),e._status===-1&&(e._status=0,e._result=t)}if(e._status===1)return e._result.default;throw e._result}var q0=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},n1={map:Tc,forEach:function(e,t,n){Tc(e,function(){t.apply(this,arguments)},n)},count:function(e){var t=0;return Tc(e,function(){t++}),t},toArray:function(e){return Tc(e,function(t){return t})||[]},only:function(e){if(!wd(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};Ft.Activity=KM;Ft.Children=n1;Ft.Component=ar;Ft.Fragment=GM;Ft.Profiler=XM;Ft.PureComponent=Ed;Ft.StrictMode=kM;Ft.Suspense=ZM;Ft.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=Se;Ft.__COMPILER_RUNTIME={__proto__:null,c:function(e){return Se.H.useMemoCache(e)}};Ft.cache=function(e){return function(){return e.apply(null,arguments)}};Ft.cacheSignal=function(){return null};Ft.cloneElement=function(e,t,n){if(e==null)throw Error("The argument must be a React element, but you passed "+e+".");var i=J0({},e.props),s=e.key;if(t!=null)for(a in t.key!==void 0&&(s=""+t.key),t)!Q0.call(t,a)||a==="key"||a==="__self"||a==="__source"||a==="ref"&&t.ref===void 0||(i[a]=t[a]);var a=arguments.length-2;if(a===1)i.children=n;else if(1<a){for(var r=Array(a),o=0;o<a;o++)r[o]=arguments[o+2];i.children=r}return Ad(e.type,s,i)};Ft.createContext=function(e){return e={$$typeof:qM,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null},e.Provider=e,e.Consumer={$$typeof:WM,_context:e},e};Ft.createElement=function(e,t,n){var i,s={},a=null;if(t!=null)for(i in t.key!==void 0&&(a=""+t.key),t)Q0.call(t,i)&&i!=="key"&&i!=="__self"&&i!=="__source"&&(s[i]=t[i]);var r=arguments.length-2;if(r===1)s.children=n;else if(1<r){for(var o=Array(r),l=0;l<r;l++)o[l]=arguments[l+2];s.children=o}if(e&&e.defaultProps)for(i in r=e.defaultProps,r)s[i]===void 0&&(s[i]=r[i]);return Ad(e,a,s)};Ft.createRef=function(){return{current:null}};Ft.forwardRef=function(e){return{$$typeof:YM,render:e}};Ft.isValidElement=wd;Ft.lazy=function(e){return{$$typeof:Y0,_payload:{_status:-1,_result:e},_init:e1}};Ft.memo=function(e,t){return{$$typeof:JM,type:e,compare:t===void 0?null:t}};Ft.startTransition=function(e){var t=Se.T,n={};Se.T=n;try{var i=e(),s=Se.S;s!==null&&s(n,i),typeof i=="object"&&i!==null&&typeof i.then=="function"&&i.then(Sd,q0)}catch(a){q0(a)}finally{t!==null&&n.types!==null&&(t.types=n.types),Se.T=t}};Ft.unstable_useCacheRefresh=function(){return Se.H.useCacheRefresh()};Ft.use=function(e){return Se.H.use(e)};Ft.useActionState=function(e,t,n){return Se.H.useActionState(e,t,n)};Ft.useCallback=function(e,t){return Se.H.useCallback(e,t)};Ft.useContext=function(e){return Se.H.useContext(e)};Ft.useDebugValue=function(){};Ft.useDeferredValue=function(e,t){return Se.H.useDeferredValue(e,t)};Ft.useEffect=function(e,t){return Se.H.useEffect(e,t)};Ft.useEffectEvent=function(e){return Se.H.useEffectEvent(e)};Ft.useId=function(){return Se.H.useId()};Ft.useImperativeHandle=function(e,t,n){return Se.H.useImperativeHandle(e,t,n)};Ft.useInsertionEffect=function(e,t){return Se.H.useInsertionEffect(e,t)};Ft.useLayoutEffect=function(e,t){return Se.H.useLayoutEffect(e,t)};Ft.useMemo=function(e,t){return Se.H.useMemo(e,t)};Ft.useOptimistic=function(e,t){return Se.H.useOptimistic(e,t)};Ft.useReducer=function(e,t,n){return Se.H.useReducer(e,t,n)};Ft.useRef=function(e){return Se.H.useRef(e)};Ft.useState=function(e){return Se.H.useState(e)};Ft.useSyncExternalStore=function(e,t,n){return Se.H.useSyncExternalStore(e,t,n)};Ft.useTransition=function(){return Se.H.useTransition()};Ft.version="19.2.8"});var Ac=Di((E2,t_)=>{"use strict";t_.exports=$0()});var u_=Di(Re=>{"use strict";function Nd(e,t){var n=e.length;e.push(t);t:for(;0<n;){var i=n-1>>>1,s=e[i];if(0<wc(s,t))e[i]=t,e[n]=s,n=i;else break t}}function Ni(e){return e.length===0?null:e[0]}function Rc(e){if(e.length===0)return null;var t=e[0],n=e.pop();if(n!==t){e[0]=n;t:for(var i=0,s=e.length,a=s>>>1;i<a;){var r=2*(i+1)-1,o=e[r],l=r+1,c=e[l];if(0>wc(o,n))l<s&&0>wc(c,o)?(e[i]=c,e[l]=n,i=l):(e[i]=o,e[r]=n,i=r);else if(l<s&&0>wc(c,n))e[i]=c,e[l]=n,i=l;else break t}}return t}function wc(e,t){var n=e.sortIndex-t.sortIndex;return n!==0?n:e.id-t.id}Re.unstable_now=void 0;typeof performance=="object"&&typeof performance.now=="function"?(e_=performance,Re.unstable_now=function(){return e_.now()}):(Cd=Date,n_=Cd.now(),Re.unstable_now=function(){return Cd.now()-n_});var e_,Cd,n_,Ki=[],Rs=[],i1=1,ei=null,gn=3,Ud=!1,To=!1,Ao=!1,Ld=!1,a_=typeof setTimeout=="function"?setTimeout:null,r_=typeof clearTimeout=="function"?clearTimeout:null,i_=typeof setImmediate<"u"?setImmediate:null;function Cc(e){for(var t=Ni(Rs);t!==null;){if(t.callback===null)Rc(Rs);else if(t.startTime<=e)Rc(Rs),t.sortIndex=t.expirationTime,Nd(Ki,t);else break;t=Ni(Rs)}}function Id(e){if(Ao=!1,Cc(e),!To)if(Ni(Ki)!==null)To=!0,or||(or=!0,rr());else{var t=Ni(Rs);t!==null&&Od(Id,t.startTime-e)}}var or=!1,wo=-1,o_=5,l_=-1;function c_(){return Ld?!0:!(Re.unstable_now()-l_<o_)}function Rd(){if(Ld=!1,or){var e=Re.unstable_now();l_=e;var t=!0;try{t:{To=!1,Ao&&(Ao=!1,r_(wo),wo=-1),Ud=!0;var n=gn;try{e:{for(Cc(e),ei=Ni(Ki);ei!==null&&!(ei.expirationTime>e&&c_());){var i=ei.callback;if(typeof i=="function"){ei.callback=null,gn=ei.priorityLevel;var s=i(ei.expirationTime<=e);if(e=Re.unstable_now(),typeof s=="function"){ei.callback=s,Cc(e),t=!0;break e}ei===Ni(Ki)&&Rc(Ki),Cc(e)}else Rc(Ki);ei=Ni(Ki)}if(ei!==null)t=!0;else{var a=Ni(Rs);a!==null&&Od(Id,a.startTime-e),t=!1}}break t}finally{ei=null,gn=n,Ud=!1}t=void 0}}finally{t?rr():or=!1}}}var rr;typeof i_=="function"?rr=function(){i_(Rd)}:typeof MessageChannel<"u"?(Dd=new MessageChannel,s_=Dd.port2,Dd.port1.onmessage=Rd,rr=function(){s_.postMessage(null)}):rr=function(){a_(Rd,0)};var Dd,s_;function Od(e,t){wo=a_(function(){e(Re.unstable_now())},t)}Re.unstable_IdlePriority=5;Re.unstable_ImmediatePriority=1;Re.unstable_LowPriority=4;Re.unstable_NormalPriority=3;Re.unstable_Profiling=null;Re.unstable_UserBlockingPriority=2;Re.unstable_cancelCallback=function(e){e.callback=null};Re.unstable_forceFrameRate=function(e){0>e||125<e?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):o_=0<e?Math.floor(1e3/e):5};Re.unstable_getCurrentPriorityLevel=function(){return gn};Re.unstable_next=function(e){switch(gn){case 1:case 2:case 3:var t=3;break;default:t=gn}var n=gn;gn=t;try{return e()}finally{gn=n}};Re.unstable_requestPaint=function(){Ld=!0};Re.unstable_runWithPriority=function(e,t){switch(e){case 1:case 2:case 3:case 4:case 5:break;default:e=3}var n=gn;gn=e;try{return t()}finally{gn=n}};Re.unstable_scheduleCallback=function(e,t,n){var i=Re.unstable_now();switch(typeof n=="object"&&n!==null?(n=n.delay,n=typeof n=="number"&&0<n?i+n:i):n=i,e){case 1:var s=-1;break;case 2:s=250;break;case 5:s=1073741823;break;case 4:s=1e4;break;default:s=5e3}return s=n+s,e={id:i1++,callback:t,priorityLevel:e,startTime:n,expirationTime:s,sortIndex:-1},n>i?(e.sortIndex=n,Nd(Rs,e),Ni(Ki)===null&&e===Ni(Rs)&&(Ao?(r_(wo),wo=-1):Ao=!0,Od(Id,n-i))):(e.sortIndex=s,Nd(Ki,e),To||Ud||(To=!0,or||(or=!0,rr()))),e};Re.unstable_shouldYield=c_;Re.unstable_wrapCallback=function(e){var t=gn;return function(){var n=gn;gn=t;try{return e.apply(this,arguments)}finally{gn=n}}}});var f_=Di((A2,h_)=>{"use strict";h_.exports=u_()});var p_=Di(Mn=>{"use strict";var s1=Ac();function d_(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function Ds(){}var Sn={d:{f:Ds,r:function(){throw Error(d_(522))},D:Ds,C:Ds,L:Ds,m:Ds,X:Ds,S:Ds,M:Ds},p:0,findDOMNode:null},a1=Symbol.for("react.portal");function r1(e,t,n){var i=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:a1,key:i==null?null:""+i,children:e,containerInfo:t,implementation:n}}var Co=s1.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function Dc(e,t){if(e==="font")return"";if(typeof t=="string")return t==="use-credentials"?t:""}Mn.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=Sn;Mn.createPortal=function(e,t){var n=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!t||t.nodeType!==1&&t.nodeType!==9&&t.nodeType!==11)throw Error(d_(299));return r1(e,t,null,n)};Mn.flushSync=function(e){var t=Co.T,n=Sn.p;try{if(Co.T=null,Sn.p=2,e)return e()}finally{Co.T=t,Sn.p=n,Sn.d.f()}};Mn.preconnect=function(e,t){typeof e=="string"&&(t?(t=t.crossOrigin,t=typeof t=="string"?t==="use-credentials"?t:"":void 0):t=null,Sn.d.C(e,t))};Mn.prefetchDNS=function(e){typeof e=="string"&&Sn.d.D(e)};Mn.preinit=function(e,t){if(typeof e=="string"&&t&&typeof t.as=="string"){var n=t.as,i=Dc(n,t.crossOrigin),s=typeof t.integrity=="string"?t.integrity:void 0,a=typeof t.fetchPriority=="string"?t.fetchPriority:void 0;n==="style"?Sn.d.S(e,typeof t.precedence=="string"?t.precedence:void 0,{crossOrigin:i,integrity:s,fetchPriority:a}):n==="script"&&Sn.d.X(e,{crossOrigin:i,integrity:s,fetchPriority:a,nonce:typeof t.nonce=="string"?t.nonce:void 0})}};Mn.preinitModule=function(e,t){if(typeof e=="string")if(typeof t=="object"&&t!==null){if(t.as==null||t.as==="script"){var n=Dc(t.as,t.crossOrigin);Sn.d.M(e,{crossOrigin:n,integrity:typeof t.integrity=="string"?t.integrity:void 0,nonce:typeof t.nonce=="string"?t.nonce:void 0})}}else t==null&&Sn.d.M(e)};Mn.preload=function(e,t){if(typeof e=="string"&&typeof t=="object"&&t!==null&&typeof t.as=="string"){var n=t.as,i=Dc(n,t.crossOrigin);Sn.d.L(e,n,{crossOrigin:i,integrity:typeof t.integrity=="string"?t.integrity:void 0,nonce:typeof t.nonce=="string"?t.nonce:void 0,type:typeof t.type=="string"?t.type:void 0,fetchPriority:typeof t.fetchPriority=="string"?t.fetchPriority:void 0,referrerPolicy:typeof t.referrerPolicy=="string"?t.referrerPolicy:void 0,imageSrcSet:typeof t.imageSrcSet=="string"?t.imageSrcSet:void 0,imageSizes:typeof t.imageSizes=="string"?t.imageSizes:void 0,media:typeof t.media=="string"?t.media:void 0})}};Mn.preloadModule=function(e,t){if(typeof e=="string")if(t){var n=Dc(t.as,t.crossOrigin);Sn.d.m(e,{as:typeof t.as=="string"&&t.as!=="script"?t.as:void 0,crossOrigin:n,integrity:typeof t.integrity=="string"?t.integrity:void 0})}else Sn.d.m(e)};Mn.requestFormReset=function(e){Sn.d.r(e)};Mn.unstable_batchedUpdates=function(e,t){return e(t)};Mn.useFormState=function(e,t,n){return Co.H.useFormState(e,t,n)};Mn.useFormStatus=function(){return Co.H.useHostTransitionStatus()};Mn.version="19.2.8"});var __=Di((C2,g_)=>{"use strict";function m_(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(m_)}catch(e){console.error(e)}}m_(),g_.exports=p_()});var Rb=Di(eh=>{"use strict";var je=f_(),kv=Ac(),o1=__();function et(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function Xv(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function pl(e){var t=e,n=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(n=t.return),e=t.return;while(e)}return t.tag===3?n:null}function Wv(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function qv(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function v_(e){if(pl(e)!==e)throw Error(et(188))}function l1(e){var t=e.alternate;if(!t){if(t=pl(e),t===null)throw Error(et(188));return t!==e?null:e}for(var n=e,i=t;;){var s=n.return;if(s===null)break;var a=s.alternate;if(a===null){if(i=s.return,i!==null){n=i;continue}break}if(s.child===a.child){for(a=s.child;a;){if(a===n)return v_(s),e;if(a===i)return v_(s),t;a=a.sibling}throw Error(et(188))}if(n.return!==i.return)n=s,i=a;else{for(var r=!1,o=s.child;o;){if(o===n){r=!0,n=s,i=a;break}if(o===i){r=!0,i=s,n=a;break}o=o.sibling}if(!r){for(o=a.child;o;){if(o===n){r=!0,n=a,i=s;break}if(o===i){r=!0,i=a,n=s;break}o=o.sibling}if(!r)throw Error(et(189))}}if(n.alternate!==i)throw Error(et(190))}if(n.tag!==3)throw Error(et(188));return n.stateNode.current===n?e:t}function Yv(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=Yv(e),t!==null)return t;e=e.sibling}return null}var Te=Object.assign,c1=Symbol.for("react.element"),Nc=Symbol.for("react.transitional.element"),Po=Symbol.for("react.portal"),dr=Symbol.for("react.fragment"),Zv=Symbol.for("react.strict_mode"),mp=Symbol.for("react.profiler"),Jv=Symbol.for("react.consumer"),ss=Symbol.for("react.context"),um=Symbol.for("react.forward_ref"),gp=Symbol.for("react.suspense"),_p=Symbol.for("react.suspense_list"),hm=Symbol.for("react.memo"),Ns=Symbol.for("react.lazy");Symbol.for("react.scope");var vp=Symbol.for("react.activity");Symbol.for("react.legacy_hidden");Symbol.for("react.tracing_marker");var u1=Symbol.for("react.memo_cache_sentinel");Symbol.for("react.view_transition");var y_=Symbol.iterator;function Ro(e){return e===null||typeof e!="object"?null:(e=y_&&e[y_]||e["@@iterator"],typeof e=="function"?e:null)}var h1=Symbol.for("react.client.reference");function yp(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===h1?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case dr:return"Fragment";case mp:return"Profiler";case Zv:return"StrictMode";case gp:return"Suspense";case _p:return"SuspenseList";case vp:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case Po:return"Portal";case ss:return e.displayName||"Context";case Jv:return(e._context.displayName||"Context")+".Consumer";case um:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case hm:return t=e.displayName||null,t!==null?t:yp(e.type)||"Memo";case Ns:t=e._payload,e=e._init;try{return yp(e(t))}catch{}}return null}var zo=Array.isArray,Pt=kv.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,ae=o1.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,Ra={pending:!1,data:null,method:null,action:null},xp=[],pr=-1;function Pi(e){return{current:e}}function sn(e){0>pr||(e.current=xp[pr],xp[pr]=null,pr--)}function ye(e,t){pr++,xp[pr]=e.current,e.current=t}var Oi=Pi(null),tl=Pi(null),Gs=Pi(null),uu=Pi(null);function hu(e,t){switch(ye(Gs,t),ye(tl,e),ye(Oi,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?Av(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=Av(t),e=mb(t,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}sn(Oi),ye(Oi,e)}function Ur(){sn(Oi),sn(tl),sn(Gs)}function bp(e){e.memoizedState!==null&&ye(uu,e);var t=Oi.current,n=mb(t,e.type);t!==n&&(ye(tl,e),ye(Oi,n))}function fu(e){tl.current===e&&(sn(Oi),sn(tl)),uu.current===e&&(sn(uu),hl._currentValue=Ra)}var Pd,x_;function Ta(e){if(Pd===void 0)try{throw Error()}catch(n){var t=n.stack.trim().match(/\n( *(at )?)/);Pd=t&&t[1]||"",x_=-1<n.stack.indexOf(`
    at`)?" (<anonymous>)":-1<n.stack.indexOf("@")?"@unknown:0:0":""}return`
`+Pd+e+x_}var zd=!1;function Bd(e,t){if(!e||zd)return"";zd=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var i={DetermineComponentFrameRoot:function(){try{if(t){var p=function(){throw Error()};if(Object.defineProperty(p.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(p,[])}catch(d){var u=d}Reflect.construct(e,[],p)}else{try{p.call()}catch(d){u=d}e.call(p.prototype)}}else{try{throw Error()}catch(d){u=d}(p=e())&&typeof p.catch=="function"&&p.catch(function(){})}}catch(d){if(d&&u&&typeof d.stack=="string")return[d.stack,u.stack]}return[null,null]}};i.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var s=Object.getOwnPropertyDescriptor(i.DetermineComponentFrameRoot,"name");s&&s.configurable&&Object.defineProperty(i.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var a=i.DetermineComponentFrameRoot(),r=a[0],o=a[1];if(r&&o){var l=r.split(`
`),c=o.split(`
`);for(s=i=0;i<l.length&&!l[i].includes("DetermineComponentFrameRoot");)i++;for(;s<c.length&&!c[s].includes("DetermineComponentFrameRoot");)s++;if(i===l.length||s===c.length)for(i=l.length-1,s=c.length-1;1<=i&&0<=s&&l[i]!==c[s];)s--;for(;1<=i&&0<=s;i--,s--)if(l[i]!==c[s]){if(i!==1||s!==1)do if(i--,s--,0>s||l[i]!==c[s]){var h=`
`+l[i].replace(" at new "," at ");return e.displayName&&h.includes("<anonymous>")&&(h=h.replace("<anonymous>",e.displayName)),h}while(1<=i&&0<=s);break}}}finally{zd=!1,Error.prepareStackTrace=n}return(n=e?e.displayName||e.name:"")?Ta(n):""}function f1(e,t){switch(e.tag){case 26:case 27:case 5:return Ta(e.type);case 16:return Ta("Lazy");case 13:return e.child!==t&&t!==null?Ta("Suspense Fallback"):Ta("Suspense");case 19:return Ta("SuspenseList");case 0:case 15:return Bd(e.type,!1);case 11:return Bd(e.type.render,!1);case 1:return Bd(e.type,!0);case 31:return Ta("Activity");default:return""}}function b_(e){try{var t="",n=null;do t+=f1(e,n),n=e,e=e.return;while(e);return t}catch(i){return`
Error generating stack: `+i.message+`
`+i.stack}}var Sp=Object.prototype.hasOwnProperty,fm=je.unstable_scheduleCallback,Fd=je.unstable_cancelCallback,d1=je.unstable_shouldYield,p1=je.unstable_requestPaint,Vn=je.unstable_now,m1=je.unstable_getCurrentPriorityLevel,Kv=je.unstable_ImmediatePriority,jv=je.unstable_UserBlockingPriority,du=je.unstable_NormalPriority,g1=je.unstable_LowPriority,Qv=je.unstable_IdlePriority,_1=je.log,v1=je.unstable_setDisableYieldValue,ml=null,Hn=null;function zs(e){if(typeof _1=="function"&&v1(e),Hn&&typeof Hn.setStrictMode=="function")try{Hn.setStrictMode(ml,e)}catch{}}var Gn=Math.clz32?Math.clz32:b1,y1=Math.log,x1=Math.LN2;function b1(e){return e>>>=0,e===0?32:31-(y1(e)/x1|0)|0}var Uc=256,Lc=262144,Ic=4194304;function Aa(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function Fu(e,t,n){var i=e.pendingLanes;if(i===0)return 0;var s=0,a=e.suspendedLanes,r=e.pingedLanes;e=e.warmLanes;var o=i&134217727;return o!==0?(i=o&~a,i!==0?s=Aa(i):(r&=o,r!==0?s=Aa(r):n||(n=o&~e,n!==0&&(s=Aa(n))))):(o=i&~a,o!==0?s=Aa(o):r!==0?s=Aa(r):n||(n=i&~e,n!==0&&(s=Aa(n)))),s===0?0:t!==0&&t!==s&&(t&a)===0&&(a=s&-s,n=t&-t,a>=n||a===32&&(n&4194048)!==0)?t:s}function gl(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function S1(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function $v(){var e=Ic;return Ic<<=1,(Ic&62914560)===0&&(Ic=4194304),e}function Vd(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function _l(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function M1(e,t,n,i,s,a){var r=e.pendingLanes;e.pendingLanes=n,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=n,e.entangledLanes&=n,e.errorRecoveryDisabledLanes&=n,e.shellSuspendCounter=0;var o=e.entanglements,l=e.expirationTimes,c=e.hiddenUpdates;for(n=r&~n;0<n;){var h=31-Gn(n),p=1<<h;o[h]=0,l[h]=-1;var u=c[h];if(u!==null)for(c[h]=null,h=0;h<u.length;h++){var d=u[h];d!==null&&(d.lane&=-536870913)}n&=~p}i!==0&&ty(e,i,0),a!==0&&s===0&&e.tag!==0&&(e.suspendedLanes|=a&~(r&~t))}function ty(e,t,n){e.pendingLanes|=t,e.suspendedLanes&=~t;var i=31-Gn(t);e.entangledLanes|=t,e.entanglements[i]=e.entanglements[i]|1073741824|n&261930}function ey(e,t){var n=e.entangledLanes|=t;for(e=e.entanglements;n;){var i=31-Gn(n),s=1<<i;s&t|e[i]&t&&(e[i]|=t),n&=~s}}function ny(e,t){var n=t&-t;return n=(n&42)!==0?1:dm(n),(n&(e.suspendedLanes|t))!==0?0:n}function dm(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function pm(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function iy(){var e=ae.p;return e!==0?e:(e=window.event,e===void 0?32:Ab(e.type))}function S_(e,t){var n=ae.p;try{return ae.p=e,t()}finally{ae.p=n}}var ea=Math.random().toString(36).slice(2),cn="__reactFiber$"+ea,Un="__reactProps$"+ea,kr="__reactContainer$"+ea,Mp="__reactEvents$"+ea,E1="__reactListeners$"+ea,T1="__reactHandles$"+ea,M_="__reactResources$"+ea,vl="__reactMarker$"+ea;function mm(e){delete e[cn],delete e[Un],delete e[Mp],delete e[E1],delete e[T1]}function mr(e){var t=e[cn];if(t)return t;for(var n=e.parentNode;n;){if(t=n[kr]||n[cn]){if(n=t.alternate,t.child!==null||n!==null&&n.child!==null)for(e=Nv(e);e!==null;){if(n=e[cn])return n;e=Nv(e)}return t}e=n,n=e.parentNode}return null}function Xr(e){if(e=e[cn]||e[kr]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function Bo(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(et(33))}function Tr(e){var t=e[M_];return t||(t=e[M_]={hoistableStyles:new Map,hoistableScripts:new Map}),t}function nn(e){e[vl]=!0}var sy=new Set,ay={};function Fa(e,t){Lr(e,t),Lr(e+"Capture",t)}function Lr(e,t){for(ay[e]=t,e=0;e<t.length;e++)sy.add(t[e])}var A1=RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"),E_={},T_={};function w1(e){return Sp.call(T_,e)?!0:Sp.call(E_,e)?!1:A1.test(e)?T_[e]=!0:(E_[e]=!0,!1)}function Jc(e,t,n){if(w1(t))if(n===null)e.removeAttribute(t);else{switch(typeof n){case"undefined":case"function":case"symbol":e.removeAttribute(t);return;case"boolean":var i=t.toLowerCase().slice(0,5);if(i!=="data-"&&i!=="aria-"){e.removeAttribute(t);return}}e.setAttribute(t,""+n)}}function Oc(e,t,n){if(n===null)e.removeAttribute(t);else{switch(typeof n){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(t);return}e.setAttribute(t,""+n)}}function ji(e,t,n,i){if(i===null)e.removeAttribute(n);else{switch(typeof i){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(n);return}e.setAttributeNS(t,n,""+i)}}function ii(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function ry(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function C1(e,t,n){var i=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&typeof i<"u"&&typeof i.get=="function"&&typeof i.set=="function"){var s=i.get,a=i.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return s.call(this)},set:function(r){n=""+r,a.call(this,r)}}),Object.defineProperty(e,t,{enumerable:i.enumerable}),{getValue:function(){return n},setValue:function(r){n=""+r},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function Ep(e){if(!e._valueTracker){var t=ry(e)?"checked":"value";e._valueTracker=C1(e,t,""+e[t])}}function oy(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),i="";return e&&(i=ry(e)?e.checked?"true":"false":e.value),e=i,e!==n?(t.setValue(e),!0):!1}function pu(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var R1=/[\n"\\]/g;function ri(e){return e.replace(R1,function(t){return"\\"+t.charCodeAt(0).toString(16)+" "})}function Tp(e,t,n,i,s,a,r,o){e.name="",r!=null&&typeof r!="function"&&typeof r!="symbol"&&typeof r!="boolean"?e.type=r:e.removeAttribute("type"),t!=null?r==="number"?(t===0&&e.value===""||e.value!=t)&&(e.value=""+ii(t)):e.value!==""+ii(t)&&(e.value=""+ii(t)):r!=="submit"&&r!=="reset"||e.removeAttribute("value"),t!=null?Ap(e,r,ii(t)):n!=null?Ap(e,r,ii(n)):i!=null&&e.removeAttribute("value"),s==null&&a!=null&&(e.defaultChecked=!!a),s!=null&&(e.checked=s&&typeof s!="function"&&typeof s!="symbol"),o!=null&&typeof o!="function"&&typeof o!="symbol"&&typeof o!="boolean"?e.name=""+ii(o):e.removeAttribute("name")}function ly(e,t,n,i,s,a,r,o){if(a!=null&&typeof a!="function"&&typeof a!="symbol"&&typeof a!="boolean"&&(e.type=a),t!=null||n!=null){if(!(a!=="submit"&&a!=="reset"||t!=null)){Ep(e);return}n=n!=null?""+ii(n):"",t=t!=null?""+ii(t):n,o||t===e.value||(e.value=t),e.defaultValue=t}i=i??s,i=typeof i!="function"&&typeof i!="symbol"&&!!i,e.checked=o?e.checked:!!i,e.defaultChecked=!!i,r!=null&&typeof r!="function"&&typeof r!="symbol"&&typeof r!="boolean"&&(e.name=r),Ep(e)}function Ap(e,t,n){t==="number"&&pu(e.ownerDocument)===e||e.defaultValue===""+n||(e.defaultValue=""+n)}function Ar(e,t,n,i){if(e=e.options,t){t={};for(var s=0;s<n.length;s++)t["$"+n[s]]=!0;for(n=0;n<e.length;n++)s=t.hasOwnProperty("$"+e[n].value),e[n].selected!==s&&(e[n].selected=s),s&&i&&(e[n].defaultSelected=!0)}else{for(n=""+ii(n),t=null,s=0;s<e.length;s++){if(e[s].value===n){e[s].selected=!0,i&&(e[s].defaultSelected=!0);return}t!==null||e[s].disabled||(t=e[s])}t!==null&&(t.selected=!0)}}function cy(e,t,n){if(t!=null&&(t=""+ii(t),t!==e.value&&(e.value=t),n==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=n!=null?""+ii(n):""}function uy(e,t,n,i){if(t==null){if(i!=null){if(n!=null)throw Error(et(92));if(zo(i)){if(1<i.length)throw Error(et(93));i=i[0]}n=i}n==null&&(n=""),t=n}n=ii(t),e.defaultValue=n,i=e.textContent,i===n&&i!==""&&i!==null&&(e.value=i),Ep(e)}function Ir(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&n.nodeType===3){n.nodeValue=t;return}}e.textContent=t}var D1=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function A_(e,t,n){var i=t.indexOf("--")===0;n==null||typeof n=="boolean"||n===""?i?e.setProperty(t,""):t==="float"?e.cssFloat="":e[t]="":i?e.setProperty(t,n):typeof n!="number"||n===0||D1.has(t)?t==="float"?e.cssFloat=n:e[t]=(""+n).trim():e[t]=n+"px"}function hy(e,t,n){if(t!=null&&typeof t!="object")throw Error(et(62));if(e=e.style,n!=null){for(var i in n)!n.hasOwnProperty(i)||t!=null&&t.hasOwnProperty(i)||(i.indexOf("--")===0?e.setProperty(i,""):i==="float"?e.cssFloat="":e[i]="");for(var s in t)i=t[s],t.hasOwnProperty(s)&&n[s]!==i&&A_(e,s,i)}else for(var a in t)t.hasOwnProperty(a)&&A_(e,a,t[a])}function gm(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var N1=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),U1=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function Kc(e){return U1.test(""+e)?"javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')":e}function as(){}var wp=null;function _m(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var gr=null,wr=null;function w_(e){var t=Xr(e);if(t&&(e=t.stateNode)){var n=e[Un]||null;t:switch(e=t.stateNode,t.type){case"input":if(Tp(e,n.value,n.defaultValue,n.defaultValue,n.checked,n.defaultChecked,n.type,n.name),t=n.name,n.type==="radio"&&t!=null){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll('input[name="'+ri(""+t)+'"][type="radio"]'),t=0;t<n.length;t++){var i=n[t];if(i!==e&&i.form===e.form){var s=i[Un]||null;if(!s)throw Error(et(90));Tp(i,s.value,s.defaultValue,s.defaultValue,s.checked,s.defaultChecked,s.type,s.name)}}for(t=0;t<n.length;t++)i=n[t],i.form===e.form&&oy(i)}break t;case"textarea":cy(e,n.value,n.defaultValue);break t;case"select":t=n.value,t!=null&&Ar(e,!!n.multiple,t,!1)}}}var Hd=!1;function fy(e,t,n){if(Hd)return e(t,n);Hd=!0;try{var i=e(t);return i}finally{if(Hd=!1,(gr!==null||wr!==null)&&(ju(),gr&&(t=gr,e=wr,wr=gr=null,w_(t),e)))for(t=0;t<e.length;t++)w_(e[t])}}function el(e,t){var n=e.stateNode;if(n===null)return null;var i=n[Un]||null;if(i===null)return null;n=i[t];t:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(e=e.type,i=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!i;break t;default:e=!1}if(e)return null;if(n&&typeof n!="function")throw Error(et(231,t,typeof n));return n}var us=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Cp=!1;if(us)try{lr={},Object.defineProperty(lr,"passive",{get:function(){Cp=!0}}),window.addEventListener("test",lr,lr),window.removeEventListener("test",lr,lr)}catch{Cp=!1}var lr,Bs=null,vm=null,jc=null;function dy(){if(jc)return jc;var e,t=vm,n=t.length,i,s="value"in Bs?Bs.value:Bs.textContent,a=s.length;for(e=0;e<n&&t[e]===s[e];e++);var r=n-e;for(i=1;i<=r&&t[n-i]===s[a-i];i++);return jc=s.slice(e,1<i?1-i:void 0)}function Qc(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Pc(){return!0}function C_(){return!1}function Ln(e){function t(n,i,s,a,r){this._reactName=n,this._targetInst=s,this.type=i,this.nativeEvent=a,this.target=r,this.currentTarget=null;for(var o in e)e.hasOwnProperty(o)&&(n=e[o],this[o]=n?n(a):a[o]);return this.isDefaultPrevented=(a.defaultPrevented!=null?a.defaultPrevented:a.returnValue===!1)?Pc:C_,this.isPropagationStopped=C_,this}return Te(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var n=this.nativeEvent;n&&(n.preventDefault?n.preventDefault():typeof n.returnValue!="unknown"&&(n.returnValue=!1),this.isDefaultPrevented=Pc)},stopPropagation:function(){var n=this.nativeEvent;n&&(n.stopPropagation?n.stopPropagation():typeof n.cancelBubble!="unknown"&&(n.cancelBubble=!0),this.isPropagationStopped=Pc)},persist:function(){},isPersistent:Pc}),t}var Va={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},Vu=Ln(Va),yl=Te({},Va,{view:0,detail:0}),L1=Ln(yl),Gd,kd,Do,Hu=Te({},yl,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:ym,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==Do&&(Do&&e.type==="mousemove"?(Gd=e.screenX-Do.screenX,kd=e.screenY-Do.screenY):kd=Gd=0,Do=e),Gd)},movementY:function(e){return"movementY"in e?e.movementY:kd}}),R_=Ln(Hu),I1=Te({},Hu,{dataTransfer:0}),O1=Ln(I1),P1=Te({},yl,{relatedTarget:0}),Xd=Ln(P1),z1=Te({},Va,{animationName:0,elapsedTime:0,pseudoElement:0}),B1=Ln(z1),F1=Te({},Va,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),V1=Ln(F1),H1=Te({},Va,{data:0}),D_=Ln(H1),G1={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},k1={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},X1={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function W1(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=X1[e])?!!t[e]:!1}function ym(){return W1}var q1=Te({},yl,{key:function(e){if(e.key){var t=G1[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=Qc(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?k1[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:ym,charCode:function(e){return e.type==="keypress"?Qc(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?Qc(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),Y1=Ln(q1),Z1=Te({},Hu,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),N_=Ln(Z1),J1=Te({},yl,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:ym}),K1=Ln(J1),j1=Te({},Va,{propertyName:0,elapsedTime:0,pseudoElement:0}),Q1=Ln(j1),$1=Te({},Hu,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),tE=Ln($1),eE=Te({},Va,{newState:0,oldState:0}),nE=Ln(eE),iE=[9,13,27,32],xm=us&&"CompositionEvent"in window,Ho=null;us&&"documentMode"in document&&(Ho=document.documentMode);var sE=us&&"TextEvent"in window&&!Ho,py=us&&(!xm||Ho&&8<Ho&&11>=Ho),U_=" ",L_=!1;function my(e,t){switch(e){case"keyup":return iE.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function gy(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var _r=!1;function aE(e,t){switch(e){case"compositionend":return gy(t);case"keypress":return t.which!==32?null:(L_=!0,U_);case"textInput":return e=t.data,e===U_&&L_?null:e;default:return null}}function rE(e,t){if(_r)return e==="compositionend"||!xm&&my(e,t)?(e=dy(),jc=vm=Bs=null,_r=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return py&&t.locale!=="ko"?null:t.data;default:return null}}var oE={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function I_(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!oE[e.type]:t==="textarea"}function _y(e,t,n,i){gr?wr?wr.push(i):wr=[i]:gr=i,t=Uu(t,"onChange"),0<t.length&&(n=new Vu("onChange","change",null,n,i),e.push({event:n,listeners:t}))}var Go=null,nl=null;function lE(e){fb(e,0)}function Gu(e){var t=Bo(e);if(oy(t))return e}function O_(e,t){if(e==="change")return t}var vy=!1;us&&(us?(Bc="oninput"in document,Bc||(Wd=document.createElement("div"),Wd.setAttribute("oninput","return;"),Bc=typeof Wd.oninput=="function"),zc=Bc):zc=!1,vy=zc&&(!document.documentMode||9<document.documentMode));var zc,Bc,Wd;function P_(){Go&&(Go.detachEvent("onpropertychange",yy),nl=Go=null)}function yy(e){if(e.propertyName==="value"&&Gu(nl)){var t=[];_y(t,nl,e,_m(e)),fy(lE,t)}}function cE(e,t,n){e==="focusin"?(P_(),Go=t,nl=n,Go.attachEvent("onpropertychange",yy)):e==="focusout"&&P_()}function uE(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return Gu(nl)}function hE(e,t){if(e==="click")return Gu(t)}function fE(e,t){if(e==="input"||e==="change")return Gu(t)}function dE(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Xn=typeof Object.is=="function"?Object.is:dE;function il(e,t){if(Xn(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var n=Object.keys(e),i=Object.keys(t);if(n.length!==i.length)return!1;for(i=0;i<n.length;i++){var s=n[i];if(!Sp.call(t,s)||!Xn(e[s],t[s]))return!1}return!0}function z_(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function B_(e,t){var n=z_(e);e=0;for(var i;n;){if(n.nodeType===3){if(i=e+n.textContent.length,e<=t&&i>=t)return{node:n,offset:t-e};e=i}t:{for(;n;){if(n.nextSibling){n=n.nextSibling;break t}n=n.parentNode}n=void 0}n=z_(n)}}function xy(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?xy(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function by(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=pu(e.document);t instanceof e.HTMLIFrameElement;){try{var n=typeof t.contentWindow.location.href=="string"}catch{n=!1}if(n)e=t.contentWindow;else break;t=pu(e.document)}return t}function bm(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}var pE=us&&"documentMode"in document&&11>=document.documentMode,vr=null,Rp=null,ko=null,Dp=!1;function F_(e,t,n){var i=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;Dp||vr==null||vr!==pu(i)||(i=vr,"selectionStart"in i&&bm(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),ko&&il(ko,i)||(ko=i,i=Uu(Rp,"onSelect"),0<i.length&&(t=new Vu("onSelect","select",null,t,n),e.push({event:t,listeners:i}),t.target=vr)))}function Ea(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n["Webkit"+e]="webkit"+t,n["Moz"+e]="moz"+t,n}var yr={animationend:Ea("Animation","AnimationEnd"),animationiteration:Ea("Animation","AnimationIteration"),animationstart:Ea("Animation","AnimationStart"),transitionrun:Ea("Transition","TransitionRun"),transitionstart:Ea("Transition","TransitionStart"),transitioncancel:Ea("Transition","TransitionCancel"),transitionend:Ea("Transition","TransitionEnd")},qd={},Sy={};us&&(Sy=document.createElement("div").style,"AnimationEvent"in window||(delete yr.animationend.animation,delete yr.animationiteration.animation,delete yr.animationstart.animation),"TransitionEvent"in window||delete yr.transitionend.transition);function Ha(e){if(qd[e])return qd[e];if(!yr[e])return e;var t=yr[e],n;for(n in t)if(t.hasOwnProperty(n)&&n in Sy)return qd[e]=t[n];return e}var My=Ha("animationend"),Ey=Ha("animationiteration"),Ty=Ha("animationstart"),mE=Ha("transitionrun"),gE=Ha("transitionstart"),_E=Ha("transitioncancel"),Ay=Ha("transitionend"),wy=new Map,Np="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");Np.push("scrollEnd");function vi(e,t){wy.set(e,t),Fa(t,[e])}var mu=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},ni=[],xr=0,Sm=0;function ku(){for(var e=xr,t=Sm=xr=0;t<e;){var n=ni[t];ni[t++]=null;var i=ni[t];ni[t++]=null;var s=ni[t];ni[t++]=null;var a=ni[t];if(ni[t++]=null,i!==null&&s!==null){var r=i.pending;r===null?s.next=s:(s.next=r.next,r.next=s),i.pending=s}a!==0&&Cy(n,s,a)}}function Xu(e,t,n,i){ni[xr++]=e,ni[xr++]=t,ni[xr++]=n,ni[xr++]=i,Sm|=i,e.lanes|=i,e=e.alternate,e!==null&&(e.lanes|=i)}function Mm(e,t,n,i){return Xu(e,t,n,i),gu(e)}function Ga(e,t){return Xu(e,null,null,t),gu(e)}function Cy(e,t,n){e.lanes|=n;var i=e.alternate;i!==null&&(i.lanes|=n);for(var s=!1,a=e.return;a!==null;)a.childLanes|=n,i=a.alternate,i!==null&&(i.childLanes|=n),a.tag===22&&(e=a.stateNode,e===null||e._visibility&1||(s=!0)),e=a,a=a.return;return e.tag===3?(a=e.stateNode,s&&t!==null&&(s=31-Gn(n),e=a.hiddenUpdates,i=e[s],i===null?e[s]=[t]:i.push(t),t.lane=n|536870912),a):null}function gu(e){if(50<Qo)throw Qo=0,Qp=null,Error(et(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var br={};function vE(e,t,n,i){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Bn(e,t,n,i){return new vE(e,t,n,i)}function Em(e){return e=e.prototype,!(!e||!e.isReactComponent)}function os(e,t){var n=e.alternate;return n===null?(n=Bn(e.tag,t,e.key,e.mode),n.elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=e.flags&65011712,n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n.refCleanup=e.refCleanup,n}function Ry(e,t){e.flags&=65011714;var n=e.alternate;return n===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=n.childLanes,e.lanes=n.lanes,e.child=n.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=n.memoizedProps,e.memoizedState=n.memoizedState,e.updateQueue=n.updateQueue,e.type=n.type,t=n.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function $c(e,t,n,i,s,a){var r=0;if(i=e,typeof e=="function")Em(e)&&(r=1);else if(typeof e=="string")r=bT(e,n,Oi.current)?26:e==="html"||e==="head"||e==="body"?27:5;else t:switch(e){case vp:return e=Bn(31,n,t,s),e.elementType=vp,e.lanes=a,e;case dr:return Da(n.children,s,a,t);case Zv:r=8,s|=24;break;case mp:return e=Bn(12,n,t,s|2),e.elementType=mp,e.lanes=a,e;case gp:return e=Bn(13,n,t,s),e.elementType=gp,e.lanes=a,e;case _p:return e=Bn(19,n,t,s),e.elementType=_p,e.lanes=a,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case ss:r=10;break t;case Jv:r=9;break t;case um:r=11;break t;case hm:r=14;break t;case Ns:r=16,i=null;break t}r=29,n=Error(et(130,e===null?"null":typeof e,"")),i=null}return t=Bn(r,n,t,s),t.elementType=e,t.type=i,t.lanes=a,t}function Da(e,t,n,i){return e=Bn(7,e,i,t),e.lanes=n,e}function Yd(e,t,n){return e=Bn(6,e,null,t),e.lanes=n,e}function Dy(e){var t=Bn(18,null,null,0);return t.stateNode=e,t}function Zd(e,t,n){return t=Bn(4,e.children!==null?e.children:[],e.key,t),t.lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var V_=new WeakMap;function oi(e,t){if(typeof e=="object"&&e!==null){var n=V_.get(e);return n!==void 0?n:(t={value:e,source:t,stack:b_(t)},V_.set(e,t),t)}return{value:e,source:t,stack:b_(t)}}var Sr=[],Mr=0,_u=null,sl=0,si=[],ai=0,js=null,Ui=1,Li="";function ns(e,t){Sr[Mr++]=sl,Sr[Mr++]=_u,_u=e,sl=t}function Ny(e,t,n){si[ai++]=Ui,si[ai++]=Li,si[ai++]=js,js=e;var i=Ui;e=Li;var s=32-Gn(i)-1;i&=~(1<<s),n+=1;var a=32-Gn(t)+s;if(30<a){var r=s-s%5;a=(i&(1<<r)-1).toString(32),i>>=r,s-=r,Ui=1<<32-Gn(t)+s|n<<s|i,Li=a+e}else Ui=1<<a|n<<s|i,Li=e}function Tm(e){e.return!==null&&(ns(e,1),Ny(e,1,0))}function Am(e){for(;e===_u;)_u=Sr[--Mr],Sr[Mr]=null,sl=Sr[--Mr],Sr[Mr]=null;for(;e===js;)js=si[--ai],si[ai]=null,Li=si[--ai],si[ai]=null,Ui=si[--ai],si[ai]=null}function Uy(e,t){si[ai++]=Ui,si[ai++]=Li,si[ai++]=js,Ui=t.id,Li=t.overflow,js=e}var un=null,Ee=null,ee=!1,ks=null,li=!1,Up=Error(et(519));function Qs(e){var t=Error(et(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw al(oi(t,e)),Up}function H_(e){var t=e.stateNode,n=e.type,i=e.memoizedProps;switch(t[cn]=e,t[Un]=i,n){case"dialog":qt("cancel",t),qt("close",t);break;case"iframe":case"object":case"embed":qt("load",t);break;case"video":case"audio":for(n=0;n<cl.length;n++)qt(cl[n],t);break;case"source":qt("error",t);break;case"img":case"image":case"link":qt("error",t),qt("load",t);break;case"details":qt("toggle",t);break;case"input":qt("invalid",t),ly(t,i.value,i.defaultValue,i.checked,i.defaultChecked,i.type,i.name,!0);break;case"select":qt("invalid",t);break;case"textarea":qt("invalid",t),uy(t,i.value,i.defaultValue,i.children)}n=i.children,typeof n!="string"&&typeof n!="number"&&typeof n!="bigint"||t.textContent===""+n||i.suppressHydrationWarning===!0||pb(t.textContent,n)?(i.popover!=null&&(qt("beforetoggle",t),qt("toggle",t)),i.onScroll!=null&&qt("scroll",t),i.onScrollEnd!=null&&qt("scrollend",t),i.onClick!=null&&(t.onclick=as),t=!0):t=!1,t||Qs(e,!0)}function G_(e){for(un=e.return;un;)switch(un.tag){case 5:case 31:case 13:li=!1;return;case 27:case 3:li=!0;return;default:un=un.return}}function cr(e){if(e!==un)return!1;if(!ee)return G_(e),ee=!0,!1;var t=e.tag,n;if((n=t!==3&&t!==27)&&((n=t===5)&&(n=e.type,n=!(n!=="form"&&n!=="button")||im(e.type,e.memoizedProps)),n=!n),n&&Ee&&Qs(e),G_(e),t===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(et(317));Ee=Dv(e)}else if(t===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(et(317));Ee=Dv(e)}else t===27?(t=Ee,na(e.type)?(e=om,om=null,Ee=e):Ee=t):Ee=un?ui(e.stateNode.nextSibling):null;return!0}function Ia(){Ee=un=null,ee=!1}function Jd(){var e=ks;return e!==null&&(Dn===null?Dn=e:Dn.push.apply(Dn,e),ks=null),e}function al(e){ks===null?ks=[e]:ks.push(e)}var Lp=Pi(null),ka=null,rs=null;function Ls(e,t,n){ye(Lp,t._currentValue),t._currentValue=n}function ls(e){e._currentValue=Lp.current,sn(Lp)}function Ip(e,t,n){for(;e!==null;){var i=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,i!==null&&(i.childLanes|=t)):i!==null&&(i.childLanes&t)!==t&&(i.childLanes|=t),e===n)break;e=e.return}}function Op(e,t,n,i){var s=e.child;for(s!==null&&(s.return=e);s!==null;){var a=s.dependencies;if(a!==null){var r=s.child;a=a.firstContext;t:for(;a!==null;){var o=a;a=s;for(var l=0;l<t.length;l++)if(o.context===t[l]){a.lanes|=n,o=a.alternate,o!==null&&(o.lanes|=n),Ip(a.return,n,e),i||(r=null);break t}a=o.next}}else if(s.tag===18){if(r=s.return,r===null)throw Error(et(341));r.lanes|=n,a=r.alternate,a!==null&&(a.lanes|=n),Ip(r,n,e),r=null}else r=s.child;if(r!==null)r.return=s;else for(r=s;r!==null;){if(r===e){r=null;break}if(s=r.sibling,s!==null){s.return=r.return,r=s;break}r=r.return}s=r}}function Wr(e,t,n,i){e=null;for(var s=t,a=!1;s!==null;){if(!a){if((s.flags&524288)!==0)a=!0;else if((s.flags&262144)!==0)break}if(s.tag===10){var r=s.alternate;if(r===null)throw Error(et(387));if(r=r.memoizedProps,r!==null){var o=s.type;Xn(s.pendingProps.value,r.value)||(e!==null?e.push(o):e=[o])}}else if(s===uu.current){if(r=s.alternate,r===null)throw Error(et(387));r.memoizedState.memoizedState!==s.memoizedState.memoizedState&&(e!==null?e.push(hl):e=[hl])}s=s.return}e!==null&&Op(t,e,n,i),t.flags|=262144}function vu(e){for(e=e.firstContext;e!==null;){if(!Xn(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function Oa(e){ka=e,rs=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function hn(e){return Ly(ka,e)}function Fc(e,t){return ka===null&&Oa(e),Ly(e,t)}function Ly(e,t){var n=t._currentValue;if(t={context:t,memoizedValue:n,next:null},rs===null){if(e===null)throw Error(et(308));rs=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else rs=rs.next=t;return n}var yE=typeof AbortController<"u"?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(n,i){e.push(i)}};this.abort=function(){t.aborted=!0,e.forEach(function(n){return n()})}},xE=je.unstable_scheduleCallback,bE=je.unstable_NormalPriority,Ye={$$typeof:ss,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function wm(){return{controller:new yE,data:new Map,refCount:0}}function xl(e){e.refCount--,e.refCount===0&&xE(bE,function(){e.controller.abort()})}var Xo=null,Pp=0,Or=0,Cr=null;function SE(e,t){if(Xo===null){var n=Xo=[];Pp=0,Or=Qm(),Cr={status:"pending",value:void 0,then:function(i){n.push(i)}}}return Pp++,t.then(k_,k_),t}function k_(){if(--Pp===0&&Xo!==null){Cr!==null&&(Cr.status="fulfilled");var e=Xo;Xo=null,Or=0,Cr=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function ME(e,t){var n=[],i={status:"pending",value:null,reason:null,then:function(s){n.push(s)}};return e.then(function(){i.status="fulfilled",i.value=t;for(var s=0;s<n.length;s++)(0,n[s])(t)},function(s){for(i.status="rejected",i.reason=s,s=0;s<n.length;s++)(0,n[s])(void 0)}),i}var X_=Pt.S;Pt.S=function(e,t){Yx=Vn(),typeof t=="object"&&t!==null&&typeof t.then=="function"&&SE(e,t),X_!==null&&X_(e,t)};var Na=Pi(null);function Cm(){var e=Na.current;return e!==null?e:ge.pooledCache}function tu(e,t){t===null?ye(Na,Na.current):ye(Na,t.pool)}function Iy(){var e=Cm();return e===null?null:{parent:Ye._currentValue,pool:e}}var qr=Error(et(460)),Rm=Error(et(474)),Wu=Error(et(542)),yu={then:function(){}};function W_(e){return e=e.status,e==="fulfilled"||e==="rejected"}function Oy(e,t,n){switch(n=e[n],n===void 0?e.push(t):n!==t&&(t.then(as,as),t=n),t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,Y_(e),e;default:if(typeof t.status=="string")t.then(as,as);else{if(e=ge,e!==null&&100<e.shellSuspendCounter)throw Error(et(482));e=t,e.status="pending",e.then(function(i){if(t.status==="pending"){var s=t;s.status="fulfilled",s.value=i}},function(i){if(t.status==="pending"){var s=t;s.status="rejected",s.reason=i}})}switch(t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,Y_(e),e}throw Ua=t,qr}}function wa(e){try{var t=e._init;return t(e._payload)}catch(n){throw n!==null&&typeof n=="object"&&typeof n.then=="function"?(Ua=n,qr):n}}var Ua=null;function q_(){if(Ua===null)throw Error(et(459));var e=Ua;return Ua=null,e}function Y_(e){if(e===qr||e===Wu)throw Error(et(483))}var Rr=null,rl=0;function Vc(e){var t=rl;return rl+=1,Rr===null&&(Rr=[]),Oy(Rr,e,t)}function No(e,t){t=t.props.ref,e.ref=t!==void 0?t:null}function Hc(e,t){throw t.$$typeof===c1?Error(et(525)):(e=Object.prototype.toString.call(t),Error(et(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)))}function Py(e){function t(f,_){if(e){var b=f.deletions;b===null?(f.deletions=[_],f.flags|=16):b.push(_)}}function n(f,_){if(!e)return null;for(;_!==null;)t(f,_),_=_.sibling;return null}function i(f){for(var _=new Map;f!==null;)f.key!==null?_.set(f.key,f):_.set(f.index,f),f=f.sibling;return _}function s(f,_){return f=os(f,_),f.index=0,f.sibling=null,f}function a(f,_,b){return f.index=b,e?(b=f.alternate,b!==null?(b=b.index,b<_?(f.flags|=67108866,_):b):(f.flags|=67108866,_)):(f.flags|=1048576,_)}function r(f){return e&&f.alternate===null&&(f.flags|=67108866),f}function o(f,_,b,v){return _===null||_.tag!==6?(_=Yd(b,f.mode,v),_.return=f,_):(_=s(_,b),_.return=f,_)}function l(f,_,b,v){var T=b.type;return T===dr?h(f,_,b.props.children,v,b.key):_!==null&&(_.elementType===T||typeof T=="object"&&T!==null&&T.$$typeof===Ns&&wa(T)===_.type)?(_=s(_,b.props),No(_,b),_.return=f,_):(_=$c(b.type,b.key,b.props,null,f.mode,v),No(_,b),_.return=f,_)}function c(f,_,b,v){return _===null||_.tag!==4||_.stateNode.containerInfo!==b.containerInfo||_.stateNode.implementation!==b.implementation?(_=Zd(b,f.mode,v),_.return=f,_):(_=s(_,b.children||[]),_.return=f,_)}function h(f,_,b,v,T){return _===null||_.tag!==7?(_=Da(b,f.mode,v,T),_.return=f,_):(_=s(_,b),_.return=f,_)}function p(f,_,b){if(typeof _=="string"&&_!==""||typeof _=="number"||typeof _=="bigint")return _=Yd(""+_,f.mode,b),_.return=f,_;if(typeof _=="object"&&_!==null){switch(_.$$typeof){case Nc:return b=$c(_.type,_.key,_.props,null,f.mode,b),No(b,_),b.return=f,b;case Po:return _=Zd(_,f.mode,b),_.return=f,_;case Ns:return _=wa(_),p(f,_,b)}if(zo(_)||Ro(_))return _=Da(_,f.mode,b,null),_.return=f,_;if(typeof _.then=="function")return p(f,Vc(_),b);if(_.$$typeof===ss)return p(f,Fc(f,_),b);Hc(f,_)}return null}function u(f,_,b,v){var T=_!==null?_.key:null;if(typeof b=="string"&&b!==""||typeof b=="number"||typeof b=="bigint")return T!==null?null:o(f,_,""+b,v);if(typeof b=="object"&&b!==null){switch(b.$$typeof){case Nc:return b.key===T?l(f,_,b,v):null;case Po:return b.key===T?c(f,_,b,v):null;case Ns:return b=wa(b),u(f,_,b,v)}if(zo(b)||Ro(b))return T!==null?null:h(f,_,b,v,null);if(typeof b.then=="function")return u(f,_,Vc(b),v);if(b.$$typeof===ss)return u(f,_,Fc(f,b),v);Hc(f,b)}return null}function d(f,_,b,v,T){if(typeof v=="string"&&v!==""||typeof v=="number"||typeof v=="bigint")return f=f.get(b)||null,o(_,f,""+v,T);if(typeof v=="object"&&v!==null){switch(v.$$typeof){case Nc:return f=f.get(v.key===null?b:v.key)||null,l(_,f,v,T);case Po:return f=f.get(v.key===null?b:v.key)||null,c(_,f,v,T);case Ns:return v=wa(v),d(f,_,b,v,T)}if(zo(v)||Ro(v))return f=f.get(b)||null,h(_,f,v,T,null);if(typeof v.then=="function")return d(f,_,b,Vc(v),T);if(v.$$typeof===ss)return d(f,_,b,Fc(_,v),T);Hc(_,v)}return null}function g(f,_,b,v){for(var T=null,A=null,w=_,y=_=0,M=null;w!==null&&y<b.length;y++){w.index>y?(M=w,w=null):M=w.sibling;var R=u(f,w,b[y],v);if(R===null){w===null&&(w=M);break}e&&w&&R.alternate===null&&t(f,w),_=a(R,_,y),A===null?T=R:A.sibling=R,A=R,w=M}if(y===b.length)return n(f,w),ee&&ns(f,y),T;if(w===null){for(;y<b.length;y++)w=p(f,b[y],v),w!==null&&(_=a(w,_,y),A===null?T=w:A.sibling=w,A=w);return ee&&ns(f,y),T}for(w=i(w);y<b.length;y++)M=d(w,f,y,b[y],v),M!==null&&(e&&M.alternate!==null&&w.delete(M.key===null?y:M.key),_=a(M,_,y),A===null?T=M:A.sibling=M,A=M);return e&&w.forEach(function(D){return t(f,D)}),ee&&ns(f,y),T}function S(f,_,b,v){if(b==null)throw Error(et(151));for(var T=null,A=null,w=_,y=_=0,M=null,R=b.next();w!==null&&!R.done;y++,R=b.next()){w.index>y?(M=w,w=null):M=w.sibling;var D=u(f,w,R.value,v);if(D===null){w===null&&(w=M);break}e&&w&&D.alternate===null&&t(f,w),_=a(D,_,y),A===null?T=D:A.sibling=D,A=D,w=M}if(R.done)return n(f,w),ee&&ns(f,y),T;if(w===null){for(;!R.done;y++,R=b.next())R=p(f,R.value,v),R!==null&&(_=a(R,_,y),A===null?T=R:A.sibling=R,A=R);return ee&&ns(f,y),T}for(w=i(w);!R.done;y++,R=b.next())R=d(w,f,y,R.value,v),R!==null&&(e&&R.alternate!==null&&w.delete(R.key===null?y:R.key),_=a(R,_,y),A===null?T=R:A.sibling=R,A=R);return e&&w.forEach(function(I){return t(f,I)}),ee&&ns(f,y),T}function m(f,_,b,v){if(typeof b=="object"&&b!==null&&b.type===dr&&b.key===null&&(b=b.props.children),typeof b=="object"&&b!==null){switch(b.$$typeof){case Nc:t:{for(var T=b.key;_!==null;){if(_.key===T){if(T=b.type,T===dr){if(_.tag===7){n(f,_.sibling),v=s(_,b.props.children),v.return=f,f=v;break t}}else if(_.elementType===T||typeof T=="object"&&T!==null&&T.$$typeof===Ns&&wa(T)===_.type){n(f,_.sibling),v=s(_,b.props),No(v,b),v.return=f,f=v;break t}n(f,_);break}else t(f,_);_=_.sibling}b.type===dr?(v=Da(b.props.children,f.mode,v,b.key),v.return=f,f=v):(v=$c(b.type,b.key,b.props,null,f.mode,v),No(v,b),v.return=f,f=v)}return r(f);case Po:t:{for(T=b.key;_!==null;){if(_.key===T)if(_.tag===4&&_.stateNode.containerInfo===b.containerInfo&&_.stateNode.implementation===b.implementation){n(f,_.sibling),v=s(_,b.children||[]),v.return=f,f=v;break t}else{n(f,_);break}else t(f,_);_=_.sibling}v=Zd(b,f.mode,v),v.return=f,f=v}return r(f);case Ns:return b=wa(b),m(f,_,b,v)}if(zo(b))return g(f,_,b,v);if(Ro(b)){if(T=Ro(b),typeof T!="function")throw Error(et(150));return b=T.call(b),S(f,_,b,v)}if(typeof b.then=="function")return m(f,_,Vc(b),v);if(b.$$typeof===ss)return m(f,_,Fc(f,b),v);Hc(f,b)}return typeof b=="string"&&b!==""||typeof b=="number"||typeof b=="bigint"?(b=""+b,_!==null&&_.tag===6?(n(f,_.sibling),v=s(_,b),v.return=f,f=v):(n(f,_),v=Yd(b,f.mode,v),v.return=f,f=v),r(f)):n(f,_)}return function(f,_,b,v){try{rl=0;var T=m(f,_,b,v);return Rr=null,T}catch(w){if(w===qr||w===Wu)throw w;var A=Bn(29,w,null,f.mode);return A.lanes=v,A.return=f,A}finally{}}}var Pa=Py(!0),zy=Py(!1),Us=!1;function Dm(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function zp(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function Xs(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function Ws(e,t,n){var i=e.updateQueue;if(i===null)return null;if(i=i.shared,(se&2)!==0){var s=i.pending;return s===null?t.next=t:(t.next=s.next,s.next=t),i.pending=t,t=gu(e),Cy(e,null,n),t}return Xu(e,i,t,n),gu(e)}function Wo(e,t,n){if(t=t.updateQueue,t!==null&&(t=t.shared,(n&4194048)!==0)){var i=t.lanes;i&=e.pendingLanes,n|=i,t.lanes=n,ey(e,n)}}function Kd(e,t){var n=e.updateQueue,i=e.alternate;if(i!==null&&(i=i.updateQueue,n===i)){var s=null,a=null;if(n=n.firstBaseUpdate,n!==null){do{var r={lane:n.lane,tag:n.tag,payload:n.payload,callback:null,next:null};a===null?s=a=r:a=a.next=r,n=n.next}while(n!==null);a===null?s=a=t:a=a.next=t}else s=a=t;n={baseState:i.baseState,firstBaseUpdate:s,lastBaseUpdate:a,shared:i.shared,callbacks:i.callbacks},e.updateQueue=n;return}e=n.lastBaseUpdate,e===null?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}var Bp=!1;function qo(){if(Bp){var e=Cr;if(e!==null)throw e}}function Yo(e,t,n,i){Bp=!1;var s=e.updateQueue;Us=!1;var a=s.firstBaseUpdate,r=s.lastBaseUpdate,o=s.shared.pending;if(o!==null){s.shared.pending=null;var l=o,c=l.next;l.next=null,r===null?a=c:r.next=c,r=l;var h=e.alternate;h!==null&&(h=h.updateQueue,o=h.lastBaseUpdate,o!==r&&(o===null?h.firstBaseUpdate=c:o.next=c,h.lastBaseUpdate=l))}if(a!==null){var p=s.baseState;r=0,h=c=l=null,o=a;do{var u=o.lane&-536870913,d=u!==o.lane;if(d?(jt&u)===u:(i&u)===u){u!==0&&u===Or&&(Bp=!0),h!==null&&(h=h.next={lane:0,tag:o.tag,payload:o.payload,callback:null,next:null});t:{var g=e,S=o;u=t;var m=n;switch(S.tag){case 1:if(g=S.payload,typeof g=="function"){p=g.call(m,p,u);break t}p=g;break t;case 3:g.flags=g.flags&-65537|128;case 0:if(g=S.payload,u=typeof g=="function"?g.call(m,p,u):g,u==null)break t;p=Te({},p,u);break t;case 2:Us=!0}}u=o.callback,u!==null&&(e.flags|=64,d&&(e.flags|=8192),d=s.callbacks,d===null?s.callbacks=[u]:d.push(u))}else d={lane:u,tag:o.tag,payload:o.payload,callback:o.callback,next:null},h===null?(c=h=d,l=p):h=h.next=d,r|=u;if(o=o.next,o===null){if(o=s.shared.pending,o===null)break;d=o,o=d.next,d.next=null,s.lastBaseUpdate=d,s.shared.pending=null}}while(!0);h===null&&(l=p),s.baseState=l,s.firstBaseUpdate=c,s.lastBaseUpdate=h,a===null&&(s.shared.lanes=0),ta|=r,e.lanes=r,e.memoizedState=p}}function By(e,t){if(typeof e!="function")throw Error(et(191,e));e.call(t)}function Fy(e,t){var n=e.callbacks;if(n!==null)for(e.callbacks=null,e=0;e<n.length;e++)By(n[e],t)}var Pr=Pi(null),xu=Pi(0);function Z_(e,t){e=ps,ye(xu,e),ye(Pr,t),ps=e|t.baseLanes}function Fp(){ye(xu,ps),ye(Pr,Pr.current)}function Nm(){ps=xu.current,sn(Pr),sn(xu)}var Wn=Pi(null),ci=null;function Is(e){var t=e.alternate;ye(ke,ke.current&1),ye(Wn,e),ci===null&&(t===null||Pr.current!==null||t.memoizedState!==null)&&(ci=e)}function Vp(e){ye(ke,ke.current),ye(Wn,e),ci===null&&(ci=e)}function Vy(e){e.tag===22?(ye(ke,ke.current),ye(Wn,e),ci===null&&(ci=e)):Os(e)}function Os(){ye(ke,ke.current),ye(Wn,Wn.current)}function zn(e){sn(Wn),ci===e&&(ci=null),sn(ke)}var ke=Pi(0);function bu(e){for(var t=e;t!==null;){if(t.tag===13){var n=t.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||am(n)||rm(n)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder==="forwards"||t.memoizedProps.revealOrder==="backwards"||t.memoizedProps.revealOrder==="unstable_legacy-backwards"||t.memoizedProps.revealOrder==="together")){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var hs=0,Gt=null,de=null,We=null,Su=!1,Dr=!1,za=!1,Mu=0,ol=0,Nr=null,EE=0;function Be(){throw Error(et(321))}function Um(e,t){if(t===null)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!Xn(e[n],t[n]))return!1;return!0}function Lm(e,t,n,i,s,a){return hs=a,Gt=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,Pt.H=e===null||e.memoizedState===null?_x:Xm,za=!1,a=n(i,s),za=!1,Dr&&(a=Gy(t,n,i,s)),Hy(e),a}function Hy(e){Pt.H=ll;var t=de!==null&&de.next!==null;if(hs=0,We=de=Gt=null,Su=!1,ol=0,Nr=null,t)throw Error(et(300));e===null||Ze||(e=e.dependencies,e!==null&&vu(e)&&(Ze=!0))}function Gy(e,t,n,i){Gt=e;var s=0;do{if(Dr&&(Nr=null),ol=0,Dr=!1,25<=s)throw Error(et(301));if(s+=1,We=de=null,e.updateQueue!=null){var a=e.updateQueue;a.lastEffect=null,a.events=null,a.stores=null,a.memoCache!=null&&(a.memoCache.index=0)}Pt.H=vx,a=t(n,i)}while(Dr);return a}function TE(){var e=Pt.H,t=e.useState()[0];return t=typeof t.then=="function"?bl(t):t,e=e.useState()[0],(de!==null?de.memoizedState:null)!==e&&(Gt.flags|=1024),t}function Im(){var e=Mu!==0;return Mu=0,e}function Om(e,t,n){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~n}function Pm(e){if(Su){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}Su=!1}hs=0,We=de=Gt=null,Dr=!1,ol=Mu=0,Nr=null}function En(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return We===null?Gt.memoizedState=We=e:We=We.next=e,We}function Xe(){if(de===null){var e=Gt.alternate;e=e!==null?e.memoizedState:null}else e=de.next;var t=We===null?Gt.memoizedState:We.next;if(t!==null)We=t,de=e;else{if(e===null)throw Gt.alternate===null?Error(et(467)):Error(et(310));de=e,e={memoizedState:de.memoizedState,baseState:de.baseState,baseQueue:de.baseQueue,queue:de.queue,next:null},We===null?Gt.memoizedState=We=e:We=We.next=e}return We}function qu(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function bl(e){var t=ol;return ol+=1,Nr===null&&(Nr=[]),e=Oy(Nr,e,t),t=Gt,(We===null?t.memoizedState:We.next)===null&&(t=t.alternate,Pt.H=t===null||t.memoizedState===null?_x:Xm),e}function Yu(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return bl(e);if(e.$$typeof===ss)return hn(e)}throw Error(et(438,String(e)))}function zm(e){var t=null,n=Gt.updateQueue;if(n!==null&&(t=n.memoCache),t==null){var i=Gt.alternate;i!==null&&(i=i.updateQueue,i!==null&&(i=i.memoCache,i!=null&&(t={data:i.data.map(function(s){return s.slice()}),index:0})))}if(t==null&&(t={data:[],index:0}),n===null&&(n=qu(),Gt.updateQueue=n),n.memoCache=t,n=t.data[t.index],n===void 0)for(n=t.data[t.index]=Array(e),i=0;i<e;i++)n[i]=u1;return t.index++,n}function fs(e,t){return typeof t=="function"?t(e):t}function eu(e){var t=Xe();return Bm(t,de,e)}function Bm(e,t,n){var i=e.queue;if(i===null)throw Error(et(311));i.lastRenderedReducer=n;var s=e.baseQueue,a=i.pending;if(a!==null){if(s!==null){var r=s.next;s.next=a.next,a.next=r}t.baseQueue=s=a,i.pending=null}if(a=e.baseState,s===null)e.memoizedState=a;else{t=s.next;var o=r=null,l=null,c=t,h=!1;do{var p=c.lane&-536870913;if(p!==c.lane?(jt&p)===p:(hs&p)===p){var u=c.revertLane;if(u===0)l!==null&&(l=l.next={lane:0,revertLane:0,gesture:null,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null}),p===Or&&(h=!0);else if((hs&u)===u){c=c.next,u===Or&&(h=!0);continue}else p={lane:0,revertLane:c.revertLane,gesture:null,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null},l===null?(o=l=p,r=a):l=l.next=p,Gt.lanes|=u,ta|=u;p=c.action,za&&n(a,p),a=c.hasEagerState?c.eagerState:n(a,p)}else u={lane:p,revertLane:c.revertLane,gesture:c.gesture,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null},l===null?(o=l=u,r=a):l=l.next=u,Gt.lanes|=p,ta|=p;c=c.next}while(c!==null&&c!==t);if(l===null?r=a:l.next=o,!Xn(a,e.memoizedState)&&(Ze=!0,h&&(n=Cr,n!==null)))throw n;e.memoizedState=a,e.baseState=r,e.baseQueue=l,i.lastRenderedState=a}return s===null&&(i.lanes=0),[e.memoizedState,i.dispatch]}function jd(e){var t=Xe(),n=t.queue;if(n===null)throw Error(et(311));n.lastRenderedReducer=e;var i=n.dispatch,s=n.pending,a=t.memoizedState;if(s!==null){n.pending=null;var r=s=s.next;do a=e(a,r.action),r=r.next;while(r!==s);Xn(a,t.memoizedState)||(Ze=!0),t.memoizedState=a,t.baseQueue===null&&(t.baseState=a),n.lastRenderedState=a}return[a,i]}function ky(e,t,n){var i=Gt,s=Xe(),a=ee;if(a){if(n===void 0)throw Error(et(407));n=n()}else n=t();var r=!Xn((de||s).memoizedState,n);if(r&&(s.memoizedState=n,Ze=!0),s=s.queue,Fm(qy.bind(null,i,s,e),[e]),s.getSnapshot!==t||r||We!==null&&We.memoizedState.tag&1){if(i.flags|=2048,zr(9,{destroy:void 0},Wy.bind(null,i,s,n,t),null),ge===null)throw Error(et(349));a||(hs&127)!==0||Xy(i,t,n)}return n}function Xy(e,t,n){e.flags|=16384,e={getSnapshot:t,value:n},t=Gt.updateQueue,t===null?(t=qu(),Gt.updateQueue=t,t.stores=[e]):(n=t.stores,n===null?t.stores=[e]:n.push(e))}function Wy(e,t,n,i){t.value=n,t.getSnapshot=i,Yy(t)&&Zy(e)}function qy(e,t,n){return n(function(){Yy(t)&&Zy(e)})}function Yy(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!Xn(e,n)}catch{return!0}}function Zy(e){var t=Ga(e,2);t!==null&&Nn(t,e,2)}function Hp(e){var t=En();if(typeof e=="function"){var n=e;if(e=n(),za){zs(!0);try{n()}finally{zs(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:fs,lastRenderedState:e},t}function Jy(e,t,n,i){return e.baseState=n,Bm(e,de,typeof i=="function"?i:fs)}function AE(e,t,n,i,s){if(Ju(e))throw Error(et(485));if(e=t.action,e!==null){var a={payload:s,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(r){a.listeners.push(r)}};Pt.T!==null?n(!0):a.isTransition=!1,i(a),n=t.pending,n===null?(a.next=t.pending=a,Ky(t,a)):(a.next=n.next,t.pending=n.next=a)}}function Ky(e,t){var n=t.action,i=t.payload,s=e.state;if(t.isTransition){var a=Pt.T,r={};Pt.T=r;try{var o=n(s,i),l=Pt.S;l!==null&&l(r,o),J_(e,t,o)}catch(c){Gp(e,t,c)}finally{a!==null&&r.types!==null&&(a.types=r.types),Pt.T=a}}else try{a=n(s,i),J_(e,t,a)}catch(c){Gp(e,t,c)}}function J_(e,t,n){n!==null&&typeof n=="object"&&typeof n.then=="function"?n.then(function(i){K_(e,t,i)},function(i){return Gp(e,t,i)}):K_(e,t,n)}function K_(e,t,n){t.status="fulfilled",t.value=n,jy(t),e.state=n,t=e.pending,t!==null&&(n=t.next,n===t?e.pending=null:(n=n.next,t.next=n,Ky(e,n)))}function Gp(e,t,n){var i=e.pending;if(e.pending=null,i!==null){i=i.next;do t.status="rejected",t.reason=n,jy(t),t=t.next;while(t!==i)}e.action=null}function jy(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function Qy(e,t){return t}function j_(e,t){if(ee){var n=ge.formState;if(n!==null){t:{var i=Gt;if(ee){if(Ee){e:{for(var s=Ee,a=li;s.nodeType!==8;){if(!a){s=null;break e}if(s=ui(s.nextSibling),s===null){s=null;break e}}a=s.data,s=a==="F!"||a==="F"?s:null}if(s){Ee=ui(s.nextSibling),i=s.data==="F!";break t}}Qs(i)}i=!1}i&&(t=n[0])}}return n=En(),n.memoizedState=n.baseState=t,i={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Qy,lastRenderedState:t},n.queue=i,n=px.bind(null,Gt,i),i.dispatch=n,i=Hp(!1),a=km.bind(null,Gt,!1,i.queue),i=En(),s={state:t,dispatch:null,action:e,pending:null},i.queue=s,n=AE.bind(null,Gt,s,a,n),s.dispatch=n,i.memoizedState=e,[t,n,!1]}function Q_(e){var t=Xe();return $y(t,de,e)}function $y(e,t,n){if(t=Bm(e,t,Qy)[0],e=eu(fs)[0],typeof t=="object"&&t!==null&&typeof t.then=="function")try{var i=bl(t)}catch(r){throw r===qr?Wu:r}else i=t;t=Xe();var s=t.queue,a=s.dispatch;return n!==t.memoizedState&&(Gt.flags|=2048,zr(9,{destroy:void 0},wE.bind(null,s,n),null)),[i,a,e]}function wE(e,t){e.action=t}function $_(e){var t=Xe(),n=de;if(n!==null)return $y(t,n,e);Xe(),t=t.memoizedState,n=Xe();var i=n.queue.dispatch;return n.memoizedState=e,[t,i,!1]}function zr(e,t,n,i){return e={tag:e,create:n,deps:i,inst:t,next:null},t=Gt.updateQueue,t===null&&(t=qu(),Gt.updateQueue=t),n=t.lastEffect,n===null?t.lastEffect=e.next=e:(i=n.next,n.next=e,e.next=i,t.lastEffect=e),e}function tx(){return Xe().memoizedState}function nu(e,t,n,i){var s=En();Gt.flags|=e,s.memoizedState=zr(1|t,{destroy:void 0},n,i===void 0?null:i)}function Zu(e,t,n,i){var s=Xe();i=i===void 0?null:i;var a=s.memoizedState.inst;de!==null&&i!==null&&Um(i,de.memoizedState.deps)?s.memoizedState=zr(t,a,n,i):(Gt.flags|=e,s.memoizedState=zr(1|t,a,n,i))}function tv(e,t){nu(8390656,8,e,t)}function Fm(e,t){Zu(2048,8,e,t)}function CE(e){Gt.flags|=4;var t=Gt.updateQueue;if(t===null)t=qu(),Gt.updateQueue=t,t.events=[e];else{var n=t.events;n===null?t.events=[e]:n.push(e)}}function ex(e){var t=Xe().memoizedState;return CE({ref:t,nextImpl:e}),function(){if((se&2)!==0)throw Error(et(440));return t.impl.apply(void 0,arguments)}}function nx(e,t){return Zu(4,2,e,t)}function ix(e,t){return Zu(4,4,e,t)}function sx(e,t){if(typeof t=="function"){e=e();var n=t(e);return function(){typeof n=="function"?n():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function ax(e,t,n){n=n!=null?n.concat([e]):null,Zu(4,4,sx.bind(null,t,e),n)}function Vm(){}function rx(e,t){var n=Xe();t=t===void 0?null:t;var i=n.memoizedState;return t!==null&&Um(t,i[1])?i[0]:(n.memoizedState=[e,t],e)}function ox(e,t){var n=Xe();t=t===void 0?null:t;var i=n.memoizedState;if(t!==null&&Um(t,i[1]))return i[0];if(i=e(),za){zs(!0);try{e()}finally{zs(!1)}}return n.memoizedState=[i,t],i}function Hm(e,t,n){return n===void 0||(hs&1073741824)!==0&&(jt&261930)===0?e.memoizedState=t:(e.memoizedState=n,e=Jx(),Gt.lanes|=e,ta|=e,n)}function lx(e,t,n,i){return Xn(n,t)?n:Pr.current!==null?(e=Hm(e,n,i),Xn(e,t)||(Ze=!0),e):(hs&42)===0||(hs&1073741824)!==0&&(jt&261930)===0?(Ze=!0,e.memoizedState=n):(e=Jx(),Gt.lanes|=e,ta|=e,t)}function cx(e,t,n,i,s){var a=ae.p;ae.p=a!==0&&8>a?a:8;var r=Pt.T,o={};Pt.T=o,km(e,!1,t,n);try{var l=s(),c=Pt.S;if(c!==null&&c(o,l),l!==null&&typeof l=="object"&&typeof l.then=="function"){var h=ME(l,i);Zo(e,t,h,kn(e))}else Zo(e,t,i,kn(e))}catch(p){Zo(e,t,{then:function(){},status:"rejected",reason:p},kn())}finally{ae.p=a,r!==null&&o.types!==null&&(r.types=o.types),Pt.T=r}}function RE(){}function kp(e,t,n,i){if(e.tag!==5)throw Error(et(476));var s=ux(e).queue;cx(e,s,t,Ra,n===null?RE:function(){return hx(e),n(i)})}function ux(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:Ra,baseState:Ra,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:fs,lastRenderedState:Ra},next:null};var n={};return t.next={memoizedState:n,baseState:n,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:fs,lastRenderedState:n},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function hx(e){var t=ux(e);t.next===null&&(t=e.alternate.memoizedState),Zo(e,t.next.queue,{},kn())}function Gm(){return hn(hl)}function fx(){return Xe().memoizedState}function dx(){return Xe().memoizedState}function DE(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var n=kn();e=Xs(n);var i=Ws(t,e,n);i!==null&&(Nn(i,t,n),Wo(i,t,n)),t={cache:wm()},e.payload=t;return}t=t.return}}function NE(e,t,n){var i=kn();n={lane:i,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null},Ju(e)?mx(t,n):(n=Mm(e,t,n,i),n!==null&&(Nn(n,e,i),gx(n,t,i)))}function px(e,t,n){var i=kn();Zo(e,t,n,i)}function Zo(e,t,n,i){var s={lane:i,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null};if(Ju(e))mx(t,s);else{var a=e.alternate;if(e.lanes===0&&(a===null||a.lanes===0)&&(a=t.lastRenderedReducer,a!==null))try{var r=t.lastRenderedState,o=a(r,n);if(s.hasEagerState=!0,s.eagerState=o,Xn(o,r))return Xu(e,t,s,0),ge===null&&ku(),!1}catch{}finally{}if(n=Mm(e,t,s,i),n!==null)return Nn(n,e,i),gx(n,t,i),!0}return!1}function km(e,t,n,i){if(i={lane:2,revertLane:Qm(),gesture:null,action:i,hasEagerState:!1,eagerState:null,next:null},Ju(e)){if(t)throw Error(et(479))}else t=Mm(e,n,i,2),t!==null&&Nn(t,e,2)}function Ju(e){var t=e.alternate;return e===Gt||t!==null&&t===Gt}function mx(e,t){Dr=Su=!0;var n=e.pending;n===null?t.next=t:(t.next=n.next,n.next=t),e.pending=t}function gx(e,t,n){if((n&4194048)!==0){var i=t.lanes;i&=e.pendingLanes,n|=i,t.lanes=n,ey(e,n)}}var ll={readContext:hn,use:Yu,useCallback:Be,useContext:Be,useEffect:Be,useImperativeHandle:Be,useLayoutEffect:Be,useInsertionEffect:Be,useMemo:Be,useReducer:Be,useRef:Be,useState:Be,useDebugValue:Be,useDeferredValue:Be,useTransition:Be,useSyncExternalStore:Be,useId:Be,useHostTransitionStatus:Be,useFormState:Be,useActionState:Be,useOptimistic:Be,useMemoCache:Be,useCacheRefresh:Be};ll.useEffectEvent=Be;var _x={readContext:hn,use:Yu,useCallback:function(e,t){return En().memoizedState=[e,t===void 0?null:t],e},useContext:hn,useEffect:tv,useImperativeHandle:function(e,t,n){n=n!=null?n.concat([e]):null,nu(4194308,4,sx.bind(null,t,e),n)},useLayoutEffect:function(e,t){return nu(4194308,4,e,t)},useInsertionEffect:function(e,t){nu(4,2,e,t)},useMemo:function(e,t){var n=En();t=t===void 0?null:t;var i=e();if(za){zs(!0);try{e()}finally{zs(!1)}}return n.memoizedState=[i,t],i},useReducer:function(e,t,n){var i=En();if(n!==void 0){var s=n(t);if(za){zs(!0);try{n(t)}finally{zs(!1)}}}else s=t;return i.memoizedState=i.baseState=s,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:s},i.queue=e,e=e.dispatch=NE.bind(null,Gt,e),[i.memoizedState,e]},useRef:function(e){var t=En();return e={current:e},t.memoizedState=e},useState:function(e){e=Hp(e);var t=e.queue,n=px.bind(null,Gt,t);return t.dispatch=n,[e.memoizedState,n]},useDebugValue:Vm,useDeferredValue:function(e,t){var n=En();return Hm(n,e,t)},useTransition:function(){var e=Hp(!1);return e=cx.bind(null,Gt,e.queue,!0,!1),En().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,n){var i=Gt,s=En();if(ee){if(n===void 0)throw Error(et(407));n=n()}else{if(n=t(),ge===null)throw Error(et(349));(jt&127)!==0||Xy(i,t,n)}s.memoizedState=n;var a={value:n,getSnapshot:t};return s.queue=a,tv(qy.bind(null,i,a,e),[e]),i.flags|=2048,zr(9,{destroy:void 0},Wy.bind(null,i,a,n,t),null),n},useId:function(){var e=En(),t=ge.identifierPrefix;if(ee){var n=Li,i=Ui;n=(i&~(1<<32-Gn(i)-1)).toString(32)+n,t="_"+t+"R_"+n,n=Mu++,0<n&&(t+="H"+n.toString(32)),t+="_"}else n=EE++,t="_"+t+"r_"+n.toString(32)+"_";return e.memoizedState=t},useHostTransitionStatus:Gm,useFormState:j_,useActionState:j_,useOptimistic:function(e){var t=En();t.memoizedState=t.baseState=e;var n={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=n,t=km.bind(null,Gt,!0,n),n.dispatch=t,[e,t]},useMemoCache:zm,useCacheRefresh:function(){return En().memoizedState=DE.bind(null,Gt)},useEffectEvent:function(e){var t=En(),n={impl:e};return t.memoizedState=n,function(){if((se&2)!==0)throw Error(et(440));return n.impl.apply(void 0,arguments)}}},Xm={readContext:hn,use:Yu,useCallback:rx,useContext:hn,useEffect:Fm,useImperativeHandle:ax,useInsertionEffect:nx,useLayoutEffect:ix,useMemo:ox,useReducer:eu,useRef:tx,useState:function(){return eu(fs)},useDebugValue:Vm,useDeferredValue:function(e,t){var n=Xe();return lx(n,de.memoizedState,e,t)},useTransition:function(){var e=eu(fs)[0],t=Xe().memoizedState;return[typeof e=="boolean"?e:bl(e),t]},useSyncExternalStore:ky,useId:fx,useHostTransitionStatus:Gm,useFormState:Q_,useActionState:Q_,useOptimistic:function(e,t){var n=Xe();return Jy(n,de,e,t)},useMemoCache:zm,useCacheRefresh:dx};Xm.useEffectEvent=ex;var vx={readContext:hn,use:Yu,useCallback:rx,useContext:hn,useEffect:Fm,useImperativeHandle:ax,useInsertionEffect:nx,useLayoutEffect:ix,useMemo:ox,useReducer:jd,useRef:tx,useState:function(){return jd(fs)},useDebugValue:Vm,useDeferredValue:function(e,t){var n=Xe();return de===null?Hm(n,e,t):lx(n,de.memoizedState,e,t)},useTransition:function(){var e=jd(fs)[0],t=Xe().memoizedState;return[typeof e=="boolean"?e:bl(e),t]},useSyncExternalStore:ky,useId:fx,useHostTransitionStatus:Gm,useFormState:$_,useActionState:$_,useOptimistic:function(e,t){var n=Xe();return de!==null?Jy(n,de,e,t):(n.baseState=e,[e,n.queue.dispatch])},useMemoCache:zm,useCacheRefresh:dx};vx.useEffectEvent=ex;function Qd(e,t,n,i){t=e.memoizedState,n=n(i,t),n=n==null?t:Te({},t,n),e.memoizedState=n,e.lanes===0&&(e.updateQueue.baseState=n)}var Xp={enqueueSetState:function(e,t,n){e=e._reactInternals;var i=kn(),s=Xs(i);s.payload=t,n!=null&&(s.callback=n),t=Ws(e,s,i),t!==null&&(Nn(t,e,i),Wo(t,e,i))},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var i=kn(),s=Xs(i);s.tag=1,s.payload=t,n!=null&&(s.callback=n),t=Ws(e,s,i),t!==null&&(Nn(t,e,i),Wo(t,e,i))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=kn(),i=Xs(n);i.tag=2,t!=null&&(i.callback=t),t=Ws(e,i,n),t!==null&&(Nn(t,e,n),Wo(t,e,n))}};function ev(e,t,n,i,s,a,r){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(i,a,r):t.prototype&&t.prototype.isPureReactComponent?!il(n,i)||!il(s,a):!0}function nv(e,t,n,i){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(n,i),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(n,i),t.state!==e&&Xp.enqueueReplaceState(t,t.state,null)}function Ba(e,t){var n=t;if("ref"in t){n={};for(var i in t)i!=="ref"&&(n[i]=t[i])}if(e=e.defaultProps){n===t&&(n=Te({},n));for(var s in e)n[s]===void 0&&(n[s]=e[s])}return n}function yx(e){mu(e)}function xx(e){console.error(e)}function bx(e){mu(e)}function Eu(e,t){try{var n=e.onUncaughtError;n(t.value,{componentStack:t.stack})}catch(i){setTimeout(function(){throw i})}}function iv(e,t,n){try{var i=e.onCaughtError;i(n.value,{componentStack:n.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(s){setTimeout(function(){throw s})}}function Wp(e,t,n){return n=Xs(n),n.tag=3,n.payload={element:null},n.callback=function(){Eu(e,t)},n}function Sx(e){return e=Xs(e),e.tag=3,e}function Mx(e,t,n,i){var s=n.type.getDerivedStateFromError;if(typeof s=="function"){var a=i.value;e.payload=function(){return s(a)},e.callback=function(){iv(t,n,i)}}var r=n.stateNode;r!==null&&typeof r.componentDidCatch=="function"&&(e.callback=function(){iv(t,n,i),typeof s!="function"&&(qs===null?qs=new Set([this]):qs.add(this));var o=i.stack;this.componentDidCatch(i.value,{componentStack:o!==null?o:""})})}function UE(e,t,n,i,s){if(n.flags|=32768,i!==null&&typeof i=="object"&&typeof i.then=="function"){if(t=n.alternate,t!==null&&Wr(t,n,s,!0),n=Wn.current,n!==null){switch(n.tag){case 31:case 13:return ci===null?Ru():n.alternate===null&&Fe===0&&(Fe=3),n.flags&=-257,n.flags|=65536,n.lanes=s,i===yu?n.flags|=16384:(t=n.updateQueue,t===null?n.updateQueue=new Set([i]):t.add(i),cp(e,i,s)),!1;case 22:return n.flags|=65536,i===yu?n.flags|=16384:(t=n.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([i])},n.updateQueue=t):(n=t.retryQueue,n===null?t.retryQueue=new Set([i]):n.add(i)),cp(e,i,s)),!1}throw Error(et(435,n.tag))}return cp(e,i,s),Ru(),!1}if(ee)return t=Wn.current,t!==null?((t.flags&65536)===0&&(t.flags|=256),t.flags|=65536,t.lanes=s,i!==Up&&(e=Error(et(422),{cause:i}),al(oi(e,n)))):(i!==Up&&(t=Error(et(423),{cause:i}),al(oi(t,n))),e=e.current.alternate,e.flags|=65536,s&=-s,e.lanes|=s,i=oi(i,n),s=Wp(e.stateNode,i,s),Kd(e,s),Fe!==4&&(Fe=2)),!1;var a=Error(et(520),{cause:i});if(a=oi(a,n),jo===null?jo=[a]:jo.push(a),Fe!==4&&(Fe=2),t===null)return!0;i=oi(i,n),n=t;do{switch(n.tag){case 3:return n.flags|=65536,e=s&-s,n.lanes|=e,e=Wp(n.stateNode,i,e),Kd(n,e),!1;case 1:if(t=n.type,a=n.stateNode,(n.flags&128)===0&&(typeof t.getDerivedStateFromError=="function"||a!==null&&typeof a.componentDidCatch=="function"&&(qs===null||!qs.has(a))))return n.flags|=65536,s&=-s,n.lanes|=s,s=Sx(s),Mx(s,e,n,i),Kd(n,s),!1}n=n.return}while(n!==null);return!1}var Wm=Error(et(461)),Ze=!1;function ln(e,t,n,i){t.child=e===null?zy(t,null,n,i):Pa(t,e.child,n,i)}function sv(e,t,n,i,s){n=n.render;var a=t.ref;if("ref"in i){var r={};for(var o in i)o!=="ref"&&(r[o]=i[o])}else r=i;return Oa(t),i=Lm(e,t,n,r,a,s),o=Im(),e!==null&&!Ze?(Om(e,t,s),ds(e,t,s)):(ee&&o&&Tm(t),t.flags|=1,ln(e,t,i,s),t.child)}function av(e,t,n,i,s){if(e===null){var a=n.type;return typeof a=="function"&&!Em(a)&&a.defaultProps===void 0&&n.compare===null?(t.tag=15,t.type=a,Ex(e,t,a,i,s)):(e=$c(n.type,null,i,t,t.mode,s),e.ref=t.ref,e.return=t,t.child=e)}if(a=e.child,!qm(e,s)){var r=a.memoizedProps;if(n=n.compare,n=n!==null?n:il,n(r,i)&&e.ref===t.ref)return ds(e,t,s)}return t.flags|=1,e=os(a,i),e.ref=t.ref,e.return=t,t.child=e}function Ex(e,t,n,i,s){if(e!==null){var a=e.memoizedProps;if(il(a,i)&&e.ref===t.ref)if(Ze=!1,t.pendingProps=i=a,qm(e,s))(e.flags&131072)!==0&&(Ze=!0);else return t.lanes=e.lanes,ds(e,t,s)}return qp(e,t,n,i,s)}function Tx(e,t,n,i){var s=i.children,a=e!==null?e.memoizedState:null;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),i.mode==="hidden"){if((t.flags&128)!==0){if(a=a!==null?a.baseLanes|n:n,e!==null){for(i=t.child=e.child,s=0;i!==null;)s=s|i.lanes|i.childLanes,i=i.sibling;i=s&~a}else i=0,t.child=null;return rv(e,t,a,n,i)}if((n&536870912)!==0)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&tu(t,a!==null?a.cachePool:null),a!==null?Z_(t,a):Fp(),Vy(t);else return i=t.lanes=536870912,rv(e,t,a!==null?a.baseLanes|n:n,n,i)}else a!==null?(tu(t,a.cachePool),Z_(t,a),Os(t),t.memoizedState=null):(e!==null&&tu(t,null),Fp(),Os(t));return ln(e,t,s,n),t.child}function Fo(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function rv(e,t,n,i,s){var a=Cm();return a=a===null?null:{parent:Ye._currentValue,pool:a},t.memoizedState={baseLanes:n,cachePool:a},e!==null&&tu(t,null),Fp(),Vy(t),e!==null&&Wr(e,t,i,!0),t.childLanes=s,null}function iu(e,t){return t=Tu({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function ov(e,t,n){return Pa(t,e.child,null,n),e=iu(t,t.pendingProps),e.flags|=2,zn(t),t.memoizedState=null,e}function LE(e,t,n){var i=t.pendingProps,s=(t.flags&128)!==0;if(t.flags&=-129,e===null){if(ee){if(i.mode==="hidden")return e=iu(t,i),t.lanes=536870912,Fo(null,e);if(Vp(t),(e=Ee)?(e=_b(e,li),e=e!==null&&e.data==="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:js!==null?{id:Ui,overflow:Li}:null,retryLane:536870912,hydrationErrors:null},n=Dy(e),n.return=t,t.child=n,un=t,Ee=null)):e=null,e===null)throw Qs(t);return t.lanes=536870912,null}return iu(t,i)}var a=e.memoizedState;if(a!==null){var r=a.dehydrated;if(Vp(t),s)if(t.flags&256)t.flags&=-257,t=ov(e,t,n);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(et(558));else if(Ze||Wr(e,t,n,!1),s=(n&e.childLanes)!==0,Ze||s){if(i=ge,i!==null&&(r=ny(i,n),r!==0&&r!==a.retryLane))throw a.retryLane=r,Ga(e,r),Nn(i,e,r),Wm;Ru(),t=ov(e,t,n)}else e=a.treeContext,Ee=ui(r.nextSibling),un=t,ee=!0,ks=null,li=!1,e!==null&&Uy(t,e),t=iu(t,i),t.flags|=4096;return t}return e=os(e.child,{mode:i.mode,children:i.children}),e.ref=t.ref,t.child=e,e.return=t,e}function su(e,t){var n=t.ref;if(n===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof n!="function"&&typeof n!="object")throw Error(et(284));(e===null||e.ref!==n)&&(t.flags|=4194816)}}function qp(e,t,n,i,s){return Oa(t),n=Lm(e,t,n,i,void 0,s),i=Im(),e!==null&&!Ze?(Om(e,t,s),ds(e,t,s)):(ee&&i&&Tm(t),t.flags|=1,ln(e,t,n,s),t.child)}function lv(e,t,n,i,s,a){return Oa(t),t.updateQueue=null,n=Gy(t,i,n,s),Hy(e),i=Im(),e!==null&&!Ze?(Om(e,t,a),ds(e,t,a)):(ee&&i&&Tm(t),t.flags|=1,ln(e,t,n,a),t.child)}function cv(e,t,n,i,s){if(Oa(t),t.stateNode===null){var a=br,r=n.contextType;typeof r=="object"&&r!==null&&(a=hn(r)),a=new n(i,a),t.memoizedState=a.state!==null&&a.state!==void 0?a.state:null,a.updater=Xp,t.stateNode=a,a._reactInternals=t,a=t.stateNode,a.props=i,a.state=t.memoizedState,a.refs={},Dm(t),r=n.contextType,a.context=typeof r=="object"&&r!==null?hn(r):br,a.state=t.memoizedState,r=n.getDerivedStateFromProps,typeof r=="function"&&(Qd(t,n,r,i),a.state=t.memoizedState),typeof n.getDerivedStateFromProps=="function"||typeof a.getSnapshotBeforeUpdate=="function"||typeof a.UNSAFE_componentWillMount!="function"&&typeof a.componentWillMount!="function"||(r=a.state,typeof a.componentWillMount=="function"&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount=="function"&&a.UNSAFE_componentWillMount(),r!==a.state&&Xp.enqueueReplaceState(a,a.state,null),Yo(t,i,a,s),qo(),a.state=t.memoizedState),typeof a.componentDidMount=="function"&&(t.flags|=4194308),i=!0}else if(e===null){a=t.stateNode;var o=t.memoizedProps,l=Ba(n,o);a.props=l;var c=a.context,h=n.contextType;r=br,typeof h=="object"&&h!==null&&(r=hn(h));var p=n.getDerivedStateFromProps;h=typeof p=="function"||typeof a.getSnapshotBeforeUpdate=="function",o=t.pendingProps!==o,h||typeof a.UNSAFE_componentWillReceiveProps!="function"&&typeof a.componentWillReceiveProps!="function"||(o||c!==r)&&nv(t,a,i,r),Us=!1;var u=t.memoizedState;a.state=u,Yo(t,i,a,s),qo(),c=t.memoizedState,o||u!==c||Us?(typeof p=="function"&&(Qd(t,n,p,i),c=t.memoizedState),(l=Us||ev(t,n,l,i,u,c,r))?(h||typeof a.UNSAFE_componentWillMount!="function"&&typeof a.componentWillMount!="function"||(typeof a.componentWillMount=="function"&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount=="function"&&a.UNSAFE_componentWillMount()),typeof a.componentDidMount=="function"&&(t.flags|=4194308)):(typeof a.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=i,t.memoizedState=c),a.props=i,a.state=c,a.context=r,i=l):(typeof a.componentDidMount=="function"&&(t.flags|=4194308),i=!1)}else{a=t.stateNode,zp(e,t),r=t.memoizedProps,h=Ba(n,r),a.props=h,p=t.pendingProps,u=a.context,c=n.contextType,l=br,typeof c=="object"&&c!==null&&(l=hn(c)),o=n.getDerivedStateFromProps,(c=typeof o=="function"||typeof a.getSnapshotBeforeUpdate=="function")||typeof a.UNSAFE_componentWillReceiveProps!="function"&&typeof a.componentWillReceiveProps!="function"||(r!==p||u!==l)&&nv(t,a,i,l),Us=!1,u=t.memoizedState,a.state=u,Yo(t,i,a,s),qo();var d=t.memoizedState;r!==p||u!==d||Us||e!==null&&e.dependencies!==null&&vu(e.dependencies)?(typeof o=="function"&&(Qd(t,n,o,i),d=t.memoizedState),(h=Us||ev(t,n,h,i,u,d,l)||e!==null&&e.dependencies!==null&&vu(e.dependencies))?(c||typeof a.UNSAFE_componentWillUpdate!="function"&&typeof a.componentWillUpdate!="function"||(typeof a.componentWillUpdate=="function"&&a.componentWillUpdate(i,d,l),typeof a.UNSAFE_componentWillUpdate=="function"&&a.UNSAFE_componentWillUpdate(i,d,l)),typeof a.componentDidUpdate=="function"&&(t.flags|=4),typeof a.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof a.componentDidUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=1024),t.memoizedProps=i,t.memoizedState=d),a.props=i,a.state=d,a.context=l,i=h):(typeof a.componentDidUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=1024),i=!1)}return a=i,su(e,t),i=(t.flags&128)!==0,a||i?(a=t.stateNode,n=i&&typeof n.getDerivedStateFromError!="function"?null:a.render(),t.flags|=1,e!==null&&i?(t.child=Pa(t,e.child,null,s),t.child=Pa(t,null,n,s)):ln(e,t,n,s),t.memoizedState=a.state,e=t.child):e=ds(e,t,s),e}function uv(e,t,n,i){return Ia(),t.flags|=256,ln(e,t,n,i),t.child}var $d={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function tp(e){return{baseLanes:e,cachePool:Iy()}}function ep(e,t,n){return e=e!==null?e.childLanes&~n:0,t&&(e|=Fn),e}function Ax(e,t,n){var i=t.pendingProps,s=!1,a=(t.flags&128)!==0,r;if((r=a)||(r=e!==null&&e.memoizedState===null?!1:(ke.current&2)!==0),r&&(s=!0,t.flags&=-129),r=(t.flags&32)!==0,t.flags&=-33,e===null){if(ee){if(s?Is(t):Os(t),(e=Ee)?(e=_b(e,li),e=e!==null&&e.data!=="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:js!==null?{id:Ui,overflow:Li}:null,retryLane:536870912,hydrationErrors:null},n=Dy(e),n.return=t,t.child=n,un=t,Ee=null)):e=null,e===null)throw Qs(t);return rm(e)?t.lanes=32:t.lanes=536870912,null}var o=i.children;return i=i.fallback,s?(Os(t),s=t.mode,o=Tu({mode:"hidden",children:o},s),i=Da(i,s,n,null),o.return=t,i.return=t,o.sibling=i,t.child=o,i=t.child,i.memoizedState=tp(n),i.childLanes=ep(e,r,n),t.memoizedState=$d,Fo(null,i)):(Is(t),Yp(t,o))}var l=e.memoizedState;if(l!==null&&(o=l.dehydrated,o!==null)){if(a)t.flags&256?(Is(t),t.flags&=-257,t=np(e,t,n)):t.memoizedState!==null?(Os(t),t.child=e.child,t.flags|=128,t=null):(Os(t),o=i.fallback,s=t.mode,i=Tu({mode:"visible",children:i.children},s),o=Da(o,s,n,null),o.flags|=2,i.return=t,o.return=t,i.sibling=o,t.child=i,Pa(t,e.child,null,n),i=t.child,i.memoizedState=tp(n),i.childLanes=ep(e,r,n),t.memoizedState=$d,t=Fo(null,i));else if(Is(t),rm(o)){if(r=o.nextSibling&&o.nextSibling.dataset,r)var c=r.dgst;r=c,i=Error(et(419)),i.stack="",i.digest=r,al({value:i,source:null,stack:null}),t=np(e,t,n)}else if(Ze||Wr(e,t,n,!1),r=(n&e.childLanes)!==0,Ze||r){if(r=ge,r!==null&&(i=ny(r,n),i!==0&&i!==l.retryLane))throw l.retryLane=i,Ga(e,i),Nn(r,e,i),Wm;am(o)||Ru(),t=np(e,t,n)}else am(o)?(t.flags|=192,t.child=e.child,t=null):(e=l.treeContext,Ee=ui(o.nextSibling),un=t,ee=!0,ks=null,li=!1,e!==null&&Uy(t,e),t=Yp(t,i.children),t.flags|=4096);return t}return s?(Os(t),o=i.fallback,s=t.mode,l=e.child,c=l.sibling,i=os(l,{mode:"hidden",children:i.children}),i.subtreeFlags=l.subtreeFlags&65011712,c!==null?o=os(c,o):(o=Da(o,s,n,null),o.flags|=2),o.return=t,i.return=t,i.sibling=o,t.child=i,Fo(null,i),i=t.child,o=e.child.memoizedState,o===null?o=tp(n):(s=o.cachePool,s!==null?(l=Ye._currentValue,s=s.parent!==l?{parent:l,pool:l}:s):s=Iy(),o={baseLanes:o.baseLanes|n,cachePool:s}),i.memoizedState=o,i.childLanes=ep(e,r,n),t.memoizedState=$d,Fo(e.child,i)):(Is(t),n=e.child,e=n.sibling,n=os(n,{mode:"visible",children:i.children}),n.return=t,n.sibling=null,e!==null&&(r=t.deletions,r===null?(t.deletions=[e],t.flags|=16):r.push(e)),t.child=n,t.memoizedState=null,n)}function Yp(e,t){return t=Tu({mode:"visible",children:t},e.mode),t.return=e,e.child=t}function Tu(e,t){return e=Bn(22,e,null,t),e.lanes=0,e}function np(e,t,n){return Pa(t,e.child,null,n),e=Yp(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function hv(e,t,n){e.lanes|=t;var i=e.alternate;i!==null&&(i.lanes|=t),Ip(e.return,t,n)}function ip(e,t,n,i,s,a){var r=e.memoizedState;r===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:i,tail:n,tailMode:s,treeForkCount:a}:(r.isBackwards=t,r.rendering=null,r.renderingStartTime=0,r.last=i,r.tail=n,r.tailMode=s,r.treeForkCount=a)}function wx(e,t,n){var i=t.pendingProps,s=i.revealOrder,a=i.tail;i=i.children;var r=ke.current,o=(r&2)!==0;if(o?(r=r&1|2,t.flags|=128):r&=1,ye(ke,r),ln(e,t,i,n),i=ee?sl:0,!o&&e!==null&&(e.flags&128)!==0)t:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&hv(e,n,t);else if(e.tag===19)hv(e,n,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break t;for(;e.sibling===null;){if(e.return===null||e.return===t)break t;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(s){case"forwards":for(n=t.child,s=null;n!==null;)e=n.alternate,e!==null&&bu(e)===null&&(s=n),n=n.sibling;n=s,n===null?(s=t.child,t.child=null):(s=n.sibling,n.sibling=null),ip(t,!1,s,n,a,i);break;case"backwards":case"unstable_legacy-backwards":for(n=null,s=t.child,t.child=null;s!==null;){if(e=s.alternate,e!==null&&bu(e)===null){t.child=s;break}e=s.sibling,s.sibling=n,n=s,s=e}ip(t,!0,n,null,a,i);break;case"together":ip(t,!1,null,null,void 0,i);break;default:t.memoizedState=null}return t.child}function ds(e,t,n){if(e!==null&&(t.dependencies=e.dependencies),ta|=t.lanes,(n&t.childLanes)===0)if(e!==null){if(Wr(e,t,n,!1),(n&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(et(153));if(t.child!==null){for(e=t.child,n=os(e,e.pendingProps),t.child=n,n.return=t;e.sibling!==null;)e=e.sibling,n=n.sibling=os(e,e.pendingProps),n.return=t;n.sibling=null}return t.child}function qm(e,t){return(e.lanes&t)!==0?!0:(e=e.dependencies,!!(e!==null&&vu(e)))}function IE(e,t,n){switch(t.tag){case 3:hu(t,t.stateNode.containerInfo),Ls(t,Ye,e.memoizedState.cache),Ia();break;case 27:case 5:bp(t);break;case 4:hu(t,t.stateNode.containerInfo);break;case 10:Ls(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,Vp(t),null;break;case 13:var i=t.memoizedState;if(i!==null)return i.dehydrated!==null?(Is(t),t.flags|=128,null):(n&t.child.childLanes)!==0?Ax(e,t,n):(Is(t),e=ds(e,t,n),e!==null?e.sibling:null);Is(t);break;case 19:var s=(e.flags&128)!==0;if(i=(n&t.childLanes)!==0,i||(Wr(e,t,n,!1),i=(n&t.childLanes)!==0),s){if(i)return wx(e,t,n);t.flags|=128}if(s=t.memoizedState,s!==null&&(s.rendering=null,s.tail=null,s.lastEffect=null),ye(ke,ke.current),i)break;return null;case 22:return t.lanes=0,Tx(e,t,n,t.pendingProps);case 24:Ls(t,Ye,e.memoizedState.cache)}return ds(e,t,n)}function Cx(e,t,n){if(e!==null)if(e.memoizedProps!==t.pendingProps)Ze=!0;else{if(!qm(e,n)&&(t.flags&128)===0)return Ze=!1,IE(e,t,n);Ze=(e.flags&131072)!==0}else Ze=!1,ee&&(t.flags&1048576)!==0&&Ny(t,sl,t.index);switch(t.lanes=0,t.tag){case 16:t:{var i=t.pendingProps;if(e=wa(t.elementType),t.type=e,typeof e=="function")Em(e)?(i=Ba(e,i),t.tag=1,t=cv(null,t,e,i,n)):(t.tag=0,t=qp(null,t,e,i,n));else{if(e!=null){var s=e.$$typeof;if(s===um){t.tag=11,t=sv(null,t,e,i,n);break t}else if(s===hm){t.tag=14,t=av(null,t,e,i,n);break t}}throw t=yp(e)||e,Error(et(306,t,""))}}return t;case 0:return qp(e,t,t.type,t.pendingProps,n);case 1:return i=t.type,s=Ba(i,t.pendingProps),cv(e,t,i,s,n);case 3:t:{if(hu(t,t.stateNode.containerInfo),e===null)throw Error(et(387));i=t.pendingProps;var a=t.memoizedState;s=a.element,zp(e,t),Yo(t,i,null,n);var r=t.memoizedState;if(i=r.cache,Ls(t,Ye,i),i!==a.cache&&Op(t,[Ye],n,!0),qo(),i=r.element,a.isDehydrated)if(a={element:i,isDehydrated:!1,cache:r.cache},t.updateQueue.baseState=a,t.memoizedState=a,t.flags&256){t=uv(e,t,i,n);break t}else if(i!==s){s=oi(Error(et(424)),t),al(s),t=uv(e,t,i,n);break t}else{switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName==="HTML"?e.ownerDocument.body:e}for(Ee=ui(e.firstChild),un=t,ee=!0,ks=null,li=!0,n=zy(t,null,i,n),t.child=n;n;)n.flags=n.flags&-3|4096,n=n.sibling}else{if(Ia(),i===s){t=ds(e,t,n);break t}ln(e,t,i,n)}t=t.child}return t;case 26:return su(e,t),e===null?(n=Lv(t.type,null,t.pendingProps,null))?t.memoizedState=n:ee||(n=t.type,e=t.pendingProps,i=Lu(Gs.current).createElement(n),i[cn]=t,i[Un]=e,fn(i,n,e),nn(i),t.stateNode=i):t.memoizedState=Lv(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return bp(t),e===null&&ee&&(i=t.stateNode=vb(t.type,t.pendingProps,Gs.current),un=t,li=!0,s=Ee,na(t.type)?(om=s,Ee=ui(i.firstChild)):Ee=s),ln(e,t,t.pendingProps.children,n),su(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&ee&&((s=i=Ee)&&(i=lT(i,t.type,t.pendingProps,li),i!==null?(t.stateNode=i,un=t,Ee=ui(i.firstChild),li=!1,s=!0):s=!1),s||Qs(t)),bp(t),s=t.type,a=t.pendingProps,r=e!==null?e.memoizedProps:null,i=a.children,im(s,a)?i=null:r!==null&&im(s,r)&&(t.flags|=32),t.memoizedState!==null&&(s=Lm(e,t,TE,null,null,n),hl._currentValue=s),su(e,t),ln(e,t,i,n),t.child;case 6:return e===null&&ee&&((e=n=Ee)&&(n=cT(n,t.pendingProps,li),n!==null?(t.stateNode=n,un=t,Ee=null,e=!0):e=!1),e||Qs(t)),null;case 13:return Ax(e,t,n);case 4:return hu(t,t.stateNode.containerInfo),i=t.pendingProps,e===null?t.child=Pa(t,null,i,n):ln(e,t,i,n),t.child;case 11:return sv(e,t,t.type,t.pendingProps,n);case 7:return ln(e,t,t.pendingProps,n),t.child;case 8:return ln(e,t,t.pendingProps.children,n),t.child;case 12:return ln(e,t,t.pendingProps.children,n),t.child;case 10:return i=t.pendingProps,Ls(t,t.type,i.value),ln(e,t,i.children,n),t.child;case 9:return s=t.type._context,i=t.pendingProps.children,Oa(t),s=hn(s),i=i(s),t.flags|=1,ln(e,t,i,n),t.child;case 14:return av(e,t,t.type,t.pendingProps,n);case 15:return Ex(e,t,t.type,t.pendingProps,n);case 19:return wx(e,t,n);case 31:return LE(e,t,n);case 22:return Tx(e,t,n,t.pendingProps);case 24:return Oa(t),i=hn(Ye),e===null?(s=Cm(),s===null&&(s=ge,a=wm(),s.pooledCache=a,a.refCount++,a!==null&&(s.pooledCacheLanes|=n),s=a),t.memoizedState={parent:i,cache:s},Dm(t),Ls(t,Ye,s)):((e.lanes&n)!==0&&(zp(e,t),Yo(t,null,null,n),qo()),s=e.memoizedState,a=t.memoizedState,s.parent!==i?(s={parent:i,cache:i},t.memoizedState=s,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=s),Ls(t,Ye,i)):(i=a.cache,Ls(t,Ye,i),i!==s.cache&&Op(t,[Ye],n,!0))),ln(e,t,t.pendingProps.children,n),t.child;case 29:throw t.pendingProps}throw Error(et(156,t.tag))}function Qi(e){e.flags|=4}function sp(e,t,n,i,s){if((t=(e.mode&32)!==0)&&(t=!1),t){if(e.flags|=16777216,(s&335544128)===s)if(e.stateNode.complete)e.flags|=8192;else if(Qx())e.flags|=8192;else throw Ua=yu,Rm}else e.flags&=-16777217}function fv(e,t){if(t.type!=="stylesheet"||(t.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!bb(t))if(Qx())e.flags|=8192;else throw Ua=yu,Rm}function Gc(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag!==22?$v():536870912,e.lanes|=t,Br|=t)}function Uo(e,t){if(!ee)switch(e.tailMode){case"hidden":t=e.tail;for(var n=null;t!==null;)t.alternate!==null&&(n=t),t=t.sibling;n===null?e.tail=null:n.sibling=null;break;case"collapsed":n=e.tail;for(var i=null;n!==null;)n.alternate!==null&&(i=n),n=n.sibling;i===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:i.sibling=null}}function Me(e){var t=e.alternate!==null&&e.alternate.child===e.child,n=0,i=0;if(t)for(var s=e.child;s!==null;)n|=s.lanes|s.childLanes,i|=s.subtreeFlags&65011712,i|=s.flags&65011712,s.return=e,s=s.sibling;else for(s=e.child;s!==null;)n|=s.lanes|s.childLanes,i|=s.subtreeFlags,i|=s.flags,s.return=e,s=s.sibling;return e.subtreeFlags|=i,e.childLanes=n,t}function OE(e,t,n){var i=t.pendingProps;switch(Am(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return Me(t),null;case 1:return Me(t),null;case 3:return n=t.stateNode,i=null,e!==null&&(i=e.memoizedState.cache),t.memoizedState.cache!==i&&(t.flags|=2048),ls(Ye),Ur(),n.pendingContext&&(n.context=n.pendingContext,n.pendingContext=null),(e===null||e.child===null)&&(cr(t)?Qi(t):e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,Jd())),Me(t),null;case 26:var s=t.type,a=t.memoizedState;return e===null?(Qi(t),a!==null?(Me(t),fv(t,a)):(Me(t),sp(t,s,null,i,n))):a?a!==e.memoizedState?(Qi(t),Me(t),fv(t,a)):(Me(t),t.flags&=-16777217):(e=e.memoizedProps,e!==i&&Qi(t),Me(t),sp(t,s,e,i,n)),null;case 27:if(fu(t),n=Gs.current,s=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&Qi(t);else{if(!i){if(t.stateNode===null)throw Error(et(166));return Me(t),null}e=Oi.current,cr(t)?H_(t,e):(e=vb(s,i,n),t.stateNode=e,Qi(t))}return Me(t),null;case 5:if(fu(t),s=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&Qi(t);else{if(!i){if(t.stateNode===null)throw Error(et(166));return Me(t),null}if(a=Oi.current,cr(t))H_(t,a);else{var r=Lu(Gs.current);switch(a){case 1:a=r.createElementNS("http://www.w3.org/2000/svg",s);break;case 2:a=r.createElementNS("http://www.w3.org/1998/Math/MathML",s);break;default:switch(s){case"svg":a=r.createElementNS("http://www.w3.org/2000/svg",s);break;case"math":a=r.createElementNS("http://www.w3.org/1998/Math/MathML",s);break;case"script":a=r.createElement("div"),a.innerHTML="<script><\/script>",a=a.removeChild(a.firstChild);break;case"select":a=typeof i.is=="string"?r.createElement("select",{is:i.is}):r.createElement("select"),i.multiple?a.multiple=!0:i.size&&(a.size=i.size);break;default:a=typeof i.is=="string"?r.createElement(s,{is:i.is}):r.createElement(s)}}a[cn]=t,a[Un]=i;t:for(r=t.child;r!==null;){if(r.tag===5||r.tag===6)a.appendChild(r.stateNode);else if(r.tag!==4&&r.tag!==27&&r.child!==null){r.child.return=r,r=r.child;continue}if(r===t)break t;for(;r.sibling===null;){if(r.return===null||r.return===t)break t;r=r.return}r.sibling.return=r.return,r=r.sibling}t.stateNode=a;t:switch(fn(a,s,i),s){case"button":case"input":case"select":case"textarea":i=!!i.autoFocus;break t;case"img":i=!0;break t;default:i=!1}i&&Qi(t)}}return Me(t),sp(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,n),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==i&&Qi(t);else{if(typeof i!="string"&&t.stateNode===null)throw Error(et(166));if(e=Gs.current,cr(t)){if(e=t.stateNode,n=t.memoizedProps,i=null,s=un,s!==null)switch(s.tag){case 27:case 5:i=s.memoizedProps}e[cn]=t,e=!!(e.nodeValue===n||i!==null&&i.suppressHydrationWarning===!0||pb(e.nodeValue,n)),e||Qs(t,!0)}else e=Lu(e).createTextNode(i),e[cn]=t,t.stateNode=e}return Me(t),null;case 31:if(n=t.memoizedState,e===null||e.memoizedState!==null){if(i=cr(t),n!==null){if(e===null){if(!i)throw Error(et(318));if(e=t.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(et(557));e[cn]=t}else Ia(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Me(t),e=!1}else n=Jd(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=n),e=!0;if(!e)return t.flags&256?(zn(t),t):(zn(t),null);if((t.flags&128)!==0)throw Error(et(558))}return Me(t),null;case 13:if(i=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(s=cr(t),i!==null&&i.dehydrated!==null){if(e===null){if(!s)throw Error(et(318));if(s=t.memoizedState,s=s!==null?s.dehydrated:null,!s)throw Error(et(317));s[cn]=t}else Ia(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Me(t),s=!1}else s=Jd(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=s),s=!0;if(!s)return t.flags&256?(zn(t),t):(zn(t),null)}return zn(t),(t.flags&128)!==0?(t.lanes=n,t):(n=i!==null,e=e!==null&&e.memoizedState!==null,n&&(i=t.child,s=null,i.alternate!==null&&i.alternate.memoizedState!==null&&i.alternate.memoizedState.cachePool!==null&&(s=i.alternate.memoizedState.cachePool.pool),a=null,i.memoizedState!==null&&i.memoizedState.cachePool!==null&&(a=i.memoizedState.cachePool.pool),a!==s&&(i.flags|=2048)),n!==e&&n&&(t.child.flags|=8192),Gc(t,t.updateQueue),Me(t),null);case 4:return Ur(),e===null&&$m(t.stateNode.containerInfo),Me(t),null;case 10:return ls(t.type),Me(t),null;case 19:if(sn(ke),i=t.memoizedState,i===null)return Me(t),null;if(s=(t.flags&128)!==0,a=i.rendering,a===null)if(s)Uo(i,!1);else{if(Fe!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(a=bu(e),a!==null){for(t.flags|=128,Uo(i,!1),e=a.updateQueue,t.updateQueue=e,Gc(t,e),t.subtreeFlags=0,e=n,n=t.child;n!==null;)Ry(n,e),n=n.sibling;return ye(ke,ke.current&1|2),ee&&ns(t,i.treeForkCount),t.child}e=e.sibling}i.tail!==null&&Vn()>wu&&(t.flags|=128,s=!0,Uo(i,!1),t.lanes=4194304)}else{if(!s)if(e=bu(a),e!==null){if(t.flags|=128,s=!0,e=e.updateQueue,t.updateQueue=e,Gc(t,e),Uo(i,!0),i.tail===null&&i.tailMode==="hidden"&&!a.alternate&&!ee)return Me(t),null}else 2*Vn()-i.renderingStartTime>wu&&n!==536870912&&(t.flags|=128,s=!0,Uo(i,!1),t.lanes=4194304);i.isBackwards?(a.sibling=t.child,t.child=a):(e=i.last,e!==null?e.sibling=a:t.child=a,i.last=a)}return i.tail!==null?(e=i.tail,i.rendering=e,i.tail=e.sibling,i.renderingStartTime=Vn(),e.sibling=null,n=ke.current,ye(ke,s?n&1|2:n&1),ee&&ns(t,i.treeForkCount),e):(Me(t),null);case 22:case 23:return zn(t),Nm(),i=t.memoizedState!==null,e!==null?e.memoizedState!==null!==i&&(t.flags|=8192):i&&(t.flags|=8192),i?(n&536870912)!==0&&(t.flags&128)===0&&(Me(t),t.subtreeFlags&6&&(t.flags|=8192)):Me(t),n=t.updateQueue,n!==null&&Gc(t,n.retryQueue),n=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),i=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(i=t.memoizedState.cachePool.pool),i!==n&&(t.flags|=2048),e!==null&&sn(Na),null;case 24:return n=null,e!==null&&(n=e.memoizedState.cache),t.memoizedState.cache!==n&&(t.flags|=2048),ls(Ye),Me(t),null;case 25:return null;case 30:return null}throw Error(et(156,t.tag))}function PE(e,t){switch(Am(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return ls(Ye),Ur(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return fu(t),null;case 31:if(t.memoizedState!==null){if(zn(t),t.alternate===null)throw Error(et(340));Ia()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(zn(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(et(340));Ia()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return sn(ke),null;case 4:return Ur(),null;case 10:return ls(t.type),null;case 22:case 23:return zn(t),Nm(),e!==null&&sn(Na),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return ls(Ye),null;case 25:return null;default:return null}}function Rx(e,t){switch(Am(t),t.tag){case 3:ls(Ye),Ur();break;case 26:case 27:case 5:fu(t);break;case 4:Ur();break;case 31:t.memoizedState!==null&&zn(t);break;case 13:zn(t);break;case 19:sn(ke);break;case 10:ls(t.type);break;case 22:case 23:zn(t),Nm(),e!==null&&sn(Na);break;case 24:ls(Ye)}}function Sl(e,t){try{var n=t.updateQueue,i=n!==null?n.lastEffect:null;if(i!==null){var s=i.next;n=s;do{if((n.tag&e)===e){i=void 0;var a=n.create,r=n.inst;i=a(),r.destroy=i}n=n.next}while(n!==s)}}catch(o){ce(t,t.return,o)}}function $s(e,t,n){try{var i=t.updateQueue,s=i!==null?i.lastEffect:null;if(s!==null){var a=s.next;i=a;do{if((i.tag&e)===e){var r=i.inst,o=r.destroy;if(o!==void 0){r.destroy=void 0,s=t;var l=n,c=o;try{c()}catch(h){ce(s,l,h)}}}i=i.next}while(i!==a)}}catch(h){ce(t,t.return,h)}}function Dx(e){var t=e.updateQueue;if(t!==null){var n=e.stateNode;try{Fy(t,n)}catch(i){ce(e,e.return,i)}}}function Nx(e,t,n){n.props=Ba(e.type,e.memoizedProps),n.state=e.memoizedState;try{n.componentWillUnmount()}catch(i){ce(e,t,i)}}function Jo(e,t){try{var n=e.ref;if(n!==null){switch(e.tag){case 26:case 27:case 5:var i=e.stateNode;break;case 30:i=e.stateNode;break;default:i=e.stateNode}typeof n=="function"?e.refCleanup=n(i):n.current=i}}catch(s){ce(e,t,s)}}function Ii(e,t){var n=e.ref,i=e.refCleanup;if(n!==null)if(typeof i=="function")try{i()}catch(s){ce(e,t,s)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof n=="function")try{n(null)}catch(s){ce(e,t,s)}else n.current=null}function Ux(e){var t=e.type,n=e.memoizedProps,i=e.stateNode;try{t:switch(t){case"button":case"input":case"select":case"textarea":n.autoFocus&&i.focus();break t;case"img":n.src?i.src=n.src:n.srcSet&&(i.srcset=n.srcSet)}}catch(s){ce(e,e.return,s)}}function ap(e,t,n){try{var i=e.stateNode;nT(i,e.type,n,t),i[Un]=t}catch(s){ce(e,e.return,s)}}function Lx(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&na(e.type)||e.tag===4}function rp(e){t:for(;;){for(;e.sibling===null;){if(e.return===null||Lx(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&na(e.type)||e.flags&2||e.child===null||e.tag===4)continue t;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function Zp(e,t,n){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?(n.nodeType===9?n.body:n.nodeName==="HTML"?n.ownerDocument.body:n).insertBefore(e,t):(t=n.nodeType===9?n.body:n.nodeName==="HTML"?n.ownerDocument.body:n,t.appendChild(e),n=n._reactRootContainer,n!=null||t.onclick!==null||(t.onclick=as));else if(i!==4&&(i===27&&na(e.type)&&(n=e.stateNode,t=null),e=e.child,e!==null))for(Zp(e,t,n),e=e.sibling;e!==null;)Zp(e,t,n),e=e.sibling}function Au(e,t,n){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?n.insertBefore(e,t):n.appendChild(e);else if(i!==4&&(i===27&&na(e.type)&&(n=e.stateNode),e=e.child,e!==null))for(Au(e,t,n),e=e.sibling;e!==null;)Au(e,t,n),e=e.sibling}function Ix(e){var t=e.stateNode,n=e.memoizedProps;try{for(var i=e.type,s=t.attributes;s.length;)t.removeAttributeNode(s[0]);fn(t,i,n),t[cn]=e,t[Un]=n}catch(a){ce(e,e.return,a)}}var is=!1,qe=!1,op=!1,dv=typeof WeakSet=="function"?WeakSet:Set,en=null;function zE(e,t){if(e=e.containerInfo,em=zu,e=by(e),bm(e)){if("selectionStart"in e)var n={start:e.selectionStart,end:e.selectionEnd};else t:{n=(n=e.ownerDocument)&&n.defaultView||window;var i=n.getSelection&&n.getSelection();if(i&&i.rangeCount!==0){n=i.anchorNode;var s=i.anchorOffset,a=i.focusNode;i=i.focusOffset;try{n.nodeType,a.nodeType}catch{n=null;break t}var r=0,o=-1,l=-1,c=0,h=0,p=e,u=null;e:for(;;){for(var d;p!==n||s!==0&&p.nodeType!==3||(o=r+s),p!==a||i!==0&&p.nodeType!==3||(l=r+i),p.nodeType===3&&(r+=p.nodeValue.length),(d=p.firstChild)!==null;)u=p,p=d;for(;;){if(p===e)break e;if(u===n&&++c===s&&(o=r),u===a&&++h===i&&(l=r),(d=p.nextSibling)!==null)break;p=u,u=p.parentNode}p=d}n=o===-1||l===-1?null:{start:o,end:l}}else n=null}n=n||{start:0,end:0}}else n=null;for(nm={focusedElem:e,selectionRange:n},zu=!1,en=t;en!==null;)if(t=en,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,en=e;else for(;en!==null;){switch(t=en,a=t.alternate,e=t.flags,t.tag){case 0:if((e&4)!==0&&(e=t.updateQueue,e=e!==null?e.events:null,e!==null))for(n=0;n<e.length;n++)s=e[n],s.ref.impl=s.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&a!==null){e=void 0,n=t,s=a.memoizedProps,a=a.memoizedState,i=n.stateNode;try{var g=Ba(n.type,s);e=i.getSnapshotBeforeUpdate(g,a),i.__reactInternalSnapshotBeforeUpdate=e}catch(S){ce(n,n.return,S)}}break;case 3:if((e&1024)!==0){if(e=t.stateNode.containerInfo,n=e.nodeType,n===9)sm(e);else if(n===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":sm(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error(et(163))}if(e=t.sibling,e!==null){e.return=t.return,en=e;break}en=t.return}}function Ox(e,t,n){var i=n.flags;switch(n.tag){case 0:case 11:case 15:ts(e,n),i&4&&Sl(5,n);break;case 1:if(ts(e,n),i&4)if(e=n.stateNode,t===null)try{e.componentDidMount()}catch(r){ce(n,n.return,r)}else{var s=Ba(n.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(s,t,e.__reactInternalSnapshotBeforeUpdate)}catch(r){ce(n,n.return,r)}}i&64&&Dx(n),i&512&&Jo(n,n.return);break;case 3:if(ts(e,n),i&64&&(e=n.updateQueue,e!==null)){if(t=null,n.child!==null)switch(n.child.tag){case 27:case 5:t=n.child.stateNode;break;case 1:t=n.child.stateNode}try{Fy(e,t)}catch(r){ce(n,n.return,r)}}break;case 27:t===null&&i&4&&Ix(n);case 26:case 5:ts(e,n),t===null&&i&4&&Ux(n),i&512&&Jo(n,n.return);break;case 12:ts(e,n);break;case 31:ts(e,n),i&4&&Bx(e,n);break;case 13:ts(e,n),i&4&&Fx(e,n),i&64&&(e=n.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(n=qE.bind(null,n),uT(e,n))));break;case 22:if(i=n.memoizedState!==null||is,!i){t=t!==null&&t.memoizedState!==null||qe,s=is;var a=qe;is=i,(qe=t)&&!a?es(e,n,(n.subtreeFlags&8772)!==0):ts(e,n),is=s,qe=a}break;case 30:break;default:ts(e,n)}}function Px(e){var t=e.alternate;t!==null&&(e.alternate=null,Px(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&mm(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var De=null,Rn=!1;function $i(e,t,n){for(n=n.child;n!==null;)zx(e,t,n),n=n.sibling}function zx(e,t,n){if(Hn&&typeof Hn.onCommitFiberUnmount=="function")try{Hn.onCommitFiberUnmount(ml,n)}catch{}switch(n.tag){case 26:qe||Ii(n,t),$i(e,t,n),n.memoizedState?n.memoizedState.count--:n.stateNode&&(n=n.stateNode,n.parentNode.removeChild(n));break;case 27:qe||Ii(n,t);var i=De,s=Rn;na(n.type)&&(De=n.stateNode,Rn=!1),$i(e,t,n),$o(n.stateNode),De=i,Rn=s;break;case 5:qe||Ii(n,t);case 6:if(i=De,s=Rn,De=null,$i(e,t,n),De=i,Rn=s,De!==null)if(Rn)try{(De.nodeType===9?De.body:De.nodeName==="HTML"?De.ownerDocument.body:De).removeChild(n.stateNode)}catch(a){ce(n,t,a)}else try{De.removeChild(n.stateNode)}catch(a){ce(n,t,a)}break;case 18:De!==null&&(Rn?(e=De,Cv(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,n.stateNode),Gr(e)):Cv(De,n.stateNode));break;case 4:i=De,s=Rn,De=n.stateNode.containerInfo,Rn=!0,$i(e,t,n),De=i,Rn=s;break;case 0:case 11:case 14:case 15:$s(2,n,t),qe||$s(4,n,t),$i(e,t,n);break;case 1:qe||(Ii(n,t),i=n.stateNode,typeof i.componentWillUnmount=="function"&&Nx(n,t,i)),$i(e,t,n);break;case 21:$i(e,t,n);break;case 22:qe=(i=qe)||n.memoizedState!==null,$i(e,t,n),qe=i;break;default:$i(e,t,n)}}function Bx(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Gr(e)}catch(n){ce(t,t.return,n)}}}function Fx(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Gr(e)}catch(n){ce(t,t.return,n)}}function BE(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new dv),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new dv),t;default:throw Error(et(435,e.tag))}}function kc(e,t){var n=BE(e);t.forEach(function(i){if(!n.has(i)){n.add(i);var s=YE.bind(null,e,i);i.then(s,s)}})}function wn(e,t){var n=t.deletions;if(n!==null)for(var i=0;i<n.length;i++){var s=n[i],a=e,r=t,o=r;t:for(;o!==null;){switch(o.tag){case 27:if(na(o.type)){De=o.stateNode,Rn=!1;break t}break;case 5:De=o.stateNode,Rn=!1;break t;case 3:case 4:De=o.stateNode.containerInfo,Rn=!0;break t}o=o.return}if(De===null)throw Error(et(160));zx(a,r,s),De=null,Rn=!1,a=s.alternate,a!==null&&(a.return=null),s.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)Vx(t,e),t=t.sibling}var _i=null;function Vx(e,t){var n=e.alternate,i=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:wn(t,e),Cn(e),i&4&&($s(3,e,e.return),Sl(3,e),$s(5,e,e.return));break;case 1:wn(t,e),Cn(e),i&512&&(qe||n===null||Ii(n,n.return)),i&64&&is&&(e=e.updateQueue,e!==null&&(i=e.callbacks,i!==null&&(n=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=n===null?i:n.concat(i))));break;case 26:var s=_i;if(wn(t,e),Cn(e),i&512&&(qe||n===null||Ii(n,n.return)),i&4){var a=n!==null?n.memoizedState:null;if(i=e.memoizedState,n===null)if(i===null)if(e.stateNode===null){t:{i=e.type,n=e.memoizedProps,s=s.ownerDocument||s;e:switch(i){case"title":a=s.getElementsByTagName("title")[0],(!a||a[vl]||a[cn]||a.namespaceURI==="http://www.w3.org/2000/svg"||a.hasAttribute("itemprop"))&&(a=s.createElement(i),s.head.insertBefore(a,s.querySelector("head > title"))),fn(a,i,n),a[cn]=e,nn(a),i=a;break t;case"link":var r=Ov("link","href",s).get(i+(n.href||""));if(r){for(var o=0;o<r.length;o++)if(a=r[o],a.getAttribute("href")===(n.href==null||n.href===""?null:n.href)&&a.getAttribute("rel")===(n.rel==null?null:n.rel)&&a.getAttribute("title")===(n.title==null?null:n.title)&&a.getAttribute("crossorigin")===(n.crossOrigin==null?null:n.crossOrigin)){r.splice(o,1);break e}}a=s.createElement(i),fn(a,i,n),s.head.appendChild(a);break;case"meta":if(r=Ov("meta","content",s).get(i+(n.content||""))){for(o=0;o<r.length;o++)if(a=r[o],a.getAttribute("content")===(n.content==null?null:""+n.content)&&a.getAttribute("name")===(n.name==null?null:n.name)&&a.getAttribute("property")===(n.property==null?null:n.property)&&a.getAttribute("http-equiv")===(n.httpEquiv==null?null:n.httpEquiv)&&a.getAttribute("charset")===(n.charSet==null?null:n.charSet)){r.splice(o,1);break e}}a=s.createElement(i),fn(a,i,n),s.head.appendChild(a);break;default:throw Error(et(468,i))}a[cn]=e,nn(a),i=a}e.stateNode=i}else Pv(s,e.type,e.stateNode);else e.stateNode=Iv(s,i,e.memoizedProps);else a!==i?(a===null?n.stateNode!==null&&(n=n.stateNode,n.parentNode.removeChild(n)):a.count--,i===null?Pv(s,e.type,e.stateNode):Iv(s,i,e.memoizedProps)):i===null&&e.stateNode!==null&&ap(e,e.memoizedProps,n.memoizedProps)}break;case 27:wn(t,e),Cn(e),i&512&&(qe||n===null||Ii(n,n.return)),n!==null&&i&4&&ap(e,e.memoizedProps,n.memoizedProps);break;case 5:if(wn(t,e),Cn(e),i&512&&(qe||n===null||Ii(n,n.return)),e.flags&32){s=e.stateNode;try{Ir(s,"")}catch(g){ce(e,e.return,g)}}i&4&&e.stateNode!=null&&(s=e.memoizedProps,ap(e,s,n!==null?n.memoizedProps:s)),i&1024&&(op=!0);break;case 6:if(wn(t,e),Cn(e),i&4){if(e.stateNode===null)throw Error(et(162));i=e.memoizedProps,n=e.stateNode;try{n.nodeValue=i}catch(g){ce(e,e.return,g)}}break;case 3:if(ou=null,s=_i,_i=Iu(t.containerInfo),wn(t,e),_i=s,Cn(e),i&4&&n!==null&&n.memoizedState.isDehydrated)try{Gr(t.containerInfo)}catch(g){ce(e,e.return,g)}op&&(op=!1,Hx(e));break;case 4:i=_i,_i=Iu(e.stateNode.containerInfo),wn(t,e),Cn(e),_i=i;break;case 12:wn(t,e),Cn(e);break;case 31:wn(t,e),Cn(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,kc(e,i)));break;case 13:wn(t,e),Cn(e),e.child.flags&8192&&e.memoizedState!==null!=(n!==null&&n.memoizedState!==null)&&(Ku=Vn()),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,kc(e,i)));break;case 22:s=e.memoizedState!==null;var l=n!==null&&n.memoizedState!==null,c=is,h=qe;if(is=c||s,qe=h||l,wn(t,e),qe=h,is=c,Cn(e),i&8192)t:for(t=e.stateNode,t._visibility=s?t._visibility&-2:t._visibility|1,s&&(n===null||l||is||qe||Ca(e)),n=null,t=e;;){if(t.tag===5||t.tag===26){if(n===null){l=n=t;try{if(a=l.stateNode,s)r=a.style,typeof r.setProperty=="function"?r.setProperty("display","none","important"):r.display="none";else{o=l.stateNode;var p=l.memoizedProps.style,u=p!=null&&p.hasOwnProperty("display")?p.display:null;o.style.display=u==null||typeof u=="boolean"?"":(""+u).trim()}}catch(g){ce(l,l.return,g)}}}else if(t.tag===6){if(n===null){l=t;try{l.stateNode.nodeValue=s?"":l.memoizedProps}catch(g){ce(l,l.return,g)}}}else if(t.tag===18){if(n===null){l=t;try{var d=l.stateNode;s?Rv(d,!0):Rv(l.stateNode,!1)}catch(g){ce(l,l.return,g)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break t;for(;t.sibling===null;){if(t.return===null||t.return===e)break t;n===t&&(n=null),t=t.return}n===t&&(n=null),t.sibling.return=t.return,t=t.sibling}i&4&&(i=e.updateQueue,i!==null&&(n=i.retryQueue,n!==null&&(i.retryQueue=null,kc(e,n))));break;case 19:wn(t,e),Cn(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,kc(e,i)));break;case 30:break;case 21:break;default:wn(t,e),Cn(e)}}function Cn(e){var t=e.flags;if(t&2){try{for(var n,i=e.return;i!==null;){if(Lx(i)){n=i;break}i=i.return}if(n==null)throw Error(et(160));switch(n.tag){case 27:var s=n.stateNode,a=rp(e);Au(e,a,s);break;case 5:var r=n.stateNode;n.flags&32&&(Ir(r,""),n.flags&=-33);var o=rp(e);Au(e,o,r);break;case 3:case 4:var l=n.stateNode.containerInfo,c=rp(e);Zp(e,c,l);break;default:throw Error(et(161))}}catch(h){ce(e,e.return,h)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function Hx(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;Hx(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function ts(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)Ox(e,t.alternate,t),t=t.sibling}function Ca(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:$s(4,t,t.return),Ca(t);break;case 1:Ii(t,t.return);var n=t.stateNode;typeof n.componentWillUnmount=="function"&&Nx(t,t.return,n),Ca(t);break;case 27:$o(t.stateNode);case 26:case 5:Ii(t,t.return),Ca(t);break;case 22:t.memoizedState===null&&Ca(t);break;case 30:Ca(t);break;default:Ca(t)}e=e.sibling}}function es(e,t,n){for(n=n&&(t.subtreeFlags&8772)!==0,t=t.child;t!==null;){var i=t.alternate,s=e,a=t,r=a.flags;switch(a.tag){case 0:case 11:case 15:es(s,a,n),Sl(4,a);break;case 1:if(es(s,a,n),i=a,s=i.stateNode,typeof s.componentDidMount=="function")try{s.componentDidMount()}catch(c){ce(i,i.return,c)}if(i=a,s=i.updateQueue,s!==null){var o=i.stateNode;try{var l=s.shared.hiddenCallbacks;if(l!==null)for(s.shared.hiddenCallbacks=null,s=0;s<l.length;s++)By(l[s],o)}catch(c){ce(i,i.return,c)}}n&&r&64&&Dx(a),Jo(a,a.return);break;case 27:Ix(a);case 26:case 5:es(s,a,n),n&&i===null&&r&4&&Ux(a),Jo(a,a.return);break;case 12:es(s,a,n);break;case 31:es(s,a,n),n&&r&4&&Bx(s,a);break;case 13:es(s,a,n),n&&r&4&&Fx(s,a);break;case 22:a.memoizedState===null&&es(s,a,n),Jo(a,a.return);break;case 30:break;default:es(s,a,n)}t=t.sibling}}function Ym(e,t){var n=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==n&&(e!=null&&e.refCount++,n!=null&&xl(n))}function Zm(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&xl(e))}function gi(e,t,n,i){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)Gx(e,t,n,i),t=t.sibling}function Gx(e,t,n,i){var s=t.flags;switch(t.tag){case 0:case 11:case 15:gi(e,t,n,i),s&2048&&Sl(9,t);break;case 1:gi(e,t,n,i);break;case 3:gi(e,t,n,i),s&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&xl(e)));break;case 12:if(s&2048){gi(e,t,n,i),e=t.stateNode;try{var a=t.memoizedProps,r=a.id,o=a.onPostCommit;typeof o=="function"&&o(r,t.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(l){ce(t,t.return,l)}}else gi(e,t,n,i);break;case 31:gi(e,t,n,i);break;case 13:gi(e,t,n,i);break;case 23:break;case 22:a=t.stateNode,r=t.alternate,t.memoizedState!==null?a._visibility&2?gi(e,t,n,i):Ko(e,t):a._visibility&2?gi(e,t,n,i):(a._visibility|=2,hr(e,t,n,i,(t.subtreeFlags&10256)!==0||!1)),s&2048&&Ym(r,t);break;case 24:gi(e,t,n,i),s&2048&&Zm(t.alternate,t);break;default:gi(e,t,n,i)}}function hr(e,t,n,i,s){for(s=s&&((t.subtreeFlags&10256)!==0||!1),t=t.child;t!==null;){var a=e,r=t,o=n,l=i,c=r.flags;switch(r.tag){case 0:case 11:case 15:hr(a,r,o,l,s),Sl(8,r);break;case 23:break;case 22:var h=r.stateNode;r.memoizedState!==null?h._visibility&2?hr(a,r,o,l,s):Ko(a,r):(h._visibility|=2,hr(a,r,o,l,s)),s&&c&2048&&Ym(r.alternate,r);break;case 24:hr(a,r,o,l,s),s&&c&2048&&Zm(r.alternate,r);break;default:hr(a,r,o,l,s)}t=t.sibling}}function Ko(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var n=e,i=t,s=i.flags;switch(i.tag){case 22:Ko(n,i),s&2048&&Ym(i.alternate,i);break;case 24:Ko(n,i),s&2048&&Zm(i.alternate,i);break;default:Ko(n,i)}t=t.sibling}}var Vo=8192;function ur(e,t,n){if(e.subtreeFlags&Vo)for(e=e.child;e!==null;)kx(e,t,n),e=e.sibling}function kx(e,t,n){switch(e.tag){case 26:ur(e,t,n),e.flags&Vo&&e.memoizedState!==null&&ST(n,_i,e.memoizedState,e.memoizedProps);break;case 5:ur(e,t,n);break;case 3:case 4:var i=_i;_i=Iu(e.stateNode.containerInfo),ur(e,t,n),_i=i;break;case 22:e.memoizedState===null&&(i=e.alternate,i!==null&&i.memoizedState!==null?(i=Vo,Vo=16777216,ur(e,t,n),Vo=i):ur(e,t,n));break;default:ur(e,t,n)}}function Xx(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function Lo(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var n=0;n<t.length;n++){var i=t[n];en=i,qx(i,e)}Xx(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)Wx(e),e=e.sibling}function Wx(e){switch(e.tag){case 0:case 11:case 15:Lo(e),e.flags&2048&&$s(9,e,e.return);break;case 3:Lo(e);break;case 12:Lo(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,au(e)):Lo(e);break;default:Lo(e)}}function au(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var n=0;n<t.length;n++){var i=t[n];en=i,qx(i,e)}Xx(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:$s(8,t,t.return),au(t);break;case 22:n=t.stateNode,n._visibility&2&&(n._visibility&=-3,au(t));break;default:au(t)}e=e.sibling}}function qx(e,t){for(;en!==null;){var n=en;switch(n.tag){case 0:case 11:case 15:$s(8,n,t);break;case 23:case 22:if(n.memoizedState!==null&&n.memoizedState.cachePool!==null){var i=n.memoizedState.cachePool.pool;i!=null&&i.refCount++}break;case 24:xl(n.memoizedState.cache)}if(i=n.child,i!==null)i.return=n,en=i;else t:for(n=e;en!==null;){i=en;var s=i.sibling,a=i.return;if(Px(i),i===n){en=null;break t}if(s!==null){s.return=a,en=s;break t}en=a}}}var FE={getCacheForType:function(e){var t=hn(Ye),n=t.data.get(e);return n===void 0&&(n=e(),t.data.set(e,n)),n},cacheSignal:function(){return hn(Ye).controller.signal}},VE=typeof WeakMap=="function"?WeakMap:Map,se=0,ge=null,Yt=null,jt=0,le=0,Pn=null,Fs=!1,Yr=!1,Jm=!1,ps=0,Fe=0,ta=0,La=0,Km=0,Fn=0,Br=0,jo=null,Dn=null,Jp=!1,Ku=0,Yx=0,wu=1/0,Cu=null,qs=null,Ke=0,Ys=null,Fr=null,cs=0,Kp=0,jp=null,Zx=null,Qo=0,Qp=null;function kn(){return(se&2)!==0&&jt!==0?jt&-jt:Pt.T!==null?Qm():iy()}function Jx(){if(Fn===0)if((jt&536870912)===0||ee){var e=Lc;Lc<<=1,(Lc&3932160)===0&&(Lc=262144),Fn=e}else Fn=536870912;return e=Wn.current,e!==null&&(e.flags|=32),Fn}function Nn(e,t,n){(e===ge&&(le===2||le===9)||e.cancelPendingCommit!==null)&&(Vr(e,0),Vs(e,jt,Fn,!1)),_l(e,n),((se&2)===0||e!==ge)&&(e===ge&&((se&2)===0&&(La|=n),Fe===4&&Vs(e,jt,Fn,!1)),zi(e))}function Kx(e,t,n){if((se&6)!==0)throw Error(et(327));var i=!n&&(t&127)===0&&(t&e.expiredLanes)===0||gl(e,t),s=i?kE(e,t):lp(e,t,!0),a=i;do{if(s===0){Yr&&!i&&Vs(e,t,0,!1);break}else{if(n=e.current.alternate,a&&!HE(n)){s=lp(e,t,!1),a=!1;continue}if(s===2){if(a=t,e.errorRecoveryDisabledLanes&a)var r=0;else r=e.pendingLanes&-536870913,r=r!==0?r:r&536870912?536870912:0;if(r!==0){t=r;t:{var o=e;s=jo;var l=o.current.memoizedState.isDehydrated;if(l&&(Vr(o,r).flags|=256),r=lp(o,r,!1),r!==2){if(Jm&&!l){o.errorRecoveryDisabledLanes|=a,La|=a,s=4;break t}a=Dn,Dn=s,a!==null&&(Dn===null?Dn=a:Dn.push.apply(Dn,a))}s=r}if(a=!1,s!==2)continue}}if(s===1){Vr(e,0),Vs(e,t,0,!0);break}t:{switch(i=e,a=s,a){case 0:case 1:throw Error(et(345));case 4:if((t&4194048)!==t)break;case 6:Vs(i,t,Fn,!Fs);break t;case 2:Dn=null;break;case 3:case 5:break;default:throw Error(et(329))}if((t&62914560)===t&&(s=Ku+300-Vn(),10<s)){if(Vs(i,t,Fn,!Fs),Fu(i,0,!0)!==0)break t;cs=t,i.timeoutHandle=gb(pv.bind(null,i,n,Dn,Cu,Jp,t,Fn,La,Br,Fs,a,"Throttled",-0,0),s);break t}pv(i,n,Dn,Cu,Jp,t,Fn,La,Br,Fs,a,null,-0,0)}}break}while(!0);zi(e)}function pv(e,t,n,i,s,a,r,o,l,c,h,p,u,d){if(e.timeoutHandle=-1,p=t.subtreeFlags,p&8192||(p&16785408)===16785408){p={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:as},kx(t,a,p);var g=(a&62914560)===a?Ku-Vn():(a&4194048)===a?Yx-Vn():0;if(g=MT(p,g),g!==null){cs=a,e.cancelPendingCommit=g(gv.bind(null,e,t,a,n,i,s,r,o,l,h,p,null,u,d)),Vs(e,a,r,!c);return}}gv(e,t,a,n,i,s,r,o,l)}function HE(e){for(var t=e;;){var n=t.tag;if((n===0||n===11||n===15)&&t.flags&16384&&(n=t.updateQueue,n!==null&&(n=n.stores,n!==null)))for(var i=0;i<n.length;i++){var s=n[i],a=s.getSnapshot;s=s.value;try{if(!Xn(a(),s))return!1}catch{return!1}}if(n=t.child,t.subtreeFlags&16384&&n!==null)n.return=t,t=n;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function Vs(e,t,n,i){t&=~Km,t&=~La,e.suspendedLanes|=t,e.pingedLanes&=~t,i&&(e.warmLanes|=t),i=e.expirationTimes;for(var s=t;0<s;){var a=31-Gn(s),r=1<<a;i[a]=-1,s&=~r}n!==0&&ty(e,n,t)}function ju(){return(se&6)===0?(Ml(0,!1),!1):!0}function jm(){if(Yt!==null){if(le===0)var e=Yt.return;else e=Yt,rs=ka=null,Pm(e),Rr=null,rl=0,e=Yt;for(;e!==null;)Rx(e.alternate,e),e=e.return;Yt=null}}function Vr(e,t){var n=e.timeoutHandle;n!==-1&&(e.timeoutHandle=-1,aT(n)),n=e.cancelPendingCommit,n!==null&&(e.cancelPendingCommit=null,n()),cs=0,jm(),ge=e,Yt=n=os(e.current,null),jt=t,le=0,Pn=null,Fs=!1,Yr=gl(e,t),Jm=!1,Br=Fn=Km=La=ta=Fe=0,Dn=jo=null,Jp=!1,(t&8)!==0&&(t|=t&32);var i=e.entangledLanes;if(i!==0)for(e=e.entanglements,i&=t;0<i;){var s=31-Gn(i),a=1<<s;t|=e[s],i&=~a}return ps=t,ku(),n}function jx(e,t){Gt=null,Pt.H=ll,t===qr||t===Wu?(t=q_(),le=3):t===Rm?(t=q_(),le=4):le=t===Wm?8:t!==null&&typeof t=="object"&&typeof t.then=="function"?6:1,Pn=t,Yt===null&&(Fe=1,Eu(e,oi(t,e.current)))}function Qx(){var e=Wn.current;return e===null?!0:(jt&4194048)===jt?ci===null:(jt&62914560)===jt||(jt&536870912)!==0?e===ci:!1}function $x(){var e=Pt.H;return Pt.H=ll,e===null?ll:e}function tb(){var e=Pt.A;return Pt.A=FE,e}function Ru(){Fe=4,Fs||(jt&4194048)!==jt&&Wn.current!==null||(Yr=!0),(ta&134217727)===0&&(La&134217727)===0||ge===null||Vs(ge,jt,Fn,!1)}function lp(e,t,n){var i=se;se|=2;var s=$x(),a=tb();(ge!==e||jt!==t)&&(Cu=null,Vr(e,t)),t=!1;var r=Fe;t:do try{if(le!==0&&Yt!==null){var o=Yt,l=Pn;switch(le){case 8:jm(),r=6;break t;case 3:case 2:case 9:case 6:Wn.current===null&&(t=!0);var c=le;if(le=0,Pn=null,Er(e,o,l,c),n&&Yr){r=0;break t}break;default:c=le,le=0,Pn=null,Er(e,o,l,c)}}GE(),r=Fe;break}catch(h){jx(e,h)}while(!0);return t&&e.shellSuspendCounter++,rs=ka=null,se=i,Pt.H=s,Pt.A=a,Yt===null&&(ge=null,jt=0,ku()),r}function GE(){for(;Yt!==null;)eb(Yt)}function kE(e,t){var n=se;se|=2;var i=$x(),s=tb();ge!==e||jt!==t?(Cu=null,wu=Vn()+500,Vr(e,t)):Yr=gl(e,t);t:do try{if(le!==0&&Yt!==null){t=Yt;var a=Pn;e:switch(le){case 1:le=0,Pn=null,Er(e,t,a,1);break;case 2:case 9:if(W_(a)){le=0,Pn=null,mv(t);break}t=function(){le!==2&&le!==9||ge!==e||(le=7),zi(e)},a.then(t,t);break t;case 3:le=7;break t;case 4:le=5;break t;case 7:W_(a)?(le=0,Pn=null,mv(t)):(le=0,Pn=null,Er(e,t,a,7));break;case 5:var r=null;switch(Yt.tag){case 26:r=Yt.memoizedState;case 5:case 27:var o=Yt;if(r?bb(r):o.stateNode.complete){le=0,Pn=null;var l=o.sibling;if(l!==null)Yt=l;else{var c=o.return;c!==null?(Yt=c,Qu(c)):Yt=null}break e}}le=0,Pn=null,Er(e,t,a,5);break;case 6:le=0,Pn=null,Er(e,t,a,6);break;case 8:jm(),Fe=6;break t;default:throw Error(et(462))}}XE();break}catch(h){jx(e,h)}while(!0);return rs=ka=null,Pt.H=i,Pt.A=s,se=n,Yt!==null?0:(ge=null,jt=0,ku(),Fe)}function XE(){for(;Yt!==null&&!d1();)eb(Yt)}function eb(e){var t=Cx(e.alternate,e,ps);e.memoizedProps=e.pendingProps,t===null?Qu(e):Yt=t}function mv(e){var t=e,n=t.alternate;switch(t.tag){case 15:case 0:t=lv(n,t,t.pendingProps,t.type,void 0,jt);break;case 11:t=lv(n,t,t.pendingProps,t.type.render,t.ref,jt);break;case 5:Pm(t);default:Rx(n,t),t=Yt=Ry(t,ps),t=Cx(n,t,ps)}e.memoizedProps=e.pendingProps,t===null?Qu(e):Yt=t}function Er(e,t,n,i){rs=ka=null,Pm(t),Rr=null,rl=0;var s=t.return;try{if(UE(e,s,t,n,jt)){Fe=1,Eu(e,oi(n,e.current)),Yt=null;return}}catch(a){if(s!==null)throw Yt=s,a;Fe=1,Eu(e,oi(n,e.current)),Yt=null;return}t.flags&32768?(ee||i===1?e=!0:Yr||(jt&536870912)!==0?e=!1:(Fs=e=!0,(i===2||i===9||i===3||i===6)&&(i=Wn.current,i!==null&&i.tag===13&&(i.flags|=16384))),nb(t,e)):Qu(t)}function Qu(e){var t=e;do{if((t.flags&32768)!==0){nb(t,Fs);return}e=t.return;var n=OE(t.alternate,t,ps);if(n!==null){Yt=n;return}if(t=t.sibling,t!==null){Yt=t;return}Yt=t=e}while(t!==null);Fe===0&&(Fe=5)}function nb(e,t){do{var n=PE(e.alternate,e);if(n!==null){n.flags&=32767,Yt=n;return}if(n=e.return,n!==null&&(n.flags|=32768,n.subtreeFlags=0,n.deletions=null),!t&&(e=e.sibling,e!==null)){Yt=e;return}Yt=e=n}while(e!==null);Fe=6,Yt=null}function gv(e,t,n,i,s,a,r,o,l){e.cancelPendingCommit=null;do $u();while(Ke!==0);if((se&6)!==0)throw Error(et(327));if(t!==null){if(t===e.current)throw Error(et(177));if(a=t.lanes|t.childLanes,a|=Sm,M1(e,n,a,r,o,l),e===ge&&(Yt=ge=null,jt=0),Fr=t,Ys=e,cs=n,Kp=a,jp=s,Zx=i,(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,ZE(du,function(){return ob(),null})):(e.callbackNode=null,e.callbackPriority=0),i=(t.flags&13878)!==0,(t.subtreeFlags&13878)!==0||i){i=Pt.T,Pt.T=null,s=ae.p,ae.p=2,r=se,se|=4;try{zE(e,t,n)}finally{se=r,ae.p=s,Pt.T=i}}Ke=1,ib(),sb(),ab()}}function ib(){if(Ke===1){Ke=0;var e=Ys,t=Fr,n=(t.flags&13878)!==0;if((t.subtreeFlags&13878)!==0||n){n=Pt.T,Pt.T=null;var i=ae.p;ae.p=2;var s=se;se|=4;try{Vx(t,e);var a=nm,r=by(e.containerInfo),o=a.focusedElem,l=a.selectionRange;if(r!==o&&o&&o.ownerDocument&&xy(o.ownerDocument.documentElement,o)){if(l!==null&&bm(o)){var c=l.start,h=l.end;if(h===void 0&&(h=c),"selectionStart"in o)o.selectionStart=c,o.selectionEnd=Math.min(h,o.value.length);else{var p=o.ownerDocument||document,u=p&&p.defaultView||window;if(u.getSelection){var d=u.getSelection(),g=o.textContent.length,S=Math.min(l.start,g),m=l.end===void 0?S:Math.min(l.end,g);!d.extend&&S>m&&(r=m,m=S,S=r);var f=B_(o,S),_=B_(o,m);if(f&&_&&(d.rangeCount!==1||d.anchorNode!==f.node||d.anchorOffset!==f.offset||d.focusNode!==_.node||d.focusOffset!==_.offset)){var b=p.createRange();b.setStart(f.node,f.offset),d.removeAllRanges(),S>m?(d.addRange(b),d.extend(_.node,_.offset)):(b.setEnd(_.node,_.offset),d.addRange(b))}}}}for(p=[],d=o;d=d.parentNode;)d.nodeType===1&&p.push({element:d,left:d.scrollLeft,top:d.scrollTop});for(typeof o.focus=="function"&&o.focus(),o=0;o<p.length;o++){var v=p[o];v.element.scrollLeft=v.left,v.element.scrollTop=v.top}}zu=!!em,nm=em=null}finally{se=s,ae.p=i,Pt.T=n}}e.current=t,Ke=2}}function sb(){if(Ke===2){Ke=0;var e=Ys,t=Fr,n=(t.flags&8772)!==0;if((t.subtreeFlags&8772)!==0||n){n=Pt.T,Pt.T=null;var i=ae.p;ae.p=2;var s=se;se|=4;try{Ox(e,t.alternate,t)}finally{se=s,ae.p=i,Pt.T=n}}Ke=3}}function ab(){if(Ke===4||Ke===3){Ke=0,p1();var e=Ys,t=Fr,n=cs,i=Zx;(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?Ke=5:(Ke=0,Fr=Ys=null,rb(e,e.pendingLanes));var s=e.pendingLanes;if(s===0&&(qs=null),pm(n),t=t.stateNode,Hn&&typeof Hn.onCommitFiberRoot=="function")try{Hn.onCommitFiberRoot(ml,t,void 0,(t.current.flags&128)===128)}catch{}if(i!==null){t=Pt.T,s=ae.p,ae.p=2,Pt.T=null;try{for(var a=e.onRecoverableError,r=0;r<i.length;r++){var o=i[r];a(o.value,{componentStack:o.stack})}}finally{Pt.T=t,ae.p=s}}(cs&3)!==0&&$u(),zi(e),s=e.pendingLanes,(n&261930)!==0&&(s&42)!==0?e===Qp?Qo++:(Qo=0,Qp=e):Qo=0,Ml(0,!1)}}function rb(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,xl(t)))}function $u(){return ib(),sb(),ab(),ob()}function ob(){if(Ke!==5)return!1;var e=Ys,t=Kp;Kp=0;var n=pm(cs),i=Pt.T,s=ae.p;try{ae.p=32>n?32:n,Pt.T=null,n=jp,jp=null;var a=Ys,r=cs;if(Ke=0,Fr=Ys=null,cs=0,(se&6)!==0)throw Error(et(331));var o=se;if(se|=4,Wx(a.current),Gx(a,a.current,r,n),se=o,Ml(0,!1),Hn&&typeof Hn.onPostCommitFiberRoot=="function")try{Hn.onPostCommitFiberRoot(ml,a)}catch{}return!0}finally{ae.p=s,Pt.T=i,rb(e,t)}}function _v(e,t,n){t=oi(n,t),t=Wp(e.stateNode,t,2),e=Ws(e,t,2),e!==null&&(_l(e,2),zi(e))}function ce(e,t,n){if(e.tag===3)_v(e,e,n);else for(;t!==null;){if(t.tag===3){_v(t,e,n);break}else if(t.tag===1){var i=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(qs===null||!qs.has(i))){e=oi(n,e),n=Sx(2),i=Ws(t,n,2),i!==null&&(Mx(n,i,t,e),_l(i,2),zi(i));break}}t=t.return}}function cp(e,t,n){var i=e.pingCache;if(i===null){i=e.pingCache=new VE;var s=new Set;i.set(t,s)}else s=i.get(t),s===void 0&&(s=new Set,i.set(t,s));s.has(n)||(Jm=!0,s.add(n),e=WE.bind(null,e,t,n),t.then(e,e))}function WE(e,t,n){var i=e.pingCache;i!==null&&i.delete(t),e.pingedLanes|=e.suspendedLanes&n,e.warmLanes&=~n,ge===e&&(jt&n)===n&&(Fe===4||Fe===3&&(jt&62914560)===jt&&300>Vn()-Ku?(se&2)===0&&Vr(e,0):Km|=n,Br===jt&&(Br=0)),zi(e)}function lb(e,t){t===0&&(t=$v()),e=Ga(e,t),e!==null&&(_l(e,t),zi(e))}function qE(e){var t=e.memoizedState,n=0;t!==null&&(n=t.retryLane),lb(e,n)}function YE(e,t){var n=0;switch(e.tag){case 31:case 13:var i=e.stateNode,s=e.memoizedState;s!==null&&(n=s.retryLane);break;case 19:i=e.stateNode;break;case 22:i=e.stateNode._retryCache;break;default:throw Error(et(314))}i!==null&&i.delete(t),lb(e,n)}function ZE(e,t){return fm(e,t)}var Du=null,fr=null,$p=!1,Nu=!1,up=!1,Hs=0;function zi(e){e!==fr&&e.next===null&&(fr===null?Du=fr=e:fr=fr.next=e),Nu=!0,$p||($p=!0,KE())}function Ml(e,t){if(!up&&Nu){up=!0;do for(var n=!1,i=Du;i!==null;){if(!t)if(e!==0){var s=i.pendingLanes;if(s===0)var a=0;else{var r=i.suspendedLanes,o=i.pingedLanes;a=(1<<31-Gn(42|e)+1)-1,a&=s&~(r&~o),a=a&201326741?a&201326741|1:a?a|2:0}a!==0&&(n=!0,vv(i,a))}else a=jt,a=Fu(i,i===ge?a:0,i.cancelPendingCommit!==null||i.timeoutHandle!==-1),(a&3)===0||gl(i,a)||(n=!0,vv(i,a));i=i.next}while(n);up=!1}}function JE(){cb()}function cb(){Nu=$p=!1;var e=0;Hs!==0&&sT()&&(e=Hs);for(var t=Vn(),n=null,i=Du;i!==null;){var s=i.next,a=ub(i,t);a===0?(i.next=null,n===null?Du=s:n.next=s,s===null&&(fr=n)):(n=i,(e!==0||(a&3)!==0)&&(Nu=!0)),i=s}Ke!==0&&Ke!==5||Ml(e,!1),Hs!==0&&(Hs=0)}function ub(e,t){for(var n=e.suspendedLanes,i=e.pingedLanes,s=e.expirationTimes,a=e.pendingLanes&-62914561;0<a;){var r=31-Gn(a),o=1<<r,l=s[r];l===-1?((o&n)===0||(o&i)!==0)&&(s[r]=S1(o,t)):l<=t&&(e.expiredLanes|=o),a&=~o}if(t=ge,n=jt,n=Fu(e,e===t?n:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i=e.callbackNode,n===0||e===t&&(le===2||le===9)||e.cancelPendingCommit!==null)return i!==null&&i!==null&&Fd(i),e.callbackNode=null,e.callbackPriority=0;if((n&3)===0||gl(e,n)){if(t=n&-n,t===e.callbackPriority)return t;switch(i!==null&&Fd(i),pm(n)){case 2:case 8:n=jv;break;case 32:n=du;break;case 268435456:n=Qv;break;default:n=du}return i=hb.bind(null,e),n=fm(n,i),e.callbackPriority=t,e.callbackNode=n,t}return i!==null&&i!==null&&Fd(i),e.callbackPriority=2,e.callbackNode=null,2}function hb(e,t){if(Ke!==0&&Ke!==5)return e.callbackNode=null,e.callbackPriority=0,null;var n=e.callbackNode;if($u()&&e.callbackNode!==n)return null;var i=jt;return i=Fu(e,e===ge?i:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i===0?null:(Kx(e,i,t),ub(e,Vn()),e.callbackNode!=null&&e.callbackNode===n?hb.bind(null,e):null)}function vv(e,t){if($u())return null;Kx(e,t,!0)}function KE(){rT(function(){(se&6)!==0?fm(Kv,JE):cb()})}function Qm(){if(Hs===0){var e=Or;e===0&&(e=Uc,Uc<<=1,(Uc&261888)===0&&(Uc=256)),Hs=e}return Hs}function yv(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:Kc(""+e)}function xv(e,t){var n=t.ownerDocument.createElement("input");return n.name=t.name,n.value=t.value,e.id&&n.setAttribute("form",e.id),t.parentNode.insertBefore(n,t),e=new FormData(e),n.parentNode.removeChild(n),e}function jE(e,t,n,i,s){if(t==="submit"&&n&&n.stateNode===s){var a=yv((s[Un]||null).action),r=i.submitter;r&&(t=(t=r[Un]||null)?yv(t.formAction):r.getAttribute("formAction"),t!==null&&(a=t,r=null));var o=new Vu("action","action",null,i,s);e.push({event:o,listeners:[{instance:null,listener:function(){if(i.defaultPrevented){if(Hs!==0){var l=r?xv(s,r):new FormData(s);kp(n,{pending:!0,data:l,method:s.method,action:a},null,l)}}else typeof a=="function"&&(o.preventDefault(),l=r?xv(s,r):new FormData(s),kp(n,{pending:!0,data:l,method:s.method,action:a},a,l))},currentTarget:s}]})}}for(Xc=0;Xc<Np.length;Xc++)Wc=Np[Xc],bv=Wc.toLowerCase(),Sv=Wc[0].toUpperCase()+Wc.slice(1),vi(bv,"on"+Sv);var Wc,bv,Sv,Xc;vi(My,"onAnimationEnd");vi(Ey,"onAnimationIteration");vi(Ty,"onAnimationStart");vi("dblclick","onDoubleClick");vi("focusin","onFocus");vi("focusout","onBlur");vi(mE,"onTransitionRun");vi(gE,"onTransitionStart");vi(_E,"onTransitionCancel");vi(Ay,"onTransitionEnd");Lr("onMouseEnter",["mouseout","mouseover"]);Lr("onMouseLeave",["mouseout","mouseover"]);Lr("onPointerEnter",["pointerout","pointerover"]);Lr("onPointerLeave",["pointerout","pointerover"]);Fa("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));Fa("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));Fa("onBeforeInput",["compositionend","keypress","textInput","paste"]);Fa("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));Fa("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));Fa("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var cl="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),QE=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(cl));function fb(e,t){t=(t&4)!==0;for(var n=0;n<e.length;n++){var i=e[n],s=i.event;i=i.listeners;t:{var a=void 0;if(t)for(var r=i.length-1;0<=r;r--){var o=i[r],l=o.instance,c=o.currentTarget;if(o=o.listener,l!==a&&s.isPropagationStopped())break t;a=o,s.currentTarget=c;try{a(s)}catch(h){mu(h)}s.currentTarget=null,a=l}else for(r=0;r<i.length;r++){if(o=i[r],l=o.instance,c=o.currentTarget,o=o.listener,l!==a&&s.isPropagationStopped())break t;a=o,s.currentTarget=c;try{a(s)}catch(h){mu(h)}s.currentTarget=null,a=l}}}}function qt(e,t){var n=t[Mp];n===void 0&&(n=t[Mp]=new Set);var i=e+"__bubble";n.has(i)||(db(t,e,2,!1),n.add(i))}function hp(e,t,n){var i=0;t&&(i|=4),db(n,e,i,t)}var qc="_reactListening"+Math.random().toString(36).slice(2);function $m(e){if(!e[qc]){e[qc]=!0,sy.forEach(function(n){n!=="selectionchange"&&(QE.has(n)||hp(n,!1,e),hp(n,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[qc]||(t[qc]=!0,hp("selectionchange",!1,t))}}function db(e,t,n,i){switch(Ab(t)){case 2:var s=AT;break;case 8:s=wT;break;default:s=ig}n=s.bind(null,t,n,e),s=void 0,!Cp||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(s=!0),i?s!==void 0?e.addEventListener(t,n,{capture:!0,passive:s}):e.addEventListener(t,n,!0):s!==void 0?e.addEventListener(t,n,{passive:s}):e.addEventListener(t,n,!1)}function fp(e,t,n,i,s){var a=i;if((t&1)===0&&(t&2)===0&&i!==null)t:for(;;){if(i===null)return;var r=i.tag;if(r===3||r===4){var o=i.stateNode.containerInfo;if(o===s)break;if(r===4)for(r=i.return;r!==null;){var l=r.tag;if((l===3||l===4)&&r.stateNode.containerInfo===s)return;r=r.return}for(;o!==null;){if(r=mr(o),r===null)return;if(l=r.tag,l===5||l===6||l===26||l===27){i=a=r;continue t}o=o.parentNode}}i=i.return}fy(function(){var c=a,h=_m(n),p=[];t:{var u=wy.get(e);if(u!==void 0){var d=Vu,g=e;switch(e){case"keypress":if(Qc(n)===0)break t;case"keydown":case"keyup":d=Y1;break;case"focusin":g="focus",d=Xd;break;case"focusout":g="blur",d=Xd;break;case"beforeblur":case"afterblur":d=Xd;break;case"click":if(n.button===2)break t;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":d=R_;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":d=O1;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":d=K1;break;case My:case Ey:case Ty:d=B1;break;case Ay:d=Q1;break;case"scroll":case"scrollend":d=L1;break;case"wheel":d=tE;break;case"copy":case"cut":case"paste":d=V1;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":d=N_;break;case"toggle":case"beforetoggle":d=nE}var S=(t&4)!==0,m=!S&&(e==="scroll"||e==="scrollend"),f=S?u!==null?u+"Capture":null:u;S=[];for(var _=c,b;_!==null;){var v=_;if(b=v.stateNode,v=v.tag,v!==5&&v!==26&&v!==27||b===null||f===null||(v=el(_,f),v!=null&&S.push(ul(_,v,b))),m)break;_=_.return}0<S.length&&(u=new d(u,g,null,n,h),p.push({event:u,listeners:S}))}}if((t&7)===0){t:{if(u=e==="mouseover"||e==="pointerover",d=e==="mouseout"||e==="pointerout",u&&n!==wp&&(g=n.relatedTarget||n.fromElement)&&(mr(g)||g[kr]))break t;if((d||u)&&(u=h.window===h?h:(u=h.ownerDocument)?u.defaultView||u.parentWindow:window,d?(g=n.relatedTarget||n.toElement,d=c,g=g?mr(g):null,g!==null&&(m=pl(g),S=g.tag,g!==m||S!==5&&S!==27&&S!==6)&&(g=null)):(d=null,g=c),d!==g)){if(S=R_,v="onMouseLeave",f="onMouseEnter",_="mouse",(e==="pointerout"||e==="pointerover")&&(S=N_,v="onPointerLeave",f="onPointerEnter",_="pointer"),m=d==null?u:Bo(d),b=g==null?u:Bo(g),u=new S(v,_+"leave",d,n,h),u.target=m,u.relatedTarget=b,v=null,mr(h)===c&&(S=new S(f,_+"enter",g,n,h),S.target=b,S.relatedTarget=m,v=S),m=v,d&&g)e:{for(S=$E,f=d,_=g,b=0,v=f;v;v=S(v))b++;v=0;for(var T=_;T;T=S(T))v++;for(;0<b-v;)f=S(f),b--;for(;0<v-b;)_=S(_),v--;for(;b--;){if(f===_||_!==null&&f===_.alternate){S=f;break e}f=S(f),_=S(_)}S=null}else S=null;d!==null&&Mv(p,u,d,S,!1),g!==null&&m!==null&&Mv(p,m,g,S,!0)}}t:{if(u=c?Bo(c):window,d=u.nodeName&&u.nodeName.toLowerCase(),d==="select"||d==="input"&&u.type==="file")var A=O_;else if(I_(u))if(vy)A=fE;else{A=uE;var w=cE}else d=u.nodeName,!d||d.toLowerCase()!=="input"||u.type!=="checkbox"&&u.type!=="radio"?c&&gm(c.elementType)&&(A=O_):A=hE;if(A&&(A=A(e,c))){_y(p,A,n,h);break t}w&&w(e,u,c),e==="focusout"&&c&&u.type==="number"&&c.memoizedProps.value!=null&&Ap(u,"number",u.value)}switch(w=c?Bo(c):window,e){case"focusin":(I_(w)||w.contentEditable==="true")&&(vr=w,Rp=c,ko=null);break;case"focusout":ko=Rp=vr=null;break;case"mousedown":Dp=!0;break;case"contextmenu":case"mouseup":case"dragend":Dp=!1,F_(p,n,h);break;case"selectionchange":if(pE)break;case"keydown":case"keyup":F_(p,n,h)}var y;if(xm)t:{switch(e){case"compositionstart":var M="onCompositionStart";break t;case"compositionend":M="onCompositionEnd";break t;case"compositionupdate":M="onCompositionUpdate";break t}M=void 0}else _r?my(e,n)&&(M="onCompositionEnd"):e==="keydown"&&n.keyCode===229&&(M="onCompositionStart");M&&(py&&n.locale!=="ko"&&(_r||M!=="onCompositionStart"?M==="onCompositionEnd"&&_r&&(y=dy()):(Bs=h,vm="value"in Bs?Bs.value:Bs.textContent,_r=!0)),w=Uu(c,M),0<w.length&&(M=new D_(M,e,null,n,h),p.push({event:M,listeners:w}),y?M.data=y:(y=gy(n),y!==null&&(M.data=y)))),(y=sE?aE(e,n):rE(e,n))&&(M=Uu(c,"onBeforeInput"),0<M.length&&(w=new D_("onBeforeInput","beforeinput",null,n,h),p.push({event:w,listeners:M}),w.data=y)),jE(p,e,c,n,h)}fb(p,t)})}function ul(e,t,n){return{instance:e,listener:t,currentTarget:n}}function Uu(e,t){for(var n=t+"Capture",i=[];e!==null;){var s=e,a=s.stateNode;if(s=s.tag,s!==5&&s!==26&&s!==27||a===null||(s=el(e,n),s!=null&&i.unshift(ul(e,s,a)),s=el(e,t),s!=null&&i.push(ul(e,s,a))),e.tag===3)return i;e=e.return}return[]}function $E(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function Mv(e,t,n,i,s){for(var a=t._reactName,r=[];n!==null&&n!==i;){var o=n,l=o.alternate,c=o.stateNode;if(o=o.tag,l!==null&&l===i)break;o!==5&&o!==26&&o!==27||c===null||(l=c,s?(c=el(n,a),c!=null&&r.unshift(ul(n,c,l))):s||(c=el(n,a),c!=null&&r.push(ul(n,c,l)))),n=n.return}r.length!==0&&e.push({event:t,listeners:r})}var tT=/\r\n?/g,eT=/\u0000|\uFFFD/g;function Ev(e){return(typeof e=="string"?e:""+e).replace(tT,`
`).replace(eT,"")}function pb(e,t){return t=Ev(t),Ev(e)===t}function fe(e,t,n,i,s,a){switch(n){case"children":typeof i=="string"?t==="body"||t==="textarea"&&i===""||Ir(e,i):(typeof i=="number"||typeof i=="bigint")&&t!=="body"&&Ir(e,""+i);break;case"className":Oc(e,"class",i);break;case"tabIndex":Oc(e,"tabindex",i);break;case"dir":case"role":case"viewBox":case"width":case"height":Oc(e,n,i);break;case"style":hy(e,i,a);break;case"data":if(t!=="object"){Oc(e,"data",i);break}case"src":case"href":if(i===""&&(t!=="a"||n!=="href")){e.removeAttribute(n);break}if(i==null||typeof i=="function"||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(n);break}i=Kc(""+i),e.setAttribute(n,i);break;case"action":case"formAction":if(typeof i=="function"){e.setAttribute(n,"javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");break}else typeof a=="function"&&(n==="formAction"?(t!=="input"&&fe(e,t,"name",s.name,s,null),fe(e,t,"formEncType",s.formEncType,s,null),fe(e,t,"formMethod",s.formMethod,s,null),fe(e,t,"formTarget",s.formTarget,s,null)):(fe(e,t,"encType",s.encType,s,null),fe(e,t,"method",s.method,s,null),fe(e,t,"target",s.target,s,null)));if(i==null||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(n);break}i=Kc(""+i),e.setAttribute(n,i);break;case"onClick":i!=null&&(e.onclick=as);break;case"onScroll":i!=null&&qt("scroll",e);break;case"onScrollEnd":i!=null&&qt("scrollend",e);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(et(61));if(n=i.__html,n!=null){if(s.children!=null)throw Error(et(60));e.innerHTML=n}}break;case"multiple":e.multiple=i&&typeof i!="function"&&typeof i!="symbol";break;case"muted":e.muted=i&&typeof i!="function"&&typeof i!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(i==null||typeof i=="function"||typeof i=="boolean"||typeof i=="symbol"){e.removeAttribute("xlink:href");break}n=Kc(""+i),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",n);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,""+i):e.removeAttribute(n);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":i&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,""):e.removeAttribute(n);break;case"capture":case"download":i===!0?e.setAttribute(n,""):i!==!1&&i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,i):e.removeAttribute(n);break;case"cols":case"rows":case"size":case"span":i!=null&&typeof i!="function"&&typeof i!="symbol"&&!isNaN(i)&&1<=i?e.setAttribute(n,i):e.removeAttribute(n);break;case"rowSpan":case"start":i==null||typeof i=="function"||typeof i=="symbol"||isNaN(i)?e.removeAttribute(n):e.setAttribute(n,i);break;case"popover":qt("beforetoggle",e),qt("toggle",e),Jc(e,"popover",i);break;case"xlinkActuate":ji(e,"http://www.w3.org/1999/xlink","xlink:actuate",i);break;case"xlinkArcrole":ji(e,"http://www.w3.org/1999/xlink","xlink:arcrole",i);break;case"xlinkRole":ji(e,"http://www.w3.org/1999/xlink","xlink:role",i);break;case"xlinkShow":ji(e,"http://www.w3.org/1999/xlink","xlink:show",i);break;case"xlinkTitle":ji(e,"http://www.w3.org/1999/xlink","xlink:title",i);break;case"xlinkType":ji(e,"http://www.w3.org/1999/xlink","xlink:type",i);break;case"xmlBase":ji(e,"http://www.w3.org/XML/1998/namespace","xml:base",i);break;case"xmlLang":ji(e,"http://www.w3.org/XML/1998/namespace","xml:lang",i);break;case"xmlSpace":ji(e,"http://www.w3.org/XML/1998/namespace","xml:space",i);break;case"is":Jc(e,"is",i);break;case"innerText":case"textContent":break;default:(!(2<n.length)||n[0]!=="o"&&n[0]!=="O"||n[1]!=="n"&&n[1]!=="N")&&(n=N1.get(n)||n,Jc(e,n,i))}}function tm(e,t,n,i,s,a){switch(n){case"style":hy(e,i,a);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(et(61));if(n=i.__html,n!=null){if(s.children!=null)throw Error(et(60));e.innerHTML=n}}break;case"children":typeof i=="string"?Ir(e,i):(typeof i=="number"||typeof i=="bigint")&&Ir(e,""+i);break;case"onScroll":i!=null&&qt("scroll",e);break;case"onScrollEnd":i!=null&&qt("scrollend",e);break;case"onClick":i!=null&&(e.onclick=as);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!ay.hasOwnProperty(n))t:{if(n[0]==="o"&&n[1]==="n"&&(s=n.endsWith("Capture"),t=n.slice(2,s?n.length-7:void 0),a=e[Un]||null,a=a!=null?a[n]:null,typeof a=="function"&&e.removeEventListener(t,a,s),typeof i=="function")){typeof a!="function"&&a!==null&&(n in e?e[n]=null:e.hasAttribute(n)&&e.removeAttribute(n)),e.addEventListener(t,i,s);break t}n in e?e[n]=i:i===!0?e.setAttribute(n,""):Jc(e,n,i)}}}function fn(e,t,n){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":qt("error",e),qt("load",e);var i=!1,s=!1,a;for(a in n)if(n.hasOwnProperty(a)){var r=n[a];if(r!=null)switch(a){case"src":i=!0;break;case"srcSet":s=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error(et(137,t));default:fe(e,t,a,r,n,null)}}s&&fe(e,t,"srcSet",n.srcSet,n,null),i&&fe(e,t,"src",n.src,n,null);return;case"input":qt("invalid",e);var o=a=r=s=null,l=null,c=null;for(i in n)if(n.hasOwnProperty(i)){var h=n[i];if(h!=null)switch(i){case"name":s=h;break;case"type":r=h;break;case"checked":l=h;break;case"defaultChecked":c=h;break;case"value":a=h;break;case"defaultValue":o=h;break;case"children":case"dangerouslySetInnerHTML":if(h!=null)throw Error(et(137,t));break;default:fe(e,t,i,h,n,null)}}ly(e,a,o,l,c,r,s,!1);return;case"select":qt("invalid",e),i=r=a=null;for(s in n)if(n.hasOwnProperty(s)&&(o=n[s],o!=null))switch(s){case"value":a=o;break;case"defaultValue":r=o;break;case"multiple":i=o;default:fe(e,t,s,o,n,null)}t=a,n=r,e.multiple=!!i,t!=null?Ar(e,!!i,t,!1):n!=null&&Ar(e,!!i,n,!0);return;case"textarea":qt("invalid",e),a=s=i=null;for(r in n)if(n.hasOwnProperty(r)&&(o=n[r],o!=null))switch(r){case"value":i=o;break;case"defaultValue":s=o;break;case"children":a=o;break;case"dangerouslySetInnerHTML":if(o!=null)throw Error(et(91));break;default:fe(e,t,r,o,n,null)}uy(e,i,s,a);return;case"option":for(l in n)if(n.hasOwnProperty(l)&&(i=n[l],i!=null))switch(l){case"selected":e.selected=i&&typeof i!="function"&&typeof i!="symbol";break;default:fe(e,t,l,i,n,null)}return;case"dialog":qt("beforetoggle",e),qt("toggle",e),qt("cancel",e),qt("close",e);break;case"iframe":case"object":qt("load",e);break;case"video":case"audio":for(i=0;i<cl.length;i++)qt(cl[i],e);break;case"image":qt("error",e),qt("load",e);break;case"details":qt("toggle",e);break;case"embed":case"source":case"link":qt("error",e),qt("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(c in n)if(n.hasOwnProperty(c)&&(i=n[c],i!=null))switch(c){case"children":case"dangerouslySetInnerHTML":throw Error(et(137,t));default:fe(e,t,c,i,n,null)}return;default:if(gm(t)){for(h in n)n.hasOwnProperty(h)&&(i=n[h],i!==void 0&&tm(e,t,h,i,n,void 0));return}}for(o in n)n.hasOwnProperty(o)&&(i=n[o],i!=null&&fe(e,t,o,i,n,null))}function nT(e,t,n,i){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var s=null,a=null,r=null,o=null,l=null,c=null,h=null;for(d in n){var p=n[d];if(n.hasOwnProperty(d)&&p!=null)switch(d){case"checked":break;case"value":break;case"defaultValue":l=p;default:i.hasOwnProperty(d)||fe(e,t,d,null,i,p)}}for(var u in i){var d=i[u];if(p=n[u],i.hasOwnProperty(u)&&(d!=null||p!=null))switch(u){case"type":a=d;break;case"name":s=d;break;case"checked":c=d;break;case"defaultChecked":h=d;break;case"value":r=d;break;case"defaultValue":o=d;break;case"children":case"dangerouslySetInnerHTML":if(d!=null)throw Error(et(137,t));break;default:d!==p&&fe(e,t,u,d,i,p)}}Tp(e,r,o,l,c,h,a,s);return;case"select":d=r=o=u=null;for(a in n)if(l=n[a],n.hasOwnProperty(a)&&l!=null)switch(a){case"value":break;case"multiple":d=l;default:i.hasOwnProperty(a)||fe(e,t,a,null,i,l)}for(s in i)if(a=i[s],l=n[s],i.hasOwnProperty(s)&&(a!=null||l!=null))switch(s){case"value":u=a;break;case"defaultValue":o=a;break;case"multiple":r=a;default:a!==l&&fe(e,t,s,a,i,l)}t=o,n=r,i=d,u!=null?Ar(e,!!n,u,!1):!!i!=!!n&&(t!=null?Ar(e,!!n,t,!0):Ar(e,!!n,n?[]:"",!1));return;case"textarea":d=u=null;for(o in n)if(s=n[o],n.hasOwnProperty(o)&&s!=null&&!i.hasOwnProperty(o))switch(o){case"value":break;case"children":break;default:fe(e,t,o,null,i,s)}for(r in i)if(s=i[r],a=n[r],i.hasOwnProperty(r)&&(s!=null||a!=null))switch(r){case"value":u=s;break;case"defaultValue":d=s;break;case"children":break;case"dangerouslySetInnerHTML":if(s!=null)throw Error(et(91));break;default:s!==a&&fe(e,t,r,s,i,a)}cy(e,u,d);return;case"option":for(var g in n)if(u=n[g],n.hasOwnProperty(g)&&u!=null&&!i.hasOwnProperty(g))switch(g){case"selected":e.selected=!1;break;default:fe(e,t,g,null,i,u)}for(l in i)if(u=i[l],d=n[l],i.hasOwnProperty(l)&&u!==d&&(u!=null||d!=null))switch(l){case"selected":e.selected=u&&typeof u!="function"&&typeof u!="symbol";break;default:fe(e,t,l,u,i,d)}return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var S in n)u=n[S],n.hasOwnProperty(S)&&u!=null&&!i.hasOwnProperty(S)&&fe(e,t,S,null,i,u);for(c in i)if(u=i[c],d=n[c],i.hasOwnProperty(c)&&u!==d&&(u!=null||d!=null))switch(c){case"children":case"dangerouslySetInnerHTML":if(u!=null)throw Error(et(137,t));break;default:fe(e,t,c,u,i,d)}return;default:if(gm(t)){for(var m in n)u=n[m],n.hasOwnProperty(m)&&u!==void 0&&!i.hasOwnProperty(m)&&tm(e,t,m,void 0,i,u);for(h in i)u=i[h],d=n[h],!i.hasOwnProperty(h)||u===d||u===void 0&&d===void 0||tm(e,t,h,u,i,d);return}}for(var f in n)u=n[f],n.hasOwnProperty(f)&&u!=null&&!i.hasOwnProperty(f)&&fe(e,t,f,null,i,u);for(p in i)u=i[p],d=n[p],!i.hasOwnProperty(p)||u===d||u==null&&d==null||fe(e,t,p,u,i,d)}function Tv(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function iT(){if(typeof performance.getEntriesByType=="function"){for(var e=0,t=0,n=performance.getEntriesByType("resource"),i=0;i<n.length;i++){var s=n[i],a=s.transferSize,r=s.initiatorType,o=s.duration;if(a&&o&&Tv(r)){for(r=0,o=s.responseEnd,i+=1;i<n.length;i++){var l=n[i],c=l.startTime;if(c>o)break;var h=l.transferSize,p=l.initiatorType;h&&Tv(p)&&(l=l.responseEnd,r+=h*(l<o?1:(o-c)/(l-c)))}if(--i,t+=8*(a+r)/(s.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var em=null,nm=null;function Lu(e){return e.nodeType===9?e:e.ownerDocument}function Av(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function mb(e,t){if(e===0)switch(t){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&t==="foreignObject"?0:e}function im(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.children=="bigint"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var dp=null;function sT(){var e=window.event;return e&&e.type==="popstate"?e===dp?!1:(dp=e,!0):(dp=null,!1)}var gb=typeof setTimeout=="function"?setTimeout:void 0,aT=typeof clearTimeout=="function"?clearTimeout:void 0,wv=typeof Promise=="function"?Promise:void 0,rT=typeof queueMicrotask=="function"?queueMicrotask:typeof wv<"u"?function(e){return wv.resolve(null).then(e).catch(oT)}:gb;function oT(e){setTimeout(function(){throw e})}function na(e){return e==="head"}function Cv(e,t){var n=t,i=0;do{var s=n.nextSibling;if(e.removeChild(n),s&&s.nodeType===8)if(n=s.data,n==="/$"||n==="/&"){if(i===0){e.removeChild(s),Gr(t);return}i--}else if(n==="$"||n==="$?"||n==="$~"||n==="$!"||n==="&")i++;else if(n==="html")$o(e.ownerDocument.documentElement);else if(n==="head"){n=e.ownerDocument.head,$o(n);for(var a=n.firstChild;a;){var r=a.nextSibling,o=a.nodeName;a[vl]||o==="SCRIPT"||o==="STYLE"||o==="LINK"&&a.rel.toLowerCase()==="stylesheet"||n.removeChild(a),a=r}}else n==="body"&&$o(e.ownerDocument.body);n=s}while(n);Gr(t)}function Rv(e,t){var n=e;e=0;do{var i=n.nextSibling;if(n.nodeType===1?t?(n._stashedDisplay=n.style.display,n.style.display="none"):(n.style.display=n._stashedDisplay||"",n.getAttribute("style")===""&&n.removeAttribute("style")):n.nodeType===3&&(t?(n._stashedText=n.nodeValue,n.nodeValue=""):n.nodeValue=n._stashedText||""),i&&i.nodeType===8)if(n=i.data,n==="/$"){if(e===0)break;e--}else n!=="$"&&n!=="$?"&&n!=="$~"&&n!=="$!"||e++;n=i}while(n)}function sm(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var n=t;switch(t=t.nextSibling,n.nodeName){case"HTML":case"HEAD":case"BODY":sm(n),mm(n);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(n.rel.toLowerCase()==="stylesheet")continue}e.removeChild(n)}}function lT(e,t,n,i){for(;e.nodeType===1;){var s=n;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!i&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(i){if(!e[vl])switch(t){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(a=e.getAttribute("rel"),a==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(a!==s.rel||e.getAttribute("href")!==(s.href==null||s.href===""?null:s.href)||e.getAttribute("crossorigin")!==(s.crossOrigin==null?null:s.crossOrigin)||e.getAttribute("title")!==(s.title==null?null:s.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(a=e.getAttribute("src"),(a!==(s.src==null?null:s.src)||e.getAttribute("type")!==(s.type==null?null:s.type)||e.getAttribute("crossorigin")!==(s.crossOrigin==null?null:s.crossOrigin))&&a&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(t==="input"&&e.type==="hidden"){var a=s.name==null?null:""+s.name;if(s.type==="hidden"&&e.getAttribute("name")===a)return e}else return e;if(e=ui(e.nextSibling),e===null)break}return null}function cT(e,t,n){if(t==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!n||(e=ui(e.nextSibling),e===null))return null;return e}function _b(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!t||(e=ui(e.nextSibling),e===null))return null;return e}function am(e){return e.data==="$?"||e.data==="$~"}function rm(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function uT(e,t){var n=e.ownerDocument;if(e.data==="$~")e._reactRetry=t;else if(e.data!=="$?"||n.readyState!=="loading")t();else{var i=function(){t(),n.removeEventListener("DOMContentLoaded",i)};n.addEventListener("DOMContentLoaded",i),e._reactRetry=i}}function ui(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?"||t==="$~"||t==="&"||t==="F!"||t==="F")break;if(t==="/$"||t==="/&")return null}}return e}var om=null;function Dv(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="/$"||n==="/&"){if(t===0)return ui(e.nextSibling);t--}else n!=="$"&&n!=="$!"&&n!=="$?"&&n!=="$~"&&n!=="&"||t++}e=e.nextSibling}return null}function Nv(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="$"||n==="$!"||n==="$?"||n==="$~"||n==="&"){if(t===0)return e;t--}else n!=="/$"&&n!=="/&"||t++}e=e.previousSibling}return null}function vb(e,t,n){switch(t=Lu(n),e){case"html":if(e=t.documentElement,!e)throw Error(et(452));return e;case"head":if(e=t.head,!e)throw Error(et(453));return e;case"body":if(e=t.body,!e)throw Error(et(454));return e;default:throw Error(et(451))}}function $o(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);mm(e)}var hi=new Map,Uv=new Set;function Iu(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var ms=ae.d;ae.d={f:hT,r:fT,D:dT,C:pT,L:mT,m:gT,X:vT,S:_T,M:yT};function hT(){var e=ms.f(),t=ju();return e||t}function fT(e){var t=Xr(e);t!==null&&t.tag===5&&t.type==="form"?hx(t):ms.r(e)}var Zr=typeof document>"u"?null:document;function yb(e,t,n){var i=Zr;if(i&&typeof t=="string"&&t){var s=ri(t);s='link[rel="'+e+'"][href="'+s+'"]',typeof n=="string"&&(s+='[crossorigin="'+n+'"]'),Uv.has(s)||(Uv.add(s),e={rel:e,crossOrigin:n,href:t},i.querySelector(s)===null&&(t=i.createElement("link"),fn(t,"link",e),nn(t),i.head.appendChild(t)))}}function dT(e){ms.D(e),yb("dns-prefetch",e,null)}function pT(e,t){ms.C(e,t),yb("preconnect",e,t)}function mT(e,t,n){ms.L(e,t,n);var i=Zr;if(i&&e&&t){var s='link[rel="preload"][as="'+ri(t)+'"]';t==="image"&&n&&n.imageSrcSet?(s+='[imagesrcset="'+ri(n.imageSrcSet)+'"]',typeof n.imageSizes=="string"&&(s+='[imagesizes="'+ri(n.imageSizes)+'"]')):s+='[href="'+ri(e)+'"]';var a=s;switch(t){case"style":a=Hr(e);break;case"script":a=Jr(e)}hi.has(a)||(e=Te({rel:"preload",href:t==="image"&&n&&n.imageSrcSet?void 0:e,as:t},n),hi.set(a,e),i.querySelector(s)!==null||t==="style"&&i.querySelector(El(a))||t==="script"&&i.querySelector(Tl(a))||(t=i.createElement("link"),fn(t,"link",e),nn(t),i.head.appendChild(t)))}}function gT(e,t){ms.m(e,t);var n=Zr;if(n&&e){var i=t&&typeof t.as=="string"?t.as:"script",s='link[rel="modulepreload"][as="'+ri(i)+'"][href="'+ri(e)+'"]',a=s;switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":a=Jr(e)}if(!hi.has(a)&&(e=Te({rel:"modulepreload",href:e},t),hi.set(a,e),n.querySelector(s)===null)){switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(n.querySelector(Tl(a)))return}i=n.createElement("link"),fn(i,"link",e),nn(i),n.head.appendChild(i)}}}function _T(e,t,n){ms.S(e,t,n);var i=Zr;if(i&&e){var s=Tr(i).hoistableStyles,a=Hr(e);t=t||"default";var r=s.get(a);if(!r){var o={loading:0,preload:null};if(r=i.querySelector(El(a)))o.loading=5;else{e=Te({rel:"stylesheet",href:e,"data-precedence":t},n),(n=hi.get(a))&&tg(e,n);var l=r=i.createElement("link");nn(l),fn(l,"link",e),l._p=new Promise(function(c,h){l.onload=c,l.onerror=h}),l.addEventListener("load",function(){o.loading|=1}),l.addEventListener("error",function(){o.loading|=2}),o.loading|=4,ru(r,t,i)}r={type:"stylesheet",instance:r,count:1,state:o},s.set(a,r)}}}function vT(e,t){ms.X(e,t);var n=Zr;if(n&&e){var i=Tr(n).hoistableScripts,s=Jr(e),a=i.get(s);a||(a=n.querySelector(Tl(s)),a||(e=Te({src:e,async:!0},t),(t=hi.get(s))&&eg(e,t),a=n.createElement("script"),nn(a),fn(a,"link",e),n.head.appendChild(a)),a={type:"script",instance:a,count:1,state:null},i.set(s,a))}}function yT(e,t){ms.M(e,t);var n=Zr;if(n&&e){var i=Tr(n).hoistableScripts,s=Jr(e),a=i.get(s);a||(a=n.querySelector(Tl(s)),a||(e=Te({src:e,async:!0,type:"module"},t),(t=hi.get(s))&&eg(e,t),a=n.createElement("script"),nn(a),fn(a,"link",e),n.head.appendChild(a)),a={type:"script",instance:a,count:1,state:null},i.set(s,a))}}function Lv(e,t,n,i){var s=(s=Gs.current)?Iu(s):null;if(!s)throw Error(et(446));switch(e){case"meta":case"title":return null;case"style":return typeof n.precedence=="string"&&typeof n.href=="string"?(t=Hr(n.href),n=Tr(s).hoistableStyles,i=n.get(t),i||(i={type:"style",instance:null,count:0,state:null},n.set(t,i)),i):{type:"void",instance:null,count:0,state:null};case"link":if(n.rel==="stylesheet"&&typeof n.href=="string"&&typeof n.precedence=="string"){e=Hr(n.href);var a=Tr(s).hoistableStyles,r=a.get(e);if(r||(s=s.ownerDocument||s,r={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},a.set(e,r),(a=s.querySelector(El(e)))&&!a._p&&(r.instance=a,r.state.loading=5),hi.has(e)||(n={rel:"preload",as:"style",href:n.href,crossOrigin:n.crossOrigin,integrity:n.integrity,media:n.media,hrefLang:n.hrefLang,referrerPolicy:n.referrerPolicy},hi.set(e,n),a||xT(s,e,n,r.state))),t&&i===null)throw Error(et(528,""));return r}if(t&&i!==null)throw Error(et(529,""));return null;case"script":return t=n.async,n=n.src,typeof n=="string"&&t&&typeof t!="function"&&typeof t!="symbol"?(t=Jr(n),n=Tr(s).hoistableScripts,i=n.get(t),i||(i={type:"script",instance:null,count:0,state:null},n.set(t,i)),i):{type:"void",instance:null,count:0,state:null};default:throw Error(et(444,e))}}function Hr(e){return'href="'+ri(e)+'"'}function El(e){return'link[rel="stylesheet"]['+e+"]"}function xb(e){return Te({},e,{"data-precedence":e.precedence,precedence:null})}function xT(e,t,n,i){e.querySelector('link[rel="preload"][as="style"]['+t+"]")?i.loading=1:(t=e.createElement("link"),i.preload=t,t.addEventListener("load",function(){return i.loading|=1}),t.addEventListener("error",function(){return i.loading|=2}),fn(t,"link",n),nn(t),e.head.appendChild(t))}function Jr(e){return'[src="'+ri(e)+'"]'}function Tl(e){return"script[async]"+e}function Iv(e,t,n){if(t.count++,t.instance===null)switch(t.type){case"style":var i=e.querySelector('style[data-href~="'+ri(n.href)+'"]');if(i)return t.instance=i,nn(i),i;var s=Te({},n,{"data-href":n.href,"data-precedence":n.precedence,href:null,precedence:null});return i=(e.ownerDocument||e).createElement("style"),nn(i),fn(i,"style",s),ru(i,n.precedence,e),t.instance=i;case"stylesheet":s=Hr(n.href);var a=e.querySelector(El(s));if(a)return t.state.loading|=4,t.instance=a,nn(a),a;i=xb(n),(s=hi.get(s))&&tg(i,s),a=(e.ownerDocument||e).createElement("link"),nn(a);var r=a;return r._p=new Promise(function(o,l){r.onload=o,r.onerror=l}),fn(a,"link",i),t.state.loading|=4,ru(a,n.precedence,e),t.instance=a;case"script":return a=Jr(n.src),(s=e.querySelector(Tl(a)))?(t.instance=s,nn(s),s):(i=n,(s=hi.get(a))&&(i=Te({},n),eg(i,s)),e=e.ownerDocument||e,s=e.createElement("script"),nn(s),fn(s,"link",i),e.head.appendChild(s),t.instance=s);case"void":return null;default:throw Error(et(443,t.type))}else t.type==="stylesheet"&&(t.state.loading&4)===0&&(i=t.instance,t.state.loading|=4,ru(i,n.precedence,e));return t.instance}function ru(e,t,n){for(var i=n.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'),s=i.length?i[i.length-1]:null,a=s,r=0;r<i.length;r++){var o=i[r];if(o.dataset.precedence===t)a=o;else if(a!==s)break}a?a.parentNode.insertBefore(e,a.nextSibling):(t=n.nodeType===9?n.head:n,t.insertBefore(e,t.firstChild))}function tg(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.title==null&&(e.title=t.title)}function eg(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.integrity==null&&(e.integrity=t.integrity)}var ou=null;function Ov(e,t,n){if(ou===null){var i=new Map,s=ou=new Map;s.set(n,i)}else s=ou,i=s.get(n),i||(i=new Map,s.set(n,i));if(i.has(e))return i;for(i.set(e,null),n=n.getElementsByTagName(e),s=0;s<n.length;s++){var a=n[s];if(!(a[vl]||a[cn]||e==="link"&&a.getAttribute("rel")==="stylesheet")&&a.namespaceURI!=="http://www.w3.org/2000/svg"){var r=a.getAttribute(t)||"";r=e+r;var o=i.get(r);o?o.push(a):i.set(r,[a])}}return i}function Pv(e,t,n){e=e.ownerDocument||e,e.head.insertBefore(n,t==="title"?e.querySelector("head > title"):null)}function bT(e,t,n){if(n===1||t.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof t.precedence!="string"||typeof t.href!="string"||t.href==="")break;return!0;case"link":if(typeof t.rel!="string"||typeof t.href!="string"||t.href===""||t.onLoad||t.onError)break;switch(t.rel){case"stylesheet":return e=t.disabled,typeof t.precedence=="string"&&e==null;default:return!0}case"script":if(t.async&&typeof t.async!="function"&&typeof t.async!="symbol"&&!t.onLoad&&!t.onError&&t.src&&typeof t.src=="string")return!0}return!1}function bb(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function ST(e,t,n,i){if(n.type==="stylesheet"&&(typeof i.media!="string"||matchMedia(i.media).matches!==!1)&&(n.state.loading&4)===0){if(n.instance===null){var s=Hr(i.href),a=t.querySelector(El(s));if(a){t=a._p,t!==null&&typeof t=="object"&&typeof t.then=="function"&&(e.count++,e=Ou.bind(e),t.then(e,e)),n.state.loading|=4,n.instance=a,nn(a);return}a=t.ownerDocument||t,i=xb(i),(s=hi.get(s))&&tg(i,s),a=a.createElement("link"),nn(a);var r=a;r._p=new Promise(function(o,l){r.onload=o,r.onerror=l}),fn(a,"link",i),n.instance=a}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(n,t),(t=n.state.preload)&&(n.state.loading&3)===0&&(e.count++,n=Ou.bind(e),t.addEventListener("load",n),t.addEventListener("error",n))}}var pp=0;function MT(e,t){return e.stylesheets&&e.count===0&&lu(e,e.stylesheets),0<e.count||0<e.imgCount?function(n){var i=setTimeout(function(){if(e.stylesheets&&lu(e,e.stylesheets),e.unsuspend){var a=e.unsuspend;e.unsuspend=null,a()}},6e4+t);0<e.imgBytes&&pp===0&&(pp=62500*iT());var s=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&lu(e,e.stylesheets),e.unsuspend)){var a=e.unsuspend;e.unsuspend=null,a()}},(e.imgBytes>pp?50:800)+t);return e.unsuspend=n,function(){e.unsuspend=null,clearTimeout(i),clearTimeout(s)}}:null}function Ou(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)lu(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var Pu=null;function lu(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,Pu=new Map,t.forEach(ET,e),Pu=null,Ou.call(e))}function ET(e,t){if(!(t.state.loading&4)){var n=Pu.get(e);if(n)var i=n.get(null);else{n=new Map,Pu.set(e,n);for(var s=e.querySelectorAll("link[data-precedence],style[data-precedence]"),a=0;a<s.length;a++){var r=s[a];(r.nodeName==="LINK"||r.getAttribute("media")!=="not all")&&(n.set(r.dataset.precedence,r),i=r)}i&&n.set(null,i)}s=t.instance,r=s.getAttribute("data-precedence"),a=n.get(r)||i,a===i&&n.set(null,s),n.set(r,s),this.count++,i=Ou.bind(this),s.addEventListener("load",i),s.addEventListener("error",i),a?a.parentNode.insertBefore(s,a.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(s,e.firstChild)),t.state.loading|=4}}var hl={$$typeof:ss,Provider:null,Consumer:null,_currentValue:Ra,_currentValue2:Ra,_threadCount:0};function TT(e,t,n,i,s,a,r,o,l){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=Vd(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Vd(0),this.hiddenUpdates=Vd(null),this.identifierPrefix=i,this.onUncaughtError=s,this.onCaughtError=a,this.onRecoverableError=r,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=l,this.incompleteTransitions=new Map}function Sb(e,t,n,i,s,a,r,o,l,c,h,p){return e=new TT(e,t,n,r,l,c,h,p,o),t=1,a===!0&&(t|=24),a=Bn(3,null,null,t),e.current=a,a.stateNode=e,t=wm(),t.refCount++,e.pooledCache=t,t.refCount++,a.memoizedState={element:i,isDehydrated:n,cache:t},Dm(a),e}function Mb(e){return e?(e=br,e):br}function Eb(e,t,n,i,s,a){s=Mb(s),i.context===null?i.context=s:i.pendingContext=s,i=Xs(t),i.payload={element:n},a=a===void 0?null:a,a!==null&&(i.callback=a),n=Ws(e,i,t),n!==null&&(Nn(n,e,t),Wo(n,e,t))}function zv(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var n=e.retryLane;e.retryLane=n!==0&&n<t?n:t}}function ng(e,t){zv(e,t),(e=e.alternate)&&zv(e,t)}function Tb(e){if(e.tag===13||e.tag===31){var t=Ga(e,67108864);t!==null&&Nn(t,e,67108864),ng(e,67108864)}}function Bv(e){if(e.tag===13||e.tag===31){var t=kn();t=dm(t);var n=Ga(e,t);n!==null&&Nn(n,e,t),ng(e,t)}}var zu=!0;function AT(e,t,n,i){var s=Pt.T;Pt.T=null;var a=ae.p;try{ae.p=2,ig(e,t,n,i)}finally{ae.p=a,Pt.T=s}}function wT(e,t,n,i){var s=Pt.T;Pt.T=null;var a=ae.p;try{ae.p=8,ig(e,t,n,i)}finally{ae.p=a,Pt.T=s}}function ig(e,t,n,i){if(zu){var s=lm(i);if(s===null)fp(e,t,i,Bu,n),Fv(e,i);else if(RT(s,e,t,n,i))i.stopPropagation();else if(Fv(e,i),t&4&&-1<CT.indexOf(e)){for(;s!==null;){var a=Xr(s);if(a!==null)switch(a.tag){case 3:if(a=a.stateNode,a.current.memoizedState.isDehydrated){var r=Aa(a.pendingLanes);if(r!==0){var o=a;for(o.pendingLanes|=2,o.entangledLanes|=2;r;){var l=1<<31-Gn(r);o.entanglements[1]|=l,r&=~l}zi(a),(se&6)===0&&(wu=Vn()+500,Ml(0,!1))}}break;case 31:case 13:o=Ga(a,2),o!==null&&Nn(o,a,2),ju(),ng(a,2)}if(a=lm(i),a===null&&fp(e,t,i,Bu,n),a===s)break;s=a}s!==null&&i.stopPropagation()}else fp(e,t,i,null,n)}}function lm(e){return e=_m(e),sg(e)}var Bu=null;function sg(e){if(Bu=null,e=mr(e),e!==null){var t=pl(e);if(t===null)e=null;else{var n=t.tag;if(n===13){if(e=Wv(t),e!==null)return e;e=null}else if(n===31){if(e=qv(t),e!==null)return e;e=null}else if(n===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return Bu=e,null}function Ab(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(m1()){case Kv:return 2;case jv:return 8;case du:case g1:return 32;case Qv:return 268435456;default:return 32}default:return 32}}var cm=!1,Zs=null,Js=null,Ks=null,fl=new Map,dl=new Map,Ps=[],CT="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function Fv(e,t){switch(e){case"focusin":case"focusout":Zs=null;break;case"dragenter":case"dragleave":Js=null;break;case"mouseover":case"mouseout":Ks=null;break;case"pointerover":case"pointerout":fl.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":dl.delete(t.pointerId)}}function Io(e,t,n,i,s,a){return e===null||e.nativeEvent!==a?(e={blockedOn:t,domEventName:n,eventSystemFlags:i,nativeEvent:a,targetContainers:[s]},t!==null&&(t=Xr(t),t!==null&&Tb(t)),e):(e.eventSystemFlags|=i,t=e.targetContainers,s!==null&&t.indexOf(s)===-1&&t.push(s),e)}function RT(e,t,n,i,s){switch(t){case"focusin":return Zs=Io(Zs,e,t,n,i,s),!0;case"dragenter":return Js=Io(Js,e,t,n,i,s),!0;case"mouseover":return Ks=Io(Ks,e,t,n,i,s),!0;case"pointerover":var a=s.pointerId;return fl.set(a,Io(fl.get(a)||null,e,t,n,i,s)),!0;case"gotpointercapture":return a=s.pointerId,dl.set(a,Io(dl.get(a)||null,e,t,n,i,s)),!0}return!1}function wb(e){var t=mr(e.target);if(t!==null){var n=pl(t);if(n!==null){if(t=n.tag,t===13){if(t=Wv(n),t!==null){e.blockedOn=t,S_(e.priority,function(){Bv(n)});return}}else if(t===31){if(t=qv(n),t!==null){e.blockedOn=t,S_(e.priority,function(){Bv(n)});return}}else if(t===3&&n.stateNode.current.memoizedState.isDehydrated){e.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}e.blockedOn=null}function cu(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var n=lm(e.nativeEvent);if(n===null){n=e.nativeEvent;var i=new n.constructor(n.type,n);wp=i,n.target.dispatchEvent(i),wp=null}else return t=Xr(n),t!==null&&Tb(t),e.blockedOn=n,!1;t.shift()}return!0}function Vv(e,t,n){cu(e)&&n.delete(t)}function DT(){cm=!1,Zs!==null&&cu(Zs)&&(Zs=null),Js!==null&&cu(Js)&&(Js=null),Ks!==null&&cu(Ks)&&(Ks=null),fl.forEach(Vv),dl.forEach(Vv)}function Yc(e,t){e.blockedOn===t&&(e.blockedOn=null,cm||(cm=!0,je.unstable_scheduleCallback(je.unstable_NormalPriority,DT)))}var Zc=null;function Hv(e){Zc!==e&&(Zc=e,je.unstable_scheduleCallback(je.unstable_NormalPriority,function(){Zc===e&&(Zc=null);for(var t=0;t<e.length;t+=3){var n=e[t],i=e[t+1],s=e[t+2];if(typeof i!="function"){if(sg(i||n)===null)continue;break}var a=Xr(n);a!==null&&(e.splice(t,3),t-=3,kp(a,{pending:!0,data:s,method:n.method,action:i},i,s))}}))}function Gr(e){function t(l){return Yc(l,e)}Zs!==null&&Yc(Zs,e),Js!==null&&Yc(Js,e),Ks!==null&&Yc(Ks,e),fl.forEach(t),dl.forEach(t);for(var n=0;n<Ps.length;n++){var i=Ps[n];i.blockedOn===e&&(i.blockedOn=null)}for(;0<Ps.length&&(n=Ps[0],n.blockedOn===null);)wb(n),n.blockedOn===null&&Ps.shift();if(n=(e.ownerDocument||e).$$reactFormReplay,n!=null)for(i=0;i<n.length;i+=3){var s=n[i],a=n[i+1],r=s[Un]||null;if(typeof a=="function")r||Hv(n);else if(r){var o=null;if(a&&a.hasAttribute("formAction")){if(s=a,r=a[Un]||null)o=r.formAction;else if(sg(s)!==null)continue}else o=r.action;typeof o=="function"?n[i+1]=o:(n.splice(i,3),i-=3),Hv(n)}}}function Cb(){function e(a){a.canIntercept&&a.info==="react-transition"&&a.intercept({handler:function(){return new Promise(function(r){return s=r})},focusReset:"manual",scroll:"manual"})}function t(){s!==null&&(s(),s=null),i||setTimeout(n,20)}function n(){if(!i&&!navigation.transition){var a=navigation.currentEntry;a&&a.url!=null&&navigation.navigate(a.url,{state:a.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var i=!1,s=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",t),navigation.addEventListener("navigateerror",t),setTimeout(n,100),function(){i=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",t),navigation.removeEventListener("navigateerror",t),s!==null&&(s(),s=null)}}}function ag(e){this._internalRoot=e}th.prototype.render=ag.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(et(409));var n=t.current,i=kn();Eb(n,i,e,t,null,null)};th.prototype.unmount=ag.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;Eb(e.current,2,null,e,null,null),ju(),t[kr]=null}};function th(e){this._internalRoot=e}th.prototype.unstable_scheduleHydration=function(e){if(e){var t=iy();e={blockedOn:null,target:e,priority:t};for(var n=0;n<Ps.length&&t!==0&&t<Ps[n].priority;n++);Ps.splice(n,0,e),n===0&&wb(e)}};var Gv=kv.version;if(Gv!=="19.2.8")throw Error(et(527,Gv,"19.2.8"));ae.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(et(188)):(e=Object.keys(e).join(","),Error(et(268,e)));return e=l1(t),e=e!==null?Yv(e):null,e=e===null?null:e.stateNode,e};var NT={bundleType:0,version:"19.2.8",rendererPackageName:"react-dom",currentDispatcherRef:Pt,reconcilerVersion:"19.2.8"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"&&(Oo=__REACT_DEVTOOLS_GLOBAL_HOOK__,!Oo.isDisabled&&Oo.supportsFiber))try{ml=Oo.inject(NT),Hn=Oo}catch{}var Oo;eh.createRoot=function(e,t){if(!Xv(e))throw Error(et(299));var n=!1,i="",s=yx,a=xx,r=bx;return t!=null&&(t.unstable_strictMode===!0&&(n=!0),t.identifierPrefix!==void 0&&(i=t.identifierPrefix),t.onUncaughtError!==void 0&&(s=t.onUncaughtError),t.onCaughtError!==void 0&&(a=t.onCaughtError),t.onRecoverableError!==void 0&&(r=t.onRecoverableError)),t=Sb(e,1,!1,null,null,n,i,null,s,a,r,Cb),e[kr]=t.current,$m(e),new ag(t)};eh.hydrateRoot=function(e,t,n){if(!Xv(e))throw Error(et(299));var i=!1,s="",a=yx,r=xx,o=bx,l=null;return n!=null&&(n.unstable_strictMode===!0&&(i=!0),n.identifierPrefix!==void 0&&(s=n.identifierPrefix),n.onUncaughtError!==void 0&&(a=n.onUncaughtError),n.onCaughtError!==void 0&&(r=n.onCaughtError),n.onRecoverableError!==void 0&&(o=n.onRecoverableError),n.formState!==void 0&&(l=n.formState)),t=Sb(e,1,!0,t,n??null,i,s,l,a,r,o,Cb),t.context=Mb(null),n=t.current,i=kn(),i=dm(i),s=Xs(i),s.callback=null,Ws(n,s,i),n=i,t.current.lanes=n,_l(t,n),zi(t),e[kr]=t.current,$m(e),new th(t)};eh.version="19.2.8"});var Ub=Di((D2,Nb)=>{"use strict";function Db(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(Db)}catch(e){console.error(e)}}Db(),Nb.exports=Rb()});var bM=Di(md=>{"use strict";var o2=Symbol.for("react.transitional.element"),l2=Symbol.for("react.fragment");function xM(e,t,n){var i=null;if(n!==void 0&&(i=""+n),t.key!==void 0&&(i=""+t.key),"key"in t){n={};for(var s in t)s!=="key"&&(n[s]=t[s])}else n=t;return t=n.ref,{$$typeof:o2,type:e,key:i,ref:t!==void 0?t:null,props:n}}md.Fragment=l2;md.jsx=xM;md.jsxs=xM});var D0=Di((eL,SM)=>{"use strict";SM.exports=bM()});var at=Ec(Ac()),AM=Ec(Ub());var yf="185";var sS=0,Hg=1,aS=2;var sc=1,rS=2,vo=3,Ms=0,An=1,Wi=2,qi=0,Ka=1,Gg=2,kg=3,Xg=4,oS=5;var ca=100,lS=101,cS=102,uS=103,hS=104,fS=200,dS=201,pS=202,mS=203,Rh=204,Dh=205,gS=206,_S=207,vS=208,yS=209,xS=210,bS=211,SS=212,MS=213,ES=214,Nh=0,Uh=1,Lh=2,ja=3,Ih=4,Oh=5,Ph=6,zh=7,Wg=0,TS=1,AS=2,Mi=0,qg=1,Yg=2,Zg=3,Jg=4,Kg=5,jg=6,Qg=7;var $g=300,va=301,$a=302,xf=303,bf=304,ac=306,Bh=1e3,Vi=1001,Fh=1002,rn=1003,wS=1004;var rc=1005;var dn=1006,Sf=1007;var ya=1008;var $n=1009,t0=1010,e0=1011,yo=1012,Mf=1013,Ei=1014,Ti=1015,Yi=1016,Ef=1017,Tf=1018,xo=1020,n0=35902,i0=35899,s0=1021,a0=1022,mi=1023,Gi=1026,xa=1027,r0=1028,Af=1029,ba=1030,wf=1031;var Cf=1033,oc=33776,lc=33777,cc=33778,uc=33779,Rf=35840,Df=35841,Nf=35842,Uf=35843,Lf=36196,If=37492,Of=37496,Pf=37488,zf=37489,hc=37490,Bf=37491,Ff=37808,Vf=37809,Hf=37810,Gf=37811,kf=37812,Xf=37813,Wf=37814,qf=37815,Yf=37816,Zf=37817,Jf=37818,Kf=37819,jf=37820,Qf=37821,$f=36492,td=36494,ed=36495,nd=36283,id=36284,fc=36285,sd=36286;var Il=2300,Vh=2301,wh=2302,Lg=2303,Ig=2400,Og=2401,Pg=2402;var CS=3200;var o0=0,RS=1,Ts="",Tn="srgb",Ol="srgb-linear",Pl="linear",oe="srgb";var Za=7680;var zg=519,DS=512,NS=513,US=514,ad=515,LS=516,IS=517,rd=518,OS=519,Bg=35044;var l0="300 es",Si=2e3,zl=2001;function UT(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function LT(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function Bl(e){return document.createElementNS("http://www.w3.org/1999/xhtml",e)}function PS(){let e=Bl("canvas");return e.style.display="block",e}var Lb={},co=null;function c0(...e){let t="THREE."+e.shift();co?co("log",t,...e):console.log(t,...e)}function zS(e){let t=e[0];if(typeof t=="string"&&t.startsWith("TSL:")){let n=e[1];n&&n.isStackTrace?e[0]+=" "+n.getLocation():e[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return e}function Lt(...e){e=zS(e);let t="THREE."+e.shift();if(co)co("warn",t,...e);else{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function Ot(...e){e=zS(e);let t="THREE."+e.shift();if(co)co("error",t,...e);else{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function Ja(...e){let t=e.join(" ");t in Lb||(Lb[t]=!0,Lt(...e))}function BS(e,t,n){return new Promise(function(i,s){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:s();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:i()}}setTimeout(a,n)})}var FS={[Nh]:Uh,[Lh]:Ph,[Ih]:zh,[ja]:Oh,[Uh]:Nh,[Ph]:Lh,[zh]:Ih,[Oh]:ja},ki=class{addEventListener(t,n){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[t]===void 0&&(i[t]=[]),i[t].indexOf(n)===-1&&i[t].push(n)}hasEventListener(t,n){let i=this._listeners;return i===void 0?!1:i[t]!==void 0&&i[t].indexOf(n)!==-1}removeEventListener(t,n){let i=this._listeners;if(i===void 0)return;let s=i[t];if(s!==void 0){let a=s.indexOf(n);a!==-1&&s.splice(a,1)}}dispatchEvent(t){let n=this._listeners;if(n===void 0)return;let i=n[t.type];if(i!==void 0){t.target=this;let s=i.slice(0);for(let a=0,r=s.length;a<r;a++)s[a].call(this,t);t.target=null}}},_n=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var Ch=Math.PI/180,Hh=180/Math.PI;function dc(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(_n[e&255]+_n[e>>8&255]+_n[e>>16&255]+_n[e>>24&255]+"-"+_n[t&255]+_n[t>>8&255]+"-"+_n[t>>16&15|64]+_n[t>>24&255]+"-"+_n[n&63|128]+_n[n>>8&255]+"-"+_n[n>>16&255]+_n[n>>24&255]+_n[i&255]+_n[i>>8&255]+_n[i>>16&255]+_n[i>>24&255]).toLowerCase()}function Zt(e,t,n){return Math.max(t,Math.min(n,e))}function IT(e,t){return(e%t+t)%t}function rg(e,t,n){return(1-n)*e+n*t}function Al(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function In(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Ut=class e{static{e.prototype.isVector2=!0}constructor(t=0,n=0){this.x=t,this.y=n}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,n){return this.x=t,this.y=n,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let n=this.x,i=this.y,s=t.elements;return this.x=s[0]*n+s[3]*i+s[6],this.y=s[1]*n+s[4]*i+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,n){return this.x=Zt(this.x,t.x,n.x),this.y=Zt(this.y,t.y,n.y),this}clampScalar(t,n){return this.x=Zt(this.x,t,n),this.y=Zt(this.y,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Zt(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let n=Math.sqrt(this.lengthSq()*t.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(t)/n;return Math.acos(Zt(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let n=this.x-t.x,i=this.y-t.y;return n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this}rotateAround(t,n){let i=Math.cos(n),s=Math.sin(n),a=this.x-t.x,r=this.y-t.y;return this.x=a*i-r*s+t.x,this.y=a*s+r*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Xi=class{constructor(t=0,n=0,i=0,s=1){this.isQuaternion=!0,this._x=t,this._y=n,this._z=i,this._w=s}static slerpFlat(t,n,i,s,a,r,o){let l=i[s+0],c=i[s+1],h=i[s+2],p=i[s+3],u=a[r+0],d=a[r+1],g=a[r+2],S=a[r+3];if(p!==S||l!==u||c!==d||h!==g){let m=l*u+c*d+h*g+p*S;m<0&&(u=-u,d=-d,g=-g,S=-S,m=-m);let f=1-o;if(m<.9995){let _=Math.acos(m),b=Math.sin(_);f=Math.sin(f*_)/b,o=Math.sin(o*_)/b,l=l*f+u*o,c=c*f+d*o,h=h*f+g*o,p=p*f+S*o}else{l=l*f+u*o,c=c*f+d*o,h=h*f+g*o,p=p*f+S*o;let _=1/Math.sqrt(l*l+c*c+h*h+p*p);l*=_,c*=_,h*=_,p*=_}}t[n]=l,t[n+1]=c,t[n+2]=h,t[n+3]=p}static multiplyQuaternionsFlat(t,n,i,s,a,r){let o=i[s],l=i[s+1],c=i[s+2],h=i[s+3],p=a[r],u=a[r+1],d=a[r+2],g=a[r+3];return t[n]=o*g+h*p+l*d-c*u,t[n+1]=l*g+h*u+c*p-o*d,t[n+2]=c*g+h*d+o*u-l*p,t[n+3]=h*g-o*p-l*u-c*d,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,n,i,s){return this._x=t,this._y=n,this._z=i,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,n=!0){let i=t._x,s=t._y,a=t._z,r=t._order,o=Math.cos,l=Math.sin,c=o(i/2),h=o(s/2),p=o(a/2),u=l(i/2),d=l(s/2),g=l(a/2);switch(r){case"XYZ":this._x=u*h*p+c*d*g,this._y=c*d*p-u*h*g,this._z=c*h*g+u*d*p,this._w=c*h*p-u*d*g;break;case"YXZ":this._x=u*h*p+c*d*g,this._y=c*d*p-u*h*g,this._z=c*h*g-u*d*p,this._w=c*h*p+u*d*g;break;case"ZXY":this._x=u*h*p-c*d*g,this._y=c*d*p+u*h*g,this._z=c*h*g+u*d*p,this._w=c*h*p-u*d*g;break;case"ZYX":this._x=u*h*p-c*d*g,this._y=c*d*p+u*h*g,this._z=c*h*g-u*d*p,this._w=c*h*p+u*d*g;break;case"YZX":this._x=u*h*p+c*d*g,this._y=c*d*p+u*h*g,this._z=c*h*g-u*d*p,this._w=c*h*p-u*d*g;break;case"XZY":this._x=u*h*p-c*d*g,this._y=c*d*p-u*h*g,this._z=c*h*g+u*d*p,this._w=c*h*p+u*d*g;break;default:Lt("Quaternion: .setFromEuler() encountered an unknown order: "+r)}return n===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,n){let i=n/2,s=Math.sin(i);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(t){let n=t.elements,i=n[0],s=n[4],a=n[8],r=n[1],o=n[5],l=n[9],c=n[2],h=n[6],p=n[10],u=i+o+p;if(u>0){let d=.5/Math.sqrt(u+1);this._w=.25/d,this._x=(h-l)*d,this._y=(a-c)*d,this._z=(r-s)*d}else if(i>o&&i>p){let d=2*Math.sqrt(1+i-o-p);this._w=(h-l)/d,this._x=.25*d,this._y=(s+r)/d,this._z=(a+c)/d}else if(o>p){let d=2*Math.sqrt(1+o-i-p);this._w=(a-c)/d,this._x=(s+r)/d,this._y=.25*d,this._z=(l+h)/d}else{let d=2*Math.sqrt(1+p-i-o);this._w=(r-s)/d,this._x=(a+c)/d,this._y=(l+h)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(t,n){let i=t.dot(n)+1;return i<1e-8?(i=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=i):(this._x=0,this._y=-t.z,this._z=t.y,this._w=i)):(this._x=t.y*n.z-t.z*n.y,this._y=t.z*n.x-t.x*n.z,this._z=t.x*n.y-t.y*n.x,this._w=i),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Zt(this.dot(t),-1,1)))}rotateTowards(t,n){let i=this.angleTo(t);if(i===0)return this;let s=Math.min(1,n/i);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,n){let i=t._x,s=t._y,a=t._z,r=t._w,o=n._x,l=n._y,c=n._z,h=n._w;return this._x=i*h+r*o+s*c-a*l,this._y=s*h+r*l+a*o-i*c,this._z=a*h+r*c+i*l-s*o,this._w=r*h-i*o-s*l-a*c,this._onChangeCallback(),this}slerp(t,n){let i=t._x,s=t._y,a=t._z,r=t._w,o=this.dot(t);o<0&&(i=-i,s=-s,a=-a,r=-r,o=-o);let l=1-n;if(o<.9995){let c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,n=Math.sin(n*c)/h,this._x=this._x*l+i*n,this._y=this._y*l+s*n,this._z=this._z*l+a*n,this._w=this._w*l+r*n,this._onChangeCallback()}else this._x=this._x*l+i*n,this._y=this._y*l+s*n,this._z=this._z*l+a*n,this._w=this._w*l+r*n,this.normalize();return this}slerpQuaternions(t,n,i){return this.copy(t).slerp(n,i)}random(){let t=2*Math.PI*Math.random(),n=2*Math.PI*Math.random(),i=Math.random(),s=Math.sqrt(1-i),a=Math.sqrt(i);return this.set(s*Math.sin(t),s*Math.cos(t),a*Math.sin(n),a*Math.cos(n))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,n=0){return this._x=t[n],this._y=t[n+1],this._z=t[n+2],this._w=t[n+3],this._onChangeCallback(),this}toArray(t=[],n=0){return t[n]=this._x,t[n+1]=this._y,t[n+2]=this._z,t[n+3]=this._w,t}fromBufferAttribute(t,n){return this._x=t.getX(n),this._y=t.getY(n),this._z=t.getZ(n),this._w=t.getW(n),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},L=class e{static{e.prototype.isVector3=!0}constructor(t=0,n=0,i=0){this.x=t,this.y=n,this.z=i}set(t,n,i){return i===void 0&&(i=this.z),this.x=t,this.y=n,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this.z=t.z+n.z,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this.z+=t.z*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this.z=t.z-n.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,n){return this.x=t.x*n.x,this.y=t.y*n.y,this.z=t.z*n.z,this}applyEuler(t){return this.applyQuaternion(Ib.setFromEuler(t))}applyAxisAngle(t,n){return this.applyQuaternion(Ib.setFromAxisAngle(t,n))}applyMatrix3(t){let n=this.x,i=this.y,s=this.z,a=t.elements;return this.x=a[0]*n+a[3]*i+a[6]*s,this.y=a[1]*n+a[4]*i+a[7]*s,this.z=a[2]*n+a[5]*i+a[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let n=this.x,i=this.y,s=this.z,a=t.elements,r=1/(a[3]*n+a[7]*i+a[11]*s+a[15]);return this.x=(a[0]*n+a[4]*i+a[8]*s+a[12])*r,this.y=(a[1]*n+a[5]*i+a[9]*s+a[13])*r,this.z=(a[2]*n+a[6]*i+a[10]*s+a[14])*r,this}applyQuaternion(t){let n=this.x,i=this.y,s=this.z,a=t.x,r=t.y,o=t.z,l=t.w,c=2*(r*s-o*i),h=2*(o*n-a*s),p=2*(a*i-r*n);return this.x=n+l*c+r*p-o*h,this.y=i+l*h+o*c-a*p,this.z=s+l*p+a*h-r*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let n=this.x,i=this.y,s=this.z,a=t.elements;return this.x=a[0]*n+a[4]*i+a[8]*s,this.y=a[1]*n+a[5]*i+a[9]*s,this.z=a[2]*n+a[6]*i+a[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,n){return this.x=Zt(this.x,t.x,n.x),this.y=Zt(this.y,t.y,n.y),this.z=Zt(this.z,t.z,n.z),this}clampScalar(t,n){return this.x=Zt(this.x,t,n),this.y=Zt(this.y,t,n),this.z=Zt(this.z,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Zt(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this.z+=(t.z-this.z)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this.z=t.z+(n.z-t.z)*i,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,n){let i=t.x,s=t.y,a=t.z,r=n.x,o=n.y,l=n.z;return this.x=s*l-a*o,this.y=a*r-i*l,this.z=i*o-s*r,this}projectOnVector(t){let n=t.lengthSq();if(n===0)return this.set(0,0,0);let i=t.dot(this)/n;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return og.copy(this).projectOnVector(t),this.sub(og)}reflect(t){return this.sub(og.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let n=Math.sqrt(this.lengthSq()*t.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(t)/n;return Math.acos(Zt(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let n=this.x-t.x,i=this.y-t.y,s=this.z-t.z;return n*n+i*i+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,n,i){let s=Math.sin(n)*t;return this.x=s*Math.sin(i),this.y=Math.cos(n)*t,this.z=s*Math.cos(i),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,n,i){return this.x=t*Math.sin(n),this.y=i,this.z=t*Math.cos(n),this}setFromMatrixPosition(t){let n=t.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this}setFromMatrixScale(t){let n=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=n,this.y=i,this.z=s,this}setFromMatrixColumn(t,n){return this.fromArray(t.elements,n*4)}setFromMatrix3Column(t,n){return this.fromArray(t.elements,n*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this.z=t[n+2],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t[n+2]=this.z,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this.z=t.getZ(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,n=Math.random()*2-1,i=Math.sqrt(1-n*n);return this.x=i*Math.cos(t),this.y=n,this.z=i*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},og=new L,Ib=new Xi,Bt=class e{static{e.prototype.isMatrix3=!0}constructor(t,n,i,s,a,r,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,n,i,s,a,r,o,l,c)}set(t,n,i,s,a,r,o,l,c){let h=this.elements;return h[0]=t,h[1]=s,h[2]=o,h[3]=n,h[4]=a,h[5]=l,h[6]=i,h[7]=r,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let n=this.elements,i=t.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],this}extractBasis(t,n,i){return t.setFromMatrix3Column(this,0),n.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let n=t.elements;return this.set(n[0],n[4],n[8],n[1],n[5],n[9],n[2],n[6],n[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,n){let i=t.elements,s=n.elements,a=this.elements,r=i[0],o=i[3],l=i[6],c=i[1],h=i[4],p=i[7],u=i[2],d=i[5],g=i[8],S=s[0],m=s[3],f=s[6],_=s[1],b=s[4],v=s[7],T=s[2],A=s[5],w=s[8];return a[0]=r*S+o*_+l*T,a[3]=r*m+o*b+l*A,a[6]=r*f+o*v+l*w,a[1]=c*S+h*_+p*T,a[4]=c*m+h*b+p*A,a[7]=c*f+h*v+p*w,a[2]=u*S+d*_+g*T,a[5]=u*m+d*b+g*A,a[8]=u*f+d*v+g*w,this}multiplyScalar(t){let n=this.elements;return n[0]*=t,n[3]*=t,n[6]*=t,n[1]*=t,n[4]*=t,n[7]*=t,n[2]*=t,n[5]*=t,n[8]*=t,this}determinant(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return n*r*h-n*o*c-i*a*h+i*o*l+s*a*c-s*r*l}invert(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],l=t[6],c=t[7],h=t[8],p=h*r-o*c,u=o*l-h*a,d=c*a-r*l,g=n*p+i*u+s*d;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let S=1/g;return t[0]=p*S,t[1]=(s*c-h*i)*S,t[2]=(o*i-s*r)*S,t[3]=u*S,t[4]=(h*n-s*l)*S,t[5]=(s*a-o*n)*S,t[6]=d*S,t[7]=(i*l-c*n)*S,t[8]=(r*n-i*a)*S,this}transpose(){let t,n=this.elements;return t=n[1],n[1]=n[3],n[3]=t,t=n[2],n[2]=n[6],n[6]=t,t=n[5],n[5]=n[7],n[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let n=this.elements;return t[0]=n[0],t[1]=n[3],t[2]=n[6],t[3]=n[1],t[4]=n[4],t[5]=n[7],t[6]=n[2],t[7]=n[5],t[8]=n[8],this}setUvTransform(t,n,i,s,a,r,o){let l=Math.cos(a),c=Math.sin(a);return this.set(i*l,i*c,-i*(l*r+c*o)+r+t,-s*c,s*l,-s*(-c*r+l*o)+o+n,0,0,1),this}scale(t,n){return Ja("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(lg.makeScale(t,n)),this}rotate(t){return Ja("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(lg.makeRotation(-t)),this}translate(t,n){return Ja("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(lg.makeTranslation(t,n)),this}makeTranslation(t,n){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,n,0,0,1),this}makeRotation(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,-i,0,i,n,0,0,0,1),this}makeScale(t,n){return this.set(t,0,0,0,n,0,0,0,1),this}equals(t){let n=this.elements,i=t.elements;for(let s=0;s<9;s++)if(n[s]!==i[s])return!1;return!0}fromArray(t,n=0){for(let i=0;i<9;i++)this.elements[i]=t[i+n];return this}toArray(t=[],n=0){let i=this.elements;return t[n]=i[0],t[n+1]=i[1],t[n+2]=i[2],t[n+3]=i[3],t[n+4]=i[4],t[n+5]=i[5],t[n+6]=i[6],t[n+7]=i[7],t[n+8]=i[8],t}clone(){return new this.constructor().fromArray(this.elements)}},lg=new Bt,Ob=new Bt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Pb=new Bt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function OT(){let e={enabled:!0,workingColorSpace:Ol,spaces:{},convert:function(s,a,r){return this.enabled===!1||a===r||!a||!r||(this.spaces[a].transfer===oe&&(s.r=Ss(s.r),s.g=Ss(s.g),s.b=Ss(s.b)),this.spaces[a].primaries!==this.spaces[r].primaries&&(s.applyMatrix3(this.spaces[a].toXYZ),s.applyMatrix3(this.spaces[r].fromXYZ)),this.spaces[r].transfer===oe&&(s.r=lo(s.r),s.g=lo(s.g),s.b=lo(s.b))),s},workingToColorSpace:function(s,a){return this.convert(s,this.workingColorSpace,a)},colorSpaceToWorking:function(s,a){return this.convert(s,a,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Ts?Pl:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,a=this.workingColorSpace){return s.fromArray(this.spaces[a].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,a,r){return s.copy(this.spaces[a].toXYZ).multiply(this.spaces[r].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,a){return Ja("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),e.workingToColorSpace(s,a)},toWorkingColorSpace:function(s,a){return Ja("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),e.colorSpaceToWorking(s,a)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],i=[.3127,.329];return e.define({[Ol]:{primaries:t,whitePoint:i,transfer:Pl,toXYZ:Ob,fromXYZ:Pb,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:Tn},outputColorSpaceConfig:{drawingBufferColorSpace:Tn}},[Tn]:{primaries:t,whitePoint:i,transfer:oe,toXYZ:Ob,fromXYZ:Pb,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:Tn}}}),e}var Qt=OT();function Ss(e){return e<.04045?e*.0773993808:Math.pow(e*.9478672986+.0521327014,2.4)}function lo(e){return e<.0031308?e*12.92:1.055*Math.pow(e,.41666)-.055}var Kr,Gh=class{static getDataURL(t,n="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let i;if(t instanceof HTMLCanvasElement)i=t;else{Kr===void 0&&(Kr=Bl("canvas")),Kr.width=t.width,Kr.height=t.height;let s=Kr.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),i=Kr}return i.toDataURL(n)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let n=Bl("canvas");n.width=t.width,n.height=t.height;let i=n.getContext("2d");i.drawImage(t,0,0,t.width,t.height);let s=i.getImageData(0,0,t.width,t.height),a=s.data;for(let r=0;r<a.length;r++)a[r]=Ss(a[r]/255)*255;return i.putImageData(s,0,0),n}else if(t.data){let n=t.data.slice(0);for(let i=0;i<n.length;i++)n instanceof Uint8Array||n instanceof Uint8ClampedArray?n[i]=Math.floor(Ss(n[i]/255)*255):n[i]=Ss(n[i]);return{data:n,width:t.width,height:t.height}}else return Lt("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},PT=0,uo=class{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:PT++}),this.uuid=dc(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let n=this.data;return typeof HTMLVideoElement<"u"&&n instanceof HTMLVideoElement?t.set(n.videoWidth,n.videoHeight,0):typeof VideoFrame<"u"&&n instanceof VideoFrame?t.set(n.displayWidth,n.displayHeight,0):n!==null?t.set(n.width,n.height,n.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let n=t===void 0||typeof t=="string";if(!n&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let i={uuid:this.uuid,url:""},s=this.data;if(s!==null){let a;if(Array.isArray(s)){a=[];for(let r=0,o=s.length;r<o;r++)s[r].isDataTexture?a.push(cg(s[r].image)):a.push(cg(s[r]))}else a=cg(s);i.url=a}return n||(t.images[this.uuid]=i),i}};function cg(e){return typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap?Gh.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(Lt("Texture: Unable to serialize Texture."),{})}var zT=0,ug=new L,xn=class e extends ki{constructor(t=e.DEFAULT_IMAGE,n=e.DEFAULT_MAPPING,i=Vi,s=Vi,a=dn,r=ya,o=mi,l=$n,c=e.DEFAULT_ANISOTROPY,h=Ts){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:zT++}),this.uuid=dc(),this.name="",this.source=new uo(t),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=i,this.wrapT=s,this.magFilter=a,this.minFilter=r,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Ut(0,0),this.repeat=new Ut(1,1),this.center=new Ut(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Bt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(ug).x}get height(){return this.source.getSize(ug).y}get depth(){return this.source.getSize(ug).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,n){this.updateRanges.push({start:t,count:n})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let n in t){let i=t[n];if(i===void 0){Lt(`Texture.setValues(): parameter '${n}' has value of undefined.`);continue}let s=this[n];if(s===void 0){Lt(`Texture.setValues(): property '${n}' does not exist.`);continue}s&&i&&s.isVector2&&i.isVector2||s&&i&&s.isVector3&&i.isVector3||s&&i&&s.isMatrix3&&i.isMatrix3?s.copy(i):this[n]=i}}toJSON(t){let n=t===void 0||typeof t=="string";if(!n&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),n||(t.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==$g)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Bh:t.x=t.x-Math.floor(t.x);break;case Vi:t.x=t.x<0?0:1;break;case Fh:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Bh:t.y=t.y-Math.floor(t.y);break;case Vi:t.y=t.y<0?0:1;break;case Fh:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};xn.DEFAULT_IMAGE=null;xn.DEFAULT_MAPPING=$g;xn.DEFAULT_ANISOTROPY=1;var Ie=class e{static{e.prototype.isVector4=!0}constructor(t=0,n=0,i=0,s=1){this.x=t,this.y=n,this.z=i,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,n,i,s){return this.x=t,this.y=n,this.z=i,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;case 3:this.w=n;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this.z=t.z+n.z,this.w=t.w+n.w,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this.z+=t.z*n,this.w+=t.w*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this.z=t.z-n.z,this.w=t.w-n.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let n=this.x,i=this.y,s=this.z,a=this.w,r=t.elements;return this.x=r[0]*n+r[4]*i+r[8]*s+r[12]*a,this.y=r[1]*n+r[5]*i+r[9]*s+r[13]*a,this.z=r[2]*n+r[6]*i+r[10]*s+r[14]*a,this.w=r[3]*n+r[7]*i+r[11]*s+r[15]*a,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let n=Math.sqrt(1-t.w*t.w);return n<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/n,this.y=t.y/n,this.z=t.z/n),this}setAxisAngleFromRotationMatrix(t){let n,i,s,a,l=t.elements,c=l[0],h=l[4],p=l[8],u=l[1],d=l[5],g=l[9],S=l[2],m=l[6],f=l[10];if(Math.abs(h-u)<.01&&Math.abs(p-S)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+u)<.1&&Math.abs(p+S)<.1&&Math.abs(g+m)<.1&&Math.abs(c+d+f-3)<.1)return this.set(1,0,0,0),this;n=Math.PI;let b=(c+1)/2,v=(d+1)/2,T=(f+1)/2,A=(h+u)/4,w=(p+S)/4,y=(g+m)/4;return b>v&&b>T?b<.01?(i=0,s=.707106781,a=.707106781):(i=Math.sqrt(b),s=A/i,a=w/i):v>T?v<.01?(i=.707106781,s=0,a=.707106781):(s=Math.sqrt(v),i=A/s,a=y/s):T<.01?(i=.707106781,s=.707106781,a=0):(a=Math.sqrt(T),i=w/a,s=y/a),this.set(i,s,a,n),this}let _=Math.sqrt((m-g)*(m-g)+(p-S)*(p-S)+(u-h)*(u-h));return Math.abs(_)<.001&&(_=1),this.x=(m-g)/_,this.y=(p-S)/_,this.z=(u-h)/_,this.w=Math.acos((c+d+f-1)/2),this}setFromMatrixPosition(t){let n=t.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this.w=n[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,n){return this.x=Zt(this.x,t.x,n.x),this.y=Zt(this.y,t.y,n.y),this.z=Zt(this.z,t.z,n.z),this.w=Zt(this.w,t.w,n.w),this}clampScalar(t,n){return this.x=Zt(this.x,t,n),this.y=Zt(this.y,t,n),this.z=Zt(this.z,t,n),this.w=Zt(this.w,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Zt(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this.z+=(t.z-this.z)*n,this.w+=(t.w-this.w)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this.z=t.z+(n.z-t.z)*i,this.w=t.w+(n.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this.z=t[n+2],this.w=t[n+3],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t[n+2]=this.z,t[n+3]=this.w,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this.z=t.getZ(n),this.w=t.getW(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},kh=class extends ki{constructor(t=1,n=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:dn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=t,this.height=n,this.depth=i.depth,this.scissor=new Ie(0,0,t,n),this.scissorTest=!1,this.viewport=new Ie(0,0,t,n),this.textures=[];let s={width:t,height:n,depth:i.depth},a=new xn(s),r=i.count;for(let o=0;o<r;o++)this.textures[o]=a.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(t={}){let n={minFilter:dn,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(n.mapping=t.mapping),t.wrapS!==void 0&&(n.wrapS=t.wrapS),t.wrapT!==void 0&&(n.wrapT=t.wrapT),t.wrapR!==void 0&&(n.wrapR=t.wrapR),t.magFilter!==void 0&&(n.magFilter=t.magFilter),t.minFilter!==void 0&&(n.minFilter=t.minFilter),t.format!==void 0&&(n.format=t.format),t.type!==void 0&&(n.type=t.type),t.anisotropy!==void 0&&(n.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(n.colorSpace=t.colorSpace),t.flipY!==void 0&&(n.flipY=t.flipY),t.generateMipmaps!==void 0&&(n.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(n.internalFormat=t.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(n)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),t!==null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,n,i=1){if(this.width!==t||this.height!==n||this.depth!==i){this.width=t,this.height=n,this.depth=i;for(let s=0,a=this.textures.length;s<a;s++)this.textures[s].image.width=t,this.textures[s].image.height=n,this.textures[s].image.depth=i,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,n),this.scissor.set(0,0,t,n)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,i=t.textures.length;n<i;n++){this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0,this.textures[n].renderTarget=this;let s=Object.assign({},t.textures[n].image);this.textures[n].source=new uo(s)}return this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},Jn=class extends kh{constructor(t=1,n=1,i={}){super(t,n,i),this.isWebGLRenderTarget=!0}},Fl=class extends xn{constructor(t=null,n=1,i=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:n,height:i,depth:s},this.magFilter=rn,this.minFilter=rn,this.wrapR=Vi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var Xh=class extends xn{constructor(t=null,n=1,i=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:n,height:i,depth:s},this.magFilter=rn,this.minFilter=rn,this.wrapR=Vi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Le=class e{static{e.prototype.isMatrix4=!0}constructor(t,n,i,s,a,r,o,l,c,h,p,u,d,g,S,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,n,i,s,a,r,o,l,c,h,p,u,d,g,S,m)}set(t,n,i,s,a,r,o,l,c,h,p,u,d,g,S,m){let f=this.elements;return f[0]=t,f[4]=n,f[8]=i,f[12]=s,f[1]=a,f[5]=r,f[9]=o,f[13]=l,f[2]=c,f[6]=h,f[10]=p,f[14]=u,f[3]=d,f[7]=g,f[11]=S,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(t){let n=this.elements,i=t.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],n[9]=i[9],n[10]=i[10],n[11]=i[11],n[12]=i[12],n[13]=i[13],n[14]=i[14],n[15]=i[15],this}copyPosition(t){let n=this.elements,i=t.elements;return n[12]=i[12],n[13]=i[13],n[14]=i[14],this}setFromMatrix3(t){let n=t.elements;return this.set(n[0],n[3],n[6],0,n[1],n[4],n[7],0,n[2],n[5],n[8],0,0,0,0,1),this}extractBasis(t,n,i){return this.determinantAffine()===0?(t.set(1,0,0),n.set(0,1,0),i.set(0,0,1),this):(t.setFromMatrixColumn(this,0),n.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(t,n,i){return this.set(t.x,n.x,i.x,0,t.y,n.y,i.y,0,t.z,n.z,i.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let n=this.elements,i=t.elements,s=1/jr.setFromMatrixColumn(t,0).length(),a=1/jr.setFromMatrixColumn(t,1).length(),r=1/jr.setFromMatrixColumn(t,2).length();return n[0]=i[0]*s,n[1]=i[1]*s,n[2]=i[2]*s,n[3]=0,n[4]=i[4]*a,n[5]=i[5]*a,n[6]=i[6]*a,n[7]=0,n[8]=i[8]*r,n[9]=i[9]*r,n[10]=i[10]*r,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromEuler(t){let n=this.elements,i=t.x,s=t.y,a=t.z,r=Math.cos(i),o=Math.sin(i),l=Math.cos(s),c=Math.sin(s),h=Math.cos(a),p=Math.sin(a);if(t.order==="XYZ"){let u=r*h,d=r*p,g=o*h,S=o*p;n[0]=l*h,n[4]=-l*p,n[8]=c,n[1]=d+g*c,n[5]=u-S*c,n[9]=-o*l,n[2]=S-u*c,n[6]=g+d*c,n[10]=r*l}else if(t.order==="YXZ"){let u=l*h,d=l*p,g=c*h,S=c*p;n[0]=u+S*o,n[4]=g*o-d,n[8]=r*c,n[1]=r*p,n[5]=r*h,n[9]=-o,n[2]=d*o-g,n[6]=S+u*o,n[10]=r*l}else if(t.order==="ZXY"){let u=l*h,d=l*p,g=c*h,S=c*p;n[0]=u-S*o,n[4]=-r*p,n[8]=g+d*o,n[1]=d+g*o,n[5]=r*h,n[9]=S-u*o,n[2]=-r*c,n[6]=o,n[10]=r*l}else if(t.order==="ZYX"){let u=r*h,d=r*p,g=o*h,S=o*p;n[0]=l*h,n[4]=g*c-d,n[8]=u*c+S,n[1]=l*p,n[5]=S*c+u,n[9]=d*c-g,n[2]=-c,n[6]=o*l,n[10]=r*l}else if(t.order==="YZX"){let u=r*l,d=r*c,g=o*l,S=o*c;n[0]=l*h,n[4]=S-u*p,n[8]=g*p+d,n[1]=p,n[5]=r*h,n[9]=-o*h,n[2]=-c*h,n[6]=d*p+g,n[10]=u-S*p}else if(t.order==="XZY"){let u=r*l,d=r*c,g=o*l,S=o*c;n[0]=l*h,n[4]=-p,n[8]=c*h,n[1]=u*p+S,n[5]=r*h,n[9]=d*p-g,n[2]=g*p-d,n[6]=o*h,n[10]=S*p+u}return n[3]=0,n[7]=0,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromQuaternion(t){return this.compose(BT,t,FT)}lookAt(t,n,i){let s=this.elements;return qn.subVectors(t,n),qn.lengthSq()===0&&(qn.z=1),qn.normalize(),ia.crossVectors(i,qn),ia.lengthSq()===0&&(Math.abs(i.z)===1?qn.x+=1e-4:qn.z+=1e-4,qn.normalize(),ia.crossVectors(i,qn)),ia.normalize(),nh.crossVectors(qn,ia),s[0]=ia.x,s[4]=nh.x,s[8]=qn.x,s[1]=ia.y,s[5]=nh.y,s[9]=qn.y,s[2]=ia.z,s[6]=nh.z,s[10]=qn.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,n){let i=t.elements,s=n.elements,a=this.elements,r=i[0],o=i[4],l=i[8],c=i[12],h=i[1],p=i[5],u=i[9],d=i[13],g=i[2],S=i[6],m=i[10],f=i[14],_=i[3],b=i[7],v=i[11],T=i[15],A=s[0],w=s[4],y=s[8],M=s[12],R=s[1],D=s[5],I=s[9],z=s[13],q=s[2],O=s[6],G=s[10],V=s[14],K=s[3],it=s[7],ht=s[11],ft=s[15];return a[0]=r*A+o*R+l*q+c*K,a[4]=r*w+o*D+l*O+c*it,a[8]=r*y+o*I+l*G+c*ht,a[12]=r*M+o*z+l*V+c*ft,a[1]=h*A+p*R+u*q+d*K,a[5]=h*w+p*D+u*O+d*it,a[9]=h*y+p*I+u*G+d*ht,a[13]=h*M+p*z+u*V+d*ft,a[2]=g*A+S*R+m*q+f*K,a[6]=g*w+S*D+m*O+f*it,a[10]=g*y+S*I+m*G+f*ht,a[14]=g*M+S*z+m*V+f*ft,a[3]=_*A+b*R+v*q+T*K,a[7]=_*w+b*D+v*O+T*it,a[11]=_*y+b*I+v*G+T*ht,a[15]=_*M+b*z+v*V+T*ft,this}multiplyScalar(t){let n=this.elements;return n[0]*=t,n[4]*=t,n[8]*=t,n[12]*=t,n[1]*=t,n[5]*=t,n[9]*=t,n[13]*=t,n[2]*=t,n[6]*=t,n[10]*=t,n[14]*=t,n[3]*=t,n[7]*=t,n[11]*=t,n[15]*=t,this}determinant(){let t=this.elements,n=t[0],i=t[4],s=t[8],a=t[12],r=t[1],o=t[5],l=t[9],c=t[13],h=t[2],p=t[6],u=t[10],d=t[14],g=t[3],S=t[7],m=t[11],f=t[15],_=l*d-c*u,b=o*d-c*p,v=o*u-l*p,T=r*d-c*h,A=r*u-l*h,w=r*p-o*h;return n*(S*_-m*b+f*v)-i*(g*_-m*T+f*A)+s*(g*b-S*T+f*w)-a*(g*v-S*A+m*w)}determinantAffine(){let t=this.elements,n=t[0],i=t[4],s=t[8],a=t[1],r=t[5],o=t[9],l=t[2],c=t[6],h=t[10];return n*(r*h-o*c)-i*(a*h-o*l)+s*(a*c-r*l)}transpose(){let t=this.elements,n;return n=t[1],t[1]=t[4],t[4]=n,n=t[2],t[2]=t[8],t[8]=n,n=t[6],t[6]=t[9],t[9]=n,n=t[3],t[3]=t[12],t[12]=n,n=t[7],t[7]=t[13],t[13]=n,n=t[11],t[11]=t[14],t[14]=n,this}setPosition(t,n,i){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=n,s[14]=i),this}invert(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],l=t[6],c=t[7],h=t[8],p=t[9],u=t[10],d=t[11],g=t[12],S=t[13],m=t[14],f=t[15],_=n*o-i*r,b=n*l-s*r,v=n*c-a*r,T=i*l-s*o,A=i*c-a*o,w=s*c-a*l,y=h*S-p*g,M=h*m-u*g,R=h*f-d*g,D=p*m-u*S,I=p*f-d*S,z=u*f-d*m,q=_*z-b*I+v*D+T*R-A*M+w*y;if(q===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let O=1/q;return t[0]=(o*z-l*I+c*D)*O,t[1]=(s*I-i*z-a*D)*O,t[2]=(S*w-m*A+f*T)*O,t[3]=(u*A-p*w-d*T)*O,t[4]=(l*R-r*z-c*M)*O,t[5]=(n*z-s*R+a*M)*O,t[6]=(m*v-g*w-f*b)*O,t[7]=(h*w-u*v+d*b)*O,t[8]=(r*I-o*R+c*y)*O,t[9]=(i*R-n*I-a*y)*O,t[10]=(g*A-S*v+f*_)*O,t[11]=(p*v-h*A-d*_)*O,t[12]=(o*M-r*D-l*y)*O,t[13]=(n*D-i*M+s*y)*O,t[14]=(S*b-g*T-m*_)*O,t[15]=(h*T-p*b+u*_)*O,this}scale(t){let n=this.elements,i=t.x,s=t.y,a=t.z;return n[0]*=i,n[4]*=s,n[8]*=a,n[1]*=i,n[5]*=s,n[9]*=a,n[2]*=i,n[6]*=s,n[10]*=a,n[3]*=i,n[7]*=s,n[11]*=a,this}getMaxScaleOnAxis(){let t=this.elements,n=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(n,i,s))}makeTranslation(t,n,i){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,n,0,0,1,i,0,0,0,1),this}makeRotationX(t){let n=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,n,-i,0,0,i,n,0,0,0,0,1),this}makeRotationY(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,0,i,0,0,1,0,0,-i,0,n,0,0,0,0,1),this}makeRotationZ(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,-i,0,0,i,n,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,n){let i=Math.cos(n),s=Math.sin(n),a=1-i,r=t.x,o=t.y,l=t.z,c=a*r,h=a*o;return this.set(c*r+i,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+i,h*l-s*r,0,c*l-s*o,h*l+s*r,a*l*l+i,0,0,0,0,1),this}makeScale(t,n,i){return this.set(t,0,0,0,0,n,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,n,i,s,a,r){return this.set(1,i,a,0,t,1,r,0,n,s,1,0,0,0,0,1),this}compose(t,n,i){let s=this.elements,a=n._x,r=n._y,o=n._z,l=n._w,c=a+a,h=r+r,p=o+o,u=a*c,d=a*h,g=a*p,S=r*h,m=r*p,f=o*p,_=l*c,b=l*h,v=l*p,T=i.x,A=i.y,w=i.z;return s[0]=(1-(S+f))*T,s[1]=(d+v)*T,s[2]=(g-b)*T,s[3]=0,s[4]=(d-v)*A,s[5]=(1-(u+f))*A,s[6]=(m+_)*A,s[7]=0,s[8]=(g+b)*w,s[9]=(m-_)*w,s[10]=(1-(u+S))*w,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,n,i){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let a=this.determinantAffine();if(a===0)return i.set(1,1,1),n.identity(),this;let r=jr.set(s[0],s[1],s[2]).length(),o=jr.set(s[4],s[5],s[6]).length(),l=jr.set(s[8],s[9],s[10]).length();a<0&&(r=-r),yi.copy(this);let c=1/r,h=1/o,p=1/l;return yi.elements[0]*=c,yi.elements[1]*=c,yi.elements[2]*=c,yi.elements[4]*=h,yi.elements[5]*=h,yi.elements[6]*=h,yi.elements[8]*=p,yi.elements[9]*=p,yi.elements[10]*=p,n.setFromRotationMatrix(yi),i.x=r,i.y=o,i.z=l,this}makePerspective(t,n,i,s,a,r,o=Si,l=!1){let c=this.elements,h=2*a/(n-t),p=2*a/(i-s),u=(n+t)/(n-t),d=(i+s)/(i-s),g,S;if(l)g=a/(r-a),S=r*a/(r-a);else if(o===Si)g=-(r+a)/(r-a),S=-2*r*a/(r-a);else if(o===zl)g=-r/(r-a),S=-r*a/(r-a);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=p,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=S,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,n,i,s,a,r,o=Si,l=!1){let c=this.elements,h=2/(n-t),p=2/(i-s),u=-(n+t)/(n-t),d=-(i+s)/(i-s),g,S;if(l)g=1/(r-a),S=r/(r-a);else if(o===Si)g=-2/(r-a),S=-(r+a)/(r-a);else if(o===zl)g=-1/(r-a),S=-a/(r-a);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=p,c[9]=0,c[13]=d,c[2]=0,c[6]=0,c[10]=g,c[14]=S,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){let n=this.elements,i=t.elements;for(let s=0;s<16;s++)if(n[s]!==i[s])return!1;return!0}fromArray(t,n=0){for(let i=0;i<16;i++)this.elements[i]=t[i+n];return this}toArray(t=[],n=0){let i=this.elements;return t[n]=i[0],t[n+1]=i[1],t[n+2]=i[2],t[n+3]=i[3],t[n+4]=i[4],t[n+5]=i[5],t[n+6]=i[6],t[n+7]=i[7],t[n+8]=i[8],t[n+9]=i[9],t[n+10]=i[10],t[n+11]=i[11],t[n+12]=i[12],t[n+13]=i[13],t[n+14]=i[14],t[n+15]=i[15],t}},jr=new L,yi=new Le,BT=new L(0,0,0),FT=new L(1,1,1),ia=new L,nh=new L,qn=new L,zb=new Le,Bb=new Xi,ua=class e{constructor(t=0,n=0,i=0,s=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=i,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,n,i,s=this._order){return this._x=t,this._y=n,this._z=i,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,n=this._order,i=!0){let s=t.elements,a=s[0],r=s[4],o=s[8],l=s[1],c=s[5],h=s[9],p=s[2],u=s[6],d=s[10];switch(n){case"XYZ":this._y=Math.asin(Zt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,d),this._z=Math.atan2(-r,a)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Zt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,d),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-p,a),this._z=0);break;case"ZXY":this._x=Math.asin(Zt(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-p,d),this._z=Math.atan2(-r,c)):(this._y=0,this._z=Math.atan2(l,a));break;case"ZYX":this._y=Math.asin(-Zt(p,-1,1)),Math.abs(p)<.9999999?(this._x=Math.atan2(u,d),this._z=Math.atan2(l,a)):(this._x=0,this._z=Math.atan2(-r,c));break;case"YZX":this._z=Math.asin(Zt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-p,a)):(this._x=0,this._y=Math.atan2(o,d));break;case"XZY":this._z=Math.asin(-Zt(r,-1,1)),Math.abs(r)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(o,a)):(this._x=Math.atan2(-h,d),this._y=0);break;default:Lt("Euler: .setFromRotationMatrix() encountered an unknown order: "+n)}return this._order=n,i===!0&&this._onChangeCallback(),this}setFromQuaternion(t,n,i){return zb.makeRotationFromQuaternion(t),this.setFromRotationMatrix(zb,n,i)}setFromVector3(t,n=this._order){return this.set(t.x,t.y,t.z,n)}reorder(t){return Bb.setFromEuler(this),this.setFromQuaternion(Bb,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],n=0){return t[n]=this._x,t[n+1]=this._y,t[n+2]=this._z,t[n+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};ua.DEFAULT_ORDER="XYZ";var Vl=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},VT=0,Fb=new L,Qr=new Xi,gs=new Le,ih=new L,wl=new L,HT=new L,GT=new Xi,Vb=new L(1,0,0),Hb=new L(0,1,0),Gb=new L(0,0,1),kb={type:"added"},kT={type:"removed"},$r={type:"childadded",child:null},hg={type:"childremoved",child:null},Kn=class e extends ki{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:VT++}),this.uuid=dc(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new L,n=new ua,i=new Xi,s=new L(1,1,1);function a(){i.setFromEuler(n,!1)}function r(){n.setFromQuaternion(i,void 0,!1)}n._onChange(a),i._onChange(r),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Le},normalMatrix:{value:new Bt}}),this.matrix=new Le,this.matrixWorld=new Le,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Vl,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,n){this.quaternion.setFromAxisAngle(t,n)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,n){return Qr.setFromAxisAngle(t,n),this.quaternion.multiply(Qr),this}rotateOnWorldAxis(t,n){return Qr.setFromAxisAngle(t,n),this.quaternion.premultiply(Qr),this}rotateX(t){return this.rotateOnAxis(Vb,t)}rotateY(t){return this.rotateOnAxis(Hb,t)}rotateZ(t){return this.rotateOnAxis(Gb,t)}translateOnAxis(t,n){return Fb.copy(t).applyQuaternion(this.quaternion),this.position.add(Fb.multiplyScalar(n)),this}translateX(t){return this.translateOnAxis(Vb,t)}translateY(t){return this.translateOnAxis(Hb,t)}translateZ(t){return this.translateOnAxis(Gb,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(gs.copy(this.matrixWorld).invert())}lookAt(t,n,i){t.isVector3?ih.copy(t):ih.set(t,n,i);let s=this.parent;this.updateWorldMatrix(!0,!1),wl.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?gs.lookAt(wl,ih,this.up):gs.lookAt(ih,wl,this.up),this.quaternion.setFromRotationMatrix(gs),s&&(gs.extractRotation(s.matrixWorld),Qr.setFromRotationMatrix(gs),this.quaternion.premultiply(Qr.invert()))}add(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.add(arguments[n]);return this}return t===this?(Ot("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(kb),$r.child=t,this.dispatchEvent($r),$r.child=null):Ot("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let n=this.children.indexOf(t);return n!==-1&&(t.parent=null,this.children.splice(n,1),t.dispatchEvent(kT),hg.child=t,this.dispatchEvent(hg),hg.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),gs.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),gs.multiply(t.parent.matrixWorld)),t.applyMatrix4(gs),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(kb),$r.child=t,this.dispatchEvent($r),$r.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,n){if(this[t]===n)return this;for(let i=0,s=this.children.length;i<s;i++){let r=this.children[i].getObjectByProperty(t,n);if(r!==void 0)return r}}getObjectsByProperty(t,n,i=[]){this[t]===n&&i.push(this);let s=this.children;for(let a=0,r=s.length;a<r;a++)s[a].getObjectsByProperty(t,n,i);return i}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(wl,t,HT),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(wl,GT,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let n=this.matrixWorld.elements;return t.set(n[8],n[9],n[10]).normalize()}raycast(){}traverse(t){t(this);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].traverseVisible(t)}traverseAncestors(t){let n=this.parent;n!==null&&(t(n),n.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let n=t.x,i=t.y,s=t.z,a=this.matrix.elements;a[12]+=n-a[0]*n-a[4]*i-a[8]*s,a[13]+=i-a[1]*n-a[5]*i-a[9]*s,a[14]+=s-a[2]*n-a[6]*i-a[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].updateMatrixWorld(t)}updateWorldMatrix(t,n,i=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),n===!0){let a=this.children;for(let r=0,o=a.length;r<o;r++)a[r].updateWorldMatrix(!1,!0,i)}}toJSON(t){let n=t===void 0||typeof t=="string",i={};n&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function a(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=a(t.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let p=l[c];a(t.shapes,p)}else a(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(a(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(a(t.materials,this.material[l]));s.material=o}else s.material=a(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];s.animations.push(a(t.animations,l))}}if(n){let o=r(t.geometries),l=r(t.materials),c=r(t.textures),h=r(t.images),p=r(t.shapes),u=r(t.skeletons),d=r(t.animations),g=r(t.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),p.length>0&&(i.shapes=p),u.length>0&&(i.skeletons=u),d.length>0&&(i.animations=d),g.length>0&&(i.nodes=g)}return i.object=s,i;function r(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,n=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),n===!0)for(let i=0;i<t.children.length;i++){let s=t.children[i];this.add(s.clone())}return this}};Kn.DEFAULT_UP=new L(0,1,0);Kn.DEFAULT_MATRIX_AUTO_UPDATE=!0;Kn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Hi=class extends Kn{constructor(){super(),this.isGroup=!0,this.type="Group"}},XT={type:"move"},ho=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Hi,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Hi,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new L,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new L),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Hi,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new L,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new L,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let n=this._hand;if(n)for(let i of t.hand.values())this._getHandJoint(n,i)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,n,i){let s=null,a=null,r=null,o=this._targetRay,l=this._grip,c=this._hand;if(t&&n.session.visibilityState!=="visible-blurred"){if(c&&t.hand){r=!0;for(let S of t.hand.values()){let m=n.getJointPose(S,i),f=this._getHandJoint(c,S);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}let h=c.joints["index-finger-tip"],p=c.joints["thumb-tip"],u=h.position.distanceTo(p.position),d=.02,g=.005;c.inputState.pinching&&u>d+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&u<=d-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(a=n.getPose(t.gripSpace,i),a!==null&&(l.matrix.fromArray(a.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,a.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(a.linearVelocity)):l.hasLinearVelocity=!1,a.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(a.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:t,target:this})));o!==null&&(s=n.getPose(t.targetRaySpace,i),s===null&&a!==null&&(s=a),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(XT)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=a!==null),c!==null&&(c.visible=r!==null),this}_getHandJoint(t,n){if(t.joints[n.jointName]===void 0){let i=new Hi;i.matrixAutoUpdate=!1,i.visible=!1,t.joints[n.jointName]=i,t.add(i)}return t.joints[n.jointName]}},VS={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},sa={h:0,s:0,l:0},sh={h:0,s:0,l:0};function fg(e,t,n){return n<0&&(n+=1),n>1&&(n-=1),n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var $t=class{constructor(t,n,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,n,i)}set(t,n,i){if(n===void 0&&i===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,n,i);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,n=Tn){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Qt.colorSpaceToWorking(this,n),this}setRGB(t,n,i,s=Qt.workingColorSpace){return this.r=t,this.g=n,this.b=i,Qt.colorSpaceToWorking(this,s),this}setHSL(t,n,i,s=Qt.workingColorSpace){if(t=IT(t,1),n=Zt(n,0,1),i=Zt(i,0,1),n===0)this.r=this.g=this.b=i;else{let a=i<=.5?i*(1+n):i+n-i*n,r=2*i-a;this.r=fg(r,a,t+1/3),this.g=fg(r,a,t),this.b=fg(r,a,t-1/3)}return Qt.colorSpaceToWorking(this,s),this}setStyle(t,n=Tn){function i(a){a!==void 0&&parseFloat(a)<1&&Lt("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let a,r=s[1],o=s[2];switch(r){case"rgb":case"rgba":if(a=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setRGB(Math.min(255,parseInt(a[1],10))/255,Math.min(255,parseInt(a[2],10))/255,Math.min(255,parseInt(a[3],10))/255,n);if(a=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setRGB(Math.min(100,parseInt(a[1],10))/100,Math.min(100,parseInt(a[2],10))/100,Math.min(100,parseInt(a[3],10))/100,n);break;case"hsl":case"hsla":if(a=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setHSL(parseFloat(a[1])/360,parseFloat(a[2])/100,parseFloat(a[3])/100,n);break;default:Lt("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let a=s[1],r=a.length;if(r===3)return this.setRGB(parseInt(a.charAt(0),16)/15,parseInt(a.charAt(1),16)/15,parseInt(a.charAt(2),16)/15,n);if(r===6)return this.setHex(parseInt(a,16),n);Lt("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,n);return this}setColorName(t,n=Tn){let i=VS[t.toLowerCase()];return i!==void 0?this.setHex(i,n):Lt("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Ss(t.r),this.g=Ss(t.g),this.b=Ss(t.b),this}copyLinearToSRGB(t){return this.r=lo(t.r),this.g=lo(t.g),this.b=lo(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Tn){return Qt.workingToColorSpace(vn.copy(this),t),Math.round(Zt(vn.r*255,0,255))*65536+Math.round(Zt(vn.g*255,0,255))*256+Math.round(Zt(vn.b*255,0,255))}getHexString(t=Tn){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,n=Qt.workingColorSpace){Qt.workingToColorSpace(vn.copy(this),n);let i=vn.r,s=vn.g,a=vn.b,r=Math.max(i,s,a),o=Math.min(i,s,a),l,c,h=(o+r)/2;if(o===r)l=0,c=0;else{let p=r-o;switch(c=h<=.5?p/(r+o):p/(2-r-o),r){case i:l=(s-a)/p+(s<a?6:0);break;case s:l=(a-i)/p+2;break;case a:l=(i-s)/p+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,n=Qt.workingColorSpace){return Qt.workingToColorSpace(vn.copy(this),n),t.r=vn.r,t.g=vn.g,t.b=vn.b,t}getStyle(t=Tn){Qt.workingToColorSpace(vn.copy(this),t);let n=vn.r,i=vn.g,s=vn.b;return t!==Tn?`color(${t} ${n.toFixed(3)} ${i.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(n*255)},${Math.round(i*255)},${Math.round(s*255)})`}offsetHSL(t,n,i){return this.getHSL(sa),this.setHSL(sa.h+t,sa.s+n,sa.l+i)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,n){return this.r=t.r+n.r,this.g=t.g+n.g,this.b=t.b+n.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,n){return this.r+=(t.r-this.r)*n,this.g+=(t.g-this.g)*n,this.b+=(t.b-this.b)*n,this}lerpColors(t,n,i){return this.r=t.r+(n.r-t.r)*i,this.g=t.g+(n.g-t.g)*i,this.b=t.b+(n.b-t.b)*i,this}lerpHSL(t,n){this.getHSL(sa),t.getHSL(sh);let i=rg(sa.h,sh.h,n),s=rg(sa.s,sh.s,n),a=rg(sa.l,sh.l,n);return this.setHSL(i,s,a),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let n=this.r,i=this.g,s=this.b,a=t.elements;return this.r=a[0]*n+a[3]*i+a[6]*s,this.g=a[1]*n+a[4]*i+a[7]*s,this.b=a[2]*n+a[5]*i+a[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,n=0){return this.r=t[n],this.g=t[n+1],this.b=t[n+2],this}toArray(t=[],n=0){return t[n]=this.r,t[n+1]=this.g,t[n+2]=this.b,t}fromBufferAttribute(t,n){return this.r=t.getX(n),this.g=t.getY(n),this.b=t.getZ(n),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},vn=new $t;$t.NAMES=VS;var Hl=class extends Kn{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ua,this.environmentIntensity=1,this.environmentRotation=new ua,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,n){return super.copy(t,n),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let n=super.toJSON(t);return this.fog!==null&&(n.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(n.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(n.object.backgroundIntensity=this.backgroundIntensity),n.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(n.object.environmentIntensity=this.environmentIntensity),n.object.environmentRotation=this.environmentRotation.toArray(),n}},xi=new L,_s=new L,dg=new L,vs=new L,to=new L,eo=new L,Xb=new L,pg=new L,mg=new L,gg=new L,_g=new Ie,vg=new Ie,yg=new Ie,bs=class e{constructor(t=new L,n=new L,i=new L){this.a=t,this.b=n,this.c=i}static getNormal(t,n,i,s){s.subVectors(i,n),xi.subVectors(t,n),s.cross(xi);let a=s.lengthSq();return a>0?s.multiplyScalar(1/Math.sqrt(a)):s.set(0,0,0)}static getBarycoord(t,n,i,s,a){xi.subVectors(s,n),_s.subVectors(i,n),dg.subVectors(t,n);let r=xi.dot(xi),o=xi.dot(_s),l=xi.dot(dg),c=_s.dot(_s),h=_s.dot(dg),p=r*c-o*o;if(p===0)return a.set(0,0,0),null;let u=1/p,d=(c*l-o*h)*u,g=(r*h-o*l)*u;return a.set(1-d-g,g,d)}static containsPoint(t,n,i,s){return this.getBarycoord(t,n,i,s,vs)===null?!1:vs.x>=0&&vs.y>=0&&vs.x+vs.y<=1}static getInterpolation(t,n,i,s,a,r,o,l){return this.getBarycoord(t,n,i,s,vs)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(a,vs.x),l.addScaledVector(r,vs.y),l.addScaledVector(o,vs.z),l)}static getInterpolatedAttribute(t,n,i,s,a,r){return _g.setScalar(0),vg.setScalar(0),yg.setScalar(0),_g.fromBufferAttribute(t,n),vg.fromBufferAttribute(t,i),yg.fromBufferAttribute(t,s),r.setScalar(0),r.addScaledVector(_g,a.x),r.addScaledVector(vg,a.y),r.addScaledVector(yg,a.z),r}static isFrontFacing(t,n,i,s){return xi.subVectors(i,n),_s.subVectors(t,n),xi.cross(_s).dot(s)<0}set(t,n,i){return this.a.copy(t),this.b.copy(n),this.c.copy(i),this}setFromPointsAndIndices(t,n,i,s){return this.a.copy(t[n]),this.b.copy(t[i]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,n,i,s){return this.a.fromBufferAttribute(t,n),this.b.fromBufferAttribute(t,i),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return xi.subVectors(this.c,this.b),_s.subVectors(this.a,this.b),xi.cross(_s).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,i,s,a){return e.getInterpolation(t,this.a,this.b,this.c,n,i,s,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,n){let i=this.a,s=this.b,a=this.c,r,o;to.subVectors(s,i),eo.subVectors(a,i),pg.subVectors(t,i);let l=to.dot(pg),c=eo.dot(pg);if(l<=0&&c<=0)return n.copy(i);mg.subVectors(t,s);let h=to.dot(mg),p=eo.dot(mg);if(h>=0&&p<=h)return n.copy(s);let u=l*p-h*c;if(u<=0&&l>=0&&h<=0)return r=l/(l-h),n.copy(i).addScaledVector(to,r);gg.subVectors(t,a);let d=to.dot(gg),g=eo.dot(gg);if(g>=0&&d<=g)return n.copy(a);let S=d*c-l*g;if(S<=0&&c>=0&&g<=0)return o=c/(c-g),n.copy(i).addScaledVector(eo,o);let m=h*g-d*p;if(m<=0&&p-h>=0&&d-g>=0)return Xb.subVectors(a,s),o=(p-h)/(p-h+(d-g)),n.copy(s).addScaledVector(Xb,o);let f=1/(m+S+u);return r=S*f,o=u*f,n.copy(i).addScaledVector(to,r).addScaledVector(eo,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},ha=class{constructor(t=new L(1/0,1/0,1/0),n=new L(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=n}set(t,n){return this.min.copy(t),this.max.copy(n),this}setFromArray(t){this.makeEmpty();for(let n=0,i=t.length;n<i;n+=3)this.expandByPoint(bi.fromArray(t,n));return this}setFromBufferAttribute(t){this.makeEmpty();for(let n=0,i=t.count;n<i;n++)this.expandByPoint(bi.fromBufferAttribute(t,n));return this}setFromPoints(t){this.makeEmpty();for(let n=0,i=t.length;n<i;n++)this.expandByPoint(t[n]);return this}setFromCenterAndSize(t,n){let i=bi.copy(n).multiplyScalar(.5);return this.min.copy(t).sub(i),this.max.copy(t).add(i),this}setFromObject(t,n=!1){return this.makeEmpty(),this.expandByObject(t,n)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,n=!1){t.updateWorldMatrix(!1,!1);let i=t.geometry;if(i!==void 0){let a=i.getAttribute("position");if(n===!0&&a!==void 0&&t.isInstancedMesh!==!0)for(let r=0,o=a.count;r<o;r++)t.isMesh===!0?t.getVertexPosition(r,bi):bi.fromBufferAttribute(a,r),bi.applyMatrix4(t.matrixWorld),this.expandByPoint(bi);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),ah.copy(t.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),ah.copy(i.boundingBox)),ah.applyMatrix4(t.matrixWorld),this.union(ah)}let s=t.children;for(let a=0,r=s.length;a<r;a++)this.expandByObject(s[a],n);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,n){return n.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,bi),bi.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let n,i;return t.normal.x>0?(n=t.normal.x*this.min.x,i=t.normal.x*this.max.x):(n=t.normal.x*this.max.x,i=t.normal.x*this.min.x),t.normal.y>0?(n+=t.normal.y*this.min.y,i+=t.normal.y*this.max.y):(n+=t.normal.y*this.max.y,i+=t.normal.y*this.min.y),t.normal.z>0?(n+=t.normal.z*this.min.z,i+=t.normal.z*this.max.z):(n+=t.normal.z*this.max.z,i+=t.normal.z*this.min.z),n<=-t.constant&&i>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Cl),rh.subVectors(this.max,Cl),no.subVectors(t.a,Cl),io.subVectors(t.b,Cl),so.subVectors(t.c,Cl),aa.subVectors(io,no),ra.subVectors(so,io),Xa.subVectors(no,so);let n=[0,-aa.z,aa.y,0,-ra.z,ra.y,0,-Xa.z,Xa.y,aa.z,0,-aa.x,ra.z,0,-ra.x,Xa.z,0,-Xa.x,-aa.y,aa.x,0,-ra.y,ra.x,0,-Xa.y,Xa.x,0];return!xg(n,no,io,so,rh)||(n=[1,0,0,0,1,0,0,0,1],!xg(n,no,io,so,rh))?!1:(oh.crossVectors(aa,ra),n=[oh.x,oh.y,oh.z],xg(n,no,io,so,rh))}clampPoint(t,n){return n.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,bi).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(bi).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(ys[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),ys[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),ys[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),ys[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),ys[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),ys[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),ys[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),ys[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(ys),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},ys=[new L,new L,new L,new L,new L,new L,new L,new L],bi=new L,ah=new ha,no=new L,io=new L,so=new L,aa=new L,ra=new L,Xa=new L,Cl=new L,rh=new L,oh=new L,Wa=new L;function xg(e,t,n,i,s){for(let a=0,r=e.length-3;a<=r;a+=3){Wa.fromArray(e,a);let o=s.x*Math.abs(Wa.x)+s.y*Math.abs(Wa.y)+s.z*Math.abs(Wa.z),l=t.dot(Wa),c=n.dot(Wa),h=i.dot(Wa);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var Je=new L,lh=new Ut,WT=0,Zn=class extends ki{constructor(t,n,i=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:WT++}),this.name="",this.array=t,this.itemSize=n,this.count=t!==void 0?t.length/n:0,this.normalized=i,this.usage=Bg,this.updateRanges=[],this.gpuType=Ti,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,n){this.updateRanges.push({start:t,count:n})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,n,i){t*=this.itemSize,i*=n.itemSize;for(let s=0,a=this.itemSize;s<a;s++)this.array[t+s]=n.array[i+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let n=0,i=this.count;n<i;n++)lh.fromBufferAttribute(this,n),lh.applyMatrix3(t),this.setXY(n,lh.x,lh.y);else if(this.itemSize===3)for(let n=0,i=this.count;n<i;n++)Je.fromBufferAttribute(this,n),Je.applyMatrix3(t),this.setXYZ(n,Je.x,Je.y,Je.z);return this}applyMatrix4(t){for(let n=0,i=this.count;n<i;n++)Je.fromBufferAttribute(this,n),Je.applyMatrix4(t),this.setXYZ(n,Je.x,Je.y,Je.z);return this}applyNormalMatrix(t){for(let n=0,i=this.count;n<i;n++)Je.fromBufferAttribute(this,n),Je.applyNormalMatrix(t),this.setXYZ(n,Je.x,Je.y,Je.z);return this}transformDirection(t){for(let n=0,i=this.count;n<i;n++)Je.fromBufferAttribute(this,n),Je.transformDirection(t),this.setXYZ(n,Je.x,Je.y,Je.z);return this}set(t,n=0){return this.array.set(t,n),this}getComponent(t,n){let i=this.array[t*this.itemSize+n];return this.normalized&&(i=Al(i,this.array)),i}setComponent(t,n,i){return this.normalized&&(i=In(i,this.array)),this.array[t*this.itemSize+n]=i,this}getX(t){let n=this.array[t*this.itemSize];return this.normalized&&(n=Al(n,this.array)),n}setX(t,n){return this.normalized&&(n=In(n,this.array)),this.array[t*this.itemSize]=n,this}getY(t){let n=this.array[t*this.itemSize+1];return this.normalized&&(n=Al(n,this.array)),n}setY(t,n){return this.normalized&&(n=In(n,this.array)),this.array[t*this.itemSize+1]=n,this}getZ(t){let n=this.array[t*this.itemSize+2];return this.normalized&&(n=Al(n,this.array)),n}setZ(t,n){return this.normalized&&(n=In(n,this.array)),this.array[t*this.itemSize+2]=n,this}getW(t){let n=this.array[t*this.itemSize+3];return this.normalized&&(n=Al(n,this.array)),n}setW(t,n){return this.normalized&&(n=In(n,this.array)),this.array[t*this.itemSize+3]=n,this}setXY(t,n,i){return t*=this.itemSize,this.normalized&&(n=In(n,this.array),i=In(i,this.array)),this.array[t+0]=n,this.array[t+1]=i,this}setXYZ(t,n,i,s){return t*=this.itemSize,this.normalized&&(n=In(n,this.array),i=In(i,this.array),s=In(s,this.array)),this.array[t+0]=n,this.array[t+1]=i,this.array[t+2]=s,this}setXYZW(t,n,i,s,a){return t*=this.itemSize,this.normalized&&(n=In(n,this.array),i=In(i,this.array),s=In(s,this.array),a=In(a,this.array)),this.array[t+0]=n,this.array[t+1]=i,this.array[t+2]=s,this.array[t+3]=a,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Bg&&(t.usage=this.usage),t}dispose(){this.dispatchEvent({type:"dispose"})}};var Gl=class extends Zn{constructor(t,n,i){super(new Uint16Array(t),n,i)}};var kl=class extends Zn{constructor(t,n,i){super(new Uint32Array(t),n,i)}};var xe=class extends Zn{constructor(t,n,i){super(new Float32Array(t),n,i)}},qT=new ha,Rl=new L,bg=new L,Qa=class{constructor(t=new L,n=-1){this.isSphere=!0,this.center=t,this.radius=n}set(t,n){return this.center.copy(t),this.radius=n,this}setFromPoints(t,n){let i=this.center;n!==void 0?i.copy(n):qT.setFromPoints(t).getCenter(i);let s=0;for(let a=0,r=t.length;a<r;a++)s=Math.max(s,i.distanceToSquared(t[a]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let n=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=n*n}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,n){let i=this.center.distanceToSquared(t);return n.copy(t),i>this.radius*this.radius&&(n.sub(this.center).normalize(),n.multiplyScalar(this.radius).add(this.center)),n}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Rl.subVectors(t,this.center);let n=Rl.lengthSq();if(n>this.radius*this.radius){let i=Math.sqrt(n),s=(i-this.radius)*.5;this.center.addScaledVector(Rl,s/i),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(bg.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Rl.copy(t.center).add(bg)),this.expandByPoint(Rl.copy(t.center).sub(bg))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},YT=0,fi=new Le,Sg=new Kn,ao=new L,Yn=new ha,Dl=new ha,an=new L,on=class e extends ki{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:YT++}),this.uuid=dc(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(UT(t)?kl:Gl)(t,1):this.index=t,this}setIndirect(t,n=0){return this.indirect=t,this.indirectOffset=n,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,n){return this.attributes[t]=n,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,n,i=0){this.groups.push({start:t,count:n,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(t,n){this.drawRange.start=t,this.drawRange.count=n}applyMatrix4(t){let n=this.attributes.position;n!==void 0&&(n.applyMatrix4(t),n.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let a=new Bt().getNormalMatrix(t);i.applyNormalMatrix(a),i.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return fi.makeRotationFromQuaternion(t),this.applyMatrix4(fi),this}rotateX(t){return fi.makeRotationX(t),this.applyMatrix4(fi),this}rotateY(t){return fi.makeRotationY(t),this.applyMatrix4(fi),this}rotateZ(t){return fi.makeRotationZ(t),this.applyMatrix4(fi),this}translate(t,n,i){return fi.makeTranslation(t,n,i),this.applyMatrix4(fi),this}scale(t,n,i){return fi.makeScale(t,n,i),this.applyMatrix4(fi),this}lookAt(t){return Sg.lookAt(t),Sg.updateMatrix(),this.applyMatrix4(Sg.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ao).negate(),this.translate(ao.x,ao.y,ao.z),this}setFromPoints(t){let n=this.getAttribute("position");if(n===void 0){let i=[];for(let s=0,a=t.length;s<a;s++){let r=t[s];i.push(r.x,r.y,r.z||0)}this.setAttribute("position",new xe(i,3))}else{let i=Math.min(t.length,n.count);for(let s=0;s<i;s++){let a=t[s];n.setXYZ(s,a.x,a.y,a.z||0)}t.length>n.count&&Lt("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),n.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ha);let t=this.attributes.position,n=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ot("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new L(-1/0,-1/0,-1/0),new L(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),n)for(let i=0,s=n.length;i<s;i++){let a=n[i];Yn.setFromBufferAttribute(a),this.morphTargetsRelative?(an.addVectors(this.boundingBox.min,Yn.min),this.boundingBox.expandByPoint(an),an.addVectors(this.boundingBox.max,Yn.max),this.boundingBox.expandByPoint(an)):(this.boundingBox.expandByPoint(Yn.min),this.boundingBox.expandByPoint(Yn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ot('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Qa);let t=this.attributes.position,n=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ot("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new L,1/0);return}if(t){let i=this.boundingSphere.center;if(Yn.setFromBufferAttribute(t),n)for(let a=0,r=n.length;a<r;a++){let o=n[a];Dl.setFromBufferAttribute(o),this.morphTargetsRelative?(an.addVectors(Yn.min,Dl.min),Yn.expandByPoint(an),an.addVectors(Yn.max,Dl.max),Yn.expandByPoint(an)):(Yn.expandByPoint(Dl.min),Yn.expandByPoint(Dl.max))}Yn.getCenter(i);let s=0;for(let a=0,r=t.count;a<r;a++)an.fromBufferAttribute(t,a),s=Math.max(s,i.distanceToSquared(an));if(n)for(let a=0,r=n.length;a<r;a++){let o=n[a],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)an.fromBufferAttribute(o,c),l&&(ao.fromBufferAttribute(t,c),an.add(ao)),s=Math.max(s,i.distanceToSquared(an))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Ot('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,n=this.attributes;if(t===null||n.position===void 0||n.normal===void 0||n.uv===void 0){Ot("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=n.position,s=n.normal,a=n.uv,r=this.getAttribute("tangent");(r===void 0||r.count!==i.count)&&(r=new Zn(new Float32Array(4*i.count),4),this.setAttribute("tangent",r));let o=[],l=[];for(let y=0;y<i.count;y++)o[y]=new L,l[y]=new L;let c=new L,h=new L,p=new L,u=new Ut,d=new Ut,g=new Ut,S=new L,m=new L;function f(y,M,R){c.fromBufferAttribute(i,y),h.fromBufferAttribute(i,M),p.fromBufferAttribute(i,R),u.fromBufferAttribute(a,y),d.fromBufferAttribute(a,M),g.fromBufferAttribute(a,R),h.sub(c),p.sub(c),d.sub(u),g.sub(u);let D=1/(d.x*g.y-g.x*d.y);isFinite(D)&&(S.copy(h).multiplyScalar(g.y).addScaledVector(p,-d.y).multiplyScalar(D),m.copy(p).multiplyScalar(d.x).addScaledVector(h,-g.x).multiplyScalar(D),o[y].add(S),o[M].add(S),o[R].add(S),l[y].add(m),l[M].add(m),l[R].add(m))}let _=this.groups;_.length===0&&(_=[{start:0,count:t.count}]);for(let y=0,M=_.length;y<M;++y){let R=_[y],D=R.start,I=R.count;for(let z=D,q=D+I;z<q;z+=3)f(t.getX(z+0),t.getX(z+1),t.getX(z+2))}let b=new L,v=new L,T=new L,A=new L;function w(y){T.fromBufferAttribute(s,y),A.copy(T);let M=o[y];b.copy(M),b.sub(T.multiplyScalar(T.dot(M))).normalize(),v.crossVectors(A,M);let D=v.dot(l[y])<0?-1:1;r.setXYZW(y,b.x,b.y,b.z,D)}for(let y=0,M=_.length;y<M;++y){let R=_[y],D=R.start,I=R.count;for(let z=D,q=D+I;z<q;z+=3)w(t.getX(z+0)),w(t.getX(z+1)),w(t.getX(z+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,n=this.getAttribute("position");if(n!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==n.count)i=new Zn(new Float32Array(n.count*3),3),this.setAttribute("normal",i);else for(let u=0,d=i.count;u<d;u++)i.setXYZ(u,0,0,0);let s=new L,a=new L,r=new L,o=new L,l=new L,c=new L,h=new L,p=new L;if(t)for(let u=0,d=t.count;u<d;u+=3){let g=t.getX(u+0),S=t.getX(u+1),m=t.getX(u+2);s.fromBufferAttribute(n,g),a.fromBufferAttribute(n,S),r.fromBufferAttribute(n,m),h.subVectors(r,a),p.subVectors(s,a),h.cross(p),o.fromBufferAttribute(i,g),l.fromBufferAttribute(i,S),c.fromBufferAttribute(i,m),o.add(h),l.add(h),c.add(h),i.setXYZ(g,o.x,o.y,o.z),i.setXYZ(S,l.x,l.y,l.z),i.setXYZ(m,c.x,c.y,c.z)}else for(let u=0,d=n.count;u<d;u+=3)s.fromBufferAttribute(n,u+0),a.fromBufferAttribute(n,u+1),r.fromBufferAttribute(n,u+2),h.subVectors(r,a),p.subVectors(s,a),h.cross(p),i.setXYZ(u+0,h.x,h.y,h.z),i.setXYZ(u+1,h.x,h.y,h.z),i.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let n=0,i=t.count;n<i;n++)an.fromBufferAttribute(t,n),an.normalize(),t.setXYZ(n,an.x,an.y,an.z)}toNonIndexed(){function t(o,l){let c=o.array,h=o.itemSize,p=o.normalized,u=new c.constructor(l.length*h),d=0,g=0;for(let S=0,m=l.length;S<m;S++){o.isInterleavedBufferAttribute?d=l[S]*o.data.stride+o.offset:d=l[S]*h;for(let f=0;f<h;f++)u[g++]=c[d++]}return new Zn(u,h,p)}if(this.index===null)return Lt("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let n=new e,i=this.index.array,s=this.attributes;for(let o in s){let l=s[o],c=t(l,i);n.setAttribute(o,c)}let a=this.morphAttributes;for(let o in a){let l=[],c=a[o];for(let h=0,p=c.length;h<p;h++){let u=c[h],d=t(u,i);l.push(d)}n.morphAttributes[o]=l}n.morphTargetsRelative=this.morphTargetsRelative;let r=this.groups;for(let o=0,l=r.length;o<l;o++){let c=r[o];n.addGroup(c.start,c.count,c.materialIndex)}return n}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let n=this.index;n!==null&&(t.data.index={type:n.array.constructor.name,array:Array.prototype.slice.call(n.array)});let i=this.attributes;for(let l in i){let c=i[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},a=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let p=0,u=c.length;p<u;p++){let d=c[p];h.push(d.toJSON(t.data))}h.length>0&&(s[l]=h,a=!0)}a&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let r=this.groups;r.length>0&&(t.data.groups=JSON.parse(JSON.stringify(r)));let o=this.boundingSphere;return o!==null&&(t.data.boundingSphere=o.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let n={};this.name=t.name;let i=t.index;i!==null&&this.setIndex(i.clone());let s=t.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(n))}let a=t.morphAttributes;for(let c in a){let h=[],p=a[c];for(let u=0,d=p.length;u<d;u++)h.push(p[u].clone(n));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let r=t.groups;for(let c=0,h=r.length;c<h;c++){let p=r[c];this.addGroup(p.start,p.count,p.materialIndex)}let o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var ZT=0,fa=class extends ki{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:ZT++}),this.uuid=dc(),this.name="",this.type="Material",this.blending=Ka,this.side=Ms,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Rh,this.blendDst=Dh,this.blendEquation=ca,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new $t(0,0,0),this.blendAlpha=0,this.depthFunc=ja,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=zg,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Za,this.stencilZFail=Za,this.stencilZPass=Za,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let n in t){let i=t[n];if(i===void 0){Lt(`Material: parameter '${n}' has value of undefined.`);continue}let s=this[n];if(s===void 0){Lt(`Material: '${n}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(i):s&&s.isVector2&&i&&i.isVector2||s&&s.isEuler&&i&&i.isEuler||s&&s.isVector3&&i&&i.isVector3?s.copy(i):this[n]=i}}toJSON(t){let n=t===void 0||typeof t=="string";n&&(t={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(t).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(t).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(t).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(t).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(t).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Ka&&(i.blending=this.blending),this.side!==Ms&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Rh&&(i.blendSrc=this.blendSrc),this.blendDst!==Dh&&(i.blendDst=this.blendDst),this.blendEquation!==ca&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==ja&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==zg&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Za&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Za&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Za&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function s(a){let r=[];for(let o in a){let l=a[o];delete l.metadata,r.push(l)}return r}if(n){let a=s(t.textures),r=s(t.images);a.length>0&&(i.textures=a),r.length>0&&(i.images=r)}return i}fromJSON(t,n){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new $t().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=n[t.map]||null),t.matcap!==void 0&&(this.matcap=n[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=n[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=n[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=n[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let i=t.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new Ut().fromArray(i)}return t.displacementMap!==void 0&&(this.displacementMap=n[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=n[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=n[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=n[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=n[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=n[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=n[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=n[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=n[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=n[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=n[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=n[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=n[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=n[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Ut().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=n[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=n[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=n[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=n[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=n[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=n[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=n[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let n=t.clippingPlanes,i=null;if(n!==null){let s=n.length;i=new Array(s);for(let a=0;a!==s;++a)i[a]=n[a].clone()}return this.clippingPlanes=i,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var xs=new L,Mg=new L,ch=new L,oa=new L,Eg=new L,uh=new L,Tg=new L,Xl=class{constructor(t=new L,n=new L(0,0,-1)){this.origin=t,this.direction=n}set(t,n){return this.origin.copy(t),this.direction.copy(n),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,n){return n.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,xs)),this}closestPointToPoint(t,n){n.subVectors(t,this.origin);let i=n.dot(this.direction);return i<0?n.copy(this.origin):n.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let n=xs.subVectors(t,this.origin).dot(this.direction);return n<0?this.origin.distanceToSquared(t):(xs.copy(this.origin).addScaledVector(this.direction,n),xs.distanceToSquared(t))}distanceSqToSegment(t,n,i,s){Mg.copy(t).add(n).multiplyScalar(.5),ch.copy(n).sub(t).normalize(),oa.copy(this.origin).sub(Mg);let a=t.distanceTo(n)*.5,r=-this.direction.dot(ch),o=oa.dot(this.direction),l=-oa.dot(ch),c=oa.lengthSq(),h=Math.abs(1-r*r),p,u,d,g;if(h>0)if(p=r*l-o,u=r*o-l,g=a*h,p>=0)if(u>=-g)if(u<=g){let S=1/h;p*=S,u*=S,d=p*(p+r*u+2*o)+u*(r*p+u+2*l)+c}else u=a,p=Math.max(0,-(r*u+o)),d=-p*p+u*(u+2*l)+c;else u=-a,p=Math.max(0,-(r*u+o)),d=-p*p+u*(u+2*l)+c;else u<=-g?(p=Math.max(0,-(-r*a+o)),u=p>0?-a:Math.min(Math.max(-a,-l),a),d=-p*p+u*(u+2*l)+c):u<=g?(p=0,u=Math.min(Math.max(-a,-l),a),d=u*(u+2*l)+c):(p=Math.max(0,-(r*a+o)),u=p>0?a:Math.min(Math.max(-a,-l),a),d=-p*p+u*(u+2*l)+c);else u=r>0?-a:a,p=Math.max(0,-(r*u+o)),d=-p*p+u*(u+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,p),s&&s.copy(Mg).addScaledVector(ch,u),d}intersectSphere(t,n){xs.subVectors(t.center,this.origin);let i=xs.dot(this.direction),s=xs.dot(xs)-i*i,a=t.radius*t.radius;if(s>a)return null;let r=Math.sqrt(a-s),o=i-r,l=i+r;return l<0?null:o<0?this.at(l,n):this.at(o,n)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let n=t.normal.dot(this.direction);if(n===0)return t.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(t.normal)+t.constant)/n;return i>=0?i:null}intersectPlane(t,n){let i=this.distanceToPlane(t);return i===null?null:this.at(i,n)}intersectsPlane(t){let n=t.distanceToPoint(this.origin);return n===0||t.normal.dot(this.direction)*n<0}intersectBox(t,n){let i,s,a,r,o,l,c=1/this.direction.x,h=1/this.direction.y,p=1/this.direction.z,u=this.origin;return c>=0?(i=(t.min.x-u.x)*c,s=(t.max.x-u.x)*c):(i=(t.max.x-u.x)*c,s=(t.min.x-u.x)*c),h>=0?(a=(t.min.y-u.y)*h,r=(t.max.y-u.y)*h):(a=(t.max.y-u.y)*h,r=(t.min.y-u.y)*h),i>r||a>s||((a>i||isNaN(i))&&(i=a),(r<s||isNaN(s))&&(s=r),p>=0?(o=(t.min.z-u.z)*p,l=(t.max.z-u.z)*p):(o=(t.max.z-u.z)*p,l=(t.min.z-u.z)*p),i>l||o>s)||((o>i||i!==i)&&(i=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(i>=0?i:s,n)}intersectsBox(t){return this.intersectBox(t,xs)!==null}intersectTriangle(t,n,i,s,a){Eg.subVectors(n,t),uh.subVectors(i,t),Tg.crossVectors(Eg,uh);let r=this.direction.dot(Tg),o;if(r>0){if(s)return null;o=1}else if(r<0)o=-1,r=-r;else return null;oa.subVectors(this.origin,t);let l=o*this.direction.dot(uh.crossVectors(oa,uh));if(l<0)return null;let c=o*this.direction.dot(Eg.cross(oa));if(c<0||l+c>r)return null;let h=-o*oa.dot(Tg);return h<0?null:this.at(h/r,a)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},di=class extends fa{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new $t(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ua,this.combine=Wg,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},Wb=new Le,qa=new Xl,hh=new Qa,qb=new L,fh=new L,dh=new L,ph=new L,Ag=new L,mh=new L,Yb=new L,gh=new L,Qe=class extends Kn{constructor(t=new on,n=new di){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=n,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,n){return super.copy(t,n),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let n=this.geometry.morphAttributes,i=Object.keys(n);if(i.length>0){let s=n[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let a=0,r=s.length;a<r;a++){let o=s[a].name||String(a);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=a}}}}getVertexPosition(t,n){let i=this.geometry,s=i.attributes.position,a=i.morphAttributes.position,r=i.morphTargetsRelative;n.fromBufferAttribute(s,t);let o=this.morphTargetInfluences;if(a&&o){mh.set(0,0,0);for(let l=0,c=a.length;l<c;l++){let h=o[l],p=a[l];h!==0&&(Ag.fromBufferAttribute(p,t),r?mh.addScaledVector(Ag,h):mh.addScaledVector(Ag.sub(n),h))}n.add(mh)}return n}raycast(t,n){let i=this.geometry,s=this.material,a=this.matrixWorld;s!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),hh.copy(i.boundingSphere),hh.applyMatrix4(a),qa.copy(t.ray).recast(t.near),!(hh.containsPoint(qa.origin)===!1&&(qa.intersectSphere(hh,qb)===null||qa.origin.distanceToSquared(qb)>(t.far-t.near)**2))&&(Wb.copy(a).invert(),qa.copy(t.ray).applyMatrix4(Wb),!(i.boundingBox!==null&&qa.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(t,n,qa)))}_computeIntersections(t,n,i){let s,a=this.geometry,r=this.material,o=a.index,l=a.attributes.position,c=a.attributes.uv,h=a.attributes.uv1,p=a.attributes.normal,u=a.groups,d=a.drawRange;if(o!==null)if(Array.isArray(r))for(let g=0,S=u.length;g<S;g++){let m=u[g],f=r[m.materialIndex],_=Math.max(m.start,d.start),b=Math.min(o.count,Math.min(m.start+m.count,d.start+d.count));for(let v=_,T=b;v<T;v+=3){let A=o.getX(v),w=o.getX(v+1),y=o.getX(v+2);s=_h(this,f,t,i,c,h,p,A,w,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,n.push(s))}}else{let g=Math.max(0,d.start),S=Math.min(o.count,d.start+d.count);for(let m=g,f=S;m<f;m+=3){let _=o.getX(m),b=o.getX(m+1),v=o.getX(m+2);s=_h(this,r,t,i,c,h,p,_,b,v),s&&(s.faceIndex=Math.floor(m/3),n.push(s))}}else if(l!==void 0)if(Array.isArray(r))for(let g=0,S=u.length;g<S;g++){let m=u[g],f=r[m.materialIndex],_=Math.max(m.start,d.start),b=Math.min(l.count,Math.min(m.start+m.count,d.start+d.count));for(let v=_,T=b;v<T;v+=3){let A=v,w=v+1,y=v+2;s=_h(this,f,t,i,c,h,p,A,w,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,n.push(s))}}else{let g=Math.max(0,d.start),S=Math.min(l.count,d.start+d.count);for(let m=g,f=S;m<f;m+=3){let _=m,b=m+1,v=m+2;s=_h(this,r,t,i,c,h,p,_,b,v),s&&(s.faceIndex=Math.floor(m/3),n.push(s))}}}};function JT(e,t,n,i,s,a,r,o){let l;if(t.side===An?l=i.intersectTriangle(r,a,s,!0,o):l=i.intersectTriangle(s,a,r,t.side===Ms,o),l===null)return null;gh.copy(o),gh.applyMatrix4(e.matrixWorld);let c=n.ray.origin.distanceTo(gh);return c<n.near||c>n.far?null:{distance:c,point:gh.clone(),object:e}}function _h(e,t,n,i,s,a,r,o,l,c){e.getVertexPosition(o,fh),e.getVertexPosition(l,dh),e.getVertexPosition(c,ph);let h=JT(e,t,n,i,fh,dh,ph,Yb);if(h){let p=new L;bs.getBarycoord(Yb,fh,dh,ph,p),s&&(h.uv=bs.getInterpolatedAttribute(s,o,l,c,p,new Ut)),a&&(h.uv1=bs.getInterpolatedAttribute(a,o,l,c,p,new Ut)),r&&(h.normal=bs.getInterpolatedAttribute(r,o,l,c,p,new L),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));let u={a:o,b:l,c,normal:new L,materialIndex:0};bs.getNormal(fh,dh,ph,u.normal),h.face=u,h.barycoord=p}return h}var Wh=class extends xn{constructor(t=null,n=1,i=1,s,a,r,o,l,c=rn,h=rn,p,u){super(null,r,o,l,c,h,s,a,p,u),this.isDataTexture=!0,this.image={data:t,width:n,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var wg=new L,KT=new L,jT=new Bt,Fi=class{constructor(t=new L(1,0,0),n=0){this.isPlane=!0,this.normal=t,this.constant=n}set(t,n){return this.normal.copy(t),this.constant=n,this}setComponents(t,n,i,s){return this.normal.set(t,n,i),this.constant=s,this}setFromNormalAndCoplanarPoint(t,n){return this.normal.copy(t),this.constant=-n.dot(this.normal),this}setFromCoplanarPoints(t,n,i){let s=wg.subVectors(i,n).cross(KT.subVectors(t,n)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,n){return n.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,n,i=!0){let s=t.delta(wg),a=this.normal.dot(s);if(a===0)return this.distanceToPoint(t.start)===0?n.copy(t.start):null;let r=-(t.start.dot(this.normal)+this.constant)/a;return i===!0&&(r<0||r>1)?null:n.copy(t.start).addScaledVector(s,r)}intersectsLine(t){let n=this.distanceToPoint(t.start),i=this.distanceToPoint(t.end);return n<0&&i>0||i<0&&n>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,n){let i=n||jT.getNormalMatrix(t),s=this.coplanarPoint(wg).applyMatrix4(t),a=this.normal.applyMatrix3(i).normalize();return this.constant=-s.dot(a),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},Ya=new Qa,QT=new Ut(.5,.5),vh=new L,Wl=class{constructor(t=new Fi,n=new Fi,i=new Fi,s=new Fi,a=new Fi,r=new Fi){this.planes=[t,n,i,s,a,r]}set(t,n,i,s,a,r){let o=this.planes;return o[0].copy(t),o[1].copy(n),o[2].copy(i),o[3].copy(s),o[4].copy(a),o[5].copy(r),this}copy(t){let n=this.planes;for(let i=0;i<6;i++)n[i].copy(t.planes[i]);return this}setFromProjectionMatrix(t,n=Si,i=!1){let s=this.planes,a=t.elements,r=a[0],o=a[1],l=a[2],c=a[3],h=a[4],p=a[5],u=a[6],d=a[7],g=a[8],S=a[9],m=a[10],f=a[11],_=a[12],b=a[13],v=a[14],T=a[15];if(s[0].setComponents(c-r,d-h,f-g,T-_).normalize(),s[1].setComponents(c+r,d+h,f+g,T+_).normalize(),s[2].setComponents(c+o,d+p,f+S,T+b).normalize(),s[3].setComponents(c-o,d-p,f-S,T-b).normalize(),i)s[4].setComponents(l,u,m,v).normalize(),s[5].setComponents(c-l,d-u,f-m,T-v).normalize();else if(s[4].setComponents(c-l,d-u,f-m,T-v).normalize(),n===Si)s[5].setComponents(c+l,d+u,f+m,T+v).normalize();else if(n===zl)s[5].setComponents(l,u,m,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+n);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Ya.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let n=t.geometry;n.boundingSphere===null&&n.computeBoundingSphere(),Ya.copy(n.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Ya)}intersectsSprite(t){Ya.center.set(0,0,0);let n=QT.distanceTo(t.center);return Ya.radius=.7071067811865476+n,Ya.applyMatrix4(t.matrixWorld),this.intersectsSphere(Ya)}intersectsSphere(t){let n=this.planes,i=t.center,s=-t.radius;for(let a=0;a<6;a++)if(n[a].distanceToPoint(i)<s)return!1;return!0}intersectsBox(t){let n=this.planes;for(let i=0;i<6;i++){let s=n[i];if(vh.x=s.normal.x>0?t.max.x:t.min.x,vh.y=s.normal.y>0?t.max.y:t.min.y,vh.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(vh)<0)return!1}return!0}containsPoint(t){let n=this.planes;for(let i=0;i<6;i++)if(n[i].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var da=class extends fa{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new $t(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}},qh=new L,Yh=new L,Zb=new Le,Nl=new Xl,yh=new Qa,Cg=new L,Jb=new L,fo=class extends Kn{constructor(t=new on,n=new da){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=n,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,n){return super.copy(t,n),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){let t=this.geometry;if(t.index===null){let n=t.attributes.position,i=[0];for(let s=1,a=n.count;s<a;s++)qh.fromBufferAttribute(n,s-1),Yh.fromBufferAttribute(n,s),i[s]=i[s-1],i[s]+=qh.distanceTo(Yh);t.setAttribute("lineDistance",new xe(i,1))}else Lt("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,n){let i=this.geometry,s=this.matrixWorld,a=t.params.Line.threshold,r=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),yh.copy(i.boundingSphere),yh.applyMatrix4(s),yh.radius+=a,t.ray.intersectsSphere(yh)===!1)return;Zb.copy(s).invert(),Nl.copy(t.ray).applyMatrix4(Zb);let o=a/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=i.index,u=i.attributes.position;if(h!==null){let d=Math.max(0,r.start),g=Math.min(h.count,r.start+r.count);for(let S=d,m=g-1;S<m;S+=c){let f=h.getX(S),_=h.getX(S+1),b=xh(this,t,Nl,l,f,_,S);b&&n.push(b)}if(this.isLineLoop){let S=h.getX(g-1),m=h.getX(d),f=xh(this,t,Nl,l,S,m,g-1);f&&n.push(f)}}else{let d=Math.max(0,r.start),g=Math.min(u.count,r.start+r.count);for(let S=d,m=g-1;S<m;S+=c){let f=xh(this,t,Nl,l,S,S+1,S);f&&n.push(f)}if(this.isLineLoop){let S=xh(this,t,Nl,l,g-1,d,g-1);S&&n.push(S)}}}updateMorphTargets(){let n=this.geometry.morphAttributes,i=Object.keys(n);if(i.length>0){let s=n[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let a=0,r=s.length;a<r;a++){let o=s[a].name||String(a);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=a}}}}};function xh(e,t,n,i,s,a,r){let o=e.geometry.attributes.position;if(qh.fromBufferAttribute(o,s),Yh.fromBufferAttribute(o,a),n.distanceSqToSegment(qh,Yh,Cg,Jb)>i)return;Cg.applyMatrix4(e.matrixWorld);let c=t.ray.origin.distanceTo(Cg);if(!(c<t.near||c>t.far))return{distance:c,point:Jb.clone().applyMatrix4(e.matrixWorld),index:r,face:null,faceIndex:null,barycoord:null,object:e}}var Kb=new L,jb=new L,po=class extends fo{constructor(t,n){super(t,n),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let t=this.geometry;if(t.index===null){let n=t.attributes.position,i=[];for(let s=0,a=n.count;s<a;s+=2)Kb.fromBufferAttribute(n,s),jb.fromBufferAttribute(n,s+1),i[s]=s===0?0:i[s-1],i[s+1]=i[s]+Kb.distanceTo(jb);t.setAttribute("lineDistance",new xe(i,1))}else Lt("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var ql=class extends xn{constructor(t=[],n=va,i,s,a,r,o,l,c,h){super(t,n,i,s,a,r,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}};var Es=class extends xn{constructor(t,n,i=Ei,s,a,r,o=rn,l=rn,c,h=Gi,p=1){if(h!==Gi&&h!==xa)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:t,height:n,depth:p};super(u,s,a,r,o,l,h,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new uo(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let n=super.toJSON(t);return this.compareFunction!==null&&(n.compareFunction=this.compareFunction),n}},Zh=class extends Es{constructor(t,n=Ei,i=va,s,a,r=rn,o=rn,l,c=Gi){let h={width:t,height:t,depth:1},p=[h,h,h,h,h,h];super(t,t,n,i,s,a,r,o,l,c),this.image=p,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},Yl=class extends xn{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},mo=class e extends on{constructor(t=1,n=1,i=1,s=1,a=1,r=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:n,depth:i,widthSegments:s,heightSegments:a,depthSegments:r};let o=this;s=Math.floor(s),a=Math.floor(a),r=Math.floor(r);let l=[],c=[],h=[],p=[],u=0,d=0;g("z","y","x",-1,-1,i,n,t,r,a,0),g("z","y","x",1,-1,i,n,-t,r,a,1),g("x","z","y",1,1,t,i,n,s,r,2),g("x","z","y",1,-1,t,i,-n,s,r,3),g("x","y","z",1,-1,t,n,i,s,a,4),g("x","y","z",-1,-1,t,n,-i,s,a,5),this.setIndex(l),this.setAttribute("position",new xe(c,3)),this.setAttribute("normal",new xe(h,3)),this.setAttribute("uv",new xe(p,2));function g(S,m,f,_,b,v,T,A,w,y,M){let R=v/w,D=T/y,I=v/2,z=T/2,q=A/2,O=w+1,G=y+1,V=0,K=0,it=new L;for(let ht=0;ht<G;ht++){let ft=ht*D-z;for(let _t=0;_t<O;_t++){let Jt=_t*R-I;it[S]=Jt*_,it[m]=ft*b,it[f]=q,c.push(it.x,it.y,it.z),it[S]=0,it[m]=0,it[f]=A>0?1:-1,h.push(it.x,it.y,it.z),p.push(_t/w),p.push(1-ht/y),V+=1}}for(let ht=0;ht<y;ht++)for(let ft=0;ft<w;ft++){let _t=u+ft+O*ht,Jt=u+ft+O*(ht+1),ue=u+(ft+1)+O*(ht+1),Wt=u+(ft+1)+O*ht;l.push(_t,Jt,Wt),l.push(Jt,ue,Wt),K+=6}o.addGroup(d,K,M),d+=K,u+=V}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};var Jh=class e extends on{constructor(t=1,n=1,i=1,s=32,a=1,r=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:n,height:i,radialSegments:s,heightSegments:a,openEnded:r,thetaStart:o,thetaLength:l};let c=this;s=Math.floor(s),a=Math.floor(a);let h=[],p=[],u=[],d=[],g=0,S=[],m=i/2,f=0;_(),r===!1&&(t>0&&b(!0),n>0&&b(!1)),this.setIndex(h),this.setAttribute("position",new xe(p,3)),this.setAttribute("normal",new xe(u,3)),this.setAttribute("uv",new xe(d,2));function _(){let v=new L,T=new L,A=0,w=(n-t)/i;for(let y=0;y<=a;y++){let M=[],R=y/a,D=R*(n-t)+t;for(let I=0;I<=s;I++){let z=I/s,q=z*l+o,O=Math.sin(q),G=Math.cos(q);T.x=D*O,T.y=-R*i+m,T.z=D*G,p.push(T.x,T.y,T.z),v.set(O,w,G).normalize(),u.push(v.x,v.y,v.z),d.push(z,1-R),M.push(g++)}S.push(M)}for(let y=0;y<s;y++)for(let M=0;M<a;M++){let R=S[M][y],D=S[M+1][y],I=S[M+1][y+1],z=S[M][y+1];(t>0||M!==0)&&(h.push(R,D,z),A+=3),(n>0||M!==a-1)&&(h.push(D,I,z),A+=3)}c.addGroup(f,A,0),f+=A}function b(v){let T=g,A=new Ut,w=new L,y=0,M=v===!0?t:n,R=v===!0?1:-1;for(let I=1;I<=s;I++)p.push(0,m*R,0),u.push(0,R,0),d.push(.5,.5),g++;let D=g;for(let I=0;I<=s;I++){let q=I/s*l+o,O=Math.cos(q),G=Math.sin(q);w.x=M*G,w.y=m*R,w.z=M*O,p.push(w.x,w.y,w.z),u.push(0,R,0),A.x=O*.5+.5,A.y=G*.5*R+.5,d.push(A.x,A.y),g++}for(let I=0;I<s;I++){let z=T+I,q=D+I;v===!0?h.push(q,q+1,z):h.push(q+1,q,z),y+=3}c.addGroup(f,y,v===!0?1:2),f+=y}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Zl=class e extends Jh{constructor(t=1,n=1,i=32,s=1,a=!1,r=0,o=Math.PI*2){super(0,t,n,i,s,a,r,o),this.type="ConeGeometry",this.parameters={radius:t,height:n,radialSegments:i,heightSegments:s,openEnded:a,thetaStart:r,thetaLength:o}}static fromJSON(t){return new e(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}};var bh=new L,Sh=new L,Rg=new L,Mh=new bs,Jl=class extends on{constructor(t=null,n=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:t,thresholdAngle:n},t!==null){let s=Math.pow(10,4),a=Math.cos(Ch*n),r=t.getIndex(),o=t.getAttribute("position"),l=r?r.count:o.count,c=[0,0,0],h=["a","b","c"],p=new Array(3),u={},d=[];for(let g=0;g<l;g+=3){r?(c[0]=r.getX(g),c[1]=r.getX(g+1),c[2]=r.getX(g+2)):(c[0]=g,c[1]=g+1,c[2]=g+2);let{a:S,b:m,c:f}=Mh;if(S.fromBufferAttribute(o,c[0]),m.fromBufferAttribute(o,c[1]),f.fromBufferAttribute(o,c[2]),Mh.getNormal(Rg),p[0]=`${Math.round(S.x*s)},${Math.round(S.y*s)},${Math.round(S.z*s)}`,p[1]=`${Math.round(m.x*s)},${Math.round(m.y*s)},${Math.round(m.z*s)}`,p[2]=`${Math.round(f.x*s)},${Math.round(f.y*s)},${Math.round(f.z*s)}`,!(p[0]===p[1]||p[1]===p[2]||p[2]===p[0]))for(let _=0;_<3;_++){let b=(_+1)%3,v=p[_],T=p[b],A=Mh[h[_]],w=Mh[h[b]],y=`${v}_${T}`,M=`${T}_${v}`;M in u&&u[M]?(Rg.dot(u[M].normal)<=a&&(d.push(A.x,A.y,A.z),d.push(w.x,w.y,w.z)),u[M]=null):y in u||(u[y]={index0:c[_],index1:c[b],normal:Rg.clone()})}}for(let g in u)if(u[g]){let{index0:S,index1:m}=u[g];bh.fromBufferAttribute(o,S),Sh.fromBufferAttribute(o,m),d.push(bh.x,bh.y,bh.z),d.push(Sh.x,Sh.y,Sh.z)}this.setAttribute("position",new xe(d,3))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}},pi=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Lt("Curve: .getPoint() not implemented.")}getPointAt(t,n){let i=this.getUtoTmapping(t);return this.getPoint(i,n)}getPoints(t=5){let n=[];for(let i=0;i<=t;i++)n.push(this.getPoint(i/t));return n}getSpacedPoints(t=5){let n=[];for(let i=0;i<=t;i++)n.push(this.getPointAt(i/t));return n}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let n=[],i,s=this.getPoint(0),a=0;n.push(0);for(let r=1;r<=t;r++)i=this.getPoint(r/t),a+=i.distanceTo(s),n.push(a),s=i;return this.cacheArcLengths=n,n}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,n=null){let i=this.getLengths(),s=0,a=i.length,r;n?r=n:r=t*i[a-1];let o=0,l=a-1,c;for(;o<=l;)if(s=Math.floor(o+(l-o)/2),c=i[s]-r,c<0)o=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,i[s]===r)return s/(a-1);let h=i[s],u=i[s+1]-h,d=(r-h)/u;return(s+d)/(a-1)}getTangent(t,n){let s=t-1e-4,a=t+1e-4;s<0&&(s=0),a>1&&(a=1);let r=this.getPoint(s),o=this.getPoint(a),l=n||(r.isVector2?new Ut:new L);return l.copy(o).sub(r).normalize(),l}getTangentAt(t,n){let i=this.getUtoTmapping(t);return this.getTangent(i,n)}computeFrenetFrames(t,n=!1){let i=new L,s=[],a=[],r=[],o=new L,l=new Le;for(let d=0;d<=t;d++){let g=d/t;s[d]=this.getTangentAt(g,new L)}a[0]=new L,r[0]=new L;let c=Number.MAX_VALUE,h=Math.abs(s[0].x),p=Math.abs(s[0].y),u=Math.abs(s[0].z);h<=c&&(c=h,i.set(1,0,0)),p<=c&&(c=p,i.set(0,1,0)),u<=c&&i.set(0,0,1),o.crossVectors(s[0],i).normalize(),a[0].crossVectors(s[0],o),r[0].crossVectors(s[0],a[0]);for(let d=1;d<=t;d++){if(a[d]=a[d-1].clone(),r[d]=r[d-1].clone(),o.crossVectors(s[d-1],s[d]),o.length()>Number.EPSILON){o.normalize();let g=Math.acos(Zt(s[d-1].dot(s[d]),-1,1));a[d].applyMatrix4(l.makeRotationAxis(o,g))}r[d].crossVectors(s[d],a[d])}if(n===!0){let d=Math.acos(Zt(a[0].dot(a[t]),-1,1));d/=t,s[0].dot(o.crossVectors(a[0],a[t]))>0&&(d=-d);for(let g=1;g<=t;g++)a[g].applyMatrix4(l.makeRotationAxis(s[g],d*g)),r[g].crossVectors(s[g],a[g])}return{tangents:s,normals:a,binormals:r}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},Kl=class extends pi{constructor(t=0,n=0,i=1,s=1,a=0,r=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=n,this.xRadius=i,this.yRadius=s,this.aStartAngle=a,this.aEndAngle=r,this.aClockwise=o,this.aRotation=l}getPoint(t,n=new Ut){let i=n,s=Math.PI*2,a=this.aEndAngle-this.aStartAngle,r=Math.abs(a)<Number.EPSILON;for(;a<0;)a+=s;for(;a>s;)a-=s;a<Number.EPSILON&&(r?a=0:a=s),this.aClockwise===!0&&!r&&(a===s?a=-s:a=a-s);let o=this.aStartAngle+t*a,l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),p=Math.sin(this.aRotation),u=l-this.aX,d=c-this.aY;l=u*h-d*p+this.aX,c=u*p+d*h+this.aY}return i.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},Kh=class extends Kl{constructor(t,n,i,s,a,r){super(t,n,i,i,s,a,r),this.isArcCurve=!0,this.type="ArcCurve"}};function u0(){let e=0,t=0,n=0,i=0;function s(a,r,o,l){e=a,t=o,n=-3*a+3*r-2*o-l,i=2*a-2*r+o+l}return{initCatmullRom:function(a,r,o,l,c){s(r,o,c*(o-a),c*(l-r))},initNonuniformCatmullRom:function(a,r,o,l,c,h,p){let u=(r-a)/c-(o-a)/(c+h)+(o-r)/h,d=(o-r)/h-(l-r)/(h+p)+(l-o)/p;u*=h,d*=h,s(r,o,u,d)},calc:function(a){let r=a*a,o=r*a;return e+t*a+n*r+i*o}}}var Qb=new L,$b=new L,Dg=new u0,Ng=new u0,Ug=new u0,go=class extends pi{constructor(t=[],n=!1,i="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=n,this.curveType=i,this.tension=s}getPoint(t,n=new L){let i=n,s=this.points,a=s.length,r=(a-(this.closed?0:1))*t,o=Math.floor(r),l=r-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/a)+1)*a:l===0&&o===a-1&&(o=a-2,l=1);let c,h;this.closed||o>0?c=s[(o-1)%a]:($b.subVectors(s[0],s[1]).add(s[0]),c=$b);let p=s[o%a],u=s[(o+1)%a];if(this.closed||o+2<a?h=s[(o+2)%a]:(Qb.subVectors(s[a-1],s[a-2]).add(s[a-1]),h=Qb),this.curveType==="centripetal"||this.curveType==="chordal"){let d=this.curveType==="chordal"?.5:.25,g=Math.pow(c.distanceToSquared(p),d),S=Math.pow(p.distanceToSquared(u),d),m=Math.pow(u.distanceToSquared(h),d);S<1e-4&&(S=1),g<1e-4&&(g=S),m<1e-4&&(m=S),Dg.initNonuniformCatmullRom(c.x,p.x,u.x,h.x,g,S,m),Ng.initNonuniformCatmullRom(c.y,p.y,u.y,h.y,g,S,m),Ug.initNonuniformCatmullRom(c.z,p.z,u.z,h.z,g,S,m)}else this.curveType==="catmullrom"&&(Dg.initCatmullRom(c.x,p.x,u.x,h.x,this.tension),Ng.initCatmullRom(c.y,p.y,u.y,h.y,this.tension),Ug.initCatmullRom(c.z,p.z,u.z,h.z,this.tension));return i.set(Dg.calc(l),Ng.calc(l),Ug.calc(l)),i}copy(t){super.copy(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let n=0,i=this.points.length;n<i;n++){let s=this.points[n];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(new L().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function tS(e,t,n,i,s){let a=(i-t)*.5,r=(s-n)*.5,o=e*e,l=e*o;return(2*n-2*i+a+r)*l+(-3*n+3*i-2*a-r)*o+a*e+n}function $T(e,t){let n=1-e;return n*n*t}function tA(e,t){return 2*(1-e)*e*t}function eA(e,t){return e*e*t}function Ul(e,t,n,i){return $T(e,t)+tA(e,n)+eA(e,i)}function nA(e,t){let n=1-e;return n*n*n*t}function iA(e,t){let n=1-e;return 3*n*n*e*t}function sA(e,t){return 3*(1-e)*e*e*t}function aA(e,t){return e*e*e*t}function Ll(e,t,n,i,s){return nA(e,t)+iA(e,n)+sA(e,i)+aA(e,s)}var jh=class extends pi{constructor(t=new Ut,n=new Ut,i=new Ut,s=new Ut){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=n,this.v2=i,this.v3=s}getPoint(t,n=new Ut){let i=n,s=this.v0,a=this.v1,r=this.v2,o=this.v3;return i.set(Ll(t,s.x,a.x,r.x,o.x),Ll(t,s.y,a.y,r.y,o.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},Qh=class extends pi{constructor(t=new L,n=new L,i=new L,s=new L){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=n,this.v2=i,this.v3=s}getPoint(t,n=new L){let i=n,s=this.v0,a=this.v1,r=this.v2,o=this.v3;return i.set(Ll(t,s.x,a.x,r.x,o.x),Ll(t,s.y,a.y,r.y,o.y),Ll(t,s.z,a.z,r.z,o.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},$h=class extends pi{constructor(t=new Ut,n=new Ut){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=n}getPoint(t,n=new Ut){let i=n;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,n){return this.getPoint(t,n)}getTangent(t,n=new Ut){return n.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,n){return this.getTangent(t,n)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},tf=class extends pi{constructor(t=new L,n=new L){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=n}getPoint(t,n=new L){let i=n;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,n){return this.getPoint(t,n)}getTangent(t,n=new L){return n.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,n){return this.getTangent(t,n)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},ef=class extends pi{constructor(t=new Ut,n=new Ut,i=new Ut){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=n,this.v2=i}getPoint(t,n=new Ut){let i=n,s=this.v0,a=this.v1,r=this.v2;return i.set(Ul(t,s.x,a.x,r.x),Ul(t,s.y,a.y,r.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},jl=class extends pi{constructor(t=new L,n=new L,i=new L){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=n,this.v2=i}getPoint(t,n=new L){let i=n,s=this.v0,a=this.v1,r=this.v2;return i.set(Ul(t,s.x,a.x,r.x),Ul(t,s.y,a.y,r.y),Ul(t,s.z,a.z,r.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},nf=class extends pi{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,n=new Ut){let i=n,s=this.points,a=(s.length-1)*t,r=Math.floor(a),o=a-r,l=s[r===0?r:r-1],c=s[r],h=s[r>s.length-2?s.length-1:r+1],p=s[r>s.length-3?s.length-1:r+2];return i.set(tS(o,l.x,c.x,h.x,p.x),tS(o,l.y,c.y,h.y,p.y)),i}copy(t){super.copy(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let n=0,i=this.points.length;n<i;n++){let s=this.points[n];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(new Ut().fromArray(s))}return this}},rA=Object.freeze({__proto__:null,ArcCurve:Kh,CatmullRomCurve3:go,CubicBezierCurve:jh,CubicBezierCurve3:Qh,EllipseCurve:Kl,LineCurve:$h,LineCurve3:tf,QuadraticBezierCurve:ef,QuadraticBezierCurve3:jl,SplineCurve:nf});var pa=class e extends on{constructor(t=1,n=1,i=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:n,widthSegments:i,heightSegments:s};let a=t/2,r=n/2,o=Math.floor(i),l=Math.floor(s),c=o+1,h=l+1,p=t/o,u=n/l,d=[],g=[],S=[],m=[];for(let f=0;f<h;f++){let _=f*u-r;for(let b=0;b<c;b++){let v=b*p-a;g.push(v,-_,0),S.push(0,0,1),m.push(b/o),m.push(1-f/l)}}for(let f=0;f<l;f++)for(let _=0;_<o;_++){let b=_+c*f,v=_+c*(f+1),T=_+1+c*(f+1),A=_+1+c*f;d.push(b,v,A),d.push(v,T,A)}this.setIndex(d),this.setAttribute("position",new xe(g,3)),this.setAttribute("normal",new xe(S,3)),this.setAttribute("uv",new xe(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}};var _o=class e extends on{constructor(t=1,n=32,i=16,s=0,a=Math.PI*2,r=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:n,heightSegments:i,phiStart:s,phiLength:a,thetaStart:r,thetaLength:o},n=Math.max(3,Math.floor(n)),i=Math.max(2,Math.floor(i));let l=Math.min(r+o,Math.PI),c=0,h=[],p=new L,u=new L,d=[],g=[],S=[],m=[];for(let f=0;f<=i;f++){let _=[],b=f/i,v=r+b*o,T=t*Math.cos(v),A=Math.sqrt(t*t-T*T),w=0;f===0&&r===0?w=.5/n:f===i&&l===Math.PI&&(w=-.5/n);for(let y=0;y<=n;y++){let M=y/n,R=s+M*a;p.x=-A*Math.cos(R),p.y=T,p.z=A*Math.sin(R),g.push(p.x,p.y,p.z),u.copy(p).normalize(),S.push(u.x,u.y,u.z),m.push(M+w,1-b),_.push(c++)}h.push(_)}for(let f=0;f<i;f++)for(let _=0;_<n;_++){let b=h[f][_+1],v=h[f][_],T=h[f+1][_],A=h[f+1][_+1];(f!==0||r>0)&&d.push(b,v,A),(f!==i-1||l<Math.PI)&&d.push(v,T,A)}this.setIndex(d),this.setAttribute("position",new xe(g,3)),this.setAttribute("normal",new xe(S,3)),this.setAttribute("uv",new xe(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};var Ql=class e extends on{constructor(t=new jl(new L(-1,-1,0),new L(-1,1,0),new L(1,1,0)),n=64,i=1,s=8,a=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:n,radius:i,radialSegments:s,closed:a};let r=t.computeFrenetFrames(n,a);this.tangents=r.tangents,this.normals=r.normals,this.binormals=r.binormals;let o=new L,l=new L,c=new Ut,h=new L,p=[],u=[],d=[],g=[];S(),this.setIndex(g),this.setAttribute("position",new xe(p,3)),this.setAttribute("normal",new xe(u,3)),this.setAttribute("uv",new xe(d,2));function S(){for(let b=0;b<n;b++)m(b);m(a===!1?n:0),_(),f()}function m(b){h=t.getPointAt(b/n,h);let v=r.normals[b],T=r.binormals[b];for(let A=0;A<=s;A++){let w=A/s*Math.PI*2,y=Math.sin(w),M=-Math.cos(w);l.x=M*v.x+y*T.x,l.y=M*v.y+y*T.y,l.z=M*v.z+y*T.z,l.normalize(),u.push(l.x,l.y,l.z),o.x=h.x+i*l.x,o.y=h.y+i*l.y,o.z=h.z+i*l.z,p.push(o.x,o.y,o.z)}}function f(){for(let b=1;b<=n;b++)for(let v=1;v<=s;v++){let T=(s+1)*(b-1)+(v-1),A=(s+1)*b+(v-1),w=(s+1)*b+v,y=(s+1)*(b-1)+v;g.push(T,A,y),g.push(A,w,y)}}function _(){for(let b=0;b<=n;b++)for(let v=0;v<=s;v++)c.x=b/n,c.y=v/s,d.push(c.x,c.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new e(new rA[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}};function tr(e){let t={};for(let n in e){t[n]={};for(let i in e[n]){let s=e[n][i];if(eS(s))s.isRenderTargetTexture?(Lt("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[n][i]=null):t[n][i]=s.clone();else if(Array.isArray(s))if(eS(s[0])){let a=[];for(let r=0,o=s.length;r<o;r++)a[r]=s[r].clone();t[n][i]=a}else t[n][i]=s.slice();else t[n][i]=s}}return t}function bn(e){let t={};for(let n=0;n<e.length;n++){let i=tr(e[n]);for(let s in i)t[s]=i[s]}return t}function eS(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function oA(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function h0(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Qt.workingColorSpace}var HS={clone:tr,merge:bn},lA=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,cA=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,jn=class extends fa{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=lA,this.fragmentShader=cA,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=tr(t.uniforms),this.uniformsGroups=oA(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let n=super.toJSON(t);n.glslVersion=this.glslVersion,n.uniforms={};for(let s in this.uniforms){let r=this.uniforms[s].value;r&&r.isTexture?n.uniforms[s]={type:"t",value:r.toJSON(t).uuid}:r&&r.isColor?n.uniforms[s]={type:"c",value:r.getHex()}:r&&r.isVector2?n.uniforms[s]={type:"v2",value:r.toArray()}:r&&r.isVector3?n.uniforms[s]={type:"v3",value:r.toArray()}:r&&r.isVector4?n.uniforms[s]={type:"v4",value:r.toArray()}:r&&r.isMatrix3?n.uniforms[s]={type:"m3",value:r.toArray()}:r&&r.isMatrix4?n.uniforms[s]={type:"m4",value:r.toArray()}:n.uniforms[s]={value:r}}Object.keys(this.defines).length>0&&(n.defines=this.defines),n.vertexShader=this.vertexShader,n.fragmentShader=this.fragmentShader,n.lights=this.lights,n.clipping=this.clipping;let i={};for(let s in this.extensions)this.extensions[s]===!0&&(i[s]=!0);return Object.keys(i).length>0&&(n.extensions=i),n}fromJSON(t,n){if(super.fromJSON(t,n),t.uniforms!==void 0)for(let i in t.uniforms){let s=t.uniforms[i];switch(this.uniforms[i]={},s.type){case"t":this.uniforms[i].value=n[s.value]||null;break;case"c":this.uniforms[i].value=new $t().setHex(s.value);break;case"v2":this.uniforms[i].value=new Ut().fromArray(s.value);break;case"v3":this.uniforms[i].value=new L().fromArray(s.value);break;case"v4":this.uniforms[i].value=new Ie().fromArray(s.value);break;case"m3":this.uniforms[i].value=new Bt().fromArray(s.value);break;case"m4":this.uniforms[i].value=new Le().fromArray(s.value);break;default:this.uniforms[i].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let i in t.extensions)this.extensions[i]=t.extensions[i];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},sf=class extends jn{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}};var af=class extends fa{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=CS,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},rf=class extends fa{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};var $l=class extends da{constructor(t){super(),this.isLineDashedMaterial=!0,this.type="LineDashedMaterial",this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(t)}copy(t){return super.copy(t),this.scale=t.scale,this.dashSize=t.dashSize,this.gapSize=t.gapSize,this}};function Eh(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT=="number"?new t(e):Array.prototype.slice.call(e)}var ma=class{constructor(t,n,i,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new n.constructor(i),this.sampleValues=n,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(t){let n=this.parameterPositions,i=this._cachedIndex,s=n[i],a=n[i-1];t:{e:{let r;n:{i:if(!(t<s)){for(let o=i+2;;){if(s===void 0){if(t<a)break i;return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===o)break;if(a=s,s=n[++i],t<s)break e}r=n.length;break n}if(!(t>=a)){let o=n[1];t<o&&(i=2,a=o);for(let l=i-2;;){if(a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(s=a,a=n[--i-1],t>=a)break e}r=i,i=0;break n}break t}for(;i<r;){let o=i+r>>>1;t<n[o]?r=o:i=o+1}if(s=n[i],a=n[i-1],a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,a,s)}return this.interpolate_(i,a,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let n=this.resultBuffer,i=this.sampleValues,s=this.valueSize,a=t*s;for(let r=0;r!==s;++r)n[r]=i[a+r];return n}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},of=class extends ma{constructor(t,n,i,s){super(t,n,i,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Ig,endingEnd:Ig}}intervalChanged_(t,n,i){let s=this.parameterPositions,a=t-2,r=t+1,o=s[a],l=s[r];if(o===void 0)switch(this.getSettings_().endingStart){case Og:a=t,o=2*n-i;break;case Pg:a=s.length-2,o=n+s[a]-s[a+1];break;default:a=t,o=i}if(l===void 0)switch(this.getSettings_().endingEnd){case Og:r=t,l=2*i-n;break;case Pg:r=1,l=i+s[1]-s[0];break;default:r=t-1,l=n}let c=(i-n)*.5,h=this.valueSize;this._weightPrev=c/(n-o),this._weightNext=c/(l-i),this._offsetPrev=a*h,this._offsetNext=r*h}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this._offsetPrev,p=this._offsetNext,u=this._weightPrev,d=this._weightNext,g=(i-n)/(s-n),S=g*g,m=S*g,f=-u*m+2*u*S-u*g,_=(1+u)*m+(-1.5-2*u)*S+(-.5+u)*g+1,b=(-1-d)*m+(1.5+d)*S+.5*g,v=d*m-d*S;for(let T=0;T!==o;++T)a[T]=f*r[h+T]+_*r[c+T]+b*r[l+T]+v*r[p+T];return a}},lf=class extends ma{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=(i-n)/(s-n),p=1-h;for(let u=0;u!==o;++u)a[u]=r[c+u]*p+r[l+u]*h;return a}},cf=class extends ma{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t){return this.copySampleValue_(t-1)}},uf=class extends ma{interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this.inTangents,p=this.outTangents;if(!h||!p){let g=(i-n)/(s-n),S=1-g;for(let m=0;m!==o;++m)a[m]=r[c+m]*S+r[l+m]*g;return a}let u=o*2,d=t-1;for(let g=0;g!==o;++g){let S=r[c+g],m=r[l+g],f=d*u+g*2,_=p[f],b=p[f+1],v=t*u+g*2,T=h[v],A=h[v+1],w=(i-n)/(s-n),y,M,R,D,I;for(let z=0;z<8;z++){y=w*w,M=y*w,R=1-w,D=R*R,I=D*R;let O=I*n+3*D*w*_+3*R*y*T+M*s-i;if(Math.abs(O)<1e-10)break;let G=3*D*(_-n)+6*R*w*(T-_)+3*y*(s-T);if(Math.abs(G)<1e-10)break;w=w-O/G,w=Math.max(0,Math.min(1,w))}a[g]=I*S+3*D*w*b+3*R*y*A+M*m}return a}},Qn=class{constructor(t,n,i,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(n===void 0||n.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=Eh(n,this.TimeBufferType),this.values=Eh(i,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let n=t.constructor,i;if(n.toJSON!==this.toJSON)i=n.toJSON(t);else{i={name:t.name,times:Eh(t.times,Array),values:Eh(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(i.interpolation=s)}return i.type=t.ValueTypeName,i}InterpolantFactoryMethodDiscrete(t){return new cf(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new lf(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new of(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let n=new uf(this.times,this.values,this.getValueSize(),t);return this.settings&&(n.inTangents=this.settings.inTangents,n.outTangents=this.settings.outTangents),n}setInterpolation(t){let n;switch(t){case Il:n=this.InterpolantFactoryMethodDiscrete;break;case Vh:n=this.InterpolantFactoryMethodLinear;break;case wh:n=this.InterpolantFactoryMethodSmooth;break;case Lg:n=this.InterpolantFactoryMethodBezier;break}if(n===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return Lt("KeyframeTrack:",i),this}return this.createInterpolant=n,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Il;case this.InterpolantFactoryMethodLinear:return Vh;case this.InterpolantFactoryMethodSmooth:return wh;case this.InterpolantFactoryMethodBezier:return Lg}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let n=this.times;for(let i=0,s=n.length;i!==s;++i)n[i]+=t}return this}scale(t){if(t!==1){let n=this.times;for(let i=0,s=n.length;i!==s;++i)n[i]*=t}return this}trim(t,n){let i=this.times,s=i.length,a=0,r=s-1;for(;a!==s&&i[a]<t;)++a;for(;r!==-1&&i[r]>n;)--r;if(++r,a!==0||r!==s){a>=r&&(r=Math.max(r,1),a=r-1);let o=this.getValueSize();this.times=i.slice(a,r),this.values=this.values.slice(a*o,r*o)}return this}validate(){let t=!0,n=this.getValueSize();n-Math.floor(n)!==0&&(Ot("KeyframeTrack: Invalid value size in track.",this),t=!1);let i=this.times,s=this.values,a=i.length;a===0&&(Ot("KeyframeTrack: Track is empty.",this),t=!1);let r=null;for(let o=0;o!==a;o++){let l=i[o];if(typeof l=="number"&&isNaN(l)){Ot("KeyframeTrack: Time is not a valid number.",this,o,l),t=!1;break}if(r!==null&&r>l){Ot("KeyframeTrack: Out of order keys.",this,o,l,r),t=!1;break}r=l}if(s!==void 0&&LT(s))for(let o=0,l=s.length;o!==l;++o){let c=s[o];if(isNaN(c)){Ot("KeyframeTrack: Value is not a valid number.",this,o,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),n=this.values.slice(),i=this.getValueSize(),s=this.getInterpolation()===wh,a=t.length-1,r=1;for(let o=1;o<a;++o){let l=!1,c=t[o],h=t[o+1];if(c!==h&&(o!==1||c!==t[0]))if(s)l=!0;else{let p=o*i,u=p-i,d=p+i;for(let g=0;g!==i;++g){let S=n[p+g];if(S!==n[u+g]||S!==n[d+g]){l=!0;break}}}if(l){if(o!==r){t[r]=t[o];let p=o*i,u=r*i;for(let d=0;d!==i;++d)n[u+d]=n[p+d]}++r}}if(a>0){t[r]=t[a];for(let o=a*i,l=r*i,c=0;c!==i;++c)n[l+c]=n[o+c];++r}return r!==t.length?(this.times=t.slice(0,r),this.values=n.slice(0,r*i)):(this.times=t,this.values=n),this}clone(){let t=this.times.slice(),n=this.values.slice(),i=this.constructor,s=new i(this.name,t,n);return s.createInterpolant=this.createInterpolant,s}};Qn.prototype.ValueTypeName="";Qn.prototype.TimeBufferType=Float32Array;Qn.prototype.ValueBufferType=Float32Array;Qn.prototype.DefaultInterpolation=Vh;var ga=class extends Qn{constructor(t,n,i){super(t,n,i)}};ga.prototype.ValueTypeName="bool";ga.prototype.ValueBufferType=Array;ga.prototype.DefaultInterpolation=Il;ga.prototype.InterpolantFactoryMethodLinear=void 0;ga.prototype.InterpolantFactoryMethodSmooth=void 0;var hf=class extends Qn{constructor(t,n,i,s){super(t,n,i,s)}};hf.prototype.ValueTypeName="color";var ff=class extends Qn{constructor(t,n,i,s){super(t,n,i,s)}};ff.prototype.ValueTypeName="number";var df=class extends ma{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=(i-n)/(s-n),c=t*o;for(let h=c+o;c!==h;c+=4)Xi.slerpFlat(a,0,r,c-o,r,c,l);return a}},tc=class extends Qn{constructor(t,n,i,s){super(t,n,i,s)}InterpolantFactoryMethodLinear(t){return new df(this.times,this.values,this.getValueSize(),t)}};tc.prototype.ValueTypeName="quaternion";tc.prototype.InterpolantFactoryMethodSmooth=void 0;var _a=class extends Qn{constructor(t,n,i){super(t,n,i)}};_a.prototype.ValueTypeName="string";_a.prototype.ValueBufferType=Array;_a.prototype.DefaultInterpolation=Il;_a.prototype.InterpolantFactoryMethodLinear=void 0;_a.prototype.InterpolantFactoryMethodSmooth=void 0;var pf=class extends Qn{constructor(t,n,i,s){super(t,n,i,s)}};pf.prototype.ValueTypeName="vector";var mf=class{constructor(t,n,i){let s=this,a=!1,r=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=n,this.onError=i,this._abortController=null,this.itemStart=function(h){o++,a===!1&&s.onStart!==void 0&&s.onStart(h,r,o),a=!0},this.itemEnd=function(h){r++,s.onProgress!==void 0&&s.onProgress(h,r,o),r===o&&(a=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,p){return c.push(h,p),this},this.removeHandler=function(h){let p=c.indexOf(h);return p!==-1&&c.splice(p,2),this},this.getHandler=function(h){for(let p=0,u=c.length;p<u;p+=2){let d=c[p],g=c[p+1];if(d.global&&(d.lastIndex=0),d.test(h))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},GS=new mf,gf=class{constructor(t){this.manager=t!==void 0?t:GS,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,n){let i=this;return new Promise(function(s,a){i.load(t,s,n,a)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};gf.DEFAULT_MATERIAL_NAME="__DEFAULT";var Th=new L,Ah=new Xi,Bi=new L,ec=class extends Kn{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Le,this.projectionMatrix=new Le,this.projectionMatrixInverse=new Le,this.coordinateSystem=Si,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,n){return super.copy(t,n),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(Th,Ah,Bi),Bi.x===1&&Bi.y===1&&Bi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Th,Ah,Bi.set(1,1,1)).invert()}updateWorldMatrix(t,n,i=!1){super.updateWorldMatrix(t,n,i),this.matrixWorld.decompose(Th,Ah,Bi),Bi.x===1&&Bi.y===1&&Bi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Th,Ah,Bi.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},la=new L,nS=new Ut,iS=new Ut,yn=class extends ec{constructor(t=50,n=1,i=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=i,this.far=s,this.focus=10,this.aspect=n,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,n){return super.copy(t,n),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let n=.5*this.getFilmHeight()/t;this.fov=Hh*2*Math.atan(n),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(Ch*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Hh*2*Math.atan(Math.tan(Ch*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,n,i){la.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(la.x,la.y).multiplyScalar(-t/la.z),la.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(la.x,la.y).multiplyScalar(-t/la.z)}getViewSize(t,n){return this.getViewBounds(t,nS,iS),n.subVectors(iS,nS)}setViewOffset(t,n,i,s,a,r){this.aspect=t/n,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=n,this.view.offsetX=i,this.view.offsetY=s,this.view.width=a,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,n=t*Math.tan(Ch*.5*this.fov)/this.zoom,i=2*n,s=this.aspect*i,a=-.5*s,r=this.view;if(this.view!==null&&this.view.enabled){let l=r.fullWidth,c=r.fullHeight;a+=r.offsetX*s/l,n-=r.offsetY*i/c,s*=r.width/l,i*=r.height/c}let o=this.filmOffset;o!==0&&(a+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(a,a+s,n,n-i,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let n=super.toJSON(t);return n.object.fov=this.fov,n.object.zoom=this.zoom,n.object.near=this.near,n.object.far=this.far,n.object.focus=this.focus,n.object.aspect=this.aspect,this.view!==null&&(n.object.view=Object.assign({},this.view)),n.object.filmGauge=this.filmGauge,n.object.filmOffset=this.filmOffset,n}};var nc=class extends ec{constructor(t=-1,n=1,i=1,s=-1,a=.1,r=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=n,this.top=i,this.bottom=s,this.near=a,this.far=r,this.updateProjectionMatrix()}copy(t,n){return super.copy(t,n),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,n,i,s,a,r){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=n,this.view.offsetX=i,this.view.offsetY=s,this.view.width=a,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),n=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,s=(this.top+this.bottom)/2,a=i-t,r=i+t,o=s+n,l=s-n;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;a+=c*this.view.offsetX,r=a+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(a,r,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let n=super.toJSON(t);return n.object.zoom=this.zoom,n.object.left=this.left,n.object.right=this.right,n.object.top=this.top,n.object.bottom=this.bottom,n.object.near=this.near,n.object.far=this.far,this.view!==null&&(n.object.view=Object.assign({},this.view)),n}};var ro=-90,oo=1,_f=class extends Kn{constructor(t,n,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new yn(ro,oo,t,n);s.layers=this.layers,this.add(s);let a=new yn(ro,oo,t,n);a.layers=this.layers,this.add(a);let r=new yn(ro,oo,t,n);r.layers=this.layers,this.add(r);let o=new yn(ro,oo,t,n);o.layers=this.layers,this.add(o);let l=new yn(ro,oo,t,n);l.layers=this.layers,this.add(l);let c=new yn(ro,oo,t,n);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,n=this.children.concat(),[i,s,a,r,o,l]=n;for(let c of n)this.remove(c);if(t===Si)i.up.set(0,1,0),i.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),a.up.set(0,0,-1),a.lookAt(0,1,0),r.up.set(0,0,1),r.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===zl)i.up.set(0,-1,0),i.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),a.up.set(0,0,1),a.lookAt(0,1,0),r.up.set(0,0,-1),r.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of n)this.add(c),c.updateMatrixWorld()}update(t,n){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[a,r,o,l,c,h]=this.children,p=t.getRenderTarget(),u=t.getActiveCubeFace(),d=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;let S=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let m=!1;t.isWebGLRenderer===!0?m=t.state.buffers.depth.getReversed():m=t.reversedDepthBuffer,t.setRenderTarget(i,0,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(n,a),t.setRenderTarget(i,1,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(n,r),t.setRenderTarget(i,2,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(n,o),t.setRenderTarget(i,3,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(n,l),t.setRenderTarget(i,4,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(n,c),i.texture.generateMipmaps=S,t.setRenderTarget(i,5,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(n,h),t.setRenderTarget(p,u,d),t.xr.enabled=g,i.texture.needsPMREMUpdate=!0}},vf=class extends yn{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}};var f0="\\[\\]\\.:\\/",uA=new RegExp("["+f0+"]","g"),d0="[^"+f0+"]",hA="[^"+f0.replace("\\.","")+"]",fA=/((?:WC+[\/:])*)/.source.replace("WC",d0),dA=/(WCOD+)?/.source.replace("WCOD",hA),pA=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",d0),mA=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",d0),gA=new RegExp("^"+fA+dA+pA+mA+"$"),_A=["material","materials","bones","map"],Fg=class{constructor(t,n,i){let s=i||Ae.parseTrackName(n);this._targetGroup=t,this._bindings=t.subscribe_(n,s)}getValue(t,n){this.bind();let i=this._targetGroup.nCachedObjects_,s=this._bindings[i];s!==void 0&&s.getValue(t,n)}setValue(t,n){let i=this._bindings;for(let s=this._targetGroup.nCachedObjects_,a=i.length;s!==a;++s)i[s].setValue(t,n)}bind(){let t=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=t.length;n!==i;++n)t[n].bind()}unbind(){let t=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=t.length;n!==i;++n)t[n].unbind()}},Ae=class e{constructor(t,n,i){this.path=n,this.parsedPath=i||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,i){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,i):new e(t,n,i)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(uA,"")}static parseTrackName(t){let n=gA.exec(t);if(n===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let i={nodeName:n[2],objectName:n[3],objectIndex:n[4],propertyName:n[5],propertyIndex:n[6]},s=i.nodeName&&i.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let a=i.nodeName.substring(s+1);_A.indexOf(a)!==-1&&(i.nodeName=i.nodeName.substring(0,s),i.objectName=a)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return i}static findNode(t,n){if(n===void 0||n===""||n==="."||n===-1||n===t.name||n===t.uuid)return t;if(t.skeleton){let i=t.skeleton.getBoneByName(n);if(i!==void 0)return i}if(t.children){let i=function(a){for(let r=0;r<a.length;r++){let o=a[r];if(o.name===n||o.uuid===n)return o;let l=i(o.children);if(l)return l}return null},s=i(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,n){t[n]=this.targetObject[this.propertyName]}_getValue_array(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)t[n++]=i[s]}_getValue_arrayElement(t,n){t[n]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,n){this.resolvedProperty.toArray(t,n)}_setValue_direct(t,n){this.targetObject[this.propertyName]=t[n]}_setValue_direct_setNeedsUpdate(t,n){this.targetObject[this.propertyName]=t[n],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,n){this.targetObject[this.propertyName]=t[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++]}_setValue_array_setNeedsUpdate(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,n){this.resolvedProperty[this.propertyIndex]=t[n]}_setValue_arrayElement_setNeedsUpdate(t,n){this.resolvedProperty[this.propertyIndex]=t[n],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,n){this.resolvedProperty[this.propertyIndex]=t[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,n){this.resolvedProperty.fromArray(t,n)}_setValue_fromArray_setNeedsUpdate(t,n){this.resolvedProperty.fromArray(t,n),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,n){this.resolvedProperty.fromArray(t,n),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,n){this.bind(),this.getValue(t,n)}_setValue_unbound(t,n){this.bind(),this.setValue(t,n)}bind(){let t=this.node,n=this.parsedPath,i=n.objectName,s=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Lt("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=n.objectIndex;switch(i){case"materials":if(!t.material){Ot("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){Ot("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){Ot("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){Ot("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){Ot("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[i]===void 0){Ot("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[i]}if(c!==void 0){if(t[c]===void 0){Ot("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let r=t[s];if(r===void 0){let c=n.nodeName;Ot("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?o=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(a!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){Ot("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){Ot("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}l=this.BindingType.ArrayElement,this.resolvedProperty=r,this.propertyIndex=a}else r.fromArray!==void 0&&r.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=r):Array.isArray(r)?(l=this.BindingType.EntireArray,this.resolvedProperty=r):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Ae.Composite=Fg;Ae.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Ae.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Ae.prototype.GetterByBindingType=[Ae.prototype._getValue_direct,Ae.prototype._getValue_array,Ae.prototype._getValue_arrayElement,Ae.prototype._getValue_toArray];Ae.prototype.SetterByBindingTypeAndVersioning=[[Ae.prototype._setValue_direct,Ae.prototype._setValue_direct_setNeedsUpdate,Ae.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Ae.prototype._setValue_array,Ae.prototype._setValue_array_setNeedsUpdate,Ae.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Ae.prototype._setValue_arrayElement,Ae.prototype._setValue_arrayElement_setNeedsUpdate,Ae.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Ae.prototype._setValue_fromArray,Ae.prototype._setValue_fromArray_setNeedsUpdate,Ae.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var N2=new Float32Array(1);var Vg=class e{static{e.prototype.isMatrix2=!0}constructor(t,n,i,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,n,i,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,n=0){for(let i=0;i<4;i++)this.elements[i]=t[i+n];return this}set(t,n,i,s){let a=this.elements;return a[0]=t,a[2]=n,a[1]=i,a[3]=s,this}};var ic=class extends po{constructor(t=10,n=10,i=4473924,s=8947848){i=new $t(i),s=new $t(s);let a=n/2,r=t/n,o=t/2,l=[],c=[];for(let u=0,d=0,g=-o;u<=n;u++,g+=r){l.push(-o,0,g,o,0,g),l.push(g,0,-o,g,0,o);let S=u===a?i:s;S.toArray(c,d),d+=3,S.toArray(c,d),d+=3,S.toArray(c,d),d+=3,S.toArray(c,d),d+=3}let h=new on;h.setAttribute("position",new xe(l,3)),h.setAttribute("color",new xe(c,3));let p=new da({vertexColors:!0,toneMapped:!1});super(h,p),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}};function p0(e,t,n,i){let s=vA(i);switch(n){case s0:return e*t;case r0:return e*t/s.components*s.byteLength;case Af:return e*t/s.components*s.byteLength;case ba:return e*t*2/s.components*s.byteLength;case wf:return e*t*2/s.components*s.byteLength;case a0:return e*t*3/s.components*s.byteLength;case mi:return e*t*4/s.components*s.byteLength;case Cf:return e*t*4/s.components*s.byteLength;case oc:case lc:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case cc:case uc:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Df:case Uf:return Math.max(e,16)*Math.max(t,8)/4;case Rf:case Nf:return Math.max(e,8)*Math.max(t,8)/2;case Lf:case If:case Pf:case zf:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case Of:case hc:case Bf:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Ff:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Vf:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case Hf:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case Gf:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case kf:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case Xf:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case Wf:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case qf:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case Yf:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case Zf:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case Jf:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case Kf:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case jf:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case Qf:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case $f:case td:case ed:return Math.ceil(e/4)*Math.ceil(t/4)*16;case nd:case id:return Math.ceil(e/4)*Math.ceil(t/4)*8;case fc:case sd:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${n} format.`)}function vA(e){switch(e){case $n:case t0:return{byteLength:1,components:1};case yo:case e0:case Yi:return{byteLength:2,components:1};case Ef:case Tf:return{byteLength:2,components:4};case Ei:case Mf:case Ti:return{byteLength:4,components:1};case n0:case i0:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:yf}}));typeof window<"u"&&(window.__THREE__?Lt("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=yf);function hM(){let e=null,t=!1,n=null,i=null;function s(a,r){n(a,r),i=e.requestAnimationFrame(s)}return{start:function(){t!==!0&&n!==null&&e!==null&&(i=e.requestAnimationFrame(s),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(i),t=!1},setAnimationLoop:function(a){n=a},setContext:function(a){e=a}}}function yA(e){let t=new WeakMap;function n(o,l){let c=o.array,h=o.usage,p=c.byteLength,u=e.createBuffer();e.bindBuffer(l,u),e.bufferData(l,c,h),o.onUploadCallback();let d;if(c instanceof Float32Array)d=e.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)d=e.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?d=e.HALF_FLOAT:d=e.UNSIGNED_SHORT;else if(c instanceof Int16Array)d=e.SHORT;else if(c instanceof Uint32Array)d=e.UNSIGNED_INT;else if(c instanceof Int32Array)d=e.INT;else if(c instanceof Int8Array)d=e.BYTE;else if(c instanceof Uint8Array)d=e.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)d=e.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:d,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:p}}function i(o,l,c){let h=l.array,p=l.updateRanges;if(e.bindBuffer(c,o),p.length===0)e.bufferSubData(c,0,h);else{p.sort((d,g)=>d.start-g.start);let u=0;for(let d=1;d<p.length;d++){let g=p[u],S=p[d];S.start<=g.start+g.count+1?g.count=Math.max(g.count,S.start+S.count-g.start):(++u,p[u]=S)}p.length=u+1;for(let d=0,g=p.length;d<g;d++){let S=p[d];e.bufferSubData(c,S.start*h.BYTES_PER_ELEMENT,h,S.start,S.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function a(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=t.get(o);l&&(e.deleteBuffer(l.buffer),t.delete(o))}function r(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=t.get(o);if(c===void 0)t.set(o,n(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:s,remove:a,update:r}}var xA=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,bA=`#ifdef USE_ALPHAHASH
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
#endif`,MA=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,EA=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,TA=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,AA=`#ifdef USE_AOMAP
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
#endif`,wA=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,CA=`#ifdef USE_BATCHING
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
#endif`,RA=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,DA=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,NA=`vec3 objectNormal = vec3( normal );
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
} // validated`,LA=`#ifdef USE_IRIDESCENCE
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
#endif`,IA=`#ifdef USE_BUMPMAP
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
#endif`,OA=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,PA=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,zA=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,BA=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,FA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,VA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,HA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,GA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,kA=`#define PI 3.141592653589793
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
} // validated`,XA=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,WA=`vec3 transformedNormal = objectNormal;
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
#endif`,qA=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,YA=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,ZA=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,JA=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,KA="gl_FragColor = linearToOutputTexel( gl_FragColor );",jA=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,QA=`#ifdef USE_ENVMAP
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
#endif`,$A=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,tw=`#ifdef USE_ENVMAP
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
#endif`,ew=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,nw=`#ifdef USE_ENVMAP
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
#endif`,iw=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,sw=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,aw=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,rw=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,ow=`#ifdef USE_GRADIENTMAP
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
}`,lw=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,cw=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,uw=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,hw=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,fw=`#ifdef USE_ENVMAP
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
#endif`,dw=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,pw=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,mw=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,gw=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,_w=`PhysicalMaterial material;
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
#endif`,vw=`uniform sampler2D dfgLUT;
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
}`,yw=`
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
#endif`,xw=`#if defined( RE_IndirectDiffuse )
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
#endif`,bw=`#if defined( RE_IndirectDiffuse )
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
#endif`,Mw=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Ew=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Tw=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Aw=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,ww=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Cw=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Rw=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Dw=`#if defined( USE_POINTS_UV )
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
#endif`,Nw=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Uw=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Lw=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Iw=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Ow=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Pw=`#ifdef USE_MORPHTARGETS
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
#endif`,zw=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Bw=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Fw=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Vw=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Hw=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Gw=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,kw=`#ifdef USE_NORMALMAP
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
#endif`,Xw=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Ww=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,qw=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Yw=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Zw=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Jw=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Kw=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,jw=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Qw=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,$w=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,tC=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,eC=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,nC=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,iC=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,sC=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,aC=`float getShadowMask() {
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
}`,rC=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,oC=`#ifdef USE_SKINNING
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
#endif`,lC=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,cC=`#ifdef USE_SKINNING
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
#endif`,uC=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,hC=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,fC=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,dC=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,pC=`#ifdef USE_TRANSMISSION
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
#endif`,mC=`#ifdef USE_TRANSMISSION
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
#endif`,gC=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,_C=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,vC=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,yC=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,xC=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,bC=`uniform sampler2D t2D;
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
}`,MC=`#ifdef ENVMAP_TYPE_CUBE
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
}`,EC=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,TC=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,AC=`#include <common>
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
}`,wC=`#if DEPTH_PACKING == 3200
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
}`,CC=`#define DISTANCE
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
}`,RC=`#define DISTANCE
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
}`,DC=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,NC=`uniform sampler2D tEquirect;
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
}`,LC=`uniform vec3 diffuse;
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
}`,IC=`#include <common>
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
}`,OC=`uniform vec3 diffuse;
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
}`,PC=`#define LAMBERT
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
}`,zC=`#define LAMBERT
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
}`,BC=`#define MATCAP
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
}`,FC=`#define MATCAP
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
}`,VC=`#define NORMAL
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
}`,HC=`#define NORMAL
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
}`,GC=`#define PHONG
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
}`,kC=`#define PHONG
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
}`,XC=`#define STANDARD
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
}`,WC=`#define STANDARD
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
}`,qC=`#define TOON
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
}`,YC=`#define TOON
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
}`,ZC=`uniform float size;
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
}`,JC=`uniform vec3 diffuse;
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
}`,KC=`#include <common>
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
}`,jC=`uniform vec3 color;
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
}`,QC=`uniform float rotation;
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
}`,$C=`uniform vec3 diffuse;
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
}`,kt={alphahash_fragment:xA,alphahash_pars_fragment:bA,alphamap_fragment:SA,alphamap_pars_fragment:MA,alphatest_fragment:EA,alphatest_pars_fragment:TA,aomap_fragment:AA,aomap_pars_fragment:wA,batching_pars_vertex:CA,batching_vertex:RA,begin_vertex:DA,beginnormal_vertex:NA,bsdfs:UA,iridescence_fragment:LA,bumpmap_pars_fragment:IA,clipping_planes_fragment:OA,clipping_planes_pars_fragment:PA,clipping_planes_pars_vertex:zA,clipping_planes_vertex:BA,color_fragment:FA,color_pars_fragment:VA,color_pars_vertex:HA,color_vertex:GA,common:kA,cube_uv_reflection_fragment:XA,defaultnormal_vertex:WA,displacementmap_pars_vertex:qA,displacementmap_vertex:YA,emissivemap_fragment:ZA,emissivemap_pars_fragment:JA,colorspace_fragment:KA,colorspace_pars_fragment:jA,envmap_fragment:QA,envmap_common_pars_fragment:$A,envmap_pars_fragment:tw,envmap_pars_vertex:ew,envmap_physical_pars_fragment:fw,envmap_vertex:nw,fog_vertex:iw,fog_pars_vertex:sw,fog_fragment:aw,fog_pars_fragment:rw,gradientmap_pars_fragment:ow,lightmap_pars_fragment:lw,lights_lambert_fragment:cw,lights_lambert_pars_fragment:uw,lights_pars_begin:hw,lights_toon_fragment:dw,lights_toon_pars_fragment:pw,lights_phong_fragment:mw,lights_phong_pars_fragment:gw,lights_physical_fragment:_w,lights_physical_pars_fragment:vw,lights_fragment_begin:yw,lights_fragment_maps:xw,lights_fragment_end:bw,lightprobes_pars_fragment:Sw,logdepthbuf_fragment:Mw,logdepthbuf_pars_fragment:Ew,logdepthbuf_pars_vertex:Tw,logdepthbuf_vertex:Aw,map_fragment:ww,map_pars_fragment:Cw,map_particle_fragment:Rw,map_particle_pars_fragment:Dw,metalnessmap_fragment:Nw,metalnessmap_pars_fragment:Uw,morphinstance_vertex:Lw,morphcolor_vertex:Iw,morphnormal_vertex:Ow,morphtarget_pars_vertex:Pw,morphtarget_vertex:zw,normal_fragment_begin:Bw,normal_fragment_maps:Fw,normal_pars_fragment:Vw,normal_pars_vertex:Hw,normal_vertex:Gw,normalmap_pars_fragment:kw,clearcoat_normal_fragment_begin:Xw,clearcoat_normal_fragment_maps:Ww,clearcoat_pars_fragment:qw,iridescence_pars_fragment:Yw,opaque_fragment:Zw,packing:Jw,premultiplied_alpha_fragment:Kw,project_vertex:jw,dithering_fragment:Qw,dithering_pars_fragment:$w,roughnessmap_fragment:tC,roughnessmap_pars_fragment:eC,shadowmap_pars_fragment:nC,shadowmap_pars_vertex:iC,shadowmap_vertex:sC,shadowmask_pars_fragment:aC,skinbase_vertex:rC,skinning_pars_vertex:oC,skinning_vertex:lC,skinnormal_vertex:cC,specularmap_fragment:uC,specularmap_pars_fragment:hC,tonemapping_fragment:fC,tonemapping_pars_fragment:dC,transmission_fragment:pC,transmission_pars_fragment:mC,uv_pars_fragment:gC,uv_pars_vertex:_C,uv_vertex:vC,worldpos_vertex:yC,background_vert:xC,background_frag:bC,backgroundCube_vert:SC,backgroundCube_frag:MC,cube_vert:EC,cube_frag:TC,depth_vert:AC,depth_frag:wC,distance_vert:CC,distance_frag:RC,equirect_vert:DC,equirect_frag:NC,linedashed_vert:UC,linedashed_frag:LC,meshbasic_vert:IC,meshbasic_frag:OC,meshlambert_vert:PC,meshlambert_frag:zC,meshmatcap_vert:BC,meshmatcap_frag:FC,meshnormal_vert:VC,meshnormal_frag:HC,meshphong_vert:GC,meshphong_frag:kC,meshphysical_vert:XC,meshphysical_frag:WC,meshtoon_vert:qC,meshtoon_frag:YC,points_vert:ZC,points_frag:JC,shadow_vert:KC,shadow_frag:jC,sprite_vert:QC,sprite_frag:$C},yt={common:{diffuse:{value:new $t(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Bt},alphaMap:{value:null},alphaMapTransform:{value:new Bt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Bt}},envmap:{envMap:{value:null},envMapRotation:{value:new Bt},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Bt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Bt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Bt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Bt},normalScale:{value:new Ut(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Bt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Bt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Bt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Bt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new $t(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new L},probesMax:{value:new L},probesResolution:{value:new L}},points:{diffuse:{value:new $t(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Bt},alphaTest:{value:0},uvTransform:{value:new Bt}},sprite:{diffuse:{value:new $t(16777215)},opacity:{value:1},center:{value:new Ut(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Bt},alphaMap:{value:null},alphaMapTransform:{value:new Bt},alphaTest:{value:0}}},Ji={basic:{uniforms:bn([yt.common,yt.specularmap,yt.envmap,yt.aomap,yt.lightmap,yt.fog]),vertexShader:kt.meshbasic_vert,fragmentShader:kt.meshbasic_frag},lambert:{uniforms:bn([yt.common,yt.specularmap,yt.envmap,yt.aomap,yt.lightmap,yt.emissivemap,yt.bumpmap,yt.normalmap,yt.displacementmap,yt.fog,yt.lights,{emissive:{value:new $t(0)},envMapIntensity:{value:1}}]),vertexShader:kt.meshlambert_vert,fragmentShader:kt.meshlambert_frag},phong:{uniforms:bn([yt.common,yt.specularmap,yt.envmap,yt.aomap,yt.lightmap,yt.emissivemap,yt.bumpmap,yt.normalmap,yt.displacementmap,yt.fog,yt.lights,{emissive:{value:new $t(0)},specular:{value:new $t(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:kt.meshphong_vert,fragmentShader:kt.meshphong_frag},standard:{uniforms:bn([yt.common,yt.envmap,yt.aomap,yt.lightmap,yt.emissivemap,yt.bumpmap,yt.normalmap,yt.displacementmap,yt.roughnessmap,yt.metalnessmap,yt.fog,yt.lights,{emissive:{value:new $t(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:kt.meshphysical_vert,fragmentShader:kt.meshphysical_frag},toon:{uniforms:bn([yt.common,yt.aomap,yt.lightmap,yt.emissivemap,yt.bumpmap,yt.normalmap,yt.displacementmap,yt.gradientmap,yt.fog,yt.lights,{emissive:{value:new $t(0)}}]),vertexShader:kt.meshtoon_vert,fragmentShader:kt.meshtoon_frag},matcap:{uniforms:bn([yt.common,yt.bumpmap,yt.normalmap,yt.displacementmap,yt.fog,{matcap:{value:null}}]),vertexShader:kt.meshmatcap_vert,fragmentShader:kt.meshmatcap_frag},points:{uniforms:bn([yt.points,yt.fog]),vertexShader:kt.points_vert,fragmentShader:kt.points_frag},dashed:{uniforms:bn([yt.common,yt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:kt.linedashed_vert,fragmentShader:kt.linedashed_frag},depth:{uniforms:bn([yt.common,yt.displacementmap]),vertexShader:kt.depth_vert,fragmentShader:kt.depth_frag},normal:{uniforms:bn([yt.common,yt.bumpmap,yt.normalmap,yt.displacementmap,{opacity:{value:1}}]),vertexShader:kt.meshnormal_vert,fragmentShader:kt.meshnormal_frag},sprite:{uniforms:bn([yt.sprite,yt.fog]),vertexShader:kt.sprite_vert,fragmentShader:kt.sprite_frag},background:{uniforms:{uvTransform:{value:new Bt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:kt.background_vert,fragmentShader:kt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Bt}},vertexShader:kt.backgroundCube_vert,fragmentShader:kt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:kt.cube_vert,fragmentShader:kt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:kt.equirect_vert,fragmentShader:kt.equirect_frag},distance:{uniforms:bn([yt.common,yt.displacementmap,{referencePosition:{value:new L},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:kt.distance_vert,fragmentShader:kt.distance_frag},shadow:{uniforms:bn([yt.lights,yt.fog,{color:{value:new $t(0)},opacity:{value:1}}]),vertexShader:kt.shadow_vert,fragmentShader:kt.shadow_frag}};Ji.physical={uniforms:bn([Ji.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Bt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Bt},clearcoatNormalScale:{value:new Ut(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Bt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Bt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Bt},sheen:{value:0},sheenColor:{value:new $t(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Bt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Bt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Bt},transmissionSamplerSize:{value:new Ut},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Bt},attenuationDistance:{value:0},attenuationColor:{value:new $t(0)},specularColor:{value:new $t(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Bt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Bt},anisotropyVector:{value:new Ut},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Bt}}]),vertexShader:kt.meshphysical_vert,fragmentShader:kt.meshphysical_frag};var od={r:0,b:0,g:0},tR=new Le,fM=new Bt;fM.set(-1,0,0,0,1,0,0,0,1);function eR(e,t,n,i,s,a){let r=new $t(0),o=s===!0?0:1,l,c,h=null,p=0,u=null;function d(_){let b=_.isScene===!0?_.background:null;if(b&&b.isTexture){let v=_.backgroundBlurriness>0;b=t.get(b,v)}return b}function g(_){let b=!1,v=d(_);v===null?m(r,o):v&&v.isColor&&(m(v,1),b=!0);let T=e.xr.getEnvironmentBlendMode();T==="additive"?n.buffers.color.setClear(0,0,0,1,a):T==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||b)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function S(_,b){let v=d(b);v&&(v.isCubeTexture||v.mapping===ac)?(c===void 0&&(c=new Qe(new mo(1,1,1),new jn({name:"BackgroundCubeMaterial",uniforms:tr(Ji.backgroundCube.uniforms),vertexShader:Ji.backgroundCube.vertexShader,fragmentShader:Ji.backgroundCube.fragmentShader,side:An,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(T,A,w){this.matrixWorld.copyPosition(w.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=v,c.material.uniforms.backgroundBlurriness.value=b.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=b.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(tR.makeRotationFromEuler(b.backgroundRotation)).transpose(),v.isCubeTexture&&v.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(fM),c.material.toneMapped=Qt.getTransfer(v.colorSpace)!==oe,(h!==v||p!==v.version||u!==e.toneMapping)&&(c.material.needsUpdate=!0,h=v,p=v.version,u=e.toneMapping),c.layers.enableAll(),_.unshift(c,c.geometry,c.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new Qe(new pa(2,2),new jn({name:"BackgroundMaterial",uniforms:tr(Ji.background.uniforms),vertexShader:Ji.background.vertexShader,fragmentShader:Ji.background.fragmentShader,side:Ms,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=b.backgroundIntensity,l.material.toneMapped=Qt.getTransfer(v.colorSpace)!==oe,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),(h!==v||p!==v.version||u!==e.toneMapping)&&(l.material.needsUpdate=!0,h=v,p=v.version,u=e.toneMapping),l.layers.enableAll(),_.unshift(l,l.geometry,l.material,0,0,null))}function m(_,b){_.getRGB(od,h0(e)),n.buffers.color.setClear(od.r,od.g,od.b,b,a)}function f(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return r},setClearColor:function(_,b=1){r.set(_),o=b,m(r,o)},getClearAlpha:function(){return o},setClearAlpha:function(_){o=_,m(r,o)},render:g,addToRenderList:S,dispose:f}}function nR(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},s=u(null),a=s,r=!1;function o(D,I,z,q,O){let G=!1,V=p(D,q,z,I);a!==V&&(a=V,c(a.object)),G=d(D,q,z,O),G&&g(D,q,z,O),O!==null&&t.update(O,e.ELEMENT_ARRAY_BUFFER),(G||r)&&(r=!1,v(D,I,z,q),O!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(O).buffer))}function l(){return e.createVertexArray()}function c(D){return e.bindVertexArray(D)}function h(D){return e.deleteVertexArray(D)}function p(D,I,z,q){let O=q.wireframe===!0,G=i[I.id];G===void 0&&(G={},i[I.id]=G);let V=D.isInstancedMesh===!0?D.id:0,K=G[V];K===void 0&&(K={},G[V]=K);let it=K[z.id];it===void 0&&(it={},K[z.id]=it);let ht=it[O];return ht===void 0&&(ht=u(l()),it[O]=ht),ht}function u(D){let I=[],z=[],q=[];for(let O=0;O<n;O++)I[O]=0,z[O]=0,q[O]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:I,enabledAttributes:z,attributeDivisors:q,object:D,attributes:{},index:null}}function d(D,I,z,q){let O=a.attributes,G=I.attributes,V=0,K=z.getAttributes();for(let it in K)if(K[it].location>=0){let ft=O[it],_t=G[it];if(_t===void 0&&(it==="instanceMatrix"&&D.instanceMatrix&&(_t=D.instanceMatrix),it==="instanceColor"&&D.instanceColor&&(_t=D.instanceColor)),ft===void 0||ft.attribute!==_t||_t&&ft.data!==_t.data)return!0;V++}return a.attributesNum!==V||a.index!==q}function g(D,I,z,q){let O={},G=I.attributes,V=0,K=z.getAttributes();for(let it in K)if(K[it].location>=0){let ft=G[it];ft===void 0&&(it==="instanceMatrix"&&D.instanceMatrix&&(ft=D.instanceMatrix),it==="instanceColor"&&D.instanceColor&&(ft=D.instanceColor));let _t={};_t.attribute=ft,ft&&ft.data&&(_t.data=ft.data),O[it]=_t,V++}a.attributes=O,a.attributesNum=V,a.index=q}function S(){let D=a.newAttributes;for(let I=0,z=D.length;I<z;I++)D[I]=0}function m(D){f(D,0)}function f(D,I){let z=a.newAttributes,q=a.enabledAttributes,O=a.attributeDivisors;z[D]=1,q[D]===0&&(e.enableVertexAttribArray(D),q[D]=1),O[D]!==I&&(e.vertexAttribDivisor(D,I),O[D]=I)}function _(){let D=a.newAttributes,I=a.enabledAttributes;for(let z=0,q=I.length;z<q;z++)I[z]!==D[z]&&(e.disableVertexAttribArray(z),I[z]=0)}function b(D,I,z,q,O,G,V){V===!0?e.vertexAttribIPointer(D,I,z,O,G):e.vertexAttribPointer(D,I,z,q,O,G)}function v(D,I,z,q){S();let O=q.attributes,G=z.getAttributes(),V=I.defaultAttributeValues;for(let K in G){let it=G[K];if(it.location>=0){let ht=O[K];if(ht===void 0&&(K==="instanceMatrix"&&D.instanceMatrix&&(ht=D.instanceMatrix),K==="instanceColor"&&D.instanceColor&&(ht=D.instanceColor)),ht!==void 0){let ft=ht.normalized,_t=ht.itemSize,Jt=t.get(ht);if(Jt===void 0)continue;let ue=Jt.buffer,Wt=Jt.type,tt=Jt.bytesPerElement,mt=Wt===e.INT||Wt===e.UNSIGNED_INT||ht.gpuType===Mf;if(ht.isInterleavedBufferAttribute){let ot=ht.data,Nt=ot.stride,It=ht.offset;if(ot.isInstancedInterleavedBuffer){for(let Rt=0;Rt<it.locationSize;Rt++)f(it.location+Rt,ot.meshPerAttribute);D.isInstancedMesh!==!0&&q._maxInstanceCount===void 0&&(q._maxInstanceCount=ot.meshPerAttribute*ot.count)}else for(let Rt=0;Rt<it.locationSize;Rt++)m(it.location+Rt);e.bindBuffer(e.ARRAY_BUFFER,ue);for(let Rt=0;Rt<it.locationSize;Rt++)b(it.location+Rt,_t/it.locationSize,Wt,ft,Nt*tt,(It+_t/it.locationSize*Rt)*tt,mt)}else{if(ht.isInstancedBufferAttribute){for(let ot=0;ot<it.locationSize;ot++)f(it.location+ot,ht.meshPerAttribute);D.isInstancedMesh!==!0&&q._maxInstanceCount===void 0&&(q._maxInstanceCount=ht.meshPerAttribute*ht.count)}else for(let ot=0;ot<it.locationSize;ot++)m(it.location+ot);e.bindBuffer(e.ARRAY_BUFFER,ue);for(let ot=0;ot<it.locationSize;ot++)b(it.location+ot,_t/it.locationSize,Wt,ft,_t*tt,_t/it.locationSize*ot*tt,mt)}}else if(V!==void 0){let ft=V[K];if(ft!==void 0)switch(ft.length){case 2:e.vertexAttrib2fv(it.location,ft);break;case 3:e.vertexAttrib3fv(it.location,ft);break;case 4:e.vertexAttrib4fv(it.location,ft);break;default:e.vertexAttrib1fv(it.location,ft)}}}}_()}function T(){M();for(let D in i){let I=i[D];for(let z in I){let q=I[z];for(let O in q){let G=q[O];for(let V in G)h(G[V].object),delete G[V];delete q[O]}}delete i[D]}}function A(D){if(i[D.id]===void 0)return;let I=i[D.id];for(let z in I){let q=I[z];for(let O in q){let G=q[O];for(let V in G)h(G[V].object),delete G[V];delete q[O]}}delete i[D.id]}function w(D){for(let I in i){let z=i[I];for(let q in z){let O=z[q];if(O[D.id]===void 0)continue;let G=O[D.id];for(let V in G)h(G[V].object),delete G[V];delete O[D.id]}}}function y(D){for(let I in i){let z=i[I],q=D.isInstancedMesh===!0?D.id:0,O=z[q];if(O!==void 0){for(let G in O){let V=O[G];for(let K in V)h(V[K].object),delete V[K];delete O[G]}delete z[q],Object.keys(z).length===0&&delete i[I]}}}function M(){R(),r=!0,a!==s&&(a=s,c(a.object))}function R(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:M,resetDefaultState:R,dispose:T,releaseStatesOfGeometry:A,releaseStatesOfObject:y,releaseStatesOfProgram:w,initAttributes:S,enableAttribute:m,disableUnusedAttributes:_}}function iR(e,t,n){let i;function s(l){i=l}function a(l,c){e.drawArrays(i,l,c),n.update(c,i,1)}function r(l,c,h){h!==0&&(e.drawArraysInstanced(i,l,c,h),n.update(c,i,h))}function o(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,h);let u=0;for(let d=0;d<h;d++)u+=c[d];n.update(u,i,1)}this.setMode=s,this.render=a,this.renderInstances=r,this.renderMultiDraw=o}function sR(e,t,n,i){let s;function a(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let w=t.get("EXT_texture_filter_anisotropic");s=e.getParameter(w.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function r(w){return!(w!==mi&&i.convert(w)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(w){let y=w===Yi&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(w!==$n&&i.convert(w)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE)&&w!==Ti&&!y)}function l(w){if(w==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";w="mediump"}return w==="mediump"&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=n.precision!==void 0?n.precision:"highp",h=l(c);h!==c&&(Lt("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let p=n.logarithmicDepthBuffer===!0,u=n.reversedDepthBuffer===!0&&t.has("EXT_clip_control");n.reversedDepthBuffer===!0&&u===!1&&Lt("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let d=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),g=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),S=e.getParameter(e.MAX_TEXTURE_SIZE),m=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),f=e.getParameter(e.MAX_VERTEX_ATTRIBS),_=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),b=e.getParameter(e.MAX_VARYING_VECTORS),v=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),T=e.getParameter(e.MAX_SAMPLES),A=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:l,textureFormatReadable:r,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:p,reversedDepthBuffer:u,maxTextures:d,maxVertexTextures:g,maxTextureSize:S,maxCubemapSize:m,maxAttributes:f,maxVertexUniforms:_,maxVaryings:b,maxFragmentUniforms:v,maxSamples:T,samples:A}}function aR(e){let t=this,n=null,i=0,s=!1,a=!1,r=new Fi,o=new Bt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(p,u){let d=p.length!==0||u||i!==0||s;return s=u,i=p.length,d},this.beginShadows=function(){a=!0,h(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(p,u){n=h(p,u,0)},this.setState=function(p,u,d){let g=p.clippingPlanes,S=p.clipIntersection,m=p.clipShadows,f=e.get(p);if(!s||g===null||g.length===0||a&&!m)a?h(null):c();else{let _=a?0:i,b=_*4,v=f.clippingState||null;l.value=v,v=h(g,u,b,d);for(let T=0;T!==b;++T)v[T]=n[T];f.clippingState=v,this.numIntersection=S?this.numPlanes:0,this.numPlanes+=_}};function c(){l.value!==n&&(l.value=n,l.needsUpdate=i>0),t.numPlanes=i,t.numIntersection=0}function h(p,u,d,g){let S=p!==null?p.length:0,m=null;if(S!==0){if(m=l.value,g!==!0||m===null){let f=d+S*4,_=u.matrixWorldInverse;o.getNormalMatrix(_),(m===null||m.length<f)&&(m=new Float32Array(f));for(let b=0,v=d;b!==S;++b,v+=4)r.copy(p[b]).applyMatrix4(_,o),r.normal.toArray(m,v),m[v+3]=r.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=S,t.numIntersection=0,m}}var Sa=4,kS=[.125,.215,.35,.446,.526,.582],er=20,rR=256,pc=new nc,XS=new $t,m0=null,g0=0,_0=0,v0=!1,oR=new L,cd=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,n=0,i=.1,s=100,a={}){let{size:r=256,position:o=oR}=a;m0=this._renderer.getRenderTarget(),g0=this._renderer.getActiveCubeFace(),_0=this._renderer.getActiveMipmapLevel(),v0=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(r);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(t,i,s,l,o),n>0&&this._blur(l,0,0,n),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(t,n=null){return this._fromTexture(t,n)}fromCubemap(t,n=null){return this._fromTexture(t,n)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=YS(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=qS(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(m0,g0,_0),this._renderer.xr.enabled=v0,t.scissorTest=!1,bo(t,0,0,t.width,t.height)}_fromTexture(t,n){t.mapping===va||t.mapping===$a?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),m0=this._renderer.getRenderTarget(),g0=this._renderer.getActiveCubeFace(),_0=this._renderer.getActiveMipmapLevel(),v0=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=n||this._allocateTargets();return this._textureToCubeUV(t,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),n=4*this._cubeSize,i={magFilter:dn,minFilter:dn,generateMipmaps:!1,type:Yi,format:mi,colorSpace:Ol,depthBuffer:!1},s=WS(t,n,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==n){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=WS(t,n,i);let{_lodMax:a}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=lR(a)),this._blurMaterial=uR(a,t,n),this._ggxMaterial=cR(a,t,n)}return s}_compileMaterial(t){let n=new Qe(new on,t);this._renderer.compile(n,pc)}_sceneToCubeUV(t,n,i,s,a){let l=new yn(90,1,n,i),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],p=this._renderer,u=p.autoClear,d=p.toneMapping;p.getClearColor(XS),p.toneMapping=Mi,p.autoClear=!1,p.state.buffers.depth.getReversed()&&(p.setRenderTarget(s),p.clearDepth(),p.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Qe(new mo,new di({name:"PMREM.Background",side:An,depthWrite:!1,depthTest:!1})));let S=this._backgroundBox,m=S.material,f=!1,_=t.background;_?_.isColor&&(m.color.copy(_),t.background=null,f=!0):(m.color.copy(XS),f=!0);for(let b=0;b<6;b++){let v=b%3;v===0?(l.up.set(0,c[b],0),l.position.set(a.x,a.y,a.z),l.lookAt(a.x+h[b],a.y,a.z)):v===1?(l.up.set(0,0,c[b]),l.position.set(a.x,a.y,a.z),l.lookAt(a.x,a.y+h[b],a.z)):(l.up.set(0,c[b],0),l.position.set(a.x,a.y,a.z),l.lookAt(a.x,a.y,a.z+h[b]));let T=this._cubeSize;bo(s,v*T,b>2?T:0,T,T),p.setRenderTarget(s),f&&p.render(S,l),p.render(t,l)}p.toneMapping=d,p.autoClear=u,t.background=_}_textureToCubeUV(t,n){let i=this._renderer,s=t.mapping===va||t.mapping===$a;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=YS()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=qS());let a=s?this._cubemapMaterial:this._equirectMaterial,r=this._lodMeshes[0];r.material=a;let o=a.uniforms;o.envMap.value=t;let l=this._cubeSize;bo(n,0,0,3*l,2*l),i.setRenderTarget(n),i.render(r,pc)}_applyPMREM(t){let n=this._renderer,i=n.autoClear;n.autoClear=!1;let s=this._lodMeshes.length;for(let a=1;a<s;a++)this._applyGGXFilter(t,a-1,a);n.autoClear=i}_applyGGXFilter(t,n,i){let s=this._renderer,a=this._pingPongRenderTarget,r=this._ggxMaterial,o=this._lodMeshes[i];o.material=r;let l=r.uniforms,c=i/(this._lodMeshes.length-1),h=n/(this._lodMeshes.length-1),p=Math.sqrt(c*c-h*h),u=0+c*1.25,d=p*u,{_lodMax:g}=this,S=this._sizeLods[i],m=3*S*(i>g-Sa?i-g+Sa:0),f=4*(this._cubeSize-S);l.envMap.value=t.texture,l.roughness.value=d,l.mipInt.value=g-n,bo(a,m,f,3*S,2*S),s.setRenderTarget(a),s.render(o,pc),l.envMap.value=a.texture,l.roughness.value=0,l.mipInt.value=g-i,bo(t,m,f,3*S,2*S),s.setRenderTarget(t),s.render(o,pc)}_blur(t,n,i,s,a){let r=this._pingPongRenderTarget;this._halfBlur(t,r,n,i,s,"latitudinal",a),this._halfBlur(r,t,i,i,s,"longitudinal",a)}_halfBlur(t,n,i,s,a,r,o){let l=this._renderer,c=this._blurMaterial;r!=="latitudinal"&&r!=="longitudinal"&&Ot("blur direction must be either latitudinal or longitudinal!");let h=3,p=this._lodMeshes[s];p.material=c;let u=c.uniforms,d=this._sizeLods[i]-1,g=isFinite(a)?Math.PI/(2*d):2*Math.PI/(2*er-1),S=a/g,m=isFinite(a)?1+Math.floor(h*S):er;m>er&&Lt(`sigmaRadians, ${a}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${er}`);let f=[],_=0;for(let w=0;w<er;++w){let y=w/S,M=Math.exp(-y*y/2);f.push(M),w===0?_+=M:w<m&&(_+=2*M)}for(let w=0;w<f.length;w++)f[w]=f[w]/_;u.envMap.value=t.texture,u.samples.value=m,u.weights.value=f,u.latitudinal.value=r==="latitudinal",o&&(u.poleAxis.value=o);let{_lodMax:b}=this;u.dTheta.value=g,u.mipInt.value=b-i;let v=this._sizeLods[s],T=3*v*(s>b-Sa?s-b+Sa:0),A=4*(this._cubeSize-v);bo(n,T,A,3*v,2*v),l.setRenderTarget(n),l.render(p,pc)}};function lR(e){let t=[],n=[],i=[],s=e,a=e-Sa+1+kS.length;for(let r=0;r<a;r++){let o=Math.pow(2,s);t.push(o);let l=1/o;r>e-Sa?l=kS[r-e+Sa-1]:r===0&&(l=0),n.push(l);let c=1/(o-2),h=-c,p=1+c,u=[h,h,p,h,p,p,h,h,p,p,h,p],d=6,g=6,S=3,m=2,f=1,_=new Float32Array(S*g*d),b=new Float32Array(m*g*d),v=new Float32Array(f*g*d);for(let A=0;A<d;A++){let w=A%3*2/3-1,y=A>2?0:-1,M=[w,y,0,w+2/3,y,0,w+2/3,y+1,0,w,y,0,w+2/3,y+1,0,w,y+1,0];_.set(M,S*g*A),b.set(u,m*g*A);let R=[A,A,A,A,A,A];v.set(R,f*g*A)}let T=new on;T.setAttribute("position",new Zn(_,S)),T.setAttribute("uv",new Zn(b,m)),T.setAttribute("faceIndex",new Zn(v,f)),i.push(new Qe(T,null)),s>Sa&&s--}return{lodMeshes:i,sizeLods:t,sigmas:n}}function WS(e,t,n){let i=new Jn(e,t,n);return i.texture.mapping=ac,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function bo(e,t,n,i,s){e.viewport.set(t,n,i,s),e.scissor.set(t,n,i,s)}function cR(e,t,n){return new jn({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:rR,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:fd(),fragmentShader:`

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
		`,blending:qi,depthTest:!1,depthWrite:!1})}function uR(e,t,n){let i=new Float32Array(er),s=new L(0,1,0);return new jn({name:"SphericalGaussianBlur",defines:{n:er,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:fd(),fragmentShader:`

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
		`,blending:qi,depthTest:!1,depthWrite:!1})}function qS(){return new jn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:fd(),fragmentShader:`

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
		`,blending:qi,depthTest:!1,depthWrite:!1})}function YS(){return new jn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:fd(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:qi,depthTest:!1,depthWrite:!1})}function fd(){return`

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
	`}var ud=class extends Jn{constructor(t=1,n={}){super(t,t,n),this.isWebGLCubeRenderTarget=!0;let i={width:t,height:t,depth:1},s=[i,i,i,i,i,i];this.texture=new ql(s),this._setTextureOptions(n),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,n){this.texture.type=n.type,this.texture.colorSpace=n.colorSpace,this.texture.generateMipmaps=n.generateMipmaps,this.texture.minFilter=n.minFilter,this.texture.magFilter=n.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new mo(5,5,5),a=new jn({name:"CubemapFromEquirect",uniforms:tr(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:An,blending:qi});a.uniforms.tEquirect.value=n;let r=new Qe(s,a),o=n.minFilter;return n.minFilter===ya&&(n.minFilter=dn),new _f(1,10,this).update(t,r),n.minFilter=o,r.geometry.dispose(),r.material.dispose(),this}clear(t,n=!0,i=!0,s=!0){let a=t.getRenderTarget();for(let r=0;r<6;r++)t.setRenderTarget(this,r),t.clear(n,i,s);t.setRenderTarget(a)}};function hR(e){let t=new WeakMap,n=new WeakMap,i=null;function s(u,d=!1){return u==null?null:d?r(u):a(u)}function a(u){if(u&&u.isTexture){let d=u.mapping;if(d===xf||d===bf)if(t.has(u)){let g=t.get(u).texture;return o(g,u.mapping)}else{let g=u.image;if(g&&g.height>0){let S=new ud(g.height);return S.fromEquirectangularTexture(e,u),t.set(u,S),u.addEventListener("dispose",c),o(S.texture,u.mapping)}else return null}}return u}function r(u){if(u&&u.isTexture){let d=u.mapping,g=d===xf||d===bf,S=d===va||d===$a;if(g||S){let m=n.get(u),f=m!==void 0?m.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==f)return i===null&&(i=new cd(e)),m=g?i.fromEquirectangular(u,m):i.fromCubemap(u,m),m.texture.pmremVersion=u.pmremVersion,n.set(u,m),m.texture;if(m!==void 0)return m.texture;{let _=u.image;return g&&_&&_.height>0||S&&_&&l(_)?(i===null&&(i=new cd(e)),m=g?i.fromEquirectangular(u):i.fromCubemap(u),m.texture.pmremVersion=u.pmremVersion,n.set(u,m),u.addEventListener("dispose",h),m.texture):null}}}return u}function o(u,d){return d===xf?u.mapping=va:d===bf&&(u.mapping=$a),u}function l(u){let d=0,g=6;for(let S=0;S<g;S++)u[S]!==void 0&&d++;return d===g}function c(u){let d=u.target;d.removeEventListener("dispose",c);let g=t.get(d);g!==void 0&&(t.delete(d),g.dispose())}function h(u){let d=u.target;d.removeEventListener("dispose",h);let g=n.get(d);g!==void 0&&(n.delete(d),g.dispose())}function p(){t=new WeakMap,n=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:s,dispose:p}}function fR(e){let t={};function n(i){if(t[i]!==void 0)return t[i];let s=e.getExtension(i);return t[i]=s,s}return{has:function(i){return n(i)!==null},init:function(){n("EXT_color_buffer_float"),n("WEBGL_clip_cull_distance"),n("OES_texture_float_linear"),n("EXT_color_buffer_half_float"),n("WEBGL_multisampled_render_to_texture"),n("WEBGL_render_shared_exponent")},get:function(i){let s=n(i);return s===null&&Ja("WebGLRenderer: "+i+" extension not supported."),s}}}function dR(e,t,n,i){let s={},a=new WeakMap;function r(p){let u=p.target;u.index!==null&&t.remove(u.index);for(let g in u.attributes)t.remove(u.attributes[g]);u.removeEventListener("dispose",r),delete s[u.id];let d=a.get(u);d&&(t.remove(d),a.delete(u)),i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,n.memory.geometries--}function o(p,u){return s[u.id]===!0||(u.addEventListener("dispose",r),s[u.id]=!0,n.memory.geometries++),u}function l(p){let u=p.attributes;for(let d in u)t.update(u[d],e.ARRAY_BUFFER)}function c(p){let u=[],d=p.index,g=p.attributes.position,S=0;if(g===void 0)return;if(d!==null){let _=d.array;S=d.version;for(let b=0,v=_.length;b<v;b+=3){let T=_[b+0],A=_[b+1],w=_[b+2];u.push(T,A,A,w,w,T)}}else{let _=g.array;S=g.version;for(let b=0,v=_.length/3-1;b<v;b+=3){let T=b+0,A=b+1,w=b+2;u.push(T,A,A,w,w,T)}}let m=new(g.count>=65535?kl:Gl)(u,1);m.version=S;let f=a.get(p);f&&t.remove(f),a.set(p,m)}function h(p){let u=a.get(p);if(u){let d=p.index;d!==null&&u.version<d.version&&c(p)}else c(p);return a.get(p)}return{get:o,update:l,getWireframeAttribute:h}}function pR(e,t,n){let i;function s(p){i=p}let a,r;function o(p){a=p.type,r=p.bytesPerElement}function l(p,u){e.drawElements(i,u,a,p*r),n.update(u,i,1)}function c(p,u,d){d!==0&&(e.drawElementsInstanced(i,u,a,p*r,d),n.update(u,i,d))}function h(p,u,d){if(d===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,a,p,0,d);let S=0;for(let m=0;m<d;m++)S+=u[m];n.update(S,i,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function mR(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function i(a,r,o){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=o*(a/3);break;case e.LINES:n.lines+=o*(a/2);break;case e.LINE_STRIP:n.lines+=o*(a-1);break;case e.LINE_LOOP:n.lines+=o*a;break;case e.POINTS:n.points+=o*a;break;default:Ot("WebGLInfo: Unknown draw mode:",r);break}}function s(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:s,update:i}}function gR(e,t,n){let i=new WeakMap,s=new Ie;function a(r,o,l){let c=r.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,p=h!==void 0?h.length:0,u=i.get(o);if(u===void 0||u.count!==p){let M=function(){w.dispose(),i.delete(o),o.removeEventListener("dispose",M)};u!==void 0&&u.texture.dispose();let d=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,S=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],f=o.morphAttributes.normal||[],_=o.morphAttributes.color||[],b=0;d===!0&&(b=1),g===!0&&(b=2),S===!0&&(b=3);let v=o.attributes.position.count*b,T=1;v>t.maxTextureSize&&(T=Math.ceil(v/t.maxTextureSize),v=t.maxTextureSize);let A=new Float32Array(v*T*4*p),w=new Fl(A,v,T,p);w.type=Ti,w.needsUpdate=!0;let y=b*4;for(let R=0;R<p;R++){let D=m[R],I=f[R],z=_[R],q=v*T*4*R;for(let O=0;O<D.count;O++){let G=O*y;d===!0&&(s.fromBufferAttribute(D,O),A[q+G+0]=s.x,A[q+G+1]=s.y,A[q+G+2]=s.z,A[q+G+3]=0),g===!0&&(s.fromBufferAttribute(I,O),A[q+G+4]=s.x,A[q+G+5]=s.y,A[q+G+6]=s.z,A[q+G+7]=0),S===!0&&(s.fromBufferAttribute(z,O),A[q+G+8]=s.x,A[q+G+9]=s.y,A[q+G+10]=s.z,A[q+G+11]=z.itemSize===4?s.w:1)}}u={count:p,texture:w,size:new Ut(v,T)},i.set(o,u),o.addEventListener("dispose",M)}if(r.isInstancedMesh===!0&&r.morphTexture!==null)l.getUniforms().setValue(e,"morphTexture",r.morphTexture,n);else{let d=0;for(let S=0;S<c.length;S++)d+=c[S];let g=o.morphTargetsRelative?1:1-d;l.getUniforms().setValue(e,"morphTargetBaseInfluence",g),l.getUniforms().setValue(e,"morphTargetInfluences",c)}l.getUniforms().setValue(e,"morphTargetsTexture",u.texture,n),l.getUniforms().setValue(e,"morphTargetsTextureSize",u.size)}return{update:a}}function _R(e,t,n,i,s){let a=new WeakMap;function r(c){let h=s.render.frame,p=c.geometry,u=t.get(c,p);if(a.get(u)!==h&&(t.update(u),a.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),a.get(c)!==h&&(n.update(c.instanceMatrix,e.ARRAY_BUFFER),c.instanceColor!==null&&n.update(c.instanceColor,e.ARRAY_BUFFER),a.set(c,h))),c.isSkinnedMesh){let d=c.skeleton;a.get(d)!==h&&(d.update(),a.set(d,h))}return u}function o(){a=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),n.remove(h.instanceMatrix),h.instanceColor!==null&&n.remove(h.instanceColor)}return{update:r,dispose:o}}var vR={[qg]:"LINEAR_TONE_MAPPING",[Yg]:"REINHARD_TONE_MAPPING",[Zg]:"CINEON_TONE_MAPPING",[Jg]:"ACES_FILMIC_TONE_MAPPING",[jg]:"AGX_TONE_MAPPING",[Qg]:"NEUTRAL_TONE_MAPPING",[Kg]:"CUSTOM_TONE_MAPPING"};function yR(e,t,n,i,s,a){let r=new Jn(t,n,{type:e,depthBuffer:s,stencilBuffer:a,samples:i?4:0,depthTexture:s?new Es(t,n):void 0}),o=new Jn(t,n,{type:Yi,depthBuffer:!1,stencilBuffer:!1}),l=new on;l.setAttribute("position",new xe([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new xe([0,2,0,0,2,0],2));let c=new sf({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),h=new Qe(l,c),p=new nc(-1,1,1,-1,0,1),u=null,d=null,g=!1,S,m=null,f=[],_=!1;this.setSize=function(b,v){r.setSize(b,v),o.setSize(b,v);for(let T=0;T<f.length;T++){let A=f[T];A.setSize&&A.setSize(b,v)}},this.setEffects=function(b){f=b,_=f.length>0&&f[0].isRenderPass===!0;let v=r.width,T=r.height;for(let A=0;A<f.length;A++){let w=f[A];w.setSize&&w.setSize(v,T)}},this.begin=function(b,v){if(g||b.toneMapping===Mi&&f.length===0)return!1;if(m=v,v!==null){let T=v.width,A=v.height;(r.width!==T||r.height!==A)&&this.setSize(T,A)}return _===!1&&b.setRenderTarget(r),S=b.toneMapping,b.toneMapping=Mi,!0},this.hasRenderPass=function(){return _},this.end=function(b,v){b.toneMapping=S,g=!0;let T=r,A=o;for(let w=0;w<f.length;w++){let y=f[w];if(y.enabled!==!1&&(y.render(b,A,T,v),y.needsSwap!==!1)){let M=T;T=A,A=M}}if(u!==b.outputColorSpace||d!==b.toneMapping){u=b.outputColorSpace,d=b.toneMapping,c.defines={},Qt.getTransfer(u)===oe&&(c.defines.SRGB_TRANSFER="");let w=vR[d];w&&(c.defines[w]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=T.texture,b.setRenderTarget(m),b.render(h,p),m=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){r.depthTexture&&r.depthTexture.dispose(),r.dispose(),o.dispose(),l.dispose(),c.dispose()}}var dM=new xn,b0=new Es(1,1),pM=new Fl,mM=new Xh,gM=new ql,ZS=[],JS=[],KS=new Float32Array(16),jS=new Float32Array(9),QS=new Float32Array(4);function Mo(e,t,n){let i=e[0];if(i<=0||i>0)return e;let s=t*n,a=ZS[s];if(a===void 0&&(a=new Float32Array(s),ZS[s]=a),t!==0){i.toArray(a,0);for(let r=1,o=0;r!==t;++r)o+=n,e[r].toArray(a,o)}return a}function $e(e,t){if(e.length!==t.length)return!1;for(let n=0,i=e.length;n<i;n++)if(e[n]!==t[n])return!1;return!0}function tn(e,t){for(let n=0,i=t.length;n<i;n++)e[n]=t[n]}function dd(e,t){let n=JS[t];n===void 0&&(n=new Int32Array(t),JS[t]=n);for(let i=0;i!==t;++i)n[i]=e.allocateTextureUnit();return n}function xR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function bR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if($e(n,t))return;e.uniform2fv(this.addr,t),tn(n,t)}}function SR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if($e(n,t))return;e.uniform3fv(this.addr,t),tn(n,t)}}function MR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if($e(n,t))return;e.uniform4fv(this.addr,t),tn(n,t)}}function ER(e,t){let n=this.cache,i=t.elements;if(i===void 0){if($e(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),tn(n,t)}else{if($e(n,i))return;QS.set(i),e.uniformMatrix2fv(this.addr,!1,QS),tn(n,i)}}function TR(e,t){let n=this.cache,i=t.elements;if(i===void 0){if($e(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),tn(n,t)}else{if($e(n,i))return;jS.set(i),e.uniformMatrix3fv(this.addr,!1,jS),tn(n,i)}}function AR(e,t){let n=this.cache,i=t.elements;if(i===void 0){if($e(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),tn(n,t)}else{if($e(n,i))return;KS.set(i),e.uniformMatrix4fv(this.addr,!1,KS),tn(n,i)}}function wR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function CR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if($e(n,t))return;e.uniform2iv(this.addr,t),tn(n,t)}}function RR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if($e(n,t))return;e.uniform3iv(this.addr,t),tn(n,t)}}function DR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if($e(n,t))return;e.uniform4iv(this.addr,t),tn(n,t)}}function NR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function UR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if($e(n,t))return;e.uniform2uiv(this.addr,t),tn(n,t)}}function LR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if($e(n,t))return;e.uniform3uiv(this.addr,t),tn(n,t)}}function IR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if($e(n,t))return;e.uniform4uiv(this.addr,t),tn(n,t)}}function OR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s);let a;this.type===e.SAMPLER_2D_SHADOW?(b0.compareFunction=n.isReversedDepthBuffer()?rd:ad,a=b0):a=dM,n.setTexture2D(t||a,s)}function PR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTexture3D(t||mM,s)}function zR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTextureCube(t||gM,s)}function BR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTexture2DArray(t||pM,s)}function FR(e){switch(e){case 5126:return xR;case 35664:return bR;case 35665:return SR;case 35666:return MR;case 35674:return ER;case 35675:return TR;case 35676:return AR;case 5124:case 35670:return wR;case 35667:case 35671:return CR;case 35668:case 35672:return RR;case 35669:case 35673:return DR;case 5125:return NR;case 36294:return UR;case 36295:return LR;case 36296:return IR;case 35678:case 36198:case 36298:case 36306:case 35682:return OR;case 35679:case 36299:case 36307:return PR;case 35680:case 36300:case 36308:case 36293:return zR;case 36289:case 36303:case 36311:case 36292:return BR}}function VR(e,t){e.uniform1fv(this.addr,t)}function HR(e,t){let n=Mo(t,this.size,2);e.uniform2fv(this.addr,n)}function GR(e,t){let n=Mo(t,this.size,3);e.uniform3fv(this.addr,n)}function kR(e,t){let n=Mo(t,this.size,4);e.uniform4fv(this.addr,n)}function XR(e,t){let n=Mo(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function WR(e,t){let n=Mo(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function qR(e,t){let n=Mo(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function YR(e,t){e.uniform1iv(this.addr,t)}function ZR(e,t){e.uniform2iv(this.addr,t)}function JR(e,t){e.uniform3iv(this.addr,t)}function KR(e,t){e.uniform4iv(this.addr,t)}function jR(e,t){e.uniform1uiv(this.addr,t)}function QR(e,t){e.uniform2uiv(this.addr,t)}function $R(e,t){e.uniform3uiv(this.addr,t)}function t3(e,t){e.uniform4uiv(this.addr,t)}function e3(e,t,n){let i=this.cache,s=t.length,a=dd(n,s);$e(i,a)||(e.uniform1iv(this.addr,a),tn(i,a));let r;this.type===e.SAMPLER_2D_SHADOW?r=b0:r=dM;for(let o=0;o!==s;++o)n.setTexture2D(t[o]||r,a[o])}function n3(e,t,n){let i=this.cache,s=t.length,a=dd(n,s);$e(i,a)||(e.uniform1iv(this.addr,a),tn(i,a));for(let r=0;r!==s;++r)n.setTexture3D(t[r]||mM,a[r])}function i3(e,t,n){let i=this.cache,s=t.length,a=dd(n,s);$e(i,a)||(e.uniform1iv(this.addr,a),tn(i,a));for(let r=0;r!==s;++r)n.setTextureCube(t[r]||gM,a[r])}function s3(e,t,n){let i=this.cache,s=t.length,a=dd(n,s);$e(i,a)||(e.uniform1iv(this.addr,a),tn(i,a));for(let r=0;r!==s;++r)n.setTexture2DArray(t[r]||pM,a[r])}function a3(e){switch(e){case 5126:return VR;case 35664:return HR;case 35665:return GR;case 35666:return kR;case 35674:return XR;case 35675:return WR;case 35676:return qR;case 5124:case 35670:return YR;case 35667:case 35671:return ZR;case 35668:case 35672:return JR;case 35669:case 35673:return KR;case 5125:return jR;case 36294:return QR;case 36295:return $R;case 36296:return t3;case 35678:case 36198:case 36298:case 36306:case 35682:return e3;case 35679:case 36299:case 36307:return n3;case 35680:case 36300:case 36308:case 36293:return i3;case 36289:case 36303:case 36311:case 36292:return s3}}var S0=class{constructor(t,n,i){this.id=t,this.addr=i,this.cache=[],this.type=n.type,this.setValue=FR(n.type)}},M0=class{constructor(t,n,i){this.id=t,this.addr=i,this.cache=[],this.type=n.type,this.size=n.size,this.setValue=a3(n.type)}},E0=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,n,i){let s=this.seq;for(let a=0,r=s.length;a!==r;++a){let o=s[a];o.setValue(t,n[o.id],i)}}},y0=/(\w+)(\])?(\[|\.)?/g;function $S(e,t){e.seq.push(t),e.map[t.id]=t}function r3(e,t,n){let i=e.name,s=i.length;for(y0.lastIndex=0;;){let a=y0.exec(i),r=y0.lastIndex,o=a[1],l=a[2]==="]",c=a[3];if(l&&(o=o|0),c===void 0||c==="["&&r+2===s){$S(n,c===void 0?new S0(o,e,t):new M0(o,e,t));break}else{let p=n.map[o];p===void 0&&(p=new E0(o),$S(n,p)),n=p}}}var So=class{constructor(t,n){this.seq=[],this.map={};let i=t.getProgramParameter(n,t.ACTIVE_UNIFORMS);for(let r=0;r<i;++r){let o=t.getActiveUniform(n,r),l=t.getUniformLocation(n,o.name);r3(o,l,this)}let s=[],a=[];for(let r of this.seq)r.type===t.SAMPLER_2D_SHADOW||r.type===t.SAMPLER_CUBE_SHADOW||r.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(r):a.push(r);s.length>0&&(this.seq=s.concat(a))}setValue(t,n,i,s){let a=this.map[n];a!==void 0&&a.setValue(t,i,s)}setOptional(t,n,i){let s=n[i];s!==void 0&&this.setValue(t,i,s)}static upload(t,n,i,s){for(let a=0,r=n.length;a!==r;++a){let o=n[a],l=i[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,s)}}static seqWithValue(t,n){let i=[];for(let s=0,a=t.length;s!==a;++s){let r=t[s];r.id in n&&i.push(r)}return i}};function tM(e,t,n){let i=e.createShader(t);return e.shaderSource(i,n),e.compileShader(i),i}var o3=37297,l3=0;function c3(e,t){let n=e.split(`
`),i=[],s=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let r=s;r<a;r++){let o=r+1;i.push(`${o===t?">":" "} ${o}: ${n[r]}`)}return i.join(`
`)}var eM=new Bt;function u3(e){Qt._getMatrix(eM,Qt.workingColorSpace,e);let t=`mat3( ${eM.elements.map(n=>n.toFixed(4))} )`;switch(Qt.getTransfer(e)){case Pl:return[t,"LinearTransferOETF"];case oe:return[t,"sRGBTransferOETF"];default:return Lt("WebGLProgram: Unsupported color space: ",e),[t,"LinearTransferOETF"]}}function nM(e,t,n){let i=e.getShaderParameter(t,e.COMPILE_STATUS),a=(e.getShaderInfoLog(t)||"").trim();if(i&&a==="")return"";let r=/ERROR: 0:(\d+)/.exec(a);if(r){let o=parseInt(r[1]);return n.toUpperCase()+`

`+a+`

`+c3(e.getShaderSource(t),o)}else return a}function h3(e,t){let n=u3(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,"}"].join(`
`)}var f3={[qg]:"Linear",[Yg]:"Reinhard",[Zg]:"Cineon",[Jg]:"ACESFilmic",[jg]:"AgX",[Qg]:"Neutral",[Kg]:"Custom"};function d3(e,t){let n=f3[t];return n===void 0?(Lt("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+e+"( vec3 color ) { return "+n+"ToneMapping( color ); }"}var ld=new L;function p3(){Qt.getLuminanceCoefficients(ld);let e=ld.x.toFixed(4),t=ld.y.toFixed(4),n=ld.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${t}, ${n} );`,"	return dot( weights, rgb );","}"].join(`
`)}function m3(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(gc).join(`
`)}function g3(e){let t=[];for(let n in e){let i=e[n];i!==!1&&t.push("#define "+n+" "+i)}return t.join(`
`)}function _3(e,t){let n={},i=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let s=0;s<i;s++){let a=e.getActiveAttrib(t,s),r=a.name,o=1;a.type===e.FLOAT_MAT2&&(o=2),a.type===e.FLOAT_MAT3&&(o=3),a.type===e.FLOAT_MAT4&&(o=4),n[r]={type:a.type,location:e.getAttribLocation(t,r),locationSize:o}}return n}function gc(e){return e!==""}function iM(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function sM(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var v3=/^[ \t]*#include +<([\w\d./]+)>/gm;function T0(e){return e.replace(v3,x3)}var y3=new Map;function x3(e,t){let n=kt[t];if(n===void 0){let i=y3.get(t);if(i!==void 0)n=kt[i],Lt('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return T0(n)}var b3=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function aM(e){return e.replace(b3,S3)}function S3(e,t,n,i){let s="";for(let a=parseInt(t);a<parseInt(n);a++)s+=i.replace(/\[\s*i\s*\]/g,"[ "+a+" ]").replace(/UNROLLED_LOOP_INDEX/g,a);return s}function rM(e){let t=`precision ${e.precision} float;
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
#define LOW_PRECISION`),t}var M3={[sc]:"SHADOWMAP_TYPE_PCF",[vo]:"SHADOWMAP_TYPE_VSM"};function E3(e){return M3[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var T3={[va]:"ENVMAP_TYPE_CUBE",[$a]:"ENVMAP_TYPE_CUBE",[ac]:"ENVMAP_TYPE_CUBE_UV"};function A3(e){return e.envMap===!1?"ENVMAP_TYPE_CUBE":T3[e.envMapMode]||"ENVMAP_TYPE_CUBE"}var w3={[$a]:"ENVMAP_MODE_REFRACTION"};function C3(e){return e.envMap===!1?"ENVMAP_MODE_REFLECTION":w3[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}var R3={[Wg]:"ENVMAP_BLENDING_MULTIPLY",[TS]:"ENVMAP_BLENDING_MIX",[AS]:"ENVMAP_BLENDING_ADD"};function D3(e){return e.envMap===!1?"ENVMAP_BLENDING_NONE":R3[e.combine]||"ENVMAP_BLENDING_NONE"}function N3(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,n),7*16)),texelHeight:i,maxMip:n}}function U3(e,t,n,i){let s=e.getContext(),a=n.defines,r=n.vertexShader,o=n.fragmentShader,l=E3(n),c=A3(n),h=C3(n),p=D3(n),u=N3(n),d=m3(n),g=g3(a),S=s.createProgram(),m,f,_=n.glslVersion?"#version "+n.glslVersion+`
`:"";n.isRawShaderMaterial?(m=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(gc).join(`
`),m.length>0&&(m+=`
`),f=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(gc).join(`
`),f.length>0&&(f+=`
`)):(m=[rM(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",n.batching?"#define USE_BATCHING":"",n.batchingColor?"#define USE_BATCHING_COLOR":"",n.instancing?"#define USE_INSTANCING":"",n.instancingColor?"#define USE_INSTANCING_COLOR":"",n.instancingMorph?"#define USE_INSTANCING_MORPH":"",n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.map?"#define USE_MAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+h:"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.displacementMap?"#define USE_DISPLACEMENTMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.mapUv?"#define MAP_UV "+n.mapUv:"",n.alphaMapUv?"#define ALPHAMAP_UV "+n.alphaMapUv:"",n.lightMapUv?"#define LIGHTMAP_UV "+n.lightMapUv:"",n.aoMapUv?"#define AOMAP_UV "+n.aoMapUv:"",n.emissiveMapUv?"#define EMISSIVEMAP_UV "+n.emissiveMapUv:"",n.bumpMapUv?"#define BUMPMAP_UV "+n.bumpMapUv:"",n.normalMapUv?"#define NORMALMAP_UV "+n.normalMapUv:"",n.displacementMapUv?"#define DISPLACEMENTMAP_UV "+n.displacementMapUv:"",n.metalnessMapUv?"#define METALNESSMAP_UV "+n.metalnessMapUv:"",n.roughnessMapUv?"#define ROUGHNESSMAP_UV "+n.roughnessMapUv:"",n.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+n.anisotropyMapUv:"",n.clearcoatMapUv?"#define CLEARCOATMAP_UV "+n.clearcoatMapUv:"",n.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+n.clearcoatNormalMapUv:"",n.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+n.clearcoatRoughnessMapUv:"",n.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+n.iridescenceMapUv:"",n.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+n.iridescenceThicknessMapUv:"",n.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+n.sheenColorMapUv:"",n.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+n.sheenRoughnessMapUv:"",n.specularMapUv?"#define SPECULARMAP_UV "+n.specularMapUv:"",n.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+n.specularColorMapUv:"",n.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+n.specularIntensityMapUv:"",n.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+n.transmissionMapUv:"",n.thicknessMapUv?"#define THICKNESSMAP_UV "+n.thicknessMapUv:"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexNormals?"#define HAS_NORMAL":"",n.vertexColors?"#define USE_COLOR":"",n.vertexAlphas?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.flatShading?"#define FLAT_SHADED":"",n.skinning?"#define USE_SKINNING":"",n.morphTargets?"#define USE_MORPHTARGETS":"",n.morphNormals&&n.flatShading===!1?"#define USE_MORPHNORMALS":"",n.morphColors?"#define USE_MORPHCOLORS":"",n.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+n.morphTextureStride:"",n.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+n.morphTargetsCount:"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.sizeAttenuation?"#define USE_SIZEATTENUATION":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(gc).join(`
`),f=[rM(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",n.map?"#define USE_MAP":"",n.matcap?"#define USE_MATCAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+c:"",n.envMap?"#define "+h:"",n.envMap?"#define "+p:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoat?"#define USE_CLEARCOAT":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.dispersion?"#define USE_DISPERSION":"",n.iridescence?"#define USE_IRIDESCENCE":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaTest?"#define USE_ALPHATEST":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.sheen?"#define USE_SHEEN":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexColors||n.instancingColor?"#define USE_COLOR":"",n.vertexAlphas||n.batchingColor?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.gradientMap?"#define USE_GRADIENTMAP":"",n.flatShading?"#define FLAT_SHADED":"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",n.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",n.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",n.toneMapping!==Mi?"#define TONE_MAPPING":"",n.toneMapping!==Mi?kt.tonemapping_pars_fragment:"",n.toneMapping!==Mi?d3("toneMapping",n.toneMapping):"",n.dithering?"#define DITHERING":"",n.opaque?"#define OPAQUE":"",kt.colorspace_pars_fragment,h3("linearToOutputTexel",n.outputColorSpace),p3(),n.useDepthPacking?"#define DEPTH_PACKING "+n.depthPacking:"",`
`].filter(gc).join(`
`)),r=T0(r),r=iM(r,n),r=sM(r,n),o=T0(o),o=iM(o,n),o=sM(o,n),r=aM(r),o=aM(o),n.isRawShaderMaterial!==!0&&(_=`#version 300 es
`,m=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,f=["#define varying in",n.glslVersion===l0?"":"layout(location = 0) out highp vec4 pc_fragColor;",n.glslVersion===l0?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);let b=_+m+r,v=_+f+o,T=tM(s,s.VERTEX_SHADER,b),A=tM(s,s.FRAGMENT_SHADER,v);s.attachShader(S,T),s.attachShader(S,A),n.index0AttributeName!==void 0?s.bindAttribLocation(S,0,n.index0AttributeName):n.hasPositionAttribute===!0&&s.bindAttribLocation(S,0,"position"),s.linkProgram(S);function w(D){if(e.debug.checkShaderErrors){let I=s.getProgramInfoLog(S)||"",z=s.getShaderInfoLog(T)||"",q=s.getShaderInfoLog(A)||"",O=I.trim(),G=z.trim(),V=q.trim(),K=!0,it=!0;if(s.getProgramParameter(S,s.LINK_STATUS)===!1)if(K=!1,typeof e.debug.onShaderError=="function")e.debug.onShaderError(s,S,T,A);else{let ht=nM(s,T,"vertex"),ft=nM(s,A,"fragment");Ot("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(S,s.VALIDATE_STATUS)+`

Material Name: `+D.name+`
Material Type: `+D.type+`

Program Info Log: `+O+`
`+ht+`
`+ft)}else O!==""?Lt("WebGLProgram: Program Info Log:",O):(G===""||V==="")&&(it=!1);it&&(D.diagnostics={runnable:K,programLog:O,vertexShader:{log:G,prefix:m},fragmentShader:{log:V,prefix:f}})}s.deleteShader(T),s.deleteShader(A),y=new So(s,S),M=_3(s,S)}let y;this.getUniforms=function(){return y===void 0&&w(this),y};let M;this.getAttributes=function(){return M===void 0&&w(this),M};let R=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return R===!1&&(R=s.getProgramParameter(S,o3)),R},this.destroy=function(){i.releaseStatesOfProgram(this),s.deleteProgram(S),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=l3++,this.cacheKey=t,this.usedTimes=1,this.program=S,this.vertexShader=T,this.fragmentShader=A,this}var L3=0,A0=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,n,i){let s=this._getShaderCacheForMaterial(t);return s.has(n)===!1&&(s.add(n),n.usedTimes++),s.has(i)===!1&&(s.add(i),i.usedTimes++),this}remove(t){let n=this.materialCache.get(t);for(let i of n)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let n=this.materialCache,i=n.get(t);return i===void 0&&(i=new Set,n.set(t,i)),i}_getShaderStage(t){let n=this.shaderCache,i=n.get(t);return i===void 0&&(i=new w0(t),n.set(t,i)),i}},w0=class{constructor(t){this.id=L3++,this.code=t,this.usedTimes=0}};function I3(e){return e===ba||e===hc||e===fc}function O3(e,t,n,i,s,a){let r=new Vl,o=new A0,l=new Set,c=[],h=new Map,p=i.logarithmicDepthBuffer,u=i.precision,d={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(y){return l.add(y),y===0?"uv":`uv${y}`}function S(y,M,R,D,I,z){let q=D.fog,O=I.geometry,G=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?D.environment:null,V=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap,K=t.get(y.envMap||G,V),it=K&&K.mapping===ac?K.image.height:null,ht=d[y.type];y.precision!==null&&(u=i.getMaxPrecision(y.precision),u!==y.precision&&Lt("WebGLProgram.getParameters:",y.precision,"not supported, using",u,"instead."));let ft=O.morphAttributes.position||O.morphAttributes.normal||O.morphAttributes.color,_t=ft!==void 0?ft.length:0,Jt=0;O.morphAttributes.position!==void 0&&(Jt=1),O.morphAttributes.normal!==void 0&&(Jt=2),O.morphAttributes.color!==void 0&&(Jt=3);let ue,Wt,tt,mt;if(ht){let Et=Ji[ht];ue=Et.vertexShader,Wt=Et.fragmentShader}else{ue=y.vertexShader,Wt=y.fragmentShader;let Et=o.getVertexShaderStage(y),Pe=o.getFragmentShaderStage(y);o.update(y,Et,Pe),tt=Et.id,mt=Pe.id}let ot=e.getRenderTarget(),Nt=e.state.buffers.depth.getReversed(),It=I.isInstancedMesh===!0,Rt=I.isBatchedMesh===!0,we=!!y.map,zt=!!y.matcap,re=!!K,Vt=!!y.aoMap,Kt=!!y.lightMap,be=!!y.bumpMap&&y.wireframe===!1,Ne=!!y.normalMap,Ue=!!y.displacementMap,Ve=!!y.emissiveMap,Ce=!!y.metalnessMap,Oe=!!y.roughnessMap,P=y.anisotropy>0,pn=y.clearcoat>0,ie=y.dispersion>0,C=y.iridescence>0,x=y.sheen>0,F=y.transmission>0,X=P&&!!y.anisotropyMap,J=pn&&!!y.clearcoatMap,ct=pn&&!!y.clearcoatNormalMap,pt=pn&&!!y.clearcoatRoughnessMap,Z=C&&!!y.iridescenceMap,Q=C&&!!y.iridescenceThicknessMap,dt=x&&!!y.sheenColorMap,N=x&&!!y.sheenRoughnessMap,W=!!y.specularMap,nt=!!y.specularColorMap,lt=!!y.specularIntensityMap,rt=F&&!!y.transmissionMap,At=F&&!!y.thicknessMap,U=!!y.gradientMap,ut=!!y.alphaMap,$=y.alphaTest>0,gt=!!y.alphaHash,vt=!!y.extensions,st=Mi;y.toneMapped&&(ot===null||ot.isXRRenderTarget===!0)&&(st=e.toneMapping);let wt={shaderID:ht,shaderType:y.type,shaderName:y.name,vertexShader:ue,fragmentShader:Wt,defines:y.defines,customVertexShaderID:tt,customFragmentShaderID:mt,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:u,batching:Rt,batchingColor:Rt&&I._colorsTexture!==null,instancing:It,instancingColor:It&&I.instanceColor!==null,instancingMorph:It&&I.morphTexture!==null,outputColorSpace:ot===null?e.outputColorSpace:ot.isXRRenderTarget===!0?ot.texture.colorSpace:Qt.workingColorSpace,alphaToCoverage:!!y.alphaToCoverage,map:we,matcap:zt,envMap:re,envMapMode:re&&K.mapping,envMapCubeUVHeight:it,aoMap:Vt,lightMap:Kt,bumpMap:be,normalMap:Ne,displacementMap:Ue,emissiveMap:Ve,normalMapObjectSpace:Ne&&y.normalMapType===RS,normalMapTangentSpace:Ne&&y.normalMapType===o0,packedNormalMap:Ne&&y.normalMapType===o0&&I3(y.normalMap.format),metalnessMap:Ce,roughnessMap:Oe,anisotropy:P,anisotropyMap:X,clearcoat:pn,clearcoatMap:J,clearcoatNormalMap:ct,clearcoatRoughnessMap:pt,dispersion:ie,iridescence:C,iridescenceMap:Z,iridescenceThicknessMap:Q,sheen:x,sheenColorMap:dt,sheenRoughnessMap:N,specularMap:W,specularColorMap:nt,specularIntensityMap:lt,transmission:F,transmissionMap:rt,thicknessMap:At,gradientMap:U,opaque:y.transparent===!1&&y.blending===Ka&&y.alphaToCoverage===!1,alphaMap:ut,alphaTest:$,alphaHash:gt,combine:y.combine,mapUv:we&&g(y.map.channel),aoMapUv:Vt&&g(y.aoMap.channel),lightMapUv:Kt&&g(y.lightMap.channel),bumpMapUv:be&&g(y.bumpMap.channel),normalMapUv:Ne&&g(y.normalMap.channel),displacementMapUv:Ue&&g(y.displacementMap.channel),emissiveMapUv:Ve&&g(y.emissiveMap.channel),metalnessMapUv:Ce&&g(y.metalnessMap.channel),roughnessMapUv:Oe&&g(y.roughnessMap.channel),anisotropyMapUv:X&&g(y.anisotropyMap.channel),clearcoatMapUv:J&&g(y.clearcoatMap.channel),clearcoatNormalMapUv:ct&&g(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:pt&&g(y.clearcoatRoughnessMap.channel),iridescenceMapUv:Z&&g(y.iridescenceMap.channel),iridescenceThicknessMapUv:Q&&g(y.iridescenceThicknessMap.channel),sheenColorMapUv:dt&&g(y.sheenColorMap.channel),sheenRoughnessMapUv:N&&g(y.sheenRoughnessMap.channel),specularMapUv:W&&g(y.specularMap.channel),specularColorMapUv:nt&&g(y.specularColorMap.channel),specularIntensityMapUv:lt&&g(y.specularIntensityMap.channel),transmissionMapUv:rt&&g(y.transmissionMap.channel),thicknessMapUv:At&&g(y.thicknessMap.channel),alphaMapUv:ut&&g(y.alphaMap.channel),vertexTangents:!!O.attributes.tangent&&(Ne||P),vertexNormals:!!O.attributes.normal,vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!O.attributes.color&&O.attributes.color.itemSize===4,pointsUvs:I.isPoints===!0&&!!O.attributes.uv&&(we||ut),fog:!!q,useFog:y.fog===!0,fogExp2:!!q&&q.isFogExp2,flatShading:y.wireframe===!1&&(y.flatShading===!0||O.attributes.normal===void 0&&Ne===!1&&(y.isMeshLambertMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isMeshPhysicalMaterial)),sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:p,reversedDepthBuffer:Nt,skinning:I.isSkinnedMesh===!0,hasPositionAttribute:O.attributes.position!==void 0,morphTargets:O.morphAttributes.position!==void 0,morphNormals:O.morphAttributes.normal!==void 0,morphColors:O.morphAttributes.color!==void 0,morphTargetsCount:_t,morphTextureStride:Jt,numDirLights:M.directional.length,numPointLights:M.point.length,numSpotLights:M.spot.length,numSpotLightMaps:M.spotLightMap.length,numRectAreaLights:M.rectArea.length,numHemiLights:M.hemi.length,numDirLightShadows:M.directionalShadowMap.length,numPointLightShadows:M.pointShadowMap.length,numSpotLightShadows:M.spotShadowMap.length,numSpotLightShadowsWithMaps:M.numSpotLightShadowsWithMaps,numLightProbes:M.numLightProbes,numLightProbeGrids:z.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:y.dithering,shadowMapEnabled:e.shadowMap.enabled&&R.length>0,shadowMapType:e.shadowMap.type,toneMapping:st,decodeVideoTexture:we&&y.map.isVideoTexture===!0&&Qt.getTransfer(y.map.colorSpace)===oe,decodeVideoTextureEmissive:Ve&&y.emissiveMap.isVideoTexture===!0&&Qt.getTransfer(y.emissiveMap.colorSpace)===oe,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===Wi,flipSided:y.side===An,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:vt&&y.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(vt&&y.extensions.multiDraw===!0||Rt)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return wt.vertexUv1s=l.has(1),wt.vertexUv2s=l.has(2),wt.vertexUv3s=l.has(3),l.clear(),wt}function m(y){let M=[];if(y.shaderID?M.push(y.shaderID):(M.push(y.customVertexShaderID),M.push(y.customFragmentShaderID)),y.defines!==void 0)for(let R in y.defines)M.push(R),M.push(y.defines[R]);return y.isRawShaderMaterial===!1&&(f(M,y),_(M,y),M.push(e.outputColorSpace)),M.push(y.customProgramCacheKey),M.join()}function f(y,M){y.push(M.precision),y.push(M.outputColorSpace),y.push(M.envMapMode),y.push(M.envMapCubeUVHeight),y.push(M.mapUv),y.push(M.alphaMapUv),y.push(M.lightMapUv),y.push(M.aoMapUv),y.push(M.bumpMapUv),y.push(M.normalMapUv),y.push(M.displacementMapUv),y.push(M.emissiveMapUv),y.push(M.metalnessMapUv),y.push(M.roughnessMapUv),y.push(M.anisotropyMapUv),y.push(M.clearcoatMapUv),y.push(M.clearcoatNormalMapUv),y.push(M.clearcoatRoughnessMapUv),y.push(M.iridescenceMapUv),y.push(M.iridescenceThicknessMapUv),y.push(M.sheenColorMapUv),y.push(M.sheenRoughnessMapUv),y.push(M.specularMapUv),y.push(M.specularColorMapUv),y.push(M.specularIntensityMapUv),y.push(M.transmissionMapUv),y.push(M.thicknessMapUv),y.push(M.combine),y.push(M.fogExp2),y.push(M.sizeAttenuation),y.push(M.morphTargetsCount),y.push(M.morphAttributeCount),y.push(M.numDirLights),y.push(M.numPointLights),y.push(M.numSpotLights),y.push(M.numSpotLightMaps),y.push(M.numHemiLights),y.push(M.numRectAreaLights),y.push(M.numDirLightShadows),y.push(M.numPointLightShadows),y.push(M.numSpotLightShadows),y.push(M.numSpotLightShadowsWithMaps),y.push(M.numLightProbes),y.push(M.shadowMapType),y.push(M.toneMapping),y.push(M.numClippingPlanes),y.push(M.numClipIntersection),y.push(M.depthPacking)}function _(y,M){r.disableAll(),M.instancing&&r.enable(0),M.instancingColor&&r.enable(1),M.instancingMorph&&r.enable(2),M.matcap&&r.enable(3),M.envMap&&r.enable(4),M.normalMapObjectSpace&&r.enable(5),M.normalMapTangentSpace&&r.enable(6),M.clearcoat&&r.enable(7),M.iridescence&&r.enable(8),M.alphaTest&&r.enable(9),M.vertexColors&&r.enable(10),M.vertexAlphas&&r.enable(11),M.vertexUv1s&&r.enable(12),M.vertexUv2s&&r.enable(13),M.vertexUv3s&&r.enable(14),M.vertexTangents&&r.enable(15),M.anisotropy&&r.enable(16),M.alphaHash&&r.enable(17),M.batching&&r.enable(18),M.dispersion&&r.enable(19),M.batchingColor&&r.enable(20),M.gradientMap&&r.enable(21),M.packedNormalMap&&r.enable(22),M.vertexNormals&&r.enable(23),y.push(r.mask),r.disableAll(),M.fog&&r.enable(0),M.useFog&&r.enable(1),M.flatShading&&r.enable(2),M.logarithmicDepthBuffer&&r.enable(3),M.reversedDepthBuffer&&r.enable(4),M.skinning&&r.enable(5),M.morphTargets&&r.enable(6),M.morphNormals&&r.enable(7),M.morphColors&&r.enable(8),M.premultipliedAlpha&&r.enable(9),M.shadowMapEnabled&&r.enable(10),M.doubleSided&&r.enable(11),M.flipSided&&r.enable(12),M.useDepthPacking&&r.enable(13),M.dithering&&r.enable(14),M.transmission&&r.enable(15),M.sheen&&r.enable(16),M.opaque&&r.enable(17),M.pointsUvs&&r.enable(18),M.decodeVideoTexture&&r.enable(19),M.decodeVideoTextureEmissive&&r.enable(20),M.alphaToCoverage&&r.enable(21),M.numLightProbeGrids>0&&r.enable(22),M.hasPositionAttribute&&r.enable(23),y.push(r.mask)}function b(y){let M=d[y.type],R;if(M){let D=Ji[M];R=HS.clone(D.uniforms)}else R=y.uniforms;return R}function v(y,M){let R=h.get(M);return R!==void 0?++R.usedTimes:(R=new U3(e,M,y,s),c.push(R),h.set(M,R)),R}function T(y){if(--y.usedTimes===0){let M=c.indexOf(y);c[M]=c[c.length-1],c.pop(),h.delete(y.cacheKey),y.destroy()}}function A(y){o.remove(y)}function w(){o.dispose()}return{getParameters:S,getProgramCacheKey:m,getUniforms:b,acquireProgram:v,releaseProgram:T,releaseShaderCache:A,programs:c,dispose:w}}function P3(){let e=new WeakMap;function t(r){return e.has(r)}function n(r){let o=e.get(r);return o===void 0&&(o={},e.set(r,o)),o}function i(r){e.delete(r)}function s(r,o,l){e.get(r)[o]=l}function a(){e=new WeakMap}return{has:t,get:n,remove:i,update:s,dispose:a}}function z3(e,t){return e.groupOrder!==t.groupOrder?e.groupOrder-t.groupOrder:e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.material.id!==t.material.id?e.material.id-t.material.id:e.materialVariant!==t.materialVariant?e.materialVariant-t.materialVariant:e.z!==t.z?e.z-t.z:e.id-t.id}function oM(e,t){return e.groupOrder!==t.groupOrder?e.groupOrder-t.groupOrder:e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.z!==t.z?t.z-e.z:e.id-t.id}function lM(){let e=[],t=0,n=[],i=[],s=[];function a(){t=0,n.length=0,i.length=0,s.length=0}function r(u){let d=0;return u.isInstancedMesh&&(d+=2),u.isSkinnedMesh&&(d+=1),d}function o(u,d,g,S,m,f){let _=e[t];return _===void 0?(_={id:u.id,object:u,geometry:d,material:g,materialVariant:r(u),groupOrder:S,renderOrder:u.renderOrder,z:m,group:f},e[t]=_):(_.id=u.id,_.object=u,_.geometry=d,_.material=g,_.materialVariant=r(u),_.groupOrder=S,_.renderOrder=u.renderOrder,_.z=m,_.group=f),t++,_}function l(u,d,g,S,m,f){let _=o(u,d,g,S,m,f);g.transmission>0?i.push(_):g.transparent===!0?s.push(_):n.push(_)}function c(u,d,g,S,m,f){let _=o(u,d,g,S,m,f);g.transmission>0?i.unshift(_):g.transparent===!0?s.unshift(_):n.unshift(_)}function h(u,d,g){n.length>1&&n.sort(u||z3),i.length>1&&i.sort(d||oM),s.length>1&&s.sort(d||oM),g&&(n.reverse(),i.reverse(),s.reverse())}function p(){for(let u=t,d=e.length;u<d;u++){let g=e[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:n,transmissive:i,transparent:s,init:a,push:l,unshift:c,finish:p,sort:h}}function B3(){let e=new WeakMap;function t(i,s){let a=e.get(i),r;return a===void 0?(r=new lM,e.set(i,[r])):s>=a.length?(r=new lM,a.push(r)):r=a[s],r}function n(){e=new WeakMap}return{get:t,dispose:n}}function F3(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"DirectionalLight":n={direction:new L,color:new $t};break;case"SpotLight":n={position:new L,direction:new L,color:new $t,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":n={position:new L,color:new $t,distance:0,decay:0};break;case"HemisphereLight":n={direction:new L,skyColor:new $t,groundColor:new $t};break;case"RectAreaLight":n={color:new $t,position:new L,halfWidth:new L,halfHeight:new L};break}return e[t.id]=n,n}}}function V3(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"DirectionalLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ut};break;case"SpotLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ut};break;case"PointLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ut,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[t.id]=n,n}}}var H3=0;function G3(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+(t.map?1:0)-(e.map?1:0)}function k3(e){let t=new F3,n=V3(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new L);let s=new L,a=new Le,r=new Le;function o(c){let h=0,p=0,u=0;for(let M=0;M<9;M++)i.probe[M].set(0,0,0);let d=0,g=0,S=0,m=0,f=0,_=0,b=0,v=0,T=0,A=0,w=0;c.sort(G3);for(let M=0,R=c.length;M<R;M++){let D=c[M],I=D.color,z=D.intensity,q=D.distance,O=null;if(D.shadow&&D.shadow.map&&(D.shadow.map.texture.format===ba?O=D.shadow.map.texture:O=D.shadow.map.depthTexture||D.shadow.map.texture),D.isAmbientLight)h+=I.r*z,p+=I.g*z,u+=I.b*z;else if(D.isLightProbe){for(let G=0;G<9;G++)i.probe[G].addScaledVector(D.sh.coefficients[G],z);w++}else if(D.isDirectionalLight){let G=t.get(D);if(G.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){let V=D.shadow,K=n.get(D);K.shadowIntensity=V.intensity,K.shadowBias=V.bias,K.shadowNormalBias=V.normalBias,K.shadowRadius=V.radius,K.shadowMapSize=V.mapSize,i.directionalShadow[d]=K,i.directionalShadowMap[d]=O,i.directionalShadowMatrix[d]=D.shadow.matrix,_++}i.directional[d]=G,d++}else if(D.isSpotLight){let G=t.get(D);G.position.setFromMatrixPosition(D.matrixWorld),G.color.copy(I).multiplyScalar(z),G.distance=q,G.coneCos=Math.cos(D.angle),G.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),G.decay=D.decay,i.spot[S]=G;let V=D.shadow;if(D.map&&(i.spotLightMap[T]=D.map,T++,V.updateMatrices(D),D.castShadow&&A++),i.spotLightMatrix[S]=V.matrix,D.castShadow){let K=n.get(D);K.shadowIntensity=V.intensity,K.shadowBias=V.bias,K.shadowNormalBias=V.normalBias,K.shadowRadius=V.radius,K.shadowMapSize=V.mapSize,i.spotShadow[S]=K,i.spotShadowMap[S]=O,v++}S++}else if(D.isRectAreaLight){let G=t.get(D);G.color.copy(I).multiplyScalar(z),G.halfWidth.set(D.width*.5,0,0),G.halfHeight.set(0,D.height*.5,0),i.rectArea[m]=G,m++}else if(D.isPointLight){let G=t.get(D);if(G.color.copy(D.color).multiplyScalar(D.intensity),G.distance=D.distance,G.decay=D.decay,D.castShadow){let V=D.shadow,K=n.get(D);K.shadowIntensity=V.intensity,K.shadowBias=V.bias,K.shadowNormalBias=V.normalBias,K.shadowRadius=V.radius,K.shadowMapSize=V.mapSize,K.shadowCameraNear=V.camera.near,K.shadowCameraFar=V.camera.far,i.pointShadow[g]=K,i.pointShadowMap[g]=O,i.pointShadowMatrix[g]=D.shadow.matrix,b++}i.point[g]=G,g++}else if(D.isHemisphereLight){let G=t.get(D);G.skyColor.copy(D.color).multiplyScalar(z),G.groundColor.copy(D.groundColor).multiplyScalar(z),i.hemi[f]=G,f++}}m>0&&(e.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=yt.LTC_FLOAT_1,i.rectAreaLTC2=yt.LTC_FLOAT_2):(i.rectAreaLTC1=yt.LTC_HALF_1,i.rectAreaLTC2=yt.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=p,i.ambient[2]=u;let y=i.hash;(y.directionalLength!==d||y.pointLength!==g||y.spotLength!==S||y.rectAreaLength!==m||y.hemiLength!==f||y.numDirectionalShadows!==_||y.numPointShadows!==b||y.numSpotShadows!==v||y.numSpotMaps!==T||y.numLightProbes!==w)&&(i.directional.length=d,i.spot.length=S,i.rectArea.length=m,i.point.length=g,i.hemi.length=f,i.directionalShadow.length=_,i.directionalShadowMap.length=_,i.pointShadow.length=b,i.pointShadowMap.length=b,i.spotShadow.length=v,i.spotShadowMap.length=v,i.directionalShadowMatrix.length=_,i.pointShadowMatrix.length=b,i.spotLightMatrix.length=v+T-A,i.spotLightMap.length=T,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=w,y.directionalLength=d,y.pointLength=g,y.spotLength=S,y.rectAreaLength=m,y.hemiLength=f,y.numDirectionalShadows=_,y.numPointShadows=b,y.numSpotShadows=v,y.numSpotMaps=T,y.numLightProbes=w,i.version=H3++)}function l(c,h){let p=0,u=0,d=0,g=0,S=0,m=h.matrixWorldInverse;for(let f=0,_=c.length;f<_;f++){let b=c[f];if(b.isDirectionalLight){let v=i.directional[p];v.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(m),p++}else if(b.isSpotLight){let v=i.spot[d];v.position.setFromMatrixPosition(b.matrixWorld),v.position.applyMatrix4(m),v.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(m),d++}else if(b.isRectAreaLight){let v=i.rectArea[g];v.position.setFromMatrixPosition(b.matrixWorld),v.position.applyMatrix4(m),r.identity(),a.copy(b.matrixWorld),a.premultiply(m),r.extractRotation(a),v.halfWidth.set(b.width*.5,0,0),v.halfHeight.set(0,b.height*.5,0),v.halfWidth.applyMatrix4(r),v.halfHeight.applyMatrix4(r),g++}else if(b.isPointLight){let v=i.point[u];v.position.setFromMatrixPosition(b.matrixWorld),v.position.applyMatrix4(m),u++}else if(b.isHemisphereLight){let v=i.hemi[S];v.direction.setFromMatrixPosition(b.matrixWorld),v.direction.transformDirection(m),S++}}}return{setup:o,setupView:l,state:i}}function cM(e){let t=new k3(e),n=[],i=[],s=[];function a(u){p.camera=u,n.length=0,i.length=0,s.length=0}function r(u){n.push(u)}function o(u){i.push(u)}function l(u){s.push(u)}function c(){t.setup(n)}function h(u){t.setupView(n,u)}let p={lightsArray:n,shadowsArray:i,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:p,setupLights:c,setupLightsView:h,pushLight:r,pushShadow:o,pushLightProbeGrid:l}}function X3(e){let t=new WeakMap;function n(s,a=0){let r=t.get(s),o;return r===void 0?(o=new cM(e),t.set(s,[o])):a>=r.length?(o=new cM(e),r.push(o)):o=r[a],o}function i(){t=new WeakMap}return{get:n,dispose:i}}var W3=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,q3=`uniform sampler2D shadow_pass;
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
}`,Y3=[new L(1,0,0),new L(-1,0,0),new L(0,1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1)],Z3=[new L(0,-1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1),new L(0,-1,0),new L(0,-1,0)],uM=new Le,mc=new L,x0=new L;function J3(e,t,n){let i=new Wl,s=new Ut,a=new Ut,r=new Ie,o=new af,l=new rf,c={},h=n.maxTextureSize,p={[Ms]:An,[An]:Ms,[Wi]:Wi},u=new jn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Ut},radius:{value:4}},vertexShader:W3,fragmentShader:q3}),d=u.clone();d.defines.HORIZONTAL_PASS=1;let g=new on;g.setAttribute("position",new Zn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let S=new Qe(g,u),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=sc;let f=this.type;this.render=function(A,w,y){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||A.length===0)return;this.type===rS&&(Lt("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=sc);let M=e.getRenderTarget(),R=e.getActiveCubeFace(),D=e.getActiveMipmapLevel(),I=e.state;I.setBlending(qi),I.buffers.depth.getReversed()===!0?I.buffers.color.setClear(0,0,0,0):I.buffers.color.setClear(1,1,1,1),I.buffers.depth.setTest(!0),I.setScissorTest(!1);let z=f!==this.type;z&&w.traverse(function(q){q.material&&(Array.isArray(q.material)?q.material.forEach(O=>O.needsUpdate=!0):q.material.needsUpdate=!0)});for(let q=0,O=A.length;q<O;q++){let G=A[q],V=G.shadow;if(V===void 0){Lt("WebGLShadowMap:",G,"has no shadow.");continue}if(V.autoUpdate===!1&&V.needsUpdate===!1)continue;s.copy(V.mapSize);let K=V.getFrameExtents();s.multiply(K),a.copy(V.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(a.x=Math.floor(h/K.x),s.x=a.x*K.x,V.mapSize.x=a.x),s.y>h&&(a.y=Math.floor(h/K.y),s.y=a.y*K.y,V.mapSize.y=a.y));let it=e.state.buffers.depth.getReversed();if(V.camera._reversedDepth=it,V.map===null||z===!0){if(V.map!==null&&(V.map.depthTexture!==null&&(V.map.depthTexture.dispose(),V.map.depthTexture=null),V.map.dispose()),this.type===vo){if(G.isPointLight){Lt("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}V.map=new Jn(s.x,s.y,{format:ba,type:Yi,minFilter:dn,magFilter:dn,generateMipmaps:!1}),V.map.texture.name=G.name+".shadowMap",V.map.depthTexture=new Es(s.x,s.y,Ti),V.map.depthTexture.name=G.name+".shadowMapDepth",V.map.depthTexture.format=Gi,V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=rn,V.map.depthTexture.magFilter=rn}else G.isPointLight?(V.map=new ud(s.x),V.map.depthTexture=new Zh(s.x,Ei)):(V.map=new Jn(s.x,s.y),V.map.depthTexture=new Es(s.x,s.y,Ei)),V.map.depthTexture.name=G.name+".shadowMap",V.map.depthTexture.format=Gi,this.type===sc?(V.map.depthTexture.compareFunction=it?rd:ad,V.map.depthTexture.minFilter=dn,V.map.depthTexture.magFilter=dn):(V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=rn,V.map.depthTexture.magFilter=rn);V.camera.updateProjectionMatrix()}let ht=V.map.isWebGLCubeRenderTarget?6:1;for(let ft=0;ft<ht;ft++){if(V.map.isWebGLCubeRenderTarget)e.setRenderTarget(V.map,ft),e.clear();else{ft===0&&(e.setRenderTarget(V.map),e.clear());let _t=V.getViewport(ft);r.set(a.x*_t.x,a.y*_t.y,a.x*_t.z,a.y*_t.w),I.viewport(r)}if(G.isPointLight){let _t=V.camera,Jt=V.matrix,ue=G.distance||_t.far;ue!==_t.far&&(_t.far=ue,_t.updateProjectionMatrix()),mc.setFromMatrixPosition(G.matrixWorld),_t.position.copy(mc),x0.copy(_t.position),x0.add(Y3[ft]),_t.up.copy(Z3[ft]),_t.lookAt(x0),_t.updateMatrixWorld(),Jt.makeTranslation(-mc.x,-mc.y,-mc.z),uM.multiplyMatrices(_t.projectionMatrix,_t.matrixWorldInverse),V._frustum.setFromProjectionMatrix(uM,_t.coordinateSystem,_t.reversedDepth)}else V.updateMatrices(G);i=V.getFrustum(),v(w,y,V.camera,G,this.type)}V.isPointLightShadow!==!0&&this.type===vo&&_(V,y),V.needsUpdate=!1}f=this.type,m.needsUpdate=!1,e.setRenderTarget(M,R,D)};function _(A,w){let y=t.update(S);u.defines.VSM_SAMPLES!==A.blurSamples&&(u.defines.VSM_SAMPLES=A.blurSamples,d.defines.VSM_SAMPLES=A.blurSamples,u.needsUpdate=!0,d.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new Jn(s.x,s.y,{format:ba,type:Yi})),u.uniforms.shadow_pass.value=A.map.depthTexture,u.uniforms.resolution.value=A.mapSize,u.uniforms.radius.value=A.radius,e.setRenderTarget(A.mapPass),e.clear(),e.renderBufferDirect(w,null,y,u,S,null),d.uniforms.shadow_pass.value=A.mapPass.texture,d.uniforms.resolution.value=A.mapSize,d.uniforms.radius.value=A.radius,e.setRenderTarget(A.map),e.clear(),e.renderBufferDirect(w,null,y,d,S,null)}function b(A,w,y,M){let R=null,D=y.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(D!==void 0)R=D;else if(R=y.isPointLight===!0?l:o,e.localClippingEnabled&&w.clipShadows===!0&&Array.isArray(w.clippingPlanes)&&w.clippingPlanes.length!==0||w.displacementMap&&w.displacementScale!==0||w.alphaMap&&w.alphaTest>0||w.map&&w.alphaTest>0||w.alphaToCoverage===!0){let I=R.uuid,z=w.uuid,q=c[I];q===void 0&&(q={},c[I]=q);let O=q[z];O===void 0&&(O=R.clone(),q[z]=O,w.addEventListener("dispose",T)),R=O}if(R.visible=w.visible,R.wireframe=w.wireframe,M===vo?R.side=w.shadowSide!==null?w.shadowSide:w.side:R.side=w.shadowSide!==null?w.shadowSide:p[w.side],R.alphaMap=w.alphaMap,R.alphaTest=w.alphaToCoverage===!0?.5:w.alphaTest,R.map=w.map,R.clipShadows=w.clipShadows,R.clippingPlanes=w.clippingPlanes,R.clipIntersection=w.clipIntersection,R.displacementMap=w.displacementMap,R.displacementScale=w.displacementScale,R.displacementBias=w.displacementBias,R.wireframeLinewidth=w.wireframeLinewidth,R.linewidth=w.linewidth,y.isPointLight===!0&&R.isMeshDistanceMaterial===!0){let I=e.properties.get(R);I.light=y}return R}function v(A,w,y,M,R){if(A.visible===!1)return;if(A.layers.test(w.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&R===vo)&&(!A.frustumCulled||i.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(y.matrixWorldInverse,A.matrixWorld);let z=t.update(A),q=A.material;if(Array.isArray(q)){let O=z.groups;for(let G=0,V=O.length;G<V;G++){let K=O[G],it=q[K.materialIndex];if(it&&it.visible){let ht=b(A,it,M,R);A.onBeforeShadow(e,A,w,y,z,ht,K),e.renderBufferDirect(y,null,z,ht,A,K),A.onAfterShadow(e,A,w,y,z,ht,K)}}}else if(q.visible){let O=b(A,q,M,R);A.onBeforeShadow(e,A,w,y,z,O,null),e.renderBufferDirect(y,null,z,O,A,null),A.onAfterShadow(e,A,w,y,z,O,null)}}let I=A.children;for(let z=0,q=I.length;z<q;z++)v(I[z],w,y,M,R)}function T(A){A.target.removeEventListener("dispose",T);for(let y in c){let M=c[y],R=A.target.uuid;R in M&&(M[R].dispose(),delete M[R])}}}function K3(e,t){function n(){let U=!1,ut=new Ie,$=null,gt=new Ie(0,0,0,0);return{setMask:function(vt){$!==vt&&!U&&(e.colorMask(vt,vt,vt,vt),$=vt)},setLocked:function(vt){U=vt},setClear:function(vt,st,wt,Et,Pe){Pe===!0&&(vt*=Et,st*=Et,wt*=Et),ut.set(vt,st,wt,Et),gt.equals(ut)===!1&&(e.clearColor(vt,st,wt,Et),gt.copy(ut))},reset:function(){U=!1,$=null,gt.set(-1,0,0,0)}}}function i(){let U=!1,ut=!1,$=null,gt=null,vt=null;return{setReversed:function(st){if(ut!==st){let wt=t.get("EXT_clip_control");st?wt.clipControlEXT(wt.LOWER_LEFT_EXT,wt.ZERO_TO_ONE_EXT):wt.clipControlEXT(wt.LOWER_LEFT_EXT,wt.NEGATIVE_ONE_TO_ONE_EXT),ut=st;let Et=vt;vt=null,this.setClear(Et)}},getReversed:function(){return ut},setTest:function(st){st?ot(e.DEPTH_TEST):Nt(e.DEPTH_TEST)},setMask:function(st){$!==st&&!U&&(e.depthMask(st),$=st)},setFunc:function(st){if(ut&&(st=FS[st]),gt!==st){switch(st){case Nh:e.depthFunc(e.NEVER);break;case Uh:e.depthFunc(e.ALWAYS);break;case Lh:e.depthFunc(e.LESS);break;case ja:e.depthFunc(e.LEQUAL);break;case Ih:e.depthFunc(e.EQUAL);break;case Oh:e.depthFunc(e.GEQUAL);break;case Ph:e.depthFunc(e.GREATER);break;case zh:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}gt=st}},setLocked:function(st){U=st},setClear:function(st){vt!==st&&(vt=st,ut&&(st=1-st),e.clearDepth(st))},reset:function(){U=!1,$=null,gt=null,vt=null,ut=!1}}}function s(){let U=!1,ut=null,$=null,gt=null,vt=null,st=null,wt=null,Et=null,Pe=null;return{setTest:function(_e){U||(_e?ot(e.STENCIL_TEST):Nt(e.STENCIL_TEST))},setMask:function(_e){ut!==_e&&!U&&(e.stencilMask(_e),ut=_e)},setFunc:function(_e,wi,Ci){($!==_e||gt!==wi||vt!==Ci)&&(e.stencilFunc(_e,wi,Ci),$=_e,gt=wi,vt=Ci)},setOp:function(_e,wi,Ci){(st!==_e||wt!==wi||Et!==Ci)&&(e.stencilOp(_e,wi,Ci),st=_e,wt=wi,Et=Ci)},setLocked:function(_e){U=_e},setClear:function(_e){Pe!==_e&&(e.clearStencil(_e),Pe=_e)},reset:function(){U=!1,ut=null,$=null,gt=null,vt=null,st=null,wt=null,Et=null,Pe=null}}}let a=new n,r=new i,o=new s,l=new WeakMap,c=new WeakMap,h={},p={},u={},d=new WeakMap,g=[],S=null,m=!1,f=null,_=null,b=null,v=null,T=null,A=null,w=null,y=new $t(0,0,0),M=0,R=!1,D=null,I=null,z=null,q=null,O=null,G=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),V=!1,K=0,it=e.getParameter(e.VERSION);it.indexOf("WebGL")!==-1?(K=parseFloat(/^WebGL (\d)/.exec(it)[1]),V=K>=1):it.indexOf("OpenGL ES")!==-1&&(K=parseFloat(/^OpenGL ES (\d)/.exec(it)[1]),V=K>=2);let ht=null,ft={},_t=e.getParameter(e.SCISSOR_BOX),Jt=e.getParameter(e.VIEWPORT),ue=new Ie().fromArray(_t),Wt=new Ie().fromArray(Jt);function tt(U,ut,$,gt){let vt=new Uint8Array(4),st=e.createTexture();e.bindTexture(U,st),e.texParameteri(U,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(U,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let wt=0;wt<$;wt++)U===e.TEXTURE_3D||U===e.TEXTURE_2D_ARRAY?e.texImage3D(ut,0,e.RGBA,1,1,gt,0,e.RGBA,e.UNSIGNED_BYTE,vt):e.texImage2D(ut+wt,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,vt);return st}let mt={};mt[e.TEXTURE_2D]=tt(e.TEXTURE_2D,e.TEXTURE_2D,1),mt[e.TEXTURE_CUBE_MAP]=tt(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),mt[e.TEXTURE_2D_ARRAY]=tt(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),mt[e.TEXTURE_3D]=tt(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),r.setClear(1),o.setClear(0),ot(e.DEPTH_TEST),r.setFunc(ja),be(!1),Ne(Hg),ot(e.CULL_FACE),Vt(qi);function ot(U){h[U]!==!0&&(e.enable(U),h[U]=!0)}function Nt(U){h[U]!==!1&&(e.disable(U),h[U]=!1)}function It(U,ut){return u[U]!==ut?(e.bindFramebuffer(U,ut),u[U]=ut,U===e.DRAW_FRAMEBUFFER&&(u[e.FRAMEBUFFER]=ut),U===e.FRAMEBUFFER&&(u[e.DRAW_FRAMEBUFFER]=ut),!0):!1}function Rt(U,ut){let $=g,gt=!1;if(U){$=d.get(ut),$===void 0&&($=[],d.set(ut,$));let vt=U.textures;if($.length!==vt.length||$[0]!==e.COLOR_ATTACHMENT0){for(let st=0,wt=vt.length;st<wt;st++)$[st]=e.COLOR_ATTACHMENT0+st;$.length=vt.length,gt=!0}}else $[0]!==e.BACK&&($[0]=e.BACK,gt=!0);gt&&e.drawBuffers($)}function we(U){return S!==U?(e.useProgram(U),S=U,!0):!1}let zt={[ca]:e.FUNC_ADD,[lS]:e.FUNC_SUBTRACT,[cS]:e.FUNC_REVERSE_SUBTRACT};zt[uS]=e.MIN,zt[hS]=e.MAX;let re={[fS]:e.ZERO,[dS]:e.ONE,[pS]:e.SRC_COLOR,[Rh]:e.SRC_ALPHA,[xS]:e.SRC_ALPHA_SATURATE,[vS]:e.DST_COLOR,[gS]:e.DST_ALPHA,[mS]:e.ONE_MINUS_SRC_COLOR,[Dh]:e.ONE_MINUS_SRC_ALPHA,[yS]:e.ONE_MINUS_DST_COLOR,[_S]:e.ONE_MINUS_DST_ALPHA,[bS]:e.CONSTANT_COLOR,[SS]:e.ONE_MINUS_CONSTANT_COLOR,[MS]:e.CONSTANT_ALPHA,[ES]:e.ONE_MINUS_CONSTANT_ALPHA};function Vt(U,ut,$,gt,vt,st,wt,Et,Pe,_e){if(U===qi){m===!0&&(Nt(e.BLEND),m=!1);return}if(m===!1&&(ot(e.BLEND),m=!0),U!==oS){if(U!==f||_e!==R){if((_!==ca||T!==ca)&&(e.blendEquation(e.FUNC_ADD),_=ca,T=ca),_e)switch(U){case Ka:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Gg:e.blendFunc(e.ONE,e.ONE);break;case kg:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case Xg:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:Ot("WebGLState: Invalid blending: ",U);break}else switch(U){case Ka:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Gg:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case kg:Ot("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Xg:Ot("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ot("WebGLState: Invalid blending: ",U);break}b=null,v=null,A=null,w=null,y.set(0,0,0),M=0,f=U,R=_e}return}vt=vt||ut,st=st||$,wt=wt||gt,(ut!==_||vt!==T)&&(e.blendEquationSeparate(zt[ut],zt[vt]),_=ut,T=vt),($!==b||gt!==v||st!==A||wt!==w)&&(e.blendFuncSeparate(re[$],re[gt],re[st],re[wt]),b=$,v=gt,A=st,w=wt),(Et.equals(y)===!1||Pe!==M)&&(e.blendColor(Et.r,Et.g,Et.b,Pe),y.copy(Et),M=Pe),f=U,R=!1}function Kt(U,ut){U.side===Wi?Nt(e.CULL_FACE):ot(e.CULL_FACE);let $=U.side===An;ut&&($=!$),be($),U.blending===Ka&&U.transparent===!1?Vt(qi):Vt(U.blending,U.blendEquation,U.blendSrc,U.blendDst,U.blendEquationAlpha,U.blendSrcAlpha,U.blendDstAlpha,U.blendColor,U.blendAlpha,U.premultipliedAlpha),r.setFunc(U.depthFunc),r.setTest(U.depthTest),r.setMask(U.depthWrite),a.setMask(U.colorWrite);let gt=U.stencilWrite;o.setTest(gt),gt&&(o.setMask(U.stencilWriteMask),o.setFunc(U.stencilFunc,U.stencilRef,U.stencilFuncMask),o.setOp(U.stencilFail,U.stencilZFail,U.stencilZPass)),Ve(U.polygonOffset,U.polygonOffsetFactor,U.polygonOffsetUnits),U.alphaToCoverage===!0?ot(e.SAMPLE_ALPHA_TO_COVERAGE):Nt(e.SAMPLE_ALPHA_TO_COVERAGE)}function be(U){D!==U&&(U?e.frontFace(e.CW):e.frontFace(e.CCW),D=U)}function Ne(U){U!==sS?(ot(e.CULL_FACE),U!==I&&(U===Hg?e.cullFace(e.BACK):U===aS?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))):Nt(e.CULL_FACE),I=U}function Ue(U){U!==z&&(V&&e.lineWidth(U),z=U)}function Ve(U,ut,$){U?(ot(e.POLYGON_OFFSET_FILL),(q!==ut||O!==$)&&(q=ut,O=$,r.getReversed()&&(ut=-ut),e.polygonOffset(ut,$))):Nt(e.POLYGON_OFFSET_FILL)}function Ce(U){U?ot(e.SCISSOR_TEST):Nt(e.SCISSOR_TEST)}function Oe(U){U===void 0&&(U=e.TEXTURE0+G-1),ht!==U&&(e.activeTexture(U),ht=U)}function P(U,ut,$){$===void 0&&(ht===null?$=e.TEXTURE0+G-1:$=ht);let gt=ft[$];gt===void 0&&(gt={type:void 0,texture:void 0},ft[$]=gt),(gt.type!==U||gt.texture!==ut)&&(ht!==$&&(e.activeTexture($),ht=$),e.bindTexture(U,ut||mt[U]),gt.type=U,gt.texture=ut)}function pn(){let U=ft[ht];U!==void 0&&U.type!==void 0&&(e.bindTexture(U.type,null),U.type=void 0,U.texture=void 0)}function ie(){try{e.compressedTexImage2D(...arguments)}catch(U){Ot("WebGLState:",U)}}function C(){try{e.compressedTexImage3D(...arguments)}catch(U){Ot("WebGLState:",U)}}function x(){try{e.texSubImage2D(...arguments)}catch(U){Ot("WebGLState:",U)}}function F(){try{e.texSubImage3D(...arguments)}catch(U){Ot("WebGLState:",U)}}function X(){try{e.compressedTexSubImage2D(...arguments)}catch(U){Ot("WebGLState:",U)}}function J(){try{e.compressedTexSubImage3D(...arguments)}catch(U){Ot("WebGLState:",U)}}function ct(){try{e.texStorage2D(...arguments)}catch(U){Ot("WebGLState:",U)}}function pt(){try{e.texStorage3D(...arguments)}catch(U){Ot("WebGLState:",U)}}function Z(){try{e.texImage2D(...arguments)}catch(U){Ot("WebGLState:",U)}}function Q(){try{e.texImage3D(...arguments)}catch(U){Ot("WebGLState:",U)}}function dt(U){return p[U]!==void 0?p[U]:e.getParameter(U)}function N(U,ut){p[U]!==ut&&(e.pixelStorei(U,ut),p[U]=ut)}function W(U){ue.equals(U)===!1&&(e.scissor(U.x,U.y,U.z,U.w),ue.copy(U))}function nt(U){Wt.equals(U)===!1&&(e.viewport(U.x,U.y,U.z,U.w),Wt.copy(U))}function lt(U,ut){let $=c.get(ut);$===void 0&&($=new WeakMap,c.set(ut,$));let gt=$.get(U);gt===void 0&&(gt=e.getUniformBlockIndex(ut,U.name),$.set(U,gt))}function rt(U,ut){let gt=c.get(ut).get(U);l.get(ut)!==gt&&(e.uniformBlockBinding(ut,gt,U.__bindingPointIndex),l.set(ut,gt))}function At(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),r.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),h={},p={},ht=null,ft={},u={},d=new WeakMap,g=[],S=null,m=!1,f=null,_=null,b=null,v=null,T=null,A=null,w=null,y=new $t(0,0,0),M=0,R=!1,D=null,I=null,z=null,q=null,O=null,ue.set(0,0,e.canvas.width,e.canvas.height),Wt.set(0,0,e.canvas.width,e.canvas.height),a.reset(),r.reset(),o.reset()}return{buffers:{color:a,depth:r,stencil:o},enable:ot,disable:Nt,bindFramebuffer:It,drawBuffers:Rt,useProgram:we,setBlending:Vt,setMaterial:Kt,setFlipSided:be,setCullFace:Ne,setLineWidth:Ue,setPolygonOffset:Ve,setScissorTest:Ce,activeTexture:Oe,bindTexture:P,unbindTexture:pn,compressedTexImage2D:ie,compressedTexImage3D:C,texImage2D:Z,texImage3D:Q,pixelStorei:N,getParameter:dt,updateUBOMapping:lt,uniformBlockBinding:rt,texStorage2D:ct,texStorage3D:pt,texSubImage2D:x,texSubImage3D:F,compressedTexSubImage2D:X,compressedTexSubImage3D:J,scissor:W,viewport:nt,reset:At}}function j3(e,t,n,i,s,a,r){let o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Ut,h=new WeakMap,p=new Set,u,d=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function S(C,x){return g?new OffscreenCanvas(C,x):Bl("canvas")}function m(C,x,F){let X=1,J=ie(C);if((J.width>F||J.height>F)&&(X=F/Math.max(J.width,J.height)),X<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){let ct=Math.floor(X*J.width),pt=Math.floor(X*J.height);u===void 0&&(u=S(ct,pt));let Z=x?S(ct,pt):u;return Z.width=ct,Z.height=pt,Z.getContext("2d").drawImage(C,0,0,ct,pt),Lt("WebGLRenderer: Texture has been resized from ("+J.width+"x"+J.height+") to ("+ct+"x"+pt+")."),Z}else return"data"in C&&Lt("WebGLRenderer: Image in DataTexture is too big ("+J.width+"x"+J.height+")."),C;return C}function f(C){return C.generateMipmaps}function _(C){e.generateMipmap(C)}function b(C){return C.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:C.isWebGL3DRenderTarget?e.TEXTURE_3D:C.isWebGLArrayRenderTarget||C.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function v(C,x,F,X,J,ct=!1){if(C!==null){if(e[C]!==void 0)return e[C];Lt("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let pt;X&&(pt=t.get("EXT_texture_norm16"),pt||Lt("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Z=x;if(x===e.RED&&(F===e.FLOAT&&(Z=e.R32F),F===e.HALF_FLOAT&&(Z=e.R16F),F===e.UNSIGNED_BYTE&&(Z=e.R8),F===e.UNSIGNED_SHORT&&pt&&(Z=pt.R16_EXT),F===e.SHORT&&pt&&(Z=pt.R16_SNORM_EXT)),x===e.RED_INTEGER&&(F===e.UNSIGNED_BYTE&&(Z=e.R8UI),F===e.UNSIGNED_SHORT&&(Z=e.R16UI),F===e.UNSIGNED_INT&&(Z=e.R32UI),F===e.BYTE&&(Z=e.R8I),F===e.SHORT&&(Z=e.R16I),F===e.INT&&(Z=e.R32I)),x===e.RG&&(F===e.FLOAT&&(Z=e.RG32F),F===e.HALF_FLOAT&&(Z=e.RG16F),F===e.UNSIGNED_BYTE&&(Z=e.RG8),F===e.UNSIGNED_SHORT&&pt&&(Z=pt.RG16_EXT),F===e.SHORT&&pt&&(Z=pt.RG16_SNORM_EXT)),x===e.RG_INTEGER&&(F===e.UNSIGNED_BYTE&&(Z=e.RG8UI),F===e.UNSIGNED_SHORT&&(Z=e.RG16UI),F===e.UNSIGNED_INT&&(Z=e.RG32UI),F===e.BYTE&&(Z=e.RG8I),F===e.SHORT&&(Z=e.RG16I),F===e.INT&&(Z=e.RG32I)),x===e.RGB_INTEGER&&(F===e.UNSIGNED_BYTE&&(Z=e.RGB8UI),F===e.UNSIGNED_SHORT&&(Z=e.RGB16UI),F===e.UNSIGNED_INT&&(Z=e.RGB32UI),F===e.BYTE&&(Z=e.RGB8I),F===e.SHORT&&(Z=e.RGB16I),F===e.INT&&(Z=e.RGB32I)),x===e.RGBA_INTEGER&&(F===e.UNSIGNED_BYTE&&(Z=e.RGBA8UI),F===e.UNSIGNED_SHORT&&(Z=e.RGBA16UI),F===e.UNSIGNED_INT&&(Z=e.RGBA32UI),F===e.BYTE&&(Z=e.RGBA8I),F===e.SHORT&&(Z=e.RGBA16I),F===e.INT&&(Z=e.RGBA32I)),x===e.RGB&&(F===e.UNSIGNED_SHORT&&pt&&(Z=pt.RGB16_EXT),F===e.SHORT&&pt&&(Z=pt.RGB16_SNORM_EXT),F===e.UNSIGNED_INT_5_9_9_9_REV&&(Z=e.RGB9_E5),F===e.UNSIGNED_INT_10F_11F_11F_REV&&(Z=e.R11F_G11F_B10F)),x===e.RGBA){let Q=ct?Pl:Qt.getTransfer(J);F===e.FLOAT&&(Z=e.RGBA32F),F===e.HALF_FLOAT&&(Z=e.RGBA16F),F===e.UNSIGNED_BYTE&&(Z=Q===oe?e.SRGB8_ALPHA8:e.RGBA8),F===e.UNSIGNED_SHORT&&pt&&(Z=pt.RGBA16_EXT),F===e.SHORT&&pt&&(Z=pt.RGBA16_SNORM_EXT),F===e.UNSIGNED_SHORT_4_4_4_4&&(Z=e.RGBA4),F===e.UNSIGNED_SHORT_5_5_5_1&&(Z=e.RGB5_A1)}return(Z===e.R16F||Z===e.R32F||Z===e.RG16F||Z===e.RG32F||Z===e.RGBA16F||Z===e.RGBA32F)&&t.get("EXT_color_buffer_float"),Z}function T(C,x){let F;return C?x===null||x===Ei||x===xo?F=e.DEPTH24_STENCIL8:x===Ti?F=e.DEPTH32F_STENCIL8:x===yo&&(F=e.DEPTH24_STENCIL8,Lt("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):x===null||x===Ei||x===xo?F=e.DEPTH_COMPONENT24:x===Ti?F=e.DEPTH_COMPONENT32F:x===yo&&(F=e.DEPTH_COMPONENT16),F}function A(C,x){return f(C)===!0||C.isFramebufferTexture&&C.minFilter!==rn&&C.minFilter!==dn?Math.log2(Math.max(x.width,x.height))+1:C.mipmaps!==void 0&&C.mipmaps.length>0?C.mipmaps.length:C.isCompressedTexture&&Array.isArray(C.image)?x.mipmaps.length:1}function w(C){let x=C.target;x.removeEventListener("dispose",w),M(x),x.isVideoTexture&&h.delete(x),x.isHTMLTexture&&p.delete(x)}function y(C){let x=C.target;x.removeEventListener("dispose",y),D(x)}function M(C){let x=i.get(C);if(x.__webglInit===void 0)return;let F=C.source,X=d.get(F);if(X){let J=X[x.__cacheKey];J.usedTimes--,J.usedTimes===0&&R(C),Object.keys(X).length===0&&d.delete(F)}i.remove(C)}function R(C){let x=i.get(C);e.deleteTexture(x.__webglTexture);let F=C.source,X=d.get(F);delete X[x.__cacheKey],r.memory.textures--}function D(C){let x=i.get(C);if(C.depthTexture&&(C.depthTexture.dispose(),i.remove(C.depthTexture)),C.isWebGLCubeRenderTarget)for(let X=0;X<6;X++){if(Array.isArray(x.__webglFramebuffer[X]))for(let J=0;J<x.__webglFramebuffer[X].length;J++)e.deleteFramebuffer(x.__webglFramebuffer[X][J]);else e.deleteFramebuffer(x.__webglFramebuffer[X]);x.__webglDepthbuffer&&e.deleteRenderbuffer(x.__webglDepthbuffer[X])}else{if(Array.isArray(x.__webglFramebuffer))for(let X=0;X<x.__webglFramebuffer.length;X++)e.deleteFramebuffer(x.__webglFramebuffer[X]);else e.deleteFramebuffer(x.__webglFramebuffer);if(x.__webglDepthbuffer&&e.deleteRenderbuffer(x.__webglDepthbuffer),x.__webglMultisampledFramebuffer&&e.deleteFramebuffer(x.__webglMultisampledFramebuffer),x.__webglColorRenderbuffer)for(let X=0;X<x.__webglColorRenderbuffer.length;X++)x.__webglColorRenderbuffer[X]&&e.deleteRenderbuffer(x.__webglColorRenderbuffer[X]);x.__webglDepthRenderbuffer&&e.deleteRenderbuffer(x.__webglDepthRenderbuffer)}let F=C.textures;for(let X=0,J=F.length;X<J;X++){let ct=i.get(F[X]);ct.__webglTexture&&(e.deleteTexture(ct.__webglTexture),r.memory.textures--),i.remove(F[X])}i.remove(C)}let I=0;function z(){I=0}function q(){return I}function O(C){I=C}function G(){let C=I;return C>=s.maxTextures&&Lt("WebGLTextures: Trying to use "+C+" texture units while this GPU supports only "+s.maxTextures),I+=1,C}function V(C){let x=[];return x.push(C.wrapS),x.push(C.wrapT),x.push(C.wrapR||0),x.push(C.magFilter),x.push(C.minFilter),x.push(C.anisotropy),x.push(C.internalFormat),x.push(C.format),x.push(C.type),x.push(C.generateMipmaps),x.push(C.premultiplyAlpha),x.push(C.flipY),x.push(C.unpackAlignment),x.push(C.colorSpace),x.join()}function K(C,x){let F=i.get(C);if(C.isVideoTexture&&P(C),C.isRenderTargetTexture===!1&&C.isExternalTexture!==!0&&C.version>0&&F.__version!==C.version){let X=C.image;if(X===null)Lt("WebGLRenderer: Texture marked for update but no image data found.");else if(X.complete===!1)Lt("WebGLRenderer: Texture marked for update but image is incomplete");else{Nt(F,C,x);return}}else C.isExternalTexture&&(F.__webglTexture=C.sourceTexture?C.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,F.__webglTexture,e.TEXTURE0+x)}function it(C,x){let F=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&F.__version!==C.version){Nt(F,C,x);return}else C.isExternalTexture&&(F.__webglTexture=C.sourceTexture?C.sourceTexture:null);n.bindTexture(e.TEXTURE_2D_ARRAY,F.__webglTexture,e.TEXTURE0+x)}function ht(C,x){let F=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&F.__version!==C.version){Nt(F,C,x);return}n.bindTexture(e.TEXTURE_3D,F.__webglTexture,e.TEXTURE0+x)}function ft(C,x){let F=i.get(C);if(C.isCubeDepthTexture!==!0&&C.version>0&&F.__version!==C.version){It(F,C,x);return}n.bindTexture(e.TEXTURE_CUBE_MAP,F.__webglTexture,e.TEXTURE0+x)}let _t={[Bh]:e.REPEAT,[Vi]:e.CLAMP_TO_EDGE,[Fh]:e.MIRRORED_REPEAT},Jt={[rn]:e.NEAREST,[wS]:e.NEAREST_MIPMAP_NEAREST,[rc]:e.NEAREST_MIPMAP_LINEAR,[dn]:e.LINEAR,[Sf]:e.LINEAR_MIPMAP_NEAREST,[ya]:e.LINEAR_MIPMAP_LINEAR},ue={[DS]:e.NEVER,[OS]:e.ALWAYS,[NS]:e.LESS,[ad]:e.LEQUAL,[US]:e.EQUAL,[rd]:e.GEQUAL,[LS]:e.GREATER,[IS]:e.NOTEQUAL};function Wt(C,x){if(x.type===Ti&&t.has("OES_texture_float_linear")===!1&&(x.magFilter===dn||x.magFilter===Sf||x.magFilter===rc||x.magFilter===ya||x.minFilter===dn||x.minFilter===Sf||x.minFilter===rc||x.minFilter===ya)&&Lt("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),e.texParameteri(C,e.TEXTURE_WRAP_S,_t[x.wrapS]),e.texParameteri(C,e.TEXTURE_WRAP_T,_t[x.wrapT]),(C===e.TEXTURE_3D||C===e.TEXTURE_2D_ARRAY)&&e.texParameteri(C,e.TEXTURE_WRAP_R,_t[x.wrapR]),e.texParameteri(C,e.TEXTURE_MAG_FILTER,Jt[x.magFilter]),e.texParameteri(C,e.TEXTURE_MIN_FILTER,Jt[x.minFilter]),x.compareFunction&&(e.texParameteri(C,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(C,e.TEXTURE_COMPARE_FUNC,ue[x.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(x.magFilter===rn||x.minFilter!==rc&&x.minFilter!==ya||x.type===Ti&&t.has("OES_texture_float_linear")===!1)return;if(x.anisotropy>1||i.get(x).__currentAnisotropy){let F=t.get("EXT_texture_filter_anisotropic");e.texParameterf(C,F.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,s.getMaxAnisotropy())),i.get(x).__currentAnisotropy=x.anisotropy}}}function tt(C,x){let F=!1;C.__webglInit===void 0&&(C.__webglInit=!0,x.addEventListener("dispose",w));let X=x.source,J=d.get(X);J===void 0&&(J={},d.set(X,J));let ct=V(x);if(ct!==C.__cacheKey){J[ct]===void 0&&(J[ct]={texture:e.createTexture(),usedTimes:0},r.memory.textures++,F=!0),J[ct].usedTimes++;let pt=J[C.__cacheKey];pt!==void 0&&(J[C.__cacheKey].usedTimes--,pt.usedTimes===0&&R(x)),C.__cacheKey=ct,C.__webglTexture=J[ct].texture}return F}function mt(C,x,F){return Math.floor(Math.floor(C/F)/x)}function ot(C,x,F,X){let ct=C.updateRanges;if(ct.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,x.width,x.height,F,X,x.data);else{ct.sort((N,W)=>N.start-W.start);let pt=0;for(let N=1;N<ct.length;N++){let W=ct[pt],nt=ct[N],lt=W.start+W.count,rt=mt(nt.start,x.width,4),At=mt(W.start,x.width,4);nt.start<=lt+1&&rt===At&&mt(nt.start+nt.count-1,x.width,4)===rt?W.count=Math.max(W.count,nt.start+nt.count-W.start):(++pt,ct[pt]=nt)}ct.length=pt+1;let Z=n.getParameter(e.UNPACK_ROW_LENGTH),Q=n.getParameter(e.UNPACK_SKIP_PIXELS),dt=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,x.width);for(let N=0,W=ct.length;N<W;N++){let nt=ct[N],lt=Math.floor(nt.start/4),rt=Math.ceil(nt.count/4),At=lt%x.width,U=Math.floor(lt/x.width),ut=rt,$=1;n.pixelStorei(e.UNPACK_SKIP_PIXELS,At),n.pixelStorei(e.UNPACK_SKIP_ROWS,U),n.texSubImage2D(e.TEXTURE_2D,0,At,U,ut,$,F,X,x.data)}C.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,Z),n.pixelStorei(e.UNPACK_SKIP_PIXELS,Q),n.pixelStorei(e.UNPACK_SKIP_ROWS,dt)}}function Nt(C,x,F){let X=e.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(X=e.TEXTURE_2D_ARRAY),x.isData3DTexture&&(X=e.TEXTURE_3D);let J=tt(C,x),ct=x.source;n.bindTexture(X,C.__webglTexture,e.TEXTURE0+F);let pt=i.get(ct);if(ct.version!==pt.__version||J===!0){if(n.activeTexture(e.TEXTURE0+F),(typeof ImageBitmap<"u"&&x.image instanceof ImageBitmap)===!1){let $=Qt.getPrimaries(Qt.workingColorSpace),gt=x.colorSpace===Ts?null:Qt.getPrimaries(x.colorSpace),vt=x.colorSpace===Ts||$===gt?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,x.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,vt)}n.pixelStorei(e.UNPACK_ALIGNMENT,x.unpackAlignment);let Q=m(x.image,!1,s.maxTextureSize);Q=pn(x,Q);let dt=a.convert(x.format,x.colorSpace),N=a.convert(x.type),W=v(x.internalFormat,dt,N,x.normalized,x.colorSpace,x.isVideoTexture);Wt(X,x);let nt,lt=x.mipmaps,rt=x.isVideoTexture!==!0,At=pt.__version===void 0||J===!0,U=ct.dataReady,ut=A(x,Q);if(x.isDepthTexture)W=T(x.format===xa,x.type),At&&(rt?n.texStorage2D(e.TEXTURE_2D,1,W,Q.width,Q.height):n.texImage2D(e.TEXTURE_2D,0,W,Q.width,Q.height,0,dt,N,null));else if(x.isDataTexture)if(lt.length>0){rt&&At&&n.texStorage2D(e.TEXTURE_2D,ut,W,lt[0].width,lt[0].height);for(let $=0,gt=lt.length;$<gt;$++)nt=lt[$],rt?U&&n.texSubImage2D(e.TEXTURE_2D,$,0,0,nt.width,nt.height,dt,N,nt.data):n.texImage2D(e.TEXTURE_2D,$,W,nt.width,nt.height,0,dt,N,nt.data);x.generateMipmaps=!1}else rt?(At&&n.texStorage2D(e.TEXTURE_2D,ut,W,Q.width,Q.height),U&&ot(x,Q,dt,N)):n.texImage2D(e.TEXTURE_2D,0,W,Q.width,Q.height,0,dt,N,Q.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){rt&&At&&n.texStorage3D(e.TEXTURE_2D_ARRAY,ut,W,lt[0].width,lt[0].height,Q.depth);for(let $=0,gt=lt.length;$<gt;$++)if(nt=lt[$],x.format!==mi)if(dt!==null)if(rt){if(U)if(x.layerUpdates.size>0){let vt=p0(nt.width,nt.height,x.format,x.type);for(let st of x.layerUpdates){let wt=nt.data.subarray(st*vt/nt.data.BYTES_PER_ELEMENT,(st+1)*vt/nt.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,$,0,0,st,nt.width,nt.height,1,dt,wt)}x.clearLayerUpdates()}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,$,0,0,0,nt.width,nt.height,Q.depth,dt,nt.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,$,W,nt.width,nt.height,Q.depth,0,nt.data,0,0);else Lt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else rt?U&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,$,0,0,0,nt.width,nt.height,Q.depth,dt,N,nt.data):n.texImage3D(e.TEXTURE_2D_ARRAY,$,W,nt.width,nt.height,Q.depth,0,dt,N,nt.data)}else{rt&&At&&n.texStorage2D(e.TEXTURE_2D,ut,W,lt[0].width,lt[0].height);for(let $=0,gt=lt.length;$<gt;$++)nt=lt[$],x.format!==mi?dt!==null?rt?U&&n.compressedTexSubImage2D(e.TEXTURE_2D,$,0,0,nt.width,nt.height,dt,nt.data):n.compressedTexImage2D(e.TEXTURE_2D,$,W,nt.width,nt.height,0,nt.data):Lt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):rt?U&&n.texSubImage2D(e.TEXTURE_2D,$,0,0,nt.width,nt.height,dt,N,nt.data):n.texImage2D(e.TEXTURE_2D,$,W,nt.width,nt.height,0,dt,N,nt.data)}else if(x.isDataArrayTexture)if(rt){if(At&&n.texStorage3D(e.TEXTURE_2D_ARRAY,ut,W,Q.width,Q.height,Q.depth),U)if(x.layerUpdates.size>0){let $=p0(Q.width,Q.height,x.format,x.type);for(let gt of x.layerUpdates){let vt=Q.data.subarray(gt*$/Q.data.BYTES_PER_ELEMENT,(gt+1)*$/Q.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,gt,Q.width,Q.height,1,dt,N,vt)}x.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,Q.width,Q.height,Q.depth,dt,N,Q.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,W,Q.width,Q.height,Q.depth,0,dt,N,Q.data);else if(x.isData3DTexture)rt?(At&&n.texStorage3D(e.TEXTURE_3D,ut,W,Q.width,Q.height,Q.depth),U&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,Q.width,Q.height,Q.depth,dt,N,Q.data)):n.texImage3D(e.TEXTURE_3D,0,W,Q.width,Q.height,Q.depth,0,dt,N,Q.data);else if(x.isFramebufferTexture){if(At)if(rt)n.texStorage2D(e.TEXTURE_2D,ut,W,Q.width,Q.height);else{let $=Q.width,gt=Q.height;for(let vt=0;vt<ut;vt++)n.texImage2D(e.TEXTURE_2D,vt,W,$,gt,0,dt,N,null),$>>=1,gt>>=1}}else if(x.isHTMLTexture){if("texElementImage2D"in e){let $=e.canvas;if($.hasAttribute("layoutsubtree")||$.setAttribute("layoutsubtree","true"),Q.parentNode!==$){$.appendChild(Q),p.add(x),$.onpaint=gt=>{let vt=gt.changedElements;for(let st of p)vt.includes(st.image)&&(st.needsUpdate=!0)},$.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,Q);else{let vt=e.RGBA,st=e.RGBA,wt=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,vt,st,wt,Q)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(lt.length>0){if(rt&&At){let $=ie(lt[0]);n.texStorage2D(e.TEXTURE_2D,ut,W,$.width,$.height)}for(let $=0,gt=lt.length;$<gt;$++)nt=lt[$],rt?U&&n.texSubImage2D(e.TEXTURE_2D,$,0,0,dt,N,nt):n.texImage2D(e.TEXTURE_2D,$,W,dt,N,nt);x.generateMipmaps=!1}else if(rt){if(At){let $=ie(Q);n.texStorage2D(e.TEXTURE_2D,ut,W,$.width,$.height)}U&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,dt,N,Q)}else n.texImage2D(e.TEXTURE_2D,0,W,dt,N,Q);f(x)&&_(X),pt.__version=ct.version,x.onUpdate&&x.onUpdate(x)}C.__version=x.version}function It(C,x,F){if(x.image.length!==6)return;let X=tt(C,x),J=x.source;n.bindTexture(e.TEXTURE_CUBE_MAP,C.__webglTexture,e.TEXTURE0+F);let ct=i.get(J);if(J.version!==ct.__version||X===!0){n.activeTexture(e.TEXTURE0+F);let pt=Qt.getPrimaries(Qt.workingColorSpace),Z=x.colorSpace===Ts?null:Qt.getPrimaries(x.colorSpace),Q=x.colorSpace===Ts||pt===Z?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,x.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,x.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,Q);let dt=x.isCompressedTexture||x.image[0].isCompressedTexture,N=x.image[0]&&x.image[0].isDataTexture,W=[];for(let st=0;st<6;st++)!dt&&!N?W[st]=m(x.image[st],!0,s.maxCubemapSize):W[st]=N?x.image[st].image:x.image[st],W[st]=pn(x,W[st]);let nt=W[0],lt=a.convert(x.format,x.colorSpace),rt=a.convert(x.type),At=v(x.internalFormat,lt,rt,x.normalized,x.colorSpace),U=x.isVideoTexture!==!0,ut=ct.__version===void 0||X===!0,$=J.dataReady,gt=A(x,nt);Wt(e.TEXTURE_CUBE_MAP,x);let vt;if(dt){U&&ut&&n.texStorage2D(e.TEXTURE_CUBE_MAP,gt,At,nt.width,nt.height);for(let st=0;st<6;st++){vt=W[st].mipmaps;for(let wt=0;wt<vt.length;wt++){let Et=vt[wt];x.format!==mi?lt!==null?U?$&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,wt,0,0,Et.width,Et.height,lt,Et.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,wt,At,Et.width,Et.height,0,Et.data):Lt("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):U?$&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,wt,0,0,Et.width,Et.height,lt,rt,Et.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,wt,At,Et.width,Et.height,0,lt,rt,Et.data)}}}else{if(vt=x.mipmaps,U&&ut){vt.length>0&&gt++;let st=ie(W[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,gt,At,st.width,st.height)}for(let st=0;st<6;st++)if(N){U?$&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,0,0,0,W[st].width,W[st].height,lt,rt,W[st].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,0,At,W[st].width,W[st].height,0,lt,rt,W[st].data);for(let wt=0;wt<vt.length;wt++){let Pe=vt[wt].image[st].image;U?$&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,wt+1,0,0,Pe.width,Pe.height,lt,rt,Pe.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,wt+1,At,Pe.width,Pe.height,0,lt,rt,Pe.data)}}else{U?$&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,0,0,0,lt,rt,W[st]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,0,At,lt,rt,W[st]);for(let wt=0;wt<vt.length;wt++){let Et=vt[wt];U?$&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,wt+1,0,0,lt,rt,Et.image[st]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+st,wt+1,At,lt,rt,Et.image[st])}}}f(x)&&_(e.TEXTURE_CUBE_MAP),ct.__version=J.version,x.onUpdate&&x.onUpdate(x)}C.__version=x.version}function Rt(C,x,F,X,J,ct){let pt=a.convert(F.format,F.colorSpace),Z=a.convert(F.type),Q=v(F.internalFormat,pt,Z,F.normalized,F.colorSpace),dt=i.get(x),N=i.get(F);if(N.__renderTarget=x,!dt.__hasExternalTextures){let W=Math.max(1,x.width>>ct),nt=Math.max(1,x.height>>ct);J===e.TEXTURE_3D||J===e.TEXTURE_2D_ARRAY?n.texImage3D(J,ct,Q,W,nt,x.depth,0,pt,Z,null):n.texImage2D(J,ct,Q,W,nt,0,pt,Z,null)}n.bindFramebuffer(e.FRAMEBUFFER,C),Oe(x)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,X,J,N.__webglTexture,0,Ce(x)):(J===e.TEXTURE_2D||J>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&J<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,X,J,N.__webglTexture,ct),n.bindFramebuffer(e.FRAMEBUFFER,null)}function we(C,x,F){if(e.bindRenderbuffer(e.RENDERBUFFER,C),x.depthBuffer){let X=x.depthTexture,J=X&&X.isDepthTexture?X.type:null,ct=T(x.stencilBuffer,J),pt=x.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;Oe(x)?o.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Ce(x),ct,x.width,x.height):F?e.renderbufferStorageMultisample(e.RENDERBUFFER,Ce(x),ct,x.width,x.height):e.renderbufferStorage(e.RENDERBUFFER,ct,x.width,x.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,pt,e.RENDERBUFFER,C)}else{let X=x.textures;for(let J=0;J<X.length;J++){let ct=X[J],pt=a.convert(ct.format,ct.colorSpace),Z=a.convert(ct.type),Q=v(ct.internalFormat,pt,Z,ct.normalized,ct.colorSpace);Oe(x)?o.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Ce(x),Q,x.width,x.height):F?e.renderbufferStorageMultisample(e.RENDERBUFFER,Ce(x),Q,x.width,x.height):e.renderbufferStorage(e.RENDERBUFFER,Q,x.width,x.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function zt(C,x,F){let X=x.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,C),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let J=i.get(x.depthTexture);if(J.__renderTarget=x,(!J.__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),X){if(J.__webglInit===void 0&&(J.__webglInit=!0,x.depthTexture.addEventListener("dispose",w)),J.__webglTexture===void 0){J.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,J.__webglTexture),Wt(e.TEXTURE_CUBE_MAP,x.depthTexture);let dt=a.convert(x.depthTexture.format),N=a.convert(x.depthTexture.type),W;x.depthTexture.format===Gi?W=e.DEPTH_COMPONENT24:x.depthTexture.format===xa&&(W=e.DEPTH24_STENCIL8);for(let nt=0;nt<6;nt++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+nt,0,W,x.width,x.height,0,dt,N,null)}}else K(x.depthTexture,0);let ct=J.__webglTexture,pt=Ce(x),Z=X?e.TEXTURE_CUBE_MAP_POSITIVE_X+F:e.TEXTURE_2D,Q=x.depthTexture.format===xa?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(x.depthTexture.format===Gi)Oe(x)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,Q,Z,ct,0,pt):e.framebufferTexture2D(e.FRAMEBUFFER,Q,Z,ct,0);else if(x.depthTexture.format===xa)Oe(x)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,Q,Z,ct,0,pt):e.framebufferTexture2D(e.FRAMEBUFFER,Q,Z,ct,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function re(C){let x=i.get(C),F=C.isWebGLCubeRenderTarget===!0;if(x.__boundDepthTexture!==C.depthTexture){let X=C.depthTexture;if(x.__depthDisposeCallback&&x.__depthDisposeCallback(),X){let J=()=>{delete x.__boundDepthTexture,delete x.__depthDisposeCallback,X.removeEventListener("dispose",J)};X.addEventListener("dispose",J),x.__depthDisposeCallback=J}x.__boundDepthTexture=X}if(C.depthTexture&&!x.__autoAllocateDepthBuffer)if(F)for(let X=0;X<6;X++)zt(x.__webglFramebuffer[X],C,X);else{let X=C.texture.mipmaps;X&&X.length>0?zt(x.__webglFramebuffer[0],C,0):zt(x.__webglFramebuffer,C,0)}else if(F){x.__webglDepthbuffer=[];for(let X=0;X<6;X++)if(n.bindFramebuffer(e.FRAMEBUFFER,x.__webglFramebuffer[X]),x.__webglDepthbuffer[X]===void 0)x.__webglDepthbuffer[X]=e.createRenderbuffer(),we(x.__webglDepthbuffer[X],C,!1);else{let J=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ct=x.__webglDepthbuffer[X];e.bindRenderbuffer(e.RENDERBUFFER,ct),e.framebufferRenderbuffer(e.FRAMEBUFFER,J,e.RENDERBUFFER,ct)}}else{let X=C.texture.mipmaps;if(X&&X.length>0?n.bindFramebuffer(e.FRAMEBUFFER,x.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer===void 0)x.__webglDepthbuffer=e.createRenderbuffer(),we(x.__webglDepthbuffer,C,!1);else{let J=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ct=x.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,ct),e.framebufferRenderbuffer(e.FRAMEBUFFER,J,e.RENDERBUFFER,ct)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function Vt(C,x,F){let X=i.get(C);x!==void 0&&Rt(X.__webglFramebuffer,C,C.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),F!==void 0&&re(C)}function Kt(C){let x=C.texture,F=i.get(C),X=i.get(x);C.addEventListener("dispose",y);let J=C.textures,ct=C.isWebGLCubeRenderTarget===!0,pt=J.length>1;if(pt||(X.__webglTexture===void 0&&(X.__webglTexture=e.createTexture()),X.__version=x.version,r.memory.textures++),ct){F.__webglFramebuffer=[];for(let Z=0;Z<6;Z++)if(x.mipmaps&&x.mipmaps.length>0){F.__webglFramebuffer[Z]=[];for(let Q=0;Q<x.mipmaps.length;Q++)F.__webglFramebuffer[Z][Q]=e.createFramebuffer()}else F.__webglFramebuffer[Z]=e.createFramebuffer()}else{if(x.mipmaps&&x.mipmaps.length>0){F.__webglFramebuffer=[];for(let Z=0;Z<x.mipmaps.length;Z++)F.__webglFramebuffer[Z]=e.createFramebuffer()}else F.__webglFramebuffer=e.createFramebuffer();if(pt)for(let Z=0,Q=J.length;Z<Q;Z++){let dt=i.get(J[Z]);dt.__webglTexture===void 0&&(dt.__webglTexture=e.createTexture(),r.memory.textures++)}if(C.samples>0&&Oe(C)===!1){F.__webglMultisampledFramebuffer=e.createFramebuffer(),F.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,F.__webglMultisampledFramebuffer);for(let Z=0;Z<J.length;Z++){let Q=J[Z];F.__webglColorRenderbuffer[Z]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,F.__webglColorRenderbuffer[Z]);let dt=a.convert(Q.format,Q.colorSpace),N=a.convert(Q.type),W=v(Q.internalFormat,dt,N,Q.normalized,Q.colorSpace,C.isXRRenderTarget===!0),nt=Ce(C);e.renderbufferStorageMultisample(e.RENDERBUFFER,nt,W,C.width,C.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+Z,e.RENDERBUFFER,F.__webglColorRenderbuffer[Z])}e.bindRenderbuffer(e.RENDERBUFFER,null),C.depthBuffer&&(F.__webglDepthRenderbuffer=e.createRenderbuffer(),we(F.__webglDepthRenderbuffer,C,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(ct){n.bindTexture(e.TEXTURE_CUBE_MAP,X.__webglTexture),Wt(e.TEXTURE_CUBE_MAP,x);for(let Z=0;Z<6;Z++)if(x.mipmaps&&x.mipmaps.length>0)for(let Q=0;Q<x.mipmaps.length;Q++)Rt(F.__webglFramebuffer[Z][Q],C,x,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,Q);else Rt(F.__webglFramebuffer[Z],C,x,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0);f(x)&&_(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(pt){for(let Z=0,Q=J.length;Z<Q;Z++){let dt=J[Z],N=i.get(dt),W=e.TEXTURE_2D;(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(W=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(W,N.__webglTexture),Wt(W,dt),Rt(F.__webglFramebuffer,C,dt,e.COLOR_ATTACHMENT0+Z,W,0),f(dt)&&_(W)}n.unbindTexture()}else{let Z=e.TEXTURE_2D;if((C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(Z=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(Z,X.__webglTexture),Wt(Z,x),x.mipmaps&&x.mipmaps.length>0)for(let Q=0;Q<x.mipmaps.length;Q++)Rt(F.__webglFramebuffer[Q],C,x,e.COLOR_ATTACHMENT0,Z,Q);else Rt(F.__webglFramebuffer,C,x,e.COLOR_ATTACHMENT0,Z,0);f(x)&&_(Z),n.unbindTexture()}C.depthBuffer&&re(C)}function be(C){let x=C.textures;for(let F=0,X=x.length;F<X;F++){let J=x[F];if(f(J)){let ct=b(C),pt=i.get(J).__webglTexture;n.bindTexture(ct,pt),_(ct),n.unbindTexture()}}}let Ne=[],Ue=[];function Ve(C){if(C.samples>0){if(Oe(C)===!1){let x=C.textures,F=C.width,X=C.height,J=e.COLOR_BUFFER_BIT,ct=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,pt=i.get(C),Z=x.length>1;if(Z)for(let dt=0;dt<x.length;dt++)n.bindFramebuffer(e.FRAMEBUFFER,pt.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+dt,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,pt.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+dt,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,pt.__webglMultisampledFramebuffer);let Q=C.texture.mipmaps;Q&&Q.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,pt.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,pt.__webglFramebuffer);for(let dt=0;dt<x.length;dt++){if(C.resolveDepthBuffer&&(C.depthBuffer&&(J|=e.DEPTH_BUFFER_BIT),C.stencilBuffer&&C.resolveStencilBuffer&&(J|=e.STENCIL_BUFFER_BIT)),Z){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,pt.__webglColorRenderbuffer[dt]);let N=i.get(x[dt]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,N,0)}e.blitFramebuffer(0,0,F,X,0,0,F,X,J,e.NEAREST),l===!0&&(Ne.length=0,Ue.length=0,Ne.push(e.COLOR_ATTACHMENT0+dt),C.depthBuffer&&C.resolveDepthBuffer===!1&&(Ne.push(ct),Ue.push(ct),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,Ue)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,Ne))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),Z)for(let dt=0;dt<x.length;dt++){n.bindFramebuffer(e.FRAMEBUFFER,pt.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+dt,e.RENDERBUFFER,pt.__webglColorRenderbuffer[dt]);let N=i.get(x[dt]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,pt.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+dt,e.TEXTURE_2D,N,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,pt.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.resolveDepthBuffer===!1&&l){let x=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[x])}}}function Ce(C){return Math.min(s.maxSamples,C.samples)}function Oe(C){let x=i.get(C);return C.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function P(C){let x=r.render.frame;h.get(C)!==x&&(h.set(C,x),C.update())}function pn(C,x){let F=C.colorSpace,X=C.format,J=C.type;return C.isCompressedTexture===!0||C.isVideoTexture===!0||F!==Ol&&F!==Ts&&(Qt.getTransfer(F)===oe?(X!==mi||J!==$n)&&Lt("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ot("WebGLTextures: Unsupported texture color space:",F)),x}function ie(C){return typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement?(c.width=C.naturalWidth||C.width,c.height=C.naturalHeight||C.height):typeof VideoFrame<"u"&&C instanceof VideoFrame?(c.width=C.displayWidth,c.height=C.displayHeight):(c.width=C.width,c.height=C.height),c}this.allocateTextureUnit=G,this.resetTextureUnits=z,this.getTextureUnits=q,this.setTextureUnits=O,this.setTexture2D=K,this.setTexture2DArray=it,this.setTexture3D=ht,this.setTextureCube=ft,this.rebindTextures=Vt,this.setupRenderTarget=Kt,this.updateRenderTargetMipmap=be,this.updateMultisampleRenderTarget=Ve,this.setupDepthRenderbuffer=re,this.setupFrameBufferTexture=Rt,this.useMultisampledRTT=Oe,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function Q3(e,t){function n(i,s=Ts){let a,r=Qt.getTransfer(s);if(i===$n)return e.UNSIGNED_BYTE;if(i===Ef)return e.UNSIGNED_SHORT_4_4_4_4;if(i===Tf)return e.UNSIGNED_SHORT_5_5_5_1;if(i===n0)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===i0)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===t0)return e.BYTE;if(i===e0)return e.SHORT;if(i===yo)return e.UNSIGNED_SHORT;if(i===Mf)return e.INT;if(i===Ei)return e.UNSIGNED_INT;if(i===Ti)return e.FLOAT;if(i===Yi)return e.HALF_FLOAT;if(i===s0)return e.ALPHA;if(i===a0)return e.RGB;if(i===mi)return e.RGBA;if(i===Gi)return e.DEPTH_COMPONENT;if(i===xa)return e.DEPTH_STENCIL;if(i===r0)return e.RED;if(i===Af)return e.RED_INTEGER;if(i===ba)return e.RG;if(i===wf)return e.RG_INTEGER;if(i===Cf)return e.RGBA_INTEGER;if(i===oc||i===lc||i===cc||i===uc)if(r===oe)if(a=t.get("WEBGL_compressed_texture_s3tc_srgb"),a!==null){if(i===oc)return a.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===lc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===cc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===uc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(a=t.get("WEBGL_compressed_texture_s3tc"),a!==null){if(i===oc)return a.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===lc)return a.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===cc)return a.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===uc)return a.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Rf||i===Df||i===Nf||i===Uf)if(a=t.get("WEBGL_compressed_texture_pvrtc"),a!==null){if(i===Rf)return a.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Df)return a.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Nf)return a.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Uf)return a.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Lf||i===If||i===Of||i===Pf||i===zf||i===hc||i===Bf)if(a=t.get("WEBGL_compressed_texture_etc"),a!==null){if(i===Lf||i===If)return r===oe?a.COMPRESSED_SRGB8_ETC2:a.COMPRESSED_RGB8_ETC2;if(i===Of)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:a.COMPRESSED_RGBA8_ETC2_EAC;if(i===Pf)return a.COMPRESSED_R11_EAC;if(i===zf)return a.COMPRESSED_SIGNED_R11_EAC;if(i===hc)return a.COMPRESSED_RG11_EAC;if(i===Bf)return a.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Ff||i===Vf||i===Hf||i===Gf||i===kf||i===Xf||i===Wf||i===qf||i===Yf||i===Zf||i===Jf||i===Kf||i===jf||i===Qf)if(a=t.get("WEBGL_compressed_texture_astc"),a!==null){if(i===Ff)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:a.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Vf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:a.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Hf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:a.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Gf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:a.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===kf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:a.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Xf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:a.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Wf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:a.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===qf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:a.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Yf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:a.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Zf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:a.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Jf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:a.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Kf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:a.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===jf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:a.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Qf)return r===oe?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:a.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===$f||i===td||i===ed)if(a=t.get("EXT_texture_compression_bptc"),a!==null){if(i===$f)return r===oe?a.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:a.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===td)return a.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===ed)return a.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===nd||i===id||i===fc||i===sd)if(a=t.get("EXT_texture_compression_rgtc"),a!==null){if(i===nd)return a.COMPRESSED_RED_RGTC1_EXT;if(i===id)return a.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===fc)return a.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===sd)return a.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===xo?e.UNSIGNED_INT_24_8:e[i]!==void 0?e[i]:null}return{convert:n}}var $3=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,t2=`
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

}`,C0=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,n){if(this.texture===null){let i=new Yl(t.texture);(t.depthNear!==n.depthNear||t.depthFar!==n.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=i}}getMesh(t){if(this.texture!==null&&this.mesh===null){let n=t.cameras[0].viewport,i=new jn({vertexShader:$3,fragmentShader:t2,uniforms:{depthColor:{value:this.texture},depthWidth:{value:n.z},depthHeight:{value:n.w}}});this.mesh=new Qe(new pa(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},R0=class extends ki{constructor(t,n){super();let i=this,s=null,a=1,r=null,o="local-floor",l=1,c=null,h=null,p=null,u=null,d=null,g=null,S=typeof XRWebGLBinding<"u",m=new C0,f={},_=n.getContextAttributes(),b=null,v=null,T=[],A=[],w=new Ut,y=null,M=new yn;M.viewport=new Ie;let R=new yn;R.viewport=new Ie;let D=[M,R],I=new vf,z=null,q=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(tt){let mt=T[tt];return mt===void 0&&(mt=new ho,T[tt]=mt),mt.getTargetRaySpace()},this.getControllerGrip=function(tt){let mt=T[tt];return mt===void 0&&(mt=new ho,T[tt]=mt),mt.getGripSpace()},this.getHand=function(tt){let mt=T[tt];return mt===void 0&&(mt=new ho,T[tt]=mt),mt.getHandSpace()};function O(tt){let mt=A.indexOf(tt.inputSource);if(mt===-1)return;let ot=T[mt];ot!==void 0&&(ot.update(tt.inputSource,tt.frame,c||r),ot.dispatchEvent({type:tt.type,data:tt.inputSource}))}function G(){s.removeEventListener("select",O),s.removeEventListener("selectstart",O),s.removeEventListener("selectend",O),s.removeEventListener("squeeze",O),s.removeEventListener("squeezestart",O),s.removeEventListener("squeezeend",O),s.removeEventListener("end",G),s.removeEventListener("inputsourceschange",V);for(let tt=0;tt<T.length;tt++){let mt=A[tt];mt!==null&&(A[tt]=null,T[tt].disconnect(mt))}z=null,q=null,m.reset();for(let tt in f)delete f[tt];t.setRenderTarget(b),d=null,u=null,p=null,s=null,v=null,Wt.stop(),i.isPresenting=!1,t.setPixelRatio(y),t.setSize(w.width,w.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(tt){a=tt,i.isPresenting===!0&&Lt("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(tt){o=tt,i.isPresenting===!0&&Lt("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||r},this.setReferenceSpace=function(tt){c=tt},this.getBaseLayer=function(){return u!==null?u:d},this.getBinding=function(){return p===null&&S&&(p=new XRWebGLBinding(s,n)),p},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(tt){if(s=tt,s!==null){if(b=t.getRenderTarget(),s.addEventListener("select",O),s.addEventListener("selectstart",O),s.addEventListener("selectend",O),s.addEventListener("squeeze",O),s.addEventListener("squeezestart",O),s.addEventListener("squeezeend",O),s.addEventListener("end",G),s.addEventListener("inputsourceschange",V),_.xrCompatible!==!0&&await n.makeXRCompatible(),y=t.getPixelRatio(),t.getSize(w),S&&"createProjectionLayer"in XRWebGLBinding.prototype){let ot=null,Nt=null,It=null;_.depth&&(It=_.stencil?n.DEPTH24_STENCIL8:n.DEPTH_COMPONENT24,ot=_.stencil?xa:Gi,Nt=_.stencil?xo:Ei);let Rt={colorFormat:n.RGBA8,depthFormat:It,scaleFactor:a};p=this.getBinding(),u=p.createProjectionLayer(Rt),s.updateRenderState({layers:[u]}),t.setPixelRatio(1),t.setSize(u.textureWidth,u.textureHeight,!1),v=new Jn(u.textureWidth,u.textureHeight,{format:mi,type:$n,depthTexture:new Es(u.textureWidth,u.textureHeight,Nt,void 0,void 0,void 0,void 0,void 0,void 0,ot),stencilBuffer:_.stencil,colorSpace:t.outputColorSpace,samples:_.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{let ot={antialias:_.antialias,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:a};d=new XRWebGLLayer(s,n,ot),s.updateRenderState({baseLayer:d}),t.setPixelRatio(1),t.setSize(d.framebufferWidth,d.framebufferHeight,!1),v=new Jn(d.framebufferWidth,d.framebufferHeight,{format:mi,type:$n,colorSpace:t.outputColorSpace,stencilBuffer:_.stencil,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}v.isXRRenderTarget=!0,this.setFoveation(l),c=null,r=await s.requestReferenceSpace(o),Wt.setContext(s),Wt.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function V(tt){for(let mt=0;mt<tt.removed.length;mt++){let ot=tt.removed[mt],Nt=A.indexOf(ot);Nt>=0&&(A[Nt]=null,T[Nt].disconnect(ot))}for(let mt=0;mt<tt.added.length;mt++){let ot=tt.added[mt],Nt=A.indexOf(ot);if(Nt===-1){for(let Rt=0;Rt<T.length;Rt++)if(Rt>=A.length){A.push(ot),Nt=Rt;break}else if(A[Rt]===null){A[Rt]=ot,Nt=Rt;break}if(Nt===-1)break}let It=T[Nt];It&&It.connect(ot)}}let K=new L,it=new L;function ht(tt,mt,ot){K.setFromMatrixPosition(mt.matrixWorld),it.setFromMatrixPosition(ot.matrixWorld);let Nt=K.distanceTo(it),It=mt.projectionMatrix.elements,Rt=ot.projectionMatrix.elements,we=It[14]/(It[10]-1),zt=It[14]/(It[10]+1),re=(It[9]+1)/It[5],Vt=(It[9]-1)/It[5],Kt=(It[8]-1)/It[0],be=(Rt[8]+1)/Rt[0],Ne=we*Kt,Ue=we*be,Ve=Nt/(-Kt+be),Ce=Ve*-Kt;if(mt.matrixWorld.decompose(tt.position,tt.quaternion,tt.scale),tt.translateX(Ce),tt.translateZ(Ve),tt.matrixWorld.compose(tt.position,tt.quaternion,tt.scale),tt.matrixWorldInverse.copy(tt.matrixWorld).invert(),It[10]===-1)tt.projectionMatrix.copy(mt.projectionMatrix),tt.projectionMatrixInverse.copy(mt.projectionMatrixInverse);else{let Oe=we+Ve,P=zt+Ve,pn=Ne-Ce,ie=Ue+(Nt-Ce),C=re*zt/P*Oe,x=Vt*zt/P*Oe;tt.projectionMatrix.makePerspective(pn,ie,C,x,Oe,P),tt.projectionMatrixInverse.copy(tt.projectionMatrix).invert()}}function ft(tt,mt){mt===null?tt.matrixWorld.copy(tt.matrix):tt.matrixWorld.multiplyMatrices(mt.matrixWorld,tt.matrix),tt.matrixWorldInverse.copy(tt.matrixWorld).invert()}this.updateCamera=function(tt){if(s===null)return;let mt=tt.near,ot=tt.far;m.texture!==null&&(m.depthNear>0&&(mt=m.depthNear),m.depthFar>0&&(ot=m.depthFar)),I.near=R.near=M.near=mt,I.far=R.far=M.far=ot,(z!==I.near||q!==I.far)&&(s.updateRenderState({depthNear:I.near,depthFar:I.far}),z=I.near,q=I.far),I.layers.mask=tt.layers.mask|6,M.layers.mask=I.layers.mask&-5,R.layers.mask=I.layers.mask&-3;let Nt=tt.parent,It=I.cameras;ft(I,Nt);for(let Rt=0;Rt<It.length;Rt++)ft(It[Rt],Nt);It.length===2?ht(I,M,R):I.projectionMatrix.copy(M.projectionMatrix),_t(tt,I,Nt)};function _t(tt,mt,ot){ot===null?tt.matrix.copy(mt.matrixWorld):(tt.matrix.copy(ot.matrixWorld),tt.matrix.invert(),tt.matrix.multiply(mt.matrixWorld)),tt.matrix.decompose(tt.position,tt.quaternion,tt.scale),tt.updateMatrixWorld(!0),tt.projectionMatrix.copy(mt.projectionMatrix),tt.projectionMatrixInverse.copy(mt.projectionMatrixInverse),tt.isPerspectiveCamera&&(tt.fov=Hh*2*Math.atan(1/tt.projectionMatrix.elements[5]),tt.zoom=1)}this.getCamera=function(){return I},this.getFoveation=function(){if(!(u===null&&d===null))return l},this.setFoveation=function(tt){l=tt,u!==null&&(u.fixedFoveation=tt),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=tt)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(I)},this.getCameraTexture=function(tt){return f[tt]};let Jt=null;function ue(tt,mt){if(h=mt.getViewerPose(c||r),g=mt,h!==null){let ot=h.views;d!==null&&(t.setRenderTargetFramebuffer(v,d.framebuffer),t.setRenderTarget(v));let Nt=!1;ot.length!==I.cameras.length&&(I.cameras.length=0,Nt=!0);for(let zt=0;zt<ot.length;zt++){let re=ot[zt],Vt=null;if(d!==null)Vt=d.getViewport(re);else{let be=p.getViewSubImage(u,re);Vt=be.viewport,zt===0&&(t.setRenderTargetTextures(v,be.colorTexture,be.depthStencilTexture),t.setRenderTarget(v))}let Kt=D[zt];Kt===void 0&&(Kt=new yn,Kt.layers.enable(zt),Kt.viewport=new Ie,D[zt]=Kt),Kt.matrix.fromArray(re.transform.matrix),Kt.matrix.decompose(Kt.position,Kt.quaternion,Kt.scale),Kt.projectionMatrix.fromArray(re.projectionMatrix),Kt.projectionMatrixInverse.copy(Kt.projectionMatrix).invert(),Kt.viewport.set(Vt.x,Vt.y,Vt.width,Vt.height),zt===0&&(I.matrix.copy(Kt.matrix),I.matrix.decompose(I.position,I.quaternion,I.scale)),Nt===!0&&I.cameras.push(Kt)}let It=s.enabledFeatures;if(It&&It.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&S){p=i.getBinding();let zt=p.getDepthInformation(ot[0]);zt&&zt.isValid&&zt.texture&&m.init(zt,s.renderState)}if(It&&It.includes("camera-access")&&S){t.state.unbindTexture(),p=i.getBinding();for(let zt=0;zt<ot.length;zt++){let re=ot[zt].camera;if(re){let Vt=f[re];Vt||(Vt=new Yl,f[re]=Vt);let Kt=p.getCameraImage(re);Vt.sourceTexture=Kt}}}}for(let ot=0;ot<T.length;ot++){let Nt=A[ot],It=T[ot];Nt!==null&&It!==void 0&&It.update(Nt,mt,c||r)}Jt&&Jt(tt,mt),mt.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:mt}),g=null}let Wt=new hM;Wt.setAnimationLoop(ue),this.setAnimationLoop=function(tt){Jt=tt},this.dispose=function(){}}},e2=new Le,_M=new Bt;_M.set(-1,0,0,0,1,0,0,0,1);function n2(e,t){function n(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function i(m,f){f.color.getRGB(m.fogColor.value,h0(e)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function s(m,f,_,b,v){f.isNodeMaterial?f.uniformsNeedUpdate=!1:f.isMeshBasicMaterial?a(m,f):f.isMeshLambertMaterial?(a(m,f),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)):f.isMeshToonMaterial?(a(m,f),p(m,f)):f.isMeshPhongMaterial?(a(m,f),h(m,f),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)):f.isMeshStandardMaterial?(a(m,f),u(m,f),f.isMeshPhysicalMaterial&&d(m,f,v)):f.isMeshMatcapMaterial?(a(m,f),g(m,f)):f.isMeshDepthMaterial?a(m,f):f.isMeshDistanceMaterial?(a(m,f),S(m,f)):f.isMeshNormalMaterial?a(m,f):f.isLineBasicMaterial?(r(m,f),f.isLineDashedMaterial&&o(m,f)):f.isPointsMaterial?l(m,f,_,b):f.isSpriteMaterial?c(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function a(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,n(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,n(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,n(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===An&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,n(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===An&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,n(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,n(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,n(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);let _=t.get(f),b=_.envMap,v=_.envMapRotation;b&&(m.envMap.value=b,m.envMapRotation.value.setFromMatrix4(e2.makeRotationFromEuler(v)).transpose(),b.isCubeTexture&&b.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(_M),m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap&&(m.lightMap.value=f.lightMap,m.lightMapIntensity.value=f.lightMapIntensity,n(f.lightMap,m.lightMapTransform)),f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,n(f.aoMap,m.aoMapTransform))}function r(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,n(f.map,m.mapTransform))}function o(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function l(m,f,_,b){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*_,m.scale.value=b*.5,f.map&&(m.map.value=f.map,n(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,n(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function c(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,n(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,n(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function h(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function p(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function u(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,n(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,n(f.roughnessMap,m.roughnessMapTransform)),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function d(m,f,_){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,n(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,n(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,n(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,n(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,n(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===An&&m.clearcoatNormalScale.value.negate())),f.dispersion>0&&(m.dispersion.value=f.dispersion),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,n(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,n(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=_.texture,m.transmissionSamplerSize.value.set(_.width,_.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,n(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,n(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,n(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,n(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,n(f.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,f){f.matcap&&(m.matcap.value=f.matcap)}function S(m,f){let _=t.get(f).light;m.referencePosition.value.setFromMatrixPosition(_.matrixWorld),m.nearDistance.value=_.shadow.camera.near,m.farDistance.value=_.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:s}}function i2(e,t,n,i){let s={},a={},r=[],o=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function l(v,T){let A=T.program;i.uniformBlockBinding(v,A)}function c(v,T){let A=s[v.id];A===void 0&&(m(v),A=h(v),s[v.id]=A,v.addEventListener("dispose",_));let w=T.program;i.updateUBOMapping(v,w);let y=t.render.frame;a[v.id]!==y&&(u(v),a[v.id]=y)}function h(v){let T=p();v.__bindingPointIndex=T;let A=e.createBuffer(),w=v.__size,y=v.usage;return e.bindBuffer(e.UNIFORM_BUFFER,A),e.bufferData(e.UNIFORM_BUFFER,w,y),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,T,A),A}function p(){for(let v=0;v<o;v++)if(r.indexOf(v)===-1)return r.push(v),v;return Ot("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(v){let T=s[v.id],A=v.uniforms,w=v.__cache;e.bindBuffer(e.UNIFORM_BUFFER,T);for(let y=0,M=A.length;y<M;y++){let R=A[y];if(Array.isArray(R))for(let D=0,I=R.length;D<I;D++)d(R[D],y,D,w);else d(R,y,0,w)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function d(v,T,A,w){if(S(v,T,A,w)===!0){let y=v.__offset,M=v.value;if(Array.isArray(M)){let R=0;for(let D=0;D<M.length;D++){let I=M[D],z=f(I);g(I,v.__data,R),typeof I!="number"&&typeof I!="boolean"&&!I.isMatrix3&&!ArrayBuffer.isView(I)&&(R+=z.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(M,v.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,y,v.__data)}}function g(v,T,A){typeof v=="number"||typeof v=="boolean"?T[0]=v:v.isMatrix3?(T[0]=v.elements[0],T[1]=v.elements[1],T[2]=v.elements[2],T[3]=0,T[4]=v.elements[3],T[5]=v.elements[4],T[6]=v.elements[5],T[7]=0,T[8]=v.elements[6],T[9]=v.elements[7],T[10]=v.elements[8],T[11]=0):ArrayBuffer.isView(v)?T.set(new v.constructor(v.buffer,v.byteOffset,T.length)):v.toArray(T,A)}function S(v,T,A,w){let y=v.value,M=T+"_"+A;if(w[M]===void 0)return typeof y=="number"||typeof y=="boolean"?w[M]=y:ArrayBuffer.isView(y)?w[M]=y.slice():w[M]=y.clone(),!0;{let R=w[M];if(typeof y=="number"||typeof y=="boolean"){if(R!==y)return w[M]=y,!0}else{if(ArrayBuffer.isView(y))return!0;if(R.equals(y)===!1)return R.copy(y),!0}}return!1}function m(v){let T=v.uniforms,A=0,w=16;for(let M=0,R=T.length;M<R;M++){let D=Array.isArray(T[M])?T[M]:[T[M]];for(let I=0,z=D.length;I<z;I++){let q=D[I],O=Array.isArray(q.value)?q.value:[q.value];for(let G=0,V=O.length;G<V;G++){let K=O[G],it=f(K),ht=A%w,ft=ht%it.boundary,_t=ht+ft;A+=ft,_t!==0&&w-_t<it.storage&&(A+=w-_t),q.__data=new Float32Array(it.storage/Float32Array.BYTES_PER_ELEMENT),q.__offset=A,A+=it.storage}}}let y=A%w;return y>0&&(A+=w-y),v.__size=A,v.__cache={},this}function f(v){let T={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(T.boundary=4,T.storage=4):v.isVector2?(T.boundary=8,T.storage=8):v.isVector3||v.isColor?(T.boundary=16,T.storage=12):v.isVector4?(T.boundary=16,T.storage=16):v.isMatrix3?(T.boundary=48,T.storage=48):v.isMatrix4?(T.boundary=64,T.storage=64):v.isTexture?Lt("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(T.boundary=16,T.storage=v.byteLength):Lt("WebGLRenderer: Unsupported uniform value type.",v),T}function _(v){let T=v.target;T.removeEventListener("dispose",_);let A=r.indexOf(T.__bindingPointIndex);r.splice(A,1),e.deleteBuffer(s[T.id]),delete s[T.id],delete a[T.id]}function b(){for(let v in s)e.deleteBuffer(s[v]);r=[],s={},a={}}return{bind:l,update:c,dispose:b}}var s2=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Zi=null;function a2(){return Zi===null&&(Zi=new Wh(s2,16,16,ba,Yi),Zi.name="DFG_LUT",Zi.minFilter=dn,Zi.magFilter=dn,Zi.wrapS=Vi,Zi.wrapT=Vi,Zi.generateMipmaps=!1,Zi.needsUpdate=!0),Zi}var hd=class{constructor(t={}){let{canvas:n=PS(),context:i=null,depth:s=!0,stencil:a=!1,alpha:r=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:p=!1,reversedDepthBuffer:u=!1,outputBufferType:d=$n}=t;this.isWebGLRenderer=!0;let g;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=i.getContextAttributes().alpha}else g=r;let S=d,m=new Set([Cf,wf,Af]),f=new Set([$n,Ei,yo,xo,Ef,Tf]),_=new Uint32Array(4),b=new Int32Array(4),v=new L,T=null,A=null,w=[],y=[],M=null;this.domElement=n,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Mi,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let R=this,D=!1,I=null,z=null,q=null,O=null;this._outputColorSpace=Tn;let G=0,V=0,K=null,it=-1,ht=null,ft=new Ie,_t=new Ie,Jt=null,ue=new $t(0),Wt=0,tt=n.width,mt=n.height,ot=1,Nt=null,It=null,Rt=new Ie(0,0,tt,mt),we=new Ie(0,0,tt,mt),zt=!1,re=new Wl,Vt=!1,Kt=!1,be=new Le,Ne=new L,Ue=new Ie,Ve={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Ce=!1;function Oe(){return K===null?ot:1}let P=i;function pn(E,B){return n.getContext(E,B)}try{let E={alpha:!0,depth:s,stencil:a,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:p};if("setAttribute"in n&&n.setAttribute("data-engine",`three.js r${yf}`),n.addEventListener("webglcontextlost",Pe,!1),n.addEventListener("webglcontextrestored",_e,!1),n.addEventListener("webglcontextcreationerror",wi,!1),P===null){let B="webgl2";if(P=pn(B,E),P===null)throw pn(B)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(E){throw Ot("WebGLRenderer: "+E.message),E}let ie,C,x,F,X,J,ct,pt,Z,Q,dt,N,W,nt,lt,rt,At,U,ut,$,gt,vt,st;function wt(){ie=new fR(P),ie.init(),gt=new Q3(P,ie),C=new sR(P,ie,t,gt),x=new K3(P,ie),C.reversedDepthBuffer&&u&&x.buffers.depth.setReversed(!0),z=P.createFramebuffer(),q=P.createFramebuffer(),O=P.createFramebuffer(),F=new mR(P),X=new P3,J=new j3(P,ie,x,X,C,gt,F),ct=new hR(R),pt=new yA(P),vt=new nR(P,pt),Z=new dR(P,pt,F,vt),Q=new _R(P,Z,pt,vt,F),U=new gR(P,C,J),lt=new aR(X),dt=new O3(R,ct,ie,C,vt,lt),N=new n2(R,X),W=new B3,nt=new X3(ie),At=new eR(R,ct,x,Q,g,l),rt=new J3(R,Q,C),st=new i2(P,F,C,x),ut=new iR(P,ie,F),$=new pR(P,ie,F),F.programs=dt.programs,R.capabilities=C,R.extensions=ie,R.properties=X,R.renderLists=W,R.shadowMap=rt,R.state=x,R.info=F}wt(),S!==$n&&(M=new yR(S,n.width,n.height,o,s,a));let Et=new R0(R,P);this.xr=Et,this.getContext=function(){return P},this.getContextAttributes=function(){return P.getContextAttributes()},this.forceContextLoss=function(){let E=ie.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){let E=ie.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return ot},this.setPixelRatio=function(E){E!==void 0&&(ot=E,this.setSize(tt,mt,!1))},this.getSize=function(E){return E.set(tt,mt)},this.setSize=function(E,B,Y=!0){if(Et.isPresenting){Lt("WebGLRenderer: Can't change size while VR device is presenting.");return}tt=E,mt=B,n.width=Math.floor(E*ot),n.height=Math.floor(B*ot),Y===!0&&(n.style.width=E+"px",n.style.height=B+"px"),M!==null&&M.setSize(n.width,n.height),this.setViewport(0,0,E,B)},this.getDrawingBufferSize=function(E){return E.set(tt*ot,mt*ot).floor()},this.setDrawingBufferSize=function(E,B,Y){tt=E,mt=B,ot=Y,n.width=Math.floor(E*Y),n.height=Math.floor(B*Y),this.setViewport(0,0,E,B)},this.setEffects=function(E){if(S===$n){Ot("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(E){for(let B=0;B<E.length;B++)if(E[B].isOutputPass===!0){Lt("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}M.setEffects(E||[])},this.getCurrentViewport=function(E){return E.copy(ft)},this.getViewport=function(E){return E.copy(Rt)},this.setViewport=function(E,B,Y,H){E.isVector4?Rt.set(E.x,E.y,E.z,E.w):Rt.set(E,B,Y,H),x.viewport(ft.copy(Rt).multiplyScalar(ot).round())},this.getScissor=function(E){return E.copy(we)},this.setScissor=function(E,B,Y,H){E.isVector4?we.set(E.x,E.y,E.z,E.w):we.set(E,B,Y,H),x.scissor(_t.copy(we).multiplyScalar(ot).round())},this.getScissorTest=function(){return zt},this.setScissorTest=function(E){x.setScissorTest(zt=E)},this.setOpaqueSort=function(E){Nt=E},this.setTransparentSort=function(E){It=E},this.getClearColor=function(E){return E.copy(At.getClearColor())},this.setClearColor=function(){At.setClearColor(...arguments)},this.getClearAlpha=function(){return At.getClearAlpha()},this.setClearAlpha=function(){At.setClearAlpha(...arguments)},this.clear=function(E=!0,B=!0,Y=!0){let H=0;if(E){let k=!1;if(K!==null){let bt=K.texture.format;k=m.has(bt)}if(k){let bt=K.texture.type,Mt=f.has(bt),xt=At.getClearColor(),Tt=At.getClearAlpha(),Ct=xt.r,Ht=xt.g,Xt=xt.b;Mt?(_[0]=Ct,_[1]=Ht,_[2]=Xt,_[3]=Tt,P.clearBufferuiv(P.COLOR,0,_)):(b[0]=Ct,b[1]=Ht,b[2]=Xt,b[3]=Tt,P.clearBufferiv(P.COLOR,0,b))}else H|=P.COLOR_BUFFER_BIT}B&&(H|=P.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),Y&&(H|=P.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),H!==0&&P.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(E){E.setRenderer(this),I=E},this.dispose=function(){n.removeEventListener("webglcontextlost",Pe,!1),n.removeEventListener("webglcontextrestored",_e,!1),n.removeEventListener("webglcontextcreationerror",wi,!1),At.dispose(),W.dispose(),nt.dispose(),X.dispose(),ct.dispose(),Q.dispose(),vt.dispose(),st.dispose(),dt.dispose(),Et.dispose(),Et.removeEventListener("sessionstart",I0),Et.removeEventListener("sessionend",O0),Ma.stop()};function Pe(E){E.preventDefault(),c0("WebGLRenderer: Context Lost."),D=!0}function _e(){c0("WebGLRenderer: Context Restored."),D=!1;let E=F.autoReset,B=rt.enabled,Y=rt.autoUpdate,H=rt.needsUpdate,k=rt.type;wt(),F.autoReset=E,rt.enabled=B,rt.autoUpdate=Y,rt.needsUpdate=H,rt.type=k}function wi(E){Ot("WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function Ci(E){let B=E.target;B.removeEventListener("dispose",Ci),CM(B)}function CM(E){RM(E),X.remove(E)}function RM(E){let B=X.get(E).programs;B!==void 0&&(B.forEach(function(Y){dt.releaseProgram(Y)}),E.isShaderMaterial&&dt.releaseShaderCache(E))}this.renderBufferDirect=function(E,B,Y,H,k,bt){B===null&&(B=Ve);let Mt=k.isMesh&&k.matrixWorld.determinantAffine()<0,xt=UM(E,B,Y,H,k);x.setMaterial(H,Mt);let Tt=Y.index,Ct=1;if(H.wireframe===!0){if(Tt=Z.getWireframeAttribute(Y),Tt===void 0)return;Ct=2}let Ht=Y.drawRange,Xt=Y.attributes.position,Dt=Ht.start*Ct,he=(Ht.start+Ht.count)*Ct;bt!==null&&(Dt=Math.max(Dt,bt.start*Ct),he=Math.min(he,(bt.start+bt.count)*Ct)),Tt!==null?(Dt=Math.max(Dt,0),he=Math.min(he,Tt.count)):Xt!=null&&(Dt=Math.max(Dt,0),he=Math.min(he,Xt.count));let He=he-Dt;if(He<0||He===1/0)return;vt.setup(k,H,xt,Y,Tt);let ze,pe=ut;if(Tt!==null&&(ze=pt.get(Tt),pe=$,pe.setIndex(ze)),k.isMesh)H.wireframe===!0?(x.setLineWidth(H.wireframeLinewidth*Oe()),pe.setMode(P.LINES)):pe.setMode(P.TRIANGLES);else if(k.isLine){let mn=H.linewidth;mn===void 0&&(mn=1),x.setLineWidth(mn*Oe()),k.isLineSegments?pe.setMode(P.LINES):k.isLineLoop?pe.setMode(P.LINE_LOOP):pe.setMode(P.LINE_STRIP)}else k.isPoints?pe.setMode(P.POINTS):k.isSprite&&pe.setMode(P.TRIANGLES);if(k.isBatchedMesh)if(ie.get("WEBGL_multi_draw"))pe.renderMultiDraw(k._multiDrawStarts,k._multiDrawCounts,k._multiDrawCount);else{let mn=k._multiDrawStarts,St=k._multiDrawCounts,On=k._multiDrawCount,ne=Tt?pt.get(Tt).bytesPerElement:1,ti=X.get(H).currentProgram.getUniforms();for(let Ri=0;Ri<On;Ri++)ti.setValue(P,"_gl_DrawID",Ri),pe.render(mn[Ri]/ne,St[Ri])}else if(k.isInstancedMesh)pe.renderInstances(Dt,He,k.count);else if(Y.isInstancedBufferGeometry){let mn=Y._maxInstanceCount!==void 0?Y._maxInstanceCount:1/0,St=Math.min(Y.instanceCount,mn);pe.renderInstances(Dt,He,St)}else pe.render(Dt,He)};function L0(E,B,Y){E.transparent===!0&&E.side===Wi&&E.forceSinglePass===!1?(E.side=An,E.needsUpdate=!0,Mc(E,B,Y),E.side=Ms,E.needsUpdate=!0,Mc(E,B,Y),E.side=Wi):Mc(E,B,Y)}this.compile=function(E,B,Y=null){Y===null&&(Y=E),A=nt.get(Y),A.init(B),y.push(A),Y.traverseVisible(function(k){k.isLight&&k.layers.test(B.layers)&&(A.pushLight(k),k.castShadow&&A.pushShadow(k))}),E!==Y&&E.traverseVisible(function(k){k.isLight&&k.layers.test(B.layers)&&(A.pushLight(k),k.castShadow&&A.pushShadow(k))}),A.setupLights();let H=new Set;return E.traverse(function(k){if(!(k.isMesh||k.isPoints||k.isLine||k.isSprite))return;let bt=k.material;if(bt)if(Array.isArray(bt))for(let Mt=0;Mt<bt.length;Mt++){let xt=bt[Mt];L0(xt,Y,k),H.add(xt)}else L0(bt,Y,k),H.add(bt)}),A=y.pop(),H},this.compileAsync=function(E,B,Y=null){let H=this.compile(E,B,Y);return new Promise(k=>{function bt(){if(H.forEach(function(Mt){X.get(Mt).currentProgram.isReady()&&H.delete(Mt)}),H.size===0){k(E);return}setTimeout(bt,10)}ie.get("KHR_parallel_shader_compile")!==null?bt():setTimeout(bt,10)})};let yd=null;function DM(E){yd&&yd(E)}function I0(){Ma.stop()}function O0(){Ma.start()}let Ma=new hM;Ma.setAnimationLoop(DM),typeof self<"u"&&Ma.setContext(self),this.setAnimationLoop=function(E){yd=E,Et.setAnimationLoop(E),E===null?Ma.stop():Ma.start()},Et.addEventListener("sessionstart",I0),Et.addEventListener("sessionend",O0),this.render=function(E,B){if(B!==void 0&&B.isCamera!==!0){Ot("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(D===!0)return;I!==null&&I.renderStart(E,B);let Y=Et.enabled===!0&&Et.isPresenting===!0,H=M!==null&&(K===null||Y)&&M.begin(R,K);if(E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),B.parent===null&&B.matrixWorldAutoUpdate===!0&&B.updateMatrixWorld(),Et.enabled===!0&&Et.isPresenting===!0&&(M===null||M.isCompositing()===!1)&&(Et.cameraAutoUpdate===!0&&Et.updateCamera(B),B=Et.getCamera()),E.isScene===!0&&E.onBeforeRender(R,E,B,K),A=nt.get(E,y.length),A.init(B),A.state.textureUnits=J.getTextureUnits(),y.push(A),be.multiplyMatrices(B.projectionMatrix,B.matrixWorldInverse),re.setFromProjectionMatrix(be,Si,B.reversedDepth),Kt=this.localClippingEnabled,Vt=lt.init(this.clippingPlanes,Kt),T=W.get(E,w.length),T.init(),w.push(T),Et.enabled===!0&&Et.isPresenting===!0){let Mt=R.xr.getDepthSensingMesh();Mt!==null&&xd(Mt,B,-1/0,R.sortObjects)}xd(E,B,0,R.sortObjects),T.finish(),R.sortObjects===!0&&T.sort(Nt,It,B.reversedDepth),Ce=Et.enabled===!1||Et.isPresenting===!1||Et.hasDepthSensing()===!1,Ce&&At.addToRenderList(T,E),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Vt===!0&&lt.beginShadows();let k=A.state.shadowsArray;if(rt.render(k,E,B),Vt===!0&&lt.endShadows(),(H&&M.hasRenderPass())===!1){let Mt=T.opaque,xt=T.transmissive;if(A.setupLights(),B.isArrayCamera){let Tt=B.cameras;if(xt.length>0)for(let Ct=0,Ht=Tt.length;Ct<Ht;Ct++){let Xt=Tt[Ct];z0(Mt,xt,E,Xt)}Ce&&At.render(E);for(let Ct=0,Ht=Tt.length;Ct<Ht;Ct++){let Xt=Tt[Ct];P0(T,E,Xt,Xt.viewport)}}else xt.length>0&&z0(Mt,xt,E,B),Ce&&At.render(E),P0(T,E,B)}K!==null&&V===0&&(J.updateMultisampleRenderTarget(K),J.updateRenderTargetMipmap(K)),H&&M.end(R),E.isScene===!0&&E.onAfterRender(R,E,B),vt.resetDefaultState(),it=-1,ht=null,y.pop(),y.length>0?(A=y[y.length-1],J.setTextureUnits(A.state.textureUnits),Vt===!0&&lt.setGlobalState(R.clippingPlanes,A.state.camera)):A=null,w.pop(),w.length>0?T=w[w.length-1]:T=null,I!==null&&I.renderEnd()};function xd(E,B,Y,H){if(E.visible===!1)return;if(E.layers.test(B.layers)){if(E.isGroup)Y=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(B);else if(E.isLightProbeGrid)A.pushLightProbeGrid(E);else if(E.isLight)A.pushLight(E),E.castShadow&&A.pushShadow(E);else if(E.isSprite){if(!E.frustumCulled||re.intersectsSprite(E)){H&&Ue.setFromMatrixPosition(E.matrixWorld).applyMatrix4(be);let Mt=Q.update(E),xt=E.material;xt.visible&&T.push(E,Mt,xt,Y,Ue.z,null)}}else if((E.isMesh||E.isLine||E.isPoints)&&(!E.frustumCulled||re.intersectsObject(E))){let Mt=Q.update(E),xt=E.material;if(H&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),Ue.copy(E.boundingSphere.center)):(Mt.boundingSphere===null&&Mt.computeBoundingSphere(),Ue.copy(Mt.boundingSphere.center)),Ue.applyMatrix4(E.matrixWorld).applyMatrix4(be)),Array.isArray(xt)){let Tt=Mt.groups;for(let Ct=0,Ht=Tt.length;Ct<Ht;Ct++){let Xt=Tt[Ct],Dt=xt[Xt.materialIndex];Dt&&Dt.visible&&T.push(E,Mt,Dt,Y,Ue.z,Xt)}}else xt.visible&&T.push(E,Mt,xt,Y,Ue.z,null)}}let bt=E.children;for(let Mt=0,xt=bt.length;Mt<xt;Mt++)xd(bt[Mt],B,Y,H)}function P0(E,B,Y,H){let{opaque:k,transmissive:bt,transparent:Mt}=E;A.setupLightsView(Y),Vt===!0&&lt.setGlobalState(R.clippingPlanes,Y),H&&x.viewport(ft.copy(H)),k.length>0&&Sc(k,B,Y),bt.length>0&&Sc(bt,B,Y),Mt.length>0&&Sc(Mt,B,Y),x.buffers.depth.setTest(!0),x.buffers.depth.setMask(!0),x.buffers.color.setMask(!0),x.setPolygonOffset(!1)}function z0(E,B,Y,H){if((Y.isScene===!0?Y.overrideMaterial:null)!==null)return;if(A.state.transmissionRenderTarget[H.id]===void 0){let Dt=ie.has("EXT_color_buffer_half_float")||ie.has("EXT_color_buffer_float");A.state.transmissionRenderTarget[H.id]=new Jn(1,1,{generateMipmaps:!0,type:Dt?Yi:$n,minFilter:ya,samples:Math.max(4,C.samples),stencilBuffer:a,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Qt.workingColorSpace})}let bt=A.state.transmissionRenderTarget[H.id],Mt=H.viewport||ft;bt.setSize(Mt.z*R.transmissionResolutionScale,Mt.w*R.transmissionResolutionScale);let xt=R.getRenderTarget(),Tt=R.getActiveCubeFace(),Ct=R.getActiveMipmapLevel();R.setRenderTarget(bt),R.getClearColor(ue),Wt=R.getClearAlpha(),Wt<1&&R.setClearColor(16777215,.5),R.clear(),Ce&&At.render(Y);let Ht=R.toneMapping;R.toneMapping=Mi;let Xt=H.viewport;if(H.viewport!==void 0&&(H.viewport=void 0),A.setupLightsView(H),Vt===!0&&lt.setGlobalState(R.clippingPlanes,H),Sc(E,Y,H),J.updateMultisampleRenderTarget(bt),J.updateRenderTargetMipmap(bt),ie.has("WEBGL_multisampled_render_to_texture")===!1){let Dt=!1;for(let he=0,He=B.length;he<He;he++){let ze=B[he],{object:pe,geometry:mn,material:St,group:On}=ze;if(St.side===Wi&&pe.layers.test(H.layers)){let ne=St.side;St.side=An,St.needsUpdate=!0,B0(pe,Y,H,mn,St,On),St.side=ne,St.needsUpdate=!0,Dt=!0}}Dt===!0&&(J.updateMultisampleRenderTarget(bt),J.updateRenderTargetMipmap(bt))}R.setRenderTarget(xt,Tt,Ct),R.setClearColor(ue,Wt),Xt!==void 0&&(H.viewport=Xt),R.toneMapping=Ht}function Sc(E,B,Y){let H=B.isScene===!0?B.overrideMaterial:null;for(let k=0,bt=E.length;k<bt;k++){let Mt=E[k],{object:xt,geometry:Tt,group:Ct}=Mt,Ht=Mt.material;Ht.allowOverride===!0&&H!==null&&(Ht=H),xt.layers.test(Y.layers)&&B0(xt,B,Y,Tt,Ht,Ct)}}function B0(E,B,Y,H,k,bt){E.onBeforeRender(R,B,Y,H,k,bt),E.modelViewMatrix.multiplyMatrices(Y.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),k.onBeforeRender(R,B,Y,H,E,bt),k.transparent===!0&&k.side===Wi&&k.forceSinglePass===!1?(k.side=An,k.needsUpdate=!0,R.renderBufferDirect(Y,B,H,k,E,bt),k.side=Ms,k.needsUpdate=!0,R.renderBufferDirect(Y,B,H,k,E,bt),k.side=Wi):R.renderBufferDirect(Y,B,H,k,E,bt),E.onAfterRender(R,B,Y,H,k,bt)}function Mc(E,B,Y){B.isScene!==!0&&(B=Ve);let H=X.get(E),k=A.state.lights,bt=A.state.shadowsArray,Mt=k.state.version,xt=dt.getParameters(E,k.state,bt,B,Y,A.state.lightProbeGridArray),Tt=dt.getProgramCacheKey(xt),Ct=H.programs;H.environment=E.isMeshStandardMaterial||E.isMeshLambertMaterial||E.isMeshPhongMaterial?B.environment:null,H.fog=B.fog;let Ht=E.isMeshStandardMaterial||E.isMeshLambertMaterial&&!E.envMap||E.isMeshPhongMaterial&&!E.envMap;H.envMap=ct.get(E.envMap||H.environment,Ht),H.envMapRotation=H.environment!==null&&E.envMap===null?B.environmentRotation:E.envMapRotation,Ct===void 0&&(E.addEventListener("dispose",Ci),Ct=new Map,H.programs=Ct);let Xt=Ct.get(Tt);if(Xt!==void 0){if(H.currentProgram===Xt&&H.lightsStateVersion===Mt)return V0(E,xt),Xt}else xt.uniforms=dt.getUniforms(E),I!==null&&E.isNodeMaterial&&I.build(E,Y,xt),E.onBeforeCompile(xt,R),Xt=dt.acquireProgram(xt,Tt),Ct.set(Tt,Xt),H.uniforms=xt.uniforms;let Dt=H.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(Dt.clippingPlanes=lt.uniform),V0(E,xt),H.needsLights=IM(E),H.lightsStateVersion=Mt,H.needsLights&&(Dt.ambientLightColor.value=k.state.ambient,Dt.lightProbe.value=k.state.probe,Dt.directionalLights.value=k.state.directional,Dt.directionalLightShadows.value=k.state.directionalShadow,Dt.spotLights.value=k.state.spot,Dt.spotLightShadows.value=k.state.spotShadow,Dt.rectAreaLights.value=k.state.rectArea,Dt.ltc_1.value=k.state.rectAreaLTC1,Dt.ltc_2.value=k.state.rectAreaLTC2,Dt.pointLights.value=k.state.point,Dt.pointLightShadows.value=k.state.pointShadow,Dt.hemisphereLights.value=k.state.hemi,Dt.directionalShadowMatrix.value=k.state.directionalShadowMatrix,Dt.spotLightMatrix.value=k.state.spotLightMatrix,Dt.spotLightMap.value=k.state.spotLightMap,Dt.pointShadowMatrix.value=k.state.pointShadowMatrix),H.lightProbeGrid=A.state.lightProbeGridArray.length>0,H.currentProgram=Xt,H.uniformsList=null,Xt}function F0(E){if(E.uniformsList===null){let B=E.currentProgram.getUniforms();E.uniformsList=So.seqWithValue(B.seq,E.uniforms)}return E.uniformsList}function V0(E,B){let Y=X.get(E);Y.outputColorSpace=B.outputColorSpace,Y.batching=B.batching,Y.batchingColor=B.batchingColor,Y.instancing=B.instancing,Y.instancingColor=B.instancingColor,Y.instancingMorph=B.instancingMorph,Y.skinning=B.skinning,Y.morphTargets=B.morphTargets,Y.morphNormals=B.morphNormals,Y.morphColors=B.morphColors,Y.morphTargetsCount=B.morphTargetsCount,Y.numClippingPlanes=B.numClippingPlanes,Y.numIntersection=B.numClipIntersection,Y.vertexAlphas=B.vertexAlphas,Y.vertexTangents=B.vertexTangents,Y.toneMapping=B.toneMapping}function NM(E,B){if(E.length===0)return null;if(E.length===1)return E[0].texture!==null?E[0]:null;v.setFromMatrixPosition(B.matrixWorld);for(let Y=0,H=E.length;Y<H;Y++){let k=E[Y];if(k.texture!==null&&k.boundingBox.containsPoint(v))return k}return null}function UM(E,B,Y,H,k){B.isScene!==!0&&(B=Ve),J.resetTextureUnits();let bt=B.fog,Mt=H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial?B.environment:null,xt=K===null?R.outputColorSpace:K.isXRRenderTarget===!0?K.texture.colorSpace:Qt.workingColorSpace,Tt=H.isMeshStandardMaterial||H.isMeshLambertMaterial&&!H.envMap||H.isMeshPhongMaterial&&!H.envMap,Ct=ct.get(H.envMap||Mt,Tt),Ht=H.vertexColors===!0&&!!Y.attributes.color&&Y.attributes.color.itemSize===4,Xt=!!Y.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Dt=!!Y.morphAttributes.position,he=!!Y.morphAttributes.normal,He=!!Y.morphAttributes.color,ze=Mi;H.toneMapped&&(K===null||K.isXRRenderTarget===!0)&&(ze=R.toneMapping);let pe=Y.morphAttributes.position||Y.morphAttributes.normal||Y.morphAttributes.color,mn=pe!==void 0?pe.length:0,St=X.get(H),On=A.state.lights;if(Vt===!0&&(Kt===!0||E!==ht)){let ve=E===ht&&H.id===it;lt.setState(H,E,ve)}let ne=!1;H.version===St.__version?(St.needsLights&&St.lightsStateVersion!==On.state.version||St.outputColorSpace!==xt||k.isBatchedMesh&&St.batching===!1||!k.isBatchedMesh&&St.batching===!0||k.isBatchedMesh&&St.batchingColor===!0&&k.colorTexture===null||k.isBatchedMesh&&St.batchingColor===!1&&k.colorTexture!==null||k.isInstancedMesh&&St.instancing===!1||!k.isInstancedMesh&&St.instancing===!0||k.isSkinnedMesh&&St.skinning===!1||!k.isSkinnedMesh&&St.skinning===!0||k.isInstancedMesh&&St.instancingColor===!0&&k.instanceColor===null||k.isInstancedMesh&&St.instancingColor===!1&&k.instanceColor!==null||k.isInstancedMesh&&St.instancingMorph===!0&&k.morphTexture===null||k.isInstancedMesh&&St.instancingMorph===!1&&k.morphTexture!==null||St.envMap!==Ct||H.fog===!0&&St.fog!==bt||St.numClippingPlanes!==void 0&&(St.numClippingPlanes!==lt.numPlanes||St.numIntersection!==lt.numIntersection)||St.vertexAlphas!==Ht||St.vertexTangents!==Xt||St.morphTargets!==Dt||St.morphNormals!==he||St.morphColors!==He||St.toneMapping!==ze||St.morphTargetsCount!==mn||!!St.lightProbeGrid!=A.state.lightProbeGridArray.length>0)&&(ne=!0):(ne=!0,St.__version=H.version);let ti=St.currentProgram;ne===!0&&(ti=Mc(H,B,k),I&&H.isNodeMaterial&&I.onUpdateProgram(H,ti,St));let Ri=!1,As=!1,nr=!1,me=ti.getUniforms(),Ge=St.uniforms;if(x.useProgram(ti.program)&&(Ri=!0,As=!0,nr=!0),H.id!==it&&(it=H.id,As=!0),St.needsLights){let ve=NM(A.state.lightProbeGridArray,k);St.lightProbeGrid!==ve&&(St.lightProbeGrid=ve,As=!0)}if(Ri||ht!==E){x.buffers.depth.getReversed()&&E.reversedDepth!==!0&&(E._reversedDepth=!0,E.updateProjectionMatrix()),me.setValue(P,"projectionMatrix",E.projectionMatrix),me.setValue(P,"viewMatrix",E.matrixWorldInverse);let Cs=me.map.cameraPosition;Cs!==void 0&&Cs.setValue(P,Ne.setFromMatrixPosition(E.matrixWorld)),C.logarithmicDepthBuffer&&me.setValue(P,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&me.setValue(P,"isOrthographic",E.isOrthographicCamera===!0),ht!==E&&(ht=E,As=!0,nr=!0)}if(St.needsLights&&(On.state.directionalShadowMap.length>0&&me.setValue(P,"directionalShadowMap",On.state.directionalShadowMap,J),On.state.spotShadowMap.length>0&&me.setValue(P,"spotShadowMap",On.state.spotShadowMap,J),On.state.pointShadowMap.length>0&&me.setValue(P,"pointShadowMap",On.state.pointShadowMap,J)),k.isSkinnedMesh){me.setOptional(P,k,"bindMatrix"),me.setOptional(P,k,"bindMatrixInverse");let ve=k.skeleton;ve&&(ve.boneTexture===null&&ve.computeBoneTexture(),me.setValue(P,"boneTexture",ve.boneTexture,J))}k.isBatchedMesh&&(me.setOptional(P,k,"batchingTexture"),me.setValue(P,"batchingTexture",k._matricesTexture,J),me.setOptional(P,k,"batchingIdTexture"),me.setValue(P,"batchingIdTexture",k._indirectTexture,J),me.setOptional(P,k,"batchingColorTexture"),k._colorsTexture!==null&&me.setValue(P,"batchingColorTexture",k._colorsTexture,J));let ws=Y.morphAttributes;if((ws.position!==void 0||ws.normal!==void 0||ws.color!==void 0)&&U.update(k,Y,ti),(As||St.receiveShadow!==k.receiveShadow)&&(St.receiveShadow=k.receiveShadow,me.setValue(P,"receiveShadow",k.receiveShadow)),(H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial)&&H.envMap===null&&B.environment!==null&&(Ge.envMapIntensity.value=B.environmentIntensity),Ge.dfgLUT!==void 0&&(Ge.dfgLUT.value=a2()),As){if(me.setValue(P,"toneMappingExposure",R.toneMappingExposure),St.needsLights&&LM(Ge,nr),bt&&H.fog===!0&&N.refreshFogUniforms(Ge,bt),N.refreshMaterialUniforms(Ge,H,ot,mt,A.state.transmissionRenderTarget[E.id]),St.needsLights&&St.lightProbeGrid){let ve=St.lightProbeGrid;Ge.probesSH.value=ve.texture,Ge.probesMin.value.copy(ve.boundingBox.min),Ge.probesMax.value.copy(ve.boundingBox.max),Ge.probesResolution.value.copy(ve.resolution)}So.upload(P,F0(St),Ge,J)}if(H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(So.upload(P,F0(St),Ge,J),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&me.setValue(P,"center",k.center),me.setValue(P,"modelViewMatrix",k.modelViewMatrix),me.setValue(P,"normalMatrix",k.normalMatrix),me.setValue(P,"modelMatrix",k.matrixWorld),H.uniformsGroups!==void 0){let ve=H.uniformsGroups;for(let Cs=0,ir=ve.length;Cs<ir;Cs++){let H0=ve[Cs];st.update(H0,ti),st.bind(H0,ti)}}return ti}function LM(E,B){E.ambientLightColor.needsUpdate=B,E.lightProbe.needsUpdate=B,E.directionalLights.needsUpdate=B,E.directionalLightShadows.needsUpdate=B,E.pointLights.needsUpdate=B,E.pointLightShadows.needsUpdate=B,E.spotLights.needsUpdate=B,E.spotLightShadows.needsUpdate=B,E.rectAreaLights.needsUpdate=B,E.hemisphereLights.needsUpdate=B}function IM(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return G},this.getActiveMipmapLevel=function(){return V},this.getRenderTarget=function(){return K},this.setRenderTargetTextures=function(E,B,Y){let H=X.get(E);H.__autoAllocateDepthBuffer=E.resolveDepthBuffer===!1,H.__autoAllocateDepthBuffer===!1&&(H.__useRenderToTexture=!1),X.get(E.texture).__webglTexture=B,X.get(E.depthTexture).__webglTexture=H.__autoAllocateDepthBuffer?void 0:Y,H.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(E,B){let Y=X.get(E);Y.__webglFramebuffer=B,Y.__useDefaultFramebuffer=B===void 0},this.setRenderTarget=function(E,B=0,Y=0){K=E,G=B,V=Y;let H=null,k=!1,bt=!1;if(E){let xt=X.get(E);if(xt.__useDefaultFramebuffer!==void 0){x.bindFramebuffer(P.FRAMEBUFFER,xt.__webglFramebuffer),ft.copy(E.viewport),_t.copy(E.scissor),Jt=E.scissorTest,x.viewport(ft),x.scissor(_t),x.setScissorTest(Jt),it=-1;return}else if(xt.__webglFramebuffer===void 0)J.setupRenderTarget(E);else if(xt.__hasExternalTextures)J.rebindTextures(E,X.get(E.texture).__webglTexture,X.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){let Ht=E.depthTexture;if(xt.__boundDepthTexture!==Ht){if(Ht!==null&&X.has(Ht)&&(E.width!==Ht.image.width||E.height!==Ht.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");J.setupDepthRenderbuffer(E)}}let Tt=E.texture;(Tt.isData3DTexture||Tt.isDataArrayTexture||Tt.isCompressedArrayTexture)&&(bt=!0);let Ct=X.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(Ct[B])?H=Ct[B][Y]:H=Ct[B],k=!0):E.samples>0&&J.useMultisampledRTT(E)===!1?H=X.get(E).__webglMultisampledFramebuffer:Array.isArray(Ct)?H=Ct[Y]:H=Ct,ft.copy(E.viewport),_t.copy(E.scissor),Jt=E.scissorTest}else ft.copy(Rt).multiplyScalar(ot).floor(),_t.copy(we).multiplyScalar(ot).floor(),Jt=zt;if(Y!==0&&(H=z),x.bindFramebuffer(P.FRAMEBUFFER,H)&&x.drawBuffers(E,H),x.viewport(ft),x.scissor(_t),x.setScissorTest(Jt),k){let xt=X.get(E.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_CUBE_MAP_POSITIVE_X+B,xt.__webglTexture,Y)}else if(bt){let xt=B;for(let Tt=0;Tt<E.textures.length;Tt++){let Ct=X.get(E.textures[Tt]);P.framebufferTextureLayer(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0+Tt,Ct.__webglTexture,Y,xt)}}else if(E!==null&&Y!==0){let xt=X.get(E.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,xt.__webglTexture,Y)}it=-1},this.readRenderTargetPixels=function(E,B,Y,H,k,bt,Mt,xt=0){if(!(E&&E.isWebGLRenderTarget)){Ot("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Tt=X.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&Mt!==void 0&&(Tt=Tt[Mt]),Tt){x.bindFramebuffer(P.FRAMEBUFFER,Tt);try{let Ct=E.textures[xt],Ht=Ct.format,Xt=Ct.type;if(E.textures.length>1&&P.readBuffer(P.COLOR_ATTACHMENT0+xt),!C.textureFormatReadable(Ht)){Ot("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!C.textureTypeReadable(Xt)){Ot("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}B>=0&&B<=E.width-H&&Y>=0&&Y<=E.height-k&&P.readPixels(B,Y,H,k,gt.convert(Ht),gt.convert(Xt),bt)}finally{let Ct=K!==null?X.get(K).__webglFramebuffer:null;x.bindFramebuffer(P.FRAMEBUFFER,Ct)}}},this.readRenderTargetPixelsAsync=async function(E,B,Y,H,k,bt,Mt,xt=0){if(!(E&&E.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Tt=X.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&Mt!==void 0&&(Tt=Tt[Mt]),Tt)if(B>=0&&B<=E.width-H&&Y>=0&&Y<=E.height-k){x.bindFramebuffer(P.FRAMEBUFFER,Tt);let Ct=E.textures[xt],Ht=Ct.format,Xt=Ct.type;if(E.textures.length>1&&P.readBuffer(P.COLOR_ATTACHMENT0+xt),!C.textureFormatReadable(Ht))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!C.textureTypeReadable(Xt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Dt=P.createBuffer();P.bindBuffer(P.PIXEL_PACK_BUFFER,Dt),P.bufferData(P.PIXEL_PACK_BUFFER,bt.byteLength,P.STREAM_READ),P.readPixels(B,Y,H,k,gt.convert(Ht),gt.convert(Xt),0);let he=K!==null?X.get(K).__webglFramebuffer:null;x.bindFramebuffer(P.FRAMEBUFFER,he);let He=P.fenceSync(P.SYNC_GPU_COMMANDS_COMPLETE,0);return P.flush(),await BS(P,He,4),P.bindBuffer(P.PIXEL_PACK_BUFFER,Dt),P.getBufferSubData(P.PIXEL_PACK_BUFFER,0,bt),P.deleteBuffer(Dt),P.deleteSync(He),bt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(E,B=null,Y=0){let H=Math.pow(2,-Y),k=Math.floor(E.image.width*H),bt=Math.floor(E.image.height*H),Mt=B!==null?B.x:0,xt=B!==null?B.y:0;J.setTexture2D(E,0),P.copyTexSubImage2D(P.TEXTURE_2D,Y,0,0,Mt,xt,k,bt),x.unbindTexture()},this.copyTextureToTexture=function(E,B,Y=null,H=null,k=0,bt=0){let Mt,xt,Tt,Ct,Ht,Xt,Dt,he,He,ze=E.isCompressedTexture?E.mipmaps[bt]:E.image;if(Y!==null)Mt=Y.max.x-Y.min.x,xt=Y.max.y-Y.min.y,Tt=Y.isBox3?Y.max.z-Y.min.z:1,Ct=Y.min.x,Ht=Y.min.y,Xt=Y.isBox3?Y.min.z:0;else{let Ge=Math.pow(2,-k);Mt=Math.floor(ze.width*Ge),xt=Math.floor(ze.height*Ge),E.isDataArrayTexture?Tt=ze.depth:E.isData3DTexture?Tt=Math.floor(ze.depth*Ge):Tt=1,Ct=0,Ht=0,Xt=0}H!==null?(Dt=H.x,he=H.y,He=H.z):(Dt=0,he=0,He=0);let pe=gt.convert(B.format),mn=gt.convert(B.type),St;B.isData3DTexture?(J.setTexture3D(B,0),St=P.TEXTURE_3D):B.isDataArrayTexture||B.isCompressedArrayTexture?(J.setTexture2DArray(B,0),St=P.TEXTURE_2D_ARRAY):(J.setTexture2D(B,0),St=P.TEXTURE_2D),x.activeTexture(P.TEXTURE0),x.pixelStorei(P.UNPACK_FLIP_Y_WEBGL,B.flipY),x.pixelStorei(P.UNPACK_PREMULTIPLY_ALPHA_WEBGL,B.premultiplyAlpha),x.pixelStorei(P.UNPACK_ALIGNMENT,B.unpackAlignment);let On=x.getParameter(P.UNPACK_ROW_LENGTH),ne=x.getParameter(P.UNPACK_IMAGE_HEIGHT),ti=x.getParameter(P.UNPACK_SKIP_PIXELS),Ri=x.getParameter(P.UNPACK_SKIP_ROWS),As=x.getParameter(P.UNPACK_SKIP_IMAGES);x.pixelStorei(P.UNPACK_ROW_LENGTH,ze.width),x.pixelStorei(P.UNPACK_IMAGE_HEIGHT,ze.height),x.pixelStorei(P.UNPACK_SKIP_PIXELS,Ct),x.pixelStorei(P.UNPACK_SKIP_ROWS,Ht),x.pixelStorei(P.UNPACK_SKIP_IMAGES,Xt);let nr=E.isDataArrayTexture||E.isData3DTexture,me=B.isDataArrayTexture||B.isData3DTexture;if(E.isDepthTexture){let Ge=X.get(E),ws=X.get(B),ve=X.get(Ge.__renderTarget),Cs=X.get(ws.__renderTarget);x.bindFramebuffer(P.READ_FRAMEBUFFER,ve.__webglFramebuffer),x.bindFramebuffer(P.DRAW_FRAMEBUFFER,Cs.__webglFramebuffer);for(let ir=0;ir<Tt;ir++)nr&&(P.framebufferTextureLayer(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,X.get(E).__webglTexture,k,Xt+ir),P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,X.get(B).__webglTexture,bt,He+ir)),P.blitFramebuffer(Ct,Ht,Mt,xt,Dt,he,Mt,xt,P.DEPTH_BUFFER_BIT,P.NEAREST);x.bindFramebuffer(P.READ_FRAMEBUFFER,null),x.bindFramebuffer(P.DRAW_FRAMEBUFFER,null)}else if(k!==0||E.isRenderTargetTexture||X.has(E)){let Ge=X.get(E),ws=X.get(B);x.bindFramebuffer(P.READ_FRAMEBUFFER,q),x.bindFramebuffer(P.DRAW_FRAMEBUFFER,O);for(let ve=0;ve<Tt;ve++)nr?P.framebufferTextureLayer(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,Ge.__webglTexture,k,Xt+ve):P.framebufferTexture2D(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,Ge.__webglTexture,k),me?P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,ws.__webglTexture,bt,He+ve):P.framebufferTexture2D(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,ws.__webglTexture,bt),k!==0?P.blitFramebuffer(Ct,Ht,Mt,xt,Dt,he,Mt,xt,P.COLOR_BUFFER_BIT,P.NEAREST):me?P.copyTexSubImage3D(St,bt,Dt,he,He+ve,Ct,Ht,Mt,xt):P.copyTexSubImage2D(St,bt,Dt,he,Ct,Ht,Mt,xt);x.bindFramebuffer(P.READ_FRAMEBUFFER,null),x.bindFramebuffer(P.DRAW_FRAMEBUFFER,null)}else me?E.isDataTexture||E.isData3DTexture?P.texSubImage3D(St,bt,Dt,he,He,Mt,xt,Tt,pe,mn,ze.data):B.isCompressedArrayTexture?P.compressedTexSubImage3D(St,bt,Dt,he,He,Mt,xt,Tt,pe,ze.data):P.texSubImage3D(St,bt,Dt,he,He,Mt,xt,Tt,pe,mn,ze):E.isDataTexture?P.texSubImage2D(P.TEXTURE_2D,bt,Dt,he,Mt,xt,pe,mn,ze.data):E.isCompressedTexture?P.compressedTexSubImage2D(P.TEXTURE_2D,bt,Dt,he,ze.width,ze.height,pe,ze.data):P.texSubImage2D(P.TEXTURE_2D,bt,Dt,he,Mt,xt,pe,mn,ze);x.pixelStorei(P.UNPACK_ROW_LENGTH,On),x.pixelStorei(P.UNPACK_IMAGE_HEIGHT,ne),x.pixelStorei(P.UNPACK_SKIP_PIXELS,ti),x.pixelStorei(P.UNPACK_SKIP_ROWS,Ri),x.pixelStorei(P.UNPACK_SKIP_IMAGES,As),bt===0&&B.generateMipmaps&&P.generateMipmap(St),x.unbindTexture()},this.initRenderTarget=function(E){X.get(E).__webglFramebuffer===void 0&&J.setupRenderTarget(E)},this.initTexture=function(E){E.isCubeTexture?J.setTextureCube(E,0):E.isData3DTexture?J.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?J.setTexture2DArray(E,0):J.setTexture2D(E,0),x.unbindTexture()},this.resetState=function(){G=0,V=0,K=null,x.reset(),vt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Si}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let n=this.getContext();n.drawingBufferColorSpace=Qt._getDrawingBufferColorSpace(t),n.unpackColorSpace=Qt._getUnpackColorSpace()}};var pd=12;var te=(e,t,n=0)=>({time:e,azimuth:t||0,elevation:n,distance:1}),vM=e=>[...Array.from({length:9},(t,n)=>te(Number((n*5/48).toFixed(6)),e*n*45)),te(1,e*360)],_c=(e,t=0)=>[te(0,0),te(.2,e/2,t/2),te(.4,e,t),te(.6,e/2,t/2),te(.8,0),te(1,0)],yM=e=>[...Array.from({length:9},(t,n)=>te(Number((n*5/48).toFixed(6)),e*n*45,n===8?0:Number((25*Math.sin(Math.PI*n/8)).toFixed(3)))),te(1,e*360)],QU=[{id:"swing",name:"Side Arc",description:"A 65-degree arc around the frame.",duration:5,returnsToStart:!1,trajectory:[te(0,0),te(1,65,8)]},{id:"rise",name:"Hero Rise",description:"A new angle on the action.",duration:5,returnsToStart:!1,trajectory:[te(0,0),te(1,35,30)]},{id:"orbit",name:"Full Orbit",description:"A full right orbit back to the starting pose.",duration:6,returnsToStart:!0,trajectory:vM(1)},{id:"arc-return",name:"Arc Return",description:"Sweep 45 degrees to the side, then retrace to the starting pose.",duration:5,returnsToStart:!0,trajectory:[te(0,0),te(.2,22.5),te(.45,45),te(.7,22.5),te(.9,0),te(1,0)]},{id:"rise-return",name:"Rise Return",description:"Rise 25 degrees, then descend to the starting pose.",duration:5,returnsToStart:!0,trajectory:[te(0,0),te(.2,0,12.5),te(.45,0,25),te(.7,0,12.5),te(.9,0),te(1,0)]},{id:"orbit-left",name:"Orbit Left",description:"A full left orbit back to the starting pose.",duration:6,returnsToStart:!0,trajectory:vM(-1)},{id:"arc-left-return",name:"Left Return",description:"Sweep 45 degrees left, then retrace to the opening view.",duration:5,returnsToStart:!0,trajectory:_c(-45)},{id:"wide-return",name:"Wide Return",description:"Reach a 90-degree side view, then return to the opening pose.",duration:5,returnsToStart:!0,trajectory:_c(90)},{id:"dip-return",name:"Dip Return",description:"Dip 20 degrees below the subject, then rise back to the opening view.",duration:5,returnsToStart:!0,trajectory:_c(0,-20)},{id:"high-arc-return",name:"High Return",description:"Arc 45 degrees right and 25 degrees up, then retrace home.",duration:5,returnsToStart:!0,trajectory:_c(45,25)},{id:"low-arc-return",name:"Low Return",description:"Arc 45 degrees left and 20 degrees down, then retrace home.",duration:5,returnsToStart:!0,trajectory:_c(-45,-20)},{id:"sway-return",name:"Side to Side",description:"Sway left, cross through the opening view to the right, then return.",duration:5,returnsToStart:!0,trajectory:[te(0,0),te(.2,-30),te(.4,0),te(.6,30),te(.8,0),te(1,0)]},{id:"halo",name:"High Orbit",description:"Orbit right through a raised viewpoint, descending to the exact opening pose.",duration:6,returnsToStart:!0,trajectory:yM(1)},{id:"halo-left",name:"High Orbit Left",description:"Orbit left through a raised viewpoint, descending to the exact opening pose.",duration:6,returnsToStart:!0,trajectory:yM(-1)},{id:"arc-left",name:"Left Arc",description:"A 65-degree left arc that finishes at a new angle.",duration:5,returnsToStart:!1,trajectory:[te(0,0),te(1,-65,8)]},{id:"low-angle",name:"Low Reveal",description:"Sweep 40 degrees right and descend 20 degrees for a low-angle finish.",duration:5,returnsToStart:!1,trajectory:[te(0,0),te(1,40,-20)]}];var j=Ec(D0());async function Eo(e){let t=e instanceof FormData?e:new FormData;if(!(e instanceof FormData))for(let[n,i]of Object.entries(e))t.set(n,i);t.set("format","json");try{return await(await fetch(window.location.pathname,{method:"POST",body:t,credentials:"same-origin"})).json()}catch{return null}}var xc=Math.PI/180;function Ai(e,t,n){return Math.max(t,Math.min(n,e))}function bc(e,t){if(t<=e[0].time)return e[0];let n=e[e.length-1];if(t>=n.time)return n;let i=1;for(;e[i].time<t;)i++;let s=e[i-1],a=e[i],r=Math.max(1e-6,a.time-s.time),o=(t-s.time)/r,l=o*o*(3-2*o),c=a.azimuth-s.azimuth;return c=((c%360+540)%360+360)%360-180,{time:t,azimuth:s.azimuth+c*l,elevation:s.elevation+(a.elevation-s.elevation)*l,distance:s.distance+(a.distance-s.distance)*l}}var U0={time:0,azimuth:0,elevation:0,distance:1},c2={...U0,time:1},vc=1024,MM=["#f8fbff","#ffd166","#ff5d8f","#4db0ff","#39d98a"],u2=[{id:"fast",label:"Flare Fast"},{id:"detailed",label:"Flare Detailed"},{id:"turbo",label:"Turbo"},{id:"hq",label:"Sunburst HQ"}];function h2(e){let t=(0,at.useRef)(null),n=(0,at.useRef)([]),i=(0,at.useRef)(!1),[s,a]=(0,at.useState)(MM[0]),[r,o]=(0,at.useState)(14),[l,c]=(0,at.useState)(!1),[h,p]=(0,at.useState)(""),[u,d]=(0,at.useState)("fast"),[,g]=(0,at.useState)(0),S=(0,at.useCallback)(()=>{let _=t.current,b=_?.getContext("2d");if(!(!_||!b)){b.fillStyle="#0a1120",b.fillRect(0,0,vc,vc);for(let v of n.current){b.save(),b.globalCompositeOperation=v.erase?"destination-out":"source-over",b.strokeStyle=v.color,b.fillStyle=v.color,b.lineWidth=v.width,b.lineCap="round",b.lineJoin="round";let[T,...A]=v.points;if(!T){b.restore();continue}b.beginPath(),b.arc(T.x,T.y,v.width/2,0,Math.PI*2),b.fill(),b.beginPath(),b.moveTo(T.x,T.y);for(let w of A)b.lineTo(w.x,w.y);b.stroke(),b.restore()}}},[]);(0,at.useEffect)(()=>S(),[S]);let m=_=>{let b=_.currentTarget.getBoundingClientRect(),v=vc/Math.max(1,Math.min(b.width,b.height));return{x:(_.clientX-b.left)*v,y:(_.clientY-b.top)*v}},f=n.current.length===0;return(0,j.jsxs)("div",{className:"fz-sketch",children:[(0,j.jsx)("canvas",{ref:t,className:"fz-sketch-canvas",width:vc,height:vc,onPointerDown:_=>{_.currentTarget.setPointerCapture(_.pointerId),i.current=!0,n.current.push({points:[m(_)],color:s,width:r,erase:l}),S()},onPointerMove:_=>{i.current&&(n.current[n.current.length-1]?.points.push(m(_)),S())},onPointerUp:()=>{i.current=!1,g(_=>_+1)}}),(0,j.jsxs)("div",{className:"fz-tools",children:[MM.map(_=>(0,j.jsx)("button",{type:"button",className:`fz-swatch${!l&&s===_?" selected":""}`,style:{background:_},"aria-label":`paint ${_}`,onClick:()=>{a(_),c(!1)}},_)),(0,j.jsx)("button",{type:"button",className:`fz-ghost${l?" selected":""}`,onClick:()=>c(_=>!_),children:"erase"}),(0,j.jsx)("input",{className:"fz-size",type:"range",min:4,max:60,value:r,onChange:_=>o(Number(_.target.value)),"aria-label":"brush size"}),(0,j.jsx)("button",{type:"button",className:"fz-ghost",disabled:f,onClick:()=>{n.current=[],S(),g(_=>_+1)},children:"clear"})]}),(0,j.jsx)("textarea",{className:"fz-prompt",placeholder:"describe the scene \u2014 'two friends at a diner, neon light'",value:h,maxLength:2e3,onChange:_=>p(_.target.value)}),(0,j.jsx)("div",{className:"fz-modes",children:u2.map(_=>(0,j.jsx)("button",{type:"button",className:u===_.id?"active":"",onClick:()=>d(_.id),children:_.label},_.id))}),(0,j.jsx)("button",{type:"button",className:"fz-primary",disabled:e.busy||!h.trim(),onClick:()=>{let _=t.current;n.current.length>0&&_?_.toBlob(v=>e.onGenerate(v,h.trim(),u),"image/png"):e.onGenerate(null,h.trim(),u)},children:e.busy?"generating\u2026":"generate the still"})]})}var EM=1/30,TM=10*1024*1024;function f2(e,t,n=1e4){return new Promise((i,s)=>{if(Math.abs(e.currentTime-t)<.001&&e.readyState>=2){i();return}let a=window.setTimeout(()=>{e.removeEventListener("seeked",r),s(new Error("couldn't read that frame"))},n);function r(){window.clearTimeout(a),i()}e.addEventListener("seeked",r,{once:!0}),e.currentTime=t})}function wM(e,t){let n=document.createElement("canvas");n.width=Math.min(t,e.videoWidth),n.height=Math.round(n.width*e.videoHeight/Math.max(1,e.videoWidth));let i=n.getContext("2d");return!i||!n.width?null:(i.drawImage(e,0,0,n.width,n.height),n)}async function d2(e,t,n=1e4){try{await f2(e,t,n);let i=wM(e,160);return i?i.toDataURL("image/jpeg",.8):null}catch{return null}}function p2(e){let{busy:t,onFrame:n}=e,i=(0,at.useRef)(null),s=(0,at.useRef)(null),a=(0,at.useRef)(null),r=(0,at.useRef)(!1),o=(0,at.useRef)(0),[l,c]=(0,at.useState)(null),[h,p]=(0,at.useState)(0),[u,d]=(0,at.useState)(0),[g,S]=(0,at.useState)([]),[m,f]=(0,at.useState)(!1),[_,b]=(0,at.useState)(!1),[v,T]=(0,at.useState)(null);(0,at.useEffect)(()=>()=>{o.current++,a.current&&URL.revokeObjectURL(a.current)},[]);let A=(0,at.useCallback)(async M=>{if(!M)return;if(T(null),!M.type.startsWith("video/")){T("choose a video \u2014 mp4, mov, or webm");return}if(M.size>150*1024*1024){T("choose a clip under 150mb");return}f(!0);let R=++o.current,D=URL.createObjectURL(M),I=()=>o.current!==R;try{let z=document.createElement("video");if(z.preload="auto",z.muted=!0,z.playsInline=!0,await new Promise((G,V)=>{let K=window.setTimeout(()=>V(new Error("that clip took too long to read")),2e4);z.onloadeddata=()=>{window.clearTimeout(K),G()},z.onerror=()=>{window.clearTimeout(K),V(new Error("can't decode that video \u2014 try an h.264 mp4"))},z.src=D}),!Number.isFinite(z.duration)||z.duration<=0||z.duration>120)throw new Error("choose a clip under two minutes");if(I()){z.removeAttribute("src"),z.load(),URL.revokeObjectURL(D);return}let q=[],O=Date.now()+15e3;for(let G=0;G<10&&!I();G++){let V=O-Date.now();if(V<=0)break;let K=Math.max(0,Math.min(z.duration-.05,z.duration*G/10)),it=await d2(z,K,V);it&&q.push({src:it,time:K})}if(I()){z.removeAttribute("src"),z.load(),URL.revokeObjectURL(D);return}a.current&&URL.revokeObjectURL(a.current),a.current=D,c(D),p(z.duration),d(z.duration/2),S(q),z.removeAttribute("src"),z.load()}catch(z){URL.revokeObjectURL(D),I()||T(z instanceof Error?z.message:"that video didn't load")}finally{I()||f(!1)}},[]),w=(0,at.useCallback)(M=>{d(M);let R=s.current;R&&(R.pause(),r.current=!0,R.currentTime=M)},[]),y=(0,at.useCallback)(async()=>{let M=s.current;if(!(!M||_||t)){b(!0);try{(r.current||M.readyState<2||Math.abs(M.currentTime-u)>.001)&&await new Promise((I,z)=>{let q=window.setTimeout(()=>{M.removeEventListener("seeked",O),z(new Error("couldn't read that frame"))},1e4),O=()=>{window.clearTimeout(q),I()};M.addEventListener("seeked",O,{once:!0}),r.current||(M.currentTime=u)});let R=Math.min(1920,M.videoWidth),D=null;for(;R>0;){let I=wM(M,R);if(!I)throw new Error("frame capture isn't available");if(D=await new Promise(z=>I.toBlob(q=>z(q),"image/jpeg",.94)),!D)throw new Error("frame capture isn't available");if(D.size<=TM||R<=320)break;R=Math.floor(R*.75)}if(!D||D.size>TM)throw new Error("that frame is too large \u2014 try a smaller clip");n(new File([D],"freeze-frame.jpg",{type:"image/jpeg"}))}catch(R){T(R instanceof Error?R.message:"couldn't capture the frame")}finally{b(!1)}}},[u,_,t,n]);return(0,j.jsxs)("div",{className:"fz-framepick",children:[(0,j.jsx)("input",{ref:i,type:"file",accept:"video/*",hidden:!0,onChange:M=>void A(M.target.files?.[0]??null)}),l?(0,j.jsxs)(j.Fragment,{children:[(0,j.jsx)("video",{ref:s,className:"fz-video",src:l,muted:!0,playsInline:!0,preload:"auto",onLoadedData:M=>{r.current=!0,M.currentTarget.currentTime=u},onSeeked:()=>{r.current=!1}}),g.length>0&&(0,j.jsx)("div",{className:"fz-strip",children:g.map((M,R)=>(0,j.jsx)("img",{src:M.src,alt:"",onClick:()=>w(M.time)},R))}),(0,j.jsx)("input",{type:"range",className:"fz-scrub",min:0,max:Math.max(EM,h),step:EM,value:u,onChange:M=>w(Number(M.target.value)),"aria-label":"pick the frame"}),(0,j.jsxs)("div",{className:"fz-row",children:[(0,j.jsx)("button",{type:"button",className:"fz-ghost",disabled:m,onClick:()=>i.current?.click(),children:"different clip"}),(0,j.jsx)("button",{type:"button",className:"fz-primary",disabled:_||t,onClick:()=>void y(),children:_?"capturing\u2026":`freeze at ${u.toFixed(2)}s`})]})]}):(0,j.jsxs)("div",{className:"fz-video-empty",children:[(0,j.jsx)("p",{className:"fz-sub",children:"pick the clip \u2014 then scrub to the moment to freeze"}),(0,j.jsx)("button",{type:"button",className:"fz-primary",disabled:m,onClick:()=>i.current?.click(),children:m?"reading the clip\u2026":"choose a video"})]}),v&&(0,j.jsx)("p",{className:"fz-err",children:v})]})}function gd(e,t,n){let i=t/2,s=n*.46,a=t*.36*e.distance,r=n*.11*e.distance,o=e.azimuth*xc;return{x:i+Math.sin(o)*a,y:s+n*.16+Math.cos(o)*r-Math.sin(e.elevation*xc)*n*.3,depth:Math.cos(o)}}var yc=.95,m2=2.3;function _d(e,t){let n=e.azimuth*xc,i=e.elevation*xc,s=m2*e.distance;return t.set(Math.sin(n)*Math.cos(i)*s,yc+Math.sin(i)*s,Math.cos(n)*Math.cos(i)*s),t}function g2(e){let t=new hd({antialias:!0,alpha:!0});t.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),e.appendChild(t.domElement),t.domElement.style.position="absolute",t.domElement.style.inset="0";let n=[],i=O=>(n.push(O),O),s=new Hl,a=new yn(55,1,.05,80);a.position.set(2.9,2.4,4.4),a.lookAt(0,1.05,0);let r=i(new ic(14,28,4612956,2372656));s.add(r);let o=1.7,l=o*.72,c=new Qe(i(new pa(o*1.07,l*1.1)),i(new di({color:858139})));c.position.set(0,yc,0);let h=i(new di({color:4874585})),p=i(new pa(o,l)),u=new Qe(p,h);u.position.set(0,yc,.001);let d=new po(i(new Jl(p)),i(new da({color:8366235})));d.position.copy(u.position),s.add(c,u,d);let g=i(new di({color:9426109})),S=null,m=new Hi;s.add(m);let f=i(new _o(.066,16,12)),_=i(new di({color:9426109})),b=i(new di({color:15791604})),v=i(new di({color:16765286,transparent:!0})),T=new Hi;T.add(new Qe(i(new _o(.1,18,14)),v));let A=new Qe(i(new Zl(.062,.22,12)),v);A.rotation.x=Math.PI/2,A.position.z=.18,T.add(A),s.add(T);let w=i(new on().setFromPoints([new L,new L(0,yc,0)])),y=new fo(w,i(new $l({color:16765286,dashSize:.09,gapSize:.09,transparent:!0,opacity:.45})));y.computeLineDistances(),s.add(y);let M=new L,R=new L(0,yc,0),D=[],I=()=>{let O=e.clientWidth,G=e.clientHeight;if(O===0||G===0)return;let V=new Ut;t.getSize(V),(V.x!==O||V.y!==G)&&(t.setSize(O,G,!1),a.aspect=O/G,a.updateProjectionMatrix()),t.render(s,a)},z=new ResizeObserver(I);z.observe(e);let q=null;return{setImage(O){if(q?.dispose(),O){let G=new xn(O);G.colorSpace=Tn,G.needsUpdate=!0,q=G,h.map=G,h.color.set(16777215)}else q=null,h.map=null,h.color.set(4874585);h.needsUpdate=!0,I()},update(O,G,V){D=O;let K=[];for(let ht=0;ht<=96;ht++){let ft=_d(bc(O,ht/96),new L),_t=K[K.length-1];_t&&ft.distanceToSquared(_t)<1e-8||K.push(ft)}if(K.length>=2){let ht=new go(K),ft=new Ql(ht,120,.026,8,!1),_t=new Qe(ft,g);S&&(s.remove(S),S.geometry.dispose()),S=_t,s.add(S)}else S&&(s.remove(S),S.geometry.dispose(),S=null);m.clear(),O.forEach((ht,ft)=>{let _t=new Qe(f,ft===V?b:_);_t.position.copy(_d(ht,M)),ft===V&&_t.scale.setScalar(1.3),_t.userData.index=ft,m.add(_t)});let it=bc(O,G);T.position.copy(_d(it,M)),T.lookAt(R),v.opacity=Math.cos(it.azimuth*xc)<-.05?.45:1,w.setFromPoints([T.position.clone(),R.clone()]),y.computeLineDistances(),I()},pick(O,G){let V=e.clientWidth,K=e.clientHeight,it=null,ht=30;return D.forEach((ft,_t)=>{_d(ft,M).project(a);let Jt=(M.x*.5+.5)*V,ue=(-M.y*.5+.5)*K,Wt=Math.hypot(Jt-O,ue-G);Wt<ht&&(ht=Wt,it=_t)}),it},dispose(){z.disconnect(),q?.dispose(),n.forEach(O=>O.dispose()),S?.geometry.dispose(),t.dispose(),t.domElement.remove()}}}var vd=14;function _2(e){let t=(0,at.useRef)(null),n=(0,at.useRef)(null),[i,s]=(0,at.useState)(!1),a=(0,at.useRef)(null),r=(0,at.useRef)(e);return r.current=e,(0,at.useEffect)(()=>{let o=t.current;if(!o||r.current.lite)return;let l=null;try{l=g2(o)}catch{return}return n.current=l,s(!0),()=>{n.current=null,l.dispose()}},[]),(0,at.useEffect)(()=>{n.current?.setImage(e.image)},[i,e.image]),(0,at.useEffect)(()=>{n.current?.update(e.keyframes,e.scrubT,e.selected)}),(0,j.jsx)("div",{ref:t,className:"fz-stage-canvas",onPointerDown:o=>{if(!i)return;o.currentTarget.setPointerCapture(o.pointerId);let l=o.currentTarget.getBoundingClientRect(),c=n.current?.pick(o.clientX-l.left,o.clientY-l.top)??null;c!==null&&r.current.onPick(c);let h=c!==null&&(r.current.keyframes[c]?.time===0||r.current.keyframes[c]?.time===1);a.current={mode:r.current.mode==="draw"?"draw":c===null||h?"none":"edit",picked:c,moved:!1,lastX:o.clientX,lastY:o.clientY,az:0,el:0,travel:0,samples:[{azimuth:0,elevation:0}]}},onPointerMove:o=>{let l=a.current;if(!l||!i)return;let c=o.clientX-l.lastX,h=o.clientY-l.lastY;if(!(Math.abs(c)+Math.abs(h)<.5)){if(l.lastX=o.clientX,l.lastY=o.clientY,l.moved=!0,l.mode==="edit"){r.current.onDragPose(c*.6,-h*.4,l.picked);return}l.mode!=="none"&&(l.travel+=Math.abs(c)+Math.abs(h),l.az=Ai(l.az+c*.6,-360,360),l.el=Ai(l.el-h*.4,-90,90),l.samples.length<600?l.samples.push({azimuth:l.az,elevation:l.el}):l.samples[l.samples.length-1]={azimuth:l.az,elevation:l.el},l.travel>=vd&&l.samples.length>=2&&(l.samples.length<4||l.samples.length%4===0)&&r.current.onDrawPath(l.samples))}},onPointerUp:()=>{let o=a.current;if(a.current=null,!(!o||!i)){if(!o.moved){r.current.onPick(o.picked);return}o.mode==="draw"&&o.travel>=vd&&o.samples.length>=2&&r.current.onDrawPath(o.samples)}},children:!i&&(0,j.jsx)(v2,{...e})})}function v2(e){let t=(0,at.useRef)(null),n=(0,at.useRef)(null),i=(0,at.useCallback)(()=>{let s=t.current,a=s?.getContext("2d");if(!s||!a)return;let r=Math.min(2,window.devicePixelRatio||1),o=s.clientWidth,l=s.clientHeight;(s.width!==o*r||s.height!==l*r)&&(s.width=o*r,s.height=l*r),a.setTransform(r,0,0,r,0,0),a.clearRect(0,0,o,l),a.strokeStyle="rgba(160,196,182,0.10)",a.lineWidth=1;let c=l*.62;for(let v=0;v<=12;v++){let T=c+Math.pow(v/12,1.6)*(l-c);a.beginPath(),a.moveTo(0,T),a.lineTo(o,T),a.stroke()}for(let v=-8;v<=8;v++)a.beginPath(),a.moveTo(o/2+v*o*.07,c),a.lineTo(o/2+v*o*.22,l),a.stroke();let h=o/2,p=l*.46,u=o*.36,d=l*.11;a.strokeStyle="rgba(159,216,197,0.22)",a.setLineDash([4,6]),a.beginPath(),a.ellipse(h,p+l*.16,u,d,0,0,Math.PI*2),a.stroke(),a.setLineDash([]);let g=e.keyframes;if(g.length>=2){a.strokeStyle="rgba(143,212,189,0.9)",a.lineWidth=3,a.lineCap="round",a.beginPath();let v=96;for(let T=0;T<=v;T++){let A=gd(bc(g,T/v),o,l);T===0?a.moveTo(A.x,A.y):a.lineTo(A.x,A.y)}a.stroke()}let S=Math.min(o*.4,l*.4*(4/3)),m=S*.72;if(a.save(),a.shadowColor="rgba(0,0,0,0.6)",a.shadowBlur=24,a.fillStyle="#0d181b",a.fillRect(h-S/2,p-m/2,S,m),a.restore(),e.image){let v=e.image,T=Math.min(S/v.width,m/v.height),A=v.width*T,w=v.height*T;a.drawImage(v,h-A/2,p-w/2,A,w)}else a.fillStyle="rgba(214,233,226,0.5)",a.font="13px ui-monospace, monospace",a.textAlign="center",a.fillText("no photo",h,p);a.strokeStyle="rgba(159,216,197,0.45)",a.strokeRect(h-S/2,p-m/2,S,m),g.forEach((v,T)=>{let A=gd(v,o,l);a.beginPath(),a.arc(A.x,A.y,T===e.selected?7:5,0,Math.PI*2),a.fillStyle=T===e.selected?"#f0f5f4":"#8fd4bd",a.fill(),T===e.selected&&(a.strokeStyle="rgba(143,212,189,0.6)",a.lineWidth=2,a.stroke())});let f=bc(g,e.scrubT),_=gd(f,o,l),b=_.depth<-.05;a.globalAlpha=b?.45:1,a.beginPath(),a.arc(_.x,_.y,13,0,Math.PI*2),a.fillStyle="#ffd166",a.fill(),a.beginPath(),a.arc(_.x,_.y,5,0,Math.PI*2),a.fillStyle="#0a1120",a.fill(),a.strokeStyle="rgba(255,209,102,0.35)",a.setLineDash([3,5]),a.beginPath(),a.moveTo(_.x,_.y),a.lineTo(h,p),a.stroke(),a.setLineDash([]),a.globalAlpha=1},[e.image,e.keyframes,e.scrubT,e.selected]);return(0,at.useEffect)(()=>{i()},[i]),(0,at.useEffect)(()=>{let s=()=>i();return window.addEventListener("resize",s),()=>window.removeEventListener("resize",s)},[i]),(0,j.jsx)("canvas",{ref:t,className:"fz-stage-canvas",onPointerDown:s=>{s.currentTarget.setPointerCapture(s.pointerId);let a=s.currentTarget.getBoundingClientRect(),r=s.clientX-a.left,o=s.clientY-a.top,l=e.keyframes.findIndex(h=>{let p=gd(h,a.width,a.height);return Math.hypot(p.x-r,p.y-o)<20});l>=0&&e.onPick(l);let c=l>=0&&(e.keyframes[l]?.time===0||e.keyframes[l]?.time===1);n.current={mode:e.mode==="draw"?"draw":l<0||c?"none":"edit",picked:l>=0?l:null,moved:!1,lastX:s.clientX,lastY:s.clientY,az:0,el:0,travel:0,samples:[{azimuth:0,elevation:0}]}},onPointerMove:s=>{let a=n.current;if(!a)return;let r=s.clientX-a.lastX,o=s.clientY-a.lastY;if(!(Math.abs(r)+Math.abs(o)<.5)){if(a.lastX=s.clientX,a.lastY=s.clientY,a.moved=!0,a.mode==="edit"){e.onDragPose(r*.6,-o*.4,a.picked);return}a.mode!=="none"&&(a.travel+=Math.abs(r)+Math.abs(o),a.az=Ai(a.az+r*.6,-360,360),a.el=Ai(a.el-o*.4,-90,90),a.samples.length<600?a.samples.push({azimuth:a.az,elevation:a.el}):a.samples[a.samples.length-1]={azimuth:a.az,elevation:a.el},a.travel>=vd&&a.samples.length>=2&&(a.samples.length<4||a.samples.length%4===0)&&e.onDrawPath(a.samples))}},onPointerUp:()=>{let s=n.current;if(n.current=null,!!s){if(!s.moved){e.onPick(s.picked);return}s.mode==="draw"&&s.travel>=vd&&s.samples.length>=2&&e.onDrawPath(s.samples)}}})}function y2({kind:e}){let t={orbit:"M50 43a34 13 0 1 1 1 0l-5-4m5 4-5 3","orbit-left":"M50 43a34 13 0 1 0-1 0l5-4m-5 4 5 3",swing:"M50 43Q84 44 84 30Q82 20 67 19",rise:"M50 43Q88 43 77 18Q68 4 50 7","arc-return":"M50 43Q84 44 84 30Q82 20 67 19M67 23Q78 24 79 30Q79 39 50 39l5-4m-5 4 5 3","rise-return":"M46 43V10l-4 5m4-5 4 5M56 10v33l-4-5m4 5 4-5","arc-left-return":"M50 43Q16 44 16 30Q18 20 33 19M33 23Q22 24 21 30Q21 39 50 39l-5-4m5 4-5 3","wide-return":"M50 43C5 43 5 17 50 17C90 17 90 39 50 39l5-4m-5 4 5 3","dip-return":"M46 16v32l-4-5m4 5 4-5M56 48V16l-4 5m4-5 4 5","high-arc-return":"M50 43Q84 30 72 8M72 8Q76 30 50 39l5-5","low-arc-return":"M50 24Q16 30 28 49M28 49Q24 30 50 28l-5-4","sway-return":"M50 43Q16 43 16 30Q50 8 84 30Q84 43 50 43l5-4m-5 4 5 3",halo:"M50 43C96 43 91 5 50 5C9 5 4 43 50 43l-5-4m5 4-5 3","halo-left":"M50 43C4 43 9 5 50 5C91 5 96 43 50 43l5-4m-5 4 5 3","arc-left":"M50 43Q16 44 16 30Q18 20 33 19","low-angle":"M50 20Q85 20 78 48l-5-4m5 4 3-5"};return(0,j.jsxs)("svg",{className:"fz-path",viewBox:"0 0 100 56","aria-hidden":"true",children:[(0,j.jsx)("ellipse",{cx:"50",cy:"30",rx:"34",ry:"13",className:"fz-path-guide"}),(0,j.jsx)("path",{d:"M50 13v25M43 33l7 5 7-5",className:"fz-path-axis"}),(0,j.jsx)("circle",{cx:"50",cy:"29",r:"4",className:"fz-path-subject"}),(0,j.jsx)("path",{className:"fz-path-motion",d:t[e]??t.orbit}),(0,j.jsx)("circle",{cx:"50",cy:"43",r:"3",className:"fz-path-camera"})]})}function x2(e){let[t,n]=(0,at.useState)(e.initial.sourceAssetId?"camera":"source"),[i,s]=(0,at.useState)(e.initial.sourceUrl),[a,r]=(0,at.useState)(e.initial.sourceAssetId),[o,l]=(0,at.useState)(e.initial.renders),[c,h]=(0,at.useState)(e.initial.activeJob),[p,u]=(0,at.useState)(e.initial.latest),[d,g]=(0,at.useState)(!1),[S,m]=(0,at.useState)(null),[f,_]=(0,at.useState)(!1),[b,v]=(0,at.useState)(!1),[T,A]=(0,at.useState)(!1),[w,y]=(0,at.useState)(null),[M,R]=(0,at.useState)([U0,{time:.5,azimuth:65,elevation:8,distance:1},c2]),[D,I]=(0,at.useState)(0),[z,q]=(0,at.useState)(null),[O,G]=(0,at.useState)("draw"),[V,K]=(0,at.useState)(null),[it,ht]=(0,at.useState)(5),[ft,_t]=(0,at.useState)("768P"),[Jt]=(0,at.useState)(()=>Math.floor(Math.random()*1e6)),ue=(0,at.useRef)(null),[,Wt]=(0,at.useState)(0),tt=(0,at.useRef)(null),mt=(0,at.useRef)(null),ot=(0,at.useRef)(0),Nt=(0,at.useRef)(e.initial.sourceAssetId),It=(0,at.useRef)(null),Rt=(0,at.useCallback)(N=>{let W=It.current;W&&W!==N&&(URL.revokeObjectURL(W),It.current=null),N.startsWith("blob:")&&(It.current=N),s(N)},[]),we=(0,at.useCallback)(()=>{It.current&&(URL.revokeObjectURL(It.current),It.current=null),s(null)},[]);(0,at.useEffect)(()=>()=>{It.current&&URL.revokeObjectURL(It.current)},[]);let zt=(0,at.useCallback)((N,W=!1)=>{if(typeof N.latest=="number"&&u(N.latest),h(N.activeJob??null),N.line&&m(N.line),N.sourceUrl&&(W||N.sourceAssetId!==Nt.current)&&Rt(N.sourceUrl),N.sourceAssetId&&(Nt.current=N.sourceAssetId,r(N.sourceAssetId)),N.renders&&l(N.renders),w&&!N.activeJob){let lt=(w.kind==="render"?N.renders:N.sketches)?.find(rt=>rt.jobId===w.id);lt&&(lt.state==="delivered"||lt.state==="failed")&&(y(null),lt.state==="delivered"?w.kind==="render"?(m(null),n("result")):(_(!1),m("still delivered \u2014 set the camera move"),n("camera")):m(lt.error??"that didn't come out \u2014 try again?"))}},[w,Rt]),re=(0,at.useRef)(0),Vt=(0,at.useCallback)(async()=>{let N=++re.current,W=await Eo({action:"status",after:String(p)});if(!(!W||N!==re.current))return zt(W),W},[p,zt]),Kt=(0,at.useCallback)(async N=>{for(let W=0;W<10;W++){if(Nt.current!==N)return;let nt=await Vt();if(Nt.current!==N)return;if(nt&&nt.sourceAssetId===N&&(zt(nt,!0),nt.sourceUrl)){m(null);return}await new Promise(lt=>setTimeout(lt,1200))}Nt.current===N&&m("still converting \u2014 back out and re-upload if it stalls")},[Vt,zt]),be=(0,at.useCallback)(()=>{let N=Date.now();N-ot.current<3e4||(ot.current=N,Vt().then(W=>{W&&zt(W,!0)}))},[Vt,zt]),Ne=(0,at.useRef)(0);(0,at.useEffect)(()=>{let N=++Ne.current;if(!i){ue.current=null,Wt(nt=>nt+1);return}let W=new Image;W.crossOrigin="anonymous",W.onload=()=>{N===Ne.current&&(ue.current=W,Wt(nt=>nt+1))},W.onerror=()=>{N===Ne.current&&be()},W.src=i},[i,be]),(0,at.useEffect)(()=>{if(!c)return;let N=!1,W=window.setInterval(()=>{N||(N=!0,Vt().finally(()=>{N=!1}))},2500);return()=>window.clearInterval(W)},[c,Vt]);let Ue=(N,W)=>m(N?.line??W),Ve=(0,at.useCallback)(async N=>{if(!N||d)return;g(!0),m("reading the photo\u2026");let nt=N.type.startsWith("image/")&&!/hei[cf]/i.test(N.type)?URL.createObjectURL(N):null,lt=new FormData;lt.set("action","source"),lt.set("file",N);let rt=await Eo(lt);if(g(!1),!rt||rt.error||rt.sourceAssetId===void 0){nt&&URL.revokeObjectURL(nt),Ue(rt,"that photo didn't come through \u2014 try another.");return}m(null),r(rt.sourceAssetId),_(!1),v(!1),Nt.current=rt.sourceAssetId,rt.sourceUrl?(nt&&URL.revokeObjectURL(nt),Rt(rt.sourceUrl)):nt?Rt(nt):(we(),m("converting the photo\u2026")),n("camera"),Vt(),!rt.sourceUrl&&!nt&&rt.sourceAssetId&&Kt(rt.sourceAssetId)},[d,Vt,Rt,we,Kt]),Ce=(0,at.useCallback)(async(N,W,nt)=>{if(d)return;g(!0),m("generating the still \u2014 about a minute");let lt=new FormData;lt.set("action","source"),lt.set("kind","sketch"),lt.set("prompt",W),lt.set("mode",nt),N&&lt.set("canvas",N,"sketch.png");let rt=await Eo(lt);if(g(!1),!rt||rt.error||!rt.jobId){Ue(rt,"that didn't work \u2014 try again?");return}y({id:rt.jobId,kind:"sketch"}),zt(rt),m("generating the still \u2014 about a minute")},[d,zt]),Oe=(0,at.useCallback)(N=>{K(N.id),ht(N.duration===6?6:5),R(N.trajectory.map(W=>({...W}))),q(null),I(0)},[]),P=(0,at.useCallback)(()=>{R(N=>{if(N.length>=pd)return N;let W=Ai(D,.02,.98);if(N.some(rt=>Math.abs(rt.time-W)<.01))return N;let nt=bc(N,W);return[...N,{...nt,time:W}].sort((rt,At)=>rt.time-At.time).map(rt=>({...rt}))}),K(null)},[D]),pn=(0,at.useCallback)(()=>{R(N=>{if(z===null||N.length<=2)return N;let W=N[z];return!W||W.time===0||W.time===1?N:N.filter((nt,lt)=>lt!==z)}),q(null),K(null)},[z]),ie=(0,at.useCallback)((N,W,nt)=>{A(!0),K(null),R(lt=>{let rt=nt??z;if(rt===null){let ut=1/0;lt.forEach(($,gt)=>{let vt=Math.abs($.time-D);vt<ut&&(ut=vt,rt=gt)})}if(rt===null)return lt;let At=lt[rt];if(!At||At.time===0||At.time===1)return lt;let U=lt.map((ut,$)=>$===rt?{...ut,azimuth:Ai(ut.azimuth+N,-360,360),elevation:Ai(ut.elevation+W,-90,90)}:ut);return q(rt),U})},[z,D]),C=(0,at.useCallback)(N=>{if(N.length===0)return;let W=Math.min(N.length,pd-1),nt=[{...U0}];for(let At=0;At<W-1;At++){let U=Math.floor(At*(N.length-1)/Math.max(1,W-1)),ut=N[Math.min(U,N.length-1)];nt.push({time:Number(((At+1)/W).toFixed(4)),azimuth:Math.round(ut.azimuth*10)/10,elevation:Math.round(ut.elevation*10)/10,distance:1})}let lt=N[N.length-1];nt.push({time:1,azimuth:Math.round(lt.azimuth*10)/10,elevation:Math.round(lt.elevation*10)/10,distance:1});let rt=[];for(let At of nt){let U=rt[rt.length-1];U&&Math.abs(At.azimuth-U.azimuth)<.05&&Math.abs(At.elevation-U.elevation)<.05?rt[rt.length-1]={...U,time:rt.length===1?U.time:At.time}:rt.push(At)}rt.length<2||(A(!0),K(null),q(null),R(rt),I(1))},[]),x=(0,at.useCallback)((N,W)=>{K(null),A(!0),R(nt=>nt.map((lt,rt)=>rt!==N||lt.time===0||lt.time===1?lt:{...lt,...W.azimuth!==void 0?{azimuth:Ai(W.azimuth,-360,360)}:{},...W.elevation!==void 0?{elevation:Ai(W.elevation,-90,90)}:{}}))},[]),F=(0,at.useCallback)(async()=>{if(d||!a||!i)return;g(!0),m("rendering the freeze \u2014 a few minutes");let N={action:"render",duration:String(it),resolution:ft,seed:String(Jt)};V?N.preset=V:N.trajectory=JSON.stringify(M);let W=await Eo(N);if(g(!1),!W||W.error||!W.jobId){Ue(W,"that render didn't start \u2014 try again?");return}y({id:W.jobId,kind:"render"}),zt(W),m("freezing \u2014 a few minutes")},[d,a,i,V,ft,Jt,M,it,zt]),X=(0,at.useCallback)(async N=>{if(d)return;g(!0),m("sending to iMessage\u2026");let W=await Eo({action:"save",job:N});if(g(!1),!W||W.error){Ue(W,"couldn't send it \u2014 try again");return}W.downloadUrl?(window.open(W.downloadUrl,"_blank","noopener"),m("sent the link \u2014 it's only good for a little while")):m("sent to iMessage")},[d]),J=(0,at.useCallback)(async()=>{await Eo({action:"cancel"}),y(null),m(null),await Vt()},[Vt]),ct=(0,at.useMemo)(()=>o.filter(N=>N.state==="delivered"&&N.outputUrl),[o]),pt=ct[ct.length-1],Z=z!==null&&z<M.length?z:null;if(Z===null){let N=1/0;M.forEach((W,nt)=>{if(W.time===0||W.time===1)return;let lt=Math.abs(W.time-D);lt<N&&(N=lt,Z=nt)})}let Q=Z!==null?M[Z]:void 0,dt=!!Q&&Q.time!==0&&Q.time!==1;return(0,j.jsxs)("div",{className:"fz",children:[(0,j.jsx)("div",{className:"fz-tabs",children:["source","camera","result"].map(N=>(0,j.jsx)("button",{type:"button",className:t===N?"active":"",disabled:N==="camera"&&!a||N==="result"&&ct.length===0,onClick:()=>n(N),children:N==="source"?"1 \xB7 photo":N==="camera"?"2 \xB7 camera":"3 \xB7 freeze"},N))}),c&&(0,j.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>void J(),children:"cancel the running job"}),t==="source"&&(0,j.jsx)("div",{className:"fz-stage",children:!f&&!b?(0,j.jsxs)(j.Fragment,{children:[(0,j.jsxs)("div",{className:"fz-hero",children:[(0,j.jsx)("p",{className:"fz-title",children:"freeze the scene"}),(0,j.jsx)("p",{className:"fz-sub",children:"pick the still \u2014 the camera moves, the moment doesn\u2019t"})]}),(0,j.jsxs)("div",{className:"fz-source-grid",children:[(0,j.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>mt.current?.click(),children:[(0,j.jsx)("span",{className:"fz-card-icon",children:"\u25C9"}),"take a photo"]}),(0,j.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>tt.current?.click(),children:[(0,j.jsx)("span",{className:"fz-card-icon",children:"\u25A4"}),"upload a photo"]}),(0,j.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>_(!0),children:[(0,j.jsx)("span",{className:"fz-card-icon",children:"\u270E"}),"sketch + generate"]}),(0,j.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>v(!0),children:[(0,j.jsx)("span",{className:"fz-card-icon",children:"\u25B6"}),"video \u2192 freeze a frame"]})]}),(0,j.jsx)("input",{ref:mt,type:"file",accept:"image/*,.heic,.heif",capture:"environment",hidden:!0,onChange:N=>void Ve(N.target.files?.[0]??null)}),(0,j.jsx)("input",{ref:tt,type:"file",accept:"image/*,.heic,.heif",hidden:!0,onChange:N=>void Ve(N.target.files?.[0]??null)}),ct.length>0&&(0,j.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>n("result"),children:"see your freezes \u2192"})]}):f?(0,j.jsxs)(j.Fragment,{children:[(0,j.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>_(!1),children:"\u2190 back"}),(0,j.jsx)(h2,{busy:d||w?.kind==="sketch",onGenerate:Ce})]}):(0,j.jsxs)(j.Fragment,{children:[(0,j.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>v(!1),children:"\u2190 back"}),(0,j.jsx)(p2,{busy:d,onFrame:N=>void Ve(N)})]})}),t==="camera"&&(0,j.jsxs)("div",{className:"fz-stage fz-cam",children:[(0,j.jsxs)("div",{className:"fz-stage-wrap",children:[(0,j.jsx)(_2,{image:ue.current,keyframes:M,scrubT:D,selected:z,lite:e.initial.lite,mode:O,onDragPose:ie,onDrawPath:C,onPick:q}),!T&&(0,j.jsxs)("div",{className:"fz-stage-hint",children:[(0,j.jsx)("span",{className:"fz-stage-dot"}),O==="draw"?"drag to draw the camera path":"drag a dot to move it"]})]}),(0,j.jsxs)("div",{className:"fz-modebar",role:"group","aria-label":"stage gesture",children:[(0,j.jsx)("span",{className:"fz-ctl-label",children:"stage"}),(0,j.jsxs)("div",{className:"fz-seg",children:[(0,j.jsx)("button",{type:"button",className:O==="draw"?"active":"","aria-pressed":O==="draw",onClick:()=>G("draw"),children:"draw path"}),(0,j.jsx)("button",{type:"button",className:O==="edit"?"active":"","aria-pressed":O==="edit",onClick:()=>G("edit"),children:"move dot"})]})]}),(0,j.jsx)("div",{className:"fz-ctl-label",children:"camera move"}),(0,j.jsx)("div",{className:"fz-prail",children:e.initial.presets.map(N=>(0,j.jsxs)("button",{type:"button",className:`fz-preset${V===N.id?" active":""}`,title:N.description,"aria-pressed":V===N.id,onClick:()=>Oe(N),children:[(0,j.jsx)(y2,{kind:N.id}),(0,j.jsx)("span",{className:"fz-preset-name",children:N.name}),(0,j.jsx)("span",{className:"fz-preset-return",children:N.returnsToStart?"returns to start":"new angle"})]},N.id))}),(0,j.jsxs)("div",{className:"fz-timeline",children:[(0,j.jsxs)("div",{className:"fz-timeline-meta",children:[(0,j.jsxs)("span",{children:[(D*it).toFixed(2),"s / ",it,"s"]}),(0,j.jsxs)("span",{children:[M.length," keyframes",V?` \xB7 ${e.initial.presets.find(N=>N.id===V)?.name??V}`:" \xB7 drawn",z!==null&&(M[z].time===0||M[z].time===1?" \xB7 endpoint":` \xB7 kf ${z+1}`)]})]}),(0,j.jsxs)("div",{className:"fz-track",onPointerDown:N=>{let W=N.currentTarget.getBoundingClientRect();I(Ai((N.clientX-W.left)/W.width,0,1)),N.currentTarget.setPointerCapture(N.pointerId)},onPointerMove:N=>{if(N.buttons!==1)return;let W=N.currentTarget.getBoundingClientRect();I(Ai((N.clientX-W.left)/W.width,0,1))},children:[(0,j.jsx)("div",{className:"fz-track-ticks"}),M.map((N,W)=>(0,j.jsx)("button",{type:"button",className:`fz-kf${z===W?" selected":""}`,style:{left:`${N.time*100}%`},onPointerDown:nt=>{nt.stopPropagation(),q(W),I(N.time)},onClick:nt=>nt.stopPropagation(),"aria-label":`keyframe ${W+1} at ${Math.round(N.time*100)}%`},W)),(0,j.jsx)("div",{className:"fz-head",style:{left:`${D*100}%`},children:(0,j.jsx)("i",{})})]}),(0,j.jsxs)("div",{className:"fz-timeline-row",children:[(0,j.jsx)("span",{className:"fz-meta",children:z!==null?M[z].time===0||M[z].time===1?"endpoints hold the framing":"move this dot with the sliders or the scene":O==="draw"?"drag the scene to sketch the path":"drag a dot to move it"}),(0,j.jsxs)("div",{className:"fz-timeline-actions",children:[(0,j.jsx)("button",{type:"button",className:"fz-ghost",disabled:M.length>=pd,onClick:P,children:"+ keyframe"}),(0,j.jsx)("button",{type:"button",className:"fz-ghost",disabled:z===null||M[z]?.time===0||M[z]?.time===1,onClick:pn,children:"\u2212 remove"})]})]})]}),(0,j.jsxs)("div",{className:"fz-aim",children:[(0,j.jsx)("div",{className:"fz-ctl-label",children:dt?`aim \u2014 keyframe ${(Z??0)+1}`:"aim \u2014 tap a middle dot on the timeline"}),(0,j.jsxs)("div",{className:"fz-aim-row",children:[(0,j.jsx)("span",{className:"fz-aim-label",children:"orbit"}),(0,j.jsx)("input",{type:"range",min:-360,max:360,step:1,value:Q?.azimuth??0,disabled:!dt,"aria-label":"orbit angle in degrees",onChange:N=>{Z!==null&&x(Z,{azimuth:Number(N.target.value)})}}),(0,j.jsx)("span",{className:"fz-aim-val",children:dt&&Q?`${Math.round(Q.azimuth)}\xB0`:"\u2014"})]}),(0,j.jsxs)("div",{className:"fz-aim-row",children:[(0,j.jsx)("span",{className:"fz-aim-label",children:"height"}),(0,j.jsx)("input",{type:"range",min:-30,max:90,step:1,value:Q?.elevation??0,disabled:!dt,"aria-label":"camera height in degrees",onChange:N=>{Z!==null&&x(Z,{elevation:Number(N.target.value)})}}),(0,j.jsx)("span",{className:"fz-aim-val",children:dt&&Q?`${Math.round(Q.elevation)}\xB0`:"\u2014"})]})]}),(0,j.jsxs)("div",{className:"fz-render-row",children:[(0,j.jsx)("div",{className:"fz-seg",children:[5,6].map(N=>(0,j.jsxs)("button",{type:"button",className:it===N?"active":"",onClick:()=>ht(N),children:[N,"s"]},N))}),(0,j.jsx)("div",{className:"fz-seg",children:["480P","768P","1080P"].map(N=>(0,j.jsx)("button",{type:"button",className:ft===N?"active":"",onClick:()=>_t(N),children:N==="480P"?"480":N==="768P"?"720":"1080"},N))}),(0,j.jsx)("button",{type:"button",className:"fz-primary",disabled:d||!a||!i||w!==null,onClick:()=>void F(),children:w?.kind==="render"||d?"freezing\u2026":"freeze it"})]})]}),t==="result"&&(0,j.jsxs)("div",{className:"fz-stage",children:[pt?(0,j.jsxs)("div",{className:"fz-result",children:[(0,j.jsx)("video",{className:"fz-video",src:pt.outputUrl??void 0,controls:!0,playsInline:!0,loop:!0,autoPlay:!0,muted:!0,onError:be}),(0,j.jsxs)("div",{className:"fz-actions",children:[(0,j.jsx)("button",{type:"button",className:"fz-primary",disabled:d,onClick:()=>void X(pt.jobId),children:"send to iMessage"}),(0,j.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>n("camera"),children:"new camera move"})]})]}):c?(0,j.jsx)("p",{className:"fz-sub",children:"rendering \u2014 this takes a few minutes"}):(0,j.jsx)("p",{className:"fz-sub",children:"nothing rendered yet"}),ct.length>1&&(0,j.jsx)("div",{className:"fz-history",children:ct.slice(0,-1).reverse().map(N=>(0,j.jsxs)("div",{className:"fz-history-row",children:[(0,j.jsx)("video",{className:"fz-thumb",src:N.outputUrl??void 0,muted:!0,playsInline:!0,preload:"metadata",onError:be}),(0,j.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>void X(N.jobId),children:"send"})]},N.jobId))})]}),(0,j.jsx)("p",{className:"fz-line",children:S??""})]})}var b2=`
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
.fz-stage-wrap{position:relative;flex:1;min-height:240px;border-radius:16px;overflow:hidden;background:#0b1011;border:1px solid #2c3c35}
.fz-stage-canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair}
.fz-modebar{display:flex;align-items:center;gap:10px;padding:0 2px}
.fz-modebar .fz-seg{flex:1}
.fz-modebar .fz-seg button{flex:1}
.fz-stage-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;border-radius:20px;padding:8px 12px;background:#0d181bc7;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-size:11px;color:#dbe7e4;pointer-events:none;z-index:2;white-space:nowrap}
.fz-stage-dot{width:5px;height:5px;border-radius:50%;background:#b4dcce;flex:0 0 5px}
.fz-ctl-label{color:#8d9e9c;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;padding:0 2px}
.fz-prail{display:flex;gap:8px;overflow-x:auto;padding:2px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.fz-prail::-webkit-scrollbar{display:none}
.fz-preset{flex:0 0 118px;display:flex;flex-direction:column;gap:3px;padding:10px 10px 9px;border:1px solid #344943;border-radius:14px;background:#1b2925;color:#9fc4b4;text-align:left}
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
.fz-kf{position:absolute;top:50%;width:14px;height:14px;min-width:0;min-height:0;margin:-7px 0 0 -7px;padding:0;border:2px solid #8fd4bd;border-radius:50%;background:#0d181b}
/* The visible dot stays small; the pseudo-element carries the touch target */
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
.fz-row{display:flex;gap:8px;align-items:center}
.fz-err{margin:0;text-align:center;font-size:0.72rem;color:#e8a9a9}
.fz-actions{display:flex;gap:8px;flex-wrap:wrap}
.fz-history{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.fz-history-row{display:flex;align-items:center;gap:10px}
.fz-thumb{width:88px;border-radius:8px;background:#000}
.fz-line{margin:0;min-height:1rem;text-align:center;font-size:0.72rem;color:#83968f}
@media(prefers-reduced-motion:reduce){.fz-card,.fz-primary{transition:none}}
`,N0=document.getElementById("freeze-studio");if(N0){let e=null;try{e=JSON.parse(N0.dataset.payload??"")}catch{e=null}if(e){let t=document.createElement("style");t.textContent=b2,document.head.appendChild(t),(0,AM.createRoot)(N0).render((0,j.jsx)(at.StrictMode,{children:(0,j.jsx)(x2,{initial:e})}))}}})();
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
