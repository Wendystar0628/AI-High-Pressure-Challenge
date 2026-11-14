"""公开材料边界与图纸编号契约；防止重新泄露可照抄的参考图线。"""
import json
from pathlib import Path
from PIL import Image
import make_drawing

HERE=Path(__file__).resolve().parent
PUBLIC=make_drawing.PUBLIC


def test_public_drawings_are_dimension_catalogs_without_geometry():
    cfg=json.loads((HERE/'references.json').read_text(encoding='utf-8'))
    assert len(cfg['records'])==25
    for rec in cfg['records']:
        spec=json.loads((HERE/'出图规格'/f'{rec["id"]}.json').read_text(encoding='utf-8'))
        ids=[]
        for sheet in spec['sheets']:
            doc=json.loads((PUBLIC/rec['id']/f'{sheet["id"]}.json').read_text(encoding='utf-8'))
            make_drawing.validate_public(doc)
            assert doc['version']==2
            assert len(doc['views'])>=2
            assert all(isinstance(d['value'],(int,float)) for d in doc['dimensions'])
            assert all(set(d)=={'id','view','type','value','text'} for d in doc['dimensions'])
            assert all(d['type']!='线性坐标尺寸' for d in doc['dimensions'])
            assert all('definition' not in v and 'placement' not in v for v in doc['views'])
            ids.extend(int(d['id'][1:]) for d in doc['dimensions'])
            with Image.open(PUBLIC/rec['id']/f'{sheet["id"]}.png') as img:
                assert 200 <= img.info['dpi'][0] <= 300
                assert img.width>3000 and img.height>2500
        assert sorted(ids)==list(range(1,len(ids)+1))


def test_only_preview_is_public_entry_point():
    assert {p.name for p in (PUBLIC/'工具').glob('*.py')}=={'preview.py'}
    assert (HERE/'compare.py').is_file()
    assert not (PUBLIC/'工具/compare.py').exists()


def test_every_reference_feature_has_dimension_witnesses():
    audit=json.loads((HERE/'尺寸覆盖审计.json').read_text(encoding='utf-8'))
    for row in audit:
        for part in row['parts']:
            assert all(feature['witnesses']>0 for feature in part['feature_coverage'])


def test_no_polyline_pairing_in_public_dimensions():
    for path in PUBLIC.glob('*/*.json'):
        doc=json.loads(path.read_text(encoding='utf-8'))
        assert all(not isinstance(d['value'],(list,dict)) for d in doc['dimensions'])
        assert all('角点' not in d['text'] for d in doc['dimensions'])


def test_authoring_placed_cache_tracks_shape_and_pose():
    from drawkit import model
    mdl=model.build({'parts':[{'name':'1','features':[{'type':'extrude','loops':[{'rect':[0,0,20,10]}],'depth':8}]}]})
    sh={'frame':'assembly'}
    a=make_drawing.sheet_shapes(mdl,sh)[0]['1'];b=make_drawing.sheet_shapes(mdl,sh)[0]['1']
    assert a is b
    mdl.parts[0].placement[0,3]=9
    c=make_drawing.sheet_shapes(mdl,sh)[0]['1']
    assert c is not a and abs(model.shape_bbox(c)[0][0]-9)<1e-5


def test_preview_only_renders_two_isometric_images(tmp_path):
    import subprocess, sys
    answer=tmp_path/'第01题.json'
    answer.write_text(json.dumps({'problem':'01','parts':[{'features':[{'type':'extrude','plane':'XY','loops':[{'rect':[0,0,20,12]}],'depth':8}]}]}),encoding='utf-8')
    out=tmp_path/'preview'
    run=subprocess.run([sys.executable,str(PUBLIC/'工具/preview.py'),str(answer),'--out',str(out)],capture_output=True,text=True,encoding='utf-8',timeout=90)
    assert run.returncode==0,run.stderr
    assert {p.name for p in out.iterdir()}=={'轴测-1.png','轴测-2.png'}
    assert '已画图纸' not in run.stdout
    source=(PUBLIC/'工具/preview.py').read_text(encoding='utf-8')
    assert 'from drawkit import model, shade' in source
    assert '--drawings' not in source


