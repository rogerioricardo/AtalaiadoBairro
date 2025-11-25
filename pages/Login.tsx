
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole, Neighborhood } from '../types';
import { Button, Input, Card } from '../components/UI';
import { ShieldCheck, ArrowLeft, AlertCircle, MapPin } from 'lucide-react';
import { MockService } from '../services/mockService';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isRegister, setIsRegister] = useState(searchParams.get('mode') === 'register');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.RESIDENT);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState('');
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
      // Load neighborhoods for the registration dropdown
      const loadHoods = async () => {
          const hoods = await MockService.getNeighborhoods();
          setNeighborhoods(hoods);
          // Set default if exists
          if (hoods.length > 0) setSelectedNeighborhoodId(hoods[0].id);
      };
      if (isRegister) {
          loadHoods();
      }
  }, [isRegister]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isRegister) {
          if (!selectedNeighborhoodId && role !== UserRole.ADMIN) {
              throw new Error('Por favor, selecione seu bairro.');
          }
          await login(email, password, role, name, selectedNeighborhoodId);
          // Wait a bit for trigger
          setTimeout(() => navigate('/dashboard'), 1000);
      } else {
          await login(email, password);
          navigate('/dashboard');
      }
    } catch (err: any) {
        console.error(err);
        setError(err.message || 'Erro ao realizar autenticação.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] relative overflow-hidden px-4 py-8">
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-atalaia-neon/5 rounded-full blur-[120px]" />
      
      <Card className="w-full max-w-md p-8 border-atalaia-border relative z-10 bg-[#0a0a0a]">
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 text-gray-500 hover:text-atalaia-neon transition-colors flex items-center gap-2 text-sm font-medium group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span>Voltar à página principal</span>
        </button>

        <div className="text-center mb-8 pt-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-atalaia-neon/10 text-atalaia-neon mb-4">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isRegister ? 'Criar Conta' : 'Acesso Atalaia'}
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            {isRegister ? 'Junte-se à maior rede de proteção colaborativa.' : 'Bem-vindo de volta, sentinela.'}
          </p>
        </div>

        {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-500 text-sm">
                <AlertCircle size={20} />
                {error}
            </div>
        )}

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
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <MapPin size={12} /> Bairro / Comunidade
                    </label>
                    <select 
                        className="w-full bg-black/50 border border-atalaia-border rounded-lg px-4 py-2.5 text-white focus:border-atalaia-neon focus:outline-none"
                        value={selectedNeighborhoodId}
                        onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                        required
                    >
                        <option value="" disabled>Selecione seu bairro</option>
                        {neighborhoods.map(hood => (
                            <option key={hood.id} value={hood.id}>
                                {hood.name}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-600">Selecione "Sanga Funda - Içara/SC" ou outro disponível.</p>
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Perfil</label>
                    <select 
                    className="w-full bg-black/50 border border-atalaia-border rounded-lg px-4 py-2.5 text-white focus:border-atalaia-neon focus:outline-none"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    >
                    <option value={UserRole.INTEGRATOR}>Integrador</option>
                    <option value={UserRole.SCR}>SCR (Motovigia)</option>
                    <option value={UserRole.RESIDENT}>Morador</option>
                    </select>
                </div>
            </>
          )}

          <Button type="submit" className="w-full h-12 text-lg mt-6" disabled={loading}>
            {loading ? 'Processando...' : (isRegister ? 'Cadastrar' : 'Entrar no Sistema')}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-sm text-gray-400 hover:text-atalaia-neon transition-colors"
          >
            {isRegister ? 'Já tem conta? Faça login' : 'Não tem conta? Crie agora'}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Login;
