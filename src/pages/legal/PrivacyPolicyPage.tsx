import { LegalPageShell, LegalSection } from '@/components/legal/LegalPageShell';
import { BRAND_EMAIL, BRAND_NAME, BRAND_URL } from '@/config/brand.js';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle={`${BRAND_NAME} Legal`}
      updated="August 25, 2026"
    >
      <LegalSection title="1. Who we are">
        <p>
          {BRAND_NAME} ({BRAND_URL}) operates a solar property intelligence platform for homeowners and
          residential solar installers. This Privacy Policy explains how we collect, use, share, and protect
          personal information when you use our websites, reports, marketplace, and installer tools.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>
          <strong className="text-white/90">Homeowner inquiries:</strong> name, email, phone, property
          address, location coordinates, roof and usage details you submit, and communications you send us.
        </p>
        <p>
          <strong className="text-white/90">Installer accounts:</strong> business name, contact details,
          billing information, service territories, team members, and platform usage.
        </p>
        <p>
          <strong className="text-white/90">Automatically collected:</strong> IP address, device/browser
          type, pages viewed, referral URLs, cookies, and similar analytics data.
        </p>
        <p>
          <strong className="text-white/90">Property &amp; solar enrichment:</strong> satellite imagery,
          roof modeling outputs, estimated production, and scoring derived from third-party geospatial and
          energy datasets tied to an address you provide.
        </p>
      </LegalSection>

      <LegalSection id="data-ethics" title="3. How we use information">
        <p>We use personal information to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Generate personalized solar reports and property estimates</li>
          <li>Qualify and route homeowner inquiries to relevant installers in our marketplace</li>
          <li>Provide maps, targeting, CRM exports, and billing to installer customers</li>
          <li>Verify contact information, prevent fraud, and enforce our Terms</li>
          <li>Send service messages, support replies, and — with consent — marketing communications</li>
          <li>Improve models, security, and product performance using aggregated or de-identified data</li>
        </ul>
        <p id="security" className="pt-2">
          We do not sell homeowner contact details as a standalone lead list. Installer access to identifiable
          homeowner information is gated by marketplace rules, unlock credits, and applicable law.
        </p>
      </LegalSection>

      <LegalSection title="4. Legal bases &amp; consent (reminders)">
        <p>
          <strong className="text-white/90">United States:</strong> By submitting a homeowner inquiry you
          represent that you are authorized to provide the property information supplied and consent to be
          contacted by {BRAND_NAME} and qualified installers about solar options by phone, SMS, and email,
          including via automated technology where permitted. Message/data rates may apply. Reply STOP to opt
          out of SMS where supported.
        </p>
        <p>
          <strong className="text-white/90">California (CCPA/CPRA):</strong> California residents may request
          access, correction, deletion, and information about categories of data we collect and share. We do
          not sell personal information for monetary consideration. Submit requests to {BRAND_EMAIL}.
        </p>
        <p>
          <strong className="text-white/90">EEA/UK (GDPR):</strong> Where GDPR applies, we process data based
          on consent, contract performance, legitimate interests (fraud prevention, product improvement), or
          legal obligation. You may have rights to access, rectify, erase, restrict, object, and port data,
          and to lodge a complaint with a supervisory authority.
        </p>
      </LegalSection>

      <LegalSection title="5. Sharing with third parties">
        <p>We may share information with:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Verified solar installers participating in our marketplace when you request quotes or approve contact</li>
          <li>Infrastructure providers (hosting, email, SMS, payments, maps, analytics, identity verification)</li>
          <li>Professional advisers and authorities when required by law or to protect rights and safety</li>
          <li>Successors in a merger, acquisition, or asset sale subject to this Policy</li>
        </ul>
        <p>
          Third-party services have their own privacy practices. We require processors to protect data under
          contractual safeguards appropriate to the sensitivity of the information.
        </p>
      </LegalSection>

      <LegalSection title="6. Retention &amp; security">
        <p>
          We retain information as long as needed to provide services, comply with law, resolve disputes, and
          enforce agreements. Retention periods vary by record type (e.g., billing records may be kept longer
          for tax purposes).
        </p>
        <p>
          We use encryption in transit, access controls, monitoring, and least-privilege practices. No method
          of transmission or storage is 100% secure; please use strong passwords and protect your account
          credentials.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies &amp; analytics">
        <p>
          We use cookies and similar technologies for authentication, preferences, security, and analytics. You
          can control cookies through browser settings; disabling cookies may limit certain features.
        </p>
      </LegalSection>

      <LegalSection title="8. Children">
        <p>
          Our services are not directed to children under 16. We do not knowingly collect personal information
          from children. Contact us to request deletion if you believe a child provided data.
        </p>
      </LegalSection>

      <LegalSection title="9. Your choices">
        <p>
          You may update profile information in your account, opt out of marketing emails via unsubscribe
          links, and request access or deletion by emailing {BRAND_EMAIL}. We may need to verify your identity
          before fulfilling requests.
        </p>
      </LegalSection>

      <LegalSection title="10. International transfers">
        <p>
          If you access our services from outside the United States, your information may be processed in the
          U.S. or other countries with different data protection laws. Where required, we implement appropriate
          safeguards for cross-border transfers.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be posted on this page
          with an updated date. Continued use after changes constitutes acceptance where permitted by law.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Privacy inquiries:{' '}
          <a href={`mailto:${BRAND_EMAIL}`} className="text-cyan-400 hover:underline">
            {BRAND_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
