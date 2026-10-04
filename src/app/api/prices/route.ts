import { NextResponse } from "next/server";

/**
 * Same-origin stand-in for the WFP price pull.
 * A configured Supabase Edge Function can replace this body later.
 * Shape follows a WFP market quote: commodity, market, currency, unit, price, date.
 */
export async function GET() {
  return NextResponse.json({
    source: "WFP",
    prices: [
      {
        id: "coffee-arabica",
        commodity: "Coffee (Arabica)",
        market: "Ondera",
        currency: "USD",
        unit: "kg",
        price: 4.62,
        date: new Date().toISOString().slice(0, 10),
      },
    ],
  });
}
