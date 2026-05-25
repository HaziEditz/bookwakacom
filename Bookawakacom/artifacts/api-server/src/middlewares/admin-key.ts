import type { Request, Response, NextFunction } from "express";

/**
 * Cross-Replit admin auth (SA Portal → Customer Web).
 *
 * Server-to-server only. SA dev confirmed BW_ADMIN_KEY is the existing shared
 * secret (also used by SA Portal ↔ External Registration). Header pattern:
 *
 *     X-Admin-Key: ${BW_ADMIN_KEY}
 *
 * Mount this on every /api/admin/* route. Never expose admin routes to the
 * browser without this middleware.
 */
export function requireAdminKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env["BW_ADMIN_KEY"];
  if (!expected) {
    req.log?.error(
      "BW_ADMIN_KEY is not configured — admin endpoint requested but cannot authenticate",
    );
    res.status(503).json({ error: "Admin API not configured on this server" });
    return;
  }

  const provided = req.header("X-Admin-Key");
  if (!provided || provided !== expected) {
    req.log?.warn(
      { path: req.path, ip: req.ip },
      "Admin key check failed — rejecting request",
    );
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
