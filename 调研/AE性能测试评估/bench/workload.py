"""按题面 3.4 累加实际激活采样与未裁切图元面积。仅为工作量计算，不是性能外推。"""
import json, math
from pathlib import Path
def layers(rounds):
    return [(sum(j+1 for j in range(rounds) if i>>j&1),160+sum(24*2**j for j in range(min(rounds,6)) if i>>j&1),160+sum(13*2**(j-6) for j in range(6,rounds) if i>>j&1)) for i in range(2**rounds)]
def calc(rounds,times):
    ls=layers(rounds);active=0;area=0
    for t in times:
        for shift,_,_ in ls:
            f=t-shift
            if not 0<=f<600:continue
            active+=1;u=min(f/240,2);s=1-.4*u if u<1 else .6+.4*(u-1)
            area+=40000*s*s
    return dict(active_layer_samples=active,unclipped_quad_pixels=round(area),key_property_evaluations=3*active)
out={'resolution':[1920,1080],'frames':600,'output_pixels':1920*1080*600,'raw_rgba_bytes':1920*1080*600*4}
out['A']=calc(12,range(600))
bt=[]
for f in range(600):
    for i in range(8):
        t=f-i*60
        if t<0:continue
        if i<4:t=t if t<=300 else 600-t
        bt.append(t)
out['B']={**calc(10,bt),'child_comp_samples':len(bt),'full_canvas_child_pixel_bound':len(bt)*1920*1080}
for angle in [180,360]:out['C'+str(angle)]=calc(10,(f-90/360+(s+.5)/8*angle/360 for f in range(600) for s in range(8)))
out['C_pixel_temporal_samples']=1920*1080*600*8
out['edit4']={'layers':65536,'keys':65536*9,'key_visits_if_each_step_full_scan':65536*9*20,'F9_key_changes':65536*9*5,'layer_redraw_instances':65536*20,'unclipped_quad_pixel_bound_per_redraw':65536*40000}
out['edit5']={'layers_before':65536,'layers_peak':131072,'keys_peak':131072*9,'new_layers_total':65536*8,'new_keys_total':65536*9*8,'redraw_layer_instances':8*(65536+131072)}
out['4k']={'output_pixels':3840*2160*600,'raw_rgba_bytes':3840*2160*600*4,'C_pixel_temporal_samples':3840*2160*600*8,'note':'同几何坐标与仅扩大输出画布时，图层面积不自动乘四；同比放大几何才乘四。'}
Path(__file__).with_name('workload.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
