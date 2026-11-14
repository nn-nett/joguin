// Grade espacial uniforme (listas encadeadas em typed arrays, sem alocação por frame).
export function createGrid(minX, maxX, minZ, maxZ, cell, capacity = 512) {
  const inv = 1 / cell;
  const cols = Math.max(1, Math.ceil((maxX - minX) * inv));
  const rows = Math.max(1, Math.ceil((maxZ - minZ) * inv));
  const head = new Int32Array(cols * rows).fill(-1);
  let next = new Int32Array(capacity);

  function cellX(x) {
    let c = Math.floor((x - minX) * inv);
    return c < 0 ? 0 : c >= cols ? cols - 1 : c;
  }
  function cellZ(z) {
    let c = Math.floor((z - minZ) * inv);
    return c < 0 ? 0 : c >= rows ? rows - 1 : c;
  }

  function clear() {
    head.fill(-1);
  }

  function insert(i, x, z) {
    if (i >= next.length) {
      const n = new Int32Array(Math.max(next.length * 2, i + 1));
      n.set(next);
      next = n;
    }
    const c = cellZ(z) * cols + cellX(x);
    next[i] = head[c];
    head[c] = i;
  }

  // Visita a célula de (x,z) e as 8 vizinhas. cb(i) retornando true interrompe a busca.
  function query(x, z, cb) {
    const cx = cellX(x);
    const cz = cellZ(z);
    const x0 = cx > 0 ? cx - 1 : 0;
    const x1 = cx < cols - 1 ? cx + 1 : cols - 1;
    const z0 = cz > 0 ? cz - 1 : 0;
    const z1 = cz < rows - 1 ? cz + 1 : rows - 1;
    for (let zz = z0; zz <= z1; zz++) {
      const base = zz * cols;
      for (let xx = x0; xx <= x1; xx++) {
        for (let i = head[base + xx]; i !== -1; i = next[i]) {
          if (cb(i) === true) return true;
        }
      }
    }
    return false;
  }

  return { clear, insert, query, forNeighbors: query, cols, rows };
}
