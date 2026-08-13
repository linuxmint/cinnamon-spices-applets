function parseList(val) {
  if (!val) return [];
  if (typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return []; } }
  return Array.isArray(val) ? val : [];
}

if (typeof module !== 'undefined') module.exports = { parseList };
