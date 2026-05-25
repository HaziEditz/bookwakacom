import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const require = createRequire(import.meta.url);
require("dotenv").config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"),
});

const DEFAULT_DATABASE_URL = "https://bookawaka2026-564e1-default-rtdb.firebaseio.com";

export function initFirebase() {
  const raw = process.env.FIREBASE_PRIVATE_KEY ?? "";
  let projectId = process.env.FIREBASE_PROJECT_ID ?? "bookawaka2026-564e1";
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
  let privateKey = raw.replace(/\\n/g, "\n");

  if (raw.trim().startsWith("{")) {
    const sa = JSON.parse(raw);
    projectId = sa.project_id;
    clientEmail = sa.client_email;
    privateKey = sa.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    databaseURL: process.env.FIREBASE_DATABASE_URL ?? DEFAULT_DATABASE_URL,
  });

  return admin.database();
}
