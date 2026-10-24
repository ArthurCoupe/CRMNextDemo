import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/shared/types/database.types";

export type ClienteDeServidorV2 = SupabaseClient<Database>;

export function comSchemaNovo(cliente: unknown): ClienteDeServidorV2 {
  return cliente as ClienteDeServidorV2;
}
