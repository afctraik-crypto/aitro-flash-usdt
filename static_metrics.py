from pathlib import Path
import re
base = Path('/home/ubuntu/aitro_review')
files = {p.name: p.read_text(encoding='utf-8', errors='ignore') for p in base.glob('*') if p.suffix in {'.html','.css','.js'}}
html = files.get('index.html','')
js = '\n'.join(v for k,v in files.items() if k.endswith('.js'))
css = files.get('styles.css','')
metrics = {
    'HTML inline styles': html.count('style="'),
    'HTML inline event handlers': len(re.findall(r'on(?:click|change|input|keypress)=', html)),
    'JS innerHTML uses': js.count('innerHTML'),
    'localStorage uses': js.count('localStorage'),
    'setInterval uses': js.count('setInterval'),
    'External HTTPS references': len(re.findall(r'https://[^\"\']+', html)),
    'CSS media queries': css.count('@media'),
}
funcs = re.findall(r'function\s+([A-Za-z0-9_]+)', js)
duplicates = sorted({f for f in funcs if funcs.count(f) > 1})
print('METRICS')
for k,v in metrics.items(): print(f'{k}: {v}')
print('\nDUPLICATE_FUNCTIONS')
for d in duplicates: print(d)
print('\nSCRIPT_TAGS')
for i,line in enumerate(html.splitlines(),1):
    if '<script' in line: print(f'{i}: {line.strip()}')
