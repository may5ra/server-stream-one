import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Backend sync config - reads from panel_settings in Supabase
const getBackendUrl = async (): Promise<string | null> => {
  try {
    const { data } = await supabase
      .from("panel_settings")
      .select("key, value")
      .in("key", ["server_ip", "http_port"]);
    
    const serverIp = data?.find(s => s.key === "server_ip")?.value;
    const httpPort = data?.find(s => s.key === "http_port")?.value || "3001";
    
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

// Sync stream to Docker backend
const syncStreamToBackend = async (stream: Stream) => {
  const backendUrl = await getBackendUrl();
  if (!backendUrl) return;
  
  try {
    await fetch(`${backendUrl}/api/streams/sync-one`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stream),
    });
    console.log(`[Sync] Stream synced: ${stream.name}`);
  } catch (err) {
    console.error(`[Sync] Failed to sync stream: ${stream.name}`, err);
  }
};

// Delete stream from Docker backend
const deleteStreamFromBackend = async (id: string) => {
  const backendUrl = await getBackendUrl();
  if (!backendUrl) return;
  
  try {
    await fetch(`${backendUrl}/api/streams/sync/${id}`, {
      method: 'DELETE',
    });
    console.log(`[Sync] Stream deleted: ${id}`);
  } catch (err) {
    console.error(`[Sync] Failed to delete stream: ${id}`, err);
  }
};

// Sync all streams to Docker backend
const syncAllStreamsToBackend = async (streams: Stream[]) => {
  const backendUrl = await getBackendUrl();
  if (!backendUrl) return;
  
  try {
    await fetch(`${backendUrl}/api/streams/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streams }),
    });
    console.log(`[Sync] All streams synced: ${streams.length}`);
  } catch (err) {
    console.error(`[Sync] Failed to sync all streams`, err);
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
      // Auto-sync all streams to backend on fetch
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
    const newViewers = newStatus === "live" ? Math.floor(Math.random() * 100) : 0;

    await updateStream(id, { status: newStatus, viewers: newViewers });
  };

  const syncAllStreams = async () => {
    const backendUrl = await getBackendUrl();
    if (!backendUrl) {
      toast({ title: "Greška", description: "Backend URL nije postavljen u Settings", variant: "destructive" });
      return false;
    }
    
    try {
      const response = await fetch(`${backendUrl}/api/streams/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streams }),
      });
      
      if (!response.ok) throw new Error('Sync failed');
      
      toast({ title: "Uspješno", description: `Sinkronizirano ${streams.length} streamova` });
      return true;
    } catch (err) {
      console.error(`[Sync] Failed to sync all streams`, err);
      toast({ title: "Greška", description: "Sinkronizacija nije uspjela - provjeri backend", variant: "destructive" });
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
