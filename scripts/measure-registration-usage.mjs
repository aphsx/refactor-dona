#!/usr/bin/env node
/**
 * Measure Railway API cost of one registration cycle (createFarmer + full reload).
 *
 * Usage:
 *   DONA_API_URL=https://your-api.up.railway.app \
 *   DONA_USER=mill \
 *   DONA_PASS=secret \
 *   node scripts/measure-registration-usage.mjs
 *
 * Optional writes (staging only):
 *   node scripts/measure-registration-usage.mjs --register 5
 *
 * Does NOT need 25k requests — samples current size, then optionally a few creates.
 */

const API = (process.env.DONA_API_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const USER = process.env.DONA_USER || "";
const PASS = process.env.DONA_PASS || "";

const registerCount = (() => {
  const i = process.argv.indexOf("--register");
  if (i === -1) return 0;
  const n = Number(process.argv[i + 1] ?? "0");
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 50) : 0;
})();

if (!USER || !PASS) {
  console.error("Set DONA_USER and DONA_PASS (mill login).");
  process.exit(1);
}

const stats = { requests: 0, bytesIn: 0, byPath: /** @type {Record<string, {n:number, bytes:number}>} */ ({}) };

/** @param {string} path */
function pathKey(path) {
  const bare = path.split("?")[0];
  return bare.replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, "/:id");
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function api(path, init = {}) {
  const url = `${API}/api/v1${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  const buf = Buffer.from(await res.arrayBuffer());
  stats.requests += 1;
  stats.bytesIn += buf.length;
  const key = `${init.method || "GET"} ${pathKey(path)}`;
  const row = stats.byPath[key] || (stats.byPath[key] = { n: 0, bytes: 0 });
  row.n += 1;
  row.bytes += buf.length;

  let body = {};
  if (buf.length) {
    try {
      body = JSON.parse(buf.toString("utf8"));
    } catch {
      body = {};
    }
  }
  if (!res.ok) {
    const msg = typeof body?.error === "string" ? body.error : res.statusText;
    throw new Error(`${init.method || "GET"} ${path} → ${res.status}: ${msg}`);
  }
  return body;
}

function snapshotStats() {
  return {
    requests: stats.requests,
    bytesIn: stats.bytesIn,
    kb: +(stats.bytesIn / 1024).toFixed(1),
  };
}

function resetStats() {
  stats.requests = 0;
  stats.bytesIn = 0;
  for (const k of Object.keys(stats.byPath)) delete stats.byPath[k];
}

function printBreakdown() {
  const rows = Object.entries(stats.byPath).sort((a, b) => b[1].bytes - a[1].bytes);
  for (const [key, row] of rows) {
    console.log(`  ${key.padEnd(36)} ${String(row.n).padStart(4)} req  ${(row.bytes / 1024).toFixed(1)} KB`);
  }
}

/** unique Thai mobile-like tel matching farmers_tel_format */
function testTel(i) {
  const n = String(Date.now()).slice(-7) + String(i).padStart(2, "0");
  const dig = n.slice(-9);
  return `08${dig[0]}-${dig.slice(1, 4)}-${dig.slice(4, 8)}`;
}

async function main() {
  console.log(`API: ${API}`);
  console.log(`Mode: measure snapshot${registerCount ? ` + register ${registerCount} test farmer(s)` : " only (no writes)"}\n`);

  const login = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const token = login.token;
  if (!token) throw new Error("login returned no token");
  const auth = { Authorization: `Bearer ${token}` };

  /**
   * @param {string} path
   * @param {RequestInit} [init]
   */
  async function authed(path, init = {}) {
    return api(path, {
      ...init,
      headers: { ...auth, ...(init.headers || {}) },
    });
  }

  // replace list helpers to use authed — simplest: monkey via reassign by inlining below
  async function listAllAuth(path) {
    const items = [];
    let page = 1;
    for (;;) {
      const sep = path.includes("?") ? "&" : "?";
      const data = await authed(`${path}${sep}page=${page}&pageSize=100`);
      items.push(...(data.items ?? []));
      if (!data.hasMore) break;
      page += 1;
    }
    return items;
  }

  async function snapshot() {
    const [groups, farmers, plots, plantings, permissions, people] = await Promise.all([
      listAllAuth("/groups"),
      listAllAuth("/farmers"),
      listAllAuth("/plots"),
      listAllAuth("/plantings"),
      authed("/permissions").then((data) => data.items ?? []),
      listAllAuth("/people"),
    ]);
    return {
      groups: groups.length,
      farmers: farmers.length,
      plots: plots.length,
      plantings: plantings.length,
      permissions: permissions.length,
      people: people.length,
    };
  }

  resetStats();
  // count login separately already happened — reset after login for clean snapshot cost
  const loginBytes = stats.bytesIn;
  const loginReqs = stats.requests;
  console.log(`Login: ${loginReqs} req, ${(loginBytes / 1024).toFixed(1)} KB\n`);

  resetStats();
  const before = await snapshot();
  const snapCost = snapshotStats();
  console.log("=== One full reload (loadMillSnapshot) ===");
  console.log(`Counts: farmers=${before.farmers} plots=${before.plots} groups=${before.groups} plantings=${before.plantings} people=${before.people}`);
  console.log(`Cost:   ${snapCost.requests} req, ${snapCost.kb} KB`);
  printBreakdown();

  const predicted = 5 + 2 * Math.ceil(Math.max(before.farmers, 1) / 100);
  console.log(`\nPredicted GETs at ~${before.farmers} farmers (empty-ish plots): ~${predicted}`);
  console.log(`(formula: 5 + 2×ceil(farmers/100); plots/plantings add more pages)\n`);

  if (registerCount === 0) {
    console.log("Next:");
    console.log("  1) Open Railway → service → Metrics while you register ~20–50 farmers in the UI");
    console.log("  2) Or re-run with --register 5 on STAGING only");
    console.log(`  3) Extrapolate: ~${snapCost.requests + 1} req per successful create at current size`);
    console.log(`     × 1000 creates (rising size) ≈ earlier ~16k estimate for create+reload only`);
    return;
  }

  console.log(`=== Register ${registerCount} test farmer(s) ===`);
  const perCreate = [];
  for (let i = 0; i < registerCount; i++) {
    resetStats();
    const tel = testTel(i);
    await authed("/farmers", {
      method: "POST",
      body: JSON.stringify({
        firstName: "ทดสอบ",
        lastName: `Usage${i + 1}`,
        tel,
        address: "ที่อยู่ทดสอบ ห้ามใช้ production",
        provinceId: 1,
        districtId: 1,
        subdistrictId: 1,
        groupId: null,
      }),
    });
    await snapshot();
    const cost = snapshotStats();
    perCreate.push(cost);
    console.log(`  #${i + 1} ${tel}: ${cost.requests} req, ${cost.kb} KB`);
  }

  const avgReq = perCreate.reduce((s, c) => s + c.requests, 0) / perCreate.length;
  const avgKb = perCreate.reduce((s, c) => s + c.kb, 0) / perCreate.length;
  console.log(`\nAvg per create+reload: ${avgReq.toFixed(1)} req, ${avgKb.toFixed(1)} KB`);
  console.log("Delete test farmers from UI/DB when done. Prefer staging.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
