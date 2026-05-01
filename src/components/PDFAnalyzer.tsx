import React, { useState } from 'react';
import { 
  FileSearch, 
  Upload, 
  Sparkles, 
  Loader2, 
  FileText, 
  CheckCircle2,
  BrainCircuit,
  MessageSquare,
  ArrowRight,
  X,
  AlertCircle
} from 'lucide-react';
import { chatWithAI } from '../lib/gemini';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export function PDFAnalyzer() {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [qaInput, setQaInput] = useState('');
  const [qaResponse, setQaResponse] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim() || !content.trim() || isAsking) return;

    setIsAsking(true);
    setError(null);
    try {
      const prompt = `Based on the following document content, please answer the question: "${qaInput}"
      
      Document Content:
      ${content.substring(0, 15000)} // Limiting to prevent context overflow while being helpful
      
      If the answer is not contained in the document, please say so.`;

      const response = await chatWithAI([{ role: 'user', content: prompt }], {
        model: profile?.settings?.preferredModel,
        persona: profile?.settings?.persona,
        customPersonaInstruction: profile?.settings?.customPersonaInstruction,
        tone: profile?.settings?.fineTuning?.tone,
        temperature: profile?.settings?.fineTuning?.temperature,
        systemInstruction: "You are a helpful document assistant. Answer questions clearly based only on the provided context.",
        apiKey: profile?.settings?.apiKey
      });

      if (response) {
        setQaResponse(response);
      } else {
        throw new Error("No response");
      }
    } catch (err) {
      console.error("Q&A error:", err);
      setError("Failed to get an answer. Please try a different question.");
    } finally {
      setIsAsking(false);
    }
  };

  const analyzeContent = async (textToAnalyze?: string) => {
    const targetContent = textToAnalyze || content;
    if (!targetContent.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const prompt = `Analyze the following document text. Provide:
      1. A concise EXECUTIVE SUMMARY (limit to 2 paragraphs)
      2. 5 key takeaways as a bulleted list
      3. 3 potential action items
      Format the response as a JSON object with keys: "summary", "takeaways", "actionItems" (all as markdown strings).`;
      
      const response = await chatWithAI([{ role: 'user', content: prompt + '\n\nDocument Content:\n' + targetContent }], {
        model: profile?.settings?.preferredModel,
        persona: profile?.settings?.persona,
        customPersonaInstruction: profile?.settings?.customPersonaInstruction,
        tone: profile?.settings?.fineTuning?.tone,
        temperature: profile?.settings?.fineTuning?.temperature,
        systemInstruction: "You are a senior document analyst. Return ONLY a valid JSON object.",
        apiKey: profile?.settings?.apiKey
      });
      
      if (response) {
        try {
          const cleanJson = response.replace(/```json\n?|\n?```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          setAnalysis(parsed);
        } catch (e) {
          // Fallback if AI doesn't return clean JSON
          setAnalysis({ summary: response, takeaways: '', actionItems: '' });
        }
      } else {
        throw new Error("Analysis failed");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Document analysis failed. The content might be too long or complex for processing.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      return;
    }

    setIsExtracting(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }
      
      if (!fullText.trim()) {
        throw new Error("No text found in PDF");
      }
      
      setContent(fullText);
      // Automatically trigger analysis
      analyzeContent(fullText);
    } catch (err: any) {
      console.error('Error extracting PDF text:', err);
      setError(err.message === "No text found in PDF" 
        ? "No readable text found in this PDF. It might be a scanned image." 
        : "Failed to extract text from PDF. Please try again or paste text manually.");
    } finally {
      setIsExtracting(false);
    }
  };

  const triggerUpload = () => {
    document.getElementById('pdf-upload')?.click();
  };

  return (
    <div className="p-6 lg:p-12 max-w-6xl mx-auto space-y-12 bg-[#020617] min-h-full relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-8 border-b border-white/5 relative z-10">
        <div>
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase italic">PDF Analyzer</h1>
          <p className="text-slate-500 mt-2 font-bold uppercase tracking-[0.3em] text-xs italic">Neural Ingestion Engine: <span className="text-brand">Optimized</span></p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-brand/10 border border-brand/20 text-brand px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-neon-purple shadow-[0_0_10px_rgba(168,85,247,0.1)]">
            <CheckCircle2 size={14} /> SECURE SIGNAL: ENCRYPTED
          </div>
        </div>
      </div>

      {!analysis && !isAnalyzing ? (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0f172a]/50 p-10 md:p-16 rounded-[4rem] border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl space-y-12 relative z-10 shadow-inner"
        >
          <div className="border-2 border-dashed border-white/10 rounded-[3rem] p-16 text-center space-y-8 bg-white/[0.02] group hover:bg-white/[0.05] hover:border-brand/40 transition-all duration-700 shadow-inner">
            <div className="w-24 h-24 bg-[#0f172a] border border-white/10 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl group-hover:scale-110 group-hover:shadow-brand/20 transition-all relative">
              {isExtracting ? (
                <Loader2 size={40} className="text-brand animate-spin" />
              ) : (
                <Upload size={40} className="text-brand shadow-neon-purple shadow-[0_0_15px_brand]" />
              )}
              <div className="absolute -inset-2 bg-brand opacity-0 group-hover:opacity-10 blur-xl rounded-full transition-opacity"></div>
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight italic">
                {isExtracting ? "DECRYPTING NEURAL DATA..." : "INITIALIZE DOCUMENT STREAM"}
              </h3>
              <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] max-w-sm mx-auto">DEPLOY PDF FOR MULTI-LAYERED INTELLIGENCE. MAX BANDWIDTH: 20MB.</p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              id="pdf-upload" 
              accept="application/pdf"
              onChange={handleFileChange}
            />
            <motion.button 
              whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(168,85,247,0.5)' }}
              whileTap={{ scale: 0.95 }}
              onClick={triggerUpload}
              disabled={isExtracting}
              className="bg-brand text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] transition-all disabled:opacity-20 shadow-neon-purple border border-white/10"
            >
              LOCATE DATA FILE
            </motion.button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0f172a] px-8 text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] backdrop-blur-xl">OR MANUALLY INJECT</span>
            </div>
          </div>

          <div className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-500/10 p-5 border border-red-500/20 rounded-2xl text-red-500 flex items-center gap-4 font-black text-[11px] uppercase tracking-tight shadow-2xl"
              >
                <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/20">
                  <AlertCircle size={18} />
                </div>
                {error}
              </motion.div>
            )}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="PASTE RAW DOCUMENT BUFFER FOR INSTANT DECRYPTION..."
              className="w-full bg-white/[0.03] border-2 border-white/5 rounded-[2.5rem] p-8 text-white text-base md:text-lg focus:border-brand/40 focus:bg-[#0f172a] shadow-inner outline-none transition-all h-72 resize-none font-bold italic placeholder:text-slate-700"
            />
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(6, 182, 212, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => analyzeContent()}
              disabled={!content.trim() || isAnalyzing}
              className="w-full bg-cyan-600 text-white py-6 rounded-[2rem] font-black text-xl uppercase tracking-[0.2em] transition-all disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center gap-4 shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-white/10"
            >
              DECODE WITH COGNORYX IQ
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative z-10">
          {/* Analysis View */}
          <div className="lg:col-span-2 space-y-12">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#0f172a]/50 p-10 md:p-16 rounded-[4rem] border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl space-y-12 shadow-inner"
            >
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-8">
                  <div className="relative w-28 h-28">
                    <div className="absolute inset-0 border-4 border-brand/10 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-brand rounded-full border-t-transparent animate-spin shadow-neon-purple"></div>
                    <Sparkles className="absolute inset-0 m-auto text-brand animate-pulse" size={40} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight italic">Decoding Neural Threads...</h3>
                    <p className="text-slate-500 mt-3 text-xs font-black uppercase tracking-[0.3em] animate-pulse">Our networks are processing document vectors.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-12">
                  {/* Summary Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-3 text-brand font-black uppercase tracking-[0.4em] text-[10px]">
                      <Sparkles size={16} /> EXECUTIVE DATA SUMMARY
                    </div>
                    <div className="prose prose-invert prose-slate max-w-none prose-lg md:prose-xl leading-relaxed italic font-bold text-slate-200">
                      <ReactMarkdown>{analysis?.summary || ''}</ReactMarkdown>
                    </div>
                  </section>

                  {analysis?.takeaways && (
                    <section className="bg-white/[0.02] p-10 rounded-[3rem] border border-white/5 space-y-6 shadow-inner">
                      <div className="flex items-center gap-3 text-white font-black uppercase tracking-[0.3em] text-[11px]">
                        <ArrowRight size={18} className="text-brand shadow-neon-purple shadow-[0_0_10px_brand]" /> KEY EXTRACTIONS
                      </div>
                      <div className="prose prose-invert prose-slate max-w-none prose-sm font-bold text-slate-400">
                        <ReactMarkdown>{analysis.takeaways}</ReactMarkdown>
                      </div>
                    </section>
                  )}

                  {analysis?.actionItems && (
                    <section className="space-y-6">
                      <div className="flex items-center gap-3 text-white font-black uppercase tracking-[0.3em] text-[11px]">
                        <CheckCircle2 size={18} className="text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]" /> PROTOCOL ACTIONS
                      </div>
                      <div className="prose prose-invert prose-slate max-w-none prose-sm bg-cyan-500/5 p-8 rounded-[2.5rem] border border-cyan-500/10 text-slate-300 font-bold italic">
                        <ReactMarkdown>{analysis.actionItems}</ReactMarkdown>
                      </div>
                    </section>
                  )}
                </div>
              )}
            </motion.div>
            
            {!isAnalyzing && (
              <div className="space-y-10">
                {/* Q&A Section */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#0f172a]/80 border border-white/5 p-10 rounded-[3rem] space-y-8 backdrop-blur-3xl shadow-2xl shadow-inner"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center text-white shadow-neon-purple shadow-[0_0_20px_brand] border border-white/10">
                      <MessageSquare size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight italic">QUERY BUFFER</h3>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Get instant answers from document context</p>
                    </div>
                  </div>

                  <form onSubmit={handleAskQuestion} className="relative group">
                    <input 
                      type="text"
                      value={qaInput}
                      onChange={(e) => setQaInput(e.target.value)}
                      placeholder="DEPLOY QUERY..."
                      className="w-full bg-white/[0.03] border-2 border-white/5 rounded-[1.5rem] py-5 px-8 pr-16 text-white text-base font-bold italic placeholder:text-slate-700 focus:ring-2 focus:ring-brand focus:border-brand/40 outline-none transition-all shadow-inner"
                    />
                    <motion.button 
                      type="submit"
                      whileHover={{ scale: 1.1, backgroundColor: '#a855f7', boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)' }}
                      whileTap={{ scale: 0.9 }}
                      disabled={isAsking || !qaInput.trim()}
                      className="absolute right-2 top-2 bottom-2 aspect-square bg-[#1e293b] text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-20 border border-white/10"
                    >
                      {isAsking ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={20} />}
                    </motion.button>
                  </form>

                  <AnimatePresence>
                    {qaResponse && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/[0.02] border border-white/5 p-8 rounded-[2rem] shadow-inner prose prose-invert prose-sm max-w-none"
                      >
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                          <CheckCircle2 size={16} className="text-brand shadow-neon-purple shadow-[0_0_10px_brand]" />
                          <span className="text-[10px] font-black text-brand uppercase tracking-[0.3em]">NEURAL RESPONSE SYNTHESIZED</span>
                        </div>
                        <div className="text-slate-300 font-bold italic leading-relaxed">
                          <ReactMarkdown>{qaResponse}</ReactMarkdown>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <div className="flex justify-center pt-8">
                  <motion.button 
                    whileHover={{ scale: 1.05, color: '#a855f7' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setAnalysis(null); setContent(''); setQaResponse(null); setQaInput(''); }}
                    className="flex items-center gap-3 text-slate-600 font-black uppercase tracking-[0.4em] text-[10px] transition-colors"
                  >
                    <ArrowRight className="rotate-180" size={18} /> INITIALIZE NEW STREAM
                  </motion.button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Tools */}
          <div className="space-y-8 relative z-10">
            <div className="bg-brand/10 border border-brand/20 p-10 rounded-[3rem] space-y-8 shadow-2xl backdrop-blur-3xl shadow-inner">
              <h3 className="text-xl font-black text-white uppercase italic flex items-center gap-4 tracking-tighter">
                <Sparkles className="text-brand shadow-neon-purple shadow-[0_0_15px_brand]" size={28} /> CORE OUTPUTS
              </h3>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-tight leading-relaxed italic">Cognoryx can generate contextual logic based on analysis.</p>
              <div className="space-y-4">
                {[
                  { icon: BrainCircuit, label: 'Initialize QuizLab', sub: 'Generate Assessment' },
                  { icon: MessageSquare, label: 'Cognitive Chat', sub: 'Contextual Session' },
                  { icon: FileText, label: 'Compile Brief', sub: 'Structured Protocol' },
                ].map(tool => (
                  <motion.button 
                    key={tool.label} 
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(168, 85, 247, 0.4)' }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full text-left p-5 bg-white/[0.03] border border-white/5 rounded-2xl transition-all group shadow-inner"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-brand transition-all group-hover:shadow-neon-purple group-hover:shadow-[0_0_10px_brand]">
                        <tool.icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs text-white uppercase tracking-tight">{tool.label}</p>
                        <p className="text-[10px] font-black text-slate-500 truncate uppercase mt-1 tracking-widest">{tool.sub}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="bg-[#0f172a]/50 p-10 rounded-[3rem] border border-white/5 shadow-2xl space-y-8 backdrop-blur-xl shadow-inner">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] border-b border-white/5 pb-4">CORE METRICS</h4>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Processing Time</span>
                  <span className="font-black text-white text-sm tracking-tighter">~4 MS</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Complexity Delta</span>
                  <span className="font-black text-cyan-500 text-sm tracking-tighter">BETA-LEVEL</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Sentiment Weight</span>
                  <span className="font-black text-blue-500 text-sm tracking-tighter">ANALYTICAL</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
