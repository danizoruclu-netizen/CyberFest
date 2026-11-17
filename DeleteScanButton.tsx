import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteScan } from "@/lib/history/scan-store";

export function DeleteScanButton({ id, target, onDeleted, label = false }: { id: string; target: string; onDeleted?: () => void; label?: boolean }) {
  const confirm = () => {
    try {
      deleteScan(id);
      toast.success("Scan deleted", { description: target });
      onDeleted?.();
    } catch {
      toast.error("Couldn't delete this scan. Please try again.");
    }
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size={label ? "default" : "icon"} aria-label={`Delete scan ${id}`} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />{label && "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="glass-card border-glass-border">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this scan?</AlertDialogTitle>
          <AlertDialogDescription className="break-all">
            The report for “{target}” ({id}) will be removed from your history. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
