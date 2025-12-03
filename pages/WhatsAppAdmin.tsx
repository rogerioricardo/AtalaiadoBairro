import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { UserRole, Neighborhood } from '../types';
import { MockService } from '../services/mockService';
import { Card, Button } from '../components/UI';
import { MessageSquare, Send, Users, Shield, MapPin, CheckCircle, Wifi, Loader2, AlertCircle } from 'lucide-react';

const WhatsAppAdmin: React.FC = () => {
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [targetType, setTargetType] = useState<'ALL' | 'ADMINS' | 'HOOD'>('ADMINS');
    const [selectedHoodId, setSelectedHoodId] = useState('');
    const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
    
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // Carregar bairros para o dropdown
    useEffect(() => {
        const loadHoods = async () => {
            if (user?.role === UserRole.ADMIN) {
                const hoods = await MockService.getNeighborhoods();
                setNeighborhoods(hoods);
                if(hoods.length > 0) setSelectedHoodId(hoods[0].id);
            }
        };
        loadHoods();
    }, [user]);

    // Redireciona se não for admin
    if (user?.role !== UserRole.ADMIN) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-full text-gray-500">
                    Acesso restrito a administradores.
                </div>
            </Layout>
        );
    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!message.trim()) return;

        setSending(true);
        setStatus(null);

        // Prefixo para deixar claro que é um comunicado oficial
        const formattedMessage = `📢 *ATALAIA - COMUNICADO OFICIAL*\n\n${message}\n\n_Enviado pela Administração Central_`;

        try {
            const result = await MockService.sendCustomBroadcast(
                formattedMessage, 
                targetType, 
                targetType === 'HOOD' ? selectedHoodId : undefined
            );
            
            if (result.sentCount > 0) {
                setStatus({ type: 'success', msg: `Mensagem enviada com sucesso para ${result.sentCount} números!` });
                setMessage(''); // Limpa o campo
            } else {
                setStatus({ type: 'error', msg: 'Nenhum destinatário válido encontrado para o filtro selecionado.' });
            }

        } catch (error: any) {
            setStatus({ type: 'error', msg: 'Erro ao enviar: ' + error.message });
        } finally {
            setSending(false);
        }
    };

    const handleQuickTest = async () => {
        setSending(true);
        try {
             // Envia apenas para o próprio admin
             if(user?.phone) {
                 await MockService.sendWhatsAppMessage("✅ *TESTE DE CONEXÃO ATALAIA*\n\nSe você recebeu esta mensagem, a API está operacional.", [user.phone.replace(/\D/g, '')]);
                 setStatus({ type: 'success', msg: 'Teste enviado para o seu número!' });
             } else {
                 setStatus({ type: 'error', msg: 'Seu perfil de Admin não tem telefone cadastrado para teste.' });
             }
        } catch (e: any) {
            setStatus({ type: 'error', msg: 'Teste falhou: ' + e.message });
        } finally {
            setSending(false);
        }
    };

    return (
        <Layout>
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <MessageSquare className="text-green-500" size={32} /> Central WhatsApp
                    </h1>
                    <p className="text-gray-400">Gerenciador de disparos e comunicados em massa.</p>
                </div>

                {/* STATUS BAR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                     <Card className="p-6 bg-[#0f1a12] border-green-900/50 flex items-center justify-between">
                         <div>
                             <h3 className="text-white font-bold flex items-center gap-2 mb-1">
                                 <Wifi size={18} className="text-green-500" /> Status da API
                             </h3>
                             <p className="text-xs text-gray-400">Whaticket Connector</p>
                         </div>
                         <Button onClick={handleQuickTest} disabled={sending} variant="outline" className="border-green-500/30 text-green-400 hover:text-green-300">
                             {sending ? <Loader2 className="animate-spin" /> : 'Testar Conexão'}
                         </Button>
                     </Card>

                     <Card className="p-6 bg-[#111] border-white/5 flex flex-col justify-center">
                         <div className="text-xs text-gray-500 uppercase font-bold mb-2">Servidor Conectado</div>
                         <div className="font-mono text-white text-sm bg-black p-2 rounded border border-gray-800 truncate">
                             whatsapp.atalaia.cloud
                         </div>
                     </Card>
                </div>

                {/* COMPOSER */}
                <Card className="p-6 md:p-8 border-atalaia-neon/20">
                    <form onSubmit={handleSendMessage}>
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Send size={20} className="text-atalaia-neon" /> Novo Comunicado
                        </h2>

                        {/* AUDIENCE SELECTOR */}
                        <div className="mb-6 bg-black/40 p-4 rounded-xl border border-white/10">
                            <label className="text-xs font-medium text-gray-400 mb-3 block uppercase tracking-wider">Destinatários</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <label className={`
                                    cursor-pointer border p-4 rounded-lg flex flex-col items-center gap-2 transition-all
                                    ${targetType === 'ADMINS' ? 'bg-atalaia-neon/10 border-atalaia-neon text-white' : 'border-gray-700 text-gray-500 hover:bg-white/5'}
                                `}>
                                    <input type="radio" className="hidden" name="target" checked={targetType === 'ADMINS'} onChange={() => setTargetType('ADMINS')} />
                                    <Shield size={24} />
                                    <span className="font-bold text-sm">Apenas Admins</span>
                                </label>

                                <label className={`
                                    cursor-pointer border p-4 rounded-lg flex flex-col items-center gap-2 transition-all
                                    ${targetType === 'HOOD' ? 'bg-blue-500/10 border-blue-500 text-white' : 'border-gray-700 text-gray-500 hover:bg-white/5'}
                                `}>
                                    <input type="radio" className="hidden" name="target" checked={targetType === 'HOOD'} onChange={() => setTargetType('HOOD')} />
                                    <MapPin size={24} />
                                    <span className="font-bold text-sm">Por Bairro</span>
                                </label>

                                <label className={`
                                    cursor-pointer border p-4 rounded-lg flex flex-col items-center gap-2 transition-all
                                    ${targetType === 'ALL' ? 'bg-red-500/10 border-red-500 text-white' : 'border-gray-700 text-gray-500 hover:bg-white/5'}
                                `}>
                                    <input type="radio" className="hidden" name="target" checked={targetType === 'ALL'} onChange={() => setTargetType('ALL')} />
                                    <Users size={24} />
                                    <span className="font-bold text-sm">Todos os Usuários</span>
                                </label>
                            </div>

                            {targetType === 'HOOD' && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                    <select 
                                        className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                                        value={selectedHoodId}
                                        onChange={(e) => setSelectedHoodId(e.target.value)}
                                    >
                                        {neighborhoods.map(h => (
                                            <option key={h.id} value={h.id}>{h.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* MESSAGE INPUT */}
                        <div className="mb-6">
                            <label className="text-xs font-medium text-gray-400 mb-2 block uppercase tracking-wider">Mensagem</label>
                            <textarea 
                                className="w-full h-40 bg-black/50 border border-atalaia-border rounded-xl p-4 text-white resize-none focus:border-atalaia-neon focus:outline-none transition-colors"
                                placeholder="Digite seu comunicado aqui..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                            <p className="text-[10px] text-gray-500 mt-2 text-right">
                                Dica: Use *texto* para negrito e _texto_ para itálico.
                            </p>
                        </div>

                        {/* ACTION BAR */}
                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                            <div className="flex-1">
                                {status && (
                                    <div className={`flex items-center gap-2 text-sm ${status.type === 'success' ? 'text-green-500' : 'text-red-500'} animate-in fade-in`}>
                                        {status.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
                                        {status.msg}
                                    </div>
                                )}
                            </div>
                            <Button type="submit" disabled={sending || !message.trim()} className="px-8 h-12">
                                {sending ? (
                                    <><Loader2 className="animate-spin mr-2" /> Enviando...</>
                                ) : (
                                    <><Send size={18} className="mr-2" /> Disparar Mensagem</>
                                )}
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </Layout>
    );
};

export default WhatsAppAdmin;