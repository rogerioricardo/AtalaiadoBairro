
import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { Card, Input, Button } from '../components/UI';
import { MessageCircle, Send } from 'lucide-react';
import { MockService } from '../services/mockService';
import { ChatMessage, UserRole } from '../types';

const Chat: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
      if (user?.neighborhoodId) {
        const data = await MockService.getMessages(user.neighborhoodId);
        setMessages(data);
      }
  };

  useEffect(() => {
      fetchMessages();
      // Poll for new messages every 3s to simulate realtime
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
  }, [user]);

  // Optimized Scroll Logic
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, lastMessageId]);

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !user) return;

      await MockService.sendMessage({
          neighborhoodId: user.neighborhoodId || 'unknown',
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          text: newMessage,
      });
      setNewMessage('');
      await fetchMessages();
  };

  const RoleBadge = ({ role }: { role: UserRole }) => {
      const colors = {
          [UserRole.ADMIN]: "bg-purple-500/20 text-purple-400 border-purple-500/30",
          [UserRole.INTEGRATOR]: "bg-blue-500/20 text-blue-400 border-blue-500/30",
          [UserRole.SCR]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
          [UserRole.RESIDENT]: "bg-gray-700/50 text-gray-300 border-gray-600",
      };
      return (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[role]} uppercase tracking-wider font-bold`}>
              {role === UserRole.SCR ? 'MOTOVIGIA' : role}
          </span>
      );
  };

  return (
    <Layout>
        <div className="flex flex-col h-[calc(100vh-100px)]">
             <div className="mb-4">
                <h1 className="text-3xl font-bold text-white mb-2">Chat da Comunidade</h1>
                <p className="text-gray-400">Comunicação direta com seus vizinhos e a central.</p>
            </div>

            <Card className="flex-1 flex flex-col border-atalaia-border/50 overflow-hidden bg-[#0a0a0a]">
                <div className="p-4 border-b border-white/5 bg-[#111] flex items-center gap-2">
                    <MessageCircle className="text-atalaia-neon" size={20} />
                    <div>
                        <h3 className="font-bold text-white">Canal do Bairro</h3>
                        <p className="text-xs text-green-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Online
                        </p>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#080808]">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-500 text-sm py-10">
                            Nenhuma mensagem ainda. Inicie a conversa.
                        </div>
                    )}
                    {messages.map((msg) => {
                        const isMe = msg.userId === user?.id;
                        const isAlert = msg.isSystemAlert;
                        
                        return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <span className="text-xs font-bold text-gray-300">{msg.userName}</span>
                                    <RoleBadge role={msg.userRole} />
                                    <span className="text-[10px] text-gray-600">
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                                
                                <div 
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
                                        ${isAlert 
                                            ? `w-full text-center font-bold border-2 ${
                                                msg.alertType === 'PANIC' ? 'bg-red-900/20 border-red-600 text-red-500' : 
                                                msg.alertType === 'DANGER' ? 'bg-orange-900/20 border-orange-600 text-orange-500' :
                                                msg.alertType === 'SUSPICIOUS' ? 'bg-yellow-900/20 border-yellow-600 text-yellow-500' :
                                                'bg-green-900/20 border-green-600 text-green-500'
                                                }` 
                                            : isMe 
                                                ? 'bg-atalaia-neon text-black rounded-tr-none' 
                                                : 'bg-[#222] text-gray-200 border border-white/5 rounded-tl-none'
                                        }
                                    `}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSendMessage} className="p-4 bg-[#111] border-t border-white/5 flex gap-3">
                    <Input 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        className="flex-1 !bg-black !border-white/10 focus:!border-atalaia-neon !h-12"
                    />
                    <Button type="submit" className="px-6 bg-white/5 hover:bg-atalaia-neon hover:text-black text-atalaia-neon transition-colors h-12">
                        <Send size={20} />
                    </Button>
                </form>
            </Card>
        </div>
    </Layout>
  );
};

export default Chat;
