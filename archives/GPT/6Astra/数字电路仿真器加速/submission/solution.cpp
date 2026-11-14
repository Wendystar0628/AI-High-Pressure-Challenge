#include <cstdint>
#include <vector>
#include <algorithm>
#include <cstring>
#include <numeric>
#include <immintrin.h>
#include <omp.h>
#include <windows.h>
struct Circuit {
 int I,F,G,O,M,T; uint64_t seed;
 std::vector<int> d; std::vector<uint8_t> type;
 std::vector<int> in0,in1,in2,out;
};
namespace {
using U=uint64_t;
U mix(U x) { x+=0x9E3779B97F4A7C15ULL; x=(x^(x>>30))*0xBF58476D1CE4E5B9ULL; x=(x^(x>>27))*0x94D049BB133111EBULL; return x^(x>>31); }
struct Node {int a,b,c,t;};

struct Macro {
 int base,width,depth; int sel[8];std::vector<std::pair<int,int>> outputs;
};
// Recognize only fully verified rectangular mux trees over flip-flops.
std::vector<Macro> findMacros(const Circuit& c){
 int muxes=std::count(c.type.begin(),c.type.end(),7);if(muxes<c.G/2)return {};
 struct Desc {int base=-1,width=0,depth=0;int sel[8]={};};
 int gb=2+c.I+c.F,fb=2+c.I;
 std::vector<Desc> desc(c.G);std::vector<char> seen(c.G),child(c.G);std::vector<int> stack;
 auto leaf=[&](int v)->Desc{if(v>=gb)return desc[v-gb];Desc d;if(v>=fb)d.base=v-fb;return d;};
 for(int k=0;k<c.G;k++)if(!seen[k]){
  stack.push_back(k);
  while(!stack.empty()){
   int i=stack.back();
   if(c.type[i]!=7||c.in0[i]>=gb){seen[i]=1;stack.pop_back();continue;}
   int a=c.in1[i],b=c.in2[i];
   if(a>=gb&&!seen[a-gb]){stack.push_back(a-gb);continue;}
   if(b>=gb&&!seen[b-gb]){stack.push_back(b-gb);continue;}
   Desc x=leaf(a),y=leaf(b);
   if(x.base>=0&&y.base>=0&&x.depth==y.depth&&x.depth<8){
    int w=x.depth==0?y.base-x.base:x.width;
    if((w==16||w==32||w==64)&&y.base-x.base==w*(1<<x.depth)&&(x.depth==0||x.width==y.width)&&std::equal(x.sel,x.sel+x.depth,y.sel)){
     x.width=w;x.sel[x.depth++]=c.in0[i];desc[i]=x;
     if(a>=gb)child[a-gb]=1;if(b>=gb)child[b-gb]=1;
    }
   }
   seen[i]=1;stack.pop_back();
  }
 }
 std::vector<Macro> macros;
 for(int i=0;i<c.G;i++)if(!child[i]&&desc[i].depth>=4){
  auto d=desc[i];int base=d.base/d.width*d.width,bit=d.base%d.width;int match=-1;
  for(int j=0;j<(int)macros.size();j++){auto& m=macros[j];if(m.base==base&&m.width==d.width&&m.depth==d.depth&&std::equal(m.sel,m.sel+m.depth,d.sel)){match=j;break;}}
  if(match<0){Macro m{};m.base=base;m.width=d.width;m.depth=d.depth;std::copy(d.sel,d.sel+d.depth,m.sel);macros.push_back(m);match=macros.size()-1;}
  macros[match].outputs.push_back({gb+i,bit});
 }
 // Sparse taps are cheaper to evaluate as ordinary gates.
 macros.erase(std::remove_if(macros.begin(),macros.end(),[](auto& m){return m.outputs.size()<size_t(m.width/2);}),macros.end());
 return macros;
}
// Complemented edges, structural hashing, and optional six-input truth-table cuts.
struct Net {
 std::vector<Node> n;
 
