import { initFirebase } from "./_firebase-init.mjs";

const db = initFirebase();
const cid = "620611";

async function main() {
  const allSnap = await db.ref(`allbookings/${cid}`).limitToLast(100).once("value");
  const all = allSnap.val() ?? {};
  const allIds = Object.keys(all);

  // Find legacy (SA-created) records — no CreatedBy field
  const legacyIds = allIds.filter((id) => {
    const r = all[id] ?? {};
    return !r.CreatedBy;
  });
  console.log(`Found ${legacyIds.length} legacy SA-created records.`);

  // Sample 3 legacy records with the most fields (likely fully-populated, completed jobs)
  const ranked = legacyIds
    .map((id) => ({ id, count: Object.keys(all[id] ?? {}).length, rec: all[id] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  for (const { id, count, rec } of ranked) {
    console.log(`\n=== LEGACY SAMPLE allbookings/${cid}/${id}  (${count} fields) ===`);
    console.log(JSON.stringify(rec, null, 2));
  }

  // Field-name UNION across all legacy records (to capture all possible time/dispatch fields)
  const allLegacyKeys = new Set();
  for (const id of legacyIds) {
    for (const k of Object.keys(all[id] ?? {})) allLegacyKeys.add(k);
  }
  console.log("\n=== UNION of all keys across legacy SA records ===");
  console.log([...allLegacyKeys].sort().join("\n"));

  // What our WEB record has
  const ourSnap = await db.ref(`allbookings/${cid}/6206112605095`).once("value");
  const ours = ourSnap.val() ?? {};
  const ourKeys = new Set(Object.keys(ours));
  const onlySa = [...allLegacyKeys].filter((k) => !ourKeys.has(k)).sort();
  console.log("\n=== KEYS LEGACY HAS THAT OUR RECORD DOES NOT ===");
  console.log(onlySa.join("\n"));

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
