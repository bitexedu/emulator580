// SOLVE phải cho cùng trạng thái khi chỉ nạp Engine hoặc khi nạp đủ các
// mô-đun tính toán của ứng dụng. Không chốt đáp số theo một chính sách cũ:
// khi thuật toán CASIO đổi, hai đường vẫn phải thống nhất.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = process.env.BITEX_TEST_ROOT || __dirname;
const appFiles = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .matchAll(/<script src="([^"]+)"/g)].map(m => m[1])
  .filter(f => !['ui.js', 'feedback.js', 'keypad.js', 'keyboard.js', 'app.js'].includes(f));
function runtime(files) {
  const context = vm.createContext({ console });
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return context;
}
function solve(context, expression, seed) {
  context.input = { expression, seed };
  return vm.runInContext(`(() => {
    const en = createEngine(); en.inputFunction(input.expression); en.solve();
    for (const ch of input.seed) ch === '.' ? en.inputDot() : en.inputDigit(ch);
    en.equals(); en.equals();
    const s = en.getState();
    return JSON.stringify({ mode:s.mode, result:s.result, message:s.message,
      residual:s.residual, continue:s.continue, x:en.getVariables().x });
  })()`, context);
}
const standalone = runtime(['engine.js']), application = runtime(appFiles);
let failures = 0;
const cases = [
  ['logarithmic balance', 'logbase(2,x²-6x+19)=2logbase(2,x-3)', '0'],
  ['radical balance', '(x²+4x+6)√(x²+4x+5)=x^3+6x²+13x+10', '0'],
  ['finite logarithmic root', 'logbase(2,x²-6x+19)=2logbase(2,x-2)', '4'],
  ['repeated polynomial root', 'x^3+3x²+3x+1=0', '1'],
  ['bracketed unique cubic root', 'x(x²-2)+2=0', '1.03901617386351']
];
for (const [label, expression, seed] of cases) {
  const actual = solve(standalone, expression, seed), expected = solve(application, expression, seed);
  if (actual !== expected) { failures++; console.error('FAIL', label, { standalone:JSON.parse(actual), application:JSON.parse(expected) }); }
}
console.log('Engine isolation: '+cases.length+' checks | '+failures+' FAIL');
if (failures) process.exitCode = 1;
