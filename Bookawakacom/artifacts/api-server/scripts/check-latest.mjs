import { initFirebase } from "./_firebase-init.mjs";
const db = initFirebase();

const cid = "620611";
// Order by CreatedAt to actually get newest
console.log("=== Last 8 allbookings/" + cid + " by CreatedAt ===");
const all = await db.ref(`allbookings/${cid}`).orderByChild("CreatedAt").limitToLast(8).once("value");
const items = all.val() ?? {};
// Sort by CreatedAt desc
const sorted = Object.entries(items).sort((a,b) => (b[1].CreatedAt ?? "").localeCompare(a[1].CreatedAt ?? ""));
for (const [bid, b] of sorted) {
  const pj = (await db.ref(`pendingjobs/${cid}/${bid}`).once("value")).val();
  console.log(`${bid} | CreatedAt=${b.CreatedAt} | Status=${b.Status}/${b.status} | pay=${b.paymentMethod}/${b.paymentStatus} | ${b.PassengerName||"?"} ${b.PassengerPhone||""} | svc=${b.ServiceType} | CreatedBy=${b.CreatedBy} | pendingjobs=${pj ? "YES("+pj.Status+")" : "NO"}`);
}
process.exit(0);
