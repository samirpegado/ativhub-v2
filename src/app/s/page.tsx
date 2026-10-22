import type { Metadata } from "next";
import { BarcodeLookup } from "@/components/requests/barcode-lookup";

export const metadata: Metadata = {
  title: "Solicitar manutenção",
};

export default function PublicEntryPage() {
  return (
    <main className="flex min-h-full items-center px-4 py-10">
      <BarcodeLookup />
    </main>
  );
}
