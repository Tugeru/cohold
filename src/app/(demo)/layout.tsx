import { type ReactNode } from "react";
import { DemoShell } from "@/components/DemoShell";
import { DemoDataProvider } from "@/context/DemoDataContext";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <DemoDataProvider>
      <DemoShell>{children}</DemoShell>
    </DemoDataProvider>
  );
}
