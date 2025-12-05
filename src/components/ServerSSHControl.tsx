import { useState } from "react";
import { Terminal, Play, Square, RefreshCw, CheckCircle, XCircle, Loader2, HardDrive, Cpu, Server, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ServerSSHControlProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandResult {
  command: string;
  output: string;
  success: boolean;
  timestamp: string;
}

const COMMAND_GROUPS = [
  {
    title: "Nginx Control",
    icon: Server,
    commands: [
      { id: 'nginx-status', label: 'Status', variant: 'outline' as const },
      { id: 'nginx-start', label: 'Start', variant: 'default' as const },
      { id: 'nginx-stop', label: 'Stop', variant: 'destructive' as const },
      { id: 'nginx-restart', label: 'Restart', variant: 'secondary' as const },
      { id: 'nginx-reload', label: 'Reload Config', variant: 'outline' as const },
      { id: 'nginx-test', label: 'Test Config', variant: 'outline' as const },
    ]
  },
  {
    title: "System Info",
    icon: Cpu,
    commands: [
      { id: 'cpu-load', label: 'CPU Load', variant: 'outline' as const },
      { id: 'memory-usage', label: 'Memory', variant: 'outline' as const },
      { id: 'disk-usage', label: 'Disk', variant: 'outline' as const },
      { id: 'check-ports', label: 'Ports', variant: 'outline' as const },
    ]
  },
  {
    title: "Streaming",
    icon: FileVideo,
    commands: [
      { id: 'stream-processes', label: 'Processes', variant: 'outline' as const },
      { id: 'hls-files', label: 'HLS Files', variant: 'outline' as const },
      { id: 'recordings', label: 'Recordings', variant: 'outline' as const },
      { id: 'rtmp-stats', label: 'RTMP Stats', variant: 'outline' as const },
      { id: 'ffmpeg-version', label: 'FFmpeg', variant: 'outline' as const },
    ]
  }
];

export const ServerSSHControl = ({ open, onOpenChange }: ServerSSHControlProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<CommandResult[]>([]);

  const executeCommand = async (commandId: string) => {
    setLoading(commandId);
    
    try {
      const { data, error } = await supabase.functions.invoke('ssh-command', {
        body: { command: commandId }
      });

      if (error) throw error;

      const result: CommandResult = {
        command: commandId,
        output: data.output || 'No output',
        success: data.success ?? true,
        timestamp: new Date().toLocaleTimeString()
      };

      setResults(prev => [result, ...prev].slice(0, 10));

      toast({
        title: data.success ? "Uspješno" : "Greška",
        description: `Komanda ${commandId} izvršena`,
        variant: data.success ? "default" : "destructive"
      });
    } catch (error: any) {
      console.error('SSH command error:', error);
      
      const result: CommandResult = {
        command: commandId,
        output: error.message || 'Connection failed',
        success: false,
        timestamp: new Date().toLocaleTimeString()
      };
      
      setResults(prev => [result, ...prev].slice(0, 10));
      
      toast({
        title: "Greška",
        description: error.message || "Nije moguće izvršiti komandu",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            SSH Upravljanje Serverom
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 overflow-auto">
          {COMMAND_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <group.icon className="h-4 w-4" />
                {group.title}
              </h4>
              <div className="flex flex-wrap gap-2">
                {group.commands.map((cmd) => (
                  <Button
                    key={cmd.id}
                    variant={cmd.variant}
                    size="sm"
                    onClick={() => executeCommand(cmd.id)}
                    disabled={loading !== null}
                  >
                    {loading === cmd.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : cmd.id.includes('start') ? (
                      <Play className="h-3 w-3 mr-1" />
                    ) : cmd.id.includes('stop') ? (
                      <Square className="h-3 w-3 mr-1" />
                    ) : cmd.id.includes('restart') || cmd.id.includes('reload') ? (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    ) : null}
                    {cmd.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {results.length > 0 && (
          <div className="mt-4 space-y-2 overflow-auto max-h-[300px]">
            <h4 className="text-sm font-medium text-muted-foreground">Rezultati</h4>
            {results.map((result, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-lg border text-sm font-mono ${
                  result.success 
                    ? 'bg-success/10 border-success/30' 
                    : 'bg-destructive/10 border-destructive/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                  {result.success ? (
                    <CheckCircle className="h-3 w-3 text-success" />
                  ) : (
                    <XCircle className="h-3 w-3 text-destructive" />
                  )}
                  <span className="font-semibold">{result.command}</span>
                  <span className="ml-auto">{result.timestamp}</span>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-foreground/80 overflow-x-auto">
                  {result.output}
                </pre>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          Komande se izvršavaju na streaming serveru putem SSH konekcije.
        </p>
      </DialogContent>
    </Dialog>
  );
};
