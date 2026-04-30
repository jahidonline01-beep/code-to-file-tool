const fs = require('fs');
const path = require('path');

const root = __dirname;
const required = [
  'package.json',
  'main.js',
  'preload.js',
  'index.html',
  'styles.css',
  'app.js',
  'check-project.js',
  'icon.png',
  'icon.ico',
  '.github/workflows/windows-build.yml'
];

const forbidden = [
  '.github/workflows/build.yml'
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('BUILD CHECK FAILED');
  console.error('Missing required files: ' + missing.join(', '));
  process.exit(1);
}

const forbiddenFound = forbidden.filter((file) => fs.existsSync(path.join(root, file)));
if (forbiddenFound.length) {
  console.error('BUILD CHECK FAILED');
  console.error('Remove unused workflow files: ' + forbiddenFound.join(', '));
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.name !== 'code-to-file-tools') {
  console.error('BUILD CHECK FAILED');
  console.error('package.json name must be code-to-file-tools');
  process.exit(1);
}

if (!pkg.build || !pkg.build.win || pkg.build.win.icon !== 'icon.ico') {
  console.error('BUILD CHECK FAILED');
  console.error('package.json build.win.icon must be icon.ico');
  process.exit(1);
}

if (!Array.isArray(pkg.build.files) || !pkg.build.files.includes('icon.ico') || !pkg.build.files.includes('icon.png')) {
  console.error('BUILD CHECK FAILED');
  console.error('package.json build.files must include icon.ico and icon.png');
  process.exit(1);
}

const workflowFiles = fs.readdirSync(path.join(root, '.github', 'workflows')).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
if (workflowFiles.length !== 1 || workflowFiles[0] !== 'windows-build.yml') {
  console.error('BUILD CHECK FAILED');
  console.error('Only .github/workflows/windows-build.yml is allowed. Found: ' + workflowFiles.join(', '));
  process.exit(1);
}

console.log('BUILD CHECK PASSED');
console.log('Only windows-build.yml is used. Root-flat files are ready.');
