import { useState } from "react";
import { CapacitorHttp } from "@capacitor/core";
import logo from "./assets/logo.png";

const API = import.meta.env.VITE_API_URL || "http://192.168.0.113:8000";

function Login({ onLogin }) {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");

  const login = async (e) => {
    e.preventDefault();
    setError("");

    const payload = {
      username: form.username.trim(),
      password: form.password.trim(),
    };

    try {
      const res = await CapacitorHttp.post({
        url: `${API}/login`,
        headers: {
          "Content-Type": "application/json",
        },
        data: payload,
      });

      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
      }

      const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;

      localStorage.setItem("token", data.access_token || data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("username", data.username || payload.username);

      onLogin();
    } catch (err) {
      setError(`API: ${API} | ERROR: ${err?.message || String(err)}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#0ea5e9,transparent_30%),radial-gradient(circle_at_bottom_right,#2563eb,transparent_25%)] opacity-30" />

      <form
        onSubmit={login}
        className="relative w-full max-w-sm sm:max-w-md rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl p-5 sm:p-8 text-white"
      >
        <div className="flex justify-center mb-6">
          <img
            src={logo}
            alt="HighSpeed"
            className="w-28 sm:w-40 md:w-56 max-h-24 object-contain rounded-xl shadow-lg mx-auto"
         />
        </div>

        <h1 className="text-3xl font-bold text-center">HighSpeed ISP</h1>
        <p className="text-center text-slate-300 mt-2 mb-2">
          Panel de gestión ISP
        </p>

        <p className="text-center text-xs text-cyan-300 mb-6 break-all">
          API: {API}
        </p>

        <input
          className="w-full mb-4 rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
          placeholder="Usuario"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />

        <input
          className="w-full mb-4 rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
          type="password"
          placeholder="Contraseña"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/20 border border-red-400/30 px-4 py-3 text-red-200 text-xs break-all">
            {error}
          </div>
        )}

        <button className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 transition px-4 py-3 font-bold text-slate-950">
          Ingresar
        </button>

        <p className="text-center text-xs text-slate-400 mt-6">
          HighSpeed CRM · Fibra óptica · WISP
        </p>
      </form>
    </div>
  );
}

export default Login;
