import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  Plus, 
  Image as ImageIcon,
  Download,
  Share2,
  Trash2,
  Zap,
  Sparkles,
  Loader2,
  Maximize,
  Layout,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Camera,
  Palette,
  Layers,
  Pencil,
  Droplets,
  Cpu,
  Tv,
  Boxes,
  Brush,
  Gamepad2,
  Waves,
  Feather
} from 'lucide-react';
import { generateImage } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc, increment, getDoc } from 'firebase/firestore';

interface SavedImage {
  id: string;
  url: string;
  prompt: string;
  aspectRatio: string;
  style: string | null;
  createdAt: any;
}

export function ImageStudio() {
  const { user, profile } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '3:4' | '4:3' | '9:16' | '16:9'>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<SavedImage[]>([]);
  const [tempImages, setTempImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const MAX_CHARS = 1000;
  const FIRESTORE_LIMIT = 850000; // conservative limit for base64 string (roughly 1MB with document overhead)

  const magicKeywords = [
    { label: 'Cinematic', value: 'cinematic lighting, dramatic shadows' },
    { label: 'Neon', value: 'neon accents, vibrant glowing' },
    { label: '8K', value: 'hyper-realistic, 8k resolution, Unreal Engine 5' },
    { label: 'Surreal', value: 'surrealist masterpiece, dream-like' },
    { label: 'Vintage', value: 'vintage film aesthetic, 35mm grain' },
    { label: 'Macro', value: 'extreme close-up, macro photography' },
    { label: 'Moody', value: 'moody atmosphere, foggy surroundings' },
    { label: 'Golden Hour', value: 'golden hour lighting, warm glow' }
  ];

  const stylePresets = [
    { id: 'photorealistic', label: 'Cinematic Realism', icon: Camera, prompt: 'photorealistic, cinematic lighting, 8k resolution, highly detailed, realistic textures' },
    { id: 'digital-art', label: 'Digital Illustration', icon: Palette, prompt: 'digital art style, high resolution, detailed illustrations, vibrant colors, trending on artstation' },
    { id: 'vector-art', label: 'Sharp Vector', icon: Layers, prompt: 'clean vector art style, flat design, sharp edges, solid bold colors, minimalistic, Adobe Illustrator style' },
    { id: 'sketch', label: 'Hand-Drawn Sketch', icon: Pencil, prompt: 'hand-drawn sketch, pencil drawing, charcoal textures, artistic strokes, rough draft aesthetic, white background' },
    { id: 'watercolor', label: 'Ethereal Watercolor', icon: Droplets, prompt: 'watercolor painting style, soft bleeding colors, paper texture, fluid washes, artistic and ethereal, painterly' },
    { id: 'cyberpunk', label: 'Neon Cyberpunk', icon: Cpu, prompt: 'cyberpunk aesthetic, neon glows, futuristic city, high contrast, synthwave vibes' },
    { id: 'anime', label: 'High-Octane Anime', icon: Tv, prompt: 'anime style, vibrant colors, clean lines, sharp detail, high quality studio animation' },
    { id: '3d-render', label: 'Hyper-Fidelity 3D', icon: Boxes, prompt: '3D render, octane render, unreal engine 5, masterpiece, high fidelity, subsurface scattering' },
    { id: 'oil-painting', label: 'Classic Oil Canvas', icon: Brush, prompt: 'oil painting style, rich textures, expressive brushstrokes, classical art technique' },
    { id: 'pixel-art', label: '8-Bit Nostalgia', icon: Gamepad2, prompt: 'pixel art, 8-bit style, retro gaming aesthetic, vibrant blocky colors, detailed sprites, nostalgic' },
    { id: 'synthwave', label: 'Retro Synthwave', icon: Waves, prompt: 'synthwave aesthetic, neon grid background, retro-futuristic, 80s vibe, purple and pink color palette, vaporwave influence' },
    { id: 'minimalist', label: 'Pure Minimalism', icon: Feather, prompt: 'minimalist style, clean aesthetic, simple composition, sophisticated design' }
  ];

  const aspectRatios: { id: typeof aspectRatio, label: string, icon: any }[] = [
    { id: '1:1', label: 'Square', icon: Square },
    { id: '4:3', label: 'Classic', icon: RectangleHorizontal },
    { id: '16:9', label: 'Cinematic', icon: Layout },
    { id: '3:4', label: 'Portrait', icon: RectangleVertical },
    { id: '9:16', label: 'Mobile', icon: Maximize },
  ];

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'images'),
      orderBy('createdAt', 'desc')
    );

    const path = `users/${user.uid}/images`;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const imgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedImage[];
      setImages(imgs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    try {
      const stylePrompt = stylePresets.find(s => s.id === selectedStyle)?.prompt;
      const fullPrompt = selectedStyle ? `${prompt}, ${stylePrompt}` : prompt;
        
      const imageUrl = await generateImage(fullPrompt, {
        model: profile?.settings?.preferredImageModel || "gemini-2.5-flash-image",
        apiKey: profile?.settings?.apiKey,
        aspectRatio: aspectRatio
      });

      if (imageUrl) {
        const imageSize = imageUrl.length;
        const newImage: SavedImage = {
          id: `temp-${Date.now()}`,
          url: imageUrl,
          prompt: prompt,
          style: selectedStyle,
          aspectRatio: aspectRatio,
          createdAt: { seconds: Date.now() / 1000 }
        };

        if (imageSize < FIRESTORE_LIMIT) {
          const imagesPath = `users/${user.uid}/images`;
          const userPath = `users/${user.uid}`;
          try {
            // Save to Firestore
            await addDoc(collection(db, 'users', user.uid, 'images'), {
              userId: user.uid,
              url: imageUrl,
              prompt: prompt,
              style: selectedStyle,
              aspectRatio: aspectRatio,
              createdAt: serverTimestamp()
            });

            // Update profile stats
            await updateDoc(doc(db, 'users', user.uid), {
              "usage.imageCount": increment(1)
            });
          } catch (dbErr) {
            handleFirestoreError(dbErr, OperationType.WRITE, imagesPath);
          }
        } else {
          setTempImages(prev => [newImage, ...prev]);
          setError("This high-fidelity creation exceeds the cloud storage limit (1MB). It is available below for download but won't be saved permanently.");
        }

        setPrompt('');
      } else {
        throw new Error("Generation returned no content");
      }
    } catch (err) {
      console.error("Image generation error:", err);
      setError("Failed to generate image. The prompt might be restricted or there's a connection issue.");
      setTimeout(() => setError(null), 6000);
    } finally {
      setIsGenerating(false);
    }
  };

  const appendKeyword = (keyword: string) => {
    setPrompt(prev => {
      const cleanPrev = prev.trim();
      if (!cleanPrev) return keyword;
      if (cleanPrev.endsWith(',')) return `${cleanPrev} ${keyword}`;
      return `${cleanPrev}, ${keyword}`;
    });
  };

  const deleteImage = async (id: string) => {
    if (!user || !window.confirm('Delete this masterpiece?')) return;
    const path = `users/${user.uid}/images/${id}`;
    try {
      if (id.startsWith('temp-')) {
        setTempImages(prev => prev.filter(img => img.id !== id));
      } else {
        await deleteDoc(doc(db, 'users', user.uid, 'images', id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const allImages = [...tempImages, ...images].sort((a, b) => {
    const timeA = a.createdAt?.seconds || 0;
    const timeB = b.createdAt?.seconds || 0;
    return timeB - timeA;
  });

  return (
    <div className="p-6 lg:p-12 space-y-12 bg-[#020617] min-h-full relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand/5 blur-[120px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-brand-light/5 blur-[100px] rounded-full pointer-events-none translate-x-1/2 translate-y-1/2"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10 border-b border-white/5 pb-10">
        <div className="space-y-3">
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-white flex items-center gap-4 uppercase italic">
            <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center text-white shadow-neon-purple shadow-[0_0_20px_brand] rotate-3 group">
              <Sparkles size={32} className="group-hover:scale-110 transition-transform" />
            </div>
            GENETIC STUDIO
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] italic">Cognoryx Interface: <span className="text-brand">Visual Synthesis Engine</span></p>
        </div>
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 relative z-10">
        <div className="lg:col-span-3 space-y-8">
           <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-red-500/10 border border-red-500/20 p-6 rounded-[2rem] text-red-400 flex items-center gap-4 shadow-xl backdrop-blur-md"
              >
                <Zap size={24} className="fill-current text-red-500 shadow-[0_0_10px_red]" />
                <p className="text-sm font-black uppercase tracking-tight italic">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleGenerate} className="relative group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Inject visual prompt coordinates..."
              rows={4}
              className="w-full bg-[#0f172a]/80 backdrop-blur-3xl border-2 border-white/5 rounded-[3rem] py-10 px-12 pr-44 text-white focus:border-brand focus:ring-brand/5 outline-none transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)] resize-none font-bold italic text-lg lg:text-xl placeholder:text-slate-800"
            />
            <div className="absolute right-48 bottom-10 flex items-center gap-2">
               <div className={cn(
                 "text-[10px] font-black tracking-[0.2em] px-3 py-1.5 rounded-full border border-white/5 bg-white/5",
                 prompt.length >= MAX_CHARS ? "text-red-500 border-red-500/20 bg-red-500/5" : "text-slate-600"
               )}>
                {prompt.length}/{MAX_CHARS}
               </div>
            </div>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(168,85,247,0.5)' }}
              whileTap={{ scale: 0.95 }}
              disabled={!prompt.trim() || isGenerating}
              className="absolute right-6 top-6 bottom-6 bg-brand text-white px-10 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 transition-all shadow-neon-purple disabled:opacity-20 disabled:pointer-events-none border border-white/10"
            >
              {isGenerating ? (
                <Loader2 size={32} className="animate-spin text-white shadow-neon-purple" />
              ) : (
                <Sparkles size={32} className="text-white shadow-neon-purple" />
              )}
              <span className="font-black text-[11px] uppercase tracking-[0.3em] italic">Synthesize</span>
            </motion.button>
          </form>

          <div className="flex flex-wrap items-center gap-4 px-6 border-l-2 border-white/5 ml-4">
             <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] italic">Neural Modifiers:</span>
             <div className="flex flex-wrap gap-2">
               {magicKeywords.map((kw) => (
                 <motion.button
                  key={kw.label}
                  type="button"
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.3)' }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => appendKeyword(kw.value)}
                  className="px-4 py-2 bg-white/[0.02] border border-white/5 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest transition-all hover:text-brand"
                 >
                   + {kw.label}
                 </motion.button>
               ))}
             </div>
          </div>

          <div className="flex flex-wrap items-center gap-8 text-[10px] text-slate-600 font-black uppercase tracking-[0.4em] px-6 italic">
            <span className="flex items-center gap-3"><Zap size={16} className="text-brand shadow-neon-purple shadow-[0_0_10px_brand]" /> GPU ACCELERATED</span>
            <span className="flex items-center gap-3"><ImageIcon size={16} className="text-brand/60" /> ULTRA FIDELITY</span>
            <span className="flex items-center gap-3"><Plus size={16} className="text-brand/60" /> UNLIMITED RADIUS</span>
          </div>
        </div>

        <div className="space-y-8">
          {/* Aspect Ratio */}
          <div className="bg-[#0f172a]/50 p-8 rounded-[3rem] border border-white/5 shadow-2xl backdrop-blur-md space-y-6 shadow-inner">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3 italic">
              <Maximize size={16} className="text-brand" /> SCALE MATRIX
            </h3>
            <div className="grid grid-cols-5 gap-3">
              {aspectRatios.map((ratio) => (
                <motion.button
                  key={ratio.id}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setAspectRatio(ratio.id)}
                  title={ratio.label}
                  className={cn(
                    "aspect-square rounded-2xl border-2 flex items-center justify-center transition-all shadow-inner",
                    aspectRatio === ratio.id 
                      ? "bg-brand/10 border-brand text-brand shadow-neon-purple" 
                      : "bg-black/20 border-white/5 text-slate-700 hover:text-slate-500 hover:border-white/10"
                  )}
                >
                  <ratio.icon size={22} />
                </motion.button>
              ))}
            </div>
          </div>

          <div className="bg-[#0f172a]/50 p-8 rounded-[3rem] border border-white/5 shadow-2xl backdrop-blur-md space-y-6 shadow-inner">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3 italic">
              <Layout size={16} className="text-brand" /> STYLE VECTORS
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {stylePresets.map((style) => (
                <motion.button
                  key={style.id}
                  whileHover={{ scale: 1.05, x: 2, backgroundColor: 'rgba(168, 85, 247, 0.05)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-[9px] font-black transition-all border uppercase tracking-[0.2em] italic flex items-center gap-2",
                    selectedStyle === style.id
                      ? "bg-brand text-white border-brand shadow-neon-purple"
                      : "bg-black/20 border-white/5 text-slate-600 hover:text-slate-400 hover:border-white/10"
                  )}
                >
                  <style.icon size={14} className={cn(selectedStyle === style.id ? "text-white" : "text-slate-700")} />
                  {style.label}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Section */}
      <section className="space-y-12 relative z-10">
        <div className="flex items-center justify-between border-b border-white/5 pb-8">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">Creative Vault</h2>
          <div className="flex items-center gap-6">
             <div className="h-px w-32 bg-gradient-to-r from-transparent via-white/10 to-transparent hidden md:block" />
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] italic">{images.length} Objects Materialized</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-square bg-white/[0.02] border border-white/5 rounded-[3rem] animate-pulse shadow-inner" />
            ))}
          </div>
        ) : allImages.length === 0 && !isGenerating ? (
          <div className="py-32 flex flex-col items-center justify-center text-center space-y-8 border-4 border-dashed border-white/5 rounded-[4rem] bg-white/[0.01]">
            <div className="w-24 h-24 bg-white/[0.03] rounded-[2.5rem] flex items-center justify-center text-slate-800 relative group">
              <div className="absolute inset-0 bg-brand/5 blur-2xl group-hover:bg-brand/10 transition-all"></div>
              <ImageIcon size={48} className="relative z-10 text-slate-700" />
            </div>
            <div className="max-w-xs space-y-3">
              <p className="text-xl font-black text-white uppercase tracking-widest italic">Vault Empty</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em] italic leading-relaxed">Describe your vision above to materialize the first creation in your artistic archive.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
              {isGenerating && (
                <motion.div
                  key="generating"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "bg-[#0f172a]/80 backdrop-blur-3xl rounded-[3rem] border-2 border-brand/30 flex flex-col items-center justify-center text-center p-10 overflow-hidden relative shadow-neon-purple shadow-[0_0_30px_rgba(168,85,247,0.1)]",
                    aspectRatio === '16:9' ? "aspect-video" : aspectRatio === '9:16' ? "aspect-[9/16]" : "aspect-square"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-transparent opacity-50 flex items-center justify-center">
                    <motion.div 
                      animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                      transition={{ rotate: { repeat: Infinity, duration: 4, ease: "linear" }, scale: { repeat: Infinity, duration: 2 } }}
                      className="w-48 h-48 border-4 border-brand/10 rounded-full border-t-brand/30 shadow-neon-purple"
                    />
                  </div>
                  <Loader2 size={40} className="text-brand animate-spin mb-6 relative z-10 shadow-neon-purple" />
                  <div className="relative z-10 px-4 space-y-3">
                    <p className="font-black text-[11px] text-white uppercase tracking-[0.4em] italic shadow-neon-purple">Materializing...</p>
                    <p className="text-[10px] text-slate-500 line-clamp-2 font-bold italic tracking-tight">"{prompt}"</p>
                  </div>
                </motion.div>
              )}
              
              {allImages.map((img) => (
                <motion.div
                  key={img.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  whileHover={{ y: -8 }}
                  className={cn(
                    "group bg-[#0f172a] rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl relative transition-all hover:border-brand/30 hover:shadow-neon-purple hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]",
                    img.aspectRatio === '16:9' ? "aspect-video" : img.aspectRatio === '9:16' ? "aspect-[9/16]" : "aspect-square"
                  )}
                >
                  <img src={img.url} alt={img.prompt} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" referrerPolicy="no-referrer" />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-8 translate-y-6 group-hover:translate-y-0">
                    <p className="text-white text-[12px] font-black italic line-clamp-3 mb-6 leading-relaxed bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/5">&quot;{img.prompt}&quot;</p>
                    
                    <div className="flex items-center gap-3">
                       <motion.a 
                        href={img.url} 
                        whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(168,85,247,0.4)' }}
                        whileTap={{ scale: 0.95 }}
                        download={`creation-${img.id}.png`}
                        className="flex-1 bg-brand text-white rounded-2xl py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 border border-white/10 italic"
                      >
                        <Download size={14} /> EXPORT
                      </motion.a>
                      <motion.button 
                        whileHover={{ scale: 1.1, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => deleteImage(img.id)}
                        className="bg-white/5 backdrop-blur-md text-red-500 p-3 rounded-2xl border border-white/10 transition-all"
                      >
                        <Trash2 size={16} />
                      </motion.button>
                    </div>
                  </div>

                  <div className="absolute top-6 left-6 flex gap-2">
                    <span className="bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-white/10 shadow-xl">{img.aspectRatio}</span>
                    {img.style && <span className="bg-brand text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-neon-purple border border-white/10 italic">{img.style}</span>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}

