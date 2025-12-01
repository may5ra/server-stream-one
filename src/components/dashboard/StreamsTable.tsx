import { Circle, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { RecentStream } from "@/hooks/useDashboardStats";

interface StreamsTableProps {
  streams: RecentStream[];
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  live: { color: "text-success", bg: "bg-success/20", label: "Live" },
  inactive: { color: "text-muted-foreground", bg: "bg-muted", label: "Offline" },
  error: { color: "text-destructive", bg: "bg-destructive/20", label: "Error" },
};

const inputTypeLabels: Record<string, string> = {
  rtmp: "RTMP",
  rtsp: "RTSP",
  srt: "SRT",
  hls: "HLS",
  udp: "UDP",
};

export function StreamsTable({ streams }: StreamsTableProps) {
  const navigate = useNavigate();

  return (
    <div className="glass rounded-xl p-5 animate-fade-up" style={{ animationDelay: '0.2s' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Zadnji streamovi</h3>
          <p className="text-sm text-muted-foreground">Pregled aktivnih i nedavnih streamova</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/streams")}>
          Prikaži sve
        </Button>
      </div>

      {streams.length === 0 ? (
        <div className="py-8 text-center">
          <Tv className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Nema streamova</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/streams")}>
            Dodaj stream
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Naziv</th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Tip</th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Gledatelji</th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Bitrate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {streams.map((stream) => {
                const status = statusConfig[stream.status] || statusConfig.inactive;
                return (
                  <tr key={stream.id} className="group transition-colors hover:bg-muted/30">
                    <td className="py-3">
                      <span className="font-medium text-sm text-foreground">{stream.name}</span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.bg} ${status.color}`}>
                        <Circle className="h-2 w-2 fill-current" />
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-sm text-muted-foreground">
                        {inputTypeLabels[stream.input_type] || stream.input_type}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="font-mono text-sm text-foreground">{stream.viewers}</span>
                    </td>
                    <td className="py-3">
                      <span className="font-mono text-sm text-muted-foreground">{stream.bitrate} kbps</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
