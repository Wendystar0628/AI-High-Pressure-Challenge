"""第三轮：六种多轴铸件和四种14—26件装配；全部尺寸见证仅用于私有制图。"""
import math,json,copy
from pathlib import Path
import numpy as np
import build_problem_set as b

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
RESEARCH=ROOT/'调研/机械结构重建'
NAMES=['双蜗室异面三通泵壳','五斜座交汇比例阀体','复合环腔涡轮轴承箱','斜交三轴变速箱壳',
       '双级迷宫旋流分离壳','双回路桥接伺服总壳','三斜轴液压分配器总装','四向斜置夹紧阀组',
       '五支路偏心顺序控制总成','六轴联动分度阀台总装']
REASONS=[
 '双蜗室不同轴心和不同标高，偏置环腔、两层隔桥、三条异面斜流道及局部过渡；必须沿剖视追踪孔的实际交汇。',
 '五个不同倾角和方位的阀座，双斜肩与三层不对称腔，轴向沉孔及侧支路互通，阀座真形须在斜视与剖面间转换。',
 '八边形承力壳、偏置双环腔、阶梯轴承与错层迷宫回路，斜撑和四向油路穿过不同隔墙。',
 '三条不共面的传动轴线、变截面封闭齿轮腔和四个斜接口，支承孔与内部窗口的交汇关系不能用正交孔替代。',
 '圆筒与圆锥旋转面、偏心芯筒及双层环形迷宫，切向/径向/斜向入口和局部环槽，需要区分相连及不相连腔。',
 '双回路、多层桥接和六向空间支路，回流隔墙窗口与旁通孔交错；多种角度、圆角和局部沉台同时定位。',
 '14件：复杂双蜗室壳加三套斜轴阀套/阀芯/端盖，前盖与密封环、双定位销；轴向接触链确定插入量。',
 '18件：四条不同斜轴上的阀套、带键活塞和端盖，独立侧盖、环与三销；不能把零件坐标系当装配坐标系。',
 '22件：五套不同尺寸的斜置阀芯和偏心凸轮，阶梯支承及孔槽定向、前端复合盖和四销，需区分装配旋转与零件局部偏心。',
 '26件：六个非共面轴系及其异径阶梯套、键向芯轴、偏心凸轮，双层内腔/跨腔斜路/五销定位构成完整总装。'
]

def xyz(theta,az):
    t,a=map(math.radians,(theta,az))
    n=np.array([math.sin(t)*math.cos(a),math.sin(t)*math.sin(a),math.cos(t)])
    u=np.array([math.cos(t)*math.cos(a),math.cos(t)*math.sin(a),-math.sin(t)])
    n[np.abs(n)<1e-14]=0;u[np.abs(u)<1e-14]=0
    return n,u,np.cross(n,u)

