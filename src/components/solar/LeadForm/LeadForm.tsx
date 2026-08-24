import { useState } from 'react';
import { FormHeader } from './FormHeader';
import { Step1AboutYou } from './Step1AboutYou';
import { Step2Property } from './Step2Property';
import { Step3Home } from './Step3Home';
import { Step4Solar } from './Step4Solar';
import { AnalysisLoader } from './AnalysisLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { setReportData } from '@/lib/report-store';
import { API_BASE } from '@/config.js';

type ValidationCheck = {
  key: string;
  label: string;
  score: number;
  passed: boolean;
  detail?: string;
};

type SolarReportPayload = {
  panelCount?: number | null;
  systemKw?: number | null;
  annualProductionKwh?: number | null;
  coveragePct?: number | null;
  orientation?: string | null;
  pitch?: string | null;
  shading?: string | null;
  usableRoofSqft?: number | null;
  imageryDate?: string | null;
  imageryQuality?: string | null;
  ratePerKwh?: number | null;
  year1Savings?: number | null;
  year5Savings?: number | null;
  year10Savings?: number | null;
  year25Savings?: number | null;
  estSolarPayment?: number | null;
  co2Tons25?: number | null;
  treesEquiv?: number | null;
  milesOffset?: number | null;
  productionSource?: string | null;
};

type InquiryResponse = {
  ok: boolean;
  leadCode: string;
  status: string;
  opportunityScore: number;
  listedInMarketplace: boolean;
  propertyType?: string;
  solarPotentialLabel?: string | null;
  billRange?: string | null;
  estimatedSolarKw?: number | null;
  estimatedRoofSqft?: number | null;
  scoreBreakdown?: Record<string, unknown>;
  validationChecks?: ValidationCheck[];
  message?: string;
  enrichmentSource?: 'google_solar' | 'estimated';
  dataSources?: Record<string, string> | null;
  satelliteImageUrl?: string | null;
  solarReport?: SolarReportPayload | null;
  propertyLat?: number | null;
  propertyLng?: number | null;
  existingLeadCode?: string;
  existingStatus?: string;
};

