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

// --- FUNÇÃO AUXILIAR DE DISPARO WHATSAPP VIA EDGE FUNCTION (BACKEND) ---
const triggerEdgeFunctionAlert = async (message: string, targetNumbers?: string[]) => {
    // Se não houver números alvo, não dispara para evitar spam no grupo padrão em casos de login/cadastro
    // EXCETO se targetNumbers for undefined (aí usa o default)
    if (targetNumbers && targetNumbers.length === 0) {
        console.warn("⚠️ Tentativa de envio de WhatsApp cancelada: Lista de números vazia.");
        return;
    }

    console.log(`🚀 Acionando Edge Function 'send-alert'. Alvos: ${targetNumbers?.length || 'Grupo Padrão'}`);
    try {
        const { data, error } = await supabase.functions.invoke('send-alert', {
            body: { 
                message: message,
                numbers: targetNumbers // Envia a lista de números (se houver)
            }
        });

        if (error) {
            console.error("❌ Erro na Edge Function:", error);
            throw error; // Propaga erro para a UI pegar
        } else {
            console.log("✅ Alerta processado pelo Backend:", data);
            return data;
        }
    } catch (err) {
        console.error("❌ Falha crítica ao chamar Edge Function:", err);
        throw err;
    }
};

// Helper para limpar telefone (Ex: +55 (48) 999... -> 5548999...)
const cleanPhoneForWhatsapp = (phone?: string): string | null => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, ''); // Remove tudo que não é número
    if (cleaned.length < 10) return null; // Número inválido
    return cleaned; 
};

