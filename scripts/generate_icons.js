const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table & helper
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(typeAndData), 8 + len);
  return buf;
}

function generateIconPNG(size, isMaskable = false) {
  const width = size;
  const height = size;

  // RGBA buffer
  const rawScanlines = Buffer.alloc(height * (1 + width * 4));

  // Colors
  // Background: Slate-900 #0F172A
  const bgR = 15, bgG = 23, bgB = 42;
  // Accent/Emblem: Slate-100 #F1F5F9
  const fgR = 241, fgG = 245, fgB = 249;
  // Border: Slate-700 #334155
  const bR = 51, bG = 65, bB = 85;

  const center = size / 2;
  const radius = isMaskable ? size * 0.48 : size * 0.42;
  const cOuterRadius = size * 0.28;
  const cInnerRadius = size * 0.17;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawScanlines[offset++] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = bgR, g = bgG, b = bgB, a = 255;

      // Outer rounded emblem if not maskable
      if (!isMaskable) {
        // Rounded rectangle / badge
        const cornerRadius = size * 0.2;
        const half = size * 0.44;
        const qx = Math.max(0, Math.abs(dx) - (half - cornerRadius));
        const qy = Math.max(0, Math.abs(dy) - (half - cornerRadius));
        const boxDist = Math.sqrt(qx * qx + qy * qy);
        
        if (boxDist > cornerRadius) {
          a = 0; // Transparent outside badge
        } else if (boxDist > cornerRadius - 2) {
          // Soft edge
          const alphaFactor = Math.max(0, Math.min(1, (cornerRadius - boxDist) / 2));
          a = Math.floor(255 * alphaFactor);
        }
      }

      // Draw the stylized "C" (Coronado) if inside
      if (a > 0) {
        // Arc of "C"
        const angle = Math.atan2(dy, dx); // -PI to PI
        const inGap = (angle > -0.65 && angle < 0.65); // Opening of "C" on right side
        
        if (dist >= cInnerRadius && dist <= cOuterRadius && !inGap) {
          r = fgR; g = fgG; b = fgB;
        } else {
          // Rounded caps on the opening of "C"
          const capTopX = Math.cos(-0.65) * ((cInnerRadius + cOuterRadius) / 2);
          const capTopY = Math.sin(-0.65) * ((cInnerRadius + cOuterRadius) / 2);
          const capBotX = Math.cos(0.65) * ((cInnerRadius + cOuterRadius) / 2);
          const capBotY = Math.sin(0.65) * ((cInnerRadius + cOuterRadius) / 2);
          const capRadius = (cOuterRadius - cInnerRadius) / 2;

          const distTop = Math.sqrt((dx - capTopX) ** 2 + (dy - capTopY) ** 2);
          const distBot = Math.sqrt((dx - capBotX) ** 2 + (dy - capBotY) ** 2);

          if (distTop <= capRadius || distBot <= capRadius) {
            r = fgR; g = fgG; b = fgB;
          }
        }
      }

      rawScanlines[offset++] = r;
      rawScanlines[offset++] = g;
      rawScanlines[offset++] = b;
      rawScanlines[offset++] = a;
    }
  }

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression: Deflate
  ihdrData[11] = 0; // Filter: Adaptive
  ihdrData[12] = 0; // Interlace: None
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const compressedData = zlib.deflateSync(rawScanlines, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate icons
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const iconsToGenerate = [
  { file: 'icon-192x192.png', size: 192, maskable: false },
  { file: 'icon-512x512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192x192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512x512.png', size: 512, maskable: true },
  { file: 'icon-152x152.png', size: 152, maskable: false }
];

iconsToGenerate.forEach(icon => {
  const buf = generateIconPNG(icon.size, icon.maskable);
  const outPath = path.join(iconsDir, icon.file);
  fs.writeFileSync(outPath, buf);
  console.log(`[Icon Created]: ${outPath} (${buf.length} bytes)`);
});

// Also create SVG vector icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="100" fill="#0F172A"/>
  <path d="M 350 160 C 315 125, 230 115, 175 165 C 115 220, 115 292, 175 347 C 230 397, 315 387, 350 352" 
        fill="none" stroke="#F8FAFC" stroke-width="56" stroke-linecap="round"/>
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent);
console.log('[Icon Created]: SVG vector icon created.');
