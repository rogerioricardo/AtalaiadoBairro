

import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { User, UserRole, Neighborhood } from '../types';
import { MockService } from '../services/mockService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { UserPlus, Trash2, Mail, Phone, MapPin, Users, Search, Lock, CreditCard, Save, Link as LinkIcon, Filter, ShieldCheck, Home, ArrowUpCircle, CheckCircle, Edit2, ChevronDown, Loader2, XCircle, Wrench, UserCheck } from 'lucide-react';

const IntegratorUsers: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [residents, setResidents] = useState<User[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Admin Filter State
  const [adminFilterHood, setAdminFilterHood] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // New User Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newHoodId, setNewHoodId] = useState(''); // Only used by Admin

  // Edit User Form State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editHoodId, setEditHoodId] = useState('');

  // Payment Config State
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  // Loading state for individual row updates (Plan change)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(false);
  
  // POPUP FEEDBACK STATE
  const [feedback, setFeedback] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Fetch Neighborhoods (for dropdowns / mapping names)
    const hoods = await MockService.getNeighborhoods(user?.role === UserRole.ADMIN); // Admin forces refresh
    setNeighborhoods(hoods);

    // 2. Define Scope Logic (THE CORE LOGIC CHANGE)
    let targetHoodId: string | undefined = undefined;

    if (user?.role === UserRole.INTEGRATOR) {
        // INTEGRATOR: STRICT SCOPE - Only their own neighborhood
        if (!user.neighborhoodId) {
            setResidents([]);
            setLoading(false);
            return;
        }
        targetHoodId = user.neighborhoodId;
    } 
    // ADMIN: targetHoodId remains undefined (Fetch All from DB)

    // 3. Fetch Users based on Scope
    const allUsers = await MockService.getUsers(targetHoodId);
    
    // 4. Global Safety Filter: Remove Global Admins from the list to prevent accidents
    const filteredUsers = allUsers.filter(u => u.role !== UserRole.ADMIN);
    
    setResidents(filteredUsers);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.role === UserRole.INTEGRATOR || user?.role === UserRole.ADMIN) {
        fetchData();
        if (user.role === UserRole.INTEGRATOR) {
            setMpPublicKey(user.mpPublicKey || '');
            setMpAccessToken(user.mpAccessToken || '');
        }
    }
  }, [user]);

  // Helper para mostrar popup
  const showFeedback = (msg: string, type: 'success' | 'error') => {
      setFeedback({ msg, type });
      setTimeout(() => setFeedback(null), 4000); // Some após 4s
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Determine logic for neighborhood assignment
    let hoodIdToUse = '';

    if (user?.role === UserRole.INTEGRATOR) {
        // Integrator MUST use their own neighborhood
        hoodIdToUse = user.neighborhoodId || '';
    } else if (user?.role === UserRole.ADMIN) {
        // Admin uses the selected dropdown value
        hoodIdToUse = newHoodId;
    }

    if(!hoodIdToUse) {
        alert("Erro: É necessário vincular um bairro ao usuário.");
        return;
    }

    try {
        await MockService.createResident({
            name: newName,
            email: newEmail,
            phone: newPhone,
            address: newAddress,
        }, hoodIdToUse);

        // Reset form
        setNewName('');
        setNewEmail('');
        setNewPhone('');
        setNewAddress('');
        setNewHoodId('');
        setIsModalOpen(false);
        
        await fetchData();
        showFeedback('Morador cadastrado com sucesso!', 'success');
    } catch (error: any) {
        console.error(error);
        alert('Erro ao cadastrar morador: ' + error.message);
    }
  };

  const handleOpenEdit = (e: React.MouseEvent, resident: User) => {
      e.stopPropagation();
      setEditingUser(resident);
      setEditName(resident.name);
      setEditPhone(resident.phone || '');
      setEditHoodId(resident.neighborhoodId || '');
      setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingUser) return;

      try {
          await MockService.adminUpdateUser(editingUser.id, {
              name: editName,
              phone: editPhone,
              neighborhoodId: editHoodId 
          });
          
          setIsEditModalOpen(false);
          setEditingUser(null);
          await fetchData();
          showFeedback('Dados do usuário atualizados com sucesso!', 'success');
      } catch (e: any) {
          alert("Erro ao atualizar: " + e.message);
      }
  };

  const handleDeleteUser = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm('Tem certeza que deseja remover este usuário?')) {
          await MockService.deleteUser(id);
          await fetchData();
          showFeedback('Usuário removido.', 'success');
      }
  };

  // Aprovação de usuários pendentes
  const handleApproveUser = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm('Confirma a aprovação deste cadastro? O usuário terá acesso imediato.')) {
          try {
              await MockService.approveUser(id);
              await fetchData();
              showFeedback('Usuário aprovado com sucesso!', 'success');
          } catch(e: any) {
              showFeedback('Erro ao aprovar: ' + e.message, 'error');
          }
      }
  }

  const handleChangePlan = async (e: React.ChangeEvent<HTMLSelectElement>, resident: User) => {
      e.stopPropagation(); // Impede propagação de clique
      
      const newPlan = e.target.value;
      setUpdatingUserId(resident.id);
      
      try {
          // Atualiza no banco
          await MockService.updateUserPlan(resident.id, newPlan);
          
          // Atualização Otimista Local
          setResidents(prev => prev.map(r => 
              r.id === resident.id ? { ...r, plan: newPlan as any } : r
          ));
          
          const planName = newPlan === 'FREE' ? 'Gratuito' : newPlan === 'FAMILY' ? 'Família' : 'Prêmio';
          showFeedback(`Plano de ${resident.name} alterado para ${planName}!`, 'success');

      } catch (e: any) {
          showFeedback('Erro ao alterar plano: ' + e.message, 'error');
      } finally {
          setUpdatingUserId(null);
      }
  };

  const handleSavePaymentConfig = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setSavingConfig(true);
      setConfigSuccess(false);

      try {
          await updateProfile({ 
              mpPublicKey, 
              mpAccessToken 
          });
          setConfigSuccess(true);
          showFeedback('Configurações salvas e ativas!', 'success');
          setTimeout(() => setConfigSuccess(false), 5000);
      } catch (e: any) {
          alert('Erro ao salvar configurações: ' + e.message);
      } finally {
          setSavingConfig(false);
      }
  };

  // --- MAINTENANCE: CLEAN ORPHANED USERS ---
  const handleMaintenance = async () => {
      if(!window.confirm("Executar limpeza de vínculos inválidos? Isso corrigirá usuários apontando para bairros excluídos.")) return;
      
      setIsMaintenanceLoading(true);
      try {
          const fixedCount = await MockService.maintenanceFixOrphans();
          await fetchData(); // Refresh UI
          showFeedback(`Manutenção concluída! ${fixedCount} usuários corrigidos para 'Sem Bairro'.`, 'success');
      } catch (e: any) {
          showFeedback('Erro na manutenção: ' + e.message, 'error');
      } finally {
          setIsMaintenanceLoading(false);
      }
  };

  const getNeighborhoodName = (id?: string) => {
      const hood = neighborhoods.find(n => n.id === id);
      return hood ? hood.name : 'Sem Bairro';
  };

  // Filter Logic
  const filteredResidents = residents.filter(r => {
      // 1. Text Search
      const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            r.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 2. Admin Specific Hood Filter
      const matchesHood = adminFilterHood ? r.neighborhoodId === adminFilterHood : true;

      // 3. Show only APPROVED residents in the main list (Pending are separate)
      const isApproved = r.approved !== false;

      return matchesSearch && matchesHood && isApproved;
  });

  // Pending Users List
  const pendingUsers = residents.filter(r => r.approved === false);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 relative">
        {/* POPUP FEEDBACK TOAST */}
        {feedback && (
            <div className={`
                fixed bottom-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right-10 duration-300
                ${feedback.type === 'success' ? 'bg-[#0f1a12] border-atalaia-neon text-white' : 'bg-red-900/90 border-red-500 text-white'}
            `}>
                <div className={`p-2 rounded-full ${feedback.type === 'success' ? 'bg-atalaia-neon text-black' : 'bg-red-500 text-white'}`}>
                    {feedback.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                </div>
                <div>
                    <h4 className="font-bold text-sm uppercase">{feedback.type === 'success' ? 'Sucesso' : 'Erro'}</h4>
                    <p className="text-sm text-gray-300">{feedback.msg}</p>
                </div>
            </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                    {user?.role === UserRole.ADMIN ? (
                        <><ShieldCheck className="text-atalaia-neon" /> Gestão Geral do Sistema</>
                    ) : (
                        <><Home className="text-atalaia-neon" /> Gestão do Meu Bairro</>
                    )}
                </h1>
                <p className="text-gray-400">
                    {user?.role === UserRole.ADMIN 
                        ? 'Administração total de moradores e SCRs de todos os bairros.' 
                        : `Gerencie os moradores e equipe de: ${getNeighborhoodName(user?.neighborhoodId)}`}
                </p>
            </div>
            <div className="flex gap-2">
                {user?.role === UserRole.ADMIN && (
                    <Button onClick={handleMaintenance} disabled={isMaintenanceLoading} variant="secondary">
                        {isMaintenanceLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Wrench size={18} className="mr-2" />}
                        Manutenção
                    </Button>
                )}
                <Button onClick={() => setIsModalOpen(true)}>
                    <UserPlus size={18} className="mr-2" /> Novo Morador
                </Button>
            </div>
        </div>

        {/* PENDING APPROVALS SECTION (Admin Only) */}
        {user?.role === UserRole.ADMIN && pendingUsers.length > 0 && (
            <Card className="p-6 border-yellow-500/30 bg-yellow-500/5 animate-in slide-in-from-top-4">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <UserCheck className="text-yellow-500" size={24} />
                    Aprovações Pendentes
                    <Badge color="yellow">{pendingUsers.length}</Badge>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingUsers.map(u => (
                        <div key={u.id} className="bg-black/60 border border-yellow-500/20 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-white">{u.name}</h3>
                                <p className="text-xs text-gray-400 mb-1">{u.email}</p>
                                <div className="flex items-center gap-2">
                                    <Badge color={u.role === UserRole.SCR ? 'yellow' : 'blue'}>
                                        {u.role}
                                    </Badge>
                                    <span className="text-xs text-gray-500">{getNeighborhoodName(u.neighborhoodId)}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    onClick={(e) => handleApproveUser(e, u.id)} 
                                    className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white"
                                    title="Aprovar"
                                >
                                    <CheckCircle size={18} />
                                </Button>
                                <Button 
                                    onClick={(e) => handleDeleteUser(e, u.id)}
                                    className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white"
                                    title="Rejeitar/Excluir"
                                >
                                    <Trash2 size={18} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        )}

        {/* Payment Configuration (Integrator Only) */}
        {user?.role === UserRole.INTEGRATOR && (
            <Card className="p-6 border-atalaia-neon/30 bg-atalaia-neon/5">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <CreditCard className="text-atalaia-neon" size={24} />
                    Configuração de Recebimento (Mercado Pago)
                </h2>
                <form onSubmit={handleSavePaymentConfig} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <Input label="Public Key" placeholder="APP_USR-..." value={mpPublicKey} onChange={e => setMpPublicKey(e.target.value)} type="password" />
                    <Input label="Access Token" placeholder="APP_USR-..." value={mpAccessToken} onChange={e => setMpAccessToken(e.target.value)} type="password" />
                    <div className="md:col-span-2 flex justify-end items-center gap-4">
                        {configSuccess && (
                            <div className="flex items-center gap-2 text-green-500 animate-in fade-in">
                                <CheckCircle size={18} />
                                <span className="font-bold text-sm">Salvo com sucesso!</span>
                            </div>
                        )}
                        <Button type="submit" disabled={savingConfig}>
                            <Save size={18} className="mr-2" /> {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
                        </Button>
                    </div>
                </form>
            </Card>
        )}

        <div className="border-t border-white/10 pt-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Users className="text-gray-400" size={24} />
                Lista de Usuários Ativos
            </h2>
            
            {/* Stats & Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Stats */}
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-gray-800 text-white rounded-lg">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold">Total Exibido</p>
                        <p className="text-2xl font-bold text-white">{filteredResidents.length}</p>
                    </div>
                </Card>
                
                {/* Search & Filter */}
                <div className="md:col-span-2 flex gap-4">
                    <div className="relative h-full flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                        <input 
                            type="text" 
                            placeholder="Buscar por nome ou e-mail..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-full bg-[#111] border border-atalaia-border rounded-xl pl-12 pr-4 text-white focus:outline-none focus:border-atalaia-neon transition-colors"
                        />
                    </div>
                    {/* ADMIN-ONLY: FILTER BY NEIGHBORHOOD */}
                    {user?.role === UserRole.ADMIN && (
                        <div className="w-1/3 min-w-[150px]">
                            <div className="relative h-full">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <select 
                                    className="w-full h-full bg-[#111] border border-atalaia-border rounded-xl pl-10 pr-4 text-white text-xs focus:outline-none focus:border-atalaia-neon appearance-none cursor-pointer"
                                    value={adminFilterHood}
                                    onChange={(e) => setAdminFilterHood(e.target.value)}
                                >
                                    <option value="">Todos os Bairros</option>
                                    {neighborhoods.map(h => (
                                        <option key={h.id} value={h.id}>{h.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {loading ? (
                    <p className="text-gray-500">Carregando...</p>
                ) : filteredResidents.length === 0 ? (
                    <div className="col-span-2 text-center py-12 border border-dashed border-gray-700 rounded-xl bg-white/5">
                        <p className="text-gray-500">Nenhum usuário ativo encontrado.</p>
                    </div>
                ) : (
                    filteredResidents.map(resident => (
                        <Card key={resident.id} className="p-5 flex items-start justify-between group hover:border-atalaia-neon/50 transition-colors bg-[#111]">
                            <div className="flex items-start gap-4 flex-1">
                                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-lg font-bold text-gray-400 border border-gray-700 shrink-0">
                                    {resident.photoUrl ? (
                                        <img src={resident.photoUrl} alt={resident.name} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        resident.name.charAt(0)
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-white text-lg truncate">{resident.name}</h3>
                                    
                                    {/* Location Badge (Crucial for Admin View) */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${resident.neighborhoodId ? 'bg-blue-900/30 text-blue-300 border border-blue-900/50' : 'bg-red-900/30 text-red-300 border border-red-900/50'}`}>
                                            <MapPin size={10} />
                                            {getNeighborhoodName(resident.neighborhoodId)}
                                        </div>
                                    </div>

                                    {/* PLAN MANAGEMENT - SELECT DROPDOWN */}
                                    <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                                        <Badge color={resident.plan === 'FREE' ? 'blue' : resident.plan === 'FAMILY' ? 'green' : 'yellow'}>
                                            {resident.plan === 'FREE' ? 'GRATUITO' : resident.plan === 'FAMILY' ? 'FAMÍLIA' : 'PREMIUM'}
                                        </Badge>
                                        
                                        <div className="relative">
                                            {updatingUserId === resident.id ? (
                                                <div className="flex items-center gap-1 px-2 py-0.5 rounded border border-gray-600 bg-gray-800 text-gray-400 text-xs">
                                                    <Loader2 size={10} className="animate-spin" /> Salvando...
                                                </div>
                                            ) : (
                                                <>
                                                    <select 
                                                        value={resident.plan}
                                                        onChange={(e) => handleChangePlan(e, resident)}
                                                        onClick={(e) => e.stopPropagation()} // Dupla garantia para não abrir o card
                                                        className={`
                                                            appearance-none pl-2 pr-6 py-0.5 text-xs font-bold rounded border cursor-pointer focus:outline-none transition-colors
                                                            ${resident.plan === 'PREMIUM' || resident.plan === 'FAMILY' 
                                                                ? 'bg-atalaia-neon/20 text-atalaia-neon border-atalaia-neon/40 hover:bg-atalaia-neon/30' 
                                                                : 'bg-gray-800 text-gray-400 border-gray-600 hover:border-gray-500'}
                                                        `}
                                                    >
                                                        <option value="FREE">Gratuito</option>
                                                        <option value="FAMILY">Dar Família</option>
                                                        <option value="PREMIUM">Dar Premium</option>
                                                    </select>
                                                    <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-sm text-gray-400">
                                        <div className="flex items-center gap-2"><Mail size={14} /> {resident.email}</div>
                                        <div className="flex items-center gap-2"><Phone size={14} /> {resident.phone || 'Não informado'}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 ml-2">
                                <button 
                                    onClick={(e) => handleOpenEdit(e, resident)}
                                    className="p-2 text-blue-500 hover:text-white hover:bg-blue-500/10 rounded-lg transition-colors z-10 relative"
                                    title="Editar / Vincular Bairro"
                                >
                                    <Edit2 size={20} />
                                </button>
                                <button 
                                    onClick={(e) => handleDeleteUser(e, resident.id)}
                                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors z-10 relative"
                                    title="Remover Morador"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>

        {/* Modal Create */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <div className="p-6">
                <h2 className="text-2xl font-bold text-white mb-6">Cadastrar Novo Morador</h2>
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <Input 
                        label="Nome Completo"
                        placeholder="Ex: João da Silva"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        required
                    />
                    <Input 
                        label="E-mail"
                        type="email"
                        placeholder="joao@email.com"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        required
                    />
                    
                    {/* ADMIN: Neighborhood Selector (Dropdown) */}
                    {user?.role === UserRole.ADMIN && (
                        <div>
                             <label className="text-xs font-medium text-gray-400 mb-1 block uppercase">Vincular ao Bairro</label>
                             <select 
                                className="w-full bg-black/50 border border-atalaia-border rounded-lg px-4 py-2.5 text-white focus:border-atalaia-neon focus:outline-none"
                                value={newHoodId}
                                onChange={(e) => setNewHoodId(e.target.value)}
                                required
                             >
                                 <option value="" disabled>Selecione um Bairro</option>
                                 {neighborhoods.map(h => (
                                     <option key={h.id} value={h.id}>{h.name}</option>
                                 ))}
                             </select>
                             <p className="text-[10px] text-gray-500 mt-1">Admin: Selecione onde este usuário será alocado.</p>
                        </div>
                    )}
                    
                    {/* INTEGRATOR: Fixed Neighborhood Display (Locked) */}
                    {user?.role === UserRole.INTEGRATOR && (
                        <div>
                            <label className="text-xs font-medium text-gray-400 mb-1 block uppercase">Bairro de Vínculo</label>
                            <div className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-300 flex items-center gap-2">
                                <Lock size={14} className="text-atalaia-neon" />
                                {getNeighborhoodName(user.neighborhoodId)}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">Este usuário será vinculado automaticamente ao seu bairro.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <Input 
                            label="WhatsApp"
                            placeholder="+55 48 99999-9999"
                            value={newPhone}
                            onChange={e => setNewPhone(e.target.value)}
                        />
                         <Input 
                            label="Endereço"
                            placeholder="Rua, Número"
                            value={newAddress}
                            onChange={e => setNewAddress(e.target.value)}
                        />
                    </div>
                    
                    {/* Locked Plan Field */}
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 flex items-center justify-between opacity-80 cursor-not-allowed">
                        <div className="flex items-center gap-2">
                             <Lock size={16} className="text-gray-500" />
                             <div>
                                 <label className="text-xs text-gray-500 block uppercase">Plano Inicial</label>
                                 <span className="text-sm font-bold text-white">GRATUITO</span>
                             </div>
                        </div>
                        <span className="text-xs text-gray-500">Upgrade apenas na edição</span>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Cadastrar</Button>
                    </div>
                </form>
            </div>
        </Modal>

        {/* Modal Edit / Link */}
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
            <div className="p-6">
                <h2 className="text-2xl font-bold text-white mb-6">Editar / Vincular Morador</h2>
                <form onSubmit={handleUpdateUser} className="space-y-4">
                    <Input label="Nome Completo" value={editName} onChange={e => setEditName(e.target.value)} />
                    <Input label="WhatsApp" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                    
                    <div className="bg-atalaia-neon/5 p-4 rounded-xl border border-atalaia-neon/20">
                         <label className="block text-xs font-medium text-atalaia-neon mb-2 uppercase flex items-center gap-1">
                             <LinkIcon size={12} /> Bairro Vinculado
                         </label>
                         
                         {user?.role === UserRole.ADMIN ? (
                             // ADMIN: Can move user to ANY neighborhood
                             <select
                                className="w-full bg-black/50 border border-atalaia-border rounded-lg px-4 py-2.5 text-white focus:border-atalaia-neon focus:outline-none"
                                value={editHoodId}
                                onChange={(e) => setEditHoodId(e.target.value)}
                             >
                                 <option value="">-- Sem Bairro --</option>
                                 {neighborhoods.map(h => (
                                     <option key={h.id} value={h.id}>{h.name}</option>
                                 ))}
                             </select>
                         ) : (
                             // INTEGRATOR: Sees LOCKED view (Cannot move user out of their jurisdiction easily)
                             <div className="flex items-center gap-2 text-gray-300 bg-black/50 p-2 rounded border border-gray-700">
                                 <Lock size={14} />
                                 {getNeighborhoodName(editHoodId || user?.neighborhoodId)}
                             </div>
                         )}
                         
                         <p className="text-[10px] text-gray-400 mt-2">
                             {user?.role === UserRole.ADMIN 
                                ? 'Admin: Você pode transferir este usuário para outro bairro.' 
                                : 'Apenas administradores podem transferir usuários entre bairros.'}
                         </p>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Salvar Alterações</Button>
                    </div>
                </form>
            </div>
        </Modal>

      </div>
    </Layout>
  );
};

export default IntegratorUsers;