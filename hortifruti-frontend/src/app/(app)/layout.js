import { AuthGuard } from "@/components/AuthGuard";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }) {
  return (
    <AuthGuard>
      <div className="app-shell">
        <Sidebar />

        <div className="app-main">
          <header className="app-header">
            <strong>Hortifruti</strong>
          </header>

          <main className="app-content">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
