import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "How does SolarXAI work?",
    answer: "SolarXAI starts with your property location and the information you provide about your home. Our AI uses satellite and aerial property data to analyze your home from above, identify and evaluate your roof, and assess factors such as sunlight exposure, roof suitability, available roof area and potential shading. We combine this property analysis with your electricity usage and other information to estimate your home's solar potential and create a personalized solar report. If your property is a good fit and you choose to explore solar, we can then help connect you with qualified solar installers serving your area.",
  },
  {
    question: "Is the solar report really free?",
    answer: "Yes. Your personalized SolarXAI solar report is completely free and comes with no obligation to purchase solar.",
  },
  {
    question: "How do you qualify solar installers?",
    answer: "Our advanced AI filtering system analyzes your property and project requirements, then helps match your lead with qualified solar installers serving your area. This means your information goes to installers who are relevant to your property and solar needs—not just random companies.",
  },
  {
    question: "Do you help with residential and commercial properties?",
    answer: "Yes. SolarXAI can analyze both residential and commercial properties and help identify their potential for solar.",
  },
  {
    question: "Do you sell or install solar panels?",
    answer: "No. SolarXAI does not sell or install solar panels. We analyze your property and help connect you with qualified solar installers who can provide solar options, pricing and installation.",
  },
];

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-navy-dark overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold text-white mb-6"
          >
            Questions? We've Got Answers.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-white/60 max-w-2xl mx-auto"
          >
            Everything you need to know about SolarXAI and your free solar analysis.
          </motion.p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`glass-card overflow-hidden transition-all duration-300 ${
                openIndex === index ? "border-cyan-500/50 shadow-[0_0_30px_oklch(0.75_0.18_190_/_0.1)]" : "border-white/5"
              }`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-6 md:px-8 md:py-8 flex items-center justify-between text-left transition-colors group"
              >
                <span className={`text-lg md:text-xl font-semibold transition-colors ${
                  openIndex === index ? "text-cyan-400" : "text-white/90 group-hover:text-white"
                }`}>
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className={`${openIndex === index ? "text-cyan-400" : "text-white/40"}`}
                >
                  <ChevronDown size={24} />
                </motion.div>
              </button>
              
              <AnimatePresence initial={false}>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="px-6 pb-6 md:px-8 md:pb-8 text-white/70 leading-relaxed md:text-lg border-t border-white/5 pt-6">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
