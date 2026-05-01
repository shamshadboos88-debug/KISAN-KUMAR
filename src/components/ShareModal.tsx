import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Send, CheckCircle, Shield, Eye, Edit3, Users, UserMinus, ShieldCheck } from 'lucide-react';
import { sendInvitation, getMembers, removeMember } from '../lib/collaboration';
import { useAuth } from '../lib/AuthContext';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: 'note' | 'chat';
  itemTitle: string;
}

export function ShareModal({ isOpen, onClose, itemId, itemType, itemTitle }: ShareModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && itemId && user) {
      fetchMembers();
    }
  }, [isOpen, itemId, itemType, user]);

  const fetchMembers = async () => {
    const ownerId = user?.uid;
    if (!ownerId) return;
    const list = await getMembers(ownerId, itemType === 'note' ? 'notes' : 'chats', itemId);
    setMembers(list);
  };

  const handleSend = async () => {
    if (!user || !email.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await sendInvitation(user, email, itemId, itemType, role);
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setEmail('');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setIsSending(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!user) return;
    try {
      await removeMember(user.uid, itemType === 'note' ? 'notes' : 'chats', itemId, memberUserId);
      fetchMembers();
    } catch (err) {
      console.error('Failed to remove member', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center text-brand mb-6">
            <Mail size={32} />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Share Architecture</h2>
          <p className="text-slate-500 mb-8 italic">"{itemTitle}"</p>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Collaborator Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-brand outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Access Level</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setRole('viewer')}
                  className={`flex items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    role === 'viewer' ? 'border-brand bg-brand/5 text-brand font-bold' : 'border-slate-100 text-slate-500 font-medium hover:bg-slate-50'
                  }`}
                >
                  <Eye size={18} /> Viewer
                </button>
                <button
                  onClick={() => setRole('editor')}
                  className={`flex items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    role === 'editor' ? 'border-brand bg-brand/5 text-brand font-bold' : 'border-slate-100 text-slate-500 font-medium hover:bg-slate-50'
                  }`}
                >
                  <Edit3 size={18} /> Editor
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 p-4 rounded-xl font-medium">{error}</p>
            )}

            <button
              onClick={handleSend}
              disabled={isSending || !email}
              className="w-full h-14 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 transition-all"
            >
              {sent ? (
                <>
                  <CheckCircle size={20} /> Invitation Transmitted
                </>
              ) : isSending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Send size={18} /> Initiate Sync
                </>
              )}
            </button>

            {members.length > 0 && (
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Users size={14} /> Active Collaborators
                  </label>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{members.length}</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {members.map((member) => (
                    <motion.div 
                      key={member.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-brand/20 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <Users size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{member.email}</p>
                          <div className="flex items-center gap-1.5">
                            {member.role === 'editor' ? <Edit3 size={10} className="text-brand" /> : <Eye size={10} className="text-slate-400" />}
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{member.role}</p>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Remove Collaborator"
                      >
                        <UserMinus size={14} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-brand">
            <Shield size={14} />
          </div>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
            Enterprise-grade secure node connection
          </p>
        </div>
      </motion.div>
    </div>
  );
}
