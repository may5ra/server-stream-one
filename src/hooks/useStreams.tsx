import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDockerSync } from "./useDockerSync";

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
}

export const useStreams = () => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { syncToDocker } = useDockerSync();

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
    
    // Sync to Docker
    await syncToDocker('streams', 'insert', data);
    
    setStreams((prev) => [data, ...prev]);
    toast({ title: "Uspješno", description: "Stream dodan" });
    return data;
  };

  const updateStream = async (id: string, updates: Partial<Stream>) => {
    const { error } = await supabase
      .from("streams")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      return false;
    }

    // Sync to Docker
    const updatedStream = streams.find(s => s.id === id);
    if (updatedStream) {
      await syncToDocker('streams', 'update', { ...updatedStream, ...updates });
    }

    setStreams((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    toast({ title: "Ažurirano", description: "Stream ažuriran" });
    return true;
  };

  const deleteStream = async (id: string) => {
    const { error } = await supabase.from("streams").delete().eq("id", id);

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      return false;
    }

    // Sync to Docker
    await syncToDocker('streams', 'delete', { id });

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

  return {
    streams,
    loading,
    addStream,
    updateStream,
    deleteStream,
    toggleStream,
    refetch: fetchStreams,
  };
};