 struct Cut {U tt; int v[6]; int len;};
 std::vector<Cut> cuts;
 std::vector<int> table;
 static constexpr U mask[6]={0x5555555555555555ULL,0x3333333333333333ULL,0x0f0f0f0f0f0f0f0fULL,0x00ff00ff00ff00ffULL,0x0000ffff0000ffffULL,0x00000000ffffffffULL};

 std::vector<int> d,out;
 int base,ffbase; bool useCuts,hashNodes; std::vector<Macro> macros;
 Net(const Circuit& c):base(1+c.I+c.F),ffbase(base) {
 macros=findMacros(c);for(auto& m:macros)base+=m.outputs.size();
  
 
 int equal=0;for(int k=0;k<c.G;k++)equal+=c.in0[k]==c.in1[k];

 useCuts=equal>c.G/50;
 hashNodes=!(std::count(c.type.begin(),c.type.end(),0)>c.G/3 && std::count(c.type.begin(),c.type.end(),6)<c.G/50);

 n.reserve(base+c.G);n.resize(base, {0,0,0,-1});

 if(useCuts)cuts.reserve(base+c.G);cuts.resize(base);cuts[0]={0,{0},0};
 for(int i=1;i<base;i++)cuts[i]={0xaaaaaaaaaaaaaaaaULL,{i},1};
 size_t cap=16;while(cap<(useCuts?size_t(c.G)/2:hashNodes?size_t(c.G)*2:0))cap*=2;table.resize(cap,-1);

  std::vector<int> map(c.I+c.F+c.G+2,-1); map[0]=0; map[1]=1;
  for(int i=2;i<c.I+c.F+2;i++) map[i]=(i-1)*2;
  int macroId=ffbase;for(auto& m:macros)for(auto& o:m.outputs){map[o.first]=macroId*2;o.first=macroId++;}
  const int gb=c.I+c.F+2;
  std::vector<int> st;
  
  std::vector<int> roots=c.d;roots.insert(roots.end(),c.out.begin(),c.out.end());
  for(int signal:roots) {
   if(map[signal]>=0)continue;
   st.push_back(signal-gb);

   while(!st.empty()) {
    int k=st.back();
    int a=c.in0[k],b=c.in1[k],z=c.in2[k];
    if(map[a]<0){st.push_back(a-gb);continue;}
    if(b>=0&&map[b]<0){st.push_back(b-gb);continue;}
    if(z>=0&&map[z]<0){st.push_back(z-gb);continue;}
    int x=map[a],y=b<0?0:map[b],v=z<0?0:map[z],r=0;
    switch(c.type[k]) {
     case 0:r=land(x,y);break;
     case 1:r=land(x^1,y^1)^1;break;
     case 2:r=lxor(x,y);break;
     case 3:r=land(x,y)^1;break;
     case 4:r=land(x^1,y^1);break;
     case 5:r=lxor(x,y)^1;break;
     case 6:r=x^1;break;
     case 7:r=mux(x,y,v);break;
    }
    map[gb+k]=r;st.pop_back();
   }
  }
  for(int x:c.d)d.push_back(map[x]);
  for(int x:c.out)out.push_back(map[x]);
 }

