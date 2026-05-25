import { initFirebase } from "./_firebase-init.mjs";
const db = initFirebase();
const key = "web_motzeoqg_qugcfu";
const jobs = (await db.ref(`Passengerjobs/${key}`).once("value")).val() ?? {};
for (const [jid, j] of Object.entries(jobs)) {
  console.log("---", jid, "---");
  console.log("ScheduledFor:", JSON.stringify(j.ScheduledFor));
  console.log("ScheduledForMs:", JSON.stringify(j.ScheduledForMs));
  console.log("CreatedAt:", JSON.stringify(j.CreatedAt));
  console.log("BookingDateTime:", JSON.stringify(j.BookingDateTime));
  console.log("BookingDate:", JSON.stringify(j.BookingDate));
  console.log("PickupTime:", JSON.stringify(j.PickupTime));
  console.log("Prebook:", JSON.stringify(j.Prebook));
  console.log("IsPreBook:", JSON.stringify(j.IsPreBook));
  console.log("BookingType:", JSON.stringify(j.BookingType));
  console.log("Status:", JSON.stringify(j.Status));
  console.log("ServiceType:", JSON.stringify(j.ServiceType));
}
process.exit(0);
