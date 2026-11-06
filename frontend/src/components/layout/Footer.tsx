import { Link } from "react-router-dom";

const footerLinks = [
  { label: "Complaints", to: "/complaints" },
  { label: "About", to: "/about" },
  { label: "Support", to: "/contact" },
];

const CONTACT_EMAIL = "hostelia@hostelia.abhiraj0x.me";
const CONTACT_PHONE_DISPLAY = "+91 73555 10488";
const CONTACT_PHONE_LINK = "tel:+917355510488";

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex flex-col gap-8 px-6 py-12 lg:max-w-6xl lg:px-12">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between">
          <div className="space-y-3">
            <p className="text-xl font-semibold text-foreground">Hostelia</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              End-to-end hostel management with transparent complaint tracking, real-time updates, and actionable analytics.
            </p>
          </div>
          <div className="flex gap-12 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground/80">Explore</p>
              <div className="mt-3 space-y-2">
                {footerLinks.map((link) => (
                  <Link key={link.to} to={link.to} className="block hover:text-foreground">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground/80">Contact</p>
              <div className="mt-3 space-y-2">
                <a href={`mailto:${CONTACT_EMAIL}`} className="block hover:text-foreground">
                  {CONTACT_EMAIL}
                </a>
                <a href={CONTACT_PHONE_LINK} className="block hover:text-foreground">
                  {CONTACT_PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/70 pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Hostelia. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
