"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          showSuccess(data.message);
        }
        router.push("/");
      } else {
        const data = await res.json();
        showError(data.error || "Login failed");
      }
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <form
        onSubmit={handleLogin}
        className="bg-gray-900 p-8 rounded-lg shadow-lg w-full max-w-md"
      >
        <h2 className="text-3xl font-bold mb-6 text-white text-center">Login</h2>
        <div className="mb-4">
          <label className="block text-gray-300 mb-2" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="username"
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-300 mb-2" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          disabled={isLoggingIn}
        >
          {isLoggingIn && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent border-solid rounded-full animate-spin inline-block" />
          )}
          {isLoggingIn ? "Logging in ..." : "Login"}
        </button>
      </form>
    </div>
  );
} 