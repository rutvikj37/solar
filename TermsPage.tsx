import { LegalPageShell, LegalSection } from '@/components/legal/LegalPageShell';
import { BRAND_EMAIL, BRAND_NAME, BRAND_URL } from '@/config/brand.js';

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      subtitle={`${BRAND_NAME} Legal`}
      updated="August 25, 2026"
    >
      <LegalSection title="1. Agreement">
        <p>
          By accessing {BRAND_URL}, creating an account, submitting a homeowner inquiry, purchasing credits,
          or using installer tools, you agree to these Terms of Service and our Privacy Policy. If you do not
          agree, do not use the services.
        </p>
      </LegalSection>

      <LegalSection title={`2. What ${BRAND_NAME} is — and is not`}>
        <p>
          {BRAND_NAME} provides software, property analysis, lead marketplace, and related services. We are{' '}
          <strong className="text-white/90">not</strong> a solar installer, utility, engineer of record,
          lender, insurer, or government incentive administrator. We do not guarantee installation, pricing,
          savings, permits, interconnection, or financing approval.
        </p>
        <p>
          Solar reports, scores, production estimates, and savings projections are{' '}
          <strong className="text-white/90">illustrative models</strong> based on available data and
          assumptions. Actual results depend on roof condition, equipment, shading, usage, tariffs, weather,
          maintenance, and installer workmanship.
        </p>
      </LegalSection>

      <LegalSection title="3. Homeowner services">
        <p>When you request a free solar report or submit an inquiry you agree that:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Information you provide is accurate to the best of your knowledge</li>
          <li>You own the property or are authorized to explore solar for it</li>
          <li>
            You consent to contact from {BRAND_NAME} and qualified installers by phone, SMS, and email,
            including automated calls/texts where allowed by law
          </li>
          <li>
            {BRAND_NAME} may review, score, and approve or decline listing your inquiry in the installer
            marketplace
          </li>
          <li>Any contract for solar equipment or installation is solely between you and the installer</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Installer &amp; business accounts">
        <p>Installer customers agree to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Provide accurate business registration, licensing, and contact information</li>
          <li>Comply with federal, state, and local telemarketing, privacy, and solar sales laws (including TCPA, CAN-SPAM, and state Do-Not-Call rules)</li>
          <li>Use unlocked leads and contact data only for lawful solar sales and service follow-up</li>
          <li>Not resell, scrape, or redistribute platform data without written permission</li>
          <li>Maintain adequate insurance and honor quotes, warranties, and consumer protection obligations you offer homeowners</li>
        </ul>
        <p>
          Marketplace credits, bids, wallet balances, and lead unlocks are subject to the pricing and rules
          displayed at purchase. Fees are generally non-refundable except where required by law or explicitly
          stated in writing.
        </p>
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <p>You may not misuse the platform, including by attempting to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Bypass access controls, rate limits, or payment systems</li>
          <li>Upload malware, interfere with servers, or probe vulnerabilities without authorization</li>
          <li>Harass users, submit false inquiries, or impersonate others</li>
          <li>Use the service for unlawful discrimination or deceptive marketing</li>
        </ul>
        <p>We may suspend or terminate accounts that violate these Terms or pose risk to users or the platform.</p>
      </LegalSection>

      <LegalSection title="6. Intellectual property">
        <p>
          The {BRAND_NAME} name, logos, software, models, and content are owned by us or our licensors. You
          receive a limited, non-exclusive license to use the services according to these Terms. Report PDFs
          generated for your property may be used for personal evaluation; commercial redistribution requires
          permission.
        </p>
      </LegalSection>

      <LegalSection title="7. Third-party services">
        <p>
          Maps, payments, email/SMS, cloud hosting, and data enrichment may be provided by third parties.
          Their terms apply in addition to ours. We are not responsible for third-party outages or policy
          changes beyond our reasonable control.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimers">
        <p className="uppercase text-[11px] tracking-wide text-white/50 leading-relaxed">
          THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM EXTENT
          PERMITTED BY LAW, {BRAND_NAME} DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT
          UNINTERRUPTED OR ERROR-FREE OPERATION OR THAT ESTIMATES WILL MATCH ACTUAL ENERGY PRODUCTION OR
          SAVINGS.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p className="uppercase text-[11px] tracking-wide text-white/50 leading-relaxed">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {BRAND_NAME} AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND
          SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICES. OUR TOTAL
          LIABILITY FOR ANY CLAIM RELATING TO THE SERVICES IS LIMITED TO THE GREATER OF (A) AMOUNTS YOU PAID
          US IN THE TWELVE (12) MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS ($100), EXCEPT WHERE
          LIABILITY CANNOT BE LIMITED BY LAW.
        </p>
      </LegalSection>

      <LegalSection title="10. Indemnification">
        <p>
          You agree to defend and indemnify {BRAND_NAME} against claims arising from your misuse of the
          services, violation of law, infringement of third-party rights, or disputes between homeowners and
          installers to the extent caused by your conduct.
        </p>
      </LegalSection>

      <LegalSection title="11. Dispute resolution &amp; governing law">
        <p>
          These Terms are governed by the laws of the State of Arizona, USA, without regard to conflict-of-law
          rules, except where consumer protection laws in your state of residence require otherwise.
        </p>
        <p>
          Before filing a claim, you agree to contact us at {BRAND_EMAIL} to attempt informal resolution. Any
          dispute not resolved informally shall be brought in the state or federal courts located in Maricopa
          County, Arizona, and you consent to personal jurisdiction there, unless applicable law grants you
          the right to bring claims in your home jurisdiction.
        </p>
        <p>
          <strong className="text-white/90">Class action waiver:</strong> Where enforceable, disputes must be
          brought individually and not as a class, collective, or representative action.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes &amp; termination">
        <p>
          We may modify these Terms by posting an updated version. Material changes will be noted with a new
          effective date. We may suspend or terminate access for violations, non-payment, or business reasons
          with notice where practicable.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Questions about these Terms:{' '}
          <a href={`mailto:${BRAND_EMAIL}`} className="text-cyan-400 hover:underline">
            {BRAND_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