class HardPart(b.Part):
    def __init__(self,title,position=None,rotate=None):
        super().__init__(title,position,rotate)
        self.ports=[];self.detail=[80,80];self.cut_points=[100,80,68]
    def omit(self,name):
        index=next(i for i,f in enumerate(self.features,1) if f['name']==name)
        self.features.pop(index-1)
        kept=[]
        for m in self.measures:
            ids=[k-(k>index) for k in m['covers_features'] if k!=index]
            if ids:
                m['covers_features']=ids;m['source_feature']=ids[0];kept.append(m)
        self.measures=kept;valid={id(m) for m in kept}
        self.coordinates={k:m for k,m in self.coordinates.items() if id(m) in valid}
        return self
    def cyl(self,*args,**kwargs):
        super().cyl(*args,**kwargs)
        m=self.measures[-1]
        cut=kwargs.get('cut',args[7] if len(args)>7 else False)
        if getattr(self,'is_casting',False) and cut:
            m['text']=[m['text'][0]+' '+args[0]]
        else:m.update(type='diameter',center=m.pop('at'),d=m['value'],text=m['text'][0],outside=True,avoid_box=True)
        return self
    def block(self,*args,construction_axes=(),**kwargs):
        super().block(*args,**kwargs)
        index=len(self.features);_,x0,y0,z0,x1,y1,z1,*_=args
        drops=[(a,v) for a in construction_axes for v in ({'X':(x0,x1),'Y':(y0,y1),'Z':(z0,z1)}[a])]
        if kwargs.get('open_side')=='X+':drops.append(('X',x1))
        for axis,value in drops:
            key=(axis,round(value,6));m=self.coordinates.get(key)
            if m is None:continue
            m['covers_features']=[i for i in m['covers_features'] if i!=index]
            if not m['covers_features']:
                self.measures=[x for x in self.measures if x is not m];self.coordinates.pop(key)
            elif m['source_feature']==index:m['source_feature']=m['covers_features'][0]
        if kwargs.get('open_side')=='X+':
            for y in (y0,y1):
                m=self.coordinates.get(('Y',round(y,6)))
                if m and m['covers_features']==[index]:
                    m['_point'][0]=x0;m['at']=[x0,y]
        return self
    def oblique(self,name,end,theta,az,d,length,cut=False,bore=None,bolts=False,rounded=True):
        n,u,v=xyz(theta,az);end=np.array(end,dtype=float)
        plane=dict(origin=end.tolist(),normal=n.tolist(),x_dir=u.tolist())
        self.features.append(dict(type='extrude',name=name,op='cut' if cut else 'add',plane=plane,
            loops=[dict(circle=[0,0],d=d)],depth=[-length,0]))
        self.datum(end.tolist())
        label='斜视'+str(len(self.special_views)+1)
        self.special_views.append(dict(type='auxiliary',direction=(-n).tolist(),up=v.tolist(),label=label,name=label,
            hidden=True,parent='主视图',arrow_at=[float(end[0]),float(end[2])]))
        uv=[float(end@u),float(end@v)]
        self.special_views[-1]['keep']=dict(shape='circle',center=uv,r=d/2+14)
        self.dimension(label,uv,[f'Φ{b.fmt(d)} '+name],d,'孔径' if cut else '直径')
        self.measures[-1].update(type='diameter',center=self.measures[-1].pop('at'),d=d,text=f'Φ{b.fmt(d)} '+name,outside=True,avoid_box=True)
        self.dimension(label,uv,[f'轴向长{b.fmt(length)}'],length,'孔深' if cut else '轴向长度')
        self.dimension(label,uv,[f'倾角{theta}°'],theta,'角度')
        self.dimension(label,uv,[f'方位{az}°'],az,'角度')
        if not cut and rounded:
            witness=end+v*(d/2)
            self.finish('fillet',[witness.tolist()],1.2,label,[uv[0],uv[1]+d/2],name+'外端圆棱')
        if bore:
            bd,depth,cd,cdp=bore
            self.features.append(dict(type='hole',name=name+'主通道',plane=plane,at=[0,0],d=bd,depth=depth))
            self.dimension(label,uv,[f'Φ{bd} 通道'],bd,'孔径')
            self.measures[-1].update(type='diameter',center=self.measures[-1].pop('at'),d=bd,text=f'Φ{bd} 通道',outside=True,avoid_box=True)
            self.dimension(label,uv,[f'从外端面深{depth}'],depth,'孔深')
            self.features.append(dict(type='hole',name=name+'阶梯沉台',plane=plane,at=[0,0],d=cd,depth=cdp))
            self.dimension(label,uv,[f'Φ{cd} 沉台'],cd,'孔径')
            self.measures[-1].update(type='diameter',center=self.measures[-1].pop('at'),d=cd,text=f'Φ{cd} 沉台',outside=True,avoid_box=True)
            self.dimension(label,uv,[f'沉台深{cdp}'],cdp,'孔深')
        if bolts:
            first_hole=len(self.features)+1
            for a in (0,90,180,270):
                x,y=27*math.cos(math.radians(a)),27*math.sin(math.radians(a))
                self.features.append(dict(type='hole',name=name+f'端盖螺孔{a//90+1}',plane=plane,at=[x,y],d=5,depth=10))
            self.dimension(label,[uv[0]+27,uv[1]],['4孔均布 Φ5'],5,'孔径')
            self.dimension(label,[uv[0]+27,uv[1]],['分布圆Φ54；首孔在轴线/总Z共面低侧'],54,'分布圆直径')
            self.dimension(label,[uv[0]+27,uv[1]],['螺孔深10'],10,'孔深')
            for measure in self.measures[-3:]:measure['covers_features']=list(range(first_hole,len(self.features)+1))
        return dict(end=end.tolist(),theta=theta,az=az,n=n.tolist(),u=u.tolist(),v=v.tolist(),d=d)
    def spin(self,name,cx,cy,profile,cut=False):
        self.features.append(dict(type='revolve',name=name,op='cut' if cut else 'add',plane='XZ',origin=[cx,cy,0],axis='y',loops=[dict(path=profile)],angle=360))
        self.datum([cx,cy,profile[0][1]])
        for radius,z in profile:
            self.coord('Z',z,[cx+radius,cy,z])
            self.dimension('主视图',[cx+radius,z],[(f'Φ{b.fmt(radius*2)} ' if radius else '轮廓至轴线 ')+name],radius*2,('孔径' if cut else '直径') if radius else '轴线闭合约束')
        return self
    def ring(self,name,axis,a,z,c1,c2,outer,inner):
        plane={'X':'YZ','Y':'XZ','Z':'XY'}[axis]
        depth=[-z,-a] if axis=='Y' else [a,z]
        self.features.append(dict(type='extrude',name=name,op='cut',plane=plane,
            loops=[dict(circle=[c1,c2],d=outer),dict(circle=[c1,c2],d=inner)],depth=depth))
        view={'X':'左视图','Y':'主视图','Z':'俯视图'}[axis];at=[-c1,c2] if axis=='X' else [c1,c2]
        self.dimension(view,at,[f'环腔外径Φ{outer}'],outer,'孔径')
        self.dimension(view,at,[f'环腔内径Φ{inner}'],inner,'直径')
        self.dimension(view,at,[f'环腔轴向宽{z-a}'],z-a,'轴向长度')
        pa={'X':[a,c1,c2],'Y':[c1,a,c2],'Z':[c1,c2,a]}[axis];pb={'X':[z,c1,c2],'Y':[c1,z,c2],'Z':[c1,c2,z]}[axis]
        self.datum(pa);self.datum(pb)
        return self

