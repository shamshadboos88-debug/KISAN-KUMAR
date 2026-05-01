import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  Plus, 
  Search, 
  FileText, 
  Trash2, 
  Edit3, 
  Save, 
  Clock,
  Bell,
  Calendar,
  MoreVertical,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Circle,
  LayoutList,
  CheckSquare,
  X,
  Share2,
  Users,
  Zap,
  GripVertical
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  updateDoc,
  deleteDoc,
  where,
  getDoc,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { Note, Task } from '../types';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { cn } from '../lib/utils';
import { chatWithAI } from '../lib/gemini';
import { ShareModal } from './ShareModal';

export function NotesHub() {
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [sharedNotes, setSharedNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note & { ownerId?: string, role?: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [isAiExpanding, setIsAiExpanding] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'tasks'>('notes');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [noteFilter, setNoteFilter] = useState<'all' | 'mine' | 'shared'>('all');

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  // Task State
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskReminder, setNewTaskReminder] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const notifiedTasksRef = useRef<Set<string>>(new Set());

  // 1. Handle notification permissions
  useEffect(() => {
    if (!("Notification" in window)) return;
    
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  // 2. Periodic reminder check
  useEffect(() => {
    if (!user || Notification.permission !== "granted") return;

    const checkReminders = () => {
      const now = new Date();
      tasks.forEach(task => {
        // Skip if: completed, no due date, reminder disabled, or already notified
        if (task.completed || !task.dueDate || !task.reminder || notifiedTasksRef.current.has(task.id)) {
          return;
        }

        const dueTime = new Date(task.dueDate);
        
        // Notify if current time is past the due time
        if (now >= dueTime) {
          try {
            new Notification("CognoryX AI: Task Directive", {
              body: `Reminder: ${task.text}`,
              icon: 'https://cdn-icons-png.flaticon.com/512/2103/2103633.png', // Using the app icon
              tag: task.id, // Prevent duplicate notifications for same task if re-sent
              requireInteraction: true // Keep it visible until dismissed
            });
            notifiedTasksRef.current.add(task.id);
          } catch (err) {
            console.error("Failed to show notification:", err);
          }
        }
      });
    };

    // Initial check
    checkReminders();

    // Check every 30 seconds
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [tasks, user]);

  const createNewNote = () => {
    setSelectedNote(null);
    setIsEditing(true);
    setTitle('');
    setContent('');
  };

  // Auto-save logic
  useEffect(() => {
    if (!isEditing || !selectedNote) return;
    
    // Only auto-save if something changed from the current state of selectedNote
    if (title === selectedNote.title && content === selectedNote.content) return;

    const timer = setTimeout(() => {
      autoSave();
    }, 3000);

    return () => clearTimeout(timer);
  }, [title, content, isEditing, selectedNote]);

  const autoSave = async () => {
    if (!user || !selectedNote || (!title.trim() && !content.trim())) return;
    setIsSaving(true);
    try {
      const ownerId = selectedNote.ownerId || user.uid;
      await updateDoc(doc(db, 'users', ownerId, 'notes', selectedNote.id), {
        title,
        content,
        updatedAt: serverTimestamp()
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error("Auto-save failed", error);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    // 1. Listen to OWN notes
    const notesPath = `users/${user.uid}/notes`;
    const notesQ = query(collection(db, 'users', user.uid, 'notes'), orderBy('updatedAt', 'desc'));
    const unsubscribeNotes = onSnapshot(notesQ, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ownerId: user.uid, role: 'owner', ...doc.data() } as any));
      setNotes(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, notesPath);
    });

    // 2. Listen to shared access index
    const accessPath = `users/${user.uid}/access`;
    const accessQ = query(collection(db, 'users', user.uid, 'access'), where('itemType', '==', 'note'));
    
    // Keep track of active shared note listeners
    const sharedUnsubscribers: Record<string, Unsubscribe> = {};

    const unsubscribeAccess = onSnapshot(accessQ, (snapshot) => {
      const accessItems = snapshot.docs.map(doc => doc.data() as { ownerId: string, itemId: string, role: string });
      
      // Cleanup stale listeners
      Object.keys(sharedUnsubscribers).forEach(id => {
        if (!accessItems.find(ai => ai.itemId === id)) {
          sharedUnsubscribers[id]();
          delete sharedUnsubscribers[id];
        }
      });

      // Setup new listeners
      accessItems.forEach(item => {
        if (!sharedUnsubscribers[item.itemId]) {
          const noteRef = doc(db, 'users', item.ownerId, 'notes', item.itemId);
          sharedUnsubscribers[item.itemId] = onSnapshot(noteRef, (snap) => {
            if (snap.exists()) {
               const sharedNote = { id: snap.id, ownerId: item.ownerId, role: item.role, ...snap.data() } as any;
               setSharedNotes((prev: any) => {
                 const other = prev.filter((n: any) => n.id !== snap.id);
                 return [...other, sharedNote];
               });
            } else {
              // Note was deleted
              setSharedNotes((prev: any) => prev.filter((n: any) => n.id !== item.itemId));
            }
          });
        }
      });
    });

    const tasksPath = `users/${user.uid}/tasks`;
    const tasksQ = query(
      collection(db, 'users', user.uid, 'tasks'), 
      orderBy('order', 'asc'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeTasks = onSnapshot(tasksQ, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, tasksPath);
    });

    return () => {
      unsubscribeNotes();
      unsubscribeAccess();
      unsubscribeTasks();
      Object.values(sharedUnsubscribers).forEach(unsub => unsub());
    };
  }, [user]);

  const handleSave = async () => {
    if (!user || !title.trim() || !content.trim()) return;
    setIsSaving(true);

    try {
      if (selectedNote) {
        const ownerId = selectedNote.ownerId || user.uid;
        const noteDocRef = doc(db, 'users', ownerId, 'notes', selectedNote.id);
        await updateDoc(noteDocRef, {
          title,
          content,
          updatedAt: serverTimestamp()
        });
        setIsEditing(false);
        setLastSaved(new Date());
      } else {
        const notesRef = collection(db, 'users', user.uid, 'notes');
        const newDoc = await addDoc(notesRef, {
          userId: user.uid,
          title,
          content,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setIsEditing(false);
        setSelectedNote({ id: newDoc.id, userId: user.uid, ownerId: user.uid, role: 'owner', title, content, createdAt: '', updatedAt: '' });
        setLastSaved(new Date());
      }
    } catch (error) {
      const ownerId = selectedNote?.ownerId || user.uid;
      const operationPath = selectedNote ? `users/${ownerId}/notes/${selectedNote.id}` : `users/${user.uid}/notes`;
      handleFirestoreError(error, selectedNote ? OperationType.WRITE : OperationType.CREATE, operationPath);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteNote = async (id: string, e: React.MouseEvent, ownerId?: string) => {
    e.stopPropagation();
    if (!user || !window.confirm('Delete this note?')) return;
    
    // If we are a collaborator, we technically can't delete the note but we can remove our access
    if (ownerId && ownerId !== user.uid) {
       const accessRef = doc(db, 'users', user.uid, 'access', id);
       try {
         await deleteDoc(accessRef);
         if (selectedNote?.id === id) {
           setSelectedNote(null);
           setIsEditing(false);
         }
       } catch (err) {
         console.error('Remove access error:', err);
       }
       return;
    }

    const path = `users/${user.uid}/notes/${id}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'notes', id));
      if (selectedNote?.id === id) {
        setSelectedNote(null);
        setIsEditing(false);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTaskText.trim()) return;

    const path = `users/${user.uid}/tasks`;
    try {
      await addDoc(collection(db, 'users', user.uid, 'tasks'), {
        userId: user.uid,
        text: newTaskText,
        completed: false,
        noteId: selectedNote?.id || null,
        order: tasks.length,
        dueDate: newTaskDueDate || null,
        reminder: newTaskReminder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewTaskText('');
      setNewTaskDueDate('');
      setNewTaskReminder(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const toggleTask = async (task: Task) => {
    if (!user) return;
    const path = `users/${user.uid}/tasks/${task.id}`;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
        completed: !task.completed,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const updateTaskDueDate = async (taskId: string, dueDate: string | null, reminder: boolean) => {
    if (!user) return;
    const path = `users/${user.uid}/tasks/${taskId}`;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'tasks', taskId), {
        dueDate,
        reminder,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    const path = `users/${user.uid}/tasks/${id}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleReorder = async (newOrderedList: Task[]) => {
    // Only allow reordering when not searching to keep it simple and consistent
    if (search.trim() || newOrderedList.length === 0) return;
    
    // Find all indices that were occupied by these tasks in the master list
    const affectedIndices = tasks
      .map((t, i) => newOrderedList.find(nt => nt.id === t.id) ? i : -1)
      .filter(i => i !== -1)
      .sort((a, b) => a - b);

    if (affectedIndices.length === 0) return;

    // Create a copy of tasks to update local state
    const nextTasks = [...tasks];
    
    // Move items in the local state copy to match the new order
    affectedIndices.forEach((targetIndex, i) => {
      nextTasks[targetIndex] = newOrderedList[i];
    });

    setTasks(nextTasks);

    if (!user) return;

    const batch = writeBatch(db);
    affectedIndices.forEach((targetIndex, i) => {
       const task = newOrderedList[i];
       const ref = doc(db, 'users', user.uid, 'tasks', task.id);
       batch.update(ref, { 
         order: targetIndex, 
         updatedAt: serverTimestamp() 
       });
    });

    try {
      await batch.commit();
    } catch (err) {
      console.error("Reorder synchronization failed", err);
    }
  };

  const aiExpand = async () => {
    if (!content.trim() || isAiExpanding) return;
    setIsAiExpanding(true);
    try {
      const response = await chatWithAI([
        { role: 'user', content: `Expand and improve this note content while keeping the same tone: ${content}` }
      ], {
        model: profile?.settings?.preferredModel,
        persona: profile?.settings?.persona,
        customPersonaInstruction: profile?.settings?.customPersonaInstruction,
        tone: profile?.settings?.fineTuning?.tone,
        temperature: profile?.settings?.fineTuning?.temperature,
        systemInstruction: "You are a professional editor. Improve the following text."
      });
      if (response) {
        setContent(prev => prev + '\n\n' + response);
      }
    } finally {
      setIsAiExpanding(false);
    }
  };

  const allNotes = [...notes, ...sharedNotes].sort((a, b) => {
    const getTime = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'string') return new Date(val).getTime();
      if (typeof val.toMillis === 'function') return val.toMillis();
      if (val instanceof Date) return val.getTime();
      return 0;
    };
    return getTime(b.updatedAt) - getTime(a.updatedAt);
  });

  const filteredNotes = allNotes.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase()) || 
                          n.content.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    if (noteFilter === 'mine') return n.role === 'owner';
    if (noteFilter === 'shared') return n.role !== 'owner';
    return true;
  });

  const filteredTasks = tasks.filter(t => 
    t.text.toLowerCase().includes(search.toLowerCase())
  );

  const activeNoteTasks = tasks.filter(t => t.noteId === selectedNote?.id);

  const canEdit = !selectedNote || selectedNote.role === 'owner' || selectedNote.role === 'editor';

  return (
    <div className="flex h-[calc(100vh-px)] overflow-hidden bg-[#020617] text-slate-200">
      {/* Sidebar List */}
      <div className={cn(
        "flex flex-col border-r border-white/5 bg-[#020617] transition-all duration-500 relative z-20",
        selectedNote || isEditing ? "hidden lg:flex w-80" : "w-full lg:w-96"
      )}>
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
              <div className="w-2 h-8 bg-brand rounded-full shadow-neon-purple shadow-[0_0_10px_brand]"></div>
              ARCHIVES
            </h1>
          </div>
          
          <div className="flex items-center bg-white/5 border border-white/10 p-1.5 rounded-[1.5rem] shadow-inner">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab('notes')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'notes' ? "bg-brand text-white shadow-neon-purple" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <LayoutList size={14} /> Intelligence
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab('tasks')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'tasks' ? "bg-brand text-white shadow-neon-purple" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <CheckSquare size={14} /> Commands
            </motion.button>
          </div>

          <AnimatePresence>
            {activeTab === 'notes' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-1 bg-white/[0.02] border border-white/5 p-1 rounded-xl overflow-hidden"
              >
                {(['all', 'mine', 'shared'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setNoteFilter(f)}
                    className={cn(
                      "flex-1 text-[8px] font-black uppercase tracking-widest py-2 rounded-lg transition-all",
                      noteFilter === f ? "bg-white/10 text-white shadow-lg" : "text-slate-600 hover:text-slate-400"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand transition-colors" size={16} />
            <input 
              type="text" 
              placeholder={activeTab === 'notes' ? "Scan intelligence nodes..." : "Search commands..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold text-white focus:bg-white/[0.06] focus:border-brand/40 outline-none transition-all placeholder-slate-700"
            />
          </div>

          {activeTab === 'notes' ? (
            <motion.button 
              whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(168,85,247,0.4)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedNote(null);
                setIsEditing(true);
                setTitle('');
                setContent('');
              }}
              className="w-full bg-brand text-white py-4 rounded-[1.5rem] font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-neon-purple hover:bg-brand-dark transition-all"
            >
              <Plus size={20} /> Initialize Node
            </motion.button>
          ) : (
            <div className="space-y-4">
              <form onSubmit={addTask} className="space-y-3">
                <div className="relative group">
                  <input 
                    type="text"
                    placeholder="Insert new directive..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    className="w-full bg-[#0f172a] text-white placeholder-slate-600 py-4 pl-5 pr-14 rounded-2xl text-[11px] font-bold border border-white/5 focus:border-brand/30 outline-none focus:bg-[#1e293b] transition-all"
                  />
                  <motion.button 
                    type="submit"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    disabled={!newTaskText.trim()}
                    className="absolute right-2.5 top-2 bottom-2 aspect-square bg-brand rounded-xl flex items-center justify-center text-white shadow-neon-purple disabled:opacity-50 transition-all"
                  >
                    <Plus size={18} />
                  </motion.button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="datetime-local"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2 pl-9 pr-3 text-[10px] font-bold text-slate-400 focus:border-brand/40 outline-none transition-all uppercase tracking-tighter"
                    />
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setNewTaskReminder(!newTaskReminder)}
                    className={cn(
                      "p-2 rounded-xl border transition-all",
                      newTaskReminder 
                        ? "bg-brand/10 border-brand/40 text-brand shadow-neon-purple" 
                        : "bg-white/[0.03] border-white/5 text-slate-600 hover:text-slate-400"
                    )}
                    title="Remind me"
                  >
                    <Bell size={14} className={newTaskReminder ? "shadow-neon-purple" : ""} />
                  </motion.button>
                </div>
              </form>
              
              <div className="flex items-center gap-3 px-1">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">Linkage:</span>
                <select 
                  className="bg-transparent text-[10px] font-bold text-slate-400 outline-none cursor-pointer hover:text-brand transition-colors max-w-[170px] truncate"
                  value={selectedNote?.id || ''}
                  onChange={(e) => {
                    const note = allNotes.find(n => n.id === e.target.value);
                    if (note) {
                      setSelectedNote(note as any);
                      setIsEditing(false);
                      setTitle(note.title);
                      setContent(note.content);
                    } else {
                      setSelectedNote(null);
                    }
                  }}
                >
                  <option value="" className="bg-[#0f172a]">Autonomous Task</option>
                  {allNotes.map(n => (
                    <option key={n.id} value={n.id} className="bg-[#0f172a]">{n.title}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-12 space-y-4 custom-scrollbar">
          {activeTab === 'notes' ? (
            filteredNotes.map((note) => (
              <motion.button
                key={note.id}
                whileHover={{ scale: 1.01, x: 4 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  setSelectedNote(note);
                  setIsEditing(false);
                  setTitle(note.title);
                  setContent(note.content);
                }}
                className={cn(
                  "w-full text-left p-5 rounded-[1.5rem] transition-all group relative border overflow-hidden",
                  selectedNote?.id === note.id 
                    ? "bg-white/5 border-brand/50 shadow-[0_0_20px_rgba(168,85,247,0.15)] bg-gradient-to-tr from-brand/[0.03] to-transparent" 
                    : "bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/10"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border",
                      note.role === 'owner' 
                        ? (selectedNote?.id === note.id ? "bg-brand text-white border-brand shadow-neon-purple" : "bg-white/10 text-slate-500 border-white/5")
                        : (selectedNote?.id === note.id ? "bg-neon-blue text-white border-neon-blue shadow-neon-blue" : "bg-blue-500/10 text-blue-400 border-blue-500/20")
                    )}>
                      {note.role === 'owner' ? 'Core Node' : 'Neural Link'}
                    </span>
                    {note.role !== 'owner' && <Users size={12} className={selectedNote?.id === note.id ? "text-blue-300" : "text-blue-500/40"} />}
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.2, color: '#ef4444' }}
                    whileTap={{ scale: 0.8 }}
                    onClick={(e) => deleteNote(note.id, e, note.ownerId)} 
                    className={cn(
                      "opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg hover:bg-red-500/20",
                      selectedNote?.id === note.id ? "text-slate-400" : "text-slate-600"
                    )}
                  >
                    <Trash2 size={12} />
                  </motion.button>
                </div>
                <h3 className={cn(
                  "font-bold truncate tracking-tight transition-colors",
                  selectedNote?.id === note.id ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                )}>
                  {note.title || 'Incomplete Index'}
                </h3>
                <p className="text-[10px] text-slate-600 line-clamp-1 mt-1.5 font-bold uppercase tracking-tighter italic">
                  {note.content?.slice(0, 50) || 'Standby for data...'}
                </p>

                {/* Accent line for selection */}
                {selectedNote?.id === note.id && (
                  <motion.div 
                    layoutId="active-note-indicator"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-brand shadow-neon-purple"
                  />
                )}
              </motion.button>
            ))
          ) : (
            <Reorder.Group 
              axis="y" 
              values={filteredTasks} 
              onReorder={handleReorder}
              className="space-y-4"
            >
              <AnimatePresence mode="popLayout">
                {filteredTasks.map((task) => {
                  const linkedNote = allNotes.find(n => n.id === task.noteId);
                  return (
                    <Reorder.Item
                      key={task.id}
                      value={task}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col gap-2 group hover:border-brand/30 transition-all shadow-sm cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical size={14} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
                        <motion.button 
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.8 }}
                          onClick={() => toggleTask(task)}
                          className={cn(
                            "transition-all duration-300",
                            task.completed ? "text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "text-slate-700 hover:text-brand"
                          )}
                        >
                          {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </motion.button>
                        
                        {editingTaskId === task.id ? (
                          <div className="flex-1 space-y-2">
                            <input 
                              autoFocus
                              type="text"
                              value={task.text}
                              onChange={(e) => {
                                const newTasks = tasks.map(t => t.id === task.id ? { ...t, text: e.target.value } : t);
                                setTasks(newTasks);
                              }}
                              onBlur={async () => {
                                setEditingTaskId(null);
                                if (!user) return;
                                try {
                                  await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
                                    text: task.text,
                                    updatedAt: serverTimestamp()
                                  });
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="w-full bg-black/40 border border-brand/30 rounded-lg py-1 px-2 text-xs font-bold text-white outline-none"
                            />
                            <div className="flex items-center gap-2">
                              <input 
                                type="datetime-local"
                                value={task.dueDate || ''}
                                onChange={(e) => updateTaskDueDate(task.id, e.target.value, task.reminder || false)}
                                className="bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[8px] font-black uppercase text-slate-400 outline-none"
                              />
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => updateTaskDueDate(task.id, task.dueDate || null, !task.reminder)}
                                className={cn(
                                  "p-1.5 rounded-lg border transition-all",
                                  task.reminder ? "bg-brand/10 border-brand/30 text-brand" : "bg-white/5 border-white/5 text-slate-600"
                                )}
                              >
                                <Bell size={10} />
                              </motion.button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="flex-1 flex flex-col min-w-0 cursor-text"
                            onClick={() => setEditingTaskId(task.id)}
                          >
                            <span className={cn(
                              "text-xs font-bold transition-all truncate tracking-tight",
                              task.completed ? "text-slate-600 line-through" : "text-slate-300"
                            )}>
                              {task.text}
                            </span>
                            {task.dueDate && (
                              <div className={cn(
                                "flex items-center gap-1.5 mt-0.5",
                                new Date(task.dueDate) < new Date() && !task.completed ? "text-red-400" : "text-slate-600"
                              )}>
                                <Calendar size={10} />
                                <span className="text-[8px] font-black uppercase tracking-widest italic">
                                  {new Date(task.dueDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                                {task.reminder && <Bell size={10} className="text-brand shadow-neon-purple animate-pulse" />}
                              </div>
                            )}
                          </div>
                        )}

                        <motion.button 
                          whileHover={{ scale: 1.2, color: '#ef4444' }}
                          whileTap={{ scale: 0.8 }}
                          onClick={() => deleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 transition-all"
                        >
                          <X size={14} />
                        </motion.button>
                      </div>
                      {linkedNote && (
                        <div className="flex items-center gap-2 ml-8 mt-1 py-1 px-2 bg-white/5 rounded-lg border border-white/5 inline-flex self-start">
                          <FileText size={10} className="text-brand shadow-neon-purple shadow-[0_0_5px_brand]" />
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[150px]">
                            {linkedNote.title}
                          </span>
                        </div>
                      )}
                    </Reorder.Item>
                  );
                })}
              </AnimatePresence>
            </Reorder.Group>
          )}
        </div>
      </div>

      {/* Editor/Viewer */}
      <div className={cn(
        "flex-1 flex flex-col bg-[#020617] relative",
        !selectedNote && !isEditing ? "hidden lg:flex" : "flex"
      )}>
        {(selectedNote || isEditing) ? (
          <>
            <div className="h-24 border-b border-white/5 flex items-center justify-between px-8 bg-white/[0.01] shrink-0">
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                whileTap={{ scale: 0.9 }}
                onClick={() => { setSelectedNote(null); setIsEditing(false); }}
                className="lg:hidden p-3 text-slate-500 hover:text-white rounded-xl border border-white/5"
              >
                <ArrowLeft size={20} />
              </motion.button>
              <div className="flex-1 px-6 lg:px-0">
                <div className="flex flex-col">
                  {selectedNote?.role && selectedNote.role !== 'owner' && (
                    <span className="text-[9px] font-black text-neon-blue uppercase tracking-[0.2em] leading-none mb-2 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-neon-blue shadow-neon-blue"></div>
                       Neural Sync Established
                    </span>
                  )}
                  <div className="flex items-center gap-4">
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Input memory vector..."
                      className={cn(
                        "flex-1 font-black text-white outline-none bg-transparent placeholder-slate-700 tracking-tighter",
                        isEditing ? "text-xl md:text-3xl" : "text-xl md:text-3xl pointer-events-none"
                      )}
                      readOnly={!isEditing}
                    />
                    <AnimatePresence>
                      {(isSaving || lastSaved) && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/[0.03] rounded-full border border-white/5 shadow-inner"
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full transition-colors duration-500 shadow-xl",
                            isSaving ? "bg-brand animate-pulse shadow-neon-purple" : "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                          )} />
                          <span className="text-[9px] font-black text-white uppercase tracking-widest whitespace-nowrap">
                            {isSaving ? "Syncing" : "Synced"}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedNote && selectedNote.role === 'owner' && (
                  <motion.button 
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.05)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsShareModalOpen(true)}
                    className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 text-slate-400 hover:text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    <Share2 size={16} /> Link Neurons
                  </motion.button>
                )}
                {!isEditing ? (
                  <motion.button 
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsEditing(true)}
                    disabled={!canEdit}
                    className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all disabled:opacity-50"
                  >
                    <Edit3 size={16} /> Modified Flux
                  </motion.button>
                ) : (
                  <motion.button 
                    whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(168,85,247,0.5)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-brand text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-neon-purple transition-all"
                  >
                    <Zap size={16} /> Commit
                  </motion.button>
                )}
              </div>
            </div>


            <div className="flex-1 flex overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent"></div>
              <div className={cn(
                "flex-1 overflow-y-auto p-10 md:p-14 lg:p-20 custom-scrollbar relative z-10",
                isEditing ? "bg-brand/5" : "bg-transparent"
              )}>
                {isEditing ? (
                  <div className="max-w-4xl mx-auto h-full flex flex-col space-y-8">
                    <textarea 
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Initialize neural dump..."
                      className="flex-1 w-full bg-transparent outline-none resize-none text-slate-300 font-medium leading-relaxed text-xl placeholder-slate-800"
                    />
                    <div className="flex items-center gap-4 pt-8 border-t border-white/5">
                      <motion.button 
                        whileHover={{ scale: 1.02, backgroundColor: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.4)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={aiExpand}
                        disabled={isAiExpanding}
                        className="flex items-center gap-3 bg-white/5 border border-white/10 text-white px-6 py-3.5 rounded-[1.5rem] text-[10px] font-black tracking-[0.2em] uppercase shadow-lg transition-all disabled:opacity-50"
                      >
                        {isAiExpanding ? <Sparkles className="animate-spin text-brand" size={18} /> : <Sparkles className="text-brand shadow-neon-purple" size={18} />}
                        Neural Expansion
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto space-y-16">
                    <div className="prose prose-invert prose-lg lg:prose-xl prose-headings:font-black prose-headings:tracking-tighter prose-headings:text-white prose-p:text-slate-400 prose-p:leading-loose">
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </div>

                    {/* Integrated Tasks */}
                    {selectedNote && (
                      <div className="pt-16 border-t border-white/5 space-y-8">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-3">
                            <CheckSquare size={20} className="text-brand shadow-neon-purple shadow-[0_0_10px_brand]" />
                            Linked Directives
                          </h3>
                        </div>
                        
                        <div className="space-y-6">
                          <form onSubmit={addTask} className="space-y-4 max-w-lg">
                            <div className="relative group">
                              <input 
                                type="text"
                                placeholder="Inject new directive to this node..."
                                value={newTaskText}
                                onChange={(e) => setNewTaskText(e.target.value)}
                                className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-[11px] font-bold text-white outline-none focus:border-brand/40 focus:bg-[#1e293b] shadow-xl transition-all"
                              />
                              <motion.button 
                                type="submit"
                                whileHover={{ scale: 1.1, rotate: 90 }}
                                 whileTap={{ scale: 0.9 }}
                                disabled={!newTaskText.trim()}
                                className="absolute right-2.5 top-2 bottom-2 aspect-square bg-brand rounded-xl flex items-center justify-center text-white shadow-neon-purple disabled:opacity-50 transition-all"
                              >
                                <Plus size={18} />
                              </motion.button>
                            </div>

                            <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                              <div className="flex items-center gap-2 text-slate-500">
                                <Calendar size={14} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Due Matrix:</span>
                              </div>
                              <input 
                                type="datetime-local"
                                value={newTaskDueDate}
                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                                className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-300 focus:text-brand transition-colors cursor-pointer"
                              />
                              <div className="flex-1" />
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setNewTaskReminder(!newTaskReminder)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                                  newTaskReminder 
                                    ? "bg-brand/10 border-brand/40 text-brand shadow-neon-purple" 
                                    : "bg-white/5 border-white/5 text-slate-600 hover:text-slate-400"
                                )}
                              >
                                <Bell size={12} /> {newTaskReminder ? 'Reminder Set' : 'Notify'}
                              </motion.button>
                            </div>
                          </form>

                          <Reorder.Group axis="y" values={activeNoteTasks} onReorder={handleReorder} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {activeNoteTasks.length > 0 ? (
                              activeNoteTasks.map((task) => (
                                <Reorder.Item
                                  key={task.id}
                                  value={task}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  whileHover={{ y: -2, backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                                  className="bg-white/[0.02] border border-white/5 p-5 rounded-[1.5rem] flex items-center gap-4 shadow-xl group hover:border-brand/30 transition-all overflow-hidden cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical size={16} className="text-slate-800 group-hover:text-slate-600 transition-colors" />
                                  <motion.button 
                                    whileHover={{ scale: 1.2 }}
                                    whileTap={{ scale: 0.8 }}
                                    onClick={() => toggleTask(task)}
                                    className={cn(
                                      "transition-all duration-300",
                                      task.completed ? "text-green-500 shadow-neon-green" : "text-slate-700 hover:text-brand"
                                    )}
                                  >
                                    {task.completed ? <CheckCircle2 size={24} className="drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" /> : <Circle size={24} />}
                                  </motion.button>
                                  <span className={cn(
                                    "flex-1 text-sm font-bold transition-all tracking-tight",
                                    task.completed ? "text-slate-600 line-through" : "text-slate-300"
                                  )}>
                                    {task.text}
                                  </span>
                                  <motion.button 
                                    whileHover={{ scale: 1.2, color: '#ef4444' }}
                                    whileTap={{ scale: 0.8 }}
                                    onClick={() => deleteTask(task.id)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-700 transition-all p-2 rounded-lg hover:bg-red-500/10"
                                  >
                                    <Trash2 size={16} />
                                  </motion.button>
                                </Reorder.Item>
                              ))
                            ) : (
                              <p className="text-[10px] text-slate-700 font-black uppercase tracking-[0.2em] italic py-8 border-2 border-dashed border-white/5 rounded-[2rem] text-center w-full col-span-2">
                                No mission directives linked to this node
                              </p>
                            )}
                          </Reorder.Group>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-10 p-10 relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.05)_0%,transparent_70%)] pointer-events-none"></div>
            <div className="w-32 h-32 bg-white/[0.03] border-2 border-white/5 rounded-[3rem] flex items-center justify-center text-slate-800 mb-4 relative group">
              <div className="absolute inset-0 bg-brand/5 blur-3xl rounded-full scale-150 group-hover:bg-brand/10 transition-all duration-700"></div>
              <FileText size={56} className="relative z-10 text-slate-700 group-hover:text-slate-500 transition-colors" />
              <div className="absolute -top-1 -right-1 w-8 h-8 bg-brand rounded-xl flex items-center justify-center text-white shadow-neon-purple shadow-[0_0_15px_brand] rotate-12">
                <Zap size={18} className="fill-current" />
              </div>
            </div>
            <div className="max-w-md space-y-4">
              <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Intelligence Matrix</h2>
              <p className="text-slate-500 font-bold leading-relaxed tracking-wider">
                Select a memory fragment from the archive or initialize a new intelligence node to begin processing neural data flows.
              </p>
              
              <div className="mt-16 bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand/5 blur-3xl"></div>
                <div className="flex items-center gap-3 justify-center text-brand font-black uppercase tracking-[0.3em] text-[10px]">
                  <CheckSquare size={16} /> Neural Command Status
                </div>
                <div className="grid grid-cols-2 gap-6 pb-2">
                  <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/10">
                    <div className="text-3xl font-black text-white mb-1 tracking-tighter">{tasks.length}</div>
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Directives</div>
                  </div>
                  <div className="bg-brand/10 p-4 rounded-[1.5rem] border border-brand/20">
                    <div className="text-3xl font-black text-brand mb-1 tracking-tighter shadow-neon-purple">{tasks.filter(t => t.completed).length}</div>
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sync Complete</div>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(168,85,247,0.5)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={createNewNote}
                  className="w-full bg-brand text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-neon-purple flex items-center justify-center gap-3"
                >
                  <Plus size={20} /> Initialize New Node
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        itemId={selectedNote?.id || ''}
        itemType="note"
        itemTitle={selectedNote?.title || ''}
      />
    </div>
  );
}
