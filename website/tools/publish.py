"""Publish website content with the existing confirmed score snapshot.

python website/tools/publish.py                  build and upload confirmed scores only
python website/tools/publish.py --no-upload      isolated formal build, without upload
python website/tools/publish.py --confirm <key>  after explicit user confirmation, approve one complete model and publish

Live grading only refreshes site/data through export_data.py. Formal builds use a temporary data directory
via ONESHOT_SITE_DATA_DIR and never overwrite the live preview or upgrade scores implicitly.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
SITE = TOOLS.parent / 'site'
DIST = SITE / 'dist'
REPO = TOOLS.parent.parent
CONFIG = TOOLS / 'publish.json'
SITE_CONFIG = TOOLS / 'site.json'


def config():
    return json.loads(CONFIG.read_text(encoding='utf-8'))


def held():
    """site.json "hold": true pauses every push (manual or automatic): publish only builds until the user lifts it."""
    try:
        return bool(json.loads(SITE_CONFIG.read_text(encoding='utf-8')).get('hold'))
    except FileNotFoundError:
        return False


def run(cmd, cwd=None, env=None):
    print('>', ' '.join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], cwd=cwd, env=env, check=True)


def exporter():
    if str(TOOLS) not in sys.path:
        sys.path.insert(0, str(TOOLS))
    import export_data
    return export_data


def build():
    """Build only the confirmed snapshot, using isolated data; the live preview stays untouched."""
    with tempfile.TemporaryDirectory(prefix='oneshot-confirmed-site-') as folder:
        data = Path(folder).resolve() / 'data'
        run([sys.executable, TOOLS / 'export_data.py', '--confirmed', '--out', data])
        npm = shutil.which('npm') or 'npm'
        if not (SITE / 'node_modules').is_dir():
            run([npm, 'ci'], cwd=SITE)
        run([npm, 'run', 'build', '--', '--outDir', DIST.resolve()], cwd=SITE,
            env=os.environ | {'ONESHOT_SITE_DATA_DIR': str(data)})
        if not (DIST / 'index.html').exists():
            raise SystemExit(f'构建没有产出 {DIST / "index.html"}')
        return summary(data)


def pushed_note(cfg):
    return f'已推送到 {cfg["branch"]} 分支；https://{cfg["domain"]}/ 在 DCDN 网页缓存到期后更新'


def deploy(cfg):
    """Copy dist into a throwaway repo with CNAME and .nojekyll, commit once, force-push it as the Pages branch."""
    remote = subprocess.run(['git', '-C', str(REPO), 'remote', 'get-url', 'origin'],
                            capture_output=True, text=True, check=True).stdout.strip()
    with tempfile.TemporaryDirectory(prefix='octathlon-pages-') as tmp:
        out = Path(tmp) / 'site'
        shutil.copytree(DIST, out)
        (out / 'CNAME').write_text(cfg['domain'] + '\n', encoding='utf-8')
        (out / '.nojekyll').write_text('', encoding='utf-8')
        git = ['git', '-C', str(out), '-c', 'core.autocrlf=false']
        run(git + ['init', '-q', '-b', cfg['branch']])
        run(git + ['add', '-A'])
        stamp = datetime.now().strftime('%Y-%m-%d %H:%M')
        run(git + ['-c', 'user.name=Wendystar', '-c', 'user.email=wendystar1145@gmail.com',
                   'commit', '-q', '-m', f'发布成绩网站 {stamp}'])
        run(git + ['push', '-q', '--force', remote, f'HEAD:{cfg["branch"]}'])
    print(pushed_note(cfg) + '。', flush=True)


def summary(data_dir):
    """The ranking as published: one line per registered model, in the site's order."""
    scores = json.loads((Path(data_dir) / 'scores.json').read_text(encoding='utf-8'))
    models = {m['id']: m['name'] for m in json.loads((Path(data_dir) / 'models.json').read_text(encoding='utf-8'))}
    lines = [f'成绩日期 {scores["updated"]}，{len(models)} 个模型：']
    for mid in scores['order']:
        s = scores['scores'][mid]
        lines.append(f'  {s["rank"] or "评测中"}  {models[mid]}  {"—" if s["total"] is None else s["total"]}'
                     + ('' if s['rank'] else f'（已出 {s["done"]} 题）'))
    return lines


def main(argv=()):
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description='只发布已确认成绩；新成绩须用户明确确认')
    ap.add_argument('--no-upload', action='store_true')
    ap.add_argument('--confirm', metavar='厂商/型号')
    args = ap.parse_args(argv)
    if args.confirm:
        sys.path.insert(0, str(REPO / 'orchestrator'))
        import common
        with common.locked():
            exporter().confirm_model(args.confirm)
    print('\n'.join(build()), flush=True)
    if args.no_upload:
        print('按 --no-upload 仅构建已确认正式成绩，没有推送。', flush=True)
        return
    if held():
        print('site.json 的 hold 打开：推送暂停，只构建，没有推送。', flush=True)
        return
    deploy(config())


if __name__ == '__main__':
    main(sys.argv[1:])
