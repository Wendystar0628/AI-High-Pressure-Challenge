(()=>{var Dl="170";var Uu=0,yc=1,Nu=2;var Rh=1,Ul=2,Rn=3,Zn=0,Ie=1,Pn=2,Qe=0,Wi=1,wr=2,_c=3,vc=4,Fu=5,mi=100,Bu=101,Ou=102,ku=103,zu=104,Hu=200,Vu=201,Gu=202,Wu=203,ma=204,ga=205,Xu=206,qu=207,$u=208,Yu=209,Zu=210,Ju=211,Ku=212,Qu=213,ju=214,xa=0,ya=1,_a=2,Yi=3,va=4,ba=5,Ma=6,Sa=7,Ph=0,td=1,ed=2,Yn=0,Nl=1,Fl=2,Bl=3,zs=4,nd=5,Ol=6,kl=7;var Ih=300,Zi=301,Ji=302,wa=303,Ea=304,jr=306,Us=1e3,yi=1001,Ta=1002,Le=1003,id=1004;var $s=1005;var fn=1006,Do=1007;var _i=1008;var Dn=1009,Lh=1010,Dh=1011,Ns=1012,zl=1013,vi=1014,pn=1015,Ze=1016,Hl=1017,Vl=1018,Ki=1020,Uh=35902,Nh=1021,Fh=1022,an=1023,Bh=1024,Oh=1025,Xi=1026,Qi=1027,Gl=1028,Wl=1029,kh=1030,Xl=1031;var ql=1033,_r=33776,vr=33777,br=33778,Mr=33779,Aa=35840,Ca=35841,Ra=35842,Pa=35843,Ia=36196,La=37492,Da=37496,Ua=37808,Na=37809,Fa=37810,Ba=37811,Oa=37812,ka=37813,za=37814,Ha=37815,Va=37816,Ga=37817,Wa=37818,Xa=37819,qa=37820,$a=37821,Sr=36492,Ya=36494,Za=36495,zh=36283,Ja=36284,Ka=36285,Qa=36286;var Er=2300,ja=2301,Uo=2302,bc=2400,Mc=2401,Sc=2402;var sd=3200,$l=3201;var Hh=0,rd=1,$n="",Re="srgb",ls="srgb-linear",to="linear",re="srgb";var Ci=7680;var wc=519,od=512,ad=513,ld=514,Vh=515,cd=516,hd=517,ud=518,dd=519,Ec=35044;var Tc="300 es",In=2e3,Tr=2001,Jn=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;let n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;let s=this._listeners[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;let n=this._listeners[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,t);t.target=null}}},Ae=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var No=Math.PI/180,tl=180/Math.PI;function Hs(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ae[i&255]+Ae[i>>8&255]+Ae[i>>16&255]+Ae[i>>24&255]+"-"+Ae[t&255]+Ae[t>>8&255]+"-"+Ae[t>>16&15|64]+Ae[t>>24&255]+"-"+Ae[e&63|128]+Ae[e>>8&255]+"-"+Ae[e>>16&255]+Ae[e>>24&255]+Ae[n&255]+Ae[n>>8&255]+Ae[n>>16&255]+Ae[n>>24&255]).toLowerCase()}function Se(i,t,e){return Math.max(t,Math.min(e,i))}function fd(i,t){return(i%t+t)%t}function Fo(i,t,e){return(1-e)*i+e*t}function Ms(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function Oe(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}var Lt=class i{constructor(t=0,e=0){i.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Se(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*s+t.x,this.y=r*s+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Wt=class i{constructor(t,e,n,s,r,a,o,l,c){i.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c)}set(t,e,n,s,r,a,o,l,c){let h=this.elements;return h[0]=t,h[1]=s,h[2]=o,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],f=n[5],g=n[8],x=s[0],m=s[3],p=s[6],E=s[1],M=s[4],b=s[7],I=s[2],T=s[5],A=s[8];return r[0]=a*x+o*E+l*I,r[3]=a*m+o*M+l*T,r[6]=a*p+o*b+l*A,r[1]=c*x+h*E+u*I,r[4]=c*m+h*M+u*T,r[7]=c*p+h*b+u*A,r[2]=d*x+f*E+g*I,r[5]=d*m+f*M+g*T,r[8]=d*p+f*b+g*A,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return e*a*h-e*o*c-n*r*h+n*o*l+s*r*c-s*a*l}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=h*a-o*c,d=o*l-h*r,f=c*r-a*l,g=e*u+n*d+s*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let x=1/g;return t[0]=u*x,t[1]=(s*c-h*n)*x,t[2]=(o*n-s*a)*x,t[3]=d*x,t[4]=(h*e-s*l)*x,t[5]=(s*r-o*e)*x,t[6]=f*x,t[7]=(n*l-c*e)*x,t[8]=(a*e-n*r)*x,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,a,o){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+t,-s*c,s*l,-s*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(Bo.makeScale(t,e)),this}rotate(t){return this.premultiply(Bo.makeRotation(-t)),this}translate(t,e){return this.premultiply(Bo.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}},Bo=new Wt;function Gh(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function Ar(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function pd(){let i=Ar("canvas");return i.style.display="block",i}var Ac={};function Is(i){i in Ac||(Ac[i]=!0,console.warn(i))}function md(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}function gd(i){let t=i.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function xd(i){let t=i.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}var Jt={enabled:!0,workingColorSpace:ls,spaces:{},convert:function(i,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===re&&(i.r=Ln(i.r),i.g=Ln(i.g),i.b=Ln(i.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(i.applyMatrix3(this.spaces[t].toXYZ),i.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===re&&(i.r=qi(i.r),i.g=qi(i.g),i.b=qi(i.b))),i},fromWorkingColorSpace:function(i,t){return this.convert(i,this.workingColorSpace,t)},toWorkingColorSpace:function(i,t){return this.convert(i,t,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===$n?to:this.spaces[i].transfer},getLuminanceCoefficients:function(i,t=this.workingColorSpace){return i.fromArray(this.spaces[t].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,t,e){return i.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace}};function Ln(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function qi(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var Cc=[.64,.33,.3,.6,.15,.06],Rc=[.2126,.7152,.0722],Pc=[.3127,.329],Ic=new Wt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Lc=new Wt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Jt.define({[ls]:{primaries:Cc,whitePoint:Pc,transfer:to,toXYZ:Ic,fromXYZ:Lc,luminanceCoefficients:Rc,workingColorSpaceConfig:{unpackColorSpace:Re},outputColorSpaceConfig:{drawingBufferColorSpace:Re}},[Re]:{primaries:Cc,whitePoint:Pc,transfer:re,toXYZ:Ic,fromXYZ:Lc,luminanceCoefficients:Rc,outputColorSpaceConfig:{drawingBufferColorSpace:Re}}});var Ri,el=class{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{Ri===void 0&&(Ri=Ar("canvas")),Ri.width=t.width,Ri.height=t.height;let n=Ri.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=Ri}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=Ar("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=Ln(r[a]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Ln(e[n]/255)*255):e[n]=Ln(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},yd=0,Cr=class{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:yd++}),this.uuid=Hs(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(Oo(s[a].image)):r.push(Oo(s[a]))}else r=Oo(s);n.url=r}return e||(t.images[this.uuid]=n),n}};function Oo(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?el.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}var _d=0,ze=class i extends Jn{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,n=yi,s=yi,r=fn,a=_i,o=an,l=Dn,c=i.DEFAULT_ANISOTROPY,h=$n){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:_d++}),this.uuid=Hs(),this.name="",this.source=new Cr(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Lt(0,0),this.repeat=new Lt(1,1),this.center=new Lt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Wt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Ih)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Us:t.x=t.x-Math.floor(t.x);break;case yi:t.x=t.x<0?0:1;break;case Ta:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Us:t.y=t.y-Math.floor(t.y);break;case yi:t.y=t.y<0?0:1;break;case Ta:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};ze.DEFAULT_IMAGE=null;ze.DEFAULT_MAPPING=Ih;ze.DEFAULT_ANISOTROPY=1;var ce=class i{constructor(t=0,e=0,n=0,s=1){i.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*s+a[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r,l=t.elements,c=l[0],h=l[4],u=l[8],d=l[1],f=l[5],g=l[9],x=l[2],m=l[6],p=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-x)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+x)<.1&&Math.abs(g+m)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let M=(c+1)/2,b=(f+1)/2,I=(p+1)/2,T=(h+d)/4,A=(u+x)/4,N=(g+m)/4;return M>b&&M>I?M<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(M),s=T/n,r=A/n):b>I?b<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(b),n=T/s,r=N/s):I<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(I),n=A/r,s=N/r),this.set(n,s,r,e),this}let E=Math.sqrt((m-g)*(m-g)+(u-x)*(u-x)+(d-h)*(d-h));return Math.abs(E)<.001&&(E=1),this.x=(m-g)/E,this.y=(u-x)/E,this.z=(d-h)/E,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},nl=class extends Jn{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new ce(0,0,t,e),this.scissorTest=!1,this.viewport=new ce(0,0,t,e);let s={width:t,height:e,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:fn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);let r=new ze(s,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];let a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,s=t.textures.length;n<s;n++)this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;let e=Object.assign({},t.texture.image);return this.texture.source=new Cr(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}},Ee=class extends nl{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}},Rr=class extends ze{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Le,this.minFilter=Le,this.wrapR=yi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var il=class extends ze{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Le,this.minFilter=Le,this.wrapR=yi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Kn=class{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,a,o){let l=n[s+0],c=n[s+1],h=n[s+2],u=n[s+3],d=r[a+0],f=r[a+1],g=r[a+2],x=r[a+3];if(o===0){t[e+0]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u;return}if(o===1){t[e+0]=d,t[e+1]=f,t[e+2]=g,t[e+3]=x;return}if(u!==x||l!==d||c!==f||h!==g){let m=1-o,p=l*d+c*f+h*g+u*x,E=p>=0?1:-1,M=1-p*p;if(M>Number.EPSILON){let I=Math.sqrt(M),T=Math.atan2(I,p*E);m=Math.sin(m*T)/I,o=Math.sin(o*T)/I}let b=o*E;if(l=l*m+d*b,c=c*m+f*b,h=h*m+g*b,u=u*m+x*b,m===1-o){let I=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=I,c*=I,h*=I,u*=I}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,s,r,a){let o=n[s],l=n[s+1],c=n[s+2],h=n[s+3],u=r[a],d=r[a+1],f=r[a+2],g=r[a+3];return t[e]=o*g+h*u+l*f-c*d,t[e+1]=l*g+h*d+c*u-o*f,t[e+2]=c*g+h*f+o*d-l*u,t[e+3]=h*g-o*u-l*d-c*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,s=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(s/2),u=o(r/2),d=l(n/2),f=l(s/2),g=l(r/2);switch(a){case"XYZ":this._x=d*h*u+c*f*g,this._y=c*f*u-d*h*g,this._z=c*h*g+d*f*u,this._w=c*h*u-d*f*g;break;case"YXZ":this._x=d*h*u+c*f*g,this._y=c*f*u-d*h*g,this._z=c*h*g-d*f*u,this._w=c*h*u+d*f*g;break;case"ZXY":this._x=d*h*u-c*f*g,this._y=c*f*u+d*h*g,this._z=c*h*g+d*f*u,this._w=c*h*u-d*f*g;break;case"ZYX":this._x=d*h*u-c*f*g,this._y=c*f*u+d*h*g,this._z=c*h*g-d*f*u,this._w=c*h*u+d*f*g;break;case"YZX":this._x=d*h*u+c*f*g,this._y=c*f*u+d*h*g,this._z=c*h*g-d*f*u,this._w=c*h*u-d*f*g;break;case"XZY":this._x=d*h*u-c*f*g,this._y=c*f*u-d*h*g,this._z=c*h*g+d*f*u,this._w=c*h*u+d*f*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],s=e[4],r=e[8],a=e[1],o=e[5],l=e[9],c=e[2],h=e[6],u=e[10],d=n+o+u;if(d>0){let f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(h-l)*f,this._y=(r-c)*f,this._z=(a-s)*f}else if(n>o&&n>u){let f=2*Math.sqrt(1+n-o-u);this._w=(h-l)/f,this._x=.25*f,this._y=(s+a)/f,this._z=(r+c)/f}else if(o>u){let f=2*Math.sqrt(1+o-n-u);this._w=(r-c)/f,this._x=(s+a)/f,this._y=.25*f,this._z=(l+h)/f}else{let f=2*Math.sqrt(1+u-n-o);this._w=(a-s)/f,this._x=(r+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Se(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,s=t._y,r=t._z,a=t._w,o=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+a*o+s*c-r*l,this._y=s*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-s*o,this._w=a*h-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);let n=this._x,s=this._y,r=this._z,a=this._w,o=a*t._w+n*t._x+s*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=n,this._y=s,this._z=r,this;let l=1-o*o;if(l<=Number.EPSILON){let f=1-e;return this._w=f*a+e*this._w,this._x=f*n+e*this._x,this._y=f*s+e*this._y,this._z=f*r+e*this._z,this.normalize(),this}let c=Math.sqrt(l),h=Math.atan2(c,o),u=Math.sin((1-e)*h)/c,d=Math.sin(e*h)/c;return this._w=a*u+this._w*d,this._x=n*u+this._x*d,this._y=s*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},R=class i{constructor(t=0,e=0,n=0){i.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Dc.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Dc.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(t){let e=this.x,n=this.y,s=this.z,r=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*s-o*n),h=2*(o*e-r*s),u=2*(r*n-a*e);return this.x=e+l*c+a*u-o*h,this.y=n+l*h+o*c-r*u,this.z=s+l*u+r*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,s=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return ko.copy(this).projectOnVector(t),this.sub(ko)}reflect(t){return this.sub(ko.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Se(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},ko=new R,Dc=new Kn,ln=class{constructor(t=new R(1/0,1/0,1/0),e=new R(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(nn.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(nn.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=nn.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,nn):nn.fromBufferAttribute(r,a),nn.applyMatrix4(t.matrixWorld),this.expandByPoint(nn);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Ys.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Ys.copy(n.boundingBox)),Ys.applyMatrix4(t.matrixWorld),this.union(Ys)}let s=t.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,nn),nn.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Ss),Zs.subVectors(this.max,Ss),Pi.subVectors(t.a,Ss),Ii.subVectors(t.b,Ss),Li.subVectors(t.c,Ss),Hn.subVectors(Ii,Pi),Vn.subVectors(Li,Ii),li.subVectors(Pi,Li);let e=[0,-Hn.z,Hn.y,0,-Vn.z,Vn.y,0,-li.z,li.y,Hn.z,0,-Hn.x,Vn.z,0,-Vn.x,li.z,0,-li.x,-Hn.y,Hn.x,0,-Vn.y,Vn.x,0,-li.y,li.x,0];return!zo(e,Pi,Ii,Li,Zs)||(e=[1,0,0,0,1,0,0,0,1],!zo(e,Pi,Ii,Li,Zs))?!1:(Js.crossVectors(Hn,Vn),e=[Js.x,Js.y,Js.z],zo(e,Pi,Ii,Li,Zs))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,nn).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(nn).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(wn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),wn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),wn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),wn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),wn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),wn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),wn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),wn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(wn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}},wn=[new R,new R,new R,new R,new R,new R,new R,new R],nn=new R,Ys=new ln,Pi=new R,Ii=new R,Li=new R,Hn=new R,Vn=new R,li=new R,Ss=new R,Zs=new R,Js=new R,ci=new R;function zo(i,t,e,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){ci.fromArray(i,r);let o=s.x*Math.abs(ci.x)+s.y*Math.abs(ci.y)+s.z*Math.abs(ci.z),l=t.dot(ci),c=e.dot(ci),h=n.dot(ci);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var vd=new ln,ws=new R,Ho=new R,Qn=class{constructor(t=new R,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):vd.setFromPoints(t).getCenter(n);let s=0;for(let r=0,a=t.length;r<a;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;ws.subVectors(t,this.center);let e=ws.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(ws,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Ho.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(ws.copy(t.center).add(Ho)),this.expandByPoint(ws.copy(t.center).sub(Ho))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}},En=new R,Vo=new R,Ks=new R,Gn=new R,Go=new R,Qs=new R,Wo=new R,Fs=class{constructor(t=new R,e=new R(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,En)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=En.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(En.copy(this.origin).addScaledVector(this.direction,e),En.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){Vo.copy(t).add(e).multiplyScalar(.5),Ks.copy(e).sub(t).normalize(),Gn.copy(this.origin).sub(Vo);let r=t.distanceTo(e)*.5,a=-this.direction.dot(Ks),o=Gn.dot(this.direction),l=-Gn.dot(Ks),c=Gn.lengthSq(),h=Math.abs(1-a*a),u,d,f,g;if(h>0)if(u=a*l-o,d=a*o-l,g=r*h,u>=0)if(d>=-g)if(d<=g){let x=1/h;u*=x,d*=x,f=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;else d<=-g?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c):d<=g?(u=0,d=Math.min(Math.max(-r,-l),r),f=d*(d+2*l)+c):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(Vo).addScaledVector(Ks,d),f}intersectSphere(t,e){En.subVectors(t.center,this.origin);let n=En.dot(this.direction),s=En.dot(En)-n*n,r=t.radius*t.radius;if(s>r)return null;let a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,a,o,l,c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(t.min.x-d.x)*c,s=(t.max.x-d.x)*c):(n=(t.max.x-d.x)*c,s=(t.min.x-d.x)*c),h>=0?(r=(t.min.y-d.y)*h,a=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,a=(t.min.y-d.y)*h),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),u>=0?(o=(t.min.z-d.z)*u,l=(t.max.z-d.z)*u):(o=(t.max.z-d.z)*u,l=(t.min.z-d.z)*u),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,En)!==null}intersectTriangle(t,e,n,s,r){Go.subVectors(e,t),Qs.subVectors(n,t),Wo.crossVectors(Go,Qs);let a=this.direction.dot(Wo),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Gn.subVectors(this.origin,t);let l=o*this.direction.dot(Qs.crossVectors(Gn,Qs));if(l<0)return null;let c=o*this.direction.dot(Go.cross(Gn));if(c<0||l+c>a)return null;let h=-o*Gn.dot(Wo);return h<0?null:this.at(h/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},oe=class i{constructor(t,e,n,s,r,a,o,l,c,h,u,d,f,g,x,m){i.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c,h,u,d,f,g,x,m)}set(t,e,n,s,r,a,o,l,c,h,u,d,f,g,x,m){let p=this.elements;return p[0]=t,p[4]=e,p[8]=n,p[12]=s,p[1]=r,p[5]=a,p[9]=o,p[13]=l,p[2]=c,p[6]=h,p[10]=u,p[14]=d,p[3]=f,p[7]=g,p[11]=x,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new i().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){let e=this.elements,n=t.elements,s=1/Di.setFromMatrixColumn(t,0).length(),r=1/Di.setFromMatrixColumn(t,1).length(),a=1/Di.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,s=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){let d=a*h,f=a*u,g=o*h,x=o*u;e[0]=l*h,e[4]=-l*u,e[8]=c,e[1]=f+g*c,e[5]=d-x*c,e[9]=-o*l,e[2]=x-d*c,e[6]=g+f*c,e[10]=a*l}else if(t.order==="YXZ"){let d=l*h,f=l*u,g=c*h,x=c*u;e[0]=d+x*o,e[4]=g*o-f,e[8]=a*c,e[1]=a*u,e[5]=a*h,e[9]=-o,e[2]=f*o-g,e[6]=x+d*o,e[10]=a*l}else if(t.order==="ZXY"){let d=l*h,f=l*u,g=c*h,x=c*u;e[0]=d-x*o,e[4]=-a*u,e[8]=g+f*o,e[1]=f+g*o,e[5]=a*h,e[9]=x-d*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){let d=a*h,f=a*u,g=o*h,x=o*u;e[0]=l*h,e[4]=g*c-f,e[8]=d*c+x,e[1]=l*u,e[5]=x*c+d,e[9]=f*c-g,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){let d=a*l,f=a*c,g=o*l,x=o*c;e[0]=l*h,e[4]=x-d*u,e[8]=g*u+f,e[1]=u,e[5]=a*h,e[9]=-o*h,e[2]=-c*h,e[6]=f*u+g,e[10]=d-x*u}else if(t.order==="XZY"){let d=a*l,f=a*c,g=o*l,x=o*c;e[0]=l*h,e[4]=-u,e[8]=c*h,e[1]=d*u+x,e[5]=a*h,e[9]=f*u-g,e[2]=g*u-f,e[6]=o*h,e[10]=x*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(bd,t,Md)}lookAt(t,e,n){let s=this.elements;return Xe.subVectors(t,e),Xe.lengthSq()===0&&(Xe.z=1),Xe.normalize(),Wn.crossVectors(n,Xe),Wn.lengthSq()===0&&(Math.abs(n.z)===1?Xe.x+=1e-4:Xe.z+=1e-4,Xe.normalize(),Wn.crossVectors(n,Xe)),Wn.normalize(),js.crossVectors(Xe,Wn),s[0]=Wn.x,s[4]=js.x,s[8]=Xe.x,s[1]=Wn.y,s[5]=js.y,s[9]=Xe.y,s[2]=Wn.z,s[6]=js.z,s[10]=Xe.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],f=n[13],g=n[2],x=n[6],m=n[10],p=n[14],E=n[3],M=n[7],b=n[11],I=n[15],T=s[0],A=s[4],N=s[8],S=s[12],v=s[1],C=s[5],G=s[9],z=s[13],$=s[2],Q=s[6],W=s[10],it=s[14],B=s[3],j=s[7],nt=s[11],ht=s[15];return r[0]=a*T+o*v+l*$+c*B,r[4]=a*A+o*C+l*Q+c*j,r[8]=a*N+o*G+l*W+c*nt,r[12]=a*S+o*z+l*it+c*ht,r[1]=h*T+u*v+d*$+f*B,r[5]=h*A+u*C+d*Q+f*j,r[9]=h*N+u*G+d*W+f*nt,r[13]=h*S+u*z+d*it+f*ht,r[2]=g*T+x*v+m*$+p*B,r[6]=g*A+x*C+m*Q+p*j,r[10]=g*N+x*G+m*W+p*nt,r[14]=g*S+x*z+m*it+p*ht,r[3]=E*T+M*v+b*$+I*B,r[7]=E*A+M*C+b*Q+I*j,r[11]=E*N+M*G+b*W+I*nt,r[15]=E*S+M*z+b*it+I*ht,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],u=t[6],d=t[10],f=t[14],g=t[3],x=t[7],m=t[11],p=t[15];return g*(+r*l*u-s*c*u-r*o*d+n*c*d+s*o*f-n*l*f)+x*(+e*l*f-e*c*d+r*a*d-s*a*f+s*c*h-r*l*h)+m*(+e*c*u-e*o*f-r*a*u+n*a*f+r*o*h-n*c*h)+p*(-s*o*h-e*l*u+e*o*d+s*a*u-n*a*d+n*l*h)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=t[9],d=t[10],f=t[11],g=t[12],x=t[13],m=t[14],p=t[15],E=u*m*c-x*d*c+x*l*f-o*m*f-u*l*p+o*d*p,M=g*d*c-h*m*c-g*l*f+a*m*f+h*l*p-a*d*p,b=h*x*c-g*u*c+g*o*f-a*x*f-h*o*p+a*u*p,I=g*u*l-h*x*l-g*o*d+a*x*d+h*o*m-a*u*m,T=e*E+n*M+s*b+r*I;if(T===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let A=1/T;return t[0]=E*A,t[1]=(x*d*r-u*m*r-x*s*f+n*m*f+u*s*p-n*d*p)*A,t[2]=(o*m*r-x*l*r+x*s*c-n*m*c-o*s*p+n*l*p)*A,t[3]=(u*l*r-o*d*r-u*s*c+n*d*c+o*s*f-n*l*f)*A,t[4]=M*A,t[5]=(h*m*r-g*d*r+g*s*f-e*m*f-h*s*p+e*d*p)*A,t[6]=(g*l*r-a*m*r-g*s*c+e*m*c+a*s*p-e*l*p)*A,t[7]=(a*d*r-h*l*r+h*s*c-e*d*c-a*s*f+e*l*f)*A,t[8]=b*A,t[9]=(g*u*r-h*x*r-g*n*f+e*x*f+h*n*p-e*u*p)*A,t[10]=(a*x*r-g*o*r+g*n*c-e*x*c-a*n*p+e*o*p)*A,t[11]=(h*o*r-a*u*r-h*n*c+e*u*c+a*n*f-e*o*f)*A,t[12]=I*A,t[13]=(h*x*s-g*u*s+g*n*d-e*x*d-h*n*m+e*u*m)*A,t[14]=(g*o*s-a*x*s-g*n*l+e*x*l+a*n*m-e*o*m)*A,t[15]=(a*u*s-h*o*s+h*n*l-e*u*l-a*n*d+e*o*d)*A,this}scale(t){let e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),s=Math.sin(e),r=1-n,a=t.x,o=t.y,l=t.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+n,h*l-s*a,0,c*l-s*o,h*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,a){return this.set(1,n,r,0,t,1,a,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){let s=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,c=r+r,h=a+a,u=o+o,d=r*c,f=r*h,g=r*u,x=a*h,m=a*u,p=o*u,E=l*c,M=l*h,b=l*u,I=n.x,T=n.y,A=n.z;return s[0]=(1-(x+p))*I,s[1]=(f+b)*I,s[2]=(g-M)*I,s[3]=0,s[4]=(f-b)*T,s[5]=(1-(d+p))*T,s[6]=(m+E)*T,s[7]=0,s[8]=(g+M)*A,s[9]=(m-E)*A,s[10]=(1-(d+x))*A,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){let s=this.elements,r=Di.set(s[0],s[1],s[2]).length(),a=Di.set(s[4],s[5],s[6]).length(),o=Di.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),t.x=s[12],t.y=s[13],t.z=s[14],sn.copy(this);let c=1/r,h=1/a,u=1/o;return sn.elements[0]*=c,sn.elements[1]*=c,sn.elements[2]*=c,sn.elements[4]*=h,sn.elements[5]*=h,sn.elements[6]*=h,sn.elements[8]*=u,sn.elements[9]*=u,sn.elements[10]*=u,e.setFromRotationMatrix(sn),n.x=r,n.y=a,n.z=o,this}makePerspective(t,e,n,s,r,a,o=In){let l=this.elements,c=2*r/(e-t),h=2*r/(n-s),u=(e+t)/(e-t),d=(n+s)/(n-s),f,g;if(o===In)f=-(a+r)/(a-r),g=-2*a*r/(a-r);else if(o===Tr)f=-a/(a-r),g=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=f,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,s,r,a,o=In){let l=this.elements,c=1/(e-t),h=1/(n-s),u=1/(a-r),d=(e+t)*c,f=(n+s)*h,g,x;if(o===In)g=(a+r)*u,x=-2*u;else if(o===Tr)g=r*u,x=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-f,l[2]=0,l[6]=0,l[10]=x,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}},Di=new R,sn=new oe,bd=new R(0,0,0),Md=new R(1,1,1),Wn=new R,js=new R,Xe=new R,Uc=new oe,Nc=new Kn,mn=class i{constructor(t=0,e=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let s=t.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],h=s[9],u=s[2],d=s[6],f=s[10];switch(e){case"XYZ":this._y=Math.asin(Se(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Se(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(Se(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Se(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Se(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-Se(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return Uc.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Uc,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Nc.setFromEuler(this),this.setFromQuaternion(Nc,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};mn.DEFAULT_ORDER="XYZ";var Bs=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},Sd=0,Fc=new R,Ui=new Kn,Tn=new oe,tr=new R,Es=new R,wd=new R,Ed=new Kn,Bc=new R(1,0,0),Oc=new R(0,1,0),kc=new R(0,0,1),zc={type:"added"},Td={type:"removed"},Ni={type:"childadded",child:null},Xo={type:"childremoved",child:null},De=class i extends Jn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Sd++}),this.uuid=Hs(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new R,e=new mn,n=new Kn,s=new R(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new oe},normalMatrix:{value:new Wt}}),this.matrix=new oe,this.matrixWorld=new oe,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Bs,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Ui.setFromAxisAngle(t,e),this.quaternion.multiply(Ui),this}rotateOnWorldAxis(t,e){return Ui.setFromAxisAngle(t,e),this.quaternion.premultiply(Ui),this}rotateX(t){return this.rotateOnAxis(Bc,t)}rotateY(t){return this.rotateOnAxis(Oc,t)}rotateZ(t){return this.rotateOnAxis(kc,t)}translateOnAxis(t,e){return Fc.copy(t).applyQuaternion(this.quaternion),this.position.add(Fc.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Bc,t)}translateY(t){return this.translateOnAxis(Oc,t)}translateZ(t){return this.translateOnAxis(kc,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Tn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?tr.copy(t):tr.set(t,e,n);let s=this.parent;this.updateWorldMatrix(!0,!1),Es.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Tn.lookAt(Es,tr,this.up):Tn.lookAt(tr,Es,this.up),this.quaternion.setFromRotationMatrix(Tn),s&&(Tn.extractRotation(s.matrixWorld),Ui.setFromRotationMatrix(Tn),this.quaternion.premultiply(Ui.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(zc),Ni.child=t,this.dispatchEvent(Ni),Ni.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Td),Xo.child=t,this.dispatchEvent(Xo),Xo.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Tn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Tn.multiply(t.parent.matrixWorld)),t.applyMatrix4(Tn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(zc),Ni.child=t,this.dispatchEvent(Ni),Ni.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){let a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Es,t,wd),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Es,Ed,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){let n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.visibility=this._visibility,s.active=this._active,s.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.geometryCount=this._geometryCount,s.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere={center:s.boundingSphere.center.toArray(),radius:s.boundingSphere.radius}),this.boundingBox!==null&&(s.boundingBox={min:s.boundingBox.min.toArray(),max:s.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let u=l[c];r(t.shapes,u)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(t.materials,this.material[l]));s.material=o}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];s.animations.push(r(t.animations,l))}}if(e){let o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),u=a(t.shapes),d=a(t.skeletons),f=a(t.animations),g=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f),g.length>0&&(n.nodes=g)}return n.object=s,n;function a(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let s=t.children[n];this.add(s.clone())}return this}};De.DEFAULT_UP=new R(0,1,0);De.DEFAULT_MATRIX_AUTO_UPDATE=!0;De.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var rn=new R,An=new R,qo=new R,Cn=new R,Fi=new R,Bi=new R,Hc=new R,$o=new R,Yo=new R,Zo=new R,Jo=new ce,Ko=new ce,Qo=new ce,gi=class i{constructor(t=new R,e=new R,n=new R){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),rn.subVectors(t,e),s.cross(rn);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){rn.subVectors(s,e),An.subVectors(n,e),qo.subVectors(t,e);let a=rn.dot(rn),o=rn.dot(An),l=rn.dot(qo),c=An.dot(An),h=An.dot(qo),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;let d=1/u,f=(c*l-o*h)*d,g=(a*h-o*l)*d;return r.set(1-f-g,g,f)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,Cn)===null?!1:Cn.x>=0&&Cn.y>=0&&Cn.x+Cn.y<=1}static getInterpolation(t,e,n,s,r,a,o,l){return this.getBarycoord(t,e,n,s,Cn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Cn.x),l.addScaledVector(a,Cn.y),l.addScaledVector(o,Cn.z),l)}static getInterpolatedAttribute(t,e,n,s,r,a){return Jo.setScalar(0),Ko.setScalar(0),Qo.setScalar(0),Jo.fromBufferAttribute(t,e),Ko.fromBufferAttribute(t,n),Qo.fromBufferAttribute(t,s),a.setScalar(0),a.addScaledVector(Jo,r.x),a.addScaledVector(Ko,r.y),a.addScaledVector(Qo,r.z),a}static isFrontFacing(t,e,n,s){return rn.subVectors(n,e),An.subVectors(t,e),rn.cross(An).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return rn.subVectors(this.c,this.b),An.subVectors(this.a,this.b),rn.cross(An).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return i.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let n=this.a,s=this.b,r=this.c,a,o;Fi.subVectors(s,n),Bi.subVectors(r,n),$o.subVectors(t,n);let l=Fi.dot($o),c=Bi.dot($o);if(l<=0&&c<=0)return e.copy(n);Yo.subVectors(t,s);let h=Fi.dot(Yo),u=Bi.dot(Yo);if(h>=0&&u<=h)return e.copy(s);let d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),e.copy(n).addScaledVector(Fi,a);Zo.subVectors(t,r);let f=Fi.dot(Zo),g=Bi.dot(Zo);if(g>=0&&f<=g)return e.copy(r);let x=f*c-l*g;if(x<=0&&c>=0&&g<=0)return o=c/(c-g),e.copy(n).addScaledVector(Bi,o);let m=h*g-f*u;if(m<=0&&u-h>=0&&f-g>=0)return Hc.subVectors(r,s),o=(u-h)/(u-h+(f-g)),e.copy(s).addScaledVector(Hc,o);let p=1/(m+x+d);return a=x*p,o=d*p,e.copy(n).addScaledVector(Fi,a).addScaledVector(Bi,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},Wh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Xn={h:0,s:0,l:0},er={h:0,s:0,l:0};function jo(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var Dt=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Re){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Jt.toWorkingColorSpace(this,e),this}setRGB(t,e,n,s=Jt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Jt.toWorkingColorSpace(this,s),this}setHSL(t,e,n,s=Jt.workingColorSpace){if(t=fd(t,1),e=Se(e,0,1),n=Se(n,0,1),e===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=jo(a,r,t+1/3),this.g=jo(a,r,t),this.b=jo(a,r,t-1/3)}return Jt.toWorkingColorSpace(this,s),this}setStyle(t,e=Re){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Re){let n=Wh[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Ln(t.r),this.g=Ln(t.g),this.b=Ln(t.b),this}copyLinearToSRGB(t){return this.r=qi(t.r),this.g=qi(t.g),this.b=qi(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Re){return Jt.fromWorkingColorSpace(Ce.copy(this),t),Math.round(Se(Ce.r*255,0,255))*65536+Math.round(Se(Ce.g*255,0,255))*256+Math.round(Se(Ce.b*255,0,255))}getHexString(t=Re){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Jt.workingColorSpace){Jt.fromWorkingColorSpace(Ce.copy(this),e);let n=Ce.r,s=Ce.g,r=Ce.b,a=Math.max(n,s,r),o=Math.min(n,s,r),l,c,h=(o+a)/2;if(o===a)l=0,c=0;else{let u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case n:l=(s-r)/u+(s<r?6:0);break;case s:l=(r-n)/u+2;break;case r:l=(n-s)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=Jt.workingColorSpace){return Jt.fromWorkingColorSpace(Ce.copy(this),e),t.r=Ce.r,t.g=Ce.g,t.b=Ce.b,t}getStyle(t=Re){Jt.fromWorkingColorSpace(Ce.copy(this),t);let e=Ce.r,n=Ce.g,s=Ce.b;return t!==Re?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(Xn),this.setHSL(Xn.h+t,Xn.s+e,Xn.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Xn),t.getHSL(er);let n=Fo(Xn.h,er.h,e),s=Fo(Xn.s,er.s,e),r=Fo(Xn.l,er.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Ce=new Dt;Dt.NAMES=Wh;var Ad=0,jn=class extends Jn{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ad++}),this.uuid=Hs(),this.name="",this.blending=Wi,this.side=Zn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=ma,this.blendDst=ga,this.blendEquation=mi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Dt(0,0,0),this.blendAlpha=0,this.depthFunc=Yi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=wc,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ci,this.stencilZFail=Ci,this.stencilZPass=Ci,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Wi&&(n.blending=this.blending),this.side!==Zn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==ma&&(n.blendSrc=this.blendSrc),this.blendDst!==ga&&(n.blendDst=this.blendDst),this.blendEquation!==mi&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Yi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==wc&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Ci&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Ci&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Ci&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let a=[];for(let o in r){let l=r[o];delete l.metadata,a.push(l)}return a}if(e){let r=s(t.textures),a=s(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}},$e=class extends jn{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new Dt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new mn,this.combine=Ph,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}};var _e=new R,nr=new Lt,ke=class{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Ec,this.updateRanges=[],this.gpuType=pn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)nr.fromBufferAttribute(this,e),nr.applyMatrix3(t),this.setXY(e,nr.x,nr.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)_e.fromBufferAttribute(this,e),_e.applyMatrix3(t),this.setXYZ(e,_e.x,_e.y,_e.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)_e.fromBufferAttribute(this,e),_e.applyMatrix4(t),this.setXYZ(e,_e.x,_e.y,_e.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)_e.fromBufferAttribute(this,e),_e.applyNormalMatrix(t),this.setXYZ(e,_e.x,_e.y,_e.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)_e.fromBufferAttribute(this,e),_e.transformDirection(t),this.setXYZ(e,_e.x,_e.y,_e.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=Ms(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Oe(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Ms(e,this.array)),e}setX(t,e){return this.normalized&&(e=Oe(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Ms(e,this.array)),e}setY(t,e){return this.normalized&&(e=Oe(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Ms(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Oe(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Ms(e,this.array)),e}setW(t,e){return this.normalized&&(e=Oe(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Oe(e,this.array),n=Oe(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=Oe(e,this.array),n=Oe(n,this.array),s=Oe(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=Oe(e,this.array),n=Oe(n,this.array),s=Oe(s,this.array),r=Oe(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Ec&&(t.usage=this.usage),t}};var Pr=class extends ke{constructor(t,e,n){super(new Uint16Array(t),e,n)}};var Ir=class extends ke{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var xe=class extends ke{constructor(t,e,n){super(new Float32Array(t),e,n)}},Cd=0,Ke=new oe,ta=new De,Oi=new R,qe=new ln,Ts=new ln,Me=new R,Ye=class i extends Jn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Cd++}),this.uuid=Hs(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(Gh(t)?Ir:Pr)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new Wt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return Ke.makeRotationFromQuaternion(t),this.applyMatrix4(Ke),this}rotateX(t){return Ke.makeRotationX(t),this.applyMatrix4(Ke),this}rotateY(t){return Ke.makeRotationY(t),this.applyMatrix4(Ke),this}rotateZ(t){return Ke.makeRotationZ(t),this.applyMatrix4(Ke),this}translate(t,e,n){return Ke.makeTranslation(t,e,n),this.applyMatrix4(Ke),this}scale(t,e,n){return Ke.makeScale(t,e,n),this.applyMatrix4(Ke),this}lookAt(t){return ta.lookAt(t),ta.updateMatrix(),this.applyMatrix4(ta.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Oi).negate(),this.translate(Oi.x,Oi.y,Oi.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let s=0,r=t.length;s<r;s++){let a=t[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new xe(n,3))}else{for(let n=0,s=e.count;n<s;n++){let r=t[n];e.setXYZ(n,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ln);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new R(-1/0,-1/0,-1/0),new R(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){let r=e[n];qe.setFromBufferAttribute(r),this.morphTargetsRelative?(Me.addVectors(this.boundingBox.min,qe.min),this.boundingBox.expandByPoint(Me),Me.addVectors(this.boundingBox.max,qe.max),this.boundingBox.expandByPoint(Me)):(this.boundingBox.expandByPoint(qe.min),this.boundingBox.expandByPoint(qe.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Qn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new R,1/0);return}if(t){let n=this.boundingSphere.center;if(qe.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){let o=e[r];Ts.setFromBufferAttribute(o),this.morphTargetsRelative?(Me.addVectors(qe.min,Ts.min),qe.expandByPoint(Me),Me.addVectors(qe.max,Ts.max),qe.expandByPoint(Me)):(qe.expandByPoint(Ts.min),qe.expandByPoint(Ts.max))}qe.getCenter(n);let s=0;for(let r=0,a=t.count;r<a;r++)Me.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Me));if(e)for(let r=0,a=e.length;r<a;r++){let o=e[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Me.fromBufferAttribute(o,c),l&&(Oi.fromBufferAttribute(t,c),Me.add(Oi)),s=Math.max(s,n.distanceToSquared(Me))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,s=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new ke(new Float32Array(4*n.count),4));let a=this.getAttribute("tangent"),o=[],l=[];for(let N=0;N<n.count;N++)o[N]=new R,l[N]=new R;let c=new R,h=new R,u=new R,d=new Lt,f=new Lt,g=new Lt,x=new R,m=new R;function p(N,S,v){c.fromBufferAttribute(n,N),h.fromBufferAttribute(n,S),u.fromBufferAttribute(n,v),d.fromBufferAttribute(r,N),f.fromBufferAttribute(r,S),g.fromBufferAttribute(r,v),h.sub(c),u.sub(c),f.sub(d),g.sub(d);let C=1/(f.x*g.y-g.x*f.y);isFinite(C)&&(x.copy(h).multiplyScalar(g.y).addScaledVector(u,-f.y).multiplyScalar(C),m.copy(u).multiplyScalar(f.x).addScaledVector(h,-g.x).multiplyScalar(C),o[N].add(x),o[S].add(x),o[v].add(x),l[N].add(m),l[S].add(m),l[v].add(m))}let E=this.groups;E.length===0&&(E=[{start:0,count:t.count}]);for(let N=0,S=E.length;N<S;++N){let v=E[N],C=v.start,G=v.count;for(let z=C,$=C+G;z<$;z+=3)p(t.getX(z+0),t.getX(z+1),t.getX(z+2))}let M=new R,b=new R,I=new R,T=new R;function A(N){I.fromBufferAttribute(s,N),T.copy(I);let S=o[N];M.copy(S),M.sub(I.multiplyScalar(I.dot(S))).normalize(),b.crossVectors(T,S);let C=b.dot(l[N])<0?-1:1;a.setXYZW(N,M.x,M.y,M.z,C)}for(let N=0,S=E.length;N<S;++N){let v=E[N],C=v.start,G=v.count;for(let z=C,$=C+G;z<$;z+=3)A(t.getX(z+0)),A(t.getX(z+1)),A(t.getX(z+2))}}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new ke(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);let s=new R,r=new R,a=new R,o=new R,l=new R,c=new R,h=new R,u=new R;if(t)for(let d=0,f=t.count;d<f;d+=3){let g=t.getX(d+0),x=t.getX(d+1),m=t.getX(d+2);s.fromBufferAttribute(e,g),r.fromBufferAttribute(e,x),a.fromBufferAttribute(e,m),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,m),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,f=e.count;d<f;d+=3)s.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),a.fromBufferAttribute(e,d+2),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Me.fromBufferAttribute(t,e),Me.normalize(),t.setXYZ(e,Me.x,Me.y,Me.z)}toNonIndexed(){function t(o,l){let c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h),f=0,g=0;for(let x=0,m=l.length;x<m;x++){o.isInterleavedBufferAttribute?f=l[x]*o.data.stride+o.offset:f=l[x]*h;for(let p=0;p<h;p++)d[g++]=c[f++]}return new ke(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,n=this.index.array,s=this.attributes;for(let o in s){let l=s[o],c=t(l,n);e.setAttribute(o,c)}let r=this.morphAttributes;for(let o in r){let l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){let d=c[h],f=t(d,n);l.push(f)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){let t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let l in n){let c=n[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){let f=c[u];h.push(f.toJSON(t.data))}h.length>0&&(s[l]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone(e));let s=t.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(e))}let r=t.morphAttributes;for(let c in r){let h=[],u=r[c];for(let d=0,f=u.length;d<f;d++)h.push(u[d].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let a=t.groups;for(let c=0,h=a.length;c<h;c++){let u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}let o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}},Vc=new oe,hi=new Fs,ir=new Qn,Gc=new R,sr=new R,rr=new R,or=new R,ea=new R,ar=new R,Wc=new R,lr=new R,rt=class extends De{constructor(t=new Ye,e=new $e){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(s,t);let o=this.morphTargetInfluences;if(r&&o){ar.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=o[l],u=r[l];h!==0&&(ea.fromBufferAttribute(u,t),a?ar.addScaledVector(ea,h):ar.addScaledVector(ea.sub(e),h))}e.add(ar)}return e}raycast(t,e){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),ir.copy(n.boundingSphere),ir.applyMatrix4(r),hi.copy(t.ray).recast(t.near),!(ir.containsPoint(hi.origin)===!1&&(hi.intersectSphere(ir,Gc)===null||hi.origin.distanceToSquared(Gc)>(t.far-t.near)**2))&&(Vc.copy(r).invert(),hi.copy(t.ray).applyMatrix4(Vc),!(n.boundingBox!==null&&hi.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,hi)))}_computeIntersections(t,e,n){let s,r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,x=d.length;g<x;g++){let m=d[g],p=a[m.materialIndex],E=Math.max(m.start,f.start),M=Math.min(o.count,Math.min(m.start+m.count,f.start+f.count));for(let b=E,I=M;b<I;b+=3){let T=o.getX(b),A=o.getX(b+1),N=o.getX(b+2);s=cr(this,p,t,n,c,h,u,T,A,N),s&&(s.faceIndex=Math.floor(b/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let g=Math.max(0,f.start),x=Math.min(o.count,f.start+f.count);for(let m=g,p=x;m<p;m+=3){let E=o.getX(m),M=o.getX(m+1),b=o.getX(m+2);s=cr(this,a,t,n,c,h,u,E,M,b),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,x=d.length;g<x;g++){let m=d[g],p=a[m.materialIndex],E=Math.max(m.start,f.start),M=Math.min(l.count,Math.min(m.start+m.count,f.start+f.count));for(let b=E,I=M;b<I;b+=3){let T=b,A=b+1,N=b+2;s=cr(this,p,t,n,c,h,u,T,A,N),s&&(s.faceIndex=Math.floor(b/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let g=Math.max(0,f.start),x=Math.min(l.count,f.start+f.count);for(let m=g,p=x;m<p;m+=3){let E=m,M=m+1,b=m+2;s=cr(this,a,t,n,c,h,u,E,M,b),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}}};function Rd(i,t,e,n,s,r,a,o){let l;if(t.side===Ie?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,t.side===Zn,o),l===null)return null;lr.copy(o),lr.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(lr);return c<e.near||c>e.far?null:{distance:c,point:lr.clone(),object:i}}function cr(i,t,e,n,s,r,a,o,l,c){i.getVertexPosition(o,sr),i.getVertexPosition(l,rr),i.getVertexPosition(c,or);let h=Rd(i,t,e,n,sr,rr,or,Wc);if(h){let u=new R;gi.getBarycoord(Wc,sr,rr,or,u),s&&(h.uv=gi.getInterpolatedAttribute(s,o,l,c,u,new Lt)),r&&(h.uv1=gi.getInterpolatedAttribute(r,o,l,c,u,new Lt)),a&&(h.normal=gi.getInterpolatedAttribute(a,o,l,c,u,new R),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let d={a:o,b:l,c,normal:new R,materialIndex:0};gi.getNormal(sr,rr,or,d.normal),h.face=d,h.barycoord=u}return h}var Mt=class i extends Ye{constructor(t=1,e=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};let o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);let l=[],c=[],h=[],u=[],d=0,f=0;g("z","y","x",-1,-1,n,e,t,a,r,0),g("z","y","x",1,-1,n,e,-t,a,r,1),g("x","z","y",1,1,t,n,e,s,a,2),g("x","z","y",1,-1,t,n,-e,s,a,3),g("x","y","z",1,-1,t,e,n,s,r,4),g("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new xe(c,3)),this.setAttribute("normal",new xe(h,3)),this.setAttribute("uv",new xe(u,2));function g(x,m,p,E,M,b,I,T,A,N,S){let v=b/A,C=I/N,G=b/2,z=I/2,$=T/2,Q=A+1,W=N+1,it=0,B=0,j=new R;for(let nt=0;nt<W;nt++){let ht=nt*C-z;for(let It=0;It<Q;It++){let Yt=It*v-G;j[x]=Yt*E,j[m]=ht*M,j[p]=$,c.push(j.x,j.y,j.z),j[x]=0,j[m]=0,j[p]=T>0?1:-1,h.push(j.x,j.y,j.z),u.push(It/A),u.push(1-nt/N),it+=1}}for(let nt=0;nt<N;nt++)for(let ht=0;ht<A;ht++){let It=d+ht+Q*nt,Yt=d+ht+Q*(nt+1),Y=d+(ht+1)+Q*(nt+1),et=d+(ht+1)+Q*nt;l.push(It,Yt,et),l.push(Yt,Y,et),B+=6}o.addGroup(f,B,S),f+=B,d+=it}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};function ji(i){let t={};for(let e in i){t[e]={};for(let n in i[e]){let s=i[e][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone():Array.isArray(s)?t[e][n]=s.slice():t[e][n]=s}}return t}function Ne(i){let t={};for(let e=0;e<i.length;e++){let n=ji(i[e]);for(let s in n)t[s]=n[s]}return t}function Pd(i){let t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Xh(i){let t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Jt.workingColorSpace}var xn={clone:ji,merge:Ne},Id=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Ld=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,ye=class extends jn{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Id,this.fragmentShader=Ld,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=ji(t.uniforms),this.uniformsGroups=Pd(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let s in this.uniforms){let a=this.uniforms[s].value;a&&a.isTexture?e.uniforms[s]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[s]={type:"m4",value:a.toArray()}:e.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}},Lr=class extends De{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new oe,this.projectionMatrix=new oe,this.projectionMatrixInverse=new oe,this.coordinateSystem=In}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}},qn=new R,Xc=new Lt,qc=new Lt,Pe=class extends Lr{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=tl*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(No*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return tl*2*Math.atan(Math.tan(No*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){qn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(qn.x,qn.y).multiplyScalar(-t/qn.z),qn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(qn.x,qn.y).multiplyScalar(-t/qn.z)}getViewSize(t,e){return this.getViewBounds(t,Xc,qc),e.subVectors(qc,Xc)}setViewOffset(t,e,n,s,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(No*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,e-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}let o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}},ki=-90,zi=1,sl=class extends De{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new Pe(ki,zi,t,e);s.layers=this.layers,this.add(s);let r=new Pe(ki,zi,t,e);r.layers=this.layers,this.add(r);let a=new Pe(ki,zi,t,e);a.layers=this.layers,this.add(a);let o=new Pe(ki,zi,t,e);o.layers=this.layers,this.add(o);let l=new Pe(ki,zi,t,e);l.layers=this.layers,this.add(l);let c=new Pe(ki,zi,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[n,s,r,a,o,l]=e;for(let c of e)this.remove(c);if(t===In)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===Tr)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,a,o,l,c,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),f=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;let x=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,s),t.render(e,r),t.setRenderTarget(n,1,s),t.render(e,a),t.setRenderTarget(n,2,s),t.render(e,o),t.setRenderTarget(n,3,s),t.render(e,l),t.setRenderTarget(n,4,s),t.render(e,c),n.texture.generateMipmaps=x,t.setRenderTarget(n,5,s),t.render(e,h),t.setRenderTarget(u,d,f),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},Dr=class extends ze{constructor(t,e,n,s,r,a,o,l,c,h){t=t!==void 0?t:[],e=e!==void 0?e:Zi,super(t,e,n,s,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}},rl=class extends Ee{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new Dr(s,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:fn}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new Mt(5,5,5),r=new ye({name:"CubemapFromEquirect",uniforms:ji(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ie,blending:Qe});r.uniforms.tEquirect.value=e;let a=new rt(s,r),o=e.minFilter;return e.minFilter===_i&&(e.minFilter=fn),new sl(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e,n,s){let r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,s);t.setRenderTarget(r)}},na=new R,Dd=new R,Ud=new Wt,on=class{constructor(t=new R(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let s=na.subVectors(n,e).cross(Dd.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){let n=t.delta(na),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let r=-(t.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||Ud.getNormalMatrix(t),s=this.coplanarPoint(na).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},ui=new Qn,hr=new R,Os=class{constructor(t=new on,e=new on,n=new on,s=new on,r=new on,a=new on){this.planes=[t,e,n,s,r,a]}set(t,e,n,s,r,a){let o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(t){let e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=In){let n=this.planes,s=t.elements,r=s[0],a=s[1],o=s[2],l=s[3],c=s[4],h=s[5],u=s[6],d=s[7],f=s[8],g=s[9],x=s[10],m=s[11],p=s[12],E=s[13],M=s[14],b=s[15];if(n[0].setComponents(l-r,d-c,m-f,b-p).normalize(),n[1].setComponents(l+r,d+c,m+f,b+p).normalize(),n[2].setComponents(l+a,d+h,m+g,b+E).normalize(),n[3].setComponents(l-a,d-h,m-g,b-E).normalize(),n[4].setComponents(l-o,d-u,m-x,b-M).normalize(),e===In)n[5].setComponents(l+o,d+u,m+x,b+M).normalize();else if(e===Tr)n[5].setComponents(o,u,x,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),ui.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),ui.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(ui)}intersectsSprite(t){return ui.center.set(0,0,0),ui.radius=.7071067811865476,ui.applyMatrix4(t.matrixWorld),this.intersectsSphere(ui)}intersectsSphere(t){let e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){let e=this.planes;for(let n=0;n<6;n++){let s=e[n];if(hr.x=s.normal.x>0?t.max.x:t.min.x,hr.y=s.normal.y>0?t.max.y:t.min.y,hr.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(hr)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};function qh(){let i=null,t=!1,e=null,n=null;function s(r,a){e(r,a),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function Nd(i){let t=new WeakMap;function e(o,l){let c=o.array,h=o.usage,u=c.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,c,h),o.onUploadCallback();let f;if(c instanceof Float32Array)f=i.FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=i.SHORT;else if(c instanceof Uint32Array)f=i.UNSIGNED_INT;else if(c instanceof Int32Array)f=i.INT;else if(c instanceof Int8Array)f=i.BYTE;else if(c instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function n(o,l,c){let h=l.array,u=l.updateRanges;if(i.bindBuffer(c,o),u.length===0)i.bufferSubData(c,0,h);else{u.sort((f,g)=>f.start-g.start);let d=0;for(let f=1;f<u.length;f++){let g=u[d],x=u[f];x.start<=g.start+g.count+1?g.count=Math.max(g.count,x.start+x.count-g.start):(++d,u[d]=x)}u.length=d+1;for(let f=0,g=u.length;f<g;f++){let x=u[f];i.bufferSubData(c,x.start*h.BYTES_PER_ELEMENT,h,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=t.get(o);l&&(i.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=t.get(o);if(c===void 0)t.set(o,e(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var Ur=class i extends Ye{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};let r=t/2,a=e/2,o=Math.floor(n),l=Math.floor(s),c=o+1,h=l+1,u=t/o,d=e/l,f=[],g=[],x=[],m=[];for(let p=0;p<h;p++){let E=p*d-a;for(let M=0;M<c;M++){let b=M*u-r;g.push(b,-E,0),x.push(0,0,1),m.push(M/o),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let E=0;E<o;E++){let M=E+c*p,b=E+c*(p+1),I=E+1+c*(p+1),T=E+1+c*p;f.push(M,b,T),f.push(b,I,T)}this.setIndex(f),this.setAttribute("position",new xe(g,3)),this.setAttribute("normal",new xe(x,3)),this.setAttribute("uv",new xe(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.widthSegments,t.heightSegments)}},Fd=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Bd=`#ifdef USE_ALPHAHASH
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
#endif`,Od=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,kd=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,zd=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Hd=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Vd=`#ifdef USE_AOMAP
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
#endif`,Gd=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Wd=`#ifdef USE_BATCHING
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
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Xd=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,qd=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,$d=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Yd=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Zd=`#ifdef USE_IRIDESCENCE
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
#endif`,Jd=`#ifdef USE_BUMPMAP
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
#endif`,Kd=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Qd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,jd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,tf=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,ef=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,nf=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,sf=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,rf=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,of=`#define PI 3.141592653589793
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
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
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
} // validated`,af=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,lf=`vec3 transformedNormal = objectNormal;
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
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,cf=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,hf=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,uf=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,df=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,ff="gl_FragColor = linearToOutputTexel( gl_FragColor );",pf=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,mf=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,gf=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,xf=`#ifdef USE_ENVMAP
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
#endif`,yf=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,_f=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,vf=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,bf=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Mf=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Sf=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,wf=`#ifdef USE_GRADIENTMAP
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
}`,Ef=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Tf=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Af=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Cf=`uniform bool receiveShadow;
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
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
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
#endif`,Rf=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
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
#endif`,Pf=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,If=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Lf=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Df=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Uf=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
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
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
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
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
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
#endif`,Nf=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
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
		float v = 0.5 / ( gv + gl );
		return saturate(v);
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
	vec3 f0 = material.specularColor;
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
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
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
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
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
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
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
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Ff=`
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
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
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
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
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
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Bf=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
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
#endif`,Of=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,kf=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,zf=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Hf=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Vf=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Gf=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Wf=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Xf=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,qf=`#if defined( USE_POINTS_UV )
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
#endif`,$f=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Yf=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Zf=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Jf=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Kf=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Qf=`#ifdef USE_MORPHTARGETS
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
#endif`,jf=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,tp=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
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
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,ep=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,np=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,ip=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,sp=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,rp=`#ifdef USE_NORMALMAP
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
#endif`,op=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,ap=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,lp=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,cp=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,hp=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,up=`vec3 packNormalToRGB( const in vec3 normal ) {
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
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,dp=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,fp=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,pp=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,mp=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,gp=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,xp=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,yp=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
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
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
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
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
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
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,_p=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,vp=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
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
#endif`,bp=`float getShadowMask() {
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
	#if NUM_POINT_LIGHT_SHADOWS > 0
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
}`,Mp=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Sp=`#ifdef USE_SKINNING
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
#endif`,wp=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Ep=`#ifdef USE_SKINNING
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
#endif`,Tp=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Ap=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Cp=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Rp=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,Pp=`#ifdef USE_TRANSMISSION
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
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Ip=`#ifdef USE_TRANSMISSION
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
#endif`,Lp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Dp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Up=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Np=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,Fp=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Bp=`uniform sampler2D t2D;
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
}`,Op=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,kp=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,zp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Hp=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Vp=`#include <common>
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
}`,Gp=`#if DEPTH_PACKING == 3200
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
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Wp=`#define DISTANCE
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
}`,Xp=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,qp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,$p=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Yp=`uniform float scale;
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
}`,Zp=`uniform vec3 diffuse;
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
}`,Jp=`#include <common>
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
}`,Kp=`uniform vec3 diffuse;
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
}`,Qp=`#define LAMBERT
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
}`,jp=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
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
}`,tm=`#define MATCAP
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
}`,em=`#define MATCAP
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
}`,nm=`#define NORMAL
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
}`,im=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
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
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,sm=`#define PHONG
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
}`,rm=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
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
}`,om=`#define STANDARD
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
}`,am=`#define STANDARD
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
#include <packing>
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
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
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
}`,lm=`#define TOON
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
}`,cm=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
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
}`,hm=`uniform float size;
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
}`,um=`uniform vec3 diffuse;
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
}`,dm=`#include <common>
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
}`,fm=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
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
}`,pm=`uniform float rotation;
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
}`,mm=`uniform vec3 diffuse;
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
}`,$t={alphahash_fragment:Fd,alphahash_pars_fragment:Bd,alphamap_fragment:Od,alphamap_pars_fragment:kd,alphatest_fragment:zd,alphatest_pars_fragment:Hd,aomap_fragment:Vd,aomap_pars_fragment:Gd,batching_pars_vertex:Wd,batching_vertex:Xd,begin_vertex:qd,beginnormal_vertex:$d,bsdfs:Yd,iridescence_fragment:Zd,bumpmap_pars_fragment:Jd,clipping_planes_fragment:Kd,clipping_planes_pars_fragment:Qd,clipping_planes_pars_vertex:jd,clipping_planes_vertex:tf,color_fragment:ef,color_pars_fragment:nf,color_pars_vertex:sf,color_vertex:rf,common:of,cube_uv_reflection_fragment:af,defaultnormal_vertex:lf,displacementmap_pars_vertex:cf,displacementmap_vertex:hf,emissivemap_fragment:uf,emissivemap_pars_fragment:df,colorspace_fragment:ff,colorspace_pars_fragment:pf,envmap_fragment:mf,envmap_common_pars_fragment:gf,envmap_pars_fragment:xf,envmap_pars_vertex:yf,envmap_physical_pars_fragment:Rf,envmap_vertex:_f,fog_vertex:vf,fog_pars_vertex:bf,fog_fragment:Mf,fog_pars_fragment:Sf,gradientmap_pars_fragment:wf,lightmap_pars_fragment:Ef,lights_lambert_fragment:Tf,lights_lambert_pars_fragment:Af,lights_pars_begin:Cf,lights_toon_fragment:Pf,lights_toon_pars_fragment:If,lights_phong_fragment:Lf,lights_phong_pars_fragment:Df,lights_physical_fragment:Uf,lights_physical_pars_fragment:Nf,lights_fragment_begin:Ff,lights_fragment_maps:Bf,lights_fragment_end:Of,logdepthbuf_fragment:kf,logdepthbuf_pars_fragment:zf,logdepthbuf_pars_vertex:Hf,logdepthbuf_vertex:Vf,map_fragment:Gf,map_pars_fragment:Wf,map_particle_fragment:Xf,map_particle_pars_fragment:qf,metalnessmap_fragment:$f,metalnessmap_pars_fragment:Yf,morphinstance_vertex:Zf,morphcolor_vertex:Jf,morphnormal_vertex:Kf,morphtarget_pars_vertex:Qf,morphtarget_vertex:jf,normal_fragment_begin:tp,normal_fragment_maps:ep,normal_pars_fragment:np,normal_pars_vertex:ip,normal_vertex:sp,normalmap_pars_fragment:rp,clearcoat_normal_fragment_begin:op,clearcoat_normal_fragment_maps:ap,clearcoat_pars_fragment:lp,iridescence_pars_fragment:cp,opaque_fragment:hp,packing:up,premultiplied_alpha_fragment:dp,project_vertex:fp,dithering_fragment:pp,dithering_pars_fragment:mp,roughnessmap_fragment:gp,roughnessmap_pars_fragment:xp,shadowmap_pars_fragment:yp,shadowmap_pars_vertex:_p,shadowmap_vertex:vp,shadowmask_pars_fragment:bp,skinbase_vertex:Mp,skinning_pars_vertex:Sp,skinning_vertex:wp,skinnormal_vertex:Ep,specularmap_fragment:Tp,specularmap_pars_fragment:Ap,tonemapping_fragment:Cp,tonemapping_pars_fragment:Rp,transmission_fragment:Pp,transmission_pars_fragment:Ip,uv_pars_fragment:Lp,uv_pars_vertex:Dp,uv_vertex:Up,worldpos_vertex:Np,background_vert:Fp,background_frag:Bp,backgroundCube_vert:Op,backgroundCube_frag:kp,cube_vert:zp,cube_frag:Hp,depth_vert:Vp,depth_frag:Gp,distanceRGBA_vert:Wp,distanceRGBA_frag:Xp,equirect_vert:qp,equirect_frag:$p,linedashed_vert:Yp,linedashed_frag:Zp,meshbasic_vert:Jp,meshbasic_frag:Kp,meshlambert_vert:Qp,meshlambert_frag:jp,meshmatcap_vert:tm,meshmatcap_frag:em,meshnormal_vert:nm,meshnormal_frag:im,meshphong_vert:sm,meshphong_frag:rm,meshphysical_vert:om,meshphysical_frag:am,meshtoon_vert:lm,meshtoon_frag:cm,points_vert:hm,points_frag:um,shadow_vert:dm,shadow_frag:fm,sprite_vert:pm,sprite_frag:mm},ct={common:{diffuse:{value:new Dt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Wt},alphaMap:{value:null},alphaMapTransform:{value:new Wt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Wt}},envmap:{envMap:{value:null},envMapRotation:{value:new Wt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Wt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Wt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Wt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Wt},normalScale:{value:new Lt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Wt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Wt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Wt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Wt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Dt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Dt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Wt},alphaTest:{value:0},uvTransform:{value:new Wt}},sprite:{diffuse:{value:new Dt(16777215)},opacity:{value:1},center:{value:new Lt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Wt},alphaMap:{value:null},alphaMapTransform:{value:new Wt},alphaTest:{value:0}}},dn={basic:{uniforms:Ne([ct.common,ct.specularmap,ct.envmap,ct.aomap,ct.lightmap,ct.fog]),vertexShader:$t.meshbasic_vert,fragmentShader:$t.meshbasic_frag},lambert:{uniforms:Ne([ct.common,ct.specularmap,ct.envmap,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.fog,ct.lights,{emissive:{value:new Dt(0)}}]),vertexShader:$t.meshlambert_vert,fragmentShader:$t.meshlambert_frag},phong:{uniforms:Ne([ct.common,ct.specularmap,ct.envmap,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.fog,ct.lights,{emissive:{value:new Dt(0)},specular:{value:new Dt(1118481)},shininess:{value:30}}]),vertexShader:$t.meshphong_vert,fragmentShader:$t.meshphong_frag},standard:{uniforms:Ne([ct.common,ct.envmap,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.roughnessmap,ct.metalnessmap,ct.fog,ct.lights,{emissive:{value:new Dt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:$t.meshphysical_vert,fragmentShader:$t.meshphysical_frag},toon:{uniforms:Ne([ct.common,ct.aomap,ct.lightmap,ct.emissivemap,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.gradientmap,ct.fog,ct.lights,{emissive:{value:new Dt(0)}}]),vertexShader:$t.meshtoon_vert,fragmentShader:$t.meshtoon_frag},matcap:{uniforms:Ne([ct.common,ct.bumpmap,ct.normalmap,ct.displacementmap,ct.fog,{matcap:{value:null}}]),vertexShader:$t.meshmatcap_vert,fragmentShader:$t.meshmatcap_frag},points:{uniforms:Ne([ct.points,ct.fog]),vertexShader:$t.points_vert,fragmentShader:$t.points_frag},dashed:{uniforms:Ne([ct.common,ct.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:$t.linedashed_vert,fragmentShader:$t.linedashed_frag},depth:{uniforms:Ne([ct.common,ct.displacementmap]),vertexShader:$t.depth_vert,fragmentShader:$t.depth_frag},normal:{uniforms:Ne([ct.common,ct.bumpmap,ct.normalmap,ct.displacementmap,{opacity:{value:1}}]),vertexShader:$t.meshnormal_vert,fragmentShader:$t.meshnormal_frag},sprite:{uniforms:Ne([ct.sprite,ct.fog]),vertexShader:$t.sprite_vert,fragmentShader:$t.sprite_frag},background:{uniforms:{uvTransform:{value:new Wt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:$t.background_vert,fragmentShader:$t.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Wt}},vertexShader:$t.backgroundCube_vert,fragmentShader:$t.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:$t.cube_vert,fragmentShader:$t.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:$t.equirect_vert,fragmentShader:$t.equirect_frag},distanceRGBA:{uniforms:Ne([ct.common,ct.displacementmap,{referencePosition:{value:new R},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:$t.distanceRGBA_vert,fragmentShader:$t.distanceRGBA_frag},shadow:{uniforms:Ne([ct.lights,ct.fog,{color:{value:new Dt(0)},opacity:{value:1}}]),vertexShader:$t.shadow_vert,fragmentShader:$t.shadow_frag}};dn.physical={uniforms:Ne([dn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Wt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Wt},clearcoatNormalScale:{value:new Lt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Wt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Wt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Wt},sheen:{value:0},sheenColor:{value:new Dt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Wt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Wt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Wt},transmissionSamplerSize:{value:new Lt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Wt},attenuationDistance:{value:0},attenuationColor:{value:new Dt(0)},specularColor:{value:new Dt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Wt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Wt},anisotropyVector:{value:new Lt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Wt}}]),vertexShader:$t.meshphysical_vert,fragmentShader:$t.meshphysical_frag};var ur={r:0,b:0,g:0},di=new mn,gm=new oe;function xm(i,t,e,n,s,r,a){let o=new Dt(0),l=r===!0?0:1,c,h,u=null,d=0,f=null;function g(E){let M=E.isScene===!0?E.background:null;return M&&M.isTexture&&(M=(E.backgroundBlurriness>0?e:t).get(M)),M}function x(E){let M=!1,b=g(E);b===null?p(o,l):b&&b.isColor&&(p(b,1),M=!0);let I=i.xr.getEnvironmentBlendMode();I==="additive"?n.buffers.color.setClear(0,0,0,1,a):I==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(i.autoClear||M)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function m(E,M){let b=g(M);b&&(b.isCubeTexture||b.mapping===jr)?(h===void 0&&(h=new rt(new Mt(1,1,1),new ye({name:"BackgroundCubeMaterial",uniforms:ji(dn.backgroundCube.uniforms),vertexShader:dn.backgroundCube.vertexShader,fragmentShader:dn.backgroundCube.fragmentShader,side:Ie,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(I,T,A){this.matrixWorld.copyPosition(A.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(h)),di.copy(M.backgroundRotation),di.x*=-1,di.y*=-1,di.z*=-1,b.isCubeTexture&&b.isRenderTargetTexture===!1&&(di.y*=-1,di.z*=-1),h.material.uniforms.envMap.value=b,h.material.uniforms.flipEnvMap.value=b.isCubeTexture&&b.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=M.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(gm.makeRotationFromEuler(di)),h.material.toneMapped=Jt.getTransfer(b.colorSpace)!==re,(u!==b||d!==b.version||f!==i.toneMapping)&&(h.material.needsUpdate=!0,u=b,d=b.version,f=i.toneMapping),h.layers.enableAll(),E.unshift(h,h.geometry,h.material,0,0,null)):b&&b.isTexture&&(c===void 0&&(c=new rt(new Ur(2,2),new ye({name:"BackgroundMaterial",uniforms:ji(dn.background.uniforms),vertexShader:dn.background.vertexShader,fragmentShader:dn.background.fragmentShader,side:Zn,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=b,c.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,c.material.toneMapped=Jt.getTransfer(b.colorSpace)!==re,b.matrixAutoUpdate===!0&&b.updateMatrix(),c.material.uniforms.uvTransform.value.copy(b.matrix),(u!==b||d!==b.version||f!==i.toneMapping)&&(c.material.needsUpdate=!0,u=b,d=b.version,f=i.toneMapping),c.layers.enableAll(),E.unshift(c,c.geometry,c.material,0,0,null))}function p(E,M){E.getRGB(ur,Xh(i)),n.buffers.color.setClear(ur.r,ur.g,ur.b,M,a)}return{getClearColor:function(){return o},setClearColor:function(E,M=1){o.set(E),l=M,p(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(E){l=E,p(o,l)},render:x,addToRenderList:m}}function ym(i,t){let e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null),r=s,a=!1;function o(v,C,G,z,$){let Q=!1,W=u(z,G,C);r!==W&&(r=W,c(r.object)),Q=f(v,z,G,$),Q&&g(v,z,G,$),$!==null&&t.update($,i.ELEMENT_ARRAY_BUFFER),(Q||a)&&(a=!1,b(v,C,G,z),$!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get($).buffer))}function l(){return i.createVertexArray()}function c(v){return i.bindVertexArray(v)}function h(v){return i.deleteVertexArray(v)}function u(v,C,G){let z=G.wireframe===!0,$=n[v.id];$===void 0&&($={},n[v.id]=$);let Q=$[C.id];Q===void 0&&(Q={},$[C.id]=Q);let W=Q[z];return W===void 0&&(W=d(l()),Q[z]=W),W}function d(v){let C=[],G=[],z=[];for(let $=0;$<e;$++)C[$]=0,G[$]=0,z[$]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:C,enabledAttributes:G,attributeDivisors:z,object:v,attributes:{},index:null}}function f(v,C,G,z){let $=r.attributes,Q=C.attributes,W=0,it=G.getAttributes();for(let B in it)if(it[B].location>=0){let nt=$[B],ht=Q[B];if(ht===void 0&&(B==="instanceMatrix"&&v.instanceMatrix&&(ht=v.instanceMatrix),B==="instanceColor"&&v.instanceColor&&(ht=v.instanceColor)),nt===void 0||nt.attribute!==ht||ht&&nt.data!==ht.data)return!0;W++}return r.attributesNum!==W||r.index!==z}function g(v,C,G,z){let $={},Q=C.attributes,W=0,it=G.getAttributes();for(let B in it)if(it[B].location>=0){let nt=Q[B];nt===void 0&&(B==="instanceMatrix"&&v.instanceMatrix&&(nt=v.instanceMatrix),B==="instanceColor"&&v.instanceColor&&(nt=v.instanceColor));let ht={};ht.attribute=nt,nt&&nt.data&&(ht.data=nt.data),$[B]=ht,W++}r.attributes=$,r.attributesNum=W,r.index=z}function x(){let v=r.newAttributes;for(let C=0,G=v.length;C<G;C++)v[C]=0}function m(v){p(v,0)}function p(v,C){let G=r.newAttributes,z=r.enabledAttributes,$=r.attributeDivisors;G[v]=1,z[v]===0&&(i.enableVertexAttribArray(v),z[v]=1),$[v]!==C&&(i.vertexAttribDivisor(v,C),$[v]=C)}function E(){let v=r.newAttributes,C=r.enabledAttributes;for(let G=0,z=C.length;G<z;G++)C[G]!==v[G]&&(i.disableVertexAttribArray(G),C[G]=0)}function M(v,C,G,z,$,Q,W){W===!0?i.vertexAttribIPointer(v,C,G,$,Q):i.vertexAttribPointer(v,C,G,z,$,Q)}function b(v,C,G,z){x();let $=z.attributes,Q=G.getAttributes(),W=C.defaultAttributeValues;for(let it in Q){let B=Q[it];if(B.location>=0){let j=$[it];if(j===void 0&&(it==="instanceMatrix"&&v.instanceMatrix&&(j=v.instanceMatrix),it==="instanceColor"&&v.instanceColor&&(j=v.instanceColor)),j!==void 0){let nt=j.normalized,ht=j.itemSize,It=t.get(j);if(It===void 0)continue;let Yt=It.buffer,Y=It.type,et=It.bytesPerElement,xt=Y===i.INT||Y===i.UNSIGNED_INT||j.gpuType===zl;if(j.isInterleavedBufferAttribute){let lt=j.data,Ut=lt.stride,Ot=j.offset;if(lt.isInstancedInterleavedBuffer){for(let at=0;at<B.locationSize;at++)p(B.location+at,lt.meshPerAttribute);v.isInstancedMesh!==!0&&z._maxInstanceCount===void 0&&(z._maxInstanceCount=lt.meshPerAttribute*lt.count)}else for(let at=0;at<B.locationSize;at++)m(B.location+at);i.bindBuffer(i.ARRAY_BUFFER,Yt);for(let at=0;at<B.locationSize;at++)M(B.location+at,ht/B.locationSize,Y,nt,Ut*et,(Ot+ht/B.locationSize*at)*et,xt)}else{if(j.isInstancedBufferAttribute){for(let lt=0;lt<B.locationSize;lt++)p(B.location+lt,j.meshPerAttribute);v.isInstancedMesh!==!0&&z._maxInstanceCount===void 0&&(z._maxInstanceCount=j.meshPerAttribute*j.count)}else for(let lt=0;lt<B.locationSize;lt++)m(B.location+lt);i.bindBuffer(i.ARRAY_BUFFER,Yt);for(let lt=0;lt<B.locationSize;lt++)M(B.location+lt,ht/B.locationSize,Y,nt,ht*et,ht/B.locationSize*lt*et,xt)}}else if(W!==void 0){let nt=W[it];if(nt!==void 0)switch(nt.length){case 2:i.vertexAttrib2fv(B.location,nt);break;case 3:i.vertexAttrib3fv(B.location,nt);break;case 4:i.vertexAttrib4fv(B.location,nt);break;default:i.vertexAttrib1fv(B.location,nt)}}}}E()}function I(){N();for(let v in n){let C=n[v];for(let G in C){let z=C[G];for(let $ in z)h(z[$].object),delete z[$];delete C[G]}delete n[v]}}function T(v){if(n[v.id]===void 0)return;let C=n[v.id];for(let G in C){let z=C[G];for(let $ in z)h(z[$].object),delete z[$];delete C[G]}delete n[v.id]}function A(v){for(let C in n){let G=n[C];if(G[v.id]===void 0)continue;let z=G[v.id];for(let $ in z)h(z[$].object),delete z[$];delete G[v.id]}}function N(){S(),a=!0,r!==s&&(r=s,c(r.object))}function S(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:N,resetDefaultState:S,dispose:I,releaseStatesOfGeometry:T,releaseStatesOfProgram:A,initAttributes:x,enableAttribute:m,disableUnusedAttributes:E}}function _m(i,t,e){let n;function s(c){n=c}function r(c,h){i.drawArrays(n,c,h),e.update(h,n,1)}function a(c,h,u){u!==0&&(i.drawArraysInstanced(n,c,h,u),e.update(h,n,u))}function o(c,h,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,u);let f=0;for(let g=0;g<u;g++)f+=h[g];e.update(f,n,1)}function l(c,h,u,d){if(u===0)return;let f=t.get("WEBGL_multi_draw");if(f===null)for(let g=0;g<c.length;g++)a(c[g],h[g],d[g]);else{f.multiDrawArraysInstancedWEBGL(n,c,0,h,0,d,0,u);let g=0;for(let x=0;x<u;x++)g+=h[x]*d[x];e.update(g,n,1)}}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function vm(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let A=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(A.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(A){return!(A!==an&&n.convert(A)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(A){let N=A===Ze&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(A!==Dn&&n.convert(A)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&A!==pn&&!N)}function l(A){if(A==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";A="mediump"}return A==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp",h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let u=e.logarithmicDepthBuffer===!0,d=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),p=i.getParameter(i.MAX_VERTEX_ATTRIBS),E=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),M=i.getParameter(i.MAX_VARYING_VECTORS),b=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),I=g>0,T=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:u,reverseDepthBuffer:d,maxTextures:f,maxVertexTextures:g,maxTextureSize:x,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:E,maxVaryings:M,maxFragmentUniforms:b,vertexTextures:I,maxSamples:T}}function bm(i){let t=this,e=null,n=0,s=!1,r=!1,a=new on,o=new Wt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){let f=u.length!==0||d||n!==0||s;return s=d,n=u.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,f){let g=u.clippingPlanes,x=u.clipIntersection,m=u.clipShadows,p=i.get(u);if(!s||g===null||g.length===0||r&&!m)r?h(null):c();else{let E=r?0:n,M=E*4,b=p.clippingState||null;l.value=b,b=h(g,d,M,f);for(let I=0;I!==M;++I)b[I]=e[I];p.clippingState=b,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=E}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,d,f,g){let x=u!==null?u.length:0,m=null;if(x!==0){if(m=l.value,g!==!0||m===null){let p=f+x*4,E=d.matrixWorldInverse;o.getNormalMatrix(E),(m===null||m.length<p)&&(m=new Float32Array(p));for(let M=0,b=f;M!==x;++M,b+=4)a.copy(u[M]).applyMatrix4(E,o),a.normal.toArray(m,b),m[b+3]=a.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=x,t.numIntersection=0,m}}function Mm(i){let t=new WeakMap;function e(a,o){return o===wa?a.mapping=Zi:o===Ea&&(a.mapping=Ji),a}function n(a){if(a&&a.isTexture){let o=a.mapping;if(o===wa||o===Ea)if(t.has(a)){let l=t.get(a).texture;return e(l,a.mapping)}else{let l=a.image;if(l&&l.height>0){let c=new rl(l.height);return c.fromEquirectangularTexture(i,a),t.set(a,c),a.addEventListener("dispose",s),e(c.texture,a.mapping)}else return null}}return a}function s(a){let o=a.target;o.removeEventListener("dispose",s);let l=t.get(o);l!==void 0&&(t.delete(o),l.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}var ts=class extends Lr{constructor(t=-1,e=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-t,a=n+t,o=s+e,l=s-e;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},Gi=4,$c=[.125,.215,.35,.446,.526,.582],xi=20,ia=new ts,Yc=new Dt,sa=null,ra=0,oa=0,aa=!1,pi=(1+Math.sqrt(5))/2,Hi=1/pi,Zc=[new R(-pi,Hi,0),new R(pi,Hi,0),new R(-Hi,0,pi),new R(Hi,0,pi),new R(0,pi,-Hi),new R(0,pi,Hi),new R(-1,1,-1),new R(1,1,-1),new R(-1,1,1),new R(1,1,1)],es=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,s=100){sa=this._renderer.getRenderTarget(),ra=this._renderer.getActiveCubeFace(),oa=this._renderer.getActiveMipmapLevel(),aa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);let r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,s,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Qc(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Kc(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(sa,ra,oa),this._renderer.xr.enabled=aa,t.scissorTest=!1,dr(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Zi||t.mapping===Ji?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),sa=this._renderer.getRenderTarget(),ra=this._renderer.getActiveCubeFace(),oa=this._renderer.getActiveMipmapLevel(),aa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:fn,minFilter:fn,generateMipmaps:!1,type:Ze,format:an,colorSpace:ls,depthBuffer:!1},s=Jc(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Jc(t,e,n);let{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Sm(r)),this._blurMaterial=wm(r,t,e)}return s}_compileMaterial(t){let e=new rt(this._lodPlanes[0],t);this._renderer.compile(e,ia)}_sceneToCubeUV(t,e,n,s){let o=new Pe(90,1,e,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(Yc),h.toneMapping=Yn,h.autoClear=!1;let f=new $e({name:"PMREM.Background",side:Ie,depthWrite:!1,depthTest:!1}),g=new rt(new Mt,f),x=!1,m=t.background;m?m.isColor&&(f.color.copy(m),t.background=null,x=!0):(f.color.copy(Yc),x=!0);for(let p=0;p<6;p++){let E=p%3;E===0?(o.up.set(0,l[p],0),o.lookAt(c[p],0,0)):E===1?(o.up.set(0,0,l[p]),o.lookAt(0,c[p],0)):(o.up.set(0,l[p],0),o.lookAt(0,0,c[p]));let M=this._cubeSize;dr(s,E*M,p>2?M:0,M,M),h.setRenderTarget(s),x&&h.render(g,o),h.render(t,o)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=m}_textureToCubeUV(t,e){let n=this._renderer,s=t.mapping===Zi||t.mapping===Ji;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Qc()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Kc());let r=s?this._cubemapMaterial:this._equirectMaterial,a=new rt(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;let l=this._cubeSize;dr(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(a,ia)}_applyPMREM(t){let e=this._renderer,n=e.autoClear;e.autoClear=!1;let s=this._lodPlanes.length;for(let r=1;r<s;r++){let a=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),o=Zc[(s-r-1)%Zc.length];this._blur(t,r-1,r,a,o)}e.autoClear=n}_blur(t,e,n,s,r){let a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,s,"latitudinal",r),this._halfBlur(a,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,a,o){let l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");let h=3,u=new rt(this._lodPlanes[s],c),d=c.uniforms,f=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*xi-1),x=r/g,m=isFinite(r)?1+Math.floor(h*x):xi;m>xi&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${xi}`);let p=[],E=0;for(let A=0;A<xi;++A){let N=A/x,S=Math.exp(-N*N/2);p.push(S),A===0?E+=S:A<m&&(E+=2*S)}for(let A=0;A<p.length;A++)p[A]=p[A]/E;d.envMap.value=t.texture,d.samples.value=m,d.weights.value=p,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);let{_lodMax:M}=this;d.dTheta.value=g,d.mipInt.value=M-n;let b=this._sizeLods[s],I=3*b*(s>M-Gi?s-M+Gi:0),T=4*(this._cubeSize-b);dr(e,I,T,3*b,2*b),l.setRenderTarget(e),l.render(u,ia)}};function Sm(i){let t=[],e=[],n=[],s=i,r=i-Gi+1+$c.length;for(let a=0;a<r;a++){let o=Math.pow(2,s);e.push(o);let l=1/o;a>i-Gi?l=$c[a-i+Gi-1]:a===0&&(l=0),n.push(l);let c=1/(o-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],f=6,g=6,x=3,m=2,p=1,E=new Float32Array(x*g*f),M=new Float32Array(m*g*f),b=new Float32Array(p*g*f);for(let T=0;T<f;T++){let A=T%3*2/3-1,N=T>2?0:-1,S=[A,N,0,A+2/3,N,0,A+2/3,N+1,0,A,N,0,A+2/3,N+1,0,A,N+1,0];E.set(S,x*g*T),M.set(d,m*g*T);let v=[T,T,T,T,T,T];b.set(v,p*g*T)}let I=new Ye;I.setAttribute("position",new ke(E,x)),I.setAttribute("uv",new ke(M,m)),I.setAttribute("faceIndex",new ke(b,p)),t.push(I),s>Gi&&s--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function Jc(i,t,e){let n=new Ee(i,t,e);return n.texture.mapping=jr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function dr(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function wm(i,t,e){let n=new Float32Array(xi),s=new R(0,1,0);return new ye({name:"SphericalGaussianBlur",defines:{n:xi,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:Yl(),fragmentShader:`

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
		`,blending:Qe,depthTest:!1,depthWrite:!1})}function Kc(){return new ye({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Yl(),fragmentShader:`

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
		`,blending:Qe,depthTest:!1,depthWrite:!1})}function Qc(){return new ye({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Yl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Qe,depthTest:!1,depthWrite:!1})}function Yl(){return`

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
	`}function Em(i){let t=new WeakMap,e=null;function n(o){if(o&&o.isTexture){let l=o.mapping,c=l===wa||l===Ea,h=l===Zi||l===Ji;if(c||h){let u=t.get(o),d=u!==void 0?u.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==d)return e===null&&(e=new es(i)),u=c?e.fromEquirectangular(o,u):e.fromCubemap(o,u),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),u.texture;if(u!==void 0)return u.texture;{let f=o.image;return c&&f&&f.height>0||h&&f&&s(f)?(e===null&&(e=new es(i)),u=c?e.fromEquirectangular(o):e.fromCubemap(o),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),o.addEventListener("dispose",r),u.texture):null}}}return o}function s(o){let l=0,c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function r(o){let l=o.target;l.removeEventListener("dispose",r);let c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:a}}function Tm(i){let t={};function e(n){if(t[n]!==void 0)return t[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){let s=e(n);return s===null&&Is("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function Am(i,t,e,n){let s={},r=new WeakMap;function a(u){let d=u.target;d.index!==null&&t.remove(d.index);for(let g in d.attributes)t.remove(d.attributes[g]);for(let g in d.morphAttributes){let x=d.morphAttributes[g];for(let m=0,p=x.length;m<p;m++)t.remove(x[m])}d.removeEventListener("dispose",a),delete s[d.id];let f=r.get(d);f&&(t.remove(f),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function o(u,d){return s[d.id]===!0||(d.addEventListener("dispose",a),s[d.id]=!0,e.memory.geometries++),d}function l(u){let d=u.attributes;for(let g in d)t.update(d[g],i.ARRAY_BUFFER);let f=u.morphAttributes;for(let g in f){let x=f[g];for(let m=0,p=x.length;m<p;m++)t.update(x[m],i.ARRAY_BUFFER)}}function c(u){let d=[],f=u.index,g=u.attributes.position,x=0;if(f!==null){let E=f.array;x=f.version;for(let M=0,b=E.length;M<b;M+=3){let I=E[M+0],T=E[M+1],A=E[M+2];d.push(I,T,T,A,A,I)}}else if(g!==void 0){let E=g.array;x=g.version;for(let M=0,b=E.length/3-1;M<b;M+=3){let I=M+0,T=M+1,A=M+2;d.push(I,T,T,A,A,I)}}else return;let m=new(Gh(d)?Ir:Pr)(d,1);m.version=x;let p=r.get(u);p&&t.remove(p),r.set(u,m)}function h(u){let d=r.get(u);if(d){let f=u.index;f!==null&&d.version<f.version&&c(u)}else c(u);return r.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function Cm(i,t,e){let n;function s(d){n=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function l(d,f){i.drawElements(n,f,r,d*a),e.update(f,n,1)}function c(d,f,g){g!==0&&(i.drawElementsInstanced(n,f,r,d*a,g),e.update(f,n,g))}function h(d,f,g){if(g===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,f,0,r,d,0,g);let m=0;for(let p=0;p<g;p++)m+=f[p];e.update(m,n,1)}function u(d,f,g,x){if(g===0)return;let m=t.get("WEBGL_multi_draw");if(m===null)for(let p=0;p<d.length;p++)c(d[p]/a,f[p],x[p]);else{m.multiDrawElementsInstancedWEBGL(n,f,0,r,d,0,x,0,g);let p=0;for(let E=0;E<g;E++)p+=f[E]*x[E];e.update(p,n,1)}}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function Rm(i){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case i.TRIANGLES:e.triangles+=o*(r/3);break;case i.LINES:e.lines+=o*(r/2);break;case i.LINE_STRIP:e.lines+=o*(r-1);break;case i.LINE_LOOP:e.lines+=o*r;break;case i.POINTS:e.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function Pm(i,t,e){let n=new WeakMap,s=new ce;function r(a,o,l){let c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0,d=n.get(o);if(d===void 0||d.count!==u){let S=function(){A.dispose(),n.delete(o),o.removeEventListener("dispose",S)};d!==void 0&&d.texture.dispose();let f=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,x=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],p=o.morphAttributes.normal||[],E=o.morphAttributes.color||[],M=0;f===!0&&(M=1),g===!0&&(M=2),x===!0&&(M=3);let b=o.attributes.position.count*M,I=1;b>t.maxTextureSize&&(I=Math.ceil(b/t.maxTextureSize),b=t.maxTextureSize);let T=new Float32Array(b*I*4*u),A=new Rr(T,b,I,u);A.type=pn,A.needsUpdate=!0;let N=M*4;for(let v=0;v<u;v++){let C=m[v],G=p[v],z=E[v],$=b*I*4*v;for(let Q=0;Q<C.count;Q++){let W=Q*N;f===!0&&(s.fromBufferAttribute(C,Q),T[$+W+0]=s.x,T[$+W+1]=s.y,T[$+W+2]=s.z,T[$+W+3]=0),g===!0&&(s.fromBufferAttribute(G,Q),T[$+W+4]=s.x,T[$+W+5]=s.y,T[$+W+6]=s.z,T[$+W+7]=0),x===!0&&(s.fromBufferAttribute(z,Q),T[$+W+8]=s.x,T[$+W+9]=s.y,T[$+W+10]=s.z,T[$+W+11]=z.itemSize===4?s.w:1)}}d={count:u,texture:A,size:new Lt(b,I)},n.set(o,d),o.addEventListener("dispose",S)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,e);else{let f=0;for(let x=0;x<c.length;x++)f+=c[x];let g=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function Im(i,t,e,n){let s=new WeakMap;function r(l){let c=n.render.frame,h=l.geometry,u=t.get(l,h);if(s.get(u)!==c&&(t.update(u),s.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),s.get(l)!==c&&(e.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){let d=l.skeleton;s.get(d)!==c&&(d.update(),s.set(d,c))}return u}function a(){s=new WeakMap}function o(l){let c=l.target;c.removeEventListener("dispose",o),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:r,dispose:a}}var Nr=class extends ze{constructor(t,e,n,s,r,a,o,l,c,h=Xi){if(h!==Xi&&h!==Qi)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Xi&&(n=vi),n===void 0&&h===Qi&&(n=Ki),super(null,s,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=o!==void 0?o:Le,this.minFilter=l!==void 0?l:Le,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}},$h=new ze,jc=new Nr(1,1),Yh=new Rr,Zh=new il,Jh=new Dr,th=[],eh=[],nh=new Float32Array(16),ih=new Float32Array(9),sh=new Float32Array(4);function cs(i,t,e){let n=i[0];if(n<=0||n>0)return i;let s=t*e,r=th[s];if(r===void 0&&(r=new Float32Array(s),th[s]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,i[a].toArray(r,o)}return r}function ve(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function be(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function eo(i,t){let e=eh[t];e===void 0&&(e=new Int32Array(t),eh[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function Lm(i,t){let e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function Dm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ve(e,t))return;i.uniform2fv(this.addr,t),be(e,t)}}function Um(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(ve(e,t))return;i.uniform3fv(this.addr,t),be(e,t)}}function Nm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ve(e,t))return;i.uniform4fv(this.addr,t),be(e,t)}}function Fm(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(ve(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),be(e,t)}else{if(ve(e,n))return;sh.set(n),i.uniformMatrix2fv(this.addr,!1,sh),be(e,n)}}function Bm(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(ve(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),be(e,t)}else{if(ve(e,n))return;ih.set(n),i.uniformMatrix3fv(this.addr,!1,ih),be(e,n)}}function Om(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(ve(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),be(e,t)}else{if(ve(e,n))return;nh.set(n),i.uniformMatrix4fv(this.addr,!1,nh),be(e,n)}}function km(i,t){let e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function zm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ve(e,t))return;i.uniform2iv(this.addr,t),be(e,t)}}function Hm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(ve(e,t))return;i.uniform3iv(this.addr,t),be(e,t)}}function Vm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ve(e,t))return;i.uniform4iv(this.addr,t),be(e,t)}}function Gm(i,t){let e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function Wm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ve(e,t))return;i.uniform2uiv(this.addr,t),be(e,t)}}function Xm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(ve(e,t))return;i.uniform3uiv(this.addr,t),be(e,t)}}function qm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ve(e,t))return;i.uniform4uiv(this.addr,t),be(e,t)}}function $m(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(jc.compareFunction=Vh,r=jc):r=$h,e.setTexture2D(t||r,s)}function Ym(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||Zh,s)}function Zm(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||Jh,s)}function Jm(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||Yh,s)}function Km(i){switch(i){case 5126:return Lm;case 35664:return Dm;case 35665:return Um;case 35666:return Nm;case 35674:return Fm;case 35675:return Bm;case 35676:return Om;case 5124:case 35670:return km;case 35667:case 35671:return zm;case 35668:case 35672:return Hm;case 35669:case 35673:return Vm;case 5125:return Gm;case 36294:return Wm;case 36295:return Xm;case 36296:return qm;case 35678:case 36198:case 36298:case 36306:case 35682:return $m;case 35679:case 36299:case 36307:return Ym;case 35680:case 36300:case 36308:case 36293:return Zm;case 36289:case 36303:case 36311:case 36292:return Jm}}function Qm(i,t){i.uniform1fv(this.addr,t)}function jm(i,t){let e=cs(t,this.size,2);i.uniform2fv(this.addr,e)}function t0(i,t){let e=cs(t,this.size,3);i.uniform3fv(this.addr,e)}function e0(i,t){let e=cs(t,this.size,4);i.uniform4fv(this.addr,e)}function n0(i,t){let e=cs(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function i0(i,t){let e=cs(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function s0(i,t){let e=cs(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function r0(i,t){i.uniform1iv(this.addr,t)}function o0(i,t){i.uniform2iv(this.addr,t)}function a0(i,t){i.uniform3iv(this.addr,t)}function l0(i,t){i.uniform4iv(this.addr,t)}function c0(i,t){i.uniform1uiv(this.addr,t)}function h0(i,t){i.uniform2uiv(this.addr,t)}function u0(i,t){i.uniform3uiv(this.addr,t)}function d0(i,t){i.uniform4uiv(this.addr,t)}function f0(i,t,e){let n=this.cache,s=t.length,r=eo(e,s);ve(n,r)||(i.uniform1iv(this.addr,r),be(n,r));for(let a=0;a!==s;++a)e.setTexture2D(t[a]||$h,r[a])}function p0(i,t,e){let n=this.cache,s=t.length,r=eo(e,s);ve(n,r)||(i.uniform1iv(this.addr,r),be(n,r));for(let a=0;a!==s;++a)e.setTexture3D(t[a]||Zh,r[a])}function m0(i,t,e){let n=this.cache,s=t.length,r=eo(e,s);ve(n,r)||(i.uniform1iv(this.addr,r),be(n,r));for(let a=0;a!==s;++a)e.setTextureCube(t[a]||Jh,r[a])}function g0(i,t,e){let n=this.cache,s=t.length,r=eo(e,s);ve(n,r)||(i.uniform1iv(this.addr,r),be(n,r));for(let a=0;a!==s;++a)e.setTexture2DArray(t[a]||Yh,r[a])}function x0(i){switch(i){case 5126:return Qm;case 35664:return jm;case 35665:return t0;case 35666:return e0;case 35674:return n0;case 35675:return i0;case 35676:return s0;case 5124:case 35670:return r0;case 35667:case 35671:return o0;case 35668:case 35672:return a0;case 35669:case 35673:return l0;case 5125:return c0;case 36294:return h0;case 36295:return u0;case 36296:return d0;case 35678:case 36198:case 36298:case 36306:case 35682:return f0;case 35679:case 36299:case 36307:return p0;case 35680:case 36300:case 36308:case 36293:return m0;case 36289:case 36303:case 36311:case 36292:return g0}}var ol=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Km(e.type)}},al=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=x0(e.type)}},ll=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){let s=this.seq;for(let r=0,a=s.length;r!==a;++r){let o=s[r];o.setValue(t,e[o.id],n)}}},la=/(\w+)(\])?(\[|\.)?/g;function rh(i,t){i.seq.push(t),i.map[t.id]=t}function y0(i,t,e){let n=i.name,s=n.length;for(la.lastIndex=0;;){let r=la.exec(n),a=la.lastIndex,o=r[1],l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){rh(e,c===void 0?new ol(o,i,t):new al(o,i,t));break}else{let u=e.map[o];u===void 0&&(u=new ll(o),rh(e,u)),e=u}}}var $i=class{constructor(t,e){this.seq=[],this.map={};let n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){let r=t.getActiveUniform(e,s),a=t.getUniformLocation(e,r.name);y0(r,a,this)}}setValue(t,e,n,s){let r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){let s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,a=e.length;r!==a;++r){let o=e[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,s)}}static seqWithValue(t,e){let n=[];for(let s=0,r=t.length;s!==r;++s){let a=t[s];a.id in e&&n.push(a)}return n}};function oh(i,t,e){let n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}var _0=37297,v0=0;function b0(i,t){let e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=s;a<r;a++){let o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}var ah=new Wt;function M0(i){Jt._getMatrix(ah,Jt.workingColorSpace,i);let t=`mat3( ${ah.elements.map(e=>e.toFixed(4))} )`;switch(Jt.getTransfer(i)){case to:return[t,"LinearTransferOETF"];case re:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function lh(i,t,e){let n=i.getShaderParameter(t,i.COMPILE_STATUS),s=i.getShaderInfoLog(t).trim();if(n&&s==="")return"";let r=/ERROR: 0:(\d+)/.exec(s);if(r){let a=parseInt(r[1]);return e.toUpperCase()+`

`+s+`

`+b0(i.getShaderSource(t),a)}else return s}function S0(i,t){let e=M0(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function w0(i,t){let e;switch(t){case Nl:e="Linear";break;case Fl:e="Reinhard";break;case Bl:e="Cineon";break;case zs:e="ACESFilmic";break;case Ol:e="AgX";break;case kl:e="Neutral";break;case nd:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var fr=new R;function E0(){Jt.getLuminanceCoefficients(fr);let i=fr.x.toFixed(4),t=fr.y.toFixed(4),e=fr.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function T0(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Ls).join(`
`)}function A0(i){let t=[];for(let e in i){let n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function C0(i,t){let e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(t,s),a=r.name,o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:i.getAttribLocation(t,a),locationSize:o}}return e}function Ls(i){return i!==""}function ch(i,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function hh(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var R0=/^[ \t]*#include +<([\w\d./]+)>/gm;function cl(i){return i.replace(R0,I0)}var P0=new Map;function I0(i,t){let e=$t[t];if(e===void 0){let n=P0.get(t);if(n!==void 0)e=$t[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return cl(e)}var L0=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function uh(i){return i.replace(L0,D0)}function D0(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function dh(i){let t=`precision ${i.precision} float;
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
#define LOW_PRECISION`),t}function U0(i){let t="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===Rh?t="SHADOWMAP_TYPE_PCF":i.shadowMapType===Ul?t="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===Rn&&(t="SHADOWMAP_TYPE_VSM"),t}function N0(i){let t="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case Zi:case Ji:t="ENVMAP_TYPE_CUBE";break;case jr:t="ENVMAP_TYPE_CUBE_UV";break}return t}function F0(i){let t="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case Ji:t="ENVMAP_MODE_REFRACTION";break}return t}function B0(i){let t="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case Ph:t="ENVMAP_BLENDING_MULTIPLY";break;case td:t="ENVMAP_BLENDING_MIX";break;case ed:t="ENVMAP_BLENDING_ADD";break}return t}function O0(i){let t=i.envMapCubeUVHeight;if(t===null)return null;let e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),7*16)),texelHeight:n,maxMip:e}}function k0(i,t,e,n){let s=i.getContext(),r=e.defines,a=e.vertexShader,o=e.fragmentShader,l=U0(e),c=N0(e),h=F0(e),u=B0(e),d=O0(e),f=T0(e),g=A0(r),x=s.createProgram(),m,p,E=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Ls).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Ls).join(`
`),p.length>0&&(p+=`
`)):(m=[dh(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Ls).join(`
`),p=[dh(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==Yn?"#define TONE_MAPPING":"",e.toneMapping!==Yn?$t.tonemapping_pars_fragment:"",e.toneMapping!==Yn?w0("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",$t.colorspace_pars_fragment,S0("linearToOutputTexel",e.outputColorSpace),E0(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(Ls).join(`
`)),a=cl(a),a=ch(a,e),a=hh(a,e),o=cl(o),o=ch(o,e),o=hh(o,e),a=uh(a),o=uh(o),e.isRawShaderMaterial!==!0&&(E=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",e.glslVersion===Tc?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Tc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);let M=E+m+a,b=E+p+o,I=oh(s,s.VERTEX_SHADER,M),T=oh(s,s.FRAGMENT_SHADER,b);s.attachShader(x,I),s.attachShader(x,T),e.index0AttributeName!==void 0?s.bindAttribLocation(x,0,e.index0AttributeName):e.morphTargets===!0&&s.bindAttribLocation(x,0,"position"),s.linkProgram(x);function A(C){if(i.debug.checkShaderErrors){let G=s.getProgramInfoLog(x).trim(),z=s.getShaderInfoLog(I).trim(),$=s.getShaderInfoLog(T).trim(),Q=!0,W=!0;if(s.getProgramParameter(x,s.LINK_STATUS)===!1)if(Q=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,x,I,T);else{let it=lh(s,I,"vertex"),B=lh(s,T,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(x,s.VALIDATE_STATUS)+`

Material Name: `+C.name+`
Material Type: `+C.type+`

Program Info Log: `+G+`
`+it+`
`+B)}else G!==""?console.warn("THREE.WebGLProgram: Program Info Log:",G):(z===""||$==="")&&(W=!1);W&&(C.diagnostics={runnable:Q,programLog:G,vertexShader:{log:z,prefix:m},fragmentShader:{log:$,prefix:p}})}s.deleteShader(I),s.deleteShader(T),N=new $i(s,x),S=C0(s,x)}let N;this.getUniforms=function(){return N===void 0&&A(this),N};let S;this.getAttributes=function(){return S===void 0&&A(this),S};let v=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return v===!1&&(v=s.getProgramParameter(x,_0)),v},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(x),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=v0++,this.cacheKey=t,this.usedTimes=1,this.program=x,this.vertexShader=I,this.fragmentShader=T,this}var z0=0,hl=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){let e=t.vertexShader,n=t.fragmentShader,s=this._getShaderStage(e),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(t);return a.has(s)===!1&&(a.add(s),s.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){let e=this.shaderCache,n=e.get(t);return n===void 0&&(n=new ul(t),e.set(t,n)),n}},ul=class{constructor(t){this.id=z0++,this.code=t,this.usedTimes=0}};function H0(i,t,e,n,s,r,a){let o=new Bs,l=new hl,c=new Set,h=[],u=s.logarithmicDepthBuffer,d=s.vertexTextures,f=s.precision,g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function x(S){return c.add(S),S===0?"uv":`uv${S}`}function m(S,v,C,G,z){let $=G.fog,Q=z.geometry,W=S.isMeshStandardMaterial?G.environment:null,it=(S.isMeshStandardMaterial?e:t).get(S.envMap||W),B=it&&it.mapping===jr?it.image.height:null,j=g[S.type];S.precision!==null&&(f=s.getMaxPrecision(S.precision),f!==S.precision&&console.warn("THREE.WebGLProgram.getParameters:",S.precision,"not supported, using",f,"instead."));let nt=Q.morphAttributes.position||Q.morphAttributes.normal||Q.morphAttributes.color,ht=nt!==void 0?nt.length:0,It=0;Q.morphAttributes.position!==void 0&&(It=1),Q.morphAttributes.normal!==void 0&&(It=2),Q.morphAttributes.color!==void 0&&(It=3);let Yt,Y,et,xt;if(j){let le=dn[j];Yt=le.vertexShader,Y=le.fragmentShader}else Yt=S.vertexShader,Y=S.fragmentShader,l.update(S),et=l.getVertexShaderID(S),xt=l.getFragmentShaderID(S);let lt=i.getRenderTarget(),Ut=i.state.buffers.depth.getReversed(),Ot=z.isInstancedMesh===!0,at=z.isBatchedMesh===!0,Rt=!!S.map,Ft=!!S.matcap,Qt=!!it,P=!!S.aoMap,he=!!S.lightMap,Ht=!!S.bumpMap,Xt=!!S.normalMap,Pt=!!S.displacementMap,Zt=!!S.emissiveMap,Tt=!!S.metalnessMap,w=!!S.roughnessMap,y=S.anisotropy>0,F=S.clearcoat>0,X=S.dispersion>0,J=S.iridescence>0,Z=S.sheen>0,At=S.transmission>0,dt=y&&!!S.anisotropyMap,_t=F&&!!S.clearcoatMap,jt=F&&!!S.clearcoatNormalMap,st=F&&!!S.clearcoatRoughnessMap,vt=J&&!!S.iridescenceMap,Bt=J&&!!S.iridescenceThicknessMap,kt=Z&&!!S.sheenColorMap,bt=Z&&!!S.sheenRoughnessMap,Kt=!!S.specularMap,qt=!!S.specularColorMap,ue=!!S.specularIntensityMap,L=At&&!!S.transmissionMap,ut=At&&!!S.thicknessMap,q=!!S.gradientMap,K=!!S.alphaMap,gt=S.alphaTest>0,ft=!!S.alphaHash,Vt=!!S.extensions,ge=Yn;S.toneMapped&&(lt===null||lt.isXRRenderTarget===!0)&&(ge=i.toneMapping);let Te={shaderID:j,shaderType:S.type,shaderName:S.name,vertexShader:Yt,fragmentShader:Y,defines:S.defines,customVertexShaderID:et,customFragmentShaderID:xt,isRawShaderMaterial:S.isRawShaderMaterial===!0,glslVersion:S.glslVersion,precision:f,batching:at,batchingColor:at&&z._colorsTexture!==null,instancing:Ot,instancingColor:Ot&&z.instanceColor!==null,instancingMorph:Ot&&z.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:lt===null?i.outputColorSpace:lt.isXRRenderTarget===!0?lt.texture.colorSpace:ls,alphaToCoverage:!!S.alphaToCoverage,map:Rt,matcap:Ft,envMap:Qt,envMapMode:Qt&&it.mapping,envMapCubeUVHeight:B,aoMap:P,lightMap:he,bumpMap:Ht,normalMap:Xt,displacementMap:d&&Pt,emissiveMap:Zt,normalMapObjectSpace:Xt&&S.normalMapType===rd,normalMapTangentSpace:Xt&&S.normalMapType===Hh,metalnessMap:Tt,roughnessMap:w,anisotropy:y,anisotropyMap:dt,clearcoat:F,clearcoatMap:_t,clearcoatNormalMap:jt,clearcoatRoughnessMap:st,dispersion:X,iridescence:J,iridescenceMap:vt,iridescenceThicknessMap:Bt,sheen:Z,sheenColorMap:kt,sheenRoughnessMap:bt,specularMap:Kt,specularColorMap:qt,specularIntensityMap:ue,transmission:At,transmissionMap:L,thicknessMap:ut,gradientMap:q,opaque:S.transparent===!1&&S.blending===Wi&&S.alphaToCoverage===!1,alphaMap:K,alphaTest:gt,alphaHash:ft,combine:S.combine,mapUv:Rt&&x(S.map.channel),aoMapUv:P&&x(S.aoMap.channel),lightMapUv:he&&x(S.lightMap.channel),bumpMapUv:Ht&&x(S.bumpMap.channel),normalMapUv:Xt&&x(S.normalMap.channel),displacementMapUv:Pt&&x(S.displacementMap.channel),emissiveMapUv:Zt&&x(S.emissiveMap.channel),metalnessMapUv:Tt&&x(S.metalnessMap.channel),roughnessMapUv:w&&x(S.roughnessMap.channel),anisotropyMapUv:dt&&x(S.anisotropyMap.channel),clearcoatMapUv:_t&&x(S.clearcoatMap.channel),clearcoatNormalMapUv:jt&&x(S.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:st&&x(S.clearcoatRoughnessMap.channel),iridescenceMapUv:vt&&x(S.iridescenceMap.channel),iridescenceThicknessMapUv:Bt&&x(S.iridescenceThicknessMap.channel),sheenColorMapUv:kt&&x(S.sheenColorMap.channel),sheenRoughnessMapUv:bt&&x(S.sheenRoughnessMap.channel),specularMapUv:Kt&&x(S.specularMap.channel),specularColorMapUv:qt&&x(S.specularColorMap.channel),specularIntensityMapUv:ue&&x(S.specularIntensityMap.channel),transmissionMapUv:L&&x(S.transmissionMap.channel),thicknessMapUv:ut&&x(S.thicknessMap.channel),alphaMapUv:K&&x(S.alphaMap.channel),vertexTangents:!!Q.attributes.tangent&&(Xt||y),vertexColors:S.vertexColors,vertexAlphas:S.vertexColors===!0&&!!Q.attributes.color&&Q.attributes.color.itemSize===4,pointsUvs:z.isPoints===!0&&!!Q.attributes.uv&&(Rt||K),fog:!!$,useFog:S.fog===!0,fogExp2:!!$&&$.isFogExp2,flatShading:S.flatShading===!0,sizeAttenuation:S.sizeAttenuation===!0,logarithmicDepthBuffer:u,reverseDepthBuffer:Ut,skinning:z.isSkinnedMesh===!0,morphTargets:Q.morphAttributes.position!==void 0,morphNormals:Q.morphAttributes.normal!==void 0,morphColors:Q.morphAttributes.color!==void 0,morphTargetsCount:ht,morphTextureStride:It,numDirLights:v.directional.length,numPointLights:v.point.length,numSpotLights:v.spot.length,numSpotLightMaps:v.spotLightMap.length,numRectAreaLights:v.rectArea.length,numHemiLights:v.hemi.length,numDirLightShadows:v.directionalShadowMap.length,numPointLightShadows:v.pointShadowMap.length,numSpotLightShadows:v.spotShadowMap.length,numSpotLightShadowsWithMaps:v.numSpotLightShadowsWithMaps,numLightProbes:v.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:S.dithering,shadowMapEnabled:i.shadowMap.enabled&&C.length>0,shadowMapType:i.shadowMap.type,toneMapping:ge,decodeVideoTexture:Rt&&S.map.isVideoTexture===!0&&Jt.getTransfer(S.map.colorSpace)===re,decodeVideoTextureEmissive:Zt&&S.emissiveMap.isVideoTexture===!0&&Jt.getTransfer(S.emissiveMap.colorSpace)===re,premultipliedAlpha:S.premultipliedAlpha,doubleSided:S.side===Pn,flipSided:S.side===Ie,useDepthPacking:S.depthPacking>=0,depthPacking:S.depthPacking||0,index0AttributeName:S.index0AttributeName,extensionClipCullDistance:Vt&&S.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Vt&&S.extensions.multiDraw===!0||at)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:S.customProgramCacheKey()};return Te.vertexUv1s=c.has(1),Te.vertexUv2s=c.has(2),Te.vertexUv3s=c.has(3),c.clear(),Te}function p(S){let v=[];if(S.shaderID?v.push(S.shaderID):(v.push(S.customVertexShaderID),v.push(S.customFragmentShaderID)),S.defines!==void 0)for(let C in S.defines)v.push(C),v.push(S.defines[C]);return S.isRawShaderMaterial===!1&&(E(v,S),M(v,S),v.push(i.outputColorSpace)),v.push(S.customProgramCacheKey),v.join()}function E(S,v){S.push(v.precision),S.push(v.outputColorSpace),S.push(v.envMapMode),S.push(v.envMapCubeUVHeight),S.push(v.mapUv),S.push(v.alphaMapUv),S.push(v.lightMapUv),S.push(v.aoMapUv),S.push(v.bumpMapUv),S.push(v.normalMapUv),S.push(v.displacementMapUv),S.push(v.emissiveMapUv),S.push(v.metalnessMapUv),S.push(v.roughnessMapUv),S.push(v.anisotropyMapUv),S.push(v.clearcoatMapUv),S.push(v.clearcoatNormalMapUv),S.push(v.clearcoatRoughnessMapUv),S.push(v.iridescenceMapUv),S.push(v.iridescenceThicknessMapUv),S.push(v.sheenColorMapUv),S.push(v.sheenRoughnessMapUv),S.push(v.specularMapUv),S.push(v.specularColorMapUv),S.push(v.specularIntensityMapUv),S.push(v.transmissionMapUv),S.push(v.thicknessMapUv),S.push(v.combine),S.push(v.fogExp2),S.push(v.sizeAttenuation),S.push(v.morphTargetsCount),S.push(v.morphAttributeCount),S.push(v.numDirLights),S.push(v.numPointLights),S.push(v.numSpotLights),S.push(v.numSpotLightMaps),S.push(v.numHemiLights),S.push(v.numRectAreaLights),S.push(v.numDirLightShadows),S.push(v.numPointLightShadows),S.push(v.numSpotLightShadows),S.push(v.numSpotLightShadowsWithMaps),S.push(v.numLightProbes),S.push(v.shadowMapType),S.push(v.toneMapping),S.push(v.numClippingPlanes),S.push(v.numClipIntersection),S.push(v.depthPacking)}function M(S,v){o.disableAll(),v.supportsVertexTextures&&o.enable(0),v.instancing&&o.enable(1),v.instancingColor&&o.enable(2),v.instancingMorph&&o.enable(3),v.matcap&&o.enable(4),v.envMap&&o.enable(5),v.normalMapObjectSpace&&o.enable(6),v.normalMapTangentSpace&&o.enable(7),v.clearcoat&&o.enable(8),v.iridescence&&o.enable(9),v.alphaTest&&o.enable(10),v.vertexColors&&o.enable(11),v.vertexAlphas&&o.enable(12),v.vertexUv1s&&o.enable(13),v.vertexUv2s&&o.enable(14),v.vertexUv3s&&o.enable(15),v.vertexTangents&&o.enable(16),v.anisotropy&&o.enable(17),v.alphaHash&&o.enable(18),v.batching&&o.enable(19),v.dispersion&&o.enable(20),v.batchingColor&&o.enable(21),S.push(o.mask),o.disableAll(),v.fog&&o.enable(0),v.useFog&&o.enable(1),v.flatShading&&o.enable(2),v.logarithmicDepthBuffer&&o.enable(3),v.reverseDepthBuffer&&o.enable(4),v.skinning&&o.enable(5),v.morphTargets&&o.enable(6),v.morphNormals&&o.enable(7),v.morphColors&&o.enable(8),v.premultipliedAlpha&&o.enable(9),v.shadowMapEnabled&&o.enable(10),v.doubleSided&&o.enable(11),v.flipSided&&o.enable(12),v.useDepthPacking&&o.enable(13),v.dithering&&o.enable(14),v.transmission&&o.enable(15),v.sheen&&o.enable(16),v.opaque&&o.enable(17),v.pointsUvs&&o.enable(18),v.decodeVideoTexture&&o.enable(19),v.decodeVideoTextureEmissive&&o.enable(20),v.alphaToCoverage&&o.enable(21),S.push(o.mask)}function b(S){let v=g[S.type],C;if(v){let G=dn[v];C=xn.clone(G.uniforms)}else C=S.uniforms;return C}function I(S,v){let C;for(let G=0,z=h.length;G<z;G++){let $=h[G];if($.cacheKey===v){C=$,++C.usedTimes;break}}return C===void 0&&(C=new k0(i,v,S,r),h.push(C)),C}function T(S){if(--S.usedTimes===0){let v=h.indexOf(S);h[v]=h[h.length-1],h.pop(),S.destroy()}}function A(S){l.remove(S)}function N(){l.dispose()}return{getParameters:m,getProgramCacheKey:p,getUniforms:b,acquireProgram:I,releaseProgram:T,releaseShaderCache:A,programs:h,dispose:N}}function V0(){let i=new WeakMap;function t(a){return i.has(a)}function e(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function G0(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.z!==t.z?i.z-t.z:i.id-t.id}function fh(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function ph(){let i=[],t=0,e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function a(u,d,f,g,x,m){let p=i[t];return p===void 0?(p={id:u.id,object:u,geometry:d,material:f,groupOrder:g,renderOrder:u.renderOrder,z:x,group:m},i[t]=p):(p.id=u.id,p.object=u,p.geometry=d,p.material=f,p.groupOrder=g,p.renderOrder=u.renderOrder,p.z=x,p.group=m),t++,p}function o(u,d,f,g,x,m){let p=a(u,d,f,g,x,m);f.transmission>0?n.push(p):f.transparent===!0?s.push(p):e.push(p)}function l(u,d,f,g,x,m){let p=a(u,d,f,g,x,m);f.transmission>0?n.unshift(p):f.transparent===!0?s.unshift(p):e.unshift(p)}function c(u,d){e.length>1&&e.sort(u||G0),n.length>1&&n.sort(d||fh),s.length>1&&s.sort(d||fh)}function h(){for(let u=t,d=i.length;u<d;u++){let f=i[u];if(f.id===null)break;f.id=null,f.object=null,f.geometry=null,f.material=null,f.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:o,unshift:l,finish:h,sort:c}}function W0(){let i=new WeakMap;function t(n,s){let r=i.get(n),a;return r===void 0?(a=new ph,i.set(n,[a])):s>=r.length?(a=new ph,r.push(a)):a=r[s],a}function e(){i=new WeakMap}return{get:t,dispose:e}}function X0(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new R,color:new Dt};break;case"SpotLight":e={position:new R,direction:new R,color:new Dt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new R,color:new Dt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new R,skyColor:new Dt,groundColor:new Dt};break;case"RectAreaLight":e={color:new Dt,position:new R,halfWidth:new R,halfHeight:new R};break}return i[t.id]=e,e}}}function q0(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Lt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Lt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Lt,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}var $0=0;function Y0(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function Z0(i){let t=new X0,e=q0(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new R);let s=new R,r=new oe,a=new oe;function o(c){let h=0,u=0,d=0;for(let S=0;S<9;S++)n.probe[S].set(0,0,0);let f=0,g=0,x=0,m=0,p=0,E=0,M=0,b=0,I=0,T=0,A=0;c.sort(Y0);for(let S=0,v=c.length;S<v;S++){let C=c[S],G=C.color,z=C.intensity,$=C.distance,Q=C.shadow&&C.shadow.map?C.shadow.map.texture:null;if(C.isAmbientLight)h+=G.r*z,u+=G.g*z,d+=G.b*z;else if(C.isLightProbe){for(let W=0;W<9;W++)n.probe[W].addScaledVector(C.sh.coefficients[W],z);A++}else if(C.isDirectionalLight){let W=t.get(C);if(W.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){let it=C.shadow,B=e.get(C);B.shadowIntensity=it.intensity,B.shadowBias=it.bias,B.shadowNormalBias=it.normalBias,B.shadowRadius=it.radius,B.shadowMapSize=it.mapSize,n.directionalShadow[f]=B,n.directionalShadowMap[f]=Q,n.directionalShadowMatrix[f]=C.shadow.matrix,E++}n.directional[f]=W,f++}else if(C.isSpotLight){let W=t.get(C);W.position.setFromMatrixPosition(C.matrixWorld),W.color.copy(G).multiplyScalar(z),W.distance=$,W.coneCos=Math.cos(C.angle),W.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),W.decay=C.decay,n.spot[x]=W;let it=C.shadow;if(C.map&&(n.spotLightMap[I]=C.map,I++,it.updateMatrices(C),C.castShadow&&T++),n.spotLightMatrix[x]=it.matrix,C.castShadow){let B=e.get(C);B.shadowIntensity=it.intensity,B.shadowBias=it.bias,B.shadowNormalBias=it.normalBias,B.shadowRadius=it.radius,B.shadowMapSize=it.mapSize,n.spotShadow[x]=B,n.spotShadowMap[x]=Q,b++}x++}else if(C.isRectAreaLight){let W=t.get(C);W.color.copy(G).multiplyScalar(z),W.halfWidth.set(C.width*.5,0,0),W.halfHeight.set(0,C.height*.5,0),n.rectArea[m]=W,m++}else if(C.isPointLight){let W=t.get(C);if(W.color.copy(C.color).multiplyScalar(C.intensity),W.distance=C.distance,W.decay=C.decay,C.castShadow){let it=C.shadow,B=e.get(C);B.shadowIntensity=it.intensity,B.shadowBias=it.bias,B.shadowNormalBias=it.normalBias,B.shadowRadius=it.radius,B.shadowMapSize=it.mapSize,B.shadowCameraNear=it.camera.near,B.shadowCameraFar=it.camera.far,n.pointShadow[g]=B,n.pointShadowMap[g]=Q,n.pointShadowMatrix[g]=C.shadow.matrix,M++}n.point[g]=W,g++}else if(C.isHemisphereLight){let W=t.get(C);W.skyColor.copy(C.color).multiplyScalar(z),W.groundColor.copy(C.groundColor).multiplyScalar(z),n.hemi[p]=W,p++}}m>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ct.LTC_FLOAT_1,n.rectAreaLTC2=ct.LTC_FLOAT_2):(n.rectAreaLTC1=ct.LTC_HALF_1,n.rectAreaLTC2=ct.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;let N=n.hash;(N.directionalLength!==f||N.pointLength!==g||N.spotLength!==x||N.rectAreaLength!==m||N.hemiLength!==p||N.numDirectionalShadows!==E||N.numPointShadows!==M||N.numSpotShadows!==b||N.numSpotMaps!==I||N.numLightProbes!==A)&&(n.directional.length=f,n.spot.length=x,n.rectArea.length=m,n.point.length=g,n.hemi.length=p,n.directionalShadow.length=E,n.directionalShadowMap.length=E,n.pointShadow.length=M,n.pointShadowMap.length=M,n.spotShadow.length=b,n.spotShadowMap.length=b,n.directionalShadowMatrix.length=E,n.pointShadowMatrix.length=M,n.spotLightMatrix.length=b+I-T,n.spotLightMap.length=I,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=A,N.directionalLength=f,N.pointLength=g,N.spotLength=x,N.rectAreaLength=m,N.hemiLength=p,N.numDirectionalShadows=E,N.numPointShadows=M,N.numSpotShadows=b,N.numSpotMaps=I,N.numLightProbes=A,n.version=$0++)}function l(c,h){let u=0,d=0,f=0,g=0,x=0,m=h.matrixWorldInverse;for(let p=0,E=c.length;p<E;p++){let M=c[p];if(M.isDirectionalLight){let b=n.directional[u];b.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),b.direction.sub(s),b.direction.transformDirection(m),u++}else if(M.isSpotLight){let b=n.spot[f];b.position.setFromMatrixPosition(M.matrixWorld),b.position.applyMatrix4(m),b.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),b.direction.sub(s),b.direction.transformDirection(m),f++}else if(M.isRectAreaLight){let b=n.rectArea[g];b.position.setFromMatrixPosition(M.matrixWorld),b.position.applyMatrix4(m),a.identity(),r.copy(M.matrixWorld),r.premultiply(m),a.extractRotation(r),b.halfWidth.set(M.width*.5,0,0),b.halfHeight.set(0,M.height*.5,0),b.halfWidth.applyMatrix4(a),b.halfHeight.applyMatrix4(a),g++}else if(M.isPointLight){let b=n.point[d];b.position.setFromMatrixPosition(M.matrixWorld),b.position.applyMatrix4(m),d++}else if(M.isHemisphereLight){let b=n.hemi[x];b.direction.setFromMatrixPosition(M.matrixWorld),b.direction.transformDirection(m),x++}}}return{setup:o,setupView:l,state:n}}function mh(i){let t=new Z0(i),e=[],n=[];function s(h){c.camera=h,e.length=0,n.length=0}function r(h){e.push(h)}function a(h){n.push(h)}function o(){t.setup(e)}function l(h){t.setupView(e,h)}let c={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:o,setupLightsView:l,pushLight:r,pushShadow:a}}function J0(i){let t=new WeakMap;function e(s,r=0){let a=t.get(s),o;return a===void 0?(o=new mh(i),t.set(s,[o])):r>=a.length?(o=new mh(i),a.push(o)):o=a[r],o}function n(){t=new WeakMap}return{get:e,dispose:n}}var ks=class extends jn{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=sd,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},dl=class extends jn{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}},K0=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Q0=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function j0(i,t,e){let n=new Os,s=new Lt,r=new Lt,a=new ce,o=new ks({depthPacking:$l}),l=new dl,c={},h=e.maxTextureSize,u={[Zn]:Ie,[Ie]:Zn,[Pn]:Pn},d=new ye({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Lt},radius:{value:4}},vertexShader:K0,fragmentShader:Q0}),f=d.clone();f.defines.HORIZONTAL_PASS=1;let g=new Ye;g.setAttribute("position",new ke(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new rt(g,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Rh;let p=this.type;this.render=function(T,A,N){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||T.length===0)return;let S=i.getRenderTarget(),v=i.getActiveCubeFace(),C=i.getActiveMipmapLevel(),G=i.state;G.setBlending(Qe),G.buffers.color.setClear(1,1,1,1),G.buffers.depth.setTest(!0),G.setScissorTest(!1);let z=p!==Rn&&this.type===Rn,$=p===Rn&&this.type!==Rn;for(let Q=0,W=T.length;Q<W;Q++){let it=T[Q],B=it.shadow;if(B===void 0){console.warn("THREE.WebGLShadowMap:",it,"has no shadow.");continue}if(B.autoUpdate===!1&&B.needsUpdate===!1)continue;s.copy(B.mapSize);let j=B.getFrameExtents();if(s.multiply(j),r.copy(B.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/j.x),s.x=r.x*j.x,B.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/j.y),s.y=r.y*j.y,B.mapSize.y=r.y)),B.map===null||z===!0||$===!0){let ht=this.type!==Rn?{minFilter:Le,magFilter:Le}:{};B.map!==null&&B.map.dispose(),B.map=new Ee(s.x,s.y,ht),B.map.texture.name=it.name+".shadowMap",B.camera.updateProjectionMatrix()}i.setRenderTarget(B.map),i.clear();let nt=B.getViewportCount();for(let ht=0;ht<nt;ht++){let It=B.getViewport(ht);a.set(r.x*It.x,r.y*It.y,r.x*It.z,r.y*It.w),G.viewport(a),B.updateMatrices(it,ht),n=B.getFrustum(),b(A,N,B.camera,it,this.type)}B.isPointLightShadow!==!0&&this.type===Rn&&E(B,N),B.needsUpdate=!1}p=this.type,m.needsUpdate=!1,i.setRenderTarget(S,v,C)};function E(T,A){let N=t.update(x);d.defines.VSM_SAMPLES!==T.blurSamples&&(d.defines.VSM_SAMPLES=T.blurSamples,f.defines.VSM_SAMPLES=T.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new Ee(s.x,s.y)),d.uniforms.shadow_pass.value=T.map.texture,d.uniforms.resolution.value=T.mapSize,d.uniforms.radius.value=T.radius,i.setRenderTarget(T.mapPass),i.clear(),i.renderBufferDirect(A,null,N,d,x,null),f.uniforms.shadow_pass.value=T.mapPass.texture,f.uniforms.resolution.value=T.mapSize,f.uniforms.radius.value=T.radius,i.setRenderTarget(T.map),i.clear(),i.renderBufferDirect(A,null,N,f,x,null)}function M(T,A,N,S){let v=null,C=N.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(C!==void 0)v=C;else if(v=N.isPointLight===!0?l:o,i.localClippingEnabled&&A.clipShadows===!0&&Array.isArray(A.clippingPlanes)&&A.clippingPlanes.length!==0||A.displacementMap&&A.displacementScale!==0||A.alphaMap&&A.alphaTest>0||A.map&&A.alphaTest>0){let G=v.uuid,z=A.uuid,$=c[G];$===void 0&&($={},c[G]=$);let Q=$[z];Q===void 0&&(Q=v.clone(),$[z]=Q,A.addEventListener("dispose",I)),v=Q}if(v.visible=A.visible,v.wireframe=A.wireframe,S===Rn?v.side=A.shadowSide!==null?A.shadowSide:A.side:v.side=A.shadowSide!==null?A.shadowSide:u[A.side],v.alphaMap=A.alphaMap,v.alphaTest=A.alphaTest,v.map=A.map,v.clipShadows=A.clipShadows,v.clippingPlanes=A.clippingPlanes,v.clipIntersection=A.clipIntersection,v.displacementMap=A.displacementMap,v.displacementScale=A.displacementScale,v.displacementBias=A.displacementBias,v.wireframeLinewidth=A.wireframeLinewidth,v.linewidth=A.linewidth,N.isPointLight===!0&&v.isMeshDistanceMaterial===!0){let G=i.properties.get(v);G.light=N}return v}function b(T,A,N,S,v){if(T.visible===!1)return;if(T.layers.test(A.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&v===Rn)&&(!T.frustumCulled||n.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(N.matrixWorldInverse,T.matrixWorld);let z=t.update(T),$=T.material;if(Array.isArray($)){let Q=z.groups;for(let W=0,it=Q.length;W<it;W++){let B=Q[W],j=$[B.materialIndex];if(j&&j.visible){let nt=M(T,j,S,v);T.onBeforeShadow(i,T,A,N,z,nt,B),i.renderBufferDirect(N,null,z,nt,T,B),T.onAfterShadow(i,T,A,N,z,nt,B)}}}else if($.visible){let Q=M(T,$,S,v);T.onBeforeShadow(i,T,A,N,z,Q,null),i.renderBufferDirect(N,null,z,Q,T,null),T.onAfterShadow(i,T,A,N,z,Q,null)}}let G=T.children;for(let z=0,$=G.length;z<$;z++)b(G[z],A,N,S,v)}function I(T){T.target.removeEventListener("dispose",I);for(let N in c){let S=c[N],v=T.target.uuid;v in S&&(S[v].dispose(),delete S[v])}}}var tg={[xa]:ya,[_a]:Ma,[va]:Sa,[Yi]:ba,[ya]:xa,[Ma]:_a,[Sa]:va,[ba]:Yi};function eg(i,t){function e(){let L=!1,ut=new ce,q=null,K=new ce(0,0,0,0);return{setMask:function(gt){q!==gt&&!L&&(i.colorMask(gt,gt,gt,gt),q=gt)},setLocked:function(gt){L=gt},setClear:function(gt,ft,Vt,ge,Te){Te===!0&&(gt*=ge,ft*=ge,Vt*=ge),ut.set(gt,ft,Vt,ge),K.equals(ut)===!1&&(i.clearColor(gt,ft,Vt,ge),K.copy(ut))},reset:function(){L=!1,q=null,K.set(-1,0,0,0)}}}function n(){let L=!1,ut=!1,q=null,K=null,gt=null;return{setReversed:function(ft){if(ut!==ft){let Vt=t.get("EXT_clip_control");ut?Vt.clipControlEXT(Vt.LOWER_LEFT_EXT,Vt.ZERO_TO_ONE_EXT):Vt.clipControlEXT(Vt.LOWER_LEFT_EXT,Vt.NEGATIVE_ONE_TO_ONE_EXT);let ge=gt;gt=null,this.setClear(ge)}ut=ft},getReversed:function(){return ut},setTest:function(ft){ft?lt(i.DEPTH_TEST):Ut(i.DEPTH_TEST)},setMask:function(ft){q!==ft&&!L&&(i.depthMask(ft),q=ft)},setFunc:function(ft){if(ut&&(ft=tg[ft]),K!==ft){switch(ft){case xa:i.depthFunc(i.NEVER);break;case ya:i.depthFunc(i.ALWAYS);break;case _a:i.depthFunc(i.LESS);break;case Yi:i.depthFunc(i.LEQUAL);break;case va:i.depthFunc(i.EQUAL);break;case ba:i.depthFunc(i.GEQUAL);break;case Ma:i.depthFunc(i.GREATER);break;case Sa:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}K=ft}},setLocked:function(ft){L=ft},setClear:function(ft){gt!==ft&&(ut&&(ft=1-ft),i.clearDepth(ft),gt=ft)},reset:function(){L=!1,q=null,K=null,gt=null,ut=!1}}}function s(){let L=!1,ut=null,q=null,K=null,gt=null,ft=null,Vt=null,ge=null,Te=null;return{setTest:function(le){L||(le?lt(i.STENCIL_TEST):Ut(i.STENCIL_TEST))},setMask:function(le){ut!==le&&!L&&(i.stencilMask(le),ut=le)},setFunc:function(le,tn,Mn){(q!==le||K!==tn||gt!==Mn)&&(i.stencilFunc(le,tn,Mn),q=le,K=tn,gt=Mn)},setOp:function(le,tn,Mn){(ft!==le||Vt!==tn||ge!==Mn)&&(i.stencilOp(le,tn,Mn),ft=le,Vt=tn,ge=Mn)},setLocked:function(le){L=le},setClear:function(le){Te!==le&&(i.clearStencil(le),Te=le)},reset:function(){L=!1,ut=null,q=null,K=null,gt=null,ft=null,Vt=null,ge=null,Te=null}}}let r=new e,a=new n,o=new s,l=new WeakMap,c=new WeakMap,h={},u={},d=new WeakMap,f=[],g=null,x=!1,m=null,p=null,E=null,M=null,b=null,I=null,T=null,A=new Dt(0,0,0),N=0,S=!1,v=null,C=null,G=null,z=null,$=null,Q=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),W=!1,it=0,B=i.getParameter(i.VERSION);B.indexOf("WebGL")!==-1?(it=parseFloat(/^WebGL (\d)/.exec(B)[1]),W=it>=1):B.indexOf("OpenGL ES")!==-1&&(it=parseFloat(/^OpenGL ES (\d)/.exec(B)[1]),W=it>=2);let j=null,nt={},ht=i.getParameter(i.SCISSOR_BOX),It=i.getParameter(i.VIEWPORT),Yt=new ce().fromArray(ht),Y=new ce().fromArray(It);function et(L,ut,q,K){let gt=new Uint8Array(4),ft=i.createTexture();i.bindTexture(L,ft),i.texParameteri(L,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(L,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Vt=0;Vt<q;Vt++)L===i.TEXTURE_3D||L===i.TEXTURE_2D_ARRAY?i.texImage3D(ut,0,i.RGBA,1,1,K,0,i.RGBA,i.UNSIGNED_BYTE,gt):i.texImage2D(ut+Vt,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,gt);return ft}let xt={};xt[i.TEXTURE_2D]=et(i.TEXTURE_2D,i.TEXTURE_2D,1),xt[i.TEXTURE_CUBE_MAP]=et(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),xt[i.TEXTURE_2D_ARRAY]=et(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),xt[i.TEXTURE_3D]=et(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),lt(i.DEPTH_TEST),a.setFunc(Yi),Ht(!1),Xt(yc),lt(i.CULL_FACE),P(Qe);function lt(L){h[L]!==!0&&(i.enable(L),h[L]=!0)}function Ut(L){h[L]!==!1&&(i.disable(L),h[L]=!1)}function Ot(L,ut){return u[L]!==ut?(i.bindFramebuffer(L,ut),u[L]=ut,L===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=ut),L===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=ut),!0):!1}function at(L,ut){let q=f,K=!1;if(L){q=d.get(ut),q===void 0&&(q=[],d.set(ut,q));let gt=L.textures;if(q.length!==gt.length||q[0]!==i.COLOR_ATTACHMENT0){for(let ft=0,Vt=gt.length;ft<Vt;ft++)q[ft]=i.COLOR_ATTACHMENT0+ft;q.length=gt.length,K=!0}}else q[0]!==i.BACK&&(q[0]=i.BACK,K=!0);K&&i.drawBuffers(q)}function Rt(L){return g!==L?(i.useProgram(L),g=L,!0):!1}let Ft={[mi]:i.FUNC_ADD,[Bu]:i.FUNC_SUBTRACT,[Ou]:i.FUNC_REVERSE_SUBTRACT};Ft[ku]=i.MIN,Ft[zu]=i.MAX;let Qt={[Hu]:i.ZERO,[Vu]:i.ONE,[Gu]:i.SRC_COLOR,[ma]:i.SRC_ALPHA,[Zu]:i.SRC_ALPHA_SATURATE,[$u]:i.DST_COLOR,[Xu]:i.DST_ALPHA,[Wu]:i.ONE_MINUS_SRC_COLOR,[ga]:i.ONE_MINUS_SRC_ALPHA,[Yu]:i.ONE_MINUS_DST_COLOR,[qu]:i.ONE_MINUS_DST_ALPHA,[Ju]:i.CONSTANT_COLOR,[Ku]:i.ONE_MINUS_CONSTANT_COLOR,[Qu]:i.CONSTANT_ALPHA,[ju]:i.ONE_MINUS_CONSTANT_ALPHA};function P(L,ut,q,K,gt,ft,Vt,ge,Te,le){if(L===Qe){x===!0&&(Ut(i.BLEND),x=!1);return}if(x===!1&&(lt(i.BLEND),x=!0),L!==Fu){if(L!==m||le!==S){if((p!==mi||b!==mi)&&(i.blendEquation(i.FUNC_ADD),p=mi,b=mi),le)switch(L){case Wi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case wr:i.blendFunc(i.ONE,i.ONE);break;case _c:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case vc:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",L);break}else switch(L){case Wi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case wr:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case _c:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case vc:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",L);break}E=null,M=null,I=null,T=null,A.set(0,0,0),N=0,m=L,S=le}return}gt=gt||ut,ft=ft||q,Vt=Vt||K,(ut!==p||gt!==b)&&(i.blendEquationSeparate(Ft[ut],Ft[gt]),p=ut,b=gt),(q!==E||K!==M||ft!==I||Vt!==T)&&(i.blendFuncSeparate(Qt[q],Qt[K],Qt[ft],Qt[Vt]),E=q,M=K,I=ft,T=Vt),(ge.equals(A)===!1||Te!==N)&&(i.blendColor(ge.r,ge.g,ge.b,Te),A.copy(ge),N=Te),m=L,S=!1}function he(L,ut){L.side===Pn?Ut(i.CULL_FACE):lt(i.CULL_FACE);let q=L.side===Ie;ut&&(q=!q),Ht(q),L.blending===Wi&&L.transparent===!1?P(Qe):P(L.blending,L.blendEquation,L.blendSrc,L.blendDst,L.blendEquationAlpha,L.blendSrcAlpha,L.blendDstAlpha,L.blendColor,L.blendAlpha,L.premultipliedAlpha),a.setFunc(L.depthFunc),a.setTest(L.depthTest),a.setMask(L.depthWrite),r.setMask(L.colorWrite);let K=L.stencilWrite;o.setTest(K),K&&(o.setMask(L.stencilWriteMask),o.setFunc(L.stencilFunc,L.stencilRef,L.stencilFuncMask),o.setOp(L.stencilFail,L.stencilZFail,L.stencilZPass)),Zt(L.polygonOffset,L.polygonOffsetFactor,L.polygonOffsetUnits),L.alphaToCoverage===!0?lt(i.SAMPLE_ALPHA_TO_COVERAGE):Ut(i.SAMPLE_ALPHA_TO_COVERAGE)}function Ht(L){v!==L&&(L?i.frontFace(i.CW):i.frontFace(i.CCW),v=L)}function Xt(L){L!==Uu?(lt(i.CULL_FACE),L!==C&&(L===yc?i.cullFace(i.BACK):L===Nu?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Ut(i.CULL_FACE),C=L}function Pt(L){L!==G&&(W&&i.lineWidth(L),G=L)}function Zt(L,ut,q){L?(lt(i.POLYGON_OFFSET_FILL),(z!==ut||$!==q)&&(i.polygonOffset(ut,q),z=ut,$=q)):Ut(i.POLYGON_OFFSET_FILL)}function Tt(L){L?lt(i.SCISSOR_TEST):Ut(i.SCISSOR_TEST)}function w(L){L===void 0&&(L=i.TEXTURE0+Q-1),j!==L&&(i.activeTexture(L),j=L)}function y(L,ut,q){q===void 0&&(j===null?q=i.TEXTURE0+Q-1:q=j);let K=nt[q];K===void 0&&(K={type:void 0,texture:void 0},nt[q]=K),(K.type!==L||K.texture!==ut)&&(j!==q&&(i.activeTexture(q),j=q),i.bindTexture(L,ut||xt[L]),K.type=L,K.texture=ut)}function F(){let L=nt[j];L!==void 0&&L.type!==void 0&&(i.bindTexture(L.type,null),L.type=void 0,L.texture=void 0)}function X(){try{i.compressedTexImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function J(){try{i.compressedTexImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function Z(){try{i.texSubImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function At(){try{i.texSubImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function dt(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function _t(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function jt(){try{i.texStorage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function st(){try{i.texStorage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function vt(){try{i.texImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function Bt(){try{i.texImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function kt(L){Yt.equals(L)===!1&&(i.scissor(L.x,L.y,L.z,L.w),Yt.copy(L))}function bt(L){Y.equals(L)===!1&&(i.viewport(L.x,L.y,L.z,L.w),Y.copy(L))}function Kt(L,ut){let q=c.get(ut);q===void 0&&(q=new WeakMap,c.set(ut,q));let K=q.get(L);K===void 0&&(K=i.getUniformBlockIndex(ut,L.name),q.set(L,K))}function qt(L,ut){let K=c.get(ut).get(L);l.get(ut)!==K&&(i.uniformBlockBinding(ut,K,L.__bindingPointIndex),l.set(ut,K))}function ue(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),h={},j=null,nt={},u={},d=new WeakMap,f=[],g=null,x=!1,m=null,p=null,E=null,M=null,b=null,I=null,T=null,A=new Dt(0,0,0),N=0,S=!1,v=null,C=null,G=null,z=null,$=null,Yt.set(0,0,i.canvas.width,i.canvas.height),Y.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:lt,disable:Ut,bindFramebuffer:Ot,drawBuffers:at,useProgram:Rt,setBlending:P,setMaterial:he,setFlipSided:Ht,setCullFace:Xt,setLineWidth:Pt,setPolygonOffset:Zt,setScissorTest:Tt,activeTexture:w,bindTexture:y,unbindTexture:F,compressedTexImage2D:X,compressedTexImage3D:J,texImage2D:vt,texImage3D:Bt,updateUBOMapping:Kt,uniformBlockBinding:qt,texStorage2D:jt,texStorage3D:st,texSubImage2D:Z,texSubImage3D:At,compressedTexSubImage2D:dt,compressedTexSubImage3D:_t,scissor:kt,viewport:bt,reset:ue}}function gh(i,t,e,n){let s=ng(n);switch(e){case Nh:return i*t;case Bh:return i*t;case Oh:return i*t*2;case Gl:return i*t/s.components*s.byteLength;case Wl:return i*t/s.components*s.byteLength;case kh:return i*t*2/s.components*s.byteLength;case Xl:return i*t*2/s.components*s.byteLength;case Fh:return i*t*3/s.components*s.byteLength;case an:return i*t*4/s.components*s.byteLength;case ql:return i*t*4/s.components*s.byteLength;case _r:case vr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case br:case Mr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ca:case Pa:return Math.max(i,16)*Math.max(t,8)/4;case Aa:case Ra:return Math.max(i,8)*Math.max(t,8)/2;case Ia:case La:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Da:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ua:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Na:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case Fa:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case Ba:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case Oa:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case ka:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case za:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case Ha:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case Va:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case Ga:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case Wa:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case Xa:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case qa:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case $a:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case Sr:case Ya:case Za:return Math.ceil(i/4)*Math.ceil(t/4)*16;case zh:case Ja:return Math.ceil(i/4)*Math.ceil(t/4)*8;case Ka:case Qa:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function ng(i){switch(i){case Dn:case Lh:return{byteLength:1,components:1};case Ns:case Dh:case Ze:return{byteLength:2,components:1};case Hl:case Vl:return{byteLength:2,components:4};case vi:case zl:case pn:return{byteLength:4,components:1};case Uh:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}function ig(i,t,e,n,s,r,a){let o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Lt,h=new WeakMap,u,d=new WeakMap,f=!1;try{f=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(w,y){return f?new OffscreenCanvas(w,y):Ar("canvas")}function x(w,y,F){let X=1,J=Tt(w);if((J.width>F||J.height>F)&&(X=F/Math.max(J.width,J.height)),X<1)if(typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&w instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&w instanceof ImageBitmap||typeof VideoFrame<"u"&&w instanceof VideoFrame){let Z=Math.floor(X*J.width),At=Math.floor(X*J.height);u===void 0&&(u=g(Z,At));let dt=y?g(Z,At):u;return dt.width=Z,dt.height=At,dt.getContext("2d").drawImage(w,0,0,Z,At),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+J.width+"x"+J.height+") to ("+Z+"x"+At+")."),dt}else return"data"in w&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+J.width+"x"+J.height+")."),w;return w}function m(w){return w.generateMipmaps}function p(w){i.generateMipmap(w)}function E(w){return w.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:w.isWebGL3DRenderTarget?i.TEXTURE_3D:w.isWebGLArrayRenderTarget||w.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function M(w,y,F,X,J=!1){if(w!==null){if(i[w]!==void 0)return i[w];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+w+"'")}let Z=y;if(y===i.RED&&(F===i.FLOAT&&(Z=i.R32F),F===i.HALF_FLOAT&&(Z=i.R16F),F===i.UNSIGNED_BYTE&&(Z=i.R8)),y===i.RED_INTEGER&&(F===i.UNSIGNED_BYTE&&(Z=i.R8UI),F===i.UNSIGNED_SHORT&&(Z=i.R16UI),F===i.UNSIGNED_INT&&(Z=i.R32UI),F===i.BYTE&&(Z=i.R8I),F===i.SHORT&&(Z=i.R16I),F===i.INT&&(Z=i.R32I)),y===i.RG&&(F===i.FLOAT&&(Z=i.RG32F),F===i.HALF_FLOAT&&(Z=i.RG16F),F===i.UNSIGNED_BYTE&&(Z=i.RG8)),y===i.RG_INTEGER&&(F===i.UNSIGNED_BYTE&&(Z=i.RG8UI),F===i.UNSIGNED_SHORT&&(Z=i.RG16UI),F===i.UNSIGNED_INT&&(Z=i.RG32UI),F===i.BYTE&&(Z=i.RG8I),F===i.SHORT&&(Z=i.RG16I),F===i.INT&&(Z=i.RG32I)),y===i.RGB_INTEGER&&(F===i.UNSIGNED_BYTE&&(Z=i.RGB8UI),F===i.UNSIGNED_SHORT&&(Z=i.RGB16UI),F===i.UNSIGNED_INT&&(Z=i.RGB32UI),F===i.BYTE&&(Z=i.RGB8I),F===i.SHORT&&(Z=i.RGB16I),F===i.INT&&(Z=i.RGB32I)),y===i.RGBA_INTEGER&&(F===i.UNSIGNED_BYTE&&(Z=i.RGBA8UI),F===i.UNSIGNED_SHORT&&(Z=i.RGBA16UI),F===i.UNSIGNED_INT&&(Z=i.RGBA32UI),F===i.BYTE&&(Z=i.RGBA8I),F===i.SHORT&&(Z=i.RGBA16I),F===i.INT&&(Z=i.RGBA32I)),y===i.RGB&&F===i.UNSIGNED_INT_5_9_9_9_REV&&(Z=i.RGB9_E5),y===i.RGBA){let At=J?to:Jt.getTransfer(X);F===i.FLOAT&&(Z=i.RGBA32F),F===i.HALF_FLOAT&&(Z=i.RGBA16F),F===i.UNSIGNED_BYTE&&(Z=At===re?i.SRGB8_ALPHA8:i.RGBA8),F===i.UNSIGNED_SHORT_4_4_4_4&&(Z=i.RGBA4),F===i.UNSIGNED_SHORT_5_5_5_1&&(Z=i.RGB5_A1)}return(Z===i.R16F||Z===i.R32F||Z===i.RG16F||Z===i.RG32F||Z===i.RGBA16F||Z===i.RGBA32F)&&t.get("EXT_color_buffer_float"),Z}function b(w,y){let F;return w?y===null||y===vi||y===Ki?F=i.DEPTH24_STENCIL8:y===pn?F=i.DEPTH32F_STENCIL8:y===Ns&&(F=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):y===null||y===vi||y===Ki?F=i.DEPTH_COMPONENT24:y===pn?F=i.DEPTH_COMPONENT32F:y===Ns&&(F=i.DEPTH_COMPONENT16),F}function I(w,y){return m(w)===!0||w.isFramebufferTexture&&w.minFilter!==Le&&w.minFilter!==fn?Math.log2(Math.max(y.width,y.height))+1:w.mipmaps!==void 0&&w.mipmaps.length>0?w.mipmaps.length:w.isCompressedTexture&&Array.isArray(w.image)?y.mipmaps.length:1}function T(w){let y=w.target;y.removeEventListener("dispose",T),N(y),y.isVideoTexture&&h.delete(y)}function A(w){let y=w.target;y.removeEventListener("dispose",A),v(y)}function N(w){let y=n.get(w);if(y.__webglInit===void 0)return;let F=w.source,X=d.get(F);if(X){let J=X[y.__cacheKey];J.usedTimes--,J.usedTimes===0&&S(w),Object.keys(X).length===0&&d.delete(F)}n.remove(w)}function S(w){let y=n.get(w);i.deleteTexture(y.__webglTexture);let F=w.source,X=d.get(F);delete X[y.__cacheKey],a.memory.textures--}function v(w){let y=n.get(w);if(w.depthTexture&&(w.depthTexture.dispose(),n.remove(w.depthTexture)),w.isWebGLCubeRenderTarget)for(let X=0;X<6;X++){if(Array.isArray(y.__webglFramebuffer[X]))for(let J=0;J<y.__webglFramebuffer[X].length;J++)i.deleteFramebuffer(y.__webglFramebuffer[X][J]);else i.deleteFramebuffer(y.__webglFramebuffer[X]);y.__webglDepthbuffer&&i.deleteRenderbuffer(y.__webglDepthbuffer[X])}else{if(Array.isArray(y.__webglFramebuffer))for(let X=0;X<y.__webglFramebuffer.length;X++)i.deleteFramebuffer(y.__webglFramebuffer[X]);else i.deleteFramebuffer(y.__webglFramebuffer);if(y.__webglDepthbuffer&&i.deleteRenderbuffer(y.__webglDepthbuffer),y.__webglMultisampledFramebuffer&&i.deleteFramebuffer(y.__webglMultisampledFramebuffer),y.__webglColorRenderbuffer)for(let X=0;X<y.__webglColorRenderbuffer.length;X++)y.__webglColorRenderbuffer[X]&&i.deleteRenderbuffer(y.__webglColorRenderbuffer[X]);y.__webglDepthRenderbuffer&&i.deleteRenderbuffer(y.__webglDepthRenderbuffer)}let F=w.textures;for(let X=0,J=F.length;X<J;X++){let Z=n.get(F[X]);Z.__webglTexture&&(i.deleteTexture(Z.__webglTexture),a.memory.textures--),n.remove(F[X])}n.remove(w)}let C=0;function G(){C=0}function z(){let w=C;return w>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+w+" texture units while this GPU supports only "+s.maxTextures),C+=1,w}function $(w){let y=[];return y.push(w.wrapS),y.push(w.wrapT),y.push(w.wrapR||0),y.push(w.magFilter),y.push(w.minFilter),y.push(w.anisotropy),y.push(w.internalFormat),y.push(w.format),y.push(w.type),y.push(w.generateMipmaps),y.push(w.premultiplyAlpha),y.push(w.flipY),y.push(w.unpackAlignment),y.push(w.colorSpace),y.join()}function Q(w,y){let F=n.get(w);if(w.isVideoTexture&&Pt(w),w.isRenderTargetTexture===!1&&w.version>0&&F.__version!==w.version){let X=w.image;if(X===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(X.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Y(F,w,y);return}}e.bindTexture(i.TEXTURE_2D,F.__webglTexture,i.TEXTURE0+y)}function W(w,y){let F=n.get(w);if(w.version>0&&F.__version!==w.version){Y(F,w,y);return}e.bindTexture(i.TEXTURE_2D_ARRAY,F.__webglTexture,i.TEXTURE0+y)}function it(w,y){let F=n.get(w);if(w.version>0&&F.__version!==w.version){Y(F,w,y);return}e.bindTexture(i.TEXTURE_3D,F.__webglTexture,i.TEXTURE0+y)}function B(w,y){let F=n.get(w);if(w.version>0&&F.__version!==w.version){et(F,w,y);return}e.bindTexture(i.TEXTURE_CUBE_MAP,F.__webglTexture,i.TEXTURE0+y)}let j={[Us]:i.REPEAT,[yi]:i.CLAMP_TO_EDGE,[Ta]:i.MIRRORED_REPEAT},nt={[Le]:i.NEAREST,[id]:i.NEAREST_MIPMAP_NEAREST,[$s]:i.NEAREST_MIPMAP_LINEAR,[fn]:i.LINEAR,[Do]:i.LINEAR_MIPMAP_NEAREST,[_i]:i.LINEAR_MIPMAP_LINEAR},ht={[od]:i.NEVER,[dd]:i.ALWAYS,[ad]:i.LESS,[Vh]:i.LEQUAL,[ld]:i.EQUAL,[ud]:i.GEQUAL,[cd]:i.GREATER,[hd]:i.NOTEQUAL};function It(w,y){if(y.type===pn&&t.has("OES_texture_float_linear")===!1&&(y.magFilter===fn||y.magFilter===Do||y.magFilter===$s||y.magFilter===_i||y.minFilter===fn||y.minFilter===Do||y.minFilter===$s||y.minFilter===_i)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(w,i.TEXTURE_WRAP_S,j[y.wrapS]),i.texParameteri(w,i.TEXTURE_WRAP_T,j[y.wrapT]),(w===i.TEXTURE_3D||w===i.TEXTURE_2D_ARRAY)&&i.texParameteri(w,i.TEXTURE_WRAP_R,j[y.wrapR]),i.texParameteri(w,i.TEXTURE_MAG_FILTER,nt[y.magFilter]),i.texParameteri(w,i.TEXTURE_MIN_FILTER,nt[y.minFilter]),y.compareFunction&&(i.texParameteri(w,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(w,i.TEXTURE_COMPARE_FUNC,ht[y.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(y.magFilter===Le||y.minFilter!==$s&&y.minFilter!==_i||y.type===pn&&t.has("OES_texture_float_linear")===!1)return;if(y.anisotropy>1||n.get(y).__currentAnisotropy){let F=t.get("EXT_texture_filter_anisotropic");i.texParameterf(w,F.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(y.anisotropy,s.getMaxAnisotropy())),n.get(y).__currentAnisotropy=y.anisotropy}}}function Yt(w,y){let F=!1;w.__webglInit===void 0&&(w.__webglInit=!0,y.addEventListener("dispose",T));let X=y.source,J=d.get(X);J===void 0&&(J={},d.set(X,J));let Z=$(y);if(Z!==w.__cacheKey){J[Z]===void 0&&(J[Z]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,F=!0),J[Z].usedTimes++;let At=J[w.__cacheKey];At!==void 0&&(J[w.__cacheKey].usedTimes--,At.usedTimes===0&&S(y)),w.__cacheKey=Z,w.__webglTexture=J[Z].texture}return F}function Y(w,y,F){let X=i.TEXTURE_2D;(y.isDataArrayTexture||y.isCompressedArrayTexture)&&(X=i.TEXTURE_2D_ARRAY),y.isData3DTexture&&(X=i.TEXTURE_3D);let J=Yt(w,y),Z=y.source;e.bindTexture(X,w.__webglTexture,i.TEXTURE0+F);let At=n.get(Z);if(Z.version!==At.__version||J===!0){e.activeTexture(i.TEXTURE0+F);let dt=Jt.getPrimaries(Jt.workingColorSpace),_t=y.colorSpace===$n?null:Jt.getPrimaries(y.colorSpace),jt=y.colorSpace===$n||dt===_t?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,y.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,y.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,jt);let st=x(y.image,!1,s.maxTextureSize);st=Zt(y,st);let vt=r.convert(y.format,y.colorSpace),Bt=r.convert(y.type),kt=M(y.internalFormat,vt,Bt,y.colorSpace,y.isVideoTexture);It(X,y);let bt,Kt=y.mipmaps,qt=y.isVideoTexture!==!0,ue=At.__version===void 0||J===!0,L=Z.dataReady,ut=I(y,st);if(y.isDepthTexture)kt=b(y.format===Qi,y.type),ue&&(qt?e.texStorage2D(i.TEXTURE_2D,1,kt,st.width,st.height):e.texImage2D(i.TEXTURE_2D,0,kt,st.width,st.height,0,vt,Bt,null));else if(y.isDataTexture)if(Kt.length>0){qt&&ue&&e.texStorage2D(i.TEXTURE_2D,ut,kt,Kt[0].width,Kt[0].height);for(let q=0,K=Kt.length;q<K;q++)bt=Kt[q],qt?L&&e.texSubImage2D(i.TEXTURE_2D,q,0,0,bt.width,bt.height,vt,Bt,bt.data):e.texImage2D(i.TEXTURE_2D,q,kt,bt.width,bt.height,0,vt,Bt,bt.data);y.generateMipmaps=!1}else qt?(ue&&e.texStorage2D(i.TEXTURE_2D,ut,kt,st.width,st.height),L&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,st.width,st.height,vt,Bt,st.data)):e.texImage2D(i.TEXTURE_2D,0,kt,st.width,st.height,0,vt,Bt,st.data);else if(y.isCompressedTexture)if(y.isCompressedArrayTexture){qt&&ue&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ut,kt,Kt[0].width,Kt[0].height,st.depth);for(let q=0,K=Kt.length;q<K;q++)if(bt=Kt[q],y.format!==an)if(vt!==null)if(qt){if(L)if(y.layerUpdates.size>0){let gt=gh(bt.width,bt.height,y.format,y.type);for(let ft of y.layerUpdates){let Vt=bt.data.subarray(ft*gt/bt.data.BYTES_PER_ELEMENT,(ft+1)*gt/bt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,q,0,0,ft,bt.width,bt.height,1,vt,Vt)}y.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,q,0,0,0,bt.width,bt.height,st.depth,vt,bt.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,q,kt,bt.width,bt.height,st.depth,0,bt.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else qt?L&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,q,0,0,0,bt.width,bt.height,st.depth,vt,Bt,bt.data):e.texImage3D(i.TEXTURE_2D_ARRAY,q,kt,bt.width,bt.height,st.depth,0,vt,Bt,bt.data)}else{qt&&ue&&e.texStorage2D(i.TEXTURE_2D,ut,kt,Kt[0].width,Kt[0].height);for(let q=0,K=Kt.length;q<K;q++)bt=Kt[q],y.format!==an?vt!==null?qt?L&&e.compressedTexSubImage2D(i.TEXTURE_2D,q,0,0,bt.width,bt.height,vt,bt.data):e.compressedTexImage2D(i.TEXTURE_2D,q,kt,bt.width,bt.height,0,bt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):qt?L&&e.texSubImage2D(i.TEXTURE_2D,q,0,0,bt.width,bt.height,vt,Bt,bt.data):e.texImage2D(i.TEXTURE_2D,q,kt,bt.width,bt.height,0,vt,Bt,bt.data)}else if(y.isDataArrayTexture)if(qt){if(ue&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ut,kt,st.width,st.height,st.depth),L)if(y.layerUpdates.size>0){let q=gh(st.width,st.height,y.format,y.type);for(let K of y.layerUpdates){let gt=st.data.subarray(K*q/st.data.BYTES_PER_ELEMENT,(K+1)*q/st.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,K,st.width,st.height,1,vt,Bt,gt)}y.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,st.width,st.height,st.depth,vt,Bt,st.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,kt,st.width,st.height,st.depth,0,vt,Bt,st.data);else if(y.isData3DTexture)qt?(ue&&e.texStorage3D(i.TEXTURE_3D,ut,kt,st.width,st.height,st.depth),L&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,st.width,st.height,st.depth,vt,Bt,st.data)):e.texImage3D(i.TEXTURE_3D,0,kt,st.width,st.height,st.depth,0,vt,Bt,st.data);else if(y.isFramebufferTexture){if(ue)if(qt)e.texStorage2D(i.TEXTURE_2D,ut,kt,st.width,st.height);else{let q=st.width,K=st.height;for(let gt=0;gt<ut;gt++)e.texImage2D(i.TEXTURE_2D,gt,kt,q,K,0,vt,Bt,null),q>>=1,K>>=1}}else if(Kt.length>0){if(qt&&ue){let q=Tt(Kt[0]);e.texStorage2D(i.TEXTURE_2D,ut,kt,q.width,q.height)}for(let q=0,K=Kt.length;q<K;q++)bt=Kt[q],qt?L&&e.texSubImage2D(i.TEXTURE_2D,q,0,0,vt,Bt,bt):e.texImage2D(i.TEXTURE_2D,q,kt,vt,Bt,bt);y.generateMipmaps=!1}else if(qt){if(ue){let q=Tt(st);e.texStorage2D(i.TEXTURE_2D,ut,kt,q.width,q.height)}L&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,vt,Bt,st)}else e.texImage2D(i.TEXTURE_2D,0,kt,vt,Bt,st);m(y)&&p(X),At.__version=Z.version,y.onUpdate&&y.onUpdate(y)}w.__version=y.version}function et(w,y,F){if(y.image.length!==6)return;let X=Yt(w,y),J=y.source;e.bindTexture(i.TEXTURE_CUBE_MAP,w.__webglTexture,i.TEXTURE0+F);let Z=n.get(J);if(J.version!==Z.__version||X===!0){e.activeTexture(i.TEXTURE0+F);let At=Jt.getPrimaries(Jt.workingColorSpace),dt=y.colorSpace===$n?null:Jt.getPrimaries(y.colorSpace),_t=y.colorSpace===$n||At===dt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,y.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,y.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,_t);let jt=y.isCompressedTexture||y.image[0].isCompressedTexture,st=y.image[0]&&y.image[0].isDataTexture,vt=[];for(let K=0;K<6;K++)!jt&&!st?vt[K]=x(y.image[K],!0,s.maxCubemapSize):vt[K]=st?y.image[K].image:y.image[K],vt[K]=Zt(y,vt[K]);let Bt=vt[0],kt=r.convert(y.format,y.colorSpace),bt=r.convert(y.type),Kt=M(y.internalFormat,kt,bt,y.colorSpace),qt=y.isVideoTexture!==!0,ue=Z.__version===void 0||X===!0,L=J.dataReady,ut=I(y,Bt);It(i.TEXTURE_CUBE_MAP,y);let q;if(jt){qt&&ue&&e.texStorage2D(i.TEXTURE_CUBE_MAP,ut,Kt,Bt.width,Bt.height);for(let K=0;K<6;K++){q=vt[K].mipmaps;for(let gt=0;gt<q.length;gt++){let ft=q[gt];y.format!==an?kt!==null?qt?L&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,gt,0,0,ft.width,ft.height,kt,ft.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,gt,Kt,ft.width,ft.height,0,ft.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):qt?L&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,gt,0,0,ft.width,ft.height,kt,bt,ft.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,gt,Kt,ft.width,ft.height,0,kt,bt,ft.data)}}}else{if(q=y.mipmaps,qt&&ue){q.length>0&&ut++;let K=Tt(vt[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,ut,Kt,K.width,K.height)}for(let K=0;K<6;K++)if(st){qt?L&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,vt[K].width,vt[K].height,kt,bt,vt[K].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Kt,vt[K].width,vt[K].height,0,kt,bt,vt[K].data);for(let gt=0;gt<q.length;gt++){let Vt=q[gt].image[K].image;qt?L&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,gt+1,0,0,Vt.width,Vt.height,kt,bt,Vt.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,gt+1,Kt,Vt.width,Vt.height,0,kt,bt,Vt.data)}}else{qt?L&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,kt,bt,vt[K]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Kt,kt,bt,vt[K]);for(let gt=0;gt<q.length;gt++){let ft=q[gt];qt?L&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,gt+1,0,0,kt,bt,ft.image[K]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,gt+1,Kt,kt,bt,ft.image[K])}}}m(y)&&p(i.TEXTURE_CUBE_MAP),Z.__version=J.version,y.onUpdate&&y.onUpdate(y)}w.__version=y.version}function xt(w,y,F,X,J,Z){let At=r.convert(F.format,F.colorSpace),dt=r.convert(F.type),_t=M(F.internalFormat,At,dt,F.colorSpace),jt=n.get(y),st=n.get(F);if(st.__renderTarget=y,!jt.__hasExternalTextures){let vt=Math.max(1,y.width>>Z),Bt=Math.max(1,y.height>>Z);J===i.TEXTURE_3D||J===i.TEXTURE_2D_ARRAY?e.texImage3D(J,Z,_t,vt,Bt,y.depth,0,At,dt,null):e.texImage2D(J,Z,_t,vt,Bt,0,At,dt,null)}e.bindFramebuffer(i.FRAMEBUFFER,w),Xt(y)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,X,J,st.__webglTexture,0,Ht(y)):(J===i.TEXTURE_2D||J>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&J<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,X,J,st.__webglTexture,Z),e.bindFramebuffer(i.FRAMEBUFFER,null)}function lt(w,y,F){if(i.bindRenderbuffer(i.RENDERBUFFER,w),y.depthBuffer){let X=y.depthTexture,J=X&&X.isDepthTexture?X.type:null,Z=b(y.stencilBuffer,J),At=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,dt=Ht(y);Xt(y)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,dt,Z,y.width,y.height):F?i.renderbufferStorageMultisample(i.RENDERBUFFER,dt,Z,y.width,y.height):i.renderbufferStorage(i.RENDERBUFFER,Z,y.width,y.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,At,i.RENDERBUFFER,w)}else{let X=y.textures;for(let J=0;J<X.length;J++){let Z=X[J],At=r.convert(Z.format,Z.colorSpace),dt=r.convert(Z.type),_t=M(Z.internalFormat,At,dt,Z.colorSpace),jt=Ht(y);F&&Xt(y)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,jt,_t,y.width,y.height):Xt(y)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,jt,_t,y.width,y.height):i.renderbufferStorage(i.RENDERBUFFER,_t,y.width,y.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Ut(w,y){if(y&&y.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(i.FRAMEBUFFER,w),!(y.depthTexture&&y.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");let X=n.get(y.depthTexture);X.__renderTarget=y,(!X.__webglTexture||y.depthTexture.image.width!==y.width||y.depthTexture.image.height!==y.height)&&(y.depthTexture.image.width=y.width,y.depthTexture.image.height=y.height,y.depthTexture.needsUpdate=!0),Q(y.depthTexture,0);let J=X.__webglTexture,Z=Ht(y);if(y.depthTexture.format===Xi)Xt(y)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,J,0,Z):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,J,0);else if(y.depthTexture.format===Qi)Xt(y)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,J,0,Z):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,J,0);else throw new Error("Unknown depthTexture format")}function Ot(w){let y=n.get(w),F=w.isWebGLCubeRenderTarget===!0;if(y.__boundDepthTexture!==w.depthTexture){let X=w.depthTexture;if(y.__depthDisposeCallback&&y.__depthDisposeCallback(),X){let J=()=>{delete y.__boundDepthTexture,delete y.__depthDisposeCallback,X.removeEventListener("dispose",J)};X.addEventListener("dispose",J),y.__depthDisposeCallback=J}y.__boundDepthTexture=X}if(w.depthTexture&&!y.__autoAllocateDepthBuffer){if(F)throw new Error("target.depthTexture not supported in Cube render targets");Ut(y.__webglFramebuffer,w)}else if(F){y.__webglDepthbuffer=[];for(let X=0;X<6;X++)if(e.bindFramebuffer(i.FRAMEBUFFER,y.__webglFramebuffer[X]),y.__webglDepthbuffer[X]===void 0)y.__webglDepthbuffer[X]=i.createRenderbuffer(),lt(y.__webglDepthbuffer[X],w,!1);else{let J=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Z=y.__webglDepthbuffer[X];i.bindRenderbuffer(i.RENDERBUFFER,Z),i.framebufferRenderbuffer(i.FRAMEBUFFER,J,i.RENDERBUFFER,Z)}}else if(e.bindFramebuffer(i.FRAMEBUFFER,y.__webglFramebuffer),y.__webglDepthbuffer===void 0)y.__webglDepthbuffer=i.createRenderbuffer(),lt(y.__webglDepthbuffer,w,!1);else{let X=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,J=y.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,J),i.framebufferRenderbuffer(i.FRAMEBUFFER,X,i.RENDERBUFFER,J)}e.bindFramebuffer(i.FRAMEBUFFER,null)}function at(w,y,F){let X=n.get(w);y!==void 0&&xt(X.__webglFramebuffer,w,w.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),F!==void 0&&Ot(w)}function Rt(w){let y=w.texture,F=n.get(w),X=n.get(y);w.addEventListener("dispose",A);let J=w.textures,Z=w.isWebGLCubeRenderTarget===!0,At=J.length>1;if(At||(X.__webglTexture===void 0&&(X.__webglTexture=i.createTexture()),X.__version=y.version,a.memory.textures++),Z){F.__webglFramebuffer=[];for(let dt=0;dt<6;dt++)if(y.mipmaps&&y.mipmaps.length>0){F.__webglFramebuffer[dt]=[];for(let _t=0;_t<y.mipmaps.length;_t++)F.__webglFramebuffer[dt][_t]=i.createFramebuffer()}else F.__webglFramebuffer[dt]=i.createFramebuffer()}else{if(y.mipmaps&&y.mipmaps.length>0){F.__webglFramebuffer=[];for(let dt=0;dt<y.mipmaps.length;dt++)F.__webglFramebuffer[dt]=i.createFramebuffer()}else F.__webglFramebuffer=i.createFramebuffer();if(At)for(let dt=0,_t=J.length;dt<_t;dt++){let jt=n.get(J[dt]);jt.__webglTexture===void 0&&(jt.__webglTexture=i.createTexture(),a.memory.textures++)}if(w.samples>0&&Xt(w)===!1){F.__webglMultisampledFramebuffer=i.createFramebuffer(),F.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,F.__webglMultisampledFramebuffer);for(let dt=0;dt<J.length;dt++){let _t=J[dt];F.__webglColorRenderbuffer[dt]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,F.__webglColorRenderbuffer[dt]);let jt=r.convert(_t.format,_t.colorSpace),st=r.convert(_t.type),vt=M(_t.internalFormat,jt,st,_t.colorSpace,w.isXRRenderTarget===!0),Bt=Ht(w);i.renderbufferStorageMultisample(i.RENDERBUFFER,Bt,vt,w.width,w.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+dt,i.RENDERBUFFER,F.__webglColorRenderbuffer[dt])}i.bindRenderbuffer(i.RENDERBUFFER,null),w.depthBuffer&&(F.__webglDepthRenderbuffer=i.createRenderbuffer(),lt(F.__webglDepthRenderbuffer,w,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(Z){e.bindTexture(i.TEXTURE_CUBE_MAP,X.__webglTexture),It(i.TEXTURE_CUBE_MAP,y);for(let dt=0;dt<6;dt++)if(y.mipmaps&&y.mipmaps.length>0)for(let _t=0;_t<y.mipmaps.length;_t++)xt(F.__webglFramebuffer[dt][_t],w,y,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+dt,_t);else xt(F.__webglFramebuffer[dt],w,y,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+dt,0);m(y)&&p(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(At){for(let dt=0,_t=J.length;dt<_t;dt++){let jt=J[dt],st=n.get(jt);e.bindTexture(i.TEXTURE_2D,st.__webglTexture),It(i.TEXTURE_2D,jt),xt(F.__webglFramebuffer,w,jt,i.COLOR_ATTACHMENT0+dt,i.TEXTURE_2D,0),m(jt)&&p(i.TEXTURE_2D)}e.unbindTexture()}else{let dt=i.TEXTURE_2D;if((w.isWebGL3DRenderTarget||w.isWebGLArrayRenderTarget)&&(dt=w.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(dt,X.__webglTexture),It(dt,y),y.mipmaps&&y.mipmaps.length>0)for(let _t=0;_t<y.mipmaps.length;_t++)xt(F.__webglFramebuffer[_t],w,y,i.COLOR_ATTACHMENT0,dt,_t);else xt(F.__webglFramebuffer,w,y,i.COLOR_ATTACHMENT0,dt,0);m(y)&&p(dt),e.unbindTexture()}w.depthBuffer&&Ot(w)}function Ft(w){let y=w.textures;for(let F=0,X=y.length;F<X;F++){let J=y[F];if(m(J)){let Z=E(w),At=n.get(J).__webglTexture;e.bindTexture(Z,At),p(Z),e.unbindTexture()}}}let Qt=[],P=[];function he(w){if(w.samples>0){if(Xt(w)===!1){let y=w.textures,F=w.width,X=w.height,J=i.COLOR_BUFFER_BIT,Z=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,At=n.get(w),dt=y.length>1;if(dt)for(let _t=0;_t<y.length;_t++)e.bindFramebuffer(i.FRAMEBUFFER,At.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+_t,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,At.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+_t,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,At.__webglMultisampledFramebuffer),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,At.__webglFramebuffer);for(let _t=0;_t<y.length;_t++){if(w.resolveDepthBuffer&&(w.depthBuffer&&(J|=i.DEPTH_BUFFER_BIT),w.stencilBuffer&&w.resolveStencilBuffer&&(J|=i.STENCIL_BUFFER_BIT)),dt){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,At.__webglColorRenderbuffer[_t]);let jt=n.get(y[_t]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,jt,0)}i.blitFramebuffer(0,0,F,X,0,0,F,X,J,i.NEAREST),l===!0&&(Qt.length=0,P.length=0,Qt.push(i.COLOR_ATTACHMENT0+_t),w.depthBuffer&&w.resolveDepthBuffer===!1&&(Qt.push(Z),P.push(Z),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,P)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,Qt))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),dt)for(let _t=0;_t<y.length;_t++){e.bindFramebuffer(i.FRAMEBUFFER,At.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+_t,i.RENDERBUFFER,At.__webglColorRenderbuffer[_t]);let jt=n.get(y[_t]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,At.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+_t,i.TEXTURE_2D,jt,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,At.__webglMultisampledFramebuffer)}else if(w.depthBuffer&&w.resolveDepthBuffer===!1&&l){let y=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[y])}}}function Ht(w){return Math.min(s.maxSamples,w.samples)}function Xt(w){let y=n.get(w);return w.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&y.__useRenderToTexture!==!1}function Pt(w){let y=a.render.frame;h.get(w)!==y&&(h.set(w,y),w.update())}function Zt(w,y){let F=w.colorSpace,X=w.format,J=w.type;return w.isCompressedTexture===!0||w.isVideoTexture===!0||F!==ls&&F!==$n&&(Jt.getTransfer(F)===re?(X!==an||J!==Dn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",F)),y}function Tt(w){return typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement?(c.width=w.naturalWidth||w.width,c.height=w.naturalHeight||w.height):typeof VideoFrame<"u"&&w instanceof VideoFrame?(c.width=w.displayWidth,c.height=w.displayHeight):(c.width=w.width,c.height=w.height),c}this.allocateTextureUnit=z,this.resetTextureUnits=G,this.setTexture2D=Q,this.setTexture2DArray=W,this.setTexture3D=it,this.setTextureCube=B,this.rebindTextures=at,this.setupRenderTarget=Rt,this.updateRenderTargetMipmap=Ft,this.updateMultisampleRenderTarget=he,this.setupDepthRenderbuffer=Ot,this.setupFrameBufferTexture=xt,this.useMultisampledRTT=Xt}function sg(i,t){function e(n,s=$n){let r,a=Jt.getTransfer(s);if(n===Dn)return i.UNSIGNED_BYTE;if(n===Hl)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Vl)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Uh)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Lh)return i.BYTE;if(n===Dh)return i.SHORT;if(n===Ns)return i.UNSIGNED_SHORT;if(n===zl)return i.INT;if(n===vi)return i.UNSIGNED_INT;if(n===pn)return i.FLOAT;if(n===Ze)return i.HALF_FLOAT;if(n===Nh)return i.ALPHA;if(n===Fh)return i.RGB;if(n===an)return i.RGBA;if(n===Bh)return i.LUMINANCE;if(n===Oh)return i.LUMINANCE_ALPHA;if(n===Xi)return i.DEPTH_COMPONENT;if(n===Qi)return i.DEPTH_STENCIL;if(n===Gl)return i.RED;if(n===Wl)return i.RED_INTEGER;if(n===kh)return i.RG;if(n===Xl)return i.RG_INTEGER;if(n===ql)return i.RGBA_INTEGER;if(n===_r||n===vr||n===br||n===Mr)if(a===re)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===_r)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===vr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===br)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Mr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===_r)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===vr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===br)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Mr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Aa||n===Ca||n===Ra||n===Pa)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Aa)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Ca)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Ra)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Pa)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Ia||n===La||n===Da)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Ia||n===La)return a===re?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Da)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===Ua||n===Na||n===Fa||n===Ba||n===Oa||n===ka||n===za||n===Ha||n===Va||n===Ga||n===Wa||n===Xa||n===qa||n===$a)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Ua)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Na)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Fa)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Ba)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Oa)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===ka)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===za)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Ha)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Va)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Ga)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Wa)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Xa)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===qa)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===$a)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Sr||n===Ya||n===Za)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===Sr)return a===re?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Ya)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Za)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===zh||n===Ja||n===Ka||n===Qa)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===Sr)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Ja)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Ka)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Qa)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Ki?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}var fl=class extends Pe{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}},te=class extends De{constructor(){super(),this.isGroup=!0,this.type="Group"}},rg={type:"move"},Ds=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new te,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new te,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new R,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new R),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new te,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new R,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new R),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(let x of t.hand.values()){let m=e.getJointPose(x,n),p=this._getHandJoint(c,x);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}let h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),f=.02,g=.005;c.inputState.pinching&&d>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&d<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(rg)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let n=new te;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}},og=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,ag=`
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

}`,pl=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,n){if(this.texture===null){let s=new ze,r=t.properties.get(s);r.__webglTexture=e.texture,(e.depthNear!=n.depthNear||e.depthFar!=n.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=s}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,n=new ye({vertexShader:og,fragmentShader:ag,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new rt(new Ur(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},ml=class extends Jn{constructor(t,e){super();let n=this,s=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,f=null,g=null,x=new pl,m=e.getContextAttributes(),p=null,E=null,M=[],b=[],I=new Lt,T=null,A=new Pe;A.viewport=new ce;let N=new Pe;N.viewport=new ce;let S=[A,N],v=new fl,C=null,G=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let et=M[Y];return et===void 0&&(et=new Ds,M[Y]=et),et.getTargetRaySpace()},this.getControllerGrip=function(Y){let et=M[Y];return et===void 0&&(et=new Ds,M[Y]=et),et.getGripSpace()},this.getHand=function(Y){let et=M[Y];return et===void 0&&(et=new Ds,M[Y]=et),et.getHandSpace()};function z(Y){let et=b.indexOf(Y.inputSource);if(et===-1)return;let xt=M[et];xt!==void 0&&(xt.update(Y.inputSource,Y.frame,c||a),xt.dispatchEvent({type:Y.type,data:Y.inputSource}))}function $(){s.removeEventListener("select",z),s.removeEventListener("selectstart",z),s.removeEventListener("selectend",z),s.removeEventListener("squeeze",z),s.removeEventListener("squeezestart",z),s.removeEventListener("squeezeend",z),s.removeEventListener("end",$),s.removeEventListener("inputsourceschange",Q);for(let Y=0;Y<M.length;Y++){let et=b[Y];et!==null&&(b[Y]=null,M[Y].disconnect(et))}C=null,G=null,x.reset(),t.setRenderTarget(p),f=null,d=null,u=null,s=null,E=null,Yt.stop(),n.isPresenting=!1,t.setPixelRatio(T),t.setSize(I.width,I.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){r=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(Y){if(s=Y,s!==null){if(p=t.getRenderTarget(),s.addEventListener("select",z),s.addEventListener("selectstart",z),s.addEventListener("selectend",z),s.addEventListener("squeeze",z),s.addEventListener("squeezestart",z),s.addEventListener("squeezeend",z),s.addEventListener("end",$),s.addEventListener("inputsourceschange",Q),m.xrCompatible!==!0&&await e.makeXRCompatible(),T=t.getPixelRatio(),t.getSize(I),s.renderState.layers===void 0){let et={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,e,et),s.updateRenderState({baseLayer:f}),t.setPixelRatio(1),t.setSize(f.framebufferWidth,f.framebufferHeight,!1),E=new Ee(f.framebufferWidth,f.framebufferHeight,{format:an,type:Dn,colorSpace:t.outputColorSpace,stencilBuffer:m.stencil})}else{let et=null,xt=null,lt=null;m.depth&&(lt=m.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,et=m.stencil?Qi:Xi,xt=m.stencil?Ki:vi);let Ut={colorFormat:e.RGBA8,depthFormat:lt,scaleFactor:r};u=new XRWebGLBinding(s,e),d=u.createProjectionLayer(Ut),s.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),E=new Ee(d.textureWidth,d.textureHeight,{format:an,type:Dn,depthTexture:new Nr(d.textureWidth,d.textureHeight,xt,void 0,void 0,void 0,void 0,void 0,void 0,et),stencilBuffer:m.stencil,colorSpace:t.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}E.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),Yt.setContext(s),Yt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return x.getDepthTexture()};function Q(Y){for(let et=0;et<Y.removed.length;et++){let xt=Y.removed[et],lt=b.indexOf(xt);lt>=0&&(b[lt]=null,M[lt].disconnect(xt))}for(let et=0;et<Y.added.length;et++){let xt=Y.added[et],lt=b.indexOf(xt);if(lt===-1){for(let Ot=0;Ot<M.length;Ot++)if(Ot>=b.length){b.push(xt),lt=Ot;break}else if(b[Ot]===null){b[Ot]=xt,lt=Ot;break}if(lt===-1)break}let Ut=M[lt];Ut&&Ut.connect(xt)}}let W=new R,it=new R;function B(Y,et,xt){W.setFromMatrixPosition(et.matrixWorld),it.setFromMatrixPosition(xt.matrixWorld);let lt=W.distanceTo(it),Ut=et.projectionMatrix.elements,Ot=xt.projectionMatrix.elements,at=Ut[14]/(Ut[10]-1),Rt=Ut[14]/(Ut[10]+1),Ft=(Ut[9]+1)/Ut[5],Qt=(Ut[9]-1)/Ut[5],P=(Ut[8]-1)/Ut[0],he=(Ot[8]+1)/Ot[0],Ht=at*P,Xt=at*he,Pt=lt/(-P+he),Zt=Pt*-P;if(et.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(Zt),Y.translateZ(Pt),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),Ut[10]===-1)Y.projectionMatrix.copy(et.projectionMatrix),Y.projectionMatrixInverse.copy(et.projectionMatrixInverse);else{let Tt=at+Pt,w=Rt+Pt,y=Ht-Zt,F=Xt+(lt-Zt),X=Ft*Rt/w*Tt,J=Qt*Rt/w*Tt;Y.projectionMatrix.makePerspective(y,F,X,J,Tt,w),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function j(Y,et){et===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(et.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(s===null)return;let et=Y.near,xt=Y.far;x.texture!==null&&(x.depthNear>0&&(et=x.depthNear),x.depthFar>0&&(xt=x.depthFar)),v.near=N.near=A.near=et,v.far=N.far=A.far=xt,(C!==v.near||G!==v.far)&&(s.updateRenderState({depthNear:v.near,depthFar:v.far}),C=v.near,G=v.far),A.layers.mask=Y.layers.mask|2,N.layers.mask=Y.layers.mask|4,v.layers.mask=A.layers.mask|N.layers.mask;let lt=Y.parent,Ut=v.cameras;j(v,lt);for(let Ot=0;Ot<Ut.length;Ot++)j(Ut[Ot],lt);Ut.length===2?B(v,A,N):v.projectionMatrix.copy(A.projectionMatrix),nt(Y,v,lt)};function nt(Y,et,xt){xt===null?Y.matrix.copy(et.matrixWorld):(Y.matrix.copy(xt.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(et.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(et.projectionMatrix),Y.projectionMatrixInverse.copy(et.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=tl*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return v},this.getFoveation=function(){if(!(d===null&&f===null))return l},this.setFoveation=function(Y){l=Y,d!==null&&(d.fixedFoveation=Y),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=Y)},this.hasDepthSensing=function(){return x.texture!==null},this.getDepthSensingMesh=function(){return x.getMesh(v)};let ht=null;function It(Y,et){if(h=et.getViewerPose(c||a),g=et,h!==null){let xt=h.views;f!==null&&(t.setRenderTargetFramebuffer(E,f.framebuffer),t.setRenderTarget(E));let lt=!1;xt.length!==v.cameras.length&&(v.cameras.length=0,lt=!0);for(let Ot=0;Ot<xt.length;Ot++){let at=xt[Ot],Rt=null;if(f!==null)Rt=f.getViewport(at);else{let Qt=u.getViewSubImage(d,at);Rt=Qt.viewport,Ot===0&&(t.setRenderTargetTextures(E,Qt.colorTexture,d.ignoreDepthValues?void 0:Qt.depthStencilTexture),t.setRenderTarget(E))}let Ft=S[Ot];Ft===void 0&&(Ft=new Pe,Ft.layers.enable(Ot),Ft.viewport=new ce,S[Ot]=Ft),Ft.matrix.fromArray(at.transform.matrix),Ft.matrix.decompose(Ft.position,Ft.quaternion,Ft.scale),Ft.projectionMatrix.fromArray(at.projectionMatrix),Ft.projectionMatrixInverse.copy(Ft.projectionMatrix).invert(),Ft.viewport.set(Rt.x,Rt.y,Rt.width,Rt.height),Ot===0&&(v.matrix.copy(Ft.matrix),v.matrix.decompose(v.position,v.quaternion,v.scale)),lt===!0&&v.cameras.push(Ft)}let Ut=s.enabledFeatures;if(Ut&&Ut.includes("depth-sensing")){let Ot=u.getDepthInformation(xt[0]);Ot&&Ot.isValid&&Ot.texture&&x.init(t,Ot,s.renderState)}}for(let xt=0;xt<M.length;xt++){let lt=b[xt],Ut=M[xt];lt!==null&&Ut!==void 0&&Ut.update(lt,et,c||a)}ht&&ht(Y,et),et.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:et}),g=null}let Yt=new qh;Yt.setAnimationLoop(It),this.setAnimationLoop=function(Y){ht=Y},this.dispose=function(){}}},fi=new mn,lg=new oe;function cg(i,t){function e(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,Xh(i)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function s(m,p,E,M,b){p.isMeshBasicMaterial||p.isMeshLambertMaterial?r(m,p):p.isMeshToonMaterial?(r(m,p),u(m,p)):p.isMeshPhongMaterial?(r(m,p),h(m,p)):p.isMeshStandardMaterial?(r(m,p),d(m,p),p.isMeshPhysicalMaterial&&f(m,p,b)):p.isMeshMatcapMaterial?(r(m,p),g(m,p)):p.isMeshDepthMaterial?r(m,p):p.isMeshDistanceMaterial?(r(m,p),x(m,p)):p.isMeshNormalMaterial?r(m,p):p.isLineBasicMaterial?(a(m,p),p.isLineDashedMaterial&&o(m,p)):p.isPointsMaterial?l(m,p,E,M):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,e(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===Ie&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,e(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===Ie&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,e(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,e(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,e(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);let E=t.get(p),M=E.envMap,b=E.envMapRotation;M&&(m.envMap.value=M,fi.copy(b),fi.x*=-1,fi.y*=-1,fi.z*=-1,M.isCubeTexture&&M.isRenderTargetTexture===!1&&(fi.y*=-1,fi.z*=-1),m.envMapRotation.value.setFromMatrix4(lg.makeRotationFromEuler(fi)),m.flipEnvMap.value=M.isCubeTexture&&M.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,e(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,e(p.aoMap,m.aoMapTransform))}function a(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform))}function o(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,E,M){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*E,m.scale.value=M*.5,p.map&&(m.map.value=p.map,e(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function h(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function u(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function d(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,e(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,e(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function f(m,p,E){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,e(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,e(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,e(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,e(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,e(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Ie&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,e(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,e(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=E.texture,m.transmissionSamplerSize.value.set(E.width,E.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,e(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,e(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,e(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,e(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,e(p.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,p){p.matcap&&(m.matcap.value=p.matcap)}function x(m,p){let E=t.get(p).light;m.referencePosition.value.setFromMatrixPosition(E.matrixWorld),m.nearDistance.value=E.shadow.camera.near,m.farDistance.value=E.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function hg(i,t,e,n){let s={},r={},a=[],o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(E,M){let b=M.program;n.uniformBlockBinding(E,b)}function c(E,M){let b=s[E.id];b===void 0&&(g(E),b=h(E),s[E.id]=b,E.addEventListener("dispose",m));let I=M.program;n.updateUBOMapping(E,I);let T=t.render.frame;r[E.id]!==T&&(d(E),r[E.id]=T)}function h(E){let M=u();E.__bindingPointIndex=M;let b=i.createBuffer(),I=E.__size,T=E.usage;return i.bindBuffer(i.UNIFORM_BUFFER,b),i.bufferData(i.UNIFORM_BUFFER,I,T),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,M,b),b}function u(){for(let E=0;E<o;E++)if(a.indexOf(E)===-1)return a.push(E),E;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(E){let M=s[E.id],b=E.uniforms,I=E.__cache;i.bindBuffer(i.UNIFORM_BUFFER,M);for(let T=0,A=b.length;T<A;T++){let N=Array.isArray(b[T])?b[T]:[b[T]];for(let S=0,v=N.length;S<v;S++){let C=N[S];if(f(C,T,S,I)===!0){let G=C.__offset,z=Array.isArray(C.value)?C.value:[C.value],$=0;for(let Q=0;Q<z.length;Q++){let W=z[Q],it=x(W);typeof W=="number"||typeof W=="boolean"?(C.__data[0]=W,i.bufferSubData(i.UNIFORM_BUFFER,G+$,C.__data)):W.isMatrix3?(C.__data[0]=W.elements[0],C.__data[1]=W.elements[1],C.__data[2]=W.elements[2],C.__data[3]=0,C.__data[4]=W.elements[3],C.__data[5]=W.elements[4],C.__data[6]=W.elements[5],C.__data[7]=0,C.__data[8]=W.elements[6],C.__data[9]=W.elements[7],C.__data[10]=W.elements[8],C.__data[11]=0):(W.toArray(C.__data,$),$+=it.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,G,C.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(E,M,b,I){let T=E.value,A=M+"_"+b;if(I[A]===void 0)return typeof T=="number"||typeof T=="boolean"?I[A]=T:I[A]=T.clone(),!0;{let N=I[A];if(typeof T=="number"||typeof T=="boolean"){if(N!==T)return I[A]=T,!0}else if(N.equals(T)===!1)return N.copy(T),!0}return!1}function g(E){let M=E.uniforms,b=0,I=16;for(let A=0,N=M.length;A<N;A++){let S=Array.isArray(M[A])?M[A]:[M[A]];for(let v=0,C=S.length;v<C;v++){let G=S[v],z=Array.isArray(G.value)?G.value:[G.value];for(let $=0,Q=z.length;$<Q;$++){let W=z[$],it=x(W),B=b%I,j=B%it.boundary,nt=B+j;b+=j,nt!==0&&I-nt<it.storage&&(b+=I-nt),G.__data=new Float32Array(it.storage/Float32Array.BYTES_PER_ELEMENT),G.__offset=b,b+=it.storage}}}let T=b%I;return T>0&&(b+=I-T),E.__size=b,E.__cache={},this}function x(E){let M={boundary:0,storage:0};return typeof E=="number"||typeof E=="boolean"?(M.boundary=4,M.storage=4):E.isVector2?(M.boundary=8,M.storage=8):E.isVector3||E.isColor?(M.boundary=16,M.storage=12):E.isVector4?(M.boundary=16,M.storage=16):E.isMatrix3?(M.boundary=48,M.storage=48):E.isMatrix4?(M.boundary=64,M.storage=64):E.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",E),M}function m(E){let M=E.target;M.removeEventListener("dispose",m);let b=a.indexOf(M.__bindingPointIndex);a.splice(b,1),i.deleteBuffer(s[M.id]),delete s[M.id],delete r[M.id]}function p(){for(let E in s)i.deleteBuffer(s[E]);a=[],s={},r={}}return{bind:l,update:c,dispose:p}}var Fr=class{constructor(t={}){let{canvas:e=pd(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reverseDepthBuffer:d=!1}=t;this.isWebGLRenderer=!0;let f;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=n.getContextAttributes().alpha}else f=a;let g=new Uint32Array(4),x=new Int32Array(4),m=null,p=null,E=[],M=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Re,this.toneMapping=Yn,this.toneMappingExposure=1;let b=this,I=!1,T=0,A=0,N=null,S=-1,v=null,C=new ce,G=new ce,z=null,$=new Dt(0),Q=0,W=e.width,it=e.height,B=1,j=null,nt=null,ht=new ce(0,0,W,it),It=new ce(0,0,W,it),Yt=!1,Y=new Os,et=!1,xt=!1,lt=new oe,Ut=new oe,Ot=new R,at=new ce,Rt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Ft=!1;function Qt(){return N===null?B:1}let P=n;function he(_,D){return e.getContext(_,D)}try{let _={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Dl}`),e.addEventListener("webglcontextlost",K,!1),e.addEventListener("webglcontextrestored",gt,!1),e.addEventListener("webglcontextcreationerror",ft,!1),P===null){let D="webgl2";if(P=he(D,_),P===null)throw he(D)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(_){throw console.error("THREE.WebGLRenderer: "+_.message),_}let Ht,Xt,Pt,Zt,Tt,w,y,F,X,J,Z,At,dt,_t,jt,st,vt,Bt,kt,bt,Kt,qt,ue,L;function ut(){Ht=new Tm(P),Ht.init(),qt=new sg(P,Ht),Xt=new vm(P,Ht,t,qt),Pt=new eg(P,Ht),Xt.reverseDepthBuffer&&d&&Pt.buffers.depth.setReversed(!0),Zt=new Rm(P),Tt=new V0,w=new ig(P,Ht,Pt,Tt,Xt,qt,Zt),y=new Mm(b),F=new Em(b),X=new Nd(P),ue=new ym(P,X),J=new Am(P,X,Zt,ue),Z=new Im(P,J,X,Zt),kt=new Pm(P,Xt,w),st=new bm(Tt),At=new H0(b,y,F,Ht,Xt,ue,st),dt=new cg(b,Tt),_t=new W0,jt=new J0(Ht),Bt=new xm(b,y,F,Pt,Z,f,l),vt=new j0(b,Z,Xt),L=new hg(P,Zt,Xt,Pt),bt=new _m(P,Ht,Zt),Kt=new Cm(P,Ht,Zt),Zt.programs=At.programs,b.capabilities=Xt,b.extensions=Ht,b.properties=Tt,b.renderLists=_t,b.shadowMap=vt,b.state=Pt,b.info=Zt}ut();let q=new ml(b,P);this.xr=q,this.getContext=function(){return P},this.getContextAttributes=function(){return P.getContextAttributes()},this.forceContextLoss=function(){let _=Ht.get("WEBGL_lose_context");_&&_.loseContext()},this.forceContextRestore=function(){let _=Ht.get("WEBGL_lose_context");_&&_.restoreContext()},this.getPixelRatio=function(){return B},this.setPixelRatio=function(_){_!==void 0&&(B=_,this.setSize(W,it,!1))},this.getSize=function(_){return _.set(W,it)},this.setSize=function(_,D,H=!0){if(q.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}W=_,it=D,e.width=Math.floor(_*B),e.height=Math.floor(D*B),H===!0&&(e.style.width=_+"px",e.style.height=D+"px"),this.setViewport(0,0,_,D)},this.getDrawingBufferSize=function(_){return _.set(W*B,it*B).floor()},this.setDrawingBufferSize=function(_,D,H){W=_,it=D,B=H,e.width=Math.floor(_*H),e.height=Math.floor(D*H),this.setViewport(0,0,_,D)},this.getCurrentViewport=function(_){return _.copy(C)},this.getViewport=function(_){return _.copy(ht)},this.setViewport=function(_,D,H,V){_.isVector4?ht.set(_.x,_.y,_.z,_.w):ht.set(_,D,H,V),Pt.viewport(C.copy(ht).multiplyScalar(B).round())},this.getScissor=function(_){return _.copy(It)},this.setScissor=function(_,D,H,V){_.isVector4?It.set(_.x,_.y,_.z,_.w):It.set(_,D,H,V),Pt.scissor(G.copy(It).multiplyScalar(B).round())},this.getScissorTest=function(){return Yt},this.setScissorTest=function(_){Pt.setScissorTest(Yt=_)},this.setOpaqueSort=function(_){j=_},this.setTransparentSort=function(_){nt=_},this.getClearColor=function(_){return _.copy(Bt.getClearColor())},this.setClearColor=function(){Bt.setClearColor.apply(Bt,arguments)},this.getClearAlpha=function(){return Bt.getClearAlpha()},this.setClearAlpha=function(){Bt.setClearAlpha.apply(Bt,arguments)},this.clear=function(_=!0,D=!0,H=!0){let V=0;if(_){let U=!1;if(N!==null){let ot=N.texture.format;U=ot===ql||ot===Xl||ot===Wl}if(U){let ot=N.texture.type,pt=ot===Dn||ot===vi||ot===Ns||ot===Ki||ot===Hl||ot===Vl,St=Bt.getClearColor(),wt=Bt.getClearAlpha(),zt=St.r,Gt=St.g,Et=St.b;pt?(g[0]=zt,g[1]=Gt,g[2]=Et,g[3]=wt,P.clearBufferuiv(P.COLOR,0,g)):(x[0]=zt,x[1]=Gt,x[2]=Et,x[3]=wt,P.clearBufferiv(P.COLOR,0,x))}else V|=P.COLOR_BUFFER_BIT}D&&(V|=P.DEPTH_BUFFER_BIT),H&&(V|=P.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),P.clear(V)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",K,!1),e.removeEventListener("webglcontextrestored",gt,!1),e.removeEventListener("webglcontextcreationerror",ft,!1),_t.dispose(),jt.dispose(),Tt.dispose(),y.dispose(),F.dispose(),Z.dispose(),ue.dispose(),L.dispose(),At.dispose(),q.dispose(),q.removeEventListener("sessionstart",hc),q.removeEventListener("sessionend",uc),ai.stop()};function K(_){_.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),I=!0}function gt(){console.log("THREE.WebGLRenderer: Context Restored."),I=!1;let _=Zt.autoReset,D=vt.enabled,H=vt.autoUpdate,V=vt.needsUpdate,U=vt.type;ut(),Zt.autoReset=_,vt.enabled=D,vt.autoUpdate=H,vt.needsUpdate=V,vt.type=U}function ft(_){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",_.statusMessage)}function Vt(_){let D=_.target;D.removeEventListener("dispose",Vt),ge(D)}function ge(_){Te(_),Tt.remove(_)}function Te(_){let D=Tt.get(_).programs;D!==void 0&&(D.forEach(function(H){At.releaseProgram(H)}),_.isShaderMaterial&&At.releaseShaderCache(_))}this.renderBufferDirect=function(_,D,H,V,U,ot){D===null&&(D=Rt);let pt=U.isMesh&&U.matrixWorld.determinant()<0,St=Iu(_,D,H,V,U);Pt.setMaterial(V,pt);let wt=H.index,zt=1;if(V.wireframe===!0){if(wt=J.getWireframeAttribute(H),wt===void 0)return;zt=2}let Gt=H.drawRange,Et=H.attributes.position,ee=Gt.start*zt,de=(Gt.start+Gt.count)*zt;ot!==null&&(ee=Math.max(ee,ot.start*zt),de=Math.min(de,(ot.start+ot.count)*zt)),wt!==null?(ee=Math.max(ee,0),de=Math.min(de,wt.count)):Et!=null&&(ee=Math.max(ee,0),de=Math.min(de,Et.count));let fe=de-ee;if(fe<0||fe===1/0)return;ue.setup(U,V,St,H,wt);let Be,ie=bt;if(wt!==null&&(Be=X.get(wt),ie=Kt,ie.setIndex(Be)),U.isMesh)V.wireframe===!0?(Pt.setLineWidth(V.wireframeLinewidth*Qt()),ie.setMode(P.LINES)):ie.setMode(P.TRIANGLES);else if(U.isLine){let Ct=V.linewidth;Ct===void 0&&(Ct=1),Pt.setLineWidth(Ct*Qt()),U.isLineSegments?ie.setMode(P.LINES):U.isLineLoop?ie.setMode(P.LINE_LOOP):ie.setMode(P.LINE_STRIP)}else U.isPoints?ie.setMode(P.POINTS):U.isSprite&&ie.setMode(P.TRIANGLES);if(U.isBatchedMesh)if(U._multiDrawInstances!==null)ie.renderMultiDrawInstances(U._multiDrawStarts,U._multiDrawCounts,U._multiDrawCount,U._multiDrawInstances);else if(Ht.get("WEBGL_multi_draw"))ie.renderMultiDraw(U._multiDrawStarts,U._multiDrawCounts,U._multiDrawCount);else{let Ct=U._multiDrawStarts,Sn=U._multiDrawCounts,se=U._multiDrawCount,en=wt?X.get(wt).bytesPerElement:1,Ai=Tt.get(V).currentProgram.getUniforms();for(let We=0;We<se;We++)Ai.setValue(P,"_gl_DrawID",We),ie.render(Ct[We]/en,Sn[We])}else if(U.isInstancedMesh)ie.renderInstances(ee,fe,U.count);else if(H.isInstancedBufferGeometry){let Ct=H._maxInstanceCount!==void 0?H._maxInstanceCount:1/0,Sn=Math.min(H.instanceCount,Ct);ie.renderInstances(ee,fe,Sn)}else ie.render(ee,fe)};function le(_,D,H){_.transparent===!0&&_.side===Pn&&_.forceSinglePass===!1?(_.side=Ie,_.needsUpdate=!0,qs(_,D,H),_.side=Zn,_.needsUpdate=!0,qs(_,D,H),_.side=Pn):qs(_,D,H)}this.compile=function(_,D,H=null){H===null&&(H=_),p=jt.get(H),p.init(D),M.push(p),H.traverseVisible(function(U){U.isLight&&U.layers.test(D.layers)&&(p.pushLight(U),U.castShadow&&p.pushShadow(U))}),_!==H&&_.traverseVisible(function(U){U.isLight&&U.layers.test(D.layers)&&(p.pushLight(U),U.castShadow&&p.pushShadow(U))}),p.setupLights();let V=new Set;return _.traverse(function(U){if(!(U.isMesh||U.isPoints||U.isLine||U.isSprite))return;let ot=U.material;if(ot)if(Array.isArray(ot))for(let pt=0;pt<ot.length;pt++){let St=ot[pt];le(St,H,U),V.add(St)}else le(ot,H,U),V.add(ot)}),M.pop(),p=null,V},this.compileAsync=function(_,D,H=null){let V=this.compile(_,D,H);return new Promise(U=>{function ot(){if(V.forEach(function(pt){Tt.get(pt).currentProgram.isReady()&&V.delete(pt)}),V.size===0){U(_);return}setTimeout(ot,10)}Ht.get("KHR_parallel_shader_compile")!==null?ot():setTimeout(ot,10)})};let tn=null;function Mn(_){tn&&tn(_)}function hc(){ai.stop()}function uc(){ai.start()}let ai=new qh;ai.setAnimationLoop(Mn),typeof self<"u"&&ai.setContext(self),this.setAnimationLoop=function(_){tn=_,q.setAnimationLoop(_),_===null?ai.stop():ai.start()},q.addEventListener("sessionstart",hc),q.addEventListener("sessionend",uc),this.render=function(_,D){if(D!==void 0&&D.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(I===!0)return;if(_.matrixWorldAutoUpdate===!0&&_.updateMatrixWorld(),D.parent===null&&D.matrixWorldAutoUpdate===!0&&D.updateMatrixWorld(),q.enabled===!0&&q.isPresenting===!0&&(q.cameraAutoUpdate===!0&&q.updateCamera(D),D=q.getCamera()),_.isScene===!0&&_.onBeforeRender(b,_,D,N),p=jt.get(_,M.length),p.init(D),M.push(p),Ut.multiplyMatrices(D.projectionMatrix,D.matrixWorldInverse),Y.setFromProjectionMatrix(Ut),xt=this.localClippingEnabled,et=st.init(this.clippingPlanes,xt),m=_t.get(_,E.length),m.init(),E.push(m),q.enabled===!0&&q.isPresenting===!0){let ot=b.xr.getDepthSensingMesh();ot!==null&&Lo(ot,D,-1/0,b.sortObjects)}Lo(_,D,0,b.sortObjects),m.finish(),b.sortObjects===!0&&m.sort(j,nt),Ft=q.enabled===!1||q.isPresenting===!1||q.hasDepthSensing()===!1,Ft&&Bt.addToRenderList(m,_),this.info.render.frame++,et===!0&&st.beginShadows();let H=p.state.shadowsArray;vt.render(H,_,D),et===!0&&st.endShadows(),this.info.autoReset===!0&&this.info.reset();let V=m.opaque,U=m.transmissive;if(p.setupLights(),D.isArrayCamera){let ot=D.cameras;if(U.length>0)for(let pt=0,St=ot.length;pt<St;pt++){let wt=ot[pt];fc(V,U,_,wt)}Ft&&Bt.render(_);for(let pt=0,St=ot.length;pt<St;pt++){let wt=ot[pt];dc(m,_,wt,wt.viewport)}}else U.length>0&&fc(V,U,_,D),Ft&&Bt.render(_),dc(m,_,D);N!==null&&(w.updateMultisampleRenderTarget(N),w.updateRenderTargetMipmap(N)),_.isScene===!0&&_.onAfterRender(b,_,D),ue.resetDefaultState(),S=-1,v=null,M.pop(),M.length>0?(p=M[M.length-1],et===!0&&st.setGlobalState(b.clippingPlanes,p.state.camera)):p=null,E.pop(),E.length>0?m=E[E.length-1]:m=null};function Lo(_,D,H,V){if(_.visible===!1)return;if(_.layers.test(D.layers)){if(_.isGroup)H=_.renderOrder;else if(_.isLOD)_.autoUpdate===!0&&_.update(D);else if(_.isLight)p.pushLight(_),_.castShadow&&p.pushShadow(_);else if(_.isSprite){if(!_.frustumCulled||Y.intersectsSprite(_)){V&&at.setFromMatrixPosition(_.matrixWorld).applyMatrix4(Ut);let pt=Z.update(_),St=_.material;St.visible&&m.push(_,pt,St,H,at.z,null)}}else if((_.isMesh||_.isLine||_.isPoints)&&(!_.frustumCulled||Y.intersectsObject(_))){let pt=Z.update(_),St=_.material;if(V&&(_.boundingSphere!==void 0?(_.boundingSphere===null&&_.computeBoundingSphere(),at.copy(_.boundingSphere.center)):(pt.boundingSphere===null&&pt.computeBoundingSphere(),at.copy(pt.boundingSphere.center)),at.applyMatrix4(_.matrixWorld).applyMatrix4(Ut)),Array.isArray(St)){let wt=pt.groups;for(let zt=0,Gt=wt.length;zt<Gt;zt++){let Et=wt[zt],ee=St[Et.materialIndex];ee&&ee.visible&&m.push(_,pt,ee,H,at.z,Et)}}else St.visible&&m.push(_,pt,St,H,at.z,null)}}let ot=_.children;for(let pt=0,St=ot.length;pt<St;pt++)Lo(ot[pt],D,H,V)}function dc(_,D,H,V){let U=_.opaque,ot=_.transmissive,pt=_.transparent;p.setupLightsView(H),et===!0&&st.setGlobalState(b.clippingPlanes,H),V&&Pt.viewport(C.copy(V)),U.length>0&&Xs(U,D,H),ot.length>0&&Xs(ot,D,H),pt.length>0&&Xs(pt,D,H),Pt.buffers.depth.setTest(!0),Pt.buffers.depth.setMask(!0),Pt.buffers.color.setMask(!0),Pt.setPolygonOffset(!1)}function fc(_,D,H,V){if((H.isScene===!0?H.overrideMaterial:null)!==null)return;p.state.transmissionRenderTarget[V.id]===void 0&&(p.state.transmissionRenderTarget[V.id]=new Ee(1,1,{generateMipmaps:!0,type:Ht.has("EXT_color_buffer_half_float")||Ht.has("EXT_color_buffer_float")?Ze:Dn,minFilter:_i,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Jt.workingColorSpace}));let ot=p.state.transmissionRenderTarget[V.id],pt=V.viewport||C;ot.setSize(pt.z,pt.w);let St=b.getRenderTarget();b.setRenderTarget(ot),b.getClearColor($),Q=b.getClearAlpha(),Q<1&&b.setClearColor(16777215,.5),b.clear(),Ft&&Bt.render(H);let wt=b.toneMapping;b.toneMapping=Yn;let zt=V.viewport;if(V.viewport!==void 0&&(V.viewport=void 0),p.setupLightsView(V),et===!0&&st.setGlobalState(b.clippingPlanes,V),Xs(_,H,V),w.updateMultisampleRenderTarget(ot),w.updateRenderTargetMipmap(ot),Ht.has("WEBGL_multisampled_render_to_texture")===!1){let Gt=!1;for(let Et=0,ee=D.length;Et<ee;Et++){let de=D[Et],fe=de.object,Be=de.geometry,ie=de.material,Ct=de.group;if(ie.side===Pn&&fe.layers.test(V.layers)){let Sn=ie.side;ie.side=Ie,ie.needsUpdate=!0,pc(fe,H,V,Be,ie,Ct),ie.side=Sn,ie.needsUpdate=!0,Gt=!0}}Gt===!0&&(w.updateMultisampleRenderTarget(ot),w.updateRenderTargetMipmap(ot))}b.setRenderTarget(St),b.setClearColor($,Q),zt!==void 0&&(V.viewport=zt),b.toneMapping=wt}function Xs(_,D,H){let V=D.isScene===!0?D.overrideMaterial:null;for(let U=0,ot=_.length;U<ot;U++){let pt=_[U],St=pt.object,wt=pt.geometry,zt=V===null?pt.material:V,Gt=pt.group;St.layers.test(H.layers)&&pc(St,D,H,wt,zt,Gt)}}function pc(_,D,H,V,U,ot){_.onBeforeRender(b,D,H,V,U,ot),_.modelViewMatrix.multiplyMatrices(H.matrixWorldInverse,_.matrixWorld),_.normalMatrix.getNormalMatrix(_.modelViewMatrix),U.onBeforeRender(b,D,H,V,_,ot),U.transparent===!0&&U.side===Pn&&U.forceSinglePass===!1?(U.side=Ie,U.needsUpdate=!0,b.renderBufferDirect(H,D,V,U,_,ot),U.side=Zn,U.needsUpdate=!0,b.renderBufferDirect(H,D,V,U,_,ot),U.side=Pn):b.renderBufferDirect(H,D,V,U,_,ot),_.onAfterRender(b,D,H,V,U,ot)}function qs(_,D,H){D.isScene!==!0&&(D=Rt);let V=Tt.get(_),U=p.state.lights,ot=p.state.shadowsArray,pt=U.state.version,St=At.getParameters(_,U.state,ot,D,H),wt=At.getProgramCacheKey(St),zt=V.programs;V.environment=_.isMeshStandardMaterial?D.environment:null,V.fog=D.fog,V.envMap=(_.isMeshStandardMaterial?F:y).get(_.envMap||V.environment),V.envMapRotation=V.environment!==null&&_.envMap===null?D.environmentRotation:_.envMapRotation,zt===void 0&&(_.addEventListener("dispose",Vt),zt=new Map,V.programs=zt);let Gt=zt.get(wt);if(Gt!==void 0){if(V.currentProgram===Gt&&V.lightsStateVersion===pt)return gc(_,St),Gt}else St.uniforms=At.getUniforms(_),_.onBeforeCompile(St,b),Gt=At.acquireProgram(St,wt),zt.set(wt,Gt),V.uniforms=St.uniforms;let Et=V.uniforms;return(!_.isShaderMaterial&&!_.isRawShaderMaterial||_.clipping===!0)&&(Et.clippingPlanes=st.uniform),gc(_,St),V.needsLights=Du(_),V.lightsStateVersion=pt,V.needsLights&&(Et.ambientLightColor.value=U.state.ambient,Et.lightProbe.value=U.state.probe,Et.directionalLights.value=U.state.directional,Et.directionalLightShadows.value=U.state.directionalShadow,Et.spotLights.value=U.state.spot,Et.spotLightShadows.value=U.state.spotShadow,Et.rectAreaLights.value=U.state.rectArea,Et.ltc_1.value=U.state.rectAreaLTC1,Et.ltc_2.value=U.state.rectAreaLTC2,Et.pointLights.value=U.state.point,Et.pointLightShadows.value=U.state.pointShadow,Et.hemisphereLights.value=U.state.hemi,Et.directionalShadowMap.value=U.state.directionalShadowMap,Et.directionalShadowMatrix.value=U.state.directionalShadowMatrix,Et.spotShadowMap.value=U.state.spotShadowMap,Et.spotLightMatrix.value=U.state.spotLightMatrix,Et.spotLightMap.value=U.state.spotLightMap,Et.pointShadowMap.value=U.state.pointShadowMap,Et.pointShadowMatrix.value=U.state.pointShadowMatrix),V.currentProgram=Gt,V.uniformsList=null,Gt}function mc(_){if(_.uniformsList===null){let D=_.currentProgram.getUniforms();_.uniformsList=$i.seqWithValue(D.seq,_.uniforms)}return _.uniformsList}function gc(_,D){let H=Tt.get(_);H.outputColorSpace=D.outputColorSpace,H.batching=D.batching,H.batchingColor=D.batchingColor,H.instancing=D.instancing,H.instancingColor=D.instancingColor,H.instancingMorph=D.instancingMorph,H.skinning=D.skinning,H.morphTargets=D.morphTargets,H.morphNormals=D.morphNormals,H.morphColors=D.morphColors,H.morphTargetsCount=D.morphTargetsCount,H.numClippingPlanes=D.numClippingPlanes,H.numIntersection=D.numClipIntersection,H.vertexAlphas=D.vertexAlphas,H.vertexTangents=D.vertexTangents,H.toneMapping=D.toneMapping}function Iu(_,D,H,V,U){D.isScene!==!0&&(D=Rt),w.resetTextureUnits();let ot=D.fog,pt=V.isMeshStandardMaterial?D.environment:null,St=N===null?b.outputColorSpace:N.isXRRenderTarget===!0?N.texture.colorSpace:ls,wt=(V.isMeshStandardMaterial?F:y).get(V.envMap||pt),zt=V.vertexColors===!0&&!!H.attributes.color&&H.attributes.color.itemSize===4,Gt=!!H.attributes.tangent&&(!!V.normalMap||V.anisotropy>0),Et=!!H.morphAttributes.position,ee=!!H.morphAttributes.normal,de=!!H.morphAttributes.color,fe=Yn;V.toneMapped&&(N===null||N.isXRRenderTarget===!0)&&(fe=b.toneMapping);let Be=H.morphAttributes.position||H.morphAttributes.normal||H.morphAttributes.color,ie=Be!==void 0?Be.length:0,Ct=Tt.get(V),Sn=p.state.lights;if(et===!0&&(xt===!0||_!==v)){let Je=_===v&&V.id===S;st.setState(V,_,Je)}let se=!1;V.version===Ct.__version?(Ct.needsLights&&Ct.lightsStateVersion!==Sn.state.version||Ct.outputColorSpace!==St||U.isBatchedMesh&&Ct.batching===!1||!U.isBatchedMesh&&Ct.batching===!0||U.isBatchedMesh&&Ct.batchingColor===!0&&U.colorTexture===null||U.isBatchedMesh&&Ct.batchingColor===!1&&U.colorTexture!==null||U.isInstancedMesh&&Ct.instancing===!1||!U.isInstancedMesh&&Ct.instancing===!0||U.isSkinnedMesh&&Ct.skinning===!1||!U.isSkinnedMesh&&Ct.skinning===!0||U.isInstancedMesh&&Ct.instancingColor===!0&&U.instanceColor===null||U.isInstancedMesh&&Ct.instancingColor===!1&&U.instanceColor!==null||U.isInstancedMesh&&Ct.instancingMorph===!0&&U.morphTexture===null||U.isInstancedMesh&&Ct.instancingMorph===!1&&U.morphTexture!==null||Ct.envMap!==wt||V.fog===!0&&Ct.fog!==ot||Ct.numClippingPlanes!==void 0&&(Ct.numClippingPlanes!==st.numPlanes||Ct.numIntersection!==st.numIntersection)||Ct.vertexAlphas!==zt||Ct.vertexTangents!==Gt||Ct.morphTargets!==Et||Ct.morphNormals!==ee||Ct.morphColors!==de||Ct.toneMapping!==fe||Ct.morphTargetsCount!==ie)&&(se=!0):(se=!0,Ct.__version=V.version);let en=Ct.currentProgram;se===!0&&(en=qs(V,D,U));let Ai=!1,We=!1,vs=!1,pe=en.getUniforms(),un=Ct.uniforms;if(Pt.useProgram(en.program)&&(Ai=!0,We=!0,vs=!0),V.id!==S&&(S=V.id,We=!0),Ai||v!==_){Pt.buffers.depth.getReversed()?(lt.copy(_.projectionMatrix),gd(lt),xd(lt),pe.setValue(P,"projectionMatrix",lt)):pe.setValue(P,"projectionMatrix",_.projectionMatrix),pe.setValue(P,"viewMatrix",_.matrixWorldInverse);let kn=pe.map.cameraPosition;kn!==void 0&&kn.setValue(P,Ot.setFromMatrixPosition(_.matrixWorld)),Xt.logarithmicDepthBuffer&&pe.setValue(P,"logDepthBufFC",2/(Math.log(_.far+1)/Math.LN2)),(V.isMeshPhongMaterial||V.isMeshToonMaterial||V.isMeshLambertMaterial||V.isMeshBasicMaterial||V.isMeshStandardMaterial||V.isShaderMaterial)&&pe.setValue(P,"isOrthographic",_.isOrthographicCamera===!0),v!==_&&(v=_,We=!0,vs=!0)}if(U.isSkinnedMesh){pe.setOptional(P,U,"bindMatrix"),pe.setOptional(P,U,"bindMatrixInverse");let Je=U.skeleton;Je&&(Je.boneTexture===null&&Je.computeBoneTexture(),pe.setValue(P,"boneTexture",Je.boneTexture,w))}U.isBatchedMesh&&(pe.setOptional(P,U,"batchingTexture"),pe.setValue(P,"batchingTexture",U._matricesTexture,w),pe.setOptional(P,U,"batchingIdTexture"),pe.setValue(P,"batchingIdTexture",U._indirectTexture,w),pe.setOptional(P,U,"batchingColorTexture"),U._colorsTexture!==null&&pe.setValue(P,"batchingColorTexture",U._colorsTexture,w));let bs=H.morphAttributes;if((bs.position!==void 0||bs.normal!==void 0||bs.color!==void 0)&&kt.update(U,H,en),(We||Ct.receiveShadow!==U.receiveShadow)&&(Ct.receiveShadow=U.receiveShadow,pe.setValue(P,"receiveShadow",U.receiveShadow)),V.isMeshGouraudMaterial&&V.envMap!==null&&(un.envMap.value=wt,un.flipEnvMap.value=wt.isCubeTexture&&wt.isRenderTargetTexture===!1?-1:1),V.isMeshStandardMaterial&&V.envMap===null&&D.environment!==null&&(un.envMapIntensity.value=D.environmentIntensity),We&&(pe.setValue(P,"toneMappingExposure",b.toneMappingExposure),Ct.needsLights&&Lu(un,vs),ot&&V.fog===!0&&dt.refreshFogUniforms(un,ot),dt.refreshMaterialUniforms(un,V,B,it,p.state.transmissionRenderTarget[_.id]),$i.upload(P,mc(Ct),un,w)),V.isShaderMaterial&&V.uniformsNeedUpdate===!0&&($i.upload(P,mc(Ct),un,w),V.uniformsNeedUpdate=!1),V.isSpriteMaterial&&pe.setValue(P,"center",U.center),pe.setValue(P,"modelViewMatrix",U.modelViewMatrix),pe.setValue(P,"normalMatrix",U.normalMatrix),pe.setValue(P,"modelMatrix",U.matrixWorld),V.isShaderMaterial||V.isRawShaderMaterial){let Je=V.uniformsGroups;for(let kn=0,zn=Je.length;kn<zn;kn++){let xc=Je[kn];L.update(xc,en),L.bind(xc,en)}}return en}function Lu(_,D){_.ambientLightColor.needsUpdate=D,_.lightProbe.needsUpdate=D,_.directionalLights.needsUpdate=D,_.directionalLightShadows.needsUpdate=D,_.pointLights.needsUpdate=D,_.pointLightShadows.needsUpdate=D,_.spotLights.needsUpdate=D,_.spotLightShadows.needsUpdate=D,_.rectAreaLights.needsUpdate=D,_.hemisphereLights.needsUpdate=D}function Du(_){return _.isMeshLambertMaterial||_.isMeshToonMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isShadowMaterial||_.isShaderMaterial&&_.lights===!0}this.getActiveCubeFace=function(){return T},this.getActiveMipmapLevel=function(){return A},this.getRenderTarget=function(){return N},this.setRenderTargetTextures=function(_,D,H){Tt.get(_.texture).__webglTexture=D,Tt.get(_.depthTexture).__webglTexture=H;let V=Tt.get(_);V.__hasExternalTextures=!0,V.__autoAllocateDepthBuffer=H===void 0,V.__autoAllocateDepthBuffer||Ht.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),V.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(_,D){let H=Tt.get(_);H.__webglFramebuffer=D,H.__useDefaultFramebuffer=D===void 0},this.setRenderTarget=function(_,D=0,H=0){N=_,T=D,A=H;let V=!0,U=null,ot=!1,pt=!1;if(_){let wt=Tt.get(_);if(wt.__useDefaultFramebuffer!==void 0)Pt.bindFramebuffer(P.FRAMEBUFFER,null),V=!1;else if(wt.__webglFramebuffer===void 0)w.setupRenderTarget(_);else if(wt.__hasExternalTextures)w.rebindTextures(_,Tt.get(_.texture).__webglTexture,Tt.get(_.depthTexture).__webglTexture);else if(_.depthBuffer){let Et=_.depthTexture;if(wt.__boundDepthTexture!==Et){if(Et!==null&&Tt.has(Et)&&(_.width!==Et.image.width||_.height!==Et.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");w.setupDepthRenderbuffer(_)}}let zt=_.texture;(zt.isData3DTexture||zt.isDataArrayTexture||zt.isCompressedArrayTexture)&&(pt=!0);let Gt=Tt.get(_).__webglFramebuffer;_.isWebGLCubeRenderTarget?(Array.isArray(Gt[D])?U=Gt[D][H]:U=Gt[D],ot=!0):_.samples>0&&w.useMultisampledRTT(_)===!1?U=Tt.get(_).__webglMultisampledFramebuffer:Array.isArray(Gt)?U=Gt[H]:U=Gt,C.copy(_.viewport),G.copy(_.scissor),z=_.scissorTest}else C.copy(ht).multiplyScalar(B).floor(),G.copy(It).multiplyScalar(B).floor(),z=Yt;if(Pt.bindFramebuffer(P.FRAMEBUFFER,U)&&V&&Pt.drawBuffers(_,U),Pt.viewport(C),Pt.scissor(G),Pt.setScissorTest(z),ot){let wt=Tt.get(_.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_CUBE_MAP_POSITIVE_X+D,wt.__webglTexture,H)}else if(pt){let wt=Tt.get(_.texture),zt=D||0;P.framebufferTextureLayer(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,wt.__webglTexture,H||0,zt)}S=-1},this.readRenderTargetPixels=function(_,D,H,V,U,ot,pt){if(!(_&&_.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let St=Tt.get(_).__webglFramebuffer;if(_.isWebGLCubeRenderTarget&&pt!==void 0&&(St=St[pt]),St){Pt.bindFramebuffer(P.FRAMEBUFFER,St);try{let wt=_.texture,zt=wt.format,Gt=wt.type;if(!Xt.textureFormatReadable(zt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Xt.textureTypeReadable(Gt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}D>=0&&D<=_.width-V&&H>=0&&H<=_.height-U&&P.readPixels(D,H,V,U,qt.convert(zt),qt.convert(Gt),ot)}finally{let wt=N!==null?Tt.get(N).__webglFramebuffer:null;Pt.bindFramebuffer(P.FRAMEBUFFER,wt)}}},this.readRenderTargetPixelsAsync=async function(_,D,H,V,U,ot,pt){if(!(_&&_.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let St=Tt.get(_).__webglFramebuffer;if(_.isWebGLCubeRenderTarget&&pt!==void 0&&(St=St[pt]),St){let wt=_.texture,zt=wt.format,Gt=wt.type;if(!Xt.textureFormatReadable(zt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Xt.textureTypeReadable(Gt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(D>=0&&D<=_.width-V&&H>=0&&H<=_.height-U){Pt.bindFramebuffer(P.FRAMEBUFFER,St);let Et=P.createBuffer();P.bindBuffer(P.PIXEL_PACK_BUFFER,Et),P.bufferData(P.PIXEL_PACK_BUFFER,ot.byteLength,P.STREAM_READ),P.readPixels(D,H,V,U,qt.convert(zt),qt.convert(Gt),0);let ee=N!==null?Tt.get(N).__webglFramebuffer:null;Pt.bindFramebuffer(P.FRAMEBUFFER,ee);let de=P.fenceSync(P.SYNC_GPU_COMMANDS_COMPLETE,0);return P.flush(),await md(P,de,4),P.bindBuffer(P.PIXEL_PACK_BUFFER,Et),P.getBufferSubData(P.PIXEL_PACK_BUFFER,0,ot),P.deleteBuffer(Et),P.deleteSync(de),ot}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(_,D=null,H=0){_.isTexture!==!0&&(Is("WebGLRenderer: copyFramebufferToTexture function signature has changed."),D=arguments[0]||null,_=arguments[1]);let V=Math.pow(2,-H),U=Math.floor(_.image.width*V),ot=Math.floor(_.image.height*V),pt=D!==null?D.x:0,St=D!==null?D.y:0;w.setTexture2D(_,0),P.copyTexSubImage2D(P.TEXTURE_2D,H,0,0,pt,St,U,ot),Pt.unbindTexture()},this.copyTextureToTexture=function(_,D,H=null,V=null,U=0){_.isTexture!==!0&&(Is("WebGLRenderer: copyTextureToTexture function signature has changed."),V=arguments[0]||null,_=arguments[1],D=arguments[2],U=arguments[3]||0,H=null);let ot,pt,St,wt,zt,Gt,Et,ee,de,fe=_.isCompressedTexture?_.mipmaps[U]:_.image;H!==null?(ot=H.max.x-H.min.x,pt=H.max.y-H.min.y,St=H.isBox3?H.max.z-H.min.z:1,wt=H.min.x,zt=H.min.y,Gt=H.isBox3?H.min.z:0):(ot=fe.width,pt=fe.height,St=fe.depth||1,wt=0,zt=0,Gt=0),V!==null?(Et=V.x,ee=V.y,de=V.z):(Et=0,ee=0,de=0);let Be=qt.convert(D.format),ie=qt.convert(D.type),Ct;D.isData3DTexture?(w.setTexture3D(D,0),Ct=P.TEXTURE_3D):D.isDataArrayTexture||D.isCompressedArrayTexture?(w.setTexture2DArray(D,0),Ct=P.TEXTURE_2D_ARRAY):(w.setTexture2D(D,0),Ct=P.TEXTURE_2D),P.pixelStorei(P.UNPACK_FLIP_Y_WEBGL,D.flipY),P.pixelStorei(P.UNPACK_PREMULTIPLY_ALPHA_WEBGL,D.premultiplyAlpha),P.pixelStorei(P.UNPACK_ALIGNMENT,D.unpackAlignment);let Sn=P.getParameter(P.UNPACK_ROW_LENGTH),se=P.getParameter(P.UNPACK_IMAGE_HEIGHT),en=P.getParameter(P.UNPACK_SKIP_PIXELS),Ai=P.getParameter(P.UNPACK_SKIP_ROWS),We=P.getParameter(P.UNPACK_SKIP_IMAGES);P.pixelStorei(P.UNPACK_ROW_LENGTH,fe.width),P.pixelStorei(P.UNPACK_IMAGE_HEIGHT,fe.height),P.pixelStorei(P.UNPACK_SKIP_PIXELS,wt),P.pixelStorei(P.UNPACK_SKIP_ROWS,zt),P.pixelStorei(P.UNPACK_SKIP_IMAGES,Gt);let vs=_.isDataArrayTexture||_.isData3DTexture,pe=D.isDataArrayTexture||D.isData3DTexture;if(_.isRenderTargetTexture||_.isDepthTexture){let un=Tt.get(_),bs=Tt.get(D),Je=Tt.get(un.__renderTarget),kn=Tt.get(bs.__renderTarget);Pt.bindFramebuffer(P.READ_FRAMEBUFFER,Je.__webglFramebuffer),Pt.bindFramebuffer(P.DRAW_FRAMEBUFFER,kn.__webglFramebuffer);for(let zn=0;zn<St;zn++)vs&&P.framebufferTextureLayer(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,Tt.get(_).__webglTexture,U,Gt+zn),_.isDepthTexture?(pe&&P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,Tt.get(D).__webglTexture,U,de+zn),P.blitFramebuffer(wt,zt,ot,pt,Et,ee,ot,pt,P.DEPTH_BUFFER_BIT,P.NEAREST)):pe?P.copyTexSubImage3D(Ct,U,Et,ee,de+zn,wt,zt,ot,pt):P.copyTexSubImage2D(Ct,U,Et,ee,de+zn,wt,zt,ot,pt);Pt.bindFramebuffer(P.READ_FRAMEBUFFER,null),Pt.bindFramebuffer(P.DRAW_FRAMEBUFFER,null)}else pe?_.isDataTexture||_.isData3DTexture?P.texSubImage3D(Ct,U,Et,ee,de,ot,pt,St,Be,ie,fe.data):D.isCompressedArrayTexture?P.compressedTexSubImage3D(Ct,U,Et,ee,de,ot,pt,St,Be,fe.data):P.texSubImage3D(Ct,U,Et,ee,de,ot,pt,St,Be,ie,fe):_.isDataTexture?P.texSubImage2D(P.TEXTURE_2D,U,Et,ee,ot,pt,Be,ie,fe.data):_.isCompressedTexture?P.compressedTexSubImage2D(P.TEXTURE_2D,U,Et,ee,fe.width,fe.height,Be,fe.data):P.texSubImage2D(P.TEXTURE_2D,U,Et,ee,ot,pt,Be,ie,fe);P.pixelStorei(P.UNPACK_ROW_LENGTH,Sn),P.pixelStorei(P.UNPACK_IMAGE_HEIGHT,se),P.pixelStorei(P.UNPACK_SKIP_PIXELS,en),P.pixelStorei(P.UNPACK_SKIP_ROWS,Ai),P.pixelStorei(P.UNPACK_SKIP_IMAGES,We),U===0&&D.generateMipmaps&&P.generateMipmap(Ct),Pt.unbindTexture()},this.copyTextureToTexture3D=function(_,D,H=null,V=null,U=0){return _.isTexture!==!0&&(Is("WebGLRenderer: copyTextureToTexture3D function signature has changed."),H=arguments[0]||null,V=arguments[1]||null,_=arguments[2],D=arguments[3],U=arguments[4]||0),Is('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(_,D,H,V,U)},this.initRenderTarget=function(_){Tt.get(_).__webglFramebuffer===void 0&&w.setupRenderTarget(_)},this.initTexture=function(_){_.isCubeTexture?w.setTextureCube(_,0):_.isData3DTexture?w.setTexture3D(_,0):_.isDataArrayTexture||_.isCompressedArrayTexture?w.setTexture2DArray(_,0):w.setTexture2D(_,0),Pt.unbindTexture()},this.resetState=function(){T=0,A=0,N=null,Pt.reset(),ue.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return In}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorspace=Jt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Jt._getUnpackColorSpace()}},Br=class i{constructor(t,e=25e-5){this.isFogExp2=!0,this.name="",this.color=new Dt(t),this.density=e}clone(){return new i(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}};var ns=class extends De{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new mn,this.environmentIntensity=1,this.environmentRotation=new mn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}};var gl=class extends ze{constructor(t=null,e=1,n=1,s,r,a,o,l,c=Le,h=Le,u,d){super(null,a,o,l,c,h,s,r,u,d),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Or=class extends ke{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){let t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}},Vi=new oe,xh=new oe,pr=[],yh=new ln,ug=new oe,As=new rt,Cs=new Qn,Un=class extends rt{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new Or(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,ug)}computeBoundingBox(){let t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new ln),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Vi),yh.copy(t.boundingBox).applyMatrix4(Vi),this.boundingBox.union(yh)}computeBoundingSphere(){let t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new Qn),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Vi),Cs.copy(t.boundingSphere).applyMatrix4(Vi),this.boundingSphere.union(Cs)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){let n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,a=t*r+1;for(let o=0;o<n.length;o++)n[o]=s[a+o]}raycast(t,e){let n=this.matrixWorld,s=this.count;if(As.geometry=this.geometry,As.material=this.material,As.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Cs.copy(this.boundingSphere),Cs.applyMatrix4(n),t.ray.intersectsSphere(Cs)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,Vi),xh.multiplyMatrices(n,Vi),As.matrixWorld=xh,As.raycast(t,pr);for(let a=0,o=pr.length;a<o;a++){let l=pr[a];l.instanceId=r,l.object=this,e.push(l)}pr.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new Or(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){let n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new gl(new Float32Array(s*this.count),s,this.count,Gl,pn));let r=this.morphTexture.source.data.data,a=0;for(let c=0;c<n.length;c++)a+=n[c];let o=this.geometry.morphTargetsRelative?1:1-a,l=s*t;r[l]=o,r.set(n,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}};var kr=class extends jn{static get type(){return"LineBasicMaterial"}constructor(t){super(),this.isLineBasicMaterial=!0,this.color=new Dt(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}},zr=new R,Hr=new R,_h=new oe,Rs=new Fs,mr=new Qn,ca=new R,vh=new R,xl=class extends De{constructor(t=new Ye,e=new kr){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){let t=this.geometry;if(t.index===null){let e=t.attributes.position,n=[0];for(let s=1,r=e.count;s<r;s++)zr.fromBufferAttribute(e,s-1),Hr.fromBufferAttribute(e,s),n[s]=n[s-1],n[s]+=zr.distanceTo(Hr);t.setAttribute("lineDistance",new xe(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,e){let n=this.geometry,s=this.matrixWorld,r=t.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),mr.copy(n.boundingSphere),mr.applyMatrix4(s),mr.radius+=r,t.ray.intersectsSphere(mr)===!1)return;_h.copy(s).invert(),Rs.copy(t.ray).applyMatrix4(_h);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=n.index,d=n.attributes.position;if(h!==null){let f=Math.max(0,a.start),g=Math.min(h.count,a.start+a.count);for(let x=f,m=g-1;x<m;x+=c){let p=h.getX(x),E=h.getX(x+1),M=gr(this,t,Rs,l,p,E);M&&e.push(M)}if(this.isLineLoop){let x=h.getX(g-1),m=h.getX(f),p=gr(this,t,Rs,l,x,m);p&&e.push(p)}}else{let f=Math.max(0,a.start),g=Math.min(d.count,a.start+a.count);for(let x=f,m=g-1;x<m;x+=c){let p=gr(this,t,Rs,l,x,x+1);p&&e.push(p)}if(this.isLineLoop){let x=gr(this,t,Rs,l,g-1,f);x&&e.push(x)}}}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}};function gr(i,t,e,n,s,r){let a=i.geometry.attributes.position;if(zr.fromBufferAttribute(a,s),Hr.fromBufferAttribute(a,r),e.distanceSqToSegment(zr,Hr,ca,vh)>n)return;ca.applyMatrix4(i.matrixWorld);let l=t.ray.origin.distanceTo(ca);if(!(l<t.near||l>t.far))return{distance:l,point:vh.clone().applyMatrix4(i.matrixWorld),index:s,face:null,faceIndex:null,barycoord:null,object:i}}var bh=new R,Mh=new R,yl=class extends xl{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let t=this.geometry;if(t.index===null){let e=t.attributes.position,n=[];for(let s=0,r=e.count;s<r;s+=2)bh.fromBufferAttribute(e,s),Mh.fromBufferAttribute(e,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+bh.distanceTo(Mh);t.setAttribute("lineDistance",new xe(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var Vr=class extends ze{constructor(t,e,n,s,r,a,o,l,c){super(t,e,n,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}},_l=class{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){let n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],n,s=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)n=this.getPoint(a/t),r+=n.distanceTo(s),e.push(r),s=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){let n=this.getLengths(),s=0,r=n.length,a;e?a=e:a=t*n[r-1];let o=0,l=r-1,c;for(;o<=l;)if(s=Math.floor(o+(l-o)/2),c=n[s]-a,c<0)o=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===a)return s/(r-1);let h=n[s],d=n[s+1]-h,f=(a-h)/d;return(s+f)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);let a=this.getPoint(s),o=this.getPoint(r),l=e||(a.isVector2?new Lt:new R);return l.copy(o).sub(a).normalize(),l}getTangentAt(t,e){let n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e){let n=new R,s=[],r=[],a=[],o=new R,l=new oe;for(let f=0;f<=t;f++){let g=f/t;s[f]=this.getTangentAt(g,new R)}r[0]=new R,a[0]=new R;let c=Number.MAX_VALUE,h=Math.abs(s[0].x),u=Math.abs(s[0].y),d=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],o),a[0].crossVectors(s[0],r[0]);for(let f=1;f<=t;f++){if(r[f]=r[f-1].clone(),a[f]=a[f-1].clone(),o.crossVectors(s[f-1],s[f]),o.length()>Number.EPSILON){o.normalize();let g=Math.acos(Se(s[f-1].dot(s[f]),-1,1));r[f].applyMatrix4(l.makeRotationAxis(o,g))}a[f].crossVectors(s[f],r[f])}if(e===!0){let f=Math.acos(Se(r[0].dot(r[t]),-1,1));f/=t,s[0].dot(o.crossVectors(r[0],r[t]))>0&&(f=-f);for(let g=1;g<=t;g++)r[g].applyMatrix4(l.makeRotationAxis(s[g],f*g)),a[g].crossVectors(s[g],r[g])}return{tangents:s,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}};function Zl(){let i=0,t=0,e=0,n=0;function s(r,a,o,l){i=r,t=o,e=-3*r+3*a-2*o-l,n=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){s(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,u){let d=(a-r)/c-(o-r)/(c+h)+(o-a)/h,f=(o-a)/h-(l-a)/(h+u)+(l-o)/u;d*=h,f*=h,s(a,o,d,f)},calc:function(r){let a=r*r,o=a*r;return i+t*r+e*a+n*o}}}var xr=new R,ha=new Zl,ua=new Zl,da=new Zl,is=class extends _l{constructor(t=[],e=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=s}getPoint(t,e=new R){let n=e,s=this.points,r=s.length,a=(r-(this.closed?0:1))*t,o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=s[(o-1)%r]:(xr.subVectors(s[0],s[1]).add(s[0]),c=xr);let u=s[o%r],d=s[(o+1)%r];if(this.closed||o+2<r?h=s[(o+2)%r]:(xr.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=xr),this.curveType==="centripetal"||this.curveType==="chordal"){let f=this.curveType==="chordal"?.5:.25,g=Math.pow(c.distanceToSquared(u),f),x=Math.pow(u.distanceToSquared(d),f),m=Math.pow(d.distanceToSquared(h),f);x<1e-4&&(x=1),g<1e-4&&(g=x),m<1e-4&&(m=x),ha.initNonuniformCatmullRom(c.x,u.x,d.x,h.x,g,x,m),ua.initNonuniformCatmullRom(c.y,u.y,d.y,h.y,g,x,m),da.initNonuniformCatmullRom(c.z,u.z,d.z,h.z,g,x,m)}else this.curveType==="catmullrom"&&(ha.initCatmullRom(c.x,u.x,d.x,h.x,this.tension),ua.initCatmullRom(c.y,u.y,d.y,h.y,this.tension),da.initCatmullRom(c.z,u.z,d.z,h.z,this.tension));return n.set(ha.calc(l),ua.calc(l),da.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new R().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};var Nn=class i extends Ye{constructor(t=1,e=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};let c=this;s=Math.floor(s),r=Math.floor(r);let h=[],u=[],d=[],f=[],g=0,x=[],m=n/2,p=0;E(),a===!1&&(t>0&&M(!0),e>0&&M(!1)),this.setIndex(h),this.setAttribute("position",new xe(u,3)),this.setAttribute("normal",new xe(d,3)),this.setAttribute("uv",new xe(f,2));function E(){let b=new R,I=new R,T=0,A=(e-t)/n;for(let N=0;N<=r;N++){let S=[],v=N/r,C=v*(e-t)+t;for(let G=0;G<=s;G++){let z=G/s,$=z*l+o,Q=Math.sin($),W=Math.cos($);I.x=C*Q,I.y=-v*n+m,I.z=C*W,u.push(I.x,I.y,I.z),b.set(Q,A,W).normalize(),d.push(b.x,b.y,b.z),f.push(z,1-v),S.push(g++)}x.push(S)}for(let N=0;N<s;N++)for(let S=0;S<r;S++){let v=x[S][N],C=x[S+1][N],G=x[S+1][N+1],z=x[S][N+1];(t>0||S!==0)&&(h.push(v,C,z),T+=3),(e>0||S!==r-1)&&(h.push(C,G,z),T+=3)}c.addGroup(p,T,0),p+=T}function M(b){let I=g,T=new Lt,A=new R,N=0,S=b===!0?t:e,v=b===!0?1:-1;for(let G=1;G<=s;G++)u.push(0,m*v,0),d.push(0,v,0),f.push(.5,.5),g++;let C=g;for(let G=0;G<=s;G++){let $=G/s*l+o,Q=Math.cos($),W=Math.sin($);A.x=S*W,A.y=m*v,A.z=S*Q,u.push(A.x,A.y,A.z),d.push(0,v,0),T.x=Q*.5+.5,T.y=W*.5*v+.5,f.push(T.x,T.y),g++}for(let G=0;G<s;G++){let z=I+G,$=C+G;b===!0?h.push($,$+1,z):h.push($+1,$,z),N+=3}c.addGroup(p,N,b===!0?1:2),p+=N}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}};var ss=class i extends Ye{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));let l=Math.min(a+o,Math.PI),c=0,h=[],u=new R,d=new R,f=[],g=[],x=[],m=[];for(let p=0;p<=n;p++){let E=[],M=p/n,b=0;p===0&&a===0?b=.5/e:p===n&&l===Math.PI&&(b=-.5/e);for(let I=0;I<=e;I++){let T=I/e;u.x=-t*Math.cos(s+T*r)*Math.sin(a+M*o),u.y=t*Math.cos(a+M*o),u.z=t*Math.sin(s+T*r)*Math.sin(a+M*o),g.push(u.x,u.y,u.z),d.copy(u).normalize(),x.push(d.x,d.y,d.z),m.push(T+b,1-M),E.push(c++)}h.push(E)}for(let p=0;p<n;p++)for(let E=0;E<e;E++){let M=h[p][E+1],b=h[p][E],I=h[p+1][E],T=h[p+1][E+1];(p!==0||a>0)&&f.push(M,b,T),(p!==n-1||l<Math.PI)&&f.push(b,I,T)}this.setIndex(f),this.setAttribute("position",new xe(g,3)),this.setAttribute("normal",new xe(x,3)),this.setAttribute("uv",new xe(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};var Gr=class extends ye{static get type(){return"RawShaderMaterial"}constructor(t){super(t),this.isRawShaderMaterial=!0}},Ue=class extends jn{static get type(){return"MeshStandardMaterial"}constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new Dt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Dt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Hh,this.normalScale=new Lt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new mn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}},gn=class extends Ue{static get type(){return"MeshPhysicalMaterial"}constructor(t){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new Lt(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Se(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Dt(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Dt(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Dt(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(t)}get anisotropy(){return this._anisotropy}set anisotropy(t){this._anisotropy>0!=t>0&&this.version++,this._anisotropy=t}get clearcoat(){return this._clearcoat}set clearcoat(t){this._clearcoat>0!=t>0&&this.version++,this._clearcoat=t}get iridescence(){return this._iridescence}set iridescence(t){this._iridescence>0!=t>0&&this.version++,this._iridescence=t}get dispersion(){return this._dispersion}set dispersion(t){this._dispersion>0!=t>0&&this.version++,this._dispersion=t}get sheen(){return this._sheen}set sheen(t){this._sheen>0!=t>0&&this.version++,this._sheen=t}get transmission(){return this._transmission}set transmission(t){this._transmission>0!=t>0&&this.version++,this._transmission=t}copy(t){return super.copy(t),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=t.anisotropy,this.anisotropyRotation=t.anisotropyRotation,this.anisotropyMap=t.anisotropyMap,this.clearcoat=t.clearcoat,this.clearcoatMap=t.clearcoatMap,this.clearcoatRoughness=t.clearcoatRoughness,this.clearcoatRoughnessMap=t.clearcoatRoughnessMap,this.clearcoatNormalMap=t.clearcoatNormalMap,this.clearcoatNormalScale.copy(t.clearcoatNormalScale),this.dispersion=t.dispersion,this.ior=t.ior,this.iridescence=t.iridescence,this.iridescenceMap=t.iridescenceMap,this.iridescenceIOR=t.iridescenceIOR,this.iridescenceThicknessRange=[...t.iridescenceThicknessRange],this.iridescenceThicknessMap=t.iridescenceThicknessMap,this.sheen=t.sheen,this.sheenColor.copy(t.sheenColor),this.sheenColorMap=t.sheenColorMap,this.sheenRoughness=t.sheenRoughness,this.sheenRoughnessMap=t.sheenRoughnessMap,this.transmission=t.transmission,this.transmissionMap=t.transmissionMap,this.thickness=t.thickness,this.thicknessMap=t.thicknessMap,this.attenuationDistance=t.attenuationDistance,this.attenuationColor.copy(t.attenuationColor),this.specularIntensity=t.specularIntensity,this.specularIntensityMap=t.specularIntensityMap,this.specularColor.copy(t.specularColor),this.specularColorMap=t.specularColorMap,this}};function yr(i,t,e){return!i||!e&&i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}function dg(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}var rs=class{constructor(t,e,n,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,s=e[n],r=e[n-1];n:{t:{let a;e:{i:if(!(t<s)){for(let o=n+2;;){if(s===void 0){if(t<r)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=s,s=e[++n],t<s)break t}a=e.length;break e}if(!(t>=r)){let o=e[1];t<o&&(n=2,r=o);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(s=r,r=e[--n-1],t>=r)break t}a=n,n=0;break e}break n}for(;n<a;){let o=n+a>>>1;t<e[o]?a=o:n=o+1}if(s=e[n],r=e[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=t*s;for(let a=0;a!==s;++a)e[a]=n[r+a];return e}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},vl=class extends rs{constructor(t,e,n,s){super(t,e,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:bc,endingEnd:bc}}intervalChanged_(t,e,n){let s=this.parameterPositions,r=t-2,a=t+1,o=s[r],l=s[a];if(o===void 0)switch(this.getSettings_().endingStart){case Mc:r=t,o=2*e-n;break;case Sc:r=s.length-2,o=e+s[r]-s[r+1];break;default:r=t,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case Mc:a=t,l=2*n-e;break;case Sc:a=1,l=n+s[1]-s[0];break;default:a=t-1,l=e}let c=(n-e)*.5,h=this.valueSize;this._weightPrev=c/(e-o),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=a*h}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,g=(n-e)/(s-e),x=g*g,m=x*g,p=-d*m+2*d*x-d*g,E=(1+d)*m+(-1.5-2*d)*x+(-.5+d)*g+1,M=(-1-f)*m+(1.5+f)*x+.5*g,b=f*m-f*x;for(let I=0;I!==o;++I)r[I]=p*a[h+I]+E*a[c+I]+M*a[l+I]+b*a[u+I];return r}},bl=class extends rs{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=(n-e)/(s-e),u=1-h;for(let d=0;d!==o;++d)r[d]=a[c+d]*u+a[l+d]*h;return r}},Ml=class extends rs{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t){return this.copySampleValue_(t-1)}},cn=class{constructor(t,e,n,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=yr(e,this.TimeBufferType),this.values=yr(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:yr(t.times,Array),values:yr(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(n.interpolation=s)}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new Ml(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new bl(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new vl(this.times,this.values,this.getValueSize(),t)}setInterpolation(t){let e;switch(t){case Er:e=this.InterpolantFactoryMethodDiscrete;break;case ja:e=this.InterpolantFactoryMethodLinear;break;case Uo:e=this.InterpolantFactoryMethodSmooth;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Er;case this.InterpolantFactoryMethodLinear:return ja;case this.InterpolantFactoryMethodSmooth:return Uo}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]*=t}return this}trim(t,e){let n=this.times,s=n.length,r=0,a=s-1;for(;r!==s&&n[r]<t;)++r;for(;a!==-1&&n[a]>e;)--a;if(++a,r!==0||a!==s){r>=a&&(a=Math.max(a,1),r=a-1);let o=this.getValueSize();this.times=n.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,s=this.values,r=n.length;r===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),t=!1);let a=null;for(let o=0;o!==r;o++){let l=n[o];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,l),t=!1;break}if(a!==null&&a>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,l,a),t=!1;break}a=l}if(s!==void 0&&dg(s))for(let o=0,l=s.length;o!==l;++o){let c=s[o];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===Uo,r=t.length-1,a=1;for(let o=1;o<r;++o){let l=!1,c=t[o],h=t[o+1];if(c!==h&&(o!==1||c!==t[0]))if(s)l=!0;else{let u=o*n,d=u-n,f=u+n;for(let g=0;g!==n;++g){let x=e[u+g];if(x!==e[d+g]||x!==e[f+g]){l=!0;break}}}if(l){if(o!==a){t[a]=t[o];let u=o*n,d=a*n;for(let f=0;f!==n;++f)e[d+f]=e[u+f]}++a}}if(r>0){t[a]=t[r];for(let o=r*n,l=a*n,c=0;c!==n;++c)e[l+c]=e[o+c];++a}return a!==t.length?(this.times=t.slice(0,a),this.values=e.slice(0,a*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,s=new n(this.name,t,e);return s.createInterpolant=this.createInterpolant,s}};cn.prototype.TimeBufferType=Float32Array;cn.prototype.ValueBufferType=Float32Array;cn.prototype.DefaultInterpolation=ja;var bi=class extends cn{constructor(t,e,n){super(t,e,n)}};bi.prototype.ValueTypeName="bool";bi.prototype.ValueBufferType=Array;bi.prototype.DefaultInterpolation=Er;bi.prototype.InterpolantFactoryMethodLinear=void 0;bi.prototype.InterpolantFactoryMethodSmooth=void 0;var Sl=class extends cn{};Sl.prototype.ValueTypeName="color";var wl=class extends cn{};wl.prototype.ValueTypeName="number";var El=class extends rs{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-e)/(s-e),c=t*o;for(let h=c+o;c!==h;c+=4)Kn.slerpFlat(r,0,a,c-o,a,c,l);return r}},Wr=class extends cn{InterpolantFactoryMethodLinear(t){return new El(this.times,this.values,this.getValueSize(),t)}};Wr.prototype.ValueTypeName="quaternion";Wr.prototype.InterpolantFactoryMethodSmooth=void 0;var Mi=class extends cn{constructor(t,e,n){super(t,e,n)}};Mi.prototype.ValueTypeName="string";Mi.prototype.ValueBufferType=Array;Mi.prototype.DefaultInterpolation=Er;Mi.prototype.InterpolantFactoryMethodLinear=void 0;Mi.prototype.InterpolantFactoryMethodSmooth=void 0;var Tl=class extends cn{};Tl.prototype.ValueTypeName="vector";var Al=class{constructor(t,e,n){let s=this,r=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this.itemStart=function(h){o++,r===!1&&s.onStart!==void 0&&s.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,s.onProgress!==void 0&&s.onProgress(h,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,u){return c.push(h,u),this},this.removeHandler=function(h){let u=c.indexOf(h);return u!==-1&&c.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=c.length;u<d;u+=2){let f=c[u],g=c[u+1];if(f.global&&(f.lastIndex=0),f.test(h))return g}return null}}},fg=new Al,Cl=class{constructor(t){this.manager=t!==void 0?t:fg,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(t,e){let n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}};Cl.DEFAULT_MATERIAL_NAME="__DEFAULT";var os=class extends De{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Dt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}},Xr=class extends os{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(De.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Dt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}},fa=new oe,Sh=new R,wh=new R,qr=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Lt(512,512),this.map=null,this.mapPass=null,this.matrix=new oe,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Os,this._frameExtents=new Lt(1,1),this._viewportCount=1,this._viewports=[new ce(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera,n=this.matrix;Sh.setFromMatrixPosition(t.matrixWorld),e.position.copy(Sh),wh.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(wh),e.updateMatrixWorld(),fa.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(fa),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(fa)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}};var Eh=new oe,Ps=new R,pa=new R,Rl=class extends qr{constructor(){super(new Pe(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new Lt(4,2),this._viewportCount=6,this._viewports=[new ce(2,1,1,1),new ce(0,1,1,1),new ce(3,1,1,1),new ce(1,1,1,1),new ce(3,0,1,1),new ce(1,0,1,1)],this._cubeDirections=[new R(1,0,0),new R(-1,0,0),new R(0,0,1),new R(0,0,-1),new R(0,1,0),new R(0,-1,0)],this._cubeUps=[new R(0,1,0),new R(0,1,0),new R(0,1,0),new R(0,1,0),new R(0,0,1),new R(0,0,-1)]}updateMatrices(t,e=0){let n=this.camera,s=this.matrix,r=t.distance||n.far;r!==n.far&&(n.far=r,n.updateProjectionMatrix()),Ps.setFromMatrixPosition(t.matrixWorld),n.position.copy(Ps),pa.copy(n.position),pa.add(this._cubeDirections[e]),n.up.copy(this._cubeUps[e]),n.lookAt(pa),n.updateMatrixWorld(),s.makeTranslation(-Ps.x,-Ps.y,-Ps.z),Eh.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Eh)}},$r=class extends os{constructor(t,e,n=0,s=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new Rl}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}},Pl=class extends qr{constructor(){super(new ts(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},as=class extends os{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(De.DEFAULT_UP),this.updateMatrix(),this.target=new De,this.shadow=new Pl}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}},Yr=class extends os{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}};var Zr=class{constructor(t=!0){this.autoStart=t,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=Th(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let t=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){let e=Th();t=(e-this.oldTime)/1e3,this.oldTime=e,this.elapsedTime+=t}return t}};function Th(){return performance.now()}var Jl="\\[\\]\\.:\\/",pg=new RegExp("["+Jl+"]","g"),Kl="[^"+Jl+"]",mg="[^"+Jl.replace("\\.","")+"]",gg=/((?:WC+[\/:])*)/.source.replace("WC",Kl),xg=/(WCOD+)?/.source.replace("WCOD",mg),yg=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Kl),_g=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Kl),vg=new RegExp("^"+gg+xg+yg+_g+"$"),bg=["material","materials","bones","map"],Il=class{constructor(t,e,n){let s=n||me.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,s)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},me=class i{constructor(t,e,n){this.path=e,this.parsedPath=n||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,n):new i(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(pg,"")}static parseTrackName(t){let e=vg.exec(t);if(e===null)throw new Error("PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);bg.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(r){for(let a=0;a<r.length;a++){let o=r[a];if(o.name===e||o.uuid===e)return o;let l=n(o.children);if(l)return l}return null},s=n(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)t[e++]=n[s]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,s=e.propertyName,r=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=e.objectIndex;switch(n){case"materials":if(!t.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(c!==void 0){if(t[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let a=t[s];if(a===void 0){let c=e.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.needsUpdate!==void 0?o=this.Versioning.NeedsUpdate:t.matrixWorldNeedsUpdate!==void 0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};me.Composite=Il;me.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};me.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};me.prototype.GetterByBindingType=[me.prototype._getValue_direct,me.prototype._getValue_array,me.prototype._getValue_arrayElement,me.prototype._getValue_toArray];me.prototype.SetterByBindingTypeAndVersioning=[[me.prototype._setValue_direct,me.prototype._setValue_direct_setNeedsUpdate,me.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[me.prototype._setValue_array,me.prototype._setValue_array_setNeedsUpdate,me.prototype._setValue_array_setMatrixWorldNeedsUpdate],[me.prototype._setValue_arrayElement,me.prototype._setValue_arrayElement_setNeedsUpdate,me.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[me.prototype._setValue_fromArray,me.prototype._setValue_fromArray_setNeedsUpdate,me.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Gg=new Float32Array(1);var Ah=new oe,Jr=class{constructor(t,e,n=0,s=1/0){this.ray=new Fs(t,e),this.near=n,this.far=s,this.camera=null,this.layers=new Bs,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,(e.near+e.far)/(e.near-e.far)).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):console.error("THREE.Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return Ah.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Ah),this}intersectObject(t,e=!0,n=[]){return Ll(t,this,n,e),n.sort(Ch),n}intersectObjects(t,e=!0,n=[]){for(let s=0,r=t.length;s<r;s++)Ll(t[s],this,n,e);return n.sort(Ch),n}};function Ch(i,t){return i.distance-t.distance}function Ll(i,t,e,n){let s=!0;if(i.layers.test(t.layers)&&i.raycast(t,e)===!1&&(s=!1),s===!0&&n===!0){let r=i.children;for(let a=0,o=r.length;a<o;a++)Ll(r[a],t,e,!0)}}var Kr=class{constructor(t=1,e=0,n=0){return this.radius=t,this.phi=e,this.theta=n,this}set(t,e,n){return this.radius=t,this.phi=e,this.theta=n,this}copy(t){return this.radius=t.radius,this.phi=t.phi,this.theta=t.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(t){return this.setFromCartesianCoords(t.x,t.y,t.z)}setFromCartesianCoords(t,e,n){return this.radius=Math.sqrt(t*t+e*e+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(t,n),this.phi=Math.acos(Se(e/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var Qr=class extends yl{constructor(t,e=16776960){let n=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),s=[1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,1,-1,-1,1,-1,-1,-1,-1,1,-1,-1],r=new Ye;r.setIndex(new ke(n,1)),r.setAttribute("position",new xe(s,3)),super(r,new kr({color:e,toneMapped:!1})),this.box=t,this.type="Box3Helper",this.geometry.computeBoundingSphere()}updateMatrixWorld(t){let e=this.box;e.isEmpty()||(e.getCenter(this.position),e.getSize(this.scale),this.scale.multiplyScalar(.5),super.updateMatrixWorld(t))}dispose(){this.geometry.dispose(),this.material.dispose()}};typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Dl}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Dl);var io=class extends ns{constructor(){super();let t=new Mt;t.deleteAttribute("uv");let e=new Ue({side:Ie}),n=new Ue,s=new $r(16777215,900,28,2);s.position.set(.418,16.199,.3),this.add(s);let r=new rt(t,e);r.position.set(-.757,13.219,.717),r.scale.set(31.713,28.305,28.591),this.add(r);let a=new rt(t,n);a.position.set(-10.906,2.009,1.846),a.rotation.set(0,-.195,0),a.scale.set(2.328,7.905,4.651),this.add(a);let o=new rt(t,n);o.position.set(-5.607,-.754,-.758),o.rotation.set(0,.994,0),o.scale.set(1.97,1.534,3.955),this.add(o);let l=new rt(t,n);l.position.set(6.167,.857,7.803),l.rotation.set(0,.561,0),l.scale.set(3.927,6.285,3.687),this.add(l);let c=new rt(t,n);c.position.set(-2.017,.018,6.124),c.rotation.set(0,.333,0),c.scale.set(2.002,4.566,2.064),this.add(c);let h=new rt(t,n);h.position.set(2.291,-.756,-2.621),h.rotation.set(0,-.286,0),h.scale.set(1.546,1.552,1.496),this.add(h);let u=new rt(t,n);u.position.set(-2.193,-.369,-5.547),u.rotation.set(0,.516,0),u.scale.set(3.875,3.487,2.986),this.add(u);let d=new rt(t,hs(50));d.position.set(-16.116,14.37,8.208),d.scale.set(.1,2.428,2.739),this.add(d);let f=new rt(t,hs(50));f.position.set(-16.109,18.021,-8.207),f.scale.set(.1,2.425,2.751),this.add(f);let g=new rt(t,hs(17));g.position.set(14.904,12.198,-1.832),g.scale.set(.15,4.265,6.331),this.add(g);let x=new rt(t,hs(43));x.position.set(-.462,8.89,14.52),x.scale.set(4.38,5.441,.088),this.add(x);let m=new rt(t,hs(20));m.position.set(3.235,11.486,-12.541),m.scale.set(2.5,2,.1),this.add(m);let p=new rt(t,hs(100));p.position.set(0,20,0),p.scale.set(1,.1,1),this.add(p)}dispose(){let t=new Set;this.traverse(e=>{e.isMesh&&(t.add(e.geometry),t.add(e.material))});for(let e of t)e.dispose()}};function hs(i){let t=new $e;return t.color.setScalar(i),t}var so={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};var Fe=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},Mg=new ts(-1,1,1,-1,0,1),Ql=class extends Ye{constructor(){super(),this.setAttribute("position",new xe([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new xe([0,2,0,0,2,0],2))}},Sg=new Ql,yn=class{constructor(t){this._mesh=new rt(Sg,t)}dispose(){this._mesh.geometry.dispose()}render(t){t.render(this._mesh,Mg)}get material(){return this._mesh.material}set material(t){this._mesh.material=t}};var us=class extends Fe{constructor(t,e){super(),this.textureID=e!==void 0?e:"tDiffuse",t instanceof ye?(this.uniforms=t.uniforms,this.material=t):t&&(this.uniforms=xn.clone(t.uniforms),this.material=new ye({name:t.name!==void 0?t.name:"unspecified",defines:Object.assign({},t.defines),uniforms:this.uniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader})),this.fsQuad=new yn(this.material)}render(t,e,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this.fsQuad.material=this.material,this.renderToScreen?(t.setRenderTarget(null),this.fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this.fsQuad.render(t))}dispose(){this.material.dispose(),this.fsQuad.dispose()}};var Vs=class extends Fe{constructor(t,e){super(),this.scene=t,this.camera=e,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(t,e,n){let s=t.getContext(),r=t.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(s.REPLACE,s.REPLACE,s.REPLACE),r.buffers.stencil.setFunc(s.ALWAYS,a,4294967295),r.buffers.stencil.setClear(o),r.buffers.stencil.setLocked(!0),t.setRenderTarget(n),this.clear&&t.clear(),t.render(this.scene,this.camera),t.setRenderTarget(e),this.clear&&t.clear(),t.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(s.EQUAL,1,4294967295),r.buffers.stencil.setOp(s.KEEP,s.KEEP,s.KEEP),r.buffers.stencil.setLocked(!0)}},ro=class extends Fe{constructor(){super(),this.needsSwap=!1}render(t){t.state.buffers.stencil.setLocked(!1),t.state.buffers.stencil.setTest(!1)}};var oo=class{constructor(t,e){if(this.renderer=t,this._pixelRatio=t.getPixelRatio(),e===void 0){let n=t.getSize(new Lt);this._width=n.width,this._height=n.height,e=new Ee(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:Ze}),e.texture.name="EffectComposer.rt1"}else this._width=e.width,this._height=e.height;this.renderTarget1=e,this.renderTarget2=e.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new us(so),this.copyPass.material.blending=Qe,this.clock=new Zr}swapBuffers(){let t=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=t}addPass(t){this.passes.push(t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(t,e){this.passes.splice(e,0,t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(t){let e=this.passes.indexOf(t);e!==-1&&this.passes.splice(e,1)}isLastEnabledPass(t){for(let e=t+1;e<this.passes.length;e++)if(this.passes[e].enabled)return!1;return!0}render(t){t===void 0&&(t=this.clock.getDelta());let e=this.renderer.getRenderTarget(),n=!1;for(let s=0,r=this.passes.length;s<r;s++){let a=this.passes[s];if(a.enabled!==!1){if(a.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(s),a.render(this.renderer,this.writeBuffer,this.readBuffer,t,n),a.needsSwap){if(n){let o=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,t),l.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}Vs!==void 0&&(a instanceof Vs?n=!0:a instanceof ro&&(n=!1))}}this.renderer.setRenderTarget(e)}reset(t){if(t===void 0){let e=this.renderer.getSize(new Lt);this._pixelRatio=this.renderer.getPixelRatio(),this._width=e.width,this._height=e.height,t=this.renderTarget1.clone(),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=t,this.renderTarget2=t.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(t,e){this._width=t,this._height=e;let n=this._width*this._pixelRatio,s=this._height*this._pixelRatio;this.renderTarget1.setSize(n,s),this.renderTarget2.setSize(n,s);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(n,s)}setPixelRatio(t){this._pixelRatio=t,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}};var ao=class extends Fe{constructor(t,e,n=null,s=null,r=null){super(),this.scene=t,this.camera=e,this.overrideMaterial=n,this.clearColor=s,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new Dt}render(t,e,n){let s=t.autoClear;t.autoClear=!1;let r,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(t.getClearColor(this._oldClearColor),t.setClearColor(this.clearColor,t.getClearAlpha())),this.clearAlpha!==null&&(r=t.getClearAlpha(),t.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&t.clearDepth(),t.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),t.render(this.scene,this.camera),this.clearColor!==null&&t.setClearColor(this._oldClearColor),this.clearAlpha!==null&&t.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),t.autoClear=s}};var Kh={name:"LuminosityHighPassShader",shaderID:"luminosityHighPass",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Dt(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};var ds=class i extends Fe{constructor(t,e,n,s){super(),this.strength=e!==void 0?e:1,this.radius=n,this.threshold=s,this.resolution=t!==void 0?new Lt(t.x,t.y):new Lt(256,256),this.clearColor=new Dt(0,0,0),this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new Ee(r,a,{type:Ze}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let u=0;u<this.nMips;u++){let d=new Ee(r,a,{type:Ze});d.texture.name="UnrealBloomPass.h"+u,d.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(d);let f=new Ee(r,a,{type:Ze});f.texture.name="UnrealBloomPass.v"+u,f.texture.generateMipmaps=!1,this.renderTargetsVertical.push(f),r=Math.round(r/2),a=Math.round(a/2)}let o=Kh;this.highPassUniforms=xn.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=s,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new ye({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let l=[3,5,7,9,11];r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let u=0;u<this.nMips;u++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(l[u])),this.separableBlurMaterials[u].uniforms.invSize.value=new Lt(1/r,1/a),r=Math.round(r/2),a=Math.round(a/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=e,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new R(1,1,1),new R(1,1,1),new R(1,1,1),new R(1,1,1),new R(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors;let h=so;this.copyUniforms=xn.clone(h.uniforms),this.blendMaterial=new ye({uniforms:this.copyUniforms,vertexShader:h.vertexShader,fragmentShader:h.fragmentShader,blending:wr,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new Dt,this.oldClearAlpha=1,this.basic=new $e,this.fsQuad=new yn(null)}dispose(){for(let t=0;t<this.renderTargetsHorizontal.length;t++)this.renderTargetsHorizontal[t].dispose();for(let t=0;t<this.renderTargetsVertical.length;t++)this.renderTargetsVertical[t].dispose();this.renderTargetBright.dispose();for(let t=0;t<this.separableBlurMaterials.length;t++)this.separableBlurMaterials[t].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this.basic.dispose(),this.fsQuad.dispose()}setSize(t,e){let n=Math.round(t/2),s=Math.round(e/2);this.renderTargetBright.setSize(n,s);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(n,s),this.renderTargetsVertical[r].setSize(n,s),this.separableBlurMaterials[r].uniforms.invSize.value=new Lt(1/n,1/s),n=Math.round(n/2),s=Math.round(s/2)}render(t,e,n,s,r){t.getClearColor(this._oldClearColor),this.oldClearAlpha=t.getClearAlpha();let a=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),r&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=n.texture,t.setRenderTarget(null),t.clear(),this.fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this.fsQuad.render(t);let o=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this.fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[l].uniforms.direction.value=i.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[l]),t.clear(),this.fsQuad.render(t),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=i.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[l]),t.clear(),this.fsQuad.render(t),o=this.renderTargetsVertical[l];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this.fsQuad.render(t),this.fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this.fsQuad.render(t)):(t.setRenderTarget(n),this.fsQuad.render(t)),t.setClearColor(this._oldClearColor,this.oldClearAlpha),t.autoClear=a}getSeperableBlurMaterial(t){let e=[];for(let n=0;n<t;n++)e.push(.39894*Math.exp(-.5*n*n/(t*t))/t);return new ye({defines:{KERNEL_RADIUS:t},uniforms:{colorTexture:{value:null},invSize:{value:new Lt(.5,.5)},direction:{value:new Lt(.5,.5)},gaussianCoefficients:{value:e}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}getCompositeMaterial(t){return new ye({defines:{NUM_MIPS:t},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}};ds.BlurDirectionX=new Lt(1,0);ds.BlurDirectionY=new Lt(0,1);var Qh={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

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

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};var lo=class extends Fe{constructor(){super();let t=Qh;this.uniforms=xn.clone(t.uniforms),this.material=new Gr({name:t.name,uniforms:this.uniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader}),this.fsQuad=new yn(this.material),this._outputColorSpace=null,this._toneMapping=null}render(t,e,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=t.toneMappingExposure,(this._outputColorSpace!==t.outputColorSpace||this._toneMapping!==t.toneMapping)&&(this._outputColorSpace=t.outputColorSpace,this._toneMapping=t.toneMapping,this.material.defines={},Jt.getTransfer(this._outputColorSpace)===re&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Nl?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===Fl?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Bl?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===zs?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===Ol?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===kl&&(this.material.defines.NEUTRAL_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(t.setRenderTarget(null),this.fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this.fsQuad.render(t))}dispose(){this.material.dispose(),this.fsQuad.dispose()}};var jh={name:"BokehShader",defines:{DEPTH_PACKING:1,PERSPECTIVE_CAMERA:1},uniforms:{tColor:{value:null},tDepth:{value:null},focus:{value:1},aspect:{value:1},aperture:{value:.025},maxblur:{value:.01},nearClip:{value:1},farClip:{value:1e3}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		#include <common>

		varying vec2 vUv;

		uniform sampler2D tColor;
		uniform sampler2D tDepth;

		uniform float maxblur; // max blur amount
		uniform float aperture; // aperture - bigger values for shallower depth of field

		uniform float nearClip;
		uniform float farClip;

		uniform float focus;
		uniform float aspect;

		#include <packing>

		float getDepth( const in vec2 screenPosition ) {
			#if DEPTH_PACKING == 1
			return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );
			#else
			return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		float getViewZ( const in float depth ) {
			#if PERSPECTIVE_CAMERA == 1
			return perspectiveDepthToViewZ( depth, nearClip, farClip );
			#else
			return orthographicDepthToViewZ( depth, nearClip, farClip );
			#endif
		}


		void main() {

			vec2 aspectcorrect = vec2( 1.0, aspect );

			float viewZ = getViewZ( getDepth( vUv ) );

			float factor = ( focus + viewZ ); // viewZ is <= 0, so this is a difference equation

			vec2 dofblur = vec2 ( clamp( factor * aperture, -maxblur, maxblur ) );

			vec2 dofblur9 = dofblur * 0.9;
			vec2 dofblur7 = dofblur * 0.7;
			vec2 dofblur4 = dofblur * 0.4;

			vec4 col = vec4( 0.0 );

			col += texture2D( tColor, vUv.xy );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.15,  0.37 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37,  0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.40,  0.0  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37, -0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15, -0.37 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15,  0.37 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37,  0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37, -0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.15, -0.37 ) * aspectcorrect ) * dofblur );

			col += texture2D( tColor, vUv.xy + ( vec2(  0.15,  0.37 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37,  0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37, -0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15, -0.37 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15,  0.37 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37,  0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37, -0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.15, -0.37 ) * aspectcorrect ) * dofblur9 );

			col += texture2D( tColor, vUv.xy + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.40,  0.0  ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur7 );

			col += texture2D( tColor, vUv.xy + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.4,   0.0  ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur4 );

			gl_FragColor = col / 41.0;
			gl_FragColor.a = 1.0;

		}`};var co=class extends Fe{constructor(t,e,n){super(),this.scene=t,this.camera=e;let s=n.focus!==void 0?n.focus:1,r=n.aperture!==void 0?n.aperture:.025,a=n.maxblur!==void 0?n.maxblur:1;this.renderTargetDepth=new Ee(1,1,{minFilter:Le,magFilter:Le,type:Ze}),this.renderTargetDepth.texture.name="BokehPass.depth",this.materialDepth=new ks,this.materialDepth.depthPacking=$l,this.materialDepth.blending=Qe;let o=jh,l=xn.clone(o.uniforms);l.tDepth.value=this.renderTargetDepth.texture,l.focus.value=s,l.aspect.value=e.aspect,l.aperture.value=r,l.maxblur.value=a,l.nearClip.value=e.near,l.farClip.value=e.far,this.materialBokeh=new ye({defines:Object.assign({},o.defines),uniforms:l,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.uniforms=l,this.fsQuad=new yn(this.materialBokeh),this._oldClearColor=new Dt}render(t,e,n){this.scene.overrideMaterial=this.materialDepth,t.getClearColor(this._oldClearColor);let s=t.getClearAlpha(),r=t.autoClear;t.autoClear=!1,t.setClearColor(16777215),t.setClearAlpha(1),t.setRenderTarget(this.renderTargetDepth),t.clear(),t.render(this.scene,this.camera),this.uniforms.tColor.value=n.texture,this.uniforms.nearClip.value=this.camera.near,this.uniforms.farClip.value=this.camera.far,this.renderToScreen?(t.setRenderTarget(null),this.fsQuad.render(t)):(t.setRenderTarget(e),t.clear(),this.fsQuad.render(t)),this.scene.overrideMaterial=null,t.setClearColor(this._oldClearColor),t.setClearAlpha(s),t.autoClear=r}setSize(t,e){this.materialBokeh.uniforms.aspect.value=t/e,this.renderTargetDepth.setSize(t,e)}dispose(){this.renderTargetDepth.dispose(),this.materialDepth.dispose(),this.materialBokeh.dispose(),this.fsQuad.dispose()}};var wg={uniforms:{tDiffuse:{value:null},uBlurDir:{value:new Lt(0,0)},uBlurAmount:{value:0},uVignette:{value:.32},uTime:{value:0}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 uBlurDir;
    uniform float uBlurAmount;
    uniform float uVignette;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      if (uBlurAmount > 0.001) {
        vec4 acc = color;
        float w = 1.0;
        for (int i = 1; i <= 6; i++) {
          float fi = float(i);
          vec2 off = uBlurDir * uBlurAmount * fi * 0.0022;
          acc += texture2D(tDiffuse, vUv + off) * (1.0 - fi * 0.12);
          acc += texture2D(tDiffuse, vUv - off) * (1.0 - fi * 0.12);
          w += 2.0 * (1.0 - fi * 0.12);
        }
        color = acc / w;
      }
      // \u6697\u89D2
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * uVignette * 2.2;
      color.rgb *= clamp(v, 0.65, 1.0);
      // \u6781\u8F7B\u7684\u80F6\u7247\u9897\u7C92\uFF08\u9759\u6001 \u2014\u2014 \u7531 time \u9A71\u52A8\u4F46\u5E45\u5EA6\u6781\u5C0F\uFF09
      float g = fract(sin(dot(vUv + fract(uTime * 0.01), vec2(12.9898, 78.233))) * 43758.5453);
      color.rgb += (g - 0.5) * 0.012;
      gl_FragColor = color;
    }
  `},ho=class{constructor(t){this.canvas=t,this.renderer=new Fr({canvas:t,antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),this.renderer.setSize(window.innerWidth,window.innerHeight),this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=Ul,this.renderer.toneMapping=zs,this.renderer.toneMappingExposure=1.12,this.renderer.outputColorSpace=Re,this.renderer.localClippingEnabled=!0,this.scene=new ns,this.scene.background=new Dt(395794),this.scene.fog=new Br(395794,.0032),this.camera=new Pe(38,window.innerWidth/window.innerHeight,.1,400),this.camera.position.set(13.5,9.5,15.5);let e=new es(this.renderer),n=e.fromScene(new io,.04);this.scene.environment=n.texture,this.envTexture=n.texture,e.dispose(),this.keyLight=new as(14543103,2.4),this.keyLight.position.set(14,22,12),this.keyLight.castShadow=!0,this.keyLight.shadow.mapSize.set(2048,2048);let s=this.keyLight.shadow.camera;s.near=1,s.far=90,s.left=-22,s.right=22,s.top=22,s.bottom=-22,this.keyLight.shadow.bias=-4e-4,this.keyLight.shadow.normalBias=.02,this.scene.add(this.keyLight),this.rimCyan=new as(4643071,1.15),this.rimCyan.position.set(-18,8,-10),this.scene.add(this.rimCyan),this.rimAmber=new as(16754784,.85),this.rimAmber.position.set(10,4,-16),this.scene.add(this.rimAmber),this.ambient=new Yr(2372686,.55),this.scene.add(this.ambient),this.hemi=new Xr(3494010,658966,.5),this.scene.add(this.hemi),this.composer=new oo(this.renderer),this.composer.addPass(new ao(this.scene,this.camera)),this.bokeh=new co(this.scene,this.camera,{focus:16,aperture:12e-5,maxblur:.008,width:window.innerWidth,height:window.innerHeight}),this.composer.addPass(this.bokeh),this.bloom=new ds(new Lt(window.innerWidth,window.innerHeight),.38,.55,.82),this.composer.addPass(this.bloom),this.finalPass=new us(wg),this.composer.addPass(this.finalPass),this.composer.addPass(new lo),this._vel=new Lt,this._prevCam=this.camera.position.clone(),this._prevLook=new R,this.motionBlur=0,this.blurDir=new Lt(1,0),window.addEventListener("resize",()=>this.resize())}resize(){let t=window.innerWidth,e=window.innerHeight;this.camera.aspect=t/e,this.camera.updateProjectionMatrix(),this.renderer.setSize(t,e),this.composer.setSize(t,e),this.bloom.setSize(t,e),this.bokeh&&this.bokeh.setSize(t,e)}updateDof(t,e=12e-5){if(!this.bokeh)return;let n=this.bokeh.materialBokeh?this.bokeh.materialBokeh.uniforms:null;if(n){let s=this.instant?1:.15;n.focus&&(n.focus.value+=(t-n.focus.value)*s),n.aperture&&(n.aperture.value+=(e-n.aperture.value)*s)}}updateMotionBlur(t){let e=this.camera.position,n=e.x-this._prevCam.x,s=e.y-this._prevCam.y,r=e.z-this._prevCam.z,a=Math.sqrt(n*n+s*s+r*r),o=this._prevLook.distanceTo(t),l=Math.min(1.2,(a+o)*.55);this.motionBlur+=(l-this.motionBlur)*(this.instant?1:.25),a+o>8e-4&&this.blurDir.set(n+(t.x-this._prevLook.x),s+(t.y-this._prevLook.y)).normalize(),this._prevCam.copy(e),this._prevLook.copy(t),this.finalPass.uniforms.uBlurAmount.value=this.motionBlur,this.finalPass.uniforms.uBlurDir.value.copy(this.blurDir)}render(t){this.finalPass.uniforms.uTime.value=t,this.composer.render()}};var He=(i,t,e)=>new R(i,t,e);function tu(i){let t=new te;t.name="B200Package";let e={},n={},s=new te;s.name="substrate";let r=new rt(new Mt(11.4,.22,11.4),i.substrateMat);r.position.y=.11,r.castShadow=r.receiveShadow=!0,r.userData.partId="substrate";let a=new rt(new Mt(11.2,.3,11.2),i.capMat);a.position.y=-.16,a.castShadow=a.receiveShadow=!0,a.userData.partId="substrate";let o=new rt(new Mt(11.15,.05,11.15),i.copperMat);o.position.y=-.02,o.userData.partId="substrate";let l=new rt(new Mt(11.15,.05,11.15),i.copperMat);l.position.y=-.32,l.userData.partId="substrate";let c=new rt(new Mt(11.35,.1,11.35),i.substrateMat);c.position.y=-.42,c.receiveShadow=!0,c.userData.partId="substrate",s.add(r,o,a,l,c),t.add(s),e.substrate=s;let h=new te;h.name="balls";let u=new ss(.085,10,8),d=34,f=new Un(u,i.solderMat,d*d),g=new oe,x=0;for(let at=0;at<d;at++)for(let Rt=0;Rt<d;Rt++){let Ft=-5.3+at/(d-1)*10.6,Qt=-5.3+Rt/(d-1)*10.6;g.makeTranslation(Ft,-.58,Qt),f.setMatrixAt(x++,g)}f.instanceMatrix.needsUpdate=!0,f.castShadow=!0,f.userData.partId="balls",h.add(f),t.add(h),e.balls=h;let m=new te;m.name="interposer";let p=new rt(new Mt(9.6,.12,7.4),i.interposerMat);p.position.y=.32,p.castShadow=p.receiveShadow=!0,p.userData.partId="interposer",m.add(p);let E=new Mt(.045,.012,2.1),M=42,b=new Un(E,i.goldMat,M);for(let at=0;at<M;at++){let Rt=-4.4+at/(M-1)*8.8;g.makeTranslation(Rt,.392,at%2?-1.4:1.4),b.setMatrixAt(at,g)}b.instanceMatrix.needsUpdate=!0,b.userData.partId="interposer",m.add(b),t.add(m),e.interposer=m;let I=new te;I.name="dies";function T(at,Rt,Ft,Qt){let P=new te;P.name=at,P.position.set(Rt*1.98,0,0);let he=new rt(new Mt(3.55,.26,4.6),Ft);he.position.y=.52,he.castShadow=he.receiveShadow=!0,he.userData.partId=at,P.add(he);let Ht=new ss(.052,8,6),Xt=22,Pt=28,Zt=new Un(Ht,i.solderMat,Xt*Pt),Tt=0;for(let F=0;F<Xt;F++)for(let X=0;X<Pt;X++)g.makeTranslation(-1.55+F/(Xt-1)*3.1,.365,-2+X/(Pt-1)*4),Zt.setMatrixAt(Tt++,g);Zt.instanceMatrix.needsUpdate=!0,Zt.userData.partId=at,P.add(Zt),n[at+"Bumps"]=Zt;let w=new te;w.name=at+"Zones";let y=[{zid:"tensor",w:3.1,d:2.6,x:0,z:-.95,color:i.glowCyan,label:"Tensor \u9635\u5217"},{zid:"l2",w:3.1,d:.7,x:0,z:.62,color:i.glowAmber,label:"L2 \u7F13\u5B58"},{zid:"hbmphy",w:3.1,d:.55,x:0,z:1.85,color:i.glowGreen,label:"HBM PHY"},{zid:"nvlink",w:.5,d:3.6,x:Rt*1.42,z:0,color:i.glowCoral,label:"NVLink PHY"},{zid:"d2d",w:.36,d:3.6,x:-Rt*1.55,z:0,color:i.glowCyan,label:"\u7247\u95F4\u4E92\u8FDE"}];for(let F of y){let X=new rt(new Mt(F.w,.028,F.d),F.color.clone());X.position.set(F.x,.665,F.z),X.material.transparent=!0,X.material.opacity=0,X.userData.zoneId=F.zid,X.userData.partId=at,X.userData.baseColor=F.color.color.clone(),w.add(X)}return P.add(w),n[at+"Zones"]=w,P}let A=T("dieA",-1,i.dieMatA,0),N=T("dieB",1,i.dieMatB,1);I.add(A,N),t.add(I),e.dieA=A,e.dieB=N;let S=new rt(new Mt(.22,.1,3.9),i.glowCyan.clone());S.position.set(0,.52,0),S.material.transparent=!0,S.material.opacity=.35,S.userData.partId="bridge",I.add(S),e.bridge=S,n.bridge=S;let v=new te;v.name="hbm";let C=[],G=[];for(let at=-1;at<=1;at+=2)for(let Rt=0;Rt<4;Rt++)G.push({x:at*4.55,z:-1.85+Rt*1.28,id:`hbm${(at<0?0:4)+Rt}`});for(let at of G){let Rt=new te;Rt.name=at.id,Rt.position.set(at.x,0,at.z),Rt.userData.partId=at.id;let Ft=new rt(new Mt(2.15,.24,1.12),i.logicDieMat);Ft.position.y=.5,Ft.castShadow=Ft.receiveShadow=!0,Ft.userData.partId=at.id,Rt.add(Ft);let Qt=[];for(let P=0;P<8;P++){let he=new te;he.userData.layerIndex=P;let Ht=new rt(new Mt(2.12,.085,1.09),P%2?i.dramAltMat:i.dramMat);Ht.castShadow=Ht.receiveShadow=!0,Ht.userData.partId=at.id,he.add(Ht);let Xt=new ss(.028,6,5),Pt=8*5,Zt=new Un(Xt,i.solderMat,Pt),Tt=0;for(let X=0;X<8;X++)for(let J=0;J<5;J++)g.makeTranslation(-.9+X*.256,-.055,-.4+J*.2),Zt.setMatrixAt(Tt++,g);Zt.instanceMatrix.needsUpdate=!0,he.add(Zt);let w=new Nn(.016,.016,.1,6),y=6*4,F=new Un(w,i.tsvMat,y);Tt=0;for(let X=0;X<6;X++)for(let J=0;J<4;J++)g.makeTranslation(-.78+X*.31,0,-.32+J*.21),F.setMatrixAt(Tt++,g);F.instanceMatrix.needsUpdate=!0,he.add(F),he.position.y=.68+P*.115,Rt.add(he),Qt.push(he)}Rt.userData.layers=Qt,v.add(Rt),C.push(Rt)}t.add(v),e.hbmGroup=v;let z=new te;z.name="caps";let $=new Mt(.28,.14,.16),Q=56,W=new Un($,i.capMat,Q),it=0;for(let at=0;at<4;at++)for(let Rt=0;Rt<14;Rt++){let Ft=-4.6+Rt*.7,Qt,P;at===0?(Qt=Ft,P=-4.6):at===1?(Qt=Ft,P=4.6):at===2?(Qt=-4.6,P=Ft):(Qt=4.6,P=Ft),g.makeTranslation(Qt,.32,P),W.setMatrixAt(it++,g)}W.instanceMatrix.needsUpdate=!0,W.userData.partId="caps",z.add(W),t.add(z),e.caps=z;let B=new te;B.name="frame";let j=.55,nt=.42,ht=11.9,It=new rt(new Mt(ht,nt,j),i.frameMat);It.position.set(0,.62,-ht/2+j/2),It.castShadow=!0;let Yt=It.clone();Yt.position.z=ht/2-j/2;let Y=new rt(new Mt(j,nt,ht-j*2),i.frameMat);Y.position.set(-ht/2+j/2,.62,0),Y.castShadow=!0;let et=Y.clone();et.position.x=ht/2-j/2;for(let at of[It,Yt,Y,et])at.userData.partId="frame";B.add(It,Yt,Y,et),t.add(B),e.frame=B;let xt=new te;xt.name="lid";let lt=new rt(new Mt(6.1,.16,4.3),i.lidMat);lt.position.y=1.02,lt.castShadow=lt.receiveShadow=!0,lt.userData.partId="lid";let Ut=new rt(new Mt(6.15,.28,4.35),i.lidMat);Ut.position.y=.86,Ut.userData.partId="lid",xt.add(lt,Ut),t.add(xt),e.lid=xt;let Ot=[];for(let at of G){let Rt=at.x<0?-1.98:1.98;Ot.push({id:at.id+"-die",curve:new is([He(at.x,1.1,at.z),He((at.x+Rt)/2,1,at.z*.6),He(Rt,.9,at.z*.3),He(Rt,.75,0)]),color:4643071,partId:at.id})}return Ot.push({id:"cross-seam",curve:new is([He(-1.85,.8,-1.2),He(-.6,.95,-.5),He(0,1.05,0),He(.6,.95,.5),He(1.85,.8,1.2)]),color:10218495,partId:"bridge"}),Ot.push({id:"cross-seam2",curve:new is([He(-1.85,.8,1.2),He(-.6,.95,.5),He(0,1.05,0),He(.6,.95,-.5),He(1.85,.8,-1.2)]),color:10218495,partId:"bridge"}),{group:t,parts:e,detail:n,hbmStacks:C,paths:Ot,hbmPos:G}}function eu(i,t,e=5){let n=new te;n.name="pulses";let s=[];for(let r of i)for(let a=0;a<e;a++){let o=new rt(new Mt(.16,.16,.16),t.glowCyan.clone());o.material.color.setHex(r.color),n.add(o),s.push({mesh:o,curve:r.curve,offset:a/e,pathId:r.id,partId:r.partId})}return{group:n,items:s}}function nu(i){let t=new te;t.name="HGX";let e=new rt(new Mt(20,.5,13),i.pcbMat);e.position.y=0,e.castShadow=e.receiveShadow=!0,e.userData.partId="hgx",t.add(e);let n=[];for(let r=0;r<8;r++){let a=r%4,o=Math.floor(r/4),l=new te;l.position.set(-7.2+a*4.8,.25,o===0?-3.4:3.4);let c=new rt(new Mt(3.4,.55,2.6),i.lidMat);c.castShadow=c.receiveShadow=!0,c.userData.partId="hgxGpu"+r,c.userData.role="gpu";let h=new rt(new Mt(2.6,.1,1.8),i.dieMatA.clone());h.position.y=.33,h.userData.partId="hgxGpu"+r,l.add(c,h),t.add(l),n.push(l)}for(let r=0;r<4;r++){let a=new rt(new Mt(1.6,.3,1.6),i.logicDieMat);a.position.set(-5.4+r*3.6,.42,0),a.userData.partId="nvswitch",a.userData.role="switch",t.add(a)}let s=new rt(new Mt(18,.28,.7),i.goldMat);return s.position.set(0,.42,-6),s.userData.partId="hgx",t.add(s),t.position.set(0,-26,0),{group:t,gpus:n}}function iu(i){let t=new te;t.name="DGX";let e=new rt(new Mt(24,7,15),i.darkMetalMat);e.castShadow=e.receiveShadow=!0,e.userData.partId="dgx",t.add(e);let n=new rt(new Mt(24.1,6.6,.3),i.rackMat);n.position.z=7.55,n.userData.partId="dgxFront",t.add(n);for(let r=0;r<6;r++){let a=new rt(new Nn(1.1,1.1,.3,20),i.darkMetalMat);a.rotation.x=Math.PI/2,a.position.set(-8+r*3.2,2.2,-7.6),a.userData.partId="dgxFan",t.add(a)}let s=[];for(let r=0;r<8;r++){let a=new rt(new Mt(1.4,.12,.12),i.glowGreen.clone());a.position.set(-8.4+r*2.4,3.1,7.75),a.userData.partId="hgxGpu"+r,t.add(a),s.push(a)}for(let r of[-8,8]){let a=new rt(new Mt(3,.35,.5),i.lidMat);a.position.set(r,3.75,0),t.add(a)}return t.position.set(0,-52,0),{group:t,leds:s}}function su(i){let t=new te;t.name="GB200";let e=new rt(new Mt(14,.5,9),i.pcbMat);e.receiveShadow=e.castShadow=!0,e.userData.partId="gb200",t.add(e);let n=[];for(let a of[-1,1]){let o=new te;o.position.set(a*4.3,.25,0);let l=new rt(new Mt(3.6,.6,3.2),i.lidMat);l.castShadow=!0,l.userData.partId="gb200Gpu"+(a<0?"L":"R");let c=new rt(new Mt(2.8,.12,2.4),i.dieMatA.clone());c.position.y=.36,c.userData.partId=l.userData.partId,o.add(l,c),t.add(o),n.push(o)}let s=new rt(new Mt(4.2,.55,3.4),i.interposerMat);s.position.set(0,.28,-3),s.castShadow=!0,s.userData.partId="grace",t.add(s);let r=new rt(new Mt(3.2,.1,2.4),i.logicDieMat);r.position.set(0,.6,-3),r.userData.partId="grace",t.add(r);for(let a of[-1,1]){let o=new rt(new Mt(.5,.12,3.2),i.glowCyan.clone());o.position.set(a*2.1,.42,-1.3),o.material.transparent=!0,o.material.opacity=.55,o.userData.partId="c2c",t.add(o)}return t.position.set(0,-70,8),{group:t,gpus:n}}function ru(i){let t=new te;t.name="NVL72";let e=26,n=12,s=11,r=i.darkMetalMat,a=[[-1,-1],[-1,1],[1,-1],[1,1]];for(let[h,u]of a){let d=new rt(new Mt(.55,e,.55),r);d.position.set(h*n/2,e/2,u*s/2),d.castShadow=!0,d.userData.partId="rack",t.add(d)}for(let h of[.4,e-.4]){for(let u of[-1,1]){let d=new rt(new Mt(n,.5,.5),r);d.position.set(0,h,u*s/2),d.userData.partId="rack",t.add(d)}for(let u of[-1,1]){let d=new rt(new Mt(.5,.5,s),r);d.position.set(u*n/2,h,0),d.userData.partId="rack",t.add(d)}}let o=[];for(let h=0;h<18;h++){let u=1.4+h*1.35,d=new te;d.position.y=u;let f=new rt(new Mt(n-1.2,1.05,s-1.6),i.darkMetalMat);f.castShadow=f.receiveShadow=!0,f.userData.partId="computeTray"+h,d.add(f);let g=new rt(new Mt(3.2,.28,.32),i.lidMat);g.position.set(0,0,s/2-.6),g.userData.partId="computeTray"+h,d.add(g);for(let x=0;x<4;x++){let m=new rt(new Mt(1.5,.16,1.5),i.glowCyan.clone());m.position.set(-3.4+x*2.3,.58,0),m.material.transparent=!0,m.material.opacity=.5,m.userData.partId="computeTray"+h,d.add(m)}t.add(d),o.push(d)}for(let h=0;h<9;h++){let u=2.2+h*2.75,d=new te;d.position.y=u;let f=new rt(new Mt(n-1.2,.85,s-1.6),i.frameMat);f.userData.partId="switchTray"+h,d.add(f);let g=new rt(new Mt(n-3,.1,.2),i.glowAmber.clone());g.position.set(0,.2,s/2-.65),g.material.transparent=!0,g.material.opacity=.75,d.add(g),t.add(d)}for(let h of[-1,1]){let u=new rt(new Nn(.34,.34,e-1.2,12),i.glassMat);u.position.set(h*(n/2-1.1),e/2,-s/2+1),u.userData.partId="cooling",t.add(u);let d=new rt(new Nn(.22,.22,e-1.2,10),i.glassMat);d.position.set(h*(n/2-.5),e/2,-s/2+1),d.userData.partId="cooling",t.add(d)}let l=new rt(new Mt(n-2,.4,1.2),i.goldMat);l.position.set(0,e+.2,-s/2+1.4),l.userData.partId="rack",t.add(l),t.position.set(0,-84,-18);let c=new te;c.name="fleet";for(let h=0;h<4;h++){let u=t.clone(!0);u.position.set((h-1.5)*17,-84+h%2*0,-36-h*5),u.scale.setScalar(.98),u.traverse(d=>{d.isMesh&&d.material&&d.material.clone&&(d.material=d.material.clone(),d.material.transparent=!0,d.material.opacity=.32,d.castShadow=!1)}),c.add(u)}return{group:t,trays:o,fleet:c}}function Si(i,t,e=1){let n=document.createElement("canvas");n.width=n.height=i;let s=n.getContext("2d");t(s,i);let r=new Vr(n);return r.wrapS=r.wrapT=Us,r.repeat.set(e,e),r.anisotropy=8,r.colorSpace=Re,r}function wi(i,t,e,n=1600){for(let s=0;s<n;s++){let r=Math.random()*t,a=Math.random()*t,o=Math.random()*e;i.fillStyle=`rgba(255,255,255,${o})`,i.fillRect(r,a,1.4,1.4)}}function ou(i=0){return Si(1024,(t,e)=>{let n=t.createLinearGradient(0,0,e,e);n.addColorStop(0,"#121c2e"),n.addColorStop(.5,"#0d1522"),n.addColorStop(1,"#152238"),t.fillStyle=n,t.fillRect(0,0,e,e),t.strokeStyle="rgba(120,170,230,0.14)",t.lineWidth=2;for(let a=0;a<=8;a++){let o=a/8*e;t.beginPath(),t.moveTo(o,0),t.lineTo(o,e),t.stroke(),t.beginPath(),t.moveTo(0,o),t.lineTo(e,o),t.stroke()}let s=8,r=8;for(let a=0;a<s;a++)for(let o=0;o<r;o++){let l=40+o*118,c=40+a*118,h=96,u=96,d=l+h/2,f=c+u/2;if(i===0&&Math.abs(d-e/2)<120||i===1&&Math.abs(f-e/2)<96)continue;let g=t.createLinearGradient(l,c,l+h,c+u);g.addColorStop(0,"rgba(70,120,190,0.32)"),g.addColorStop(1,"rgba(30,60,110,0.22)"),t.fillStyle=g,t.fillRect(l,c,h,u),t.strokeStyle="rgba(140,190,255,0.28)",t.lineWidth=1.2,t.strokeRect(l,c,h,u),t.fillStyle="rgba(160,210,255,0.13)";for(let x=0;x<6;x++)t.fillRect(l+10,c+10+x*14,h-20,6);t.fillStyle="rgba(70,216,255,0.35)",t.fillRect(l+8,c+8,5,5)}t.fillStyle="rgba(217,138,75,0.16)",i===0?t.fillRect(e/2-110,20,220,e-40):t.fillRect(20,e/2-88,e-40,176),t.strokeStyle="rgba(255,190,120,0.3)",t.lineWidth=1;for(let a=0;a<42;a++){if(t.beginPath(),i===0){let o=e/2-100+a*5;t.moveTo(o,30),t.lineTo(o,e-30)}else{let o=e/2-80+a*4;t.moveTo(30,o),t.lineTo(e-30,o)}t.stroke()}for(let a of["top","bottom"]){let o=a==="top"?6:e-34;for(let l=0;l<64;l++)t.fillStyle=l%4===0?"rgba(255,200,110,0.75)":"rgba(200,150,70,0.4)",t.fillRect(30+l*15,o,8,26)}for(let a of["left","right"]){let o=a==="left"?6:e-30;for(let l=0;l<48;l++)t.fillStyle="rgba(70,216,255,0.5)",t.fillRect(o,40+l*19,22,8)}t.fillStyle="rgba(70,216,255,0.22)",i===0?t.fillRect(e-46,200,40,e-400):t.fillRect(6,200,40,e-400),t.fillStyle="rgba(155,235,255,0.8)";for(let a=0;a<26;a++){let o=210+a*23;i===0?t.fillRect(e-42,o,32,6):t.fillRect(10,o,32,6)}wi(t,e,.05,2400)})}function Eg(){return Si(1024,(i,t)=>{i.fillStyle="#0c1410",i.fillRect(0,0,t,t);let e=["rgba(190,120,60,0.5)","rgba(217,138,75,0.42)","rgba(150,95,50,0.4)"];for(let n=0;n<220;n++){i.strokeStyle=e[n%e.length],i.lineWidth=2+Math.random()*3.5;let s=Math.random()*t,r=Math.random()*t;i.beginPath(),i.moveTo(s,r);for(let a=0;a<4;a++)Math.random()>.5?s+=(Math.random()-.5)*320:r+=(Math.random()-.5)*320,i.lineTo(s,r);i.stroke()}for(let n=0;n<420;n++){let s=Math.random()*t,r=Math.random()*t;i.fillStyle="rgba(230,170,90,0.55)",i.beginPath(),i.arc(s,r,3+Math.random()*4,0,Math.PI*2),i.fill()}wi(i,t,.04,1800)})}function Tg(){return Si(512,(i,t)=>{i.fillStyle="#3a2412",i.fillRect(0,0,t,t),i.strokeStyle="rgba(255,180,100,0.7)",i.lineWidth=6;for(let e=0;e<30;e++){let n=16+e*16;i.beginPath(),i.moveTo(0,n);for(let s=0;s<=t;s+=64)i.lineTo(s,n+Math.sin(s*.02+e)*10);i.stroke()}wi(i,t,.06,600)})}function Ag(){return Si(512,(i,t)=>{i.fillStyle="#0e1826",i.fillRect(0,0,t,t);let e=12;for(let n=0;n<t;n+=e)for(let s=0;s<t;s+=e){let r=Math.random();i.fillStyle=r>.92?"rgba(70,216,255,0.5)":`rgba(90,140,200,${.12+r*.2})`,i.fillRect(s+1,n+1,e-2,e-2)}i.strokeStyle="rgba(120,180,240,0.16)",i.lineWidth=1;for(let n=0;n<t;n+=48)i.beginPath(),i.moveTo(n,0),i.lineTo(n,t),i.stroke();wi(i,t,.05,900)})}function Cg(i="#8a97a8"){return Si(512,(t,e)=>{let n=t.createLinearGradient(0,0,e*.6,e);n.addColorStop(0,i),n.addColorStop(.45,"#66727f"),n.addColorStop(1,"#4c5763"),t.fillStyle=n,t.fillRect(0,0,e,e);for(let s=0;s<2600;s++){let r=Math.random()*e,a=Math.random()*e;t.strokeStyle=`rgba(255,255,255,${Math.random()*.035})`,t.lineWidth=Math.random()*1.1,t.beginPath(),t.moveTo(r,a),t.lineTo(r+(Math.random()-.5)*14,a+(Math.random()-.5)*14),t.stroke()}wi(t,e,.035,2200)})}function Rg(){return Si(1024,(i,t)=>{i.fillStyle="#0b1a22",i.fillRect(0,0,t,t);for(let e=0;e<160;e++){i.strokeStyle=`rgba(60,160,150,${.12+Math.random()*.2})`,i.lineWidth=2+Math.random()*3;let n=Math.random()*t,s=Math.random()*t;i.beginPath(),i.moveTo(n,s);for(let r=0;r<3;r++)Math.random()>.5?n+=(Math.random()-.5)*380:s+=(Math.random()-.5)*380,i.lineTo(n,s);i.stroke()}for(let e=0;e<260;e++)i.fillStyle="rgba(200,160,80,0.5)",i.beginPath(),i.arc(Math.random()*t,Math.random()*t,3+Math.random()*4,0,Math.PI*2),i.fill();wi(i,t,.05,1600)})}function Pg(){return Si(512,(i,t)=>{i.fillStyle="#121820",i.fillRect(0,0,t,t);for(let e=12;e<t;e+=18)for(let n=12;n<t;n+=18)i.fillStyle="rgba(0,0,0,0.55)",i.beginPath(),i.arc(n,e,5,0,Math.PI*2),i.fill(),i.fillStyle="rgba(120,150,190,0.18)",i.beginPath(),i.arc(n,e-1,4,0,Math.PI*2),i.fill();wi(i,t,.05,900)})}function au(){let i=ou(0),t=ou(1),e=new gn({map:i,color:12571882,metalness:.72,roughness:.28,envMapIntensity:1.25,iridescence:.85,iridescenceIOR:1.35,iridescenceThicknessRange:[120,420],clearcoat:.6,clearcoatRoughness:.22}),n=e.clone();n.map=t;let s=new gn({map:Eg(),color:13161154,metalness:.45,roughness:.62,envMapIntensity:.7}),r=new Ue({map:Tg(),color:13666896,metalness:.95,roughness:.38,envMapIntensity:1.1}),a=new gn({color:2569806,metalness:.65,roughness:.35,envMapIntensity:1,iridescence:.5,iridescenceIOR:1.3,iridescenceThicknessRange:[200,500]}),o=new gn({map:Ag(),color:11125472,metalness:.6,roughness:.42,envMapIntensity:1}),l=o.clone();l.color=new Dt(9417432);let c=new gn({color:2899544,metalness:.7,roughness:.36,envMapIntensity:1.1}),h=new Ue({color:14198880,metalness:.95,roughness:.32,envMapIntensity:1.35}),u=new Ue({color:12107976,metalness:.92,roughness:.34,envMapIntensity:1.2}),d=new gn({map:Cg("#9aa8ba"),color:10135220,metalness:.9,roughness:.42,envMapIntensity:1.3}),f=new Ue({color:4871528,metalness:.85,roughness:.45,envMapIntensity:.9}),g=new Ue({color:2238510,metalness:.4,roughness:.55,envMapIntensity:.7}),x=new Ue({map:Rg(),color:10475728,metalness:.35,roughness:.6,envMapIntensity:.65}),m=new Ue({map:Pg(),color:9675446,metalness:.78,roughness:.5,envMapIntensity:.85}),p=new Ue({color:2765632,metalness:.8,roughness:.42,envMapIntensity:.9}),E=new gn({color:8964351,metalness:.1,roughness:.12,transmission:.72,thickness:.6,transparent:!0,opacity:.5,envMapIntensity:1.4}),M=new $e({color:4643071,toneMapped:!1}),b=new $e({color:16757844,toneMapped:!1}),I=new $e({color:7271072,toneMapped:!1}),T=new $e({color:16739179,toneMapped:!1}),A=new Ue({color:12634324,metalness:.9,roughness:.3,envMapIntensity:1.2});return{dieMatA:e,dieMatB:n,substrateMat:s,copperMat:r,interposerMat:a,dramMat:o,dramAltMat:l,logicDieMat:c,goldMat:h,solderMat:u,lidMat:d,frameMat:f,capMat:g,pcbMat:x,rackMat:m,darkMetalMat:p,glassMat:E,glowCyan:M,glowAmber:b,glowGreen:I,glowCoral:T,tsvMat:A}}var cu=[{id:"ch01",kind:"chapter",vh:300},{id:"tr01-02",kind:"transition",vh:80,from:"ch01",to:"ch02"},{id:"ch02",kind:"chapter",vh:520},{id:"tr02-03",kind:"transition",vh:80,from:"ch02",to:"ch03"},{id:"ch03",kind:"chapter",vh:380},{id:"tr03-04",kind:"transition",vh:80,from:"ch03",to:"ch04"},{id:"ch04",kind:"chapter",vh:420},{id:"tr04-05",kind:"transition",vh:80,from:"ch04",to:"ch05"},{id:"ch05",kind:"chapter",vh:540},{id:"tr05-06",kind:"transition",vh:80,from:"ch05",to:"ch06"},{id:"ch06",kind:"chapter",vh:480},{id:"tr06-07",kind:"transition",vh:80,from:"ch06",to:"ch07"},{id:"ch07",kind:"chapter",vh:320},{id:"tr07-08",kind:"transition",vh:80,from:"ch07",to:"ch08"},{id:"ch08",kind:"chapter",vh:420}],Ei=[{id:"ch01",num:"01",title:"\u5B8C\u6574\u5C01\u88C5",sub:"FULL PACKAGE"},{id:"ch02",num:"02",title:"\u5C01\u88C5\u62C6\u89E3",sub:"TEARDOWN"},{id:"ch03",num:"03",title:"\u53CC\u6676\u7C92\u4E92\u8FDE",sub:"TWO DIES"},{id:"ch04",num:"04",title:"HBM3e \u663E\u5B58",sub:"MEMORY"},{id:"ch05",num:"05",title:"\u6570\u503C\u7CBE\u5EA6",sub:"PRECISION LAB"},{id:"ch06",num:"06",title:"\u591A\u5361\u7CFB\u7EDF",sub:"SCALE OUT"},{id:"ch07",num:"07",title:"\u89C4\u683C\u5BF9\u7167",sub:"SPEC MATRIX"},{id:"ch08",num:"08",title:"\u56DE\u5230\u6574\u9897",sub:"WHOLE AGAIN"}],lu=cu.reduce((i,t)=>i+t.vh,0),je=(()=>{let i=0,t=[];for(let e of cu){let n=i/lu;i+=e.vh;let s=i/lu;t.push({...e,start:n,end:s,len:s-n})}return t})(),hu={};for(let i of je)hu[i.id]=i;function ne(i,t){let e=hu[i];return e?e.start+e.len*t:0}function Gs(){let i=[];for(let t=0;t<je.length;t++){let e=je[t];if(e.kind!=="chapter")continue;let n=je[t+1];i.push({id:e.id,start:e.start,end:n?n.end:1})}return i}function jl(i){for(let t of je)if(i>=t.start&&i<t.end)return t;return je[je.length-1]}function Ve(i,t){let n=Gs().find(s=>s.id===i);return n?Math.min(1,Math.max(0,(t-n.start)/(n.end-n.start))):0}function uo(i){let t=jl(i);return t.kind==="chapter"?t.id:t.from}function Ws(){let i=document.documentElement.scrollHeight-window.innerHeight;return i<=0?0:Math.min(1,Math.max(0,window.scrollY/i))}function uu(i){let t=document.documentElement.scrollHeight-window.innerHeight;return i*t}var Ig=[{seg:"ch01",t:0,pos:[13.5,9.5,15.5],look:[0,1.2,0],fov:38},{seg:"ch01",t:.35,pos:[11,8.2,13],look:[0,1,0],fov:38},{seg:"ch01",t:.75,pos:[6.5,7.2,14.5],look:[0,1,0],fov:36},{seg:"ch01",t:1,pos:[2.5,12.5,13],look:[0,1.4,0],fov:36},{seg:"ch02",t:.1,pos:[10,10.5,11.5],look:[0,2.6,0],fov:36},{seg:"ch02",t:.35,pos:[12.5,8,6],look:[0,3.2,0],fov:34},{seg:"ch02",t:.6,pos:[3,6.2,13.5],look:[0,3,0],fov:34},{seg:"ch02",t:.85,pos:[-9.5,9,9.5],look:[0,2.8,0],fov:35},{seg:"ch02",t:1,pos:[-4.5,6.2,8.5],look:[-.5,1.8,0],fov:33},{seg:"ch03",t:.15,pos:[-2,4.6,7.8],look:[-.3,1.15,0],fov:32},{seg:"ch03",t:.55,pos:[.4,4.2,7],look:[0,1.15,0],fov:30},{seg:"ch03",t:.9,pos:[2.6,4.5,6.6],look:[.5,1.1,0],fov:31},{seg:"ch03",t:1,pos:[4.8,4.6,6],look:[1.4,1.4,0],fov:33},{seg:"ch04",t:.02,pos:[-8.2,4.4,6.8],look:[-4.4,1.7,0],fov:33},{seg:"ch04",t:.35,pos:[-2.8,4.2,7.2],look:[-1,1.7,0],fov:33},{seg:"ch04",t:.7,pos:[3.2,4.2,7.2],look:[1.2,1.7,0],fov:33},{seg:"ch04",t:1,pos:[8.4,4.6,6.6],look:[4.4,1.7,0],fov:33},{seg:"ch05",t:.05,pos:[5,6.6,9.8],look:[1.2,1.5,0],fov:35},{seg:"ch05",t:.45,pos:[3.2,8,10.6],look:[.5,1.3,0],fov:36},{seg:"ch05",t:.85,pos:[-1.5,8.8,11.5],look:[0,1.2,0],fov:36},{seg:"ch05",t:1,pos:[1,12,15.5],look:[0,1.2,0],fov:38},{seg:"ch06",t:.06,pos:[9,-18,14],look:[0,-26,0],fov:38},{seg:"ch06",t:.34,pos:[11,-43,15],look:[0,-52,0],fov:38},{seg:"ch06",t:.55,pos:[9,-61,14],look:[0,-69,8],fov:38},{seg:"ch06",t:.8,pos:[12,-84,8],look:[0,-82,-18],fov:42},{seg:"ch06",t:1,pos:[19,-76,24],look:[0,-82,-18],fov:44},{seg:"ch07",t:.1,pos:[2,-62,42],look:[0,-70,24],fov:40},{seg:"ch07",t:.55,pos:[-4,-61,40],look:[0,-70,24],fov:38},{seg:"ch07",t:1,pos:[-10,-58,36],look:[0,-69,24],fov:38},{seg:"tr07-08",t:.5,pos:[4,-22,24],look:[0,-12,0],fov:42},{seg:"ch08",t:.15,pos:[10,8,14],look:[0,1.2,0],fov:38},{seg:"ch08",t:.55,pos:[7.5,6.5,11.5],look:[0,1.2,0],fov:36},{seg:"ch08",t:1,pos:[11.5,8.5,13.5],look:[0,1.2,0],fov:38}],Lg=Ig.map(i=>({...i,p:ne(i.seg,i.t)}));function fo(i){let t=Lg;if(i<=t[0].p)return{pos:t[0].pos.slice(),look:t[0].look.slice(),fov:t[0].fov};if(i>=t[t.length-1].p){let a=t[t.length-1];return{pos:a.pos.slice(),look:a.look.slice(),fov:a.fov}}let e=0;for(;e<t.length-2&&t[e+1].p<i;)e++;let n=t[e],s=t[e+1],r=(i-n.p)/(s.p-n.p||1);return r=r*r*(3-2*r),{pos:[n.pos[0]+(s.pos[0]-n.pos[0])*r,n.pos[1]+(s.pos[1]-n.pos[1])*r,n.pos[2]+(s.pos[2]-n.pos[2])*r],look:[n.look[0]+(s.look[0]-n.look[0])*r,n.look[1]+(s.look[1]-n.look[1])*r,n.look[2]+(s.look[2]-n.look[2])*r],fov:n.fov+(s.fov-n.fov)*r}}function we(i){return Math.min(1,Math.max(0,i))}function mt(i){return i=we(i),i*i*(3-2*i)}function Ge(i,t,e){return i+(t-i)*e}function yt(i,t,e,n=0,s=1){return n+(s-n)*we((i-t)/(e-t||1))}var ti=[{id:"FP64",label:"FP64",bits:64,color:"#b07cff",bytes:8,desc:"\u53CC\u7CBE\u5EA6\u6D6E\u70B9 \xB7 \u79D1\u5B66\u8BA1\u7B97"},{id:"TF32",label:"TF32",bits:32,color:"#4fc3f7",bytes:4,desc:"19 \u4F4D\u6709\u6548 \xB7 \u8BAD\u7EC3\u5185\u90E8\u7D2F\u52A0"},{id:"FP16",label:"FP16",bits:16,color:"#43e97b",bytes:2,desc:"\u534A\u7CBE\u5EA6 \xB7 \u8BAD\u7EC3\u4E0E\u63A8\u7406"},{id:"BF16",label:"BF16",bits:16,color:"#b8e05e",bytes:2,desc:"\u52A8\u6001\u8303\u56F4\u540C FP32"},{id:"FP8",label:"FP8",bits:8,color:"#ffb74d",bytes:1,desc:"E4M3 / E5M2 \xB7 Transformer Engine"},{id:"FP4",label:"FP4",bits:4,color:"#ff6b6b",bytes:.5,desc:"NVFP4 \xB7 16 \u503C\u5171\u4EAB E4M3 \u7F29\u653E"}];function fs(i){return ti.find(t=>t.id===i)||ti[5]}var ei={FP4:{sparse:20,dense:10,unit:"PFLOPS"},FP8:{sparse:10,dense:5,unit:"PFLOPS"},FP16:{sparse:5,dense:2.5,unit:"PFLOPS"},BF16:{sparse:5,dense:2.5,unit:"PFLOPS"},TF32:{sparse:2.5,dense:1.25,unit:"PFLOPS"},FP64:{sparse:40,dense:40,unit:"TFLOPS"}},ni={transistors:208e9,dies:2,dieLink:10,hbmStacks:8,hbm3eCapacity:186,hbm3eCapacityHGX:180,hbm3eBW:8,nvlink:1.8,nvlinkRack:130,nvlinkC2C:.9,dramLayers:8},du=[[1.25,-.75,2.5,.5],[0,1.5,-1.25,3.25],[-2,.75,1,-.5],[2.75,-1.5,.25,1.75]],fu=[[.5,1.25,-1,2],[2.25,-.5,1.75,0],[-1.5,3,.25,-.75],[1,-2.25,1.5,.5]];function po(i){return i.map(t=>t.slice())}var tc=class{constructor(){this.precision="FP4",this.matA=po(du),this.matB=po(fu),this.sparse=!1,this.loadScale=1,this.selectedPart=null,this.selectedZone=null,this.selectedProduct=null,this.dieSeamGap=0,this.cutaway=0,this.explode=0,this.workloadMode="train",this.shardRound=-1,this._listeners=new Set,this.load()}get precisionDef(){return fs(this.precision)}get bytesPerValue(){return this.precision==="FP4"?4.5/8:this.precisionDef.bytes}on(t){return this._listeners.add(t),()=>this._listeners.delete(t)}emit(t){for(let e of this._listeners)e(t,this)}set(t,e,n=t){this[t]!==e&&(this[t]=e,this.emit(n))}setPrecision(t){ti.some(e=>e.id===t)&&(this.precision=t,this.save(),this.emit("precision"))}setMat(t,e,n,s){let r=t==="A"?this.matA:this.matB;Number.isFinite(s)&&(r[e][n]=s,this.save(),this.emit("matrix"))}resetMat(){this.matA=po(du),this.matB=po(fu),this.save(),this.emit("matrix")}save(){try{localStorage.setItem("b200-art-state",JSON.stringify({precision:this.precision,matA:this.matA,matB:this.matB,sparse:this.sparse,loadScale:this.loadScale}))}catch{}}load(){try{let t=localStorage.getItem("b200-art-state");if(!t)return;let e=JSON.parse(t);e.precision&&ti.some(n=>n.id===e.precision)&&(this.precision=e.precision),Array.isArray(e.matA)&&e.matA.length===4&&(this.matA=e.matA),Array.isArray(e.matB)&&e.matB.length===4&&(this.matB=e.matB),typeof e.sparse=="boolean"&&(this.sparse=e.sparse),Number.isFinite(e.loadScale)&&(this.loadScale=e.loadScale)}catch{}}},k=new tc;function Fn(){let i=0;for(let l of k.matA)for(let c of l)i+=Math.abs(c);for(let l of k.matB)for(let c of l)i+=Math.abs(c);let t=2048*(.5+i/24),e=Math.round(t*k.loadScale),n=4e8,s=e*n,r=s*k.bytesPerValue,a=ni.hbm3eCapacity*1e9,o=Math.max(1,Math.ceil(r/a));return{tokens:e,paramsPerToken:n,elements:s,bytes:r,bytesGB:r/1e9,gpusNeeded:o,platformsNeeded:Math.ceil(o/8),perShardBytes:r/Math.min(o,8)}}var mo=class{constructor(t){this.pipeline=t,this.scene=t.scene,this.mats=au();let e=tu(this.mats);this.pkg=e,this.scene.add(e.group),this.pulses=eu(e.paths,this.mats,5),this.scene.add(this.pulses.group),this.hgx=nu(this.mats),this.scene.add(this.hgx.group),this.server=iu(this.mats),this.scene.add(this.server.group),this.gb200=su(this.mats),this.scene.add(this.gb200.group),this.rack=ru(this.mats),this.scene.add(this.rack.group),this.scene.add(this.rack.fleet),this.podium=this.buildPodium(),this.scene.add(this.podium),this.clipPlane=new on(new R(0,0,-1),20),this.pipeline.renderer.clippingPlanes=[],this.orbit={az:0,el:0,zoom:1},this.targetOrbit={az:0,el:0,zoom:1},this.highlightBox=new ln,this.highlightHelper=new Qr(this.highlightBox,4643071),this.highlightHelper.visible=!1,this.highlightHelper.material.transparent=!0,this.highlightHelper.material.opacity=.85,this.scene.add(this.highlightHelper),this._tmpV=new R,this._explode=0,this._userExplode=null}buildPodium(){let t=new te;t.name="podium";let e=this.mats,n=[{id:"B200",x:-26},{id:"HGX",x:-13},{id:"DGX",x:0},{id:"GB200",x:13},{id:"NVL72",x:26}];for(let s of n){let r=new te;r.position.set(s.x,-70,0),r.userData.product=s.id;let a=new rt(new Nn(3.2,3.6,.8,28),e.darkMetalMat);if(a.position.y=-2.4,r.add(a),s.id==="B200"){let o=new rt(new Mt(4.6,.9,4.6),e.lidMat);o.position.y=-1.4;let l=new rt(new Mt(1.4,.3,1.8),e.dieMatA);l.position.set(-.9,-.85,0);let c=l.clone();c.position.x=.9,r.add(o,l,c)}else if(s.id==="HGX"){let o=new rt(new Mt(6.4,.4,4.2),e.pcbMat);o.position.y=-1.6,r.add(o);for(let l=0;l<8;l++){let c=new rt(new Mt(1.1,.5,.9),e.lidMat);c.position.set(-2.3+l%4*1.55,-1.15,l<4?-1.1:1.1),r.add(c)}}else if(s.id==="DGX"){let o=new rt(new Mt(6.8,2.4,4.6),e.darkMetalMat);o.position.y=-1;let l=new rt(new Mt(6.85,2.2,.16),e.rackMat);l.position.set(0,-1,2.35),r.add(o,l)}else if(s.id==="GB200"){let o=new rt(new Mt(5.8,.35,3.8),e.pcbMat);o.position.y=-1.7;let l=new rt(new Mt(1.6,.5,1.4),e.interposerMat);l.position.set(0,-1.25,-1),r.add(o,l);for(let c of[-1,1]){let h=new rt(new Mt(1.5,.55,1.5),e.lidMat);h.position.set(c*1.7,-1.2,.4),r.add(h)}}else if(s.id==="NVL72"){for(let[o,l]of[[-1,-1],[-1,1],[1,-1],[1,1]]){let c=new rt(new Mt(.22,4.6,.22),e.darkMetalMat);c.position.set(o*1.6,.5,l*1.2),r.add(c)}for(let o=0;o<9;o++){let l=new rt(new Mt(3.2,.22,2.4),e.frameMat);l.position.y=-1.5+o*.5,r.add(l)}}r.traverse(o=>{o.isMesh&&(o.castShadow=!0,o.receiveShadow=!0,o.userData.product=s.id)}),t.add(r)}return t}setUserExplode(t){this._userExplode=t}clearUserExplode(){this._userExplode=null}orbitDelta(t,e){this.targetOrbit.az+=t,this.targetOrbit.el+=e,this.targetOrbit.el=Math.max(-.85,Math.min(.85,this.targetOrbit.el))}zoomDelta(t){this.targetOrbit.zoom=Math.max(.45,Math.min(2.4,this.targetOrbit.zoom+t))}resetOrbit(){this.targetOrbit.az=0,this.targetOrbit.el=0,this.targetOrbit.zoom=1,this._userExplode=null}chT(t,e){return Ve(t,e)}update(t,e){let n=t,s=k,r=fo(n),a=!!window.__exportMode,o=a?1:.12;this.orbit.az+=(this.targetOrbit.az-this.orbit.az)*o,this.orbit.el+=(this.targetOrbit.el-this.orbit.el)*o,this.orbit.zoom+=(this.targetOrbit.zoom-this.orbit.zoom)*o;let l=new R(r.look[0],r.look[1],r.look[2]),c=new R(r.pos[0]-l.x,r.pos[1]-l.y,r.pos[2]-l.z),h=c.length()/this.orbit.zoom,u=new Kr().setFromVector3(c);u.theta+=this.orbit.az,u.phi=Math.max(.15,Math.min(Math.PI-.15,u.phi-this.orbit.el)),u.radius=h,c.setFromSpherical(u),this.pipeline.camera.position.set(l.x+c.x,l.y+c.y,l.z+c.z),this.pipeline.camera.lookAt(l),this.pipeline.camera.fov=r.fov,this.pipeline.camera.updateProjectionMatrix();{let j=fo(Math.max(0,n-.0025)),nt=fo(Math.min(1,n+.0025)),ht=nt.pos[0]-j.pos[0],It=nt.pos[1]-j.pos[1],Yt=nt.pos[2]-j.pos[2],Y=Math.sqrt(ht*ht+It*It+Yt*Yt)/(2*.0025),et=Math.min(.32,Y*85e-5);if(Y>1e-4){let xt=1/(Y*.005);this.pipeline.blurDir.set(ht*xt,It*xt).normalize()}this.pipeline.motionBlur=et,this.pipeline.finalPass.uniforms.uBlurAmount.value=et,this.pipeline.finalPass.uniforms.uBlurDir.value.copy(this.pipeline.blurDir)}let d=this.pipeline.camera.position.distanceTo(l),f=this.chT("ch03",n)>0&&this.chT("ch03",n)<1||this.chT("ch04",n)>0&&this.chT("ch04",n)<1?2.2:1;this.pipeline.updateDof(d,12e-5*f);let g=e*.055+.8;this.pipeline.keyLight.position.set(Math.cos(g)*22,20+Math.sin(e*.11)*3,Math.sin(g)*20),this.pipeline.rimCyan.position.set(Math.cos(g+2.2)*20,9,Math.sin(g+2.2)*18);let x=this.chT("ch02",n),m=0;n<ne("ch02",0)?m=0:n<=ne("ch02",.75)?m=mt(yt(n,ne("ch02",.02),ne("ch02",.75),0,1)):n<=ne("tr02-03",1)?m=mt(yt(n,ne("ch02",.75),ne("tr02-03",1),1,.22)):n<ne("ch05",1)&&(m=.22*(1-mt(yt(n,ne("ch03",0),ne("ch03",.5),0,1)))*0+.08),n>=ne("ch08",.05)&&(m=0);let p=this._userExplode!=null?this._userExplode:m;if(!Number.isFinite(p)){window.__nanExplode||(window.__nanExplode=!0,console.error("[B200 NaN explode]",p,"p=",n,"userExplode=",this._userExplode));return}this._explode+=(p-this._explode)*(a?1:.14);let E=this._explode;k._effExplode=E;let{parts:M,hbmStacks:b,detail:I}=this.pkg;M.lid.position.y=E*3.2,M.frame.position.y=E*1.9,M.dieA.position.y=E*1.35,M.dieB.position.y=E*1.35,M.interposer.position.y=E*.62,M.balls.position.y=-E*.3,M.caps.position.y=E*.18;let T=we(mt(yt(x,.42,.9,0,1))+(this.chT("ch04",n)>0&&this.chT("ch04",n)<1?.35:0));for(let B of b){B.position.y=E*.95;let j=B.userData.layers;for(let nt=0;nt<j.length;nt++)j[nt].position.y=.68+nt*.115+T*(.14+nt*.16)}I.dieABumps&&(I.dieABumps.visible=E>.06),I.dieBBumps&&(I.dieBBumps.visible=E>.06);let A=s.dieSeamGap,N=A*1.9;M.dieA.position.x=-1.98-N,M.dieB.position.x=1.98+N;let S=M.bridge;S.scale.x=1+A*4.2,S.material.opacity=.42*(1-A*.85),S.material.color.setHex(A>.55?16739179:4643071);let v=s.cutaway;if(v>.001){let B=Ge(7.5,-7.5,v);this.clipPlane.constant=B,this.pipeline.renderer.clippingPlanes=[this.clipPlane]}else this.pipeline.renderer.clippingPlanes=[];let C=this.chT("ch03",n);for(let B of[M.dieA,M.dieB]){let j=B.getObjectByName(B.name+"Zones");if(j)for(let nt of j.children){let ht=nt.userData.zoneId,It=0;C>0&&C<1.01&&(It=.18+.5*(.5+.5*Math.sin(e*1.4+ht.length)),s.selectedZone===ht&&(It=.85)),s.selectedPart===B.name&&s.selectedZone===ht&&(It=.95),nt.material.opacity+=(It-nt.material.opacity)*(a?1:.15)}}let G=A>.35;for(let B of this.pulses.items){if(B.pathId.startsWith("cross")&&G){let ht=(B.offset+e*.12)%1,It=.42-A*.35,Yt=Math.min(ht,Math.max(.06,It));B.curve.getPointAt(Yt,B.mesh.position),B.mesh.material.opacity=.25,B.mesh.material.transparent=!0}else{let ht=(B.offset+e*.12)%1;B.curve.getPointAt(ht,B.mesh.position),B.mesh.material.opacity=1,B.mesh.material.transparent=!1}let nt=.7+.3*Math.sin(e*3+B.offset*12);B.mesh.scale.setScalar(nt)}let z=we(.25+.75*mt(yt(n,ne("ch03",0),ne("ch03",.25),0,1)));if(this.pulses.group.visible=z>.05,s.selectedZone&&(C>0||this.chT("ch04",n)>0))for(let B of[M.dieA,M.dieB]){let j=B.getObjectByName(B.name+"Zones");if(j)for(let nt of j.children)nt.userData.zoneId===s.selectedZone&&(nt.material.opacity=Math.max(nt.material.opacity,.9))}this.updateHighlight(s.selectedPart);let $=n>ne("tr05-06",.25)&&n<ne("tr07-08",.4),Q=n>ne("tr06-07",.4)&&n<ne("tr07-08",.75);this.hgx.group.visible=n>ne("tr05-06",.2)&&n<ne("ch06",.72),this.server.group.visible=n>ne("ch06",.32)&&n<ne("ch06",.95),this.gb200.group.visible=n>ne("ch06",.42)&&n<ne("ch06",1),this.rack.group.visible=n>ne("ch06",.5),this.rack.fleet.visible=n>ne("ch06",.72)&&n<ne("tr07-08",.6),this.podium.visible=Q;let W=this.chT("ch06",n);if(this.hgx.group.visible&&W>.35){let B=e*.9;for(let j=0;j<this.hgx.gpus.length;j++){let nt=this.hgx.gpus[j],ht=.5+.5*Math.sin(B+j*.8);nt.position.y=.25+ht*.12}}let it=n<ne("ch06",.28)||n>ne("tr07-08",.35);if(this.pkg.group.visible=it,this.pulses.group.visible=this.pulses.group.visible&&it,n>ne("ch08",0)){let B=(n-ne("ch08",0))*1.2+Math.sin(e*.12)*.06;this.pkg.group.rotation.y=B*.55}else this.pkg.group.rotation.y=Math.sin(e*.05)*.04}updateHighlight(t){if(!t){this.highlightHelper.visible=!1;return}let e=this.pkg.group.getObjectByName(t)||this.hgx.group.getObjectByName(t)||this.rack.group.getObjectByName(t);if(!e){this.highlightHelper.visible=!1;return}this.highlightBox.setFromObject(e),this.highlightBox.expandByScalar(.12),this.highlightHelper.box=this.highlightBox,this.highlightHelper.visible=!0,this.highlightHelper.updateMatrixWorld(!0)}pick(t,e){let n=new Jr;n.setFromCamera(new Lt(t,e),this.pipeline.camera);let s=[];this.pkg.group.traverse(o=>{o.isMesh&&s.push(o)}),this.hgx.group.visible&&this.hgx.group.traverse(o=>{o.isMesh&&s.push(o)}),this.rack.group.visible&&this.rack.group.traverse(o=>{o.isMesh&&s.push(o)}),this.podium.visible&&this.podium.traverse(o=>{o.isMesh&&s.push(o)});let r=n.intersectObjects(s,!1);if(!r.length)return null;let a=r[0];return{partId:a.object.userData.partId||null,zoneId:a.object.userData.zoneId||null,product:a.object.userData.product||null}}projectAnchors(){let t=[{id:"te",local:new R(-1.98,.72,-1.2)},{id:"d2d",local:new R(0,.62,0)},{id:"decomp",local:new R(2.3,.72,1.5)},{id:"hbm",local:new R(-4.55,1.75,-1.85)},{id:"nvlink",local:new R(-3.5,.72,0)},{id:"ras",local:new R(-1.2,.32,3.6)},{id:"power",local:new R(4.4,.95,4.4)}],e={},n=this.pipeline.camera.position,s=this.pkg.group.position;for(let r of t){let a=r.local.clone();a.applyQuaternion(this.pkg.group.quaternion),a.add(s);let o=a.clone().sub(s).normalize().dot(n.clone().sub(s).normalize()),l=a.clone().project(this.pipeline.camera);e[r.id]={x:(l.x*.5+.5)*window.innerWidth,y:(-l.y*.5+.5)*window.innerHeight,visible:l.z<1&&o>-.25,facing:o},(!Number.isFinite(o)||!Number.isFinite(e[r.id].x))&&(window.__nanAnchor||(window.__nanAnchor=!0,console.error("[B200 NaN anchor]",r.id,"cam",n.toArray(),"pkg",s.toArray(),"world",a.toArray(),"v",l.toArray())))}return e}};var Dg="http://www.w3.org/2000/svg";function O(i,t={},e=null){let n=document.createElementNS(Dg,i);for(let s in t)s==="text"?n.textContent=t[s]:n.setAttribute(s,t[s]);return e&&e.appendChild(n),n}function ae(i){for(;i.firstChild;)i.removeChild(i.firstChild)}function Nt(i,t,e={}){return O("g",{id:t,...e},i)}function On(i,t=1){return Number.isFinite(i)?Math.abs(i)>=1e12?(i/1e12).toFixed(t)+" T":Math.abs(i)>=1e9?(i/1e9).toFixed(t)+" G":Math.abs(i)>=1e6?(i/1e6).toFixed(t)+" M":Math.abs(i)>=1e3?(i/1e3).toFixed(t)+" K":Math.abs(i)>=100?i.toFixed(0):Math.abs(i)>=10?i.toFixed(1):i.toFixed(2):"\u2014"}function Ti(i){return i>=1e12?(i/1e12).toFixed(2)+" TB":i>=1e9?(i/1e9).toFixed(1)+" GB":i>=1e6?(i/1e6).toFixed(1)+" MB":On(i)+" B"}var Bn=class{constructor(t,e,n=6,s={}){this.path=O("path",{...e,fill:"none",class:"flow"},t),this.dots=[],this.count=n,this.color=s.color||"#46d8ff",this.size=s.size||3.2,this.speed=s.speed||.12;for(let r=0;r<n;r++){let a=O("circle",{r:this.size,fill:this.color,opacity:.95},t);this.dots.push(a)}this.len=0}update(t,e=1){try{this.len=this.path.getTotalLength()}catch{return}for(let n=0;n<this.dots.length;n++){let s=(n/this.dots.length+t*this.speed)%1,r=this.path.getPointAtLength(s*this.len);this.dots[n].setAttribute("cx",r.x),this.dots[n].setAttribute("cy",r.y);let a=Math.sin(s*Math.PI);this.dots[n].setAttribute("opacity",(.25+.75*a)*e)}this.path.setAttribute("opacity",e*.55)}setVisible(t){let e=t?1:0;this.path.setAttribute("opacity",e*.55);for(let n of this.dots)n.setAttribute("opacity",e)}},ps=class{constructor(t,e={}){this.g=Nt(t,null),this.line=O("polyline",{class:"leader",points:""},this.g),this.dot=O("circle",{r:3,fill:e.color||"#46d8ff"},this.g),this.text=O("text",{class:"t-label",x:0,y:0},this.g),this.text.textContent=e.label||"",this.sub=O("text",{class:"t-dim",x:0,y:0},this.g),this.sub.textContent=e.sub||"",this.side=e.side||1,this.g.setAttribute("opacity",0),this._op=0}update(t,e,n,s,r=1){if(!Number.isFinite(t)||!Number.isFinite(e)||!Number.isFinite(n)||!Number.isFinite(s)||!Number.isFinite(r)){if(!window.__nanLogged){window.__nanLogged=!0;let u=[!Number.isFinite(t)&&"ax",!Number.isFinite(e)&&"ay",!Number.isFinite(n)&&"bx",!Number.isFinite(s)&&"by",!Number.isFinite(r)&&"op"].filter(Boolean).join("+");console.error("[B200 NaN leader]",u,String(r))}t=Number.isFinite(t)?t:0,e=Number.isFinite(e)?e:0,n=Number.isFinite(n)?n:t+100,s=Number.isFinite(s)?s:e,r=0}this._op=r;let a=this._op,o=t+(n-t)*Math.min(1,a*1.4),l=e+(s-e)*Math.min(1,a*1.4);this.line.setAttribute("points",`${t},${e} ${o},${l} ${n},${l}`),this.dot.setAttribute("cx",t),this.dot.setAttribute("cy",e);let c=n>=t,h=c?n+9:n-9;this.text.setAttribute("text-anchor",c?"start":"end"),this.sub.setAttribute("text-anchor",c?"start":"end"),this.text.setAttribute("x",h),this.text.setAttribute("y",l-4),this.sub.setAttribute("x",h),this.sub.setAttribute("y",l+11),this.g.setAttribute("opacity",Math.min(1,a*1.25))}setLabel(t,e){this.text.textContent=t,e!=null&&(this.sub.textContent=e)}};function pu(i,t,e,n,s=11,r=null){O("line",{x1:t,y1:n,x2:e,y2:n,stroke:"rgba(130,175,230,0.4)","stroke-width":1},i);for(let a=0;a<s;a++){let o=t+(e-t)*(a/(s-1)),l=a%5===0?9:5;if(O("line",{x1:o,y1:n,x2:o,y2:n-l,stroke:"rgba(130,175,230,0.45)","stroke-width":1},i),r&&a%5===0){let c=O("text",{x:o,y:n+16,"text-anchor":"middle",class:"t-dim"},i);c.textContent=r(a/(s-1))}}}function mu(i,t=!1){if(i.length<2)return"";let e=`M ${i[0][0]} ${i[0][1]}`;for(let n=1;n<i.length;n++){let[s,r]=i[n-1],[a,o]=i[n],l=(s+a)/2;e+=` Q ${s} ${r} ${l} ${(r+o)/2} Q ${a} ${o} ${a} ${o}`}return t&&(e+=" Z"),e}var go=class{constructor(t){this.g=Nt(t,"svg-ch01"),this.dotLayer=Nt(this.g,"dots"),this.ringLayer=Nt(this.g,"rings"),this.readoutLayer=Nt(this.g,"readouts"),this.dots=[],this.rings=[],this.built=!1,this.W=0,this.H=0}layout(t,e){this.W=t,this.H=e,ae(this.dotLayer),ae(this.ringLayer),ae(this.readoutLayer),this.dots=[];let n=t*.62,s=e*.52,r=44,a=26;for(let c=0;c<a;c++)for(let h=0;h<r;h++){let u=n-320+h*15,d=s-180+c*14.5,f=h<r/2?0:1,x=(f===0?n-168:n+24)+h%(r/2)/(r/2-1)*144,m=s-150+c/(a-1)*300,p=O("circle",{cx:u,cy:d,r:1.7,fill:f?"#46d8ff":"#d98a4b",opacity:.28},this.dotLayer);this.dots.push({node:p,x0:u,y0:d,tx:x,ty:m,dieIndex:f,seed:Math.random()})}for(let c=0;c<2;c++){let h=n+(c?96:-96),u=O("rect",{x:h-78,y:s-156,width:156,height:312,rx:10,fill:"none",stroke:c?"#46d8ff":"#d98a4b","stroke-width":1.6,opacity:0},this.ringLayer);this.rings.push(u)}this.unionRing=O("rect",{x:n-178,y:s-166,width:356,height:332,rx:16,fill:"none",stroke:"#9bebff","stroke-width":2,opacity:0},this.ringLayer);let o=t*.6,l=e*.12;this.numLabel=O("text",{x:o,y:l,class:"t-dim"},this.readoutLayer),this.numLabel.textContent="TRANSISTORS \xB7 \u6676\u4F53\u7BA1",this.bigNum=O("text",{x:o,y:l+52,class:"t-big","font-size":44},this.readoutLayer),this.bigNum.textContent="0",this.subNum=O("text",{x:o,y:l+80,class:"t-label"},this.readoutLayer),this.subNum.textContent="\u4E24\u9897\u8BA1\u7B97\u6676\u7C92 \xB7 \u4E00\u9897 GPU",this.statA=O("text",{x:o,y:l+128,class:"t-label"},this.readoutLayer),this.statB=O("text",{x:o,y:l+152,class:"t-label"},this.readoutLayer),this.statC=O("text",{x:o,y:l+176,class:"t-label"},this.readoutLayer),this.statA.textContent="\u7247\u95F4\u4E92\u8FDE  NV-HBI  10 TB/s",this.statB.textContent="HBM3e \u5806\u6808  8 \xD7 \u5206\u5C42\u7ED3\u6784",this.statC.textContent="\u7B2C\u4E94\u4EE3 NVLink  1.8 TB/s / GPU",this.built=!0}update(t,e){if(!this.built)return;let n=Ve("ch01",t),s=mt(we(n*1.8+Math.min(.25,e*.06)));for(let l=0;l<this.dots.length;l++){let c=this.dots[l],h=Ge(c.x0,c.tx,s),u=Ge(c.y0,c.ty,s);c.node.setAttribute("cx",h.toFixed(1)),c.node.setAttribute("cy",u.toFixed(1));let d=.5+.5*Math.sin(e*1.2+c.seed*20);c.node.setAttribute("opacity",(.16+s*.42+d*.12).toFixed(2))}for(let l=0;l<this.rings.length;l++)this.rings[l].setAttribute("opacity",(s*.85).toFixed(2));this.unionRing.setAttribute("opacity",(mt(yt(s,.55,1,0,1))*.9).toFixed(2));let r=Math.min(1,e*.22),a=208e9*mt(we(n*1.6+r*1.35));this.bigNum.textContent=(a/1e8).toFixed(a>19e9?0:1)+" \u4EBF";let o=mt(we(n*3+r))*mt(yt(n,.85,1,1,.25));this.readoutLayer.setAttribute("opacity",o.toFixed(2)),this.dotLayer.setAttribute("opacity",mt(yt(n,.92,1,1,.55)))}},xo=class{constructor(t){this.g=Nt(t,"svg-ch02"),this.lineLayer=Nt(this.g,"lines"),this.leadLayer=Nt(this.g,"leaders"),this.sectLayer=Nt(this.g,"section"),this.W=0,this.H=0,this.leaders=[]}layout(t,e){this.W=t,this.H=e,ae(this.lineLayer),ae(this.leadLayer),ae(this.sectLayer),this.leaders=[];let n=t*.3,s=e*.52;this.cx=n,this.cy=s,this.layerDefs=[{id:"lid",label:"\u76D6\u677F / \u52A0\u56FA\u6846\u67B6",sub:"stiffener + lid",color:"#8fb8e8",y:-190,w:300,h:26},{id:"dies",label:"\u4E24\u9897\u8BA1\u7B97\u6676\u7C92",sub:"2 \xD7 reticle-limit die",color:"#46d8ff",y:-110,w:240,h:34},{id:"hbm",label:"8 \xD7 HBM3e \u5806\u6808",sub:"base + 8 DRAM",color:"#6ef2a0",y:-40,w:320,h:30},{id:"ip",label:"\u7845\u4E2D\u4ECB\u5C42",sub:"interposer / \u8D70\u7EBF",color:"#d98a4b",y:30,w:330,h:18},{id:"sub",label:"\u6709\u673A\u57FA\u677F\uFF08\u5206\u5C42\u94DC\u8D70\u7EBF\uFF09",sub:"substrate",color:"#b07cff",y:92,w:360,h:30},{id:"balls",label:"BGA \u710A\u7403\u9635\u5217",sub:"solder balls",color:"#9aa8ba",y:150,w:340,h:14}],this.layerNodes=[];for(let c of this.layerDefs){let h=Nt(this.lineLayer,"ly-"+c.id);O("rect",{x:n-c.w/2,y:s+c.y,width:c.w,height:c.h,rx:4,fill:"rgba(120,170,230,0.05)",stroke:c.color,"stroke-width":1.6},h);for(let d=0;d<6;d++)O("line",{x1:n-c.w/2+10+d*(c.w-20)/6,y1:s+c.y+5,x2:n-c.w/2+10+d*(c.w-20)/6,y2:s+c.y+c.h-5,stroke:c.color,"stroke-width":.7,opacity:.4},h);if(c.id==="hbm"||c.id==="sub")for(let d=1;d<4;d++)O("line",{x1:n-c.w/2+4,y1:s+c.y+d*c.h/4,x2:n+c.w/2-4,y2:s+c.y+d*c.h/4,stroke:c.color,"stroke-width":.7,opacity:.45},h);this.layerNodes.push({...c,node:h});let u=new ps(this.leadLayer,{label:c.label,sub:c.sub,color:c.color,side:1});this.leaders.push({leader:u,ld:c})}let r=t*.72,a=e*.3;this.sectTitle=O("text",{x:r,y:a-18,class:"t-hi"},this.sectLayer),this.sectTitle.textContent="\u4E8C\u7EF4\u5256\u9762 \xB7 \u540C\u6B65\u5256\u5207\u4F4D\u7F6E",this.sectFrame=O("rect",{x:r,y:a,width:300,height:300,rx:8,fill:"rgba(10,16,28,0.55)",stroke:"rgba(130,175,230,0.28)","stroke-width":1},this.sectLayer),this.sectMats=[];let o=[{name:"\u76D6\u677F Ni-Cu",h:22,color:"#8fb8e8"},{name:"TIM \u5BFC\u70ED\u5C42",h:12,color:"#5c6a7c"},{name:"\u6676\u7C92\u7845",h:34,color:"#46d8ff"},{name:"\u5FAE\u51F8\u70B9 \xB5bump",h:16,color:"#d8a860"},{name:"\u7845\u4E2D\u4ECB\u5C42",h:20,color:"#d98a4b"},{name:"\u57FA\u677F\u94DC\u5C42 \xD74",h:56,color:"#b07cff"},{name:"BGA \u710A\u7403",h:26,color:"#9aa8ba"}],l=a+14;for(let c of o){let h=O("rect",{x:r+16,y:l,width:268,height:c.h,rx:2,fill:c.color,opacity:.22,stroke:c.color,"stroke-width":1},this.sectLayer),u=O("text",{x:r+26,y:l+c.h/2+4,class:"t-dim"},this.sectLayer);u.textContent=c.name,this.sectMats.push({rect:h,text:u,y0:l,h:c.h}),l+=c.h+6}this.cutLine=O("line",{x1:r+8,y1:a+150,x2:r+292,y2:a+150,stroke:"#ff6b6b","stroke-width":1.5,"stroke-dasharray":"5 4"},this.sectLayer),this.cutLabel=O("text",{x:r+8,y:a+144,class:"t-dim",fill:"#ff6b6b"},this.sectLayer),this.cutLabel.textContent="\u5256\u5207\u9762 Z"}update(t,e){let n=Ve("ch02",t),s=k._effExplode!=null?k._effExplode:mt(yt(n,.02,.75,0,1)),r=mt(yt(n,0,.12))*mt(yt(n,.88,1,1,.15));this.lineLayer.setAttribute("opacity",r),this.leadLayer.setAttribute("opacity",r);for(let l=0;l<this.layerNodes.length;l++){let c=this.layerNodes[l],h=(l-2.5)*s*34;c.node.setAttribute("transform",`translate(0, ${-h.toFixed(1)})`);let u=k.selectedPart||"",d=c.id==="lid"&&u==="lid"||c.id==="dies"&&(u==="dieA"||u==="dieB"||u==="bridge")||c.id==="hbm"&&u.startsWith("hbm")||c.id==="ip"&&u==="interposer"||c.id==="sub"&&(u==="substrate"||u==="caps")||c.id==="balls"&&u==="balls";c.node.setAttribute("opacity",d?1:.86);for(let M of c.node.children)M.setAttribute&&M.setAttribute("stroke-width",d?2.6:M.tagName==="rect"?1.6:.7);let{leader:f,ld:g}=this.leaders[l],x=this.cx+g.w/2,m=this.cy+g.y+g.h/2-h,p=this.cx+220+l%2*36,E=this.cy+g.y-h;f.update(x,m,p,E,mt(yt(s,.12+l*.05,.32+l*.05))*r*(d?1.35:1))}let a=k.cutaway||0;this.sectLayer.setAttribute("opacity",mt(yt(n,.35,.5))*(1-mt(yt(n,.95,1))*.6));let o=this.sectMats[0].y0+a*280;this.cutLine.setAttribute("y1",o),this.cutLine.setAttribute("y2",o),this.cutLabel.setAttribute("y",o-6);for(let l of this.sectMats){let c=1-Math.min(1,Math.abs(l.y0+l.h/2-o)/90);l.rect.setAttribute("opacity",.18+c*.35)}}},yo=class{constructor(t){this.g=Nt(t,"svg-ch03"),this.floorLayer=Nt(this.g,"floorplan"),this.actLayer=Nt(this.g,"activation"),this.seamLayer=Nt(this.g,"seam"),this.glyphLayer=Nt(this.g,"glyph"),this.W=0,this.H=0,this.zones=[]}layout(t,e){this.W=t,this.H=e,ae(this.floorLayer),ae(this.actLayer),ae(this.seamLayer),ae(this.glyphLayer),this.zones=[];let n=t*.06,s=e*.26,r=t*.46,a=e*.46;this.fx=n,this.fy=s,this.fw=r,this.fh=a,O("rect",{x:n,y:s,width:r,height:a,rx:10,fill:"rgba(10,16,28,0.5)",stroke:"rgba(130,175,230,0.3)"},this.floorLayer);let o=n+r/2;for(let u=0;u<2;u++){let d=u?o+6:n+6,f=r/2-12;O("rect",{x:d,y:s+8,width:f,height:a-16,rx:6,fill:"rgba(70,216,255,0.04)",stroke:u?"#46d8ff":"#d98a4b","stroke-width":1.4},this.floorLayer);let g=O("text",{x:d+12,y:s+28,class:"t-hi"},this.floorLayer);g.textContent=u?"DIE B":"DIE A",g.setAttribute("fill",u?"#46d8ff":"#ffc089")}let l=[{zid:"tensor",label:"Tensor Core \u9635\u5217",die:0,u:.5,v:.32,w:.78,h:.3},{zid:"l2",label:"L2 \u7F13\u5B58",die:0,u:.5,v:.62,w:.78,h:.12},{zid:"hbmphy",label:"HBM PHY",die:0,u:.5,v:.82,w:.78,h:.1},{zid:"nvlink",label:"NVLink PHY",die:0,u:.12,v:.5,w:.12,h:.52},{zid:"d2d",label:"\u7247\u95F4\u4E92\u8FDE D2D",die:0,u:.88,v:.5,w:.1,h:.52},{zid:"tensor",label:"Tensor Core \u9635\u5217",die:1,u:.5,v:.32,w:.78,h:.3},{zid:"l2",label:"L2 \u7F13\u5B58",die:1,u:.5,v:.62,w:.78,h:.12},{zid:"hbmphy",label:"HBM PHY",die:1,u:.5,v:.82,w:.78,h:.1},{zid:"nvlink",label:"NVLink PHY",die:1,u:.88,v:.5,w:.12,h:.52},{zid:"d2d",label:"\u7247\u95F4\u4E92\u8FDE D2D",die:1,u:.12,v:.5,w:.1,h:.52}];for(let u of l){let d=r/2-12,f=(u.die?o+6:n+6)+u.u*d-u.w*d/2,g=s+8+u.v*(a-16)-u.h*(a-16)/2,x=O("rect",{x:f,y:g,width:u.w*d,height:u.h*(a-16),rx:3,fill:"rgba(70,216,255,0.10)",stroke:"rgba(70,216,255,0.35)","stroke-width":1,class:"hit",style:"cursor:pointer"},this.actLayer);x.addEventListener("click",()=>{k.set("selectedZone",u.zid===k.selectedZone?null:u.zid,"zone")}),x.addEventListener("mouseenter",()=>x.setAttribute("stroke","#9bebff")),x.addEventListener("mouseleave",()=>x.setAttribute("stroke","rgba(70,216,255,0.35)"));let m=O("text",{x:f+6,y:g+14,class:"t-dim"},this.actLayer);m.textContent=u.label,this.zones.push({...u,rect:x,label2:m,x0:f,y0:g,wPx:u.w*d,hPx:u.h*(a-16)})}this.seamPath=O("path",{d:`M ${o-40} ${s+a*.45} C ${o-12} ${s+a*.3}, ${o+12} ${s+a*.6}, ${o+40} ${s+a*.45}`,stroke:"#9bebff","stroke-width":2,fill:"none",class:"flow"},this.seamLayer),this.seamPulses=new Bn(this.seamLayer,{d:this.seamPath.getAttribute("d"),stroke:"#9bebff","stroke-width":2,fill:"none"},7,{speed:.22,color:"#9bebff",size:3.6}),this.seamLabel=O("text",{x:o-60,y:s+a*.45-18,class:"t-hi"},this.seamLayer),this.seamLabel.textContent="NV-HBI  10 TB/s",this.seamSub=O("text",{x:o-60,y:s+a*.45+26,class:"t-dim"},this.seamLayer),this.seamSub.textContent="\u4E24\u9897\u6676\u7C92 \xB7 \u4E00\u9897 GPU";let c=t*.78,h=e*.54;this.gLeft=O("path",{d:`M ${c} ${h-70} A 70 70 0 0 0 ${c} ${h+70}`,stroke:"#d98a4b","stroke-width":2.2,fill:"rgba(217,138,75,0.08)"},this.glyphLayer),this.gRight=O("path",{d:`M ${c} ${h-70} A 70 70 0 0 1 ${c} ${h+70}`,stroke:"#46d8ff","stroke-width":2.2,fill:"rgba(70,216,255,0.08)"},this.glyphLayer),this.gText=O("text",{x:c,y:h+6,"text-anchor":"middle",class:"t-big"},this.glyphLayer),this.gText.textContent="GPU",this.gText2=O("text",{x:c,y:h+108,"text-anchor":"middle",class:"t-label"},this.glyphLayer),this.gText2.textContent="ONE GPU \xB7 TWO DIES",this.thumbTitle=O("text",{x:c-60,y:h-108,class:"t-dim"},this.glyphLayer),this.thumbTitle.textContent="\u6FC0\u6D3B\u7F29\u7565\u56FE \xB7 \u4E0E\u4E09\u7EF4\u8054\u52A8",this.thumbCells=[];for(let u=0;u<4;u++)for(let d=0;d<8;d++){let f=O("rect",{x:c-60+d*15,y:h-96+u*11,width:12,height:9,rx:1.5,fill:"rgba(70,216,255,0.12)"},this.glyphLayer);this.thumbCells.push({rect:f,r:u,c:d})}}update(t,e){let n=Ve("ch03",t),s=mt(yt(n,0,.1))*mt(yt(n,.9,1,1,.12));this.g.setAttribute("opacity",s);for(let c=0;c<this.zones.length;c++){let h=this.zones[c],u=e*1.1+c*.7+h.zid.length,d=.5+.5*Math.sin(u),f=k.selectedZone===h.zid;h.rect.setAttribute("fill",f?"rgba(255,180,84,0.30)":`rgba(70,216,255,${(.06+d*.16).toFixed(3)})`),f?h.rect.setAttribute("stroke","#ffb454"):h.rect.setAttribute("stroke","rgba(70,216,255,0.35)")}for(let c=0;c<this.thumbCells.length;c++){let h=this.thumbCells[c],u=k.selectedZone?1.6:1,d=(.5+.5*Math.sin(e*1.3+h.r*.9+h.c*.5))*u;h.rect.setAttribute("fill",`rgba(70,216,255,${(.08+d*.42).toFixed(3)})`)}let r=k.dieSeamGap||0,a=(1-mt(yt(r,.25,.5)))*s;this.seamPulses.update(e,a),this.seamLabel.setAttribute("opacity",.5+a*.5);let l=(1-(1-r)*mt(yt(n,.1,.5)))*36;this.gLeft.setAttribute("transform",`translate(${-l}, 0)`),this.gRight.setAttribute("transform",`translate(${l}, 0)`)}},_o=class{constructor(t){this.g=Nt(t,"svg-ch04"),this.stackLayer=Nt(this.g,"stacks"),this.flowLayer=Nt(this.g,"flows"),this.glyphLayer=Nt(this.g,"glyph"),this.W=0,this.H=0}layout(t,e){this.W=t,this.H=e,ae(this.stackLayer),ae(this.flowLayer),ae(this.glyphLayer),O("rect",{x:t*.04,y:e*.555,width:t*.92,height:e*.185,rx:14,fill:"rgba(8,13,22,0.66)",stroke:"rgba(130,175,230,0.14)"},this.stackLayer),O("rect",{x:t*.545,y:e*.095,width:t*.3,height:e*.09,rx:10,fill:"rgba(8,13,22,0.66)",stroke:"rgba(130,175,230,0.14)"},this.stackLayer);let n=e*.62;this.stackNodes=[];for(let l=0;l<8;l++){let c=t*.1+l*t*.1,h=Nt(this.stackLayer,"stack"+l);h.setAttribute("class","hit"),h.setAttribute("style","cursor:pointer"),h.addEventListener("click",()=>{let f="hbm"+l;k.set("selectedPart",k.selectedPart===f?null:f,"select")}),O("rect",{x:c-26,y:n+64,width:52,height:18,rx:3,fill:"rgba(180,200,230,0.12)",stroke:"#8fb8e8","stroke-width":1.3},h);let u=[];for(let f=0;f<8;f++){let g=O("rect",{x:c-24,y:n+52-f*12,width:48,height:10,rx:2,fill:`rgba(70,216,255,${.1+f*.02})`,stroke:"#46d8ff","stroke-width":1},h);u.push(g);for(let x=0;x<4;x++)O("circle",{cx:c-15+x*10,cy:n+57-f*12,r:1.5,fill:"#d8a860",opacity:.8},h)}let d=O("text",{x:c,y:n+100,"text-anchor":"middle",class:"t-dim"},h);d.textContent="S"+(l+1),this.stackNodes.push({g:h,layers:u,x:c,label:d})}this.title=O("text",{x:t*.1,y:n-118,class:"t-hi"},this.stackLayer),this.title.textContent="HBM3e \u5806\u6808 \xB7 \u4FA7\u89C6\u7EBF\u7A3F\uFF08\u57FA\u5E95 + 8 \u5C42 DRAM \xB7 \u5FAE\u51F8\u70B9 \xB7 TSV\uFF09";let s=t*.5,r=e*.34;this.flows=[];for(let l=0;l<8;l++){let c=t*.1+l*t*.1,h=`M ${c} ${n+40} C ${c} ${n-40}, ${s+(l-3.5)*30} ${r+60}, ${s} ${r}`,u=new Bn(this.flowLayer,{d:h,stroke:"#46d8ff","stroke-width":1.6,fill:"none"},4,{speed:.16+l*.008,color:l%2?"#6ef2a0":"#46d8ff",size:3});this.flows.push(u)}O("rect",{x:s-70,y:r-34,width:140,height:68,rx:8,fill:"rgba(70,216,255,0.08)",stroke:"#9bebff","stroke-width":1.6},this.flowLayer),this.coreLabel=O("text",{x:s,y:r+5,"text-anchor":"middle",class:"t-hi"},this.flowLayer),this.coreLabel.textContent="\u8BA1\u7B97\u533A \xB7 \u6FC0\u6D3B",this.coreResult=O("text",{x:s,y:r+24,"text-anchor":"middle",class:"t-dim"},this.flowLayer);let a=t*.72,o=e*.3;this.glyphText=O("text",{x:a,y:o,class:"t-big","font-size":64,fill:"rgba(70,216,255,0.85)","letter-spacing":"0.12em"},this.glyphLayer),this.glyphText.textContent="HBM",this.glyphOutline=O("path",{d:"",stroke:"#ffb454","stroke-width":1.4,fill:"none",opacity:.7},this.glyphLayer),this.glyphSub=O("text",{x:a,y:o+40,class:"t-label"},this.glyphLayer),this.glyphSub.textContent="\u5E26\u5BBD\u5B57\u5F62 \xB7 \u968F\u6570\u636E\u5BC6\u5EA6\u5F62\u53D8",this.bwLabel=O("text",{x:t*.555,y:e*.115,class:"t-big","font-size":24},this.stackLayer),this.capLabel=O("text",{x:t*.555,y:e*.115+26,class:"t-label"},this.stackLayer),this.batchLabel=O("text",{x:t*.555,y:e*.115+50,class:"t-label"},this.stackLayer)}update(t,e){let n=Ve("ch04",t),s=mt(yt(n,0,.08))*mt(yt(n,.92,1,1,.15));this.g.setAttribute("opacity",s);let r=Ge(.22,-.22,mt(n))*this.W;this.stackLayer.setAttribute("transform",`translate(${r.toFixed(1)}, 0)`),this.flowLayer.setAttribute("transform",`translate(${(r*.55).toFixed(1)}, 0)`);let a=mt(yt(n,.12,.5))*(1-k.dieSeamGap*.3);for(let g of this.stackNodes){let x=k.selectedPart==="hbm"+this.stackNodes.indexOf(g);for(let m=0;m<g.layers.length;m++)g.layers[m].setAttribute("y",this.H*.62+52-m*12-a*(m*(x?6.4:4.2))),g.layers[m].setAttribute("stroke",x?"#ffb454":"#46d8ff")}for(let g of this.flows)g.update(e,s*(.5+a*.5));let o=Fn(),l=we(o.bytesGB/400),c=6+l*26,h=this.W*.72,u=this.H*.3,d=[];for(let g=0;g<=24;g++){let x=g/24,m=h-120+x*240,p=u-70+Math.sin(x*Math.PI*2+e*1.1)*c+Math.sin(x*Math.PI*5-e*.7)*c*.35;d.push([m,p])}this.glyphOutline.setAttribute("d",mu(d)),this.glyphText.setAttribute("transform",`translate(0, ${(Math.sin(e*.9)*l*8).toFixed(2)})`);let f=k.precision;this.bwLabel.textContent="8 TB/s \xD7 8 \u5806\u6808 = 64 TB/s \u805A\u5408",this.capLabel.textContent=`\u5BB9\u91CF ${ni.hbm3eCapacity} GB / \u5361 \xB7 \u5F53\u524D\u7CBE\u5EA6 ${f} \xB7 \u503C\u5BBD ${k.precisionDef.bits} bit`,this.batchLabel.textContent=`\u4F20\u8F93\u6279\u6B21\uFF1A${f==="FP4"?"16 \u503C / \u5757\uFF08\u5171\u4EAB E4M3 \u7F29\u653E\uFF09":f==="FP8"?"\u5355\u5B57\u8282 / \u503C":k.precisionDef.bytes+" B / \u503C"}`,this.coreResult.textContent=`\u7ED3\u679C\u5F62\u6210\u4E2D \xB7 ${f}`}};var Ug=new Float32Array(1),ey=new Uint32Array(Ug.buffer);function ms(i){let t=Math.floor(i),e=i-t;return e>.5?t+1:e<.5||t%2===0?t:t+1}var ii={FP64:{sign:1,exp:11,mant:52,bias:1023,kind:"ieee"},FP32:{sign:1,exp:8,mant:23,bias:127,kind:"ieee"},TF32:{sign:1,exp:8,mant:10,bias:127,kind:"tf32"},FP16:{sign:1,exp:5,mant:10,bias:15,kind:"ieee"},BF16:{sign:1,exp:8,mant:7,bias:127,kind:"ieee"},FP8E4M3:{sign:1,exp:4,mant:3,bias:7,kind:"e4m3"},FP8E5M2:{sign:1,exp:5,mant:2,bias:15,kind:"e5m2"},FP4E2M1:{sign:1,exp:2,mant:1,bias:1,kind:"e2m1"}};function gu(i){if(!Number.isFinite(i))return{code:0,q:0,bits:"0000"};let t=i<0?1:0,e=Math.abs(i),n=[0,.5,1,1.5,2,3,4,6],s=0,r=1/0;for(let l=0;l<n.length;l++){let c=Math.abs(e-n[l]);(c<r-1e-12||Math.abs(c-r)<1e-12&&(l===0||Math.abs(n[l])<Math.abs(n[s])))&&c<r+1e-12&&(s=l,r=c)}let a=t?-n[s]:n[s],o=t<<3|s;return{code:o,q:a,bits:o.toString(2).padStart(4,"0")}}function xu(i){if(!Number.isFinite(i))return{code:127,q:NaN,bits:"11111111"};if(i===0)return{code:0,q:0,bits:"00000000"};let t=i<0?1:0,e=Math.abs(i),n=448,s,r;if(e>n)return s=n,r=t<<7|126,{code:r,q:t?-s:s,bits:r.toString(2).padStart(8,"0")};let a=Math.floor(Math.log2(e));a<-6&&(a=-6);let o=e/Math.pow(2,a)-1;o<0&&(o=0);let l=ms(o*8),c=a+7;if(l>7&&(l=0,c+=1),c>=15&&(l=6,c=15),c<=0){let h=Math.pow(2,-6)*(Math.round(e/Math.pow(2,-9))/8),u=Math.min(7,ms(e/Math.pow(2,-9)));return s=Math.pow(2,-6)*(u/8),r=t<<7|u,{code:r,q:t?-s:s,bits:r.toString(2).padStart(8,"0")}}return r=t<<7|c<<3|l,s=(1+l/8)*Math.pow(2,c-7),{code:r,q:t?-s:s,bits:r.toString(2).padStart(8,"0")}}function Ng(i){if(!Number.isFinite(i))return{code:127,q:NaN,bits:"11111111"};if(i===0)return{code:0,q:0,bits:"00000000"};let t=i<0?1:0,e=Math.abs(i),n=57344;if(e>n)return{code:t<<7|123,q:t?-n:n,bits:(t<<7|123).toString(2).padStart(8,"0")};let s=Math.floor(Math.log2(e));s<-14&&(s=-14);let r=e/Math.pow(2,s)-1;r<0&&(r=0);let a=ms(r*4),o=s+15;a>3&&(a=0,o+=1),o>=31&&(o=30,a=3);let l,c;if(o<=0){let h=Math.min(3,ms(e/Math.pow(2,-16)));return l=Math.pow(2,-14)*(h/4),c=t<<7|h,{code:c,q:t?-l:l,bits:c.toString(2).padStart(8,"0")}}return c=t<<7|o<<2|a,l=(1+a/4)*Math.pow(2,o-15),{code:c,q:t?-l:l,bits:c.toString(2).padStart(8,"0")}}function vo(i,t,e,n){if(!Number.isFinite(i)){let m=(1<<t)-1<<e|1<<e-1|(i>0?0:1<<t+e);return{code:m,q:NaN,bits:m.toString(2).padStart(1+t+e,"0")}}if(i===0)return{code:0,q:0,bits:"0".repeat(1+t+e)};let s=i<0?1:0,r=Math.abs(i),a=(1<<t)-1,o=(2-Math.pow(2,-e))*Math.pow(2,a-1-n);if(r>o){let x=s<<t+e|a<<e;return{code:x,q:s?-1/0:1/0,bits:x.toString(2).padStart(1+t+e,"0")}}let l=Math.floor(Math.log2(r)),c=1-n,h,u;if(l<c){let x=ms(r/Math.pow(2,c-e)),m=s<<t+e|x,p=x*Math.pow(2,c-e);return{code:m,q:s?-p:p,bits:m.toString(2).padStart(1+t+e,"0")}}h=r/Math.pow(2,l)-1;let d=ms(h*Math.pow(2,e));u=l+n,d>=Math.pow(2,e)&&(d=0,u+=1);let f=s<<t+e|u<<e|d,g=(1+d/Math.pow(2,e))*Math.pow(2,u-n);return{code:f,q:s?-g:g,bits:f.toString(2).padStart(1+t+e,"0")}}function bo(i,t){switch(t){case"FP64":return{q:i,bits:vo(i,11,52,1023).bits,err:0};case"TF32":{let e=vo(i,8,10,127);return{q:e.q,bits:e.bits,err:i-e.q}}case"FP16":{let e=vo(i,5,10,15);return{q:e.q,bits:e.bits,err:i-e.q}}case"BF16":{let e=vo(i,8,7,127);return{q:e.q,bits:e.bits,err:i-e.q}}case"FP8":{let e=xu(i);return{q:e.q,bits:e.bits,err:i-e.q}}case"FP8E5M2":{let e=Ng(i);return{q:e.q,bits:e.bits,err:i-e.q}}case"FP4":{let e=gu(i);return{q:e.q,bits:e.bits,err:i-e.q}}default:return{q:i,bits:"",err:0}}}function Fg(i){let t=i.flat?i.flat():i.slice(),e=0;for(let l of t)e=Math.max(e,Math.abs(l));e===0&&(e=1);let n=e/6,s=xu(n),r=s.q>0?s.q:n,a=[],o=[];for(let l of t){let c=gu(l/r);a.push(c.q*r),o.push(c.bits)}return{values:a,bits:o,scale:r,scaleBits:s.bits,amax:e}}function _n(i,t){let e=i.length,n=i[0].length;if(t==="FP4"){let{values:o,bits:l,scale:c}=Fg(i),h=[],u=[],d=[],f=0;for(let g=0;g<e;g++){h.push([]),u.push([]),d.push([]);for(let x=0;x<n;x++)h[g].push(o[f]),u[g].push(l[f]),d[g].push(i[g][x]-o[f]),f++}return{mat:h,bits:u,errors:d,scale:c}}let s=[],r=[],a=[];for(let o=0;o<e;o++){s.push([]),r.push([]),a.push([]);for(let l=0;l<n;l++){let c=bo(i[o][l],t);s[o].push(c.q),r[o].push(c.bits),a[o].push(c.err)}}return{mat:s,bits:r,errors:a,scale:1}}function gs(i,t){let e=i.length,n=t[0].length,s=t.length,r=[];for(let a=0;a<e;a++){r.push([]);for(let o=0;o<n;o++){let l=0;for(let c=0;c<s;c++)l+=i[a][c]*t[c][o];r[a].push(l)}}return r}function yu(i,t,e,n){let s=t.length,r=[],a=0;for(let o=0;o<s;o++){let l=i[e][o]*t[o][n];a+=l,r.push({t:o,av:i[e][o],bv:t[o][n],p:l,acc:a})}return r}function ec(i){let t=0;for(let e of i)for(let n of e)n!==0&&t++;return t}function Bg(i){switch(i){case"FP64":return ii.FP64;case"TF32":return ii.TF32;case"FP16":return ii.FP16;case"BF16":return ii.BF16;case"FP8":return ii.FP8E4M3;case"FP8E5M2":return ii.FP8E5M2;case"FP4":return ii.FP4E2M1;default:return ii.FP32}}function nc(i){let t=Bg(i);return{sign:t.sign,exp:t.exp,mant:t.mant,total:t.sign+t.exp+t.mant}}var Mo=class{constructor(t){this.g=Nt(t,"svg-ch05"),this.bitLayer=Nt(this.g,"bits"),this.axisLayer=Nt(this.g,"axis"),this.matLayer=Nt(this.g,"matvis"),this.W=0,this.H=0,this.bitCells=[],this.lastFmt=null}layout(t,e){this.W=t,this.H=e,ae(this.bitLayer),ae(this.axisLayer),ae(this.matLayer),this.buildBits(k.precision),this.buildAxis(),this.buildMatVis()}buildBits(t){this.lastFmt=t,ae(this.bitLayer),O("rect",{x:this.W*.545,y:this.H*.115,width:this.W*.35,height:this.H*.24,rx:12,fill:"rgba(8,13,22,0.72)",stroke:"rgba(130,175,230,0.16)"},this.bitLayer);let e=nc(t),n=this.W*.56,s=this.H*.16,r=O("text",{x:n,y:s-14,class:"t-hi"},this.bitLayer);r.textContent=`\u4F4D\u683C \xB7 ${t}  \uFF08S ${e.sign} / E ${e.exp} / M ${e.mant}\uFF09`;let a=[{n:e.sign,label:"S",color:"#ff6b6b"},{n:e.exp,label:"E",color:"#46d8ff"},{n:e.mant,label:"M",color:"#6ef2a0"}];this.bitCells=[];let o=n;for(let l of a){let c=[];for(let u=0;u<l.n;u++){let d=O("rect",{x:o+u*17,y:s,width:14,height:26,rx:2.5,fill:"rgba(120,160,210,0.12)",stroke:l.color,"stroke-width":1},this.bitLayer),f=O("text",{x:o+u*17+7,y:s+18,"text-anchor":"middle","font-size":11,fill:"#8aa0bd"},this.bitLayer);f.textContent="0",c.push({rect:d,text:f})}let h=O("text",{x:o+l.n*17/2-7,y:s+44,"text-anchor":"middle",class:"t-dim",fill:l.color},this.bitLayer);h.textContent=`${l.label}\xD7${l.n}`,this.bitCells.push({cells:c,color:l.color,label:l.label}),o+=l.n*17+12}this.fmtDesc=O("text",{x:n,y:s+72,class:"t-label"},this.bitLayer),this.fmtDesc.textContent=fs(t).desc,this.blockNote=O("text",{x:n,y:s+96,class:"t-dim"},this.bitLayer)}buildAxis(){ae(this.axisLayer),O("rect",{x:this.W*.545,y:this.H*.4,width:this.W*.35,height:this.H*.2,rx:12,fill:"rgba(8,13,22,0.72)",stroke:"rgba(130,175,230,0.16)"},this.axisLayer);let t=this.W*.56,e=this.W*.875,n=this.H*.52;this.axisTitle=O("text",{x:t,y:n-56,class:"t-hi"},this.axisLayer),this.axisTitle.textContent="\u6570\u8F74 \xB7 \u53EF\u8868\u793A\u503C\u4E0E\u91CF\u5316\u8BEF\u5DEE",pu(this.axisLayer,t,e,n,11,s=>(-6+s*12).toFixed(0)),this.axisDots=[];for(let s=0;s<13;s++){let r=O("circle",{cx:t,cy:n,r:3.2,fill:"#46d8ff",opacity:.7},this.axisLayer);this.axisDots.push(r)}this.snapLines=[];for(let s=0;s<6;s++){let r=O("line",{x1:t,y1:n-22,x2:t,y2:n-22,stroke:"#ffb454","stroke-width":1.2,opacity:.8},this.axisLayer),a=O("circle",{cx:t,cy:n-22,r:3.6,fill:"#ffb454"},this.axisLayer),o=O("circle",{cx:t,cy:n,r:3,fill:"#46d8ff"},this.axisLayer);this.snapLines.push({line:r,orig:a,quant:o})}this.axisLegend=O("text",{x:t,y:n+36,class:"t-dim"},this.axisLayer),this.axisLegend.textContent="\u6A59\u70B9 = \u539F\u503C \xB7 \u84DD\u70B9 = \u91CF\u5316\u540E\u53EF\u8868\u793A\u503C \xB7 \u8FDE\u7EBF\u957F\u5EA6 = \u820D\u5165\u8BEF\u5DEE"}buildMatVis(){ae(this.matLayer),this.zoomLayer=Nt(this.matLayer,"zoomout"),this.zoomLevels=[];let t=["\u4E58\u52A0 a\xD7b","\u7D2F\u52A0\u5668","\u5F20\u91CF\u6838\u5FC3","\u8BA1\u7B97\u533A","\u6676\u7C92 \xD72","B200 GPU"];for(let s=0;s<t.length;s++){let r=Nt(this.zoomLayer,"z"+s),a=s*11,o=O("rect",{x:this.W*.818+a,y:this.H*.685+a*.72,width:this.W*.15-a*2,height:this.H*.165-a*1.44,rx:8-s,fill:"none",stroke:s%2?"#46d8ff":"#d98a4b","stroke-width":1.4,opacity:0},r),l=O("text",{x:this.W*.818+a+6,y:this.H*.685+a*.72+13,class:"t-dim"},r);l.textContent=t[s],this.zoomLevels.push({g:r,r:o,t:l})}O("rect",{x:this.W*.545,y:this.H*.655,width:this.W*.35,height:this.H*.28,rx:12,fill:"rgba(8,13,22,0.72)",stroke:"rgba(130,175,230,0.16)"},this.matLayer);let e=this.W*.56,n=this.H*.7;this.matTitle=O("text",{x:e,y:n-12,class:"t-hi"},this.matLayer),this.matTitle.textContent="\u77E9\u9635\u7ED3\u679C \xB7 \u968F\u683C\u5F0F\u4E0E\u8F93\u5165\u8FDE\u7EED\u53D8\u5316",this.matBars=[];for(let s=0;s<8;s++){let r=e+s*52,a=O("rect",{x:r,y:n,width:38,height:110,rx:4,fill:"rgba(120,160,210,0.08)",stroke:"rgba(130,175,230,0.2)"},this.matLayer),o=O("rect",{x:r+3,y:n+55,width:32,height:52,rx:3,fill:"rgba(70,216,255,0.55)"},this.matLayer),l=O("text",{x:r+19,y:n+126,"text-anchor":"middle",class:"t-dim"},this.matLayer);l.textContent="c"+(s+1),this.matBars.push({bar:o,lbl:l,bg:a})}this.matRead=O("text",{x:e,y:n+152,class:"t-label"},this.matLayer)}update(t,e){let n=Ve("ch05",t),s=mt(yt(n,0,.06))*mt(yt(n,.94,1,1,.12));this.g.setAttribute("opacity",s);let r=["FP64","TF32","FP16","BF16","FP8","FP4"],a=Math.min(5,Math.floor(we(yt(n,.02,.62))*5.999)),o=r[a];o!==this.lastFmt&&this.buildBits(o);for(let M=0;M<this.bitCells.length;M++){let b=this.bitCells[M];for(let I=0;I<b.cells.length;I++){let T=Math.floor(e*1.4+I*.6+M*2.3)>>I&1,A=T===1;b.cells[I].rect.setAttribute("fill",A?M===0?"rgba(255,107,107,0.75)":M===1?"rgba(70,216,255,0.75)":"rgba(110,242,160,0.75)":"rgba(120,160,210,0.12)"),b.cells[I].text.textContent=T,b.cells[I].text.setAttribute("fill",A?"#06121c":"#8aa0bd")}}this.fmtDesc.textContent=fs(o).desc+`\u3000\xB7\u3000\u8BB2\u89E3\u683C\u5F0F ${o} \u2260 \u5168\u9875\u7CBE\u5EA6 ${k.precision}\uFF08\u77E9\u9635\u5B9E\u9A8C\u6309\u5168\u9875\u7CBE\u5EA6\u6267\u884C\uFF09`;let l=[-5.2,-2.9,-1.15,.62,2.4,4.8],c=this.W*.56,h=this.W*.875,u=this.H*.52,d=M=>c+(M+6)/12*(h-c);for(let M=0;M<this.axisDots.length;M++){let b=-6+M/(this.axisDots.length-1)*12,I=bo(b,o),T=Math.abs(I.q)>6.01?Math.sign(I.q)*6:I.q;this.axisDots[M].setAttribute("cx",d(T))}for(let M=0;M<this.snapLines.length;M++){let b=l[M],I=bo(b,o),T=Math.abs(I.q)>6.01?Math.sign(I.q)*6:I.q,A=this.snapLines[M];A.orig.setAttribute("cx",d(b)),A.quant.setAttribute("cx",d(T)),A.line.setAttribute("x1",d(b)),A.line.setAttribute("x2",d(T))}let f=_n(k.matA,k.precision==="FP4"?"FP4":k.precision),g=_n(k.matB,k.precision==="FP4"?"FP4":k.precision),x=gs(f.mat,g.mat),m=x[0],p=1e-6;for(let M of m)p=Math.max(p,Math.abs(M));for(let M=0;M<8&&M<m.length+4;M++){let b=M<m.length?m[M]:M-3<k.matB[0].length?x[Math.min(1,x.length-1)][M%x[0].length]:0,I=20+Math.abs(b)/p*78,T=this.matBars[M];T.bar.setAttribute("height",I.toFixed(1)),T.bar.setAttribute("y",(this.H*.7+106-I).toFixed(1)),T.bar.setAttribute("fill",b<0?"rgba(255,107,107,0.6)":"rgba(70,216,255,0.55)")}if(this.zoomLevels){let M=we(yt(n,.55,.88));for(let b=0;b<this.zoomLevels.length;b++){let I=this.zoomLevels[b],T=mt(yt(M,b/7,(b+1.6)/7));I.r.setAttribute("opacity",(T*.9).toFixed(2)),I.t.setAttribute("opacity",(T*.95).toFixed(2)),I.g.setAttribute("transform",`translate(${((1-T)*26).toFixed(1)}, 0)`)}}let E=f.errors.flat().reduce((M,b)=>M+Math.abs(b),0);this.matRead.textContent=`\u91CF\u5316\u7EDD\u5BF9\u8BEF\u5DEE\u548C \u03A3|\u0394| = ${E.toFixed(4)} \xB7 \u683C\u5F0F ${k.precision}${k.precision==="FP4"?` \xB7 \u5757\u7F29\u653E s=${f.scale.toFixed(4)}`:""}`,this.blockNote.textContent=o==="FP4"?"NVFP4\uFF1A\u6BCF 16 \u4E2A\u503C\u5171\u4EAB 1 \u4E2A E4M3 \u7F29\u653E\u56E0\u5B50 + \u5F20\u91CF\u7EA7 FP32":`\u603B\u4F4D\u5BBD ${nc(o).total} bit / \u503C`}},So=class{constructor(t){this.g=Nt(t,"svg-ch06"),this.topoLayer=Nt(this.g,"topo"),this.shardLayer=Nt(this.g,"shard"),this.W=0,this.H=0,this.gpuNodes=[],this.links=[]}layout(t,e){this.W=t,this.H=e,ae(this.topoLayer),ae(this.shardLayer);let n=t*.28,s=e*.42;this.topoTitle=O("text",{x:n-150,y:s-168,class:"t-hi"},this.topoLayer),this.topoTitle.textContent="HGX B200 \u516B\u5361\u62D3\u6251 \xB7 NVLink 5 \u5168\u4E92\u8054",this.swNodes=[];for(let o of[-1,1]){let l=O("rect",{x:n-34,y:s+o*96-14,width:68,height:28,rx:5,fill:"rgba(255,180,84,0.14)",stroke:"#ffb454","stroke-width":1.4},this.topoLayer),c=O("text",{x:n,y:s+o*96+4,"text-anchor":"middle",class:"t-dim",fill:"#ffb454"},this.topoLayer);c.textContent="NVSwitch",this.swNodes.push({sw:l,t:c})}this.gpuNodes=[];for(let o=0;o<8;o++){let l=o/8*Math.PI*2-Math.PI/2,c=n+Math.cos(l)*148,h=s+Math.sin(l)*118,u=O("rect",{x:c-30,y:h-18,width:60,height:36,rx:6,fill:"rgba(70,216,255,0.10)",stroke:"#46d8ff","stroke-width":1.5,class:"hit",style:"cursor:pointer"},this.topoLayer);u.addEventListener("click",()=>{k.set("selectedPart",k.selectedPart==="hgxGpu"+o?null:"hgxGpu"+o,"select")});let d=O("text",{x:c,y:h+4,"text-anchor":"middle",class:"t-label"},this.topoLayer);d.textContent="GPU "+(o+1);let f=O("text",{x:c,y:h+32,"text-anchor":"middle",class:"t-dim"},this.topoLayer);this.gpuNodes.push({node:u,label:d,local:f,gx:c,gy:h,ang:l})}this.links=[];for(let o=0;o<8;o++){let l=this.gpuNodes[o];for(let c of[-1,1]){let h=O("path",{d:`M ${l.gx} ${l.gy} Q ${n+c*30} ${s+c*60} ${n} ${s+c*96}`,stroke:"rgba(70,216,255,0.28)","stroke-width":1.3,fill:"none"},this.topoLayer);this.links.push(h)}}this.linkPulses=[];for(let o=0;o<8;o++){let l=this.gpuNodes[o],c=`M ${l.gx} ${l.gy} Q ${n} ${s} ${this.gpuNodes[(o+1)%8].gx} ${this.gpuNodes[(o+1)%8].gy}`,h=new Bn(this.topoLayer,{d:c,stroke:"#9bebff","stroke-width":1.4,fill:"none"},3,{speed:.18,color:"#9bebff",size:2.6});this.linkPulses.push(h)}let r=t*.6,a=e*.24;this.shardTitle=O("text",{x:r,y:a-12,class:"t-hi"},this.shardLayer),this.shardTitle.textContent="\u516B\u5361\u5206\u7247 \xB7 \u5C40\u90E8\u8BA1\u7B97 \xB7 \u5F52\u7EA6\u6C47\u603B",this.shardBars=[],this.shardVals=[];for(let o=0;o<8;o++){let l=a+14+o*30;O("rect",{x:r,y:l,width:240,height:18,rx:4,fill:"rgba(120,160,210,0.08)",stroke:"rgba(130,175,230,0.18)"},this.shardLayer);let c=O("rect",{x:r,y:l,width:10,height:18,rx:4,fill:"rgba(70,216,255,0.55)"},this.shardLayer),h=O("text",{x:r+252,y:l+13,class:"t-dim"},this.shardLayer);h.textContent="GPU"+(o+1);let u=O("text",{x:r+300,y:l+13,class:"t-label"},this.shardLayer);this.shardBars.push({bar:c,lbl:h,val:u,y:l})}this.reduceLine=O("line",{x1:r+240,y1:a+20,x2:r+240,y2:a+14+8*30,stroke:"#ffb454","stroke-width":2},this.shardLayer),this.reduceLabel=O("text",{x:r+320,y:a+8+4*30,class:"t-label",fill:"#ffb454"},this.shardLayer),this.reduceLabel.textContent="all-reduce",this.loadRead=O("text",{x:r,y:a+280,class:"t-label"},this.shardLayer),this.loadRead2=O("text",{x:r,y:a+304,class:"t-dim"},this.shardLayer)}update(t,e){let n=Ve("ch06",t),s=mt(yt(n,0,.06))*mt(yt(n,.92,1,1,.12));this.g.setAttribute("opacity",s);let r=mt(yt(n,.05,.35));for(let m=0;m<this.links.length;m++){let p=this.links[m];try{let E=p.getTotalLength();p.setAttribute("stroke-dasharray",E),p.setAttribute("stroke-dashoffset",E*(1-r))}catch{}}for(let m of this.linkPulses)m.update(e,s*r);let a=_n(k.matA,k.precision==="FP4"?"FP4":k.precision),o=_n(k.matB,k.precision==="FP4"?"FP4":k.precision),l=gs(a.mat,o.mat),c=0;for(let m of l)for(let p of m)c+=p;let h=Fn(),u=0,d=k.selectedPart||"";d.startsWith("hgxGpu")&&(u=parseInt(d.slice(6),10)||0);let f=we(yt(n,.2,.72)+e*.08%1*.02);for(let m=0;m<8;m++){let p=(m-u+8)%8,E=f*8-p,M=we(E),I=c/8*(.85+.15*Math.sin(m*1.7+k.matA[m%4][m%4]))*M,T=this.shardBars[m];T.bar.setAttribute("width",(12+M*228).toFixed(1)),T.val.textContent=I.toFixed(3);let A=k.selectedPart==="hgxGpu"+m;T.bar.setAttribute("fill",A?"rgba(255,180,84,0.75)":"rgba(70,216,255,0.55)"),this.gpuNodes[m].node.setAttribute("stroke",A?"#ffb454":"#46d8ff"),this.gpuNodes[m].node.setAttribute("fill",A?"rgba(255,180,84,0.18)":"rgba(70,216,255,0.10)"),this.gpuNodes[m].local.textContent=M>.15?I.toFixed(2):"\u2014"}let g=mt(yt(n,.55,.85));this.reduceLine.setAttribute("opacity",g),this.reduceLabel.setAttribute("opacity",g);let x=k.precision;this.loadRead.textContent=`\u8D1F\u8F7D ${On(h.tokens)} tokens \xB7 ${Ti(h.bytes)} \xB7 \u7CBE\u5EA6 ${x}\uFF08${k.precisionDef.bits} bit${x==="FP4"?" + \u7F29\u653E":""}\uFF09`,this.loadRead2.textContent=`\u9700\u8981 ${h.gpusNeeded} GPU / ${h.platformsNeeded} \u5E73\u53F0 \xB7 \u6BCF\u5361\u663E\u5B58 ${ni.hbm3eCapacity} GB \xB7 \u94FE\u8DEF 1.8 TB/s\uFF08\u53CC\u5411\u53E3\u5F84\uFF09`}},vn=[{id:"B200",name:"B200",tag:"\u5355\u9897 GPU",mem:"186 GB HBM3e",bw:"8 TB/s",link:"NVLink 1.8 TB/s",fp4:"20 | 10 PFLOPS",fp8:"10 | 5 PFLOPS",fp16:"5 | 2.5 PFLOPS",fp64:"40 TFLOPS",power:"\u22481000 W\uFF08TGP\uFF09",comp:"\u53CC\u6676\u7C92 \xB7 8\xD7HBM3e"},{id:"HGX",name:"HGX B200",tag:"\u516B\u5361\u57FA\u677F",mem:"1.4 TB\uFF088 \u5361\uFF09",bw:"64 TB/s",link:"NVLink \u805A\u5408 14.4 TB/s",fp4:"144 | 72 PFLOPS",fp8:"72 PFLOPS",fp16:"36 PFLOPS",fp64:"296 TFLOPS",power:"\u968F\u6574\u673A",comp:"8\xD7B200 + NVSwitch"},{id:"DGX",name:"DGX B200",tag:"\u5B8C\u6574\u670D\u52A1\u5668",mem:"1,440 GB HBM3e",bw:"64 TB/s",link:"NVLink 14.4 TB/s",fp4:"144 | 72 PFLOPS",fp8:"72 PFLOPS",fp16:"36 PFLOPS",fp64:"296 TFLOPS",power:"\u224814.3 kW",comp:"8\xD7B200 + 2\xD7Xeon + 8\xD7CX-7"},{id:"GB200",name:"GB200",tag:"Grace Blackwell \u8D85\u7EA7\u82AF\u7247",mem:"372 GB HBM3e",bw:"16 TB/s",link:"NVLink 3.6 TB/s + C2C 900 GB/s",fp4:"40 | 20 PFLOPS",fp8:"20 PFLOPS",fp16:"10 PFLOPS",fp64:"80 TFLOPS",power:"\u22482.7 kW\uFF08\u6A21\u7EC4\uFF09",comp:"1 Grace + 2\xD7B200"},{id:"NVL72",name:"GB200 NVL72",tag:"\u6574\u673A\u67DC",mem:"13.4 TB HBM3e",bw:"576 TB/s",link:"NVLink \u57DF 130 TB/s",fp4:"1,440 | 720 PFLOPS",fp8:"720 PFLOPS",fp16:"360 PFLOPS",fp64:"2,880 TFLOPS",power:"\u2248120\u2013132 kW\uFF08\u6DB2\u51B7\uFF09",comp:"36 Grace + 72 GPU \xB7 18+9 \u6258\u76D8"}],wo=class{constructor(t){this.g=Nt(t,"svg-ch07"),this.glyphLayer=Nt(this.g,"glyphs"),this.metricLayer=Nt(this.g,"metrics"),this.W=0,this.H=0}layout(t,e){this.W=t,this.H=e,ae(this.glyphLayer),ae(this.metricLayer);let n=O("text",{x:t*.155,y:e*.12,class:"t-hi"},this.glyphLayer);n.textContent="\u4E94\u79CD\u4EA7\u54C1 \xB7 \u7ED3\u6784\u56FE\u5F62\u5BF9\u7167\uFF08\u4E0E\u7B2C 02\u201306 \u7AE0\u6A21\u578B\u540C\u4E00\u5957\u7ED3\u6784\u6807\u8BC6\uFF09",this.glyphNodes=[];for(let l=0;l<vn.length;l++){let c=vn[l],h=t*.155+l*t*.163,u=e*.245,d=Nt(this.glyphLayer,"glyph-"+c.id);d.setAttribute("class","hit"),d.setAttribute("style","cursor:pointer"),d.addEventListener("click",()=>{k.set("selectedProduct",k.selectedProduct===c.id?null:c.id,"product")}),O("rect",{x:h,y:u-78,width:140,height:156,rx:10,fill:"rgba(10,16,28,0.5)",stroke:"rgba(130,175,230,0.22)"},d),this.drawProductGlyph(d,c.id,h+70,u-6,1);let f=O("text",{x:h+70,y:u+100,"text-anchor":"middle",class:"t-hi"},d);f.textContent=c.name;let g=O("text",{x:h+70,y:u+118,"text-anchor":"middle",class:"t-dim"},d);g.textContent=c.tag,this.glyphNodes.push({gn:d,pr:c,x:h,y:u,name:f,tag:g})}let s=e*.455;this.metricTitle=O("text",{x:t*.155,y:s-14,class:"t-hi"},this.metricLayer),this.metricTitle.textContent="\u663E\u5B58\u5BB9\u91CF\u5BF9\u6BD4\uFF08\u5BF9\u6570\u523B\u5EA6\u793A\u610F\uFF09\xB7 \u70B9\u51FB\u6307\u6807\u6761\u53CD\u9988\u5230\u5BF9\u5E94\u7ED3\u6784",this.metricBars=[];let r=[186,1400,1440,372,13400];this.metricKind="mem";let a=[{id:"mem",label:"\u663E\u5B58\u5BB9\u91CF"},{id:"bw",label:"\u663E\u5B58\u5E26\u5BBD"},{id:"link",label:"\u4E92\u8FDE\u5E26\u5BBD"},{id:"fp4",label:"FP4 \u7B97\u529B"}];this.kindButtons=[];for(let l=0;l<a.length;l++){let c=O("rect",{x:t*.155+l*116,y:s-46,width:108,height:26,rx:6,fill:"rgba(70,216,255,0.10)",stroke:"rgba(70,216,255,0.35)",class:"hit",style:"cursor:pointer"},this.metricLayer);c.addEventListener("click",()=>{this.metricKind=a[l].id;let u={mem:"hbm0",bw:"hbm0",link:"bridge",fp4:"dieA"};k.set("selectedPart",u[a[l].id],"select")});let h=O("text",{x:t*.155+l*116+52,y:s-28,"text-anchor":"middle",class:"t-dim"},this.metricLayer);h.textContent=a[l].label,this.kindButtons.push({b:c,t:h,kind:a[l]})}let o={mem:r,bw:[8,64,64,16,576],link:[1.8,14.4,14.4,3.6,130],fp4:[10,72,72,20,720]};this.metricValues=o;for(let l=0;l<vn.length;l++){let c=t*.155+l*t*.163,h=e*.115,u=h*(Math.log10(r[l])/Math.log10(13400)),d=O("rect",{x:c+30,y:s+h-u,width:80,height:u,rx:4,fill:"rgba(70,216,255,0.35)",stroke:"#46d8ff",class:"hit",style:"cursor:pointer"},this.metricLayer);d.addEventListener("click",()=>{k.set("selectedProduct",vn[l].id,"product"),k.set("selectedPart","hbm0","select")});let f=O("text",{x:c+70,y:s+h+18,"text-anchor":"middle",class:"t-dim"},this.metricLayer);f.textContent=vn[l].mem,this.metricBars.push({bar:d,lbl:f,i:l})}}drawProductGlyph(t,e,n,s,r){let a="#46d8ff",o="#d98a4b";if(e==="B200"){O("rect",{x:n-52,y:s-40,width:104,height:80,rx:6,fill:"none",stroke:o,"stroke-width":1.6},t),O("rect",{x:n-30,y:s-22,width:26,height:44,rx:3,fill:"rgba(70,216,255,0.18)",stroke:a},t),O("rect",{x:n+4,y:s-22,width:26,height:44,rx:3,fill:"rgba(70,216,255,0.18)",stroke:a},t);for(let l=0;l<8;l++){let c=l<4?-1:1,h=l%4;O("rect",{x:n+c*44-8,y:s-30+h*16,width:16,height:11,rx:1.5,fill:"rgba(110,242,160,0.22)",stroke:"#6ef2a0","stroke-width":1},t)}}else if(e==="HGX"){O("rect",{x:n-58,y:s-32,width:116,height:64,rx:5,fill:"rgba(60,160,150,0.10)",stroke:"#2ee6c5","stroke-width":1.6},t);for(let l=0;l<8;l++){let c=l%4,h=Math.floor(l/4);O("rect",{x:n-48+c*26,y:s-24+h*28,width:20,height:20,rx:2,fill:"rgba(70,216,255,0.16)",stroke:a},t)}}else if(e==="DGX"){O("rect",{x:n-56,y:s-38,width:112,height:76,rx:6,fill:"rgba(40,52,68,0.5)",stroke:"#8fb8e8","stroke-width":1.6},t);for(let l=0;l<8;l++)O("circle",{cx:n-40+l*11,cy:s+22,r:3,fill:"#6ef2a0",opacity:.8},t);O("rect",{x:n-44,y:s-26,width:88,height:34,rx:3,fill:"rgba(70,216,255,0.10)",stroke:a},t)}else if(e==="GB200")O("rect",{x:n-52,y:s-30,width:104,height:60,rx:5,fill:"rgba(60,160,150,0.10)",stroke:"#2ee6c5","stroke-width":1.6},t),O("rect",{x:n-8,y:s-20,width:26,height:22,rx:2,fill:"rgba(217,138,75,0.25)",stroke:o},t),O("rect",{x:n-42,y:s-2,width:28,height:24,rx:2,fill:"rgba(70,216,255,0.16)",stroke:a},t),O("rect",{x:n+12,y:s-2,width:28,height:24,rx:2,fill:"rgba(70,216,255,0.16)",stroke:a},t);else if(e==="NVL72"){O("rect",{x:n-26,y:s-58,width:52,height:116,rx:4,fill:"rgba(40,52,68,0.5)",stroke:"#8fb8e8","stroke-width":1.6},t);for(let l=0;l<12;l++)O("rect",{x:n-20,y:s-50+l*9,width:40,height:6,rx:1,fill:l%3===0?"rgba(255,180,84,0.35)":"rgba(70,216,255,0.22)",stroke:l%3===0?"#ffb454":"#46d8ff","stroke-width":.6},t)}}update(t,e){let n=Ve("ch07",t),s=mt(yt(n,0,.08))*mt(yt(n,.9,1,1,.15));this.g.setAttribute("opacity",s);for(let l=0;l<this.glyphNodes.length;l++){let c=this.glyphNodes[l],h=k.selectedProduct===c.pr.id,u=.5+.5*Math.sin(e*1.2+l*.9);c.gn.setAttribute("opacity",h?1:.72+u*.28),c.name.setAttribute("fill",h?"#ffb454":"#9bebff"),h?c.gn.setAttribute("transform","translate(0, -6)"):c.gn.setAttribute("transform","translate(0, 0)")}let r=this.metricValues[this.metricKind]||this.metricValues.mem,a=Math.max(...r),o={mem:vn.map(l=>l.mem),bw:vn.map(l=>l.bw),link:vn.map(l=>l.link),fp4:vn.map(l=>"FP4 "+l.fp4)};for(let l=0;l<this.metricBars.length;l++){let c=this.metricBars[l],h=k.selectedProduct===vn[l].id,u=this.H*.115,d=u*(Math.log10(Math.max(1,r[l]))/Math.log10(Math.max(10,a)));c.bar.setAttribute("height",d.toFixed(1)),c.bar.setAttribute("y",(this.H*.66+u-d).toFixed(1)),c.lbl.textContent=(o[this.metricKind]||[])[l]||"",c.bar.setAttribute("fill",h?"rgba(255,180,84,0.5)":"rgba(70,216,255,0.32)"),c.bar.setAttribute("stroke",h?"#ffb454":"#46d8ff")}for(let l of this.kindButtons){let c=l.kind.id===this.metricKind;l.b.setAttribute("fill",c?"rgba(70,216,255,0.28)":"rgba(70,216,255,0.10)"),l.t.setAttribute("fill",c?"#9bebff":"#6c7f9b")}}},Eo=class{constructor(t){this.g=Nt(t,"svg-ch08"),this.callLayer=Nt(this.g,"callouts"),this.loadLayer=Nt(this.g,"workloads"),this.endLayer=Nt(this.g,"ending"),this.W=0,this.H=0}layout(t,e){this.W=t,this.H=e,ae(this.callLayer),ae(this.loadLayer),ae(this.endLayer);let n=[{id:"te",label:"\u7B2C\u4E8C\u4EE3 Transformer Engine",sub:"FP4 / FP8 \u5FAE\u7F29\u653E",bx:t*.3,by:e*.16,color:"#ffb454"},{id:"d2d",label:"\u7247\u95F4\u4E92\u8FDE NV-HBI",sub:"10 TB/s \xB7 \u53CC\u6676\u7C92",bx:t*.86,by:e*.3,color:"#9bebff"},{id:"decomp",label:"\u89E3\u538B\u7F29\u5F15\u64CE",sub:"\u6570\u636E\u5E93\u67E5\u8BE2\u52A0\u901F",bx:t*.86,by:e*.52,color:"#6ef2a0"},{id:"hbm",label:"HBM3e \u663E\u5B58",sub:"8 \u5806\u6808 \xB7 8 TB/s",bx:t*.1,by:e*.18,color:"#46d8ff"},{id:"nvlink",label:"\u7B2C\u4E94\u4EE3 NVLink",sub:"1.8 TB/s \u53CC\u5411 / GPU",bx:t*.08,by:e*.56,color:"#b07cff"},{id:"ras",label:"RAS \u4E0E\u673A\u5BC6\u8BA1\u7B97",sub:"\u53EF\u9760\u6027 / \u52A0\u5BC6\u63A5\u53E3",bx:t*.14,by:e*.82,color:"#ff6b6b"},{id:"power",label:"\u529F\u8017\u4E0E\u6563\u70ED",sub:"\u22481000 W TGP",bx:t*.84,by:e*.8,color:"#d98a4b"}];this.callouts=[];for(let l of n){let c=new ps(this.callLayer,{label:l.label,sub:l.sub,color:l.color,side:l.bx>t*.5?-1:1});this.callouts.push({leader:c,...l,ax:t*.5,ay:e*.5})}let s=e*.2;this.loadTitle=O("text",{x:t*.545,y:s-16,class:"t-hi"},this.loadLayer),this.loadTitle.textContent="\u4E09\u7C7B\u8D1F\u8F7D \xB7 \u52A8\u6001\u6F14\u793A",this.loadCards=[];let r=[{id:"train",name:"\u8BAD\u7EC3",color:"#46d8ff",fmtNote:"\u683C\u5F0F\u968F\u5168\u9875\u7CBE\u5EA6"},{id:"infer",name:"\u63A8\u7406",color:"#6ef2a0",fmtNote:"\u683C\u5F0F\u968F\u5168\u9875\u7CBE\u5EA6\uFF08FP4 \u4F18\u5148\uFF09"},{id:"sci",name:"\u79D1\u5B66\u8BA1\u7B97",color:"#b07cff",fmtNote:"\u672C\u7C7B\u8D1F\u8F7D\u91C7\u7528 FP64\uFF08\u5355\u72EC\u6807\u660E\uFF09"}];for(let l=0;l<r.length;l++){let c=s+l*126,h=O("rect",{x:t*.545,y:c,width:t*.28,height:112,rx:10,fill:"rgba(10,16,28,0.55)",stroke:r[l].color,"stroke-width":1.3,class:"hit",style:"cursor:pointer"},this.loadLayer);h.addEventListener("click",()=>k.set("workloadMode",r[l].id,"workload"));let u=O("text",{x:t*.545+16,y:c+26,class:"t-hi",fill:r[l].color},this.loadLayer);u.textContent=r[l].name;let d=[];for(let g=0;g<3;g++)for(let x=0;x<10;x++){let m=O("rect",{x:t*.545+16+x*24,y:c+40+g*15,width:18,height:11,rx:2,fill:"rgba(120,160,210,0.12)"},this.loadLayer);d.push({rect:m,r:g,c:x})}let f=O("text",{x:t*.545+16,y:c+104,class:"t-dim"},this.loadLayer);this.loadCards.push({card:h,name:u,cells:d,read:f,mode:r[l]})}this.endDots=[];let a=t*.26,o=e*.42;this.endLabel=O("text",{x:a,y:o+160,class:"t-label","text-anchor":"middle"},this.endLayer),this.endLabel.textContent="\u56DE\u5230\u6574\u9897 GPU \xB7 \u524D\u9762\u6240\u89C1\u5168\u90E8\u843D\u56DE\u5C01\u88C5\u4E4B\u4E0A";for(let l=0;l<120;l++){let c=l/120*Math.PI*2,h=130+l%7*18,u=O("circle",{cx:a+Math.cos(c)*h,cy:o+Math.sin(c)*h*.72,r:2,fill:l%2?"#46d8ff":"#d98a4b",opacity:.5},this.endLayer);this.endDots.push({node:u,ang:c,rad:h,seed:Math.random()})}}update(t,e){let n=Ve("ch08",t),s=mt(yt(n,0,.06));this.g.setAttribute("opacity",s);let r=window.__scene&&window.__scene.projectAnchors?window.__scene.projectAnchors():null;for(let c=0;c<this.callouts.length;c++){let h=this.callouts[c],u=mt(yt(n,.06+c*.045,.3+c*.045));if(r&&r[h.id]){let d=r[h.id];h.ax=d.x,h.ay=d.y;let f=d.visible?mt(yt(d.facing,-.25,.15)):0;h.leader.update(h.ax,h.ay,h.bx,h.by,u*s*(.18+f*.82))}else h.leader.update(h.ax,h.ay,h.bx,h.by,u*s)}for(let c=0;c<this.loadCards.length;c++){let h=this.loadCards[c],u=k.workloadMode===h.mode.id;h.card.setAttribute("stroke-width",u?2.2:1.2),h.card.setAttribute("fill",u?"rgba(70,216,255,0.10)":"rgba(10,16,28,0.55)");for(let p of h.cells){let E;h.mode.id==="train"?E=(p.r+p.c+Math.floor(e*1.6))%5:h.mode.id==="infer"?E=(p.c+Math.floor(e*2.4))%6<2?4:1:E=Math.abs(Math.sin(p.c*.7+p.r*1.3+e*.9))*4;let M=.1+E/5*.65;p.rect.setAttribute("fill",u?`rgba(${h.mode.color==="#46d8ff"?"70,216,255":h.mode.color==="#6ef2a0"?"110,242,160":"157,123,255"},${M.toFixed(2)})`:`rgba(120,160,210,${(M*.5).toFixed(2)})`)}let d=k.precision,f=Fn(),g=ei[d]||ei.FP4,x=(g.dense*(h.mode.id==="infer"?1.25:1)).toFixed(2),m=h.mode.id==="sci"?"FP64":d;h.read.textContent=u?`${h.mode.fmtNote} \xB7 \u5DE5\u4F5C\u91CF ${On(f.elements*(c+1))} OP\uFF08\u793A\u610F\uFF09 \xB7 \u6F14\u793A\u901F\u7387 ${x} ${h.mode.id==="sci"?"TFLOPS":g.unit} \xB7 \u5B98\u65B9\u5CF0\u503C\u53E6\u8BA1`:`${h.mode.name} \xB7 ${h.mode.fmtNote} \xB7 \u5F53\u524D\u683C\u5F0F ${m}`}let a=mt(yt(n,.45,.9)),o=this.W*.26,l=this.H*.42;for(let c of this.endDots){let h=40+c.seed*30,u=Ge(c.rad,h,a);c.node.setAttribute("cx",(o+Math.cos(c.ang+e*.08)*u).toFixed(1)),c.node.setAttribute("cy",(l+Math.sin(c.ang+e*.08)*u*.72).toFixed(1)),c.node.setAttribute("opacity",(.25+a*.55).toFixed(2))}this.endLayer.setAttribute("opacity",mt(yt(n,.3,.55))),this.loadLayer.setAttribute("opacity",mt(yt(n,.08,.2))*(1-mt(yt(n,.86,1))*.45)),this.callLayer.setAttribute("opacity",mt(yt(n,.05,.2)))}};var To=class{constructor(t){this.g=Nt(t,"svg-transitions"),this.W=0,this.H=0,this.nodes={}}layout(t,e){this.W=t,this.H=e,ae(this.g),this.nodes={};{let n=Nt(this.g,"tr01"),s=t*.5,r=e*.52,a=[];for(let l=0;l<5;l++){let c=O("rect",{x:s-150+l*4,y:r-60+l*26,width:300-l*8,height:16,rx:3,fill:"none",stroke:"#46d8ff","stroke-width":1.3,opacity:0},n);a.push(c)}let o=O("text",{x:s,y:r+130,"text-anchor":"middle",class:"t-dim"},n);o.textContent="\u540C\u4E00\u9897 B200 \xB7 \u9010\u5C42\u5C55\u5F00",this.nodes.tr01={g:n,layers:a,label:o}}{let n=Nt(this.g,"tr02"),s=t*.5,r=e*.5,a=O("rect",{x:s-220,y:r-130,width:440,height:260,rx:12,fill:"none",stroke:"#9bebff","stroke-width":1.6,opacity:0},n),o=O("path",{d:`M ${s-24} ${r} H ${s+24} M ${s} ${r-24} V ${s&&r+24}`,stroke:"#ffb454","stroke-width":1.4,opacity:0},n),l=O("text",{x:s,y:r+172,"text-anchor":"middle",class:"t-label"},n);l.textContent="\u955C\u5934\u8FDB\u5165\u4E24\u9897\u6676\u7C92\u4E4B\u95F4",this.nodes.tr02={g:n,frame:a,cross:o,label:l}}{let n=Nt(this.g,"tr03"),s=O("path",{d:`M ${t*.5} ${e*.48} C ${t*.4} ${e*.36}, ${t*.25} ${e*.4}, ${t*.14} ${e*.56}`,stroke:"#46d8ff","stroke-width":2,fill:"none",opacity:0},n),r=new Bn(n,{d:s.getAttribute("d"),stroke:"#9bebff","stroke-width":2,fill:"none"},5,{speed:.2,color:"#9bebff"}),a=Nt(n,"tr03-stack"),o=t*.14,l=e*.56,c=O("rect",{x:o-40,y:l-90,width:80,height:110,rx:4,fill:"none",stroke:"#6ef2a0","stroke-width":1.6,opacity:0},a),h=[];for(let d=0;d<8;d++){let f=O("line",{x1:o-34,y1:l-82+d*12,x2:o+34,y2:l-82+d*12,stroke:"#6ef2a0","stroke-width":1,opacity:0},a);h.push(f)}let u=O("text",{x:o,y:l+42,"text-anchor":"middle",class:"t-dim"},n);u.textContent="\u4E09\u7EF4\u5806\u6808 \u2192 \u4E8C\u7EF4\u4FA7\u89C6\u7EBF\u7A3F\uFF08\u4FDD\u6301\u5BF9\u9F50\uFF09",this.nodes.tr03={g:n,path:s,pulses:r,outline:c,lines:h,label:u}}{let n=Nt(this.g,"tr04"),s=t*.5,r=e*.48,a=O("path",{d:`M ${s-40} ${r-30} l 40 -18 l 40 18 l -40 18 Z M ${s-40} ${r-30} v 40 l 40 18 v -40 M ${s+40} ${r-30} v 40 l -40 18`,stroke:"#46d8ff","stroke-width":1.8,fill:"rgba(70,216,255,0.08)",opacity:0},n),o=[];for(let c=0;c<8;c++){let h=O("rect",{x:s-66+c*18,y:r+40,width:15,height:26,rx:2,fill:"rgba(110,242,160,0.15)",stroke:"#6ef2a0","stroke-width":1.2,opacity:0},n);o.push(h)}let l=O("text",{x:s,y:r+100,"text-anchor":"middle",class:"t-label"},n);l.textContent="\u4E00\u4EFD\u5728\u4F20\u6570\u636E \u2192 \u5B83\u7684\u6570\u503C\u8868\u793A\uFF08\u4F4D\u683C\uFF09",this.nodes.tr04={g:n,cube:a,cells:o,label:l}}{let n=Nt(this.g,"tr05"),s=t*.5,r=e*.44,a=O("rect",{x:s-46,y:r-26,width:92,height:52,rx:8,fill:"rgba(255,180,84,0.12)",stroke:"#ffb454","stroke-width":1.6,opacity:0},n),o=[];for(let c=0;c<8;c++){let h=c/8*Math.PI*2,u=s+Math.cos(h)*190,d=r+Math.sin(h)*110,f=O("path",{d:`M ${s} ${r} Q ${(s+u)/2} ${r+(d-r)*.2} ${u} ${d}`,stroke:"#46d8ff","stroke-width":1.3,fill:"none",opacity:0},n),g=O("rect",{x:u-22,y:d-13,width:44,height:26,rx:4,fill:"rgba(70,216,255,0.10)",stroke:"#46d8ff","stroke-width":1.2,opacity:0},n);o.push({a:f,box:g})}let l=O("text",{x:s,y:r+160,"text-anchor":"middle",class:"t-label"},n);l.textContent="\u540C\u4E00\u4EFD\u8D1F\u8F7D \xB7 \u5206\u7247\u5230 8 \u9897 GPU",this.nodes.tr05={g:n,core:a,arrows:o,label:l}}{let n=Nt(this.g,"tr06"),s=[];for(let a=0;a<5;a++){let o=t*.16+a*t*.17,l=e*.5,c=O("path",{d:`M ${o-46} ${l-20} l 30 -16 l 62 0 l 30 16 l -30 16 l -62 0 Z`,stroke:"#8fb8e8","stroke-width":1.3,fill:"rgba(143,184,232,0.06)",opacity:0},n),h=O("rect",{x:o-46,y:l-26,width:92,height:52,rx:5,stroke:"#46d8ff","stroke-width":1.4,fill:"rgba(70,216,255,0.06)",opacity:0},n);s.push({iso:c,flat:h})}let r=O("text",{x:t*.5,y:e*.72,"text-anchor":"middle",class:"t-label"},n);r.textContent="\u7CFB\u7EDF\u6A21\u578B \u2192 \u5BF9\u7167\u89C6\u56FE\u4E2D\u7684\u4EA7\u54C1\u56FE\u5F62\uFF08\u7ED3\u6784\u4E00\u4E00\u5BF9\u5E94\uFF09",this.nodes.tr06={g:n,items:s,label:r}}{let n=Nt(this.g,"tr07"),s=t*.5,r=e*.5,a=O("rect",{x:s-60,y:r-42,width:120,height:84,rx:6,fill:"none",stroke:"#d98a4b","stroke-width":1.6,opacity:0},n),o=O("rect",{x:s-60,y:r-42,width:120,height:84,rx:6,fill:"none",stroke:"#9bebff","stroke-width":1.4,opacity:0},n),l=O("rect",{x:s-34,y:r-18,width:28,height:36,rx:3,fill:"rgba(217,138,75,0.16)",stroke:"#d98a4b",opacity:0},n),c=O("rect",{x:s+6,y:r-18,width:28,height:36,rx:3,fill:"rgba(70,216,255,0.16)",stroke:"#46d8ff",opacity:0},n),h=O("text",{x:s,y:r+110,"text-anchor":"middle",class:"t-label"},n);h.textContent="B200 \u5BF9\u7167\u884C \u2192 \u56DE\u5230\u6574\u9897\u5C01\u88C5",this.nodes.tr07={g:n,inner:a,outer:o,d1:l,d2:c,label:h}}}update(t,e){let n=jl(t),s=n.kind==="transition";for(let l of Object.values(this.nodes))l.g.setAttribute("opacity",0);if(!s)return;let r=(t-n.start)/(n.len||1),a=mt(r),o=Math.sin(Math.min(1,r)*Math.PI);if(n.id==="tr01-02"){let l=this.nodes.tr01;l.g.setAttribute("opacity",o);for(let c=0;c<l.layers.length;c++)l.layers[c].setAttribute("opacity",mt(yt(r,c*.12,.3+c*.12))*.85),l.layers[c].setAttribute("transform",`translate(0, ${(-a*34*(c-2)).toFixed(1)})`);l.label.setAttribute("opacity",mt(yt(r,.1,.5)))}else if(n.id==="tr02-03"){let l=this.nodes.tr02;l.g.setAttribute("opacity",o);let c=Ge(1,.42,a);l.frame.setAttribute("opacity",.9),l.frame.setAttribute("transform",`translate(${this.W*.5*(1-c)}, ${this.H*.5*(1-c)}) scale(${c})`),l.cross.setAttribute("opacity",mt(yt(r,.35,.75))),l.label.setAttribute("opacity",mt(yt(r,.15,.5)))}else if(n.id==="tr03-04"){let l=this.nodes.tr03;l.g.setAttribute("opacity",o),l.path.setAttribute("opacity",.85),l.pulses.update(e,o),l.outline.setAttribute("opacity",mt(yt(r,.25,.7)));for(let c=0;c<l.lines.length;c++)l.lines[c].setAttribute("opacity",mt(yt(r,.35+c*.05,.55+c*.05))*.9);l.label.setAttribute("opacity",mt(yt(r,.2,.6)))}else if(n.id==="tr04-05"){let l=this.nodes.tr04;l.g.setAttribute("opacity",o);let c=mt(yt(r,.25,.8));l.cube.setAttribute("opacity",1-c*.92),l.cube.setAttribute("transform",`scale(${Ge(1,.5,c)}) translate(${(1-c)*0}, ${Ge(0,-40,c)})`);for(let h=0;h<l.cells.length;h++)l.cells[h].setAttribute("opacity",c*.95),l.cells[h].setAttribute("transform",`translate(0, ${Ge(-70,0,c)})`);l.label.setAttribute("opacity",mt(yt(r,.2,.6)))}else if(n.id==="tr05-06"){let l=this.nodes.tr05;l.g.setAttribute("opacity",o),l.core.setAttribute("opacity",.95);for(let c=0;c<l.arrows.length;c++){let h=mt(yt(r,.12+c*.06,.5+c*.06));l.arrows[c].a.setAttribute("opacity",h*.85),l.arrows[c].box.setAttribute("opacity",h)}l.label.setAttribute("opacity",mt(yt(r,.15,.55)))}else if(n.id==="tr06-07"){let l=this.nodes.tr06;l.g.setAttribute("opacity",o);for(let c=0;c<l.items.length;c++){let h=mt(yt(r,.1+c*.08,.45+c*.08));l.items[c].iso.setAttribute("opacity",(1-h)*.9),l.items[c].flat.setAttribute("opacity",h*.95)}l.label.setAttribute("opacity",mt(yt(r,.2,.6)))}else if(n.id==="tr07-08"){let l=this.nodes.tr07;l.g.setAttribute("opacity",o);let c=mt(yt(r,.15,.85));l.inner.setAttribute("opacity",.95),l.outer.setAttribute("opacity",.9);let h=Ge(1,2.6,c);l.outer.setAttribute("transform",`translate(${this.W*.5*(1-h)}, ${this.H*.5*(1-h)}) scale(${h})`),l.outer.setAttribute("opacity",.9*(1-c*.85)),l.d1.setAttribute("opacity",mt(yt(r,.1,.5))),l.d2.setAttribute("opacity",mt(yt(r,.18,.58))),l.label.setAttribute("opacity",mt(yt(r,.15,.55)))}}};function tt(i,t={},e=[]){let n=document.createElement(i);for(let s in t)s==="html"?n.innerHTML=t[s]:s==="text"?n.textContent=t[s]:s.startsWith("on")?n.addEventListener(s.slice(2),t[s]):n.setAttribute(s,t[s]);for(let s of e)n.appendChild(s);return n}var Og=[{id:"b1-hero",ch:"ch01",at:[0,.42],style:{left:"17%",top:"24%"},html:`
      <div class="kicker">01 \xB7 FULL PACKAGE</div>
      <h1>\u4E24\u9897\u6676\u7C92<br>\u4E00\u9897 GPU</h1>
      <p>NVIDIA B200 \u5C06\u4E24\u9897<strong class="accent">\u5149\u7F69\u6781\u9650\u5C3A\u5BF8</strong>\u7684\u8BA1\u7B97\u6676\u7C92\u7528
      <span class="num">10 TB/s</span> \u7247\u95F4\u4E92\u8FDE\u7F1D\u5408\u6210\u4E00\u4E2A\u7EDF\u4E00\u7684 GPU\u3002
      \u4ECE\u5B8C\u6574\u5C01\u88C5\u51FA\u53D1\uFF0C\u5411\u4E0B\u62C6\u5F00\u6BCF\u4E00\u5C42\u3002</p>
      <div class="tag-row">
        <span class="tag copper">2080 \u4EBF\u6676\u4F53\u7BA1</span>
        <span class="tag cyan">NV-HBI 10 TB/s</span>
        <span class="tag">TSMC 4NP</span>
      </div>`},{id:"b1-scale",ch:"ch01",at:[.38,.72],style:{left:"17%",top:"22%"},html:`
      <div class="kicker">\u89C4\u6A21 \xB7 SCALE</div>
      <h2>2080 \u4EBF\u4E2A\u6676\u4F53\u7BA1<br>\u5982\u4F55\u843D\u5728\u4E24\u9897\u6676\u7C92\u4E0A</h2>
      <p>\u6BCF\u9897\u6676\u7C92\u90FD\u662F\u4E00\u6574\u5757\u5149\u7F69\u6781\u9650\u7684\u7845\uFF1B\u4E24\u9897\u5E76\u6392\uFF0C\u4E2D\u95F4\u662F\u7247\u95F4\u4E92\u8FDE\u6865\u3002
      \u5916\u56F4\u516B\u7EC4 HBM3e \u5806\u6808\u628A\u663E\u5B58\u8D34\u88C5\u5230\u6676\u7C92\u65C1\u8FB9\uFF0C\u8D70\u7EBF\u6700\u77ED\u3002</p>
      <div class="stat-grid">
        <div class="stat hot"><div class="label">\u6676\u4F53\u7BA1</div><div class="value">2080<i>\u4EBF</i></div></div>
        <div class="stat"><div class="label">\u8BA1\u7B97\u6676\u7C92</div><div class="value">2<i>\u9897</i></div></div>
        <div class="stat"><div class="label">HBM3e \u5806\u6808</div><div class="value">8<i>\u7EC4</i></div></div>
        <div class="stat"><div class="label">\u7247\u95F4\u4E92\u8FDE</div><div class="value">10<i>TB/s</i></div></div>
      </div>`},{id:"b1-enter",ch:"ch01",at:[.72,.98],style:{left:"17%",top:"30%"},html:`
      <div class="kicker">\u8FDB\u5165 \xB7 TEARDOWN</div>
      <h2>\u63A5\u4E0B\u6765\u9010\u5C42\u5C55\u5F00</h2>
      <p>\u710A\u7403\u3001\u57FA\u677F\u3001\u4E2D\u4ECB\u5C42\u3001\u6676\u7C92\u3001\u663E\u5B58\u5806\u6808\u2014\u2014\u6BCF\u4E00\u5C42\u90FD\u6709\u539A\u5EA6\u3001\u8D70\u7EBF\u4E0E\u8FDE\u63A5\u3002
      \u6EDA\u52A8\u5373\u62C6\u89E3\uFF1B\u4E2D\u9014\u505C\u4E0B\uFF0C\u5C31\u505C\u5728\u90A3\u4E00\u5C42\u3002</p>`},{id:"b2-title",ch:"ch02",at:[.02,.18],style:{right:"5%",top:"16%"},html:`
      <div class="kicker">02 \xB7 TEARDOWN</div>
      <h1>\u5C01\u88C5\u62C6\u89E3</h1>
      <p>\u4ECE\u76D6\u677F\u5230\u710A\u7403\uFF0C\u516D\u4E2A\u7ED3\u6784\u5C42\u3002\u70B9\u51FB\u90E8\u4EF6\u53EF\u5355\u72EC\u67E5\u770B\u5E76\u6DF1\u5165\u4E00\u7EA7\u3002</p>`},{id:"b2-parts",ch:"ch02",at:[.14,.62],style:{right:"4%",top:"20%",width:"320px"},panel:"parts"},{id:"b2-controls",ch:"ch02",at:[.3,.86],style:{left:"16%",top:"22%",width:"300px"},panel:"explode-controls"},{id:"b2-detail",ch:"ch02",at:[.62,.95],style:{right:"4%",top:"24%",width:"330px"},panel:"part-detail"},{id:"b3-title",ch:"ch03",at:[.02,.22],style:{right:"6%",top:"14%"},html:`
      <div class="kicker">03 \xB7 TWO DIES \xB7 ONE GPU</div>
      <h1>\u8DE8\u7F1D\u7684<br>\u7247\u95F4\u901A\u4FE1</h1>
      <p>\u4E24\u9897\u6676\u7C92\u901A\u8FC7 NV-HBI \u4EE5 <span class="num">10 TB/s</span> \u4E92\u8FDE\uFF0C
      \u5BF9\u8F6F\u4EF6\u5448\u73B0\u4E3A\u4E00\u9897 GPU\u3002\u70B9\u51FB\u53F3\u4FA7\u7248\u56FE\u529F\u80FD\u533A\uFF0C\u4E09\u7EF4\u4E0E\u7F29\u7565\u56FE\u540C\u6B65\u53CD\u9988\u3002</p>`},{id:"b3-flow",ch:"ch03",at:[.22,.58],style:{right:"6%",top:"18%",width:"340px"},html:`
      <div class="kicker">\u6570\u636E\u8DEF\u5F84 \xB7 DATA PATH</div>
      <h2>\u6765\u6E90 \u2192 \u8DEF\u5F84 \u2192 \u76EE\u7684\u5730</h2>
      <p>\u6570\u636E\u4ECE HBM PHY \u8FDB\u5165\u8BA1\u7B97\u533A\uFF0C\u6FC0\u6D3B Tensor \u9635\u5217\uFF0C\u518D\u8DE8\u7F1D\u62B5\u8FBE\u53E6\u4E00\u9897\u6676\u7C92\u3002
      \u63A5\u7F1D\u88AB\u62C9\u5F00\u65F6\uFF0C\u8DE8\u7F1D\u8109\u51B2\u505C\u5728\u65AD\u53E3\uFF1B\u5408\u62E2\u540E\u91CD\u65B0\u4F20\u8F93\u3002</p>
      <div class="tag-row">
        <span class="tag cyan">NV-HBI 10 TB/s</span>
        <span class="tag copper">\u53CC\u6676\u7C92\u534F\u540C</span>
        <span class="tag">\u6FC0\u6D3B\u53EF\u91CD\u653E</span>
      </div>`},{id:"b3-controls",ch:"ch03",at:[.42,.92],style:{left:"15%",top:"22%",width:"300px"},panel:"seam-controls"},{id:"b4-title",ch:"ch04",at:[.02,.2],style:{left:"17%",top:"12%"},html:`
      <div class="kicker">04 \xB7 MEMORY & BANDWIDTH</div>
      <h1>\u6A2A\u5411\u89C2\u770B<br>\u663E\u5B58\u4E0E\u5E26\u5BBD</h1>
      <p>\u672C\u7AE0\u6A2A\u5411\u63A8\u8FDB\uFF1A\u4ECE\u4E00\u4FA7 HBM3e \u5806\u6808\uFF0C\u6CBF\u8FDE\u63A5\u7A7F\u8FC7\u4E24\u9897\u6676\u7C92\u4E0E\u63A5\u7F1D\uFF0C\u5230\u53E6\u4E00\u4FA7\u663E\u5B58\u3002
      \u5BB9\u91CF\u662F\u300C\u80FD\u653E\u591A\u5C11\u300D\uFF0C\u5E26\u5BBD\u662F\u300C\u6BCF\u79D2\u642C\u591A\u5C11\u300D\u3002</p>`},{id:"b4-cap",ch:"ch04",at:[.2,.52],style:{left:"17%",top:"16%",width:"360px"},html:`
      <div class="kicker">\u5BB9\u91CF \u2260 \u5E26\u5BBD</div>
      <h2>186 GB \u5B58\u653E \xB7 8 TB/s \u642C\u8FD0</h2>
      <div class="stat-grid">
        <div class="stat"><div class="label">HBM3e \u5BB9\u91CF / \u5361</div><div class="value">186<i>GB</i></div></div>
        <div class="stat hot"><div class="label">\u5E26\u5BBD / \u5361</div><div class="value">8<i>TB/s</i></div></div>
        <div class="stat"><div class="label">\u5806\u6808\u6570</div><div class="value">8<i>\xD7 \u5206\u5C42</i></div></div>
        <div class="stat"><div class="label">\u5F53\u524D\u7CBE\u5EA6</div><div class="value" id="b4-prec">FP4</div></div>
      </div>
      <p style="margin-top:12px">\u6570\u636E\u5757\u7684\u4F4D\u5BBD\u3001\u5206\u7EC4\u4E0E\u4F20\u8F93\u6279\u6B21\u968F\u5168\u9875\u7CBE\u5EA6\u8054\u52A8\u3002</p>`},{id:"b4-loupe",ch:"ch04",at:[.42,.92],style:{right:"5%",top:"20%",width:"320px"},panel:"loupe"},{id:"b5-title",ch:"ch05",at:[.02,.16],style:{left:"17%",top:"12%"},html:`
      <div class="kicker">05 \xB7 PRECISION LAB</div>
      <h1>\u6570\u503C\u7CBE\u5EA6<br>\u4E0E\u8BA1\u7B97\u5B9E\u9A8C</h1>
      <p>\u4ECE FP64 \u5230 FP4\uFF1A\u4F4D\u5BBD\u4E0B\u964D\uFF0C\u6570\u503C\u8868\u793A\u3001\u820D\u5165\u8BEF\u5DEE\u4E0E\u541E\u5410\u540C\u65F6\u6539\u53D8\u3002
      \u4E0B\u65B9\u77E9\u9635\u5B9E\u9A8C\u6309\u8BF4\u660E\u7684\u683C\u5F0F\u771F\u5B9E\u91CF\u5316\u4E0E\u4E58\u52A0\u3002</p>`},{id:"b5-lab",ch:"ch05",at:[.12,.58],style:{left:"15%",top:"18%",width:"46%"},panel:"matrix-lab"},{id:"b5-zoom",ch:"ch05",at:[.62,.94],style:{left:"17%",top:"22%",width:"380px"},html:`
      <div class="kicker">\u9010\u7EA7\u62C9\u8FDC \xB7 ZOOM OUT</div>
      <h2>\u4E58\u79EF \u2192 \u7D2F\u52A0 \u2192 \u5F20\u91CF\u6838\u5FC3 \u2192 \u6574\u9897 GPU</h2>
      <p>\u6BCF\u4E00\u6B21\u4E58\u52A0\u8FDB\u5165\u5F20\u91CF\u6838\u5FC3\u7684\u7D2F\u52A0\u5668\uFF0C\u6210\u5343\u4E0A\u4E07\u6B21\u7D2F\u52A0\u6210\u4E3A\u7ED3\u679C\u5F20\u91CF\uFF1B
      \u5F20\u91CF\u6838\u5FC3\u7EC4\u6210\u8BA1\u7B97\u533A\uFF0C\u8BA1\u7B97\u533A\u5C5E\u4E8E\u67D0\u9897\u6676\u7C92\uFF0C\u4E24\u9897\u6676\u7C92\u5408\u8D77\u6765\u662F\u4E00\u9897 B200\u3002</p>
      <div class="tag-row">
        <span class="tag copper" id="b5-fmt-tag">FP4</span>
        <span class="tag cyan">\u793A\u610F\u5DE5\u4F5C\u91CF</span>
        <span class="tag">\u5B98\u65B9\u5CF0\u503C\u53E6\u6807</span>
      </div>`},{id:"b6-title",ch:"ch06",at:[.02,.18],style:{left:"17%",top:"12%"},html:`
      <div class="kicker">06 \xB7 SCALE OUT</div>
      <h1>\u4ECE\u4E00\u9897 GPU<br>\u5230\u4E00\u6574\u673A\u67DC</h1>
      <p>HGX B200 \u516B\u5361\u57FA\u677F \u2192 DGX B200 \u670D\u52A1\u5668 \u2192 GB200 \u8D85\u7EA7\u82AF\u7247 \u2192 GB200 NVL72 \u673A\u67DC\u3002
      \u4E09\u7EF4\u7CFB\u7EDF\u4E0E\u4E8C\u7EF4\u62D3\u6251\u540C\u6B65\u8054\u52A8\u3002</p>`},{id:"b6-chain",ch:"ch06",at:[.14,.46],style:{right:"5%",top:"14%",width:"340px"},html:`
      <div class="kicker">\u5E73\u53F0\u7EC4\u6210 \xB7 PLATFORMS</div>
      <h2>\u4E0D\u8981\u6DF7\u7528\u4E24\u7C7B\u5E73\u53F0</h2>
      <p><b class="accent">HGX / DGX B200</b>\uFF1A\u516B\u9897 B200 + NVLink\uFF0Cx86 \u670D\u52A1\u5668\u3002<br>
      <b class="accent">GB200</b>\uFF1A1 \u9897 Grace CPU + 2 \u9897 B200\uFF0CNVLink-C2C 900 GB/s\u3002<br>
      <b class="accent">GB200 NVL72</b>\uFF1A36 Grace + 72 GPU\uFF0C\u6DB2\u51B7\u673A\u67DC\uFF0CNVLink \u57DF 130 TB/s\u3002</p>`},{id:"b6-task",ch:"ch06",at:[.4,.88],style:{right:"5%",top:"18%",width:"360px"},panel:"shard-task"},{id:"b7-title",ch:"ch07",at:[.02,.2],style:{left:"17%",top:"11%"},html:`
      <div class="kicker">07 \xB7 SPEC MATRIX</div>
      <h1>\u89C4\u683C\u5BF9\u7167</h1>
      <p>\u5355\u5361\u6307\u6807\u4E0E\u7CFB\u7EDF\u603B\u91CF\u5206\u5F00\u5217\u793A\uFF1B\u7B97\u529B\u6CE8\u660E\u7CBE\u5EA6\u4E0E\u7A20\u5BC6\uFF0F\u7A00\u758F\u53E3\u5F84\u3002\u70B9\u51FB\u4EA7\u54C1\u6216\u8868\u683C\u884C\uFF0C\u524D\u9762\u7AE0\u8282\u7684\u5BF9\u5E94\u7ED3\u6784\u540C\u6B65\u53CD\u9988\u3002</p>`},{id:"b7-table",ch:"ch07",at:[.16,.92],style:{left:"15%",top:"56%",width:"82%"},panel:"spec-table"},{id:"b8-title",ch:"ch08",at:[.02,.2],style:{left:"17%",top:"12%"},html:`
      <div class="kicker">08 \xB7 WHOLE AGAIN</div>
      <h1>\u56DE\u5230\u6574\u9897 GPU</h1>
      <p>\u4E03\u7EC4\u6807\u6CE8\u843D\u5728\u5BF9\u5E94\u7ED3\u6784\u4E0A\uFF1ATransformer Engine\u3001\u7247\u95F4\u4E92\u8FDE\u3001\u89E3\u538B\u7F29\u5F15\u64CE\u3001
      HBM3e\u3001NVLink\u3001RAS \u4E0E\u673A\u5BC6\u8BA1\u7B97\u3001\u529F\u8017\u3002\u6240\u9009\u7CBE\u5EA6\u7EE7\u7EED\u751F\u6548\u3002</p>`},{id:"b8-end",ch:"ch08",at:[.72,.99],style:{left:"17%",top:"24%"},html:`
      <div class="kicker">\u6536\u675F \xB7 FINALE</div>
      <h2>\u73B0\u5728\uFF0C\u8FD9\u9897 GPU<br>\u5728\u4F60\u5FC3\u91CC\u53EF\u4EE5\u62C6\u5F00\u3001\u4E5F\u53EF\u4EE5\u5408\u4E0A</h2>
      <p>\u5F00\u5934\u7684\u5B8C\u6574\u5C01\u88C5\uFF0C\u5C31\u662F\u521A\u624D\u6240\u6709\u5C40\u90E8\u7684\u603B\u548C\uFF1A\u53CC\u6676\u7C92\u3001\u516B\u7EC4\u663E\u5B58\u3001
      \u5341 TB/s \u7684\u7247\u95F4\u4E92\u8FDE\u3001\u4EE5\u53CA\u628A\u5B83\u4EEC\u8FDE\u6210\u7CFB\u7EDF\u7684 NVLink\u3002</p>
      <div class="tag-row">
        <span class="tag copper" id="b8-fmt">FP4</span>
        <span class="tag cyan" id="b8-ops">\u5DE5\u4F5C\u91CF\u8BFB\u6570 \u2014</span>
        <span class="tag">\u6982\u5FF5\u8BBE\u8BA1\u4F5C\u54C1</span>
      </div>`}],Ao=class{constructor(t){this.root=t,this.items=[],this.panels={};for(let e of Og){let n=tt("div",{class:"panel"});n.style.left=e.style.left||"auto",n.style.right=e.style.right||"auto",n.style.top=e.style.top||"auto",e.style.width&&(n.style.width=e.style.width);let s=tt("div",{class:"beat"+(e.style.width?" wide":"")});e.html&&(s.innerHTML=e.html),n.appendChild(s),t.appendChild(n);let r={def:e,panel:n,beat:s};this.items.push(r),e.panel&&(this.panels[e.panel]=s)}}update(t,e){for(let n of this.items){let s=Ve(n.def.ch,t),[r,a]=n.def.at,o=r<=0?1:mt(yt(s,r,r+.055)),l=a>=.99?1:1-mt(yt(s,a-.05,a)),c=Math.min(o,l);n.beat.style.opacity=c.toFixed(3),n.beat.style.transform=`translateY(${((1-o)*26).toFixed(1)}px)`,n.panel.style.pointerEvents=c>.25?"auto":"none",n.panel.style.visibility=c>.01?"visible":"hidden"}}};var xs={lid:{name:"\u76D6\u677F\u4E0E\u52A0\u56FA\u6846\u67B6",desc:"\u954D\u94DC\u76D6\u677F\u4E0E\u5468\u8FB9\u52A0\u56FA\u6846\uFF0C\u538B\u4F4F\u6676\u7C92\u4E0E\u663E\u5B58\u5E76\u5BFC\u70ED\u3002\u62C6\u89E3\u7B2C\u4E00\u6B65\u5148\u62AC\u5F00\u76D6\u677F\u3002"},dieA:{name:"\u8BA1\u7B97\u6676\u7C92 A",desc:"\u5149\u7F69\u6781\u9650\u5C3A\u5BF8\u7845\u7247\u3002\u9876\u9762\u662F Tensor \u9635\u5217\u3001L2 \u4E0E\u63A5\u53E3\u533A\uFF1B\u5E95\u9762\u662F\u5FAE\u51F8\u70B9\u3002\u4E0E\u6676\u7C92 B \u4EE5 NV-HBI \u76F8\u8FDE\u3002"},dieB:{name:"\u8BA1\u7B97\u6676\u7C92 B",desc:"\u4E0E\u6676\u7C92 A \u955C\u50CF\u5BF9\u79F0\uFF0C\u5171\u540C\u7EC4\u6210\u4E00\u9897 GPU\u3002\u4E24\u9897\u6676\u7C92\u5171\u4EAB\u7EDF\u4E00\u7684\u663E\u5B58\u4E0E NVLink \u57DF\u3002"},bridge:{name:"\u7247\u95F4\u4E92\u8FDE\u6865 NV-HBI",desc:"\u4E24\u9897\u6676\u7C92\u4E4B\u95F4\u7684\u9AD8\u5BC6\u5EA6\u4E92\u8FDE\uFF0C10 TB/s\u3002\u62C9\u5F00\u63A5\u7F1D\u65F6\uFF0C\u8DE8\u7F1D\u4F20\u8F93\u5728\u65AD\u53E3\u5904\u505C\u6B62\u3002"},interposer:{name:"\u7845\u4E2D\u4ECB\u5C42",desc:"\u628A\u6676\u7C92\u4E0E\u663E\u5B58\u7684\u5FAE\u51F8\u70B9\u6247\u51FA\u5230\u57FA\u677F\uFF0C\u8868\u9762\u6709\u7EC6\u5BC6\u8D70\u7EBF\uFF0C\u8FDE\u63A5\u6676\u7C92\u4E4B\u95F4\u4E0E\u663E\u5B58\u4E4B\u95F4\u7684\u901A\u9053\u3002"},substrate:{name:"\u6709\u673A\u57FA\u677F",desc:"\u591A\u5C42\u94DC\u8D70\u7EBF\u7684\u6709\u673A\u57FA\u677F\uFF0C\u628A\u4E2D\u4ECB\u5C42\u4FE1\u53F7\u5F15\u5230 BGA \u710A\u7403\u3002\u542B\u82AF\u677F\u4E0E\u56DB\u5C42\u94DC\uFF08\u5256\u5207\u53EF\u89C1\uFF09\u3002"},balls:{name:"BGA \u710A\u7403\u9635\u5217",desc:"\u5E95\u9762\u710A\u7403\u9635\u5217\uFF0C\u628A\u6574\u4E2A\u5C01\u88C5\u710A\u5230\u4E3B\u677F\u3002\u6570\u91CF\u4EE5\u5343\u8BA1\uFF0C\u63D0\u4F9B\u4F9B\u7535\u4E0E\u4FE1\u53F7\u901A\u9053\u3002"},caps:{name:"\u53BB\u8026\u5143\u4EF6",desc:"\u57FA\u677F\u5916\u56F4\u7684\u53BB\u8026\u7535\u5BB9\u9635\u5217\uFF0C\u4E3A\u6676\u7C92\u77AC\u6001\u7535\u6D41\u63D0\u4F9B\u672C\u5730\u50A8\u80FD\u3002"},hbm0:{name:"HBM3e \u5806\u6808 1",desc:"\u57FA\u5E95 + 8 \u5C42 DRAM\uFF0C\u5C42\u95F4\u5FAE\u51F8\u70B9\u4E0E\u8D2F\u7A7F\u7845\u901A\u5B54\uFF08TSV\uFF09\u3002\u53EF\u5355\u72EC\u5C55\u5F00\u67E5\u770B\u5C42\u7ED3\u6784\u3002"}};for(let i=0;i<8;i++)xs["hbm"+i]||(xs["hbm"+i]={name:`HBM3e \u5806\u6808 ${i+1}`,desc:"\u57FA\u5E95 + 8 \u5C42 DRAM\uFF0C\u5C42\u95F4\u5FAE\u51F8\u70B9\u4E0E\u8D2F\u7A7F\u7845\u901A\u5B54\uFF08TSV\uFF09\u3002\u53EF\u5355\u72EC\u5C55\u5F00\u67E5\u770B\u5C42\u7ED3\u6784\u3002"});function kg(i){let t=document.getElementById("toast");t||(t=document.createElement("div"),t.id="toast",document.body.appendChild(t)),t.textContent=i,t.classList.add("show"),clearTimeout(t._timer),t._timer=setTimeout(()=>t.classList.remove("show"),2200)}var Co=class{constructor(t){this.beats=t,this.buildParts(),this.buildExplodeControls(),this.buildPartDetail(),this.buildSeamControls(),this.buildMatrixLab(),this.buildLoupe(),this.buildShardTask(),this.buildSpecTable()}buildParts(){let t=this.beats.panels.parts;if(!t)return;t.appendChild(tt("div",{class:"control-panel",html:"<h4>\u90E8\u4EF6 \xB7 PARTS</h4>"}));let e=t.querySelector(".control-panel"),n=tt("div",{class:"part-list"}),s=["lid","dieA","dieB","bridge","interposer","substrate","balls","caps","hbm0"];this.partButtons={};for(let a of s){let o=xs[a]||{name:a,desc:""},l=tt("button",{class:"part-item",type:"button",onclick:()=>{k.set("selectedPart",k.selectedPart===a?null:a,"select")}},[tt("span",{text:o.name}),tt("span",{class:"pmark",text:a.toUpperCase()})]);n.appendChild(l),this.partButtons[a]=l}e.appendChild(n);let r=tt("div",{class:"part-desc",id:"part-desc"});r.textContent="\u9009\u62E9\u90E8\u4EF6\uFF1A\u4E09\u7EF4\u3001\u7EBF\u7A3F\u4E0E\u672C\u5217\u8868\u540C\u6B65\u9AD8\u4EAE\u3002",e.appendChild(r),this.partDesc=r}buildExplodeControls(){let t=this.beats.panels["explode-controls"];if(!t)return;let e=tt("div",{class:"control-panel"});e.appendChild(tt("h4",{text:"\u62C6\u89E3\u4E0E\u5256\u5207 \xB7 CONTROLS"})),e.appendChild(tt("div",{class:"ctrl-row"},[tt("span",{class:"ctrl-label",text:"\u5C55\u5F00\u7A0B\u5EA6"}),tt("input",{type:"range",min:0,max:100,value:0,id:"rng-explode",oninput:n=>{let s=n.target.value/100;k.set("explode",s,"explode"),window.__scene&&window.__scene.setUserExplode(s),n.target.style.setProperty("--fill",s*100+"%")}}),tt("span",{class:"ctrl-value",id:"val-explode",text:"0%"})])),e.appendChild(tt("div",{class:"ctrl-row"},[tt("button",{class:"action secondary",type:"button",text:"\u8DDF\u968F\u6EDA\u52A8",onclick:()=>{window.__scene&&window.__scene.clearUserExplode();let n=document.getElementById("rng-explode");n&&(n.value=0,n.style.setProperty("--fill","0%"));let s=document.getElementById("val-explode");s&&(s.textContent="\u81EA\u52A8"),k.set("explode",0,"explode")}}),tt("button",{class:"action secondary",type:"button",text:"\u5168\u90E8\u5C55\u5F00",onclick:()=>{window.__scene&&window.__scene.setUserExplode(1);let n=document.getElementById("rng-explode");n&&(n.value=100,n.style.setProperty("--fill","100%"));let s=document.getElementById("val-explode");s&&(s.textContent="100%"),k.set("explode",1,"explode")}})])),e.appendChild(tt("div",{class:"ctrl-row"},[tt("span",{class:"ctrl-label",text:"\u5256\u5207\u4F4D\u7F6E"}),tt("input",{type:"range",min:0,max:100,value:0,id:"rng-cut",oninput:n=>{let s=n.target.value/100;k.set("cutaway",s,"cutaway"),n.target.style.setProperty("--fill",s*100+"%");let r=document.getElementById("val-cut");r&&(r.textContent=Math.round(s*100)+"%")}}),tt("span",{class:"ctrl-value",id:"val-cut",text:"0%"})])),e.appendChild(tt("p",{class:"part-desc",text:"\u5256\u5207\u663E\u793A\u5177\u6709\u539A\u5EA6\u7684\u5B9E\u5FC3\u622A\u9762\u4E0E\u4E0D\u540C\u6750\u6599\u5185\u90E8\u5C42\u6B21\uFF1B\u53F3\u4FA7\u4E8C\u7EF4\u5256\u9762\u540C\u6B65\u79FB\u52A8\u3002"})),t.appendChild(e)}buildPartDetail(){let t=this.beats.panels["part-detail"];if(!t)return;let e=tt("div",{class:"control-panel"});e.appendChild(tt("h4",{text:"\u6DF1\u5165\u4E00\u7EA7 \xB7 DETAIL"})),this.detailBody=tt("div",{class:"part-desc"}),this.detailBody.innerHTML="\u9009\u4E2D\u90E8\u4EF6\u540E\uFF0C\u8FD9\u91CC\u663E\u793A\u66F4\u7EC6\u4E00\u5C42\u7684\u7ED3\u6784\u8BF4\u660E\u4E0E\u6570\u636E\u5206\u533A\u3002",e.appendChild(this.detailBody),e.appendChild(tt("h4",{text:"DRAM \u903B\u8F91\u5206\u533A\uFF08\u968F\u7CBE\u5EA6\u8054\u52A8\uFF09",style:"margin-top:14px"})),this.dramBars=tt("div",{id:"dram-partition"}),e.appendChild(this.dramBars),t.appendChild(e)}buildSeamControls(){let t=this.beats.panels["seam-controls"];if(!t)return;let e=tt("div",{class:"control-panel"});e.appendChild(tt("h4",{text:"\u63A5\u7F1D \xB7 DIE SEAM"})),e.appendChild(tt("div",{class:"ctrl-row"},[tt("span",{class:"ctrl-label",text:"\u62C9\u5F00\u63A5\u7F1D"}),tt("input",{type:"range",min:0,max:100,value:0,id:"rng-seam",oninput:n=>{let s=n.target.value/100;k.set("dieSeamGap",s,"seam"),n.target.style.setProperty("--fill",s*100+"%");let r=document.getElementById("val-seam");r&&(r.textContent=s>.35?"\u5DF2\u65AD\u5F00":Math.round(s*100)+"%")}}),tt("span",{class:"ctrl-value",id:"val-seam",text:"0%"})])),this.seamState=tt("div",{class:"part-desc",text:"\u63A5\u7F1D\u62C9\u8DDD > 35% \u65F6\uFF0C\u8DE8\u7F1D\u8109\u51B2\u505C\u5728\u65AD\u53E3\uFF1B\u5408\u62E2\u540E\u91CD\u65B0\u4F20\u8F93\u3002"}),e.appendChild(this.seamState),e.appendChild(tt("div",{class:"ctrl-row"},[tt("button",{class:"action",type:"button",text:"\u91CD\u653E\u901A\u4FE1\u8FC7\u7A0B",onclick:()=>{k.set("dieSeamGap",0,"seam");let n=document.getElementById("rng-seam");n&&(n.value=0,n.style.setProperty("--fill","0%")),window.__replayTime=performance.now()/1e3}})])),t.appendChild(e)}buildMatrixLab(){let t=this.beats.panels["matrix-lab"];if(!t)return;let e=tt("div",{class:"control-panel"});e.appendChild(tt("h4",{text:"\u77E9\u9635\u5B9E\u9A8C \xB7 QUANTIZED MATMUL"}));let n=tt("div",{class:"seg",role:"group","aria-label":"\u5B9E\u9A8C\u7CBE\u5EA6"});for(let r of["FP16","FP8","FP4"])n.appendChild(tt("button",{type:"button",text:r,"data-fmt":r,"aria-pressed":String(k.precision===r),onclick:()=>{k.setPrecision(r),this.syncMatrixLab()}}));e.appendChild(tt("div",{class:"ctrl-row"},[tt("span",{class:"ctrl-label",text:"\u5B9E\u9A8C\u683C\u5F0F"}),n])),e.appendChild(tt("div",{class:"ctrl-row"},[tt("span",{class:"ctrl-label",text:"\u8BA1\u7B97\u6A21\u5F0F"}),tt("div",{class:"seg"},[tt("button",{type:"button",text:"\u7A20\u5BC6",id:"btn-dense","aria-pressed":String(!k.sparse),onclick:()=>{k.set("sparse",!1,"sparse"),k.save(),this.syncMatrixLab()}}),tt("button",{type:"button",text:"\u7A00\u758F",id:"btn-sparse","aria-pressed":String(k.sparse),onclick:()=>{k.set("sparse",!0,"sparse");for(let r=0;r<4;r++)r%2===0&&k.setMat("A",r,1,0),r%2===1&&k.setMat("B",r,2,0);k.save(),this.syncMatrixLab()}})]),tt("button",{class:"action secondary",type:"button",text:"\u91CD\u7F6E\u8F93\u5165",onclick:()=>{k.resetMat(),this.syncMatrixLab()}})]));let s=tt("div",{class:"mat-row"});this.gridA=this.makeGrid("A"),this.gridB=this.makeGrid("B"),this.gridQ=this.makeGrid("Q",!0),this.gridE=this.makeGrid("E",!0),s.appendChild(this.gridA.block),s.appendChild(tt("div",{class:"mat-op",text:"\xD7"})),s.appendChild(this.gridB.block),s.appendChild(tt("div",{class:"mat-op",text:"="})),s.appendChild(this.gridQ.block),s.appendChild(tt("div",{class:"mat-op",text:"\u0394"})),s.appendChild(this.gridE.block),e.appendChild(s),this.readout=tt("div",{class:"readout-strip"}),e.appendChild(this.readout),this.opsRunning=!1,this.opsT0=0,this.opsAcc=0,this.opsBase=0,this.opsRow=tt("div",{class:"ctrl-row",style:"margin-top:8px"},[tt("button",{class:"action",type:"button",text:"\u25B6 \u6301\u7EED\u8FD0\u884C",id:"btn-ops-run",onclick:()=>{this.opsRunning=!this.opsRunning;let r=document.getElementById("btn-ops-run");r&&(r.textContent=this.opsRunning?"\u275A\u275A \u6682\u505C":"\u25B6 \u6301\u7EED\u8FD0\u884C",r.classList.toggle("on",this.opsRunning)),this.opsRunning&&this._now!=null?(this.opsT0=this._now,this.opsBase=this.opsAcc):this.opsRunning||(this.opsBase=this.opsAcc)}}),tt("button",{class:"action secondary",type:"button",text:"\u6E05\u96F6",onclick:()=>{this.opsAcc=0,this.opsBase=0,this.opsT0=this._now||0,this.updateOpsRead()}})]),e.appendChild(this.opsRow),this.opsRead=tt("div",{class:"readout-strip",html:'<span>\u7D2F\u8BA1\u8FD0\u7B97\u91CF <b id="ops-acc">0</b> OP\uFF08\u793A\u610F\u5DE5\u4F5C\u91CF\uFF09\xB7 \u6F14\u793A\u901F\u7387\u4E0E\u5B98\u65B9\u5CF0\u503C\u5206\u5217</span>'}),e.appendChild(this.opsRead),this.traceBox=tt("div",{class:"part-desc",style:"margin-top:8px"}),this.traceBox.textContent="\u70B9\u51FB\u7ED3\u679C\u5143\u7D20\uFF0C\u8FFD\u8E2A\u5B83\u53C2\u4E0E\u7684\u4E58\u52A0\u3002",e.appendChild(this.traceBox),t.appendChild(e),this.syncMatrixLab()}makeGrid(t,e=!1){let n=tt("div",{class:"mat-block"}),s=tt("div",{class:"mat-title",text:t==="A"?"\u8F93\u5165 A":t==="B"?"\u8F93\u5165 B":t==="Q"?"\u91CF\u5316\u7ED3\u679C C":"\u8BEF\u5DEE \u0394"}),r=tt("div",{class:"mat-grid n4"}),a=[];for(let o=0;o<4;o++)for(let l=0;l<4;l++)if(e){let c=tt("div",{class:"mat-cell",tabindex:"0",role:"button",onclick:()=>{t==="Q"&&(k.set("traceIJ",[o,l],"trace"),this.showTrace(o,l))}});r.appendChild(c),a.push(c)}else{let c=tt("input",{class:"mat-cell",type:"text","data-i":o,"data-j":l,onchange:h=>{let u=parseFloat(h.target.value);Number.isFinite(u)&&k.setMat(t,o,l,u),this.syncMatrixLab()}});r.appendChild(c),a.push(c)}return n.appendChild(s),n.appendChild(r),{block:n,grid:r,cells:a,which:t}}syncMatrixLab(){let t=k.precision==="TF32"||k.precision==="BF16"||k.precision==="FP64"?"FP16":k.precision;for(let f=0;f<4;f++)for(let g=0;g<4;g++){let x=this.gridA.cells[f*4+g],m=this.gridB.cells[f*4+g];document.activeElement!==x&&(x.value=k.matA[f][g].toFixed(2)),document.activeElement!==m&&(m.value=k.matB[f][g].toFixed(2))}let e=_n(k.matA,t),n=_n(k.matB,t),s=gs(e.mat,n.mat),r=gs(k.matA,k.matB),a=0;for(let f=0;f<4;f++)for(let g=0;g<4;g++){let x=f*4+g;this.gridQ.cells[x].textContent=s[f][g].toFixed(3);let m=s[f][g]-r[f][g];a=Math.max(a,Math.abs(m));let p=this.gridE.cells[x];p.textContent=m.toFixed(3),p.classList.toggle("err",Math.abs(m)>.05)}document.getElementById("btn-dense")?.setAttribute("aria-pressed",String(!k.sparse)),document.getElementById("btn-sparse")?.setAttribute("aria-pressed",String(k.sparse));let o=ec(k.matA),l=ec(k.matB),c=o*l/4*4,h=Fn(),u=ei[k.precision]||ei.FP4,d=k.precision==="FP4"?"FP4 (NVFP4, 16 \u503C\u5171\u4EAB E4M3 \u7F29\u653E)":k.precision;this.readout.innerHTML=`
      <span>\u683C\u5F0F <b>${d}</b></span>
      <span>\u91CF\u5316\u5757\u7F29\u653E <b>${t==="FP4"?e.scale.toFixed(4):"\u2014"}</b></span>
      <span>\u6700\u5927\u7ED3\u679C\u8BEF\u5DEE <b class="${a>.05?"warn":""}">${a.toFixed(4)}</b></span>
      <span>\u975E\u96F6 A/B <b>${o}/${l}</b></span>
      <span>\u53C2\u4E0E\u4E58\u52A0 <b>${k.sparse?Math.round(c):64}</b></span>
      <span>\u8D1F\u8F7D <b>${Ti(h.bytes)}</b> \u2192 <b>${h.gpusNeeded} GPU</b></span>
      <span>\u5B98\u65B9\u5CF0\u503C <b>${u.dense} ${u.unit}</b> \u7A20\u5BC6 / <b>${u.sparse}</b> \u7A00\u758F</span>`;for(let f of this.beats.panels["matrix-lab"]?.querySelectorAll("[data-fmt]")||[])f.setAttribute("aria-pressed",String(f.getAttribute("data-fmt")===k.precision))}showTrace(t,e){let n=k.precision==="TF32"||k.precision==="BF16"||k.precision==="FP64"?"FP16":k.precision,s=_n(k.matA,n),r=_n(k.matB,n),a=yu(s.mat,r.mat,t,e);for(let l of this.gridQ.cells)l.classList.remove("trace");this.gridQ.cells[t*4+e].classList.add("trace");let o=`<b>\u8FFD\u8E2A C[${t}][${e}]</b>\uFF1A`;for(let l of a)o+=`A[${t}][${l.t}]=${l.av.toFixed(2)} \xD7 B[${l.t}][${e}]=${l.bv.toFixed(2)} \u2192 ${l.p.toFixed(3)}\uFF1B`;o+=`\u7D2F\u52A0 = ${a[a.length-1].acc.toFixed(3)}`,this.traceBox.innerHTML=o}buildLoupe(){let t=this.beats.panels.loupe;if(!t)return;let e=tt("div",{class:"control-panel"});e.appendChild(tt("h4",{text:"\u5C40\u90E8\u89C2\u5BDF\u7A97 \xB7 LOUPE"})),e.appendChild(tt("p",{class:"part-desc",text:"\u62D6\u52A8\u4E0B\u65B9\u89C2\u5BDF\u7A97\uFF0C\u5728\u4E8C\u7EF4\u7248\u56FE\u540C\u4E00\u4F4D\u7F6E\u770B\u5230\u66F4\u6DF1\u5165\u7684\u4E09\u7EF4\u7ED3\u6784\u4E0E\u6D41\u52A8\u6570\u636E\uFF08\u653E\u5927 + \u6298\u5C04\u8868\u73B0\uFF09\u3002"}));let n=tt("div",{style:"margin-top:10px;position:relative;height:180px;border:1px solid rgba(130,175,230,0.25);border-radius:10px;overflow:hidden;background:rgba(8,14,24,0.7);cursor:grab;"});this.loupeCanvas=tt("canvas",{width:520,height:300,style:"width:100%;height:100%;display:block"}),n.appendChild(this.loupeCanvas),this.loupeWrap=n,e.appendChild(n);let s=!1;this.loupePos={x:.5,y:.5};let r=a=>{let o=n.getBoundingClientRect();this.loupePos.x=Math.min(1,Math.max(0,(a.clientX-o.left)/o.width)),this.loupePos.y=Math.min(1,Math.max(0,(a.clientY-o.top)/o.height))};n.addEventListener("pointerdown",a=>{s=!0,n.setPointerCapture(a.pointerId),n.style.cursor="grabbing",r(a)}),n.addEventListener("pointermove",a=>{s&&r(a)}),n.addEventListener("pointerup",a=>{s=!1,n.style.cursor="grab"}),e.appendChild(tt("div",{class:"ctrl-row",style:"margin-top:10px"},[tt("button",{class:"action",type:"button",text:"\u91CD\u653E\u6570\u636E\u8DEF\u5F84",onclick:()=>{window.__replayTime=performance.now()/1e3,kg("\u91CD\u653E\uFF1A\u663E\u5B58\u5C42 \u2192 \u8FDE\u63A5 \u2192 \u8BA1\u7B97\u5355\u5143")}}),tt("span",{class:"pmark",text:"\u4ECE\u4EFB\u4E00\u5806\u6808\u5230\u8BA1\u7B97\u533A"})])),t.appendChild(e)}drawLoupe(t){if(!this.loupeCanvas)return;let e=this.loupeCanvas.getContext("2d"),n=this.loupeCanvas.width,s=this.loupeCanvas.height;e.clearRect(0,0,n,s),e.fillStyle="#0a1220",e.fillRect(0,0,n,s),e.strokeStyle="rgba(70,216,255,0.25)";for(let h=0;h<n;h+=26)e.beginPath(),e.moveTo(h,0),e.lineTo(h,s),e.stroke();for(let h=0;h<s;h+=26)e.beginPath(),e.moveTo(0,h),e.lineTo(n,h),e.stroke();for(let h=0;h<8;h++){e.strokeStyle=h%2?"rgba(110,242,160,0.5)":"rgba(70,216,255,0.5)",e.lineWidth=2,e.beginPath();let u=20+h*34;e.moveTo(0,u);for(let d=0;d<=n;d+=20)e.lineTo(d,u+Math.sin(d*.02+t*1.4+h)*10);e.stroke()}let r=this.loupePos.x*n,a=this.loupePos.y*s,o=74;e.save(),e.beginPath(),e.arc(r,a,o,0,Math.PI*2),e.clip(),e.drawImage(this.loupeCanvas,r-o*.55,a-o*.55,o*1.1,o*1.1,r-o,a-o,o*2,o*2);let l=k.precision;for(let h=0;h<6;h++)e.fillStyle=`rgba(70,216,255,${.12+h*.05})`,e.fillRect(r-o,a+o-24-h*18,o*2,14);for(let h=0;h<7;h++)e.fillStyle="rgba(216,168,96,0.85)",e.fillRect(r-60+h*18,a-o*.6,6,o*1.2);for(let h=0;h<6;h++){let u=(t*.35+h/6)%1;e.fillStyle=l==="FP4"?"rgba(255,107,107,0.9)":"rgba(70,216,255,0.9)",e.fillRect(r-o+u*o*2,a-10+Math.sin(h*2)*20,14,10)}e.restore();let c=e.createRadialGradient(r,a,o*.82,r,a,o*1.06);c.addColorStop(0,"rgba(70,216,255,0)"),c.addColorStop(.72,"rgba(70,216,255,0.18)"),c.addColorStop(.88,"rgba(155,235,255,0.55)"),c.addColorStop(1,"rgba(70,216,255,0)"),e.fillStyle=c,e.beginPath(),e.arc(r,a,o*1.08,0,Math.PI*2),e.fill()}buildShardTask(){let t=this.beats.panels["shard-task"];if(!t)return;let e=tt("div",{class:"control-panel"});e.appendChild(tt("h4",{text:"\u5206\u7247\u8BA1\u7B97\u4EFB\u52A1 \xB7 SHARDING"})),e.appendChild(tt("div",{class:"ctrl-row"},[tt("span",{class:"ctrl-label",text:"\u8D1F\u8F7D\u89C4\u6A21"}),tt("input",{type:"range",min:25,max:1600,value:100,id:"rng-load",oninput:n=>{let s=n.target.value/100;k.set("loadScale",s,"load"),n.target.style.setProperty("--fill",(n.target.value-25)/1575*100+"%"),this.updateShardTask()}}),tt("span",{class:"ctrl-value",id:"val-load",text:"1.0\xD7"})])),this.shardRead=tt("div",{class:"part-desc"}),e.appendChild(this.shardRead),e.appendChild(tt("div",{class:"ctrl-row"},[tt("button",{class:"action",type:"button",text:"\u4ECE GPU 1 \u91CD\u653E",onclick:()=>{k.set("shardRound",k.shardRound+1,"shard"),window.__replayTime=performance.now()/1e3}})])),e.appendChild(tt("p",{class:"part-desc",text:"\u9ED8\u8BA4\u793A\u4F8B\uFF1A\u5355\u5361 186 GB \u88C5\u4E0D\u4E0B\u6B64\u8D1F\u8F7D\uFF0C\u516B\u5361\u5206\u7247\u540E\u53EF\u5BB9\u7EB3\uFF1B\u6539\u53D8\u7CBE\u5EA6\u6216\u8D1F\u8F7D\u89C4\u6A21\u540E\u91CD\u65B0\u4F30\u7B97\u3002\u663E\u5B58\u5BB9\u91CF\u6309\u903B\u8F91\u6570\u636E\u91CF\u4F30\u7B97\uFF0C\u94FE\u8DEF\u53E3\u5F84\uFF1ANVLink 1.8 TB/s \u53CC\u5411/\u5361\u3002"})),t.appendChild(e),this.updateShardTask()}updateOpsRead(){let t=document.getElementById("ops-acc");t&&(t.textContent=On(this.opsAcc,2))}updateShardTask(){let t=Fn(),e=k.precision,n=k.precisionDef;this.shardRead&&(this.shardRead.innerHTML=`
        \u683C\u5F0F <b>${e}</b>\uFF08${n.bits} bit${e==="FP4"?" + 16 \u503C\u5171\u4EAB\u7F29\u653E \u22484.5 bit/\u503C":""}\uFF09<br>
        \u8D1F\u8F7D <b>${On(t.elements)}</b> \u503C = <b>${Ti(t.bytes)}</b><br>
        \u5355\u5361\u663E\u5B58 ${ni.hbm3eCapacity} GB \u2192 \u9700\u8981 <b>${t.gpusNeeded}</b> GPU / <b>${t.platformsNeeded}</b> \u5E73\u53F0<br>
        \u5206\u7247\u540E\u6BCF\u5361 <b>${Ti(t.perShardBytes)}</b>`);let s=document.getElementById("val-load");s&&(s.textContent=k.loadScale.toFixed(2)+"\xD7")}buildSpecTable(){let t=this.beats.panels["spec-table"];if(!t)return;let e=tt("div",{class:"spec-table-wrap"}),n=[["B200","\u5355\u9897 GPU\uFF08\u53CC\u6676\u7C92\uFF09","186 GB","8 TB/s","NVLink 1.8 TB/s","20|10","10|5","5|2.5","40 / 40","\u22481000 W"],["HGX B200","8\xD7B200 \u57FA\u677F","1.4 TB","64 TB/s","NVLink 14.4 TB/s","144|72","72","36","296 / 296","\u968F\u6574\u673A"],["DGX B200","8\xD7B200 \u670D\u52A1\u5668","1,440 GB","64 TB/s","NVLink 14.4 TB/s","144|72","72","36","296 / 296","\u224814.3 kW"],["GB200","1 Grace + 2\xD7B200","372 GB","16 TB/s","C2C 900 GB/s","40|20","20","10","80 / 80","\u22482.7 kW"],["GB200 NVL72","36 Grace + 72 GPU","13.4 TB","576 TB/s","NVLink \u57DF 130 TB/s","1,440|720","720","360","2,880 / 2,880","\u2248120\u2013132 kW"]],s=`<thead><tr>
      <th>\u4EA7\u54C1</th><th>\u7EC4\u6210</th><th>\u663E\u5B58</th><th>\u5E26\u5BBD</th><th>\u4E92\u8FDE</th>
      <th>FP4 \u7A00\u758F|\u7A20\u5BC6</th><th>FP8 \u7A00\u758F</th><th>FP16 \u7A00\u758F</th><th>FP64 / Tensor</th><th>\u529F\u8017</th>
    </tr></thead>`,r="";for(let o of n){r+=`<tr data-prod="${o[0]}"><td class="prod">${o[0]}</td><td class="dim">${o[1]}</td>`;for(let l=2;l<o.length;l++)r+=`<td class="num">${o[l]}</td>`;r+="</tr>"}e.appendChild(tt("table",{class:"spec",html:s+r+`<tfoot><tr><td colspan="10" class="foot">
      \u7B97\u529B\u5355\u4F4D PFLOPS\uFF08FP64 \u4E3A TFLOPS\uFF09\u3002\u53E3\u5F84\uFF1A\u7A00\u758F | \u7A20\u5BC6\uFF08NVIDIA GB200 NVL72 \u5B98\u65B9\u8868\uFF1BHGX/DGX B200 \u91C7\u7528\u98CE\u51B7\u914D\u7F6E\u6570\u503C\uFF0C\u4E0E GB200 \u6DB2\u51B7\u914D\u7F6E\u7684\u6BCF\u5361 20|10 PFLOPS \u7565\u6709\u5DEE\u522B\uFF09\u3002
      \u5355\u5361\u6307\u6807\u4E0E\u7CFB\u7EDF\u603B\u91CF\u5DF2\u5206\u5217\u3002\u6570\u636E\u6765\u6E90\uFF1ANVIDIA Blackwell \u53D1\u5E03\u7A3F\u3001NVIDIA DGX B200 / HGX / GB200 NVL72 \u4EA7\u54C1\u9875\u3001NVFP4 \u6280\u672F\u535A\u5BA2\u3002\u672C\u9875\u4E3A\u6982\u5FF5\u8BBE\u8BA1\u4F5C\u54C1\uFF0C\u975E NVIDIA \u5B98\u65B9\u9875\u9762\u3002
    </td></tr></tfoot>`})),t.appendChild(e),e.querySelectorAll("tr[data-prod]").forEach(o=>{o.style.cursor="pointer",o.addEventListener("click",()=>{let l=o.getAttribute("data-prod")==="HGX B200"?"HGX":o.getAttribute("data-prod")==="DGX B200"?"DGX":o.getAttribute("data-prod")==="GB200 NVL72"?"NVL72":o.getAttribute("data-prod")==="GB200"?"GB200":"B200";k.set("selectedProduct",k.selectedProduct===l?null:l,"product")})}),this.specWrap=e}update(t,e){if(this._now=e,this.opsRunning&&this.opsT0!=null){let l=(ei[k.precision]||ei.FP4).dense*1e12*1e-4;this.opsAcc=this.opsBase+l*Math.max(0,e-this.opsT0),this.updateOpsRead()}if(this.partButtons)for(let o in this.partButtons)this.partButtons[o].classList.toggle("selected",k.selectedPart===o);if(this.partDesc&&k.selectedPart){let o=xs[k.selectedPart]||xs[k.selectedPart.replace(/\d+$/,"")];o&&(this.partDesc.innerHTML=`<b>${o.name}</b><br>${o.desc}`)}if(this.detailBody&&k.selectedPart){let o=k.selectedPart,l=o.startsWith("hbm")?"\u6DF1\u5165\uFF1A\u57FA\u5E95\u903B\u8F91\u5C42 + 8 \u5C42 DRAM\uFF0C\u5C42\u95F4\u5FAE\u51F8\u70B9\u4E0E\u8D2F\u7A7F TSV \u5DF2\u5728\u5C55\u5F00\u65F6\u663E\u5F62\u3002":o.startsWith("die")?"\u6DF1\u5165\uFF1A\u529F\u80FD\u533A\u5305\u62EC Tensor \u9635\u5217\u3001L2\u3001HBM PHY\u3001NVLink PHY \u4E0E\u7247\u95F4\u4E92\u8FDE PHY\uFF08\u793A\u610F\u5E03\u5C40\uFF09\u3002":o==="substrate"?"\u6DF1\u5165\uFF1A\u963B\u710A / \u82AF\u677F / \u56DB\u5C42\u94DC\u8D70\u7EBF\uFF08\u5256\u5207\u9762\u53EF\u89C2\u5BDF\uFF09\u3002":o==="interposer"?"\u6DF1\u5165\uFF1A\u8868\u9762\u6247\u51FA\u8D70\u7EBF\u8FDE\u63A5\u6676\u7C92\u4E0E\u663E\u5B58\u3001\u4EE5\u53CA\u4E24\u9897\u6676\u7C92\u4E4B\u95F4\u3002":"";this.detailBody.innerHTML=`<b>${(xs[o]||{}).name||o}</b><br>${l||"\u7ED3\u6784\u89C1\u5DE6\u4FA7\u5206\u5C42\u7EBF\u7A3F\u3002"}`}if(this.dramBars){let o=k.precision,l=k.precisionDef.bits,c=k.bytesPerValue,u=ni.hbm3eCapacity*1e9/c,d=o==="FP4"?16:o==="FP8"?8:4,f=12+l/64*200;this.dramBars.innerHTML=`
        <div style="display:flex;gap:6px;align-items:center;margin:6px 0">
          <div style="width:${f}px;height:14px;border-radius:3px;background:linear-gradient(90deg,var(--precision),transparent);border:1px solid color-mix(in srgb,var(--precision) 50%,transparent)"></div>
          <span style="font-family:var(--font-mono);font-size:11px;color:var(--ink-2)">${l} bit / \u503C</span>
        </div>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--ink-3);line-height:1.7">
          \u5206\u7EC4 ${d} \u503C / \u5757 \xB7 \u53EF\u5BB9\u7EB3 \u2248 ${On(u)} \u4E2A\u503C<br>
          \u540C\u4E00\u6279\u6570\u636E\u5360\u7528\uFF1A${Ti(u*c)}\uFF08186 GB \u53E3\u5F84\uFF09<br>
          \u7CBE\u5EA6\u5207\u6362\u540E\u903B\u8F91\u5206\u533A\u4E0E\u5360\u7528\u540C\u6B65\u53D8\u5316\uFF0C\u7269\u7406\u5C42\u5C3A\u5BF8\u4E0D\u53D8\u3002
        </div>`}if(this.seamState){let o=k.dieSeamGap||0;this.seamState.textContent=o>.35?`\u63A5\u7F1D\u5DF2\u65AD\u5F00\uFF08${Math.round(o*100)}%\uFF09\uFF1A\u8DE8\u7F1D\u8109\u51B2\u505C\u5728\u65AD\u53E3\uFF0C\u7247\u95F4 10 TB/s \u94FE\u8DEF\u4E2D\u65AD\u3002`:`\u63A5\u7F1D\u8DDD\u79BB ${Math.round(o*100)}%\uFF1A\u8DE8\u7F1D\u4F20\u8F93\u6B63\u5E38\uFF0CNV-HBI 10 TB/s\u3002`}{let o=document.getElementById("val-explode"),l=document.getElementById("rng-explode"),c=k._effExplode;o&&c!=null&&window.__scene&&window.__scene._userExplode==null&&(o.textContent=Math.round(c*100)+"%",l&&document.activeElement!==l&&(l.value=Math.round(c*100),l.style.setProperty("--fill",c*100+"%")))}let n=document.getElementById("b4-prec");n&&(n.textContent=k.precision);let s=document.getElementById("b5-fmt-tag");s&&(s.textContent=k.precision+(k.precision==="FP4"?" \xB7 NVFP4":""));let r=document.getElementById("b8-fmt");r&&(r.textContent="\u7CBE\u5EA6 "+k.precision);let a=document.getElementById("b8-ops");if(a){let o=Fn();a.textContent=`\u5DE5\u4F5C\u91CF ${On(o.elements)} \u503C \xB7 ${o.gpusNeeded} GPU`}this.loupeCanvas&&this.loupeWrap&&this.loupeWrap.getBoundingClientRect().width>0&&this.drawLoupe(e),this.specWrap&&this.specWrap.querySelectorAll("tr[data-prod]").forEach(o=>{let l=o.getAttribute("data-prod")==="HGX B200"?"HGX":o.getAttribute("data-prod")==="DGX B200"?"DGX":o.getAttribute("data-prod")==="GB200 NVL72"?"NVL72":o.getAttribute("data-prod")==="GB200"?"GB200":"B200";o.classList.toggle("hot",k.selectedProduct===l)})}};function _u(i){let t=!1,e={runs:["page"],async begin(n="page",s={}){if(n!=="page")throw new Error("unknown run: "+n);return t=!0,window.__exportMode=!0,i.setExportMode(!0),i.resetInteractions(),i.renderAt(0,0),await new Promise(a=>requestAnimationFrame(()=>requestAnimationFrame(a))),{chapters:Gs(),fps:s.fps||60}},async frame(n,s){t||(t=!0,window.__exportMode=!0,i.setExportMode(!0));let r=Math.min(1,Math.max(0,Number(n)||0)),a=Math.max(0,Number(s)||0);return i.renderAt(r,a),await new Promise(o=>requestAnimationFrame(()=>requestAnimationFrame(o))),{progress:r,time:a}},end(){t=!1,window.__exportMode=!1,i.setExportMode(!1),i.resetInteractions();let n=document.documentElement.scrollHeight-window.innerHeight,s=n>0?window.scrollY/n:0;i.renderAt(s,performance.now()/1e3)},get active(){return t}};return window.videoExport=e,e}window.addEventListener("error",i=>{console.error("[B200 err]",i.message,"@",i.filename,i.lineno)});window.addEventListener("unhandledrejection",i=>{console.error("[B200 rej]",i.reason)});var _s=document.getElementById("gl"),bn=document.getElementById("svg-overlay"),zg=document.getElementById("dom-overlay"),lc=new ho(_s),oi=new mo(lc);window.__scene=oi;var hn={ch01:new go(bn),ch02:new xo(bn),ch03:new yo(bn),ch04:new _o(bn),ch05:new Mo(bn),ch06:new So(bn),ch07:new wo(bn),ch08:new Eo(bn)},bu=new To(bn),Mu=new Ao(zg),Su=new Co(Mu);function wu(){let i=je.reduce((t,e)=>t+e.vh,0);document.getElementById("scroll-space").style.height=i+"vh"}wu();var Hg=document.getElementById("chapter-nav"),Eu=[];for(let i of Ei){let t=tt("button",{class:"nav-item",type:"button","data-ch":i.id,title:`\u8DF3\u8F6C\u5230\u7B2C ${i.num} \u7AE0 \xB7 ${i.title}`,onclick:()=>ic(i.id)},[tt("span",{class:"nav-dot"}),tt("span",{class:"nav-meta"},[tt("span",{class:"nav-num",text:i.num+" \xB7 "+i.sub}),tt("span",{class:"nav-title",text:i.title})])]);Hg.appendChild(t),Eu.push({btn:t,id:i.id})}function ic(i){let e=Gs().find(s=>s.id===i);if(!e)return;let n=uu(e.start+.002);window.scrollTo({top:n,behavior:"auto"})}var Vg=document.getElementById("precision-widget"),Tu=[];for(let i of ti){let t=tt("button",{class:"p-btn",type:"button",role:"radio","data-p":i.id,text:i.label,style:`--pc:${i.color}`,"aria-checked":String(k.precision===i.id),"aria-label":`${i.label} \xB7 ${i.desc}`,onclick:()=>k.setPrecision(i.id)});Vg.appendChild(t),Tu.push(t)}function Au(){for(let e of Tu)e.setAttribute("aria-checked",String(e.getAttribute("data-p")===k.precision));let i=fs(k.precision);document.documentElement.style.setProperty("--precision",i.color);let t=document.getElementById("precision-readout");if(t){let e={FP4:"20|10",FP8:"10|5",FP16:"5|2.5",BF16:"5|2.5",TF32:"2.5|1.25",FP64:"40"}[k.precision]||"\u2014";t.textContent=`${k.precision} \xB7 ${e} PFLOPS`,k.precision==="FP64"&&(t.textContent="FP64 \xB7 64bit \xB7 40 TFLOPS")}}k.on(i=>{i==="precision"&&(Au(),Su.syncMatrixLab?.())});Au();var ys=document.getElementById("help-panel");document.getElementById("btn-help").addEventListener("click",()=>{ys.hidden=!ys.hidden});document.getElementById("btn-close-help").addEventListener("click",()=>{ys.hidden=!0});document.getElementById("btn-reset").addEventListener("click",()=>{oi.resetOrbit(),Io("\u89C6\u89D2\u4E0E\u4E34\u65F6\u72B6\u6001\u5DF2\u590D\u4F4D")});var Po=tt("div",{id:"toast"});document.body.appendChild(Po);var vu=0;function Io(i){Po.textContent=i,Po.classList.add("show"),clearTimeout(vu),vu=setTimeout(()=>Po.classList.remove("show"),2200)}var cc=!1,sc=0,rc=0;_s.addEventListener("pointerdown",i=>{cc=!0,sc=i.clientX,rc=i.clientY,_s.setPointerCapture(i.pointerId)});_s.addEventListener("pointermove",i=>{if(!cc)return;let t=i.clientX-sc,e=i.clientY-rc;sc=i.clientX,rc=i.clientY,oi.orbitDelta(-t*.005,-e*.005)});_s.addEventListener("pointerup",i=>{cc=!1;let t=oi.pick(i.clientX/window.innerWidth*2-1,-(i.clientY/window.innerHeight)*2+1);t&&(t.product?k.set("selectedProduct",t.product===k.selectedProduct?null:t.product,"product"):t.partId&&(k.set("selectedPart",t.partId===k.selectedPart?null:t.partId,"select"),t.zoneId&&k.set("selectedZone",t.zoneId,"zone")))});_s.addEventListener("wheel",i=>{i.shiftKey&&(i.preventDefault(),oi.zoomDelta(-i.deltaY*.0012))},{passive:!1});window.addEventListener("keydown",i=>{if(i.target&&/INPUT|TEXTAREA/.test(i.target.tagName))return;let t=i.key;if(t==="h"||t==="H")ys.hidden=!ys.hidden;else if(t==="r"||t==="R")oi.resetOrbit(),Io("\u5DF2\u590D\u4F4D\u89C6\u89D2");else if(t==="ArrowRight"){let e=uo(Ws()),n=Ei.findIndex(s=>s.id===e);ic(Ei[Math.min(Ei.length-1,n+1)].id)}else if(t==="ArrowLeft"){let e=uo(Ws()),n=Ei.findIndex(s=>s.id===e);ic(Ei[Math.max(0,n-1)].id)}else t>="1"&&t<="6"?(k.setPrecision(ti[+t-1].id),Io("\u7CBE\u5EA6 \u2192 "+ti[+t-1].id)):t==="0"?window.scrollTo({top:0,behavior:"auto"}):t==="$"||t==="4"&&i.shiftKey?window.scrollTo({top:document.documentElement.scrollHeight,behavior:"auto"}):t==="Escape"&&(ys.hidden=!0,k.set("selectedPart",null,"select"),k.set("selectedZone",null,"zone"))});function Cu(){let i=window.innerWidth,t=window.innerHeight;bn.setAttribute("viewBox",`0 0 ${i} ${t}`);for(let e in hn)hn[e].layout(i,t);bu.layout(i,t)}Cu();window.addEventListener("resize",()=>{Cu(),wu()});var ri=0,Ru=!1,Ro=0;function oc(i,t){let e=i;oi.update(e,t),hn.ch01.update(e,t),hn.ch02.update(e,t),hn.ch03.update(e,t),hn.ch04.update(e,t),hn.ch05.update(e,t),hn.ch06.update(e,t),hn.ch07.update(e,t),hn.ch08.update(e,t),bu.update(e,t),Mu.update(e,t),Su.update(e,t);let n={ch01:si("ch01",e),ch02:si("ch02",e),ch03:si("ch03",e),ch04:si("ch04",e),ch05:si("ch05",e),ch06:si("ch06",e),ch07:si("ch07",e),ch08:si("ch08",e)};for(let a in n)hn[a].g.setAttribute("opacity",n[a].toFixed(3));lc.render(t);let s=document.getElementById("progress-num");s&&(s.textContent=Math.round(e*100));let r=uo(e);for(let a of Eu)a.btn.classList.toggle("active",a.id===r)}function si(i,t){let e=je.findIndex(l=>l.id===i);if(e<0)return 0;let n=je[e],s=je[e-1],r=s&&s.kind==="transition"?s.start:n.start,a=n.end;if(t<r||t>a)return 0;if(t<n.start)return mt(we((t-r)/((n.start-r)*.55)));let o=n.end-n.start;return 1-mt(we((t-(a-o*.12))/(o*.12)))}function Pu(){if(requestAnimationFrame(Pu),Ru){if(ac){ac=!1;try{oc(ri,Ro)}catch(t){console.error("[B200 render err]",t)}}return}let i=Ws();ri+=(i-ri)*.12,Math.abs(i-ri)<4e-4&&(ri=i),Ro=performance.now()/1e3;try{oc(ri,Ro)}catch(t){window.__errLogged||(window.__errLogged=!0,console.error("[B200 render err]",t&&t.stack||t,"p=",ri,"t=",Ro))}}var ac=!1;k.on(()=>{ac=!0});requestAnimationFrame(Pu);_u({setExportMode(i){Ru=i,window.__exportMode=i,lc.instant=i,document.body.classList.toggle("exporting",i)},renderAt(i,t){ri=i,oc(i,t)},resetInteractions(){oi.resetOrbit()}});setTimeout(()=>{window.__exportMode||Io("\u6EDA\u52A8\u5F00\u59CB\u62C6\u89E3 \xB7 \u62D6\u52A8\u65CB\u8F6C\u89C6\u89D2 \xB7 Shift+\u6EDA\u8F6E\u7F29\u653E")},1200);console.log("[B200 art] ready. videoExport:",typeof window.videoExport,"scrollH=",document.documentElement.scrollHeight,"innerH=",window.innerHeight,"p0=",Ws());console.log("[B200 art] ready. videoExport:",window.videoExport);})();
