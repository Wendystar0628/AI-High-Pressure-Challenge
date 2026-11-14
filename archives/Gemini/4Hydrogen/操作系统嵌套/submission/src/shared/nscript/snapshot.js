// Graph-preserving JSON serialization for exact snapshot persistence (including shared/cyclic references)

export function serializeGraph(root) {
  const objToId = new WeakMap();
  const records = [];

  function encode(val) {
    if (val === null) return null;
    if (val === undefined) return { $u: 1 };
    const t = typeof val;
    if (t === 'number') {
      if (Number.isNaN(val)) return { $nan: 1 };
      if (!Number.isFinite(val)) return { $inf: val > 0 ? 1 : -1 };
      return val;
    }
    if (t === 'boolean' || t === 'string') return val;
    if (t !== 'object') return null;

    if (objToId.has(val)) {
      return { $ref: objToId.get(val) };
    }
    const id = records.length;
    objToId.set(val, id);

    if (Array.isArray(val)) {
      const rec = { t: 'a', d: [] };
      records.push(rec);
      for (let i = 0; i < val.length; i++) {
        rec.d.push(encode(val[i]));
      }
    } else {
      const rec = { t: 'o', d: {} };
      records.push(rec);
      const ks = Object.keys(val);
      for (let i = 0; i < ks.length; i++) {
        const k = ks[i];
        rec.d[k] = encode(val[k]);
      }
    }
    return { $ref: id };
  }

  const rootRef = encode(root);
  return JSON.stringify({ $snapGraph: 1, root: rootRef, records });
}

export function deserializeGraph(jsonStr) {
  const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  if (!parsed || !parsed.$snapGraph) return parsed;
  const instances = parsed.records.map((r) => (r.t === 'a' ? [] : {}));
  function decode(v) {
    if (v === null || typeof v !== 'object') return v;
    if (v.$u) return undefined;
    if (v.$nan) return NaN;
    if (v.$inf) return v.$inf > 0 ? Infinity : -Infinity;
    if (v.$ref !== undefined) return instances[v.$ref];
    return v;
  }
  for (let i = 0; i < parsed.records.length; i++) {
    const rec = parsed.records[i];
    const inst = instances[i];
    if (rec.t === 'a') {
      for (let j = 0; j < rec.d.length; j++) inst.push(decode(rec.d[j]));
    } else {
      const ks = Object.keys(rec.d);
      for (let j = 0; j < ks.length; j++) {
        const k = ks[j];
        inst[k] = decode(rec.d[k]);
      }
    }
  }
  return decode(parsed.root);
}
