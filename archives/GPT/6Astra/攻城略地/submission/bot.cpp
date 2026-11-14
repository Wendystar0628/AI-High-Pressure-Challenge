#include "engine.hpp"
#include <algorithm>
#include <cmath>
#include <vector>
#include <chrono>

// Forecast committed arrivals exactly; allocate mobile troops to missions.
namespace bot {
constexpr int M=24,H=32;
struct Plan { double score=-1e90; std::vector<Order> orders; int target=-1; int wait=0; };
struct Planner {
 const State& s; int n,remain;
 int army[M]{}, avail[M]{}, ev[M][H+1][3]{}, own[M][H+1]{}, tr[M][H+1]{};
 // Keep a launch position funded while waiting for an enemy-neutral battle.
 int ambushHold[M]{}, enemyCapture[M]{}; int enemyFree[M]{}; int locked[M]{}; int nearEnemy[M]{}, loss[M]{}; double reserve[M]{};
 std::vector<Order> orders;
 Planner(const State& st):s(st),n(st.nodes.size()),remain(st.max_turns-st.turn+1){
  for(int i=0;i<n;i++) army[i]=s.nodes[i].troops;
  for(auto f:s.fleets) if(f.turns_left<=H) ev[f.to][f.turns_left][f.owner]+=f.troops;
  for(int i=0;i<n;i++) {update(i);if(s.nodes[i].owner==0)for(int t=1;t<=20;t++)if(own[i][t]==2){enemyCapture[i]=t;break;}nearEnemy[i]=30;for(int j=0;j<n;j++) if(j!=i&&s.nodes[j].owner==2) nearEnemy[i]=std::min(nearEnemy[i],s.dist[i][j]);}
 }
 void fight(int& o,int& a,int b,int c)const {
  if(!b&&!c)return;
  int z[3]={0,b,c}; z[o]+=a;
  int w=0; for(int k=1;k<3;k++)if(z[k]>z[w])w=k;
  int sec=0;for(int k=0;k<3;k++)if(k!=w)sec=std::max(sec,z[k]);
  if(z[w]>sec) o=w;
  a=z[w]-sec;
 }
 void update(int i){
  int o=s.nodes[i].owner,a=army[i];own[i][0]=o;tr[i][0]=a;
  for(int t=1;t<=H;t++){if(o)a+=s.nodes[i].growth;fight(o,a,ev[i][t][1],ev[i][t][2]);own[i][t]=o;tr[i][t]=a;}
 }
 void send(int i,int j,int a){if(a<=0)return;orders.push_back({i,j,a});army[i]-=a;avail[i]-=a;ev[j][s.dist[i][j]][1]+=a;update(i);update(j);}
 void availability(){
  for(int i=0;i<n;i++){
   avail[i]=0;loss[i]=H+1;if(s.nodes[i].owner!=1)continue;
   int mn=army[i];for(int t=1;t<=std::min(H,remain);t++){if(own[i][t]!=1){loss[i]=t;mn=0;break;}mn=std::min(mn,tr[i][t]);}
   avail[i]=std::max(0,mn);
  }
 }
 // Estimate the troops an opponent must divert to save its threatened nodes.
 void enemyCommitments(){
  int free[M]{};
  for(int i=0;i<n;i++)if(s.nodes[i].owner==2){
   enemyFree[i]=army[i];free[i]=army[i];
   for(int t=1;t<=std::min(22,remain);t++)free[i]=std::min(free[i],own[i][t]==2?tr[i][t]:0);
  }
  std::vector<int> targets;for(int i=0;i<n;i++)if(s.nodes[i].owner==2)targets.push_back(i);
  std::sort(targets.begin(),targets.end(),[&](int a,int b){return s.nodes[a].growth>s.nodes[b].growth;});
  for(int j:targets){
   int deadline=0;for(int t=1;t<=std::min(20,remain);t++)if(own[j][t]!=2){deadline=t;break;}
   if(!deadline)continue;
   std::vector<int> donors;int total=0;
   for(int k=0;k<n;k++)if(k!=j&&free[k]>0&&s.dist[k][j]<=deadline){donors.push_back(k);total+=free[k];}
   auto defends=[&](int amount){
    int o=2,a=army[j];
    for(int t=1;t<=std::min(22,remain);t++){
     if(o)a+=s.nodes[j].growth;
     fight(o,a,ev[j][t][1],ev[j][t][2]+(t==deadline?amount:0));
     if(o!=2)return false;
    }return true;
   };
   if(!total||!defends(total))continue;
   int lo=0,hi=total;while(lo<hi){int m=(lo+hi)/2;if(defends(m))hi=m;else lo=m+1;}
   std::sort(donors.begin(),donors.end(),[&](int a,int b){return s.dist[a][j]<s.dist[b][j];});
   for(int k:donors){int a=std::min(lo,free[k]);free[k]-=a;enemyFree[k]-=a;lo-=a;}
  }
 }
 void safety(){
  availability();
  enemyCommitments();
  for(int i=0;i<n;i++)avail[i]=std::max(0,avail[i]-locked[i]);
  int cap[M];for(int i=0;i<n;i++)cap[i]=avail[i];
  // Local defenders cover every attack that could land before a response.
  for(int i=0;i<n;i++)if(s.nodes[i].owner==1){
   double required=0;
   for(int t=2;t<=std::min(10,remain);t++){
    double enemy=0,help=0;
    for(int k=0;k<n;k++)if(s.nodes[k].owner==2&&s.dist[k][i]<=t)enemy+=enemyFree[k];
    for(int k=0;k<n;k++)if(k!=i&&s.nodes[k].owner==1&&s.dist[k][i]<t)help+=cap[k]*.85;
    double incoming=0;
    for(int u=1;u<=t;u++)incoming+=ev[i][u][1]-ev[i][u][2];
    required=std::max(required,enemy*.85-help-s.nodes[i].growth*t-incoming);
   }
   reserve[i]=required;
   avail[i]=std::min(avail[i],std::max(0,army[i]-locked[i]-(int)required));
  }
 }
 // Test a set of arrivals, including all already committed fleets.
 bool succeeds(int j,const int* extra,int deadline,int buffer,int until)const{
  int o=s.nodes[j].owner,a=army[j];
  for(int t=1;t<=until;t++){
   if(o)a+=s.nodes[j].growth;
   fight(o,a,ev[j][t][1]+extra[t],ev[j][t][2]);
   if(t>=deadline&&(o!=1||a<(t==deadline?buffer:0)))return false;
  }return true;
 }
 Plan mission(int j,bool defense,int wait=0,bool secure=true){
  Plan best;std::vector<int> src;
  int capacity[M]{};
  for(int i=0;i<n;i++)if(s.nodes[i].owner==1&&loss[i]>wait)capacity[i]=std::max(0,avail[i]+tr[i][wait]-army[i]);
  for(int i=0;i<n;i++)if(i!=j&&capacity[i]>0&&s.nodes[i].owner==1&&s.dist[i][j]+wait<=remain)src.push_back(i);
  std::sort(src.begin(),src.end(),[&](int a,int b){return s.dist[a][j]!=s.dist[b][j]?s.dist[a][j]<s.dist[b][j]:avail[a]>avail[b];});
  int extra[H+1]{};std::vector<Order> os;int total=0;double travel=0;
  for(int i:src){
   int d=s.dist[i][j]+wait; if(defense&&d>loss[j])break;
   int end=std::min(remain,std::max(22,d+4));
   int buffer=defense?0:1;
   if(!defense&&secure){
    double risk=0;
    for(int k=0;k<n;k++)if(k!=j&&s.nodes[k].owner==2){
     int dis=s.dist[k][j];
     if(dis<=d+3)risk+=(enemyFree[k]+s.nodes[k].growth*std::max(0,d-dis))*std::exp(-dis/9.0)*0.8;
    }
    buffer+=(int)risk;
   }
   extra[d]+=capacity[i];
   if(succeeds(j,extra,d,buffer,end)){
    int lo=0,hi=capacity[i];
    while(lo<hi){int mid=(lo+hi)/2;extra[d]-=capacity[i]-mid;bool ok=succeeds(j,extra,d,buffer,end);extra[d]+=capacity[i]-mid;if(ok)hi=mid;else lo=mid+1;}
    extra[d]-=capacity[i]-lo;
    int co=s.nodes[j].owner,ca=army[j],capture=0;
    for(int t=1;t<=end;t++){if(co)ca+=s.nodes[j].growth;fight(co,ca,ev[j][t][1]+extra[t],ev[j][t][2]);if(co!=1)capture=t;}
    capture++;
    extra[d]+=capacity[i]-lo;
    int cost=total+lo;double avg=(travel+lo*d)/std::max(1,cost);
    double g=s.nodes[j].growth;bool enemy=(own[j][d]==2||s.nodes[j].owner==2);
    double life=std::min(45,remain-capture);
    double value=g*life*(enemy?1.7:1.0);
    if(defense)value=g*life*2.4+army[j]*0.3;
    if(!enemy&&!defense&&s.nodes[j].owner==0)value-=army[j]*0.8;
    double danger=0;
    if(!defense)for(int k=0;k<n;k++)if(s.nodes[k].owner==2&&k!=j){int dis=s.dist[j][k];if(dis<=d+3)danger+=army[k]*0.3/(1+dis*0.3);}
    double score=(value-danger)/(cost+10+g*(avg*.7+capture*1.1))*std::exp(-wait*0.07);
    if(defense)score+=2;
    if(!defense&&nearEnemy[j]<avg)score*=std::exp((nearEnemy[j]-avg)*0.13);
    if(score>best.score){best.score=score;best.target=j;best.wait=wait;best.orders=os;if(lo)best.orders.push_back({i,j,lo});}
    extra[d]-=capacity[i];
    // Further sources cannot improve an already sufficient nearest set.
    break;
   }
   os.push_back({i,j,capacity[i]});total+=capacity[i];travel+=capacity[i]*d;
  }
  return best;
 }
 void accelerate(){
  // Pull forward an already funded conquest. The late fleet becomes its reserve.
  for(int pass=0;pass<n;pass++){
   double best=0;int bi=-1,bj=-1,ba=0;
   for(int j=0;j<n;j++)if(s.nodes[j].owner!=1&&own[j][std::min(22,remain)]==1){
    int capture=0;for(int t=1;t<=std::min(22,remain);t++)if(own[j][t]!=1)capture=t;
    ++capture;
    for(int i=0;i<n;i++)if(s.nodes[i].owner==1&&avail[i]>0&&s.dist[i][j]<capture){
     int d=s.dist[i][j];int extra[H+1]{};extra[d]=avail[i];
     if(!succeeds(j,extra,d,1,std::min(22,remain)))continue;
     int lo=1,hi=avail[i];while(lo<hi){int m=(lo+hi)/2;extra[d]=m;if(succeeds(j,extra,d,1,std::min(22,remain)))hi=m;else lo=m+1;}
     double gain=(capture-d)*s.nodes[j].growth;
     double value=gain/(lo+2.0);
     if(value>best&&gain>lo*.35){best=value;bi=i;bj=j;ba=lo;}
    }
   }
   if(bi<0)break;
   send(bi,bj,ba);safety();
  }
 }
 std::vector<Order> run(){
  availability();
  // Rescue nodes against observed attacks, using safe troops from other nodes.
  for(int it=0;it<n;it++){
   Plan best;for(int j=0;j<n;j++)if(s.nodes[j].owner==1&&loss[j]<=std::min(22,remain)){Plan p=mission(j,true);if(p.score>best.score)best=p;}
   if(best.orders.empty())break;
   for(auto o:best.orders)send(o.from,o.to,o.troops);availability();
  }
  safety();
  accelerate();
  bool chosen[M]{};
  for(int it=0;it<n;it++){
   Plan best;
   for(int j=0;j<n;j++)if(!chosen[j]&&own[j][std::min(22,remain)]!=1){for(int w: {0,1,2,4,6}) {if(w&&(s.nodes[j].owner!=0||(nearEnemy[j]<7&&!enemyCapture[j])))continue;auto p=mission(j,false,w);if(p.score>best.score)best=p;}}
   if(best.score<=0||best.orders.empty())break;
   chosen[best.target]=true;
   if(best.wait==0){for(auto o:best.orders)send(o.from,o.to,o.troops);safety();}
   else for(auto o:best.orders){if(enemyCapture[best.target])ambushHold[o.from]+=std::min(avail[o.from],o.troops);locked[o.from]+=std::min(avail[o.from],o.troops);avail[o.from]=std::max(0,avail[o.from]-o.troops);}
  }
  availability();
  for(int i=0;i<n;i++)avail[i]=std::max(0,avail[i]-ambushHold[i]);
  // Reinforce a forward friendly base; keep a monotone approach to the enemy.
  for(int i=0;i<n;i++)if(s.nodes[i].owner==1&&avail[i]>0){
   int dest=-1;double bs=-1e50;
   for(int j=0;j<n;j++)if(i!=j&&s.nodes[j].owner==1&&own[j][std::min(H,remain)]==1){
    int d=s.dist[i][j];if(d>=remain)continue;
    if(d+1>=nearEnemy[i]&&loss[i]>3)continue;
    if(nearEnemy[j]+1>=nearEnemy[i]&&loss[i]>3)continue;
    double sc=(nearEnemy[i]-nearEnemy[j])*2.0-d-0.01*tr[j][d];
    if(sc>bs){bs=sc;dest=j;}
   }
   if(dest>=0)send(i,dest,avail[i]);
  }
  return orders;
 }
};
}
namespace bot {
double terminal(const State& st){
 double v=0;int alive[3]{};
 for(auto x:st.nodes)if(x.owner){alive[x.owner]++;v+=(x.owner==1?1:-1)*(x.troops+x.growth*std::min(25,st.max_turns-st.turn+1));}
 for(auto x:st.fleets){alive[x.owner]++;v+=(x.owner==1?1:-1)*x.troops;}
 if(!alive[1])return -1e7;if(!alive[2])return 1e7;
 return v;
}
std::vector<Order> aggressive(const State& s){
 Planner p(s);auto a=p.run();p.availability();Plan best;
 for(int j=0;j<p.n;j++)if(s.nodes[j].owner==2&&p.own[j][std::min(22,p.remain)]!=1){auto q=p.mission(j,false);if(q.score>best.score)best=q;}
 if(best.score>0)for(auto o:best.orders)a.push_back(o);
 return a;
}
}

