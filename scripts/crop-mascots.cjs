// Crops mascot poses out of a 6x4 grid sprite sheet (each cell CELL x CELL
// px), isolating just each pose's actual alpha content (a seeded flood
// fill from the cell center, plus any small nearby decoration blob) rather
// than a naive fixed-size rectangle slice. A plain grid-slice crop shows a
// faint fragment of the neighboring cell's pose at one edge whenever poses
// don't sit on a perfectly rigid grid (true of every sprite sheet the
// owner has sent so far) — flood-filling the real alpha blob avoids that
// without needing an image editor.
//
// Reusable for a future sprite sheet: update SRC/CELL/COLS/ROWS/POSES
// below to match the new sheet's layout, then rerun. Pass MASCOT_OUT_DIR
// to write elsewhere first (e.g. a scratch dir) for a visual check before
// overwriting src/assets/mascot for real.
const path = require('node:path')
const { decodePng, encodePng } = require('./pngtool.cjs')

const SRC = '/Users/zeki/Downloads/ChatGPT Image Sep 4, 2026, 12_58_05 PM.png'
const OUT_DIR = process.env.MASCOT_OUT_DIR || path.join(__dirname, '..', 'src', 'assets', 'mascot')
const CELL = 256
const COLS = 6
const ROWS = 4
const CORE_ALPHA = 60 // "definitely part of the creature" threshold
const EDGE_ALPHA = 10 // keep soft anti-aliased pixels down to this alpha
const DILATE = 3 // px grown around the core blob to keep soft edges
const PAD = 6 // extra transparent margin left around the final crop

const img = decodePng(SRC)

function alphaAt(x, y) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return 0
  return img.pixels[(y * img.width + x) * 4 + 3]
}

// Finds every separate alpha blob in the window (BFS connected components).
// Some poses draw a small decoration right next to the body (a held heart,
// the "Zzz" above a sleeping head, a lightbulb's glow) as its own alpha
// island that never quite touches the body — a single-seed flood fill
// from the body alone would silently drop those.
function connectedComponents(minX, minY, maxX, maxY) {
  const w = maxX - minX
  const h = maxY - minY
  const visited = new Uint8Array(w * h)
  const components = []
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const idx = (y - minY) * w + (x - minX)
      if (visited[idx] || alphaAt(x, y) < CORE_ALPHA) continue
      const stack = [[x, y]]
      const pixels = []
      while (stack.length) {
        const [px, py] = stack.pop()
        if (px < minX || py < minY || px >= maxX || py >= maxY) continue
        const pidx = (py - minY) * w + (px - minX)
        if (visited[pidx]) continue
        visited[pidx] = 1
        if (alphaAt(px, py) < CORE_ALPHA) continue
        pixels.push([px, py])
        stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1])
      }
      if (pixels.length) components.push(pixels)
    }
  }
  return components
}

function bbox(pixels) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (const [x, y] of pixels) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}

// Gap between two bboxes: 0 if they touch/overlap on that axis, else the
// pixel distance between their nearest edges.
function bboxGap(a, b) {
  const dx = Math.max(0, Math.max(a[0] - b[2], b[0] - a[2]))
  const dy = Math.max(0, Math.max(a[1] - b[3], b[1] - a[3]))
  return Math.hypot(dx, dy)
}

// A neighboring pose's body can bleed a few px past the naive 256 grid
// line into this window (the sheet isn't drawn on a perfectly rigid grid),
// which is exactly why the round 4 crops showed a fragment of the row
// above at the top edge. Distinguish "my own nearby decoration" from
// "someone else's body poking in" by proximity to THIS cell's own body
// blob, found first via a seed flood fill from the cell's center — a
// neighbor's bleed sits tens of pixels further away than a touching prop.
const DECORATION_GAP = 12

