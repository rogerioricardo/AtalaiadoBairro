import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role?: UserRole, name?: string, neighborhoodId?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
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
      plan: profile.plan || 'FREE',
      neighborhoodId: profile.neighborhood_id,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      phone: profile.phone,
      photoUrl: profile.photo_url,
      lat: profile.lat,
      lng: profile.lng
  });

  const fetchProfile = async (userId: string, email: string) => {
      const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

      if (data) {
          setUser(mapProfile(data));
      } else if (error && error.code === 'PGRST116') {
          // Profile doesn't exist yet (should be created by trigger, but just in case)
          console.log("Profile not found, waiting for trigger...");
      }
  };

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email!);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email!);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const register = async (email: string, password: string, role: UserRole, name: string, neighborhoodId?: string) => {
      const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
              data: {
                  role: role,
                  name: name,
                  neighborhood_id: neighborhoodId // Pass neighborhood to trigger
              }
          }
      });
      if (error) throw error;
      // Trigger will handle profile creation using this metadata
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    
    // Map Frontend fields to DB snake_case
    const dbUpdates = {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        phone: data.phone,
        photo_url: data.photoUrl,
        lat: data.lat,
        lng: data.lng
    };

    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', user.id);
    if (error) throw error;
    
    // Optimistic update
    setUser({ ...user, ...data });
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        login: async (email, password, role, name, neighborhoodId) => {
             if (name) {
                 return register(email, password, role!, name, neighborhoodId);
             } else {
                 return login(email, password);
             }
        }, 
        logout, 
        updateProfile, 
        isAuthenticated: !!user,
        loading 
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