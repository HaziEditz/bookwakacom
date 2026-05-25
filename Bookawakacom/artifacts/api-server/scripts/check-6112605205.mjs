import { initFirebase } from "./_firebase-init.mjs";
const db = initFirebase();

const bid = "6112605205";
const cid = "620611";

console.log("=== allbookings/" + cid + "/" + bid + " ===");
const ab = (await db.ref(`allbookings/${cid}/${bid}`).once("value")).val();
console.log(JSON.stringify(ab, null, 2));

console.log("\n=== pendingjobs/" + cid + "/" + bid + " ===");
const pj = (await db.ref(`pendingjobs/${cid}/${bid}`).once("value")).val();
console.log(JSON.stringify(pj, null, 2));
process.exit(0);
