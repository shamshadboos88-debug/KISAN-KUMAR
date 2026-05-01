import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  BrainCircuit, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  RefreshCcw,
  Trophy,
  History
} from 'lucide-react';
import { chatWithAI } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Type } from '@google/genai';
import { cn } from '../lib/utils';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export function QuizLab() {
  const { user, profile } = useAuth();
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);

  const generateQuiz = async () => {
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setQuestions([]);
    setCurrentStep(0);
    setScore(0);
    setShowResults(false);
    setShowReview(false);
    setUserAnswers([]);
    
    try {
      const prompt = `Generate a 5-question multiple choice quiz about: ${topic}. 
      Format the response as a JSON array of objects with fields: 
      id (int), 
      question (string), 
      options (array of 4 strings), 
      correctAnswer (int index 0-3),
      explanation (string explaining why the correct answer is right and others are wrong).`;
      
      const response = await chatWithAI([{ role: 'user', content: prompt }], {
        model: profile?.settings?.preferredModel,
        persona: profile?.settings?.persona,
        customPersonaInstruction: profile?.settings?.customPersonaInstruction,
        tone: profile?.settings?.fineTuning?.tone,
        temperature: profile?.settings?.fineTuning?.temperature,
        systemInstruction: "You are a quiz master. Only return the raw JSON array. Ensure explanations are educational and concise.",
        apiKey: profile?.settings?.apiKey
      });
      
      if (response) {
        // Clean markdown code blocks if any
        const cleanJson = response.replace(/```json|```/g, '').trim();
        const quizData = JSON.parse(cleanJson);
        setQuestions(quizData);
      } else {
        throw new Error("Empty response");
      }
    } catch (err) {
      console.error("Quiz generation error:", err);
      setError("Failed to create quiz. The topic might be too vague or there was a system error. Please try another topic.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    
    setSelectedAnswer(index);
    setUserAnswers(prev => [...prev, index]);
    
    if (index === questions[currentStep].correctAnswer) {
      setScore(prev => prev + 1);
    }

    setTimeout(() => {
      if (currentStep < questions.length - 1) {
        setCurrentStep(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        setShowResults(true);
      }
    }, 1500);
  };

  return (
    <div className="p-6 lg:p-12 max-w-5xl mx-auto space-y-12 bg-[#020617] min-h-full relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-brand/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-brand-light/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="text-center space-y-6 relative z-10">
        <div className="w-20 h-20 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mx-auto shadow-neon-purple shadow-[0_0_20px_rgba(168,85,247,0.2)] border border-brand/20">
          <BrainCircuit size={40} className="animate-pulse" />
        </div>
        <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase italic">Quiz Lab</h1>
        <p className="text-slate-500 max-w-lg mx-auto font-bold uppercase tracking-[0.2em] text-xs">Neural Assessment System: <span className="text-brand">Active</span></p>
      </div>

      {questions.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0f172a]/50 p-10 md:p-16 rounded-[4rem] border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl space-y-10 relative z-10 shadow-inner"
        >
          <div className="space-y-6">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] px-2">Initialize Subject Data</label>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-500/10 text-red-400 p-6 rounded-2xl text-xs font-black uppercase tracking-tight border border-red-500/20 mb-4"
              >
                {error}
              </motion.div>
            )}
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="E.g. The history of Quantum Mechanics, or paste your study notes here..."
              className="w-full bg-white/[0.03] border-2 border-white/5 rounded-[2.5rem] p-8 text-white text-base md:text-lg focus:border-brand/40 focus:bg-[#0f172a] shadow-inner outline-none transition-all h-52 resize-none font-bold placeholder:text-slate-600 italic"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(168,85,247,0.5)' }}
            whileTap={{ scale: 0.98 }}
            onClick={generateQuiz}
            disabled={!topic.trim() || isGenerating}
            className="w-full bg-brand text-white py-6 rounded-[2rem] font-black text-xl uppercase tracking-[0.2em] transition-all disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center gap-4 shadow-neon-purple shadow-[0_0_20px_brand] border border-white/10"
          >
            {isGenerating ? (
              <>
                <Loader2 size={28} className="animate-spin" />
                <span>Generating Nodes...</span>
              </>
            ) : (
              <>
                <Sparkles size={28} />
                <span>Create Lab Challenge</span>
              </>
            )}
          </motion.button>
          <div className="flex items-center justify-center gap-10 pt-6">
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black text-white tracking-tighter">05</span>
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">Vectors</span>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black text-white tracking-tighter">AI</span>
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">Graded</span>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black text-white tracking-tighter">1M</span>
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">Window</span>
            </div>
          </div>
        </motion.div>
      ) : showResults ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#0f172a]/50 p-10 md:p-16 rounded-[4rem] border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl space-y-10 relative z-10 shadow-inner"
        >
          {!showReview ? (
            <div className="text-center space-y-12">
              <div className="w-40 h-40 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-10 relative shadow-neon-purple shadow-[0_0_40px_rgba(168,85,247,0.2)] border border-brand/20">
                <Trophy size={80} />
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="absolute -top-4 -right-4 bg-brand text-white w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl border-4 border-[#0f172a] shadow-neon-purple"
                >
                  {Math.round((score / questions.length) * 100)}%
                </motion.div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase italic">Challenge Complete!</h2>
                <p className="text-slate-400 font-black text-xl uppercase tracking-widest italic">You scored {score} of {questions.length} correct</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <motion.button 
                  whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(168,85,247,0.4)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setQuestions([])}
                  className="py-5 bg-brand text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-neon-purple"
                >
                  <RefreshCcw size={20} /> Re-try Challenge
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowReview(true)}
                  className="py-5 bg-white/5 text-slate-300 border border-white/10 rounded-[1.5rem] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                >
                  <History size={20} /> Review Answers
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              <div className="flex items-center justify-between border-b border-white/10 pb-8">
                <div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tight">Review Logs</h2>
                  <p className="text-[10px] text-brand font-black uppercase tracking-[0.3em] mt-2">Buffer: {topic.slice(0, 40)}...</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowReview(false)}
                  className="p-4 text-slate-500 hover:text-white rounded-2xl transition-all border border-white/5"
                >
                  <RefreshCcw size={24} className="rotate-180" />
                </motion.button>
              </div>

              <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                {questions.map((q, idx) => {
                  const userAnswer = userAnswers[idx];
                  const isCorrect = userAnswer === q.correctAnswer;

                  return (
                    <motion.div 
                      key={q.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-8 rounded-[3rem] border border-white/10 bg-white/[0.02] space-y-6 shadow-inner"
                    >
                      <div className="flex items-start gap-6">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm border shadow-inner",
                          isCorrect ? "bg-green-500/20 text-green-500 border-green-500/20" : "bg-red-500/20 text-red-500 border-red-500/20"
                        )}>
                          {idx + 1}
                        </div>
                        <div className="space-y-6 flex-1">
                          <h4 className="text-xl font-black text-white leading-tight uppercase tracking-tight">{q.question}</h4>
                          
                          <div className="grid grid-cols-1 gap-3">
                            {q.options.map((opt, optIdx) => {
                              const isCorrectOption = optIdx === q.correctAnswer;
                              const isUserOption = optIdx === userAnswer;
                              
                              return (
                                <div key={optIdx} className={cn(
                                  "px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-tight border flex items-center justify-between transition-all",
                                  isCorrectOption 
                                    ? "bg-green-500/20 border-green-500/40 text-green-400" 
                                    : isUserOption 
                                      ? "bg-red-500/20 border-red-500/40 text-red-400" 
                                      : "bg-white/[0.03] border-white/5 text-slate-500"
                                )}>
                                  {opt}
                                  {isCorrectOption && <CheckCircle2 size={16} />}
                                  {isUserOption && !isCorrectOption && <XCircle size={16} />}
                                </div>
                              );
                            })}
                          </div>

                          <div className="bg-brand/10 border border-brand/20 p-6 rounded-[1.5rem] shadow-inner">
                            <p className="text-[10px] font-black text-brand uppercase tracking-[0.4em] mb-2">Cognoryx Intelligence Explanation</p>
                            <p className="text-sm text-slate-300 leading-relaxed font-bold italic tracking-tight">{q.explanation}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <motion.button 
                whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(168,85,247,0.4)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setQuestions([])}
                className="w-full py-5 bg-brand text-white rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all shadow-neon-purple border border-white/10"
              >
                Start New Challenge
              </motion.button>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="space-y-10 relative z-10">
          <div className="flex items-center justify-between px-8">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] leading-none italic">Target: {topic.slice(0, 30)}...</p>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Node {currentStep + 1} of {questions.length}</h2>
            </div>
            <div className="flex gap-2.5">
              {questions.map((_, i) => (
                <div key={i} className={cn(
                  "h-2.5 rounded-full transition-all duration-500",
                  i === currentStep ? "w-10 bg-brand shadow-neon-purple shadow-[0_0_10px_brand]" : i < currentStep ? "w-4 bg-brand/40" : "w-4 bg-white/5"
                )} />
              ))}
            </div>
          </div>

          <motion.div 
            key={currentStep}
            initial={{ opacity: 0, x: 50, rotate: 1 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -50, rotate: -1 }}
            className="bg-[#0f172a]/50 p-12 md:p-20 rounded-[4rem] border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl space-y-12 shadow-inner relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <BrainCircuit size={150} />
            </div>
            <h3 className="text-2xl md:text-4xl font-black text-white leading-tight uppercase tracking-tighter italic relative z-10">
              {questions[currentStep].question}
            </h3>

            <div className="grid grid-cols-1 gap-6 relative z-10">
              {questions[currentStep].options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === questions[currentStep].correctAnswer;
                
                return (
                  <motion.button
                    key={index}
                    whileHover={selectedAnswer === null ? { scale: 1.02, x: 10, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(168, 85, 247, 0.4)' } : {}}
                    whileTap={selectedAnswer === null ? { scale: 0.98 } : {}}
                    onClick={() => handleAnswer(index)}
                    disabled={selectedAnswer !== null}
                    className={cn(
                      "group p-8 rounded-[2.5rem] text-left border-2 transition-all flex items-center justify-between font-black uppercase tracking-tight text-lg shadow-inner",
                      selectedAnswer === null 
                        ? "bg-white/5 border-white/5 text-slate-400" 
                        : isCorrect 
                          ? "bg-green-500/20 border-green-500/40 text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.1)]"
                          : isSelected 
                            ? "bg-red-500/20 border-red-500/40 text-red-400"
                            : "bg-white/[0.01] border-white/5 text-slate-700 opacity-20"
                    )}
                  >
                    <span className="flex-1">{option}</span>
                    <AnimatePresence>
                      {selectedAnswer !== null && isCorrect && (
                        <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} className="text-green-500 p-2 bg-green-500/10 rounded-xl">
                          <CheckCircle2 size={32} />
                        </motion.div>
                      )}
                      {selectedAnswer !== null && isSelected && !isCorrect && (
                        <motion.div initial={{ scale: 0, rotate: 45 }} animate={{ scale: 1, rotate: 0 }} className="text-red-500 p-2 bg-red-500/10 rounded-xl">
                          <XCircle size={32} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
