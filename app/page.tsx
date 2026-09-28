import Hero from "@/components/Hero";
import CharactersParallax from "@/components/CharactersParallax";
import RulesCards from "@/components/RulesCards";
import RsvpForm from "@/components/RsvpForm";
import LiveConfirmedList from "@/components/LiveConfirmedList";
import NostalgiaBubbles from "@/components/NostalgiaBubbles";

export default function Home() {
  return (
    <main>
      <Hero />
      <CharactersParallax />
      <RulesCards />
      <RsvpForm />
      <LiveConfirmedList />
      <NostalgiaBubbles />
    </main>
  );
}
