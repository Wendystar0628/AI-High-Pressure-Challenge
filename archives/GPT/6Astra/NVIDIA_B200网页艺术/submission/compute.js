/* Numerical model: all diagrams read this one shared state. No simulated answers. */
window.AtlasMath = (() => {
  const formats={FP4:{bits:4,storage:4.5,e:2,m:1,layout:'E2M1',peak:9,usage:'低位推理 · 16 值共享缩放'},FP8:{bits:8,storage:8,e:4,m:3,layout:'E4M3',peak:4.5,usage:'混合精度训练与推理'},FP16:{bits:16,storage:16,e:5,m:10,layout:'E5M10',peak:2.25,usage:'训练 · 较高尾数精度'},BF16:{bits:16,storage:16,e:8,m:7,layout:'E8M7',peak:2.25,usage:'训练 · 更大动态范围'},TF32:{bits:19,storage:32,e:8,m:10,layout:'E8M10',peak:1.1,usage:'FP32 输入的张量计算'},FP64:{bits:64,storage:64,e:11,m:52,layout:'E11M52',peak:.037,usage:'科学计算 · 双精度'}};
  const defaults={precision:'FP4',a:[1.3,-2.1,3.7,.6],b:[.8,2.6,-1.4,3.1],sparse:false,region:0,part:'all',stack:0,workload:0,load:640,gpu:0,product:0,metric:1,specSparse:false,element:{matrix:'a',index:0}};
  const copy=x=>JSON.parse(JSON.stringify(x));
  let state=copy(defaults);
  try{const p=JSON.parse(localStorage.getItem('blackwell-atlas-v1'));if(p&&formats[p.precision]&&p.a?.length===4&&p.b?.length===4)state={...state,...p};}catch{}
  const roundEven=x=>{let f=Math.floor(x),r=x-f;return r>.5?f+1:r<.5?f:f%2?f+1:f;};
  const e4=[];for(let code=0;code<127;code++){const e=code>>3,m=code&7;e4.push(e===0?m*2**-9:(1+m/8)*2**(e-7));}
  function nearest(v,values){let n=Math.abs(v),best=0,err=Infinity;values.forEach((a,i)=>{const d=Math.abs(n-a);if(d<err-1e-12||(Math.abs(d-err)<1e-12&&i%2===0)){err=d;best=i;}});return Math.sign(v)*values[best];}
  function ieee(v,e,m){if(v===0)return 0;const sign=Math.sign(v),n=Math.abs(v),bias=2**(e-1)-1,min=1-bias,max=bias,exp=Math.max(min,Math.floor(Math.log2(n))),step=2**(exp-m),q=roundEven(n/step)*step,limit=(2-2**-m)*2**max;return sign*Math.min(limit,q);}
  function scalar(v,f){if(f==='FP64')return v;if(f==='FP8')return nearest(v,e4);const d=formats[f];return ieee(v,d.e,d.m);}
  function quantize(values,f){if(f==='FP4'){let scale=nearest(Math.max(...values.map(Math.abs))/6,e4)||1/512;return {scale,values:values.map(v=>nearest(v/scale,[0,.5,1,1.5,2,3,4,6])*scale)};}return {scale:1,values:values.map(v=>scalar(v,f))};}
  function compute(){const rawA=state.a.map((v,i)=>state.sparse&&(i===1||i===2)?0:v),rawB=state.b.slice(),qa=quantize(rawA,state.precision),qb=quantize(rawB,state.precision),c=[],ref=[],contributions=[];let operations=0;for(let r=0;r<2;r++)for(let col=0;col<2;col++){let sum=0,exact=0;for(let k=0;k<2;k++){let a=r*2+k,b=k*2+col,p=Math.fround(qa.values[a]*qb.values[b]);sum=Math.fround(sum+p);exact+=rawA[a]*rawB[b];contributions.push({a,b,c:r*2+col,value:p,active:!state.sparse||qa.values[a]!==0&&qb.values[b]!==0});if(!state.sparse||qa.values[a]!==0&&qb.values[b]!==0)operations+=2;}c.push(sum);ref.push(exact);}let total=contributions.reduce((a,p)=>Math.fround(a+p.value),0);const gb=state.load*formats[state.precision].storage/8;const payload=quantize([...rawA,...rawB,...rawA,...rawB],state.precision);return {qa,qb,c,ref,rawA,rawB,payload,operations,contributions,total,gb,gpus:Math.ceil(gb/180),platforms:Math.ceil(gb/1440),error:Math.max(...c.map((v,i)=>Math.abs(v-ref[i])))};}
  function save(){try{localStorage.setItem('blackwell-atlas-v1',JSON.stringify(state));}catch{}}
  // The same schedule drives both the projected topology and physical board links.
  function reduction(progress,initiator=state.gpu,result=compute()){
    const limit=v=>Math.max(0,Math.min(1,v)),p=limit(progress),gather=[],broadcast=[],switchSums=[0,0],arrived=[];
    for(let i=0;i<8;i++){const order=(i-initiator+8)%8;gather[i]=limit((p-.34-order*.012)/.16);broadcast[i]=limit((p-.76-order*.005)/.16);arrived[i]=broadcast[i]>=1;if(gather[i]>=1)switchSums[i%4<2?0:1]+=result.contributions[i].value;}
    const exchange=limit((p-.6)/.16),stage=p<.16?0:p<.34?1:p<.6?2:p<.76?3:p<.96?4:5;
    return {progress:p,stage,gather,broadcast,exchange,switchSums,arrived,total:result.total};
  }
  const fmt=(n,d=4)=>{if(!Number.isFinite(n))return '—';if(Math.abs(n)<1e-7)return '0';return Number(n.toFixed(d)).toLocaleString('en-US',{maximumFractionDigits:d});};
  function reset(){Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,copy(defaults));}
  return {state,formats,defaults,compute,save,fmt,reset,quantize,scalar,roundEven,e4,reduction};
})();
