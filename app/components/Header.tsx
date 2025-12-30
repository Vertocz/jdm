// app/components/Header.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSignup } from "../hooks/useSignUp";

export default function Header() {
  const router = useRouter();
  const { signup, loading: signupLoading } = useSignup();
  
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        await fetchProfile(data.user.id);
      }
    };

    load();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const current = session?.user ?? null;
        setUser(current);
        if (current) await fetchProfile(current.id);
        else setProfile(null);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!prof) {
      const newProfile = {
        user_id: userId,
        display_name: "Nouveau joueur",
      };
      await supabase.from("profiles").insert(newProfile);
      setProfile(newProfile);
    } else {
      setProfile(prof);
    }
  };

  const handleAuth = async () => {
    setAuthError("");

    if (authMode === "signin") {
      // Connexion
      const { error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });

      if (error) {
        setAuthError("Email ou mot de passe incorrect");
        return;
      }

      setShowAuthModal(false);
      setEmail("");
      setPassword("");
      router.push('/salle-attente');

    } else {
      // Inscription
      const result = await signup({
        email,
        password,
        confirmPassword,
        displayName,
      });

      if (!result.success) {
        setAuthError(result.error || "Erreur lors de l'inscription");
        return;
      }

      // Succès
      setShowAuthModal(false);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setDisplayName("");
      router.push('/salle-attente');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    
    // Redirection vers l'accueil après déconnexion
    router.push('/');
  };

  return (
    <>
      <header className="header-modern">
        <div className="header-container">
          {/* Logo / Titre */}
          <Link href="/" className="header-logo">
            <span className="logo-text">JDM</span>
          </Link>

          {/* Navigation desktop */}
          <nav className="nav-desktop">
            {user && (
              <Link href="/salle-attente" className="nav-link">
                Ma salle
              </Link>
            )}
            <Link href="/classement" className="nav-link">
              Classement
            </Link>
            <Link href="/in-memoriam" className="nav-link">
              In Memoriam
            </Link>
            <Link href="/favoris" className="nav-link">
              Favoris
            </Link>
          </nav>

          {/* Actions utilisateur */}
          <div className="header-actions">
            {user ? (
              <>
                <Link href="/gestion" className="nav-link" style={{ whiteSpace: 'nowrap' }}>
                  Gérer mon compte
                </Link>
                <button className="btn-secondary" onClick={signOut}>
                  Déconnexion
                </button>
              </>
            ) : (
              <button 
                className="btn-primary" 
                onClick={() => setShowAuthModal(true)}
              >
                Connexion/Inscription
              </button>
            )}
          </div>

          {/* Bouton hamburger mobile */}
          <button 
            className="hamburger-btn"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label="Menu"
          >
            <span className={`hamburger-line ${showMobileMenu ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${showMobileMenu ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${showMobileMenu ? 'open' : ''}`}></span>
          </button>
        </div>

        {/* Menu mobile */}
        {showMobileMenu && (
          <div className="mobile-menu">
            {user && (
              <Link 
                href="/salle-attente" 
                className="mobile-link"
                onClick={() => setShowMobileMenu(false)}
              >
                Ma salle
              </Link>
            )}
            <Link 
              href="/classement" 
              className="mobile-link"
              onClick={() => setShowMobileMenu(false)}
            >
              Classement
            </Link>
            <Link 
              href="/in-memoriam" 
              className="mobile-link"
              onClick={() => setShowMobileMenu(false)}
            >
              In Memoriam
            </Link>
            <Link 
              href="/favoris" 
              className="mobile-link"
              onClick={() => setShowMobileMenu(false)}
            >
              Favoris
            </Link>
            
            {user && (
              <Link 
                href="/gestion" 
                className="mobile-link"
                onClick={() => setShowMobileMenu(false)}
              >
                Gérer mon compte
              </Link>
            )}
            
            <button
              className="mobile-link"
              onClick={() => {
                if (user) {
                  signOut();
                } else {
                  setShowAuthModal(true);
                }
                setShowMobileMenu(false);
              }}
            >
              {user ? "Déconnexion" : "Connexion/Inscription"}
            </button>

          </div>
        )}
      </header>

      {/* Modal d'authentification */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowAuthModal(false)}
            >
              ✕
            </button>

            <h2 className="modal-title">
              {authMode === "signin" ? "Connexion" : "Inscription"}
            </h2>

            {authError && (
              <div 
                style={{
                  background: "rgba(248, 113, 113, 0.2)",
                  border: "2px solid #f87171",
                  borderRadius: "10px",
                  padding: "12px",
                  marginBottom: "20px",
                  color: "#fca5a5",
                  fontSize: "0.95rem",
                }}
              >
                {authError}
              </div>
            )}

            <div className="auth-form-modal">
              {authMode === "signup" && (
                <input
                  type="text"
                  placeholder="Pseudo (3 caractères minimum)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="auth-input"
                />
              )}
              
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
              />
              
              <input
                type="password"
                placeholder="Mot de passe (6 caractères minimum)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && authMode === 'signin' && handleAuth()}
                className="auth-input"
              />

              {authMode === "signup" && (
                <input
                  type="password"
                  placeholder="Confirmer le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="auth-input"
                />
              )}

              <button 
                className="btn-primary-full" 
                onClick={handleAuth}
                disabled={signupLoading}
              >
                {signupLoading 
                  ? "Inscription..." 
                  : authMode === "signin" 
                    ? "Se connecter" 
                    : "S'inscrire"}
              </button>

              <button 
                className="btn-link"
                onClick={() => {
                  setAuthMode(authMode === "signin" ? "signup" : "signin");
                  setAuthError("");
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                  setDisplayName("");
                }}
              >
                {authMode === "signin" 
                  ? "Pas encore de compte ? S'inscrire" 
                  : "Déjà un compte ? Se connecter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}