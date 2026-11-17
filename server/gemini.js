import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const MODEL_CONFIGS = [
  { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel.MINIMAL },
  { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW },
];

function getApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    ""
  )
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function getClient() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function extractBase64Image(imageBase64) {
  const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  const clean = imageBase64.includes("base64,")
    ? imageBase64.split("base64,").pop() || ""
    : imageBase64;
  return { mimeType: "image/jpeg", data: clean };
}

const FRAME_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detectedObjects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          box2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
          },
          spatialPosition: { type: Type.STRING },
          distance: { type: Type.STRING },
          state: { type: Type.STRING },
        },
        required: [
          "label",
          "confidence",
          "box2d",
          "spatialPosition",
          "distance",
          "state",
        ],
      },
    },
    isSignificantChange: { type: Type.BOOLEAN },
    isSafetyHazard: { type: Type.BOOLEAN },
    safetyMessage: { type: Type.STRING },
    spokenAnnouncement: { type: Type.STRING },
    silentReason: { type: Type.STRING },
  },
  required: [
    "detectedObjects",
    "isSignificantChange",
    "isSafetyHazard",
    "safetyMessage",
    "spokenAnnouncement",
    "silentReason",
  ],
};

function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function callWithFallback(
  promptText,
  imageBase64,
  systemInstruction,
  jsonMode
) {
  const ai = getClient();
  let lastError = null;

  const parts = [];
  if (imageBase64) {
    const { mimeType, data } = extractBase64Image(imageBase64);
    if (data) {
      parts.push({
        inlineData: {
          mimeType,
          data,
        },
      });
    }
  }
  if (promptText) {
    parts.push({ text: promptText });
  }

  for (const { model, thinkingLevel } of MODEL_CONFIGS) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel },
            ...(jsonMode
              ? {
                  responseMimeType: "application/json",
                  responseSchema: FRAME_ANALYSIS_SCHEMA,
                }
              : {}),
          },
        }),
        10000,
        model
      );

      const text = (response.text ?? "").trim();
      if (text) {
        return text;
      }
      lastError = new Error(`Empty response from ${model}`);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[IRIS ${model} Error]:`, msg);
      if (
        msg.includes("API_KEY_INVALID") ||
        msg.includes("PERMISSION_DENIED") ||
        msg.includes("403")
      ) {
        break;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError || "All Gemini models failed to respond."));
}

export async function analyzeFrameWithGemini(
  imageBase64,
  mode,
  recentObjects
) {
  const systemInstruction = `You are IRIS (Intelligent Real-time Interactive Sight), an AI visual perception assistant for blind and low-vision individuals.
Inspect ONLY this exact camera frame from scratch.

CRITICAL ACCURACY & FOREGROUND RULES:
- FOREGROUND FIRST: If anything is held in front of the camera or close in the foreground (e.g., Smartphone, Phone, Hand, Mug, Bottle, Keys, Book, Paper), detect that foreground object FIRST with its tight [ymin, xmin, ymax, xmax] box (0-1000 scale).
- NO STALE CARRY-OVER: Never output an item from previousObjects unless it is clearly visible in THIS image right now. If a previously seen object was removed or covered, omit it completely.
- ZERO HALLUCINATION: Never invent objects. If nothing distinct is visible, return detectedObjects: [].

MODES:
1. "continuous": Give a natural 1-sentence description of what is currently in front of the camera in spokenAnnouncement.
2. "smart_assist": If a new foreground object appeared, a major object disappeared, or a safety hazard exists, set isSignificantChange=true and announce it in 1 concise sentence in spokenAnnouncement; otherwise keep spokenAnnouncement="".

Keep output concise and strictly match the JSON schema.`;

  const prompt = `Analyze THIS current frame from scratch.
ACTIVE MODE: "${mode}"
Previous frame objects (reference ONLY for change detection — do NOT report these if absent or occluded now): ${JSON.stringify(recentObjects)}

Return tight normalized [ymin, xmin, ymax, xmax] (0-1000) boxes and spatialPosition ("Left", "Center", or "Right") for every object currently visible.`;

  const rawText = await callWithFallback(
    prompt,
    imageBase64,
    systemInstruction,
    true
  );
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);

  return {
    detectedObjects: Array.isArray(parsed.detectedObjects)
      ? parsed.detectedObjects
      : [],
    isSignificantChange: Boolean(parsed.isSignificantChange),
    isSafetyHazard: Boolean(parsed.isSafetyHazard),
    safetyMessage: parsed.safetyMessage ?? "",
    spokenAnnouncement: parsed.spokenAnnouncement ?? "",
    silentReason: parsed.silentReason ?? "",
  };
}

export async function answerVoiceQueryWithGemini(
  userPrompt,
  imageBase64,
  contextHistory
) {
  const systemInstruction = `You are IRIS, an assistive voice AI for the visually impaired.
Answer the user concisely in 1-2 natural spoken sentences based solely on the current visual image.
Never hallucinate unobserved items. Be direct and helpful.`;

  const fullPrompt = `User question: "${userPrompt}"\nContext: ${contextHistory}\nProvide a concise spoken answer in 1-2 sentences.`;

  return await callWithFallback(
    fullPrompt,
    imageBase64 ? imageBase64 : null,
    systemInstruction,
    false
  );
}

export async function readOcrWithGemini(imageBase64) {
  const systemInstruction = `You are an OCR and sign reader for a blind individual.
Extract and read all visible text clearly and concisely from signs, screens, documents, packaging, or labels.
If no text is visible, say "No text detected in the view".`;

  return await callWithFallback(
    "Read all visible text in this image.",
    imageBase64,
    systemInstruction,
    false
  );
}
