"use client";

import { DemoGate } from "@/components/DemoGate";
import { GlobalActivityView } from "@/components/GlobalActivityView";

export default function ActivityPage() {
  return (
    <DemoGate>
      <GlobalActivityView />
    </DemoGate>
  );
}
