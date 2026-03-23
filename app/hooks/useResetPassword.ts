// hooks/useResetPassword.ts
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface UseResetPasswordResult {
  requestReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
}

export function useResetPassword(): UseResetPasswordResult {
  const [loading, setLoading] = useState(false);

  const requestReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: "Email invalide" };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/reset-password`,
      });

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error("Erreur reset password:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Une erreur est survenue",
      };
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      if (newPassword.length < 6) {
        return { success: false, error: "Le mot de passe doit contenir au moins 6 caractères" };
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error("Erreur update password:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Une erreur est survenue",
      };
    } finally {
      setLoading(false);
    }
  };

  return { requestReset, updatePassword, loading };
}
