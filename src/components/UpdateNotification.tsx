import { useState } from "react";
import { Download, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSystemUpdates } from "@/hooks/useSystemUpdates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const UpdateNotification = () => {
  const { hasUpdate, update, applyUpdate } = useSystemUpdates();
  const [showDialog, setShowDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!hasUpdate || !update) return null;

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await applyUpdate.mutateAsync(update.id);
      setShowDialog(false);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
        onClick={() => setShowDialog(true)}
      >
        <Download className="h-4 w-4" />
        Update {update.version}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova verzija dostupna: {update.version}</DialogTitle>
            <DialogDescription>
              {update.changelog || "Dostupna je nova verzija StreamPanel-a."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Update će automatski:
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
              <li>Kreirati backup baze podataka</li>
              <li>Preuzeti najnoviju verziju</li>
              <li>Ponovno pokrenuti servise</li>
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Kasnije
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ažuriranje...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Instaliraj update
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
