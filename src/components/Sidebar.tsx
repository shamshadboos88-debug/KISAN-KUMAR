import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquare, 
  FileText, 
  FileSearch, 
  BrainCircuit, 
  Image as ImageIcon,
  Settings as SettingsIcon,
  LogOut,
  Zap,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: MessageSquare, label: 'Smart Chat', path: '/chat' },
  { icon: FileText, label: 'Notes Hub', path: '/notes' },
  { icon: FileSearch, label: 'PDF Analyzer', path: '/pdf' },
  { icon: BrainCircuit, label: 'Quiz Lab', path: '/quiz' },
  { icon: ImageIcon, label: 'Image Studio', path: '/images' },
  { icon: SettingsIcon, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 glass-morphism rounded-lg lg:hidden text-white"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <motion.aside
        initial={false}
        animate={{ width: isOpen ? 260 : 0, opacity: isOpen ? 1 : 0 }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-[#020617] border-r border-white/5 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out lg:relative shadow-[10px_0_30px_-15px_rgba(0,0,0,0.5)]",
          !isOpen && "pointer-events-none lg:pointer-events-auto lg:w-0"
        )}
      >
        <div className="p-8 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-brand to-brand-light rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.3)]">
            <Zap size={20} className="text-white fill-current" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">COGNORYX</h1>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <motion.div
              key={item.path}
              whileHover="hover"
              initial="initial"
              whileTap={{ scale: 0.98 }}
            >
              <NavLink
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 text-sm font-bold uppercase tracking-wider w-full group",
                  isActive 
                    ? "bg-brand/10 text-brand shadow-[0_0_20px_rgba(168,85,247,0.1)] border border-brand/20" 
                    : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <motion.div
                  variants={{
                    initial: { scale: 1, rotate: 0 },
                    hover: { scale: 1.2, rotate: 5, transition: { type: 'spring', stiffness: 400, damping: 10 } }
                  }}
                  className="flex items-center justify-center p-0.5"
                >
                  <item.icon size={20} />
                </motion.div>
                {item.label}
              </NavLink>
            </motion.div>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="relative">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-10 h-10 rounded-full border border-white/10" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-white/10">
                  {profile?.displayName?.[0] || 'U'}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-[#020617] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{profile?.displayName}</p>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">Neural Linked</p>
            </div>
          </div>

          <motion.button 
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(168, 85, 247, 0.1)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 px-4 py-2.5 mt-2 text-[10px] font-black uppercase tracking-widest text-brand rounded-xl border border-brand/20 shadow-[0_0_15px_rgba(168,85,247,0.05)]"
          >
            <Zap size={14} className="fill-current" />
            Founder Registry
          </motion.button>
          
          <motion.button 
            whileHover={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', x: 4 }}
            whileTap={{ scale: 0.98 }}
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 mt-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-500 rounded-2xl transition-all border border-transparent hover:border-red-500/20"
          >
            <LogOut size={16} />
            Detach System
          </motion.button>
        </div>
      </motion.aside>
    </>
  );
}
