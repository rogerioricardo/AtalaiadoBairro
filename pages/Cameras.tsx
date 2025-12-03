
import React, { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { UserRole, Neighborhood, CameraProtocol, Plan, Camera } from '../types';
import { MockService } from '../services/mockService';
import { PaymentService } from '../services/paymentService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Video, Plus, Code, Eye, Lock, Check, MousePointerClick, Send, MapPin, Search, Trash2, AlertTriangle, Settings, List, ShieldCheck, Info, ChevronDown, Camera as CameraIcon, Maximize2, Minimize2, Edit2, X } from 'lucide-react';

const Cameras: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'view' | 'manage' | 'protocol'>('view');
  
  // Data State
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<Neighborhood | null>(null);
  
  // Multiple Cameras State
  const [cameras, setCameras] = useState<Camera[]>([]);
  
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // Form State (New Neighborhood)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newHoodName, setNewHoodName] = useState('');
  const [newHoodDesc, setNewHoodDesc] = useState(''); 

  // Form State (New/Edit Camera)
  const [selectedManageHoodId, setSelectedManageHoodId] = useState('');
  const [newCameraName, setNewCameraName] = useState('');
  const [newCameraCode, setNewCameraCode] = useState('');
  const [newCameraLat, setNewCameraLat] = useState('');
  const [newCameraLng, setNewCameraLng] = useState('');
  const [addingCamera, setAddingCamera] = useState(false);
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);

  // Protocol State
  const [protocolCameraName, setProtocolCameraName] = useState('');
  const [protocolLat, setProtocolLat] = useState('');
  const [protocolLng, setProtocolLng] = useState('');
  const [generatedProtocol, setGeneratedProtocol] = useState<CameraProtocol | null>(null);

  // Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [processingUpgrade, setProcessingUpgrade] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      // Load Plans for modal
      const availablePlans = await MockService.getPlans();
      setPlans(availablePlans.filter(p => p.id !== 'FREE'));

      if (user?.role === UserRole.ADMIN) {
        const hoods = await MockService.getNeighborhoods(true); // Force refresh for admin
        setNeighborhoods(hoods);
      } else if (user?.neighborhoodId) {
        const hood = await MockService.getNeighborhoodById(user.neighborhoodId);
        if (hood) {
            setNeighborhoods([hood]);
            setSelectedNeighborhood(hood); // Auto-select for resident
        }
      }
    };
    loadData();
  }, [user, activeTab]); 

  // Load cameras when a neighborhood is selected
  useEffect(() => {
      const loadCameras = async () => {
          if (selectedNeighborhood) {
              const extraCameras = await MockService.getAdditionalCameras(selectedNeighborhood.id);
              setCameras(extraCameras);
          } else if (selectedManageHoodId && activeTab === 'manage') {
              // Load cameras for management list
              const extraCameras = await MockService.getAdditionalCameras(selectedManageHoodId);
              setCameras(extraCameras);
          } else {
              setCameras([]);
          }
      };
      
      // Reset camera edit form if changing hood
      handleCancelCameraEdit();
      
      loadCameras();
  }, [selectedNeighborhood, selectedManageHoodId, activeTab]);

  const handleCreateNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    const description = newHoodDesc.trim();

    try {
        if (editingId) {
            await MockService.updateNeighborhood(editingId, newHoodName, description);
            alert('Bairro atualizado com sucesso!');
            setEditingId(null);
        } else {
            await MockService.createNeighborhood(newHoodName, description);
            alert('Bairro cadastrado com sucesso!');
        }

        const hoods = await MockService.getNeighborhoods(true);
        setNeighborhoods(hoods);
        
        // Reset form
        setNewHoodName('');
        setNewHoodDesc('');
        
    } catch (error: any) {
        alert('Erro ao salvar bairro: ' + error.message);
    }
  };

  const handleEditNeighborhood = (hood: Neighborhood, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingId(hood.id);
      setNewHoodName(hood.name);
      setNewHoodDesc(hood.description || '');
      // Scroll to top to see form
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setNewHoodName('');
      setNewHoodDesc('');
  };

  // --- CAMERA MANAGEMENT LOGIC ---

  const handleSaveCamera = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedManageHoodId) return;
      setAddingCamera(true);

      const lat = newCameraLat ? parseFloat(newCameraLat) : undefined;
      const lng = newCameraLng ? parseFloat(newCameraLng) : undefined;

      try {
          if (editingCameraId) {
              await MockService.updateCamera(editingCameraId, newCameraName, newCameraCode, lat, lng);
              alert('Câmera atualizada com sucesso!');
          } else {
              await MockService.addCamera(selectedManageHoodId, newCameraName, newCameraCode, lat, lng);
              alert('Câmera adicionada com sucesso!');
          }
          
          const updatedCameras = await MockService.getAdditionalCameras(selectedManageHoodId);
          setCameras(updatedCameras);
          
          handleCancelCameraEdit();

      } catch (e: any) {
          alert('Erro ao salvar câmera: ' + e.message);
      } finally {
          setAddingCamera(false);
      }
  };

  const handleEditCamera = (cam: Camera) => {
      setEditingCameraId(cam.id);
      setNewCameraName(cam.name);
      setNewCameraCode(cam.iframeCode);
      setNewCameraLat(cam.lat?.toString() || '');
      setNewCameraLng(cam.lng?.toString() || '');
      
      // Scroll to form if needed
      const formEl = document.getElementById('camera-form');
      if(formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelCameraEdit = () => {
      setEditingCameraId(null);
      setNewCameraName('');
      setNewCameraCode('');
      setNewCameraLat('');
      setNewCameraLng('');
  };

  const handleDeleteCamera = async (id: string) => {
      if (!window.confirm("Remover esta câmera?")) return;
      try {
          await MockService.deleteCamera(id);
          setCameras(prev => prev.filter(c => c.id !== id));
          if (editingCameraId === id) handleCancelCameraEdit();
      } catch(e: any) {
          alert("Erro ao remover: " + e.message);
      }
  };

  const handleResetCameras = async () => {
      const confirmText = "RESET-CAMERAS";
      const input = prompt(`ATENÇÃO: ISSO APAGARÁ TODAS AS CÂMERAS DO SISTEMA (Principais e Extras).\nOs bairros serão mantidos, mas ficarão sem vídeo.\n\nPara confirmar, digite "${confirmText}":`);
      
      if (input === confirmText) {
          try {
              await MockService.resetSystemCameras();
              const hoods = await MockService.getNeighborhoods(true);
              setNeighborhoods(hoods);
              setCameras([]);
              alert("Sistema de câmeras limpo com sucesso.");
          } catch (e: any) {
              alert("Erro ao limpar: " + e.message);
          }
      }
  };

  const handleDeleteNeighborhood = async (id: string, name: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Previne click no container
      
      const confirm1 = window.confirm(`ATENÇÃO: Deseja realmente excluir o bairro "${name}"?`);
      if (!confirm1) return;

      const confirm2 = window.confirm(`Isso apagará todas as câmeras, alertas, chats e configurações deste bairro. Confirmar exclusão?`);
      if (!confirm2) return;
      
      setDeletingId(id);
      try {
          await MockService.deleteNeighborhood(id);
          
          // Force update local state
          const newHoods = neighborhoods.filter(h => h.id !== id);
          setNeighborhoods(newHoods);
          
          if (selectedNeighborhood?.id === id) setSelectedNeighborhood(null);
          if (selectedManageHoodId === id) setSelectedManageHoodId('');
          
          alert('Bairro excluído com sucesso.');
      } catch (error: any) {
          alert('Erro ao excluir: ' + error.message);
      } finally {
          setDeletingId(null);
      }
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
          alert('Protocolo enviado com sucesso!');
          setGeneratedProtocol(null);
          setProtocolCameraName('');
          setProtocolLat('');
          setProtocolLng('');
      }
  };

  const handleUpgradePlan = async (planId: string) => {
      if (!user) return;
      setProcessingUpgrade(planId);
      try {
          const checkoutUrl = await PaymentService.createPreference(planId, user.email, user.name);
          window.location.href = checkoutUrl;
      } catch (error: any) {
          alert('Erro ao gerar pagamento: ' + error.message);
          setProcessingUpgrade(null);
      }
  };

  // Filter Neighborhoods
  const filteredNeighborhoods = neighborhoods.filter(h => 
      h.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const displayedNeighborhoods = searchTerm ? filteredNeighborhoods : filteredNeighborhoods.slice(0, 4);

  const isLocked = user?.role !== UserRole.ADMIN && 
                   user?.role !== UserRole.INTEGRATOR && 
                   user?.role !== UserRole.SCR && 
                   user?.plan === 'FREE';

  // Enhanced Universal Player that handles Raw HTML & Fullscreen
  const UniversalPlayer = ({ url }: { url: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    const toggleFullscreen = async () => {
        if (!containerRef.current) return;

        try {
            if (!document.fullscreenElement) {
                // Entrar em fullscreen
                await containerRef.current.requestFullscreen();
                
                // Tentar travar rotação em landscape no mobile
                try {
                    if (screen.orientation && 'lock' in screen.orientation) {
                        // @ts-ignore - lock method is standard but types might vary
                        await screen.orientation.lock('landscape');
                    }
                } catch (e) {
                    console.warn("Rotação automática não suportada pelo navegador ou dispositivo.");
                }
            } else {
                // Sair de fullscreen
                await document.exitFullscreen();
                // Destravar rotação
                try {
                    if (screen.orientation && 'unlock' in screen.orientation) {
                        screen.orientation.unlock();
                    }
                } catch (e) {}
            }
        } catch (err) {
            console.error("Erro ao alternar tela cheia:", err);
        }
    };

    if (!url) return null;

    // Detect if input is raw HTML (iframe tag)
    const isRawHtml = url.trim().startsWith('<iframe') || url.trim().startsWith('<div');
    const isDirectVideo = url.match(/\.(mp4|webm|ogg|m3u8)$/i);
    
    return (
        <div 
            ref={containerRef}
            className={`w-full bg-black overflow-hidden border border-atalaia-border relative shadow-[0_0_30px_rgba(0,0,0,0.5)] aspect-video group ${isFullscreen ? 'flex items-center justify-center' : 'rounded-xl'}`}
        >
             {isRawHtml ? (
                 <div 
                    className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
                    dangerouslySetInnerHTML={{ __html: url }}
                 />
             ) : isDirectVideo ? (
                 <video src={url} controls autoPlay muted loop className="w-full h-full object-cover" />
             ) : (
                <iframe 
                    src={url}
                    className="w-full h-full bg-black"
                    frameBorder="0"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    title="Camera Feed"
                />
             )}
             
             {/* Controls Overlay - ICON ONLY, NO TEXT */}
             <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 z-50">
                 {/* Fullscreen Button */}
                 <button 
                    onClick={toggleFullscreen}
                    className="bg-black/70 hover:bg-atalaia-neon hover:text-black text-white p-2 rounded-lg backdrop-blur-sm transition-all shadow-lg"
                    title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                 >
                    {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                 </button>
             </div>

             {/* Live indicator */}
             <div className="absolute top-4 left-4 pointer-events-none z-40">
                 <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse shadow-lg flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    AO VIVO
                </div>
             </div>
        </div>
    );
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
           <h1 className="text-3xl font-bold text-white">Monitoramento</h1>
           <p className="text-gray-400">Sistema de vigilância visual integrado.</p>
        </div>
        
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
                        onClick={() => setActiveTab('manage')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'manage' ? 'bg-atalaia-neon text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-2"><Settings size={16} /> Gestão de Bairros</div>
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
              {isLocked ? (
                <div className="flex flex-col items-center justify-center p-16 border border-atalaia-border border-dashed rounded-2xl bg-[#0a0a0a] text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-atalaia-neon/5 blur-[100px]" />
                    <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center mb-6 border border-gray-800 relative z-10">
                        <Lock size={40} className="text-gray-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2 relative z-10">Recurso Bloqueado</h2>
                    <p className="text-gray-400 mb-6 max-w-md relative z-10">
                        O monitoramento de câmeras está disponível apenas para os planos Família e Prêmio.
                    </p>
                    <Button onClick={() => setShowUpgradeModal(true)} className="relative z-10 px-8 py-3">
                        <ShieldCheck size={18} className="mr-2" />
                        Fazer Upgrade Agora
                    </Button>
                </div>
              ) : (
                <>
                  {/* Search Bar - ADMIN ONLY */}
                  {user?.role === UserRole.ADMIN && (
                      <div className="relative mb-4">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                          <input 
                              type="text" 
                              placeholder="Buscar bairro..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full bg-black/50 border border-atalaia-border rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-atalaia-neon"
                          />
                      </div>
                  )}

                  {/* Instructional Banner - VISIBLE TO ALL */}
                  <div className="bg-[#111] border border-atalaia-border p-4 rounded-xl flex items-start gap-3 mb-6">
                        <div className="bg-atalaia-neon/10 p-2 rounded-lg text-atalaia-neon shrink-0">
                            <MousePointerClick size={20} />
                        </div>
                        <div>
                            <h4 className="text-white font-bold text-sm">Central de Câmeras</h4>
                            <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                                Selecione um bairro abaixo para visualizar todas as câmeras disponíveis em tempo real.
                            </p>
                        </div>
                  </div>

                  {/* Neighborhood Selector Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                      {displayedNeighborhoods.map(hood => (
                          <div 
                            key={hood.id}
                            onClick={() => setSelectedNeighborhood(hood)}
                            className={`
                                relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all
                                ${selectedNeighborhood?.id === hood.id 
                                    ? 'bg-atalaia-neon/10 border-atalaia-neon' 
                                    : 'bg-[#111] border-white/5 hover:bg-[#151515]'
                                }
                            `}
                          >
                              <div className="flex items-center gap-3 mb-2">
                                  <Video size={20} className={selectedNeighborhood?.id === hood.id ? 'text-atalaia-neon' : 'text-gray-400'} />
                                  <h3 className="font-bold truncate text-white">{hood.name}</h3>
                              </div>
                              <p className="text-xs text-gray-500">
                                  {selectedNeighborhood?.id === hood.id ? 'Selecionado' : 'Clique para visualizar'}
                              </p>
                          </div>
                      ))}
                  </div>

                  {selectedNeighborhood ? (
                      <div className="animate-in fade-in zoom-in duration-300 mt-4">
                          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
                             <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                                <Video className="text-atalaia-neon" /> {selectedNeighborhood.name}
                             </h2>
                             {selectedNeighborhood.description && (
                                 <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
                                     <Info size={12} className="inline mr-1" /> {selectedNeighborhood.description}
                                 </span>
                             )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Main Camera (Legacy) - Kept for compatibility but optional */}
                              {selectedNeighborhood.iframeUrl && (
                                  <div>
                                      <p className="text-sm font-bold text-gray-400 mb-2 uppercase">Câmera Principal</p>
                                      <UniversalPlayer url={selectedNeighborhood.iframeUrl} />
                                  </div>
                              )}

                              {/* Additional Cameras */}
                              {cameras.map(cam => (
                                  <div key={cam.id}>
                                      <p className="text-sm font-bold text-gray-400 mb-2 uppercase flex justify-between">
                                          {cam.name}
                                          {cam.lat && cam.lng && <span className="text-[10px] bg-gray-800 px-1 rounded flex items-center"><MapPin size={8} className="mr-1"/>Localizada</span>}
                                      </p>
                                      <UniversalPlayer url={cam.iframeCode} />
                                  </div>
                              ))}

                              {/* Placeholder if no cameras */}
                              {!selectedNeighborhood.iframeUrl && cameras.length === 0 && (
                                  <div className="col-span-2 h-40 flex items-center justify-center border border-dashed border-gray-800 rounded-xl bg-black/20 text-gray-500">
                                      Nenhuma câmera configurada para este bairro ainda.
                                  </div>
                              )}
                          </div>
                      </div>
                  ) : (
                      <div className="h-40 flex items-center justify-center border border-dashed border-gray-800 rounded-xl bg-black/20">
                          <p className="text-gray-500">Selecione um bairro acima para ver as câmeras.</p>
                      </div>
                  )}
                </>
              )}
          </div>
      )}

      {/* MANAGE MODE (ADMIN) */}
      {activeTab === 'manage' && user?.role === UserRole.ADMIN && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Create/Edit Neighborhood */}
              <div className="space-y-6">
                  <Card className="p-6 border-atalaia-neon/20">
                      <div className="flex justify-between items-center mb-4">
                          <h2 className="text-lg font-bold text-white flex items-center gap-2">
                              {editingId ? <Edit2 size={18} className="text-atalaia-neon" /> : <Plus size={18} className="text-atalaia-neon" />} 
                              {editingId ? 'Editar Bairro' : 'Novo Bairro'}
                          </h2>
                          {editingId && (
                              <button onClick={handleCancelEdit} className="text-gray-400 hover:text-white flex items-center gap-1 text-xs">
                                  <X size={14} /> Cancelar
                              </button>
                          )}
                      </div>

                      <form onSubmit={handleCreateNeighborhood} className="space-y-4">
                          <Input 
                            label="Nome do Bairro" 
                            value={newHoodName} 
                            onChange={e => setNewHoodName(e.target.value)} 
                            placeholder="Ex: Centro"
                            required
                          />
                          <div>
                            <label className="text-xs font-medium text-gray-400 mb-1 block uppercase">Informações / Descrição</label>
                            <textarea 
                                className="w-full bg-black/50 border border-atalaia-border rounded-lg px-3 py-2 text-white text-xs h-32 focus:border-atalaia-neon focus:outline-none resize-none"
                                placeholder='Ex: Rua principal, área residencial, contatos do posto local...'
                                value={newHoodDesc}
                                onChange={e => setNewHoodDesc(e.target.value)}
                            />
                            <p className="text-[10px] text-gray-500 mt-1">
                                {editingId ? 'Altere os dados e salve.' : 'Crie o bairro primeiro, depois adicione as câmeras.'}
                            </p>
                          </div>
                          <Button type="submit" className="w-full" variant={editingId ? 'secondary' : 'primary'}>
                              {editingId ? 'Atualizar Bairro' : 'Cadastrar Bairro'}
                          </Button>
                      </form>
                  </Card>

                   {/* DANGER ZONE - Reset Cameras */}
                   <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-xl">
                      <h3 className="text-red-500 font-bold mb-2 flex items-center gap-2">
                          <AlertTriangle size={18} /> Zona de Perigo
                      </h3>
                      <p className="text-xs text-gray-400 mb-3">
                          Precisa limpar todas as câmeras para recomeçar?
                      </p>
                      <button 
                          onClick={handleResetCameras}
                          className="text-xs bg-red-900/20 text-red-400 border border-red-900/40 px-3 py-2 rounded hover:bg-red-900/40 transition-colors w-full"
                      >
                          Resetar Sistema de Câmeras
                      </button>
                  </div>

                  {/* Neighborhood List & Delete */}
                  <Card className="p-0 overflow-hidden max-h-96 overflow-y-auto">
                      <div className="p-4 border-b border-white/10 bg-[#151515]">
                          <h2 className="font-bold text-white flex items-center gap-2">
                              <List size={18} className="text-atalaia-neon" /> Bairros Existentes
                          </h2>
                      </div>
                      <table className="w-full text-left text-sm text-gray-400">
                          <tbody className="divide-y divide-white/5">
                              {neighborhoods.map((hood) => (
                                  <tr key={hood.id} className={`hover:bg-white/5 ${editingId === hood.id ? 'bg-atalaia-neon/5' : ''}`}>
                                      <td className="px-4 py-3 font-medium text-white">
                                          {hood.name}
                                          {hood.description && <span className="block text-xs text-gray-500 mt-1 truncate max-w-[200px]">{hood.description}</span>}
                                      </td>
                                      <td className="px-4 py-3 text-right flex justify-end gap-2">
                                          <button 
                                              onClick={(e) => handleEditNeighborhood(hood, e)}
                                              className="text-blue-500 hover:text-white p-1 rounded hover:bg-blue-500/20"
                                              title="Editar Bairro"
                                          >
                                              <Edit2 size={16} />
                                          </button>
                                          <button 
                                              onClick={(e) => handleDeleteNeighborhood(hood.id, hood.name, e)}
                                              disabled={deletingId === hood.id}
                                              className="text-red-500 hover:text-white p-1 rounded hover:bg-red-500/20"
                                              title="Excluir Bairro Permanentemente"
                                          >
                                              {deletingId === hood.id ? '...' : <Trash2 size={16} />}
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </Card>
              </div>

              {/* Right Column: Manage Cameras within Neighborhood */}
              <div className="space-y-6">
                  <Card className="p-6">
                      <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
                          <CameraIcon size={18} className={editingCameraId ? "text-blue-500" : "text-yellow-500"} /> 
                          {editingCameraId ? 'Editar Câmera' : 'Adicionar Câmera Extra'}
                      </h2>
                      <div className="mb-4">
                          <label className="text-xs font-medium text-gray-400 mb-1 block uppercase">Selecione o Bairro</label>
                          <select 
                              className="w-full bg-black/50 border border-atalaia-border rounded-lg px-4 py-2.5 text-white focus:border-atalaia-neon focus:outline-none"
                              value={selectedManageHoodId}
                              onChange={(e) => setSelectedManageHoodId(e.target.value)}
                          >
                              <option value="">Selecione...</option>
                              {neighborhoods.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                          </select>
                      </div>

                      {selectedManageHoodId && (
                          <div className="animate-in fade-in">
                              <form id="camera-form" onSubmit={handleSaveCamera} className="space-y-4 border-b border-white/10 pb-6 mb-6">
                                  <div className="flex justify-between items-center">
                                      <h4 className="text-xs uppercase font-bold text-gray-500">Dados da Câmera</h4>
                                      {editingCameraId && (
                                          <button type="button" onClick={handleCancelCameraEdit} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                                              <X size={12}/> Cancelar
                                          </button>
                                      )}
                                  </div>
                                  <Input 
                                      label="Nome da Câmera"
                                      placeholder="Ex: Portaria Lateral"
                                      value={newCameraName}
                                      onChange={e => setNewCameraName(e.target.value)}
                                      required
                                  />
                                  <div className="grid grid-cols-2 gap-2">
                                      <Input label="Latitude" value={newCameraLat} onChange={e => setNewCameraLat(e.target.value)} type="number" step="any"/>
                                      <Input label="Longitude" value={newCameraLng} onChange={e => setNewCameraLng(e.target.value)} type="number" step="any"/>
                                  </div>
                                  <div>
                                      <label className="text-xs font-medium text-gray-400 mb-1 block uppercase">Código do Iframe</label>
                                      <textarea 
                                          className="w-full bg-black/50 border border-atalaia-border rounded-lg px-3 py-2 text-white text-xs h-24 focus:border-atalaia-neon focus:outline-none resize-none font-mono"
                                          placeholder='<iframe src="..."></iframe>'
                                          value={newCameraCode}
                                          onChange={e => setNewCameraCode(e.target.value)}
                                          required
                                      />
                                  </div>
                                  <Button type="submit" disabled={addingCamera} className="w-full" variant={editingCameraId ? "primary" : "secondary"}>
                                      {addingCamera ? 'Salvando...' : (editingCameraId ? 'Atualizar Câmera' : 'Adicionar Câmera')}
                                  </Button>
                              </form>

                              {/* List of Cameras in Selected Hood */}
                              <h3 className="font-bold text-gray-300 text-sm mb-2">Câmeras neste Bairro:</h3>
                              <div className="space-y-2">
                                  {cameras.map(cam => (
                                      <div key={cam.id} className={`flex items-center justify-between bg-black/40 p-3 rounded border ${editingCameraId === cam.id ? 'border-atalaia-neon/50 bg-atalaia-neon/5' : 'border-white/5'}`}>
                                          <div className="flex items-center gap-2">
                                              <Video size={14} className="text-gray-500"/>
                                              <span className="text-sm font-medium text-white">{cam.name}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <button 
                                                  onClick={() => handleEditCamera(cam)} 
                                                  className="text-blue-500 hover:text-white text-xs p-1 rounded hover:bg-blue-500/20"
                                                  title="Editar Câmera"
                                              >
                                                  <Edit2 size={14} />
                                              </button>
                                              <button 
                                                  onClick={() => handleDeleteCamera(cam.id)} 
                                                  className="text-red-500 hover:text-white text-xs p-1 rounded hover:bg-red-500/20"
                                                  title="Remover Câmera"
                                              >
                                                  <Trash2 size={14} />
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                                  {cameras.length === 0 && <p className="text-xs text-gray-600 italic">Nenhuma câmera extra.</p>}
                              </div>
                          </div>
                      )}
                  </Card>
              </div>
          </div>
      )}

      {/* PROTOCOL MODE (INTEGRATOR) */}
      {activeTab === 'protocol' && user?.role === UserRole.INTEGRATOR && (
          <Card className="max-w-2xl mx-auto p-8">
              <h2 className="text-xl font-bold mb-6 text-white">Gerador de Protocolos</h2>
              <form onSubmit={handleGenerateProtocol} className="space-y-6">
                  <Input 
                    label="Nome da Câmera" 
                    placeholder="cam01portaria"
                    value={protocolCameraName}
                    onChange={e => setProtocolCameraName(e.target.value.toLowerCase())}
                    required
                  />
                  <div className="grid grid-cols-2 gap-4">
                      <Input label="Latitude" value={protocolLat} onChange={e => setProtocolLat(e.target.value)} type="number" step="any" />
                      <Input label="Longitude" value={protocolLng} onChange={e => setProtocolLng(e.target.value)} type="number" step="any" />
                  </div>
                  <Button type="submit" className="w-full">Gerar e Revisar</Button>
              </form>
              {generatedProtocol && (
                  <div className="mt-8 p-6 bg-black/40 rounded-xl border border-atalaia-border animate-in slide-in-from-bottom-2">
                       <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3 text-yellow-500">
                           <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                           <p className="text-sm font-medium">
                               Atenção: Copie e cole o protocolo <strong>RTMP</strong> nas configurações de transmissão da sua câmera para conectar.
                           </p>
                       </div>

                       <h3 className="font-bold text-atalaia-neon mb-4">Gerado:</h3>
                       <div className="space-y-2 mb-4 font-mono text-xs text-gray-300">
                           <div className="bg-black p-2 border border-gray-800 rounded">{generatedProtocol.rtmp}</div>
                           <div className="bg-black p-2 border border-gray-800 rounded">{generatedProtocol.rtsp}</div>
                       </div>
                       <Button onClick={handleSendToAdmin} variant="secondary" className="w-full flex items-center justify-center gap-2">
                          <Send size={18} /> Enviar para Admin
                      </Button>
                  </div>
              )}
          </Card>
      )}

      {/* UPGRADE MODAL */}
      <Modal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)}>
        <div className="p-2">
            <h2 className="text-2xl font-bold text-white mb-2 text-center">Desbloquear Monitoramento</h2>
            <p className="text-gray-400 mb-6 text-center text-sm">Escolha um plano para acessar as câmeras em tempo real.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {plans.map(plan => (
                    <div 
                        key={plan.id} 
                        className={`
                            border rounded-xl p-6 relative flex flex-col justify-between transition-all hover:-translate-y-1
                            ${plan.id === 'FAMILY' ? 'bg-[#0f1a12] border-atalaia-neon/50 shadow-[0_0_15px_rgba(0,255,102,0.1)]' : 'bg-[#111] border-white/10 hover:border-white/30'}
                        `}
                    >
                        {plan.id === 'FAMILY' && (
                             <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-atalaia-neon text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase">
                                 Mais Escolhido
                             </div>
                        )}
                        
                        <div>
                            <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                            <div className="flex items-end gap-1 my-3">
                                <span className={`text-3xl font-bold ${plan.id === 'FAMILY' ? 'text-atalaia-neon' : 'text-white'}`}>
                                    R$ {plan.price}
                                </span>
                                <span className="text-xs text-gray-500 mb-1">/mês</span>
                            </div>
                            <ul className="space-y-2 text-xs text-gray-300 mb-6">
                                {plan.features.slice(0, 4).map((f, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                        <Check size={12} className="text-atalaia-neon" /> {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <Button 
                            onClick={() => handleUpgradePlan(plan.id)}
                            disabled={!!processingUpgrade}
                            variant={plan.id === 'FAMILY' ? 'primary' : 'outline'}
                            className="w-full text-sm"
                        >
                            {processingUpgrade === plan.id ? 'Gerando Pagamento...' : `Assinar ${plan.name}`}
                        </Button>
                    </div>
                ))}
            </div>
            {plans.length === 0 && (
                <p className="text-center text-gray-500 py-8">Carregando planos...</p>
            )}

            {/* Mercado Pago Badge Inside Modal - IMPROVED */}
            <div className="flex flex-col items-center justify-center pt-6 border-t border-white/10 mt-2">
               <div className="bg-white px-6 py-3 rounded-lg shadow-inner mb-3">
                   <img 
                        src="https://logodownload.org/wp-content/uploads/2019/06/mercado-pago-logo.png" 
                        alt="Mercado Pago" 
                        className="h-6 object-contain"
                   />
               </div>
               <div className="flex gap-4 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                   <span>🔒 Compra 100% Segura</span>
                   <span>⚡ Liberação Imediata</span>
               </div>
            </div>
        </div>
      </Modal>

    </Layout>
  );
};

export default Cameras;
