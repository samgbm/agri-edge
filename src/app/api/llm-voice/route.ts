import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ZULU_COPPER =
  "Ngiyakuzwa. Le app ayikwazi ukukutshela ukuthi usebenzise i-copper spray engakanani. Cela i-cooperative yakho e-Ondera ikusize ngaphambi kokufafaza.";

const MEANING_COPPER =
  "I heard you. This app cannot choose a copper spray dose. Ask your Ondera cooperative before you spray.";

const ZULU_GENERAL =
  "Ngiyakuzwa. Le app iyisixwayiso kuphela. Cela i-cooperative yakho e-Ondera ngaphambi kwesinqumo esikhulu.";

const MEANING_GENERAL =
  "I heard you. This app only advises. Ask your Ondera cooperative before a big decision.";

const SYSTEM_INSTRUCTION = `You are Agri-Edge, an advisory voice for Noor, a coffee farmer in the Ondera highlands.
Return only JSON with two string keys: "reply" and "meaning".
"reply" is one or two short spoken sentences in isiZulu.
"meaning" is the English of that reply.
Never give a pesticide dose, copper spray amount, or mixing rate.
If she asks about spraying, doses, or treatment amounts, tell her this app cannot choose a dose and she must ask the Ondera cooperative.
If you are not sure, say you are not sure and she should ask a person at the cooperative.
Do not claim you inspected her field.`;

function looksLikeDose(text: string) {
  return (
    /\d/.test(text) &&
    /(ml|millilitre|milliliter|litre|liter|gram|\bkg\b|dose|spray|ithusi|copper)/i.test(
      text,
    )
  );
}

function parseAdvice(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { reply?: unknown; meaning?: unknown };
    if (typeof parsed.reply === "string" && parsed.reply.trim()) {
      return {
        reply: parsed.reply.trim(),
        meaning: typeof parsed.meaning === "string" ? parsed.meaning.trim() : "",
      };
    }
  } catch {
    // The model sometimes returns plain speech instead of JSON.
  }

  const reply = raw.trim();
  return reply
    ? { reply, meaning: "" }
    : { reply: ZULU_GENERAL, meaning: MEANING_GENERAL };
}

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

  if (/copper|ithusi/i.test(text)) {
    return NextResponse.json({ reply: ZULU_COPPER, meaning: MEANING_COPPER });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: ZULU_GENERAL, meaning: MEANING_GENERAL });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: text,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });
    const advice = parseAdvice(response.text ?? "");

    if (looksLikeDose(advice.reply) || looksLikeDose(advice.meaning)) {
      return NextResponse.json({ reply: ZULU_COPPER, meaning: MEANING_COPPER });
    }

    return NextResponse.json(advice);
  } catch {
    console.error("Voice advisor failed.");
    return NextResponse.json({ reply: ZULU_GENERAL, meaning: MEANING_GENERAL });
  }
}
