
import { supabase } from '../lib/supabaseClient';
import { Neighborhood, Alert, CameraProtocol, ChatMessage, UserRole, User, Notification, Plan } from '../types';

// Helper to map DB snake_case to Frontend camelCase
const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  name: profile.name || 'Sem Nome',
  email: profile.email || '',
  role: (profile.role as UserRole) || UserRole.RESIDENT,
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

export const MockService = {
  // --- NEIGHBORHOODS ---
  getNeighborhoods: async (): Promise<Neighborhood[]> => {
    const { data } = await supabase.from('neighborhoods').select('*');
    return (data || []).map(n => ({
      id: n.id,
      name: n.name,
      iframeUrl: n.iframe_url,
      lat: n.lat,
      lng: n.lng
    }));
  },

  getNeighborhoodById: async (id: string): Promise<Neighborhood | undefined> => {
    const { data } = await supabase.from('neighborhoods').select('*').eq('id', id).single();
    if (!data) return undefined;
    return {
      id: data.id,
      name: data.name,
      iframeUrl: data.iframe_url,
      lat: data.lat,
      lng: data.lng
    };
  },

  createNeighborhood: async (name: string, iframeUrl: string, lat?: number, lng?: number): Promise<Neighborhood> => {
    const { data, error } = await supabase.from('neighborhoods').insert([{
      name,
      iframe_url: iframeUrl,
      lat,
      lng
    }]).select().single();
    
    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      iframeUrl: data.iframe_url,
      lat: data.lat,
      lng: data.lng
    };
  },

  // --- ALERTS ---
  getAlerts: async (neighborhoodId?: string): Promise<Alert[]> => {
    let query = supabase.from('alerts').select('*').order('timestamp', { ascending: false }).limit(50);
    if (neighborhoodId) {
      query = query.eq('neighborhood_id', neighborhoodId);
    }
    const { data } = await query;
    return (data || []).map(a => ({
      id: a.id,
      type: a.type,
      userId: a.user_id,
      userName: a.user_name,
      neighborhoodId: a.neighborhood_id,
      timestamp: new Date(a.timestamp),
      message: a.message
    }));
  },

  createAlert: async (alert: Omit<Alert, 'id' | 'timestamp'> & { userRole?: UserRole }): Promise<Alert> => {
    const { data, error } = await supabase.from('alerts').insert([{
      type: alert.type,
      user_id: alert.userId,
      user_name: alert.userName,
      neighborhood_id: alert.neighborhoodId,
      message: alert.message
    }]).select().single();

    if (error) throw error;

    // Auto-post to chat
    const alertMessages: Record<string, string> = {
        'PANIC': '🚨 PÂNICO ACIONADO! Preciso de ajuda urgente!',
        'DANGER': '⚠️ PERIGO REPORTADO. Fiquem atentos.',
        'SUSPICIOUS': '👀 Atividade suspeita reportada.',
        'OK': '✅ Tudo tranquilo por aqui.'
    };

    await supabase.from('chat_messages').insert([{
      neighborhood_id: alert.neighborhoodId,
      user_id: alert.userId,
      user_name: alert.userName,
      user_role: alert.userRole,
      text: alertMessages[alert.type] || 'Alerta',
      is_system_alert: true,
      alert_type: alert.type
    }]);

    return {
      id: data.id,
      type: data.type,
      userId: data.user_id,
      userName: data.user_name,
      neighborhoodId: data.neighborhood_id,
      timestamp: new Date(data.timestamp),
      message: data.message
    };
  },

  // --- PROTOCOLS ---
  generateProtocol: async (cameraName: string, lat?: number, lng?: number): Promise<CameraProtocol> => {
    // Protocol generation doesn't necessarily need DB storage unless we want logs,
    // but here we just return the object as the user requested.
    const cleanName = cameraName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return {
      id: crypto.randomUUID(),
      name: cleanName,
      rtmp: `rtmp://cameras.atalaia.cloud/live/${cleanName}`,
      rtsp: `rtsp://cameras.atalaia.cloud:5554/${cleanName}`,
      lat,
      lng
    };
  },

  sendProtocolToAdmin: async (protocol: CameraProtocol, fromUserName: string): Promise<void> => {
    await supabase.from('notifications').insert([{
      type: 'PROTOCOL_SUBMISSION',
      title: 'Novo Protocolo e Coordenadas',
      message: `Integrador ${fromUserName} enviou dados da câmera ${protocol.name}.`,
      data: protocol,
      from_user_name: fromUserName
    }]);
  },

  getNotifications: async (): Promise<Notification[]> => {
    const { data } = await supabase.from('notifications').select('*').order('timestamp', { ascending: false });
    return (data || []).map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data,
      fromUserName: n.from_user_name,
      timestamp: new Date(n.timestamp),
      read: n.read
    }));
  },

  deleteNotification: async (id: string): Promise<void> => {
    await supabase.from('notifications').delete().eq('id', id);
  },

  // --- CHAT ---
  getMessages: async (neighborhoodId: string): Promise<ChatMessage[]> => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('neighborhood_id', neighborhoodId)
      .order('timestamp', { ascending: true })
      .limit(100);

    return (data || []).map(m => ({
      id: m.id,
      neighborhoodId: m.neighborhood_id,
      userId: m.user_id,
      userName: m.user_name,
      userRole: m.user_role as UserRole,
      text: m.text,
      timestamp: new Date(m.timestamp),
      isSystemAlert: m.is_system_alert,
      alertType: m.alert_type
    }));
  },

  sendMessage: async (msg: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> => {
    const { data, error } = await supabase.from('chat_messages').insert([{
      neighborhood_id: msg.neighborhoodId,
      user_id: msg.userId,
      user_name: msg.userName,
      user_role: msg.userRole,
      text: msg.text
    }]).select().single();

    if (error) throw error;
    
    return {
      id: data.id,
      neighborhoodId: data.neighborhood_id,
      userId: data.user_id,
      userName: data.user_name,
      userRole: data.user_role as UserRole,
      text: data.text,
      timestamp: new Date(data.timestamp),
      isSystemAlert: data.is_system_alert,
      alertType: data.alert_type
    };
  },

  // --- USERS & PROFILES ---
  getUsers: async (neighborhoodId?: string): Promise<User[]> => {
    let query = supabase.from('profiles').select('*');
    if (neighborhoodId) {
        query = query.eq('neighborhood_id', neighborhoodId);
    }
    const { data } = await query;
    return (data || []).map(mapProfileToUser);
  },

  createResident: async (userData: Partial<User>, neighborhoodId: string): Promise<User> => {
      // 1. Generate a manual ID for the profile since they don't have an Auth User yet.
      // This works because we removed the Foreign Key constraint in the SQL script.
      const tempId = crypto.randomUUID();

      const { data, error } = await supabase.from('profiles').insert([{
          id: tempId,
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          address: userData.address,
          neighborhood_id: neighborhoodId,
          role: 'RESIDENT',
          plan: 'FREE' // Enforce FREE plan
      }]).select().single();

      if (error) {
          console.error("Supabase Error:", error);
          throw new Error(error.message);
      }
      return mapProfileToUser(data);
  },

  deleteUser: async (id: string): Promise<void> => {
      await supabase.from('profiles').delete().eq('id', id);
  },

  getPlans: async (): Promise<Plan[]> => {
      const { data } = await supabase.from('plans').select('*').order('price');
      return (data || []).map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          features: p.features,
          recommended: p.recommended
      }));
  },

  updateUserPlan: async (userId: string, planId: string): Promise<void> => {
      const { error } = await supabase.from('profiles').update({ plan: planId }).eq('id', userId);
      if (error) throw error;
  }
};
