import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client.browser";

export function useRealtime(tables: readonly string[]) {
  const qc = useQueryClient();
  const chave = tables.join("|");

  const estaveis = useMemo(() => (chave === "" ? [] : chave.split("|")), [chave]);

  useEffect(() => {
    if (estaveis.length === 0) return;
    const channels = estaveis.map((table) =>
      supabase
        .channel(`rt-${table}`)
        .on("postgres_changes" as never, { event: "*", schema: "public", table }, () => {
          void qc.invalidateQueries({ queryKey: [table] });
        })
        .subscribe(),
    );
    return () => {
      channels.forEach((c) => void supabase.removeChannel(c));
    };
  }, [estaveis, qc]);
}
