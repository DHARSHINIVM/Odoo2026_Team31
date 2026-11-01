import sys, re
sys.path.insert(0, 'backend')
from app.main import app

routes = set(r.path for r in app.routes if hasattr(r, 'path'))

with open('frontend/src/services/api.js', 'r', encoding='utf-8') as f:
    text = f.read()

mismatches = []
for line in text.splitlines():
    m = re.search(r"request\((?:'|`|\")([^'?`\"]+)", line)
    if m:
        path = m.group(1).split('?')[0].split('${')[0].strip()
        if not path.startswith('/api'):
            full_path = '/api' + path
        else:
            full_path = path
        # Check if full_path exists or if full_path is a prefix of any route
        matches = [r for r in routes if r == full_path or r.startswith(full_path + '/') or (full_path.endswith('/') and r.startswith(full_path))]
        if not matches:
            mismatches.append((full_path, line.strip()))

print(f"Total mismatched lines: {len(mismatches)}")
for fp, l in mismatches:
    print(f"  {fp}  -->  {l}")
