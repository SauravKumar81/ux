import React, { useState, Suspense, lazy, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Plus, Minus, ArrowUpRight, Phone } from 'lucide-react';
import { cn } from './lib/utils';

// Spline is excluded from optimizeDeps — loaded fully on demand
const Spline = lazy(() => import('@splinetool/react-spline'));

// ─── Suppress non-fatal ANGLE / D3D11 WebGL shader-compilation spam ───────────
// These "GL_INVALID_OPERATION / D3D11 error compiling dynamic vertex executable"
// messages are emitted by Chrome's ANGLE layer on certain Windows GPU drivers.
// They are driver-level warnings — the scene still renders correctly.
// We intercept them so they don't flood the DevTools console.
const _origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (
    msg.includes('GL_INVALID_OPERATION') ||
    msg.includes('ANGLE') ||
    msg.includes('D3D11') ||
    msg.includes('libANGLE') ||
    msg.includes('dynamic vertex executable')
  ) return; // silently drop GPU-driver noise
  _origConsoleError(...args);
};


// --- Components ---

const Navbar = () => {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <nav className="bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-tighter text-xl">poch</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
          <a href="#work" className="hover:text-white transition-colors">Work</a>
          <a href="#services" className="hover:text-white transition-colors">Services</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>
        <button className="bg-white text-black text-xs font-bold px-4 py-2 rounded-full hover:bg-zinc-200 transition-colors uppercase tracking-wider">
          Get Started
        </button>
      </nav>
    </div>
  );
};

// --- Spline Scene — loads once, snapshots, then becomes a static image ---
//
// Strategy:
//   1. Mount Spline (deferred, after idle)
//   2. After N frames, capture canvas → toDataURL (PNG snapshot)
//   3. Unmount Spline, replace with <img> — zero WebGL from this point on
//   4. React.memo(() => true) ensures this component itself never re-renders
//
const SplineScene = React.memo(({ sceneUrl }: { sceneUrl: string }) => {
  const isMobile = window.innerWidth < 768;
  const [shouldMount, setShouldMount]   = useState(false);
  const [snapshot, setSnapshot]         = useState<string | null>(null); // data URL
  const containerRef = useRef<HTMLDivElement>(null);

  // Step 1 — deferred mount after page is interactive
  useEffect(() => {
    if (isMobile) return;
    let rafId: number;
    const mount = () => setShouldMount(true);
    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(mount, { timeout: 3000 });
      } else {
        rafId = requestAnimationFrame(mount);
      }
    }, 1500);
    return () => { clearTimeout(timer); cancelAnimationFrame(rafId); };
  }, []);

  // Step 2 — called by Spline's onLoad callback
  const handleSplineLoad = useCallback(() => {
    // Give Spline ~10 frames (~170ms at 60fps) to finish drawing before we snapshot
    let frameCount = 0;
    const capture = () => {
      frameCount++;
      if (frameCount < 10) {
        requestAnimationFrame(capture);
        return;
      }
      // Grab the canvas Spline rendered into
      const canvas = containerRef.current?.querySelector('canvas');
      if (!canvas) return;
      try {
        // Snapshot as PNG data URL — this is now a plain static image
        const dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
        // Replace live WebGL with the frozen image, unmount Spline
        setSnapshot(dataUrl);
        setShouldMount(false); // <-- unmounts <Spline>, destroys WebGL context
      } catch {
        // toDataURL can throw if canvas is tainted; fall through to live mode
      }
    };
    requestAnimationFrame(capture);
  }, []);

  // Mobile fallback — pure CSS shapes, no WebGL at all
  if (isMobile) {
    return (
      <div className="absolute inset-0 flex items-center justify-center gap-4">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-2xl" />
        <div className="w-32 h-32 rounded-[24px] bg-gradient-to-br from-zinc-600 to-zinc-800 shadow-2xl -rotate-6" />
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-2xl rotate-45" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">

      {/* Loading placeholder — shown until snapshot is ready */}
      {!snapshot && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(60,60,70,0.5),transparent)]" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-zinc-800/30 blur-3xl animate-pulse" />
        </div>
      )}

      {/* Live Spline — only exists until snapshot is captured, then unmounts */}
      {shouldMount && !snapshot && (
        <Suspense fallback={null}>
          <div ref={containerRef} className="w-full h-full">
            <Spline scene={sceneUrl} className="w-full h-full" onLoad={handleSplineLoad} />
          </div>
        </Suspense>
      )}

      {/* Static snapshot — replaces WebGL permanently, zero GPU cost */}
      {snapshot && (
        <img
          src={snapshot}
          alt="3D scene"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      )}

    </div>
  );
}, () => true); // renders once — React.memo with constant comparator



