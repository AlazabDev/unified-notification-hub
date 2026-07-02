import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Dashboard-facing server functions must be executed by a signed-in Supabase
 * user who has the `admin` role in `public.user_roles`. This middleware chains
 * on top of `requireSupabaseAuth` (which validates the bearer token) and then
 * checks the role via the RLS-safe `has_role` security-definer function.
 */
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (error) {
      console.error("require_admin_role_check_failed", error);
      throw new Error("Forbidden");
    }
    if (!data) {
      throw new Error("Forbidden");
    }
    return next({ context: { userId, supabase } });
  });
