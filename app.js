const $ = (id) => document.getElementById(id);
const fileRows = $('fileRows');
let checked = false;
let rowId = 0;

function normalizeName(name){
  name = String(name || '').trim().replace(/\\/g,'/').replace(/^\/+/, '');
  return name || `file_${Date.now()}.txt`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function setNotChecked(){checked=false;$('downloadBtn').disabled=true;}

function createRow(name='', code=''){
  const id = ++rowId;
  const row = document.createElement('div');
  row.className = 'file-row';
  row.dataset.id = id;
  row.innerHTML = `
    <div class="row-top">
      <input class="file-name" placeholder="filename.ext" value="${escapeHtml(name)}">
      <button class="btn small clear-one">Clear</button>
      <button class="btn small danger delete-one">Delete</button>
    </div>
    <textarea class="file-code" spellcheck="false" placeholder="Paste code here">${escapeHtml(code)}</textarea>
  `;
  row.querySelector('.clear-one').onclick = () => { row.querySelector('.file-code').value=''; setNotChecked(); updatePreviewList(); };
  row.querySelector('.delete-one').onclick = () => { row.remove(); setNotChecked(); updatePreviewList(); };
  row.querySelector('.file-name').addEventListener('input', () => { setNotChecked(); updatePreviewList(); });
  row.querySelector('.file-code').addEventListener('input', () => { setNotChecked(); updateCodePreview(); });
  fileRows.appendChild(row);
  updatePreviewList();
  return row;
}
function getEntries(){
  const rows = [...document.querySelectorAll('.file-row')];
  const map = new Map();
  for(const row of rows){
    const name = normalizeName(row.querySelector('.file-name').value);
    const content = row.querySelector('.file-code').value || '';
    if(name && content.trim()) map.set(name, {name, content});
  }
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function updatePreviewList(){
  const select = $('previewSelect');
  const prev = select.value;
  const entries = getEntries();
  $('fileCount').textContent = entries.length;
  select.innerHTML = '';
  for(const f of entries){
    const opt = document.createElement('option'); opt.value=f.name; opt.textContent=f.name; select.appendChild(opt);
  }
  if([...select.options].some(o=>o.value===prev)) select.value=prev;
  updateCodePreview();
}
function updateCodePreview(){
  const entries = getEntries();
  const selected = $('previewSelect').value || entries[0]?.name;
  const file = entries.find(f=>f.name===selected);
  $('codePreview').textContent = file ? file.content : '';
}
function addOrUpdateFile(name, content){
  name = normalizeName(name);
  const rows = [...document.querySelectorAll('.file-row')];
  const existing = rows.find(r => normalizeName(r.querySelector('.file-name').value) === name);
  if(existing){ existing.querySelector('.file-code').value = content; }
  else createRow(name, content);
  setNotChecked();
  updatePreviewList();
}

function langToExt(lang){
  lang = String(lang || '').toLowerCase().trim();
  return ({html:'html',css:'css',js:'js',javascript:'js',json:'json',python:'py',py:'py',yaml:'yml',yml:'yml',xml:'xml',java:'java',kt:'kt',kotlin:'kt',ts:'ts',typescript:'ts'})[lang] || 'txt';
}
function guessFileName(code, index=1){
  const t = code.trim().toLowerCase();
  if(t.includes('<!doctype') || t.includes('<html')) return 'index.html';
  if(t.startsWith('{') && (t.includes('"scripts"') || t.includes('"dependencies"') || t.includes('"devdependencies"'))) return 'package.json';
  if(t.includes('const { app, browserwindow') || t.includes('require(\'electron\')') || t.includes('require("electron")')) return 'main.js';
  if(t.includes('body{') || t.includes('@media') || t.includes('background:') && t.includes('{')) return 'styles.css';
  if(t.includes('def ') || t.includes('import os') || t.includes('zipfile')) return `script_${index}.py`;
  if(t.includes('function ') || t.includes('const ') || t.includes('document.getelementbyid')) return 'app.js';
  return `file_${index}.txt`;
}
function parsePythonGenerator(text){
  const out=[];
  const dictMatch = text.match(/files_to_generate\s*=\s*\{([\s\S]*?)\n\s*\}/);
  if(!dictMatch) return out;
  const body = dictMatch[1];
  const re = /["']([^"']+)["']\s*:\s*(?:r)?(["']{3})([\s\S]*?)\2\s*,?/g;
  let m;
  while((m=re.exec(body))) out.push({name:normalizeName(m[1]), content:m[3].trim()});
  return out;
}
function parseBulk(text){
  text = String(text || '');
  const found=[];

  found.push(...parsePythonGenerator(text));

  const marker = /^\s*(?:\/\/|#|<!--)?\s*FILE\s*:\s*([^\n\r>]+)\s*(?:-->)?\s*$/gmi;
  const marks=[...text.matchAll(marker)];
  if(marks.length){
    marks.forEach((m,i)=>{
      const start=m.index+m[0].length;
      const end=i+1<marks.length?marks[i+1].index:text.length;
      found.push({name:normalizeName(m[1]), content:text.slice(start,end).trim()});
    });
  }

  const fence = /```([\w+-]*)\s*(?:filename=|file=)?([^\n`]*)\n([\s\S]*?)```/g;
  let fm, n=1;
  while((fm=fence.exec(text))){
    let name = normalizeName(fm[2]);
    if(!name || name.includes(' ') || !name.includes('.')) name = `imported_${n}.${langToExt(fm[1])}`;
    found.push({name, content:fm[3].trim()}); n++;
  }

  if(!found.length && text.trim()){
    found.push({name:guessFileName(text,1), content:text.trim()});
  }
  const map = new Map();
  for(const f of found){ if(f.content && f.content.trim()) map.set(normalizeName(f.name), f); }
  return [...map.values()];
}

$('addFileBtn').onclick = () => { createRow('', ''); setNotChecked(); };
$('clearAllBtn').onclick = () => { fileRows.innerHTML=''; $('bulkInput').value=''; $('indexFrame').srcdoc=''; setNotChecked(); updatePreviewList(); };
$('previewSelect').onchange = updateCodePreview;

$('fileInput').onchange = async (e) => {
  const picked = [...e.target.files];
  for(const file of picked){
    try{
      const text = await file.text();
      addOrUpdateFile(file.webkitRelativePath || file.name, text);
    }catch(err){
      addOrUpdateFile(file.name, `Read error: ${err.message}`);
    }
  }
};

$('checkBtn').onclick = () => {
  const bulk = $('bulkInput').value.trim();
  if(bulk){
    const parsed = parseBulk(bulk);
    parsed.forEach(f => addOrUpdateFile(f.name, f.content));
    $('bulkInput').value = '';
  }
  const entries = getEntries();
  checked = entries.length > 0;
  $('downloadBtn').disabled = !checked;
  updatePreviewList();
  updateCodePreview();
};

$('previewIndexBtn').onclick = () => {
  const entries = getEntries();
  const index = entries.find(f => f.name.toLowerCase() === 'index.html');
  $('indexFrame').srcdoc = index ? index.content : '<!doctype html><html><body style="font-family:Arial;padding:24px"><h2>index.html not found</h2></body></html>';
};

$('downloadBtn').onclick = async () => {
  if(!checked) return;
  const entries = getEntries();
  if(!entries.length) return;
  const blob = await makeZip(entries);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Generated_Flat_Project_GitHub_Ready.zip';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
};

async function makeZip(fileEntries){
  const encoder = new TextEncoder();
  const chunks=[]; const central=[]; let offset=0;
  for(const f of fileEntries){
    const nameBytes=encoder.encode(f.name); const data=encoder.encode(f.content); const crc=crc32(data); const size=data.length;
    const local=new Uint8Array(30+nameBytes.length); const v=new DataView(local.buffer);
    v.setUint32(0,0x04034b50,true); v.setUint16(4,20,true); v.setUint16(6,0x0800,true); v.setUint16(8,0,true);
    v.setUint16(10,0,true); v.setUint16(12,0,true); v.setUint32(14,crc,true); v.setUint32(18,size,true); v.setUint32(22,size,true);
    v.setUint16(26,nameBytes.length,true); v.setUint16(28,0,true); local.set(nameBytes,30);
    chunks.push(local,data);
    const cent=new Uint8Array(46+nameBytes.length); const c=new DataView(cent.buffer);
    c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0x0800,true); c.setUint16(10,0,true);
    c.setUint16(12,0,true); c.setUint16(14,0,true); c.setUint32(16,crc,true); c.setUint32(20,size,true); c.setUint32(24,size,true);
    c.setUint16(28,nameBytes.length,true); c.setUint16(30,0,true); c.setUint16(32,0,true); c.setUint16(34,0,true); c.setUint16(36,0,true);
    c.setUint32(38,0,true); c.setUint32(42,offset,true); cent.set(nameBytes,46);
    central.push(cent); offset += local.length + data.length;
  }
  const centralStart=offset; central.forEach(x=>{chunks.push(x); offset+=x.length;});
  const end=new Uint8Array(22); const e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true); e.setUint16(8,central.length,true); e.setUint16(10,central.length,true);
  e.setUint32(12,offset-centralStart,true); e.setUint32(16,centralStart,true); chunks.push(end);
  return new Blob(chunks,{type:'application/zip'});
}
function crc32(data){let c=~0;for(let i=0;i<data.length;i++){c^=data[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}

createRow('index.html','');
updatePreviewList();
