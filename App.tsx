import React, { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import GeometryCanvas from './components/GeometryCanvas';
import { sendMessageToGemini } from './services/geminiService';
import { Message, GeometryScene } from './types';
import { Sparkles } from 'lucide-react';

const App: React.FC = () => {
  // Application State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scene, setScene] = useState<GeometryScene>({ points: [], segments: [] });

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

  return (
    <div className="flex h-screen w-screen bg-[#0f172a] text-slate-100 overflow-hidden">
      {/* Sidebar Chat */}
      <ChatInterface 
        messages={messages} 
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />

      {/* Main Content - Geometry Viewer */}
      <main className="flex-1 relative flex flex-col min-w-0">
        {/* Top Bar for context/tools if needed later */}
        <div className="absolute top-0 left-0 right-0 h-16 z-20 pointer-events-none flex justify-between items-center px-6">
           {/* Placeholder for tools */}
        </div>

        {/* The 3D Canvas */}
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
    </div>
  );
};

export default App;