// Optimize the initial portfolio, including spatial alternatives with the same budget.
static std::vector<Order> openingDecision(const State& s){
 const auto openingStart=std::chrono::steady_clock::now();
 int home=-1,enemy=-1,n=s.nodes.size();for(int i=0;i<n;i++){if(s.nodes[i].owner==1)home=i;if(s.nodes[i].owner==2)enemy=i;}
 if(home<0||enemy<0)return {};
 auto base=bot::Planner(s).run();
 std::vector<int> possible;
 for(int j=0;j<n;j++)if(s.nodes[j].owner==0&&s.dist[home][j]<=s.dist[enemy][j]+1)possible.push_back(j);
 auto portfolio=[&](int from,int other,int horizon){
  double dp[101];unsigned masks[101]{};for(int c=0;c<=100;c++)dp[c]=-1e30;dp[0]=0;
  for(int j=0;j<n;j++)if(s.nodes[j].owner==0&&s.dist[from][j]<=s.dist[other][j]+1){
   int cost=s.nodes[j].troops+1;double val=s.nodes[j].growth*(horizon-s.dist[from][j])-s.nodes[j].troops;
   if(val<=0)continue;
   for(int c=100;c>=cost;c--)if(dp[c-cost]+val>dp[c]){dp[c]=dp[c-cost]+val;masks[c]=masks[c-cost]|(1u<<j);}
  }
  int c=0;for(int b=1;b<=100;b++)if(dp[b]>dp[c])c=b;return masks[c];
 };
 auto ordersFor=[&](unsigned mask,int from){std::vector<Order>a;for(int j=0;j<n;j++)if(mask>>j&1)a.push_back({from,j,s.nodes[j].troops+1});return a;};
 auto opponent=bot::Planner(flip(s)).run();
 auto alternate=ordersFor(portfolio(enemy,home,22),enemy);
 auto evaluate=[&](const std::vector<Order>& first){
  double value=1e100;
  for(int model=0;model<2;model++){
   State st=s;
   for(int t=0;t<24;t++){
    auto a=t==0?first:bot::Planner(st).run();
    auto b=t==0?(model==0?opponent:alternate):bot::Planner(flip(st)).run();
    st=step(st,a,b);if(result(st))break;
   }
   double v=0;for(auto nd:st.nodes)if(nd.owner)v+=(nd.owner==1?1:-1)*(nd.troops+30*nd.growth);
   for(auto f:st.fleets)v+=(f.owner==1?1:-1)*f.troops;
   value=std::min(value,v);
  }return value;
 };
 std::vector<unsigned> visited;
 double best=evaluate(base);unsigned bm=0;for(auto o:base)bm|=1u<<o.to;
 std::vector<Order> answer=base;
 auto test=[&](unsigned m){
  if(std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-openingStart).count()>650)return;
  if(std::find(visited.begin(),visited.end(),m)!=visited.end())return;
  visited.push_back(m);auto a=ordersFor(m,home);double v=evaluate(a);
  if(v>best+.01){best=v;bm=m;answer=a;}
 };
 for(int horizon:{16,22,30,40,60})test(portfolio(home,enemy,horizon));
 for(int round=0;round<2;round++){
  unsigned previous=bm;std::vector<std::pair<double,unsigned>> neighbors;
  auto offer=[&](unsigned mask){
   if(std::find(visited.begin(),visited.end(),mask)!=visited.end())return;
   int cost=0;double val=0;for(int j=0;j<n;j++)if(mask>>j&1){cost+=s.nodes[j].troops+1;val+=s.nodes[j].growth*(26-s.dist[home][j])-s.nodes[j].troops;}
   if(cost<=100)neighbors.push_back({val,mask});
  };
  for(int j:possible){offer(bm^(1u<<j));if(!(bm>>j&1))for(int k:possible)if(bm>>k&1)offer(bm^(1u<<j)^(1u<<k));}
  std::sort(neighbors.begin(),neighbors.end(),[](auto a,auto b){return a.first>b.first;});
  int evaluated=0;for(auto [v,m]:neighbors){if(evaluated++>=32)break;test(m);}
  if(bm==previous)break;
 }
 return answer;
}
// Preserve a winning economy; consider concentrated raids only when behind late.
std::vector<Order> decide(const State& s){
 static bool engaged=false;
 static int behind=0;
 if(s.turn==1){engaged=false;behind=0;return openingDecision(s);}
 const auto decisionStart=std::chrono::steady_clock::now();
 bot::Planner pl(s);auto base=pl.run();
 if(s.turn<175)return base;
 double standing=0;for(auto nd:s.nodes)if(nd.owner)standing+=(nd.owner==1?1:-1)*(nd.troops+nd.growth*(s.max_turns-s.turn+1));
 for(auto f:s.fleets)standing+=(f.owner==1?1:-1)*f.troops;
 behind=standing<0?behind+1:0;
 if(!engaged&&behind<3)return base;
 std::vector<std::vector<Order>> candidates{base};
 pl.availability();
 for(int j=0;j<pl.n;j++)if(s.nodes[j].owner==2&&pl.own[j][std::min(22,pl.remain)]!=1){
  auto p=pl.mission(j,false,0,false);
  if(!p.orders.empty()){auto a=base;for(auto o:p.orders)a.push_back(o);candidates.push_back(a);}
 }
 if(candidates.size()==1)return base;
 int horizon=std::min(22,s.max_turns-s.turn+1);double best=-1e100;int selected=0;
 for(int c=0;c<(int)candidates.size();c++){
  if(c>0&&std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-decisionStart).count()>24)break;
  double val=1e100;
  for(int model=0;model<2;model++){
   State st=s;
   for(int t=0;t<horizon;t++){
    auto a=t==0?candidates[c]:bot::Planner(st).run();
    auto opp=flip(st);auto b=model==0?bot::Planner(opp).run():bot::aggressive(opp);
    st=step(st,a,b);if(result(st))break;
   }
   val=std::min(val,bot::terminal(st));
  }
  if(val>best+.1){best=val;selected=c;}
 }
 if(selected)engaged=true;
 return candidates[selected];
}
