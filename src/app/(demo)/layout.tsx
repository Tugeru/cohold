import { type ReactNode } from "react";
import { DemoShell } from "@/components/DemoShell";
import { DemoDataProvider } from "@/context/DemoDataContext";
import { WalletProvider } from "@/context/WalletContext";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <DemoDataProvider>
        <DemoShell>{children}</DemoShell>
      </DemoDataProvider>
    </WalletProvider>
  );
}
