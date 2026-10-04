import { db, type MarketPrice } from "@/lib/db";
import { getSupabase } from "@/lib/supabase";

type RemoteQuote = {
  id?: string;
  crop?: string;
  commodity?: string;
  pricePerKg?: number;
  price?: number;
};

function toRow(quote: RemoteQuote, syncedAt: string): MarketPrice {
  const pricePerKg = Number(quote.pricePerKg ?? quote.price);

  return {
    id: quote.id || "coffee-arabica",
    crop: quote.crop || quote.commodity || "Coffee (Arabica)",
    pricePerKg: Number.isFinite(pricePerKg) ? pricePerKg : 4.5,
    lastUpdated: syncedAt,
  };
}

function quotesFromPayload(payload: unknown): RemoteQuote[] {
  if (Array.isArray(payload)) {
    return payload as RemoteQuote[];
  }

  if (payload && typeof payload === "object" && "prices" in payload) {
    const prices = (payload as { prices?: unknown }).prices;
    if (Array.isArray(prices)) {
      return prices as RemoteQuote[];
    }
  }

  return [];
}

async function fetchLatestQuotes(): Promise<RemoteQuote[]> {
  try {
    const supabase = getSupabase();

    if (supabase) {
      const invoked = await supabase.functions.invoke("wfp-prices");
      if (!invoked.error) {
        const fromFunction = quotesFromPayload(invoked.data);
        if (fromFunction.length > 0) {
          return fromFunction;
        }
      }

      const table = await supabase
        .from("market_prices")
        .select("id, crop, pricePerKg");

      if (!table.error && table.data && table.data.length > 0) {
        return table.data as RemoteQuote[];
      }
    }
  } catch {
    // The phone proxy still has a quote when Supabase is unreachable.
  }

  const response = await fetch("/api/prices");
  if (!response.ok) {
    throw new Error("Price sync failed.");
  }

  const quotes = quotesFromPayload(await response.json());
  if (quotes.length === 0) {
    throw new Error("Price sync returned no quotes.");
  }

  return quotes;
}

export async function syncMarketPrices() {
  try {
    const syncedAt = new Date().toISOString();
    const quotes = await fetchLatestQuotes();
    await db.prices.bulkPut(quotes.map((quote) => toRow(quote, syncedAt)));
  } catch (error) {
    console.warn("Market price sync kept the saved quotes.", error);
  }
}
