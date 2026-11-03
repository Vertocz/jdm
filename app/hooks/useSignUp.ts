// hooks/useSignUp.ts
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthError } from "@supabase/supabase-js";
import { pseudoDejaPris, validerPseudo } from "@/utils/pseudo";

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
      const pseudo = displayName.trim();
      const erreurPseudo = validerPseudo(pseudo);
      if (erreurPseudo) return { success: false, error: erreurPseudo };

      // 2. Validation de l'email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Email invalide" };

      // 3. Validation du mot de passe
      if (password.length < 8) return { success: false, error: "Le mot de passe doit contenir au moins 8 caractères" };
      if (password !== confirmPassword) return { success: false, error: "Les mots de passe ne correspondent pas" };

      // 4. Pseudo déjà utilisé ? (l'unicité est aussi garantie en base)
      if (await pseudoDejaPris(pseudo)) return { success: false, error: "Ce pseudo est déjà utilisé" };

      // 5. Créer le compte. Le pseudo est transmis dans les métadonnées : le
      //    trigger Supabase (handle_new_user) l'écrit dans profiles, même si
      //    le compte doit d'abord confirmer son email.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: pseudo } },
      });

      if (authError) {
        if ((authError as AuthError).message.includes("already registered")) {
          return { success: false, error: "Cet email est déjà utilisé" };
        }
        throw authError;
      }

      if (!authData.user) return { success: false, error: "Erreur lors de la création du compte" };

      // Si session est null, Supabase attend une confirmation email
      return { success: true, needsConfirmation: !authData.session };
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
