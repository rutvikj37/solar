import { motion, Variants } from "framer-motion";
import { ArrowRight, Search, BarChart3, Users } from "lucide-react";
import { scrollToLeadForm } from "../../lib/scrollToLeadForm.js";

export function AboutPage() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <div className="bg-navy-dark pt-32 pb-20 overflow-hidden">
      <div className="mx-auto max-w-[1500px] px-6 lg:px-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-32"
        >
          {/* Hero Section */}
          <section className="max-w-4xl">
            <motion.span 
              variants={itemVariants}
              className="inline-block text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-400 mb-6"
            >
              ABOUT SPACETOROOF
            </motion.span>
            <motion.h1 
              variants={itemVariants}
              className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter text-white mb-8 leading-[1.1]"
            >
              Smarter Solar Starts With <br className="hidden md:block" />
              Knowing Your Home.
            </motion.h1>
            <motion.p 
              variants={itemVariants}
              className="text-lg md:text-xl text-white/60 leading-relaxed max-w-2xl"
            >
              SpaceToRoof uses AI-powered satellite and property intelligence to help homeowners understand their home's solar potential before speaking with an installer.
            </motion.p>
          </section>

          {/* Mission Section */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            <motion.div variants={itemVariants} className="space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Make Solar Decisions Simpler.
              </h2>
              <div className="h-px w-20 bg-cyan-500/50" />
              <p className="text-lg text-white/60 leading-relaxed">
                Choosing solar shouldn't start with calling multiple companies or guessing what your roof can support. SpaceToRoof analyzes your property from above, turns complex solar data into a simple personalized report, and helps connect you with qualified installers.
              </p>
            </motion.div>
            
            <motion.div 
              variants={itemVariants}
              className="relative aspect-video rounded-2xl overflow-hidden glass-navy border border-white/5"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent" />
              <img 
                src="/about-solar-rooftop.jpg"
                alt="Rooftop solar panel installation at sunset"
                className="w-full h-full object-cover opacity-60 mix-blend-luminosity"
              />
            </motion.div>
          </section>

          {/* How We Help Section */}
          <section className="space-y-16">
            <motion.h2 
              variants={itemVariants}
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 text-center"
            >
              How We Help
            </motion.h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Search,
                  title: "Analyze",
                  text: "AI analyzes your property, roof, sunlight and solar potential."
                },
                {
                  icon: BarChart3,
                  title: "Understand",
                  text: "Get a personalized report showing what solar could mean for your home and electricity costs."
                },
                {
                  icon: Users,
                  title: "Connect",
                  text: "Our advanced AI filtering helps match your project with qualified solar installers in your area."
                }
              ].map((card, idx) => (
                <motion.div
                  key={idx}
                  variants={itemVariants}
                  className="group p-8 rounded-2xl glass-navy border border-white/5 hover:border-cyan-500/30 transition-all duration-500"
                >
                  <div className="size-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-cyan-500/10 transition-transform">
                    <card.icon className="size-6 text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{card.text}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <motion.section 
            variants={itemVariants}
            className="rounded-3xl glass-navy border border-white/10 p-12 md:p-20 text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
            
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-10 max-w-2xl mx-auto">
              Discover What Your Home Could Do With Solar.
            </h2>
            
            <button
              type="button"
              onClick={scrollToLeadForm}
              className="group inline-flex items-center gap-3 rounded-full bg-cyan-500 px-8 py-4 text-sm font-bold uppercase tracking-widest text-navy-dark transition-all hover:bg-cyan-400 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            >
              Get My Free Solar Report
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.section>
        </motion.div>
      </div>
    </div>
  );
}