def foot(p,w=280,d=180):
    p.is_casting=True
    p.block('地脚法兰',0,0,0,w,d,18)
    p.finish('fillet',[[0,0,9],[w,0,9],[w,d,9],[0,d,9]],6,'俯视图',[0,0],'地脚四角')
    return p

def common_end(p,w=280,d=180):
    p.bolt('地脚锪孔',[12,w-12],[12,d-12],0,18,10,cbore=(18,7))
    p.cyl('底排液','Z',0,44,w*.5,d*.5,10,True)
    target=getattr(p,'section_targets',None)
    p.cut_points=target[:3] if target else [w/2,d/2,48]
    p.section_names=target[3] if target else ['A-A（底板宽向中面）','B-B（底板长向中面）','C-C（过纵向连孔轴线）']
    return p

def twin():
    p=foot(HardPart(NAMES[0]))
    p.cyl('左蜗室外壳','Y',16,164,78,84,132)
    p.cyl('右蜗室外壳','Y',16,164,206,94,112)
    p.block('中层承力桥',68,40,30,220,140,78)
    p.poly('前联结肋',[[28,18],[248,18],[206,100],[156,78],[78,110]],8,20)
    p.poly('后联结肋',[[28,18],[248,18],[206,100],[156,78],[78,110]],160,172)
    p.cyl('左主腔','Y',30,150,78,84,90,True)
    p.cyl('右主腔','Y',30,150,206,94,70,True)
    p.ring('左前环形返流腔','Y',24,40,78,84,108,98)
    p.ring('右后环形返流腔','Y',136,156,206,94,92,82)
    p.cyl('左前凸缘','Y',0,16,78,84,92)
    p.finish('fillet',[[78,16,130]],3,'主视图',[78,130],'左前凸缘根部')
    p.cyl('左轴封孔','Y',0,42,78,84,36,True)
    p.cyl('左轴承沉台','Y',0,8,78,84,52,True)
    p.cyl('右后凸缘','Y',164,180,206,94,86)
    p.cyl('右后过流孔','Y',144,180,206,94,34,True)
    p.cyl('偏置中层横道','X',78,206,96,58,20,True)
    p.cyl('上层交叉孔','X',78,206,56,106,16,True)
    p.block('桥内返流下腔',116,60,38,168,120,54,True)
    p.block('桥内返流上腔',124,66,62,160,110,72,True)
    p.cyl('两层节流孔','Z',44,72,146,88,12,True)
    for j,(e,t,a) in enumerate([([64,42,164],30,225),([206,132,182],42,45),([292,90,122],62,0)]):
        p.ports.append(p.oblique(f'异面接口{j+1}',e,t,a,64,72 if j==1 else 48,bore=(32,86,50,6),bolts=True))
    for j,(e,t,a) in enumerate([([44,164,108],58,90),([230,16,116],52,270),([262,132,94],72,0)]):
        p.oblique(f'交汇支孔{j+1}',e,t,a,10+j*2,90,True)
    p.block('前检修浅槽',116,8,50,166,20,66,True)
    p.finish('chamfer',[[78,0,110]],1.5,'主视图',[78,110],'左前沉台口')
    p.detail=[78,112]
    p.section_targets=[78,90,58,['A-A（底板宽向中面）','B-B（过左主腔轴线）','C-C（过中层横道轴线）']]
    return common_end(p)

