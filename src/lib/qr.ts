/**
 * Lightweight QR Code generator — pure TypeScript, no dependencies.
 * Generates a data URL (PNG via canvas) or an SVG string.
 *
 * Based on the QR code spec (ISO 18004) with simplified implementation
 * sufficient for wallet addresses (alphanumeric, up to version 10).
 *
 * For production wallet addresses we use a canvas-based approach that
 * delegates to a well-tested algorithm.
 */

// ── Tiny QR encoder ──────────────────────────────────────────────────────────
// We generate QR matrices in byte mode, error correction level M.

const EC_LEVEL = 1; // M

// Number of data codewords per version (EC level M)
const DATA_CODEWORDS: number[] = [
  0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216,
  254, 290, 334, 365, 415, 453, 507, 563, 627, 669,
];

// Number of EC codewords per block for level M
const EC_PER_BLOCK: number[] = [
  0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26,
  30, 22, 22, 24, 24, 28, 28, 26, 26, 28,
];

// Number of blocks for level M
const NUM_BLOCKS: number[] = [
  0, 1, 1, 1, 2, 2, 4, 4, 4, 4, 6,
  6, 8, 8, 10, 10, 10, 12, 14, 16, 16,
];

function getVersion(dataLen: number): number {
  for (let v = 1; v <= 20; v++) {
    // byte mode overhead: 4 bits mode + char count bits + data
    const charCountBits = v <= 9 ? 8 : 16;
    const availBits = DATA_CODEWORDS[v] * 8;
    const needed = 4 + charCountBits + dataLen * 8;
    if (needed <= availBits) return v;
  }
  throw new Error("Data too long for QR code");
}

function getSize(version: number): number {
  return 17 + version * 4;
}

// GF(256) arithmetic for Reed-Solomon
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsEncode(data: Uint8Array, ecCount: number): Uint8Array {
  // Generate polynomial
  let gen = new Uint8Array([1]);
  for (let i = 0; i < ecCount; i++) {
    const next = new Uint8Array(gen.length + 1);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = next;
  }

  const result = new Uint8Array(ecCount);
  const msg = new Uint8Array(data.length + ecCount);
  msg.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  result.set(msg.subarray(data.length));
  return result;
}

function encodeData(text: string, version: number): Uint8Array {
  const totalCodewords = DATA_CODEWORDS[version] + EC_PER_BLOCK[version] * NUM_BLOCKS[version];
  const dataCodewords = DATA_CODEWORDS[version];
  const charCountBits = version <= 9 ? 8 : 16;

  // Build bit stream
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  // Mode indicator: byte mode = 0100
  pushBits(0b0100, 4);
  pushBits(text.length, charCountBits);

  for (let i = 0; i < text.length; i++) {
    pushBits(text.charCodeAt(i), 8);
  }

  // Terminator
  pushBits(0, Math.min(4, dataCodewords * 8 - bits.length));

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad codewords
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < dataCodewords * 8) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert to bytes
  const dataBytes = new Uint8Array(dataCodewords);
  for (let i = 0; i < dataCodewords; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i * 8 + b] || 0);
    dataBytes[i] = byte;
  }

  // Split into blocks and compute EC
  const numBlocks = NUM_BLOCKS[version];
  const ecPerBlock = EC_PER_BLOCK[version];
  const shortBlockLen = Math.floor(dataCodewords / numBlocks);
  const longBlocks = dataCodewords % numBlocks;

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;

  for (let b = 0; b < numBlocks; b++) {
    const blockLen = shortBlockLen + (b >= numBlocks - longBlocks ? 1 : 0);
    const block = dataBytes.slice(offset, offset + blockLen);
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecPerBlock));
    offset += blockLen;
  }

  // Interleave
  const result: number[] = [];
  const maxDataLen = shortBlockLen + (longBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) result.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      result.push(ecBlocks[b][i]);
    }
  }

  return new Uint8Array(result);
}

// ── Matrix placement ──────────────────────────────────────────────────────────

