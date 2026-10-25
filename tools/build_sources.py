#!/usr/bin/env python3
"""Merge the research/*.json lists into sources.json for the app.

Run from the repo root:  python3 tools/build_sources.py
Order matters: earlier files win when the same domain appears twice
(primary reports first, the CheckFirst bulk list last).
"""
import json, re, subprocess, sys, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ['research/manual.json', 'research/other.json', 'research/pravda.json', 'research/checkfirst.json']
DROP = {
    'xynovas.online',  # source says no direct RT connection
}
# Treat CopyCop as the same cluster as Storm-1516 (sources use both names).
CATEGORY_MAP = {'copycop': 'storm-1516'}
PLATFORMS = {'blogspot.com', 'wordpress.com', 'substack.com', 'github.io', 'medium.com', 't.me', 'telegram.org',
             'youtube.com', 'facebook.com', 'wixsite.com', 'weebly.com', 'netlify.app', 'vercel.app', 'pages.dev'}

def norm(d):
    d = d.strip().lower().replace('[.]', '.').rstrip('.')
    d = re.sub(r'^https?://', '', d).split('/')[0]
    return re.sub(r'^(www\d?|m|mobile|amp)\.', '', d)

entries, seen, problems = [], set(), []
for f in FILES:
    for e in json.loads((ROOT / f).read_text(encoding='utf-8')):
        key = ('d', norm(e['domain'])) if e.get('domain') else ('y', e['youtube'].lower())
        if key[1] in DROP or key in seen:
            continue
        if key[0] == 'd':
            e['domain'] = key[1]
            if '.'.join(key[1].split('.')[-2:]) in PLATFORMS and key[1].count('.') < 2:
                problems.append(f'platform domain would flag a whole service: {key[1]}')
                continue
        e['category'] = CATEGORY_MAP.get(e.get('category'), e.get('category'))
        seen.add(key)
        entries.append({k: v for k, v in e.items() if v not in (None, '')})

# Never list a genuine outlet that the lookalike checker treats as real.
genuine = json.loads(subprocess.run(['node', '-e', 'console.log(JSON.stringify(require("./matcher.js").BRANDS.flatMap(b=>b.genuine)))'],
                                    cwd=ROOT, capture_output=True, text=True, check=True).stdout)
for e in entries:
    d = e.get('domain')
    if d and any(d == g or d.endswith('.' + g) for g in genuine):
        problems.append(f'listed domain is a genuine outlet: {d}')

if problems:
    print('\n'.join(problems)); sys.exit(1)

entries.sort(key=lambda e: (e['category'], e.get('domain') or e.get('youtube')))
out = {'updated': datetime.date.today().isoformat(), 'count': len(entries), 'entries': entries}
(ROOT / 'sources.json').write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding='utf-8')
from collections import Counter
print(f'{len(entries)} entries:', dict(Counter(e['category'] for e in entries)))
