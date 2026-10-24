import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/shared/types/database.types";

import { supabase } from "./client.browser";

export const supabaseV2 = supabase;

export type ClienteSupabaseV2 = SupabaseClient<Database>;
