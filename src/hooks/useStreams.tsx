import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Backend sync config - reads from localStorage (same as Settings page)
const getBackendUrl = (): string | null => {
  try {
    const savedSettings = localStorage.getItem('streampanel_settings');
    if (!savedSettings) return null;
    
    const settings = JSON.parse(savedSettings);
    const serverIp = settings.streamServerIp;
    const httpPort = settings.streamHttpPort || "3001";
    
    if (!serverIp) return null;
    return `http://${serverIp}:${httpPort}`;
  } catch {
    return null;
  }
};

export interface Stream {
  id: string;
  name: string;
  input_type: string;
  input_url: string;
  output_formats: string[];
  status: string;
  viewers: number;
  bitrate: number;
  resolution: string;
  webvtt_enabled: boolean;
  webvtt_url: string | null;
  webvtt_language: string | null;
  webvtt_label: string | null;
  dvr_enabled: boolean;
  dvr_duration: number;
  abr_enabled: boolean;
  category: string | null;
  bouquet: string | null;
  channel_number: number | null;
  stream_icon: string | null;
  epg_channel_id: string | null;
}

// Call backend through Edge Function to avoid CORS/mixed-content issues
const callBackendSync = async (action: string, data: unknown) => {
  const backendUrl = getBackendUrl();
  if (!backendUrl) return null;
  
  try {
    const { data: result, error } = await supabase.functions.invoke('backend-sync', {
      body: { action, backendUrl, data }
    });
    
    if (error) throw error;
    return result;
  } catch (err) {
    console.error(`[Sync] ${action} failed:`, err);
    return null;
  }
};

// Sync stream to Docker backend
const syncStreamToBackend = async (stream: Stream) => {
  const result = await callBackendSync('sync-stream', stream);
  if (result) {
    console.log(`[Sync] Stream synced: ${stream.name}`);
  }
};

// Delete stream from Docker backend
const deleteStreamFromBackend = async (id: string) => {
  const result = await callBackendSync('delete-stream', { id });
  if (result) {
    console.log(`[Sync] Stream deleted: ${id}`);
  }
};

// Sync all streams to Docker backend (background, no error toast)
const syncAllStreamsToBackend = async (streams: Stream[]) => {
  const result = await callBackendSync('sync-streams', streams);
  if (result) {
    console.log(`[Sync] All streams synced: ${streams.length}`);
  }
};

export const useStreams = () => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStreams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("streams")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Greška", description: "Nije moguće učitati streamove", variant: "destructive" });
    } else {
      setStreams(data || []);
      // Auto-sync all streams to backend on fetch (background)
      if (data && data.length > 0) {
        syncAllStreamsToBackend(data as Stream[]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStreams();
  }, []);

  const addStream = async (stream: Omit<Stream, "id" | "viewers" | "status">) => {
    const { data, error } = await supabase
      .from("streams")
      .insert({
        name: stream.name,
        input_type: stream.input_type,
        input_url: stream.input_url,
        output_formats: stream.output_formats,
        bitrate: stream.bitrate,
        resolution: stream.resolution,
        webvtt_enabled: stream.webvtt_enabled,
        webvtt_url: stream.webvtt_url,
        webvtt_language: stream.webvtt_language,
        webvtt_label: stream.webvtt_label,
        dvr_enabled: stream.dvr_enabled,
        dvr_duration: stream.dvr_duration,
        abr_enabled: stream.abr_enabled,
        category: stream.category,
        bouquet: stream.bouquet,
        channel_number: stream.channel_number,
        status: "inactive",
        viewers: 0,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      return null;
    }
    
    // Sync to Docker backend
    syncStreamToBackend(data as Stream);
    
    setStreams((prev) => [data, ...prev]);
    toast({ title: "Uspješno", description: "Stream dodan i sinkroniziran" });
    return data;
  };

  const updateStream = async (id: string, updates: Partial<Stream>) => {
    const { data, error } = await supabase
      .from("streams")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      return false;
    }

    // Sync to Docker backend
    syncStreamToBackend(data as Stream);

    setStreams((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    toast({ title: "Ažurirano", description: "Stream ažuriran i sinkroniziran" });
    return true;
  };

  const deleteStream = async (id: string) => {
    const { error } = await supabase.from("streams").delete().eq("id", id);

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      return false;
    }

    // Delete from Docker backend
    deleteStreamFromBackend(id);

    setStreams((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Obrisano", description: "Stream uklonjen" });
    return true;
  };

  const toggleStream = async (id: string) => {
    const stream = streams.find((s) => s.id === id);
    if (!stream) return;

    const newStatus = stream.status === "live" ? "inactive" : "live";

    await updateStream(id, { status: newStatus });
  };

  const syncAllStreams = async () => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      toast({ title: "Greška", description: "Postavi Server IP i HTTP Port u Settings → Streaming Server", variant: "destructive" });
      return false;
    }
    
    try {
      // First sync all streams
      const { data, error } = await supabase.functions.invoke('backend-sync', {
        body: { 
          action: 'sync-streams', 
          backendUrl, 
          data: streams 
        }
      });
      
      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      // Then cleanup orphan streams (streams in Docker but not in Supabase)
      const validIds = streams.map(s => s.id);
      await supabase.functions.invoke('backend-sync', {
        body: { 
          action: 'cleanup-streams', 
          backendUrl, 
          data: { validIds } 
        }
      });
      
      toast({ title: "Uspješno", description: `Sinkronizirano ${streams.length} streamova i očišćeni stari` });
      return true;
    } catch (err) {
      console.error(`[Sync] Failed to sync all streams`, err);
      const errorMsg = err instanceof Error ? err.message : 'Nepoznata greška';
      toast({ title: "Greška", description: `Sinkronizacija nije uspjela: ${errorMsg}`, variant: "destructive" });
      return false;
    }
  };

  return {
    streams,
    loading,
    addStream,
    updateStream,
    deleteStream,
    toggleStream,
    refetch: fetchStreams,
    syncAllStreams,
  };
};
