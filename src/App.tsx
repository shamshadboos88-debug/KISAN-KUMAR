import React from 'react';
import { useAuth } from './lib/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Chat } from './components/Chat';
import { ImageStudio } from './components/ImageStudio';
import { QuizLab } from './components/QuizLab';
import { NotesHub } from './components/NotesHub';
import { PDFAnalyzer } from './components/PDFAnalyzer';
import { Settings } from './components/Settings';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { motion } from 'motion/react';

function LoginPage() {
  const { login } = useAuth();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden bg-grid-white">
      {/* Background Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="max-w-md w-full text-center space-y-8 glass-morphism p-10 rounded-[2.5rem] shadow-2xl relative z-10">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mx-auto w-20 h-20 bg-gradient-to-tr from-brand to-brand-light rounded-[2rem] flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.4)]"
        >
          <Zap size={40} className="text-white fill-current" />
        </motion.div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-white tracking-tight">COGNORYX</h1>
          <p className="text-slate-400 font-medium tracking-wide">Next-Gen Intelligence Engine</p>
        </div>

        <div className="space-y-4 pt-4">
          <motion.button
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
            whileTap={{ scale: 0.98 }}
            onClick={login}
            className="w-full h-14 flex items-center justify-center gap-3 px-6 py-2 border border-white/10 shadow-xl text-sm font-bold rounded-2xl text-white bg-white/5 transition-all focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/pickers/google.svg" className="w-5 h-5" alt="" />
            Continue with Google
          </motion.button>
        </div>

        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-loose">
          Authorized Neural Access Protocol Required
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-brand/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(168,85,247,0.5)]"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-200">
      <Sidebar />
      <main className="flex-1 transition-all duration-300 relative overflow-hidden bg-grid-white">
        {/* Ambient Glow */}
        <div className="absolute top-[-20%] left-[30%] w-[60%] h-[60%] bg-brand/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="h-full max-w-7xl mx-auto px-4 py-4 md:px-8 md:py-8 lg:px-12 relative z-10">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:id" element={<Chat />} />
            <Route path="/notes" element={<NotesHub />} />
            <Route path="/pdf" element={<PDFAnalyzer />} />
            <Route path="/quiz" element={<QuizLab />} />
            <Route path="/images" element={<ImageStudio />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
