"use strict";(()=>{var zM=Object.create;var X0=Object.defineProperty;var BM=Object.getOwnPropertyDescriptor;var FM=Object.getOwnPropertyNames;var VM=Object.getPrototypeOf,HM=Object.prototype.hasOwnProperty;var Ni=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var GM=(e,t,n,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of FM(t))!HM.call(e,s)&&s!==n&&X0(e,s,{get:()=>t[s],enumerable:!(i=BM(t,s))||i.enumerable});return e};var Ac=(e,t,n)=>(n=e!=null?zM(VM(e)):{},GM(t||!e||!e.__esModule?X0(n,"default",{value:e,enumerable:!0}):n,e));var e_=Ni(Gt=>{"use strict";var Ed=Symbol.for("react.transitional.element"),kM=Symbol.for("react.portal"),XM=Symbol.for("react.fragment"),WM=Symbol.for("react.strict_mode"),qM=Symbol.for("react.profiler"),YM=Symbol.for("react.consumer"),ZM=Symbol.for("react.context"),JM=Symbol.for("react.forward_ref"),KM=Symbol.for("react.suspense"),jM=Symbol.for("react.memo"),J0=Symbol.for("react.lazy"),QM=Symbol.for("react.activity"),W0=Symbol.iterator;function $M(e){return e===null||typeof e!="object"?null:(e=W0&&e[W0]||e["@@iterator"],typeof e=="function"?e:null)}var K0={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},j0=Object.assign,Q0={};function lr(e,t,n){this.props=e,this.context=t,this.refs=Q0,this.updater=n||K0}lr.prototype.isReactComponent={};lr.prototype.setState=function(e,t){if(typeof e!="object"&&typeof e!="function"&&e!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,t,"setState")};lr.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};function $0(){}$0.prototype=lr.prototype;function Td(e,t,n){this.props=e,this.context=t,this.refs=Q0,this.updater=n||K0}var Ad=Td.prototype=new $0;Ad.constructor=Td;j0(Ad,lr.prototype);Ad.isPureReactComponent=!0;var q0=Array.isArray;function Md(){}var we={H:null,A:null,T:null,S:null},t_=Object.prototype.hasOwnProperty;function wd(e,t,n){var i=n.ref;return{$$typeof:Ed,type:e,key:t,ref:i!==void 0?i:null,props:n}}function t1(e,t){return wd(e.type,t,e.props)}function Cd(e){return typeof e=="object"&&e!==null&&e.$$typeof===Ed}function e1(e){var t={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,function(n){return t[n]})}var Y0=/\/+/g;function Sd(e,t){return typeof e=="object"&&e!==null&&e.key!=null?e1(""+e.key):t.toString(36)}function n1(e){switch(e.status){case"fulfilled":return e.value;case"rejected":throw e.reason;default:switch(typeof e.status=="string"?e.then(Md,Md):(e.status="pending",e.then(function(t){e.status==="pending"&&(e.status="fulfilled",e.value=t)},function(t){e.status==="pending"&&(e.status="rejected",e.reason=t)})),e.status){case"fulfilled":return e.value;case"rejected":throw e.reason}}throw e}function or(e,t,n,i,s){var a=typeof e;(a==="undefined"||a==="boolean")&&(e=null);var r=!1;if(e===null)r=!0;else switch(a){case"bigint":case"string":case"number":r=!0;break;case"object":switch(e.$$typeof){case Ed:case kM:r=!0;break;case J0:return r=e._init,or(r(e._payload),t,n,i,s)}}if(r)return s=s(e),r=i===""?"."+Sd(e,0):i,q0(s)?(n="",r!=null&&(n=r.replace(Y0,"$&/")+"/"),or(s,t,n,"",function(l){return l})):s!=null&&(Cd(s)&&(s=t1(s,n+(s.key==null||e&&e.key===s.key?"":(""+s.key).replace(Y0,"$&/")+"/")+r)),t.push(s)),1;r=0;var o=i===""?".":i+":";if(q0(e))for(var c=0;c<e.length;c++)i=e[c],a=o+Sd(i,c),r+=or(i,t,n,a,s);else if(c=$M(e),typeof c=="function")for(e=c.call(e),c=0;!(i=e.next()).done;)i=i.value,a=o+Sd(i,c++),r+=or(i,t,n,a,s);else if(a==="object"){if(typeof e.then=="function")return or(n1(e),t,n,i,s);throw t=String(e),Error("Objects are not valid as a React child (found: "+(t==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":t)+"). If you meant to render a collection of children, use an array instead.")}return r}function wc(e,t,n){if(e==null)return e;var i=[],s=0;return or(e,i,"","",function(a){return t.call(n,a,s++)}),i}function i1(e){if(e._status===-1){var t=e._result;t=t(),t.then(function(n){(e._status===0||e._status===-1)&&(e._status=1,e._result=n)},function(n){(e._status===0||e._status===-1)&&(e._status=2,e._result=n)}),e._status===-1&&(e._status=0,e._result=t)}if(e._status===1)return e._result.default;throw e._result}var Z0=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},s1={map:wc,forEach:function(e,t,n){wc(e,function(){t.apply(this,arguments)},n)},count:function(e){var t=0;return wc(e,function(){t++}),t},toArray:function(e){return wc(e,function(t){return t})||[]},only:function(e){if(!Cd(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};Gt.Activity=QM;Gt.Children=s1;Gt.Component=lr;Gt.Fragment=XM;Gt.Profiler=qM;Gt.PureComponent=Td;Gt.StrictMode=WM;Gt.Suspense=KM;Gt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=we;Gt.__COMPILER_RUNTIME={__proto__:null,c:function(e){return we.H.useMemoCache(e)}};Gt.cache=function(e){return function(){return e.apply(null,arguments)}};Gt.cacheSignal=function(){return null};Gt.cloneElement=function(e,t,n){if(e==null)throw Error("The argument must be a React element, but you passed "+e+".");var i=j0({},e.props),s=e.key;if(t!=null)for(a in t.key!==void 0&&(s=""+t.key),t)!t_.call(t,a)||a==="key"||a==="__self"||a==="__source"||a==="ref"&&t.ref===void 0||(i[a]=t[a]);var a=arguments.length-2;if(a===1)i.children=n;else if(1<a){for(var r=Array(a),o=0;o<a;o++)r[o]=arguments[o+2];i.children=r}return wd(e.type,s,i)};Gt.createContext=function(e){return e={$$typeof:ZM,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null},e.Provider=e,e.Consumer={$$typeof:YM,_context:e},e};Gt.createElement=function(e,t,n){var i,s={},a=null;if(t!=null)for(i in t.key!==void 0&&(a=""+t.key),t)t_.call(t,i)&&i!=="key"&&i!=="__self"&&i!=="__source"&&(s[i]=t[i]);var r=arguments.length-2;if(r===1)s.children=n;else if(1<r){for(var o=Array(r),c=0;c<r;c++)o[c]=arguments[c+2];s.children=o}if(e&&e.defaultProps)for(i in r=e.defaultProps,r)s[i]===void 0&&(s[i]=r[i]);return wd(e,a,s)};Gt.createRef=function(){return{current:null}};Gt.forwardRef=function(e){return{$$typeof:JM,render:e}};Gt.isValidElement=Cd;Gt.lazy=function(e){return{$$typeof:J0,_payload:{_status:-1,_result:e},_init:i1}};Gt.memo=function(e,t){return{$$typeof:jM,type:e,compare:t===void 0?null:t}};Gt.startTransition=function(e){var t=we.T,n={};we.T=n;try{var i=e(),s=we.S;s!==null&&s(n,i),typeof i=="object"&&i!==null&&typeof i.then=="function"&&i.then(Md,Z0)}catch(a){Z0(a)}finally{t!==null&&n.types!==null&&(t.types=n.types),we.T=t}};Gt.unstable_useCacheRefresh=function(){return we.H.useCacheRefresh()};Gt.use=function(e){return we.H.use(e)};Gt.useActionState=function(e,t,n){return we.H.useActionState(e,t,n)};Gt.useCallback=function(e,t){return we.H.useCallback(e,t)};Gt.useContext=function(e){return we.H.useContext(e)};Gt.useDebugValue=function(){};Gt.useDeferredValue=function(e,t){return we.H.useDeferredValue(e,t)};Gt.useEffect=function(e,t){return we.H.useEffect(e,t)};Gt.useEffectEvent=function(e){return we.H.useEffectEvent(e)};Gt.useId=function(){return we.H.useId()};Gt.useImperativeHandle=function(e,t,n){return we.H.useImperativeHandle(e,t,n)};Gt.useInsertionEffect=function(e,t){return we.H.useInsertionEffect(e,t)};Gt.useLayoutEffect=function(e,t){return we.H.useLayoutEffect(e,t)};Gt.useMemo=function(e,t){return we.H.useMemo(e,t)};Gt.useOptimistic=function(e,t){return we.H.useOptimistic(e,t)};Gt.useReducer=function(e,t,n){return we.H.useReducer(e,t,n)};Gt.useRef=function(e){return we.H.useRef(e)};Gt.useState=function(e){return we.H.useState(e)};Gt.useSyncExternalStore=function(e,t,n){return we.H.useSyncExternalStore(e,t,n)};Gt.useTransition=function(){return we.H.useTransition()};Gt.version="19.2.8"});var Cc=Ni((T3,n_)=>{"use strict";n_.exports=e_()});var f_=Ni(Le=>{"use strict";function Ud(e,t){var n=e.length;e.push(t);t:for(;0<n;){var i=n-1>>>1,s=e[i];if(0<Rc(s,t))e[i]=t,e[n]=s,n=i;else break t}}function Ui(e){return e.length===0?null:e[0]}function Nc(e){if(e.length===0)return null;var t=e[0],n=e.pop();if(n!==t){e[0]=n;t:for(var i=0,s=e.length,a=s>>>1;i<a;){var r=2*(i+1)-1,o=e[r],c=r+1,l=e[c];if(0>Rc(o,n))c<s&&0>Rc(l,o)?(e[i]=l,e[c]=n,i=c):(e[i]=o,e[r]=n,i=r);else if(c<s&&0>Rc(l,n))e[i]=l,e[c]=n,i=c;else break t}}return t}function Rc(e,t){var n=e.sortIndex-t.sortIndex;return n!==0?n:e.id-t.id}Le.unstable_now=void 0;typeof performance=="object"&&typeof performance.now=="function"?(i_=performance,Le.unstable_now=function(){return i_.now()}):(Rd=Date,s_=Rd.now(),Le.unstable_now=function(){return Rd.now()-s_});var i_,Rd,s_,Qi=[],Ns=[],a1=1,ii=null,gn=3,Ld=!1,Co=!1,Ro=!1,Id=!1,o_=typeof setTimeout=="function"?setTimeout:null,l_=typeof clearTimeout=="function"?clearTimeout:null,a_=typeof setImmediate<"u"?setImmediate:null;function Dc(e){for(var t=Ui(Ns);t!==null;){if(t.callback===null)Nc(Ns);else if(t.startTime<=e)Nc(Ns),t.sortIndex=t.expirationTime,Ud(Qi,t);else break;t=Ui(Ns)}}function Od(e){if(Ro=!1,Dc(e),!Co)if(Ui(Qi)!==null)Co=!0,ur||(ur=!0,cr());else{var t=Ui(Ns);t!==null&&Pd(Od,t.startTime-e)}}var ur=!1,Do=-1,c_=5,u_=-1;function h_(){return Id?!0:!(Le.unstable_now()-u_<c_)}function Dd(){if(Id=!1,ur){var e=Le.unstable_now();u_=e;var t=!0;try{t:{Co=!1,Ro&&(Ro=!1,l_(Do),Do=-1),Ld=!0;var n=gn;try{e:{for(Dc(e),ii=Ui(Qi);ii!==null&&!(ii.expirationTime>e&&h_());){var i=ii.callback;if(typeof i=="function"){ii.callback=null,gn=ii.priorityLevel;var s=i(ii.expirationTime<=e);if(e=Le.unstable_now(),typeof s=="function"){ii.callback=s,Dc(e),t=!0;break e}ii===Ui(Qi)&&Nc(Qi),Dc(e)}else Nc(Qi);ii=Ui(Qi)}if(ii!==null)t=!0;else{var a=Ui(Ns);a!==null&&Pd(Od,a.startTime-e),t=!1}}break t}finally{ii=null,gn=n,Ld=!1}t=void 0}}finally{t?cr():ur=!1}}}var cr;typeof a_=="function"?cr=function(){a_(Dd)}:typeof MessageChannel<"u"?(Nd=new MessageChannel,r_=Nd.port2,Nd.port1.onmessage=Dd,cr=function(){r_.postMessage(null)}):cr=function(){o_(Dd,0)};var Nd,r_;function Pd(e,t){Do=o_(function(){e(Le.unstable_now())},t)}Le.unstable_IdlePriority=5;Le.unstable_ImmediatePriority=1;Le.unstable_LowPriority=4;Le.unstable_NormalPriority=3;Le.unstable_Profiling=null;Le.unstable_UserBlockingPriority=2;Le.unstable_cancelCallback=function(e){e.callback=null};Le.unstable_forceFrameRate=function(e){0>e||125<e?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):c_=0<e?Math.floor(1e3/e):5};Le.unstable_getCurrentPriorityLevel=function(){return gn};Le.unstable_next=function(e){switch(gn){case 1:case 2:case 3:var t=3;break;default:t=gn}var n=gn;gn=t;try{return e()}finally{gn=n}};Le.unstable_requestPaint=function(){Id=!0};Le.unstable_runWithPriority=function(e,t){switch(e){case 1:case 2:case 3:case 4:case 5:break;default:e=3}var n=gn;gn=e;try{return t()}finally{gn=n}};Le.unstable_scheduleCallback=function(e,t,n){var i=Le.unstable_now();switch(typeof n=="object"&&n!==null?(n=n.delay,n=typeof n=="number"&&0<n?i+n:i):n=i,e){case 1:var s=-1;break;case 2:s=250;break;case 5:s=1073741823;break;case 4:s=1e4;break;default:s=5e3}return s=n+s,e={id:a1++,callback:t,priorityLevel:e,startTime:n,expirationTime:s,sortIndex:-1},n>i?(e.sortIndex=n,Ud(Ns,e),Ui(Qi)===null&&e===Ui(Ns)&&(Ro?(l_(Do),Do=-1):Ro=!0,Pd(Od,n-i))):(e.sortIndex=s,Ud(Qi,e),Co||Ld||(Co=!0,ur||(ur=!0,cr()))),e};Le.unstable_shouldYield=h_;Le.unstable_wrapCallback=function(e){var t=gn;return function(){var n=gn;gn=t;try{return e.apply(this,arguments)}finally{gn=n}}}});var p_=Ni((w3,d_)=>{"use strict";d_.exports=f_()});var g_=Ni(Mn=>{"use strict";var r1=Cc();function m_(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function Us(){}var Sn={d:{f:Us,r:function(){throw Error(m_(522))},D:Us,C:Us,L:Us,m:Us,X:Us,S:Us,M:Us},p:0,findDOMNode:null},o1=Symbol.for("react.portal");function l1(e,t,n){var i=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:o1,key:i==null?null:""+i,children:e,containerInfo:t,implementation:n}}var No=r1.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function Uc(e,t){if(e==="font")return"";if(typeof t=="string")return t==="use-credentials"?t:""}Mn.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=Sn;Mn.createPortal=function(e,t){var n=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!t||t.nodeType!==1&&t.nodeType!==9&&t.nodeType!==11)throw Error(m_(299));return l1(e,t,null,n)};Mn.flushSync=function(e){var t=No.T,n=Sn.p;try{if(No.T=null,Sn.p=2,e)return e()}finally{No.T=t,Sn.p=n,Sn.d.f()}};Mn.preconnect=function(e,t){typeof e=="string"&&(t?(t=t.crossOrigin,t=typeof t=="string"?t==="use-credentials"?t:"":void 0):t=null,Sn.d.C(e,t))};Mn.prefetchDNS=function(e){typeof e=="string"&&Sn.d.D(e)};Mn.preinit=function(e,t){if(typeof e=="string"&&t&&typeof t.as=="string"){var n=t.as,i=Uc(n,t.crossOrigin),s=typeof t.integrity=="string"?t.integrity:void 0,a=typeof t.fetchPriority=="string"?t.fetchPriority:void 0;n==="style"?Sn.d.S(e,typeof t.precedence=="string"?t.precedence:void 0,{crossOrigin:i,integrity:s,fetchPriority:a}):n==="script"&&Sn.d.X(e,{crossOrigin:i,integrity:s,fetchPriority:a,nonce:typeof t.nonce=="string"?t.nonce:void 0})}};Mn.preinitModule=function(e,t){if(typeof e=="string")if(typeof t=="object"&&t!==null){if(t.as==null||t.as==="script"){var n=Uc(t.as,t.crossOrigin);Sn.d.M(e,{crossOrigin:n,integrity:typeof t.integrity=="string"?t.integrity:void 0,nonce:typeof t.nonce=="string"?t.nonce:void 0})}}else t==null&&Sn.d.M(e)};Mn.preload=function(e,t){if(typeof e=="string"&&typeof t=="object"&&t!==null&&typeof t.as=="string"){var n=t.as,i=Uc(n,t.crossOrigin);Sn.d.L(e,n,{crossOrigin:i,integrity:typeof t.integrity=="string"?t.integrity:void 0,nonce:typeof t.nonce=="string"?t.nonce:void 0,type:typeof t.type=="string"?t.type:void 0,fetchPriority:typeof t.fetchPriority=="string"?t.fetchPriority:void 0,referrerPolicy:typeof t.referrerPolicy=="string"?t.referrerPolicy:void 0,imageSrcSet:typeof t.imageSrcSet=="string"?t.imageSrcSet:void 0,imageSizes:typeof t.imageSizes=="string"?t.imageSizes:void 0,media:typeof t.media=="string"?t.media:void 0})}};Mn.preloadModule=function(e,t){if(typeof e=="string")if(t){var n=Uc(t.as,t.crossOrigin);Sn.d.m(e,{as:typeof t.as=="string"&&t.as!=="script"?t.as:void 0,crossOrigin:n,integrity:typeof t.integrity=="string"?t.integrity:void 0})}else Sn.d.m(e)};Mn.requestFormReset=function(e){Sn.d.r(e)};Mn.unstable_batchedUpdates=function(e,t){return e(t)};Mn.useFormState=function(e,t,n){return No.H.useFormState(e,t,n)};Mn.useFormStatus=function(){return No.H.useHostTransitionStatus()};Mn.version="19.2.8"});var y_=Ni((R3,v_)=>{"use strict";function __(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(__)}catch(e){console.error(e)}}__(),v_.exports=g_()});var Nb=Ni(ih=>{"use strict";var $e=p_(),Wv=Cc(),c1=y_();function it(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function qv(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function _l(e){var t=e,n=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(n=t.return),e=t.return;while(e)}return t.tag===3?n:null}function Yv(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function Zv(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function x_(e){if(_l(e)!==e)throw Error(it(188))}function u1(e){var t=e.alternate;if(!t){if(t=_l(e),t===null)throw Error(it(188));return t!==e?null:e}for(var n=e,i=t;;){var s=n.return;if(s===null)break;var a=s.alternate;if(a===null){if(i=s.return,i!==null){n=i;continue}break}if(s.child===a.child){for(a=s.child;a;){if(a===n)return x_(s),e;if(a===i)return x_(s),t;a=a.sibling}throw Error(it(188))}if(n.return!==i.return)n=s,i=a;else{for(var r=!1,o=s.child;o;){if(o===n){r=!0,n=s,i=a;break}if(o===i){r=!0,i=s,n=a;break}o=o.sibling}if(!r){for(o=a.child;o;){if(o===n){r=!0,n=a,i=s;break}if(o===i){r=!0,i=a,n=s;break}o=o.sibling}if(!r)throw Error(it(189))}}if(n.alternate!==i)throw Error(it(190))}if(n.tag!==3)throw Error(it(188));return n.stateNode.current===n?e:t}function Jv(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=Jv(e),t!==null)return t;e=e.sibling}return null}var De=Object.assign,h1=Symbol.for("react.element"),Lc=Symbol.for("react.transitional.element"),Fo=Symbol.for("react.portal"),gr=Symbol.for("react.fragment"),Kv=Symbol.for("react.strict_mode"),gp=Symbol.for("react.profiler"),jv=Symbol.for("react.consumer"),rs=Symbol.for("react.context"),hm=Symbol.for("react.forward_ref"),_p=Symbol.for("react.suspense"),vp=Symbol.for("react.suspense_list"),fm=Symbol.for("react.memo"),Ls=Symbol.for("react.lazy");Symbol.for("react.scope");var yp=Symbol.for("react.activity");Symbol.for("react.legacy_hidden");Symbol.for("react.tracing_marker");var f1=Symbol.for("react.memo_cache_sentinel");Symbol.for("react.view_transition");var b_=Symbol.iterator;function Uo(e){return e===null||typeof e!="object"?null:(e=b_&&e[b_]||e["@@iterator"],typeof e=="function"?e:null)}var d1=Symbol.for("react.client.reference");function xp(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===d1?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case gr:return"Fragment";case gp:return"Profiler";case Kv:return"StrictMode";case _p:return"Suspense";case vp:return"SuspenseList";case yp:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case Fo:return"Portal";case rs:return e.displayName||"Context";case jv:return(e._context.displayName||"Context")+".Consumer";case hm:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case fm:return t=e.displayName||null,t!==null?t:xp(e.type)||"Memo";case Ls:t=e._payload,e=e._init;try{return xp(e(t))}catch{}}return null}var Vo=Array.isArray,Bt=Wv.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,le=c1.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,Na={pending:!1,data:null,method:null,action:null},bp=[],_r=-1;function zi(e){return{current:e}}function an(e){0>_r||(e.current=bp[_r],bp[_r]=null,_r--)}function Se(e,t){_r++,bp[_r]=e.current,e.current=t}var Pi=zi(null),il=zi(null),Xs=zi(null),fu=zi(null);function du(e,t){switch(Se(Xs,t),Se(il,e),Se(Pi,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?Cv(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=Cv(t),e=_b(t,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}an(Pi),Se(Pi,e)}function Or(){an(Pi),an(il),an(Xs)}function Sp(e){e.memoizedState!==null&&Se(fu,e);var t=Pi.current,n=_b(t,e.type);t!==n&&(Se(il,e),Se(Pi,n))}function pu(e){il.current===e&&(an(Pi),an(il)),fu.current===e&&(an(fu),pl._currentValue=Na)}var zd,S_;function wa(e){if(zd===void 0)try{throw Error()}catch(n){var t=n.stack.trim().match(/\n( *(at )?)/);zd=t&&t[1]||"",S_=-1<n.stack.indexOf(`
    at`)?" (<anonymous>)":-1<n.stack.indexOf("@")?"@unknown:0:0":""}return`
`+zd+e+S_}var Bd=!1;function Fd(e,t){if(!e||Bd)return"";Bd=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var i={DetermineComponentFrameRoot:function(){try{if(t){var p=function(){throw Error()};if(Object.defineProperty(p.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(p,[])}catch(d){var u=d}Reflect.construct(e,[],p)}else{try{p.call()}catch(d){u=d}e.call(p.prototype)}}else{try{throw Error()}catch(d){u=d}(p=e())&&typeof p.catch=="function"&&p.catch(function(){})}}catch(d){if(d&&u&&typeof d.stack=="string")return[d.stack,u.stack]}return[null,null]}};i.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var s=Object.getOwnPropertyDescriptor(i.DetermineComponentFrameRoot,"name");s&&s.configurable&&Object.defineProperty(i.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var a=i.DetermineComponentFrameRoot(),r=a[0],o=a[1];if(r&&o){var c=r.split(`
`),l=o.split(`
`);for(s=i=0;i<c.length&&!c[i].includes("DetermineComponentFrameRoot");)i++;for(;s<l.length&&!l[s].includes("DetermineComponentFrameRoot");)s++;if(i===c.length||s===l.length)for(i=c.length-1,s=l.length-1;1<=i&&0<=s&&c[i]!==l[s];)s--;for(;1<=i&&0<=s;i--,s--)if(c[i]!==l[s]){if(i!==1||s!==1)do if(i--,s--,0>s||c[i]!==l[s]){var h=`
`+c[i].replace(" at new "," at ");return e.displayName&&h.includes("<anonymous>")&&(h=h.replace("<anonymous>",e.displayName)),h}while(1<=i&&0<=s);break}}}finally{Bd=!1,Error.prepareStackTrace=n}return(n=e?e.displayName||e.name:"")?wa(n):""}function p1(e,t){switch(e.tag){case 26:case 27:case 5:return wa(e.type);case 16:return wa("Lazy");case 13:return e.child!==t&&t!==null?wa("Suspense Fallback"):wa("Suspense");case 19:return wa("SuspenseList");case 0:case 15:return Fd(e.type,!1);case 11:return Fd(e.type.render,!1);case 1:return Fd(e.type,!0);case 31:return wa("Activity");default:return""}}function M_(e){try{var t="",n=null;do t+=p1(e,n),n=e,e=e.return;while(e);return t}catch(i){return`
Error generating stack: `+i.message+`
`+i.stack}}var Mp=Object.prototype.hasOwnProperty,dm=$e.unstable_scheduleCallback,Vd=$e.unstable_cancelCallback,m1=$e.unstable_shouldYield,g1=$e.unstable_requestPaint,Hn=$e.unstable_now,_1=$e.unstable_getCurrentPriorityLevel,Qv=$e.unstable_ImmediatePriority,$v=$e.unstable_UserBlockingPriority,mu=$e.unstable_NormalPriority,v1=$e.unstable_LowPriority,ty=$e.unstable_IdlePriority,y1=$e.log,x1=$e.unstable_setDisableYieldValue,vl=null,Gn=null;function Fs(e){if(typeof y1=="function"&&x1(e),Gn&&typeof Gn.setStrictMode=="function")try{Gn.setStrictMode(vl,e)}catch{}}var kn=Math.clz32?Math.clz32:M1,b1=Math.log,S1=Math.LN2;function M1(e){return e>>>=0,e===0?32:31-(b1(e)/S1|0)|0}var Ic=256,Oc=262144,Pc=4194304;function Ca(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function Hu(e,t,n){var i=e.pendingLanes;if(i===0)return 0;var s=0,a=e.suspendedLanes,r=e.pingedLanes;e=e.warmLanes;var o=i&134217727;return o!==0?(i=o&~a,i!==0?s=Ca(i):(r&=o,r!==0?s=Ca(r):n||(n=o&~e,n!==0&&(s=Ca(n))))):(o=i&~a,o!==0?s=Ca(o):r!==0?s=Ca(r):n||(n=i&~e,n!==0&&(s=Ca(n)))),s===0?0:t!==0&&t!==s&&(t&a)===0&&(a=s&-s,n=t&-t,a>=n||a===32&&(n&4194048)!==0)?t:s}function yl(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function E1(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function ey(){var e=Pc;return Pc<<=1,(Pc&62914560)===0&&(Pc=4194304),e}function Hd(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function xl(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function T1(e,t,n,i,s,a){var r=e.pendingLanes;e.pendingLanes=n,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=n,e.entangledLanes&=n,e.errorRecoveryDisabledLanes&=n,e.shellSuspendCounter=0;var o=e.entanglements,c=e.expirationTimes,l=e.hiddenUpdates;for(n=r&~n;0<n;){var h=31-kn(n),p=1<<h;o[h]=0,c[h]=-1;var u=l[h];if(u!==null)for(l[h]=null,h=0;h<u.length;h++){var d=u[h];d!==null&&(d.lane&=-536870913)}n&=~p}i!==0&&ny(e,i,0),a!==0&&s===0&&e.tag!==0&&(e.suspendedLanes|=a&~(r&~t))}function ny(e,t,n){e.pendingLanes|=t,e.suspendedLanes&=~t;var i=31-kn(t);e.entangledLanes|=t,e.entanglements[i]=e.entanglements[i]|1073741824|n&261930}function iy(e,t){var n=e.entangledLanes|=t;for(e=e.entanglements;n;){var i=31-kn(n),s=1<<i;s&t|e[i]&t&&(e[i]|=t),n&=~s}}function sy(e,t){var n=t&-t;return n=(n&42)!==0?1:pm(n),(n&(e.suspendedLanes|t))!==0?0:n}function pm(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function mm(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function ay(){var e=le.p;return e!==0?e:(e=window.event,e===void 0?32:Cb(e.type))}function E_(e,t){var n=le.p;try{return le.p=e,t()}finally{le.p=n}}var ia=Math.random().toString(36).slice(2),cn="__reactFiber$"+ia,Ln="__reactProps$"+ia,qr="__reactContainer$"+ia,Ep="__reactEvents$"+ia,A1="__reactListeners$"+ia,w1="__reactHandles$"+ia,T_="__reactResources$"+ia,bl="__reactMarker$"+ia;function gm(e){delete e[cn],delete e[Ln],delete e[Ep],delete e[A1],delete e[w1]}function vr(e){var t=e[cn];if(t)return t;for(var n=e.parentNode;n;){if(t=n[qr]||n[cn]){if(n=t.alternate,t.child!==null||n!==null&&n.child!==null)for(e=Lv(e);e!==null;){if(n=e[cn])return n;e=Lv(e)}return t}e=n,n=e.parentNode}return null}function Yr(e){if(e=e[cn]||e[qr]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function Ho(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(it(33))}function Cr(e){var t=e[T_];return t||(t=e[T_]={hoistableStyles:new Map,hoistableScripts:new Map}),t}function sn(e){e[bl]=!0}var ry=new Set,oy={};function Ha(e,t){Pr(e,t),Pr(e+"Capture",t)}function Pr(e,t){for(oy[e]=t,e=0;e<t.length;e++)ry.add(t[e])}var C1=RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"),A_={},w_={};function R1(e){return Mp.call(w_,e)?!0:Mp.call(A_,e)?!1:C1.test(e)?w_[e]=!0:(A_[e]=!0,!1)}function jc(e,t,n){if(R1(t))if(n===null)e.removeAttribute(t);else{switch(typeof n){case"undefined":case"function":case"symbol":e.removeAttribute(t);return;case"boolean":var i=t.toLowerCase().slice(0,5);if(i!=="data-"&&i!=="aria-"){e.removeAttribute(t);return}}e.setAttribute(t,""+n)}}function zc(e,t,n){if(n===null)e.removeAttribute(t);else{switch(typeof n){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(t);return}e.setAttribute(t,""+n)}}function $i(e,t,n,i){if(i===null)e.removeAttribute(n);else{switch(typeof i){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(n);return}e.setAttributeNS(t,n,""+i)}}function ai(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function ly(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function D1(e,t,n){var i=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&typeof i<"u"&&typeof i.get=="function"&&typeof i.set=="function"){var s=i.get,a=i.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return s.call(this)},set:function(r){n=""+r,a.call(this,r)}}),Object.defineProperty(e,t,{enumerable:i.enumerable}),{getValue:function(){return n},setValue:function(r){n=""+r},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function Tp(e){if(!e._valueTracker){var t=ly(e)?"checked":"value";e._valueTracker=D1(e,t,""+e[t])}}function cy(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),i="";return e&&(i=ly(e)?e.checked?"true":"false":e.value),e=i,e!==n?(t.setValue(e),!0):!1}function gu(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var N1=/[\n"\\]/g;function li(e){return e.replace(N1,function(t){return"\\"+t.charCodeAt(0).toString(16)+" "})}function Ap(e,t,n,i,s,a,r,o){e.name="",r!=null&&typeof r!="function"&&typeof r!="symbol"&&typeof r!="boolean"?e.type=r:e.removeAttribute("type"),t!=null?r==="number"?(t===0&&e.value===""||e.value!=t)&&(e.value=""+ai(t)):e.value!==""+ai(t)&&(e.value=""+ai(t)):r!=="submit"&&r!=="reset"||e.removeAttribute("value"),t!=null?wp(e,r,ai(t)):n!=null?wp(e,r,ai(n)):i!=null&&e.removeAttribute("value"),s==null&&a!=null&&(e.defaultChecked=!!a),s!=null&&(e.checked=s&&typeof s!="function"&&typeof s!="symbol"),o!=null&&typeof o!="function"&&typeof o!="symbol"&&typeof o!="boolean"?e.name=""+ai(o):e.removeAttribute("name")}function uy(e,t,n,i,s,a,r,o){if(a!=null&&typeof a!="function"&&typeof a!="symbol"&&typeof a!="boolean"&&(e.type=a),t!=null||n!=null){if(!(a!=="submit"&&a!=="reset"||t!=null)){Tp(e);return}n=n!=null?""+ai(n):"",t=t!=null?""+ai(t):n,o||t===e.value||(e.value=t),e.defaultValue=t}i=i??s,i=typeof i!="function"&&typeof i!="symbol"&&!!i,e.checked=o?e.checked:!!i,e.defaultChecked=!!i,r!=null&&typeof r!="function"&&typeof r!="symbol"&&typeof r!="boolean"&&(e.name=r),Tp(e)}function wp(e,t,n){t==="number"&&gu(e.ownerDocument)===e||e.defaultValue===""+n||(e.defaultValue=""+n)}function Rr(e,t,n,i){if(e=e.options,t){t={};for(var s=0;s<n.length;s++)t["$"+n[s]]=!0;for(n=0;n<e.length;n++)s=t.hasOwnProperty("$"+e[n].value),e[n].selected!==s&&(e[n].selected=s),s&&i&&(e[n].defaultSelected=!0)}else{for(n=""+ai(n),t=null,s=0;s<e.length;s++){if(e[s].value===n){e[s].selected=!0,i&&(e[s].defaultSelected=!0);return}t!==null||e[s].disabled||(t=e[s])}t!==null&&(t.selected=!0)}}function hy(e,t,n){if(t!=null&&(t=""+ai(t),t!==e.value&&(e.value=t),n==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=n!=null?""+ai(n):""}function fy(e,t,n,i){if(t==null){if(i!=null){if(n!=null)throw Error(it(92));if(Vo(i)){if(1<i.length)throw Error(it(93));i=i[0]}n=i}n==null&&(n=""),t=n}n=ai(t),e.defaultValue=n,i=e.textContent,i===n&&i!==""&&i!==null&&(e.value=i),Tp(e)}function zr(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&n.nodeType===3){n.nodeValue=t;return}}e.textContent=t}var U1=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function C_(e,t,n){var i=t.indexOf("--")===0;n==null||typeof n=="boolean"||n===""?i?e.setProperty(t,""):t==="float"?e.cssFloat="":e[t]="":i?e.setProperty(t,n):typeof n!="number"||n===0||U1.has(t)?t==="float"?e.cssFloat=n:e[t]=(""+n).trim():e[t]=n+"px"}function dy(e,t,n){if(t!=null&&typeof t!="object")throw Error(it(62));if(e=e.style,n!=null){for(var i in n)!n.hasOwnProperty(i)||t!=null&&t.hasOwnProperty(i)||(i.indexOf("--")===0?e.setProperty(i,""):i==="float"?e.cssFloat="":e[i]="");for(var s in t)i=t[s],t.hasOwnProperty(s)&&n[s]!==i&&C_(e,s,i)}else for(var a in t)t.hasOwnProperty(a)&&C_(e,a,t[a])}function _m(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var L1=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),I1=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function Qc(e){return I1.test(""+e)?"javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')":e}function os(){}var Cp=null;function vm(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var yr=null,Dr=null;function R_(e){var t=Yr(e);if(t&&(e=t.stateNode)){var n=e[Ln]||null;t:switch(e=t.stateNode,t.type){case"input":if(Ap(e,n.value,n.defaultValue,n.defaultValue,n.checked,n.defaultChecked,n.type,n.name),t=n.name,n.type==="radio"&&t!=null){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll('input[name="'+li(""+t)+'"][type="radio"]'),t=0;t<n.length;t++){var i=n[t];if(i!==e&&i.form===e.form){var s=i[Ln]||null;if(!s)throw Error(it(90));Ap(i,s.value,s.defaultValue,s.defaultValue,s.checked,s.defaultChecked,s.type,s.name)}}for(t=0;t<n.length;t++)i=n[t],i.form===e.form&&cy(i)}break t;case"textarea":hy(e,n.value,n.defaultValue);break t;case"select":t=n.value,t!=null&&Rr(e,!!n.multiple,t,!1)}}}var Gd=!1;function py(e,t,n){if(Gd)return e(t,n);Gd=!0;try{var i=e(t);return i}finally{if(Gd=!1,(yr!==null||Dr!==null)&&($u(),yr&&(t=yr,e=Dr,Dr=yr=null,R_(t),e)))for(t=0;t<e.length;t++)R_(e[t])}}function sl(e,t){var n=e.stateNode;if(n===null)return null;var i=n[Ln]||null;if(i===null)return null;n=i[t];t:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(e=e.type,i=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!i;break t;default:e=!1}if(e)return null;if(n&&typeof n!="function")throw Error(it(231,t,typeof n));return n}var fs=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Rp=!1;if(fs)try{hr={},Object.defineProperty(hr,"passive",{get:function(){Rp=!0}}),window.addEventListener("test",hr,hr),window.removeEventListener("test",hr,hr)}catch{Rp=!1}var hr,Vs=null,ym=null,$c=null;function my(){if($c)return $c;var e,t=ym,n=t.length,i,s="value"in Vs?Vs.value:Vs.textContent,a=s.length;for(e=0;e<n&&t[e]===s[e];e++);var r=n-e;for(i=1;i<=r&&t[n-i]===s[a-i];i++);return $c=s.slice(e,1<i?1-i:void 0)}function tu(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Bc(){return!0}function D_(){return!1}function In(e){function t(n,i,s,a,r){this._reactName=n,this._targetInst=s,this.type=i,this.nativeEvent=a,this.target=r,this.currentTarget=null;for(var o in e)e.hasOwnProperty(o)&&(n=e[o],this[o]=n?n(a):a[o]);return this.isDefaultPrevented=(a.defaultPrevented!=null?a.defaultPrevented:a.returnValue===!1)?Bc:D_,this.isPropagationStopped=D_,this}return De(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var n=this.nativeEvent;n&&(n.preventDefault?n.preventDefault():typeof n.returnValue!="unknown"&&(n.returnValue=!1),this.isDefaultPrevented=Bc)},stopPropagation:function(){var n=this.nativeEvent;n&&(n.stopPropagation?n.stopPropagation():typeof n.cancelBubble!="unknown"&&(n.cancelBubble=!0),this.isPropagationStopped=Bc)},persist:function(){},isPersistent:Bc}),t}var Ga={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},Gu=In(Ga),Sl=De({},Ga,{view:0,detail:0}),O1=In(Sl),kd,Xd,Lo,ku=De({},Sl,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:xm,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==Lo&&(Lo&&e.type==="mousemove"?(kd=e.screenX-Lo.screenX,Xd=e.screenY-Lo.screenY):Xd=kd=0,Lo=e),kd)},movementY:function(e){return"movementY"in e?e.movementY:Xd}}),N_=In(ku),P1=De({},ku,{dataTransfer:0}),z1=In(P1),B1=De({},Sl,{relatedTarget:0}),Wd=In(B1),F1=De({},Ga,{animationName:0,elapsedTime:0,pseudoElement:0}),V1=In(F1),H1=De({},Ga,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),G1=In(H1),k1=De({},Ga,{data:0}),U_=In(k1),X1={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},W1={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},q1={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function Y1(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=q1[e])?!!t[e]:!1}function xm(){return Y1}var Z1=De({},Sl,{key:function(e){if(e.key){var t=X1[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=tu(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?W1[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:xm,charCode:function(e){return e.type==="keypress"?tu(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?tu(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),J1=In(Z1),K1=De({},ku,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),L_=In(K1),j1=De({},Sl,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:xm}),Q1=In(j1),$1=De({},Ga,{propertyName:0,elapsedTime:0,pseudoElement:0}),tE=In($1),eE=De({},ku,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),nE=In(eE),iE=De({},Ga,{newState:0,oldState:0}),sE=In(iE),aE=[9,13,27,32],bm=fs&&"CompositionEvent"in window,Xo=null;fs&&"documentMode"in document&&(Xo=document.documentMode);var rE=fs&&"TextEvent"in window&&!Xo,gy=fs&&(!bm||Xo&&8<Xo&&11>=Xo),I_=" ",O_=!1;function _y(e,t){switch(e){case"keyup":return aE.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function vy(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var xr=!1;function oE(e,t){switch(e){case"compositionend":return vy(t);case"keypress":return t.which!==32?null:(O_=!0,I_);case"textInput":return e=t.data,e===I_&&O_?null:e;default:return null}}function lE(e,t){if(xr)return e==="compositionend"||!bm&&_y(e,t)?(e=my(),$c=ym=Vs=null,xr=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return gy&&t.locale!=="ko"?null:t.data;default:return null}}var cE={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function P_(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!cE[e.type]:t==="textarea"}function yy(e,t,n,i){yr?Dr?Dr.push(i):Dr=[i]:yr=i,t=Iu(t,"onChange"),0<t.length&&(n=new Gu("onChange","change",null,n,i),e.push({event:n,listeners:t}))}var Wo=null,al=null;function uE(e){pb(e,0)}function Xu(e){var t=Ho(e);if(cy(t))return e}function z_(e,t){if(e==="change")return t}var xy=!1;fs&&(fs?(Vc="oninput"in document,Vc||(qd=document.createElement("div"),qd.setAttribute("oninput","return;"),Vc=typeof qd.oninput=="function"),Fc=Vc):Fc=!1,xy=Fc&&(!document.documentMode||9<document.documentMode));var Fc,Vc,qd;function B_(){Wo&&(Wo.detachEvent("onpropertychange",by),al=Wo=null)}function by(e){if(e.propertyName==="value"&&Xu(al)){var t=[];yy(t,al,e,vm(e)),py(uE,t)}}function hE(e,t,n){e==="focusin"?(B_(),Wo=t,al=n,Wo.attachEvent("onpropertychange",by)):e==="focusout"&&B_()}function fE(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return Xu(al)}function dE(e,t){if(e==="click")return Xu(t)}function pE(e,t){if(e==="input"||e==="change")return Xu(t)}function mE(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Wn=typeof Object.is=="function"?Object.is:mE;function rl(e,t){if(Wn(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var n=Object.keys(e),i=Object.keys(t);if(n.length!==i.length)return!1;for(i=0;i<n.length;i++){var s=n[i];if(!Mp.call(t,s)||!Wn(e[s],t[s]))return!1}return!0}function F_(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function V_(e,t){var n=F_(e);e=0;for(var i;n;){if(n.nodeType===3){if(i=e+n.textContent.length,e<=t&&i>=t)return{node:n,offset:t-e};e=i}t:{for(;n;){if(n.nextSibling){n=n.nextSibling;break t}n=n.parentNode}n=void 0}n=F_(n)}}function Sy(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?Sy(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function My(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=gu(e.document);t instanceof e.HTMLIFrameElement;){try{var n=typeof t.contentWindow.location.href=="string"}catch{n=!1}if(n)e=t.contentWindow;else break;t=gu(e.document)}return t}function Sm(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}var gE=fs&&"documentMode"in document&&11>=document.documentMode,br=null,Dp=null,qo=null,Np=!1;function H_(e,t,n){var i=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;Np||br==null||br!==gu(i)||(i=br,"selectionStart"in i&&Sm(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),qo&&rl(qo,i)||(qo=i,i=Iu(Dp,"onSelect"),0<i.length&&(t=new Gu("onSelect","select",null,t,n),e.push({event:t,listeners:i}),t.target=br)))}function Aa(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n["Webkit"+e]="webkit"+t,n["Moz"+e]="moz"+t,n}var Sr={animationend:Aa("Animation","AnimationEnd"),animationiteration:Aa("Animation","AnimationIteration"),animationstart:Aa("Animation","AnimationStart"),transitionrun:Aa("Transition","TransitionRun"),transitionstart:Aa("Transition","TransitionStart"),transitioncancel:Aa("Transition","TransitionCancel"),transitionend:Aa("Transition","TransitionEnd")},Yd={},Ey={};fs&&(Ey=document.createElement("div").style,"AnimationEvent"in window||(delete Sr.animationend.animation,delete Sr.animationiteration.animation,delete Sr.animationstart.animation),"TransitionEvent"in window||delete Sr.transitionend.transition);function ka(e){if(Yd[e])return Yd[e];if(!Sr[e])return e;var t=Sr[e],n;for(n in t)if(t.hasOwnProperty(n)&&n in Ey)return Yd[e]=t[n];return e}var Ty=ka("animationend"),Ay=ka("animationiteration"),wy=ka("animationstart"),_E=ka("transitionrun"),vE=ka("transitionstart"),yE=ka("transitioncancel"),Cy=ka("transitionend"),Ry=new Map,Up="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");Up.push("scrollEnd");function xi(e,t){Ry.set(e,t),Ha(t,[e])}var _u=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},si=[],Mr=0,Mm=0;function Wu(){for(var e=Mr,t=Mm=Mr=0;t<e;){var n=si[t];si[t++]=null;var i=si[t];si[t++]=null;var s=si[t];si[t++]=null;var a=si[t];if(si[t++]=null,i!==null&&s!==null){var r=i.pending;r===null?s.next=s:(s.next=r.next,r.next=s),i.pending=s}a!==0&&Dy(n,s,a)}}function qu(e,t,n,i){si[Mr++]=e,si[Mr++]=t,si[Mr++]=n,si[Mr++]=i,Mm|=i,e.lanes|=i,e=e.alternate,e!==null&&(e.lanes|=i)}function Em(e,t,n,i){return qu(e,t,n,i),vu(e)}function Xa(e,t){return qu(e,null,null,t),vu(e)}function Dy(e,t,n){e.lanes|=n;var i=e.alternate;i!==null&&(i.lanes|=n);for(var s=!1,a=e.return;a!==null;)a.childLanes|=n,i=a.alternate,i!==null&&(i.childLanes|=n),a.tag===22&&(e=a.stateNode,e===null||e._visibility&1||(s=!0)),e=a,a=a.return;return e.tag===3?(a=e.stateNode,s&&t!==null&&(s=31-kn(n),e=a.hiddenUpdates,i=e[s],i===null?e[s]=[t]:i.push(t),t.lane=n|536870912),a):null}function vu(e){if(50<el)throw el=0,$p=null,Error(it(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var Er={};function xE(e,t,n,i){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Fn(e,t,n,i){return new xE(e,t,n,i)}function Tm(e){return e=e.prototype,!(!e||!e.isReactComponent)}function cs(e,t){var n=e.alternate;return n===null?(n=Fn(e.tag,t,e.key,e.mode),n.elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=e.flags&65011712,n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n.refCleanup=e.refCleanup,n}function Ny(e,t){e.flags&=65011714;var n=e.alternate;return n===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=n.childLanes,e.lanes=n.lanes,e.child=n.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=n.memoizedProps,e.memoizedState=n.memoizedState,e.updateQueue=n.updateQueue,e.type=n.type,t=n.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function eu(e,t,n,i,s,a){var r=0;if(i=e,typeof e=="function")Tm(e)&&(r=1);else if(typeof e=="string")r=MT(e,n,Pi.current)?26:e==="html"||e==="head"||e==="body"?27:5;else t:switch(e){case yp:return e=Fn(31,n,t,s),e.elementType=yp,e.lanes=a,e;case gr:return Ua(n.children,s,a,t);case Kv:r=8,s|=24;break;case gp:return e=Fn(12,n,t,s|2),e.elementType=gp,e.lanes=a,e;case _p:return e=Fn(13,n,t,s),e.elementType=_p,e.lanes=a,e;case vp:return e=Fn(19,n,t,s),e.elementType=vp,e.lanes=a,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case rs:r=10;break t;case jv:r=9;break t;case hm:r=11;break t;case fm:r=14;break t;case Ls:r=16,i=null;break t}r=29,n=Error(it(130,e===null?"null":typeof e,"")),i=null}return t=Fn(r,n,t,s),t.elementType=e,t.type=i,t.lanes=a,t}function Ua(e,t,n,i){return e=Fn(7,e,i,t),e.lanes=n,e}function Zd(e,t,n){return e=Fn(6,e,null,t),e.lanes=n,e}function Uy(e){var t=Fn(18,null,null,0);return t.stateNode=e,t}function Jd(e,t,n){return t=Fn(4,e.children!==null?e.children:[],e.key,t),t.lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var G_=new WeakMap;function ci(e,t){if(typeof e=="object"&&e!==null){var n=G_.get(e);return n!==void 0?n:(t={value:e,source:t,stack:M_(t)},G_.set(e,t),t)}return{value:e,source:t,stack:M_(t)}}var Tr=[],Ar=0,yu=null,ol=0,ri=[],oi=0,$s=null,Li=1,Ii="";function ss(e,t){Tr[Ar++]=ol,Tr[Ar++]=yu,yu=e,ol=t}function Ly(e,t,n){ri[oi++]=Li,ri[oi++]=Ii,ri[oi++]=$s,$s=e;var i=Li;e=Ii;var s=32-kn(i)-1;i&=~(1<<s),n+=1;var a=32-kn(t)+s;if(30<a){var r=s-s%5;a=(i&(1<<r)-1).toString(32),i>>=r,s-=r,Li=1<<32-kn(t)+s|n<<s|i,Ii=a+e}else Li=1<<a|n<<s|i,Ii=e}function Am(e){e.return!==null&&(ss(e,1),Ly(e,1,0))}function wm(e){for(;e===yu;)yu=Tr[--Ar],Tr[Ar]=null,ol=Tr[--Ar],Tr[Ar]=null;for(;e===$s;)$s=ri[--oi],ri[oi]=null,Ii=ri[--oi],ri[oi]=null,Li=ri[--oi],ri[oi]=null}function Iy(e,t){ri[oi++]=Li,ri[oi++]=Ii,ri[oi++]=$s,Li=t.id,Ii=t.overflow,$s=e}var un=null,Re=null,ie=!1,Ws=null,ui=!1,Lp=Error(it(519));function ta(e){var t=Error(it(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw ll(ci(t,e)),Lp}function k_(e){var t=e.stateNode,n=e.type,i=e.memoizedProps;switch(t[cn]=e,t[Ln]=i,n){case"dialog":Jt("cancel",t),Jt("close",t);break;case"iframe":case"object":case"embed":Jt("load",t);break;case"video":case"audio":for(n=0;n<fl.length;n++)Jt(fl[n],t);break;case"source":Jt("error",t);break;case"img":case"image":case"link":Jt("error",t),Jt("load",t);break;case"details":Jt("toggle",t);break;case"input":Jt("invalid",t),uy(t,i.value,i.defaultValue,i.checked,i.defaultChecked,i.type,i.name,!0);break;case"select":Jt("invalid",t);break;case"textarea":Jt("invalid",t),fy(t,i.value,i.defaultValue,i.children)}n=i.children,typeof n!="string"&&typeof n!="number"&&typeof n!="bigint"||t.textContent===""+n||i.suppressHydrationWarning===!0||gb(t.textContent,n)?(i.popover!=null&&(Jt("beforetoggle",t),Jt("toggle",t)),i.onScroll!=null&&Jt("scroll",t),i.onScrollEnd!=null&&Jt("scrollend",t),i.onClick!=null&&(t.onclick=os),t=!0):t=!1,t||ta(e,!0)}function X_(e){for(un=e.return;un;)switch(un.tag){case 5:case 31:case 13:ui=!1;return;case 27:case 3:ui=!0;return;default:un=un.return}}function fr(e){if(e!==un)return!1;if(!ie)return X_(e),ie=!0,!1;var t=e.tag,n;if((n=t!==3&&t!==27)&&((n=t===5)&&(n=e.type,n=!(n!=="form"&&n!=="button")||sm(e.type,e.memoizedProps)),n=!n),n&&Re&&ta(e),X_(e),t===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(it(317));Re=Uv(e)}else if(t===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(it(317));Re=Uv(e)}else t===27?(t=Re,sa(e.type)?(e=lm,lm=null,Re=e):Re=t):Re=un?fi(e.stateNode.nextSibling):null;return!0}function Pa(){Re=un=null,ie=!1}function Kd(){var e=Ws;return e!==null&&(Nn===null?Nn=e:Nn.push.apply(Nn,e),Ws=null),e}function ll(e){Ws===null?Ws=[e]:Ws.push(e)}var Ip=zi(null),Wa=null,ls=null;function Os(e,t,n){Se(Ip,t._currentValue),t._currentValue=n}function us(e){e._currentValue=Ip.current,an(Ip)}function Op(e,t,n){for(;e!==null;){var i=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,i!==null&&(i.childLanes|=t)):i!==null&&(i.childLanes&t)!==t&&(i.childLanes|=t),e===n)break;e=e.return}}function Pp(e,t,n,i){var s=e.child;for(s!==null&&(s.return=e);s!==null;){var a=s.dependencies;if(a!==null){var r=s.child;a=a.firstContext;t:for(;a!==null;){var o=a;a=s;for(var c=0;c<t.length;c++)if(o.context===t[c]){a.lanes|=n,o=a.alternate,o!==null&&(o.lanes|=n),Op(a.return,n,e),i||(r=null);break t}a=o.next}}else if(s.tag===18){if(r=s.return,r===null)throw Error(it(341));r.lanes|=n,a=r.alternate,a!==null&&(a.lanes|=n),Op(r,n,e),r=null}else r=s.child;if(r!==null)r.return=s;else for(r=s;r!==null;){if(r===e){r=null;break}if(s=r.sibling,s!==null){s.return=r.return,r=s;break}r=r.return}s=r}}function Zr(e,t,n,i){e=null;for(var s=t,a=!1;s!==null;){if(!a){if((s.flags&524288)!==0)a=!0;else if((s.flags&262144)!==0)break}if(s.tag===10){var r=s.alternate;if(r===null)throw Error(it(387));if(r=r.memoizedProps,r!==null){var o=s.type;Wn(s.pendingProps.value,r.value)||(e!==null?e.push(o):e=[o])}}else if(s===fu.current){if(r=s.alternate,r===null)throw Error(it(387));r.memoizedState.memoizedState!==s.memoizedState.memoizedState&&(e!==null?e.push(pl):e=[pl])}s=s.return}e!==null&&Pp(t,e,n,i),t.flags|=262144}function xu(e){for(e=e.firstContext;e!==null;){if(!Wn(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function za(e){Wa=e,ls=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function hn(e){return Oy(Wa,e)}function Hc(e,t){return Wa===null&&za(e),Oy(e,t)}function Oy(e,t){var n=t._currentValue;if(t={context:t,memoizedValue:n,next:null},ls===null){if(e===null)throw Error(it(308));ls=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else ls=ls.next=t;return n}var bE=typeof AbortController<"u"?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(n,i){e.push(i)}};this.abort=function(){t.aborted=!0,e.forEach(function(n){return n()})}},SE=$e.unstable_scheduleCallback,ME=$e.unstable_NormalPriority,Ze={$$typeof:rs,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function Cm(){return{controller:new bE,data:new Map,refCount:0}}function Ml(e){e.refCount--,e.refCount===0&&SE(ME,function(){e.controller.abort()})}var Yo=null,zp=0,Br=0,Nr=null;function EE(e,t){if(Yo===null){var n=Yo=[];zp=0,Br=$m(),Nr={status:"pending",value:void 0,then:function(i){n.push(i)}}}return zp++,t.then(W_,W_),t}function W_(){if(--zp===0&&Yo!==null){Nr!==null&&(Nr.status="fulfilled");var e=Yo;Yo=null,Br=0,Nr=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function TE(e,t){var n=[],i={status:"pending",value:null,reason:null,then:function(s){n.push(s)}};return e.then(function(){i.status="fulfilled",i.value=t;for(var s=0;s<n.length;s++)(0,n[s])(t)},function(s){for(i.status="rejected",i.reason=s,s=0;s<n.length;s++)(0,n[s])(void 0)}),i}var q_=Bt.S;Bt.S=function(e,t){Jx=Hn(),typeof t=="object"&&t!==null&&typeof t.then=="function"&&EE(e,t),q_!==null&&q_(e,t)};var La=zi(null);function Rm(){var e=La.current;return e!==null?e:ve.pooledCache}function nu(e,t){t===null?Se(La,La.current):Se(La,t.pool)}function Py(){var e=Rm();return e===null?null:{parent:Ze._currentValue,pool:e}}var Jr=Error(it(460)),Dm=Error(it(474)),Yu=Error(it(542)),bu={then:function(){}};function Y_(e){return e=e.status,e==="fulfilled"||e==="rejected"}function zy(e,t,n){switch(n=e[n],n===void 0?e.push(t):n!==t&&(t.then(os,os),t=n),t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,J_(e),e;default:if(typeof t.status=="string")t.then(os,os);else{if(e=ve,e!==null&&100<e.shellSuspendCounter)throw Error(it(482));e=t,e.status="pending",e.then(function(i){if(t.status==="pending"){var s=t;s.status="fulfilled",s.value=i}},function(i){if(t.status==="pending"){var s=t;s.status="rejected",s.reason=i}})}switch(t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,J_(e),e}throw Ia=t,Jr}}function Ra(e){try{var t=e._init;return t(e._payload)}catch(n){throw n!==null&&typeof n=="object"&&typeof n.then=="function"?(Ia=n,Jr):n}}var Ia=null;function Z_(){if(Ia===null)throw Error(it(459));var e=Ia;return Ia=null,e}function J_(e){if(e===Jr||e===Yu)throw Error(it(483))}var Ur=null,cl=0;function Gc(e){var t=cl;return cl+=1,Ur===null&&(Ur=[]),zy(Ur,e,t)}function Io(e,t){t=t.props.ref,e.ref=t!==void 0?t:null}function kc(e,t){throw t.$$typeof===h1?Error(it(525)):(e=Object.prototype.toString.call(t),Error(it(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)))}function By(e){function t(f,_){if(e){var x=f.deletions;x===null?(f.deletions=[_],f.flags|=16):x.push(_)}}function n(f,_){if(!e)return null;for(;_!==null;)t(f,_),_=_.sibling;return null}function i(f){for(var _=new Map;f!==null;)f.key!==null?_.set(f.key,f):_.set(f.index,f),f=f.sibling;return _}function s(f,_){return f=cs(f,_),f.index=0,f.sibling=null,f}function a(f,_,x){return f.index=x,e?(x=f.alternate,x!==null?(x=x.index,x<_?(f.flags|=67108866,_):x):(f.flags|=67108866,_)):(f.flags|=1048576,_)}function r(f){return e&&f.alternate===null&&(f.flags|=67108866),f}function o(f,_,x,v){return _===null||_.tag!==6?(_=Zd(x,f.mode,v),_.return=f,_):(_=s(_,x),_.return=f,_)}function c(f,_,x,v){var T=x.type;return T===gr?h(f,_,x.props.children,v,x.key):_!==null&&(_.elementType===T||typeof T=="object"&&T!==null&&T.$$typeof===Ls&&Ra(T)===_.type)?(_=s(_,x.props),Io(_,x),_.return=f,_):(_=eu(x.type,x.key,x.props,null,f.mode,v),Io(_,x),_.return=f,_)}function l(f,_,x,v){return _===null||_.tag!==4||_.stateNode.containerInfo!==x.containerInfo||_.stateNode.implementation!==x.implementation?(_=Jd(x,f.mode,v),_.return=f,_):(_=s(_,x.children||[]),_.return=f,_)}function h(f,_,x,v,T){return _===null||_.tag!==7?(_=Ua(x,f.mode,v,T),_.return=f,_):(_=s(_,x),_.return=f,_)}function p(f,_,x){if(typeof _=="string"&&_!==""||typeof _=="number"||typeof _=="bigint")return _=Zd(""+_,f.mode,x),_.return=f,_;if(typeof _=="object"&&_!==null){switch(_.$$typeof){case Lc:return x=eu(_.type,_.key,_.props,null,f.mode,x),Io(x,_),x.return=f,x;case Fo:return _=Jd(_,f.mode,x),_.return=f,_;case Ls:return _=Ra(_),p(f,_,x)}if(Vo(_)||Uo(_))return _=Ua(_,f.mode,x,null),_.return=f,_;if(typeof _.then=="function")return p(f,Gc(_),x);if(_.$$typeof===rs)return p(f,Hc(f,_),x);kc(f,_)}return null}function u(f,_,x,v){var T=_!==null?_.key:null;if(typeof x=="string"&&x!==""||typeof x=="number"||typeof x=="bigint")return T!==null?null:o(f,_,""+x,v);if(typeof x=="object"&&x!==null){switch(x.$$typeof){case Lc:return x.key===T?c(f,_,x,v):null;case Fo:return x.key===T?l(f,_,x,v):null;case Ls:return x=Ra(x),u(f,_,x,v)}if(Vo(x)||Uo(x))return T!==null?null:h(f,_,x,v,null);if(typeof x.then=="function")return u(f,_,Gc(x),v);if(x.$$typeof===rs)return u(f,_,Hc(f,x),v);kc(f,x)}return null}function d(f,_,x,v,T){if(typeof v=="string"&&v!==""||typeof v=="number"||typeof v=="bigint")return f=f.get(x)||null,o(_,f,""+v,T);if(typeof v=="object"&&v!==null){switch(v.$$typeof){case Lc:return f=f.get(v.key===null?x:v.key)||null,c(_,f,v,T);case Fo:return f=f.get(v.key===null?x:v.key)||null,l(_,f,v,T);case Ls:return v=Ra(v),d(f,_,x,v,T)}if(Vo(v)||Uo(v))return f=f.get(x)||null,h(_,f,v,T,null);if(typeof v.then=="function")return d(f,_,x,Gc(v),T);if(v.$$typeof===rs)return d(f,_,x,Hc(_,v),T);kc(_,v)}return null}function m(f,_,x,v){for(var T=null,A=null,w=_,y=_=0,M=null;w!==null&&y<x.length;y++){w.index>y?(M=w,w=null):M=w.sibling;var C=u(f,w,x[y],v);if(C===null){w===null&&(w=M);break}e&&w&&C.alternate===null&&t(f,w),_=a(C,_,y),A===null?T=C:A.sibling=C,A=C,w=M}if(y===x.length)return n(f,w),ie&&ss(f,y),T;if(w===null){for(;y<x.length;y++)w=p(f,x[y],v),w!==null&&(_=a(w,_,y),A===null?T=w:A.sibling=w,A=w);return ie&&ss(f,y),T}for(w=i(w);y<x.length;y++)M=d(w,f,y,x[y],v),M!==null&&(e&&M.alternate!==null&&w.delete(M.key===null?y:M.key),_=a(M,_,y),A===null?T=M:A.sibling=M,A=M);return e&&w.forEach(function(D){return t(f,D)}),ie&&ss(f,y),T}function S(f,_,x,v){if(x==null)throw Error(it(151));for(var T=null,A=null,w=_,y=_=0,M=null,C=x.next();w!==null&&!C.done;y++,C=x.next()){w.index>y?(M=w,w=null):M=w.sibling;var D=u(f,w,C.value,v);if(D===null){w===null&&(w=M);break}e&&w&&D.alternate===null&&t(f,w),_=a(D,_,y),A===null?T=D:A.sibling=D,A=D,w=M}if(C.done)return n(f,w),ie&&ss(f,y),T;if(w===null){for(;!C.done;y++,C=x.next())C=p(f,C.value,v),C!==null&&(_=a(C,_,y),A===null?T=C:A.sibling=C,A=C);return ie&&ss(f,y),T}for(w=i(w);!C.done;y++,C=x.next())C=d(w,f,y,C.value,v),C!==null&&(e&&C.alternate!==null&&w.delete(C.key===null?y:C.key),_=a(C,_,y),A===null?T=C:A.sibling=C,A=C);return e&&w.forEach(function(L){return t(f,L)}),ie&&ss(f,y),T}function g(f,_,x,v){if(typeof x=="object"&&x!==null&&x.type===gr&&x.key===null&&(x=x.props.children),typeof x=="object"&&x!==null){switch(x.$$typeof){case Lc:t:{for(var T=x.key;_!==null;){if(_.key===T){if(T=x.type,T===gr){if(_.tag===7){n(f,_.sibling),v=s(_,x.props.children),v.return=f,f=v;break t}}else if(_.elementType===T||typeof T=="object"&&T!==null&&T.$$typeof===Ls&&Ra(T)===_.type){n(f,_.sibling),v=s(_,x.props),Io(v,x),v.return=f,f=v;break t}n(f,_);break}else t(f,_);_=_.sibling}x.type===gr?(v=Ua(x.props.children,f.mode,v,x.key),v.return=f,f=v):(v=eu(x.type,x.key,x.props,null,f.mode,v),Io(v,x),v.return=f,f=v)}return r(f);case Fo:t:{for(T=x.key;_!==null;){if(_.key===T)if(_.tag===4&&_.stateNode.containerInfo===x.containerInfo&&_.stateNode.implementation===x.implementation){n(f,_.sibling),v=s(_,x.children||[]),v.return=f,f=v;break t}else{n(f,_);break}else t(f,_);_=_.sibling}v=Jd(x,f.mode,v),v.return=f,f=v}return r(f);case Ls:return x=Ra(x),g(f,_,x,v)}if(Vo(x))return m(f,_,x,v);if(Uo(x)){if(T=Uo(x),typeof T!="function")throw Error(it(150));return x=T.call(x),S(f,_,x,v)}if(typeof x.then=="function")return g(f,_,Gc(x),v);if(x.$$typeof===rs)return g(f,_,Hc(f,x),v);kc(f,x)}return typeof x=="string"&&x!==""||typeof x=="number"||typeof x=="bigint"?(x=""+x,_!==null&&_.tag===6?(n(f,_.sibling),v=s(_,x),v.return=f,f=v):(n(f,_),v=Zd(x,f.mode,v),v.return=f,f=v),r(f)):n(f,_)}return function(f,_,x,v){try{cl=0;var T=g(f,_,x,v);return Ur=null,T}catch(w){if(w===Jr||w===Yu)throw w;var A=Fn(29,w,null,f.mode);return A.lanes=v,A.return=f,A}finally{}}}var Ba=By(!0),Fy=By(!1),Is=!1;function Nm(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function Bp(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function qs(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function Ys(e,t,n){var i=e.updateQueue;if(i===null)return null;if(i=i.shared,(oe&2)!==0){var s=i.pending;return s===null?t.next=t:(t.next=s.next,s.next=t),i.pending=t,t=vu(e),Dy(e,null,n),t}return qu(e,i,t,n),vu(e)}function Zo(e,t,n){if(t=t.updateQueue,t!==null&&(t=t.shared,(n&4194048)!==0)){var i=t.lanes;i&=e.pendingLanes,n|=i,t.lanes=n,iy(e,n)}}function jd(e,t){var n=e.updateQueue,i=e.alternate;if(i!==null&&(i=i.updateQueue,n===i)){var s=null,a=null;if(n=n.firstBaseUpdate,n!==null){do{var r={lane:n.lane,tag:n.tag,payload:n.payload,callback:null,next:null};a===null?s=a=r:a=a.next=r,n=n.next}while(n!==null);a===null?s=a=t:a=a.next=t}else s=a=t;n={baseState:i.baseState,firstBaseUpdate:s,lastBaseUpdate:a,shared:i.shared,callbacks:i.callbacks},e.updateQueue=n;return}e=n.lastBaseUpdate,e===null?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}var Fp=!1;function Jo(){if(Fp){var e=Nr;if(e!==null)throw e}}function Ko(e,t,n,i){Fp=!1;var s=e.updateQueue;Is=!1;var a=s.firstBaseUpdate,r=s.lastBaseUpdate,o=s.shared.pending;if(o!==null){s.shared.pending=null;var c=o,l=c.next;c.next=null,r===null?a=l:r.next=l,r=c;var h=e.alternate;h!==null&&(h=h.updateQueue,o=h.lastBaseUpdate,o!==r&&(o===null?h.firstBaseUpdate=l:o.next=l,h.lastBaseUpdate=c))}if(a!==null){var p=s.baseState;r=0,h=l=c=null,o=a;do{var u=o.lane&-536870913,d=u!==o.lane;if(d?(te&u)===u:(i&u)===u){u!==0&&u===Br&&(Fp=!0),h!==null&&(h=h.next={lane:0,tag:o.tag,payload:o.payload,callback:null,next:null});t:{var m=e,S=o;u=t;var g=n;switch(S.tag){case 1:if(m=S.payload,typeof m=="function"){p=m.call(g,p,u);break t}p=m;break t;case 3:m.flags=m.flags&-65537|128;case 0:if(m=S.payload,u=typeof m=="function"?m.call(g,p,u):m,u==null)break t;p=De({},p,u);break t;case 2:Is=!0}}u=o.callback,u!==null&&(e.flags|=64,d&&(e.flags|=8192),d=s.callbacks,d===null?s.callbacks=[u]:d.push(u))}else d={lane:u,tag:o.tag,payload:o.payload,callback:o.callback,next:null},h===null?(l=h=d,c=p):h=h.next=d,r|=u;if(o=o.next,o===null){if(o=s.shared.pending,o===null)break;d=o,o=d.next,d.next=null,s.lastBaseUpdate=d,s.shared.pending=null}}while(!0);h===null&&(c=p),s.baseState=c,s.firstBaseUpdate=l,s.lastBaseUpdate=h,a===null&&(s.shared.lanes=0),na|=r,e.lanes=r,e.memoizedState=p}}function Vy(e,t){if(typeof e!="function")throw Error(it(191,e));e.call(t)}function Hy(e,t){var n=e.callbacks;if(n!==null)for(e.callbacks=null,e=0;e<n.length;e++)Vy(n[e],t)}var Fr=zi(null),Su=zi(0);function K_(e,t){e=gs,Se(Su,e),Se(Fr,t),gs=e|t.baseLanes}function Vp(){Se(Su,gs),Se(Fr,Fr.current)}function Um(){gs=Su.current,an(Fr),an(Su)}var qn=zi(null),hi=null;function Ps(e){var t=e.alternate;Se(Xe,Xe.current&1),Se(qn,e),hi===null&&(t===null||Fr.current!==null||t.memoizedState!==null)&&(hi=e)}function Hp(e){Se(Xe,Xe.current),Se(qn,e),hi===null&&(hi=e)}function Gy(e){e.tag===22?(Se(Xe,Xe.current),Se(qn,e),hi===null&&(hi=e)):zs(e)}function zs(){Se(Xe,Xe.current),Se(qn,qn.current)}function Bn(e){an(qn),hi===e&&(hi=null),an(Xe)}var Xe=zi(0);function Mu(e){for(var t=e;t!==null;){if(t.tag===13){var n=t.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||rm(n)||om(n)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder==="forwards"||t.memoizedProps.revealOrder==="backwards"||t.memoizedProps.revealOrder==="unstable_legacy-backwards"||t.memoizedProps.revealOrder==="together")){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var ds=0,Xt=null,me=null,qe=null,Eu=!1,Lr=!1,Fa=!1,Tu=0,ul=0,Ir=null,AE=0;function Fe(){throw Error(it(321))}function Lm(e,t){if(t===null)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!Wn(e[n],t[n]))return!1;return!0}function Im(e,t,n,i,s,a){return ds=a,Xt=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,Bt.H=e===null||e.memoizedState===null?yx:Wm,Fa=!1,a=n(i,s),Fa=!1,Lr&&(a=Xy(t,n,i,s)),ky(e),a}function ky(e){Bt.H=hl;var t=me!==null&&me.next!==null;if(ds=0,qe=me=Xt=null,Eu=!1,ul=0,Ir=null,t)throw Error(it(300));e===null||Je||(e=e.dependencies,e!==null&&xu(e)&&(Je=!0))}function Xy(e,t,n,i){Xt=e;var s=0;do{if(Lr&&(Ir=null),ul=0,Lr=!1,25<=s)throw Error(it(301));if(s+=1,qe=me=null,e.updateQueue!=null){var a=e.updateQueue;a.lastEffect=null,a.events=null,a.stores=null,a.memoCache!=null&&(a.memoCache.index=0)}Bt.H=xx,a=t(n,i)}while(Lr);return a}function wE(){var e=Bt.H,t=e.useState()[0];return t=typeof t.then=="function"?El(t):t,e=e.useState()[0],(me!==null?me.memoizedState:null)!==e&&(Xt.flags|=1024),t}function Om(){var e=Tu!==0;return Tu=0,e}function Pm(e,t,n){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~n}function zm(e){if(Eu){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}Eu=!1}ds=0,qe=me=Xt=null,Lr=!1,ul=Tu=0,Ir=null}function En(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return qe===null?Xt.memoizedState=qe=e:qe=qe.next=e,qe}function We(){if(me===null){var e=Xt.alternate;e=e!==null?e.memoizedState:null}else e=me.next;var t=qe===null?Xt.memoizedState:qe.next;if(t!==null)qe=t,me=e;else{if(e===null)throw Xt.alternate===null?Error(it(467)):Error(it(310));me=e,e={memoizedState:me.memoizedState,baseState:me.baseState,baseQueue:me.baseQueue,queue:me.queue,next:null},qe===null?Xt.memoizedState=qe=e:qe=qe.next=e}return qe}function Zu(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function El(e){var t=ul;return ul+=1,Ir===null&&(Ir=[]),e=zy(Ir,e,t),t=Xt,(qe===null?t.memoizedState:qe.next)===null&&(t=t.alternate,Bt.H=t===null||t.memoizedState===null?yx:Wm),e}function Ju(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return El(e);if(e.$$typeof===rs)return hn(e)}throw Error(it(438,String(e)))}function Bm(e){var t=null,n=Xt.updateQueue;if(n!==null&&(t=n.memoCache),t==null){var i=Xt.alternate;i!==null&&(i=i.updateQueue,i!==null&&(i=i.memoCache,i!=null&&(t={data:i.data.map(function(s){return s.slice()}),index:0})))}if(t==null&&(t={data:[],index:0}),n===null&&(n=Zu(),Xt.updateQueue=n),n.memoCache=t,n=t.data[t.index],n===void 0)for(n=t.data[t.index]=Array(e),i=0;i<e;i++)n[i]=f1;return t.index++,n}function ps(e,t){return typeof t=="function"?t(e):t}function iu(e){var t=We();return Fm(t,me,e)}function Fm(e,t,n){var i=e.queue;if(i===null)throw Error(it(311));i.lastRenderedReducer=n;var s=e.baseQueue,a=i.pending;if(a!==null){if(s!==null){var r=s.next;s.next=a.next,a.next=r}t.baseQueue=s=a,i.pending=null}if(a=e.baseState,s===null)e.memoizedState=a;else{t=s.next;var o=r=null,c=null,l=t,h=!1;do{var p=l.lane&-536870913;if(p!==l.lane?(te&p)===p:(ds&p)===p){var u=l.revertLane;if(u===0)c!==null&&(c=c.next={lane:0,revertLane:0,gesture:null,action:l.action,hasEagerState:l.hasEagerState,eagerState:l.eagerState,next:null}),p===Br&&(h=!0);else if((ds&u)===u){l=l.next,u===Br&&(h=!0);continue}else p={lane:0,revertLane:l.revertLane,gesture:null,action:l.action,hasEagerState:l.hasEagerState,eagerState:l.eagerState,next:null},c===null?(o=c=p,r=a):c=c.next=p,Xt.lanes|=u,na|=u;p=l.action,Fa&&n(a,p),a=l.hasEagerState?l.eagerState:n(a,p)}else u={lane:p,revertLane:l.revertLane,gesture:l.gesture,action:l.action,hasEagerState:l.hasEagerState,eagerState:l.eagerState,next:null},c===null?(o=c=u,r=a):c=c.next=u,Xt.lanes|=p,na|=p;l=l.next}while(l!==null&&l!==t);if(c===null?r=a:c.next=o,!Wn(a,e.memoizedState)&&(Je=!0,h&&(n=Nr,n!==null)))throw n;e.memoizedState=a,e.baseState=r,e.baseQueue=c,i.lastRenderedState=a}return s===null&&(i.lanes=0),[e.memoizedState,i.dispatch]}function Qd(e){var t=We(),n=t.queue;if(n===null)throw Error(it(311));n.lastRenderedReducer=e;var i=n.dispatch,s=n.pending,a=t.memoizedState;if(s!==null){n.pending=null;var r=s=s.next;do a=e(a,r.action),r=r.next;while(r!==s);Wn(a,t.memoizedState)||(Je=!0),t.memoizedState=a,t.baseQueue===null&&(t.baseState=a),n.lastRenderedState=a}return[a,i]}function Wy(e,t,n){var i=Xt,s=We(),a=ie;if(a){if(n===void 0)throw Error(it(407));n=n()}else n=t();var r=!Wn((me||s).memoizedState,n);if(r&&(s.memoizedState=n,Je=!0),s=s.queue,Vm(Zy.bind(null,i,s,e),[e]),s.getSnapshot!==t||r||qe!==null&&qe.memoizedState.tag&1){if(i.flags|=2048,Vr(9,{destroy:void 0},Yy.bind(null,i,s,n,t),null),ve===null)throw Error(it(349));a||(ds&127)!==0||qy(i,t,n)}return n}function qy(e,t,n){e.flags|=16384,e={getSnapshot:t,value:n},t=Xt.updateQueue,t===null?(t=Zu(),Xt.updateQueue=t,t.stores=[e]):(n=t.stores,n===null?t.stores=[e]:n.push(e))}function Yy(e,t,n,i){t.value=n,t.getSnapshot=i,Jy(t)&&Ky(e)}function Zy(e,t,n){return n(function(){Jy(t)&&Ky(e)})}function Jy(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!Wn(e,n)}catch{return!0}}function Ky(e){var t=Xa(e,2);t!==null&&Un(t,e,2)}function Gp(e){var t=En();if(typeof e=="function"){var n=e;if(e=n(),Fa){Fs(!0);try{n()}finally{Fs(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:ps,lastRenderedState:e},t}function jy(e,t,n,i){return e.baseState=n,Fm(e,me,typeof i=="function"?i:ps)}function CE(e,t,n,i,s){if(ju(e))throw Error(it(485));if(e=t.action,e!==null){var a={payload:s,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(r){a.listeners.push(r)}};Bt.T!==null?n(!0):a.isTransition=!1,i(a),n=t.pending,n===null?(a.next=t.pending=a,Qy(t,a)):(a.next=n.next,t.pending=n.next=a)}}function Qy(e,t){var n=t.action,i=t.payload,s=e.state;if(t.isTransition){var a=Bt.T,r={};Bt.T=r;try{var o=n(s,i),c=Bt.S;c!==null&&c(r,o),j_(e,t,o)}catch(l){kp(e,t,l)}finally{a!==null&&r.types!==null&&(a.types=r.types),Bt.T=a}}else try{a=n(s,i),j_(e,t,a)}catch(l){kp(e,t,l)}}function j_(e,t,n){n!==null&&typeof n=="object"&&typeof n.then=="function"?n.then(function(i){Q_(e,t,i)},function(i){return kp(e,t,i)}):Q_(e,t,n)}function Q_(e,t,n){t.status="fulfilled",t.value=n,$y(t),e.state=n,t=e.pending,t!==null&&(n=t.next,n===t?e.pending=null:(n=n.next,t.next=n,Qy(e,n)))}function kp(e,t,n){var i=e.pending;if(e.pending=null,i!==null){i=i.next;do t.status="rejected",t.reason=n,$y(t),t=t.next;while(t!==i)}e.action=null}function $y(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function tx(e,t){return t}function $_(e,t){if(ie){var n=ve.formState;if(n!==null){t:{var i=Xt;if(ie){if(Re){e:{for(var s=Re,a=ui;s.nodeType!==8;){if(!a){s=null;break e}if(s=fi(s.nextSibling),s===null){s=null;break e}}a=s.data,s=a==="F!"||a==="F"?s:null}if(s){Re=fi(s.nextSibling),i=s.data==="F!";break t}}ta(i)}i=!1}i&&(t=n[0])}}return n=En(),n.memoizedState=n.baseState=t,i={pending:null,lanes:0,dispatch:null,lastRenderedReducer:tx,lastRenderedState:t},n.queue=i,n=gx.bind(null,Xt,i),i.dispatch=n,i=Gp(!1),a=Xm.bind(null,Xt,!1,i.queue),i=En(),s={state:t,dispatch:null,action:e,pending:null},i.queue=s,n=CE.bind(null,Xt,s,a,n),s.dispatch=n,i.memoizedState=e,[t,n,!1]}function tv(e){var t=We();return ex(t,me,e)}function ex(e,t,n){if(t=Fm(e,t,tx)[0],e=iu(ps)[0],typeof t=="object"&&t!==null&&typeof t.then=="function")try{var i=El(t)}catch(r){throw r===Jr?Yu:r}else i=t;t=We();var s=t.queue,a=s.dispatch;return n!==t.memoizedState&&(Xt.flags|=2048,Vr(9,{destroy:void 0},RE.bind(null,s,n),null)),[i,a,e]}function RE(e,t){e.action=t}function ev(e){var t=We(),n=me;if(n!==null)return ex(t,n,e);We(),t=t.memoizedState,n=We();var i=n.queue.dispatch;return n.memoizedState=e,[t,i,!1]}function Vr(e,t,n,i){return e={tag:e,create:n,deps:i,inst:t,next:null},t=Xt.updateQueue,t===null&&(t=Zu(),Xt.updateQueue=t),n=t.lastEffect,n===null?t.lastEffect=e.next=e:(i=n.next,n.next=e,e.next=i,t.lastEffect=e),e}function nx(){return We().memoizedState}function su(e,t,n,i){var s=En();Xt.flags|=e,s.memoizedState=Vr(1|t,{destroy:void 0},n,i===void 0?null:i)}function Ku(e,t,n,i){var s=We();i=i===void 0?null:i;var a=s.memoizedState.inst;me!==null&&i!==null&&Lm(i,me.memoizedState.deps)?s.memoizedState=Vr(t,a,n,i):(Xt.flags|=e,s.memoizedState=Vr(1|t,a,n,i))}function nv(e,t){su(8390656,8,e,t)}function Vm(e,t){Ku(2048,8,e,t)}function DE(e){Xt.flags|=4;var t=Xt.updateQueue;if(t===null)t=Zu(),Xt.updateQueue=t,t.events=[e];else{var n=t.events;n===null?t.events=[e]:n.push(e)}}function ix(e){var t=We().memoizedState;return DE({ref:t,nextImpl:e}),function(){if((oe&2)!==0)throw Error(it(440));return t.impl.apply(void 0,arguments)}}function sx(e,t){return Ku(4,2,e,t)}function ax(e,t){return Ku(4,4,e,t)}function rx(e,t){if(typeof t=="function"){e=e();var n=t(e);return function(){typeof n=="function"?n():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function ox(e,t,n){n=n!=null?n.concat([e]):null,Ku(4,4,rx.bind(null,t,e),n)}function Hm(){}function lx(e,t){var n=We();t=t===void 0?null:t;var i=n.memoizedState;return t!==null&&Lm(t,i[1])?i[0]:(n.memoizedState=[e,t],e)}function cx(e,t){var n=We();t=t===void 0?null:t;var i=n.memoizedState;if(t!==null&&Lm(t,i[1]))return i[0];if(i=e(),Fa){Fs(!0);try{e()}finally{Fs(!1)}}return n.memoizedState=[i,t],i}function Gm(e,t,n){return n===void 0||(ds&1073741824)!==0&&(te&261930)===0?e.memoizedState=t:(e.memoizedState=n,e=jx(),Xt.lanes|=e,na|=e,n)}function ux(e,t,n,i){return Wn(n,t)?n:Fr.current!==null?(e=Gm(e,n,i),Wn(e,t)||(Je=!0),e):(ds&42)===0||(ds&1073741824)!==0&&(te&261930)===0?(Je=!0,e.memoizedState=n):(e=jx(),Xt.lanes|=e,na|=e,t)}function hx(e,t,n,i,s){var a=le.p;le.p=a!==0&&8>a?a:8;var r=Bt.T,o={};Bt.T=o,Xm(e,!1,t,n);try{var c=s(),l=Bt.S;if(l!==null&&l(o,c),c!==null&&typeof c=="object"&&typeof c.then=="function"){var h=TE(c,i);jo(e,t,h,Xn(e))}else jo(e,t,i,Xn(e))}catch(p){jo(e,t,{then:function(){},status:"rejected",reason:p},Xn())}finally{le.p=a,r!==null&&o.types!==null&&(r.types=o.types),Bt.T=r}}function NE(){}function Xp(e,t,n,i){if(e.tag!==5)throw Error(it(476));var s=fx(e).queue;hx(e,s,t,Na,n===null?NE:function(){return dx(e),n(i)})}function fx(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:Na,baseState:Na,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:ps,lastRenderedState:Na},next:null};var n={};return t.next={memoizedState:n,baseState:n,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:ps,lastRenderedState:n},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function dx(e){var t=fx(e);t.next===null&&(t=e.alternate.memoizedState),jo(e,t.next.queue,{},Xn())}function km(){return hn(pl)}function px(){return We().memoizedState}function mx(){return We().memoizedState}function UE(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var n=Xn();e=qs(n);var i=Ys(t,e,n);i!==null&&(Un(i,t,n),Zo(i,t,n)),t={cache:Cm()},e.payload=t;return}t=t.return}}function LE(e,t,n){var i=Xn();n={lane:i,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null},ju(e)?_x(t,n):(n=Em(e,t,n,i),n!==null&&(Un(n,e,i),vx(n,t,i)))}function gx(e,t,n){var i=Xn();jo(e,t,n,i)}function jo(e,t,n,i){var s={lane:i,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null};if(ju(e))_x(t,s);else{var a=e.alternate;if(e.lanes===0&&(a===null||a.lanes===0)&&(a=t.lastRenderedReducer,a!==null))try{var r=t.lastRenderedState,o=a(r,n);if(s.hasEagerState=!0,s.eagerState=o,Wn(o,r))return qu(e,t,s,0),ve===null&&Wu(),!1}catch{}finally{}if(n=Em(e,t,s,i),n!==null)return Un(n,e,i),vx(n,t,i),!0}return!1}function Xm(e,t,n,i){if(i={lane:2,revertLane:$m(),gesture:null,action:i,hasEagerState:!1,eagerState:null,next:null},ju(e)){if(t)throw Error(it(479))}else t=Em(e,n,i,2),t!==null&&Un(t,e,2)}function ju(e){var t=e.alternate;return e===Xt||t!==null&&t===Xt}function _x(e,t){Lr=Eu=!0;var n=e.pending;n===null?t.next=t:(t.next=n.next,n.next=t),e.pending=t}function vx(e,t,n){if((n&4194048)!==0){var i=t.lanes;i&=e.pendingLanes,n|=i,t.lanes=n,iy(e,n)}}var hl={readContext:hn,use:Ju,useCallback:Fe,useContext:Fe,useEffect:Fe,useImperativeHandle:Fe,useLayoutEffect:Fe,useInsertionEffect:Fe,useMemo:Fe,useReducer:Fe,useRef:Fe,useState:Fe,useDebugValue:Fe,useDeferredValue:Fe,useTransition:Fe,useSyncExternalStore:Fe,useId:Fe,useHostTransitionStatus:Fe,useFormState:Fe,useActionState:Fe,useOptimistic:Fe,useMemoCache:Fe,useCacheRefresh:Fe};hl.useEffectEvent=Fe;var yx={readContext:hn,use:Ju,useCallback:function(e,t){return En().memoizedState=[e,t===void 0?null:t],e},useContext:hn,useEffect:nv,useImperativeHandle:function(e,t,n){n=n!=null?n.concat([e]):null,su(4194308,4,rx.bind(null,t,e),n)},useLayoutEffect:function(e,t){return su(4194308,4,e,t)},useInsertionEffect:function(e,t){su(4,2,e,t)},useMemo:function(e,t){var n=En();t=t===void 0?null:t;var i=e();if(Fa){Fs(!0);try{e()}finally{Fs(!1)}}return n.memoizedState=[i,t],i},useReducer:function(e,t,n){var i=En();if(n!==void 0){var s=n(t);if(Fa){Fs(!0);try{n(t)}finally{Fs(!1)}}}else s=t;return i.memoizedState=i.baseState=s,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:s},i.queue=e,e=e.dispatch=LE.bind(null,Xt,e),[i.memoizedState,e]},useRef:function(e){var t=En();return e={current:e},t.memoizedState=e},useState:function(e){e=Gp(e);var t=e.queue,n=gx.bind(null,Xt,t);return t.dispatch=n,[e.memoizedState,n]},useDebugValue:Hm,useDeferredValue:function(e,t){var n=En();return Gm(n,e,t)},useTransition:function(){var e=Gp(!1);return e=hx.bind(null,Xt,e.queue,!0,!1),En().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,n){var i=Xt,s=En();if(ie){if(n===void 0)throw Error(it(407));n=n()}else{if(n=t(),ve===null)throw Error(it(349));(te&127)!==0||qy(i,t,n)}s.memoizedState=n;var a={value:n,getSnapshot:t};return s.queue=a,nv(Zy.bind(null,i,a,e),[e]),i.flags|=2048,Vr(9,{destroy:void 0},Yy.bind(null,i,a,n,t),null),n},useId:function(){var e=En(),t=ve.identifierPrefix;if(ie){var n=Ii,i=Li;n=(i&~(1<<32-kn(i)-1)).toString(32)+n,t="_"+t+"R_"+n,n=Tu++,0<n&&(t+="H"+n.toString(32)),t+="_"}else n=AE++,t="_"+t+"r_"+n.toString(32)+"_";return e.memoizedState=t},useHostTransitionStatus:km,useFormState:$_,useActionState:$_,useOptimistic:function(e){var t=En();t.memoizedState=t.baseState=e;var n={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=n,t=Xm.bind(null,Xt,!0,n),n.dispatch=t,[e,t]},useMemoCache:Bm,useCacheRefresh:function(){return En().memoizedState=UE.bind(null,Xt)},useEffectEvent:function(e){var t=En(),n={impl:e};return t.memoizedState=n,function(){if((oe&2)!==0)throw Error(it(440));return n.impl.apply(void 0,arguments)}}},Wm={readContext:hn,use:Ju,useCallback:lx,useContext:hn,useEffect:Vm,useImperativeHandle:ox,useInsertionEffect:sx,useLayoutEffect:ax,useMemo:cx,useReducer:iu,useRef:nx,useState:function(){return iu(ps)},useDebugValue:Hm,useDeferredValue:function(e,t){var n=We();return ux(n,me.memoizedState,e,t)},useTransition:function(){var e=iu(ps)[0],t=We().memoizedState;return[typeof e=="boolean"?e:El(e),t]},useSyncExternalStore:Wy,useId:px,useHostTransitionStatus:km,useFormState:tv,useActionState:tv,useOptimistic:function(e,t){var n=We();return jy(n,me,e,t)},useMemoCache:Bm,useCacheRefresh:mx};Wm.useEffectEvent=ix;var xx={readContext:hn,use:Ju,useCallback:lx,useContext:hn,useEffect:Vm,useImperativeHandle:ox,useInsertionEffect:sx,useLayoutEffect:ax,useMemo:cx,useReducer:Qd,useRef:nx,useState:function(){return Qd(ps)},useDebugValue:Hm,useDeferredValue:function(e,t){var n=We();return me===null?Gm(n,e,t):ux(n,me.memoizedState,e,t)},useTransition:function(){var e=Qd(ps)[0],t=We().memoizedState;return[typeof e=="boolean"?e:El(e),t]},useSyncExternalStore:Wy,useId:px,useHostTransitionStatus:km,useFormState:ev,useActionState:ev,useOptimistic:function(e,t){var n=We();return me!==null?jy(n,me,e,t):(n.baseState=e,[e,n.queue.dispatch])},useMemoCache:Bm,useCacheRefresh:mx};xx.useEffectEvent=ix;function $d(e,t,n,i){t=e.memoizedState,n=n(i,t),n=n==null?t:De({},t,n),e.memoizedState=n,e.lanes===0&&(e.updateQueue.baseState=n)}var Wp={enqueueSetState:function(e,t,n){e=e._reactInternals;var i=Xn(),s=qs(i);s.payload=t,n!=null&&(s.callback=n),t=Ys(e,s,i),t!==null&&(Un(t,e,i),Zo(t,e,i))},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var i=Xn(),s=qs(i);s.tag=1,s.payload=t,n!=null&&(s.callback=n),t=Ys(e,s,i),t!==null&&(Un(t,e,i),Zo(t,e,i))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=Xn(),i=qs(n);i.tag=2,t!=null&&(i.callback=t),t=Ys(e,i,n),t!==null&&(Un(t,e,n),Zo(t,e,n))}};function iv(e,t,n,i,s,a,r){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(i,a,r):t.prototype&&t.prototype.isPureReactComponent?!rl(n,i)||!rl(s,a):!0}function sv(e,t,n,i){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(n,i),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(n,i),t.state!==e&&Wp.enqueueReplaceState(t,t.state,null)}function Va(e,t){var n=t;if("ref"in t){n={};for(var i in t)i!=="ref"&&(n[i]=t[i])}if(e=e.defaultProps){n===t&&(n=De({},n));for(var s in e)n[s]===void 0&&(n[s]=e[s])}return n}function bx(e){_u(e)}function Sx(e){console.error(e)}function Mx(e){_u(e)}function Au(e,t){try{var n=e.onUncaughtError;n(t.value,{componentStack:t.stack})}catch(i){setTimeout(function(){throw i})}}function av(e,t,n){try{var i=e.onCaughtError;i(n.value,{componentStack:n.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(s){setTimeout(function(){throw s})}}function qp(e,t,n){return n=qs(n),n.tag=3,n.payload={element:null},n.callback=function(){Au(e,t)},n}function Ex(e){return e=qs(e),e.tag=3,e}function Tx(e,t,n,i){var s=n.type.getDerivedStateFromError;if(typeof s=="function"){var a=i.value;e.payload=function(){return s(a)},e.callback=function(){av(t,n,i)}}var r=n.stateNode;r!==null&&typeof r.componentDidCatch=="function"&&(e.callback=function(){av(t,n,i),typeof s!="function"&&(Zs===null?Zs=new Set([this]):Zs.add(this));var o=i.stack;this.componentDidCatch(i.value,{componentStack:o!==null?o:""})})}function IE(e,t,n,i,s){if(n.flags|=32768,i!==null&&typeof i=="object"&&typeof i.then=="function"){if(t=n.alternate,t!==null&&Zr(t,n,s,!0),n=qn.current,n!==null){switch(n.tag){case 31:case 13:return hi===null?Nu():n.alternate===null&&Ve===0&&(Ve=3),n.flags&=-257,n.flags|=65536,n.lanes=s,i===bu?n.flags|=16384:(t=n.updateQueue,t===null?n.updateQueue=new Set([i]):t.add(i),up(e,i,s)),!1;case 22:return n.flags|=65536,i===bu?n.flags|=16384:(t=n.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([i])},n.updateQueue=t):(n=t.retryQueue,n===null?t.retryQueue=new Set([i]):n.add(i)),up(e,i,s)),!1}throw Error(it(435,n.tag))}return up(e,i,s),Nu(),!1}if(ie)return t=qn.current,t!==null?((t.flags&65536)===0&&(t.flags|=256),t.flags|=65536,t.lanes=s,i!==Lp&&(e=Error(it(422),{cause:i}),ll(ci(e,n)))):(i!==Lp&&(t=Error(it(423),{cause:i}),ll(ci(t,n))),e=e.current.alternate,e.flags|=65536,s&=-s,e.lanes|=s,i=ci(i,n),s=qp(e.stateNode,i,s),jd(e,s),Ve!==4&&(Ve=2)),!1;var a=Error(it(520),{cause:i});if(a=ci(a,n),tl===null?tl=[a]:tl.push(a),Ve!==4&&(Ve=2),t===null)return!0;i=ci(i,n),n=t;do{switch(n.tag){case 3:return n.flags|=65536,e=s&-s,n.lanes|=e,e=qp(n.stateNode,i,e),jd(n,e),!1;case 1:if(t=n.type,a=n.stateNode,(n.flags&128)===0&&(typeof t.getDerivedStateFromError=="function"||a!==null&&typeof a.componentDidCatch=="function"&&(Zs===null||!Zs.has(a))))return n.flags|=65536,s&=-s,n.lanes|=s,s=Ex(s),Tx(s,e,n,i),jd(n,s),!1}n=n.return}while(n!==null);return!1}var qm=Error(it(461)),Je=!1;function ln(e,t,n,i){t.child=e===null?Fy(t,null,n,i):Ba(t,e.child,n,i)}function rv(e,t,n,i,s){n=n.render;var a=t.ref;if("ref"in i){var r={};for(var o in i)o!=="ref"&&(r[o]=i[o])}else r=i;return za(t),i=Im(e,t,n,r,a,s),o=Om(),e!==null&&!Je?(Pm(e,t,s),ms(e,t,s)):(ie&&o&&Am(t),t.flags|=1,ln(e,t,i,s),t.child)}function ov(e,t,n,i,s){if(e===null){var a=n.type;return typeof a=="function"&&!Tm(a)&&a.defaultProps===void 0&&n.compare===null?(t.tag=15,t.type=a,Ax(e,t,a,i,s)):(e=eu(n.type,null,i,t,t.mode,s),e.ref=t.ref,e.return=t,t.child=e)}if(a=e.child,!Ym(e,s)){var r=a.memoizedProps;if(n=n.compare,n=n!==null?n:rl,n(r,i)&&e.ref===t.ref)return ms(e,t,s)}return t.flags|=1,e=cs(a,i),e.ref=t.ref,e.return=t,t.child=e}function Ax(e,t,n,i,s){if(e!==null){var a=e.memoizedProps;if(rl(a,i)&&e.ref===t.ref)if(Je=!1,t.pendingProps=i=a,Ym(e,s))(e.flags&131072)!==0&&(Je=!0);else return t.lanes=e.lanes,ms(e,t,s)}return Yp(e,t,n,i,s)}function wx(e,t,n,i){var s=i.children,a=e!==null?e.memoizedState:null;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),i.mode==="hidden"){if((t.flags&128)!==0){if(a=a!==null?a.baseLanes|n:n,e!==null){for(i=t.child=e.child,s=0;i!==null;)s=s|i.lanes|i.childLanes,i=i.sibling;i=s&~a}else i=0,t.child=null;return lv(e,t,a,n,i)}if((n&536870912)!==0)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&nu(t,a!==null?a.cachePool:null),a!==null?K_(t,a):Vp(),Gy(t);else return i=t.lanes=536870912,lv(e,t,a!==null?a.baseLanes|n:n,n,i)}else a!==null?(nu(t,a.cachePool),K_(t,a),zs(t),t.memoizedState=null):(e!==null&&nu(t,null),Vp(),zs(t));return ln(e,t,s,n),t.child}function Go(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function lv(e,t,n,i,s){var a=Rm();return a=a===null?null:{parent:Ze._currentValue,pool:a},t.memoizedState={baseLanes:n,cachePool:a},e!==null&&nu(t,null),Vp(),Gy(t),e!==null&&Zr(e,t,i,!0),t.childLanes=s,null}function au(e,t){return t=wu({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function cv(e,t,n){return Ba(t,e.child,null,n),e=au(t,t.pendingProps),e.flags|=2,Bn(t),t.memoizedState=null,e}function OE(e,t,n){var i=t.pendingProps,s=(t.flags&128)!==0;if(t.flags&=-129,e===null){if(ie){if(i.mode==="hidden")return e=au(t,i),t.lanes=536870912,Go(null,e);if(Hp(t),(e=Re)?(e=yb(e,ui),e=e!==null&&e.data==="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:$s!==null?{id:Li,overflow:Ii}:null,retryLane:536870912,hydrationErrors:null},n=Uy(e),n.return=t,t.child=n,un=t,Re=null)):e=null,e===null)throw ta(t);return t.lanes=536870912,null}return au(t,i)}var a=e.memoizedState;if(a!==null){var r=a.dehydrated;if(Hp(t),s)if(t.flags&256)t.flags&=-257,t=cv(e,t,n);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(it(558));else if(Je||Zr(e,t,n,!1),s=(n&e.childLanes)!==0,Je||s){if(i=ve,i!==null&&(r=sy(i,n),r!==0&&r!==a.retryLane))throw a.retryLane=r,Xa(e,r),Un(i,e,r),qm;Nu(),t=cv(e,t,n)}else e=a.treeContext,Re=fi(r.nextSibling),un=t,ie=!0,Ws=null,ui=!1,e!==null&&Iy(t,e),t=au(t,i),t.flags|=4096;return t}return e=cs(e.child,{mode:i.mode,children:i.children}),e.ref=t.ref,t.child=e,e.return=t,e}function ru(e,t){var n=t.ref;if(n===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof n!="function"&&typeof n!="object")throw Error(it(284));(e===null||e.ref!==n)&&(t.flags|=4194816)}}function Yp(e,t,n,i,s){return za(t),n=Im(e,t,n,i,void 0,s),i=Om(),e!==null&&!Je?(Pm(e,t,s),ms(e,t,s)):(ie&&i&&Am(t),t.flags|=1,ln(e,t,n,s),t.child)}function uv(e,t,n,i,s,a){return za(t),t.updateQueue=null,n=Xy(t,i,n,s),ky(e),i=Om(),e!==null&&!Je?(Pm(e,t,a),ms(e,t,a)):(ie&&i&&Am(t),t.flags|=1,ln(e,t,n,a),t.child)}function hv(e,t,n,i,s){if(za(t),t.stateNode===null){var a=Er,r=n.contextType;typeof r=="object"&&r!==null&&(a=hn(r)),a=new n(i,a),t.memoizedState=a.state!==null&&a.state!==void 0?a.state:null,a.updater=Wp,t.stateNode=a,a._reactInternals=t,a=t.stateNode,a.props=i,a.state=t.memoizedState,a.refs={},Nm(t),r=n.contextType,a.context=typeof r=="object"&&r!==null?hn(r):Er,a.state=t.memoizedState,r=n.getDerivedStateFromProps,typeof r=="function"&&($d(t,n,r,i),a.state=t.memoizedState),typeof n.getDerivedStateFromProps=="function"||typeof a.getSnapshotBeforeUpdate=="function"||typeof a.UNSAFE_componentWillMount!="function"&&typeof a.componentWillMount!="function"||(r=a.state,typeof a.componentWillMount=="function"&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount=="function"&&a.UNSAFE_componentWillMount(),r!==a.state&&Wp.enqueueReplaceState(a,a.state,null),Ko(t,i,a,s),Jo(),a.state=t.memoizedState),typeof a.componentDidMount=="function"&&(t.flags|=4194308),i=!0}else if(e===null){a=t.stateNode;var o=t.memoizedProps,c=Va(n,o);a.props=c;var l=a.context,h=n.contextType;r=Er,typeof h=="object"&&h!==null&&(r=hn(h));var p=n.getDerivedStateFromProps;h=typeof p=="function"||typeof a.getSnapshotBeforeUpdate=="function",o=t.pendingProps!==o,h||typeof a.UNSAFE_componentWillReceiveProps!="function"&&typeof a.componentWillReceiveProps!="function"||(o||l!==r)&&sv(t,a,i,r),Is=!1;var u=t.memoizedState;a.state=u,Ko(t,i,a,s),Jo(),l=t.memoizedState,o||u!==l||Is?(typeof p=="function"&&($d(t,n,p,i),l=t.memoizedState),(c=Is||iv(t,n,c,i,u,l,r))?(h||typeof a.UNSAFE_componentWillMount!="function"&&typeof a.componentWillMount!="function"||(typeof a.componentWillMount=="function"&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount=="function"&&a.UNSAFE_componentWillMount()),typeof a.componentDidMount=="function"&&(t.flags|=4194308)):(typeof a.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=i,t.memoizedState=l),a.props=i,a.state=l,a.context=r,i=c):(typeof a.componentDidMount=="function"&&(t.flags|=4194308),i=!1)}else{a=t.stateNode,Bp(e,t),r=t.memoizedProps,h=Va(n,r),a.props=h,p=t.pendingProps,u=a.context,l=n.contextType,c=Er,typeof l=="object"&&l!==null&&(c=hn(l)),o=n.getDerivedStateFromProps,(l=typeof o=="function"||typeof a.getSnapshotBeforeUpdate=="function")||typeof a.UNSAFE_componentWillReceiveProps!="function"&&typeof a.componentWillReceiveProps!="function"||(r!==p||u!==c)&&sv(t,a,i,c),Is=!1,u=t.memoizedState,a.state=u,Ko(t,i,a,s),Jo();var d=t.memoizedState;r!==p||u!==d||Is||e!==null&&e.dependencies!==null&&xu(e.dependencies)?(typeof o=="function"&&($d(t,n,o,i),d=t.memoizedState),(h=Is||iv(t,n,h,i,u,d,c)||e!==null&&e.dependencies!==null&&xu(e.dependencies))?(l||typeof a.UNSAFE_componentWillUpdate!="function"&&typeof a.componentWillUpdate!="function"||(typeof a.componentWillUpdate=="function"&&a.componentWillUpdate(i,d,c),typeof a.UNSAFE_componentWillUpdate=="function"&&a.UNSAFE_componentWillUpdate(i,d,c)),typeof a.componentDidUpdate=="function"&&(t.flags|=4),typeof a.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof a.componentDidUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=1024),t.memoizedProps=i,t.memoizedState=d),a.props=i,a.state=d,a.context=c,i=h):(typeof a.componentDidUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!="function"||r===e.memoizedProps&&u===e.memoizedState||(t.flags|=1024),i=!1)}return a=i,ru(e,t),i=(t.flags&128)!==0,a||i?(a=t.stateNode,n=i&&typeof n.getDerivedStateFromError!="function"?null:a.render(),t.flags|=1,e!==null&&i?(t.child=Ba(t,e.child,null,s),t.child=Ba(t,null,n,s)):ln(e,t,n,s),t.memoizedState=a.state,e=t.child):e=ms(e,t,s),e}function fv(e,t,n,i){return Pa(),t.flags|=256,ln(e,t,n,i),t.child}var tp={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function ep(e){return{baseLanes:e,cachePool:Py()}}function np(e,t,n){return e=e!==null?e.childLanes&~n:0,t&&(e|=Vn),e}function Cx(e,t,n){var i=t.pendingProps,s=!1,a=(t.flags&128)!==0,r;if((r=a)||(r=e!==null&&e.memoizedState===null?!1:(Xe.current&2)!==0),r&&(s=!0,t.flags&=-129),r=(t.flags&32)!==0,t.flags&=-33,e===null){if(ie){if(s?Ps(t):zs(t),(e=Re)?(e=yb(e,ui),e=e!==null&&e.data!=="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:$s!==null?{id:Li,overflow:Ii}:null,retryLane:536870912,hydrationErrors:null},n=Uy(e),n.return=t,t.child=n,un=t,Re=null)):e=null,e===null)throw ta(t);return om(e)?t.lanes=32:t.lanes=536870912,null}var o=i.children;return i=i.fallback,s?(zs(t),s=t.mode,o=wu({mode:"hidden",children:o},s),i=Ua(i,s,n,null),o.return=t,i.return=t,o.sibling=i,t.child=o,i=t.child,i.memoizedState=ep(n),i.childLanes=np(e,r,n),t.memoizedState=tp,Go(null,i)):(Ps(t),Zp(t,o))}var c=e.memoizedState;if(c!==null&&(o=c.dehydrated,o!==null)){if(a)t.flags&256?(Ps(t),t.flags&=-257,t=ip(e,t,n)):t.memoizedState!==null?(zs(t),t.child=e.child,t.flags|=128,t=null):(zs(t),o=i.fallback,s=t.mode,i=wu({mode:"visible",children:i.children},s),o=Ua(o,s,n,null),o.flags|=2,i.return=t,o.return=t,i.sibling=o,t.child=i,Ba(t,e.child,null,n),i=t.child,i.memoizedState=ep(n),i.childLanes=np(e,r,n),t.memoizedState=tp,t=Go(null,i));else if(Ps(t),om(o)){if(r=o.nextSibling&&o.nextSibling.dataset,r)var l=r.dgst;r=l,i=Error(it(419)),i.stack="",i.digest=r,ll({value:i,source:null,stack:null}),t=ip(e,t,n)}else if(Je||Zr(e,t,n,!1),r=(n&e.childLanes)!==0,Je||r){if(r=ve,r!==null&&(i=sy(r,n),i!==0&&i!==c.retryLane))throw c.retryLane=i,Xa(e,i),Un(r,e,i),qm;rm(o)||Nu(),t=ip(e,t,n)}else rm(o)?(t.flags|=192,t.child=e.child,t=null):(e=c.treeContext,Re=fi(o.nextSibling),un=t,ie=!0,Ws=null,ui=!1,e!==null&&Iy(t,e),t=Zp(t,i.children),t.flags|=4096);return t}return s?(zs(t),o=i.fallback,s=t.mode,c=e.child,l=c.sibling,i=cs(c,{mode:"hidden",children:i.children}),i.subtreeFlags=c.subtreeFlags&65011712,l!==null?o=cs(l,o):(o=Ua(o,s,n,null),o.flags|=2),o.return=t,i.return=t,i.sibling=o,t.child=i,Go(null,i),i=t.child,o=e.child.memoizedState,o===null?o=ep(n):(s=o.cachePool,s!==null?(c=Ze._currentValue,s=s.parent!==c?{parent:c,pool:c}:s):s=Py(),o={baseLanes:o.baseLanes|n,cachePool:s}),i.memoizedState=o,i.childLanes=np(e,r,n),t.memoizedState=tp,Go(e.child,i)):(Ps(t),n=e.child,e=n.sibling,n=cs(n,{mode:"visible",children:i.children}),n.return=t,n.sibling=null,e!==null&&(r=t.deletions,r===null?(t.deletions=[e],t.flags|=16):r.push(e)),t.child=n,t.memoizedState=null,n)}function Zp(e,t){return t=wu({mode:"visible",children:t},e.mode),t.return=e,e.child=t}function wu(e,t){return e=Fn(22,e,null,t),e.lanes=0,e}function ip(e,t,n){return Ba(t,e.child,null,n),e=Zp(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function dv(e,t,n){e.lanes|=t;var i=e.alternate;i!==null&&(i.lanes|=t),Op(e.return,t,n)}function sp(e,t,n,i,s,a){var r=e.memoizedState;r===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:i,tail:n,tailMode:s,treeForkCount:a}:(r.isBackwards=t,r.rendering=null,r.renderingStartTime=0,r.last=i,r.tail=n,r.tailMode=s,r.treeForkCount=a)}function Rx(e,t,n){var i=t.pendingProps,s=i.revealOrder,a=i.tail;i=i.children;var r=Xe.current,o=(r&2)!==0;if(o?(r=r&1|2,t.flags|=128):r&=1,Se(Xe,r),ln(e,t,i,n),i=ie?ol:0,!o&&e!==null&&(e.flags&128)!==0)t:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&dv(e,n,t);else if(e.tag===19)dv(e,n,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break t;for(;e.sibling===null;){if(e.return===null||e.return===t)break t;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(s){case"forwards":for(n=t.child,s=null;n!==null;)e=n.alternate,e!==null&&Mu(e)===null&&(s=n),n=n.sibling;n=s,n===null?(s=t.child,t.child=null):(s=n.sibling,n.sibling=null),sp(t,!1,s,n,a,i);break;case"backwards":case"unstable_legacy-backwards":for(n=null,s=t.child,t.child=null;s!==null;){if(e=s.alternate,e!==null&&Mu(e)===null){t.child=s;break}e=s.sibling,s.sibling=n,n=s,s=e}sp(t,!0,n,null,a,i);break;case"together":sp(t,!1,null,null,void 0,i);break;default:t.memoizedState=null}return t.child}function ms(e,t,n){if(e!==null&&(t.dependencies=e.dependencies),na|=t.lanes,(n&t.childLanes)===0)if(e!==null){if(Zr(e,t,n,!1),(n&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(it(153));if(t.child!==null){for(e=t.child,n=cs(e,e.pendingProps),t.child=n,n.return=t;e.sibling!==null;)e=e.sibling,n=n.sibling=cs(e,e.pendingProps),n.return=t;n.sibling=null}return t.child}function Ym(e,t){return(e.lanes&t)!==0?!0:(e=e.dependencies,!!(e!==null&&xu(e)))}function PE(e,t,n){switch(t.tag){case 3:du(t,t.stateNode.containerInfo),Os(t,Ze,e.memoizedState.cache),Pa();break;case 27:case 5:Sp(t);break;case 4:du(t,t.stateNode.containerInfo);break;case 10:Os(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,Hp(t),null;break;case 13:var i=t.memoizedState;if(i!==null)return i.dehydrated!==null?(Ps(t),t.flags|=128,null):(n&t.child.childLanes)!==0?Cx(e,t,n):(Ps(t),e=ms(e,t,n),e!==null?e.sibling:null);Ps(t);break;case 19:var s=(e.flags&128)!==0;if(i=(n&t.childLanes)!==0,i||(Zr(e,t,n,!1),i=(n&t.childLanes)!==0),s){if(i)return Rx(e,t,n);t.flags|=128}if(s=t.memoizedState,s!==null&&(s.rendering=null,s.tail=null,s.lastEffect=null),Se(Xe,Xe.current),i)break;return null;case 22:return t.lanes=0,wx(e,t,n,t.pendingProps);case 24:Os(t,Ze,e.memoizedState.cache)}return ms(e,t,n)}function Dx(e,t,n){if(e!==null)if(e.memoizedProps!==t.pendingProps)Je=!0;else{if(!Ym(e,n)&&(t.flags&128)===0)return Je=!1,PE(e,t,n);Je=(e.flags&131072)!==0}else Je=!1,ie&&(t.flags&1048576)!==0&&Ly(t,ol,t.index);switch(t.lanes=0,t.tag){case 16:t:{var i=t.pendingProps;if(e=Ra(t.elementType),t.type=e,typeof e=="function")Tm(e)?(i=Va(e,i),t.tag=1,t=hv(null,t,e,i,n)):(t.tag=0,t=Yp(null,t,e,i,n));else{if(e!=null){var s=e.$$typeof;if(s===hm){t.tag=11,t=rv(null,t,e,i,n);break t}else if(s===fm){t.tag=14,t=ov(null,t,e,i,n);break t}}throw t=xp(e)||e,Error(it(306,t,""))}}return t;case 0:return Yp(e,t,t.type,t.pendingProps,n);case 1:return i=t.type,s=Va(i,t.pendingProps),hv(e,t,i,s,n);case 3:t:{if(du(t,t.stateNode.containerInfo),e===null)throw Error(it(387));i=t.pendingProps;var a=t.memoizedState;s=a.element,Bp(e,t),Ko(t,i,null,n);var r=t.memoizedState;if(i=r.cache,Os(t,Ze,i),i!==a.cache&&Pp(t,[Ze],n,!0),Jo(),i=r.element,a.isDehydrated)if(a={element:i,isDehydrated:!1,cache:r.cache},t.updateQueue.baseState=a,t.memoizedState=a,t.flags&256){t=fv(e,t,i,n);break t}else if(i!==s){s=ci(Error(it(424)),t),ll(s),t=fv(e,t,i,n);break t}else{switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName==="HTML"?e.ownerDocument.body:e}for(Re=fi(e.firstChild),un=t,ie=!0,Ws=null,ui=!0,n=Fy(t,null,i,n),t.child=n;n;)n.flags=n.flags&-3|4096,n=n.sibling}else{if(Pa(),i===s){t=ms(e,t,n);break t}ln(e,t,i,n)}t=t.child}return t;case 26:return ru(e,t),e===null?(n=Ov(t.type,null,t.pendingProps,null))?t.memoizedState=n:ie||(n=t.type,e=t.pendingProps,i=Ou(Xs.current).createElement(n),i[cn]=t,i[Ln]=e,fn(i,n,e),sn(i),t.stateNode=i):t.memoizedState=Ov(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return Sp(t),e===null&&ie&&(i=t.stateNode=xb(t.type,t.pendingProps,Xs.current),un=t,ui=!0,s=Re,sa(t.type)?(lm=s,Re=fi(i.firstChild)):Re=s),ln(e,t,t.pendingProps.children,n),ru(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&ie&&((s=i=Re)&&(i=uT(i,t.type,t.pendingProps,ui),i!==null?(t.stateNode=i,un=t,Re=fi(i.firstChild),ui=!1,s=!0):s=!1),s||ta(t)),Sp(t),s=t.type,a=t.pendingProps,r=e!==null?e.memoizedProps:null,i=a.children,sm(s,a)?i=null:r!==null&&sm(s,r)&&(t.flags|=32),t.memoizedState!==null&&(s=Im(e,t,wE,null,null,n),pl._currentValue=s),ru(e,t),ln(e,t,i,n),t.child;case 6:return e===null&&ie&&((e=n=Re)&&(n=hT(n,t.pendingProps,ui),n!==null?(t.stateNode=n,un=t,Re=null,e=!0):e=!1),e||ta(t)),null;case 13:return Cx(e,t,n);case 4:return du(t,t.stateNode.containerInfo),i=t.pendingProps,e===null?t.child=Ba(t,null,i,n):ln(e,t,i,n),t.child;case 11:return rv(e,t,t.type,t.pendingProps,n);case 7:return ln(e,t,t.pendingProps,n),t.child;case 8:return ln(e,t,t.pendingProps.children,n),t.child;case 12:return ln(e,t,t.pendingProps.children,n),t.child;case 10:return i=t.pendingProps,Os(t,t.type,i.value),ln(e,t,i.children,n),t.child;case 9:return s=t.type._context,i=t.pendingProps.children,za(t),s=hn(s),i=i(s),t.flags|=1,ln(e,t,i,n),t.child;case 14:return ov(e,t,t.type,t.pendingProps,n);case 15:return Ax(e,t,t.type,t.pendingProps,n);case 19:return Rx(e,t,n);case 31:return OE(e,t,n);case 22:return wx(e,t,n,t.pendingProps);case 24:return za(t),i=hn(Ze),e===null?(s=Rm(),s===null&&(s=ve,a=Cm(),s.pooledCache=a,a.refCount++,a!==null&&(s.pooledCacheLanes|=n),s=a),t.memoizedState={parent:i,cache:s},Nm(t),Os(t,Ze,s)):((e.lanes&n)!==0&&(Bp(e,t),Ko(t,null,null,n),Jo()),s=e.memoizedState,a=t.memoizedState,s.parent!==i?(s={parent:i,cache:i},t.memoizedState=s,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=s),Os(t,Ze,i)):(i=a.cache,Os(t,Ze,i),i!==s.cache&&Pp(t,[Ze],n,!0))),ln(e,t,t.pendingProps.children,n),t.child;case 29:throw t.pendingProps}throw Error(it(156,t.tag))}function ts(e){e.flags|=4}function ap(e,t,n,i,s){if((t=(e.mode&32)!==0)&&(t=!1),t){if(e.flags|=16777216,(s&335544128)===s)if(e.stateNode.complete)e.flags|=8192;else if(tb())e.flags|=8192;else throw Ia=bu,Dm}else e.flags&=-16777217}function pv(e,t){if(t.type!=="stylesheet"||(t.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!Mb(t))if(tb())e.flags|=8192;else throw Ia=bu,Dm}function Xc(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag!==22?ey():536870912,e.lanes|=t,Hr|=t)}function Oo(e,t){if(!ie)switch(e.tailMode){case"hidden":t=e.tail;for(var n=null;t!==null;)t.alternate!==null&&(n=t),t=t.sibling;n===null?e.tail=null:n.sibling=null;break;case"collapsed":n=e.tail;for(var i=null;n!==null;)n.alternate!==null&&(i=n),n=n.sibling;i===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:i.sibling=null}}function Ce(e){var t=e.alternate!==null&&e.alternate.child===e.child,n=0,i=0;if(t)for(var s=e.child;s!==null;)n|=s.lanes|s.childLanes,i|=s.subtreeFlags&65011712,i|=s.flags&65011712,s.return=e,s=s.sibling;else for(s=e.child;s!==null;)n|=s.lanes|s.childLanes,i|=s.subtreeFlags,i|=s.flags,s.return=e,s=s.sibling;return e.subtreeFlags|=i,e.childLanes=n,t}function zE(e,t,n){var i=t.pendingProps;switch(wm(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return Ce(t),null;case 1:return Ce(t),null;case 3:return n=t.stateNode,i=null,e!==null&&(i=e.memoizedState.cache),t.memoizedState.cache!==i&&(t.flags|=2048),us(Ze),Or(),n.pendingContext&&(n.context=n.pendingContext,n.pendingContext=null),(e===null||e.child===null)&&(fr(t)?ts(t):e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,Kd())),Ce(t),null;case 26:var s=t.type,a=t.memoizedState;return e===null?(ts(t),a!==null?(Ce(t),pv(t,a)):(Ce(t),ap(t,s,null,i,n))):a?a!==e.memoizedState?(ts(t),Ce(t),pv(t,a)):(Ce(t),t.flags&=-16777217):(e=e.memoizedProps,e!==i&&ts(t),Ce(t),ap(t,s,e,i,n)),null;case 27:if(pu(t),n=Xs.current,s=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&ts(t);else{if(!i){if(t.stateNode===null)throw Error(it(166));return Ce(t),null}e=Pi.current,fr(t)?k_(t,e):(e=xb(s,i,n),t.stateNode=e,ts(t))}return Ce(t),null;case 5:if(pu(t),s=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&ts(t);else{if(!i){if(t.stateNode===null)throw Error(it(166));return Ce(t),null}if(a=Pi.current,fr(t))k_(t,a);else{var r=Ou(Xs.current);switch(a){case 1:a=r.createElementNS("http://www.w3.org/2000/svg",s);break;case 2:a=r.createElementNS("http://www.w3.org/1998/Math/MathML",s);break;default:switch(s){case"svg":a=r.createElementNS("http://www.w3.org/2000/svg",s);break;case"math":a=r.createElementNS("http://www.w3.org/1998/Math/MathML",s);break;case"script":a=r.createElement("div"),a.innerHTML="<script><\/script>",a=a.removeChild(a.firstChild);break;case"select":a=typeof i.is=="string"?r.createElement("select",{is:i.is}):r.createElement("select"),i.multiple?a.multiple=!0:i.size&&(a.size=i.size);break;default:a=typeof i.is=="string"?r.createElement(s,{is:i.is}):r.createElement(s)}}a[cn]=t,a[Ln]=i;t:for(r=t.child;r!==null;){if(r.tag===5||r.tag===6)a.appendChild(r.stateNode);else if(r.tag!==4&&r.tag!==27&&r.child!==null){r.child.return=r,r=r.child;continue}if(r===t)break t;for(;r.sibling===null;){if(r.return===null||r.return===t)break t;r=r.return}r.sibling.return=r.return,r=r.sibling}t.stateNode=a;t:switch(fn(a,s,i),s){case"button":case"input":case"select":case"textarea":i=!!i.autoFocus;break t;case"img":i=!0;break t;default:i=!1}i&&ts(t)}}return Ce(t),ap(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,n),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==i&&ts(t);else{if(typeof i!="string"&&t.stateNode===null)throw Error(it(166));if(e=Xs.current,fr(t)){if(e=t.stateNode,n=t.memoizedProps,i=null,s=un,s!==null)switch(s.tag){case 27:case 5:i=s.memoizedProps}e[cn]=t,e=!!(e.nodeValue===n||i!==null&&i.suppressHydrationWarning===!0||gb(e.nodeValue,n)),e||ta(t,!0)}else e=Ou(e).createTextNode(i),e[cn]=t,t.stateNode=e}return Ce(t),null;case 31:if(n=t.memoizedState,e===null||e.memoizedState!==null){if(i=fr(t),n!==null){if(e===null){if(!i)throw Error(it(318));if(e=t.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(it(557));e[cn]=t}else Pa(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Ce(t),e=!1}else n=Kd(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=n),e=!0;if(!e)return t.flags&256?(Bn(t),t):(Bn(t),null);if((t.flags&128)!==0)throw Error(it(558))}return Ce(t),null;case 13:if(i=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(s=fr(t),i!==null&&i.dehydrated!==null){if(e===null){if(!s)throw Error(it(318));if(s=t.memoizedState,s=s!==null?s.dehydrated:null,!s)throw Error(it(317));s[cn]=t}else Pa(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Ce(t),s=!1}else s=Kd(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=s),s=!0;if(!s)return t.flags&256?(Bn(t),t):(Bn(t),null)}return Bn(t),(t.flags&128)!==0?(t.lanes=n,t):(n=i!==null,e=e!==null&&e.memoizedState!==null,n&&(i=t.child,s=null,i.alternate!==null&&i.alternate.memoizedState!==null&&i.alternate.memoizedState.cachePool!==null&&(s=i.alternate.memoizedState.cachePool.pool),a=null,i.memoizedState!==null&&i.memoizedState.cachePool!==null&&(a=i.memoizedState.cachePool.pool),a!==s&&(i.flags|=2048)),n!==e&&n&&(t.child.flags|=8192),Xc(t,t.updateQueue),Ce(t),null);case 4:return Or(),e===null&&tg(t.stateNode.containerInfo),Ce(t),null;case 10:return us(t.type),Ce(t),null;case 19:if(an(Xe),i=t.memoizedState,i===null)return Ce(t),null;if(s=(t.flags&128)!==0,a=i.rendering,a===null)if(s)Oo(i,!1);else{if(Ve!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(a=Mu(e),a!==null){for(t.flags|=128,Oo(i,!1),e=a.updateQueue,t.updateQueue=e,Xc(t,e),t.subtreeFlags=0,e=n,n=t.child;n!==null;)Ny(n,e),n=n.sibling;return Se(Xe,Xe.current&1|2),ie&&ss(t,i.treeForkCount),t.child}e=e.sibling}i.tail!==null&&Hn()>Ru&&(t.flags|=128,s=!0,Oo(i,!1),t.lanes=4194304)}else{if(!s)if(e=Mu(a),e!==null){if(t.flags|=128,s=!0,e=e.updateQueue,t.updateQueue=e,Xc(t,e),Oo(i,!0),i.tail===null&&i.tailMode==="hidden"&&!a.alternate&&!ie)return Ce(t),null}else 2*Hn()-i.renderingStartTime>Ru&&n!==536870912&&(t.flags|=128,s=!0,Oo(i,!1),t.lanes=4194304);i.isBackwards?(a.sibling=t.child,t.child=a):(e=i.last,e!==null?e.sibling=a:t.child=a,i.last=a)}return i.tail!==null?(e=i.tail,i.rendering=e,i.tail=e.sibling,i.renderingStartTime=Hn(),e.sibling=null,n=Xe.current,Se(Xe,s?n&1|2:n&1),ie&&ss(t,i.treeForkCount),e):(Ce(t),null);case 22:case 23:return Bn(t),Um(),i=t.memoizedState!==null,e!==null?e.memoizedState!==null!==i&&(t.flags|=8192):i&&(t.flags|=8192),i?(n&536870912)!==0&&(t.flags&128)===0&&(Ce(t),t.subtreeFlags&6&&(t.flags|=8192)):Ce(t),n=t.updateQueue,n!==null&&Xc(t,n.retryQueue),n=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),i=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(i=t.memoizedState.cachePool.pool),i!==n&&(t.flags|=2048),e!==null&&an(La),null;case 24:return n=null,e!==null&&(n=e.memoizedState.cache),t.memoizedState.cache!==n&&(t.flags|=2048),us(Ze),Ce(t),null;case 25:return null;case 30:return null}throw Error(it(156,t.tag))}function BE(e,t){switch(wm(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return us(Ze),Or(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return pu(t),null;case 31:if(t.memoizedState!==null){if(Bn(t),t.alternate===null)throw Error(it(340));Pa()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(Bn(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(it(340));Pa()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return an(Xe),null;case 4:return Or(),null;case 10:return us(t.type),null;case 22:case 23:return Bn(t),Um(),e!==null&&an(La),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return us(Ze),null;case 25:return null;default:return null}}function Nx(e,t){switch(wm(t),t.tag){case 3:us(Ze),Or();break;case 26:case 27:case 5:pu(t);break;case 4:Or();break;case 31:t.memoizedState!==null&&Bn(t);break;case 13:Bn(t);break;case 19:an(Xe);break;case 10:us(t.type);break;case 22:case 23:Bn(t),Um(),e!==null&&an(La);break;case 24:us(Ze)}}function Tl(e,t){try{var n=t.updateQueue,i=n!==null?n.lastEffect:null;if(i!==null){var s=i.next;n=s;do{if((n.tag&e)===e){i=void 0;var a=n.create,r=n.inst;i=a(),r.destroy=i}n=n.next}while(n!==s)}}catch(o){fe(t,t.return,o)}}function ea(e,t,n){try{var i=t.updateQueue,s=i!==null?i.lastEffect:null;if(s!==null){var a=s.next;i=a;do{if((i.tag&e)===e){var r=i.inst,o=r.destroy;if(o!==void 0){r.destroy=void 0,s=t;var c=n,l=o;try{l()}catch(h){fe(s,c,h)}}}i=i.next}while(i!==a)}}catch(h){fe(t,t.return,h)}}function Ux(e){var t=e.updateQueue;if(t!==null){var n=e.stateNode;try{Hy(t,n)}catch(i){fe(e,e.return,i)}}}function Lx(e,t,n){n.props=Va(e.type,e.memoizedProps),n.state=e.memoizedState;try{n.componentWillUnmount()}catch(i){fe(e,t,i)}}function Qo(e,t){try{var n=e.ref;if(n!==null){switch(e.tag){case 26:case 27:case 5:var i=e.stateNode;break;case 30:i=e.stateNode;break;default:i=e.stateNode}typeof n=="function"?e.refCleanup=n(i):n.current=i}}catch(s){fe(e,t,s)}}function Oi(e,t){var n=e.ref,i=e.refCleanup;if(n!==null)if(typeof i=="function")try{i()}catch(s){fe(e,t,s)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof n=="function")try{n(null)}catch(s){fe(e,t,s)}else n.current=null}function Ix(e){var t=e.type,n=e.memoizedProps,i=e.stateNode;try{t:switch(t){case"button":case"input":case"select":case"textarea":n.autoFocus&&i.focus();break t;case"img":n.src?i.src=n.src:n.srcSet&&(i.srcset=n.srcSet)}}catch(s){fe(e,e.return,s)}}function rp(e,t,n){try{var i=e.stateNode;sT(i,e.type,n,t),i[Ln]=t}catch(s){fe(e,e.return,s)}}function Ox(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&sa(e.type)||e.tag===4}function op(e){t:for(;;){for(;e.sibling===null;){if(e.return===null||Ox(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&sa(e.type)||e.flags&2||e.child===null||e.tag===4)continue t;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function Jp(e,t,n){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?(n.nodeType===9?n.body:n.nodeName==="HTML"?n.ownerDocument.body:n).insertBefore(e,t):(t=n.nodeType===9?n.body:n.nodeName==="HTML"?n.ownerDocument.body:n,t.appendChild(e),n=n._reactRootContainer,n!=null||t.onclick!==null||(t.onclick=os));else if(i!==4&&(i===27&&sa(e.type)&&(n=e.stateNode,t=null),e=e.child,e!==null))for(Jp(e,t,n),e=e.sibling;e!==null;)Jp(e,t,n),e=e.sibling}function Cu(e,t,n){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?n.insertBefore(e,t):n.appendChild(e);else if(i!==4&&(i===27&&sa(e.type)&&(n=e.stateNode),e=e.child,e!==null))for(Cu(e,t,n),e=e.sibling;e!==null;)Cu(e,t,n),e=e.sibling}function Px(e){var t=e.stateNode,n=e.memoizedProps;try{for(var i=e.type,s=t.attributes;s.length;)t.removeAttributeNode(s[0]);fn(t,i,n),t[cn]=e,t[Ln]=n}catch(a){fe(e,e.return,a)}}var as=!1,Ye=!1,lp=!1,mv=typeof WeakSet=="function"?WeakSet:Set,nn=null;function FE(e,t){if(e=e.containerInfo,nm=Fu,e=My(e),Sm(e)){if("selectionStart"in e)var n={start:e.selectionStart,end:e.selectionEnd};else t:{n=(n=e.ownerDocument)&&n.defaultView||window;var i=n.getSelection&&n.getSelection();if(i&&i.rangeCount!==0){n=i.anchorNode;var s=i.anchorOffset,a=i.focusNode;i=i.focusOffset;try{n.nodeType,a.nodeType}catch{n=null;break t}var r=0,o=-1,c=-1,l=0,h=0,p=e,u=null;e:for(;;){for(var d;p!==n||s!==0&&p.nodeType!==3||(o=r+s),p!==a||i!==0&&p.nodeType!==3||(c=r+i),p.nodeType===3&&(r+=p.nodeValue.length),(d=p.firstChild)!==null;)u=p,p=d;for(;;){if(p===e)break e;if(u===n&&++l===s&&(o=r),u===a&&++h===i&&(c=r),(d=p.nextSibling)!==null)break;p=u,u=p.parentNode}p=d}n=o===-1||c===-1?null:{start:o,end:c}}else n=null}n=n||{start:0,end:0}}else n=null;for(im={focusedElem:e,selectionRange:n},Fu=!1,nn=t;nn!==null;)if(t=nn,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,nn=e;else for(;nn!==null;){switch(t=nn,a=t.alternate,e=t.flags,t.tag){case 0:if((e&4)!==0&&(e=t.updateQueue,e=e!==null?e.events:null,e!==null))for(n=0;n<e.length;n++)s=e[n],s.ref.impl=s.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&a!==null){e=void 0,n=t,s=a.memoizedProps,a=a.memoizedState,i=n.stateNode;try{var m=Va(n.type,s);e=i.getSnapshotBeforeUpdate(m,a),i.__reactInternalSnapshotBeforeUpdate=e}catch(S){fe(n,n.return,S)}}break;case 3:if((e&1024)!==0){if(e=t.stateNode.containerInfo,n=e.nodeType,n===9)am(e);else if(n===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":am(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error(it(163))}if(e=t.sibling,e!==null){e.return=t.return,nn=e;break}nn=t.return}}function zx(e,t,n){var i=n.flags;switch(n.tag){case 0:case 11:case 15:ns(e,n),i&4&&Tl(5,n);break;case 1:if(ns(e,n),i&4)if(e=n.stateNode,t===null)try{e.componentDidMount()}catch(r){fe(n,n.return,r)}else{var s=Va(n.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(s,t,e.__reactInternalSnapshotBeforeUpdate)}catch(r){fe(n,n.return,r)}}i&64&&Ux(n),i&512&&Qo(n,n.return);break;case 3:if(ns(e,n),i&64&&(e=n.updateQueue,e!==null)){if(t=null,n.child!==null)switch(n.child.tag){case 27:case 5:t=n.child.stateNode;break;case 1:t=n.child.stateNode}try{Hy(e,t)}catch(r){fe(n,n.return,r)}}break;case 27:t===null&&i&4&&Px(n);case 26:case 5:ns(e,n),t===null&&i&4&&Ix(n),i&512&&Qo(n,n.return);break;case 12:ns(e,n);break;case 31:ns(e,n),i&4&&Vx(e,n);break;case 13:ns(e,n),i&4&&Hx(e,n),i&64&&(e=n.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(n=ZE.bind(null,n),fT(e,n))));break;case 22:if(i=n.memoizedState!==null||as,!i){t=t!==null&&t.memoizedState!==null||Ye,s=as;var a=Ye;as=i,(Ye=t)&&!a?is(e,n,(n.subtreeFlags&8772)!==0):ns(e,n),as=s,Ye=a}break;case 30:break;default:ns(e,n)}}function Bx(e){var t=e.alternate;t!==null&&(e.alternate=null,Bx(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&gm(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var Ie=null,Dn=!1;function es(e,t,n){for(n=n.child;n!==null;)Fx(e,t,n),n=n.sibling}function Fx(e,t,n){if(Gn&&typeof Gn.onCommitFiberUnmount=="function")try{Gn.onCommitFiberUnmount(vl,n)}catch{}switch(n.tag){case 26:Ye||Oi(n,t),es(e,t,n),n.memoizedState?n.memoizedState.count--:n.stateNode&&(n=n.stateNode,n.parentNode.removeChild(n));break;case 27:Ye||Oi(n,t);var i=Ie,s=Dn;sa(n.type)&&(Ie=n.stateNode,Dn=!1),es(e,t,n),nl(n.stateNode),Ie=i,Dn=s;break;case 5:Ye||Oi(n,t);case 6:if(i=Ie,s=Dn,Ie=null,es(e,t,n),Ie=i,Dn=s,Ie!==null)if(Dn)try{(Ie.nodeType===9?Ie.body:Ie.nodeName==="HTML"?Ie.ownerDocument.body:Ie).removeChild(n.stateNode)}catch(a){fe(n,t,a)}else try{Ie.removeChild(n.stateNode)}catch(a){fe(n,t,a)}break;case 18:Ie!==null&&(Dn?(e=Ie,Dv(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,n.stateNode),Wr(e)):Dv(Ie,n.stateNode));break;case 4:i=Ie,s=Dn,Ie=n.stateNode.containerInfo,Dn=!0,es(e,t,n),Ie=i,Dn=s;break;case 0:case 11:case 14:case 15:ea(2,n,t),Ye||ea(4,n,t),es(e,t,n);break;case 1:Ye||(Oi(n,t),i=n.stateNode,typeof i.componentWillUnmount=="function"&&Lx(n,t,i)),es(e,t,n);break;case 21:es(e,t,n);break;case 22:Ye=(i=Ye)||n.memoizedState!==null,es(e,t,n),Ye=i;break;default:es(e,t,n)}}function Vx(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Wr(e)}catch(n){fe(t,t.return,n)}}}function Hx(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Wr(e)}catch(n){fe(t,t.return,n)}}function VE(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new mv),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new mv),t;default:throw Error(it(435,e.tag))}}function Wc(e,t){var n=VE(e);t.forEach(function(i){if(!n.has(i)){n.add(i);var s=JE.bind(null,e,i);i.then(s,s)}})}function Cn(e,t){var n=t.deletions;if(n!==null)for(var i=0;i<n.length;i++){var s=n[i],a=e,r=t,o=r;t:for(;o!==null;){switch(o.tag){case 27:if(sa(o.type)){Ie=o.stateNode,Dn=!1;break t}break;case 5:Ie=o.stateNode,Dn=!1;break t;case 3:case 4:Ie=o.stateNode.containerInfo,Dn=!0;break t}o=o.return}if(Ie===null)throw Error(it(160));Fx(a,r,s),Ie=null,Dn=!1,a=s.alternate,a!==null&&(a.return=null),s.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)Gx(t,e),t=t.sibling}var yi=null;function Gx(e,t){var n=e.alternate,i=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:Cn(t,e),Rn(e),i&4&&(ea(3,e,e.return),Tl(3,e),ea(5,e,e.return));break;case 1:Cn(t,e),Rn(e),i&512&&(Ye||n===null||Oi(n,n.return)),i&64&&as&&(e=e.updateQueue,e!==null&&(i=e.callbacks,i!==null&&(n=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=n===null?i:n.concat(i))));break;case 26:var s=yi;if(Cn(t,e),Rn(e),i&512&&(Ye||n===null||Oi(n,n.return)),i&4){var a=n!==null?n.memoizedState:null;if(i=e.memoizedState,n===null)if(i===null)if(e.stateNode===null){t:{i=e.type,n=e.memoizedProps,s=s.ownerDocument||s;e:switch(i){case"title":a=s.getElementsByTagName("title")[0],(!a||a[bl]||a[cn]||a.namespaceURI==="http://www.w3.org/2000/svg"||a.hasAttribute("itemprop"))&&(a=s.createElement(i),s.head.insertBefore(a,s.querySelector("head > title"))),fn(a,i,n),a[cn]=e,sn(a),i=a;break t;case"link":var r=zv("link","href",s).get(i+(n.href||""));if(r){for(var o=0;o<r.length;o++)if(a=r[o],a.getAttribute("href")===(n.href==null||n.href===""?null:n.href)&&a.getAttribute("rel")===(n.rel==null?null:n.rel)&&a.getAttribute("title")===(n.title==null?null:n.title)&&a.getAttribute("crossorigin")===(n.crossOrigin==null?null:n.crossOrigin)){r.splice(o,1);break e}}a=s.createElement(i),fn(a,i,n),s.head.appendChild(a);break;case"meta":if(r=zv("meta","content",s).get(i+(n.content||""))){for(o=0;o<r.length;o++)if(a=r[o],a.getAttribute("content")===(n.content==null?null:""+n.content)&&a.getAttribute("name")===(n.name==null?null:n.name)&&a.getAttribute("property")===(n.property==null?null:n.property)&&a.getAttribute("http-equiv")===(n.httpEquiv==null?null:n.httpEquiv)&&a.getAttribute("charset")===(n.charSet==null?null:n.charSet)){r.splice(o,1);break e}}a=s.createElement(i),fn(a,i,n),s.head.appendChild(a);break;default:throw Error(it(468,i))}a[cn]=e,sn(a),i=a}e.stateNode=i}else Bv(s,e.type,e.stateNode);else e.stateNode=Pv(s,i,e.memoizedProps);else a!==i?(a===null?n.stateNode!==null&&(n=n.stateNode,n.parentNode.removeChild(n)):a.count--,i===null?Bv(s,e.type,e.stateNode):Pv(s,i,e.memoizedProps)):i===null&&e.stateNode!==null&&rp(e,e.memoizedProps,n.memoizedProps)}break;case 27:Cn(t,e),Rn(e),i&512&&(Ye||n===null||Oi(n,n.return)),n!==null&&i&4&&rp(e,e.memoizedProps,n.memoizedProps);break;case 5:if(Cn(t,e),Rn(e),i&512&&(Ye||n===null||Oi(n,n.return)),e.flags&32){s=e.stateNode;try{zr(s,"")}catch(m){fe(e,e.return,m)}}i&4&&e.stateNode!=null&&(s=e.memoizedProps,rp(e,s,n!==null?n.memoizedProps:s)),i&1024&&(lp=!0);break;case 6:if(Cn(t,e),Rn(e),i&4){if(e.stateNode===null)throw Error(it(162));i=e.memoizedProps,n=e.stateNode;try{n.nodeValue=i}catch(m){fe(e,e.return,m)}}break;case 3:if(cu=null,s=yi,yi=Pu(t.containerInfo),Cn(t,e),yi=s,Rn(e),i&4&&n!==null&&n.memoizedState.isDehydrated)try{Wr(t.containerInfo)}catch(m){fe(e,e.return,m)}lp&&(lp=!1,kx(e));break;case 4:i=yi,yi=Pu(e.stateNode.containerInfo),Cn(t,e),Rn(e),yi=i;break;case 12:Cn(t,e),Rn(e);break;case 31:Cn(t,e),Rn(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Wc(e,i)));break;case 13:Cn(t,e),Rn(e),e.child.flags&8192&&e.memoizedState!==null!=(n!==null&&n.memoizedState!==null)&&(Qu=Hn()),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Wc(e,i)));break;case 22:s=e.memoizedState!==null;var c=n!==null&&n.memoizedState!==null,l=as,h=Ye;if(as=l||s,Ye=h||c,Cn(t,e),Ye=h,as=l,Rn(e),i&8192)t:for(t=e.stateNode,t._visibility=s?t._visibility&-2:t._visibility|1,s&&(n===null||c||as||Ye||Da(e)),n=null,t=e;;){if(t.tag===5||t.tag===26){if(n===null){c=n=t;try{if(a=c.stateNode,s)r=a.style,typeof r.setProperty=="function"?r.setProperty("display","none","important"):r.display="none";else{o=c.stateNode;var p=c.memoizedProps.style,u=p!=null&&p.hasOwnProperty("display")?p.display:null;o.style.display=u==null||typeof u=="boolean"?"":(""+u).trim()}}catch(m){fe(c,c.return,m)}}}else if(t.tag===6){if(n===null){c=t;try{c.stateNode.nodeValue=s?"":c.memoizedProps}catch(m){fe(c,c.return,m)}}}else if(t.tag===18){if(n===null){c=t;try{var d=c.stateNode;s?Nv(d,!0):Nv(c.stateNode,!1)}catch(m){fe(c,c.return,m)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break t;for(;t.sibling===null;){if(t.return===null||t.return===e)break t;n===t&&(n=null),t=t.return}n===t&&(n=null),t.sibling.return=t.return,t=t.sibling}i&4&&(i=e.updateQueue,i!==null&&(n=i.retryQueue,n!==null&&(i.retryQueue=null,Wc(e,n))));break;case 19:Cn(t,e),Rn(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Wc(e,i)));break;case 30:break;case 21:break;default:Cn(t,e),Rn(e)}}function Rn(e){var t=e.flags;if(t&2){try{for(var n,i=e.return;i!==null;){if(Ox(i)){n=i;break}i=i.return}if(n==null)throw Error(it(160));switch(n.tag){case 27:var s=n.stateNode,a=op(e);Cu(e,a,s);break;case 5:var r=n.stateNode;n.flags&32&&(zr(r,""),n.flags&=-33);var o=op(e);Cu(e,o,r);break;case 3:case 4:var c=n.stateNode.containerInfo,l=op(e);Jp(e,l,c);break;default:throw Error(it(161))}}catch(h){fe(e,e.return,h)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function kx(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;kx(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function ns(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)zx(e,t.alternate,t),t=t.sibling}function Da(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:ea(4,t,t.return),Da(t);break;case 1:Oi(t,t.return);var n=t.stateNode;typeof n.componentWillUnmount=="function"&&Lx(t,t.return,n),Da(t);break;case 27:nl(t.stateNode);case 26:case 5:Oi(t,t.return),Da(t);break;case 22:t.memoizedState===null&&Da(t);break;case 30:Da(t);break;default:Da(t)}e=e.sibling}}function is(e,t,n){for(n=n&&(t.subtreeFlags&8772)!==0,t=t.child;t!==null;){var i=t.alternate,s=e,a=t,r=a.flags;switch(a.tag){case 0:case 11:case 15:is(s,a,n),Tl(4,a);break;case 1:if(is(s,a,n),i=a,s=i.stateNode,typeof s.componentDidMount=="function")try{s.componentDidMount()}catch(l){fe(i,i.return,l)}if(i=a,s=i.updateQueue,s!==null){var o=i.stateNode;try{var c=s.shared.hiddenCallbacks;if(c!==null)for(s.shared.hiddenCallbacks=null,s=0;s<c.length;s++)Vy(c[s],o)}catch(l){fe(i,i.return,l)}}n&&r&64&&Ux(a),Qo(a,a.return);break;case 27:Px(a);case 26:case 5:is(s,a,n),n&&i===null&&r&4&&Ix(a),Qo(a,a.return);break;case 12:is(s,a,n);break;case 31:is(s,a,n),n&&r&4&&Vx(s,a);break;case 13:is(s,a,n),n&&r&4&&Hx(s,a);break;case 22:a.memoizedState===null&&is(s,a,n),Qo(a,a.return);break;case 30:break;default:is(s,a,n)}t=t.sibling}}function Zm(e,t){var n=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==n&&(e!=null&&e.refCount++,n!=null&&Ml(n))}function Jm(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Ml(e))}function vi(e,t,n,i){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)Xx(e,t,n,i),t=t.sibling}function Xx(e,t,n,i){var s=t.flags;switch(t.tag){case 0:case 11:case 15:vi(e,t,n,i),s&2048&&Tl(9,t);break;case 1:vi(e,t,n,i);break;case 3:vi(e,t,n,i),s&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Ml(e)));break;case 12:if(s&2048){vi(e,t,n,i),e=t.stateNode;try{var a=t.memoizedProps,r=a.id,o=a.onPostCommit;typeof o=="function"&&o(r,t.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(c){fe(t,t.return,c)}}else vi(e,t,n,i);break;case 31:vi(e,t,n,i);break;case 13:vi(e,t,n,i);break;case 23:break;case 22:a=t.stateNode,r=t.alternate,t.memoizedState!==null?a._visibility&2?vi(e,t,n,i):$o(e,t):a._visibility&2?vi(e,t,n,i):(a._visibility|=2,pr(e,t,n,i,(t.subtreeFlags&10256)!==0||!1)),s&2048&&Zm(r,t);break;case 24:vi(e,t,n,i),s&2048&&Jm(t.alternate,t);break;default:vi(e,t,n,i)}}function pr(e,t,n,i,s){for(s=s&&((t.subtreeFlags&10256)!==0||!1),t=t.child;t!==null;){var a=e,r=t,o=n,c=i,l=r.flags;switch(r.tag){case 0:case 11:case 15:pr(a,r,o,c,s),Tl(8,r);break;case 23:break;case 22:var h=r.stateNode;r.memoizedState!==null?h._visibility&2?pr(a,r,o,c,s):$o(a,r):(h._visibility|=2,pr(a,r,o,c,s)),s&&l&2048&&Zm(r.alternate,r);break;case 24:pr(a,r,o,c,s),s&&l&2048&&Jm(r.alternate,r);break;default:pr(a,r,o,c,s)}t=t.sibling}}function $o(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var n=e,i=t,s=i.flags;switch(i.tag){case 22:$o(n,i),s&2048&&Zm(i.alternate,i);break;case 24:$o(n,i),s&2048&&Jm(i.alternate,i);break;default:$o(n,i)}t=t.sibling}}var ko=8192;function dr(e,t,n){if(e.subtreeFlags&ko)for(e=e.child;e!==null;)Wx(e,t,n),e=e.sibling}function Wx(e,t,n){switch(e.tag){case 26:dr(e,t,n),e.flags&ko&&e.memoizedState!==null&&ET(n,yi,e.memoizedState,e.memoizedProps);break;case 5:dr(e,t,n);break;case 3:case 4:var i=yi;yi=Pu(e.stateNode.containerInfo),dr(e,t,n),yi=i;break;case 22:e.memoizedState===null&&(i=e.alternate,i!==null&&i.memoizedState!==null?(i=ko,ko=16777216,dr(e,t,n),ko=i):dr(e,t,n));break;default:dr(e,t,n)}}function qx(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function Po(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var n=0;n<t.length;n++){var i=t[n];nn=i,Zx(i,e)}qx(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)Yx(e),e=e.sibling}function Yx(e){switch(e.tag){case 0:case 11:case 15:Po(e),e.flags&2048&&ea(9,e,e.return);break;case 3:Po(e);break;case 12:Po(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,ou(e)):Po(e);break;default:Po(e)}}function ou(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var n=0;n<t.length;n++){var i=t[n];nn=i,Zx(i,e)}qx(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:ea(8,t,t.return),ou(t);break;case 22:n=t.stateNode,n._visibility&2&&(n._visibility&=-3,ou(t));break;default:ou(t)}e=e.sibling}}function Zx(e,t){for(;nn!==null;){var n=nn;switch(n.tag){case 0:case 11:case 15:ea(8,n,t);break;case 23:case 22:if(n.memoizedState!==null&&n.memoizedState.cachePool!==null){var i=n.memoizedState.cachePool.pool;i!=null&&i.refCount++}break;case 24:Ml(n.memoizedState.cache)}if(i=n.child,i!==null)i.return=n,nn=i;else t:for(n=e;nn!==null;){i=nn;var s=i.sibling,a=i.return;if(Bx(i),i===n){nn=null;break t}if(s!==null){s.return=a,nn=s;break t}nn=a}}}var HE={getCacheForType:function(e){var t=hn(Ze),n=t.data.get(e);return n===void 0&&(n=e(),t.data.set(e,n)),n},cacheSignal:function(){return hn(Ze).controller.signal}},GE=typeof WeakMap=="function"?WeakMap:Map,oe=0,ve=null,Kt=null,te=0,he=0,zn=null,Hs=!1,Kr=!1,Km=!1,gs=0,Ve=0,na=0,Oa=0,jm=0,Vn=0,Hr=0,tl=null,Nn=null,Kp=!1,Qu=0,Jx=0,Ru=1/0,Du=null,Zs=null,Qe=0,Js=null,Gr=null,hs=0,jp=0,Qp=null,Kx=null,el=0,$p=null;function Xn(){return(oe&2)!==0&&te!==0?te&-te:Bt.T!==null?$m():ay()}function jx(){if(Vn===0)if((te&536870912)===0||ie){var e=Oc;Oc<<=1,(Oc&3932160)===0&&(Oc=262144),Vn=e}else Vn=536870912;return e=qn.current,e!==null&&(e.flags|=32),Vn}function Un(e,t,n){(e===ve&&(he===2||he===9)||e.cancelPendingCommit!==null)&&(kr(e,0),Gs(e,te,Vn,!1)),xl(e,n),((oe&2)===0||e!==ve)&&(e===ve&&((oe&2)===0&&(Oa|=n),Ve===4&&Gs(e,te,Vn,!1)),Bi(e))}function Qx(e,t,n){if((oe&6)!==0)throw Error(it(327));var i=!n&&(t&127)===0&&(t&e.expiredLanes)===0||yl(e,t),s=i?WE(e,t):cp(e,t,!0),a=i;do{if(s===0){Kr&&!i&&Gs(e,t,0,!1);break}else{if(n=e.current.alternate,a&&!kE(n)){s=cp(e,t,!1),a=!1;continue}if(s===2){if(a=t,e.errorRecoveryDisabledLanes&a)var r=0;else r=e.pendingLanes&-536870913,r=r!==0?r:r&536870912?536870912:0;if(r!==0){t=r;t:{var o=e;s=tl;var c=o.current.memoizedState.isDehydrated;if(c&&(kr(o,r).flags|=256),r=cp(o,r,!1),r!==2){if(Km&&!c){o.errorRecoveryDisabledLanes|=a,Oa|=a,s=4;break t}a=Nn,Nn=s,a!==null&&(Nn===null?Nn=a:Nn.push.apply(Nn,a))}s=r}if(a=!1,s!==2)continue}}if(s===1){kr(e,0),Gs(e,t,0,!0);break}t:{switch(i=e,a=s,a){case 0:case 1:throw Error(it(345));case 4:if((t&4194048)!==t)break;case 6:Gs(i,t,Vn,!Hs);break t;case 2:Nn=null;break;case 3:case 5:break;default:throw Error(it(329))}if((t&62914560)===t&&(s=Qu+300-Hn(),10<s)){if(Gs(i,t,Vn,!Hs),Hu(i,0,!0)!==0)break t;hs=t,i.timeoutHandle=vb(gv.bind(null,i,n,Nn,Du,Kp,t,Vn,Oa,Hr,Hs,a,"Throttled",-0,0),s);break t}gv(i,n,Nn,Du,Kp,t,Vn,Oa,Hr,Hs,a,null,-0,0)}}break}while(!0);Bi(e)}function gv(e,t,n,i,s,a,r,o,c,l,h,p,u,d){if(e.timeoutHandle=-1,p=t.subtreeFlags,p&8192||(p&16785408)===16785408){p={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:os},Wx(t,a,p);var m=(a&62914560)===a?Qu-Hn():(a&4194048)===a?Jx-Hn():0;if(m=TT(p,m),m!==null){hs=a,e.cancelPendingCommit=m(vv.bind(null,e,t,a,n,i,s,r,o,c,h,p,null,u,d)),Gs(e,a,r,!l);return}}vv(e,t,a,n,i,s,r,o,c)}function kE(e){for(var t=e;;){var n=t.tag;if((n===0||n===11||n===15)&&t.flags&16384&&(n=t.updateQueue,n!==null&&(n=n.stores,n!==null)))for(var i=0;i<n.length;i++){var s=n[i],a=s.getSnapshot;s=s.value;try{if(!Wn(a(),s))return!1}catch{return!1}}if(n=t.child,t.subtreeFlags&16384&&n!==null)n.return=t,t=n;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function Gs(e,t,n,i){t&=~jm,t&=~Oa,e.suspendedLanes|=t,e.pingedLanes&=~t,i&&(e.warmLanes|=t),i=e.expirationTimes;for(var s=t;0<s;){var a=31-kn(s),r=1<<a;i[a]=-1,s&=~r}n!==0&&ny(e,n,t)}function $u(){return(oe&6)===0?(Al(0,!1),!1):!0}function Qm(){if(Kt!==null){if(he===0)var e=Kt.return;else e=Kt,ls=Wa=null,zm(e),Ur=null,cl=0,e=Kt;for(;e!==null;)Nx(e.alternate,e),e=e.return;Kt=null}}function kr(e,t){var n=e.timeoutHandle;n!==-1&&(e.timeoutHandle=-1,oT(n)),n=e.cancelPendingCommit,n!==null&&(e.cancelPendingCommit=null,n()),hs=0,Qm(),ve=e,Kt=n=cs(e.current,null),te=t,he=0,zn=null,Hs=!1,Kr=yl(e,t),Km=!1,Hr=Vn=jm=Oa=na=Ve=0,Nn=tl=null,Kp=!1,(t&8)!==0&&(t|=t&32);var i=e.entangledLanes;if(i!==0)for(e=e.entanglements,i&=t;0<i;){var s=31-kn(i),a=1<<s;t|=e[s],i&=~a}return gs=t,Wu(),n}function $x(e,t){Xt=null,Bt.H=hl,t===Jr||t===Yu?(t=Z_(),he=3):t===Dm?(t=Z_(),he=4):he=t===qm?8:t!==null&&typeof t=="object"&&typeof t.then=="function"?6:1,zn=t,Kt===null&&(Ve=1,Au(e,ci(t,e.current)))}function tb(){var e=qn.current;return e===null?!0:(te&4194048)===te?hi===null:(te&62914560)===te||(te&536870912)!==0?e===hi:!1}function eb(){var e=Bt.H;return Bt.H=hl,e===null?hl:e}function nb(){var e=Bt.A;return Bt.A=HE,e}function Nu(){Ve=4,Hs||(te&4194048)!==te&&qn.current!==null||(Kr=!0),(na&134217727)===0&&(Oa&134217727)===0||ve===null||Gs(ve,te,Vn,!1)}function cp(e,t,n){var i=oe;oe|=2;var s=eb(),a=nb();(ve!==e||te!==t)&&(Du=null,kr(e,t)),t=!1;var r=Ve;t:do try{if(he!==0&&Kt!==null){var o=Kt,c=zn;switch(he){case 8:Qm(),r=6;break t;case 3:case 2:case 9:case 6:qn.current===null&&(t=!0);var l=he;if(he=0,zn=null,wr(e,o,c,l),n&&Kr){r=0;break t}break;default:l=he,he=0,zn=null,wr(e,o,c,l)}}XE(),r=Ve;break}catch(h){$x(e,h)}while(!0);return t&&e.shellSuspendCounter++,ls=Wa=null,oe=i,Bt.H=s,Bt.A=a,Kt===null&&(ve=null,te=0,Wu()),r}function XE(){for(;Kt!==null;)ib(Kt)}function WE(e,t){var n=oe;oe|=2;var i=eb(),s=nb();ve!==e||te!==t?(Du=null,Ru=Hn()+500,kr(e,t)):Kr=yl(e,t);t:do try{if(he!==0&&Kt!==null){t=Kt;var a=zn;e:switch(he){case 1:he=0,zn=null,wr(e,t,a,1);break;case 2:case 9:if(Y_(a)){he=0,zn=null,_v(t);break}t=function(){he!==2&&he!==9||ve!==e||(he=7),Bi(e)},a.then(t,t);break t;case 3:he=7;break t;case 4:he=5;break t;case 7:Y_(a)?(he=0,zn=null,_v(t)):(he=0,zn=null,wr(e,t,a,7));break;case 5:var r=null;switch(Kt.tag){case 26:r=Kt.memoizedState;case 5:case 27:var o=Kt;if(r?Mb(r):o.stateNode.complete){he=0,zn=null;var c=o.sibling;if(c!==null)Kt=c;else{var l=o.return;l!==null?(Kt=l,th(l)):Kt=null}break e}}he=0,zn=null,wr(e,t,a,5);break;case 6:he=0,zn=null,wr(e,t,a,6);break;case 8:Qm(),Ve=6;break t;default:throw Error(it(462))}}qE();break}catch(h){$x(e,h)}while(!0);return ls=Wa=null,Bt.H=i,Bt.A=s,oe=n,Kt!==null?0:(ve=null,te=0,Wu(),Ve)}function qE(){for(;Kt!==null&&!m1();)ib(Kt)}function ib(e){var t=Dx(e.alternate,e,gs);e.memoizedProps=e.pendingProps,t===null?th(e):Kt=t}function _v(e){var t=e,n=t.alternate;switch(t.tag){case 15:case 0:t=uv(n,t,t.pendingProps,t.type,void 0,te);break;case 11:t=uv(n,t,t.pendingProps,t.type.render,t.ref,te);break;case 5:zm(t);default:Nx(n,t),t=Kt=Ny(t,gs),t=Dx(n,t,gs)}e.memoizedProps=e.pendingProps,t===null?th(e):Kt=t}function wr(e,t,n,i){ls=Wa=null,zm(t),Ur=null,cl=0;var s=t.return;try{if(IE(e,s,t,n,te)){Ve=1,Au(e,ci(n,e.current)),Kt=null;return}}catch(a){if(s!==null)throw Kt=s,a;Ve=1,Au(e,ci(n,e.current)),Kt=null;return}t.flags&32768?(ie||i===1?e=!0:Kr||(te&536870912)!==0?e=!1:(Hs=e=!0,(i===2||i===9||i===3||i===6)&&(i=qn.current,i!==null&&i.tag===13&&(i.flags|=16384))),sb(t,e)):th(t)}function th(e){var t=e;do{if((t.flags&32768)!==0){sb(t,Hs);return}e=t.return;var n=zE(t.alternate,t,gs);if(n!==null){Kt=n;return}if(t=t.sibling,t!==null){Kt=t;return}Kt=t=e}while(t!==null);Ve===0&&(Ve=5)}function sb(e,t){do{var n=BE(e.alternate,e);if(n!==null){n.flags&=32767,Kt=n;return}if(n=e.return,n!==null&&(n.flags|=32768,n.subtreeFlags=0,n.deletions=null),!t&&(e=e.sibling,e!==null)){Kt=e;return}Kt=e=n}while(e!==null);Ve=6,Kt=null}function vv(e,t,n,i,s,a,r,o,c){e.cancelPendingCommit=null;do eh();while(Qe!==0);if((oe&6)!==0)throw Error(it(327));if(t!==null){if(t===e.current)throw Error(it(177));if(a=t.lanes|t.childLanes,a|=Mm,T1(e,n,a,r,o,c),e===ve&&(Kt=ve=null,te=0),Gr=t,Js=e,hs=n,jp=a,Qp=s,Kx=i,(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,KE(mu,function(){return cb(),null})):(e.callbackNode=null,e.callbackPriority=0),i=(t.flags&13878)!==0,(t.subtreeFlags&13878)!==0||i){i=Bt.T,Bt.T=null,s=le.p,le.p=2,r=oe,oe|=4;try{FE(e,t,n)}finally{oe=r,le.p=s,Bt.T=i}}Qe=1,ab(),rb(),ob()}}function ab(){if(Qe===1){Qe=0;var e=Js,t=Gr,n=(t.flags&13878)!==0;if((t.subtreeFlags&13878)!==0||n){n=Bt.T,Bt.T=null;var i=le.p;le.p=2;var s=oe;oe|=4;try{Gx(t,e);var a=im,r=My(e.containerInfo),o=a.focusedElem,c=a.selectionRange;if(r!==o&&o&&o.ownerDocument&&Sy(o.ownerDocument.documentElement,o)){if(c!==null&&Sm(o)){var l=c.start,h=c.end;if(h===void 0&&(h=l),"selectionStart"in o)o.selectionStart=l,o.selectionEnd=Math.min(h,o.value.length);else{var p=o.ownerDocument||document,u=p&&p.defaultView||window;if(u.getSelection){var d=u.getSelection(),m=o.textContent.length,S=Math.min(c.start,m),g=c.end===void 0?S:Math.min(c.end,m);!d.extend&&S>g&&(r=g,g=S,S=r);var f=V_(o,S),_=V_(o,g);if(f&&_&&(d.rangeCount!==1||d.anchorNode!==f.node||d.anchorOffset!==f.offset||d.focusNode!==_.node||d.focusOffset!==_.offset)){var x=p.createRange();x.setStart(f.node,f.offset),d.removeAllRanges(),S>g?(d.addRange(x),d.extend(_.node,_.offset)):(x.setEnd(_.node,_.offset),d.addRange(x))}}}}for(p=[],d=o;d=d.parentNode;)d.nodeType===1&&p.push({element:d,left:d.scrollLeft,top:d.scrollTop});for(typeof o.focus=="function"&&o.focus(),o=0;o<p.length;o++){var v=p[o];v.element.scrollLeft=v.left,v.element.scrollTop=v.top}}Fu=!!nm,im=nm=null}finally{oe=s,le.p=i,Bt.T=n}}e.current=t,Qe=2}}function rb(){if(Qe===2){Qe=0;var e=Js,t=Gr,n=(t.flags&8772)!==0;if((t.subtreeFlags&8772)!==0||n){n=Bt.T,Bt.T=null;var i=le.p;le.p=2;var s=oe;oe|=4;try{zx(e,t.alternate,t)}finally{oe=s,le.p=i,Bt.T=n}}Qe=3}}function ob(){if(Qe===4||Qe===3){Qe=0,g1();var e=Js,t=Gr,n=hs,i=Kx;(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?Qe=5:(Qe=0,Gr=Js=null,lb(e,e.pendingLanes));var s=e.pendingLanes;if(s===0&&(Zs=null),mm(n),t=t.stateNode,Gn&&typeof Gn.onCommitFiberRoot=="function")try{Gn.onCommitFiberRoot(vl,t,void 0,(t.current.flags&128)===128)}catch{}if(i!==null){t=Bt.T,s=le.p,le.p=2,Bt.T=null;try{for(var a=e.onRecoverableError,r=0;r<i.length;r++){var o=i[r];a(o.value,{componentStack:o.stack})}}finally{Bt.T=t,le.p=s}}(hs&3)!==0&&eh(),Bi(e),s=e.pendingLanes,(n&261930)!==0&&(s&42)!==0?e===$p?el++:(el=0,$p=e):el=0,Al(0,!1)}}function lb(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,Ml(t)))}function eh(){return ab(),rb(),ob(),cb()}function cb(){if(Qe!==5)return!1;var e=Js,t=jp;jp=0;var n=mm(hs),i=Bt.T,s=le.p;try{le.p=32>n?32:n,Bt.T=null,n=Qp,Qp=null;var a=Js,r=hs;if(Qe=0,Gr=Js=null,hs=0,(oe&6)!==0)throw Error(it(331));var o=oe;if(oe|=4,Yx(a.current),Xx(a,a.current,r,n),oe=o,Al(0,!1),Gn&&typeof Gn.onPostCommitFiberRoot=="function")try{Gn.onPostCommitFiberRoot(vl,a)}catch{}return!0}finally{le.p=s,Bt.T=i,lb(e,t)}}function yv(e,t,n){t=ci(n,t),t=qp(e.stateNode,t,2),e=Ys(e,t,2),e!==null&&(xl(e,2),Bi(e))}function fe(e,t,n){if(e.tag===3)yv(e,e,n);else for(;t!==null;){if(t.tag===3){yv(t,e,n);break}else if(t.tag===1){var i=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(Zs===null||!Zs.has(i))){e=ci(n,e),n=Ex(2),i=Ys(t,n,2),i!==null&&(Tx(n,i,t,e),xl(i,2),Bi(i));break}}t=t.return}}function up(e,t,n){var i=e.pingCache;if(i===null){i=e.pingCache=new GE;var s=new Set;i.set(t,s)}else s=i.get(t),s===void 0&&(s=new Set,i.set(t,s));s.has(n)||(Km=!0,s.add(n),e=YE.bind(null,e,t,n),t.then(e,e))}function YE(e,t,n){var i=e.pingCache;i!==null&&i.delete(t),e.pingedLanes|=e.suspendedLanes&n,e.warmLanes&=~n,ve===e&&(te&n)===n&&(Ve===4||Ve===3&&(te&62914560)===te&&300>Hn()-Qu?(oe&2)===0&&kr(e,0):jm|=n,Hr===te&&(Hr=0)),Bi(e)}function ub(e,t){t===0&&(t=ey()),e=Xa(e,t),e!==null&&(xl(e,t),Bi(e))}function ZE(e){var t=e.memoizedState,n=0;t!==null&&(n=t.retryLane),ub(e,n)}function JE(e,t){var n=0;switch(e.tag){case 31:case 13:var i=e.stateNode,s=e.memoizedState;s!==null&&(n=s.retryLane);break;case 19:i=e.stateNode;break;case 22:i=e.stateNode._retryCache;break;default:throw Error(it(314))}i!==null&&i.delete(t),ub(e,n)}function KE(e,t){return dm(e,t)}var Uu=null,mr=null,tm=!1,Lu=!1,hp=!1,ks=0;function Bi(e){e!==mr&&e.next===null&&(mr===null?Uu=mr=e:mr=mr.next=e),Lu=!0,tm||(tm=!0,QE())}function Al(e,t){if(!hp&&Lu){hp=!0;do for(var n=!1,i=Uu;i!==null;){if(!t)if(e!==0){var s=i.pendingLanes;if(s===0)var a=0;else{var r=i.suspendedLanes,o=i.pingedLanes;a=(1<<31-kn(42|e)+1)-1,a&=s&~(r&~o),a=a&201326741?a&201326741|1:a?a|2:0}a!==0&&(n=!0,xv(i,a))}else a=te,a=Hu(i,i===ve?a:0,i.cancelPendingCommit!==null||i.timeoutHandle!==-1),(a&3)===0||yl(i,a)||(n=!0,xv(i,a));i=i.next}while(n);hp=!1}}function jE(){hb()}function hb(){Lu=tm=!1;var e=0;ks!==0&&rT()&&(e=ks);for(var t=Hn(),n=null,i=Uu;i!==null;){var s=i.next,a=fb(i,t);a===0?(i.next=null,n===null?Uu=s:n.next=s,s===null&&(mr=n)):(n=i,(e!==0||(a&3)!==0)&&(Lu=!0)),i=s}Qe!==0&&Qe!==5||Al(e,!1),ks!==0&&(ks=0)}function fb(e,t){for(var n=e.suspendedLanes,i=e.pingedLanes,s=e.expirationTimes,a=e.pendingLanes&-62914561;0<a;){var r=31-kn(a),o=1<<r,c=s[r];c===-1?((o&n)===0||(o&i)!==0)&&(s[r]=E1(o,t)):c<=t&&(e.expiredLanes|=o),a&=~o}if(t=ve,n=te,n=Hu(e,e===t?n:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i=e.callbackNode,n===0||e===t&&(he===2||he===9)||e.cancelPendingCommit!==null)return i!==null&&i!==null&&Vd(i),e.callbackNode=null,e.callbackPriority=0;if((n&3)===0||yl(e,n)){if(t=n&-n,t===e.callbackPriority)return t;switch(i!==null&&Vd(i),mm(n)){case 2:case 8:n=$v;break;case 32:n=mu;break;case 268435456:n=ty;break;default:n=mu}return i=db.bind(null,e),n=dm(n,i),e.callbackPriority=t,e.callbackNode=n,t}return i!==null&&i!==null&&Vd(i),e.callbackPriority=2,e.callbackNode=null,2}function db(e,t){if(Qe!==0&&Qe!==5)return e.callbackNode=null,e.callbackPriority=0,null;var n=e.callbackNode;if(eh()&&e.callbackNode!==n)return null;var i=te;return i=Hu(e,e===ve?i:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i===0?null:(Qx(e,i,t),fb(e,Hn()),e.callbackNode!=null&&e.callbackNode===n?db.bind(null,e):null)}function xv(e,t){if(eh())return null;Qx(e,t,!0)}function QE(){lT(function(){(oe&6)!==0?dm(Qv,jE):hb()})}function $m(){if(ks===0){var e=Br;e===0&&(e=Ic,Ic<<=1,(Ic&261888)===0&&(Ic=256)),ks=e}return ks}function bv(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:Qc(""+e)}function Sv(e,t){var n=t.ownerDocument.createElement("input");return n.name=t.name,n.value=t.value,e.id&&n.setAttribute("form",e.id),t.parentNode.insertBefore(n,t),e=new FormData(e),n.parentNode.removeChild(n),e}function $E(e,t,n,i,s){if(t==="submit"&&n&&n.stateNode===s){var a=bv((s[Ln]||null).action),r=i.submitter;r&&(t=(t=r[Ln]||null)?bv(t.formAction):r.getAttribute("formAction"),t!==null&&(a=t,r=null));var o=new Gu("action","action",null,i,s);e.push({event:o,listeners:[{instance:null,listener:function(){if(i.defaultPrevented){if(ks!==0){var c=r?Sv(s,r):new FormData(s);Xp(n,{pending:!0,data:c,method:s.method,action:a},null,c)}}else typeof a=="function"&&(o.preventDefault(),c=r?Sv(s,r):new FormData(s),Xp(n,{pending:!0,data:c,method:s.method,action:a},a,c))},currentTarget:s}]})}}for(qc=0;qc<Up.length;qc++)Yc=Up[qc],Mv=Yc.toLowerCase(),Ev=Yc[0].toUpperCase()+Yc.slice(1),xi(Mv,"on"+Ev);var Yc,Mv,Ev,qc;xi(Ty,"onAnimationEnd");xi(Ay,"onAnimationIteration");xi(wy,"onAnimationStart");xi("dblclick","onDoubleClick");xi("focusin","onFocus");xi("focusout","onBlur");xi(_E,"onTransitionRun");xi(vE,"onTransitionStart");xi(yE,"onTransitionCancel");xi(Cy,"onTransitionEnd");Pr("onMouseEnter",["mouseout","mouseover"]);Pr("onMouseLeave",["mouseout","mouseover"]);Pr("onPointerEnter",["pointerout","pointerover"]);Pr("onPointerLeave",["pointerout","pointerover"]);Ha("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));Ha("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));Ha("onBeforeInput",["compositionend","keypress","textInput","paste"]);Ha("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));Ha("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));Ha("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var fl="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),tT=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(fl));function pb(e,t){t=(t&4)!==0;for(var n=0;n<e.length;n++){var i=e[n],s=i.event;i=i.listeners;t:{var a=void 0;if(t)for(var r=i.length-1;0<=r;r--){var o=i[r],c=o.instance,l=o.currentTarget;if(o=o.listener,c!==a&&s.isPropagationStopped())break t;a=o,s.currentTarget=l;try{a(s)}catch(h){_u(h)}s.currentTarget=null,a=c}else for(r=0;r<i.length;r++){if(o=i[r],c=o.instance,l=o.currentTarget,o=o.listener,c!==a&&s.isPropagationStopped())break t;a=o,s.currentTarget=l;try{a(s)}catch(h){_u(h)}s.currentTarget=null,a=c}}}}function Jt(e,t){var n=t[Ep];n===void 0&&(n=t[Ep]=new Set);var i=e+"__bubble";n.has(i)||(mb(t,e,2,!1),n.add(i))}function fp(e,t,n){var i=0;t&&(i|=4),mb(n,e,i,t)}var Zc="_reactListening"+Math.random().toString(36).slice(2);function tg(e){if(!e[Zc]){e[Zc]=!0,ry.forEach(function(n){n!=="selectionchange"&&(tT.has(n)||fp(n,!1,e),fp(n,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[Zc]||(t[Zc]=!0,fp("selectionchange",!1,t))}}function mb(e,t,n,i){switch(Cb(t)){case 2:var s=CT;break;case 8:s=RT;break;default:s=sg}n=s.bind(null,t,n,e),s=void 0,!Rp||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(s=!0),i?s!==void 0?e.addEventListener(t,n,{capture:!0,passive:s}):e.addEventListener(t,n,!0):s!==void 0?e.addEventListener(t,n,{passive:s}):e.addEventListener(t,n,!1)}function dp(e,t,n,i,s){var a=i;if((t&1)===0&&(t&2)===0&&i!==null)t:for(;;){if(i===null)return;var r=i.tag;if(r===3||r===4){var o=i.stateNode.containerInfo;if(o===s)break;if(r===4)for(r=i.return;r!==null;){var c=r.tag;if((c===3||c===4)&&r.stateNode.containerInfo===s)return;r=r.return}for(;o!==null;){if(r=vr(o),r===null)return;if(c=r.tag,c===5||c===6||c===26||c===27){i=a=r;continue t}o=o.parentNode}}i=i.return}py(function(){var l=a,h=vm(n),p=[];t:{var u=Ry.get(e);if(u!==void 0){var d=Gu,m=e;switch(e){case"keypress":if(tu(n)===0)break t;case"keydown":case"keyup":d=J1;break;case"focusin":m="focus",d=Wd;break;case"focusout":m="blur",d=Wd;break;case"beforeblur":case"afterblur":d=Wd;break;case"click":if(n.button===2)break t;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":d=N_;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":d=z1;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":d=Q1;break;case Ty:case Ay:case wy:d=V1;break;case Cy:d=tE;break;case"scroll":case"scrollend":d=O1;break;case"wheel":d=nE;break;case"copy":case"cut":case"paste":d=G1;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":d=L_;break;case"toggle":case"beforetoggle":d=sE}var S=(t&4)!==0,g=!S&&(e==="scroll"||e==="scrollend"),f=S?u!==null?u+"Capture":null:u;S=[];for(var _=l,x;_!==null;){var v=_;if(x=v.stateNode,v=v.tag,v!==5&&v!==26&&v!==27||x===null||f===null||(v=sl(_,f),v!=null&&S.push(dl(_,v,x))),g)break;_=_.return}0<S.length&&(u=new d(u,m,null,n,h),p.push({event:u,listeners:S}))}}if((t&7)===0){t:{if(u=e==="mouseover"||e==="pointerover",d=e==="mouseout"||e==="pointerout",u&&n!==Cp&&(m=n.relatedTarget||n.fromElement)&&(vr(m)||m[qr]))break t;if((d||u)&&(u=h.window===h?h:(u=h.ownerDocument)?u.defaultView||u.parentWindow:window,d?(m=n.relatedTarget||n.toElement,d=l,m=m?vr(m):null,m!==null&&(g=_l(m),S=m.tag,m!==g||S!==5&&S!==27&&S!==6)&&(m=null)):(d=null,m=l),d!==m)){if(S=N_,v="onMouseLeave",f="onMouseEnter",_="mouse",(e==="pointerout"||e==="pointerover")&&(S=L_,v="onPointerLeave",f="onPointerEnter",_="pointer"),g=d==null?u:Ho(d),x=m==null?u:Ho(m),u=new S(v,_+"leave",d,n,h),u.target=g,u.relatedTarget=x,v=null,vr(h)===l&&(S=new S(f,_+"enter",m,n,h),S.target=x,S.relatedTarget=g,v=S),g=v,d&&m)e:{for(S=eT,f=d,_=m,x=0,v=f;v;v=S(v))x++;v=0;for(var T=_;T;T=S(T))v++;for(;0<x-v;)f=S(f),x--;for(;0<v-x;)_=S(_),v--;for(;x--;){if(f===_||_!==null&&f===_.alternate){S=f;break e}f=S(f),_=S(_)}S=null}else S=null;d!==null&&Tv(p,u,d,S,!1),m!==null&&g!==null&&Tv(p,g,m,S,!0)}}t:{if(u=l?Ho(l):window,d=u.nodeName&&u.nodeName.toLowerCase(),d==="select"||d==="input"&&u.type==="file")var A=z_;else if(P_(u))if(xy)A=pE;else{A=fE;var w=hE}else d=u.nodeName,!d||d.toLowerCase()!=="input"||u.type!=="checkbox"&&u.type!=="radio"?l&&_m(l.elementType)&&(A=z_):A=dE;if(A&&(A=A(e,l))){yy(p,A,n,h);break t}w&&w(e,u,l),e==="focusout"&&l&&u.type==="number"&&l.memoizedProps.value!=null&&wp(u,"number",u.value)}switch(w=l?Ho(l):window,e){case"focusin":(P_(w)||w.contentEditable==="true")&&(br=w,Dp=l,qo=null);break;case"focusout":qo=Dp=br=null;break;case"mousedown":Np=!0;break;case"contextmenu":case"mouseup":case"dragend":Np=!1,H_(p,n,h);break;case"selectionchange":if(gE)break;case"keydown":case"keyup":H_(p,n,h)}var y;if(bm)t:{switch(e){case"compositionstart":var M="onCompositionStart";break t;case"compositionend":M="onCompositionEnd";break t;case"compositionupdate":M="onCompositionUpdate";break t}M=void 0}else xr?_y(e,n)&&(M="onCompositionEnd"):e==="keydown"&&n.keyCode===229&&(M="onCompositionStart");M&&(gy&&n.locale!=="ko"&&(xr||M!=="onCompositionStart"?M==="onCompositionEnd"&&xr&&(y=my()):(Vs=h,ym="value"in Vs?Vs.value:Vs.textContent,xr=!0)),w=Iu(l,M),0<w.length&&(M=new U_(M,e,null,n,h),p.push({event:M,listeners:w}),y?M.data=y:(y=vy(n),y!==null&&(M.data=y)))),(y=rE?oE(e,n):lE(e,n))&&(M=Iu(l,"onBeforeInput"),0<M.length&&(w=new U_("onBeforeInput","beforeinput",null,n,h),p.push({event:w,listeners:M}),w.data=y)),$E(p,e,l,n,h)}pb(p,t)})}function dl(e,t,n){return{instance:e,listener:t,currentTarget:n}}function Iu(e,t){for(var n=t+"Capture",i=[];e!==null;){var s=e,a=s.stateNode;if(s=s.tag,s!==5&&s!==26&&s!==27||a===null||(s=sl(e,n),s!=null&&i.unshift(dl(e,s,a)),s=sl(e,t),s!=null&&i.push(dl(e,s,a))),e.tag===3)return i;e=e.return}return[]}function eT(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function Tv(e,t,n,i,s){for(var a=t._reactName,r=[];n!==null&&n!==i;){var o=n,c=o.alternate,l=o.stateNode;if(o=o.tag,c!==null&&c===i)break;o!==5&&o!==26&&o!==27||l===null||(c=l,s?(l=sl(n,a),l!=null&&r.unshift(dl(n,l,c))):s||(l=sl(n,a),l!=null&&r.push(dl(n,l,c)))),n=n.return}r.length!==0&&e.push({event:t,listeners:r})}var nT=/\r\n?/g,iT=/\u0000|\uFFFD/g;function Av(e){return(typeof e=="string"?e:""+e).replace(nT,`
`).replace(iT,"")}function gb(e,t){return t=Av(t),Av(e)===t}function pe(e,t,n,i,s,a){switch(n){case"children":typeof i=="string"?t==="body"||t==="textarea"&&i===""||zr(e,i):(typeof i=="number"||typeof i=="bigint")&&t!=="body"&&zr(e,""+i);break;case"className":zc(e,"class",i);break;case"tabIndex":zc(e,"tabindex",i);break;case"dir":case"role":case"viewBox":case"width":case"height":zc(e,n,i);break;case"style":dy(e,i,a);break;case"data":if(t!=="object"){zc(e,"data",i);break}case"src":case"href":if(i===""&&(t!=="a"||n!=="href")){e.removeAttribute(n);break}if(i==null||typeof i=="function"||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(n);break}i=Qc(""+i),e.setAttribute(n,i);break;case"action":case"formAction":if(typeof i=="function"){e.setAttribute(n,"javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");break}else typeof a=="function"&&(n==="formAction"?(t!=="input"&&pe(e,t,"name",s.name,s,null),pe(e,t,"formEncType",s.formEncType,s,null),pe(e,t,"formMethod",s.formMethod,s,null),pe(e,t,"formTarget",s.formTarget,s,null)):(pe(e,t,"encType",s.encType,s,null),pe(e,t,"method",s.method,s,null),pe(e,t,"target",s.target,s,null)));if(i==null||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(n);break}i=Qc(""+i),e.setAttribute(n,i);break;case"onClick":i!=null&&(e.onclick=os);break;case"onScroll":i!=null&&Jt("scroll",e);break;case"onScrollEnd":i!=null&&Jt("scrollend",e);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(it(61));if(n=i.__html,n!=null){if(s.children!=null)throw Error(it(60));e.innerHTML=n}}break;case"multiple":e.multiple=i&&typeof i!="function"&&typeof i!="symbol";break;case"muted":e.muted=i&&typeof i!="function"&&typeof i!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(i==null||typeof i=="function"||typeof i=="boolean"||typeof i=="symbol"){e.removeAttribute("xlink:href");break}n=Qc(""+i),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",n);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,""+i):e.removeAttribute(n);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":i&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,""):e.removeAttribute(n);break;case"capture":case"download":i===!0?e.setAttribute(n,""):i!==!1&&i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(n,i):e.removeAttribute(n);break;case"cols":case"rows":case"size":case"span":i!=null&&typeof i!="function"&&typeof i!="symbol"&&!isNaN(i)&&1<=i?e.setAttribute(n,i):e.removeAttribute(n);break;case"rowSpan":case"start":i==null||typeof i=="function"||typeof i=="symbol"||isNaN(i)?e.removeAttribute(n):e.setAttribute(n,i);break;case"popover":Jt("beforetoggle",e),Jt("toggle",e),jc(e,"popover",i);break;case"xlinkActuate":$i(e,"http://www.w3.org/1999/xlink","xlink:actuate",i);break;case"xlinkArcrole":$i(e,"http://www.w3.org/1999/xlink","xlink:arcrole",i);break;case"xlinkRole":$i(e,"http://www.w3.org/1999/xlink","xlink:role",i);break;case"xlinkShow":$i(e,"http://www.w3.org/1999/xlink","xlink:show",i);break;case"xlinkTitle":$i(e,"http://www.w3.org/1999/xlink","xlink:title",i);break;case"xlinkType":$i(e,"http://www.w3.org/1999/xlink","xlink:type",i);break;case"xmlBase":$i(e,"http://www.w3.org/XML/1998/namespace","xml:base",i);break;case"xmlLang":$i(e,"http://www.w3.org/XML/1998/namespace","xml:lang",i);break;case"xmlSpace":$i(e,"http://www.w3.org/XML/1998/namespace","xml:space",i);break;case"is":jc(e,"is",i);break;case"innerText":case"textContent":break;default:(!(2<n.length)||n[0]!=="o"&&n[0]!=="O"||n[1]!=="n"&&n[1]!=="N")&&(n=L1.get(n)||n,jc(e,n,i))}}function em(e,t,n,i,s,a){switch(n){case"style":dy(e,i,a);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(it(61));if(n=i.__html,n!=null){if(s.children!=null)throw Error(it(60));e.innerHTML=n}}break;case"children":typeof i=="string"?zr(e,i):(typeof i=="number"||typeof i=="bigint")&&zr(e,""+i);break;case"onScroll":i!=null&&Jt("scroll",e);break;case"onScrollEnd":i!=null&&Jt("scrollend",e);break;case"onClick":i!=null&&(e.onclick=os);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!oy.hasOwnProperty(n))t:{if(n[0]==="o"&&n[1]==="n"&&(s=n.endsWith("Capture"),t=n.slice(2,s?n.length-7:void 0),a=e[Ln]||null,a=a!=null?a[n]:null,typeof a=="function"&&e.removeEventListener(t,a,s),typeof i=="function")){typeof a!="function"&&a!==null&&(n in e?e[n]=null:e.hasAttribute(n)&&e.removeAttribute(n)),e.addEventListener(t,i,s);break t}n in e?e[n]=i:i===!0?e.setAttribute(n,""):jc(e,n,i)}}}function fn(e,t,n){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":Jt("error",e),Jt("load",e);var i=!1,s=!1,a;for(a in n)if(n.hasOwnProperty(a)){var r=n[a];if(r!=null)switch(a){case"src":i=!0;break;case"srcSet":s=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error(it(137,t));default:pe(e,t,a,r,n,null)}}s&&pe(e,t,"srcSet",n.srcSet,n,null),i&&pe(e,t,"src",n.src,n,null);return;case"input":Jt("invalid",e);var o=a=r=s=null,c=null,l=null;for(i in n)if(n.hasOwnProperty(i)){var h=n[i];if(h!=null)switch(i){case"name":s=h;break;case"type":r=h;break;case"checked":c=h;break;case"defaultChecked":l=h;break;case"value":a=h;break;case"defaultValue":o=h;break;case"children":case"dangerouslySetInnerHTML":if(h!=null)throw Error(it(137,t));break;default:pe(e,t,i,h,n,null)}}uy(e,a,o,c,l,r,s,!1);return;case"select":Jt("invalid",e),i=r=a=null;for(s in n)if(n.hasOwnProperty(s)&&(o=n[s],o!=null))switch(s){case"value":a=o;break;case"defaultValue":r=o;break;case"multiple":i=o;default:pe(e,t,s,o,n,null)}t=a,n=r,e.multiple=!!i,t!=null?Rr(e,!!i,t,!1):n!=null&&Rr(e,!!i,n,!0);return;case"textarea":Jt("invalid",e),a=s=i=null;for(r in n)if(n.hasOwnProperty(r)&&(o=n[r],o!=null))switch(r){case"value":i=o;break;case"defaultValue":s=o;break;case"children":a=o;break;case"dangerouslySetInnerHTML":if(o!=null)throw Error(it(91));break;default:pe(e,t,r,o,n,null)}fy(e,i,s,a);return;case"option":for(c in n)if(n.hasOwnProperty(c)&&(i=n[c],i!=null))switch(c){case"selected":e.selected=i&&typeof i!="function"&&typeof i!="symbol";break;default:pe(e,t,c,i,n,null)}return;case"dialog":Jt("beforetoggle",e),Jt("toggle",e),Jt("cancel",e),Jt("close",e);break;case"iframe":case"object":Jt("load",e);break;case"video":case"audio":for(i=0;i<fl.length;i++)Jt(fl[i],e);break;case"image":Jt("error",e),Jt("load",e);break;case"details":Jt("toggle",e);break;case"embed":case"source":case"link":Jt("error",e),Jt("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(l in n)if(n.hasOwnProperty(l)&&(i=n[l],i!=null))switch(l){case"children":case"dangerouslySetInnerHTML":throw Error(it(137,t));default:pe(e,t,l,i,n,null)}return;default:if(_m(t)){for(h in n)n.hasOwnProperty(h)&&(i=n[h],i!==void 0&&em(e,t,h,i,n,void 0));return}}for(o in n)n.hasOwnProperty(o)&&(i=n[o],i!=null&&pe(e,t,o,i,n,null))}function sT(e,t,n,i){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var s=null,a=null,r=null,o=null,c=null,l=null,h=null;for(d in n){var p=n[d];if(n.hasOwnProperty(d)&&p!=null)switch(d){case"checked":break;case"value":break;case"defaultValue":c=p;default:i.hasOwnProperty(d)||pe(e,t,d,null,i,p)}}for(var u in i){var d=i[u];if(p=n[u],i.hasOwnProperty(u)&&(d!=null||p!=null))switch(u){case"type":a=d;break;case"name":s=d;break;case"checked":l=d;break;case"defaultChecked":h=d;break;case"value":r=d;break;case"defaultValue":o=d;break;case"children":case"dangerouslySetInnerHTML":if(d!=null)throw Error(it(137,t));break;default:d!==p&&pe(e,t,u,d,i,p)}}Ap(e,r,o,c,l,h,a,s);return;case"select":d=r=o=u=null;for(a in n)if(c=n[a],n.hasOwnProperty(a)&&c!=null)switch(a){case"value":break;case"multiple":d=c;default:i.hasOwnProperty(a)||pe(e,t,a,null,i,c)}for(s in i)if(a=i[s],c=n[s],i.hasOwnProperty(s)&&(a!=null||c!=null))switch(s){case"value":u=a;break;case"defaultValue":o=a;break;case"multiple":r=a;default:a!==c&&pe(e,t,s,a,i,c)}t=o,n=r,i=d,u!=null?Rr(e,!!n,u,!1):!!i!=!!n&&(t!=null?Rr(e,!!n,t,!0):Rr(e,!!n,n?[]:"",!1));return;case"textarea":d=u=null;for(o in n)if(s=n[o],n.hasOwnProperty(o)&&s!=null&&!i.hasOwnProperty(o))switch(o){case"value":break;case"children":break;default:pe(e,t,o,null,i,s)}for(r in i)if(s=i[r],a=n[r],i.hasOwnProperty(r)&&(s!=null||a!=null))switch(r){case"value":u=s;break;case"defaultValue":d=s;break;case"children":break;case"dangerouslySetInnerHTML":if(s!=null)throw Error(it(91));break;default:s!==a&&pe(e,t,r,s,i,a)}hy(e,u,d);return;case"option":for(var m in n)if(u=n[m],n.hasOwnProperty(m)&&u!=null&&!i.hasOwnProperty(m))switch(m){case"selected":e.selected=!1;break;default:pe(e,t,m,null,i,u)}for(c in i)if(u=i[c],d=n[c],i.hasOwnProperty(c)&&u!==d&&(u!=null||d!=null))switch(c){case"selected":e.selected=u&&typeof u!="function"&&typeof u!="symbol";break;default:pe(e,t,c,u,i,d)}return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var S in n)u=n[S],n.hasOwnProperty(S)&&u!=null&&!i.hasOwnProperty(S)&&pe(e,t,S,null,i,u);for(l in i)if(u=i[l],d=n[l],i.hasOwnProperty(l)&&u!==d&&(u!=null||d!=null))switch(l){case"children":case"dangerouslySetInnerHTML":if(u!=null)throw Error(it(137,t));break;default:pe(e,t,l,u,i,d)}return;default:if(_m(t)){for(var g in n)u=n[g],n.hasOwnProperty(g)&&u!==void 0&&!i.hasOwnProperty(g)&&em(e,t,g,void 0,i,u);for(h in i)u=i[h],d=n[h],!i.hasOwnProperty(h)||u===d||u===void 0&&d===void 0||em(e,t,h,u,i,d);return}}for(var f in n)u=n[f],n.hasOwnProperty(f)&&u!=null&&!i.hasOwnProperty(f)&&pe(e,t,f,null,i,u);for(p in i)u=i[p],d=n[p],!i.hasOwnProperty(p)||u===d||u==null&&d==null||pe(e,t,p,u,i,d)}function wv(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function aT(){if(typeof performance.getEntriesByType=="function"){for(var e=0,t=0,n=performance.getEntriesByType("resource"),i=0;i<n.length;i++){var s=n[i],a=s.transferSize,r=s.initiatorType,o=s.duration;if(a&&o&&wv(r)){for(r=0,o=s.responseEnd,i+=1;i<n.length;i++){var c=n[i],l=c.startTime;if(l>o)break;var h=c.transferSize,p=c.initiatorType;h&&wv(p)&&(c=c.responseEnd,r+=h*(c<o?1:(o-l)/(c-l)))}if(--i,t+=8*(a+r)/(s.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var nm=null,im=null;function Ou(e){return e.nodeType===9?e:e.ownerDocument}function Cv(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function _b(e,t){if(e===0)switch(t){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&t==="foreignObject"?0:e}function sm(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.children=="bigint"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var pp=null;function rT(){var e=window.event;return e&&e.type==="popstate"?e===pp?!1:(pp=e,!0):(pp=null,!1)}var vb=typeof setTimeout=="function"?setTimeout:void 0,oT=typeof clearTimeout=="function"?clearTimeout:void 0,Rv=typeof Promise=="function"?Promise:void 0,lT=typeof queueMicrotask=="function"?queueMicrotask:typeof Rv<"u"?function(e){return Rv.resolve(null).then(e).catch(cT)}:vb;function cT(e){setTimeout(function(){throw e})}function sa(e){return e==="head"}function Dv(e,t){var n=t,i=0;do{var s=n.nextSibling;if(e.removeChild(n),s&&s.nodeType===8)if(n=s.data,n==="/$"||n==="/&"){if(i===0){e.removeChild(s),Wr(t);return}i--}else if(n==="$"||n==="$?"||n==="$~"||n==="$!"||n==="&")i++;else if(n==="html")nl(e.ownerDocument.documentElement);else if(n==="head"){n=e.ownerDocument.head,nl(n);for(var a=n.firstChild;a;){var r=a.nextSibling,o=a.nodeName;a[bl]||o==="SCRIPT"||o==="STYLE"||o==="LINK"&&a.rel.toLowerCase()==="stylesheet"||n.removeChild(a),a=r}}else n==="body"&&nl(e.ownerDocument.body);n=s}while(n);Wr(t)}function Nv(e,t){var n=e;e=0;do{var i=n.nextSibling;if(n.nodeType===1?t?(n._stashedDisplay=n.style.display,n.style.display="none"):(n.style.display=n._stashedDisplay||"",n.getAttribute("style")===""&&n.removeAttribute("style")):n.nodeType===3&&(t?(n._stashedText=n.nodeValue,n.nodeValue=""):n.nodeValue=n._stashedText||""),i&&i.nodeType===8)if(n=i.data,n==="/$"){if(e===0)break;e--}else n!=="$"&&n!=="$?"&&n!=="$~"&&n!=="$!"||e++;n=i}while(n)}function am(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var n=t;switch(t=t.nextSibling,n.nodeName){case"HTML":case"HEAD":case"BODY":am(n),gm(n);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(n.rel.toLowerCase()==="stylesheet")continue}e.removeChild(n)}}function uT(e,t,n,i){for(;e.nodeType===1;){var s=n;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!i&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(i){if(!e[bl])switch(t){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(a=e.getAttribute("rel"),a==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(a!==s.rel||e.getAttribute("href")!==(s.href==null||s.href===""?null:s.href)||e.getAttribute("crossorigin")!==(s.crossOrigin==null?null:s.crossOrigin)||e.getAttribute("title")!==(s.title==null?null:s.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(a=e.getAttribute("src"),(a!==(s.src==null?null:s.src)||e.getAttribute("type")!==(s.type==null?null:s.type)||e.getAttribute("crossorigin")!==(s.crossOrigin==null?null:s.crossOrigin))&&a&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(t==="input"&&e.type==="hidden"){var a=s.name==null?null:""+s.name;if(s.type==="hidden"&&e.getAttribute("name")===a)return e}else return e;if(e=fi(e.nextSibling),e===null)break}return null}function hT(e,t,n){if(t==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!n||(e=fi(e.nextSibling),e===null))return null;return e}function yb(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!t||(e=fi(e.nextSibling),e===null))return null;return e}function rm(e){return e.data==="$?"||e.data==="$~"}function om(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function fT(e,t){var n=e.ownerDocument;if(e.data==="$~")e._reactRetry=t;else if(e.data!=="$?"||n.readyState!=="loading")t();else{var i=function(){t(),n.removeEventListener("DOMContentLoaded",i)};n.addEventListener("DOMContentLoaded",i),e._reactRetry=i}}function fi(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?"||t==="$~"||t==="&"||t==="F!"||t==="F")break;if(t==="/$"||t==="/&")return null}}return e}var lm=null;function Uv(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="/$"||n==="/&"){if(t===0)return fi(e.nextSibling);t--}else n!=="$"&&n!=="$!"&&n!=="$?"&&n!=="$~"&&n!=="&"||t++}e=e.nextSibling}return null}function Lv(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="$"||n==="$!"||n==="$?"||n==="$~"||n==="&"){if(t===0)return e;t--}else n!=="/$"&&n!=="/&"||t++}e=e.previousSibling}return null}function xb(e,t,n){switch(t=Ou(n),e){case"html":if(e=t.documentElement,!e)throw Error(it(452));return e;case"head":if(e=t.head,!e)throw Error(it(453));return e;case"body":if(e=t.body,!e)throw Error(it(454));return e;default:throw Error(it(451))}}function nl(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);gm(e)}var di=new Map,Iv=new Set;function Pu(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var _s=le.d;le.d={f:dT,r:pT,D:mT,C:gT,L:_T,m:vT,X:xT,S:yT,M:bT};function dT(){var e=_s.f(),t=$u();return e||t}function pT(e){var t=Yr(e);t!==null&&t.tag===5&&t.type==="form"?dx(t):_s.r(e)}var jr=typeof document>"u"?null:document;function bb(e,t,n){var i=jr;if(i&&typeof t=="string"&&t){var s=li(t);s='link[rel="'+e+'"][href="'+s+'"]',typeof n=="string"&&(s+='[crossorigin="'+n+'"]'),Iv.has(s)||(Iv.add(s),e={rel:e,crossOrigin:n,href:t},i.querySelector(s)===null&&(t=i.createElement("link"),fn(t,"link",e),sn(t),i.head.appendChild(t)))}}function mT(e){_s.D(e),bb("dns-prefetch",e,null)}function gT(e,t){_s.C(e,t),bb("preconnect",e,t)}function _T(e,t,n){_s.L(e,t,n);var i=jr;if(i&&e&&t){var s='link[rel="preload"][as="'+li(t)+'"]';t==="image"&&n&&n.imageSrcSet?(s+='[imagesrcset="'+li(n.imageSrcSet)+'"]',typeof n.imageSizes=="string"&&(s+='[imagesizes="'+li(n.imageSizes)+'"]')):s+='[href="'+li(e)+'"]';var a=s;switch(t){case"style":a=Xr(e);break;case"script":a=Qr(e)}di.has(a)||(e=De({rel:"preload",href:t==="image"&&n&&n.imageSrcSet?void 0:e,as:t},n),di.set(a,e),i.querySelector(s)!==null||t==="style"&&i.querySelector(wl(a))||t==="script"&&i.querySelector(Cl(a))||(t=i.createElement("link"),fn(t,"link",e),sn(t),i.head.appendChild(t)))}}function vT(e,t){_s.m(e,t);var n=jr;if(n&&e){var i=t&&typeof t.as=="string"?t.as:"script",s='link[rel="modulepreload"][as="'+li(i)+'"][href="'+li(e)+'"]',a=s;switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":a=Qr(e)}if(!di.has(a)&&(e=De({rel:"modulepreload",href:e},t),di.set(a,e),n.querySelector(s)===null)){switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(n.querySelector(Cl(a)))return}i=n.createElement("link"),fn(i,"link",e),sn(i),n.head.appendChild(i)}}}function yT(e,t,n){_s.S(e,t,n);var i=jr;if(i&&e){var s=Cr(i).hoistableStyles,a=Xr(e);t=t||"default";var r=s.get(a);if(!r){var o={loading:0,preload:null};if(r=i.querySelector(wl(a)))o.loading=5;else{e=De({rel:"stylesheet",href:e,"data-precedence":t},n),(n=di.get(a))&&eg(e,n);var c=r=i.createElement("link");sn(c),fn(c,"link",e),c._p=new Promise(function(l,h){c.onload=l,c.onerror=h}),c.addEventListener("load",function(){o.loading|=1}),c.addEventListener("error",function(){o.loading|=2}),o.loading|=4,lu(r,t,i)}r={type:"stylesheet",instance:r,count:1,state:o},s.set(a,r)}}}function xT(e,t){_s.X(e,t);var n=jr;if(n&&e){var i=Cr(n).hoistableScripts,s=Qr(e),a=i.get(s);a||(a=n.querySelector(Cl(s)),a||(e=De({src:e,async:!0},t),(t=di.get(s))&&ng(e,t),a=n.createElement("script"),sn(a),fn(a,"link",e),n.head.appendChild(a)),a={type:"script",instance:a,count:1,state:null},i.set(s,a))}}function bT(e,t){_s.M(e,t);var n=jr;if(n&&e){var i=Cr(n).hoistableScripts,s=Qr(e),a=i.get(s);a||(a=n.querySelector(Cl(s)),a||(e=De({src:e,async:!0,type:"module"},t),(t=di.get(s))&&ng(e,t),a=n.createElement("script"),sn(a),fn(a,"link",e),n.head.appendChild(a)),a={type:"script",instance:a,count:1,state:null},i.set(s,a))}}function Ov(e,t,n,i){var s=(s=Xs.current)?Pu(s):null;if(!s)throw Error(it(446));switch(e){case"meta":case"title":return null;case"style":return typeof n.precedence=="string"&&typeof n.href=="string"?(t=Xr(n.href),n=Cr(s).hoistableStyles,i=n.get(t),i||(i={type:"style",instance:null,count:0,state:null},n.set(t,i)),i):{type:"void",instance:null,count:0,state:null};case"link":if(n.rel==="stylesheet"&&typeof n.href=="string"&&typeof n.precedence=="string"){e=Xr(n.href);var a=Cr(s).hoistableStyles,r=a.get(e);if(r||(s=s.ownerDocument||s,r={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},a.set(e,r),(a=s.querySelector(wl(e)))&&!a._p&&(r.instance=a,r.state.loading=5),di.has(e)||(n={rel:"preload",as:"style",href:n.href,crossOrigin:n.crossOrigin,integrity:n.integrity,media:n.media,hrefLang:n.hrefLang,referrerPolicy:n.referrerPolicy},di.set(e,n),a||ST(s,e,n,r.state))),t&&i===null)throw Error(it(528,""));return r}if(t&&i!==null)throw Error(it(529,""));return null;case"script":return t=n.async,n=n.src,typeof n=="string"&&t&&typeof t!="function"&&typeof t!="symbol"?(t=Qr(n),n=Cr(s).hoistableScripts,i=n.get(t),i||(i={type:"script",instance:null,count:0,state:null},n.set(t,i)),i):{type:"void",instance:null,count:0,state:null};default:throw Error(it(444,e))}}function Xr(e){return'href="'+li(e)+'"'}function wl(e){return'link[rel="stylesheet"]['+e+"]"}function Sb(e){return De({},e,{"data-precedence":e.precedence,precedence:null})}function ST(e,t,n,i){e.querySelector('link[rel="preload"][as="style"]['+t+"]")?i.loading=1:(t=e.createElement("link"),i.preload=t,t.addEventListener("load",function(){return i.loading|=1}),t.addEventListener("error",function(){return i.loading|=2}),fn(t,"link",n),sn(t),e.head.appendChild(t))}function Qr(e){return'[src="'+li(e)+'"]'}function Cl(e){return"script[async]"+e}function Pv(e,t,n){if(t.count++,t.instance===null)switch(t.type){case"style":var i=e.querySelector('style[data-href~="'+li(n.href)+'"]');if(i)return t.instance=i,sn(i),i;var s=De({},n,{"data-href":n.href,"data-precedence":n.precedence,href:null,precedence:null});return i=(e.ownerDocument||e).createElement("style"),sn(i),fn(i,"style",s),lu(i,n.precedence,e),t.instance=i;case"stylesheet":s=Xr(n.href);var a=e.querySelector(wl(s));if(a)return t.state.loading|=4,t.instance=a,sn(a),a;i=Sb(n),(s=di.get(s))&&eg(i,s),a=(e.ownerDocument||e).createElement("link"),sn(a);var r=a;return r._p=new Promise(function(o,c){r.onload=o,r.onerror=c}),fn(a,"link",i),t.state.loading|=4,lu(a,n.precedence,e),t.instance=a;case"script":return a=Qr(n.src),(s=e.querySelector(Cl(a)))?(t.instance=s,sn(s),s):(i=n,(s=di.get(a))&&(i=De({},n),ng(i,s)),e=e.ownerDocument||e,s=e.createElement("script"),sn(s),fn(s,"link",i),e.head.appendChild(s),t.instance=s);case"void":return null;default:throw Error(it(443,t.type))}else t.type==="stylesheet"&&(t.state.loading&4)===0&&(i=t.instance,t.state.loading|=4,lu(i,n.precedence,e));return t.instance}function lu(e,t,n){for(var i=n.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'),s=i.length?i[i.length-1]:null,a=s,r=0;r<i.length;r++){var o=i[r];if(o.dataset.precedence===t)a=o;else if(a!==s)break}a?a.parentNode.insertBefore(e,a.nextSibling):(t=n.nodeType===9?n.head:n,t.insertBefore(e,t.firstChild))}function eg(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.title==null&&(e.title=t.title)}function ng(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.integrity==null&&(e.integrity=t.integrity)}var cu=null;function zv(e,t,n){if(cu===null){var i=new Map,s=cu=new Map;s.set(n,i)}else s=cu,i=s.get(n),i||(i=new Map,s.set(n,i));if(i.has(e))return i;for(i.set(e,null),n=n.getElementsByTagName(e),s=0;s<n.length;s++){var a=n[s];if(!(a[bl]||a[cn]||e==="link"&&a.getAttribute("rel")==="stylesheet")&&a.namespaceURI!=="http://www.w3.org/2000/svg"){var r=a.getAttribute(t)||"";r=e+r;var o=i.get(r);o?o.push(a):i.set(r,[a])}}return i}function Bv(e,t,n){e=e.ownerDocument||e,e.head.insertBefore(n,t==="title"?e.querySelector("head > title"):null)}function MT(e,t,n){if(n===1||t.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof t.precedence!="string"||typeof t.href!="string"||t.href==="")break;return!0;case"link":if(typeof t.rel!="string"||typeof t.href!="string"||t.href===""||t.onLoad||t.onError)break;switch(t.rel){case"stylesheet":return e=t.disabled,typeof t.precedence=="string"&&e==null;default:return!0}case"script":if(t.async&&typeof t.async!="function"&&typeof t.async!="symbol"&&!t.onLoad&&!t.onError&&t.src&&typeof t.src=="string")return!0}return!1}function Mb(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function ET(e,t,n,i){if(n.type==="stylesheet"&&(typeof i.media!="string"||matchMedia(i.media).matches!==!1)&&(n.state.loading&4)===0){if(n.instance===null){var s=Xr(i.href),a=t.querySelector(wl(s));if(a){t=a._p,t!==null&&typeof t=="object"&&typeof t.then=="function"&&(e.count++,e=zu.bind(e),t.then(e,e)),n.state.loading|=4,n.instance=a,sn(a);return}a=t.ownerDocument||t,i=Sb(i),(s=di.get(s))&&eg(i,s),a=a.createElement("link"),sn(a);var r=a;r._p=new Promise(function(o,c){r.onload=o,r.onerror=c}),fn(a,"link",i),n.instance=a}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(n,t),(t=n.state.preload)&&(n.state.loading&3)===0&&(e.count++,n=zu.bind(e),t.addEventListener("load",n),t.addEventListener("error",n))}}var mp=0;function TT(e,t){return e.stylesheets&&e.count===0&&uu(e,e.stylesheets),0<e.count||0<e.imgCount?function(n){var i=setTimeout(function(){if(e.stylesheets&&uu(e,e.stylesheets),e.unsuspend){var a=e.unsuspend;e.unsuspend=null,a()}},6e4+t);0<e.imgBytes&&mp===0&&(mp=62500*aT());var s=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&uu(e,e.stylesheets),e.unsuspend)){var a=e.unsuspend;e.unsuspend=null,a()}},(e.imgBytes>mp?50:800)+t);return e.unsuspend=n,function(){e.unsuspend=null,clearTimeout(i),clearTimeout(s)}}:null}function zu(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)uu(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var Bu=null;function uu(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,Bu=new Map,t.forEach(AT,e),Bu=null,zu.call(e))}function AT(e,t){if(!(t.state.loading&4)){var n=Bu.get(e);if(n)var i=n.get(null);else{n=new Map,Bu.set(e,n);for(var s=e.querySelectorAll("link[data-precedence],style[data-precedence]"),a=0;a<s.length;a++){var r=s[a];(r.nodeName==="LINK"||r.getAttribute("media")!=="not all")&&(n.set(r.dataset.precedence,r),i=r)}i&&n.set(null,i)}s=t.instance,r=s.getAttribute("data-precedence"),a=n.get(r)||i,a===i&&n.set(null,s),n.set(r,s),this.count++,i=zu.bind(this),s.addEventListener("load",i),s.addEventListener("error",i),a?a.parentNode.insertBefore(s,a.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(s,e.firstChild)),t.state.loading|=4}}var pl={$$typeof:rs,Provider:null,Consumer:null,_currentValue:Na,_currentValue2:Na,_threadCount:0};function wT(e,t,n,i,s,a,r,o,c){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=Hd(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Hd(0),this.hiddenUpdates=Hd(null),this.identifierPrefix=i,this.onUncaughtError=s,this.onCaughtError=a,this.onRecoverableError=r,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=c,this.incompleteTransitions=new Map}function Eb(e,t,n,i,s,a,r,o,c,l,h,p){return e=new wT(e,t,n,r,c,l,h,p,o),t=1,a===!0&&(t|=24),a=Fn(3,null,null,t),e.current=a,a.stateNode=e,t=Cm(),t.refCount++,e.pooledCache=t,t.refCount++,a.memoizedState={element:i,isDehydrated:n,cache:t},Nm(a),e}function Tb(e){return e?(e=Er,e):Er}function Ab(e,t,n,i,s,a){s=Tb(s),i.context===null?i.context=s:i.pendingContext=s,i=qs(t),i.payload={element:n},a=a===void 0?null:a,a!==null&&(i.callback=a),n=Ys(e,i,t),n!==null&&(Un(n,e,t),Zo(n,e,t))}function Fv(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var n=e.retryLane;e.retryLane=n!==0&&n<t?n:t}}function ig(e,t){Fv(e,t),(e=e.alternate)&&Fv(e,t)}function wb(e){if(e.tag===13||e.tag===31){var t=Xa(e,67108864);t!==null&&Un(t,e,67108864),ig(e,67108864)}}function Vv(e){if(e.tag===13||e.tag===31){var t=Xn();t=pm(t);var n=Xa(e,t);n!==null&&Un(n,e,t),ig(e,t)}}var Fu=!0;function CT(e,t,n,i){var s=Bt.T;Bt.T=null;var a=le.p;try{le.p=2,sg(e,t,n,i)}finally{le.p=a,Bt.T=s}}function RT(e,t,n,i){var s=Bt.T;Bt.T=null;var a=le.p;try{le.p=8,sg(e,t,n,i)}finally{le.p=a,Bt.T=s}}function sg(e,t,n,i){if(Fu){var s=cm(i);if(s===null)dp(e,t,i,Vu,n),Hv(e,i);else if(NT(s,e,t,n,i))i.stopPropagation();else if(Hv(e,i),t&4&&-1<DT.indexOf(e)){for(;s!==null;){var a=Yr(s);if(a!==null)switch(a.tag){case 3:if(a=a.stateNode,a.current.memoizedState.isDehydrated){var r=Ca(a.pendingLanes);if(r!==0){var o=a;for(o.pendingLanes|=2,o.entangledLanes|=2;r;){var c=1<<31-kn(r);o.entanglements[1]|=c,r&=~c}Bi(a),(oe&6)===0&&(Ru=Hn()+500,Al(0,!1))}}break;case 31:case 13:o=Xa(a,2),o!==null&&Un(o,a,2),$u(),ig(a,2)}if(a=cm(i),a===null&&dp(e,t,i,Vu,n),a===s)break;s=a}s!==null&&i.stopPropagation()}else dp(e,t,i,null,n)}}function cm(e){return e=vm(e),ag(e)}var Vu=null;function ag(e){if(Vu=null,e=vr(e),e!==null){var t=_l(e);if(t===null)e=null;else{var n=t.tag;if(n===13){if(e=Yv(t),e!==null)return e;e=null}else if(n===31){if(e=Zv(t),e!==null)return e;e=null}else if(n===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return Vu=e,null}function Cb(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(_1()){case Qv:return 2;case $v:return 8;case mu:case v1:return 32;case ty:return 268435456;default:return 32}default:return 32}}var um=!1,Ks=null,js=null,Qs=null,ml=new Map,gl=new Map,Bs=[],DT="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function Hv(e,t){switch(e){case"focusin":case"focusout":Ks=null;break;case"dragenter":case"dragleave":js=null;break;case"mouseover":case"mouseout":Qs=null;break;case"pointerover":case"pointerout":ml.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":gl.delete(t.pointerId)}}function zo(e,t,n,i,s,a){return e===null||e.nativeEvent!==a?(e={blockedOn:t,domEventName:n,eventSystemFlags:i,nativeEvent:a,targetContainers:[s]},t!==null&&(t=Yr(t),t!==null&&wb(t)),e):(e.eventSystemFlags|=i,t=e.targetContainers,s!==null&&t.indexOf(s)===-1&&t.push(s),e)}function NT(e,t,n,i,s){switch(t){case"focusin":return Ks=zo(Ks,e,t,n,i,s),!0;case"dragenter":return js=zo(js,e,t,n,i,s),!0;case"mouseover":return Qs=zo(Qs,e,t,n,i,s),!0;case"pointerover":var a=s.pointerId;return ml.set(a,zo(ml.get(a)||null,e,t,n,i,s)),!0;case"gotpointercapture":return a=s.pointerId,gl.set(a,zo(gl.get(a)||null,e,t,n,i,s)),!0}return!1}function Rb(e){var t=vr(e.target);if(t!==null){var n=_l(t);if(n!==null){if(t=n.tag,t===13){if(t=Yv(n),t!==null){e.blockedOn=t,E_(e.priority,function(){Vv(n)});return}}else if(t===31){if(t=Zv(n),t!==null){e.blockedOn=t,E_(e.priority,function(){Vv(n)});return}}else if(t===3&&n.stateNode.current.memoizedState.isDehydrated){e.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}e.blockedOn=null}function hu(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var n=cm(e.nativeEvent);if(n===null){n=e.nativeEvent;var i=new n.constructor(n.type,n);Cp=i,n.target.dispatchEvent(i),Cp=null}else return t=Yr(n),t!==null&&wb(t),e.blockedOn=n,!1;t.shift()}return!0}function Gv(e,t,n){hu(e)&&n.delete(t)}function UT(){um=!1,Ks!==null&&hu(Ks)&&(Ks=null),js!==null&&hu(js)&&(js=null),Qs!==null&&hu(Qs)&&(Qs=null),ml.forEach(Gv),gl.forEach(Gv)}function Jc(e,t){e.blockedOn===t&&(e.blockedOn=null,um||(um=!0,$e.unstable_scheduleCallback($e.unstable_NormalPriority,UT)))}var Kc=null;function kv(e){Kc!==e&&(Kc=e,$e.unstable_scheduleCallback($e.unstable_NormalPriority,function(){Kc===e&&(Kc=null);for(var t=0;t<e.length;t+=3){var n=e[t],i=e[t+1],s=e[t+2];if(typeof i!="function"){if(ag(i||n)===null)continue;break}var a=Yr(n);a!==null&&(e.splice(t,3),t-=3,Xp(a,{pending:!0,data:s,method:n.method,action:i},i,s))}}))}function Wr(e){function t(c){return Jc(c,e)}Ks!==null&&Jc(Ks,e),js!==null&&Jc(js,e),Qs!==null&&Jc(Qs,e),ml.forEach(t),gl.forEach(t);for(var n=0;n<Bs.length;n++){var i=Bs[n];i.blockedOn===e&&(i.blockedOn=null)}for(;0<Bs.length&&(n=Bs[0],n.blockedOn===null);)Rb(n),n.blockedOn===null&&Bs.shift();if(n=(e.ownerDocument||e).$$reactFormReplay,n!=null)for(i=0;i<n.length;i+=3){var s=n[i],a=n[i+1],r=s[Ln]||null;if(typeof a=="function")r||kv(n);else if(r){var o=null;if(a&&a.hasAttribute("formAction")){if(s=a,r=a[Ln]||null)o=r.formAction;else if(ag(s)!==null)continue}else o=r.action;typeof o=="function"?n[i+1]=o:(n.splice(i,3),i-=3),kv(n)}}}function Db(){function e(a){a.canIntercept&&a.info==="react-transition"&&a.intercept({handler:function(){return new Promise(function(r){return s=r})},focusReset:"manual",scroll:"manual"})}function t(){s!==null&&(s(),s=null),i||setTimeout(n,20)}function n(){if(!i&&!navigation.transition){var a=navigation.currentEntry;a&&a.url!=null&&navigation.navigate(a.url,{state:a.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var i=!1,s=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",t),navigation.addEventListener("navigateerror",t),setTimeout(n,100),function(){i=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",t),navigation.removeEventListener("navigateerror",t),s!==null&&(s(),s=null)}}}function rg(e){this._internalRoot=e}nh.prototype.render=rg.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(it(409));var n=t.current,i=Xn();Ab(n,i,e,t,null,null)};nh.prototype.unmount=rg.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;Ab(e.current,2,null,e,null,null),$u(),t[qr]=null}};function nh(e){this._internalRoot=e}nh.prototype.unstable_scheduleHydration=function(e){if(e){var t=ay();e={blockedOn:null,target:e,priority:t};for(var n=0;n<Bs.length&&t!==0&&t<Bs[n].priority;n++);Bs.splice(n,0,e),n===0&&Rb(e)}};var Xv=Wv.version;if(Xv!=="19.2.8")throw Error(it(527,Xv,"19.2.8"));le.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(it(188)):(e=Object.keys(e).join(","),Error(it(268,e)));return e=u1(t),e=e!==null?Jv(e):null,e=e===null?null:e.stateNode,e};var LT={bundleType:0,version:"19.2.8",rendererPackageName:"react-dom",currentDispatcherRef:Bt,reconcilerVersion:"19.2.8"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"&&(Bo=__REACT_DEVTOOLS_GLOBAL_HOOK__,!Bo.isDisabled&&Bo.supportsFiber))try{vl=Bo.inject(LT),Gn=Bo}catch{}var Bo;ih.createRoot=function(e,t){if(!qv(e))throw Error(it(299));var n=!1,i="",s=bx,a=Sx,r=Mx;return t!=null&&(t.unstable_strictMode===!0&&(n=!0),t.identifierPrefix!==void 0&&(i=t.identifierPrefix),t.onUncaughtError!==void 0&&(s=t.onUncaughtError),t.onCaughtError!==void 0&&(a=t.onCaughtError),t.onRecoverableError!==void 0&&(r=t.onRecoverableError)),t=Eb(e,1,!1,null,null,n,i,null,s,a,r,Db),e[qr]=t.current,tg(e),new rg(t)};ih.hydrateRoot=function(e,t,n){if(!qv(e))throw Error(it(299));var i=!1,s="",a=bx,r=Sx,o=Mx,c=null;return n!=null&&(n.unstable_strictMode===!0&&(i=!0),n.identifierPrefix!==void 0&&(s=n.identifierPrefix),n.onUncaughtError!==void 0&&(a=n.onUncaughtError),n.onCaughtError!==void 0&&(r=n.onCaughtError),n.onRecoverableError!==void 0&&(o=n.onRecoverableError),n.formState!==void 0&&(c=n.formState)),t=Eb(e,1,!0,t,n??null,i,s,c,a,r,o,Db),t.context=Tb(null),n=t.current,i=Xn(),i=pm(i),s=qs(i),s.callback=null,Ys(n,s,i),n=i,t.current.lanes=n,xl(t,n),Bi(t),e[qr]=t.current,tg(e),new nh(t)};ih.version="19.2.8"});var Ib=Ni((N3,Lb)=>{"use strict";function Ub(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(Ub)}catch(e){console.error(e)}}Ub(),Lb.exports=Nb()});var MM=Ni(_d=>{"use strict";var c3=Symbol.for("react.transitional.element"),u3=Symbol.for("react.fragment");function SM(e,t,n){var i=null;if(n!==void 0&&(i=""+n),t.key!==void 0&&(i=""+t.key),"key"in t){n={};for(var s in t)s!=="key"&&(n[s]=t[s])}else n=t;return t=n.ref,{$$typeof:c3,type:e,key:i,ref:t!==void 0?t:null,props:n}}_d.Fragment=u3;_d.jsx=SM;_d.jsxs=SM});var N0=Ni((eL,EM)=>{"use strict";EM.exports=MM()});var st=Ac(Cc()),CM=Ac(Ib());var bf="185";var rS=0,Gg=1,oS=2;var oc=1,lS=2,xo=3,Ts=0,An=1,ti=2,Zi=0,Qa=1,kg=2,Xg=3,Wg=4,cS=5;var ha=100,uS=101,hS=102,fS=103,dS=104,pS=200,mS=201,gS=202,_S=203,Nh=204,Uh=205,vS=206,yS=207,xS=208,bS=209,SS=210,MS=211,ES=212,TS=213,AS=214,Lh=0,Ih=1,Oh=2,$a=3,Ph=4,zh=5,Bh=6,Fh=7,qg=0,wS=1,CS=2,Ti=0,Yg=1,Zg=2,Jg=3,Kg=4,jg=5,Qg=6,$g=7;var t0=300,ya=301,nr=302,Sf=303,Mf=304,lc=306,Vh=1e3,Hi=1001,Hh=1002,on=1003,RS=1004;var cc=1005;var dn=1006,Ef=1007;var xa=1008;var ei=1009,e0=1010,n0=1011,bo=1012,Tf=1013,Ai=1014,wi=1015,Ji=1016,Af=1017,wf=1018,So=1020,i0=35902,s0=35899,a0=1021,r0=1022,_i=1023,ki=1026,ba=1027,o0=1028,Cf=1029,Sa=1030,Rf=1031;var Df=1033,uc=33776,hc=33777,fc=33778,dc=33779,Nf=35840,Uf=35841,Lf=35842,If=35843,Of=36196,Pf=37492,zf=37496,Bf=37488,Ff=37489,pc=37490,Vf=37491,Hf=37808,Gf=37809,kf=37810,Xf=37811,Wf=37812,qf=37813,Yf=37814,Zf=37815,Jf=37816,Kf=37817,jf=37818,Qf=37819,$f=37820,td=37821,ed=36492,nd=36494,id=36495,sd=36283,ad=36284,mc=36285,rd=36286;var zl=2300,Gh=2301,Rh=2302,Ig=2303,Og=2400,Pg=2401,zg=2402;var DS=3200;var l0=0,NS=1,ws="",Tn="srgb",Bl="srgb-linear",Fl="linear",ue="srgb";var Ka=7680;var Bg=519,US=512,LS=513,IS=514,od=515,OS=516,PS=517,ld=518,zS=519,Fg=35044;var c0="300 es",Ei=2e3,Vl=2001;function IT(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function OT(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function Hl(e){return document.createElementNS("http://www.w3.org/1999/xhtml",e)}function BS(){let e=Hl("canvas");return e.style.display="block",e}var Ob={},fo=null;function u0(...e){let t="THREE."+e.shift();fo?fo("log",t,...e):console.log(t,...e)}function FS(e){let t=e[0];if(typeof t=="string"&&t.startsWith("TSL:")){let n=e[1];n&&n.isStackTrace?e[0]+=" "+n.getLocation():e[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return e}function Ot(...e){e=FS(e);let t="THREE."+e.shift();if(fo)fo("warn",t,...e);else{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function zt(...e){e=FS(e);let t="THREE."+e.shift();if(fo)fo("error",t,...e);else{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function ja(...e){let t=e.join(" ");t in Ob||(Ob[t]=!0,Ot(...e))}function VS(e,t,n){return new Promise(function(i,s){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:s();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:i()}}setTimeout(a,n)})}var HS={[Lh]:Ih,[Oh]:Bh,[Ph]:Fh,[$a]:zh,[Ih]:Lh,[Bh]:Oh,[Fh]:Ph,[zh]:$a},Xi=class{addEventListener(t,n){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[t]===void 0&&(i[t]=[]),i[t].indexOf(n)===-1&&i[t].push(n)}hasEventListener(t,n){let i=this._listeners;return i===void 0?!1:i[t]!==void 0&&i[t].indexOf(n)!==-1}removeEventListener(t,n){let i=this._listeners;if(i===void 0)return;let s=i[t];if(s!==void 0){let a=s.indexOf(n);a!==-1&&s.splice(a,1)}}dispatchEvent(t){let n=this._listeners;if(n===void 0)return;let i=n[t.type];if(i!==void 0){t.target=this;let s=i.slice(0);for(let a=0,r=s.length;a<r;a++)s[a].call(this,t);t.target=null}}},_n=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var Dh=Math.PI/180,kh=180/Math.PI;function gc(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(_n[e&255]+_n[e>>8&255]+_n[e>>16&255]+_n[e>>24&255]+"-"+_n[t&255]+_n[t>>8&255]+"-"+_n[t>>16&15|64]+_n[t>>24&255]+"-"+_n[n&63|128]+_n[n>>8&255]+"-"+_n[n>>16&255]+_n[n>>24&255]+_n[i&255]+_n[i>>8&255]+_n[i>>16&255]+_n[i>>24&255]).toLowerCase()}function jt(e,t,n){return Math.max(t,Math.min(n,e))}function PT(e,t){return(e%t+t)%t}function og(e,t,n){return(1-n)*e+n*t}function Rl(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function On(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var It=class e{static{e.prototype.isVector2=!0}constructor(t=0,n=0){this.x=t,this.y=n}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,n){return this.x=t,this.y=n,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let n=this.x,i=this.y,s=t.elements;return this.x=s[0]*n+s[3]*i+s[6],this.y=s[1]*n+s[4]*i+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,n){return this.x=jt(this.x,t.x,n.x),this.y=jt(this.y,t.y,n.y),this}clampScalar(t,n){return this.x=jt(this.x,t,n),this.y=jt(this.y,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(jt(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let n=Math.sqrt(this.lengthSq()*t.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(t)/n;return Math.acos(jt(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let n=this.x-t.x,i=this.y-t.y;return n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this}rotateAround(t,n){let i=Math.cos(n),s=Math.sin(n),a=this.x-t.x,r=this.y-t.y;return this.x=a*i-r*s+t.x,this.y=a*s+r*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Wi=class{constructor(t=0,n=0,i=0,s=1){this.isQuaternion=!0,this._x=t,this._y=n,this._z=i,this._w=s}static slerpFlat(t,n,i,s,a,r,o){let c=i[s+0],l=i[s+1],h=i[s+2],p=i[s+3],u=a[r+0],d=a[r+1],m=a[r+2],S=a[r+3];if(p!==S||c!==u||l!==d||h!==m){let g=c*u+l*d+h*m+p*S;g<0&&(u=-u,d=-d,m=-m,S=-S,g=-g);let f=1-o;if(g<.9995){let _=Math.acos(g),x=Math.sin(_);f=Math.sin(f*_)/x,o=Math.sin(o*_)/x,c=c*f+u*o,l=l*f+d*o,h=h*f+m*o,p=p*f+S*o}else{c=c*f+u*o,l=l*f+d*o,h=h*f+m*o,p=p*f+S*o;let _=1/Math.sqrt(c*c+l*l+h*h+p*p);c*=_,l*=_,h*=_,p*=_}}t[n]=c,t[n+1]=l,t[n+2]=h,t[n+3]=p}static multiplyQuaternionsFlat(t,n,i,s,a,r){let o=i[s],c=i[s+1],l=i[s+2],h=i[s+3],p=a[r],u=a[r+1],d=a[r+2],m=a[r+3];return t[n]=o*m+h*p+c*d-l*u,t[n+1]=c*m+h*u+l*p-o*d,t[n+2]=l*m+h*d+o*u-c*p,t[n+3]=h*m-o*p-c*u-l*d,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,n,i,s){return this._x=t,this._y=n,this._z=i,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,n=!0){let i=t._x,s=t._y,a=t._z,r=t._order,o=Math.cos,c=Math.sin,l=o(i/2),h=o(s/2),p=o(a/2),u=c(i/2),d=c(s/2),m=c(a/2);switch(r){case"XYZ":this._x=u*h*p+l*d*m,this._y=l*d*p-u*h*m,this._z=l*h*m+u*d*p,this._w=l*h*p-u*d*m;break;case"YXZ":this._x=u*h*p+l*d*m,this._y=l*d*p-u*h*m,this._z=l*h*m-u*d*p,this._w=l*h*p+u*d*m;break;case"ZXY":this._x=u*h*p-l*d*m,this._y=l*d*p+u*h*m,this._z=l*h*m+u*d*p,this._w=l*h*p-u*d*m;break;case"ZYX":this._x=u*h*p-l*d*m,this._y=l*d*p+u*h*m,this._z=l*h*m-u*d*p,this._w=l*h*p+u*d*m;break;case"YZX":this._x=u*h*p+l*d*m,this._y=l*d*p+u*h*m,this._z=l*h*m-u*d*p,this._w=l*h*p-u*d*m;break;case"XZY":this._x=u*h*p-l*d*m,this._y=l*d*p-u*h*m,this._z=l*h*m+u*d*p,this._w=l*h*p+u*d*m;break;default:Ot("Quaternion: .setFromEuler() encountered an unknown order: "+r)}return n===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,n){let i=n/2,s=Math.sin(i);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(t){let n=t.elements,i=n[0],s=n[4],a=n[8],r=n[1],o=n[5],c=n[9],l=n[2],h=n[6],p=n[10],u=i+o+p;if(u>0){let d=.5/Math.sqrt(u+1);this._w=.25/d,this._x=(h-c)*d,this._y=(a-l)*d,this._z=(r-s)*d}else if(i>o&&i>p){let d=2*Math.sqrt(1+i-o-p);this._w=(h-c)/d,this._x=.25*d,this._y=(s+r)/d,this._z=(a+l)/d}else if(o>p){let d=2*Math.sqrt(1+o-i-p);this._w=(a-l)/d,this._x=(s+r)/d,this._y=.25*d,this._z=(c+h)/d}else{let d=2*Math.sqrt(1+p-i-o);this._w=(r-s)/d,this._x=(a+l)/d,this._y=(c+h)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(t,n){let i=t.dot(n)+1;return i<1e-8?(i=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=i):(this._x=0,this._y=-t.z,this._z=t.y,this._w=i)):(this._x=t.y*n.z-t.z*n.y,this._y=t.z*n.x-t.x*n.z,this._z=t.x*n.y-t.y*n.x,this._w=i),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(jt(this.dot(t),-1,1)))}rotateTowards(t,n){let i=this.angleTo(t);if(i===0)return this;let s=Math.min(1,n/i);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,n){let i=t._x,s=t._y,a=t._z,r=t._w,o=n._x,c=n._y,l=n._z,h=n._w;return this._x=i*h+r*o+s*l-a*c,this._y=s*h+r*c+a*o-i*l,this._z=a*h+r*l+i*c-s*o,this._w=r*h-i*o-s*c-a*l,this._onChangeCallback(),this}slerp(t,n){let i=t._x,s=t._y,a=t._z,r=t._w,o=this.dot(t);o<0&&(i=-i,s=-s,a=-a,r=-r,o=-o);let c=1-n;if(o<.9995){let l=Math.acos(o),h=Math.sin(l);c=Math.sin(c*l)/h,n=Math.sin(n*l)/h,this._x=this._x*c+i*n,this._y=this._y*c+s*n,this._z=this._z*c+a*n,this._w=this._w*c+r*n,this._onChangeCallback()}else this._x=this._x*c+i*n,this._y=this._y*c+s*n,this._z=this._z*c+a*n,this._w=this._w*c+r*n,this.normalize();return this}slerpQuaternions(t,n,i){return this.copy(t).slerp(n,i)}random(){let t=2*Math.PI*Math.random(),n=2*Math.PI*Math.random(),i=Math.random(),s=Math.sqrt(1-i),a=Math.sqrt(i);return this.set(s*Math.sin(t),s*Math.cos(t),a*Math.sin(n),a*Math.cos(n))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,n=0){return this._x=t[n],this._y=t[n+1],this._z=t[n+2],this._w=t[n+3],this._onChangeCallback(),this}toArray(t=[],n=0){return t[n]=this._x,t[n+1]=this._y,t[n+2]=this._z,t[n+3]=this._w,t}fromBufferAttribute(t,n){return this._x=t.getX(n),this._y=t.getY(n),this._z=t.getZ(n),this._w=t.getW(n),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},U=class e{static{e.prototype.isVector3=!0}constructor(t=0,n=0,i=0){this.x=t,this.y=n,this.z=i}set(t,n,i){return i===void 0&&(i=this.z),this.x=t,this.y=n,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this.z=t.z+n.z,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this.z+=t.z*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this.z=t.z-n.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,n){return this.x=t.x*n.x,this.y=t.y*n.y,this.z=t.z*n.z,this}applyEuler(t){return this.applyQuaternion(Pb.setFromEuler(t))}applyAxisAngle(t,n){return this.applyQuaternion(Pb.setFromAxisAngle(t,n))}applyMatrix3(t){let n=this.x,i=this.y,s=this.z,a=t.elements;return this.x=a[0]*n+a[3]*i+a[6]*s,this.y=a[1]*n+a[4]*i+a[7]*s,this.z=a[2]*n+a[5]*i+a[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let n=this.x,i=this.y,s=this.z,a=t.elements,r=1/(a[3]*n+a[7]*i+a[11]*s+a[15]);return this.x=(a[0]*n+a[4]*i+a[8]*s+a[12])*r,this.y=(a[1]*n+a[5]*i+a[9]*s+a[13])*r,this.z=(a[2]*n+a[6]*i+a[10]*s+a[14])*r,this}applyQuaternion(t){let n=this.x,i=this.y,s=this.z,a=t.x,r=t.y,o=t.z,c=t.w,l=2*(r*s-o*i),h=2*(o*n-a*s),p=2*(a*i-r*n);return this.x=n+c*l+r*p-o*h,this.y=i+c*h+o*l-a*p,this.z=s+c*p+a*h-r*l,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let n=this.x,i=this.y,s=this.z,a=t.elements;return this.x=a[0]*n+a[4]*i+a[8]*s,this.y=a[1]*n+a[5]*i+a[9]*s,this.z=a[2]*n+a[6]*i+a[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,n){return this.x=jt(this.x,t.x,n.x),this.y=jt(this.y,t.y,n.y),this.z=jt(this.z,t.z,n.z),this}clampScalar(t,n){return this.x=jt(this.x,t,n),this.y=jt(this.y,t,n),this.z=jt(this.z,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(jt(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this.z+=(t.z-this.z)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this.z=t.z+(n.z-t.z)*i,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,n){let i=t.x,s=t.y,a=t.z,r=n.x,o=n.y,c=n.z;return this.x=s*c-a*o,this.y=a*r-i*c,this.z=i*o-s*r,this}projectOnVector(t){let n=t.lengthSq();if(n===0)return this.set(0,0,0);let i=t.dot(this)/n;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return lg.copy(this).projectOnVector(t),this.sub(lg)}reflect(t){return this.sub(lg.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let n=Math.sqrt(this.lengthSq()*t.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(t)/n;return Math.acos(jt(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let n=this.x-t.x,i=this.y-t.y,s=this.z-t.z;return n*n+i*i+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,n,i){let s=Math.sin(n)*t;return this.x=s*Math.sin(i),this.y=Math.cos(n)*t,this.z=s*Math.cos(i),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,n,i){return this.x=t*Math.sin(n),this.y=i,this.z=t*Math.cos(n),this}setFromMatrixPosition(t){let n=t.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this}setFromMatrixScale(t){let n=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=n,this.y=i,this.z=s,this}setFromMatrixColumn(t,n){return this.fromArray(t.elements,n*4)}setFromMatrix3Column(t,n){return this.fromArray(t.elements,n*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this.z=t[n+2],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t[n+2]=this.z,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this.z=t.getZ(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,n=Math.random()*2-1,i=Math.sqrt(1-n*n);return this.x=i*Math.cos(t),this.y=n,this.z=i*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},lg=new U,Pb=new Wi,Ht=class e{static{e.prototype.isMatrix3=!0}constructor(t,n,i,s,a,r,o,c,l){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,n,i,s,a,r,o,c,l)}set(t,n,i,s,a,r,o,c,l){let h=this.elements;return h[0]=t,h[1]=s,h[2]=o,h[3]=n,h[4]=a,h[5]=c,h[6]=i,h[7]=r,h[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let n=this.elements,i=t.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],this}extractBasis(t,n,i){return t.setFromMatrix3Column(this,0),n.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let n=t.elements;return this.set(n[0],n[4],n[8],n[1],n[5],n[9],n[2],n[6],n[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,n){let i=t.elements,s=n.elements,a=this.elements,r=i[0],o=i[3],c=i[6],l=i[1],h=i[4],p=i[7],u=i[2],d=i[5],m=i[8],S=s[0],g=s[3],f=s[6],_=s[1],x=s[4],v=s[7],T=s[2],A=s[5],w=s[8];return a[0]=r*S+o*_+c*T,a[3]=r*g+o*x+c*A,a[6]=r*f+o*v+c*w,a[1]=l*S+h*_+p*T,a[4]=l*g+h*x+p*A,a[7]=l*f+h*v+p*w,a[2]=u*S+d*_+m*T,a[5]=u*g+d*x+m*A,a[8]=u*f+d*v+m*w,this}multiplyScalar(t){let n=this.elements;return n[0]*=t,n[3]*=t,n[6]*=t,n[1]*=t,n[4]*=t,n[7]*=t,n[2]*=t,n[5]*=t,n[8]*=t,this}determinant(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],c=t[6],l=t[7],h=t[8];return n*r*h-n*o*l-i*a*h+i*o*c+s*a*l-s*r*c}invert(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],c=t[6],l=t[7],h=t[8],p=h*r-o*l,u=o*c-h*a,d=l*a-r*c,m=n*p+i*u+s*d;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);let S=1/m;return t[0]=p*S,t[1]=(s*l-h*i)*S,t[2]=(o*i-s*r)*S,t[3]=u*S,t[4]=(h*n-s*c)*S,t[5]=(s*a-o*n)*S,t[6]=d*S,t[7]=(i*c-l*n)*S,t[8]=(r*n-i*a)*S,this}transpose(){let t,n=this.elements;return t=n[1],n[1]=n[3],n[3]=t,t=n[2],n[2]=n[6],n[6]=t,t=n[5],n[5]=n[7],n[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let n=this.elements;return t[0]=n[0],t[1]=n[3],t[2]=n[6],t[3]=n[1],t[4]=n[4],t[5]=n[7],t[6]=n[2],t[7]=n[5],t[8]=n[8],this}setUvTransform(t,n,i,s,a,r,o){let c=Math.cos(a),l=Math.sin(a);return this.set(i*c,i*l,-i*(c*r+l*o)+r+t,-s*l,s*c,-s*(-l*r+c*o)+o+n,0,0,1),this}scale(t,n){return ja("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(cg.makeScale(t,n)),this}rotate(t){return ja("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(cg.makeRotation(-t)),this}translate(t,n){return ja("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(cg.makeTranslation(t,n)),this}makeTranslation(t,n){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,n,0,0,1),this}makeRotation(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,-i,0,i,n,0,0,0,1),this}makeScale(t,n){return this.set(t,0,0,0,n,0,0,0,1),this}equals(t){let n=this.elements,i=t.elements;for(let s=0;s<9;s++)if(n[s]!==i[s])return!1;return!0}fromArray(t,n=0){for(let i=0;i<9;i++)this.elements[i]=t[i+n];return this}toArray(t=[],n=0){let i=this.elements;return t[n]=i[0],t[n+1]=i[1],t[n+2]=i[2],t[n+3]=i[3],t[n+4]=i[4],t[n+5]=i[5],t[n+6]=i[6],t[n+7]=i[7],t[n+8]=i[8],t}clone(){return new this.constructor().fromArray(this.elements)}},cg=new Ht,zb=new Ht().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Bb=new Ht().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function zT(){let e={enabled:!0,workingColorSpace:Bl,spaces:{},convert:function(s,a,r){return this.enabled===!1||a===r||!a||!r||(this.spaces[a].transfer===ue&&(s.r=Es(s.r),s.g=Es(s.g),s.b=Es(s.b)),this.spaces[a].primaries!==this.spaces[r].primaries&&(s.applyMatrix3(this.spaces[a].toXYZ),s.applyMatrix3(this.spaces[r].fromXYZ)),this.spaces[r].transfer===ue&&(s.r=ho(s.r),s.g=ho(s.g),s.b=ho(s.b))),s},workingToColorSpace:function(s,a){return this.convert(s,this.workingColorSpace,a)},colorSpaceToWorking:function(s,a){return this.convert(s,a,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===ws?Fl:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,a=this.workingColorSpace){return s.fromArray(this.spaces[a].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,a,r){return s.copy(this.spaces[a].toXYZ).multiply(this.spaces[r].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,a){return ja("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),e.workingToColorSpace(s,a)},toWorkingColorSpace:function(s,a){return ja("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),e.colorSpaceToWorking(s,a)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],i=[.3127,.329];return e.define({[Bl]:{primaries:t,whitePoint:i,transfer:Fl,toXYZ:zb,fromXYZ:Bb,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:Tn},outputColorSpaceConfig:{drawingBufferColorSpace:Tn}},[Tn]:{primaries:t,whitePoint:i,transfer:ue,toXYZ:zb,fromXYZ:Bb,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:Tn}}}),e}var ee=zT();function Es(e){return e<.04045?e*.0773993808:Math.pow(e*.9478672986+.0521327014,2.4)}function ho(e){return e<.0031308?e*12.92:1.055*Math.pow(e,.41666)-.055}var $r,Xh=class{static getDataURL(t,n="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let i;if(t instanceof HTMLCanvasElement)i=t;else{$r===void 0&&($r=Hl("canvas")),$r.width=t.width,$r.height=t.height;let s=$r.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),i=$r}return i.toDataURL(n)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let n=Hl("canvas");n.width=t.width,n.height=t.height;let i=n.getContext("2d");i.drawImage(t,0,0,t.width,t.height);let s=i.getImageData(0,0,t.width,t.height),a=s.data;for(let r=0;r<a.length;r++)a[r]=Es(a[r]/255)*255;return i.putImageData(s,0,0),n}else if(t.data){let n=t.data.slice(0);for(let i=0;i<n.length;i++)n instanceof Uint8Array||n instanceof Uint8ClampedArray?n[i]=Math.floor(Es(n[i]/255)*255):n[i]=Es(n[i]);return{data:n,width:t.width,height:t.height}}else return Ot("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},BT=0,po=class{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:BT++}),this.uuid=gc(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let n=this.data;return typeof HTMLVideoElement<"u"&&n instanceof HTMLVideoElement?t.set(n.videoWidth,n.videoHeight,0):typeof VideoFrame<"u"&&n instanceof VideoFrame?t.set(n.displayWidth,n.displayHeight,0):n!==null?t.set(n.width,n.height,n.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let n=t===void 0||typeof t=="string";if(!n&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let i={uuid:this.uuid,url:""},s=this.data;if(s!==null){let a;if(Array.isArray(s)){a=[];for(let r=0,o=s.length;r<o;r++)s[r].isDataTexture?a.push(ug(s[r].image)):a.push(ug(s[r]))}else a=ug(s);i.url=a}return n||(t.images[this.uuid]=i),i}};function ug(e){return typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap?Xh.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(Ot("Texture: Unable to serialize Texture."),{})}var FT=0,hg=new U,xn=class e extends Xi{constructor(t=e.DEFAULT_IMAGE,n=e.DEFAULT_MAPPING,i=Hi,s=Hi,a=dn,r=xa,o=_i,c=ei,l=e.DEFAULT_ANISOTROPY,h=ws){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:FT++}),this.uuid=gc(),this.name="",this.source=new po(t),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=i,this.wrapT=s,this.magFilter=a,this.minFilter=r,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=c,this.offset=new It(0,0),this.repeat=new It(1,1),this.center=new It(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ht,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(hg).x}get height(){return this.source.getSize(hg).y}get depth(){return this.source.getSize(hg).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,n){this.updateRanges.push({start:t,count:n})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let n in t){let i=t[n];if(i===void 0){Ot(`Texture.setValues(): parameter '${n}' has value of undefined.`);continue}let s=this[n];if(s===void 0){Ot(`Texture.setValues(): property '${n}' does not exist.`);continue}s&&i&&s.isVector2&&i.isVector2||s&&i&&s.isVector3&&i.isVector3||s&&i&&s.isMatrix3&&i.isMatrix3?s.copy(i):this[n]=i}}toJSON(t){let n=t===void 0||typeof t=="string";if(!n&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),n||(t.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==t0)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Vh:t.x=t.x-Math.floor(t.x);break;case Hi:t.x=t.x<0?0:1;break;case Hh:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Vh:t.y=t.y-Math.floor(t.y);break;case Hi:t.y=t.y<0?0:1;break;case Hh:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};xn.DEFAULT_IMAGE=null;xn.DEFAULT_MAPPING=t0;xn.DEFAULT_ANISOTROPY=1;var Pe=class e{static{e.prototype.isVector4=!0}constructor(t=0,n=0,i=0,s=1){this.x=t,this.y=n,this.z=i,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,n,i,s){return this.x=t,this.y=n,this.z=i,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;case 3:this.w=n;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this.z=t.z+n.z,this.w=t.w+n.w,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this.z+=t.z*n,this.w+=t.w*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this.z=t.z-n.z,this.w=t.w-n.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let n=this.x,i=this.y,s=this.z,a=this.w,r=t.elements;return this.x=r[0]*n+r[4]*i+r[8]*s+r[12]*a,this.y=r[1]*n+r[5]*i+r[9]*s+r[13]*a,this.z=r[2]*n+r[6]*i+r[10]*s+r[14]*a,this.w=r[3]*n+r[7]*i+r[11]*s+r[15]*a,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let n=Math.sqrt(1-t.w*t.w);return n<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/n,this.y=t.y/n,this.z=t.z/n),this}setAxisAngleFromRotationMatrix(t){let n,i,s,a,c=t.elements,l=c[0],h=c[4],p=c[8],u=c[1],d=c[5],m=c[9],S=c[2],g=c[6],f=c[10];if(Math.abs(h-u)<.01&&Math.abs(p-S)<.01&&Math.abs(m-g)<.01){if(Math.abs(h+u)<.1&&Math.abs(p+S)<.1&&Math.abs(m+g)<.1&&Math.abs(l+d+f-3)<.1)return this.set(1,0,0,0),this;n=Math.PI;let x=(l+1)/2,v=(d+1)/2,T=(f+1)/2,A=(h+u)/4,w=(p+S)/4,y=(m+g)/4;return x>v&&x>T?x<.01?(i=0,s=.707106781,a=.707106781):(i=Math.sqrt(x),s=A/i,a=w/i):v>T?v<.01?(i=.707106781,s=0,a=.707106781):(s=Math.sqrt(v),i=A/s,a=y/s):T<.01?(i=.707106781,s=.707106781,a=0):(a=Math.sqrt(T),i=w/a,s=y/a),this.set(i,s,a,n),this}let _=Math.sqrt((g-m)*(g-m)+(p-S)*(p-S)+(u-h)*(u-h));return Math.abs(_)<.001&&(_=1),this.x=(g-m)/_,this.y=(p-S)/_,this.z=(u-h)/_,this.w=Math.acos((l+d+f-1)/2),this}setFromMatrixPosition(t){let n=t.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this.w=n[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,n){return this.x=jt(this.x,t.x,n.x),this.y=jt(this.y,t.y,n.y),this.z=jt(this.z,t.z,n.z),this.w=jt(this.w,t.w,n.w),this}clampScalar(t,n){return this.x=jt(this.x,t,n),this.y=jt(this.y,t,n),this.z=jt(this.z,t,n),this.w=jt(this.w,t,n),this}clampLength(t,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(jt(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this.z+=(t.z-this.z)*n,this.w+=(t.w-this.w)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this.z=t.z+(n.z-t.z)*i,this.w=t.w+(n.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this.z=t[n+2],this.w=t[n+3],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t[n+2]=this.z,t[n+3]=this.w,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this.z=t.getZ(n),this.w=t.getW(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Wh=class extends Xi{constructor(t=1,n=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:dn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=t,this.height=n,this.depth=i.depth,this.scissor=new Pe(0,0,t,n),this.scissorTest=!1,this.viewport=new Pe(0,0,t,n),this.textures=[];let s={width:t,height:n,depth:i.depth},a=new xn(s),r=i.count;for(let o=0;o<r;o++)this.textures[o]=a.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(t={}){let n={minFilter:dn,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(n.mapping=t.mapping),t.wrapS!==void 0&&(n.wrapS=t.wrapS),t.wrapT!==void 0&&(n.wrapT=t.wrapT),t.wrapR!==void 0&&(n.wrapR=t.wrapR),t.magFilter!==void 0&&(n.magFilter=t.magFilter),t.minFilter!==void 0&&(n.minFilter=t.minFilter),t.format!==void 0&&(n.format=t.format),t.type!==void 0&&(n.type=t.type),t.anisotropy!==void 0&&(n.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(n.colorSpace=t.colorSpace),t.flipY!==void 0&&(n.flipY=t.flipY),t.generateMipmaps!==void 0&&(n.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(n.internalFormat=t.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(n)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),t!==null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,n,i=1){if(this.width!==t||this.height!==n||this.depth!==i){this.width=t,this.height=n,this.depth=i;for(let s=0,a=this.textures.length;s<a;s++)this.textures[s].image.width=t,this.textures[s].image.height=n,this.textures[s].image.depth=i,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,n),this.scissor.set(0,0,t,n)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,i=t.textures.length;n<i;n++){this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0,this.textures[n].renderTarget=this;let s=Object.assign({},t.textures[n].image);this.textures[n].source=new po(s)}return this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},Kn=class extends Wh{constructor(t=1,n=1,i={}){super(t,n,i),this.isWebGLRenderTarget=!0}},Gl=class extends xn{constructor(t=null,n=1,i=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:n,height:i,depth:s},this.magFilter=on,this.minFilter=on,this.wrapR=Hi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var qh=class extends xn{constructor(t=null,n=1,i=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:n,height:i,depth:s},this.magFilter=on,this.minFilter=on,this.wrapR=Hi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Oe=class e{static{e.prototype.isMatrix4=!0}constructor(t,n,i,s,a,r,o,c,l,h,p,u,d,m,S,g){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,n,i,s,a,r,o,c,l,h,p,u,d,m,S,g)}set(t,n,i,s,a,r,o,c,l,h,p,u,d,m,S,g){let f=this.elements;return f[0]=t,f[4]=n,f[8]=i,f[12]=s,f[1]=a,f[5]=r,f[9]=o,f[13]=c,f[2]=l,f[6]=h,f[10]=p,f[14]=u,f[3]=d,f[7]=m,f[11]=S,f[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(t){let n=this.elements,i=t.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],n[9]=i[9],n[10]=i[10],n[11]=i[11],n[12]=i[12],n[13]=i[13],n[14]=i[14],n[15]=i[15],this}copyPosition(t){let n=this.elements,i=t.elements;return n[12]=i[12],n[13]=i[13],n[14]=i[14],this}setFromMatrix3(t){let n=t.elements;return this.set(n[0],n[3],n[6],0,n[1],n[4],n[7],0,n[2],n[5],n[8],0,0,0,0,1),this}extractBasis(t,n,i){return this.determinantAffine()===0?(t.set(1,0,0),n.set(0,1,0),i.set(0,0,1),this):(t.setFromMatrixColumn(this,0),n.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(t,n,i){return this.set(t.x,n.x,i.x,0,t.y,n.y,i.y,0,t.z,n.z,i.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let n=this.elements,i=t.elements,s=1/to.setFromMatrixColumn(t,0).length(),a=1/to.setFromMatrixColumn(t,1).length(),r=1/to.setFromMatrixColumn(t,2).length();return n[0]=i[0]*s,n[1]=i[1]*s,n[2]=i[2]*s,n[3]=0,n[4]=i[4]*a,n[5]=i[5]*a,n[6]=i[6]*a,n[7]=0,n[8]=i[8]*r,n[9]=i[9]*r,n[10]=i[10]*r,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromEuler(t){let n=this.elements,i=t.x,s=t.y,a=t.z,r=Math.cos(i),o=Math.sin(i),c=Math.cos(s),l=Math.sin(s),h=Math.cos(a),p=Math.sin(a);if(t.order==="XYZ"){let u=r*h,d=r*p,m=o*h,S=o*p;n[0]=c*h,n[4]=-c*p,n[8]=l,n[1]=d+m*l,n[5]=u-S*l,n[9]=-o*c,n[2]=S-u*l,n[6]=m+d*l,n[10]=r*c}else if(t.order==="YXZ"){let u=c*h,d=c*p,m=l*h,S=l*p;n[0]=u+S*o,n[4]=m*o-d,n[8]=r*l,n[1]=r*p,n[5]=r*h,n[9]=-o,n[2]=d*o-m,n[6]=S+u*o,n[10]=r*c}else if(t.order==="ZXY"){let u=c*h,d=c*p,m=l*h,S=l*p;n[0]=u-S*o,n[4]=-r*p,n[8]=m+d*o,n[1]=d+m*o,n[5]=r*h,n[9]=S-u*o,n[2]=-r*l,n[6]=o,n[10]=r*c}else if(t.order==="ZYX"){let u=r*h,d=r*p,m=o*h,S=o*p;n[0]=c*h,n[4]=m*l-d,n[8]=u*l+S,n[1]=c*p,n[5]=S*l+u,n[9]=d*l-m,n[2]=-l,n[6]=o*c,n[10]=r*c}else if(t.order==="YZX"){let u=r*c,d=r*l,m=o*c,S=o*l;n[0]=c*h,n[4]=S-u*p,n[8]=m*p+d,n[1]=p,n[5]=r*h,n[9]=-o*h,n[2]=-l*h,n[6]=d*p+m,n[10]=u-S*p}else if(t.order==="XZY"){let u=r*c,d=r*l,m=o*c,S=o*l;n[0]=c*h,n[4]=-p,n[8]=l*h,n[1]=u*p+S,n[5]=r*h,n[9]=d*p-m,n[2]=m*p-d,n[6]=o*h,n[10]=S*p+u}return n[3]=0,n[7]=0,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromQuaternion(t){return this.compose(VT,t,HT)}lookAt(t,n,i){let s=this.elements;return Yn.subVectors(t,n),Yn.lengthSq()===0&&(Yn.z=1),Yn.normalize(),aa.crossVectors(i,Yn),aa.lengthSq()===0&&(Math.abs(i.z)===1?Yn.x+=1e-4:Yn.z+=1e-4,Yn.normalize(),aa.crossVectors(i,Yn)),aa.normalize(),sh.crossVectors(Yn,aa),s[0]=aa.x,s[4]=sh.x,s[8]=Yn.x,s[1]=aa.y,s[5]=sh.y,s[9]=Yn.y,s[2]=aa.z,s[6]=sh.z,s[10]=Yn.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,n){let i=t.elements,s=n.elements,a=this.elements,r=i[0],o=i[4],c=i[8],l=i[12],h=i[1],p=i[5],u=i[9],d=i[13],m=i[2],S=i[6],g=i[10],f=i[14],_=i[3],x=i[7],v=i[11],T=i[15],A=s[0],w=s[4],y=s[8],M=s[12],C=s[1],D=s[5],L=s[9],P=s[13],W=s[2],B=s[6],q=s[10],X=s[14],et=s[3],at=s[7],ut=s[11],pt=s[15];return a[0]=r*A+o*C+c*W+l*et,a[4]=r*w+o*D+c*B+l*at,a[8]=r*y+o*L+c*q+l*ut,a[12]=r*M+o*P+c*X+l*pt,a[1]=h*A+p*C+u*W+d*et,a[5]=h*w+p*D+u*B+d*at,a[9]=h*y+p*L+u*q+d*ut,a[13]=h*M+p*P+u*X+d*pt,a[2]=m*A+S*C+g*W+f*et,a[6]=m*w+S*D+g*B+f*at,a[10]=m*y+S*L+g*q+f*ut,a[14]=m*M+S*P+g*X+f*pt,a[3]=_*A+x*C+v*W+T*et,a[7]=_*w+x*D+v*B+T*at,a[11]=_*y+x*L+v*q+T*ut,a[15]=_*M+x*P+v*X+T*pt,this}multiplyScalar(t){let n=this.elements;return n[0]*=t,n[4]*=t,n[8]*=t,n[12]*=t,n[1]*=t,n[5]*=t,n[9]*=t,n[13]*=t,n[2]*=t,n[6]*=t,n[10]*=t,n[14]*=t,n[3]*=t,n[7]*=t,n[11]*=t,n[15]*=t,this}determinant(){let t=this.elements,n=t[0],i=t[4],s=t[8],a=t[12],r=t[1],o=t[5],c=t[9],l=t[13],h=t[2],p=t[6],u=t[10],d=t[14],m=t[3],S=t[7],g=t[11],f=t[15],_=c*d-l*u,x=o*d-l*p,v=o*u-c*p,T=r*d-l*h,A=r*u-c*h,w=r*p-o*h;return n*(S*_-g*x+f*v)-i*(m*_-g*T+f*A)+s*(m*x-S*T+f*w)-a*(m*v-S*A+g*w)}determinantAffine(){let t=this.elements,n=t[0],i=t[4],s=t[8],a=t[1],r=t[5],o=t[9],c=t[2],l=t[6],h=t[10];return n*(r*h-o*l)-i*(a*h-o*c)+s*(a*l-r*c)}transpose(){let t=this.elements,n;return n=t[1],t[1]=t[4],t[4]=n,n=t[2],t[2]=t[8],t[8]=n,n=t[6],t[6]=t[9],t[9]=n,n=t[3],t[3]=t[12],t[12]=n,n=t[7],t[7]=t[13],t[13]=n,n=t[11],t[11]=t[14],t[14]=n,this}setPosition(t,n,i){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=n,s[14]=i),this}invert(){let t=this.elements,n=t[0],i=t[1],s=t[2],a=t[3],r=t[4],o=t[5],c=t[6],l=t[7],h=t[8],p=t[9],u=t[10],d=t[11],m=t[12],S=t[13],g=t[14],f=t[15],_=n*o-i*r,x=n*c-s*r,v=n*l-a*r,T=i*c-s*o,A=i*l-a*o,w=s*l-a*c,y=h*S-p*m,M=h*g-u*m,C=h*f-d*m,D=p*g-u*S,L=p*f-d*S,P=u*f-d*g,W=_*P-x*L+v*D+T*C-A*M+w*y;if(W===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let B=1/W;return t[0]=(o*P-c*L+l*D)*B,t[1]=(s*L-i*P-a*D)*B,t[2]=(S*w-g*A+f*T)*B,t[3]=(u*A-p*w-d*T)*B,t[4]=(c*C-r*P-l*M)*B,t[5]=(n*P-s*C+a*M)*B,t[6]=(g*v-m*w-f*x)*B,t[7]=(h*w-u*v+d*x)*B,t[8]=(r*L-o*C+l*y)*B,t[9]=(i*C-n*L-a*y)*B,t[10]=(m*A-S*v+f*_)*B,t[11]=(p*v-h*A-d*_)*B,t[12]=(o*M-r*D-c*y)*B,t[13]=(n*D-i*M+s*y)*B,t[14]=(S*x-m*T-g*_)*B,t[15]=(h*T-p*x+u*_)*B,this}scale(t){let n=this.elements,i=t.x,s=t.y,a=t.z;return n[0]*=i,n[4]*=s,n[8]*=a,n[1]*=i,n[5]*=s,n[9]*=a,n[2]*=i,n[6]*=s,n[10]*=a,n[3]*=i,n[7]*=s,n[11]*=a,this}getMaxScaleOnAxis(){let t=this.elements,n=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(n,i,s))}makeTranslation(t,n,i){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,n,0,0,1,i,0,0,0,1),this}makeRotationX(t){let n=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,n,-i,0,0,i,n,0,0,0,0,1),this}makeRotationY(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,0,i,0,0,1,0,0,-i,0,n,0,0,0,0,1),this}makeRotationZ(t){let n=Math.cos(t),i=Math.sin(t);return this.set(n,-i,0,0,i,n,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,n){let i=Math.cos(n),s=Math.sin(n),a=1-i,r=t.x,o=t.y,c=t.z,l=a*r,h=a*o;return this.set(l*r+i,l*o-s*c,l*c+s*o,0,l*o+s*c,h*o+i,h*c-s*r,0,l*c-s*o,h*c+s*r,a*c*c+i,0,0,0,0,1),this}makeScale(t,n,i){return this.set(t,0,0,0,0,n,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,n,i,s,a,r){return this.set(1,i,a,0,t,1,r,0,n,s,1,0,0,0,0,1),this}compose(t,n,i){let s=this.elements,a=n._x,r=n._y,o=n._z,c=n._w,l=a+a,h=r+r,p=o+o,u=a*l,d=a*h,m=a*p,S=r*h,g=r*p,f=o*p,_=c*l,x=c*h,v=c*p,T=i.x,A=i.y,w=i.z;return s[0]=(1-(S+f))*T,s[1]=(d+v)*T,s[2]=(m-x)*T,s[3]=0,s[4]=(d-v)*A,s[5]=(1-(u+f))*A,s[6]=(g+_)*A,s[7]=0,s[8]=(m+x)*w,s[9]=(g-_)*w,s[10]=(1-(u+S))*w,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,n,i){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let a=this.determinantAffine();if(a===0)return i.set(1,1,1),n.identity(),this;let r=to.set(s[0],s[1],s[2]).length(),o=to.set(s[4],s[5],s[6]).length(),c=to.set(s[8],s[9],s[10]).length();a<0&&(r=-r),bi.copy(this);let l=1/r,h=1/o,p=1/c;return bi.elements[0]*=l,bi.elements[1]*=l,bi.elements[2]*=l,bi.elements[4]*=h,bi.elements[5]*=h,bi.elements[6]*=h,bi.elements[8]*=p,bi.elements[9]*=p,bi.elements[10]*=p,n.setFromRotationMatrix(bi),i.x=r,i.y=o,i.z=c,this}makePerspective(t,n,i,s,a,r,o=Ei,c=!1){let l=this.elements,h=2*a/(n-t),p=2*a/(i-s),u=(n+t)/(n-t),d=(i+s)/(i-s),m,S;if(c)m=a/(r-a),S=r*a/(r-a);else if(o===Ei)m=-(r+a)/(r-a),S=-2*r*a/(r-a);else if(o===Vl)m=-r/(r-a),S=-r*a/(r-a);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=h,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=p,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=m,l[14]=S,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,n,i,s,a,r,o=Ei,c=!1){let l=this.elements,h=2/(n-t),p=2/(i-s),u=-(n+t)/(n-t),d=-(i+s)/(i-s),m,S;if(c)m=1/(r-a),S=r/(r-a);else if(o===Ei)m=-2/(r-a),S=-(r+a)/(r-a);else if(o===Vl)m=-1/(r-a),S=-a/(r-a);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=h,l[4]=0,l[8]=0,l[12]=u,l[1]=0,l[5]=p,l[9]=0,l[13]=d,l[2]=0,l[6]=0,l[10]=m,l[14]=S,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){let n=this.elements,i=t.elements;for(let s=0;s<16;s++)if(n[s]!==i[s])return!1;return!0}fromArray(t,n=0){for(let i=0;i<16;i++)this.elements[i]=t[i+n];return this}toArray(t=[],n=0){let i=this.elements;return t[n]=i[0],t[n+1]=i[1],t[n+2]=i[2],t[n+3]=i[3],t[n+4]=i[4],t[n+5]=i[5],t[n+6]=i[6],t[n+7]=i[7],t[n+8]=i[8],t[n+9]=i[9],t[n+10]=i[10],t[n+11]=i[11],t[n+12]=i[12],t[n+13]=i[13],t[n+14]=i[14],t[n+15]=i[15],t}},to=new U,bi=new Oe,VT=new U(0,0,0),HT=new U(1,1,1),aa=new U,sh=new U,Yn=new U,Fb=new Oe,Vb=new Wi,fa=class e{constructor(t=0,n=0,i=0,s=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=i,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,n,i,s=this._order){return this._x=t,this._y=n,this._z=i,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,n=this._order,i=!0){let s=t.elements,a=s[0],r=s[4],o=s[8],c=s[1],l=s[5],h=s[9],p=s[2],u=s[6],d=s[10];switch(n){case"XYZ":this._y=Math.asin(jt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,d),this._z=Math.atan2(-r,a)):(this._x=Math.atan2(u,l),this._z=0);break;case"YXZ":this._x=Math.asin(-jt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,d),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-p,a),this._z=0);break;case"ZXY":this._x=Math.asin(jt(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-p,d),this._z=Math.atan2(-r,l)):(this._y=0,this._z=Math.atan2(c,a));break;case"ZYX":this._y=Math.asin(-jt(p,-1,1)),Math.abs(p)<.9999999?(this._x=Math.atan2(u,d),this._z=Math.atan2(c,a)):(this._x=0,this._z=Math.atan2(-r,l));break;case"YZX":this._z=Math.asin(jt(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,l),this._y=Math.atan2(-p,a)):(this._x=0,this._y=Math.atan2(o,d));break;case"XZY":this._z=Math.asin(-jt(r,-1,1)),Math.abs(r)<.9999999?(this._x=Math.atan2(u,l),this._y=Math.atan2(o,a)):(this._x=Math.atan2(-h,d),this._y=0);break;default:Ot("Euler: .setFromRotationMatrix() encountered an unknown order: "+n)}return this._order=n,i===!0&&this._onChangeCallback(),this}setFromQuaternion(t,n,i){return Fb.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Fb,n,i)}setFromVector3(t,n=this._order){return this.set(t.x,t.y,t.z,n)}reorder(t){return Vb.setFromEuler(this),this.setFromQuaternion(Vb,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],n=0){return t[n]=this._x,t[n+1]=this._y,t[n+2]=this._z,t[n+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};fa.DEFAULT_ORDER="XYZ";var kl=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},GT=0,Hb=new U,eo=new Wi,vs=new Oe,ah=new U,Dl=new U,kT=new U,XT=new Wi,Gb=new U(1,0,0),kb=new U(0,1,0),Xb=new U(0,0,1),Wb={type:"added"},WT={type:"removed"},no={type:"childadded",child:null},fg={type:"childremoved",child:null},jn=class e extends Xi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:GT++}),this.uuid=gc(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new U,n=new fa,i=new Wi,s=new U(1,1,1);function a(){i.setFromEuler(n,!1)}function r(){n.setFromQuaternion(i,void 0,!1)}n._onChange(a),i._onChange(r),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Oe},normalMatrix:{value:new Ht}}),this.matrix=new Oe,this.matrixWorld=new Oe,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new kl,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,n){this.quaternion.setFromAxisAngle(t,n)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,n){return eo.setFromAxisAngle(t,n),this.quaternion.multiply(eo),this}rotateOnWorldAxis(t,n){return eo.setFromAxisAngle(t,n),this.quaternion.premultiply(eo),this}rotateX(t){return this.rotateOnAxis(Gb,t)}rotateY(t){return this.rotateOnAxis(kb,t)}rotateZ(t){return this.rotateOnAxis(Xb,t)}translateOnAxis(t,n){return Hb.copy(t).applyQuaternion(this.quaternion),this.position.add(Hb.multiplyScalar(n)),this}translateX(t){return this.translateOnAxis(Gb,t)}translateY(t){return this.translateOnAxis(kb,t)}translateZ(t){return this.translateOnAxis(Xb,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(vs.copy(this.matrixWorld).invert())}lookAt(t,n,i){t.isVector3?ah.copy(t):ah.set(t,n,i);let s=this.parent;this.updateWorldMatrix(!0,!1),Dl.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?vs.lookAt(Dl,ah,this.up):vs.lookAt(ah,Dl,this.up),this.quaternion.setFromRotationMatrix(vs),s&&(vs.extractRotation(s.matrixWorld),eo.setFromRotationMatrix(vs),this.quaternion.premultiply(eo.invert()))}add(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.add(arguments[n]);return this}return t===this?(zt("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Wb),no.child=t,this.dispatchEvent(no),no.child=null):zt("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let n=this.children.indexOf(t);return n!==-1&&(t.parent=null,this.children.splice(n,1),t.dispatchEvent(WT),fg.child=t,this.dispatchEvent(fg),fg.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),vs.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),vs.multiply(t.parent.matrixWorld)),t.applyMatrix4(vs),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Wb),no.child=t,this.dispatchEvent(no),no.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,n){if(this[t]===n)return this;for(let i=0,s=this.children.length;i<s;i++){let r=this.children[i].getObjectByProperty(t,n);if(r!==void 0)return r}}getObjectsByProperty(t,n,i=[]){this[t]===n&&i.push(this);let s=this.children;for(let a=0,r=s.length;a<r;a++)s[a].getObjectsByProperty(t,n,i);return i}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Dl,t,kT),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Dl,XT,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let n=this.matrixWorld.elements;return t.set(n[8],n[9],n[10]).normalize()}raycast(){}traverse(t){t(this);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].traverseVisible(t)}traverseAncestors(t){let n=this.parent;n!==null&&(t(n),n.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let n=t.x,i=t.y,s=t.z,a=this.matrix.elements;a[12]+=n-a[0]*n-a[4]*i-a[8]*s,a[13]+=i-a[1]*n-a[5]*i-a[9]*s,a[14]+=s-a[2]*n-a[6]*i-a[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let n=this.children;for(let i=0,s=n.length;i<s;i++)n[i].updateMatrixWorld(t)}updateWorldMatrix(t,n,i=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),n===!0){let a=this.children;for(let r=0,o=a.length;r<o;r++)a[r].updateWorldMatrix(!1,!0,i)}}toJSON(t){let n=t===void 0||typeof t=="string",i={};n&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function a(o,c){return o[c.uuid]===void 0&&(o[c.uuid]=c.toJSON(t)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=a(t.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let c=o.shapes;if(Array.isArray(c))for(let l=0,h=c.length;l<h;l++){let p=c[l];a(t.shapes,p)}else a(t.shapes,c)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(a(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let c=0,l=this.material.length;c<l;c++)o.push(a(t.materials,this.material[c]));s.material=o}else s.material=a(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let c=this.animations[o];s.animations.push(a(t.animations,c))}}if(n){let o=r(t.geometries),c=r(t.materials),l=r(t.textures),h=r(t.images),p=r(t.shapes),u=r(t.skeletons),d=r(t.animations),m=r(t.nodes);o.length>0&&(i.geometries=o),c.length>0&&(i.materials=c),l.length>0&&(i.textures=l),h.length>0&&(i.images=h),p.length>0&&(i.shapes=p),u.length>0&&(i.skeletons=u),d.length>0&&(i.animations=d),m.length>0&&(i.nodes=m)}return i.object=s,i;function r(o){let c=[];for(let l in o){let h=o[l];delete h.metadata,c.push(h)}return c}}clone(t){return new this.constructor().copy(this,t)}copy(t,n=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),n===!0)for(let i=0;i<t.children.length;i++){let s=t.children[i];this.add(s.clone())}return this}};jn.DEFAULT_UP=new U(0,1,0);jn.DEFAULT_MATRIX_AUTO_UPDATE=!0;jn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Gi=class extends jn{constructor(){super(),this.isGroup=!0,this.type="Group"}},qT={type:"move"},mo=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Gi,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Gi,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new U,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new U),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Gi,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new U,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new U,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let n=this._hand;if(n)for(let i of t.hand.values())this._getHandJoint(n,i)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,n,i){let s=null,a=null,r=null,o=this._targetRay,c=this._grip,l=this._hand;if(t&&n.session.visibilityState!=="visible-blurred"){if(l&&t.hand){r=!0;for(let S of t.hand.values()){let g=n.getJointPose(S,i),f=this._getHandJoint(l,S);g!==null&&(f.matrix.fromArray(g.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=g.radius),f.visible=g!==null}let h=l.joints["index-finger-tip"],p=l.joints["thumb-tip"],u=h.position.distanceTo(p.position),d=.02,m=.005;l.inputState.pinching&&u>d+m?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!l.inputState.pinching&&u<=d-m&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else c!==null&&t.gripSpace&&(a=n.getPose(t.gripSpace,i),a!==null&&(c.matrix.fromArray(a.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,a.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(a.linearVelocity)):c.hasLinearVelocity=!1,a.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(a.angularVelocity)):c.hasAngularVelocity=!1,c.eventsEnabled&&c.dispatchEvent({type:"gripUpdated",data:t,target:this})));o!==null&&(s=n.getPose(t.targetRaySpace,i),s===null&&a!==null&&(s=a),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(qT)))}return o!==null&&(o.visible=s!==null),c!==null&&(c.visible=a!==null),l!==null&&(l.visible=r!==null),this}_getHandJoint(t,n){if(t.joints[n.jointName]===void 0){let i=new Gi;i.matrixAutoUpdate=!1,i.visible=!1,t.joints[n.jointName]=i,t.add(i)}return t.joints[n.jointName]}},GS={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ra={h:0,s:0,l:0},rh={h:0,s:0,l:0};function dg(e,t,n){return n<0&&(n+=1),n>1&&(n-=1),n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var Qt=class{constructor(t,n,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,n,i)}set(t,n,i){if(n===void 0&&i===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,n,i);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,n=Tn){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,ee.colorSpaceToWorking(this,n),this}setRGB(t,n,i,s=ee.workingColorSpace){return this.r=t,this.g=n,this.b=i,ee.colorSpaceToWorking(this,s),this}setHSL(t,n,i,s=ee.workingColorSpace){if(t=PT(t,1),n=jt(n,0,1),i=jt(i,0,1),n===0)this.r=this.g=this.b=i;else{let a=i<=.5?i*(1+n):i+n-i*n,r=2*i-a;this.r=dg(r,a,t+1/3),this.g=dg(r,a,t),this.b=dg(r,a,t-1/3)}return ee.colorSpaceToWorking(this,s),this}setStyle(t,n=Tn){function i(a){a!==void 0&&parseFloat(a)<1&&Ot("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let a,r=s[1],o=s[2];switch(r){case"rgb":case"rgba":if(a=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setRGB(Math.min(255,parseInt(a[1],10))/255,Math.min(255,parseInt(a[2],10))/255,Math.min(255,parseInt(a[3],10))/255,n);if(a=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setRGB(Math.min(100,parseInt(a[1],10))/100,Math.min(100,parseInt(a[2],10))/100,Math.min(100,parseInt(a[3],10))/100,n);break;case"hsl":case"hsla":if(a=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(a[4]),this.setHSL(parseFloat(a[1])/360,parseFloat(a[2])/100,parseFloat(a[3])/100,n);break;default:Ot("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let a=s[1],r=a.length;if(r===3)return this.setRGB(parseInt(a.charAt(0),16)/15,parseInt(a.charAt(1),16)/15,parseInt(a.charAt(2),16)/15,n);if(r===6)return this.setHex(parseInt(a,16),n);Ot("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,n);return this}setColorName(t,n=Tn){let i=GS[t.toLowerCase()];return i!==void 0?this.setHex(i,n):Ot("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Es(t.r),this.g=Es(t.g),this.b=Es(t.b),this}copyLinearToSRGB(t){return this.r=ho(t.r),this.g=ho(t.g),this.b=ho(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Tn){return ee.workingToColorSpace(vn.copy(this),t),Math.round(jt(vn.r*255,0,255))*65536+Math.round(jt(vn.g*255,0,255))*256+Math.round(jt(vn.b*255,0,255))}getHexString(t=Tn){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,n=ee.workingColorSpace){ee.workingToColorSpace(vn.copy(this),n);let i=vn.r,s=vn.g,a=vn.b,r=Math.max(i,s,a),o=Math.min(i,s,a),c,l,h=(o+r)/2;if(o===r)c=0,l=0;else{let p=r-o;switch(l=h<=.5?p/(r+o):p/(2-r-o),r){case i:c=(s-a)/p+(s<a?6:0);break;case s:c=(a-i)/p+2;break;case a:c=(i-s)/p+4;break}c/=6}return t.h=c,t.s=l,t.l=h,t}getRGB(t,n=ee.workingColorSpace){return ee.workingToColorSpace(vn.copy(this),n),t.r=vn.r,t.g=vn.g,t.b=vn.b,t}getStyle(t=Tn){ee.workingToColorSpace(vn.copy(this),t);let n=vn.r,i=vn.g,s=vn.b;return t!==Tn?`color(${t} ${n.toFixed(3)} ${i.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(n*255)},${Math.round(i*255)},${Math.round(s*255)})`}offsetHSL(t,n,i){return this.getHSL(ra),this.setHSL(ra.h+t,ra.s+n,ra.l+i)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,n){return this.r=t.r+n.r,this.g=t.g+n.g,this.b=t.b+n.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,n){return this.r+=(t.r-this.r)*n,this.g+=(t.g-this.g)*n,this.b+=(t.b-this.b)*n,this}lerpColors(t,n,i){return this.r=t.r+(n.r-t.r)*i,this.g=t.g+(n.g-t.g)*i,this.b=t.b+(n.b-t.b)*i,this}lerpHSL(t,n){this.getHSL(ra),t.getHSL(rh);let i=og(ra.h,rh.h,n),s=og(ra.s,rh.s,n),a=og(ra.l,rh.l,n);return this.setHSL(i,s,a),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let n=this.r,i=this.g,s=this.b,a=t.elements;return this.r=a[0]*n+a[3]*i+a[6]*s,this.g=a[1]*n+a[4]*i+a[7]*s,this.b=a[2]*n+a[5]*i+a[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,n=0){return this.r=t[n],this.g=t[n+1],this.b=t[n+2],this}toArray(t=[],n=0){return t[n]=this.r,t[n+1]=this.g,t[n+2]=this.b,t}fromBufferAttribute(t,n){return this.r=t.getX(n),this.g=t.getY(n),this.b=t.getZ(n),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},vn=new Qt;Qt.NAMES=GS;var Xl=class e{constructor(t,n=1,i=1e3){this.isFog=!0,this.name="",this.color=new Qt(t),this.near=n,this.far=i}clone(){return new e(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},Wl=class extends jn{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new fa,this.environmentIntensity=1,this.environmentRotation=new fa,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,n){return super.copy(t,n),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let n=super.toJSON(t);return this.fog!==null&&(n.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(n.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(n.object.backgroundIntensity=this.backgroundIntensity),n.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(n.object.environmentIntensity=this.environmentIntensity),n.object.environmentRotation=this.environmentRotation.toArray(),n}},Si=new U,ys=new U,pg=new U,xs=new U,io=new U,so=new U,qb=new U,mg=new U,gg=new U,_g=new U,vg=new Pe,yg=new Pe,xg=new Pe,Ms=class e{constructor(t=new U,n=new U,i=new U){this.a=t,this.b=n,this.c=i}static getNormal(t,n,i,s){s.subVectors(i,n),Si.subVectors(t,n),s.cross(Si);let a=s.lengthSq();return a>0?s.multiplyScalar(1/Math.sqrt(a)):s.set(0,0,0)}static getBarycoord(t,n,i,s,a){Si.subVectors(s,n),ys.subVectors(i,n),pg.subVectors(t,n);let r=Si.dot(Si),o=Si.dot(ys),c=Si.dot(pg),l=ys.dot(ys),h=ys.dot(pg),p=r*l-o*o;if(p===0)return a.set(0,0,0),null;let u=1/p,d=(l*c-o*h)*u,m=(r*h-o*c)*u;return a.set(1-d-m,m,d)}static containsPoint(t,n,i,s){return this.getBarycoord(t,n,i,s,xs)===null?!1:xs.x>=0&&xs.y>=0&&xs.x+xs.y<=1}static getInterpolation(t,n,i,s,a,r,o,c){return this.getBarycoord(t,n,i,s,xs)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(a,xs.x),c.addScaledVector(r,xs.y),c.addScaledVector(o,xs.z),c)}static getInterpolatedAttribute(t,n,i,s,a,r){return vg.setScalar(0),yg.setScalar(0),xg.setScalar(0),vg.fromBufferAttribute(t,n),yg.fromBufferAttribute(t,i),xg.fromBufferAttribute(t,s),r.setScalar(0),r.addScaledVector(vg,a.x),r.addScaledVector(yg,a.y),r.addScaledVector(xg,a.z),r}static isFrontFacing(t,n,i,s){return Si.subVectors(i,n),ys.subVectors(t,n),Si.cross(ys).dot(s)<0}set(t,n,i){return this.a.copy(t),this.b.copy(n),this.c.copy(i),this}setFromPointsAndIndices(t,n,i,s){return this.a.copy(t[n]),this.b.copy(t[i]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,n,i,s){return this.a.fromBufferAttribute(t,n),this.b.fromBufferAttribute(t,i),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Si.subVectors(this.c,this.b),ys.subVectors(this.a,this.b),Si.cross(ys).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,i,s,a){return e.getInterpolation(t,this.a,this.b,this.c,n,i,s,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,n){let i=this.a,s=this.b,a=this.c,r,o;io.subVectors(s,i),so.subVectors(a,i),mg.subVectors(t,i);let c=io.dot(mg),l=so.dot(mg);if(c<=0&&l<=0)return n.copy(i);gg.subVectors(t,s);let h=io.dot(gg),p=so.dot(gg);if(h>=0&&p<=h)return n.copy(s);let u=c*p-h*l;if(u<=0&&c>=0&&h<=0)return r=c/(c-h),n.copy(i).addScaledVector(io,r);_g.subVectors(t,a);let d=io.dot(_g),m=so.dot(_g);if(m>=0&&d<=m)return n.copy(a);let S=d*l-c*m;if(S<=0&&l>=0&&m<=0)return o=l/(l-m),n.copy(i).addScaledVector(so,o);let g=h*m-d*p;if(g<=0&&p-h>=0&&d-m>=0)return qb.subVectors(a,s),o=(p-h)/(p-h+(d-m)),n.copy(s).addScaledVector(qb,o);let f=1/(g+S+u);return r=S*f,o=u*f,n.copy(i).addScaledVector(io,r).addScaledVector(so,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},da=class{constructor(t=new U(1/0,1/0,1/0),n=new U(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=n}set(t,n){return this.min.copy(t),this.max.copy(n),this}setFromArray(t){this.makeEmpty();for(let n=0,i=t.length;n<i;n+=3)this.expandByPoint(Mi.fromArray(t,n));return this}setFromBufferAttribute(t){this.makeEmpty();for(let n=0,i=t.count;n<i;n++)this.expandByPoint(Mi.fromBufferAttribute(t,n));return this}setFromPoints(t){this.makeEmpty();for(let n=0,i=t.length;n<i;n++)this.expandByPoint(t[n]);return this}setFromCenterAndSize(t,n){let i=Mi.copy(n).multiplyScalar(.5);return this.min.copy(t).sub(i),this.max.copy(t).add(i),this}setFromObject(t,n=!1){return this.makeEmpty(),this.expandByObject(t,n)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,n=!1){t.updateWorldMatrix(!1,!1);let i=t.geometry;if(i!==void 0){let a=i.getAttribute("position");if(n===!0&&a!==void 0&&t.isInstancedMesh!==!0)for(let r=0,o=a.count;r<o;r++)t.isMesh===!0?t.getVertexPosition(r,Mi):Mi.fromBufferAttribute(a,r),Mi.applyMatrix4(t.matrixWorld),this.expandByPoint(Mi);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),oh.copy(t.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),oh.copy(i.boundingBox)),oh.applyMatrix4(t.matrixWorld),this.union(oh)}let s=t.children;for(let a=0,r=s.length;a<r;a++)this.expandByObject(s[a],n);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,n){return n.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,Mi),Mi.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let n,i;return t.normal.x>0?(n=t.normal.x*this.min.x,i=t.normal.x*this.max.x):(n=t.normal.x*this.max.x,i=t.normal.x*this.min.x),t.normal.y>0?(n+=t.normal.y*this.min.y,i+=t.normal.y*this.max.y):(n+=t.normal.y*this.max.y,i+=t.normal.y*this.min.y),t.normal.z>0?(n+=t.normal.z*this.min.z,i+=t.normal.z*this.max.z):(n+=t.normal.z*this.max.z,i+=t.normal.z*this.min.z),n<=-t.constant&&i>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Nl),lh.subVectors(this.max,Nl),ao.subVectors(t.a,Nl),ro.subVectors(t.b,Nl),oo.subVectors(t.c,Nl),oa.subVectors(ro,ao),la.subVectors(oo,ro),qa.subVectors(ao,oo);let n=[0,-oa.z,oa.y,0,-la.z,la.y,0,-qa.z,qa.y,oa.z,0,-oa.x,la.z,0,-la.x,qa.z,0,-qa.x,-oa.y,oa.x,0,-la.y,la.x,0,-qa.y,qa.x,0];return!bg(n,ao,ro,oo,lh)||(n=[1,0,0,0,1,0,0,0,1],!bg(n,ao,ro,oo,lh))?!1:(ch.crossVectors(oa,la),n=[ch.x,ch.y,ch.z],bg(n,ao,ro,oo,lh))}clampPoint(t,n){return n.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Mi).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Mi).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(bs[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),bs[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),bs[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),bs[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),bs[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),bs[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),bs[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),bs[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(bs),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},bs=[new U,new U,new U,new U,new U,new U,new U,new U],Mi=new U,oh=new da,ao=new U,ro=new U,oo=new U,oa=new U,la=new U,qa=new U,Nl=new U,lh=new U,ch=new U,Ya=new U;function bg(e,t,n,i,s){for(let a=0,r=e.length-3;a<=r;a+=3){Ya.fromArray(e,a);let o=s.x*Math.abs(Ya.x)+s.y*Math.abs(Ya.y)+s.z*Math.abs(Ya.z),c=t.dot(Ya),l=n.dot(Ya),h=i.dot(Ya);if(Math.max(-Math.max(c,l,h),Math.min(c,l,h))>o)return!1}return!0}var Ke=new U,uh=new It,YT=0,Jn=class extends Xi{constructor(t,n,i=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:YT++}),this.name="",this.array=t,this.itemSize=n,this.count=t!==void 0?t.length/n:0,this.normalized=i,this.usage=Fg,this.updateRanges=[],this.gpuType=wi,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,n){this.updateRanges.push({start:t,count:n})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,n,i){t*=this.itemSize,i*=n.itemSize;for(let s=0,a=this.itemSize;s<a;s++)this.array[t+s]=n.array[i+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let n=0,i=this.count;n<i;n++)uh.fromBufferAttribute(this,n),uh.applyMatrix3(t),this.setXY(n,uh.x,uh.y);else if(this.itemSize===3)for(let n=0,i=this.count;n<i;n++)Ke.fromBufferAttribute(this,n),Ke.applyMatrix3(t),this.setXYZ(n,Ke.x,Ke.y,Ke.z);return this}applyMatrix4(t){for(let n=0,i=this.count;n<i;n++)Ke.fromBufferAttribute(this,n),Ke.applyMatrix4(t),this.setXYZ(n,Ke.x,Ke.y,Ke.z);return this}applyNormalMatrix(t){for(let n=0,i=this.count;n<i;n++)Ke.fromBufferAttribute(this,n),Ke.applyNormalMatrix(t),this.setXYZ(n,Ke.x,Ke.y,Ke.z);return this}transformDirection(t){for(let n=0,i=this.count;n<i;n++)Ke.fromBufferAttribute(this,n),Ke.transformDirection(t),this.setXYZ(n,Ke.x,Ke.y,Ke.z);return this}set(t,n=0){return this.array.set(t,n),this}getComponent(t,n){let i=this.array[t*this.itemSize+n];return this.normalized&&(i=Rl(i,this.array)),i}setComponent(t,n,i){return this.normalized&&(i=On(i,this.array)),this.array[t*this.itemSize+n]=i,this}getX(t){let n=this.array[t*this.itemSize];return this.normalized&&(n=Rl(n,this.array)),n}setX(t,n){return this.normalized&&(n=On(n,this.array)),this.array[t*this.itemSize]=n,this}getY(t){let n=this.array[t*this.itemSize+1];return this.normalized&&(n=Rl(n,this.array)),n}setY(t,n){return this.normalized&&(n=On(n,this.array)),this.array[t*this.itemSize+1]=n,this}getZ(t){let n=this.array[t*this.itemSize+2];return this.normalized&&(n=Rl(n,this.array)),n}setZ(t,n){return this.normalized&&(n=On(n,this.array)),this.array[t*this.itemSize+2]=n,this}getW(t){let n=this.array[t*this.itemSize+3];return this.normalized&&(n=Rl(n,this.array)),n}setW(t,n){return this.normalized&&(n=On(n,this.array)),this.array[t*this.itemSize+3]=n,this}setXY(t,n,i){return t*=this.itemSize,this.normalized&&(n=On(n,this.array),i=On(i,this.array)),this.array[t+0]=n,this.array[t+1]=i,this}setXYZ(t,n,i,s){return t*=this.itemSize,this.normalized&&(n=On(n,this.array),i=On(i,this.array),s=On(s,this.array)),this.array[t+0]=n,this.array[t+1]=i,this.array[t+2]=s,this}setXYZW(t,n,i,s,a){return t*=this.itemSize,this.normalized&&(n=On(n,this.array),i=On(i,this.array),s=On(s,this.array),a=On(a,this.array)),this.array[t+0]=n,this.array[t+1]=i,this.array[t+2]=s,this.array[t+3]=a,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Fg&&(t.usage=this.usage),t}dispose(){this.dispatchEvent({type:"dispose"})}};var ql=class extends Jn{constructor(t,n,i){super(new Uint16Array(t),n,i)}};var Yl=class extends Jn{constructor(t,n,i){super(new Uint32Array(t),n,i)}};var Me=class extends Jn{constructor(t,n,i){super(new Float32Array(t),n,i)}},ZT=new da,Ul=new U,Sg=new U,tr=class{constructor(t=new U,n=-1){this.isSphere=!0,this.center=t,this.radius=n}set(t,n){return this.center.copy(t),this.radius=n,this}setFromPoints(t,n){let i=this.center;n!==void 0?i.copy(n):ZT.setFromPoints(t).getCenter(i);let s=0;for(let a=0,r=t.length;a<r;a++)s=Math.max(s,i.distanceToSquared(t[a]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let n=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=n*n}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,n){let i=this.center.distanceToSquared(t);return n.copy(t),i>this.radius*this.radius&&(n.sub(this.center).normalize(),n.multiplyScalar(this.radius).add(this.center)),n}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Ul.subVectors(t,this.center);let n=Ul.lengthSq();if(n>this.radius*this.radius){let i=Math.sqrt(n),s=(i-this.radius)*.5;this.center.addScaledVector(Ul,s/i),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Sg.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Ul.copy(t.center).add(Sg)),this.expandByPoint(Ul.copy(t.center).sub(Sg))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},JT=0,pi=new Oe,Mg=new jn,lo=new U,Zn=new da,Ll=new da,rn=new U,He=class e extends Xi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:JT++}),this.uuid=gc(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(IT(t)?Yl:ql)(t,1):this.index=t,this}setIndirect(t,n=0){return this.indirect=t,this.indirectOffset=n,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,n){return this.attributes[t]=n,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,n,i=0){this.groups.push({start:t,count:n,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(t,n){this.drawRange.start=t,this.drawRange.count=n}applyMatrix4(t){let n=this.attributes.position;n!==void 0&&(n.applyMatrix4(t),n.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let a=new Ht().getNormalMatrix(t);i.applyNormalMatrix(a),i.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return pi.makeRotationFromQuaternion(t),this.applyMatrix4(pi),this}rotateX(t){return pi.makeRotationX(t),this.applyMatrix4(pi),this}rotateY(t){return pi.makeRotationY(t),this.applyMatrix4(pi),this}rotateZ(t){return pi.makeRotationZ(t),this.applyMatrix4(pi),this}translate(t,n,i){return pi.makeTranslation(t,n,i),this.applyMatrix4(pi),this}scale(t,n,i){return pi.makeScale(t,n,i),this.applyMatrix4(pi),this}lookAt(t){return Mg.lookAt(t),Mg.updateMatrix(),this.applyMatrix4(Mg.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(lo).negate(),this.translate(lo.x,lo.y,lo.z),this}setFromPoints(t){let n=this.getAttribute("position");if(n===void 0){let i=[];for(let s=0,a=t.length;s<a;s++){let r=t[s];i.push(r.x,r.y,r.z||0)}this.setAttribute("position",new Me(i,3))}else{let i=Math.min(t.length,n.count);for(let s=0;s<i;s++){let a=t[s];n.setXYZ(s,a.x,a.y,a.z||0)}t.length>n.count&&Ot("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),n.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new da);let t=this.attributes.position,n=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){zt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new U(-1/0,-1/0,-1/0),new U(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),n)for(let i=0,s=n.length;i<s;i++){let a=n[i];Zn.setFromBufferAttribute(a),this.morphTargetsRelative?(rn.addVectors(this.boundingBox.min,Zn.min),this.boundingBox.expandByPoint(rn),rn.addVectors(this.boundingBox.max,Zn.max),this.boundingBox.expandByPoint(rn)):(this.boundingBox.expandByPoint(Zn.min),this.boundingBox.expandByPoint(Zn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&zt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new tr);let t=this.attributes.position,n=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){zt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new U,1/0);return}if(t){let i=this.boundingSphere.center;if(Zn.setFromBufferAttribute(t),n)for(let a=0,r=n.length;a<r;a++){let o=n[a];Ll.setFromBufferAttribute(o),this.morphTargetsRelative?(rn.addVectors(Zn.min,Ll.min),Zn.expandByPoint(rn),rn.addVectors(Zn.max,Ll.max),Zn.expandByPoint(rn)):(Zn.expandByPoint(Ll.min),Zn.expandByPoint(Ll.max))}Zn.getCenter(i);let s=0;for(let a=0,r=t.count;a<r;a++)rn.fromBufferAttribute(t,a),s=Math.max(s,i.distanceToSquared(rn));if(n)for(let a=0,r=n.length;a<r;a++){let o=n[a],c=this.morphTargetsRelative;for(let l=0,h=o.count;l<h;l++)rn.fromBufferAttribute(o,l),c&&(lo.fromBufferAttribute(t,l),rn.add(lo)),s=Math.max(s,i.distanceToSquared(rn))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&zt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,n=this.attributes;if(t===null||n.position===void 0||n.normal===void 0||n.uv===void 0){zt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=n.position,s=n.normal,a=n.uv,r=this.getAttribute("tangent");(r===void 0||r.count!==i.count)&&(r=new Jn(new Float32Array(4*i.count),4),this.setAttribute("tangent",r));let o=[],c=[];for(let y=0;y<i.count;y++)o[y]=new U,c[y]=new U;let l=new U,h=new U,p=new U,u=new It,d=new It,m=new It,S=new U,g=new U;function f(y,M,C){l.fromBufferAttribute(i,y),h.fromBufferAttribute(i,M),p.fromBufferAttribute(i,C),u.fromBufferAttribute(a,y),d.fromBufferAttribute(a,M),m.fromBufferAttribute(a,C),h.sub(l),p.sub(l),d.sub(u),m.sub(u);let D=1/(d.x*m.y-m.x*d.y);isFinite(D)&&(S.copy(h).multiplyScalar(m.y).addScaledVector(p,-d.y).multiplyScalar(D),g.copy(p).multiplyScalar(d.x).addScaledVector(h,-m.x).multiplyScalar(D),o[y].add(S),o[M].add(S),o[C].add(S),c[y].add(g),c[M].add(g),c[C].add(g))}let _=this.groups;_.length===0&&(_=[{start:0,count:t.count}]);for(let y=0,M=_.length;y<M;++y){let C=_[y],D=C.start,L=C.count;for(let P=D,W=D+L;P<W;P+=3)f(t.getX(P+0),t.getX(P+1),t.getX(P+2))}let x=new U,v=new U,T=new U,A=new U;function w(y){T.fromBufferAttribute(s,y),A.copy(T);let M=o[y];x.copy(M),x.sub(T.multiplyScalar(T.dot(M))).normalize(),v.crossVectors(A,M);let D=v.dot(c[y])<0?-1:1;r.setXYZW(y,x.x,x.y,x.z,D)}for(let y=0,M=_.length;y<M;++y){let C=_[y],D=C.start,L=C.count;for(let P=D,W=D+L;P<W;P+=3)w(t.getX(P+0)),w(t.getX(P+1)),w(t.getX(P+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,n=this.getAttribute("position");if(n!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==n.count)i=new Jn(new Float32Array(n.count*3),3),this.setAttribute("normal",i);else for(let u=0,d=i.count;u<d;u++)i.setXYZ(u,0,0,0);let s=new U,a=new U,r=new U,o=new U,c=new U,l=new U,h=new U,p=new U;if(t)for(let u=0,d=t.count;u<d;u+=3){let m=t.getX(u+0),S=t.getX(u+1),g=t.getX(u+2);s.fromBufferAttribute(n,m),a.fromBufferAttribute(n,S),r.fromBufferAttribute(n,g),h.subVectors(r,a),p.subVectors(s,a),h.cross(p),o.fromBufferAttribute(i,m),c.fromBufferAttribute(i,S),l.fromBufferAttribute(i,g),o.add(h),c.add(h),l.add(h),i.setXYZ(m,o.x,o.y,o.z),i.setXYZ(S,c.x,c.y,c.z),i.setXYZ(g,l.x,l.y,l.z)}else for(let u=0,d=n.count;u<d;u+=3)s.fromBufferAttribute(n,u+0),a.fromBufferAttribute(n,u+1),r.fromBufferAttribute(n,u+2),h.subVectors(r,a),p.subVectors(s,a),h.cross(p),i.setXYZ(u+0,h.x,h.y,h.z),i.setXYZ(u+1,h.x,h.y,h.z),i.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let n=0,i=t.count;n<i;n++)rn.fromBufferAttribute(t,n),rn.normalize(),t.setXYZ(n,rn.x,rn.y,rn.z)}toNonIndexed(){function t(o,c){let l=o.array,h=o.itemSize,p=o.normalized,u=new l.constructor(c.length*h),d=0,m=0;for(let S=0,g=c.length;S<g;S++){o.isInterleavedBufferAttribute?d=c[S]*o.data.stride+o.offset:d=c[S]*h;for(let f=0;f<h;f++)u[m++]=l[d++]}return new Jn(u,h,p)}if(this.index===null)return Ot("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let n=new e,i=this.index.array,s=this.attributes;for(let o in s){let c=s[o],l=t(c,i);n.setAttribute(o,l)}let a=this.morphAttributes;for(let o in a){let c=[],l=a[o];for(let h=0,p=l.length;h<p;h++){let u=l[h],d=t(u,i);c.push(d)}n.morphAttributes[o]=c}n.morphTargetsRelative=this.morphTargetsRelative;let r=this.groups;for(let o=0,c=r.length;o<c;o++){let l=r[o];n.addGroup(l.start,l.count,l.materialIndex)}return n}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let c=this.parameters;for(let l in c)c[l]!==void 0&&(t[l]=c[l]);return t}t.data={attributes:{}};let n=this.index;n!==null&&(t.data.index={type:n.array.constructor.name,array:Array.prototype.slice.call(n.array)});let i=this.attributes;for(let c in i){let l=i[c];t.data.attributes[c]=l.toJSON(t.data)}let s={},a=!1;for(let c in this.morphAttributes){let l=this.morphAttributes[c],h=[];for(let p=0,u=l.length;p<u;p++){let d=l[p];h.push(d.toJSON(t.data))}h.length>0&&(s[c]=h,a=!0)}a&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let r=this.groups;r.length>0&&(t.data.groups=JSON.parse(JSON.stringify(r)));let o=this.boundingSphere;return o!==null&&(t.data.boundingSphere=o.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let n={};this.name=t.name;let i=t.index;i!==null&&this.setIndex(i.clone());let s=t.attributes;for(let l in s){let h=s[l];this.setAttribute(l,h.clone(n))}let a=t.morphAttributes;for(let l in a){let h=[],p=a[l];for(let u=0,d=p.length;u<d;u++)h.push(p[u].clone(n));this.morphAttributes[l]=h}this.morphTargetsRelative=t.morphTargetsRelative;let r=t.groups;for(let l=0,h=r.length;l<h;l++){let p=r[l];this.addGroup(p.start,p.count,p.materialIndex)}let o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());let c=t.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var KT=0,pa=class extends Xi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:KT++}),this.uuid=gc(),this.name="",this.type="Material",this.blending=Qa,this.side=Ts,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Nh,this.blendDst=Uh,this.blendEquation=ha,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Qt(0,0,0),this.blendAlpha=0,this.depthFunc=$a,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Bg,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ka,this.stencilZFail=Ka,this.stencilZPass=Ka,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let n in t){let i=t[n];if(i===void 0){Ot(`Material: parameter '${n}' has value of undefined.`);continue}let s=this[n];if(s===void 0){Ot(`Material: '${n}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(i):s&&s.isVector2&&i&&i.isVector2||s&&s.isEuler&&i&&i.isEuler||s&&s.isVector3&&i&&i.isVector3?s.copy(i):this[n]=i}}toJSON(t){let n=t===void 0||typeof t=="string";n&&(t={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(t).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(t).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(t).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(t).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(t).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Qa&&(i.blending=this.blending),this.side!==Ts&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Nh&&(i.blendSrc=this.blendSrc),this.blendDst!==Uh&&(i.blendDst=this.blendDst),this.blendEquation!==ha&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==$a&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Bg&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Ka&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Ka&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Ka&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function s(a){let r=[];for(let o in a){let c=a[o];delete c.metadata,r.push(c)}return r}if(n){let a=s(t.textures),r=s(t.images);a.length>0&&(i.textures=a),r.length>0&&(i.images=r)}return i}fromJSON(t,n){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new Qt().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=n[t.map]||null),t.matcap!==void 0&&(this.matcap=n[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=n[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=n[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=n[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let i=t.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new It().fromArray(i)}return t.displacementMap!==void 0&&(this.displacementMap=n[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=n[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=n[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=n[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=n[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=n[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=n[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=n[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=n[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=n[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=n[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=n[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=n[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=n[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new It().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=n[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=n[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=n[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=n[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=n[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=n[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=n[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let n=t.clippingPlanes,i=null;if(n!==null){let s=n.length;i=new Array(s);for(let a=0;a!==s;++a)i[a]=n[a].clone()}return this.clippingPlanes=i,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var Ss=new U,Eg=new U,hh=new U,ca=new U,Tg=new U,fh=new U,Ag=new U,Zl=class{constructor(t=new U,n=new U(0,0,-1)){this.origin=t,this.direction=n}set(t,n){return this.origin.copy(t),this.direction.copy(n),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,n){return n.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Ss)),this}closestPointToPoint(t,n){n.subVectors(t,this.origin);let i=n.dot(this.direction);return i<0?n.copy(this.origin):n.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let n=Ss.subVectors(t,this.origin).dot(this.direction);return n<0?this.origin.distanceToSquared(t):(Ss.copy(this.origin).addScaledVector(this.direction,n),Ss.distanceToSquared(t))}distanceSqToSegment(t,n,i,s){Eg.copy(t).add(n).multiplyScalar(.5),hh.copy(n).sub(t).normalize(),ca.copy(this.origin).sub(Eg);let a=t.distanceTo(n)*.5,r=-this.direction.dot(hh),o=ca.dot(this.direction),c=-ca.dot(hh),l=ca.lengthSq(),h=Math.abs(1-r*r),p,u,d,m;if(h>0)if(p=r*c-o,u=r*o-c,m=a*h,p>=0)if(u>=-m)if(u<=m){let S=1/h;p*=S,u*=S,d=p*(p+r*u+2*o)+u*(r*p+u+2*c)+l}else u=a,p=Math.max(0,-(r*u+o)),d=-p*p+u*(u+2*c)+l;else u=-a,p=Math.max(0,-(r*u+o)),d=-p*p+u*(u+2*c)+l;else u<=-m?(p=Math.max(0,-(-r*a+o)),u=p>0?-a:Math.min(Math.max(-a,-c),a),d=-p*p+u*(u+2*c)+l):u<=m?(p=0,u=Math.min(Math.max(-a,-c),a),d=u*(u+2*c)+l):(p=Math.max(0,-(r*a+o)),u=p>0?a:Math.min(Math.max(-a,-c),a),d=-p*p+u*(u+2*c)+l);else u=r>0?-a:a,p=Math.max(0,-(r*u+o)),d=-p*p+u*(u+2*c)+l;return i&&i.copy(this.origin).addScaledVector(this.direction,p),s&&s.copy(Eg).addScaledVector(hh,u),d}intersectSphere(t,n){Ss.subVectors(t.center,this.origin);let i=Ss.dot(this.direction),s=Ss.dot(Ss)-i*i,a=t.radius*t.radius;if(s>a)return null;let r=Math.sqrt(a-s),o=i-r,c=i+r;return c<0?null:o<0?this.at(c,n):this.at(o,n)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let n=t.normal.dot(this.direction);if(n===0)return t.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(t.normal)+t.constant)/n;return i>=0?i:null}intersectPlane(t,n){let i=this.distanceToPlane(t);return i===null?null:this.at(i,n)}intersectsPlane(t){let n=t.distanceToPoint(this.origin);return n===0||t.normal.dot(this.direction)*n<0}intersectBox(t,n){let i,s,a,r,o,c,l=1/this.direction.x,h=1/this.direction.y,p=1/this.direction.z,u=this.origin;return l>=0?(i=(t.min.x-u.x)*l,s=(t.max.x-u.x)*l):(i=(t.max.x-u.x)*l,s=(t.min.x-u.x)*l),h>=0?(a=(t.min.y-u.y)*h,r=(t.max.y-u.y)*h):(a=(t.max.y-u.y)*h,r=(t.min.y-u.y)*h),i>r||a>s||((a>i||isNaN(i))&&(i=a),(r<s||isNaN(s))&&(s=r),p>=0?(o=(t.min.z-u.z)*p,c=(t.max.z-u.z)*p):(o=(t.max.z-u.z)*p,c=(t.min.z-u.z)*p),i>c||o>s)||((o>i||i!==i)&&(i=o),(c<s||s!==s)&&(s=c),s<0)?null:this.at(i>=0?i:s,n)}intersectsBox(t){return this.intersectBox(t,Ss)!==null}intersectTriangle(t,n,i,s,a){Tg.subVectors(n,t),fh.subVectors(i,t),Ag.crossVectors(Tg,fh);let r=this.direction.dot(Ag),o;if(r>0){if(s)return null;o=1}else if(r<0)o=-1,r=-r;else return null;ca.subVectors(this.origin,t);let c=o*this.direction.dot(fh.crossVectors(ca,fh));if(c<0)return null;let l=o*this.direction.dot(Tg.cross(ca));if(l<0||c+l>r)return null;let h=-o*ca.dot(Ag);return h<0?null:this.at(h/r,a)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},mi=class extends pa{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Qt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new fa,this.combine=qg,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},Yb=new Oe,Za=new Zl,dh=new tr,Zb=new U,ph=new U,mh=new U,gh=new U,wg=new U,_h=new U,Jb=new U,vh=new U,je=class extends jn{constructor(t=new He,n=new mi){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=n,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,n){return super.copy(t,n),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let n=this.geometry.morphAttributes,i=Object.keys(n);if(i.length>0){let s=n[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let a=0,r=s.length;a<r;a++){let o=s[a].name||String(a);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=a}}}}getVertexPosition(t,n){let i=this.geometry,s=i.attributes.position,a=i.morphAttributes.position,r=i.morphTargetsRelative;n.fromBufferAttribute(s,t);let o=this.morphTargetInfluences;if(a&&o){_h.set(0,0,0);for(let c=0,l=a.length;c<l;c++){let h=o[c],p=a[c];h!==0&&(wg.fromBufferAttribute(p,t),r?_h.addScaledVector(wg,h):_h.addScaledVector(wg.sub(n),h))}n.add(_h)}return n}raycast(t,n){let i=this.geometry,s=this.material,a=this.matrixWorld;s!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),dh.copy(i.boundingSphere),dh.applyMatrix4(a),Za.copy(t.ray).recast(t.near),!(dh.containsPoint(Za.origin)===!1&&(Za.intersectSphere(dh,Zb)===null||Za.origin.distanceToSquared(Zb)>(t.far-t.near)**2))&&(Yb.copy(a).invert(),Za.copy(t.ray).applyMatrix4(Yb),!(i.boundingBox!==null&&Za.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(t,n,Za)))}_computeIntersections(t,n,i){let s,a=this.geometry,r=this.material,o=a.index,c=a.attributes.position,l=a.attributes.uv,h=a.attributes.uv1,p=a.attributes.normal,u=a.groups,d=a.drawRange;if(o!==null)if(Array.isArray(r))for(let m=0,S=u.length;m<S;m++){let g=u[m],f=r[g.materialIndex],_=Math.max(g.start,d.start),x=Math.min(o.count,Math.min(g.start+g.count,d.start+d.count));for(let v=_,T=x;v<T;v+=3){let A=o.getX(v),w=o.getX(v+1),y=o.getX(v+2);s=yh(this,f,t,i,l,h,p,A,w,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=g.materialIndex,n.push(s))}}else{let m=Math.max(0,d.start),S=Math.min(o.count,d.start+d.count);for(let g=m,f=S;g<f;g+=3){let _=o.getX(g),x=o.getX(g+1),v=o.getX(g+2);s=yh(this,r,t,i,l,h,p,_,x,v),s&&(s.faceIndex=Math.floor(g/3),n.push(s))}}else if(c!==void 0)if(Array.isArray(r))for(let m=0,S=u.length;m<S;m++){let g=u[m],f=r[g.materialIndex],_=Math.max(g.start,d.start),x=Math.min(c.count,Math.min(g.start+g.count,d.start+d.count));for(let v=_,T=x;v<T;v+=3){let A=v,w=v+1,y=v+2;s=yh(this,f,t,i,l,h,p,A,w,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=g.materialIndex,n.push(s))}}else{let m=Math.max(0,d.start),S=Math.min(c.count,d.start+d.count);for(let g=m,f=S;g<f;g+=3){let _=g,x=g+1,v=g+2;s=yh(this,r,t,i,l,h,p,_,x,v),s&&(s.faceIndex=Math.floor(g/3),n.push(s))}}}};function jT(e,t,n,i,s,a,r,o){let c;if(t.side===An?c=i.intersectTriangle(r,a,s,!0,o):c=i.intersectTriangle(s,a,r,t.side===Ts,o),c===null)return null;vh.copy(o),vh.applyMatrix4(e.matrixWorld);let l=n.ray.origin.distanceTo(vh);return l<n.near||l>n.far?null:{distance:l,point:vh.clone(),object:e}}function yh(e,t,n,i,s,a,r,o,c,l){e.getVertexPosition(o,ph),e.getVertexPosition(c,mh),e.getVertexPosition(l,gh);let h=jT(e,t,n,i,ph,mh,gh,Jb);if(h){let p=new U;Ms.getBarycoord(Jb,ph,mh,gh,p),s&&(h.uv=Ms.getInterpolatedAttribute(s,o,c,l,p,new It)),a&&(h.uv1=Ms.getInterpolatedAttribute(a,o,c,l,p,new It)),r&&(h.normal=Ms.getInterpolatedAttribute(r,o,c,l,p,new U),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));let u={a:o,b:c,c:l,normal:new U,materialIndex:0};Ms.getNormal(ph,mh,gh,u.normal),h.face=u,h.barycoord=p}return h}var Yh=class extends xn{constructor(t=null,n=1,i=1,s,a,r,o,c,l=on,h=on,p,u){super(null,r,o,c,l,h,s,a,p,u),this.isDataTexture=!0,this.image={data:t,width:n,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Cg=new U,QT=new U,$T=new Ht,Vi=class{constructor(t=new U(1,0,0),n=0){this.isPlane=!0,this.normal=t,this.constant=n}set(t,n){return this.normal.copy(t),this.constant=n,this}setComponents(t,n,i,s){return this.normal.set(t,n,i),this.constant=s,this}setFromNormalAndCoplanarPoint(t,n){return this.normal.copy(t),this.constant=-n.dot(this.normal),this}setFromCoplanarPoints(t,n,i){let s=Cg.subVectors(i,n).cross(QT.subVectors(t,n)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,n){return n.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,n,i=!0){let s=t.delta(Cg),a=this.normal.dot(s);if(a===0)return this.distanceToPoint(t.start)===0?n.copy(t.start):null;let r=-(t.start.dot(this.normal)+this.constant)/a;return i===!0&&(r<0||r>1)?null:n.copy(t.start).addScaledVector(s,r)}intersectsLine(t){let n=this.distanceToPoint(t.start),i=this.distanceToPoint(t.end);return n<0&&i>0||i<0&&n>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,n){let i=n||$T.getNormalMatrix(t),s=this.coplanarPoint(Cg).applyMatrix4(t),a=this.normal.applyMatrix3(i).normalize();return this.constant=-s.dot(a),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},Ja=new tr,tA=new It(.5,.5),xh=new U,Jl=class{constructor(t=new Vi,n=new Vi,i=new Vi,s=new Vi,a=new Vi,r=new Vi){this.planes=[t,n,i,s,a,r]}set(t,n,i,s,a,r){let o=this.planes;return o[0].copy(t),o[1].copy(n),o[2].copy(i),o[3].copy(s),o[4].copy(a),o[5].copy(r),this}copy(t){let n=this.planes;for(let i=0;i<6;i++)n[i].copy(t.planes[i]);return this}setFromProjectionMatrix(t,n=Ei,i=!1){let s=this.planes,a=t.elements,r=a[0],o=a[1],c=a[2],l=a[3],h=a[4],p=a[5],u=a[6],d=a[7],m=a[8],S=a[9],g=a[10],f=a[11],_=a[12],x=a[13],v=a[14],T=a[15];if(s[0].setComponents(l-r,d-h,f-m,T-_).normalize(),s[1].setComponents(l+r,d+h,f+m,T+_).normalize(),s[2].setComponents(l+o,d+p,f+S,T+x).normalize(),s[3].setComponents(l-o,d-p,f-S,T-x).normalize(),i)s[4].setComponents(c,u,g,v).normalize(),s[5].setComponents(l-c,d-u,f-g,T-v).normalize();else if(s[4].setComponents(l-c,d-u,f-g,T-v).normalize(),n===Ei)s[5].setComponents(l+c,d+u,f+g,T+v).normalize();else if(n===Vl)s[5].setComponents(c,u,g,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+n);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Ja.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let n=t.geometry;n.boundingSphere===null&&n.computeBoundingSphere(),Ja.copy(n.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Ja)}intersectsSprite(t){Ja.center.set(0,0,0);let n=tA.distanceTo(t.center);return Ja.radius=.7071067811865476+n,Ja.applyMatrix4(t.matrixWorld),this.intersectsSphere(Ja)}intersectsSphere(t){let n=this.planes,i=t.center,s=-t.radius;for(let a=0;a<6;a++)if(n[a].distanceToPoint(i)<s)return!1;return!0}intersectsBox(t){let n=this.planes;for(let i=0;i<6;i++){let s=n[i];if(xh.x=s.normal.x>0?t.max.x:t.min.x,xh.y=s.normal.y>0?t.max.y:t.min.y,xh.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(xh)<0)return!1}return!0}containsPoint(t){let n=this.planes;for(let i=0;i<6;i++)if(n[i].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var qi=class extends pa{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Qt(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}},Zh=new U,Jh=new U,Kb=new Oe,Il=new Zl,bh=new tr,Rg=new U,jb=new U,Yi=class extends jn{constructor(t=new He,n=new qi){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=n,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,n){return super.copy(t,n),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){let t=this.geometry;if(t.index===null){let n=t.attributes.position,i=[0];for(let s=1,a=n.count;s<a;s++)Zh.fromBufferAttribute(n,s-1),Jh.fromBufferAttribute(n,s),i[s]=i[s-1],i[s]+=Zh.distanceTo(Jh);t.setAttribute("lineDistance",new Me(i,1))}else Ot("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,n){let i=this.geometry,s=this.matrixWorld,a=t.params.Line.threshold,r=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),bh.copy(i.boundingSphere),bh.applyMatrix4(s),bh.radius+=a,t.ray.intersectsSphere(bh)===!1)return;Kb.copy(s).invert(),Il.copy(t.ray).applyMatrix4(Kb);let o=a/((this.scale.x+this.scale.y+this.scale.z)/3),c=o*o,l=this.isLineSegments?2:1,h=i.index,u=i.attributes.position;if(h!==null){let d=Math.max(0,r.start),m=Math.min(h.count,r.start+r.count);for(let S=d,g=m-1;S<g;S+=l){let f=h.getX(S),_=h.getX(S+1),x=Sh(this,t,Il,c,f,_,S);x&&n.push(x)}if(this.isLineLoop){let S=h.getX(m-1),g=h.getX(d),f=Sh(this,t,Il,c,S,g,m-1);f&&n.push(f)}}else{let d=Math.max(0,r.start),m=Math.min(u.count,r.start+r.count);for(let S=d,g=m-1;S<g;S+=l){let f=Sh(this,t,Il,c,S,S+1,S);f&&n.push(f)}if(this.isLineLoop){let S=Sh(this,t,Il,c,m-1,d,m-1);S&&n.push(S)}}}updateMorphTargets(){let n=this.geometry.morphAttributes,i=Object.keys(n);if(i.length>0){let s=n[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let a=0,r=s.length;a<r;a++){let o=s[a].name||String(a);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=a}}}}};function Sh(e,t,n,i,s,a,r){let o=e.geometry.attributes.position;if(Zh.fromBufferAttribute(o,s),Jh.fromBufferAttribute(o,a),n.distanceSqToSegment(Zh,Jh,Rg,jb)>i)return;Rg.applyMatrix4(e.matrixWorld);let l=t.ray.origin.distanceTo(Rg);if(!(l<t.near||l>t.far))return{distance:l,point:jb.clone().applyMatrix4(e.matrixWorld),index:r,face:null,faceIndex:null,barycoord:null,object:e}}var Qb=new U,$b=new U,go=class extends Yi{constructor(t,n){super(t,n),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let t=this.geometry;if(t.index===null){let n=t.attributes.position,i=[];for(let s=0,a=n.count;s<a;s+=2)Qb.fromBufferAttribute(n,s),$b.fromBufferAttribute(n,s+1),i[s]=s===0?0:i[s-1],i[s+1]=i[s]+Qb.distanceTo($b);t.setAttribute("lineDistance",new Me(i,1))}else Ot("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var Kl=class extends xn{constructor(t=[],n=ya,i,s,a,r,o,c,l,h){super(t,n,i,s,a,r,o,c,l,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}};var As=class extends xn{constructor(t,n,i=Ai,s,a,r,o=on,c=on,l,h=ki,p=1){if(h!==ki&&h!==ba)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:t,height:n,depth:p};super(u,s,a,r,o,c,h,i,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new po(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let n=super.toJSON(t);return this.compareFunction!==null&&(n.compareFunction=this.compareFunction),n}},Kh=class extends As{constructor(t,n=Ai,i=ya,s,a,r=on,o=on,c,l=ki){let h={width:t,height:t,depth:1},p=[h,h,h,h,h,h];super(t,t,n,i,s,a,r,o,c,l),this.image=p,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},jl=class extends xn{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},_o=class e extends He{constructor(t=1,n=1,i=1,s=1,a=1,r=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:n,depth:i,widthSegments:s,heightSegments:a,depthSegments:r};let o=this;s=Math.floor(s),a=Math.floor(a),r=Math.floor(r);let c=[],l=[],h=[],p=[],u=0,d=0;m("z","y","x",-1,-1,i,n,t,r,a,0),m("z","y","x",1,-1,i,n,-t,r,a,1),m("x","z","y",1,1,t,i,n,s,r,2),m("x","z","y",1,-1,t,i,-n,s,r,3),m("x","y","z",1,-1,t,n,i,s,a,4),m("x","y","z",-1,-1,t,n,-i,s,a,5),this.setIndex(c),this.setAttribute("position",new Me(l,3)),this.setAttribute("normal",new Me(h,3)),this.setAttribute("uv",new Me(p,2));function m(S,g,f,_,x,v,T,A,w,y,M){let C=v/w,D=T/y,L=v/2,P=T/2,W=A/2,B=w+1,q=y+1,X=0,et=0,at=new U;for(let ut=0;ut<q;ut++){let pt=ut*D-P;for(let bt=0;bt<B;bt++){let Zt=bt*C-L;at[S]=Zt*_,at[g]=pt*x,at[f]=W,l.push(at.x,at.y,at.z),at[S]=0,at[g]=0,at[f]=A>0?1:-1,h.push(at.x,at.y,at.z),p.push(bt/w),p.push(1-ut/y),X+=1}}for(let ut=0;ut<y;ut++)for(let pt=0;pt<w;pt++){let bt=u+pt+B*ut,Zt=u+pt+B*(ut+1),ce=u+(pt+1)+B*(ut+1),$t=u+(pt+1)+B*ut;c.push(bt,Zt,$t),c.push(Zt,ce,$t),et+=6}o.addGroup(d,et,M),d+=et,u+=X}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};var jh=class e extends He{constructor(t=1,n=1,i=1,s=32,a=1,r=!1,o=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:n,height:i,radialSegments:s,heightSegments:a,openEnded:r,thetaStart:o,thetaLength:c};let l=this;s=Math.floor(s),a=Math.floor(a);let h=[],p=[],u=[],d=[],m=0,S=[],g=i/2,f=0;_(),r===!1&&(t>0&&x(!0),n>0&&x(!1)),this.setIndex(h),this.setAttribute("position",new Me(p,3)),this.setAttribute("normal",new Me(u,3)),this.setAttribute("uv",new Me(d,2));function _(){let v=new U,T=new U,A=0,w=(n-t)/i;for(let y=0;y<=a;y++){let M=[],C=y/a,D=C*(n-t)+t;for(let L=0;L<=s;L++){let P=L/s,W=P*c+o,B=Math.sin(W),q=Math.cos(W);T.x=D*B,T.y=-C*i+g,T.z=D*q,p.push(T.x,T.y,T.z),v.set(B,w,q).normalize(),u.push(v.x,v.y,v.z),d.push(P,1-C),M.push(m++)}S.push(M)}for(let y=0;y<s;y++)for(let M=0;M<a;M++){let C=S[M][y],D=S[M+1][y],L=S[M+1][y+1],P=S[M][y+1];(t>0||M!==0)&&(h.push(C,D,P),A+=3),(n>0||M!==a-1)&&(h.push(D,L,P),A+=3)}l.addGroup(f,A,0),f+=A}function x(v){let T=m,A=new It,w=new U,y=0,M=v===!0?t:n,C=v===!0?1:-1;for(let L=1;L<=s;L++)p.push(0,g*C,0),u.push(0,C,0),d.push(.5,.5),m++;let D=m;for(let L=0;L<=s;L++){let W=L/s*c+o,B=Math.cos(W),q=Math.sin(W);w.x=M*q,w.y=g*C,w.z=M*B,p.push(w.x,w.y,w.z),u.push(0,C,0),A.x=B*.5+.5,A.y=q*.5*C+.5,d.push(A.x,A.y),m++}for(let L=0;L<s;L++){let P=T+L,W=D+L;v===!0?h.push(W,W+1,P):h.push(W+1,W,P),y+=3}l.addGroup(f,y,v===!0?1:2),f+=y}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Ql=class e extends jh{constructor(t=1,n=1,i=32,s=1,a=!1,r=0,o=Math.PI*2){super(0,t,n,i,s,a,r,o),this.type="ConeGeometry",this.parameters={radius:t,height:n,radialSegments:i,heightSegments:s,openEnded:a,thetaStart:r,thetaLength:o}}static fromJSON(t){return new e(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}};var Mh=new U,Eh=new U,Dg=new U,Th=new Ms,$l=class extends He{constructor(t=null,n=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:t,thresholdAngle:n},t!==null){let s=Math.pow(10,4),a=Math.cos(Dh*n),r=t.getIndex(),o=t.getAttribute("position"),c=r?r.count:o.count,l=[0,0,0],h=["a","b","c"],p=new Array(3),u={},d=[];for(let m=0;m<c;m+=3){r?(l[0]=r.getX(m),l[1]=r.getX(m+1),l[2]=r.getX(m+2)):(l[0]=m,l[1]=m+1,l[2]=m+2);let{a:S,b:g,c:f}=Th;if(S.fromBufferAttribute(o,l[0]),g.fromBufferAttribute(o,l[1]),f.fromBufferAttribute(o,l[2]),Th.getNormal(Dg),p[0]=`${Math.round(S.x*s)},${Math.round(S.y*s)},${Math.round(S.z*s)}`,p[1]=`${Math.round(g.x*s)},${Math.round(g.y*s)},${Math.round(g.z*s)}`,p[2]=`${Math.round(f.x*s)},${Math.round(f.y*s)},${Math.round(f.z*s)}`,!(p[0]===p[1]||p[1]===p[2]||p[2]===p[0]))for(let _=0;_<3;_++){let x=(_+1)%3,v=p[_],T=p[x],A=Th[h[_]],w=Th[h[x]],y=`${v}_${T}`,M=`${T}_${v}`;M in u&&u[M]?(Dg.dot(u[M].normal)<=a&&(d.push(A.x,A.y,A.z),d.push(w.x,w.y,w.z)),u[M]=null):y in u||(u[y]={index0:l[_],index1:l[x],normal:Dg.clone()})}}for(let m in u)if(u[m]){let{index0:S,index1:g}=u[m];Mh.fromBufferAttribute(o,S),Eh.fromBufferAttribute(o,g),d.push(Mh.x,Mh.y,Mh.z),d.push(Eh.x,Eh.y,Eh.z)}this.setAttribute("position",new Me(d,3))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}},gi=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Ot("Curve: .getPoint() not implemented.")}getPointAt(t,n){let i=this.getUtoTmapping(t);return this.getPoint(i,n)}getPoints(t=5){let n=[];for(let i=0;i<=t;i++)n.push(this.getPoint(i/t));return n}getSpacedPoints(t=5){let n=[];for(let i=0;i<=t;i++)n.push(this.getPointAt(i/t));return n}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let n=[],i,s=this.getPoint(0),a=0;n.push(0);for(let r=1;r<=t;r++)i=this.getPoint(r/t),a+=i.distanceTo(s),n.push(a),s=i;return this.cacheArcLengths=n,n}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,n=null){let i=this.getLengths(),s=0,a=i.length,r;n?r=n:r=t*i[a-1];let o=0,c=a-1,l;for(;o<=c;)if(s=Math.floor(o+(c-o)/2),l=i[s]-r,l<0)o=s+1;else if(l>0)c=s-1;else{c=s;break}if(s=c,i[s]===r)return s/(a-1);let h=i[s],u=i[s+1]-h,d=(r-h)/u;return(s+d)/(a-1)}getTangent(t,n){let s=t-1e-4,a=t+1e-4;s<0&&(s=0),a>1&&(a=1);let r=this.getPoint(s),o=this.getPoint(a),c=n||(r.isVector2?new It:new U);return c.copy(o).sub(r).normalize(),c}getTangentAt(t,n){let i=this.getUtoTmapping(t);return this.getTangent(i,n)}computeFrenetFrames(t,n=!1){let i=new U,s=[],a=[],r=[],o=new U,c=new Oe;for(let d=0;d<=t;d++){let m=d/t;s[d]=this.getTangentAt(m,new U)}a[0]=new U,r[0]=new U;let l=Number.MAX_VALUE,h=Math.abs(s[0].x),p=Math.abs(s[0].y),u=Math.abs(s[0].z);h<=l&&(l=h,i.set(1,0,0)),p<=l&&(l=p,i.set(0,1,0)),u<=l&&i.set(0,0,1),o.crossVectors(s[0],i).normalize(),a[0].crossVectors(s[0],o),r[0].crossVectors(s[0],a[0]);for(let d=1;d<=t;d++){if(a[d]=a[d-1].clone(),r[d]=r[d-1].clone(),o.crossVectors(s[d-1],s[d]),o.length()>Number.EPSILON){o.normalize();let m=Math.acos(jt(s[d-1].dot(s[d]),-1,1));a[d].applyMatrix4(c.makeRotationAxis(o,m))}r[d].crossVectors(s[d],a[d])}if(n===!0){let d=Math.acos(jt(a[0].dot(a[t]),-1,1));d/=t,s[0].dot(o.crossVectors(a[0],a[t]))>0&&(d=-d);for(let m=1;m<=t;m++)a[m].applyMatrix4(c.makeRotationAxis(s[m],d*m)),r[m].crossVectors(s[m],a[m])}return{tangents:s,normals:a,binormals:r}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},tc=class extends gi{constructor(t=0,n=0,i=1,s=1,a=0,r=Math.PI*2,o=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=n,this.xRadius=i,this.yRadius=s,this.aStartAngle=a,this.aEndAngle=r,this.aClockwise=o,this.aRotation=c}getPoint(t,n=new It){let i=n,s=Math.PI*2,a=this.aEndAngle-this.aStartAngle,r=Math.abs(a)<Number.EPSILON;for(;a<0;)a+=s;for(;a>s;)a-=s;a<Number.EPSILON&&(r?a=0:a=s),this.aClockwise===!0&&!r&&(a===s?a=-s:a=a-s);let o=this.aStartAngle+t*a,c=this.aX+this.xRadius*Math.cos(o),l=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),p=Math.sin(this.aRotation),u=c-this.aX,d=l-this.aY;c=u*h-d*p+this.aX,l=u*p+d*h+this.aY}return i.set(c,l)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},Qh=class extends tc{constructor(t,n,i,s,a,r){super(t,n,i,i,s,a,r),this.isArcCurve=!0,this.type="ArcCurve"}};function h0(){let e=0,t=0,n=0,i=0;function s(a,r,o,c){e=a,t=o,n=-3*a+3*r-2*o-c,i=2*a-2*r+o+c}return{initCatmullRom:function(a,r,o,c,l){s(r,o,l*(o-a),l*(c-r))},initNonuniformCatmullRom:function(a,r,o,c,l,h,p){let u=(r-a)/l-(o-a)/(l+h)+(o-r)/h,d=(o-r)/h-(c-r)/(h+p)+(c-o)/p;u*=h,d*=h,s(r,o,u,d)},calc:function(a){let r=a*a,o=r*a;return e+t*a+n*r+i*o}}}var tS=new U,eS=new U,Ng=new h0,Ug=new h0,Lg=new h0,vo=class extends gi{constructor(t=[],n=!1,i="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=n,this.curveType=i,this.tension=s}getPoint(t,n=new U){let i=n,s=this.points,a=s.length,r=(a-(this.closed?0:1))*t,o=Math.floor(r),c=r-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/a)+1)*a:c===0&&o===a-1&&(o=a-2,c=1);let l,h;this.closed||o>0?l=s[(o-1)%a]:(eS.subVectors(s[0],s[1]).add(s[0]),l=eS);let p=s[o%a],u=s[(o+1)%a];if(this.closed||o+2<a?h=s[(o+2)%a]:(tS.subVectors(s[a-1],s[a-2]).add(s[a-1]),h=tS),this.curveType==="centripetal"||this.curveType==="chordal"){let d=this.curveType==="chordal"?.5:.25,m=Math.pow(l.distanceToSquared(p),d),S=Math.pow(p.distanceToSquared(u),d),g=Math.pow(u.distanceToSquared(h),d);S<1e-4&&(S=1),m<1e-4&&(m=S),g<1e-4&&(g=S),Ng.initNonuniformCatmullRom(l.x,p.x,u.x,h.x,m,S,g),Ug.initNonuniformCatmullRom(l.y,p.y,u.y,h.y,m,S,g),Lg.initNonuniformCatmullRom(l.z,p.z,u.z,h.z,m,S,g)}else this.curveType==="catmullrom"&&(Ng.initCatmullRom(l.x,p.x,u.x,h.x,this.tension),Ug.initCatmullRom(l.y,p.y,u.y,h.y,this.tension),Lg.initCatmullRom(l.z,p.z,u.z,h.z,this.tension));return i.set(Ng.calc(c),Ug.calc(c),Lg.calc(c)),i}copy(t){super.copy(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let n=0,i=this.points.length;n<i;n++){let s=this.points[n];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(new U().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function nS(e,t,n,i,s){let a=(i-t)*.5,r=(s-n)*.5,o=e*e,c=e*o;return(2*n-2*i+a+r)*c+(-3*n+3*i-2*a-r)*o+a*e+n}function eA(e,t){let n=1-e;return n*n*t}function nA(e,t){return 2*(1-e)*e*t}function iA(e,t){return e*e*t}function Ol(e,t,n,i){return eA(e,t)+nA(e,n)+iA(e,i)}function sA(e,t){let n=1-e;return n*n*n*t}function aA(e,t){let n=1-e;return 3*n*n*e*t}function rA(e,t){return 3*(1-e)*e*e*t}function oA(e,t){return e*e*e*t}function Pl(e,t,n,i,s){return sA(e,t)+aA(e,n)+rA(e,i)+oA(e,s)}var $h=class extends gi{constructor(t=new It,n=new It,i=new It,s=new It){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=n,this.v2=i,this.v3=s}getPoint(t,n=new It){let i=n,s=this.v0,a=this.v1,r=this.v2,o=this.v3;return i.set(Pl(t,s.x,a.x,r.x,o.x),Pl(t,s.y,a.y,r.y,o.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},tf=class extends gi{constructor(t=new U,n=new U,i=new U,s=new U){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=n,this.v2=i,this.v3=s}getPoint(t,n=new U){let i=n,s=this.v0,a=this.v1,r=this.v2,o=this.v3;return i.set(Pl(t,s.x,a.x,r.x,o.x),Pl(t,s.y,a.y,r.y,o.y),Pl(t,s.z,a.z,r.z,o.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},ef=class extends gi{constructor(t=new It,n=new It){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=n}getPoint(t,n=new It){let i=n;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,n){return this.getPoint(t,n)}getTangent(t,n=new It){return n.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,n){return this.getTangent(t,n)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},nf=class extends gi{constructor(t=new U,n=new U){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=n}getPoint(t,n=new U){let i=n;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,n){return this.getPoint(t,n)}getTangent(t,n=new U){return n.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,n){return this.getTangent(t,n)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},sf=class extends gi{constructor(t=new It,n=new It,i=new It){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=n,this.v2=i}getPoint(t,n=new It){let i=n,s=this.v0,a=this.v1,r=this.v2;return i.set(Ol(t,s.x,a.x,r.x),Ol(t,s.y,a.y,r.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},ec=class extends gi{constructor(t=new U,n=new U,i=new U){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=n,this.v2=i}getPoint(t,n=new U){let i=n,s=this.v0,a=this.v1,r=this.v2;return i.set(Ol(t,s.x,a.x,r.x),Ol(t,s.y,a.y,r.y),Ol(t,s.z,a.z,r.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},af=class extends gi{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,n=new It){let i=n,s=this.points,a=(s.length-1)*t,r=Math.floor(a),o=a-r,c=s[r===0?r:r-1],l=s[r],h=s[r>s.length-2?s.length-1:r+1],p=s[r>s.length-3?s.length-1:r+2];return i.set(nS(o,c.x,l.x,h.x,p.x),nS(o,c.y,l.y,h.y,p.y)),i}copy(t){super.copy(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let n=0,i=this.points.length;n<i;n++){let s=this.points[n];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let n=0,i=t.points.length;n<i;n++){let s=t.points[n];this.points.push(new It().fromArray(s))}return this}},lA=Object.freeze({__proto__:null,ArcCurve:Qh,CatmullRomCurve3:vo,CubicBezierCurve:$h,CubicBezierCurve3:tf,EllipseCurve:tc,LineCurve:ef,LineCurve3:nf,QuadraticBezierCurve:sf,QuadraticBezierCurve3:ec,SplineCurve:af});var ma=class e extends He{constructor(t=1,n=1,i=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:n,widthSegments:i,heightSegments:s};let a=t/2,r=n/2,o=Math.floor(i),c=Math.floor(s),l=o+1,h=c+1,p=t/o,u=n/c,d=[],m=[],S=[],g=[];for(let f=0;f<h;f++){let _=f*u-r;for(let x=0;x<l;x++){let v=x*p-a;m.push(v,-_,0),S.push(0,0,1),g.push(x/o),g.push(1-f/c)}}for(let f=0;f<c;f++)for(let _=0;_<o;_++){let x=_+l*f,v=_+l*(f+1),T=_+1+l*(f+1),A=_+1+l*f;d.push(x,v,A),d.push(v,T,A)}this.setIndex(d),this.setAttribute("position",new Me(m,3)),this.setAttribute("normal",new Me(S,3)),this.setAttribute("uv",new Me(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}};var yo=class e extends He{constructor(t=1,n=32,i=16,s=0,a=Math.PI*2,r=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:n,heightSegments:i,phiStart:s,phiLength:a,thetaStart:r,thetaLength:o},n=Math.max(3,Math.floor(n)),i=Math.max(2,Math.floor(i));let c=Math.min(r+o,Math.PI),l=0,h=[],p=new U,u=new U,d=[],m=[],S=[],g=[];for(let f=0;f<=i;f++){let _=[],x=f/i,v=r+x*o,T=t*Math.cos(v),A=Math.sqrt(t*t-T*T),w=0;f===0&&r===0?w=.5/n:f===i&&c===Math.PI&&(w=-.5/n);for(let y=0;y<=n;y++){let M=y/n,C=s+M*a;p.x=-A*Math.cos(C),p.y=T,p.z=A*Math.sin(C),m.push(p.x,p.y,p.z),u.copy(p).normalize(),S.push(u.x,u.y,u.z),g.push(M+w,1-x),_.push(l++)}h.push(_)}for(let f=0;f<i;f++)for(let _=0;_<n;_++){let x=h[f][_+1],v=h[f][_],T=h[f+1][_],A=h[f+1][_+1];(f!==0||r>0)&&d.push(x,v,A),(f!==i-1||c<Math.PI)&&d.push(v,T,A)}this.setIndex(d),this.setAttribute("position",new Me(m,3)),this.setAttribute("normal",new Me(S,3)),this.setAttribute("uv",new Me(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new e(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};var nc=class e extends He{constructor(t=new ec(new U(-1,-1,0),new U(-1,1,0),new U(1,1,0)),n=64,i=1,s=8,a=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:n,radius:i,radialSegments:s,closed:a};let r=t.computeFrenetFrames(n,a);this.tangents=r.tangents,this.normals=r.normals,this.binormals=r.binormals;let o=new U,c=new U,l=new It,h=new U,p=[],u=[],d=[],m=[];S(),this.setIndex(m),this.setAttribute("position",new Me(p,3)),this.setAttribute("normal",new Me(u,3)),this.setAttribute("uv",new Me(d,2));function S(){for(let x=0;x<n;x++)g(x);g(a===!1?n:0),_(),f()}function g(x){h=t.getPointAt(x/n,h);let v=r.normals[x],T=r.binormals[x];for(let A=0;A<=s;A++){let w=A/s*Math.PI*2,y=Math.sin(w),M=-Math.cos(w);c.x=M*v.x+y*T.x,c.y=M*v.y+y*T.y,c.z=M*v.z+y*T.z,c.normalize(),u.push(c.x,c.y,c.z),o.x=h.x+i*c.x,o.y=h.y+i*c.y,o.z=h.z+i*c.z,p.push(o.x,o.y,o.z)}}function f(){for(let x=1;x<=n;x++)for(let v=1;v<=s;v++){let T=(s+1)*(x-1)+(v-1),A=(s+1)*x+(v-1),w=(s+1)*x+v,y=(s+1)*(x-1)+v;m.push(T,A,y),m.push(A,w,y)}}function _(){for(let x=0;x<=n;x++)for(let v=0;v<=s;v++)l.x=x/n,l.y=v/s,d.push(l.x,l.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new e(new lA[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}};function ir(e){let t={};for(let n in e){t[n]={};for(let i in e[n]){let s=e[n][i];if(iS(s))s.isRenderTargetTexture?(Ot("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[n][i]=null):t[n][i]=s.clone();else if(Array.isArray(s))if(iS(s[0])){let a=[];for(let r=0,o=s.length;r<o;r++)a[r]=s[r].clone();t[n][i]=a}else t[n][i]=s.slice();else t[n][i]=s}}return t}function bn(e){let t={};for(let n=0;n<e.length;n++){let i=ir(e[n]);for(let s in i)t[s]=i[s]}return t}function iS(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function cA(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function f0(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:ee.workingColorSpace}var kS={clone:ir,merge:bn},uA=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,hA=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Qn=class extends pa{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=uA,this.fragmentShader=hA,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=ir(t.uniforms),this.uniformsGroups=cA(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let n=super.toJSON(t);n.glslVersion=this.glslVersion,n.uniforms={};for(let s in this.uniforms){let r=this.uniforms[s].value;r&&r.isTexture?n.uniforms[s]={type:"t",value:r.toJSON(t).uuid}:r&&r.isColor?n.uniforms[s]={type:"c",value:r.getHex()}:r&&r.isVector2?n.uniforms[s]={type:"v2",value:r.toArray()}:r&&r.isVector3?n.uniforms[s]={type:"v3",value:r.toArray()}:r&&r.isVector4?n.uniforms[s]={type:"v4",value:r.toArray()}:r&&r.isMatrix3?n.uniforms[s]={type:"m3",value:r.toArray()}:r&&r.isMatrix4?n.uniforms[s]={type:"m4",value:r.toArray()}:n.uniforms[s]={value:r}}Object.keys(this.defines).length>0&&(n.defines=this.defines),n.vertexShader=this.vertexShader,n.fragmentShader=this.fragmentShader,n.lights=this.lights,n.clipping=this.clipping;let i={};for(let s in this.extensions)this.extensions[s]===!0&&(i[s]=!0);return Object.keys(i).length>0&&(n.extensions=i),n}fromJSON(t,n){if(super.fromJSON(t,n),t.uniforms!==void 0)for(let i in t.uniforms){let s=t.uniforms[i];switch(this.uniforms[i]={},s.type){case"t":this.uniforms[i].value=n[s.value]||null;break;case"c":this.uniforms[i].value=new Qt().setHex(s.value);break;case"v2":this.uniforms[i].value=new It().fromArray(s.value);break;case"v3":this.uniforms[i].value=new U().fromArray(s.value);break;case"v4":this.uniforms[i].value=new Pe().fromArray(s.value);break;case"m3":this.uniforms[i].value=new Ht().fromArray(s.value);break;case"m4":this.uniforms[i].value=new Oe().fromArray(s.value);break;default:this.uniforms[i].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let i in t.extensions)this.extensions[i]=t.extensions[i];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},rf=class extends Qn{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}};var of=class extends pa{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=DS,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},lf=class extends pa{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};var er=class extends qi{constructor(t){super(),this.isLineDashedMaterial=!0,this.type="LineDashedMaterial",this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(t)}copy(t){return super.copy(t),this.scale=t.scale,this.dashSize=t.dashSize,this.gapSize=t.gapSize,this}};function Ah(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT=="number"?new t(e):Array.prototype.slice.call(e)}var ga=class{constructor(t,n,i,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new n.constructor(i),this.sampleValues=n,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(t){let n=this.parameterPositions,i=this._cachedIndex,s=n[i],a=n[i-1];t:{e:{let r;n:{i:if(!(t<s)){for(let o=i+2;;){if(s===void 0){if(t<a)break i;return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===o)break;if(a=s,s=n[++i],t<s)break e}r=n.length;break n}if(!(t>=a)){let o=n[1];t<o&&(i=2,a=o);for(let c=i-2;;){if(a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===c)break;if(s=a,a=n[--i-1],t>=a)break e}r=i,i=0;break n}break t}for(;i<r;){let o=i+r>>>1;t<n[o]?r=o:i=o+1}if(s=n[i],a=n[i-1],a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,a,s)}return this.interpolate_(i,a,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let n=this.resultBuffer,i=this.sampleValues,s=this.valueSize,a=t*s;for(let r=0;r!==s;++r)n[r]=i[a+r];return n}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},cf=class extends ga{constructor(t,n,i,s){super(t,n,i,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Og,endingEnd:Og}}intervalChanged_(t,n,i){let s=this.parameterPositions,a=t-2,r=t+1,o=s[a],c=s[r];if(o===void 0)switch(this.getSettings_().endingStart){case Pg:a=t,o=2*n-i;break;case zg:a=s.length-2,o=n+s[a]-s[a+1];break;default:a=t,o=i}if(c===void 0)switch(this.getSettings_().endingEnd){case Pg:r=t,c=2*i-n;break;case zg:r=1,c=i+s[1]-s[0];break;default:r=t-1,c=n}let l=(i-n)*.5,h=this.valueSize;this._weightPrev=l/(n-o),this._weightNext=l/(c-i),this._offsetPrev=a*h,this._offsetNext=r*h}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,c=t*o,l=c-o,h=this._offsetPrev,p=this._offsetNext,u=this._weightPrev,d=this._weightNext,m=(i-n)/(s-n),S=m*m,g=S*m,f=-u*g+2*u*S-u*m,_=(1+u)*g+(-1.5-2*u)*S+(-.5+u)*m+1,x=(-1-d)*g+(1.5+d)*S+.5*m,v=d*g-d*S;for(let T=0;T!==o;++T)a[T]=f*r[h+T]+_*r[l+T]+x*r[c+T]+v*r[p+T];return a}},uf=class extends ga{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,c=t*o,l=c-o,h=(i-n)/(s-n),p=1-h;for(let u=0;u!==o;++u)a[u]=r[l+u]*p+r[c+u]*h;return a}},hf=class extends ga{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t){return this.copySampleValue_(t-1)}},ff=class extends ga{interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,c=t*o,l=c-o,h=this.inTangents,p=this.outTangents;if(!h||!p){let m=(i-n)/(s-n),S=1-m;for(let g=0;g!==o;++g)a[g]=r[l+g]*S+r[c+g]*m;return a}let u=o*2,d=t-1;for(let m=0;m!==o;++m){let S=r[l+m],g=r[c+m],f=d*u+m*2,_=p[f],x=p[f+1],v=t*u+m*2,T=h[v],A=h[v+1],w=(i-n)/(s-n),y,M,C,D,L;for(let P=0;P<8;P++){y=w*w,M=y*w,C=1-w,D=C*C,L=D*C;let B=L*n+3*D*w*_+3*C*y*T+M*s-i;if(Math.abs(B)<1e-10)break;let q=3*D*(_-n)+6*C*w*(T-_)+3*y*(s-T);if(Math.abs(q)<1e-10)break;w=w-B/q,w=Math.max(0,Math.min(1,w))}a[m]=L*S+3*D*w*x+3*C*y*A+M*g}return a}},$n=class{constructor(t,n,i,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(n===void 0||n.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=Ah(n,this.TimeBufferType),this.values=Ah(i,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let n=t.constructor,i;if(n.toJSON!==this.toJSON)i=n.toJSON(t);else{i={name:t.name,times:Ah(t.times,Array),values:Ah(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(i.interpolation=s)}return i.type=t.ValueTypeName,i}InterpolantFactoryMethodDiscrete(t){return new hf(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new uf(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new cf(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let n=new ff(this.times,this.values,this.getValueSize(),t);return this.settings&&(n.inTangents=this.settings.inTangents,n.outTangents=this.settings.outTangents),n}setInterpolation(t){let n;switch(t){case zl:n=this.InterpolantFactoryMethodDiscrete;break;case Gh:n=this.InterpolantFactoryMethodLinear;break;case Rh:n=this.InterpolantFactoryMethodSmooth;break;case Ig:n=this.InterpolantFactoryMethodBezier;break}if(n===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return Ot("KeyframeTrack:",i),this}return this.createInterpolant=n,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return zl;case this.InterpolantFactoryMethodLinear:return Gh;case this.InterpolantFactoryMethodSmooth:return Rh;case this.InterpolantFactoryMethodBezier:return Ig}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let n=this.times;for(let i=0,s=n.length;i!==s;++i)n[i]+=t}return this}scale(t){if(t!==1){let n=this.times;for(let i=0,s=n.length;i!==s;++i)n[i]*=t}return this}trim(t,n){let i=this.times,s=i.length,a=0,r=s-1;for(;a!==s&&i[a]<t;)++a;for(;r!==-1&&i[r]>n;)--r;if(++r,a!==0||r!==s){a>=r&&(r=Math.max(r,1),a=r-1);let o=this.getValueSize();this.times=i.slice(a,r),this.values=this.values.slice(a*o,r*o)}return this}validate(){let t=!0,n=this.getValueSize();n-Math.floor(n)!==0&&(zt("KeyframeTrack: Invalid value size in track.",this),t=!1);let i=this.times,s=this.values,a=i.length;a===0&&(zt("KeyframeTrack: Track is empty.",this),t=!1);let r=null;for(let o=0;o!==a;o++){let c=i[o];if(typeof c=="number"&&isNaN(c)){zt("KeyframeTrack: Time is not a valid number.",this,o,c),t=!1;break}if(r!==null&&r>c){zt("KeyframeTrack: Out of order keys.",this,o,c,r),t=!1;break}r=c}if(s!==void 0&&OT(s))for(let o=0,c=s.length;o!==c;++o){let l=s[o];if(isNaN(l)){zt("KeyframeTrack: Value is not a valid number.",this,o,l),t=!1;break}}return t}optimize(){let t=this.times.slice(),n=this.values.slice(),i=this.getValueSize(),s=this.getInterpolation()===Rh,a=t.length-1,r=1;for(let o=1;o<a;++o){let c=!1,l=t[o],h=t[o+1];if(l!==h&&(o!==1||l!==t[0]))if(s)c=!0;else{let p=o*i,u=p-i,d=p+i;for(let m=0;m!==i;++m){let S=n[p+m];if(S!==n[u+m]||S!==n[d+m]){c=!0;break}}}if(c){if(o!==r){t[r]=t[o];let p=o*i,u=r*i;for(let d=0;d!==i;++d)n[u+d]=n[p+d]}++r}}if(a>0){t[r]=t[a];for(let o=a*i,c=r*i,l=0;l!==i;++l)n[c+l]=n[o+l];++r}return r!==t.length?(this.times=t.slice(0,r),this.values=n.slice(0,r*i)):(this.times=t,this.values=n),this}clone(){let t=this.times.slice(),n=this.values.slice(),i=this.constructor,s=new i(this.name,t,n);return s.createInterpolant=this.createInterpolant,s}};$n.prototype.ValueTypeName="";$n.prototype.TimeBufferType=Float32Array;$n.prototype.ValueBufferType=Float32Array;$n.prototype.DefaultInterpolation=Gh;var _a=class extends $n{constructor(t,n,i){super(t,n,i)}};_a.prototype.ValueTypeName="bool";_a.prototype.ValueBufferType=Array;_a.prototype.DefaultInterpolation=zl;_a.prototype.InterpolantFactoryMethodLinear=void 0;_a.prototype.InterpolantFactoryMethodSmooth=void 0;var df=class extends $n{constructor(t,n,i,s){super(t,n,i,s)}};df.prototype.ValueTypeName="color";var pf=class extends $n{constructor(t,n,i,s){super(t,n,i,s)}};pf.prototype.ValueTypeName="number";var mf=class extends ga{constructor(t,n,i,s){super(t,n,i,s)}interpolate_(t,n,i,s){let a=this.resultBuffer,r=this.sampleValues,o=this.valueSize,c=(i-n)/(s-n),l=t*o;for(let h=l+o;l!==h;l+=4)Wi.slerpFlat(a,0,r,l-o,r,l,c);return a}},ic=class extends $n{constructor(t,n,i,s){super(t,n,i,s)}InterpolantFactoryMethodLinear(t){return new mf(this.times,this.values,this.getValueSize(),t)}};ic.prototype.ValueTypeName="quaternion";ic.prototype.InterpolantFactoryMethodSmooth=void 0;var va=class extends $n{constructor(t,n,i){super(t,n,i)}};va.prototype.ValueTypeName="string";va.prototype.ValueBufferType=Array;va.prototype.DefaultInterpolation=zl;va.prototype.InterpolantFactoryMethodLinear=void 0;va.prototype.InterpolantFactoryMethodSmooth=void 0;var gf=class extends $n{constructor(t,n,i,s){super(t,n,i,s)}};gf.prototype.ValueTypeName="vector";var _f=class{constructor(t,n,i){let s=this,a=!1,r=0,o=0,c,l=[];this.onStart=void 0,this.onLoad=t,this.onProgress=n,this.onError=i,this._abortController=null,this.itemStart=function(h){o++,a===!1&&s.onStart!==void 0&&s.onStart(h,r,o),a=!0},this.itemEnd=function(h){r++,s.onProgress!==void 0&&s.onProgress(h,r,o),r===o&&(a=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),c?c(h):h},this.setURLModifier=function(h){return c=h,this},this.addHandler=function(h,p){return l.push(h,p),this},this.removeHandler=function(h){let p=l.indexOf(h);return p!==-1&&l.splice(p,2),this},this.getHandler=function(h){for(let p=0,u=l.length;p<u;p+=2){let d=l[p],m=l[p+1];if(d.global&&(d.lastIndex=0),d.test(h))return m}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},XS=new _f,vf=class{constructor(t){this.manager=t!==void 0?t:XS,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,n){let i=this;return new Promise(function(s,a){i.load(t,s,n,a)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};vf.DEFAULT_MATERIAL_NAME="__DEFAULT";var wh=new U,Ch=new Wi,Fi=new U,sc=class extends jn{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Oe,this.projectionMatrix=new Oe,this.projectionMatrixInverse=new Oe,this.coordinateSystem=Ei,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,n){return super.copy(t,n),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(wh,Ch,Fi),Fi.x===1&&Fi.y===1&&Fi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(wh,Ch,Fi.set(1,1,1)).invert()}updateWorldMatrix(t,n,i=!1){super.updateWorldMatrix(t,n,i),this.matrixWorld.decompose(wh,Ch,Fi),Fi.x===1&&Fi.y===1&&Fi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(wh,Ch,Fi.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},ua=new U,sS=new It,aS=new It,yn=class extends sc{constructor(t=50,n=1,i=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=i,this.far=s,this.focus=10,this.aspect=n,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,n){return super.copy(t,n),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let n=.5*this.getFilmHeight()/t;this.fov=kh*2*Math.atan(n),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(Dh*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return kh*2*Math.atan(Math.tan(Dh*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,n,i){ua.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(ua.x,ua.y).multiplyScalar(-t/ua.z),ua.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(ua.x,ua.y).multiplyScalar(-t/ua.z)}getViewSize(t,n){return this.getViewBounds(t,sS,aS),n.subVectors(aS,sS)}setViewOffset(t,n,i,s,a,r){this.aspect=t/n,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=n,this.view.offsetX=i,this.view.offsetY=s,this.view.width=a,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,n=t*Math.tan(Dh*.5*this.fov)/this.zoom,i=2*n,s=this.aspect*i,a=-.5*s,r=this.view;if(this.view!==null&&this.view.enabled){let c=r.fullWidth,l=r.fullHeight;a+=r.offsetX*s/c,n-=r.offsetY*i/l,s*=r.width/c,i*=r.height/l}let o=this.filmOffset;o!==0&&(a+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(a,a+s,n,n-i,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let n=super.toJSON(t);return n.object.fov=this.fov,n.object.zoom=this.zoom,n.object.near=this.near,n.object.far=this.far,n.object.focus=this.focus,n.object.aspect=this.aspect,this.view!==null&&(n.object.view=Object.assign({},this.view)),n.object.filmGauge=this.filmGauge,n.object.filmOffset=this.filmOffset,n}};var ac=class extends sc{constructor(t=-1,n=1,i=1,s=-1,a=.1,r=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=n,this.top=i,this.bottom=s,this.near=a,this.far=r,this.updateProjectionMatrix()}copy(t,n){return super.copy(t,n),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,n,i,s,a,r){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=n,this.view.offsetX=i,this.view.offsetY=s,this.view.width=a,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),n=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,s=(this.top+this.bottom)/2,a=i-t,r=i+t,o=s+n,c=s-n;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;a+=l*this.view.offsetX,r=a+l*this.view.width,o-=h*this.view.offsetY,c=o-h*this.view.height}this.projectionMatrix.makeOrthographic(a,r,o,c,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let n=super.toJSON(t);return n.object.zoom=this.zoom,n.object.left=this.left,n.object.right=this.right,n.object.top=this.top,n.object.bottom=this.bottom,n.object.near=this.near,n.object.far=this.far,this.view!==null&&(n.object.view=Object.assign({},this.view)),n}};var co=-90,uo=1,yf=class extends jn{constructor(t,n,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new yn(co,uo,t,n);s.layers=this.layers,this.add(s);let a=new yn(co,uo,t,n);a.layers=this.layers,this.add(a);let r=new yn(co,uo,t,n);r.layers=this.layers,this.add(r);let o=new yn(co,uo,t,n);o.layers=this.layers,this.add(o);let c=new yn(co,uo,t,n);c.layers=this.layers,this.add(c);let l=new yn(co,uo,t,n);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let t=this.coordinateSystem,n=this.children.concat(),[i,s,a,r,o,c]=n;for(let l of n)this.remove(l);if(t===Ei)i.up.set(0,1,0),i.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),a.up.set(0,0,-1),a.lookAt(0,1,0),r.up.set(0,0,1),r.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(t===Vl)i.up.set(0,-1,0),i.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),a.up.set(0,0,1),a.lookAt(0,1,0),r.up.set(0,0,-1),r.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let l of n)this.add(l),l.updateMatrixWorld()}update(t,n){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[a,r,o,c,l,h]=this.children,p=t.getRenderTarget(),u=t.getActiveCubeFace(),d=t.getActiveMipmapLevel(),m=t.xr.enabled;t.xr.enabled=!1;let S=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let g=!1;t.isWebGLRenderer===!0?g=t.state.buffers.depth.getReversed():g=t.reversedDepthBuffer,t.setRenderTarget(i,0,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,a),t.setRenderTarget(i,1,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,r),t.setRenderTarget(i,2,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,o),t.setRenderTarget(i,3,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,c),t.setRenderTarget(i,4,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,l),i.texture.generateMipmaps=S,t.setRenderTarget(i,5,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(n,h),t.setRenderTarget(p,u,d),t.xr.enabled=m,i.texture.needsPMREMUpdate=!0}},xf=class extends yn{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}};var d0="\\[\\]\\.:\\/",fA=new RegExp("["+d0+"]","g"),p0="[^"+d0+"]",dA="[^"+d0.replace("\\.","")+"]",pA=/((?:WC+[\/:])*)/.source.replace("WC",p0),mA=/(WCOD+)?/.source.replace("WCOD",dA),gA=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",p0),_A=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",p0),vA=new RegExp("^"+pA+mA+gA+_A+"$"),yA=["material","materials","bones","map"],Vg=class{constructor(t,n,i){let s=i||Ne.parseTrackName(n);this._targetGroup=t,this._bindings=t.subscribe_(n,s)}getValue(t,n){this.bind();let i=this._targetGroup.nCachedObjects_,s=this._bindings[i];s!==void 0&&s.getValue(t,n)}setValue(t,n){let i=this._bindings;for(let s=this._targetGroup.nCachedObjects_,a=i.length;s!==a;++s)i[s].setValue(t,n)}bind(){let t=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=t.length;n!==i;++n)t[n].bind()}unbind(){let t=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=t.length;n!==i;++n)t[n].unbind()}},Ne=class e{constructor(t,n,i){this.path=n,this.parsedPath=i||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,i){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,i):new e(t,n,i)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(fA,"")}static parseTrackName(t){let n=vA.exec(t);if(n===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let i={nodeName:n[2],objectName:n[3],objectIndex:n[4],propertyName:n[5],propertyIndex:n[6]},s=i.nodeName&&i.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let a=i.nodeName.substring(s+1);yA.indexOf(a)!==-1&&(i.nodeName=i.nodeName.substring(0,s),i.objectName=a)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return i}static findNode(t,n){if(n===void 0||n===""||n==="."||n===-1||n===t.name||n===t.uuid)return t;if(t.skeleton){let i=t.skeleton.getBoneByName(n);if(i!==void 0)return i}if(t.children){let i=function(a){for(let r=0;r<a.length;r++){let o=a[r];if(o.name===n||o.uuid===n)return o;let c=i(o.children);if(c)return c}return null},s=i(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,n){t[n]=this.targetObject[this.propertyName]}_getValue_array(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)t[n++]=i[s]}_getValue_arrayElement(t,n){t[n]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,n){this.resolvedProperty.toArray(t,n)}_setValue_direct(t,n){this.targetObject[this.propertyName]=t[n]}_setValue_direct_setNeedsUpdate(t,n){this.targetObject[this.propertyName]=t[n],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,n){this.targetObject[this.propertyName]=t[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++]}_setValue_array_setNeedsUpdate(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,n){let i=this.resolvedProperty;for(let s=0,a=i.length;s!==a;++s)i[s]=t[n++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,n){this.resolvedProperty[this.propertyIndex]=t[n]}_setValue_arrayElement_setNeedsUpdate(t,n){this.resolvedProperty[this.propertyIndex]=t[n],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,n){this.resolvedProperty[this.propertyIndex]=t[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,n){this.resolvedProperty.fromArray(t,n)}_setValue_fromArray_setNeedsUpdate(t,n){this.resolvedProperty.fromArray(t,n),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,n){this.resolvedProperty.fromArray(t,n),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,n){this.bind(),this.getValue(t,n)}_setValue_unbound(t,n){this.bind(),this.setValue(t,n)}bind(){let t=this.node,n=this.parsedPath,i=n.objectName,s=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Ot("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let l=n.objectIndex;switch(i){case"materials":if(!t.material){zt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){zt("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){zt("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===l){l=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){zt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){zt("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[i]===void 0){zt("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[i]}if(l!==void 0){if(t[l]===void 0){zt("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[l]}}let r=t[s];if(r===void 0){let l=n.nodeName;zt("PropertyBinding: Trying to update property for track: "+l+"."+s+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?o=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(a!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){zt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){zt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}c=this.BindingType.ArrayElement,this.resolvedProperty=r,this.propertyIndex=a}else r.fromArray!==void 0&&r.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=r):Array.isArray(r)?(c=this.BindingType.EntireArray,this.resolvedProperty=r):this.propertyName=s;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Ne.Composite=Vg;Ne.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Ne.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Ne.prototype.GetterByBindingType=[Ne.prototype._getValue_direct,Ne.prototype._getValue_array,Ne.prototype._getValue_arrayElement,Ne.prototype._getValue_toArray];Ne.prototype.SetterByBindingTypeAndVersioning=[[Ne.prototype._setValue_direct,Ne.prototype._setValue_direct_setNeedsUpdate,Ne.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Ne.prototype._setValue_array,Ne.prototype._setValue_array_setNeedsUpdate,Ne.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Ne.prototype._setValue_arrayElement,Ne.prototype._setValue_arrayElement_setNeedsUpdate,Ne.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Ne.prototype._setValue_fromArray,Ne.prototype._setValue_fromArray_setNeedsUpdate,Ne.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var U3=new Float32Array(1);var Hg=class e{static{e.prototype.isMatrix2=!0}constructor(t,n,i,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,n,i,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,n=0){for(let i=0;i<4;i++)this.elements[i]=t[i+n];return this}set(t,n,i,s){let a=this.elements;return a[0]=t,a[2]=n,a[1]=i,a[3]=s,this}};var rc=class extends go{constructor(t=10,n=10,i=4473924,s=8947848){i=new Qt(i),s=new Qt(s);let a=n/2,r=t/n,o=t/2,c=[],l=[];for(let u=0,d=0,m=-o;u<=n;u++,m+=r){c.push(-o,0,m,o,0,m),c.push(m,0,-o,m,0,o);let S=u===a?i:s;S.toArray(l,d),d+=3,S.toArray(l,d),d+=3,S.toArray(l,d),d+=3,S.toArray(l,d),d+=3}let h=new He;h.setAttribute("position",new Me(c,3)),h.setAttribute("color",new Me(l,3));let p=new qi({vertexColors:!0,toneMapped:!1});super(h,p),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}};function m0(e,t,n,i){let s=xA(i);switch(n){case a0:return e*t;case o0:return e*t/s.components*s.byteLength;case Cf:return e*t/s.components*s.byteLength;case Sa:return e*t*2/s.components*s.byteLength;case Rf:return e*t*2/s.components*s.byteLength;case r0:return e*t*3/s.components*s.byteLength;case _i:return e*t*4/s.components*s.byteLength;case Df:return e*t*4/s.components*s.byteLength;case uc:case hc:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case fc:case dc:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Uf:case If:return Math.max(e,16)*Math.max(t,8)/4;case Nf:case Lf:return Math.max(e,8)*Math.max(t,8)/2;case Of:case Pf:case Bf:case Ff:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case zf:case pc:case Vf:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Hf:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Gf:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case kf:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case Xf:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case Wf:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case qf:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case Yf:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case Zf:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case Jf:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case Kf:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case jf:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case Qf:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case $f:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case td:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case ed:case nd:case id:return Math.ceil(e/4)*Math.ceil(t/4)*16;case sd:case ad:return Math.ceil(e/4)*Math.ceil(t/4)*8;case mc:case rd:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${n} format.`)}function xA(e){switch(e){case ei:case e0:return{byteLength:1,components:1};case bo:case n0:case Ji:return{byteLength:2,components:1};case Af:case wf:return{byteLength:2,components:4};case Ai:case Tf:case wi:return{byteLength:4,components:1};case i0:case s0:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:bf}}));typeof window<"u"&&(window.__THREE__?Ot("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=bf);function dM(){let e=null,t=!1,n=null,i=null;function s(a,r){n(a,r),i=e.requestAnimationFrame(s)}return{start:function(){t!==!0&&n!==null&&e!==null&&(i=e.requestAnimationFrame(s),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(i),t=!1},setAnimationLoop:function(a){n=a},setContext:function(a){e=a}}}function bA(e){let t=new WeakMap;function n(o,c){let l=o.array,h=o.usage,p=l.byteLength,u=e.createBuffer();e.bindBuffer(c,u),e.bufferData(c,l,h),o.onUploadCallback();let d;if(l instanceof Float32Array)d=e.FLOAT;else if(typeof Float16Array<"u"&&l instanceof Float16Array)d=e.HALF_FLOAT;else if(l instanceof Uint16Array)o.isFloat16BufferAttribute?d=e.HALF_FLOAT:d=e.UNSIGNED_SHORT;else if(l instanceof Int16Array)d=e.SHORT;else if(l instanceof Uint32Array)d=e.UNSIGNED_INT;else if(l instanceof Int32Array)d=e.INT;else if(l instanceof Int8Array)d=e.BYTE;else if(l instanceof Uint8Array)d=e.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)d=e.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:u,type:d,bytesPerElement:l.BYTES_PER_ELEMENT,version:o.version,size:p}}function i(o,c,l){let h=c.array,p=c.updateRanges;if(e.bindBuffer(l,o),p.length===0)e.bufferSubData(l,0,h);else{p.sort((d,m)=>d.start-m.start);let u=0;for(let d=1;d<p.length;d++){let m=p[u],S=p[d];S.start<=m.start+m.count+1?m.count=Math.max(m.count,S.start+S.count-m.start):(++u,p[u]=S)}p.length=u+1;for(let d=0,m=p.length;d<m;d++){let S=p[d];e.bufferSubData(l,S.start*h.BYTES_PER_ELEMENT,h,S.start,S.count)}c.clearUpdateRanges()}c.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function a(o){o.isInterleavedBufferAttribute&&(o=o.data);let c=t.get(o);c&&(e.deleteBuffer(c.buffer),t.delete(o))}function r(o,c){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let l=t.get(o);if(l===void 0)t.set(o,n(o,c));else if(l.version<o.version){if(l.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(l.buffer,o,c),l.version=o.version}}return{get:s,remove:a,update:r}}var SA=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,MA=`#ifdef USE_ALPHAHASH
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
#endif`,EA=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,TA=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,AA=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,wA=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,CA=`#ifdef USE_AOMAP
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
#endif`,RA=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,DA=`#ifdef USE_BATCHING
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
#endif`,NA=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,UA=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,LA=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,IA=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,OA=`#ifdef USE_IRIDESCENCE
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
#endif`,PA=`#ifdef USE_BUMPMAP
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
#endif`,zA=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,BA=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,FA=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,VA=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,HA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,GA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,kA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,XA=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,WA=`#define PI 3.141592653589793
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
} // validated`,qA=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,YA=`vec3 transformedNormal = objectNormal;
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
#endif`,ZA=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,JA=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,KA=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,jA=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,QA="gl_FragColor = linearToOutputTexel( gl_FragColor );",$A=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,tw=`#ifdef USE_ENVMAP
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
#endif`,ew=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,nw=`#ifdef USE_ENVMAP
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
#endif`,iw=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,sw=`#ifdef USE_ENVMAP
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
#endif`,aw=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,rw=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,ow=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,lw=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,cw=`#ifdef USE_GRADIENTMAP
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
}`,uw=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,hw=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,fw=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,dw=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,pw=`#ifdef USE_ENVMAP
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
#endif`,mw=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,gw=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,_w=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,vw=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,yw=`PhysicalMaterial material;
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
#endif`,xw=`uniform sampler2D dfgLUT;
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
}`,bw=`
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
#endif`,Sw=`#if defined( RE_IndirectDiffuse )
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
#endif`,Mw=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Ew=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,Tw=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Aw=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,ww=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Cw=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Rw=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Dw=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Nw=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Uw=`#if defined( USE_POINTS_UV )
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
#endif`,Lw=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Iw=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Ow=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Pw=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,zw=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Bw=`#ifdef USE_MORPHTARGETS
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
#endif`,Fw=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Vw=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Hw=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Gw=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,kw=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Xw=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Ww=`#ifdef USE_NORMALMAP
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
#endif`,qw=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Yw=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Zw=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Jw=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Kw=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,jw=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Qw=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,$w=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,tC=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,eC=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,nC=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,iC=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,sC=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,aC=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,rC=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,oC=`float getShadowMask() {
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
}`,lC=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,cC=`#ifdef USE_SKINNING
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
#endif`,uC=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,hC=`#ifdef USE_SKINNING
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
#endif`,fC=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,dC=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,pC=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,mC=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,gC=`#ifdef USE_TRANSMISSION
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
#endif`,_C=`#ifdef USE_TRANSMISSION
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
#endif`,vC=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,yC=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,xC=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,bC=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,SC=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,MC=`uniform sampler2D t2D;
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
}`,EC=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,TC=`#ifdef ENVMAP_TYPE_CUBE
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
}`,AC=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,wC=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,CC=`#include <common>
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
}`,RC=`#if DEPTH_PACKING == 3200
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
}`,DC=`#define DISTANCE
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
}`,NC=`#define DISTANCE
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
}`,UC=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,LC=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,IC=`uniform float scale;
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
}`,OC=`uniform vec3 diffuse;
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
}`,PC=`#include <common>
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
}`,zC=`uniform vec3 diffuse;
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
}`,BC=`#define LAMBERT
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
}`,FC=`#define LAMBERT
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
}`,VC=`#define MATCAP
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
}`,HC=`#define MATCAP
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
}`,GC=`#define NORMAL
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
}`,kC=`#define NORMAL
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
}`,XC=`#define PHONG
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
}`,WC=`#define PHONG
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
}`,qC=`#define STANDARD
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
}`,YC=`#define STANDARD
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
}`,ZC=`#define TOON
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
}`,JC=`#define TOON
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
}`,KC=`uniform float size;
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
}`,jC=`uniform vec3 diffuse;
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
}`,QC=`#include <common>
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
}`,$C=`uniform vec3 color;
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
}`,tR=`uniform float rotation;
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
}`,eR=`uniform vec3 diffuse;
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
}`,Wt={alphahash_fragment:SA,alphahash_pars_fragment:MA,alphamap_fragment:EA,alphamap_pars_fragment:TA,alphatest_fragment:AA,alphatest_pars_fragment:wA,aomap_fragment:CA,aomap_pars_fragment:RA,batching_pars_vertex:DA,batching_vertex:NA,begin_vertex:UA,beginnormal_vertex:LA,bsdfs:IA,iridescence_fragment:OA,bumpmap_pars_fragment:PA,clipping_planes_fragment:zA,clipping_planes_pars_fragment:BA,clipping_planes_pars_vertex:FA,clipping_planes_vertex:VA,color_fragment:HA,color_pars_fragment:GA,color_pars_vertex:kA,color_vertex:XA,common:WA,cube_uv_reflection_fragment:qA,defaultnormal_vertex:YA,displacementmap_pars_vertex:ZA,displacementmap_vertex:JA,emissivemap_fragment:KA,emissivemap_pars_fragment:jA,colorspace_fragment:QA,colorspace_pars_fragment:$A,envmap_fragment:tw,envmap_common_pars_fragment:ew,envmap_pars_fragment:nw,envmap_pars_vertex:iw,envmap_physical_pars_fragment:pw,envmap_vertex:sw,fog_vertex:aw,fog_pars_vertex:rw,fog_fragment:ow,fog_pars_fragment:lw,gradientmap_pars_fragment:cw,lightmap_pars_fragment:uw,lights_lambert_fragment:hw,lights_lambert_pars_fragment:fw,lights_pars_begin:dw,lights_toon_fragment:mw,lights_toon_pars_fragment:gw,lights_phong_fragment:_w,lights_phong_pars_fragment:vw,lights_physical_fragment:yw,lights_physical_pars_fragment:xw,lights_fragment_begin:bw,lights_fragment_maps:Sw,lights_fragment_end:Mw,lightprobes_pars_fragment:Ew,logdepthbuf_fragment:Tw,logdepthbuf_pars_fragment:Aw,logdepthbuf_pars_vertex:ww,logdepthbuf_vertex:Cw,map_fragment:Rw,map_pars_fragment:Dw,map_particle_fragment:Nw,map_particle_pars_fragment:Uw,metalnessmap_fragment:Lw,metalnessmap_pars_fragment:Iw,morphinstance_vertex:Ow,morphcolor_vertex:Pw,morphnormal_vertex:zw,morphtarget_pars_vertex:Bw,morphtarget_vertex:Fw,normal_fragment_begin:Vw,normal_fragment_maps:Hw,normal_pars_fragment:Gw,normal_pars_vertex:kw,normal_vertex:Xw,normalmap_pars_fragment:Ww,clearcoat_normal_fragment_begin:qw,clearcoat_normal_fragment_maps:Yw,clearcoat_pars_fragment:Zw,iridescence_pars_fragment:Jw,opaque_fragment:Kw,packing:jw,premultiplied_alpha_fragment:Qw,project_vertex:$w,dithering_fragment:tC,dithering_pars_fragment:eC,roughnessmap_fragment:nC,roughnessmap_pars_fragment:iC,shadowmap_pars_fragment:sC,shadowmap_pars_vertex:aC,shadowmap_vertex:rC,shadowmask_pars_fragment:oC,skinbase_vertex:lC,skinning_pars_vertex:cC,skinning_vertex:uC,skinnormal_vertex:hC,specularmap_fragment:fC,specularmap_pars_fragment:dC,tonemapping_fragment:pC,tonemapping_pars_fragment:mC,transmission_fragment:gC,transmission_pars_fragment:_C,uv_pars_fragment:vC,uv_pars_vertex:yC,uv_vertex:xC,worldpos_vertex:bC,background_vert:SC,background_frag:MC,backgroundCube_vert:EC,backgroundCube_frag:TC,cube_vert:AC,cube_frag:wC,depth_vert:CC,depth_frag:RC,distance_vert:DC,distance_frag:NC,equirect_vert:UC,equirect_frag:LC,linedashed_vert:IC,linedashed_frag:OC,meshbasic_vert:PC,meshbasic_frag:zC,meshlambert_vert:BC,meshlambert_frag:FC,meshmatcap_vert:VC,meshmatcap_frag:HC,meshnormal_vert:GC,meshnormal_frag:kC,meshphong_vert:XC,meshphong_frag:WC,meshphysical_vert:qC,meshphysical_frag:YC,meshtoon_vert:ZC,meshtoon_frag:JC,points_vert:KC,points_frag:jC,shadow_vert:QC,shadow_frag:$C,sprite_vert:tR,sprite_frag:eR},vt={common:{diffuse:{value:new Qt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ht},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ht}},envmap:{envMap:{value:null},envMapRotation:{value:new Ht},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ht}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ht}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ht},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ht},normalScale:{value:new It(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ht},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ht}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ht}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ht}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Qt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new U},probesMax:{value:new U},probesResolution:{value:new U}},points:{diffuse:{value:new Qt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0},uvTransform:{value:new Ht}},sprite:{diffuse:{value:new Qt(16777215)},opacity:{value:1},center:{value:new It(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ht},alphaMap:{value:null},alphaMapTransform:{value:new Ht},alphaTest:{value:0}}},ji={basic:{uniforms:bn([vt.common,vt.specularmap,vt.envmap,vt.aomap,vt.lightmap,vt.fog]),vertexShader:Wt.meshbasic_vert,fragmentShader:Wt.meshbasic_frag},lambert:{uniforms:bn([vt.common,vt.specularmap,vt.envmap,vt.aomap,vt.lightmap,vt.emissivemap,vt.bumpmap,vt.normalmap,vt.displacementmap,vt.fog,vt.lights,{emissive:{value:new Qt(0)},envMapIntensity:{value:1}}]),vertexShader:Wt.meshlambert_vert,fragmentShader:Wt.meshlambert_frag},phong:{uniforms:bn([vt.common,vt.specularmap,vt.envmap,vt.aomap,vt.lightmap,vt.emissivemap,vt.bumpmap,vt.normalmap,vt.displacementmap,vt.fog,vt.lights,{emissive:{value:new Qt(0)},specular:{value:new Qt(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Wt.meshphong_vert,fragmentShader:Wt.meshphong_frag},standard:{uniforms:bn([vt.common,vt.envmap,vt.aomap,vt.lightmap,vt.emissivemap,vt.bumpmap,vt.normalmap,vt.displacementmap,vt.roughnessmap,vt.metalnessmap,vt.fog,vt.lights,{emissive:{value:new Qt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Wt.meshphysical_vert,fragmentShader:Wt.meshphysical_frag},toon:{uniforms:bn([vt.common,vt.aomap,vt.lightmap,vt.emissivemap,vt.bumpmap,vt.normalmap,vt.displacementmap,vt.gradientmap,vt.fog,vt.lights,{emissive:{value:new Qt(0)}}]),vertexShader:Wt.meshtoon_vert,fragmentShader:Wt.meshtoon_frag},matcap:{uniforms:bn([vt.common,vt.bumpmap,vt.normalmap,vt.displacementmap,vt.fog,{matcap:{value:null}}]),vertexShader:Wt.meshmatcap_vert,fragmentShader:Wt.meshmatcap_frag},points:{uniforms:bn([vt.points,vt.fog]),vertexShader:Wt.points_vert,fragmentShader:Wt.points_frag},dashed:{uniforms:bn([vt.common,vt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Wt.linedashed_vert,fragmentShader:Wt.linedashed_frag},depth:{uniforms:bn([vt.common,vt.displacementmap]),vertexShader:Wt.depth_vert,fragmentShader:Wt.depth_frag},normal:{uniforms:bn([vt.common,vt.bumpmap,vt.normalmap,vt.displacementmap,{opacity:{value:1}}]),vertexShader:Wt.meshnormal_vert,fragmentShader:Wt.meshnormal_frag},sprite:{uniforms:bn([vt.sprite,vt.fog]),vertexShader:Wt.sprite_vert,fragmentShader:Wt.sprite_frag},background:{uniforms:{uvTransform:{value:new Ht},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Wt.background_vert,fragmentShader:Wt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ht}},vertexShader:Wt.backgroundCube_vert,fragmentShader:Wt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Wt.cube_vert,fragmentShader:Wt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Wt.equirect_vert,fragmentShader:Wt.equirect_frag},distance:{uniforms:bn([vt.common,vt.displacementmap,{referencePosition:{value:new U},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Wt.distance_vert,fragmentShader:Wt.distance_frag},shadow:{uniforms:bn([vt.lights,vt.fog,{color:{value:new Qt(0)},opacity:{value:1}}]),vertexShader:Wt.shadow_vert,fragmentShader:Wt.shadow_frag}};ji.physical={uniforms:bn([ji.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ht},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ht},clearcoatNormalScale:{value:new It(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ht},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ht},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ht},sheen:{value:0},sheenColor:{value:new Qt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ht},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ht},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ht},transmissionSamplerSize:{value:new It},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ht},attenuationDistance:{value:0},attenuationColor:{value:new Qt(0)},specularColor:{value:new Qt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ht},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ht},anisotropyVector:{value:new It},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ht}}]),vertexShader:Wt.meshphysical_vert,fragmentShader:Wt.meshphysical_frag};var cd={r:0,b:0,g:0},nR=new Oe,pM=new Ht;pM.set(-1,0,0,0,1,0,0,0,1);function iR(e,t,n,i,s,a){let r=new Qt(0),o=s===!0?0:1,c,l,h=null,p=0,u=null;function d(_){let x=_.isScene===!0?_.background:null;if(x&&x.isTexture){let v=_.backgroundBlurriness>0;x=t.get(x,v)}return x}function m(_){let x=!1,v=d(_);v===null?g(r,o):v&&v.isColor&&(g(v,1),x=!0);let T=e.xr.getEnvironmentBlendMode();T==="additive"?n.buffers.color.setClear(0,0,0,1,a):T==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||x)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function S(_,x){let v=d(x);v&&(v.isCubeTexture||v.mapping===lc)?(l===void 0&&(l=new je(new _o(1,1,1),new Qn({name:"BackgroundCubeMaterial",uniforms:ir(ji.backgroundCube.uniforms),vertexShader:ji.backgroundCube.vertexShader,fragmentShader:ji.backgroundCube.fragmentShader,side:An,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),l.geometry.deleteAttribute("uv"),l.onBeforeRender=function(T,A,w){this.matrixWorld.copyPosition(w.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(l)),l.material.uniforms.envMap.value=v,l.material.uniforms.backgroundBlurriness.value=x.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=x.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(nR.makeRotationFromEuler(x.backgroundRotation)).transpose(),v.isCubeTexture&&v.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(pM),l.material.toneMapped=ee.getTransfer(v.colorSpace)!==ue,(h!==v||p!==v.version||u!==e.toneMapping)&&(l.material.needsUpdate=!0,h=v,p=v.version,u=e.toneMapping),l.layers.enableAll(),_.unshift(l,l.geometry,l.material,0,0,null)):v&&v.isTexture&&(c===void 0&&(c=new je(new ma(2,2),new Qn({name:"BackgroundMaterial",uniforms:ir(ji.background.uniforms),vertexShader:ji.background.vertexShader,fragmentShader:ji.background.fragmentShader,side:Ts,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(c)),c.material.uniforms.t2D.value=v,c.material.uniforms.backgroundIntensity.value=x.backgroundIntensity,c.material.toneMapped=ee.getTransfer(v.colorSpace)!==ue,v.matrixAutoUpdate===!0&&v.updateMatrix(),c.material.uniforms.uvTransform.value.copy(v.matrix),(h!==v||p!==v.version||u!==e.toneMapping)&&(c.material.needsUpdate=!0,h=v,p=v.version,u=e.toneMapping),c.layers.enableAll(),_.unshift(c,c.geometry,c.material,0,0,null))}function g(_,x){_.getRGB(cd,f0(e)),n.buffers.color.setClear(cd.r,cd.g,cd.b,x,a)}function f(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return r},setClearColor:function(_,x=1){r.set(_),o=x,g(r,o)},getClearAlpha:function(){return o},setClearAlpha:function(_){o=_,g(r,o)},render:m,addToRenderList:S,dispose:f}}function sR(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},s=u(null),a=s,r=!1;function o(D,L,P,W,B){let q=!1,X=p(D,W,P,L);a!==X&&(a=X,l(a.object)),q=d(D,W,P,B),q&&m(D,W,P,B),B!==null&&t.update(B,e.ELEMENT_ARRAY_BUFFER),(q||r)&&(r=!1,v(D,L,P,W),B!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(B).buffer))}function c(){return e.createVertexArray()}function l(D){return e.bindVertexArray(D)}function h(D){return e.deleteVertexArray(D)}function p(D,L,P,W){let B=W.wireframe===!0,q=i[L.id];q===void 0&&(q={},i[L.id]=q);let X=D.isInstancedMesh===!0?D.id:0,et=q[X];et===void 0&&(et={},q[X]=et);let at=et[P.id];at===void 0&&(at={},et[P.id]=at);let ut=at[B];return ut===void 0&&(ut=u(c()),at[B]=ut),ut}function u(D){let L=[],P=[],W=[];for(let B=0;B<n;B++)L[B]=0,P[B]=0,W[B]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:L,enabledAttributes:P,attributeDivisors:W,object:D,attributes:{},index:null}}function d(D,L,P,W){let B=a.attributes,q=L.attributes,X=0,et=P.getAttributes();for(let at in et)if(et[at].location>=0){let pt=B[at],bt=q[at];if(bt===void 0&&(at==="instanceMatrix"&&D.instanceMatrix&&(bt=D.instanceMatrix),at==="instanceColor"&&D.instanceColor&&(bt=D.instanceColor)),pt===void 0||pt.attribute!==bt||bt&&pt.data!==bt.data)return!0;X++}return a.attributesNum!==X||a.index!==W}function m(D,L,P,W){let B={},q=L.attributes,X=0,et=P.getAttributes();for(let at in et)if(et[at].location>=0){let pt=q[at];pt===void 0&&(at==="instanceMatrix"&&D.instanceMatrix&&(pt=D.instanceMatrix),at==="instanceColor"&&D.instanceColor&&(pt=D.instanceColor));let bt={};bt.attribute=pt,pt&&pt.data&&(bt.data=pt.data),B[at]=bt,X++}a.attributes=B,a.attributesNum=X,a.index=W}function S(){let D=a.newAttributes;for(let L=0,P=D.length;L<P;L++)D[L]=0}function g(D){f(D,0)}function f(D,L){let P=a.newAttributes,W=a.enabledAttributes,B=a.attributeDivisors;P[D]=1,W[D]===0&&(e.enableVertexAttribArray(D),W[D]=1),B[D]!==L&&(e.vertexAttribDivisor(D,L),B[D]=L)}function _(){let D=a.newAttributes,L=a.enabledAttributes;for(let P=0,W=L.length;P<W;P++)L[P]!==D[P]&&(e.disableVertexAttribArray(P),L[P]=0)}function x(D,L,P,W,B,q,X){X===!0?e.vertexAttribIPointer(D,L,P,B,q):e.vertexAttribPointer(D,L,P,W,B,q)}function v(D,L,P,W){S();let B=W.attributes,q=P.getAttributes(),X=L.defaultAttributeValues;for(let et in q){let at=q[et];if(at.location>=0){let ut=B[et];if(ut===void 0&&(et==="instanceMatrix"&&D.instanceMatrix&&(ut=D.instanceMatrix),et==="instanceColor"&&D.instanceColor&&(ut=D.instanceColor)),ut!==void 0){let pt=ut.normalized,bt=ut.itemSize,Zt=t.get(ut);if(Zt===void 0)continue;let ce=Zt.buffer,$t=Zt.type,Q=Zt.bytesPerElement,ft=$t===e.INT||$t===e.UNSIGNED_INT||ut.gpuType===Tf;if(ut.isInterleavedBufferAttribute){let rt=ut.data,mt=rt.stride,St=ut.offset;if(rt.isInstancedInterleavedBuffer){for(let wt=0;wt<at.locationSize;wt++)f(at.location+wt,rt.meshPerAttribute);D.isInstancedMesh!==!0&&W._maxInstanceCount===void 0&&(W._maxInstanceCount=rt.meshPerAttribute*rt.count)}else for(let wt=0;wt<at.locationSize;wt++)g(at.location+wt);e.bindBuffer(e.ARRAY_BUFFER,ce);for(let wt=0;wt<at.locationSize;wt++)x(at.location+wt,bt/at.locationSize,$t,pt,mt*Q,(St+bt/at.locationSize*wt)*Q,ft)}else{if(ut.isInstancedBufferAttribute){for(let rt=0;rt<at.locationSize;rt++)f(at.location+rt,ut.meshPerAttribute);D.isInstancedMesh!==!0&&W._maxInstanceCount===void 0&&(W._maxInstanceCount=ut.meshPerAttribute*ut.count)}else for(let rt=0;rt<at.locationSize;rt++)g(at.location+rt);e.bindBuffer(e.ARRAY_BUFFER,ce);for(let rt=0;rt<at.locationSize;rt++)x(at.location+rt,bt/at.locationSize,$t,pt,bt*Q,bt/at.locationSize*rt*Q,ft)}}else if(X!==void 0){let pt=X[et];if(pt!==void 0)switch(pt.length){case 2:e.vertexAttrib2fv(at.location,pt);break;case 3:e.vertexAttrib3fv(at.location,pt);break;case 4:e.vertexAttrib4fv(at.location,pt);break;default:e.vertexAttrib1fv(at.location,pt)}}}}_()}function T(){M();for(let D in i){let L=i[D];for(let P in L){let W=L[P];for(let B in W){let q=W[B];for(let X in q)h(q[X].object),delete q[X];delete W[B]}}delete i[D]}}function A(D){if(i[D.id]===void 0)return;let L=i[D.id];for(let P in L){let W=L[P];for(let B in W){let q=W[B];for(let X in q)h(q[X].object),delete q[X];delete W[B]}}delete i[D.id]}function w(D){for(let L in i){let P=i[L];for(let W in P){let B=P[W];if(B[D.id]===void 0)continue;let q=B[D.id];for(let X in q)h(q[X].object),delete q[X];delete B[D.id]}}}function y(D){for(let L in i){let P=i[L],W=D.isInstancedMesh===!0?D.id:0,B=P[W];if(B!==void 0){for(let q in B){let X=B[q];for(let et in X)h(X[et].object),delete X[et];delete B[q]}delete P[W],Object.keys(P).length===0&&delete i[L]}}}function M(){C(),r=!0,a!==s&&(a=s,l(a.object))}function C(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:M,resetDefaultState:C,dispose:T,releaseStatesOfGeometry:A,releaseStatesOfObject:y,releaseStatesOfProgram:w,initAttributes:S,enableAttribute:g,disableUnusedAttributes:_}}function aR(e,t,n){let i;function s(c){i=c}function a(c,l){e.drawArrays(i,c,l),n.update(l,i,1)}function r(c,l,h){h!==0&&(e.drawArraysInstanced(i,c,l,h),n.update(l,i,h))}function o(c,l,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,l,0,h);let u=0;for(let d=0;d<h;d++)u+=l[d];n.update(u,i,1)}this.setMode=s,this.render=a,this.renderInstances=r,this.renderMultiDraw=o}function rR(e,t,n,i){let s;function a(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let w=t.get("EXT_texture_filter_anisotropic");s=e.getParameter(w.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function r(w){return!(w!==_i&&i.convert(w)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(w){let y=w===Ji&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(w!==ei&&i.convert(w)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE)&&w!==wi&&!y)}function c(w){if(w==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";w="mediump"}return w==="mediump"&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=n.precision!==void 0?n.precision:"highp",h=c(l);h!==l&&(Ot("WebGLRenderer:",l,"not supported, using",h,"instead."),l=h);let p=n.logarithmicDepthBuffer===!0,u=n.reversedDepthBuffer===!0&&t.has("EXT_clip_control");n.reversedDepthBuffer===!0&&u===!1&&Ot("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let d=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),S=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),f=e.getParameter(e.MAX_VERTEX_ATTRIBS),_=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),x=e.getParameter(e.MAX_VARYING_VECTORS),v=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),T=e.getParameter(e.MAX_SAMPLES),A=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:r,textureTypeReadable:o,precision:l,logarithmicDepthBuffer:p,reversedDepthBuffer:u,maxTextures:d,maxVertexTextures:m,maxTextureSize:S,maxCubemapSize:g,maxAttributes:f,maxVertexUniforms:_,maxVaryings:x,maxFragmentUniforms:v,maxSamples:T,samples:A}}function oR(e){let t=this,n=null,i=0,s=!1,a=!1,r=new Vi,o=new Ht,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(p,u){let d=p.length!==0||u||i!==0||s;return s=u,i=p.length,d},this.beginShadows=function(){a=!0,h(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(p,u){n=h(p,u,0)},this.setState=function(p,u,d){let m=p.clippingPlanes,S=p.clipIntersection,g=p.clipShadows,f=e.get(p);if(!s||m===null||m.length===0||a&&!g)a?h(null):l();else{let _=a?0:i,x=_*4,v=f.clippingState||null;c.value=v,v=h(m,u,x,d);for(let T=0;T!==x;++T)v[T]=n[T];f.clippingState=v,this.numIntersection=S?this.numPlanes:0,this.numPlanes+=_}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=i>0),t.numPlanes=i,t.numIntersection=0}function h(p,u,d,m){let S=p!==null?p.length:0,g=null;if(S!==0){if(g=c.value,m!==!0||g===null){let f=d+S*4,_=u.matrixWorldInverse;o.getNormalMatrix(_),(g===null||g.length<f)&&(g=new Float32Array(f));for(let x=0,v=d;x!==S;++x,v+=4)r.copy(p[x]).applyMatrix4(_,o),r.normal.toArray(g,v),g[v+3]=r.constant}c.value=g,c.needsUpdate=!0}return t.numPlanes=S,t.numIntersection=0,g}}var Ma=4,WS=[.125,.215,.35,.446,.526,.582],sr=20,lR=256,_c=new ac,qS=new Qt,g0=null,_0=0,v0=0,y0=!1,cR=new U,hd=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,n=0,i=.1,s=100,a={}){let{size:r=256,position:o=cR}=a;g0=this._renderer.getRenderTarget(),_0=this._renderer.getActiveCubeFace(),v0=this._renderer.getActiveMipmapLevel(),y0=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(r);let c=this._allocateTargets();return c.depthBuffer=!0,this._sceneToCubeUV(t,i,s,c,o),n>0&&this._blur(c,0,0,n),this._applyPMREM(c),this._cleanup(c),c}fromEquirectangular(t,n=null){return this._fromTexture(t,n)}fromCubemap(t,n=null){return this._fromTexture(t,n)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=JS(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=ZS(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(g0,_0,v0),this._renderer.xr.enabled=y0,t.scissorTest=!1,Mo(t,0,0,t.width,t.height)}_fromTexture(t,n){t.mapping===ya||t.mapping===nr?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),g0=this._renderer.getRenderTarget(),_0=this._renderer.getActiveCubeFace(),v0=this._renderer.getActiveMipmapLevel(),y0=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=n||this._allocateTargets();return this._textureToCubeUV(t,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),n=4*this._cubeSize,i={magFilter:dn,minFilter:dn,generateMipmaps:!1,type:Ji,format:_i,colorSpace:Bl,depthBuffer:!1},s=YS(t,n,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==n){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=YS(t,n,i);let{_lodMax:a}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=uR(a)),this._blurMaterial=fR(a,t,n),this._ggxMaterial=hR(a,t,n)}return s}_compileMaterial(t){let n=new je(new He,t);this._renderer.compile(n,_c)}_sceneToCubeUV(t,n,i,s,a){let c=new yn(90,1,n,i),l=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],p=this._renderer,u=p.autoClear,d=p.toneMapping;p.getClearColor(qS),p.toneMapping=Ti,p.autoClear=!1,p.state.buffers.depth.getReversed()&&(p.setRenderTarget(s),p.clearDepth(),p.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new je(new _o,new mi({name:"PMREM.Background",side:An,depthWrite:!1,depthTest:!1})));let S=this._backgroundBox,g=S.material,f=!1,_=t.background;_?_.isColor&&(g.color.copy(_),t.background=null,f=!0):(g.color.copy(qS),f=!0);for(let x=0;x<6;x++){let v=x%3;v===0?(c.up.set(0,l[x],0),c.position.set(a.x,a.y,a.z),c.lookAt(a.x+h[x],a.y,a.z)):v===1?(c.up.set(0,0,l[x]),c.position.set(a.x,a.y,a.z),c.lookAt(a.x,a.y+h[x],a.z)):(c.up.set(0,l[x],0),c.position.set(a.x,a.y,a.z),c.lookAt(a.x,a.y,a.z+h[x]));let T=this._cubeSize;Mo(s,v*T,x>2?T:0,T,T),p.setRenderTarget(s),f&&p.render(S,c),p.render(t,c)}p.toneMapping=d,p.autoClear=u,t.background=_}_textureToCubeUV(t,n){let i=this._renderer,s=t.mapping===ya||t.mapping===nr;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=JS()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=ZS());let a=s?this._cubemapMaterial:this._equirectMaterial,r=this._lodMeshes[0];r.material=a;let o=a.uniforms;o.envMap.value=t;let c=this._cubeSize;Mo(n,0,0,3*c,2*c),i.setRenderTarget(n),i.render(r,_c)}_applyPMREM(t){let n=this._renderer,i=n.autoClear;n.autoClear=!1;let s=this._lodMeshes.length;for(let a=1;a<s;a++)this._applyGGXFilter(t,a-1,a);n.autoClear=i}_applyGGXFilter(t,n,i){let s=this._renderer,a=this._pingPongRenderTarget,r=this._ggxMaterial,o=this._lodMeshes[i];o.material=r;let c=r.uniforms,l=i/(this._lodMeshes.length-1),h=n/(this._lodMeshes.length-1),p=Math.sqrt(l*l-h*h),u=0+l*1.25,d=p*u,{_lodMax:m}=this,S=this._sizeLods[i],g=3*S*(i>m-Ma?i-m+Ma:0),f=4*(this._cubeSize-S);c.envMap.value=t.texture,c.roughness.value=d,c.mipInt.value=m-n,Mo(a,g,f,3*S,2*S),s.setRenderTarget(a),s.render(o,_c),c.envMap.value=a.texture,c.roughness.value=0,c.mipInt.value=m-i,Mo(t,g,f,3*S,2*S),s.setRenderTarget(t),s.render(o,_c)}_blur(t,n,i,s,a){let r=this._pingPongRenderTarget;this._halfBlur(t,r,n,i,s,"latitudinal",a),this._halfBlur(r,t,i,i,s,"longitudinal",a)}_halfBlur(t,n,i,s,a,r,o){let c=this._renderer,l=this._blurMaterial;r!=="latitudinal"&&r!=="longitudinal"&&zt("blur direction must be either latitudinal or longitudinal!");let h=3,p=this._lodMeshes[s];p.material=l;let u=l.uniforms,d=this._sizeLods[i]-1,m=isFinite(a)?Math.PI/(2*d):2*Math.PI/(2*sr-1),S=a/m,g=isFinite(a)?1+Math.floor(h*S):sr;g>sr&&Ot(`sigmaRadians, ${a}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${sr}`);let f=[],_=0;for(let w=0;w<sr;++w){let y=w/S,M=Math.exp(-y*y/2);f.push(M),w===0?_+=M:w<g&&(_+=2*M)}for(let w=0;w<f.length;w++)f[w]=f[w]/_;u.envMap.value=t.texture,u.samples.value=g,u.weights.value=f,u.latitudinal.value=r==="latitudinal",o&&(u.poleAxis.value=o);let{_lodMax:x}=this;u.dTheta.value=m,u.mipInt.value=x-i;let v=this._sizeLods[s],T=3*v*(s>x-Ma?s-x+Ma:0),A=4*(this._cubeSize-v);Mo(n,T,A,3*v,2*v),c.setRenderTarget(n),c.render(p,_c)}};function uR(e){let t=[],n=[],i=[],s=e,a=e-Ma+1+WS.length;for(let r=0;r<a;r++){let o=Math.pow(2,s);t.push(o);let c=1/o;r>e-Ma?c=WS[r-e+Ma-1]:r===0&&(c=0),n.push(c);let l=1/(o-2),h=-l,p=1+l,u=[h,h,p,h,p,p,h,h,p,p,h,p],d=6,m=6,S=3,g=2,f=1,_=new Float32Array(S*m*d),x=new Float32Array(g*m*d),v=new Float32Array(f*m*d);for(let A=0;A<d;A++){let w=A%3*2/3-1,y=A>2?0:-1,M=[w,y,0,w+2/3,y,0,w+2/3,y+1,0,w,y,0,w+2/3,y+1,0,w,y+1,0];_.set(M,S*m*A),x.set(u,g*m*A);let C=[A,A,A,A,A,A];v.set(C,f*m*A)}let T=new He;T.setAttribute("position",new Jn(_,S)),T.setAttribute("uv",new Jn(x,g)),T.setAttribute("faceIndex",new Jn(v,f)),i.push(new je(T,null)),s>Ma&&s--}return{lodMeshes:i,sizeLods:t,sigmas:n}}function YS(e,t,n){let i=new Kn(e,t,n);return i.texture.mapping=lc,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Mo(e,t,n,i,s){e.viewport.set(t,n,i,s),e.scissor.set(t,n,i,s)}function hR(e,t,n){return new Qn({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:lR,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:pd(),fragmentShader:`

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
		`,blending:Zi,depthTest:!1,depthWrite:!1})}function fR(e,t,n){let i=new Float32Array(sr),s=new U(0,1,0);return new Qn({name:"SphericalGaussianBlur",defines:{n:sr,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:pd(),fragmentShader:`

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
		`,blending:Zi,depthTest:!1,depthWrite:!1})}function ZS(){return new Qn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:pd(),fragmentShader:`

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
		`,blending:Zi,depthTest:!1,depthWrite:!1})}function JS(){return new Qn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:pd(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Zi,depthTest:!1,depthWrite:!1})}function pd(){return`

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
	`}var fd=class extends Kn{constructor(t=1,n={}){super(t,t,n),this.isWebGLCubeRenderTarget=!0;let i={width:t,height:t,depth:1},s=[i,i,i,i,i,i];this.texture=new Kl(s),this._setTextureOptions(n),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,n){this.texture.type=n.type,this.texture.colorSpace=n.colorSpace,this.texture.generateMipmaps=n.generateMipmaps,this.texture.minFilter=n.minFilter,this.texture.magFilter=n.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new _o(5,5,5),a=new Qn({name:"CubemapFromEquirect",uniforms:ir(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:An,blending:Zi});a.uniforms.tEquirect.value=n;let r=new je(s,a),o=n.minFilter;return n.minFilter===xa&&(n.minFilter=dn),new yf(1,10,this).update(t,r),n.minFilter=o,r.geometry.dispose(),r.material.dispose(),this}clear(t,n=!0,i=!0,s=!0){let a=t.getRenderTarget();for(let r=0;r<6;r++)t.setRenderTarget(this,r),t.clear(n,i,s);t.setRenderTarget(a)}};function dR(e){let t=new WeakMap,n=new WeakMap,i=null;function s(u,d=!1){return u==null?null:d?r(u):a(u)}function a(u){if(u&&u.isTexture){let d=u.mapping;if(d===Sf||d===Mf)if(t.has(u)){let m=t.get(u).texture;return o(m,u.mapping)}else{let m=u.image;if(m&&m.height>0){let S=new fd(m.height);return S.fromEquirectangularTexture(e,u),t.set(u,S),u.addEventListener("dispose",l),o(S.texture,u.mapping)}else return null}}return u}function r(u){if(u&&u.isTexture){let d=u.mapping,m=d===Sf||d===Mf,S=d===ya||d===nr;if(m||S){let g=n.get(u),f=g!==void 0?g.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==f)return i===null&&(i=new hd(e)),g=m?i.fromEquirectangular(u,g):i.fromCubemap(u,g),g.texture.pmremVersion=u.pmremVersion,n.set(u,g),g.texture;if(g!==void 0)return g.texture;{let _=u.image;return m&&_&&_.height>0||S&&_&&c(_)?(i===null&&(i=new hd(e)),g=m?i.fromEquirectangular(u):i.fromCubemap(u),g.texture.pmremVersion=u.pmremVersion,n.set(u,g),u.addEventListener("dispose",h),g.texture):null}}}return u}function o(u,d){return d===Sf?u.mapping=ya:d===Mf&&(u.mapping=nr),u}function c(u){let d=0,m=6;for(let S=0;S<m;S++)u[S]!==void 0&&d++;return d===m}function l(u){let d=u.target;d.removeEventListener("dispose",l);let m=t.get(d);m!==void 0&&(t.delete(d),m.dispose())}function h(u){let d=u.target;d.removeEventListener("dispose",h);let m=n.get(d);m!==void 0&&(n.delete(d),m.dispose())}function p(){t=new WeakMap,n=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:s,dispose:p}}function pR(e){let t={};function n(i){if(t[i]!==void 0)return t[i];let s=e.getExtension(i);return t[i]=s,s}return{has:function(i){return n(i)!==null},init:function(){n("EXT_color_buffer_float"),n("WEBGL_clip_cull_distance"),n("OES_texture_float_linear"),n("EXT_color_buffer_half_float"),n("WEBGL_multisampled_render_to_texture"),n("WEBGL_render_shared_exponent")},get:function(i){let s=n(i);return s===null&&ja("WebGLRenderer: "+i+" extension not supported."),s}}}function mR(e,t,n,i){let s={},a=new WeakMap;function r(p){let u=p.target;u.index!==null&&t.remove(u.index);for(let m in u.attributes)t.remove(u.attributes[m]);u.removeEventListener("dispose",r),delete s[u.id];let d=a.get(u);d&&(t.remove(d),a.delete(u)),i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,n.memory.geometries--}function o(p,u){return s[u.id]===!0||(u.addEventListener("dispose",r),s[u.id]=!0,n.memory.geometries++),u}function c(p){let u=p.attributes;for(let d in u)t.update(u[d],e.ARRAY_BUFFER)}function l(p){let u=[],d=p.index,m=p.attributes.position,S=0;if(m===void 0)return;if(d!==null){let _=d.array;S=d.version;for(let x=0,v=_.length;x<v;x+=3){let T=_[x+0],A=_[x+1],w=_[x+2];u.push(T,A,A,w,w,T)}}else{let _=m.array;S=m.version;for(let x=0,v=_.length/3-1;x<v;x+=3){let T=x+0,A=x+1,w=x+2;u.push(T,A,A,w,w,T)}}let g=new(m.count>=65535?Yl:ql)(u,1);g.version=S;let f=a.get(p);f&&t.remove(f),a.set(p,g)}function h(p){let u=a.get(p);if(u){let d=p.index;d!==null&&u.version<d.version&&l(p)}else l(p);return a.get(p)}return{get:o,update:c,getWireframeAttribute:h}}function gR(e,t,n){let i;function s(p){i=p}let a,r;function o(p){a=p.type,r=p.bytesPerElement}function c(p,u){e.drawElements(i,u,a,p*r),n.update(u,i,1)}function l(p,u,d){d!==0&&(e.drawElementsInstanced(i,u,a,p*r,d),n.update(u,i,d))}function h(p,u,d){if(d===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,a,p,0,d);let S=0;for(let g=0;g<d;g++)S+=u[g];n.update(S,i,1)}this.setMode=s,this.setIndex=o,this.render=c,this.renderInstances=l,this.renderMultiDraw=h}function _R(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function i(a,r,o){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=o*(a/3);break;case e.LINES:n.lines+=o*(a/2);break;case e.LINE_STRIP:n.lines+=o*(a-1);break;case e.LINE_LOOP:n.lines+=o*a;break;case e.POINTS:n.points+=o*a;break;default:zt("WebGLInfo: Unknown draw mode:",r);break}}function s(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:s,update:i}}function vR(e,t,n){let i=new WeakMap,s=new Pe;function a(r,o,c){let l=r.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,p=h!==void 0?h.length:0,u=i.get(o);if(u===void 0||u.count!==p){let M=function(){w.dispose(),i.delete(o),o.removeEventListener("dispose",M)};u!==void 0&&u.texture.dispose();let d=o.morphAttributes.position!==void 0,m=o.morphAttributes.normal!==void 0,S=o.morphAttributes.color!==void 0,g=o.morphAttributes.position||[],f=o.morphAttributes.normal||[],_=o.morphAttributes.color||[],x=0;d===!0&&(x=1),m===!0&&(x=2),S===!0&&(x=3);let v=o.attributes.position.count*x,T=1;v>t.maxTextureSize&&(T=Math.ceil(v/t.maxTextureSize),v=t.maxTextureSize);let A=new Float32Array(v*T*4*p),w=new Gl(A,v,T,p);w.type=wi,w.needsUpdate=!0;let y=x*4;for(let C=0;C<p;C++){let D=g[C],L=f[C],P=_[C],W=v*T*4*C;for(let B=0;B<D.count;B++){let q=B*y;d===!0&&(s.fromBufferAttribute(D,B),A[W+q+0]=s.x,A[W+q+1]=s.y,A[W+q+2]=s.z,A[W+q+3]=0),m===!0&&(s.fromBufferAttribute(L,B),A[W+q+4]=s.x,A[W+q+5]=s.y,A[W+q+6]=s.z,A[W+q+7]=0),S===!0&&(s.fromBufferAttribute(P,B),A[W+q+8]=s.x,A[W+q+9]=s.y,A[W+q+10]=s.z,A[W+q+11]=P.itemSize===4?s.w:1)}}u={count:p,texture:w,size:new It(v,T)},i.set(o,u),o.addEventListener("dispose",M)}if(r.isInstancedMesh===!0&&r.morphTexture!==null)c.getUniforms().setValue(e,"morphTexture",r.morphTexture,n);else{let d=0;for(let S=0;S<l.length;S++)d+=l[S];let m=o.morphTargetsRelative?1:1-d;c.getUniforms().setValue(e,"morphTargetBaseInfluence",m),c.getUniforms().setValue(e,"morphTargetInfluences",l)}c.getUniforms().setValue(e,"morphTargetsTexture",u.texture,n),c.getUniforms().setValue(e,"morphTargetsTextureSize",u.size)}return{update:a}}function yR(e,t,n,i,s){let a=new WeakMap;function r(l){let h=s.render.frame,p=l.geometry,u=t.get(l,p);if(a.get(u)!==h&&(t.update(u),a.set(u,h)),l.isInstancedMesh&&(l.hasEventListener("dispose",c)===!1&&l.addEventListener("dispose",c),a.get(l)!==h&&(n.update(l.instanceMatrix,e.ARRAY_BUFFER),l.instanceColor!==null&&n.update(l.instanceColor,e.ARRAY_BUFFER),a.set(l,h))),l.isSkinnedMesh){let d=l.skeleton;a.get(d)!==h&&(d.update(),a.set(d,h))}return u}function o(){a=new WeakMap}function c(l){let h=l.target;h.removeEventListener("dispose",c),i.releaseStatesOfObject(h),n.remove(h.instanceMatrix),h.instanceColor!==null&&n.remove(h.instanceColor)}return{update:r,dispose:o}}var xR={[Yg]:"LINEAR_TONE_MAPPING",[Zg]:"REINHARD_TONE_MAPPING",[Jg]:"CINEON_TONE_MAPPING",[Kg]:"ACES_FILMIC_TONE_MAPPING",[Qg]:"AGX_TONE_MAPPING",[$g]:"NEUTRAL_TONE_MAPPING",[jg]:"CUSTOM_TONE_MAPPING"};function bR(e,t,n,i,s,a){let r=new Kn(t,n,{type:e,depthBuffer:s,stencilBuffer:a,samples:i?4:0,depthTexture:s?new As(t,n):void 0}),o=new Kn(t,n,{type:Ji,depthBuffer:!1,stencilBuffer:!1}),c=new He;c.setAttribute("position",new Me([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new Me([0,2,0,0,2,0],2));let l=new rf({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),h=new je(c,l),p=new ac(-1,1,1,-1,0,1),u=null,d=null,m=!1,S,g=null,f=[],_=!1;this.setSize=function(x,v){r.setSize(x,v),o.setSize(x,v);for(let T=0;T<f.length;T++){let A=f[T];A.setSize&&A.setSize(x,v)}},this.setEffects=function(x){f=x,_=f.length>0&&f[0].isRenderPass===!0;let v=r.width,T=r.height;for(let A=0;A<f.length;A++){let w=f[A];w.setSize&&w.setSize(v,T)}},this.begin=function(x,v){if(m||x.toneMapping===Ti&&f.length===0)return!1;if(g=v,v!==null){let T=v.width,A=v.height;(r.width!==T||r.height!==A)&&this.setSize(T,A)}return _===!1&&x.setRenderTarget(r),S=x.toneMapping,x.toneMapping=Ti,!0},this.hasRenderPass=function(){return _},this.end=function(x,v){x.toneMapping=S,m=!0;let T=r,A=o;for(let w=0;w<f.length;w++){let y=f[w];if(y.enabled!==!1&&(y.render(x,A,T,v),y.needsSwap!==!1)){let M=T;T=A,A=M}}if(u!==x.outputColorSpace||d!==x.toneMapping){u=x.outputColorSpace,d=x.toneMapping,l.defines={},ee.getTransfer(u)===ue&&(l.defines.SRGB_TRANSFER="");let w=xR[d];w&&(l.defines[w]=""),l.needsUpdate=!0}l.uniforms.tDiffuse.value=T.texture,x.setRenderTarget(g),x.render(h,p),g=null,m=!1},this.isCompositing=function(){return m},this.dispose=function(){r.depthTexture&&r.depthTexture.dispose(),r.dispose(),o.dispose(),c.dispose(),l.dispose()}}var mM=new xn,S0=new As(1,1),gM=new Gl,_M=new qh,vM=new Kl,KS=[],jS=[],QS=new Float32Array(16),$S=new Float32Array(9),tM=new Float32Array(4);function To(e,t,n){let i=e[0];if(i<=0||i>0)return e;let s=t*n,a=KS[s];if(a===void 0&&(a=new Float32Array(s),KS[s]=a),t!==0){i.toArray(a,0);for(let r=1,o=0;r!==t;++r)o+=n,e[r].toArray(a,o)}return a}function tn(e,t){if(e.length!==t.length)return!1;for(let n=0,i=e.length;n<i;n++)if(e[n]!==t[n])return!1;return!0}function en(e,t){for(let n=0,i=t.length;n<i;n++)e[n]=t[n]}function md(e,t){let n=jS[t];n===void 0&&(n=new Int32Array(t),jS[t]=n);for(let i=0;i!==t;++i)n[i]=e.allocateTextureUnit();return n}function SR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function MR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(tn(n,t))return;e.uniform2fv(this.addr,t),en(n,t)}}function ER(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(tn(n,t))return;e.uniform3fv(this.addr,t),en(n,t)}}function TR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(tn(n,t))return;e.uniform4fv(this.addr,t),en(n,t)}}function AR(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(tn(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),en(n,t)}else{if(tn(n,i))return;tM.set(i),e.uniformMatrix2fv(this.addr,!1,tM),en(n,i)}}function wR(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(tn(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),en(n,t)}else{if(tn(n,i))return;$S.set(i),e.uniformMatrix3fv(this.addr,!1,$S),en(n,i)}}function CR(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(tn(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),en(n,t)}else{if(tn(n,i))return;QS.set(i),e.uniformMatrix4fv(this.addr,!1,QS),en(n,i)}}function RR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function DR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(tn(n,t))return;e.uniform2iv(this.addr,t),en(n,t)}}function NR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(tn(n,t))return;e.uniform3iv(this.addr,t),en(n,t)}}function UR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(tn(n,t))return;e.uniform4iv(this.addr,t),en(n,t)}}function LR(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function IR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(tn(n,t))return;e.uniform2uiv(this.addr,t),en(n,t)}}function OR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(tn(n,t))return;e.uniform3uiv(this.addr,t),en(n,t)}}function PR(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(tn(n,t))return;e.uniform4uiv(this.addr,t),en(n,t)}}function zR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s);let a;this.type===e.SAMPLER_2D_SHADOW?(S0.compareFunction=n.isReversedDepthBuffer()?ld:od,a=S0):a=mM,n.setTexture2D(t||a,s)}function BR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTexture3D(t||_M,s)}function FR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTextureCube(t||vM,s)}function VR(e,t,n){let i=this.cache,s=n.allocateTextureUnit();i[0]!==s&&(e.uniform1i(this.addr,s),i[0]=s),n.setTexture2DArray(t||gM,s)}function HR(e){switch(e){case 5126:return SR;case 35664:return MR;case 35665:return ER;case 35666:return TR;case 35674:return AR;case 35675:return wR;case 35676:return CR;case 5124:case 35670:return RR;case 35667:case 35671:return DR;case 35668:case 35672:return NR;case 35669:case 35673:return UR;case 5125:return LR;case 36294:return IR;case 36295:return OR;case 36296:return PR;case 35678:case 36198:case 36298:case 36306:case 35682:return zR;case 35679:case 36299:case 36307:return BR;case 35680:case 36300:case 36308:case 36293:return FR;case 36289:case 36303:case 36311:case 36292:return VR}}function GR(e,t){e.uniform1fv(this.addr,t)}function kR(e,t){let n=To(t,this.size,2);e.uniform2fv(this.addr,n)}function XR(e,t){let n=To(t,this.size,3);e.uniform3fv(this.addr,n)}function WR(e,t){let n=To(t,this.size,4);e.uniform4fv(this.addr,n)}function qR(e,t){let n=To(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function YR(e,t){let n=To(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function ZR(e,t){let n=To(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function JR(e,t){e.uniform1iv(this.addr,t)}function KR(e,t){e.uniform2iv(this.addr,t)}function jR(e,t){e.uniform3iv(this.addr,t)}function QR(e,t){e.uniform4iv(this.addr,t)}function $R(e,t){e.uniform1uiv(this.addr,t)}function t2(e,t){e.uniform2uiv(this.addr,t)}function e2(e,t){e.uniform3uiv(this.addr,t)}function n2(e,t){e.uniform4uiv(this.addr,t)}function i2(e,t,n){let i=this.cache,s=t.length,a=md(n,s);tn(i,a)||(e.uniform1iv(this.addr,a),en(i,a));let r;this.type===e.SAMPLER_2D_SHADOW?r=S0:r=mM;for(let o=0;o!==s;++o)n.setTexture2D(t[o]||r,a[o])}function s2(e,t,n){let i=this.cache,s=t.length,a=md(n,s);tn(i,a)||(e.uniform1iv(this.addr,a),en(i,a));for(let r=0;r!==s;++r)n.setTexture3D(t[r]||_M,a[r])}function a2(e,t,n){let i=this.cache,s=t.length,a=md(n,s);tn(i,a)||(e.uniform1iv(this.addr,a),en(i,a));for(let r=0;r!==s;++r)n.setTextureCube(t[r]||vM,a[r])}function r2(e,t,n){let i=this.cache,s=t.length,a=md(n,s);tn(i,a)||(e.uniform1iv(this.addr,a),en(i,a));for(let r=0;r!==s;++r)n.setTexture2DArray(t[r]||gM,a[r])}function o2(e){switch(e){case 5126:return GR;case 35664:return kR;case 35665:return XR;case 35666:return WR;case 35674:return qR;case 35675:return YR;case 35676:return ZR;case 5124:case 35670:return JR;case 35667:case 35671:return KR;case 35668:case 35672:return jR;case 35669:case 35673:return QR;case 5125:return $R;case 36294:return t2;case 36295:return e2;case 36296:return n2;case 35678:case 36198:case 36298:case 36306:case 35682:return i2;case 35679:case 36299:case 36307:return s2;case 35680:case 36300:case 36308:case 36293:return a2;case 36289:case 36303:case 36311:case 36292:return r2}}var M0=class{constructor(t,n,i){this.id=t,this.addr=i,this.cache=[],this.type=n.type,this.setValue=HR(n.type)}},E0=class{constructor(t,n,i){this.id=t,this.addr=i,this.cache=[],this.type=n.type,this.size=n.size,this.setValue=o2(n.type)}},T0=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,n,i){let s=this.seq;for(let a=0,r=s.length;a!==r;++a){let o=s[a];o.setValue(t,n[o.id],i)}}},x0=/(\w+)(\])?(\[|\.)?/g;function eM(e,t){e.seq.push(t),e.map[t.id]=t}function l2(e,t,n){let i=e.name,s=i.length;for(x0.lastIndex=0;;){let a=x0.exec(i),r=x0.lastIndex,o=a[1],c=a[2]==="]",l=a[3];if(c&&(o=o|0),l===void 0||l==="["&&r+2===s){eM(n,l===void 0?new M0(o,e,t):new E0(o,e,t));break}else{let p=n.map[o];p===void 0&&(p=new T0(o),eM(n,p)),n=p}}}var Eo=class{constructor(t,n){this.seq=[],this.map={};let i=t.getProgramParameter(n,t.ACTIVE_UNIFORMS);for(let r=0;r<i;++r){let o=t.getActiveUniform(n,r),c=t.getUniformLocation(n,o.name);l2(o,c,this)}let s=[],a=[];for(let r of this.seq)r.type===t.SAMPLER_2D_SHADOW||r.type===t.SAMPLER_CUBE_SHADOW||r.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(r):a.push(r);s.length>0&&(this.seq=s.concat(a))}setValue(t,n,i,s){let a=this.map[n];a!==void 0&&a.setValue(t,i,s)}setOptional(t,n,i){let s=n[i];s!==void 0&&this.setValue(t,i,s)}static upload(t,n,i,s){for(let a=0,r=n.length;a!==r;++a){let o=n[a],c=i[o.id];c.needsUpdate!==!1&&o.setValue(t,c.value,s)}}static seqWithValue(t,n){let i=[];for(let s=0,a=t.length;s!==a;++s){let r=t[s];r.id in n&&i.push(r)}return i}};function nM(e,t,n){let i=e.createShader(t);return e.shaderSource(i,n),e.compileShader(i),i}var c2=37297,u2=0;function h2(e,t){let n=e.split(`
`),i=[],s=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let r=s;r<a;r++){let o=r+1;i.push(`${o===t?">":" "} ${o}: ${n[r]}`)}return i.join(`
`)}var iM=new Ht;function f2(e){ee._getMatrix(iM,ee.workingColorSpace,e);let t=`mat3( ${iM.elements.map(n=>n.toFixed(4))} )`;switch(ee.getTransfer(e)){case Fl:return[t,"LinearTransferOETF"];case ue:return[t,"sRGBTransferOETF"];default:return Ot("WebGLProgram: Unsupported color space: ",e),[t,"LinearTransferOETF"]}}function sM(e,t,n){let i=e.getShaderParameter(t,e.COMPILE_STATUS),a=(e.getShaderInfoLog(t)||"").trim();if(i&&a==="")return"";let r=/ERROR: 0:(\d+)/.exec(a);if(r){let o=parseInt(r[1]);return n.toUpperCase()+`

`+a+`

`+h2(e.getShaderSource(t),o)}else return a}function d2(e,t){let n=f2(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,"}"].join(`
`)}var p2={[Yg]:"Linear",[Zg]:"Reinhard",[Jg]:"Cineon",[Kg]:"ACESFilmic",[Qg]:"AgX",[$g]:"Neutral",[jg]:"Custom"};function m2(e,t){let n=p2[t];return n===void 0?(Ot("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+e+"( vec3 color ) { return "+n+"ToneMapping( color ); }"}var ud=new U;function g2(){ee.getLuminanceCoefficients(ud);let e=ud.x.toFixed(4),t=ud.y.toFixed(4),n=ud.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${t}, ${n} );`,"	return dot( weights, rgb );","}"].join(`
`)}function _2(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(yc).join(`
`)}function v2(e){let t=[];for(let n in e){let i=e[n];i!==!1&&t.push("#define "+n+" "+i)}return t.join(`
`)}function y2(e,t){let n={},i=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let s=0;s<i;s++){let a=e.getActiveAttrib(t,s),r=a.name,o=1;a.type===e.FLOAT_MAT2&&(o=2),a.type===e.FLOAT_MAT3&&(o=3),a.type===e.FLOAT_MAT4&&(o=4),n[r]={type:a.type,location:e.getAttribLocation(t,r),locationSize:o}}return n}function yc(e){return e!==""}function aM(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function rM(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var x2=/^[ \t]*#include +<([\w\d./]+)>/gm;function A0(e){return e.replace(x2,S2)}var b2=new Map;function S2(e,t){let n=Wt[t];if(n===void 0){let i=b2.get(t);if(i!==void 0)n=Wt[i],Ot('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return A0(n)}var M2=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function oM(e){return e.replace(M2,E2)}function E2(e,t,n,i){let s="";for(let a=parseInt(t);a<parseInt(n);a++)s+=i.replace(/\[\s*i\s*\]/g,"[ "+a+" ]").replace(/UNROLLED_LOOP_INDEX/g,a);return s}function lM(e){let t=`precision ${e.precision} float;
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
#define LOW_PRECISION`),t}var T2={[oc]:"SHADOWMAP_TYPE_PCF",[xo]:"SHADOWMAP_TYPE_VSM"};function A2(e){return T2[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var w2={[ya]:"ENVMAP_TYPE_CUBE",[nr]:"ENVMAP_TYPE_CUBE",[lc]:"ENVMAP_TYPE_CUBE_UV"};function C2(e){return e.envMap===!1?"ENVMAP_TYPE_CUBE":w2[e.envMapMode]||"ENVMAP_TYPE_CUBE"}var R2={[nr]:"ENVMAP_MODE_REFRACTION"};function D2(e){return e.envMap===!1?"ENVMAP_MODE_REFLECTION":R2[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}var N2={[qg]:"ENVMAP_BLENDING_MULTIPLY",[wS]:"ENVMAP_BLENDING_MIX",[CS]:"ENVMAP_BLENDING_ADD"};function U2(e){return e.envMap===!1?"ENVMAP_BLENDING_NONE":N2[e.combine]||"ENVMAP_BLENDING_NONE"}function L2(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,n),7*16)),texelHeight:i,maxMip:n}}function I2(e,t,n,i){let s=e.getContext(),a=n.defines,r=n.vertexShader,o=n.fragmentShader,c=A2(n),l=C2(n),h=D2(n),p=U2(n),u=L2(n),d=_2(n),m=v2(a),S=s.createProgram(),g,f,_=n.glslVersion?"#version "+n.glslVersion+`
`:"";n.isRawShaderMaterial?(g=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,m].filter(yc).join(`
`),g.length>0&&(g+=`
`),f=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,m].filter(yc).join(`
`),f.length>0&&(f+=`
`)):(g=[lM(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,m,n.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",n.batching?"#define USE_BATCHING":"",n.batchingColor?"#define USE_BATCHING_COLOR":"",n.instancing?"#define USE_INSTANCING":"",n.instancingColor?"#define USE_INSTANCING_COLOR":"",n.instancingMorph?"#define USE_INSTANCING_MORPH":"",n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.map?"#define USE_MAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+h:"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.displacementMap?"#define USE_DISPLACEMENTMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.mapUv?"#define MAP_UV "+n.mapUv:"",n.alphaMapUv?"#define ALPHAMAP_UV "+n.alphaMapUv:"",n.lightMapUv?"#define LIGHTMAP_UV "+n.lightMapUv:"",n.aoMapUv?"#define AOMAP_UV "+n.aoMapUv:"",n.emissiveMapUv?"#define EMISSIVEMAP_UV "+n.emissiveMapUv:"",n.bumpMapUv?"#define BUMPMAP_UV "+n.bumpMapUv:"",n.normalMapUv?"#define NORMALMAP_UV "+n.normalMapUv:"",n.displacementMapUv?"#define DISPLACEMENTMAP_UV "+n.displacementMapUv:"",n.metalnessMapUv?"#define METALNESSMAP_UV "+n.metalnessMapUv:"",n.roughnessMapUv?"#define ROUGHNESSMAP_UV "+n.roughnessMapUv:"",n.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+n.anisotropyMapUv:"",n.clearcoatMapUv?"#define CLEARCOATMAP_UV "+n.clearcoatMapUv:"",n.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+n.clearcoatNormalMapUv:"",n.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+n.clearcoatRoughnessMapUv:"",n.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+n.iridescenceMapUv:"",n.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+n.iridescenceThicknessMapUv:"",n.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+n.sheenColorMapUv:"",n.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+n.sheenRoughnessMapUv:"",n.specularMapUv?"#define SPECULARMAP_UV "+n.specularMapUv:"",n.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+n.specularColorMapUv:"",n.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+n.specularIntensityMapUv:"",n.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+n.transmissionMapUv:"",n.thicknessMapUv?"#define THICKNESSMAP_UV "+n.thicknessMapUv:"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexNormals?"#define HAS_NORMAL":"",n.vertexColors?"#define USE_COLOR":"",n.vertexAlphas?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.flatShading?"#define FLAT_SHADED":"",n.skinning?"#define USE_SKINNING":"",n.morphTargets?"#define USE_MORPHTARGETS":"",n.morphNormals&&n.flatShading===!1?"#define USE_MORPHNORMALS":"",n.morphColors?"#define USE_MORPHCOLORS":"",n.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+n.morphTextureStride:"",n.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+n.morphTargetsCount:"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+c:"",n.sizeAttenuation?"#define USE_SIZEATTENUATION":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(yc).join(`
`),f=[lM(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,m,n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",n.map?"#define USE_MAP":"",n.matcap?"#define USE_MATCAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+l:"",n.envMap?"#define "+h:"",n.envMap?"#define "+p:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoat?"#define USE_CLEARCOAT":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.dispersion?"#define USE_DISPERSION":"",n.iridescence?"#define USE_IRIDESCENCE":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaTest?"#define USE_ALPHATEST":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.sheen?"#define USE_SHEEN":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexColors||n.instancingColor?"#define USE_COLOR":"",n.vertexAlphas||n.batchingColor?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.gradientMap?"#define USE_GRADIENTMAP":"",n.flatShading?"#define FLAT_SHADED":"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+c:"",n.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",n.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",n.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",n.toneMapping!==Ti?"#define TONE_MAPPING":"",n.toneMapping!==Ti?Wt.tonemapping_pars_fragment:"",n.toneMapping!==Ti?m2("toneMapping",n.toneMapping):"",n.dithering?"#define DITHERING":"",n.opaque?"#define OPAQUE":"",Wt.colorspace_pars_fragment,d2("linearToOutputTexel",n.outputColorSpace),g2(),n.useDepthPacking?"#define DEPTH_PACKING "+n.depthPacking:"",`
`].filter(yc).join(`
`)),r=A0(r),r=aM(r,n),r=rM(r,n),o=A0(o),o=aM(o,n),o=rM(o,n),r=oM(r),o=oM(o),n.isRawShaderMaterial!==!0&&(_=`#version 300 es
`,g=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,f=["#define varying in",n.glslVersion===c0?"":"layout(location = 0) out highp vec4 pc_fragColor;",n.glslVersion===c0?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);let x=_+g+r,v=_+f+o,T=nM(s,s.VERTEX_SHADER,x),A=nM(s,s.FRAGMENT_SHADER,v);s.attachShader(S,T),s.attachShader(S,A),n.index0AttributeName!==void 0?s.bindAttribLocation(S,0,n.index0AttributeName):n.hasPositionAttribute===!0&&s.bindAttribLocation(S,0,"position"),s.linkProgram(S);function w(D){if(e.debug.checkShaderErrors){let L=s.getProgramInfoLog(S)||"",P=s.getShaderInfoLog(T)||"",W=s.getShaderInfoLog(A)||"",B=L.trim(),q=P.trim(),X=W.trim(),et=!0,at=!0;if(s.getProgramParameter(S,s.LINK_STATUS)===!1)if(et=!1,typeof e.debug.onShaderError=="function")e.debug.onShaderError(s,S,T,A);else{let ut=sM(s,T,"vertex"),pt=sM(s,A,"fragment");zt("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(S,s.VALIDATE_STATUS)+`

Material Name: `+D.name+`
Material Type: `+D.type+`

Program Info Log: `+B+`
`+ut+`
`+pt)}else B!==""?Ot("WebGLProgram: Program Info Log:",B):(q===""||X==="")&&(at=!1);at&&(D.diagnostics={runnable:et,programLog:B,vertexShader:{log:q,prefix:g},fragmentShader:{log:X,prefix:f}})}s.deleteShader(T),s.deleteShader(A),y=new Eo(s,S),M=y2(s,S)}let y;this.getUniforms=function(){return y===void 0&&w(this),y};let M;this.getAttributes=function(){return M===void 0&&w(this),M};let C=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return C===!1&&(C=s.getProgramParameter(S,c2)),C},this.destroy=function(){i.releaseStatesOfProgram(this),s.deleteProgram(S),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=u2++,this.cacheKey=t,this.usedTimes=1,this.program=S,this.vertexShader=T,this.fragmentShader=A,this}var O2=0,w0=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,n,i){let s=this._getShaderCacheForMaterial(t);return s.has(n)===!1&&(s.add(n),n.usedTimes++),s.has(i)===!1&&(s.add(i),i.usedTimes++),this}remove(t){let n=this.materialCache.get(t);for(let i of n)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let n=this.materialCache,i=n.get(t);return i===void 0&&(i=new Set,n.set(t,i)),i}_getShaderStage(t){let n=this.shaderCache,i=n.get(t);return i===void 0&&(i=new C0(t),n.set(t,i)),i}},C0=class{constructor(t){this.id=O2++,this.code=t,this.usedTimes=0}};function P2(e){return e===Sa||e===pc||e===mc}function z2(e,t,n,i,s,a){let r=new kl,o=new w0,c=new Set,l=[],h=new Map,p=i.logarithmicDepthBuffer,u=i.precision,d={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function m(y){return c.add(y),y===0?"uv":`uv${y}`}function S(y,M,C,D,L,P){let W=D.fog,B=L.geometry,q=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?D.environment:null,X=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap,et=t.get(y.envMap||q,X),at=et&&et.mapping===lc?et.image.height:null,ut=d[y.type];y.precision!==null&&(u=i.getMaxPrecision(y.precision),u!==y.precision&&Ot("WebGLProgram.getParameters:",y.precision,"not supported, using",u,"instead."));let pt=B.morphAttributes.position||B.morphAttributes.normal||B.morphAttributes.color,bt=pt!==void 0?pt.length:0,Zt=0;B.morphAttributes.position!==void 0&&(Zt=1),B.morphAttributes.normal!==void 0&&(Zt=2),B.morphAttributes.color!==void 0&&(Zt=3);let ce,$t,Q,ft;if(ut){let At=ji[ut];ce=At.vertexShader,$t=At.fragmentShader}else{ce=y.vertexShader,$t=y.fragmentShader;let At=o.getVertexShaderStage(y),Ae=o.getFragmentShaderStage(y);o.update(y,At,Ae),Q=At.id,ft=Ae.id}let rt=e.getRenderTarget(),mt=e.state.buffers.depth.getReversed(),St=L.isInstancedMesh===!0,wt=L.isBatchedMesh===!0,Yt=!!y.map,Ut=!!y.matcap,Vt=!!et,Ft=!!y.aoMap,Pt=!!y.lightMap,Ee=!!y.bumpMap&&y.wireframe===!1,ae=!!y.normalMap,Ue=!!y.displacementMap,ze=!!y.emissiveMap,ye=!!y.metalnessMap,Te=!!y.roughnessMap,O=y.anisotropy>0,pn=y.clearcoat>0,re=y.dispersion>0,R=y.iridescence>0,b=y.sheen>0,F=y.transmission>0,k=O&&!!y.anisotropyMap,Z=pn&&!!y.clearcoatMap,ct=pn&&!!y.clearcoatNormalMap,_t=pn&&!!y.clearcoatRoughnessMap,K=R&&!!y.iridescenceMap,nt=R&&!!y.iridescenceThicknessMap,gt=b&&!!y.sheenColorMap,Ct=b&&!!y.sheenRoughnessMap,dt=!!y.specularMap,ht=!!y.specularColorMap,Rt=!!y.specularIntensityMap,I=F&&!!y.transmissionMap,tt=F&&!!y.thicknessMap,N=!!y.gradientMap,j=!!y.alphaMap,V=y.alphaTest>0,ot=!!y.alphaHash,lt=!!y.extensions,$=Ti;y.toneMapped&&(rt===null||rt.isXRRenderTarget===!0)&&($=e.toneMapping);let Tt={shaderID:ut,shaderType:y.type,shaderName:y.name,vertexShader:ce,fragmentShader:$t,defines:y.defines,customVertexShaderID:Q,customFragmentShaderID:ft,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:u,batching:wt,batchingColor:wt&&L._colorsTexture!==null,instancing:St,instancingColor:St&&L.instanceColor!==null,instancingMorph:St&&L.morphTexture!==null,outputColorSpace:rt===null?e.outputColorSpace:rt.isXRRenderTarget===!0?rt.texture.colorSpace:ee.workingColorSpace,alphaToCoverage:!!y.alphaToCoverage,map:Yt,matcap:Ut,envMap:Vt,envMapMode:Vt&&et.mapping,envMapCubeUVHeight:at,aoMap:Ft,lightMap:Pt,bumpMap:Ee,normalMap:ae,displacementMap:Ue,emissiveMap:ze,normalMapObjectSpace:ae&&y.normalMapType===NS,normalMapTangentSpace:ae&&y.normalMapType===l0,packedNormalMap:ae&&y.normalMapType===l0&&P2(y.normalMap.format),metalnessMap:ye,roughnessMap:Te,anisotropy:O,anisotropyMap:k,clearcoat:pn,clearcoatMap:Z,clearcoatNormalMap:ct,clearcoatRoughnessMap:_t,dispersion:re,iridescence:R,iridescenceMap:K,iridescenceThicknessMap:nt,sheen:b,sheenColorMap:gt,sheenRoughnessMap:Ct,specularMap:dt,specularColorMap:ht,specularIntensityMap:Rt,transmission:F,transmissionMap:I,thicknessMap:tt,gradientMap:N,opaque:y.transparent===!1&&y.blending===Qa&&y.alphaToCoverage===!1,alphaMap:j,alphaTest:V,alphaHash:ot,combine:y.combine,mapUv:Yt&&m(y.map.channel),aoMapUv:Ft&&m(y.aoMap.channel),lightMapUv:Pt&&m(y.lightMap.channel),bumpMapUv:Ee&&m(y.bumpMap.channel),normalMapUv:ae&&m(y.normalMap.channel),displacementMapUv:Ue&&m(y.displacementMap.channel),emissiveMapUv:ze&&m(y.emissiveMap.channel),metalnessMapUv:ye&&m(y.metalnessMap.channel),roughnessMapUv:Te&&m(y.roughnessMap.channel),anisotropyMapUv:k&&m(y.anisotropyMap.channel),clearcoatMapUv:Z&&m(y.clearcoatMap.channel),clearcoatNormalMapUv:ct&&m(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:_t&&m(y.clearcoatRoughnessMap.channel),iridescenceMapUv:K&&m(y.iridescenceMap.channel),iridescenceThicknessMapUv:nt&&m(y.iridescenceThicknessMap.channel),sheenColorMapUv:gt&&m(y.sheenColorMap.channel),sheenRoughnessMapUv:Ct&&m(y.sheenRoughnessMap.channel),specularMapUv:dt&&m(y.specularMap.channel),specularColorMapUv:ht&&m(y.specularColorMap.channel),specularIntensityMapUv:Rt&&m(y.specularIntensityMap.channel),transmissionMapUv:I&&m(y.transmissionMap.channel),thicknessMapUv:tt&&m(y.thicknessMap.channel),alphaMapUv:j&&m(y.alphaMap.channel),vertexTangents:!!B.attributes.tangent&&(ae||O),vertexNormals:!!B.attributes.normal,vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!B.attributes.color&&B.attributes.color.itemSize===4,pointsUvs:L.isPoints===!0&&!!B.attributes.uv&&(Yt||j),fog:!!W,useFog:y.fog===!0,fogExp2:!!W&&W.isFogExp2,flatShading:y.wireframe===!1&&(y.flatShading===!0||B.attributes.normal===void 0&&ae===!1&&(y.isMeshLambertMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isMeshPhysicalMaterial)),sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:p,reversedDepthBuffer:mt,skinning:L.isSkinnedMesh===!0,hasPositionAttribute:B.attributes.position!==void 0,morphTargets:B.morphAttributes.position!==void 0,morphNormals:B.morphAttributes.normal!==void 0,morphColors:B.morphAttributes.color!==void 0,morphTargetsCount:bt,morphTextureStride:Zt,numDirLights:M.directional.length,numPointLights:M.point.length,numSpotLights:M.spot.length,numSpotLightMaps:M.spotLightMap.length,numRectAreaLights:M.rectArea.length,numHemiLights:M.hemi.length,numDirLightShadows:M.directionalShadowMap.length,numPointLightShadows:M.pointShadowMap.length,numSpotLightShadows:M.spotShadowMap.length,numSpotLightShadowsWithMaps:M.numSpotLightShadowsWithMaps,numLightProbes:M.numLightProbes,numLightProbeGrids:P.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:y.dithering,shadowMapEnabled:e.shadowMap.enabled&&C.length>0,shadowMapType:e.shadowMap.type,toneMapping:$,decodeVideoTexture:Yt&&y.map.isVideoTexture===!0&&ee.getTransfer(y.map.colorSpace)===ue,decodeVideoTextureEmissive:ze&&y.emissiveMap.isVideoTexture===!0&&ee.getTransfer(y.emissiveMap.colorSpace)===ue,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===ti,flipSided:y.side===An,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:lt&&y.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(lt&&y.extensions.multiDraw===!0||wt)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return Tt.vertexUv1s=c.has(1),Tt.vertexUv2s=c.has(2),Tt.vertexUv3s=c.has(3),c.clear(),Tt}function g(y){let M=[];if(y.shaderID?M.push(y.shaderID):(M.push(y.customVertexShaderID),M.push(y.customFragmentShaderID)),y.defines!==void 0)for(let C in y.defines)M.push(C),M.push(y.defines[C]);return y.isRawShaderMaterial===!1&&(f(M,y),_(M,y),M.push(e.outputColorSpace)),M.push(y.customProgramCacheKey),M.join()}function f(y,M){y.push(M.precision),y.push(M.outputColorSpace),y.push(M.envMapMode),y.push(M.envMapCubeUVHeight),y.push(M.mapUv),y.push(M.alphaMapUv),y.push(M.lightMapUv),y.push(M.aoMapUv),y.push(M.bumpMapUv),y.push(M.normalMapUv),y.push(M.displacementMapUv),y.push(M.emissiveMapUv),y.push(M.metalnessMapUv),y.push(M.roughnessMapUv),y.push(M.anisotropyMapUv),y.push(M.clearcoatMapUv),y.push(M.clearcoatNormalMapUv),y.push(M.clearcoatRoughnessMapUv),y.push(M.iridescenceMapUv),y.push(M.iridescenceThicknessMapUv),y.push(M.sheenColorMapUv),y.push(M.sheenRoughnessMapUv),y.push(M.specularMapUv),y.push(M.specularColorMapUv),y.push(M.specularIntensityMapUv),y.push(M.transmissionMapUv),y.push(M.thicknessMapUv),y.push(M.combine),y.push(M.fogExp2),y.push(M.sizeAttenuation),y.push(M.morphTargetsCount),y.push(M.morphAttributeCount),y.push(M.numDirLights),y.push(M.numPointLights),y.push(M.numSpotLights),y.push(M.numSpotLightMaps),y.push(M.numHemiLights),y.push(M.numRectAreaLights),y.push(M.numDirLightShadows),y.push(M.numPointLightShadows),y.push(M.numSpotLightShadows),y.push(M.numSpotLightShadowsWithMaps),y.push(M.numLightProbes),y.push(M.shadowMapType),y.push(M.toneMapping),y.push(M.numClippingPlanes),y.push(M.numClipIntersection),y.push(M.depthPacking)}function _(y,M){r.disableAll(),M.instancing&&r.enable(0),M.instancingColor&&r.enable(1),M.instancingMorph&&r.enable(2),M.matcap&&r.enable(3),M.envMap&&r.enable(4),M.normalMapObjectSpace&&r.enable(5),M.normalMapTangentSpace&&r.enable(6),M.clearcoat&&r.enable(7),M.iridescence&&r.enable(8),M.alphaTest&&r.enable(9),M.vertexColors&&r.enable(10),M.vertexAlphas&&r.enable(11),M.vertexUv1s&&r.enable(12),M.vertexUv2s&&r.enable(13),M.vertexUv3s&&r.enable(14),M.vertexTangents&&r.enable(15),M.anisotropy&&r.enable(16),M.alphaHash&&r.enable(17),M.batching&&r.enable(18),M.dispersion&&r.enable(19),M.batchingColor&&r.enable(20),M.gradientMap&&r.enable(21),M.packedNormalMap&&r.enable(22),M.vertexNormals&&r.enable(23),y.push(r.mask),r.disableAll(),M.fog&&r.enable(0),M.useFog&&r.enable(1),M.flatShading&&r.enable(2),M.logarithmicDepthBuffer&&r.enable(3),M.reversedDepthBuffer&&r.enable(4),M.skinning&&r.enable(5),M.morphTargets&&r.enable(6),M.morphNormals&&r.enable(7),M.morphColors&&r.enable(8),M.premultipliedAlpha&&r.enable(9),M.shadowMapEnabled&&r.enable(10),M.doubleSided&&r.enable(11),M.flipSided&&r.enable(12),M.useDepthPacking&&r.enable(13),M.dithering&&r.enable(14),M.transmission&&r.enable(15),M.sheen&&r.enable(16),M.opaque&&r.enable(17),M.pointsUvs&&r.enable(18),M.decodeVideoTexture&&r.enable(19),M.decodeVideoTextureEmissive&&r.enable(20),M.alphaToCoverage&&r.enable(21),M.numLightProbeGrids>0&&r.enable(22),M.hasPositionAttribute&&r.enable(23),y.push(r.mask)}function x(y){let M=d[y.type],C;if(M){let D=ji[M];C=kS.clone(D.uniforms)}else C=y.uniforms;return C}function v(y,M){let C=h.get(M);return C!==void 0?++C.usedTimes:(C=new I2(e,M,y,s),l.push(C),h.set(M,C)),C}function T(y){if(--y.usedTimes===0){let M=l.indexOf(y);l[M]=l[l.length-1],l.pop(),h.delete(y.cacheKey),y.destroy()}}function A(y){o.remove(y)}function w(){o.dispose()}return{getParameters:S,getProgramCacheKey:g,getUniforms:x,acquireProgram:v,releaseProgram:T,releaseShaderCache:A,programs:l,dispose:w}}function B2(){let e=new WeakMap;function t(r){return e.has(r)}function n(r){let o=e.get(r);return o===void 0&&(o={},e.set(r,o)),o}function i(r){e.delete(r)}function s(r,o,c){e.get(r)[o]=c}function a(){e=new WeakMap}return{has:t,get:n,remove:i,update:s,dispose:a}}function F2(e,t){return e.groupOrder!==t.groupOrder?e.groupOrder-t.groupOrder:e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.material.id!==t.material.id?e.material.id-t.material.id:e.materialVariant!==t.materialVariant?e.materialVariant-t.materialVariant:e.z!==t.z?e.z-t.z:e.id-t.id}function cM(e,t){return e.groupOrder!==t.groupOrder?e.groupOrder-t.groupOrder:e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.z!==t.z?t.z-e.z:e.id-t.id}function uM(){let e=[],t=0,n=[],i=[],s=[];function a(){t=0,n.length=0,i.length=0,s.length=0}function r(u){let d=0;return u.isInstancedMesh&&(d+=2),u.isSkinnedMesh&&(d+=1),d}function o(u,d,m,S,g,f){let _=e[t];return _===void 0?(_={id:u.id,object:u,geometry:d,material:m,materialVariant:r(u),groupOrder:S,renderOrder:u.renderOrder,z:g,group:f},e[t]=_):(_.id=u.id,_.object=u,_.geometry=d,_.material=m,_.materialVariant=r(u),_.groupOrder=S,_.renderOrder=u.renderOrder,_.z=g,_.group=f),t++,_}function c(u,d,m,S,g,f){let _=o(u,d,m,S,g,f);m.transmission>0?i.push(_):m.transparent===!0?s.push(_):n.push(_)}function l(u,d,m,S,g,f){let _=o(u,d,m,S,g,f);m.transmission>0?i.unshift(_):m.transparent===!0?s.unshift(_):n.unshift(_)}function h(u,d,m){n.length>1&&n.sort(u||F2),i.length>1&&i.sort(d||cM),s.length>1&&s.sort(d||cM),m&&(n.reverse(),i.reverse(),s.reverse())}function p(){for(let u=t,d=e.length;u<d;u++){let m=e[u];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:n,transmissive:i,transparent:s,init:a,push:c,unshift:l,finish:p,sort:h}}function V2(){let e=new WeakMap;function t(i,s){let a=e.get(i),r;return a===void 0?(r=new uM,e.set(i,[r])):s>=a.length?(r=new uM,a.push(r)):r=a[s],r}function n(){e=new WeakMap}return{get:t,dispose:n}}function H2(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"DirectionalLight":n={direction:new U,color:new Qt};break;case"SpotLight":n={position:new U,direction:new U,color:new Qt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":n={position:new U,color:new Qt,distance:0,decay:0};break;case"HemisphereLight":n={direction:new U,skyColor:new Qt,groundColor:new Qt};break;case"RectAreaLight":n={color:new Qt,position:new U,halfWidth:new U,halfHeight:new U};break}return e[t.id]=n,n}}}function G2(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"DirectionalLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new It};break;case"SpotLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new It};break;case"PointLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new It,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[t.id]=n,n}}}var k2=0;function X2(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+(t.map?1:0)-(e.map?1:0)}function W2(e){let t=new H2,n=G2(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)i.probe.push(new U);let s=new U,a=new Oe,r=new Oe;function o(l){let h=0,p=0,u=0;for(let M=0;M<9;M++)i.probe[M].set(0,0,0);let d=0,m=0,S=0,g=0,f=0,_=0,x=0,v=0,T=0,A=0,w=0;l.sort(X2);for(let M=0,C=l.length;M<C;M++){let D=l[M],L=D.color,P=D.intensity,W=D.distance,B=null;if(D.shadow&&D.shadow.map&&(D.shadow.map.texture.format===Sa?B=D.shadow.map.texture:B=D.shadow.map.depthTexture||D.shadow.map.texture),D.isAmbientLight)h+=L.r*P,p+=L.g*P,u+=L.b*P;else if(D.isLightProbe){for(let q=0;q<9;q++)i.probe[q].addScaledVector(D.sh.coefficients[q],P);w++}else if(D.isDirectionalLight){let q=t.get(D);if(q.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){let X=D.shadow,et=n.get(D);et.shadowIntensity=X.intensity,et.shadowBias=X.bias,et.shadowNormalBias=X.normalBias,et.shadowRadius=X.radius,et.shadowMapSize=X.mapSize,i.directionalShadow[d]=et,i.directionalShadowMap[d]=B,i.directionalShadowMatrix[d]=D.shadow.matrix,_++}i.directional[d]=q,d++}else if(D.isSpotLight){let q=t.get(D);q.position.setFromMatrixPosition(D.matrixWorld),q.color.copy(L).multiplyScalar(P),q.distance=W,q.coneCos=Math.cos(D.angle),q.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),q.decay=D.decay,i.spot[S]=q;let X=D.shadow;if(D.map&&(i.spotLightMap[T]=D.map,T++,X.updateMatrices(D),D.castShadow&&A++),i.spotLightMatrix[S]=X.matrix,D.castShadow){let et=n.get(D);et.shadowIntensity=X.intensity,et.shadowBias=X.bias,et.shadowNormalBias=X.normalBias,et.shadowRadius=X.radius,et.shadowMapSize=X.mapSize,i.spotShadow[S]=et,i.spotShadowMap[S]=B,v++}S++}else if(D.isRectAreaLight){let q=t.get(D);q.color.copy(L).multiplyScalar(P),q.halfWidth.set(D.width*.5,0,0),q.halfHeight.set(0,D.height*.5,0),i.rectArea[g]=q,g++}else if(D.isPointLight){let q=t.get(D);if(q.color.copy(D.color).multiplyScalar(D.intensity),q.distance=D.distance,q.decay=D.decay,D.castShadow){let X=D.shadow,et=n.get(D);et.shadowIntensity=X.intensity,et.shadowBias=X.bias,et.shadowNormalBias=X.normalBias,et.shadowRadius=X.radius,et.shadowMapSize=X.mapSize,et.shadowCameraNear=X.camera.near,et.shadowCameraFar=X.camera.far,i.pointShadow[m]=et,i.pointShadowMap[m]=B,i.pointShadowMatrix[m]=D.shadow.matrix,x++}i.point[m]=q,m++}else if(D.isHemisphereLight){let q=t.get(D);q.skyColor.copy(D.color).multiplyScalar(P),q.groundColor.copy(D.groundColor).multiplyScalar(P),i.hemi[f]=q,f++}}g>0&&(e.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=vt.LTC_FLOAT_1,i.rectAreaLTC2=vt.LTC_FLOAT_2):(i.rectAreaLTC1=vt.LTC_HALF_1,i.rectAreaLTC2=vt.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=p,i.ambient[2]=u;let y=i.hash;(y.directionalLength!==d||y.pointLength!==m||y.spotLength!==S||y.rectAreaLength!==g||y.hemiLength!==f||y.numDirectionalShadows!==_||y.numPointShadows!==x||y.numSpotShadows!==v||y.numSpotMaps!==T||y.numLightProbes!==w)&&(i.directional.length=d,i.spot.length=S,i.rectArea.length=g,i.point.length=m,i.hemi.length=f,i.directionalShadow.length=_,i.directionalShadowMap.length=_,i.pointShadow.length=x,i.pointShadowMap.length=x,i.spotShadow.length=v,i.spotShadowMap.length=v,i.directionalShadowMatrix.length=_,i.pointShadowMatrix.length=x,i.spotLightMatrix.length=v+T-A,i.spotLightMap.length=T,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=w,y.directionalLength=d,y.pointLength=m,y.spotLength=S,y.rectAreaLength=g,y.hemiLength=f,y.numDirectionalShadows=_,y.numPointShadows=x,y.numSpotShadows=v,y.numSpotMaps=T,y.numLightProbes=w,i.version=k2++)}function c(l,h){let p=0,u=0,d=0,m=0,S=0,g=h.matrixWorldInverse;for(let f=0,_=l.length;f<_;f++){let x=l[f];if(x.isDirectionalLight){let v=i.directional[p];v.direction.setFromMatrixPosition(x.matrixWorld),s.setFromMatrixPosition(x.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(g),p++}else if(x.isSpotLight){let v=i.spot[d];v.position.setFromMatrixPosition(x.matrixWorld),v.position.applyMatrix4(g),v.direction.setFromMatrixPosition(x.matrixWorld),s.setFromMatrixPosition(x.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(g),d++}else if(x.isRectAreaLight){let v=i.rectArea[m];v.position.setFromMatrixPosition(x.matrixWorld),v.position.applyMatrix4(g),r.identity(),a.copy(x.matrixWorld),a.premultiply(g),r.extractRotation(a),v.halfWidth.set(x.width*.5,0,0),v.halfHeight.set(0,x.height*.5,0),v.halfWidth.applyMatrix4(r),v.halfHeight.applyMatrix4(r),m++}else if(x.isPointLight){let v=i.point[u];v.position.setFromMatrixPosition(x.matrixWorld),v.position.applyMatrix4(g),u++}else if(x.isHemisphereLight){let v=i.hemi[S];v.direction.setFromMatrixPosition(x.matrixWorld),v.direction.transformDirection(g),S++}}}return{setup:o,setupView:c,state:i}}function hM(e){let t=new W2(e),n=[],i=[],s=[];function a(u){p.camera=u,n.length=0,i.length=0,s.length=0}function r(u){n.push(u)}function o(u){i.push(u)}function c(u){s.push(u)}function l(){t.setup(n)}function h(u){t.setupView(n,u)}let p={lightsArray:n,shadowsArray:i,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:p,setupLights:l,setupLightsView:h,pushLight:r,pushShadow:o,pushLightProbeGrid:c}}function q2(e){let t=new WeakMap;function n(s,a=0){let r=t.get(s),o;return r===void 0?(o=new hM(e),t.set(s,[o])):a>=r.length?(o=new hM(e),r.push(o)):o=r[a],o}function i(){t=new WeakMap}return{get:n,dispose:i}}var Y2=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Z2=`uniform sampler2D shadow_pass;
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
}`,J2=[new U(1,0,0),new U(-1,0,0),new U(0,1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1)],K2=[new U(0,-1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1),new U(0,-1,0),new U(0,-1,0)],fM=new Oe,vc=new U,b0=new U;function j2(e,t,n){let i=new Jl,s=new It,a=new It,r=new Pe,o=new of,c=new lf,l={},h=n.maxTextureSize,p={[Ts]:An,[An]:Ts,[ti]:ti},u=new Qn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new It},radius:{value:4}},vertexShader:Y2,fragmentShader:Z2}),d=u.clone();d.defines.HORIZONTAL_PASS=1;let m=new He;m.setAttribute("position",new Jn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let S=new je(m,u),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=oc;let f=this.type;this.render=function(A,w,y){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||A.length===0)return;this.type===lS&&(Ot("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=oc);let M=e.getRenderTarget(),C=e.getActiveCubeFace(),D=e.getActiveMipmapLevel(),L=e.state;L.setBlending(Zi),L.buffers.depth.getReversed()===!0?L.buffers.color.setClear(0,0,0,0):L.buffers.color.setClear(1,1,1,1),L.buffers.depth.setTest(!0),L.setScissorTest(!1);let P=f!==this.type;P&&w.traverse(function(W){W.material&&(Array.isArray(W.material)?W.material.forEach(B=>B.needsUpdate=!0):W.material.needsUpdate=!0)});for(let W=0,B=A.length;W<B;W++){let q=A[W],X=q.shadow;if(X===void 0){Ot("WebGLShadowMap:",q,"has no shadow.");continue}if(X.autoUpdate===!1&&X.needsUpdate===!1)continue;s.copy(X.mapSize);let et=X.getFrameExtents();s.multiply(et),a.copy(X.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(a.x=Math.floor(h/et.x),s.x=a.x*et.x,X.mapSize.x=a.x),s.y>h&&(a.y=Math.floor(h/et.y),s.y=a.y*et.y,X.mapSize.y=a.y));let at=e.state.buffers.depth.getReversed();if(X.camera._reversedDepth=at,X.map===null||P===!0){if(X.map!==null&&(X.map.depthTexture!==null&&(X.map.depthTexture.dispose(),X.map.depthTexture=null),X.map.dispose()),this.type===xo){if(q.isPointLight){Ot("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}X.map=new Kn(s.x,s.y,{format:Sa,type:Ji,minFilter:dn,magFilter:dn,generateMipmaps:!1}),X.map.texture.name=q.name+".shadowMap",X.map.depthTexture=new As(s.x,s.y,wi),X.map.depthTexture.name=q.name+".shadowMapDepth",X.map.depthTexture.format=ki,X.map.depthTexture.compareFunction=null,X.map.depthTexture.minFilter=on,X.map.depthTexture.magFilter=on}else q.isPointLight?(X.map=new fd(s.x),X.map.depthTexture=new Kh(s.x,Ai)):(X.map=new Kn(s.x,s.y),X.map.depthTexture=new As(s.x,s.y,Ai)),X.map.depthTexture.name=q.name+".shadowMap",X.map.depthTexture.format=ki,this.type===oc?(X.map.depthTexture.compareFunction=at?ld:od,X.map.depthTexture.minFilter=dn,X.map.depthTexture.magFilter=dn):(X.map.depthTexture.compareFunction=null,X.map.depthTexture.minFilter=on,X.map.depthTexture.magFilter=on);X.camera.updateProjectionMatrix()}let ut=X.map.isWebGLCubeRenderTarget?6:1;for(let pt=0;pt<ut;pt++){if(X.map.isWebGLCubeRenderTarget)e.setRenderTarget(X.map,pt),e.clear();else{pt===0&&(e.setRenderTarget(X.map),e.clear());let bt=X.getViewport(pt);r.set(a.x*bt.x,a.y*bt.y,a.x*bt.z,a.y*bt.w),L.viewport(r)}if(q.isPointLight){let bt=X.camera,Zt=X.matrix,ce=q.distance||bt.far;ce!==bt.far&&(bt.far=ce,bt.updateProjectionMatrix()),vc.setFromMatrixPosition(q.matrixWorld),bt.position.copy(vc),b0.copy(bt.position),b0.add(J2[pt]),bt.up.copy(K2[pt]),bt.lookAt(b0),bt.updateMatrixWorld(),Zt.makeTranslation(-vc.x,-vc.y,-vc.z),fM.multiplyMatrices(bt.projectionMatrix,bt.matrixWorldInverse),X._frustum.setFromProjectionMatrix(fM,bt.coordinateSystem,bt.reversedDepth)}else X.updateMatrices(q);i=X.getFrustum(),v(w,y,X.camera,q,this.type)}X.isPointLightShadow!==!0&&this.type===xo&&_(X,y),X.needsUpdate=!1}f=this.type,g.needsUpdate=!1,e.setRenderTarget(M,C,D)};function _(A,w){let y=t.update(S);u.defines.VSM_SAMPLES!==A.blurSamples&&(u.defines.VSM_SAMPLES=A.blurSamples,d.defines.VSM_SAMPLES=A.blurSamples,u.needsUpdate=!0,d.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new Kn(s.x,s.y,{format:Sa,type:Ji})),u.uniforms.shadow_pass.value=A.map.depthTexture,u.uniforms.resolution.value=A.mapSize,u.uniforms.radius.value=A.radius,e.setRenderTarget(A.mapPass),e.clear(),e.renderBufferDirect(w,null,y,u,S,null),d.uniforms.shadow_pass.value=A.mapPass.texture,d.uniforms.resolution.value=A.mapSize,d.uniforms.radius.value=A.radius,e.setRenderTarget(A.map),e.clear(),e.renderBufferDirect(w,null,y,d,S,null)}function x(A,w,y,M){let C=null,D=y.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(D!==void 0)C=D;else if(C=y.isPointLight===!0?c:o,e.localClippingEnabled&&w.clipShadows===!0&&Array.isArray(w.clippingPlanes)&&w.clippingPlanes.length!==0||w.displacementMap&&w.displacementScale!==0||w.alphaMap&&w.alphaTest>0||w.map&&w.alphaTest>0||w.alphaToCoverage===!0){let L=C.uuid,P=w.uuid,W=l[L];W===void 0&&(W={},l[L]=W);let B=W[P];B===void 0&&(B=C.clone(),W[P]=B,w.addEventListener("dispose",T)),C=B}if(C.visible=w.visible,C.wireframe=w.wireframe,M===xo?C.side=w.shadowSide!==null?w.shadowSide:w.side:C.side=w.shadowSide!==null?w.shadowSide:p[w.side],C.alphaMap=w.alphaMap,C.alphaTest=w.alphaToCoverage===!0?.5:w.alphaTest,C.map=w.map,C.clipShadows=w.clipShadows,C.clippingPlanes=w.clippingPlanes,C.clipIntersection=w.clipIntersection,C.displacementMap=w.displacementMap,C.displacementScale=w.displacementScale,C.displacementBias=w.displacementBias,C.wireframeLinewidth=w.wireframeLinewidth,C.linewidth=w.linewidth,y.isPointLight===!0&&C.isMeshDistanceMaterial===!0){let L=e.properties.get(C);L.light=y}return C}function v(A,w,y,M,C){if(A.visible===!1)return;if(A.layers.test(w.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&C===xo)&&(!A.frustumCulled||i.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(y.matrixWorldInverse,A.matrixWorld);let P=t.update(A),W=A.material;if(Array.isArray(W)){let B=P.groups;for(let q=0,X=B.length;q<X;q++){let et=B[q],at=W[et.materialIndex];if(at&&at.visible){let ut=x(A,at,M,C);A.onBeforeShadow(e,A,w,y,P,ut,et),e.renderBufferDirect(y,null,P,ut,A,et),A.onAfterShadow(e,A,w,y,P,ut,et)}}}else if(W.visible){let B=x(A,W,M,C);A.onBeforeShadow(e,A,w,y,P,B,null),e.renderBufferDirect(y,null,P,B,A,null),A.onAfterShadow(e,A,w,y,P,B,null)}}let L=A.children;for(let P=0,W=L.length;P<W;P++)v(L[P],w,y,M,C)}function T(A){A.target.removeEventListener("dispose",T);for(let y in l){let M=l[y],C=A.target.uuid;C in M&&(M[C].dispose(),delete M[C])}}}function Q2(e,t){function n(){let N=!1,j=new Pe,V=null,ot=new Pe(0,0,0,0);return{setMask:function(lt){V!==lt&&!N&&(e.colorMask(lt,lt,lt,lt),V=lt)},setLocked:function(lt){N=lt},setClear:function(lt,$,Tt,At,Ae){Ae===!0&&(lt*=At,$*=At,Tt*=At),j.set(lt,$,Tt,At),ot.equals(j)===!1&&(e.clearColor(lt,$,Tt,At),ot.copy(j))},reset:function(){N=!1,V=null,ot.set(-1,0,0,0)}}}function i(){let N=!1,j=!1,V=null,ot=null,lt=null;return{setReversed:function($){if(j!==$){let Tt=t.get("EXT_clip_control");$?Tt.clipControlEXT(Tt.LOWER_LEFT_EXT,Tt.ZERO_TO_ONE_EXT):Tt.clipControlEXT(Tt.LOWER_LEFT_EXT,Tt.NEGATIVE_ONE_TO_ONE_EXT),j=$;let At=lt;lt=null,this.setClear(At)}},getReversed:function(){return j},setTest:function($){$?rt(e.DEPTH_TEST):mt(e.DEPTH_TEST)},setMask:function($){V!==$&&!N&&(e.depthMask($),V=$)},setFunc:function($){if(j&&($=HS[$]),ot!==$){switch($){case Lh:e.depthFunc(e.NEVER);break;case Ih:e.depthFunc(e.ALWAYS);break;case Oh:e.depthFunc(e.LESS);break;case $a:e.depthFunc(e.LEQUAL);break;case Ph:e.depthFunc(e.EQUAL);break;case zh:e.depthFunc(e.GEQUAL);break;case Bh:e.depthFunc(e.GREATER);break;case Fh:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}ot=$}},setLocked:function($){N=$},setClear:function($){lt!==$&&(lt=$,j&&($=1-$),e.clearDepth($))},reset:function(){N=!1,V=null,ot=null,lt=null,j=!1}}}function s(){let N=!1,j=null,V=null,ot=null,lt=null,$=null,Tt=null,At=null,Ae=null;return{setTest:function(xe){N||(xe?rt(e.STENCIL_TEST):mt(e.STENCIL_TEST))},setMask:function(xe){j!==xe&&!N&&(e.stencilMask(xe),j=xe)},setFunc:function(xe,Ci,Ri){(V!==xe||ot!==Ci||lt!==Ri)&&(e.stencilFunc(xe,Ci,Ri),V=xe,ot=Ci,lt=Ri)},setOp:function(xe,Ci,Ri){($!==xe||Tt!==Ci||At!==Ri)&&(e.stencilOp(xe,Ci,Ri),$=xe,Tt=Ci,At=Ri)},setLocked:function(xe){N=xe},setClear:function(xe){Ae!==xe&&(e.clearStencil(xe),Ae=xe)},reset:function(){N=!1,j=null,V=null,ot=null,lt=null,$=null,Tt=null,At=null,Ae=null}}}let a=new n,r=new i,o=new s,c=new WeakMap,l=new WeakMap,h={},p={},u={},d=new WeakMap,m=[],S=null,g=!1,f=null,_=null,x=null,v=null,T=null,A=null,w=null,y=new Qt(0,0,0),M=0,C=!1,D=null,L=null,P=null,W=null,B=null,q=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),X=!1,et=0,at=e.getParameter(e.VERSION);at.indexOf("WebGL")!==-1?(et=parseFloat(/^WebGL (\d)/.exec(at)[1]),X=et>=1):at.indexOf("OpenGL ES")!==-1&&(et=parseFloat(/^OpenGL ES (\d)/.exec(at)[1]),X=et>=2);let ut=null,pt={},bt=e.getParameter(e.SCISSOR_BOX),Zt=e.getParameter(e.VIEWPORT),ce=new Pe().fromArray(bt),$t=new Pe().fromArray(Zt);function Q(N,j,V,ot){let lt=new Uint8Array(4),$=e.createTexture();e.bindTexture(N,$),e.texParameteri(N,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(N,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let Tt=0;Tt<V;Tt++)N===e.TEXTURE_3D||N===e.TEXTURE_2D_ARRAY?e.texImage3D(j,0,e.RGBA,1,1,ot,0,e.RGBA,e.UNSIGNED_BYTE,lt):e.texImage2D(j+Tt,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,lt);return $}let ft={};ft[e.TEXTURE_2D]=Q(e.TEXTURE_2D,e.TEXTURE_2D,1),ft[e.TEXTURE_CUBE_MAP]=Q(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),ft[e.TEXTURE_2D_ARRAY]=Q(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),ft[e.TEXTURE_3D]=Q(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),r.setClear(1),o.setClear(0),rt(e.DEPTH_TEST),r.setFunc($a),Ee(!1),ae(Gg),rt(e.CULL_FACE),Ft(Zi);function rt(N){h[N]!==!0&&(e.enable(N),h[N]=!0)}function mt(N){h[N]!==!1&&(e.disable(N),h[N]=!1)}function St(N,j){return u[N]!==j?(e.bindFramebuffer(N,j),u[N]=j,N===e.DRAW_FRAMEBUFFER&&(u[e.FRAMEBUFFER]=j),N===e.FRAMEBUFFER&&(u[e.DRAW_FRAMEBUFFER]=j),!0):!1}function wt(N,j){let V=m,ot=!1;if(N){V=d.get(j),V===void 0&&(V=[],d.set(j,V));let lt=N.textures;if(V.length!==lt.length||V[0]!==e.COLOR_ATTACHMENT0){for(let $=0,Tt=lt.length;$<Tt;$++)V[$]=e.COLOR_ATTACHMENT0+$;V.length=lt.length,ot=!0}}else V[0]!==e.BACK&&(V[0]=e.BACK,ot=!0);ot&&e.drawBuffers(V)}function Yt(N){return S!==N?(e.useProgram(N),S=N,!0):!1}let Ut={[ha]:e.FUNC_ADD,[uS]:e.FUNC_SUBTRACT,[hS]:e.FUNC_REVERSE_SUBTRACT};Ut[fS]=e.MIN,Ut[dS]=e.MAX;let Vt={[pS]:e.ZERO,[mS]:e.ONE,[gS]:e.SRC_COLOR,[Nh]:e.SRC_ALPHA,[SS]:e.SRC_ALPHA_SATURATE,[xS]:e.DST_COLOR,[vS]:e.DST_ALPHA,[_S]:e.ONE_MINUS_SRC_COLOR,[Uh]:e.ONE_MINUS_SRC_ALPHA,[bS]:e.ONE_MINUS_DST_COLOR,[yS]:e.ONE_MINUS_DST_ALPHA,[MS]:e.CONSTANT_COLOR,[ES]:e.ONE_MINUS_CONSTANT_COLOR,[TS]:e.CONSTANT_ALPHA,[AS]:e.ONE_MINUS_CONSTANT_ALPHA};function Ft(N,j,V,ot,lt,$,Tt,At,Ae,xe){if(N===Zi){g===!0&&(mt(e.BLEND),g=!1);return}if(g===!1&&(rt(e.BLEND),g=!0),N!==cS){if(N!==f||xe!==C){if((_!==ha||T!==ha)&&(e.blendEquation(e.FUNC_ADD),_=ha,T=ha),xe)switch(N){case Qa:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case kg:e.blendFunc(e.ONE,e.ONE);break;case Xg:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case Wg:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:zt("WebGLState: Invalid blending: ",N);break}else switch(N){case Qa:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case kg:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case Xg:zt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Wg:zt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:zt("WebGLState: Invalid blending: ",N);break}x=null,v=null,A=null,w=null,y.set(0,0,0),M=0,f=N,C=xe}return}lt=lt||j,$=$||V,Tt=Tt||ot,(j!==_||lt!==T)&&(e.blendEquationSeparate(Ut[j],Ut[lt]),_=j,T=lt),(V!==x||ot!==v||$!==A||Tt!==w)&&(e.blendFuncSeparate(Vt[V],Vt[ot],Vt[$],Vt[Tt]),x=V,v=ot,A=$,w=Tt),(At.equals(y)===!1||Ae!==M)&&(e.blendColor(At.r,At.g,At.b,Ae),y.copy(At),M=Ae),f=N,C=!1}function Pt(N,j){N.side===ti?mt(e.CULL_FACE):rt(e.CULL_FACE);let V=N.side===An;j&&(V=!V),Ee(V),N.blending===Qa&&N.transparent===!1?Ft(Zi):Ft(N.blending,N.blendEquation,N.blendSrc,N.blendDst,N.blendEquationAlpha,N.blendSrcAlpha,N.blendDstAlpha,N.blendColor,N.blendAlpha,N.premultipliedAlpha),r.setFunc(N.depthFunc),r.setTest(N.depthTest),r.setMask(N.depthWrite),a.setMask(N.colorWrite);let ot=N.stencilWrite;o.setTest(ot),ot&&(o.setMask(N.stencilWriteMask),o.setFunc(N.stencilFunc,N.stencilRef,N.stencilFuncMask),o.setOp(N.stencilFail,N.stencilZFail,N.stencilZPass)),ze(N.polygonOffset,N.polygonOffsetFactor,N.polygonOffsetUnits),N.alphaToCoverage===!0?rt(e.SAMPLE_ALPHA_TO_COVERAGE):mt(e.SAMPLE_ALPHA_TO_COVERAGE)}function Ee(N){D!==N&&(N?e.frontFace(e.CW):e.frontFace(e.CCW),D=N)}function ae(N){N!==rS?(rt(e.CULL_FACE),N!==L&&(N===Gg?e.cullFace(e.BACK):N===oS?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))):mt(e.CULL_FACE),L=N}function Ue(N){N!==P&&(X&&e.lineWidth(N),P=N)}function ze(N,j,V){N?(rt(e.POLYGON_OFFSET_FILL),(W!==j||B!==V)&&(W=j,B=V,r.getReversed()&&(j=-j),e.polygonOffset(j,V))):mt(e.POLYGON_OFFSET_FILL)}function ye(N){N?rt(e.SCISSOR_TEST):mt(e.SCISSOR_TEST)}function Te(N){N===void 0&&(N=e.TEXTURE0+q-1),ut!==N&&(e.activeTexture(N),ut=N)}function O(N,j,V){V===void 0&&(ut===null?V=e.TEXTURE0+q-1:V=ut);let ot=pt[V];ot===void 0&&(ot={type:void 0,texture:void 0},pt[V]=ot),(ot.type!==N||ot.texture!==j)&&(ut!==V&&(e.activeTexture(V),ut=V),e.bindTexture(N,j||ft[N]),ot.type=N,ot.texture=j)}function pn(){let N=pt[ut];N!==void 0&&N.type!==void 0&&(e.bindTexture(N.type,null),N.type=void 0,N.texture=void 0)}function re(){try{e.compressedTexImage2D(...arguments)}catch(N){zt("WebGLState:",N)}}function R(){try{e.compressedTexImage3D(...arguments)}catch(N){zt("WebGLState:",N)}}function b(){try{e.texSubImage2D(...arguments)}catch(N){zt("WebGLState:",N)}}function F(){try{e.texSubImage3D(...arguments)}catch(N){zt("WebGLState:",N)}}function k(){try{e.compressedTexSubImage2D(...arguments)}catch(N){zt("WebGLState:",N)}}function Z(){try{e.compressedTexSubImage3D(...arguments)}catch(N){zt("WebGLState:",N)}}function ct(){try{e.texStorage2D(...arguments)}catch(N){zt("WebGLState:",N)}}function _t(){try{e.texStorage3D(...arguments)}catch(N){zt("WebGLState:",N)}}function K(){try{e.texImage2D(...arguments)}catch(N){zt("WebGLState:",N)}}function nt(){try{e.texImage3D(...arguments)}catch(N){zt("WebGLState:",N)}}function gt(N){return p[N]!==void 0?p[N]:e.getParameter(N)}function Ct(N,j){p[N]!==j&&(e.pixelStorei(N,j),p[N]=j)}function dt(N){ce.equals(N)===!1&&(e.scissor(N.x,N.y,N.z,N.w),ce.copy(N))}function ht(N){$t.equals(N)===!1&&(e.viewport(N.x,N.y,N.z,N.w),$t.copy(N))}function Rt(N,j){let V=l.get(j);V===void 0&&(V=new WeakMap,l.set(j,V));let ot=V.get(N);ot===void 0&&(ot=e.getUniformBlockIndex(j,N.name),V.set(N,ot))}function I(N,j){let ot=l.get(j).get(N);c.get(j)!==ot&&(e.uniformBlockBinding(j,ot,N.__bindingPointIndex),c.set(j,ot))}function tt(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),r.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),h={},p={},ut=null,pt={},u={},d=new WeakMap,m=[],S=null,g=!1,f=null,_=null,x=null,v=null,T=null,A=null,w=null,y=new Qt(0,0,0),M=0,C=!1,D=null,L=null,P=null,W=null,B=null,ce.set(0,0,e.canvas.width,e.canvas.height),$t.set(0,0,e.canvas.width,e.canvas.height),a.reset(),r.reset(),o.reset()}return{buffers:{color:a,depth:r,stencil:o},enable:rt,disable:mt,bindFramebuffer:St,drawBuffers:wt,useProgram:Yt,setBlending:Ft,setMaterial:Pt,setFlipSided:Ee,setCullFace:ae,setLineWidth:Ue,setPolygonOffset:ze,setScissorTest:ye,activeTexture:Te,bindTexture:O,unbindTexture:pn,compressedTexImage2D:re,compressedTexImage3D:R,texImage2D:K,texImage3D:nt,pixelStorei:Ct,getParameter:gt,updateUBOMapping:Rt,uniformBlockBinding:I,texStorage2D:ct,texStorage3D:_t,texSubImage2D:b,texSubImage3D:F,compressedTexSubImage2D:k,compressedTexSubImage3D:Z,scissor:dt,viewport:ht,reset:tt}}function $2(e,t,n,i,s,a,r){let o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new It,h=new WeakMap,p=new Set,u,d=new WeakMap,m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function S(R,b){return m?new OffscreenCanvas(R,b):Hl("canvas")}function g(R,b,F){let k=1,Z=re(R);if((Z.width>F||Z.height>F)&&(k=F/Math.max(Z.width,Z.height)),k<1)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap||typeof VideoFrame<"u"&&R instanceof VideoFrame){let ct=Math.floor(k*Z.width),_t=Math.floor(k*Z.height);u===void 0&&(u=S(ct,_t));let K=b?S(ct,_t):u;return K.width=ct,K.height=_t,K.getContext("2d").drawImage(R,0,0,ct,_t),Ot("WebGLRenderer: Texture has been resized from ("+Z.width+"x"+Z.height+") to ("+ct+"x"+_t+")."),K}else return"data"in R&&Ot("WebGLRenderer: Image in DataTexture is too big ("+Z.width+"x"+Z.height+")."),R;return R}function f(R){return R.generateMipmaps}function _(R){e.generateMipmap(R)}function x(R){return R.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:R.isWebGL3DRenderTarget?e.TEXTURE_3D:R.isWebGLArrayRenderTarget||R.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function v(R,b,F,k,Z,ct=!1){if(R!==null){if(e[R]!==void 0)return e[R];Ot("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let _t;k&&(_t=t.get("EXT_texture_norm16"),_t||Ot("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let K=b;if(b===e.RED&&(F===e.FLOAT&&(K=e.R32F),F===e.HALF_FLOAT&&(K=e.R16F),F===e.UNSIGNED_BYTE&&(K=e.R8),F===e.UNSIGNED_SHORT&&_t&&(K=_t.R16_EXT),F===e.SHORT&&_t&&(K=_t.R16_SNORM_EXT)),b===e.RED_INTEGER&&(F===e.UNSIGNED_BYTE&&(K=e.R8UI),F===e.UNSIGNED_SHORT&&(K=e.R16UI),F===e.UNSIGNED_INT&&(K=e.R32UI),F===e.BYTE&&(K=e.R8I),F===e.SHORT&&(K=e.R16I),F===e.INT&&(K=e.R32I)),b===e.RG&&(F===e.FLOAT&&(K=e.RG32F),F===e.HALF_FLOAT&&(K=e.RG16F),F===e.UNSIGNED_BYTE&&(K=e.RG8),F===e.UNSIGNED_SHORT&&_t&&(K=_t.RG16_EXT),F===e.SHORT&&_t&&(K=_t.RG16_SNORM_EXT)),b===e.RG_INTEGER&&(F===e.UNSIGNED_BYTE&&(K=e.RG8UI),F===e.UNSIGNED_SHORT&&(K=e.RG16UI),F===e.UNSIGNED_INT&&(K=e.RG32UI),F===e.BYTE&&(K=e.RG8I),F===e.SHORT&&(K=e.RG16I),F===e.INT&&(K=e.RG32I)),b===e.RGB_INTEGER&&(F===e.UNSIGNED_BYTE&&(K=e.RGB8UI),F===e.UNSIGNED_SHORT&&(K=e.RGB16UI),F===e.UNSIGNED_INT&&(K=e.RGB32UI),F===e.BYTE&&(K=e.RGB8I),F===e.SHORT&&(K=e.RGB16I),F===e.INT&&(K=e.RGB32I)),b===e.RGBA_INTEGER&&(F===e.UNSIGNED_BYTE&&(K=e.RGBA8UI),F===e.UNSIGNED_SHORT&&(K=e.RGBA16UI),F===e.UNSIGNED_INT&&(K=e.RGBA32UI),F===e.BYTE&&(K=e.RGBA8I),F===e.SHORT&&(K=e.RGBA16I),F===e.INT&&(K=e.RGBA32I)),b===e.RGB&&(F===e.UNSIGNED_SHORT&&_t&&(K=_t.RGB16_EXT),F===e.SHORT&&_t&&(K=_t.RGB16_SNORM_EXT),F===e.UNSIGNED_INT_5_9_9_9_REV&&(K=e.RGB9_E5),F===e.UNSIGNED_INT_10F_11F_11F_REV&&(K=e.R11F_G11F_B10F)),b===e.RGBA){let nt=ct?Fl:ee.getTransfer(Z);F===e.FLOAT&&(K=e.RGBA32F),F===e.HALF_FLOAT&&(K=e.RGBA16F),F===e.UNSIGNED_BYTE&&(K=nt===ue?e.SRGB8_ALPHA8:e.RGBA8),F===e.UNSIGNED_SHORT&&_t&&(K=_t.RGBA16_EXT),F===e.SHORT&&_t&&(K=_t.RGBA16_SNORM_EXT),F===e.UNSIGNED_SHORT_4_4_4_4&&(K=e.RGBA4),F===e.UNSIGNED_SHORT_5_5_5_1&&(K=e.RGB5_A1)}return(K===e.R16F||K===e.R32F||K===e.RG16F||K===e.RG32F||K===e.RGBA16F||K===e.RGBA32F)&&t.get("EXT_color_buffer_float"),K}function T(R,b){let F;return R?b===null||b===Ai||b===So?F=e.DEPTH24_STENCIL8:b===wi?F=e.DEPTH32F_STENCIL8:b===bo&&(F=e.DEPTH24_STENCIL8,Ot("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):b===null||b===Ai||b===So?F=e.DEPTH_COMPONENT24:b===wi?F=e.DEPTH_COMPONENT32F:b===bo&&(F=e.DEPTH_COMPONENT16),F}function A(R,b){return f(R)===!0||R.isFramebufferTexture&&R.minFilter!==on&&R.minFilter!==dn?Math.log2(Math.max(b.width,b.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?b.mipmaps.length:1}function w(R){let b=R.target;b.removeEventListener("dispose",w),M(b),b.isVideoTexture&&h.delete(b),b.isHTMLTexture&&p.delete(b)}function y(R){let b=R.target;b.removeEventListener("dispose",y),D(b)}function M(R){let b=i.get(R);if(b.__webglInit===void 0)return;let F=R.source,k=d.get(F);if(k){let Z=k[b.__cacheKey];Z.usedTimes--,Z.usedTimes===0&&C(R),Object.keys(k).length===0&&d.delete(F)}i.remove(R)}function C(R){let b=i.get(R);e.deleteTexture(b.__webglTexture);let F=R.source,k=d.get(F);delete k[b.__cacheKey],r.memory.textures--}function D(R){let b=i.get(R);if(R.depthTexture&&(R.depthTexture.dispose(),i.remove(R.depthTexture)),R.isWebGLCubeRenderTarget)for(let k=0;k<6;k++){if(Array.isArray(b.__webglFramebuffer[k]))for(let Z=0;Z<b.__webglFramebuffer[k].length;Z++)e.deleteFramebuffer(b.__webglFramebuffer[k][Z]);else e.deleteFramebuffer(b.__webglFramebuffer[k]);b.__webglDepthbuffer&&e.deleteRenderbuffer(b.__webglDepthbuffer[k])}else{if(Array.isArray(b.__webglFramebuffer))for(let k=0;k<b.__webglFramebuffer.length;k++)e.deleteFramebuffer(b.__webglFramebuffer[k]);else e.deleteFramebuffer(b.__webglFramebuffer);if(b.__webglDepthbuffer&&e.deleteRenderbuffer(b.__webglDepthbuffer),b.__webglMultisampledFramebuffer&&e.deleteFramebuffer(b.__webglMultisampledFramebuffer),b.__webglColorRenderbuffer)for(let k=0;k<b.__webglColorRenderbuffer.length;k++)b.__webglColorRenderbuffer[k]&&e.deleteRenderbuffer(b.__webglColorRenderbuffer[k]);b.__webglDepthRenderbuffer&&e.deleteRenderbuffer(b.__webglDepthRenderbuffer)}let F=R.textures;for(let k=0,Z=F.length;k<Z;k++){let ct=i.get(F[k]);ct.__webglTexture&&(e.deleteTexture(ct.__webglTexture),r.memory.textures--),i.remove(F[k])}i.remove(R)}let L=0;function P(){L=0}function W(){return L}function B(R){L=R}function q(){let R=L;return R>=s.maxTextures&&Ot("WebGLTextures: Trying to use "+R+" texture units while this GPU supports only "+s.maxTextures),L+=1,R}function X(R){let b=[];return b.push(R.wrapS),b.push(R.wrapT),b.push(R.wrapR||0),b.push(R.magFilter),b.push(R.minFilter),b.push(R.anisotropy),b.push(R.internalFormat),b.push(R.format),b.push(R.type),b.push(R.generateMipmaps),b.push(R.premultiplyAlpha),b.push(R.flipY),b.push(R.unpackAlignment),b.push(R.colorSpace),b.join()}function et(R,b){let F=i.get(R);if(R.isVideoTexture&&O(R),R.isRenderTargetTexture===!1&&R.isExternalTexture!==!0&&R.version>0&&F.__version!==R.version){let k=R.image;if(k===null)Ot("WebGLRenderer: Texture marked for update but no image data found.");else if(k.complete===!1)Ot("WebGLRenderer: Texture marked for update but image is incomplete");else{mt(F,R,b);return}}else R.isExternalTexture&&(F.__webglTexture=R.sourceTexture?R.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,F.__webglTexture,e.TEXTURE0+b)}function at(R,b){let F=i.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&F.__version!==R.version){mt(F,R,b);return}else R.isExternalTexture&&(F.__webglTexture=R.sourceTexture?R.sourceTexture:null);n.bindTexture(e.TEXTURE_2D_ARRAY,F.__webglTexture,e.TEXTURE0+b)}function ut(R,b){let F=i.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&F.__version!==R.version){mt(F,R,b);return}n.bindTexture(e.TEXTURE_3D,F.__webglTexture,e.TEXTURE0+b)}function pt(R,b){let F=i.get(R);if(R.isCubeDepthTexture!==!0&&R.version>0&&F.__version!==R.version){St(F,R,b);return}n.bindTexture(e.TEXTURE_CUBE_MAP,F.__webglTexture,e.TEXTURE0+b)}let bt={[Vh]:e.REPEAT,[Hi]:e.CLAMP_TO_EDGE,[Hh]:e.MIRRORED_REPEAT},Zt={[on]:e.NEAREST,[RS]:e.NEAREST_MIPMAP_NEAREST,[cc]:e.NEAREST_MIPMAP_LINEAR,[dn]:e.LINEAR,[Ef]:e.LINEAR_MIPMAP_NEAREST,[xa]:e.LINEAR_MIPMAP_LINEAR},ce={[US]:e.NEVER,[zS]:e.ALWAYS,[LS]:e.LESS,[od]:e.LEQUAL,[IS]:e.EQUAL,[ld]:e.GEQUAL,[OS]:e.GREATER,[PS]:e.NOTEQUAL};function $t(R,b){if(b.type===wi&&t.has("OES_texture_float_linear")===!1&&(b.magFilter===dn||b.magFilter===Ef||b.magFilter===cc||b.magFilter===xa||b.minFilter===dn||b.minFilter===Ef||b.minFilter===cc||b.minFilter===xa)&&Ot("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),e.texParameteri(R,e.TEXTURE_WRAP_S,bt[b.wrapS]),e.texParameteri(R,e.TEXTURE_WRAP_T,bt[b.wrapT]),(R===e.TEXTURE_3D||R===e.TEXTURE_2D_ARRAY)&&e.texParameteri(R,e.TEXTURE_WRAP_R,bt[b.wrapR]),e.texParameteri(R,e.TEXTURE_MAG_FILTER,Zt[b.magFilter]),e.texParameteri(R,e.TEXTURE_MIN_FILTER,Zt[b.minFilter]),b.compareFunction&&(e.texParameteri(R,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(R,e.TEXTURE_COMPARE_FUNC,ce[b.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(b.magFilter===on||b.minFilter!==cc&&b.minFilter!==xa||b.type===wi&&t.has("OES_texture_float_linear")===!1)return;if(b.anisotropy>1||i.get(b).__currentAnisotropy){let F=t.get("EXT_texture_filter_anisotropic");e.texParameterf(R,F.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(b.anisotropy,s.getMaxAnisotropy())),i.get(b).__currentAnisotropy=b.anisotropy}}}function Q(R,b){let F=!1;R.__webglInit===void 0&&(R.__webglInit=!0,b.addEventListener("dispose",w));let k=b.source,Z=d.get(k);Z===void 0&&(Z={},d.set(k,Z));let ct=X(b);if(ct!==R.__cacheKey){Z[ct]===void 0&&(Z[ct]={texture:e.createTexture(),usedTimes:0},r.memory.textures++,F=!0),Z[ct].usedTimes++;let _t=Z[R.__cacheKey];_t!==void 0&&(Z[R.__cacheKey].usedTimes--,_t.usedTimes===0&&C(b)),R.__cacheKey=ct,R.__webglTexture=Z[ct].texture}return F}function ft(R,b,F){return Math.floor(Math.floor(R/F)/b)}function rt(R,b,F,k){let ct=R.updateRanges;if(ct.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,b.width,b.height,F,k,b.data);else{ct.sort((Ct,dt)=>Ct.start-dt.start);let _t=0;for(let Ct=1;Ct<ct.length;Ct++){let dt=ct[_t],ht=ct[Ct],Rt=dt.start+dt.count,I=ft(ht.start,b.width,4),tt=ft(dt.start,b.width,4);ht.start<=Rt+1&&I===tt&&ft(ht.start+ht.count-1,b.width,4)===I?dt.count=Math.max(dt.count,ht.start+ht.count-dt.start):(++_t,ct[_t]=ht)}ct.length=_t+1;let K=n.getParameter(e.UNPACK_ROW_LENGTH),nt=n.getParameter(e.UNPACK_SKIP_PIXELS),gt=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,b.width);for(let Ct=0,dt=ct.length;Ct<dt;Ct++){let ht=ct[Ct],Rt=Math.floor(ht.start/4),I=Math.ceil(ht.count/4),tt=Rt%b.width,N=Math.floor(Rt/b.width),j=I,V=1;n.pixelStorei(e.UNPACK_SKIP_PIXELS,tt),n.pixelStorei(e.UNPACK_SKIP_ROWS,N),n.texSubImage2D(e.TEXTURE_2D,0,tt,N,j,V,F,k,b.data)}R.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,K),n.pixelStorei(e.UNPACK_SKIP_PIXELS,nt),n.pixelStorei(e.UNPACK_SKIP_ROWS,gt)}}function mt(R,b,F){let k=e.TEXTURE_2D;(b.isDataArrayTexture||b.isCompressedArrayTexture)&&(k=e.TEXTURE_2D_ARRAY),b.isData3DTexture&&(k=e.TEXTURE_3D);let Z=Q(R,b),ct=b.source;n.bindTexture(k,R.__webglTexture,e.TEXTURE0+F);let _t=i.get(ct);if(ct.version!==_t.__version||Z===!0){if(n.activeTexture(e.TEXTURE0+F),(typeof ImageBitmap<"u"&&b.image instanceof ImageBitmap)===!1){let V=ee.getPrimaries(ee.workingColorSpace),ot=b.colorSpace===ws?null:ee.getPrimaries(b.colorSpace),lt=b.colorSpace===ws||V===ot?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,b.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,lt)}n.pixelStorei(e.UNPACK_ALIGNMENT,b.unpackAlignment);let nt=g(b.image,!1,s.maxTextureSize);nt=pn(b,nt);let gt=a.convert(b.format,b.colorSpace),Ct=a.convert(b.type),dt=v(b.internalFormat,gt,Ct,b.normalized,b.colorSpace,b.isVideoTexture);$t(k,b);let ht,Rt=b.mipmaps,I=b.isVideoTexture!==!0,tt=_t.__version===void 0||Z===!0,N=ct.dataReady,j=A(b,nt);if(b.isDepthTexture)dt=T(b.format===ba,b.type),tt&&(I?n.texStorage2D(e.TEXTURE_2D,1,dt,nt.width,nt.height):n.texImage2D(e.TEXTURE_2D,0,dt,nt.width,nt.height,0,gt,Ct,null));else if(b.isDataTexture)if(Rt.length>0){I&&tt&&n.texStorage2D(e.TEXTURE_2D,j,dt,Rt[0].width,Rt[0].height);for(let V=0,ot=Rt.length;V<ot;V++)ht=Rt[V],I?N&&n.texSubImage2D(e.TEXTURE_2D,V,0,0,ht.width,ht.height,gt,Ct,ht.data):n.texImage2D(e.TEXTURE_2D,V,dt,ht.width,ht.height,0,gt,Ct,ht.data);b.generateMipmaps=!1}else I?(tt&&n.texStorage2D(e.TEXTURE_2D,j,dt,nt.width,nt.height),N&&rt(b,nt,gt,Ct)):n.texImage2D(e.TEXTURE_2D,0,dt,nt.width,nt.height,0,gt,Ct,nt.data);else if(b.isCompressedTexture)if(b.isCompressedArrayTexture){I&&tt&&n.texStorage3D(e.TEXTURE_2D_ARRAY,j,dt,Rt[0].width,Rt[0].height,nt.depth);for(let V=0,ot=Rt.length;V<ot;V++)if(ht=Rt[V],b.format!==_i)if(gt!==null)if(I){if(N)if(b.layerUpdates.size>0){let lt=m0(ht.width,ht.height,b.format,b.type);for(let $ of b.layerUpdates){let Tt=ht.data.subarray($*lt/ht.data.BYTES_PER_ELEMENT,($+1)*lt/ht.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,V,0,0,$,ht.width,ht.height,1,gt,Tt)}b.clearLayerUpdates()}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,V,0,0,0,ht.width,ht.height,nt.depth,gt,ht.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,V,dt,ht.width,ht.height,nt.depth,0,ht.data,0,0);else Ot("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else I?N&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,V,0,0,0,ht.width,ht.height,nt.depth,gt,Ct,ht.data):n.texImage3D(e.TEXTURE_2D_ARRAY,V,dt,ht.width,ht.height,nt.depth,0,gt,Ct,ht.data)}else{I&&tt&&n.texStorage2D(e.TEXTURE_2D,j,dt,Rt[0].width,Rt[0].height);for(let V=0,ot=Rt.length;V<ot;V++)ht=Rt[V],b.format!==_i?gt!==null?I?N&&n.compressedTexSubImage2D(e.TEXTURE_2D,V,0,0,ht.width,ht.height,gt,ht.data):n.compressedTexImage2D(e.TEXTURE_2D,V,dt,ht.width,ht.height,0,ht.data):Ot("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):I?N&&n.texSubImage2D(e.TEXTURE_2D,V,0,0,ht.width,ht.height,gt,Ct,ht.data):n.texImage2D(e.TEXTURE_2D,V,dt,ht.width,ht.height,0,gt,Ct,ht.data)}else if(b.isDataArrayTexture)if(I){if(tt&&n.texStorage3D(e.TEXTURE_2D_ARRAY,j,dt,nt.width,nt.height,nt.depth),N)if(b.layerUpdates.size>0){let V=m0(nt.width,nt.height,b.format,b.type);for(let ot of b.layerUpdates){let lt=nt.data.subarray(ot*V/nt.data.BYTES_PER_ELEMENT,(ot+1)*V/nt.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,ot,nt.width,nt.height,1,gt,Ct,lt)}b.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,nt.width,nt.height,nt.depth,gt,Ct,nt.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,dt,nt.width,nt.height,nt.depth,0,gt,Ct,nt.data);else if(b.isData3DTexture)I?(tt&&n.texStorage3D(e.TEXTURE_3D,j,dt,nt.width,nt.height,nt.depth),N&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,nt.width,nt.height,nt.depth,gt,Ct,nt.data)):n.texImage3D(e.TEXTURE_3D,0,dt,nt.width,nt.height,nt.depth,0,gt,Ct,nt.data);else if(b.isFramebufferTexture){if(tt)if(I)n.texStorage2D(e.TEXTURE_2D,j,dt,nt.width,nt.height);else{let V=nt.width,ot=nt.height;for(let lt=0;lt<j;lt++)n.texImage2D(e.TEXTURE_2D,lt,dt,V,ot,0,gt,Ct,null),V>>=1,ot>>=1}}else if(b.isHTMLTexture){if("texElementImage2D"in e){let V=e.canvas;if(V.hasAttribute("layoutsubtree")||V.setAttribute("layoutsubtree","true"),nt.parentNode!==V){V.appendChild(nt),p.add(b),V.onpaint=ot=>{let lt=ot.changedElements;for(let $ of p)lt.includes($.image)&&($.needsUpdate=!0)},V.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,nt);else{let lt=e.RGBA,$=e.RGBA,Tt=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,lt,$,Tt,nt)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(Rt.length>0){if(I&&tt){let V=re(Rt[0]);n.texStorage2D(e.TEXTURE_2D,j,dt,V.width,V.height)}for(let V=0,ot=Rt.length;V<ot;V++)ht=Rt[V],I?N&&n.texSubImage2D(e.TEXTURE_2D,V,0,0,gt,Ct,ht):n.texImage2D(e.TEXTURE_2D,V,dt,gt,Ct,ht);b.generateMipmaps=!1}else if(I){if(tt){let V=re(nt);n.texStorage2D(e.TEXTURE_2D,j,dt,V.width,V.height)}N&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,gt,Ct,nt)}else n.texImage2D(e.TEXTURE_2D,0,dt,gt,Ct,nt);f(b)&&_(k),_t.__version=ct.version,b.onUpdate&&b.onUpdate(b)}R.__version=b.version}function St(R,b,F){if(b.image.length!==6)return;let k=Q(R,b),Z=b.source;n.bindTexture(e.TEXTURE_CUBE_MAP,R.__webglTexture,e.TEXTURE0+F);let ct=i.get(Z);if(Z.version!==ct.__version||k===!0){n.activeTexture(e.TEXTURE0+F);let _t=ee.getPrimaries(ee.workingColorSpace),K=b.colorSpace===ws?null:ee.getPrimaries(b.colorSpace),nt=b.colorSpace===ws||_t===K?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,b.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,b.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,nt);let gt=b.isCompressedTexture||b.image[0].isCompressedTexture,Ct=b.image[0]&&b.image[0].isDataTexture,dt=[];for(let $=0;$<6;$++)!gt&&!Ct?dt[$]=g(b.image[$],!0,s.maxCubemapSize):dt[$]=Ct?b.image[$].image:b.image[$],dt[$]=pn(b,dt[$]);let ht=dt[0],Rt=a.convert(b.format,b.colorSpace),I=a.convert(b.type),tt=v(b.internalFormat,Rt,I,b.normalized,b.colorSpace),N=b.isVideoTexture!==!0,j=ct.__version===void 0||k===!0,V=Z.dataReady,ot=A(b,ht);$t(e.TEXTURE_CUBE_MAP,b);let lt;if(gt){N&&j&&n.texStorage2D(e.TEXTURE_CUBE_MAP,ot,tt,ht.width,ht.height);for(let $=0;$<6;$++){lt=dt[$].mipmaps;for(let Tt=0;Tt<lt.length;Tt++){let At=lt[Tt];b.format!==_i?Rt!==null?N?V&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,Tt,0,0,At.width,At.height,Rt,At.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,Tt,tt,At.width,At.height,0,At.data):Ot("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):N?V&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,Tt,0,0,At.width,At.height,Rt,I,At.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,Tt,tt,At.width,At.height,0,Rt,I,At.data)}}}else{if(lt=b.mipmaps,N&&j){lt.length>0&&ot++;let $=re(dt[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,ot,tt,$.width,$.height)}for(let $=0;$<6;$++)if(Ct){N?V&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,0,0,dt[$].width,dt[$].height,Rt,I,dt[$].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,tt,dt[$].width,dt[$].height,0,Rt,I,dt[$].data);for(let Tt=0;Tt<lt.length;Tt++){let Ae=lt[Tt].image[$].image;N?V&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,Tt+1,0,0,Ae.width,Ae.height,Rt,I,Ae.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,Tt+1,tt,Ae.width,Ae.height,0,Rt,I,Ae.data)}}else{N?V&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,0,0,Rt,I,dt[$]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,tt,Rt,I,dt[$]);for(let Tt=0;Tt<lt.length;Tt++){let At=lt[Tt];N?V&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,Tt+1,0,0,Rt,I,At.image[$]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+$,Tt+1,tt,Rt,I,At.image[$])}}}f(b)&&_(e.TEXTURE_CUBE_MAP),ct.__version=Z.version,b.onUpdate&&b.onUpdate(b)}R.__version=b.version}function wt(R,b,F,k,Z,ct){let _t=a.convert(F.format,F.colorSpace),K=a.convert(F.type),nt=v(F.internalFormat,_t,K,F.normalized,F.colorSpace),gt=i.get(b),Ct=i.get(F);if(Ct.__renderTarget=b,!gt.__hasExternalTextures){let dt=Math.max(1,b.width>>ct),ht=Math.max(1,b.height>>ct);Z===e.TEXTURE_3D||Z===e.TEXTURE_2D_ARRAY?n.texImage3D(Z,ct,nt,dt,ht,b.depth,0,_t,K,null):n.texImage2D(Z,ct,nt,dt,ht,0,_t,K,null)}n.bindFramebuffer(e.FRAMEBUFFER,R),Te(b)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,k,Z,Ct.__webglTexture,0,ye(b)):(Z===e.TEXTURE_2D||Z>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&Z<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,k,Z,Ct.__webglTexture,ct),n.bindFramebuffer(e.FRAMEBUFFER,null)}function Yt(R,b,F){if(e.bindRenderbuffer(e.RENDERBUFFER,R),b.depthBuffer){let k=b.depthTexture,Z=k&&k.isDepthTexture?k.type:null,ct=T(b.stencilBuffer,Z),_t=b.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;Te(b)?o.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,ye(b),ct,b.width,b.height):F?e.renderbufferStorageMultisample(e.RENDERBUFFER,ye(b),ct,b.width,b.height):e.renderbufferStorage(e.RENDERBUFFER,ct,b.width,b.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,_t,e.RENDERBUFFER,R)}else{let k=b.textures;for(let Z=0;Z<k.length;Z++){let ct=k[Z],_t=a.convert(ct.format,ct.colorSpace),K=a.convert(ct.type),nt=v(ct.internalFormat,_t,K,ct.normalized,ct.colorSpace);Te(b)?o.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,ye(b),nt,b.width,b.height):F?e.renderbufferStorageMultisample(e.RENDERBUFFER,ye(b),nt,b.width,b.height):e.renderbufferStorage(e.RENDERBUFFER,nt,b.width,b.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function Ut(R,b,F){let k=b.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,R),!(b.depthTexture&&b.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let Z=i.get(b.depthTexture);if(Z.__renderTarget=b,(!Z.__webglTexture||b.depthTexture.image.width!==b.width||b.depthTexture.image.height!==b.height)&&(b.depthTexture.image.width=b.width,b.depthTexture.image.height=b.height,b.depthTexture.needsUpdate=!0),k){if(Z.__webglInit===void 0&&(Z.__webglInit=!0,b.depthTexture.addEventListener("dispose",w)),Z.__webglTexture===void 0){Z.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,Z.__webglTexture),$t(e.TEXTURE_CUBE_MAP,b.depthTexture);let gt=a.convert(b.depthTexture.format),Ct=a.convert(b.depthTexture.type),dt;b.depthTexture.format===ki?dt=e.DEPTH_COMPONENT24:b.depthTexture.format===ba&&(dt=e.DEPTH24_STENCIL8);for(let ht=0;ht<6;ht++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ht,0,dt,b.width,b.height,0,gt,Ct,null)}}else et(b.depthTexture,0);let ct=Z.__webglTexture,_t=ye(b),K=k?e.TEXTURE_CUBE_MAP_POSITIVE_X+F:e.TEXTURE_2D,nt=b.depthTexture.format===ba?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(b.depthTexture.format===ki)Te(b)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,nt,K,ct,0,_t):e.framebufferTexture2D(e.FRAMEBUFFER,nt,K,ct,0);else if(b.depthTexture.format===ba)Te(b)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,nt,K,ct,0,_t):e.framebufferTexture2D(e.FRAMEBUFFER,nt,K,ct,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Vt(R){let b=i.get(R),F=R.isWebGLCubeRenderTarget===!0;if(b.__boundDepthTexture!==R.depthTexture){let k=R.depthTexture;if(b.__depthDisposeCallback&&b.__depthDisposeCallback(),k){let Z=()=>{delete b.__boundDepthTexture,delete b.__depthDisposeCallback,k.removeEventListener("dispose",Z)};k.addEventListener("dispose",Z),b.__depthDisposeCallback=Z}b.__boundDepthTexture=k}if(R.depthTexture&&!b.__autoAllocateDepthBuffer)if(F)for(let k=0;k<6;k++)Ut(b.__webglFramebuffer[k],R,k);else{let k=R.texture.mipmaps;k&&k.length>0?Ut(b.__webglFramebuffer[0],R,0):Ut(b.__webglFramebuffer,R,0)}else if(F){b.__webglDepthbuffer=[];for(let k=0;k<6;k++)if(n.bindFramebuffer(e.FRAMEBUFFER,b.__webglFramebuffer[k]),b.__webglDepthbuffer[k]===void 0)b.__webglDepthbuffer[k]=e.createRenderbuffer(),Yt(b.__webglDepthbuffer[k],R,!1);else{let Z=R.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ct=b.__webglDepthbuffer[k];e.bindRenderbuffer(e.RENDERBUFFER,ct),e.framebufferRenderbuffer(e.FRAMEBUFFER,Z,e.RENDERBUFFER,ct)}}else{let k=R.texture.mipmaps;if(k&&k.length>0?n.bindFramebuffer(e.FRAMEBUFFER,b.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,b.__webglFramebuffer),b.__webglDepthbuffer===void 0)b.__webglDepthbuffer=e.createRenderbuffer(),Yt(b.__webglDepthbuffer,R,!1);else{let Z=R.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ct=b.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,ct),e.framebufferRenderbuffer(e.FRAMEBUFFER,Z,e.RENDERBUFFER,ct)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function Ft(R,b,F){let k=i.get(R);b!==void 0&&wt(k.__webglFramebuffer,R,R.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),F!==void 0&&Vt(R)}function Pt(R){let b=R.texture,F=i.get(R),k=i.get(b);R.addEventListener("dispose",y);let Z=R.textures,ct=R.isWebGLCubeRenderTarget===!0,_t=Z.length>1;if(_t||(k.__webglTexture===void 0&&(k.__webglTexture=e.createTexture()),k.__version=b.version,r.memory.textures++),ct){F.__webglFramebuffer=[];for(let K=0;K<6;K++)if(b.mipmaps&&b.mipmaps.length>0){F.__webglFramebuffer[K]=[];for(let nt=0;nt<b.mipmaps.length;nt++)F.__webglFramebuffer[K][nt]=e.createFramebuffer()}else F.__webglFramebuffer[K]=e.createFramebuffer()}else{if(b.mipmaps&&b.mipmaps.length>0){F.__webglFramebuffer=[];for(let K=0;K<b.mipmaps.length;K++)F.__webglFramebuffer[K]=e.createFramebuffer()}else F.__webglFramebuffer=e.createFramebuffer();if(_t)for(let K=0,nt=Z.length;K<nt;K++){let gt=i.get(Z[K]);gt.__webglTexture===void 0&&(gt.__webglTexture=e.createTexture(),r.memory.textures++)}if(R.samples>0&&Te(R)===!1){F.__webglMultisampledFramebuffer=e.createFramebuffer(),F.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,F.__webglMultisampledFramebuffer);for(let K=0;K<Z.length;K++){let nt=Z[K];F.__webglColorRenderbuffer[K]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,F.__webglColorRenderbuffer[K]);let gt=a.convert(nt.format,nt.colorSpace),Ct=a.convert(nt.type),dt=v(nt.internalFormat,gt,Ct,nt.normalized,nt.colorSpace,R.isXRRenderTarget===!0),ht=ye(R);e.renderbufferStorageMultisample(e.RENDERBUFFER,ht,dt,R.width,R.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+K,e.RENDERBUFFER,F.__webglColorRenderbuffer[K])}e.bindRenderbuffer(e.RENDERBUFFER,null),R.depthBuffer&&(F.__webglDepthRenderbuffer=e.createRenderbuffer(),Yt(F.__webglDepthRenderbuffer,R,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(ct){n.bindTexture(e.TEXTURE_CUBE_MAP,k.__webglTexture),$t(e.TEXTURE_CUBE_MAP,b);for(let K=0;K<6;K++)if(b.mipmaps&&b.mipmaps.length>0)for(let nt=0;nt<b.mipmaps.length;nt++)wt(F.__webglFramebuffer[K][nt],R,b,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+K,nt);else wt(F.__webglFramebuffer[K],R,b,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+K,0);f(b)&&_(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(_t){for(let K=0,nt=Z.length;K<nt;K++){let gt=Z[K],Ct=i.get(gt),dt=e.TEXTURE_2D;(R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(dt=R.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(dt,Ct.__webglTexture),$t(dt,gt),wt(F.__webglFramebuffer,R,gt,e.COLOR_ATTACHMENT0+K,dt,0),f(gt)&&_(dt)}n.unbindTexture()}else{let K=e.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(K=R.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(K,k.__webglTexture),$t(K,b),b.mipmaps&&b.mipmaps.length>0)for(let nt=0;nt<b.mipmaps.length;nt++)wt(F.__webglFramebuffer[nt],R,b,e.COLOR_ATTACHMENT0,K,nt);else wt(F.__webglFramebuffer,R,b,e.COLOR_ATTACHMENT0,K,0);f(b)&&_(K),n.unbindTexture()}R.depthBuffer&&Vt(R)}function Ee(R){let b=R.textures;for(let F=0,k=b.length;F<k;F++){let Z=b[F];if(f(Z)){let ct=x(R),_t=i.get(Z).__webglTexture;n.bindTexture(ct,_t),_(ct),n.unbindTexture()}}}let ae=[],Ue=[];function ze(R){if(R.samples>0){if(Te(R)===!1){let b=R.textures,F=R.width,k=R.height,Z=e.COLOR_BUFFER_BIT,ct=R.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,_t=i.get(R),K=b.length>1;if(K)for(let gt=0;gt<b.length;gt++)n.bindFramebuffer(e.FRAMEBUFFER,_t.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+gt,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,_t.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+gt,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,_t.__webglMultisampledFramebuffer);let nt=R.texture.mipmaps;nt&&nt.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,_t.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,_t.__webglFramebuffer);for(let gt=0;gt<b.length;gt++){if(R.resolveDepthBuffer&&(R.depthBuffer&&(Z|=e.DEPTH_BUFFER_BIT),R.stencilBuffer&&R.resolveStencilBuffer&&(Z|=e.STENCIL_BUFFER_BIT)),K){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,_t.__webglColorRenderbuffer[gt]);let Ct=i.get(b[gt]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,Ct,0)}e.blitFramebuffer(0,0,F,k,0,0,F,k,Z,e.NEAREST),c===!0&&(ae.length=0,Ue.length=0,ae.push(e.COLOR_ATTACHMENT0+gt),R.depthBuffer&&R.resolveDepthBuffer===!1&&(ae.push(ct),Ue.push(ct),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,Ue)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,ae))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),K)for(let gt=0;gt<b.length;gt++){n.bindFramebuffer(e.FRAMEBUFFER,_t.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+gt,e.RENDERBUFFER,_t.__webglColorRenderbuffer[gt]);let Ct=i.get(b[gt]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,_t.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+gt,e.TEXTURE_2D,Ct,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,_t.__webglMultisampledFramebuffer)}else if(R.depthBuffer&&R.resolveDepthBuffer===!1&&c){let b=R.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[b])}}}function ye(R){return Math.min(s.maxSamples,R.samples)}function Te(R){let b=i.get(R);return R.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&b.__useRenderToTexture!==!1}function O(R){let b=r.render.frame;h.get(R)!==b&&(h.set(R,b),R.update())}function pn(R,b){let F=R.colorSpace,k=R.format,Z=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||F!==Bl&&F!==ws&&(ee.getTransfer(F)===ue?(k!==_i||Z!==ei)&&Ot("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):zt("WebGLTextures: Unsupported texture color space:",F)),b}function re(R){return typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement?(l.width=R.naturalWidth||R.width,l.height=R.naturalHeight||R.height):typeof VideoFrame<"u"&&R instanceof VideoFrame?(l.width=R.displayWidth,l.height=R.displayHeight):(l.width=R.width,l.height=R.height),l}this.allocateTextureUnit=q,this.resetTextureUnits=P,this.getTextureUnits=W,this.setTextureUnits=B,this.setTexture2D=et,this.setTexture2DArray=at,this.setTexture3D=ut,this.setTextureCube=pt,this.rebindTextures=Ft,this.setupRenderTarget=Pt,this.updateRenderTargetMipmap=Ee,this.updateMultisampleRenderTarget=ze,this.setupDepthRenderbuffer=Vt,this.setupFrameBufferTexture=wt,this.useMultisampledRTT=Te,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function t3(e,t){function n(i,s=ws){let a,r=ee.getTransfer(s);if(i===ei)return e.UNSIGNED_BYTE;if(i===Af)return e.UNSIGNED_SHORT_4_4_4_4;if(i===wf)return e.UNSIGNED_SHORT_5_5_5_1;if(i===i0)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===s0)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===e0)return e.BYTE;if(i===n0)return e.SHORT;if(i===bo)return e.UNSIGNED_SHORT;if(i===Tf)return e.INT;if(i===Ai)return e.UNSIGNED_INT;if(i===wi)return e.FLOAT;if(i===Ji)return e.HALF_FLOAT;if(i===a0)return e.ALPHA;if(i===r0)return e.RGB;if(i===_i)return e.RGBA;if(i===ki)return e.DEPTH_COMPONENT;if(i===ba)return e.DEPTH_STENCIL;if(i===o0)return e.RED;if(i===Cf)return e.RED_INTEGER;if(i===Sa)return e.RG;if(i===Rf)return e.RG_INTEGER;if(i===Df)return e.RGBA_INTEGER;if(i===uc||i===hc||i===fc||i===dc)if(r===ue)if(a=t.get("WEBGL_compressed_texture_s3tc_srgb"),a!==null){if(i===uc)return a.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===hc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===fc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===dc)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(a=t.get("WEBGL_compressed_texture_s3tc"),a!==null){if(i===uc)return a.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===hc)return a.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===fc)return a.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===dc)return a.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Nf||i===Uf||i===Lf||i===If)if(a=t.get("WEBGL_compressed_texture_pvrtc"),a!==null){if(i===Nf)return a.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Uf)return a.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Lf)return a.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===If)return a.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Of||i===Pf||i===zf||i===Bf||i===Ff||i===pc||i===Vf)if(a=t.get("WEBGL_compressed_texture_etc"),a!==null){if(i===Of||i===Pf)return r===ue?a.COMPRESSED_SRGB8_ETC2:a.COMPRESSED_RGB8_ETC2;if(i===zf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:a.COMPRESSED_RGBA8_ETC2_EAC;if(i===Bf)return a.COMPRESSED_R11_EAC;if(i===Ff)return a.COMPRESSED_SIGNED_R11_EAC;if(i===pc)return a.COMPRESSED_RG11_EAC;if(i===Vf)return a.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Hf||i===Gf||i===kf||i===Xf||i===Wf||i===qf||i===Yf||i===Zf||i===Jf||i===Kf||i===jf||i===Qf||i===$f||i===td)if(a=t.get("WEBGL_compressed_texture_astc"),a!==null){if(i===Hf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:a.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Gf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:a.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===kf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:a.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Xf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:a.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Wf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:a.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===qf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:a.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Yf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:a.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Zf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:a.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Jf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:a.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Kf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:a.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===jf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:a.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Qf)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:a.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===$f)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:a.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===td)return r===ue?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:a.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===ed||i===nd||i===id)if(a=t.get("EXT_texture_compression_bptc"),a!==null){if(i===ed)return r===ue?a.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:a.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===nd)return a.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===id)return a.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===sd||i===ad||i===mc||i===rd)if(a=t.get("EXT_texture_compression_rgtc"),a!==null){if(i===sd)return a.COMPRESSED_RED_RGTC1_EXT;if(i===ad)return a.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===mc)return a.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===rd)return a.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===So?e.UNSIGNED_INT_24_8:e[i]!==void 0?e[i]:null}return{convert:n}}var e3=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,n3=`
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

}`,R0=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,n){if(this.texture===null){let i=new jl(t.texture);(t.depthNear!==n.depthNear||t.depthFar!==n.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=i}}getMesh(t){if(this.texture!==null&&this.mesh===null){let n=t.cameras[0].viewport,i=new Qn({vertexShader:e3,fragmentShader:n3,uniforms:{depthColor:{value:this.texture},depthWidth:{value:n.z},depthHeight:{value:n.w}}});this.mesh=new je(new ma(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},D0=class extends Xi{constructor(t,n){super();let i=this,s=null,a=1,r=null,o="local-floor",c=1,l=null,h=null,p=null,u=null,d=null,m=null,S=typeof XRWebGLBinding<"u",g=new R0,f={},_=n.getContextAttributes(),x=null,v=null,T=[],A=[],w=new It,y=null,M=new yn;M.viewport=new Pe;let C=new yn;C.viewport=new Pe;let D=[M,C],L=new xf,P=null,W=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Q){let ft=T[Q];return ft===void 0&&(ft=new mo,T[Q]=ft),ft.getTargetRaySpace()},this.getControllerGrip=function(Q){let ft=T[Q];return ft===void 0&&(ft=new mo,T[Q]=ft),ft.getGripSpace()},this.getHand=function(Q){let ft=T[Q];return ft===void 0&&(ft=new mo,T[Q]=ft),ft.getHandSpace()};function B(Q){let ft=A.indexOf(Q.inputSource);if(ft===-1)return;let rt=T[ft];rt!==void 0&&(rt.update(Q.inputSource,Q.frame,l||r),rt.dispatchEvent({type:Q.type,data:Q.inputSource}))}function q(){s.removeEventListener("select",B),s.removeEventListener("selectstart",B),s.removeEventListener("selectend",B),s.removeEventListener("squeeze",B),s.removeEventListener("squeezestart",B),s.removeEventListener("squeezeend",B),s.removeEventListener("end",q),s.removeEventListener("inputsourceschange",X);for(let Q=0;Q<T.length;Q++){let ft=A[Q];ft!==null&&(A[Q]=null,T[Q].disconnect(ft))}P=null,W=null,g.reset();for(let Q in f)delete f[Q];t.setRenderTarget(x),d=null,u=null,p=null,s=null,v=null,$t.stop(),i.isPresenting=!1,t.setPixelRatio(y),t.setSize(w.width,w.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Q){a=Q,i.isPresenting===!0&&Ot("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Q){o=Q,i.isPresenting===!0&&Ot("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||r},this.setReferenceSpace=function(Q){l=Q},this.getBaseLayer=function(){return u!==null?u:d},this.getBinding=function(){return p===null&&S&&(p=new XRWebGLBinding(s,n)),p},this.getFrame=function(){return m},this.getSession=function(){return s},this.setSession=async function(Q){if(s=Q,s!==null){if(x=t.getRenderTarget(),s.addEventListener("select",B),s.addEventListener("selectstart",B),s.addEventListener("selectend",B),s.addEventListener("squeeze",B),s.addEventListener("squeezestart",B),s.addEventListener("squeezeend",B),s.addEventListener("end",q),s.addEventListener("inputsourceschange",X),_.xrCompatible!==!0&&await n.makeXRCompatible(),y=t.getPixelRatio(),t.getSize(w),S&&"createProjectionLayer"in XRWebGLBinding.prototype){let rt=null,mt=null,St=null;_.depth&&(St=_.stencil?n.DEPTH24_STENCIL8:n.DEPTH_COMPONENT24,rt=_.stencil?ba:ki,mt=_.stencil?So:Ai);let wt={colorFormat:n.RGBA8,depthFormat:St,scaleFactor:a};p=this.getBinding(),u=p.createProjectionLayer(wt),s.updateRenderState({layers:[u]}),t.setPixelRatio(1),t.setSize(u.textureWidth,u.textureHeight,!1),v=new Kn(u.textureWidth,u.textureHeight,{format:_i,type:ei,depthTexture:new As(u.textureWidth,u.textureHeight,mt,void 0,void 0,void 0,void 0,void 0,void 0,rt),stencilBuffer:_.stencil,colorSpace:t.outputColorSpace,samples:_.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{let rt={antialias:_.antialias,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:a};d=new XRWebGLLayer(s,n,rt),s.updateRenderState({baseLayer:d}),t.setPixelRatio(1),t.setSize(d.framebufferWidth,d.framebufferHeight,!1),v=new Kn(d.framebufferWidth,d.framebufferHeight,{format:_i,type:ei,colorSpace:t.outputColorSpace,stencilBuffer:_.stencil,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}v.isXRRenderTarget=!0,this.setFoveation(c),l=null,r=await s.requestReferenceSpace(o),$t.setContext(s),$t.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return g.getDepthTexture()};function X(Q){for(let ft=0;ft<Q.removed.length;ft++){let rt=Q.removed[ft],mt=A.indexOf(rt);mt>=0&&(A[mt]=null,T[mt].disconnect(rt))}for(let ft=0;ft<Q.added.length;ft++){let rt=Q.added[ft],mt=A.indexOf(rt);if(mt===-1){for(let wt=0;wt<T.length;wt++)if(wt>=A.length){A.push(rt),mt=wt;break}else if(A[wt]===null){A[wt]=rt,mt=wt;break}if(mt===-1)break}let St=T[mt];St&&St.connect(rt)}}let et=new U,at=new U;function ut(Q,ft,rt){et.setFromMatrixPosition(ft.matrixWorld),at.setFromMatrixPosition(rt.matrixWorld);let mt=et.distanceTo(at),St=ft.projectionMatrix.elements,wt=rt.projectionMatrix.elements,Yt=St[14]/(St[10]-1),Ut=St[14]/(St[10]+1),Vt=(St[9]+1)/St[5],Ft=(St[9]-1)/St[5],Pt=(St[8]-1)/St[0],Ee=(wt[8]+1)/wt[0],ae=Yt*Pt,Ue=Yt*Ee,ze=mt/(-Pt+Ee),ye=ze*-Pt;if(ft.matrixWorld.decompose(Q.position,Q.quaternion,Q.scale),Q.translateX(ye),Q.translateZ(ze),Q.matrixWorld.compose(Q.position,Q.quaternion,Q.scale),Q.matrixWorldInverse.copy(Q.matrixWorld).invert(),St[10]===-1)Q.projectionMatrix.copy(ft.projectionMatrix),Q.projectionMatrixInverse.copy(ft.projectionMatrixInverse);else{let Te=Yt+ze,O=Ut+ze,pn=ae-ye,re=Ue+(mt-ye),R=Vt*Ut/O*Te,b=Ft*Ut/O*Te;Q.projectionMatrix.makePerspective(pn,re,R,b,Te,O),Q.projectionMatrixInverse.copy(Q.projectionMatrix).invert()}}function pt(Q,ft){ft===null?Q.matrixWorld.copy(Q.matrix):Q.matrixWorld.multiplyMatrices(ft.matrixWorld,Q.matrix),Q.matrixWorldInverse.copy(Q.matrixWorld).invert()}this.updateCamera=function(Q){if(s===null)return;let ft=Q.near,rt=Q.far;g.texture!==null&&(g.depthNear>0&&(ft=g.depthNear),g.depthFar>0&&(rt=g.depthFar)),L.near=C.near=M.near=ft,L.far=C.far=M.far=rt,(P!==L.near||W!==L.far)&&(s.updateRenderState({depthNear:L.near,depthFar:L.far}),P=L.near,W=L.far),L.layers.mask=Q.layers.mask|6,M.layers.mask=L.layers.mask&-5,C.layers.mask=L.layers.mask&-3;let mt=Q.parent,St=L.cameras;pt(L,mt);for(let wt=0;wt<St.length;wt++)pt(St[wt],mt);St.length===2?ut(L,M,C):L.projectionMatrix.copy(M.projectionMatrix),bt(Q,L,mt)};function bt(Q,ft,rt){rt===null?Q.matrix.copy(ft.matrixWorld):(Q.matrix.copy(rt.matrixWorld),Q.matrix.invert(),Q.matrix.multiply(ft.matrixWorld)),Q.matrix.decompose(Q.position,Q.quaternion,Q.scale),Q.updateMatrixWorld(!0),Q.projectionMatrix.copy(ft.projectionMatrix),Q.projectionMatrixInverse.copy(ft.projectionMatrixInverse),Q.isPerspectiveCamera&&(Q.fov=kh*2*Math.atan(1/Q.projectionMatrix.elements[5]),Q.zoom=1)}this.getCamera=function(){return L},this.getFoveation=function(){if(!(u===null&&d===null))return c},this.setFoveation=function(Q){c=Q,u!==null&&(u.fixedFoveation=Q),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=Q)},this.hasDepthSensing=function(){return g.texture!==null},this.getDepthSensingMesh=function(){return g.getMesh(L)},this.getCameraTexture=function(Q){return f[Q]};let Zt=null;function ce(Q,ft){if(h=ft.getViewerPose(l||r),m=ft,h!==null){let rt=h.views;d!==null&&(t.setRenderTargetFramebuffer(v,d.framebuffer),t.setRenderTarget(v));let mt=!1;rt.length!==L.cameras.length&&(L.cameras.length=0,mt=!0);for(let Ut=0;Ut<rt.length;Ut++){let Vt=rt[Ut],Ft=null;if(d!==null)Ft=d.getViewport(Vt);else{let Ee=p.getViewSubImage(u,Vt);Ft=Ee.viewport,Ut===0&&(t.setRenderTargetTextures(v,Ee.colorTexture,Ee.depthStencilTexture),t.setRenderTarget(v))}let Pt=D[Ut];Pt===void 0&&(Pt=new yn,Pt.layers.enable(Ut),Pt.viewport=new Pe,D[Ut]=Pt),Pt.matrix.fromArray(Vt.transform.matrix),Pt.matrix.decompose(Pt.position,Pt.quaternion,Pt.scale),Pt.projectionMatrix.fromArray(Vt.projectionMatrix),Pt.projectionMatrixInverse.copy(Pt.projectionMatrix).invert(),Pt.viewport.set(Ft.x,Ft.y,Ft.width,Ft.height),Ut===0&&(L.matrix.copy(Pt.matrix),L.matrix.decompose(L.position,L.quaternion,L.scale)),mt===!0&&L.cameras.push(Pt)}let St=s.enabledFeatures;if(St&&St.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&S){p=i.getBinding();let Ut=p.getDepthInformation(rt[0]);Ut&&Ut.isValid&&Ut.texture&&g.init(Ut,s.renderState)}if(St&&St.includes("camera-access")&&S){t.state.unbindTexture(),p=i.getBinding();for(let Ut=0;Ut<rt.length;Ut++){let Vt=rt[Ut].camera;if(Vt){let Ft=f[Vt];Ft||(Ft=new jl,f[Vt]=Ft);let Pt=p.getCameraImage(Vt);Ft.sourceTexture=Pt}}}}for(let rt=0;rt<T.length;rt++){let mt=A[rt],St=T[rt];mt!==null&&St!==void 0&&St.update(mt,ft,l||r)}Zt&&Zt(Q,ft),ft.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:ft}),m=null}let $t=new dM;$t.setAnimationLoop(ce),this.setAnimationLoop=function(Q){Zt=Q},this.dispose=function(){}}},i3=new Oe,yM=new Ht;yM.set(-1,0,0,0,1,0,0,0,1);function s3(e,t){function n(g,f){g.matrixAutoUpdate===!0&&g.updateMatrix(),f.value.copy(g.matrix)}function i(g,f){f.color.getRGB(g.fogColor.value,f0(e)),f.isFog?(g.fogNear.value=f.near,g.fogFar.value=f.far):f.isFogExp2&&(g.fogDensity.value=f.density)}function s(g,f,_,x,v){f.isNodeMaterial?f.uniformsNeedUpdate=!1:f.isMeshBasicMaterial?a(g,f):f.isMeshLambertMaterial?(a(g,f),f.envMap&&(g.envMapIntensity.value=f.envMapIntensity)):f.isMeshToonMaterial?(a(g,f),p(g,f)):f.isMeshPhongMaterial?(a(g,f),h(g,f),f.envMap&&(g.envMapIntensity.value=f.envMapIntensity)):f.isMeshStandardMaterial?(a(g,f),u(g,f),f.isMeshPhysicalMaterial&&d(g,f,v)):f.isMeshMatcapMaterial?(a(g,f),m(g,f)):f.isMeshDepthMaterial?a(g,f):f.isMeshDistanceMaterial?(a(g,f),S(g,f)):f.isMeshNormalMaterial?a(g,f):f.isLineBasicMaterial?(r(g,f),f.isLineDashedMaterial&&o(g,f)):f.isPointsMaterial?c(g,f,_,x):f.isSpriteMaterial?l(g,f):f.isShadowMaterial?(g.color.value.copy(f.color),g.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function a(g,f){g.opacity.value=f.opacity,f.color&&g.diffuse.value.copy(f.color),f.emissive&&g.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(g.map.value=f.map,n(f.map,g.mapTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,n(f.alphaMap,g.alphaMapTransform)),f.bumpMap&&(g.bumpMap.value=f.bumpMap,n(f.bumpMap,g.bumpMapTransform),g.bumpScale.value=f.bumpScale,f.side===An&&(g.bumpScale.value*=-1)),f.normalMap&&(g.normalMap.value=f.normalMap,n(f.normalMap,g.normalMapTransform),g.normalScale.value.copy(f.normalScale),f.side===An&&g.normalScale.value.negate()),f.displacementMap&&(g.displacementMap.value=f.displacementMap,n(f.displacementMap,g.displacementMapTransform),g.displacementScale.value=f.displacementScale,g.displacementBias.value=f.displacementBias),f.emissiveMap&&(g.emissiveMap.value=f.emissiveMap,n(f.emissiveMap,g.emissiveMapTransform)),f.specularMap&&(g.specularMap.value=f.specularMap,n(f.specularMap,g.specularMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest);let _=t.get(f),x=_.envMap,v=_.envMapRotation;x&&(g.envMap.value=x,g.envMapRotation.value.setFromMatrix4(i3.makeRotationFromEuler(v)).transpose(),x.isCubeTexture&&x.isRenderTargetTexture===!1&&g.envMapRotation.value.premultiply(yM),g.reflectivity.value=f.reflectivity,g.ior.value=f.ior,g.refractionRatio.value=f.refractionRatio),f.lightMap&&(g.lightMap.value=f.lightMap,g.lightMapIntensity.value=f.lightMapIntensity,n(f.lightMap,g.lightMapTransform)),f.aoMap&&(g.aoMap.value=f.aoMap,g.aoMapIntensity.value=f.aoMapIntensity,n(f.aoMap,g.aoMapTransform))}function r(g,f){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,f.map&&(g.map.value=f.map,n(f.map,g.mapTransform))}function o(g,f){g.dashSize.value=f.dashSize,g.totalSize.value=f.dashSize+f.gapSize,g.scale.value=f.scale}function c(g,f,_,x){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,g.size.value=f.size*_,g.scale.value=x*.5,f.map&&(g.map.value=f.map,n(f.map,g.uvTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,n(f.alphaMap,g.alphaMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest)}function l(g,f){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,g.rotation.value=f.rotation,f.map&&(g.map.value=f.map,n(f.map,g.mapTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,n(f.alphaMap,g.alphaMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest)}function h(g,f){g.specular.value.copy(f.specular),g.shininess.value=Math.max(f.shininess,1e-4)}function p(g,f){f.gradientMap&&(g.gradientMap.value=f.gradientMap)}function u(g,f){g.metalness.value=f.metalness,f.metalnessMap&&(g.metalnessMap.value=f.metalnessMap,n(f.metalnessMap,g.metalnessMapTransform)),g.roughness.value=f.roughness,f.roughnessMap&&(g.roughnessMap.value=f.roughnessMap,n(f.roughnessMap,g.roughnessMapTransform)),f.envMap&&(g.envMapIntensity.value=f.envMapIntensity)}function d(g,f,_){g.ior.value=f.ior,f.sheen>0&&(g.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),g.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(g.sheenColorMap.value=f.sheenColorMap,n(f.sheenColorMap,g.sheenColorMapTransform)),f.sheenRoughnessMap&&(g.sheenRoughnessMap.value=f.sheenRoughnessMap,n(f.sheenRoughnessMap,g.sheenRoughnessMapTransform))),f.clearcoat>0&&(g.clearcoat.value=f.clearcoat,g.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(g.clearcoatMap.value=f.clearcoatMap,n(f.clearcoatMap,g.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,n(f.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(g.clearcoatNormalMap.value=f.clearcoatNormalMap,n(f.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===An&&g.clearcoatNormalScale.value.negate())),f.dispersion>0&&(g.dispersion.value=f.dispersion),f.iridescence>0&&(g.iridescence.value=f.iridescence,g.iridescenceIOR.value=f.iridescenceIOR,g.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(g.iridescenceMap.value=f.iridescenceMap,n(f.iridescenceMap,g.iridescenceMapTransform)),f.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=f.iridescenceThicknessMap,n(f.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),f.transmission>0&&(g.transmission.value=f.transmission,g.transmissionSamplerMap.value=_.texture,g.transmissionSamplerSize.value.set(_.width,_.height),f.transmissionMap&&(g.transmissionMap.value=f.transmissionMap,n(f.transmissionMap,g.transmissionMapTransform)),g.thickness.value=f.thickness,f.thicknessMap&&(g.thicknessMap.value=f.thicknessMap,n(f.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=f.attenuationDistance,g.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(g.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(g.anisotropyMap.value=f.anisotropyMap,n(f.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=f.specularIntensity,g.specularColor.value.copy(f.specularColor),f.specularColorMap&&(g.specularColorMap.value=f.specularColorMap,n(f.specularColorMap,g.specularColorMapTransform)),f.specularIntensityMap&&(g.specularIntensityMap.value=f.specularIntensityMap,n(f.specularIntensityMap,g.specularIntensityMapTransform))}function m(g,f){f.matcap&&(g.matcap.value=f.matcap)}function S(g,f){let _=t.get(f).light;g.referencePosition.value.setFromMatrixPosition(_.matrixWorld),g.nearDistance.value=_.shadow.camera.near,g.farDistance.value=_.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:s}}function a3(e,t,n,i){let s={},a={},r=[],o=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(v,T){let A=T.program;i.uniformBlockBinding(v,A)}function l(v,T){let A=s[v.id];A===void 0&&(g(v),A=h(v),s[v.id]=A,v.addEventListener("dispose",_));let w=T.program;i.updateUBOMapping(v,w);let y=t.render.frame;a[v.id]!==y&&(u(v),a[v.id]=y)}function h(v){let T=p();v.__bindingPointIndex=T;let A=e.createBuffer(),w=v.__size,y=v.usage;return e.bindBuffer(e.UNIFORM_BUFFER,A),e.bufferData(e.UNIFORM_BUFFER,w,y),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,T,A),A}function p(){for(let v=0;v<o;v++)if(r.indexOf(v)===-1)return r.push(v),v;return zt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(v){let T=s[v.id],A=v.uniforms,w=v.__cache;e.bindBuffer(e.UNIFORM_BUFFER,T);for(let y=0,M=A.length;y<M;y++){let C=A[y];if(Array.isArray(C))for(let D=0,L=C.length;D<L;D++)d(C[D],y,D,w);else d(C,y,0,w)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function d(v,T,A,w){if(S(v,T,A,w)===!0){let y=v.__offset,M=v.value;if(Array.isArray(M)){let C=0;for(let D=0;D<M.length;D++){let L=M[D],P=f(L);m(L,v.__data,C),typeof L!="number"&&typeof L!="boolean"&&!L.isMatrix3&&!ArrayBuffer.isView(L)&&(C+=P.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(M,v.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,y,v.__data)}}function m(v,T,A){typeof v=="number"||typeof v=="boolean"?T[0]=v:v.isMatrix3?(T[0]=v.elements[0],T[1]=v.elements[1],T[2]=v.elements[2],T[3]=0,T[4]=v.elements[3],T[5]=v.elements[4],T[6]=v.elements[5],T[7]=0,T[8]=v.elements[6],T[9]=v.elements[7],T[10]=v.elements[8],T[11]=0):ArrayBuffer.isView(v)?T.set(new v.constructor(v.buffer,v.byteOffset,T.length)):v.toArray(T,A)}function S(v,T,A,w){let y=v.value,M=T+"_"+A;if(w[M]===void 0)return typeof y=="number"||typeof y=="boolean"?w[M]=y:ArrayBuffer.isView(y)?w[M]=y.slice():w[M]=y.clone(),!0;{let C=w[M];if(typeof y=="number"||typeof y=="boolean"){if(C!==y)return w[M]=y,!0}else{if(ArrayBuffer.isView(y))return!0;if(C.equals(y)===!1)return C.copy(y),!0}}return!1}function g(v){let T=v.uniforms,A=0,w=16;for(let M=0,C=T.length;M<C;M++){let D=Array.isArray(T[M])?T[M]:[T[M]];for(let L=0,P=D.length;L<P;L++){let W=D[L],B=Array.isArray(W.value)?W.value:[W.value];for(let q=0,X=B.length;q<X;q++){let et=B[q],at=f(et),ut=A%w,pt=ut%at.boundary,bt=ut+pt;A+=pt,bt!==0&&w-bt<at.storage&&(A+=w-bt),W.__data=new Float32Array(at.storage/Float32Array.BYTES_PER_ELEMENT),W.__offset=A,A+=at.storage}}}let y=A%w;return y>0&&(A+=w-y),v.__size=A,v.__cache={},this}function f(v){let T={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(T.boundary=4,T.storage=4):v.isVector2?(T.boundary=8,T.storage=8):v.isVector3||v.isColor?(T.boundary=16,T.storage=12):v.isVector4?(T.boundary=16,T.storage=16):v.isMatrix3?(T.boundary=48,T.storage=48):v.isMatrix4?(T.boundary=64,T.storage=64):v.isTexture?Ot("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(T.boundary=16,T.storage=v.byteLength):Ot("WebGLRenderer: Unsupported uniform value type.",v),T}function _(v){let T=v.target;T.removeEventListener("dispose",_);let A=r.indexOf(T.__bindingPointIndex);r.splice(A,1),e.deleteBuffer(s[T.id]),delete s[T.id],delete a[T.id]}function x(){for(let v in s)e.deleteBuffer(s[v]);r=[],s={},a={}}return{bind:c,update:l,dispose:x}}var r3=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Ki=null;function o3(){return Ki===null&&(Ki=new Yh(r3,16,16,Sa,Ji),Ki.name="DFG_LUT",Ki.minFilter=dn,Ki.magFilter=dn,Ki.wrapS=Hi,Ki.wrapT=Hi,Ki.generateMipmaps=!1,Ki.needsUpdate=!0),Ki}var dd=class{constructor(t={}){let{canvas:n=BS(),context:i=null,depth:s=!0,stencil:a=!1,alpha:r=!1,antialias:o=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:p=!1,reversedDepthBuffer:u=!1,outputBufferType:d=ei}=t;this.isWebGLRenderer=!0;let m;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");m=i.getContextAttributes().alpha}else m=r;let S=d,g=new Set([Df,Rf,Cf]),f=new Set([ei,Ai,bo,So,Af,wf]),_=new Uint32Array(4),x=new Int32Array(4),v=new U,T=null,A=null,w=[],y=[],M=null;this.domElement=n,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Ti,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let C=this,D=!1,L=null,P=null,W=null,B=null;this._outputColorSpace=Tn;let q=0,X=0,et=null,at=-1,ut=null,pt=new Pe,bt=new Pe,Zt=null,ce=new Qt(0),$t=0,Q=n.width,ft=n.height,rt=1,mt=null,St=null,wt=new Pe(0,0,Q,ft),Yt=new Pe(0,0,Q,ft),Ut=!1,Vt=new Jl,Ft=!1,Pt=!1,Ee=new Oe,ae=new U,Ue=new Pe,ze={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},ye=!1;function Te(){return et===null?rt:1}let O=i;function pn(E,z){return n.getContext(E,z)}try{let E={alpha:!0,depth:s,stencil:a,antialias:o,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:h,failIfMajorPerformanceCaveat:p};if("setAttribute"in n&&n.setAttribute("data-engine",`three.js r${bf}`),n.addEventListener("webglcontextlost",Ae,!1),n.addEventListener("webglcontextrestored",xe,!1),n.addEventListener("webglcontextcreationerror",Ci,!1),O===null){let z="webgl2";if(O=pn(z,E),O===null)throw pn(z)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(E){throw zt("WebGLRenderer: "+E.message),E}let re,R,b,F,k,Z,ct,_t,K,nt,gt,Ct,dt,ht,Rt,I,tt,N,j,V,ot,lt,$;function Tt(){re=new pR(O),re.init(),ot=new t3(O,re),R=new rR(O,re,t,ot),b=new Q2(O,re),R.reversedDepthBuffer&&u&&b.buffers.depth.setReversed(!0),P=O.createFramebuffer(),W=O.createFramebuffer(),B=O.createFramebuffer(),F=new _R(O),k=new B2,Z=new $2(O,re,b,k,R,ot,F),ct=new dR(C),_t=new bA(O),lt=new sR(O,_t),K=new mR(O,_t,F,lt),nt=new yR(O,K,_t,lt,F),N=new vR(O,R,Z),Rt=new oR(k),gt=new z2(C,ct,re,R,lt,Rt),Ct=new s3(C,k),dt=new V2,ht=new q2(re),tt=new iR(C,ct,b,nt,m,c),I=new j2(C,nt,R),$=new a3(O,F,R,b),j=new aR(O,re,F),V=new gR(O,re,F),F.programs=gt.programs,C.capabilities=R,C.extensions=re,C.properties=k,C.renderLists=dt,C.shadowMap=I,C.state=b,C.info=F}Tt(),S!==ei&&(M=new bR(S,n.width,n.height,o,s,a));let At=new D0(C,O);this.xr=At,this.getContext=function(){return O},this.getContextAttributes=function(){return O.getContextAttributes()},this.forceContextLoss=function(){let E=re.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){let E=re.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return rt},this.setPixelRatio=function(E){E!==void 0&&(rt=E,this.setSize(Q,ft,!1))},this.getSize=function(E){return E.set(Q,ft)},this.setSize=function(E,z,Y=!0){if(At.isPresenting){Ot("WebGLRenderer: Can't change size while VR device is presenting.");return}Q=E,ft=z,n.width=Math.floor(E*rt),n.height=Math.floor(z*rt),Y===!0&&(n.style.width=E+"px",n.style.height=z+"px"),M!==null&&M.setSize(n.width,n.height),this.setViewport(0,0,E,z)},this.getDrawingBufferSize=function(E){return E.set(Q*rt,ft*rt).floor()},this.setDrawingBufferSize=function(E,z,Y){Q=E,ft=z,rt=Y,n.width=Math.floor(E*Y),n.height=Math.floor(z*Y),this.setViewport(0,0,E,z)},this.setEffects=function(E){if(S===ei){zt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(E){for(let z=0;z<E.length;z++)if(E[z].isOutputPass===!0){Ot("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}M.setEffects(E||[])},this.getCurrentViewport=function(E){return E.copy(pt)},this.getViewport=function(E){return E.copy(wt)},this.setViewport=function(E,z,Y,H){E.isVector4?wt.set(E.x,E.y,E.z,E.w):wt.set(E,z,Y,H),b.viewport(pt.copy(wt).multiplyScalar(rt).round())},this.getScissor=function(E){return E.copy(Yt)},this.setScissor=function(E,z,Y,H){E.isVector4?Yt.set(E.x,E.y,E.z,E.w):Yt.set(E,z,Y,H),b.scissor(bt.copy(Yt).multiplyScalar(rt).round())},this.getScissorTest=function(){return Ut},this.setScissorTest=function(E){b.setScissorTest(Ut=E)},this.setOpaqueSort=function(E){mt=E},this.setTransparentSort=function(E){St=E},this.getClearColor=function(E){return E.copy(tt.getClearColor())},this.setClearColor=function(){tt.setClearColor(...arguments)},this.getClearAlpha=function(){return tt.getClearAlpha()},this.setClearAlpha=function(){tt.setClearAlpha(...arguments)},this.clear=function(E=!0,z=!0,Y=!0){let H=0;if(E){let G=!1;if(et!==null){let xt=et.texture.format;G=g.has(xt)}if(G){let xt=et.texture.type,Et=f.has(xt),yt=tt.getClearColor(),Dt=tt.getClearAlpha(),Nt=yt.r,kt=yt.g,qt=yt.b;Et?(_[0]=Nt,_[1]=kt,_[2]=qt,_[3]=Dt,O.clearBufferuiv(O.COLOR,0,_)):(x[0]=Nt,x[1]=kt,x[2]=qt,x[3]=Dt,O.clearBufferiv(O.COLOR,0,x))}else H|=O.COLOR_BUFFER_BIT}z&&(H|=O.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),Y&&(H|=O.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),H!==0&&O.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(E){E.setRenderer(this),L=E},this.dispose=function(){n.removeEventListener("webglcontextlost",Ae,!1),n.removeEventListener("webglcontextrestored",xe,!1),n.removeEventListener("webglcontextcreationerror",Ci,!1),tt.dispose(),dt.dispose(),ht.dispose(),k.dispose(),ct.dispose(),nt.dispose(),lt.dispose(),$.dispose(),gt.dispose(),At.dispose(),At.removeEventListener("sessionstart",P0),At.removeEventListener("sessionend",z0),Ta.stop()};function Ae(E){E.preventDefault(),u0("WebGLRenderer: Context Lost."),D=!0}function xe(){u0("WebGLRenderer: Context Restored."),D=!1;let E=F.autoReset,z=I.enabled,Y=I.autoUpdate,H=I.needsUpdate,G=I.type;Tt(),F.autoReset=E,I.enabled=z,I.autoUpdate=Y,I.needsUpdate=H,I.type=G}function Ci(E){zt("WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function Ri(E){let z=E.target;z.removeEventListener("dispose",Ri),DM(z)}function DM(E){NM(E),k.remove(E)}function NM(E){let z=k.get(E).programs;z!==void 0&&(z.forEach(function(Y){gt.releaseProgram(Y)}),E.isShaderMaterial&&gt.releaseShaderCache(E))}this.renderBufferDirect=function(E,z,Y,H,G,xt){z===null&&(z=ze);let Et=G.isMesh&&G.matrixWorld.determinantAffine()<0,yt=IM(E,z,Y,H,G);b.setMaterial(H,Et);let Dt=Y.index,Nt=1;if(H.wireframe===!0){if(Dt=K.getWireframeAttribute(Y),Dt===void 0)return;Nt=2}let kt=Y.drawRange,qt=Y.attributes.position,Lt=kt.start*Nt,de=(kt.start+kt.count)*Nt;xt!==null&&(Lt=Math.max(Lt,xt.start*Nt),de=Math.min(de,(xt.start+xt.count)*Nt)),Dt!==null?(Lt=Math.max(Lt,0),de=Math.min(de,Dt.count)):qt!=null&&(Lt=Math.max(Lt,0),de=Math.min(de,qt.count));let Ge=de-Lt;if(Ge<0||Ge===1/0)return;lt.setup(G,H,yt,Y,Dt);let Be,ge=j;if(Dt!==null&&(Be=_t.get(Dt),ge=V,ge.setIndex(Be)),G.isMesh)H.wireframe===!0?(b.setLineWidth(H.wireframeLinewidth*Te()),ge.setMode(O.LINES)):ge.setMode(O.TRIANGLES);else if(G.isLine){let mn=H.linewidth;mn===void 0&&(mn=1),b.setLineWidth(mn*Te()),G.isLineSegments?ge.setMode(O.LINES):G.isLineLoop?ge.setMode(O.LINE_LOOP):ge.setMode(O.LINE_STRIP)}else G.isPoints?ge.setMode(O.POINTS):G.isSprite&&ge.setMode(O.TRIANGLES);if(G.isBatchedMesh)if(re.get("WEBGL_multi_draw"))ge.renderMultiDraw(G._multiDrawStarts,G._multiDrawCounts,G._multiDrawCount);else{let mn=G._multiDrawStarts,Mt=G._multiDrawCounts,Pn=G._multiDrawCount,se=Dt?_t.get(Dt).bytesPerElement:1,ni=k.get(H).currentProgram.getUniforms();for(let Di=0;Di<Pn;Di++)ni.setValue(O,"_gl_DrawID",Di),ge.render(mn[Di]/se,Mt[Di])}else if(G.isInstancedMesh)ge.renderInstances(Lt,Ge,G.count);else if(Y.isInstancedBufferGeometry){let mn=Y._maxInstanceCount!==void 0?Y._maxInstanceCount:1/0,Mt=Math.min(Y.instanceCount,mn);ge.renderInstances(Lt,Ge,Mt)}else ge.render(Lt,Ge)};function O0(E,z,Y){E.transparent===!0&&E.side===ti&&E.forceSinglePass===!1?(E.side=An,E.needsUpdate=!0,Tc(E,z,Y),E.side=Ts,E.needsUpdate=!0,Tc(E,z,Y),E.side=ti):Tc(E,z,Y)}this.compile=function(E,z,Y=null){Y===null&&(Y=E),A=ht.get(Y),A.init(z),y.push(A),Y.traverseVisible(function(G){G.isLight&&G.layers.test(z.layers)&&(A.pushLight(G),G.castShadow&&A.pushShadow(G))}),E!==Y&&E.traverseVisible(function(G){G.isLight&&G.layers.test(z.layers)&&(A.pushLight(G),G.castShadow&&A.pushShadow(G))}),A.setupLights();let H=new Set;return E.traverse(function(G){if(!(G.isMesh||G.isPoints||G.isLine||G.isSprite))return;let xt=G.material;if(xt)if(Array.isArray(xt))for(let Et=0;Et<xt.length;Et++){let yt=xt[Et];O0(yt,Y,G),H.add(yt)}else O0(xt,Y,G),H.add(xt)}),A=y.pop(),H},this.compileAsync=function(E,z,Y=null){let H=this.compile(E,z,Y);return new Promise(G=>{function xt(){if(H.forEach(function(Et){k.get(Et).currentProgram.isReady()&&H.delete(Et)}),H.size===0){G(E);return}setTimeout(xt,10)}re.get("KHR_parallel_shader_compile")!==null?xt():setTimeout(xt,10)})};let xd=null;function UM(E){xd&&xd(E)}function P0(){Ta.stop()}function z0(){Ta.start()}let Ta=new dM;Ta.setAnimationLoop(UM),typeof self<"u"&&Ta.setContext(self),this.setAnimationLoop=function(E){xd=E,At.setAnimationLoop(E),E===null?Ta.stop():Ta.start()},At.addEventListener("sessionstart",P0),At.addEventListener("sessionend",z0),this.render=function(E,z){if(z!==void 0&&z.isCamera!==!0){zt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(D===!0)return;L!==null&&L.renderStart(E,z);let Y=At.enabled===!0&&At.isPresenting===!0,H=M!==null&&(et===null||Y)&&M.begin(C,et);if(E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),z.parent===null&&z.matrixWorldAutoUpdate===!0&&z.updateMatrixWorld(),At.enabled===!0&&At.isPresenting===!0&&(M===null||M.isCompositing()===!1)&&(At.cameraAutoUpdate===!0&&At.updateCamera(z),z=At.getCamera()),E.isScene===!0&&E.onBeforeRender(C,E,z,et),A=ht.get(E,y.length),A.init(z),A.state.textureUnits=Z.getTextureUnits(),y.push(A),Ee.multiplyMatrices(z.projectionMatrix,z.matrixWorldInverse),Vt.setFromProjectionMatrix(Ee,Ei,z.reversedDepth),Pt=this.localClippingEnabled,Ft=Rt.init(this.clippingPlanes,Pt),T=dt.get(E,w.length),T.init(),w.push(T),At.enabled===!0&&At.isPresenting===!0){let Et=C.xr.getDepthSensingMesh();Et!==null&&bd(Et,z,-1/0,C.sortObjects)}bd(E,z,0,C.sortObjects),T.finish(),C.sortObjects===!0&&T.sort(mt,St,z.reversedDepth),ye=At.enabled===!1||At.isPresenting===!1||At.hasDepthSensing()===!1,ye&&tt.addToRenderList(T,E),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Ft===!0&&Rt.beginShadows();let G=A.state.shadowsArray;if(I.render(G,E,z),Ft===!0&&Rt.endShadows(),(H&&M.hasRenderPass())===!1){let Et=T.opaque,yt=T.transmissive;if(A.setupLights(),z.isArrayCamera){let Dt=z.cameras;if(yt.length>0)for(let Nt=0,kt=Dt.length;Nt<kt;Nt++){let qt=Dt[Nt];F0(Et,yt,E,qt)}ye&&tt.render(E);for(let Nt=0,kt=Dt.length;Nt<kt;Nt++){let qt=Dt[Nt];B0(T,E,qt,qt.viewport)}}else yt.length>0&&F0(Et,yt,E,z),ye&&tt.render(E),B0(T,E,z)}et!==null&&X===0&&(Z.updateMultisampleRenderTarget(et),Z.updateRenderTargetMipmap(et)),H&&M.end(C),E.isScene===!0&&E.onAfterRender(C,E,z),lt.resetDefaultState(),at=-1,ut=null,y.pop(),y.length>0?(A=y[y.length-1],Z.setTextureUnits(A.state.textureUnits),Ft===!0&&Rt.setGlobalState(C.clippingPlanes,A.state.camera)):A=null,w.pop(),w.length>0?T=w[w.length-1]:T=null,L!==null&&L.renderEnd()};function bd(E,z,Y,H){if(E.visible===!1)return;if(E.layers.test(z.layers)){if(E.isGroup)Y=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(z);else if(E.isLightProbeGrid)A.pushLightProbeGrid(E);else if(E.isLight)A.pushLight(E),E.castShadow&&A.pushShadow(E);else if(E.isSprite){if(!E.frustumCulled||Vt.intersectsSprite(E)){H&&Ue.setFromMatrixPosition(E.matrixWorld).applyMatrix4(Ee);let Et=nt.update(E),yt=E.material;yt.visible&&T.push(E,Et,yt,Y,Ue.z,null)}}else if((E.isMesh||E.isLine||E.isPoints)&&(!E.frustumCulled||Vt.intersectsObject(E))){let Et=nt.update(E),yt=E.material;if(H&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),Ue.copy(E.boundingSphere.center)):(Et.boundingSphere===null&&Et.computeBoundingSphere(),Ue.copy(Et.boundingSphere.center)),Ue.applyMatrix4(E.matrixWorld).applyMatrix4(Ee)),Array.isArray(yt)){let Dt=Et.groups;for(let Nt=0,kt=Dt.length;Nt<kt;Nt++){let qt=Dt[Nt],Lt=yt[qt.materialIndex];Lt&&Lt.visible&&T.push(E,Et,Lt,Y,Ue.z,qt)}}else yt.visible&&T.push(E,Et,yt,Y,Ue.z,null)}}let xt=E.children;for(let Et=0,yt=xt.length;Et<yt;Et++)bd(xt[Et],z,Y,H)}function B0(E,z,Y,H){let{opaque:G,transmissive:xt,transparent:Et}=E;A.setupLightsView(Y),Ft===!0&&Rt.setGlobalState(C.clippingPlanes,Y),H&&b.viewport(pt.copy(H)),G.length>0&&Ec(G,z,Y),xt.length>0&&Ec(xt,z,Y),Et.length>0&&Ec(Et,z,Y),b.buffers.depth.setTest(!0),b.buffers.depth.setMask(!0),b.buffers.color.setMask(!0),b.setPolygonOffset(!1)}function F0(E,z,Y,H){if((Y.isScene===!0?Y.overrideMaterial:null)!==null)return;if(A.state.transmissionRenderTarget[H.id]===void 0){let Lt=re.has("EXT_color_buffer_half_float")||re.has("EXT_color_buffer_float");A.state.transmissionRenderTarget[H.id]=new Kn(1,1,{generateMipmaps:!0,type:Lt?Ji:ei,minFilter:xa,samples:Math.max(4,R.samples),stencilBuffer:a,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:ee.workingColorSpace})}let xt=A.state.transmissionRenderTarget[H.id],Et=H.viewport||pt;xt.setSize(Et.z*C.transmissionResolutionScale,Et.w*C.transmissionResolutionScale);let yt=C.getRenderTarget(),Dt=C.getActiveCubeFace(),Nt=C.getActiveMipmapLevel();C.setRenderTarget(xt),C.getClearColor(ce),$t=C.getClearAlpha(),$t<1&&C.setClearColor(16777215,.5),C.clear(),ye&&tt.render(Y);let kt=C.toneMapping;C.toneMapping=Ti;let qt=H.viewport;if(H.viewport!==void 0&&(H.viewport=void 0),A.setupLightsView(H),Ft===!0&&Rt.setGlobalState(C.clippingPlanes,H),Ec(E,Y,H),Z.updateMultisampleRenderTarget(xt),Z.updateRenderTargetMipmap(xt),re.has("WEBGL_multisampled_render_to_texture")===!1){let Lt=!1;for(let de=0,Ge=z.length;de<Ge;de++){let Be=z[de],{object:ge,geometry:mn,material:Mt,group:Pn}=Be;if(Mt.side===ti&&ge.layers.test(H.layers)){let se=Mt.side;Mt.side=An,Mt.needsUpdate=!0,V0(ge,Y,H,mn,Mt,Pn),Mt.side=se,Mt.needsUpdate=!0,Lt=!0}}Lt===!0&&(Z.updateMultisampleRenderTarget(xt),Z.updateRenderTargetMipmap(xt))}C.setRenderTarget(yt,Dt,Nt),C.setClearColor(ce,$t),qt!==void 0&&(H.viewport=qt),C.toneMapping=kt}function Ec(E,z,Y){let H=z.isScene===!0?z.overrideMaterial:null;for(let G=0,xt=E.length;G<xt;G++){let Et=E[G],{object:yt,geometry:Dt,group:Nt}=Et,kt=Et.material;kt.allowOverride===!0&&H!==null&&(kt=H),yt.layers.test(Y.layers)&&V0(yt,z,Y,Dt,kt,Nt)}}function V0(E,z,Y,H,G,xt){E.onBeforeRender(C,z,Y,H,G,xt),E.modelViewMatrix.multiplyMatrices(Y.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),G.onBeforeRender(C,z,Y,H,E,xt),G.transparent===!0&&G.side===ti&&G.forceSinglePass===!1?(G.side=An,G.needsUpdate=!0,C.renderBufferDirect(Y,z,H,G,E,xt),G.side=Ts,G.needsUpdate=!0,C.renderBufferDirect(Y,z,H,G,E,xt),G.side=ti):C.renderBufferDirect(Y,z,H,G,E,xt),E.onAfterRender(C,z,Y,H,G,xt)}function Tc(E,z,Y){z.isScene!==!0&&(z=ze);let H=k.get(E),G=A.state.lights,xt=A.state.shadowsArray,Et=G.state.version,yt=gt.getParameters(E,G.state,xt,z,Y,A.state.lightProbeGridArray),Dt=gt.getProgramCacheKey(yt),Nt=H.programs;H.environment=E.isMeshStandardMaterial||E.isMeshLambertMaterial||E.isMeshPhongMaterial?z.environment:null,H.fog=z.fog;let kt=E.isMeshStandardMaterial||E.isMeshLambertMaterial&&!E.envMap||E.isMeshPhongMaterial&&!E.envMap;H.envMap=ct.get(E.envMap||H.environment,kt),H.envMapRotation=H.environment!==null&&E.envMap===null?z.environmentRotation:E.envMapRotation,Nt===void 0&&(E.addEventListener("dispose",Ri),Nt=new Map,H.programs=Nt);let qt=Nt.get(Dt);if(qt!==void 0){if(H.currentProgram===qt&&H.lightsStateVersion===Et)return G0(E,yt),qt}else yt.uniforms=gt.getUniforms(E),L!==null&&E.isNodeMaterial&&L.build(E,Y,yt),E.onBeforeCompile(yt,C),qt=gt.acquireProgram(yt,Dt),Nt.set(Dt,qt),H.uniforms=yt.uniforms;let Lt=H.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(Lt.clippingPlanes=Rt.uniform),G0(E,yt),H.needsLights=PM(E),H.lightsStateVersion=Et,H.needsLights&&(Lt.ambientLightColor.value=G.state.ambient,Lt.lightProbe.value=G.state.probe,Lt.directionalLights.value=G.state.directional,Lt.directionalLightShadows.value=G.state.directionalShadow,Lt.spotLights.value=G.state.spot,Lt.spotLightShadows.value=G.state.spotShadow,Lt.rectAreaLights.value=G.state.rectArea,Lt.ltc_1.value=G.state.rectAreaLTC1,Lt.ltc_2.value=G.state.rectAreaLTC2,Lt.pointLights.value=G.state.point,Lt.pointLightShadows.value=G.state.pointShadow,Lt.hemisphereLights.value=G.state.hemi,Lt.directionalShadowMatrix.value=G.state.directionalShadowMatrix,Lt.spotLightMatrix.value=G.state.spotLightMatrix,Lt.spotLightMap.value=G.state.spotLightMap,Lt.pointShadowMatrix.value=G.state.pointShadowMatrix),H.lightProbeGrid=A.state.lightProbeGridArray.length>0,H.currentProgram=qt,H.uniformsList=null,qt}function H0(E){if(E.uniformsList===null){let z=E.currentProgram.getUniforms();E.uniformsList=Eo.seqWithValue(z.seq,E.uniforms)}return E.uniformsList}function G0(E,z){let Y=k.get(E);Y.outputColorSpace=z.outputColorSpace,Y.batching=z.batching,Y.batchingColor=z.batchingColor,Y.instancing=z.instancing,Y.instancingColor=z.instancingColor,Y.instancingMorph=z.instancingMorph,Y.skinning=z.skinning,Y.morphTargets=z.morphTargets,Y.morphNormals=z.morphNormals,Y.morphColors=z.morphColors,Y.morphTargetsCount=z.morphTargetsCount,Y.numClippingPlanes=z.numClippingPlanes,Y.numIntersection=z.numClipIntersection,Y.vertexAlphas=z.vertexAlphas,Y.vertexTangents=z.vertexTangents,Y.toneMapping=z.toneMapping}function LM(E,z){if(E.length===0)return null;if(E.length===1)return E[0].texture!==null?E[0]:null;v.setFromMatrixPosition(z.matrixWorld);for(let Y=0,H=E.length;Y<H;Y++){let G=E[Y];if(G.texture!==null&&G.boundingBox.containsPoint(v))return G}return null}function IM(E,z,Y,H,G){z.isScene!==!0&&(z=ze),Z.resetTextureUnits();let xt=z.fog,Et=H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial?z.environment:null,yt=et===null?C.outputColorSpace:et.isXRRenderTarget===!0?et.texture.colorSpace:ee.workingColorSpace,Dt=H.isMeshStandardMaterial||H.isMeshLambertMaterial&&!H.envMap||H.isMeshPhongMaterial&&!H.envMap,Nt=ct.get(H.envMap||Et,Dt),kt=H.vertexColors===!0&&!!Y.attributes.color&&Y.attributes.color.itemSize===4,qt=!!Y.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Lt=!!Y.morphAttributes.position,de=!!Y.morphAttributes.normal,Ge=!!Y.morphAttributes.color,Be=Ti;H.toneMapped&&(et===null||et.isXRRenderTarget===!0)&&(Be=C.toneMapping);let ge=Y.morphAttributes.position||Y.morphAttributes.normal||Y.morphAttributes.color,mn=ge!==void 0?ge.length:0,Mt=k.get(H),Pn=A.state.lights;if(Ft===!0&&(Pt===!0||E!==ut)){let be=E===ut&&H.id===at;Rt.setState(H,E,be)}let se=!1;H.version===Mt.__version?(Mt.needsLights&&Mt.lightsStateVersion!==Pn.state.version||Mt.outputColorSpace!==yt||G.isBatchedMesh&&Mt.batching===!1||!G.isBatchedMesh&&Mt.batching===!0||G.isBatchedMesh&&Mt.batchingColor===!0&&G.colorTexture===null||G.isBatchedMesh&&Mt.batchingColor===!1&&G.colorTexture!==null||G.isInstancedMesh&&Mt.instancing===!1||!G.isInstancedMesh&&Mt.instancing===!0||G.isSkinnedMesh&&Mt.skinning===!1||!G.isSkinnedMesh&&Mt.skinning===!0||G.isInstancedMesh&&Mt.instancingColor===!0&&G.instanceColor===null||G.isInstancedMesh&&Mt.instancingColor===!1&&G.instanceColor!==null||G.isInstancedMesh&&Mt.instancingMorph===!0&&G.morphTexture===null||G.isInstancedMesh&&Mt.instancingMorph===!1&&G.morphTexture!==null||Mt.envMap!==Nt||H.fog===!0&&Mt.fog!==xt||Mt.numClippingPlanes!==void 0&&(Mt.numClippingPlanes!==Rt.numPlanes||Mt.numIntersection!==Rt.numIntersection)||Mt.vertexAlphas!==kt||Mt.vertexTangents!==qt||Mt.morphTargets!==Lt||Mt.morphNormals!==de||Mt.morphColors!==Ge||Mt.toneMapping!==Be||Mt.morphTargetsCount!==mn||!!Mt.lightProbeGrid!=A.state.lightProbeGridArray.length>0)&&(se=!0):(se=!0,Mt.__version=H.version);let ni=Mt.currentProgram;se===!0&&(ni=Tc(H,z,G),L&&H.isNodeMaterial&&L.onUpdateProgram(H,ni,Mt));let Di=!1,Cs=!1,ar=!1,_e=ni.getUniforms(),ke=Mt.uniforms;if(b.useProgram(ni.program)&&(Di=!0,Cs=!0,ar=!0),H.id!==at&&(at=H.id,Cs=!0),Mt.needsLights){let be=LM(A.state.lightProbeGridArray,G);Mt.lightProbeGrid!==be&&(Mt.lightProbeGrid=be,Cs=!0)}if(Di||ut!==E){b.buffers.depth.getReversed()&&E.reversedDepth!==!0&&(E._reversedDepth=!0,E.updateProjectionMatrix()),_e.setValue(O,"projectionMatrix",E.projectionMatrix),_e.setValue(O,"viewMatrix",E.matrixWorldInverse);let Ds=_e.map.cameraPosition;Ds!==void 0&&Ds.setValue(O,ae.setFromMatrixPosition(E.matrixWorld)),R.logarithmicDepthBuffer&&_e.setValue(O,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&_e.setValue(O,"isOrthographic",E.isOrthographicCamera===!0),ut!==E&&(ut=E,Cs=!0,ar=!0)}if(Mt.needsLights&&(Pn.state.directionalShadowMap.length>0&&_e.setValue(O,"directionalShadowMap",Pn.state.directionalShadowMap,Z),Pn.state.spotShadowMap.length>0&&_e.setValue(O,"spotShadowMap",Pn.state.spotShadowMap,Z),Pn.state.pointShadowMap.length>0&&_e.setValue(O,"pointShadowMap",Pn.state.pointShadowMap,Z)),G.isSkinnedMesh){_e.setOptional(O,G,"bindMatrix"),_e.setOptional(O,G,"bindMatrixInverse");let be=G.skeleton;be&&(be.boneTexture===null&&be.computeBoneTexture(),_e.setValue(O,"boneTexture",be.boneTexture,Z))}G.isBatchedMesh&&(_e.setOptional(O,G,"batchingTexture"),_e.setValue(O,"batchingTexture",G._matricesTexture,Z),_e.setOptional(O,G,"batchingIdTexture"),_e.setValue(O,"batchingIdTexture",G._indirectTexture,Z),_e.setOptional(O,G,"batchingColorTexture"),G._colorsTexture!==null&&_e.setValue(O,"batchingColorTexture",G._colorsTexture,Z));let Rs=Y.morphAttributes;if((Rs.position!==void 0||Rs.normal!==void 0||Rs.color!==void 0)&&N.update(G,Y,ni),(Cs||Mt.receiveShadow!==G.receiveShadow)&&(Mt.receiveShadow=G.receiveShadow,_e.setValue(O,"receiveShadow",G.receiveShadow)),(H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial)&&H.envMap===null&&z.environment!==null&&(ke.envMapIntensity.value=z.environmentIntensity),ke.dfgLUT!==void 0&&(ke.dfgLUT.value=o3()),Cs){if(_e.setValue(O,"toneMappingExposure",C.toneMappingExposure),Mt.needsLights&&OM(ke,ar),xt&&H.fog===!0&&Ct.refreshFogUniforms(ke,xt),Ct.refreshMaterialUniforms(ke,H,rt,ft,A.state.transmissionRenderTarget[E.id]),Mt.needsLights&&Mt.lightProbeGrid){let be=Mt.lightProbeGrid;ke.probesSH.value=be.texture,ke.probesMin.value.copy(be.boundingBox.min),ke.probesMax.value.copy(be.boundingBox.max),ke.probesResolution.value.copy(be.resolution)}Eo.upload(O,H0(Mt),ke,Z)}if(H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(Eo.upload(O,H0(Mt),ke,Z),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&_e.setValue(O,"center",G.center),_e.setValue(O,"modelViewMatrix",G.modelViewMatrix),_e.setValue(O,"normalMatrix",G.normalMatrix),_e.setValue(O,"modelMatrix",G.matrixWorld),H.uniformsGroups!==void 0){let be=H.uniformsGroups;for(let Ds=0,rr=be.length;Ds<rr;Ds++){let k0=be[Ds];$.update(k0,ni),$.bind(k0,ni)}}return ni}function OM(E,z){E.ambientLightColor.needsUpdate=z,E.lightProbe.needsUpdate=z,E.directionalLights.needsUpdate=z,E.directionalLightShadows.needsUpdate=z,E.pointLights.needsUpdate=z,E.pointLightShadows.needsUpdate=z,E.spotLights.needsUpdate=z,E.spotLightShadows.needsUpdate=z,E.rectAreaLights.needsUpdate=z,E.hemisphereLights.needsUpdate=z}function PM(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return q},this.getActiveMipmapLevel=function(){return X},this.getRenderTarget=function(){return et},this.setRenderTargetTextures=function(E,z,Y){let H=k.get(E);H.__autoAllocateDepthBuffer=E.resolveDepthBuffer===!1,H.__autoAllocateDepthBuffer===!1&&(H.__useRenderToTexture=!1),k.get(E.texture).__webglTexture=z,k.get(E.depthTexture).__webglTexture=H.__autoAllocateDepthBuffer?void 0:Y,H.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(E,z){let Y=k.get(E);Y.__webglFramebuffer=z,Y.__useDefaultFramebuffer=z===void 0},this.setRenderTarget=function(E,z=0,Y=0){et=E,q=z,X=Y;let H=null,G=!1,xt=!1;if(E){let yt=k.get(E);if(yt.__useDefaultFramebuffer!==void 0){b.bindFramebuffer(O.FRAMEBUFFER,yt.__webglFramebuffer),pt.copy(E.viewport),bt.copy(E.scissor),Zt=E.scissorTest,b.viewport(pt),b.scissor(bt),b.setScissorTest(Zt),at=-1;return}else if(yt.__webglFramebuffer===void 0)Z.setupRenderTarget(E);else if(yt.__hasExternalTextures)Z.rebindTextures(E,k.get(E.texture).__webglTexture,k.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){let kt=E.depthTexture;if(yt.__boundDepthTexture!==kt){if(kt!==null&&k.has(kt)&&(E.width!==kt.image.width||E.height!==kt.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Z.setupDepthRenderbuffer(E)}}let Dt=E.texture;(Dt.isData3DTexture||Dt.isDataArrayTexture||Dt.isCompressedArrayTexture)&&(xt=!0);let Nt=k.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(Nt[z])?H=Nt[z][Y]:H=Nt[z],G=!0):E.samples>0&&Z.useMultisampledRTT(E)===!1?H=k.get(E).__webglMultisampledFramebuffer:Array.isArray(Nt)?H=Nt[Y]:H=Nt,pt.copy(E.viewport),bt.copy(E.scissor),Zt=E.scissorTest}else pt.copy(wt).multiplyScalar(rt).floor(),bt.copy(Yt).multiplyScalar(rt).floor(),Zt=Ut;if(Y!==0&&(H=P),b.bindFramebuffer(O.FRAMEBUFFER,H)&&b.drawBuffers(E,H),b.viewport(pt),b.scissor(bt),b.setScissorTest(Zt),G){let yt=k.get(E.texture);O.framebufferTexture2D(O.FRAMEBUFFER,O.COLOR_ATTACHMENT0,O.TEXTURE_CUBE_MAP_POSITIVE_X+z,yt.__webglTexture,Y)}else if(xt){let yt=z;for(let Dt=0;Dt<E.textures.length;Dt++){let Nt=k.get(E.textures[Dt]);O.framebufferTextureLayer(O.FRAMEBUFFER,O.COLOR_ATTACHMENT0+Dt,Nt.__webglTexture,Y,yt)}}else if(E!==null&&Y!==0){let yt=k.get(E.texture);O.framebufferTexture2D(O.FRAMEBUFFER,O.COLOR_ATTACHMENT0,O.TEXTURE_2D,yt.__webglTexture,Y)}at=-1},this.readRenderTargetPixels=function(E,z,Y,H,G,xt,Et,yt=0){if(!(E&&E.isWebGLRenderTarget)){zt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Dt=k.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&Et!==void 0&&(Dt=Dt[Et]),Dt){b.bindFramebuffer(O.FRAMEBUFFER,Dt);try{let Nt=E.textures[yt],kt=Nt.format,qt=Nt.type;if(E.textures.length>1&&O.readBuffer(O.COLOR_ATTACHMENT0+yt),!R.textureFormatReadable(kt)){zt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!R.textureTypeReadable(qt)){zt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}z>=0&&z<=E.width-H&&Y>=0&&Y<=E.height-G&&O.readPixels(z,Y,H,G,ot.convert(kt),ot.convert(qt),xt)}finally{let Nt=et!==null?k.get(et).__webglFramebuffer:null;b.bindFramebuffer(O.FRAMEBUFFER,Nt)}}},this.readRenderTargetPixelsAsync=async function(E,z,Y,H,G,xt,Et,yt=0){if(!(E&&E.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Dt=k.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&Et!==void 0&&(Dt=Dt[Et]),Dt)if(z>=0&&z<=E.width-H&&Y>=0&&Y<=E.height-G){b.bindFramebuffer(O.FRAMEBUFFER,Dt);let Nt=E.textures[yt],kt=Nt.format,qt=Nt.type;if(E.textures.length>1&&O.readBuffer(O.COLOR_ATTACHMENT0+yt),!R.textureFormatReadable(kt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!R.textureTypeReadable(qt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Lt=O.createBuffer();O.bindBuffer(O.PIXEL_PACK_BUFFER,Lt),O.bufferData(O.PIXEL_PACK_BUFFER,xt.byteLength,O.STREAM_READ),O.readPixels(z,Y,H,G,ot.convert(kt),ot.convert(qt),0);let de=et!==null?k.get(et).__webglFramebuffer:null;b.bindFramebuffer(O.FRAMEBUFFER,de);let Ge=O.fenceSync(O.SYNC_GPU_COMMANDS_COMPLETE,0);return O.flush(),await VS(O,Ge,4),O.bindBuffer(O.PIXEL_PACK_BUFFER,Lt),O.getBufferSubData(O.PIXEL_PACK_BUFFER,0,xt),O.deleteBuffer(Lt),O.deleteSync(Ge),xt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(E,z=null,Y=0){let H=Math.pow(2,-Y),G=Math.floor(E.image.width*H),xt=Math.floor(E.image.height*H),Et=z!==null?z.x:0,yt=z!==null?z.y:0;Z.setTexture2D(E,0),O.copyTexSubImage2D(O.TEXTURE_2D,Y,0,0,Et,yt,G,xt),b.unbindTexture()},this.copyTextureToTexture=function(E,z,Y=null,H=null,G=0,xt=0){let Et,yt,Dt,Nt,kt,qt,Lt,de,Ge,Be=E.isCompressedTexture?E.mipmaps[xt]:E.image;if(Y!==null)Et=Y.max.x-Y.min.x,yt=Y.max.y-Y.min.y,Dt=Y.isBox3?Y.max.z-Y.min.z:1,Nt=Y.min.x,kt=Y.min.y,qt=Y.isBox3?Y.min.z:0;else{let ke=Math.pow(2,-G);Et=Math.floor(Be.width*ke),yt=Math.floor(Be.height*ke),E.isDataArrayTexture?Dt=Be.depth:E.isData3DTexture?Dt=Math.floor(Be.depth*ke):Dt=1,Nt=0,kt=0,qt=0}H!==null?(Lt=H.x,de=H.y,Ge=H.z):(Lt=0,de=0,Ge=0);let ge=ot.convert(z.format),mn=ot.convert(z.type),Mt;z.isData3DTexture?(Z.setTexture3D(z,0),Mt=O.TEXTURE_3D):z.isDataArrayTexture||z.isCompressedArrayTexture?(Z.setTexture2DArray(z,0),Mt=O.TEXTURE_2D_ARRAY):(Z.setTexture2D(z,0),Mt=O.TEXTURE_2D),b.activeTexture(O.TEXTURE0),b.pixelStorei(O.UNPACK_FLIP_Y_WEBGL,z.flipY),b.pixelStorei(O.UNPACK_PREMULTIPLY_ALPHA_WEBGL,z.premultiplyAlpha),b.pixelStorei(O.UNPACK_ALIGNMENT,z.unpackAlignment);let Pn=b.getParameter(O.UNPACK_ROW_LENGTH),se=b.getParameter(O.UNPACK_IMAGE_HEIGHT),ni=b.getParameter(O.UNPACK_SKIP_PIXELS),Di=b.getParameter(O.UNPACK_SKIP_ROWS),Cs=b.getParameter(O.UNPACK_SKIP_IMAGES);b.pixelStorei(O.UNPACK_ROW_LENGTH,Be.width),b.pixelStorei(O.UNPACK_IMAGE_HEIGHT,Be.height),b.pixelStorei(O.UNPACK_SKIP_PIXELS,Nt),b.pixelStorei(O.UNPACK_SKIP_ROWS,kt),b.pixelStorei(O.UNPACK_SKIP_IMAGES,qt);let ar=E.isDataArrayTexture||E.isData3DTexture,_e=z.isDataArrayTexture||z.isData3DTexture;if(E.isDepthTexture){let ke=k.get(E),Rs=k.get(z),be=k.get(ke.__renderTarget),Ds=k.get(Rs.__renderTarget);b.bindFramebuffer(O.READ_FRAMEBUFFER,be.__webglFramebuffer),b.bindFramebuffer(O.DRAW_FRAMEBUFFER,Ds.__webglFramebuffer);for(let rr=0;rr<Dt;rr++)ar&&(O.framebufferTextureLayer(O.READ_FRAMEBUFFER,O.COLOR_ATTACHMENT0,k.get(E).__webglTexture,G,qt+rr),O.framebufferTextureLayer(O.DRAW_FRAMEBUFFER,O.COLOR_ATTACHMENT0,k.get(z).__webglTexture,xt,Ge+rr)),O.blitFramebuffer(Nt,kt,Et,yt,Lt,de,Et,yt,O.DEPTH_BUFFER_BIT,O.NEAREST);b.bindFramebuffer(O.READ_FRAMEBUFFER,null),b.bindFramebuffer(O.DRAW_FRAMEBUFFER,null)}else if(G!==0||E.isRenderTargetTexture||k.has(E)){let ke=k.get(E),Rs=k.get(z);b.bindFramebuffer(O.READ_FRAMEBUFFER,W),b.bindFramebuffer(O.DRAW_FRAMEBUFFER,B);for(let be=0;be<Dt;be++)ar?O.framebufferTextureLayer(O.READ_FRAMEBUFFER,O.COLOR_ATTACHMENT0,ke.__webglTexture,G,qt+be):O.framebufferTexture2D(O.READ_FRAMEBUFFER,O.COLOR_ATTACHMENT0,O.TEXTURE_2D,ke.__webglTexture,G),_e?O.framebufferTextureLayer(O.DRAW_FRAMEBUFFER,O.COLOR_ATTACHMENT0,Rs.__webglTexture,xt,Ge+be):O.framebufferTexture2D(O.DRAW_FRAMEBUFFER,O.COLOR_ATTACHMENT0,O.TEXTURE_2D,Rs.__webglTexture,xt),G!==0?O.blitFramebuffer(Nt,kt,Et,yt,Lt,de,Et,yt,O.COLOR_BUFFER_BIT,O.NEAREST):_e?O.copyTexSubImage3D(Mt,xt,Lt,de,Ge+be,Nt,kt,Et,yt):O.copyTexSubImage2D(Mt,xt,Lt,de,Nt,kt,Et,yt);b.bindFramebuffer(O.READ_FRAMEBUFFER,null),b.bindFramebuffer(O.DRAW_FRAMEBUFFER,null)}else _e?E.isDataTexture||E.isData3DTexture?O.texSubImage3D(Mt,xt,Lt,de,Ge,Et,yt,Dt,ge,mn,Be.data):z.isCompressedArrayTexture?O.compressedTexSubImage3D(Mt,xt,Lt,de,Ge,Et,yt,Dt,ge,Be.data):O.texSubImage3D(Mt,xt,Lt,de,Ge,Et,yt,Dt,ge,mn,Be):E.isDataTexture?O.texSubImage2D(O.TEXTURE_2D,xt,Lt,de,Et,yt,ge,mn,Be.data):E.isCompressedTexture?O.compressedTexSubImage2D(O.TEXTURE_2D,xt,Lt,de,Be.width,Be.height,ge,Be.data):O.texSubImage2D(O.TEXTURE_2D,xt,Lt,de,Et,yt,ge,mn,Be);b.pixelStorei(O.UNPACK_ROW_LENGTH,Pn),b.pixelStorei(O.UNPACK_IMAGE_HEIGHT,se),b.pixelStorei(O.UNPACK_SKIP_PIXELS,ni),b.pixelStorei(O.UNPACK_SKIP_ROWS,Di),b.pixelStorei(O.UNPACK_SKIP_IMAGES,Cs),xt===0&&z.generateMipmaps&&O.generateMipmap(Mt),b.unbindTexture()},this.initRenderTarget=function(E){k.get(E).__webglFramebuffer===void 0&&Z.setupRenderTarget(E)},this.initTexture=function(E){E.isCubeTexture?Z.setTextureCube(E,0):E.isData3DTexture?Z.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?Z.setTexture2DArray(E,0):Z.setTexture2D(E,0),b.unbindTexture()},this.resetState=function(){q=0,X=0,et=null,b.reset(),lt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Ei}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let n=this.getContext();n.drawingBufferColorSpace=ee._getDrawingBufferColorSpace(t),n.unpackColorSpace=ee._getUnpackColorSpace()}};var gd=12;var ne=(e,t,n=0)=>({time:e,azimuth:t||0,elevation:n,distance:1}),xM=e=>[...Array.from({length:9},(t,n)=>ne(Number((n*5/48).toFixed(6)),e*n*45)),ne(1,e*360)],xc=(e,t=0)=>[ne(0,0),ne(.2,e/2,t/2),ne(.4,e,t),ne(.6,e/2,t/2),ne(.8,0),ne(1,0)],bM=e=>[...Array.from({length:9},(t,n)=>ne(Number((n*5/48).toFixed(6)),e*n*45,n===8?0:Number((25*Math.sin(Math.PI*n/8)).toFixed(3)))),ne(1,e*360)],QU=[{id:"swing",name:"Side Arc",description:"A 65-degree arc around the frame.",duration:5,returnsToStart:!1,trajectory:[ne(0,0),ne(1,65,8)]},{id:"rise",name:"Hero Rise",description:"A new angle on the action.",duration:5,returnsToStart:!1,trajectory:[ne(0,0),ne(1,35,30)]},{id:"orbit",name:"Full Orbit",description:"A full right orbit back to the starting pose.",duration:6,returnsToStart:!0,trajectory:xM(1)},{id:"arc-return",name:"Arc Return",description:"Sweep 45 degrees to the side, then retrace to the starting pose.",duration:5,returnsToStart:!0,trajectory:[ne(0,0),ne(.2,22.5),ne(.45,45),ne(.7,22.5),ne(.9,0),ne(1,0)]},{id:"rise-return",name:"Rise Return",description:"Rise 25 degrees, then descend to the starting pose.",duration:5,returnsToStart:!0,trajectory:[ne(0,0),ne(.2,0,12.5),ne(.45,0,25),ne(.7,0,12.5),ne(.9,0),ne(1,0)]},{id:"orbit-left",name:"Orbit Left",description:"A full left orbit back to the starting pose.",duration:6,returnsToStart:!0,trajectory:xM(-1)},{id:"arc-left-return",name:"Left Return",description:"Sweep 45 degrees left, then retrace to the opening view.",duration:5,returnsToStart:!0,trajectory:xc(-45)},{id:"wide-return",name:"Wide Return",description:"Reach a 90-degree side view, then return to the opening pose.",duration:5,returnsToStart:!0,trajectory:xc(90)},{id:"dip-return",name:"Dip Return",description:"Dip 20 degrees below the subject, then rise back to the opening view.",duration:5,returnsToStart:!0,trajectory:xc(0,-20)},{id:"high-arc-return",name:"High Return",description:"Arc 45 degrees right and 25 degrees up, then retrace home.",duration:5,returnsToStart:!0,trajectory:xc(45,25)},{id:"low-arc-return",name:"Low Return",description:"Arc 45 degrees left and 20 degrees down, then retrace home.",duration:5,returnsToStart:!0,trajectory:xc(-45,-20)},{id:"sway-return",name:"Side to Side",description:"Sway left, cross through the opening view to the right, then return.",duration:5,returnsToStart:!0,trajectory:[ne(0,0),ne(.2,-30),ne(.4,0),ne(.6,30),ne(.8,0),ne(1,0)]},{id:"halo",name:"High Orbit",description:"Orbit right through a raised viewpoint, descending to the exact opening pose.",duration:6,returnsToStart:!0,trajectory:bM(1)},{id:"halo-left",name:"High Orbit Left",description:"Orbit left through a raised viewpoint, descending to the exact opening pose.",duration:6,returnsToStart:!0,trajectory:bM(-1)},{id:"arc-left",name:"Left Arc",description:"A 65-degree left arc that finishes at a new angle.",duration:5,returnsToStart:!1,trajectory:[ne(0,0),ne(1,-65,8)]},{id:"low-angle",name:"Low Reveal",description:"Sweep 40 degrees right and descend 20 degrees for a low-angle finish.",duration:5,returnsToStart:!1,trajectory:[ne(0,0),ne(1,40,-20)]}];var J=Ac(N0());async function Ao(e){let t=e instanceof FormData?e:new FormData;if(!(e instanceof FormData))for(let[n,i]of Object.entries(e))t.set(n,i);t.set("format","json");try{return await(await fetch(window.location.pathname,{method:"POST",body:t,credentials:"same-origin"})).json()}catch{return null}}var Sc=Math.PI/180;function wn(e,t,n){return Math.max(t,Math.min(n,e))}function Mc(e,t){if(t<=e[0].time)return e[0];let n=e[e.length-1];if(t>=n.time)return n;let i=1;for(;e[i].time<t;)i++;let s=e[i-1],a=e[i],r=Math.max(1e-6,a.time-s.time),o=(t-s.time)/r,c=o*o*(3-2*o),l=a.azimuth-s.azimuth;return l=((l%360+540)%360+360)%360-180,{time:t,azimuth:s.azimuth+l*c,elevation:s.elevation+(a.elevation-s.elevation)*c,distance:s.distance+(a.distance-s.distance)*c}}var L0={time:0,azimuth:0,elevation:0,distance:1},h3={...L0,time:1},bc=1024,TM=["#f8fbff","#ffd166","#ff5d8f","#4db0ff","#39d98a"],f3=[{id:"fast",label:"Flare Fast"},{id:"detailed",label:"Flare Detailed"},{id:"turbo",label:"Turbo"},{id:"hq",label:"Sunburst HQ"}];function d3(e){let t=(0,st.useRef)(null),n=(0,st.useRef)([]),i=(0,st.useRef)(!1),[s,a]=(0,st.useState)(TM[0]),[r,o]=(0,st.useState)(14),[c,l]=(0,st.useState)(!1),[h,p]=(0,st.useState)(""),[u,d]=(0,st.useState)("fast"),[,m]=(0,st.useState)(0),S=(0,st.useCallback)(()=>{let _=t.current,x=_?.getContext("2d");if(!(!_||!x)){x.fillStyle="#0a1120",x.fillRect(0,0,bc,bc);for(let v of n.current){x.save(),x.globalCompositeOperation=v.erase?"destination-out":"source-over",x.strokeStyle=v.color,x.fillStyle=v.color,x.lineWidth=v.width,x.lineCap="round",x.lineJoin="round";let[T,...A]=v.points;if(!T){x.restore();continue}x.beginPath(),x.arc(T.x,T.y,v.width/2,0,Math.PI*2),x.fill(),x.beginPath(),x.moveTo(T.x,T.y);for(let w of A)x.lineTo(w.x,w.y);x.stroke(),x.restore()}}},[]);(0,st.useEffect)(()=>S(),[S]);let g=_=>{let x=_.currentTarget.getBoundingClientRect(),v=bc/Math.max(1,Math.min(x.width,x.height));return{x:(_.clientX-x.left)*v,y:(_.clientY-x.top)*v}},f=n.current.length===0;return(0,J.jsxs)("div",{className:"fz-sketch",children:[(0,J.jsx)("canvas",{ref:t,className:"fz-sketch-canvas",width:bc,height:bc,onPointerDown:_=>{_.currentTarget.setPointerCapture(_.pointerId),i.current=!0,n.current.push({points:[g(_)],color:s,width:r,erase:c}),S()},onPointerMove:_=>{i.current&&(n.current[n.current.length-1]?.points.push(g(_)),S())},onPointerUp:()=>{i.current=!1,m(_=>_+1)}}),(0,J.jsxs)("div",{className:"fz-tools",children:[TM.map(_=>(0,J.jsx)("button",{type:"button",className:`fz-swatch${!c&&s===_?" selected":""}`,style:{background:_},"aria-label":`paint ${_}`,onClick:()=>{a(_),l(!1)}},_)),(0,J.jsx)("button",{type:"button",className:`fz-ghost${c?" selected":""}`,onClick:()=>l(_=>!_),children:"erase"}),(0,J.jsx)("input",{className:"fz-size",type:"range",min:4,max:60,value:r,onChange:_=>o(Number(_.target.value)),"aria-label":"brush size"}),(0,J.jsx)("button",{type:"button",className:"fz-ghost",disabled:f,onClick:()=>{n.current=[],S(),m(_=>_+1)},children:"clear"})]}),(0,J.jsx)("textarea",{className:"fz-prompt",placeholder:"describe the scene \u2014 'two friends at a diner, neon light'",value:h,maxLength:2e3,onChange:_=>p(_.target.value)}),(0,J.jsx)("div",{className:"fz-modes",children:f3.map(_=>(0,J.jsx)("button",{type:"button",className:u===_.id?"active":"",onClick:()=>d(_.id),children:_.label},_.id))}),(0,J.jsx)("button",{type:"button",className:"fz-primary",disabled:e.busy||!h.trim(),onClick:()=>{let _=t.current;n.current.length>0&&_?_.toBlob(v=>e.onGenerate(v,h.trim(),u),"image/png"):e.onGenerate(null,h.trim(),u)},children:e.busy?"generating\u2026":"generate the still"})]})}var AM=1/30,wM=10*1024*1024;function p3(e,t,n=1e4){return new Promise((i,s)=>{if(Math.abs(e.currentTime-t)<.001&&e.readyState>=2){i();return}let a=window.setTimeout(()=>{e.removeEventListener("seeked",r),s(new Error("couldn't read that frame"))},n);function r(){window.clearTimeout(a),i()}e.addEventListener("seeked",r,{once:!0}),e.currentTime=t})}function RM(e,t){let n=document.createElement("canvas");n.width=Math.min(t,e.videoWidth),n.height=Math.round(n.width*e.videoHeight/Math.max(1,e.videoWidth));let i=n.getContext("2d");return!i||!n.width?null:(i.drawImage(e,0,0,n.width,n.height),n)}async function m3(e,t,n=1e4){try{await p3(e,t,n);let i=RM(e,160);return i?i.toDataURL("image/jpeg",.8):null}catch{return null}}function g3(e){let{busy:t,onFrame:n}=e,i=(0,st.useRef)(null),s=(0,st.useRef)(null),a=(0,st.useRef)(null),r=(0,st.useRef)(!1),o=(0,st.useRef)(0),[c,l]=(0,st.useState)(null),[h,p]=(0,st.useState)(0),[u,d]=(0,st.useState)(0),[m,S]=(0,st.useState)([]),[g,f]=(0,st.useState)(!1),[_,x]=(0,st.useState)(!1),[v,T]=(0,st.useState)(null);(0,st.useEffect)(()=>()=>{o.current++,a.current&&URL.revokeObjectURL(a.current)},[]);let A=(0,st.useCallback)(async M=>{if(!M)return;if(T(null),!M.type.startsWith("video/")){T("choose a video \u2014 mp4, mov, or webm");return}if(M.size>150*1024*1024){T("choose a clip under 150mb");return}f(!0);let C=++o.current,D=URL.createObjectURL(M),L=()=>o.current!==C;try{let P=document.createElement("video");if(P.preload="auto",P.muted=!0,P.playsInline=!0,await new Promise((q,X)=>{let et=window.setTimeout(()=>X(new Error("that clip took too long to read")),2e4);P.onloadeddata=()=>{window.clearTimeout(et),q()},P.onerror=()=>{window.clearTimeout(et),X(new Error("can't decode that video \u2014 try an h.264 mp4"))},P.src=D}),!Number.isFinite(P.duration)||P.duration<=0||P.duration>120)throw new Error("choose a clip under two minutes");if(L()){P.removeAttribute("src"),P.load(),URL.revokeObjectURL(D);return}let W=[],B=Date.now()+15e3;for(let q=0;q<10&&!L();q++){let X=B-Date.now();if(X<=0)break;let et=Math.max(0,Math.min(P.duration-.05,P.duration*q/10)),at=await m3(P,et,X);at&&W.push({src:at,time:et})}if(L()){P.removeAttribute("src"),P.load(),URL.revokeObjectURL(D);return}a.current&&URL.revokeObjectURL(a.current),a.current=D,l(D),p(P.duration),d(P.duration/2),S(W),P.removeAttribute("src"),P.load()}catch(P){URL.revokeObjectURL(D),L()||T(P instanceof Error?P.message:"that video didn't load")}finally{L()||f(!1)}},[]),w=(0,st.useCallback)(M=>{d(M);let C=s.current;C&&(C.pause(),r.current=!0,C.currentTime=M)},[]),y=(0,st.useCallback)(async()=>{let M=s.current;if(!(!M||_||t)){x(!0);try{(r.current||M.readyState<2||Math.abs(M.currentTime-u)>.001)&&await new Promise((L,P)=>{let W=window.setTimeout(()=>{M.removeEventListener("seeked",B),P(new Error("couldn't read that frame"))},1e4),B=()=>{window.clearTimeout(W),L()};M.addEventListener("seeked",B,{once:!0}),r.current||(M.currentTime=u)});let C=Math.min(1920,M.videoWidth),D=null;for(;C>0;){let L=RM(M,C);if(!L)throw new Error("frame capture isn't available");if(D=await new Promise(P=>L.toBlob(W=>P(W),"image/jpeg",.94)),!D)throw new Error("frame capture isn't available");if(D.size<=wM||C<=320)break;C=Math.floor(C*.75)}if(!D||D.size>wM)throw new Error("that frame is too large \u2014 try a smaller clip");n(new File([D],"freeze-frame.jpg",{type:"image/jpeg"}))}catch(C){T(C instanceof Error?C.message:"couldn't capture the frame")}finally{x(!1)}}},[u,_,t,n]);return(0,J.jsxs)("div",{className:"fz-framepick",children:[(0,J.jsx)("input",{ref:i,type:"file",accept:"video/*",hidden:!0,onChange:M=>void A(M.target.files?.[0]??null)}),c?(0,J.jsxs)(J.Fragment,{children:[(0,J.jsx)("video",{ref:s,className:"fz-video",src:c,muted:!0,playsInline:!0,preload:"auto",onLoadedData:M=>{r.current=!0,M.currentTarget.currentTime=u},onSeeked:()=>{r.current=!1}}),m.length>0&&(0,J.jsx)("div",{className:"fz-strip",children:m.map((M,C)=>(0,J.jsx)("img",{src:M.src,alt:"",onClick:()=>w(M.time)},C))}),(0,J.jsx)("input",{type:"range",className:"fz-scrub",min:0,max:Math.max(AM,h),step:AM,value:u,onChange:M=>w(Number(M.target.value)),"aria-label":"pick the frame"}),(0,J.jsxs)("div",{className:"fz-row",children:[(0,J.jsx)("button",{type:"button",className:"fz-ghost",disabled:g,onClick:()=>i.current?.click(),children:"different clip"}),(0,J.jsx)("button",{type:"button",className:"fz-primary",disabled:_||t,onClick:()=>void y(),children:_?"capturing\u2026":`freeze at ${u.toFixed(2)}s`})]})]}):(0,J.jsxs)("div",{className:"fz-video-empty",children:[(0,J.jsx)("p",{className:"fz-sub",children:"pick the clip \u2014 then scrub to the moment to freeze"}),(0,J.jsx)("button",{type:"button",className:"fz-primary",disabled:g,onClick:()=>i.current?.click(),children:g?"reading the clip\u2026":"choose a video"})]}),v&&(0,J.jsx)("p",{className:"fz-err",children:v})]})}function vd(e,t,n,i){let s=t/2,a=n*.46+(i?.tilt??0)*n*.24,r=i?.zoom??1,o=t*.36*e.distance,c=n*.11*e.distance,l=(e.azimuth+(i?.yaw??0))*Sc;return{x:s+Math.sin(l)*o*r,y:a+n*.16+(Math.cos(l)*c-Math.sin(e.elevation*Sc)*n*.3)*r,depth:Math.cos(l)}}var Ea=.95,I0=2.3;function yd(e,t){let n=e.azimuth*Sc,i=e.elevation*Sc,s=I0*e.distance;return t.set(Math.sin(n)*Math.cos(i)*s,Ea+Math.sin(i)*s,Math.cos(n)*Math.cos(i)*s),t}function _3(e){let t=new dd({antialias:!0,alpha:!0});t.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),e.appendChild(t.domElement),t.domElement.style.position="absolute",t.domElement.style.inset="0";let n=[],i=mt=>(n.push(mt),mt),s=new Wl;s.fog=new Xl(725009,6.5,16);let a=new yn(54,1,.05,80),r=new U(0,1.12,0),o={yaw:.52,pitch:.19,dist:5.2},c={...o},l=()=>{let mt=Math.cos(c.pitch);a.position.set(r.x+Math.sin(c.yaw)*mt*c.dist,r.y+Math.sin(c.pitch)*c.dist,r.z+Math.cos(c.yaw)*mt*c.dist),a.lookAt(r)};l();let h=i(new rc(14,28,4612956,2372656));s.add(h);let p=i(new er({color:4482140,dashSize:.16,gapSize:.12,transparent:!0,opacity:.55})),u=[];for(let mt=0;mt<=128;mt++){let St=mt/128*Math.PI*2;u.push(new U(Math.sin(St)*I0,Ea,Math.cos(St)*I0))}let d=new Yi(i(new He().setFromPoints(u)),p);d.computeLineDistances(),s.add(d);let m=i(new He().setFromPoints([new U(0,.02,0),new U(0,Ea,0)]));s.add(new Yi(m,i(new qi({color:4020818,transparent:!0,opacity:.6}))));let S=[];for(let mt=0;mt<=64;mt++){let St=mt/64*Math.PI*2;S.push(new U(Math.sin(St)*.55,.02,Math.cos(St)*.55))}s.add(new Yi(i(new He().setFromPoints(S)),i(new qi({color:4020818,transparent:!0,opacity:.7}))));let g=1.9,f=g*.72,_=new je(i(new ma(g*1.07,f*1.1)),i(new mi({color:858139,side:ti})));_.position.set(0,Ea,0);let x=i(new mi({color:4874585,side:ti})),v=i(new ma(g,f)),T=new je(v,x);T.position.set(0,Ea,.001);let A=new je(v,x);A.position.set(0,Ea,-.001),A.rotation.y=Math.PI;let w=new go(i(new $l(v)),i(new qi({color:8366235})));w.position.copy(T.position),s.add(_,T,A,w);let y=i(new mi({color:9426109})),M=null,C=i(new He),D=new Yi(C,i(new er({color:9426109,dashSize:.12,gapSize:.1,transparent:!0,opacity:.28})));D.visible=!1,s.add(D);let L=new Gi;s.add(L);let P=i(new yo(.066,16,12)),W=i(new mi({color:9426109})),B=i(new mi({color:15791604})),q=i(new mi({color:16765286,transparent:!0})),X=new Gi;X.add(new je(i(new yo(.1,18,14)),q));let et=new je(i(new Ql(.062,.22,12)),q);et.rotation.x=Math.PI/2,et.position.z=.18,X.add(et),s.add(X);let at=i(new He().setFromPoints([new U,new U(0,Ea,0)])),ut=new Yi(at,i(new er({color:16765286,dashSize:.09,gapSize:.09,transparent:!0,opacity:.45})));ut.computeLineDistances(),s.add(ut);let pt=new U,bt=new U(0,Ea,0),Zt=[],ce={time:0,azimuth:0,elevation:0,distance:1},$t=()=>{q.opacity=Math.cos(ce.azimuth*Sc-c.yaw)<-.05?.45:1},Q=()=>{let mt=e.clientWidth,St=e.clientHeight;if(mt===0||St===0)return;let wt=new It;t.getSize(wt),(wt.x!==mt||wt.y!==St)&&(t.setSize(mt,St,!1),a.aspect=mt/St,a.updateProjectionMatrix()),t.render(s,a)},ft=new ResizeObserver(Q);ft.observe(e);let rt=null;return{setImage(mt){if(rt?.dispose(),mt){let St=new xn(mt);St.colorSpace=Tn,St.needsUpdate=!0,rt=St,x.map=St,x.color.set(16777215)}else rt=null,x.map=null,x.color.set(4874585);x.needsUpdate=!0,Q()},update(mt,St,wt){Zt=mt;let Yt=[];for(let Ut=0;Ut<=96;Ut++){let Vt=yd(Mc(mt,Ut/96),new U),Ft=Yt[Yt.length-1];Ft&&Vt.distanceToSquared(Ft)<1e-8||Yt.push(Vt)}if(Yt.length>=2){let Ut=new vo(Yt),Vt=new nc(Ut,120,.03,8,!1),Ft=new je(Vt,y);M&&(s.remove(M),M.geometry.dispose()),M=Ft,s.add(M),C.setFromPoints(Yt.map(Pt=>new U(Pt.x,.02,Pt.z))),C.setDrawRange(0,Yt.length),D.computeLineDistances(),D.visible=!0}else M&&(s.remove(M),M.geometry.dispose(),M=null,D.visible=!1);L.clear(),mt.forEach((Ut,Vt)=>{let Ft=new je(P,Vt===wt?B:W);Ft.position.copy(yd(Ut,pt)),Vt===wt&&Ft.scale.setScalar(1.3),Ft.userData.index=Vt,L.add(Ft)}),ce=Mc(mt,St),X.position.copy(yd(ce,pt)),X.lookAt(bt),$t(),at.setFromPoints([X.position.clone(),bt.clone()]),ut.computeLineDistances(),Q()},orbit(mt,St){c.yaw-=mt*.0075,c.pitch=wn(c.pitch+St*.006,-.15,1.35),l(),$t(),Q()},zoom(mt){c.dist=wn(c.dist/mt,3.2,10),l(),Q()},viewDirty(){return Math.abs(c.yaw-o.yaw)>.01||Math.abs(c.pitch-o.pitch)>.01||Math.abs(c.dist-o.dist)>.05},resetView(){return Math.abs(c.yaw-o.yaw)<=.01&&Math.abs(c.pitch-o.pitch)<=.01&&Math.abs(c.dist-o.dist)<=.05?!1:(Object.assign(c,o),l(),Q(),!0)},pick(mt,St){let wt=e.clientWidth,Yt=e.clientHeight,Ut=null,Vt=30;return Zt.forEach((Ft,Pt)=>{yd(Ft,pt).project(a);let Ee=(pt.x*.5+.5)*wt,ae=(-pt.y*.5+.5)*Yt,Ue=Math.hypot(Ee-mt,ae-St);Ue<Vt&&(Vt=Ue,Ut=Pt)}),Ut},dispose(){ft.disconnect(),rt?.dispose(),n.forEach(mt=>mt.dispose()),M?.geometry.dispose(),t.dispose(),t.domElement.remove()}}}var wo=14;function v3(e){let t=(0,st.useRef)(null),n=(0,st.useRef)(null),[i,s]=(0,st.useState)(!1),a=(0,st.useRef)(null),r=(0,st.useRef)(new Map),o=(0,st.useRef)(e);o.current=e;let c=()=>{let l=a.current;if(!l?.snapshot)return;(l.mode==="draw"?l.travel>=wo&&l.samples.length>=2:l.mode==="edit"&&l.moved)&&o.current.onDrawRevert(l.snapshot,l.snapshotSel)};return(0,st.useEffect)(()=>{let l=t.current;if(!l||o.current.lite)return;let h=null;try{h=_3(l)}catch{return}n.current=h;let p={reset:()=>h.resetView()?(o.current.onViewChange(!1),!0):!1};return o.current.viewCtl.current=p,o.current.onViewChange(!1),s(!0),()=>{n.current=null,o.current.viewCtl.current===p&&(o.current.viewCtl.current=null),h.dispose()}},[]),(0,st.useEffect)(()=>{n.current?.setImage(e.image)},[i,e.image]),(0,st.useEffect)(()=>{n.current?.update(e.keyframes,e.scrubT,e.selected)},[i,e.keyframes,e.scrubT,e.selected]),(0,J.jsx)("div",{ref:t,className:"fz-stage-canvas",onPointerDown:l=>{if(!i)return;if(r.current.set(l.pointerId,{x:l.clientX,y:l.clientY}),l.currentTarget.setPointerCapture(l.pointerId),r.current.size>=2){c();let d=[...r.current.values()];a.current={mode:"view",picked:null,moved:!0,lastX:d.reduce((m,S)=>m+S.x,0)/d.length,lastY:d.reduce((m,S)=>m+S.y,0)/d.length,az:0,el:0,travel:0,samples:[],pinchD:d.length===2?Math.hypot(d[0].x-d[1].x,d[0].y-d[1].y):0,snapshot:null,snapshotSel:null};return}if(o.current.mode==="look"){a.current={mode:"view",picked:null,moved:!1,lastX:l.clientX,lastY:l.clientY,az:0,el:0,travel:0,samples:[],pinchD:0,snapshot:null,snapshotSel:null};return}let h=l.currentTarget.getBoundingClientRect(),p=n.current?.pick(l.clientX-h.left,l.clientY-h.top)??null;p!==null&&o.current.onPick(p);let u=p!==null&&(o.current.keyframes[p]?.time===0||o.current.keyframes[p]?.time===1);a.current={mode:o.current.mode==="draw"?"draw":p===null||u?"none":"edit",picked:p,moved:!1,lastX:l.clientX,lastY:l.clientY,az:0,el:0,travel:0,samples:[{azimuth:0,elevation:0}],pinchD:0,snapshot:o.current.keyframes,snapshotSel:o.current.selected}},onPointerMove:l=>{let h=a.current;if(!h||!i)return;if(r.current.has(l.pointerId)&&r.current.set(l.pointerId,{x:l.clientX,y:l.clientY}),h.mode==="view"){let d=n.current,m=[...r.current.values()];if(!d||m.length===0)return;let S=m.reduce((f,_)=>f+_.x,0)/m.length,g=m.reduce((f,_)=>f+_.y,0)/m.length;if(d.orbit(S-h.lastX,g-h.lastY),h.lastX=S,h.lastY=g,m.length===2){let f=Math.hypot(m[0].x-m[1].x,m[0].y-m[1].y);h.pinchD>0&&d.zoom(f/h.pinchD),h.pinchD=f}else h.pinchD=0;o.current.onViewChange(d.viewDirty());return}let p=l.clientX-h.lastX,u=l.clientY-h.lastY;if(!(Math.abs(p)+Math.abs(u)<.5)){if(h.lastX=l.clientX,h.lastY=l.clientY,h.moved=!0,h.mode==="edit"){o.current.onDragPose(p*.6,-u*.4,h.picked);return}h.mode!=="none"&&(h.travel+=Math.abs(p)+Math.abs(u),h.az=wn(h.az+p*.6,-360,360),h.el=wn(h.el-u*.4,-90,90),h.samples.length<600?h.samples.push({azimuth:h.az,elevation:h.el}):h.samples[h.samples.length-1]={azimuth:h.az,elevation:h.el},h.travel>=wo&&h.samples.length>=2&&(h.samples.length<4||h.samples.length%4===0)&&o.current.onDrawPath(h.samples))}},onPointerUp:l=>{r.current.delete(l.pointerId);let h=a.current;if(h?.mode==="view"){if(r.current.size===0)a.current=null;else{let p=[...r.current.values()];h.lastX=p.reduce((u,d)=>u+d.x,0)/p.length,h.lastY=p.reduce((u,d)=>u+d.y,0)/p.length,h.pinchD=p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0}return}if(a.current=null,!(!h||!i)){if(!h.moved){o.current.onPick(h.picked);return}h.mode==="draw"&&h.travel>=wo&&h.samples.length>=2&&o.current.onDrawPath(h.samples,!0)}},onPointerCancel:l=>{r.current.delete(l.pointerId);let h=a.current;if(h?.mode==="view"&&r.current.size>0){let p=[...r.current.values()];h.lastX=p.reduce((u,d)=>u+d.x,0)/p.length,h.lastY=p.reduce((u,d)=>u+d.y,0)/p.length,h.pinchD=p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;return}c(),a.current=null},children:!i&&(0,J.jsx)(y3,{...e})})}function y3(e){let t=(0,st.useRef)(null),n=(0,st.useRef)(null),i=(0,st.useRef)(new Map),s=(0,st.useRef)({yaw:0,tilt:0,zoom:1}),a=(0,st.useRef)(e);a.current=e;let r=()=>{let c=n.current;if(!c?.snapshot)return;(c.mode==="draw"?c.travel>=wo&&c.samples.length>=2:c.mode==="edit"&&c.moved)&&a.current.onDrawRevert(c.snapshot,c.snapshotSel)},o=(0,st.useCallback)(()=>{let c=t.current,l=c?.getContext("2d");if(!c||!l)return;let h=Math.min(2,window.devicePixelRatio||1),p=c.clientWidth,u=c.clientHeight;(c.width!==p*h||c.height!==u*h)&&(c.width=p*h,c.height=u*h),l.setTransform(h,0,0,h,0,0),l.clearRect(0,0,p,u),l.strokeStyle="rgba(160,196,182,0.10)",l.lineWidth=1;let d=u*.62;for(let M=0;M<=12;M++){let C=d+Math.pow(M/12,1.6)*(u-d);l.beginPath(),l.moveTo(0,C),l.lineTo(p,C),l.stroke()}for(let M=-8;M<=8;M++)l.beginPath(),l.moveTo(p/2+M*p*.07,d),l.lineTo(p/2+M*p*.22,u),l.stroke();let m=s.current,S=p/2,g=u*.46+m.tilt*u*.24,f=p*.36*m.zoom,_=u*.11*m.zoom;l.strokeStyle="rgba(159,216,197,0.22)",l.setLineDash([4,6]),l.beginPath(),l.ellipse(S,g+u*.16,f,_,0,0,Math.PI*2),l.stroke(),l.setLineDash([]);let x=e.keyframes;if(x.length>=2){l.strokeStyle="rgba(143,212,189,0.9)",l.lineWidth=3,l.lineCap="round",l.beginPath();let M=96;for(let C=0;C<=M;C++){let D=vd(Mc(x,C/M),p,u,m);C===0?l.moveTo(D.x,D.y):l.lineTo(D.x,D.y)}l.stroke()}let v=Math.min(p*.4,u*.4*(4/3))*m.zoom,T=v*.72;if(l.save(),l.shadowColor="rgba(0,0,0,0.6)",l.shadowBlur=24,l.fillStyle="#0d181b",l.fillRect(S-v/2,g-T/2,v,T),l.restore(),e.image){let M=e.image,C=Math.min(v/M.width,T/M.height),D=M.width*C,L=M.height*C;l.drawImage(M,S-D/2,g-L/2,D,L)}else l.fillStyle="rgba(214,233,226,0.5)",l.font="13px ui-monospace, monospace",l.textAlign="center",l.fillText("no photo",S,g);l.strokeStyle="rgba(159,216,197,0.45)",l.strokeRect(S-v/2,g-T/2,v,T),x.forEach((M,C)=>{let D=vd(M,p,u,m);l.beginPath(),l.arc(D.x,D.y,C===e.selected?7:5,0,Math.PI*2),l.fillStyle=C===e.selected?"#f0f5f4":"#8fd4bd",l.fill(),C===e.selected&&(l.strokeStyle="rgba(143,212,189,0.6)",l.lineWidth=2,l.stroke())});let A=Mc(x,e.scrubT),w=vd(A,p,u,m),y=w.depth<-.05;l.globalAlpha=y?.45:1,l.beginPath(),l.arc(w.x,w.y,13,0,Math.PI*2),l.fillStyle="#ffd166",l.fill(),l.beginPath(),l.arc(w.x,w.y,5,0,Math.PI*2),l.fillStyle="#0a1120",l.fill(),l.strokeStyle="rgba(255,209,102,0.35)",l.setLineDash([3,5]),l.beginPath(),l.moveTo(w.x,w.y),l.lineTo(S,g),l.stroke(),l.setLineDash([]),l.globalAlpha=1},[e.image,e.keyframes,e.scrubT,e.selected]);return(0,st.useEffect)(()=>{let c=()=>{let h=s.current;return Math.abs(h.yaw)>.5||Math.abs(h.tilt)>.02||Math.abs(h.zoom-1)>.02},l={reset:()=>c()?(s.current={yaw:0,tilt:0,zoom:1},o(),a.current.onViewChange(!1),!0):!1};return a.current.viewCtl.current=l,a.current.onViewChange(c()),()=>{a.current.viewCtl.current===l&&(a.current.viewCtl.current=null)}},[o]),(0,st.useEffect)(()=>{o()},[o]),(0,st.useEffect)(()=>{let c=()=>o();return window.addEventListener("resize",c),()=>window.removeEventListener("resize",c)},[o]),(0,J.jsx)("canvas",{ref:t,className:"fz-stage-canvas",onPointerDown:c=>{if(i.current.set(c.pointerId,{x:c.clientX,y:c.clientY}),c.currentTarget.setPointerCapture(c.pointerId),i.current.size>=2){r();let m=[...i.current.values()];n.current={mode:"view",picked:null,moved:!0,lastX:m.reduce((S,g)=>S+g.x,0)/m.length,lastY:m.reduce((S,g)=>S+g.y,0)/m.length,az:0,el:0,travel:0,samples:[],pinchD:m.length===2?Math.hypot(m[0].x-m[1].x,m[0].y-m[1].y):0,snapshot:null,snapshotSel:null};return}if(e.mode==="look"){n.current={mode:"view",picked:null,moved:!1,lastX:c.clientX,lastY:c.clientY,az:0,el:0,travel:0,samples:[],pinchD:0,snapshot:null,snapshotSel:null};return}let l=c.currentTarget.getBoundingClientRect(),h=c.clientX-l.left,p=c.clientY-l.top,u=e.keyframes.findIndex(m=>{let S=vd(m,l.width,l.height,s.current);return Math.hypot(S.x-h,S.y-p)<20});u>=0&&e.onPick(u);let d=u>=0&&(e.keyframes[u]?.time===0||e.keyframes[u]?.time===1);n.current={mode:e.mode==="draw"?"draw":u<0||d?"none":"edit",picked:u>=0?u:null,moved:!1,lastX:c.clientX,lastY:c.clientY,az:0,el:0,travel:0,samples:[{azimuth:0,elevation:0}],pinchD:0,snapshot:e.keyframes,snapshotSel:e.selected}},onPointerMove:c=>{let l=n.current;if(!l)return;if(i.current.has(c.pointerId)&&i.current.set(c.pointerId,{x:c.clientX,y:c.clientY}),l.mode==="view"){let u=[...i.current.values()];if(u.length===0)return;let d=u.reduce((_,x)=>_+x.x,0)/u.length,m=u.reduce((_,x)=>_+x.y,0)/u.length,S=d-l.lastX,g=m-l.lastY,f=s.current;if(f.yaw-=S*.3,f.tilt=wn(f.tilt+g*.0035,-.5,.7),l.lastX=d,l.lastY=m,u.length===2){let _=Math.hypot(u[0].x-u[1].x,u[0].y-u[1].y);l.pinchD>0&&(f.zoom=wn(f.zoom*(_/l.pinchD),.7,2.2)),l.pinchD=_}else l.pinchD=0;o(),a.current.onViewChange(Math.abs(f.yaw)>.5||Math.abs(f.tilt)>.02||Math.abs(f.zoom-1)>.02);return}let h=c.clientX-l.lastX,p=c.clientY-l.lastY;if(!(Math.abs(h)+Math.abs(p)<.5)){if(l.lastX=c.clientX,l.lastY=c.clientY,l.moved=!0,l.mode==="edit"){e.onDragPose(h*.6,-p*.4,l.picked);return}l.mode!=="none"&&(l.travel+=Math.abs(h)+Math.abs(p),l.az=wn(l.az+h*.6,-360,360),l.el=wn(l.el-p*.4,-90,90),l.samples.length<600?l.samples.push({azimuth:l.az,elevation:l.el}):l.samples[l.samples.length-1]={azimuth:l.az,elevation:l.el},l.travel>=wo&&l.samples.length>=2&&(l.samples.length<4||l.samples.length%4===0)&&e.onDrawPath(l.samples))}},onPointerUp:c=>{i.current.delete(c.pointerId);let l=n.current;if(l?.mode==="view"){if(i.current.size===0)n.current=null;else{let h=[...i.current.values()];l.lastX=h.reduce((p,u)=>p+u.x,0)/h.length,l.lastY=h.reduce((p,u)=>p+u.y,0)/h.length,l.pinchD=h.length===2?Math.hypot(h[0].x-h[1].x,h[0].y-h[1].y):0}return}if(n.current=null,!!l){if(!l.moved){e.onPick(l.picked);return}l.mode==="draw"&&l.travel>=wo&&l.samples.length>=2&&e.onDrawPath(l.samples,!0)}},onPointerCancel:c=>{i.current.delete(c.pointerId);let l=n.current;if(l?.mode==="view"&&i.current.size>0){let h=[...i.current.values()];l.lastX=h.reduce((p,u)=>p+u.x,0)/h.length,l.lastY=h.reduce((p,u)=>p+u.y,0)/h.length,l.pinchD=h.length===2?Math.hypot(h[0].x-h[1].x,h[0].y-h[1].y):0;return}r(),n.current=null}})}function x3({kind:e}){let t={orbit:"M50 43a34 13 0 1 1 1 0l-5-4m5 4-5 3","orbit-left":"M50 43a34 13 0 1 0-1 0l5-4m-5 4 5 3",swing:"M50 43Q84 44 84 30Q82 20 67 19",rise:"M50 43Q88 43 77 18Q68 4 50 7","arc-return":"M50 43Q84 44 84 30Q82 20 67 19M67 23Q78 24 79 30Q79 39 50 39l5-4m-5 4 5 3","rise-return":"M46 43V10l-4 5m4-5 4 5M56 10v33l-4-5m4 5 4-5","arc-left-return":"M50 43Q16 44 16 30Q18 20 33 19M33 23Q22 24 21 30Q21 39 50 39l-5-4m5 4-5 3","wide-return":"M50 43C5 43 5 17 50 17C90 17 90 39 50 39l5-4m-5 4 5 3","dip-return":"M46 16v32l-4-5m4 5 4-5M56 48V16l-4 5m4-5 4 5","high-arc-return":"M50 43Q84 30 72 8M72 8Q76 30 50 39l5-5","low-arc-return":"M50 24Q16 30 28 49M28 49Q24 30 50 28l-5-4","sway-return":"M50 43Q16 43 16 30Q50 8 84 30Q84 43 50 43l5-4m-5 4 5 3",halo:"M50 43C96 43 91 5 50 5C9 5 4 43 50 43l-5-4m5 4-5 3","halo-left":"M50 43C4 43 9 5 50 5C91 5 96 43 50 43l5-4m-5 4 5 3","arc-left":"M50 43Q16 44 16 30Q18 20 33 19","low-angle":"M50 20Q85 20 78 48l-5-4m5 4 3-5"};return(0,J.jsxs)("svg",{className:"fz-path",viewBox:"0 0 100 56","aria-hidden":"true",children:[(0,J.jsx)("ellipse",{cx:"50",cy:"30",rx:"34",ry:"13",className:"fz-path-guide"}),(0,J.jsx)("path",{d:"M50 13v25M43 33l7 5 7-5",className:"fz-path-axis"}),(0,J.jsx)("circle",{cx:"50",cy:"29",r:"4",className:"fz-path-subject"}),(0,J.jsx)("path",{className:"fz-path-motion",d:t[e]??t.orbit}),(0,J.jsx)("circle",{cx:"50",cy:"43",r:"3",className:"fz-path-camera"})]})}function b3(e){let[t,n]=(0,st.useState)(e.initial.sourceAssetId?"camera":"source"),[i,s]=(0,st.useState)(e.initial.sourceUrl),[a,r]=(0,st.useState)(e.initial.sourceAssetId),[o,c]=(0,st.useState)(e.initial.renders),[l,h]=(0,st.useState)(e.initial.activeJob),[p,u]=(0,st.useState)(e.initial.latest),[d,m]=(0,st.useState)(!1),[S,g]=(0,st.useState)(null),[f,_]=(0,st.useState)(!1),[x,v]=(0,st.useState)(!1),[T,A]=(0,st.useState)(!1),[w,y]=(0,st.useState)(null),[M,C]=(0,st.useState)([L0,{time:.5,azimuth:65,elevation:8,distance:1},h3]),[D,L]=(0,st.useState)(0),[P,W]=(0,st.useState)(null),[B,q]=(0,st.useState)("draw"),[X,et]=(0,st.useState)(!1),at=(0,st.useRef)(null),[ut,pt]=(0,st.useState)(null),[bt,Zt]=(0,st.useState)(5),[ce,$t]=(0,st.useState)("768P"),[Q]=(0,st.useState)(()=>Math.floor(Math.random()*1e6)),ft=(0,st.useRef)(null),[,rt]=(0,st.useState)(0),mt=(0,st.useRef)(null),St=(0,st.useRef)(null),wt=(0,st.useRef)(0),Yt=(0,st.useRef)(e.initial.sourceAssetId),Ut=(0,st.useRef)(null),Vt=(0,st.useCallback)(I=>{let tt=Ut.current;tt&&tt!==I&&(URL.revokeObjectURL(tt),Ut.current=null),I.startsWith("blob:")&&(Ut.current=I),s(I)},[]),Ft=(0,st.useCallback)(()=>{Ut.current&&(URL.revokeObjectURL(Ut.current),Ut.current=null),s(null)},[]);(0,st.useEffect)(()=>()=>{Ut.current&&URL.revokeObjectURL(Ut.current)},[]);let Pt=(0,st.useCallback)((I,tt=!1)=>{if(typeof I.latest=="number"&&u(I.latest),h(I.activeJob??null),I.line&&g(I.line),I.sourceUrl&&(tt||I.sourceAssetId!==Yt.current)&&Vt(I.sourceUrl),I.sourceAssetId&&(Yt.current=I.sourceAssetId,r(I.sourceAssetId)),I.renders&&c(I.renders),w&&!I.activeJob){let j=(w.kind==="render"?I.renders:I.sketches)?.find(V=>V.jobId===w.id);j&&(j.state==="delivered"||j.state==="failed")&&(y(null),j.state==="delivered"?w.kind==="render"?(g(null),n("result")):(_(!1),g("still delivered \u2014 set the camera move"),n("camera")):g(j.error??"that didn't come out \u2014 try again?"))}},[w,Vt]),Ee=(0,st.useRef)(0),ae=(0,st.useCallback)(async()=>{let I=++Ee.current,tt=await Ao({action:"status",after:String(p)});if(!(!tt||I!==Ee.current))return Pt(tt),tt},[p,Pt]),Ue=(0,st.useCallback)(async I=>{for(let tt=0;tt<10;tt++){if(Yt.current!==I)return;let N=await ae();if(Yt.current!==I)return;if(N&&N.sourceAssetId===I&&(Pt(N,!0),N.sourceUrl)){g(null);return}await new Promise(j=>setTimeout(j,1200))}Yt.current===I&&g("still converting \u2014 back out and re-upload if it stalls")},[ae,Pt]),ze=(0,st.useCallback)(()=>{let I=Date.now();I-wt.current<3e4||(wt.current=I,ae().then(tt=>{tt&&Pt(tt,!0)}))},[ae,Pt]),ye=(0,st.useRef)(0);(0,st.useEffect)(()=>{let I=++ye.current;if(!i){ft.current=null,rt(N=>N+1);return}let tt=new Image;tt.crossOrigin="anonymous",tt.onload=()=>{I===ye.current&&(ft.current=tt,rt(N=>N+1))},tt.onerror=()=>{I===ye.current&&ze()},tt.src=i},[i,ze]),(0,st.useEffect)(()=>{if(!l)return;let I=!1,tt=window.setInterval(()=>{I||(I=!0,ae().finally(()=>{I=!1}))},2500);return()=>window.clearInterval(tt)},[l,ae]);let Te=(I,tt)=>g(I?.line??tt),O=(0,st.useCallback)(async I=>{if(!I||d)return;m(!0),g("reading the photo\u2026");let N=I.type.startsWith("image/")&&!/hei[cf]/i.test(I.type)?URL.createObjectURL(I):null,j=new FormData;j.set("action","source"),j.set("file",I);let V=await Ao(j);if(m(!1),!V||V.error||V.sourceAssetId===void 0){N&&URL.revokeObjectURL(N),Te(V,"that photo didn't come through \u2014 try another.");return}g(null),r(V.sourceAssetId),_(!1),v(!1),Yt.current=V.sourceAssetId,V.sourceUrl?(N&&URL.revokeObjectURL(N),Vt(V.sourceUrl)):N?Vt(N):(Ft(),g("converting the photo\u2026")),n("camera"),ae(),!V.sourceUrl&&!N&&V.sourceAssetId&&Ue(V.sourceAssetId)},[d,ae,Vt,Ft,Ue]),pn=(0,st.useCallback)(async(I,tt,N)=>{if(d)return;m(!0),g("generating the still \u2014 about a minute");let j=new FormData;j.set("action","source"),j.set("kind","sketch"),j.set("prompt",tt),j.set("mode",N),I&&j.set("canvas",I,"sketch.png");let V=await Ao(j);if(m(!1),!V||V.error||!V.jobId){Te(V,"that didn't work \u2014 try again?");return}y({id:V.jobId,kind:"sketch"}),Pt(V),g("generating the still \u2014 about a minute")},[d,Pt]),re=(0,st.useCallback)(I=>{pt(I.id),Zt(I.duration===6?6:5),C(I.trajectory.map(tt=>({...tt}))),W(null),L(0)},[]),R=(0,st.useCallback)(()=>{let I=wn(D,.02,.98);if(M.length>=gd||M.some(j=>Math.abs(j.time-I)<.01))return;let tt=Mc(M,I),N=[...M,{...tt,time:I}].sort((j,V)=>j.time-V.time).map(j=>({...j}));C(N),W(null),pt(null)},[M,D]),b=(0,st.useCallback)(()=>{C(I=>{if(P===null||I.length<=2)return I;let tt=I[P];return!tt||tt.time===0||tt.time===1?I:I.filter((N,j)=>j!==P)}),W(null),pt(null)},[P]),F=(0,st.useCallback)((I,tt,N)=>{A(!0),pt(null),C(j=>{let V=N??P;if(V===null){let $=1/0;j.forEach((Tt,At)=>{let Ae=Math.abs(Tt.time-D);Ae<$&&($=Ae,V=At)})}if(V===null)return j;let ot=j[V];if(!ot||ot.time===0||ot.time===1)return j;let lt=j.map(($,Tt)=>Tt===V?{...$,azimuth:wn($.azimuth+I,-360,360),elevation:wn($.elevation+tt,-90,90)}:$);return W(V),lt})},[P,D]),k=(0,st.useCallback)((I,tt=!1)=>{if(I.length===0)return;let N=Math.min(I.length,gd-1),j=[{...L0}];for(let lt=0;lt<N-1;lt++){let $=Math.floor(lt*(I.length-1)/Math.max(1,N-1)),Tt=I[Math.min($,I.length-1)];j.push({time:Number(((lt+1)/N).toFixed(4)),azimuth:Math.round(Tt.azimuth*10)/10,elevation:Math.round(Tt.elevation*10)/10,distance:1})}let V=I[I.length-1];j.push({time:1,azimuth:Math.round(V.azimuth*10)/10,elevation:Math.round(V.elevation*10)/10,distance:1});let ot=[];for(let lt of j){let $=ot[ot.length-1];$&&Math.abs(lt.azimuth-$.azimuth)<.05&&Math.abs(lt.elevation-$.elevation)<.05?ot[ot.length-1]={...$,time:ot.length===1?$.time:lt.time}:ot.push(lt)}ot.length<2||(C(ot),tt?(A(!0),pt(null),W(null),L(1)):W(lt=>lt!==null&&lt>=ot.length?null:lt))},[]),Z=(0,st.useCallback)((I,tt)=>{C(I.map(N=>({...N}))),W(typeof tt=="number"&&tt>=0&&tt<I.length?tt:null)},[]),ct=(0,st.useCallback)((I,tt)=>{pt(null),A(!0),C(N=>N.map((j,V)=>V!==I||j.time===0||j.time===1?j:{...j,...tt.azimuth!==void 0?{azimuth:wn(tt.azimuth,-360,360)}:{},...tt.elevation!==void 0?{elevation:wn(tt.elevation,-90,90)}:{}}))},[]),_t=(0,st.useCallback)(async()=>{if(d||!a||!i)return;m(!0),g("rendering the freeze \u2014 a few minutes");let I={action:"render",duration:String(bt),resolution:ce,seed:String(Q)};ut?I.preset=ut:I.trajectory=JSON.stringify(M);let tt=await Ao(I);if(m(!1),!tt||tt.error||!tt.jobId){Te(tt,"that render didn't start \u2014 try again?");return}y({id:tt.jobId,kind:"render"}),Pt(tt),g("freezing \u2014 a few minutes")},[d,a,i,ut,ce,Q,M,bt,Pt]),K=(0,st.useCallback)(async I=>{if(d)return;m(!0),g("sending to iMessage\u2026");let tt=await Ao({action:"save",job:I});if(m(!1),!tt||tt.error){Te(tt,"couldn't send it \u2014 try again");return}tt.downloadUrl?(window.open(tt.downloadUrl,"_blank","noopener"),g("sent the link \u2014 it's only good for a little while")):g("sent to iMessage")},[d]),nt=(0,st.useCallback)(async()=>{await Ao({action:"cancel"}),y(null),g(null),await ae()},[ae]),gt=(0,st.useMemo)(()=>o.filter(I=>I.state==="delivered"&&I.outputUrl),[o]),Ct=gt[gt.length-1],dt=P!==null&&P<M.length?P:null;if(dt===null){let I=1/0;M.forEach((tt,N)=>{if(tt.time===0||tt.time===1)return;let j=Math.abs(tt.time-D);j<I&&(I=j,dt=N)})}let ht=dt!==null?M[dt]:void 0,Rt=!!ht&&ht.time!==0&&ht.time!==1;return(0,J.jsxs)("div",{className:"fz",children:[(0,J.jsx)("div",{className:"fz-tabs",children:["source","camera","result"].map(I=>(0,J.jsx)("button",{type:"button",className:t===I?"active":"",disabled:I==="camera"&&!a||I==="result"&&gt.length===0,onClick:()=>n(I),children:I==="source"?"1 \xB7 photo":I==="camera"?"2 \xB7 camera":"3 \xB7 freeze"},I))}),l&&(0,J.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>void nt(),children:"cancel the running job"}),t==="source"&&(0,J.jsx)("div",{className:"fz-stage",children:!f&&!x?(0,J.jsxs)(J.Fragment,{children:[(0,J.jsxs)("div",{className:"fz-hero",children:[(0,J.jsx)("p",{className:"fz-title",children:"freeze the scene"}),(0,J.jsx)("p",{className:"fz-sub",children:"pick the still \u2014 the camera moves, the moment doesn\u2019t"})]}),(0,J.jsxs)("div",{className:"fz-source-grid",children:[(0,J.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>St.current?.click(),children:[(0,J.jsx)("span",{className:"fz-card-icon",children:"\u25C9"}),"take a photo"]}),(0,J.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>mt.current?.click(),children:[(0,J.jsx)("span",{className:"fz-card-icon",children:"\u25A4"}),"upload a photo"]}),(0,J.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>_(!0),children:[(0,J.jsx)("span",{className:"fz-card-icon",children:"\u270E"}),"sketch + generate"]}),(0,J.jsxs)("button",{type:"button",className:"fz-card",disabled:d,onClick:()=>v(!0),children:[(0,J.jsx)("span",{className:"fz-card-icon",children:"\u25B6"}),"video \u2192 freeze a frame"]})]}),(0,J.jsx)("input",{ref:St,type:"file",accept:"image/*,.heic,.heif",capture:"environment",hidden:!0,onChange:I=>void O(I.target.files?.[0]??null)}),(0,J.jsx)("input",{ref:mt,type:"file",accept:"image/*,.heic,.heif",hidden:!0,onChange:I=>void O(I.target.files?.[0]??null)}),gt.length>0&&(0,J.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>n("result"),children:"see your freezes \u2192"})]}):f?(0,J.jsxs)(J.Fragment,{children:[(0,J.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>_(!1),children:"\u2190 back"}),(0,J.jsx)(d3,{busy:d||w?.kind==="sketch",onGenerate:pn})]}):(0,J.jsxs)(J.Fragment,{children:[(0,J.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>v(!1),children:"\u2190 back"}),(0,J.jsx)(g3,{busy:d,onFrame:I=>void O(I)})]})}),t==="camera"&&(0,J.jsxs)("div",{className:"fz-stage fz-cam",children:[(0,J.jsxs)("div",{className:"fz-stage-wrap",children:[(0,J.jsx)(v3,{image:ft.current,keyframes:M,scrubT:D,selected:P,lite:e.initial.lite,mode:B,onViewChange:et,viewCtl:at,onDragPose:F,onDrawPath:k,onDrawRevert:Z,onPick:W}),X&&(0,J.jsx)("button",{type:"button",className:"fz-viewreset",onClick:()=>at.current?.reset(),children:"reset view"}),!T&&(0,J.jsxs)("div",{className:"fz-stage-hint",children:[(0,J.jsx)("span",{className:"fz-stage-dot"}),B==="draw"?"drag to draw the camera path":B==="look"?"drag to look \u2014 pinch to zoom":"drag a dot to move it"]})]}),(0,J.jsxs)("div",{className:"fz-modebar",role:"group","aria-label":"stage gesture",children:[(0,J.jsx)("span",{className:"fz-ctl-label",children:"stage"}),(0,J.jsxs)("div",{className:"fz-seg",children:[(0,J.jsx)("button",{type:"button",className:B==="draw"?"active":"","aria-pressed":B==="draw",onClick:()=>q("draw"),children:"draw path"}),(0,J.jsx)("button",{type:"button",className:B==="edit"?"active":"","aria-pressed":B==="edit",onClick:()=>q("edit"),children:"move dot"}),(0,J.jsx)("button",{type:"button",className:B==="look"?"active":"","aria-pressed":B==="look",onClick:()=>q("look"),children:"look"})]})]}),(0,J.jsx)("div",{className:"fz-ctl-label",children:"camera move"}),(0,J.jsx)("div",{className:"fz-prail",children:e.initial.presets.map(I=>(0,J.jsxs)("button",{type:"button",className:`fz-preset${ut===I.id?" active":""}`,title:I.description,"aria-pressed":ut===I.id,onClick:()=>re(I),children:[(0,J.jsx)(x3,{kind:I.id}),(0,J.jsx)("span",{className:"fz-preset-name",children:I.name}),(0,J.jsx)("span",{className:"fz-preset-return",children:I.returnsToStart?"returns to start":"new angle"})]},I.id))}),(0,J.jsxs)("div",{className:"fz-timeline",children:[(0,J.jsxs)("div",{className:"fz-timeline-meta",children:[(0,J.jsxs)("span",{children:[(D*bt).toFixed(2),"s / ",bt,"s"]}),(0,J.jsxs)("span",{children:[M.length," keyframes",ut?` \xB7 ${e.initial.presets.find(I=>I.id===ut)?.name??ut}`:" \xB7 drawn",P!==null&&(M[P].time===0||M[P].time===1?" \xB7 endpoint":` \xB7 kf ${P+1}`)]})]}),(0,J.jsxs)("div",{className:"fz-track",onPointerDown:I=>{let tt=I.currentTarget.getBoundingClientRect(),N=I.clientX-tt.left,j=null,V=23;M.forEach((ot,lt)=>{let $=Math.abs(ot.time*tt.width-N);$<V&&(V=$,j=lt)}),j!==null?(W(j),L(M[j].time)):L(wn(N/tt.width,0,1)),I.currentTarget.setPointerCapture(I.pointerId)},onPointerMove:I=>{if(I.buttons!==1)return;let tt=I.currentTarget.getBoundingClientRect();L(wn((I.clientX-tt.left)/tt.width,0,1))},children:[(0,J.jsx)("div",{className:"fz-track-ticks"}),M.map((I,tt)=>(0,J.jsx)("button",{type:"button",className:`fz-kf${P===tt?" selected":""}`,style:{left:`${I.time*100}%`},onClick:()=>{W(tt),L(I.time)},"aria-label":`keyframe ${tt+1} at ${Math.round(I.time*100)}%`},tt)),(0,J.jsx)("div",{className:"fz-head",style:{left:`${D*100}%`},children:(0,J.jsx)("i",{})})]}),(0,J.jsxs)("div",{className:"fz-timeline-row",children:[(0,J.jsx)("span",{className:"fz-meta",children:P!==null?M[P].time===0||M[P].time===1?"endpoints hold the framing":"move this dot with the sliders or the scene":B==="draw"?"drag the scene to sketch the path":B==="look"?"drag to look around \u2014 pinch to zoom":"drag a dot to move it"}),(0,J.jsxs)("div",{className:"fz-timeline-actions",children:[(0,J.jsx)("button",{type:"button",className:"fz-ghost",disabled:M.length>=gd,onClick:R,children:"+ keyframe"}),(0,J.jsx)("button",{type:"button",className:"fz-ghost",disabled:P===null||M[P]?.time===0||M[P]?.time===1,onClick:b,children:"\u2212 remove"})]})]})]}),(0,J.jsxs)("div",{className:"fz-aim",children:[(0,J.jsx)("div",{className:"fz-ctl-label",children:Rt?`aim \u2014 keyframe ${(dt??0)+1}`:"aim \u2014 tap a middle dot on the timeline"}),(0,J.jsxs)("div",{className:"fz-aim-row",children:[(0,J.jsx)("span",{className:"fz-aim-label",children:"orbit"}),(0,J.jsx)("input",{type:"range",min:-360,max:360,step:1,value:ht?.azimuth??0,disabled:!Rt,"aria-label":"orbit angle in degrees",onChange:I=>{dt!==null&&ct(dt,{azimuth:Number(I.target.value)})}}),(0,J.jsx)("span",{className:"fz-aim-val",children:Rt&&ht?`${Math.round(ht.azimuth)}\xB0`:"\u2014"})]}),(0,J.jsxs)("div",{className:"fz-aim-row",children:[(0,J.jsx)("span",{className:"fz-aim-label",children:"height"}),(0,J.jsx)("input",{type:"range",min:-90,max:90,step:1,value:ht?.elevation??0,disabled:!Rt,"aria-label":"camera height in degrees",onChange:I=>{dt!==null&&ct(dt,{elevation:Number(I.target.value)})}}),(0,J.jsx)("span",{className:"fz-aim-val",children:Rt&&ht?`${Math.round(ht.elevation)}\xB0`:"\u2014"})]})]}),(0,J.jsxs)("div",{className:"fz-render-row",children:[(0,J.jsx)("div",{className:"fz-seg",children:[5,6].map(I=>(0,J.jsxs)("button",{type:"button",className:bt===I?"active":"",onClick:()=>Zt(I),children:[I,"s"]},I))}),(0,J.jsx)("div",{className:"fz-seg",children:["480P","768P","1080P"].map(I=>(0,J.jsx)("button",{type:"button",className:ce===I?"active":"",onClick:()=>$t(I),children:I==="480P"?"480":I==="768P"?"720":"1080"},I))}),(0,J.jsx)("button",{type:"button",className:"fz-primary",disabled:d||!a||!i||w!==null,onClick:()=>void _t(),children:w?.kind==="render"||d?"freezing\u2026":"freeze it"})]})]}),t==="result"&&(0,J.jsxs)("div",{className:"fz-stage",children:[Ct?(0,J.jsxs)("div",{className:"fz-result",children:[(0,J.jsx)("video",{className:"fz-video",src:Ct.outputUrl??void 0,controls:!0,playsInline:!0,loop:!0,autoPlay:!0,muted:!0,onError:ze}),(0,J.jsxs)("div",{className:"fz-actions",children:[(0,J.jsx)("button",{type:"button",className:"fz-primary",disabled:d,onClick:()=>void K(Ct.jobId),children:"send to iMessage"}),(0,J.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>n("camera"),children:"new camera move"})]})]}):l?(0,J.jsx)("p",{className:"fz-sub",children:"rendering \u2014 this takes a few minutes"}):(0,J.jsx)("p",{className:"fz-sub",children:"nothing rendered yet"}),gt.length>1&&(0,J.jsx)("div",{className:"fz-history",children:gt.slice(0,-1).reverse().map(I=>(0,J.jsxs)("div",{className:"fz-history-row",children:[(0,J.jsx)("video",{className:"fz-thumb",src:I.outputUrl??void 0,muted:!0,playsInline:!0,preload:"metadata",onError:ze}),(0,J.jsx)("button",{type:"button",className:"fz-ghost",onClick:()=>void K(I.jobId),children:"send"})]},I.jobId))})]}),(0,J.jsx)("p",{className:"fz-line",children:S??""})]})}var S3=`
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
.fz-row{display:flex;gap:8px;align-items:center}
.fz-err{margin:0;text-align:center;font-size:0.72rem;color:#e8a9a9}
.fz-actions{display:flex;gap:8px;flex-wrap:wrap}
.fz-history{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.fz-history-row{display:flex;align-items:center;gap:10px}
.fz-thumb{width:88px;border-radius:8px;background:#000}
.fz-line{margin:0;min-height:1rem;text-align:center;font-size:0.72rem;color:#83968f}
@media(prefers-reduced-motion:reduce){.fz-card,.fz-primary{transition:none}}
`,U0=document.getElementById("freeze-studio");if(U0){let e=null;try{e=JSON.parse(U0.dataset.payload??"")}catch{e=null}if(e){let t=document.createElement("style");t.textContent=S3,document.head.appendChild(t),(0,CM.createRoot)(U0).render((0,J.jsx)(st.StrictMode,{children:(0,J.jsx)(b3,{initial:e})}))}}})();
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
