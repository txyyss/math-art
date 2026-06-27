export const SVG_NS = "http://www.w3.org/2000/svg";
export const SQRT3 = Math.sqrt(3);

export function cellKey(cell) {
  return `${cell.q},${cell.r}`;
}

export function addCells(a, b) {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function subCells(a, b) {
  return { q: a.q - b.q, r: a.r - b.r };
}

export function axialToPixel(cell, side) {
  return {
    x: SQRT3 * side * (cell.q + cell.r / 2),
    y: -1.5 * side * cell.r,
  };
}

export function rotate60(cell, times = 1) {
  let q = cell.q;
  let r = cell.r;
  const count = ((times % 6) + 6) % 6;
  for (let i = 0; i < count; i += 1) {
    const nextQ = -r;
    const nextR = q + r;
    q = nextQ;
    r = nextR;
  }
  return { q, r };
}

export function reflectCell(cell) {
  return { q: cell.r, r: cell.q };
}

export function mirrorLeftRightCell(cell) {
  return { q: -cell.q - cell.r, r: cell.r };
}

export function normalizeCells(cells) {
  const minQ = Math.min(...cells.map((cell) => cell.q));
  const minR = Math.min(...cells.map((cell) => cell.r));
  return cells
    .map((cell) => ({ q: cell.q - minQ, r: cell.r - minR }))
    .sort((a, b) => a.q - b.q || a.r - b.r);
}

export function transformCells(cells, rotation, reflected) {
  return normalizeCells(
    cells.map((cell) => rotate60(reflected ? reflectCell(cell) : cell, rotation)),
  );
}

export function hexPolygonPoints(cx, cy, side) {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (30 + 60 * i);
    const x = cx + side * Math.cos(angle);
    const y = cy - side * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
}

export function svgElement(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, String(value));
    }
  }
  return element;
}

export function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
