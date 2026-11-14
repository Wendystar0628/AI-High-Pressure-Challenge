(()=>{var Xi={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},qi={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},Lh=0,ec=1,Nh=2;var fs=1,Uh=2,Ks=3,Kn=0,vn=1,Re=2,ps=0,Yi=1,Zr=2,nc=3,ic=4,Fh=5;var ms=100,Oh=101,Bh=102,Hh=103,Gh=104,zh=200,kh=201,Vh=202,Wh=203,sc=204,rc=205,Xh=206,qh=207,Yh=208,Zh=209,Jh=210,Kh=211,$h=212,jh=213,Qh=214,zo=0,ko=1,Vo=2,Bs=3,Wo=4,Xo=5,qo=6,Yo=7,oc=0,tu=1,eu=2,$n=0,ac=1,lc=2,cc=3,hc=4,uc=5,dc=6,fc=7;var pc=300,gs=301,$s=302,Ta=303,wa=304,is=1e3,ci=1001,Zo=1002,nn=1003,nu=1004;var Jr=1005;var Qe=1006,ba=1007;var Ci=1008;var Nn=1009,mc=1010,gc=1011,js=1012,Ra=1013,si=1014,jn=1015,Wn=1016,Aa=1017,Ca=1018,xs=1020,xc=35902,_c=35899,yc=1021,vc=1022,An=1023,Ti=1026,Pi=1027,Pa=1028,Ia=1029,Zi=1030,Da=1031;var La=1033,Kr=33776,$r=33777,jr=33778,Qr=33779,Na=35840,Ua=35841,Fa=35842,Oa=35843,Ba=36196,Ha=37492,Ga=37496,za=37488,ka=37489,to=37490,Va=37491,Wa=37808,Xa=37809,qa=37810,Ya=37811,Za=37812,Ja=37813,Ka=37814,$a=37815,ja=37816,Qa=37817,tl=37818,el=37819,nl=37820,il=37821,sl=36492,rl=36494,ol=36495,al=36283,ll=36284,eo=36285,cl=36286;var mr=2300,Jo=2301,Ho=2302,Wl=2303,Xl=2400,ql=2401,Yl=2402;var iu=3200;var no=0,su=1,Ii="",_n="srgb",gr="srgb-linear",xr="linear",Ve="srgb";var Go=7680;var ru=519,ou=512,au=513,lu=514,Ec=515,cu=516,hu=517,Mc=518,Sc=519,uu=35044;var Tc="300 es",Yn=2e3,Hs=2001;function Fd(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function Od(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function _r(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function du(){let i=_r("canvas");return i.style.display="block",i}var $c={},Gs=null;function wc(...i){let t="THREE."+i.shift();Gs?Gs("log",t,...i):console.log(t,...i)}function fu(i){let t=i[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=i[1];e&&e.isStackTrace?i[0]+=" "+e.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function pe(...i){i=fu(i);let t="THREE."+i.shift();if(Gs)Gs("warn",t,...i);else{let e=i[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...i)}}function Ee(...i){i=fu(i);let t="THREE."+i.shift();if(Gs)Gs("error",t,...i);else{let e=i[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...i)}}function ns(...i){let t=i.join(" ");t in $c||($c[t]=!0,pe(...i))}function pu(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}var mu={[zo]:zo,[Vo]:qo,[Wo]:Wo,[Bs]:Xo,[ko]:ko,[qo]:Vo,[Yo]:Yo,[Xo]:Bs},ii=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){let n=this._listeners;return n===void 0?!1:n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){let n=this._listeners;if(n===void 0)return;let s=n[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let n=e[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,t);t.target=null}}},Tn=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],jc=1234567,ur=Math.PI/180,zs=180/Math.PI;function _s(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Tn[i&255]+Tn[i>>8&255]+Tn[i>>16&255]+Tn[i>>24&255]+"-"+Tn[t&255]+Tn[t>>8&255]+"-"+Tn[t>>16&15|64]+Tn[t>>24&255]+"-"+Tn[e&63|128]+Tn[e>>8&255]+"-"+Tn[e>>16&255]+Tn[e>>24&255]+Tn[n&255]+Tn[n>>8&255]+Tn[n>>16&255]+Tn[n>>24&255]).toLowerCase()}function Ce(i,t,e){return Math.max(t,Math.min(e,i))}function bc(i,t){return(i%t+t)%t}function Bd(i,t,e,n,s){return n+(i-t)*(s-n)/(e-t)}function Hd(i,t,e){return i!==t?(e-i)/(t-i):0}function dr(i,t,e){return(1-e)*i+e*t}function Gd(i,t,e,n){return dr(i,t,1-Math.exp(-e*n))}function zd(i,t=1){return t-Math.abs(bc(i,t*2)-t)}function kd(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*(3-2*i))}function Vd(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*i*(i*(i*6-15)+10))}function Wd(i,t){return i+Math.floor(Math.random()*(t-i+1))}function Xd(i,t){return i+Math.random()*(t-i)}function qd(i){return i*(.5-Math.random())}function Yd(i){i!==void 0&&(jc=i);let t=jc+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Zd(i){return i*ur}function Jd(i){return i*zs}function Kd(i){return i>0&&Number.isInteger(i)&&2**Math.round(Math.log2(i))===i}function $d(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function Rc(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function jd(i,t,e,n,s){let r=Math.cos,o=Math.sin,a=r(e/2),l=o(e/2),c=r((t+n)/2),h=o((t+n)/2),f=r((t-n)/2),u=o((t-n)/2),d=r((n-t)/2),g=o((n-t)/2);switch(s){case"XYX":i.set(a*h,l*f,l*u,a*c);break;case"YZY":i.set(l*u,a*h,l*f,a*c);break;case"ZXZ":i.set(l*f,l*u,a*h,a*c);break;case"XZX":i.set(a*h,l*g,l*d,a*c);break;case"YXY":i.set(l*d,a*h,l*g,a*c);break;case"ZYZ":i.set(l*g,l*d,a*h,a*c);break;default:pe("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function Ac(i){switch(i.constructor){case Uint32Array:return 4294967295;case Uint16Array:return 65535;case Uint8Array:case Uint8ClampedArray:return 255;case Int32Array:return 2147483647;case Int16Array:return 32767;case Int8Array:return 127;default:return}}function gu(i,t){if(t.constructor===Float32Array)return i;let e=Ac(t);if(e===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.max(i/e,-1)}function xu(i,t){if(t.constructor===Float32Array)return i;let e=Ac(t);if(e===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.round(i*e)}var Qs={DEG2RAD:ur,RAD2DEG:zs,generateUUID:_s,clamp:Ce,euclideanModulo:bc,mapLinear:Bd,inverseLerp:Hd,lerp:dr,damp:Gd,pingpong:zd,smoothstep:kd,smootherstep:Vd,randInt:Wd,randFloat:Xd,randFloatSpread:qd,seededRandom:Yd,degToRad:Zd,radToDeg:Jd,isPowerOfTwo:Kd,ceilPowerOfTwo:$d,floorPowerOfTwo:Rc,setQuaternionFromProperEuler:jd,normalize:xu,denormalize:gu},bt=class{static{this.prototype.isVector2=!0}constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Ce(this.x,t.x,e.x),this.y=Ce(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=Ce(this.x,t,e),this.y=Ce(this.y,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Ce(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Ce(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,o=this.y-t.y;return this.x=r*n-o*s+t.x,this.y=r*s+o*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Hn=class{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,o,a){let l=n[s+0],c=n[s+1],h=n[s+2],f=n[s+3],u=r[o+0],d=r[o+1],g=r[o+2],v=r[o+3];if(f!==v||l!==u||c!==d||h!==g){let m=l*u+c*d+h*g+f*v;m<0&&(u=-u,d=-d,g=-g,v=-v,m=-m);let p=1-a;if(m<.9995){let y=Math.acos(m),T=Math.sin(y);p=Math.sin(p*y)/T,a=Math.sin(a*y)/T,l=l*p+u*a,c=c*p+d*a,h=h*p+g*a,f=f*p+v*a}else{l=l*p+u*a,c=c*p+d*a,h=h*p+g*a,f=f*p+v*a;let y=1/Math.sqrt(l*l+c*c+h*h+f*f);l*=y,c*=y,h*=y,f*=y}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=f}static multiplyQuaternionsFlat(t,e,n,s,r,o){let a=n[s],l=n[s+1],c=n[s+2],h=n[s+3],f=r[o],u=r[o+1],d=r[o+2],g=r[o+3];return t[e]=a*g+h*f+l*d-c*u,t[e+1]=l*g+h*u+c*f-a*d,t[e+2]=c*g+h*d+a*u-l*f,t[e+3]=h*g-a*f-l*u-c*d,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,s=t._y,r=t._z,o=t._order,a=Math.cos,l=Math.sin,c=a(n/2),h=a(s/2),f=a(r/2),u=l(n/2),d=l(s/2),g=l(r/2);switch(o){case"XYZ":this._x=u*h*f+c*d*g,this._y=c*d*f-u*h*g,this._z=c*h*g+u*d*f,this._w=c*h*f-u*d*g;break;case"YXZ":this._x=u*h*f+c*d*g,this._y=c*d*f-u*h*g,this._z=c*h*g-u*d*f,this._w=c*h*f+u*d*g;break;case"ZXY":this._x=u*h*f-c*d*g,this._y=c*d*f+u*h*g,this._z=c*h*g+u*d*f,this._w=c*h*f-u*d*g;break;case"ZYX":this._x=u*h*f-c*d*g,this._y=c*d*f+u*h*g,this._z=c*h*g-u*d*f,this._w=c*h*f+u*d*g;break;case"YZX":this._x=u*h*f+c*d*g,this._y=c*d*f+u*h*g,this._z=c*h*g-u*d*f,this._w=c*h*f-u*d*g;break;case"XZY":this._x=u*h*f-c*d*g,this._y=c*d*f-u*h*g,this._z=c*h*g+u*d*f,this._w=c*h*f+u*d*g;break;default:pe("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],s=e[4],r=e[8],o=e[1],a=e[5],l=e[9],c=e[2],h=e[6],f=e[10],u=n+a+f;if(u>0){let d=.5/Math.sqrt(u+1);this._w=.25/d,this._x=(h-l)*d,this._y=(r-c)*d,this._z=(o-s)*d}else if(n>a&&n>f){let d=2*Math.sqrt(1+n-a-f);this._w=(h-l)/d,this._x=.25*d,this._y=(s+o)/d,this._z=(r+c)/d}else if(a>f){let d=2*Math.sqrt(1+a-n-f);this._w=(r-c)/d,this._x=(s+o)/d,this._y=.25*d,this._z=(l+h)/d}else{let d=2*Math.sqrt(1+f-n-a);this._w=(o-s)/d,this._x=(r+c)/d,this._y=(l+h)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Ce(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,s=t._y,r=t._z,o=t._w,a=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+o*a+s*c-r*l,this._y=s*h+o*l+r*a-n*c,this._z=r*h+o*c+n*l-s*a,this._w=o*h-n*a-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){let n=t._x,s=t._y,r=t._z,o=t._w,a=this.dot(t);a<0&&(n=-n,s=-s,r=-r,o=-o,a=-a);let l=1-e;if(a<.9995){let c=Math.acos(a),h=Math.sin(c);l=Math.sin(l*c)/h,e=Math.sin(e*c)/h,this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this._onChangeCallback()}else this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this.normalize();return this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},R=class{static{this.prototype.isVector3=!0}constructor(t=0,e=0,n=0){this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Qc.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Qc.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=t.elements,o=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*o,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*o,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*o,this}applyQuaternion(t){let e=this.x,n=this.y,s=this.z,r=t.x,o=t.y,a=t.z,l=t.w,c=2*(o*s-a*n),h=2*(a*e-r*s),f=2*(r*n-o*e);return this.x=e+l*c+o*f-a*h,this.y=n+l*h+a*c-r*f,this.z=s+l*f+r*h-o*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Ce(this.x,t.x,e.x),this.y=Ce(this.y,t.y,e.y),this.z=Ce(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=Ce(this.x,t,e),this.y=Ce(this.y,t,e),this.z=Ce(this.z,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Ce(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,s=t.y,r=t.z,o=e.x,a=e.y,l=e.z;return this.x=s*l-r*a,this.y=r*o-n*l,this.z=n*a-s*o,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return vl.copy(this).projectOnVector(t),this.sub(vl)}reflect(t){return this.sub(vl.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Ce(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},vl=new R,Qc=new Hn,Te=class{static{this.prototype.isMatrix3=!0}constructor(t,e,n,s,r,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c)}set(t,e,n,s,r,o,a,l,c){let h=this.elements;return h[0]=t,h[1]=s,h[2]=a,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],h=n[4],f=n[7],u=n[2],d=n[5],g=n[8],v=s[0],m=s[3],p=s[6],y=s[1],T=s[4],_=s[7],A=s[2],w=s[5],x=s[8];return r[0]=o*v+a*y+l*A,r[3]=o*m+a*T+l*w,r[6]=o*p+a*_+l*x,r[1]=c*v+h*y+f*A,r[4]=c*m+h*T+f*w,r[7]=c*p+h*_+f*x,r[2]=u*v+d*y+g*A,r[5]=u*m+d*T+g*w,r[8]=u*p+d*_+g*x,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8];return e*o*h-e*a*c-n*r*h+n*a*l+s*r*c-s*o*l}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],f=h*o-a*c,u=a*l-h*r,d=c*r-o*l,g=e*f+n*u+s*d;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let v=1/g;return t[0]=f*v,t[1]=(s*c-h*n)*v,t[2]=(a*n-s*o)*v,t[3]=u*v,t[4]=(h*e-s*l)*v,t[5]=(s*r-a*e)*v,t[6]=d*v,t[7]=(n*l-c*e)*v,t[8]=(o*e-n*r)*v,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,o,a){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*o+c*a)+o+t,-s*c,s*l,-s*(-c*o+l*a)+a+e,0,0,1),this}scale(t,e){return ns("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(El.makeScale(t,e)),this}rotate(t){return ns("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(El.makeRotation(-t)),this}translate(t,e){return ns("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(El.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}},El=new Te,th=new Te().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),eh=new Te().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Qd(){let i={enabled:!0,workingColorSpace:gr,spaces:{},convert:function(s,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===Ve&&(s.r=Si(s.r),s.g=Si(s.g),s.b=Si(s.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===Ve&&(s.r=Os(s.r),s.g=Os(s.g),s.b=Os(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Ii?xr:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,o){return s.copy(this.spaces[o].fromXYZ).multiply(this.spaces[r].toXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[gr]:{primaries:t,whitePoint:n,transfer:xr,toXYZ:th,fromXYZ:eh,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:_n},outputColorSpaceConfig:{drawingBufferColorSpace:_n}},[_n]:{primaries:t,whitePoint:n,transfer:Ve,toXYZ:th,fromXYZ:eh,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:_n}}}),i}var Ne=Qd();function Si(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Os(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var Ss,Ko=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let n;if(t instanceof HTMLCanvasElement)n=t;else{Ss===void 0&&(Ss=_r("canvas")),Ss.width=t.width,Ss.height=t.height;let s=Ss.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),n=Ss}return n.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=_r("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=Si(r[o]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Si(e[n]/255)*255):e[n]=Si(e[n]);return{data:e,width:t.width,height:t.height}}else return pe("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},tf=0,ks=class{constructor(t=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:tf++}),this.uuid=_s(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame<"u"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width||0,e.height||0,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(Ml(s[o].image)):r.push(Ml(s[o]))}else r=Ml(s);n.url=r}return e||(t.images[this.uuid]=n),n}};function Ml(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Ko.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(pe("Texture: Unable to serialize Texture."),{})}var ef=0,Sl=new R,In=class i extends ii{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,n=ci,s=ci,r=Qe,o=Ci,a=An,l=Nn,c=i.DEFAULT_ANISOTROPY,h=Ii){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:ef++}),this.uuid=_s(),this.name="",this.source=new ks(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new bt(0,0),this.repeat=new bt(1,1),this.center=new bt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Te,this.generateMipmaps=!0,this.mipmapsAutoUpdate=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.isPMREMTexture=!1,this.normalized=!1}get width(){return this.source.getSize(Sl).x}get height(){return this.source.getSize(Sl).y}get depth(){return this.source.getSize(Sl).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.mipmapsAutoUpdate=t.mipmapsAutoUpdate,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isPMREMTexture=t.isPMREMTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let n=t[e];if(n===void 0){pe(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){pe(`Texture.setValues(): property '${e}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,mipmapsAutoUpdate:this.mipmapsAutoUpdate,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==pc)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case is:t.x=t.x-Math.floor(t.x);break;case ci:t.x=t.x<0?0:1;break;case Zo:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case is:t.y=t.y-Math.floor(t.y);break;case ci:t.y=t.y<0?0:1;break;case Zo:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};In.DEFAULT_IMAGE=null;In.DEFAULT_MAPPING=pc;In.DEFAULT_ANISOTROPY=1;var Ke=class{static{this.prototype.isVector4=!0}constructor(t=0,e=0,n=0,s=1){this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=this.w,o=t.elements;return this.x=o[0]*e+o[4]*n+o[8]*s+o[12]*r,this.y=o[1]*e+o[5]*n+o[9]*s+o[13]*r,this.z=o[2]*e+o[6]*n+o[10]*s+o[14]*r,this.w=o[3]*e+o[7]*n+o[11]*s+o[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r,l=t.elements,c=l[0],h=l[4],f=l[8],u=l[1],d=l[5],g=l[9],v=l[2],m=l[6],p=l[10];if(Math.abs(h-u)<.01&&Math.abs(f-v)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+u)<.1&&Math.abs(f+v)<.1&&Math.abs(g+m)<.1&&Math.abs(c+d+p-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let T=(c+1)/2,_=(d+1)/2,A=(p+1)/2,w=(h+u)/4,x=(f+v)/4,S=(g+m)/4;return T>_&&T>A?T<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(T),s=w/n,r=x/n):_>A?_<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(_),n=w/s,r=S/s):A<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(A),n=x/r,s=S/r),this.set(n,s,r,e),this}let y=Math.sqrt((m-g)*(m-g)+(f-v)*(f-v)+(u-h)*(u-h));return Math.abs(y)<.001&&(y=1),this.x=(m-g)/y,this.y=(f-v)/y,this.z=(u-h)/y,this.w=Math.acos((c+d+p-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Ce(this.x,t.x,e.x),this.y=Ce(this.y,t.y,e.y),this.z=Ce(this.z,t.z,e.z),this.w=Ce(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=Ce(this.x,t,e),this.y=Ce(this.y,t,e),this.z=Ce(this.z,t,e),this.w=Ce(this.w,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Ce(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},$o=class extends ii{constructor(t=1,e=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Qe,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=n.depth,this.scissor=new Ke(0,0,t,e),this.scissorTest=!1,this.viewport=new Ke(0,0,t,e),this.textures=[];let s=n.count;for(let r=0;r<s;r++)this.textures[r]=new In({width:t,height:e,depth:n.depth}),this.textures[r].isRenderTargetTexture=!0,this.textures[r].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(t={}){let e={minFilter:Qe,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.mipmapsAutoUpdate!==void 0&&(e.mipmapsAutoUpdate=t.mipmapsAutoUpdate),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),t!==null&&t.renderTarget===null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,n=t.textures.length;e<n;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;let s=Object.assign({},t.textures[e].image);this.textures[e].source=new ks(s)}if(this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveColorBuffer=t.resolveColorBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,this.storeMultisampledColorBuffer=t.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=t.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=t.storeMultisampledStencilBuffer,t.depthTexture!==null)if(t.depthTexture.renderTarget===t){let e=t.depthTexture.clone();e.renderTarget=null,this.depthTexture=e}else this.depthTexture=t.depthTexture;else this.depthTexture=null;return this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},gn=class extends $o{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}},yr=class extends In{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=nn,this.minFilter=nn,this.wrapR=ci,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var jo=class extends In{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=nn,this.minFilter=nn,this.wrapR=ci,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}};var He=class i{static{this.prototype.isMatrix4=!0}constructor(t,e,n,s,r,o,a,l,c,h,f,u,d,g,v,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c,h,f,u,d,g,v,m)}set(t,e,n,s,r,o,a,l,c,h,f,u,d,g,v,m){let p=this.elements;return p[0]=t,p[4]=e,p[8]=n,p[12]=s,p[1]=r,p[5]=o,p[9]=a,p[13]=l,p[2]=c,p[6]=h,p[10]=f,p[14]=u,p[3]=d,p[7]=g,p[11]=v,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new i().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),n.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,n=t.elements,s=1/Ts.setFromMatrixColumn(t,0).length(),r=1/Ts.setFromMatrixColumn(t,1).length(),o=1/Ts.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*o,e[9]=n[9]*o,e[10]=n[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,s=t.y,r=t.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),f=Math.sin(r);if(t.order==="XYZ"){let u=o*h,d=o*f,g=a*h,v=a*f;e[0]=l*h,e[4]=-l*f,e[8]=c,e[1]=d+g*c,e[5]=u-v*c,e[9]=-a*l,e[2]=v-u*c,e[6]=g+d*c,e[10]=o*l}else if(t.order==="YXZ"){let u=l*h,d=l*f,g=c*h,v=c*f;e[0]=u+v*a,e[4]=g*a-d,e[8]=o*c,e[1]=o*f,e[5]=o*h,e[9]=-a,e[2]=d*a-g,e[6]=v+u*a,e[10]=o*l}else if(t.order==="ZXY"){let u=l*h,d=l*f,g=c*h,v=c*f;e[0]=u-v*a,e[4]=-o*f,e[8]=g+d*a,e[1]=d+g*a,e[5]=o*h,e[9]=v-u*a,e[2]=-o*c,e[6]=a,e[10]=o*l}else if(t.order==="ZYX"){let u=o*h,d=o*f,g=a*h,v=a*f;e[0]=l*h,e[4]=g*c-d,e[8]=u*c+v,e[1]=l*f,e[5]=v*c+u,e[9]=d*c-g,e[2]=-c,e[6]=a*l,e[10]=o*l}else if(t.order==="YZX"){let u=o*l,d=o*c,g=a*l,v=a*c;e[0]=l*h,e[4]=v-u*f,e[8]=g*f+d,e[1]=f,e[5]=o*h,e[9]=-a*h,e[2]=-c*h,e[6]=d*f+g,e[10]=u-v*f}else if(t.order==="XZY"){let u=o*l,d=o*c,g=a*l,v=a*c;e[0]=l*h,e[4]=-f,e[8]=c*h,e[1]=u*f+v,e[5]=o*h,e[9]=d*f-g,e[2]=g*f-d,e[6]=a*h,e[10]=v*f+u}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(nf,t,sf)}lookAt(t,e,n){let s=this.elements;return On.subVectors(t,e),On.lengthSq()===0&&(On.z=1),On.normalize(),Ui.crossVectors(n,On),Ui.lengthSq()===0&&(Math.abs(n.z)===1?On.x+=1e-4:On.z+=1e-4,On.normalize(),Ui.crossVectors(n,On)),Ui.normalize(),po.crossVectors(On,Ui),s[0]=Ui.x,s[4]=po.x,s[8]=On.x,s[1]=Ui.y,s[5]=po.y,s[9]=On.y,s[2]=Ui.z,s[6]=po.z,s[10]=On.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],h=n[1],f=n[5],u=n[9],d=n[13],g=n[2],v=n[6],m=n[10],p=n[14],y=n[3],T=n[7],_=n[11],A=n[15],w=s[0],x=s[4],S=s[8],I=s[12],b=s[1],N=s[5],G=s[9],K=s[13],D=s[2],z=s[6],Y=s[10],B=s[14],H=s[3],$=s[7],Q=s[11],dt=s[15];return r[0]=o*w+a*b+l*D+c*H,r[4]=o*x+a*N+l*z+c*$,r[8]=o*S+a*G+l*Y+c*Q,r[12]=o*I+a*K+l*B+c*dt,r[1]=h*w+f*b+u*D+d*H,r[5]=h*x+f*N+u*z+d*$,r[9]=h*S+f*G+u*Y+d*Q,r[13]=h*I+f*K+u*B+d*dt,r[2]=g*w+v*b+m*D+p*H,r[6]=g*x+v*N+m*z+p*$,r[10]=g*S+v*G+m*Y+p*Q,r[14]=g*I+v*K+m*B+p*dt,r[3]=y*w+T*b+_*D+A*H,r[7]=y*x+T*N+_*z+A*$,r[11]=y*S+T*G+_*Y+A*Q,r[15]=y*I+T*K+_*B+A*dt,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],o=t[1],a=t[5],l=t[9],c=t[13],h=t[2],f=t[6],u=t[10],d=t[14],g=t[3],v=t[7],m=t[11],p=t[15],y=l*d-c*u,T=a*d-c*f,_=a*u-l*f,A=o*d-c*h,w=o*u-l*h,x=o*f-a*h;return e*(v*y-m*T+p*_)-n*(g*y-m*A+p*w)+s*(g*T-v*A+p*x)-r*(g*_-v*w+m*x)}determinantAffine(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[1],o=t[5],a=t[9],l=t[2],c=t[6],h=t[10];return e*(o*h-a*c)-n*(r*h-a*l)+s*(r*c-o*l)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],f=t[9],u=t[10],d=t[11],g=t[12],v=t[13],m=t[14],p=t[15],y=e*a-n*o,T=e*l-s*o,_=e*c-r*o,A=n*l-s*a,w=n*c-r*a,x=s*c-r*l,S=h*v-f*g,I=h*m-u*g,b=h*p-d*g,N=f*m-u*v,G=f*p-d*v,K=u*p-d*m,D=y*K-T*G+_*N+A*b-w*I+x*S;if(D===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let z=1/D;return t[0]=(a*K-l*G+c*N)*z,t[1]=(s*G-n*K-r*N)*z,t[2]=(v*x-m*w+p*A)*z,t[3]=(u*w-f*x-d*A)*z,t[4]=(l*b-o*K-c*I)*z,t[5]=(e*K-s*b+r*I)*z,t[6]=(m*_-g*x-p*T)*z,t[7]=(h*x-u*_+d*T)*z,t[8]=(o*G-a*b+c*S)*z,t[9]=(n*b-e*G-r*S)*z,t[10]=(g*w-v*_+p*y)*z,t[11]=(f*_-h*w-d*y)*z,t[12]=(a*I-o*N-l*S)*z,t[13]=(e*N-n*I+s*S)*z,t[14]=(v*T-g*A-m*y)*z,t[15]=(h*A-f*T+u*y)*z,this}scale(t){let e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),s=Math.sin(e),r=1-n,o=t.x,a=t.y,l=t.z,c=r*o,h=r*a;return this.set(c*o+n,c*a-s*l,c*l+s*a,0,c*a+s*l,h*a+n,h*l-s*o,0,c*l-s*a,h*l+s*o,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,o){return this.set(1,n,r,0,t,1,o,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){let s=this.elements,r=e._x,o=e._y,a=e._z,l=e._w,c=r+r,h=o+o,f=a+a,u=r*c,d=r*h,g=r*f,v=o*h,m=o*f,p=a*f,y=l*c,T=l*h,_=l*f,A=n.x,w=n.y,x=n.z;return s[0]=(1-(v+p))*A,s[1]=(d+_)*A,s[2]=(g-T)*A,s[3]=0,s[4]=(d-_)*w,s[5]=(1-(u+p))*w,s[6]=(m+y)*w,s[7]=0,s[8]=(g+T)*x,s[9]=(m-y)*x,s[10]=(1-(u+v))*x,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),e.identity(),this;let o=Ts.set(s[0],s[1],s[2]).length(),a=Ts.set(s[4],s[5],s[6]).length(),l=Ts.set(s[8],s[9],s[10]).length();r<0&&(o=-o),ti.copy(this);let c=1/o,h=1/a,f=1/l;return ti.elements[0]*=c,ti.elements[1]*=c,ti.elements[2]*=c,ti.elements[4]*=h,ti.elements[5]*=h,ti.elements[6]*=h,ti.elements[8]*=f,ti.elements[9]*=f,ti.elements[10]*=f,e.setFromRotationMatrix(ti),n.x=o,n.y=a,n.z=l,this}makePerspective(t,e,n,s,r,o,a=Yn,l=!1){let c=this.elements,h=2*r/(e-t),f=2*r/(n-s),u=(e+t)/(e-t),d=(n+s)/(n-s),g,v;if(l)g=r/(o-r),v=o*r/(o-r);else if(a===Yn)g=-(o+r)/(o-r),v=-2*o*r/(o-r);else if(a===Hs)g=-o/(o-r),v=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=f,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=v,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,s,r,o,a=Yn,l=!1){let c=this.elements,h=2/(e-t),f=2/(n-s),u=-(e+t)/(e-t),d=-(n+s)/(n-s),g,v;if(l)g=1/(o-r),v=o/(o-r);else if(a===Yn)g=-2/(o-r),v=-(o+r)/(o-r);else if(a===Hs)g=-1/(o-r),v=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=f,c[9]=0,c[13]=d,c[2]=0,c[6]=0,c[10]=g,c[14]=v,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}},Ts=new R,ti=new He,nf=new R(0,0,0),sf=new R(1,1,1),Ui=new R,po=new R,On=new R,nh=new He,ih=new Hn,wi=class i{constructor(t=0,e=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let s=t.elements,r=s[0],o=s[4],a=s[8],l=s[1],c=s[5],h=s[9],f=s[2],u=s[6],d=s[10];switch(e){case"XYZ":this._y=Math.asin(Ce(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,d),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Ce(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,d),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(Ce(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-f,d),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Ce(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(u,d),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(Ce(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(a,d));break;case"XZY":this._z=Math.asin(-Ce(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,d),this._y=0);break;default:pe("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return nh.makeRotationFromQuaternion(t),this.setFromRotationMatrix(nh,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return ih.setFromEuler(this),this.setFromQuaternion(ih,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};wi.DEFAULT_ORDER="XYZ";var vr=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},rf=0,sh=new R,ws=new Hn,_i=new He,mo=new R,ir=new R,of=new R,af=new Hn,rh=new R(1,0,0),oh=new R(0,1,0),ah=new R(0,0,1),lh={type:"added"},lf={type:"removed"},bs={type:"childadded",child:null},Tl={type:"childremoved",child:null},cn=class i extends ii{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:rf++}),this.uuid=_s(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new R,e=new wi,n=new Hn,s=new R(1,1,1);function r(){n.setFromEuler(e,!1)}function o(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new He},normalMatrix:{value:new Te}}),this.matrix=new He,this.matrixWorld=new He,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new vr,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale),this.pivot!==null&&this.position.copy(this.pivot).applyMatrix4(this.matrix).sub(this.pivot)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return ws.setFromAxisAngle(t,e),this.quaternion.multiply(ws),this}rotateOnWorldAxis(t,e){return ws.setFromAxisAngle(t,e),this.quaternion.premultiply(ws),this}rotateX(t){return this.rotateOnAxis(rh,t)}rotateY(t){return this.rotateOnAxis(oh,t)}rotateZ(t){return this.rotateOnAxis(ah,t)}translateOnAxis(t,e){return sh.copy(t).applyQuaternion(this.quaternion),this.position.add(sh.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(rh,t)}translateY(t){return this.translateOnAxis(oh,t)}translateZ(t){return this.translateOnAxis(ah,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(_i.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?mo.copy(t):mo.set(t,e,n);let s=this.parent;this.updateWorldMatrix(!0,!1),ir.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?_i.lookAt(ir,mo,this.up):_i.lookAt(mo,ir,this.up),this.quaternion.setFromRotationMatrix(_i),s&&(_i.extractRotation(s.matrixWorld),ws.setFromRotationMatrix(_i),this.quaternion.premultiply(ws.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(Ee("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(lh),bs.child=t,this.dispatchEvent(bs),bs.child=null):Ee("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(lf),Tl.child=t,this.dispatchEvent(Tl),Tl.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),_i.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),_i.multiply(t.parent.matrixWorld)),t.applyMatrix4(_i),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(lh),bs.child=t,this.dispatchEvent(bs),bs.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){let o=this.children[n].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ir,t,of),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ir,af,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}intersectsFrustum(){return!0}traverse(t){t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,n=t.y,s=t.z,r=this.matrix.elements;r[12]+=e-r[0]*e-r[4]*n-r[8]*s,r[13]+=n-r[1]*e-r[5]*n-r[9]*s,r[14]+=s-r[2]*e-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e,n=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),e===!0){let r=this.children;for(let o=0,a=r.length;o<a;o++)r[o].updateWorldMatrix(!1,!0,n)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,s.name=this.name,s.castShadow=this.castShadow,s.receiveShadow=this.receiveShadow,s.visible=this.visible,s.frustumCulled=this.frustumCulled,s.renderOrder=this.renderOrder,s.static=this.static,s.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(a=>({...a})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let f=l[c];r(t.shapes,f)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(t.materials,this.material[l]));s.material=a}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];s.animations.push(r(t.animations,l))}}if(e){let a=o(t.geometries),l=o(t.materials),c=o(t.textures),h=o(t.images),f=o(t.shapes),u=o(t.skeletons),d=o(t.animations),g=o(t.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),f.length>0&&(n.shapes=f),u.length>0&&(n.skeletons=u),d.length>0&&(n.animations=d),g.length>0&&(n.nodes=g)}return n.object=s,n;function o(a){let l=[];for(let c in a){let h=a[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let s=t.children[n];this.add(s.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};cn.DEFAULT_UP=new R(0,1,0);cn.DEFAULT_MATRIX_AUTO_UPDATE=!0;cn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Jt=class extends cn{constructor(){super(),this.isGroup=!0,this.type="Group"}},cf={type:"move"},Vs=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Jt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Jt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new R,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new R),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Jt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new R,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new R,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){o=!0;for(let v of t.hand.values()){let m=e.getJointPose(v,n),p=this._getHandJoint(c,v);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.quaternion,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}let h=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],u=h.position.distanceTo(f.position),d=.02,g=.005;c.inputState.pinching&&u>d+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&u<=d-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.quaternion,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:t,target:this})));a!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.quaternion,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(cf)))}return a!==null&&(a.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let n=new Jt;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}},_u={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Fi={h:0,s:0,l:0},go={h:0,s:0,l:0};function wl(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var fe=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=_n){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Ne.colorSpaceToWorking(this,e),this}setRGB(t,e,n,s=Ne.workingColorSpace){return this.r=t,this.g=e,this.b=n,Ne.colorSpaceToWorking(this,s),this}setHSL(t,e,n,s=Ne.workingColorSpace){if(t=bc(t,1),e=Ce(e,0,1),n=Ce(n,0,1),e===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+e):n+e-n*e,o=2*n-r;this.r=wl(o,r,t+1/3),this.g=wl(o,r,t),this.b=wl(o,r,t-1/3)}return Ne.colorSpaceToWorking(this,s),this}setStyle(t,e=_n){function n(r){r!==void 0&&parseFloat(r)<1&&pe("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseFloat(r[1]))/100,Math.min(100,parseFloat(r[2]))/100,Math.min(100,parseFloat(r[3]))/100,e);break;case"hsl":case"hsla":if(r=/^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:pe("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(r,16),e);pe("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=_n){let n=_u[t.toLowerCase()];return n!==void 0?this.setHex(n,e):pe("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Si(t.r),this.g=Si(t.g),this.b=Si(t.b),this}copyLinearToSRGB(t){return this.r=Os(t.r),this.g=Os(t.g),this.b=Os(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=_n){return Ne.workingToColorSpace(wn.copy(this),t),Math.round(Ce(wn.r*255,0,255))*65536+Math.round(Ce(wn.g*255,0,255))*256+Math.round(Ce(wn.b*255,0,255))}getHexString(t=_n){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Ne.workingColorSpace){Ne.workingToColorSpace(wn.copy(this),e);let n=wn.r,s=wn.g,r=wn.b,o=Math.max(n,s,r),a=Math.min(n,s,r),l,c,h=(a+o)/2;if(a===o)l=0,c=0;else{let f=o-a;switch(c=h<=.5?f/(o+a):f/(2-o-a),o){case n:l=(s-r)/f+(s<r?6:0);break;case s:l=(r-n)/f+2;break;case r:l=(n-s)/f+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=Ne.workingColorSpace){return Ne.workingToColorSpace(wn.copy(this),e),t.r=wn.r,t.g=wn.g,t.b=wn.b,t}getStyle(t=_n){Ne.workingToColorSpace(wn.copy(this),t);let e=wn.r,n=wn.g,s=wn.b;return t!==_n?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(Fi),this.setHSL(Fi.h+t,Fi.s+e,Fi.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Fi),t.getHSL(go);let n=dr(Fi.h,go.h,e),s=dr(Fi.s,go.s,e),r=dr(Fi.l,go.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},wn=new fe;fe.NAMES=_u;var Er=class i{constructor(t,e=1,n=1e3){this.isFog=!0,this.name="",this.color=new fe(t),this.near=e,this.far=n}clone(){return new i(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},ss=class extends cn{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new wi,this.environmentIntensity=1,this.environmentRotation=new wi,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),this.background=t.background!==null?t.background.clone():null,this.environment=t.environment!==null?t.environment.clone():null,this.fog=t.fog!==null?t.fog.clone():null,this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),this.overrideMaterial=t.overrideMaterial!==null?t.overrideMaterial.clone():null,this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),e.object.backgroundBlurriness=this.backgroundBlurriness,e.object.backgroundIntensity=this.backgroundIntensity,e.object.backgroundRotation=this.backgroundRotation.toArray(),e.object.environmentIntensity=this.environmentIntensity,e.object.environmentRotation=this.environmentRotation.toArray(),e}},ei=new R,yi=new R,bl=new R,vi=new R,Rs=new R,As=new R,ch=new R,Rl=new R,Al=new R,Cl=new R,Pl=new Ke,Il=new Ke,Dl=new Ke,Gi=class i{constructor(t=new R,e=new R,n=new R){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),ei.subVectors(t,e),s.cross(ei);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){ei.subVectors(s,e),yi.subVectors(n,e),bl.subVectors(t,e);let o=ei.dot(ei),a=ei.dot(yi),l=ei.dot(bl),c=yi.dot(yi),h=yi.dot(bl),f=o*c-a*a;if(f===0)return r.set(0,0,0),null;let u=1/f,d=(c*l-a*h)*u,g=(o*h-a*l)*u;return r.set(1-d-g,g,d)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,vi)===null?!1:vi.x>=0&&vi.y>=0&&vi.x+vi.y<=1}static getInterpolation(t,e,n,s,r,o,a,l){return this.getBarycoord(t,e,n,s,vi)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,vi.x),l.addScaledVector(o,vi.y),l.addScaledVector(a,vi.z),l)}static getInterpolatedAttribute(t,e,n,s,r,o){return Pl.setScalar(0),Il.setScalar(0),Dl.setScalar(0),Pl.fromBufferAttribute(t,e),Il.fromBufferAttribute(t,n),Dl.fromBufferAttribute(t,s),o.setScalar(0),o.addScaledVector(Pl,r.x),o.addScaledVector(Il,r.y),o.addScaledVector(Dl,r.z),o}static isFrontFacing(t,e,n,s){return ei.subVectors(n,e),yi.subVectors(t,e),ei.cross(yi).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return ei.subVectors(this.c,this.b),yi.subVectors(this.a,this.b),ei.cross(yi).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return i.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let n=this.a,s=this.b,r=this.c,o,a;Rs.subVectors(s,n),As.subVectors(r,n),Rl.subVectors(t,n);let l=Rs.dot(Rl),c=As.dot(Rl);if(l<=0&&c<=0)return e.copy(n);Al.subVectors(t,s);let h=Rs.dot(Al),f=As.dot(Al);if(h>=0&&f<=h)return e.copy(s);let u=l*f-h*c;if(u<=0&&l>=0&&h<=0&&l-h>0)return o=l/(l-h),e.copy(n).addScaledVector(Rs,o);Cl.subVectors(t,r);let d=Rs.dot(Cl),g=As.dot(Cl);if(g>=0&&d<=g)return e.copy(r);let v=d*c-l*g;if(v<=0&&c>=0&&g<=0)return a=c/(c-g),e.copy(n).addScaledVector(As,a);let m=h*g-d*f;if(m<=0&&f-h>=0&&d-g>=0)return ch.subVectors(r,s),a=(f-h)/(f-h+(d-g)),e.copy(s).addScaledVector(ch,a);let p=1/(m+v+u);return o=v*p,a=u*p,e.copy(n).addScaledVector(Rs,o).addScaledVector(As,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},hi=class{constructor(t=new R(1/0,1/0,1/0),e=new R(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(ni.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(ni.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=ni.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0&&t.isBatchedMesh!==!0)for(let o=0,a=r.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,ni):ni.fromBufferAttribute(r,o),ni.applyMatrix4(t.matrixWorld),this.expandByPoint(ni);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),xo.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),xo.copy(n.boundingBox)),xo.applyMatrix4(t.matrixWorld),this.union(xo)}let s=t.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,ni),ni.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(sr),_o.subVectors(this.max,sr),Cs.subVectors(t.a,sr),Ps.subVectors(t.b,sr),Is.subVectors(t.c,sr),Oi.subVectors(Ps,Cs),Bi.subVectors(Is,Ps),$i.subVectors(Cs,Is);let e=[0,-Oi.z,Oi.y,0,-Bi.z,Bi.y,0,-$i.z,$i.y,Oi.z,0,-Oi.x,Bi.z,0,-Bi.x,$i.z,0,-$i.x,-Oi.y,Oi.x,0,-Bi.y,Bi.x,0,-$i.y,$i.x,0];return!Ll(e,Cs,Ps,Is,_o)||(e=[1,0,0,0,1,0,0,0,1],!Ll(e,Cs,Ps,Is,_o))?!1:(yo.crossVectors(Oi,Bi),e=[yo.x,yo.y,yo.z],Ll(e,Cs,Ps,Is,_o))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,ni).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(ni).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Ei[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Ei[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Ei[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Ei[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Ei[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Ei[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Ei[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Ei[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Ei),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},Ei=[new R,new R,new R,new R,new R,new R,new R,new R],ni=new R,xo=new hi,Cs=new R,Ps=new R,Is=new R,Oi=new R,Bi=new R,$i=new R,sr=new R,_o=new R,yo=new R,ji=new R;function Ll(i,t,e,n,s){for(let r=0,o=i.length-3;r<=o;r+=3){ji.fromArray(i,r);let a=s.x*Math.abs(ji.x)+s.y*Math.abs(ji.y)+s.z*Math.abs(ji.z),l=t.dot(ji),c=e.dot(ji),h=n.dot(ji);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var on=new R,vo=new bt,hf=0,Pn=class extends ii{constructor(t,e,n=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:hf++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=uu,this.updateRanges=[],this.gpuType=jn,this.version=0,this._normalizationScale=t!==void 0?Ac(t):void 0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this._normalizationScale=t._normalizationScale,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)vo.fromBufferAttribute(this,e),vo.applyMatrix3(t),this.setXY(e,vo.x,vo.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)on.fromBufferAttribute(this,e),on.applyMatrix3(t),this.setXYZ(e,on.x,on.y,on.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)on.fromBufferAttribute(this,e),on.applyMatrix4(t),this.setXYZ(e,on.x,on.y,on.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)on.fromBufferAttribute(this,e),on.applyNormalMatrix(t),this.setXYZ(e,on.x,on.y,on.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)on.fromBufferAttribute(this,e),on.transformDirection(t),this.setXYZ(e,on.x,on.y,on.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=this._denormalize(n)),n}setComponent(t,e,n){return this.normalized&&(n=this._normalize(n)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=this._denormalize(e)),e}setX(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=this._denormalize(e)),e}setY(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=this._denormalize(e)),e}setZ(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=this._denormalize(e)),e}setW(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=this._normalize(e),n=this._normalize(n)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=this._normalize(e),n=this._normalize(n),s=this._normalize(s)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=this._normalize(e),n=this._normalize(n),s=this._normalize(s),r=this._normalize(r)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return t.name=this.name,t.usage=this.usage,t.gpuType=this.gpuType,t}dispose(){this.dispatchEvent({type:"dispose"})}_denormalize(t){let e=this._normalizationScale;return e!==void 0?Math.max(t/e,-1):gu(t,this.array)}_normalize(t){let e=this._normalizationScale;return e!==void 0?Math.round(t*e):xu(t,this.array)}};var Mr=class extends Pn{constructor(t,e,n){super(new Uint16Array(t),e,n)}};var Sr=class extends Pn{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var me=class extends Pn{constructor(t,e,n){super(new Float32Array(t),e,n)}},uf=new hi,rr=new R,Nl=new R,bi=class{constructor(t=new R,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):uf.setFromPoints(t).getCenter(n);let s=0;for(let r=0,o=t.length;r<o;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;rr.subVectors(t,this.center);let e=rr.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(rr,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Nl.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(rr.copy(t.center).add(Nl)),this.expandByPoint(rr.copy(t.center).sub(Nl))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},df=0,qn=new He,Ul=new cn,Ds=new R,Bn=new hi,or=new hi,pn=new R,qe=class i extends ii{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:df++}),this.uuid=_s(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(Fd(t)?Sr:Mr)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new Te().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return qn.makeRotationFromQuaternion(t),this.applyMatrix4(qn),this}rotateX(t){return qn.makeRotationX(t),this.applyMatrix4(qn),this}rotateY(t){return qn.makeRotationY(t),this.applyMatrix4(qn),this}rotateZ(t){return qn.makeRotationZ(t),this.applyMatrix4(qn),this}translate(t,e,n){return qn.makeTranslation(t,e,n),this.applyMatrix4(qn),this}scale(t,e,n){return qn.makeScale(t,e,n),this.applyMatrix4(qn),this}lookAt(t){return Ul.lookAt(t),Ul.updateMatrix(),this.applyMatrix4(Ul.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ds).negate(),this.translate(Ds.x,Ds.y,Ds.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let s=0,r=t.length;s<r;s++){let o=t[s];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new me(n,3))}else{let n=Math.min(t.length,e.count);for(let s=0;s<n;s++){let r=t[s];e.setXYZ(s,r.x,r.y,r.z||0)}t.length>e.count&&pe("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new hi);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ee("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new R(-1/0,-1/0,-1/0),new R(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){let r=e[n];Bn.setFromBufferAttribute(r),this.morphTargetsRelative?(pn.addVectors(this.boundingBox.min,Bn.min),this.boundingBox.expandByPoint(pn),pn.addVectors(this.boundingBox.max,Bn.max),this.boundingBox.expandByPoint(pn)):(this.boundingBox.expandByPoint(Bn.min),this.boundingBox.expandByPoint(Bn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ee('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new bi);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ee("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new R,1/0);return}if(t){let n=this.boundingSphere.center;if(Bn.setFromBufferAttribute(t),e)for(let r=0,o=e.length;r<o;r++){let a=e[r];or.setFromBufferAttribute(a),this.morphTargetsRelative?(pn.addVectors(Bn.min,or.min),Bn.expandByPoint(pn),pn.addVectors(Bn.max,or.max),Bn.expandByPoint(pn)):(Bn.expandByPoint(or.min),Bn.expandByPoint(or.max))}Bn.getCenter(n);let s=0;for(let r=0,o=t.count;r<o;r++)pn.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(pn));if(e)for(let r=0,o=e.length;r<o;r++){let a=e[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)pn.fromBufferAttribute(a,c),l&&(Ds.fromBufferAttribute(t,c),pn.add(Ds)),s=Math.max(s,n.distanceToSquared(pn))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Ee('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){Ee("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,s=e.normal,r=e.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==n.count)&&(o=new Pn(new Float32Array(4*n.count),4),this.setAttribute("tangent",o));let a=[],l=[],c=new Uint8Array(n.count);for(let I=0;I<n.count;I++)a[I]=new R,l[I]=new R;let h=new R,f=new R,u=new R,d=new bt,g=new bt,v=new bt,m=new R,p=new R;function y(I,b,N){c[I]=c[b]=c[N]=1,h.fromBufferAttribute(n,I),f.fromBufferAttribute(n,b),u.fromBufferAttribute(n,N),d.fromBufferAttribute(r,I),g.fromBufferAttribute(r,b),v.fromBufferAttribute(r,N),f.sub(h),u.sub(h),g.sub(d),v.sub(d);let G=1/(g.x*v.y-v.x*g.y);isFinite(G)&&(m.copy(f).multiplyScalar(v.y).addScaledVector(u,-g.y).multiplyScalar(G),p.copy(u).multiplyScalar(g.x).addScaledVector(f,-v.x).multiplyScalar(G),a[I].add(m),a[b].add(m),a[N].add(m),l[I].add(p),l[b].add(p),l[N].add(p))}let T=this.groups;T.length===0&&(T=[{start:0,count:t.count}]);for(let I=0,b=T.length;I<b;++I){let N=T[I],G=N.start,K=N.count;for(let D=G,z=G+K;D<z;D+=3)y(t.getX(D+0),t.getX(D+1),t.getX(D+2))}let _=new R,A=new R,w=new R,x=new R;function S(I){w.fromBufferAttribute(s,I),x.copy(w);let b=a[I];_.copy(b),_.sub(w.multiplyScalar(w.dot(b))).normalize(),A.crossVectors(x,b);let G=A.dot(l[I])<0?-1:1;o.setXYZW(I,_.x,_.y,_.z,G)}for(let I=0,b=n.count;I<b;++I)c[I]&&S(I);this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==e.count)n=new Pn(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let u=0,d=n.count;u<d;u++)n.setXYZ(u,0,0,0);let s=new R,r=new R,o=new R,a=new R,l=new R,c=new R,h=new R,f=new R;if(t)for(let u=0,d=t.count;u<d;u+=3){let g=t.getX(u+0),v=t.getX(u+1),m=t.getX(u+2);s.fromBufferAttribute(e,g),r.fromBufferAttribute(e,v),o.fromBufferAttribute(e,m),h.subVectors(o,r),f.subVectors(s,r),h.cross(f),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,v),c.fromBufferAttribute(n,m),a.add(h),l.add(h),c.add(h),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(v,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let u=0,d=e.count;u<d;u+=3)s.fromBufferAttribute(e,u+0),r.fromBufferAttribute(e,u+1),o.fromBufferAttribute(e,u+2),h.subVectors(o,r),f.subVectors(s,r),h.cross(f),n.setXYZ(u+0,h.x,h.y,h.z),n.setXYZ(u+1,h.x,h.y,h.z),n.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)pn.fromBufferAttribute(t,e),pn.normalize(),t.setXYZ(e,pn.x,pn.y,pn.z)}toNonIndexed(){function t(a,l){let c=a.array,h=a.itemSize,f=a.normalized,u=new c.constructor(l.length*h),d=0,g=0;for(let v=0,m=l.length;v<m;v++){a.isInterleavedBufferAttribute?d=l[v]*a.data.stride+a.offset:d=l[v]*h;for(let p=0;p<h;p++)u[g++]=c[d++]}return new Pn(u,h,f)}if(this.index===null)return pe("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,n=this.index.array,s=this.attributes;for(let a in s){let l=s[a],c=t(l,n);e.setAttribute(a,c)}let r=this.morphAttributes;for(let a in r){let l=[],c=r[a];for(let h=0,f=c.length;h<f;h++){let u=c[h],d=t(u,n);l.push(d)}e.morphAttributes[a]=l}e.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,t.name=this.name,Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let l in n){let c=n[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let f=0,u=c.length;f<u;f++){let d=c[f];h.push(d.toJSON(t.data))}h.length>0&&(s[l]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(t.data.boundingSphere=a.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone());let s=t.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(e))}let r=t.morphAttributes;for(let c in r){let h=[],f=r[c];for(let u=0,d=f.length;u<d;u++)h.push(f[u].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let o=t.groups;for(let c=0,h=o.length;c<h;c++){let f=o[c];this.addGroup(f.start,f.count,f.materialIndex)}let a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Fl=new R,ff=new R,pf=new Te,bn=class{constructor(t=new R(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let s=Fl.subVectors(n,e).cross(ff.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,n=!0){let s=t.delta(Fl),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let o=-(t.start.dot(this.normal)+this.constant)/r;return n===!0&&(o<0||o>1)?null:e.copy(t.start).addScaledVector(s,o)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||pf.getNormalMatrix(t),s=this.coplanarPoint(Fl).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(t){return this.normal.fromArray(t.normal),this.constant=t.constant,this}},mf=0,ui=class extends ii{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:mf++}),this.uuid=_s(),this.name="",this.type="Material",this.blending=Yi,this.side=Kn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=sc,this.blendDst=rc,this.blendEquation=ms,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new fe(0,0,0),this.blendAlpha=0,this.depthFunc=Bs,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=ru,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Go,this.stencilZFail=Go,this.stencilZPass=Go,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){pe(`Material: parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){pe(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.diffuseRoughness!==void 0&&(n.diffuseRoughness=this.diffuseRoughness),this.diffuseRoughnessMap&&this.diffuseRoughnessMap.isTexture&&(n.diffuseRoughnessMap=this.diffuseRoughnessMap.toJSON(t).uuid),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessMinimum!==void 0&&(n.iridescenceThicknessMinimum=this.iridescenceThicknessMinimum),this.iridescenceThicknessMaximum!==void 0&&(n.iridescenceThicknessMaximum=this.iridescenceThicknessMaximum),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let o=[];for(let a in r){let l=r[a];delete l.metadata,o.push(l)}return o}if(e){let r=s(t.textures),o=s(t.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new fe().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.diffuseRoughness!==void 0&&(this.diffuseRoughness=t.diffuseRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.retroreflectivity!==void 0&&(this.retroreflectivity=t.retroreflectivity),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessMinimum!==void 0&&(this.iridescenceThicknessMinimum=t.iridescenceThicknessMinimum),t.iridescenceThicknessMaximum!==void 0&&(this.iridescenceThicknessMaximum=t.iridescenceThicknessMaximum),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessMinimum=t.iridescenceThicknessRange[0],this.iridescenceThicknessMaximum=t.iridescenceThicknessRange[1]),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.clippingPlanes!==void 0&&(this.clippingPlanes=t.clippingPlanes.map(n=>new bn().fromJSON(n))),t.clipIntersection!==void 0&&(this.clipIntersection=t.clipIntersection),t.clipShadows!==void 0&&(this.clipShadows=t.clipShadows),t.depthPacking!==void 0&&(this.depthPacking=t.depthPacking),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.linecap!==void 0&&(this.linecap=t.linecap),t.linejoin!==void 0&&(this.linejoin=t.linejoin),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let n=t.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new bt().fromArray(n)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new bt().fromArray(t.clearcoatNormalScale)),t.diffuseRoughnessMap!==void 0&&(this.diffuseRoughnessMap=e[t.diffuseRoughnessMap]||null),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var Mi=new R,Ol=new R,Eo=new R,Mo=new R,rs=class{constructor(t=new R,e=new R(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Mi)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=Mi.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Mi.copy(this.origin).addScaledVector(this.direction,e),Mi.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){Ol.copy(t).add(e).multiplyScalar(.5),Eo.copy(e).sub(t).normalize(),Mo.copy(this.origin).sub(Ol);let r=t.distanceTo(e)*.5,o=-this.direction.dot(Eo),a=Mo.dot(this.direction),l=-Mo.dot(Eo),c=Mo.lengthSq(),h=Math.abs(1-o*o),f,u,d,g;if(h>0)if(f=o*l-a,u=o*a-l,g=r*h,f>=0)if(u>=-g)if(u<=g){let v=1/h;f*=v,u*=v,d=f*(f+o*u+2*a)+u*(o*f+u+2*l)+c}else u=r,f=Math.max(0,-(o*u+a)),d=-f*f+u*(u+2*l)+c;else u=-r,f=Math.max(0,-(o*u+a)),d=-f*f+u*(u+2*l)+c;else u<=-g?(f=Math.max(0,-(-o*r+a)),u=f>0?-r:Math.min(Math.max(-r,-l),r),d=-f*f+u*(u+2*l)+c):u<=g?(f=0,u=Math.min(Math.max(-r,-l),r),d=u*(u+2*l)+c):(f=Math.max(0,-(o*r+a)),u=f>0?r:Math.min(Math.max(-r,-l),r),d=-f*f+u*(u+2*l)+c);else u=o>0?-r:r,f=Math.max(0,-(o*u+a)),d=-f*f+u*(u+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,f),s&&s.copy(Ol).addScaledVector(Eo,u),d}intersectSphere(t,e){if(t.radius<0)return null;Mi.subVectors(t.center,this.origin);let n=Mi.dot(this.direction),s=Mi.dot(Mi)-n*n,r=t.radius*t.radius;if(s>r)return null;let o=Math.sqrt(r-s),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,e):this.at(a,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,o,a,l,c=1/this.direction.x,h=1/this.direction.y,f=1/this.direction.z,u=this.origin;return c>=0?(n=(t.min.x-u.x)*c,s=(t.max.x-u.x)*c):(n=(t.max.x-u.x)*c,s=(t.min.x-u.x)*c),h>=0?(r=(t.min.y-u.y)*h,o=(t.max.y-u.y)*h):(r=(t.max.y-u.y)*h,o=(t.min.y-u.y)*h),n>o||r>s||((r>n||isNaN(n))&&(n=r),(o<s||isNaN(s))&&(s=o),f>=0?(a=(t.min.z-u.z)*f,l=(t.max.z-u.z)*f):(a=(t.max.z-u.z)*f,l=(t.min.z-u.z)*f),n>l||a>s)||((a>n||n!==n)&&(n=a),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,Mi)!==null}intersectTriangle(t,e,n,s,r){let o=this.origin,a=this.direction,l=a.x,c=a.y,h=a.z,f=t.x-o.x,u=t.y-o.y,d=t.z-o.z,g=e.x-o.x,v=e.y-o.y,m=e.z-o.z,p=n.x-o.x,y=n.y-o.y,T=n.z-o.z,_=Math.abs(l),A=Math.abs(c),w=Math.abs(h),x,S,I,b,N,G,K,D,z,Y,B,H;if(_>=A&&_>=w?(I=l,G=f,z=g,H=p,l>=0?(x=c,S=h,b=u,N=d,K=v,D=m,Y=y,B=T):(x=h,S=c,b=d,N=u,K=m,D=v,Y=T,B=y)):A>=w?(I=c,G=u,z=v,H=y,c>=0?(x=h,S=l,b=d,N=f,K=m,D=g,Y=T,B=p):(x=l,S=h,b=f,N=d,K=g,D=m,Y=p,B=T)):(I=h,G=d,z=m,H=T,h>=0?(x=l,S=c,b=f,N=u,K=g,D=v,Y=p,B=y):(x=c,S=l,b=u,N=f,K=v,D=g,Y=y,B=p)),I===0)return null;let $=x/I,Q=S/I,dt=1/I,Ft=b-$*G,qt=N-Q*G,O=K-$*z,xt=D-Q*z,tt=Y-$*H,st=B-Q*H,pt=tt*xt-st*O,at=Ft*st-qt*tt,ee=O*qt-xt*Ft;if(s){if(pt<0||at<0||ee<0)return null}else if((pt<0||at<0||ee<0)&&(pt>0||at>0||ee>0))return null;let Mt=pt+at+ee;if(Mt===0)return null;let $t=dt*(pt*G+at*z+ee*H);return(Mt>0?$t<0:$t>0)?null:this.at($t/Mt,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},en=class extends ui{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new fe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new wi,this.combine=oc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},hh=new He,Qi=new rs,So=new bi,uh=new R,To=new R,wo=new R,bo=new R,Bl=new R,Ro=new R,dh=new R,Ao=new R,P=class extends cn{constructor(t=new qe,e=new en){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0?this.morphTargetInfluences=t.morphTargetInfluences.slice():this.morphTargetInfluences=void 0,t.morphTargetDictionary!==void 0?this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary):this.morphTargetDictionary=void 0,this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(t,e){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;e.fromBufferAttribute(s,t);let a=this.morphTargetInfluences;if(r&&a){Ro.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=a[l],f=r[l];h!==0&&(Bl.fromBufferAttribute(f,t),o?Ro.addScaledVector(Bl,h):Ro.addScaledVector(Bl.sub(e),h))}e.add(Ro)}return e}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),So.copy(n.boundingSphere),So.applyMatrix4(r),Qi.copy(t.ray).recast(t.near),!(So.containsPoint(Qi.origin)===!1&&(Qi.intersectSphere(So,uh)===null||Qi.origin.distanceToSquared(uh)>(t.far-t.near)**2))&&(hh.copy(r).invert(),Qi.copy(t.ray).applyMatrix4(hh),!(n.boundingBox!==null&&Qi.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Qi)))}_computeIntersections(t,e,n){let s,r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,f=r.attributes.normal,u=r.groups,d=r.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,v=u.length;g<v;g++){let m=u[g],p=o[m.materialIndex],y=Math.max(m.start,d.start),T=Math.min(a.count,Math.min(m.start+m.count,d.start+d.count));for(let _=y,A=T;_<A;_+=3){let w=a.getX(_),x=a.getX(_+1),S=a.getX(_+2);s=Co(this,p,t,n,c,h,f,w,x,S),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let g=Math.max(0,d.start),v=Math.min(a.count,d.start+d.count);for(let m=g,p=v;m<p;m+=3){let y=a.getX(m),T=a.getX(m+1),_=a.getX(m+2);s=Co(this,o,t,n,c,h,f,y,T,_),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(o))for(let g=0,v=u.length;g<v;g++){let m=u[g],p=o[m.materialIndex],y=Math.max(m.start,d.start),T=Math.min(l.count,Math.min(m.start+m.count,d.start+d.count));for(let _=y,A=T;_<A;_+=3){let w=_,x=_+1,S=_+2;s=Co(this,p,t,n,c,h,f,w,x,S),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let g=Math.max(0,d.start),v=Math.min(l.count,d.start+d.count);for(let m=g,p=v;m<p;m+=3){let y=m,T=m+1,_=m+2;s=Co(this,o,t,n,c,h,f,y,T,_),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}}};function gf(i,t,e,n,s,r,o,a){let l;if(t.side===vn?l=n.intersectTriangle(o,r,s,!0,a):l=n.intersectTriangle(s,r,o,t.side===Kn,a),l===null)return null;Ao.copy(a),Ao.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(Ao);return c<e.near||c>e.far?null:{distance:c,point:Ao.clone(),object:i}}function Co(i,t,e,n,s,r,o,a,l,c){i.getVertexPosition(a,To),i.getVertexPosition(l,wo),i.getVertexPosition(c,bo);let h=gf(i,t,e,n,To,wo,bo,dh);if(h){let f=new R;Gi.getBarycoord(dh,To,wo,bo,f),s&&(h.uv=Gi.getInterpolatedAttribute(s,a,l,c,f,new bt)),r&&(h.uv1=Gi.getInterpolatedAttribute(r,a,l,c,f,new bt)),o&&(h.normal=Gi.getInterpolatedAttribute(o,a,l,c,f,new R),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let u={a,b:l,c,normal:new R,materialIndex:0};Gi.getNormal(To,wo,bo,u.normal),h.face=u,h.barycoord=f}return h}var os=class extends In{constructor(t=null,e=1,n=1,s,r,o,a,l,c=nn,h=nn,f,u){super(null,o,a,l,c,h,s,r,f,u),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Tr=class extends Pn{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){let t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}},Ls=new He,fh=new He,Po=[],ph=new hi,xf=new He,ar=new P,lr=new bi,as=class extends P{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new Tr(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,xf)}computeBoundingBox(){let t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new hi),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Ls),ph.copy(t.boundingBox).applyMatrix4(Ls),this.boundingBox.union(ph)}computeBoundingSphere(){let t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new bi),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Ls),lr.copy(t.boundingSphere).applyMatrix4(Ls),this.boundingSphere.union(lr)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),this.morphTexture=t.morphTexture!==null?t.morphTexture.clone():null,this.instanceColor=t.instanceColor!==null?t.instanceColor.clone():null,this.count=t.count,this.boundingBox=t.boundingBox!==null?t.boundingBox.clone():null,this.boundingSphere=t.boundingSphere!==null?t.boundingSphere.clone():null,this}getColorAt(t,e){return this.instanceColor===null?e.setRGB(1,1,1):e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){return e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){let n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,o=t*r+1;for(let a=0;a<n.length;a++)n[a]=s[o+a]}raycast(t,e){let n=this.matrixWorld,s=this.count;if(ar.geometry=this.geometry,ar.material=this.material,ar.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),lr.copy(this.boundingSphere),lr.applyMatrix4(n),t.ray.intersectsSphere(lr)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,Ls),fh.multiplyMatrices(n,Ls),ar.matrixWorld=fh,ar.raycast(t,Po);for(let o=0,a=Po.length;o<a;o++){let l=Po[o];l.instanceId=r,l.object=this,e.push(l)}Po.length=0}}setColorAt(t,e){return this.instanceColor===null&&(this.instanceColor=new Tr(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3),this}setMatrixAt(t,e){return e.toArray(this.instanceMatrix.array,t*16),this}setMorphAt(t,e){let n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new os(new Float32Array(s*this.count),s,this.count,Pa,jn));let r=this.morphTexture.source.data.data,o=0;for(let c=0;c<n.length;c++)o+=n[c];let a=this.geometry.morphTargetsRelative?1:1-o,l=s*t;return r[l]=a,r.set(n,l+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.instanceMatrix.dispose(),this.instanceColor!==null&&this.instanceColor.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},ts=new bi,_f=new bt(.5,.5),Io=new R,zi=class{constructor(t=new bn,e=new bn,n=new bn,s=new bn,r=new bn,o=new bn){this.planes=[t,e,n,s,r,o]}set(t,e,n,s,r,o){let a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(n),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(t){let e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=Yn,n=!1){let s=this.planes,r=t.elements,o=r[0],a=r[1],l=r[2],c=r[3],h=r[4],f=r[5],u=r[6],d=r[7],g=r[8],v=r[9],m=r[10],p=r[11],y=r[12],T=r[13],_=r[14],A=r[15];if(s[0].setComponents(c-o,d-h,p-g,A-y).normalize(),s[1].setComponents(c+o,d+h,p+g,A+y).normalize(),s[2].setComponents(c+a,d+f,p+v,A+T).normalize(),s[3].setComponents(c-a,d-f,p-v,A-T).normalize(),n)s[4].setComponents(l,u,m,_).normalize(),s[5].setComponents(c-l,d-u,p-m,A-_).normalize();else if(s[4].setComponents(c-l,d-u,p-m,A-_).normalize(),e===Yn)s[5].setComponents(c+l,d+u,p+m,A+_).normalize();else if(e===Hs)s[5].setComponents(l,u,m,_).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),ts.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),ts.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(ts)}intersectsSprite(t){ts.center.set(0,0,0);let e=_f.distanceTo(t.center);return ts.radius=.7071067811865476+e,ts.applyMatrix4(t.matrixWorld),this.intersectsSphere(ts)}intersectsSphere(t){let e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){let e=this.planes;for(let n=0;n<6;n++){let s=e[n];if(Io.x=s.normal.x>0?t.max.x:t.min.x,Io.y=s.normal.y>0?t.max.y:t.min.y,Io.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(Io)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},mh=new He,Qo=class i{constructor(){this.coordinateSystem=Yn,this._frustums=[],this._count=0}setFromArrayCamera(t){let e=t.cameras,n=this._frustums;for(let s=0;s<e.length;s++){let r=e[s];mh.multiplyMatrices(r.projectionMatrix,r.matrixWorldInverse),n[s]===void 0&&(n[s]=new zi),n[s].setFromProjectionMatrix(mh,r.coordinateSystem,r.reversedDepth)}return this._count=e.length,this}getFrustum(t){return this._frustums[t]}intersectsObject(t){let e=this._frustums;for(let n=0;n<this._count;n++)if(e[n].intersectsObject(t))return!0;return!1}intersectsSprite(t){let e=this._frustums;for(let n=0;n<this._count;n++)if(e[n].intersectsSprite(t))return!0;return!1}intersectsSphere(t){let e=this._frustums;for(let n=0;n<this._count;n++)if(e[n].intersectsSphere(t))return!0;return!1}intersectsBox(t){let e=this._frustums;for(let n=0;n<this._count;n++)if(e[n].intersectsBox(t))return!0;return!1}containsPoint(t){let e=this._frustums;for(let n=0;n<this._count;n++)if(e[n].containsPoint(t))return!0;return!1}copy(t){this.coordinateSystem=t.coordinateSystem;let e=this._frustums,n=t._frustums;for(let s=0;s<t._count;s++)e[s]===void 0&&(e[s]=new zi),e[s].copy(n[s]);return this._count=t._count,this}clone(){return new i().copy(this)}};var ta=class extends ui{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new fe(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}},ea=new R,na=new R,gh=new He,cr=new rs,Do=new bi,Hl=new R,xh=new R,ia=class extends cn{constructor(t=new qe,e=new ta){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0?this.morphTargetInfluences=t.morphTargetInfluences.slice():this.morphTargetInfluences=void 0,t.morphTargetDictionary!==void 0?this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary):this.morphTargetDictionary=void 0,this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){let t=this.geometry;if(t.index===null){let e=t.attributes.position,n=[0];for(let s=1,r=e.count;s<r;s++)ea.fromBufferAttribute(e,s-1),na.fromBufferAttribute(e,s),n[s]=n[s-1],n[s]+=ea.distanceTo(na);t.setAttribute("lineDistance",new me(n,1))}else pe("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let n=this.geometry,s=this.matrixWorld,r=t.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Do.copy(n.boundingSphere),Do.applyMatrix4(s),Do.radius+=r,t.ray.intersectsSphere(Do)===!1)return;gh.copy(s).invert(),cr.copy(t.ray).applyMatrix4(gh);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,h=n.index,u=n.attributes.position;if(h!==null){let d=Math.max(0,o.start),g=Math.min(h.count,o.start+o.count);for(let v=d,m=g-1;v<m;v+=c){let p=h.getX(v),y=h.getX(v+1),T=Lo(this,t,cr,l,p,y,v);T&&e.push(T)}if(this.isLineLoop){let v=h.getX(g-1),m=h.getX(d),p=Lo(this,t,cr,l,v,m,g-1);p&&e.push(p)}}else{let d=Math.max(0,o.start),g=Math.min(u.count,o.start+o.count);for(let v=d,m=g-1;v<m;v+=c){let p=Lo(this,t,cr,l,v,v+1,v);p&&e.push(p)}if(this.isLineLoop){let v=Lo(this,t,cr,l,g-1,d,g-1);v&&e.push(v)}}}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function Lo(i,t,e,n,s,r,o){let a=i.geometry.attributes.position;if(ea.fromBufferAttribute(a,s),na.fromBufferAttribute(a,r),e.distanceSqToSegment(ea,na,Hl,xh)>n)return;Hl.applyMatrix4(i.matrixWorld);let c=t.ray.origin.distanceTo(Hl);if(!(c<t.near||c>t.far))return{distance:c,point:xh.clone().applyMatrix4(i.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:i}}var _h=new R,yh=new R,wr=class extends ia{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let t=this.geometry;if(t.index===null){let e=t.attributes.position,n=[];for(let s=0,r=e.count;s<r;s+=2)_h.fromBufferAttribute(e,s),yh.fromBufferAttribute(e,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+_h.distanceTo(yh);t.setAttribute("lineDistance",new me(n,1))}else pe("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var br=class extends In{constructor(t=[],e=gs,n,s,r,o,a,l,c,h){super(t,e,n,s,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}},Rr=class extends In{constructor(t,e,n,s,r,o,a,l,c){super(t,e,n,s,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var Ri=class extends In{constructor(t,e,n=si,s,r,o,a=nn,l=nn,c,h=Ti,f=1){if(h!==Ti&&h!==Pi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:t,height:e,depth:f};super(u,s,r,o,a,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new ks(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return e.compareFunction=this.compareFunction,e}},Ar=class extends Ri{constructor(t,e=si,n=gs,s,r,o=nn,a=nn,l,c=Ti){let h={width:t,height:t,depth:1},f=[h,h,h,h,h,h];super(t,t,e,n,s,r,o,a,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},Cr=class extends In{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},Yt=class i extends qe{constructor(t=1,e=1,n=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:o};let a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);let l=[],c=[],h=[],f=[],u=0,d=0;g("z","y","x",-1,-1,n,e,t,o,r,0),g("z","y","x",1,-1,n,e,-t,o,r,1),g("x","z","y",1,1,t,n,e,s,o,2),g("x","z","y",1,-1,t,n,-e,s,o,3),g("x","y","z",1,-1,t,e,n,s,r,4),g("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new me(c,3)),this.setAttribute("normal",new me(h,3)),this.setAttribute("uv",new me(f,2));function g(v,m,p,y,T,_,A,w,x,S,I){let b=_/x,N=A/S,G=_/2,K=A/2,D=w/2,z=x+1,Y=S+1,B=0,H=0,$=new R;for(let Q=0;Q<Y;Q++){let dt=Q*N-K;for(let Ft=0;Ft<z;Ft++){let qt=Ft*b-G;$[v]=qt*y,$[m]=dt*T,$[p]=D,c.push($.x,$.y,$.z),$[v]=0,$[m]=0,$[p]=w>0?1:-1,h.push($.x,$.y,$.z),f.push(Ft/x),f.push(1-Q/S),B+=1}}for(let Q=0;Q<S;Q++)for(let dt=0;dt<x;dt++){let Ft=u+dt+z*Q,qt=u+dt+z*(Q+1),O=u+(dt+1)+z*(Q+1),xt=u+(dt+1)+z*Q;l.push(Ft,qt,xt),l.push(qt,O,xt),H+=6}a.addGroup(d,H,I),d+=H,u+=B}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}},ls=class i extends qe{constructor(t=1,e=1,n=4,s=8,r=1){super(),this.type="CapsuleGeometry",this.parameters={radius:t,height:e,capSegments:n,radialSegments:s,heightSegments:r},e=Math.max(0,e),n=Math.max(1,Math.floor(n)),s=Math.max(3,Math.floor(s)),r=Math.max(1,Math.floor(r));let o=[],a=[],l=[],c=[],h=e/2,f=Math.PI/2*t,u=e,d=2*f+u,g=n*2+r,v=s+1,m=new R,p=new R;for(let y=0;y<=g;y++){let T=0,_=0,A=0,w=0;if(y<=n){let I=y/n,b=I*Math.PI/2;_=-h-t*Math.cos(b),A=t*Math.sin(b),w=-t*Math.cos(b),T=I*f}else if(y<=n+r){let I=(y-n)/r;_=-h+I*e,A=t,w=0,T=f+I*u}else{let I=(y-n-r)/n,b=I*Math.PI/2;_=h+t*Math.sin(b),A=t*Math.cos(b),w=t*Math.sin(b),T=f+u+I*f}let x=Math.max(0,Math.min(1,T/d)),S=0;y===0?S=.5/s:y===g&&(S=-.5/s);for(let I=0;I<=s;I++){let b=I/s,N=b*Math.PI*2,G=Math.sin(N),K=Math.cos(N);p.x=-A*K,p.y=_,p.z=A*G,a.push(p.x,p.y,p.z),m.set(-A*K,w,A*G),m.normalize(),l.push(m.x,m.y,m.z),c.push(b+S,x)}if(y>0){let I=(y-1)*v;for(let b=0;b<s;b++){let N=I+b,G=I+b+1,K=y*v+b,D=y*v+b+1;o.push(N,G,K),o.push(G,D,K)}}}this.setIndex(o),this.setAttribute("position",new me(a,3)),this.setAttribute("normal",new me(l,3)),this.setAttribute("uv",new me(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.height,t.capSegments,t.radialSegments,t.heightSegments)}},Ai=class i extends qe{constructor(t=1,e=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:n,thetaLength:s},e=Math.max(3,e);let r=[],o=[],a=[],l=[],c=new R,h=new bt;o.push(0,0,0),a.push(0,0,1),l.push(.5,.5);for(let f=0,u=3;f<=e;f++,u+=3){let d=n+f/e*s;c.x=t*Math.cos(d),c.y=t*Math.sin(d),o.push(c.x,c.y,c.z),a.push(0,0,1),h.x=(o[u]/t+1)/2,h.y=(o[u+1]/t+1)/2,l.push(h.x,h.y)}for(let f=1;f<=e;f++)r.push(f,f+1,0);this.setIndex(r),this.setAttribute("position",new me(o,3)),this.setAttribute("normal",new me(a,3)),this.setAttribute("uv",new me(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.segments,t.thetaStart,t.thetaLength)}},zt=class i extends qe{constructor(t=1,e=1,n=1,s=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};let c=this;s=Math.floor(s),r=Math.floor(r);let h=[],f=[],u=[],d=[],g=0,v=[],m=n/2,p=0;y(),o===!1&&(t>0&&T(!0),e>0&&T(!1)),this.setIndex(h),this.setAttribute("position",new me(f,3)),this.setAttribute("normal",new me(u,3)),this.setAttribute("uv",new me(d,2));function y(){let _=new R,A=new R,w=0,x=(e-t)/n;for(let S=0;S<=r;S++){let I=[],b=S/r,N=b*(e-t)+t;for(let G=0;G<=s;G++){let K=G/s,D=K*l+a,z=Math.sin(D),Y=Math.cos(D);A.x=N*z,A.y=-b*n+m,A.z=N*Y,f.push(A.x,A.y,A.z),_.set(z,x,Y).normalize(),u.push(_.x,_.y,_.z),d.push(K,1-b),I.push(g++)}v.push(I)}for(let S=0;S<s;S++)for(let I=0;I<r;I++){let b=v[I][S],N=v[I+1][S],G=v[I+1][S+1],K=v[I][S+1];(t>0||I!==0)&&(h.push(b,N,K),w+=3),(e>0||I!==r-1)&&(h.push(N,G,K),w+=3)}c.addGroup(p,w,0),p+=w}function T(_){let A=g,w=new bt,x=new R,S=0,I=_===!0?t:e,b=_===!0?1:-1;for(let G=1;G<=s;G++)f.push(0,m*b,0),u.push(0,b,0),d.push(.5,.5),g++;let N=g;for(let G=0;G<=s;G++){let D=G/s*l+a,z=Math.cos(D),Y=Math.sin(D);x.x=I*Y,x.y=m*b,x.z=I*z,f.push(x.x,x.y,x.z),u.push(0,b,0),w.x=z*.5+.5,w.y=Y*.5*b+.5,d.push(w.x,w.y),g++}for(let G=0;G<s;G++){let K=A+G,D=N+G;_===!0?h.push(D,D+1,K):h.push(D+1,D,K),S+=3}c.addGroup(p,S,_===!0?1:2),p+=S}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Rn=class i extends zt{constructor(t=1,e=1,n=32,s=1,r=!1,o=0,a=Math.PI*2){super(0,t,e,n,s,r,o,a),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:o,thetaLength:a}}static fromJSON(t){return new i(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Ws=class i extends qe{constructor(t=[],e=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:s};let r=[],o=[];a(s),c(n),h(),this.setAttribute("position",new me(r,3)),this.setAttribute("normal",new me(r.slice(),3)),this.setAttribute("uv",new me(o,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function a(y){let T=new R,_=new R,A=new R;for(let w=0;w<e.length;w+=3)d(e[w+0],T),d(e[w+1],_),d(e[w+2],A),l(T,_,A,y)}function l(y,T,_,A){let w=A+1,x=[];for(let S=0;S<=w;S++){x[S]=[];let I=y.clone().lerp(_,S/w),b=T.clone().lerp(_,S/w),N=w-S;for(let G=0;G<=N;G++)G===0&&S===w?x[S][G]=I:x[S][G]=I.clone().lerp(b,G/N)}for(let S=0;S<w;S++)for(let I=0;I<2*(w-S)-1;I++){let b=Math.floor(I/2);I%2===0?(u(x[S][b+1]),u(x[S+1][b]),u(x[S][b])):(u(x[S][b+1]),u(x[S+1][b+1]),u(x[S+1][b]))}}function c(y){let T=new R;for(let _=0;_<r.length;_+=3)T.x=r[_+0],T.y=r[_+1],T.z=r[_+2],T.normalize().multiplyScalar(y),r[_+0]=T.x,r[_+1]=T.y,r[_+2]=T.z}function h(){let y=new R;for(let T=0;T<r.length;T+=3){y.x=r[T+0],y.y=r[T+1],y.z=r[T+2];let _=m(y)/2/Math.PI+.5,A=p(y)/Math.PI+.5;o.push(_,1-A)}g(),f()}function f(){for(let y=0;y<o.length;y+=6){let T=o[y+0],_=o[y+2],A=o[y+4],w=Math.max(T,_,A),x=Math.min(T,_,A);w>.9&&x<.1&&(T<.2&&(o[y+0]+=1),_<.2&&(o[y+2]+=1),A<.2&&(o[y+4]+=1))}}function u(y){r.push(y.x,y.y,y.z)}function d(y,T){let _=y*3;T.x=t[_+0],T.y=t[_+1],T.z=t[_+2]}function g(){let y=new R,T=new R,_=new R,A=new R,w=new bt,x=new bt,S=new bt;for(let I=0,b=0;I<r.length;I+=9,b+=6){y.set(r[I+0],r[I+1],r[I+2]),T.set(r[I+3],r[I+4],r[I+5]),_.set(r[I+6],r[I+7],r[I+8]),w.set(o[b+0],o[b+1]),x.set(o[b+2],o[b+3]),S.set(o[b+4],o[b+5]),A.copy(y).add(T).add(_).divideScalar(3);let N=m(A);v(w,b+0,y,N),v(x,b+2,T,N),v(S,b+4,_,N)}}function v(y,T,_,A){A<0&&y.x===1&&(o[T]=y.x-1),_.x===0&&_.z===0&&(o[T]=A/2/Math.PI+.5)}function m(y){return Math.atan2(y.z,-y.x)}function p(y){return Math.atan2(-y.y,Math.sqrt(y.x*y.x+y.z*y.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.vertices,t.indices,t.radius,t.detail)}},Xs=class i extends Ws{constructor(t=1,e=0){let n=(1+Math.sqrt(5))/2,s=1/n,r=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-s,-n,0,-s,n,0,s,-n,0,s,n,-s,-n,0,-s,n,0,s,-n,0,s,n,0,-n,0,-s,n,0,-s,-n,0,s,n,0,s],o=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(r,o,t,e),this.type="DodecahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new i(t.radius,t.detail)}};var Gn=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){pe("Curve: .getPoint() not implemented.")}getPointAt(t,e){let n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],n,s=this.getPoint(0),r=0;e.push(0);for(let o=1;o<=t;o++)n=this.getPoint(o/t),r+=n.distanceTo(s),e.push(r),s=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e=null){let n=this.getLengths(),s=0,r=n.length,o;e?o=e:o=t*n[r-1];let a=0,l=r-1,c;for(;a<=l;)if(s=Math.floor(a+(l-a)/2),c=n[s]-o,c<0)a=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===o)return s/(r-1);let h=n[s],u=n[s+1]-h,d=(o-h)/u;return(s+d)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);let o=this.getPoint(s),a=this.getPoint(r),l=e||(o.isVector2?new bt:new R);return l.copy(a).sub(o).normalize(),l}getTangentAt(t,e){let n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e=!1){let n=new R,s=[],r=[],o=[],a=new R,l=new He;for(let d=0;d<=t;d++){let g=d/t;s[d]=this.getTangentAt(g,new R)}r[0]=new R,o[0]=new R;let c=Number.MAX_VALUE,h=Math.abs(s[0].x),f=Math.abs(s[0].y),u=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),f<=c&&(c=f,n.set(0,1,0)),u<=c&&n.set(0,0,1),a.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],a),o[0].crossVectors(s[0],r[0]);for(let d=1;d<=t;d++){if(r[d]=r[d-1].clone(),o[d]=o[d-1].clone(),a.crossVectors(s[d-1],s[d]),a.length()>Number.EPSILON){a.normalize();let g=Math.acos(Ce(s[d-1].dot(s[d]),-1,1));r[d].applyMatrix4(l.makeRotationAxis(a,g))}o[d].crossVectors(s[d],r[d])}if(e===!0){let d=Math.acos(Ce(r[0].dot(r[t]),-1,1));d/=t,s[0].dot(a.crossVectors(r[0],r[t]))>0&&(d=-d);for(let g=1;g<=t;g++)r[g].applyMatrix4(l.makeRotationAxis(s[g],d*g)),o[g].crossVectors(s[g],r[g])}return{tangents:s,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this.cacheArcLengths=null,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this.cacheArcLengths=null,this}},qs=class extends Gn{constructor(t=0,e=0,n=1,s=1,r=0,o=Math.PI*2,a=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(t,e=new bt){let n=e,s=Math.PI*2,r=this.aEndAngle-this.aStartAngle,o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(o?r=0:r=s),this.aClockwise===!0&&!o&&(r===s?r=-s:r=r-s);let a=this.aStartAngle+t*r,l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let h=Math.cos(this.aRotation),f=Math.sin(this.aRotation),u=l-this.aX,d=c-this.aY;l=u*h-d*f+this.aX,c=u*f+d*h+this.aY}return n.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},sa=class extends qs{constructor(t,e,n,s,r,o){super(t,e,n,n,s,r,o),this.isArcCurve=!0,this.type="ArcCurve"}};function Cc(){let i=0,t=0,e=0,n=0;function s(r,o,a,l){i=r,t=a,e=-3*r+3*o-2*a-l,n=2*r-2*o+a+l}return{initCatmullRom:function(r,o,a,l,c){s(o,a,c*(a-r),c*(l-o))},initNonuniformCatmullRom:function(r,o,a,l,c,h,f){let u=(o-r)/c-(a-r)/(c+h)+(a-o)/h,d=(a-o)/h-(l-o)/(h+f)+(l-a)/f;u*=h,d*=h,s(o,a,u,d)},calc:function(r){let o=r*r,a=o*r;return i+t*r+e*o+n*a}}}var vh=new R,Eh=new R,Gl=new Cc,zl=new Cc,kl=new Cc,yn=class extends Gn{constructor(t=[],e=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=s}getPoint(t,e=new R){let n=e,s=this.points,r=s.length,o=(r-(this.closed?0:1))*t,a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:l===0&&a===r-1&&(a=r-2,l=1);let c,h;this.closed||a>0?c=s[(a-1)%r]:(Eh.subVectors(s[0],s[1]).add(s[0]),c=Eh);let f=s[a%r],u=s[(a+1)%r];if(this.closed||a+2<r?h=s[(a+2)%r]:(vh.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=vh),this.curveType==="centripetal"||this.curveType==="chordal"){let d=this.curveType==="chordal"?.5:.25,g=Math.pow(c.distanceToSquared(f),d),v=Math.pow(f.distanceToSquared(u),d),m=Math.pow(u.distanceToSquared(h),d);v<1e-4&&(v=1),g<1e-4&&(g=v),m<1e-4&&(m=v),Gl.initNonuniformCatmullRom(c.x,f.x,u.x,h.x,g,v,m),zl.initNonuniformCatmullRom(c.y,f.y,u.y,h.y,g,v,m),kl.initNonuniformCatmullRom(c.z,f.z,u.z,h.z,g,v,m)}else this.curveType==="catmullrom"&&(Gl.initCatmullRom(c.x,f.x,u.x,h.x,this.tension),zl.initCatmullRom(c.y,f.y,u.y,h.y,this.tension),kl.initCatmullRom(c.z,f.z,u.z,h.z,this.tension));return n.set(Gl.calc(l),zl.calc(l),kl.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new R().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function Mh(i,t,e,n,s){let r=(n-t)*.5,o=(s-e)*.5,a=i*i,l=i*a;return(2*e-2*n+r+o)*l+(-3*e+3*n-2*r-o)*a+r*i+e}function yf(i,t){let e=1-i;return e*e*t}function vf(i,t){return 2*(1-i)*i*t}function Ef(i,t){return i*i*t}function fr(i,t,e,n){return yf(i,t)+vf(i,e)+Ef(i,n)}function Mf(i,t){let e=1-i;return e*e*e*t}function Sf(i,t){let e=1-i;return 3*e*e*i*t}function Tf(i,t){return 3*(1-i)*i*i*t}function wf(i,t){return i*i*i*t}function pr(i,t,e,n,s){return Mf(i,t)+Sf(i,e)+Tf(i,n)+wf(i,s)}var Pr=class extends Gn{constructor(t=new bt,e=new bt,n=new bt,s=new bt){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new bt){let n=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(pr(t,s.x,r.x,o.x,a.x),pr(t,s.y,r.y,o.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},ra=class extends Gn{constructor(t=new R,e=new R,n=new R,s=new R){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new R){let n=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(pr(t,s.x,r.x,o.x,a.x),pr(t,s.y,r.y,o.y,a.y),pr(t,s.z,r.z,o.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},Ir=class extends Gn{constructor(t=new bt,e=new bt){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new bt){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new bt){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},oa=class extends Gn{constructor(t=new R,e=new R){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new R){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new R){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Dr=class extends Gn{constructor(t=new bt,e=new bt,n=new bt){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new bt){let n=e,s=this.v0,r=this.v1,o=this.v2;return n.set(fr(t,s.x,r.x,o.x),fr(t,s.y,r.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},di=class extends Gn{constructor(t=new R,e=new R,n=new R){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new R){let n=e,s=this.v0,r=this.v1,o=this.v2;return n.set(fr(t,s.x,r.x,o.x),fr(t,s.y,r.y,o.y),fr(t,s.z,r.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Lr=class extends Gn{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new bt){let n=e,s=this.points,r=(s.length-1)*t,o=Math.floor(r),a=r-o,l=s[o===0?o:o-1],c=s[o],h=s[o>s.length-2?s.length-1:o+1],f=s[o>s.length-3?s.length-1:o+2];return n.set(Mh(a,l.x,c.x,h.x,f.x),Mh(a,l.y,c.y,h.y,f.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new bt().fromArray(s))}return this}},aa=Object.freeze({__proto__:null,ArcCurve:sa,CatmullRomCurve3:yn,CubicBezierCurve:Pr,CubicBezierCurve3:ra,EllipseCurve:qs,LineCurve:Ir,LineCurve3:oa,QuadraticBezierCurve:Dr,QuadraticBezierCurve3:di,SplineCurve:Lr}),la=class extends Gn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1,this.cacheLengths=null}add(t){this.curves.push(t)}closePath(){let t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){let n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new aa[n](e,t))}return this}getPoint(t,e){let n=t*this.getLength(),s=this.getCurveLengths(),r=0;for(;r<s.length;){if(s[r]>=n){let o=s[r]-n,a=this.curves[r],l=a.getLength(),c=l===0?0:1-o/l;return a.getPointAt(c,e)}r++}return null}getLength(){let t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let t=[],e=0;for(let n=0,s=this.curves.length;n<s;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){let e=[],n;for(let s=0,r=this.curves;s<r.length;s++){let o=r[s],a=o.isEllipseCurve?t*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?t*o.points.length:t,l=o.getPoints(a);for(let c=0;c<l.length;c++){let h=l[c];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(s.clone())}return this.autoClose=t.autoClose,this.cacheLengths=null,this}toJSON(){let t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){let s=this.curves[e];t.curves.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(new aa[s.type]().fromJSON(s))}return this.cacheLengths=null,this}},Nr=class extends la{constructor(t){super(),this.type="Path",this.currentPoint=new bt,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){let n=new Ir(this.currentPoint.clone(),new bt(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,s){let r=new Dr(this.currentPoint.clone(),new bt(t,e),new bt(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(t,e,n,s,r,o){let a=new Pr(this.currentPoint.clone(),new bt(t,e),new bt(n,s),new bt(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(t){let e=[this.currentPoint.clone()].concat(t),n=new Lr(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,s,r,o){let a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+a,e+l,n,s,r,o),this}absarc(t,e,n,s,r,o){return this.absellipse(t,e,n,n,s,r,o),this}ellipse(t,e,n,s,r,o,a,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,n,s,r,o,a,l),this}absellipse(t,e,n,s,r,o,a,l){let c=new qs(t,e,n,s,r,o,a,l);if(this.curves.length>0){let f=c.getPoint(0);f.equals(this.currentPoint)||this.lineTo(f.x,f.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){let t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}},zn=class extends Nr{constructor(t){super(t),this.uuid=_s(),this.type="Shape",this.holes=[]}getPointsHoles(t){let e=[];for(let n=0,s=this.holes.length;n<s;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){let s=this.holes[e];t.holes.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(new Nr().fromJSON(s))}return this}};function bf(i,t,e=2){let n=t&&t.length,s=n?t[0]*e:i.length,r=yu(i,0,s,e,!0),o=[];if(!r||r.next===r.prev)return o;let a,l,c;if(n&&(r=If(i,t,r,e)),i.length>80*e){a=i[0],l=i[1];let h=a,f=l;for(let u=e;u<s;u+=e){let d=i[u],g=i[u+1];d<a&&(a=d),g<l&&(l=g),d>h&&(h=d),g>f&&(f=g)}c=Math.max(h-a,f-l),c=c!==0?32767/c:0}return Ur(r,o,e,a,l,c,0),o}function yu(i,t,e,n,s){let r;if(s===kf(i,t,e,n)>0)for(let o=t;o<e;o+=n)r=Sh(o/n|0,i[o],i[o+1],r);else for(let o=e-n;o>=t;o-=n)r=Sh(o/n|0,i[o],i[o+1],r);return r&&Ys(r,r.next)&&(Or(r),r=r.next),r}function cs(i,t){if(!i)return i;t||(t=i);let e=i,n;do if(n=!1,!e.steiner&&(Ys(e,e.next)||je(e.prev,e,e.next)===0)){if(Or(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function Ur(i,t,e,n,s,r,o){if(!i)return;!o&&r&&Ff(i,n,s,r);let a=i;for(;i.prev!==i.next;){let l=i.prev,c=i.next;if(r?Af(i,n,s,r):Rf(i)){t.push(l.i,i.i,c.i),Or(i),i=c.next,a=c.next;continue}if(i=c,i===a){o?o===1?(i=Cf(cs(i),t),Ur(i,t,e,n,s,r,2)):o===2&&Pf(i,t,e,n,s,r):Ur(cs(i),t,e,n,s,r,1);break}}}function Rf(i){let t=i.prev,e=i,n=i.next;if(je(t,e,n)>=0)return!1;let s=t.x,r=e.x,o=n.x,a=t.y,l=e.y,c=n.y,h=Math.min(s,r,o),f=Math.min(a,l,c),u=Math.max(s,r,o),d=Math.max(a,l,c),g=n.next;for(;g!==t;){if(g.x>=h&&g.x<=u&&g.y>=f&&g.y<=d&&hr(s,a,r,l,o,c,g.x,g.y)&&je(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function Af(i,t,e,n){let s=i.prev,r=i,o=i.next;if(je(s,r,o)>=0)return!1;let a=s.x,l=r.x,c=o.x,h=s.y,f=r.y,u=o.y,d=Math.min(a,l,c),g=Math.min(h,f,u),v=Math.max(a,l,c),m=Math.max(h,f,u),p=Zl(d,g,t,e,n),y=Zl(v,m,t,e,n),T=i.prevZ,_=i.nextZ;for(;T&&T.z>=p&&_&&_.z<=y;){if(T.x>=d&&T.x<=v&&T.y>=g&&T.y<=m&&T!==s&&T!==o&&hr(a,h,l,f,c,u,T.x,T.y)&&je(T.prev,T,T.next)>=0||(T=T.prevZ,_.x>=d&&_.x<=v&&_.y>=g&&_.y<=m&&_!==s&&_!==o&&hr(a,h,l,f,c,u,_.x,_.y)&&je(_.prev,_,_.next)>=0))return!1;_=_.nextZ}for(;T&&T.z>=p;){if(T.x>=d&&T.x<=v&&T.y>=g&&T.y<=m&&T!==s&&T!==o&&hr(a,h,l,f,c,u,T.x,T.y)&&je(T.prev,T,T.next)>=0)return!1;T=T.prevZ}for(;_&&_.z<=y;){if(_.x>=d&&_.x<=v&&_.y>=g&&_.y<=m&&_!==s&&_!==o&&hr(a,h,l,f,c,u,_.x,_.y)&&je(_.prev,_,_.next)>=0)return!1;_=_.nextZ}return!0}function Cf(i,t){let e=i;do{let n=e.prev,s=e.next.next;!Ys(n,s)&&Eu(n,e,e.next,s)&&Fr(n,s)&&Fr(s,n)&&(t.push(n.i,e.i,s.i),Or(e),Or(e.next),e=i=s),e=e.next}while(e!==i);return cs(e)}function Pf(i,t,e,n,s,r){let o=i;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&Hf(o,a)){let l=Mu(o,a);o=cs(o,o.next),l=cs(l,l.next),Ur(o,t,e,n,s,r,0),Ur(l,t,e,n,s,r,0);return}a=a.next}o=o.next}while(o!==i)}function If(i,t,e,n){let s=[];for(let r=0,o=t.length;r<o;r++){let a=t[r]*n,l=r<o-1?t[r+1]*n:i.length,c=yu(i,a,l,n,!1);c===c.next&&(c.steiner=!0),s.push(Bf(c))}s.sort(Df);for(let r=0;r<s.length;r++)e=Lf(s[r],e);return e}function Df(i,t){let e=i.x-t.x;if(e===0&&(e=i.y-t.y,e===0)){let n=(i.next.y-i.y)/(i.next.x-i.x),s=(t.next.y-t.y)/(t.next.x-t.x);e=n-s}return e}function Lf(i,t){let e=Nf(i,t);if(!e)return t;let n=Mu(e,i);return cs(n,n.next),cs(e,e.next)}function Nf(i,t){let e=t,n=i.x,s=i.y,r=-1/0,o;if(Ys(i,e))return e;do{if(Ys(i,e.next))return e.next;if(s<=e.y&&s>=e.next.y&&e.next.y!==e.y){let f=e.x+(s-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(f<=n&&f>r&&(r=f,o=e.x<e.next.x?e:e.next,f===n))return o}e=e.next}while(e!==t);if(!o)return null;let a=o,l=o.x,c=o.y,h=1/0;e=o;do{if(n>=e.x&&e.x>=l&&n!==e.x&&vu(s<c?n:r,s,l,c,s<c?r:n,s,e.x,e.y)){let f=Math.abs(s-e.y)/(n-e.x);Fr(e,i)&&(f<h||f===h&&(e.x>o.x||e.x===o.x&&Uf(o,e)))&&(o=e,h=f)}e=e.next}while(e!==a);return o}function Uf(i,t){return je(i.prev,i,t.prev)<0&&je(t.next,i,i.next)<0}function Ff(i,t,e,n){let s=i;do s.z===0&&(s.z=Zl(s.x,s.y,t,e,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,Of(s)}function Of(i){let t,e=1;do{let n=i,s;i=null;let r=null;for(t=0;n;){t++;let o=n,a=0;for(let c=0;c<e&&(a++,o=o.nextZ,!!o);c++);let l=e;for(;a>0||l>0&&o;)a!==0&&(l===0||!o||n.z<=o.z)?(s=n,n=n.nextZ,a--):(s=o,o=o.nextZ,l--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;n=o}r.nextZ=null,e*=2}while(t>1);return i}function Zl(i,t,e,n,s){return i=(i-e)*s|0,t=(t-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function Bf(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function vu(i,t,e,n,s,r,o,a){return(s-o)*(t-a)>=(i-o)*(r-a)&&(i-o)*(n-a)>=(e-o)*(t-a)&&(e-o)*(r-a)>=(s-o)*(n-a)}function hr(i,t,e,n,s,r,o,a){return!(i===o&&t===a)&&vu(i,t,e,n,s,r,o,a)}function Hf(i,t){return i.next.i!==t.i&&i.prev.i!==t.i&&!Gf(i,t)&&(Fr(i,t)&&Fr(t,i)&&zf(i,t)&&(je(i.prev,i,t.prev)||je(i,t.prev,t))||Ys(i,t)&&je(i.prev,i,i.next)>0&&je(t.prev,t,t.next)>0)}function je(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function Ys(i,t){return i.x===t.x&&i.y===t.y}function Eu(i,t,e,n){let s=Uo(je(i,t,e)),r=Uo(je(i,t,n)),o=Uo(je(e,n,i)),a=Uo(je(e,n,t));return!!(s!==r&&o!==a||s===0&&No(i,e,t)||r===0&&No(i,n,t)||o===0&&No(e,i,n)||a===0&&No(e,t,n))}function No(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function Uo(i){return i>0?1:i<0?-1:0}function Gf(i,t){let e=i;do{if(e.i!==i.i&&e.next.i!==i.i&&e.i!==t.i&&e.next.i!==t.i&&Eu(e,e.next,i,t))return!0;e=e.next}while(e!==i);return!1}function Fr(i,t){return je(i.prev,i,i.next)<0?je(i,t,i.next)>=0&&je(i,i.prev,t)>=0:je(i,t,i.prev)<0||je(i,i.next,t)<0}function zf(i,t){let e=i,n=!1,s=(i.x+t.x)/2,r=(i.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&s<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==i);return n}function Mu(i,t){let e=Jl(i.i,i.x,i.y),n=Jl(t.i,t.x,t.y),s=i.next,r=t.prev;return i.next=t,t.prev=i,e.next=s,s.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function Sh(i,t,e,n){let s=Jl(i,t,e);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function Or(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function Jl(i,t,e){return{i,x:t,y:e,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function kf(i,t,e,n){let s=0;for(let r=t,o=e-n;r<e;r+=n)s+=(i[o]-i[r])*(i[r+1]+i[o+1]),o=r;return s}var Kl=class{static triangulate(t,e,n=2){return bf(t,e,n)}},es=class i{static area(t){let e=t.length,n=0;for(let s=e-1,r=0;r<e;s=r++)n+=t[s].x*t[r].y-t[r].x*t[s].y;return n*.5}static isClockWise(t){return i.area(t)<0}static triangulateShape(t,e){let n=[],s=[],r=[];Th(t),wh(n,t);let o=t.length;e.forEach(Th);for(let l=0;l<e.length;l++)s.push(o),o+=e[l].length,wh(n,e[l]);let a=Kl.triangulate(n,s);for(let l=0;l<a.length;l+=3)r.push(a.slice(l,l+3));return r}};function Th(i){let t=i.length;t>2&&i[t-1].equals(i[0])&&i.pop()}function wh(i,t){for(let e=0;e<t.length;e++)i.push(t[e].x),i.push(t[e].y)}var Zn=class i extends qe{constructor(t=new zn([new bt(.5,.5),new bt(-.5,.5),new bt(-.5,-.5),new bt(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];let n=this,s=[],r=[];for(let a=0,l=t.length;a<l;a++){let c=t[a];o(c)}this.setAttribute("position",new me(s,3)),this.setAttribute("uv",new me(r,2)),this.computeVertexNormals();function o(a){let l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,f=e.depth!==void 0?e.depth:1,u=e.bevelEnabled!==void 0?e.bevelEnabled:!0,d=e.bevelThickness!==void 0?e.bevelThickness:.2,g=e.bevelSize!==void 0?e.bevelSize:d-.1,v=e.bevelOffset!==void 0?e.bevelOffset:0,m=e.bevelSegments!==void 0?e.bevelSegments:3,p=e.extrudePath,y=e.UVGenerator!==void 0?e.UVGenerator:Vf,T,_=!1,A,w,x,S;if(p){T=p.getSpacedPoints(h),_=!0,u=!1;let k=p.isCatmullRomCurve3?p.closed:!1;A=p.computeFrenetFrames(h,k),w=new R,x=new R,S=new R}u||(m=0,d=0,g=0,v=0);let I=a.extractPoints(c),b=I.shape,N=I.holes;if(!es.isClockWise(b)){b=b.reverse();for(let k=0,rt=N.length;k<rt;k++){let ft=N[k];es.isClockWise(ft)&&(N[k]=ft.reverse())}}function K(k){let ft=10000000000000001e-36,At=k[0];for(let _t=1;_t<=k.length;_t++){let St=_t%k.length,Gt=k[St],Zt=Gt.x-At.x,ie=Gt.y-At.y,Xt=Zt*Zt+ie*ie,U=Math.max(Math.abs(Gt.x),Math.abs(Gt.y),Math.abs(At.x),Math.abs(At.y)),Pe=ft*U*U;if(Xt<=Pe){k.splice(St,1),_t--;continue}At=Gt}}K(b),N.forEach(K);let D=N.length,z=b;for(let k=0;k<D;k++){let rt=N[k];b=b.concat(rt)}function Y(k,rt,ft){return rt||Ee("ExtrudeGeometry: vec does not exist"),k.clone().addScaledVector(rt,ft)}let B=b.length;function H(k,rt,ft){let At,_t,St,Gt=k.x-rt.x,Zt=k.y-rt.y,ie=ft.x-k.x,Xt=ft.y-k.y,U=Gt*Gt+Zt*Zt,Pe=Gt*Xt-Zt*ie;if(Math.abs(Pe)>Number.EPSILON){let oe=Math.sqrt(U),Ae=Math.sqrt(ie*ie+Xt*Xt),Lt=rt.x-Zt/oe,Me=rt.y+Gt/oe,Kt=ft.x-Xt/Ae,se=ft.y+ie/Ae,C=((Kt-Lt)*Xt-(se-Me)*ie)/(Gt*Xt-Zt*ie);At=Lt+Gt*C-k.x,_t=Me+Zt*C-k.y;let E=At*At+_t*_t;if(E<=2)return new bt(At,_t);St=Math.sqrt(E/2)}else{let oe=!1;Gt>Number.EPSILON?ie>Number.EPSILON&&(oe=!0):Gt<-Number.EPSILON?ie<-Number.EPSILON&&(oe=!0):Math.sign(Zt)===Math.sign(Xt)&&(oe=!0),oe?(At=-Zt,_t=Gt,St=Math.sqrt(U)):(At=Gt,_t=Zt,St=Math.sqrt(U/2))}return new bt(At/St,_t/St)}let $=[];for(let k=0,rt=z.length,ft=rt-1,At=k+1;k<rt;k++,ft++,At++)ft===rt&&(ft=0),At===rt&&(At=0),$[k]=H(z[k],z[ft],z[At]);let Q=[],dt,Ft=$.concat();for(let k=0,rt=D;k<rt;k++){let ft=N[k];dt=[];for(let At=0,_t=ft.length,St=_t-1,Gt=At+1;At<_t;At++,St++,Gt++)St===_t&&(St=0),Gt===_t&&(Gt=0),dt[At]=H(ft[At],ft[St],ft[Gt]);Q.push(dt),Ft=Ft.concat(dt)}let qt;if(m===0)qt=es.triangulateShape(z,N);else{let k=[],rt=[];for(let ft=0;ft<m;ft++){let At=ft/m,_t=d*Math.cos(At*Math.PI/2),St=g*Math.sin(At*Math.PI/2)+v;for(let Gt=0,Zt=z.length;Gt<Zt;Gt++){let ie=Y(z[Gt],$[Gt],St);at(ie.x,ie.y,-_t),At===0&&k.push(ie)}for(let Gt=0,Zt=D;Gt<Zt;Gt++){let ie=N[Gt];dt=Q[Gt];let Xt=[];for(let U=0,Pe=ie.length;U<Pe;U++){let oe=Y(ie[U],dt[U],St);at(oe.x,oe.y,-_t),At===0&&Xt.push(oe)}At===0&&rt.push(Xt)}}qt=es.triangulateShape(k,rt)}let O=qt.length,xt=g+v;for(let k=0;k<B;k++){let rt=u?Y(b[k],Ft[k],xt):b[k];_?(x.copy(A.normals[0]).multiplyScalar(rt.x),w.copy(A.binormals[0]).multiplyScalar(rt.y),S.copy(T[0]).add(x).add(w),at(S.x,S.y,S.z)):at(rt.x,rt.y,0)}for(let k=1;k<=h;k++)for(let rt=0;rt<B;rt++){let ft=u?Y(b[rt],Ft[rt],xt):b[rt];_?(x.copy(A.normals[k]).multiplyScalar(ft.x),w.copy(A.binormals[k]).multiplyScalar(ft.y),S.copy(T[k]).add(x).add(w),at(S.x,S.y,S.z)):at(ft.x,ft.y,f/h*k)}for(let k=m-1;k>=0;k--){let rt=k/m,ft=d*Math.cos(rt*Math.PI/2),At=g*Math.sin(rt*Math.PI/2)+v;for(let _t=0,St=z.length;_t<St;_t++){let Gt=Y(z[_t],$[_t],At);at(Gt.x,Gt.y,f+ft)}for(let _t=0,St=N.length;_t<St;_t++){let Gt=N[_t];dt=Q[_t];for(let Zt=0,ie=Gt.length;Zt<ie;Zt++){let Xt=Y(Gt[Zt],dt[Zt],At);_?at(Xt.x,Xt.y+T[h-1].y,T[h-1].x+ft):at(Xt.x,Xt.y,f+ft)}}}tt(),st();function tt(){let k=s.length/3;if(u){let rt=0,ft=B*rt;for(let At=0;At<O;At++){let _t=qt[At];ee(_t[2]+ft,_t[1]+ft,_t[0]+ft)}rt=h+m*2,ft=B*rt;for(let At=0;At<O;At++){let _t=qt[At];ee(_t[0]+ft,_t[1]+ft,_t[2]+ft)}}else{for(let rt=0;rt<O;rt++){let ft=qt[rt];ee(ft[2],ft[1],ft[0])}for(let rt=0;rt<O;rt++){let ft=qt[rt];ee(ft[0]+B*h,ft[1]+B*h,ft[2]+B*h)}}n.addGroup(k,s.length/3-k,0)}function st(){let k=s.length/3,rt=0;pt(z,rt),rt+=z.length;for(let ft=0,At=N.length;ft<At;ft++){let _t=N[ft];pt(_t,rt),rt+=_t.length}n.addGroup(k,s.length/3-k,1)}function pt(k,rt){let ft=k.length;for(;--ft>=0;){let At=ft,_t=ft-1;_t<0&&(_t=k.length-1);for(let St=0,Gt=h+m*2;St<Gt;St++){let Zt=B*St,ie=B*(St+1),Xt=rt+At+Zt,U=rt+_t+Zt,Pe=rt+_t+ie,oe=rt+At+ie;Mt(Xt,U,Pe,oe)}}}function at(k,rt,ft){l.push(k),l.push(rt),l.push(ft)}function ee(k,rt,ft){$t(k),$t(rt),$t(ft);let At=s.length/3,_t=y.generateTopUV(n,s,At-3,At-2,At-1);lt(_t[0]),lt(_t[1]),lt(_t[2])}function Mt(k,rt,ft,At){$t(k),$t(rt),$t(At),$t(rt),$t(ft),$t(At);let _t=s.length/3,St=y.generateSideWallUV(n,s,_t-6,_t-3,_t-2,_t-1);lt(St[0]),lt(St[1]),lt(St[3]),lt(St[1]),lt(St[2]),lt(St[3])}function $t(k){s.push(l[k*3+0]),s.push(l[k*3+1]),s.push(l[k*3+2])}function lt(k){r.push(k.x),r.push(k.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return Wf(e,n,t)}static fromJSON(t,e){let n=[];for(let r=0,o=t.shapes.length;r<o;r++){let a=e[t.shapes[r]];n.push(a)}let s=t.options.extrudePath;return s!==void 0&&(t.options.extrudePath=new aa[s.type]().fromJSON(s)),new i(n,t.options)}},Vf={generateTopUV:function(i,t,e,n,s){let r=t[e*3],o=t[e*3+1],a=t[n*3],l=t[n*3+1],c=t[s*3],h=t[s*3+1];return[new bt(r,o),new bt(a,l),new bt(c,h)]},generateSideWallUV:function(i,t,e,n,s,r){let o=t[e*3],a=t[e*3+1],l=t[e*3+2],c=t[n*3],h=t[n*3+1],f=t[n*3+2],u=t[s*3],d=t[s*3+1],g=t[s*3+2],v=t[r*3],m=t[r*3+1],p=t[r*3+2];return Math.abs(a-h)<Math.abs(o-c)?[new bt(o,1-l),new bt(c,1-f),new bt(u,1-g),new bt(v,1-p)]:[new bt(a,1-l),new bt(h,1-f),new bt(d,1-g),new bt(m,1-p)]}};function Wf(i,t,e){if(e.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){let r=i[n];e.shapes.push(r.uuid)}else e.shapes.push(i.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}var Br=class i extends Ws{constructor(t=1,e=0){let n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,t,e),this.type="IcosahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new i(t.radius,t.detail)}};var Hr=class i extends Ws{constructor(t=1,e=0){let n=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],s=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(n,s,t,e),this.type="OctahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new i(t.radius,t.detail)}},be=class i extends qe{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};let r=t/2,o=e/2,a=Math.floor(n),l=Math.floor(s),c=a+1,h=l+1,f=t/a,u=e/l,d=[],g=[],v=[],m=[];for(let p=0;p<h;p++){let y=p*u-o;for(let T=0;T<c;T++){let _=T*f-r;g.push(_,-y,0),v.push(0,0,1),m.push(T/a),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let y=0;y<a;y++){let T=y+c*p,_=y+c*(p+1),A=y+1+c*(p+1),w=y+1+c*p;d.push(T,_,w),d.push(_,A,w)}this.setIndex(d),this.setAttribute("position",new me(g,3)),this.setAttribute("normal",new me(v,3)),this.setAttribute("uv",new me(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.widthSegments,t.heightSegments)}},Gr=class i extends qe{constructor(t=.5,e=1,n=32,s=1,r=0,o=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:t,outerRadius:e,thetaSegments:n,phiSegments:s,thetaStart:r,thetaLength:o},n=Math.max(3,n),s=Math.max(1,s);let a=[],l=[],c=[],h=[],f=t,u=(e-t)/s,d=new R,g=new bt;for(let v=0;v<=s;v++){for(let m=0;m<=n;m++){let p=r+m/n*o;d.x=f*Math.cos(p),d.y=f*Math.sin(p),l.push(d.x,d.y,d.z),c.push(0,0,1),g.x=(d.x/e+1)/2,g.y=(d.y/e+1)/2,h.push(g.x,g.y)}f+=u}for(let v=0;v<s;v++){let m=v*(n+1);for(let p=0;p<n;p++){let y=p+m,T=y,_=y+n+1,A=y+n+2,w=y+1;a.push(T,_,w),a.push(_,A,w)}}this.setIndex(a),this.setAttribute("position",new me(l,3)),this.setAttribute("normal",new me(c,3)),this.setAttribute("uv",new me(h,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}};var Oe=class i extends qe{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));let l=Math.min(o+a,Math.PI),c=0,h=[],f=new R,u=new R,d=[],g=[],v=[],m=[];for(let p=0;p<=n;p++){let y=[],T=p/n,_=o+T*a,A=t*Math.cos(_),w=Math.sqrt(t*t-A*A),x=0;p===0&&o===0?x=.5/e:p===n&&l===Math.PI&&(x=-.5/e);for(let S=0;S<=e;S++){let I=S/e,b=s+I*r;f.x=-w*Math.cos(b),f.y=A,f.z=w*Math.sin(b),g.push(f.x,f.y,f.z),u.copy(f).normalize(),v.push(u.x,u.y,u.z),m.push(I+x,1-T),y.push(c++)}h.push(y)}for(let p=0;p<n;p++)for(let y=0;y<e;y++){let T=h[p][y+1],_=h[p][y],A=h[p+1][y],w=h[p+1][y+1];(p!==0||o>0)&&d.push(T,_,w),(p!==n-1||l<Math.PI)&&d.push(_,A,w)}this.setIndex(d),this.setAttribute("position",new me(g,3)),this.setAttribute("normal",new me(v,3)),this.setAttribute("uv",new me(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};var De=class i extends qe{constructor(t=1,e=.4,n=12,s=48,r=Math.PI*2,o=0,a=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:s,arc:r,thetaStart:o,thetaLength:a},n=Math.floor(n),s=Math.floor(s);let l=[],c=[],h=[],f=[],u=new R,d=new R,g=new R;for(let v=0;v<=n;v++){let m=o+v/n*a;for(let p=0;p<=s;p++){let y=p/s*r;d.x=(t+e*Math.cos(m))*Math.cos(y),d.y=(t+e*Math.cos(m))*Math.sin(y),d.z=e*Math.sin(m),c.push(d.x,d.y,d.z),u.x=t*Math.cos(y),u.y=t*Math.sin(y),g.subVectors(d,u).normalize(),h.push(g.x,g.y,g.z),f.push(p/s),f.push(v/n)}}for(let v=1;v<=n;v++)for(let m=1;m<=s;m++){let p=(s+1)*v+m-1,y=(s+1)*(v-1)+m-1,T=(s+1)*(v-1)+m,_=(s+1)*v+m;l.push(p,y,_),l.push(y,T,_)}this.setIndex(l),this.setAttribute("position",new me(c,3)),this.setAttribute("normal",new me(h,3)),this.setAttribute("uv",new me(f,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc,t.thetaStart,t.thetaLength)}};var kn=class i extends qe{constructor(t=new di(new R(-1,-1,0),new R(-1,1,0),new R(1,1,0)),e=64,n=1,s=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:e,radius:n,radialSegments:s,closed:r};let o=t.computeFrenetFrames(e,r);this.tangents=o.tangents,this.normals=o.normals,this.binormals=o.binormals;let a=new R,l=new R,c=new bt,h=new R,f=[],u=[],d=[],g=[];v(),this.setIndex(g),this.setAttribute("position",new me(f,3)),this.setAttribute("normal",new me(u,3)),this.setAttribute("uv",new me(d,2));function v(){for(let T=0;T<e;T++)m(T);m(r===!1?e:0),y(),p()}function m(T){h=t.getPointAt(T/e,h);let _=o.normals[T],A=o.binormals[T];for(let w=0;w<=s;w++){let x=w/s*Math.PI*2,S=Math.sin(x),I=-Math.cos(x);l.x=I*_.x+S*A.x,l.y=I*_.y+S*A.y,l.z=I*_.z+S*A.z,l.normalize(),u.push(l.x,l.y,l.z),a.x=h.x+n*l.x,a.y=h.y+n*l.y,a.z=h.z+n*l.z,f.push(a.x,a.y,a.z)}}function p(){for(let T=1;T<=e;T++)for(let _=1;_<=s;_++){let A=(s+1)*(T-1)+(_-1),w=(s+1)*T+(_-1),x=(s+1)*T+_,S=(s+1)*(T-1)+_;g.push(A,w,S),g.push(w,x,S)}}function y(){for(let T=0;T<=e;T++)for(let _=0;_<=s;_++)c.x=T/e,c.y=_/s,d.push(c.x,c.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new i(new aa[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}};function ys(i){let t={};for(let e in i){t[e]={};for(let n in i[e]){let s=i[e][n];if(bh(s))s.isRenderTargetTexture?(pe("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone();else if(Array.isArray(s))if(bh(s[0])){let r=[];for(let o=0,a=s.length;o<a;o++)r[o]=s[o].clone();t[e][n]=r}else t[e][n]=s.slice();else t[e][n]=s}}return t}function Cn(i){let t={};for(let e=0;e<i.length;e++){let n=ys(i[e]);for(let s in n)t[s]=n[s]}return t}function bh(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function Xf(i){let t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Pc(i){let t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Ne.workingColorSpace}var Su={clone:ys,merge:Cn},qf=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Yf=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Xe=class extends ui{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=qf,this.fragmentShader=Yf,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=ys(t.uniforms),this.uniformsGroups=Xf(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let s in this.uniforms){let o=this.uniforms[s].value;o&&o.isTexture?e.uniforms[s]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[s]={type:"m4",value:o.toArray()}:e.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}fromJSON(t,e){if(super.fromJSON(t,e),t.uniforms!==void 0)for(let n in t.uniforms){let s=t.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=e[s.value]||null;break;case"c":this.uniforms[n].value=new fe().setHex(s.value);break;case"v2":this.uniforms[n].value=new bt().fromArray(s.value);break;case"v3":this.uniforms[n].value=new R().fromArray(s.value);break;case"v4":this.uniforms[n].value=new Ke().fromArray(s.value);break;case"m3":this.uniforms[n].value=new Te().fromArray(s.value);break;case"m4":this.uniforms[n].value=new He().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let n in t.extensions)this.extensions[n]=t.extensions[n];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},ca=class extends Xe{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},ha=class extends ui{constructor(t){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new fe(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new fe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=no,this.normalScale=new bt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new wi,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}},Jn=class extends ha{constructor(t){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new bt(1,1),this.clearcoatNormalMap=null,this.diffuseRoughnessMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Ce(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessMinimum=100,this.iridescenceThicknessMaximum=400,this.iridescenceThicknessMap=null,this.sheenColor=new fe(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new fe(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new fe(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._diffuseRoughness=0,this._dispersion=0,this._iridescence=0,this._retroreflectivity=0,this._sheen=0,this._transmission=0,this.setValues(t)}get anisotropy(){return this._anisotropy}set anisotropy(t){this._anisotropy>0!=t>0&&this.version++,this._anisotropy=t}get clearcoat(){return this._clearcoat}set clearcoat(t){this._clearcoat>0!=t>0&&this.version++,this._clearcoat=t}get diffuseRoughness(){return this._diffuseRoughness}set diffuseRoughness(t){this._diffuseRoughness>0!=t>0&&this.version++,this._diffuseRoughness=t}get iridescence(){return this._iridescence}set iridescence(t){this._iridescence>0!=t>0&&this.version++,this._iridescence=t}get dispersion(){return this._dispersion}set dispersion(t){this._dispersion>0!=t>0&&this.version++,this._dispersion=t}get retroreflectivity(){return this._retroreflectivity}set retroreflectivity(t){this._retroreflectivity>0!=t>0&&this.version++,this._retroreflectivity=t}get sheen(){return this._sheen}set sheen(t){this._sheen>0!=t>0&&this.version++,this._sheen=t}get transmission(){return this._transmission}set transmission(t){this._transmission>0!=t>0&&this.version++,this._transmission=t}get iridescenceThicknessRange(){return ns('MeshPhysicalMaterial: The "iridescenceThicknessRange" property has been replaced by "iridescenceThicknessMinimum" and "iridescenceThicknessMaximum".'),[this.iridescenceThicknessMinimum,this.iridescenceThicknessMaximum]}set iridescenceThicknessRange(t){ns('MeshPhysicalMaterial: The "iridescenceThicknessRange" property has been replaced by "iridescenceThicknessMinimum" and "iridescenceThicknessMaximum".'),this.iridescenceThicknessMinimum=t[0],this.iridescenceThicknessMaximum=t[1]}copy(t){return super.copy(t),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=t.anisotropy,this.anisotropyRotation=t.anisotropyRotation,this.anisotropyMap=t.anisotropyMap,this.clearcoat=t.clearcoat,this.clearcoatMap=t.clearcoatMap,this.clearcoatRoughness=t.clearcoatRoughness,this.clearcoatRoughnessMap=t.clearcoatRoughnessMap,this.clearcoatNormalMap=t.clearcoatNormalMap,this.clearcoatNormalScale.copy(t.clearcoatNormalScale),this.diffuseRoughness=t.diffuseRoughness,this.diffuseRoughnessMap=t.diffuseRoughnessMap,this.dispersion=t.dispersion,this.ior=t.ior,this.iridescence=t.iridescence,this.iridescenceMap=t.iridescenceMap,this.iridescenceIOR=t.iridescenceIOR,this.iridescenceThicknessMinimum=t.iridescenceThicknessMinimum,this.iridescenceThicknessMaximum=t.iridescenceThicknessMaximum,this.iridescenceThicknessMap=t.iridescenceThicknessMap,this.retroreflectivity=t.retroreflectivity,this.sheen=t.sheen,this.sheenColor.copy(t.sheenColor),this.sheenColorMap=t.sheenColorMap,this.sheenRoughness=t.sheenRoughness,this.sheenRoughnessMap=t.sheenRoughnessMap,this.transmission=t.transmission,this.transmissionMap=t.transmissionMap,this.thickness=t.thickness,this.thicknessMap=t.thicknessMap,this.attenuationDistance=t.attenuationDistance,this.attenuationColor.copy(t.attenuationColor),this.specularIntensity=t.specularIntensity,this.specularIntensityMap=t.specularIntensityMap,this.specularColor.copy(t.specularColor),this.specularColorMap=t.specularColorMap,this}};var hs=class extends ui{constructor(t){super(),this.isMeshToonMaterial=!0,this.defines={TOON:""},this.type="MeshToonMaterial",this.color=new fe(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new fe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=no,this.normalScale=new bt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.gradientMap=t.gradientMap,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.alphaMap=t.alphaMap,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}};var ua=class extends ui{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=iu,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},da=class extends ui{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};function Ns(i,t){return!i||i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}function Fo(i){return i!==void 0&&i.inTangents!==void 0&&i.outTangents!==void 0}var ki=class{constructor(t,e,n,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,s=e[n],r=e[n-1];n:{t:{let o;e:{i:if(!(t<s)){for(let a=n+2;;){if(s===void 0){if(t<r)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(r=s,s=e[++n],t<s)break t}o=e.length;break e}if(!(t>=r)){let a=e[1];t<a&&(n=2,r=a);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(s=r,r=e[--n-1],t>=r)break t}o=n,n=0;break e}break n}for(;n<o;){let a=n+o>>>1;t<e[a]?o=a:n=a+1}if(s=e[n],r=e[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=t*s;for(let o=0;o!==s;++o)e[o]=n[r+o];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},fa=class extends ki{constructor(t,e,n,s){super(t,e,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Xl,endingEnd:Xl}}intervalChanged_(t,e,n){let s=this.parameterPositions,r=t-2,o=t+1,a=s[r],l=s[o];if(a===void 0)switch(this.getSettings_().endingStart){case ql:r=t,a=2*e-n;break;case Yl:r=s.length-2,a=e+s[r]-s[r+1];break;default:r=t,a=n}if(l===void 0)switch(this.getSettings_().endingEnd){case ql:o=t,l=2*n-e;break;case Yl:o=1,l=n+s[1]-s[0];break;default:o=t-1,l=e}let c=(n-e)*.5,h=this.valueSize;this._weightPrev=c/(e-a),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=o*h}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=this._offsetPrev,f=this._offsetNext,u=this._weightPrev,d=this._weightNext,g=(n-e)/(s-e),v=g*g,m=v*g,p=-u*m+2*u*v-u*g,y=(1+u)*m+(-1.5-2*u)*v+(-.5+u)*g+1,T=(-1-d)*m+(1.5+d)*v+.5*g,_=d*m-d*v;for(let A=0;A!==a;++A)r[A]=p*o[h+A]+y*o[c+A]+T*o[l+A]+_*o[f+A];return r}},pa=class extends ki{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=(n-e)/(s-e),f=1-h;for(let u=0;u!==a;++u)r[u]=o[c+u]*f+o[l+u]*h;return r}},ma=class extends ki{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t){return this.copySampleValue_(t-1)}},ga=class extends ki{interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=this.inTangents,f=this.outTangents;if(!h||!f){let g=(n-e)/(s-e),v=1-g;for(let m=0;m!==a;++m)r[m]=o[c+m]*v+o[l+m]*g;return r}let u=a*2,d=t-1;for(let g=0;g!==a;++g){let v=o[c+g],m=o[l+g],p=d*u+g*2,y=f[p],T=f[p+1],_=t*u+g*2,A=h[_],w=h[_+1],x=Jf(n,e,y,A,s);r[g]=Tu(x,v,T,w,m)}return r}};function Tu(i,t,e,n,s){let r=1-i;return r*r*r*t+3*r*r*i*e+3*r*i*i*n+i*i*i*s}function Zf(i,t,e,n,s){let r=1-i;return 3*r*r*(e-t)+6*r*i*(n-e)+3*i*i*(s-n)}function Jf(i,t,e,n,s){let r=(i-t)/(s-t);for(let o=0;o<8;o++){let a=Tu(r,t,e,n,s)-i;if(Math.abs(a)<1e-10)break;let l=Zf(r,t,e,n,s);if(Math.abs(l)<1e-10)break;r=Math.max(0,Math.min(1,r-a/l))}return r}var Vn=class{constructor(t,e,n,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=Ns(e,this.TimeBufferType),this.values=Ns(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:Ns(t.times,Array),values:Ns(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(n.interpolation=s),Fo(t.settings)&&(n.settings={inTangents:Ns(t.settings.inTangents,Array),outTangents:Ns(t.settings.outTangents,Array)})}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new ma(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new pa(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new fa(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new ga(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case mr:e=this.InterpolantFactoryMethodDiscrete;break;case Jo:e=this.InterpolantFactoryMethodLinear;break;case Ho:e=this.InterpolantFactoryMethodSmooth;break;case Wl:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return pe("KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return mr;case this.InterpolantFactoryMethodLinear:return Jo;case this.InterpolantFactoryMethodSmooth:return Ho;case this.InterpolantFactoryMethodBezier:return Wl}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]+=t;Fo(this.settings)&&(Rh(this.settings.inTangents,t),Rh(this.settings.outTangents,t))}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]*=t;Fo(this.settings)&&(Ah(this.settings.inTangents,t),Ah(this.settings.outTangents,t))}return this}trim(t,e){let n=this.times,s=n.length,r=0,o=s-1;for(;r!==s&&n[r]<t;)++r;for(;o!==-1&&n[o]>e;)--o;if(++o,r!==0||o!==s){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=n.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(Ee("KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,s=this.values,r=n.length;r===0&&(Ee("KeyframeTrack: Track is empty.",this),t=!1);let o=null;for(let a=0;a!==r;a++){let l=n[a];if(typeof l=="number"&&isNaN(l)){Ee("KeyframeTrack: Time is not a valid number.",this,a,l),t=!1;break}if(o!==null&&o>l){Ee("KeyframeTrack: Out of order keys.",this,a,l,o),t=!1;break}o=l}if(s!==void 0&&Od(s))for(let a=0,l=s.length;a!==l;++a){let c=s[a];if(isNaN(c)){Ee("KeyframeTrack: Value is not a valid number.",this,a,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===Ho,r=t.length-1,o=1;for(let a=1;a<r;++a){let l=!1,c=t[a],h=t[a+1];if(c!==h&&(a!==1||c!==t[0]))if(s)l=!0;else{let f=a*n,u=f-n,d=f+n;for(let g=0;g!==n;++g){let v=e[f+g];if(v!==e[u+g]||v!==e[d+g]){l=!0;break}}}if(l){if(a!==o){t[o]=t[a];let f=a*n,u=o*n;for(let d=0;d!==n;++d)e[u+d]=e[f+d]}++o}}if(r>0){t[o]=t[r];for(let a=r*n,l=o*n,c=0;c!==n;++c)e[l+c]=e[a+c];++o}return o!==t.length?(this.times=t.slice(0,o),this.values=e.slice(0,o*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,s=new n(this.name,t,e);return s.createInterpolant=this.createInterpolant,Fo(this.settings)&&(s.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),s}};function Rh(i,t){for(let e=0,n=i.length;e!==n;e+=2)i[e]+=t}function Ah(i,t){for(let e=0,n=i.length;e!==n;e+=2)i[e]*=t}Vn.prototype.ValueTypeName="";Vn.prototype.TimeBufferType=Float32Array;Vn.prototype.ValueBufferType=Float32Array;Vn.prototype.DefaultInterpolation=Jo;var Vi=class extends Vn{constructor(t,e,n){super(t,e,n)}};Vi.prototype.ValueTypeName="bool";Vi.prototype.ValueBufferType=Array;Vi.prototype.DefaultInterpolation=mr;Vi.prototype.InterpolantFactoryMethodLinear=void 0;Vi.prototype.InterpolantFactoryMethodSmooth=void 0;var xa=class extends Vn{constructor(t,e,n,s){super(t,e,n,s)}};xa.prototype.ValueTypeName="color";var _a=class extends Vn{constructor(t,e,n,s){super(t,e,n,s)}};_a.prototype.ValueTypeName="number";var ya=class extends ki{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(n-e)/(s-e),c=t*a;for(let h=c+a;c!==h;c+=4)Hn.slerpFlat(r,0,o,c-a,o,c,l);return r}},zr=class extends Vn{constructor(t,e,n,s){super(t,e,n,s)}InterpolantFactoryMethodLinear(t){return new ya(this.times,this.values,this.getValueSize(),t)}};zr.prototype.ValueTypeName="quaternion";zr.prototype.InterpolantFactoryMethodSmooth=void 0;var Wi=class extends Vn{constructor(t,e,n){super(t,e,n)}};Wi.prototype.ValueTypeName="string";Wi.prototype.ValueBufferType=Array;Wi.prototype.DefaultInterpolation=mr;Wi.prototype.InterpolantFactoryMethodLinear=void 0;Wi.prototype.InterpolantFactoryMethodSmooth=void 0;var va=class extends Vn{constructor(t,e,n,s){super(t,e,n,s)}};va.prototype.ValueTypeName="vector";var Ea=class{constructor(t,e,n){let s=this,r=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this._abortController=null,this.itemStart=function(h){a++,r===!1&&s.onStart!==void 0&&s.onStart(h,o,a),r=!0},this.itemEnd=function(h){o++,s.onProgress!==void 0&&s.onProgress(h,o,a),o===a&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,f){return c.push(h,f),this},this.removeHandler=function(h){let f=c.indexOf(h);return f!==-1&&c.splice(f,2),this},this.getHandler=function(h){for(let f=0,u=c.length;f<u;f+=2){let d=c[f],g=c[f+1];if(d.global&&(d.lastIndex=0),d.test(h))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},wu=new Ea,Ma=class{constructor(t){this.manager=t!==void 0?t:wu,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},this.priority="auto",this.cache="default",typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}setPriority(t){return this.priority=t,this}setCache(t){return this.cache=t,this}abort(){return this}};Ma.DEFAULT_MATERIAL_NAME="__DEFAULT";var us=class extends cn{static registerNode(t){this.prototype._lightNode=t}constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new fe(t),this.intensity=e}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,e}},kr=class extends us{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(cn.DEFAULT_UP),this.updateMatrix(),this.groundColor=new fe(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}toJSON(t){let e=super.toJSON(t);return e.object.groundColor=this.groundColor.getHex(),e}},Vl=new He,Ch=new R,Ph=new R,Vr=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new bt(512,512),this.mapType=Nn,this.map=null,this.mapPass=null,this.matrix=new He,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new zi,this._frameExtents=new bt(1,1),this._viewportCount=1,this._viewports=[new Ke(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera;Ch.setFromMatrixPosition(t.matrixWorld),e.position.copy(Ch),Ph.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Ph),e.updateMatrixWorld(),this._updateMatrix(e,this.matrix,this._frustum)}_updateMatrix(t,e,n,s){Vl.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),n.setFromProjectionMatrix(Vl,t.coordinateSystem,t.reversedDepth);let r=this._frameExtents,o=s?s.z/r.x:1,a=s?s.w/r.y:1,l=s?s.x/r.x:0,c=s?s.y/r.y:0;t.coordinateSystem===Hs||t.reversedDepth?e.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,1,0,0,0,0,1):e.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,.5,.5,0,0,0,1),e.multiply(Vl)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this.mapType=t.mapType,this.biasNode=t.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return t.intensity=this.intensity,t.bias=this.bias,t.normalBias=this.normalBias,t.radius=this.radius,t.blurSamples=this.blurSamples,t.mapSize=this.mapSize.toArray(),t.mapType=this.mapType,t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}},Oo=new R,Bo=new Hn,li=new R,Wr=class extends cn{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new He,this.projectionMatrix=new He,this.projectionMatrixInverse=new He,this.coordinateSystem=Yn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(Oo,Bo,li),li.x===1&&li.y===1&&li.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Oo,Bo,li.set(1,1,1)).invert()}updateWorldMatrix(t,e,n=!1){super.updateWorldMatrix(t,e,n),this.matrixWorld.decompose(Oo,Bo,li),li.x===1&&li.y===1&&li.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Oo,Bo,li.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Hi=new R,Ih=new bt,Dh=new bt,mn=class extends Wr{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=zs*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(ur*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return zs*2*Math.atan(Math.tan(ur*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){Hi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(Hi.x,Hi.y).multiplyScalar(-t/Hi.z),Hi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Hi.x,Hi.y).multiplyScalar(-t/Hi.z)}getViewSize(t,e){return this.getViewBounds(t,Ih,Dh),e.subVectors(Dh,Ih)}setViewOffset(t,e,n,s,r,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(ur*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*s/l,e-=o.offsetY*n/c,s*=o.width/l,n*=o.height/c}let a=this.filmOffset;a!==0&&(r+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}};var $l=class extends Vr{constructor(){super(new mn(90,1,.5,500)),this.isPointLightShadow=!0}},fi=class extends us{constructor(t,e,n=0,s=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new $l}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.distance=this.distance,e.object.decay=this.decay,e.object.shadow=this.shadow.toJSON(),e}},ds=class extends Wr{constructor(t=-1,e=1,n=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-t,o=n+t,a=s+e,l=s-e;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},jl=class extends Vr{constructor(){super(new ds(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Xr=class extends us{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(cn.DEFAULT_UP),this.updateMatrix(),this.target=new cn,this.shadow=new jl}dispose(){super.dispose(),this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.shadow=this.shadow.toJSON(),e.object.target=this.target.uuid,e}},qr=class extends us{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}};var Us=-90,Fs=1,Zs=class extends cn{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new mn(Us,Fs,t,e);s.layers=this.layers,this.add(s);let r=new mn(Us,Fs,t,e);r.layers=this.layers,this.add(r);let o=new mn(Us,Fs,t,e);o.layers=this.layers,this.add(o);let a=new mn(Us,Fs,t,e);a.layers=this.layers,this.add(a);let l=new mn(Us,Fs,t,e);l.layers=this.layers,this.add(l);let c=new mn(Us,Fs,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[n,s,r,o,a,l]=e;for(let c of e)this.remove(c);if(t===Yn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===Hs)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,l,c,h]=this.children,f=t.getRenderTarget(),u=t.getActiveCubeFace(),d=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;let v=n.texture.mipmapsAutoUpdate;n.texture.mipmapsAutoUpdate=!1;let m=!1;t.isWebGLRenderer===!0?m=t.state.buffers.depth.getReversed():m=t.reversedDepthBuffer,t.setRenderTarget(n,0,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,r),t.setRenderTarget(n,1,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,o),t.setRenderTarget(n,2,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,a),t.setRenderTarget(n,3,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,l),t.setRenderTarget(n,4,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,c),n.texture.mipmapsAutoUpdate=v,t.setRenderTarget(n,5,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,h),t.setRenderTarget(f,u,d),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},Sa=class extends mn{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t,this.perCameraFrustumCulled=!1}};var Ic="\\[\\]\\.:\\/",Kf=new RegExp("["+Ic+"]","g"),Dc="[^"+Ic+"]",$f="[^"+Ic.replace("\\.","")+"]",jf=/((?:WC+[\/:])*)/.source.replace("WC",Dc),Qf=/(WCOD+)?/.source.replace("WCOD",$f),tp=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Dc),ep=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Dc),np=new RegExp("^"+jf+Qf+tp+ep+"$"),ip=["material","materials","bones","map"],Ql=class{constructor(t,e,n){let s=n||Ze.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,s)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},Ze=class i{constructor(t,e,n){this.path=e,this.parsedPath=n||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,n):new i(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(Kf,"")}static parseTrackName(t){let e=np.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);ip.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===e||a.uuid===e)return a;let l=n(a.children);if(l)return l}return null},s=n(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)t[e++]=n[s]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,s=e.propertyName,r=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){pe("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=e.objectIndex;switch(n){case"materials":if(!t.material){Ee("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){Ee("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){Ee("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){Ee("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){Ee("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){Ee("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(c!==void 0){if(t[c]===void 0){Ee("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let o=t[s];if(o===void 0){let c=e.nodeName;Ee("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let a=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?a=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){Ee("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){Ee("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Ze.Composite=Ql;Ze.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Ze.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Ze.prototype.GetterByBindingType=[Ze.prototype._getValue_direct,Ze.prototype._getValue_array,Ze.prototype._getValue_arrayElement,Ze.prototype._getValue_toArray];Ze.prototype.SetterByBindingTypeAndVersioning=[[Ze.prototype._setValue_direct,Ze.prototype._setValue_direct_setNeedsUpdate,Ze.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Ze.prototype._setValue_array,Ze.prototype._setValue_array_setNeedsUpdate,Ze.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Ze.prototype._setValue_arrayElement,Ze.prototype._setValue_arrayElement_setNeedsUpdate,Ze.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Ze.prototype._setValue_fromArray,Ze.prototype._setValue_fromArray_setNeedsUpdate,Ze.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var h_=new Float32Array(1);var Js=class{constructor(t=1,e=0,n=0){this.radius=t,this.phi=e,this.theta=n}set(t,e,n){return this.radius=t,this.phi=e,this.theta=n,this}copy(t){return this.radius=t.radius,this.phi=t.phi,this.theta=t.theta,this}makeSafe(){return this.phi=Ce(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(t){return this.setFromCartesianCoords(t.x,t.y,t.z)}setFromCartesianCoords(t,e,n){return this.radius=Math.sqrt(t*t+e*e+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(t,n),this.phi=Math.acos(Ce(e/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var tc=class{static{this.prototype.isMatrix2=!0}constructor(t,e,n,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let n=0;n<4;n++)this.elements[n]=t[n+e];return this}set(t,e,n,s){let r=this.elements;return r[0]=t,r[2]=e,r[1]=n,r[3]=s,this}};var Yr=class extends ii{constructor(t,e=null){super(),this.object=t,this.domElement=e,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(t){this.domElement!==null&&this.disconnect(),this.domElement=t}disconnect(){}dispose(){}update(){}};function Lc(i,t,e,n){let s=sp(n);switch(e){case yc:return i*t;case Pa:return i*t/s.components*s.byteLength;case Ia:return i*t/s.components*s.byteLength;case Zi:return i*t*2/s.components*s.byteLength;case Da:return i*t*2/s.components*s.byteLength;case vc:return i*t*3/s.components*s.byteLength;case An:return i*t*4/s.components*s.byteLength;case La:return i*t*4/s.components*s.byteLength;case Kr:case $r:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case jr:case Qr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ua:case Oa:return Math.max(i,16)*Math.max(t,8)/4;case Na:case Fa:return Math.max(i,8)*Math.max(t,8)/2;case Ba:case Ha:case za:case ka:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Ga:case to:case Va:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Wa:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Xa:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case qa:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case Ya:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case Za:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case Ja:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case Ka:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case $a:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case ja:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case Qa:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case tl:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case el:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case nl:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case il:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case sl:case rl:case ol:return Math.ceil(i/4)*Math.ceil(t/4)*16;case al:case ll:return Math.ceil(i/4)*Math.ceil(t/4)*8;case eo:case cl:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function sp(i){switch(i){case Nn:case mc:return{byteLength:1,components:1};case js:case gc:case Wn:return{byteLength:2,components:1};case Aa:case Ca:return{byteLength:2,components:4};case si:case Ra:case jn:return{byteLength:4,components:1};case xc:case _c:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"187"}}));typeof window<"u"&&(window.__THREE__?pe("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="187");function Yu(){let i=null,t=!1,e=null,n=null;function s(r,o){n=i.requestAnimationFrame(s),e(r,o)}return{start:function(){t!==!0&&e!==null&&i!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function op(i){let t=new WeakMap;function e(a,l){let c=a.array,h=a.usage,f=c.byteLength,u=i.createBuffer();i.bindBuffer(l,u),i.bufferData(l,c,h),a.onUploadCallback();let d;if(c instanceof Float32Array)d=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)d=i.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?d=i.HALF_FLOAT:d=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)d=i.SHORT;else if(c instanceof Uint32Array)d=i.UNSIGNED_INT;else if(c instanceof Int32Array)d=i.INT;else if(c instanceof Int8Array)d=i.BYTE;else if(c instanceof Uint8Array)d=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)d=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:d,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function n(a,l,c){let h=l.array,f=l.updateRanges;if(i.bindBuffer(c,a),f.length===0)i.bufferSubData(c,0,h);else{f.sort((d,g)=>d.start-g.start);let u=0;for(let d=1;d<f.length;d++){let g=f[u],v=f[d];v.start<=g.start+g.count+1?g.count=Math.max(g.count,v.start+v.count-g.start):(++u,f[u]=v)}f.length=u+1;for(let d=0,g=f.length;d<g;d++){let v=f[d];i.bufferSubData(c,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=t.get(a);l&&(i.deleteBuffer(l.buffer),t.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=t.get(a);(!h||h.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=t.get(a);if(c===void 0)t.set(a,e(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,a,l),c.version=a.version}}return{get:s,remove:r,update:o}}var ap=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,lp=`#ifdef USE_ALPHAHASH
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
#endif`,cp=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,hp=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,up=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,dp=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,fp=`#ifdef USE_AOMAP
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
#endif`,pp=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,mp=`#ifdef USE_BATCHING
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
#endif`,gp=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,xp=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,_p=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,yp=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,vp=`#ifdef USE_IRIDESCENCE
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
#endif`,Ep=`#ifdef USE_BUMPMAP
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
#endif`,Mp=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Sp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Tp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,wp=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,bp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Rp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Ap=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Cp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,Pp=`#define PI 3.141592653589793
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
} // validated`,Ip=`vec3 transformedNormal = objectNormal;
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
#endif`,Dp=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Lp=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Np=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Up=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Fp="gl_FragColor = linearToOutputTexel( gl_FragColor );",Op=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Bp=`#ifdef USE_ENVMAP
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
#endif`,Hp=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	uniform samplerCube envMap;
	#ifdef ENVMAP_TYPE_PMREM
		float roughnessToMip( const in float roughness ) {
			float r = clamp( roughness, 0.0, 1.0 );
			return ENVMAP_MAX_LOD * r * ( 2.0 - r );
		}
	#endif
#endif`,Gp=`#ifdef USE_ENVMAP
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
#endif`,zp=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,kp=`#ifdef USE_ENVMAP
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
#endif`,Vp=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Wp=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Xp=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,qp=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Yp=`#ifdef USE_GRADIENTMAP
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
}`,Zp=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Jp=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Kp=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,$p=`uniform bool receiveShadow;
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
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
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
#include <lightprobes_pars_fragment>`,jp=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * worldNormal, ENVMAP_MAX_LOD );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * reflectVec, roughnessToMip( roughness ) );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureLod( envMap, envMapRotation * retroVec, roughnessToMip( roughness ) );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_PMREM
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,Qp=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,t0=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,e0=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,n0=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,i0=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.045 );
material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef USE_DIFFUSE_ROUGHNESS
	float diffuseRoughnessFactor = diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		diffuseRoughnessFactor *= texture2D( diffuseRoughnessMap, vDiffuseRoughnessMapUv ).r;
	#endif
	material.diffuseRoughness = saturate( diffuseRoughnessFactor );
#endif
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
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.045 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
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
#endif`,s0=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float diffuseRoughness;
	#endif
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
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
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
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
#ifdef USE_DIFFUSE_ROUGHNESS
	const float EON_EPSILON = 1e-7;
	float FON_DirectionalAlbedo( const in float mu, const in float roughness, const in float A ) {
		float muComp = 1.0 - mu;
		float gOverPi = muComp * ( 0.0571085289 + muComp * ( 0.491881867 + muComp * ( - 0.332181442 + muComp * 0.0714429953 ) ) );
		return A * ( 1.0 + roughness * gOverPi );
	}
	vec3 BRDF_EON( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 diffuseColor, const in float roughness ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return BRDF_Lambert( rho );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float s = dot( lightDir, viewDir ) - dotNL * dotNV;
		float sOverT = ( s > 0.0 ) ? s / max( max( dotNL, dotNV ), EON_EPSILON ) : s;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		vec3 singleScatter = rho * RECIPROCAL_PI * A * ( 1.0 + roughness * sOverT );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		float albedoV = FON_DirectionalAlbedo( dotNV, roughness, A );
		float albedoL = FON_DirectionalAlbedo( dotNL, roughness, A );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		vec3 multiScatter = rhoMultiScatter * RECIPROCAL_PI
			* max( EON_EPSILON, 1.0 - albedoV )
			* max( EON_EPSILON, 1.0 - albedoL )
			/ max( EON_EPSILON, 1.0 - averageAlbedo );
		return singleScatter + multiScatter;
	}
	vec3 EON_DirectionalAlbedo( const in vec3 diffuseColor, const in float roughness, const in float dotNV ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return rho;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		float directionalAlbedo = FON_DirectionalAlbedo( dotNV, roughness, A );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		return rho * directionalAlbedo + rhoMultiScatter * ( 1.0 - directionalAlbedo );
	}
#endif
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
		float roughness = max( material.clearcoatRoughness, 0.045 );
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
	float roughness = max( material.roughness, 0.045 );
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
		float alphaT = max( material.alphaT, alpha );
		float V = V_GGX_SmithCorrelated_Anisotropic( alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( alphaT, alpha, dotNH, dotTH, dotBH );
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
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
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
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		vec3 diffuseBRDF = BRDF_EON( directLight.direction, geometryViewDir, geometryNormal, material.diffuseColor, material.diffuseRoughness ) * ( 1.0 - material.metalness );
	#else
		vec3 diffuseBRDF = BRDF_Lambert( material.diffuseContribution );
	#endif
	reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuseAlbedo = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness );
		vec3 diffuse = irradiance * RECIPROCAL_PI * diffuseAlbedo * ( 1.0 - singleScattering - multiScattering );
	#else
		vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#endif
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
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
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuse = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness ) * ( 1.0 - totalScatteringDielectric );
	#else
		vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	#endif
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
}`,r0=`
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
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
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
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
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
	#if NUM_LIGHT_PROBE_GRIDS > 0
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		int probeGrid = - 1;
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( isInsideLightProbeGrid( probeWorldPos, probeWorldNormal, probesMin[ i ], probesMax[ i ], probesResolution[ i ] ) ) probeGrid = UNROLLED_LOOP_INDEX;
		}
		#pragma unroll_loop_end
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( probeGrid == UNROLLED_LOOP_INDEX ) irradiance += getLightProbeGridIrradiance( probesSH[ i ], probesMin[ i ], probesMax[ i ], probesResolution[ i ], probeWorldPos, probeWorldNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,o0=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_PMREM )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,a0=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,l0=`#if NUM_LIGHT_PROBE_GRIDS > 0
uniform highp sampler3D probesSH[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMin[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMax[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesResolution[ NUM_LIGHT_PROBE_GRIDS ];
bool isInsideLightProbeGrid( vec3 worldPos, vec3 worldNormal, vec3 probesMin, vec3 probesMax, vec3 probesResolution ) {
	vec3 spacing = ( probesMax - probesMin ) / probesResolution;
	vec3 samplePos = worldPos + worldNormal * spacing * 0.5;
	vec3 margin = spacing * 0.01;
	return all( greaterThanEqual( samplePos, probesMin - margin ) ) && all( lessThanEqual( samplePos, probesMax + margin ) );
}
vec3 getLightProbeGridIrradiance( highp sampler3D probesSH, vec3 probesMin, vec3 probesMax, vec3 probesResolution, vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 probeSpacing = gridRange / res;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.5 / res, 1.0 - 0.5 / res );
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
#endif`,c0=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,h0=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,u0=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,d0=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,f0=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,p0=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,m0=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,g0=`#if defined( USE_POINTS_UV )
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
#endif`,x0=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,_0=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,y0=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,v0=`#if defined( USE_MORPHCOLORS )
	#if defined( USE_COLOR_ALPHA )
		vColor *= morphTargetBaseInfluence;
	#elif defined( USE_COLOR )
		vColor.rgb *= morphTargetBaseInfluence;
	#endif
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor.rgb += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,E0=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,M0=`#ifdef USE_MORPHTARGETS
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
#endif`,S0=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,T0=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,w0=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,b0=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,R0=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,A0=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,C0=`#ifdef USE_NORMALMAP
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
#endif`,P0=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,I0=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,D0=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,L0=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,N0=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,U0=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,F0=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,O0=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,B0=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,H0=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,G0=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,z0=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,k0=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
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
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				vec2 radius = shadowRadius * texelSize;
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
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
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
			float lightDistance = length( lightToPosition );
			float depthRange = shadowCameraFar - shadowCameraNear;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float depthA = - shadowCameraNear / depthRange - shadowBias;
				float depthB = shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#else
				float depthA = shadowCameraFar / depthRange + shadowBias;
				float depthB = - shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			shadow = 0.0;
			for ( int i = 0; i < 5; i ++ ) {
				vec2 offset = vogelDiskSample( i, 5, phi );
				vec3 direction = bd3D + ( tangent * offset.x + bitangent * offset.y ) * texelSize;
				vec3 absDirection = abs( direction );
				float dp = depthA + depthB / max( max( absDirection.x, absDirection.y ), absDirection.z );
				shadow += texture( shadowMap, vec4( direction, dp ) );
			}
			shadow *= 0.2;
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
#endif`,V0=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
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
#endif`,W0=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
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
#endif`,X0=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
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
}`,q0=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Y0=`#ifdef USE_SKINNING
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
#endif`,Z0=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,J0=`#ifdef USE_SKINNING
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
#endif`,K0=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,$0=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,j0=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Q0=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,tm=`#ifdef USE_TRANSMISSION
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
#endif`,em=`#ifdef USE_TRANSMISSION
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
#endif`,nm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	varying vec2 vDiffuseRoughnessMapUv;
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
#endif`,im=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	uniform mat3 diffuseRoughnessMapTransform;
	varying vec2 vDiffuseRoughnessMapUv;
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
#endif`,sm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	vDiffuseRoughnessMapUv = ( diffuseRoughnessMapTransform * vec3( DIFFUSE_ROUGHNESSMAP_UV, 1 ) ).xy;
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
#endif`,rm=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,om=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,am=`uniform sampler2D t2D;
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
}`,lm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cm=`uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <envmap_common_pars_fragment>
void main() {
	#ifdef ENVMAP_TYPE_PMREM
		vec4 texColor = textureLod( envMap, backgroundRotation * vWorldDirection, roughnessToMip( backgroundBlurriness ) );
	#else
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,hm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,um=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,dm=`#include <common>
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
}`,fm=`#if DEPTH_PACKING == 3200
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
}`,pm=`#define DISTANCE
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
}`,mm=`#define DISTANCE
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
}`,gm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,xm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,_m=`uniform float scale;
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
}`,ym=`uniform vec3 diffuse;
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
}`,vm=`#include <common>
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
}`,Em=`uniform vec3 diffuse;
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
}`,Mm=`#define LAMBERT
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
}`,Sm=`#define LAMBERT
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
}`,Tm=`#define MATCAP
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
}`,wm=`#define MATCAP
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
}`,bm=`#define NORMAL
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
}`,Rm=`#define NORMAL
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
}`,Am=`#define PHONG
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
}`,Cm=`#define PHONG
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
}`,Pm=`#define STANDARD
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
}`,Im=`#define STANDARD
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
#ifdef USE_DIFFUSE_ROUGHNESS
	uniform float diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		uniform sampler2D diffuseRoughnessMap;
	#endif
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
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
}`,Dm=`#define TOON
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
}`,Lm=`#define TOON
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
}`,Nm=`uniform float size;
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
}`,Um=`uniform vec3 diffuse;
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
}`,Fm=`#include <common>
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
}`,Om=`uniform vec3 color;
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
}`,Bm=`uniform float rotation;
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
}`,Hm=`uniform vec3 diffuse;
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
}`,Ie={alphahash_fragment:ap,alphahash_pars_fragment:lp,alphamap_fragment:cp,alphamap_pars_fragment:hp,alphatest_fragment:up,alphatest_pars_fragment:dp,aomap_fragment:fp,aomap_pars_fragment:pp,batching_pars_vertex:mp,batching_vertex:gp,begin_vertex:xp,beginnormal_vertex:_p,bsdfs:yp,iridescence_fragment:vp,bumpmap_pars_fragment:Ep,clipping_planes_fragment:Mp,clipping_planes_pars_fragment:Sp,clipping_planes_pars_vertex:Tp,clipping_planes_vertex:wp,color_fragment:bp,color_pars_fragment:Rp,color_pars_vertex:Ap,color_vertex:Cp,common:Pp,defaultnormal_vertex:Ip,displacementmap_pars_vertex:Dp,displacementmap_vertex:Lp,emissivemap_fragment:Np,emissivemap_pars_fragment:Up,colorspace_fragment:Fp,colorspace_pars_fragment:Op,envmap_fragment:Bp,envmap_common_pars_fragment:Hp,envmap_pars_fragment:Gp,envmap_pars_vertex:zp,envmap_physical_pars_fragment:jp,envmap_vertex:kp,fog_vertex:Vp,fog_pars_vertex:Wp,fog_fragment:Xp,fog_pars_fragment:qp,gradientmap_pars_fragment:Yp,lightmap_pars_fragment:Zp,lights_lambert_fragment:Jp,lights_lambert_pars_fragment:Kp,lights_pars_begin:$p,lights_toon_fragment:Qp,lights_toon_pars_fragment:t0,lights_phong_fragment:e0,lights_phong_pars_fragment:n0,lights_physical_fragment:i0,lights_physical_pars_fragment:s0,lights_fragment_begin:r0,lights_fragment_maps:o0,lights_fragment_end:a0,lightprobes_pars_fragment:l0,logdepthbuf_fragment:c0,logdepthbuf_pars_fragment:h0,logdepthbuf_pars_vertex:u0,logdepthbuf_vertex:d0,map_fragment:f0,map_pars_fragment:p0,map_particle_fragment:m0,map_particle_pars_fragment:g0,metalnessmap_fragment:x0,metalnessmap_pars_fragment:_0,morphinstance_vertex:y0,morphcolor_vertex:v0,morphnormal_vertex:E0,morphtarget_pars_vertex:M0,morphtarget_vertex:S0,normal_fragment_begin:T0,normal_fragment_maps:w0,normal_pars_fragment:b0,normal_pars_vertex:R0,normal_vertex:A0,normalmap_pars_fragment:C0,clearcoat_normal_fragment_begin:P0,clearcoat_normal_fragment_maps:I0,clearcoat_pars_fragment:D0,iridescence_pars_fragment:L0,opaque_fragment:N0,packing:U0,premultiplied_alpha_fragment:F0,project_vertex:O0,dithering_fragment:B0,dithering_pars_fragment:H0,roughnessmap_fragment:G0,roughnessmap_pars_fragment:z0,shadowmap_pars_fragment:k0,shadowmap_pars_vertex:V0,shadowmap_vertex:W0,shadowmask_pars_fragment:X0,skinbase_vertex:q0,skinning_pars_vertex:Y0,skinning_vertex:Z0,skinnormal_vertex:J0,specularmap_fragment:K0,specularmap_pars_fragment:$0,tonemapping_fragment:j0,tonemapping_pars_fragment:Q0,transmission_fragment:tm,transmission_pars_fragment:em,uv_pars_fragment:nm,uv_pars_vertex:im,uv_vertex:sm,worldpos_vertex:rm,background_vert:om,background_frag:am,backgroundCube_vert:lm,backgroundCube_frag:cm,cube_vert:hm,cube_frag:um,depth_vert:dm,depth_frag:fm,distance_vert:pm,distance_frag:mm,equirect_vert:gm,equirect_frag:xm,linedashed_vert:_m,linedashed_frag:ym,meshbasic_vert:vm,meshbasic_frag:Em,meshlambert_vert:Mm,meshlambert_frag:Sm,meshmatcap_vert:Tm,meshmatcap_frag:wm,meshnormal_vert:bm,meshnormal_frag:Rm,meshphong_vert:Am,meshphong_frag:Cm,meshphysical_vert:Pm,meshphysical_frag:Im,meshtoon_vert:Dm,meshtoon_frag:Lm,points_vert:Nm,points_frag:Um,shadow_vert:Fm,shadow_frag:Om,sprite_vert:Bm,sprite_frag:Hm},jt={common:{diffuse:{value:new fe(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Te},alphaMap:{value:null},alphaMapTransform:{value:new Te},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Te}},envmap:{envMap:{value:null},envMapRotation:{value:new Te},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Te}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Te}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Te},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Te},normalScale:{value:new bt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Te},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Te}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Te}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Te}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new fe(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:[]},probesMin:{value:[]},probesMax:{value:[]},probesResolution:{value:[]}},points:{diffuse:{value:new fe(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Te},alphaTest:{value:0},uvTransform:{value:new Te}},sprite:{diffuse:{value:new fe(16777215)},opacity:{value:1},center:{value:new bt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Te},alphaMap:{value:null},alphaMapTransform:{value:new Te},alphaTest:{value:0}}},mi={basic:{uniforms:Cn([jt.common,jt.specularmap,jt.envmap,jt.aomap,jt.lightmap,jt.fog]),vertexShader:Ie.meshbasic_vert,fragmentShader:Ie.meshbasic_frag},lambert:{uniforms:Cn([jt.common,jt.specularmap,jt.envmap,jt.aomap,jt.lightmap,jt.emissivemap,jt.bumpmap,jt.normalmap,jt.displacementmap,jt.fog,jt.lights,{emissive:{value:new fe(0)},envMapIntensity:{value:1}}]),vertexShader:Ie.meshlambert_vert,fragmentShader:Ie.meshlambert_frag},phong:{uniforms:Cn([jt.common,jt.specularmap,jt.envmap,jt.aomap,jt.lightmap,jt.emissivemap,jt.bumpmap,jt.normalmap,jt.displacementmap,jt.fog,jt.lights,{emissive:{value:new fe(0)},specular:{value:new fe(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Ie.meshphong_vert,fragmentShader:Ie.meshphong_frag},standard:{uniforms:Cn([jt.common,jt.envmap,jt.aomap,jt.lightmap,jt.emissivemap,jt.bumpmap,jt.normalmap,jt.displacementmap,jt.roughnessmap,jt.metalnessmap,jt.fog,jt.lights,{emissive:{value:new fe(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ie.meshphysical_vert,fragmentShader:Ie.meshphysical_frag},toon:{uniforms:Cn([jt.common,jt.aomap,jt.lightmap,jt.emissivemap,jt.bumpmap,jt.normalmap,jt.displacementmap,jt.gradientmap,jt.fog,jt.lights,{emissive:{value:new fe(0)}}]),vertexShader:Ie.meshtoon_vert,fragmentShader:Ie.meshtoon_frag},matcap:{uniforms:Cn([jt.common,jt.bumpmap,jt.normalmap,jt.displacementmap,jt.fog,{matcap:{value:null}}]),vertexShader:Ie.meshmatcap_vert,fragmentShader:Ie.meshmatcap_frag},points:{uniforms:Cn([jt.points,jt.fog]),vertexShader:Ie.points_vert,fragmentShader:Ie.points_frag},dashed:{uniforms:Cn([jt.common,jt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ie.linedashed_vert,fragmentShader:Ie.linedashed_frag},depth:{uniforms:Cn([jt.common,jt.displacementmap]),vertexShader:Ie.depth_vert,fragmentShader:Ie.depth_frag},normal:{uniforms:Cn([jt.common,jt.bumpmap,jt.normalmap,jt.displacementmap,{opacity:{value:1}}]),vertexShader:Ie.meshnormal_vert,fragmentShader:Ie.meshnormal_frag},sprite:{uniforms:Cn([jt.sprite,jt.fog]),vertexShader:Ie.sprite_vert,fragmentShader:Ie.sprite_frag},background:{uniforms:{uvTransform:{value:new Te},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ie.background_vert,fragmentShader:Ie.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Te}},vertexShader:Ie.backgroundCube_vert,fragmentShader:Ie.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ie.cube_vert,fragmentShader:Ie.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ie.equirect_vert,fragmentShader:Ie.equirect_frag},distance:{uniforms:Cn([jt.common,jt.displacementmap,{referencePosition:{value:new R},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ie.distance_vert,fragmentShader:Ie.distance_frag},shadow:{uniforms:Cn([jt.lights,jt.fog,{color:{value:new fe(0)},opacity:{value:1}}]),vertexShader:Ie.shadow_vert,fragmentShader:Ie.shadow_frag}};mi.physical={uniforms:Cn([mi.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Te},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Te},clearcoatNormalScale:{value:new bt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Te},diffuseRoughness:{value:0},diffuseRoughnessMap:{value:null},diffuseRoughnessMapTransform:{value:new Te},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Te},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Te},sheen:{value:0},sheenColor:{value:new fe(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Te},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Te},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Te},transmissionSamplerSize:{value:new bt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Te},attenuationDistance:{value:0},attenuationColor:{value:new fe(0)},specularColor:{value:new fe(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Te},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Te},anisotropyVector:{value:new bt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Te}}]),vertexShader:Ie.meshphysical_vert,fragmentShader:Ie.meshphysical_frag};var hl={r:0,b:0,g:0},Gm=new He,Zu=new Te;Zu.set(-1,0,0,0,1,0,0,0,1);function zm(i,t,e,n,s,r){let o=new fe(0),a=s===!0?0:1,l,c,h=null,f=0,u=null;function d(y){let T=y.isScene===!0?y.background:null;if(T&&T.isTexture){let _=y.backgroundBlurriness>0;T=t.get(T,_)}return T}function g(y){let T=!1,_=d(y);_===null?m(o,a):_&&_.isColor&&(m(_,1),T=!0);let A=i.xr.getEnvironmentBlendMode();A==="additive"?e.buffers.color.setClear(0,0,0,1,r):A==="alpha-blend"&&e.buffers.color.setClear(0,0,0,0,r),(i.autoClear||T)&&(e.buffers.depth.setTest(!0),e.buffers.depth.setMask(!0),e.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function v(y,T){let _=d(T);_&&_.isCubeTexture?(c===void 0&&(c=new P(new Yt(1,1,1),new Xe({name:"BackgroundCubeMaterial",uniforms:ys(mi.backgroundCube.uniforms),vertexShader:mi.backgroundCube.vertexShader,fragmentShader:mi.backgroundCube.fragmentShader,side:vn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(A,w,x){this.matrixWorld.copyPosition(x.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=_,c.material.uniforms.backgroundBlurriness.value=T.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Gm.makeRotationFromEuler(T.backgroundRotation)).transpose(),_.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Zu),c.material.toneMapped=Ne.getTransfer(_.colorSpace)!==Ve,(h!==_||f!==_.version||u!==i.toneMapping)&&(c.material.needsUpdate=!0,h=_,f=_.version,u=i.toneMapping),c.layers.enableAll(),y.unshift(c,c.geometry,c.material,0,0,null)):_&&_.isTexture&&(l===void 0&&(l=new P(new be(2,2),new Xe({name:"BackgroundMaterial",uniforms:ys(mi.background.uniforms),vertexShader:mi.background.vertexShader,fragmentShader:mi.background.fragmentShader,side:Kn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=_,l.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,l.material.toneMapped=Ne.getTransfer(_.colorSpace)!==Ve,_.matrixAutoUpdate===!0&&_.updateMatrix(),l.material.uniforms.uvTransform.value.copy(_.matrix),(h!==_||f!==_.version||u!==i.toneMapping)&&(l.material.needsUpdate=!0,h=_,f=_.version,u=i.toneMapping),l.layers.enableAll(),y.unshift(l,l.geometry,l.material,0,0,null))}function m(y,T){y.getRGB(hl,Pc(i)),e.buffers.color.setClear(hl.r,hl.g,hl.b,T,r)}function p(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(y,T=1){o.set(y),a=T,m(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(y){a=y,m(o,a)},render:g,addToRenderList:v,dispose:p}}function km(i,t){let e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=u(null),r=s,o=!1;function a(N,G,K,D,z){let Y=!1,B=f(N,D,K,G);r!==B&&(r=B,c(r.object)),Y=d(N,D,K,z),Y&&g(N,D,K,z),z!==null&&t.update(z,i.ELEMENT_ARRAY_BUFFER),(Y||o)&&(o=!1,_(N,G,K,D),z!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(z).buffer))}function l(){return i.createVertexArray()}function c(N){return i.bindVertexArray(N)}function h(N){return i.deleteVertexArray(N)}function f(N,G,K,D){let z=D.wireframe===!0,Y=n[G.id];Y===void 0&&(Y={},n[G.id]=Y);let B=N.isInstancedMesh===!0?N.id:0,H=Y[B];H===void 0&&(H={},Y[B]=H);let $=H[K.id];$===void 0&&($={},H[K.id]=$);let Q=$[z];return Q===void 0&&(Q=u(l()),$[z]=Q),Q}function u(N){let G=[],K=[],D=[];for(let z=0;z<e;z++)G[z]=0,K[z]=0,D[z]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:G,enabledAttributes:K,attributeDivisors:D,object:N,attributes:{},index:null}}function d(N,G,K,D){let z=r.attributes,Y=G.attributes,B=0,H=K.getAttributes();for(let $ in H)if(H[$].location>=0){let dt=z[$],Ft=Y[$];if(Ft===void 0&&($==="instanceMatrix"&&N.instanceMatrix&&(Ft=N.instanceMatrix),$==="instanceColor"&&N.instanceColor&&(Ft=N.instanceColor)),dt===void 0||dt.attribute!==Ft||Ft&&dt.data!==Ft.data)return!0;B++}return r.attributesNum!==B||r.index!==D}function g(N,G,K,D){let z={},Y=G.attributes,B=0,H=K.getAttributes();for(let $ in H)if(H[$].location>=0){let dt=Y[$];dt===void 0&&($==="instanceMatrix"&&N.instanceMatrix&&(dt=N.instanceMatrix),$==="instanceColor"&&N.instanceColor&&(dt=N.instanceColor));let Ft={};Ft.attribute=dt,dt&&dt.data&&(Ft.data=dt.data),z[$]=Ft,B++}r.attributes=z,r.attributesNum=B,r.index=D}function v(){let N=r.newAttributes;for(let G=0,K=N.length;G<K;G++)N[G]=0}function m(N){p(N,0)}function p(N,G){let K=r.newAttributes,D=r.enabledAttributes,z=r.attributeDivisors;K[N]=1,D[N]===0&&(i.enableVertexAttribArray(N),D[N]=1),z[N]!==G&&(i.vertexAttribDivisor(N,G),z[N]=G)}function y(){let N=r.newAttributes,G=r.enabledAttributes;for(let K=0,D=G.length;K<D;K++)G[K]!==N[K]&&(i.disableVertexAttribArray(K),G[K]=0)}function T(N,G,K,D,z,Y,B){B===!0?i.vertexAttribIPointer(N,G,K,z,Y):i.vertexAttribPointer(N,G,K,D,z,Y)}function _(N,G,K,D){v();let z=D.attributes,Y=K.getAttributes(),B=G.defaultAttributeValues;for(let H in Y){let $=Y[H];if($.location>=0){let Q=z[H];if(Q===void 0&&(H==="instanceMatrix"&&N.instanceMatrix&&(Q=N.instanceMatrix),H==="instanceColor"&&N.instanceColor&&(Q=N.instanceColor)),Q!==void 0){let dt=Q.normalized,Ft=Q.itemSize,qt=t.get(Q);if(qt===void 0)continue;let O=qt.buffer,xt=qt.type,tt=qt.bytesPerElement,st=xt===i.INT||xt===i.UNSIGNED_INT||Q.gpuType===Ra;if(Q.isInterleavedBufferAttribute){let pt=Q.data,at=pt.isInterleavedBuffer===!0?pt.stride:pt.itemSize,ee=Q.offset;if(pt.isInstancedInterleavedBuffer||pt.isInstancedBufferAttribute){for(let Mt=0;Mt<$.locationSize;Mt++)p($.location+Mt,pt.meshPerAttribute);N.isInstancedMesh!==!0&&D._maxInstanceCount===void 0&&(D._maxInstanceCount=pt.meshPerAttribute*pt.count)}else for(let Mt=0;Mt<$.locationSize;Mt++)m($.location+Mt);i.bindBuffer(i.ARRAY_BUFFER,O);for(let Mt=0;Mt<$.locationSize;Mt++)T($.location+Mt,Ft/$.locationSize,xt,dt,at*tt,(ee+Ft/$.locationSize*Mt)*tt,st)}else{if(Q.isInstancedBufferAttribute){for(let pt=0;pt<$.locationSize;pt++)p($.location+pt,Q.meshPerAttribute);N.isInstancedMesh!==!0&&D._maxInstanceCount===void 0&&(D._maxInstanceCount=Q.meshPerAttribute*Q.count)}else for(let pt=0;pt<$.locationSize;pt++)m($.location+pt);i.bindBuffer(i.ARRAY_BUFFER,O);for(let pt=0;pt<$.locationSize;pt++)T($.location+pt,Ft/$.locationSize,xt,dt,Ft*tt,Ft/$.locationSize*pt*tt,st)}}else if(B!==void 0){let dt=B[H];if(dt!==void 0)switch(dt.length){case 2:i.vertexAttrib2fv($.location,dt);break;case 3:i.vertexAttrib3fv($.location,dt);break;case 4:i.vertexAttrib4fv($.location,dt);break;default:i.vertexAttrib1fv($.location,dt)}}}}y()}function A(){I();for(let N in n){let G=n[N];for(let K in G){let D=G[K];for(let z in D){let Y=D[z];for(let B in Y)h(Y[B].object),delete Y[B];delete D[z]}}delete n[N]}}function w(N){if(n[N.id]===void 0)return;let G=n[N.id];for(let K in G){let D=G[K];for(let z in D){let Y=D[z];for(let B in Y)h(Y[B].object),delete Y[B];delete D[z]}}delete n[N.id]}function x(N){for(let G in n){let K=n[G];for(let D in K){let z=K[D];if(z[N.id]===void 0)continue;let Y=z[N.id];for(let B in Y)h(Y[B].object),delete Y[B];delete z[N.id]}}}function S(N){for(let G in n){let K=n[G],D=N.isInstancedMesh===!0?N.id:0,z=K[D];if(z!==void 0){for(let Y in z){let B=z[Y];for(let H in B)h(B[H].object),delete B[H];delete z[Y]}delete K[D],Object.keys(K).length===0&&delete n[G]}}}function I(){b(),o=!0,r!==s&&(r=s,c(r.object))}function b(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:I,resetDefaultState:b,dispose:A,releaseStatesOfGeometry:w,releaseStatesOfObject:S,releaseStatesOfProgram:x,initAttributes:v,enableAttribute:m,disableUnusedAttributes:y}}function Vm(i,t,e){let n;function s(l){n=l}function r(l,c){i.drawArrays(n,l,c),e.update(c,n,1)}function o(l,c,h){h!==0&&(i.drawArraysInstanced(n,l,c,h),e.update(c,n,h))}function a(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let u=0;for(let d=0;d<h;d++)u+=c[d];e.update(u,n,1)}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a}function Wm(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let x=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(x.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(x){return!(x!==An&&n.convert(x)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(x){let S=x===Wn&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(x!==Nn&&x!==jn&&!S&&n.convert(x)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE))}function l(x){if(x==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";x="mediump"}return x==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp",h=l(c);h!==c&&(pe("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let f=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control"),u=e.logarithmicDepthBuffer===!0&&f===!1;e.reversedDepthBuffer===!0&&f===!1&&pe("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer."),e.logarithmicDepthBuffer===!0&&f===!0&&pe("WebGLRenderer: Logarithmic depth buffer is ignored when reversed depth buffer is enabled.");let d=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),p=i.getParameter(i.MAX_VERTEX_ATTRIBS),y=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),T=i.getParameter(i.MAX_VARYING_VECTORS),_=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),A=i.getParameter(i.MAX_SAMPLES),w=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:u,reversedDepthBuffer:f,maxTextures:d,maxVertexTextures:g,maxTextureSize:v,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:y,maxVaryings:T,maxFragmentUniforms:_,maxSamples:A,samples:w}}function Xm(i){let t=this,e=null,n=0,s=!1,r=!1,o=new bn,a=new Te,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,u){let d=f.length!==0||u||n!==0||s;return s=u,n=f.length,d},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,u){e=h(f,u,0)},this.setState=function(f,u,d){let g=f.clippingPlanes,v=f.clipIntersection,m=f.clipShadows,p=i.get(f);if(!s||g===null||g.length===0||r&&!m)r?h(null):c();else{let y=r?0:n,T=y*4,_=p.clippingState||null;l.value=_,_=h(g,u,T,d);for(let A=0;A!==T;++A)_[A]=e[A];p.clippingState=_,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=y}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(f,u,d,g){let v=f!==null?f.length:0,m=null;if(v!==0){if(m=l.value,g!==!0||m===null){let p=d+v*4,y=u.matrixWorldInverse;a.getNormalMatrix(y),(m===null||m.length<p)&&(m=new Float32Array(p));for(let T=0,_=d;T!==v;++T,_+=4)o.copy(f[T]).applyMatrix4(y,a),o.normal.toArray(m,_),m[_+3]=o.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=v,t.numIntersection=0,m}}var ro=class extends gn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new br(s),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new Yt(5,5,5),r=new Xe({name:"CubemapFromEquirect",uniforms:ys(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:vn,blending:ps});r.uniforms.tEquirect.value=e;let o=new P(s,r),a=e.minFilter;return e.minFilter===Ci&&(e.minFilter=Qe),new Zs(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e=!0,n=!0,s=!0){let r=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,n,s);t.setRenderTarget(r)}},bu=256,qm=3,Ym=20,Ju=256,Ku=16,Zm=3,Jm=new R,Km=new fe,dl=class i{constructor(t){this._renderer=t,this._cubeSize=0,this._sourceTarget=null,this._cubeCamera=new Zs(1,10,null),this._boxMesh=new P(new Yt(5,5,5),null),this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null,this._integrationMaterial=null}fromScene(t,e=0,n=.1,s=100,r={}){let{size:o=256,position:a=Jm}=r,l=this._renderer;this._setSize(o);let c=this._allocateTarget(),h=this._getSourceTarget(!0);e>0&&(h.texture.mipmapsAutoUpdate=!1);let f=l.autoClear,u=l.autoClearColor,d=l.autoClearDepth,g=l.autoClearStencil,v=t.background;l.autoClear=!0,l.autoClearColor=!0,l.autoClearDepth=!0,l.autoClearStencil=!0,v===null&&(t.background=l.getClearColor(Km));let m=new Zs(n,s,h);return m.position.copy(a),m.update(l,t),l.autoClear=f,l.autoClearColor=u,l.autoClearDepth=d,l.autoClearStencil=g,t.background=v,e>0&&(h.texture.mipmapsAutoUpdate=!0,this._blur(c,e)),this._applyPMREM(c),c}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Cu(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Au(),this._compileMaterial(this._equirectMaterial))}dispose(){this._sourceTarget!==null&&this._sourceTarget.dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._integrationMaterial!==null&&this._integrationMaterial.dispose(),this._boxMesh.geometry.dispose()}static lodToRoughness(t,e){return e>0?1-Math.sqrt(1-t/e):0}_setSize(t){this._cubeSize=Math.max(bu,Rc(t))}_fromTexture(t,e){t.mapping===gs||t.mapping===$s?this._setSize(t.image.length===0?bu:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4);let n=e||this._allocateTarget();return this._textureToCubemap(t),this._applyPMREM(n),n}_allocateTarget(){let t=this._cubeSize,e=Ru(t,!1,!1),n=Math.log2(t)-qm;for(let s=0;s<=n;s++)e.texture.mipmaps.push({width:t>>s,height:t>>s});return e.texture.name="PMREM",e.texture.isPMREMTexture=!0,e}_getSourceTarget(t=!1){let e=this._cubeSize,n=this._sourceTarget;return(n===null||n.width!==e||t&&n.depthBuffer===!1)&&(n!==null&&n.dispose(),this._sourceTarget=Ru(e,!0,t)),this._sourceTarget}_compileMaterial(t){this._boxMesh.material=t,this._renderer.compile(this._boxMesh,this._cubeCamera.children[0])}_renderCube(t,e,n){let s=this._boxMesh,r=this._cubeCamera;s.material=n,r.renderTarget=t,r.activeMipmapLevel=e;let o=t.width>>e;t.viewport.set(0,0,o,o),r.update(this._renderer,s),t.viewport.set(0,0,t.width,t.height)}_textureToCubemap(t){let e;t.mapping===gs||t.mapping===$s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Cu()),e=this._cubemapMaterial,e.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):(this._equirectMaterial===null&&(this._equirectMaterial=Au()),e=this._equirectMaterial),e.uniforms.envMap.value=t,this._renderCube(this._getSourceTarget(),0,e)}_applyPMREM(t){this._ggxMaterial===null&&(this._ggxMaterial=$m(),this._integrationMaterial=jm());let e=this._cubeSize,n=t.texture.mipmaps.length-1,s=this._ggxMaterial.uniforms;s.envMap.value=this._sourceTarget.texture;let r=this._integrationMaterial.uniforms;r.envMap.value=this._sourceTarget.texture,r.sourceLod.value=Math.log2(e/Ku);for(let o=0;o<=n;o++){let a=i.lodToRoughness(o,n);if(o>n-Zm)r.roughness.value=a,this._renderCube(t,o,this._integrationMaterial);else{let l=a>0?Math.log2(e)+.5*Math.log2(6/(Ju*Math.pow(a,4)))+.5:0;s.roughness.value=a,s.lodBias.value=l,this._renderCube(t,o,this._ggxMaterial)}}}_blur(t,e){this._blurMaterial===null&&(this._blurMaterial=Qm());let n=this._blurMaterial,s=n.uniforms,r=this._sourceTarget;s.sigma.value=Math.min(e,Math.PI)/Math.SQRT2,s.envMap.value=r.texture,this._renderCube(t,0,n),s.envMap.value=t.texture,this._renderCube(r,0,n)}};function Ru(i,t,e){return new ro(i,{minFilter:Ci,generateMipmaps:t,type:Wn,colorSpace:gr,depthBuffer:e})}function oo(i,t,e){return new Xe({name:i,uniforms:t,vertexShader:Ie.cube_vert,fragmentShader:e,side:vn,blending:ps,depthTest:!1,depthWrite:!1})}function $m(){return oo("PMREMGGXConvolution",{envMap:{value:null},roughness:{value:0},lodBias:{value:0}},`

		#define GGX_SAMPLES ${Ju}u

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float lodBias;

		#include <common>

		// Van der Corput radical inverse
		float radicalInverse_VdC( uint bits ) {

			bits = ( bits << 16u ) | ( bits >> 16u );
			bits = ( ( bits & 0x55555555u ) << 1u ) | ( ( bits & 0xAAAAAAAAu ) >> 1u );
			bits = ( ( bits & 0x33333333u ) << 2u ) | ( ( bits & 0xCCCCCCCCu ) >> 2u );
			bits = ( ( bits & 0x0F0F0F0Fu ) << 4u ) | ( ( bits & 0xF0F0F0F0u ) >> 4u );
			bits = ( ( bits & 0x00FF00FFu ) << 8u ) | ( ( bits & 0xFF00FF00u ) >> 8u );
			return float( bits ) * 2.3283064365386963e-10; // / 0x100000000

		}

		// Hammersley sequence
		vec2 hammersley( uint i, uint N ) {

			return vec2( float( i ) / float( N ), radicalInverse_VdC( i ) );

		}

		void main() {

			vec3 N = normalize( vWorldDirection );

			// For very low roughness, just sample the environment directly
			if ( roughness < 0.001 ) {

				gl_FragColor = vec4( textureLod( envMap, N, 0.0 ).rgb, 1.0 );
				return;

			}

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			// Tangent space basis for VNDF sampling
			vec3 up = abs( N.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, N ) );
			vec3 bitangent = cross( N, tangent );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			for ( uint i = 0u; i < GGX_SAMPLES; i ++ ) {

				vec2 Xi = hammersley( i, GGX_SAMPLES );

				// With V = N, sample the reflected direction directly.
				float invQ = 1.0 / ( 1.0 - Xi.x + alpha2 * Xi.x );
				float NdotL = ( 1.0 - Xi.x - alpha2 * Xi.x ) * invQ;

				if ( NdotL > 0.0 ) {

					float phi = 2.0 * PI * Xi.y;
					float sinTheta = 2.0 * alpha * sqrt( Xi.x * ( 1.0 - Xi.x ) ) * invQ;
					vec3 L = N * NdotL + ( tangent * cos( phi ) + bitangent * sin( phi ) ) * sinTheta;

					// Match the source mip to the sample's solid angle. The terms
					// independent of the sample are precomputed in lodBias.
					float d = alpha2 * invQ;
					float lod = max( log2( d ) + lodBias, 0.0 );

					// Weight by NdotL for the split-sum approximation
					prefilteredColor += textureLod( envMap, L, lod ).rgb * NdotL;
					totalWeight += NdotL;

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function jm(){return oo("PMREMGGXIntegration",{envMap:{value:null},roughness:{value:0},sourceLod:{value:0},sourceSize:{value:Ku}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float sourceLod;
		uniform int sourceSize;

		void main() {

			vec3 N = normalize( vWorldDirection );

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			float texelSize = 2.0 / float( sourceSize );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			// Pair opposite texels: only the one in N's hemisphere contributes.
			for ( int face = 0; face < 3; face ++ ) {

				for ( int y = 0; y < sourceSize; y ++ ) {

					for ( int x = 0; x < sourceSize; x ++ ) {

						vec2 uv = ( vec2( x, y ) + 0.5 ) * texelSize - 1.0;
						vec3 texelDirection = face == 0 ? vec3( 1.0, uv ) : ( face == 1 ? vec3( uv.x, 1.0, uv.y ) : vec3( uv, 1.0 ) );

						float invDistance = inversesqrt( 1.0 + dot( uv, uv ) );
						float NdotL = dot( N, texelDirection );
						texelDirection *= NdotL < 0.0 ? - 1.0 : 1.0;
						NdotL = abs( NdotL ) * invDistance;

						// With V = N, NdotH squared is ( 1 + NdotL ) / 2. Common factors
						// in the GGX distribution and texel solid angle cancel when normalized.
						float d = 1.0 + alpha2 + ( alpha2 - 1.0 ) * NdotL;
						float weight = NdotL * invDistance * invDistance * invDistance / ( d * d );

						prefilteredColor += textureLod( envMap, texelDirection, sourceLod ).rgb * weight;
						totalWeight += weight;

					}

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function Qm(){return oo("PMREMSphericalGaussianBlur",{envMap:{value:null},sigma:{value:0}},`

		#define SAMPLES ${Ym}
		#define GOLDEN_ANGLE 2.39996322973

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float sigma;

		#include <common>

		void main() {

			vec3 outputDirection = normalize( vWorldDirection );

			vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, outputDirection ) );
			vec3 bitangent = cross( outputDirection, tangent );

			// Truncate the kernel at three standard deviations or at the antipode.
			float thetaMax = min( 3.0 * sigma, PI );
			float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

			vec3 accumColor = vec3( 0.0 );
			float accumWeight = 0.0;

			for ( int i = 0; i < SAMPLES; i ++ ) {

				// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
				float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
				float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
				float phi = float( i ) * GOLDEN_ANGLE;

				vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
				vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

				// Correct the planar sample density to solid angle.
				float weight = sin( theta ) / theta;

				accumColor += weight * textureLod( envMap, sampleDirection, 0.0 ).rgb;
				accumWeight += weight;

			}

			gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

		}
	`)}function Au(){return oo("PMREMEquirectangularToCubemap",{envMap:{value:null}},`

		varying vec3 vWorldDirection;

		uniform sampler2D envMap;

		#include <common>

		void main() {

			// Average four subpixel samples to preserve small, bright features.
			vec3 direction = normalize( vWorldDirection );
			vec3 dx = dFdx( direction ) * 0.25;
			vec3 dy = dFdy( direction ) * 0.25;

			vec3 color = textureLod( envMap, equirectUv( normalize( direction - dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction - dx + dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx + dy ) ), 0.0 ).rgb;
			gl_FragColor = vec4( color * 0.25, 1.0 );

		}
	`)}function Cu(){return oo("PMREMCubemapToCubemap",{envMap:{value:null},flipEnvMap:{value:-1}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float flipEnvMap;

		void main() {

			gl_FragColor = vec4( textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) ).rgb, 1.0 );

		}
	`)}function tg(i){let t=new WeakMap,e=new WeakMap,n=null;function s(u,d=!1){return u==null?null:d?o(u):r(u)}function r(u){if(u&&u.isTexture){let d=u.mapping;if(d===Ta||d===wa)if(t.has(u)){let g=t.get(u).texture;return a(g,u.mapping)}else{let g=u.image;if(g&&g.height>0){let v=new ro(g.height);return v.fromEquirectangularTexture(i,u),t.set(u,v),u.addEventListener("dispose",c),a(v.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture&&u.isPMREMTexture!==!0){let d=u.mapping,g=d===Ta||d===wa,v=d===gs||d===$s;if(g||v){let m=e.get(u),p=m!==void 0?m.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==p)return n===null&&(n=new dl(i)),m=g?n.fromEquirectangular(u,m):n.fromCubemap(u,m),m.texture.pmremVersion=u.pmremVersion,e.set(u,m),m.texture;if(m!==void 0)return m.texture;{let y=u.image;return g&&y&&y.height>0||v&&y&&l(y)?(n===null&&(n=new dl(i)),m=g?n.fromEquirectangular(u):n.fromCubemap(u),m.texture.pmremVersion=u.pmremVersion,e.set(u,m),u.addEventListener("dispose",h),m.texture):null}}}return u}function a(u,d){return d===Ta?u.mapping=gs:d===wa&&(u.mapping=$s),u}function l(u){let d=0,g=6;for(let v=0;v<g;v++)u[v]!==void 0&&d++;return d===g}function c(u){let d=u.target;d.removeEventListener("dispose",c);let g=t.get(d);g!==void 0&&(t.delete(d),g.dispose())}function h(u){let d=u.target;d.removeEventListener("dispose",h);let g=e.get(d);g!==void 0&&(e.delete(d),g.dispose())}function f(){t=new WeakMap,e=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:f}}function eg(i){let t={};function e(n){if(t[n]!==void 0)return t[n];let s=i.getExtension(n);return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){let s=e(n);return s===null&&ns("WebGLRenderer: "+n+" extension not supported."),s}}}function ng(i,t,e,n){let s={},r=new WeakMap,o=new FinalizationRegistry(g=>delete s[g]);function a(g){l(g.target)}function l(g){g.index!==null&&t.remove(g.index);for(let m in g.attributes)t.remove(g.attributes[m]);g.removeEventListener("dispose",a),delete s[g.id],o.unregister(g);let v=r.get(g);v&&(t.remove(v),r.delete(g)),n.releaseStatesOfGeometry(g),g.isInstancedBufferGeometry===!0&&delete g._maxInstanceCount,e.memory.geometries--}function c(g,v){return s[v.id]!==void 0||(v.addEventListener("dispose",a),s[v.id]=new WeakRef(v),o.register(v,v.id,v),e.memory.geometries++),v}function h(g){let v=g.attributes;for(let m in v)t.update(v[m],i.ARRAY_BUFFER)}function f(g){let v=g.index,m=g.attributes.position,p=0;if(m===void 0)return;let y=v!==null?v.array.length:m.array.length/3-1,T=m.count>=65535?Sr:Mr,_=new T(Math.ceil(y/3)*6,1),A=_.array;if(v!==null){let x=v.array;p=v.version;for(let S=0,I=0;S<y;S+=3){let b=x[S+0],N=x[S+1],G=x[S+2];A[I++]=b,A[I++]=N,A[I++]=N,A[I++]=G,A[I++]=G,A[I++]=b}}else{p=m.version;for(let x=0,S=0;x<y;x+=3){let I=x+0,b=x+1,N=x+2;A[S++]=I,A[S++]=b,A[S++]=b,A[S++]=N,A[S++]=N,A[S++]=I}}_.version=p;let w=r.get(g);w&&t.remove(w),r.set(g,_)}function u(g){let v=r.get(g);if(v){let m=g.index;m!==null&&v.version<m.version&&f(g)}else f(g);return r.get(g)}function d(){for(let g in s){let v=s[g].deref();v!==void 0&&l(v)}}return{get:c,update:h,getWireframeAttribute:u,dispose:d}}function ig(i,t,e){let n;function s(f){n=f}let r,o;function a(f){r=f.type,o=f.bytesPerElement}function l(f,u){i.drawElements(n,u,r,f*o),e.update(u,n,1)}function c(f,u,d){d!==0&&(i.drawElementsInstanced(n,u,r,f*o,d),e.update(u,n,d))}function h(f,u,d){if(d===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,u,0,r,f,0,d);let v=0;for(let m=0;m<d;m++)v+=u[m];e.update(v,n,1)}this.setMode=s,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function sg(i){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(e.calls++,o){case i.TRIANGLES:e.triangles+=a*(r/3);break;case i.LINES:e.lines+=a*(r/2);break;case i.LINE_STRIP:e.lines+=a*(r-1);break;case i.LINE_LOOP:e.lines+=a*r;break;case i.POINTS:e.points+=a*r;break;default:Ee("WebGLInfo: Unknown draw mode:",o);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function rg(i,t,e){let n=new WeakMap,s=new Ke;function r(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=h!==void 0?h.length:0,u=n.get(a);if(u===void 0||u.count!==f){let I=function(){x.dispose(),n.delete(a),a.removeEventListener("dispose",I)};u!==void 0&&u.texture.dispose();let d=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,v=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],p=a.morphAttributes.normal||[],y=a.morphAttributes.color||[],T=0;d===!0&&(T=1),g===!0&&(T=2),v===!0&&(T=3);let _=a.attributes.position.count*T,A=1;_>t.maxTextureSize&&(A=Math.ceil(_/t.maxTextureSize),_=t.maxTextureSize);let w=new Float32Array(_*A*4*f),x=new yr(w,_,A,f);x.type=jn,x.needsUpdate=!0;let S=T*4;for(let b=0;b<f;b++){let N=m[b],G=p[b],K=y[b],D=_*A*4*b;for(let z=0;z<N.count;z++){let Y=z*S;d===!0&&(s.fromBufferAttribute(N,z),w[D+Y+0]=s.x,w[D+Y+1]=s.y,w[D+Y+2]=s.z,w[D+Y+3]=0),g===!0&&(s.fromBufferAttribute(G,z),w[D+Y+4]=s.x,w[D+Y+5]=s.y,w[D+Y+6]=s.z,w[D+Y+7]=0),v===!0&&(s.fromBufferAttribute(K,z),w[D+Y+8]=s.x,w[D+Y+9]=s.y,w[D+Y+10]=s.z,w[D+Y+11]=K.itemSize===4?s.w:1)}}u={count:f,texture:x,size:new bt(_,A)},n.set(a,u),a.addEventListener("dispose",I)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",o.morphTexture,e);else{let d=0;for(let v=0;v<c.length;v++)d+=c[v];let g=a.morphTargetsRelative?1:1-d;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",u.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",u.size)}return{update:r}}function og(i,t,e,n,s){let r=new WeakMap;function o(c){let h=s.render.frame,f=c.geometry,u=t.get(c,f);if(r.get(u)!==h&&(t.update(u),r.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(e.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,i.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let d=c.skeleton;r.get(d)!==h&&(d.update(),r.set(d,h))}return u}function a(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),e.remove(h.instanceMatrix),h.instanceColor!==null&&e.remove(h.instanceColor)}return{update:o,dispose:a}}var ag={[ac]:"LINEAR_TONE_MAPPING",[lc]:"REINHARD_TONE_MAPPING",[cc]:"CINEON_TONE_MAPPING",[hc]:"ACES_FILMIC_TONE_MAPPING",[dc]:"AGX_TONE_MAPPING",[fc]:"NEUTRAL_TONE_MAPPING",[uc]:"CUSTOM_TONE_MAPPING"};function lg(i,t,e,n,s,r){let o=new gn(t,e,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,c=null,h=new qe;h.setAttribute("position",new me([-1,3,0,-1,-1,0,3,-1,0],3)),h.setAttribute("uv",new me([0,2,0,0,2,0],2));let f=new ca({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),u=new P(h,f),d=new ds(-1,1,1,-1,0,1),g=null,v=null,m=!1,p,y=null,T=[],_=!1;this.setSize=function(A,w){o.setSize(A,w),a!==null&&a.setSize(A,w),l!==null&&l.setSize(A,w);for(let x=0;x<T.length;x++){let S=T[x];S.setSize&&S.setSize(A,w)}},this.setEffects=function(A){T=A,_=T.length>0&&T[0].isRenderPass===!0;let w=o.width,x=o.height;T.length>0&&a===null&&(a=new gn(w,x,{type:Wn,depthBuffer:!1,stencilBuffer:!1}),l=new gn(w,x,{type:Wn,depthBuffer:!1,stencilBuffer:!1}));let S=s===!0&&T.some(I=>I.needsDepthTexture===!0);S!==(o.depthTexture!==null)&&(S===!0&&c===null&&(c=new Ri(w,x),r===!0&&(c.format=Pi,c.type=xs)),o.dispose(),o.depthTexture=S?c:null,o.resolveDepthBuffer=S,o.storeMultisampledDepthBuffer=S);for(let I=0;I<T.length;I++){let b=T[I];b.setSize&&b.setSize(w,x),S&&b.needsDepthTexture===!0&&b.setDepthTexture&&b.setDepthTexture(c)}},this.begin=function(A,w){if(m||A.toneMapping===$n&&T.length===0)return!1;if(y=w,w!==null){let x=w.width,S=w.height;(o.width!==x||o.height!==S)&&this.setSize(x,S)}return _===!1&&A.setRenderTarget(o),p=A.toneMapping,A.toneMapping=$n,!0},this.hasRenderPass=function(){return _},this.end=function(A,w){A.toneMapping=p,m=!0;let x=o,S=a;for(let I=0;I<T.length;I++){let b=T[I];b.enabled!==!1&&(b.render(A,S,x,w),b.needsSwap!==!1&&(x=S,S=S===a?l:a))}if(g!==A.outputColorSpace||v!==A.toneMapping){g=A.outputColorSpace,v=A.toneMapping,f.defines={},Ne.getTransfer(g)===Ve&&(f.defines.SRGB_TRANSFER="");let I=ag[v];I&&(f.defines[I]=""),f.needsUpdate=!0}f.uniforms.tDiffuse.value=x.texture,A.setRenderTarget(y),A.render(u,d),y=null,m=!1},this.isCompositing=function(){return m},this.dispose=function(){o.dispose(),a!==null&&a.dispose(),l!==null&&l.dispose(),h.dispose(),f.dispose()}}var $u=new In,ju=new Ri(1,1),Qu=new Ar(1),td=new yr,ed=new jo,nd=new br,Pu=[],Iu=[],Du=new Float32Array(16),Lu=new Float32Array(9),Nu=new Float32Array(4);function er(i,t,e){let n=i[0];if(n<=0||n>0)return i;let s=t*e,r=Pu[s];if(r===void 0&&(r=new Float32Array(s),Pu[s]=r),t!==0){n.toArray(r,0);for(let o=1,a=0;o!==t;++o)a+=e,i[o].toArray(r,a)}return r}function hn(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function un(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function pl(i,t){let e=Iu[t];e===void 0&&(e=new Int32Array(t),Iu[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function cg(i,t){let e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function hg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(hn(e,t))return;i.uniform2fv(this.addr,t),un(e,t)}}function ug(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(hn(e,t))return;i.uniform3fv(this.addr,t),un(e,t)}}function dg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(hn(e,t))return;i.uniform4fv(this.addr,t),un(e,t)}}function fg(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(hn(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),un(e,t)}else{if(hn(e,n))return;Nu.set(n),i.uniformMatrix2fv(this.addr,!1,Nu),un(e,n)}}function pg(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(hn(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),un(e,t)}else{if(hn(e,n))return;Lu.set(n),i.uniformMatrix3fv(this.addr,!1,Lu),un(e,n)}}function mg(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(hn(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),un(e,t)}else{if(hn(e,n))return;Du.set(n),i.uniformMatrix4fv(this.addr,!1,Du),un(e,n)}}function gg(i,t){let e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function xg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(hn(e,t))return;i.uniform2iv(this.addr,t),un(e,t)}}function _g(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(hn(e,t))return;i.uniform3iv(this.addr,t),un(e,t)}}function yg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(hn(e,t))return;i.uniform4iv(this.addr,t),un(e,t)}}function vg(i,t){let e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function Eg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(hn(e,t))return;i.uniform2uiv(this.addr,t),un(e,t)}}function Mg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(hn(e,t))return;i.uniform3uiv(this.addr,t),un(e,t)}}function Sg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(hn(e,t))return;i.uniform4uiv(this.addr,t),un(e,t)}}function ml(i){return i.version===0&&(i.compareFunction=Sc,i.needsUpdate=!0),i}function Tg(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?r=ml(ju):r=$u,e.setTexture2D(t||r,s)}function wg(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||ed,s)}function bg(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_CUBE_SHADOW?r=ml(Qu):r=nd,e.setTextureCube(t||r,s)}function Rg(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||td,s)}function Ag(i){switch(i){case 5126:return cg;case 35664:return hg;case 35665:return ug;case 35666:return dg;case 35674:return fg;case 35675:return pg;case 35676:return mg;case 5124:case 35670:return gg;case 35667:case 35671:return xg;case 35668:case 35672:return _g;case 35669:case 35673:return yg;case 5125:return vg;case 36294:return Eg;case 36295:return Mg;case 36296:return Sg;case 35678:case 36198:case 36298:case 36306:case 35682:return Tg;case 35679:case 36299:case 36307:return wg;case 35680:case 36300:case 36308:case 36293:return bg;case 36289:case 36303:case 36311:case 36292:return Rg}}function Cg(i,t){i.uniform1fv(this.addr,t)}function Pg(i,t){let e=er(t,this.size,2);i.uniform2fv(this.addr,e)}function Ig(i,t){let e=er(t,this.size,3);i.uniform3fv(this.addr,e)}function Dg(i,t){let e=er(t,this.size,4);i.uniform4fv(this.addr,e)}function Lg(i,t){let e=er(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function Ng(i,t){let e=er(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function Ug(i,t){let e=er(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function Fg(i,t){i.uniform1iv(this.addr,t)}function Og(i,t){i.uniform2iv(this.addr,t)}function Bg(i,t){i.uniform3iv(this.addr,t)}function Hg(i,t){i.uniform4iv(this.addr,t)}function Gg(i,t){i.uniform1uiv(this.addr,t)}function zg(i,t){i.uniform2uiv(this.addr,t)}function kg(i,t){i.uniform3uiv(this.addr,t)}function Vg(i,t){i.uniform4uiv(this.addr,t)}function Wg(i,t,e){let n=this.cache,s=t.length,r=pl(e,s);hn(n,r)||(i.uniform1iv(this.addr,r),un(n,r));let o;this.type===i.SAMPLER_2D_SHADOW?o=ml(ju):o=$u;for(let a=0;a!==s;++a)e.setTexture2D(t[a]||o,r[a])}function Xg(i,t,e){let n=this.cache,s=t.length,r=pl(e,s);hn(n,r)||(i.uniform1iv(this.addr,r),un(n,r));for(let o=0;o!==s;++o)e.setTexture3D(t[o]||ed,r[o])}function qg(i,t,e){let n=this.cache,s=t.length,r=pl(e,s);hn(n,r)||(i.uniform1iv(this.addr,r),un(n,r));let o;this.type===i.SAMPLER_CUBE_SHADOW?o=ml(Qu):o=nd;for(let a=0;a!==s;++a)e.setTextureCube(t[a]||o,r[a])}function Yg(i,t,e){let n=this.cache,s=t.length,r=pl(e,s);hn(n,r)||(i.uniform1iv(this.addr,r),un(n,r));for(let o=0;o!==s;++o)e.setTexture2DArray(t[o]||td,r[o])}function Zg(i){switch(i){case 5126:return Cg;case 35664:return Pg;case 35665:return Ig;case 35666:return Dg;case 35674:return Lg;case 35675:return Ng;case 35676:return Ug;case 5124:case 35670:return Fg;case 35667:case 35671:return Og;case 35668:case 35672:return Bg;case 35669:case 35673:return Hg;case 5125:return Gg;case 36294:return zg;case 36295:return kg;case 36296:return Vg;case 35678:case 36198:case 36298:case 36306:case 35682:return Wg;case 35679:case 36299:case 36307:return Xg;case 35680:case 36300:case 36308:case 36293:return qg;case 36289:case 36303:case 36311:case 36292:return Yg}}var Fc=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Ag(e.type)}},Oc=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=Zg(e.type)}},Bc=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){let s=this.seq;for(let r=0,o=s.length;r!==o;++r){let a=s[r];a.setValue(t,e[a.id],n)}}},Nc=/(\w+)(\])?(\[|\.)?/g;function Uu(i,t){i.seq.push(t),i.map[t.id]=t}function Jg(i,t,e){let n=i.name,s=n.length;for(Nc.lastIndex=0;;){let r=Nc.exec(n),o=Nc.lastIndex,a=r[1],l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===s){Uu(e,c===void 0?new Fc(a,i,t):new Oc(a,i,t));break}else{let f=e.map[a];f===void 0&&(f=new Bc(a),Uu(e,f)),e=f}}}var tr=class{constructor(t,e){this.seq=[],this.map={};let n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let o=0;o<n;++o){let a=t.getActiveUniform(e,o),l=t.getUniformLocation(e,a.name);Jg(a,l,this)}let s=[],r=[];for(let o of this.seq)o.type===t.SAMPLER_2D_SHADOW||o.type===t.SAMPLER_CUBE_SHADOW||o.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(o):r.push(o);s.length>0&&(this.seq=s.concat(r))}setValue(t,e,n,s){let r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){let s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,o=e.length;r!==o;++r){let a=e[r],l=n[a.id];l.needsUpdate!==!1&&a.setValue(t,l.value,s)}}static seqWithValue(t,e){let n=[];for(let s=0,r=t.length;s!==r;++s){let o=t[s];o.id in e&&n.push(o)}return n}};function Fu(i,t,e){let n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}var Kg=37297,$g=0;function jg(i,t){let e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let o=s;o<r;o++){let a=o+1;n.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return n.join(`
`)}var Ou=new Te;function Qg(i){Ne._getMatrix(Ou,Ne.workingColorSpace,i);let t=`mat3( ${Ou.elements.map(e=>e.toFixed(4))} )`;switch(Ne.getTransfer(i)){case xr:return[t,"LinearTransferOETF"];case Ve:return[t,"sRGBTransferOETF"];default:return pe("WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Bu(i,t,e){let n=i.getShaderParameter(t,i.COMPILE_STATUS),r=(i.getShaderInfoLog(t)||"").trim();if(n&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let a=parseInt(o[1]);return e.toUpperCase()+`

`+r+`

`+jg(i.getShaderSource(t),a)}else return r}function tx(i,t){let e=Qg(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( ${e[0]} * value.rgb, value.a ) );`,"}"].join(`
`)}var ex={[ac]:"Linear",[lc]:"Reinhard",[cc]:"Cineon",[hc]:"ACESFilmic",[dc]:"AgX",[fc]:"Neutral",[uc]:"Custom"};function nx(i,t){let e=ex[t];return e===void 0?(pe("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var ul=new R;function ix(){Ne.getLuminanceCoefficients(ul);let i=ul.x.toFixed(4),t=ul.y.toFixed(4),e=ul.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function sx(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(so).join(`
`)}function rx(i){let t=[];for(let e in i){let n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function ox(i,t){let e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(t,s),o=r.name,a=1;r.type===i.FLOAT_MAT2&&(a=2),r.type===i.FLOAT_MAT3&&(a=3),r.type===i.FLOAT_MAT4&&(a=4),e[o]={type:r.type,location:i.getAttribLocation(t,o),locationSize:a}}return e}function so(i){return i!==""}function Hu(i,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows).replace(/NUM_LIGHT_PROBE_GRIDS/g,t.numLightProbeGrids)}function Gu(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var ax=/^[ \t]*#include +<([\w\d./]+)>/gm;function Hc(i){return i.replace(ax,lx)}function lx(i,t){let e=Ie[t];if(e===void 0)throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">");return Hc(e)}var cx=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function zu(i){return i.replace(cx,hx)}function hx(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function ku(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}var ux={[fs]:"SHADOWMAP_TYPE_PCF",[Ks]:"SHADOWMAP_TYPE_VSM"};function dx(i){return ux[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var fx={[$s]:"ENVMAP_MODE_REFRACTION"};function px(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":fx[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var mx={[oc]:"ENVMAP_BLENDING_MULTIPLY",[tu]:"ENVMAP_BLENDING_MIX",[eu]:"ENVMAP_BLENDING_ADD"};function gx(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":mx[i.combine]||"ENVMAP_BLENDING_NONE"}function xx(i,t,e,n){let s=i.getContext(),r=e.defines,o=e.vertexShader,a=e.fragmentShader,l=dx(e),c=e.envMapPMREM===!0?"ENVMAP_TYPE_PMREM":"ENVMAP_TYPE_CUBE",h=px(e),f=gx(e),u=sx(e),d=rx(r),g=s.createProgram(),v,m,p=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(v=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,d].filter(so).join(`
`),v.length>0&&(v+=`
`),m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,d].filter(so).join(`
`),m.length>0&&(m+=`
`)):(v=[ku(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,d,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.diffuseRoughnessMapUv?"#define DIFFUSE_ROUGHNESSMAP_UV "+e.diffuseRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexNormals?"#define HAS_NORMAL":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(so).join(`
`),m=[ku(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,d,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+f:"",e.envMapPMREM?"#define ENVMAP_MAX_LOD "+e.envMapMaxLod+".0":"",e.envMapPMREM?"#define ENVMAP_SIZE "+e.envMapSize+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.diffuseRoughness?"#define USE_DIFFUSE_ROUGHNESS":"",e.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.retroreflection?"#define USE_RETROREFLECTION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas||e.batchingColor?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==$n?"#define TONE_MAPPING":"",e.toneMapping!==$n?Ie.tonemapping_pars_fragment:"",e.toneMapping!==$n?nx("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Ie.colorspace_pars_fragment,tx("linearToOutputTexel",e.outputColorSpace),ix(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(so).join(`
`)),o=Hc(o),o=Hu(o,e),o=Gu(o,e),a=Hc(a),a=Hu(a,e),a=Gu(a,e),o=zu(o),a=zu(a),e.isRawShaderMaterial!==!0&&(p=`#version 300 es
`,v=[u,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+v,m=["#define varying in",e.glslVersion===Tc?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Tc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);let y=p+v+o,T=p+m+a,_=Fu(s,s.VERTEX_SHADER,y),A=Fu(s,s.FRAGMENT_SHADER,T);s.attachShader(g,_),s.attachShader(g,A),e.index0AttributeName!==void 0?s.bindAttribLocation(g,0,e.index0AttributeName):e.hasPositionAttribute===!0&&s.bindAttribLocation(g,0,"position"),s.linkProgram(g);function w(b){if(i.debug.checkShaderErrors){let N=s.getProgramInfoLog(g)||"",G=s.getShaderInfoLog(_)||"",K=s.getShaderInfoLog(A)||"",D=N.trim(),z=G.trim(),Y=K.trim(),B=!0,H=!0;if(s.getProgramParameter(g,s.LINK_STATUS)===!1)if(B=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,g,_,A);else{let $=Bu(s,_,"vertex"),Q=Bu(s,A,"fragment");Ee("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(g,s.VALIDATE_STATUS)+`

Material Name: `+b.name+`
Material Type: `+b.type+`

Program Info Log: `+D+`
`+$+`
`+Q)}else D!==""?pe("WebGLProgram: Program Info Log:",D):(z===""||Y==="")&&(H=!1);H&&(b.diagnostics={runnable:B,programLog:D,vertexShader:{log:z,prefix:v},fragmentShader:{log:Y,prefix:m}})}s.deleteShader(_),s.deleteShader(A),x=new tr(s,g),S=ox(s,g)}let x;this.getUniforms=function(){return x===void 0&&w(this),x};let S;this.getAttributes=function(){return S===void 0&&w(this),S};let I=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return I===!1&&(I=s.getProgramParameter(g,Kg)),I},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(g),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=$g++,this.cacheKey=t,this.usedTimes=1,this.program=g,this.vertexShader=_,this.fragmentShader=A,this}var _x=0,Gc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,e,n){let s=this._getShaderCacheForMaterial(t);return s.has(e)===!1&&(s.add(e),e.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){let e=this.shaderCache,n=e.get(t);return n===void 0&&(n=new zc(t),e.set(t,n)),n}},zc=class{constructor(t){this.id=_x++,this.code=t,this.usedTimes=0}};function yx(i){return i===Zi||i===to||i===eo}function vx(i,t,e,n,s,r){let o=new vr,a=new Gc,l=new Set,c=[],h=new Map,f=n.logarithmicDepthBuffer,u={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function d(x){return l.add(x),x===0?"uv":`uv${x}`}function g(x,S,I,b,N,G){let K=b.fog,D=N.geometry,z=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?b.environment:null,Y=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,B=t.get(x.envMap||z,Y),H=u[x.type],$=n.precision;x.precision!==null&&($=n.getMaxPrecision(x.precision),$!==x.precision&&pe("WebGLProgram.getParameters:",x.precision,"not supported, using",$,"instead."));let Q=D.morphAttributes.position||D.morphAttributes.normal||D.morphAttributes.color,dt=Q!==void 0?Q.length:0,Ft=0;D.morphAttributes.position!==void 0&&(Ft=1),D.morphAttributes.normal!==void 0&&(Ft=2),D.morphAttributes.color!==void 0&&(Ft=3);let qt,O,xt,tt;if(H){let kt=mi[H];qt=kt.vertexShader,O=kt.fragmentShader}else{qt=x.vertexShader,O=x.fragmentShader;let kt=a.getVertexShaderStage(x),Se=a.getFragmentShaderStage(x);a.update(x,kt,Se),xt=kt.id,tt=Se.id}let st=i.getRenderTarget(),pt=i.state.buffers.depth.getReversed(),at=N.isInstancedMesh===!0,ee=N.isBatchedMesh===!0,Mt=!!x.map,$t=!!x.matcap,lt=!!B,k=lt&&B.isPMREMTexture===!0,rt=!!x.aoMap,ft=!!x.lightMap,At=!!x.bumpMap&&x.wireframe===!1,_t=!!x.normalMap,St=!!x.displacementMap,Gt=!!x.emissiveMap,Zt=!!x.metalnessMap,ie=!!x.roughnessMap,Xt=x.anisotropy>0,U=x.clearcoat>0,Pe=x.diffuseRoughness>0,oe=x.dispersion>0,Ae=x.retroreflectivity>0,Lt=x.iridescence>0,Me=x.sheen>0,Kt=x.transmission>0,se=Xt&&!!x.anisotropyMap,C=U&&!!x.clearcoatMap,E=U&&!!x.clearcoatNormalMap,W=U&&!!x.clearcoatRoughnessMap,yt=Pe&&!!x.diffuseRoughnessMap,ut=Lt&&!!x.iridescenceMap,nt=Lt&&!!x.iridescenceThicknessMap,et=Me&&!!x.sheenColorMap,J=Me&&!!x.sheenRoughnessMap,ot=!!x.specularMap,mt=!!x.specularColorMap,L=!!x.specularIntensityMap,ct=Kt&&!!x.transmissionMap,it=Kt&&!!x.thicknessMap,Pt=!!x.gradientMap,wt=!!x.alphaMap,Et=x.alphaTest>0,Vt=!!x.alphaHash,he=!!x.extensions,Tt=$n;x.toneMapped&&(st===null||st.isXRRenderTarget===!0)&&(Tt=i.toneMapping);let Qt=k?B.isCompressedCubeTexture?B.image[0].mipmaps:B.mipmaps:null,re={shaderID:H,shaderType:x.type,shaderName:x.name,vertexShader:qt,fragmentShader:O,defines:x.defines,customVertexShaderID:xt,customFragmentShaderID:tt,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:$,batching:ee,batchingColor:ee&&N._colorsTexture!==null,instancing:at,instancingColor:at&&N.instanceColor!==null,instancingMorph:at&&N.morphTexture!==null,outputColorSpace:st===null?i.outputColorSpace:st.isXRRenderTarget===!0?st.texture.colorSpace:Ne.workingColorSpace,alphaToCoverage:!!x.alphaToCoverage,map:Mt,matcap:$t,envMap:lt,envMapMode:lt&&B.mapping,envMapPMREM:k,envMapMaxLod:k?Qt.length-1:null,envMapSize:k?Qt[0].width:null,aoMap:rt,lightMap:ft,bumpMap:At,normalMap:_t,displacementMap:St,emissiveMap:Gt,normalMapObjectSpace:_t&&x.normalMapType===su,normalMapTangentSpace:_t&&x.normalMapType===no,packedNormalMap:_t&&x.normalMapType===no&&yx(x.normalMap.format),metalnessMap:Zt,roughnessMap:ie,anisotropy:Xt,anisotropyMap:se,clearcoat:U,clearcoatMap:C,clearcoatNormalMap:E,clearcoatRoughnessMap:W,diffuseRoughness:Pe,diffuseRoughnessMap:yt,dispersion:oe,retroreflection:Ae,iridescence:Lt,iridescenceMap:ut,iridescenceThicknessMap:nt,sheen:Me,sheenColorMap:et,sheenRoughnessMap:J,specularMap:ot,specularColorMap:mt,specularIntensityMap:L,transmission:Kt,transmissionMap:ct,thicknessMap:it,gradientMap:Pt,opaque:x.transparent===!1&&x.blending===Yi&&x.alphaToCoverage===!1,alphaMap:wt,alphaTest:Et,alphaHash:Vt,combine:x.combine,mapUv:Mt&&d(x.map.channel),aoMapUv:rt&&d(x.aoMap.channel),lightMapUv:ft&&d(x.lightMap.channel),bumpMapUv:At&&d(x.bumpMap.channel),normalMapUv:_t&&d(x.normalMap.channel),displacementMapUv:St&&d(x.displacementMap.channel),emissiveMapUv:Gt&&d(x.emissiveMap.channel),metalnessMapUv:Zt&&d(x.metalnessMap.channel),roughnessMapUv:ie&&d(x.roughnessMap.channel),anisotropyMapUv:se&&d(x.anisotropyMap.channel),clearcoatMapUv:C&&d(x.clearcoatMap.channel),clearcoatNormalMapUv:E&&d(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:W&&d(x.clearcoatRoughnessMap.channel),diffuseRoughnessMapUv:yt&&d(x.diffuseRoughnessMap.channel),iridescenceMapUv:ut&&d(x.iridescenceMap.channel),iridescenceThicknessMapUv:nt&&d(x.iridescenceThicknessMap.channel),sheenColorMapUv:et&&d(x.sheenColorMap.channel),sheenRoughnessMapUv:J&&d(x.sheenRoughnessMap.channel),specularMapUv:ot&&d(x.specularMap.channel),specularColorMapUv:mt&&d(x.specularColorMap.channel),specularIntensityMapUv:L&&d(x.specularIntensityMap.channel),transmissionMapUv:ct&&d(x.transmissionMap.channel),thicknessMapUv:it&&d(x.thicknessMap.channel),alphaMapUv:wt&&d(x.alphaMap.channel),vertexTangents:!!D.attributes.tangent&&(_t||Xt),vertexNormals:!!D.attributes.normal,vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!D.attributes.color&&D.attributes.color.itemSize===4,pointsUvs:N.isPoints===!0&&!!D.attributes.uv&&(Mt||wt),fog:!!K,useFog:x.fog===!0,fogExp2:!!K&&K.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||D.attributes.normal===void 0&&_t===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:pt,skinning:N.isSkinnedMesh===!0,hasPositionAttribute:D.attributes.position!==void 0,morphTargets:D.morphAttributes.position!==void 0,morphNormals:D.morphAttributes.normal!==void 0,morphColors:D.morphAttributes.color!==void 0,morphTargetsCount:dt,morphTextureStride:Ft,numSunLights:S.sun.length,numDirLights:S.directional.length,numPointLights:S.point.length,numSpotLights:S.spot.length,numSpotLightMaps:S.spotLightMap.length,numRectAreaLights:S.rectArea.length,numHemiLights:S.hemi.length,numSunLightShadows:S.sunShadowMap.length,numDirLightShadows:S.directionalShadowMap.length,numPointLightShadows:S.pointShadowMap.length,numSpotLightShadows:S.spotShadowMap.length,numSpotLightShadowsWithMaps:S.numSpotLightShadowsWithMaps,numLightProbes:S.numLightProbes,numLightProbeGrids:G.filter(kt=>kt.texture!==null).length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:x.dithering,shadowMapEnabled:i.shadowMap.enabled&&I.length>0,shadowMapType:i.shadowMap.type,toneMapping:Tt,decodeVideoTexture:Mt&&x.map.isVideoTexture===!0&&Ne.getTransfer(x.map.colorSpace)===Ve,decodeVideoTextureEmissive:Gt&&x.emissiveMap.isVideoTexture===!0&&Ne.getTransfer(x.emissiveMap.colorSpace)===Ve,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===Re,flipSided:x.side===vn,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:he&&x.extensions.clipCullDistance===!0&&e.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(he&&x.extensions.multiDraw===!0||ee)&&e.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:e.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return re.vertexUv1s=l.has(1),re.vertexUv2s=l.has(2),re.vertexUv3s=l.has(3),l.clear(),re}function v(x){let S=[];if(x.shaderID?S.push(x.shaderID):(S.push(x.customVertexShaderID),S.push(x.customFragmentShaderID)),x.defines!==void 0)for(let I in x.defines)S.push(I),S.push(x.defines[I]);return x.isRawShaderMaterial===!1&&(m(S,x),p(S,x),S.push(i.outputColorSpace)),S.push(x.customProgramCacheKey),S.join()}function m(x,S){x.push(S.precision),x.push(S.outputColorSpace),x.push(S.envMapMode),x.push(S.envMapPMREM),x.push(S.envMapMaxLod),x.push(S.envMapSize),x.push(S.mapUv),x.push(S.alphaMapUv),x.push(S.lightMapUv),x.push(S.aoMapUv),x.push(S.bumpMapUv),x.push(S.normalMapUv),x.push(S.displacementMapUv),x.push(S.emissiveMapUv),x.push(S.metalnessMapUv),x.push(S.roughnessMapUv),x.push(S.anisotropyMapUv),x.push(S.clearcoatMapUv),x.push(S.clearcoatNormalMapUv),x.push(S.clearcoatRoughnessMapUv),x.push(S.diffuseRoughnessMapUv),x.push(S.iridescenceMapUv),x.push(S.iridescenceThicknessMapUv),x.push(S.sheenColorMapUv),x.push(S.sheenRoughnessMapUv),x.push(S.specularMapUv),x.push(S.specularColorMapUv),x.push(S.specularIntensityMapUv),x.push(S.transmissionMapUv),x.push(S.thicknessMapUv),x.push(S.combine),x.push(S.fogExp2),x.push(S.sizeAttenuation),x.push(S.morphTargetsCount),x.push(S.numSunLights),x.push(S.numDirLights),x.push(S.numPointLights),x.push(S.numSpotLights),x.push(S.numSpotLightMaps),x.push(S.numHemiLights),x.push(S.numRectAreaLights),x.push(S.numSunLightShadows),x.push(S.numDirLightShadows),x.push(S.numPointLightShadows),x.push(S.numSpotLightShadows),x.push(S.numSpotLightShadowsWithMaps),x.push(S.numLightProbes),x.push(S.numLightProbeGrids),x.push(S.shadowMapType),x.push(S.toneMapping),x.push(S.numClippingPlanes),x.push(S.numClipIntersection),x.push(S.depthPacking)}function p(x,S){o.disableAll(),S.instancing&&o.enable(0),S.instancingColor&&o.enable(1),S.instancingMorph&&o.enable(2),S.matcap&&o.enable(3),S.envMap&&o.enable(4),S.normalMapObjectSpace&&o.enable(5),S.normalMapTangentSpace&&o.enable(6),S.clearcoat&&o.enable(7),S.iridescence&&o.enable(8),S.alphaTest&&o.enable(9),S.vertexColors&&o.enable(10),S.vertexAlphas&&o.enable(11),S.vertexUv1s&&o.enable(12),S.vertexUv2s&&o.enable(13),S.vertexUv3s&&o.enable(14),S.vertexTangents&&o.enable(15),S.anisotropy&&o.enable(16),S.alphaHash&&o.enable(17),S.batching&&o.enable(18),S.dispersion&&o.enable(19),S.retroreflection&&o.enable(24),S.diffuseRoughness&&o.enable(25),S.batchingColor&&o.enable(20),S.gradientMap&&o.enable(21),S.packedNormalMap&&o.enable(22),S.vertexNormals&&o.enable(23),x.push(o.mask),o.disableAll(),S.fog&&o.enable(0),S.useFog&&o.enable(1),S.flatShading&&o.enable(2),S.logarithmicDepthBuffer&&o.enable(3),S.reversedDepthBuffer&&o.enable(4),S.skinning&&o.enable(5),S.morphTargets&&o.enable(6),S.morphNormals&&o.enable(7),S.morphColors&&o.enable(8),S.premultipliedAlpha&&o.enable(9),S.shadowMapEnabled&&o.enable(10),S.doubleSided&&o.enable(11),S.flipSided&&o.enable(12),S.useDepthPacking&&o.enable(13),S.dithering&&o.enable(14),S.transmission&&o.enable(15),S.sheen&&o.enable(16),S.opaque&&o.enable(17),S.pointsUvs&&o.enable(18),S.decodeVideoTexture&&o.enable(19),S.decodeVideoTextureEmissive&&o.enable(20),S.alphaToCoverage&&o.enable(21),S.numLightProbeGrids>0&&o.enable(22),S.hasPositionAttribute&&o.enable(23),x.push(o.mask)}function y(x){let S=u[x.type],I;if(S){let b=mi[S];I=Su.clone(b.uniforms)}else I=x.uniforms;return I}function T(x,S){let I=h.get(S);return I!==void 0?++I.usedTimes:(I=new xx(i,S,x,s),c.push(I),h.set(S,I)),I}function _(x){if(--x.usedTimes===0){let S=c.indexOf(x);c[S]=c[c.length-1],c.pop(),h.delete(x.cacheKey),x.destroy()}}function A(x){a.remove(x)}function w(){a.dispose()}return{getParameters:g,getProgramCacheKey:v,getUniforms:y,acquireProgram:T,releaseProgram:_,releaseShaderCache:A,programs:c,dispose:w}}function Ex(){let i=new WeakMap;function t(o){return i.has(o)}function e(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function s(o,a,l){i.get(o)[a]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function Mx(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.materialVariant!==t.materialVariant?i.materialVariant-t.materialVariant:i.z!==t.z?i.z-t.z:i.id-t.id}function Vu(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function Wu(){let i=[],t=0,e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function o(u){let d=0;return u.isInstancedMesh&&(d+=2),u.isSkinnedMesh&&(d+=1),d}function a(u,d,g,v,m,p){let y=i[t];return y===void 0?(y={id:u.id,object:u,geometry:d,material:g,materialVariant:o(u),groupOrder:v,renderOrder:u.renderOrder,z:m,group:p},i[t]=y):(y.id=u.id,y.object=u,y.geometry=d,y.material=g,y.materialVariant=o(u),y.groupOrder=v,y.renderOrder=u.renderOrder,y.z=m,y.group=p),t++,y}function l(u,d,g,v,m,p,y){y.reversedDepth===!0&&(m=-m);let T=a(u,d,g,v,m,p);g.transmission>0?n.push(T):g.transparent===!0?s.push(T):e.push(T)}function c(u,d,g,v,m,p){let y=a(u,d,g,v,m,p);g.transmission>0?n.unshift(y):g.transparent===!0?s.unshift(y):e.unshift(y)}function h(u,d){e.length>1&&e.sort(u||Mx),n.length>1&&n.sort(d||Vu),s.length>1&&s.sort(d||Vu)}function f(){for(let u=t,d=i.length;u<d;u++){let g=i[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:l,unshift:c,finish:f,sort:h}}function Sx(){let i=new WeakMap;function t(n,s){let r=i.get(n),o;return r===void 0?(o=new Wu,i.set(n,[o])):s>=r.length?(o=new Wu,r.push(o)):o=r[s],o}function e(){i=new WeakMap}return{get:t,dispose:e}}function Tx(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={direction:new R,color:new fe};break;case"SpotLight":e={position:new R,direction:new R,color:new fe,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new R,color:new fe,distance:0,decay:0};break;case"HemisphereLight":e={direction:new R,skyColor:new fe,groundColor:new fe};break;case"RectAreaLight":e={color:new fe,position:new R,halfWidth:new R,halfHeight:new R};break}return i[t.id]=e,e}}}function wx(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new bt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new bt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new bt,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}var bx=0;function Rx(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function Ax(i){let t=new Tx,e=wx(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new R);let s=new R,r=new He,o=new He;function a(c){let h=0,f=0,u=0;for(let G=0;G<9;G++)n.probe[G].set(0,0,0);let d=0,g=0,v=0,m=0,p=0,y=0,T=0,_=0,A=0,w=0,x=0,S=0,I=0,b=0;c.sort(Rx);for(let G=0,K=c.length;G<K;G++){let D=c[G],z=D.color,Y=D.intensity,B=D.distance,H=null;if(D.shadow&&D.shadow.map&&(D.shadow.map.texture.format===Zi?H=D.shadow.map.texture:H=D.shadow.map.depthTexture||D.shadow.map.texture),D.isAmbientLight)h+=z.r*Y,f+=z.g*Y,u+=z.b*Y;else if(D.isLightProbe){for(let $=0;$<9;$++)n.probe[$].addScaledVector(D.sh.coefficients[$],Y);b++}else if(D.isSunLight){let $=t.get(D);if($.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){let Q=D.shadow,dt=e.get(D);dt.shadowIntensity=Q.intensity,dt.shadowBias=Q.bias,dt.shadowNormalBias=Q.normalBias,dt.shadowRadius=Q.radius,dt.shadowMapSize.copy(Q.mapSize).multiply(Q.getFrameExtents()),n.sunShadow[g]=dt,n.sunShadowMap[g]=H;let Ft=Q.getViewportCount();for(let qt=0;qt<Ft;qt++)n.sunShadowMatrix[v+qt]=Q.getMatrix(qt),n.sunShadowCascade[v+qt]=Q._cascadeData[qt];v+=Ft,g++}n.sun[d]=$,d++}else if(D.isDirectionalLight){let $=t.get(D);if($.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){let Q=D.shadow,dt=e.get(D);dt.shadowIntensity=Q.intensity,dt.shadowBias=Q.bias,dt.shadowNormalBias=Q.normalBias,dt.shadowRadius=Q.radius,dt.shadowMapSize=Q.mapSize,n.directionalShadow[m]=dt,n.directionalShadowMap[m]=H,n.directionalShadowMatrix[m]=D.shadow.matrix,A++}n.directional[m]=$,m++}else if(D.isSpotLight){let $=t.get(D);$.position.setFromMatrixPosition(D.matrixWorld),$.color.copy(z).multiplyScalar(Y),$.distance=B,$.coneCos=Math.cos(D.angle),$.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),$.decay=D.decay,n.spot[y]=$;let Q=D.shadow;if(D.map&&(n.spotLightMap[S]=D.map,S++,Q.updateMatrices(D),D.castShadow&&I++),n.spotLightMatrix[y]=Q.matrix,D.castShadow){let dt=e.get(D);dt.shadowIntensity=Q.intensity,dt.shadowBias=Q.bias,dt.shadowNormalBias=Q.normalBias,dt.shadowRadius=Q.radius,dt.shadowMapSize=Q.mapSize,n.spotShadow[y]=dt,n.spotShadowMap[y]=H,x++}y++}else if(D.isRectAreaLight){let $=t.get(D);$.color.copy(z).multiplyScalar(Y),$.halfWidth.set(D.width*.5,0,0),$.halfHeight.set(0,D.height*.5,0),n.rectArea[T]=$,T++}else if(D.isPointLight){let $=t.get(D);if($.color.copy(D.color).multiplyScalar(D.intensity),$.distance=D.distance,$.decay=D.decay,D.castShadow){let Q=D.shadow,dt=e.get(D);dt.shadowIntensity=Q.intensity,dt.shadowBias=Q.bias,dt.shadowNormalBias=Q.normalBias,dt.shadowRadius=Q.radius,dt.shadowMapSize=Q.mapSize,dt.shadowCameraNear=Q.camera.near,dt.shadowCameraFar=Q.camera.far,n.pointShadow[p]=dt,n.pointShadowMap[p]=H,n.pointShadowMatrix[p]=D.shadow.matrix,w++}n.point[p]=$,p++}else if(D.isHemisphereLight){let $=t.get(D);$.skyColor.copy(D.color).multiplyScalar(Y),$.groundColor.copy(D.groundColor).multiplyScalar(Y),n.hemi[_]=$,_++}}T>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=jt.LTC_FLOAT_1,n.rectAreaLTC2=jt.LTC_FLOAT_2):(n.rectAreaLTC1=jt.LTC_HALF_1,n.rectAreaLTC2=jt.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=f,n.ambient[2]=u;let N=n.hash;(N.sunLength!==d||N.directionalLength!==m||N.pointLength!==p||N.spotLength!==y||N.rectAreaLength!==T||N.hemiLength!==_||N.numSunShadows!==g||N.numDirectionalShadows!==A||N.numPointShadows!==w||N.numSpotShadows!==x||N.numSpotMaps!==S||N.numLightProbes!==b)&&(n.sun.length=d,n.directional.length=m,n.spot.length=y,n.rectArea.length=T,n.point.length=p,n.hemi.length=_,n.sunShadow.length=g,n.sunShadowMap.length=g,n.sunShadowMatrix.length=v,n.sunShadowCascade.length=v,n.directionalShadow.length=A,n.directionalShadowMap.length=A,n.directionalShadowMatrix.length=A,n.pointShadow.length=w,n.pointShadowMap.length=w,n.pointShadowMatrix.length=w,n.spotShadow.length=x,n.spotShadowMap.length=x,n.spotLightMatrix.length=x+S-I,n.spotLightMap.length=S,n.numSpotLightShadowsWithMaps=I,n.numLightProbes=b,N.sunLength=d,N.directionalLength=m,N.pointLength=p,N.spotLength=y,N.rectAreaLength=T,N.hemiLength=_,N.numSunShadows=g,N.numDirectionalShadows=A,N.numPointShadows=w,N.numSpotShadows=x,N.numSpotMaps=S,N.numLightProbes=b,n.version=bx++)}function l(c,h){let f=0,u=0,d=0,g=0,v=0,m=0,p=h.matrixWorldInverse;for(let y=0,T=c.length;y<T;y++){let _=c[y];if(_.isSunLight){let A=n.sun[f];A.direction.setFromMatrixPosition(_.matrixWorld),A.direction.transformDirection(p),f++}else if(_.isDirectionalLight){let A=n.directional[u];A.direction.setFromMatrixPosition(_.matrixWorld),s.setFromMatrixPosition(_.target.matrixWorld),A.direction.sub(s),A.direction.transformDirection(p),u++}else if(_.isSpotLight){let A=n.spot[g];A.position.setFromMatrixPosition(_.matrixWorld),A.position.applyMatrix4(p),A.direction.setFromMatrixPosition(_.matrixWorld),s.setFromMatrixPosition(_.target.matrixWorld),A.direction.sub(s),A.direction.transformDirection(p),g++}else if(_.isRectAreaLight){let A=n.rectArea[v];A.position.setFromMatrixPosition(_.matrixWorld),A.position.applyMatrix4(p),o.identity(),r.copy(_.matrixWorld),r.premultiply(p),o.extractRotation(r),A.halfWidth.set(_.width*.5,0,0),A.halfHeight.set(0,_.height*.5,0),A.halfWidth.applyMatrix4(o),A.halfHeight.applyMatrix4(o),v++}else if(_.isPointLight){let A=n.point[d];A.position.setFromMatrixPosition(_.matrixWorld),A.position.applyMatrix4(p),d++}else if(_.isHemisphereLight){let A=n.hemi[m];A.direction.setFromMatrixPosition(_.matrixWorld),A.direction.transformDirection(p),m++}}}return{setup:a,setupView:l,state:n}}function Xu(i){let t=new Ax(i),e=[],n=[],s=[];function r(f){h.camera=f,e.length=0,n.length=0,s.length=0}function o(f){f.isLightProbeGrid?s.push(f):e.push(f)}function a(f){n.push(f)}function l(){t.setup(e),s.sort((f,u)=>f.priority-u.priority||f.id-u.id)}function c(f){t.setupView(e,f)}let h={lightsArray:e,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:h,setupLights:l,setupLightsView:c,pushLight:o,pushShadow:a}}function Cx(i){let t=new WeakMap;function e(s,r=0){let o=t.get(s),a;return o===void 0?(a=new Xu(i),t.set(s,[a])):r>=o.length?(a=new Xu(i),o.push(a)):a=o[r],a}function n(){t=new WeakMap}return{get:e,dispose:n}}var Px=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Ix=`uniform sampler2D shadow_pass;
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
}`,Dx=[new R(1,0,0),new R(-1,0,0),new R(0,1,0),new R(0,-1,0),new R(0,0,1),new R(0,0,-1)],Lx=[new R(0,-1,0),new R(0,-1,0),new R(0,0,1),new R(0,0,-1),new R(0,-1,0),new R(0,-1,0)],qu=new He,io=new R,Uc=new R;function Nx(i,t,e){let n=new zi,s=new bt,r=new bt,o=new Ke,a=new ua,l=new da,c={},h=e.maxTextureSize,f={[Kn]:vn,[vn]:Kn,[Re]:Re},u=new Xe({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new bt},radius:{value:4}},vertexShader:Px,fragmentShader:Ix}),d=u.clone();d.defines.HORIZONTAL_PASS=1;let g=new qe;g.setAttribute("position",new Pn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let v=new P(g,u),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=fs;let p=this.type;this.render=function(w,x,S){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||w.length===0)return;this.type===Uh&&(pe("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=fs);let I=i.getRenderTarget(),b=i.getActiveCubeFace(),N=i.getActiveMipmapLevel(),G=i.state;G.setBlending(ps),G.buffers.depth.getReversed()===!0?G.buffers.color.setClear(0,0,0,0):G.buffers.color.setClear(1,1,1,1),G.buffers.depth.setTest(!0),G.setScissorTest(!1);let K=p!==this.type;K&&x.traverse(function(D){D.material&&(Array.isArray(D.material)?D.material.forEach(z=>z.needsUpdate=!0):D.material.needsUpdate=!0)});for(let D=0,z=w.length;D<z;D++){let Y=w[D],B=Y.shadow;if(B===void 0){pe("WebGLShadowMap:",Y,"has no shadow.");continue}if(B.autoUpdate===!1&&B.needsUpdate===!1)continue;s.copy(B.mapSize);let H=B.getFrameExtents();s.multiply(H),r.copy(B.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/H.x),s.x=r.x*H.x,B.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/H.y),s.y=r.y*H.y,B.mapSize.y=r.y));let $=i.state.buffers.depth.getReversed();if(B.camera._reversedDepth=$,B.map===null||K===!0){if(B.map!==null&&(B.map.depthTexture!==null&&(B.map.depthTexture.dispose(),B.map.depthTexture=null),B.map.dispose()),this.type===Ks){if(Y.isPointLight){pe("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}B.map=new gn(s.x,s.y,{format:Zi,type:Wn,minFilter:Qe,magFilter:Qe,generateMipmaps:!1}),B.map.texture.name=Y.name+".shadowMap",B.map.depthTexture=new Ri(s.x,s.y,jn),B.map.depthTexture.name=Y.name+".shadowMapDepth",B.map.depthTexture.format=Ti,B.map.depthTexture.compareFunction=null,B.map.depthTexture.minFilter=nn,B.map.depthTexture.magFilter=nn}else Y.isPointLight?(B.map=new ro(s.x),B.map.depthTexture=new Ar(s.x,si)):(B.map=new gn(s.x,s.y),B.map.depthTexture=new Ri(s.x,s.y,si)),B.map.depthTexture.name=Y.name+".shadowMap",B.map.depthTexture.format=Ti,this.type===fs?(B.map.depthTexture.compareFunction=$?Mc:Ec,B.map.depthTexture.minFilter=Qe,B.map.depthTexture.magFilter=Qe):(B.map.depthTexture.compareFunction=null,B.map.depthTexture.minFilter=nn,B.map.depthTexture.magFilter=nn);B.camera.updateProjectionMatrix()}B.map.isWebGLCubeRenderTarget!==!0&&(B.map.width!==s.x||B.map.height!==s.y)&&B.map.setSize(s.x,s.y);let Q=B.map.isWebGLCubeRenderTarget?6:B.getViewportCount();Y.isPointLight!==!0&&B.updateMatrices(Y,S);let dt=(B.camera.layers.mask&4294967294)!==0?B.camera.layers:S.layers;for(let Ft=0;Ft<Q;Ft++){let qt=B.getCamera(Ft);if(Y.isPointLight){let O=B.camera,xt=B.matrix,tt=Y.distance||O.far;tt!==O.far&&(O.far=tt,O.updateProjectionMatrix()),io.setFromMatrixPosition(Y.matrixWorld),O.position.copy(io),Uc.copy(O.position),Uc.add(Dx[Ft]),O.up.copy(Lx[Ft]),O.lookAt(Uc),O.updateMatrixWorld(),xt.makeTranslation(-io.x,-io.y,-io.z),qu.multiplyMatrices(O.projectionMatrix,O.matrixWorldInverse),B._frustum.setFromProjectionMatrix(qu,O.coordinateSystem,O.reversedDepth)}if(B.map.isWebGLCubeRenderTarget)i.setRenderTarget(B.map,Ft),i.clear();else{Ft===0&&(i.setRenderTarget(B.map),i.clear());let O=B.getViewport(Ft);o.set(r.x*O.x,r.y*O.y,r.x*O.z,r.y*O.w),G.viewport(o)}n=B.getFrustum(Ft),_(x,S,qt,Y,dt,this.type)}B.isPointLightShadow!==!0&&this.type===Ks&&y(B,S),B.needsUpdate=!1}p=this.type,m.needsUpdate=!1,i.setRenderTarget(I,b,N)};function y(w,x){let S=t.update(v);u.defines.VSM_SAMPLES!==w.blurSamples&&(u.defines.VSM_SAMPLES=w.blurSamples,d.defines.VSM_SAMPLES=w.blurSamples,u.needsUpdate=!0,d.needsUpdate=!0),w.mapPass===null?w.mapPass=new gn(s.x,s.y,{format:Zi,type:Wn}):(w.mapPass.width!==w.map.width||w.mapPass.height!==w.map.height)&&w.mapPass.setSize(w.map.width,w.map.height),u.uniforms.shadow_pass.value=w.map.depthTexture,u.uniforms.resolution.value.set(w.map.width,w.map.height),u.uniforms.radius.value=w.radius,i.setRenderTarget(w.mapPass),i.clear(),i.renderBufferDirect(x,null,S,u,v,null),d.uniforms.shadow_pass.value=w.mapPass.texture,d.uniforms.resolution.value.set(w.map.width,w.map.height),d.uniforms.radius.value=w.radius,i.setRenderTarget(w.map),i.clear(),i.renderBufferDirect(x,null,S,d,v,null)}function T(w,x,S,I){let b=null,N=S.isPointLight===!0?w.customDistanceMaterial:w.customDepthMaterial;if(N!==void 0)b=N;else if(b=S.isPointLight===!0?l:a,i.localClippingEnabled&&x.clipShadows===!0&&Array.isArray(x.clippingPlanes)&&x.clippingPlanes.length!==0||x.displacementMap&&x.displacementScale!==0||x.alphaMap&&x.alphaTest>0||x.map&&x.alphaTest>0||x.alphaToCoverage===!0){let G=b.uuid,K=x.uuid,D=c[G];D===void 0&&(D={},c[G]=D);let z=D[K];z===void 0&&(z=b.clone(),D[K]=z,x.addEventListener("dispose",A)),b=z}if(b.visible=x.visible,b.wireframe=x.wireframe,I===Ks?b.side=x.shadowSide!==null?x.shadowSide:x.side:b.side=x.shadowSide!==null?x.shadowSide:f[x.side],b.alphaMap=x.alphaMap,b.alphaTest=x.alphaToCoverage===!0?.5:x.alphaTest,b.map=x.map,b.clipShadows=x.clipShadows,b.clippingPlanes=x.clippingPlanes,b.clipIntersection=x.clipIntersection,b.displacementMap=x.displacementMap,b.displacementScale=x.displacementScale,b.displacementBias=x.displacementBias,b.wireframeLinewidth=x.wireframeLinewidth,b.linewidth=x.linewidth,S.isPointLight===!0&&b.isMeshDistanceMaterial===!0){let G=i.properties.get(b);G.light=S}return b}function _(w,x,S,I,b,N){if(w.visible===!1)return;if(w.layers.test(b)&&(w.isMesh||w.isLine||w.isPoints)&&(w.castShadow||w.receiveShadow&&N===Ks)&&(!w.frustumCulled||w.intersectsFrustum(n))){w.modelViewMatrix.multiplyMatrices(S.matrixWorldInverse,w.matrixWorld);let D=t.update(w),z=w.material;if(Array.isArray(z)){let Y=D.groups;for(let B=0,H=Y.length;B<H;B++){let $=Y[B],Q=z[$.materialIndex];if(Q&&Q.visible){let dt=T(w,Q,I,N);w.onBeforeShadow(i,w,x,S,D,dt,$),i.renderBufferDirect(S,null,D,dt,w,$),w.onAfterShadow(i,w,x,S,D,dt,$)}}}else if(z.visible){let Y=T(w,z,I,N);w.onBeforeShadow(i,w,x,S,D,Y,null),i.renderBufferDirect(S,null,D,Y,w,null),w.onAfterShadow(i,w,x,S,D,Y,null)}}let K=w.children;for(let D=0,z=K.length;D<z;D++)_(K[D],x,S,I,b,N)}function A(w){w.target.removeEventListener("dispose",A);for(let S in c){let I=c[S],b=w.target.uuid;b in I&&(I[b].dispose(),delete I[b])}}}function Ux(i,t){function e(){let L=!1,ct=new Ke,it=null,Pt=new Ke(0,0,0,0);return{setMask:function(wt){it!==wt&&!L&&(i.colorMask(wt,wt,wt,wt),it=wt)},setLocked:function(wt){L=wt},setClear:function(wt,Et,Vt,he,Tt){Tt===!0&&(wt*=he,Et*=he,Vt*=he),ct.set(wt,Et,Vt,he),Pt.equals(ct)===!1&&(i.clearColor(wt,Et,Vt,he),Pt.copy(ct))},reset:function(){L=!1,it=null,Pt.set(-1,0,0,0)}}}function n(){let L=!1,ct=!1,it=null,Pt=null,wt=null;return{setReversed:function(Et){if(ct!==Et){let Vt=t.get("EXT_clip_control");Et?Vt.clipControlEXT(Vt.LOWER_LEFT_EXT,Vt.ZERO_TO_ONE_EXT):Vt.clipControlEXT(Vt.LOWER_LEFT_EXT,Vt.NEGATIVE_ONE_TO_ONE_EXT),ct=Et;let he=wt;wt=null,this.setClear(he)}},getReversed:function(){return ct},setTest:function(Et){Et?pt(i.DEPTH_TEST):at(i.DEPTH_TEST)},setMask:function(Et){it!==Et&&!L&&(i.depthMask(Et),it=Et)},setFunc:function(Et){if(ct&&(Et=mu[Et]),Pt!==Et){switch(Et){case zo:i.depthFunc(i.NEVER);break;case ko:i.depthFunc(i.ALWAYS);break;case Vo:i.depthFunc(i.LESS);break;case Bs:i.depthFunc(i.LEQUAL);break;case Wo:i.depthFunc(i.EQUAL);break;case Xo:i.depthFunc(i.GEQUAL);break;case qo:i.depthFunc(i.GREATER);break;case Yo:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}Pt=Et}},setLocked:function(Et){L=Et},setClear:function(Et){wt!==Et&&(wt=Et,ct&&(Et=1-Et),i.clearDepth(Et))},reset:function(){L=!1,it=null,Pt=null,wt=null,ct=!1}}}function s(){let L=!1,ct=null,it=null,Pt=null,wt=null,Et=null,Vt=null,he=null,Tt=null;return{setTest:function(Qt){L||(Qt?pt(i.STENCIL_TEST):at(i.STENCIL_TEST))},setMask:function(Qt){ct!==Qt&&!L&&(i.stencilMask(Qt),ct=Qt)},setFunc:function(Qt,re,kt){(it!==Qt||Pt!==re||wt!==kt)&&(i.stencilFunc(Qt,re,kt),it=Qt,Pt=re,wt=kt)},setOp:function(Qt,re,kt){(Et!==Qt||Vt!==re||he!==kt)&&(i.stencilOp(Qt,re,kt),Et=Qt,Vt=re,he=kt)},setLocked:function(Qt){L=Qt},setClear:function(Qt){Tt!==Qt&&(i.clearStencil(Qt),Tt=Qt)},reset:function(){L=!1,ct=null,it=null,Pt=null,wt=null,Et=null,Vt=null,he=null,Tt=null}}}let r=new e,o=new n,a=new s,l={},c=new WeakMap,h={},f={},u={},d=new WeakMap,g=[],v=null,m=!1,p=null,y=null,T=null,_=null,A=null,w=null,x=null,S=new fe(0,0,0),I=0,b=!1,N=null,G=null,K=null,D=null,z=null,Y=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),B=!1,H=0,$=i.getParameter(i.VERSION);$.indexOf("WebGL")!==-1?(H=parseFloat(/^WebGL (\d)/.exec($)[1]),B=H>=1):$.indexOf("OpenGL ES")!==-1&&(H=parseFloat(/^OpenGL ES (\d)/.exec($)[1]),B=H>=2);let Q=null,dt={},Ft=i.getParameter(i.SCISSOR_BOX),qt=i.getParameter(i.VIEWPORT),O=new Ke().fromArray(Ft),xt=new Ke().fromArray(qt);function tt(L,ct,it,Pt){let wt=new Uint8Array(4),Et=i.createTexture();i.bindTexture(L,Et),i.texParameteri(L,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(L,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Vt=0;Vt<it;Vt++)L===i.TEXTURE_3D||L===i.TEXTURE_2D_ARRAY?i.texImage3D(ct,0,i.RGBA,1,1,Pt,0,i.RGBA,i.UNSIGNED_BYTE,wt):i.texImage2D(ct+Vt,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,wt);return Et}let st={};st[i.TEXTURE_2D]=tt(i.TEXTURE_2D,i.TEXTURE_2D,1),st[i.TEXTURE_CUBE_MAP]=tt(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),st[i.TEXTURE_2D_ARRAY]=tt(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),st[i.TEXTURE_3D]=tt(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),pt(i.DEPTH_TEST),o.setFunc(Bs),At(!1),_t(ec),pt(i.CULL_FACE),rt(ps);function pt(L){h[L]!==!0&&(i.enable(L),h[L]=!0)}function at(L){h[L]!==!1&&(i.disable(L),h[L]=!1)}function ee(L,ct){return u[L]!==ct?(i.bindFramebuffer(L,ct),u[L]=ct,L===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=ct),L===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=ct),!0):!1}function Mt(L,ct){let it=g,Pt=!1;if(L){it=d.get(ct),it===void 0&&(it=[],d.set(ct,it));let wt=L.textures;if(it.length!==wt.length||it[0]!==i.COLOR_ATTACHMENT0){for(let Et=0,Vt=wt.length;Et<Vt;Et++)it[Et]=i.COLOR_ATTACHMENT0+Et;it.length=wt.length,Pt=!0}}else it[0]!==i.BACK&&(it[0]=i.BACK,Pt=!0);Pt&&i.drawBuffers(it)}function $t(L){return v!==L?(i.useProgram(L),v=L,!0):!1}let lt={[ms]:i.FUNC_ADD,[Oh]:i.FUNC_SUBTRACT,[Bh]:i.FUNC_REVERSE_SUBTRACT};lt[Hh]=i.MIN,lt[Gh]=i.MAX;let k={[zh]:i.ZERO,[kh]:i.ONE,[Vh]:i.SRC_COLOR,[sc]:i.SRC_ALPHA,[Jh]:i.SRC_ALPHA_SATURATE,[Yh]:i.DST_COLOR,[Xh]:i.DST_ALPHA,[Wh]:i.ONE_MINUS_SRC_COLOR,[rc]:i.ONE_MINUS_SRC_ALPHA,[Zh]:i.ONE_MINUS_DST_COLOR,[qh]:i.ONE_MINUS_DST_ALPHA,[Kh]:i.CONSTANT_COLOR,[$h]:i.ONE_MINUS_CONSTANT_COLOR,[jh]:i.CONSTANT_ALPHA,[Qh]:i.ONE_MINUS_CONSTANT_ALPHA};function rt(L,ct,it,Pt,wt,Et,Vt,he,Tt,Qt){if(L===ps){m===!0&&(at(i.BLEND),m=!1);return}if(m===!1&&(pt(i.BLEND),m=!0),L!==Fh){if(L!==p||Qt!==b){if((y!==ms||A!==ms)&&(i.blendEquation(i.FUNC_ADD),y=ms,A=ms),Qt)switch(L){case Yi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Zr:i.blendFunc(i.ONE,i.ONE);break;case nc:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case ic:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:Ee("WebGLState: Invalid blending: ",L);break}else switch(L){case Yi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Zr:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case nc:Ee("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case ic:Ee("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ee("WebGLState: Invalid blending: ",L);break}T=null,_=null,w=null,x=null,S.set(0,0,0),I=0,p=L,b=Qt}return}wt=wt||ct,Et=Et||it,Vt=Vt||Pt,(ct!==y||wt!==A)&&(i.blendEquationSeparate(lt[ct],lt[wt]),y=ct,A=wt),(it!==T||Pt!==_||Et!==w||Vt!==x)&&(i.blendFuncSeparate(k[it],k[Pt],k[Et],k[Vt]),T=it,_=Pt,w=Et,x=Vt),(he.equals(S)===!1||Tt!==I)&&(i.blendColor(he.r,he.g,he.b,Tt),S.copy(he),I=Tt),p=L,b=!1}function ft(L,ct){L.side===Re?at(i.CULL_FACE):pt(i.CULL_FACE);let it=L.side===vn;ct&&(it=!it),At(it),L.blending===Yi&&L.transparent===!1?rt(ps):rt(L.blending,L.blendEquation,L.blendSrc,L.blendDst,L.blendEquationAlpha,L.blendSrcAlpha,L.blendDstAlpha,L.blendColor,L.blendAlpha,L.premultipliedAlpha),o.setFunc(L.depthFunc),o.setTest(L.depthTest),o.setMask(L.depthWrite),r.setMask(L.colorWrite);let Pt=L.stencilWrite;a.setTest(Pt),Pt&&(a.setMask(L.stencilWriteMask),a.setFunc(L.stencilFunc,L.stencilRef,L.stencilFuncMask),a.setOp(L.stencilFail,L.stencilZFail,L.stencilZPass)),Gt(L.polygonOffset,L.polygonOffsetFactor,L.polygonOffsetUnits),L.alphaToCoverage===!0?pt(i.SAMPLE_ALPHA_TO_COVERAGE):at(i.SAMPLE_ALPHA_TO_COVERAGE)}function At(L){N!==L&&(L?i.frontFace(i.CW):i.frontFace(i.CCW),N=L)}function _t(L){L!==Lh?(pt(i.CULL_FACE),L!==G&&(L===ec?i.cullFace(i.BACK):L===Nh?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):at(i.CULL_FACE),G=L}function St(L){L!==K&&(B&&i.lineWidth(L),K=L)}function Gt(L,ct,it){L?(pt(i.POLYGON_OFFSET_FILL),(D!==ct||z!==it)&&(D=ct,z=it,o.getReversed()&&(ct=-ct,it=-it),i.polygonOffset(ct,it))):at(i.POLYGON_OFFSET_FILL)}function Zt(L){L?pt(i.SCISSOR_TEST):at(i.SCISSOR_TEST)}function ie(L){L===void 0&&(L=i.TEXTURE0+Y-1),Q!==L&&(i.activeTexture(L),Q=L)}function Xt(L,ct,it){it===void 0&&(Q===null?it=i.TEXTURE0+Y-1:it=Q);let Pt=dt[it];Pt===void 0&&(Pt={type:void 0,texture:void 0},dt[it]=Pt),(Pt.type!==L||Pt.texture!==ct)&&(Q!==it&&(i.activeTexture(it),Q=it),i.bindTexture(L,ct||st[L]),Pt.type=L,Pt.texture=ct)}function U(){let L=dt[Q];L!==void 0&&L.type!==void 0&&(i.bindTexture(L.type,null),L.type=void 0,L.texture=void 0)}function Pe(){try{i.compressedTexImage2D(...arguments)}catch(L){Ee("WebGLState:",L)}}function oe(){try{i.compressedTexImage3D(...arguments)}catch(L){Ee("WebGLState:",L)}}function Ae(){try{i.texSubImage2D(...arguments)}catch(L){Ee("WebGLState:",L)}}function Lt(){try{i.texSubImage3D(...arguments)}catch(L){Ee("WebGLState:",L)}}function Me(){try{i.compressedTexSubImage2D(...arguments)}catch(L){Ee("WebGLState:",L)}}function Kt(){try{i.compressedTexSubImage3D(...arguments)}catch(L){Ee("WebGLState:",L)}}function se(){try{i.texStorage2D(...arguments)}catch(L){Ee("WebGLState:",L)}}function C(){try{i.texStorage3D(...arguments)}catch(L){Ee("WebGLState:",L)}}function E(){try{i.texImage2D(...arguments)}catch(L){Ee("WebGLState:",L)}}function W(){try{i.texImage3D(...arguments)}catch(L){Ee("WebGLState:",L)}}function yt(L){return f[L]!==void 0?f[L]:i.getParameter(L)}function ut(L,ct){f[L]!==ct&&(i.pixelStorei(L,ct),f[L]=ct)}function nt(L){O.equals(L)===!1&&(i.scissor(L.x,L.y,L.z,L.w),O.copy(L))}function et(L){xt.equals(L)===!1&&(i.viewport(L.x,L.y,L.z,L.w),xt.copy(L))}function J(L,ct){let it=c.get(ct);it===void 0&&(it=new WeakMap,c.set(ct,it));let Pt=it.get(L);Pt===void 0&&(Pt=i.getUniformBlockIndex(ct,L.name),i.uniformBlockBinding(ct,Pt,Pt),it.set(L,Pt))}function ot(L,ct,it){let wt=c.get(ct).get(L);l[wt]!==it&&(i.bindBufferBase(i.UNIFORM_BUFFER,wt,it),l[wt]=it)}function mt(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),h={},f={},Q=null,dt={},u={},l={},d=new WeakMap,g=[],v=null,m=!1,p=null,y=null,T=null,_=null,A=null,w=null,x=null,S=new fe(0,0,0),I=0,b=!1,N=null,G=null,K=null,D=null,z=null,O.set(0,0,i.canvas.width,i.canvas.height),xt.set(0,0,i.canvas.width,i.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:pt,disable:at,bindFramebuffer:ee,drawBuffers:Mt,useProgram:$t,setBlending:rt,setMaterial:ft,setFlipSided:At,setCullFace:_t,setLineWidth:St,setPolygonOffset:Gt,setScissorTest:Zt,activeTexture:ie,bindTexture:Xt,unbindTexture:U,compressedTexImage2D:Pe,compressedTexImage3D:oe,texImage2D:E,texImage3D:W,pixelStorei:ut,getParameter:yt,updateUBOMapping:J,uniformBlockBinding:ot,texStorage2D:se,texStorage3D:C,texSubImage2D:Ae,texSubImage3D:Lt,compressedTexSubImage2D:Me,compressedTexSubImage3D:Kt,scissor:nt,viewport:et,reset:mt}}function Fx(i,t,e,n,s,r,o){let a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new bt,h=new WeakMap,f=new Set,u,d=new WeakMap,g=new Set,v=new FinalizationRegistry(C=>g.delete(C)),m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function p(C,E){return m?new OffscreenCanvas(C,E):_r("canvas")}function y(C,E,W){let yt=1,ut=se(C);if((ut.width>W||ut.height>W)&&(yt=W/Math.max(ut.width,ut.height)),yt<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){let nt=Math.floor(yt*ut.width),et=Math.floor(yt*ut.height);u===void 0&&(u=p(nt,et));let J=E?p(nt,et):u;return J.width=nt,J.height=et,J.getContext("2d").drawImage(C,0,0,nt,et),pe("WebGLRenderer: Texture has been resized from ("+ut.width+"x"+ut.height+") to ("+nt+"x"+et+")."),J}else return"data"in C&&pe("WebGLRenderer: Image in DataTexture is too big ("+ut.width+"x"+ut.height+")."),C;return C}function T(C){return C.generateMipmaps}function _(C){i.generateMipmap(C)}function A(C){return C.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:C.isWebGL3DRenderTarget?i.TEXTURE_3D:C.isWebGLArrayRenderTarget||C.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function w(C,E,W,yt,ut,nt=!1){if(C!==null){if(i[C]!==void 0)return i[C];pe("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let et;yt&&(et=t.get("EXT_texture_norm16"),et||pe("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let J=E;if(E===i.RED&&(W===i.FLOAT&&(J=i.R32F),W===i.HALF_FLOAT&&(J=i.R16F),W===i.UNSIGNED_BYTE&&(J=i.R8),W===i.UNSIGNED_SHORT&&et&&(J=et.R16_EXT),W===i.SHORT&&et&&(J=et.R16_SNORM_EXT)),E===i.RED_INTEGER&&(W===i.UNSIGNED_BYTE&&(J=i.R8UI),W===i.UNSIGNED_SHORT&&(J=i.R16UI),W===i.UNSIGNED_INT&&(J=i.R32UI),W===i.BYTE&&(J=i.R8I),W===i.SHORT&&(J=i.R16I),W===i.INT&&(J=i.R32I)),E===i.RG&&(W===i.FLOAT&&(J=i.RG32F),W===i.HALF_FLOAT&&(J=i.RG16F),W===i.UNSIGNED_BYTE&&(J=i.RG8),W===i.UNSIGNED_SHORT&&et&&(J=et.RG16_EXT),W===i.SHORT&&et&&(J=et.RG16_SNORM_EXT)),E===i.RG_INTEGER&&(W===i.UNSIGNED_BYTE&&(J=i.RG8UI),W===i.UNSIGNED_SHORT&&(J=i.RG16UI),W===i.UNSIGNED_INT&&(J=i.RG32UI),W===i.BYTE&&(J=i.RG8I),W===i.SHORT&&(J=i.RG16I),W===i.INT&&(J=i.RG32I)),E===i.RGB_INTEGER&&(W===i.UNSIGNED_BYTE&&(J=i.RGB8UI),W===i.UNSIGNED_SHORT&&(J=i.RGB16UI),W===i.UNSIGNED_INT&&(J=i.RGB32UI),W===i.BYTE&&(J=i.RGB8I),W===i.SHORT&&(J=i.RGB16I),W===i.INT&&(J=i.RGB32I)),E===i.RGBA_INTEGER&&(W===i.UNSIGNED_BYTE&&(J=i.RGBA8UI),W===i.UNSIGNED_SHORT&&(J=i.RGBA16UI),W===i.UNSIGNED_INT&&(J=i.RGBA32UI),W===i.BYTE&&(J=i.RGBA8I),W===i.SHORT&&(J=i.RGBA16I),W===i.INT&&(J=i.RGBA32I)),E===i.RGB&&(W===i.UNSIGNED_SHORT&&et&&(J=et.RGB16_EXT),W===i.SHORT&&et&&(J=et.RGB16_SNORM_EXT),W===i.UNSIGNED_INT_5_9_9_9_REV&&(J=i.RGB9_E5),W===i.UNSIGNED_INT_10F_11F_11F_REV&&(J=i.R11F_G11F_B10F)),E===i.RGBA){let ot=nt?xr:Ne.getTransfer(ut);W===i.FLOAT&&(J=i.RGBA32F),W===i.HALF_FLOAT&&(J=i.RGBA16F),W===i.UNSIGNED_BYTE&&(J=ot===Ve?i.SRGB8_ALPHA8:i.RGBA8),W===i.UNSIGNED_SHORT&&et&&(J=et.RGBA16_EXT),W===i.SHORT&&et&&(J=et.RGBA16_SNORM_EXT),W===i.UNSIGNED_SHORT_4_4_4_4&&(J=i.RGBA4),W===i.UNSIGNED_SHORT_5_5_5_1&&(J=i.RGB5_A1)}return(J===i.R16F||J===i.R32F||J===i.RG16F||J===i.RG32F||J===i.RGBA16F||J===i.RGBA32F)&&t.get("EXT_color_buffer_float"),J}function x(C,E){let W;return C?E===null||E===si||E===xs?W=i.DEPTH24_STENCIL8:E===jn?W=i.DEPTH32F_STENCIL8:E===js&&(W=i.DEPTH24_STENCIL8,pe("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):E===null||E===si||E===xs?W=i.DEPTH_COMPONENT24:E===jn?W=i.DEPTH_COMPONENT32F:E===js&&(W=i.DEPTH_COMPONENT16),W}function S(C,E){return T(C)===!0||C.isFramebufferTexture&&C.minFilter!==nn&&C.minFilter!==Qe?Math.log2(Math.max(E.width,E.height))+1:C.mipmaps.length>0?C.mipmaps.length:C.isCompressedTexture&&Array.isArray(C.image)?E.mipmaps.length:1}function I(C){let E=new WeakRef(C);n.get(C).__ref=E,g.add(E),v.register(C,E,E)}function b(C){let E=n.get(C).__ref;E!==void 0&&(g.delete(E),v.unregister(E))}function N(C){K(C.target)}function G(C){D(C.target)}function K(C){C.removeEventListener("dispose",N),b(C),Y(C),C.isVideoTexture&&h.delete(C),C.isHTMLTexture&&f.delete(C)}function D(C){C.removeEventListener("dispose",G),b(C),H(C)}function z(){for(let C of g){let E=C.deref();E!==void 0&&(E.isRenderTarget===!0?D(E):K(E))}g.clear(),f.clear()}function Y(C){let E=n.get(C);if(E.__webglInit===void 0)return;let W=C.source,yt=d.get(W);if(yt){let ut=yt[E.__cacheKey];ut.usedTimes--,ut.usedTimes===0&&B(C),Object.keys(yt).length===0&&d.delete(W)}n.remove(C)}function B(C){let E=n.get(C);i.deleteTexture(E.__webglTexture);let W=C.source,yt=d.get(W);delete yt[E.__cacheKey],o.memory.textures--}function H(C){let E=n.get(C);E.__depthDisposeCallback&&E.__depthDisposeCallback();let W=C.depthTexture;if(W&&W.renderTarget===C&&K(W),C.isWebGLCubeRenderTarget)for(let ut=0;ut<6;ut++){if(Array.isArray(E.__webglFramebuffer[ut]))for(let nt=0;nt<E.__webglFramebuffer[ut].length;nt++)i.deleteFramebuffer(E.__webglFramebuffer[ut][nt]);else i.deleteFramebuffer(E.__webglFramebuffer[ut]);E.__webglDepthbuffer&&i.deleteRenderbuffer(E.__webglDepthbuffer[ut])}else{if(Array.isArray(E.__webglFramebuffer))for(let ut=0;ut<E.__webglFramebuffer.length;ut++)i.deleteFramebuffer(E.__webglFramebuffer[ut]);else i.deleteFramebuffer(E.__webglFramebuffer);if(E.__webglDepthbuffer&&i.deleteRenderbuffer(E.__webglDepthbuffer),E.__webglMultisampledFramebuffer&&i.deleteFramebuffer(E.__webglMultisampledFramebuffer),E.__webglColorRenderbuffer)for(let ut=0;ut<E.__webglColorRenderbuffer.length;ut++)E.__webglColorRenderbuffer[ut]&&i.deleteRenderbuffer(E.__webglColorRenderbuffer[ut]);E.__webglDepthRenderbuffer&&i.deleteRenderbuffer(E.__webglDepthRenderbuffer)}let yt=C.textures;for(let ut=0,nt=yt.length;ut<nt;ut++){let et=n.get(yt[ut]);et.__webglTexture&&(i.deleteTexture(et.__webglTexture),o.memory.textures--),n.remove(yt[ut])}n.remove(C)}let $=0;function Q(){$=0}function dt(){return $}function Ft(C){$=C}function qt(){let C=$;return C>=s.maxTextures&&pe("WebGLTextures: Trying to use "+(C+1)+" texture units while this GPU supports only "+s.maxTextures),$+=1,C}function O(C){let E=[];return E.push(C.wrapS),E.push(C.wrapT),E.push(C.wrapR||0),E.push(C.magFilter),E.push(C.minFilter),E.push(C.anisotropy),E.push(C.internalFormat),E.push(C.format),E.push(C.type),E.push(C.generateMipmaps),E.push(C.mipmapsAutoUpdate),E.push(C.premultiplyAlpha),E.push(C.flipY),E.push(C.unpackAlignment),E.push(C.colorSpace),E.join()}function xt(C,E){let W=n.get(C);if(C.isVideoTexture&&Me(C),C.isRenderTargetTexture===!1&&C.isExternalTexture!==!0&&C.version>0&&W.__version!==C.version){let yt=C.image;if(yt===null)pe("WebGLRenderer: Texture marked for update but no image data found.");else if(yt.complete===!1)pe("WebGLRenderer: Texture marked for update but image is incomplete");else{ft(W,C,E);return}}else C.isExternalTexture&&(W.__webglTexture=C.sourceTexture?C.sourceTexture:null);e.bindTexture(i.TEXTURE_2D,W.__webglTexture,i.TEXTURE0+E)}function tt(C,E){let W=n.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&W.__version!==C.version){ft(W,C,E);return}else C.isExternalTexture&&(W.__webglTexture=C.sourceTexture?C.sourceTexture:null);e.bindTexture(i.TEXTURE_2D_ARRAY,W.__webglTexture,i.TEXTURE0+E)}function st(C,E){let W=n.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&W.__version!==C.version){ft(W,C,E);return}e.bindTexture(i.TEXTURE_3D,W.__webglTexture,i.TEXTURE0+E)}function pt(C,E){let W=n.get(C);if(C.version>0&&W.__version!==C.version){At(W,C,E);return}e.bindTexture(i.TEXTURE_CUBE_MAP,W.__webglTexture,i.TEXTURE0+E)}let at={[is]:i.REPEAT,[ci]:i.CLAMP_TO_EDGE,[Zo]:i.MIRRORED_REPEAT},ee={[nn]:i.NEAREST,[nu]:i.NEAREST_MIPMAP_NEAREST,[Jr]:i.NEAREST_MIPMAP_LINEAR,[Qe]:i.LINEAR,[ba]:i.LINEAR_MIPMAP_NEAREST,[Ci]:i.LINEAR_MIPMAP_LINEAR},Mt={[ou]:i.NEVER,[Sc]:i.ALWAYS,[au]:i.LESS,[Ec]:i.LEQUAL,[lu]:i.EQUAL,[Mc]:i.GEQUAL,[cu]:i.GREATER,[hu]:i.NOTEQUAL};function $t(C,E){if(E.type===jn&&t.has("OES_texture_float_linear")===!1&&(E.magFilter===Qe||E.magFilter===ba||E.magFilter===Jr||E.magFilter===Ci||E.minFilter===Qe||E.minFilter===ba||E.minFilter===Jr||E.minFilter===Ci)&&pe("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(C,i.TEXTURE_WRAP_S,at[E.wrapS]),i.texParameteri(C,i.TEXTURE_WRAP_T,at[E.wrapT]),(C===i.TEXTURE_3D||C===i.TEXTURE_2D_ARRAY)&&i.texParameteri(C,i.TEXTURE_WRAP_R,at[E.wrapR]),i.texParameteri(C,i.TEXTURE_MAG_FILTER,ee[E.magFilter]),i.texParameteri(C,i.TEXTURE_MIN_FILTER,ee[E.minFilter]),E.compareFunction&&(i.texParameteri(C,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(C,i.TEXTURE_COMPARE_FUNC,Mt[E.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(E.magFilter===nn||E.minFilter!==Jr&&E.minFilter!==Ci||E.type===jn&&t.has("OES_texture_float_linear")===!1)return;if(E.anisotropy>1||n.get(E).__currentAnisotropy){let W=t.get("EXT_texture_filter_anisotropic");i.texParameterf(C,W.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(E.anisotropy,s.getMaxAnisotropy())),n.get(E).__currentAnisotropy=E.anisotropy}}}function lt(C,E){let W=!1;C.__webglInit===void 0&&(C.__webglInit=!0,E.addEventListener("dispose",N),I(E));let yt=E.source,ut=d.get(yt);ut===void 0&&(ut={},d.set(yt,ut));let nt=O(E);if(nt!==C.__cacheKey){ut[nt]===void 0&&(ut[nt]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,W=!0),ut[nt].usedTimes++;let et=ut[C.__cacheKey];et!==void 0&&(ut[C.__cacheKey].usedTimes--,et.usedTimes===0&&B(E)),C.__cacheKey=nt,C.__webglTexture=ut[nt].texture}return W}function k(C,E,W){return Math.floor(Math.floor(C/W)/E)}function rt(C,E,W,yt){let nt=C.updateRanges;if(nt.length===0)e.texSubImage2D(i.TEXTURE_2D,0,0,0,E.width,E.height,W,yt,E.data);else{nt.sort((L,ct)=>L.start-ct.start);let et=0;for(let L=1;L<nt.length;L++){let ct=nt[et],it=nt[L],Pt=ct.start+ct.count,wt=k(it.start,E.width,4),Et=k(ct.start,E.width,4);it.start<=Pt+1&&wt===Et&&k(it.start+it.count-1,E.width,4)===wt?ct.count=Math.max(ct.count,it.start+it.count-ct.start):(++et,nt[et]=it)}nt.length=et+1;let J=e.getParameter(i.UNPACK_ROW_LENGTH),ot=e.getParameter(i.UNPACK_SKIP_PIXELS),mt=e.getParameter(i.UNPACK_SKIP_ROWS);e.pixelStorei(i.UNPACK_ROW_LENGTH,E.width);for(let L=0,ct=nt.length;L<ct;L++){let it=nt[L],Pt=Math.floor(it.start/4),wt=Math.ceil(it.count/4),Et=Pt%E.width,Vt=Math.floor(Pt/E.width),he=wt,Tt=1;e.pixelStorei(i.UNPACK_SKIP_PIXELS,Et),e.pixelStorei(i.UNPACK_SKIP_ROWS,Vt),e.texSubImage2D(i.TEXTURE_2D,0,Et,Vt,he,Tt,W,yt,E.data)}C.clearUpdateRanges(),e.pixelStorei(i.UNPACK_ROW_LENGTH,J),e.pixelStorei(i.UNPACK_SKIP_PIXELS,ot),e.pixelStorei(i.UNPACK_SKIP_ROWS,mt)}}function ft(C,E,W){let yt=i.TEXTURE_2D;(E.isDataArrayTexture||E.isCompressedArrayTexture)&&(yt=i.TEXTURE_2D_ARRAY),E.isData3DTexture&&(yt=i.TEXTURE_3D);let ut=lt(C,E),nt=E.source;e.bindTexture(yt,C.__webglTexture,i.TEXTURE0+W);let et=n.get(nt);if(nt.version!==et.__version||ut===!0){if(e.activeTexture(i.TEXTURE0+W),(typeof ImageBitmap<"u"&&E.image instanceof ImageBitmap)===!1){let Tt=Ne.getPrimaries(Ne.workingColorSpace),Qt=E.colorSpace===Ii?null:Ne.getPrimaries(E.colorSpace),re=E.colorSpace===Ii||Tt===Qt?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,E.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,E.premultiplyAlpha),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,re)}e.pixelStorei(i.UNPACK_ALIGNMENT,E.unpackAlignment);let ot=y(E.image,!1,s.maxTextureSize);ot=Kt(E,ot);let mt=r.convert(E.format,E.colorSpace),L=r.convert(E.type),ct=w(E.internalFormat,mt,L,E.normalized,E.colorSpace,E.isVideoTexture);$t(yt,E);let it,Pt=E.mipmaps,wt=E.isVideoTexture!==!0,Et=et.__version===void 0||ut===!0,Vt=nt.dataReady,he=S(E,ot);if(E.isDepthTexture)ct=x(E.format===Pi,E.type),Et&&(wt?e.texStorage2D(i.TEXTURE_2D,1,ct,ot.width,ot.height):e.texImage2D(i.TEXTURE_2D,0,ct,ot.width,ot.height,0,mt,L,null));else if(E.isDataTexture)if(Pt.length>0){wt&&Et&&e.texStorage2D(i.TEXTURE_2D,he,ct,Pt[0].width,Pt[0].height);for(let Tt=0,Qt=Pt.length;Tt<Qt;Tt++)it=Pt[Tt],wt?Vt&&e.texSubImage2D(i.TEXTURE_2D,Tt,0,0,it.width,it.height,mt,L,it.data):e.texImage2D(i.TEXTURE_2D,Tt,ct,it.width,it.height,0,mt,L,it.data);E.generateMipmaps=!1}else wt?(Et&&e.texStorage2D(i.TEXTURE_2D,he,ct,ot.width,ot.height),Vt&&rt(E,ot,mt,L)):e.texImage2D(i.TEXTURE_2D,0,ct,ot.width,ot.height,0,mt,L,ot.data);else if(E.isCompressedTexture)if(E.isCompressedArrayTexture){wt&&Et&&e.texStorage3D(i.TEXTURE_2D_ARRAY,he,ct,Pt[0].width,Pt[0].height,ot.depth);for(let Tt=0,Qt=Pt.length;Tt<Qt;Tt++)if(it=Pt[Tt],E.format!==An)if(mt!==null)if(wt){if(Vt)if(E.layerUpdates.size>0){let re=Lc(it.width,it.height,E.format,E.type);for(let kt of E.layerUpdates){let Se=it.data.subarray(kt*re/it.data.BYTES_PER_ELEMENT,(kt+1)*re/it.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Tt,0,0,kt,it.width,it.height,1,mt,Se)}}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Tt,0,0,0,it.width,it.height,ot.depth,mt,it.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,Tt,ct,it.width,it.height,ot.depth,0,it.data,0,0);else pe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else wt?Vt&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,Tt,0,0,0,it.width,it.height,ot.depth,mt,L,it.data):e.texImage3D(i.TEXTURE_2D_ARRAY,Tt,ct,it.width,it.height,ot.depth,0,mt,L,it.data);E.layerUpdates.size>0&&E.clearLayerUpdates()}else{wt&&Et&&e.texStorage2D(i.TEXTURE_2D,he,ct,Pt[0].width,Pt[0].height);for(let Tt=0,Qt=Pt.length;Tt<Qt;Tt++)it=Pt[Tt],E.format!==An?mt!==null?wt?Vt&&e.compressedTexSubImage2D(i.TEXTURE_2D,Tt,0,0,it.width,it.height,mt,it.data):e.compressedTexImage2D(i.TEXTURE_2D,Tt,ct,it.width,it.height,0,it.data):pe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):wt?Vt&&e.texSubImage2D(i.TEXTURE_2D,Tt,0,0,it.width,it.height,mt,L,it.data):e.texImage2D(i.TEXTURE_2D,Tt,ct,it.width,it.height,0,mt,L,it.data)}else if(E.isDataArrayTexture)if(wt){if(Et&&e.texStorage3D(i.TEXTURE_2D_ARRAY,he,ct,ot.width,ot.height,ot.depth),Vt)if(E.layerUpdates.size>0){let Tt=Lc(ot.width,ot.height,E.format,E.type);for(let Qt of E.layerUpdates){let re=ot.data.subarray(Qt*Tt/ot.data.BYTES_PER_ELEMENT,(Qt+1)*Tt/ot.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,Qt,ot.width,ot.height,1,mt,L,re)}E.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,ot.width,ot.height,ot.depth,mt,L,ot.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,ct,ot.width,ot.height,ot.depth,0,mt,L,ot.data);else if(E.isData3DTexture)wt?(Et&&e.texStorage3D(i.TEXTURE_3D,he,ct,ot.width,ot.height,ot.depth),Vt&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,ot.width,ot.height,ot.depth,mt,L,ot.data)):e.texImage3D(i.TEXTURE_3D,0,ct,ot.width,ot.height,ot.depth,0,mt,L,ot.data);else if(E.isFramebufferTexture){if(Et)if(wt)e.texStorage2D(i.TEXTURE_2D,he,ct,ot.width,ot.height);else{let Tt=ot.width,Qt=ot.height;for(let re=0;re<he;re++)e.texImage2D(i.TEXTURE_2D,re,ct,Tt,Qt,0,mt,L,null),Tt>>=1,Qt>>=1}}else if(E.isHTMLTexture){if("texElementImage2D"in i){let Tt=i.canvas;if(Tt.hasAttribute("layoutsubtree")||Tt.setAttribute("layoutsubtree","true"),ot.parentNode!==Tt){Tt.appendChild(ot),f.add(E),Tt.onpaint=Qt=>{let re=Qt.changedElements;for(let kt of f)re.includes(kt.image)&&(kt.needsUpdate=!0)},Tt.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,ot);else{let re=i.RGBA,kt=i.RGBA,Se=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,re,kt,Se,ot)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Pt.length>0){if(wt&&Et){let Tt=se(Pt[0]);e.texStorage2D(i.TEXTURE_2D,he,ct,Tt.width,Tt.height)}for(let Tt=0,Qt=Pt.length;Tt<Qt;Tt++)it=Pt[Tt],wt?Vt&&e.texSubImage2D(i.TEXTURE_2D,Tt,0,0,mt,L,it):e.texImage2D(i.TEXTURE_2D,Tt,ct,mt,L,it);E.generateMipmaps=!1}else if(wt){if(Et){let Tt=se(ot);e.texStorage2D(i.TEXTURE_2D,he,ct,Tt.width,Tt.height)}Vt&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,mt,L,ot)}else e.texImage2D(i.TEXTURE_2D,0,ct,mt,L,ot);T(E)&&E.mipmapsAutoUpdate===!0&&_(yt),et.__version=nt.version,E.onUpdate&&E.onUpdate(E)}C.__version=E.version}function At(C,E,W){if(E.image.length!==6)return;let yt=lt(C,E),ut=E.source;e.bindTexture(i.TEXTURE_CUBE_MAP,C.__webglTexture,i.TEXTURE0+W);let nt=n.get(ut);if(ut.version!==nt.__version||yt===!0){e.activeTexture(i.TEXTURE0+W);let et=Ne.getPrimaries(Ne.workingColorSpace),J=E.colorSpace===Ii?null:Ne.getPrimaries(E.colorSpace),ot=E.colorSpace===Ii||et===J?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,E.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,E.premultiplyAlpha),e.pixelStorei(i.UNPACK_ALIGNMENT,E.unpackAlignment),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,ot);let mt=E.isCompressedTexture||E.image[0].isCompressedTexture,L=E.image[0]&&E.image[0].isDataTexture,ct=[];for(let kt=0;kt<6;kt++)!mt&&!L?ct[kt]=y(E.image[kt],!0,s.maxCubemapSize):ct[kt]=L?E.image[kt].image:E.image[kt],ct[kt]=Kt(E,ct[kt]);let it=ct[0],Pt=r.convert(E.format,E.colorSpace),wt=r.convert(E.type),Et=w(E.internalFormat,Pt,wt,E.normalized,E.colorSpace),Vt=E.isVideoTexture!==!0,he=nt.__version===void 0||yt===!0,Tt=ut.dataReady,Qt=S(E,it);$t(i.TEXTURE_CUBE_MAP,E);let re;if(E.isDepthTexture){if(Et=x(E.format===Pi,E.type),he)if(Vt)e.texStorage2D(i.TEXTURE_CUBE_MAP,1,Et,it.width,it.height);else for(let kt=0;kt<6;kt++)e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,0,Et,it.width,it.height,0,Pt,wt,null)}else if(mt){Vt&&he&&e.texStorage2D(i.TEXTURE_CUBE_MAP,Qt,Et,it.width,it.height);for(let kt=0;kt<6;kt++){re=ct[kt].mipmaps;for(let Se=0;Se<re.length;Se++){let Be=re[Se];E.format!==An?Pt!==null?Vt?Tt&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,Se,0,0,Be.width,Be.height,Pt,Be.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,Se,Et,Be.width,Be.height,0,Be.data):pe("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Vt?Tt&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,Se,0,0,Be.width,Be.height,Pt,wt,Be.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,Se,Et,Be.width,Be.height,0,Pt,wt,Be.data)}}}else{if(re=E.mipmaps,Vt&&he){re.length>0&&Qt++;let kt=se(ct[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,Qt,Et,kt.width,kt.height)}for(let kt=0;kt<6;kt++)if(L){Vt?Tt&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,0,0,0,ct[kt].width,ct[kt].height,Pt,wt,ct[kt].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,0,Et,ct[kt].width,ct[kt].height,0,Pt,wt,ct[kt].data);for(let Se=0;Se<re.length;Se++){let Je=re[Se].image[kt].image;Vt?Tt&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,Se+1,0,0,Je.width,Je.height,Pt,wt,Je.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,Se+1,Et,Je.width,Je.height,0,Pt,wt,Je.data)}}else{Vt?Tt&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,0,0,0,Pt,wt,ct[kt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,0,Et,Pt,wt,ct[kt]);for(let Se=0;Se<re.length;Se++){let Be=re[Se];Vt?Tt&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,Se+1,0,0,Pt,wt,Be.image[kt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+kt,Se+1,Et,Pt,wt,Be.image[kt])}}}T(E)&&E.mipmapsAutoUpdate===!0&&_(i.TEXTURE_CUBE_MAP),nt.__version=ut.version,E.onUpdate&&E.onUpdate(E)}C.__version=E.version}function _t(C,E,W,yt,ut,nt){let et=r.convert(W.format,W.colorSpace),J=r.convert(W.type),ot=w(W.internalFormat,et,J,W.normalized,W.colorSpace),mt=n.get(E),L=n.get(W);if(L.__renderTarget=E,!mt.__hasExternalTextures){let ct=Math.max(1,E.width>>nt),it=Math.max(1,E.height>>nt);ut===i.TEXTURE_3D||ut===i.TEXTURE_2D_ARRAY?e.texImage3D(ut,nt,ot,ct,it,E.depth,0,et,J,null):e.texImage2D(ut,nt,ot,ct,it,0,et,J,null)}e.bindFramebuffer(i.FRAMEBUFFER,C),Lt(E)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,yt,ut,L.__webglTexture,0,Ae(E)):(ut===i.TEXTURE_2D||ut>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&ut<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,yt,ut,L.__webglTexture,nt),e.bindFramebuffer(i.FRAMEBUFFER,null)}function St(C,E,W){if(i.bindRenderbuffer(i.RENDERBUFFER,C),E.depthBuffer){let yt=E.depthTexture,ut=yt&&yt.isDepthTexture?yt.type:null,nt=x(E.stencilBuffer,ut),et=E.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;Lt(E)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Ae(E),nt,E.width,E.height):W?i.renderbufferStorageMultisample(i.RENDERBUFFER,Ae(E),nt,E.width,E.height):i.renderbufferStorage(i.RENDERBUFFER,nt,E.width,E.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,et,i.RENDERBUFFER,C)}else{let yt=E.textures;for(let ut=0;ut<yt.length;ut++){let nt=yt[ut],et=r.convert(nt.format,nt.colorSpace),J=r.convert(nt.type),ot=w(nt.internalFormat,et,J,nt.normalized,nt.colorSpace);Lt(E)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Ae(E),ot,E.width,E.height):W?i.renderbufferStorageMultisample(i.RENDERBUFFER,Ae(E),ot,E.width,E.height):i.renderbufferStorage(i.RENDERBUFFER,ot,E.width,E.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Gt(C,E,W){let yt=E.isWebGLCubeRenderTarget===!0;if(e.bindFramebuffer(i.FRAMEBUFFER,C),!(E.depthTexture&&E.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let ut=n.get(E.depthTexture);ut.__renderTarget=E;let nt=yt?E.depthTexture.image[0]:E.depthTexture.image;(!ut.__webglTexture||nt.width!==E.width||nt.height!==E.height)&&(nt.width=E.width,nt.height=E.height,E.depthTexture.needsUpdate=!0),yt?pt(E.depthTexture,0):xt(E.depthTexture,0);let et=ut.__webglTexture,J=Ae(E),ot=yt?i.TEXTURE_CUBE_MAP_POSITIVE_X+W:i.TEXTURE_2D,mt=E.depthTexture.format===Pi?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(E.depthTexture.format===Ti)Lt(E)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,mt,ot,et,0,J):i.framebufferTexture2D(i.FRAMEBUFFER,mt,ot,et,0);else if(E.depthTexture.format===Pi)Lt(E)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,mt,ot,et,0,J):i.framebufferTexture2D(i.FRAMEBUFFER,mt,ot,et,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Zt(C){let E=n.get(C),W=C.isWebGLCubeRenderTarget===!0;if(E.__boundDepthTexture!==C.depthTexture){let yt=C.depthTexture;if(E.__depthDisposeCallback&&E.__depthDisposeCallback(),yt){let ut=()=>{delete E.__boundDepthTexture,delete E.__depthDisposeCallback,yt.removeEventListener("dispose",ut)};yt.addEventListener("dispose",ut),E.__depthDisposeCallback=ut}E.__boundDepthTexture=yt}if(C.depthTexture&&!E.__autoAllocateDepthBuffer)if(W)for(let yt=0;yt<6;yt++)Gt(E.__webglFramebuffer[yt],C,yt);else C.texture.mipmaps.length>0?Gt(E.__webglFramebuffer[0],C,0):Gt(E.__webglFramebuffer,C,0);else if(W){E.__webglDepthbuffer=[];for(let yt=0;yt<6;yt++)if(e.bindFramebuffer(i.FRAMEBUFFER,E.__webglFramebuffer[yt]),E.__webglDepthbuffer[yt]===void 0)E.__webglDepthbuffer[yt]=i.createRenderbuffer(),St(E.__webglDepthbuffer[yt],C,!1);else{let ut=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,nt=E.__webglDepthbuffer[yt];i.bindRenderbuffer(i.RENDERBUFFER,nt),i.framebufferRenderbuffer(i.FRAMEBUFFER,ut,i.RENDERBUFFER,nt)}}else if(C.texture.mipmaps.length>0?e.bindFramebuffer(i.FRAMEBUFFER,E.__webglFramebuffer[0]):e.bindFramebuffer(i.FRAMEBUFFER,E.__webglFramebuffer),E.__webglDepthbuffer===void 0)E.__webglDepthbuffer=i.createRenderbuffer(),St(E.__webglDepthbuffer,C,!1);else{let ut=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,nt=E.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,nt),i.framebufferRenderbuffer(i.FRAMEBUFFER,ut,i.RENDERBUFFER,nt)}e.bindFramebuffer(i.FRAMEBUFFER,null)}function ie(C,E,W){let yt=n.get(C);E!==void 0&&_t(yt.__webglFramebuffer,C,C.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),W!==void 0&&Zt(C)}function Xt(C){let E=C.texture,W=n.get(C),yt=n.get(E);C.addEventListener("dispose",G),I(C);let ut=C.textures,nt=C.isWebGLCubeRenderTarget===!0,et=ut.length>1;if(et||(yt.__webglTexture===void 0&&(yt.__webglTexture=i.createTexture()),yt.__version=E.version,o.memory.textures++),nt){W.__webglFramebuffer=[];for(let J=0;J<6;J++)if(E.mipmaps.length>0){W.__webglFramebuffer[J]=[];for(let ot=0;ot<E.mipmaps.length;ot++)W.__webglFramebuffer[J][ot]=i.createFramebuffer()}else W.__webglFramebuffer[J]=i.createFramebuffer()}else{if(E.mipmaps.length>0){W.__webglFramebuffer=[];for(let J=0;J<E.mipmaps.length;J++)W.__webglFramebuffer[J]=i.createFramebuffer()}else W.__webglFramebuffer=i.createFramebuffer();if(et)for(let J=0,ot=ut.length;J<ot;J++){let mt=n.get(ut[J]);mt.__webglTexture===void 0&&(mt.__webglTexture=i.createTexture(),o.memory.textures++)}if(C.samples>0&&Lt(C)===!1){W.__webglMultisampledFramebuffer=i.createFramebuffer(),W.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,W.__webglMultisampledFramebuffer);for(let J=0;J<ut.length;J++){let ot=ut[J];W.__webglColorRenderbuffer[J]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,W.__webglColorRenderbuffer[J]);let mt=r.convert(ot.format,ot.colorSpace),L=r.convert(ot.type),ct=w(ot.internalFormat,mt,L,ot.normalized,ot.colorSpace,C.isXRRenderTarget===!0),it=Ae(C);i.renderbufferStorageMultisample(i.RENDERBUFFER,it,ct,C.width,C.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+J,i.RENDERBUFFER,W.__webglColorRenderbuffer[J])}i.bindRenderbuffer(i.RENDERBUFFER,null),C.depthBuffer&&(W.__webglDepthRenderbuffer=i.createRenderbuffer(),St(W.__webglDepthRenderbuffer,C,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(nt){e.bindTexture(i.TEXTURE_CUBE_MAP,yt.__webglTexture),$t(i.TEXTURE_CUBE_MAP,E);for(let J=0;J<6;J++)if(E.mipmaps.length>0)for(let ot=0;ot<E.mipmaps.length;ot++)_t(W.__webglFramebuffer[J][ot],C,E,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+J,ot);else _t(W.__webglFramebuffer[J],C,E,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+J,0);T(E)?_(i.TEXTURE_CUBE_MAP):E.mipmaps.length>0&&i.texParameteri(i.TEXTURE_CUBE_MAP,i.TEXTURE_MAX_LEVEL,E.mipmaps.length-1),e.unbindTexture()}else if(et){for(let J=0,ot=ut.length;J<ot;J++){let mt=ut[J],L=n.get(mt),ct=i.TEXTURE_2D;(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(ct=C.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(ct,L.__webglTexture),$t(ct,mt),_t(W.__webglFramebuffer,C,mt,i.COLOR_ATTACHMENT0+J,ct,0),T(mt)&&_(ct)}e.unbindTexture()}else{let J=i.TEXTURE_2D;if((C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(J=C.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(J,yt.__webglTexture),$t(J,E),E.mipmaps.length>0)for(let ot=0;ot<E.mipmaps.length;ot++)_t(W.__webglFramebuffer[ot],C,E,i.COLOR_ATTACHMENT0,J,ot);else _t(W.__webglFramebuffer,C,E,i.COLOR_ATTACHMENT0,J,0);T(E)?_(J):E.mipmaps.length>0&&i.texParameteri(J,i.TEXTURE_MAX_LEVEL,E.mipmaps.length-1),e.unbindTexture()}C.depthBuffer&&Zt(C)}function U(C){let E=C.textures;for(let W=0,yt=E.length;W<yt;W++){let ut=E[W];if(T(ut)&&ut.mipmapsAutoUpdate===!0){let nt=A(C),et=n.get(ut).__webglTexture;e.bindTexture(nt,et),_(nt),e.unbindTexture()}}}let Pe=[];function oe(C){if(C.samples>0){if(Lt(C)===!1){let E=C.textures,W=C.width,yt=C.height,ut=i.COLOR_BUFFER_BIT,nt=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,et=n.get(C),J=E.length>1;if(J)for(let mt=0;mt<E.length;mt++)e.bindFramebuffer(i.FRAMEBUFFER,et.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+mt,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,et.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+mt,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,et.__webglMultisampledFramebuffer),C.texture.mipmaps.length>0?e.bindFramebuffer(i.DRAW_FRAMEBUFFER,et.__webglFramebuffer[0]):e.bindFramebuffer(i.DRAW_FRAMEBUFFER,et.__webglFramebuffer);for(let mt=0;mt<E.length;mt++){if(C.resolveDepthBuffer&&(C.depthBuffer&&(ut|=i.DEPTH_BUFFER_BIT),C.stencilBuffer&&C.resolveStencilBuffer&&(ut|=i.STENCIL_BUFFER_BIT)),J){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,et.__webglColorRenderbuffer[mt]);let L=n.get(E[mt]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,L,0)}i.blitFramebuffer(0,0,W,yt,0,0,W,yt,ut,i.NEAREST),l===!0&&(Pe.length=0,Pe.push(i.COLOR_ATTACHMENT0+mt),C.depthBuffer&&C.storeMultisampledDepthBuffer===!1&&Pe.push(nt),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,Pe))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),J)for(let mt=0;mt<E.length;mt++){e.bindFramebuffer(i.FRAMEBUFFER,et.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+mt,i.RENDERBUFFER,et.__webglColorRenderbuffer[mt]);let L=n.get(E[mt]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,et.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+mt,i.TEXTURE_2D,L,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,et.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.storeMultisampledDepthBuffer===!1&&l){let E=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[E])}}}function Ae(C){return Math.min(s.maxSamples,C.samples)}function Lt(C){let E=n.get(C);return C.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&E.__useRenderToTexture!==!1}function Me(C){let E=o.render.frame;h.get(C)!==E&&(h.set(C,E),C.update())}function Kt(C,E){let W=C.colorSpace,yt=C.format,ut=C.type;return C.isCompressedTexture===!0||C.isVideoTexture===!0||W!==gr&&W!==Ii&&(Ne.getTransfer(W)===Ve?(yt!==An||ut!==Nn)&&pe("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ee("WebGLTextures: Unsupported texture color space:",W)),E}function se(C){return typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement?(c.width=C.naturalWidth||C.width,c.height=C.naturalHeight||C.height):typeof VideoFrame<"u"&&C instanceof VideoFrame?(c.width=C.displayWidth,c.height=C.displayHeight):(c.width=C.width,c.height=C.height),c}this.allocateTextureUnit=qt,this.resetTextureUnits=Q,this.getTextureUnits=dt,this.setTextureUnits=Ft,this.setTexture2D=xt,this.setTexture2DArray=tt,this.setTexture3D=st,this.setTextureCube=pt,this.rebindTextures=ie,this.setupRenderTarget=Xt,this.updateRenderTargetMipmap=U,this.updateMultisampleRenderTarget=oe,this.setupDepthRenderbuffer=Zt,this.setupFrameBufferTexture=_t,this.useMultisampledRTT=Lt,this.dispose=z}function Ox(i,t){function e(n,s=Ii){let r,o=Ne.getTransfer(s);if(n===Nn)return i.UNSIGNED_BYTE;if(n===Aa)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Ca)return i.UNSIGNED_SHORT_5_5_5_1;if(n===xc)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===_c)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===mc)return i.BYTE;if(n===gc)return i.SHORT;if(n===js)return i.UNSIGNED_SHORT;if(n===Ra)return i.INT;if(n===si)return i.UNSIGNED_INT;if(n===jn)return i.FLOAT;if(n===Wn)return i.HALF_FLOAT;if(n===yc)return i.ALPHA;if(n===vc)return i.RGB;if(n===An)return i.RGBA;if(n===Ti)return i.DEPTH_COMPONENT;if(n===Pi)return i.DEPTH_STENCIL;if(n===Pa)return i.RED;if(n===Ia)return i.RED_INTEGER;if(n===Zi)return i.RG;if(n===Da)return i.RG_INTEGER;if(n===La)return i.RGBA_INTEGER;if(n===Kr||n===$r||n===jr||n===Qr)if(o===Ve)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Kr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===$r)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===jr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Qr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Kr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===$r)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===jr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Qr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Na||n===Ua||n===Fa||n===Oa)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Na)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Ua)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Fa)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Oa)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Ba||n===Ha||n===Ga||n===za||n===ka||n===to||n===Va)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Ba||n===Ha)return o===Ve?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Ga)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===za)return r.COMPRESSED_R11_EAC;if(n===ka)return r.COMPRESSED_SIGNED_R11_EAC;if(n===to)return r.COMPRESSED_RG11_EAC;if(n===Va)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Wa||n===Xa||n===qa||n===Ya||n===Za||n===Ja||n===Ka||n===$a||n===ja||n===Qa||n===tl||n===el||n===nl||n===il)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Wa)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Xa)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===qa)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Ya)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Za)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Ja)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Ka)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===$a)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===ja)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Qa)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===tl)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===el)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===nl)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===il)return o===Ve?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===sl||n===rl||n===ol)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===sl)return o===Ve?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===rl)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===ol)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===al||n===ll||n===eo||n===cl)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===al)return r.COMPRESSED_RED_RGTC1_EXT;if(n===ll)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===eo)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===cl)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===xs?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}var Bx=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Hx=`
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

}`,kc=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){let n=new Cr(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,n=new Xe({vertexShader:Bx,fragmentShader:Hx,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new P(new be(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Vc=class extends ii{constructor(t,e){super();let n=this,s=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,f=null,u=null,d=null,g=null,v=typeof XRWebGLBinding<"u",m=new kc,p={},y=e.getContextAttributes(),T=null,_=null,A=[],w=[],x=new bt,S=null,I=null,b=new mn;b.viewport=new Ke;let N=new mn;N.viewport=new Ke;let G=[b,N],K=new Sa,D=null,z=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(O){let xt=A[O];return xt===void 0&&(xt=new Vs,A[O]=xt),xt.getTargetRaySpace()},this.getControllerGrip=function(O){let xt=A[O];return xt===void 0&&(xt=new Vs,A[O]=xt),xt.getGripSpace()},this.getHand=function(O){let xt=A[O];return xt===void 0&&(xt=new Vs,A[O]=xt),xt.getHandSpace()};function Y(O){let xt=w.indexOf(O.inputSource);if(xt===-1)return;let tt=A[xt];tt!==void 0&&(tt.update(O.inputSource,O.frame,c||o),tt.dispatchEvent({type:O.type,data:O.inputSource}))}function B(){s.removeEventListener("select",Y),s.removeEventListener("selectstart",Y),s.removeEventListener("selectend",Y),s.removeEventListener("squeeze",Y),s.removeEventListener("squeezestart",Y),s.removeEventListener("squeezeend",Y),s.removeEventListener("end",B),s.removeEventListener("inputsourceschange",H);for(let O=0;O<A.length;O++){let xt=w[O];xt!==null&&(w[O]=null,A[O].disconnect(xt))}D=null,z=null,m.reset();for(let O in p)delete p[O];if(t.setRenderTarget(T),d=null,u=null,f=null,s=null,_=null,qt.stop(),n.isPresenting=!1,t.setPixelRatio(S),t.setSize(x.width,x.height,!1),I!==null){let O=I.camera;O.fov=I.fov,O.zoom=I.zoom,O.updateProjectionMatrix(),I=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(O){r=O,n.isPresenting===!0&&pe("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(O){a=O,n.isPresenting===!0&&pe("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(O){c=O},this.getBaseLayer=function(){return u!==null?u:d},this.getBinding=function(){return f===null&&v&&(f=new XRWebGLBinding(s,e)),f},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(O){if(s=O,s!==null){if(T=t.getRenderTarget(),s.addEventListener("select",Y),s.addEventListener("selectstart",Y),s.addEventListener("selectend",Y),s.addEventListener("squeeze",Y),s.addEventListener("squeezestart",Y),s.addEventListener("squeezeend",Y),s.addEventListener("end",B),s.addEventListener("inputsourceschange",H),y.xrCompatible!==!0&&await e.makeXRCompatible(),S=t.getPixelRatio(),t.getSize(x),v&&"createProjectionLayer"in XRWebGLBinding.prototype){let tt=null,st=null,pt=null;y.depth&&(pt=y.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,tt=y.stencil?Pi:Ti,st=y.stencil?xs:si);let at={colorFormat:e.RGBA8,depthFormat:pt,scaleFactor:r};f=this.getBinding(),u=f.createProjectionLayer(at),s.updateRenderState({layers:[u]}),t.setPixelRatio(1),t.setSize(u.textureWidth,u.textureHeight,!1),_=new gn(u.textureWidth,u.textureHeight,{format:An,type:Nn,depthTexture:new Ri(u.textureWidth,u.textureHeight,st,void 0,void 0,void 0,void 0,void 0,void 0,tt),stencilBuffer:y.stencil,colorSpace:t.outputColorSpace,samples:y.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}else{let tt={antialias:y.antialias,alpha:!0,depth:y.depth,stencil:y.stencil,framebufferScaleFactor:r};d=new XRWebGLLayer(s,e,tt),s.updateRenderState({baseLayer:d}),t.setPixelRatio(1),t.setSize(d.framebufferWidth,d.framebufferHeight,!1),_=new gn(d.framebufferWidth,d.framebufferHeight,{format:An,type:Nn,colorSpace:t.outputColorSpace,stencilBuffer:y.stencil,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}_.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await s.requestReferenceSpace(a),qt.setContext(s),qt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function H(O){for(let xt=0;xt<O.removed.length;xt++){let tt=O.removed[xt],st=w.indexOf(tt);st>=0&&(w[st]=null,A[st].disconnect(tt))}for(let xt=0;xt<O.added.length;xt++){let tt=O.added[xt],st=w.indexOf(tt);if(st===-1){for(let at=0;at<A.length;at++)if(at>=w.length){w.push(tt),st=at;break}else if(w[at]===null){w[at]=tt,st=at;break}if(st===-1)break}let pt=A[st];pt&&pt.connect(tt)}}function $(O,xt){xt===null?O.matrixWorld.copy(O.matrix):O.matrixWorld.multiplyMatrices(xt.matrixWorld,O.matrix),O.matrixWorldInverse.copy(O.matrixWorld).invert()}this.updateCamera=function(O){if(s===null)return;let xt=O.near,tt=O.far;m.texture!==null&&(m.depthNear>0&&(xt=m.depthNear),m.depthFar>0&&(tt=m.depthFar)),K.near=N.near=b.near=xt,K.far=N.far=b.far=tt,(D!==K.near||z!==K.far)&&(s.updateRenderState({depthNear:K.near,depthFar:K.far}),D=K.near,z=K.far),K.layers.mask=O.layers.mask|6,b.layers.mask=K.layers.mask&-5,N.layers.mask=K.layers.mask&-3;let st=O.parent,pt=K.cameras;$(K,st);for(let at=0;at<pt.length;at++)$(pt[at],st);K.projectionMatrix.copy(b.projectionMatrix),K.projectionMatrixInverse.copy(b.projectionMatrixInverse),I===null&&O.isPerspectiveCamera&&(I={camera:O,fov:O.fov,zoom:O.zoom}),Q(O,K,st)};function Q(O,xt,tt){tt===null?O.matrix.copy(xt.matrixWorld):(O.matrix.copy(tt.matrixWorld),O.matrix.invert(),O.matrix.multiply(xt.matrixWorld)),O.matrix.decompose(O.position,O.quaternion,O.scale),O.updateMatrixWorld(!0),O.projectionMatrix.copy(xt.projectionMatrix),O.projectionMatrixInverse.copy(xt.projectionMatrixInverse),O.isPerspectiveCamera&&(O.fov=zs*2*Math.atan(1/O.projectionMatrix.elements[5]),O.zoom=1)}this.getCamera=function(){return K},this.getFoveation=function(){if(!(u===null&&d===null))return l},this.setFoveation=function(O){l=O,u!==null&&(u.fixedFoveation=O),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=O)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(K)},this.getCameraTexture=function(O){return p[O]};let dt=null;function Ft(O,xt){if(h=xt.getViewerPose(c||o),g=xt,h!==null){let tt=h.views;d!==null&&(t.setRenderTargetFramebuffer(_,d.framebuffer),t.setRenderTarget(_));let st=!1;tt.length!==K.cameras.length&&(K.cameras.length=0,st=!0);for(let Mt=0;Mt<tt.length;Mt++){let $t=tt[Mt],lt=null;if(d!==null)lt=d.getViewport($t);else{let rt=f.getViewSubImage(u,$t);lt=rt.viewport,Mt===0&&(t.setRenderTargetTextures(_,rt.colorTexture,rt.depthStencilTexture),t.setRenderTarget(_))}let k=G[Mt];k===void 0&&(k=new mn,k.layers.enable(Mt),k.viewport=new Ke,G[Mt]=k),k.matrix.fromArray($t.transform.matrix),k.matrix.decompose(k.position,k.quaternion,k.scale),k.projectionMatrix.fromArray($t.projectionMatrix),k.projectionMatrixInverse.copy(k.projectionMatrix).invert(),k.viewport.set(lt.x,lt.y,lt.width,lt.height),Mt===0&&(K.matrix.copy(k.matrix),K.matrix.decompose(K.position,K.quaternion,K.scale)),st===!0&&K.cameras.push(k)}let pt=s.enabledFeatures;if(pt&&pt.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&v){f=n.getBinding();let Mt=f.getDepthInformation(tt[0]);Mt&&Mt.isValid&&Mt.texture&&m.init(Mt,s.renderState)}if(pt&&pt.includes("camera-access")&&v){t.state.unbindTexture(),f=n.getBinding();for(let Mt=0;Mt<tt.length;Mt++){let $t=tt[Mt].camera;if($t){let lt=p[$t];lt||(lt=new Cr,p[$t]=lt);let k=f.getCameraImage($t);lt.sourceTexture=k}}}}for(let tt=0;tt<A.length;tt++){let st=w[tt],pt=A[tt];st!==null&&pt!==void 0&&pt.update(st,xt,c||o)}dt&&dt(O,xt),xt.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:xt}),g=null}let qt=new Yu;qt.setAnimationLoop(Ft),this.setAnimationLoop=function(O){dt=O},this.dispose=function(){}}},Gx=new He,id=new Te;id.set(-1,0,0,0,1,0,0,0,1);function zx(i,t){function e(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,Pc(i)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function s(m,p,y,T,_){p.isNodeMaterial?p.uniformsNeedUpdate=!1:p.isMeshBasicMaterial?r(m,p):p.isMeshLambertMaterial?(r(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshToonMaterial?(r(m,p),f(m,p)):p.isMeshPhongMaterial?(r(m,p),h(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshStandardMaterial?(r(m,p),u(m,p),p.isMeshPhysicalMaterial&&d(m,p,_)):p.isMeshMatcapMaterial?(r(m,p),g(m,p)):p.isMeshDepthMaterial?r(m,p):p.isMeshDistanceMaterial?(r(m,p),v(m,p)):p.isMeshNormalMaterial?r(m,p):p.isLineBasicMaterial?(o(m,p),p.isLineDashedMaterial&&a(m,p)):p.isPointsMaterial?l(m,p,y,T):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,e(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===vn&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,e(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===vn&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,e(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,e(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,e(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);let y=t.get(p),T=y.envMap,_=y.envMapRotation;T&&(m.envMap.value=T,m.envMapRotation.value.setFromMatrix4(Gx.makeRotationFromEuler(_)).transpose(),T.isCubeTexture&&T.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(id),m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,e(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,e(p.aoMap,m.aoMapTransform))}function o(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform))}function a(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,y,T){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*y,m.scale.value=T*.5,p.map&&(m.map.value=p.map,e(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function h(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function f(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function u(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,e(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,e(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function d(m,p,y){m.ior.value=p.ior,p.diffuseRoughness>0&&(m.diffuseRoughness.value=p.diffuseRoughness,p.diffuseRoughnessMap&&(m.diffuseRoughnessMap.value=p.diffuseRoughnessMap,e(p.diffuseRoughnessMap,m.diffuseRoughnessMapTransform))),p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,e(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,e(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,e(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,e(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,e(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===vn&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.retroreflectivity>0&&(m.retroreflectivity.value=p.retroreflectivity),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessMinimum,m.iridescenceThicknessMaximum.value=p.iridescenceThicknessMaximum,p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,e(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,e(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=y.texture,m.transmissionSamplerSize.value.set(y.width,y.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,e(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,e(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,e(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,e(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,e(p.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,p){p.matcap&&(m.matcap.value=p.matcap)}function v(m,p){let y=t.get(p).light;m.referencePosition.value.setFromMatrixPosition(y.matrixWorld),m.nearDistance.value=y.shadow.camera.near,m.farDistance.value=y.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function kx(i,t,e,n){let s={},r={};function o(y,T){let _=T.program;n.uniformBlockBinding(y,_,s[y.id])}function a(y,T){let _=s[y.id];_===void 0&&(g(y),_=l(y),s[y.id]=_,y.addEventListener("dispose",m));let A=T.program;n.updateUBOMapping(y,A);let w=t.render.frame;r[y.id]!==w&&(c(y),r[y.id]=w)}function l(y){let T=i.createBuffer(),_=y.__size,A=y.usage;return i.bindBuffer(i.UNIFORM_BUFFER,T),i.bufferData(i.UNIFORM_BUFFER,_,A),i.bindBuffer(i.UNIFORM_BUFFER,null),T}function c(y){let T=s[y.id],_=y.uniforms,A=y.__cache;i.bindBuffer(i.UNIFORM_BUFFER,T);for(let w=0,x=_.length;w<x;w++){let S=_[w];if(Array.isArray(S))for(let I=0,b=S.length;I<b;I++)h(S[I],w,I,A);else h(S,w,0,A)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function h(y,T,_,A){if(u(y,T,_,A)===!0){let w=y.__offset,x=y.value;if(Array.isArray(x)){let S=0;for(let I=0;I<x.length;I++){let b=x[I],N=v(b,!0);f(b,y.__data,S),S+=N.storage/Float32Array.BYTES_PER_ELEMENT}}else f(x,y.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,w,y.__data)}}function f(y,T,_){typeof y=="number"||typeof y=="boolean"?T[_]=y:y.isMatrix3?(T[_]=y.elements[0],T[_+1]=y.elements[1],T[_+2]=y.elements[2],T[_+3]=0,T[_+4]=y.elements[3],T[_+5]=y.elements[4],T[_+6]=y.elements[5],T[_+7]=0,T[_+8]=y.elements[6],T[_+9]=y.elements[7],T[_+10]=y.elements[8],T[_+11]=0):ArrayBuffer.isView(y)?T.set(y.subarray(0,T.length-_),_):y.toArray(T,_)}function u(y,T,_,A){let w=y.value,x=T+"_"+_;if(Array.isArray(w)){A[x]===void 0&&(A[x]=[]);let S=A[x],I=!1;for(let b=0;b<w.length;b++)d(w[b],S,b)===!0&&(I=!0);return I}return d(w,A,x)}function d(y,T,_){if(T[_]===void 0)return typeof y=="number"||typeof y=="boolean"?T[_]=y:ArrayBuffer.isView(y)?T[_]=y.slice():T[_]=y.clone(),!0;{let A=T[_];if(typeof y=="number"||typeof y=="boolean"){if(A!==y)return T[_]=y,!0}else{if(ArrayBuffer.isView(y))return!0;if(A.equals(y)===!1)return A.copy(y),!0}}return!1}function g(y){let T=y.uniforms,_=0,A=16;for(let x=0,S=T.length;x<S;x++){let I=Array.isArray(T[x])?T[x]:[T[x]];for(let b=0,N=I.length;b<N;b++){let G=I[b],K=Array.isArray(G.value)?G.value:[G.value],D=Array.isArray(T[x])||Array.isArray(G.value),z=_;for(let B=0,H=K.length;B<H;B++){let $=K[B],Q=v($,D),dt=_%A,Ft=dt%Q.boundary,qt=dt+Ft;_+=Ft,qt!==0&&A-qt<Q.storage&&(_+=A-qt),B===0&&(z=_),_+=Q.storage}let Y=G.type==="int"?Int32Array:G.type==="uint"?Uint32Array:Float32Array;G.__data=new Y((_-z)/Float32Array.BYTES_PER_ELEMENT),G.__offset=z}}let w=_%A;return w>0&&(_+=A-w),y.__size=_,y.__cache={},this}function v(y,T){let _={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(_.boundary=4,_.storage=4):y.isVector2?(_.boundary=8,_.storage=8):y.isVector3||y.isColor?(_.boundary=16,_.storage=12):y.isVector4?(_.boundary=16,_.storage=16):y.isMatrix3?(_.boundary=16,_.storage=48):y.isMatrix4?(_.boundary=16,_.storage=64):y.isTexture?pe("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(y)?(_.boundary=16,_.storage=y.byteLength):pe("WebGLRenderer: Unsupported uniform value type.",y),T===!0&&(_.boundary=16,_.storage=Math.ceil(_.storage/16)*16),_}function m(y){let T=y.target;T.removeEventListener("dispose",m),i.deleteBuffer(s[T.id]),delete s[T.id],delete r[T.id]}function p(){for(let y in s)i.deleteBuffer(s[y]);s={},r={}}return{bind:o,update:a,dispose:p}}var Vx=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),pi=null;function Wx(){return pi===null&&(pi=new os(Vx,16,16,Zi,Wn),pi.name="DFG_LUT",pi.minFilter=Qe,pi.magFilter=Qe,pi.wrapS=ci,pi.wrapT=ci,pi.generateMipmaps=!1,pi.needsUpdate=!0),pi}var fl=class{constructor(t={}){let{canvas:e=du(),context:n=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:u=!1,outputBufferType:d=Nn}=t;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=o;let v=d,m=new Set([La,Da,Ia]),p=new Set([Nn,si,js,xs,Aa,Ca]),y=new Uint32Array(4),T=new Int32Array(4),_={textures:[],min:[],max:[],resolution:[]},A=null,w=null,x=[],S=[],I=null;this.domElement=e,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=$n,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let b=this,N=!1,G=null,K=null,D=null,z=null;this._outputColorSpace=_n;let Y=0,B=0,H=null,$=-1,Q=null,dt=new Ke,Ft=new Ke,qt=null,O=new fe(0),xt=0,tt=e.width,st=e.height,pt=1,at=null,ee=null,Mt=new Ke(0,0,tt,st),$t=new Ke(0,0,tt,st),lt=!1,k=new zi,rt=new Qo,ft=!1,At=!1,_t=new He,St=new R,Gt=new Ke,Zt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},ie=!1;function Xt(){return H===null?pt:1}let U=n;function Pe(M,F){return e.getContext(M,F)}let oe,Ae,Lt,Me,Kt,se,C,E,W,yt,ut,nt,et,J,ot,mt,L,ct,it,Pt,wt,Et,Vt;try{let M={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:f};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${"187"}`),e.addEventListener("webglcontextlost",Qt,!1),e.addEventListener("webglcontextrestored",re,!1),e.addEventListener("webglcontextcreationerror",kt,!1),U===null){let F="webgl2";if(U=Pe(F,M),U===null)throw Pe(F)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}he()}catch(M){throw e.removeEventListener("webglcontextlost",Qt,!1),e.removeEventListener("webglcontextrestored",re,!1),e.removeEventListener("webglcontextcreationerror",kt,!1),Ee("WebGLRenderer: "+M.message),M}function he(){oe=new eg(U),oe.init(),wt=new Ox(U,oe),Ae=new Wm(U,oe,t,wt),Lt=new Ux(U,oe),Ae.reversedDepthBuffer&&u&&Lt.buffers.depth.setReversed(!0),K=U.createFramebuffer(),D=U.createFramebuffer(),z=U.createFramebuffer(),Me=new sg(U),Kt=new Ex,se=new Fx(U,oe,Lt,Kt,Ae,wt,Me),C=new tg(b),E=new op(U),Et=new km(U,E),W=new ng(U,E,Me,Et),yt=new og(U,W,E,Et,Me),ct=new rg(U,Ae,se),ot=new Xm(Kt),ut=new vx(b,C,oe,Ae,Et,ot),nt=new zx(b,Kt),et=new Sx,J=new Cx(oe),L=new zm(b,C,Lt,yt,g,l),mt=new Nx(b,yt,Ae),Vt=new kx(U,Me,Ae,Lt),it=new Vm(U,oe,Me),Pt=new ig(U,oe,Me),Me.programs=ut.programs,b.capabilities=Ae,b.extensions=oe,b.properties=Kt,b.renderLists=et,b.shadowMap=mt,b.state=Lt,b.info=Me}v!==Nn&&(I=new lg(v,e.width,e.height,a,s,r));let Tt=new Vc(b,U);this.xr=Tt,this.getContext=function(){return U},this.getContextAttributes=function(){return U.getContextAttributes()},this.forceContextLoss=function(){let M=oe.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){let M=oe.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return pt},this.setPixelRatio=function(M){M!==void 0&&(pt=M,this.setSize(tt,st,!1))},this.getSize=function(M){return M.set(tt,st)},this.setSize=function(M,F,j=!0){if(Tt.isPresenting){pe("WebGLRenderer: Can't change size while VR device is presenting.");return}tt=M,st=F,e.width=Math.floor(M*pt),e.height=Math.floor(F*pt),j===!0&&(e.style.width=M+"px",e.style.height=F+"px"),I!==null&&I.setSize(e.width,e.height),this.setViewport(0,0,M,F)},this.getDrawingBufferSize=function(M){return M.set(tt*pt,st*pt).floor()},this.setDrawingBufferSize=function(M,F,j){tt=M,st=F,pt=j,e.width=Math.floor(M*j),e.height=Math.floor(F*j),this.setViewport(0,0,M,F)},this.setEffects=function(M){if(v===Nn){Ee("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(M){for(let F=0;F<M.length;F++)if(M[F].isOutputPass===!0){pe("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}I.setEffects(M||[])},this.getCurrentViewport=function(M){return M.copy(dt)},this.getViewport=function(M){return M.copy(Mt)},this.setViewport=function(M,F,j,X){M.isVector4?Mt.set(M.x,M.y,M.z,M.w):Mt.set(M,F,j,X),Lt.viewport(dt.copy(Mt).multiplyScalar(Xt()).round())},this.getScissor=function(M){return M.copy($t)},this.setScissor=function(M,F,j,X){M.isVector4?$t.set(M.x,M.y,M.z,M.w):$t.set(M,F,j,X),Lt.scissor(Ft.copy($t).multiplyScalar(Xt()).round())},this.getScissorTest=function(){return lt},this.setScissorTest=function(M){Lt.setScissorTest(lt=M)},this.setOpaqueSort=function(M){at=M},this.setTransparentSort=function(M){ee=M},this.getClearColor=function(M){return M.copy(L.getClearColor())},this.setClearColor=function(){L.setClearColor(...arguments)},this.getClearAlpha=function(){return L.getClearAlpha()},this.setClearAlpha=function(){L.setClearAlpha(...arguments)},this.clear=function(M=!0,F=!0,j=!0){let X=0;if(M){let q=!1;if(H!==null){let It=H.texture.format;q=m.has(It)}if(q){let It=H.texture.type,Dt=p.has(It),Rt=L.getClearColor(),V=L.getClearAlpha(),ht=Rt.r,Ct=Rt.g,Bt=Rt.b;Dt?(y[0]=ht,y[1]=Ct,y[2]=Bt,y[3]=V,U.clearBufferuiv(U.COLOR,0,y)):(T[0]=ht,T[1]=Ct,T[2]=Bt,T[3]=V,U.clearBufferiv(U.COLOR,0,T))}else X|=U.COLOR_BUFFER_BIT}F&&(X|=U.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),j&&(X|=U.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),X!==0&&U.clear(X)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(M){M.setRenderer(this),G=M},this.dispose=function(){e.removeEventListener("webglcontextlost",Qt,!1),e.removeEventListener("webglcontextrestored",re,!1),e.removeEventListener("webglcontextcreationerror",kt,!1),L.dispose(),et.dispose(),J.dispose(),se.dispose(),Kt.dispose(),C.dispose(),yt.dispose(),W.dispose(),Et.dispose(),Vt.dispose(),ut.dispose(),Tt.dispose(),Tt.removeEventListener("sessionstart",Mn),Tt.removeEventListener("sessionend",ln),Ut.stop()};function Qt(M){M.preventDefault(),wc("WebGLRenderer: Context Lost."),N=!0}function re(){wc("WebGLRenderer: Context Restored."),N=!1;let M=Me.autoReset,F=mt.enabled,j=mt.autoUpdate,X=mt.needsUpdate,q=mt.type;he(),Me.autoReset=M,mt.enabled=F,mt.autoUpdate=j,mt.needsUpdate=X,mt.type=q}function kt(M){Ee("WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function Se(M){let F=M.target;F.removeEventListener("dispose",Se),Be(F)}function Be(M){Je(M),Kt.remove(M)}function Je(M){let F=Kt.get(M).programs;F!==void 0&&(F.forEach(function(j){ut.releaseProgram(j)}),M.isShaderMaterial&&ut.releaseShaderCache(M))}this.renderBufferDirect=function(M,F,j,X,q,It){F===null&&(F=Zt);let Dt=q.isMesh&&q.matrixWorld.determinantAffine()<0,Rt=Wt(M,F,j,X,q);Lt.setMaterial(X,Dt);let V=j.index,ht=1;if(X.wireframe===!0){if(V=W.getWireframeAttribute(j),V===void 0)return;ht=2}let Ct=j.drawRange,Bt=j.attributes.position,gt=Ct.start*ht,Ot=(Ct.start+Ct.count)*ht;It!==null&&(gt=Math.max(gt,It.start*ht),Ot=Math.min(Ot,(It.start+It.count)*ht)),V!==null?(gt=Math.max(gt,0),Ot=Math.min(Ot,V.count)):Bt!=null&&(gt=Math.max(gt,0),Ot=Math.min(Ot,Bt.count));let le=Ot-gt;if(le<0||le===1/0)return;Et.setup(q,X,Rt,j,V);let ne,_e=it;if(V!==null&&(ne=E.get(V),_e=Pt,_e.setIndex(ne)),q.isMesh)X.wireframe===!0?(Lt.setLineWidth(X.wireframeLinewidth*Xt()),_e.setMode(U.LINES)):_e.setMode(U.TRIANGLES);else if(q.isLine){let Le=X.linewidth;Le===void 0&&(Le=1),Lt.setLineWidth(Le*Xt()),q.isLineSegments?_e.setMode(U.LINES):q.isLineLoop?_e.setMode(U.LINE_LOOP):_e.setMode(U.LINE_STRIP)}else q.isPoints?_e.setMode(U.POINTS):q.isSprite&&_e.setMode(U.TRIANGLES);if(q.isBatchedMesh)if(oe.get("WEBGL_multi_draw"))_e.renderMultiDraw(q._multiDrawStarts,q._multiDrawCounts,q._multiDrawCount);else{let Le=q._multiDrawStarts,Ht=q._multiDrawCounts,Ge=q._multiDrawCount,ve=V?E.get(V).bytesPerElement:1,Xn=Kt.get(X).currentProgram.getUniforms();for(let Sn=0;Sn<Ge;Sn++)Xn.setValue(U,"_gl_DrawID",Sn),_e.render(Le[Sn]/ve,Ht[Sn])}else if(q.isInstancedMesh)_e.renderInstances(gt,le,q.count);else if(j.isInstancedBufferGeometry){let Le=j._maxInstanceCount!==void 0?j._maxInstanceCount:1/0,Ht=Math.min(j.instanceCount,Le);_e.renderInstances(gt,le,Ht)}else _e.render(gt,le)};function an(M,F,j,X){G!==null&&M.isNodeMaterial&&G.setObject(X,M),ft===!0&&ot.setState(M,j,!1),M.transparent===!0&&M.side===Re&&M.forceSinglePass===!1?(M.side=vn,M.needsUpdate=!0,We(M,F,X),M.side=Kn,M.needsUpdate=!0,We(M,F,X),M.side=Re):We(M,F,X)}this.compile=function(M,F,j=null){j===null&&(j=M),G!==null&&G.renderStart(M,F,j),w=J.get(j),w.init(F),S.push(w),j.traverseVisible(function(q){q.isLight&&q.layers.test(F.layers)&&(w.pushLight(q),q.castShadow&&w.pushShadow(q))}),M!==j&&M.traverseVisible(function(q){q.isLight&&q.layers.test(F.layers)&&(w.pushLight(q),q.castShadow&&w.pushShadow(q))}),w.setupLights(),G!==null&&G.updateLights(w.state.lightsArray),At=this.localClippingEnabled,ft=ot.init(this.clippingPlanes,At),ft===!0&&ot.setGlobalState(this.clippingPlanes,F),G!==null&&mt.render(w.state.shadowsArray,j,F);let X=new Set;return M.traverse(function(q){if(!(q.isMesh||q.isPoints||q.isLine||q.isSprite))return;let It=q.material;if(It)if(Array.isArray(It))for(let Dt=0;Dt<It.length;Dt++){let Rt=It[Dt];an(Rt,j,F,q),X.add(Rt)}else an(It,j,F,q),X.add(It)}),w=S.pop(),G!==null&&G.renderEnd(),X},this.compileAsync=function(M,F,j=null){let X=this.compile(M,F,j);return new Promise(q=>{function It(){if(X.forEach(function(Dt){let V=Kt.get(Dt).currentProgram;(V===void 0||V.isReady())&&X.delete(Dt)}),X.size===0){q(M);return}setTimeout(It,10)}oe.get("KHR_parallel_shader_compile")!==null?It():setTimeout(It,10)})};let En=null;function Fn(M){En&&En(M)}function Mn(){Ut.stop()}function ln(){Ut.start()}let Ut=new Yu;Ut.setAnimationLoop(Fn),typeof self<"u"&&Ut.setContext(self),this.setAnimationLoop=function(M){En=M,Tt.setAnimationLoop(M),M===null?Ut.stop():Ut.start()},Tt.addEventListener("sessionstart",Mn),Tt.addEventListener("sessionend",ln),this.render=function(M,F){if(F!==void 0&&F.isCamera!==!0){Ee("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(N===!0)return;G!==null&&G.renderStart(M,F);let j=Tt.enabled===!0&&Tt.isPresenting===!0,X=I!==null&&(H===null||j)&&I.begin(b,H);if(M.matrixWorldAutoUpdate===!0&&M.updateMatrixWorld(),F.parent===null&&F.matrixWorldAutoUpdate===!0&&F.updateMatrixWorld(),Tt.enabled===!0&&Tt.isPresenting===!0&&(I===null||I.isCompositing()===!1)&&(Tt.cameraAutoUpdate===!0&&Tt.updateCamera(F),F=Tt.getCamera()),M.isScene===!0&&M.onBeforeRender(b,M,F,H),w=J.get(M,S.length),w.init(F),w.state.textureUnits=se.getTextureUnits(),S.push(w),_t.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),F.isArrayCamera?rt.setFromArrayCamera(F):k.setFromProjectionMatrix(_t,Yn,F.reversedDepth),At=this.localClippingEnabled,ft=ot.init(this.clippingPlanes,At),A=et.get(M,x.length),A.init(),x.push(A),this.info.render.frame++,Tt.enabled===!0&&Tt.isPresenting===!0){let Dt=b.xr.getDepthSensingMesh();Dt!==null&&ae(Dt,F,-1/0,b.sortObjects)}ae(M,F,0,b.sortObjects),A.finish(),G!==null&&G.updateLights(w.state.lightsArray),b.sortObjects===!0&&A.sort(at,ee),ie=Tt.enabled===!1||Tt.isPresenting===!1||Tt.hasDepthSensing()===!1,ie&&L.addToRenderList(A,M),this.info.autoReset===!0&&this.info.reset(),ft===!0&&ot.beginShadows();let q=w.state.shadowsArray;if(mt.render(q,M,F),ft===!0&&ot.endShadows(),(X&&I.hasRenderPass())===!1){let Dt=A.opaque,Rt=A.transmissive;if(w.setupLights(),F.isArrayCamera){let V=F.cameras;if(Rt.length>0)for(let ht=0,Ct=V.length;ht<Ct;ht++){let Bt=V[ht];ce(Dt,Rt,M,Bt)}ie&&L.render(M);for(let ht=0,Ct=V.length;ht<Ct;ht++){let Bt=V[ht];we(A,M,Bt,Bt.viewport)}}else Rt.length>0&&ce(Dt,Rt,M,F),ie&&L.render(M),we(A,M,F)}H!==null&&B===0&&(se.updateMultisampleRenderTarget(H),se.updateRenderTargetMipmap(H)),X&&I.end(b),M.isScene===!0&&M.onAfterRender(b,M,F),Et.resetDefaultState(),$=-1,Q=null,S.pop(),S.length>0?(w=S[S.length-1],se.setTextureUnits(w.state.textureUnits),ft===!0&&ot.setGlobalState(b.clippingPlanes,w.state.camera)):w=null,x.pop(),x.length>0?A=x[x.length-1]:A=null,G!==null&&G.renderEnd()};function ae(M,F,j,X){if(M.visible===!1)return;if(M.layers.test(F.layers)){if(M.isGroup)j=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(F);else if(M.isLight)w.pushLight(M),M.castShadow&&w.pushShadow(M);else if(M.isSprite){let Dt=F.isArrayCamera?rt:k;if(!M.frustumCulled||M.intersectsFrustum(Dt)){X&&Gt.setFromMatrixPosition(M.matrixWorld).applyMatrix4(_t);let Rt=yt.update(M),V=M.material;V.visible&&A.push(M,Rt,V,j,Gt.z,null,F)}}else if(M.isMesh||M.isLine||M.isPoints){let Dt=F.isArrayCamera?rt:k;if(!M.frustumCulled||M.intersectsFrustum(Dt)){let Rt=yt.update(M),V=M.material;if(X&&(M.boundingSphere!==void 0?(M.boundingSphere===null&&M.computeBoundingSphere(),Gt.copy(M.boundingSphere.center)):(Rt.boundingSphere===null&&Rt.computeBoundingSphere(),Gt.copy(Rt.boundingSphere.center)),Gt.applyMatrix4(M.matrixWorld).applyMatrix4(_t)),Array.isArray(V)){let ht=Rt.groups;for(let Ct=0,Bt=ht.length;Ct<Bt;Ct++){let gt=ht[Ct],Ot=V[gt.materialIndex];Ot&&Ot.visible&&A.push(M,Rt,Ot,j,Gt.z,gt,F)}}else V.visible&&A.push(M,Rt,V,j,Gt.z,null,F)}}}let It=M.children;for(let Dt=0,Rt=It.length;Dt<Rt;Dt++)ae(It[Dt],F,j,X)}function we(M,F,j,X){let{opaque:q,transmissive:It,transparent:Dt}=M;w.setupLightsView(j),ft===!0&&ot.setGlobalState(b.clippingPlanes,j),X&&Lt.viewport(dt.copy(X)),q.length>0&&ge(q,F,j),It.length>0&&ge(It,F,j),Dt.length>0&&ge(Dt,F,j),Lt.buffers.depth.setTest(!0),Lt.buffers.depth.setMask(!0),Lt.buffers.color.setMask(!0),Lt.setPolygonOffset(!1)}function ce(M,F,j,X){if((j.isScene===!0?j.overrideMaterial:null)!==null)return;if(w.state.transmissionRenderTarget[X.id]===void 0){let gt=oe.has("EXT_color_buffer_half_float")||oe.has("EXT_color_buffer_float");w.state.transmissionRenderTarget[X.id]=new gn(1,1,{generateMipmaps:!0,type:gt?Wn:Nn,minFilter:Ci,samples:Math.max(4,Ae.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Ne.workingColorSpace})}let It=w.state.transmissionRenderTarget[X.id],Dt=X.viewport||dt;It.setSize(Dt.z*b.transmissionResolutionScale,Dt.w*b.transmissionResolutionScale);let Rt=b.getRenderTarget(),V=b.getActiveCubeFace(),ht=b.getActiveMipmapLevel();b.setRenderTarget(It),b.getClearColor(O),xt=b.getClearAlpha(),xt<1&&b.setClearColor(16777215,.5),b.clear(),ie&&L.render(j);let Ct=b.toneMapping;b.toneMapping=$n;let Bt=X.viewport;if(X.viewport!==void 0&&(X.viewport=void 0),w.setupLightsView(X),ft===!0&&ot.setGlobalState(b.clippingPlanes,X),ge(M,j,X),se.updateMultisampleRenderTarget(It),se.updateRenderTargetMipmap(It),oe.has("WEBGL_multisampled_render_to_texture")===!1){let gt=!1;for(let Ot=0,le=F.length;Ot<le;Ot++){let ne=F[Ot],{object:_e,geometry:Le,material:Ht,group:Ge}=ne;if(Ht.side===Re&&_e.layers.test(X.layers)){let ve=Ht.side;Ht.side=vn,Ht.needsUpdate=!0,xe(_e,j,X,Le,Ht,Ge),Ht.side=ve,Ht.needsUpdate=!0,gt=!0}}gt===!0&&(se.updateMultisampleRenderTarget(It),se.updateRenderTargetMipmap(It))}b.setRenderTarget(Rt,V,ht),b.setClearColor(O,xt),Bt!==void 0&&(X.viewport=Bt),b.toneMapping=Ct}function ge(M,F,j){let X=F.isScene===!0?F.overrideMaterial:null;for(let q=0,It=M.length;q<It;q++){let Dt=M[q],{object:Rt,geometry:V,group:ht}=Dt,Ct=Dt.material;Ct.allowOverride===!0&&X!==null&&(Ct=X),Rt.layers.test(j.layers)&&xe(Rt,F,j,V,Ct,ht)}}function xe(M,F,j,X,q,It){G!==null&&q.isNodeMaterial&&G.setObject(M,q),M.onBeforeRender(b,F,j,X,q,It),M.modelViewMatrix.multiplyMatrices(j.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),q.onBeforeRender(b,F,j,X,M,It),q.transparent===!0&&q.side===Re&&q.forceSinglePass===!1?(q.side=vn,q.needsUpdate=!0,b.renderBufferDirect(j,F,X,q,M,It),q.side=Kn,q.needsUpdate=!0,b.renderBufferDirect(j,F,X,q,M,It),q.side=Re):b.renderBufferDirect(j,F,X,q,M,It),M.onAfterRender(b,F,j,X,q,It)}function ke(M){let F=0;for(let j of M)j.texture!==null&&F++;return F}function We(M,F,j){F.isScene!==!0&&(F=Zt);let X=Kt.get(M),q=w.state.lights,It=w.state.shadowsArray,Dt=q.state.version,Rt=ut.getParameters(M,q.state,It,F,j,w.state.lightProbeGridArray),V=ut.getProgramCacheKey(Rt),ht=X.programs;X.environment=M.isMeshStandardMaterial||M.isMeshLambertMaterial||M.isMeshPhongMaterial?F.environment:null,X.fog=F.fog;let Ct=M.isMeshStandardMaterial||M.isMeshLambertMaterial&&!M.envMap||M.isMeshPhongMaterial&&!M.envMap;X.envMap=C.get(M.envMap||X.environment,Ct),X.envMapRotation=X.environment!==null&&M.envMap===null?F.environmentRotation:M.envMapRotation,ht===void 0&&(M.addEventListener("dispose",Se),ht=new Map,X.programs=ht,X.programVariants=new Map);let Bt=ht.get(V);if(Bt!==void 0){if(X.currentProgram===Bt&&X.lightsStateVersion===Dt)return Nt(M,Rt),Bt}else Rt.uniforms=ut.getUniforms(M),G!==null&&M.isNodeMaterial&&G.build(M,j,Rt),M.onBeforeCompile(Rt,b),Bt=ut.acquireProgram(Rt,V),ht.set(V,Bt),X.uniforms=Rt.uniforms;let gt=X.uniforms;return(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(gt.clippingPlanes=ot.uniform),Nt(M,Rt),X.needsLights=ye(M),X.lightsStateVersion=Dt,X.needsLights&&(gt.ambientLightColor.value=q.state.ambient,gt.lightProbe.value=q.state.probe,gt.sunLights.value=q.state.sun,gt.sunLightShadows.value=q.state.sunShadow,gt.directionalLights.value=q.state.directional,gt.directionalLightShadows.value=q.state.directionalShadow,gt.spotLights.value=q.state.spot,gt.spotLightShadows.value=q.state.spotShadow,gt.rectAreaLights.value=q.state.rectArea,gt.ltc_1.value=q.state.rectAreaLTC1,gt.ltc_2.value=q.state.rectAreaLTC2,gt.pointLights.value=q.state.point,gt.pointLightShadows.value=q.state.pointShadow,gt.hemisphereLights.value=q.state.hemi,gt.sunShadowMatrix.value=q.state.sunShadowMatrix,gt.sunShadowCascade.value=q.state.sunShadowCascade,gt.directionalShadowMatrix.value=q.state.directionalShadowMatrix,gt.spotLightMatrix.value=q.state.spotLightMatrix,gt.spotLightMap.value=q.state.spotLightMap,gt.pointShadowMatrix.value=q.state.pointShadowMatrix),X.numLightProbeGrids=ke(w.state.lightProbeGridArray),X.currentProgram=Bt,X.uniformsList=null,Bt}function Ye(M,F,j,X,q){let It=Kt.get(M),Dt=It.currentProgram.id+","+X+","+q,Rt=It.programVariants.get(Dt);return Rt===void 0?(Rt=We(M,F,j),It.programVariants.set(Dt,Rt)):(It.currentProgram=Rt,It.uniformsList=null,It.outputColorSpace=X,It.toneMapping=q),Rt}function Ln(M){if(M.uniformsList===null){let F=M.currentProgram.getUniforms();M.uniformsList=tr.seqWithValue(F.seq,M.uniforms)}return M.uniformsList}function Nt(M,F){let j=Kt.get(M);j.outputColorSpace=F.outputColorSpace,j.batching=F.batching,j.batchingColor=F.batchingColor,j.instancing=F.instancing,j.instancingColor=F.instancingColor,j.instancingMorph=F.instancingMorph,j.skinning=F.skinning,j.morphTargets=F.morphTargets,j.morphNormals=F.morphNormals,j.morphColors=F.morphColors,j.morphTargetsCount=F.morphTargetsCount,j.numClippingPlanes=F.numClippingPlanes,j.numIntersection=F.numClipIntersection,j.vertexAlphas=F.vertexAlphas,j.vertexTangents=F.vertexTangents,j.toneMapping=F.toneMapping}function Wt(M,F,j,X,q){F.isScene!==!0&&(F=Zt),se.resetTextureUnits();let It=F.fog,Dt=X.isMeshStandardMaterial||X.isMeshLambertMaterial||X.isMeshPhongMaterial?F.environment:null,Rt=H===null?b.outputColorSpace:H.isXRRenderTarget===!0?H.texture.colorSpace:Ne.workingColorSpace,V=X.isMeshStandardMaterial||X.isMeshLambertMaterial&&!X.envMap||X.isMeshPhongMaterial&&!X.envMap,ht=C.get(X.envMap||Dt,V),Ct=X.vertexColors===!0&&!!j.attributes.color&&j.attributes.color.itemSize===4,Bt=!!j.attributes.tangent&&(!!X.normalMap||X.anisotropy>0),gt=!!j.morphAttributes.position,Ot=!!j.morphAttributes.normal,le=!!j.morphAttributes.color,ne=$n;X.toneMapped&&(H===null||H.isXRRenderTarget===!0)&&(ne=b.toneMapping);let _e=j.morphAttributes.position||j.morphAttributes.normal||j.morphAttributes.color,Le=_e!==void 0?_e.length:0,Ht=Kt.get(X),Ge=w.state.lights;if(ft===!0&&(At===!0||M!==Q)){let $e=M===Q&&X.id===$;ot.setState(X,M,$e)}let ve=!1,Xn=!1;X.version===Ht.__version?Ht.needsLights&&Ht.lightsStateVersion!==Ge.state.version||q.isBatchedMesh&&Ht.batching===!1||!q.isBatchedMesh&&Ht.batching===!0||q.isBatchedMesh&&Ht.batchingColor===!0&&q._colorsTexture===null||q.isBatchedMesh&&Ht.batchingColor===!1&&q._colorsTexture!==null||q.isInstancedMesh&&Ht.instancing===!1||!q.isInstancedMesh&&Ht.instancing===!0||q.isSkinnedMesh&&Ht.skinning===!1||!q.isSkinnedMesh&&Ht.skinning===!0||q.isInstancedMesh&&Ht.instancingColor===!0&&q.instanceColor===null||q.isInstancedMesh&&Ht.instancingColor===!1&&q.instanceColor!==null||q.isInstancedMesh&&Ht.instancingMorph===!0&&q.morphTexture===null||q.isInstancedMesh&&Ht.instancingMorph===!1&&q.morphTexture!==null||Ht.envMap!==ht||X.fog===!0&&Ht.fog!==It||Ht.numClippingPlanes!==void 0&&(Ht.numClippingPlanes!==ot.numPlanes||Ht.numIntersection!==ot.numIntersection)||Ht.vertexAlphas!==Ct||Ht.vertexTangents!==Bt||Ht.morphTargets!==gt||Ht.morphNormals!==Ot||Ht.morphColors!==le||Ht.morphTargetsCount!==Le||Ht.numLightProbeGrids!==ke(w.state.lightProbeGridArray)?ve=!0:(Ht.outputColorSpace!==Rt||Ht.toneMapping!==ne)&&(Xn=!0):(ve=!0,Ht.__version=X.version);let Sn=Ht.currentProgram;(ve===!0||Xn===!0)&&(Sn=Xn===!0?Ye(X,F,q,Rt,ne):We(X,F,q),G&&X.isNodeMaterial&&G.onUpdateProgram(X,Sn,Ht));let fo=!1,Ni=!1,Ki=!1,Fe=Sn.getUniforms(),xn=Ht.uniforms;if(Lt.useProgram(Sn.program)&&(fo=!0,Ni=!0,Ki=!0),X.id!==$&&($=X.id,Ni=!0),fo||Q!==M){Lt.buffers.depth.getReversed()&&M.reversedDepth!==!0&&(M._reversedDepth=!0,M.updateProjectionMatrix()),Fe.setValue(U,"projectionMatrix",M.projectionMatrix),Fe.setValue(U,"viewMatrix",M.matrixWorldInverse);let fn=Fe.map.cameraPosition;fn!==void 0&&fn.setValue(U,St.setFromMatrixPosition(M.matrixWorld)),Ae.logarithmicDepthBuffer&&Fe.setValue(U,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),(X.isMeshPhongMaterial||X.isMeshToonMaterial||X.isMeshLambertMaterial||X.isMeshBasicMaterial||X.isMeshStandardMaterial||X.isShaderMaterial)&&Fe.setValue(U,"isOrthographic",M.isOrthographicCamera===!0),Q!==M&&(Q=M,Ni=!0,Ki=!0)}if(Ht.needsLights&&(Ge.state.sunShadowMap.length>0&&Fe.setValue(U,"sunShadowMap",Ge.state.sunShadowMap,se),Ge.state.directionalShadowMap.length>0&&Fe.setValue(U,"directionalShadowMap",Ge.state.directionalShadowMap,se),Ge.state.spotShadowMap.length>0&&Fe.setValue(U,"spotShadowMap",Ge.state.spotShadowMap,se),Ge.state.pointShadowMap.length>0&&Fe.setValue(U,"pointShadowMap",Ge.state.pointShadowMap,se)),q.isSkinnedMesh){Fe.setOptional(U,q,"bindMatrix"),Fe.setOptional(U,q,"bindMatrixInverse");let $e=q.skeleton;$e&&($e.boneTexture===null&&$e.computeBoneTexture(),Fe.setValue(U,"boneTexture",$e.boneTexture,se))}q.isBatchedMesh&&(Fe.setOptional(U,q,"batchingTexture"),Fe.setValue(U,"batchingTexture",q._matricesTexture,se),Fe.setOptional(U,q,"batchingIdTexture"),Fe.setValue(U,"batchingIdTexture",q._indirectTexture,se),Fe.setOptional(U,q,"batchingColorTexture"),q._colorsTexture!==null&&Fe.setValue(U,"batchingColorTexture",q._colorsTexture,se));let Qn=j.morphAttributes;if((Qn.position!==void 0||Qn.normal!==void 0||Qn.color!==void 0)&&ct.update(q,j,Sn),(Ni||Ht.receiveShadow!==q.receiveShadow)&&(Ht.receiveShadow=q.receiveShadow,Fe.setValue(U,"receiveShadow",q.receiveShadow)),(X.isMeshStandardMaterial||X.isMeshLambertMaterial||X.isMeshPhongMaterial)&&X.envMap===null&&F.environment!==null&&(xn.envMapIntensity.value=F.environmentIntensity),xn.dfgLUT!==void 0&&(xn.dfgLUT.value=Wx()),Ni){if(Fe.setValue(U,"toneMappingExposure",b.toneMappingExposure),Ht.needsLights&&ue(xn,Ki),It&&X.fog===!0&&nt.refreshFogUniforms(xn,It),nt.refreshMaterialUniforms(xn,X,pt,st,w.state.transmissionRenderTarget[M.id]),Ht.needsLights&&Ht.numLightProbeGrids>0){let $e=_,fn=0;for(let xi of w.state.lightProbeGridArray)xi.texture!==null&&($e.textures[fn]=xi.texture,$e.min[fn]=xi.boundingBox.min,$e.max[fn]=xi.boundingBox.max,$e.resolution[fn]=xi.resolution,fn++);for(let xi in $e)$e[xi].length=fn;xn.probesSH.value=$e.textures,xn.probesMin.value=$e.min,xn.probesMax.value=$e.max,xn.probesResolution.value=$e.resolution}tr.upload(U,Ln(Ht),xn,se)}if(X.isShaderMaterial&&X.uniformsNeedUpdate===!0&&(tr.upload(U,Ln(Ht),xn,se),X.uniformsNeedUpdate=!1),X.isSpriteMaterial&&Fe.setValue(U,"center",q.center),Fe.setValue(U,"modelViewMatrix",q.modelViewMatrix),Fe.setValue(U,"normalMatrix",q.normalMatrix),Fe.setValue(U,"modelMatrix",q.matrixWorld),X.uniformsGroups!==void 0){let $e=X.uniformsGroups;for(let fn=0,xi=$e.length;fn<xi;fn++){let Kc=$e[fn];Vt.update(Kc,Sn),Vt.bind(Kc,Sn)}}return Sn}function ue(M,F){M.ambientLightColor.needsUpdate=F,M.lightProbe.needsUpdate=F,M.sunLights.needsUpdate=F,M.sunLightShadows.needsUpdate=F,M.directionalLights.needsUpdate=F,M.directionalLightShadows.needsUpdate=F,M.pointLights.needsUpdate=F,M.pointLightShadows.needsUpdate=F,M.spotLights.needsUpdate=F,M.spotLightShadows.needsUpdate=F,M.rectAreaLights.needsUpdate=F,M.hemisphereLights.needsUpdate=F}function ye(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return Y},this.getActiveMipmapLevel=function(){return B},this.getRenderTarget=function(){return H},this.setRenderTargetTextures=function(M,F,j){let X=Kt.get(M);X.__autoAllocateDepthBuffer=M.resolveDepthBuffer===!1,X.__autoAllocateDepthBuffer===!1&&(X.__useRenderToTexture=!1),Kt.get(M.texture).__webglTexture=F,Kt.get(M.depthTexture).__webglTexture=X.__autoAllocateDepthBuffer?void 0:j,X.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(M,F){let j=Kt.get(M);j.__webglFramebuffer=F,j.__useDefaultFramebuffer=F===void 0},this.setRenderTarget=function(M,F=0,j=0){H=M,Y=F,B=j;let X=null,q=!1,It=!1;if(M){let Rt=Kt.get(M);if(Rt.__useDefaultFramebuffer!==void 0){Lt.bindFramebuffer(U.FRAMEBUFFER,Rt.__webglFramebuffer),dt.copy(M.viewport),Ft.copy(M.scissor),qt=M.scissorTest,Lt.viewport(dt),Lt.scissor(Ft),Lt.setScissorTest(qt),$=-1;return}else if(Rt.__webglFramebuffer===void 0)se.setupRenderTarget(M);else if(Rt.__hasExternalTextures)se.rebindTextures(M,Kt.get(M.texture).__webglTexture,Kt.get(M.depthTexture).__webglTexture);else if(M.depthBuffer){let Ct=M.depthTexture;if(Rt.__boundDepthTexture!==Ct){if(Ct!==null&&Kt.has(Ct)&&(M.width!==Ct.image.width||M.height!==Ct.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");se.setupDepthRenderbuffer(M)}}let V=M.texture;(V.isData3DTexture||V.isDataArrayTexture||V.isCompressedArrayTexture)&&(It=!0);let ht=Kt.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(Array.isArray(ht[F])?X=ht[F][j]:X=ht[F],q=!0):M.samples>0&&se.useMultisampledRTT(M)===!1?X=Kt.get(M).__webglMultisampledFramebuffer:Array.isArray(ht)?X=ht[j]:X=ht,dt.copy(M.viewport),Ft.copy(M.scissor),qt=M.scissorTest}else dt.copy(Mt).multiplyScalar(pt).floor(),Ft.copy($t).multiplyScalar(pt).floor(),qt=lt;if(j!==0&&(X=K),Lt.bindFramebuffer(U.FRAMEBUFFER,X)&&Lt.drawBuffers(M,X),Lt.viewport(dt),Lt.scissor(Ft),Lt.setScissorTest(qt),q){let Rt=Kt.get(M.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_CUBE_MAP_POSITIVE_X+F,Rt.__webglTexture,j)}else if(It){let Rt=F;for(let V=0;V<M.textures.length;V++){let ht=Kt.get(M.textures[V]);U.framebufferTextureLayer(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0+V,ht.__webglTexture,j,Rt)}}else if(M!==null&&j!==0){let Rt=Kt.get(M.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,Rt.__webglTexture,j)}$=-1};function de(M){let F=Kt.get(M);return(F.__readFormat!==M.format||F.__readType!==M.type)&&(F.__readFormat=M.format,F.__readType=M.type,F.__formatReadable=Ae.textureFormatReadable(M.format),F.__typeReadable=Ae.textureTypeReadable(M.type)),F}this.readRenderTargetPixels=function(M,F,j,X,q,It,Dt,Rt=0){if(!(M&&M.isWebGLRenderTarget)){Ee("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let V=Kt.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&Dt!==void 0&&(V=V[Dt],Array.isArray(V)&&(V=V[0])),V){Lt.bindFramebuffer(U.FRAMEBUFFER,V);try{let ht=M.textures[Rt],Ct=ht.format,Bt=ht.type;M.textures.length>1&&U.readBuffer(U.COLOR_ATTACHMENT0+Rt);let gt=de(ht);if(gt.__formatReadable===!1){Ee("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(gt.__typeReadable===!1){Ee("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}F>=0&&F<=M.width-X&&j>=0&&j<=M.height-q&&U.readPixels(F,j,X,q,wt.convert(Ct),wt.convert(Bt),It)}finally{let ht=H!==null?Kt.get(H).__webglFramebuffer:null;Lt.bindFramebuffer(U.FRAMEBUFFER,ht)}}},this.readRenderTargetPixelsAsync=async function(M,F,j,X,q,It,Dt,Rt=0){if(!(M&&M.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let V=Kt.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&Dt!==void 0&&(V=V[Dt],Array.isArray(V)&&(V=V[0])),V)if(F>=0&&F<=M.width-X&&j>=0&&j<=M.height-q){Lt.bindFramebuffer(U.FRAMEBUFFER,V);let ht=M.textures[Rt],Ct=ht.format,Bt=ht.type;M.textures.length>1&&U.readBuffer(U.COLOR_ATTACHMENT0+Rt);let gt=de(ht);if(gt.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(gt.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Ot=U.createBuffer();U.bindBuffer(U.PIXEL_PACK_BUFFER,Ot),U.bufferData(U.PIXEL_PACK_BUFFER,It.byteLength,U.STREAM_READ),U.readPixels(F,j,X,q,wt.convert(Ct),wt.convert(Bt),0),U.bindBuffer(U.PIXEL_PACK_BUFFER,null);let le=H!==null?Kt.get(H).__webglFramebuffer:null;Lt.bindFramebuffer(U.FRAMEBUFFER,le);let ne=U.fenceSync(U.SYNC_GPU_COMMANDS_COMPLETE,0);return U.flush(),await pu(U,ne,4),U.bindBuffer(U.PIXEL_PACK_BUFFER,Ot),U.getBufferSubData(U.PIXEL_PACK_BUFFER,0,It),U.bindBuffer(U.PIXEL_PACK_BUFFER,null),U.deleteBuffer(Ot),U.deleteSync(ne),It}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(M,F=null,j=0){let X=Math.pow(2,-j),q=Math.floor(M.image.width*X),It=Math.floor(M.image.height*X),Dt=F!==null?F.x:0,Rt=F!==null?F.y:0;se.setTexture2D(M,0),U.copyTexSubImage2D(U.TEXTURE_2D,j,0,0,Dt,Rt,q,It),Lt.unbindTexture()},this.copyTextureToTexture=function(M,F,j=null,X=null,q=0,It=0){let Dt,Rt,V,ht,Ct,Bt,gt,Ot,le,ne=M.isCompressedTexture?M.mipmaps[It]:M.image;if(j!==null)Dt=j.max.x-j.min.x,Rt=j.max.y-j.min.y,V=j.isBox3?j.max.z-j.min.z:1,ht=j.min.x,Ct=j.min.y,Bt=j.isBox3?j.min.z:0;else{let Fe=Math.pow(2,-q);Dt=Math.floor(ne.width*Fe),Rt=Math.floor(ne.height*Fe),M.isDataArrayTexture?V=ne.depth:M.isData3DTexture?V=Math.floor(ne.depth*Fe):V=1,ht=0,Ct=0,Bt=0}X!==null?(gt=X.x,Ot=X.y,le=X.z):(gt=0,Ot=0,le=0);let _e=wt.convert(F.format),Le=wt.convert(F.type),Ht;F.isData3DTexture?(se.setTexture3D(F,0),Ht=U.TEXTURE_3D):F.isDataArrayTexture||F.isCompressedArrayTexture?(se.setTexture2DArray(F,0),Ht=U.TEXTURE_2D_ARRAY):(se.setTexture2D(F,0),Ht=U.TEXTURE_2D),Lt.activeTexture(U.TEXTURE0),Lt.pixelStorei(U.UNPACK_FLIP_Y_WEBGL,F.flipY),Lt.pixelStorei(U.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),Lt.pixelStorei(U.UNPACK_ALIGNMENT,F.unpackAlignment);let Ge=Lt.getParameter(U.UNPACK_ROW_LENGTH),ve=Lt.getParameter(U.UNPACK_IMAGE_HEIGHT),Xn=Lt.getParameter(U.UNPACK_SKIP_PIXELS),Sn=Lt.getParameter(U.UNPACK_SKIP_ROWS),fo=Lt.getParameter(U.UNPACK_SKIP_IMAGES);Lt.pixelStorei(U.UNPACK_ROW_LENGTH,ne.width),Lt.pixelStorei(U.UNPACK_IMAGE_HEIGHT,ne.height),Lt.pixelStorei(U.UNPACK_SKIP_PIXELS,ht),Lt.pixelStorei(U.UNPACK_SKIP_ROWS,Ct),Lt.pixelStorei(U.UNPACK_SKIP_IMAGES,Bt);let Ni=M.isDataArrayTexture||M.isData3DTexture,Ki=F.isDataArrayTexture||F.isData3DTexture;if(M.isDepthTexture){let Fe=Kt.get(M),xn=Kt.get(F),Qn=Kt.get(Fe.__renderTarget),$e=Kt.get(xn.__renderTarget);Lt.bindFramebuffer(U.READ_FRAMEBUFFER,Qn.__webglFramebuffer),Lt.bindFramebuffer(U.DRAW_FRAMEBUFFER,$e.__webglFramebuffer);for(let fn=0;fn<V;fn++)Ni&&(U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,Kt.get(M).__webglTexture,q,Bt+fn),U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,Kt.get(F).__webglTexture,It,le+fn)),U.blitFramebuffer(ht,Ct,ht+Dt,Ct+Rt,gt,Ot,gt+Dt,Ot+Rt,U.DEPTH_BUFFER_BIT,U.NEAREST);Lt.bindFramebuffer(U.READ_FRAMEBUFFER,null),Lt.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else if(q!==0||M.isRenderTargetTexture||Kt.has(M)){let Fe=Kt.get(M),xn=Kt.get(F);Lt.bindFramebuffer(U.READ_FRAMEBUFFER,D),Lt.bindFramebuffer(U.DRAW_FRAMEBUFFER,z);for(let Qn=0;Qn<V;Qn++)Ni?U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,Fe.__webglTexture,q,Bt+Qn):U.framebufferTexture2D(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,Fe.__webglTexture,q),Ki?U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,xn.__webglTexture,It,le+Qn):U.framebufferTexture2D(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,xn.__webglTexture,It),q!==0?U.blitFramebuffer(ht,Ct,ht+Dt,Ct+Rt,gt,Ot,gt+Dt,Ot+Rt,U.COLOR_BUFFER_BIT,U.NEAREST):Ki?U.copyTexSubImage3D(Ht,It,gt,Ot,le+Qn,ht,Ct,Dt,Rt):U.copyTexSubImage2D(Ht,It,gt,Ot,ht,Ct,Dt,Rt);Lt.bindFramebuffer(U.READ_FRAMEBUFFER,null),Lt.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else Ki?M.isDataTexture||M.isData3DTexture?U.texSubImage3D(Ht,It,gt,Ot,le,Dt,Rt,V,_e,Le,ne.data):F.isCompressedArrayTexture?U.compressedTexSubImage3D(Ht,It,gt,Ot,le,Dt,Rt,V,_e,ne.data):U.texSubImage3D(Ht,It,gt,Ot,le,Dt,Rt,V,_e,Le,ne):M.isDataTexture?U.texSubImage2D(U.TEXTURE_2D,It,gt,Ot,Dt,Rt,_e,Le,ne.data):M.isCompressedTexture?U.compressedTexSubImage2D(U.TEXTURE_2D,It,gt,Ot,ne.width,ne.height,_e,ne.data):U.texSubImage2D(U.TEXTURE_2D,It,gt,Ot,Dt,Rt,_e,Le,ne);Lt.pixelStorei(U.UNPACK_ROW_LENGTH,Ge),Lt.pixelStorei(U.UNPACK_IMAGE_HEIGHT,ve),Lt.pixelStorei(U.UNPACK_SKIP_PIXELS,Xn),Lt.pixelStorei(U.UNPACK_SKIP_ROWS,Sn),Lt.pixelStorei(U.UNPACK_SKIP_IMAGES,fo),It===0&&F.generateMipmaps===!0&&F.mipmapsAutoUpdate===!0&&U.generateMipmap(Ht),Lt.unbindTexture()},this.initRenderTarget=function(M){Kt.get(M).__webglFramebuffer===void 0&&se.setupRenderTarget(M)},this.initTexture=function(M){M.isCubeTexture?se.setTextureCube(M,0):M.isData3DTexture?se.setTexture3D(M,0):M.isDataArrayTexture||M.isCompressedArrayTexture?se.setTexture2DArray(M,0):se.setTexture2D(M,0),Lt.unbindTexture()},this.resetState=function(){Y=0,B=0,H=null,Lt.reset(),Et.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Yn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorSpace=Ne._getDrawingBufferColorSpace(t),e.unpackColorSpace=Ne._getUnpackColorSpace()}};var tn=19,Dn=-5,gl=0,Z=1.4,vs=.55,Wc=60,te={uTime:{value:0},uSunDir:{value:new R(.58,.7,.41).normalize()},uSunIntensity:{value:1},uCloudCenter:{value:new bt(-24,-24)},uCloudRadius:{value:new bt(15,11)},uCloudStrength:{value:0},uWindVec:{value:new bt(-.78,.46)},uGustFrontPos:{value:40},uGustStrength:{value:0},uRainDensity:{value:.72},uBoat4Pos:{value:new bt(5.5,5.5)},uBoat4Dir:{value:new bt(0,-1)},uBoat4Speed:{value:0},uWakeTime:{value:-100}};function Ue(i){let t=Math.sin(i*127.1+311.7)*43758.5453123;return t-Math.floor(t)}function Di(i,t,e){let n=Math.max(0,Math.min(1,(e-i)/(t-i)));return n*n*(3-2*n)}function ao(i,t,e,n,s){return s<=i||s>=n?0:s<t?Di(i,t,s):s>e?1-Di(e,n,s):1}function lo(i,t){if(i<=-5&&t<=5.5||i<=3.5&&t>5.5||i>3.5&&i<=5.4&&t>=7.6&&t<=12.2||i>=-5.5&&i<=4.3&&t>=-12.6&&t<=-9.8)return!0;let e=i-4.2,n=t+11.2;return e*e+n*n<=2.1*2.1}function gi(i,t){let e=Math.max(0,i+5),n=Math.max(0,5.5-t),s=Di(0,14,e)*.95,r=Di(0,14,n)*.45,o=Di(3.5,16,i)*.35,a=.16*Math.sin(i*.37+.8)*Math.cos(t*.41-.5)+.08*Math.sin(i*.85-t*.65),l=-2.15-s-r-o+a;if(i>2.5&&i<8.5&&t>11.8&&t<16.8){let c=Di(3.5,8.5,i),h=-.35*(1-c)+-2.2*c;l=Math.max(l,h)}return Math.max(-3.75,Math.min(-1.55,l))}function Es(i,t,e){let n=.032*Math.sin(i*.68+t*.42+e*1.35),s=.022*Math.cos(i*.51-t*.82+e*1.05),r=.014*Math.sin(i*1.35+t*1.15-e*2.15),a=te.uGustStrength.value*.024*Math.sin((i*.9-t*.55)*1.8+e*4.5);return n+s+r+a}function co(i){let t=Math.max(0,Math.min(1,(i-.5)/5.7));return Z+(-.45-Z)*t}function Ms(i){let e=(i%90+90)%90,n=50,s=82,r=new R(6.62,0,9.4),o=0;if(e<n||e>s)return{active:!1,u:0,pos:r,yaw:o,speed:0,wakeProgress:0};let a=(e-n)/(s-n),l=a<.12?a/.12*(a/.12)*.08:a>.88?1-Math.pow((1-a)/.12,2)*.08:.08+(a-.12)/.76*.84,c=[new R(6.62,0,9.4),new R(8.5,0,2.2),new R(11.4,0,-7.2),new R(12.6,0,-14.5),new R(15.6,0,-14.6),new R(15.8,0,-5.2),new R(15,0,5.5),new R(12.2,0,12.6),new R(8.2,0,12),new R(6.62,0,9.4)],h=new yn(c,!1,"centripetal",.45),f=h.getPointAt(Math.max(0,Math.min(1,l))),u=h.getTangentAt(Math.max(0,Math.min(1,l))),d=Math.atan2(-u.x,-u.z),g=ao(0,.12,.85,1,a),v=Di(.9,1,a),m=d+v*Math.atan2(Math.sin(o-d),Math.cos(o-d));return{active:!0,u:a,pos:f,yaw:m,speed:g,wakeProgress:a}}function sd(){return{simTime:0,exportMode:!1,cameraPos:new R(24,14,25),cameraTarget:new R(-1.5,1.8,-1),gullFleeTimer:0,fishScatterAmount:0,fishCooldown:0,catLookAmount:0,drips:[],ripples:[],gustProgress:-1}}function Xc(i){i.simTime=0,i.gullFleeTimer=0,i.fishScatterAmount=0,i.fishCooldown=0,i.catLookAmount=0,i.drips.length=0,i.ripples.length=0,i.gustProgress=-1,Ji(i,0,0)}function Ji(i,t,e){i.simTime=t,te.uTime.value=t;let n=.65+.25*Math.sin(t*.16+.5)+.1*Math.cos(t*.29),s=ao(49.5,52,54.8,57.5,t%60),r=t>59?ao(60,62.5,76.5,81.5,t%84):0,o=Math.max(.24,Math.min(1,n*(1-.62*s)*(1-.58*r)));te.uRainDensity.value=o;let a=((t-24.5)%30+30)%30,l=t>=24&&a<6.5,c=l?ao(0,1.2,4.2,6.5,a):0,h=l?-26+a/6.5*52:40;te.uGustStrength.value=c,te.uGustFrontPos.value=h;let f=(t+8)%28/28,u=-34+f*68,d=-24+f*48;te.uCloudCenter.value.set(u,d);let v=1-.24*ao(50.5,52,54,55.8,t%60);te.uSunIntensity.value=v;let m=Ms(t);if(te.uBoat4Pos.value.set(m.pos.x,m.pos.z),te.uBoat4Dir.value.set(-Math.sin(m.yaw),-Math.cos(m.yaw)),te.uBoat4Speed.value=m.speed,e>0){let p=new R(-4.2,1.93,5.85),y=i.cameraPos.distanceTo(p);y<3.65&&i.gullFleeTimer<=0&&(i.gullFleeTimer=.001),i.gullFleeTimer>0&&(i.gullFleeTimer+=e,i.gullFleeTimer>14&&y>7&&(i.gullFleeTimer=0));let T=new R(2.55,.78,14.15),A=i.cameraPos.distanceTo(T)<5.2?1:0;i.catLookAmount+=(A-i.catLookAmount)*Math.min(1,e*4);let w=new R(10.6,-1.5,3.6),x=i.cameraPos.distanceTo(w);if(x<9.5&&i.fishCooldown<=0)i.fishScatterAmount=Math.min(1,i.fishScatterAmount+e*2.8),i.fishScatterAmount>.92&&(i.fishCooldown=5.5);else{i.fishCooldown>0&&(i.fishCooldown=Math.max(0,i.fishCooldown-e));let S=x<9.5&&i.fishCooldown>2.5?.15:.45;i.fishScatterAmount=Math.max(0,i.fishScatterAmount-e*S)}}}var qc=null;function Xx(){if(qc)return qc;let i=64,t=new Uint8Array(i*4);for(let n=0;n<i;n++){let s=n/(i-1),r;s<.34?r=.62:s<.39?r=.62+(s-.34)/.05*.16:s<.64?r=.78:s<.69?r=.78+(s-.64)/.05*.14:s<.89?r=.92:s<.93?r=.92+(s-.89)/.04*.08:r=1;let o=Math.round(r*255);t[n*4]=o,t[n*4+1]=o,t[n*4+2]=o,t[n*4+3]=255}let e=new os(t,i,1,An);return e.minFilter=Qe,e.magFilter=Qe,e.generateMipmaps=!1,e.needsUpdate=!0,qc=e,e}function vt(i={}){let{color:t=16777215,map:e=null,emissive:n=0,emissiveMap:s=null,emissiveIntensity:r=1,side:o=Kn,transparent:a=!1,opacity:l=1,alphaTest:c=0,wetness:h=.18,rimStrength:f=.16,causticsStrength:u=0,causticsScale:d=.8,tidalDarken:g=!1,shadowTintStrength:v=.34,vertexColors:m=!1}=i,p=new hs({color:t,map:e,emissive:n,emissiveMap:s,emissiveIntensity:r,gradientMap:Xx(),side:o,transparent:a,opacity:l,alphaTest:c,vertexColors:m});return p.userData.animeOpts={wetness:h,rimStrength:f,causticsStrength:u,causticsScale:d,tidalDarken:g,shadowTintStrength:v},p.customProgramCacheKey=()=>`anime_toon_${g?1:0}_${u>0?1:0}`,p.onBeforeCompile=y=>{y.uniforms.uTime=te.uTime,y.uniforms.uSunDir=te.uSunDir,y.uniforms.uSunIntensity=te.uSunIntensity,y.uniforms.uCloudCenter=te.uCloudCenter,y.uniforms.uCloudRadius=te.uCloudRadius,y.uniforms.uWetness={value:h},y.uniforms.uRimStrength={value:f},y.uniforms.uCausticsStrength={value:u},y.uniforms.uCausticsScale={value:d},y.uniforms.uShadowTintStrength={value:v},y.uniforms.uTidalDarken={value:g?1:0},y.vertexShader=y.vertexShader.replace("#include <common>",`#include <common>
        varying vec3 vAnimeWorldPos;
        varying vec3 vAnimeWorldNormal;`).replace("#include <project_vertex>",`#include <project_vertex>
        vec4 animeWPos = vec4( transformed, 1.0 );
        #ifdef USE_BATCHING
          animeWPos = batchingMatrix * animeWPos;
        #endif
        #ifdef USE_INSTANCING
          animeWPos = instanceMatrix * animeWPos;
        #endif
        animeWPos = modelMatrix * animeWPos;
        vAnimeWorldPos = animeWPos.xyz;

        vec3 animeWNorm = objectNormal;
        #ifdef USE_INSTANCING
          animeWNorm = mat3( instanceMatrix ) * animeWNorm;
        #endif
        vAnimeWorldNormal = normalize( mat3( modelMatrix ) * animeWNorm );`),y.fragmentShader=y.fragmentShader.replace("#include <common>",`#include <common>
        varying vec3 vAnimeWorldPos;
        varying vec3 vAnimeWorldNormal;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform float uSunIntensity;
        uniform vec2 uCloudCenter;
        uniform vec2 uCloudRadius;
        uniform float uWetness;
        uniform float uRimStrength;
        uniform float uCausticsStrength;
        uniform float uCausticsScale;
        uniform float uShadowTintStrength;
        uniform float uTidalDarken;

        float animeCloudMask(vec2 xz) {
          vec2 d = (xz - uCloudCenter) / uCloudRadius;
          float r2 = dot(d, d);
          float wisp = 0.14 * sin(xz.x * 0.22 + uTime * 0.15) * cos(xz.y * 0.18 - uTime * 0.11);
          float cov = 1.0 - smoothstep(0.35, 1.15, r2 + wisp);
          return 1.0 - 0.36 * cov;
        }

        float animeCausticPattern(vec2 p, float t) {
          float c1 = sin(p.x * 2.7 + t * 1.45 + sin(p.y * 2.2 - t * 1.15));
          float c2 = cos(p.y * 2.9 - t * 1.35 + cos(p.x * 2.4 + t * 0.95));
          float c3 = sin((p.x - p.y) * 3.8 + t * 1.1);
          float v = abs(c1 + c2) * 0.5;
          float ridge = smoothstep(0.56, 0.88, 1.0 - v);
          float lace = smoothstep(0.62, 0.94, 1.0 - abs(c3));
          return clamp(ridge * 0.8 + lace * 0.35, 0.0, 1.0);
        }`).replace("#include <opaque_fragment>",`
        // Compute local sunlight & drifting cloud shadow modulation
        float cloudFactor = animeCloudMask(vAnimeWorldPos.xz) * uSunIntensity;
        float sunLitRatio = clamp(length(reflectedLight.directDiffuse) / max(0.001, length(diffuseColor.rgb)), 0.0, 1.0);

        // Apply drifting cloud shadow softly to direct diffuse while preserving sky bounce
        reflectedLight.directDiffuse *= mix(0.62, 1.08, cloudFactor);

        // Deep coastal teal shadow tint on shaded undersides / walls
        vec3 deepTealShadow = vec3(0.16, 0.38, 0.49);
        float shadowMix = (1.0 - smoothstep(0.08, 0.55, sunLitRatio)) * uShadowTintStrength;
        vec3 baseOut = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
        baseOut = mix(baseOut, baseOut * vec3(0.76, 0.92, 1.02) + deepTealShadow * diffuseColor.rgb * 0.26, shadowMix);

        // Tidal wet gradient along quay masonry & concrete near waterline
        if (uTidalDarken > 0.5) {
          float tideZone = 1.0 - smoothstep(-0.35, 0.85, vAnimeWorldPos.y);
          float subZone = 1.0 - smoothstep(-0.85, 0.12, vAnimeWorldPos.y);
          float dampNoise = 0.08 * sin(vAnimeWorldPos.x * 2.7 + vAnimeWorldPos.z * 2.3);
          float wetAmt = clamp(tideZone + dampNoise, 0.0, 1.0);
          baseOut = mix(baseOut, baseOut * vec3(0.70, 0.78, 0.80), wetAmt * 0.48);
          baseOut = mix(baseOut, baseOut * vec3(0.46, 0.62, 0.58), subZone * 0.52);
        }

        // Wet surface specular highlight & warm golden rim light in sun-rain
        vec3 wNorm = normalize(vAnimeWorldNormal);
        vec3 viewDirW = normalize(cameraPosition - vAnimeWorldPos);
        vec3 halfVec = normalize(normalize(uSunDir) + viewDirW);
        float ndh = max(dot(wNorm, halfVec), 0.0);
        float wetSpec = smoothstep(0.86, 0.94, ndh) * uWetness * cloudFactor * smoothstep(0.05, 0.4, sunLitRatio);
        baseOut += vec3(1.0, 0.94, 0.78) * wetSpec * 0.45;

        // Soft anime rim highlight on silhouettes facing sun/sky
        float fresnel = pow(1.0 - max(dot(wNorm, viewDirW), 0.0), 3.0);
        float sunRim = smoothstep(0.2, 0.85, dot(wNorm, normalize(uSunDir)) * 0.5 + 0.5);
        float rimBand = smoothstep(0.48, 0.62, fresnel * sunRim) * uRimStrength * cloudFactor;
        baseOut += vec3(1.0, 0.95, 0.82) * rimBand * 0.38;

        // Animated shimmering water reflection caustics on indoor ceilings & boat roofs (facing down -Y)
        if (uCausticsStrength > 0.001) {
          float caust = animeCausticPattern(vAnimeWorldPos.xz * uCausticsScale, uTime);
          float downward = 1.0 - smoothstep(-0.85, -0.05, wNorm.y);
          float wallEdge = 0.25 * (1.0 - abs(wNorm.y));
          float mask = cloudFactor * clamp(downward + wallEdge, 0.0, 1.0);
          baseOut = mix(baseOut, baseOut * vec3(0.76, 0.90, 0.94), mask * 0.32 * uCausticsStrength);
          baseOut += vec3(0.62, 0.96, 0.90) * caust * uCausticsStrength * mask * 0.42;
        }

        outgoingLight = baseOut;
        #include <opaque_fragment>
        `)},p}function rd(){return new Xe({uniforms:{},vertexShader:`
      #include <common>
      #include <batching_pars_vertex>
      #include <normal_pars_vertex>
      #include <morphtarget_pars_vertex>
      #include <skinning_pars_vertex>
      varying vec3 vViewNorm;
      varying float vLinDepth;
      void main() {
        #include <beginnormal_vertex>
        #include <morphnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <morphtarget_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vViewNorm = normalize(transformedNormal);
        vLinDepth = -mvPosition.z;
      }
    `,fragmentShader:`
      varying vec3 vViewNorm;
      varying float vLinDepth;
      void main() {
        vec3 n = normalize(vViewNorm) * 0.5 + 0.5;
        gl_FragColor = vec4(n, vLinDepth);
      }
    `})}function od(i){let t=new ss,e=new ds(-1,1,1,-1,0,1),n={tGBuffer:{value:i},uTexelSize:{value:new bt(1/1280,1/720)},uInkColor:{value:new fe(2179668)}},s=new Xe({uniforms:n,transparent:!0,depthTest:!1,depthWrite:!1,vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,fragmentShader:`
      uniform sampler2D tGBuffer;
      uniform vec2 uTexelSize;
      uniform vec3 uInkColor;
      varying vec2 vUv;

      void main() {
        vec4 c = texture2D(tGBuffer, vUv);
        float dC = c.a;
        vec3 nC = c.rgb * 2.0 - 1.0;

        vec2 dx = vec2(uTexelSize.x, 0.0);
        vec2 dy = vec2(0.0, uTexelSize.y);

        vec4 sL = texture2D(tGBuffer, vUv - dx);
        vec4 sR = texture2D(tGBuffer, vUv + dx);
        vec4 sU = texture2D(tGBuffer, vUv + dy);
        vec4 sD = texture2D(tGBuffer, vUv - dy);

        // Depth silhouette discontinuity (relative threshold scales naturally across zoom)
        float dDiff = max(
          max(abs(sL.a - dC), abs(sR.a - dC)),
          max(abs(sU.a - dC), abs(sD.a - dC))
        );
        float minD = min(min(dC, sL.a), min(sR.a, min(sU.a, sD.a)));
        float depthEdge = smoothstep(0.045 * max(minD, 1.0), 0.14 * max(minD, 1.0), dDiff);

        // Normal crease edge (suppress far horizon noise)
        float nDiff = max(
          max(length((sL.rgb * 2.0 - 1.0) - nC), length((sR.rgb * 2.0 - 1.0) - nC)),
          max(length((sU.rgb * 2.0 - 1.0) - nC), length((sD.rgb * 2.0 - 1.0) - nC))
        );
        float normalEdge = smoothstep(0.42, 0.78, nDiff);

        // Distance fade so distant objects stay dreamy & high-key
        float distFade = 1.0 - smoothstep(42.0, 88.0, minD);
        float edge = clamp(max(depthEdge * 0.95, normalEdge * 0.62), 0.0, 1.0) * distFade;

        if (edge < 0.02) discard;
        gl_FragColor = vec4(uInkColor, edge * 0.46);
      }
    `}),r=new P(new be(2,2),s);return r.frustumCulled=!1,t.add(r),{scene:t,camera:e,setResolution(o,a){n.uTexelSize.value.set(1/Math.max(1,o),1/Math.max(1,a))},setTexture(o){n.tGBuffer.value=o}}}var oi='"Yu Gothic", "Source Han Sans CN", "Noto Sans SC", "Microsoft YaHei", sans-serif',qx='"Shippori Mincho B1 Medium", "Source Han Serif CN", "Noto Serif SC", "MS PMincho", serif';function sn(i,t){let e=document.createElement("canvas");return e.width=i,e.height=t,e}function rn(i,{repeatX:t=1,repeatY:e=1,srgb:n=!0}={}){let s=new Rr(i);return s.wrapS=is,s.wrapT=is,s.repeat.set(t,e),n&&(s.colorSpace=_n),s.anisotropy=8,s.needsUpdate=!0,s}function Li(i){let t=i>>>0;return()=>(t=t*1664525+1013904223>>>0,t/4294967296)}function ad(){let i=sn(512,512),t=i.getContext("2d"),e=Li(101);t.fillStyle="#dde5e7",t.fillRect(0,0,512,512);for(let n=0;n<65;n++){let s=e()*512,r=e()*512,o=18+e()*68,a=t.createRadialGradient(s,r,o*.1,s,r,o),l=e()>.45?"rgba(138, 158, 165, 0.16)":"rgba(245, 250, 252, 0.14)";a.addColorStop(0,l),a.addColorStop(1,"rgba(220, 230, 233, 0)"),t.fillStyle=a,t.beginPath(),t.arc(s,r,o,0,Math.PI*2),t.fill()}for(let n=0;n<2200;n++){let s=e()*512,r=e()*512,o=e()>.5?"rgba(95,115,122,0.12)":"rgba(255,255,255,0.18)";t.fillStyle=o,t.fillRect(s,r,1+e()*2,1+e()*2)}t.strokeStyle="rgba(105, 125, 134, 0.42)",t.lineWidth=2;for(let n=0;n<512;n+=128)t.beginPath(),t.moveTo(n,0),t.lineTo(n,512),t.moveTo(0,n),t.lineTo(512,n),t.stroke();return rn(i,{repeatX:5,repeatY:5})}function xl(){let i=sn(512,512),t=i.getContext("2d"),e=Li(202);t.fillStyle="#cdd8db",t.fillRect(0,0,512,512);let n=5,s=512/n;for(let r=0;r<n;r++){let o=r*s,a=4,l=512/a,c=r%2*(l*.5);for(let h=-1;h<=a;h++){let f=h*l+c,u=200+Math.floor((e()-.5)*20);t.fillStyle=`rgb(${u-6}, ${u+3}, ${u+7})`,t.fillRect(f+2,o+2,l-4,s-4);for(let d=0;d<5;d++){let g=f+6+e()*(l-12);t.fillStyle="rgba(85, 108, 118, 0.14)",t.fillRect(g,o+3,3+e()*6,s-6)}}t.fillStyle="rgba(72, 92, 102, 0.55)",t.fillRect(0,o,512,4)}for(let r=0;r<n;r++){let o=r*s,a=4,l=512/a,c=r%2*(l*.5);t.fillStyle="rgba(72, 92, 102, 0.5)";for(let h=0;h<=a;h++){let f=((h*l+c)%512+512)%512;t.fillRect(f,o,3,s)}}return rn(i,{repeatX:4,repeatY:1})}function ld(){let i=sn(512,128),t=i.getContext("2d"),e=Li(303);t.fillStyle="#f2c12e",t.fillRect(0,0,512,128),t.fillStyle="#252d33";let n=46;for(let s=-128;s<640;s+=n*2)t.beginPath(),t.moveTo(s,128),t.lineTo(s+n,128),t.lineTo(s+n+96,0),t.lineTo(s+96,0),t.closePath(),t.fill();for(let s=0;s<90;s++){t.fillStyle=e()>.35?"rgba(216, 224, 226, 0.65)":"rgba(130, 145, 150, 0.45)";let r=e()*512,o=e()<.5?e()*24:e()*128;t.fillRect(r,o,3+e()*14,2+e()*8)}return rn(i,{repeatX:1,repeatY:1})}function cd(){let i=sn(512,512),t=i.getContext("2d"),e=Li(404);t.fillStyle="#8cb7b3",t.fillRect(0,0,512,512);for(let n=0;n<80;n++){let s=e()*512,r=e()*512,o=20+e()*55,a=t.createRadialGradient(s,r,2,s,r,o);a.addColorStop(0,e()>.5?"rgba(176, 204, 188, 0.32)":"rgba(78, 126, 128, 0.28)"),a.addColorStop(1,"rgba(120,165,162,0)"),t.fillStyle=a,t.beginPath(),t.arc(s,r,o,0,Math.PI*2),t.fill()}for(let n=0;n<2400;n++){let s=e()*512,r=e()*512,o=1.5+e()*4.5,a=e();t.fillStyle=a>.72?"#d7e3d6":a>.35?"#6d9494":"#4a6e72",t.beginPath(),t.ellipse(s,r,o,o*.75,e()*Math.PI,0,Math.PI*2),t.fill()}return rn(i,{repeatX:6,repeatY:6})}function hd(){let i=sn(256,256),t=i.getContext("2d");t.fillStyle="#38566d",t.fillRect(0,0,256,256);let e=8,n=8,s=256/e,r=256/n;for(let o=0;o<n;o++){let a=o*r;for(let l=0;l<e;l++){let c=l*s,h=t.createLinearGradient(c,a,c+s,a);h.addColorStop(0,"#2a4559"),h.addColorStop(.45,"#4c6d85"),h.addColorStop(.85,"#3b5a72"),h.addColorStop(1,"#22384a"),t.fillStyle=h,t.fillRect(c,a,s,r-2)}t.fillStyle="#1f3242",t.fillRect(0,a+r-3,256,3)}return rn(i,{repeatX:3,repeatY:2})}function ho(i="#dae5e8"){let t=sn(256,256),e=t.getContext("2d"),n=Li(505);e.fillStyle=i,e.fillRect(0,0,256,256);for(let r=0;r<256;r+=16)e.fillStyle="rgba(255,255,255,0.28)",e.fillRect(r,0,5,256),e.fillStyle="rgba(72, 102, 118, 0.22)",e.fillRect(r+8,0,6,256);let s=e.createLinearGradient(0,195,0,256);s.addColorStop(0,"rgba(175, 102, 66, 0)"),s.addColorStop(1,"rgba(155, 86, 52, 0.36)"),e.fillStyle=s,e.fillRect(0,195,256,61);for(let r=0;r<40;r++)e.fillStyle="rgba(155, 86, 52, 0.22)",e.fillRect(n()*256,200+n()*52,4+n()*14,3+n()*10);return rn(t,{repeatX:2,repeatY:1})}function ud(){let i=sn(512,320),t=i.getContext("2d");t.fillStyle="#253b38",t.fillRect(0,0,512,320);let e=t.createRadialGradient(256,160,20,256,160,240);e.addColorStop(0,"rgba(235, 245, 240, 0.08)"),e.addColorStop(1,"rgba(20, 35, 32, 0.16)"),t.fillStyle=e,t.fillRect(0,0,512,320),t.strokeStyle="rgba(245, 248, 242, 0.72)",t.lineWidth=3,t.strokeRect(14,14,484,292),t.fillStyle="#f4e39e",t.font=`bold 32px ${oi}`,t.fillText("\u672C\u65E5\u306E\u6C34\u63DA\u3052\u30FB\u7AF6\u308A\u5024",36,58),t.strokeStyle="rgba(244, 227, 158, 0.55)",t.beginPath(),t.moveTo(32,74),t.lineTo(476,74),t.stroke();let n=[["\u771F\u9BDB (\u30DE\u30C0\u30A4)","\xA5 1,850 / kg"],["\u771F\u9BF5 (\u30DE\u30A2\u30B8)","\xA5   680 / kg"],["\u30B9\u30EB\u30E1\u30A4\u30AB","\xA5   980 / \u676F"],["\u4F0A\u52E2\u6D77\u8001","\xA5 4,200 / kg"],["\u9752\u80CC\u30B5\u30D0","\xA5   520 / kg"]];return t.font=`24px ${oi}`,n.forEach(([s,r],o)=>{let a=116+o*40;t.fillStyle="#eef5ef",t.fillText(s,40,a),t.fillStyle=o===3?"#f7b89c":"#d6f0ea",t.fillText(r,290,a)}),rn(i,{repeatX:1,repeatY:1})}function dd(){let i=sn(384,512),t=i.getContext("2d");t.fillStyle="#efe6cf",t.fillRect(0,0,384,512),t.strokeStyle="#6f828a",t.lineWidth=6,t.strokeRect(12,12,360,488),t.fillStyle="#2c5b73",t.fillRect(24,24,336,66),t.fillStyle="#f8f5ea",t.font=`bold 26px ${oi}`,t.fillText("\u6F6E\u98A8\u6E2F \u5B9A\u671F\u8239\u6642\u523B\u8868",52,66),t.fillStyle="#3b4a52",t.font=`18px ${oi}`,t.fillText("\u884C\u5148\uFF1A\u6C96\u30CE\u5CF6\u30FB\u5357\u6D5C",36,122);let e=[["\u7B2C1\u4FBF","07:20","07:55"],["\u7B2C2\u4FBF","10:45","11:20"],["\u7B2C3\u4FBF","14:10","14:45"],["\u7B2C4\u4FBF","16:35","17:10"],["\u6700\u7D42\u4FBF","18:05","18:40"]];return t.strokeStyle="#9aa6aa",t.lineWidth=2,e.forEach(([n,s,r],o)=>{let a=175+o*54;t.fillStyle=o%2===0?"rgba(44, 91, 115, 0.08)":"rgba(255,255,255,0.22)",t.fillRect(30,a-30,324,44),t.fillStyle="#2d3b42",t.font=`bold 21px ${oi}`,t.fillText(n,44,a),t.fillText(`${s} \u2192 ${r}`,152,a)}),t.fillStyle="#b45340",t.font=`16px ${oi}`,t.fillText("\u203B \u96E8\u5929\u30FB\u5F37\u98A8\u6642\u306F\u6B20\u822A\u306E\u5834\u5408\u3042\u308A",44,466),rn(i)}function fd(){let i=sn(256,256),t=i.getContext("2d");t.fillStyle="#f4f1e6",t.beginPath(),t.arc(128,128,120,0,Math.PI*2),t.fill(),t.strokeStyle="#344c57",t.lineWidth=10,t.stroke();for(let e=0;e<12;e++){let n=e/12*Math.PI*2,s=e%3===0?84:94,r=106;t.strokeStyle="#2d404a",t.lineWidth=e%3===0?5:3,t.beginPath(),t.moveTo(128+Math.cos(n)*s,128+Math.sin(n)*s),t.lineTo(128+Math.cos(n)*r,128+Math.sin(n)*r),t.stroke()}return t.strokeStyle="#233038",t.lineWidth=7,t.lineCap="round",t.beginPath(),t.moveTo(128,128),t.lineTo(128+Math.cos(.45)*60,128+Math.sin(.45)*60),t.stroke(),t.lineWidth=5,t.beginPath(),t.moveTo(128,128),t.lineTo(128+Math.cos(-.15)*88,128+Math.sin(-.15)*88),t.stroke(),t.fillStyle="#c85b42",t.beginPath(),t.arc(128,128,8,0,Math.PI*2),t.fill(),rn(i)}function pd(){let i=sn(256,256),t=i.getContext("2d");t.fillStyle="#07241e",t.fillRect(0,0,256,256),t.strokeStyle="#1f7a58",t.lineWidth=2,[36,72,108].forEach(n=>{t.beginPath(),t.arc(128,128,n,0,Math.PI*2),t.stroke()}),t.beginPath(),t.moveTo(16,128),t.lineTo(240,128),t.moveTo(128,16),t.lineTo(128,240),t.stroke();let e=t.createRadialGradient(128,128,4,128,128,110);return e.addColorStop(0,"rgba(90, 255, 175, 0.55)"),e.addColorStop(1,"rgba(30, 160, 105, 0.08)"),t.fillStyle=e,t.beginPath(),t.moveTo(128,128),t.arc(128,128,108,-.9,-.15),t.closePath(),t.fill(),t.fillStyle="#8affc4",[[164,88,5],[182,104,4],[82,152,6],[146,62,4]].forEach(([n,s,r])=>{t.beginPath(),t.arc(n,s,r,0,Math.PI*2),t.fill()}),rn(i)}function md(){let i=sn(256,192),t=i.getContext("2d"),e=t.createLinearGradient(0,0,0,192);e.addColorStop(0,"#0c3554"),e.addColorStop(1,"#061a2c"),t.fillStyle=e,t.fillRect(0,0,256,192),t.strokeStyle="rgba(110, 210, 245, 0.28)",t.lineWidth=1;for(let s=32;s<192;s+=32)t.beginPath(),t.moveTo(0,s),t.lineTo(256,s),t.stroke();t.fillStyle="#d9693b",t.beginPath(),t.moveTo(0,192);for(let s=0;s<=256;s+=16)t.lineTo(s,148+Math.sin(s*.05)*14);return t.lineTo(256,192),t.closePath(),t.fill(),[[68,86],[94,78],[118,92],[154,74],[176,88]].forEach(([s,r])=>{t.strokeStyle="#ffdf5e",t.lineWidth=4,t.beginPath(),t.arc(s,r,10,Math.PI*1.15,Math.PI*1.85),t.stroke()}),t.fillStyle="#8ef5ff",t.font="bold 20px monospace",t.fillText("14.2m",12,26),rn(i)}function gd(){let i=sn(256,320),t=i.getContext("2d");t.fillStyle="#f5f2e4",t.fillRect(0,0,256,320),t.fillStyle="#cfeef2",t.fillRect(16,18,224,172),t.fillStyle="#e5dcc3",t.beginPath(),t.moveTo(16,18),t.lineTo(120,18),t.lineTo(95,110),t.lineTo(16,145),t.closePath(),t.fill(),t.fillStyle="#294859",t.font="bold 13px sans-serif",t.fillText("CHART \u6D77\u56F3",24,36),t.font="11px monospace",t.fillStyle="#3d697a",t.fillText("5.8m",124,148),t.fillText("3.2m",142,74),t.strokeStyle="#cc4d3d",t.setLineDash([6,4]),t.lineWidth=2.5,t.beginPath(),t.moveTo(74,130),t.lineTo(165,92),t.lineTo(205,52),t.stroke(),t.setLineDash([]),t.strokeStyle="#406b7d",t.beginPath(),t.arc(196,148,20,0,Math.PI*2),t.stroke(),t.fillStyle="#2d5c78",t.fillRect(16,200,224,20),t.fillStyle="#ffffff",t.font="bold 12px sans-serif",t.fillText("\u6F6E\u6C50\u8868 TIDE TABLE",24,215),t.strokeStyle="#2d5c78",t.lineWidth=2,t.strokeRect(16,220,224,82),t.beginPath();for(let e=22;e<=234;e+=8){let n=(e-22)/212,s=264-Math.sin(n*Math.PI*2.2)*24;e===22?t.moveTo(e,s):t.lineTo(e,s)}return t.stroke(),t.fillStyle="#406072",t.font="10px monospace",t.fillText("06h      12h      18h",26,297),rn(i)}function xd(){let i=sn(192,144),t=i.getContext("2d");return t.fillStyle="#f7f5ee",t.fillRect(0,0,192,144),t.fillStyle="#7ec8d8",t.fillRect(12,12,168,102),t.fillStyle="#43899e",t.fillRect(12,74,168,40),t.fillStyle="#e56f5b",t.beginPath(),t.ellipse(100,66,42,18,-.25,0,Math.PI*2),t.fill(),t.beginPath(),t.moveTo(136,56),t.lineTo(156,44),t.lineTo(152,74),t.closePath(),t.fill(),rn(i)}function _d(){let i=sn(128,192),t=i.getContext("2d");return t.fillStyle="#c84b3d",t.fillRect(0,0,128,192),t.strokeStyle="#f3cb6c",t.lineWidth=6,t.strokeRect(10,10,108,172),t.fillStyle="#f5eedc",t.fillRect(36,38,56,114),t.fillStyle="#2d3a40",t.font=`bold 24px ${qx}`,["\u822A","\u6D77","\u5B89","\u5168"].forEach((e,n)=>{t.fillText(e,52,66+n*26)}),rn(i)}function yd(){let i=sn(512,360),t=i.getContext("2d"),e=Li(606);t.fillStyle="#f0ede0",t.fillRect(0,0,512,360),t.fillStyle="#2e6f86",t.fillRect(18,18,476,112),t.fillStyle="#f7f8f5",t.font=`bold 44px ${oi}`,t.fillText("\u6F6E\u98A8\u6F01\u6E2F",152,76),t.font=`24px ${oi}`,t.fillText("\u7B2C\u4E09\u5CB8\u58C1\u30FB\u5C0F\u578B\u8239\u6CCA\u5730",132,114),t.fillStyle="#d95343",t.fillRect(28,152,456,14),t.fillStyle="#c94334",t.font=`bold 64px ${oi}`,t.fillText("\u6CE8\u610F\u843D\u6C34",124,242),t.fillStyle="#334854",t.font=`26px ${oi}`,t.fillText("\u8DB3\u5143\u6ED1\u308A\u3084\u3059\u3057\u30FB\u7ACB\u5165\u6CE8\u610F",96,298),t.strokeStyle="#3d5866",t.lineWidth=6,t.strokeRect(12,12,488,336),[[30,30],[482,30],[30,330],[482,330]].forEach(([n,s])=>{let r=t.createRadialGradient(n,s,2,n,s,26);r.addColorStop(0,"rgba(148, 72, 40, 0.72)"),r.addColorStop(1,"rgba(148, 72, 40, 0)"),t.fillStyle=r,t.beginPath(),t.arc(n,s,26,0,Math.PI*2),t.fill()});for(let n=0;n<60;n++)t.fillStyle="rgba(195, 200, 192, 0.45)",t.fillRect(e()*512,e()*360,4+e()*14,2+e()*6);return rn(i)}function vd(){let i=sn(384,512),t=i.getContext("2d");return t.fillStyle="#e7eef0",t.fillRect(0,0,384,512),t.fillStyle="#fff9e6",t.fillRect(26,28,332,278),[["#d95847","#4aa869","#387dc4","#e8a238","#429ea6","#8d5ca6"],["#387dc4","#387dc4","#58b878","#58b878","#f0c446","#e06358"],["#68c4d4","#68c4d4","#499e75","#d97a4a","#3c689c","#3c689c"]].forEach((n,s)=>{let r=46+s*86;t.fillStyle="#cfd9dc",t.fillRect(34,r+56,316,12),n.forEach((o,a)=>{let l=44+a*50;t.fillStyle=o,t.fillRect(l,r+8,30,46),t.fillStyle="rgba(255,255,255,0.45)",t.fillRect(l+5,r+14,6,32),t.fillStyle="#263842",t.fillRect(l+2,r+58,26,9)})}),t.fillStyle="#3c8ea8",t.fillRect(24,322,336,84),t.fillStyle="#f8fbff",t.font=`bold 28px ${oi}`,t.fillText("\u3064\u3081\u305F\u301C\u3044 \u304A\u98F2\u7269",62,374),t.fillStyle="#36464f",t.fillRect(42,424,240,56),rn(i)}function Ed(i){let t=sn(512,256),e=t.getContext("2d"),n=Li(i.charCodeAt(0)*97);e.fillStyle="#e88b35",e.fillRect(0,0,512,256),e.fillStyle="rgba(246, 243, 232, 0.35)",e.fillRect(0,26,512,20),e.fillStyle="rgba(250, 246, 232, 0.90)",e.font="bold 88px sans-serif",e.textAlign="center",e.textBaseline="middle",e.fillText(i,128,134),e.fillText(i,384,134);for(let s=0;s<120;s++)e.fillStyle="rgba(235, 228, 210, 0.34)",e.fillRect(n()*512,n()*256,4+n()*14,2+n()*8);return rn(t)}function Md(){let i=sn(256,256),t=i.getContext("2d");t.clearRect(0,0,256,256),t.strokeStyle="#3f7673",t.lineWidth=4.5;let e=28;for(let s=-256;s<=512;s+=e)t.beginPath(),t.moveTo(s,0),t.lineTo(s+256,256),t.stroke(),t.beginPath(),t.moveTo(s+256,0),t.lineTo(s,256),t.stroke();return t.fillStyle="#538a84",t.fillRect(0,0,256,10),t.fillRect(0,246,256,10),rn(i,{repeatX:2,repeatY:1})}function Sd(i,t="#3a869e",e=701){let n=sn(512,256),s=n.getContext("2d"),r=Li(e);s.fillStyle="#f3f7f8",s.fillRect(0,0,512,256),s.fillStyle=t,s.fillRect(0,62,512,22),s.fillStyle="#2d5c70",s.fillRect(0,196,512,60),s.fillStyle="#2f4b5a",s.font="bold 28px sans-serif",s.textAlign="center",s.fillText(i,256,126),s.textAlign="left";for(let o=0;o<18;o++){let a=40+r()*430,l=48+r()*135,c=s.createLinearGradient(a,l,a,l+34);c.addColorStop(0,"rgba(165, 88, 52, 0.42)"),c.addColorStop(1,"rgba(165, 88, 52, 0)"),s.fillStyle=c,s.fillRect(a-4,l,8+r()*8,24+r()*20)}return rn(n)}function uo({darkWet:i=!1}={}){let t=sn(256,128),e=t.getContext("2d"),n=Li(i?912:419);e.fillStyle=i?"#72341c":"#d2673d",e.fillRect(0,0,256,128);for(let s=-128;s<=384;s+=24)e.strokeStyle=i?"rgba(42, 16, 8, 0.52)":"rgba(112, 46, 20, 0.42)",e.lineWidth=7,e.beginPath(),e.moveTo(s,0),e.lineTo(s+128,128),e.stroke(),e.strokeStyle=i?"rgba(148, 80, 52, 0.34)":"rgba(244, 168, 122, 0.38)",e.lineWidth=4,e.beginPath(),e.moveTo(s+8,0),e.lineTo(s+136,128),e.stroke();for(let s=0;s<180;s++){let r=n()*256,o=n()*128,a=10+n()*18;e.strokeStyle=n()>.5?i?"rgba(46, 18, 9, 0.35)":"rgba(128, 52, 22, 0.28)":i?"rgba(162, 96, 66, 0.24)":"rgba(255, 204, 166, 0.26)",e.lineWidth=1.2,e.beginPath(),e.moveTo(r,o),e.lineTo(r+a,o+a),e.stroke()}return rn(t,{repeatX:6,repeatY:2})}function Td(){let i=sn(256,256),t=i.getContext("2d"),e=128,n=128;t.fillStyle="#f5f2e6",t.fillRect(0,0,256,256),t.strokeStyle="#33464f",t.lineWidth=6,t.beginPath(),t.arc(e,n,114,0,Math.PI*2),t.stroke();for(let s=0;s<40;s++){let r=-Math.PI*.5+s/40*Math.PI*2,o=s%4===0,a=o?82:94,l=104;t.strokeStyle=s>=32?"#c94c3e":"#2e414b",t.lineWidth=o?4:2,t.beginPath(),t.moveTo(e+Math.cos(r)*a,n+Math.sin(r)*a),t.lineTo(e+Math.cos(r)*l,n+Math.sin(r)*l),t.stroke()}return t.fillStyle="#2d404a",t.font="bold 20px sans-serif",t.textAlign="center",t.textBaseline="middle",["0","10","20","30","40"].forEach((s,r)=>{let o=-Math.PI*.5+r/5*Math.PI*2;t.fillText(s,e+Math.cos(o)*63,n+Math.sin(o)*63)}),t.font="bold 22px sans-serif",t.fillStyle="#536c77",t.fillText("kg",e,n+32),t.strokeStyle="#d9483b",t.lineWidth=7,t.beginPath(),t.moveTo(e-10,n+16),t.lineTo(e+42,n-68),t.stroke(),t.fillStyle="#2b3940",t.beginPath(),t.arc(e,n,11,0,Math.PI*2),t.fill(),rn(i)}function Yx(i=1){let t=[new R(0,1,0),new R(Math.sqrt(.8888888888888888),-.3333333333333333,0),new R(-Math.sqrt(.2222222222222222),-.3333333333333333,Math.sqrt(.6666666666666666)),new R(-Math.sqrt(.2222222222222222),-.3333333333333333,-Math.sqrt(.6666666666666666))],e=new Jt,n=new en,s=new zt(.16*i,.34*i,.92*i,8);s.translate(0,.42*i,0);let r=new Oe(.32*i,8,6),o=new P(r,n);e.add(o);let a=new R(0,1,0);return t.forEach(l=>{let c=new P(s,n);c.quaternion.setFromUnitVectors(a,l.clone().normalize()),e.add(c)}),{dirs:t,legGeo:s,hubGeo:r}}function wd(i){let t=new Jt;i.add(t);let e=ad(),n=xl(),s=ld(),r=cd(),o=vt({color:15397105,map:e,wetness:.48,rimStrength:.14}),a=vt({color:14213860,map:n,wetness:.32,tidalDarken:!0,shadowTintStrength:.44}),l=vt({color:14936812,wetness:.42,rimStrength:.18}),c=vt({color:2506573,wetness:.08,rimStrength:.08,shadowTintStrength:.25}),h=vt({color:4939624,wetness:.06,shadowTintStrength:.4}),f=vt({color:16777215,map:s,wetness:.35}),u=vt({color:9129528,wetness:.24,shadowTintStrength:.35}),d=vt({color:10799299,map:r,wetness:.05,shadowTintStrength:.35}),g=vt({color:3029826,wetness:.12,shadowTintStrength:.35}),v=vt({color:14541010,wetness:.28}),m=vt({color:9279372,wetness:.28}),p=vt({color:3897950,wetness:.12,side:Re}),y=vt({color:4952945,wetness:.1,side:Re}),T=vt({color:14213602,wetness:.4,tidalDarken:!0,shadowTintStrength:.38});function _(V,ht,Ct,Bt,gt,Ot,le,ne=t){let _e=new P(new Yt(V,ht,Ct),le);return _e.position.set(Bt,gt,Ot),_e.castShadow=!0,_e.receiveShadow=!0,ne.add(_e),_e}_(tn*2+.36,.42,tn*2+.36,0,Dn-.16,0,c),_(tn*2,1.35,tn*2,0,Dn+.675,0,h);let A=Z-Dn,w=Dn+A*.5;function x(V,ht,Ct,Bt,gt=Z){let Ot=ht-V,le=Bt-Ct,ne=(V+ht)*.5,_e=(Ct+Bt)*.5,Le=gt-Dn,Ht=Dn+Le*.5;_(Ot,Le-.16,le,ne,Ht-.08,_e,a),_(Ot,.18,le,ne,gt-.09,_e,o)}x(-19,.5,5.5,19),x(.5,3.5,5.5,10.05),x(.5,2.1,10.05,11.95),x(.5,3.5,11.95,12.6),x(.5,3.5,16,19),x(-19,-5,-19,5.5),_(.32,.18,16,-5+.08,Z-.09,-2.5,l),_(8.5,.18,.32,-.75,Z-.09,5.5-.08,l),_(.32,.18,4.55,3.5-.08,Z-.09,7.775,l),_(.32,.18,3,3.5-.08,Z-.09,17.5,l);let S=vs-Dn;_(1.9,S-.12,4.6,4.45,Dn+(S-.12)*.5,9.9,a),_(1.94,.14,4.64,4.45,vs-.07,9.9,o);let I=5;for(let V=0;V<I;V++){let ht=2.1+(V+.5)*(1.4/I),Bt=Z-(V+1)*((Z-vs)/I)-Dn;_(1.4/I+.02,Bt,1.9,ht,Dn+Bt*.5,11,l)}_(1.65,.22,.24,2.7,Z+.11,12.24,l);let b=new Jt;t.add(b);let N=5.7,G=Z- -.45,K=Math.hypot(N,G),D=Math.atan2(G,N),z=new P(new Yt(K,.44,3.4),o),Y=(Z+-.45)*.5-.22*Math.cos(D),B=(.5+6.2)*.5-.22*Math.sin(D);z.position.set(B,Y,14.3),z.rotation.z=-D,z.castShadow=!0,z.receiveShadow=!0,b.add(z),_(5.6,4.4,3.38,3.35,Dn+2.2,14.3,a,b),[-1.58,1.58].forEach(V=>{let ht=new P(new Yt(K,.2,.22),l);ht.position.set(B+.06,Y+.28,14.3+V),ht.rotation.z=-D,ht.castShadow=!0,ht.receiveShadow=!0,b.add(ht)});function H(V,ht,Ct,Bt){let gt=Math.max(V,ht),Ot=Math.min(V,ht),le=new Yt(gt,.22,Ot),ne=le.attributes.uv,_e=le.attributes.normal;for(let Ht=0;Ht<ne.count;Ht++){let Ge=Math.abs(_e.getY(Ht));Math.abs(_e.getX(Ht))>.5?ne.setX(Ht,ne.getX(Ht)*(Ot/1.8)):ne.setX(Ht,ne.getX(Ht)*(gt/1.8)),Ge>.5&&ne.setY(Ht,ne.getY(Ht)*(Ot/.38))}let Le=new P(le,f);Le.position.set(Ct,Z+.11,Bt),ht>V&&(Le.rotation.y=Math.PI/2),Le.castShadow=!0,Le.receiveShadow=!0,t.add(Le)}H(.38,14.6,-5.22,-2.2),H(8.2,.38,-.85,5.28),H(.38,4.2,3.28,7.65),H(.38,2.5,3.28,17.45);let $=1.55-Dn,Q=Dn+$*.5;_(9.7,$-.15,2.8,-.65,Q-.08,-11.2,a),_(9.7,.16,2.8,-.65,1.55-.08,-11.2,o),_(9.5,.85,.45,-.7,1.55+.425,-12.38,l);let dt=vt({color:12767444,wetness:.3,tidalDarken:!0,shadowTintStrength:.42}),Ft=new P(new zt(2.05,2.18,$,20),dt);Ft.position.set(4.2,Q,-11.2),Ft.castShadow=!0,Ft.receiveShadow=!0,t.add(Ft);let qt=new P(new zt(2.12,2.12,.22,20),l);qt.position.set(4.2,1.46,-11.2),qt.castShadow=!0,qt.receiveShadow=!0,t.add(qt);let O=new Jt;O.position.set(4.2,1.56,-11.2),t.add(O);let xt=vt({color:16054264,wetness:.35,rimStrength:.22}),tt=vt({color:14241083,wetness:.35,rimStrength:.22}),st=vt({color:3492180,wetness:.25}),pt=new P(new zt(.95,1.08,.55,8),xt);pt.position.y=.275,pt.castShadow=!0,pt.receiveShadow=!0,O.add(pt),[[.55,1.05,.84,.77,xt],[1.6,1.05,.77,.69,tt],[2.65,1.05,.69,.61,xt],[3.7,.9,.61,.55,tt]].forEach(([V,ht,Ct,Bt,gt])=>{let Ot=new P(new zt(Bt,Ct,ht,16),gt);Ot.position.y=V+ht*.5,Ot.castShadow=!0,Ot.receiveShadow=!0,O.add(Ot)});let ee=new P(new Yt(.36,.68,.14),st);ee.position.set(0,.92,.8),O.add(ee);let Mt=new P(new Yt(.46,.07,.24),xt);Mt.position.set(0,.56,.84),O.add(Mt);let $t=new P(new Oe(.024,6,6),vt({color:14923862,wetness:.35}));$t.position.set(.11,.9,.88),O.add($t);let lt=new P(new zt(.84,.66,.18,16),xt);lt.position.y=4.65,lt.castShadow=!0,O.add(lt);let k=new P(new De(.8,.025,6,20),st);k.rotation.x=Math.PI/2,k.position.y=5.02,O.add(k);for(let V=0;V<8;V++){let ht=V/8*Math.PI*2,Ct=new P(new zt(.02,.02,.36,6),st);Ct.position.set(Math.cos(ht)*.8,4.86,Math.sin(ht)*.8),O.add(Ct)}let rt=new P(new zt(.46,.46,.68,12),new Jn({color:14677754,transparent:!0,opacity:.46,roughness:.12}));rt.position.y=5.06,rt.layers.set(1),O.add(rt);let ft=new en({color:16773056}),At=new P(new Oe(.22,12,10),ft);At.position.y=5.04,O.add(At);let _t=new fi(16764784,0,9,2);_t.position.set(4.2,6.65,-11.2),_t.layers.enableAll(),i.add(_t);let St=new Jt;St.position.set(0,5.04,0),O.add(St);let Gt=new Xe({transparent:!0,depthWrite:!1,blending:Yi,side:Kn,uniforms:{uIntensity:{value:0}},vertexShader:`
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        vViewNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * mv;
      }
    `,fragmentShader:`
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        float radial = pow(abs(dot(normalize(vViewNormal), normalize(-vViewPos))), 2.6);
        float along = smoothstep(0.0, 0.42, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        gl_FragColor = vec4(1.0, 0.87, 0.50, radial * along * uIntensity * 0.24);
      }
    `}),Zt=new Rn(.72,5.5,20,1,!0);Zt.translate(0,-2.75,0),Zt.rotateX(Math.PI/2);let ie=new P(Zt,Gt);ie.layers.set(1),St.add(ie);let Xt=ie.clone();Xt.rotation.y=Math.PI,Xt.layers.set(1),St.add(Xt);let U=new P(new Rn(.56,.58,16),tt);U.position.y=5.68,U.castShadow=!0,O.add(U);let Pe=new P(new zt(.015,.025,.45,6),st);Pe.position.y=6.12,O.add(Pe);let oe=64,Ae=tn*2,Lt=new be(Ae,Ae,oe,oe);Lt.rotateX(-Math.PI/2);let Me=Lt.attributes.position;for(let V=0;V<Me.count;V++){let ht=Me.getX(V),Ct=Me.getZ(V);Me.setY(V,gi(ht,Ct))}Lt.computeVertexNormals();let Kt=new P(Lt,d);Kt.receiveShadow=!0,t.add(Kt);function se(V,ht,Ct,Bt){let gt=[],Ot=[],le=Dn+1.32;for(let Le=0;Le<=V;Le++){let Ht=Le/V,Ge,ve;ht==="x"?(Ge=Ct,ve=-tn+Ht*(tn*2)):(ve=Ct,Ge=-tn+Ht*(tn*2));let Xn=lo(Ge,ve)?le:gi(Ge,ve);gt.push(Ge,Xn,ve),gt.push(Ge,le,ve)}for(let Le=0;Le<V;Le++){let Ht=Le*2,Ge=Ht+1,ve=Ht+2,Xn=Ht+3;Bt?Ot.push(Ht,ve,Ge,Ge,ve,Xn):Ot.push(Ht,Ge,ve,Ge,Xn,ve)}let ne=new qe;ne.setAttribute("position",new me(gt,3)),ne.setIndex(Ot),ne.computeVertexNormals();let _e=new P(ne,h);_e.receiveShadow=!0,t.add(_e)}se(48,"x",tn,!1),se(48,"z",tn,!0),se(48,"z",-tn,!1);let C=new zt(.025,.065,.055,6),E=new Xs(.07,0),W=[],yt=[],ut=new cn;function nt(V,ht,Ct,Bt,gt,Ot,le){for(let ne=0;ne<le;ne++){let _e=(ne+Ue(ne*19+V))/le,Le=V+(Ct-V)*_e+gt*.02,Ht=ht+(Bt-ht)*_e+Ot*.02,Ge=-.42+Ue(ne*31+ht*7)*.68;ut.position.set(Le,Ge,Ht),ut.quaternion.setFromUnitVectors(new R(0,1,0),new R(gt,0,Ot));let ve=.65+Ue(ne*43)*.9;ut.scale.set(ve,ve*.9,ve),ut.updateMatrix(),ne%3===0?yt.push(ut.matrix.clone()):W.push(ut.matrix.clone())}}nt(-5,-9.6,-5,5.4,1,0,130),nt(-4.9,5.5,3.4,5.5,0,-1,80),nt(3.5,5.6,3.5,7.5,1,0,22),nt(3.5,16.1,3.5,18.8,1,0,26),nt(5.4,7.6,5.4,12.2,1,0,42),nt(-5,-9.8,3.5,-9.8,0,1,75);let et=new as(C,v,W.length);W.forEach((V,ht)=>et.setMatrixAt(ht,V)),et.instanceMatrix.needsUpdate=!0,t.add(et);let J=new as(E,m,yt.length);yt.forEach((V,ht)=>J.setMatrixAt(ht,V)),J.instanceMatrix.needsUpdate=!0,t.add(J);let ot=[],mt=new be(.14,1.05,1,5);mt.translate(0,-.525,0),[[-4.92,-.25,4.2,1,0],[-4.92,-.32,2,1,0],[-4.92,-.2,-1,1,0],[-4.92,-.28,-3.5,1,0],[-4.92,-.22,-6.2,1,0],[-4.92,-.3,-8.5,1,0],[-2.5,-.25,5.42,0,-1],[.5,-.22,5.42,0,-1],[2.6,-.28,5.42,0,-1],[5.46,-.26,8.8,1,0],[5.46,-.3,11.2,1,0],[3.58,-.25,17.5,1,0],[-1.2,-.25,-9.72,0,1],[2.2,-.28,-9.72,0,1]].forEach(([V,ht,Ct,Bt,gt],Ot)=>{for(let le=0;le<2;le++){let ne=new P(mt,p);ne.position.set(V+Bt*.04,ht,Ct+gt*.04+(le-.5)*.24),ne.scale.set(.8+le*.3,.75+Ue(Ot*7+le)*.55,1),ne.rotation.y=Math.atan2(Bt,gt)+(le-.5)*.5,t.add(ne),ot.push({mesh:ne,baseRotY:ne.rotation.y,phase:Ot*1.1+le*1.9})}});let ct=new De(.11,.025,6,12),it=new Yt(.05,.16,.16);[[-4.98,.58,3.2,1,0],[-4.98,.58,-.8,1,0],[-4.98,.58,-5.8,1,0],[-1.5,.58,5.48,0,-1],[1.8,.58,5.48,0,-1],[5.42,.28,9.6,1,0]].forEach(([V,ht,Ct,Bt,gt])=>{let Ot=new P(it,u);Ot.position.set(V,ht,Ct),gt!==0&&(Ot.rotation.y=Math.PI/2),t.add(Ot);let le=new P(ct,u);le.position.set(V+Bt*.07,ht-.08,Ct+gt*.07),gt!==0&&(le.rotation.y=Math.PI/2),le.rotation.x=.25,t.add(le)});function wt(V,ht,Ct){let Bt=new Jt;Bt.position.set(V,0,ht),Bt.rotation.y=Ct,t.add(Bt),[-.22,.22].forEach(gt=>{let Ot=new P(new zt(.028,.028,3.55,6),u);Ot.position.set(gt,-.1,.1),Ot.castShadow=!0,Bt.add(Ot);let le=new P(new De(.14,.026,6,10,Math.PI),u);le.position.set(gt,1.68,-.04),le.rotation.y=Math.PI/2,Bt.add(le)});for(let gt=-1.65;gt<=1.35;gt+=.3){let Ot=new P(new zt(.02,.02,.44,6),u);Ot.rotation.z=Math.PI/2,Ot.position.set(0,gt,.1),Bt.add(Ot)}}wt(-5,1.5,Math.PI/2),wt(5.4,10.6,Math.PI/2);let Et=new Xs(.16,0),Vt=[];for(let V=0;V<85;V++){let ht=-4+Ue(V*11+3)*22,Ct=-18+Ue(V*17+9)*36;if(lo(ht,Ct))continue;let Bt=gi(ht,Ct)+.04;ut.position.set(ht,Bt,Ct),ut.rotation.set(Ue(V)*3,Ue(V+1)*3,Ue(V+2)*3);let gt=.6+Ue(V*23)*1.4;ut.scale.set(gt,gt*.55,gt*.9),ut.updateMatrix(),Vt.push(ut.matrix.clone())}let he=new as(Et,l,Vt.length);Vt.forEach((V,ht)=>he.setMatrixAt(ht,V)),he.receiveShadow=!0,t.add(he);let Tt=new De(.42,.16,8,16);[[8.2,13.8,1.35,.25],[13.4,9.6,1.48,-.18],[1.8,-1.6,1.42,.15],[14.2,-3.2,1.25,-.3],[6.6,16.8,1.5,.1]].forEach(([V,ht,Ct,Bt])=>{let gt=new P(Tt,g);gt.position.set(V,gi(V,ht)+.12,ht),gt.rotation.set(Ct,Ue(V*7)*3,Bt),gt.castShadow=!0,gt.receiveShadow=!0,t.add(gt)});let re=new Jt,kt=10.6,Se=6.8;re.position.set(kt,gi(kt,Se)+.2,Se),re.rotation.set(1.42,.6,-.35),t.add(re);let Be=new P(new zt(.058,.078,1.28,8),u);re.add(Be);let Je=new P(new zt(.042,.042,.88,6),u);Je.rotation.z=Math.PI/2,Je.position.y=.48,re.add(Je);let an=new P(new De(.09,.026,6,12),u);an.position.y=.66,re.add(an);let En=new P(new De(.44,.062,6,12,Math.PI),u);En.position.y=-.22,En.rotation.z=Math.PI,re.add(En),[-.44,.44].forEach(V=>{let ht=new P(new Rn(.11,.2,4),u);ht.position.set(V,-.18,0),ht.rotation.z=V<0?.25:-.25,re.add(ht)});let Fn=new De(.085,.025,5,12);Fn.scale(1.25,.85,1);let Mn=[];for(let V=0;V<=12;V++){let ht=V/12,Ct=10.25+ht*5.6,Bt=6.25+Math.sin(ht*3.4)*1.1+ht*2.1;Mn.push(new R(Ct,gi(Ct,Bt)+.075,Bt))}let ln=new yn(Mn),Ut=42;for(let V=0;V<Ut;V++){let ht=V/(Ut-1),Ct=ln.getPoint(ht),Bt=ln.getTangent(ht),gt=new P(Fn,u);gt.position.copy(Ct),gt.rotation.y=Math.atan2(Bt.x,Bt.z)+Math.PI/2,gt.rotation.x=V%2===0?Math.PI/2-.18:.18,t.add(gt)}let ae=[],we=new be(.11,.72,1,4);we.translate(0,.36,0),[[7.5,11.2],[11.8,14.2],[15.6,11.6],[14.8,4.2],[10.2,1.8],[13.6,-6.5],[7.2,-5.8],[16.2,-13.5],[1.6,1.4],[17,15]].forEach(([V,ht],Ct)=>{let Bt=gi(V,ht);for(let gt=0;gt<6;gt++){let Ot=gt/6*Math.PI*2+Ue(Ct+gt),le=new P(we,y);le.position.set(V+Math.cos(Ot)*.22,Bt-.03,ht+Math.sin(Ot)*.22),le.rotation.y=Ot,le.scale.set(.85,.7+Ue(Ct*5+gt)*.65,1),t.add(le),ae.push({mesh:le,baseRotY:Ot,phase:Ct*.9+gt*.7})}});let{dirs:ge,legGeo:xe,hubGeo:ke}=Yx(.92),We=new R(0,1,0);function Ye(V,ht,Ct,Bt,gt,Ot,le=1){let ne=new Jt;ne.position.set(V,ht,Ct),ne.rotation.set(Bt,gt,Ot),ne.scale.setScalar(le),t.add(ne);let _e=new P(ke,T);_e.castShadow=!0,_e.receiveShadow=!0,ne.add(_e),ge.forEach(Le=>{let Ht=new P(xe,T);Ht.quaternion.setFromUnitVectors(We,Le.clone().normalize()),Ht.castShadow=!0,Ht.receiveShadow=!0,ne.add(Ht)})}[[4.6,-.05,17.5,.2,.5,.1,.98],[5.8,-.15,17.9,-.3,1.8,.4,1.02],[6.6,-.22,16.9,.5,2.4,-.2,.94],[4.4,.48,18.2,1.1,.9,.3,.95],[5.4,.52,17.1,.7,2.1,-.4,.9],[6.4,-.25,18.2,-.4,.2,.6,.92],[7.4,-.35,17.6,.3,1.2,-.5,.88]].forEach(V=>Ye(...V));let Nt=vt({color:7309201,map:n,wetness:.65}),Wt=new P(new zt(2.75,3.65,2.35,14),Nt);Wt.position.set(4.85,-1.55,-11.75),Wt.receiveShadow=!0,t.add(Wt);let ue=new P(new zt(3.45,4.35,1.35,14),Nt);ue.position.set(4.95,-2.55,-11.85),ue.receiveShadow=!0,t.add(ue),[[5.7,-.08,-12.6,.2,.7,.1,.96],[6.4,-.15,-11.4,-.4,1.5,.3,1],[6,-.12,-10.2,.6,2.2,-.2,.94],[4.6,-.1,-13.3,.3,1.1,.4,.95],[3.3,-.05,-13.4,-.2,2.6,-.1,.98],[5.5,.54,-11.8,.8,.4,.5,.88],[4.8,.48,-12.9,-.6,1.9,-.3,.86],[7,-.28,-12.1,.4,2.8,.2,.9]].forEach(V=>Ye(...V));let de=new Jt;i.add(de);let M=new Xe({transparent:!0,depthWrite:!1,uniforms:{uColorNear:{value:new fe(10212058)},uColorFar:{value:new fe(14413811)}},vertexShader:`
      varying vec3 vWPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,fragmentShader:`
      uniform vec3 uColorNear;
      uniform vec3 uColorFar;
      varying vec3 vWPos;
      void main() {
        float r = length(vWPos.xz);
        float innerFade = smoothstep(50.0, 64.0, r);
        float outerFade = 1.0 - smoothstep(115.0, 155.0, r);
        // Emphasize background North/East coastal horizon
        float backBias = smoothstep(25.0, -35.0, vWPos.z) * 0.7 + 0.3;
        float a = innerFade * outerFade * backBias * 0.55;
        vec3 col = mix(uColorNear, uColorFar, smoothstep(55.0, 130.0, r));
        gl_FragColor = vec4(col, a);
      }
    `}),F=new Gr(48,158,72);F.rotateX(-Math.PI/2);let j=new P(F,M);j.position.y=-.35,j.layers.set(2),de.add(j);let X=new Xe({transparent:!0,depthWrite:!1,uniforms:{uColor:{value:new fe(10470093)}},vertexShader:`
      varying vec3 vWPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,fragmentShader:`
      uniform vec3 uColor;
      varying vec3 vWPos;
      void main() {
        float edgeFade = smoothstep(-48.0, -28.0, vWPos.x) * (1.0 - smoothstep(42.0, 62.0, vWPos.x));
        float hFade = smoothstep(-0.35, 0.25, vWPos.y);
        gl_FragColor = vec4(uColor, 0.48 * edgeFade * hFade);
      }
    `}),q=new P(new Yt(108,1.65,3),X);q.position.set(6,.25,-68),q.layers.set(2),de.add(q);let It=new P(new zt(.38,.56,2,10),X);It.position.set(28,1.85,-68),It.layers.set(2),de.add(It);let Dt=new P(new Rn(.44,.52,10),new en({color:13411488,transparent:!0,opacity:.48}));Dt.position.set(28,3.08,-68),Dt.layers.set(2),de.add(Dt);let Rt=[];for(let V=0;V<2;V++){let ht=new Jt,Ct=new P(new Yt(3.2,.75,1.15),new en({color:14938098,transparent:!0,opacity:.7}));Ct.layers.set(2);let Bt=new P(new Yt(1.1,.85,.9),new en({color:10404044,transparent:!0,opacity:.7}));Bt.position.set(-.3,.7,0),Bt.layers.set(2);let gt=new P(new be(4.5,.55),new en({color:16055292,transparent:!0,opacity:.45,side:Re}));gt.rotation.x=-Math.PI/2,gt.position.set(-3.4,-.25,0),gt.layers.set(2),ht.add(Ct,Bt,gt),ht.position.set(V===0?-25:42,.1,V===0?-77:-84),ht.rotation.y=V===0?0:Math.PI,de.add(ht),Rt.push({group:ht,dir:V===0?1:-1,baseX:V===0?-36:48,z:V===0?-77:-84,speed:V===0?1.4:1.05})}return{root:t,lighthouseBeacon:{material:ft,light:_t},update(V,ht){ot.forEach(Ot=>{Ot.mesh.rotation.z=Math.sin(V*1.45+Ot.phase)*.22,Ot.mesh.rotation.x=Math.cos(V*1.1+Ot.phase)*.14}),ae.forEach(Ot=>{Ot.mesh.rotation.z=Math.sin(V*1.3+Ot.phase)*.18,Ot.mesh.rotation.x=Math.cos(V*1.05+Ot.phase)*.12});let Ct=Math.max(0,1-ht)/.24,Bt=Ct>.2?Math.pow(Math.sin(V*1.8%Math.PI),2)*Ct:.08;_t.intensity=Bt*5.2;let gt=.65+Bt*.35;ft.color.setRGB(1*gt,.88*gt,.55*gt),Gt.uniforms.uIntensity.value=Ct>.2?Bt:0,St.rotation.y=V*1.65,Rt.forEach(Ot=>{let ne=(V*Ot.speed%104+104)%104,_e=Ot.dir>0?-52+ne:52-ne;Ot.group.position.x=_e,Ot.group.position.y=.08+Math.sin(V*1.2+Ot.z)*.06})}}}function bd(i){let t=new Jt;i.add(t);let e=ho("#dce7ea"),n=hd(),s=ud(),r=dd(),o=fd(),a=xl(),l=vt({color:14937327,map:e,wetness:.28,rimStrength:.14}),c=vt({color:12965081,wetness:.1,causticsStrength:.85,causticsScale:.65,side:Re}),h=vt({color:11979472,map:ho("#b9cdd3"),wetness:.35}),f=vt({color:6063255,wetness:.45,rimStrength:.2,side:Re}),u=vt({color:4943495,map:n,wetness:.45,rimStrength:.2}),d=vt({color:16052968,wetness:.2}),g=vt({color:12092500,wetness:.15}),v=vt({color:7557174,wetness:.12}),m=vt({color:13689574,wetness:.3}),p=vt({color:15988728,wetness:.55}),y=vt({color:4428474,wetness:.55}),T=vt({color:15710518,wetness:.4}),_=vt({color:3033698,wetness:.4}),A=vt({color:13358809,wetness:.42}),w=vt({color:3689300,wetness:.25}),x=new Jn({color:14677497,transparent:!0,opacity:.22,roughness:.08,depthWrite:!1,side:Re}),S=new Jt;t.add(S);let I=-17.5,b=-10.5,N=-7.5,G=.5,K=b-I,D=G-N,z=(I+b)*.5,Y=(N+G)*.5,B=4.2;function H(Ut,ae,we,ce,ge,xe,ke,We=S){let Ye=new P(new Yt(Ut,ae,we),ke);return Ye.position.set(ce,ge,xe),Ye.castShadow=!0,Ye.receiveShadow=!0,We.add(Ye),Ye}H(K-.1,.04,D-.1,z,Z+.02,Y,vt({color:12767186,wetness:.65})),H(.24,3.15,D,I+.12,Z+1.575,Y,l),H(.24,.35,D,I+.12,Z+B-.175,Y,l);for(let Ut=-7.3;Ut<=.4;Ut+=1.9)H(.24,.72,.16,I+.12,Z+3.5,Ut,m);let $=new P(new be(D-.3,.7),x);$.rotation.y=Math.PI/2,$.position.set(I+.12,Z+3.5,Y),$.layers.set(1),S.add($),H(K,B,.24,z,Z+B*.5,N+.12,l),H(K,3.15,.24,z,Z+1.575,G-.12,l),H(K,.35,.24,z,Z+B-.175,G-.12,l);for(let Ut=-17.3;Ut<=-10.6;Ut+=1.7)H(.16,.72,.24,Ut,Z+3.5,G-.12,m);let Q=new P(new be(K-.3,.7),x);Q.position.set(z,Z+3.5,G-.12),Q.layers.set(1),S.add(Q),H(.24,B,1.8,b-.12,Z+B*.5,-6.6,l),H(.24,B,1.8,b-.12,Z+B*.5,-.4,l),H(.24,.9,4.4,b-.12,Z+B-.45,Y,l),H(.14,1.35,4.35,b-.14,Z+2.82,Y,h),H(.2,.08,4.38,b-.14,Z+2.13,Y,w),[-5.68,-1.32].forEach(Ut=>H(.1,3.3,.08,b-.12,Z+1.65,Ut,w)),H(.38,.42,4.55,b-.02,Z+3.72,Y,m);let dt=H(.12,.46,2.8,b+.02,Z+4.02,Y,vt({color:3633804}));dt.castShadow=!1;let Ft=.25;[-1,1].forEach(Ut=>{let ae=new P(new Yt(4.15,.14,D+.8),f);ae.position.set(z+Ut*1.92,Z+B+.48,Y),ae.rotation.z=-Ut*Ft,ae.castShadow=!0,ae.receiveShadow=!0,S.add(ae);let we=new P(new Yt(3.55,.04,D-.32),c);we.position.set(z+Ut*1.65,Z+B+.38,Y),we.rotation.z=-Ut*Ft,S.add(we)});let qt=new zn;qt.moveTo(-K*.5,0),qt.lineTo(0,.94),qt.lineTo(K*.5,0),qt.closePath();let O=new Zn(qt,{depth:.24,bevelEnabled:!1});O.translate(0,0,-.12),[N+.12,G-.12].forEach(Ut=>{let ae=new P(O,l);ae.position.set(z,Z+B-.01,Ut),ae.castShadow=!0,ae.receiveShadow=!0,S.add(ae)}),H(.24,.08,D+.82,z,Z+B+1.03,Y,m),H(.16,.16,D-.18,z,Z+B+.83,Y,v);for(let Ut=-6.5;Ut<=-.5;Ut+=1.5)H(6.6,.14,.16,z,Z+B-.08,Ut,v);let xt=H(.08,1.38,2.24,I+.28,Z+2.25,-3.5,v);H(.14,.05,2.2,I+.34,Z+1.56,-3.5,v),H(.06,.04,.14,I+.37,Z+1.6,-3.15,w);let tt=new P(new be(2.12,1.26),vt({color:16777215,map:s,wetness:.08}));tt.rotation.y=Math.PI/2,tt.position.set(I+.33,Z+2.25,-3.5),S.add(tt);function st(Ut,ae,we,ce){for(let ge=0;ge<we;ge++){let xe=ce[ge%ce.length],ke=new Jt;ke.position.set(Ut+ge%2*.02,Z+.16+ge*.33,ae),ke.rotation.y=(Ue(Ut*11+ge)-.5)*.16;let We=new P(new Yt(.66,.28,.46),xe);We.castShadow=!0,We.receiveShadow=!0,ke.add(We);let Ye=new P(new Yt(.7,.045,.5),xe);Ye.position.y=.138,Ye.castShadow=!0,ke.add(Ye),[-.335,.335].forEach(Ln=>{let Nt=new P(new Yt(.025,.055,.15),w);Nt.position.set(Ln,.04,0),ke.add(Nt)}),S.add(ke)}}st(-15.6,-5.6,4,[y,p]),st(-14.7,-5.5,3,[p,y]),st(-15.5,-4.8,3,[p]),st(-12.6,-5.6,2,[y,p]),st(-13.3,-1.25,2,[p,y]),H(1.85,.88,.92,-15.3,Z+.46,-2.15,p),H(1.9,.1,.96,-15.3,Z+.94,-2.15,A),H(.08,.1,.28,-14.35,Z+.91,-2.15,w),H(.42,.18,.3,-15.45,Z+1.08,-2.15,y),H(.75,.14,.75,-13.1,Z+.09,-3.5,w),H(.1,1.05,.1,-13.42,Z+.62,-3.5,A);let pt=new P(new zt(.23,.23,.09,20),A);pt.rotation.z=Math.PI/2,pt.position.set(-13.38,Z+1.18,-3.5),S.add(pt);let at=new P(new Ai(.2,20),vt({color:16777215,map:Td()}));at.rotation.y=Math.PI/2,at.position.set(-13.332,Z+1.18,-3.5),S.add(at),H(.54,.24,.42,-13,Z+.28,-3.5,y),H(.1,.12,1.8,I+.26,Z+2,-5.8,g),[[-5.3,T],[-5.6,T],[-6.1,_],[-6.4,_]].forEach(([Ut,ae],we)=>{let ce=new P(new zt(.065,.072,.36,10),ae);ce.position.set(I+.36,Z+1.78,Ut),ce.rotation.z=.06*(we%2===0?1:-1),S.add(ce);let ge=new P(new De(.068,.014,6,12),ae);ge.rotation.x=Math.PI/2,ge.position.set(I+.36,Z+1.96,Ut),S.add(ge);let xe=new P(new ls(.056,.11,5,8),ae);xe.rotation.z=Math.PI/2,xe.position.set(I+.43,Z+1.6,Ut),S.add(xe);let ke=new P(new Yt(.2,.024,.11),w);ke.position.set(I+.43,Z+1.545,Ut),S.add(ke)});let ee=new Xe({transparent:!0,depthWrite:!1,uniforms:{uTime:te.uTime,uSunIntensity:te.uSunIntensity},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform float uTime;
      uniform float uSunIntensity;
      varying vec2 vUv;
      void main() {
        float ang = atan(vUv.y, vUv.x);
        float rad = length(vUv) + 0.12 * sin(ang * 3.0 + 0.7) + 0.06 * cos(ang * 5.0);
        if (rad > 0.94) discard;
        // High-key glossy sky/clerestory window reflection + bright specular streak
        float reflBand = smoothstep(-0.35, 0.35, vUv.x * 0.7 + vUv.y * 0.5 + 0.08 * sin(uTime * 1.1 + vUv.y * 4.0));
        vec3 deepWet = vec3(0.32, 0.56, 0.64);
        vec3 skySheen = vec3(0.86, 0.96, 0.98);
        vec3 warmHighlight = vec3(1.0, 0.96, 0.80);
        vec3 col = mix(deepWet, skySheen, reflBand * 0.85);
        float glint = smoothstep(0.68, 0.88, 1.0 - abs(vUv.x - 0.15 + vUv.y * 0.35)) * uSunIntensity;
        col = mix(col, warmHighlight, glint * 0.55);
        float rim = smoothstep(0.94, 0.78, rad);
        gl_FragColor = vec4(col, rim * 0.64);
      }
    `});[[-12.2,-3.4,2.5,1.8],[-14.2,-2.3,1.9,1.4]].forEach(([Ut,ae,we,ce])=>{let ge=new P(new be(we,ce),ee);ge.rotation.x=-Math.PI/2,ge.position.set(Ut,Z+.045,ae),ge.layers.set(1),S.add(ge)});let Mt=new Jn({color:15137791,emissive:9100528,emissiveIntensity:.18,transparent:!0,opacity:.84,roughness:.06}),$t=new Hr(.068,0);[[-14.1,-2.2],[-13.8,-2.5],[-14.4,-2.6],[-13.6,-2.1],[-13.9,-2.9],[-13.3,-2.5],[-14.5,-2.1],[-12.7,-3.1],[-13.1,-2.9],[-12.9,-2.4]].forEach(([Ut,ae],we)=>{let ce=new P($t,Mt);ce.position.set(Ut,Z+.075,ae),ce.scale.set(1.15,.72+we%3*.14,.95),ce.rotation.set(we*.4,we*.9,we*.2),ce.layers.set(1),S.add(ce)});let k=new Jt;t.add(k);let rt=-17.2,ft=-11.8,At=2.2,_t=8.4,St=ft-rt,Gt=_t-At,Zt=(rt+ft)*.5,ie=(At+_t)*.5,Xt=3.15;H(St,.06,Gt,Zt,Z+.03,ie,vt({color:15197140,wetness:.12}),k),H(.22,Xt,Gt,rt+.11,Z+Xt*.5,ie,d,k),H(St,Xt,.22,Zt,Z+Xt*.5,At+.11,d,k),H(.16,.28,2,ft-.08,Z+.14,3.2,d,k),H(.16,.28,1.8,ft-.08,Z+.14,7.5,d,k),[2.3,4.2,6.5,8.3].forEach(Ut=>{H(.14,Xt,.14,ft-.07,Z+Xt*.5,Ut,m,k)}),H(.16,.26,Gt,ft-.08,Z+Xt-.13,ie,m,k);let U=new P(new be(1.85,Xt-.55),x);U.rotation.y=Math.PI/2,U.position.set(ft-.08,Z+1.55,3.25),U.layers.set(1),k.add(U);let Pe=new P(new be(1.75,Xt-.55),x);Pe.rotation.y=Math.PI/2,Pe.position.set(ft-.08,Z+1.55,7.4),Pe.layers.set(1),k.add(Pe),H(St,.26,.16,Zt,Z+.13,_t-.08,d,k),H(St,.26,.16,Zt,Z+Xt-.13,_t-.08,m,k),[-17.1,-15.3,-13.5,-11.9].forEach(Ut=>{H(.14,Xt,.14,Ut,Z+Xt*.5,_t-.08,m,k)});let oe=new P(new be(St-.3,Xt-.52),x);oe.position.set(Zt,Z+1.55,_t-.08),oe.layers.set(1),k.add(oe),H(St+.9,.22,Gt+.9,Zt+.2,Z+Xt+.11,ie,f,k),H(St+.96,.14,Gt+.96,Zt+.2,Z+Xt+.24,ie,m,k);function Ae(Ut,ae,we){let ce=new Jt;ce.position.set(Ut,Z+.06,ae),ce.rotation.y=we,k.add(ce),[-.14,0,.14].forEach(ge=>H(1.85,.045,.12,0,.42,ge,g,ce)),[.64,.78].forEach(ge=>H(1.85,.11,.05,0,ge,-.22,g,ce)),[-.75,.75].forEach(ge=>{H(.06,.42,.46,ge,.21,0,w,ce),H(.05,.44,.05,ge,.62,-.22,w,ce),H(.06,.04,.44,ge,.54,-.02,v,ce)})}Ae(-14.3,4.1,0),Ae(-14.3,6.2,Math.PI);let Lt=new P(new be(.95,1.25),vt({color:16777215,map:r,wetness:.04}));Lt.rotation.y=Math.PI/2,Lt.position.set(rt+.24,Z+1.65,5.2),k.add(Lt);let Me=new Jt;Me.position.set(rt+.25,Z+2.26,3.88),Me.rotation.y=Math.PI/2,Me.rotation.z=-.15,k.add(Me);let Kt=new P(new zt(.28,.28,.06,20),v);Kt.rotation.x=Math.PI/2,Me.add(Kt);let se=new P(new Ai(.25,20),vt({color:16777215,map:o}));se.position.z=.036,Me.add(se),H(.84,.64,.72,-16.04,Z+.38,7.36,v,k);let C=new Jt;C.position.set(-16.14,Z+.83,7.22),C.rotation.y=Math.PI*.42,k.add(C),H(.44,.27,.22,0,0,0,vt({color:9395518}),C),H(.19,.17,.03,-.09,0,.115,vt({color:15456174}),C),H(.15,.1,.03,.1,.04,.115,vt({color:16770208,emissive:16765562,emissiveIntensity:.55}),C),[.06,.14].forEach(Ut=>{let ae=new P(new zt(.022,.022,.025,8),v);ae.rotation.x=Math.PI/2,ae.position.set(Ut,-.07,.12),C.add(ae)});let E=new P(new zt(.008,.01,.44,6),A);E.position.set(.15,.3,-.06),E.rotation.z=-.22,C.add(E);let W=new Jt;W.position.set(-15.86,Z+.7,7.45),W.rotation.y=.45,k.add(W);let yt=vt({color:14904915,wetness:.32}),ut=new P(new zt(.078,.115,.19,12),yt);ut.position.y=.095,ut.castShadow=!0,W.add(ut);let nt=new P(new zt(.066,.078,.03,12),A);nt.position.y=.205,W.add(nt);let et=new P(new Oe(.02,8,6),v);et.position.y=.232,W.add(et);let J=new P(new zt(.014,.024,.13,8),yt);J.position.set(.105,.145,0),J.rotation.z=-.68,W.add(J);let ot=new P(new De(.095,.012,5,14,Math.PI),w);ot.position.y=.195,W.add(ot);let mt=new P(new zt(.048,.038,.08,10),d);mt.position.set(-15.84,Z+.74,7.64),k.add(mt);let L=new P(new De(.022,.006,4,8),d);L.position.set(-15.79,Z+.74,7.64),k.add(L);let ct=vt({color:13204313,wetness:.18}),it=new P(new zt(.24,.17,.36,12),ct);it.position.set(-15.45,Z+.24,7.52),it.castShadow=!0,k.add(it);let Pt=vt({color:6468706,wetness:.2,side:Re}),wt=new Ai(.105,7);for(let Ut=0;Ut<18;Ut++){let ae=Ut/18*Math.PI*2,we=Ut>=12,ce=we?.3+(Ut-12)%2*.035:.07+Ut%3*.065,ge=we?Z+.4-(Ut-12)%3*.075:Z+.48+Ut%3*.045,xe=new P(wt,Pt);xe.position.set(-15.45+Math.cos(ae)*ce,ge,7.52+Math.sin(ae)*ce),xe.rotation.set(we?-1.05:-.45+Ut%2*.22,ae,.18),k.add(xe)}let Et=new Jt;t.add(Et);let Vt=vt({color:12043463,map:a,wetness:.24}),he=vt({color:8173685,wetness:.2,rimStrength:.16});H(13.2,2,.45,-12.4,Z+1,-8.5,Vt,Et),H(.45,2,10.5,-5.8,Z+1,-13.75,Vt,Et);let Tt=vt({color:12568521,wetness:.35});H(13.35,.12,.54,-12.4,Z+2.04,-8.5,Tt,Et),H(.54,.12,10.65,-5.8,Z+2.04,-13.75,Tt,Et),H(.62,2.18,.62,-5.8,Z+1.09,-8.5,Tt,Et);let Qt=new be(13,10.3,28,24);Qt.rotateX(-Math.PI/2);let re=Qt.attributes.position;for(let Ut=0;Ut<re.count;Ut++){let ae=re.getX(Ut),we=re.getZ(Ut),ce=Math.max(0,(6.5-ae)/13),ge=Math.max(0,(5.15-we)/10.3),xe=Math.pow(Math.max(0,ce*.65+ge*.55),1.15)*4.2+.65*Math.sin(ce*3.1)*Math.cos(ge*2.8),ke=(ae>5.8?(6.5-ae)/.7:1)*(we>4.4?(5.15-we)/.75:1);re.setY(Ut,Z+1.85+Math.max(0,xe*ke))}Qt.computeVertexNormals();let kt=new P(Qt,he);kt.position.set(-12.4,0,-13.75),kt.castShadow=!0,kt.receiveShadow=!0,Et.add(kt),H(.28,4.6,10.4,-18.86,Z+2.3,-13.8,Vt,Et),H(13.2,4.6,.28,-12.4,Z+2.3,-18.86,Vt,Et);let Se=new zn;Se.moveTo(-1,0),Se.lineTo(0,.56),Se.lineTo(1,0),Se.closePath();let Be=new Zn(Se,{depth:.14,bevelEnabled:!1});Be.rotateY(Math.PI/2),Be.translate(-.07,0,0);function Je(Ut,ae,we,ce=1,ge=0){let xe=new Jt;xe.position.set(Ut,ae,we),xe.rotation.y=ge,xe.scale.setScalar(ce),Et.add(xe),H(2.8,.6,2.2,0,.3,0,Vt,xe),H(2.6,1.65,2,0,1.35,0,d,xe),[-1.23,1.23].forEach(Nt=>{let Wt=new P(Be,d);Wt.position.set(Nt,2.16,0),Wt.castShadow=!0,Wt.receiveShadow=!0,xe.add(Wt)});let ke=vt({color:16773314,emissive:16767370,emissiveIntensity:.34});H(.84,.74,.07,-.55,1.4,.99,v,xe),H(.74,.64,.08,-.55,1.4,1.01,ke,xe),H(.04,.64,.09,-.55,1.4,1.02,v,xe),H(.74,.04,.09,-.55,1.4,1.02,v,xe),H(.07,.68,.72,1.29,1.42,0,v,xe),H(.08,.58,.62,1.31,1.42,0,ke,xe),H(.09,.58,.04,1.32,1.42,0,v,xe),H(.72,1.2,.08,.58,1.16,1,v,xe),H(.58,1.12,.09,.58,1.16,1.01,g,xe);let We=new P(new Yt(.94,.05,.42),u);We.position.set(.58,1.84,1.16),We.rotation.x=.22,We.castShadow=!0,xe.add(We),H(.86,.16,.36,.58,.08,1.22,Vt,xe);let Ye=new P(new Yt(3.15,.14,1.48),u);Ye.position.set(0,2.45,-.56),Ye.rotation.x=-.46,Ye.castShadow=!0,xe.add(Ye);let Ln=new P(new Yt(3.15,.14,1.48),u);Ln.position.set(0,2.45,.56),Ln.rotation.x=.46,Ln.castShadow=!0,xe.add(Ln),H(3.22,.16,.2,0,2.74,0,w,xe)}Je(-10.2,Z+2.25,-11.8,.92,.14),Je(-15.5,Z+3.45,-12.6,1.02,-.18),Je(-13,Z+4.05,-16.2,.96,.08);let an=[],En=vt({color:7032634}),Fn=[vt({color:6005603,wetness:.22,rimStrength:.22}),vt({color:7584877,wetness:.22,rimStrength:.22}),vt({color:4950615,wetness:.22,rimStrength:.22})];function Mn(Ut,ae,we,ce,ge){let xe=new Jt;xe.position.set(Ut,ae,we),Et.add(xe);let ke=new P(new zt(.1*ce,.18*ce,1.1*ce,7),En);ke.position.y=.55*ce,ke.castShadow=!0,xe.add(ke);let We=new Jt;We.position.y=.95*ce,xe.add(We);let Ye=Fn[ge%Fn.length];[[0,.45,0,.78],[-.45,.22,.25,.56],[.42,.25,-.2,.58],[.1,.75,.15,.52]].forEach(([Nt,Wt,ue,ye])=>{let de=new P(new Br(ye*ce,1),Ye);de.position.set(Nt*ce,Wt*ce,ue*ce),de.castShadow=!0,de.receiveShadow=!0,We.add(de)}),an.push({pivot:We,wx:Ut,wz:we,phase:Ut*.7+we*.5})}return[[-7.6,Z+2.35,-10.8,1.05,0],[-8.4,Z+2.65,-14.2,1.18,1],[-11.8,Z+3.15,-10.2,.92,2],[-13.4,Z+3.45,-13.6,1.15,0],[-16.8,Z+3.85,-10.4,1.02,1],[-17.4,Z+4.45,-15.4,1.24,2],[-15.6,Z+4.75,-17.4,1.12,1],[-10.4,Z+3.55,-16.8,1.18,0],[-7.2,Z+2.75,-17,.98,2],[-17.6,Z+3.35,-12.6,.85,0],[-11.4,Z+2.7,-14.2,.88,1]].forEach(Ut=>Mn(...Ut)),{root:t,update(Ut){let ae=te.uWindVec.value,we=te.uGustFrontPos.value,ce=te.uGustStrength.value;an.forEach(ge=>{let xe=ge.wx*ae.x+ge.wz*ae.y,ke=ce*Math.exp(-Math.pow((xe-we)*.14,2)),We=Math.sin(Ut*1.4+ge.phase)*.035,Ye=ke*(.16+.07*Math.sin(Ut*5.2+ge.phase));ge.pivot.rotation.z=-(We+Ye)*.85,ge.pivot.rotation.x=(We+Ye)*.45})}}}function Zx(i,t,e,n){let o=[],a=[],l=[];function c(v,m){let p=o.length/3,y=4;for(let T=0;T<=18;T++){let _=T/18,A=i*.5-_*i,w=_<.35?1:Math.pow(Math.cos((_-.35)/.65*(Math.PI*.48)),.72),x=t*.5*Math.max(.04,w),S=Math.pow(_,2.2)*.28,I=_>.72?Math.pow((_-.72)/.28,2)*.35:0,b=n+S,N=-e*.35+S*.25+I*.4,G=-e+I,K=[[-x,b],[-x*.96,(b+N)*.48],[-x*.78,N],[0,G],[x*.78,N],[x*.96,(b+N)*.48],[x,b]];for(let D=0;D<y;D++){let z=v+D;o.push(K[z][0],K[z][1],A);let Y=Math.abs(z-3)/3;a.push(m?1-_:_,Y)}}for(let T=0;T<18;T++)for(let _=0;_<y-1;_++){let A=p+T*y+_,w=A+1,x=A+y,S=x+1;l.push(A,x,w,w,x,S)}}c(0,!0),c(3,!1);let h=o.length/3,f=t*.5,u=(n+-e*.35)*.48;[[-f,n,1],[-f*.96,u,.67],[-f*.78,-e*.35,.33],[0,-e,0],[f*.78,-e*.35,.33],[f*.96,u,.67],[f,n,1]].forEach(([v,m,p])=>{o.push(v,m,i*.5),a.push(.02,p)}),l.push(h+3,h+0,h+1,h+3,h+1,h+2,h+3,h+6,h+0,h+3,h+5,h+6,h+3,h+4,h+5);let g=new qe;return g.setAttribute("position",new me(o,3)),g.setAttribute("uv",new me(a,2)),g.setIndex(l),g.computeVertexNormals(),g}function Rd(i){let t=new Jt;i.add(t);let e=pd(),n=md(),s=gd(),r=xd(),o=_d(),a=vt({color:15134448,wetness:.35}),l=vt({color:3898260,wetness:.3}),c=vt({color:16054264,wetness:.35,rimStrength:.2}),h=vt({color:13360610,wetness:.1,causticsStrength:1.25,causticsScale:.9,side:Re}),f=vt({color:3689300,wetness:.28}),u=vt({color:13359324,wetness:.42}),d=vt({color:15624772,wetness:.35}),g=vt({color:16251385,wetness:.35}),v=vt({color:2897983,wetness:.22}),m=vt({color:15909432,wetness:.25}),p=vt({color:12158293,wetness:.12}),y=vt({color:14245705,wetness:.3}),T=vt({color:4099509,wetness:.5}),_=new en({map:e}),A=new en({map:n}),w=vt({color:16777215,map:s,wetness:.05}),x=vt({color:16777215,map:r,side:Re}),S=vt({color:16777215,map:o,side:Re}),I=new Jn({color:14284026,transparent:!0,opacity:.24,roughness:.08,depthWrite:!1,side:Re});function b(){let tt=new Jt,st=new P(new De(.22,.065,8,16),d);tt.add(st);for(let pt=0;pt<4;pt++){let at=new P(new De(.22,.068,8,6,.35),g);at.rotation.z=pt*Math.PI/2,tt.add(at)}return tt}function N(tt,st,pt,at,ee){let Mt=new Jt;tt.add(Mt);let $t=new fi(16774364,.65,3.2,1.5);$t.position.set(0,at+ee-.25,-pt*.05),$t.layers.enableAll(),Mt.add($t);let lt=-pt*.26,k=new P(new Yt(st*.78,.56,.42),c);k.position.set(0,at+.3,lt),k.castShadow=!0,Mt.add(k);let rt=new P(new Yt(st*.8,.06,.46),f);rt.position.set(0,at+.59,lt),Mt.add(rt);let ft=new Jt;ft.position.set(st*.16,at+.64,lt+.26),ft.rotation.x=.42,Mt.add(ft);let At=new P(new zt(.04,.05,.12,8),f);At.rotation.x=Math.PI/2,ft.add(At);let _t=new P(new De(.17,.02,6,16),u);_t.position.z=.05,ft.add(_t);for(let Et=0;Et<5;Et++){let Vt=new P(new zt(.01,.01,.34,5),u);Vt.rotation.z=Et/5*Math.PI,Vt.position.z=.05,ft.add(Vt)}let St=new P(new zt(.04,.05,.36,8),u);St.position.set(st*.16,at+.18,lt+.68),Mt.add(St);let Gt=new P(new Yt(.32,.08,.3),l);Gt.position.set(st*.16,at+.38,lt+.68),Mt.add(Gt);let Zt=new P(new Yt(.24,.2,.12),f);Zt.position.set(-st*.16,at+.72,lt+.02),Zt.rotation.y=.24,Zt.rotation.x=-.15,Mt.add(Zt);let ie=new P(new be(.19,.15),_);ie.position.set(0,0,.062),Zt.add(ie);let Xt=new P(new Yt(.08,.09,.07),f);Xt.position.set(st*.01,at+.65,lt+.04),Mt.add(Xt);let U=new P(new Yt(.22,.18,.1),f);U.position.set(st*.01,at+.76,lt+.05),U.rotation.y=.38,U.rotation.x=-.12,Mt.add(U);let Pe=new P(new be(.18,.14),A);Pe.position.set(0,0,.052),U.add(Pe);let oe=new Jt;oe.position.set(-st*.28,at+.68,lt+.14),oe.rotation.set(-.78,.56,-.06),Mt.add(oe);let Ae=new P(new Yt(.22,.28,.015),p);oe.add(Ae);let Lt=new P(new be(.19,.24),w);Lt.position.z=.01,oe.add(Lt);let Me=new P(new Yt(.08,.03,.025),u);Me.position.set(0,.12,.012),oe.add(Me);let Kt=new P(new zt(.045,.05,.2,10),y);Kt.position.set(st*.26,at+.72,lt+.04),Mt.add(Kt);let se=new P(new zt(.042,.046,.05,10),u);se.position.set(st*.26,at+.84,lt+.04),Mt.add(se);let C=new P(new zt(.038,.034,.075,10),g);C.position.set(st*.34,at+.655,lt+.14),Mt.add(C);let E=new P(new De(.038,.0055,5,10),l);E.rotation.x=Math.PI/2,E.position.set(st*.34,at+.692,lt+.14),Mt.add(E);let W=new P(new De(.02,.005,4,8),g);W.position.set(st*.34+.036,at+.655,lt+.14),Mt.add(W);let yt=new Jt;yt.position.set(-st*.28,at+.99,pt*.39),yt.rotation.y=Math.PI*.36,Mt.add(yt);let ut=new P(new Yt(.08,.05,.02),p);ut.position.set(0,.14,-.05),yt.add(ut);let nt=new P(new zt(.011,.011,.06,6),u);nt.rotation.x=Math.PI/2,nt.position.set(0,.14,-.025),yt.add(nt);let et=new P(new Oe(.145,10,8),m);et.scale.set(1.38,.5,.42),et.position.set(0,.04,.005),yt.add(et);let J=new P(new zt(.12,.185,.49,12),m);J.position.set(0,-.2,.005),J.scale.set(1.36,1,.42),yt.add(J);let ot=new P(new Yt(.024,.45,.026),f);ot.position.set(0,-.2,.068),ot.rotation.x=.06,yt.add(ot),[-1,1].forEach(Et=>{let Vt=new P(new zt(.048,.036,.39,10),m);Vt.position.set(Et*.175,-.15,.01),Vt.rotation.z=Et*.16,yt.add(Vt)});let mt=new P(new De(.072,.022,6,12),m);mt.rotation.x=Math.PI*.56,mt.position.set(0,.09,-.005),yt.add(mt);let L=new P(new Oe(.075,8,6),m);L.scale.set(1.05,.65,.85),L.position.set(0,.06,-.045),L.rotation.x=.48,yt.add(L);let ct=new P(new zt(.004,.004,.07,5),y);ct.position.set(st*.34,at+1.07,lt+.14),Mt.add(ct);let it=new P(new Yt(.075,.115,.016),S);it.position.set(st*.34,at+.99,lt+.14),it.rotation.y=.55,Mt.add(it);let Pt=new P(new Yt(.155,.125,.012),g);Pt.position.set(st*.27,at+.9,-pt*.44),Pt.rotation.y=.42,Mt.add(Pt);let wt=new P(new be(.14,.11),x);wt.position.z=.008,Pt.add(wt)}function G({length:tt,beam:st,draft:pt,freeboard:at,regCode:ee,stripeHex:Mt,seed:$t,hasCabin:lt,fenderSide:k}){let rt=new Jt,ft=Sd(ee,Mt,$t),At=vt({color:16777215,map:ft,wetness:.45,rimStrength:.22,side:Re}),_t=new P(Zx(tt,st,pt,at),At);_t.castShadow=!0,_t.receiveShadow=!0,rt.add(_t);let St=at*.52,Gt=new zn,Zt=[];for(let nt=0;nt<=12;nt++){let et=.04+nt/12*.82,J=tt*.5-et*tt,ot=et<.35?1:Math.pow(Math.cos((et-.35)/.65*(Math.PI*.48)),.72),mt=Math.max(.02,st*.5*ot*.86);Zt.push([mt,J])}Gt.moveTo(-Zt[0][0],Zt[0][1]),Zt.forEach(([nt,et])=>Gt.lineTo(nt,et));for(let nt=Zt.length-1;nt>=0;nt--)Gt.lineTo(-Zt[nt][0],Zt[nt][1]);Gt.closePath();let ie=new Zn(Gt,{depth:.08,bevelEnabled:!1});ie.rotateX(Math.PI/2);let Xt=new P(ie,a);Xt.position.set(0,St+.04,0),Xt.receiveShadow=!0,rt.add(Xt);let U=[],Pe=[],oe=8;for(let nt=0;nt<=oe;nt++){let et=.62+nt/oe*.38,J=tt*.5-et*tt,ot=Math.pow(Math.cos((et-.35)/.65*(Math.PI*.48)),.72),mt=Math.max(.015,st*.5*ot-.025),L=at+Math.pow(et,2.2)*.28-.035;U.push(-mt,L,J,0,L+.025,J,mt,L,J)}for(let nt=0;nt<oe;nt++){let et=nt*3,J=et+3;Pe.push(et,et+1,J,et+1,J+1,J,et+1,et+2,J+1,et+2,J+2,J+1)}let Ae=new qe;Ae.setAttribute("position",new me(U,3)),Ae.setIndex(Pe),Ae.computeVertexNormals();let Lt=new P(Ae,a);rt.add(Lt);let Me=[];for(let nt=0;nt<=14;nt++){let et=nt/14,J=et<.35?1:Math.pow(Math.cos((et-.35)/.65*(Math.PI*.48)),.72),ot=st*.5*Math.max(.04,J),mt=at+Math.pow(et,2.2)*.28+.01;Me.push(new R(-ot,mt,tt*.5-et*tt))}for(let nt=14;nt>=0;nt--){let et=nt/14,J=et<.35?1:Math.pow(Math.cos((et-.35)/.65*(Math.PI*.48)),.72),ot=st*.5*Math.max(.04,J),mt=at+Math.pow(et,2.2)*.28+.01;Me.push(new R(ot,mt,tt*.5-et*tt))}Me.push(Me[0].clone());let Kt=new P(new kn(new yn(Me,!1),42,.036,6,!1),l);Kt.castShadow=!0,rt.add(Kt);let se=new P(new Yt(st*.44,.4,.65),c);se.position.set(0,St+.22,tt*.34),se.castShadow=!0,rt.add(se);let C=new P(new Yt(st*.46,.05,.68),l);C.position.set(0,St+.44,tt*.34),C.castShadow=!0,rt.add(C);let E=new P(new Yt(.09,.06,.03),f);E.position.set(0,St+.39,tt*.34-.33),rt.add(E);let W=new P(new Yt(.56,.26,.38),T);W.position.set(-st*.22,St+.17,tt*.26),W.rotation.y=.22,W.castShadow=!0,rt.add(W);let yt=new P(new Yt(.6,.04,.42),T);yt.position.set(-st*.22,St+.3,tt*.26),yt.rotation.y=.22,rt.add(yt),[-tt*.22,0,tt*.22].forEach(nt=>{let et=new P(new De(.16,.065,7,14),v);et.rotation.y=Math.PI/2,et.position.set(k*(st*.51),at*.55,nt),et.castShadow=!0,rt.add(et)});let ut=b();if(ut.rotation.y=Math.PI/2,ut.position.set(-k*(st*.5+.085),at*.68,tt*.14),rt.add(ut),lt){let nt=st*.72,et=tt*.34,J=1.38,ot=-tt*.06,mt=new Jt;mt.position.set(0,0,ot),rt.add(mt);let L=.6,ct=J-L-.12;[-1,1].forEach(ln=>{let Ut=new P(new Yt(.08,L,et),c);Ut.position.set(ln*nt*.5,St+L*.5,0),Ut.castShadow=!0,mt.add(Ut),[-et*.48,0,et*.48].forEach(we=>{let ce=new P(new Yt(.08,ct+.12,.08),c);ce.position.set(ln*nt*.5,St+L+(ct+.12)*.5,we),mt.add(ce)});let ae=new P(new be(et-.12,ct),I);ae.rotation.y=Math.PI/2,ae.position.set(ln*nt*.5,St+L+ct*.5,0),ae.layers.set(1),mt.add(ae)});let it=new P(new Yt(nt,L,.08),c);it.position.set(0,St+L*.5,-et*.5),mt.add(it);let Pt=new P(new be(nt-.12,ct),I);Pt.position.set(0,St+L+ct*.5,-et*.5),Pt.layers.set(1),mt.add(Pt);let wt=new P(new Yt(nt*.46,J,.08),c);wt.position.set(-nt*.27,St+J*.5,et*.5),wt.castShadow=!0,mt.add(wt);let Et=new P(new Yt(nt*.54,.16,.08),c);Et.position.set(nt*.23,St+J-.08,et*.5),mt.add(Et);let Vt=new P(new Yt(nt+.18,.1,et+.26),c);Vt.position.set(0,St+J+.05,.04),Vt.castShadow=!0,Vt.receiveShadow=!0,mt.add(Vt);let he=new P(new be(nt-.08,et-.08),h);he.rotation.x=Math.PI/2,he.position.set(0,St+J-.01,0),mt.add(he),N(mt,nt,et,St,J);let Tt=St+J+.1,Qt=new P(new zt(.025,.035,1.25,6),u);Qt.position.set(0,Tt+.62,-et*.12),Qt.castShadow=!0,mt.add(Qt);let re=new P(new zt(.016,.016,.72,6),u);re.rotation.z=Math.PI/2,re.position.set(0,Tt+.92,-et*.12),mt.add(re);let kt=new P(new zt(.06,.08,.14,8),u);kt.position.set(0,Tt+.07,-et*.28),mt.add(kt);let Se=new P(new zt(.24,.26,.16,14),c);Se.position.set(0,Tt+.2,-et*.28),Se.castShadow=!0,mt.add(Se),[-nt*.36,nt*.36].forEach(ln=>{let Ut=new P(new zt(.008,.012,1.35,5),u);Ut.position.set(ln,Tt+.62,et*.2),Ut.rotation.x=.2,mt.add(Ut)});let Be=tt*.28,Je=et*.5+Be*.5;[-nt*.42,nt*.42].forEach(ln=>{let Ut=new P(new zt(.02,.02,J,6),u);Ut.position.set(ln,St+J*.5,et*.5+Be-.08),mt.add(Ut);let ae=new P(new zt(.02,.02,Be,6),u);ae.rotation.x=Math.PI/2,ae.position.set(ln,St+J,Je),mt.add(ae)});let an=new P(new Yt(nt*.9,.03,Be),vt({color:6071221,wetness:.35}));an.position.set(0,St+J+.02,Je),an.castShadow=!0,mt.add(an);let En=new P(new Yt(.06,.07,.1),d);En.position.set(-nt*.52,Tt+.02,-et*.32),mt.add(En);let Fn=new P(new Yt(.06,.07,.1),vt({color:5093514}));Fn.position.set(nt*.52,Tt+.02,-et*.32),mt.add(Fn);let Mn=new P(new De(.18,.028,6,14),y);Mn.rotation.x=Math.PI/2,Mn.position.set(-nt*.26,St+.06,et*.5+Be*.65),mt.add(Mn)}else{let nt=new P(new Yt(.75,.72,.52),c);nt.position.set(0,St+.36,-.2),nt.castShadow=!0,rt.add(nt);let et=new P(new be(.72,.38),I);et.position.set(0,St+.88,-.4),et.rotation.x=.25,et.layers.set(1),rt.add(et);let J=new P(new De(.14,.02,6,14),u);J.position.set(.12,St+.65,.1),J.rotation.x=.4,rt.add(J);let ot=new P(new Yt(.18,.14,.08),f);ot.position.set(-.16,St+.79,-.18),rt.add(ot);let mt=new P(new be(.15,.11),new en({map:n}));mt.position.set(-.16,St+.79,-.135),rt.add(mt);let L=new P(new Yt(.76,.06,.3),l);L.position.set(0,St+.36,.42),rt.add(L);let ct=new P(new zt(.04,.045,.18,8),y);ct.position.set(.24,St+.81,-.22),rt.add(ct);let it=new P(new Yt(.46,.24,.34),T);it.position.set(-.32,St+.16,tt*.24),it.castShadow=!0,rt.add(it);let Pt=new P(new De(.16,.024,6,12),y);Pt.rotation.x=Math.PI/2,Pt.position.set(.32,St+.055,tt*.24),rt.add(Pt);let wt=new P(new zt(.008,.016,1.85,6),u);wt.position.set(-st*.36,St+.92,tt*.16),wt.rotation.set(-.42,0,.15),rt.add(wt);let Et=new P(new zt(.022,.028,1.35,6),u);Et.position.set(0,St+.68,tt*.22),rt.add(Et);let Vt=new P(new zt(.008,.01,.95,5),u);Vt.position.set(.28,St+1.05,-.25),rt.add(Vt)}return rt}let D=[{id:"boat1",baseX:-.35,baseZ:4.44,baseYaw:-Math.PI*.5,length:4.4,beam:1.8,draft:.45,freeboard:.62,regCode:"SF-218",stripeHex:"#3f8ea8",seed:11,hasCabin:!1,fenderSide:1,phase:.4,freq:1.05},{id:"boat2",baseX:-3.45,baseZ:-.65,baseYaw:0,length:5.75,beam:2.15,draft:.55,freeboard:.72,regCode:"YM-104",stripeHex:"#2f7e91",seed:22,hasCabin:!0,fenderSide:-1,phase:1.7,freq:.92},{id:"boat3",baseX:-3.45,baseZ:-7.95,baseYaw:0,length:5.65,beam:2.1,draft:.54,freeboard:.7,regCode:"KM-307",stripeHex:"#d45c47",seed:33,hasCabin:!0,fenderSide:-1,phase:3.1,freq:.98},{id:"boat4",baseX:6.62,baseZ:9.4,baseYaw:0,length:5.8,beam:2.1,draft:.52,freeboard:.7,regCode:"CH-09",stripeHex:"#357b99",seed:44,hasCabin:!0,fenderSide:-1,phase:4.5,freq:.88}].map(tt=>{let st=G(tt);return st.position.set(tt.baseX,0,tt.baseZ),st.rotation.y=tt.baseYaw,t.add(st),{...tt,mesh:st}}),z=vt({color:16777215,map:uo({darkWet:!1}),wetness:.12}),Y=vt({color:16777215,map:uo({darkWet:!0}),wetness:.48}),B=[{boatIdx:0,localCleat:new R(.7,.65,-1.6),bollardPos:new R(.95,Z+.34,5.85),alwaysAttached:!0},{boatIdx:0,localCleat:new R(.7,.62,1.6),bollardPos:new R(-1.4,Z+.34,5.85),alwaysAttached:!0},{boatIdx:1,localCleat:new R(-.7,.75,-2.1),bollardPos:new R(-5.6,Z+.34,-3.4),alwaysAttached:!0},{boatIdx:1,localCleat:new R(-.7,.7,2.1),bollardPos:new R(-5.6,Z+.34,2.1),alwaysAttached:!0},{boatIdx:2,localCleat:new R(-.7,.74,-1.9),bollardPos:new R(-5.6,Z+.34,-9.2),alwaysAttached:!0},{boatIdx:2,localCleat:new R(-.7,.68,2),bollardPos:new R(-5.6,Z+.34,-4.4),alwaysAttached:!0},{boatIdx:3,localCleat:new R(-.7,.72,-2.2),bollardPos:new R(5.1,vs+.28,7.9),alwaysAttached:!1},{boatIdx:3,localCleat:new R(-.7,.68,2.2),bollardPos:new R(5.1,vs+.28,11.8),alwaysAttached:!1}],H=10,$=B.map(tt=>{let st=[];for(let pt=0;pt<H;pt++){let at=new P(new zt(.024,.024,1,5),pt<5?z:Y);at.castShadow=!0,t.add(at),st.push(at)}return{...tt,segs:st}});[[-5.6,Z+.3,4.1,-4.85,-.55,4.1],[-1.4,Z+.3,5.85,-1.4,-.55,5.32],[3.1,Z+.3,6.4,3.68,-.55,6.4]].forEach(([tt,st,pt,at,ee,Mt])=>{let $t=new yn([new R(tt,st,pt),new R((tt+at)*.5,Z+.05,(pt+Mt)*.5),new R(at,.15,Mt),new R(at,ee,Mt)]),lt=new kn(new yn([$t.getPoint(0),$t.getPoint(.42),$t.getPoint(.7)]),10,.026,6,!1);t.add(new P(lt,z));let k=new kn(new yn([$t.getPoint(.68),$t.getPoint(.85),$t.getPoint(1)]),8,.026,6,!1);t.add(new P(k,Y))});let dt=new R,Ft=new R(0,1,0),qt=new R,O=new R,xt=new R;return{root:t,boats:D,update(tt){let st=Ms(tt);function pt(at,ee){if(!st.active)return 0;let Mt=Math.hypot(at-st.pos.x,ee-st.pos.z),$t=Math.sin(Mt*1.15-tt*3.8),lt=Math.exp(-Mt*.09)*st.speed;return $t*lt*.065}D.forEach((at,ee)=>{if(ee===3){let Mt=Es(st.pos.x,st.pos.z,tt);at.mesh.position.set(st.pos.x,Mt,st.pos.z),at.mesh.rotation.y=st.yaw;let $t=-st.speed*.045;at.mesh.rotation.x=$t+Math.sin(tt*at.freq*1.2+at.phase)*.018,at.mesh.rotation.z=Math.cos(tt*at.freq+at.phase)*.025}else{let Mt=pt(at.baseX,at.baseZ),$t=Es(at.baseX,at.baseZ,tt)+Mt,lt=Math.sin(tt*at.freq*.72+at.phase)*.045+Mt*.45,k=at.baseYaw===0?Math.max(-.02,lt):0,rt=at.baseYaw!==0?Math.min(.02,-lt):0;at.mesh.position.set(at.baseX+k,$t,at.baseZ+rt),at.mesh.rotation.y=at.baseYaw+Math.sin(tt*at.freq*.55+at.phase)*.015,at.mesh.rotation.x=Math.sin(tt*at.freq*1.1+at.phase)*.022+Mt*.35,at.mesh.rotation.z=Math.cos(tt*at.freq+at.phase)*.032+Mt*.45}at.mesh.updateMatrixWorld(!0)}),$.forEach(at=>{let ee=D[at.boatIdx],Mt=at.alwaysAttached||!st.active;if(at.segs.forEach(ft=>{ft.visible=Mt}),!Mt)return;dt.copy(at.localCleat).applyMatrix4(ee.mesh.matrixWorld);let $t=at.bollardPos,lt=dt,k=$t.distanceTo(lt),rt=Math.max(.06,.38-(k-1.5)*.12);for(let ft=0;ft<H;ft++){let At=ft/H,_t=(ft+1)/H,St=At<.44?Math.sin(At/.44*Math.PI)*.17:0,Gt=_t<.44?Math.sin(_t/.44*Math.PI)*.17:0,Zt=Math.pow(At,1.35)*Math.sin(At*Math.PI)*rt,ie=Math.pow(_t,1.35)*Math.sin(_t*Math.PI)*rt;O.lerpVectors($t,lt,At),O.y+=St-Zt,xt.lerpVectors($t,lt,_t),xt.y+=Gt-ie;let Xt=at.segs[ft];Xt.position.lerpVectors(O,xt,.5),qt.subVectors(xt,O);let U=qt.length();Xt.scale.set(1,Math.max(.001,U*1.04),1),U>1e-4&&Xt.quaternion.setFromUnitVectors(Ft,qt.normalize()),Xt.material=Xt.position.y<.72?Y:z}})}}}function Ad(i){let t=new Jt;i.add(t);let e=vt({color:2502968,wetness:.08,rimStrength:.1,shadowTintStrength:.25}),n=vt({color:9392184,wetness:.25}),s=vt({color:12504016,wetness:.35}),r=vt({color:13227995,wetness:.3}),o=vt({color:4549501,wetness:.42,side:Re}),a=vt({color:2898756,wetness:.1}),l=vt({color:12372173,wetness:.45,rimStrength:.28}),c=vt({color:6452092,wetness:.35}),h=vt({color:10908745,wetness:.35,side:Re}),f=vt({color:7293743,wetness:.15,side:Re}),u=vt({color:4816273,wetness:.35}),d=vt({color:15857399,wetness:.58}),g=vt({color:3902131,wetness:.58}),v=Md(),m=vt({color:16777215,map:v,alphaTest:.35,wetness:.22,side:Re}),p=vt({color:16777215,map:uo({darkWet:!1}),wetness:.22}),y=[],T=[];[[-5.6,Z,-9.2],[-5.6,Z,-4.4],[-5.6,Z,-3.4],[-5.6,Z,2.1],[-5.6,Z,4.1],[-4.2,Z,5.85],[-1.4,Z,5.85],[.95,Z,5.85],[3.1,Z,6.4],[5.1,.55,7.9],[5.1,.55,11.8]].forEach(([Nt,Wt,ue],ye)=>{let de=new Jt;de.position.set(Nt,Wt,ue),t.add(de);let M=new P(new zt(.18,.2,.06,10),e);M.position.y=.03,M.castShadow=!0,de.add(M);let F=new P(new zt(.1,.12,.34,10),e);F.position.y=.22,F.castShadow=!0,de.add(F);let j=new P(new zt(.145,.11,.09,10),e);j.position.y=.42,j.castShadow=!0,de.add(j);let X=new P(new zt(.032,.032,.34,6),e);if(X.rotation.z=Math.PI/2,X.position.y=.34,de.add(X),ye%2===0)for(let q=0;q<3;q++){let It=new P(new De(.125,.025,6,14),p);It.rotation.x=Math.PI/2,It.position.y=.13+q*.048,de.add(It)}});let A=[[-5.6,Z,4.9,0],[-5.6,Z,-5.2,0],[1.6,Z,6.25,-Math.PI/2],[-10.8,Z,10.6,Math.PI*.18]],w=[];A.forEach(([Nt,Wt,ue,ye],de)=>{let M=new Jt;M.position.set(Nt,Wt,ue),M.rotation.y=ye,t.add(M);let F=new P(new zt(.11,.14,.45,8),r);F.position.y=.225,F.castShadow=!0,M.add(F);let j=new P(new zt(.055,.085,4.15,8),r);j.position.y=2.35,j.castShadow=!0,M.add(j);let X=new yn([new R(0,4.35,0),new R(.28,4.65,0),new R(.68,4.55,0),new R(.82,4.38,0)]),q=new P(new kn(X,10,.032,6,!1),r);q.castShadow=!0,M.add(q);let It=new P(new zt(.22,.34,.16,16,1,!0),o);It.position.set(.82,4.3,0),It.castShadow=!0,M.add(It);let Dt=new P(new De(.34,.022,6,18),o);Dt.rotation.x=Math.PI/2,Dt.position.set(.82,4.22,0),M.add(Dt);let Rt=new P(new Oe(.09,10,8),new en({color:16773314}));Rt.position.set(.82,4.24,0),M.add(Rt);let V=new fi(16768944,.55,7.5,2);V.position.set(.82,4.1,0),V.layers.enableAll(),M.add(V),y.push(V);let ht=new R(Nt,Wt+4.12,ue);w.push(ht);let Ct=new R(.82,4.2,.32).applyAxisAngle(new R(0,1,0),ye);T.push({x:Nt+Ct.x,y:Wt+Ct.y,z:ue+Ct.z,phase:de*1.37})});let x=[[w[0],w[1]],[w[0],w[2]],[w[0],w[3]],[w[3],new R(-12.2,Z+3.4,8.2)],[w[1],new R(-10.6,Z+4.2,-3.5)],[w[1],new R(-9.5,Z+4.8,-11.5)]];x.forEach(([Nt,Wt])=>{let ue=new R().lerpVectors(Nt,Wt,.5);ue.y-=Nt.distanceTo(Wt)*.055;let ye=new di(Nt,ue,Wt),de=new P(new kn(ye,14,.014,4,!1),a);t.add(de)}),x.slice(3).forEach(([,Nt])=>{let Wt=new Jt;Wt.position.copy(Nt);let ue=new P(new Yt(.18,.04,.04),e);ue.position.x=-.09,Wt.add(ue);let ye=new P(new zt(.038,.038,.075,8),d);Wt.add(ye),t.add(Wt)});let S=new Jt;t.add(S);let I=new Jt;I.position.set(-.38,Z+.095,11.4),I.rotation.y=.28,S.add(I);let b=new zn;b.moveTo(-.52,-.13),b.bezierCurveTo(-.54,-.23,-.28,-.24,-.12,-.16),b.bezierCurveTo(-.04,-.12,.02,-.18,.14,-.17),b.bezierCurveTo(.25,-.16,.27,-.09,.52,-.09),b.lineTo(.55,0),b.lineTo(.52,.09),b.bezierCurveTo(.27,.09,.25,.16,.14,.17),b.bezierCurveTo(.02,.18,-.04,.12,-.12,.16),b.bezierCurveTo(-.28,.24,-.54,.23,-.52,.13),b.closePath();let N=new Zn(b,{depth:.15,bevelEnabled:!0,bevelThickness:.02,bevelSize:.02,bevelSegments:2});N.rotateX(-Math.PI/2),N.translate(0,-.075,0);let G=new P(N,l);G.castShadow=!0,G.receiveShadow=!0,I.add(G);let K=new P(new Yt(.98,.032,.03),c);K.position.set(0,0,.19),I.add(K),[-.34,-.02,.3].forEach(Nt=>{let Wt=new P(new Yt(.06,.06,.04),e);Wt.position.set(Nt,0,.21),I.add(Wt)});let D=new P(new De(.07,.016,5,10,Math.PI),e);D.rotation.x=Math.PI/2,D.position.set(-.08,0,.21),I.add(D);let z=new Jt;z.position.set(.36,Z+.13,10.92),z.rotation.y=-.18,S.add(z);let Y=new P(new Yt(.82,.24,.48),l);Y.castShadow=!0,Y.receiveShadow=!0,z.add(Y);let B=new P(new Yt(.84,.04,.5),c);z.add(B),[-.38,.38].forEach(Nt=>{[-.1,.1].forEach(Wt=>{[-.22,.22].forEach(ue=>{let ye=new P(new Yt(.08,.06,.08),c);ye.position.set(Nt,Wt,ue),z.add(ye)})})}),[-.22,.22].forEach(Nt=>{let Wt=new P(new Yt(.065,.06,.035),e);Wt.position.set(Nt,0,.25),z.add(Wt)});let H=new P(new De(.068,.015,5,10,Math.PI),e);H.rotation.x=Math.PI/2,H.position.set(0,0,.25),z.add(H);let $=new P(new be(.12,.08),vt({color:5417149}));$.rotation.x=-Math.PI/2,$.rotation.z=.2,$.position.set(.14,.124,-.04),z.add($);let Q=new Jt;Q.position.set(1.92,Z+.44,11.72),Q.rotation.set(.14,-.38,.52),t.add(Q);let dt=new P(new zt(.012,.012,.88,6),s);dt.position.y=.12,Q.add(dt);let Ft=new P(new De(.045,.014,6,12,Math.PI),d);Ft.position.set(.045,-.32,0),Ft.rotation.z=Math.PI,Q.add(Ft);let qt=new Oe(.52,16,10,0,Math.PI*2,0,Math.PI*.44),O=new Jn({color:15137020,transparent:!0,opacity:.34,roughness:.06,depthWrite:!1,side:Re}),xt=new P(qt,O);xt.position.y=.06,xt.layers.set(1),Q.add(xt);let tt=new P(new De(.51,.011,5,24),d);tt.rotation.x=Math.PI/2,tt.position.y=.15,Q.add(tt);for(let Nt=0;Nt<8;Nt++){let Wt=Nt/8*Math.PI*2,ue=new di(new R(0,.58,0),new R(Math.cos(Wt)*.34,.44,Math.sin(Wt)*.34),new R(Math.cos(Wt)*.51,.15,Math.sin(Wt)*.51)),ye=new P(new kn(ue,6,.006,4,!1),s);Q.add(ye)}let st=new Oe(.009,6,5),pt=new en({color:16775388,transparent:!0,opacity:.78});for(let Nt=0;Nt<22;Nt++){let Wt=Ue(Nt*13)*Math.PI*2,ue=.25+Ue(Nt*29)*.9,ye=new P(st,pt);ye.position.set(Math.sin(ue)*Math.cos(Wt)*.525,.06+Math.cos(ue)*.525,Math.sin(ue)*Math.sin(Wt)*.525),ye.layers.set(1),Q.add(ye)}T.push({x:1.72,y:Z+.38,z:11.75,phase:.4}),T.push({x:-2.4,y:.72,z:-.6,phase:2.1}),T.push({x:-1.2,y:.65,z:3.3,phase:3.4});let at=co(2.55),ee=Math.atan2(Z- -.45,5.7),Mt=new Jt;Mt.position.set(2.55,at+.25,14.12),Mt.rotation.set(-.34,.04,-ee),t.add(Mt);let $t=new zt(.64,.78,2.7,14,1,!1,-Math.PI*.5,Math.PI);$t.rotateZ(Math.PI/2),$t.rotateX(-Math.PI/2),$t.scale(1,.62,1);let lt=new P($t,h);lt.castShadow=!0,lt.receiveShadow=!0,Mt.add(lt);let k=new zt(.61,.75,2.64,12,1,!0,-Math.PI*.5,Math.PI);k.rotateZ(Math.PI/2),k.rotateX(-Math.PI/2),k.scale(1,.6,1);let rt=new P(k,f);Mt.add(rt),[-.45,.45].forEach(Nt=>{let Wt=new P(new Yt(.2,.04,1.15),f);Wt.position.set(Nt,.14,0),Mt.add(Wt)});let ft=new P(new Yt(2.7,.07,.09),u);ft.position.set(0,.46,0),ft.castShadow=!0,Mt.add(ft),[-1,1].forEach(Nt=>{let Wt=new P(new Yt(2.72,.08,.07),u);Wt.position.set(0,.02,Nt*.73),Wt.rotation.y=-Nt*.052,Wt.castShadow=!0,Mt.add(Wt)});let At=new Jt;At.position.set(2.02,co(2.02),14.74),At.rotation.set(.02,.04,-ee),t.add(At);let _t=new P(new Yt(.32,.07,.3),f);_t.position.y=.035,_t.castShadow=!0,_t.receiveShadow=!0,At.add(_t),[-.08,.08].forEach(Nt=>{let Wt=new P(new Yt(.08,.34,.07),h);Wt.position.set(-Nt*.65,.21,Nt),Wt.rotation.z=Nt>0?.28:-.28,Wt.castShadow=!0,At.add(Wt)});let St=new P(new Yt(.28,.07,.24),h);St.position.y=.37,St.castShadow=!0,St.receiveShadow=!0,At.add(St);function Gt(Nt,Wt,ue,ye=!1){for(let de=0;de<ue;de++){let M=(de+(ye?1:0))%2===0?d:g,F=new Jt;F.position.set(Nt,Z+.15+de*.31,Wt),F.rotation.y=(Ue(Nt*7+de)-.5)*.24;let j=new P(new Yt(.64,.28,.44),M);j.castShadow=!0,j.receiveShadow=!0,F.add(j);let X=new P(new Yt(.68,.045,.48),M);X.position.y=.135,X.castShadow=!0,F.add(X),[-.33,.33].forEach(q=>{let It=new P(new Yt(.03,.055,.15),e);It.position.set(q,.04,0),F.add(It)}),[-.17,.17].forEach(q=>{let It=new P(new Yt(.055,.07,.03),e);It.position.set(q,.095,.235),F.add(It)}),t.add(F)}}Gt(-9.5,-4.8,3,!1),Gt(-9.5,-.35,2,!0),Gt(-8.5,6.2,2,!0),Gt(-6.6,6.4,3,!1);let Zt=new Jt;Zt.position.set(-6.15,Z,9.75),Zt.rotation.y=.14,t.add(Zt),[-1.35,1.35].forEach(Nt=>{let Wt=new P(new zt(.032,.036,2.05,6),n);Wt.position.set(Nt,.98,-.25),Wt.rotation.x=.22,Wt.castShadow=!0,Zt.add(Wt);let ue=new P(new zt(.032,.036,2.05,6),n);ue.position.set(Nt,.98,.25),ue.rotation.x=-.22,ue.castShadow=!0,Zt.add(ue),[-.47,.47].forEach(ye=>{let de=new P(new zt(.07,.08,.03,8),e);de.position.set(Nt,.015,ye),Zt.add(de)})});let ie=new P(new zt(.032,.032,2.95,6),n);ie.rotation.z=Math.PI/2,ie.position.y=1.94,ie.castShadow=!0,Zt.add(ie);let Xt=new Jt;Xt.position.set(0,1.92,0),Zt.add(Xt);let U=new P(new be(2.35,1.48,12,8),m);U.position.y=-.76,U.castShadow=!0,Xt.add(U);let Pe=new P(new zt(.014,.014,2.38,6),p);Pe.rotation.z=Math.PI/2,Pe.position.y=-.02,Xt.add(Pe);let oe=new P(new zt(.014,.014,2.38,6),p);oe.rotation.z=Math.PI/2,oe.position.y=-1.5,Xt.add(oe);for(let Nt=0;Nt<7;Nt++){let Wt=-1.08+Nt*.36,ue=new P(new De(.042,.01,5,10),e);ue.rotation.y=Math.PI/2,ue.position.set(Wt,.01,0),Xt.add(ue);let ye=new P(new zt(.018,.018,.045,6),e);ye.rotation.z=Math.PI/2,ye.position.set(Wt,-1.5,0),Xt.add(ye)}let Ae=[vt({color:15627336,wetness:.42}),vt({color:5290141,wetness:.42}),vt({color:16042318,wetness:.42})],Lt=[];function Me(Nt,Wt,ue,ye,de,M,F){let j=new Jt,X=new R((Nt+ye)*.5,(Wt+de)*.5-.34,(ue+M)*.5);j.position.copy(X),t.add(j);let q=new R(Nt,Wt,ue).sub(X),It=new R(ye,de,M).sub(X),Dt=new R(0,-.32,0),Rt=new di(q,Dt,It),V=new P(new kn(Rt,14,.016,5,!1),p);j.add(V);for(let ht=1;ht<=F;ht++){let Ct=Rt.getPoint(ht/(F+1)),Bt=new P(new Oe(.085,8,6),Ae[ht%3]);Bt.position.copy(Ct),Bt.castShadow=!0,j.add(Bt)}Lt.push({group:j,wx:X.x,wz:X.z})}Me(-7.52,Z+1.94,9.94,-4.78,Z+1.94,9.56,7),Me(-10.3,Z+3.45,-5.8,-10.3,Z+3.45,-1.2,8);let Kt=new Jt;Kt.position.set(-6.1,Z,-7.8),Kt.rotation.y=.55,t.add(Kt);let se=new P(new zt(.09,.12,2.35,8),n);se.position.y=1.175,se.castShadow=!0,Kt.add(se);let C=new P(new Yt(1.65,.11,.11),n);C.position.set(.68,2.55,0),C.rotation.z=.34,C.castShadow=!0,Kt.add(C);let E=.86,W=1.08,yt=new P(new zt(.035,.035,Math.hypot(E,W)+.04,6),n);yt.position.set(E*.5,1.5+W*.5,0),yt.rotation.z=-Math.atan2(E,W),Kt.add(yt);let ut=new P(new zt(.14,.14,.24,10),e);ut.rotation.x=Math.PI/2,ut.position.set(.14,.92,0),Kt.add(ut);let nt=new P(new Yt(.24,.04,.04),s);nt.position.set(.14,.92,.16),Kt.add(nt);let et=new P(new zt(.06,.06,.05,10),e);et.rotation.x=Math.PI/2,et.position.set(1.36,2.75,0),Kt.add(et);let J=new P(new zt(.012,.012,1.32,5),s);J.position.set(1.36,2.09,0),Kt.add(J);let ot=new P(new De(.055,.016,5,10,Math.PI*1.4),n);ot.position.set(1.36,1.39,0),ot.rotation.z=Math.PI*.7,Kt.add(ot);let L=[{x:3.2,z:-4.5,label:"03",phase:.7},{x:8.4,z:-1.8,label:"07",phase:2.3}].map(Nt=>{let Wt=new Jt;Wt.position.set(Nt.x,0,Nt.z),t.add(Wt);let ue=vt({color:16777215,map:Ed(Nt.label),wetness:.4}),ye=new P(new zt(.32,.26,.56,14),ue);ye.position.y=.06,ye.castShadow=!0,Wt.add(ye);let de=new P(new Oe(.31,12,8,0,Math.PI*2,0,Math.PI*.5),d);de.position.y=.34,Wt.add(de);let M=new P(new De(.08,.02,5,10),n);return M.position.y=.68,Wt.add(M),{...Nt,group:Wt}}),ct=new Jt;ct.position.set(-11.58,Z,2.55),t.add(ct);let it=new P(new zt(.022,.026,1.95,6),h);it.position.set(.16,.94,0),it.rotation.z=.2,it.castShadow=!0,ct.add(it);let Pt=new P(new De(.24,.018,6,16),s);Pt.position.set(-.04,1.9,.14),Pt.rotation.set(Math.PI*.45,0,-.18),ct.add(Pt);let wt=new P(new Rn(.23,.42,10,1,!0),m);wt.position.set(-.04,1.69,.14),wt.rotation.x=Math.PI,ct.add(wt);let Et=new Jt;Et.position.set(-11.28,Z+.17,2.95),t.add(Et);let Vt=new P(new zt(.19,.14,.34,12),g);Vt.castShadow=!0,Et.add(Vt);let he=new P(new De(.192,.013,5,16),d);he.rotation.x=Math.PI/2,he.position.y=.165,Et.add(he);let Tt=new P(new De(.19,.008,4,14,Math.PI),s);Tt.position.y=.16,Tt.rotation.x=.45,Et.add(Tt);let Qt=new Jt;Qt.position.set(-10.85,Z,9.25),Qt.rotation.y=Math.PI*.25,t.add(Qt);let re=new P(new Yt(1.15,1.92,.72),vt({color:15397363,wetness:.32}));re.position.y=.96,re.castShadow=!0,re.receiveShadow=!0,Qt.add(re);let kt=new P(new be(1.06,1.78),new en({map:vd()}));kt.position.set(0,.98,.365),Qt.add(kt);let Se=new fi(16773580,.55,3.8,2);Se.position.set(0,1.35,.75),Se.layers.enableAll(),Qt.add(Se);let Be=ho("#996248"),Je=new P(new Yt(1.42,.06,.85),vt({color:11957334,map:Be,wetness:.4}));Je.position.set(0,2.06,.25),Je.rotation.x=.24,Je.castShadow=!0,Qt.add(Je);let an=new Jt;an.position.set(-1.95,Z,6.45),an.rotation.y=.35,t.add(an),[-.52,.52].forEach(Nt=>{let Wt=new P(new zt(.032,.036,1.48,6),n);Wt.position.set(Nt,.74,0),Wt.castShadow=!0,an.add(Wt)});let En=new P(new Yt(1.36,.94,.05),s);En.position.y=1.28,En.castShadow=!0,an.add(En);let Fn=new P(new be(1.3,.88),vt({color:16777215,map:yd(),wetness:.25}));Fn.position.set(0,1.28,.028),an.add(Fn);let Mn=new Jt;Mn.position.set(-5.25,Z,-10.1),t.add(Mn);let ln=new P(new zt(.025,.035,3.05,6),r);ln.position.y=1.525,ln.castShadow=!0,Mn.add(ln);let Ut=new Jt;Ut.position.y=2.98,Mn.add(Ut);let ae=vt({color:15494463,wetness:.2,side:Re}),we=vt({color:16185592,wetness:.2,side:Re}),ce=[];for(let Nt=0;Nt<5;Nt++){let Wt=.16-Nt*.02,ue=.14-Nt*.02,ye=new P(new zt(ue,Wt,.22,10,1,!0),Nt%2===0?ae:we);ye.rotation.z=-Math.PI/2,ye.position.x=.14+Nt*.21;let de=new Jt;Nt===0?Ut.add(de):ce[Nt-1].add(de),de.position.x=Nt===0?.05:.2,ye.position.x=.1,de.add(ye),ce.push(de)}let ge=new R(-11.75,Z+3.18,8.35),xe=new R(-10.8,Z+3.95,10.6),ke=new R().lerpVectors(ge,xe,.5);ke.y-=.26;let We=new di(ge,ke,xe);t.add(new P(new kn(We,10,.01,4,!1),a));let Ye=[vt({color:15099212,side:Re}),vt({color:15910465,side:Re}),vt({color:5023418,side:Re}),vt({color:16054264,side:Re})],Ln=[];for(let Nt=1;Nt<=7;Nt++){let Wt=Nt/8,ue=We.getPoint(Wt),ye=new Rn(.11,.26,3);ye.rotateX(Math.PI),ye.translate(0,-.13,0);let de=new P(ye,Ye[Nt%4]);de.position.copy(ue),de.castShadow=!0,t.add(de),Ln.push({mesh:de,wx:ue.x,wz:ue.z,phase:Nt*.9})}return{root:t,dripOrigins:T,update(Nt,Wt){let ue=te.uWindVec.value,ye=te.uGustFrontPos.value,de=te.uGustStrength.value;function M(Dt,Rt){let V=Dt*ue.x+Rt*ue.y;return de*Math.exp(-Math.pow((V-ye)*.14,2))}let F=M(-5.25,-10.1),j=.28+F*.55;Ut.rotation.y=Math.atan2(-ue.y,ue.x),Ut.rotation.z=-.65+j,ce.forEach((Dt,Rt)=>{Dt.rotation.z=Math.sin(Nt*(4.5+F*6)-Rt*.9)*(.06+F*.12),Dt.rotation.y=Math.cos(Nt*(3.8+F*5)-Rt*.8)*(.05+F*.1)}),Ln.forEach(Dt=>{let Rt=M(Dt.wx,Dt.wz);Dt.mesh.rotation.z=.22+Rt*.65+Math.sin(Nt*(5+Rt*7.5)+Dt.phase)*(.14+Rt*.22),Dt.mesh.rotation.x=Math.cos(Nt*4.2+Dt.phase)*(.08+Rt*.18)});let X=M(-6.15,9.75);Xt.rotation.x=.1+X*.36+Math.sin(Nt*3.1)*(.04+X*.08),Xt.rotation.z=Math.cos(Nt*2.4)*(.02+X*.05),Lt.forEach((Dt,Rt)=>{let V=M(Dt.wx,Dt.wz);Dt.group.rotation.x=.08+V*.28+Math.sin(Nt*3.4+Rt)*(.04+V*.09)});let q=Ms(Nt);L.forEach(Dt=>{let Rt=Es(Dt.x,Dt.z,Nt),V=0,ht=0;if(q.active){let Ct=Math.hypot(Dt.x-q.pos.x,Dt.z-q.pos.z),Bt=Math.sin(Ct*1.2-Nt*4)*Math.exp(-Ct*.1)*q.speed;V=Bt*.08,ht=Bt*.28}Dt.group.position.y=Rt+V,Dt.group.rotation.z=Math.sin(Nt*1.5+Dt.phase)*.08+ht,Dt.group.rotation.x=Math.cos(Nt*1.3+Dt.phase)*.07});let It=1+(1-Wt)*2.2;y.forEach(Dt=>{Dt.intensity=.45*It})}}}function Cd(i){let t=new Jt;i.add(t);let e=new gn(1024,1024,{minFilter:Qe,magFilter:Qe,format:An}),n=new gn(512,512,{minFilter:Qe,magFilter:Qe,format:An}),s=new mn(42,1,.2,350),r=new He,o=new He,a=`
    uniform float uTime;
    uniform float uSunIntensity;
    uniform vec2 uCloudCenter;
    uniform vec2 uCloudRadius;
    uniform vec2 uWindVec;
    uniform float uGustFrontPos;
    uniform float uGustStrength;
    uniform float uRainDensity;
    uniform vec2 uBoat4Pos;
    uniform vec2 uBoat4Dir;
    uniform float uBoat4Speed;

    float waterWaveH(vec2 xz, float t) {
      float w1 = 0.032 * sin(xz.x * 0.68 + xz.y * 0.42 + t * 1.35);
      float w2 = 0.022 * cos(xz.x * 0.51 - xz.y * 0.82 + t * 1.05);
      float w3 = 0.014 * sin(xz.x * 1.35 + xz.y * 1.15 - t * 2.15);
      float gust = uGustStrength * 0.024 * sin((xz.x * 0.9 - xz.y * 0.55) * 1.8 + t * 4.5);
      return w1 + w2 + w3 + gust;
    }

    float sdBox2D(vec2 p, vec2 b) {
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }

    // Signed distance to land/quay/breakwater structures (negative inside land, positive in water)
    float quayWaterSDF(vec2 xz) {
      float dWest = sdBox2D(xz - vec2(-12.0, -6.75), vec2(7.0, 12.25));
      float dSouth = sdBox2D(xz - vec2(-7.75, 12.25), vec2(11.25, 6.75));
      float dLand = sdBox2D(xz - vec2(4.45, 9.9), vec2(0.95, 2.3));
      float dSlip = sdBox2D(xz - vec2(4.1, 14.3), vec2(0.85, 1.7)); // slipway waterline around x=4.95
      float dBw = sdBox2D(xz - vec2(-0.65, -11.2), vec2(4.85, 1.4));
      float dPier = length(xz - vec2(4.2, -11.2)) - 2.1;
      return min(min(min(dWest, dSouth), min(dLand, dSlip)), min(dBw, dPier));
    }

    float cloudShadowAt(vec2 xz) {
      vec2 d = (xz - uCloudCenter) / uCloudRadius;
      float r2 = dot(d, d);
      float wisp = 0.14 * sin(xz.x * 0.22 + uTime * 0.15) * cos(xz.y * 0.18 - uTime * 0.11);
      float cov = 1.0 - smoothstep(0.35, 1.15, r2 + wisp);
      return (1.0 - 0.36 * cov) * uSunIntensity;
    }
  `,l=new be(tn*2,tn*2,132,132);l.rotateX(-Math.PI/2);let c=new Xe({transparent:!0,depthWrite:!1,side:Re,uniforms:{uTime:te.uTime,uSunIntensity:te.uSunIntensity,uCloudCenter:te.uCloudCenter,uCloudRadius:te.uCloudRadius,uWindVec:te.uWindVec,uGustFrontPos:te.uGustFrontPos,uGustStrength:te.uGustStrength,uRainDensity:te.uRainDensity,uBoat4Pos:te.uBoat4Pos,uBoat4Dir:te.uBoat4Dir,uBoat4Speed:te.uBoat4Speed,tReflection:{value:e.texture},uReflVP:{value:r},uSunDir:te.uSunDir},vertexShader:`
      ${a}
      uniform mat4 uReflVP;
      varying vec3 vWorldPos;
      varying vec4 vReflClip;
      varying vec3 vWaveNorm;

      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = waterWaveH(wp.xz, uTime);
        wp.y += h;

        float eps = 0.15;
        float hx = waterWaveH(wp.xz + vec2(eps, 0.0), uTime);
        float hz = waterWaveH(wp.xz + vec2(0.0, eps), uTime);
        vWaveNorm = normalize(vec3(h - hx, eps, h - hz));

        vWorldPos = wp.xyz;
        vReflClip = uReflVP * vec4(wp.x, 0.0, wp.z, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,fragmentShader:`
      ${a}
      uniform sampler2D tReflection;
      uniform vec3 uSunDir;
      varying vec3 vWorldPos;
      varying vec4 vReflClip;
      varying vec3 vWaveNorm;

      // Concentric raindrop ripple pattern
      float rainRipples(vec2 xz, float t) {
        float ringSum = 0.0;
        vec2 cell = floor(xz * 0.85);
        vec2 frac = fract(xz * 0.85) - 0.5;
        for (int ox = -1; ox <= 1; ox++) {
          for (int oz = -1; oz <= 1; oz++) {
            vec2 c = cell + vec2(float(ox), float(oz));
            float rnd = fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453);
            if (rnd > uRainDensity * 0.92) continue;
            float phase = fract(t * (0.42 + rnd * 0.25) + rnd * 6.28);
            vec2 center = vec2(ox, oz) + (vec2(fract(rnd * 19.3), fract(rnd * 41.7)) - 0.5) * 0.7;
            float d = length(frac - center);
            float r = phase * 0.55;
            float band = smoothstep(0.035, 0.0, abs(d - r)) * (1.0 - phase);
            ringSum += band;
          }
        }
        return clamp(ringSum, 0.0, 1.0);
      }

      void main() {
        vec2 xz = vWorldPos.xz;
        float qDist = quayWaterSDF(xz);
        if (qDist < -0.02) discard;

        // Multi-scale crisp wave distortion for fractured anime reflection blocks
        float gustDot = dot(xz, uWindVec);
        float localGust = uGustStrength * exp(-pow((gustDot - uGustFrontPos) * 0.14, 2.0));
        float gustRipple = localGust * sin(gustDot * 5.2 - uTime * 7.5);

        float ripple1 = sin(xz.x * 2.8 + uTime * 1.9 + cos(xz.y * 2.2 - uTime * 1.4));
        float ripple2 = cos(xz.y * 3.4 - uTime * 1.6 + sin(xz.x * 2.5 + uTime * 1.2));
        vec2 distort = vec2(ripple1, ripple2) * 0.022 + vWaveNorm.xz * 0.055 + vec2(gustRipple * 0.015);

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        bool underwaterView = cameraPosition.y < 0.0;

        // Planar reflection UV & posterized color-block quantization (Section 9.4!)
        vec2 reflUv = (vReflClip.xy / max(0.0001, vReflClip.w)) * 0.5 + 0.5 + distort;
        reflUv = clamp(reflUv, 0.004, 0.996);
        vec3 reflCol = texture2D(tReflection, reflUv).rgb;
        float reflLum = dot(reflCol, vec3(0.299, 0.587, 0.114));

        // Posterize reflection into crisp sea-blue, cyan-green, and bright white cel blocks!
        vec3 deepIndigo = vec3(0.11, 0.36, 0.48);
        vec3 cyanBlock  = vec3(0.32, 0.68, 0.72);
        vec3 paleShard  = vec3(0.90, 0.97, 0.98);

        float b1 = smoothstep(0.34, 0.38, reflLum);
        float b2 = smoothstep(0.68, 0.72, reflLum);
        vec3 posterRefl = mix(deepIndigo, cyanBlock, b1);
        posterRefl = mix(posterRefl, paleShard, b2);
        // Subtle hint of reflected object hue while preserving clean flat blocks
        posterRefl = mix(posterRefl, reflCol * 0.85 + vec3(0.12, 0.22, 0.24), 0.22);

        // Base clear sea-glass water body color
        vec3 shallowGlass = vec3(0.36, 0.78, 0.79);
        vec3 midHarbor    = vec3(0.22, 0.60, 0.67);
        float depthMix = smoothstep(0.5, 9.0, qDist);
        vec3 waterBase = mix(shallowGlass, midHarbor, depthMix);

        // Fresnel blend (looking steep down shows seabed clearly; grazing angles show vivid posterized reflections!)
        float fresnel = pow(1.0 - max(abs(dot(vWaveNorm, viewDir)), 0.0), 2.3);
        float reflWeight = underwaterView ? 0.18 : mix(0.32, 0.82, fresnel);
        vec3 col = mix(waterBase, posterRefl, reflWeight);

        // Boat 4 traveling white cel-shaded Kelvin V-wake & scalloped foam chevrons
        float wakeFoam = 0.0;
        if (uBoat4Speed > 0.02) {
          vec2 rel = xz - uBoat4Pos;
          float along = dot(rel, -uBoat4Dir);
          float across = abs(dot(rel, vec2(-uBoat4Dir.y, uBoat4Dir.x)));
          if (along > -0.2 && along < 12.2) {
            float armWiggle = 0.14 * sin(along * 1.9 - uTime * 3.8) + 0.08 * cos(along * 3.4 + across * 2.1);
            float vCone = max(0.25, along * 0.35 + 0.58 + armWiggle);
            float armBreak = 0.55 + 0.45 * smoothstep(-0.25, 0.45, sin(along * 2.2 - uTime * 3.1));
            float outerArm = smoothstep(0.42, 0.12, abs(across - vCone)) * armBreak;
            float innerChev = smoothstep(0.32, 0.08, abs(across - vCone * 0.58)) * smoothstep(0.15, 0.65, sin(along * 2.8 - uTime * 4.2 - across * 1.8));
            float sternWash = smoothstep(0.68, 0.10, across) * smoothstep(0.0, 0.55, sin(along * 3.2 - uTime * 4.5 + across * 2.0));
            float fade = smoothstep(-0.1, 0.6, along) * (1.0 - smoothstep(2.2, 12.2, along)) * uBoat4Speed;
            wakeFoam = clamp((outerArm * 0.92 + innerChev * 0.65 + sternWash * 0.72) * fade, 0.0, 1.0);
          }
        }

        // Crisp anime cel-shaded shore foam along quay walls & tetrapods
        float waveOsc = 0.06 * sin(xz.x * 1.9 + xz.y * 1.5 - uTime * 2.2);
        float shoreBand = smoothstep(0.26, 0.14, qDist + waveOsc);

        // Tetrapod foam surges gently between blocks at SE corner & breakwater tip
        float dPodSE = length(xz - vec2(5.6, 17.5));
        float dPodBW = length(xz - vec2(5.8, -11.8));
        float podRingSE = smoothstep(0.32, 0.10, abs(dPodSE - (1.75 + 0.25 * sin(uTime * 1.8)))) * step(dPodSE, 2.8);
        float podRingBW = smoothstep(0.32, 0.10, abs(dPodBW - (1.85 + 0.25 * cos(uTime * 1.65)))) * step(dPodBW, 3.0);

        // Boat hull waterline foam (elliptical hulls of moored boats 1,2,3 + moving boat 4!)
        float b1d = length((xz - vec2(-1.65, 4.18)) / vec2(2.45, 0.92)) - 1.0;
        float b2d = length((xz - vec2(-3.52, -0.65)) / vec2(1.06, 3.05)) - 1.0;
        float b3d = length((xz - vec2(-3.48, -6.95)) / vec2(1.04, 2.95)) - 1.0;
        // Boat 4 rotated frame
        vec2 b4rel = xz - uBoat4Pos;
        vec2 b4fwd = normalize(uBoat4Dir + vec2(0.0001, 0.0));
        vec2 b4side = vec2(-b4fwd.y, b4fwd.x);
        float b4d = length(vec2(dot(b4rel, b4side) / 1.05, dot(b4rel, b4fwd) / 2.90)) - 1.0;
        float boatEdge = min(min(b1d, b2d), min(b3d, b4d));
        float hullFoam = smoothstep(0.16, 0.02, abs(boatEdge) + waveOsc * 0.25) * step(-0.12, boatEdge);

        // Concentric raindrop ripples
        float rRip = rainRipples(xz, uTime);

        // Organic non-grid jittered sunlight sparkles modulated by drifting cloud shadows!
        float sunMod = cloudShadowAt(xz);
        vec2 spCell = floor(xz * 1.45);
        vec2 spFrac = fract(xz * 1.45) - 0.5;
        vec2 spHash = vec2(
          fract(sin(dot(spCell, vec2(127.1, 311.7))) * 43758.5453),
          fract(sin(dot(spCell, vec2(269.5, 183.3))) * 43758.5453)
        );
        vec2 spCenter = (spHash - 0.5) * 0.72;
        float spDist = length(spFrac - spCenter);
        float spTwinkle = sin(uTime * (3.0 + spHash.x * 3.5) + spHash.y * 24.0);
        float spThreshold = step(0.62, spHash.x) * step(0.45, spTwinkle + localGust * 0.4);
        float sparkle = smoothstep(0.11, 0.02, spDist) * spThreshold * sunMod;

        float totalFoam = clamp(shoreBand * 0.72 + hullFoam * 0.65 + (podRingSE + podRingBW) * 0.8 + wakeFoam * 0.95 + rRip * 0.35, 0.0, 1.0);
        col = mix(col, vec3(0.95, 0.99, 1.0), totalFoam);
        col += vec3(1.0, 0.96, 0.82) * sparkle * 0.85;

        // Subtle cloud shadow dimming on water body
        col *= mix(0.84, 1.04, sunMod);

        float alpha = underwaterView
          ? 0.42
          : clamp(mix(0.44, 0.82, fresnel) + totalFoam * 0.28 + sparkle * 0.15, 0.42, 0.94);

        gl_FragColor = vec4(col, alpha);
      }
    `}),h=new P(l,c);h.position.y=gl,h.layers.set(1),t.add(h);let f=new Xe({transparent:!0,depthWrite:!1,uniforms:{uTime:te.uTime,uSunIntensity:te.uSunIntensity,uRainDensity:te.uRainDensity,tReflection:{value:n.texture},uReflVP:{value:o}},vertexShader:`
      uniform mat4 uReflVP;
      varying vec3 vWorldPos;
      varying vec2 vLocalUv;
      varying vec4 vReflClip;
      void main() {
        vLocalUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vReflClip = uReflVP * vec4(wp.xyz, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,fragmentShader:`
      uniform float uTime;
      uniform float uSunIntensity;
      uniform float uRainDensity;
      uniform sampler2D tReflection;
      varying vec3 vWorldPos;
      varying vec2 vLocalUv;
      varying vec4 vReflClip;

      void main() {
        vec2 p = vLocalUv * 2.0 - 1.0;
        float wobble = 0.14 * sin(atan(p.y, p.x) * 3.0 + 1.2) + 0.08 * cos(atan(p.y, p.x) * 5.0 - 0.4);
        float d = length(p) + wobble;
        if (d > 0.92) discard;

        // Concentric raindrop ripple rings in puddle (contrast trough + crisp white crest)
        float r1 = fract(uTime * 0.58);
        float r2 = fract(uTime * 0.58 + 0.36);
        float r3 = fract(uTime * 0.58 + 0.71);
        float dr1 = abs(length(p - vec2(0.18, -0.10)) - r1 * 0.68);
        float dr2 = abs(length(p - vec2(-0.26, 0.22)) - r2 * 0.64);
        float dr3 = abs(length(p - vec2(0.02, 0.28)) - r3 * 0.56);
        float ring1 = smoothstep(0.048, 0.0, dr1) * (1.0 - r1);
        float ring2 = smoothstep(0.048, 0.0, dr2) * (1.0 - r2);
        float ring3 = smoothstep(0.045, 0.0, dr3) * (1.0 - r3);
        float trough = (smoothstep(0.085, 0.032, dr1) * (1.0 - r1) + smoothstep(0.085, 0.032, dr2) * (1.0 - r2)) * 0.38;
        vec2 ripOffset = normalize(p + 0.001) * (ring1 + ring2 + ring3) * 0.024;

        vec2 rUv = (vReflClip.xy / max(0.0001, vReflClip.w)) * 0.5 + 0.5 + ripOffset;
        rUv = clamp(rUv, 0.01, 0.99);
        vec3 refl = texture2D(tReflection, rUv).rgb;
        float lum = dot(refl, vec3(0.299, 0.587, 0.114));
        vec3 shadowSil = vec3(0.16, 0.42, 0.54);
        vec3 midRefl   = vec3(0.42, 0.72, 0.78);
        vec3 skyRefl   = vec3(0.86, 0.95, 0.97);
        vec3 postRefl = mix(shadowSil, midRefl, smoothstep(0.32, 0.56, lum));
        postRefl = mix(postRefl, skyRefl, smoothstep(0.68, 0.85, lum));
        postRefl = mix(postRefl, refl * 0.82 + vec3(0.12, 0.22, 0.26), 0.35);
        postRefl = mix(postRefl, vec3(0.30, 0.58, 0.68), clamp(trough, 0.0, 0.65));

        float rim = smoothstep(0.92, 0.76, d);
        float ringBright = clamp((ring1 + ring2 + ring3) * 0.78, 0.0, 0.95);
        vec3 col = mix(postRefl, vec3(0.97, 0.99, 1.0), ringBright);
        col *= mix(0.88, 1.04, uSunIntensity);

        gl_FragColor = vec4(col, rim * 0.82);
      }
    `}),u=new P(new be(3.1,2.3),f);u.rotation.x=-Math.PI/2,u.rotation.z=.22,u.position.set(.55,Z+.014,9.2),u.layers.set(1),t.add(u);let d=new P(new be(1.75,1.35),f);d.rotation.x=-Math.PI/2,d.rotation.z=-.35,d.position.set(-2.4,Z+.014,10.6),d.layers.set(1),t.add(d);let g=new Xe({transparent:!0,depthWrite:!1,side:Re,uniforms:{uTime:te.uTime,uSunIntensity:te.uSunIntensity,uCloudCenter:te.uCloudCenter,uCloudRadius:te.uCloudRadius,uWindVec:te.uWindVec,uGustFrontPos:te.uGustFrontPos,uGustStrength:te.uGustStrength,uRainDensity:te.uRainDensity,uBoat4Pos:te.uBoat4Pos,uBoat4Dir:te.uBoat4Dir,uBoat4Speed:te.uBoat4Speed},vertexShader:`
      ${a}
      attribute float aIsTop;
      varying vec3 vWorldPos;
      varying float vIsTop;
      varying float vDepthFrac;

      void main() {
        vIsTop = aIsTop;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        if (aIsTop > 0.5) {
          wp.y += waterWaveH(wp.xz, uTime);
        }
        vWorldPos = wp.xyz;
        vDepthFrac = clamp(-wp.y / 3.8, 0.0, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,fragmentShader:`
      ${a}
      varying vec3 vWorldPos;
      varying float vIsTop;
      varying float vDepthFrac;

      void main() {
        vec3 topCol = vec3(0.46, 0.87, 0.86);
        vec3 botCol = vec3(0.18, 0.56, 0.65);
        vec3 col = mix(topCol, botCol, vDepthFrac);

        // Soft vertical underwater sunbeams / caustic curtains inside cutaway slab
        float coord = vWorldPos.x * 0.7 + vWorldPos.z * 0.7;
        float shaft = 0.5 + 0.5 * sin(coord * 1.4 + uTime * 0.7 + vWorldPos.y * 0.5);
        float sunMod = cloudShadowAt(vWorldPos.xz);
        col += vec3(0.24, 0.34, 0.28) * pow(shaft, 3.0) * (1.0 - vDepthFrac) * sunMod;

        // Crisp bright meniscus rim right along the animated wave top line!
        float topEdge = smoothstep(0.95, 1.0, vIsTop);
        col = mix(col, vec3(0.92, 0.99, 1.0), topEdge * 0.85);

        float alpha = mix(0.40, 0.56, vDepthFrac) + topEdge * 0.28;
        gl_FragColor = vec4(col, alpha);
      }
    `});function v(_,A,w,x,S){let b=[],N=[],G=[];for(let z=0;z<=56;z++){let Y=z/56,B=w+(x-w)*Y,H=_==="x"?A:B,$=_==="x"?B:A,Q=lo(H,$)?gl-.02:gi(H,$);b.push(H,Q,$),N.push(0),b.push(H,gl,$),N.push(1)}for(let z=0;z<56;z++){let Y=z*2,B=Y+1,H=Y+2,$=Y+3;S?G.push(Y,H,B,B,H,$):G.push(Y,B,H,B,$,H)}let K=new qe;K.setAttribute("position",new me(b,3)),K.setAttribute("aIsTop",new me(N,1)),K.setIndex(G),K.computeVertexNormals();let D=new P(K,g);D.layers.set(1),t.add(D)}v("x",tn,-tn,tn,!1),v("z",tn,3.5,tn,!0),v("z",-tn,-5.5,tn,!1);let m=new R,p=new R,y=new bn(new R(0,1,0),.04),T=new bn(new R(0,1,0),-Z+.06);return{root:t,reflectionRT:e,renderReflection(_,A,w,x){if(w.position.y<=.05)return;s.fov=w.fov,s.aspect=w.aspect,s.near=w.near,s.far=w.far,s.updateProjectionMatrix();let S=x||p;x||(w.getWorldDirection(p),p.add(w.position)),m.copy(w.position),m.y=-m.y,s.position.copy(m),p.copy(S),p.y=-p.y,s.up.set(0,1,0),s.lookAt(p),s.updateMatrixWorld(!0),r.multiplyMatrices(s.projectionMatrix,s.matrixWorldInverse),s.layers.set(0),s.layers.enable(2);let I=_.getRenderTarget(),b=_.clippingPlanes;_.clippingPlanes=[y],_.setRenderTarget(e),_.clear(),_.render(A,s),w.position.y>Z+.02&&(m.copy(w.position),m.y=2*Z-m.y,s.position.copy(m),p.copy(S),p.y=2*Z-p.y,s.up.set(0,1,0),s.lookAt(p),s.updateMatrixWorld(!0),o.multiplyMatrices(s.projectionMatrix,s.matrixWorldInverse),_.clippingPlanes=[T],_.setRenderTarget(n),_.clear(),_.render(A,s)),_.setRenderTarget(I),_.clippingPlanes=b}}}function Pd(i,t=[]){let e=new Jt;i.add(e);let n=new Xe({side:vn,depthWrite:!1,uniforms:{uTime:te.uTime,uSunDir:te.uSunDir,uSunIntensity:te.uSunIntensity},vertexShader:`
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = normalize(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,fragmentShader:`
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform float uSunIntensity;
      varying vec3 vDir;

      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 nadirCol   = vec3(0.84, 0.94, 0.96);
        vec3 horizonCol = vec3(0.90, 0.96, 0.98);
        vec3 zenithCol  = vec3(0.70, 0.88, 0.93);

        vec3 col = vDir.y >= 0.0
          ? mix(horizonCol, zenithCol, pow(clamp(vDir.y, 0.0, 1.0), 0.72))
          : mix(horizonCol, nadirCol, clamp(-vDir.y * 2.0, 0.0, 1.0));

        // Soft warm sunlit glow around sun direction
        float sunDot = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        col += vec3(1.0, 0.95, 0.82) * pow(sunDot, 12.0) * 0.24 * uSunIntensity;
        col += vec3(1.0, 0.98, 0.90) * smoothstep(0.996, 0.9995, sunDot) * 0.55 * uSunIntensity;

        // Thin anime cel clouds drifting gently across upper sky
        if (vDir.y > 0.04) {
          vec2 skyUv = vDir.xz / (vDir.y + 0.22);
          vec2 p = skyUv * 1.15 + vec2(uTime * 0.012, uTime * 0.008);
          float c1 = sin(p.x * 1.7 + cos(p.y * 1.3)) + cos(p.y * 1.9 - sin(p.x * 1.1));
          float cloudBand = smoothstep(0.55, 0.92, c1 * 0.5 + 0.35) * smoothstep(0.04, 0.24, vDir.y);
          vec3 cloudTint = mix(vec3(0.98, 0.99, 1.0), vec3(0.84, 0.91, 0.95), 1.0 - uSunIntensity);
          col = mix(col, cloudTint, cloudBand * 0.52);
        }

        // Subtle overall sky dimming during rare cloud-over moment
        col *= mix(0.86, 1.0, uSunIntensity);
        gl_FragColor = vec4(col, 1.0);
      }
    `}),s=new P(new Oe(210,32,20),n);s.layers.set(2),e.add(s);let r=1600,o=new Float32Array(r*2*3),a=new Float32Array(r*2),l=new Float32Array(r*2);for(let B=0;B<r;B++){let H=(Ue(B*11+1)-.5)*44,$=Ue(B*17+2)*24,Q=(Ue(B*23+3)-.5)*44,dt=Ue(B*31+7);for(let Ft=0;Ft<2;Ft++){let qt=(B*2+Ft)*3;o[qt]=H,o[qt+1]=$,o[qt+2]=Q,a[B*2+Ft]=dt,l[B*2+Ft]=Ft}}let c=new qe;c.setAttribute("position",new Pn(o,3)),c.setAttribute("aSeed",new Pn(a,1)),c.setAttribute("aEnd",new Pn(l,1));let h=new Xe({transparent:!0,depthWrite:!1,uniforms:{uTime:te.uTime,uWindVec:te.uWindVec,uGustStrength:te.uGustStrength,uRainDensity:te.uRainDensity,uSunIntensity:te.uSunIntensity},vertexShader:`
      attribute float aSeed;
      attribute float aEnd;
      uniform float uTime;
      uniform vec2 uWindVec;
      uniform float uGustStrength;
      uniform float uRainDensity;
      varying float vVisible;
      varying float vSparkle;
      varying float vEnd;

      void main() {
        vEnd = aEnd;
        vVisible = step(aSeed, uRainDensity);

        float speed = 13.5 + aSeed * 5.0;
        float heightSpan = 24.0;
        float y = mod(position.y - uTime * speed + aSeed * 37.0, heightSpan) - 2.0;

        float slant = 0.16 + uGustStrength * 0.24;
        vec2 drift = uWindVec * (uTime * (2.6 + uGustStrength * 3.8));
        vec2 xz = mod(position.xz + drift + 22.0, 44.0) - 22.0;

        // Streak vector points down & along wind slant
        vec3 streakDir = normalize(vec3(uWindVec.x * slant, -1.0, uWindVec.y * slant));
        float len = (0.48 + aSeed * 0.34) * (1.0 + uGustStrength * 0.35);
        vec3 p = vec3(xz.x, y, xz.y) - streakDir * (aEnd * len);

        // Keep rain outside covered roofs (Warehouse, Waiting Room, & under Skiff)
        bool inWarehouse = p.x > -17.6 && p.x < -10.4 && p.z > -7.6 && p.z < 0.6 && p.y < 5.75;
        bool inWaiting   = p.x > -17.4 && p.x < -11.6 && p.z > 2.0  && p.z < 8.6 && p.y < 4.75;
        bool underSkiff  = p.x > 1.1   && p.x < 4.0   && p.z > 13.2 && p.z < 15.1 && p.y < 1.4;
        if (inWarehouse || inWaiting || underSkiff) {
          vVisible = 0.0;
        }

        // Warm golden glint when passing sunlit zones
        vSparkle = 0.55 + 0.45 * sin(uTime * 3.5 + aSeed * 62.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,fragmentShader:`
      uniform float uSunIntensity;
      varying float vVisible;
      varying float vSparkle;
      varying float vEnd;

      void main() {
        if (vVisible < 0.5) discard;
        vec3 baseRain = vec3(0.92, 0.97, 0.99);
        vec3 goldGlint = vec3(1.0, 0.92, 0.72);
        vec3 col = mix(baseRain, goldGlint, vSparkle * 0.72 * uSunIntensity);
        float alpha = (1.0 - vEnd * 0.75) * mix(0.24, 0.52, vSparkle * uSunIntensity);
        gl_FragColor = vec4(col, alpha);
      }
    `}),f=new wr(c,h);f.frustumCulled=!1,f.layers.set(1),e.add(f);function u(B){return new Xe({transparent:!0,depthWrite:!1,blending:Zr,side:Re,uniforms:{uTime:te.uTime,uSunIntensity:te.uSunIntensity,uCloudCenter:te.uCloudCenter,uCloudRadius:te.uCloudRadius,uAlphaPeak:{value:B}},vertexShader:`
        varying vec2 vUv;
        varying vec3 vWPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,fragmentShader:`
        uniform float uTime;
        uniform float uSunIntensity;
        uniform vec2 uCloudCenter;
        uniform vec2 uCloudRadius;
        uniform float uAlphaPeak;
        varying vec2 vUv;
        varying vec3 vWPos;

        void main() {
          vec2 d = (vWPos.xz - uCloudCenter) / uCloudRadius;
          float cov = 1.0 - smoothstep(0.35, 1.15, dot(d, d));
          float cloudFade = (1.0 - 0.58 * cov) * uSunIntensity;

          float across = sin(vUv.x * 3.14159);
          float along = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.65, 1.0, vUv.y));
          float shimmer = 0.85 + 0.15 * sin(vUv.x * 9.0 + uTime * 1.4);

          vec3 warmGold = vec3(1.0, 0.85, 0.44);
          vec3 skyRay = vec3(1.0, 0.92, 0.68);
          vec3 col = mix(skyRay, warmGold, step(0.08, uAlphaPeak));
          float alpha = pow(across, 1.8) * along * shimmer * uAlphaPeak * cloudFade;
          gl_FragColor = vec4(col, alpha);
        }
      `})}let d=u(.042),g=u(.165);function v(B,H,$,Q,dt,Ft=0,qt=!1){let O=new Jt;O.position.set(B,H,$),O.rotation.y=Ft,O.rotation.z=.68,O.rotation.x=-.34,e.add(O);let xt=qt?g:d;[0,Math.PI/2].forEach(tt=>{let st=new P(new be(Q,dt),xt);st.rotation.y=tt,st.layers.set(1),O.add(st)})}v(-13.8,3.6,-4.2,2.4,5.4,.2,!0),v(-14.2,3.6,-1.6,2,5.2,.2,!0),v(-3,3.2,-.4,2.4,5.6,0,!1),v(-2.8,6.4,9.2,3.8,9,.1,!1),v(10.2,5.4,5.8,3.6,10,.1,!1);let m=new Oe(.017,6,5);m.scale(.8,1.5,.8);let p=new en({color:16774614,transparent:!0,opacity:.88}),y=t.map(B=>{let H=new P(m,p);return H.layers.set(1),e.add(H),{mesh:H,origin:B}}),T=new en({color:16252157,transparent:!0,opacity:.72}),_=[];[[5.2,.06,17.3],[6.2,.06,17.8],[6.9,.06,16.9],[5.9,.06,-12.3],[6.4,.06,-11],[4.9,.06,-13.1]].forEach(([B,H,$],Q)=>{let dt=new P(new Ai(.55,10),T);dt.rotation.x=-Math.PI/2,dt.position.set(B,H,$),dt.layers.set(1),e.add(dt),_.push({mesh:dt,phase:Q*1.15})});let w=new Xe({transparent:!0,depthWrite:!1,side:Re,uniforms:{uColor:{value:new fe(15661306)}},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = (1.0 - smoothstep(0.25, 1.0, r)) * 0.36;
        gl_FragColor = vec4(uColor, a);
      }
    `}),x=[];for(let B=0;B<6;B++){let H=new P(new be(16+B*2,2.6),w);H.position.set(-32+B*14,1.4+B%2*.8,-56-B%3*5),H.layers.set(1),e.add(H),x.push({mesh:H,baseX:H.position.x,speed:.65+B%3*.25})}let S=new Xe({transparent:!0,depthWrite:!1,side:Re,uniforms:{uOpacity:{value:0}},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        if (uOpacity < 0.01) discard;
        // RingGeometry UVs map cleanly or use radial distance from center
        float t = vUv.y;
        // Soft pastel anime rainbow bands
        vec3 cRed    = vec3(0.98, 0.72, 0.68);
        vec3 cGold   = vec3(0.99, 0.90, 0.66);
        vec3 cMint   = vec3(0.68, 0.93, 0.82);
        vec3 cCyan   = vec3(0.66, 0.86, 0.98);
        vec3 cViolet = vec3(0.79, 0.74, 0.96);

        vec3 col = mix(cViolet, cCyan, smoothstep(0.12, 0.32, t));
        col = mix(col, cMint, smoothstep(0.32, 0.50, t));
        col = mix(col, cGold, smoothstep(0.50, 0.68, t));
        col = mix(col, cRed, smoothstep(0.68, 0.86, t));

        float bandAlpha = smoothstep(0.0, 0.20, t) * (1.0 - smoothstep(0.80, 1.0, t));
        float edgeFade = smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
        gl_FragColor = vec4(col, bandAlpha * edgeFade * uOpacity);
      }
    `}),I=24,b=27.2,N=48,G=[],K=[],D=[];for(let B=0;B<=N;B++){let H=B/N,$=.08+H*(Math.PI-.16),Q=Math.cos($),dt=Math.sin($);G.push(Q*I,dt*I,0),K.push(H,0),G.push(Q*b,dt*b,0),K.push(H,1)}for(let B=0;B<N;B++){let H=B*2;D.push(H,H+1,H+2,H+1,H+3,H+2)}let z=new qe;z.setAttribute("position",new me(G,3)),z.setAttribute("uv",new me(K,2)),z.setIndex(D);let Y=new P(z,S);return Y.position.set(-1,-2.5,-52),Y.rotation.y=-.18,Y.layers.set(1),e.add(Y),{root:e,update(B){y.forEach(Q=>{let dt=(B*.55+Q.origin.phase)%1;if(dt<.35){let Ft=.4+dt/.35*.7;Q.mesh.position.set(Q.origin.x,Q.origin.y-.02,Q.origin.z),Q.mesh.scale.setScalar(Ft),Q.mesh.visible=!0}else{let Ft=(dt-.35)/.65,qt=Q.origin.y-Ft*Ft*2.2;Q.mesh.position.set(Q.origin.x,qt,Q.origin.z),Q.mesh.scale.setScalar(1),Q.mesh.visible=qt>.02}}),_.forEach(Q=>{let dt=.78+.36*Math.sin(B*1.9+Q.phase);Q.mesh.scale.setScalar(dt)}),x.forEach(Q=>{Q.mesh.position.x=-48+((Q.baseX+48+B*Q.speed)%96+96)%96});let H=te.uRainDensity.value,$=Di(.5,.28,H)*.32*te.uSunIntensity.value;S.uniforms.uOpacity.value=$}}}function Id(i,t=[]){let e=new Jt;i.add(e);let n=vt({color:16317436,wetness:.15,rimStrength:.25}),s=vt({color:12768734,wetness:.15}),r=vt({color:3031887}),o=vt({color:15771192}),a=new hs({color:1712939});function l(O,xt){let tt=new zn;tt.moveTo(O[0][0],O[0][1]);for(let pt=1;pt<O.length;pt++)tt.lineTo(O[pt][0],O[pt][1]);tt.closePath();let st=new Zn(tt,{depth:xt,bevelEnabled:!1,curveSegments:2});return st.translate(0,0,-xt*.5),st.rotateX(Math.PI/2),st.computeVertexNormals(),st}let c=l([[.032,.02],[-.032,.02],[-.082,-.145],[0,-.165],[.082,-.145]],.013);function h(){let O=new Jt,xt=new P(new Oe(.11,10,8),n);xt.scale.set(.85,.85,1.85),xt.castShadow=!0,O.add(xt);let tt=new P(new Oe(.075,10,8),n);tt.position.set(0,.08,.19),O.add(tt),[-1,1].forEach(ee=>{let Mt=new P(new Oe(.012,6,5),a);Mt.position.set(ee*.056,.098,.232),O.add(Mt)});let st=new P(new Rn(.024,.1,6),o);st.rotation.x=Math.PI/2,st.position.set(0,.07,.29),O.add(st);let pt=new P(c,n);pt.position.set(0,.022,-.155),O.add(pt);let at=[];return[-1,1].forEach(ee=>{let Mt=new Jt;Mt.position.set(ee*.07,.04,.02),O.add(Mt);let $t=l([[0,.062],[ee*.11,.078],[ee*.21,.068],[ee*.21,-.056],[ee*.11,-.068],[0,-.07]],.018),lt=new P($t,s);lt.rotation.z=ee*.14,lt.castShadow=!0,Mt.add(lt);let k=new Jt;k.position.set(ee*.2,.028,.004),k.rotation.z=-ee*.2,Mt.add(k);let rt=l([[0,.064],[ee*.108,.018],[ee*.108,-.074],[0,-.058]],.015),ft=new P(rt,s);ft.castShadow=!0,k.add(ft);let At=l([[ee*.104,.019],[ee*.235,-.052],[ee*.258,-.078],[ee*.238,-.095],[ee*.104,-.074]],.012),_t=new P(At,r);_t.castShadow=!0,k.add(_t),at.push({pivot:Mt,side:ee})}),{group:O,wings:at}}let f=[{cx:1.5,cz:-1.5,rx:7.2,rz:5.5,yBase:6.4,swoopAmp:.95,speed:.42,phase:.2},{cx:4.5,cz:-7.5,rx:6,rz:4.8,yBase:7.6,swoopAmp:.95,speed:.36,phase:2.1},{cx:-2,cz:3,rx:5.8,rz:4.6,yBase:5.2,swoopAmp:.95,speed:-.45,phase:4},{cx:4.2,cz:4.2,rx:5.5,rz:4.5,yBase:2.65,swoopAmp:1.45,speed:.52,phase:1.4}].map(O=>{let xt=h();return e.add(xt.group),{...O,...xt}}),u=h(),d=new R(-4.2,Z+.53,5.85);u.group.position.copy(d),u.group.rotation.y=.65,e.add(u.group);let g=h();e.add(g.group);let v=h(),m={x:1.8,z:-2.4};e.add(v.group);let p=new Jt;e.add(p);let y=vt({color:16250351,wetness:.1}),T=vt({color:14912076,wetness:.1}),_=vt({color:3880242}),A=vt({color:15768726}),w=new Jt;p.add(w);let x=new P(new ls(.11,.22,6,10),y);x.rotation.x=Math.PI/2,x.position.y=.16,x.castShadow=!0,w.add(x);let S=new P(new Oe(.105,8,6),T);S.scale.set(.95,.72,1.15),S.position.set(.02,.2,-.02),w.add(S);let I=new P(new Oe(.075,8,6),_);I.position.set(-.04,.19,-.1),w.add(I);let b=new Jt;b.position.set(0,.24,.16),w.add(b);let N=new P(new Oe(.1,16,12),y);N.scale.set(1.06,.96,.98),N.castShadow=!0,b.add(N),[-1,1].forEach(O=>{let xt=O<0?T:_,tt=new P(new Rn(.042,.085,4),xt);tt.position.set(O*.065,.09,-.01),tt.rotation.z=-O*.28,tt.rotation.y=O*.2,b.add(tt);let st=new P(new Rn(.022,.046,4),A);st.position.set(O*.063,.086,.008),st.rotation.z=-O*.28,st.rotation.y=O*.2,b.add(st);let pt=new P(new Oe(.015,8,6),_);pt.position.set(O*.042,.015,.088),b.add(pt)});let G=vt({color:16777215,emissive:16777215,emissiveIntensity:.4});[-1,1].forEach(O=>{let xt=new P(new Oe(.005,5,5),G);xt.position.set(O*.045,.021,.098),b.add(xt),[-.08,.08].forEach(tt=>{let st=new P(new zt(.002,.0015,.075,4),_);st.rotation.z=Math.PI/2+O*tt,st.position.set(O*.072,-.012+tt*.05,.082),b.add(st)})});let K=new P(new Oe(.012,6,6),A);K.position.set(0,-.008,.1),b.add(K);let D=[];[[-.065,.06,.11],[.065,.06,.11],[-.065,.06,-.11],[.065,.06,-.11]].forEach(([O,xt,tt],st)=>{let pt=new P(new zt(.025,.022,.13,6),y);pt.position.set(O,xt,tt),w.add(pt),D.push({mesh:pt,baseZ:tt,idx:st})});let z=new Jt;z.position.set(0,.14,-.17),w.add(z);let Y=new P(new zt(.018,.024,.22,6),T);Y.position.set(.05,-.01,-.09),Y.rotation.set(1.22,.35,-.35),z.add(Y);let B=new R(2.55,co(2.55)+.02,14.15),H=[[B,new R(1.1,Z,13.1),new R(.7,Z,11.4),new R(1.6,Z,9.6),new R(1.1,Z,13.1),B],[B,new R(.4,Z,12.6),new R(-1.8,Z,7.6),new R(-4.2,Z,6.2),new R(-1.4,Z,10.5),B],[B,new R(-1.2,Z,12.8),new R(-6.2,Z,10.6),new R(-9.1,Z,9.6),new R(-4.5,Z,11.8),B]].map(O=>new yn(O,!1,"centripetal",.45)),$=22,Q=vt({color:12447732,wetness:.28,rimStrength:.35}),dt=vt({color:3898260,wetness:.2}),Ft=[];for(let O=0;O<$;O++){let xt=new Jt,tt=new P(new Oe(.105,8,6),Q);tt.scale.set(.46,.72,1.88),xt.add(tt);let st=new P(new Oe(.092,6,6),dt);st.scale.set(.48,.45,1.62),st.position.y=.026,xt.add(st);let pt=new Jt;pt.position.z=-.17,xt.add(pt);let at=new P(new Rn(.072,.14,3),Q);at.rotation.x=Math.PI/2,at.rotation.z=Math.PI/2,at.scale.set(.35,1,1),at.position.z=-.06,pt.add(at),e.add(xt),Ft.push({group:xt,tailPivot:pt,phase:Ue(O*19+5)*Math.PI*2,radiusX:1.1+Ue(O*7+1)*2.4,radiusZ:1.4+Ue(O*13+3)*3,baseY:-.95-Ue(O*29+2)*1.1,speed:.42+Ue(O*37)*.28,scatterAngle:O/$*Math.PI*2+Ue(O*5)*.4,centerOffsetX:11.4+(Ue(O*41)-.5)*4,centerOffsetZ:4.4+(Ue(O*43)-.5)*6.8})}let qt=new R;return{root:e,catRoot:p,bollardAnchor:d,update(O,xt){f.forEach((lt,k)=>{let rt=O*lt.speed+lt.phase,ft=lt.cx+Math.cos(rt)*lt.rx,At=lt.cz+Math.sin(rt)*lt.rz,_t=Math.sin(rt*2+k)*lt.swoopAmp,St=lt.yBase+_t;lt.group.position.set(ft,St,At);let Gt=-Math.sin(rt)*lt.rx*lt.speed,Zt=Math.cos(rt)*lt.rz*lt.speed;lt.group.rotation.y=Math.atan2(Gt,Zt),lt.group.rotation.z=-lt.speed*.35;let ie=Math.max(0,Math.sin(O*.55+lt.phase)),Xt=Math.sin(O*7.2+lt.phase)*.45*(1-ie*.72)+.08*ie;lt.wings.forEach(U=>{U.pivot.rotation.z=U.side*Xt})});let tt=xt.gullFleeTimer;if(tt<=0)u.group.position.copy(d),u.group.rotation.set(0,.65+Math.sin(O*.9)*.14,0),u.wings.forEach(lt=>{lt.pivot.rotation.y=lt.side*1.32,lt.pivot.rotation.z=-lt.side*.24});else{let lt=Math.min(1,tt/1.4),k=tt*.85,rt=d.x+Math.sin(k)*1.65*lt+tt*.55,ft=d.z-(1-Math.cos(k))*2.35-tt*.78,At=d.y+Math.pow(tt,.92)*1.68;u.group.position.set(rt,At,ft);let _t=tt+.05,St=Math.min(1,_t/1.4),Gt=_t*.85,Zt=d.x+Math.sin(Gt)*1.65*St+_t*.55,ie=d.z-(1-Math.cos(Gt))*2.35-_t*.78;u.group.rotation.set(-.26*Math.max(0,1-tt*.3),Math.atan2(Zt-rt,ie-ft),-.18);let Xt=Math.sin(tt*14.5)*.58;u.wings.forEach(U=>{U.pivot.rotation.y=0,U.pivot.rotation.z=U.side*Xt})}if(t[2]){let lt=t[2].mesh;g.group.position.set(lt.position.x+.36,lt.position.y+1.91,lt.position.z+.18),g.group.rotation.y=-.5+Math.sin(O*.7)*.12,g.wings.forEach(k=>{k.pivot.rotation.y=k.side*1.32,k.pivot.rotation.z=-k.side*.24})}let st=Es(m.x,m.z,O);v.group.position.set(m.x+Math.sin(O*.35)*.25,st+.07,m.z+Math.cos(O*.28)*.2),v.group.rotation.y=1.2+Math.sin(O*.4)*.25,v.wings.forEach(lt=>{lt.pivot.rotation.y=lt.side*1.28,lt.pivot.rotation.z=-lt.side*.22});let pt=O%84;if(O>60.5&&pt>60.5&&pt<80.5){let lt=Math.floor(O/84)%H.length,k=(pt-60.5)/20,rt=H[lt],ft=rt.getPointAt(k),At=rt.getTangentAt(k);p.position.copy(ft),p.rotation.y=Math.atan2(At.x,At.z),w.position.y=Math.abs(Math.sin(O*8))*.02,D.forEach(_t=>{let St=Math.sin(O*8+(_t.idx%2===0?0:Math.PI))*.35;_t.mesh.rotation.x=St}),z.rotation.y=Math.sin(O*3)*.42,b.rotation.y=Math.sin(O*1.6)*.25*(1-xt.catLookAmount),b.rotation.x=-.35*xt.catLookAmount}else{p.position.copy(B),p.rotation.set(0,.55,0),w.position.y=-.04,D.forEach(k=>k.mesh.rotation.x=0),z.rotation.y=Math.sin(O*1.4)*.35;let lt=xt.catLookAmount;if(lt>.02){qt.subVectors(xt.cameraPos,p.position);let k=Math.atan2(qt.x,qt.z),rt=Math.atan2(Math.sin(k-p.rotation.y),Math.cos(k-p.rotation.y));b.rotation.y=rt*.72*lt,b.rotation.x=-.45*lt}else b.rotation.y=Math.sin(O*.8)*.15,b.rotation.x=.08}let ee=xt.fishScatterAmount,Mt=11.2,$t=4;Ft.forEach(lt=>{let k=O*lt.speed+lt.phase,rt=lt.centerOffsetX+Math.cos(k)*lt.radiusX,ft=lt.centerOffsetZ+Math.sin(k)*lt.radiusZ,At=lt.baseY+Math.sin(O*.9+lt.phase)*.22,_t=(O+.05)*lt.speed+lt.phase,St=lt.centerOffsetX+Math.cos(_t)*lt.radiusX,Gt=lt.centerOffsetZ+Math.sin(_t)*lt.radiusZ;if(ee>.01){let U=ee*(2.6+lt.phase%1.4),Pe=Math.cos(lt.scatterAngle)*U,oe=Math.sin(lt.scatterAngle)*U;rt=Qs.clamp(rt+Pe,5.8,17.8),ft=Qs.clamp(ft+oe,-8.4,17.2),St=rt+Math.cos(lt.scatterAngle)*.4,Gt=ft+Math.sin(lt.scatterAngle)*.4}let Zt=rt-4.95,ie=ft+11.85,Xt=Math.hypot(Zt,ie);Xt<4.95&&Xt>.001&&(rt=4.95+Zt/Xt*4.95,ft=-11.85+ie/Xt*4.95),lt.group.position.set(rt,At,ft),lt.group.rotation.y=Math.atan2(St-rt,Gt-ft),lt.tailPivot.rotation.y=Math.sin(O*(7.5+ee*12)+lt.phase*3)*(.34+ee*.28)})}}}var Dd={type:"change"},Zc={type:"start"},Nd={type:"end"},_l=new rs,Ld=new bn,Jx=Math.cos(70*Qs.DEG2RAD),dn=new R,Un=2*Math.PI,ze={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Yc=1e-6,yl=class extends Yr{constructor(t,e=null){super(t,e),this.state=ze.NONE,this.target=new R,this.cursor=new R,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Xi.ROTATE,MIDDLE:Xi.DOLLY,RIGHT:Xi.PAN},this.touches={ONE:qi.ROTATE,TWO:qi.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new R,this._lastQuaternion=new Hn,this._lastTargetPosition=new R,this._quat=new Hn().setFromUnitVectors(t.up,new R(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Js,this._sphericalDelta=new Js,this._scale=1,this._panOffset=new R,this._rotateStart=new bt,this._rotateEnd=new bt,this._rotateDelta=new bt,this._panStart=new bt,this._panEnd=new bt,this._panDelta=new bt,this._dollyStart=new bt,this._dollyEnd=new bt,this._dollyDelta=new bt,this._dollyDirection=new R,this._mouse=new bt,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=$x.bind(this),this._onPointerDown=Kx.bind(this),this._onPointerUp=jx.bind(this),this._onContextMenu=r_.bind(this),this._onMouseWheel=e_.bind(this),this._onKeyDown=n_.bind(this),this._onTouchStart=i_.bind(this),this._onTouchMove=s_.bind(this),this._onMouseDown=Qx.bind(this),this._onMouseMove=t_.bind(this),this._interceptControlDown=o_.bind(this),this._interceptControlUp=a_.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(t){this._cursorStyle=t,t==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(t){super.connect(t),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.ownerDocument.addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=ze.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.ownerDocument.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.ownerDocument.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(t){t.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=t}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(Dd),this.update(),this.state=ze.NONE}pan(t,e){this._pan(t,e),this.update()}dollyIn(t){this._dollyIn(t),this.update()}dollyOut(t){this._dollyOut(t),this.update()}rotateLeft(t){this._rotateLeft(t),this.update()}rotateUp(t){this._rotateUp(t),this.update()}update(t=null){let e=this.object.position;dn.copy(e).sub(this.target),dn.applyQuaternion(this._quat),this._spherical.setFromVector3(dn),this.autoRotate&&this.state===ze.NONE&&this._rotateLeft(this._getAutoRotationAngle(t)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(n)&&isFinite(s)&&(n<-Math.PI?n+=Un:n>Math.PI&&(n-=Un),s<-Math.PI?s+=Un:s>Math.PI&&(s-=Un),n<=s?this._spherical.theta=Math.max(n,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+s)/2?Math.max(n,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=o!=this._spherical.radius}if(dn.setFromSpherical(this._spherical),dn.applyQuaternion(this._quatInverse),e.copy(this.target).add(dn),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){let a=dn.length();o=this._clampDistance(a*this._scale);let l=a-o;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){let a=new R(this._mouse.x,this._mouse.y,0);a.unproject(this.object);let l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;let c=new R(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(a),this.object.updateMatrixWorld(),o=dn.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(_l.origin.copy(this.object.position),_l.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(_l.direction))<Jx?this.object.lookAt(this.target):(Ld.setFromNormalAndCoplanarPoint(this.object.up,this.target),_l.intersectPlane(Ld,this.target))))}else if(this.object.isOrthographicCamera){let o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>Yc||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Yc||this._lastTargetPosition.distanceToSquared(this.target)>Yc?(this.dispatchEvent(Dd),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(t){return t!==null?Un/60*this.autoRotateSpeed*t:Un/60/60*this.autoRotateSpeed}_getZoomScale(t){let e=Math.abs(t*.01);return Math.pow(.95,this.zoomSpeed*e)}_rotateLeft(t){this._sphericalDelta.theta-=t}_rotateUp(t){this._sphericalDelta.phi-=t}_panLeft(t,e){dn.setFromMatrixColumn(e,0),dn.multiplyScalar(-t),this._panOffset.add(dn)}_panUp(t,e){this.screenSpacePanning===!0?dn.setFromMatrixColumn(e,1):(dn.setFromMatrixColumn(e,0),dn.crossVectors(this.object.up,dn)),dn.multiplyScalar(t),this._panOffset.add(dn)}_pan(t,e){let n=this.domElement;if(this.object.isPerspectiveCamera){let s=this.object.position;dn.copy(s).sub(this.target);let r=dn.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*t*r/n.clientHeight,this.object.matrix),this._panUp(2*e*r/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(t*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(e*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(t,e){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),s=t-n.left,r=e-n.top,o=n.width,a=n.height;this._mouse.x=s/o*2-1,this._mouse.y=-(r/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(t){return Math.max(this.minDistance,Math.min(this.maxDistance,t))}_handleMouseDownRotate(t){this._rotateStart.set(t.clientX,t.clientY)}_handleMouseDownDolly(t){this._updateZoomParameters(t.clientX,t.clientY),this._dollyStart.set(t.clientX,t.clientY)}_handleMouseDownPan(t){this._panStart.set(t.clientX,t.clientY)}_handleMouseMoveRotate(t){this._rotateEnd.set(t.clientX,t.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let e=this.domElement;this._rotateLeft(Un*this._rotateDelta.x/e.clientHeight),this._rotateUp(Un*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(t){this._dollyEnd.set(t.clientX,t.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.zoomToCursor&&(this._performCursorZoom=!0,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()),this.update()}_handleMouseMovePan(t){this._panEnd.set(t.clientX,t.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(t){this._updateZoomParameters(t.clientX,t.clientY),t.deltaY<0?this._dollyIn(this._getZoomScale(t.deltaY)):t.deltaY>0&&this._dollyOut(this._getZoomScale(t.deltaY)),this.update()}_handleKeyDown(t){let e=!1;switch(t.code){case this.keys.UP:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateUp(Un*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),e=!0;break;case this.keys.BOTTOM:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateUp(-Un*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),e=!0;break;case this.keys.LEFT:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateLeft(Un*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),e=!0;break;case this.keys.RIGHT:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateLeft(-Un*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),e=!0;break}e&&(t.preventDefault(),this.update())}_handleTouchStartRotate(t){if(this._pointers.length===1)this._rotateStart.set(t.pageX,t.pageY);else{let e=this._getSecondPointerPosition(t),n=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._rotateStart.set(n,s)}}_handleTouchStartPan(t){if(this._pointers.length===1)this._panStart.set(t.pageX,t.pageY);else{let e=this._getSecondPointerPosition(t),n=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._panStart.set(n,s)}}_handleTouchStartDolly(t){let e=this._getSecondPointerPosition(t),n=t.pageX-e.x,s=t.pageY-e.y,r=Math.sqrt(n*n+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enablePan&&this._handleTouchStartPan(t)}_handleTouchStartDollyRotate(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enableRotate&&this._handleTouchStartRotate(t)}_handleTouchMoveRotate(t){if(this._pointers.length==1)this._rotateEnd.set(t.pageX,t.pageY);else{let n=this._getSecondPointerPosition(t),s=.5*(t.pageX+n.x),r=.5*(t.pageY+n.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let e=this.domElement;this._rotateLeft(Un*this._rotateDelta.x/e.clientHeight),this._rotateUp(Un*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(t){if(this._pointers.length===1)this._panEnd.set(t.pageX,t.pageY);else{let e=this._getSecondPointerPosition(t),n=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._panEnd.set(n,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(t){let e=this._getSecondPointerPosition(t),n=t.pageX-e.x,s=t.pageY-e.y,r=Math.sqrt(n*n+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let o=(t.pageX+e.x)*.5,a=(t.pageY+e.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enablePan&&this._handleTouchMovePan(t)}_handleTouchMoveDollyRotate(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enableRotate&&this._handleTouchMoveRotate(t)}_addPointer(t){this._pointers.push(t.pointerId)}_removePointer(t){delete this._pointerPositions[t.pointerId];for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId){this._pointers.splice(e,1);return}}_isTrackingPointer(t){for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId)return!0;return!1}_trackPointer(t){let e=this._pointerPositions[t.pointerId];e===void 0&&(e=new bt,this._pointerPositions[t.pointerId]=e),e.set(t.pageX,t.pageY)}_getSecondPointerPosition(t){let e=t.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[e]}_customWheelEvent(t){let e=t.deltaMode,n={clientX:t.clientX,clientY:t.clientY,deltaY:t.deltaY};switch(e){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return t.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}};function Kx(i){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(i.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(i)&&(this._addPointer(i),i.pointerType==="touch"?this._onTouchStart(i):this._onMouseDown(i),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function $x(i){this.enabled!==!1&&(i.pointerType==="touch"?this._onTouchMove(i):this._onMouseMove(i))}function jx(i){switch(this._removePointer(i),this._pointers.length){case 0:this.domElement.releasePointerCapture(i.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Nd),this.state=ze.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let t=this._pointers[0],e=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:e.x,pageY:e.y});break}}function Qx(i){let t;switch(i.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case Xi.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(i),this.state=ze.DOLLY;break;case Xi.ROTATE:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=ze.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=ze.ROTATE}break;case Xi.PAN:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=ze.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=ze.PAN}break;default:this.state=ze.NONE}this.state!==ze.NONE&&this.dispatchEvent(Zc)}function t_(i){switch(this.state){case ze.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(i);break;case ze.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(i);break;case ze.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(i);break}}function e_(i){this.enabled===!1||this.enableZoom===!1||this.state!==ze.NONE||(i.preventDefault(),this.dispatchEvent(Zc),this._handleMouseWheel(this._customWheelEvent(i)),this.dispatchEvent(Nd))}function n_(i){this.enabled!==!1&&this._handleKeyDown(i)}function i_(i){switch(this._trackPointer(i),this._pointers.length){case 1:switch(this.touches.ONE){case qi.ROTATE:if(this.enableRotate===!1){this.state=ze.NONE;break}this._handleTouchStartRotate(i),this.state=ze.TOUCH_ROTATE;break;case qi.PAN:if(this.enablePan===!1){this.state=ze.NONE;break}this._handleTouchStartPan(i),this.state=ze.TOUCH_PAN;break;default:this.state=ze.NONE}break;case 2:switch(this.touches.TWO){case qi.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(i),this.state=ze.TOUCH_DOLLY_PAN;break;case qi.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(i),this.state=ze.TOUCH_DOLLY_ROTATE;break;default:this.state=ze.NONE}break;default:this.state=ze.NONE}this.state!==ze.NONE&&this.dispatchEvent(Zc)}function s_(i){switch(this._trackPointer(i),this.state){case ze.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(i),this.update();break;case ze.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(i),this.update();break;case ze.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(i),this.update();break;case ze.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(i),this.update();break;default:this.state=ze.NONE}}function r_(i){this.enabled!==!1&&i.preventDefault()}function o_(i){i.key==="Control"&&(this._controlActive=!0,this.domElement.ownerDocument.addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function a_(i){i.key==="Control"&&(this._controlActive=!1,this.domElement.ownerDocument.removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function ai(i){return i<.5?4*i*i*i:1-Math.pow(-2*i+2,3)/2}function l_(i){return 1-Math.pow(1-i,3)}var nr=[{t0:0,t1:6.5,p0:[26.5,15.5,27.5],p1:[19,11.2,20.5],l0:[-1.2,1.8,-1.2],l1:[-1.5,1.7,-1],ease:ai},{t0:6.5,t1:11.5,p0:[6.4,3.85,5.6],p1:[6.2,3.65,-2.5],l0:[-1,1.45,.8],l1:[-.8,1.35,-5.8],ease:ai},{t0:11.5,t1:16,p0:[-3.55,2.75,11.4],p1:[-3.95,2.32,7.6],l0:[-4.2,1.95,5.85],l1:[-3.5,2.65,4.6],ease:l_},{t0:16,t1:21,p0:[3.95,2.75,15],p1:[1.75,2.45,13.7],l0:[.9,1.62,10.1],l1:[.7,1.58,9.2],ease:ai},{t0:21,t1:25.5,p0:[3.95,1.25,16.6],p1:[2.85,1.12,15.3],l0:[2.45,1,14.05],l1:[2.45,1.02,14.05],ease:ai},{t0:25.5,t1:31,p0:[-1.2,4.2,2.5],p1:[-2.6,3.6,13.8],l0:[-6.5,3.3,-5.8],l1:[-7.5,2.65,10.4],ease:ai},{t0:31,t1:36.5,p0:[.2,2.15,.75],p1:[-1.62,1.5,-.32],l0:[-3.52,1.25,-1.25],l1:[-3.52,1.15,-1.42],ease:ai},{t0:36.5,t1:41.5,p0:[-7.6,2.85,2.2],p1:[-8.2,2.42,-3.55],l0:[-14.2,2.7,-3.5],l1:[-14.8,2.9,-3.5],ease:ai},{t0:41.5,t1:46.5,p0:[-8.6,2.85,10.6],p1:[-9.4,2.75,4],l0:[-14.8,2.65,5.6],l1:[-15,2.65,5.4],ease:ai},{t0:46.5,t1:51.5,p0:[19.8,.9,22.8],p1:[23.6,-1.15,11.2],l0:[11.5,-1.1,8],l1:[10.4,-1.35,3.6],ease:ai},{t0:51.5,t1:55.5,p0:[16.5,3.45,-1.8],p1:[14.2,4.05,-.2],l0:[4.5,2.55,-10.8],l1:[3.9,2.75,-11.6],ease:ai},{t0:55.5,t1:60,p0:[15,5.4,7.8],p1:[24,14.5,25],l0:[8.4,.9,-.5],l1:[-1.2,1.8,-1.2],ease:ai}];function Jc(i,t,e){let n=Math.max(0,Math.min(Wc,i)),s=nr[nr.length-1];for(let a=0;a<nr.length;a++)if(n<=nr[a].t1||a===nr.length-1){s=nr[a];break}let r=Math.max(0,Math.min(1,(n-s.t0)/Math.max(.001,s.t1-s.t0))),o=s.ease(r);if(t.set(s.p0[0]+(s.p1[0]-s.p0[0])*o,s.p0[1]+(s.p1[1]-s.p0[1])*o,s.p0[2]+(s.p1[2]-s.p0[2])*o),e.set(s.l0[0]+(s.l1[0]-s.l0[0])*o,s.l0[1]+(s.l1[1]-s.l0[1])*o,s.l0[2]+(s.l1[2]-s.l0[2])*o),n>=55.5&&n<58.6){let a=Ms(n),l=1-(n-55.5)/3.1;e.x+=(a.pos.x-e.x)*l*.85,e.y+=(.85-e.y)*l*.65,e.z+=(a.pos.z-e.z)*l*.85}}function Ud({camera:i,domElement:t,sim:e,stepSceneFn:n,renderFrameFn:s}){i.position.set(24,14,25);let r=new yl(i,t);r.target.set(-1.2,1.8,-1),r.enableDamping=!0,r.dampingFactor=.06,r.minDistance=2.4,r.maxDistance=68,r.maxPolarAngle=Math.PI*.62,r.minPolarAngle=.08,r.update();let o=i.position.clone(),a=r.target.clone(),l=60,c=3600,h=0,f=1/60;return window.videoExport={runs:["tour"],async begin(u,d={}){if(u!=="tour")throw new Error(`Unsupported runId: ${u}`);let g=Number(d.fps)||60;return l=g,c=Math.max(1,Math.round(Wc*g)),e.exportMode||(o.copy(i.position),a.copy(r.target)),e.exportMode=!0,r.enabled=!1,h=0,Xc(e),Jc(0,e.cameraPos,e.cameraTarget),i.position.copy(e.cameraPos),i.lookAt(e.cameraTarget),r.target.copy(e.cameraTarget),Ji(e,0,0),n(0),s(),{frames:c}},async frame(u){if(!e.exportMode)return;let d=u/l;for((d<h-1e-6||u===0)&&(Xc(e),h=0);h+f*.5<d;){let g=Math.min(d,h+f),v=g-h;h=g,Jc(h,e.cameraPos,e.cameraTarget),Ji(e,h,v)}h=d,Jc(d,e.cameraPos,e.cameraTarget),i.position.copy(e.cameraPos),i.lookAt(e.cameraTarget),r.target.copy(e.cameraTarget),Ji(e,d,0),n(d),s(),await new Promise(g=>requestAnimationFrame(()=>g()))},end(){e.exportMode=!1,i.position.copy(o),r.target.copy(a),r.enabled=!0,r.update()}},{controls:r}}function c_(){let i=document.getElementById("scene-canvas"),t=new fl({canvas:i,antialias:!0,powerPreference:"high-performance",preserveDrawingBuffer:!0});t.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),t.setSize(window.innerWidth,window.innerHeight,!1),t.outputColorSpace=_n,t.toneMapping=$n,t.shadowMap.enabled=!0,t.shadowMap.type=fs,t.shadowMap.autoUpdate=!1;let e=new ss;t.setClearColor(14479605,1),e.fog=new Er(14676469,58,155);let n=new mn(40,window.innerWidth/Math.max(1,window.innerHeight),.25,380),s=new kr(15661564,4554640,1.32);s.layers.enableAll(),e.add(s);let r=new qr(14282740,.36);r.layers.enableAll(),e.add(r);let o=new Xr(16773588,1.35);o.position.set(28,34,20),o.castShadow=!0,o.shadow.mapSize.set(2048,2048),o.shadow.camera.left=-24,o.shadow.camera.right=24,o.shadow.camera.top=24,o.shadow.camera.bottom=-24,o.shadow.camera.near=4,o.shadow.camera.far=92,o.shadow.bias=-45e-5,o.shadow.normalBias=.022,o.layers.enableAll(),e.add(o),te.uSunDir.value.copy(o.position).normalize();let a=wd(e),l=bd(e),c=Rd(e),h=Ad(e),f=Cd(e),u=Pd(e,h.dripOrigins),d=Id(e,c.boats),g=new bt;t.getDrawingBufferSize(g);let v=new gn(Math.max(1,g.x),Math.max(1,g.y),{type:Wn,minFilter:nn,magFilter:nn}),m=rd(),p=od(v.texture);p.setResolution(g.x,g.y);let y=sd();function T(b){let N=te.uSunIntensity.value;o.intensity=1.35*N,s.intensity=1.12+.2*N,a.update(b,N),l.update(b),c.update(b),h.update(b,N),u.update(b),d.update(b,y)}let _=new fe;function A(){let b=window.innerWidth,N=Math.max(1,window.innerHeight);(i.width!==Math.round(b*t.getPixelRatio())||i.height!==Math.round(N*t.getPixelRatio()))&&(n.aspect=b/N,n.updateProjectionMatrix(),t.setSize(b,N,!1)),t.getDrawingBufferSize(g),(v.width!==g.x||v.height!==g.y)&&(v.setSize(Math.max(1,g.x),Math.max(1,g.y)),p.setResolution(g.x,g.y)),n.layers.set(0),t.shadowMap.needsUpdate=!0,f.renderReflection(t,e,n,w.target),t.getClearColor(_);let G=t.getClearAlpha();e.overrideMaterial=m,t.setRenderTarget(v),t.setClearColor(8421631,1e3),t.clear(),n.layers.set(0),t.render(e,n),e.overrideMaterial=null,t.setRenderTarget(null),t.setClearColor(_,G),t.autoClear=!0,n.layers.set(0),n.layers.enable(2),t.render(e,n),t.autoClear=!1,t.render(p.scene,p.camera),n.layers.set(1),t.render(e,n),t.autoClear=!0,n.layers.enableAll()}let{controls:w}=Ud({camera:n,domElement:t.domElement,sim:y,stepSceneFn:T,renderFrameFn:A});window.addEventListener("resize",()=>{let b=window.innerWidth,N=Math.max(1,window.innerHeight);n.aspect=b/N,n.updateProjectionMatrix(),t.setSize(b,N,!1),t.getDrawingBufferSize(g),v.setSize(Math.max(1,g.x),Math.max(1,g.y)),p.setResolution(g.x,g.y)}),Ji(y,0,0),T(0),A();let x=performance.now(),S=0;function I(b){requestAnimationFrame(I);let N=Math.min(.05,Math.max(0,(b-x)*.001));x=b,!y.exportMode&&(w.update(),y.cameraPos.copy(n.position),y.cameraTarget.copy(w.target),S+=N,Ji(y,S,N),T(S),A())}requestAnimationFrame(I)}c_();})();
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
