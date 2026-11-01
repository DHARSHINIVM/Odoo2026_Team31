import os
import sys
import importlib
import traceback

sys.path.insert(0, os.path.abspath('backend'))

app_dir = os.path.abspath('backend/app')

modules_found = []
for root, dirs, files in os.walk(app_dir):
    for f in files:
        if f.endswith('.py'):
            rel_path = os.path.relpath(os.path.join(root, f), 'backend')
            mod_name = rel_path.replace(os.sep, '.')[:-3]
            if mod_name.endswith('.__init__'):
                mod_name = mod_name[:-9]
            modules_found.append((mod_name, os.path.join(root, f)))

print(f"Total modules to check: {len(modules_found)}")

import_errors = []
for mod_name, file_path in modules_found:
    try:
        importlib.import_module(mod_name)
    except Exception as e:
        import_errors.append((mod_name, file_path, str(e), traceback.format_exc()))

print(f"\nImport failures: {len(import_errors)}")
for mod, path, err, tb in import_errors:
    print(f"\n[-] {mod} ({path}):\n    Error: {err}")

