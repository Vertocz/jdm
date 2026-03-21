// hooks/useSignUp.ts
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthError } from "@supabase/supabase-js";

interface SignupData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
}

interface UseSignupResult {
  signup: (data: SignupData) => Promise<{ success: boolean; needsConfirmation?: boolean; error?: string }>;
  loading: boolean;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tente de mettre à jour le display_name sur le profil créé par le trigger Supabase.
 * Réessaie jusqu'à `maxAttempts` fois avec `delayMs` entre chaque tentative,
 * au cas où le trigger serait un peu lent.
 * En dernier recours, fait un upsert pour ne jamais perdre le pseudo.
 */
async function setDisplayNameWithRetry(
  userId: string,
  displayName: string,
  maxAttempts = 5,
  delayMs = 300
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Vérifie si le trigger a déjà créé la ligne
    const { data: existing } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      // La ligne existe → update normal
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("user_id", userId);

      if (!error) return;
      console.warn(`Tentative ${attempt} échouée (update):`, error.message);
    } else if (attempt < maxAttempts) {
      // Pas encore créé → on attend avant de réessayer
      console.warn(`Tentative ${attempt} : profil pas encore créé, on attend ${delayMs}ms…`);
    }

    if (attempt < maxAttempts) await wait(delayMs);
  }

  // Dernier recours : upsert (crée la ligne si le trigger n'a jamais tourné)
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, display_name: displayName }, { onConflict: "user_id" });

  if (error) {
    console.error("Erreur upsert profil (dernier recours):", error.message);
  }
}

export function useSignup(): UseSignupResult {
  const [loading, setLoading] = useState(false);

  const signup = async ({
    email,
    password,
    confirmPassword,
    displayName,
  }: SignupData): Promise<{ success: boolean; needsConfirmation?: boolean; error?: string }> => {
    setLoading(true);

    try {
      // 1. Validation du pseudo
      if (!displayName.trim()) return { success: false, error: "Le pseudo est obligatoire" };
      if (displayName.trim().length < 3) return { success: false, error: "Le pseudo doit contenir au moins 3 caractères" };

      // 2. Validation de l'email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Email invalide" };

      // 3. Validation du mot de passe
      if (password.length < 6) return { success: false, error: "Le mot de passe doit contenir au moins 6 caractères" };
      if (password !== confirmPassword) return { success: false, error: "Les mots de passe ne correspondent pas" };

      // 4. Vérifier si le pseudo est déjà utilisé
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .ilike("display_name", displayName.trim())
        .maybeSingle();

      if (existingProfile) return { success: false, error: "Ce pseudo est déjà utilisé" };

      // 5. Créer le compte utilisateur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) {
        if ((authError as AuthError).message.includes("already registered")) {
          return { success: false, error: "Cet email est déjà utilisé" };
        }
        throw authError;
      }

      if (!authData.user) return { success: false, error: "Erreur lors de la création du compte" };

      // 6. Écrire le pseudo avec retry — plus de setTimeout aveugle
      await setDisplayNameWithRetry(authData.user.id, displayName.trim());

      // Si session est null, Supabase attend une confirmation email
      const needsConfirmation = !authData.session;
      return { success: true, needsConfirmation };
    } catch (err: unknown) {
      console.error("Erreur lors de l'inscription:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Une erreur est survenue lors de l'inscription",
      };
    } finally {
      setLoading(false);
    }
  };

  return { signup, loading };
}