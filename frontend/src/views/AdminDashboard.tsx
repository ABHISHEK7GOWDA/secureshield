import React, { useState, useEffect } from "react";
import { Shield, Users, AlertOctagon, Activity, ToggleLeft, ShieldAlert, Unlock, RefreshCw, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import api from "../utils/api";

interface AdminDashboardProps {
  user: { id: string; username: string; email: string; role: string };
  onLogout: () => void;
}

const COLORS = ["#38bdf8", "#fbbf24", "#f87171", "#dc2626"];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  
  // Tabs: 'incidents', 'users', 'policy', 'audit'
  const [activeTab, setActiveTab] = useState("incidents");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdmin = user.role === "Admin";

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError("");
    try {
      const usersRes = await api.get("/admin/users");
      setUsers(usersRes.data.users || []);

      const alertsRes = await api.get("/security/alerts");
      setAlerts(alertsRes.data.alerts || []);

      const logsRes = await api.get("/security/audit-logs");
      setAuditLogs(logsRes.data.logs || []);

      const policyRes = await api.get("/admin/policy");
      setPolicy(policyRes.data.policy || null);
    } catch (err: any) {
      setError("Failed to sync dashboard database registries.");
      // Fallback simulated data for demo
      setUsers([
        { id: "u1", username: "admin", email: "admin@secureshield.ai", role: "Admin", isMfaEnabled: true, failedAttempts: 0 },
        { id: "u2", username: "analyst_john", email: "john@secureshield.ai", role: "SecurityAnalyst", isMfaEnabled: true, failedAttempts: 0 },
        { id: "u3", username: "user_test", email: "test@secureshield.ai", role: "User", isMfaEnabled: true, failedAttempts: 4, lockUntil: new Date(Date.now() + 600000).toISOString() },
      ]);
      setAlerts([
        { _id: "a1", alertType: "impossible_travel", severity: "high", details: { ipAddress: "198.51.100.42", description: "Impossible travel delta: user signed in from NY then Berlin 10 minutes later.", riskScore: 82 }, resolved: false, createdAt: new Date().toISOString() },
        { _id: "a2", alertType: "suspicious_ip", severity: "medium", details: { ipAddress: "203.0.113.19", description: "Login attempt from flagged Tor Exit Node IP subnet.", riskScore: 65 }, resolved: true, createdAt: new Date(Date.now() - 3600 * 1000).toISOString() },
        { _id: "a3", alertType: "failed_mfa", severity: "critical", details: { ipAddress: "185.220.101.4", description: "Brute force biometric credentials stuffing script blocked.", riskScore: 95 }, resolved: false, createdAt: new Date(Date.now() - 7200 * 1000).toISOString() },
      ]);
      setAuditLogs([
        { action: "login_attempt", status: "success", ipAddress: "127.0.0.1", userAgent: "Chrome 125", createdAt: new Date().toISOString() },
        { action: "policy_update", status: "success", ipAddress: "127.0.0.1", userAgent: "Chrome 125", createdAt: new Date(Date.now() - 600000).toISOString() },
      ]);
      setPolicy({
        mfaThreshold: 30,
        blockThreshold: 75,
        weights: { unknownDevice: 20, untrustedDevice: 10, suspiciousIp: 25, geofenceOutlier: 30, impossibleTravel: 50, keystrokeMismatch: 30 }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (aid: string) => {
    setError("");
    setSuccess("");
    try {
      await api.post(`/security/alerts/${aid}/resolve`);
      setAlerts((prev) =>
        prev.map((a) => (a._id === aid ? { ...a, resolved: true, resolvedBy: user.username } : a))
      );
      setSuccess("Incident alert successfully resolved.");
    } catch (err: any) {
      setError("Failed to resolve threat indicator.");
    }
  };

  const handleUnlockUser = async (uid: string) => {
    if (!isAdmin) {
      setError("RBAC Restriction: Only Admins can modify account lockouts.");
      return;
    }
    setError("");
    setSuccess("");
    try {
      await api.post(`/admin/users/${uid}/unlock`);
      setUsers((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, lockUntil: undefined, failedAttempts: 0 } : u))
      );
      setSuccess("Account lock cleared successfully.");
    } catch (err: any) {
      setError("Failed to override lockout.");
    }
  };

  const handleChangeRole = async (uid: string, newRole: string) => {
    if (!isAdmin) {
      setError("RBAC Restriction: Only Admins can reconfigure roles.");
      return;
    }
    setError("");
    setSuccess("");
    try {
      await api.put(`/admin/users/${uid}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, role: newRole } : u)));
      setSuccess("User role changed successfully.");
    } catch (err: any) {
      setError("Failed to update user authorization role.");
    }
  };

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError("RBAC Restriction: Analysts cannot modify security policies.");
      return;
    }
    setError("");
    setSuccess("");
    try {
      await api.put("/admin/policy", policy);
      setSuccess("Adaptive risk parameters synchronized successfully.");
    } catch (err) {
      setError("Failed to update threat criteria thresholds.");
    }
  };

  // Prepping chart data
  const severityData = [
    { name: "Low", value: alerts.filter((a) => a.severity === "low").length },
    { name: "Medium", value: alerts.filter((a) => a.severity === "medium").length },
    { name: "High", value: alerts.filter((a) => a.severity === "high").length },
    { name: "Critical", value: alerts.filter((a) => a.severity === "critical").length },
  ].filter(d => d.value > 0);

  const riskHistogram = [
    { range: "0-20 (Safe)", count: alerts.filter((a) => a.details.riskScore <= 20).length },
    { range: "21-50 (MFA)", count: alerts.filter((a) => a.details.riskScore > 20 && a.details.riskScore <= 50).length },
    { range: "51-75 (Suspicious)", count: alerts.filter((a) => a.details.riskScore > 50 && a.details.riskScore <= 75).length },
    { range: "76-100 (Blocked)", count: alerts.filter((a) => a.details.riskScore > 75).length },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      {/* Dashboard Top Header bar */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-sky-400" />
            <h1 className="text-2xl font-black text-white">SecureShield Incident Command</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Console node: <span className="font-mono text-sky-400">admin-hub-1</span> • User: <span className="text-white font-bold">{user.username}</span> ({user.role})
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-xl text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Reload metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onLogout}
            className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 px-4 py-2 rounded-xl text-sm font-bold transition-all"
          >
            Sign Out
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-rose-950/20 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-sm mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-sm mb-6">
          {success}
        </div>
      )}

      {/* Overview Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">{alerts.filter(a => !a.resolved).length}</span>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Active Incidents</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">{users.length}</span>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Monitored Users</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">
              {alerts.length ? Math.round((alerts.filter(a => a.resolved).length / alerts.length) * 100) : 100}%
            </span>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Threat Mitigation Rate</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">{policy?.blockThreshold || 75}%</span>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Block Threshold Limit</p>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-800 mb-8 overflow-x-auto gap-2">
        {[
          { id: "incidents", label: "Threat Incidents feed", icon: AlertOctagon },
          { id: "users", label: "User Accounts", icon: Users },
          { id: "policy", label: "Adaptive Policy Rules", icon: ToggleLeft },
          { id: "audit", label: "Audit Trails", icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-sky-500 text-sky-400 bg-sky-950/10"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="min-h-[400px]">
        {/* Incident Alerts Tab */}
        {activeTab === "incidents" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* List */}
            <div className="lg:col-span-2 space-y-4">
              {alerts.length === 0 ? (
                <div className="bg-slate-900/40 p-12 text-center rounded-2xl border border-slate-850 text-slate-500 font-mono text-sm">
                  No threat incidents recorded in database.
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert._id}
                    className={`p-5 rounded-2xl border ${
                      alert.resolved
                        ? "bg-slate-900/20 border-slate-850 opacity-60"
                        : alert.severity === "critical"
                        ? "bg-rose-950/10 border-rose-500/35"
                        : alert.severity === "high"
                        ? "bg-orange-950/10 border-orange-500/25"
                        : "bg-slate-900/40 border-slate-800"
                    } hover:border-slate-700 transition-all`}
                  >
                    <div className="flex justify-between items-start gap-4 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${
                              alert.severity === "critical"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : alert.severity === "high"
                                ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                            }`}
                          >
                            {alert.severity} Severity
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            Type: {alert.alertType.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            • {new Date(alert.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-2">IP: {alert.details.ipAddress}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed mt-1">
                          {alert.details.description}
                        </p>
                      </div>

                      {!alert.resolved ? (
                        <button
                          onClick={() => handleResolveAlert(alert._id)}
                          className="bg-sky-500 hover:bg-sky-600 text-slate-950 text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors active:scale-[0.98]"
                        >
                          Mark Resolved
                        </button>
                      ) : (
                        <div className="text-xs text-slate-500 font-mono">
                          Resolved by: <span className="text-slate-400">{alert.resolvedBy || "System"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Charts right column */}
            <div className="space-y-6 lg:col-span-1">
              <div className="glass-panel p-5 rounded-2xl border border-slate-800">
                <h3 className="text-sm font-bold text-white mb-4">Risk Severity Ratios</h3>
                {severityData.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={severityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {severityData.map((entry, index) => (
                            <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", color: "#f8fafc" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-mono text-center py-10">No incident ratios available.</p>
                )}
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-slate-800">
                <h3 className="text-sm font-bold text-white mb-4">Assessment Histogram</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskHistogram}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="range" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b" }} />
                      <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Account Manager Tab */}
        {activeTab === "users" && (
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/50 border-b border-slate-800 text-xs font-mono text-slate-400 uppercase tracking-wider">
                    <th className="p-4.5">User</th>
                    <th className="p-4.5">Email Address</th>
                    <th className="p-4.5">MFA Configuration</th>
                    <th className="p-4.5">Role</th>
                    <th className="p-4.5 text-center">Status</th>
                    <th className="p-4.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-sm">
                  {users.map((u) => {
                    const isLocked = u.lockUntil && new Date(u.lockUntil) > new Date();
                    return (
                      <tr key={u.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="p-4.5 font-bold text-white">{u.username}</td>
                        <td className="p-4.5 text-slate-300 font-mono text-xs">{u.email}</td>
                        <td className="p-4.5 text-xs text-slate-400">
                          {u.isMfaEnabled ? "Email MFA Active" : "Bypassed"}
                        </td>
                        <td className="p-4.5">
                          {isAdmin ? (
                            <select
                              value={u.role}
                              onChange={(e) => handleChangeRole(u.id, e.target.value)}
                              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-sky-500/40"
                            >
                              <option value="User">User</option>
                              <option value="Admin">Admin</option>
                              <option value="SecurityAnalyst">SecurityAnalyst</option>
                            </select>
                          ) : (
                            <span className="font-mono text-xs bg-slate-950 px-2 py-1 border border-slate-850 rounded text-slate-400">
                              {u.role}
                            </span>
                          )}
                        </td>
                        <td className="p-4.5 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${
                              isLocked
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {isLocked ? "LOCKED OUT" : "SECURED"}
                          </span>
                        </td>
                        <td className="p-4.5 text-right">
                          {isLocked && isAdmin && (
                            <button
                              onClick={() => handleUnlockUser(u.id)}
                              className="bg-slate-900 border border-slate-800 text-sky-400 hover:bg-slate-850 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ml-auto active:scale-[0.97] transition-all"
                            >
                              <Unlock className="w-3.5 h-3.5" /> Override Lock
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Global Policy Threshold Editor Tab */}
        {activeTab === "policy" && policy && (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 max-w-3xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Adaptive Security Policy Settings</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Adjust global threat weight multipliers and adaptive action lock thresholds.
                </p>
              </div>
              {!isAdmin && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-amber-500 bg-amber-950/20 border border-amber-500/20 px-2.5 py-1 rounded">
                  <Eye className="w-4 h-4" /> READ-ONLY FEED (RBAC FILTER)
                </div>
              )}
            </div>

            <form onSubmit={handleUpdatePolicy} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider">
                    MFA Verification Threshold ({policy.mfaThreshold}%)
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    disabled={!isAdmin}
                    value={policy.mfaThreshold}
                    onChange={(e) => setPolicy({ ...policy, mfaThreshold: Number(e.target.value) })}
                    className="w-full accent-sky-400"
                  />
                  <span className="text-[10px] text-slate-500 leading-normal block mt-1">
                    Scores exceeding this limit will trigger multi-step secondary authentication challenges.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider">
                    Immediate Lockout Threshold ({policy.blockThreshold}%)
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    disabled={!isAdmin}
                    value={policy.blockThreshold}
                    onChange={(e) => setPolicy({ ...policy, blockThreshold: Number(e.target.value) })}
                    className="w-full accent-rose-500"
                  />
                  <span className="text-[10px] text-slate-500 leading-normal block mt-1">
                    Scores exceeding this limit will immediately trigger lockout blocks.
                  </span>
                </div>
              </div>

              {/* Weights sliders */}
              <div className="border-t border-slate-850 pt-5">
                <h4 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-4">Risk Weight Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: "unknownDevice", label: "Unknown Device Fingerprint" },
                    { key: "untrustedDevice", label: "Untrusted Device Baseline" },
                    { key: "suspiciousIp", label: "Suspicious IP Reputation segment" },
                    { key: "geofenceOutlier", label: "GPS Geofence Boundary Outlier" },
                    { key: "impossibleTravel", label: "Impossible Travel Velocity Match" },
                    { key: "keystrokeMismatch", label: "Keystroke Biometric Mismatch" },
                  ].map((w) => (
                    <div key={w.key}>
                      <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                        <span>{w.label}</span>
                        <span className="text-sky-400">+{policy.weights[w.key]} Risk</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="80"
                        disabled={!isAdmin}
                        value={policy.weights[w.key]}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            weights: { ...policy.weights, [w.key]: Number(e.target.value) },
                          })
                        }
                        className="w-full accent-sky-400"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <button
                  type="submit"
                  className="w-full bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold py-3 rounded-xl transition-all"
                >
                  Save Policy Configuration
                </button>
              )}
            </form>
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === "audit" && (
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/50 border-b border-slate-800 text-xs font-mono text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Action Event</th>
                    <th className="p-4">Target User</th>
                    <th className="p-4">IP Address</th>
                    <th className="p-4">UA Signature</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs font-mono">
                  {auditLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-4 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-4 text-white font-bold">{log.action.toUpperCase()}</td>
                      <td className="p-4 text-sky-400">{log.userId ? "User_UUID" : "ANONYMOUS"}</td>
                      <td className="p-4 text-slate-300">{log.ipAddress}</td>
                      <td className="p-4 text-slate-400">{log.userAgent.slice(0, 30)}...</td>
                      <td className="p-4 text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            log.status === "success"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          }`}
                        >
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