def valve(count=5,title=None,seats=None,port_length=62):
    p=foot(HardPart(title or NAMES[1]),300,200)
    p.poly('双肩阀壳',[[18,18],[282,18],[282,104],[246,150],[186,150],[150,124],[94,150],[54,150],[18,106]],18,182)
    p.block('前下腔',32,32,34,128,92,86,True)
    p.block('后下腔',166,108,34,268,168,90,True)
    p.block('上回路腔',68,44,102,232,156,134,True)
    p.block('上回路隔桥',138,66,102,150,138,134)
    p.cyl('前横向流道','X',30,272,62,60,22,True)
    p.cyl('后横向流道','X',30,272,138,64,24,True)
    p.cyl('中层纵向连孔','Y',32,168,150,48,18,True)
    p.cyl('前右竖孔','Z',48,134,218,62,14,True)
    p.cyl('后左竖孔','Z',48,134,82,138,16,True)
    p.block('左换向窗口',128,56,50,138,78,74,True)
    p.block('右换向窗口',150,122,66,166,148,82,True)
    p.cyl('前接口凸缘','Y',0,18,94,74,90)
    p.finish('fillet',[[94,18,119]],3,'主视图',[94,119],'前凸缘根部')
    p.cyl('前接口通孔','Y',0,46,94,74,32,True)
    p.cyl('前接口沉台','Y',0,8,94,74,50,True)
    p.cyl('后接口凸缘','Y',182,200,212,76,86)
    p.cyl('后接口通孔','Y',150,200,212,76,32,True)
    p.ring('前环形分配腔','Y',24,34,94,74,68,54)
    p.ring('后环形分配腔','Y',164,176,212,76,66,52)
    seats=seats or [([58,42,176],28,225),([150,46,158],38,270),([242,42,176],48,315),
           ([66,158,176],34,135),([234,158,176],52,45),([150,156,162],42,90)]
    for j,(end,t,a) in enumerate(seats[:count]):
        p.ports.append(p.oblique(f'斜座{j+1}',end,t,a,64,port_length,bore=(32,112,50,6),bolts=True))
    for j,(e,t,a) in enumerate([([18,58,90],65,180),([282,142,90],55,0),([152,182,108],72,90)]):
        p.oblique(f'跨层旁通孔{j+1}',e,t,a,12,116,True)
    p.poly('前左三角撑',[[28,18],[62,18],[62,98]],8,18)
    p.poly('后右三角撑',[[238,18],[272,18],[238,100]],182,194)
    p.finish('chamfer',[[94,0,99]],2,'主视图',[94,99],'前接口沉台口')
    p.detail=[94,105]
    return common_end(p,300,200)

def bearing():
    p=foot(HardPart(NAMES[2]),300,196)
    p.poly('八边承力壳',[[24,18],[276,18],[276,104],[240,154],[88,164],[24,108]],20,176)
    p.cyl('主环腔','Y',36,160,124,90,100,True)
    p.cyl('偏置副环腔','Y',48,150,210,106,64,True)
    p.cyl('前外轴承座','Y',0,20,124,90,116)
    p.finish('fillet',[[124,20,148]],4,'主视图',[124,148],'前轴承座根部')
    p.cyl('后轴承座','Y',176,194,124,90,108)
    for a,z,d in [(0,12,64),(12,38,46),(154,182,46),(182,194,60)]:p.cyl('轴承阶梯孔','Y',a,z,124,90,d,True)
    for a,z,od,ind in [(26,36,116,106),(72,84,116,108),(148,164,114,104)]:p.ring('隔断迷宫环腔','Y',a,z,124,90,od,ind)
    p.block('上层油匣',86,44,142,218,152,154,True)
    p.block('油匣斜隔桥',144,70,142,154,126,154)
    p.cyl('右副轴承孔','X',210,282,114,106,32,True)
    p.cyl('右副轴承外颈','X',270,298,114,106,64)
    p.cyl('右颈复通','X',210,298,114,106,32,True)
    for j,(e,t,a) in enumerate([([74,46,174],32,225),([220,146,174],46,45),([310,60,124],68,0),([-26,144,90],90,180)]):
        p.ports.append(p.oblique(f'轴系油座{j+1}',e,t,a,52,90 if j==3 else 62,bore=(20,96,34,7),rounded=j!=2))
    for j,(e,t,a) in enumerate([([48,20,100],60,270),([246,176,130],54,90),([164,62,159],34,180),([164,134,159],40,0)]):
        p.oblique(f'迷宫交叉油孔{j+1}',e,t,a,8+j,100,True)
    p.poly('左加强腹板',[[28,18],[76,18],[76,124]],10,20)
    p.poly('右加强腹板',[[240,18],[274,18],[240,128]],176,188)
    p.finish('chamfer',[[124,0,122]],2,'主视图',[124,122],'前轴承口')
    p.detail=[124,128]
    p.section_targets=[124,98,90,['A-A（底板宽向中面）','B-B（过主轴承轴线）','C-C（过主轴承轴线）']]
    return common_end(p,300,196)

def gear():
    p=valve(4,NAMES[3])
    p.omit('后左竖孔') # 后续齿轮主腔完全覆盖此孔；不标注最终不存在的加工要素。
    # 与阀体不同：删去狭长流路，改为封闭、多层的齿轮/轴承空间。
    p.block('低速齿轮下腔',46,42,32,142,158,104,True)
    p.block('高速齿轮上腔',166,54,76,248,148,140,True)
    p.block('齿轮啮合窗口',142,72,68,166,130,104,True)
    p.cyl('低速正交轴承孔','Y',0,200,98,70,38,True)
    p.cyl('前低速沉台','Y',0,10,98,70,54,True)
    p.ring('低速挡圈槽','Y',14,18,98,70,60,54)
    p.cyl('高速横轴承孔','X',150,290,112,112,30,True)
    p.cyl('高速沉孔','X',276,290,112,112,44,True)
    p.oblique('第三轴斜轴承孔',[264,144,127],44,35,28,148,True)
    p.oblique('第三轴油封沉孔',[264,144,127],44,35,42,12,True)
    p.block('左叉耳',30,62,138,46,86,184)
    p.block('右叉耳',30,118,138,46,142,184)
    p.cyl('叉耳共销','Y',62,142,38,168,12,True)
    p.cut_points=[98,100,70];p.section_names=['A-A（底板宽向中面）','B-B（过低速轴线）','C-C（过低速轴线）']
    return p

