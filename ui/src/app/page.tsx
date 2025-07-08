"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Settings, LogOut, Download, RotateCcw, Database, UploadCloud, MoreVertical } from "lucide-react";
import RestoreDialog, { BackupFile } from "@/components/RestoreDialog";
import UploadDialog from "@/components/UploadDialog";
import { useToast } from "@/hooks/useToast";

export default function HomePage() {
  const router = useRouter();
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; file: BackupFile | null }>({ open: false, file: null });
  const [isGenerating, setIsGenerating] = useState(false);
  const toast = useToast();
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
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
    if (!openMenu) return;
    function handleClick(e: MouseEvent) {
      if (openMenu) {
        const ref = menuRefs.current[openMenu];
        if (ref && !ref.contains(e.target as Node)) {
          setOpenMenu(null);
        }
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMenu]);

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
      setActionsOpen(false);
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
      setOpenMenu(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="bg-gray-900 p-8 rounded-lg shadow-lg w-full max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Database Backups</h1>
          <div className="relative">
            <button
              className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded-md shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:ring-offset-2 text-base cursor-pointer"
              onClick={() => setActionsOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={actionsOpen}
            >
              <MoreVertical className="h-5 w-5" />
              Actions
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-full mt-2 z-20 bg-gray-900 border border-gray-700 shadow-lg min-w-[220px] text-left">
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-white hover:bg-gray-700 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  onClick={() => { if (!isGenerating) handleCreateBackup(); }}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent border-solid rounded-full animate-spin inline-block" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {isGenerating ? "Generating ..." : "Create new backup"}
                </button>
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-white hover:bg-gray-700 transition-colors text-sm cursor-pointer"
                  onClick={() => { setActionsOpen(false); setUploadDialogOpen(true); }}
                >
                  <UploadCloud className="h-4 w-4" />
                  Upload backup
                </button>
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-white hover:bg-gray-700 transition-colors text-sm cursor-pointer"
                  onClick={() => { setActionsOpen(false); handleLogout(); }}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="bg-gray-800 rounded p-6 mt-4 text-left">
          <h2 className="text-xl font-semibold text-white mb-4">Backups</h2>
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
                  <span className="font-mono text-sm text-blue-300 break-all">{file.name}</span>
                  <span className="text-gray-400 text-xs sm:ml-4">{file.date}</span>
                  <span className="text-green-400 text-xs sm:ml-4">{file.sizeHuman}</span>
                  <div className="relative flex-shrink-0 sm:ml-4 mt-2 sm:mt-0">
                    <button
                      className="p-1 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                      onClick={() => setOpenMenu(openMenu === file.name ? null : file.name)}
                    >
                      <Settings className="h-5 w-5 text-gray-400" />
                    </button>
                    {openMenu === file.name && (
                      <div
                        ref={el => { menuRefs.current[file.name] = el; }}
                        className="absolute right-0 top-8 z-10 bg-gray-900 border border-gray-700 rounded shadow-lg min-w-[160px]"
                      >
                        <button
                          className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 rounded-t cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={() => { if (!downloadingFile) handleDownload(file.name); }}
                          disabled={!!downloadingFile}
                        >
                          {downloadingFile === file.name ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent border-solid rounded-full animate-spin inline-block" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          {downloadingFile === file.name ? 'Downloading ...' : 'Download'}
                        </button>
                        <button
                          className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 rounded-b cursor-pointer flex items-center gap-2"
                          onClick={() => {
                            setOpenMenu(null);
                            setRestoreDialog({ open: true, file });
                          }}
                        >
                          <RotateCcw className="w-4 h-4" />
                          Restore
                        </button>
                      </div>
                    )}
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
      {/* Close dropdown on outside click */}
      {actionsOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
      )}
    </div>
  );
}
