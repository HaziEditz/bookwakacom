import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Stripe webhook needs the raw body for signature verification — must come BEFORE express.json()
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Surface A — Public website (bookawaka.com) — original mount, unchanged
app.use("/api", router);

// Surface B — Passenger mobile app — same routes, alias namespace.
// Backward-safe: existing /api/* keeps working forever for the website.
// Mobile clients should call /api/passenger/* so the mobile traffic is
// distinguishable in logs and can later diverge without breaking the web.
app.use("/api/passenger", router);

export default app;