 int node(int t,int a,int b,int c=0){
  if(!useCuts){
   if(!hashNodes){int x=n.size();n.push_back({a,b,c,t});return x*2;}
   U h=U(a)*0x9e3779b97f4a7c15ULL+U(b)*0xbf58476d1ce4e5b9ULL+U(c)*0x94d049bb133111ebULL+t;
   size_t pos=(h^(h>>32))&(table.size()-1);
   while(table[pos]>=0){int x=table[pos];auto old=n[x];if(old.t==t&&old.a==a&&old.b==b&&old.c==c)return x*2;pos=(pos+1)&(table.size()-1);}
   int x=n.size();n.push_back({a,b,c,t});table[pos]=x;return x*2;
  }


  if((n.size()-base)*2>=table.size()){
   table.assign(table.size()*2,-1);
   for(int x=base;x<(int)n.size();x++){
    const auto& r=cuts[x];U h=r.tt^(r.tt&1?~U(0):0);
    for(int j=0;j<r.len;j++)h=(h^r.v[j])*0x9e3779b97f4a7c15ULL;
    size_t pos=(h^(h>>32))&(table.size()-1);while(table[pos]>=0)pos=(pos+1)&(table.size()-1);table[pos]=x;
   }
  }
  int ids[3]={a/2,b/2,c/2},num=t==2?3:2;
  Cut cs[3];
  for(int i=0;i<num;i++)cs[i]={0xaaaaaaaaaaaaaaaaULL,{ids[i]},1};
  Cut r{};

  auto unite=[&](){
   r.len=cs[0].len;std::copy(cs[0].v,cs[0].v+r.len,r.v);
   for(int v=1;v<num;v++){
    int a=0,b=0,count=0,tmp[6];
    while(a<r.len||b<cs[v].len){
     int x;if(b==cs[v].len||(a<r.len&&r.v[a]<cs[v].v[b]))x=r.v[a++];
     else if(a==r.len||cs[v].v[b]<r.v[a])x=cs[v].v[b++];
     else{x=r.v[a++];b++;}
     if(count==6)return false;tmp[count++]=x;
    }
    r.len=count;std::copy(tmp,tmp+count,r.v);
   }
   return true;
  };
  for(int i=0;i<num;i++)cs[i]=cuts[ids[i]];
  if(!unite()){
   for(int i=0;i<num;i++)cs[i]={0xaaaaaaaaaaaaaaaaULL,{ids[i]},1};
   for(int i=0;i<num;i++){Cut old=cs[i];cs[i]=cuts[ids[i]];if(!unite())cs[i]=old;}
   unite();
  }
  U tt[3];int inputs[3]={a,b,c};
  for(int i=0;i<num;i++){
   U z=cs[i].tt;int q=0;
   for(int j=0;j<r.len;j++){
    if(q<cs[i].len&&cs[i].v[q]==r.v[j])q++;
    else {z=_pdep_u64(z,mask[j]);z|=z<<(1<<j);}
   }
   tt[i]=z^(inputs[i]&1?~U(0):0);
  }
  r.tt=t==0?(tt[0]&tt[1]):t==1?(tt[0]^tt[1]):tt[1]^(tt[0]&(tt[1]^tt[2]));
  for(int j=0;j<r.len;){
   if(((r.tt^(r.tt>>(1<<j)))&mask[j])==0){
    r.tt=_pext_u64(r.tt,mask[j]);r.tt|=r.tt<<32;
    for(int k=j;k+1<r.len;k++)r.v[k]=r.v[k+1];--r.len;
   }else j++;
  }
  if(r.len==0)return r.tt&1;
  if(r.len==1)return r.v[0]*2+(r.tt&1);
  U canonical=r.tt^(r.tt&1?~U(0):0);
  U h=canonical;for(int j=0;j<r.len;j++)h=(h^r.v[j])*0x9e3779b97f4a7c15ULL;
  size_t pos=(h^(h>>32))&(table.size()-1);
  while(table[pos]>=0){int x=table[pos];const Cut& old=cuts[x];
   if(old.len==r.len&&(old.tt^(old.tt&1?~U(0):0))==canonical&&std::equal(r.v,r.v+r.len,old.v))return x*2+((old.tt^r.tt)&1);
   pos=(pos+1)&(table.size()-1);
  }
  int x=n.size();n.push_back({a,b,c,t});cuts.push_back(r);table[pos]=x;return x*2;
 }
 int land(int a,int b){
  if(a>b)std::swap(a,b);
  if(a==0||a==(b^1))return 0;
  if(a==1)return b;
  if(a==b)return a;
  return node(0,a,b);
 }
 int lxor(int a,int b){
  int p=(a^b)&1;a&=~1;b&=~1;
  if(a>b)std::swap(a,b);
  if(a==0)return b^p;
  if(a==b)return p;
  return node(1,a,b)^p;
 }
 int mux(int s,int a,int b){
  if(s&1){s^=1;std::swap(a,b);}
  if(s==0)return a;
  if(a==b)return a;
  if(a==(b^1))return lxor(s,a);
  if(a==0)return land(s,b);
  if(b==0)return land(s^1,a);
  if(a==1)return land(s,b^1)^1;
  if(b==1)return land(s^1,a^1)^1;
  if(s==a||s==(a^1))return mux(s,a&1,b);
  if(s==b||s==(b^1))return mux(s,a,(b&1)^1);
  int p=a&1;return node(2,s,a^p,b^p)^p;
 }
 std::vector<char> live(const Circuit& c){
  std::vector<char> seen(n.size());std::vector<int> st;
  
  for(int x:out)st.push_back(x/2);
  for(const auto& m:macros){for(int f=m.base;f<std::min(c.F,m.base+m.width*(1<<m.depth));f++)st.push_back(1+c.I+f);for(int j=0;j<m.depth;j++)if(m.sel[j]>=2)st.push_back(m.sel[j]-1);}

  while(!st.empty()){
   int v=st.back();st.pop_back();if(seen[v])continue;seen[v]=1;
   if(v>=base){st.push_back(n[v].a/2);st.push_back(n[v].b/2);if(n[v].t==2)st.push_back(n[v].c/2);}
   else if(v>c.I&&v<ffbase)st.push_back(d[v-c.I-1]/2);
  }
  return seen;
 }
};
}
namespace {
struct Op {int a,b,c,d,t;};

void transpose(U *a) {
 for(int j=32;j;j>>=1){U mask=~U(0)/((U(1)<<j)+1);for(int k=0;k<64;k=(k+j+1)&~j){U z=((a[k]>>j)^a[k+j])&mask;a[k]^=z<<j;a[k+j]^=z;}}
}
void transposeAvx(U *a) {
 for(int j=32;j>=4;j>>=1){
  __m256i mask=_mm256_set1_epi64x(~U(0)/((U(1)<<j)+1));
  __m256i shift=_mm256_set1_epi64x(j);
  for(int block=0;block<64;block+=2*j)for(int k=block;k<block+j;k+=4){
   __m256i x=_mm256_loadu_si256((const __m256i*)(a+k));
   __m256i y=_mm256_loadu_si256((const __m256i*)(a+k+j));
   __m256i z=_mm256_and_si256(_mm256_xor_si256(_mm256_srlv_epi64(x,shift),y),mask);
   _mm256_storeu_si256((__m256i*)(a+k),_mm256_xor_si256(x,_mm256_sllv_epi64(z,shift)));
   _mm256_storeu_si256((__m256i*)(a+k+j),_mm256_xor_si256(y,z));
  }
 }
 for(int k=0;k<64;k+=4){
  __m256i x=_mm256_loadu_si256((const __m256i*)(a+k));
  __m256i y=_mm256_permute4x64_epi64(x,0x4e);
  __m256i z=_mm256_and_si256(_mm256_xor_si256(_mm256_srli_epi64(x,2),y),_mm256_set1_epi64x(0x3333333333333333ULL));
  z=_mm256_permute4x64_epi64(z,0x44);
  x=_mm256_xor_si256(x,_mm256_blend_epi32(_mm256_slli_epi64(z,2),z,0xf0));
  y=_mm256_permute4x64_epi64(x,0xb1);
  z=_mm256_and_si256(_mm256_xor_si256(_mm256_srli_epi64(x,1),y),_mm256_set1_epi64x(0x5555555555555555ULL));
  z=_mm256_permute4x64_epi64(z,0xa0);
  x=_mm256_xor_si256(x,_mm256_blend_epi32(_mm256_slli_epi64(z,1),z,0xcc));
  _mm256_storeu_si256((__m256i*)(a+k),x);
 }

}
}

