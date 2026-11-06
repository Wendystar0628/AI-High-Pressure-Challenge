import {parseExpressionAt} from 'acorn';
const cache=new Map();
export const clone=x=>x===undefined?null:JSON.parse(JSON.stringify(x));
const blocked=new Set(['__proto__','prototype','constructor','window','globalThis','document','eval','Function']);
export function expression(text,vars={}){
 let ast=cache.get(text);if(!ast){ast=parseExpressionAt(text,0,{ecmaVersion:2022});if(text.slice(ast.end).trim())throw Error('表达式尾部无效');cache.set(text,ast)}
 const visit=n=>{switch(n.type){
 case'Literal':return n.value;
 case'Identifier':if(blocked.has(n.name))throw Error('禁止访问宿主');return vars[n.name]??null;
 case'ArrayExpression':return n.elements.map(visit);
 case'ObjectExpression':return Object.fromEntries(n.properties.map(p=>{const k=p.key.name??p.key.value;if(blocked.has(k))throw Error('无效键');return[k,visit(p.value)]}));
 case'MemberExpression':{const o=visit(n.object),k=n.computed?visit(n.property):n.property.name;if(blocked.has(k))throw Error('禁止访问宿主');return o?.[k]??null}
 case'UnaryExpression':{let a=visit(n.argument);if(n.operator==='!')return !a;if(n.operator==='-')return -a;if(n.operator==='+')return +a;throw Error('无效一元运算')}
 case'ConditionalExpression':return visit(n.test)?visit(n.consequent):visit(n.alternate);
 case'LogicalExpression':return n.operator==='&&'?(visit(n.left)&&visit(n.right)):(visit(n.left)||visit(n.right));
 case'BinaryExpression':{const a=visit(n.left),b=visit(n.right);switch(n.operator){case'+':return a+b;case'-':return a-b;case'*':return a*b;case'/':if(b===0)throw Error('除零');return a/b;case'%':return a%b;case'<':return a<b;case'>':return a>b;case'<=':return a<=b;case'>=':return a>=b;case'===':case'==':return a===b;case'!==':case'!=':return a!==b;case'**':return a**b;}throw Error('无效运算')}
 case'CallExpression':{if(n.callee.type!=='Identifier')throw Error('只允许纯函数');const f={sin:Math.sin,cos:Math.cos,abs:Math.abs,min:Math.min,max:Math.max,sqrt:Math.sqrt,floor:Math.floor,round:Math.round,len:x=>x?.length||0,number:Number,string:String,split:(x,s)=>String(x).split(s),trim:x=>String(x).trim(),slice:(x,a,b)=>x.slice(a,b??undefined),index:(x,v)=>x.indexOf(v),starts:(x,v)=>x.startsWith(v),ends:(x,v)=>x.endsWith(v),includes:(x,v)=>x.includes(v),append:(a,v)=>[...a,v],assoc:(a,k,v)=>{if(blocked.has(String(k)))throw Error('无效键');return{...a,[k]:v}},replaceAt:(a,k,v)=>{const b=[...a];b[k]=v;return b},has:(a,k)=>Object.hasOwn(a,k)}[n.callee.name];if(!f)throw Error('未知纯函数');return f(...n.arguments.map(visit))}
 default:throw Error('不支持的表达式 '+n.type)}};return visit(ast);
}
export function compile(source){
 const code=[],labels={};source.split('\n').forEach((raw,i)=>{const line=raw.trim();if(!line||line.startsWith('#'))return;if(/^[\w-]+:$/.test(line)){labels[line.slice(0,-1)]=code.length;return}const m=line.match(/^(set|sys|if|goto|print|wait|receive|send|halt)\b\s*(.*)$/);if(!m)throw Error(`第 ${i+1} 行：未知指令`);code.push({op:m[1],text:m[2],line:i+1})});
 for(const ins of code){if(ins.op==='set'||ins.op==='sys'){const m=ins.text.match(/^(\w+)\s+(.+)$/);if(!m)throw Error(`第 ${ins.line} 行：缺少变量或参数`);ins.dest=m[1];ins.expr=m[2];if(ins.op==='sys'){const s=ins.expr.match(/^([\w.]+)\s+(.+)$/);if(!s)throw Error('sys 需要服务和参数');ins.service=s[1];ins.expr=s[2]}}
 if(ins.op==='goto')ins.target=labels[ins.text];if(ins.op==='if'){const m=ins.text.match(/^(.+)\s+goto\s+([\w-]+)$/);if(!m)throw Error('if 表达式 goto 标签');ins.expr=m[1];ins.target=labels[m[2]]}if((ins.op==='goto'||ins.op==='if')&&ins.target===undefined)throw Error(`第 ${ins.line} 行：标签不存在`);
 if(ins.expr){const a=parseExpressionAt(ins.expr,0,{ecmaVersion:2022});if(ins.expr.slice(a.end).trim())throw Error('表达式格式错误');}
 }return code;
}
export function makeProcess(id,name,source,extra={}){let code=[],error='';try{code=compile(source)}catch(e){error=e.message}return{id,name,source,code,pc:0,vars:{},state:error?'error':'ready',error,queue:[],pending:null,wake:0,work:0,lastWork:0,cap:500,memory:0,output:[],...extra};}
export function stepProcess(p,ctx,budget){
 let used=0;if(['suspended','ended','error'].includes(p.state))return 0;
 if(p.state==='waiting'){if(p.pending)return 0;if(p.wake>ctx.time)return 0;if(p.waitMessage&&!p.queue.length)return 0;p.state='ready'}
 while(used<budget&&p.state==='ready'){
  const ins=p.code[p.pc];if(!ins){p.state='ended';break}
  try{
   const text=ins.expr||(['print','wait','send'].includes(ins.op)?ins.text:null);
   if(!p.micro){const value=text?clone(expression(text,{...p.vars,time:ctx.time,pid:p.id})):null;const cost=1+(value&&typeof value==='object'?Math.ceil(JSON.stringify(value).length/64):typeof value==='string'?Math.ceil(value.length/64):0);p.micro={value,remaining:cost}}
   const charged=Math.min(budget-used,p.micro.remaining);p.micro.remaining-=charged;used+=charged;p.work+=charged;p.lastWork+=charged;if(p.micro.remaining>0)break;
   const evaluated=p.micro.value;p.micro=null;const ev=()=>evaluated;p.pc++;
   switch(ins.op){case'set':p.vars[ins.dest]=clone(ev(ins.expr));break;
    case'goto':p.pc=ins.target;break;case'if':if(ev(ins.expr))p.pc=ins.target;break;
    case'print':p.output.push(String(ev(ins.text)));if(p.output.length>100)p.output.shift();break;
    case'wait':p.wake=ctx.time+Math.max(0,+ev(ins.text))/1000;p.state='waiting';break;
    case'receive':if(p.queue.length){p.vars[ins.text]=p.queue.shift();p.waitMessage=false}else{p.pc--;p.waitMessage=true;p.state='waiting'}break;
    case'send':{const v=ev(ins.text);ctx.sys(p,'message.send',v,'sendResult');break}
    case'sys':{const r=ctx.sys(p,ins.service,ev(ins.expr),ins.dest,budget-used);if(r&&r.__used)used+=r.__used;if(r&&!r.__pending)p.vars[ins.dest]=clone(Object.hasOwn(r,'value')?r.value:r);break}
    case'halt':p.state='ended';break;default:throw Error('未知指令 '+ins.op);
   }
   p.memory=(JSON.stringify(p.vars).length+JSON.stringify(p.queue).length+JSON.stringify(p.pending).length+JSON.stringify(p.display||null).length+p.source.length)*2+p.code.length*48;
   if(p.memory>ctx.memory)throw Error('内存配额不足');
  }catch(e){p.state='error';p.error=`${ins.line}: ${e.message}`;p.output.push(p.error)}
 }return used;
}
