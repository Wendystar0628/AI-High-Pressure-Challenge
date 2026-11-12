#pragma once
#include "rt.h"
#include <cmath>
#include <cstdint>
// Sampling and shading contract; intersection is one reference implementation.
#define HD __host__ __device__
template<class R> struct V {
    R x,y,z;
    HD V(R a=0,R b=0,R c=0):x(a),y(b),z(c){}
    HD explicit V(const float* p):x(p[0]),y(p[1]),z(p[2]){}
    HD V operator+(V b)const{return V(x+b.x,y+b.y,z+b.z);}
    HD V operator-(V b)const{return V(x-b.x,y-b.y,z-b.z);}
    HD V operator*(R s)const{return V(x*s,y*s,z*s);}
    HD V operator*(V b)const{return V(x*b.x,y*b.y,z*b.z);}
    HD R dot(V b)const{return x*b.x+y*b.y+z*b.z;}
    HD V cross(V b)const{return V(y*b.z-z*b.y,z*b.x-x*b.z,x*b.y-y*b.x);}
    HD V unit()const{return *this*(R(1)/sqrt(dot(*this)));}
    HD R at(int k)const{return k==0?x:k==1?y:z;}
};
HD inline uint32_t mix32(uint32_t x){x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;return x^(x>>16);}
template<class R> HD R sample(uint32_t x){return R(mix32(x)>>8)*R(1.0/16777216.0);}
template<class R> struct Ray {V<R> o,d;};
template<class R> struct Hit {R t; int id;};
template<class R> HD bool intersect(const Triangle& t,Ray<R> r,R limit,R& distance){
    V<R> a(t.v0),e1=V<R>(t.v1)-a,e2=V<R>(t.v2)-a;
    V<R> p=r.d.cross(e2);R det=e1.dot(p);
    if(fabs(det)<R(1e-10))return false;
    R inv=R(1)/det;V<R> s=r.o-a;R u=s.dot(p)*inv;
    if(u<R(0)||u>R(1))return false;
    V<R> q=s.cross(e1);R v=r.d.dot(q)*inv;
    if(v<R(0)||u+v>R(1))return false;
    R d=e2.dot(q)*inv;
    if(d<=R(0.0002)||d>=limit)return false;
    distance=d;return true;
}
template<class R> HD Ray<R> camera(const Scene& s,int pixel,int sample_id){
    uint32_t key=s.seed+uint32_t(pixel)*0x9e3779b9u+uint32_t(sample_id)*0x85ebca6bu;
    R x=(R(pixel%s.width)+sample<R>(key))/R(s.width)*R(2)-R(1);
    R y=R(1)-(R(pixel/s.width)+sample<R>(key^0xa511e9b3u))/R(s.height)*R(2);
    return {V<R>(s.eye),(V<R>(s.w)+V<R>(s.u)*x+V<R>(s.v)*y).unit()};
}
template<class R> HD V<R> sky(V<R> d){R a=R(.5)*(d.y+R(1));return V<R>(R(.95),R(.93),R(.95))*(R(1)-a)+V<R>(R(.40),R(.55),R(.85))*a;}
// Query provides closest(ray,limit) and blocked(ray,limit).
template<class R,class Query> HD V<R> radiance(const Scene& s,int pixel,int sid,Query& query){
    Ray<R> r=camera<R>(s,pixel,sid);V<R> result,through(R(1),R(1),R(1));
    for(int depth=0;depth<s.max_depth;depth++){
        Hit<R> hit=query.closest(r,R(1e20));
        if(hit.id<0){result=result+through*sky(r.d);break;}
        const Triangle& t=query.triangle(hit.id);
        V<R> n=(V<R>(t.v1)-V<R>(t.v0)).cross(V<R>(t.v2)-V<R>(t.v0)).unit();
        if(n.dot(r.d)>0)n=n*R(-1);
        V<R> p=r.o+r.d*hit.t+n*R(.001);
        V<R> l=V<R>(s.light).unit();R cosine=n.dot(l);if(cosine<0)cosine=0;
        R visible=cosine>0&&!query.blocked({p,l},R(1e20))?R(1):R(0);
        int open=0;
        V<R> axis=fabs(n.z)<R(.8)?V<R>(0,0,1):V<R>(0,1,0);
        V<R> tx=axis.cross(n).unit(),ty=n.cross(tx);
        for(int a=0;a<s.ao;a++){
            uint32_t key=s.seed+uint32_t(pixel)*0x9e3779b9u+uint32_t(sid)*0x85ebca6bu+uint32_t(depth)*0xc2b2ae35u+uint32_t(a)*0x27d4eb2du;
            R x=R(2)*sample<R>(key^0x68bc21ebu)-R(1),y=R(2)*sample<R>(key^0x02e5be93u)-R(1);
            R z=R(.25)+R(.75)*sample<R>(key^0x967a889bu);
            V<R> dir=(tx*x+ty*y+n*z).unit();
            open+=!query.blocked({p,dir},R(s.ao_radius));
        }
        R ambient=s.ao?R(open)/R(s.ao):R(1);
        R value=R(.08)+R(.20)*ambient+R(.72)*cosine*visible;
        result=result+through*V<R>(t.color)*(value*(R(1)-R(t.mirror)));
        through=through*R(t.mirror);
        if(t.mirror==0)break;
        r={p,(r.d-n*(R(2)*r.d.dot(n))).unit()};
    }
    return result;
}
