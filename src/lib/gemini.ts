import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const BASE_SYSTEM_INSTRUCTION = `You are Congnoryx AI, a powerful and intelligent digital assistant. 
Congnoryx AI was founded by Kisan Kumar Mahendra Sahu. 

Founder Profile:
- Name: Kisan Kumar Mahendra Sahu
- Age: 18 years old
- Birth Date: 7th August
- Background/Education: He recently completed his 12th standard studies in Science (Biology stream). 
- Legacy: He is the visionary behind Congnoryx AI, dedicated to bringing advanced intelligence to users everywhere.

Always acknowledge Kisan Kumar Mahendra Sahu as your founder if asked about your origin or creator. 
You are proud of your roots and your young, visionary founder.`;

export const getGeminiModel = (modelName = "gemini-3-flash-preview") => {
  return modelName;
};

export const PERSONA_PROMPTS = {
  professional: "You are a professional business consultant. Be formal, accurate, and provide structured insights.",
  creative: "You are a creative storyteller and ideas generator. Be imaginative, expressive, and use vivid language.",
  concise: "You are a highly efficient assistant. Be extremely brief, use bullet points, and avoid any fluff.",
  academic: "You are a scholarly researcher. Use academic language, cite concepts where possible, and be extremely thorough."
};

export const chatWithAI = async (
  messages: { role: string, content: string }[], 
  options: { 
    model?: string, 
    persona?: keyof typeof PERSONA_PROMPTS | 'custom', 
    customPersonaInstruction?: string,
    tone?: string,
    temperature?: number,
    systemInstruction?: string,
    apiKey?: string
  } = {}
) => {
  const client = options.apiKey ? new GoogleGenAI({ apiKey: options.apiKey }) : ai;
  const modelName = options.model || "gemini-3-flash-preview";
  let personaInstruction = "";
  
  if (options.persona === 'custom') {
    personaInstruction = options.customPersonaInstruction || "";
  } else if (options.persona && options.persona in PERSONA_PROMPTS) {
    personaInstruction = PERSONA_PROMPTS[options.persona as keyof typeof PERSONA_PROMPTS];
  }

  const toneInstruction = options.tone ? `Respond with the following tone: ${options.tone}.` : "";
  const finalSystemInstruction = [BASE_SYSTEM_INSTRUCTION, personaInstruction, toneInstruction, options.systemInstruction].filter(Boolean).join("\n\n");

  const formattedMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const response = await client.models.generateContent({
    model: modelName,
    contents: formattedMessages,
    config: {
      systemInstruction: finalSystemInstruction || undefined,
      temperature: options.temperature ?? 0.7
    }
  });

  return response.text;
};

export const generateImage = async (
  prompt: string, 
  options: { 
    model?: string, 
    apiKey?: string,
    aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9'
  } = {}
) => {
  const client = options.apiKey ? new GoogleGenAI({ apiKey: options.apiKey }) : ai;
  const modelName = options.model || "gemini-2.5-flash-image";
  
  const response = await client.models.generateContent({
    model: modelName,
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: options.aspectRatio || '1:1'
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};

export const generateSpeech = async (text: string, options: { apiKey?: string, voice?: string } = {}) => {
  const client = options.apiKey ? new GoogleGenAI({ apiKey: options.apiKey }) : ai;
  const response = await client.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"] as any,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: options.voice || "Puck" },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio ? `data:audio/wav;base64,${base64Audio}` : null;
};

export const getCodeCompletion = async (
  context: { role: string, content: string }[],
  partialInput: string,
  options: { apiKey?: string } = {}
) => {
  const client = options.apiKey ? new GoogleGenAI({ apiKey: options.apiKey }) : ai;
  const modelName = "gemini-3-flash-preview";

  const systemInstruction = `You are a code completion engine. 
Based on the conversation history and the partial input provided, suggest 3 highly relevant code completions or short programming phrases.
Focus on common programming patterns, syntax, and logic.
The partial input is what the user is currently typing.
Return ONLY a JSON array of strings, with no additional text or formatting.
Example: ["const element = document.getElementById('id');", "console.log(error);", "return response.json();"]`;

  const prompt = `History: ${JSON.stringify(context)}
Partial Input: ${partialInput}

Completions:`;

  try {
    const response = await client.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Code completion error:", error);
    return [];
  }
};