def separator():
    p=foot(HardPart(NAMES[4]),280,220)
    p.cyl('旋流筒身','Z',18,138,140,110,184)
    p.spin('圆锥收束顶',140,110,[[0,126],[92,126],[46,186],[0,186]])
    p.cyl('顶颈','Z',178,202,140,110,72)
    p.cyl('顶颈通孔','Z',144,202,140,110,38,True)
    p.spin('内锥主腔',140,110,[[0,34],[76,34],[76,124],[34,172],[0,172]],True)
    p.cyl('偏心内芯筒','Z',32,126,154,110,96)
    p.cyl('内芯通道','Z',32,174,154,110,58,True)
    p.ring('下层环形迷宫','Z',30,42,154,110,90,78)
    p.ring('中层环形迷宫','Z',68,80,154,110,88,76)
    p.ring('上层环形迷宫','Z',112,124,154,110,86,74)
    p.block('下层错口',142,56,30,158,66,42,True)
    p.block('中层错口',196,102,68,212,118,80,True)
    p.block('上层错口',146,150,112,162,166,124,True)
    p.cyl('前切向入口','Y',0,56,94,100,46)
    p.cyl('前切向流道','Y',0,110,94,100,24,True)
    p.cyl('后侧排流颈','Y',164,220,174,68,50)
    p.cyl('后侧排流道','Y',110,220,174,68,28,True)
    for j,(e,t,a) in enumerate([([60,56,144],48,225),([218,160,142],58,45),([180,80,192],30,315),([92,160,180],40,135)]):
        p.ports.append(p.oblique(f'分离支路{j+1}',e,t,a,52,62,bore=(22,112,36,8)))
    for j,(e,t,a) in enumerate([([86,0,80],72,270),([180,220,86],62,90),([166,110,202],25,180)]):
        p.oblique(f'跨迷宫斜孔{j+1}',e,t,a,10,142,True)
    for x,y in [(64,54),(204,152)]:
        p.poly('径向三角肋',[[x,18],[x+20,18],[x+20,104]],y,y+8)
    p.detail=[140,174]
    p.section_targets=[140,110,100,['A-A（过旋流筒轴线）','B-B（过旋流筒轴线）','C-C（过前切向入口轴线）']]
    return common_end(p,280,220)

def bridge():
    p=valve(6,NAMES[5])
    p.block('左下独立回路',34,38,28,118,86,48,True)
    p.block('右下独立回路',184,114,28,268,164,48,True)
    p.block('高跨桥',104,84,130,196,116,160)
    p.block('桥内竖向套腔',136,92,124,164,108,150,True)
    p.cyl('桥顶轴向孔','Z',136,160,150,100,12,True)
    p.oblique('桥左跨腔斜路',[104,100,152],66,180,16,132,True)
    p.oblique('桥右跨腔斜路',[196,100,152],58,0,14,126,True)
    p.ring('前接口内旁路环槽','Y',20,24,94,74,50,40)
    p.ring('后接口内旁路环槽','Y',176,180,212,76,50,40)
    p.cyl('前旁路环槽连通孔','X',94,122,22,74,6,True)
    p.cyl('后旁路环槽连通孔','X',212,240,178,76,6,True)
    p.cyl('左回路竖接孔','Z',28,132,74,62,10,True)
    p.cyl('右回路竖接孔','Z',28,132,228,138,12,True)
    p.block('桥底避空窗',118,86,108,132,114,126,True)
    return p

def sleeve(j):
    p=HardPart(f'{j}号斜阀套')
    p.cyl('配合外圆','Z',0,24,0,0,32)
    p.cyl('端部定位法兰','Z',18,24,0,0,50)
    p.cyl('阀芯配合通孔','Z',0,24,0,0,22,True)
    p.ring('内密封环槽','Z',7,10,0,0,26,22)
    p.cyl('径向配油孔','X',-16,16,0,13,6,True)
    p.block('定向键槽',22,-3,18,26,3,24,True,open_side='X+')
    p.detail=[0,18]
    return p

def spool(j,eccentric=False):
    p=HardPart(f'{j}号'+('偏心芯轴' if eccentric else '带键阀芯'))
    p.cyl('工作轴','Z',0,48,0,0,20)
    p.cyl('止推轴肩','Z',18,24,0,0,28)
    p.ring('第一节流环槽','Z',4,8,0,0,20,16)
    p.ring('第二节流环槽','Z',12,15,0,0,20,14)
    p.cyl('横销孔','X',-10,10,0,34,5,True)
    p.block('定向铣扁',7,-12,38,12,12,48,True,open_side='X+',construction_axes=['Y'])
    if eccentric:
        p.cyl('偏心圆凸轮','Z',30,36,8+j%3,0,24)
        p.cyl('凸轮偏置销孔','Z',30,36,14+j%3,0,4,True)
    return p

