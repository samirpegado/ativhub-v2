import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Minha empresa",
};

export default function CompanyPage() {
  return (
    <p className="text-sm text-muted-foreground">
      O cadastro da empresa entra nesta tela em seguida.
    </p>
  );
}
