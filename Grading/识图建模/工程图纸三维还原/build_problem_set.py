"""十五题第二轮加难版的参数源与尺寸见证。

仅供出题端。每个特征同时登记尺寸见证，独立导出建模描述与出图规格；
公开JSON只经make_drawing.public_sheet的白名单导出。
"""
import argparse
import json
import math
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def fmt(v):
    return f'{v:.6f}'.rstrip('0').rstrip('.') if isinstance(v, float) else str(v)


class Part:
    def __init__(self, title, position=None, rotate=None):
        self.title, self.features, self.measures = title, [], []
        self.position = position
        self.rotate = rotate
        self.special_views = []
        self.coordinates = {}

    def dimension(self, view, at, text, values, category='尺寸组合', angle=45):
        self.measures.append(dict(view=view, type='leader', at=at, text=text, value=values,
                                  category=category, angle=angle, source_feature=len(self.features),
                                  covers_features=[len(self.features)]))

    def coord(self, axis, value, point):
        if abs(value)<1e-8: return
        key=(axis,round(value,6))
        if key in self.coordinates:
            m=self.coordinates[key]
            if len(self.features) not in m['covers_features']:m['covers_features'].append(len(self.features))
            return
        x,y,z=point
        view='俯视图' if axis=='Y' else '主视图'
        at=[x,y] if view=='俯视图' else [x,z]
        self.dimension(view,at,[fmt(value)],value,'待转换线性尺寸')
        m=self.measures[-1]
        m['_axis']=axis
        m['_point']=point
        self.coordinates[key]=m

    def chain_dimensions(self):
        """从基准向两侧连接相邻轮廓/中心层级，图上给界线；公开数据没有端点。"""
        for axis in 'XYZ':
            entries={k[1]:v for k,v in self.coordinates.items() if k[0]==axis}
            for sign in (1,-1):
                previous=0
                previous_point=[0,0,0]
                for value in sorted((v for v in entries if v*sign>0),key=abs):
                    m=entries[value]
                    point=m['_point']
                    at=lambda p:[p[0],p[1]] if axis=='Y' else [p[0],p[2]]
                    m.update(type='linear', **{'from':at(previous_point),'to':at(point)},
                        dir='h' if axis=='X' else 'v', snap=True,
                        text=fmt(abs(value-previous)),value=round(abs(value-previous),6),category='链式或相对定位尺寸')
                    m.pop('at',None)
                    m.pop('_axis',None); m.pop('_point',None)
                    previous,previous_point=value,point

    def finish(self, kind, points, amount, view, at, scope):
        self.features.append(dict(type=kind,name=scope,edges=points,
            **{('radius' if kind=='fillet' else 'distance'):amount}))
        self.dimension(view,at,[(('R' if kind=='fillet' else 'C')+fmt(amount))+' '+scope],amount,'倒圆半径' if kind=='fillet' else '45度等距倒角')
        return self

    def datum(self, point):
        for axis,val in zip('XYZ',point):
            self.coord(axis,val,point)

    def block(self, name, x0, y0, z0, x1, y1, z1, cut=False, view='俯视图', open_side=None):
        self.features.append(dict(type='extrude', name=name, op='cut' if cut else 'add', plane='XY',
                                  loops=[dict(rect=[x0,y0,x1,y1])], depth=[z0,z1]))
        if open_side=='横向贯通':
            self.coord('Y',y0,[0,y0,z0])
            self.coord('Y',y1,[0,y1,z0])
            self.coord('Z',z0,[0,y0,z0])
            return self
        if open_side=='X-':
            self.coord('Y',y0,[x1,y0,z0])
            self.coord('Z',z0,[x1,y0,z0])
        else:
            self.datum([x0,y0,z0])
        self.datum([x1,y1,z1])
        if open_side=='X-':
            self.coordinates[('X',round(x1,6))]['text']=[f'X={fmt(x1)}（缺口向左切通外缘）']
        return self

    def poly(self, name, points, y0, y1, cut=False):
        self.features.append(dict(type='extrude', name=name, op='cut' if cut else 'add', plane='XZ',
                                  loops=[dict(path=points)], depth=[-y1,-y0]))
        self.coord('Y',y0,[points[0][0],y0,points[0][1]])
        self.coord('Y',y1,[points[-1][0],y1,points[-1][1]])
        # 分轴排序，尺寸目录不存在有序角点的配对信息；对应关系只能看PNG。
        for x in sorted(set(q[0] for q in points)):
            z=next(q[1] for q in points if q[0]==x)
            self.coord('X',x,[x,y0,z])
        for z in sorted(set(q[1] for q in points)):
            x=next(q[0] for q in points if q[1]==z)
            self.coord('Z',z,[x,y0,z])
        return self

    def cyl(self, name, axis, a, b, c1, c2, d, cut=False):
        plane = {'X':'YZ','Y':'XZ','Z':'XY'}[axis]
        depth = [-b,-a] if axis == 'Y' else [a,b]
        self.features.append(dict(type='extrude', name=name, op='cut' if cut else 'add', plane=plane,
                                  loops=[dict(circle=[c1,c2], d=d)], depth=depth))
        view = {'X':'左视图','Y':'主视图','Z':'俯视图'}[axis]
        at = [-c1,c2] if axis == 'X' else [c1,c2]
        axes = {'X':('Y','Z'),'Y':('X','Z'),'Z':('X','Y')}[axis]
        pa={'X':[a,c1,c2],'Y':[c1,a,c2],'Z':[c1,c2,a]}[axis]
        pb={'X':[b,c1,c2],'Y':[c1,b,c2],'Z':[c1,c2,b]}[axis]
        self.datum(pa)
        self.datum(pb)
        self.dimension(view, at, [f'Φ{fmt(d)}'],d, '孔径' if cut else '直径')
        return self

    def slant(self, name, center, d, depth, angle=45, azimuth=0):
        t, a = math.radians(angle), math.radians(azimuth)
        normal = [math.sin(t)*math.cos(a), math.sin(t)*math.sin(a), math.cos(t)]
        xd = [math.cos(t)*math.cos(a), math.cos(t)*math.sin(a), -math.sin(t)]
        self.features.append(dict(type='hole', name=name, plane=dict(origin=center,normal=normal,x_dir=xd),
                                  at=[0,0], d=d, depth=depth))
        self.datum(center)
        self.dimension('主视图', [center[0],center[2]], [f'Φ{fmt(d)} 斜孔'],d,'孔径')
        self.dimension('主视图', [center[0],center[2]], [f'深{fmt(depth)}'],depth,'孔深')
        label = f'斜视{len(self.special_views)+1}'
        self.special_views.append(dict(type='auxiliary', direction=[-x for x in normal],
            up=[0,0,1], label=label, name=label, hidden=True,
            parent='主视图',arrow_at=[center[0],center[2]]))
        w=np.array(normal)
        v=np.array([0.,0.,1.])-w*w[2]
        v/=np.linalg.norm(v)
        u=np.cross(v,w)
        at=[float(np.dot(center,u)),float(np.dot(center,v))]
        self.dimension(label, at,[f'倾角{fmt(angle)}°'],angle,'角度')
        self.dimension(label, at,[f'方位{fmt(azimuth)}°'],azimuth,'角度')
        return self

    def bolt(self, name, xs, ys, z0, z1, d, cbore=None):
        # 每个孔单独登记位置；不让对称/等距成为隐含猜测。
        for ix,x in enumerate(xs):
            for iy,y in enumerate(ys):
                self.cyl(f'{name}{ix*len(ys)+iy+1}', 'Z', z0,z1,x,y,d,True)
                if cbore:
                    self.cyl('沉孔', 'Z', z1-cbore[1],z1,x,y,cbore[0],True)
        return self

    def desc(self, no):
        out = dict(name=str(no),title=self.title,features=self.features)
        if self.position is not None:
            out['placement'] = dict(translate=self.position)
            if self.rotate:
                out['placement']['rotate'] = self.rotate
        return out