def cap(j):
    p=HardPart(f'{j}号阀端盖')
    p.cyl('端盖圆板','Z',0,10,0,0,64)
    p.cyl('芯轴避让孔','Z',0,10,0,0,30,True)
    for a in (0,90,180,270):
        p.cyl('均布端盖通孔','Z',0,10,27*math.cos(math.radians(a)),27*math.sin(math.radians(a)),5,True)
    p.block('键向指示缺口',29,-2,0,34,2,10,True,open_side='X+')
    return p

def assembly(ports,count,index):
    seat_variants={
      7:[([54,38,182],37,225),([246,50,184],43,320),([74,162,184],31,130),([226,162,182],49,45)],
      8:[([48,44,186],32,235),([148,46,170],46,270),([250,42,188],39,325),([70,162,184],44,145),([236,158,188],36,35)],
      9:[([48,42,184],35,220),([148,44,168],43,275),([248,42,186],51,320),([52,160,182],42,140),([148,160,166],37,95),([246,162,188],47,40)]}
    base=valve(ports,NAMES[index]+'壳体',seats=seat_variants.get(index),port_length=72 if index>=7 else 62)
    if index>=8:
        base.block('下层平衡腔',116,82,24,184,118,36,True)
        base.oblique('跨腔同步斜道',[204,18,112],64,235,10,150,True)
        base.ring('中层缓冲环腔','Y',86,102,150,76,58,42)
    parts=[base];base.position=[0,0,0];base.assembly_constraints=[]
    for j,port in enumerate(base.ports,1):
        end=np.array(port['end']);n=np.array(port['n'])
        rot=[dict(axis='Y',angle=port['theta']),dict(axis='Z',angle=port['az'])]
        for kind,part,offset in [('套',sleeve(j),-24),('芯',spool(j,index>=8),-18),('盖',cap(j),0)]:
            part.position=(end+n*offset).tolist();part.rotate=rot
            no=len(parts)+1;parts.append(part)
            base.assembly_constraints.append((no,f'序号{no}与壳体斜座{j}同轴；'+
                ('阀套法兰外端面与斜座端面齐平' if kind=='套' else '轴肩下端面与斜座端面齐平' if kind=='芯' else '端盖内端面贴斜座外端面')+
                '；键向在该轴线与总+Z的共面低侧'))
    cover=HardPart('前接口阶梯盖',position=[94,0,74],rotate=[dict(axis='X',angle=90)])
    cover.cyl('盖盘','Z',0,10,0,0,90)
    cover.cyl('定位颈','Z',-6,0,0,0,50)
    cover.cyl('中心避空','Z',-6,10,0,0,26,True)
    cover.cyl('偏置测压孔','Z',-6,10,22,0,6,True)
    cover.block('定向止口缺口',-46,-3,0,-40,3,10,True,open_side='X-')
    parts.append(cover);base.assembly_constraints.append((len(parts),'前盖定位颈与前接口沉台同轴、端面贴合；测压孔位于总+X侧'))
    ring=HardPart('前密封定位环',position=[94,8,74],rotate=[dict(axis='X',angle=90)])
    ring.cyl('密封环','Z',0,2,0,0,50)
    ring.cyl('环内孔','Z',0,2,0,0,32,True)
    ring.ring('外圆密封槽','Z',.5,1.5,0,0,50,46)
    parts.append(ring);base.assembly_constraints.append((len(parts),'定位环与前接口同轴，环外端面距壳体前接口端面6；环槽沿轴向居中',6))
    pinpos=[(8,60),(292,140),(8,140),(292,60),(150,8)]
    while len(parts)<count:
        k=len(parts)-(ports*3+3);x,y=pinpos[k]
        # 壳体增设独立定位销孔；不是地脚螺栓，以零件序号对应。
        base.cyl(f'定位销孔{k+1}','Z',0,18,x,y,8,True)
        pin=HardPart(f'{k+1}号阶梯定位销',position=[x,y,-8])
        pin.cyl('定位杆','Z',0,26,0,0,8)
        pin.cyl('止推头','Z',26,32,0,0,14)
        pin.cyl('拔销螺孔','Z',24,32,0,0,4,True)
        parts.append(pin);base.assembly_constraints.append((len(parts),f'与壳体第{k+1}定位销孔同轴；止推头下表面贴底板上表面'))
    base.asm_name=NAMES[index]
    return parts

BUILDERS=[twin,lambda:valve(),bearing,gear,separator,bridge,
          lambda:assembly(3,14,6),lambda:assembly(4,18,7),lambda:assembly(5,22,8),lambda:assembly(6,26,9)]

