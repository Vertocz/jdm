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
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
}

export function useSignup(): UseSignupResult {
  const [loading, setLoading] = useState(false);

  const signup = async ({
    email,
    password,
    confirmPassword,
    displayName,
  }: SignupData): Promise<{ success: boolean; error?: string }> => {
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

      // 6. Mettre à jour le profil avec le pseudo choisi
      // On attend que le trigger Supabase ait créé le profil
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("user_id", authData.user.id);

      if (profileError) {
        console.error("Erreur mise à jour profil:", profileError);
        // Ne bloque pas l'inscription si la mise à jour échoue
      }

      return { success: true };
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