def valve_simple():
    p = Part('双腔斜顶分流阀壳')
    p.poly('阀壳外廓', [[0,0],[132,0],[132,42],[96,78],[0,78]],0,86)
    p.block('安装法兰',-12,-10,0,144,96,12)
    p.block('左工作腔',10,12,12,56,74,68,True)
    p.block('右工作腔',64,12,12,112,74,48,True)
    p.cyl('隔板连通孔','X',56,64,43,34,18,True)
    p.cyl('前侧进油孔','Y',0,12,32,38,22,True)
    p.cyl('后侧回油孔','Y',74,86,84,30,18,True)
    p.cyl('前口锪台','Y',-6,0,32,38,34)
    p.cyl('进油通孔','Y',-6,12,32,38,22,True)
    p.slant('斜顶测压孔',[114,43,60],12,42)
    p.block('底部排放槽',22,36,0,42,50,12,True)
    p.cyl('顶盖螺孔左','Z',62,78,6,20,5,True)
    p.cyl('顶盖螺孔右','Z',62,78,6,66,5,True)
    p.bolt('底脚通孔',[-6,138],[-4,90],0,12,7)
    return p


def bearing_simple():
    p = Part('双轴错层回油支承座')
    p.block('地脚板',0,0,0,160,96,14)
    p.poly('加强桥',[[18,14],[142,14],[126,30],[34,30]],20,76)
    p.cyl('左支承凸台','X',12,48,48,60,62)
    p.cyl('右支承凸台','X',104,148,48,70,70)
    p.block('左支承颈',12,27,14,48,69,60)
    p.block('右支承颈',104,24,14,148,72,70)
    p.cyl('左轴承孔','X',12,48,48,60,32,True)
    p.cyl('左端定位沉台','X',12,20,48,60,42,True)
    p.cyl('右轴承孔','X',104,148,48,70,38,True)
    p.cyl('右端定位沉台','X',138,148,48,70,50,True)
    p.block('回油槽',35,42,18,124,54,26,True)
    p.cyl('左竖油孔','Z',18,60,30,48,8,True)
    p.cyl('右竖油孔','Z',18,70,124,48,8,True)
    p.cyl('侧面泄油孔','Y',0,48,80,22,10,True)
    p.poly('后侧三角肋',[[48,14],[104,14],[104,48]],68,76)
    p.bolt('沉头安装孔',[7,153],[9,87],0,14,8,cbore=(13,5))
    return p


def cover_simple():
    p = Part('偏心双级迷宫泵盖')
    p.cyl('大法兰','Z',0,14,0,0,144)
    p.finish('chamfer',[[0,72,0]],1,'俯视图',[0,72],'大法兰下外圆棱')
    p.cyl('偏心定位颈','Z',14,38,12,0,90)
    p.cyl('端面凸台','Z',38,52,12,0,68)
    p.cyl('主轴通孔','Z',0,52,12,0,30,True)
    p.cyl('下端密封腔','Z',0,8,12,0,74,True)
    p.cyl('上端轴承腔','Z',30,52,12,0,50,True)
    p.cyl('环槽外径','Z',20,24,12,0,66,True)
    p.cyl('环槽内芯','Z',20,24,12,0,58)
    p.cyl('内芯复通','Z',0,52,12,0,30,True)
    p.block('定位扁位',-80,-6,0,-62,6,14,True,open_side='X-')
    p.cyl('径向回油孔','Y',-45,0,12,22,8,True)
    p.cyl('竖向回油孔','Z',8,22,12,-26,8,True)
    p.cyl('偏置检修孔','Z',0,14,-40,0,12,True)
    p.bolt('法兰孔',[-42,42],[-42,42],0,14,9)
    p.block('防转键槽',25,-4,0,30,4,30,True)
    p.slant('斜向润滑孔',[40,-8,52],6,28,30,0)
    p.cyl('径向测压孔','X',-33,12,0,18,6,True)
    p.block('侧定位耳',-68,30,0,-54,50,14)
    p.cyl('定位耳销孔','Z',0,14,-62,40,6,True)
    # 同心圆密集区用指向圆周的外置直径标注，避免圆弧穿过大字号。
    for m in p.measures[:32]:
        if m['view']=='俯视图' and m['category'] in ('孔径','直径'):
            m.update(type='diameter',center=m.pop('at'),d=m['value'],text=m['text'][0],outside=True,avoid_box=True)
    return p


