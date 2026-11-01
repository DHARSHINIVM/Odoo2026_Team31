import ast
import os
import sys

def analyze_python_file(filepath):
    issues = []
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    try:
        tree = ast.parse(content, filename=filepath)
    except SyntaxError as e:
        issues.append((filepath, e.lineno, f"SyntaxError: {e.msg}"))
        return issues

    # Duplicate functions
    defined_funcs = {}
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name in defined_funcs:
                prev_line = defined_funcs[node.name]
                issues.append((filepath, node.lineno, f"Duplicate function definition '{node.name}' (previously defined on line {prev_line})"))
            else:
                defined_funcs[node.name] = node.lineno

    class ScopeVisitor(ast.NodeVisitor):
        def __init__(self):
            self.scopes = [{}]
            self.undefined = []

        def add_name(self, name, lineno):
            self.scopes[-1][name] = lineno

        def visit_Import(self, node):
            for alias in node.names:
                name = alias.asname or alias.name
                self.add_name(name.split('.')[0], node.lineno)
                if alias.asname:
                    self.add_name(alias.asname, node.lineno)
            self.generic_visit(node)

        def visit_ImportFrom(self, node):
            for alias in node.names:
                name = alias.asname or alias.name
                self.add_name(name, node.lineno)
            self.generic_visit(node)

        def visit_FunctionDef(self, node):
            self.add_name(node.name, node.lineno)
            new_scope = {}
            for arg in node.args.posonlyargs + node.args.args + node.args.kwonlyargs:
                new_scope[arg.arg] = node.lineno
            if node.args.vararg:
                new_scope[node.args.vararg.arg] = node.lineno
            if node.args.kwarg:
                new_scope[node.args.kwarg.arg] = node.lineno
            self.scopes.append(new_scope)
            for d in node.decorator_list:
                self.visit(d)
            for b in node.body:
                self.visit(b)
            self.scopes.pop()

        def visit_AsyncFunctionDef(self, node):
            self.visit_FunctionDef(node)

        def visit_ClassDef(self, node):
            self.add_name(node.name, node.lineno)
            self.scopes.append({})
            for b in node.body:
                self.visit(b)
            self.scopes.pop()

        def visit_ListComp(self, node):
            self.scopes.append({})
            for gen in node.generators:
                self.visit(gen)
            self.visit(node.elt)
            self.scopes.pop()

        def visit_SetComp(self, node):
            self.scopes.append({})
            for gen in node.generators:
                self.visit(gen)
            self.visit(node.elt)
            self.scopes.pop()

        def visit_DictComp(self, node):
            self.scopes.append({})
            for gen in node.generators:
                self.visit(gen)
            self.visit(node.key)
            self.visit(node.value)
            self.scopes.pop()

        def visit_GeneratorExp(self, node):
            self.scopes.append({})
            for gen in node.generators:
                self.visit(gen)
            self.visit(node.elt)
            self.scopes.pop()

        def visit_ExceptHandler(self, node):
            if node.name:
                self.add_name(node.name, node.lineno)
            self.generic_visit(node)

        def visit_For(self, node):
            self.visit(node.target)
            self.visit(node.iter)
            for b in node.body:
                self.visit(b)
            for o in node.orelse:
                self.visit(o)

        def visit_AsyncFor(self, node):
            self.visit_For(node)

        def visit_Name(self, node):
            if isinstance(node.ctx, ast.Store):
                self.add_name(node.id, node.lineno)
            elif isinstance(node.ctx, ast.Load):
                found = False
                for s in reversed(self.scopes):
                    if node.id in s:
                        found = True
                        break
                import builtins
                if not found and not hasattr(builtins, node.id):
                    if node.id not in ('__file__', '__name__', '__doc__', '__path__', '__cached__'):
                        self.undefined.append((node.lineno, node.id))

    visitor = ScopeVisitor()
    visitor.visit(tree)
    for lineno, name in visitor.undefined:
        issues.append((filepath, lineno, f"Undefined variable '{name}'"))

    return issues

all_issues = []
for folder in ['backend', 'scratch']:
    for root, dirs, files in os.walk(folder):
        if '__pycache__' in root or '.venv' in root or 'node_modules' in root:
            continue
        for f in files:
            if f.endswith('.py'):
                p = os.path.join(root, f)
                issues = analyze_python_file(p)
                for item in issues:
                    all_issues.append(item)

print(f"Total potential issues found: {len(all_issues)}")
for path, line, msg in all_issues:
    print(f"{path}:{line}: {msg}")
