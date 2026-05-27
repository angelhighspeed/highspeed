import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "./mobileApi";

const emptyForm = {
  id: "",
  username: "",
  full_name: "",
  email: "",
  role: "operador",
  password: "",
  enabled: true,
};

const emptyPasswordForm = {
  user_id: "",
  username: "",
  password: "",
};

function getId(user) {
  return user?.id || user?.user_id;
}

function getUsername(user) {
  return user?.username || user?.user || user?.name || "Sin usuario";
}

function getFullName(user) {
  return user?.full_name || user?.nombre || user?.name || "";
}

function getRole(user) {
  return user?.role || user?.rol || "operador";
}

function isEnabled(user) {
  if (user?.disabled === true) return false;
  if (user?.enabled === false) return false;
  if (String(user?.status || "").toLowerCase() === "disabled") return false;
  if (String(user?.estado || "").toLowerCase() === "disabled") return false;
  return true;
}

export default function MobileUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(["admin", "tecnico", "operador"]);
  const [form, setForm] = useState(emptyForm);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [showForm, setShowForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const visibleUsers = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (users || []).filter((user) => {
      const enabled = isEnabled(user);

      if (filter === "enabled" && !enabled) return false;
      if (filter === "disabled" && enabled) return false;

      if (!term) return true;

      const text = [
        getUsername(user),
        getFullName(user),
        user.email,
        getRole(user),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [users, query, filter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      enabled: users.filter(isEnabled).length,
      disabled: users.filter((user) => !isEnabled(user)).length,
    };
  }, [users]);

  const loadUsers = async () => {
    try {
      setLoading(true);

      const data = await apiGet("/users-management");
      const items = Array.isArray(data) ? data : data?.items || data?.users || data?.data || [];

      setUsers(items);
    } catch (err) {
      console.warn("Error cargando usuarios:", err);
      setUsers([]);
      alert("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await apiGet("/users-management/roles");
      const items = Array.isArray(data) ? data : data?.roles || data?.items || [];

      if (items.length > 0) {
        setRoles(items.map((item) => String(item?.name || item?.role || item)));
      }
    } catch (err) {
      console.warn("No se pudieron cargar roles:", err);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadUsers(), loadRoles()]);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updatePasswordForm = (field, value) => {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(false);
    setShowForm(false);
  };

  const resetPasswordForm = () => {
    setPasswordForm(emptyPasswordForm);
    setShowPasswordForm(false);
  };

  const openNewUser = () => {
    setForm(emptyForm);
    setEditing(false);
    setShowForm(true);
  };

  const openEditUser = (user) => {
    setForm({
      id: getId(user),
      username: getUsername(user),
      full_name: getFullName(user),
      email: user.email || "",
      role: getRole(user),
      password: "",
      enabled: isEnabled(user),
    });

    setEditing(true);
    setShowForm(true);
  };

  const openPasswordUser = (user) => {
    setPasswordForm({
      user_id: getId(user),
      username: getUsername(user),
      password: "",
    });

    setShowPasswordForm(true);
  };

  const validateForm = () => {
    if (!form.username.trim()) return "Ingresá el usuario.";
    if (!editing && !form.password.trim()) return "Ingresá la contraseña.";
    if (!form.role) return "Seleccioná el rol.";
    return "";
  };

  const buildPayload = () => ({
    username: form.username,
    user: form.username,

    full_name: form.full_name,
    name: form.full_name,
    nombre: form.full_name,

    email: form.email,

    role: form.role,
    rol: form.role,

    password: form.password || undefined,

    enabled: Boolean(form.enabled),
    disabled: !form.enabled,
    status: form.enabled ? "active" : "disabled",
  });

  const saveUser = async (event) => {
    event.preventDefault();

    const validation = validateForm();

    if (validation) {
      alert(validation);
      return;
    }

    try {
      setSaving(true);

      const payload = buildPayload();

      if (editing && form.id) {
        await apiPut(`/users-management/${form.id}`, payload);
        alert("Usuario actualizado.");
      } else {
        await apiPost("/users-management", payload);
        alert("Usuario creado.");
      }

      resetForm();
      await loadUsers();
    } catch (err) {
      console.warn("Error guardando usuario:", err);
      alert(
        "No se pudo guardar el usuario. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();

    if (!passwordForm.user_id) {
      alert("Usuario sin ID.");
      return;
    }

    if (!passwordForm.password.trim()) {
      alert("Ingresá la nueva contraseña.");
      return;
    }

    try {
      setSaving(true);

      await apiPut(`/users-management/${passwordForm.user_id}/password`, {
        password: passwordForm.password,
        new_password: passwordForm.password,
      });

      resetPasswordForm();
      alert("Contraseña actualizada.");
    } catch (err) {
      console.warn("Error cambiando contraseña:", err);
      alert(
        "No se pudo cambiar la contraseña. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const enableUser = async (user) => {
    const id = getId(user);

    if (!id) {
      alert("Usuario sin ID.");
      return;
    }

    try {
      setSaving(true);
      await apiPut(`/users-management/${id}/enable`, {});
      await loadUsers();
      alert("Usuario habilitado.");
    } catch (err) {
      console.warn("Error habilitando usuario:", err);
      alert(
        "No se pudo habilitar el usuario. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const disableUser = async (user) => {
    const id = getId(user);

    if (!id) {
      alert("Usuario sin ID.");
      return;
    }

    if (!confirm(`¿Deshabilitar usuario ${getUsername(user)}?`)) return;

    try {
      setSaving(true);
      await apiPut(`/users-management/${id}/disable`, {});
      await loadUsers();
      alert("Usuario deshabilitado.");
    } catch (err) {
      console.warn("Error deshabilitando usuario:", err);
      alert(
        "No se pudo deshabilitar el usuario. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hsm-users-page">
      <section className="hsm-users-head">
        <div>
          <h2>Usuarios</h2>
          <p>{stats.total} usuarios registrados</p>
        </div>

        <div className="hsm-user-actions-top">
          <button onClick={openNewUser}>+ Usuario</button>
          <button onClick={loadAll}>Actualizar</button>
        </div>
      </section>

      <section className="hsm-user-stats">
        <div>
          <strong>{stats.enabled}</strong>
          <span>Habilitados</span>
        </div>

        <div>
          <strong>{stats.disabled}</strong>
          <span>Deshabilitados</span>
        </div>

        <div>
          <strong>{stats.total}</strong>
          <span>Total</span>
        </div>
      </section>

      <section className="hsm-user-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar usuario, nombre o rol..."
        />

        <div className="hsm-user-filter">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Todos
          </button>

          <button
            className={filter === "enabled" ? "active" : ""}
            onClick={() => setFilter("enabled")}
          >
            Habilitados
          </button>

          <button
            className={filter === "disabled" ? "active" : ""}
            onClick={() => setFilter("disabled")}
          >
            Deshabilitados
          </button>
        </div>
      </section>

      {showForm && (
        <section className="hsm-user-card">
          <div className="hsm-user-form-title">
            <h3>{editing ? "Editar usuario" : "Nuevo usuario"}</h3>
            <button type="button" onClick={resetForm}>×</button>
          </div>

          <form onSubmit={saveUser} className="hsm-user-form">
            <input
              value={form.username}
              onChange={(e) => updateForm("username", e.target.value)}
              placeholder="Usuario"
            />

            <input
              value={form.full_name}
              onChange={(e) => updateForm("full_name", e.target.value)}
              placeholder="Nombre completo"
            />

            <input
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
              placeholder="Email"
            />

            <select
              value={form.role}
              onChange={(e) => updateForm("role", e.target.value)}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            {!editing && (
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
                placeholder="Contraseña"
              />
            )}

            <select
              value={form.enabled ? "enabled" : "disabled"}
              onChange={(e) => updateForm("enabled", e.target.value === "enabled")}
            >
              <option value="enabled">Habilitado</option>
              <option value="disabled">Deshabilitado</option>
            </select>

            <button type="submit" disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear usuario"}
            </button>
          </form>
        </section>
      )}

      {showPasswordForm && (
        <section className="hsm-user-card">
          <div className="hsm-user-form-title">
            <h3>Cambiar contraseña</h3>
            <button type="button" onClick={resetPasswordForm}>×</button>
          </div>

          <form onSubmit={changePassword} className="hsm-user-form">
            <input
              value={passwordForm.username}
              readOnly
              placeholder="Usuario"
            />

            <input
              type="password"
              value={passwordForm.password}
              onChange={(e) => updatePasswordForm("password", e.target.value)}
              placeholder="Nueva contraseña"
            />

            <button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Actualizar contraseña"}
            </button>
          </form>
        </section>
      )}

      {loading && (
        <section className="hsm-user-empty">
          <p>Cargando usuarios...</p>
        </section>
      )}

      {!loading && visibleUsers.length === 0 && (
        <section className="hsm-user-empty">
          <p>No hay usuarios para mostrar.</p>
        </section>
      )}

      <section className="hsm-user-list">
        {visibleUsers.map((user) => {
          const enabled = isEnabled(user);
          const id = getId(user);

          return (
            <article key={id} className="hsm-user-card">
              <div className="hsm-user-card-head">
                <div>
                  <h3>{getUsername(user)}</h3>
                  <span className={`hsm-status ${enabled ? "active" : "pending"}`}>
                    {enabled ? "Habilitado" : "Deshabilitado"}
                  </span>
                </div>

                <div className="hsm-user-icon">👥</div>
              </div>

              <div className="hsm-user-grid">
                <div>
                  <small>Nombre</small>
                  <strong>{getFullName(user) || "-"}</strong>
                </div>

                <div>
                  <small>Rol</small>
                  <strong>{getRole(user)}</strong>
                </div>

                <div>
                  <small>Email</small>
                  <strong>{user.email || "-"}</strong>
                </div>

                <div>
                  <small>ID</small>
                  <strong>{id || "-"}</strong>
                </div>
              </div>

              <div className="hsm-user-actions">
                <button onClick={() => openEditUser(user)}>Editar</button>

                <button onClick={() => openPasswordUser(user)}>Contraseña</button>

                {enabled ? (
                  <button className="danger" onClick={() => disableUser(user)}>
                    Deshabilitar
                  </button>
                ) : (
                  <button onClick={() => enableUser(user)}>
                    Habilitar
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
