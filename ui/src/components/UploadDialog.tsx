import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/useToast";
import { UploadCloud } from "lucide-react";

interface UploadDialogProps {
  open: boolean;
  onCancel: () => void;
  onUploadSuccess?: () => void;
}

export default function UploadDialog({ open, onCancel, onUploadSuccess }: UploadDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  if (!open) return null;

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload backup");
      }
      toast.showSuccess("Backup uploaded successfully.");
      setFile(null);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload backup.";
      toast.showError(message);
    } finally {
      setIsUploading(false);
      onCancel();
    }
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (dropped.name.endsWith('.sql.gz')) {
        setFile(dropped);
      } else {
        toast.showError("Only .sql.gz files are allowed.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/90">
      <div ref={dialogRef} className="bg-gray-800 rounded-lg shadow-lg p-8 max-w-sm w-full text-center">
        <h3 className="text-lg font-semibold text-white mb-4">Upload Backup</h3>
        {!file ? (
          <label
            className={`mb-4 flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors duration-150 cursor-pointer ${dragActive ? 'border-blue-400 bg-gray-700/40' : 'border-gray-600 bg-gray-800 hover:border-blue-400 hover:bg-gray-700/40'} py-8`}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
            onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
            onDrop={onDrop}
          >
            <UploadCloud className="w-8 h-8 text-blue-400 mb-2" />
            <span className="text-white text-sm mb-2">Drag & drop a <span className="font-mono">.sql.gz</span> file here</span>
            <button
              type="button"
              className="mt-2 px-3 py-1 rounded bg-blue-700 text-white text-xs hover:bg-blue-800 transition-colors cursor-pointer"
              onClick={e => { e.preventDefault(); inputRef.current?.click(); }}
              disabled={isUploading}
            >
              Click to select
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".sql.gz"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0] || null;
                if (f && !f.name.endsWith('.sql.gz')) {
                  toast.showError("Only .sql.gz files are allowed.");
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = '';
                } else {
                  setFile(f);
                  if (inputRef.current) inputRef.current.value = '';
                }
              }}
              disabled={isUploading}
            />
          </label>
        ) : (
          <div className="mb-4 flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors duration-150 border-gray-600 bg-gray-800 py-8">
            <UploadCloud className="w-8 h-8 text-blue-400 mb-2" />
            <span className="text-white text-sm mb-2">File ready to upload</span>
            <div className="flex items-center justify-center gap-2">
              <span className="text-blue-300 text-xs break-all">Selected: {file.name}</span>
              <button
                type="button"
                className="ml-2 px-2 py-0.5 rounded bg-gray-700 text-white text-xs hover:bg-red-600 transition-colors cursor-pointer"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                disabled={isUploading}
                aria-label="Remove file"
              >
                Remove
              </button>
            </div>
          </div>
        )}
        <div className="flex justify-center gap-4">
          <button
            className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-600 transition-colors cursor-pointer"
            onClick={onCancel}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={handleUpload}
            disabled={!file || isUploading}
          >
            {isUploading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent border-solid rounded-full animate-spin inline-block" />
            ) : null}
            {isUploading ? "Uploading ..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
} 