def test_preview_cache_does_not_reuse_geometry_from_another_answer():
    from drawkit import model, sheets, project
    definition=dict(kind='basic', direction=[0,1,0],u=[1,0,0],v=[0,0,1],origin=[0,0,0],parts=['1'],hidden=True,section=None)
    sheet={'frame':'part','views':[{'name':'主视图','definition':definition}]}
    def box(width):
        return model.build({'parts':[{'name':'1','features':[{'type':'extrude','plane':'XY','loops':[{'rect':[0,0,width,10]}],'depth':8}]}]}).parts[0].shape
    a,b=box(20),box(35)
    cache={}
    first=sheets.reproject(sheet,{'1':a},cache=cache)['主视图']
    repeated=sheets.reproject(sheet,{'1':a},cache=cache)['主视图']
    changed=sheets.reproject(sheet,{'1':b},cache=cache)['主视图']
    assert repeated is first
    assert abs(project.geometry_bounds(first)[2]-20)<1e-5
    assert abs(project.geometry_bounds(changed)[2]-35)<1e-5


def test_private_oblique_direction_survives_json_roundtrip():
    from drawkit import model
    mdl=model.build({'parts':[{'name':'1','features':[{'type':'extrude','loops':[{'rect':[0,0,20,10]}],'depth':8}]}]})
    sh={'id':'16-test','paper':'A1','scale':2,'views':[{'type':'auxiliary','name':'A','direction':[.12345678912345678,.8,.2]}]}
    expected=make_drawing.resolve_views(sh,['1'])[0].vdef
    actual=json.loads(json.dumps(make_drawing.make_sheet(sh,mdl,'16','精度检查',1,1,240)))['views'][0]['definition']
    for key in ('direction','u','v','origin'):
        assert actual[key]==expected[key]


def test_auxiliary_letter_moves_clear_without_erasing_outline():
    import copy
    from drawkit import geom2d as g2
    lines=[g2.polyline([[0,0],[50,0],[50,30],[0,30],[0,0]],'visible')]
    view={'lines':copy.deepcopy(lines),'placement':{'scale':1,'paper_origin':[300,200]},'dimensions':[],
          'annotations':[{'kind':'text','text':'斜视2','at':[47,15],'height':9,'role':'aux'},
                         {'kind':'arrow','tip':[47,15],'dir':[1,0],'size':3,'role':'aux'}]}
    sh={'sheet':'16-test','paper':{'width':841,'height':594},'views':[view],'sheet_marks':[]}
    make_drawing.clear_auxiliary_letters(sh)
    mark=next(m for m in view['annotations'] if m['kind']=='text')
    b=make_drawing.text_box(mark['text'],mark['at'],9,mark['anchor'])
    assert not make_drawing.box_overlap(b,[0,0,50,30],1)
    assert view['lines']==lines


def test_explicit_view_position_must_stay_inside_paper_frame():
    from drawkit import model
    mdl=model.build({'parts':[{'name':'1','features':[{'type':'extrude','loops':[{'rect':[0,0,20,10]}],'depth':8}]}]})
    view={'type':'front','free':True,'at':[0,0]}
    sh={'id':'16-frame','paper':'A1','scale':2,'views':[view]}
    try:
        make_drawing.make_sheet(sh,mdl,'16','图框边界',1,1,240)
    except make_drawing.SpecError:
        pass
    else:
        raise AssertionError('自由定位视图越出图框应拒绝出图')
    view['at']=[350,250]
    actual=make_drawing.make_sheet(sh,mdl,'16','图框边界',1,1,240)
    assert len(actual['views'])==1
