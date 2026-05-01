import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  Send, 
  Plus, 
  Mic, 
  MicOff, 
  MoreVertical, 
  Trash2, 
  Share2,
  Copy,
  Check,
  Bot,
  User as UserIcon,
  Zap,
  MessageSquare,
  AlertCircle,
  Crown,
  File,
  X,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  Menu,
  ChevronDown,
  Settings,
  Volume2,
  VolumeX,
  AudioLines,
  Headphones,
  Waves,
  Users
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  getDocs,
  updateDoc,
  deleteDoc,
  getDoc,
  where,
  Unsubscribe
} from 'firebase/firestore';
import { ChatMessage, ChatSession, AVAILABLE_MODELS } from '../types';
import { chatWithAI, generateSpeech, getCodeCompletion } from '../lib/gemini';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShareModal } from './ShareModal';

export function Chat() {
  const { user, profile } = useAuth();
  const { id: chatId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sharedSessions, setSharedSessions] = useState<ChatSession[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState('Puck');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const isVoiceModeRef = useRef(false);
  const userRef = useRef(user);
  const chatIdRef = useRef(chatId);
  const isTypingRef = useRef(isTyping);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const voiceSettingsRef = useRef<HTMLDivElement>(null);
  const voiceSettingsOverlayRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [audioError, setAudioError] = useState<{ message: string; type: 'error' | 'warning' | 'info' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const allSessions = [...sessions, ...sharedSessions].sort((a, b) => {
    const getTime = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'string') return new Date(val).getTime();
      if (typeof val.toMillis === 'function') return val.toMillis();
      if (val instanceof Date) return val.getTime();
      return 0;
    };
    return getTime(b.updatedAt) - getTime(a.updatedAt);
  });

  const allSessionsRef = useRef<ChatSession[]>(allSessions);

  useEffect(() => {
    userRef.current = user;
    chatIdRef.current = chatId;
    isTypingRef.current = isTyping;
    allSessionsRef.current = allSessions;
  });

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      setInterimTranscript(interim);

      if (finalTranscript) {
        setInterimTranscript('');
        
        const lowerTranscript = finalTranscript.toLowerCase().trim();

        // 1. New Chat Command
        if (['new chat', 'start new chat', 'start a new chat', 'create new chat'].includes(lowerTranscript)) {
          createNewChat();
          if (isVoiceModeRef.current) speakText("Starting a new context for you.");
          return;
        }

        // 2. Switch Session Command
        if (lowerTranscript.startsWith('open ') || lowerTranscript.startsWith('switch to ')) {
          const target = lowerTranscript.replace('open ', '').replace('switch to ', '').trim();
          const found = allSessionsRef.current.find(s => s.title.toLowerCase().includes(target));
          if (found) {
            navigate(`/chat/${found.id}`);
            if (isVoiceModeRef.current) speakText(`Switching to ${found.title}`);
            return;
          }
        }

        // 3. Send Message Command (Manual trigger)
        if (lowerTranscript === 'send' || lowerTranscript === 'send message' || lowerTranscript === 'transmit') {
          handleSend();
          return;
        }

        setInput(prev => {
          const newBase = prev.trim() + (prev ? ' ' : '') + finalTranscript;
          return newBase;
        });
        
        // Auto-send if in voice mode
        if (isVoiceModeRef.current) {
          handleSendVoice(finalTranscript);
        }
      }
    };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setInterimTranscript('');
        const err = event.error;
        
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setAudioError({ 
            message: 'Microphone access is blocked. Please click the Lock icon in your browser to allow it.', 
            type: 'error' 
          });
        } else if (err === 'no-speech') {
          setAudioError({ message: 'No speech detected. Please try speaking again.', type: 'warning' });
        } else if (err === 'network') {
          setAudioError({ message: 'Voice network error. Please check your connection.', type: 'error' });
        } else if (err === 'aborted') {
          // Stop silently
        } else {
          setAudioError({ message: `Voice interrupted: ${err}. Try again.`, type: 'info' });
        }
        setTimeout(() => setAudioError(null), 6000);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleListening = async () => {
    if (!recognitionRef.current) {
      setAudioError({ 
        message: 'Voice recognition is not supported in this browser. Please use Chrome or Safari.', 
        type: 'error' 
      });
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Recognition already stopped');
      }
      setIsListening(false);
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not available');
      }

      // Explicitly check for secure context
      if (!window.isSecureContext) {
        setAudioError({ 
          message: 'Voice requires a secure connection. If in preview, try opening in a new tab.', 
          type: 'error' 
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      recognitionRef.current.start();
      setIsListening(true);
      setAudioError(null);
    } catch (err: any) {
      console.error('Failed to start recognition:', err);
      
      const isNotAllowed = 
        err.name === 'NotAllowedError' || 
        err.name === 'PermissionAllowedError' || 
        err.message?.toLowerCase().includes('not-allowed') ||
        err.message?.toLowerCase().includes('permission');
      
      const isNotFound = 
        err.name === 'NotFoundError' || 
        err.name === 'DevicesNotFoundError' ||
        err.message?.toLowerCase().includes('not found') ||
        err.message?.toLowerCase().includes('requested device') ||
        err.message?.toLowerCase().includes('device not found');

      if (isNotAllowed) {
        const inIframe = window.self !== window.top;
        const msg = inIframe 
          ? 'Preview window blocks microphone. Please click the "Open in New Tab" button in the top right to start talking.' 
          : 'Microphone access was denied. Please update your browser permissions for this site.';
        setAudioError({ message: msg, type: 'error' });
      } else if (isNotFound) {
        setAudioError({ message: 'No microphone found. Please connect your headset or mic.', type: 'error' });
      } else if (err.message === 'MediaDevices API not available') {
        const msg = window.self !== window.top 
          ? 'Browser limits mic in previews. Try the "Open in New Tab" button.'
          : 'Microphone API unavailable. Check your browser security settings.';
        setAudioError({ message: msg, type: 'error' });
      } else {
        setAudioError({ message: 'Microphone could not start. Is it being used by another app?', type: 'info' });
      }
      
      setIsListening(false);
      setTimeout(() => setAudioError(null), 10000);
    }
  };

  // Fetch Sessions
  useEffect(() => {
    if (!user) return;
    
    // 1. Listen to OWN sessions
    const path = `users/${user.uid}/chats`;
    const q = query(
      collection(db, 'users', user.uid, 'chats'),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribeOwn = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ownerId: user.uid, role: 'owner', ...doc.data() } as any));
      setSessions(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    // 2. Listen to SHARED sessions access
    const accessQ = query(
      collection(db, 'users', user.uid, 'access'),
      where('itemType', '==', 'chat')
    );

    const sharedUnsubscribers: Record<string, Unsubscribe> = {};

    const unsubscribeAccess = onSnapshot(accessQ, (snapshot) => {
      const accessItems = snapshot.docs.map(doc => doc.data() as { ownerId: string, itemId: string, role: string });
      
      Object.keys(sharedUnsubscribers).forEach(id => {
        if (!accessItems.find(ai => ai.itemId === id)) {
          sharedUnsubscribers[id]();
          delete sharedUnsubscribers[id];
        }
      });

      accessItems.forEach(item => {
        if (!sharedUnsubscribers[item.itemId]) {
          const chatRef = doc(db, 'users', item.ownerId, 'chats', item.itemId);
          sharedUnsubscribers[item.itemId] = onSnapshot(chatRef, (snap) => {
            if (snap.exists()) {
              const sharedChat = { id: snap.id, ownerId: item.ownerId, role: item.role, ...snap.data() } as any;
              setSharedSessions((prev: any) => {
                const other = prev.filter((s: any) => s.id !== snap.id);
                return [...other, sharedChat];
              });
            } else {
              setSharedSessions((prev: any) => prev.filter((s: any) => s.id !== item.itemId));
            }
          });
        }
      });
    });

    return () => {
      unsubscribeOwn();
      unsubscribeAccess();
      Object.values(sharedUnsubscribers).forEach(unsub => unsub());
    };
  }, [user]);

  // Fetch Messages
  useEffect(() => {
    if (!user || !chatId) {
      setMessages([]);
      return;
    }
    
    // We need to find the owner of the chatId
    const currentSession = [...sessions, ...sharedSessions].find(s => s.id === chatId);
    const ownerId = (currentSession as any)?.ownerId || user.uid;

    const path = `users/${ownerId}/chats/${chatId}/messages`;
    const q = query(
      collection(db, 'users', ownerId, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return unsubscribe;
  }, [user, chatId, sessions, sharedSessions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
      if (voiceSettingsRef.current && !voiceSettingsRef.current.contains(event.target as Node)) {
        setShowVoiceSettings(false);
      }
      if (voiceSettingsOverlayRef.current && !voiceSettingsOverlayRef.current.contains(event.target as Node)) {
        setShowVoiceSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // AI Suggestions Logic
  useEffect(() => {
    if (!input.trim() || input.length < 3 || isTyping) {
      setSuggestions([]);
      return;
    }

    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    suggestionTimeoutRef.current = setTimeout(async () => {
      // Small heuristic to check if it might be code or technical
      const codeRegex = /[{}()[\];.]|(const|let|var|function|class|if|for|while|import|export|return|await|async)\b/;
      if (!codeRegex.test(input)) return;

      setIsGeneratingSuggestions(true);
      try {
        const recentMessages = messages.slice(-3).map(m => ({ role: m.role, content: m.content }));
        const completions = await getCodeCompletion(recentMessages, input, { apiKey: profile?.settings?.apiKey });
        setSuggestions(completions);
      } catch (err) {
        console.error("Suggestions error:", err);
      } finally {
        setIsGeneratingSuggestions(false);
      }
    }, 1000); // Debounce by 1s for AI stability

    return () => {
      if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
    };
  }, [input, isTyping, messages, profile?.settings?.apiKey]);

  const applySuggestion = (suggestion: string) => {
    // If the suggestion starts with the current input, replace or append intelligently
    // Simple approach: replace input if it matches partly or just append
    setInput(suggestion);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Tab' || (e.key === 'Enter' && selectedSuggestionIndex !== -1)) {
        e.preventDefault();
        const index = selectedSuggestionIndex === -1 ? 0 : selectedSuggestionIndex;
        applySuggestion(suggestions[index]);
      } else if (e.key === 'Escape') {
        setSuggestions([]);
        setSelectedSuggestionIndex(-1);
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && selectedSuggestionIndex === -1) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentSession = sessions.find(s => s.id === chatId);
  let currentModel = currentSession?.model || profile?.settings?.preferredModel || 'gemini-3-flash-preview';
  
  // Sanitize for legacy/prohibited models
  if (currentModel.includes('1.5')) {
    currentModel = 'gemini-3-flash-preview';
  }

  const updateSessionModel = async (newModel: typeof AVAILABLE_MODELS[number]['id']) => {
    if (!user || !chatId) return;
    const path = `users/${user.uid}/chats/${chatId}`;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'chats', chatId), {
        model: newModel,
        updatedAt: serverTimestamp()
      });
      setShowModelDropdown(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !user || isTyping) return;

    // Stop listening if active
    if (isListening) {
      toggleListening();
    }

    const userMessage = input.trim();
    setInput('');
    await performSend(userMessage);
  };

  const performSend = async (userMessage: string) => {
    const currentUser = userRef.current;
    const currentChatIdParam = chatIdRef.current;

    if (!currentUser || isTypingRef.current) return;
    
    setIsTyping(true);
    isTypingRef.current = true;
    setAttachedFiles([]);
    
    let activeChatId = currentChatIdParam;
    const currentSession = [...sessions, ...sharedSessions].find(s => s.id === activeChatId);
    let ownerId = (currentSession as any)?.ownerId || currentUser.uid;
    
    // Create new chat if not exists
    if (!activeChatId) {
      const chatsPath = `users/${currentUser.uid}/chats`;
      try {
        const chatRef = await addDoc(collection(db, 'users', currentUser.uid, 'chats'), {
          userId: currentUser.uid,
          title: userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''),
          model: profile?.settings?.preferredModel || 'gemini-3-flash-preview',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        activeChatId = chatRef.id;
        ownerId = currentUser.uid;
        navigate(`/chat/${activeChatId}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, chatsPath);
      }
    } else {
      const chatPath = `users/${ownerId}/chats/${activeChatId}`;
      try {
        await updateDoc(doc(db, 'users', ownerId, 'chats', activeChatId), {
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, chatPath);
      }
    }

    if (!activeChatId) return;

    // Add user message to Firestore
    const messagesPath = `users/${ownerId}/chats/${activeChatId}/messages`;
    try {
      await addDoc(collection(db, 'users', ownerId, 'chats', activeChatId, 'messages'), {
        role: 'user',
        content: userMessage,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, messagesPath);
    }

    try {
      // Get AI response
      const recentMessages = messages.slice(-5).map(m => ({ role: m.role, content: m.content }));
      recentMessages.push({ role: 'user', content: userMessage });
      
      const aiResponse = await chatWithAI(recentMessages, {
        model: currentModel as any,
        persona: profile?.settings?.persona,
        customPersonaInstruction: profile?.settings?.customPersonaInstruction,
        tone: profile?.settings?.fineTuning?.tone,
        temperature: profile?.settings?.fineTuning?.temperature,
        systemInstruction: "You are COGNORYX AI, a helpful productivity assistant. Be concise and insightful.",
        apiKey: profile?.settings?.apiKey
      });
      
      if (aiResponse) {
        const messagesPath = `users/${ownerId}/chats/${activeChatId}/messages`;
        try {
          await addDoc(collection(db, 'users', ownerId, 'chats', activeChatId, 'messages'), {
            role: 'assistant',
            content: aiResponse,
            timestamp: serverTimestamp()
          });
          
          if (isVoiceModeRef.current) {
            speakText(aiResponse);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, messagesPath);
        }
      } else {
        throw new Error("No response from AI");
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setError(err.message === "No response from AI" 
        ? "The AI couldn't generate a response. Please try another prompt." 
        : "Failed to connect to AI service. Please check your connection or try again.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsTyping(false);
      isTypingRef.current = false;
    }
  };

  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleShare = async (content: string, id: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          text: content,
          title: 'Cognoryx AI Message'
        });
      } else {
        await navigator.clipboard.writeText(content);
      }
      setSharedId(id);
      setTimeout(() => setSharedId(null), 2000);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Share error:', err);
      }
    }
  };

  const createNewChat = () => {
    navigate('/chat');
    setMessages([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAttachedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setIsSpeaking(false);
  };

  const speakText = async (text: string, messageId?: string) => {
    try {
      setIsSpeaking(true);
      if (messageId) setSpeakingMessageId(messageId);
      const audioUrl = await generateSpeech(text, { 
        apiKey: profile?.settings?.apiKey,
        voice: selectedVoice
      });
      if (audioUrl) {
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.volume = voiceVolume;
          audioRef.current.playbackRate = voiceSpeed;
          audioRef.current.play();
          audioRef.current.onended = () => {
            setIsSpeaking(false);
            setSpeakingMessageId(null);
            if (isVoiceModeRef.current) {
              // Automatically start listening again in voice mode
              toggleListening();
            }
          };
        }
      } else {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
      }
    } catch (err) {
      console.error("Speech error:", err);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  };

  const toggleVoiceMode = () => {
    const nextMode = !isVoiceMode;
    setIsVoiceMode(nextMode);
    isVoiceModeRef.current = nextMode;

    if (!nextMode) {
      stopSpeaking();
      if (isListening) toggleListening();
    } else {
      // Start voice mode with a welcome if no messages
      if (messages.length === 0) {
        speakText("I'm ready. Talk to me.");
      } else {
        toggleListening();
      }
    }
  };

  const handleSendVoice = async (transcript: string) => {
    if (transcript.trim().length < 2) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    await performSend(transcript);
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user || !window.confirm('Delete this chat architecture? This cannot be undone.')) return;
    
    const messagesPath = `users/${user.uid}/chats/${id}/messages`;
    const chatPath = `users/${user.uid}/chats/${id}`;
    
    try {
      // First delete all messages in subcollection
      const messagesRef = collection(db, 'users', user.uid, 'chats', id, 'messages');
      const messagesSnap = await getDocs(messagesRef);
      await Promise.all(messagesSnap.docs.map(d => deleteDoc(d.ref)));
      
      // Then delete the chat doc
      await deleteDoc(doc(db, 'users', user.uid, 'chats', id));
      
      if (chatId === id) {
        navigate('/chat');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, chatPath);
    }
  };

  const clearAllHistory = async () => {
    if (!user || !window.confirm('CRITICAL: Purge entire neural history? This action is IRREVERSIBLE.')) return;
    
    setIsTyping(true);
    try {
      // Get all own chats
      const chatsRef = collection(db, 'users', user.uid, 'chats');
      const chatsSnap = await getDocs(chatsRef);
      
      await Promise.all(chatsSnap.docs.map(async (chatDoc) => {
        const id = chatDoc.id;
        // Delete messages subcollection
        const messagesRef = collection(db, 'users', user.uid, 'chats', id, 'messages');
        const messagesSnap = await getDocs(messagesRef);
        await Promise.all(messagesSnap.docs.map(d => deleteDoc(d.ref)));
        
        // Delete chat doc
        await deleteDoc(chatDoc.ref);
      }));
      
      navigate('/chat');
      setMessages([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/chats`);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden bg-white">
      {/* Sessions Sidebar */}
      <motion.div 
        animate={{ 
          width: isSidebarCollapsed ? 0 : 288,
          opacity: isSidebarCollapsed ? 0 : 1
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          "hidden md:flex flex-col border-r border-white/5 bg-[#020617] overflow-hidden shrink-0 relative z-30",
          isSidebarCollapsed && "border-r-0"
        )}
      >
        <div className="p-6 flex items-center justify-between gap-2 overflow-hidden">
          <motion.button 
            whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(168,85,247,0.4)' }}
            whileTap={{ scale: 0.98 }}
            onClick={createNewChat}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-brand text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-neon-purple hover:bg-brand-dark transition-all truncate"
          >
            <Plus size={18} />
            <span className="truncate">Initialize Flux</span>
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsSidebarCollapsed(true)}
            className="p-3 text-slate-500 hover:text-white rounded-xl transition-all"
          >
            <PanelLeftClose size={20} />
          </motion.button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 space-y-2 mb-8 custom-scrollbar">
          <div className="flex items-center justify-between px-3 mb-4 mt-6">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] truncate">History Buffers</p>
            {sessions.length > 0 && (
              <button 
                onClick={clearAllHistory}
                className="text-[9px] font-black text-red-500/50 hover:text-red-500 uppercase tracking-tighter transition-colors"
                title="Purge All Records"
              >
                Clear All
              </button>
            )}
          </div>
          <AnimatePresence mode="popLayout">
            {allSessions.map((session) => (
              <motion.div
                key={session.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <motion.div
                  role="button"
                  tabIndex={0}
                  whileHover={{ x: 4, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/chat/${session.id}`)}
                  className={cn(
                    "w-full text-left px-4 py-4 rounded-2xl text-[11px] font-bold transition-all group relative border cursor-pointer outline-none tracking-tight",
                    chatId === session.id 
                      ? "bg-white/5 border-brand/40 shadow-[0_0_15px_rgba(168,85,247,0.1)] text-white shadow-inner" 
                      : "bg-transparent border-transparent text-slate-500 hover:text-slate-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare size={16} className={chatId === session.id ? "text-brand shadow-neon-purple shadow-[0_0_5px_brand]" : "text-slate-700"} />
                    <span className="truncate flex-1">{session.title}</span>
                    {(session as any).role !== 'owner' && <Users size={12} className="text-blue-500/50 shrink-0" />}
                    
                    <motion.button 
                      whileHover={{ scale: 1.2, color: '#ef4444' }}
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if ((session as any).role !== 'owner') {
                          if (user) deleteDoc(doc(db, 'users', user.uid, 'access', session.id));
                        } else {
                          deleteSession(e, session.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-700 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </motion.button>
                  </div>
                  
                  {chatId === session.id && (
                    <motion.div 
                      layoutId="sidebar-active-pill"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-r-full shadow-neon-purple shadow-[0_0_10px_brand]"
                    />
                  )}
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>


      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-[#020617] relative">
        {/* Chat Header */}
        <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#020617]/80 backdrop-blur-xl z-20 sticky top-0 shadow-lg relative">
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent"></div>
          <div className="flex items-center gap-4">
            {isSidebarCollapsed && (
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-2.5 -ml-2 text-slate-500 hover:text-white rounded-xl transition-all border border-white/5 shadow-inner"
                title="Expand sidebar"
              >
                <PanelLeftOpen size={20} />
              </motion.button>
            )}
            <div className="w-10 h-10 bg-gradient-to-tr from-brand to-brand-light rounded-xl flex items-center justify-center text-white shadow-neon-purple shadow-[0_0_15px_brand]">
              <Zap size={20} />
            </div>
            <div className="relative" ref={dropdownRef}>
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black text-white truncate max-w-[140px] md:max-w-[250px] tracking-tight">
                    {chatId ? sessions.find(s => s.id === chatId)?.title : 'NEURAL INITIALIZATION'}
                  </h2>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className="flex items-center gap-2 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 transition-all rounded-full text-[9px] font-black text-brand uppercase tracking-[0.2em] shadow-inner"
                  >
                    {currentModel.replace('gemini-', '').replace('-preview', '').replace('-intelligence', '')}
                    <ChevronDown size={10} className={cn("transition-transform duration-300", showModelDropdown && "rotate-180")} />
                  </motion.button>
                </div>
                {!chatId && <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-0.5">Autonomous AI Active</p>}
              </div>

              <AnimatePresence>
                {showModelDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute left-0 mt-4 w-72 bg-[#0f172a] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 p-2 overflow-hidden backdrop-blur-xl"
                  >
                    <div className="px-4 py-3 border-b border-white/5 mb-1 bg-white/[0.02]">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Neural Engine Architecture</p>
                    </div>
                    {AVAILABLE_MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => updateSessionModel(m.id)}
                        className={cn(
                          "w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center justify-between group relative overflow-hidden",
                          currentModel === m.id ? "bg-brand/10 text-brand border border-brand/20 shadow-inner" : "hover:bg-white/5 text-slate-400 hover:text-white"
                        )}
                      >
                        <div className="relative z-10">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black tracking-tight">{m.name}</span>
                            {currentModel === m.id && <Zap size={10} className="fill-current shadow-neon-purple shadow-[0_0_5px_brand]" />}
                          </div>
                          <p className="text-[9px] font-bold opacity-60 group-hover:opacity-100 uppercase tracking-tighter mt-0.5">{m.description}</p>
                        </div>
                        {currentModel === m.id && <div className="absolute right-0 top-0 bottom-0 w-1 bg-brand"></div>}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {chatId && (
              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsShareModalOpen(true)}
                className="p-3 text-blue-400 hover:text-blue-300 rounded-xl transition-all border border-blue-400/10 shadow-inner"
              >
                <Share2 size={18} />
              </motion.button>
            )}
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleVoiceMode}
              className={cn(
                "p-3 rounded-xl transition-all border shadow-inner",
                isVoiceMode ? "text-brand bg-brand/10 border-brand/20 shadow-neon-purple shadow-[0_0_10px_brand]" : "text-slate-500 border-white/5 bg-white/5"
              )}
            >
              {isVoiceMode ? <Headphones size={20} /> : <AudioLines size={20} />}
            </motion.button>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 custom-scrollbar pb-32">
          {messages.length === 0 && !isTyping && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-10 relative">
              <div className="absolute inset-0 bg-brand/5 blur-[120px] rounded-full"></div>
              <div className="w-24 h-24 bg-brand/10 border border-brand/20 rounded-3xl flex items-center justify-center relative shadow-neon-purple shadow-[0_0_20px_brand]">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="absolute inset-0 bg-brand/20 blur-2xl rounded-3xl"
                />
                <Bot size={48} className="text-brand relative z-10" />
              </div>
              <div className="relative z-10">
                <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic">Neural Sync Required</h3>
                <p className="text-slate-500 mt-4 font-bold max-w-md mx-auto leading-relaxed uppercase text-[10px] tracking-[0.2em]">Ready for complex data processing, code architecture, and high-fidelity generation.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full relative z-10">
                {["Simulate startup growth", "Debug React state leak", "Optimize SQL queries", "Write poetic documentation"].map(suggestion => (
                  <motion.button 
                    key={suggestion}
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(168, 85, 247, 0.4)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setInput(suggestion)}
                    className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-[11px] font-black text-slate-400 hover:text-white transition-all text-left uppercase tracking-widest shadow-inner shadow-black/40"
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id || idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 md:gap-8 max-w-4xl mx-auto",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-10 h-10 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 border relative",
                msg.role === 'user' 
                  ? "bg-slate-900 border-white/10 text-brand shadow-inner" 
                  : "bg-brand border-brand/40 text-white shadow-neon-purple shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              )}>
                {msg.role === 'user' ? <UserIcon size={20} /> : <Bot size={24} />}
                {msg.role === 'assistant' && (
                  <motion.div
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute -inset-1 bg-brand/20 blur-lg rounded-2xl -z-10"
                  />
                )}
              </div>
              <div className={cn(
                "max-w-[85%] md:max-w-[80%] space-y-3",
                msg.role === 'user' ? "text-right" : "text-left"
              )}>
                <div className={cn(
                  "p-5 md:p-8 rounded-[2rem] text-sm md:text-base leading-relaxed break-words shadow-2xl relative border overflow-hidden",
                  msg.role === 'user' 
                    ? "bg-[#0f172a] text-slate-200 border-white/5 rounded-tr-none" 
                    : "bg-white/[0.03] text-slate-100 border-white/10 rounded-tl-none backdrop-blur-sm shadow-inner"
                )}>
                  {msg.role === 'assistant' && (
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-brand/50 via-transparent to-transparent"></div>
                  )}
                  <div className={cn(
                    "prose prose-sm md:prose-base dark:prose-invert max-w-none transition-all",
                    msg.role === 'assistant' ? "text-slate-200" : "text-slate-400"
                  )}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-5 px-4">
                    <motion.button 
                      whileHover={{ scale: 1.2, color: '#fff' }}
                      whileTap={{ scale: 0.8 }}
                      onClick={() => handleCopy(msg.content, msg.id || `${idx}`)}
                      className={cn(
                        "transition-all duration-300",
                        copiedId === (msg.id || `${idx}`) ? "text-green-400 scale-125" : "text-slate-600 hover:text-white"
                      )}
                      title="Clone Data"
                    >
                      {copiedId === (msg.id || `${idx}`) ? (
                        <Check size={16} className="animate-in fade-in zoom-in duration-300" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.2, color: '#60a5fa' }}
                      whileTap={{ scale: 0.8 }}
                      onClick={() => handleShare(msg.content, msg.id || `${idx}`)}
                      className={cn(
                        "transition-all duration-300",
                        sharedId === (msg.id || `${idx}`) ? "text-brand scale-125 shadow-neon-purple shadow-[0_0_10px_brand]" : "text-slate-600 hover:text-white"
                      )}
                      title="Broadcast"
                    >
                      {sharedId === (msg.id || `${idx}`) ? (
                        <Check size={16} className="animate-in fade-in zoom-in duration-300" />
                      ) : (
                        <Share2 size={16} />
                      )}
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.2, color: '#a855f7' }}
                      whileTap={{ scale: 0.8 }}
                      onClick={() => isSpeaking && speakingMessageId === (msg.id || `${idx}`) ? stopSpeaking() : speakText(msg.content, msg.id || `${idx}`)}
                      className={cn(
                        "transition-all duration-300",
                        speakingMessageId === (msg.id || `${idx}`) ? "text-brand scale-125" : "text-slate-600 hover:text-white"
                      )}
                      title={speakingMessageId === (msg.id || `${idx}`) ? "Terminate Audio" : "Voice Synthesis"}
                    >
                      {speakingMessageId === (msg.id || `${idx}`) ? (
                        <VolumeX size={16} className="animate-pulse shadow-neon-purple" />
                      ) : (
                        <Volume2 size={16} />
                      )}
                    </motion.button>
                    <div className="h-px flex-1 bg-white/5 mx-2"></div>
                    <span className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em] whitespace-nowrap">Neural Signal Locked</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 md:gap-8 max-w-4xl mx-auto items-start"
            >
              <div className="w-10 h-10 md:w-14 md:h-14 bg-brand rounded-2xl flex items-center justify-center text-white shrink-0 animate-pulse shadow-neon-purple shadow-[0_0_15px_brand] border border-brand/40 relative overflow-hidden group">
                <motion.div 
                  animate={{ 
                    rotate: 360 
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }}
                  className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent,rgba(255,255,255,0.1),transparent)]"
                />
                <Bot size={24} className="relative z-10" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="bg-white/[0.03] p-5 md:p-6 rounded-[2rem] rounded-tl-none border border-white/10 shadow-inner backdrop-blur-md relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-brand/40 via-transparent to-transparent"></div>
                  <div className="flex gap-2 items-center">
                    <motion.div 
                      key="dot1"
                      animate={{ 
                        scale: [1, 1.4, 1],
                        opacity: [0.3, 1, 0.3],
                        backgroundColor: ["#a855f7", "#d8b4fe", "#a855f7"]
                      }} 
                      transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} 
                      className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]" 
                    />
                    <motion.div 
                      key="dot2"
                      animate={{ 
                        scale: [1, 1.4, 1],
                        opacity: [0.3, 1, 0.3],
                        backgroundColor: ["#a855f7", "#d8b4fe", "#a855f7"]
                      }} 
                      transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} 
                      className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]" 
                    />
                    <motion.div 
                      key="dot3"
                      animate={{ 
                        scale: [1, 1.4, 1],
                        opacity: [0.3, 1, 0.3],
                        backgroundColor: ["#a855f7", "#d8b4fe", "#a855f7"]
                      }} 
                      transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} 
                      className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]" 
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4">
                  <span className="text-[9px] font-black text-brand uppercase tracking-[0.3em] animate-pulse italic">Neural Signal Processing</span>
                  <div className="h-px w-8 bg-brand/20"></div>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Action Input Area */}
        <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-[#020617] via-[#020617] to-transparent pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto relative">
            <AnimatePresence>
              {audioError && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "absolute -top-24 left-0 right-0 mx-auto w-fit px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50 border backdrop-blur-xl",
                    audioError.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                    audioError.type === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                    "bg-[#0f172a] text-white border-white/10"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-inner",
                    audioError.type === 'error' ? "bg-red-500/20" :
                    audioError.type === 'warning' ? "bg-amber-500/20" :
                    "bg-white/10"
                  )}>
                    {audioError.type === 'error' ? <MicOff size={16} /> : <AlertCircle size={16} />}
                  </div>
                  <p className="text-[12px] font-black uppercase tracking-tight leading-relaxed max-w-[320px]">{audioError.message}</p>
                  <button 
                    onClick={() => setAudioError(null)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors ml-2"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status Indicators */}
            <AnimatePresence>
              {(isListening || interimTranscript) && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mx-4 mb-6 p-6 bg-[#0f172a]/95 border border-brand/20 rounded-[3rem] flex flex-col gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl border-b-4 border-b-brand relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand to-transparent opacity-30"></div>
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-brand rounded-full flex items-center justify-center text-white relative shadow-neon-purple shadow-[0_0_15px_brand]">
                        <motion.div
                          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 bg-brand rounded-full"
                        />
                        <Mic size={24} className="relative z-10" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-brand uppercase tracking-[0.4em] mb-1">Live Signal Processing</span>
                        <div className="flex items-end gap-[4px] h-5">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                            <motion.div
                              key={i}
                              animate={{
                                height: [6, 20, 10, 24, 6, 12, 6],
                              }}
                              transition={{
                                repeat: Infinity,
                                duration: 0.7 + Math.random() * 0.5,
                                delay: i * 0.04,
                                ease: "easeInOut",
                              }}
                              className="w-[3px] bg-brand/50 rounded-full shadow-[0_0_5px_rgba(168,85,247,0.3)]"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(168, 85, 247, 0.2)' }}
                      whileTap={{ scale: 0.95 }}
                      onClick={toggleListening}
                      className="px-6 py-3 bg-brand/10 text-white border border-brand/40 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-neon-purple shadow-[0_0_10px_rgba(168,85,247,0.2)] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                    >
                      TERMINATE SIGNAL
                    </motion.button>
                  </div>
                  
                  {interimTranscript && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="px-5 py-4 bg-white/[0.03] rounded-2xl border border-white/5 shadow-inner"
                    >
                      <p className="text-sm text-slate-300 italic font-medium leading-relaxed tracking-tight">
                        &quot;{interimTranscript}&quot;
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* General Error Display */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mx-4 mb-6 p-5 bg-red-500/10 border border-red-500/20 rounded-[2.5rem] flex items-center gap-4 text-red-400 shadow-2xl backdrop-blur-xl"
                >
                  <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 shrink-0 border border-red-500/20">
                    <AlertCircle size={20} />
                  </div>
                  <p className="text-[13px] font-black uppercase tracking-tight leading-relaxed">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* File Previews */}
            <AnimatePresence>
              {attachedFiles.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex flex-wrap gap-3 mb-4 px-6"
                >
                  {attachedFiles.map((file, idx) => (
                    <motion.div 
                      key={`${file.name}-${idx}`}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-3 group backdrop-blur-xl shadow-inner"
                    >
                      <File size={16} className="text-brand" />
                      <span className="text-[11px] font-black text-slate-300 truncate max-w-[140px] uppercase tracking-tight">{file.name}</span>
                      <motion.button 
                        type="button"
                        whileHover={{ scale: 1.2, color: '#ef4444' }}
                        whileTap={{ scale: 0.8 }}
                        onClick={() => removeFile(idx)}
                        className="text-slate-500 transition-colors bg-white/5 p-1 rounded-lg"
                      >
                        <X size={14} />
                      </motion.button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <form 
              onSubmit={handleSend}
              className="relative group sm:px-6"
            >
              {/* Suggestions Dropdown */}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-6 right-6 mb-4 bg-[#0f172a] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-50 p-1.5"
                  >
                    <div className="px-3 py-2 border-b border-white/5 mb-1 bg-white/[0.02] flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                        <Bot size={12} className="text-brand" /> Neural Code Completion
                      </p>
                      <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">Use [Arrow Keys] + [Tab]</span>
                    </div>
                    {suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applySuggestion(suggestion)}
                        onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group/item relative overflow-hidden",
                          selectedSuggestionIndex === idx ? "bg-brand/10 text-brand border border-brand/20 shadow-inner" : "hover:bg-white/5 text-slate-400 hover:text-white border border-transparent"
                        )}
                      >
                        <Zap size={12} className={cn(selectedSuggestionIndex === idx ? "text-brand" : "text-slate-700")} />
                        <code className="text-xs font-mono truncate flex-1">{suggestion}</code>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="absolute inset-0 bg-brand/5 blur-3xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-700"></div>
              <div className="relative bg-[#0f172a]/80 border border-white/10 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.6)] p-3 focus-within:ring-2 focus-within:ring-brand/40 focus-within:border-brand/40 transition-all backdrop-blur-3xl shadow-inner">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="DEPLOY NEURAL QUERY..."
                  rows={1}
                  className="w-full bg-transparent border-none focus:ring-0 resize-none py-5 px-8 text-white placeholder:text-slate-600 outline-none max-h-48 text-base font-bold tracking-tight"
                  onKeyDown={handleKeyDown}
                />
                <div className="flex items-center justify-between px-4 pb-1 pt-0">
                  <div className="flex items-center gap-2">
                    <div className="relative" ref={voiceSettingsRef}>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                        className={cn(
                          "p-4 rounded-[1.5rem] transition-all border",
                          showVoiceSettings ? "bg-brand/20 text-brand border-brand/40 shadow-neon-purple" : "text-slate-500 border-white/5 hover:border-white/10"
                        )}
                        title="Neural Voice Settings"
                      >
                        <AudioLines size={22} />
                      </motion.button>
                      
                      <AnimatePresence>
                        {showVoiceSettings && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full left-0 mb-6 w-72 bg-[#0f172a] border border-white/10 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.7)] z-50 p-6 space-y-6 backdrop-blur-3xl"
                          >
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center justify-between">
                                Neural Voice Selection
                                <span className="text-brand font-black italic">{selectedVoice}</span>
                              </label>
                              <div className="grid grid-cols-4 gap-1.5">
                                {['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Eos', 'Orpheus'].map(voice => (
                                  <button
                                    key={voice}
                                    type="button"
                                    onClick={() => setSelectedVoice(voice)}
                                    className={cn(
                                      "px-1 py-3 rounded-xl text-[9px] font-black border transition-all text-center truncate uppercase tracking-tighter",
                                      selectedVoice === voice 
                                        ? "bg-brand/20 border-brand/40 text-brand shadow-neon-purple" 
                                        : "bg-white/5 border-white/5 text-slate-600 hover:text-slate-400 hover:border-white/10"
                                    )}
                                    title={voice}
                                  >
                                    {voice.slice(0, 4)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-5">
                              <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                  <div className="flex items-center gap-2"><Volume2 size={12} /> Amplitude</div>
                                  <span className="text-white">{Math.round(voiceVolume * 100)}%</span>
                                </div>
                                <input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={voiceVolume}
                                  onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                                  className="w-full transition-all accent-brand h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer"
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                  <div className="flex items-center gap-2"><AudioLines size={12} /> Temporal Velocity</div>
                                  <span className="text-white">{voiceSpeed}x</span>
                                </div>
                                <input 
                                  type="range"
                                  min="0.5"
                                  max="2"
                                  step="0.1"
                                  value={voiceSpeed}
                                  onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                                  className="w-full transition-all accent-brand h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer"
                                />
                              </div>
                            </div>

                            <button 
                              type="button"
                              onClick={() => speakText("Neural audio calibration complete.")}
                              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-all"
                            >
                              Test Modulation
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <motion.button 
                      type="button"
                      whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleListening}
                      className={cn(
                        "p-4 rounded-[1.5rem] transition-all relative border",
                        isListening ? "bg-brand/20 text-brand border-brand/40 shadow-neon-purple shadow-[0_0_15px_brand]" : "text-slate-500 border-white/5 hover:border-white/10"
                      )}
                      title={isListening ? "DEACTIVATE SIGNAL" : "ACTIVATE NEURAL MIC"}
                    >
                      <AnimatePresence>
                        {isListening && (
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0.5 }}
                            animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.3, 0.1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute inset-0 bg-brand rounded-[1.5rem]"
                          />
                        )}
                      </AnimatePresence>
                      {isListening ? <Waves size={22} className="relative z-10" /> : <Mic size={22} className="relative z-10" />}
                    </motion.button>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden" 
                      multiple
                    />
                    <motion.button 
                      type="button" 
                      whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                      whileTap={{ scale: 0.9 }}
                      onClick={triggerFileInput}
                      className="p-4 text-slate-500 hover:text-white border border-white/5 rounded-[1.5rem] transition-all hover:border-white/10"
                    >
                      <Plus size={22} />
                    </motion.button>
                  </div>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(168, 85, 247, 0.5)' }}
                    whileTap={{ scale: 0.95 }}
                    disabled={!input.trim() || isTyping}
                    className="group bg-brand text-white p-4 rounded-[1.5rem] disabled:opacity-20 transition-all shadow-neon-purple shadow-[0_0_20px_brand] flex items-center justify-center border border-white/10"
                  >
                    <Send size={22} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </motion.button>
                </div>
              </div>
            </form>
            <p className="text-[10px] text-center text-slate-600 mt-5 font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3">
              <span>DEPLOY: [ENTER] • NEW BUFFER: [SHIFT+ENTER]</span>
              <span className="w-1 h-1 bg-white/10 rounded-full" />
              <button 
                onClick={() => navigate('/settings')}
                className="text-brand hover:text-brand-light transition-colors flex items-center gap-1 group"
              >
                <Crown size={10} className="group-hover:scale-125 transition-transform" />
                FOUNDER REGISTRY
              </button>
            </p>
          </div>
        </div>
      </div>
      <audio ref={audioRef} className="hidden" />
      
      {/* Voice Mode Overlay */}
      <AnimatePresence>
        {isVoiceMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#020617] flex flex-col items-center justify-center p-8 text-center overscroll-none"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.08)_0%,transparent_70%)]"></div>
            
            <div className="absolute top-12 left-12 z-10 flex gap-4">
              <div className="relative" ref={voiceSettingsOverlayRef}>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                  className={cn(
                    "w-16 h-16 bg-white/[0.02] border border-white/10 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-xl shadow-inner",
                    showVoiceSettings && "bg-brand/20 text-brand border-brand/40 shadow-neon-purple"
                  )}
                  title="Voice Settings"
                >
                  <AudioLines size={28} />
                </motion.button>

                <AnimatePresence>
                  {showVoiceSettings && (
                    <motion.div
                      initial={{ opacity: 0, x: -10, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -10, scale: 0.95 }}
                      className="absolute top-0 left-20 w-72 bg-[#0f172a] border border-white/10 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.7)] z-50 p-6 space-y-6 backdrop-blur-3xl text-left"
                    >
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center justify-between">
                          Neural Voice Selection
                          <span className="text-brand font-black italic">{selectedVoice}</span>
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Eos', 'Orpheus'].map(voice => (
                            <button
                              key={voice}
                              type="button"
                              onClick={() => setSelectedVoice(voice)}
                              className={cn(
                                "px-1 py-3 rounded-xl text-[9px] font-black border transition-all text-center truncate uppercase tracking-tighter",
                                selectedVoice === voice 
                                  ? "bg-brand/20 border-brand/40 text-brand shadow-neon-purple" 
                                  : "bg-white/5 border-white/5 text-slate-600 hover:text-slate-400 hover:border-white/10"
                              )}
                              title={voice}
                            >
                              {voice.slice(0, 4)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            <div className="flex items-center gap-2"><Volume2 size={12} /> Amplitude</div>
                            <span className="text-white">{Math.round(voiceVolume * 100)}%</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={voiceVolume}
                            onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                            className="w-full transition-all accent-brand h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            <div className="flex items-center gap-2"><AudioLines size={12} /> Temporal Velocity</div>
                            <span className="text-white">{voiceSpeed}x</span>
                          </div>
                          <input 
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.1"
                            value={voiceSpeed}
                            onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                            className="w-full transition-all accent-brand h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="absolute top-12 right-12 z-10">
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90, backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleVoiceMode}
                className="w-16 h-16 bg-white/[0.02] border border-white/10 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-xl group shadow-inner"
              >
                <X size={28} className="group-hover:text-red-500 transition-colors" />
              </motion.button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center space-y-16 max-w-2xl relative z-10">
              <div className="relative">
                <motion.div 
                  animate={{ 
                    scale: isListening || isSpeaking ? [1, 1.4, 1] : 1,
                    opacity: isListening || isSpeaking ? [0.1, 0.4, 0.1] : 0.05
                  }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute inset-0 bg-brand rounded-full blur-[100px]"
                />
                <div className="relative w-48 h-48 bg-gradient-to-tr from-[#0f172a] to-[#1e293b] border border-white/10 rounded-full flex items-center justify-center text-white shadow-[0_0_80px_rgba(168,85,247,0.2)] overflow-hidden">
                  <div className="absolute inset-0 bg-brand/5 animate-pulse"></div>
                  {isSpeaking ? (
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 0.5 }}
                    >
                      <Waves size={64} className="text-brand shadow-neon-purple shadow-[0_0_20px_brand]" />
                    </motion.div>
                  ) : (
                    <motion.div
                      animate={isListening ? { y: [0, -10, 0] } : {}}
                      transition={{ repeat: Infinity, duration: 1 }}
                    >
                      <Mic size={64} className={cn("text-brand transition-all", isListening && "shadow-neon-purple shadow-[0_0_20px_brand]")} />
                    </motion.div>
                  )}
                </div>
                
                {/* Orbital Rings */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                  className="absolute -inset-8 border border-brand/10 rounded-full border-dashed"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                  className="absolute -inset-16 border border-white/5 rounded-full border-dashed"
                />
              </div>

              <div className="space-y-6">
                <motion.h2 
                  key={isSpeaking ? 'speaking' : isListening ? 'listening' : 'thinking'}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-5xl font-black text-white tracking-tighter uppercase italic"
                >
                  {isSpeaking ? "Neural Audio Synthesis" : isListening ? "Neural Signal Input" : "Cognitive Processing"}
                </motion.h2>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-brand text-xl font-black uppercase tracking-[0.4em] animate-pulse">
                    {isSpeaking ? "Broadcasting Insights" : isListening ? "Buffer Ready for Voice" : "Analyzing Intelligence"}
                  </p>
                  <p className="text-slate-500 font-bold max-w-sm tracking-tight leading-relaxed uppercase text-[10px]">
                    High-fidelity biometric voice analysis in progress. Ensure environment is secure.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 h-16">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: (isSpeaking || isListening) ? [20, 64, 20] : 20,
                      backgroundColor: (isSpeaking || isListening) ? ['#a855f7', '#3b82f6', '#a855f7'] : 'rgba(255, 255, 255, 0.1)'
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 0.4 + Math.random() * 0.4,
                      delay: i * 0.08
                    }}
                    className="w-2.5 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                  />
                ))}
              </div>
            </div>

            <div className="pb-16 relative z-10 flex flex-col items-center gap-4">
              <div className="px-6 py-2 bg-white/5 border border-white/10 rounded-full flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">Neural Link: Stable</span>
              </div>
              <p className="text-slate-600 text-[11px] font-black uppercase tracking-[0.2em] max-w-xs">
                Real-time Audio Transmission Active
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        itemId={chatId || ''}
        itemType="chat"
        itemTitle={allSessions.find(s => s.id === chatId)?.title || 'New Session'}
      />
    </div>
  );
}
