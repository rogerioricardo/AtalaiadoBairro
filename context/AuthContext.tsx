import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, UserPlan } from '../types';
import { supabase } from '../lib/supabaseClient';
import { MockService } from '../services/mockService'; // Import MockService

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role?: UserRole, name?: string, neighborhoodId?: string, phone?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to map DB profile to User object
  const mapProfile = (profile: any): User => ({
      id: profile.id,
      name: profile.name || profile.email,
      email: profile.email,
      role: profile.role || UserRole.RESIDENT,
      plan: (profile.plan as UserPlan) || 'FREE',
      neighborhoodId: profile.neighborhood_id,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      phone: profile.phone,
      photoUrl: profile.photo_url,
      lat: profile.lat,
      lng: profile.lng,
      // Se 'approved' não existir (legado), considera true. Se existir, usa o valor.
      approved: profile.approved !== false, 
      mpPublicKey: profile.mp_public_key,
      mpAccessToken: profile.mp_access_token
  });

  const fetchProfile = async (userId: string, email: string) => {
      // Fire and forget - não bloqueia a UI
      try {
          const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();

          if (data) {
              setUser(mapProfile(data));
          } else if (!data) {
              // SELF HEALING
              console.warn("Profile missing, attempting self-healing...");
              const { data: newProfile } = await supabase
                  .from('profiles')
                  .insert([{
                      id: userId,
                      email: email,
                      name: email.split('@')[0],
                      role: 'RESIDENT',
                      plan: 'FREE',
                      approved: true // Default approved for self-healing
                  }])
                  .select()
                  .single();
              
              if (newProfile) {
                  setUser(mapProfile(newProfile));
              }
          }
      } catch (e) {
          console.error("Background profile fetch error:", e);
      }
  };

  useEffect(() => {
    // Timeout de segurança para não travar o loading
    const safetyTimeout = setTimeout(() => {
        if (loading) setLoading(false);
    }, 5000);

    const initAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Set optimistic user first
                const userData: User = {
                    id: session.user.id,
                    email: session.user.email!,
                    name: session.user.user_metadata?.name || session.user.email!.split('@')[0],
                    role: (session.user.user_metadata?.role as UserRole) || UserRole.RESIDENT,
                    plan: 'FREE', // Default until fetch
                    neighborhoodId: session.user.user_metadata?.neighborhood_id,
                    approved: session.user.user_metadata?.approved !== false // Check meta default
                };
                setUser(userData);
                
                // Fetch full details in background
                fetchProfile(session.user.id, session.user.email!);
            }
        } catch (error) {
            console.error("Auth init error", error);
        } finally {
            setLoading(false);
        }
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
         if (!user) {
             // Re-apply optimistic update if user state was lost
             setUser({
                id: session.user.id,
                email: session.user.email!,
                name: session.user.user_metadata?.name || session.user.email!.split('@')[0],
                role: (session.user.user_metadata?.role as UserRole) || UserRole.RESIDENT,
                plan: 'FREE',
                neighborhoodId: session.user.user_metadata?.neighborhood_id,
                approved: true // Assume true until fetch corrects it
            });
            fetchProfile(session.user.id, session.user.email!);
         }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
        subscription.unsubscribe();
        clearTimeout(safetyTimeout);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (data.user) {
             // Verificar se profile está approved fazendo um fetch rápido
             // (Metadados podem estar desatualizados)
             const { data: profile } = await supabase.from('profiles').select('approved, phone, name').eq('id', data.user.id).single();
             
             if (profile && profile.approved === false) {
                 await supabase.auth.signOut();
                 throw new Error("Sua conta aguarda aprovação do administrador.");
             }

            // LOGIN IMEDIATO (OPTIMISTIC)
            const loggedUser: User = {
                id: data.user.id,
                email: data.user.email!,
                name: data.user.user_metadata?.name || email.split('@')[0],
                role: (data.user.user_metadata?.role as UserRole) || UserRole.RESIDENT,
                plan: 'FREE',
                neighborhoodId: data.user.user_metadata?.neighborhood_id,
                approved: true,
                phone: profile?.phone
            };

            setUser(loggedUser);
            
            // Carrega detalhes em background
            fetchProfile(data.user.id, data.user.email!);

            // Envia Notificação de Login via WhatsApp
            MockService.notifyUserLogin(loggedUser);
        }
    } finally {
        setLoading(false);
    }
  };

  const register = async (email: string, password: string, role: UserRole, name: string, neighborhoodId?: string, phone?: string) => {
      // Regra de Aprovação: Integrador e SCR nascem "Não Aprovados"
      const requiresApproval = role === UserRole.INTEGRATOR || role === UserRole.SCR;
      const isApproved = !requiresApproval;

      const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
              data: {
                  role: role,
                  name: name,
                  neighborhood_id: neighborhoodId,
                  phone: phone, // Save to metadata
                  approved: isApproved
              }
          }
      });
      if (error) throw error;

      if (data.user) {
          // EXPLICIT UPDATE: Ensure profile table has the phone number and approval status
          const updateData: any = { approved: isApproved };
          if (phone) updateData.phone = phone;

          await supabase.from('profiles').update(updateData).eq('id', data.user.id);
          
          // NOTIFICAR ADMIN SOBRE NOVO CADASTRO
          // Tenta resolver o nome do bairro para o alerta
          let hoodName = 'Bairro ID ' + (neighborhoodId || 'Global');
          if (neighborhoodId) {
             const hood = await MockService.getNeighborhoodById(neighborhoodId);
             if (hood) hoodName = hood.name;
          }

          // CORREÇÃO: Passando o ID do novo usuário para que o admin possa aprovar pelo painel
          await MockService.notifyAdminOfRegistration(data.user.id, name, role, hoodName);
      }

      // Se não aprovado, faz logout imediato para não permitir acesso ao dashboard
      if (!isApproved) {
          await supabase.auth.signOut();
          setUser(null); 
          // O componente de Login tratará a mensagem de sucesso diferenciada
      }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    
    // Mapeamento correto para as colunas do banco de dados (snake_case)
    const dbUpdates: any = {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        phone: data.phone,
        photo_url: data.photoUrl,
        lat: data.lat,
        lng: data.lng,
        // CORREÇÃO: Incluindo as chaves do Mercado Pago na atualização
        mp_public_key: data.mpPublicKey,
        mp_access_token: data.mpAccessToken
    };

    // Remove chaves undefined para não apagar dados existentes acidentalmente
    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', user.id);
    if (error) throw error;
    
    // Atualiza estado local
    setUser({ ...user, ...data });
  };

  const refreshUser = async () => {
      if (user) {
          await fetchProfile(user.id, user.email);
      }
  }

  return (
    <AuthContext.Provider value={{ 
        user, 
        login: async (email, password, role, name, neighborhoodId, phone) => {
             if (name) {
                 return register(email, password, role!, name, neighborhoodId, phone);
             } else {
                 return login(email, password);
             }
        }, 
        logout, 
        updateProfile, 
        isAuthenticated: !!user,
        loading,
        refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};