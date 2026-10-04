"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

const YIELD_LOSS = 0.1;

export default function MarketContextCard({
  diseaseDetected,
}: {
  diseaseDetected: boolean;
}) {
  const price = useLiveQuery(() => db.prices.get("coffee-arabica"));

  if (!diseaseDetected || !price) {
    return null;
  }

  const floor = (price.pricePerKg * (1 - YIELD_LOSS)).toFixed(2);

  return (
    <section
      aria-label="Market shield"
      role="alert"
      className="rounded-2xl border-4 border-red-800 bg-amber-300 px-4 py-5 text-stone-950 shadow-sm"
    >
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-red-800">
        Market shield
      </p>
      <p className="mt-2 text-xl font-extrabold leading-snug">
        Disease Impact: 10% Value Loss. Do not accept less than ${floor}/kg
        from buyers today.
      </p>
      <p className="mt-3 text-base font-semibold">
        {price.crop} reference ${price.pricePerKg.toFixed(2)}/kg.{" "}
        {price.lastUpdated}.
      </p>
    </section>
  );
}
