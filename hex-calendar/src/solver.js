import {
  addCells,
  cellKey,
  subCells,
  transformCells,
} from "./hex.js?v=20260627-pieceactions8";

function bitFor(index) {
  return 1n << BigInt(index);
}

function bitCount(mask) {
  let count = 0;
  let remaining = mask;
  while (remaining !== 0n) {
    remaining &= remaining - 1n;
    count += 1;
  }
  return count;
}

function pieceIndices(mask, pieceCount) {
  const indexes = [];
  for (let index = 0; index < pieceCount; index += 1) {
    if (mask & (1 << index)) {
      indexes.push(index);
    }
  }
  return indexes;
}

function placementKey(mask) {
  return mask.toString(16);
}

export class CalendarSolver {
  constructor(boardCells, pieces) {
    this.boardCells = boardCells;
    this.pieces = pieces.map((piece, index) => ({ ...piece, id: index }));
    this.cellToIndex = new Map(boardCells.map((cell, index) => [cell.key, index]));
    this.boardKeys = new Set(boardCells.map((cell) => cell.key));
    this.allCellsMask = (1n << BigInt(boardCells.length)) - 1n;
    this.byPiece = pieces.map((piece) => this.buildPiecePlacements(piece));
    this.byPieceAndCell = this.buildPieceCellIndex();
    this.pieceSizes = pieces.map((piece) => piece.baseCells.length);
  }

  buildPiecePlacements(piece) {
    const byMask = new Map();
    for (const reflected of [false, true]) {
      for (let rotation = 0; rotation < 6; rotation += 1) {
        const localCells = transformCells(piece.baseCells, rotation, reflected);
        for (const boardCell of this.boardCells) {
          for (const shapeCell of localCells) {
            const offset = subCells(boardCell, shapeCell);
            const placedCells = localCells.map((cell) => addCells(cell, offset));
            if (!placedCells.every((cell) => this.boardKeys.has(cellKey(cell)))) {
              continue;
            }

            let mask = 0n;
            for (const cell of placedCells) {
              mask |= bitFor(this.cellToIndex.get(cellKey(cell)));
            }
            if (!byMask.has(placementKey(mask))) {
              byMask.set(placementKey(mask), {
                pieceIndex: piece.id,
                mask,
                rotation,
                reflected,
                offset,
              });
            }
          }
        }
      }
    }
    return [...byMask.values()].sort((a, b) => (a.mask < b.mask ? -1 : 1));
  }

  buildPieceCellIndex() {
    return this.byPiece.map((placements) => {
      const perCell = Array.from({ length: this.boardCells.length }, () => []);
      for (const placement of placements) {
        for (let cellIndex = 0; cellIndex < this.boardCells.length; cellIndex += 1) {
          if (placement.mask & bitFor(cellIndex)) {
            perCell[cellIndex].push(placement);
          }
        }
      }
      return perCell;
    });
  }

  targetMask(windowKeys) {
    let mask = this.allCellsMask;
    for (const key of windowKeys) {
      const index = this.cellToIndex.get(key);
      if (index !== undefined) {
        mask &= ~bitFor(index);
      }
    }
    return mask;
  }

  remainingArea(unusedMask) {
    return pieceIndices(unusedMask, this.pieces.length).reduce(
      (total, pieceIndex) => total + this.pieceSizes[pieceIndex],
      0,
    );
  }

  chooseCell(remaining, unusedMask) {
    let bestCell = null;
    let bestOptions = null;

    for (let cellIndex = 0; cellIndex < this.boardCells.length; cellIndex += 1) {
      if (!(remaining & bitFor(cellIndex))) {
        continue;
      }
      const options = [];
      for (const pieceIndex of pieceIndices(unusedMask, this.pieces.length)) {
        for (const placement of this.byPieceAndCell[pieceIndex][cellIndex]) {
          if ((placement.mask & remaining) === placement.mask) {
            options.push(placement);
          }
        }
      }
      if (bestOptions === null || options.length < bestOptions.length) {
        bestCell = cellIndex;
        bestOptions = options;
        if (options.length === 0) {
          break;
        }
      }
    }
    return { cellIndex: bestCell, options: bestOptions ?? [] };
  }

  solve(windowKeys) {
    const allUnused = (1 << this.pieces.length) - 1;
    const current = Array(this.pieces.length).fill(null);
    const failedStates = new Set();
    let nodes = 0;

    const dfs = (remaining, unusedMask) => {
      nodes += 1;
      if (remaining === 0n) {
        return unusedMask === 0 ? [...current] : null;
      }

      const stateKey = `${remaining.toString(16)}:${unusedMask}`;
      if (failedStates.has(stateKey)) {
        return null;
      }
      if (bitCount(remaining) !== this.remainingArea(unusedMask)) {
        failedStates.add(stateKey);
        return null;
      }

      const { options } = this.chooseCell(remaining, unusedMask);
      if (options.length === 0) {
        failedStates.add(stateKey);
        return null;
      }

      for (const placement of options) {
        const pieceBit = 1 << placement.pieceIndex;
        if (!(unusedMask & pieceBit)) {
          continue;
        }
        current[placement.pieceIndex] = placement;
        const solution = dfs(remaining ^ placement.mask, unusedMask ^ pieceBit);
        current[placement.pieceIndex] = null;
        if (solution) {
          return solution;
        }
      }

      failedStates.add(stateKey);
      return null;
    };

    const placements = dfs(this.targetMask(windowKeys), allUnused);
    return placements ? { placements, nodes } : null;
  }
}
