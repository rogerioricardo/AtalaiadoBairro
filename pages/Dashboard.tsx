

import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { UserRole, Alert, Neighborhood, Notification, User } from '../types';
import { Card, Badge, Button, Input } from '../components/UI';
import { MockService } from '../services/mockService';
import { AlertTriangle, Video, Users, Activity, MapPin, Inbox, Copy, Trash2, Heart, DollarSign, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PaymentService } from '../services/paymentService';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ alerts: 0, cameras: 0, users: 0 });
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myNeighborhood, setMyNeighborhood] = useState<Neighborhood | undefined>();
  
  // Donation State
  const [donationAmount, setDonationAmount] = useState('10.00');
  const [neighborhoodIntegrator, setNeighborhoodIntegrator] = useState<User | null>(null);
  const [processingDonation, setProcessingDonation] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch alerts
      const alerts = await MockService.getAlerts(user?.role === UserRole.ADMIN ? undefined : user?.neighborhoodId);
      setRecentAlerts(alerts.slice(0, 5));
      setStats(prev => ({ ...prev, alerts: alerts.length }));

      // Fetch Neighborhood Info
      if (user?.role === UserRole.ADMIN) {
        const hoods = await MockService.getNeighborhoods();
        setStats(prev => ({ ...prev, cameras: hoods.length, users: 154 })); // Mock user count
        
        // Fetch Admin Notifications
        const notifs = await MockService.getNotifications();
        setNotifications(notifs);

      } else if (user?.neighborhoodId) {
        const hood = await MockService.getNeighborhoodById(user.neighborhoodId);
        setMyNeighborhood(hood);
        setStats(prev => ({ ...prev, cameras: 1, users: 42 }));

        // Check for Integrator to receive donations
        if (user.role === UserRole.RESIDENT && user.plan === 'FREE') {
            const integrator = await MockService.getNeighborhoodIntegrator(user.neighborhoodId);
            setNeighborhoodIntegrator(integrator);
        }
      }
    };

    fetchData();
  }, [user]);

  const handleDeleteNotification = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta notificação?')) {
        await MockService.deleteNotification(id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const handleDonation = async () => {
      if (!user || !neighborhoodIntegrator?.mpAccessToken) return;
      
      setProcessingDonation(true);
      try {
          const amount = parseFloat(donationAmount);
          if (isNaN(amount) || amount <= 0) throw new Error("Valor inválido");

          // Cria preferência de pagamento usando o TOKEN do INTEGRADOR
          const checkoutUrl = await PaymentService.createDonationPreference(
              amount, 
              user.email, 
              user.name, 
              neighborhoodIntegrator.mpAccessToken
          );
          
          window.location.href = checkoutUrl;
      } catch (error: any) {
          alert('Erro ao processar doação: ' + error.message);
          setProcessingDonation(false);
      }
  };

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <Card className="p-6 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-gray-400 text-sm font-medium uppercase">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </Card>
  );

  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">Painel de Controle</h1>
            <p className="text-gray-400">Bem-vindo, {user?.name}. Sistema operacional e vigilante.</p>
        </div>
        {user?.neighborhoodId && myNeighborhood && (
             <div className="px-4 py-2 bg-atalaia-neon/10 border border-atalaia-neon/20 rounded-full text-atalaia-neon text-sm font-bold flex items-center gap-2">
                 <MapPin size={16} /> Bairro: {myNeighborhood.name}
             </div>
        )}
      </div>

      {/* DONATION CARD (Only for FREE Residents with Integrator Configured) */}
      {user?.role === UserRole.RESIDENT && user?.plan === 'FREE' && neighborhoodIntegrator?.mpAccessToken && (
          <div className="mb-8 animate-in slide-in-from-top-4">
              <Card className="p-6 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-500/30 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  
                  <div className="flex items-start gap-4 relative z-10">
                      <div className="p-4 bg-white/10 rounded-full text-purple-300">
                          <Heart size={32} fill="currentColor" />
                      </div>
                      <div>
                          <h2 className="text-xl font-bold text-white mb-2">Apoie a Segurança do seu Bairro</h2>
                          <p className="text-gray-300 text-sm max-w-lg">
                              O plano gratuito é mantido pelo esforço comunitário. Contribua com qualquer valor para ajudar o Integrador 
                              <strong> {neighborhoodIntegrator.name}</strong> a manter o sistema ativo.
                          </p>
                      </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto relative z-10">
                      <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">R$</span>
                          <input 
                              type="number" 
                              value={donationAmount}
                              onChange={e => setDonationAmount(e.target.value)}
                              className="w-32 bg-black/50 border border-purple-500/30 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-purple-500 font-bold"
                              min="1"
                              step="0.01"
                          />
                      </div>
                      <Button onClick={handleDonation} disabled={processingDonation} className="bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20 whitespace-nowrap h-[46px]">
                          {processingDonation ? <Loader2 className="animate-spin" /> : <><DollarSign size={18} /> Doar Agora</>}
                      </Button>
                  </div>
              </Card>
          </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard 
          icon={AlertTriangle} 
          label="Alertas (24h)" 
          value={stats.alerts} 
          color="bg-red-500/20" 
        />
        <StatCard 
          icon={Video} 
          label="Câmeras Ativas" 
          value={stats.cameras} 
          color="bg-atalaia-neon/20" 
        />
        <StatCard 
          icon={Users} 
          label="Membros Online" 
          value={stats.users} 
          color="bg-blue-500/20" 
        />
      </div>

      {/* ADMIN NOTIFICATIONS (Only visible to Admin) */}
      {user?.role === UserRole.ADMIN && notifications.length > 0 && (
          <Card className="p-6 mb-8 border-atalaia-neon/30 bg-atalaia-neon/5">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-white">
                  <Inbox className="text-atalaia-neon" size={20} />
                  Notificações do Sistema
                  <Badge color="green">{notifications.length}</Badge>
              </h2>
              <div className="space-y-4">
                  {notifications.map(notif => (
                      <div key={notif.id} className="bg-black/50 p-4 rounded-lg border border-white/10 group">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <h4 className="font-bold text-white text-sm">{notif.title}</h4>
                                  <p className="text-xs text-gray-400">De: {notif.fromUserName} • {new Date(notif.timestamp).toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-atalaia-accent text-white px-2 py-0.5 rounded">Novo</span>
                                <button 
                                    onClick={() => handleDeleteNotification(notif.id)}
                                    className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                    title="Excluir notificação"
                                >
                                    <Trash2 size={16} />
                                </button>
                              </div>
                          </div>
                          <p className="text-sm text-gray-300 mb-3">{notif.message}</p>
                          
                          {notif.type === 'PROTOCOL_SUBMISSION' && notif.data && (
                              <div className="space-y-2 mt-2">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      <div className="bg-black p-2 rounded border border-gray-800 flex items-center justify-between">
                                          <code className="text-xs text-atalaia-neon truncate mr-2">{notif.data.rtmp}</code>
                                          <button onClick={() => navigator.clipboard.writeText(notif.data.rtmp)} title="Copiar RTMP"><Copy size={14} className="text-gray-500 hover:text-white"/></button>
                                      </div>
                                      <div className="bg-black p-2 rounded border border-gray-800 flex items-center justify-between">
                                          <code className="text-xs text-blue-400 truncate mr-2">{notif.data.rtsp}</code>
                                          <button onClick={() => navigator.clipboard.writeText(notif.data.rtsp)} title="Copiar RTSP"><Copy size={14} className="text-gray-500 hover:text-white"/></button>
                                      </div>
                                  </div>
                                  
                                  {/* Coordinates Display */}
                                  {(notif.data.lat || notif.data.lng) && (
                                    <div className="grid grid-cols-2 gap-2">
                                         <div className="bg-black p-2 rounded border border-gray-800 flex items-center justify-between">
                                            <span className="text-xs text-gray-400">Lat: <span className="text-white">{notif.data.lat}</span></span>
                                            <button onClick={() => navigator.clipboard.writeText(String(notif.data.lat))} title="Copiar Latitude"><Copy size={14} className="text-gray-500 hover:text-white"/></button>
                                        </div>
                                        <div className="bg-black p-2 rounded border border-gray-800 flex items-center justify-between">
                                            <span className="text-xs text-gray-400">Lng: <span className="text-white">{notif.data.lng}</span></span>
                                            <button onClick={() => navigator.clipboard.writeText(String(notif.data.lng))} title="Copiar Longitude"><Copy size={14} className="text-gray-500 hover:text-white"/></button>
                                        </div>
                                    </div>
                                  )}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Alerts Feed */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="text-atalaia-neon" size={20} />
              Últimas Ocorrências
            </h2>
            <Button variant="outline" className="text-xs px-2 py-1 h-auto" onClick={() => navigate('/alerts')}>Ver Tudo</Button>
          </div>
          
          <div className="space-y-4">
            {recentAlerts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhuma ocorrência registrada.</p>
            ) : (
                recentAlerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-4 p-4 rounded-lg bg-black/40 border border-white/5">
                    <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${alert.type === 'PANIC' ? 'bg-red-500 animate-pulse' : alert.type === 'SUSPICIOUS' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                    <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-white truncate">{alert.userName}</span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                        Reportou: <Badge color={alert.type === 'PANIC' ? 'red' : alert.type === 'SUSPICIOUS' ? 'yellow' : 'green'}>{alert.type}</Badge>
                    </p>
                    {user?.role === UserRole.ADMIN && (
                        <p className="text-xs text-gray-600 mt-1 flex items-center gap-1"><MapPin size={10} /> Bairro ID: {alert.neighborhoodId}</p>
                    )}
                    </div>
                </div>
                ))
            )}
          </div>
        </Card>

        {/* Quick Camera Access */}
        <Card className="p-6 flex flex-col">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
            <Video className="text-atalaia-neon" size={20} />
            Visualização Rápida
          </h2>
          
          <div className="flex-1 flex flex-col items-center justify-center bg-black/60 rounded-lg border border-dashed border-gray-700 min-h-[200px]">
             {myNeighborhood ? (
                 <div className="text-center">
                     <p className="text-gray-400 mb-4">Câmera Principal: {myNeighborhood.name}</p>
                     <Button onClick={() => navigate('/cameras')}>Abrir Monitoramento</Button>
                 </div>
             ) : user?.role === UserRole.ADMIN ? (
                 <div className="text-center">
                     <p className="text-gray-400 mb-4">Você tem acesso global.</p>
                     <Button onClick={() => navigate('/cameras')}>Gerenciar Câmeras</Button>
                 </div>
             ) : (
                 <p className="text-gray-500">Nenhuma câmera vinculada.</p>
             )}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;