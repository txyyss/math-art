import {
  addCells,
  axialToPixel,
  cellKey,
  distanceSquared,
  hexPolygonPoints,
  mirrorLeftRightCell,
  normalizeCells,
  subCells,
  svgElement,
  transformCells,
} from "./hex.js?v=20260627-pieceactions8";
import { CalendarSolver } from "./solver.js?v=20260628-traypack1";

const COLORS = [
  "#cf5c36",
  "#4f8a8b",
  "#f2b134",
  "#6d597a",
  "#2a9d8f",
  "#e76f51",
  "#577590",
  "#8ab17d",
  "#b56576",
];

const REGION_CLASS = {
  weekday: "weekday",
  month: "month",
  date: "date",
};

const HEX_DRAW_SCALE = 0.9;

const EDGE_NEIGHBORS = [
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: 1, r: 0 },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampToRange(value, min, max) {
  return min <= max ? clamp(value, min, max) : (min + max) / 2;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const TRAY_LAYOUTS = [
  { offset: { q: 2, r: 0 }, rotation: 0, reflected: false },
  { offset: { q: -3, r: 5 }, rotation: 5, reflected: false },
  { offset: { q: 0, r: 0 }, rotation: 0, reflected: false },
  { offset: { q: 3, r: 0 }, rotation: 2, reflected: false },
  { offset: { q: 1, r: 5 }, rotation: 5, reflected: false },
  { offset: { q: 4, r: 1 }, rotation: 0, reflected: true },
  { offset: { q: 3, r: 2 }, rotation: 0, reflected: false },
  { offset: { q: 4, r: 2 }, rotation: 1, reflected: true },
  { offset: { q: -2, r: 3 }, rotation: 0, reflected: false },
];

const DEFAULT_TRAY_LAYOUT = {
  offset: { q: 0, r: 0 },
  rotation: 0,
  reflected: false,
};

// Icons are inline SVG paths from Lucide static v1.21.0 (ISC).
// See ../THIRD_PARTY_NOTICES.md for license details.
const ICON_PATHS = {
  rotateLeft:
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  rotateRight:
    '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  flip:
    '<path d="m3 7 5 5-5 5V7"/><path d="m21 7-5 5 5 5V7"/><path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/>',
};

const ICONS = {
  rotateLeft: `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS.rotateLeft}</svg>`,
  rotateRight: `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS.rotateRight}</svg>`,
  flip: `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS.flip}</svg>`,
  solve:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>',
  reset:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
};

const WINDOW_REGIONS = ["month", "date", "weekday"];
const PIECE_ACTIONS = [
  { action: "rotate-left", label: "Rotate left", icon: "rotateLeft" },
  { action: "flip", label: "Flip", icon: "flip" },
  { action: "rotate-right", label: "Rotate right", icon: "rotateRight" },
];

function isWindowRegion(region) {
  return WINDOW_REGIONS.includes(region);
}

function makeCell(entry) {
  return { q: Number(entry.q), r: Number(entry.r) };
}

function shapeKey(cells) {
  return normalizeCells(cells)
    .map((cell) => `${cell.q},${cell.r}`)
    .join(";");
}

function hexVertices(cx, cy, side) {
  const vertices = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (30 + 60 * i);
    vertices.push({
      x: cx + side * Math.cos(angle),
      y: cy - side * Math.sin(angle),
    });
  }
  return vertices;
}

function pathPoint(point) {
  return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
}

function keyCoordinate(value) {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0.00" : rounded.toFixed(2);
}

function pointKey(point) {
  return `${keyCoordinate(point.x)},${keyCoordinate(point.y)}`;
}

function distanceSquaredPoints(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function orientedOutlineEdge(logicalStart, logicalEnd, outlineStart, outlineEnd) {
  const forward =
    distanceSquaredPoints(outlineStart, logicalStart) +
    distanceSquaredPoints(outlineEnd, logicalEnd);
  const backward =
    distanceSquaredPoints(outlineEnd, logicalStart) +
    distanceSquaredPoints(outlineStart, logicalEnd);
  return forward <= backward
    ? { start: outlineStart, end: outlineEnd }
    : { start: outlineEnd, end: outlineStart };
}

function outlineLineIntersection(previous, current) {
  const x1 = previous.outlineStart.x;
  const y1 = previous.outlineStart.y;
  const x2 = previous.outlineEnd.x;
  const y2 = previous.outlineEnd.y;
  const x3 = current.outlineStart.x;
  const y3 = current.outlineStart.y;
  const x4 = current.outlineEnd.x;
  const y4 = current.outlineEnd.y;
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 0.000001) {
    return null;
  }
  return {
    x:
      ((x1 * y2 - y1 * x2) * (x3 - x4) -
        (x1 - x2) * (x3 * y4 - y3 * x4)) /
      denominator,
    y:
      ((x1 * y2 - y1 * x2) * (y3 - y4) -
        (y1 - y2) * (x3 * y4 - y3 * x4)) /
      denominator,
  };
}

