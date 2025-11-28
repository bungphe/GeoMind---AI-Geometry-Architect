import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Box } from 'lucide-react';
import { Message } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-[#1e293b] border-r border-slate-700 w-[400px] flex-shrink-0 relative z-10 shadow-2xl">
      {/* Header */}
      <div className="h-16 border-b border-slate-700 flex items-center px-6 bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Box size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">GeoMind</h1>
            <p className="text-xs text-blue-300 font-medium">Gemini 3 Pro • Thinking Mode</p>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-slate-700">
               <Sparkles className="text-blue-400" size={32} />
            </div>
            <h3 className="text-slate-200 font-semibold mb-2">Welcome to GeoMind!</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              I'm your AI Geometry Assistant. Describe any 3D shape, and I'll draw it for you.
            </p>
            <div className="mt-6 grid gap-2">
                <button 
                  onClick={() => onSendMessage("Draw a cube named ABCD.EFGH")}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-300 py-2 px-3 rounded-md transition-colors border border-slate-700 text-left"
                >
                  "Draw a cube named ABCD.EFGH"
                </button>
                <button 
                  onClick={() => onSendMessage("Draw a pyramid S.ABCD with square base")}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-300 py-2 px-3 rounded-md transition-colors border border-slate-700 text-left"
                >
                  "Draw a pyramid S.ABCD"
                </button>
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-5 py-4 flex flex-col gap-2 shadow-sm max-w-[85%]">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                 <Loader2 size={12} className="animate-spin" />
                 <span>Reasoning</span>
              </div>
              <div className="h-1.5 w-24 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 animate-pulse w-2/3"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-700">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 bg-slate-800 rounded-xl p-1.5 border border-slate-700 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe a shape to draw..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 px-3 py-2.5 outline-none text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-all"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;