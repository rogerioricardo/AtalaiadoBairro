
// Follow this setup guide to integrate the Deno runtime into your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// --- CONFIGURAÇÃO OBRIGATÓRIA ---
// ATENÇÃO: Substitua pela URL onde SEU Whaticket está instalado
// Exemplo: "https://api.meusite.com.br" ou "http://200.100.50.20:8080"
const WHATICKET_API_URL = "https://whatsapp.atalaia.cloud:443/backend/api"; 

const WHATICKET_API_TOKEN = "htGbba00iOEb9B74jRl2Y2lStYcSsEuJJvC2ST3IwCI5tcxFiu71WXxfHWwUeYC1";
const DEFAULT_DESTINATION = "120363025345678901@g.us"; // ID do Grupo Padrão (Fallback)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, number, numbers } = await req.json()

    // Validação básica
    if (!message) {
      throw new Error("Mensagem é obrigatória")
    }

    // Define a lista de destinatários
    let targets: string[] = [];

    if (numbers && Array.isArray(numbers) && numbers.length > 0) {
      // Modo Broadcast: Lista de números individuais
      targets = numbers;
      console.log(`🚀 [Edge Function] Modo Broadcast para ${targets.length} números.`);
    } else {
      // Modo Grupo/Único: Usa o numero fornecido ou o padrão
      targets = [number || DEFAULT_DESTINATION];
      console.log(`🚀 [Edge Function] Modo Único para ${targets[0]}`);
    }

    // Função auxiliar para enviar uma mensagem
    const sendMessage = async (targetNumber: string) => {
      try {
        // Tenta remover barra no final se o usuário tiver colocado
        const baseUrl = WHATICKET_API_URL.replace(/\/$/, "");
        
        const response = await fetch(`${baseUrl}/messages/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WHATICKET_API_TOKEN}`
          },
          body: JSON.stringify({
            number: targetNumber,
            body: message,
            token: WHATICKET_API_TOKEN
          })
        });
        return await response.text();
      } catch (err) {
        return `Erro ao enviar para ${targetNumber}: ${err}`;
      }
    };

    // Dispara para todos os alvos (Promise.all para paralelismo)
    const results = await Promise.all(targets.map(num => sendMessage(num)));

    console.log("✅ Envios processados.");

    return new Response(JSON.stringify({ success: true, count: results.length, details: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("❌ Erro Edge Function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})