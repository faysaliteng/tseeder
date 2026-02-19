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

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f4f6fb] font-sans flex flex-col">
      <PublicNav active="privacy" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-3">Privacy Policy</h1>
          <p className="text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-8">
          <Section title="1. Introduction">
            fseeder ("we", "us", "our") operates <strong className="text-gray-900">fseeder.cc</strong> — a remote cloud download manager. This Privacy Policy explains how we collect, use, disclose, and protect information about you when you use our service. By using fseeder, you agree to this policy.
          </Section>

          <Section title="2. Information We Collect">
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-gray-900">Account data:</strong> Email address, hashed password (PBKDF2-SHA256), and account creation timestamp.</li>
              <li><strong className="text-gray-900">Usage data:</strong> Download job metadata (torrent infohash, file names, sizes, timestamps, status). We do not log magnet URIs or torrent content beyond metadata required to operate the service.</li>
              <li><strong className="text-gray-900">Session data:</strong> HTTP-only session cookies (no persistent tracking cookies), device type, and last-seen timestamp.</li>
              <li><strong className="text-gray-900">Technical logs:</strong> Structured JSON logs containing request timestamps, anonymised IP prefixes (/24 for IPv4), error codes, and correlation IDs. Logs are retained for 30 days then purged.</li>
              <li><strong className="text-gray-900">Payment data:</strong> If you subscribe, payment is handled by a PCI-DSS-compliant processor. We store only plan identifiers and subscription status — never card numbers.</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>To authenticate you and maintain your session securely.</li>
              <li>To execute download jobs and store your files in encrypted R2 storage.</li>
              <li>To enforce usage quotas, plan limits, and retention policies.</li>
              <li>To detect and prevent abuse, fraud, and illegal activity.</li>
              <li>To communicate service changes, security notices, and billing updates.</li>
              <li>To improve service reliability and performance through aggregate analytics.</li>
            </ul>
          </Section>

          <Section title="4. Data Retention">
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-gray-900">Files:</strong> Retained per your plan's retention period (Free: 7 days; Pro: 30 days; Business: 90 days) then automatically deleted from R2.</li>
              <li><strong className="text-gray-900">Account data:</strong> Retained while your account is active. Deleted within 30 days of account deletion request.</li>
              <li><strong className="text-gray-900">Audit logs:</strong> Retained for 1 year for security and legal compliance, then purged.</li>
              <li><strong className="text-gray-900">Request logs:</strong> Retained for 30 days.</li>
            </ul>
          </Section>

          <Section title="5. Data Security">
            All files are encrypted at rest using AES-256 in Cloudflare R2. All data in transit is protected by TLS 1.3. Passwords are never stored in plaintext — we use PBKDF2-SHA256 with a unique salt per user. Sessions use HTTP-only, Secure, SameSite=Strict cookies. We do not log full IP addresses. Your IP never touches any peer-to-peer network — all torrent traffic originates from our infrastructure.
          </Section>

          <Section title="6. Sharing and Disclosure">
            We do not sell, rent, or trade your personal data. We may share data:
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>With Cloudflare (infrastructure provider) under their Data Processing Agreement.</li>
              <li>With payment processors, only as required for billing.</li>
              <li>With law enforcement when legally compelled by a valid court order in our jurisdiction, and only to the extent required.</li>
              <li>If we believe in good faith that disclosure is necessary to protect our rights, prevent fraud, or protect user safety.</li>
            </ul>
          </Section>

          <Section title="7. Your Rights">
            You have the right to:
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate data.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Export your data in a portable format.</li>
              <li>Withdraw consent for optional processing.</li>
            </ul>
            To exercise these rights, email <strong className="text-gray-900">privacy@fseeder.cc</strong>.
          </Section>

          <Section title="8. Cookies">
            We use only functional, strictly necessary cookies:
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-gray-900">session_id:</strong> HTTP-only, Secure, SameSite=Strict. Expires when your browser session ends or after 7 days of inactivity.</li>
              <li><strong className="text-gray-900">csrf_token:</strong> Used to prevent Cross-Site Request Forgery attacks.</li>
            </ul>
            We do not use tracking, analytics, or advertising cookies.
          </Section>

          <Section title="9. Children">
            fseeder is not intended for use by anyone under 16 years of age. We do not knowingly collect data from minors. If you believe a minor has created an account, contact us at privacy@fseeder.cc.
          </Section>

          <Section title="10. Changes to This Policy">
            We may update this policy from time to time. We will notify you by email or in-app notice at least 14 days before material changes take effect. Continued use after that constitutes acceptance.
          </Section>

          <Section title="11. Contact">
            <strong className="text-gray-900">fseeder Privacy Team</strong><br />
            Email: privacy@fseeder.cc<br />
            Response time: within 72 hours for privacy requests.
          </Section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-xs text-gray-400">
          <Link to="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <Link to="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
          <Link to="/dmca" className="hover:text-gray-900 transition-colors">DMCA / Abuse</Link>
          <Link to="/status" className="hover:text-gray-900 transition-colors">System Status</Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
