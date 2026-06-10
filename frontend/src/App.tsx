import { useState, useEffect } from "react";
import { LoginFlow } from "./views/LoginFlow";
import { UserDashboard } from "./views/UserDashboard";
import { AdminDashboard } from "./views/AdminDashboard";
import { ShieldAlert, RefreshCw } from "lucide-react";
import api from "./utils/api";

export default function App() {
  const [user, setUser] = useState<{ id: string; username: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    try {
      const response = await api.get("/auth/me");
      if (response.data.ok && response.data.user) {
        setUser(response.data.user);
      }
    } catch (err) {
      // Session expired/missing, keep user as logged-out
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // Ignore errors during logout
    }
    setUser(null);
  };

  if (loading) {
    return (
      <div className="soft-sky-theme min-h-screen bg-sky-50 flex flex-col items-center justify-center text-slate-600 font-mono gap-3">
        <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
        <span>Loading SecureShield...</span>
      </div>
    );
  }

  return (
    <div className="soft-sky-theme min-h-screen text-slate-700 cyber-grid flex flex-col justify-between">
      
      {/* Upper branding header */}
      {!user && (
        <header className="w-full py-5 px-6 max-w-7xl mx-auto flex justify-between items-center border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-sky-400 animate-pulse" />
            <span className="font-extrabold text-sm tracking-widest text-slate-800">SECURESHIELD</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            V2.0 Adaptive Shield active
          </span>
        </header>
      )}

      {/* Main Workspace Frame */}
      <main className="flex-1 flex items-center justify-center py-10 px-4">
        {!user ? (
          <LoginFlow onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />
        ) : user.role === "User" ? (
          <UserDashboard user={user} onLogout={handleLogout} />
        ) : (
          <AdminDashboard user={user} onLogout={handleLogout} />
        )}
      </main>

      {/* Footer copyright */}
      <footer className="w-full py-4 text-center border-t border-slate-200/80 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
        SecureShield • Enterprise Multi-Factor Authentication & Threat Intelligence platform
      </footer>

    </div>
  );
}
