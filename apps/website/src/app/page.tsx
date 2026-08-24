import { ArchitectureVisualizer } from '@/components/landing/ArchitectureVisualizer';
import { BenchmarkSection } from '@/components/landing/BenchmarkSection';
import { CodeRecipesSection } from '@/components/landing/CodeRecipesSection';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { HeroSection } from '@/components/landing/HeroSection';
import { OmnichannelPlayground } from '@/components/landing/OmnichannelPlayground';
import { ProviderMatrixSection } from '@/components/landing/ProviderMatrixSection';
import { WhatsAppRoiCalculator } from '@/components/landing/WhatsAppRoiCalculator';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-sky-500/20 selection:text-sky-300">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Content Sections */}
      <main className="flex-1">
        <HeroSection />
        <div id="architecture">
          <ArchitectureVisualizer />
        </div>
        <div id="playground">
          <OmnichannelPlayground />
        </div>
        <div id="recipes">
          <CodeRecipesSection />
        </div>
        <WhatsAppRoiCalculator />
        <div id="providers">
          <ProviderMatrixSection />
        </div>
        <div id="benchmarks">
          <BenchmarkSection />
        </div>
        <FeatureGrid />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
