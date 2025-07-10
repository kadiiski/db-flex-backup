"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { LogOut, Download, RotateCcw, Database, UploadCloud } from "lucide-react";
import RestoreDialog, { BackupFile } from "@/components/RestoreDialog";
import UploadDialog from "@/components/UploadDialog";
import { useToast } from "@/hooks/useToast";
import cronstrue from 'cronstrue';

interface HomePageClientProps {
  pageTitle: string;
  retention: string;
  cronSchedule: string;
}

export default function HomePageClient({ pageTitle, retention, cronSchedule }: HomePageClientProps) {
  const router = useRouter();
  const baseButtonClass = "inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white rounded shadow cursor-pointer";
  const actionButtonClass = `${baseButtonClass} py-2 px-4`;
  const itemButtonClass = `${baseButtonClass} px-3 py-1 text-sm`;
  const scheduleText = cronstrue.toString(cronSchedule, { verbose: true });

  const [files, setFiles] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; file: BackupFile | null }>({ open: false, file: null });
  const [isGenerating, setIsGenerating] = useState(false);
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const fetchBackups = () => {
    setLoading(true);
    fetch("/api/list")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch backups");
        return res.json();
      })
      .then((data) => {
        setFiles(data.files || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load backups");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  useEffect(() => {
    if (!restoreDialog.open) return;
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setRestoreDialog({ open: false, file: null });
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setRestoreDialog({ open: false, file: null });
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [restoreDialog.open]);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  };

  const handleCreateBackup = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create backup");
      toast.showSuccess("Backup created!");
      fetchBackups();
    } catch {
      toast.showError("Failed to create backup");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (filename: string) => {
    setDownloadingFile(filename);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to download backup');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download backup.';
      toast.showError(message);
    } finally {
      setDownloadingFile(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="bg-gray-900 p-8 rounded-lg shadow-lg w-full max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">{pageTitle}</h1>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            className={`${actionButtonClass} disabled:opacity-60 disabled:cursor-not-allowed`}
            onClick={() => { if (!isGenerating) handleCreateBackup(); }}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent border-solid rounded-full animate-spin inline-block" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            {isGenerating ? "Backing up ..." : "Backup now"}
          </button>
          <button
            className={actionButtonClass}
            onClick={() => setUploadDialogOpen(true)}
          >
            <UploadCloud className="h-4 w-4" />
            Upload backup
          </button>
          <button
            className={`${actionButtonClass} ml-auto`}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
        <div className="bg-gray-800 rounded p-6 mt-4 text-left">
          <div className="mb-6 text-gray-400">
            Scheduled backups: {scheduleText.toLowerCase()}, keeping the last {retention} copies
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent border-solid rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : files.length === 0 ? (
            <div className="text-gray-400">No backups found.</div>
          ) : (
            <ul className="divide-y divide-gray-700">
              {files.map((file, idx) => (
                <li key={file.name + idx} className="py-4 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between relative group transition-colors duration-150 hover:bg-gray-700/40">
                  <span className="text-blue-300 break-all">{file.name}</span>
                  <span className="text-gray-400 text-xs sm:ml-4">{file.date}</span>
                  <span className="text-green-400 text-xs sm:ml-4">{file.sizeHuman}</span>
                  <div className="flex flex-row gap-2 sm:ml-4 mt-2 sm:mt-0">
                    <button
                      className={`${itemButtonClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                      onClick={() => { if (!downloadingFile) handleDownload(file.name); }}
                      disabled={!!downloadingFile}
                    >
                      {downloadingFile === file.name ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent border-solid rounded-full animate-spin inline-block" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Download
                    </button>
                    <button
                      className={itemButtonClass}
                      onClick={() => {
                        setRestoreDialog({ open: true, file });
                      }}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <RestoreDialog
        open={restoreDialog.open}
        file={restoreDialog.file}
        onCancel={() => setRestoreDialog({ open: false, file: null })}
        onRestoreSuccess={fetchBackups}
      />
      <UploadDialog
        open={uploadDialogOpen}
        onCancel={() => setUploadDialogOpen(false)}
        onUploadSuccess={fetchBackups}
      />
    </div>
  );
} 