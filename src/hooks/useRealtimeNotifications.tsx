import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { UserPlus, Tv, AlertCircle } from 'lucide-react';

export const useRealtimeNotifications = () => {
  useEffect(() => {
    console.log('[Realtime] Setting up notifications...');

    // Listen for new streaming users
    const usersChannel = supabase
      .channel('new-users')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'streaming_users',
        },
        (payload) => {
          console.log('[Realtime] New user:', payload);
          const user = payload.new as { username: string; status: string };
          toast({
            title: 'Novi korisnik',
            description: `${user.username} je dodan`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streaming_users',
        },
        (payload) => {
          const oldUser = payload.old as { status: string; username: string };
          const newUser = payload.new as { status: string; username: string };
          
          if (oldUser.status !== 'online' && newUser.status === 'online') {
            toast({
              title: 'Korisnik online',
              description: `${newUser.username} se spojio`,
            });
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[Realtime] Users channel status:', status);
        if (err) console.error('[Realtime] Users channel error:', err);
      });

    // Listen for new/updated streams
    const streamsChannel = supabase
      .channel('stream-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'streams',
        },
        (payload) => {
          console.log('[Realtime] New stream:', payload);
          const stream = payload.new as { name: string; status: string };
          toast({
            title: 'Novi stream',
            description: `${stream.name} je dodan`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
        },
        (payload) => {
          const oldStream = payload.old as { status: string; name: string };
          const newStream = payload.new as { status: string; name: string };
          
          if (oldStream.status !== 'live' && newStream.status === 'live') {
            toast({
              title: 'Stream uživo',
              description: `${newStream.name} je sada live`,
            });
          } else if (oldStream.status === 'live' && newStream.status !== 'live') {
            toast({
              title: 'Stream offline',
              description: `${newStream.name} je prestao`,
              variant: 'destructive',
            });
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[Realtime] Streams channel status:', status);
        if (err) console.error('[Realtime] Streams channel error:', err);
      });

    return () => {
      console.log('[Realtime] Cleaning up subscriptions...');
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(streamsChannel);
    };
  }, []);
};
