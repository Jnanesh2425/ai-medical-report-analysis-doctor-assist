const mammoth = require('mammoth');

async function extractTextFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  // mammoth returns a string with newline-separated paragraphs
  return (result && result.value) ? result.value : '';
}

module.exports = { extractTextFromDocx };
