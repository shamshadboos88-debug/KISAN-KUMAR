import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { 
  Settings as SettingsIcon, 
  Cpu, 
  MessageSquare, 
  Zap, 
  Check,
  Crown,
  Sparkles,
  Trash2,
  AlertCircle,
  Image as ImageIcon,
  Smartphone,
  Download,
  MonitorSmartphone,
  Share2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';

const models = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash', desc: 'Optimized for speed and efficiency (Free Tier)' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: 'Advanced reasoning and large-scale context' },
  { id: 'gemini-2.0-pro-exp', name: 'Gemini 2.0 Pro', desc: 'Experimental superior reasoning' },
] as const;

const imageModels = [
  { id: 'gemini-2.5-flash-image', name: 'Gemini Image v1', desc: 'High-fidelity creative synthesis' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini Vision Exp', desc: 'Experimental vision and image generation' },
] as const;

const personas = [
  { id: 'professional', name: 'Professional', desc: 'Formal, structured, and business-ready' },
  { id: 'creative', name: 'Creative', desc: 'Imaginative, vivid, and highly expressive' },
  { id: 'concise', name: 'Concise', desc: 'Direct, efficient, and bullet-pointed' },
  { id: 'academic', name: 'Academic', desc: 'Scholarly, thorough, and research-focused' },
  { id: 'custom', name: 'Custom DNA', desc: 'Define your own unique writing style and tone' },
] as const;

export function Settings() {
  const { profile, updateSettings } = useAuth();
  const [activeModel, setActiveModel] = useState(profile?.settings?.preferredModel || 'gemini-3-flash-preview');
  const [activeImageModel, setActiveImageModel] = useState(profile?.settings?.preferredImageModel || 'gemini-2.5-flash-image');
  const [activePersona, setActivePersona] = useState(profile?.settings?.persona || 'professional');
  const [customInstruction, setCustomInstruction] = useState(profile?.settings?.customPersonaInstruction || '');
  const [apiKey, setApiKey] = useState(profile?.settings?.apiKey || '');
  const [tone, setTone] = useState(profile?.settings?.fineTuning?.tone || '');
  const [temperature, setTemperature] = useState(profile?.settings?.fineTuning?.temperature || 0.7);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await updateSettings({
      preferredModel: activeModel as any,
      preferredImageModel: activeImageModel as any,
      persona: activePersona as any,
      customPersonaInstruction: activePersona === 'custom' ? (customInstruction || '') : null,
      apiKey: apiKey || undefined,
      fineTuning: {
        tone,
        temperature
      }
    });
    setIsSaving(false);
  };

  return (
    <div className="p-6 lg:p-12 max-w-5xl mx-auto space-y-12 bg-[#020617] min-h-full relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand/5 blur-[120px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-brand-light/5 blur-[100px] rounded-full pointer-events-none translate-x-1/2 translate-y-1/2"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10 border-b border-white/5 pb-10">
        <div className="space-y-3">
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter flex items-center gap-4 uppercase italic">
            <SettingsIcon className="text-brand shadow-neon-purple shadow-[0_0_15px_brand]" size={40} /> Neural Control
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] italic">Cognoryx Interface: <span className="text-brand">Configuration Portal</span></p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(168,85,247,0.5)' }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSave}
          disabled={isSaving}
          className="bg-brand text-white px-10 py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-neon-purple disabled:opacity-20 w-full md:w-auto border border-white/10"
        >
          {isSaving ? 'SYNCHRONIZING...' : 'COMMIT CHANGES'}
        </motion.button>
      </div>

      {/* Neural Configuration Group */}
      <div className="space-y-10 p-10 md:p-16 bg-[#0f172a]/50 rounded-[4rem] border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl relative z-10 shadow-inner">
        <div className="space-y-3 px-2 border-l-4 border-brand pl-8">
          <h2 className="text-3xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter">
            <Cpu className="text-brand" size={32} /> ARCHITECTURE CONFIG
          </h2>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">Initialize core intelligence parameters</p>
        </div>

        <div className="grid grid-cols-1 gap-14">
          {/* Language Model Selection */}
          <section className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-inner">
                <Cpu size={22} />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Language Logic Nodes</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {models.map((model) => {
                const isSelected = activeModel === model.id;

                return (
                  <motion.button
                    key={model.id}
                    whileHover={{ scale: 1.02, x: 5, backgroundColor: 'rgba(255,255,255,0.03)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveModel(model.id as any)}
                    className={cn(
                      "relative p-8 rounded-[2.5rem] border-2 text-left transition-all shadow-inner",
                      isSelected 
                        ? "bg-white/[0.05] border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]" 
                        : "bg-white/[0.02] border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        isSelected ? "border-blue-500 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "border-slate-800"
                      )}>
                        {isSelected && <motion.div layoutId="model-check" className="w-2.5 h-2.5 bg-white rounded-full shadow-inner" />}
                      </div>
                    </div>
                    <h4 className="font-black text-white mb-2 uppercase tracking-tight text-sm italic">{model.name}</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-bold italic tracking-tight">{model.desc}</p>
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* Image Model Selection */}
          <section className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shadow-inner">
                <ImageIcon size={22} />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Visual Synthesis Array</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {imageModels.map((model) => {
                const isSelected = activeImageModel === model.id;

                return (
                  <motion.button
                    key={model.id}
                    whileHover={{ scale: 1.02, x: 5, backgroundColor: 'rgba(255,255,255,0.03)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveImageModel(model.id as any)}
                    className={cn(
                      "relative p-8 rounded-[2.5rem] border-2 text-left transition-all flex items-start gap-6 shadow-inner",
                      isSelected 
                        ? "bg-white/[0.05] border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.1)]" 
                        : "bg-white/[0.02] border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-all",
                      isSelected ? "border-orange-500 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" : "border-slate-800"
                    )}>
                      {isSelected && <motion.div layoutId="image-model-check" className="w-2.5 h-2.5 bg-white rounded-full shadow-inner" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-black text-white uppercase tracking-tight text-sm italic">{model.name}</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-bold italic tracking-tight">{model.desc}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* API Keys Section */}
          <section className="space-y-8 pt-10 border-t border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shadow-inner">
                <SettingsIcon size={22} />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Protocol Authorization</h3>
            </div>
            <div className="bg-white/[0.02] border-2 border-white/5 rounded-[3rem] p-10 space-y-6 shadow-inner relative overflow-hidden">
               <div className="absolute top-0 right-0 p-10 opacity-[0.03]">
                  <Zap size={100} />
               </div>
              <div className="flex items-center justify-between relative z-10">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] block">GEMINI CORE KEY</label>
                <span className="text-[8px] font-black text-brand uppercase tracking-[0.2em] bg-brand/10 px-3 py-1.5 rounded-full border border-brand/20 shadow-neon-purple shadow-[0_0_10px_rgba(168,85,247,0.1)] italic">NEURAL OVERRIDE</span>
              </div>
              <div className="relative group z-10">
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="INJECT CUSTOM API CIPHER..."
                  className="w-full bg-black/40 border-2 border-white/5 rounded-2xl p-5 text-sm md:text-base focus:border-brand/40 outline-none transition-all shadow-inner font-mono text-white placeholder:text-slate-800"
                />
              </div>
              <p className="text-[9px] text-slate-600 leading-relaxed font-bold uppercase tracking-[0.1em] italic relative z-10">
                DEFAULT COGNORYX CHANNEL IS ACTIVE. PROVIDE A CUSTOM NODE CIPHER TO BYPASS SYSTEM LIMITS. DATA IS STORED IN ENCRYPTED PRIVATE VECTORS.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Experience Tailoring Group */}
      <div className="space-y-10 p-10 md:p-16 bg-[#0f172a]/50 rounded-[4rem] border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl relative z-10 shadow-inner">
        <div className="space-y-3 px-2 border-l-4 border-purple-500 pl-8">
          <h2 className="text-3xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter">
            <Sparkles className="text-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]" size={32} /> Experience Mapping
          </h2>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">Fine-tune subjective intelligence vectors</p>
        </div>

        {/* Persona Selection */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-inner">
              <MessageSquare size={22} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Writing Persona Profile</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {personas.map((persona) => {
              const isSelected = activePersona === persona.id;
              return (
                <motion.button
                  key={persona.id}
                  whileHover={{ scale: 1.02, x: 5, backgroundColor: 'rgba(255,255,255,0.03)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActivePersona(persona.id as any)}
                  className={cn(
                    "p-8 rounded-[2.5rem] border-2 text-left transition-all flex items-center gap-6 shadow-inner",
                    isSelected 
                      ? "bg-white/[0.05] border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.1)]" 
                      : "bg-white/[0.02] border-white/5 hover:border-white/10"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                    isSelected ? "border-purple-500 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" : "border-slate-800"
                  )}>
                    {isSelected && <motion.div layoutId="persona-check" className="w-2.5 h-2.5 bg-white rounded-full shadow-inner" />}
                  </div>
                  <div className={cn(
                    "w-14 h-14 rounded-[1.5rem] flex items-center justify-center shrink-0 transition-all shadow-inner",
                    isSelected ? "bg-purple-500 text-white shadow-neon-purple shadow-[0_0_15px_rgba(168,85,247,0.4)]" : "bg-white/5 text-slate-500"
                  )}>
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-white mb-2 uppercase tracking-tight text-sm italic">{persona.name}</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-bold italic tracking-tight">{persona.desc}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {activePersona === 'custom' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-10 bg-white/[0.02] border-2 border-white/5 rounded-[3rem] space-y-6 shadow-inner"
            >
              <div className="flex items-center gap-3 text-white font-black uppercase tracking-widest italic text-sm">
                <Zap size={20} className="text-brand shadow-neon-purple shadow-[0_0_10px_brand]" /> Neural Blueprint Matrix
              </div>
              <textarea
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="Example: You are a witty tech journalist. Use modern slang, be slightly cynical, and focus on developer experience."
                className="w-full bg-black/40 border-2 border-white/5 rounded-[2rem] p-8 text-white font-bold italic text-base md:text-lg min-h-[160px] focus:border-brand/40 outline-none transition-all shadow-inner placeholder:text-slate-800"
              />
              <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em] italic">FINE-TUNE LOGIC: THIS INSTRUCTION WILL BE INJECTED INTO EVERY NEURAL INTERACTION.</p>
            </motion.div>
          )}
        </section>

        {/* Fine-Tuning Section */}
        <section className="space-y-10 pt-10 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center shadow-inner">
                <Zap size={22} className="shadow-neon-purple" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Advanced Heuristics</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] block pl-2">WRITING TONE OVERRIDE</label>
              <input 
                type="text" 
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g., Slightly cynical, playful, hyper-logical"
                className="w-full bg-black/40 border-2 border-white/5 rounded-2xl p-5 text-white font-bold italic text-sm focus:border-brand/40 outline-none transition-all shadow-inner placeholder:text-slate-800"
              />
              <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.1em] italic">Define the core frequency of every response signal.</p>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">CREATIVITY ENGINE</label>
                <span className="text-[10px] font-black text-brand bg-brand/10 border border-brand/20 px-3 py-1 rounded-full shadow-neon-purple">
                  {Math.round(temperature * 100)}% FLUX
                </span>
              </div>
              <div className="px-4">
                <input 
                  type="range" 
                  min="0" 
                  max="1.5" 
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-600 font-black uppercase tracking-[0.2em] italic px-2">
                <span>PRECISE</span>
                <span>NEURAL BALANCED</span>
                <span>CHAOTIC FLUX</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Deployment Group */}
      <div className="space-y-10 p-10 md:p-16 bg-[#0f172a]/50 rounded-[4rem] border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl relative z-10 shadow-inner">
        <div className="space-y-3 px-2 border-l-4 border-blue-500 pl-8">
          <h2 className="text-3xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter">
            <Smartphone className="text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]" size={32} /> Mobile Deployment
          </h2>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">Initialize Cognoryx AI on native mobile hardware</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white/[0.02] border border-white/10 rounded-[3rem] p-10 space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <Download size={80} />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                <MonitorSmartphone size={24} />
              </div>
              <h3 className="text-xl font-black text-white uppercase italic">Native PWA Install</h3>
            </div>
            <p className="text-xs text-slate-400 font-bold leading-relaxed italic">
              Cognoryx AI is engineered as a <span className="text-brand">Progressive Web App (PWA)</span>. This allows you to install it directly onto your Android or iOS home screen without needing a traditional APK.
            </p>
            <div className="space-y-4 pt-4">
              <div className="flex items-start gap-4">
                <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-brand shrink-0">1</span>
                <p className="text-[11px] text-slate-500 font-bold italic">Open Cognoryx AI in Chrome on your Android device.</p>
              </div>
              <div className="flex items-start gap-4">
                <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-brand shrink-0">2</span>
                <p className="text-[11px] text-slate-500 font-bold italic">Tap the three dots (Overflow Menu) in the top-right corner.</p>
              </div>
              <div className="flex items-start gap-4">
                <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-brand shrink-0">3</span>
                <p className="text-[11px] text-slate-500 font-bold italic">Select <span className="text-white">"Install app"</span> or <span className="text-white">"Add to Home screen"</span>.</p>
              </div>
            </div>
          </div>

          <div className="bg-brand/5 border border-brand/20 rounded-[3rem] p-10 space-y-6 flex flex-col justify-center items-center text-center relative overflow-hidden">
             <div className="absolute inset-0 bg-brand/5 blur-3xl rounded-full opacity-50"></div>
             <Zap size={48} className="text-brand mb-4 shadow-neon-purple animate-pulse" />
             <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Instant Synchronization</h3>
             <p className="text-xs text-slate-400 font-bold leading-relaxed italic max-w-xs">
               Your neural settings and history will sync instantly across all devices via the decentralized Firebase matrix.
             </p>
             <button 
               onClick={() => {
                 if (navigator.share) {
                   navigator.share({
                     title: 'Cognoryx AI',
                     text: 'Check out Cognoryx AI - All-in-one productivity platform',
                     url: window.location.href,
                   });
                 } else {
                   navigator.clipboard.writeText(window.location.href);
                   alert('URL copied to clipboard. Open it on your mobile device to install!');
                 }
               }}
               className="mt-6 flex items-center gap-3 px-8 py-3 bg-brand text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-neon-purple border border-white/10 hover:scale-105 transition-all"
             >
               <Share2 size={16} /> BROADCAST LINK
             </button>
          </div>
        </div>
      </div>

      {/* Privacy & Data Group */}
      <div className="space-y-10 p-10 md:p-16 bg-[#0f172a]/50 rounded-[4rem] border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl relative z-10 shadow-inner">
        <div className="space-y-3 px-2 border-l-4 border-red-500 pl-8">
          <h2 className="text-3xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter">
            <Trash2 className="text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" size={32} /> Privacy & Data
          </h2>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">Manage stored neural traces and records</p>
        </div>

        <div className="bg-red-500/5 border-2 border-red-500/10 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-[0.02] text-red-500">
            <AlertCircle size={100} />
          </div>
          
          <div className="space-y-2 relative z-10">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Purge Neural Records</h3>
            <p className="text-xs text-slate-500 font-bold italic max-w-md">
              Permanently delete all conversation history, buffers, and session data. This action is instantaneous and irreversible across all nodes.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              if (profile && window.confirm('DANGER: This will permanently delete ALL chat history. Proceed?')) {
                const { collection, getDocs, deleteDoc } = await import('firebase/firestore');
                // We need to implement this logic or just navigate to chat and use the button there
                // For better UX, let's implement it here too.
                try {
                  const chatsRef = collection(db, 'users', profile.uid, 'chats');
                  const chatsSnap = await getDocs(chatsRef);
                  await Promise.all(chatsSnap.docs.map(async (chatDoc) => {
                    const id = chatDoc.id;
                    const messagesRef = collection(db, 'users', profile.uid, 'chats', id, 'messages');
                    const messagesSnap = await getDocs(messagesRef);
                    await Promise.all(messagesSnap.docs.map(d => deleteDoc(d.ref)));
                    await deleteDoc(chatDoc.ref);
                  }));
                  alert('Neural history successfully purged.');
                } catch (err) {
                  console.error(err);
                }
              }
            }}
            className="px-8 py-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:border-red-500 transition-all shadow-inner relative z-10"
          >
            INITIALIZE PURGE
          </motion.button>
        </div>
      </div>

      {/* Founder Information Group */}
      <div className="space-y-10 p-10 md:p-16 bg-[#0f172a]/50 rounded-[4rem] border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl relative z-10 shadow-inner">
        <div className="space-y-3 px-2 border-l-4 border-brand pl-8">
          <h2 className="text-3xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter">
            <Crown className="text-brand shadow-[0_0_15px_rgba(168,85,247,0.4)]" size={32} /> Founder Registry
          </h2>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">Official records of Congnoryx AI Foundation</p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-12 bg-white/[0.02] p-10 rounded-[3rem] border border-white/5 shadow-inner">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-48 h-48 md:w-64 md:h-64 rounded-[3rem] overflow-hidden border-2 border-brand/30 shadow-neon-purple shadow-[0_0_20px_rgba(168,85,247,0.2)] shrink-0"
          >
            <img 
              src="https://r2.erweima.ai/ai_image/89f6d6e2-7634-4a2e-8e8e-6e8e6e8e6e8e/0.png" 
              alt="Kisan Kumar Mahendra Sahu" 
              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://ui-avatars.com/name/Kisan+Sahu?background=a855f7&color=fff";
              }}
            />
          </motion.div>

          <div className="space-y-8 flex-1">
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-white uppercase italic tracking-tight">Kisan Kumar Mahendra Sahu</h3>
              <p className="text-brand font-black uppercase tracking-[0.3em] text-xs italic">Chief Architect & Visionary Founder</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6 border-y border-white/5">
              <div className="space-y-1">
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Chronological Age</p>
                <p className="text-lg font-black text-white italic">18 Standard Solar Years</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Genesis Coordinate</p>
                <p className="text-lg font-black text-white italic">7th August</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Intellectual Background</p>
                <p className="text-lg font-black text-white italic">12th Science (Biology Stream)</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Core Mission</p>
                <p className="text-lg font-black text-white italic">Democratizing Global Intelligence</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
              "Kisan Kumar Mahendra Sahu founded Congnoryx AI at the age of 18, driven by a deep fascination with biology and technical systems. His vision was to bridge the gap between human biological learning and neural intelligence."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