export function LeadForm() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const navigate = useNavigate();

  const updateData = (newData: Record<string, unknown>) =>
    setFormData((prev) => ({ ...prev, ...newData }));
  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const validateBeforeSubmit = () => {
    const firstName = String(formData.firstName || '').trim();
    const lastName = String(formData.lastName || '').trim();
    const email = String(formData.email || '').trim();
    const phone = String(formData.phone || '').trim();
    const address = String(formData.address || '').trim();

    if (!firstName || !lastName) return 'First and last name are required.';
    if (!email) return 'Email address is required.';
    if (!phone) return 'Phone number is required.';
    if (!address) return 'Property address is required.';
    if (formData.propertyType !== 'Residential' && formData.propertyType !== 'Commercial') {
      return 'Please select Residential or Commercial.';
    }
    if (!formData.ownership) return 'Please confirm whether you own this home.';
    if (!formData.roofType) return 'Please select your roof type.';
    if (!formData.timeline) return 'Please select when you are considering solar.';

    return null;
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const clientError = validateBeforeSubmit();
    if (clientError) {
      setSubmitError(clientError);
      return;
    }

    setSubmitError('');
    setSubmitting(true);

    const name = [formData.firstName, formData.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 55000);

      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/marketplace/inquiries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone: formData.phone,
            email: formData.email,
            address: formData.address,
            monthlyBill: formData.monthlyBill != null ? Number(formData.monthlyBill) : 250,
            propertyLat: formData.propertyLat != null ? Number(formData.propertyLat) : undefined,
            propertyLng: formData.propertyLng != null ? Number(formData.propertyLng) : undefined,
            homeownerStatus: formData.ownership === 'rent' ? 'Renter' : 'Homeowner',
            installationTimeline: formData.timeline,
            projectDetails: [
              formData.roofType ? `Roof: ${formData.roofType}` : null,
              formData.propertyType ? `Property: ${formData.propertyType}` : null,
              formData.propertyLat != null && formData.propertyLng != null
                ? `Pin: ${Number(formData.propertyLat).toFixed(6)},${Number(formData.propertyLng).toFixed(6)}`
                : null,
            ]
              .filter(Boolean)
              .join('. '),
          }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      const raw = await res.text();
      let data: InquiryResponse & { error?: string; code?: string } = {} as InquiryResponse;
      try {
        data = raw ? (JSON.parse(raw) as InquiryResponse & { error?: string; code?: string }) : ({} as InquiryResponse);
      } catch {
        if (res.status === 429) {
          setSubmitError('Too many requests. Please wait a minute and try again.');
          return;
        }
        if (res.status >= 500) {
          setSubmitError('Server is temporarily unavailable. Please try again in a moment.');
          return;
        }
        setSubmitError('Unexpected server response. Please try again.');
        return;
      }

      if (!res.ok) {
        if (res.status === 429) {
          setSubmitError(data.error || 'Too many requests. Please wait a minute and try again.');
          return;
        }
        if (res.status === 409) {
          const existingLeadCode = String(data.existingLeadCode || '').trim();
          if (existingLeadCode) {
            try {
              const existingRes = await fetch(
                `${API_BASE}/api/marketplace/report/${encodeURIComponent(existingLeadCode)}`,
                { cache: 'no-store' },
              );
              if (existingRes.ok) {
                const existingData = (await existingRes.json()) as InquiryResponse;
                const existingPayload = {
                  ...formData,
                  leadCode: existingLeadCode,
                  opportunityScore: existingData.opportunityScore,
                  marketplaceStatus: existingData.status || data.existingStatus || 'new',
                  listedInMarketplace: existingData.listedInMarketplace,
                  propertyType: existingData.propertyType ?? formData.propertyType,
                  solarPotentialLabel: existingData.solarPotentialLabel,
                  billRange: existingData.billRange,
                  estimatedSolarKw:
                    existingData.estimatedSolarKw ??
                    existingData.solarReport?.systemKw ??
                    formData.estimatedSolarKw,
                  estimatedRoofSqft:
                    existingData.estimatedRoofSqft ??
                    existingData.solarReport?.usableRoofSqft ??
                    formData.estimatedRoofSqft,
                  qualificationMessage: existingData.message || data.error,
                  enrichmentSource: existingData.enrichmentSource ?? 'estimated',
                  dataSources: existingData.dataSources ?? null,
                  satelliteImageUrl: existingData.satelliteImageUrl ?? null,
                  solarReport: existingData.solarReport ?? null,
                  googleSolarHit: existingData.enrichmentSource === 'google_solar',
                  propertyLat: existingData.propertyLat ?? formData.propertyLat,
                  propertyLng: existingData.propertyLng ?? formData.propertyLng,
                };
                setFormData(existingPayload);
                setIsAnalyzing(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
              }
            } catch (existingErr) {
              console.error('[LeadForm] Failed to load existing duplicate inquiry:', existingErr);
            }
          }
          setSubmitError(
            data.error ||
              'A similar inquiry was already submitted recently. Please use a different email or address.',
          );
          return;
        }
        setSubmitError(data.error || 'Unable to validate your details. Please check the form and try again.');
        return;
      }

      const reportPayload = {
        ...formData,
        leadCode: data.leadCode,
        opportunityScore: data.opportunityScore,
        marketplaceStatus: data.status,
        propertyType: data.propertyType,
        solarPotentialLabel: data.solarPotentialLabel,
        billRange: data.billRange,
        estimatedSolarKw: data.estimatedSolarKw ?? data.solarReport?.systemKw ?? formData.estimatedSolarKw,
        estimatedRoofSqft: data.estimatedRoofSqft ?? data.solarReport?.usableRoofSqft ?? formData.estimatedRoofSqft,
        qualificationMessage: data.message,
        enrichmentSource: data.enrichmentSource ?? 'estimated',
        dataSources: data.dataSources ?? null,
        satelliteImageUrl: data.satelliteImageUrl ?? null,
        solarReport: data.solarReport ?? null,
        googleSolarHit: data.enrichmentSource === 'google_solar',
        propertyLat: data.propertyLat ?? formData.propertyLat,
        propertyLng: data.propertyLng ?? formData.propertyLng,
      };

      setFormData(reportPayload);
      setIsAnalyzing(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('[LeadForm] Marketplace inquiry failed:', err);
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError' || name === 'TimeoutError') {
        setSubmitError('Request timed out. Please try again — your connection may be slow.');
      } else {
        setSubmitError('Network error. Please check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isAnalyzing) {
    return (
      <AnalysisLoader
        onComplete={() => {
          setReportData(formData);
          setIsAnalyzing(false);
          navigate('/solar-report');
        }}
      />
    );
  }

  return (
    <section id="lead-form" className="py-20 px-6">
      <div className="max-w-[600px] mx-auto glass-form-container p-8 rounded-3xl">
        <FormHeader step={step} />

        {submitError ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {submitError}
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {step === 0 && (
              <Step1AboutYou onNext={next} data={formData} updateData={updateData} />
            )}
            {step === 1 && (
              <Step2Property onNext={next} onBack={back} data={formData} updateData={updateData} />
            )}
            {step === 2 && (
              <Step3Home onNext={next} onBack={back} data={formData} updateData={updateData} />
            )}
            {step === 3 && (
              <Step4Solar
                onBack={back}
                data={formData}
                updateData={updateData}
                onSubmit={handleSubmit}
                submitting={submitting}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
