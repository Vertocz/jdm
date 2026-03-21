// app/components/Header.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseAuth } from "@/app/hooks/useSupabaseAuth";
import { useSignup } from "@/app/hooks/useSignUp";
import { useResetPassword } from "@/app/hooks/useResetPassword";

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useSupabaseAuth();
  const { signup, loading: signupLoading } = useSignup();
  const { requestReset, loading: resetLoading } = useResetPassword();

  const [burgerOpen,  setBurgerOpen]  = useState(false);
  const [authOpen,    setAuthOpen]    = useState(false);
  const [authMode,    setAuthMode]    = useState<"signin" | "signup" | "reset">("signin");
  const [authEmail,   setAuthEmail]   = useState("");
  const [authPwd,     setAuthPwd]     = useState("");
  const [authConfirm, setAuthConfirm] = useState("");
  const [authName,    setAuthName]    = useState("");
  const [authError,   setAuthError]   = useState("");
  const [resetSent,   setResetSent]   = useState(false);
  const [signupConfirm, setSignupConfirm] = useState(false);

  const resetAuth = (mode: "signin" | "signup" | "reset") => {
    setAuthMode(mode); setAuthError(""); setResetSent(false); setSignupConfirm(false);
    setAuthEmail(""); setAuthPwd(""); setAuthConfirm(""); setAuthName("");
  };

  const handleAuth = async () => {
    setAuthError("");
    if (authMode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPwd });
      if (error) { setAuthError("Email ou mot de passe incorrect"); return; }
      setAuthOpen(false); router.push("/salle-attente");
    } else if (authMode === "signup") {
      const result = await signup({ email: authEmail, password: authPwd, confirmPassword: authConfirm, displayName: authName });
      if (!result.success) { setAuthError(result.error ?? "Erreur"); return; }
      if (result.needsConfirmation) { setSignupConfirm(true); return; }
      setAuthOpen(false); router.push("/salle-attente");
    } else {
      const result = await requestReset(authEmail);
      if (!result.success) { setAuthError(result.error ?? "Erreur"); return; }
      setResetSent(true);
    }
  };

  const close = () => setBurgerOpen(false);
  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* ── NAV ── */}
      <nav className="h-nav scrolled" style={{ position: "sticky" }}>

        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", flexShrink: 0, opacity: 1, animation: "none" }}>
          <Image src="/logo.png" alt="Le Jeu de la Mort" width={52} height={52}
            style={{ objectFit: "contain" }} priority />
        </Link>

        {/* Liens desktop — cachés sur mobile via CSS */}
        <div className="h-nav-links" style={{ opacity: 1, animation: "none" }}>
          {[
            { href: "/",             label: "Accueil"     },
            ...(user ? [{ href: "/salle-attente", label: "Ma salle" }] : []),
            { href: "/classement",   label: "Classement"  },
            { href: "/favoris",      label: "Favoris"     },
            { href: "/in-memoriam",  label: "In Memoriam" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className={`h-nav-link${isActive(href) ? " active" : ""}`}>
              {label}
            </Link>
          ))}
        </div>

        {/* Actions desktop — cachées sur mobile via CSS */}
        <div className="h-nav-actions" style={{ opacity: 1, animation: "none" }}>
          {user ? (
            <>
              <Link href="/gestion" title="Paramètres"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: "50%",
                  border: `1px solid ${isActive("/gestion") ? "rgba(219,135,143,.5)" : "rgba(241,235,219,.12)"}`,
                  color: isActive("/gestion") ? "var(--rose)" : "rgba(241,235,219,.4)",
                  textDecoration: "none", transition: "all .2s ease", flexShrink: 0,
                }}
                onMouseOver={e => { const el = e.currentTarget; el.style.borderColor="rgba(219,135,143,.5)"; el.style.color="var(--rose)"; el.style.background="rgba(219,135,143,.07)"; }}
                onMouseOut={e  => { const el = e.currentTarget; el.style.borderColor=isActive("/gestion")?"rgba(219,135,143,.5)":"rgba(241,235,219,.12)"; el.style.color=isActive("/gestion")?"var(--rose)":"rgba(241,235,219,.4)"; el.style.background="transparent"; }}
              >
                <GearIcon />
              </Link>
              <button className="h-nav-btn" onClick={() => { supabase.auth.signOut(); router.push("/"); }}>
                Déconnexion
              </button>
            </>
          ) : (
            <button className="h-nav-btn" onClick={() => setAuthOpen(true)}>Connexion</button>
          )}
        </div>

        {/* Hamburger mobile */}
        <button
          className={`h-burger${burgerOpen ? " open" : ""}`}
          style={{ opacity: 1, animation: "none" }}
          onClick={() => setBurgerOpen(v => !v)}
          aria-label="Menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* ── MENU MOBILE ── */}
      <div className={`h-mobile-menu${burgerOpen ? " open" : ""}`} style={{ top: 64 }}>
        {[
          { href: "/",              label: "Accueil"     },
          ...(user ? [
            { href: "/salle-attente", label: "Ma salle"  },
          ] : []),
          { href: "/classement",    label: "Classement"  },
          { href: "/favoris",       label: "Favoris"     },
          { href: "/in-memoriam",   label: "In Memoriam" },
          ...(user ? [
            { href: "/gestion",     label: "Paramètres"  },
          ] : []),
        ].map(({ href, label }) => (
          <Link key={href} href={href} onClick={close}
            className={`h-mobile-link${isActive(href) ? " active" : ""}`}>
            {label}
          </Link>
        ))}
        <div className="h-mobile-sep" />
        {user ? (
          <button className="h-mobile-login"
            style={{ width: "auto", alignSelf: "center" }}
            onClick={() => { close(); supabase.auth.signOut(); router.push("/"); }}>
            Déconnexion
          </button>
        ) : (
          <button className="h-mobile-login"
            style={{ width: "auto", alignSelf: "center" }}
            onClick={() => { close(); setAuthOpen(true); }}>
            Connexion / Inscription
          </button>
        )}
      </div>

      {/* ── AUTH DRAWER ── */}
      <div className={`h-auth-overlay${authOpen ? " open" : ""}`} onClick={() => setAuthOpen(false)} />
      <aside className={`h-auth-drawer${authOpen ? " open" : ""}`}>
        <button className="h-auth-close" onClick={() => setAuthOpen(false)}>✕</button>
        <div className="h-auth-inner">

          {/* ── Mode reset ── */}
          {authMode === "reset" ? (<>
            <div className="h-auth-heading">Mot de<em> passe.</em></div>
            <p className="h-auth-sub">On t&apos;envoie un lien de réinitialisation</p>

            {resetSent ? (
              <div className="h-auth-success">
                📬 Vérifie ta boîte mail — le lien arrive dans quelques secondes.
              </div>
            ) : (<>
              {authError && <div className="h-auth-error">{authError}</div>}
              <div className="h-auth-field">
                <label className="h-auth-label">Email</label>
                <input className="h-auth-input" type="email" placeholder="ton@email.fr"
                  value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAuth(); }} />
              </div>
              <button className="h-auth-submit" onClick={handleAuth} disabled={resetLoading}>
                {resetLoading ? "Envoi…" : "Envoyer le lien"}
              </button>
            </>)}

            <button className="h-auth-link" onClick={() => resetAuth("signin")}>
              ← Retour à la connexion
            </button>
          </>) : (<>

            {/* ── Modes signin / signup ── */}
            <div className="h-auth-heading">Bon<em>jour.</em></div>
            <p className="h-auth-sub">Connecte-toi pour gérer ta sélection</p>
            <div className="h-auth-tabs">
              {(["signin", "signup"] as const).map(m => (
                <button key={m} className={`h-auth-tab${authMode === m ? " active" : ""}`}
                  onClick={() => resetAuth(m)}>
                  {m === "signin" ? "Connexion" : "Inscription"}
                </button>
              ))}
            </div>
            {authError && <div className="h-auth-error">{authError}</div>}
            {authMode === "signup" && signupConfirm ? (
              <div className="h-auth-success" style={{ marginTop: 8 }}>
                📬 Un email de confirmation t&apos;a été envoyé.<br/>
                Clique sur le lien pour activer ton compte.
              </div>
            ) : authMode === "signup" && (
              <div className="h-auth-field">
                <label className="h-auth-label">Pseudo</label>
                <input className="h-auth-input" type="text" placeholder="3 caractères minimum"
                  value={authName} onChange={e => setAuthName(e.target.value)} />
              </div>
            )}
            {!signupConfirm && <div className="h-auth-field">
              <label className="h-auth-label">Email</label>
              <input className="h-auth-input" type="email" placeholder="ton@email.fr"
                value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
            </div>}
            {!signupConfirm && <div className="h-auth-field">
              <label className="h-auth-label">Mot de passe</label>
              <input className="h-auth-input" type="password" placeholder="6 caractères minimum"
                value={authPwd} onChange={e => setAuthPwd(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && authMode === "signin") handleAuth(); }} />
            </div>}
            {authMode === "signin" && (
              <div style={{ textAlign: "right", marginTop: -8, marginBottom: 8 }}>
                <button className="h-auth-link" onClick={() => resetAuth("reset")}>
                  Mot de passe oublié ?
                </button>
              </div>
            )}
            {authMode === "signup" && (
              <div className="h-auth-field">
                <label className="h-auth-label">Confirmer</label>
                <input className="h-auth-input" type="password" placeholder="••••••••"
                  value={authConfirm} onChange={e => setAuthConfirm(e.target.value)} />
              </div>
            )}
            {!signupConfirm && <button className="h-auth-submit" onClick={handleAuth} disabled={signupLoading}>
              {signupLoading ? "Chargement…" : authMode === "signin" ? "Se connecter" : "Créer mon compte"}
            </button>}
            <p className="h-auth-footer">
              En jouant, tu acceptes que ce jeu est de mauvais goût et que c&apos;est exactement pour ça qu&apos;il existe.
            </p>
          </>)}
        </div>
      </aside>
    </>
  );
}