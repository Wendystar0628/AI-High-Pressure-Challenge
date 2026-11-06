#include <cstdint>
#include <vector>
#include <algorithm>
#include <immintrin.h>
#include <omp.h>
#include <windows.h>
#include <cstring>
#include <array>
#include <unordered_map>

struct Circuit {
    int I, F, G, O, M, T;
    uint64_t seed;
    std::vector<int> d;
    std::vector<uint8_t> type;
    std::vector<int> in0, in1, in2;
    std::vector<int> out;
};

namespace {
uint64_t mix(uint64_t x) {
    x += 0x9e3779b97f4a7c15ULL;
    x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ULL;
    x = (x ^ (x >> 27)) * 0x94d049bb133111ebULL;
    return x ^ (x >> 31);
}
struct Node { int a, b, c, op; };
struct Builder {
    std::vector<Node> n;
    std::vector<int> table;
    int base;
    Builder(int leaves, int count) : base(leaves) {
        n.resize(leaves);
        n.reserve(leaves + count);
        size_t size = 16;
        while (size < size_t(count) * 2) size *= 2;
        table.assign(size, 0);
    }
    int insert(int a, int b, int c, int op) {
        uint64_t h = uint64_t(a) * 0x9e3779b185ebca87ULL
                   ^ uint64_t(b) * 0xc2b2ae3d27d4eb4fULL
                   ^ uint64_t(c + op) * 0x165667b19e3779f9ULL;
        h ^= h >> 32;
        size_t p = size_t(h) & (table.size() - 1);
        while (table[p]) {
            int id = table[p];
            const Node& x = n[id];
            if (x.a == a && x.b == b && x.c == c && x.op == op) return id * 2;
            p = (p + 1) & (table.size() - 1);
        }
        int id = int(n.size());
        n.push_back({a,b,c,op});
        table[p] = id;
        return id * 2;
    }
    int landRaw(int a, int b) {
        if (a > b) std::swap(a,b);
        if (a == 0 || a == (b ^ 1)) return 0;
        if (a == 1 || a == b) return b;
        return insert(a,b,0,0);
    }
    int land(int a,int b) {
        if(a<2||b<2||a==b||a==(b^1))return landRaw(a,b);
        for(int side=0;side<2;++side) {
            int x=side?b:a,y=side?a:b;
            if((y>>1)>=base && n[y>>1].op==0) {
                const Node p=n[y>>1];
                if(p.a==x || p.b==x) {
                    if(!(y&1))return y;
                    return landRaw(x,(p.a==x?p.b:p.a)^1);
                }
                if(p.a==(x^1) || p.b==(x^1))return (y&1)?x:0;
            } else if((y>>1)>=base && n[y>>1].op==2) {
                const Node p=n[y>>1];
                if((p.a>>1)==(x>>1))return landRaw(x,p.b^1^(x&1)^(y&1));
                if((p.b>>1)==(x>>1))return landRaw(x,p.a^1^(x&1)^(y&1));
            }
        }
        return landRaw(a,b);
    }
    int lxor(int a, int b) {
        int inv = (a ^ b) & 1;
        a &= ~1; b &= ~1;
        if (a > b) std::swap(a,b);
        if (!a) return b ^ inv;
        if (a == b) return inv;
        if((b>>1)>=base && n[b>>1].op==2) {
            const Node& p=n[b>>1];
            if(p.a==a)return p.b^inv;
            if(p.b==a)return p.a^inv;
        }
        if((a>>1)>=base && n[a>>1].op==2) {
            const Node& p=n[a>>1];
            if(p.a==b)return p.b^inv;
            if(p.b==b)return p.a^inv;
        }
        for(int side=0;side<2;++side) {
            int x=side?b:a,y=side?a:b;
            if((y>>1)>=base && n[y>>1].op==0) {
                const Node p=n[y>>1];
                if((p.a>>1)==(x>>1))return (p.a&1)?(landRaw(x^1,p.b^1)^1^inv):(landRaw(x,p.b^1)^inv);
                if((p.b>>1)==(x>>1))return (p.b&1)?(landRaw(x^1,p.a^1)^1^inv):(landRaw(x,p.a^1)^inv);
            }
        }
        if((a>>1)>=base && (b>>1)>=base && n[a>>1].op==2 && n[b>>1].op==2) {
            Node p=n[a>>1],q=n[b>>1];
            int x=-1,y=0;
            if(p.a==q.a){x=p.b;y=q.b;}
            else if(p.a==q.b){x=p.b;y=q.a;}
            else if(p.b==q.a){x=p.a;y=q.b;}
            else if(p.b==q.b){x=p.a;y=q.a;}
            if(x>=0) {
                if(x>y)std::swap(x,y);
                if(x==y)return inv;
                if(x==0)return y^inv;
                return insert(x,y,0,2)^inv;
            }
        }
        return insert(a,b,0,2) ^ inv;
    }
    int cofactor(int x,int s,int v) {
        if((x>>1)==(s>>1))return v^(x&1);
        if((x>>1)<base)return x;
        const Node& p=n[x>>1];
        int inv=x&1;
        if(p.op==7 && p.a==s)return (v?p.c:p.b)^inv;
        if(p.op==0 || p.op==2) {
            int k=-1,other=0;
            if((p.a>>1)==(s>>1)){k=v^(p.a&1);other=p.b;}
            else if((p.b>>1)==(s>>1)){k=v^(p.b&1);other=p.a;}
            if(k>=0)return (p.op==0?(k?other:0):(other^k))^inv;
        }
        return x;
    }
    int mux(int s, int a, int b) {
        if (s < 2) return s ? b : a;
        if (a == b) return a;
        if (s & 1) { s ^= 1; std::swap(a,b); }
        a=cofactor(a,s,0);b=cofactor(b,s,1);
        if(a==b)return a;
        if (a == (b ^ 1)) return lxor(s,a);
        if (a < 2) return a ? (land(s,b^1)^1) : land(s,b);
        if (b < 2) return b ? (land(s^1,a^1)^1) : land(s^1,a);
        if (a == s) return land(s,b);
        if (a == (s^1)) return land(s,b^1)^1;
        if (b == s) return land(s^1,a^1)^1;
        if (b == (s^1)) return land(s^1,a);
        int inv = a & 1;
        return insert(s,a^inv,b^inv,7) ^ inv;
    }
};

std::vector<int> topology(const Circuit& c) {
    int base = c.I + c.F + 2;
    std::vector<unsigned char> seen(c.G);
    std::vector<int> stack, order;
    stack.reserve(c.G); order.reserve(c.G);
    std::vector<int> roots=c.d;
    roots.insert(roots.end(),c.out.begin(),c.out.end());
    for (int signal : roots) {
        if(signal<base)continue;
        int root=signal-base;
        if (seen[root]) continue;
        stack.push_back(root);
        seen[root] = 1;
        while (!stack.empty()) {
            int k = stack.back();
            int a[3] = {c.in0[k],c.in1[k],c.in2[k]};
            bool pushed = false;
            for (int v : a) {
                if (v >= base && !seen[v-base]) {
                    seen[v-base] = 1;
                    stack.push_back(v-base);
                    pushed = true;
                    break;
                }
            }
            if (!pushed) { order.push_back(k); stack.pop_back(); }
        }
    }
    return order;
}

template<int S> void transposeStage(uint64_t* a) {
    constexpr uint64_t mask=~uint64_t(0)/((uint64_t(1)<<S)+1);
    if constexpr(S<4) {
        __m256i m=S==1?_mm256_set_epi64x(0,mask,0,mask):_mm256_set_epi64x(0,0,mask,mask);
        for(int j=0;j<64;j+=4) {
            __m256i v=_mm256_loadu_si256((const __m256i*)(a+j));
            __m256i p=_mm256_permute4x64_epi64(v,S==1?0xb1:0x4e);
            __m256i t=_mm256_and_si256(_mm256_xor_si256(_mm256_srli_epi64(v,S),p),m);
            v=_mm256_xor_si256(v,_mm256_xor_si256(_mm256_slli_epi64(t,S),_mm256_permute4x64_epi64(t,S==1?0xb1:0x4e)));
            _mm256_storeu_si256((__m256i*)(a+j),v);
        }
    } else {
        __m256i m=_mm256_set1_epi64x(mask);
        for(int b=0;b<64;b+=2*S)for(int j=0;j<S;j+=4) {
            __m256i x=_mm256_loadu_si256((const __m256i*)(a+b+j));
            __m256i y=_mm256_loadu_si256((const __m256i*)(a+b+j+S));
            __m256i t=_mm256_and_si256(_mm256_xor_si256(_mm256_srli_epi64(x,S),y),m);
            _mm256_storeu_si256((__m256i*)(a+b+j),_mm256_xor_si256(x,_mm256_slli_epi64(t,S)));
            _mm256_storeu_si256((__m256i*)(a+b+j+S),_mm256_xor_si256(y,t));
        }
    }
}
void transpose(uint64_t* a) {
    transposeStage<1>(a);transposeStage<2>(a);transposeStage<4>(a);
    transposeStage<8>(a);transposeStage<16>(a);transposeStage<32>(a);
}
struct alignas(32) Word { __m256i v; };
__m256i literal(const Word* v, int x) {
    return _mm256_xor_si256(v[x>>1].v, _mm256_set1_epi64x(-(int64_t)(x&1)));
}

struct ReadGroup {
    int base=0,width=0,depth=0;
    std::array<int,8> select{};
    std::array<int,64> nodes,slots;
    bool active=false;
    ReadGroup(){nodes.fill(-1);slots.fill(-1);}
};
struct ReadPlan {
    std::vector<ReadGroup> groups;
    std::vector<int> nodeGroup,directFF;
    int ffBlocks=0;
};

// Recognize regular register reads from their actual Boolean structure.
// Their selectors must be current inputs or old flip-flop states, so the
// entire word can be gathered before the remaining combinational program.
ReadPlan registerReads(const Circuit& c,const Builder& b) {
    ReadPlan plan;
    if(c.G<1000 || c.M<256 || std::count(c.type.begin(),c.type.end(),uint8_t(7))<=c.G/3)return plan;
    struct Pattern {int base=-1,chain=0;};
    struct Chain {int width=0,depth=0;std::array<int,8> select{};};
    std::vector<Pattern> patterns(b.n.size());
    std::vector<Chain> chains(4);
    chains[1].width=16;chains[2].width=32;chains[3].width=64;
    std::unordered_map<uint64_t,int> chainMap,groupMap;
    chainMap.reserve(8192);groupMap.reserve(2048);
    plan.nodeGroup.assign(b.n.size(),-1);
    for(int f=0;f<c.F;++f)patterns[1+c.I+f].base=f;
    for(int k=b.base;k<int(b.n.size());++k) {
        const Node& g=b.n[k];
        if(g.op!=7 || ((g.b|g.c)&1) || (g.a>>1)>=b.base)continue;
        Pattern p=patterns[g.b>>1],q=patterns[g.c>>1];
        if(p.base<0 || q.base<0 || p.chain!=q.chain)continue;
        int step=q.base-p.base,prev=p.chain;
        if(prev==0) {
            if(step==16)prev=1;else if(step==32)prev=2;else if(step==64)prev=3;else continue;
        } else if(chains[prev].depth>=8 || step!=(chains[prev].width<<chains[prev].depth))continue;
        uint64_t key=(uint64_t(prev)<<32)|uint32_t(g.a);
        auto [pos,inserted]=chainMap.emplace(key,int(chains.size()));
        if(inserted) {
            Chain next=chains[prev];next.select[next.depth++]=g.a;chains.push_back(next);
        }
        int id=pos->second;
        patterns[k]={p.base,id};
        const Chain& chain=chains[id];
        if(chain.depth<5)continue;
        int groupBase=p.base-p.base%chain.width;
        key=(uint64_t(id)<<32)|uint32_t(groupBase);
        auto [where,created]=groupMap.emplace(key,int(plan.groups.size()));
        if(created) {
            ReadGroup r;r.base=groupBase;r.width=chain.width;r.depth=chain.depth;r.select=chain.select;
            plan.groups.push_back(r);
        }
        int group=where->second;
        plan.groups[group].nodes[p.base%chain.width]=k;
        plan.nodeGroup[k]=group;
    }
    for(const auto& g:plan.groups) {
        int count=0;for(int k:g.nodes)count+=k>=0;
        if(count<g.width*3/4)for(int k:g.nodes)if(k>=0)plan.nodeGroup[k]=-1;
    }
    return plan;
}

// A straight-line AVX2 program. Each small block is reused for all SIMD
// columns, keeping its instructions hot even for a very large circuit.
struct Program {
    static constexpr int blockSize=4096;
    std::vector<unsigned char> code;
    void* memory = nullptr;
    using Function = void(*)(Word*,Word*,Word*);
    Function function = nullptr;
    int ffFirst=0,ffLast=0;
    void byte(int v) { code.push_back(static_cast<unsigned char>(v)); }
    void imm(int v) {
        for (int i=0;i<4;++i) byte(uint32_t(v)>>(i*8));
    }
    void memoryOp(int op, int dst, int src, int offset, int base=1) {
        if(base==1 && op!=0x7f && offset>=ffFirst && offset<ffLast) {
            base=2;offset-=ffFirst;
        }
        if(base<8) {byte(0xc5);byte(((dst<8)<<7)|((~src&15)<<3)|5);}
        else {byte(0xc4);byte(((dst<8)<<7)|0x41);byte(((~src&15)<<3)|5);}
        byte(op); byte(0x80 | (base&7) | ((dst&7)<<3)); imm(offset);
    }
    void regOp(int op, int dst, int a, int b) {
        if(b<8) {byte(0xc5);byte(((dst<8)<<7) | ((~a&15)<<3) | 5);}
        else {byte(0xc4);byte(((dst<8)<<7)|0x40|1);byte(((~a&15)<<3)|5);}
        byte(op); byte(0xc0 | ((dst&7)<<3) | (b&7));
    }
    void saveXmm(int reg,int offset,bool load) {
        byte(0xf3);if(reg>=8)byte(0x44);
        byte(0x0f);byte(load?0x6f:0x7f);byte(0x84|((reg&7)<<3));byte(0x24);imm(offset);
    }
    Program() = default;
    void block(const std::vector<Node>& gates, const std::vector<int>& dest,
        const std::vector<int>& kill, int columns, size_t first, std::vector<int>& cached,
        const std::vector<int>& heads,const std::vector<int>& links,const std::vector<int>& ds) {
        code.clear();code.reserve(blockSize*32);
        const int stride = columns*32;
            size_t end = std::min(first+blockSize,gates.size());
            int xors=0;
            for(size_t i=first;i<end;++i)xors+=gates[i].op==2;
            bool weightSpills=xors*2>int(end-first);
            struct Next {int a,b,c,d;};
            std::vector<Next> after(end-first);
            std::vector<int> future(cached.size(),int(end));
            for(size_t i=end;i-->first;) {
                const Node& g=gates[i];
                Next& nx=after[i-first];
                nx.d=future[dest[i]];
                future[dest[i]]=int(end);
                nx.a=future[g.a>>1];nx.b=future[g.b>>1];
                nx.c=g.op==7?future[g.c>>1]:int(end);
                future[g.a>>1]=future[g.b>>1]=int(i);
                if(g.op==7)future[g.c>>1]=int(i);
            }
            if(columns>1){byte(0xb8);imm(columns);}
            size_t loop=code.size();
            int occupant[14],current=int(first);
            bool dirty[14]{};
            std::fill(occupant,occupant+14,-1);
            auto allocate=[&](unsigned protectedRegs) {
                int best=-1;
                auto priority=[&](int r) {
                    int distance=future[occupant[r]]-current;
                    return distance*((weightSpills && dirty[r] && future[occupant[r]]<int(end))?1:2);
                };
                for(int r=0;r<14;++r) if(!(protectedRegs&(1u<<r))) {
                    if(occupant[r]<0){best=r;break;}
                    if(best<0 || priority(r)>priority(best) ||
                        (priority(r)==priority(best) && !dirty[r] && dirty[best]))best=r;
                }
                if(occupant[best]>=0) {
                    if(dirty[best]) memoryOp(0x7f,best,0,occupant[best]*stride);
                    cached[occupant[best]]=-1;
                }
                occupant[best]=-1;dirty[best]=false;
                return best;
            };
            auto load = [&](int slot,unsigned protectedRegs) {
                int r=cached[slot];
                if(r<0) {
                    r=allocate(protectedRegs);
                    occupant[r]=slot;cached[slot]=r;
                    memoryOp(0x6f,r,0,slot*stride);
                }
                return r;
            };
            for(size_t i=first;i<end;++i) {
                current=int(i);
                const Node& g=gates[i];
                int ax=g.a>>1,bx=g.b>>1;
                int a=-1,b=-1;
                int op=0;
                bool andMux=false;
                auto combine=[&](int opcode,int dst,int lhs,int slot) {
                    if(cached[slot]>=0) {
                        regOp(opcode,dst,lhs,cached[slot]);
                    } else memoryOp(opcode,dst,lhs,slot*stride);
                };
                if(g.op==7) {
                    int cx=g.c>>1;
                    int xorCost=(cached[bx]<0)+(g.c&1);
                    int andCost=(cached[ax]<0)+((g.c&1) && cached[cx]<0);
                    andMux=andCost<=xorCost;
                    if(andMux) {
                        a=load(ax,0);
                        b=(g.c&1)?load(cx,1u<<a):cached[cx];
                        combine(0xdf,14,a,bx);
                    } else {
                        b=load(bx,0);
                        combine(0xef,14,b,cx);
                        if(g.c&1)regOp(0xef,14,14,15);
                        combine(0xdb,14,14,ax);
                    }
                } else {
                    op=g.op==2?0xef:g.op==1?0xeb:0xdb;
                    if(g.op==0 && ((g.a^g.b)&1)) {
                        if(g.b&1)std::swap(ax,bx);
                        op=0xdf;
                    } else if(cached[ax]<0 && cached[bx]>=0)std::swap(ax,bx);
                    a=load(ax,0);
                    b=cached[bx];
                }
                int src[3]={g.a>>1,g.b>>1,g.c>>1};
                const Next& nx=after[i-first];
                future[src[0]]=nx.a;future[src[1]]=nx.b;
                if(g.op==7)future[src[2]]=nx.c;
                for(int j=0;j<3;++j)if(kill[i]&(1<<j)) {
                    int r=cached[src[j]];
                    if(r>=0){occupant[r]=-1;dirty[r]=false;cached[src[j]]=-1;}
                }
                int r=allocate(0);
                future[dest[i]]=nx.d;
                if(g.op==7 && andMux) {
                    if(g.c&1)regOp(0xdf,r,b,a);
                    else if(b>=0)regOp(0xdb,r,a,b);
                    else memoryOp(0xdb,r,a,(g.c>>1)*stride);
                    regOp(0xeb,r,r,14);
                } else if(g.op==7)regOp(0xef,r,14,b);
                else if(b>=0)regOp(op,r,a,b);
                else memoryOp(op,r,a,bx*stride);
                for(int f=heads[i];f>=0;f=links[f]) {
                    int value=r;
                    if(ds[f]&1){regOp(0xef,14,r,15);value=14;}
                    memoryOp(0x7f,value,0,f*stride,8);
                }
                if(!(kill[i]&8)) {
                    occupant[r]=dest[i];dirty[r]=true;cached[dest[i]]=r;
                }
            }
            for(int r=0;r<14;++r)if(occupant[r]>=0) {
                if(dirty[r])memoryOp(0x7f,r,0,occupant[r]*stride);
                cached[occupant[r]]=-1;
            }
            if(columns>1) {
                byte(0x48);byte(0x83);byte(0xc1);byte(32);
                byte(0x48);byte(0x83);byte(0xc2);byte(32);
                byte(0x49);byte(0x83);byte(0xc0);byte(32);
                byte(0xff);byte(0xc8);
                byte(0x0f);byte(0x85);imm(int(loop)-int(code.size()+4));
                byte(0x48);byte(0x81);byte(0xe9);imm(stride);
                byte(0x48);byte(0x81);byte(0xea);imm(stride);
                byte(0x49);byte(0x81);byte(0xe8);imm(stride);
            }
    }
    Program(const std::vector<Node>& gates, const std::vector<int>& dest,
        const std::vector<int>& kill, int slots, int columns,const Circuit& c,
        const std::vector<int>& heads,const std::vector<int>& links,const std::vector<int>& ds) {
        ffFirst=(1+c.I)*columns*32;ffLast=(1+c.I+c.F)*columns*32;
        code.reserve(gates.size()*24+512);
        byte(0x48);byte(0x81);byte(0xec);imm(168);
        for(int r=6;r<16;++r)saveXmm(r,(r-6)*16,false);
        regOp(0x76,15,15,15);
        for(int f=0;f<c.F;++f)if((ds[f]>>1)<1+c.I+c.F)for(int col=0;col<columns;++col) {
            memoryOp(0x6f,0,0,((ds[f]>>1)*columns+col)*32);
            if(ds[f]&1)regOp(0xef,0,0,15);
            memoryOp(0x7f,0,0,(f*columns+col)*32,8);
        }
        int chunks=(int(gates.size())+blockSize-1)/blockSize;
        std::vector<std::vector<unsigned char>> parts(chunks);
        int threads=std::max(1,std::min({8,omp_get_max_threads(),chunks}));
        #pragma omp parallel num_threads(threads)
        {
            std::vector<int> cached(slots,-1);
            Program p;
            p.ffFirst=ffFirst;p.ffLast=ffLast;
            #pragma omp for schedule(static)
            for(int i=0;i<chunks;++i) {
                p.block(gates,dest,kill,columns,size_t(i)*blockSize,cached,heads,links,ds);
                parts[i]=p.code;
            }
        }
        for(auto& p:parts)code.insert(code.end(),p.begin(),p.end());
        for(int r=6;r<16;++r)saveXmm(r,(r-6)*16,true);
        byte(0x48);byte(0x81);byte(0xc4);imm(168);
        byte(0xc5);byte(0xf8);byte(0x77);byte(0xc3);
        memory=VirtualAlloc(nullptr,code.size(),MEM_RESERVE|MEM_COMMIT,PAGE_READWRITE);
        if(memory) {
            std::memcpy(memory,code.data(),code.size());
            DWORD old;
            if(VirtualProtect(memory,code.size(),PAGE_EXECUTE_READ,&old)) {
                FlushInstructionCache(GetCurrentProcess(),memory,code.size());
                function=reinterpret_cast<Function>(memory);
            }
        }
    }
    ~Program() { if(memory)VirtualFree(memory,0,MEM_RELEASE); }
};

template<int Columns>
std::vector<uint64_t> execute(const Circuit& c, const std::vector<Node>& gates,
    const std::vector<int>& dest, const std::vector<int>& kill, int slots, const std::vector<int>& ds, const std::vector<int>& outs,
    const std::vector<int>& heads,const std::vector<int>& links,const ReadPlan& reads) {
    constexpr int batchSize=Columns*256;
    Program program(gates,dest,kill,slots,Columns,c,heads,links,ds);
    std::vector<uint64_t> weights(size_t(c.T)*c.O);
    for (size_t i = 0; i < weights.size(); ++i) weights[i] = mix(i);
    std::vector<uint64_t> result(c.M);
    int batches = (c.M+batchSize-1)/batchSize;
    int threads = std::max(1,std::min({8,omp_get_max_threads(),batches}));
    #pragma omp parallel for num_threads(threads) schedule(static)
    for (int batch = 0; batch < batches; ++batch) {
        std::vector<Word> vals(size_t(slots)*Columns), next(c.F*Columns), state(c.F*Columns);
        std::vector<uint64_t> packed(size_t(reads.ffBlocks)*batchSize);
        alignas(32) Word hashes[64][Columns]{};
        uint64_t rng[batchSize];
        for (int i = 0; i < batchSize; ++i) rng[i] = mix(c.seed ^ uint64_t(batch*batchSize+i));
        for (int t = 0; t < c.T; ++t) {
            for (int col=0;col<Columns;++col) {
                alignas(32) uint64_t pis[64][4]{};
                for (int w = 0; w < 4; ++w) {
                    uint64_t r[64];
                    for (int i = 0; i < 64; ++i) {
                        int m=col*256+w*64+i;
                        r[i] = mix(rng[m]);
                        rng[m] += 0x9e3779b97f4a7c15ULL;
                    }
                    transpose(r);
                    for (int i = 0; i < c.I; ++i) pis[i][w] = r[i];
                }
                for (int i = 0; i < c.I; ++i) vals[(1+i)*Columns+col].v = _mm256_load_si256((const __m256i*)pis[i]);
            }
            auto get=[&](int x,int col) {
                int id=x>>1;
                __m256i v=(id>c.I && id<=c.I+c.F)?state[(id-1-c.I)*Columns+col].v:vals[id*Columns+col].v;
                return _mm256_xor_si256(v,_mm256_set1_epi64x(-(int64_t)(x&1)));
            };
            if(reads.ffBlocks) {
                for(int col=0;col<Columns;++col) {
                    for(int block=0;block<reads.ffBlocks;++block)for(int w=0;w<4;++w) {
                        alignas(32) uint64_t r[64];
                        for(int i=0;i<64;++i) {
                            int f=block*64+i;
                            r[i]=f<c.F?reinterpret_cast<const uint64_t*>(&state[f*Columns+col].v)[w]:0;
                        }
                        transpose(r);
                        std::memcpy(packed.data()+size_t(block)*batchSize+col*256+w*64,r,sizeof(r));
                    }
                    for(const ReadGroup& g:reads.groups)if(g.active) {
                        alignas(32) uint64_t selects[8][4];
                        for(int i=0;i<g.depth;++i)_mm256_store_si256((__m256i*)selects[i],get(g.select[i],col));
                        for(int w=0;w<4;++w) {
                            alignas(32) uint64_t r[64]{};
                            for(int i=0;i<g.depth;++i)r[i]=selects[i][w];
                            transpose(r);
                            for(int i=0;i<64;++i) {
                                int f=g.base+g.width*int(r[i]);
                                r[i]=packed[size_t(f>>6)*batchSize+col*256+w*64+i]>>(f&63);
                            }
                            transpose(r);
                            for(int bit=0;bit<g.width;++bit)if(g.slots[bit]>=0)
                                reinterpret_cast<uint64_t*>(&vals[g.slots[bit]*Columns+col].v)[w]=r[bit];
                        }
                    }
                }
                for(int f:reads.directFF)for(int col=0;col<Columns;++col)next[f*Columns+col].v=get(ds[f],col);
            }
            if(program.function) program.function(vals.data(),state.data(),next.data());
            else for(size_t i=0;i<gates.size();++i) for(int col=0;col<Columns;++col) {
                const Node& g=gates[i];
                __m256i a=get(g.a,col),b=get(g.b,col),z;
                if(g.op==0)z=_mm256_and_si256(a,b);
                else if(g.op==1)z=_mm256_or_si256(a,b);
                else if(g.op==2)z=_mm256_xor_si256(a,b);
                else z=_mm256_xor_si256(b,_mm256_and_si256(a,_mm256_xor_si256(b,get(g.c,col))));
                vals[dest[i]*Columns+col].v=z;
                for(int f=heads[i];f>=0;f=links[f])next[f*Columns+col].v=_mm256_xor_si256(z,_mm256_set1_epi64x(-(int64_t)(ds[f]&1)));
            }
            if(!program.function)for(int f=0;f<c.F;++f)if((ds[f]>>1)<1+c.I+c.F)
                for(int col=0;col<Columns;++col)next[f*Columns+col].v=get(ds[f],col);
            for (int j = 0; j < c.O; ++j) {
                Word value[Columns];
                for(int col=0;col<Columns;++col) value[col].v=get(outs[j],col);
                uint64_t w = weights[size_t(t)*c.O+j];
                while (w) {
                    int bit = __builtin_ctzll(w);
                    for(int col=0;col<Columns;++col) hashes[bit][col].v = _mm256_xor_si256(hashes[bit][col].v,value[col].v);
                    w &= w-1;
                }
            }
            state.swap(next);
        }
        for(int col=0;col<Columns;++col) {
            alignas(32) uint64_t hs[64][4];
            for (int i = 0; i < 64; ++i) _mm256_store_si256((__m256i*)hs[i],hashes[i][col].v);
            for (int w = 0; w < 4; ++w) {
                uint64_t r[64];
                for (int i = 0; i < 64; ++i) r[i] = hs[i][w];
                transpose(r);
                for (int i = 0; i < 64 && batch*batchSize+col*256+w*64+i < c.M; ++i)
                    result[batch*batchSize+col*256+w*64+i] = r[i];
            }
        }
    }
    return result;
}
}

