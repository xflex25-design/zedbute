import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import emailjs from "@emailjs/browser";

const EMAILJS = {
  publicKey: "y6dBkyYNeiQ5-ONrT",
  serviceId: "service_m5ipkn6",
  templateId: "template_h6m0hkf",
};

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast({ title: "Missing fields", description: "Please complete all fields.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await emailjs.init(EMAILJS.publicKey);
      await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
        from_name: name,
        from_email: email,
        message,
      });
      toast({ title: "Message sent", description: "We will respond within 24 hours." });
      setName("");
      setEmail("");
      setMessage("");
    } catch (error: any) {
      toast({ title: "Send failed", description: error?.text || error?.message || "Try again later.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>ZedBute | Contact</title>
        <meta name="description" content="Contact ZedBute for support, distribution questions, or partnership inquiries." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 text-center">
              <h1 className="text-3xl sm:text-4xl font-bold">Contact ZedBute</h1>
              <p className="text-muted-foreground mt-3">
                Reach out for support, artist verification questions, or distribution help.
              </p>
            </div>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Send us a message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="contact-name">Name</Label>
                    <Input
                      id="contact-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-message">Message</Label>
                    <Textarea
                      id="contact-message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Tell us how we can help..."
                      rows={6}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default Contact;
