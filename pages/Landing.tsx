
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Zap, MessageSquare, Users, MapPin, Bell, Clock, BarChart3, MessageCircle, Menu, X } from 'lucide-react';
import { Button } from '../components/UI';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogin = () => navigate('/login');

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed w-full z-50 bg-[#050505]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-atalaia-neon h-6 w-6" />
              <span className="text-xl font-bold tracking-tight text-white">ATALAIA</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
              <button onClick={() => scrollToSection('como-funciona')} className="text-gray-300 hover:text-white transition-colors">Como funciona</button>
              <button onClick={() => scrollToSection('funcionalidades')} className="text-gray-300 hover:text-white transition-colors">Funcionalidades</button>
              <button onClick={() => scrollToSection('planos')} className="text-gray-300 hover:text-white transition-colors">Planos</button>
            </div>
            
            <div className="hidden md:flex items-center gap-4">
               {/* Botão de Cadastro removido do topo conforme solicitado */}
               {/* Botão de Login transformado em botão principal verde */}
               <Button onClick={handleLogin} variant="primary" className="px-6 py-2 text-sm font-bold">
                 Login
               </Button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Menu Principal"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 w-full bg-[#0a0a0a] border-b border-white/10 px-4 py-6 flex flex-col gap-4 shadow-2xl animate-in slide-in-from-top-5">
             <button onClick={() => scrollToSection('como-funciona')} className="text-left text-base font-medium text-gray-300 hover:text-atalaia-neon py-2">Como funciona</button>
             <button onClick={() => scrollToSection('funcionalidades')} className="text-left text-base font-medium text-gray-300 hover:text-atalaia-neon py-2">Funcionalidades</button>
             <button onClick={() => scrollToSection('planos')} className="text-left text-base font-medium text-gray-300 hover:text-atalaia-neon py-2">Planos</button>
             <hr className="border-white/10 my-2" />
             <Button onClick={handleLogin} variant="primary" className="w-full justify-center py-3 font-bold">
                 Login
             </Button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen min-h-[600px] flex items-center justify-center pt-20 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://locacess.com.br/wp-content/uploads/2024/11/Cameras-de-bairro-aumentando-a-Seguranca-Comunitaria.jpg" 
            alt="Rua residencial à noite com vigilância" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-black/40"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-start w-full">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight mb-6 max-w-3xl">
            Atalaia — <span className="text-atalaia-neon">Segurança</span><br />
            <span className="text-atalaia-neon">Colaborativa</span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mb-10 leading-relaxed">
            Vigie sua rua. Proteja sua comunidade. Sistema de alertas comunitários com mapas em tempo real e integração com WhatsApp.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            {/* Redireciona para Planos em vez de cadastrar direto */}
            <Button onClick={() => scrollToSection('planos')} className="h-12 sm:h-14 px-8 text-sm sm:text-base font-bold uppercase tracking-wide w-full sm:w-auto">
              Criar Grupo do meu Bairro
            </Button>
            <button 
                onClick={handleLogin}
                className="h-12 sm:h-14 px-8 text-sm sm:text-base font-medium text-white border border-white/20 rounded-lg hover:bg-white/10 hover:border-white transition-all uppercase tracking-wide w-full sm:w-auto"
            >
              Entrar no Sistema
            </button>
          </div>
        </div>
      </section>

      {/* Seção Como Funciona */}
      <section id="como-funciona" className="py-16 md:py-24 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Como funciona?</h2>
            <p className="text-gray-400">Um ciclo simples para uma segurança poderosa.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                icon: Users, 
                title: "Cadastro", 
                desc: "O integrador cadastra sua rua e moradores e se inscreve em poucos passos." 
              },
              { 
                icon: Zap, 
                title: "Alerta Instantâneo", 
                desc: "Moradores contam alertas de perigo ou suspeitas que são divulgadas em tempo real." 
              },
              { 
                icon: MessageSquare, 
                title: "Notificação: sem WhatsApp", 
                desc: "O alerta vai instantaneamente para o WhatsApp da comunidade inteira via chatbot." 
              },
              { 
                icon: ShieldCheck, 
                title: "Comunidade Segura", 
                desc: "Ajuda rápida e coordenada em menos a segurança de todos os moradores." 
              }
            ].map((item, i) => (
              <div key={i} className="bg-[#111] p-6 md:p-8 rounded-2xl border border-white/5 hover:border-atalaia-neon/30 transition-all hover:-translate-y-1">
                <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-atalaia-neon mb-6 border border-white/5">
                  <item.icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção Funcionalidades */}
      <section id="funcionalidades" className="py-16 md:py-24 bg-[#050505] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Funcionalidades</h2>
            <p className="text-gray-400">Ferramentas para uma vigilância completa e colaborativa.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              { icon: MapPin, title: "Mapa Interativo", desc: "Visualize todos os alertas em tempo real na tela do seu celular." },
              { icon: Bell, title: "Botão de Alerta", desc: "Envie alertas de Perigo, Suspeita ou Tudo OK com apenas um toque." },
              { icon: Clock, title: "Histórico de Eventos", desc: "Acesse um histórico completo das ocorrências em seu bairro." },
              { icon: ShieldCheck, title: "Painel Administrativo", desc: "Gerencia completa de usuários, regiões e alertas para administradores." },
              { icon: BarChart3, title: "Estatísticas de Segurança", desc: "Gráficos e relatórios sobre a frequência e tipo de alertas do bairro." },
              { icon: MessageCircle, title: "Bate-papo em Tempo Real", desc: "Comunique-se instantaneamente com todos os vizinhos para coordenar e ajudar." },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-xl bg-[#0a0a0a] border border-white/5 flex items-start gap-4 hover:bg-[#111] transition-colors">
                <div className="p-3 rounded-lg bg-atalaia-neon/10 text-atalaia-neon shrink-0">
                  <feature.icon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-16 md:py-24 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Escolha seu Plano</h2>
            <p className="text-gray-400">Atualizar para desbloquear recursos avançados de segurança</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">
            {/* Gratuito */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-2">Gratuito</h3>
              <p className="text-xs text-gray-500 mb-6">Para começar a proteger</p>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-bold text-atalaia-neon">R$ 0</span>
                <span className="text-sm text-gray-500 mb-1">/mens</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                <li className="flex items-center gap-3 text-gray-300">
                  <span className="text-atalaia-neon">✓</span> Monitoramento básico limitado
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <span className="text-atalaia-neon">✓</span> Até 5 alertas por mês
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <span className="text-atalaia-neon">✓</span> Histórico de 7 dias
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <span className="text-atalaia-neon">✓</span> r por e-mail
                </li>
              </ul>
              <button onClick={() => navigate('/login?mode=register&plan=FREE')} className="w-full py-3 rounded-lg border border-white/10 text-white hover:border-atalaia-neon hover:text-atalaia-neon transition-colors text-sm font-medium">
                Começar
              </button>
            </div>

            {/* Família */}
            <div className="bg-[#111] border border-atalaia-neon rounded-2xl p-8 relative transform md:-translate-y-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-atalaia-neon text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Popular</div>
              <h3 className="text-xl font-bold text-white mb-2">Família</h3>
              <p className="text-xs text-gray-500 mb-6">acerto para famílias</p>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-bold text-atalaia-neon">R$ 39,90</span>
                <span className="text-sm text-gray-500 mb-1">/mês</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                <li className="flex items-center gap-3 text-white">
                  <span className="text-atalaia-neon">✓</span> Monitoramento básico de segurança
                </li>
                <li className="flex items-center gap-3 text-white">
                  <span className="text-atalaia-neon">✓</span> Alertas em tempo real
                </li>
                <li className="flex items-center gap-3 text-white">
                  <span className="text-atalaia-neon">✓</span> Bate-papo
                </li>
                <li className="flex items-center gap-3 text-white">
                  <span className="text-atalaia-neon">✓</span> Estatísticas personalizadas
                </li>
                <li className="flex items-center gap-3 text-white">
                  <span className="text-atalaia-neon">✓</span> Histórico de 30 dias
                </li>
                <li className="flex items-center gap-3 text-white">
                  <span className="text-atalaia-neon">✓</span> Até 3 anos
                </li>
                <li className="flex items-center gap-3 text-white">
                  <span className="text-atalaia-neon">✓</span> prioritário
                </li>
                <li className="flex items-center gap-3 text-white">
                  <span className="text-atalaia-neon">✓</span> Backup em
                </li>
              </ul>
              <Button onClick={() => navigate('/login?mode=register&plan=FAMILY')} className="w-full py-3">
                Selecione Família
              </Button>
            </div>

            {/* Prêmio */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-2">Prêmio</h3>
              <p className="text-xs text-gray-500 mb-6">Segurança máxima para seu bairro</p>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-bold text-atalaia-neon">R$ 79,90</span>
                <span className="text-sm text-gray-500 mb-1">/mês</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                <li className="flex items-center gap-3 text-gray-300">
                  <span className="text-atalaia-neon">✓</span> Tudo do plano Família
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <span className="text-atalaia-neon">✓</span> Câmeras ilimitadas
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <span className="text-atalaia-neon">✓</span> IA para detecção de anomalias
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <span className="text-atalaia-neon">✓</span> Relatórios personalizados
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <span className="text-atalaia-neon">✓</span> Suporte 24 horas por dia, 7 dias por semana
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <span className="text-atalaia-neon">✓</span> Integração com sistemas externos
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <span className="text-atalaia-neon">✓</span> Acesso antecipado a novos recursos
                </li>
              </ul>
              <button onClick={() => navigate('/login?mode=register&plan=PREMIUM')} className="w-full py-3 rounded-lg border border-white/10 text-white hover:border-atalaia-neon hover:text-atalaia-neon transition-colors text-sm font-medium">
                Premium
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 md:py-20 bg-gradient-to-b from-[#050505] to-[#0a1f0a] border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Transforme sua rua em um território seguro.<br/>
            Seja um <span className="text-atalaia-neon">Atalaia</span>.
          </h2>
          <Button onClick={() => scrollToSection('planos')} className="h-14 px-8 text-lg mt-4 w-full md:w-auto">
            Criar Grupo da Minha Comunidade Agora
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-[#0e0e0e] border-t border-white/5 text-gray-400 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="text-atalaia-neon h-5 w-5" />
              <span className="font-bold text-white">ATALAIA</span>
            </div>
            <p className="text-xs leading-relaxed">Sua comunidade mais segura, de tempo em espaço, prevenindo e reagindo a incidentes.</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Navegação</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#" className="hover:text-atalaia-neon">Como funciona</a></li>
              <li><a href="#" className="hover:text-atalaia-neon">Funcionalidades</a></li>
              <li><a href="#" className="hover:text-atalaia-neon">por</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Contato</h4>
            <ul className="space-y-2 text-xs">
              <li>contato@atalaia.com.br</li>
              <li>(48) 99999-9999</li>
              <li>Santa Catarina, SC - Brasil</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Jurídico</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#" className="hover:text-atalaia-neon">Termos de serviço</a></li>
              <li><a href="#" className="hover:text-atalaia-neon">Política de</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-white/5 text-center text-xs">
          © 2025 ATALAIA – Segurança Colaborativa. Por Alien Monitoramento Eletrônico Ltada Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
