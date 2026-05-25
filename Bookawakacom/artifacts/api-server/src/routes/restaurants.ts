import { Router } from "express";
import { getDatabase } from "../lib/firebase";

const restaurantsRouter = Router();

restaurantsRouter.get("/restaurants", async (req, res) => {
  const { cid } = req.query as { cid?: string };

  if (!cid) {
    res.status(400).json({ error: "cid is required" });
    return;
  }

  try {
    const db = getDatabase();
    const snap = await db.ref(`fdRestaurants/${cid}`).once("value");
    const val = snap.val() ?? {};

    const restaurants = Object.entries(val).map(([id, r]: [string, any]) => ({
      id,
      name: r.name ?? "",
      address: r.address ?? "",
      phone: r.phone ?? "",
      cuisine: r.cuisine ?? "",
      image: r.image ?? "",
      isOpen: r.isOpen !== false,
      menu: r.menu
        ? Object.entries(r.menu).map(([mid, item]: [string, any]) => ({
            id: mid,
            name: item.name ?? "",
            description: item.description ?? "",
            price: item.price ?? 0,
            category: item.category ?? "",
            available: item.available !== false,
          }))
        : [],
    }));

    res.json({ restaurants });
  } catch (err: any) {
    req.log.error({ err }, "GET /restaurants error");
    res.status(500).json({ error: err.message });
  }
});

export default restaurantsRouter;
