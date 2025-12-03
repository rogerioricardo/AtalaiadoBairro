

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole, Neighborhood } from '../types';
import { Button, Input, Card } from '../components/UI';
import { ShieldCheck, ArrowLeft, AlertCircle, MapPin, CheckCircle, RefreshCw, CreditCard } from 'lucide-react';
import { MockService } from '../services/mockService';
import { PaymentService } from '../services/paymentService';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isRegister, setIsRegister] = useState(searchParams.get('mode') === 'register');
  const planParam = searchParams.get('plan');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.RESIDENT);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState('');
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [loadingHoods, setLoadingHoods] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirectingToPay, setRedirectingToPay] = useState(false);
  const [pendingApprovalMode, setPendingApprovalMode] = useState(false); // New state for pending approval screen

  const loadHoods = async (force = false) => {
      setLoadingHoods(true);
      try {
          const hoods = await MockService.getNeighborhoods(force);
          setNeighborhoods(hoods);
          if (hoods.length > 0 && !selectedNeighborhoodId) {
              setSelectedNeighborhoodId(hoods[0].id);
          }
      } catch (e) {
          console.error("Falha ao carregar bairros", e);
      } finally {
          setLoadingHoods(false);
      }
  };

  useEffect(() => {
      loadHoods(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isRegister) {
          if (!selectedNeighborhoodId && role !== UserRole.ADMIN) {
              throw new Error('Por favor, selecione seu bairro.');
          }

          const selectedHoodName = neighborhoods.find(n => n.id === selectedNeighborhoodId)?.name || 'Bairro';

          // --- VALIDAÇÃO DE INTEGRADOR ÚNICO ---
          if (role === UserRole.INTEGRATOR) {
              const existingIntegrator = await MockService.getNeighborhoodIntegrator(selectedNeighborhoodId);
              if (existingIntegrator) {
                  throw new Error(`BLOQUEADO: O bairro "${selectedHoodName}" já possui um Integrador responsável (ou mais). Apenas um é permitido.`);
              }
          }
          // -------------------------------------
          
          // 1. Cria a conta no Supabase (AuthContext lida com approved=false para SCR/Integrator)
          await login(email, password, role, name, selectedNeighborhoodId);
          
          // VERIFICAÇÃO PÓS-CADASTRO: Se for SCR ou Integrador, não loga e avisa Admin
          if (role === UserRole.SCR || role === UserRole.INTEGRATOR) {
              await MockService.notifyAdminOfRegistration(name, role, selectedHoodName);
              setPendingApprovalMode(true);
              setLoading(false);
              return;
          }

          // 2. Verifica se é um plano pago (apenas Moradores chegam aqui)
          if (planParam && (planParam === 'FAMILY' || planParam === 'PREMIUM')) {
              setSuccess('Cadastro realizado! Gerando pagamento...');
              setRedirectingToPay(true);
              
              // Gera link do Mercado Pago
              const checkoutUrl = await PaymentService.createPreference(planParam, email, name);
              
              // Redireciona
              window.location.href = checkoutUrl;
              return; 
          }

          setSuccess('Cadastro realizado! Entrando...');
          
          // LÓGICA DE REDIRECIONAMENTO DE BOAS-VINDAS
          if (role === UserRole.RESIDENT && (!planParam || planParam === 'FREE')) {
              setTimeout(() => navigate('/welcome'), 1000);
          } else {
              setTimeout(() => navigate('/dashboard'), 1000);
          }

      } else {
          // Login Normal
          await login(email, password);
          setSuccess('Acesso autorizado!');
          setTimeout(() => navigate('/dashboard'), 500);
      }
    } catch (err: any) {
        console.error(err);
        setError(err.message || 'Falha na autenticação. Verifique senha ou internet.');
        setLoading(false);
        setRedirectingToPay(false);
    }
  };

  // TELA DE APROVAÇÃO PENDENTE
  if (pendingApprovalMode) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#050505] px-4">
            <Card className="max-w-md w-full p-8 border-yellow-500/30 bg-yellow-900/10 text-center">
                <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(234,179,8,0.4)]">
                    <AlertCircle size={32} className="text-black" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Cadastro em Análise</h2>
                <p className="text-gray-300 mb-6 leading-relaxed">
                    Sua solicitação de acesso como <strong>{role === UserRole.SCR ? 'Motovigia (SCR)' : 'Integrador'}</strong> foi enviada para o Administrador da plataforma.
                </p>
                <div className="bg-black/50 p-4 rounded-lg border border-yellow-500/20 mb-6 text-sm text-yellow-500">
                    Você receberá a liberação em breve. Por motivos de segurança, o acesso imediato é restrito para esta função.
                </div>
                <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                    Voltar ao Início
                </Button>
            </Card>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] relative overflow-hidden px-4 py-8">
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-atalaia-neon/5 rounded-full blur-[120px]" />
      
      <Card className="w-full max-w-md p-8 border-atalaia-border relative z-10 bg-[#0a0a0a]">
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 text-gray-500 hover:text-atalaia-neon transition-colors flex items-center gap-2 text-sm font-medium group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span>Voltar</span>
        </button>

        <div className="text-center mb-8 pt-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-atalaia-neon/10 text-atalaia-neon mb-4">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isRegister ? 'Criar Conta' : 'Acesso Atalaia'}
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            {isRegister ? 'Segurança colaborativa inteligente.' : 'Entre para monitorar sua comunidade.'}
          </p>
          {isRegister && planParam && planParam !== 'FREE' && (
              <div className="mt-4 bg-atalaia-neon/10 border border-atalaia-neon/30 text-atalaia-neon px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                  <CreditCard size={16} />
                  Assinando Plano {planParam === 'FAMILY' ? 'Família' : 'Prêmio'}
              </div>
          )}
        </div>

        {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-500 text-sm animate-in slide-in-from-top-2">
                <AlertCircle size={20} />
                {error}
            </div>
        )}

        {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3 text-green-500 text-sm animate-in slide-in-from-top-2">
                <CheckCircle size={20} />
                {success}
            </div>
        )}

        {redirectingToPay ? (
            <div className="text-center py-8">
                <RefreshCw size={32} className="animate-spin text-atalaia-neon mx-auto mb-4" />
                <p className="text-white font-bold">Redirecionando para o Mercado Pago...</p>
                <p className="text-gray-500 text-sm mt-2">Por favor, aguarde.</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
                <Input 
                    label="Nome Completo" 
                    placeholder="Seu Nome" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isRegister}
                />
            )}

            <Input 
                label="Email" 
                type="email" 
                placeholder="seu@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
            
            <Input 
                label="Senha" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
            />

            {isRegister && (
                <>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <MapPin size={12} /> Bairro
                            </label>
                            <button 
                                type="button" 
                                onClick={() => loadHoods(true)} 
                                disabled={loadingHoods}
                                className="text-xs text-atalaia-neon hover:text-white flex items-center gap-1"
                            >
                                <RefreshCw size={10} className={loadingHoods ? "animate-spin" : ""} /> Atualizar
                            </button>
                        </div>
                        <select 
                            className="w-full bg-black/50 border border-atalaia-border rounded-lg px-4 py-2.5 text-white focus:border-atalaia-neon focus:outline-none disabled:opacity-50"
                            value={selectedNeighborhoodId}
                            onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                            required
                            disabled={loadingHoods}
                        >
                            <option value="" disabled>
                                {loadingHoods ? 'Carregando bairros...' : 'Selecione seu bairro'}
                            </option>
                            {neighborhoods.map(hood => (
                                <option key={hood.id} value={hood.id}>
                                    {hood.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Perfil</label>
                        <select 
                        className="w-full bg-black/50 border border-atalaia-border rounded-lg px-4 py-2.5 text-white focus:border-atalaia-neon focus:outline-none"
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        >
                        <option value={UserRole.RESIDENT}>Morador</option>
                        <option value={UserRole.SCR}>SCR (Motovigia)</option>
                        <option value={UserRole.INTEGRATOR}>Integrador</option>
                        </select>
                        {(role === UserRole.SCR || role === UserRole.INTEGRATOR) && (
                            <p className="text-[10px] text-yellow-500 flex items-center gap-1 mt-1">
                                <AlertCircle size={10} /> O cadastro para esta função requer aprovação do Admin.
                            </p>
                        )}
                    </div>
                </>
            )}

            <Button type="submit" className={`w-full h-12 text-lg mt-6 ${success ? 'bg-green-500 text-white' : ''}`} disabled={loading || !!success}>
                {loading ? 'Processando...' : success ? 'Sucesso!' : (isRegister ? (planParam && planParam !== 'FREE' ? 'Cadastrar e Pagar' : 'Cadastrar') : 'Entrar no Sistema')}
            </Button>
            </form>
        )}

        <div className="mt-6 text-center">
          {!redirectingToPay && (
            <button 
                onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); }}
                className="text-sm text-gray-400 hover:text-atalaia-neon transition-colors"
            >
                {isRegister ? 'Já tem conta? Faça login' : 'Não tem conta? Crie agora'}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Login;