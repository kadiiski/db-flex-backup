import { toast } from "sonner";

export function useToast() {
  const showError = (message: string) =>
    toast.error(message, {
      style: {
        color: "#f87171", // Tailwind red-400
        background: "#1a202c", // Tailwind gray-900
        border: "1px solid #ef4444", // Tailwind red-500
      },
    });

  const showSuccess = (message: string) =>
    toast.success(message, {
      style: {
        color: "#4ade80", // Tailwind green-400
        background: "#1a202c", // Tailwind gray-900
        border: "1px solid #22c55e", // Tailwind green-500
      },
    });

  return { showError, showSuccess };
} 