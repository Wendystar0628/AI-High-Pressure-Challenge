export const address=(row,col)=>String.fromCharCode(65+col)+(row+1);
export function parseCell(a){const m=a.toUpperCase().match(/^([A-Z])([1-9]\d*)$/);if(!m)throw Error('#REF!');return[+m[2]-1,m[1].charCodeAt(0)-65]}
export function parseRange(r){const [a,b]=r.toUpperCase().split(':');const x=parseCell(a),y=parseCell(b||a);return{r0:Math.min(x[0],y[0]),r1:Math.max(x[0],y[0]),c0:Math.min(x[1],y[1]),c1:Math.max(x[1],y[1])}}
export function recalc(cells){const values={},visiting=new Set();let work=0;
 const get=a=>{work++;if(a in values)return values[a];if(visiting.has(a))throw Error('#CYCLE!');if(!/^[A-Z][1-9]\d*$/.test(a))throw Error('#REF!');visiting.add(a);let raw=cells[a]??'',result=raw;
 try{if(String(raw).startsWith('=')){
 let exp=String(raw).slice(1).toUpperCase().replace(/SUM\(([^)]+)\)/g,(_,s)=>{let total=0;for(const item of s.split(',')){if(item.includes(':')){const r=parseRange(item);if(r.r1>9999)throw Error('#REF!');for(let y=r.r0;y<=r.r1;y++)for(let x=r.c0;x<=r.c1;x++)total+=num(get(address(y,x)))}else total+=/^[A-Z]/.test(item.trim())?num(get(item.trim())):Number(item)}return String(total)});
 exp=exp.replace(/[A-Z]+\d+/g,a=>String(num(get(a))));if(/[^\d\s.+\-*/()]/.test(exp))throw Error('#REF!');const tokens=exp.match(/\d*\.?\d+|[()+\-*/]/g)||[];let i=0;
 const atom=()=>{let t=tokens[i++];if(t==='('){const v=add();if(tokens[i++]!==')')throw Error('#VALUE!');return v}if(t==='-')return -atom();if(t==='+')return atom();if(t===undefined||isNaN(+t))throw Error('#VALUE!');return+t};
 const mul=()=>{let v=atom();while(tokens[i]==='*'||tokens[i]==='/'){let op=tokens[i++],b=atom();if(op==='/'&&b===0)throw Error('#DIV/0!');v=op==='*'?v*b:v/b}return v};const add=()=>{let v=mul();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],b=mul();v=op==='+'?v+b:v-b}return v};result=add();if(i!==tokens.length)throw Error('#VALUE!');
 }else if(raw!==''&&!isNaN(Number(raw)))result=Number(raw)}catch(e){result=e.message}visiting.delete(a);values[a]=result;return result;
 };const num=v=>{if(typeof v==='string'&&v.startsWith('#'))throw Error(v);return Number(v)||0};Object.keys(cells).forEach(get);return{values,work};}
export const sampleSheet={title:'季度采购计划',cells:{A1:'项目',B1:'数量',C1:'单价',D1:'小计',A2:'项目 A',B2:24,C2:6,D2:'=B2*C2',A3:'项目 B',B3:12,C3:8,D3:'=B3*C3',A4:'项目 C',B4:18,C4:4,D4:'=B4*C4'},format:{header:true,currency:['D']}};
