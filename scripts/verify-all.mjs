import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('=== [HHG VERIFICATION GATE 1/3]: Static Type Checking (tsc --noEmit) ===');
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✓ TypeScript check PASSED (0 errors).\n');
} catch (e) {
  console.error('❌ TypeScript check FAILED!\n');
  process.exit(1);
}

console.log('=== [HHG VERIFICATION GATE 2/3]: Architectural Theme Token & Boundary Audit ===');
// Memeriksa bahwa tidak ada pelanggaran hardcoded dark background di komponen global
const appSrcPath = path.resolve('./src/App.tsx');
const appContent = fs.readFileSync(appSrcPath, 'utf8');

// Rules: Dilarang hardcode bg-slate-950/70 tanpa boundary adaptif pada surface & cards
const forbiddenPatterns = [
  { regex: /className="[^"]*bg-slate-950\/70[^"]*"/g, desc: "Hardcoded dark container (bg-slate-950/70) without theme adapter" },
  { regex: /className="[^"]*bg-slate-900\/60 border-slate-800[^"]*"/g, desc: "Hardcoded unselected dark card without light theme variant" }
];

let violations = 0;
for (const rule of forbiddenPatterns) {
  const matches = appContent.match(rule.regex);
  if (matches && matches.length > 0) {
    console.error(`❌ Pelanggaran Desain Terdeteksi: ${rule.desc} (${matches.length} kemunculan)`);
    violations += matches.length;
  }
}

if (violations > 0) {
  console.error(`\n❌ Total ${violations} pelanggaran batas arsitektur tema ditemukan. Tolong gunakan token tema atau hhg-* standard class!`);
  process.exit(1);
} else {
  console.log('✓ Theme Design System & Boundary Audit PASSED (100% Compliant).\n');
}

console.log('=== [HHG VERIFICATION GATE 3/3]: Production Vite Bundler Check ===');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✓ Vite build check PASSED.\n');
} catch (e) {
  console.error('❌ Vite build FAILED!\n');
  process.exit(1);
}

console.log('🎉 SELURUH PINTU PENGUJIAN PRE-BUILD LOLOS DENGAN SEMPURNA!');
process.exit(0);
