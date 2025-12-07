import { useState, useRef, useEffect } from "react";
import Hls from "hls.js";
import * as dashjs from "dashjs";
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
  isExternal?: boolean;
}

interface StreamTestPlayerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streamUrl: string;
  streamName: string;
  inputType?: string;
  webvttUrl?: string | null;
  webvttLabel?: string | null;
  webvttLanguage?: string | null;
}

export const StreamTestPlayer = ({ 
  open, 
  onOpenChange, 
  streamUrl, 
  streamName,
  inputType,
  webvttUrl,
  webvttLabel,
  webvttLanguage 
}: StreamTestPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<dashjs.MediaPlayerClass | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<number>(-1);
  const [playerType, setPlayerType] = useState<'hls' | 'dash' | 'native'>('hls');

  // Detect if stream is DASH/MPD
  const isDash = inputType === 'mpd' || streamUrl.toLowerCase().includes('.mpd');

  // Add external WebVTT track to video element
  const addExternalSubtitle = (video: HTMLVideoElement) => {
    if (!webvttUrl) return;
    
    // Remove existing external tracks
    const existingTracks = video.querySelectorAll('track[data-external="true"]');
    existingTracks.forEach(t => t.remove());
    
    // Create new track element
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = webvttLabel || 'Subtitles';
    track.srclang = webvttLanguage || 'hr';
    track.src = webvttUrl;
    track.default = false;
    track.setAttribute('data-external', 'true');
    
    video.appendChild(track);
    console.log("Added external WebVTT track:", webvttUrl);
    
    return track;
  };

  // Cleanup function
  const cleanup = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (dashRef.current) {
      dashRef.current.destroy();
      dashRef.current = null;
    }
  };

  useEffect(() => {
    if (!open || !streamUrl || !videoRef.current) return;

    setError(null);
    setLoading(true);
    setIsPlaying(false);
    setSubtitleTracks([]);
    setActiveSubtitle(-1);

    const video = videoRef.current;

    // Cleanup previous instances
    cleanup();

    // DASH/MPD Stream
    if (isDash) {
      console.log("[Player] Using DASH.js for MPD stream:", streamUrl);
      setPlayerType('dash');
      
      try {
        const player = dashjs.MediaPlayer().create();
        dashRef.current = player;
        
        // Extract base URL from the proxy URL to handle relative segment paths
        const proxyBaseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
        console.log("[DASH] Proxy base URL:", proxyBaseUrl);
        
        player.initialize(video, streamUrl, false);
        player.updateSettings({
          streaming: {
            abr: {
              autoSwitchBitrate: { video: true, audio: true }
            },
            buffer: {
              fastSwitchEnabled: true
            }
          }
        });
        
        // Intercept and modify segment URLs to go through proxy
        player.extend('RequestModifier', function () {
          return {
            modifyRequestURL: function (url: string) {
              // If URL is relative or needs to be proxied
              if (!url.startsWith('http') || !url.includes('/stream-proxy/')) {
                // Check if it's a relative URL from the manifest
                if (!url.startsWith('http')) {
                  const newUrl = proxyBaseUrl + url;
                  console.log("[DASH] Rewriting relative URL:", url, "->", newUrl);
                  return newUrl;
                }
              }
              return url;
            },
            modifyRequestHeader: function (xhr: XMLHttpRequest) {
              return xhr;
            }
          };
        }, true);
        
        player.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, () => {
          console.log("[DASH] Manifest loaded successfully");
          setLoading(false);
          
          // Check for text tracks
          const tracks = player.getTracksFor('text');
          if (tracks && tracks.length > 0) {
            const subtitles: SubtitleTrack[] = tracks.map((track, index) => ({
              id: index,
              name: track.labels?.[0]?.text || track.lang || `Subtitle ${index + 1}`,
              lang: track.lang,
              isExternal: false,
            }));
            setSubtitleTracks(subtitles);
            console.log("[DASH] Found subtitle tracks:", subtitles);
          }
          
          // Add external WebVTT if configured
          if (webvttUrl) {
            addExternalSubtitle(video);
            setSubtitleTracks(prev => [...prev, {
              id: 1000,
              name: webvttLabel || 'External Subtitles',
              lang: webvttLanguage || 'hr',
              isExternal: true,
            }]);
          }
        });
        
        player.on(dashjs.MediaPlayer.events.CAN_PLAY, () => {
          console.log("[DASH] Can play - starting playback");
          video.play().then(() => {
            setIsPlaying(true);
          }).catch((e) => {
            console.log("[DASH] Autoplay blocked:", e);
          });
        });
        
        player.on(dashjs.MediaPlayer.events.ERROR, (e: { error?: { message?: string; code?: number } }) => {
          console.error("[DASH] Error:", e);
          const errorMsg = e.error?.message || 'Nepoznata greška';
          const errorCode = e.error?.code ? ` (kod: ${e.error.code})` : '';
          setError(`DASH greška: ${errorMsg}${errorCode}`);
          setLoading(false);
        });

        player.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_STARTED, (e: { request?: { url?: string } }) => {
          console.log("[DASH] Loading fragment:", e.request?.url);
        });
        
      } catch (e) {
        console.error("[DASH] Init error:", e);
        setError(`Greška pri inicijalizaciji DASH playera: ${e}`);
        setLoading(false);
      }
      
    } else if (Hls.isSupported()) {
      // HLS Stream
      console.log("[Player] Using HLS.js for stream:", streamUrl);
      setPlayerType('hls');
      
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
        console.log("HLS manifest parsed, subtitle tracks:", hls.subtitleTracks);
        
        const tracks: SubtitleTrack[] = [];
        
        // Collect embedded subtitle tracks from HLS
        if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
          hls.subtitleTracks.forEach((track, index) => {
            tracks.push({
              id: index,
              name: track.name || track.lang || `Subtitle ${index + 1}`,
              lang: track.lang,
              isExternal: false,
            });
          });
          console.log("Found embedded subtitle tracks:", tracks);
        }
        
        // Add external WebVTT if configured
        if (webvttUrl) {
          addExternalSubtitle(video);
          tracks.push({
            id: 1000,
            name: webvttLabel || 'External Subtitles',
            lang: webvttLanguage || 'hr',
            isExternal: true,
          });
          console.log("Added external subtitle track from settings");
        }
        
        setSubtitleTracks(tracks);
        
        video.play().then(() => {
          setIsPlaying(true);
        }).catch((e) => {
          console.log("Autoplay blocked:", e);
          setLoading(false);
        });
      });

      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_, data) => {
        console.log("Subtitle track switched to:", data.id);
        setActiveSubtitle(data.id);
      });

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
      console.log("[Player] Using native HLS for Safari");
      setPlayerType('native');
      
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => {
        setLoading(false);
        
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
      setError("Ni HLS ni DASH nisu podržani u ovom pregledniku.");
      setLoading(false);
    }

    return cleanup;
  }, [open, streamUrl, isDash, webvttUrl, webvttLabel, webvttLanguage]);

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

  const setSubtitleTrack = (trackId: number, isExternal?: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    
    // Handle external WebVTT track
    if (isExternal && trackId === 1000) {
      // Disable player subtitles
      if (hlsRef.current) {
        hlsRef.current.subtitleTrack = -1;
      }
      if (dashRef.current) {
        dashRef.current.setTextTrack(-1);
      }
      // Enable external track
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        if (track.label === (webvttLabel || 'Subtitles')) {
          track.mode = 'showing';
        } else {
          track.mode = 'hidden';
        }
      }
      setActiveSubtitle(trackId);
      console.log("Enabled external subtitle track");
      return;
    }
    
    // Handle DASH subtitles
    if (dashRef.current) {
      dashRef.current.setTextTrack(trackId);
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'hidden';
      }
      setActiveSubtitle(trackId);
      console.log("Setting DASH subtitle track to:", trackId);
      return;
    }
    
    // Handle HLS embedded subtitles
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = trackId;
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'hidden';
      }
      setActiveSubtitle(trackId);
      console.log("Setting HLS subtitle track to:", trackId);
    } else if (video.textTracks) {
      // Native
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = i === trackId ? 'showing' : 'hidden';
      }
      setActiveSubtitle(trackId);
    }
  };

  const disableSubtitles = () => {
    const video = videoRef.current;
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = -1;
    }
    if (dashRef.current) {
      dashRef.current.setTextTrack(-1);
    }
    if (video && video.textTracks) {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'hidden';
      }
    }
    setActiveSubtitle(-1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            Test Stream: {streamName}
            <span className="text-xs text-muted-foreground ml-2">
              ({playerType.toUpperCase()})
            </span>
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
                          onClick={() => setSubtitleTrack(track.id, track.isExternal)}
                          className={activeSubtitle === track.id ? 'bg-accent' : ''}
                        >
                          {track.name} {track.lang && `(${track.lang})`} {track.isExternal && '⬇'}
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
