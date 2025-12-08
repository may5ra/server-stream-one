import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Bouquet {
  name: string;
  type: "live" | "vod" | "series";
  count: number;
}

export const useBouquets = () => {
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBouquets = async () => {
    try {
      // Get unique categories from streams (live)
      const { data: liveCategories } = await supabase
        .from("live_categories")
        .select("name")
        .order("sort_order");

      // Get unique categories from vod
      const { data: vodCategories } = await supabase
        .from("vod_categories")
        .select("name")
        .order("sort_order");

      // Get unique categories from series
      const { data: seriesCategories } = await supabase
        .from("series_categories")
        .select("name")
        .order("sort_order");

      // Get stream counts per category
      const { data: streams } = await supabase
        .from("streams")
        .select("category");

      const { data: vods } = await supabase
        .from("vod_content")
        .select("category_id, vod_categories(name)");

      const { data: series } = await supabase
        .from("series")
        .select("category_id, series_categories(name)");

      const bouquetList: Bouquet[] = [];

      // Add live categories
      (liveCategories || []).forEach((cat) => {
        const count = (streams || []).filter((s) => s.category === cat.name).length;
        bouquetList.push({ name: cat.name, type: "live", count });
      });

      // Also add any stream categories that aren't in live_categories
      const streamCategories = [...new Set((streams || []).map((s) => s.category).filter(Boolean))];
      streamCategories.forEach((cat) => {
        if (!bouquetList.find((b) => b.name === cat && b.type === "live")) {
          const count = (streams || []).filter((s) => s.category === cat).length;
          bouquetList.push({ name: cat as string, type: "live", count });
        }
      });

      // Add VOD categories
      (vodCategories || []).forEach((cat) => {
        const count = (vods || []).filter((v: any) => v.vod_categories?.name === cat.name).length;
        bouquetList.push({ name: cat.name, type: "vod", count });
      });

      // Add Series categories
      (seriesCategories || []).forEach((cat) => {
        const count = (series || []).filter((s: any) => s.series_categories?.name === cat.name).length;
        bouquetList.push({ name: cat.name, type: "series", count });
      });

      setBouquets(bouquetList);
    } catch (error) {
      console.error("Error fetching bouquets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBouquets();
  }, []);

  return { bouquets, loading, refetch: fetchBouquets };
};
