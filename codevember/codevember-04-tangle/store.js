// The saved generations, in the browser's IndexedDB. A generation is saved
// with its whole skeleton, not just its seed, so it still looks the same once
// the algorithm has changed. export/import move them to a JSON file and back.
const DB = 'tangle', STORE = 'generations';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

const record = (gen, note = '') => ({
  date: Date.now(),
  note,
  seed: gen.seed,
  version: gen.version,
  quick: gen.quick,
  params: gen.params,
  stats: gen.stats,
  branches: gen.branches.map((b) => ({ parent: b.parent, points: b.points })),
});

export const save = (gen, note) => run('readwrite', (s) => s.add(record(gen, note)));
export const remove = (id) => run('readwrite', (s) => s.delete(id));
export const update = (item) => run('readwrite', (s) => s.put(item));
export const list = async () => (await run('readonly', (s) => s.getAll())).sort((a, b) => b.date - a.date);
export const get = (id) => run('readonly', (s) => s.get(id));

export async function exportAll() {
  const items = await list();
  const json = JSON.stringify(items.map((it) => ({
    ...it,
    branches: it.branches.map((b) => ({ parent: b.parent, points: Array.from(b.points, (v) => Math.round(v * 1e4) / 1e4) })),
  })));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `tangle-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

// adds the generations of a file exported before (those already there are skipped)
export async function importFile(file) {
  const items = JSON.parse(await file.text());
  const have = new Set((await list()).map((it) => `${it.date}/${it.seed}`));
  let n = 0;
  for (const it of items) {
    if (have.has(`${it.date}/${it.seed}`)) continue;
    const { id, ...rest } = it;
    rest.branches = rest.branches.map((b) => ({ parent: b.parent, points: new Float32Array(b.points) }));
    await run('readwrite', (s) => s.add(rest));
    n++;
  }
  return n;
}
