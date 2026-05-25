import { initFirebase } from "./_firebase-init.mjs";
const db = initFirebase();

// Resolve passenger key from phone or email
const phone = "021304322";
const email = "safinhmohammed@hotmail.com";

const normalizedPhone = phone.replace(/\D/g, "");
const normalizedEmail = email.toLowerCase().replace(/\./g, ",").replace(/@/g, "__at__");

console.log("=== passengerIndex lookup ===");
const byPhone = (await db.ref(`passengerIndex/phone/${normalizedPhone}`).once("value")).val();
const byEmail = (await db.ref(`passengerIndex/email/${normalizedEmail}`).once("value")).val();
console.log("phone ->", byPhone);
console.log("email ->", byEmail);

const key = byPhone?.key || byEmail?.key;
if (!key) { console.log("NO KEY FOUND"); process.exit(0); }
console.log("Resolved passenger key:", key);

console.log("\n=== Passengerjobs/" + key + " (raw) ===");
const jobs = (await db.ref(`Passengerjobs/${key}`).once("value")).val() ?? {};
const list = [];
for (const [jid, j] of Object.entries(jobs)) {
  list.push({
    jid,
    Status: j.Status ?? j.status,
    CreatedAt: j.CreatedAt,
    createdAt: j.createdAt,
    BookingDate: j.BookingDate,
    PickupTime: j.PickupTime,
    timestamp: j.timestamp,
    BookingId: j.BookingId,
    CompanyId: j.CompanyId,
    paymentMethod: j.paymentMethod,
    paymentStatus: j.paymentStatus,
    PickAddress: (j.PickAddress ?? "").slice(0, 40),
    DropAddress: (j.DropAddress ?? "").slice(0, 40),
    Prebook: j.Prebook,
    keysOnRecord: Object.keys(j).slice(0, 30),
  });
}
console.log(`Total: ${list.length}`);
for (const r of list) console.log(JSON.stringify(r, null, 2));
process.exit(0);
