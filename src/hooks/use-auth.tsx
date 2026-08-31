import { useSession, signOut as nextAuthSignOut } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Provided by the global SessionProvider now, we just pass through
  return <>{children}</>;
}

export function useAuth() {
  const { data: session, status } = useSession();
  
  return {
    session,
    user: session?.user ?? null,
    loading: status === "loading",
    signOut: async () => {
      await nextAuthSignOut();
    },
  };
}
