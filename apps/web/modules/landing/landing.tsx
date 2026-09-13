import { Footer } from "@/components/shared/footer";
import { NavBar } from "@/components/shared/nav-bar";
import { BeforeYouPush } from "@/modules/landing/sections/before-you-push/before-you-push";
import { Checks } from "@/modules/landing/sections/checks/checks";
import { Cta } from "@/modules/landing/sections/cta/cta";
import { Hero } from "@/modules/landing/sections/hero/hero";
import { HowItWorks } from "@/modules/landing/sections/how-it-works/how-it-works";
import { Scope } from "@/modules/landing/sections/scope/scope";
import { Workflow } from "@/modules/landing/sections/workflow/workflow";

export function Landing() {
  return (
    <>
      <NavBar />
      <main>
        <Hero />
        <BeforeYouPush />
        <HowItWorks />
        <Checks />
        <Scope />
        <Workflow />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
