import { db, type OutboxQuestion } from "./db";

export const SYNC_TAG = "sync-questions";

export type VoiceReply = {
  id?: number;
  question: string;
  reply: string;
  meaning: string;
};

export function transcriptOf(item: OutboxQuestion) {
  return item.text_transcript || item.text || "";
}

export async function askVoiceBackend(
  text: string,
  timestamp: number,
): Promise<VoiceReply> {
  const response = await fetch("/api/llm-voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, timestamp }),
  });

  if (!response.ok) {
    throw new Error("The advisor did not answer.");
  }

  const payload = (await response.json()) as {
    reply?: string;
    meaning?: string;
  };

  return {
    question: text,
    reply: payload.reply ?? "",
    meaning: payload.meaning ?? "",
  };
}

async function claimQueued() {
  return db.transaction("rw", db.outbox, async () => {
    const items = await db.outbox
      .filter((item) => (item.status ?? "queued") === "queued")
      .toArray();

    for (const item of items) {
      if (item.id != null) {
        await db.outbox.update(item.id, { status: "sending" });
      }
    }

    return items;
  });
}

async function withQueueLock<T>(work: () => Promise<T>) {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("agri-edge-voice", work);
  }

  return work();
}

export async function flushOutbox(
  publish: (reply: VoiceReply) => Promise<boolean>,
) {
  return withQueueLock(async () => {
    await db.outbox
      .filter((item) => item.status === "sending")
      .modify({ status: "queued" });
    await deliverClaimed(publish);
  });
}

async function deliverClaimed(
  publish: (reply: VoiceReply) => Promise<boolean>,
) {
  const items = await claimQueued();

  for (const item of items) {
    if (item.id == null) {
      continue;
    }

    const text = transcriptOf(item);
    if (!text) {
      await db.outbox.delete(item.id);
      continue;
    }

    try {
      const reply = await askVoiceBackend(text, item.timestamp);
      reply.id = item.id;
      await db.outbox.update(item.id, {
        status: "ready",
        reply: reply.reply,
        meaning: reply.meaning,
        text_transcript: text,
      });
      const heard = await publish(reply);
      if (heard) {
        await db.outbox.delete(item.id);
      }
    } catch {
      await db.outbox.update(item.id, { status: "queued" });
      throw new Error("Voice queue paused until the signal returns.");
    }
  }
}
