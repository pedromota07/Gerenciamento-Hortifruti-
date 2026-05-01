import "primeicons/primeicons.css";
import { AuthProvider } from "@/context/AuthContext";
import { PrimeReactProvider } from "primereact/api";
import "primereact/resources/primereact.min.css";
import "primereact/resources/themes/lara-light-teal/theme.css";
import "./globals.css";

export const metadata = {
  title: "Hortifruti",
  description: "Sistema de gerenciamento de hortifruti"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <PrimeReactProvider>
          <AuthProvider>{children}</AuthProvider>
        </PrimeReactProvider>
      </body>
    </html>
  );
}
