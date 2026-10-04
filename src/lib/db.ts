import Dexie, { type EntityTable } from "dexie";

export type MarketPrice = {
  id: string;
  crop: string;
  pricePerKg: number;
  lastUpdated: string;
};

const COFFEE_PRICE: MarketPrice = {
  id: "coffee-arabica",
  crop: "Coffee (Arabica)",
  pricePerKg: 4.5,
  lastUpdated: "Cached from WFP 2 days ago",
};

class AgriMarketDB extends Dexie {
  prices!: EntityTable<MarketPrice, "id">;

  constructor() {
    super("AgriMarketDB");
    this.version(1).stores({
      prices: "id, crop, pricePerKg, lastUpdated",
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