def new_spec(pid,title,parts):
    sheets=[]
    notes=['技术要求','单位mm；链式和相对尺寸须结合剖视推算。','R/C均须建模；未注棱保持理论交线。',
      '斜轴倾角对总+Z，方位从总+X逆时针；孔从外端面向内。','斜视首孔在轴线与总Z的共面低侧；其余孔90°均布。']
    if len(parts)>1:
        base=parts[0]
        notes.append('序号1坐标系与总坐标系重合；其余零件由配合及键向定位。')
        rows=[dict(no=str(i),name=p.title,qty=1,material='HT250' if i==1 else '钢',note='') for i,p in enumerate(parts,1)]
        def wrap(text):
            lines=[];line='';units=0
            for ch in text:
                width=1 if ord(ch)>127 else .6
                if units+width>22:lines.append(line);line='';units=0
                line+=ch;units+=width
            if line:lines.append(line)
            return lines
        def dimension(item,view,point):
            no,text=item[:2];value=item[2] if len(item)>2 else 0
            return dict(view=view,type='leader',at=point,text=wrap(text),value=value,category='装配贴合及定向关系')
        def add(views,dims,balloons):
            sheets.append(dict(paper='A1',scale=[1,.8,.65,.5,.4,.3],frame='assembly',title=title,
                drawing_no=f'JX-{pid}-Z{len(sheets)+1}',views=views,dimensions=dims,parts_list=rows,notes=notes,balloons=balloons))
        overview=[dict(view='主视图',part='1',at=[150,9],text='1')]
        for j,port in enumerate(base.ports,1):
            anchor=np.array(port['end'])+24*np.array(port['u'])+5*np.array(port['n'])
            overview.append(dict(view='主视图',part=str(3*j+1),at=[float(anchor[0]),float(anchor[2])],text=str(3*j+1)))
        add([dict(type='front'),dict(type='top')],[],overview)
        for j,port in enumerate(base.ports):
            end=np.array(port['end']);n=np.array(port['n']);u=np.array(port['u']);v=np.array(port['v'])
            label=chr(65+j);name=f'{label}-{label}（斜座{j+1}轴向键向剖视）'
            center=[float(end@u),float(end@n)]
            aux=dict(type='auxiliary',direction=v.tolist(),up=n.tolist(),label=label,name=name,hidden=False,scale=(1.5 if (pid,j) in {('22',2),('23',3)} else 2),
                keep=dict(shape='circle',center=center,r=56),
                section=dict(label=label,point=end.tolist(),mode='full',parent='俯视图',unsectioned=[str(3*j+3)]))
            dims=[];balloons=[]
            for k,(du,dn) in enumerate([(14,-16),(14,2),(24,5)]):
                item=base.assembly_constraints[3*j+k];no=item[0]
                at=[center[0]+du,center[1]+dn]
                dims.append(dimension(item,name,at));balloons.append(dict(view=name,part=str(no),at=at,text=str(no)))
            add([dict(type='top',free=True,at=([150,350] if (pid,j)==('23',3) else [150,220])),aux],dims,balloons)
        extras=base.assembly_constraints[3*len(base.ports):]
        name='G-G（前盖与定位环轴向剖视）'
        section=dict(type='left',free=True,name=name,scale=2,hidden=False,
            keep=dict(shape='circle',center=[0,74],r=56),
            section=dict(label='G',point=[94,0,0],mode='full',parent='俯视图'))
        anchors=[[5,94],[-7,94]]
        dims=[dimension(item,name,at) for item,at in zip(extras[:2],anchors)]
        balloons=[dict(view=name,part=str(item[0]),at=at,text=str(item[0])) for item,at in zip(extras[:2],anchors)]
        add([dict(type='top',free=True,at=[150,220]),section],dims,balloons)
        for start in range(2,len(extras),4):
            group=extras[start:start+4];dims=[];balloons=[]
            for item in group:
                no=item[0];part=parts[no-1];at=[part.position[0],part.position[2]]
                dims.append(dimension(item,'主视图',at));balloons.append(dict(view='主视图',part=str(no),at=at,text=str(no)))
            add([dict(type='front'),dict(type='top')],dims,balloons)
    for no,p in enumerate(parts,1):
        standard=[m for m in p.measures if not m['view'].startswith('斜视')]
        packs=[(standard[k:k+16],None) for k in range(0,len(standard),16)]
        for aux in p.special_views:
            dims=[m for m in p.measures if m['view']==aux['name']]
            packs.extend((dims[k:k+6],aux) for k in range(0,len(dims),6))
        for page,(group,aux) in enumerate(packs):
            start=page*16;dims=copy.deepcopy(group)
            views=[dict(type='front'),dict(type='top'),dict(type='left')] if aux is None else [dict(type='front'),copy.deepcopy(aux)]
            # 多个剖面分别经过不同环腔/支路；不把所有标注塞进同一页。
            if no==1 and aux is None:
                q=p.cut_points
                if start%64==0:views.append(dict(type='front',free=True,name=p.section_names[0],section=dict(label='A',point=[0,q[1],0],mode='full',parent='俯视图')))
                elif start%64==16:views.append(dict(type='left',free=True,name=p.section_names[1],section=dict(label='B',point=[q[0],0,0],mode='full',parent='主视图')))
                elif start%64==32:views.append(dict(type='top',free=True,name=p.section_names[2],section=dict(label='C',point=[0,0,q[2]],mode='full',parent='主视图')))
                else:views.append(dict(type='detail',parent='主视图',center=p.detail,r=20,label='Ⅰ',name='局部Ⅰ',scale=2.5))
            sheets.append(dict(paper='A1' if no==1 else 'A2',scale=[1.25,1,.8,.65,.5] if no==1 else [2,1.5,1],frame='part',part=str(no),
                title=p.title,drawing_no=f'JX-{pid}-{no:02d}-{start//16+1}',material='HT250' if no==1 else '钢',views=views,dimensions=dims,notes=notes))
    for i,s in enumerate(sheets,1):s['id']=f'{pid}-{i}'
    return dict(problem=pid,title=title,sheets=sheets)

