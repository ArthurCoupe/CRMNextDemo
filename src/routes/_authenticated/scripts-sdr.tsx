import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/scripts-sdr")({
  beforeLoad: () => {
    throw redirect({ to: "/scripts", search: { tipo: "sdr" } });
  },
});
