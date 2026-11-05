import { createFileRoute, Outlet } from "@tanstack/react-router";

import { LayoutGestor } from "@/components/layout/LayoutGestor";
import { Protegido } from "@/components/layout/Protegido";

export const Route = createFileRoute("/gestor")({
  component: AreaGestor,
});

function AreaGestor() {
  return (
    <Protegido papel="GESTOR">
      <LayoutGestor>
        <Outlet />
      </LayoutGestor>
    </Protegido>
  );
}
