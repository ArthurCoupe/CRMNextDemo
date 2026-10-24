import { createFileRoute } from "@tanstack/react-router";

import { exigirPapel } from "@/integrations/supabase/papel";
import { MeetingsPage } from "@/modules/meetings/ui/meetings-page";

export const Route = createFileRoute("/_authenticated/meetings")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: MeetingsPage,
});
