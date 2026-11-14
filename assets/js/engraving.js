
(() => {
  'use strict';

  const preview = document.querySelector('.preview-stage');
  const photo = document.getElementById('preview-image');
  const relief = document.querySelector('.engraving-relief');
  if (!preview || !photo || !relief) return;

  const shadow = relief.querySelector('.engraving-shadow');
  const highlight = relief.querySelector('.engraving-highlight');
  const mask = document.createElement('canvas');
  const maskContext = mask.getContext('2d', { willReadFrequently: true });
  const shadowContext = shadow.getContext('2d');
  const highlightContext = highlight.getContext('2d');
  if (!maskContext || !shadowContext || !highlightContext) return;

  // Corners follow the wood in the original photo, clockwise from top left.
  const surfaces = Object.create(null);
  for (const card of document.querySelectorAll('.product-card[data-geometry]')) {
    if (card.dataset.personalization !== '1') continue;
    try {
      const geometry = JSON.parse(card.dataset.geometry);
      if (geometry && Array.isArray(geometry.corners) && geometry.corners.length === 4) surfaces[card.dataset.product] = geometry;
    } catch (_) { /* Unsupported products retain a neutral preview. */ }
  }

  const fonts = {
    serif: '400 {size}px Prata, Georgia, serif',
    sans: '700 {size}px Manrope, Arial, sans-serif',
    italic: 'italic 700 {size}px Georgia, "Times New Roman", serif'
  };
  const quotes = document.getElementById('preview-quote');
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ru') : null;
  let frame = 0;

  function fontAt(style, size) {
    return (fonts[style] || fonts.serif).replace('{size}', size);
  }

  function imageCorners(surface) {
    const width = preview.clientWidth;
    const height = preview.clientHeight;
    const scale = getComputedStyle(photo).objectFit === 'cover'
      ? Math.max(width / photo.naturalWidth, height / photo.naturalHeight)
      : Math.min(width / photo.naturalWidth, height / photo.naturalHeight);
    const imageWidth = photo.naturalWidth * scale;
    const imageHeight = photo.naturalHeight * scale;
    const position = getComputedStyle(photo).objectPosition.split(' ').map(value => parseFloat(value) / 100);
    const left = (width - imageWidth) * position[0];
    const top = (height - imageHeight) * position[1];
    return surface.corners.map(([x, y]) => [left + imageWidth * x / 100, top + imageHeight * y / 100]);
  }

  // Project the rectangular glyph mask onto the four corners of the wood face.
  function project(corners, width, height) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const determinant = dx1 * dy2 - dx2 * dy1;
    const g = (dx3 * dy2 - dx2 * dy3) / determinant;
    const h = (dx1 * dy3 - dx3 * dy1) / determinant;
    return 'matrix3d(' + [
      (x1 - x0 + g * x1) / width, (y1 - y0 + g * y1) / width, 0, g / width,
      (x3 - x0 + h * x3) / height, (y3 - y0 + h * y3) / height, 0, h / height,
      0, 0, 1, 0, x0, y0, 0, 1
    ].join(',') + ')';
  }

  function fitText(text, style, width, height) {
    const maxWidth = width * .88;
    maskContext.font = fontAt(style, 100);
    const measure = line => maskContext.measureText(line).width;
    const oneLine = Math.min(height * .78, maxWidth * 100 / Math.max(measure(text), 1));
    const words = text.split(' ');
    if (words.length === 1 && oneLine < height * .33) {
      const glyphs = segmenter ? Array.from(segmenter.segment(text), item => item.segment) : Array.from(text);
      const middle = Math.ceil(glyphs.length / 2);
      if (glyphs.length > 16) words.splice(0, 1, glyphs.slice(0, middle).join(''), glyphs.slice(middle).join(''));
    }
    let lines = [text];
    let size = oneLine;
    for (let i = 1; i < words.length; i += 1) {
      const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const twoLine = Math.min(height * .45, maxWidth * 100 / Math.max(...pair.map(measure), 1));
      if (twoLine > size * 1.06) {
        size = twoLine;
        lines = pair;
      }
    }
    return { lines, size };
  }

  function paintMask(text, style, width, height, resolution) {
    mask.width = shadow.width = highlight.width = width;
    mask.height = shadow.height = highlight.height = height;
    const { lines, size } = fitText(text, style, width, height);
    maskContext.font = fontAt(style, size);
    maskContext.textAlign = 'center';
    maskContext.textBaseline = 'alphabetic';
    const metrics = lines.map(line => maskContext.measureText(line));
    const ascent = Math.max(...metrics.map(metric => metric.actualBoundingBoxAscent));
    const descent = Math.max(...metrics.map(metric => metric.actualBoundingBoxDescent));
    const lineHeight = size * 1.05;
    const firstBaseline = (height - ascent - descent - lineHeight * (lines.length - 1)) / 2 + ascent;
    // Keep fine strokes from disappearing into the grain at small display sizes.
    const fine = Math.max(0, Math.min(1, (28 - size / resolution) / 18));
    maskContext.lineWidth = Math.max(.01, .82 * resolution * fine);
    maskContext.lineJoin = 'round';
    lines.forEach((line, index) => {
      const baseline = firstBaseline + index * lineHeight;
      maskContext.fillText(line, width / 2, baseline);
      if (fine) maskContext.strokeText(line, width / 2, baseline);
    });
    return { glyphs: maskContext.getImageData(0, 0, width, height).data, fine };
  }

  function paintRelief({ glyphs, fine }, width, height, surface, resolution) {
    const dark = shadowContext.createImageData(width, height);
    const bright = highlightContext.createImageData(width, height);
    const [lightX, lightY] = surface.lightDirection;
    const dx = Math.round(lightX * resolution);
    const dy = Math.round(lightY * resolution);
    const depth = surface.depth + .18 * fine;
    const edgeLight = surface.light * (1 - .25 * fine);
    const sample = (x, y) => (
      x >= 0 && x < width && y >= 0 && y < height ? glyphs[(y * width + x) * 4 + 3] : 0
    );

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = (y * width + x) * 4;
        const coverage = glyphs[pixel + 3];
        if (!coverage) continue;
        const darkEdge = Math.max(0, coverage - sample(x + dx, y + dy));
        const lightEdge = Math.max(0, coverage - sample(x - dx, y - dy));
        dark.data[pixel] = 60;
        dark.data[pixel + 1] = 36;
        dark.data[pixel + 2] = 24;
        dark.data[pixel + 3] = coverage * depth + darkEdge * .28 - lightEdge * .20;
        bright.data[pixel] = 255;
        bright.data[pixel + 1] = 205;
        bright.data[pixel + 2] = 141;
        bright.data[pixel + 3] = lightEdge * edgeLight;
      }
    }
    shadowContext.putImageData(dark, 0, 0);
    highlightContext.putImageData(bright, 0, 0);
  }

  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function render() {
    frame = 0;
    const surface = surfaces[preview.dataset.product];
    const text = preview.dataset.engravingText;
    if (!surface || !text || !photo.complete || !photo.naturalWidth || photo.currentSrc !== photo.src || !preview.clientWidth) {
      relief.hidden = true;
      return;
    }

    const corners = imageCorners(surface);
    const [a, b, c, d] = corners;
    const width = (distance(a, b) + distance(c, d)) / 2;
    const height = (distance(a, d) + distance(b, c)) / 2 * (surface.stretch || 1);
    const resolution = Math.min(2.5, Math.max(1.7, window.devicePixelRatio || 1));
    const pixelWidth = Math.max(2, Math.round(width * resolution));
    const pixelHeight = Math.max(2, Math.round(height * resolution));
    const style = preview.dataset.engravingFont;
    const glyphMask = paintMask(text, style, pixelWidth, pixelHeight, resolution);
    paintRelief(glyphMask, pixelWidth, pixelHeight, surface, resolution);

    const transform = project(corners, width, height);
    [shadow, highlight].forEach(layer => {
      layer.style.width = width + 'px';
      layer.style.height = height + 'px';
      layer.style.transform = transform;
    });
    relief.hidden = false;
  }

  function requestRender() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  let pendingFont;
  function update() {
    requestRender();
    if (!document.fonts) return;
    const text = preview.dataset.engravingText || 'Анна';
    const font = fontAt(preview.dataset.engravingFont, 32);
    if (pendingFont === font || document.fonts.check(font, text)) return;
    pendingFont = font;
    document.fonts.load(font, text).then(requestRender, requestRender).finally(() => {
      if (pendingFont === font) pendingFont = undefined;
    });
  }

  photo.addEventListener('load', update);
  photo.addEventListener('error', () => { relief.hidden = true; });
  if ('ResizeObserver' in window) new ResizeObserver(requestRender).observe(preview);
  else window.addEventListener('resize', requestRender, { passive: true });
  new MutationObserver(update).observe(preview, {
    attributes: true,
    attributeFilter: ['data-product', 'data-engraving-text', 'data-engraving-font']
  });
  if (quotes && !preview.dataset.engravingText) preview.dataset.engravingText = quotes.value.replace(/^«|»$/g, '');
  update();
})();

