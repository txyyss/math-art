# Hex Calendar Web Prototype

This directory contains a static browser prototype for the hex calendar puzzle.
It uses plain HTML, CSS, JavaScript, and SVG.  There is no Vite, React, Node.js,
or npm requirement for the current prototype.

## Run locally

From the repository root:

```bash
cd web
../.venv/bin/python -m http.server 5173
```

Then open:

```text
http://localhost:5173/
```

## Data

The browser reads:

```text
web/public/data/puzzle.json
```

Regenerate it from the current Python board model and a piece-set JSON:

```bash
.venv/bin/python scripts/export_web_data.py \
  --piece-set outputs/scheme_B_piece_set.json \
  --out web/public/data/puzzle.json
```

The checked-in JSON is a small snapshot of the current scheme B piece set so
the web prototype does not depend on gitignored search outputs.

## Controls

- Choose the month, date, and weekday to set the three exposed windows.
- Drag pieces from the tray to the board.
- Select a piece, then use the toolbar buttons to rotate, flip, return it to
  the tray, solve the selected date, or reset the board.

The page marks invalid placements when a piece leaves the board, overlaps
another piece, or covers one of the three windows.

## Third-party notices

Toolbar icons and the SVG favicon use inline paths from Lucide. License details
are recorded in `THIRD_PARTY_NOTICES.md`.