def mixing():
    p = Part('双层交汇混流阀箱')
    p.poly('斜肩箱体',[[0,0],[160,0],[160,48],[116,92],[0,92]],0,110)
    p.block('底法兰',-12,-12,0,172,122,14)
    p.block('左上腔',12,14,38,68,96,82,True)
    p.block('右下腔',78,14,14,140,96,46,True)
    p.block('上腔导流隔板',18,47,38,62,63,82)
    p.cyl('隔墙下孔','X',68,78,36,42,16,True)
    p.cyl('隔墙上孔','X',68,116,78,62,14,True)
    p.cyl('前口','Y',0,14,40,60,26,True)
    p.cyl('后口','Y',96,110,106,30,24,True)
    p.cyl('底层横孔','X',0,160,55,24,14,True)
    p.cyl('竖接孔','Z',24,60,40,55,10,True)
    p.cyl('右端沉孔','X',148,160,55,24,24,True)
    p.slant('斜肩流道',[138,55,70],16,62)
    p.slant('异面检测孔',[116,22,92],8,38,30,90)
    p.block('外侧加强台',-6,28,26,0,82,74)
    p.cyl('左台接管','X',-14,-6,55,50,34)
    p.cyl('接管通孔','X',-14,12,55,50,20,True)
    p.bolt('地脚孔',[-6,166],[-6,116],0,14,8)
    p.cyl('顶面盲孔1','Z',76,92,8,18,5,True)
    p.cyl('顶面盲孔2','Z',76,92,8,92,5,True)
    return p


def baffle():
    p = Part('交错隔板双层润滑箱')
    p.block('箱体外廓',0,0,0,174,118,96)
    p.block('底部安装板',-12,-12,0,186,130,12)
    p.block('左腔',10,10,12,54,108,86,True)
    p.block('中腔',62,10,12,110,108,86,True)
    p.block('右腔',118,10,12,164,108,86,True)
    p.block('左隔板上缺口',54,10,66,62,52,86,True)
    p.block('右隔板下窗口',110,66,12,118,100,34,True)
    p.block('中腔横隔板',62,10,44,110,108,52)
    p.cyl('中板回流孔','Z',44,52,86,32,18,True)
    p.cyl('左隔板圆孔','X',54,62,78,30,20,True)
    p.cyl('右隔板圆孔','X',110,118,32,70,16,True)
    p.cyl('进油口','Y',0,10,30,64,24,True)
    p.cyl('出油口','Y',108,118,142,28,24,True)
    p.cyl('底排污孔','Z',0,12,140,78,12,True)
    p.cyl('检修沉孔','Z',86,96,86,78,30,True)
    p.cyl('检修喉口','Z',44,96,86,78,18,True)
    p.block('前面腰槽',68,0,62,104,10,74,True)
    p.poly('后侧撑肋',[[54,12],[118,12],[118,40]],118,126)
    p.bolt('安装通孔',[-6,180],[-6,124],0,12,8)
    p.cyl('盖板螺孔1','Z',80,96,5,30,5,True)
    p.cyl('盖板螺孔2','Z',80,96,169,88,5,True)
    return p


def control():
    p = Part('双斜接口差压控制块')
    p.poly('双斜面外廓',[[0,0],[156,0],[156,42],[118,80],[32,80],[0,48]],0,104)
    p.block('安装底脚',-10,-10,0,166,114,12)
    p.cyl('横向主孔','X',0,156,52,30,28,True)
    p.cyl('左端阀套沉孔','X',0,22,52,30,40,True)
    p.cyl('右端阀套沉孔','X',130,156,52,30,36,True)
    p.cyl('上层配油孔','Y',0,104,76,60,18,True)
    p.cyl('前口锪平','Y',0,8,76,60,30,True)
    p.cyl('上层竖孔','Z',30,80,76,52,12,True)
    p.slant('右斜口',[137,52,61],16,50,45,0)
    p.slant('左斜口',[16,52,64],14,48,45,180)
    p.cyl('侧检测孔','Y',0,52,40,30,8,True)
    p.cyl('后检测孔','Y',52,104,112,30,10,True)
    p.block('后侧仪表台',52,104,44,100,112,76)
    p.cyl('仪表接口','Y',104,112,76,60,18,True)
    p.cyl('仪表沉孔','Y',108,112,76,60,26,True)
    p.block('底部键槽',58,32,0,98,72,5,True)
    p.bolt('底脚孔',[-5,161],[-5,109],0,12,7)
    p.cyl('顶面螺孔1','Z',64,80,48,22,6,True)
    p.cyl('顶面螺孔2','Z',64,80,104,82,6,True)
    return p


def pumpbase():
    p = Part('偏轴阶梯双腔泵座')
    p.block('安装法兰',0,0,0,180,124,14)
    p.poly('阶梯上壳',[[16,14],[164,14],[164,58],[126,96],[56,96],[16,56]],12,112)
    p.cyl('大支承颈','Y',0,30,82,58,76)
    p.cyl('后偏置颈','Y',94,124,118,50,58)
    p.block('第一内腔',30,30,20,90,94,84,True)
    p.block('第二内腔',100,30,20,150,94,54,True)
    p.cyl('前轴承孔','Y',0,30,82,58,42,True)
    p.cyl('前油封沉台','Y',0,8,82,58,54,True)
    p.cyl('后轴承孔','Y',94,124,118,50,30,True)
    p.cyl('后端挡圈槽','Y',116,120,118,50,38,True)
    p.cyl('隔板偏心孔','X',90,100,62,46,24,True)
    p.cyl('底部回油孔','X',16,164,62,24,12,True)
    p.cyl('竖向油道','Z',24,82,96,62,8,True)
    p.slant('斜面检修孔',[145,62,77],22,46)
    p.block('前下卸载窗',34,12,20,58,30,32,True)
    p.block('后下卸载窗',132,94,20,150,112,34,True)
    p.block('内腔导流肋',30,56,20,62,64,34)
    p.bolt('地脚孔',[8,172],[7,117],0,14,9,cbore=(15,5))
    return p


