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
    <div className="glass rounded-xl p-4 sm:p-5 animate-fade-up" style={{ animationDelay: '0.2s' }}>
      <div className="mb-3 sm:mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground">Zadnji streamovi</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">Aktivni i nedavni</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => navigate("/streams")}>
          Sve
        </Button>
      </div>

      {streams.length === 0 ? (
        <div className="py-6 sm:py-8 text-center">
          <Tv className="mx-auto h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Nema streamova</p>
          <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate("/streams")}>
            Dodaj
          </Button>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-0">
          {/* Mobile cards view */}
          <div className="sm:hidden space-y-2">
            {streams.slice(0, 5).map((stream) => {
              const status = statusConfig[stream.status] || statusConfig.inactive;
              return (
                <div key={stream.id} className="rounded-lg bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground truncate flex-1 mr-2">{stream.name}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.bg} ${status.color}`}>
                      <Circle className="h-1.5 w-1.5 fill-current" />
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{inputTypeLabels[stream.input_type] || stream.input_type}</span>
                    <span className="font-mono">{stream.viewers} viewers</span>
                    <span className="font-mono">{stream.bitrate} kbps</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto">
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
        </div>
      )}
    </div>
  );
}
