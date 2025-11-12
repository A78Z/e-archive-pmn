'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  Hash,
  Send,
  Smile,
  Paperclip,
  Circle,
  MessageCircle,
  MoreVertical,
  Phone,
  Video,
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  Check,
  CheckCheck
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

type UserStatus = {
  user_id: string;
  status: 'online' | 'offline' | 'away';
  last_seen: string;
};

type Channel = {
  id: string;
  name: string;
  description: string;
  type: 'department' | 'project' | 'general';
  created_by: string;
  created_at: string;
  is_member?: boolean;
};

type DirectMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: 'text' | 'file' | 'image';
  read: boolean;
  created_at: string;
  attachments: any;
  sender?: User;
};

type ChannelMessage = {
  id: string;
  sender_id: string;
  channel_id: string;
  content: string;
  type: 'text' | 'file' | 'image';
  created_at: string;
  attachments: any;
  sender?: User;
};

type Conversation = {
  user: User;
  last_message?: DirectMessage;
  unread_count: number;
};

export default function ModernMessagingPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'direct' | 'channels'>('direct');
  const [users, setUsers] = useState<User[]>([]);
  const [userStatuses, setUserStatuses] = useState<Record<string, UserStatus>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<User | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [channelMessages, setChannelMessages] = useState<ChannelMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChannelDialog, setShowNewChannelDialog] = useState(false);
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [newChannelType, setNewChannelType] = useState<'department' | 'project' | 'general'>('general');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedChannelMembers, setSelectedChannelMembers] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [directMessages, channelMessages, scrollToBottom]);

  useEffect(() => {
    if (!profile) return;

    const updateMyStatus = async () => {
      await supabase.from('user_status').upsert({
        user_id: profile.id,
        status: 'online',
        last_seen: new Date().toISOString()
      }, { onConflict: 'user_id' });
    };

    updateMyStatus();
    const interval = setInterval(updateMyStatus, 30000);

    const handleBeforeUnload = async () => {
      await supabase.from('user_status').upsert({
        user_id: profile.id,
        status: 'offline',
        last_seen: new Date().toISOString()
      }, { onConflict: 'user_id' });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const fetchUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .neq('id', profile.id)
        .order('full_name');

      setUsers(data || []);
    };

    const fetchUserStatuses = async () => {
      const { data } = await supabase.from('user_status').select('*');
      const statusMap: Record<string, UserStatus> = {};
      data?.forEach(status => {
        statusMap[status.user_id] = status;
      });
      setUserStatuses(statusMap);
    };

    const fetchChannels = async () => {
      const { data: allChannels } = await supabase
        .from('channels')
        .select('*')
        .order('name');

      if (!allChannels) {
        setChannels([]);
        return;
      }

      const channelsWithMembership = await Promise.all(
        allChannels.map(async (channel) => {
          const { data: membership } = await supabase
            .from('channel_members')
            .select('id')
            .eq('channel_id', channel.id)
            .eq('user_id', profile.id)
            .maybeSingle();

          return {
            ...channel,
            is_member: !!membership
          };
        })
      );

      setChannels(channelsWithMembership);
    };

    const fetchConversations = async () => {
      const { data: allMessages } = await supabase
        .from('messages')
        .select('*, sender:sender_id(id, full_name, email, role)')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .not('receiver_id', 'is', null)
        .order('created_at', { ascending: false });

      if (!allMessages) {
        setConversations([]);
        return;
      }

      const conversationMap = new Map<string, Conversation>();

      for (const msg of allMessages) {
        const otherUserId = msg.sender_id === profile.id ? msg.receiver_id : msg.sender_id;

        if (!conversationMap.has(otherUserId)) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', otherUserId)
            .maybeSingle();

          if (userData) {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('sender_id', otherUserId)
              .eq('receiver_id', profile.id)
              .eq('read', false);

            conversationMap.set(otherUserId, {
              user: userData,
              last_message: msg,
              unread_count: count || 0
            });
          }
        }
      }

      setConversations(Array.from(conversationMap.values()));
    };

    fetchUsers();
    fetchUserStatuses();
    fetchChannels();
    fetchConversations();

    const statusChannel = supabase
      .channel('user-status-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_status' }, () => {
        fetchUserStatuses();
      })
      .subscribe();

    const messagesChannel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.receiver_id === profile.id) {
          toast.success('📬 Nouveau message reçu');
        }
        if (newMsg.sender_id === profile.id || newMsg.receiver_id === profile.id) {
          fetchConversations();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        fetchConversations();
      })
      .subscribe();

    const channelsChannel = supabase
      .channel('channels-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, () => {
        fetchChannels();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_members' }, () => {
        fetchChannels();
      })
      .subscribe();

    return () => {
      statusChannel.unsubscribe();
      messagesChannel.unsubscribe();
      channelsChannel.unsubscribe();
    };
  }, [profile]);

  useEffect(() => {
    if (!profile || !selectedConversation) return;

    const fetchDirectMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:sender_id(id, full_name, email, role)')
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${selectedConversation.id}),and(sender_id.eq.${selectedConversation.id},receiver_id.eq.${profile.id})`)
        .order('created_at', { ascending: true });

      setDirectMessages(data || []);

      await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', selectedConversation.id)
        .eq('receiver_id', profile.id)
        .eq('read', false);
    };

    fetchDirectMessages();

    const channel = supabase
      .channel(`dm-${selectedConversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        const newMsg = payload.new as any;
        if (
          (newMsg.sender_id === profile.id && newMsg.receiver_id === selectedConversation.id) ||
          (newMsg.sender_id === selectedConversation.id && newMsg.receiver_id === profile.id)
        ) {
          fetchDirectMessages();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        const updatedMsg = payload.new as any;
        if (
          (updatedMsg.sender_id === profile.id && updatedMsg.receiver_id === selectedConversation.id) ||
          (updatedMsg.sender_id === selectedConversation.id && updatedMsg.receiver_id === profile.id)
        ) {
          fetchDirectMessages();
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile, selectedConversation]);

  useEffect(() => {
    if (!profile || !selectedChannel) return;

    const fetchChannelMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:sender_id(id, full_name, email, role)')
        .eq('channel_id', selectedChannel.id)
        .order('created_at', { ascending: true });

      setChannelMessages(data || []);
    };

    fetchChannelMessages();

    const channel = supabase
      .channel(`channel-${selectedChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.channel_id === selectedChannel.id) {
          fetchChannelMessages();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        const updatedMsg = payload.new as any;
        if (updatedMsg.channel_id === selectedChannel.id) {
          fetchChannelMessages();
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile, selectedChannel]);

  const handleFileUpload = async (file: File) => {
    if (!profile) return null;

    try {
      setUploading(true);
      setUploadProgress(0);

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

      setUploadProgress(50);

      const { data, error } = await supabase.storage
        .from('chat_files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      setUploadProgress(100);

      const { data: urlData } = supabase.storage
        .from('chat_files')
        .getPublicUrl(fileName);

      return {
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size
      };
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload du fichier');
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !uploading) || !selectedConversation || !profile) return;

    try {
      const messageData = {
        sender_id: profile.id,
        receiver_id: selectedConversation.id,
        content: newMessage.trim() || 'Fichier partagé',
        type: 'text' as const,
        read: false
      };

      console.log('Envoi message direct:', messageData);

      const { error } = await supabase.from('messages').insert(messageData);

      if (error) {
        console.error('Erreur envoi message:', error);
        throw new Error(`Erreur: ${error.message}`);
      }

      setNewMessage('');
      toast.success('✅ Message envoyé');
    } catch (error: any) {
      console.error('Erreur complète envoi message:', error);
      toast.error(error.message || 'Erreur lors de l\'envoi du message');
    }
  };

  const handleSendChannelMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !uploading) || !selectedChannel || !profile) return;

    try {
      const messageData = {
        sender_id: profile.id,
        channel_id: selectedChannel.id,
        content: newMessage.trim() || 'Fichier partagé',
        type: 'text' as const
      };

      console.log('Envoi message canal:', messageData);

      const { error } = await supabase.from('messages').insert(messageData);

      if (error) {
        console.error('Erreur envoi message canal:', error);
        throw new Error(`Erreur: ${error.message}`);
      }

      setNewMessage('');
      toast.success('✅ Message envoyé');
    } catch (error: any) {
      console.error('Erreur complète envoi message canal:', error);
      toast.error(error.message || 'Erreur lors de l\'envoi du message');
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !profile) {
      toast.error('Veuillez renseigner un nom de canal');
      return;
    }

    try {
      const channelData = {
        name: newChannelName.trim(),
        description: newChannelDescription.trim() || '',
        type: newChannelType,
        created_by: profile.id
      };

      console.log('Création du canal avec les données:', channelData);

      const { data: newChannel, error: channelError } = await supabase
        .from('channels')
        .insert(channelData)
        .select()
        .single();

      if (channelError) {
        console.error('Erreur création canal:', channelError);
        throw new Error(`Erreur canal: ${channelError.message}`);
      }

      if (!newChannel) {
        throw new Error('Canal créé mais aucune donnée retournée');
      }

      console.log('Canal créé avec succès:', newChannel);

      const membersToAdd = [profile.id, ...selectedChannelMembers];
      const membersData = membersToAdd.map((userId, index) => ({
        channel_id: newChannel.id,
        user_id: userId,
        role: index === 0 ? 'admin' : 'member'
      }));

      console.log('Ajout des membres:', membersData);

      const { error: memberError } = await supabase
        .from('channel_members')
        .insert(membersData);

      if (memberError) {
        console.error('Erreur ajout membres:', memberError);
        throw new Error(`Erreur membres: ${memberError.message}`);
      }

      console.log('Membres ajoutés avec succès');

      toast.success(`✅ Canal #${newChannelName} créé avec succès`);
      setShowNewChannelDialog(false);
      setNewChannelName('');
      setNewChannelDescription('');
      setNewChannelType('general');
      setSelectedChannelMembers([]);
    } catch (error: any) {
      console.error('Erreur complète:', error);
      toast.error(error.message || 'Erreur lors de la création du canal');
    }
  };

  const handleStartConversation = async () => {
    if (!selectedUserId || !profile) return;

    const user = users.find(u => u.id === selectedUserId);
    if (!user) return;

    const existingConv = conversations.find(c => c.user.id === selectedUserId);
    if (existingConv) {
      setSelectedConversation(user);
      setShowNewConversationDialog(false);
      setSelectedUserId('');
      setActiveTab('direct');
      toast.info('Conversation existante ouverte');
      return;
    }

    setSelectedConversation(user);
    setShowNewConversationDialog(false);
    setSelectedUserId('');
    setActiveTab('direct');
    toast.success('Nouvelle conversation démarrée');
  };

  const handleJoinChannel = async (channel: Channel) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channel.id,
          user_id: profile.id,
          role: 'member'
        });

      if (error) throw error;

      toast.success(`✅ Vous avez rejoint #${channel.name}`);
      setSelectedChannel(channel);
    } catch (error: any) {
      toast.error('Erreur lors de l\'adhésion au canal');
      console.error(error);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadedFile = await handleFileUpload(file);
    if (uploadedFile) {
      const messageContent = `📎 ${uploadedFile.name}`;
      setNewMessage(messageContent);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'HH:mm', { locale: fr });
    } else if (isYesterday(date)) {
      return 'Hier';
    } else {
      return format(date, 'dd/MM', { locale: fr });
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConversations = conversations.filter(conv =>
    conv.user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col bg-white rounded-lg border shadow-sm">
      <div className="flex items-center justify-between p-6 border-b" style={{ background: 'linear-gradient(135deg, #009444 0%, #00b455 100%)' }}>
        <div>
          <h1 className="text-3xl font-bold text-white">Messagerie PMN</h1>
          <p className="text-green-50 mt-1">Communication en temps réel</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowNewConversationDialog(true)}
            className="bg-white text-green-700 hover:bg-green-50 gap-2"
          >
            <Plus className="h-4 w-4" />
            Message
          </Button>
          <Button
            onClick={() => setShowNewChannelDialog(true)}
            className="bg-yellow-400 text-gray-900 hover:bg-yellow-300 gap-2"
          >
            <Hash className="h-4 w-4" />
            Canal
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r bg-gray-50 flex flex-col">
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'direct' | 'channels')}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="direct" className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Messages
                </TabsTrigger>
                <TabsTrigger value="channels" className="gap-2">
                  <Hash className="h-4 w-4" />
                  Canaux
                </TabsTrigger>
              </TabsList>

              <TabsContent value="direct" className="mt-3">
                <div className="space-y-1 max-h-[calc(100vh-20rem)] overflow-y-auto">
                  {filteredConversations.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">Aucune conversation</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewConversationDialog(true)}
                        className="mt-2"
                      >
                        Démarrer une conversation
                      </Button>
                    </div>
                  ) : (
                    filteredConversations.map(conv => (
                      <div
                        key={conv.user.id}
                        onClick={() => {
                          setSelectedConversation(conv.user);
                          setSelectedChannel(null);
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                          selectedConversation?.id === conv.user.id
                            ? 'bg-green-100 border-l-4 border-green-600'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-green-600 text-white text-sm font-semibold">
                              {getInitials(conv.user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <Circle
                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                              userStatuses[conv.user.id]?.status === 'online'
                                ? 'fill-green-500 text-green-500'
                                : 'fill-gray-400 text-gray-400'
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm text-gray-900 truncate">
                              {conv.user.full_name}
                            </p>
                            {conv.last_message && (
                              <span className="text-xs text-gray-500">
                                {formatTime(conv.last_message.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-600 truncate">
                              {conv.last_message?.content || 'Démarrer une conversation'}
                            </p>
                            {conv.unread_count > 0 && (
                              <Badge className="bg-green-600 text-white text-xs h-5 w-5 rounded-full flex items-center justify-center p-0">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="channels" className="mt-3">
                <div className="space-y-1 max-h-[calc(100vh-20rem)] overflow-y-auto">
                  {filteredChannels.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">Aucun canal</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewChannelDialog(true)}
                        className="mt-2"
                      >
                        Créer un canal
                      </Button>
                    </div>
                  ) : (
                    filteredChannels.map(channel => (
                      <div
                        key={channel.id}
                        onClick={() => {
                          if (channel.is_member) {
                            setSelectedChannel(channel);
                            setSelectedConversation(null);
                          } else {
                            handleJoinChannel(channel);
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                          selectedChannel?.id === channel.id
                            ? 'bg-green-100 border-l-4 border-green-600'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="h-10 w-10 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
                          <Hash className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">
                            {channel.name}
                          </p>
                          <p className="text-xs text-gray-600 truncate">
                            {channel.description || channel.type}
                          </p>
                        </div>
                        {!channel.is_member && (
                          <Badge className="bg-yellow-400 text-gray-900 text-xs">
                            Rejoindre
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-white">
          {!selectedConversation && !selectedChannel ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-gray-50 to-green-50">
              <MessageCircle className="h-24 w-24 text-green-600 mb-4" />
              <h3 className="text-2xl font-semibold text-gray-700 mb-2">
                Bienvenue dans la messagerie PMN
              </h3>
              <p className="text-gray-500 max-w-md">
                Sélectionnez une conversation ou un canal pour commencer à échanger
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 border-b bg-white">
                <div className="flex items-center gap-3">
                  {selectedConversation ? (
                    <>
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-green-600 text-white font-semibold">
                            {getInitials(selectedConversation.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <Circle
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                            userStatuses[selectedConversation.id]?.status === 'online'
                              ? 'fill-green-500 text-green-500'
                              : 'fill-gray-400 text-gray-400'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{selectedConversation.full_name}</p>
                        <p className="text-xs text-gray-500">
                          {userStatuses[selectedConversation.id]?.status === 'online' ? (
                            <span className="text-green-600 font-medium">● En ligne</span>
                          ) : (
                            'Hors ligne'
                          )}
                        </p>
                      </div>
                    </>
                  ) : selectedChannel ? (
                    <>
                      <div className="h-10 w-10 rounded-lg bg-green-600 flex items-center justify-center">
                        <Hash className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">#{selectedChannel.name}</p>
                        <p className="text-xs text-gray-500">{selectedChannel.description}</p>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" title="Appel audio">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Appel vidéo">
                    <Video className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">
                {selectedConversation && directMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">Démarrez la conversation !</p>
                  </div>
                ) : selectedChannel && channelMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">Soyez le premier à écrire !</p>
                  </div>
                ) : (
                  <>
                    {(selectedConversation ? directMessages : channelMessages).map(msg => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 animate-in slide-in-from-bottom-2 ${msg.sender_id === profile?.id ? 'flex-row-reverse' : ''}`}
                      >
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback
                            className={`${
                              msg.sender_id === profile?.id ? 'bg-green-600' : 'bg-yellow-500'
                            } text-white font-semibold text-xs`}
                          >
                            {getInitials(msg.sender?.full_name || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex flex-col max-w-md ${msg.sender_id === profile?.id ? 'items-end' : ''}`}>
                          <div
                            className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                              msg.sender_id === profile?.id
                                ? 'bg-green-600 text-white'
                                : 'bg-white border text-gray-900'
                            }`}
                          >
                            <p className="text-sm">{msg.content}</p>
                          </div>
                          <div className="flex items-center gap-1 mt-1 px-1">
                            <span className="text-xs text-gray-500">
                              {format(new Date(msg.created_at), 'HH:mm', { locale: fr })}
                            </span>
                            {msg.sender_id === profile?.id && selectedConversation && 'read' in msg && (
                              <span className="text-xs">
                                {msg.read ? (
                                  <CheckCheck className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Check className="h-3 w-3 text-gray-400" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <div className="p-4 border-t bg-white">
                {uploading && (
                  <div className="mb-2 p-2 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <Upload className="h-4 w-4 animate-bounce" />
                      <span>Upload en cours... {uploadProgress}%</span>
                    </div>
                  </div>
                )}
                <form
                  onSubmit={selectedConversation ? handleSendDirectMessage : handleSendChannelMessage}
                  className="flex items-end gap-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleFileButtonClick}
                    disabled={uploading}
                    title="Joindre un fichier"
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" title="Ajouter un emoji">
                    <Smile className="h-5 w-5" />
                  </Button>
                  <Input
                    placeholder="Tapez votre message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1"
                    disabled={uploading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (selectedConversation) {
                          handleSendDirectMessage(e);
                        } else {
                          handleSendChannelMessage(e);
                        }
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="bg-green-600 hover:bg-green-700 transition-all"
                    disabled={(!newMessage.trim() && !uploading) || uploading}
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={showNewConversationDialog} onOpenChange={setShowNewConversationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-sm font-medium mb-2">Sélectionner un agent</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un agent..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Circle
                          className={`h-2 w-2 ${
                            userStatuses[user.id]?.status === 'online'
                              ? 'fill-green-500 text-green-500'
                              : 'fill-gray-400 text-gray-400'
                          }`}
                        />
                        <span>{user.full_name}</span>
                        <span className="text-gray-500 text-xs">• {user.role}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleStartConversation}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={!selectedUserId}
            >
              Démarrer la conversation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewChannelDialog} onOpenChange={setShowNewChannelDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer un canal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-sm font-medium mb-2">Nom du canal</Label>
              <Input
                placeholder="ex: equipe-technique"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2">Description</Label>
              <Input
                placeholder="Description du canal..."
                value={newChannelDescription}
                onChange={(e) => setNewChannelDescription(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2">Type</Label>
              <Select value={newChannelType} onValueChange={(v: any) => setNewChannelType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Général</SelectItem>
                  <SelectItem value="department">Département</SelectItem>
                  <SelectItem value="project">Projet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2">Ajouter des membres (optionnel)</Label>
              <Select
                value={selectedChannelMembers[0] || ''}
                onValueChange={(userId) => {
                  if (!selectedChannelMembers.includes(userId)) {
                    setSelectedChannelMembers([...selectedChannelMembers, userId]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner des membres..." />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => !selectedChannelMembers.includes(u.id)).map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedChannelMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedChannelMembers.map(userId => {
                    const user = users.find(u => u.id === userId);
                    return (
                      <Badge key={userId} variant="secondary" className="gap-1">
                        {user?.full_name}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setSelectedChannelMembers(selectedChannelMembers.filter(id => id !== userId))}
                        />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
            <Button
              onClick={handleCreateChannel}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={!newChannelName.trim()}
            >
              Créer le canal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
