import { initFirebase } from "./_firebase-init.mjs";

const PHONE_RAW = process.argv[2] ?? "0275683723";
const phoneKey = PHONE_RAW.replace(/[^0-9]/g, "");

const db = initFirebase();

async function main() {
  console.log(`Looking up passenger key for phone: ${PHONE_RAW} (normalized: ${phoneKey})`);

  const idxSnap = await db.ref(`passengerIndex/phone/${phoneKey}`).once("value");
  const idx = idxSnap.val();
  if (!idx?.key) {
    console.log(`No passengerIndex entry for phone ${phoneKey} — nothing to clear.`);
    process.exit(0);
  }

  const passengerKey = idx.key;
  console.log(`Resolved passengerKey: ${passengerKey}`);

  const jobsSnap = await db.ref(`Passengerjobs/${passengerKey}`).once("value");
  const jobs = jobsSnap.val() ?? {};
  const jobIds = Object.keys(jobs);
  console.log(`Found ${jobIds.length} entries under Passengerjobs/${passengerKey}:`);
  for (const id of jobIds) {
    const j = jobs[id] ?? {};
    console.log(`  - ${id}  status=${j.Status ?? j.status ?? "?"}  pick=${j.PickAddress ?? "?"}`);
  }

  if (jobIds.length === 0) {
    console.log("Nothing to delete.");
    process.exit(0);
  }

  await db.ref(`Passengerjobs/${passengerKey}`).remove();
  console.log(`✓ Deleted Passengerjobs/${passengerKey} (${jobIds.length} entries).`);
  console.log("Note: allbookings and pendingjobs are untouched — SA portal history is preserved.");

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
