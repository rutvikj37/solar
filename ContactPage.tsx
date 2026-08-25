import { motion, Variants } from "framer-motion";
import { ArrowRight, Mail, Phone, MapPin, Clock, Send, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { API_BASE } from "../../config.js";
import { BRAND_EMAIL, BRAND_NAME } from "../../config/brand.js";
import { scrollToLeadForm } from "../../lib/scrollToLeadForm.js";

export function ContactPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${API_BASE}/api/marketing/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${form.firstName} ${form.lastName}`.trim(),
          email: form.email,
          phone: form.phone,
          intent: "demo",
          message: `[${form.subject || "general"}] ${form.message}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      setIsSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSubmitting(false);
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
          className="space-y-20 lg:space-y-32"
        >
          {/* Hero Section */}
          <section className="max-w-4xl">
            <motion.span 
              variants={itemVariants}
              className="inline-block text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-400 mb-6"
            >
              CONTACT {BRAND_NAME.toUpperCase()}
            </motion.span>
            <motion.h1 
              variants={itemVariants}
              className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter text-white mb-8 leading-[1.1]"
            >
              Have a Question? <br className="hidden md:block" />
              We're Here to Help.
            </motion.h1>
            <motion.p 
              variants={itemVariants}
              className="text-lg md:text-xl text-white/60 leading-relaxed max-w-2xl"
            >
              Whether you have a question about your solar report, property analysis, or installer matching, our team is here to help.
            </motion.p>
          </section>

          {/* Contact Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            {/* Left: Contact Details */}
            <motion.div variants={itemVariants} className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  {
                    icon: Mail,
                    label: "Email",
                    value: BRAND_EMAIL,
                    href: `mailto:${BRAND_EMAIL}`
                  },
                  {
                    icon: Phone,
                    label: "Phone",
                    value: "+1 (XXX) XXX-XXXX",
                    href: "tel:+10000000000"
                  },
                  {
                    icon: MapPin,
                    label: "Address",
                    value: "United States",
                    href: null
                  },
                  {
                    icon: Clock,
                    label: "Support Hours",
                    value: "Monday–Friday\n9:00 AM – 6:00 PM",
                    href: null
                  }
                ].map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-6 rounded-2xl glass-navy border border-white/5 hover:border-cyan-500/30 transition-all duration-500 group"
                  >
                    <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-cyan-500/10 transition-transform">
                      <item.icon className="size-5 text-cyan-400" />
                    </div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-2">{item.label}</h3>
                    {item.href ? (
                      <a href={item.href} className="text-sm font-medium text-white hover:text-cyan-400 transition-colors">
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-white whitespace-pre-line">
                        {item.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-8 rounded-2xl glass-navy border border-white/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent" />
                <h3 className="text-xl font-bold text-white mb-4 relative z-10">Direct Support</h3>
                <p className="text-sm text-white/50 leading-relaxed relative z-10">
                  Our team of solar specialists is available to provide technical assistance and answer any property-specific questions you might have.
                </p>
              </div>
            </motion.div>

            {/* Right: Contact Form */}
            <motion.div variants={itemVariants}>
              <div className="p-8 md:p-10 rounded-3xl glass-navy border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
                
                {isSubmitted ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12 space-y-6"
                  >
                    <div className="size-20 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="size-10 text-cyan-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Message Sent!</h3>
                    <p className="text-white/60 max-w-sm mx-auto leading-relaxed">
                      Thanks! Your message has been received. We'll get back to you soon.
                    </p>
                    <button 
                      onClick={() => setIsSubmitted(false)}
                      className="text-cyan-400 text-sm font-bold uppercase tracking-widest hover:text-cyan-300 transition-colors"
                    >
                      Send Another Message
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-8">Send Us a Message</h2>
                    {submitError && (
                      <p className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                        {submitError}
                      </p>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">First Name *</label>
                          <input 
                            required
                            type="text"
                            placeholder="John"
                            value={form.firstName}
                            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors placeholder:text-white/10"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Last Name *</label>
                          <input 
                            required
                            type="text"
                            placeholder="Doe"
                            value={form.lastName}
                            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors placeholder:text-white/10"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Email Address *</label>
                          <input 
                            required
                            type="email"
                            placeholder="john@example.com"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors placeholder:text-white/10"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Phone Number</label>
                          <input 
                            type="tel"
                            placeholder="+1 (555) 000-0000"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors placeholder:text-white/10"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Subject *</label>
                        <select 
                          required
                          value={form.subject}
                          onChange={(e) => setForm({ ...form, subject: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none"
                        >
                          <option value="" className="bg-navy-dark">Select a subject</option>
                          <option value="report" className="bg-navy-dark">Solar Report Question</option>
                          <option value="installers" className="bg-navy-dark">Installer Matching</option>
                          <option value="other" className="bg-navy-dark">General Inquiry</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Message *</label>
                        <textarea 
                          required
                          rows={4}
                          placeholder="How can we help you?"
                          value={form.message}
                          onChange={(e) => setForm({ ...form, message: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors placeholder:text-white/10 resize-none"
                        />
                      </div>

                      <button 
                        disabled={isSubmitting}
                        type="submit"
                        className="w-full group flex items-center justify-center gap-3 rounded-xl bg-cyan-500 px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-cyan-400 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? "Sending..." : "Send Message"}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </div>

          {/* Final CTA */}
          <motion.section 
            variants={itemVariants}
            className="rounded-3xl glass-navy border border-white/10 p-12 md:p-20 text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
            
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-10 max-w-2xl mx-auto">
              Ready to Discover Your Home's Solar Potential?
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
