import { useState, useRef, useEffect } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, AlertCircle, Loader2, Maximize, Subtitles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SubtitleTrack {
  id: number;
  name: string;
  lang?: string;
}

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
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<number>(-1);

  useEffect(() => {
    if (!open || !streamUrl || !videoRef.current) return;

    setError(null);
    setLoading(true);
    setIsPlaying(false);
    setSubtitleTracks([]);
    setActiveSubtitle(-1);

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

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLoading(false);
        console.log("HLS manifest parsed, subtitle tracks:", hls.subtitleTracks);
        
        // Collect subtitle tracks
        if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
          const tracks = hls.subtitleTracks.map((track, index) => ({
            id: index,
            name: track.name || track.lang || `Subtitle ${index + 1}`,
            lang: track.lang,
          }));
          setSubtitleTracks(tracks);
          console.log("Found subtitle tracks:", tracks);
        }
        
        video.play().then(() => {
          setIsPlaying(true);
        }).catch((e) => {
          console.log("Autoplay blocked:", e);
          setLoading(false);
        });
      });

      // Listen for subtitle track switch
      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_, data) => {
        console.log("Subtitle track switched to:", data.id);
        setActiveSubtitle(data.id);
      });

      // Listen for subtitle tracks updated
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        console.log("Subtitle tracks updated:", data.subtitleTracks);
        if (data.subtitleTracks && data.subtitleTracks.length > 0) {
          const tracks = data.subtitleTracks.map((track, index) => ({
            id: index,
            name: track.name || track.lang || `Subtitle ${index + 1}`,
            lang: track.lang,
          }));
          setSubtitleTracks(tracks);
        }
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
        
        // Check for native text tracks in Safari
        if (video.textTracks && video.textTracks.length > 0) {
          const tracks: SubtitleTrack[] = [];
          for (let i = 0; i < video.textTracks.length; i++) {
            const track = video.textTracks[i];
            if (track.kind === 'subtitles' || track.kind === 'captions') {
              tracks.push({
                id: i,
                name: track.label || track.language || `Subtitle ${i + 1}`,
                lang: track.language,
              });
            }
          }
          setSubtitleTracks(tracks);
        }
        
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

  const setSubtitleTrack = (trackId: number) => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = trackId;
      setActiveSubtitle(trackId);
      console.log("Setting subtitle track to:", trackId);
    } else if (videoRef.current && videoRef.current.textTracks) {
      // Safari native
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = i === trackId ? 'showing' : 'hidden';
      }
      setActiveSubtitle(trackId);
    }
  };

  const disableSubtitles = () => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = -1;
      setActiveSubtitle(-1);
    } else if (videoRef.current && videoRef.current.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = 'hidden';
      }
      setActiveSubtitle(-1);
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
                
                {/* Subtitle selector */}
                {subtitleTracks.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={`h-8 w-8 text-white hover:bg-white/20 ${activeSubtitle >= 0 ? 'bg-white/20' : ''}`}
                      >
                        <Subtitles className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="min-w-[150px]">
                      <DropdownMenuItem 
                        onClick={disableSubtitles}
                        className={activeSubtitle === -1 ? 'bg-accent' : ''}
                      >
                        Isključeno
                      </DropdownMenuItem>
                      {subtitleTracks.map((track) => (
                        <DropdownMenuItem
                          key={track.id}
                          onClick={() => setSubtitleTrack(track.id)}
                          className={activeSubtitle === track.id ? 'bg-accent' : ''}
                        >
                          {track.name} {track.lang && `(${track.lang})`}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                
                <div className="flex-1" />
                
                {/* Subtitle indicator */}
                {subtitleTracks.length > 0 && (
                  <span className="text-xs text-white/70">
                    {subtitleTracks.length} titl{subtitleTracks.length === 1 ? '' : 'ova'}
                  </span>
                )}
                
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
          {subtitleTracks.length > 0 && (
            <p className="text-xs text-green-500 mt-1">
              ✓ Pronađeno {subtitleTracks.length} subtitle track{subtitleTracks.length === 1 ? '' : 'ova'}
            </p>
          )}
          {!loading && !error && subtitleTracks.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Nema embedded titlova u ovom streamu
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};