import { NextResponse } from "next/server";

const ZULU_COPPER =
  "Ngiyakuzwa. Le app ayikwazi ukukutshela ukuthi usebenzise i-copper spray engakanani. Cela i-cooperative yakho e-Ondera ikusize ngaphambi kokufafaza.";

const MEANING_COPPER =
  "I heard you. This app cannot choose a copper spray dose. Ask your Ondera cooperative before you spray.";

const ZULU_GENERAL =
  "Ngiyakuzwa. Le app iyisixwayiso kuphela. Cela i-cooperative yakho e-Ondera ngaphambi kwesinqumo esikhulu.";

const MEANING_GENERAL =
  "I heard you. This app only advises. Ask your Ondera cooperative before a big decision.";

export async function POST(request: Request) {
  let text = "";

  try {
    const body = (await request.json()) as { text?: unknown };
    if (typeof body.text === "string") {
      text = body.text.trim();
    }
  } catch {
    text = "";
  }

  if (!text) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }

  const aboutCopper = /copper|ithusi/i.test(text);

  return NextResponse.json({
    language: "zu",
    answer: aboutCopper ? ZULU_COPPER : ZULU_GENERAL,
    meaning: aboutCopper ? MEANING_COPPER : MEANING_GENERAL,
  });
}
