"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

const YIELD_LOSS = 0.1;

function formatLastSynced(value: string) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    return value;
  }

  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) {
    return "Last synced: just now";
  }
  if (minutes < 60) {
    return `Last synced: ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `Last synced: ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.round(hours / 24);
  return `Last synced: ${days} days ago`;
}

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
      <p className="mt-3 text-lg font-bold">{formatLastSynced(price.lastUpdated)}</p>
      <p className="mt-1 text-base font-semibold">
        {price.crop} reference ${price.pricePerKg.toFixed(2)}/kg.
      </p>
    </section>
  );
}
