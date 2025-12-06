import { useState } from "react";
import { Upload, Link, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface M3UImportDialogProps {
  onImportComplete: () => void;
}

export function M3UImportDialog({ onImportComplete }: M3UImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [m3uUrl, setM3uUrl] = useState("");
  const [m3uContent, setM3uContent] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    total: number;
    imported: number;
    updated: number;
    skipped: number;
    errors?: string[];
  } | null>(null);
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setM3uContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async (useUrl: boolean) => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('m3u-import', {
        body: {
          m3u_url: useUrl ? m3uUrl : undefined,
          m3u_content: useUrl ? undefined : m3uContent,
          default_category: defaultCategory || undefined,
          overwrite_existing: overwriteExisting,
        },
      });

      if (error) throw error;

      setResult(data);

      if (data.success) {
        toast({
          title: "Import uspješan",
          description: `Uvezeno: ${data.imported}, Ažurirano: ${data.updated}, Preskočeno: ${data.skipped}`,
        });
        onImportComplete();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Greška pri importu';
      toast({
        title: "Greška",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setM3uUrl("");
    setM3uContent("");
    setDefaultCategory("");
    setOverwriteExisting(false);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          M3U Import
        </Button>
      </DialogTrigger>
      <DialogContent className="glass max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bulk Import iz M3U
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">
              <Link className="h-4 w-4 mr-2" />
              URL
            </TabsTrigger>
            <TabsTrigger value="file">
              <Upload className="h-4 w-4 mr-2" />
              Upload / Paste
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>M3U URL</Label>
              <Input
                value={m3uUrl}
                onChange={(e) => setM3uUrl(e.target.value)}
                placeholder="http://example.com/playlist.m3u"
              />
            </div>

            <Button
              onClick={() => handleImport(true)}
              disabled={loading || !m3uUrl}
              className="w-full"
              variant="glow"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importiranje...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importiraj s URL-a
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="file" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Upload M3U datoteku</Label>
              <Input
                type="file"
                accept=".m3u,.m3u8,text/plain"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <Label>Ili zalijepi M3U sadržaj</Label>
              <Textarea
                value={m3uContent}
                onChange={(e) => setM3uContent(e.target.value)}
                placeholder={`#EXTM3U\n#EXTINF:-1 tvg-id="channel1" group-title="Sport",Channel 1\nhttp://example.com/stream1.m3u8`}
                rows={8}
                className="font-mono text-xs"
              />
            </div>

            <Button
              onClick={() => handleImport(false)}
              disabled={loading || !m3uContent}
              className="w-full"
              variant="glow"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importiranje...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importiraj
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        <div className="border-t pt-4 space-y-4">
          <div className="space-y-2">
            <Label>Zadana kategorija (opcionalno)</Label>
            <Input
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
              placeholder="Koristi se ako kanal nema group-title"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Prepiši postojeće</Label>
              <p className="text-xs text-muted-foreground">
                Ažuriraj kanale koji već postoje u bazi
              </p>
            </div>
            <Switch
              checked={overwriteExisting}
              onCheckedChange={setOverwriteExisting}
            />
          </div>
        </div>

        {result && (
          <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Ukupno: <strong>{result.total}</strong></span>
              <span className="text-success">Uvezeno: <strong>{result.imported}</strong></span>
              <span className="text-primary">Ažurirano: <strong>{result.updated}</strong></span>
              <span className="text-muted-foreground">Preskočeno: <strong>{result.skipped}</strong></span>
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="text-xs text-destructive mt-2">
                <p className="font-medium">Greške:</p>
                <ul className="list-disc list-inside">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
