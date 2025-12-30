"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function GestionPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Données du profil
  const [displayName, setDisplayName] = useState("");
  const [alertMesCandidats, setAlertMesCandidats] = useState(true);
  const [alertAutresCandidats, setAlertAutresCandidats] = useState(false);

  // Mot de passe
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      
      if (!u) {
        router.push("/");
        return;
      }

      setUser(u);

      // Charger le profil
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, alert_mes_candidats, alert_autres_candidats")
        .eq("user_id", u.id)
        .maybeSingle();

      if (profile) {
        setDisplayName(profile.display_name || "");
        setAlertMesCandidats(profile.alert_mes_candidats ?? true);
        setAlertAutresCandidats(profile.alert_autres_candidats ?? false);
      }

      setLoading(false);
    };

    init();
  }, [router]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setMessage("");

    try {
      // 1. Mettre à jour le profil
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          alert_mes_candidats: alertMesCandidats,
          alert_autres_candidats: alertAutresCandidats,
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // 2. Mettre à jour le mot de passe si renseigné
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          setMessage("❌ Les mots de passe ne correspondent pas");
          setSaving(false);
          return;
        }

        if (newPassword.length < 6) {
          setMessage("❌ Le mot de passe doit contenir au moins 6 caractères");
          setSaving(false);
          return;
        }

        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (passwordError) throw passwordError;

        setNewPassword("");
        setConfirmPassword("");
      }

      setMessage("✅ Modifications enregistrées avec succès !");
      
      // Recharger la page après 1.5s
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error: any) {
      console.error("Erreur lors de la sauvegarde:", error);
      setMessage("❌ Erreur lors de l'enregistrement");
    }

    setSaving(false);
  };

  if (loading) return <p>Chargement...</p>;

  if (!user) return <p>Vous devez être connecté.</p>;

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "20px" }}>
      <h1>Gérer mon compte</h1>

      <div
        style={{
          background: "linear-gradient(145deg, var(--card-bg) 0%, #1f3240 100%)",
          border: "3px solid var(--c2)",
          borderRadius: "20px",
          padding: "30px",
          marginTop: "30px",
        }}
      >
        {/* Pseudo */}
        <div style={{ marginBottom: "25px" }}>
          <label
            htmlFor="displayName"
            style={{
              display: "block",
              color: "var(--c2)",
              fontWeight: "700",
              marginBottom: "8px",
              fontSize: "1.1rem",
            }}
          >
            Pseudo
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Votre pseudo"
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "2px solid var(--c1)",
              borderRadius: "10px",
              background: "rgba(241, 235, 219, 0.05)",
              color: "var(--text)",
              fontFamily: "Quicksand, sans-serif",
              fontSize: "1rem",
            }}
          />
        </div>

        {/* Alertes */}
        <div style={{ marginBottom: "25px" }}>
          <h3 style={{ color: "var(--c2)", marginBottom: "15px" }}>
            Notifications email
          </h3>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={alertMesCandidats}
              onChange={(e) => setAlertMesCandidats(e.target.checked)}
              style={{
                width: "20px",
                height: "20px",
                cursor: "pointer",
              }}
            />
            <span style={{ color: "var(--text)" }}>
              M'alerter quand un de mes candidats décède
            </span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={alertAutresCandidats}
              onChange={(e) => setAlertAutresCandidats(e.target.checked)}
              style={{
                width: "20px",
                height: "20px",
                cursor: "pointer",
              }}
            />
            <span style={{ color: "var(--text)" }}>
              M'alerter quand un candidat d'un autre joueur décède
            </span>
          </label>
        </div>

        {/* Mot de passe */}
        <div style={{ marginBottom: "25px" }}>
          <h3 style={{ color: "var(--c2)", marginBottom: "15px" }}>
            Changer mon mot de passe
          </h3>

          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nouveau mot de passe (optionnel)"
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "2px solid var(--c1)",
              borderRadius: "10px",
              background: "rgba(241, 235, 219, 0.05)",
              color: "var(--text)",
              fontFamily: "Quicksand, sans-serif",
              fontSize: "1rem",
              marginBottom: "10px",
            }}
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmer le mot de passe"
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "2px solid var(--c1)",
              borderRadius: "10px",
              background: "rgba(241, 235, 219, 0.05)",
              color: "var(--text)",
              fontFamily: "Quicksand, sans-serif",
              fontSize: "1rem",
            }}
          />
        </div>

        {/* Bouton enregistrer */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%",
            padding: "15px",
            background: saving ? "#888" : "var(--c2)",
            color: "var(--fond)",
            border: "none",
            borderRadius: "12px",
            fontSize: "1.1rem",
            fontWeight: "700",
            cursor: saving ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
          }}
        >
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>

        {/* Message de retour */}
        {message && (
          <p
            style={{
              marginTop: "15px",
              textAlign: "center",
              fontSize: "1rem",
              fontWeight: "600",
              color: message.includes("✅") ? "#4ade80" : "#f87171",
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}