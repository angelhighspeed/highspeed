import { useState } from "react";
import axios from "axios";
import logo from "./assets/logo.png";

const API = import.meta.env.VITE_API_URL;

function Login({ onLogin }) {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");

  const login = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(`${API}/auth/login`, form);

      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("role", res.data.role);

      onLogin();
    } catch {
      setError("Usuario o contraseña incorrectos");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#0ea5e9,transparent_30%),radial-gradient(circle_at_bottom_right,#2563eb,transparent_25%)] opacity-30" />

      <form
        onSubmit={login}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl p-8 text-white"
      >
        <div className="flex justify-center mb-6">
          <img
            src={logo}
            alt="HighSpeed"
            className="w-56 rounded-xl shadow-lg"
          />
        </div>

        <h1 className="text-3xl font-bold text-center">HighSpeed ISP</h1>
        <p className="text-center text-slate-300 mt-2 mb-8">
          Panel de gestión ISP
        </p>

        <input
          className="w-full mb-4 rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
          placeholder="Usuario"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />

        <input
          className="w-full mb-4 rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
          type="password"
          placeholder="Contraseña"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/20 border border-red-400/30 px-4 py-3 text-red-200">
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