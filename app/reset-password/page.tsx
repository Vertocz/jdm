// app/reset-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { useResetPassword } from "@/app/hooks/useResetPassword";

type Step = "loading" | "form" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword, loading } = useResetPassword();

  const [step,        setStep]        = useState<Step>("loading");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [error,       setError]       = useState("");

  // Supabase injecte la session depuis le hash de l'URL dès que detectSessionInUrl est actif.
  // On attend juste que onAuthStateChange la reçoive.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStep("form");
      }
    });

    // Timeout de sécurité : si après 5 s rien ne s'est passé, le lien est invalide
    const timeout = setTimeout(() => {
      setStep(s => s === "loading" ? "error" : s);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    const result = await updatePassword(password);
    if (!result.success) {
      setError(result.error ?? "Une erreur est survenue");
      return;
    }
    setStep("success");
    setTimeout(() => router.push("/"), 2500);
  };

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "var(--dark)",
    }}>
      <Image src="/logo.png" alt="Le Jeu de la Mort" width={64} height={64}
        style={{ objectFit: "contain", marginBottom: 32 }} priority />

      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "rgba(241,235,219,.04)",
        border: "1px solid rgba(241,235,219,.08)",
        borderRadius: 16,
        padding: "36px 32px",
      }}>

        {/* ── Chargement ── */}
        {step === "loading" && (
          <>
            <div className="h-auth-heading" style={{ marginBottom: 8 }}>Un instant<em>…</em></div>
            <p className="h-auth-sub" style={{ marginBottom: 0 }}>Vérification du lien en cours</p>
          </>
        )}

        {/* ── Lien invalide / expiré ── */}
        {step === "error" && (
          <>
            <div className="h-auth-heading" style={{ marginBottom: 8 }}>Lien in<em>valide.</em></div>
            <p className="h-auth-sub" style={{ marginBottom: 24 }}>
              Ce lien a expiré ou a déjà été utilisé.
            </p>
            <button className="h-auth-submit" onClick={() => router.push("/")}>
              Retour à l&apos;accueil
            </button>
          </>
        )}

        {/* ── Formulaire ── */}
        {step === "form" && (
          <>
            <div className="h-auth-heading" style={{ marginBottom: 8 }}>Nouveau mot de<em> passe.</em></div>
            <p className="h-auth-sub" style={{ marginBottom: 28 }}>6 caractères minimum</p>

            {error && <div className="h-auth-error">{error}</div>}

            <div className="h-auth-field">
              <label className="h-auth-label">Nouveau mot de passe</label>
              <input
                className="h-auth-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div className="h-auth-field">
              <label className="h-auth-label">Confirmer</label>
              <input
                className="h-auth-input"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
              />
            </div>
            <button className="h-auth-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? "Enregistrement…" : "Changer mon mot de passe"}
            </button>
          </>
        )}

        {/* ── Succès ── */}
        {step === "success" && (
          <>
            <div className="h-auth-heading" style={{ marginBottom: 8 }}>C&apos;est<em> bon !</em></div>
            <div className="h-auth-success" style={{ marginBottom: 0 }}>
              Mot de passe mis à jour. Redirection en cours…
            </div>
          </>
        )}
      </div>
    </main>
  );
}