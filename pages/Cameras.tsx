

import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { UserRole, Neighborhood, CameraProtocol } from '../types';
import { MockService } from '../services/mockService';
import { Card, Button, Input, Modal } from '../components/UI';
import { Video, Plus, Code, Eye, Lock, Check, MousePointerClick, Send, MapPin } from 'lucide-react';

const Cameras: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'view' | 'insert' | 'protocol'>('view');
  
  // Data State
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<Neighborhood | null>(null);
  
  // Form State
  const [newHoodName, setNewHoodName] = useState('');
  const [newHoodIframe, setNewHoodIframe] = useState('');
  const [newHoodLat, setNewHoodLat] = useState('');
  const [newHoodLng, setNewHoodLng] = useState('');

  // Protocol State
  const [protocolCameraName, setProtocolCameraName] = useState('');
  const [protocolLat, setProtocolLat] = useState('');
  const [protocolLng, setProtocolLng] = useState('');
  const [generatedProtocol, setGeneratedProtocol] = useState<CameraProtocol | null>(null);

  // Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (user?.role === UserRole.ADMIN) {
        const hoods = await MockService.getNeighborhoods();
        setNeighborhoods(hoods);
      } else if (user?.neighborhoodId) {
        const hood = await MockService.getNeighborhoodById(user.neighborhoodId);
        if (hood) {
            setNeighborhoods([hood]);
            setSelectedNeighborhood(hood);
        }
      }
    };
    loadData();
  }, [user]);

  const handleCreateNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = newHoodLat ? parseFloat(newHoodLat) : undefined;
    const lng = newHoodLng ? parseFloat(newHoodLng) : undefined;

    await MockService.createNeighborhood(newHoodName, newHoodIframe, lat, lng);
    
    const hoods = await MockService.getNeighborhoods();
    setNeighborhoods(hoods);
    
    // Reset form
    setNewHoodName('');
    setNewHoodIframe('');
    setNewHoodLat('');
    setNewHoodLng('');
    
    alert('Bairro e coordenadas criados com sucesso!');
    setActiveTab('view');
  };

  const handleGenerateProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!protocolCameraName) return;
    
    const lat = protocolLat ? parseFloat(protocolLat) : undefined;
    const lng = protocolLng ? parseFloat(protocolLng) : undefined;

    const protocol = await MockService.generateProtocol(protocolCameraName.toLowerCase(), lat, lng);
    setGeneratedProtocol(protocol);
  };

  const handleSendToAdmin = async () => {
      if (generatedProtocol && user) {
          await MockService.sendProtocolToAdmin(generatedProtocol, user.name);
          alert('Protocolo e coordenadas enviados com sucesso para o Administrador Master!');
          setGeneratedProtocol(null);
          setProtocolCameraName('');
          setProtocolLat('');
          setProtocolLng('');
      }
  };

  const isFreePlan = user?.plan === 'FREE';

  // Iframe Component to ensure correct aspect ratio and security
  const CameraIframe = ({ url }: { url: string }) => (
    <div className="w-full bg-black rounded-xl overflow-hidden border border-atalaia-border relative shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        {/* Aspect Ratio Wrapper 16:9 */}
        <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%' }}>
            <iframe 
                src={url}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                frameBorder="0"
                allowFullScreen
                title="Camera Feed"
            ></iframe>
        </div>
        <div className="absolute top-4 right-4 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded animate-pulse">
            AO VIVO
        </div>
    </div>
  );

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
           <h1 className="text-3xl font-bold text-white">Monitoramento</h1>
           <p className="text-gray-400">Sistema de vigilância visual integrado.</p>
        </div>
        
        {/* Action Buttons based on Role - Scrollable on mobile */}
        <div className="w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <div className="flex bg-[#111] p-1 rounded-lg border border-atalaia-border w-max md:w-auto">
                <button 
                    onClick={() => setActiveTab('view')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'view' ? 'bg-atalaia-neon text-black' : 'text-gray-400 hover:text-white'}`}
                >
                    <div className="flex items-center gap-2"><Eye size={16} /> Visualizar</div>
                </button>
                
                {user?.role === UserRole.ADMIN && (
                    <button 
                        onClick={() => setActiveTab('insert')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'insert' ? 'bg-atalaia-neon text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-2"><Plus size={16} /> Inserir Bairro</div>
                    </button>
                )}
                
                {user?.role === UserRole.INTEGRATOR && (
                    <button 
                        onClick={() => setActiveTab('protocol')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'protocol' ? 'bg-atalaia-neon text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-2"><Code size={16} /> Protocolos</div>
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* VIEW MODE */}
      {activeTab === 'view' && (
          <div className="space-y-6">
              {/* Plan Blocking Logic */}
              {isFreePlan ? (
                <div className="flex flex-col items-center justify-center p-8 md:p-16 border border-atalaia-border border-dashed rounded-2xl bg-[#0a0a0a] text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-atalaia-neon/5 blur-[100px]" />
                    <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center mb-6 border border-gray-800 relative z-10">
                        <Lock size={40} className="text-gray-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2 relative z-10">Recurso Bloqueado</h2>
                    <p className="text-gray-400 max-w-md mb-8 relative z-10">
                        O monitoramento de câmeras em tempo real é exclusivo para membros dos planos Família ou Prêmio.
                    </p>
                    <Button onClick={() => setShowUpgradeModal(true)} className="relative z-10 px-8 py-3 text-lg">
                        Fazer Upgrade Agora
                    </Button>
                </div>
              ) : (
                <>
                  {user?.role === UserRole.ADMIN && (
                      <div className="mb-6">
                          <p className="text-sm text-gray-400 mb-3 flex items-center gap-2 animate-in fade-in">
                             <MousePointerClick size={16} className="text-atalaia-neon" /> 
                             <span className="font-medium">Clique na câmera desejada para visualizar a câmera:</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                              {neighborhoods.map(hood => (
                                  <button
                                    key={hood.id}
                                    onClick={() => setSelectedNeighborhood(hood)}
                                    className={`px-4 py-2 rounded-lg border text-sm transition-colors ${selectedNeighborhood?.id === hood.id ? 'bg-atalaia-neon/20 border-atalaia-neon text-white' : 'bg-black/40 border-atalaia-border text-gray-400'}`}
                                  >
                                      {hood.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  {selectedNeighborhood ? (
                      <div className="animate-in fade-in zoom-in duration-300">
                          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                              <Video className="text-atalaia-neon" /> 
                              {selectedNeighborhood.name}
                          </h2>
                          <CameraIframe url={selectedNeighborhood.iframeUrl} />
                      </div>
                  ) : (
                      <div className="h-64 flex items-center justify-center border border-dashed border-gray-700 rounded-xl bg-black/20">
                          <p className="text-gray-500">Selecione um bairro para visualizar as câmeras.</p>
                      </div>
                  )}
                </>
              )}
          </div>
      )}

      {/* INSERT MODE (ADMIN) */}
      {activeTab === 'insert' && user?.role === UserRole.ADMIN && (
          <Card className="max-w-2xl mx-auto p-8">
              <h2 className="text-xl font-bold mb-6 text-white">Novo Bairro Monitorado</h2>
              <form onSubmit={handleCreateNeighborhood} className="space-y-6">
                  <Input 
                    label="Nome do Bairro" 
                    value={newHoodName} 
                    onChange={e => setNewHoodName(e.target.value)} 
                    placeholder="Ex: Jardim Paulista"
                    required
                  />
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">URL do Iframe</label>
                    <textarea 
                        className="w-full bg-black/50 border border-atalaia-border rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-atalaia-neon focus:ring-1 focus:ring-atalaia-neon h-32 font-mono text-sm"
                        placeholder="Cole a URL ou o código do iframe aqui..."
                        value={newHoodIframe}
                        onChange={e => setNewHoodIframe(e.target.value)}
                        required
                    />
                    <p className="text-xs text-gray-500 mt-2">O sistema extrairá a URL automaticamente se você colar a tag &lt;iframe&gt; completa.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                           <h4 className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                               <MapPin size={16} className="text-atalaia-neon"/> Localização no Mapa Comunitário
                           </h4>
                      </div>
                      <Input 
                        label="Latitude" 
                        value={newHoodLat} 
                        onChange={e => setNewHoodLat(e.target.value)} 
                        placeholder="-27.5935"
                        type="number"
                        step="any"
                      />
                      <Input 
                        label="Longitude" 
                        value={newHoodLng} 
                        onChange={e => setNewHoodLng(e.target.value)} 
                        placeholder="-48.5585"
                        type="number"
                        step="any"
                      />
                      <p className="col-span-2 text-xs text-gray-500">
                          Preencha para exibir o ícone da câmera no mapa. (Ex: Google Maps)
                      </p>
                  </div>
                  
                  <div className="flex justify-end pt-4">
                      <Button type="submit">Cadastrar Bairro</Button>
                  </div>
              </form>
          </Card>
      )}

      {/* PROTOCOL MODE (INTEGRATOR) */}
      {activeTab === 'protocol' && user?.role === UserRole.INTEGRATOR && (
          <Card className="max-w-2xl mx-auto p-8">
              <h2 className="text-xl font-bold mb-6 text-white">Gerador de Protocolos</h2>
              <p className="text-gray-400 mb-6">Preencha os dados da câmera para gerar os links de transmissão e enviar ao administrador.</p>
              
              <form onSubmit={handleGenerateProtocol} className="space-y-6">
                  <Input 
                    label="Nome da Câmera" 
                    placeholder="cam01portaria"
                    value={protocolCameraName}
                    onChange={e => setProtocolCameraName(e.target.value.toLowerCase())}
                    required
                  />
                  <p className="text-xs text-yellow-500/80 -mt-4 mb-4">Use apenas letras minúsculas e números.</p>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                      <div className="col-span-2">
                          <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                             <MapPin size={16} className="text-atalaia-neon"/> Coordenadas Geográficas
                          </label>
                          <p className="text-xs text-gray-500 mt-1">Copie do Google Maps para o mapa comunitário.</p>
                      </div>
                      <Input 
                        label="Latitude" 
                        value={protocolLat} 
                        onChange={e => setProtocolLat(e.target.value)} 
                        placeholder="-27.5935"
                        type="number"
                        step="any"
                      />
                      <Input 
                        label="Longitude" 
                        value={protocolLng} 
                        onChange={e => setProtocolLng(e.target.value)} 
                        placeholder="-48.5585"
                        type="number"
                        step="any"
                      />
                  </div>

                  <Button type="submit" className="w-full">Gerar Protocolos e Revisar</Button>
              </form>

              {generatedProtocol && (
                  <div className="mt-8 p-6 bg-black/40 rounded-xl border border-atalaia-border animate-in slide-in-from-bottom-2">
                      <h3 className="font-bold text-atalaia-neon mb-4">Protocolos Gerados:</h3>
                      
                      <div className="space-y-4 mb-6">
                          <div>
                              <label className="text-xs text-gray-500 uppercase">RTMP (Streaming)</label>
                              <div className="flex items-center gap-2 bg-black border border-gray-800 p-2 rounded text-sm font-mono text-gray-300">
                                  <span className="truncate flex-1">{generatedProtocol.rtmp}</span>
                                  <button onClick={() => navigator.clipboard.writeText(generatedProtocol.rtmp)} className="text-atalaia-neon hover:text-white text-xs uppercase font-bold">Copiar</button>
                              </div>
                          </div>
                          
                          <div>
                              <label className="text-xs text-gray-500 uppercase">RTSP (Integração)</label>
                              <div className="flex items-center gap-2 bg-black border border-gray-800 p-2 rounded text-sm font-mono text-gray-300">
                                  <span className="truncate flex-1">{generatedProtocol.rtsp}</span>
                                  <button onClick={() => navigator.clipboard.writeText(generatedProtocol.rtsp)} className="text-atalaia-neon hover:text-white text-xs uppercase font-bold">Copiar</button>
                              </div>
                          </div>

                          {(generatedProtocol.lat || generatedProtocol.lng) && (
                              <div className="grid grid-cols-2 gap-2">
                                  <div>
                                      <label className="text-xs text-gray-500 uppercase">Latitude</label>
                                      <div className="bg-black border border-gray-800 p-2 rounded text-sm font-mono text-gray-300">{generatedProtocol.lat}</div>
                                  </div>
                                  <div>
                                      <label className="text-xs text-gray-500 uppercase">Longitude</label>
                                      <div className="bg-black border border-gray-800 p-2 rounded text-sm font-mono text-gray-300">{generatedProtocol.lng}</div>
                                  </div>
                              </div>
                          )}
                      </div>

                      <Button onClick={handleSendToAdmin} variant="secondary" className="w-full flex items-center justify-center gap-2">
                          <Send size={18} /> Enviar para Admin Master
                      </Button>
                  </div>
              )}
          </Card>
      )}

      {/* UPGRADE MODAL */}
      <Modal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)}>
        <div className="p-6">
            <h2 className="text-2xl font-bold text-white text-center mb-2">Desbloqueie o Monitoramento</h2>
            <p className="text-gray-400 text-center mb-8">Escolha um plano para acessar as câmeras em tempo real.</p>
            
            <div className="grid md:grid-cols-2 gap-6">
                {/* Family Plan */}
                <div className="border border-atalaia-neon rounded-xl p-6 bg-atalaia-neon/5 relative">
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-atalaia-neon text-black text-[10px] font-bold px-2 py-0.5 rounded-b">RECOMENDADO</div>
                     <h3 className="text-lg font-bold text-white mb-2">Família</h3>
                     <div className="text-2xl font-bold text-atalaia-neon mb-4">R$ 39,90<span className="text-xs text-gray-500 font-normal">/mês</span></div>
                     <ul className="space-y-2 mb-6">
                        <li className="flex items-center gap-2 text-sm text-gray-300"><Check size={14} className="text-atalaia-neon" /> Acesso a Câmeras</li>
                        <li className="flex items-center gap-2 text-sm text-gray-300"><Check size={14} className="text-atalaia-neon" /> Histórico de 30 dias</li>
                        <li className="flex items-center gap-2 text-sm text-gray-300"><Check size={14} className="text-atalaia-neon" /> Alertas Ilimitados</li>
                     </ul>
                     <Button className="w-full py-2 text-sm">Escolher Família</Button>
                </div>

                {/* Premium Plan */}
                <div className="border border-white/10 rounded-xl p-6 bg-[#0a0a0a]">
                     <h3 className="text-lg font-bold text-white mb-2">Prêmio</h3>
                     <div className="text-2xl font-bold text-white mb-4">R$ 79,90<span className="text-xs text-gray-500 font-normal">/mês</span></div>
                     <ul className="space-y-2 mb-6">
                        <li className="flex items-center gap-2 text-sm text-gray-300"><Check size={14} className="text-gray-500" /> Tudo do plano Família</li>
                        <li className="flex items-center gap-2 text-sm text-gray-300"><Check size={14} className="text-gray-500" /> IA Detectora de Anomalias</li>
                        <li className="flex items-center gap-2 text-sm text-gray-300"><Check size={14} className="text-gray-500" /> Câmeras Ilimitadas</li>
                     </ul>
                     <Button variant="outline" className="w-full py-2 text-sm">Escolher Prêmio</Button>
                </div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-6">Pagamento seguro via Cartão ou PIX. Cancele quando quiser.</p>
        </div>
      </Modal>

    </Layout>
  );
};

export default Cameras;