def manifold():
    p = Part('跨腔三向斜流道歧管')
    p.poly('分配体',[[0,0],[174,0],[174,44],[132,86],[0,86]],0,116)
    p.block('底座法兰',-10,-10,0,184,126,12)
    p.cyl('上层纵孔','Y',0,116,44,62,22,True)
    p.cyl('下层纵孔','Y',0,116,118,26,26,True)
    p.cyl('中层横孔','X',0,174,58,44,18,True)
    p.cyl('竖向汇流孔','Z',26,86,80,58,16,True)
    p.cyl('顶口沉台','Z',76,86,80,58,30,True)
    p.cyl('前上沉台','Y',0,12,44,62,34,True)
    p.cyl('后下沉台','Y',104,116,118,26,40,True)
    p.slant('右斜流道',[153,58,65],14,64)
    p.slant('空间斜检测孔',[84,30,86],10,40,30,90)
    p.block('旁通方腔',8,40,12,30,76,34,True)
    p.cyl('旁通连孔','Y',0,40,20,24,12,True)
    p.cyl('方腔上连孔','Z',24,62,20,58,10,True)
    p.block('侧口加强板',174,30,20,182,86,66)
    p.cyl('加强板通孔','X',174,182,58,44,18,True)
    p.cyl('加强板沉口','X',178,182,58,44,28,True)
    p.block('后侧定位缺口',66,104,0,94,116,12,True)
    p.bolt('地脚孔',[-5,179],[-5,121],0,12,8)
    p.cyl('前面仪表盲孔','Y',0,18,80,70,8,True)
    p.cyl('后面仪表盲孔','Y',98,116,80,70,8,True)
    return p


def servo():
    p = Part('三腔分层伺服分配箱')
    p.poly('箱体外廓',[[0,0],[198,0],[198,54],[154,98],[0,98]],0,136)
    p.block('安装底板',-12,-12,0,210,148,14)
    p.block('左腔',12,12,14,64,124,88,True)
    p.block('中腔',74,12,14,128,124,88,True)
    p.block('右下腔',138,12,14,182,124,50,True)
    p.block('左腔水平隔板',12,12,42,64,124,50)
    p.block('中腔纵向挡板',74,62,14,128,72,88)
    p.block('左腔隔板窗口',24,44,42,52,78,50,True)
    p.cyl('左中上连孔','X',64,74,36,70,22,True)
    p.cyl('左中下连孔','X',64,74,98,28,18,True)
    p.cyl('中右下连孔','X',128,138,34,32,20,True)
    p.cyl('中挡板连孔','Y',62,72,100,62,16,True)
    p.cyl('左前入口','Y',0,12,38,72,28,True)
    p.cyl('中后入口','Y',124,136,104,30,26,True)
    p.cyl('右前出口','Y',0,12,160,32,30,True)
    p.cyl('底横油道','X',0,198,102,24,12,True)
    p.cyl('左隔板回油','Z',24,70,38,102,8,True)
    p.cyl('右竖测压孔','Z',24,60,160,102,8,True)
    p.slant('主斜流道',[176,68,76],18,72)
    p.slant('偏置空间测压孔',[110,32,98],10,44,30,90)
    p.block('左侧接口台',-10,30,54,0,106,88)
    p.cyl('接口台通孔','X',-10,12,68,70,22,True)
    p.cyl('接口台沉孔','X',-10,-4,68,70,32,True)
    p.block('底面定位槽',80,44,0,120,92,6,True)
    p.bolt('底脚孔',[-6,204],[-6,142],0,14,9)
    p.bolt('顶面定位孔',[6],[24,112],80,98,6)
    return p


def transmission():
    p = Part('双轴错层传动箱体')
    p.block('底座',0,0,0,214,144,16)
    p.poly('阶梯铸壳',[[14,16],[200,16],[200,68],[152,116],[58,116],[14,72]],12,132)
    p.block('左齿轮腔',26,24,24,94,120,100,True)
    p.block('右齿轮腔',104,24,24,188,120,76,True)
    p.block('左腔分层隔板',26,24,54,94,120,62)
    p.block('隔板方窗',48,50,54,78,90,62,True)
    p.cyl('左轴前凸缘','Y',0,24,62,78,78)
    p.cyl('左轴后凸缘','Y',120,144,62,78,70)
    p.cyl('右轴前凸缘','Y',0,24,144,52,68)
    p.cyl('右轴后凸缘','Y',120,144,144,52,74)
    p.cyl('左轴通孔','Y',0,144,62,78,38,True)
    p.cyl('左前轴承沉孔','Y',0,12,62,78,52,True)
    p.cyl('左后轴承沉孔','Y',132,144,62,78,48,True)
    p.cyl('右轴通孔','Y',0,144,144,52,32,True)
    p.cyl('右前轴承沉孔','Y',0,10,144,52,44,True)
    p.cyl('右后轴承沉孔','Y',130,144,144,52,50,True)
    p.cyl('隔墙啮合窗口','X',94,104,72,56,42,True)
    p.block('底部集油槽',30,54,16,178,90,24,True)
    p.cyl('隔板回油孔','Z',24,62,38,104,10,True)
    p.cyl('侧放油孔','X',0,50,72,20,10,True)
    p.slant('斜顶检修孔',[176,72,92],30,58)
    p.slant('斜向润滑孔',[110,34,116],10,62,25,90)
    p.block('后侧支撑肋',94,132,16,104,142,66)
    p.block('前侧定位槽',92,0,0,122,12,8,True)
    p.bolt('底座螺孔',[7,207],[7,137],0,16,10,cbore=(16,6))
    return p