function cropPose(row, col) {
  const cx = col * CELL + CELL / 2
  const cy = row * CELL + CELL / 2
  const minX = Math.max(0, col * CELL - 70)
  const minY = Math.max(0, row * CELL - 70)
  const maxX = Math.min(img.width, (col + 1) * CELL + 70)
  const maxY = Math.min(img.height, (row + 1) * CELL + 70)

  const components = connectedComponents(minX, minY, maxX, maxY)
  // The body is whichever component contains (or is closest to) the
  // nominal cell center — reliably the creature itself across all 24
  // cells, since decorations are always smaller and off to one side.
  let bodyIdx = -1
  let bodyDist = Infinity
  components.forEach((pixels, i) => {
    const [x0, y0, x1, y1] = bbox(pixels)
    const dx = Math.max(0, Math.max(x0 - cx, cx - x1))
    const dy = Math.max(0, Math.max(y0 - cy, cy - y1))
    const dist = Math.hypot(dx, dy)
    if (dist < bodyDist) {
      bodyDist = dist
      bodyIdx = i
    }
  })
  if (bodyIdx === -1)
    throw new Error(`no component found near cell center at row ${row} col ${col}`)

  const bodyBbox = bbox(components[bodyIdx])
  let core = [...components[bodyIdx]]
  components.forEach((pixels, i) => {
    if (i === bodyIdx) return
    if (bboxGap(bbox(pixels), bodyBbox) <= DECORATION_GAP) core.push(...pixels)
  })
  if (core.length < 200) throw new Error(`suspiciously small blob at row ${row} col ${col}`)

  let bx0 = Infinity,
    by0 = Infinity,
    bx1 = -Infinity,
    by1 = -Infinity
  const coreSet = new Set()
  for (const [x, y] of core) {
    coreSet.add(x + ',' + y)
    if (x < bx0) bx0 = x
    if (x > bx1) bx1 = x
    if (y < by0) by0 = y
    if (y > by1) by1 = y
  }

  const cropX0 = Math.max(0, bx0 - DILATE - PAD)
  const cropY0 = Math.max(0, by0 - DILATE - PAD)
  const cropX1 = Math.min(img.width, bx1 + DILATE + PAD + 1)
  const cropY1 = Math.min(img.height, by1 + DILATE + PAD + 1)
  const w = cropX1 - cropX0
  const h = cropY1 - cropY0

  const out = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = cropX0 + x
      const sy = cropY0 + y
      // Keep this pixel's real alpha only if it's within DILATE px of the
      // core blob (in Chebyshev distance, checked via a small window scan)
      // — this preserves soft anti-aliased fringe pixels around the
      // creature while excluding anything from a different, separate blob.
      let nearCore = false
      for (let dy = -DILATE; dy <= DILATE && !nearCore; dy++) {
        for (let dx = -DILATE; dx <= DILATE; dx++) {
          if (coreSet.has(sx + dx + ',' + (sy + dy))) {
            nearCore = true
            break
          }
        }
      }
      const di = (y * w + x) * 4
      if (nearCore && alphaAt(sx, sy) >= EDGE_ALPHA) {
        const si = (sy * img.width + sx) * 4
        out[di] = img.pixels[si]
        out[di + 1] = img.pixels[si + 1]
        out[di + 2] = img.pixels[si + 2]
        out[di + 3] = img.pixels[si + 3]
      } else {
        out[di] = 0
        out[di + 1] = 0
        out[di + 2] = 0
        out[di + 3] = 0
      }
    }
  }
  return { width: w, height: h, pixels: out }
}

const POSES = [
  // row, col, output filename. The 6 that match round 4's original poses
  // (eating, hearts, idea, thinking, curious, resting) keep those exact
  // names, so mascotPoses.ts's existing keys and every call site
  // (Home.tsx, Shelves.tsx, EditProfile.tsx) need no changes, they just
  // get a cleaner crop of the same pose.
  [0, 0, 'mascot-happy'],
  [0, 1, 'mascot-wink'],
  [0, 2, 'mascot-laughing'],
  [0, 3, 'mascot-hug'],
  [0, 4, 'mascot-surprised'],
  [0, 5, 'mascot-curious'],
  [1, 0, 'mascot-sleepy'],
  [1, 1, 'mascot-glasses'],
  [1, 2, 'mascot-laptop'],
  [1, 3, 'mascot-eating'],
  [1, 4, 'mascot-cheerful'],
  [1, 5, 'mascot-hiding'],
  [2, 0, 'mascot-sad'],
  [2, 1, 'mascot-hearts'],
  [2, 2, 'mascot-cool'],
  [2, 3, 'mascot-resting'],
  [2, 4, 'mascot-thinking'],
  [2, 5, 'mascot-cheering'],
  [3, 0, 'mascot-lying-sad'],
  [3, 1, 'mascot-lying-heart'],
  [3, 2, 'mascot-dizzy'],
  [3, 3, 'mascot-angry'],
  [3, 4, 'mascot-idea'],
  [3, 5, 'mascot-waving'],
]

for (const [row, col, name] of POSES) {
  const cropped = cropPose(row, col)
  const outPath = path.join(OUT_DIR, `${name}.png`)
  encodePng(cropped.width, cropped.height, cropped.pixels, outPath)
  console.log(`${name}: ${cropped.width}x${cropped.height} -> ${outPath}`)
}
