const VIEW_BOX_SIZE = 256;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomRange(rng, min, max) {
  return min + (max - min) * rng();
}

function circlePath(cx, cy, radius) {
  return [
    `M ${cx + radius} ${cy}`,
    `A ${radius} ${radius} 0 1 0 ${cx - radius} ${cy}`,
    `A ${radius} ${radius} 0 1 0 ${cx + radius} ${cy}`,
    "Z",
  ].join(" ");
}

function roundedRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M ${x + r} ${y}`,
    `H ${x + width - r}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V ${y + height - r}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

function splitText(text) {
  const chars = Array.from(String(text).trim()).filter(Boolean);
  return chars.length > 0 ? chars.slice(0, 6) : ["印"];
}

function buildLayout(chars, shape, rng) {
  const count = chars.length;
  const center = VIEW_BOX_SIZE / 2;
  const layouts = [];
  const push = (char, x, y, size, rotationRange = 6) => {
    layouts.push({
      char,
      x,
      y,
      size,
      rotate: randomRange(rng, -rotationRange, rotationRange),
      jitterX: randomRange(rng, -2.5, 2.5),
      jitterY: randomRange(rng, -2.0, 2.0),
    });
  };

  if (count === 1) {
    push(chars[0], center, center + 2, shape === "square" ? 108 : 114, 4);
    return layouts;
  }

  if (count === 2) {
    const step = shape === "square" ? 42 : 38;
    const size = shape === "square" ? 94 : 100;
    push(chars[0], center, center - step / 2, size, 4);
    push(chars[1], center, center + step / 2, size, 4);
    return layouts;
  }

  if (count === 3) {
    const topX = center - 29;
    const bottomX = center;
    const topY = center - 31;
    const bottomY = center + 34;
    const size = shape === "square" ? 66 : 70;
    push(chars[0], topX, topY, size, 5);
    push(chars[1], center + 29, topY, size, 5);
    push(chars[2], bottomX, bottomY, size, 5);
    return layouts;
  }

  if (count === 4) {
    const stepX = shape === "square" ? 44 : 41;
    const stepY = shape === "square" ? 43 : 40;
    const size = shape === "square" ? 62 : 64;
    push(chars[0], center - stepX / 2, center - stepY / 2, size, 5);
    push(chars[1], center + stepX / 2, center - stepY / 2, size, 5);
    push(chars[2], center - stepX / 2, center + stepY / 2, size, 5);
    push(chars[3], center + stepX / 2, center + stepY / 2, size, 5);
    return layouts;
  }

  const rows = Math.ceil(count / 2);
  const cell = shape === "square" ? 42 : 40;
  const startY = center - ((rows - 1) * cell) / 2;
  const startX = center - cell / 2;

  chars.forEach((char, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = col === 0 ? startX - 18 : startX + 18;
    const y = startY + row * cell;
    push(char, x, y, shape === "square" ? 56 : 52, 6);
  });

  return layouts;
}

function buildScratches(rng, shape) {
  const pathCount = shape === "square" ? 5 : 4;
  const strokes = [];
  for (let index = 0; index < pathCount; index += 1) {
    const x1 = randomRange(rng, 58, 198);
    const y1 = randomRange(rng, 60, 196);
    const x2 = x1 + randomRange(rng, -32, 32);
    const y2 = y1 + randomRange(rng, -28, 28);
    const cx1 = x1 + randomRange(rng, -14, 14);
    const cy1 = y1 + randomRange(rng, -12, 12);
    const cx2 = x2 + randomRange(rng, -14, 14);
    const cy2 = y2 + randomRange(rng, -12, 12);
    strokes.push(
      `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}" />`,
    );
  }
  return strokes.join("");
}

function shapeGeometry(shape) {
  if (shape === "square") {
    return {
      outerPath: roundedRectPath(34, 34, 188, 188, 24),
      clipPath: roundedRectPath(32, 32, 192, 192, 26),
      strokeWidth: 8,
      fillOpacity: 0.12,
    };
  }

  return {
    outerPath: circlePath(128, 128, 94),
    clipPath: circlePath(128, 128, 100),
    strokeWidth: 9,
    fillOpacity: 0.1,
  };
}

function buildTextMarkup(layout, color, rng) {
  return layout
    .map((item) => {
      const fontWeight = item.size >= 90 ? 700 : 800;
      const opacity = randomRange(rng, 0.9, 1);
      const textStroke = randomRange(rng, 0.55, 0.95);
      return `<text x="${(item.x + item.jitterX).toFixed(2)}" y="${(item.y + item.jitterY).toFixed(2)}" fill="${color}" fill-opacity="${opacity.toFixed(2)}" stroke="${color}" stroke-opacity="0.18" stroke-width="${textStroke.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-family="Hiragino Mincho ProN, Yu Mincho, Noto Serif JP, serif" font-size="${item.size.toFixed(1)}" font-weight="${fontWeight}" transform="rotate(${item.rotate.toFixed(2)} ${item.x.toFixed(2)} ${item.y.toFixed(2)})">${escapeXml(item.char)}</text>`;
    })
    .join("");
}

