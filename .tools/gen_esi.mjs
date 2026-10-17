/**
 * 把 etg_doc/Slave/ESI_Example_Files 下的真实 ESI 示例解析成精简树，
 * 供 slave.html 在浏览器里渲染（避免浏览器端解析大文件 + 编码问题）。
 * 输出: assets/data/esi-examples.json
 */
import { XMLParser } from '../.tools/node_modules/fast-xml-parser/src/fxp.js';
import fs from 'node:fs';
import path from 'node:path';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  trimValues: true,
  isArray: () => false,
  parseAttributeValue: false,
  parseTagValue: false,
});

const SRC = 'etg_doc/Slave/ESI_Example_Files/ESI_Example_Files';
const KEEP_ATTRS = new Set([
  'Physics', 'ProductCode', 'RevisionNo', 'Revision', 'ProdCode', 'Type',
  'Sm', 'Pdo', 'PdoType', 'Index', 'SubIndex', 'BitLen', 'Name', 'LcId',
  'Fixed', 'Mandatory', 'Virtual', 'DependOnSlot', 'DependOnSlotGroup',
  'DefaultData', 'Data', 'StartAddress', 'DefaultSize', 'ControlByte',
  'Enable', 'Mailbox', 'PdoAssign', 'PdoConfig', 'PdoUpload', 'CompleteAccess',
  'Profile', 'Channel', 'SlotCount', 'SlotIndexIncrement', 'ModuleIdent',
  'Value', 'IndexIncrement', 'Obj', 'BitOffs', 'Vin', 'Rev', 'Serial',
]);
const MAX_CHILDREN = 90;
const MAX_DEPTH = 9;
const MAX_TEXT = 90;

function summarize(node, depth) {
  if (node == null) return null;
  if (typeof node !== 'object') {
    const t = String(node).replace(/\s+/g, ' ').trim();
    return t ? (t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) + '…' : t) : null;
  }
  const out = { n: node.__name || '', a: {}, c: [] };
  for (const [k, v] of Object.entries(node)) {
    if (k === '#text' || k === '__name' || k === ':@') continue;
    if (k.startsWith('@')) {
      const name = k.slice(1);
      if (KEEP_ATTRS.has(name) && typeof v === 'string') out.a[name] = v;
    }
  }
  // 文本内容
  const txt = node['#text'];
  if (typeof txt === 'string') {
    const t = txt.replace(/\s+/g, ' ').trim();
    if (t && !/^[0-9A-F]{64,}$/i.test(t)) out.t = t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) + '…' : t;
  }
  if (depth < MAX_DEPTH) {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('@') || k === '#text' || k === '__name') continue;
      if (k === 'ImageData16x14' || k === 'ImageData') continue;
      const arr = Array.isArray(v) ? v : [v];
      for (const item of arr) {
        if (out.c.length >= MAX_CHILDREN) { out.more = true; break; }
        const s = summarize(tagWrap(k, item), depth + 1);
        if (s) out.c.push(s);
      }
    }
  }
  return out;
}

/** fast-xml-parser 不保留标签名，这里给每个节点注入 __name */
function tagWrap(name, node) {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    return { __name: name, ...node };
  }
  return { __name: name, '#text': node };
}

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.xml'));
const result = [];
for (const f of files.sort()) {
  const buf = fs.readFileSync(path.join(SRC, f));
  const text = buf.toString('latin1');           // 示例文件为 ISO-8859-1
  let parsed;
  try {
    parsed = parser.parse(text);
  } catch (e) {
    console.log('skip', f, e.message);
    continue;
  }
  const root = parsed.EtherCATInfo;
  if (!root) { console.log('skip (no root)', f); continue; }
  const vendorId = root.Vendor?.Id ?? '';
  const vendorName = root.Vendor?.Name ?? '';
  const devices = [];
  const descs = root.Descriptions?.Devices?.Device;
  const arr = Array.isArray(descs) ? descs : (descs ? [descs] : []);
  for (const d of arr) {
    const typeRaw = d.Type;
    const type = Array.isArray(typeRaw) ? (typeRaw[0] || {}) : (typeRaw || {});
    const nameRaw = d.Name;
    const namePick = Array.isArray(nameRaw)
      ? (nameRaw.find(n => n && n['@LcId'] === '1033') || nameRaw[0])
      : nameRaw;
    const name = namePick && typeof namePick === 'object' ? (namePick['#text'] || '') : (namePick || '');
    devices.push({
      name: String(name).slice(0, 80),
      productCode: type['@ProductCode'] || type.ProductCode || '',
      revision: type['@RevisionNo'] || type.RevisionNo || '',
      physics: d['@Physics'] || '',
      smCount: countTags(d, 'Sm'),
      typeText: type['#text'] || '',
      pdoCount: countTags(d, 'TxPdo') + countTags(d, 'RxPdo'),
      entryCount: countTags(d, 'Entry'),
      moduleCount: countTags(d, 'Module'),
      slotCount: countTags(d, 'Slot'),
    });
  }
  const tree = summarize(tagWrap('EtherCATInfo', root), 0);
  result.push({
    file: f,
    version: root['@Version'] || '',
    vendorId, vendorName,
    devices,
    tree,
  });
  console.log(f, '->', devices.length, 'devices,', JSON.stringify(tree).length, 'bytes json');
}

fs.mkdirSync('assets/data', { recursive: true });
fs.writeFileSync('assets/data/esi-examples.json', JSON.stringify(result));
console.log('written assets/data/esi-examples.json',
  (fs.statSync('assets/data/esi-examples.json').size / 1024).toFixed(1), 'KB');

function countTags(node, tag) {
  let n = 0;
  const walk = o => {
    if (o == null || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k === tag) n += Array.isArray(v) ? v.length : 1;
      if (typeof v === 'object') walk(v);
    }
  };
  walk(node);
  return n;
}
