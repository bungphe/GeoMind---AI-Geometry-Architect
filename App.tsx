
import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import GeometryCanvas from './components/GeometryCanvas';
import { sendMessageToGemini } from './services/geminiService';
import { Message, GeometryScene, SavedSession } from './types';
import { Sparkles, X, Trash2, Clock, MessageSquare, Box, Calendar } from 'lucide-react';

const STORAGE_KEY = 'geomind_sessions';
const AUTOSAVE_KEY = 'geomind_autosave';

const App: React.FC = () => {
  // Application State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scene, setScene] = useState<GeometryScene>({ points: [], segments: [] });
  
  // Session Management State
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load saved sessions from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSavedSessions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved sessions", e);
      }
    }

    // Attempt to restore auto-saved session if workspace is empty
    const autoSaved = localStorage.getItem(AUTOSAVE_KEY);
    if (autoSaved && messages.length === 0) {
      try {
        const { messages: savedMessages, scene: savedScene } = JSON.parse(autoSaved);
        if (savedMessages && savedMessages.length > 0) {
            setMessages(savedMessages);
        }
        if (savedScene) {
            setScene(savedScene);
        }
      } catch (e) {
        console.error("Failed to restore autosave", e);
      }
    }
  }, []); // Run once on mount

  // Auto-save logic: Persist current state whenever messages or scene changes
  useEffect(() => {
    if (messages.length > 0 || scene.points.length > 0) {
        const stateToSave = {
            messages,
            scene,
            timestamp: Date.now()
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(stateToSave));
    }
  }, [messages, scene]);

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const result = await sendMessageToGemini(messages, text, scene);
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: result.explanation,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);

      // Only update geometry if the model returned a geometry object
      if (result.geometry) {
        setScene(result.geometry);
      }

    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "Sorry, I encountered an error while processing your request. Please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Session Handlers ---

  const handleReset = () => {
    if (messages.length > 0 && !window.confirm("Are you sure you want to reset? Unsaved changes will be lost.")) {
      return;
    }
    setMessages([]);
    setScene({ points: [], segments: [] });
    localStorage.removeItem(AUTOSAVE_KEY); // Clear autosave on reset
  };

  const handleSave = () => {
    if (messages.length === 0) {
      alert("Nothing to save yet!");
      return;
    }
    
    // Default name based on first user message or timestamp
    const firstUserMessage = messages.find(m => m.role === 'user');
    const defaultName = firstUserMessage 
        ? firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '') 
        : `Session ${new Date().toLocaleTimeString()}`;

    const name = window.prompt("Enter a name for this session:", defaultName);
    if (!name) return;

    const newSession: SavedSession = {
      id: Date.now().toString(),
      name,
      date: Date.now(),
      messages,
      scene
    };

    const updatedSessions = [newSession, ...savedSessions];
    setSavedSessions(updatedSessions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
  };

  const handleLoadSession = (session: SavedSession) => {
    if (messages.length > 0 && !window.confirm("Current workspace will be overwritten. Continue?")) {
      return;
    }
    setMessages(session.messages);
    setScene(session.scene);
    setIsModalOpen(false);
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Delete this saved session?")) return;
    
    const updated = savedSessions.filter(s => s.id !== id);
    setSavedSessions(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <div className="flex h-screen w-screen bg-[#0f172a] text-slate-100 overflow-hidden">
      {/* Sidebar Chat */}
      <ChatInterface 
        messages={messages} 
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        onReset={handleReset}
        onSave={handleSave}
        onLoad={() => setIsModalOpen(true)}
      />

      {/* Main Content - Geometry Viewer */}
      <main className="flex-1 relative flex flex-col min-w-0">
        <div className="flex-1 w-full h-full relative">
            {scene.points.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 select-none pointer-events-none">
                    <Sparkles size={64} className="mb-4 opacity-20" />
                    <p className="text-lg font-light">3D Workspace Empty</p>
                    <p className="text-sm opacity-60">Ask the AI to draw something!</p>
                </div>
            ) : null}
            <GeometryCanvas scene={scene} />
        </div>
      </main>

      {/* History / Saved Sessions Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-slate-800 w-[600px] max-h-[85vh] flex flex-col rounded-xl border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                 <Clock className="text-blue-400" size={24} />
                 <div>
                    <h2 className="font-bold text-lg text-white">History & Saved Sessions</h2>
                    <p className="text-xs text-slate-400">Restore your past geometry projects</p>
                 </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {savedSessions.length === 0 ? (
                <div className="text-center py-16 text-slate-500 flex flex-col items-center">
                  <Clock size={48} className="mb-4 opacity-20" />
                  <p className="text-lg font-medium">No history found</p>
                  <p className="text-sm opacity-60">Save your work to see it here.</p>
                </div>
              ) : (
                savedSessions.map(session => {
                  const firstUserMsg = session.messages.find(m => m.role === 'user');
                  const previewText = firstUserMsg ? firstUserMsg.content : "No messages";
                  const hasGeometry = session.scene && session.scene.points.length > 0;
                  const dateObj = new Date(session.date);

                  return (
                    <div 
                      key={session.id}
                      onClick={() => handleLoadSession(session)}
                      className="group relative flex flex-col p-4 bg-slate-900/40 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-slate-700/40 cursor-pointer transition-all duration-200"
                    >
                      {/* Top Row: Title & Date */}
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-slate-200 group-hover:text-blue-300 truncate max-w-[70%]">
                            {session.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded">
                            <Calendar size={10} />
                            <span>{dateObj.toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>

                      {/* Middle: Preview Text */}
                      <p className="text-sm text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                        <span className="opacity-50 italic mr-1">Topic:</span>
                        {previewText}
                      </p>

                      {/* Bottom: Meta Info */}
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-800">
                         <div className="flex gap-3">
                            {hasGeometry && (
                                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/50">
                                    <Box size={10} />
                                    3D Scene
                                </span>
                            )}
                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                <MessageSquare size={10} />
                                {session.messages.length} msgs
                            </span>
                         </div>
                      </div>

                      {/* Delete Action (Hidden by default, shown on hover) */}
                      <button 
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="absolute bottom-3 right-3 p-2 text-slate-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Delete Session"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