def wedge_assembly():
    # 八件：导柱、横梁、滑动压头、横向驱动楔、止推块、调节轴、底座。
    base=Part('夹具底座',[0,0,0]).block('基板',0,0,0,190,110,16)
    base.block('下导向槽',55,30,8,135,80,16,True)
    base.bolt('地脚沉孔',[10,180],[10,100],0,16,9,cbore=(15,6))
    base.cyl('左导柱座','Z',6,16,35,25,18,True).cyl('右导柱座','Z',6,16,145,85,18,True)
    guide1=Part('左阶梯导柱',[35,25,6]).cyl('下定位段','Z',0,10,0,0,18).cyl('导向段','Z',10,94,0,0,16)
    guide1.cyl('上锁紧段','Z',94,110,0,0,12).cyl('轴端盲孔','Z',96,110,0,0,5,True)
    guide2=Part('右阶梯导柱',[145,85,6]).cyl('下定位段','Z',0,10,0,0,18).cyl('导向段','Z',10,94,0,0,16)
    guide2.cyl('上锁紧段','Z',94,110,0,0,12).cyl('轴端盲孔','Z',96,110,0,0,5,True)
    beam=Part('上横梁',[15,15,100]).block('横梁',0,0,0,150,90,16)
    beam.cyl('左柱孔','Z',0,16,20,10,12,True).cyl('右柱孔','Z',0,16,130,70,12,True)
    beam.block('中央避空',55,24,0,95,56,8,True)
    head=Part('双孔滑动压头',[20,15,56]).block('压头',0,0,0,140,80,24)
    head.cyl('左导孔','Z',0,24,15,10,16,True).cyl('右导孔','Z',0,24,125,70,16,True)
    head.block('压脚',48,24,-12,92,56,0)
    head.poly('斜槽',[[50,12],[100,22],[100,24],[50,24]],24,56,True)
    head.cyl('推轴避让孔','X',86,140,40,21,10,True)
    wedge=Part('驱动斜楔',[70,39,68]).poly('楔体',[[0,0],[50,10],[50,14],[0,14]],0,32)
    wedge.cyl('推轴连接孔','X',36,50,16,9,8,True)
    stop=Part('右止推座',[164,31,16]).block('止推座',0,0,0,16,48,68)
    stop.cyl('调节轴孔','X',0,16,24,61,10,True)
    stop.cyl('轴肩沉孔','X',10,16,24,61,18,True)
    shaft=Part('调节推轴',[106,55,77],rotate=[dict(axis='Y',angle=90)]).cyl('推杆','Z',0,74,0,0,8)
    shaft.cyl('止推轴肩','Z',68,74,0,0,18).cyl('手柄轴','Z',74,86,0,0,12)
    shaft.cyl('横销孔','Y',-6,6,0,80,4,True)
    return [base,guide1,guide2,beam,head,wedge,stop,shaft]


def eccentric_assembly():
    base=Part('滑阀驱动底座',[0,0,0]).block('底板',0,0,0,180,120,16)
    base.block('滑阀导轨',90,36,16,170,84,32)
    base.block('滑阀导槽',98,44,24,170,76,32,True)
    base.bolt('地脚孔',[10,170],[10,110],0,16,9)
    # 顶边附近两处尺寸引线朝外放置，给字形顶部留出明确空隙。
    for measure in base.measures:
        if measure['view']=='俯视图' and measure['at']==[10,110]:
            measure.update(angle=180,length=16,fixed=True)
    left=Part('前轴承架',[24,16,16]).poly('支架',[[0,0],[52,0],[52,42],[42,56],[10,56],[0,42]],0,18)
    left.cyl('轴承座孔','Y',0,18,26,38,26,True).cyl('定位沉台','Y',0,6,26,38,34,True)
    rear=Part('后轴承架',[24,86,16]).poly('支架',[[0,0],[52,0],[52,42],[42,56],[10,56],[0,42]],0,18)
    rear.cyl('轴承座孔','Y',0,18,26,38,26,True).cyl('定位沉台','Y',12,18,26,38,34,True)
    bush1=Part('前法兰轴套',[50,16,54]).cyl('套筒','Y',0,18,0,0,26).cyl('法兰','Y',0,6,0,0,34)
    bush1.cyl('轴孔','Y',0,18,0,0,16,True).cyl('润滑孔','Z',0,13,0,10,4,True)
    bush2=Part('后法兰轴套',[50,86,54]).cyl('套筒','Y',0,18,0,0,26).cyl('法兰','Y',12,18,0,0,34)
    bush2.cyl('轴孔','Y',0,18,0,0,16,True).cyl('润滑孔','Z',0,13,0,8,4,True)
    shaft=Part('偏心轴',[50,10,54]).cyl('主轴','Y',0,100,0,0,16)
    shaft.cyl('偏心轮','Y',32,68,10,0,44)
    shaft.cyl('前挡肩','Y',24,30,0,0,24).cyl('后挡肩','Y',70,76,0,0,24)
    shaft.block('端部扁位',-12,90,5,12,100,12,True,open_side='横向贯通')
    for at,text,value in [([0,95],'Y向扁位长10',10),([10,50],'Y向偏心轮厚36',36),([0,27],'Y向前挡肩厚6',6)]:
        shaft.dimension('俯视图',at,[text],value,'线性（参考）')
        shaft.measures[-1]['reference']=True
    fork=Part('槽形从动框',[30,40,26]).block('外框',0,0,0,60,40,56)
    fork.block('偏心轮滑窗',8,0,6,52,40,50,True)
    fork.block('推杆连接耳',60,12,20,102,28,30)
    fork.cyl('销孔','Y',12,28,93,25,8,True)
    valve=Part('滑阀阀芯',[112,44,24]).block('阀芯',0,0,0,54,32,8)
    valve.block('前挡肩',0,0,8,10,32,22).block('连接叉左',0,0,22,20,8,34)
    valve.block('连接叉右',0,24,22,20,32,34)
    valve.cyl('连接销孔','Y',0,32,11,27,8,True)
    valve.block('下流槽',22,6,0,42,26,4,True)
    pin=Part('连接销',[123,40,51]).cyl('销体','Y',0,40,0,0,8).cyl('挡头','Y',0,4,0,0,12)
    cover=Part('导轨压板',[128,36,32]).block('压板',0,0,0,42,48,8)
    cover.block('中间导向缺口',0,8,0,42,40,4,True)
    cover.cyl('固定孔左','Z',0,8,32,4,5,True).cyl('固定孔右','Z',0,8,32,44,5,True)
    return [base,left,rear,bush1,bush2,shaft,fork,valve,pin,cover]


