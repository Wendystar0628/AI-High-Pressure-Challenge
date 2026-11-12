"""python 数据/check.py --exe ./grader.exe [input IDs or 1-based indices] [--quick]"""
import argparse
import json
from pathlib import Path
from rt_eval import SETTINGS, evaluate

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--exe',type=Path,required=True); p.add_argument('inputs',nargs='*')
    p.add_argument('--quick',action='store_true',help='one baseline and one submission run per input')
    p.add_argument('--cpus',default=SETTINGS['cpus']); p.add_argument('--output',type=Path)
    p.add_argument('--no-idle-check',action='store_true',help='development only; timing is not a formal measurement')
    a=p.parse_args(); root=Path(__file__).resolve().parent
    evaluate(a.exe,root,json.loads((root/'manifest.json').read_text('utf-8')),a.cpus,a.quick,selected=a.inputs,idle=not a.no_idle_check,output_dir=a.output)

if __name__=='__main__': main()
