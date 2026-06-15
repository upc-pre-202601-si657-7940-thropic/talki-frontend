import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { UserProvider } from "@/components/user-context";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <UserProvider user={user}>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-6 py-8">{children}</div>
        </main>
      </div>
    </UserProvider>
  );
}