/**
 * @typedef {"circle" | "square"} HankoShape
 * @typedef {Object} CreateHankoSvgOptions
 * @property {string} text
 * @property {HankoShape} [shape]
 * @property {string} [color]
 * @property {number} [seed]
 * @property {boolean} [transparent]
 */

/**
 * Create a hanko-style SVG stamp.
 * @param {CreateHankoSvgOptions} options
 * @returns {string}
 */
export function createHankoSvg(options) {
  const text = String(options.text ?? "").trim() || "印";
  const shape = options.shape === "square" ? "square" : "circle";
  const color = options.color ?? "#b5442b";
  const seed = options.seed ?? hashString(`${text}|${shape}|${color}`);
  const transparent = options.transparent ?? true;
  const rng = mulberry32(seed);
  const chars = splitText(text);
  const geometry = shapeGeometry(shape);
  const layout = buildLayout(chars, shape, rng);
  const textMarkup = buildTextMarkup(layout, color, rng);
  const jitterText = buildTextMarkup(
    layout.map((item) => ({
      ...item,
      x: item.x + randomRange(rng, -1.2, 1.2),
      y: item.y + randomRange(rng, -1.2, 1.2),
      size: item.size * 0.98,
    })),
    color,
    rng,
  );
  const scratches = buildScratches(rng, shape);
  const clipId = `hanko-clip-${seed}`;
  const maskId = `hanko-mask-${seed}`;
  const grainId = `hanko-grain-${seed}`;
  const blurId = `hanko-blur-${seed}`;
  const distortId = `hanko-distort-${seed}`;
  const baseFrequencyX = shape === "square" ? 0.02 : 0.017;
  const baseFrequencyY = shape === "square" ? 0.024 : 0.02;
  const displacementScale = shape === "square" ? 4.2 : 3.4;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW_BOX_SIZE}" height="${VIEW_BOX_SIZE}" viewBox="0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}" role="img" aria-label="${escapeXml(text)}">
  <defs>
    <clipPath id="${clipId}">
      <path d="${geometry.clipPath}" />
    </clipPath>
    <mask id="${maskId}">
      <rect width="${VIEW_BOX_SIZE}" height="${VIEW_BOX_SIZE}" fill="white" />
      <g fill="none" stroke="black" stroke-linecap="round" stroke-width="2.4" opacity="0.9">
        ${scratches}
      </g>
    </mask>
    <filter id="${grainId}" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="${baseFrequencyX.toFixed(3)} ${baseFrequencyY.toFixed(3)}" numOctaves="2" seed="${seed}" result="noise" />
      <feColorMatrix in="noise" type="matrix" values="0.65 0 0 0 0.15 0 0.35 0 0 0.08 0 0 0.22 0.05 0 0 0 0.2 0" result="grain" />
      <feGaussianBlur in="grain" stdDeviation="0.42" />
    </filter>
    <filter id="${blurId}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="0.55" />
    </filter>
    <filter id="${distortId}" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="${(baseFrequencyX * 0.8).toFixed(3)} ${(baseFrequencyY * 0.8).toFixed(3)}" numOctaves="2" seed="${seed + 17}" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="${displacementScale}" xChannelSelector="R" yChannelSelector="G" />
      <feGaussianBlur stdDeviation="0.22" />
    </filter>
  </defs>
  ${transparent ? "" : `<rect width="${VIEW_BOX_SIZE}" height="${VIEW_BOX_SIZE}" fill="#fffdf8" />`}
  <g clip-path="url(#${clipId})">
    <g opacity="0.16" filter="url(#${grainId})">
      <path d="${geometry.outerPath}" fill="${color}" fill-opacity="${geometry.fillOpacity}" />
    </g>
    <g filter="url(#${distortId})" mask="url(#${maskId})">
      <path d="${geometry.outerPath}" fill="none" stroke="${color}" stroke-width="${geometry.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${geometry.outerPath}" fill="${color}" fill-opacity="0.08" />
      <g opacity="0.24" filter="url(#${blurId})" transform="translate(0.9 0.9)">
        ${jitterText}
      </g>
      <g>
        ${textMarkup}
      </g>
    </g>
  </g>
</svg>`;
}

/**
 * Convert an SVG string to a data URI.
 * @param {string} svg
 * @returns {string}
 */
export function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
