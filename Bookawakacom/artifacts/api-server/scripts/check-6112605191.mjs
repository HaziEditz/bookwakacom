import { initFirebase } from "./_firebase-init.mjs";
const db = initFirebase();

const key = "web_motzeoqg_qugcfu";
const cid = "620611";
const bid = "6112605191";

console.log("=== Passengerjobs/" + key + " keys ===");
const pj = (await db.ref(`Passengerjobs/${key}`).once("value")).val() ?? {};
for (const [k, v] of Object.entries(pj)) {
  console.log(`  ${k}: Status=${v.Status} status=${v.status} ServiceType=${v.ServiceType} BookingType=${v.BookingType} CreatedAt=${v.CreatedAt}`);
}

console.log("\n=== allbookings/" + cid + "/" + bid + " ===");
const ab = (await db.ref(`allbookings/${cid}/${bid}`).once("value")).val();
if (!ab) console.log("  NOT FOUND");
else {
  console.log("  Status:", ab.Status, "/ status:", ab.status);
  console.log("  paymentStatus:", ab.paymentStatus);
  console.log("  DriverId:", ab.DriverId ?? ab.driverId ?? "(none)");
  console.log("  CancelledAt:", ab.CancelledAt);
  console.log("  CompanyId:", ab.CompanyId);
}

console.log("\n=== passengerIndex/phone/021304322 ===");
console.log((await db.ref("passengerIndex/phone/021304322").once("value")).val());
console.log("=== passengerIndex/phone/0211304322 (no leading 0) ===");
console.log((await db.ref("passengerIndex/phone/21304322").once("value")).val());
process.exit(0);