std::vector<uint64_t> simulate(const Circuit& c) {
    const int leaves = 1 + c.I + c.F;
    auto order = topology(c);
    Builder build(leaves,c.G);
    std::vector<int> map(c.I+c.F+c.G+2);
    map[1] = 1;
    for (int i = 2; i < leaves+1; ++i) map[i] = (i-1)*2;
    for (int k : order) {
        int a = map[c.in0[k]];
        int b = c.in1[k] >= 0 ? map[c.in1[k]] : 0;
        int z = 0;
        switch (c.type[k]) {
            case 0: z = build.land(a,b); break;
            case 1: z = build.land(a^1,b^1)^1; break;
            case 2: z = build.lxor(a,b); break;
            case 3: z = build.land(a,b)^1; break;
            case 4: z = build.land(a^1,b^1); break;
            case 5: z = build.lxor(a,b)^1; break;
            case 6: z = a^1; break;
            case 7: z = build.mux(a,b,map[c.in2[k]]); break;
        }
        map[leaves+1+k] = z;
    }
    ReadPlan reads=registerReads(c,build);
    auto isRead=[&](int k){return !reads.nodeGroup.empty() && reads.nodeGroup[k]>=0;};
    std::vector<unsigned char> needed(build.n.size());
    for (int d : c.d) needed[map[d]>>1] = 1;
    for (int o : c.out) needed[map[o]>>1] = 1;
    for (int k = int(build.n.size())-1; k >= leaves; --k) {
        if (!needed[k]) continue;
        if(isRead(k)){reads.groups[reads.nodeGroup[k]].active=true;continue;}
        const auto& x = build.n[k];
        needed[x.a>>1] = needed[x.b>>1] = 1;
        if (x.op == 7) needed[x.c>>1] = 1;
    }
    std::vector<int> renumber(build.n.size());
    std::vector<int> phase(build.n.size());
    for (int i = 0; i < leaves; ++i) renumber[i] = i;
    std::vector<Node> gates;
    std::vector<int> dest, kill, uses(build.n.size());
    for(int k=leaves;k<int(build.n.size());++k) if(needed[k] && !isRead(k)) {
        const Node& x=build.n[k];
        ++uses[x.a>>1];++uses[x.b>>1];
        if(x.op==7)++uses[x.c>>1];
    }
    for(int o:c.out)++uses[map[o]>>1];
    std::vector<int> available;
    int slots=leaves;
    for(auto& g:reads.groups)if(g.active) {
        for(int bit=0;bit<g.width;++bit) {
            int k=g.nodes[bit];
            if(k>=0 && needed[k] && isRead(k)) {
                renumber[k]=slots;g.slots[bit]=slots++;
                if(uses[k]==0)available.push_back(renumber[k]);
            }
        }
        reads.ffBlocks=std::max(reads.ffBlocks,(g.base+(g.width<<g.depth)+63)/64);
    }
    std::vector<int> gateIndex(build.n.size(),-1);
    auto remap = [&](int x) { return renumber[x>>1]*2 + ((x&1)^phase[x>>1]); };
    for (int k = leaves; k < int(build.n.size()); ++k) if (needed[k] && !isRead(k)) {
        const auto& x = build.n[k];
        Node g={remap(x.a),remap(x.b),remap(x.c),x.op};
        bool swapped=false;
        if(g.op==0 && (g.a&1) && (g.b&1)) {
            g.a^=1;g.b^=1;g.op=1;phase[k]=1;
        } else if(g.op==2) {
            phase[k]=(g.a^g.b)&1;g.a&=~1;g.b&=~1;
        } else if(g.op==7) {
            if(g.a&1) {g.a^=1;std::swap(g.b,g.c);swapped=true;}
            phase[k]=g.b&1;g.b^=phase[k];g.c^=phase[k];
        }
        gateIndex[k]=int(gates.size());gates.push_back(g);
        int deaths=0;
        auto consume=[&](int v,int bit) {
            int id=v>>1;
            if(--uses[id]==0) {
                deaths|=1<<bit;
                if(id>=leaves)available.push_back(renumber[id]);
            }
        };
        consume(x.a,0);consume(x.b,1);if(x.op==7)consume(x.c,2);
        if(swapped)deaths=(deaths&1)|((deaths&2)<<1)|((deaths&4)>>1);
        int slot;
        if(available.empty())slot=slots++;
        else {slot=available.back();available.pop_back();}
        renumber[k]=slot;dest.push_back(slot);
        if(uses[k]==0){available.push_back(slot);deaths|=8;}
        kill.push_back(deaths);
    }
    std::vector<int> ds(c.F), outs(c.O);
    for (int i = 0; i < c.F; ++i) ds[i] = remap(map[c.d[i]]);
    for (int i = 0; i < c.O; ++i) outs[i] = remap(map[c.out[i]]);
    std::vector<int> heads(gates.size(),-1),links(c.F,-1);
    for(int f=0;f<c.F;++f)if((map[c.d[f]]>>1)>=leaves) {
        int id=map[c.d[f]]>>1;
        if(isRead(id))reads.directFF.push_back(f);
        else {int k=gateIndex[id];links[f]=heads[k];heads[k]=f;}
    }
    return execute<1>(c,gates,dest,kill,slots,ds,outs,heads,links,reads);
}
