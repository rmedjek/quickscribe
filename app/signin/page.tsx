// app/signin/page.tsx
import SignInCard from "@/components/SignInCard";

export default function SignInPage() {
  // This page should be simple, no extra layouts.
  // The RootLayout will handle providers.
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <SignInCard />
    </div>
  );
}
