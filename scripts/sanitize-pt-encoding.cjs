const fs = require('fs');
const files = ['data/tasks.json','data/runs.json','data/card-notes.json','data/conversations.json'];
const reps = [
  [/ï¿½|���|��+/g, ''],
  [/mem[^\\p{L}\\p{N}]{0,8}ria/giu, 'memória'],
  [/migra[^\\p{L}\\p{N}]{0,12}o/giu, 'migração'],
  [/execu[^\\p{L}\\p{N}]{0,12}o/giu, 'execução'],
  [/evid[^\\p{L}\\p{N}]{0,12}ncias/giu, 'evidências'],
  [/evid[^\\p{L}\\p{N}]{0,12}ncia/giu, 'evidência'],
  [/coment[^\\p{L}\\p{N}]{0,12}rios/giu, 'comentários'],
  [/integra[^\\p{L}\\p{N}]{0,12}o/giu, 'integração'],
  [/aprova[^\\p{L}\\p{N}]{0,12}o/giu, 'aprovação'],
  [/decis[^\\p{L}\\p{N}]{0,12}o/giu, 'decisão'],
  [/usu[^\\p{L}\\p{N}]{0,12}rio/giu, 'usuário'],
  [/regress[^\\p{L}\\p{N}]{0,12}o/giu, 'regressão'],
  [/autom[^\\p{L}\\p{N}]{0,12}tica/giu, 'automática'],
  [/obrigat[^\\p{L}\\p{N}]{0,12}rios/giu, 'obrigatórios'],
  [/r[^\\p{L}\\p{N}]{0,12}gido/giu, 'rígido'],
  [/sa[^\\p{L}\\p{N}]{0,12}da vazia/giu, 'saída vazia'],
];
function cleanString(s){ let t=s.normalize('NFC').replace(/[€�™¢¬£¦]/g,'').replace(/\uFFFD/g,''); for(const [re,to] of reps) t=t.replace(re,to); return t.replace(/\s{2,}/g,' ').trim(); }
function walk(v){ if(Array.isArray(v)) return v.map(walk); if(v&&typeof v==='object'){ for(const k of Object.keys(v)) v[k]=walk(v[k]); return v;} if(typeof v==='string') return cleanString(v); return v; }
for(const f of files){ if(!fs.existsSync(f)) continue; const raw=fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''); const obj=JSON.parse(raw); fs.writeFileSync(f, JSON.stringify(walk(obj),null,2), 'utf8'); console.log('sanitized',f);} 
