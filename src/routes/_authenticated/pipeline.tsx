import { createFileRoute } from "@tanstack/react-router";

import { exigirPapel } from "@/integrations/supabase/papel";
import { PipelinePage } from "@/modules/pipeline/ui/pipeline-page";

interface BuscaDoPipeline {
  pipeline?: string;
}

const FORMATO_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_authenticated/pipeline")({
  validateSearch: (busca: Record<string, unknown>): BuscaDoPipeline => ({
    pipeline:
      typeof busca.pipeline === "string" && FORMATO_DE_UUID.test(busca.pipeline)
        ? busca.pipeline.toLowerCase()
        : undefined,
  }),
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: PipelinePage,
});