export const MockService = {
  // --- GEOLOCATION HELPER (Novo) ---
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distância em km
    return d;
  },

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
      try {
          console.log(`Iniciando limpeza profunda do bairro ${id}...`);

          await supabase.from('cameras').delete().eq('neighborhood_id', id);
          await supabase.from('alerts').delete().eq('neighborhood_id', id);
          await supabase.from('chat_messages').delete().eq('neighborhood_id', id);
          await supabase.from('service_requests').delete().eq('neighborhood_id', id);
          await supabase.from('patrol_logs').delete().eq('neighborhood_id', id);
          await supabase.from('profiles').update({ neighborhood_id: null }).eq('neighborhood_id', id);
          
          const { error } = await supabase.from('neighborhoods').delete().eq('id', id);
          
          if (error) {
              console.error("Erro fatal ao excluir bairro:", error);
              throw error; 
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

  resetSystemCameras: async (): Promise<void> => {
      try {
          const { error: error1 } = await supabase.from('cameras').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error1) console.warn("Erro limpando tabela cameras:", error1);

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

  maintenanceFixOrphans: async (): Promise<number> => {
      try {
          const { data: hoods, error: hoodError } = await supabase.from('neighborhoods').select('id');
          if (hoodError) throw hoodError;
          const validHoodIds = hoods.map(h => h.id);

          const { data: users, error: userError } = await supabase
              .from('profiles')
              .select('id, neighborhood_id')
              .not('neighborhood_id', 'is', null);
              
          if (userError) throw userError;

          let fixCount = 0;
          const updates = [];
          for (const user of users) {
              if (!validHoodIds.includes(user.neighborhood_id)) {
                  updates.push(user.id);
              }
          }
          
          if (updates.length > 0) {
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

    // 1. SALVAR NO SUPABASE (Log Central)
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

    // 2. DISPARAR WHATSAPP INDIVIDUAL (BROADCAST) VIA BACKEND
    (async () => {
        try {
            // CUSTOMIZAÇÃO PARA SCR (MOTOVIGIA)
            const isSCR = alert.userRole === UserRole.SCR;
            
            const emojis: Record<string, string> = {
                'PANIC': '🚨🚨 PÂNICO',
                'DANGER': '⚠️⚠️ PERIGO',
                'SUSPICIOUS': '👀 SUSPEITA',
                'OK': '✅ TUDO BEM'
            };
            
            let title = emojis[alert.type] || 'ALERTA';
            if (isSCR) {
                title = `👮 *ALERTA TÁTICO - MOTOVIGIA*\n${title}`;
            } else {
                title = `🛡️ *ATALAIA SEGURANÇA COLABORATIVA*\n${title}`;
            }
            
            // Busca o nome real do bairro para a mensagem
            let locationMsg = '(Global)';
            if (safeNeighborhoodId) {
                const { data: hood } = await supabase.from('neighborhoods').select('name').eq('id', safeNeighborhoodId).single();
                if (hood) locationMsg = `Bairro ${hood.name}`;
                else locationMsg = `Identificação do Bairro: ${safeNeighborhoodId.slice(0,4)}...`;
            }
            
            // Tradução de Perfil
            const roleMap: Record<string, string> = {
                'RESIDENT': 'Morador',
                'ADMIN': 'Administrador',
                'SCR': 'Motovigia',
                'INTEGRATOR': 'Integrador'
            };
            const displayRole = alert.userRole ? (roleMap[alert.userRole] || alert.userRole) : 'Usuário';

            const waBody = `${title}\n\n👤 *Solicitante:* ${alert.userName} (${displayRole})\n📍 *Local:* ${locationMsg}\n📝 *Relato:* ${alert.message || 'Sem descrição'}\n🕒 *Horário:* ${new Date().toLocaleTimeString()}\n\n🔗 Abra o app para ver: https://atalaia.cloud/#/login`;
            
            // --- NOVA LÓGICA DE BROADCAST INDIVIDUAL ---
            let phoneNumbers: string[] = [];

            if (safeNeighborhoodId) {
                // Busca telefones de todos os usuários deste bairro
                const { data: neighbors } = await supabase
                    .from('profiles')
                    .select('phone')
                    .eq('neighborhood_id', safeNeighborhoodId)
                    .neq('id', alert.userId); // Não envia para quem disparou (opcional)

                if (neighbors) {
                    phoneNumbers = neighbors
                        .map(u => cleanPhoneForWhatsapp(u.phone))
                        .filter(p => p !== null) as string[];
                }
            }
            
            // Envia para a Edge Function com a lista de destinatários
            if (phoneNumbers.length > 0) {
                await triggerEdgeFunctionAlert(waBody, phoneNumbers);
            } else {
                console.warn("Nenhum telefone válido encontrado no bairro para broadcast. Enviando para fallback.");
                await triggerEdgeFunctionAlert(waBody); 
            }

        } catch (waError) {
            console.error("Erro silencioso ao processar envio WhatsApp:", waError);
        }
    })();

    // 3. POSTAR NO CHAT INTERNO
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

  // --- NOTIFICAÇÕES & WHATSAPP ---

  // Método genérico para envio de mensagem
  sendWhatsAppMessage: async (message: string, numbers: string[]) => {
      await triggerEdgeFunctionAlert(message, numbers);
  },
  
  // NOVO: Método de Broadcast Administrativo (Custom Message)
  sendCustomBroadcast: async (message: string, targetType: 'ALL' | 'ADMINS' | 'HOOD', targetHoodId?: string): Promise<{ sentCount: number }> => {
      // 1. Identificar quem deve receber
      let query = supabase.from('profiles').select('phone');

      if (targetType === 'ADMINS') {
          query = query.eq('role', 'ADMIN');
      } else if (targetType === 'HOOD' && targetHoodId) {
          query = query.eq('neighborhood_id', targetHoodId);
      }
      // Se ALL, não aplica filtro, pega todos

      const { data, error } = await query;
      if (error) throw error;

      // 2. Limpar telefones
      const phoneNumbers = (data || [])
          .map(u => cleanPhoneForWhatsapp(u.phone))
          .filter(p => p !== null) as string[];

      // 3. Enviar se houver destinatários
      if (phoneNumbers.length > 0) {
          await triggerEdgeFunctionAlert(message, phoneNumbers);
      } else {
          // Se for teste ou não tiver ninguém, tenta mandar pro fallback (opcional, aqui vou retornar 0)
          console.warn("Nenhum destinatário válido para o broadcast.");
      }

      return { sentCount: phoneNumbers.length };
  },

  // Notifica ADMINs sobre novo cadastro (incluindo WhatsApp)
  notifyAdminOfRegistration: async (pendingUserId: string, userName: string, userRole: string, neighborhoodName: string): Promise<void> => {
      try {
          // 1. Notificação interna COM DADOS PARA AÇÃO
          await supabase.from('notifications').insert([{
              type: 'REGISTRATION_REQUEST',
              title: 'Aprovação Necessária',
              message: `Novo ${userRole} (${userName}) cadastrado no bairro ${neighborhoodName}. Necessita liberação.`,
              data: { pendingUserId }, // Salva o ID para o botão de aprovar funcionar
              from_user_name: 'Sistema',
              read: false
          }]);
          
          // 2. WhatsApp para Admins
          await MockService.notifyAdmins(userName, userRole, neighborhoodName);

      } catch (e) {
          console.error("Erro ao notificar admin:", e);
      }
  },

  // Notifica Admins (WhatsApp)
  notifyAdmins: async (newUserName: string, role: string, neighborhoodName: string) => {
      try {
          const { data: admins } = await supabase.from('profiles').select('phone').eq('role', 'ADMIN');
          
          // Translate role for msg
          const roleMap: Record<string, string> = { 'RESIDENT': 'Morador', 'SCR': 'Motovigia', 'INTEGRATOR': 'Integrador' };
          const ptRole = roleMap[role] || role;

          const msg = `🔔 *ATALAIA - NOVO CADASTRO*\n\n👤 *Nome:* ${newUserName}\n🛡️ *Perfil:* ${ptRole}\n📍 *Bairro:* ${neighborhoodName}\n\n🔗 https://atalaia.cloud/#/integrator/users`;

          let adminPhones: string[] = [];
          
          if (admins && admins.length > 0) {
              adminPhones = admins
                  .map(a => cleanPhoneForWhatsapp(a.phone))
                  .filter(p => p !== null) as string[];
          }

          if (adminPhones.length > 0) {
              await triggerEdgeFunctionAlert(msg, adminPhones);
          } else {
              // FALLBACK: Se nenhum admin tiver telefone cadastrado, envia para o Grupo Padrão (sem lista de números)
              // Isso garante que o alerta não seja perdido silenciosamente
              console.warn("Nenhum telefone de Admin encontrado. Enviando para grupo padrão.");
              await triggerEdgeFunctionAlert(msg); 
          }
      } catch (e) {
          console.error("Erro ao enviar Whats para Admin:", e);
      }
  },

  // Notifica Usuário sobre Login (Segurança)
  notifyUserLogin: async (user: User) => {
      try {
          const phone = cleanPhoneForWhatsapp(user.phone);
          if (phone) {
              const msg = `🔐 *ATALAIA SEGURANÇA COLABORATIVA*\n\nOlá ${user.name}, detectamos um novo acesso à sua conta agora.\n📅 *Data:* ${new Date().toLocaleString()}\n\n_Se não foi você, contate o administrador imediatamente._`;
              await triggerEdgeFunctionAlert(msg, [phone]);
          }
      } catch (e) {
          console.error("Erro ao notificar login:", e);
      }
  },

  getNotifications: async (userId?: string): Promise<Notification[]> => {
    let query = supabase.from('notifications').select('*').order('timestamp', { ascending: false });
    
    if (userId) {
        // Se for usuário comum, vê apenas as suas
        query = query.eq('user_id', userId);
    } else {
        // Se userId for undefined (Admin view), vê as globais (null) e as dele mesmo se quisesse, 
        // mas o dashboard admin costuma puxar as globais.
        // CORREÇÃO: REGISTRATION_REQUEST são globais (user_id is null).
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
      
      // Notifica Admin sobre novo cadastro manual via painel
      const hoodName = (await MockService.getNeighborhoodById(safeNeighborhoodId || ''))?.name || 'Desconhecido';
      MockService.notifyAdmins(userData.name || 'Novo Usuário', 'RESIDENT', hoodName);

      return mapProfileToUser(data);
  },

  adminUpdateUser: async (userId: string, data: { name?: string, phone?: string, neighborhoodId?: string | null }): Promise<void> => {
      const updatePayload: any = {};
      
      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.phone !== undefined) updatePayload.phone = data.phone;
      
      if (data.neighborhoodId !== undefined) {
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

  approveUser: async (userId: string): Promise<void> => {
      // 1. UPDATE com checagem de linhas afetadas (count)
      const { error, count } = await supabase
          .from('profiles')
          .update({ approved: true })
          .eq('id', userId)
          .select('id', { count: 'exact' });
      
      if (error) {
          const msg = error.message?.toLowerCase() || '';
          // Detectar erro de recursão e dar mensagem amigável
          if (msg.includes("infinite recursion") || msg.includes("policy")) {
              throw new Error("ERRO CRÍTICO: Loop nas permissões do banco (RLS). Execute o script SQL de correção no Supabase.");
          }
          throw error;
      }

      if (count === 0) {
          throw new Error("Falha na aprovação: Permissão negada ou usuário não encontrado. Verifique as políticas RLS.");
      }
      
      // Tenta buscar o usuário para notificar via WhatsApp
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data && data.phone) {
          const phone = cleanPhoneForWhatsapp(data.phone);
          if (phone) {
             const msg = `✅ *CADASTRO APROVADO*\n\nParabéns ${data.name}, seu acesso ao sistema Atalaia foi liberado pelo administrador.\nVocê já pode fazer login.`;
             await triggerEdgeFunctionAlert(msg, [phone]);
          }
      }
  },

  getPlans: async (): Promise<Plan[]> => {
      // Retornar hardcoded para garantir que as descrições estejam atualizadas com a lógica de Geo e WhatsApp
      return [
          {
              id: 'FREE',
              name: 'Gratuito',
              price: '0,00',
              features: [
                  'Monitoramento básico', 
                  'Notificações no WhatsApp', // Added feature
                  'Sem acesso a câmeras',     // Added limitation explicit
                  '5 alertas/mês', 
                  'Histórico de 7 dias'
              ]
          },
          {
              id: 'FAMILY',
              name: 'Família',
              price: '39,90',
              features: [
                  'Acesso às 3 Câmeras mais próximas (Geo)', 
                  'Notificações no WhatsApp', // Added feature
                  'Alertas em tempo real', 
                  'Chat Comunitário', 
                  'Histórico de 30 dias'
              ],
              recommended: true
          },
          {
              id: 'PREMIUM',
              name: 'Prêmio',
              price: '79,90',
              features: [
                  'Acesso a TODAS as câmeras do bairro',
                  'Notificações no WhatsApp', // Added feature
                  'Suporte SCR / Motovigia',
                  'Prioridade Máxima',
                  'Tudo do plano Família'
              ]
          }
      ];
  },

  updateUserPlan: async (userId: string, planId: string): Promise<void> => {
      const { error } = await supabase.from('profiles').update({ plan: planId }).eq('id', userId);
      if (error) throw error;
  },

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
          return null; 
      }
  },

  registerPatrol: async (userId: string, neighborhoodId: string, note: string, lat?: number, lng?: number, targetUserId?: string): Promise<void> => {
      const safeNeighborhoodId = sanitizeUUID(neighborhoodId);
      
      // 1. SALVAR LOG NO BANCO
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

      // 2. ATUALIZAR POSIÇÃO DO SCR
      if (lat && lng) {
          try {
              await supabase.from('profiles').update({ lat, lng }).eq('id', userId);
          } catch (posError) {
              console.warn("Erro ao atualizar posição do SCR no mapa:", posError);
          }
      }

      // 3. WHATSAPP NOTIFICATIONS (NEW FEATURE)
      (async () => {
          try {
              // Obter dados do SCR (Operador)
              const { data: scrProfile } = await supabase.from('profiles').select('name').eq('id', userId).single();
              const scrName = scrProfile?.name || 'Motovigia';

              // Obter nome do Bairro
              let hoodName = 'Bairro';
              if (safeNeighborhoodId) {
                  const { data: h } = await supabase.from('neighborhoods').select('name').eq('id', safeNeighborhoodId).single();
                  if (h) hoodName = h.name;
              }

              // --- CENÁRIO A: CHECK-IN VIP EM MORADOR ESPECÍFICO ---
              if (targetUserId) {
                  const { data: user } = await supabase.from('profiles').select('phone, name').eq('id', targetUserId).single();
                  if (user && user.phone) {
                      const phone = cleanPhoneForWhatsapp(user.phone);
                      if (phone) {
                          const msg = `👮 *RONDA TÁTICA - ATALAIA*\n\nOlá ${user.name}, o operador *${scrName}* registrou uma atividade relacionada à sua residência.\n\n📝 *Registro:* ${note}\n📍 *Local:* ${hoodName}\n🕒 *Horário:* ${new Date().toLocaleTimeString()}\n\n_Verifique o app para mais detalhes._`;
                          await triggerEdgeFunctionAlert(msg, [phone]);
                      }
                  }
                  return; // Sai se for VIP, não manda para geral
              }

              // --- CENÁRIO B: OCORRÊNCIAS GERAIS (Luz, Portão, Suspeita) ---
              
              // Se for "VIOLAÇÃO" ou "SUSPEITO" -> BROADCAST PARA VIZINHOS (CRÍTICO)
              const isCritical = note.toUpperCase().includes("VIOLAÇÃO") || note.toUpperCase().includes("SUSPEITO") || note.toUpperCase().includes("VEÍCULO");
              
              // Se for Manutenção (Luz, Portão) -> Apenas ADMINS / INTEGRADOR
              const isMaintenance = note.toUpperCase().includes("LUZ") || note.toUpperCase().includes("PORTÃO") || note.toUpperCase().includes("LÂMPADA");

              if (isCritical && safeNeighborhoodId) {
                   const { data: neighbors } = await supabase
                      .from('profiles')
                      .select('phone')
                      .eq('neighborhood_id', safeNeighborhoodId)
                      .neq('id', userId); // Não manda pro próprio SCR

                   const phones = (neighbors || []).map(u => cleanPhoneForWhatsapp(u.phone)).filter(p => p !== null) as string[];
                   
                   if (phones.length > 0) {
                       const msg = `⚠️ *ALERTA DA RONDA - ATALAIA*\n\nO operador *${scrName}* identificou uma situação no bairro *${hoodName}*.\n\n📝 *Relato:* ${note}\n🕒 *Horário:* ${new Date().toLocaleTimeString()}\n\n_Fiquem atentos._`;
                       await triggerEdgeFunctionAlert(msg, phones);
                   }

              } else if (isMaintenance && safeNeighborhoodId) {
                   // Busca Admins e Integradores deste bairro
                   const { data: staff } = await supabase
                      .from('profiles')
                      .select('phone')
                      .or(`role.eq.ADMIN,and(role.eq.INTEGRATOR,neighborhood_id.eq.${safeNeighborhoodId})`);

                   const staffPhones = (staff || []).map(u => cleanPhoneForWhatsapp(u.phone)).filter(p => p !== null) as string[];

                   if (staffPhones.length > 0) {
                        const msg = `🛠️ *MANUTENÇÃO - ATALAIA*\n\nO Motovigia reportou um problema em *${hoodName}*.\n\n📝 *Item:* ${note}\n👤 *Operador:* ${scrName}`;
                        await triggerEdgeFunctionAlert(msg, staffPhones);
                   }
              }

          } catch (waError) {
              console.error("Erro no envio de WA do SCR:", waError);
          }
      })();
  },

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
      
      try {
          // Busca endereço do morador para incluir na msg
          const { data: userProfile } = await supabase.from('profiles').select('address').eq('id', userId).single();
          const userAddress = userProfile?.address || 'Endereço não cadastrado';

          const scrs = await MockService.getNeighborhoodSCRs(safeNeighborhoodId || '');
          const notifs = scrs.map(scr => ({
              user_id: scr.id,
              type: 'PATROL_ALERT',
              title: 'NOVA SOLICITAÇÃO VIP',
              message: `${userName} solicitou: ${type}`,
              from_user_name: userName
          }));

          // Mapa de tradução
          const typeMap: Record<string, string> = {
              'ESCORT': 'ESCOLTA (Acompanhamento)',
              'EXTRA_ROUND': 'RONDA EXTRA NO LOCAL',
              'TRAVEL_NOTICE': 'AVISO DE VIAGEM'
          };
          const ptType = typeMap[type] || type;
          const msg = `⭐ *SOLICITAÇÃO VIP - ATALAIA*\n\nO morador *${userName}* solicitou um serviço exclusivo.\n\n🛠️ *Tipo:* ${ptType}\n📍 *Local:* ${userAddress}\n🕒 *Horário:* ${new Date().toLocaleTimeString()}\n\n_Verifique o Painel Tático imediatamente._`;

          if (notifs.length > 0) {
              const { error: notifError } = await supabase.from('notifications').insert(notifs);
              if(notifError) console.error("Erro notificando SCR:", notifError);
              
              // Notifica SCRs via WhatsApp
              const scrPhones = scrs.map(s => cleanPhoneForWhatsapp(s.phone)).filter(p => p !== null) as string[];
              
              if (scrPhones.length > 0) {
                  await triggerEdgeFunctionAlert(msg, scrPhones);
              } else {
                  // Fallback: Se tiver SCRs mas sem telefone, manda para o grupo
                  console.warn("SCRs encontrados mas sem telefone cadastrado. Enviando para grupo.");
                  await triggerEdgeFunctionAlert(msg);
              }
          } else {
              // Fallback Critical: Se NÃO EXISTEM SCRs no bairro, manda para o grupo/admin para não perder o pedido
              console.warn("Nenhum SCR encontrado no bairro. Enviando solicitação VIP para grupo de alerta (Fallback).");
              await triggerEdgeFunctionAlert(msg);
          }
      } catch (err) {
          console.error("Falha no fluxo de notificação SCR:", err);
      }
  },

  getNeighborhoodSCRs: async (neighborhoodId: string): Promise<User[]> => {
      const safeId = sanitizeUUID(neighborhoodId);
      if (!safeId) return [];
      
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