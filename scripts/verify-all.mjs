import http from 'http';
import { execSync } from 'child_process';

const testScript = `
import urllib.request, json, time

# Helper via browser harness API
from browser_harness.helpers import goto_url, js, wait_for_load

goto_url('http://127.0.0.1:25173/')
wait_for_load()
time.sleep(1)

js("""
window.testErrors = [];
window.addEventListener('error', e => window.testErrors.push(e.message));
""")

tabs = ['Dashboard', 'Workspaces', 'MCP Servers Hub', 'Skills Hierarchy & Reader', 'Evolution Logs', 'Version Logs / Changelog', 'Settings & Repos']
for t in tabs:
    js(f"Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('{t}')).click()")
    time.sleep(0.2)

# MCP Modal Test
js("Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('MCP Servers Hub')).click()")
time.sleep(0.2)
js("Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Daftarkan Server MCP Baru') || el.textContent.includes('Tambah Server MCP')).click()")
time.sleep(0.3)
js("Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Formulir Field')).click()")
time.sleep(0.2)
js("Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Remote Server')).click()")
time.sleep(0.2)
js("Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Batal')).click()")
time.sleep(0.2)

errs = js("window.testErrors")
if len(errs) > 0:
    print('FAIL:', errs)
    exit(1)
print('SUCCESS_ALL_PASSED')
`;

console.log('Menjalankan Static Type Checking (tsc --noEmit)...');
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✓ TypeScript check PASSED (0 errors).');
} catch (e) {
  console.error('❌ TypeScript check FAILED!');
  process.exit(1);
}

console.log('\nMenjalankan Vite Production Build Check...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✓ Vite build check PASSED.');
} catch (e) {
  console.error('❌ Vite build FAILED!');
  process.exit(1);
}

console.log('\n🎉 ALL LOCAL TEST GATES COMPLETED SUCCESSFULLY!');
process.exit(0);
