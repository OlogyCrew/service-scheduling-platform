import assert from "node:assert/strict";
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

// Controlled discovery-to-review pilot only. NEVER submits booking/quote/payment APIs.
// Token-bearing URLs stay in a permission-restricted temporary file, not stdout.
const base = process.env.PILOT_BASE_URL ?? "http://127.0.0.1:3000";
const statePath = process.env.PILOT_STATE_PATH ?? "/tmp/ologycrew-agent-pilot-state.json";
const resultPath = process.env.PILOT_RESULT_PATH ?? "/tmp/ologycrew-agent-pilot-results.json";
const serviceIds = [330003, 930001];
const connection = await mysql.createConnection(process.env.DATABASE_URL!);
const steps: string[] = [];
async function snapshot() {
  const [rows] = await connection.execute<any[]>(`SELECT
    (SELECT COUNT(*) FROM bookings WHERE serviceId IN (?, ?)) AS bookings,
    (SELECT COUNT(*) FROM quote_requests WHERE serviceId IN (?, ?)) AS quotes,
    (SELECT COUNT(*) FROM payments p JOIN bookings b ON p.bookingId=b.id WHERE b.serviceId IN (?, ?)) AS payments`, [...serviceIds, ...serviceIds, ...serviceIds]);
  return Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]));
}
async function read(path: string) {
  assert(/^\/(services\?|providers\/|availability\/)/.test(path));
  const response = await fetch(`${base}/api/public${path}`);
  assert.equal(response.status, 200, `Read-only public endpoint failed: ${path}`);
  const body = await response.json();
  assert.equal(body.success, true);
  return body;
}
try {
  if (process.argv.includes("--verify")) {
    const state = JSON.parse(await fs.readFile(statePath, "utf8"));
    const afterBrowser = await snapshot();
    assert.deepEqual(afterBrowser, state.before, "Commerce record counts changed during review pilot");
    const result = JSON.parse(await fs.readFile(resultPath, "utf8"));
    result.afterBrowser = afterBrowser;
    result.browserRecordCountsUnchanged = true;
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2) + "\n");
    console.log("Post-browser verification: commerce counts unchanged.");
  } else {
    const before = await snapshot();
    const search = await read("/services?q=Chisolm&limit=20");
    assert(search.data.some((item: any) => item.id === serviceIds[0]));
    assert(search.data.every((item: any) => item.isDemo === false));
    steps.push("Real Chisolm Audio discovery; default results explicitly exclude demos");
    const inclusive = await read("/services?q=audio&includeDemo=true&limit=50");
    assert(inclusive.data.some((item: any) => item.isDemo === true && item.provider.isDemo === true));
    const firstDemo = inclusive.data.findIndex((item: any) => item.isDemo === true);
    assert(inclusive.data.slice(firstDemo).every((item: any) => item.isDemo === true), "Real results must precede demos");
    steps.push("Explicitly included demos labeled and placed after real providers");
    const provider = await read("/providers/chisolm-audio");
    assert.equal(provider.data.isDemo, false);
    const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const availability = await read(`/availability/1?serviceId=${serviceIds[0]}&date=${date}`);
    assert.equal(availability.data.holdsCreated, 0);
    assert.equal(availability.data.bookingMode, "direct");
    const start = availability.data.availableSlots.find((slot: any) => slot.startTime === "10:00") ?? availability.data.availableSlots[0];
    assert(start, "Pilot service needs an available start; no hold will be created");
    steps.push("Current service-specific availability; no hold created");
    const cases = [
      { name: "direct", serviceId: serviceIds[0], intent: "Controlled agent pilot: review audio support for a community event; do not submit.", location: "Hoschton, GA", preferredDate: date, preferredTime: start.startTime },
      { name: "quote", serviceId: serviceIds[1], intent: "Controlled agent pilot: review a custom audio-cleanup request; do not submit.", location: "Remote review only", timing: "Review options before requesting a quote" },
    ];
    const handoffs: Record<string, any> = {};
    for (const item of cases) {
      const { name, ...request } = item;
      const response = await fetch(`${base}/api/public/handoffs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      assert.equal(response.status, 201, `${name} review handoff was not prepared`);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = await response.json();
      assert.equal(body.data.mode, name);
      for (const key of ["createsBooking", "createsQuote", "createsHold", "collectsPayment"]) assert.equal(body.data[key], false);
      assert.equal(body.data.requiresHumanReview, true);
      const url = new URL(body.data.reviewUrl);
      assert.equal(url.origin, "https://ologycrew.com");
      assert(!url.href.includes(request.intent));
      const page = await fetch(`${base}${url.pathname}${url.search}`);
      assert.equal(page.status, 200);
      assert.equal(page.headers.get("cache-control"), "private, no-store");
      assert.equal(page.headers.get("referrer-policy"), "no-referrer");
      handoffs[name] = { relativeUrl: `${url.pathname}${url.search}`, serviceId: request.serviceId, expiresAt: body.data.expiresAt };
      steps.push(`${name}: encrypted review link prepared; private/no-store/no-referrer HTML; no transaction`);
    }
    const afterPreparation = await snapshot();
    assert.deepEqual(afterPreparation, before, "Handoff preparation changed commerce record counts");
    await fs.writeFile(statePath, JSON.stringify({ base, before, handoffs }, null, 2) + "\n", { mode: 0o600 });
    await fs.chmod(statePath, 0o600);
    await fs.writeFile(resultPath, JSON.stringify({ checkedAt: new Date().toISOString(), steps, before, afterPreparation, commerceCountsUnchanged: true, transactionsSubmitted: 0 }, null, 2) + "\n");
    console.log(`Controlled API-to-review pilot passed ${steps.length} checks. Zero transactions submitted. Token URLs stored privately.`);
    console.log(`Results: ${resultPath}`);
  }
} finally {
  await connection.end();
}
