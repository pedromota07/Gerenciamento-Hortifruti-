import "primeicons/primeicons.css";
import { ProvedorAutenticacao } from "@/context/ContextoAutenticacao";
import { PrimeReactProvider } from "primereact/api";
import "primereact/resources/primereact.min.css";
import "primereact/resources/themes/lara-light-teal/theme.css";
import "./globals.css";

export const metadata = {
  title: "Hortifruti",
  description: "Sistema de gerenciamento de hortifruti"
};

export default function LayoutRaiz({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <PrimeReactProvider>
          <ProvedorAutenticacao>{children}</ProvedorAutenticacao>
        </PrimeReactProvider>
      </body>
    </html>
  );
}
