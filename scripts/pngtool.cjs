const fs = require('fs')
const zlib = require('zlib')

function crc32(buf) {
  let c
  const table =
    crc32.table ||
    (crc32.table = (() => {
      const t = []
      for (let n = 0; n < 256; n++) {
        c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c
      }
      return t
    })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function decodePng(path) {
  const buf = fs.readFileSync(path)
  let offset = 8
  let width, height
  const idat = []
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const data = buf.slice(offset + 8, offset + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    offset += 8 + len + 4
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = 4
  const stride = width * bpp
  const pixels = Buffer.alloc(height * stride)
  let rawOffset = 0
  let prevRow = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset++]
    const row = raw.slice(rawOffset, rawOffset + stride)
    rawOffset += stride
    const outRow = Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = row[x]
      const b = x >= bpp ? outRow[x - bpp] : 0
      const c = prevRow[x]
      const d = x >= bpp ? prevRow[x - bpp] : 0
      let val
      if (filterType === 0) val = a
      else if (filterType === 1) val = (a + b) & 0xff
      else if (filterType === 2) val = (a + c) & 0xff
      else if (filterType === 3) val = (a + Math.floor((b + c) / 2)) & 0xff
      else if (filterType === 4) {
        const p = b + c - d
        const pa = Math.abs(p - b),
          pb = Math.abs(p - c),
          pc = Math.abs(p - d)
        const pr = pa <= pb && pa <= pc ? b : pb <= pc ? c : d
        val = (a + pr) & 0xff
      }
      outRow[x] = val
    }
    outRow.copy(pixels, y * stride)
    prevRow = outRow
  }
  return { width, height, pixels }
}

function encodePng(width, height, pixels, outPath) {
  const bpp = 4
  const stride = width * bpp
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const compressed = zlib.deflateSync(raw, { level: 9 })
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const out = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
  fs.writeFileSync(outPath, out)
}

function crop(src, x, y, w, h) {
  const bpp = 4
  const out = Buffer.alloc(w * h * bpp)
  for (let row = 0; row < h; row++) {
    const srcStart = ((y + row) * src.width + x) * bpp
    const dstStart = row * w * bpp
    src.pixels.copy(out, dstStart, srcStart, srcStart + w * bpp)
  }
  return { width: w, height: h, pixels: out }
}

module.exports = { decodePng, encodePng, crop }
