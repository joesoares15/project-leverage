import { CONFIG } from "../config.js";
import { getText } from "./http.js";
import { normalizeName, parseCsv } from "../utils.js";

export async function loadMarketValues() {
  const text = await getText(CONFIG.dynastyValuesUrl, "Could not load dynasty values");
  const rows = parseCsv(text);
  const header = rows.shift() || [];
  const column = Object.fromEntries(header.map((name, index) => [name, index]));
  const values = new Map();

  for (const row of rows) {
    const name = row[column.player];
    if (!name) continue;
    values.set(normalizeName(name), {
      name,
      position: row[column.pos],
      team: row[column.team],
      age: Number(row[column.age]) || null,
      oneQb: Number(row[column.value_1qb]) || 0,
      superflex: Number(row[column.value_2qb]) || 0,
    });
  }

  return {
    values,
    valueDate: rows[0]?.[column.scrape_date] || null,
  };
}
