'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  FileText,
  Upload,
  MessageSquare,
  Share2,
  ShieldCheck,
  Settings,
  FileArchive,
  Menu,
  LogOut,
  Users,
} from 'lucide-react';
import { NotificationsBell } from '@/components/notifications-bell';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useAuth();
  const [messageCount, setMessageCount] = useState(3);
  const [requestCount, setRequestCount] = useState(2);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const fetchCounts = useCallback(async () => {
    if (!profile || !user) return;

    try {
      const [messagesResult, requestsResult] = await Promise.all([
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)
          .neq('sender_id', profile.id),
        supabase
          .from('access_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      if (messagesResult.count !== null) setMessageCount(messagesResult.count);
      if (requestsResult.count !== null) setRequestCount(requestsResult.count);
    } catch (error) {
      console.error('Error fetching counts:', error);
    }
  }, [profile, user]);

  useEffect(() => {
    fetchCounts();

    const messagesChannel = supabase
      .channel('messages-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchCounts)
      .subscribe();

    const requestsChannel = supabase
      .channel('requests-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, fetchCounts)
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
      requestsChannel.unsubscribe();
    };
  }, [fetchCounts]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Erreur lors de la déconnexion');
    } else {
      router.push('/login');
    }
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const menuItems = useMemo(() => [
    { icon: LayoutDashboard, label: 'Tableau de bord', href: '/dashboard', badge: null },
    { icon: FileText, label: 'Documents', href: '/dashboard/documents', badge: null },
    { icon: Upload, label: 'Uploader', href: '/dashboard/upload', badge: null },
    { icon: MessageSquare, label: 'Messages', href: '/dashboard/messages', badge: messageCount },
    { icon: Share2, label: 'Partages', href: '/dashboard/shares', badge: null },
    { icon: ShieldCheck, label: "Demandes d'accès", href: '/dashboard/access-requests', badge: requestCount },
  ], [messageCount, requestCount]);

  const NavLinks = () => (
    <>
      <div className="space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              pathname === item.href
                ? 'bg-pmn-yellow text-pmn-green shadow-md'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </div>
            {item.badge !== null && item.badge > 0 && (
              <Badge className="bg-pmn-yellow text-pmn-green hover:bg-pmn-yellow font-semibold">
                {item.badge}
              </Badge>
            )}
          </Link>
        ))}
      </div>

      {profile && ['admin', 'super_admin'].includes(profile.role) && (
        <div className="mt-6">
          <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-pmn-yellow/80">
            ADMINISTRATION
          </p>
          <Link
            href="/dashboard/administration"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              pathname === '/dashboard/administration'
                ? 'bg-pmn-yellow text-pmn-green shadow-md'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Settings className="h-5 w-5" />
            <span>Administration</span>
          </Link>
          {profile.role === 'super_admin' && (
            <Link
              href="/dashboard/users"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                pathname === '/dashboard/users'
                  ? 'bg-pmn-yellow text-pmn-green shadow-md'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Users className="h-5 w-5" />
              <span>Gestion Utilisateurs</span>
            </Link>
          )}
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-base font-medium text-gray-700">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="hidden lg:flex lg:w-72 lg:flex-col border-r bg-gradient-to-b from-pmn-green to-pmn-green-light shadow-lg">
        <div className="flex h-20 items-center gap-3 border-b border-pmn-yellow/30 px-6">
          <Image
            src="/logo-navbare.png"
            alt="Logo PMN"
            width={48}
            height={48}
            className="drop-shadow-md"
          />
          <div>
            <h1 className="text-lg font-bold text-white">Archive PMN</h1>
            <p className="text-xs text-pmn-yellow">v1.0</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <NavLinks />
        </nav>

        <div className="border-t border-pmn-yellow/30 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-pmn-yellow text-pmn-green text-sm font-medium">
                {getInitials(profile?.full_name || 'User')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {profile?.full_name || 'Utilisateur'}
              </p>
              <p className="text-xs text-pmn-yellow/80 truncate">
                {profile?.role === 'super_admin' ? 'Super Administr...' : profile?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-8 w-8"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between gap-4 border-b bg-white px-4 md:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-pmn-green hover:bg-pmn-green/10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-gradient-to-b from-pmn-green to-pmn-green-light">
                <div className="flex h-20 items-center gap-3 border-b border-pmn-yellow/30 px-6">
                  <Image
                    src="/logo-navbare.png"
                    alt="Logo PMN"
                    width={48}
                    height={48}
                    className="drop-shadow-md"
                  />
                  <div>
                    <h1 className="text-lg font-bold text-white">Archive PMN</h1>
                    <p className="text-xs text-pmn-yellow">v1.0</p>
                  </div>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto p-4 max-h-[calc(100vh-200px)]">
                  <NavLinks />
                </nav>

                <div className="border-t border-pmn-yellow/30 p-4">
                  <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-pmn-yellow text-pmn-green text-sm font-medium">
                        {getInitials(profile?.full_name || 'User')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {profile?.full_name || 'Utilisateur'}
                      </p>
                      <p className="text-xs text-pmn-yellow/80 truncate">
                        {profile?.role === 'super_admin' ? 'Super Admin' : profile?.role === 'admin' ? 'Admin' : 'User'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSignOut}
                      className="h-8 w-8 text-white hover:bg-white/20"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <Image
                src="/logo-navbare.png"
                alt="Logo PMN"
                width={32}
                height={32}
              />
              <h1 className="text-base font-bold text-pmn-green">Archive PMN</h1>
            </div>
          </div>
          <NotificationsBell />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
