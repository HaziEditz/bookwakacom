import { initFirebase } from "./_firebase-init.mjs";
const db = initFirebase();
const cutoffMs = Date.now() - 60 * 60 * 1000;
const snap = await db.ref("allbookings").once("value");
const all = snap.val() ?? {};
const recent = [];
for (const [cid, jobs] of Object.entries(all)) {
  for (const [jid, job] of Object.entries(jobs ?? {})) {
    const t = Date.parse(job.CreatedAt ?? job.createdAt ?? job.BookingDate ?? "");
    if (Number.isFinite(t) && t >= cutoffMs) {
      recent.push({
        cid, jid,
        t: new Date(t).toISOString(),
        status: job.Status ?? job.status,
        service: job.serviceType ?? job.ServiceType ?? "?",
        pay: job.paymentMethod ?? "?",
        passenger: job.PassengerName ?? job.PassengerPhone ?? "?",
        createdBy: job.CreatedBy ?? "?",
      });
    }
  }
}
recent.sort((a, b) => a.t.localeCompare(b.t));
console.log(`Found ${recent.length} bookings in last 60 min across all companies:`);
for (const r of recent) console.log(JSON.stringify(r));
// Also check pendingjobs
console.log("\n=== pendingjobs current state ===");
const pj = (await db.ref("pendingjobs").once("value")).val() ?? {};
for (const [cid, jobs] of Object.entries(pj)) {
  const jids = Object.keys(jobs ?? {});
  console.log(`  ${cid}: ${jids.length} pending → ${jids.join(", ")}`);
}
process.exit(0);
