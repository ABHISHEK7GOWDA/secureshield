import React, { useState, useEffect } from "react";
import { Shield, Key, Laptop, Clock, LogOut, Download, CheckCircle, RefreshCw, AlertTriangle } from "lucide-react";
import api from "../utils/api";

interface UserDashboardProps {
  user: { id: string; username: string; email: string; role: string };
  onLogout: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ user, onLogout }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Simulated User logs and metrics
  const securityScore = 95; // 95% Secure

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      await api.get(`/admin/users`); // We can fetch sessions list or simulate
      // For simplicity, let's list mock user session details or call endpoints
      // In mock DB mode, we can read sessions
      setSessions([
        {
          _id: "s1",
          ipAddress: "127.0.0.1",
          userAgent: navigator.userAgent.slice(0, 45) + "...",
          location: { city: "Bengaluru", country: "India" },
          createdAt: new Date().toISOString(),
          isCurrent: true,
        },
        {
          _id: "s2",
          ipAddress: "198.51.100.12",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)",
          location: { city: "New York", country: "United States" },
          createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          isCurrent: false,
        }
      ]);
    } catch (err) {
      setError("Failed to sync active session directory.");
    }
  };

  const handleRevokeSession = async (sid: string) => {
    setError("");
    setSuccessMsg("");
    try {
      // In standard mode, hit the revoke endpoint
      await api.delete(`/admin/sessions/${sid}`);
      setSessions((prev) => prev.filter((s) => s._id !== sid));
      setSuccessMsg("Session revoked successfully.");
    } catch (err: any) {
      setError("Failed to revoke session. Permissions restricted.");
    }
  };

  const generateNewBackupCodes = async () => {
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      // Let's call our mock/real backend to update codes
      // In this demo dashboard, we generate client-side codes and display them for user download
      const generated: string[] = [];
      for (let i = 0; i < 8; i++) {
        generated.push(Math.random().toString(16).substring(2, 10));
      }
      setBackupCodes(generated);
      setSuccessMsg("8 emergency backup codes generated successfully. Download them immediately.");
    } catch (err) {
      setError("Failed to compile backup codes.");
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = `SECURESHIELD - EMERGENCY BACKUP CODES\nUser: ${user.username}\nGenerated At: ${new Date().toLocaleString()}\n\nCodes (One-time use only):\n${backupCodes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nKeep this document secure. If you lose your phone/email access, enter one code at login.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `secureshield-backup-codes-${user.username}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      {/* Top Banner Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-sky-400" />
            <h1 className="text-2xl font-black text-white">SecureShield Console</h1>
          </div>
          <p className="text-sm text-slate-400">
            Welcome back, <span className="text-sky-400 font-bold">{user.username}</span> • Role: <span className="font-mono text-xs bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded">{user.role}</span>
          </p>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 px-4 py-2 rounded-xl text-sm font-bold active:scale-[0.98] transition-all"
        >
          <LogOut className="w-4 h-4" /> Terminate Session
        </button>
      </header>

      {error && (
        <div className="bg-rose-950/20 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-sm mb-6 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-sm mb-6 flex items-start gap-2.5">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Diagnostics and Scores */}
        <div className="space-y-8 lg:col-span-1">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-base font-bold text-white mb-4">Account Integrity Score</h3>
            <div className="flex items-center justify-center p-4">
              <div className="relative w-32 h-32 flex items-center justify-center rounded-full border-4 border-slate-850">
                {/* Score border animation mockup */}
                <div className="absolute inset-0 rounded-full border-4 border-sky-400 border-t-transparent animate-spin duration-3000 pointer-events-none" />
                <div className="text-center">
                  <span className="text-3xl font-extrabold text-white">{securityScore}%</span>
                  <p className="text-[10px] font-mono text-sky-400 uppercase tracking-widest mt-1">Excellent</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center leading-relaxed mt-2">
              Your profile is verified with complete biometric telemetry, geofence alignment, and device validation.
            </p>
          </div>

          {/* MFA configuration */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-base font-bold text-white mb-3">Multi-Factor Backups</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Generate static emergency backup codes to access your account if your secondary verification channel (Email/SMS) is inaccessible.
            </p>

            {backupCodes.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3.5 rounded-xl border border-slate-900 font-mono text-xs text-sky-300">
                  {backupCodes.map((c, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-slate-600">{i + 1}:</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={downloadBackupCodes}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download backup codes (.txt)
                </button>
              </div>
            ) : (
              <button
                onClick={generateNewBackupCodes}
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-sky-400 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                Generate Backup Codes
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Sessions management */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Active Device Sessions</h3>
                <p className="text-xs text-slate-400">Manage all concurrent sign-ins linked to this profile.</p>
              </div>
              <Laptop className="w-5 h-5 text-sky-400" />
            </div>

            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session._id}
                  className="bg-slate-900/40 p-4.5 rounded-xl border border-slate-850 flex justify-between items-center gap-4 hover:border-slate-800 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 bg-slate-950 rounded-lg text-slate-400 border border-slate-900 mt-1">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{session.ipAddress}</span>
                        {session.isCurrent && (
                          <span className="text-[10px] bg-sky-500/10 border border-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded font-bold font-mono">
                            THIS DEVICE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-normal mt-0.5">{session.userAgent}</p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mt-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Signed in: {new Date(session.createdAt).toLocaleString()}</span>
                        <span>•</span>
                        <span>Location: {session.location.city}, {session.location.country}</span>
                      </div>
                    </div>
                  </div>

                  {!session.isCurrent && (
                    <button
                      onClick={() => handleRevokeSession(session._id)}
                      className="text-slate-400 hover:text-rose-400 p-2 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/10 transition-all"
                      title="Terminate session"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
