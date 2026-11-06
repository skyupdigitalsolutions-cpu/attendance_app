// Reading lists pasted from Excel / Google Sheets (tab-separated) or CSV files.

/** Splits text into rows of cells. Handles tabs, commas or semicolons, and "quoted, cells". */
export function parseTable(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const sample = lines[0];
  const sep = sample.includes("\t") ? "\t" : (sample.match(/;/g) || []).length > (sample.match(/,/g) || []).length ? ";" : ",";
  return lines.map((line) => {
    const cells = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { cells.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");
const real = (y, m, d) => {
  const s = `${y}-${pad(m)}-${pad(d)}`;
  return new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s ? s : null;
};

/**
 * "2027-01-26", "26-01-2027", "26/01/2027", "26.01.2027", "26 Jan 2027", "Jan 26, 2027", "26-Jan-27" → "2027-01-26".
 * Day-first for numbers (Indian format). Returns null when it can't be read.
 */
export function normalizeDate(input) {
  const s = String(input || "").trim().replace(/(\d)(st|nd|rd|th)\b/i, "$1");
  let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) return real(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s))) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return real(y, +m[2], +m[1]);
  }
  if ((m = /^(\d{1,2})[\s-]+([a-z]{3,})[\s,-]+(\d{2}|\d{4})$/i.exec(s))) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return mo ? real(y, mo, +m[1]) : null;
  }
  if ((m = /^([a-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/i.exec(s))) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    return mo ? real(+m[3], mo, +m[2]) : null;
  }
  return null;
}

/** Drops a header row if the first row looks like column names. */
export const withoutHeader = (rows, words) =>
  rows.length && rows[0].some((c) => words.some((w) => c.toLowerCase().includes(w))) ? rows.slice(1) : rows;

export function downloadText(filename, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Reads a chosen .csv / .txt file as text. */
export const readFile = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result || ""));
  r.onerror = () => rej(new Error("Couldn't read that file"));
  r.readAsText(file);
});