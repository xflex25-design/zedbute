import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import { blogPosts } from "@/data/blogPosts";
import { Calendar, ArrowRight } from "lucide-react";

const Blog = () => {
  const [user, setUser] = useState<any>(null);

  useSEO({
    title: "ZedBute Blog | Music Distribution Tips for Zambian Artists",
    description:
      "Insights, guides and tips on music distribution, streaming, and growing your career as an independent Zambian artist.",
    canonical: "https://zedbute-net.lovable.app/blog",
    keywords: "Zambian music blog, music distribution tips, independent artist guide, Spotify Zambia",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <main className="container mx-auto px-4 pt-24 pb-16">
        <header className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            ZedBute <span className="bg-gradient-primary bg-clip-text text-transparent">Blog</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Tips, guides, and stories about music distribution for independent Zambian and African artists.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {blogPosts.map((post) => (
            <Card key={post.slug} className="flex flex-col hover:shadow-glow transition-all">
              <CardHeader>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Calendar className="h-3 w-3" />
                  <time dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </div>
                <CardTitle className="text-xl leading-snug">{post.title}</CardTitle>
                <CardDescription className="line-clamp-3">{post.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild variant="hero" className="w-full">
                  <Link to={`/blog/${post.slug}`}>
                    Read More <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
};

export default Blog;