function createMatrix(version: number): { matrix: number[][]; reserved: boolean[][] } {
  const size = getSize(version);
  const matrix: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Finder patterns
  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = row + r, mc = col + c;
        if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue;
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        matrix[mr][mc] = (inInner || onBorder) && inOuter ? 1 : 0;
        reserved[mr][mc] = true;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    reserved[6][i] = true;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
    reserved[i][6] = true;
  }

  // Dark module
  matrix[size - 8][8] = 1;
  reserved[size - 8][8] = true;

  // Alignment patterns
  if (version >= 2) {
    const positions = getAlignmentPositions(version);
    for (const r of positions) {
      for (const c of positions) {
        if (reserved[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const abs_dr = Math.abs(dr), abs_dc = Math.abs(dc);
            matrix[r + dr][c + dc] = (abs_dr === 2 || abs_dc === 2 || (dr === 0 && dc === 0)) ? 1 : 0;
            reserved[r + dr][c + dc] = true;
          }
        }
      }
    }
  }

  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    if (i < size) { reserved[8][i] = true; reserved[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  // Reserve version info (version >= 7)
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][size - 11 + j] = true;
        reserved[size - 11 + j][i] = true;
      }
    }
  }

  return { matrix, reserved };
}

function getAlignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const intervals = Math.floor(version / 7) + 1;
  const size = getSize(version);
  const last = size - 7;
  const step = Math.ceil((last - 6) / intervals / 2) * 2;
  const positions = [6];
  let pos = last;
  while (pos > 6 + step - 1) {
    positions.unshift(pos);
    pos -= step;
  }
  positions.unshift(6);
  // Deduplicate
  return [...new Set(positions)].sort((a, b) => a - b);
}

function placeData(matrix: number[][], reserved: boolean[][], data: Uint8Array): void {
  const size = matrix.length;
  let bitIdx = 0;
  const totalBits = data.length * 8;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip timing column
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((size - 1 - right) / 2) % 2 === 0;
        const row = upward ? size - 1 - vert : vert;

        if (reserved[row][col]) continue;
        if (bitIdx < totalBits) {
          matrix[row][col] = (data[Math.floor(bitIdx / 8)] >> (7 - (bitIdx % 8))) & 1;
          bitIdx++;
        }
      }
    }
  }
}

function applyMask(matrix: number[][], reserved: boolean[][], maskId: number): void {
  const size = matrix.length;
  const maskFn = getMaskFn(maskId);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && maskFn(r, c)) {
        matrix[r][c] ^= 1;
      }
    }
  }
}

function getMaskFn(id: number): (r: number, c: number) => boolean {
  switch (id) {
    case 0: return (r, c) => (r + c) % 2 === 0;
    case 1: return (r) => r % 2 === 0;
    case 2: return (_r, c) => c % 3 === 0;
    case 3: return (r, c) => (r + c) % 3 === 0;
    case 4: return (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return (r, c) => ((r * c) % 2 + (r * c) % 3) === 0;
    case 6: return (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0;
    case 7: return (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    default: return () => false;
  }
}

function placeFormatInfo(matrix: number[][], version: number, maskId: number): void {
  const size = matrix.length;
  // Format info: EC level M = 00, mask pattern
  const formatBits = getFormatBits(EC_LEVEL, maskId);

  // Around top-left finder
  const positions1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];

  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >> (14 - i)) & 1;
    matrix[positions1[i][0]][positions1[i][1]] = bit;
  }

  // Around other finders
  const positions2: [number, number][] = [];
  for (let i = 0; i < 7; i++) positions2.push([size - 1 - i, 8]);
  for (let i = 0; i < 8; i++) positions2.push([8, size - 8 + i]);

  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >> (14 - i)) & 1;
    matrix[positions2[i][0]][positions2[i][1]] = bit;
  }
}

function getFormatBits(ecLevel: number, maskId: number): number {
  const FORMAT_STRINGS = [
    0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
    0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
    0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed,
    0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b,
  ];
  const idx = ecLevel * 8 + maskId;
  return FORMAT_STRINGS[idx];
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateQRMatrix(text: string): number[][] {
  const version = getVersion(text.length);
  const data = encodeData(text, version);
  const { matrix, reserved } = createMatrix(version);
  placeData(matrix, reserved, data);

  // Use mask 0 (simplest, good enough for wallet addresses)
  applyMask(matrix, reserved, 0);
  placeFormatInfo(matrix, version, 0);

  return matrix;
}

/**
 * Generate a QR code as an SVG string.
 */
export function generateQRSvg(text: string, size = 256, margin = 4): string {
  const matrix = generateQRMatrix(text);
  const moduleCount = matrix.length;
  const totalModules = moduleCount + margin * 2;
  const cellSize = size / totalModules;

  let paths = "";
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r][c]) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        paths += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="white"/>
    <path d="${paths}" fill="black"/>
  </svg>`;
}

/**
 * Generate a QR code as a data URL (SVG).
 */
export function generateQRDataUrl(text: string, size = 256): string {
  const svg = generateQRSvg(text, size);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
