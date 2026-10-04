"use client";

import { Mic } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";

const LOCAL_LANGUAGE = "zu-ZA";
const SYNC_TAG = "sync-questions";

type AskReply = {
  answer: string;
  meaning: string;
  question: string;
};

type RecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type RecognitionErrorEvent = {
  error: string;
};

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

let flushLock: Promise<void> | null = null;

function recognitionConstructor(): (new () => BrowserRecognition) | null {
  if (typeof window === "undefined") {
    return null;
  }

  const host = window as Window & {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };

  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function speakIsiZulu(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LOCAL_LANGUAGE;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

async function registerQuestionSync() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (
      registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync;
    await syncManager?.register(SYNC_TAG);
  } catch {
    // The online listener still sends the outbox when the signal returns.
  }
}

async function postQuestion(text: string): Promise<AskReply> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language: LOCAL_LANGUAGE }),
  });

  if (!response.ok) {
    throw new Error("The advisor did not answer.");
  }

  const payload = (await response.json()) as {
    answer?: string;
    meaning?: string;
  };

  return {
    question: text,
    answer: payload.answer ?? "",
    meaning: payload.meaning ?? "",
  };
}

function deliverQueued(onReply: (reply: AskReply) => void) {
  if (typeof navigator === "undefined" || !navigator.onLine) {
    return Promise.resolve();
  }

  if (flushLock) {
    return flushLock;
  }

  flushLock = (async () => {
    const items = await db.outbox.orderBy("timestamp").toArray();

    for (const item of items) {
      if (!navigator.onLine || item.id == null) {
        return;
      }

      try {
        const reply = await postQuestion(item.text);
        await db.outbox.delete(item.id);
        onReply(reply);
        speakIsiZulu(reply.answer);
      } catch {
        return;
      }
    }
  })().finally(() => {
    flushLock = null;
  });

  return flushLock;
}

export default function VoiceAssistant() {
  const queued = useLiveQuery(() => db.outbox.orderBy("timestamp").toArray());
  const [online, setOnline] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reply, setReply] = useState<AskReply | null>(null);

  useEffect(() => {
    const publishReply = (next: AskReply) => {
      setReply(next);
      setNotice(null);
    };

    const syncOnline = () => {
      const connected = navigator.onLine;
      setOnline(connected);
      if (connected) {
        void deliverQueued(publishReply);
      }
    };

    const onWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === SYNC_TAG) {
        void deliverQueued(publishReply);
      }
    };

    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    navigator.serviceWorker?.addEventListener("message", onWorkerMessage);

    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage);
    };
  }, []);

  async function handleTranscript(text: string) {
    if (!navigator.onLine) {
      setNotice("Waiting for Signal ⏳");
      await db.outbox.add({ text, timestamp: Date.now() });
      await registerQuestionSync();
      return;
    }

    setNotice("Sending on the signal…");
    try {
      const next = await postQuestion(text);
      setReply(next);
      setNotice(null);
      speakIsiZulu(next.answer);
    } catch {
      setNotice("Waiting for Signal ⏳");
      await db.outbox.add({ text, timestamp: Date.now() });
      await registerQuestionSync();
    }
  }

  function startListening() {
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setNotice("This browser cannot hear a question.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = LOCAL_LANGUAGE;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let fellBack = false;
    let restarting = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        void handleTranscript(transcript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "language-not-supported" && !fellBack) {
        fellBack = true;
        restarting = true;
        recognition.lang = navigator.language || "en-US";
        window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            setListening(false);
          }
        }, 0);
        return;
      }

      if (event.error === "not-allowed") {
        setNotice("Allow the microphone to ask a question.");
      } else if (event.error === "network") {
        setNotice(
          "This phone could not turn speech into text without a signal.",
        );
      } else if (event.error !== "aborted") {
        setNotice("The question was not heard. Try again.");
      }

      setListening(false);
    };

    recognition.onend = () => {
      if (restarting) {
        restarting = false;
        return;
      }
      setListening(false);
    };

    setListening(true);
    setNotice(null);
    recognition.start();
  }

  const waiting = (queued?.length ?? 0) > 0 && online === false;

  return (
    <section aria-label="Voice assistant" className="flex flex-col gap-4">
      <div className="rounded-3xl border border-emerald-200 bg-white px-4 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-800">
          isiZulu voice
        </p>
        <h2 className="mt-1 text-xl font-semibold">Ask about the crop</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Listens in isiZulu ({LOCAL_LANGUAGE}) when this phone supports it.
          Offline questions wait here until a signal returns.
        </p>

        <button
          type="button"
          onClick={startListening}
          disabled={listening}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-950 text-lg font-semibold text-white disabled:opacity-50"
        >
          <Mic aria-hidden="true" size={22} />
          {listening ? "Listening…" : "Ask by voice"}
        </button>

        {waiting || notice === "Waiting for Signal ⏳" ? (
          <p
            role="status"
            aria-live="polite"
            className="mt-4 rounded-xl bg-amber-300 px-4 py-3 text-center text-base font-extrabold text-stone-950"
          >
            Waiting for Signal ⏳
          </p>
        ) : null}

        {notice && notice !== "Waiting for Signal ⏳" ? (
          <p role="status" className="mt-4 text-sm font-medium text-stone-700">
            {notice}
          </p>
        ) : null}

        {queued && queued.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {queued.map((item) => (
              <li
                key={item.id}
                className="rounded-xl bg-stone-950 px-3 py-3 text-sm text-white"
              >
                <span className="font-bold">Waiting for Signal ⏳</span>
                <span className="mt-1 block">{item.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {reply ? (
        <div className="rounded-2xl bg-stone-950 px-4 py-5 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
            Spoken in isiZulu
          </p>
          <p lang="zu" className="mt-2 text-lg font-semibold leading-snug">
            {reply.answer}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-200">
            {reply.meaning}
          </p>
        </div>
      ) : null}
    </section>
  );
}
