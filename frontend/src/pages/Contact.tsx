import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
// Separator not needed — using subtle borders in layout
import { Mail, Phone, MapPin, Clock, Send } from "lucide-react";
import axios from "axios";
import { apiClient } from "@/lib/api-client";

const CONTACT_EMAIL = "hostelia@hostelia.abhiraj0x.me";
const CONTACT_PHONE_DISPLAY = "+91 73555 10488";
const CONTACT_PHONE_LINK = "tel:+917355510488";
const OFFICE_ADDRESS = "BH3 Hostel IIIT Sri City Andhra Pradesh";

function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<null | "success" | "error">(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // clear previous errors
    setErrors({});

    const newErrors: Record<string, string> = {};

    // Require alphabetic characters in name and message
    const hasLetter = (val: string) => /\p{L}/u.test(val);

    if (!name.trim()) newErrors.name = "Name is required";
    else if (!hasLetter(name)) newErrors.name = "Name must contain alphabetic characters";

    if (!email.trim()) newErrors.email = "Email is required";
    else {
      // Basic email pattern check (simple, practical validation)
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) newErrors.email = "Please enter a valid email address (e.g. name@domain.com)";
    }

    if (!message.trim()) newErrors.message = "Message is required";
    else if (!hasLetter(message)) newErrors.message = "Message must contain alphabetic characters";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setStatus("error");
      setStatusMessage("Please complete the required fields.");
      return;
    }
    try {
      setSubmitting(true);
      setStatus(null);
      setStatusMessage(null);
      const payload = {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() ? subject.trim() : undefined,
        message: message.trim()
      };
      const response = await apiClient.post("/contact", payload);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setStatus("success");
      setStatusMessage(response.data?.message ?? "Message sent — we'll be in touch.");
      setErrors({});
    } catch (err) {
      setStatus("error");
      if (axios.isAxiosError(err)) {
        const apiMessage =
          err.response?.data?.message ||
          Object.values(err.response?.data?.errors ?? {})?.[0] ||
          "Failed to send your message. Please try again.";
        setStatusMessage(typeof apiMessage === "string" ? apiMessage : "Failed to send your message. Please try again.");
      } else {
        setStatusMessage("Failed to send your message. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/10">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Contact Us</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            We're here to help — send us a message and we'll get back to you within one business day. For urgent matters, please call us.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* Form Card */}
          <Card className="shadow-md rounded-lg">
            <CardHeader>
              <CardTitle>Send a message</CardTitle>
              <CardDescription>Use the form to reach the admin team — we reply within one business day.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
                    {errors.name && (
                      <p className="text-xs text-destructive mt-1">{errors.name}</p>
                    )}
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@institution.edu" />
                    {errors.email && (
                      <p className="text-xs text-destructive mt-1">{errors.email}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" />
                </div>

                <div>
                  <Label>Message</Label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" />
                  {errors.message && (
                    <p className="text-xs text-destructive mt-1">{errors.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={submitting} className="inline-flex items-center gap-2">
                      {submitting ? "Sending..." : "Send Message"}
                      <Send className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={submitting}
                      onClick={() => {
                        setName("");
                        setEmail("");
                        setSubject("");
                        setMessage("");
                        setStatus(null);
                        setStatusMessage(null);
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                  <div>
                    {status === "success" && (
                      <span className="text-sm text-emerald-600">{statusMessage ?? "Message sent — we'll be in touch."}</span>
                    )}
                    {status === "error" && (
                      <span className="text-sm text-destructive">{statusMessage ?? "Failed to send your message. Please try again."}</span>
                    )}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Contact details</CardTitle>
                <CardDescription>Office and support information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3">
                  <div className="grid grid-cols-[44px_1fr] items-center gap-3 p-2 rounded-md">
                    <div className="h-11 w-11 flex items-center justify-center rounded-lg bg-muted shrink-0">
                      <MapPin className="size-5 text-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Hostelia Administrative Office</p>
                      <p className="text-sm text-muted-foreground">{OFFICE_ADDRESS}</p>
                    </div>
                  </div>

                  <a href={`mailto:${CONTACT_EMAIL}`} className="block hover:bg-muted/5 rounded-md">
                    <div className="grid grid-cols-[44px_1fr] items-center gap-3 p-2">
                      <div className="h-11 w-11 flex items-center justify-center rounded-lg bg-muted shrink-0">
                        <Mail className="size-5 text-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{CONTACT_EMAIL}</p>
                      </div>
                    </div>
                  </a>

                  <a href={CONTACT_PHONE_LINK} className="block hover:bg-muted/5 rounded-md">
                    <div className="grid grid-cols-[44px_1fr] items-center gap-3 p-2">
                      <div className="h-11 w-11 flex items-center justify-center rounded-lg bg-muted shrink-0">
                        <Phone className="size-5 text-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">{CONTACT_PHONE_DISPLAY}</p>
                      </div>
                    </div>
                  </a>

                  <div className="pt-1 border-t border-border/60" />

                  <div className="grid grid-cols-[44px_1fr] items-center gap-3 p-2">
                    <div className="h-11 w-11 flex items-center justify-center rounded-lg bg-muted shrink-0">
                      <Clock className="size-5 text-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Office Hours</p>
                      <p className="text-sm text-muted-foreground">Mon — Fri: 9:00 AM — 5:00 PM</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Contact;