def volute_casting():
    p=Part('偏置双出口泵体铸件')
    p.block('地脚法兰',0,0,0,176,124,14)
    p.finish('fillet',[[0,0,7],[176,0,7],[176,124,7],[0,124,7]],5,'俯视图',[0,0],'地脚四竖棱')
    p.poly('斜背泵壳',[[18,14],[156,14],[156,68],[124,106],[46,106],[18,68]],16,108)
    p.cyl('主泵腔','Y',28,96,86,62,66,True)
    p.cyl('前轴承凸缘','Y',2,16,86,62,82)
    p.finish('fillet',[[86,16,103]],3,'主视图',[86,103],'前凸缘根部过渡')
    p.cyl('前轴承孔','Y',2,38,86,62,32,True)
    p.cyl('轴承沉台','Y',2,10,86,62,46,True)
    p.cyl('后端检修口','Y',96,116,86,62,54,True)
    p.cyl('后端凸缘','Y',108,120,86,62,76)
    p.cyl('后端复通','Y',96,120,86,62,54,True)
    p.cyl('右出水支管','X',132,186,62,68,46)
    p.cyl('右出口法兰','X',180,192,62,68,68)
    p.cyl('右流道','X',98,192,62,68,28,True)
    p.cyl('顶端旁路台','Z',92,120,68,54,38)
    p.cyl('顶端旁路孔','Z',62,120,68,54,18,True)
    p.slant('前上斜测压孔',[54,16,90],8,52,60,90)
    p.slant('后上回油斜孔',[120,108,92],10,50,55,270)
    p.poly('前左斜撑肋',[[24,14],[46,14],[46,62]],8,16)
    p.poly('后右斜撑肋',[[130,14],[156,14],[130,72]],108,116)
    p.block('腔底回油槽',64,38,25,104,84,33,True)
    p.cyl('底排水孔','Z',0,34,86,62,10,True)
    p.bolt('地脚孔',[10,166],[10,114],0,14,9,cbore=(16,5))
    p.finish('chamfer',[[86,2,85]],1.5,'主视图',[86,85],'前轴承沉孔口整圈')
    p.detail=[86,78]
    return p


def angled_valve():
    p=Part('双斜座多腔阀体铸件')
    p.block('基座',0,0,0,168,120,16)
    p.finish('fillet',[[0,0,8],[168,0,8],[168,120,8],[0,120,8]],6,'俯视图',[0,0],'底座四竖棱')
    p.poly('斜顶阀体',[[12,16],[156,16],[156,76],[112,110],[44,110],[12,78]],12,108)
    p.block('前腔',24,24,28,72,96,88,True)
    p.block('后腔',82,24,28,140,96,74,True)
    p.cyl('隔墙节流孔','X',72,82,60,48,20,True)
    p.cyl('左横向凸缘','X',-12,12,60,54,64)
    p.cyl('左进水孔','X',-12,48,60,54,30,True)
    p.cyl('右横向凸缘','X',156,180,60,54,72)
    p.cyl('右出水孔','X',124,180,60,54,34,True)
    p.slant('左斜阀座孔',[30,60,96],24,64,40,0)
    p.slant('右斜阀座孔',[138,60,90],22,58,50,180)
    p.cyl('前测压凸台','Y',0,12,60,64,30)
    p.cyl('前测压孔','Y',0,24,60,64,10,True)
    p.cyl('后测压凸台','Y',108,122,112,48,32)
    p.cyl('后测压孔','Y',96,122,112,48,12,True)
    p.block('跨腔上桥',60,38,88,100,82,98)
    p.cyl('桥顶盲孔','Z',90,110,80,60,8,True)
    p.poly('前斜肋',[[28,16],[56,16],[56,52]],4,12)
    p.poly('后斜肋',[[116,16],[144,16],[116,60]],108,116)
    p.cyl('左竖回流孔','Z',0,34,52,72,8,True)
    p.cyl('右竖回流孔','Z',0,34,112,48,8,True)
    p.bolt('安装孔',[10,158],[10,110],0,16,8)
    p.finish('chamfer',[[-12,60,69]],2,'左视图',[-60,69],'左进水孔口整圈')
    p.detail=[30,96]
    return p


def fork_housing():
    p=Part('斜耳叉架减速箱体')
    p.block('地脚底板',0,0,0,188,132,16)
    p.finish('fillet',[[0,0,8],[188,0,8],[188,132,8],[0,132,8]],6,'俯视图',[0,0],'底板四竖棱')
    p.poly('箱壳斜壁',[[16,16],[172,16],[164,96],[142,116],[50,116],[24,94]],18,114)
    p.block('主齿轮腔',34,30,30,150,102,92,True)
    p.block('上层内腔',58,42,92,132,90,106,True)
    p.cyl('低速前凸缘','Y',6,18,66,64,66)
    p.cyl('低速后凸缘','Y',114,126,66,64,66)
    p.cyl('低速轴孔','Y',6,126,66,64,30,True)
    p.cyl('前轴承沉孔','Y',6,14,66,64,44,True)
    p.cyl('后轴承沉孔','Y',118,126,66,64,44,True)
    p.cyl('高速右凸缘','X',160,186,66,82,54)
    p.cyl('高速轴孔','X',120,186,66,82,24,True)
    p.cyl('右轴承沉孔','X',178,186,66,82,36,True)
    p.poly('左叉耳',[[32,100],[60,108],[48,150],[26,142]],24,40)
    p.poly('右叉耳',[[32,100],[60,108],[48,150],[26,142]],92,108)
    p.cyl('叉销孔','Y',24,108,40,132,16,True)
    p.poly('后部三角肋',[[108,16],[160,16],[140,94]],114,124)
    p.poly('前部三角肋',[[108,16],[160,16],[140,94]],8,18)
    p.slant('空间斜注油孔',[140,98,116],12,76,35,225)
    p.slant('斜排屑孔',[164,52,38],10,50,75,180)
    p.block('下层导油槽',54,40,24,144,94,32,True)
    p.cyl('底排孔','Z',0,32,120,66,10,True)
    p.bolt('底脚锪孔',[10,178],[10,122],0,16,9,cbore=(16,6))
    p.finish('chamfer',[[66,6,86]],1.5,'主视图',[66,86],'低速前沉孔口整圈')
    p.detail=[40,132]
    return p