const ProjectCard = ({ title, category, description, images, tags }: any) => {
  return (
    <section className="py-20 border-t border-white/10" id="work">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-12">
          <div className="lg:col-span-4">
            <div className="flex gap-2 mb-4">
              {tags.map((tag: string) => (
                <span key={tag} className="text-[10px] uppercase tracking-widest border border-white/20 px-2 py-0.5 rounded-full text-zinc-500">
                  {tag}
                </span>
              ))}
            </div>
            <h3 className="text-2xl font-bold mb-4">
              <span className="text-white">{title}:</span>{' '}
              <span className="text-zinc-400 font-normal">{category}</span>
            </h3>
          </div>
          <div className="lg:col-span-4 text-sm text-zinc-500 leading-relaxed">
            {description.col1}
          </div>
          <div className="lg:col-span-4 text-sm text-zinc-500 leading-relaxed">
            {description.col2}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {images.map((src: string, i: number) => (
            <div
              key={i}
              className={cn(
                "aspect-square bg-zinc-900 rounded-2xl overflow-hidden relative group",
                "transition-transform duration-200 ease-out hover:scale-[0.98]",
                i === 0 && "md:col-span-2 md:row-span-2 aspect-auto"
              )}
            >
              <img
                src={src}
                alt={`${title} ${i}`}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-[filter] duration-500"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ServiceCard = ({ title, description, icon, list, color }: any) => {
  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-[40px] p-10 flex flex-col items-center text-center group hover:border-white/20 transition-all duration-500">
      <div className={cn("w-32 h-32 mb-8 flex items-center justify-center rounded-full overflow-hidden", color)}>
        {icon}
      </div>
      <h4 className="text-3xl font-bold mb-4">{title}</h4>
      <p className="text-zinc-500 text-sm mb-8 max-w-[250px]">{description}</p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[10px] uppercase tracking-widest text-zinc-600 w-full text-left">
        {list.map((item: string) => (
          <div key={item} className="flex items-center gap-2">
            <div className="w-1 h-1 bg-zinc-700 rounded-full" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

const PricingCard = ({ title, subtitle, features, price, isMain }: any) => {
  return (
    <div className={cn(
      "rounded-3xl p-8 flex flex-col h-full transition-all duration-500",
      isMain ? "bg-white text-black scale-105 z-10 shadow-2xl" : "bg-zinc-900 text-white border border-white/5"
    )}>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xl font-bold">{title}</h4>
          {isMain && <span className="bg-zinc-100 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-tighter">Popular</span>}
        </div>
        <p className={cn("text-xs", isMain ? "text-zinc-500" : "text-zinc-400")}>{subtitle}</p>
      </div>

      <ul className="space-y-4 mb-12 flex-grow">
        {features.map((f: any, i: number) => (
          <li key={i} className="flex items-start gap-3">
            <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5", isMain ? "bg-black" : "bg-white")} />
            <span className="text-sm font-medium">{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <div className="text-3xl font-bold mb-6">
          {typeof price === 'number' ? `$${price}` : price}
        </div>
        <button className={cn(
          "w-full py-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
          isMain ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
        )}>
          Get This Package
        </button>
      </div>
    </div>
  );
};

const FAQItem = ({ question, answer }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-lg font-medium group-hover:text-zinc-400 transition-colors">{question}</span>
        {isOpen ? <Minus className="w-5 h-5 text-zinc-500" /> : <Plus className="w-5 h-5 text-zinc-500" />}
      </button>
      {/* CSS max-height transition — no layout thrash, no Framer Motion overhead */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? '200px' : '0px', opacity: isOpen ? 1 : 0 }}
      >
        <p className="pb-6 text-zinc-500 text-sm leading-relaxed max-w-2xl">
          {answer}
        </p>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const heroRef = useRef<HTMLDivElement>(null);
  return (
    <div className="min-h-screen bg-black selection:bg-white selection:text-black">
      <Navbar />

      {/* Hero Section with Spline contained inside (not fixed) */}
      <section
        ref={heroRef}
        className="relative min-h-[150svh] flex flex-col justify-end overflow-hidden"
      >
        {/* Spline Scene — renders once, frozen to its own GPU layer */}
        <div className="absolute inset-0 w-full h-full bg-black pointer-events-none gpu-layer">
          <SplineScene sceneUrl="https://prod.spline.design/8CLWkeoM6y2sXPgC/scene.splinecode" />
        </div>

        {/* Strong gradient fade — completely blacks out the bottom 50% */}
        <div className="absolute bottom-0 left-0 right-0 h-[55%] bg-gradient-to-t from-black from-40% via-black/95 via-60% to-transparent z-10 pointer-events-none" />

        {/* Text — sits well below the 3D model in clean dark space */}
        <div className="container mx-auto px-6 md:px-12 lg:px-20 relative z-20 pb-20 md:pb-28">
          <motion.h1
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl md:text-4xl lg:text-[3.2rem] font-bold tracking-tight text-white leading-[1.2] max-w-3xl"
          >
            We are Poch, a design studio<br />
            of few friends with endless (<span className="inline-block align-middle">🪐</span>)<br />
            skills and ideas.
          </motion.h1>
        </div>
      </section>

      {/* Projects */}
      <div className="py-10 text-center bg-black relative z-10">
        <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-bold">Projects</span>
      </div>

      <div className="relative z-10 bg-black">
        <ProjectCard
          title="Avant-Garde Territory"
          category="visual language for telling the story of Ural's Avant-garde architecture in a modern way"
          tags={['Brand Identity', 'Web Design', 'Packaging']}
          description={{
            col1: "Avant-Garde Territory is a cultural project dedicated to preserving and promoting the Ural region's constructivist architecture. The project aims to reimagine the perception of the Avant-garde movement, giving it a modern look and turning this cultural legacy into a key tourist attraction.",
            col2: "We created a flexible identity that merges Avant-garde principles with a modern approach, combining bold colors, geometric forms, and neo-grotesque typography. At its center stands the region's iconic constructivist building, reimagined as a graphic symbol of cultural continuity."
          }}
          images={[
            "/05aba8a8ca4c3707768efd7bb240b021.jpg",
            "/33ec5d7d85dcfbb10f3a68322458b80a.jpg",
            "/50dfc22035ab9e4862e2fc93e5d9d9eb.jpg",
            "/71e8041b0acb1f1853ed75a201245b61.jpg",
            "/8b9cec20e9136e5a55ce6a1420f6ad3c.jpg",
            "/8ffcf5f3c7602fa9252cef5fb8465ad8.jpg",
          ]}
        />

        <ProjectCard
          title="Open Office"
          category="a friendly identity for the platform where businesses meet, share, and grow together"
          tags={['Brand Identity', 'Web Design', 'Illustration']}
          description={{
            col1: "Open Office is a leading project for business tours, guest visits, and partner meetings. The company values experience exchange as a driver of growth, with keeping a clear focus on key business metrics. At its core are trust, confidentiality, and genuine long-term relationships.",
            col2: "The identity was crafted to invite openness and authentic dialogue. The office becomes more than a space — it's a place for dialogue, sharing, and passion for work. Serif and sans typography mix with smooth shapes, while lively office-life illustrations and a bold palette add energy."
          }}
          images={[
            "/a5b483c991d37745b025f25d0f3bed19.jpg",
            "/8ffcf5f3c7602fa9252cef5fb8465ad8.jpg",
            "/05aba8a8ca4c3707768efd7bb240b021.jpg",
            "/50dfc22035ab9e4862e2fc93e5d9d9eb.jpg",
            "/33ec5d7d85dcfbb10f3a68322458b80a.jpg",
            "/71e8041b0acb1f1853ed75a201245b61.jpg",
          ]}
        />

        {/* Services Section */}
        <section className="py-32 bg-zinc-950" id="services">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-bold mb-4 block">Services</span>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto text-balance">
                We do <span className="text-zinc-500">everything you need</span> to make your brand bloom.
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <ServiceCard
                title="Branding"
                description="Logos are just the tip of the iceberg."
                color="bg-emerald-500/20"
                icon={<div className="w-20 h-20 bg-emerald-400 rounded-full blur-xl opacity-50" />}
                list={['Brand Identity', 'Logo Design', 'Brand Book', '2D/3D Illustration', 'Packaging', 'Naming & Copy']}
              />
              <ServiceCard
                title="Digital"
                description="Clear structure, strong visuals, no fluff."
                color="bg-pink-500/20"
                icon={<div className="w-20 h-20 bg-pink-400 rounded-lg blur-xl opacity-50 rotate-12" />}
                list={['Web Design', 'Landing Pages', 'No-Code Dev', '3D & VFX', 'Motion', 'Social Media Content']}
              />
            </div>

            <div className="mt-20 bg-pink-100 rounded-[40px] p-12 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-8">
                <div className="hidden lg:block">
                  <Phone className="w-16 h-16 text-black rotate-12" />
                </div>
                <div>
                  <div className="flex gap-4 mb-2">
                    <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest">Too many options?</span>
                    <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest">No idea what to pick?</span>
                  </div>
                  <h3 className="text-6xl md:text-8xl font-black text-black tracking-tighter">Call us!</h3>
                </div>
              </div>
              <button className="bg-black text-white px-10 py-5 rounded-full font-bold text-sm uppercase tracking-widest hover:scale-105 transition-transform">
                Book an Intro Call
              </button>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-32 bg-black" id="pricing">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-bold mb-4 block">Pricing</span>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <PricingCard
                title="Sprint"
                subtitle="When your ass is on fire!"
                features={['Base Identity', 'Logo, Typography, Color Palette, Graphic Elements', 'Zero Revisions']}
                price={999}
              />
              <PricingCard
                title="Start-Up"
                subtitle="Start smart — go far."
                features={['Base Identity', 'Landing Page', 'No-Code Development']}
                price={2000}
              />
              <PricingCard
                title="The Identity"
                subtitle="All you (actually) need."
                isMain
                features={['Full Brand Identity', 'Extra Mockups, Advanced Guidelines', 'Landing Page', 'No-Code Development', 'Social Media Content', '3D Visuals', 'Motion Design']}
                price={3000}
              />
              <PricingCard
                title="Bombastic"
                subtitle="Get it all."
                features={['Full Brand Identity', 'Full Brandbook', 'Multipage Website', 'Custom Development', 'Social Media Content', 'Motion Design', '3D Visuals']}
                price="6000+"
              />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-32 bg-zinc-950">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-20">
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-bold mb-4 block">FAQ</span>
            </div>
            <div className="space-y-2">
              <FAQItem
                question="How do we get started?"
                answer="Pick a package — and we'll send you a quick form to fill out. It helps us build a clear brief. Then we hop on a call to talk through the details and get started."
              />
              <FAQItem
                question="I'm not sure what I need. Can we chat first?"
                answer="Absolutely! Book a free intro call and we'll help you figure out the best approach for your project."
              />
              <FAQItem
                question="What are your payment terms?"
                answer="We typically work with a 50% upfront deposit and 50% upon completion. For larger projects, we can discuss milestone-based payments."
              />
              <FAQItem
                question="What about revisions?"
                answer="Each package includes a set number of revision rounds. We work closely with you to ensure the final result exceeds your expectations."
              />
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section className="py-32 bg-black">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <div className="mb-12">
              <div className="w-24 h-24 bg-zinc-800 rounded-full mx-auto mb-8 flex items-center justify-center">
                <span className="text-4xl">🧙‍♂️</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
                So, let's make some <span className="italic">gooooood</span> stuff together.
              </h2>
              <p className="text-zinc-500 text-xl">Because why not?</p>
            </div>

            <form className="space-y-6 text-left">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Name</label>
                  <input type="text" placeholder="Ivan Petrov" className="w-full bg-transparent border-b border-white/20 py-4 focus:border-white outline-none transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Email</label>
                  <input type="email" placeholder="your@email.com" className="w-full bg-transparent border-b border-white/20 py-4 focus:border-white outline-none transition-colors" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Package</label>
                <select className="w-full bg-transparent border-b border-white/20 py-4 focus:border-white outline-none transition-colors appearance-none">
                  <option className="bg-black">Select...</option>
                  <option className="bg-black">Sprint</option>
                  <option className="bg-black">Start-Up</option>
                  <option className="bg-black">The Identity</option>
                  <option className="bg-black">Bombastic</option>
                </select>
              </div>
              <button type="button" className="w-full bg-pink-200 text-black py-6 rounded-full font-bold uppercase tracking-widest hover:bg-pink-300 transition-colors mt-8">
                Submit ✨
              </button>
            </form>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-32 pb-20 border-t border-white/5 bg-black">
          <div className="container mx-auto px-6">
            <div className="flex flex-col items-center text-center mb-32">
              <div className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-6 mb-12">
                <img src="https://picsum.photos/seed/avatar/100/100" className="w-16 h-16 rounded-full object-cover" referrerPolicy="no-referrer" />
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Online</span>
                  </div>
                  <p className="text-sm font-medium">Still not sure? Book a free intro call — let's get to know each other.</p>
                </div>
                <button className="bg-white text-black px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                  Book an Intro Call
                </button>
              </div>

              <h2 className="text-[15vw] font-black tracking-tighter leading-none mb-20 select-none opacity-20">
                poch
              </h2>

              <div className="flex flex-wrap justify-center gap-12 text-sm font-bold uppercase tracking-widest">
                <a href="#" className="flex items-center gap-2 hover:text-zinc-400 transition-colors">Behance <ArrowUpRight className="w-4 h-4" /></a>
                <a href="#" className="flex items-center gap-2 hover:text-zinc-400 transition-colors">Instagram <ArrowUpRight className="w-4 h-4" /></a>
                <a href="#" className="flex items-center gap-2 hover:text-zinc-400 transition-colors">E-mail <ArrowUpRight className="w-4 h-4" /></a>
              </div>
            </div>
            <div className="text-center text-[10px] text-zinc-600 uppercase tracking-widest">
              Poch Studio © 2024
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
