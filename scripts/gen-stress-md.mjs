// Generates a very long, realistic Markdown document for performance testing.
// Usage: node scripts/gen-stress-md.mjs [sections] > out.md
import { stdout } from 'node:process';

const sections = Number(process.argv[2] ?? 220);

const WORDS = (
  'markdown editor performance rendering decoration viewport cursor selection ' +
  'heading paragraph emphasis blockquote palette terracotta warm reading writing ' +
  'incremental syntax tree lezer codemirror svelte tauri reactive runes compartment'
).split(' ');

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const sentence = (n = 12) => {
  const w = Array.from({ length: n }, () => pick(WORDS));
  // sprinkle inline formatting
  if (rand() < 0.5) w[2] = `**${w[2]}**`;
  if (rand() < 0.4) w[5] = `*${w[5]}*`;
  if (rand() < 0.3) w[8] = `\`${w[8]}\``;
  const s = w.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
};
const para = (lines = 3) => Array.from({ length: lines }, () => sentence(10 + Math.floor(rand() * 8))).join(' ');

const out = [];
out.push('---');
out.push('title: Mark Stress Test');
out.push('generated: true');
out.push('---');
out.push('');
out.push('# Mark — Live Preview Stress Test');
out.push('');
out.push('A deliberately large document to exercise scrolling, mode switching, and');
out.push('typing latency in **Read**, **Live**, and **Source** views.');
out.push('');

for (let i = 1; i <= sections; i++) {
  out.push(`## Section ${i}: ${pick(WORDS)} ${pick(WORDS)}`);
  out.push('');
  out.push(para(3));
  out.push('');
  out.push(`### ${i}.1 ${pick(WORDS)}`);
  out.push('');
  out.push(para(2));
  out.push('');
  out.push('- ' + sentence(8));
  out.push('- ' + sentence(7));
  out.push('- ' + sentence(9));
  out.push('');
  out.push('> ' + sentence(14));
  out.push('');
  if (i % 5 === 0) {
    out.push('```js');
    out.push(`function section${i}(x) {`);
    out.push('  // a representative code block');
    out.push(`  return x * ${i} + ${Math.floor(rand() * 100)};`);
    out.push('}');
    out.push('```');
    out.push('');
  }
  if (i % 7 === 0) {
    out.push('| Name | Value | Note |');
    out.push('|------|-------|------|');
    out.push(`| ${pick(WORDS)} | ${i} | ${sentence(4)} |`);
    out.push(`| ${pick(WORDS)} | ${i * 2} | ${sentence(4)} |`);
    out.push('');
  }
}

stdout.write(out.join('\n') + '\n');
