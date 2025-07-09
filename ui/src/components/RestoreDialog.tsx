import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/useToast";

export interface BackupFile {
  name: string;
  date: string;
  sizeHuman: string;
}

interface RestoreDialogProps {
  open: boolean;
  file: BackupFile | null;
  onCancel: () => void;
  onRestoreSuccess?: () => void;
}

export default function RestoreDialog({ open, file, onCancel, onRestoreSuccess }: RestoreDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onCancel]);

  if (!open || !file) return null;

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const res = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to restore backup");
      }
      if (onRestoreSuccess) onRestoreSuccess();
      toast.showSuccess("Backup restored successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to restore backup.";
      toast.showError(message);
    } finally {
      setIsRestoring(false);
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/90">
      <div ref={dialogRef} className="bg-gray-800 rounded-lg shadow-lg p-8 max-w-sm w-full text-center">
        <h3 className="text-lg font-semibold text-white mb-4">Confirm Restore</h3>
        <p className="text-gray-300 mb-6">
          Are you sure you want to restore <span className="font-mono text-blue-300">{file.name}</span>?
        </p>
        <div className="flex justify-center gap-4">
          <button
            className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-600 transition-colors cursor-pointer"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent border-solid rounded-full animate-spin inline-block" />
            ) : null}
            {isRestoring ? "Restoring ..." : "Restore"}
          </button>
        </div>
      </div>
    </div>
  );
} 