export class HexCalendarGame {
  constructor(root, data) {
    this.root = root;
    this.data = data;
    this.cells = data.board.cells.map((entry) => ({
      ...entry,
      q: Number(entry.q),
      r: Number(entry.r),
      key: `${entry.q},${entry.r}`,
    }));
    this.cellByKey = new Map(this.cells.map((cell) => [cell.key, cell]));
    this.selectedWindow = {
      month: null,
      date: null,
      weekday: null,
    };
    this.selectedId = null;
    this.actionToolbarPlacement = null;
    this.drag = null;
    this.suppressedPieceClick = null;
    this.layout = null;
    this.pieces = data.pieces.map((piece, index) => {
      const trayLayout = TRAY_LAYOUTS[index] ?? DEFAULT_TRAY_LAYOUT;
      return {
        id: index,
        name: piece.name,
        baseCells: piece.cells.map(makeCell),
        color: COLORS[index % COLORS.length],
        rotation: trayLayout.rotation,
        reflected: trayLayout.reflected,
        homeRotation: trayLayout.rotation,
        homeReflected: trayLayout.reflected,
        onBoard: false,
        offset: { q: 0, r: 0 },
        freeX: 0,
        freeY: 0,
        homeX: 0,
        homeY: 0,
      };
    });
    this.solver = new CalendarSolver(this.cells, this.pieces);
    this.selectToday();

    this.mount();
    this.computeLayout({ resetFreePieces: true });
    this.render();
    window.addEventListener("resize", () => {
      this.actionToolbarPlacement = null;
      this.computeLayout({ resetFreePieces: true });
      this.render();
    });
  }

