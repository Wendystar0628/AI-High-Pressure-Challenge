"""Private grading entry: compile, run public and associated hidden inputs, save evidence."""
from pathlib import Path
import argparse
import json
from build import build
from rt_eval import SETTINGS, InvalidBaseline, anchors_for, evaluate
from rules_scan import scan

ROOT=Path(__file__).resolve().parent

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    p.add_argument('--cpus',default=SETTINGS['cpus']);p.add_argument('--quick',action='store_true')
    a=p.parse_args(); a.output.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((ROOT/'manifest.json').read_text('utf-8'))
    from rt_eval import validate_manifest
    validate_manifest(manifest,hidden=True)
    (a.output/'rule_scan.json').write_text(json.dumps(scan(a.source),ensure_ascii=False,indent=2),encoding='utf-8')
    try:
        baseline=build(ROOT/'reference.cu',a.output/'reference.exe',a.cpus)
    except RuntimeError as e:
        (a.output/'invalid.json').write_text(json.dumps(dict(valid=False,reason='baseline compilation failed: '+str(e)),ensure_ascii=False,indent=2),encoding='utf-8')
        raise SystemExit('整次评测作废：基线编译失败。')
    try:
        compiled=build(a.source,a.output/'submission.exe',a.cpus)
    except RuntimeError as e:
        scored=all(anchors_for(item) for item in manifest['performance'])
        result=dict(valid=True,status='compile_failed',score=0 if scored else None,reason=str(e))
        (a.output/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        raise SystemExit('提交编译失败。')
    compiled['baseline']=baseline
    (a.output/'compile.json').write_text(json.dumps(compiled,ensure_ascii=False,indent=2),encoding='utf-8')
    try:
        evaluate(a.output/'submission.exe',ROOT,manifest,a.cpus,a.quick,hidden=True,output_dir=a.output,baseline_exe=a.output/'reference.exe')
    except InvalidBaseline as e:
        (a.output/'invalid.json').write_text(json.dumps(dict(valid=False,reason=str(e)),ensure_ascii=False,indent=2),encoding='utf-8')
        raise SystemExit('整次评测作废：基线失败。排除环境问题后重新运行。\n'+str(e))
    except (RuntimeError,ValueError) as e:
        (a.output/'invalid.json').write_text(json.dumps(dict(valid=False,reason=str(e)),ensure_ascii=False,indent=2),encoding='utf-8')
        raise SystemExit('整次评测未能完成：'+str(e))

if __name__=='__main__':main()