NAMES = ['双腔斜顶分流阀壳','双轴错层回油支承座','偏心双级迷宫泵盖','双层交汇混流阀箱',
         '交错隔板双层润滑箱','双斜接口差压控制块','偏轴阶梯双腔泵座','跨腔三向斜流道歧管',
         '三腔分层伺服分配箱','双轴错层传动箱体','双导柱楔紧夹具','偏心滑阀驱动总成','偏置双出口泵体铸件','双斜座多腔阀体铸件','斜耳叉架减速箱体']
REASONS = [
    '两个不同高度的封闭内腔、隔板连孔、斜顶钻孔及法兰与侧口；需三个方向剖视合读，已超过旧简单档。',
    '两根独立轴的不同标高支承、前后台阶沉孔、桥体与三角肋、互通回油孔；不能由单一轮廓拉伸得到。',
    '偏心同轴台阶、环形内槽与复合回油孔、扁位和防转键槽；上下端剖视才可区分通孔与内槽。',
    '上下错层内腔和非对称隔墙通孔，横纵竖油路及两个不同方位斜孔交汇。',
    '三腔、两块竖隔板与一块横隔板，错开的窗口与圆孔和检修通道形成分层油路。',
    '相反方向的两处45度接口、不同直径台阶主孔、上层横孔和后侧仪表台交叉。',
    '前后偏轴支承颈、双腔与中隔板、挡圈槽、侧窗及斜检修孔，内外结构相互遮挡。',
    '三方向不同标高的流道、空间斜孔与旁通方腔、沉台和侧加强板的多段连通关系。',
    '三工作腔同时含水平与纵向挡板，非对称多层交汇通道和两个异向斜孔；剖视之间必须追踪连通。',
    '双轴错层轴承沉孔与四个凸缘、分层内腔、啮合窗、回油槽及两个不同倾角孔。',
    '八件夹具：阶梯导柱、带避空横梁、双孔压头、1:5斜楔及转向推轴；需从装配图推断配合与位置。',
    '十件机构：前后支架与轴套、偏心轴、从动框、滑阀、连接销和压板；偏心量与各零件相对位置需跨图联立。',
]


def assembly_dimensions(pid):
    """只标配合基准与安装尺寸；位置由装配关系和零件图联立推出。"""
    if pid=='11':
        return [
            ('俯视图',[35,25],['左导柱座轴心X=35'],35),
            ('俯视图',[35,25],['左导柱座轴心Y=25'],25),
            ('俯视图',[145,85],['右座相对左座：X向距110'],110),
            ('俯视图',[145,85],['右座相对左座：Y向距60'],60),
            ('主视图',[35,16],['序号2、3下定位段完全插入底座孔','轴肩贴底座上表面；导柱轴线竖直'],0),
            ('主视图',[80,44],['压脚底面距底座上表面28','序号5两导孔分别与两导柱同轴'],28),
            ('主视图',[90,100],['横梁下表面距底座上表面84','两柱孔与两导柱上锁紧段同轴'],84),
            ('主视图',[70,68],['斜楔左下理论角与压头斜槽左下角重合','楔体两侧面贴合斜槽侧面'],0),
            ('俯视图',[180,31],['止推座右端面X=180','底面贴底座上表面'],180),
            ('俯视图',[164,31],['止推座前侧面Y=31'],31),
            ('主视图',[174,77],['推轴与止推座孔同轴','推轴轴肩右端面与止推座右端面齐平'],0),
            ('俯视图',[180,55],['推轴自身+Z朝总+X，自身+X朝总−Z','其余零件自身坐标轴与总坐标轴同向'],90),
        ]
    return [
        ('俯视图',[24,16],['前轴承架左端面X=24','前后支架底面贴底座上表面'],24),
        ('俯视图',[24,16],['前轴承架前端面Y=16'],16),
        ('俯视图',[24,104],['后架与前架左端面齐平','前架前端面到后架后端面距离88'],88),
        ('主视图',[50,54],['序号4、5外圆与对应轴承座孔同轴','两法兰分别完全落入相应端面沉台'],0),
        ('俯视图',[50,10],['主轴前端面Y=10；主轴与两轴套同轴','偏心轮轴线位于主轴+X一侧'],10),
        ('主视图',[60,76],['从动框窗口上下及左右理论面与偏心轮相切','框在两轴承架内侧面之间沿Y居中'],0),
        ('主视图',[123,51],['阀芯底面落在导槽底面','连接叉与从动框耳的销孔同轴'],0),
        ('俯视图',[123,44],['连接销与叉、耳销孔同轴','销挡头内侧面贴连接叉前侧面'],0),
        ('俯视图',[170,36],['压板后端面与底座导轨后端面齐平','压板两侧与导轨两侧齐平，底面贴导轨顶面'],0),
        ('主视图',[150,32],['各零件自身坐标轴与装配总坐标轴同向','底座自身坐标系与装配总坐标系重合'],0),
    ]


