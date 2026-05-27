import React, { useEffect, useState } from "react";
import { apiGet, apiPut } from "./mobileApi";

const emptyCompany = {
  name: "",
  business_name: "",
  cuit: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  province: "",
  country: "Argentina",
  website: "",
  logo_url: "",
  invoice_footer: "",
};

function normalizeCompany(data = {}) {
  return {
    name: data.name || data.nombre || data.company_name || "",
    business_name: data.business_name || data.razon_social || data.legal_name || "",
    cuit: data.cuit || data.tax_id || data.cuit_cuil || "",
    phone: data.phone || data.telefono || "",
    whatsapp: data.whatsapp || "",
    email: data.email || "",
    address: data.address || data.direccion || "",
    city: data.city || data.localidad || "",
    province: data.province || data.provincia || "",
    country: data.country || data.pais || "Argentina",
    website: data.website || data.web || "",
    logo_url: data.logo_url || data.logo || "",
    invoice_footer: data.invoice_footer || data.footer_text || data.pie_factura || "",
  };
}

export default function MobileCompany() {
  const [company, setCompany] = useState(emptyCompany);
  const [original, setOriginal] = useState(emptyCompany);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const changed = JSON.stringify(company) !== JSON.stringify(original);

  const loadCompany = async () => {
    try {
      setLoading(true);

      const data = await apiGet("/company-settings");
      const normalized = normalizeCompany(data?.company || data?.settings || data);

      setCompany(normalized);
      setOriginal(normalized);
    } catch (err) {
      console.warn("Error cargando empresa:", err);
      alert("No se pudieron cargar los datos de empresa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompany();
  }, []);

  const updateCompany = (field, value) => {
    setCompany((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveCompany = async (event) => {
    event.preventDefault();

    if (!company.name.trim()) {
      alert("Ingresá el nombre de la empresa.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...company,
        nombre: company.name,
        company_name: company.name,
        razon_social: company.business_name,
        tax_id: company.cuit,
        telefono: company.phone,
        direccion: company.address,
        localidad: company.city,
        provincia: company.province,
        pais: company.country,
        logo: company.logo_url,
        footer_text: company.invoice_footer,
      };

      await apiPut("/company-settings", payload);

      setOriginal(company);
      alert("Datos de empresa guardados.");
    } catch (err) {
      console.warn("Error guardando empresa:", err);
      alert(
        "No se pudo guardar empresa. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hsm-company-page">
      <section className="hsm-company-head">
        <div>
          <h2>Empresa</h2>
          <p>Configuración sincronizada con backend</p>
        </div>

        <button onClick={loadCompany}>Actualizar</button>
      </section>

      <section className="hsm-company-preview">
        <div className="hsm-company-logo-box">
          {company.logo_url ? (
            <img src={company.logo_url} alt="Logo empresa" />
          ) : (
            <span>🏢</span>
          )}
        </div>

        <div>
          <h3>{company.name || "HighSpeed"}</h3>
          <p>{company.business_name || "Datos de empresa"}</p>
          <small>{company.email || company.phone || "Sin contacto"}</small>
        </div>
      </section>

      {loading ? (
        <section className="hsm-company-empty">
          <p>Cargando empresa...</p>
        </section>
      ) : (
        <form onSubmit={saveCompany} className="hsm-company-form">
          <input
            value={company.name}
            onChange={(e) => updateCompany("name", e.target.value)}
            placeholder="Nombre de empresa"
          />

          <input
            value={company.business_name}
            onChange={(e) => updateCompany("business_name", e.target.value)}
            placeholder="Razón social"
          />

          <input
            value={company.cuit}
            onChange={(e) => updateCompany("cuit", e.target.value)}
            placeholder="CUIT / CUIL"
          />

          <input
            value={company.phone}
            onChange={(e) => updateCompany("phone", e.target.value)}
            placeholder="Teléfono"
          />

          <input
            value={company.whatsapp}
            onChange={(e) => updateCompany("whatsapp", e.target.value)}
            placeholder="WhatsApp"
          />

          <input
            value={company.email}
            onChange={(e) => updateCompany("email", e.target.value)}
            placeholder="email@empresa.com"
          />

          <input
            value={company.address}
            onChange={(e) => updateCompany("address", e.target.value)}
            placeholder="Dirección"
          />

          <input
            value={company.city}
            onChange={(e) => updateCompany("city", e.target.value)}
            placeholder="Localidad"
          />

          <input
            value={company.province}
            onChange={(e) => updateCompany("province", e.target.value)}
            placeholder="Provincia"
          />

          <input
            value={company.country}
            onChange={(e) => updateCompany("country", e.target.value)}
            placeholder="País"
          />

          <input
            value={company.website}
            onChange={(e) => updateCompany("website", e.target.value)}
            placeholder="Sitio web"
          />

          <input
            value={company.logo_url}
            onChange={(e) => updateCompany("logo_url", e.target.value)}
            placeholder="URL del logo"
          />

          <textarea
            value={company.invoice_footer}
            onChange={(e) => updateCompany("invoice_footer", e.target.value)}
            placeholder="Pie de factura / recibo"
          />

          <button type="submit" disabled={saving || !changed}>
            {saving ? "Guardando..." : changed ? "Guardar cambios" : "Sin cambios"}
          </button>
        </form>
      )}
    </div>
  );
}
