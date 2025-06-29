import PageLayout from "@/components/PageLayout";
import SignInCard from "@/components/SignInCard";
import {Suspense} from "react";

export default function SignInPage() {
  return (
    <PageLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <SignInCard />
      </Suspense>
    </PageLayout>
  );
}
