'use client';


import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Share2, MessageSquare, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    documents: 0,
    shares: 0,
    messages: 0,
    users: 0,
  });

  useEffect(() => {
    if (!profile) return;

    const fetchStats = async () => {
      const [docsResult, sharesResult, messagesResult, usersResult] = await Promise.all([
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('shares').select('id', { count: 'exact', head: true }).or(`shared_by.eq.${profile.id},shared_with.eq.${profile.id}`),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      setStats({
        documents: docsResult.count || 0,
        shares: sharesResult.count || 0,
        messages: messagesResult.count || 0,
        users: usersResult.count || 0,
      });
    };

    fetchStats();

    const handleRefresh = () => {
      fetchStats();
    };

    window.addEventListener('refreshDashboard', handleRefresh);

    return () => {
      window.removeEventListener('refreshDashboard', handleRefresh);
    };
  }, [profile]);

  const statCards = [
    {
      title: 'Documents',
      value: stats.documents,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Partages',
      value: stats.shares,
      icon: Share2,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Messages non lus',
      value: stats.messages,
      icon: MessageSquare,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      title: 'Utilisateurs actifs',
      value: stats.users,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Bienvenue, {profile?.full_name || 'Utilisateur'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Aucune activité récente</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accès rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Utilisez le menu latéral pour accéder aux différentes sections
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
