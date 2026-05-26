// firebase-admin is a CommonJS package, use createRequire for reliable interop
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDIVSI_GRYG0hCPvc9h80QXZMxwZoejctQ",
  authDomain: "bookawaka2026-564e1.firebaseapp.com",
  databaseURL: "https://bookawaka2026-564e1-default-rtdb.firebaseio.com",
  projectId: "bookawaka2026-564e1",
  storageBucket: "bookawaka2026-564e1.firebasestorage.app",
  messagingSenderId: "909621127467",
  appId: "1:909621127467:web:504f502a533ca0a216fd6e",
};

let app: any = null;

function getCredentials(): { projectId: string; clientEmail: string; privateKey: string } {
  // First try: FIREBASE_PRIVATE_KEY might contain the full service account JSON
  const raw = process.env.FIREBASE_PRIVATE_KEY ?? "";

  if (raw.trim().startsWith("{")) {
    try {
      const sa = JSON.parse(raw);
      const privateKey = (sa.private_key as string).replace(/\\n/g, "\n");
      return {
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey,
      };
    } catch {
      // fall through to individual vars
    }
  }

  // Second try: individual env vars
  const privateKey = raw.replace(/\\n/g, "\n");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
  const projectId = process.env.FIREBASE_PROJECT_ID ?? FIREBASE_CONFIG.projectId;

  if (!privateKey || !clientEmail || !projectId) {
    throw new Error(
      "Firebase credentials not configured. Set FIREBASE_PRIVATE_KEY (service account JSON or key), FIREBASE_CLIENT_EMAIL, FIREBASE_PROJECT_ID."
    );
  }

  return { projectId, clientEmail, privateKey };
}

function getDatabaseURL(projectId: string): string {
  return (
    process.env.FIREBASE_DATABASE_URL ??
    FIREBASE_CONFIG.databaseURL ??
    `https://${projectId}-default-rtdb.firebaseio.com`
  );
}

export function getFirebaseAdmin(): any {
  if (app) return app;

  const { projectId, clientEmail, privateKey } = getCredentials();

  app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
    databaseURL: getDatabaseURL(projectId),
  });

  return app;
}

export function getDatabase(): ReturnType<typeof admin.database> {
  getFirebaseAdmin();
  return admin.database();
}

export function getAuth(): ReturnType<typeof admin.auth> {
  getFirebaseAdmin();
  return admin.auth();
}
