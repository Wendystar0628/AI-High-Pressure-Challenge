"""Export local live scores, or the separate confirmed formal snapshot.

python website/tools/export_data.py                              refresh site/data (audit and partial models included)
python website/tools/export_data.py --scores-only                grading refresh; initialize static files if missing
python website/tools/export_data.py --confirmed --out <folder>   formal build input, used by publish.py

Local final task scores come from grading.py; incomplete totals/ranks remain null. Formal data comes only from
confirmed-scores.json and is still filtered by current registration/audit. Cost privacy and anonymous anomaly
projection apply to both. Imports retain complete-only defaults for other consumers such as video tools.
No grading, usage, answer or video records are modified. Requires pypinyin==0.53.0.
"""
import argparse
import copy
import json
import posixpath
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

sys.dont_write_bytecode = True  # importing the orchestrator must not write orchestrator/__pycache__

TOOLS = Path(__file__).resolve().parent
WEBSITE = TOOLS.parent
BENCH = WEBSITE.parent
OUT = WEBSITE / 'site' / 'data'
CONFIRMED = TOOLS / 'confirmed-scores.json'
LOGOS = WEBSITE / 'logos' / 'mark'
sys.path.insert(0, str(BENCH / 'orchestrator'))

import grading  # noqa: E402  (read-only use: load, task_scores, model_scores, phases, run_dir)
import costs  # noqa: E402  (read-only use: load)
from run_state import paths  # noqa: E402
from tasks import TASKS  # noqa: E402

try:
    from pypinyin import Style, lazy_pinyin
except ImportError:
    raise SystemExit('缺少 pypinyin：先运行 python -m pip install pypinyin==0.53.0')

KINDS = ('standard', 'design')
CJK = re.compile(r'[\u3400-\u9fff]')


def one(x):
    """0-100 score with one decimal, as scores_report prints it; None stays None."""
    return None if x is None else float(f'{x:.1f}')


def num(x):
    """Weights as plain numbers: 15 rather than 15.0."""
    return int(x) if float(x).is_integer() else x


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(path, data):
    content = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if path.is_file() and path.read_text(encoding='utf-8') == content:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(content, encoding='utf-8')
    tmp.replace(path)


def date_of(ts):
    return datetime.fromtimestamp(ts).strftime('%Y-%m-%d')


# ---------- registry and task copy ----------

def load_registry(include_private=False):
    models = read_json(TOOLS / 'models.json')
    seen_id, seen_key = set(), set()
    for m in models:
        for field in ('id', 'key', 'name', 'short', 'vendor', 'logo', 'agent', 'effort'):
            if not m.get(field):
                raise SystemExit(f'models.json：{m.get("key") or m} 缺少 {field}')
        if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', m['id']):
            raise SystemExit(f'models.json：id 只能用小写字母、数字和连字符：{m["id"]}')
        if m['id'] in seen_id or m['key'] in seen_key:
            raise SystemExit(f'models.json：重复登记 {m["id"]} / {m["key"]}')
        if not (LOGOS / f'{m["logo"]}.svg').is_file():
            raise SystemExit(f'models.json：没有图标 website/logos/mark/{m["logo"]}.svg')
        seen_id.add(m['id'])
        seen_key.add(m['key'])
    # Temporary hold, rarely used: "audit": true keeps a model registered (videos and cost accounting still read it)
    # but leaves it off the site entirely. The user removes the field when it may go public and publish.py runs again.
    return models if include_private else [m for m in models if not m.get('audit')]


def site_notice():
    """site.json's "notice" ({zh, en}) while the site-wide hold is on, else None."""
    path = TOOLS / 'site.json'
    notice = read_json(path).get('notice') if path.is_file() else None
    if notice and not (notice.get('zh') and notice.get('en')):
        raise SystemExit('site.json：notice 要有 zh 和 en 两句，关闭时写 null')
    return notice or None


_timer = None


