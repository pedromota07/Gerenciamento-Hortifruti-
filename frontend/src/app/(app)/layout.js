import { ProtecaoAutenticacao } from "@/components/ProtecaoAutenticacao";
import AppShell from "@/components/AppShell";

export default function LayoutAplicacao({ children }) {
  return (
    <ProtecaoAutenticacao>
      <AppShell>{children}</AppShell>
    </ProtecaoAutenticacao>
  );
}
