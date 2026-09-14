import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../artifacts/havestory/src/admin-stability.css', import.meta.url), 'utf8');
function palette(selector) {
  const body = css.slice(css.indexOf(selector) + selector.length).split('}')[0];
  return Object.fromEntries([...body.matchAll(/--admin-([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)].map(([,name,...values]) => [name, values.map(Number)]));
}
function luminance([h,s,l]) {
  s /= 100; l /= 100;
  const a=s*Math.min(l,1-l);
  const rgb=[0,8,4].map(n=>{const k=(n+h/30)%12;const c=l-a*Math.max(-1,Math.min(k-3,9-k,1));return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
const light=palette('html[data-hs-admin-theme] {');
const dark={...light,...palette("html[data-hs-admin-theme='dark'] {")};
const pairs=[['ink','surface'],['muted','surface'],['muted','subtle'],['brand-ink','surface'],['brand-ink','brand-soft'],['success','success-soft'],['warning','warning-soft'],['danger','danger-soft'],['on-solid','brand'],['on-solid','success-solid'],['on-solid','warning-solid'],['on-solid','danger-solid']];
for(const [mode,colors] of Object.entries({light,dark})) test(`${mode} admin text and button pairs meet 4.5:1 contrast`,()=>{
  for(const [fg,bg] of pairs){const a=luminance(colors[fg]),b=luminance(colors[bg]);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5,`${fg} on ${bg}: ${ratio.toFixed(2)}`);}
});
test('canonical admin theme does not reintroduce important or legacy palette remapping',()=>{
 assert.doesNotMatch(css,/!important/);
 assert.doesNotMatch(css,/\.(?:text|bg|border)-(?:gray|slate|amber|violet)-\d/);
 const main=fs.readFileSync(new URL('../artifacts/havestory/src/main.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(main,/admin-(?:typography|ui-cleanup|icon-alignment)\.css/);
});
