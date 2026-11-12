/**
 * Self-contained ISO/IEC 18004 QR Code matrix generator (Byte mode, ECC-L, Version 3 = 29x29)
 * for offline rendering of TRON TRC20 deposit addresses without external image/API dependencies.
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEcc(data: Uint8Array, eccCount: number): Uint8Array {
  const gen = rsGeneratorPoly(eccCount);
  const res = new Uint8Array(data.length + eccCount);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

/**
 * Encodes UTF-8 string up to 53 bytes into a Version 3-L (29x29) QR matrix (`boolean[][]`).
 */
export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  // Version 3-L: 55 data codewords (440 bits), 15 ECC codewords (1 block of 55 + 15 = 70 codewords)
  const dataCapacity = 55;
  const eccCount = 15;
  const size = 29;

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Mode indicator 0100 (Byte), 8-bit character count
  pushBits(0b0100, 4);
  const payload = bytes.slice(0, 53);
  pushBits(payload.length, 8);
  for (const b of payload) pushBits(b, 8);

  // Terminator + padding to byte boundary + 0xEC / 0x11 pad bytes
  const maxBits = dataCapacity * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(dataCapacity);
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | (bits[i + j] ?? 0);
    data[i / 8] = val;
  }
  let padToggle = true;
  for (let idx = bits.length / 8; idx < dataCapacity; idx++) {
    data[idx] = padToggle ? 0xec : 0x11;
    padToggle = !padToggle;
  }

  const ecc = rsComputeEcc(data, eccCount);
  const allCodewords = new Uint8Array(dataCapacity + eccCount);
  allCodewords.set(data, 0);
  allCodewords.set(ecc, dataCapacity);

  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const isFunc: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const setModule = (r: number, c: number, dark: boolean, func = true) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = dark;
      if (func) isFunc[r][c] = true;
    }
  };

  const drawFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setModule(rr, cc, inOuter && (onBorder || inCore), true);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0, true);
    setModule(i, 6, i % 2 === 0, true);
  }

  // Alignment pattern for Version 3 at (22, 22)
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
      setModule(22 + dr, 22 + dc, dark, true);
    }
  }

  // Reserve format info bits & dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunc[8][i] = true;
      isFunc[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunc[8][size - 1 - i] = true;
    if (i < 7) isFunc[size - 1 - i][8] = true;
  }
  setModule(size - 8, 8, true, true);

  // Place data + ECC bits in zig-zag
  const allBits: number[] = [];
  for (const byte of allCodewords) {
    for (let b = 7; b >= 0; b--) allBits.push((byte >>> b) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (const c of [rightCol, rightCol - 1]) {
        if (!isFunc[r][c]) {
          const dark = bitIdx < allBits.length ? allBits[bitIdx] === 1 : false;
          modules[r][c] = dark;
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }

  // Apply Mask 0: (r + c) % 2 === 0
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunc[r][c] && (r + c) % 2 === 0) {
        modules[r][c] = !modules[r][c];
      }
    }
  }

  // Format information for ECC-L (01) + Mask 0 (000) -> 15-bit BCH masked with 0x5412 = 0b111011111000100 (0x77C4)
  const formatBits = 0b111011111000100;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >>> i) & 1) === 1;
    if (i < 6) modules[i][8] = bit;
    else if (i < 8) modules[i + 1][8] = bit;
    else modules[size - 15 + i][8] = bit;

    if (i < 8) modules[8][size - 1 - i] = bit;
    else if (i < 9) modules[8][15 - i] = bit;
    else modules[8][14 - i] = bit;
  }

  return modules;
}
