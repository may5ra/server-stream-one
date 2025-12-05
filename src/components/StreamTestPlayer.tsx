import { useState, useRef, useEffect } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, AlertCircle, Loader2, X, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface StreamTestPlayerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streamUrl: string;
  streamName: string;
}

export const StreamTestPlayer = ({ open, onOpenChange, streamUrl, streamName }: StreamTestPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !streamUrl || !videoRef.current) return;

    setError(null);
    setLoading(true);
    setIsPlaying(false);

    const video = videoRef.current;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        xhrSetup: (xhr) => {
          xhr.timeout = 10000;
        },
      });

      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().then(() => {
          setIsPlaying(true);
        }).catch((e) => {
          console.log("Autoplay blocked:", e);
          setLoading(false);
        });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError(`Mrežna greška: Ne mogu dohvatiti stream.\n${streamUrl}\n\nProvjeri da li je streaming server pokrenut i dostupan.`);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError("Greška medija: Format nije podržan ili je stream oštećen.");
              break;
            default:
              setError(`Fatalna greška: ${data.details}`);
              break;
          }
          setLoading(false);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS support
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => {
        setLoading(false);
        video.play().then(() => setIsPlaying(true)).catch(() => setLoading(false));
      });
      video.addEventListener("error", () => {
        setError(`Ne mogu učitati stream: ${streamUrl}`);
        setLoading(false);
      });
    } else {
      setError("HLS nije podržan u ovom pregledniku.");
      setLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [open, streamUrl]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            Test Stream: {streamName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative bg-black aspect-video">
          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
              <Loader2 className="h-10 w-10 animate-spin" />
              <p className="text-sm text-muted-foreground">Povezivanje na stream...</p>
              <code className="text-xs text-muted-foreground/70 max-w-[90%] break-all text-center">{streamUrl}</code>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-6">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="text-center">
                <p className="font-medium mb-2">Greška pri učitavanju streama</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{error}</p>
              </div>
            </div>
          )}
          
          <video
            ref={videoRef}
            className="w-full h-full"
            muted={isMuted}
            playsInline
          />
          
          {!loading && !error && (
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={togglePlay}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={toggleMute}>
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={toggleFullscreen}>
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <strong>URL:</strong> <code className="break-all">{streamUrl}</code>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
