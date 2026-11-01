const fs = require('fs');
const path = require('path');
const parser = require(path.resolve('frontend/node_modules/@babel/parser'));
const traverse = require(path.resolve('frontend/node_modules/@babel/traverse')).default;

const srcDir = path.resolve('frontend/src');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = getFiles(srcDir);
console.log(`Checking ${files.length} frontend files...`);

let totalIssues = 0;

files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
  } catch (err) {
    console.error(`Syntax Error in ${file}:`, err.message);
    totalIssues++;
    return;
  }

  try {
    traverse(ast, {
      ReferencedIdentifier(identPath) {
        const name = identPath.node.name;
        const standardGlobals = new Set([
          'window', 'document', 'console', 'fetch', 'setTimeout', 'clearTimeout',
          'setInterval', 'clearInterval', 'localStorage', 'sessionStorage',
          'URL', 'URLSearchParams', 'FormData', 'File', 'Blob', 'FileReader',
          'Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number',
          'Boolean', 'Promise', 'Error', 'parseInt', 'parseFloat', 'isNaN',
          'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'navigator',
          'alert', 'confirm', 'prompt', 'Intl', 'BarcodeDetector', 'Image', 'React'
        ]);

        if (standardGlobals.has(name)) return;

        if (identPath.parentPath.isMemberExpression() && identPath.parentPath.node.property === identPath.node && !identPath.parentPath.node.computed) {
          return;
        }

        if (!identPath.scope.hasBinding(name)) {
          console.log(`[UNDEFINED] ${path.relative(process.cwd(), file)}:${identPath.node.loc?.start?.line} - '${name}' is not defined`);
          totalIssues++;
        }
      }
    });
  } catch (e) {
    console.error(`Traverse error in ${file}:`, e.message);
  }
});

console.log(`Frontend check complete. Total issues: ${totalIssues}`);
