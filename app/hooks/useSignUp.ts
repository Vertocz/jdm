// hooks/useSignup.ts
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface SignupData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
}

interface UseSignupResult {
  signup: (data: SignupData) => Promise<{
    success: boolean;
    error?: string;
  }>;
  loading: boolean;
}

export function useSignup(): UseSignupResult {
  const [loading, setLoading] = useState(false);

  const signup = async ({ email, password, confirmPassword, displayName }: SignupData) => {
    setLoading(true);

    try {
      // 1. Validation du pseudo
      if (!displayName.trim()) {
        setLoading(false);
        return { success: false, error: "Le pseudo est obligatoire" };
      }

      if (displayName.trim().length < 3) {
        setLoading(false);
        return { success: false, error: "Le pseudo doit contenir au moins 3 caractères" };
      }

      // 2. Validation de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setLoading(false);
        return { success: false, error: "Email invalide" };
      }

      // 3. Validation du mot de passe
      if (password.length < 6) {
        setLoading(false);
        return { success: false, error: "Le mot de passe doit contenir au moins 6 caractères" };
      }

      if (password !== confirmPassword) {
        setLoading(false);
        return { success: false, error: "Les mots de passe ne correspondent pas" };
      }

      // 4. Vérifier si le pseudo est déjà utilisé
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .ilike('display_name', displayName.trim())
        .maybeSingle();

      if (existingProfile) {
        setLoading(false);
        return { success: false, error: "Ce pseudo est déjà utilisé" };
      }

      // 5. Créer le compte utilisateur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        // Gérer les erreurs spécifiques de Supabase
        if (authError.message.includes('already registered')) {
          setLoading(false);
          return { success: false, error: "Cet email est déjà utilisé" };
        }
        throw authError;
      }

      if (!authData.user) {
        setLoading(false);
        return { success: false, error: "Erreur lors de la création du compte" };
      }

      // 6. Mettre à jour le profil avec le pseudo choisi
      // Le profil a déjà été créé automatiquement par le trigger
      // On attend un peu pour être sûr que le trigger s'est exécuté
      await new Promise(resolve => setTimeout(resolve, 500));

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
        })
        .eq('user_id', authData.user.id);

      if (profileError) {
        console.error('Erreur mise à jour profil:', profileError);
        // On ne bloque pas l'inscription si la mise à jour échoue
        // L'utilisateur pourra changer son pseudo dans les paramètres
      }

      setLoading(false);
      return { success: true };

    } catch (error: any) {
      console.error("Erreur lors de l'inscription:", error);
      setLoading(false);
      return { 
        success: false, 
        error: error?.message || "Une erreur est survenue lors de l'inscription" 
      };
    }
  };

  return { signup, loading };
}