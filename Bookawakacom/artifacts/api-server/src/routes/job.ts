import { Router } from "express";
import { getDatabase } from "../lib/firebase";

const jobRouter = Router();

const VALID_SOURCES = ["dispatch", "hail", "passenger", "web", "food", "freight"] as const;
type JobSource = (typeof VALID_SOURCES)[number];

function todayKey(): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

async function nextSequence(companyId: string, dateKey: string): Promise<number> {
  const db = getDatabase();
  const ref = db.ref(`jobCounters/${companyId}/${dateKey}`);
  const result = await ref.transaction((current: unknown) => {
    // current may be null (first write) or a number. Guard against any
    // unexpected type — the transaction callback can receive a speculative
    // non-null value on the first pass before the server round-trip.
    const n = current == null ? 0 : Number(current);
    return (isFinite(n) ? n : 0) + 1;
  });
  const committed = result.snapshot.val();
  // Fall back to 1 if the transaction was aborted or the value is unusable.
  return typeof committed === "number" && isFinite(committed) ? committed : 1;
}

jobRouter.post("/job/create", async (req, res) => {
  const {
    companyId,
    source,
    passenger,
    pickup,
    dropoff,
    tariffId,
    notes,
  } = req.body as {
    companyId?: string;
    source?: string;
    passenger?: { name?: string; phone?: string };
    pickup?: { address?: string; lat?: number; lng?: number };
    dropoff?: { address?: string; lat?: number; lng?: number };
    tariffId?: string;
    notes?: string;
  };

  if (!companyId) {
    res.status(400).json({ ok: false, error: "companyId is required" });
    return;
  }

  if (!source || !VALID_SOURCES.includes(source as JobSource)) {
    res.status(400).json({
      ok: false,
      error: `source must be one of: ${VALID_SOURCES.join(" | ")}`,
    });
    return;
  }

  try {
    const dateKey = todayKey();
    const seq = await nextSequence(companyId, dateKey);
    // SA convention: ID = last 3 digits of companyId + yymmdd + sequence.
    // e.g. company "620611" + 2026-05-09 + seq 5 → "6112605095".
    const companySuffix = companyId.slice(-3);
    const jobId = `${companySuffix}${dateKey}${seq}`;
    const createdAt = Math.floor(Date.now() / 1000);

    const db = getDatabase();
    await db.ref(`jobs/${companyId}/${jobId}`).set({
      jobId,
      companyId,
      source,
      createdAt,
      passenger: passenger ?? null,
      pickup: pickup ?? null,
      dropoff: dropoff ?? null,
      tariffId: tariffId ?? null,
      notes: notes ?? "",
      status: "created",
    });

    req.log.info({ jobId, companyId, source }, "Job created");
    res.json({ ok: true, jobId, createdAt });
  } catch (err: any) {
    req.log.error({ err }, "POST /job/create error");
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default jobRouter;
