import { Link } from "react-router-dom";
import { PublicNav, PublicFooter } from "@/components/PublicNav";

const LAST_UPDATED = "February 19, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-600 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f4f6fb] font-sans flex flex-col">
      <PublicNav active="terms" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-3">Terms of Service</h1>
          <p className="text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-8">
          <Section title="1. Acceptance of Terms">
            By accessing or using tseeder.cc (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.
          </Section>

          <Section title="2. Eligibility">
            You must be at least 16 years old to use tseeder. By using the Service, you represent that you meet this requirement and have the legal capacity to enter into this agreement.
          </Section>

          <Section title="3. Acceptable Use Policy">
            You agree to use tseeder only for lawful purposes. You may not use the Service to:
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Download, store, or distribute content that infringes any intellectual property rights.</li>
              <li>Download, store, or distribute illegal content including but not limited to child sexual abuse material (CSAM), which is strictly prohibited and will result in immediate account termination and referral to law enforcement.</li>
              <li>Conduct, facilitate, or promote any illegal activity.</li>
              <li>Attempt to circumvent, disable, or interfere with security features of the Service.</li>
              <li>Use the Service in a way that could damage, disable, or impair our infrastructure.</li>
              <li>Share account credentials with third parties.</li>
              <li>Resell or sublicense access to the Service without written permission.</li>
            </ul>
          </Section>

          <Section title="4. Content Ownership and Responsibility">
            You retain ownership of any content you upload or download using the Service. You are solely responsible for ensuring you have the right to download, store, and access any content processed through tseeder. We are a neutral conduit and do not review or monitor content unless legally compelled or when responding to DMCA notices.
          </Section>

          <Section title="5. DMCA and Copyright">
            We respect intellectual property rights and comply with the Digital Millennium Copyright Act. If you believe content stored via tseeder infringes your copyright, please submit a notice at{" "}
            <Link to="/dmca" className="text-indigo-600 hover:text-indigo-800 transition-colors underline underline-offset-2">/dmca</Link>. We will respond to valid notices promptly.
          </Section>

          <Section title="6. Account Termination">
            We may suspend or terminate your account immediately, without prior notice, if:
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>You breach these Terms.</li>
              <li>We receive a valid DMCA notice related to your content.</li>
              <li>We detect abuse, fraud, or illegal activity.</li>
              <li>Continued operation of your account poses a risk to other users or the Service.</li>
            </ul>
            You may terminate your account at any time from Settings. Upon termination, your data will be deleted per our Privacy Policy.
          </Section>

          <Section title="7. Service Availability">
            We strive to maintain 99.9% uptime but do not guarantee uninterrupted access. The Service may be temporarily unavailable for maintenance, upgrades, or reasons outside our control. We are not liable for any downtime or data loss.
          </Section>

          <Section title="8. Quotas and Limits">
            Your use of the Service is subject to the limits of your plan (storage, concurrent jobs, file retention). We reserve the right to enforce these limits technically. Files exceeding the retention period of your plan are automatically deleted without additional notice.
          </Section>

          <Section title="9. Payments and Refunds">
            Paid plans are billed in advance on a monthly or annual basis. All fees are non-refundable except where required by applicable law or at our sole discretion. We reserve the right to change pricing with 30 days' notice.
          </Section>

          <Section title="10. Disclaimer of Warranties">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </Section>

          <Section title="11. Limitation of Liability">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, TSEEDER SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, REVENUE, OR PROFITS ARISING FROM YOUR USE OF THE SERVICE.
          </Section>

          <Section title="12. Changes to Terms">
            We may update these Terms at any time. We will notify you by email or in-app notice at least 14 days before material changes take effect. Continued use after that date constitutes acceptance of the updated Terms.
          </Section>

          <Section title="13. Governing Law">
            These Terms are governed by and construed in accordance with applicable law. Any disputes shall be resolved through binding arbitration or in a court of competent jurisdiction, at our election.
          </Section>

          <Section title="14. Contact">
            <strong className="text-gray-900">tseeder Legal</strong><br />
            Email: legal@tseeder.cc
          </Section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-xs text-gray-400">
          <Link to="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
          <Link to="/dmca" className="hover:text-gray-900 transition-colors">DMCA / Abuse</Link>
          <Link to="/status" className="hover:text-gray-900 transition-colors">System Status</Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
