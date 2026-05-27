import { getDatabase } from "./firebase";

const TERMINAL = new Set([
  "completed",
  "closed",
  "cancelled",
  "canceled",
  "noshow",
  "declined",
]);

export function normalizePhoneKey(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export interface ActiveBookingMatch {
  existingBookingId: string;
  existingStatus: string;
  serviceType: string;
}

export async function findActiveBooking(
  passengerPhone: string,
  serviceType: string,
  excludeJobId?: string
): Promise<ActiveBookingMatch | null> {
  const normalizedPhone = normalizePhoneKey(passengerPhone);
  const normalizedServiceType = serviceType.toLowerCase().trim();
  if (!normalizedPhone || !normalizedServiceType) return null;

  const db = getDatabase();
  const idxSnap = await db.ref(`passengerIndex/phone/${normalizedPhone}`).once("value");
  const existingKey: string | undefined = idxSnap.val()?.key;
  if (!existingKey) return null;

  const jobsSnap = await db.ref(`Passengerjobs/${existingKey}`).once("value");
  const jobs: Record<string, any> = jobsSnap.val() ?? {};

  for (const [existingId, job] of Object.entries(jobs)) {
    if (excludeJobId && existingId === excludeJobId) continue;

    const jobService = (job?.ServiceType ?? "").toString().toLowerCase().trim();
    if (jobService !== normalizedServiceType) continue;

    const jobIsAsap =
      (job?.BookingType ?? "") === "ASAP" ||
      (!job?.ScheduledForMs && !job?.ScheduledFor);
    if (!jobIsAsap) continue;

    const jobCid = job?.CompanyId ?? job?.companyId;
    let liveStatus: string = (job?.Status ?? job?.status ?? "").toString();
    if (jobCid) {
      try {
        const liveSnap = await db.ref(`allbookings/${jobCid}/${existingId}`).once("value");
        const live = liveSnap.val();
        if (live) {
          liveStatus = (live.Status ?? live.status ?? liveStatus).toString();
        }
      } catch {
        // best-effort
      }
    }

    const norm = liveStatus.toLowerCase().replace(/[\s_-]/g, "");
    if (!TERMINAL.has(norm)) {
      return {
        existingBookingId: existingId,
        existingStatus: liveStatus,
        serviceType,
      };
    }
  }

  return null;
}