def legacy(old):
    fn=[b.valve_simple,b.bearing_simple,b.cover_simple,b.mixing,b.baffle,b.control,b.pumpbase,b.manifold,b.servo,b.transmission,b.wedge_assembly,b.eccentric_assembly,b.volute_casting,b.angled_valve,b.fork_housing][int(old)-1]
    ps=fn();ps=ps if isinstance(ps,list) else [ps]
    if int(old)<=12 and old!='03':
        p=ps[0];fs=[f for f in p.features if f.get('op')=='add' and f.get('plane')=='XY' and 'rect' in f.get('loops',[{}])[0] and f['depth'][0]==0]
        f=max(fs,key=lambda f:(f['loops'][0]['rect'][2]-f['loops'][0]['rect'][0])*(f['loops'][0]['rect'][3]-f['loops'][0]['rect'][1])) if fs else p.features[0]
        if f.get('plane')=='XY' and 'rect' in f['loops'][0]:
            x0,y0,x1,y1=f['loops'][0]['rect'];z0,z1=f['depth']
            p.finish('fillet',[[x0,y0,(z0+z1)/2]],2,'俯视图',[x0,y0],'底板左前外竖棱')
            p.finish('chamfer',[[x0+(x1-x0)/4,y0,z0]],1,'主视图',[x0+(x1-x0)/4,z0],'所指前下直棱')
    return ps

def build():
    oldmap=json.loads((HERE/'旧新题号映射.json').read_text(encoding='utf-8'))
    records=[];audit=[]
    for i in range(1,26):
        pid=f'{i:02d}'
        if i<=15:
            row=oldmap[i-1];old=row['old'];ps=legacy(old);name=row['name'];tier=row['tier'];weight=row['max']
            for p in ps:p.chain_dimensions()
            spec=b.spec_for_parts(old,name,ps)
            spec['problem']=pid
            for j,s in enumerate(spec['sheets'],1):
                s['id']=f'{pid}-{j}';s['drawing_no']=s['drawing_no'].replace('JX-'+old+'-','JX-'+pid+'-')
            reason=f"保留旧{old}题；头部五型号平均F={row['head_mean_f']:.4f}，按实测由易到难重排。"
        else:
            data=BUILDERS[i-16]();ps=data if isinstance(data,list) else [data]
            for p in ps:p.chain_dimensions()
            name=NAMES[i-16];tier='困难档';weight=4.4;reason=REASONS[i-16]
            spec=new_spec(pid,name,ps)
        desc=dict(problem=pid,parts=[p.desc(n) for n,p in enumerate(ps,1)])
        b.save(HERE/'参考答案'/f'第{pid}题.json',desc);b.save(HERE/'出图规格'/f'{pid}.json',spec)
        records.append(dict(id=pid,tier=tier,name=name,kind='assembly' if len(ps)>1 else 'part',max=weight,
            parts=[str(n) for n in range(1,len(ps)+1)],part_count=len(ps),reference=f'参考答案/第{pid}题.json',legacy_id=oldmap[i-1]['old'] if i<=15 else None))
        audit.append(dict(problem=pid,name=name,tier=tier,reason=reason,sheet_count=len(spec['sheets']),
            parts=[dict(no=str(n),name=p.title,features=len(p.features),dimensions=len(p.measures),
                feature_coverage=[dict(index=k,name=f['name'],witnesses=sum(k in m['covers_features'] for m in p.measures)) for k,f in enumerate(p.features,1)]) for n,p in enumerate(ps,1)]))
    cfg=json.loads((HERE/'references.json').read_text(encoding='utf-8'));cfg['records']=records;cfg['full_credit_f']=.99
    cfg['schema_version']=4
    cfg['wide_tolerance_mm']=2.0;cfg['strict_f_weight']=.8
    b.save(HERE/'references.json',cfg);b.save(HERE/'尺寸覆盖审计.json',audit)
    for r,a in zip(records,audit):print(r['id'],r['name'],r['max'],r['part_count'],'件',a['sheet_count'],'张',sum(len(p['features']) for p in json.loads((HERE/r['reference']).read_text(encoding='utf-8'))['parts']),'特征')

if __name__=='__main__':build()