def timer_state():
    """The answering records of orchestrator/state.json ({'<model key>/<task>': record}), read once."""
    global _timer
    if _timer is None:
        try:
            _timer = json.loads(paths.state.read_text(encoding='utf-8')).get('tasks', {})
        except (OSError, ValueError):
            _timer = {}
    return _timer


def latest_session_date(key):
    """Start date of the model's latest answering session among the current tasks (orchestrator/state.json)."""
    try:
        timer = json.loads(paths.state.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    starts = [r['start'] for t in TASKS if isinstance(r := timer.get('tasks', {}).get(f'{key}/{t}'), dict) and r.get('start')]
    return date_of(max(starts)) if starts else None


def load_tasks():
    """Categories in tasks_meta.json order; tasks inside a category in orchestrator/tasks.py order."""
    meta = read_json(TOOLS / 'tasks_meta.json')
    by_source, keys = {}, set()
    for cat in meta['categories']:
        for t in cat['tasks']:
            if t['source'] not in TASKS:
                raise SystemExit(f'tasks_meta.json：orchestrator/tasks.py 里没有这道题：{t["source"]}')
            if TASKS[t['source']].category != cat['name']:
                raise SystemExit(f'tasks_meta.json：{t["source"]} 应在类别 {TASKS[t["source"]].category}')
            if t['key'] in keys or t['source'] in by_source:
                raise SystemExit(f'tasks_meta.json：重复的题目 {t["key"]}')
            keys.add(t['key'])
            by_source[t['source']] = (cat, t)
    if missing := [n for n in TASKS if n not in by_source]:
        raise SystemExit('tasks_meta.json 缺少这些题：' + '、'.join(missing))

    categories, number = [], 0
    for cat in meta['categories']:
        names = [n for n in TASKS if TASKS[n].category == cat['name']]
        kinds = {TASKS[n].grading_type for n in names}
        if len(kinds) != 1:
            raise SystemExit(f'类别 {cat["name"]} 混有两种题型')
        tasks = []
        for n in names:
            number += 1
            t, src = by_source[n][1], TASKS[n]
            tasks.append({
                'key': t['key'], 'path': f'{cat["key"]}/{t["key"]}', 'no': number, 'category': cat['key'],
                'name': n, 'name_en': t['name_en'], 'short': t['short'], 'short_en': t['short_en'],
                'weight': num(src.weight), 'minutes': src.minutes, 'kind': src.grading_type,
                'brief': t['brief'], 'brief_en': t['brief_en'],
                'deliverable': t['deliverable'], 'deliverable_en': t['deliverable_en'],
                'statement': src.statement.relative_to(BENCH).as_posix(),
                '_source': n, '_terms': t.get('terms', []),
            })
        categories.append({
            'key': cat['key'], 'name': cat['name'], 'en': cat['en'], 'short': cat['short'], 'short_en': cat['short_en'],
            'icon': cat['key'], 'weight': num(sum(TASKS[n].weight for n in names)), 'kind': kinds.pop(),
            'brief': cat['brief'], 'brief_en': cat['brief_en'], 'tasks': tasks,
        })
    return categories, meta.get('sections', [])


# ---------- scores ----------

def public_fields(data, fields):
    """Explicit scalar projection: private cost extensions never become downloadable website data."""
    if not isinstance(data, dict):
        return {}
    return {k: data[k] for k in fields if k in data and (data[k] is None or isinstance(data[k], (str, int, float, bool)))}


def public_cost(cost):
    out = public_fields(cost, ('cny', 'basis', 'tokens', 'method', 'api_usd', 'hours'))
    if 'plan' in cost:
        out['plan'] = (public_fields(cost['plan'], ('name', 'name_en', 'price', 'currency', 'period', 'credits'))
                       if isinstance(cost['plan'], dict) else None)
    return out


def ranks(values):
    """{id: rank} by score, highest first; equal one-decimal scores share a rank (1, 2, 2, 4); None gets None."""
    scored = sorted((v for v in values.values() if v is not None), reverse=True)
    return {k: (None if v is None else scored.index(v) + 1) for k, v in values.items()}


def grader_scores(task, sc):
    """A design task's score as each main-item grader alone would give it ([{name, score}]), composed like
    grading.design_score (performance items keep their own grader), only when two or more graders scored the main
    items; their mean is the task score."""
    if TASKS[task].grading_type != 'design':
        return []
    sources = sc.get('sources') or []
    main = [g for g in grading.GRADERS if any(s[0] == g and s[1] in (None, 'main') for s in sources)
            and g in sc.get('grader_keys', TASKS[task].graders_for('main'))]
    if len(main) < 2:
        return []
    expected = grading.guide_items(task)
    performance = {grading.norm(k) for k in TASKS[task].performance_items}
    out = []
    for g in main:
        total = full = 0
        for key, (maximum, weight) in expected.items():
            selected = 'performance' if key in performance else 'main'
            vals = [mine[key]['score'] for grader, scope, r in sources if key in (mine := grading.by_key(r))
                    and grader in (('codex',) if selected == 'performance' else main) and scope in (None, selected)
                    and (selected == 'performance' or grader == g)]
            full += maximum * weight
            if vals:
                total += sum(vals) / len(vals) * weight
        if full:
            out.append({'name': grading.GRADERS[g], 'score': one(min(100, total / full * 100))})
    return out


def task_info(model, per, timer):
    """Per task, only what the score itself does not say: why it has no score yet ('state': testing = 评测中,
    missing = 未交, failed = 评分失败, unscored = 未给总分), each grader's score of a design task, and
    anomaly text ([{text}]) without its grader attribution. Tasks with nothing to add are left out."""
    out = {}
    for n in TASKS:
        p, info = per[n], {}
        g = p['gap']
        if g:
            closed = isinstance(r := timer.get(f'{model["key"]}/{n}'), dict) and r.get('closed')
            info['state'] = {'未评完': 'testing', '评分失败': 'failed', '未给总分': 'unscored'}.get(
                g, 'missing' if closed else 'testing')
        elif graders := grader_scores(n, p['sc']):
            info['graders'] = graders
        notes = [{'text': r['anomaly']} for r in p['rs'] if r and r.get('anomaly')]
        if notes:
            info['anomaly'] = notes
        if info:
            out[n] = info
    return out


def model_record(state, model, categories):
    """One model's scores. A task counts once its score is final (grading.py reports no gap for it); a category or
    kind needs all its tasks, and the total needs all 13, otherwise null and the model is 评测中 (testing)."""
    per = grading.task_scores(state, model['key'])
    total, cats = grading.model_scores(per)
    final = {n: per[n]['sc']['score'] is not None and not per[n]['gap'] for n in TASKS}
    score = {n: per[n]['sc']['score'] if final[n] else None for n in TASKS}

    def mean(names):
        if not all(final[n] for n in names):
            return None
        return sum(TASKS[n].weight * score[n] for n in names) / sum(TASKS[n].weight for n in names)

    tasks = {t['key']: one(score[t['_source']]) for c in categories for t in c['tasks']}
    record = {
        'total': one(total) if all(final.values()) else None,
        'kinds': {k: one(mean([n for n in TASKS if TASKS[n].grading_type == k])) for k in KINDS},
        'categories': {c['key']: one(cats[c['name']][0]) if all(final[t['_source']] for t in c['tasks']) else None
                       for c in categories},
        'tasks': tasks,
        'status': 'ranked' if all(final.values()) else 'testing',
        'done': sum(final.values()),
    }
    keys = {t['_source']: t['key'] for c in categories for t in c['tasks']}
    info = task_info(model, per, timer_state())
    record['task_info'] = {keys[n]: v for n, v in info.items() if n in keys}
    used = [grading.run_dir(p) / 'result.json'
            for n in TASKS if final[n] for job in per[n]['js'] if job
            for p in grading.phases(job) if p['state'] == 'done']
    mtimes = [f.stat().st_mtime for f in used if f.is_file()]
    return record, (max(mtimes) if mtimes else None)


def rank_records(records, categories):
    ids = list(records)
    overall = ranks({i: records[i]['total'] for i in ids})
    by_cat = {c['key']: ranks({i: records[i]['categories'][c['key']] for i in ids}) for c in categories}
    by_task = {t['key']: ranks({i: records[i]['tasks'][t['key']] for i in ids}) for c in categories for t in c['tasks']}
    for i in ids:
        records[i]['rank'] = overall[i]
        records[i]['category_ranks'] = {c: by_cat[c][i] for c in by_cat}
        records[i]['task_ranks'] = {t: by_task[t][i] for t in by_task}
    return sorted(ids, key=lambda i: (overall[i] is None, overall[i] or 0, ids.index(i)))


def build_scores(models, categories, complete_only=True):
    state = grading.load()
    cost_source, model_costs = costs.load([m['key'] for m in models])
    records, newest = {}, []
    task_keys = [t['key'] for c in categories for t in c['tasks']]
    for m in models:
        if complete_only and m['key'] not in state['models']:
            print(f'提示：{m["key"]} 还没有评分记录，不公开。')
            continue
        record, latest = model_record(state, m, categories)
        if complete_only and not grading.complete_score_record(record, task_keys):
            continue
        records[m['id']] = record
        records[m['id']]['cost'] = public_cost(model_costs.get(m['key'], {}))
        if latest:
            newest.append(latest)
    order = rank_records(records, categories)
    return {
        'updated': date_of(max(newest)) if newest else None,
        'cost_source': public_fields(cost_source, ('name', 'name_en', 'url', 'fetched', 'usd_cny')),
        'order': order,
        'scores': {i: records[i] for i in order},
    }


# ---------- search ----------

def spell(texts):
    """Pinyin full spelling and initials of the texts that contain Chinese, lower-case, letters and digits only."""
    full, initials = [], []
    for text in texts:
        if not text or not CJK.search(text):
            continue
        for style, out in ((Style.NORMAL, full), (Style.FIRST_LETTER, initials)):
            value = re.sub(r'[^a-z0-9]', '', ''.join(lazy_pinyin(text, style=style)).lower())
            if value and value not in out:
                out.append(value)
    return full, initials


def item(kind, id_, name, en, short, terms, href, **extra):
    """One search entry; terms already contained in the name, English name or short name are left out."""
    shown = [x.lower() for x in (name, en, short) if x]
    terms = list(dict.fromkeys(x for x in terms if x and not any(x.lower() in s for s in shown)))
    py, pyi = spell([name, short, *terms])
    return {'type': kind, 'id': id_, 'name': name, 'en': en, 'short': short, 'terms': terms,
            'py': py, 'pyi': pyi, **extra, 'href': href}


def build_search(models, categories, sections):
    items = [item('model', m['id'], m['name'], m['name'], m['short'],
                  [*m.get('aliases', []), m['vendor'], m['agent'], m['key']], f'/models/{m["id"]}/')
             for m in models]
    items += [item('task', t['key'], t['name'], t['name_en'], t['short'], [t['short_en'], *t['_terms']],
                   f'/tasks/{c["key"]}/{t["key"]}/', category=c['key'], short_en=t['short_en'])
              for c in categories for t in c['tasks']]
    items += [item('category', c['key'], c['name'], c['en'], c['short'], [c['short_en']], f'/categories/#{c["key"]}',
                   short_en=c['short_en'])
              for c in categories]
    items += [item('section', s['id'], s['name'], s['en'], s['name'], [], f'/about/#{s["id"]}', page='about',
                   **({'parent': s['parent']} if s.get('parent') else {}))
              for s in sections]
    return {'items': items}


# ---------- 题干 (the statement text on each task page) ----------

# STEM_RULE, the one rule for what counts as 题干 (website/docs/tasks.md「题干」):
# - A statement is cut into sections by its headings. A section whose heading contains any of NOT_STEM is not 题干,
#   together with all its subsections; every other section is, and so is the lead text before the first section.
#   The top heading itself (「# 题目」 or the task's name) is dropped: the page already has the title.
# - Problems kept as separate files go with it: the files named 第NN题.md at the top of the task's materials folder
#   (the folder beside the statement, orchestrator/tasks.py MATERIALS) follow the statement in number order, each as
#   one section under its own heading, cut by the same rule. Other material files (the Luban lock layer drawings and
#   voxel data, the graders) are only linked: the statement links them, and the page links the folder.
NOT_STEM = ('作答', '提交', '交付',                       # how to answer and hand in
            '规定', '规则', '注意事项',                    # rules and pitfalls
            '评分', '评价', '评测',                        # scoring, timing, the grader program and machine
            '运行环境', '本机环境', '技术要求',            # environment and technology
            '视频导出', '录制')                            # interfaces for recording the work
STEM_KEEP = ('游戏规则',)                                  # the rules of play are 题干, though they contain 规则
PROBLEM_FILE = re.compile(r'第(\d+)题\.md')

MD_HEADING = re.compile(r'(#{1,6})\s+(.+?)\s*#*\s*$')
MD_FENCE = re.compile(r'( *)(`{3,}|~{3,})\s*([\w+#-]*)\s*$')
MD_ITEM = re.compile(r'( *)([-*+]|(\d{1,9})[.)])( +|$)(.*)')
MD_RULE = re.compile(r' {0,3}([-*_])( *\1){2,} *$')
MD_ALIGN = re.compile(r' *:?-{3,}:? *')
MD_LINK = re.compile(r'(?<!!)\[([^\]]+)\]\(([^)\s]+)\)')


def md_tree(text):
    """Headings outside code fences -> {title, level, lines, sections}; the root holds the lines before the first one."""
    root = {'title': '', 'level': 0, 'lines': [], 'sections': []}
    stack, fence = [root], None
    for line in text.replace('\r\n', '\n').split('\n'):
        if fence:
            if line.strip().startswith(fence):
                fence = None
        elif m := MD_FENCE.match(line):
            fence = m.group(2)[0] * 3
        elif m := MD_HEADING.match(line):
            node = {'title': m.group(2), 'level': len(m.group(1)), 'lines': [], 'sections': []}
            while stack[-1]['level'] >= node['level']:
                stack.pop()
            stack[-1]['sections'].append(node)
            stack.append(node)
            continue
        stack[-1]['lines'].append(line)
    # a file under one top heading: that heading is the file's title, its lead text the root's
    if len(root['sections']) == 1 and root['sections'][0]['level'] == 1 and not ''.join(root['lines']).strip():
        top = root['sections'][0]
        root = {**top, 'level': 0}
    return root


WIDE = re.compile(r'[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]')


def join_lines(lines):
    """Soft line breaks: nothing between two Chinese characters or full-width marks, a space otherwise."""
    out = ''
    for s in (x.strip() for x in lines):
        out += s if not out or (WIDE.match(out[-1]) and WIDE.match(s[0])) else ' ' + s
    return out


def split_row(line):
    """Table cells; a | inside $…$ or `…` does not split, nor an escaped \\|."""
    s = line.strip()
    s = s[1:] if s.startswith('|') else s
    s = s[:-1] if s.endswith('|') and not s.endswith('\\|') else s
    cells, cur, quote, i = [], '', None, 0
    while i < len(s):
        c = s[i]
        if c == '\\' and s[i + 1:i + 2] == '|':
            cur += '|'
            i += 2
            continue
        if quote:
            quote = None if c == quote else quote
        elif c in '$`':
            quote = c
        elif c == '|':
            cells.append(cur.strip())
            cur = ''
            i += 1
            continue
        cur += c
        i += 1
    return cells + [cur.strip()]


def md_blocks(lines, base):
    """Markdown block lines -> the site's block list (site/src/reading/content.js). Inline markup stays as written;
    links relative to the file become "gh:<path in the repo>"."""
    def inline(s):
        def link(m):
            href = m.group(2)
            if re.match(r'[a-z]+:|#', href):
                return m.group(0)
            return f'[{m.group(1)}](gh:{posixpath.normpath(posixpath.join(base, href))})'
        return MD_LINK.sub(link, s)

    out, para, i = [], [], 0

    def flush():
        if para:
            out.append(inline(join_lines(para)))
            para.clear()

    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s:
            flush()
            i += 1
            continue
        if m := MD_FENCE.match(line):
            flush()
            indent, mark, code = len(m.group(1)), m.group(2), []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith(mark[0] * len(mark)):
                ln = lines[i]
                code.append(ln[min(indent, len(ln) - len(ln.lstrip(' '))):])
                i += 1
            i += 1
            out.append({'code': '\n'.join(code), 'lang': m.group(3)} if m.group(3) else {'code': '\n'.join(code)})
            continue
        if s.startswith('$$'):
            flush()
            tex = s[2:]
            if tex.endswith('$$') and tex.strip() != '':
                tex, i = tex[:-2], i + 1
            else:
                i += 1
                while i < len(lines) and not lines[i].strip().endswith('$$'):
                    tex += '\n' + lines[i]
                    i += 1
                if i < len(lines):
                    tex += '\n' + lines[i].strip()[:-2]
                i += 1
            out.append({'math': tex.strip()})
            continue
        if MD_RULE.match(line):
            flush()
            i += 1
            continue
        if s.startswith('|') and i + 1 < len(lines) and all(MD_ALIGN.fullmatch(c) for c in split_row(lines[i + 1])):
            flush()
            head, align = split_row(line), split_row(lines[i + 1])
            rows, i = [], i + 2
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append([inline(c) for c in split_row(lines[i])])
                i += 1
            spec = {'head': [inline(c) for c in head], 'rows': rows}
            if num := [k for k, a in enumerate(align) if a.strip().endswith(':') and not a.strip().startswith(':')]:
                spec['num'] = num
            out.append({'table': spec})
            continue
        if (m := MD_ITEM.match(line)) and len(m.group(1)) < 4:
            flush()
            ordered, indent = m.group(3) is not None, len(m.group(1))
            items, cur = [], None
            while i < len(lines):
                ln = lines[i]
                im = MD_ITEM.match(ln)
                if im and len(im.group(1)) == indent and (im.group(3) is not None) == ordered:
                    cur = {'col': indent + len(im.group(2)) + max(1, len(im.group(4))), 'lines': [im.group(5)]}
                    items.append(cur)
                    i += 1
                    continue
                if not ln.strip():
                    nxt = next((x for x in lines[i + 1:] if x.strip()), None)
                    if nxt is None or len(nxt) - len(nxt.lstrip(' ')) < cur['col'] and not (
                            (nm := MD_ITEM.match(nxt)) and len(nm.group(1)) == indent):
                        break
                    cur['lines'].append('')
                    i += 1
                    continue
                lead = len(ln) - len(ln.lstrip(' '))
                if lead >= cur['col']:
                    cur['lines'].append(ln[cur['col']:])
                elif cur['lines'][-1].strip() and not im and not ln.lstrip().startswith(('$$', '|', '```')):
                    cur['lines'].append(ln.strip())  # lazy continuation of the item's paragraph
                else:
                    break
                i += 1
            parsed = []
            for it in items:
                b = md_blocks(it['lines'], base)
                if len(b) == 1 and isinstance(b[0], str):
                    parsed.append(b[0])
                elif b and isinstance(b[0], str):
                    parsed.append({'text': b[0], 'blocks': b[1:]})
                else:
                    parsed.append({'text': '', 'blocks': b})
            block = {'ol' if ordered else 'ul': parsed}
            if ordered and (start := int(m.group(3))) != 1:
                block['start'] = start
            out.append(block)
            continue
        para.append(line)
        i += 1
    flush()
    return out


def stem_sections(node, base, omitted):
    """Kept subsections of a node as {title, blocks, sections}; left-out headings go to omitted."""
    out = []
    for sec in node['sections']:
        if any(word in sec['title'] for word in NOT_STEM) and not any(word in sec['title'] for word in STEM_KEEP):
            omitted.append(sec['title'])
            continue
        item = {'title': sec['title'], 'blocks': md_blocks(sec['lines'], base)}
        if subs := stem_sections(sec, base, omitted):
            item['sections'] = subs
        out.append(item)
    return out


def build_stem(source):
    """One task's 题干 by STEM_RULE: { statement, materials, omitted, blocks, sections }."""
    task = TASKS[source]
    statement = task.statement.relative_to(BENCH).as_posix()
    base = posixpath.dirname(statement)
    root = md_tree(task.statement.read_text(encoding='utf-8-sig'))
    omitted = []
    sections = stem_sections(root, base, omitted)
    folder = task.materials[0] if task.materials else None
    if folder:
        files = sorted((int(m.group(1)), f) for f in folder.iterdir() if (m := PROBLEM_FILE.fullmatch(f.name)))
        rel = folder.relative_to(BENCH).as_posix()
        for _, f in files:
            prob = md_tree(f.read_text(encoding='utf-8-sig'))
            item = {'title': prob['title'] or f.stem, 'blocks': md_blocks(prob['lines'], rel)}
            if subs := stem_sections(prob, rel, omitted):
                item['sections'] = subs
            sections.append(item)
    return {
        'statement': statement,
        'materials': folder.relative_to(BENCH).as_posix() if folder else None,
        'omitted': list(dict.fromkeys(omitted)),
        'blocks': md_blocks(root['lines'], base),
        'sections': sections,
    }


def write_stems(categories):
    """stems/<category>/<task>.json for every task; the folder is rewritten whole, so no stale file stays."""
    out = OUT / 'stems'
    if out.exists():
        shutil.rmtree(out)
    for c in categories:
        for t in c['tasks']:
            write_json(out / c['key'] / f'{t["key"]}.json', build_stem(t['_source']))


# ---------- main ----------

def confirmed_data(categories):
    if not CONFIRMED.is_file():
        raise SystemExit('缺少已确认成绩快照，不能正式发布')
    snapshot = read_json(CONFIRMED)
    allowed = {m['id'] for m in load_registry()}
    models = [m for m in snapshot['models'] if m['id'] in allowed]
    task_keys = [t['key'] for c in categories for t in c['tasks']]
    scores = copy.deepcopy(snapshot['scores'])
    scores['scores'] = {m['id']: scores['scores'][m['id']] for m in models}
    if not all(grading.complete_score_record(r, task_keys) for r in scores['scores'].values()):
        raise SystemExit('已确认快照含未完成全套的模型')
    scores['cost_source'] = public_fields(scores.get('cost_source'), ('name', 'name_en', 'url', 'fetched', 'usd_cny'))
    for record in scores['scores'].values():
        record['cost'] = public_cost(record.get('cost', {}))
        for info in record.get('task_info', {}).values():
            if 'anomaly' in info:
                info['anomaly'] = [{'text': a['text']} for a in info['anomaly']]
    scores['order'] = rank_records(scores['scores'], categories)
    return models, scores


def confirm_model(key):
    """Called only by the explicit user-authorized --confirm command; update exactly this model's scores."""
    categories, _ = load_tasks()
    model = next((m for m in load_registry(include_private=True) if m['key'] == key), None)
    if model is None:
        raise SystemExit('没有登记这个型号：' + key)
    fresh = build_scores([model], categories)
    if model['id'] not in fresh['scores']:
        raise SystemExit('确认正式成绩需要全套 13 题完整且无评分缺口：' + key)
    snapshot = read_json(CONFIRMED)
    tested = model.get('tested') or latest_session_date(key)
    public_model = {k: model[k] for k in ('id', 'key', 'name', 'short', 'vendor', 'logo', 'agent', 'effort')}
    public_model.update(aliases=model.get('aliases', []), tested=tested)
    snapshot['models'] = [m for m in snapshot['models'] if m['id'] != model['id']] + [public_model]
    snapshot['scores']['scores'][model['id']] = fresh['scores'][model['id']]
    snapshot['scores']['updated'] = fresh['updated'] or snapshot['scores']['updated']
    snapshot['scores']['cost_source'] = fresh['cost_source']
    snapshot['scores']['order'] = rank_records(snapshot['scores']['scores'], categories)
    write_json(CONFIRMED, snapshot)
    registry = read_json(TOOLS / 'models.json')
    for m in registry:
        if m['key'] == key:
            m.pop('audit', None)
    write_json(TOOLS / 'models.json', registry)
    return model['id']


def main(argv=()):
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description='本地实时预览，或仅导出已确认正式成绩')
    ap.add_argument('--confirmed', action='store_true')
    ap.add_argument('--scores-only', action='store_true', help='本地评分刷新；缺少静态数据时完整初始化')
    ap.add_argument('--out', type=Path)
    args = ap.parse_args(argv)
    if args.confirmed and args.scores_only:
        ap.error('--scores-only 仅用于本地预览')
    global OUT
    if args.confirmed and (args.out is None or args.out.resolve() == (WEBSITE / 'site/data').resolve()):
        ap.error('--confirmed 必须用 --out 指向独立正式构建目录')
    if args.out is not None:
        OUT = args.out.resolve()
    categories, sections = load_tasks()
    static = not args.scores_only or not (OUT / 'tasks.json').is_file() or any(
        not (OUT / 'stems' / c['key'] / f'{t["key"]}.json').is_file()
        for c in categories for t in c['tasks'])
    notice = site_notice() if args.confirmed else None
    if args.confirmed:
        models, scores = confirmed_data(categories)
    else:
        registry = load_registry(include_private=True)
        scores = build_scores(registry, categories, complete_only=False)
        registry = [m for m in registry if m['id'] in scores['scores']]
        models = []
        for m in registry:
            tested = m.get('tested') or latest_session_date(m['key'])
            models.append({k: m[k] for k in ('id', 'key', 'name', 'short') if k in m} |
                          {'aliases': m.get('aliases', []), 'vendor': m['vendor'], 'logo': m['logo'], 'agent': m['agent'],
                           'effort': m['effort'], 'tested': tested})
    if notice:
        models = []
        scores['scores'] = {}
        scores['order'] = []
    scores['notice'] = notice
    search = build_search(models, categories, sections)
    tasks = [c | {'tasks': [{k: v for k, v in t.items() if not k.startswith('_')} for t in c['tasks']]}
             for c in categories]

    write_json(OUT / 'scores.json', scores)
    write_json(OUT / 'models.json', models)
    if static:
        write_json(OUT / 'tasks.json', tasks)
    write_json(OUT / 'search.json', search)
    if static:
        write_stems(categories)

    written = 'models.json、scores.json、search.json' + (f'、tasks.json、题干 stems/（{len(TASKS)} 题）' if static else '')
    print(f'已同步 {OUT}：{written}；'
          f'数据日期 {scores["updated"]}')
    if notice:
        print(f'暂停公示（site.json 的 notice）：不导出任何模型，成绩页显示「{notice["zh"]}」')
    names = {m['id']: m['name'] for m in models}
    for i, r in scores['scores'].items():
        place = f'第 {r["rank"]} 名' if r['rank'] else '评测中'
        total = '—' if r['total'] is None else f'{r["total"]:.1f}'
        kinds = ' / '.join('—' if r['kinds'][k] is None else f'{r["kinds"][k]:.1f}' for k in KINDS)
        print(f'  {place:6} {names[i]:18} 总分 {total:>5}  标准/设计 {kinds}  已出 {r["done"]}/{len(TASKS)} 题')


if __name__ == '__main__':
    main(sys.argv[1:])
