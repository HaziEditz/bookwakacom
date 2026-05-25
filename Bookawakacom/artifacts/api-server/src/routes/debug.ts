import { Router } from "express";
import { getFirebaseAdmin } from "../lib/firebase";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

const debugRouter = Router();

debugRouter.get("/debug/rtdb", async (_req, res) => {
  try {
    getFirebaseAdmin();
    const db = admin.database();
    const snapshot = await db.ref("/").once("value");
    res.json({ data: snapshot.val() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default debugRouter;