  mount() {
    this.root.innerHTML = `
      <main class="app-shell">
        <section class="control-strip" aria-label="Puzzle controls">
          <div class="tool-controls">
            <button type="button" data-action="reset" title="Reset all pieces" aria-label="Reset all pieces">${ICONS.reset}</button>
            <button type="button" data-action="solve" title="Solve" aria-label="Solve current date">${ICONS.solve}</button>
          </div>
        </section>
        <section class="game-surface">
          <svg id="game-svg" role="application" aria-label="Hex calendar puzzle"></svg>
        </section>
      </main>
    `;

    this.svg = this.root.querySelector("#game-svg");
    const toolControls = this.root.querySelector(".tool-controls");
    let handledPointerAction = null;
    toolControls.addEventListener("pointerup", (event) => {
      const button = event.target.closest("button[data-action]");
      if (button) {
        event.preventDefault();
        handledPointerAction = {
          action: button.dataset.action,
          until: event.timeStamp + 700,
        };
        button.blur();
        this.handleAction(button.dataset.action);
      }
    });
    toolControls.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }
      if (
        handledPointerAction?.action === button.dataset.action &&
        event.timeStamp <= handledPointerAction.until
      ) {
        event.preventDefault();
        handledPointerAction = null;
        return;
      }
      button.blur();
      this.handleAction(button.dataset.action);
    });
    this.svg.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    this.svg.addEventListener("pointerup", (event) => this.handlePointerEnd(event));
    this.svg.addEventListener("pointercancel", (event) => this.handlePointerEnd(event));
    this.svg.addEventListener("click", (event) => this.handleCanvasClick(event));
  }

  selectToday() {
    const today = new Date();
    this.selectWindowByLabel("month", MONTH_LABELS[today.getMonth()]);
    this.selectWindowByLabel("date", String(today.getDate()));
    this.selectWindowByLabel("weekday", WEEKDAY_LABELS[today.getDay()]);
  }

  selectWindowByLabel(region, label) {
    const cell = this.cells.find((entry) => entry.region === region && entry.label === label);
    if (cell) {
      this.selectedWindow[region] = cell.key;
    }
  }

  selectWindowCell(cell) {
    if (!isWindowRegion(cell.region)) {
      return false;
    }
    this.selectedWindow[cell.region] = cell.key;
    return true;
  }

  selectPiece(pieceId, { resetActions = this.selectedId !== pieceId } = {}) {
    if (resetActions) {
      this.actionToolbarPlacement = null;
    }
    this.selectedId = pieceId;
  }

  clearSelection() {
    this.selectedId = null;
    this.actionToolbarPlacement = null;
  }

  visibleSvgBounds() {
    const surface = this.svg?.parentElement;
    if (!surface || !this.svg) {
      return {
        minX: 0,
        maxX: this.layout.width,
        minY: 0,
        maxY: this.layout.height,
      };
    }
    const surfaceRect = surface.getBoundingClientRect();
    const svgRect = this.svg.getBoundingClientRect();
    const scaleX = this.layout.width / Math.max(svgRect.width, 1);
    const scaleY = this.layout.height / Math.max(svgRect.height, 1);
    return {
      minX: clamp((surfaceRect.left - svgRect.left) * scaleX, 0, this.layout.width),
      maxX: clamp((surfaceRect.right - svgRect.left) * scaleX, 0, this.layout.width),
      minY: clamp((surfaceRect.top - svgRect.top) * scaleY, 0, this.layout.height),
      maxY: clamp((surfaceRect.bottom - svgRect.top) * scaleY, 0, this.layout.height),
    };
  }

  computeLayout({ resetFreePieces = false } = {}) {
    const surfaceRect = this.svg?.parentElement?.getBoundingClientRect();
    const availableWidth = Math.max(0, surfaceRect?.width ?? window.innerWidth);
    const availableHeight = Math.max(0, surfaceRect?.height ?? window.innerHeight - 70);
    const compact = availableWidth < 820;
    const baseSide = compact ? 27 : 30;
    const baseTrayMargin = compact ? 34 : 46;
    const baseGap = compact ? 40 : 70;
    const basePadding = compact ? 16 : 48;
    const baseBoardBounds = this.boardLocalBounds(baseSide);
    const baseTrayBounds = this.trayLocalBounds(baseSide, baseTrayMargin);
    const baseNaturalWidth = compact
      ? Math.max(baseBoardBounds.width, baseTrayBounds.width) + basePadding * 2
      : baseBoardBounds.width + baseGap + baseTrayBounds.width + basePadding * 2;
    const baseNaturalHeight = compact
      ? baseBoardBounds.height + baseGap + baseTrayBounds.height + basePadding * 2
      : Math.max(baseBoardBounds.height, baseTrayBounds.height) + basePadding * 2;
    const fitScale = compact
      ? availableWidth / baseNaturalWidth
      : Math.min(
          availableWidth / baseNaturalWidth,
          availableHeight / baseNaturalHeight,
        );
    const scale = compact ? clamp(fitScale, 0.68, 1.25) : clamp(fitScale, 0.9, 2.05);
    const side = baseSide * scale;
    const boardBounds = this.boardLocalBounds(side);
    const trayMargin = baseTrayMargin * scale;
    const trayBounds = this.trayLocalBounds(side, trayMargin);
    let gap = baseGap * scale;
    const padding = basePadding * scale;

    const naturalWidth = compact
      ? Math.max(boardBounds.width, trayBounds.width) + padding * 2
      : boardBounds.width + gap + trayBounds.width + padding * 2;
    const naturalHeight = compact
      ? boardBounds.height + trayBounds.height + padding * 3
      : Math.max(boardBounds.height, trayBounds.height) + padding * 2;
    const width = Math.max(availableWidth, naturalWidth);
    const height = Math.max(availableHeight, naturalHeight);

    let boardOrigin;
    let trayOrigin;
    if (compact) {
      gap = (height - boardBounds.height - trayBounds.height) / 3;
      const top = gap;
      boardOrigin = {
        x: (width - boardBounds.width) / 2 - boardBounds.x,
        y: top - boardBounds.y,
      };
      trayOrigin = {
        x: (width - trayBounds.width) / 2 - trayBounds.x,
        y: top + boardBounds.height + gap - trayBounds.y,
      };
    } else {
      const totalWidth = boardBounds.width + gap + trayBounds.width;
      const totalHeight = Math.max(boardBounds.height, trayBounds.height);
      const left = (width - totalWidth) / 2;
      const top = (height - totalHeight) / 2;
      boardOrigin = {
        x: left - boardBounds.x,
        y: top + (totalHeight - boardBounds.height) / 2 - boardBounds.y,
      };
      trayOrigin = {
        x: left + boardBounds.width + gap - trayBounds.x,
        y: top + (totalHeight - trayBounds.height) / 2 - trayBounds.y,
      };
    }

    this.layout = {
      compact,
      side,
      width,
      height,
      boardOrigin,
      tray: { origin: trayOrigin, margin: trayMargin },
    };
    this.svg?.setAttribute("viewBox", `0 0 ${this.layout.width} ${this.layout.height}`);
    this.boardCenters = this.cells.map((cell) => ({
      cell,
      ...this.boardPixel(cell),
    }));
    this.positionHomes(resetFreePieces);
  }

  boardLocalBounds(side) {
    return this.boundsForPoints(
      this.cells.map((cell) => axialToPixel(cell, side)),
      side * 1.2,
    );
  }

  trayLocalBounds(side, margin) {
    const points = [];
    for (const piece of this.pieces) {
      const { offset } = TRAY_LAYOUTS[piece.id] ?? DEFAULT_TRAY_LAYOUT;
      const anchor = addCells(this.anchorCell(piece), offset);
      const anchorPoint = axialToPixel(anchor, side);
      const anchorPixel = axialToPixel(this.anchorCell(piece), side);
      for (const cell of this.orientedCells(piece)) {
        const localPixel = axialToPixel(cell, side);
        points.push({
          x: anchorPoint.x + localPixel.x - anchorPixel.x,
          y: anchorPoint.y + localPixel.y - anchorPixel.y,
        });
      }
    }
    return this.boundsForPoints(points, margin);
  }

  boundsForPoints(points, margin) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs) - margin;
    const minY = Math.min(...ys) - margin;
    const maxX = Math.max(...xs) + margin;
    const maxY = Math.max(...ys) + margin;
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  positionHomes(resetFreePieces) {
    for (const piece of this.pieces) {
      const { offset } = TRAY_LAYOUTS[piece.id] ?? DEFAULT_TRAY_LAYOUT;
      const anchor = addCells(this.anchorCell(piece), offset);
      const point = axialToPixel(anchor, this.layout.side);
      piece.homeX = this.layout.tray.origin.x + point.x;
      piece.homeY = this.layout.tray.origin.y + point.y;
      if (resetFreePieces && !piece.onBoard) {
        piece.freeX = piece.homeX;
        piece.freeY = piece.homeY;
      }
    }
    this.trayBounds = this.homeTrayBounds();
  }

  homeTrayBounds() {
    const points = [];
    for (const piece of this.pieces) {
      const anchorPixel = this.localPixel(this.anchorCell(piece));
      for (const cell of this.orientedCells(piece)) {
        const localPixel = this.localPixel(cell);
        points.push({
          x: piece.homeX + localPixel.x - anchorPixel.x,
          y: piece.homeY + localPixel.y - anchorPixel.y,
        });
      }
    }
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const margin = this.layout.tray.margin;
    return {
      x: Math.min(...xs) - margin,
      y: Math.min(...ys) - margin,
      width: Math.max(...xs) - Math.min(...xs) + margin * 2,
      height: Math.max(...ys) - Math.min(...ys) + margin * 2,
    };
  }

  selectedWindowKeys() {
    return new Set(Object.values(this.selectedWindow).filter(Boolean));
  }

  targetCellCount() {
    return this.cells.length - this.selectedWindowKeys().size;
  }

  orientedCells(piece) {
    return transformCells(piece.baseCells, piece.rotation, piece.reflected);
  }

  anchorCell(piece) {
    return this.orientedCells(piece)[0];
  }

  boardPixel(cell) {
    const local = axialToPixel(cell, this.layout.side);
    return {
      x: this.layout.boardOrigin.x + local.x,
      y: this.layout.boardOrigin.y + local.y,
    };
  }

  localPixel(cell) {
    return axialToPixel(cell, this.layout.side);
  }

  localBounds(piece) {
    const anchor = this.anchorCell(piece);
    const anchorPixel = this.localPixel(anchor);
    const points = this.orientedCells(piece).map((cell) => {
      const point = this.localPixel(cell);
      return {
        x: point.x - anchorPixel.x,
        y: point.y - anchorPixel.y,
      };
    });
    return {
      minX: Math.min(...points.map((point) => point.x)),
      maxX: Math.max(...points.map((point) => point.x)),
      minY: Math.min(...points.map((point) => point.y)),
      maxY: Math.max(...points.map((point) => point.y)),
    };
  }

  absoluteCells(piece) {
    return this.orientedCells(piece).map((cell) => addCells(cell, piece.offset));
  }

  pieceAnchorPoint(piece) {
    if (piece.onBoard) {
      return this.boardPixel(addCells(this.anchorCell(piece), piece.offset));
    }
    return { x: piece.freeX, y: piece.freeY };
  }

  freeCellPoint(piece, localCell) {
    const anchorPixel = this.localPixel(this.anchorCell(piece));
    const localPixel = this.localPixel(localCell);
    return {
      x: piece.freeX + localPixel.x - anchorPixel.x,
      y: piece.freeY + localPixel.y - anchorPixel.y,
    };
  }

  loosePieceCenter(piece) {
    const points = this.orientedCells(piece).map((cell) => this.freeCellPoint(piece, cell));
    return {
      x: points.reduce((total, point) => total + point.x, 0) / points.length,
      y: points.reduce((total, point) => total + point.y, 0) / points.length,
    };
  }

  pieceVisualCenter(piece) {
    if (!piece.onBoard) {
      return this.loosePieceCenter(piece);
    }
    const points = this.absoluteCells(piece).map((cell) => this.boardPixel(cell));
    return {
      x: points.reduce((total, point) => total + point.x, 0) / points.length,
      y: points.reduce((total, point) => total + point.y, 0) / points.length,
    };
  }

  boardCenterForOffset(piece, offset) {
    const points = this.orientedCells(piece).map((cell) =>
      this.boardPixel(addCells(cell, offset)),
    );
    return {
      x: points.reduce((total, point) => total + point.x, 0) / points.length,
      y: points.reduce((total, point) => total + point.y, 0) / points.length,
    };
  }

  closestOffsetForCenter(piece, referenceCells, center) {
    const candidates = new Map();
    for (const referenceCell of referenceCells) {
      for (const localCell of this.orientedCells(piece)) {
        const offset = subCells(referenceCell, localCell);
        candidates.set(cellKey(offset), offset);
      }
    }

    let best = null;
    for (const offset of candidates.values()) {
      const candidateCenter = this.boardCenterForOffset(piece, offset);
      const distance = distanceSquared(candidateCenter, center);
      if (!best || distance < best.distance) {
        best = { offset, distance };
      }
    }
    return best?.offset ?? piece.offset;
  }

  useOrientationMatching(piece, targetCells) {
    const targetKey = shapeKey(targetCells);
    for (let reflected = 0; reflected <= 1; reflected += 1) {
      for (let rotation = 0; rotation < 6; rotation += 1) {
        const candidate = transformCells(piece.baseCells, rotation, reflected === 1);
        if (shapeKey(candidate) === targetKey) {
          piece.rotation = rotation;
          piece.reflected = reflected === 1;
          return;
        }
      }
    }
    throw new Error(`Could not find mirrored orientation for ${piece.name}`);
  }

  svgPoint(event) {
    const point = this.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  handlePointerDown(event, pieceId) {
    event.preventDefault();
    const piece = this.pieces[pieceId];
    this.selectPiece(pieceId, { resetActions: true });
    const pointer = this.svgPoint(event);
    const anchor = this.pieceAnchorPoint(piece);
    piece.freeX = anchor.x;
    piece.freeY = anchor.y;
    piece.onBoard = false;
    this.drag = {
      pieceId,
      pointerId: event.pointerId,
      dx: pointer.x - anchor.x,
      dy: pointer.y - anchor.y,
      startX: pointer.x,
      startY: pointer.y,
      moved: false,
    };
    try {
      this.svg.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events used by smoke tests do not create capturable pointers.
    }
    this.render();
  }

  handlePointerMove(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    const piece = this.pieces[this.drag.pieceId];
    const pointer = this.svgPoint(event);
    const moveDistance = Math.sqrt(
      distanceSquared(pointer, { x: this.drag.startX, y: this.drag.startY }),
    );
    if (moveDistance >= this.layout.side * 0.12) {
      this.drag.moved = true;
    }
    piece.freeX = pointer.x - this.drag.dx;
    piece.freeY = pointer.y - this.drag.dy;
    this.render();
  }

  handlePointerEnd(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    const piece = this.pieces[this.drag.pieceId];
    const pointer = this.svgPoint(event);
    const releaseDistance = Math.sqrt(
      distanceSquared(pointer, { x: this.drag.startX, y: this.drag.startY }),
    );
    const wasDragged = this.drag.moved || releaseDistance >= this.layout.side * 0.12;
    const snap = this.bestSnap(piece);
    if (snap && snap.distance <= this.layout.side * 0.9) {
      piece.offset = snap.offset;
      piece.onBoard = true;
    }
    try {
      if (this.svg.hasPointerCapture(event.pointerId)) {
        this.svg.releasePointerCapture(event.pointerId);
      }
    } catch {
      // See the pointer-capture note in handlePointerDown.
    }
    if (wasDragged) {
      this.clearSelection();
      this.suppressedPieceClick = {
        pieceId: piece.id,
        until: event.timeStamp + 500,
      };
    }
    this.drag = null;
    this.render();
  }

  handleCanvasClick(event) {
    if (event.target.closest?.(".piece")) {
      return;
    }
    const boardCell = event.target.closest?.("[data-cell-key]");
    if (boardCell) {
      const cell = this.cellByKey.get(boardCell.dataset.cellKey);
      if (cell && this.selectWindowCell(cell)) {
        this.clearSelection();
        this.render();
        return;
      }
    }
    if (this.selectedId !== null) {
      this.clearSelection();
      this.render();
    }
  }

  bestSnap(piece) {
    let best = null;
    for (const localCell of this.orientedCells(piece)) {
      const point = this.freeCellPoint(piece, localCell);
      for (const center of this.boardCenters) {
        const distance = Math.sqrt(distanceSquared(point, center));
        if (!best || distance < best.distance) {
          best = {
            distance,
            offset: subCells(center.cell, localCell),
          };
        }
      }
    }
    return best;
  }

  handleAction(action) {
    if (action === "solve") {
      this.solveCurrentPuzzle();
      return;
    }
    if (action === "reset") {
      this.resetAll();
      return;
    }
    if (this.selectedId === null) {
      return;
    }
    const piece = this.pieces[this.selectedId];
    if (action === "rotate-left" || action === "rotate-right" || action === "flip") {
      this.transformPiece(piece, action);
      this.render();
    }
  }

  solveCurrentPuzzle() {
    const result = this.solver.solve(this.selectedWindowKeys());
    if (!result) {
      return;
    }

    for (const placement of result.placements) {
      const piece = this.pieces[placement.pieceIndex];
      piece.rotation = placement.rotation;
      piece.reflected = placement.reflected;
      piece.offset = placement.offset;
      piece.onBoard = true;
    }
    this.clearSelection();
    this.drag = null;
    this.render();
  }

  transformPiece(piece, action) {
    const oldAbsoluteCells = piece.onBoard ? this.absoluteCells(piece) : null;
    const oldCenter = this.pieceVisualCenter(piece);
    if (action === "rotate-left") {
      piece.rotation = (piece.rotation + 1) % 6;
    } else if (action === "rotate-right") {
      piece.rotation = (piece.rotation + 5) % 6;
    } else if (action === "flip") {
      const mirroredCells = this.orientedCells(piece).map((cell) =>
        mirrorLeftRightCell(cell),
      );
      this.useOrientationMatching(piece, mirroredCells);
    }
    if (oldAbsoluteCells) {
      piece.offset = this.closestOffsetForCenter(piece, oldAbsoluteCells, oldCenter);
    } else {
      const newLooseCenter = this.loosePieceCenter(piece);
      piece.freeX += oldCenter.x - newLooseCenter.x;
      piece.freeY += oldCenter.y - newLooseCenter.y;
    }
  }

  resetPiece(piece) {
    piece.rotation = piece.homeRotation;
    piece.reflected = piece.homeReflected;
    piece.onBoard = false;
    piece.offset = { q: 0, r: 0 };
    piece.freeX = piece.homeX;
    piece.freeY = piece.homeY;
  }

  resetAll() {
    for (const piece of this.pieces) {
      this.resetPiece(piece);
    }
    this.clearSelection();
    this.render();
  }

  validate() {
    const windowKeys = this.selectedWindowKeys();
    const boardKeys = new Set(this.cells.map((cell) => cell.key));
    const pieceProblems = new Map();
    const occupancy = new Map();
    let offBoardPieces = 0;

    for (const piece of this.pieces) {
      const problems = [];
      if (!piece.onBoard) {
        offBoardPieces += 1;
        pieceProblems.set(piece.id, problems);
        continue;
      }
      for (const cell of this.absoluteCells(piece)) {
        const key = cellKey(cell);
        if (!boardKeys.has(key)) {
          problems.push("outside");
          continue;
        }
        if (windowKeys.has(key)) {
          problems.push("window");
        }
        if (!occupancy.has(key)) {
          occupancy.set(key, []);
        }
        occupancy.get(key).push(piece.id);
      }
      pieceProblems.set(piece.id, problems);
    }

    for (const pieceIds of occupancy.values()) {
      if (pieceIds.length > 1) {
        for (const pieceId of pieceIds) {
          pieceProblems.get(pieceId).push("overlap");
        }
      }
    }

    const coveredTargetKeys = [...occupancy.keys()].filter((key) => !windowKeys.has(key));
    const invalidPieces = [...pieceProblems.values()].filter((problems) => problems.length > 0)
      .length;
    const expected = this.targetCellCount();
    const complete =
      offBoardPieces === 0 &&
      invalidPieces === 0 &&
      coveredTargetKeys.length === expected;

    return {
      windowKeys,
      occupancy,
      pieceProblems,
      offBoardPieces,
      invalidPieces,
      covered: coveredTargetKeys.length,
      expected,
      complete,
    };
  }

  render() {
    const validation = this.validate();
    this.svg.replaceChildren();
    this.svg.setAttribute("viewBox", `0 0 ${this.layout.width} ${this.layout.height}`);
    this.svg.style.width = `${this.layout.width}px`;
    this.svg.style.height = `${this.layout.height}px`;
    this.applyScaleStyles();
    this.renderDefs();
    this.renderSurface();
    this.renderBoard(validation);
    this.renderPieces(validation);
    this.renderPieceActions();
  }

  applyScaleStyles() {
    const side = this.layout.side;
    const vars = {
      "--board-stroke": clamp(side * 0.052, 1.55, 3.4),
      "--window-stroke": clamp(side * 0.1, 3, 6.2),
      "--tray-stroke": clamp(side * 0.05, 1.5, 3),
      "--piece-stroke": clamp(side * 0.06, 1.8, 3.8),
      "--piece-active-stroke": clamp(side * 0.1, 3, 6.2),
      "--piece-selected-stroke": clamp(side * 0.1, 3.6, 7.2),
      "--complete-outline-stroke": clamp(side * 0.11, 3.8, 7),
      "--piece-lift": `${-clamp(side * 0.2, 7, 15)}px`,
      "--cell-font": clamp(side * 0.4, 12, 24),
    };
    for (const [name, value] of Object.entries(vars)) {
      this.svg.style.setProperty(name, `${value}px`);
    }
  }

  renderDefs() {
    const defs = svgElement("defs");
    const shadowDy = clamp(this.layout.side * 0.2, 6, 14);
    const shadowBlur = clamp(this.layout.side * 0.18, 5, 12);
    defs.innerHTML = `
      <filter id="piece-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="${shadowDy.toFixed(2)}" stdDeviation="${shadowBlur.toFixed(2)}" flood-color="#17212b" flood-opacity="0.34"/>
      </filter>
    `;
    this.svg.append(defs);
  }

  renderSurface() {
    this.svg.append(
      svgElement("rect", {
        x: 0,
        y: 0,
        width: this.layout.width,
        height: this.layout.height,
        class: "svg-bg",
      }),
    );
    const tray = this.trayBounds;
    this.svg.append(
      svgElement("rect", {
        x: tray.x,
        y: tray.y,
        width: tray.width,
        height: tray.height,
        rx: 8,
        class: "tray-zone",
      }),
    );
  }

  boardOutlinePath() {
    const boardKeys = new Set(this.cells.map((cell) => cell.key));
    const logicalSide = this.layout.side;
    const drawSide = this.layout.side * HEX_DRAW_SCALE;
    const segments = [];

    for (const cell of this.cells) {
      const point = this.boardPixel(cell);
      const logicalVertices = hexVertices(point.x, point.y, logicalSide);
      EDGE_NEIGHBORS.forEach((neighbor, edgeIndex) => {
        if (boardKeys.has(cellKey(addCells(cell, neighbor)))) {
          return;
        }
        const start = logicalVertices[edgeIndex];
        const end = logicalVertices[(edgeIndex + 1) % logicalVertices.length];
        const outsideCell = addCells(cell, neighbor);
        const outsidePoint = this.boardPixel(outsideCell);
        const outsideVertices = hexVertices(outsidePoint.x, outsidePoint.y, drawSide);
        const oppositeEdgeIndex = (edgeIndex + 3) % EDGE_NEIGHBORS.length;
        const outlineEdge = orientedOutlineEdge(
          start,
          end,
          outsideVertices[oppositeEdgeIndex],
          outsideVertices[(oppositeEdgeIndex + 1) % outsideVertices.length],
        );
        segments.push({
          startKey: pointKey(start),
          endKey: pointKey(end),
          outlineStart: outlineEdge.start,
          outlineEnd: outlineEdge.end,
        });
      });
    }

    const segmentsByStart = new Map();
    segments.forEach((segment, index) => {
      if (!segmentsByStart.has(segment.startKey)) {
        segmentsByStart.set(segment.startKey, []);
      }
      segmentsByStart.get(segment.startKey).push(index);
    });

    const used = new Set();
    const paths = [];
    for (let index = 0; index < segments.length; index += 1) {
      if (used.has(index)) {
        continue;
      }

      const first = segments[index];
      used.add(index);
      const startKey = first.startKey;
      let currentKey = first.endKey;
      const orderedSegments = [first];

      while (currentKey !== startKey) {
        const nextIndex = (segmentsByStart.get(currentKey) ?? []).find(
          (candidate) => !used.has(candidate),
        );
        if (nextIndex === undefined) {
          break;
        }
        used.add(nextIndex);
        const next = segments[nextIndex];
        currentKey = next.endKey;
        orderedSegments.push(next);
      }

      if (currentKey !== startKey || orderedSegments.length < 3) {
        continue;
      }

      const points = [];
      for (let segmentIndex = 0; segmentIndex < orderedSegments.length; segmentIndex += 1) {
        const previous =
          orderedSegments[
            (segmentIndex + orderedSegments.length - 1) % orderedSegments.length
          ];
        const current = orderedSegments[segmentIndex];
        const point = outlineLineIntersection(previous, current);
        if (point) {
          points.push(point);
        }
      }

      if (points.length >= 3) {
        paths.push(`M ${points.map((point) => pathPoint(point)).join(" L ")} Z`);
      }
    }
    return paths.join(" ");
  }

  renderBoard(validation) {
    const group = svgElement("g", { class: "board" });
    for (const cell of this.cells) {
      const point = this.boardPixel(cell);
      const isWindow = validation.windowKeys.has(cell.key);
      const classes = [
        "board-cell",
        REGION_CLASS[cell.region],
        isWindow ? "window-cell" : "",
      ]
        .filter(Boolean)
        .join(" ");
      group.append(
        svgElement("polygon", {
          points: hexPolygonPoints(point.x, point.y, this.layout.side * HEX_DRAW_SCALE),
          class: classes,
          "data-cell-key": cell.key,
          "aria-label": `Select ${cell.region} ${cell.label}`,
          role: "button",
        }),
      );
      const label = svgElement("text", {
        x: point.x,
        y: point.y,
        dy: "0.35em",
        class: isWindow ? "cell-label window-label" : "cell-label",
      });
      label.textContent = cell.label;
      group.append(label);
    }
    group.append(
      svgElement("path", {
        d: this.boardOutlinePath(),
        class: validation.complete ? "board-outline complete" : "board-outline",
      }),
    );
    this.svg.append(group);
  }

  renderPieces(validation) {
    const ordered = this.pieces
      .filter((piece) => piece.id !== this.selectedId)
      .concat(this.selectedId === null ? [] : [this.pieces[this.selectedId]]);
    for (const piece of ordered) {
      this.svg.append(this.pieceGroup(piece, validation));
    }
  }

  drawPointsForPiece(piece) {
    const localCells = this.orientedCells(piece);
    return piece.onBoard
      ? this.absoluteCells(piece).map((cell, index) => ({
          localCell: localCells[index],
          point: this.boardPixel(cell),
        }))
      : localCells.map((localCell) => ({
          localCell,
          point: this.freeCellPoint(piece, localCell),
        }));
  }

  pieceDrawBounds(piece) {
    const points = this.drawPointsForPiece(piece).map((entry) => entry.point);
    const margin = this.layout.side * HEX_DRAW_SCALE;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      minX: Math.min(...xs) - margin,
      maxX: Math.max(...xs) + margin,
      minY: Math.min(...ys) - margin,
      maxY: Math.max(...ys) + margin,
    };
  }

  renderPieceActions() {
    if (this.selectedId === null || this.drag) {
      return;
    }
    const piece = this.pieces[this.selectedId];
    const bounds = this.pieceDrawBounds(piece);
    const visualHexWidth = Math.sqrt(3) * this.layout.side * HEX_DRAW_SCALE;
    const buttonSize = clamp(visualHexWidth * 0.9, 34, 58);
    const gap = clamp(this.layout.side * 0.22, 8, 14);
    const totalWidth = buttonSize * PIECE_ACTIONS.length + gap * (PIECE_ACTIONS.length - 1);
    if (this.actionToolbarPlacement?.pieceId !== this.selectedId) {
      const margin = buttonSize * 0.65;
      const visible = this.visibleSvgBounds();
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const minX = Math.max(margin, visible.minX + margin);
      const maxX = Math.min(this.layout.width - totalWidth - margin, visible.maxX - totalWidth - margin);
      const minY = Math.max(margin, visible.minY + margin);
      const maxY = Math.min(this.layout.height - buttonSize - margin, visible.maxY - buttonSize - margin);
      const x = clampToRange(centerX - totalWidth / 2, minX, maxX);
      const aboveY = bounds.minY - buttonSize * 1.28;
      const belowY = bounds.maxY + buttonSize * 0.28;
      const belowFits = belowY >= minY && belowY <= maxY;
      const aboveFits = aboveY >= minY && aboveY <= maxY;
      let y;
      if (aboveFits) {
        y = aboveY;
      } else if (belowFits) {
        y = belowY;
      } else {
        const clampedBelow = clampToRange(belowY, minY, maxY);
        const clampedAbove = clampToRange(aboveY, minY, maxY);
        y = Math.abs(clampedAbove - aboveY) <= Math.abs(clampedBelow - belowY)
          ? clampedAbove
          : clampedBelow;
      }
      this.actionToolbarPlacement = { pieceId: this.selectedId, x, y };
    }
    const { x, y } = this.actionToolbarPlacement;
    const toolbar = svgElement("g", {
      class: "piece-action-toolbar",
      transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})`,
    });

    PIECE_ACTIONS.forEach((action, index) => {
      const button = svgElement("g", {
        class: "piece-action-button",
        transform: `translate(${(index * (buttonSize + gap)).toFixed(2)} 0)`,
        "data-action": action.action,
        role: "button",
        tabindex: 0,
        "aria-label": action.label,
      });
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.handleAction(action.action);
      });
      button.append(
        svgElement("circle", {
          class: "piece-action-hit",
          cx: buttonSize / 2,
          cy: buttonSize / 2,
          r: buttonSize / 2,
        }),
      );
      const icon = svgElement("svg", {
        class: "piece-action-icon",
        x: buttonSize * 0.23,
        y: buttonSize * 0.23,
        width: buttonSize * 0.54,
        height: buttonSize * 0.54,
        viewBox: "0 0 24 24",
        "aria-hidden": "true",
      });
      icon.innerHTML = ICON_PATHS[action.icon];
      button.append(icon);
      toolbar.append(button);
    });

    this.svg.append(toolbar);
  }

  pieceGroup(piece, validation) {
    const problems = validation.pieceProblems.get(piece.id) ?? [];
    const group = svgElement("g", {
      class: [
        "piece",
        piece.onBoard ? "placed" : "loose",
        piece.id === this.selectedId ? "selected" : "",
        piece.id === this.drag?.pieceId ? "dragging" : "",
        problems.length > 0 ? "invalid" : "",
      ]
        .filter(Boolean)
        .join(" "),
      "data-piece-id": piece.id,
      tabindex: 0,
      role: "button",
      "aria-label": piece.name,
    });
    group.addEventListener("pointerdown", (event) => this.handlePointerDown(event, piece.id));
    group.addEventListener("click", (event) => {
      if (
        this.suppressedPieceClick?.pieceId === piece.id &&
        event.timeStamp <= this.suppressedPieceClick.until
      ) {
        this.suppressedPieceClick = null;
        return;
      }
      this.suppressedPieceClick = null;
      this.selectPiece(piece.id);
      this.render();
    });

    const drawCells = this.drawPointsForPiece(piece);

    const pieceSide = this.layout.side * HEX_DRAW_SCALE;
    const selectionSide = this.layout.side * 1.0;

    for (const { point } of drawCells) {
      if (piece.id === this.selectedId) {
        group.append(
          svgElement("polygon", {
            points: hexPolygonPoints(point.x, point.y, selectionSide),
            class: "selection-cell",
          }),
        );
      }
      group.append(
        svgElement("polygon", {
          points: hexPolygonPoints(point.x, point.y, pieceSide),
          class: "piece-cell",
          style: `fill: ${piece.color}`,
        }),
      );
    }

    return group;
  }
}
