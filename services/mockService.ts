

import { supabase } from '../lib/supabaseClient';
import { Neighborhood, Alert, CameraProtocol, ChatMessage, UserRole, User, Notification, Plan, ServiceRequest, Camera } from '../types';

// Cache simples em memória para evitar requests repetidos de bairros
let cachedNeighborhoods: Neighborhood[] | null = null;

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
  lng: profile.lng,
  // Default to true if undefined (legacy compatibility), unless explicitly false
  approved: profile.approved !== false, 
  mpPublicKey: profile.mp_public_key,
  mpAccessToken: profile.mp_access_token
});

// Helper to sanitize UUIDs for database calls
const sanitizeUUID = (id?: string): string | null => {
    if (!id || id === 'unknown' || id === 'undefined' || id.trim() === '') {
        return null;
    }
    // Simple regex check for UUID format (loose check)
    if (id.length < 20) return null; 
    return id;
};

export const MockService = {
  // --- NEIGHBORHOODS ---
  getNeighborhoods: async (forceRefresh = false): Promise<Neighborhood[]> => {
    // Se já temos em cache e não forçado, retorna cache instantaneamente
    if (cachedNeighborhoods && !forceRefresh) {
        return cachedNeighborhoods;
    }

    try {
        const { data, error } = await supabase.from('neighborhoods').select('*').order('name');
        
        if (error) {
          console.error("Erro ao buscar bairros (Supabase):", error);
          return cachedNeighborhoods || [];
        }
        
        const hoods = (data || []).map(n => ({
          id: n.id,
          name: n.name,
          // Verifica ambas as colunas para garantir compatibilidade
          iframeUrl: n.iframe_url || n.camera_url || '', 
          description: n.description,
          lat: n.lat,
          lng: n.lng
        }));

        cachedNeighborhoods = hoods;
        return hoods;
    } catch (e) {
        console.error("Erro de conexão ao buscar bairros:", e);
        return [];
    }
  },

  getNeighborhoodById: async (id: string): Promise<Neighborhood | undefined> => {
    // Tenta cache primeiro
    if (cachedNeighborhoods) {
        const found = cachedNeighborhoods.find(n => n.id === id);
        if (found) return found;
    }

    // Busca direta segura
    try {
        const { data, error } = await supabase.from('neighborhoods').select('*').eq('id', id).maybeSingle();
        
        if (error || !data) {
            console.warn("Bairro não encontrado no banco:", id);
            return undefined;
        }

        return {
            id: data.id,
            name: data.name,
            iframeUrl: data.iframe_url || data.camera_url || '',
            description: data.description,
            lat: data.lat,
            lng: data.lng
        };
    } catch (e) {
        console.error("Erro ao buscar bairro por ID:", e);
        return undefined;
    }
  },

  createNeighborhood: async (name: string, description: string, lat?: number, lng?: number): Promise<Neighborhood> => {
    // Agora salvamos descrição em vez de iframe na criação
    const { data, error } = await supabase.from('neighborhoods').insert([{
      name,
      description: description, 
      lat,
      lng
    }]).select().single();
    
    if (error) throw error;
    cachedNeighborhoods = null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      iframeUrl: '', // Inicia sem câmera principal
      lat: data.lat,
      lng: data.lng
    };
  },

  updateNeighborhood: async (id: string, name: string, description: string): Promise<void> => {
      const { error } = await supabase.from('neighborhoods').update({
          name,
          description
      }).eq('id', id);

      if (error) throw error;
      cachedNeighborhoods = null;
  },

  deleteNeighborhood: async (id: string): Promise<void> => {
      // EXCLUSÃO EM CASCATA MANUAL (NUCLEAR OPTION)
      // Isso garante que mesmo sem configurações de FK no banco, os dados sejam limpos.
      try {
          console.log(`Iniciando limpeza profunda do bairro ${id}...`);

          // 1. Apagar Câmeras Extras
          await supabase.from('cameras').delete().eq('neighborhood_id', id);

          // 2. Apagar Alertas
          await supabase.from('alerts').delete().eq('neighborhood_id', id);

          // 3. Apagar Mensagens de Chat
          await supabase.from('chat_messages').delete().eq('neighborhood_id', id);

          // 4. Apagar Service Requests
          await supabase.from('service_requests').delete().eq('neighborhood_id', id);

          // 5. Apagar Logs de Ronda
          await supabase.from('patrol_logs').delete().eq('neighborhood_id', id);

          // 6. Desvincular Moradores (Set neighborhood_id = null)
          // Isso impede erro de chave estrangeira na tabela profiles
          await supabase.from('profiles').update({ neighborhood_id: null }).eq('neighborhood_id', id);

          // 7. Finalmente, apagar o Bairro
          const { error } = await supabase.from('neighborhoods').delete().eq('id', id);
          
          if (error) {
              console.error("Erro fatal ao excluir bairro:", error);
              throw error; // Repassa erro para UI
          }
          
          console.log("Bairro excluído com sucesso.");
          cachedNeighborhoods = null;

      } catch (e: any) {
          console.error("Falha no processo de exclusão:", e);
          throw new Error("Erro ao excluir bairro: " + e.message);
      }
  },

  // --- ADDITIONAL CAMERAS (New Feature) ---
  getAdditionalCameras: async (neighborhoodId: string): Promise<Camera[]> => {
      const safeId = sanitizeUUID(neighborhoodId);
      if (!safeId) return [];

      try {
          const { data, error } = await supabase.from('cameras').select('*').eq('neighborhood_id', safeId);
          if (error) {
              // Silencioso se a tabela não existir ainda para não quebrar a UI
              return [];
          }
          return data.map((c: any) => ({
              id: c.id,
              neighborhoodId: c.neighborhood_id,
              name: c.name,
              iframeCode: c.iframe_code,
              lat: c.lat,
              lng: c.lng
          }));
      } catch (e) {
          return [];
      }
  },

  // Busca TODAS as câmeras do sistema (para o mapa global)
  getAllSystemCameras: async (): Promise<Camera[]> => {
      try {
          const { data, error } = await supabase.from('cameras').select('*');
          if (error) return [];
          
          return data.map((c: any) => ({
              id: c.id,
              neighborhoodId: c.neighborhood_id,
              name: c.name,
              iframeCode: c.iframe_code,
              lat: c.lat,
              lng: c.lng
          }));
      } catch (e) {
          console.error("Erro ao buscar todas as câmeras:", e);
          return [];
      }
  },

  addCamera: async (neighborhoodId: string, name: string, iframeCode: string, lat?: number, lng?: number): Promise<Camera> => {
      const { data, error } = await supabase.from('cameras').insert([{
          neighborhood_id: neighborhoodId,
          name: name,
          iframe_code: iframeCode,
          lat: lat,
          lng: lng
      }]).select().single();

      if (error) throw error;

      return {
          id: data.id,
          neighborhoodId: data.neighborhood_id,
          name: data.name,
          iframeCode: data.iframe_code,
          lat: data.lat,
          lng: data.lng
      };
  },

  updateCamera: async (id: string, name: string, iframeCode: string, lat?: number, lng?: number): Promise<void> => {
      const { error } = await supabase.from('cameras').update({
          name: name,
          iframe_code: iframeCode,
          lat: lat,
          lng: lng
      }).eq('id', id);

      if (error) throw error;
  },

  deleteCamera: async (id: string): Promise<void> => {
      const { error } = await supabase.from('cameras').delete().eq('id', id);
      if (error) {
          console.error("Erro ao deletar câmera extra:", error);
          throw new Error(error.message);
      }
  },

  // --- DANGER ZONE: RESET CAMERAS ---
  resetSystemCameras: async (): Promise<void> => {
      try {
          // 1. Apagar todas as câmeras extras
          const { error: error1 } = await supabase.from('cameras').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error1) console.warn("Erro limpando tabela cameras:", error1);

          // 2. Limpar câmeras principais dos bairros (sem apagar os bairros)
          const { error: error2 } = await supabase.from('neighborhoods').update({ 
              iframe_url: null, 
              camera_url: null 
          }).neq('id', '00000000-0000-0000-0000-000000000000');
          if (error2) console.warn("Erro limpando colunas do bairro:", error2);
          
          cachedNeighborhoods = null;
      } catch (e) {
          console.error("Erro ao resetar câmeras:", e);
          throw new Error("Falha ao limpar câmeras do sistema.");
      }
  },

  // --- MAINTENANCE: FIX ORPHANED USERS ---
  maintenanceFixOrphans: async (): Promise<number> => {
      try {
          // 1. Get all valid Neighborhood IDs
          const { data: hoods, error: hoodError } = await supabase.from('neighborhoods').select('id');
          if (hoodError) throw hoodError;
          const validHoodIds = hoods.map(h => h.id);

          // 2. Get all users who HAVE a neighborhood_id
          const { data: users, error: userError } = await supabase
              .from('profiles')
              .select('id, neighborhood_id')
              .not('neighborhood_id', 'is', null);
              
          if (userError) throw userError;

          let fixCount = 0;
          
          // 3. Find invalid links and prepare batch updates
          // (Doing loops for safety/simplicity in mock, in production SQL function is better)
          const updates = [];
          for (const user of users) {
              if (!validHoodIds.includes(user.neighborhood_id)) {
                  updates.push(user.id);
              }
          }
          
          if (updates.length > 0) {
              // Batch update (Supabase `in` filter)
              const { error: updateError, count } = await supabase
                  .from('profiles')
                  .update({ neighborhood_id: null })
                  .in('id', updates)
                  .select('id', { count: 'exact' });
                  
              if (updateError) throw updateError;
              fixCount = count || updates.length;
          }
          
          cachedNeighborhoods = null;
          return fixCount;
      } catch (e: any) {
          console.error("Erro na manutenção do banco:", e);
          throw new Error(e.message);
      }
  },

  // --- ALERTS ---
  getAlerts: async (neighborhoodId?: string): Promise<Alert[]> => {
    let query = supabase.from('alerts').select('*').order('timestamp', { ascending: false }).limit(50);
    const safeNeighborhoodId = sanitizeUUID(neighborhoodId);

    // Se tiver ID de bairro, filtra. Se não tiver (Admin Global ou erro), tenta buscar tudo ou filtra nulo.
    // Para SCR e Integrador, é crucial que eles vejam os alertas do bairro.
    if (safeNeighborhoodId) {
      query = query.eq('neighborhood_id', safeNeighborhoodId);
    }
    const { data } = await query;
    return (data || []).map(a => ({
      id: a.id,
      type: a.type,
      userId: a.user_id,
      userName: a.user_name,
      neighborhoodId: a.neighborhood_id,
      timestamp: new Date(a.timestamp),
      message: a.message,
      image: a.image
    }));
  },

  createAlert: async (alert: Omit<Alert, 'id' | 'timestamp'> & { userRole?: UserRole }): Promise<Alert> => {
    const safeNeighborhoodId = sanitizeUUID(alert.neighborhoodId);

    const { data, error } = await supabase.from('alerts').insert([{
      type: alert.type,
      user_id: alert.userId,
      user_name: alert.userName,
      neighborhood_id: safeNeighborhoodId,
      message: alert.message,
      image: alert.image
    }]).select().single();

    if (error) {
        console.error("Erro ao criar alerta:", error);
        throw error;
    }

    // Auto-post to chat (Fire and Forget - Silent Catch)
    try {
        const alertMessages: Record<string, string> = {
            'PANIC': '🚨 PÂNICO ACIONADO! Preciso de ajuda urgente!',
            'DANGER': '⚠️ PERIGO REPORTADO. Fiquem atentos.',
            'SUSPICIOUS': '👀 Atividade suspeita reportada.',
            'OK': '✅ Tudo tranquilo por aqui.'
        };
        
        await supabase.from('chat_messages').insert([{
            neighborhood_id: safeNeighborhoodId,
            user_id: alert.userId,
            user_name: alert.userName,
            user_role: alert.userRole,
            text: alertMessages[alert.type] || 'Alerta',
            is_system_alert: true,
            alert_type: alert.type,
            image: alert.image
        }]);
    } catch (chatError) {
        console.warn("Falha não-crítica ao postar alerta no chat:", chatError);
    }

    return {
      id: data.id,
      type: data.type,
      userId: data.user_id,
      userName: data.user_name,
      neighborhoodId: data.neighborhood_id,
      timestamp: new Date(data.timestamp),
      message: data.message,
      image: data.image
    };
  },

  // --- PROTOCOLS ---
  generateProtocol: async (cameraName: string, lat?: number, lng?: number): Promise<CameraProtocol> => {
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

  // Notificar Admin sobre novo cadastro pendente
  notifyAdminOfRegistration: async (userName: string, userRole: string, neighborhoodName: string): Promise<void> => {
      try {
          // Envia notificação global (sem user_id definido) para que todos os admins vejam
          await supabase.from('notifications').insert([{
              type: 'REGISTRATION_REQUEST',
              title: 'Aprovação Necessária',
              message: `Novo ${userRole} (${userName}) cadastrado no bairro ${neighborhoodName}. Necessita liberação.`,
              from_user_name: 'Sistema',
              read: false
          }]);
      } catch (e) {
          console.error("Erro ao notificar admin:", e);
      }
  },

  getNotifications: async (userId?: string): Promise<Notification[]> => {
    // Busca notificações GLOBAIS (sem user_id) ou DIRECIONADAS (com user_id)
    let query = supabase.from('notifications').select('*').order('timestamp', { ascending: false });
    
    if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
    } else {
        query = query.is('user_id', null);
    }

    const { data } = await query;

    return (data || []).map(n => ({
      id: n.id,
      userId: n.user_id,
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
    const safeNeighborhoodId = sanitizeUUID(neighborhoodId);
    let query = supabase.from('chat_messages').select('*').order('timestamp', { ascending: true }).limit(100);
    
    if (safeNeighborhoodId) {
        query = query.eq('neighborhood_id', safeNeighborhoodId);
    } else {
        // Se for global ou sem bairro, tenta pegar mensagens sem bairro ou falha silenciosa
        query = query.is('neighborhood_id', null);
    }

    const { data } = await query;

    return (data || []).map(m => ({
      id: m.id,
      neighborhoodId: m.neighborhood_id,
      userId: m.user_id,
      userName: m.user_name,
      userRole: m.user_role as UserRole,
      text: m.text,
      timestamp: new Date(m.timestamp),
      isSystemAlert: m.is_system_alert,
      alertType: m.alert_type,
      image: m.image
    }));
  },

  sendMessage: async (msg: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> => {
    const safeNeighborhoodId = sanitizeUUID(msg.neighborhoodId);

    const { data, error } = await supabase.from('chat_messages').insert([{
      neighborhood_id: safeNeighborhoodId,
      user_id: msg.userId,
      user_name: msg.userName,
      user_role: msg.userRole,
      text: msg.text
    }]).select().single();

    if (error) {
        console.error("Erro ao enviar mensagem:", error);
        throw error;
    }
    
    return {
      id: data.id,
      neighborhoodId: data.neighborhood_id,
      userId: data.user_id,
      userName: data.user_name,
      userRole: data.user_role as UserRole,
      text: data.text,
      timestamp: new Date(data.timestamp),
      isSystemAlert: data.is_system_alert,
      alertType: data.alert_type,
      image: data.image
    };
  },

  // --- USERS & PROFILES ---
  getUsers: async (neighborhoodId?: string): Promise<User[]> => {
    let query = supabase.from('profiles').select('*');
    const safeNeighborhoodId = sanitizeUUID(neighborhoodId);
    
    // Se ID fornecido, filtra. Se não (Admin Global), traz tudo.
    if (safeNeighborhoodId) {
        query = query.eq('neighborhood_id', safeNeighborhoodId);
    }
    
    const { data } = await query;
    return (data || []).map(mapProfileToUser);
  },

  createResident: async (userData: Partial<User>, neighborhoodId: string): Promise<User> => {
      const tempId = crypto.randomUUID();
      const safeNeighborhoodId = sanitizeUUID(neighborhoodId);

      const { data, error } = await supabase.from('profiles').insert([{
          id: tempId,
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          address: userData.address,
          neighborhood_id: safeNeighborhoodId,
          role: 'RESIDENT',
          plan: 'FREE',
          approved: true 
      }]).select().single();

      if (error) throw new Error(error.message);
      return mapProfileToUser(data);
  },

  adminUpdateUser: async (userId: string, data: { name?: string, phone?: string, neighborhoodId?: string | null }): Promise<void> => {
      const updatePayload: any = {};
      
      // Permitir atualização de campos para vazio se enviado
      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.phone !== undefined) updatePayload.phone = data.phone;
      
      // Handle neighborhood update explicitly without over-sanitization
      if (data.neighborhoodId !== undefined) {
          // If empty string or null is passed, we explicitly set null in DB
          if (data.neighborhoodId === null || data.neighborhoodId === '') {
              updatePayload.neighborhood_id = null;
          } else {
              updatePayload.neighborhood_id = data.neighborhoodId;
          }
      }

      const { error } = await supabase.from('profiles').update(updatePayload).eq('id', userId);
      if (error) throw new Error(error.message);
  },

  deleteUser: async (id: string): Promise<void> => {
      await supabase.from('profiles').delete().eq('id', id);
  },

  // Aprovar Usuário (SCR/Integrator)
  approveUser: async (userId: string): Promise<void> => {
      const { error } = await supabase
          .from('profiles')
          .update({ approved: true })
          .eq('id', userId);
      
      if (error) throw error;
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
  },

  // --- INTEGRATOR CONFIG ---
  updateIntegratorConfig: async (userId: string, publicKey: string, accessToken: string): Promise<void> => {
      const { error } = await supabase
          .from('profiles')
          .update({ mp_public_key: publicKey, mp_access_token: accessToken })
          .eq('id', userId);
      
      if (error) throw error;
  },

  getNeighborhoodIntegrator: async (neighborhoodId: string): Promise<User | null> => {
      const safeId = sanitizeUUID(neighborhoodId);
      if (!safeId) return null;

      try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('neighborhood_id', safeId)
            .eq('role', 'INTEGRATOR');

        if (error || !data || data.length === 0) return null;
        return mapProfileToUser(data[0]);
      } catch (e) {
          return null; // Fail safe
      }
  },

  // --- PATROL LOGS (SCR) ---
  registerPatrol: async (userId: string, neighborhoodId: string, note: string, lat?: number, lng?: number, targetUserId?: string): Promise<void> => {
      const safeNeighborhoodId = sanitizeUUID(neighborhoodId);
      
      // 1. Cria o log de ronda
      const { error } = await supabase.from('patrol_logs').insert([{
          user_id: userId,
          neighborhood_id: safeNeighborhoodId,
          target_user_id: targetUserId,
          note: note,
          lat: lat,
          lng: lng
      }]);
      
      if (error) {
          console.error("Erro ao registrar ronda:", error);
          throw new Error('Falha ao registrar check-in');
      }

      // 2. ATUALIZA A POSIÇÃO DO SCR NO PERFIL PARA O MAPA
      if (lat && lng) {
          try {
              await supabase.from('profiles').update({
                  lat: lat,
                  lng: lng
              }).eq('id', userId);
          } catch (posError) {
              console.warn("Erro ao atualizar posição do SCR no mapa:", posError);
          }
      }

      // 3. Se houver um morador alvo, cria uma notificação para ele
      if (targetUserId) {
          try {
              await supabase.from('notifications').insert([{
                  user_id: targetUserId,
                  type: 'PATROL_ALERT',
                  title: 'Aviso do Motovigia (SCR)',
                  message: `Registro de atividade em sua residência: ${note}`,
                  from_user_name: 'Equipe Tática',
                  read: false
              }]);
          } catch (notifError) {
              console.warn("Erro ao notificar morador, mas log foi salvo:", notifError);
          }
      }
  },

  // --- SERVICE REQUESTS (PREMIUM TO SCR) ---
  createServiceRequest: async (userId: string, userName: string, neighborhoodId: string, type: 'ESCORT' | 'EXTRA_ROUND' | 'TRAVEL_NOTICE'): Promise<void> => {
      const safeNeighborhoodId = sanitizeUUID(neighborhoodId);
      
      const { error } = await supabase.from('service_requests').insert([{
          user_id: userId,
          user_name: userName,
          neighborhood_id: safeNeighborhoodId,
          request_type: type,
          status: 'PENDING'
      }]);

      if (error) {
          console.error("Erro ao solicitar serviço:", error);
          throw new Error('Falha ao enviar solicitação ao SCR');
      }
      
      // NOTIFICAR SCRs DO BAIRRO
      try {
          const scrs = await MockService.getNeighborhoodSCRs(safeNeighborhoodId || '');
          const notifs = scrs.map(scr => ({
              user_id: scr.id,
              type: 'PATROL_ALERT',
              title: 'NOVA SOLICITAÇÃO VIP',
              message: `${userName} solicitou: ${type}`,
              from_user_name: userName
          }));

          if (notifs.length > 0) {
              const { error: notifError } = await supabase.from('notifications').insert(notifs);
              if(notifError) console.error("Erro notificando SCR:", notifError);
          }
      } catch (err) {
          console.error("Falha no fluxo de notificação SCR:", err);
      }
  },

  getNeighborhoodSCRs: async (neighborhoodId: string): Promise<User[]> => {
      const safeId = sanitizeUUID(neighborhoodId);
      if (!safeId) return [];
      
      // Busca usuários SCR do bairro. 
      // O RLS deve permitir que qualquer authenticated leia profiles.
      const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('neighborhood_id', safeId)
          .eq('role', 'SCR');
          
      return (data || []).map(mapProfileToUser);
  },

  getServiceRequests: async (neighborhoodId: string): Promise<ServiceRequest[]> => {
      const safeNeighborhoodId = sanitizeUUID(neighborhoodId);
      if (!safeNeighborhoodId) return [];

      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('neighborhood_id', safeNeighborhoodId)
        .order('created_at', { ascending: false });

      if (error) return [];

      return data.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.user_name,
          neighborhoodId: r.neighborhood_id,
          requestType: r.request_type,
          status: r.status,
          createdAt: new Date(r.created_at)
      }));
  }
};