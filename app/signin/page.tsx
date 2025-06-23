import PageLayout from "@/components/PageLayout";
import SignInCard from "@/components/SignInCard";
import {Suspense} from "react";

export default function SignInPage() {
  return (
    <PageLayout>
      {/* We wrap the card in a Suspense boundary for better performance */}
      <Suspense fallback={<div>Loading...</div>}>
        <SignInCard />
      </Suspense>
    </PageLayout>
  );
}