def spec_for_parts(pid, title, parts):
    sheets=[]
    notes=['技术要求', '单位mm；尺寸由界线或引线指示，不是绝对坐标。',
           '位置由尺寸链、定形与定位尺寸联合推算。',
           '标注R、C须建模；未注锐边保持理论交线。',
           '孔深沿轴线；斜孔从所标入口向体内加工。']
    if len(parts)>1:
        rows=[dict(no=str(i),name=p.title,qty=1,material='钢',note='') for i,p in enumerate(parts,1)]
        dims=[dict(view=v,type='leader',at=at,text=text,value=val,category='装配配合及定位尺寸')
              for v,at,text,val in assembly_dimensions(pid)]
        for k in range(0,len(dims),4):
            sheets.append(dict(paper='A1',scale=[1.5,1.25,1],frame='assembly',title=title,drawing_no=f'JX-{pid}-Z{k//4+1}',
                views=[dict(type='front'),dict(type='top')],dimensions=dims[k:k+4],parts_list=rows,notes=notes,
                balloons=[dict(view='主视图',part=str(i),at=[p.position[0]+3,p.position[2]+3],text=str(i)) for i,p in enumerate(parts,1)]))
    for no,p in enumerate(parts,1):
        for k in range(0,len(p.measures),16):
            dims=[dict(m) for m in p.measures[k:k+16]]
            views=[dict(type='front'),dict(type='top'),dict(type='left')]
            for v in p.special_views:
                if any(d['view']==v['name'] for d in dims):views.append(dict(v))
            if len(parts)==1 and k==0:
                views.append(dict(type='front',free=True,name='A-A',section=dict(label='A',point=[0,parts_section(pid)[1],0],mode='full',parent='俯视图')))
            if len(parts)==1 and k==16:
                views.append(dict(type='left',free=True,name='B-B',section=dict(label='B',point=[parts_section(pid)[0],0,0],mode='full',parent='主视图')))
            if int(pid)>=13 and k==32:
                views.append(dict(type='top',free=True,name='C-C',section=dict(label='C',point=[0,0,44],mode='full',parent='主视图')))
            if int(pid)>=13 and k==48:
                views.append(dict(type='detail',parent='主视图',center=[p.detail[0],p.detail[1]],r=18,label='Ⅰ',name='局部Ⅰ',scale=3))
            sheets.append(dict(paper='A1' if len(parts)==1 else 'A2',scale=[1.5,1.25,1,0.9,0.8] if len(parts)==1 else [2,1.5,1],frame='part',part=str(no),title=p.title,
                drawing_no=f'JX-{pid}-{no:02d}-{k//16+1}',material='HT250' if len(parts)==1 else '钢',views=views,dimensions=dims,notes=notes))
    for index,s in enumerate(sheets,1):s['id']=f'{pid}-{index}'
    return dict(problem=pid,title=title,sheets=sheets)


def parts_section(pid):
    return [(60,43),(30,48),(12,0),(73,55),(86,59),(76,52),(96,62),(80,58),(100,68),(99,72),(0,0),(0,0),(68,54),(72,60),(86,62)][int(pid)-1]


def build_legacy():
    builders=[valve_simple,bearing_simple,cover_simple,mixing,baffle,control,pumpbase,manifold,servo,transmission,wedge_assembly,eccentric_assembly,volute_casting,angled_valve,fork_housing]
    records=[]
    audit=[]
    for i,fn in enumerate(builders,1):
        pid=f'{i:02d}'
        data=fn()
        parts=data if isinstance(data,list) else [data]
        if i<=12 and i!=3:
            base=parts[0]
            candidates=[f for f in base.features if f.get('op')=='add' and f.get('plane')=='XY' and 'rect' in f.get('loops',[{}])[0] and f['depth'][0]==0]
            f=max(candidates,key=lambda f:(f['loops'][0]['rect'][2]-f['loops'][0]['rect'][0])*(f['loops'][0]['rect'][3]-f['loops'][0]['rect'][1])) if candidates else base.features[0]
            # 在最终实体仍保留的底板外角竖棱上选点，使用小半径不改配合。
            if f.get('plane')=='XY' and 'rect' in f['loops'][0]:
                x0,y0,x1,y1=f['loops'][0]['rect']; z0,z1=f['depth']
                base.finish('fillet',[[x0,y0,(z0+z1)/2]],2,'俯视图',[x0,y0],'底板左前外竖棱')
                base.finish('chamfer',[[x0+(x1-x0)/4,y0,z0]],1,'主视图',[x0+(x1-x0)/4,z0],'所指前下直棱')
        for p in parts:p.chain_dimensions()
        desc=dict(problem=pid,parts=[p.desc(n) for n,p in enumerate(parts,1)])
        spec=spec_for_parts(pid,NAMES[i-1],parts)
        save(HERE/'参考答案'/f'第{pid}题.json',desc)
        save(HERE/'出图规格'/f'{pid}.json',spec)
        tier='简单档' if i<=3 else '中档' if i<=8 else '困难档'
        records.append(dict(id=pid,tier=tier,name=NAMES[i-1],kind='part' if len(parts)==1 else 'assembly',
            max=3 if i<=3 else 7 if i<=8 else 8,parts=[str(n) for n in range(1,len(parts)+1)],
            part_count=len(parts),reference=f'参考答案/第{pid}题.json'))
        audit.append(dict(problem=pid,name=NAMES[i-1],tier=tier,reason=REASONS[i-1] if i<=12 else ['偏置主腔、多向法兰、斜撑肋及两处异向斜孔','双倾角阀座与跨腔上桥、分层回路','斜壁箱腔、错轴轴承、双叉耳及空间油孔'][i-13],sheet_count=len(spec['sheets']),
            parts=[dict(no=str(n),name=p.title,features=len(p.features),dimensions=len(p.measures),
                feature_coverage=[dict(index=j,name=f['name'],witnesses=sum(j in m['covers_features'] for m in p.measures)) for j,f in enumerate(p.features,1)]) for n,p in enumerate(parts,1)]))
    cfg=json.loads((HERE/'references.json').read_text(encoding='utf-8-sig'))
    cfg['records']=records
    save(HERE/'references.json',cfg)
    save(HERE/'尺寸覆盖审计.json',audit)
    print(f'已生成15题、{sum(a["sheet_count"] for a in audit)}张出图规格')
    for a in audit:
        print(a['problem'],a['name'],a['sheet_count'],'张',sum(p['features'] for p in a['parts']),'特征')


def build():
    from advanced_parts import build as build_current
    return build_current()


if __name__=='__main__':
    build()
