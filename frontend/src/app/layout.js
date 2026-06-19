import "primeicons/primeicons.css";
import { Inter } from "next/font/google";
import { ProvedorAutenticacao } from "@/context/ContextoAutenticacao";
import { PrimeReactProvider } from "primereact/api";
import "primereact/resources/primereact.min.css";
import "primereact/resources/themes/lara-light-teal/theme.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export const metadata = {
  title: "Hortifruti",
  description: "Sistema de gerenciamento de hortifruti"
};

export default function LayoutRaiz({ children }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
        <PrimeReactProvider>
          <ProvedorAutenticacao>{children}</ProvedorAutenticacao>
        </PrimeReactProvider>
      </body>
    </html>
  );
}
