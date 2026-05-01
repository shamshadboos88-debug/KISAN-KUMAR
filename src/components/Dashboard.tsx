import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  Zap, 
  MessageSquare, 
  FileText, 
  FileSearch, 
  BrainCircuit, 
  Image as ImageIcon,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Plus,
  UserPlus,
  Check,
  X as XIcon,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { Invitation, acceptInvitation, declineInvitation } from '../lib/collaboration';

export function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    if (!user?.email) return;
    
    const q = query(
      collection(db, 'invitations'),
      where('email', '==', user.email),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
      setInvitations(invs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'invitations');
    });

    return unsubscribe;
  }, [user]);

  const handleAccept = async (inv: Invitation) => {
    if (!user || !inv.id) return;
    try {
      await acceptInvitation(inv.id, user);
    } catch (err) {
      console.error('Accept error:', err);
    }
  };

  const handleDecline = async (inv: Invitation) => {
    if (!inv.id) return;
    try {
      await declineInvitation(inv.id);
    } catch (err) {
      console.error('Decline error:', err);
    }
  };

  const stats = [
    { label: 'AI Conversations', value: profile?.usage.chatCount || 0, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Notes Created', value: 12, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100' }, // Mocking notes for now
    { label: 'Images Generated', value: profile?.usage.imageCount || 0, icon: ImageIcon, color: 'text-orange-600', bg: 'bg-orange-100' },
  ];

  const tools = [
    { title: 'Chat Assistant', desc: 'Smarter intelligence for complex tasks', icon: MessageSquare, path: '/chat', color: 'bg-blue-500' },
    { title: 'PDF Analyzer', desc: 'Upload, summarize and query documents', icon: FileSearch, path: '/pdf', color: 'bg-teal-500' },
    { title: 'Quiz Creator', desc: 'Convert notes into interactive quizzes', icon: BrainCircuit, path: '/quiz', color: 'bg-brand' },
    { title: 'Image Studio', desc: 'Transform text into visual art', icon: ImageIcon, path: '/images', color: 'bg-orange-500' },
  ];

  return (
    <div className="p-6 lg:p-12 space-y-12 bg-[#020617] min-h-full relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-light/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
        <div>
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase italic">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand-light">{profile?.displayName?.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-500 mt-2 font-bold uppercase tracking-[0.3em] text-xs">Neural Interface: <span className="text-brand">Online</span> • Quantum Core: <span className="text-green-500">Active</span></p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(168,85,247,0.4)' }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/chat')}
          className="px-8 py-4 bg-brand text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-neon-purple hover:bg-brand-dark transition-all flex items-center gap-2"
        >
          <Zap size={18} />
          Initialize Flux
        </motion.button>
      </div>

      {/* Invitations Section */}
      <AnimatePresence>
        {invitations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-brand/5 border border-brand/20 rounded-[3rem] p-8 lg:p-10 relative overflow-hidden shadow-2xl backdrop-blur-xl"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand to-transparent"></div>
            <div className="flex items-center gap-5 mb-8">
              <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center text-white shadow-neon-purple shadow-[0_0_15px_brand]">
                <Bell size={28} className="animate-bounce" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Collaboration Signals</h2>
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">External nodes requesting synchronization</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {invitations.map((inv) => (
                <div key={inv.id} className="bg-white/[0.03] p-6 rounded-3xl border border-white/10 flex flex-col justify-between hover:border-brand/40 transition-all group shadow-inner">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[10px] font-black bg-brand text-white px-3 py-1 rounded-full uppercase tracking-widest shadow-neon-purple">
                        {inv.itemType}
                      </span>
                      <span className="text-[10px] font-black bg-white/10 text-white/70 px-3 py-1 rounded-full uppercase tracking-widest">
                        {inv.role}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mb-6 truncate italic font-bold">Transmission from node: <span className="text-brand">{inv.ownerId.slice(0, 8)}...</span></p>
                  </div>
                  <div className="flex gap-3">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAccept(inv)}
                      className="flex-1 h-12 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                    >
                      <Check size={16} /> Sync
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDecline(inv)}
                      className="w-12 h-12 bg-white/5 border border-white/10 text-slate-400 rounded-2xl flex items-center justify-center transition-all group"
                    >
                      <XIcon size={20} className="group-hover:text-red-500 transition-colors" />
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#0f172a]/50 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-xl group hover:border-brand/30 transition-all shadow-inner"
          >
            <div className="flex items-center justify-between mb-6">
              <div className={cn("p-4 rounded-2xl group-hover:scale-110 transition-transform", stat.bg)}>
                <stat.icon className={stat.color} size={28} />
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] leading-none">Net Volume</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-black text-white tracking-tighter mb-1">{stat.value}</p>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">{stat.label}</p>
              </div>
              <TrendingUp size={16} className="text-brand opacity-50" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Tools and Current Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 relative z-10">
        <div className="lg:col-span-3 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Intelligence Sub-routines</h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-1">Select logic module for execution</p>
            </div>
            <Link to="/chat" className="text-brand font-black text-[10px] uppercase tracking-[0.2em] hover:text-brand-light flex items-center gap-2 transition-colors">
              Access All Nodes <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {tools.map((tool, i) => (
              <Link key={tool.title} to={tool.path}>
                <motion.div
                  whileHover={{ y: -10, borderColor: 'rgba(168, 85, 247, 0.4)' }}
                  className="bg-[#0f172a]/50 p-8 rounded-[3rem] border border-white/5 shadow-2xl hover:shadow-brand/10 transition-all group h-full backdrop-blur-xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className={cn(tool.color, "w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform shadow-lg")}>
                    <tool.icon size={32} />
                  </div>
                  <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tight">{tool.title}</h3>
                  <p className="text-sm text-slate-400 font-medium leading-relaxed italic">{tool.desc}</p>
                  <div className="mt-8 flex items-center gap-2 text-brand font-black text-[9px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Initialize Module <ArrowUpRight size={12} />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Active Core</h2>
          <div className="bg-brand/10 p-8 rounded-[3rem] border border-brand/20 shadow-2xl space-y-8 relative overflow-hidden group backdrop-blur-3xl shadow-inner">
             <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity text-brand">
                <BrainCircuit size={200} />
             </div>
             <div className="space-y-6 relative z-10">
                <div className="space-y-2">
                  <p className="text-[10px] text-brand font-black uppercase tracking-[0.4em] leading-none">Logic Engine</p>
                  <p className="text-xl font-black text-white tracking-tight">{profile?.settings?.preferredModel?.replace('gemini-', '').replace('-preview', '').toUpperCase() || 'FLASH 3'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] text-brand font-black uppercase tracking-[0.4em] leading-none">Visual Cortex</p>
                  <p className="text-xl font-black text-white tracking-tight">{profile?.settings?.preferredImageModel?.replace('gemini-', '').replace('-preview', '').toUpperCase() || 'FLASH IMAGE'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] text-brand font-black uppercase tracking-[0.4em] leading-none">Persona Thread</p>
                  <p className="text-xl font-black text-white tracking-tight">{profile?.settings?.persona?.toUpperCase() || 'PROFESSIONAL'}</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(168,85,247,0.3)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/settings')}
                  className="block w-full text-center py-4 bg-brand text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-neon-purple mt-4"
                >
                  Neural Config
                </motion.button>
             </div>
          </div>
        </div>
      </div>

      {/* Recent Activity & Quick Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative z-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Transmission Logs</h2>
            <Link to="/chat" className="text-slate-500 hover:text-brand transition-colors p-2 bg-white/5 rounded-xl border border-white/5">
              <Plus size={20} />
            </Link>
          </div>
          <div className="bg-[#0f172a]/50 rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl backdrop-blur-xl shadow-inner">
            {[1, 2, 3].map((item) => (
              <div key={item} className="p-6 flex items-center gap-6 hover:bg-white/[0.03] transition-all border-b border-white/5 last:border-0 cursor-pointer group">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 group-hover:text-brand group-hover:bg-brand/10 transition-all shadow-inner border border-white/5">
                  <MessageSquare size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-black text-white truncate tracking-tight uppercase group-hover:text-brand transition-colors">Neural Synchronization Delta {item}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                      <Clock size={12} /> {item * 2}h ago
                    </span>
                    <span className="text-[10px] bg-brand/20 text-brand px-3 py-1 rounded-full font-black uppercase tracking-widest border border-brand/20">Encryption: Active</span>
                  </div>
                </div>
                <ArrowUpRight size={20} className="text-slate-600 group-hover:text-white transition-colors" />
              </div>
            ))}
            <div className="p-6 text-center bg-white/[0.01]">
              <motion.button 
                whileHover={{ scale: 1.05, color: '#a855f7' }}
                whileTap={{ scale: 0.95 }}
                className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] hover:text-brand transition-colors"
                onClick={() => navigate('/chat')}
              >
                Access Neural Archives
              </motion.button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Quick Buffer</h2>
          <div className="bg-[#0f172a]/50 p-8 rounded-[3rem] border border-white/5 shadow-2xl space-y-6 backdrop-blur-xl shadow-inner">
            <textarea 
              placeholder="Inject thoughts into local buffer..."
              className="w-full bg-white/[0.03] border-none rounded-[2rem] p-6 text-sm font-medium text-slate-300 focus:ring-2 focus:ring-brand h-48 resize-none outline-none shadow-inner italic"
            ></textarea>
            <motion.button 
              whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(168,85,247,0.4)' }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-4 bg-brand text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] transition-all shadow-neon-purple"
            >
              Commit to Registry
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
