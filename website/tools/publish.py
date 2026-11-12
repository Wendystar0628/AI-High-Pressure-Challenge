"""Publish the results website in one go: export scores, build, push the built site to the gh-pages branch.

    python website/tools/publish.py              export + build + push to GitHub Pages
    python website/tools/publish.py --no-upload  export + build only, to check a build locally
While website/tools/site.json has "hold": true, every run (manual or the automatic one after grading) only builds.

The scheduler runs it on its own when a model's grading has ended (orchestrator/site_publish.py); run it by hand
after scores are edited or the site code changes. Where it publishes is set only in website/tools/publish.json.
GitHub Pages serves the branch under that domain and Alibaba Cloud DCDN in front picks up new pages within its HTML
cache time, so nothing else needs refreshing and no cloud keys are involved. The branch holds only the latest
build: each publish replaces it with one fresh commit."""
import json
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


def run(cmd, cwd=None):
    print('>', ' '.join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], cwd=cwd, check=True)


def build():
    sys.path.insert(0, str(REPO / 'orchestrator'))
    import usage
    if usage.ledger_only():
        print('本地核账模式：只读用量台账和已保存请求，跳过会话采集与台账写入。', flush=True)
    else:
        usage.collect()
    run([sys.executable, TOOLS / 'export_data.py'])
    npm = shutil.which('npm') or 'npm'
    if not (SITE / 'node_modules').is_dir():
        run([npm, 'ci'], cwd=SITE)
    run([npm, 'run', 'build'], cwd=SITE)
    if not (DIST / 'index.html').exists():
        raise SystemExit(f'构建没有产出 {DIST / "index.html"}')


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


def summary():
    """The ranking as published: one line per registered model, in the site's order."""
    scores = json.loads((SITE / 'data' / 'scores.json').read_text(encoding='utf-8'))
    models = {m['id']: m['name'] for m in json.loads((SITE / 'data' / 'models.json').read_text(encoding='utf-8'))}
    lines = [f'成绩日期 {scores["updated"]}，{len(models)} 个模型：']
    for mid in scores['order']:
        s = scores['scores'][mid]
        lines.append(f'  {s["rank"] or "评测中"}  {models[mid]}  {"—" if s["total"] is None else s["total"]}'
                     + ('' if s['rank'] else f'（已出 {s["done"]} 题）'))
    return lines


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    build()
    print('\n'.join(summary()), flush=True)
    if '--no-upload' in sys.argv:
        print('按 --no-upload 只构建，没有推送。', flush=True)
        return
    if held():
        print('site.json 的 hold 打开：推送暂停，只构建，没有推送。', flush=True)
        return
    deploy(config())


if __name__ == '__main__':
    main()
