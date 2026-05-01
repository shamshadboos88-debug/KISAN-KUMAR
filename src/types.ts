export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isPro: boolean;
  settings: {
    preferredModel: 'gemini-3-flash-preview' | 'gemini-3.1-pro-preview' | 'gemini-2.0-pro-exp' | 'gemini-2.1-flash-intelligence';
    preferredImageModel: 'gemini-2.5-flash-image' | 'gemini-2.0-flash-exp';
    persona: 'professional' | 'creative' | 'concise' | 'academic' | 'custom';
    customPersonaInstruction?: string;
    apiKey?: string;
    fineTuning?: {
      tone?: string;
      temperature?: number;
    };
  };
  usage: {
    chatCount: number;
    imageCount: number;
    pdfCount: number;
  };
  createdAt: string;
}

export const AVAILABLE_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Flash 3.0', description: 'Fast & Efficient (Free Tier)' },
  { id: 'gemini-3.1-pro-preview', name: 'Pro 3.1', description: 'Advanced Reasoning' },
  { id: 'gemini-2.0-pro-exp', name: 'Pro 2.0 Exp', description: 'Experimental Superior logic' },
  { id: 'gemini-2.1-flash-intelligence', name: 'Intelligence 2.1', description: 'Smartest Logic' },
] as const;

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  model?: typeof AVAILABLE_MODELS[number]['id'];
  createdAt: string;
  updatedAt: string;
  role?: string;
  ownerId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  role?: string;
  ownerId?: string;
}

export interface Task {
  id: string;
  userId: string;
  text: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  noteId?: string;
  order?: number;
  dueDate?: string;
  reminder?: boolean;
}
