import { ProtecaoAutenticacao } from "@/components/ProtecaoAutenticacao";
import BarraLateral from "@/components/BarraLateral";

export default function LayoutAplicacao({ children }) {
  return (
    <ProtecaoAutenticacao>
      <div className="app-shell">
        <BarraLateral />

        <div className="app-main">
          <header className="app-header">
            <strong>Hortifruti</strong>
          </header>

          <main className="app-content">{children}</main>
        </div>
      </div>
    </ProtecaoAutenticacao>
  );
}
