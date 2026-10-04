import Dexie, { type EntityTable } from "dexie";

export type MarketPrice = {
  id: string;
  crop: string;
  pricePerKg: number;
  lastUpdated: string;
};

export type OutboxStatus = "queued" | "sending" | "ready";

export type OutboxQuestion = {
  id?: number;
  text_transcript: string;
  timestamp: number;
  status?: OutboxStatus;
  reply?: string;
  meaning?: string;
  /** Increment 4 rows stored the transcript on `text`. */
  text?: string;
};

const COFFEE_PRICE: MarketPrice = {
  id: "coffee-arabica",
  crop: "Coffee (Arabica)",
  pricePerKg: 4.5,
  lastUpdated: "Cached from WFP 2 days ago",
};

class AgriMarketDB extends Dexie {
  prices!: EntityTable<MarketPrice, "id">;
  outbox!: EntityTable<OutboxQuestion, "id">;

  constructor() {
    super("AgriMarketDB");
    this.version(1).stores({
      prices: "id, crop, pricePerKg, lastUpdated",
    });
    this.version(2).stores({
      prices: "id, crop, pricePerKg, lastUpdated",
      outbox: "++id, text, timestamp",
    });
    this.version(3)
      .stores({
        prices: "id, crop, pricePerKg, lastUpdated",
        outbox: "++id, text_transcript, timestamp, status",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table("outbox")
          .toCollection()
          .modify((row: OutboxQuestion) => {
            if (!row.text_transcript && row.text) {
              row.text_transcript = row.text;
            }
            if (!row.status) {
              row.status = "queued";
            }
          });
      });
  }
}

export const db = new AgriMarketDB();

export async function seedMarketPrices() {
  const count = await db.prices.count();
  if (count > 0) {
    return;
  }

  await db.prices.add(COFFEE_PRICE);
}
