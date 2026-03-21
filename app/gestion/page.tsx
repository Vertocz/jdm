// app/gestion/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function GestionPage() {
  const router = useRouter();
  const [user,        setUser]        = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [message,     setMessage]     = useState<{ text: string; ok: boolean } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [alertMes,    setAlertMes]    = useState(true);
  const [alertAutres, setAlertAutres] = useState(false);
  const [newPwd,      setNewPwd]      = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (!u) { router.push("/"); return; }
      setUser(u);
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, alert_mes_candidats, alert_autres_candidats")
        .eq("user_id", u.id)
        .maybeSingle();
      if (prof) {
        setDisplayName(prof.display_name || "");
        setAlertMes(prof.alert_mes_candidats ?? true);
        setAlertAutres(prof.alert_autres_candidats ?? false);
      }
      setLoading(false);
    })();
  }, [router]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true); setMessage(null);
    try {
      const { error: pe } = await supabase
        .from("profiles")
        .update({ display_name: displayName, alert_mes_candidats: alertMes, alert_autres_candidats: alertAutres })
        .eq("user_id", user.id);
      if (pe) throw pe;

      if (newPwd) {
        if (newPwd !== confirmPwd) {
          setMessage({ text: "Les mots de passe ne correspondent pas.", ok: false });
          setSaving(false); return;
        }
        const { error: we } = await supabase.auth.updateUser({ password: newPwd });
        if (we) throw we;
        setNewPwd(""); setConfirmPwd("");
      }
      setMessage({ text: "Modifications enregistrées.", ok: true });
    } catch (err: any) {
      setMessage({ text: err.message ?? "Une erreur est survenue.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading">Chargement…</div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>

      {/* ── EN-TÊTE ── */}
      <div style={{ padding: "48px 0 40px", textAlign: "center" }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "clamp(2rem,5vw,3.2rem)",
          fontWeight: 900, lineHeight: 1,
          letterSpacing: "-1px", color: "var(--cream)",
          marginBottom: 6,
        }}>
          Mon compte
        </h1>
        {user?.email && (
          <p style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: ".65rem", color: "rgba(241,235,219,.25)",
            letterSpacing: "1px",
          }}>
            {user.email}
          </p>
        )}
      </div>

      {/* ── CONTENU ── */}
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 24px" }}>

        {/* Pseudo */}
        <GestionSection label="Identité">
          <GestionField label="Nom affiché" hint="Visible par les autres joueurs dans le classement">
            <input
              className="gestion-input"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Ton pseudo"
            />
          </GestionField>
        </GestionSection>

        {/* Notifications */}
        <GestionSection label="Notifications par email">
          <Toggle
            label="Quand un de mes candidats décède"
            sub="Tu reçois un email dès qu'un de tes paris se concrétise"
            checked={alertMes}
            onChange={setAlertMes}
          />
          <Toggle
            label="Quand un candidat d'un autre décède"
            sub="Reste informé même si ce n'est pas ton pari"
            checked={alertAutres}
            onChange={setAlertAutres}
          />
        </GestionSection>

        {/* Mot de passe */}
        <GestionSection label="Sécurité">
          <GestionField label="Nouveau mot de passe" hint="Laisser vide pour ne pas changer">
            <input
              className="gestion-input"
              type="password"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="6 caractères minimum"
            />
          </GestionField>
          {newPwd && (
            <GestionField label="Confirmer">
              <input
                className="gestion-input"
                type="password"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                placeholder="••••••••"
              />
            </GestionField>
          )}
        </GestionSection>

        {/* Message feedback */}
        {message && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "13px 16px", borderRadius: 12, marginBottom: 16,
            background: message.ok ? "rgba(74,222,128,.07)" : "rgba(248,113,113,.07)",
            border: `1px solid ${message.ok ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)"}`,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: message.ok ? "#4ade80" : "#f87171",
            }} />
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: ".82rem", fontWeight: 400,
              color: message.ok ? "rgba(74,222,128,.85)" : "rgba(248,113,113,.85)",
            }}>
              {message.text}
            </span>
          </div>
        )}

        {/* Bouton sauvegarder */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%", padding: "15px",
            background: saving ? "rgba(219,135,143,.4)" : "var(--rose)",
            color: "#0d0d18", border: "none", borderRadius: 14,
            fontFamily: "'Outfit', sans-serif",
            fontSize: ".82rem", fontWeight: 700,
            letterSpacing: "2.5px", textTransform: "uppercase",
            cursor: saving ? "not-allowed" : "pointer",
            transition: "all .22s ease",
          }}
          onMouseOver={e => { if (!saving) (e.currentTarget.style.background = "var(--cream)"); }}
          onMouseOut={e  => { if (!saving) (e.currentTarget.style.background = "var(--rose)"); }}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>

        {/* Zone danger */}
        <div style={{ marginTop: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(248,113,113,.1)" }} />
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: ".55rem", fontWeight: 300,
              letterSpacing: "3px", textTransform: "uppercase",
              color: "rgba(248,113,113,.3)",
            }}>
              Zone de danger
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(248,113,113,.1)" }} />
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/");
            }}
            style={{
              width: "100%", padding: "13px",
              background: "transparent",
              border: "1px solid rgba(248,113,113,.18)",
              borderRadius: 14, color: "rgba(248,113,113,.5)",
              fontFamily: "'Outfit', sans-serif",
              fontSize: ".78rem", fontWeight: 500,
              letterSpacing: "2px", textTransform: "uppercase",
              cursor: "pointer", transition: "all .2s ease",
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = "rgba(248,113,113,.4)";
              e.currentTarget.style.color = "rgba(248,113,113,.8)";
              e.currentTarget.style.background = "rgba(248,113,113,.05)";
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = "rgba(248,113,113,.18)";
              e.currentTarget.style.color = "rgba(248,113,113,.5)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Composants locaux ───────────────────────────────────────────────────── */
function GestionSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(241,235,219,.02)",
      border: "1px solid rgba(241,235,219,.06)",
      borderRadius: 18, padding: "24px 24px 8px",
      marginBottom: 16,
    }}>
      <p style={{
        fontFamily: "'Outfit', sans-serif",
        fontSize: ".58rem", fontWeight: 500,
        letterSpacing: "3px", textTransform: "uppercase",
        color: "rgba(241,235,219,.25)",
        marginBottom: 20,
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function GestionField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: ".65rem", fontWeight: 500,
          letterSpacing: "1.5px", textTransform: "uppercase",
          color: "rgba(241,235,219,.38)",
        }}>
          {label}
        </label>
        {hint && (
          <span style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: ".58rem", fontWeight: 300,
            color: "rgba(241,235,219,.2)",
          }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }: {
  label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, padding: "12px 0", marginBottom: 4,
        borderBottom: "1px solid rgba(241,235,219,.04)",
        cursor: "pointer",
      }}
      onClick={() => onChange(!checked)}
    >
      <div>
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: ".85rem", fontWeight: 400,
          color: checked ? "rgba(241,235,219,.75)" : "rgba(241,235,219,.4)",
          marginBottom: sub ? 2 : 0,
          transition: "color .2s",
        }}>
          {label}
        </p>
        {sub && (
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: ".65rem", fontWeight: 300,
            color: "rgba(241,235,219,.22)",
          }}>
            {sub}
          </p>
        )}
      </div>

      {/* Toggle switch */}
      <div style={{
        position: "relative", width: 44, height: 24,
        borderRadius: 12, flexShrink: 0,
        background: checked ? "var(--rose)" : "rgba(241,235,219,.1)",
        transition: "background .2s ease",
      }}>
        <div style={{
          position: "absolute", top: 4, left: checked ? 24 : 4,
          width: 16, height: 16, borderRadius: "50%",
          background: "white",
          transition: "left .2s cubic-bezier(.23,1,.32,1)",
          boxShadow: "0 1px 4px rgba(0,0,0,.3)",
        }} />
      </div>
    </div>
  );
}