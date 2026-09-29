import type { Metadata } from "next";
import { PlatformAdminWorkspace } from "../../components/platform-admin-workspace";

export const metadata: Metadata = { title: "Platform Admin | Gym Growth OS" };

export default function PlatformPage() {
  return <PlatformAdminWorkspace />;
}
