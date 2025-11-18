// src/parsers/pdfParser.js
// Robust PDF text extractor for Node environments with pdfjs-dist idiosyncrasies.
// - Adds a tiny DOMMatrix polyfill if missing (PDF.js expects it).
// - Attempts to require legacy build(s) of pdfjs-dist.
// - Extracts text via getTextContent() per page.
// - Returns string text or throws an informative error.

const fs = require('fs');

function ensureDOMMatrix() {
  if (typeof global.DOMMatrix === 'undefined') {
    // Minimal polyfill used only to satisfy pdfjs-dist checks.
    // This is NOT a full DOMMatrix implementation, but suffices for text extraction in many cases.
    global.DOMMatrix = class DOMMatrix {
      constructor() {
        // no-op minimal shim
      }
      // include common methods as no-op to avoid runtime errors if called
      toFloat32Array() { return new Float32Array(); }
      toFloat64Array() { return new Float64Array(); }
    };
  }
}

function tryRequire(paths) {
  for (const p of paths) {
    try {
      // eslint-disable-next-line global-require
      const mod = require(p);
      if (mod) return mod;
    } catch (e) {
      // continue trying next
    }
  }
  return null;
}

async function extractTextWithPdfjs(pdfjs) {
  const getDocument = pdfjs.getDocument || (pdfjs && pdfjs.default && pdfjs.default.getDocument) || null;
  if (typeof getDocument !== 'function') {
    throw new Error('pdfjs-dist does not expose getDocument(); module keys: ' + JSON.stringify(Object.keys(pdfjs || {}).slice(0,30)));
  }

  return async function extract(filePath) {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = getDocument({ data });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // content.items elements often include .str property
      const strings = (content.items || []).map(item => (item.str || item.c || '').trim());
      const pageText = strings.join(' ').replace(/\s+/g, ' ').trim();
      if (pageText) fullText += pageText + '\n\n';
    }

    try { await pdf.destroy(); } catch (e) { /* ignore */ }
    return fullText;
  };
}

async function extractTextFromPDF(filePath) {
  // ensure minimal global polyfills
  ensureDOMMatrix();

  // Try to load legacy build first (recommended for Node)
  const candidates = [
    'pdfjs-dist/legacy/build/pdf.js',
    'pdfjs-dist/legacy/build/pdf',       // alternate naming
    'pdfjs-dist/build/pdf.js',
    'pdfjs-dist/build/pdf',
    'pdfjs-dist'
  ];

  const pdfjs = tryRequire(candidates);

  if (!pdfjs) {
    throw new Error("Cannot locate pdfjs-dist module. Please run: npm install pdfjs-dist (or move project to a path without spaces) and retry. Searched: " + JSON.stringify(candidates));
  }

  // If require gave a top-level object that immediately threw DOMMatrix error previously,
  // ensure we have the polyfill (done above), then proceed to get extractor.
  const extractor = await extractTextWithPdfjs(pdfjs);
  return extractor(filePath);
}

module.exports = { extractTextFromPDF };
