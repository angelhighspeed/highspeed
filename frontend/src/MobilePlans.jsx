import React, { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "./mobileApi";

const emptyForm = {
  id: "",
  name: "",
  speed_down: "",
  speed_up: "",
  price: "",
  description: "",
  mikrotik_profile: "",
  active: true,
};

function getId(plan) {
  return plan?.id || plan?.plan_id;
}

function getName(plan) {
  return plan?.name || plan?.nombre || plan?.plan_name || `Plan #${getId(plan) || ""}`;
}

function getPrice(plan) {
  return plan?.price || plan?.precio || plan?.amount || plan?.monthly_price || "";
}

function getSpeedDown(plan) {
  return plan?.speed_down || plan?.download_speed || plan?.velocidad_bajada || plan?.down || "";
}

function getSpeedUp(plan) {
  return plan?.speed_up || plan?.upload_speed || plan?.velocidad_subida || plan?.up || "";
}

function getStatus(plan) {
  if (plan?.active === false) return "Inactivo";
  if (String(plan?.status || plan?.estado || "").toLowerCase() === "inactive") return "Inactivo";
  return "Activo";
}

export default function MobilePlans() {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const visiblePlans = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (plans || []).filter((plan) => {
      if (!term) return true;

      const text = [
        getName(plan),
        getPrice(plan),
        getSpeedDown(plan),
        getSpeedUp(plan),
        plan.description,
        plan.descripcion,
        plan.mikrotik_profile,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [plans, query]);

  const stats = useMemo(() => {
    return {
      total: plans.length,
      active: plans.filter((plan) => getStatus(plan) === "Activo").length,
      inactive: plans.filter((plan) => getStatus(plan) === "Inactivo").length,
    };
  }, [plans]);

  const loadPlans = async () => {
    try {
      setLoading(true);

      const data = await apiGet("/plans");
      const items = Array.isArray(data) ? data : data?.items || data?.plans || [];

      setPlans(items);
    } catch (err) {
      console.warn("Error cargando planes:", err);
      setPlans([]);
      alert("No se pudieron cargar los planes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(false);
    setShowForm(false);
  };

  const openNewPlan = () => {
    setForm(emptyForm);
    setEditing(false);
    setShowForm(true);
  };

  const openEditPlan = (plan) => {
    setForm({
      id: getId(plan),
      name: getName(plan),
      speed_down: getSpeedDown(plan),
      speed_up: getSpeedUp(plan),
      price: getPrice(plan),
      description: plan.description || plan.descripcion || "",
      mikrotik_profile: plan.mikrotik_profile || plan.profile || "",
      active: plan.active !== false,
    });

    setEditing(true);
    setShowForm(true);
  };

  const buildPayload = () => ({
    name: form.name,
    nombre: form.name,
    plan_name: form.name,

    speed_down: form.speed_down,
    download_speed: form.speed_down,
    velocidad_bajada: form.speed_down,

    speed_up: form.speed_up,
    upload_speed: form.speed_up,
    velocidad_subida: form.speed_up,

    price: Number(form.price || 0),
    precio: Number(form.price || 0),
    amount: Number(form.price || 0),
    monthly_price: Number(form.price || 0),

    description: form.description,
    descripcion: form.description,

    mikrotik_profile: form.mikrotik_profile,
    profile: form.mikrotik_profile,

    active: Boolean(form.active),
    status: form.active ? "active" : "inactive",
  });

  const validateForm = () => {
    if (!form.name.trim()) return "Ingresá el nombre del plan.";
    if (!String(form.price).trim()) return "Ingresá el precio.";
    return "";
  };

  const savePlan = async (event) => {
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
        await apiPut(`/plans/${form.id}`, payload);
        alert("Plan actualizado.");
      } else {
        await apiPost("/plans", payload);
        alert("Plan creado.");
      }

      resetForm();
      await loadPlans();
    } catch (err) {
      console.warn("Error guardando plan:", err);
      alert(
        "No se pudo guardar el plan. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (plan) => {
    const id = getId(plan);

    if (!id) {
      alert("Plan sin ID.");
      return;
    }

    if (!confirm(`¿Eliminar plan ${getName(plan)}?`)) return;

    try {
      setSaving(true);
      await apiDelete(`/plans/${id}`);
      await loadPlans();
      alert("Plan eliminado.");
    } catch (err) {
      console.warn("Error eliminando plan:", err);
      alert(
        "No se pudo eliminar el plan. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const showMikrotikRules = async (plan) => {
    const id = getId(plan);

    if (!id) {
      alert("Plan sin ID.");
      return;
    }

    try {
      const data = await apiGet(`/plans/${id}/mikrotik-rules`);
      alert("Reglas MikroTik: " + JSON.stringify(data));
    } catch (err) {
      console.warn("Error consultando reglas MikroTik:", err);
      alert(
        "No se pudieron cargar reglas MikroTik. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    }
  };

  return (
    <div className="hsm-plans-page">
      <section className="hsm-plans-head">
        <div>
          <h2>Planes</h2>
          <p>{stats.total} planes registrados</p>
        </div>

        <div className="hsm-plan-actions-top">
          <button onClick={openNewPlan}>+ Plan</button>
          <button onClick={loadPlans}>Actualizar</button>
        </div>
      </section>

      <section className="hsm-plan-stats">
        <div>
          <strong>{stats.active}</strong>
          <span>Activos</span>
        </div>

        <div>
          <strong>{stats.inactive}</strong>
          <span>Inactivos</span>
        </div>

        <div>
          <strong>{stats.total}</strong>
          <span>Total</span>
        </div>
      </section>

      <section className="hsm-plan-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar plan..."
        />
      </section>

      {showForm && (
        <section className="hsm-plan-card">
          <div className="hsm-plan-form-title">
            <h3>{editing ? "Editar plan" : "Nuevo plan"}</h3>
            <button type="button" onClick={resetForm}>×</button>
          </div>

          <form onSubmit={savePlan} className="hsm-plan-form">
            <input
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="Nombre del plan"
            />

            <input
              value={form.speed_down}
              onChange={(e) => updateForm("speed_down", e.target.value)}
              placeholder="Velocidad bajada, ej: 20M"
            />

            <input
              value={form.speed_up}
              onChange={(e) => updateForm("speed_up", e.target.value)}
              placeholder="Velocidad subida, ej: 5M"
            />

            <input
              type="number"
              value={form.price}
              onChange={(e) => updateForm("price", e.target.value)}
              placeholder="Precio"
            />

            <input
              value={form.mikrotik_profile}
              onChange={(e) => updateForm("mikrotik_profile", e.target.value)}
              placeholder="Perfil MikroTik / PPPoE"
            />

            <textarea
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              placeholder="Descripción"
            />

            <select
              value={form.active ? "active" : "inactive"}
              onChange={(e) => updateForm("active", e.target.value === "active")}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>

            <button type="submit" disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear plan"}
            </button>
          </form>
        </section>
      )}

      {loading && (
        <section className="hsm-plan-empty">
          <p>Cargando planes...</p>
        </section>
      )}

      {!loading && visiblePlans.length === 0 && (
        <section className="hsm-plan-empty">
          <p>No hay planes para mostrar.</p>
        </section>
      )}

      <section className="hsm-plan-list">
        {visiblePlans.map((plan) => {
          const id = getId(plan);
          const status = getStatus(plan);

          return (
            <article key={id} className="hsm-plan-card">
              <div className="hsm-plan-card-head">
                <div>
                  <h3>{getName(plan)}</h3>
                  <span className={`hsm-status ${status === "Activo" ? "active" : "pending"}`}>
                    {status}
                  </span>
                </div>

                <div className="hsm-plan-icon">📦</div>
              </div>

              <div className="hsm-plan-grid">
                <div>
                  <small>Precio</small>
                  <strong>${getPrice(plan) || "0"}</strong>
                </div>

                <div>
                  <small>Bajada</small>
                  <strong>{getSpeedDown(plan) || "-"}</strong>
                </div>

                <div>
                  <small>Subida</small>
                  <strong>{getSpeedUp(plan) || "-"}</strong>
                </div>

                <div>
                  <small>Perfil</small>
                  <strong>{plan.mikrotik_profile || plan.profile || "-"}</strong>
                </div>
              </div>

              {(plan.description || plan.descripcion) && (
                <p className="hsm-plan-description">
                  {plan.description || plan.descripcion}
                </p>
              )}

              <div className="hsm-plan-actions">
                <button onClick={() => openEditPlan(plan)}>Editar</button>
                <button onClick={() => showMikrotikRules(plan)}>MikroTik</button>
                <button className="danger" onClick={() => deletePlan(plan)}>Eliminar</button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