namespace {

// In-memory AVX2 blocks; all memory and executable code are private to this call.
// Register allocation uses next references and preserves the Windows x64 ABI.
struct Jit {
 std::vector<unsigned char> code; void* mem=nullptr;
 using Fn=void(*)(void*);std::vector<Fn> fn;std::vector<size_t> starts; int stride;
 void byte(int x){code.push_back(x);}
 void disp(int x){for(int i=0;i<4;i++)byte(x>>(8*i));}
 void vex(int r,int a,int b){if(b<8){byte(0xc5);byte((r<8?128:0)|5|((15-a)<<3));}else{byte(0xc4);byte(0x41|((r<8)?128:0)|((b<8)?32:0));byte(5|((15-a)<<3));}}
 void load(int r,int slot){vex(r,0,0);byte(0x6f);byte(0x81+8*(r&7));disp(slot*stride);}
 void save(int r,int slot){vex(r,0,0);byte(0x7f);byte(0x81+8*(r&7));disp(slot*stride);}
 void op(int ins,int r,int a,int b){vex(r,a,b);byte(ins);byte(0xc0+8*(r&7)+(b&7));}
 void opmem(int ins,int r,int a,int slot){vex(r,a,0);byte(ins);byte(0x81+8*(r&7));disp(slot*stride);}
 void stackreg(int r,bool load){ // vmovdqu xmm, [rsp+disp32]
  byte(0xc5);byte(r<8?0xfa:0x7a);byte(load?0x6f:0x7f);byte(0x84+8*(r&7));byte(0x24);disp((r-6)*16);
 }
 Jit(const std::vector<Op>& ops,int slots,int stride_):stride(stride_){
  code.reserve(ops.size()*20);
  const int BS=1024,NR=15,INF=1000000000;
  std::vector<int> future(slots),mapping(slots,-1);
  struct Nxt{int a,b,c,d;};std::vector<Nxt> nx(BS);

  starts.push_back(0);
  byte(0x48);byte(0x81);byte(0xec);disp(168);
  for(int r=6;r<16;r++)stackreg(r,false);
  op(0x76,15,15,15);
  if(stride==64){byte(0x31);byte(0xd2);}
  for(int start=0;start<(int)ops.size();start+=BS){
   int end=std::min(start+BS,(int)ops.size());std::fill(future.begin(),future.end(),end);
   for(int i=end-1;i>=start;i--){auto o=ops[i];auto& x=nx[i-start];x.d=future[o.d];future[o.d]=INF;x.a=future[o.a];x.b=future[o.b];x.c=future[o.c];future[o.a]=i;future[o.b]=i;if(o.t==5||o.t==6)future[o.c]=i;}
   int bodyStart=code.size();
   int slot[NR],next[NR];bool dirty[NR];for(int r=0;r<NR;r++){slot[r]=-1;next[r]=INF;dirty[r]=false;}
   auto evict=[&](int r){if(slot[r]>=0){if(dirty[r]&&next[r]!=INF)save(r,slot[r]);mapping[slot[r]]=-1;}slot[r]=-1;dirty[r]=false;};
   auto alloc=[&](unsigned pins){int best=-1;for(int r=0;r<NR;r++)if(!(pins>>r&1)){if(slot[r]<0)return r;if(best<0||next[r]>next[best])best=r;}evict(best);return best;};
   for(int i=start;i<end;i++){
    auto o=ops[i];auto x=nx[i-start];unsigned pins=0;
    auto get=[&](int s){int r=mapping[s];if(r<0){r=alloc(pins);slot[r]=s;mapping[s]=r;load(r,s);}pins|=1u<<r;return r;};

    int left=o.a,right=o.b,ln=x.a,rn=x.b;
    if(o.t==1){std::swap(left,right);std::swap(ln,rn);}
    int a=get(left),b=mapping[right],c=-1;
    if(o.t==5||o.t==6)b=get(right);
    else if(b>=0)pins|=1u<<b;
    if(o.t==5||o.t==6){c=mapping[o.c];if(c>=0)pins|=1u<<c;}
    next[a]=ln;if(b>=0)next[b]=rn;if(c>=0)next[c]=x.c;

    int dest=mapping[o.d];
    if(dest<0){for(int r=0;r<NR;r++)if(slot[r]>=0&&next[r]==INF){dest=r;break;}}
    if(dest<0)dest=alloc(pins);
    if(slot[dest]>=0)mapping[slot[dest]]=-1;

    if(o.t<5||o.t==7){
     int ins=o.t==0?0xdb:o.t==1||o.t==2?0xdf:(o.t==3||o.t==7)?0xeb:0xef;
     if(b<0)opmem(ins,dest,a,right);else op(ins,dest,a,b);
     if(o.t==3)op(0xef,dest,dest,15);
    }else{
     int tmp=(dest!=a&&dest!=b)?dest:alloc(pins|(1u<<dest));
     if(c<0)opmem(0xef,tmp,b,o.c);else op(0xef,tmp,b,c);if(o.t==6)op(0xef,tmp,tmp,15);
     op(0xdb,tmp,tmp,a);op(0xef,dest,tmp,b);
    }
    slot[dest]=o.d;mapping[o.d]=dest;next[dest]=x.d;dirty[dest]=true;
   }
   for(int r=0;r<NR;r++)evict(r);

   if(stride==64){
    byte(0x48);byte(0x83);byte(0xc1);byte(32); // advance to the other SIMD lane
    byte(0x83);byte(0xf2);byte(1);
    byte(0x0f);byte(0x85);disp(bodyStart-int(code.size())-4);
    byte(0x48);byte(0x83);byte(0xe9);byte(64);
   }
  }
  for(int r=6;r<16;r++)stackreg(r,true);
  byte(0x48);byte(0x81);byte(0xc4);disp(168);
  byte(0xc5);byte(0xf8);byte(0x77);byte(0xc3);

  if(code.empty())return;
  mem=VirtualAlloc(nullptr,code.size(),MEM_COMMIT|MEM_RESERVE,PAGE_READWRITE);
  if(!mem)return;
  memcpy(mem,code.data(),code.size());DWORD old;
  if(!VirtualProtect(mem,code.size(),PAGE_EXECUTE_READ,&old)){VirtualFree(mem,0,MEM_RELEASE);mem=nullptr;return;}
  FlushInstructionCache(GetCurrentProcess(),mem,code.size());
  for(size_t x:starts)fn.push_back((Fn)((unsigned char*)mem+x));
 }
 ~Jit(){if(mem)VirtualFree(mem,0,MEM_RELEASE);}
};
template<int Words> struct alignas(Words*8) Wide {U x[Words];};
}
// Each bit is an independent excitation. Workers own disjoint excitation batches.
template<int B> static std::vector<uint64_t> simulateImpl(const Circuit& c) {
 Net net(c);auto live=net.live(c);
 bool phases=!net.hashNodes;
 std::vector<int> id(net.n.size()),uses(net.n.size()),flip(phases?net.n.size():0);int size=net.base;
 for(int i=0;i<size;i++)id[i]=i;
 for(int i=net.base;i<int(net.n.size());i++)if(live[i]){
  auto n=net.n[i];uses[n.a/2]++;uses[n.b/2]++;if(n.t==2)uses[n.c/2]++;
 }
 for(int i=0;i<c.F;i++)if(live[1+c.I+i])uses[net.d[i]/2]++;
 for(int x:net.out)uses[x/2]++;
 std::vector<int> free;
 std::vector<Op> ops;
 for(int i=net.base;i<int(net.n.size());i++)if(live[i]){
  
  auto n=net.n[i];

  int a=id[n.a/2],b=id[n.b/2],z=id[n.c/2];
  int t=n.t==0?((n.a&1)*2+(n.b&1)):n.t==1?4:5+(n.c&1);
  if(phases){
   int pa=(n.a&1)^flip[n.a/2],pb=(n.b&1)^flip[n.b/2],pc=(n.c&1)^flip[n.c/2];
   if(n.t==0){t=pa*2+pb;if(t==3){t=7;flip[i]=1;}}
   else if(n.t==1){t=4;flip[i]=pa^pb;}
   else{if(pa){std::swap(b,z);std::swap(pb,pc);}flip[i]=pb;t=5+(pb^pc);}
  }
  auto release=[&](int x){if(--uses[x]==0&&x>=net.base)free.push_back(id[x]);};
  release(n.a/2);release(n.b/2);if(n.t==2)release(n.c/2);
  int dest;if(free.empty())dest=size++;else{dest=free.back();free.pop_back();}
  id[i]=dest;ops.push_back({a,b,z,dest,t});
 }
 std::vector<int> ff,dd,oo;for(int i=0;i<c.F;i++)if(live[1+c.I+i]){ff.push_back(1+c.I+i);dd.push_back(id[net.d[i]/2]*2+((net.d[i]&1)^(phases?flip[net.d[i]/2]:0)));}
 for(int x:net.out)oo.push_back(id[x/2]*2+((x&1)^(phases?flip[x/2]:0)));
 int packLimit=0;for(auto& m:net.macros)packLimit=std::max(packLimit,m.base+m.width*(1<<m.depth));
 Jit jit(ops,size,B/8);
 std::vector<U> hashes(size_t(c.T)*c.O);for(size_t i=0;i<hashes.size();i++)hashes[i]=mix(i);

 int digestGroups=(c.O+7)/8;
 bool useDigestTable=c.O>=16&&c.M>=128&&!net.useCuts;
 std::vector<U> digestTable;
 if(useDigestTable){
  digestTable.resize(size_t(c.T)*digestGroups*256);
  for(int t=0;t<c.T;t++)for(int g=0;g<digestGroups;g++){
   U* q=digestTable.data()+(size_t(t)*digestGroups+g)*256;
   for(unsigned b=1;b<256;b++){int j=g*8+__builtin_ctz(b);q[b]=q[b&(b-1)]^(j<c.O?hashes[size_t(t)*c.O+j]:0);}
  }
 }
 std::vector<U> ans(c.M);
 int groups=(c.M+B-1)/B;
 #pragma omp parallel for schedule(static) num_threads(std::min(4096/B,groups))
 for(int group=0;group<groups;group++){
  std::vector<Wide<B/64>> mem(size),next(ff.size());
  std::vector<U> packed(net.macros.empty()?0:size_t((c.F+63)/64)*B);
  U states[B],h[B]={};int count=std::min(B,c.M-B*group);
  for(int m=0;m<B;m++)states[m]=mix(c.seed^U(B*group+m));
  for(int t=0;t<c.T;t++){
   for(int w=0;w<B/64;w++){
    U a[64];for(int k=0;k<64;k++){a[k]=mix(states[64*w+k]);states[64*w+k]+=0x9E3779B97F4A7C15ULL;}
    transpose(a);for(int i=0;i<c.I;i++)mem[1+i].x[w]=a[i];
   }

   if(!net.macros.empty()){
    for(int f=0;f<std::min(c.F,packLimit);f+=64)for(int w=0;w<B/64;w++){
     U a[64]={};for(int j=0;j<64&&f+j<c.F;j++)a[j]=mem[1+c.I+f+j].x[w];
     transposeAvx(a);for(int j=0;j<64;j++)packed[size_t(f/64)*B+w*64+j]=a[j];
    }
    for(const auto& m:net.macros)for(int w=0;w<B/64;w++){
     alignas(32) U a[64]={};
     for(int j=0;j<m.depth;j++){int q=m.sel[j];a[j]=q<2?(q?~U(0):0):mem[q-1].x[w];}
     transposeAvx(a);
     int shift=__builtin_ctz(m.width);
     for(int j=0;j<64;j+=4){
      __m256i address=_mm256_add_epi64(_mm256_sllv_epi64(_mm256_load_si256((__m256i*)(a+j)),_mm256_set1_epi64x(shift)),_mm256_set1_epi64x(m.base));
      __m256i idx=_mm256_add_epi64(_mm256_slli_epi64(_mm256_srli_epi64(address,6),(B==256?8:9)),_mm256_set_epi64x(w*64+j+3,w*64+j+2,w*64+j+1,w*64+j));
      __m256i val=_mm256_i64gather_epi64((const long long*)packed.data(),idx,8);
      val=_mm256_srlv_epi64(val,_mm256_and_si256(address,_mm256_set1_epi64x(63)));
      _mm256_store_si256((__m256i*)(a+j),val);
     }
     transposeAvx(a);for(auto o:m.outputs)mem[o.first].x[w]=a[o.second];
    }
   }
   if(!jit.fn.empty()){

    jit.fn[0](mem.data());
   }else for(const auto& op:ops)for(int w=0;w<B/64;w++){
    U a=mem[op.a].x[w],b=mem[op.b].x[w],z;
    switch(op.t){
     case 0:z=a&b;break;case 1:z=a&~b;break;case 2:z=~a&b;break;case 3:z=~(a|b);break;case 4:z=a^b;break;case 7:z=a|b;break;
     case 5:z=b^(a&(b^mem[op.c].x[w]));break;
     default:z=b^(a&(b^~mem[op.c].x[w]));break;
    }mem[op.d].x[w]=z;
   }

   if(useDigestTable){
    const U* tables=digestTable.data()+size_t(t)*digestGroups*256;
    for(int w=0;w<B/64;w++){
     alignas(32) U a[64]={};
     for(int j=0;j<c.O;j++){int x=oo[j];a[j]=mem[x/2].x[w]^(x&1?~U(0):0);}
     transposeAvx(a);
     for(int m=0;m<64;m++){
      
      U bits=a[m],val=0;
      if(c.O==64){
       val=tables[(bits&255)]^tables[256+((bits>>8)&255)]^tables[512+((bits>>16)&255)]^tables[768+((bits>>24)&255)]
          ^tables[1024+((bits>>32)&255)]^tables[1280+((bits>>40)&255)]^tables[1536+((bits>>48)&255)]^tables[1792+(bits>>56)];
      }else for(int g=0;g<digestGroups;g++){val^=tables[g*256+(bits&255)];bits>>=8;}
      h[w*64+m]^=val;
     }
    }
   }else{
    for(int j=0;j<c.O;j++){
     int x=oo[j];U hv=hashes[size_t(t)*c.O+j];
     for(int w=0;w<B/64;w++){U bits=mem[x/2].x[w]^(x&1?~U(0):0);while(bits){int b=__builtin_ctzll(bits);h[w*64+b]^=hv;bits&=bits-1;}}
    }
   }
   // Stage all D inputs before updating any flip-flop.
   for(size_t f=0;f<ff.size();f++)for(int w=0;w<B/64;w++)next[f].x[w]=mem[dd[f]/2].x[w]^(dd[f]&1?~U(0):0);
   for(size_t f=0;f<ff.size();f++)mem[ff[f]]=next[f];
  }
  for(int m=0;m<count;m++)ans[group*B+m]=h[m];
 }
 return ans;
}

std::vector<uint64_t> simulate(const Circuit& c) {
 int muxes=std::count(c.type.begin(),c.type.end(),7);
 if(muxes>c.G/2||c.M<=256)return simulateImpl<256>(c);
 return simulateImpl<512>(c);
}
