import { useState, useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import { getPostBySlug } from "@/data/blogPosts";
import { Calendar, User, ArrowLeft } from "lucide-react";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;
  const [user, setUser] = useState<any>(null);

  useSEO({
    title: post ? `${post.title} | ZedBute Blog` : "Blog Post | ZedBute",
    description: post?.description ?? "ZedBute blog post.",
    canonical: "https://www.zedbute.com/",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!post) return;
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.description,
      author: { "@type": "Organization", name: post.author },
      datePublished: post.date,
      mainEntityOfPage: `https://www.zedbute.com/blog/${post.slug}`,
    });
    document.head.appendChild(ld);
    return () => { document.head.removeChild(ld); };
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <main className="container mx-auto px-4 pt-20 sm:pt-24 pb-8 sm:pb-16">
        <article className="max-w-2xl sm:max-w-3xl mx-auto">
          <Button asChild variant="ghost" className="mb-4 sm:mb-6">
            <Link to="/blog"><ArrowLeft className="h-4 w-4" /> Back to Blog</Link>
          </Button>

          <header className="mb-6 sm:mb-8 border-b border-border pb-4 sm:pb-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 leading-tight">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><User className="h-4 w-4" />{post.author}</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </time>
              </span>
            </div>
          </header>

          <div className="space-y-4 sm:space-y-5 text-base sm:text-lg leading-relaxed text-foreground/90">
            {post.body.map((block, i) => {
              if (block.type === "h2") return <h2 key={i} className="text-xl sm:text-2xl md:text-3xl font-bold mt-6 sm:mt-8 text-foreground">{block.text}</h2>;
              if (block.type === "ul") return (
                <ul key={i} className="list-disc pl-5 sm:pl-6 space-y-1.5 sm:space-y-2">
                  {block.items?.map((it, j) => <li key={j}>{it}</li>)}
                </ul>
              );
              return <p key={i}>{block.text}</p>;
            })}
          </div>

          <div className="mt-8 sm:mt-12 p-4 sm:p-6 rounded-lg bg-card border border-border text-center">
            <h3 className="text-lg sm:text-xl font-bold mb-2">Ready to release your music?</h3>
            <p className="text-muted-foreground mb-3 sm:mb-4">Distribute to Spotify, Apple Music & 150+ platforms with ZedBute.</p>
            <Button asChild variant="hero" size="lg" className="w-full sm:w-auto">
              <Link to="/upload-release">Upload Your Release</Link>
            </Button>
          </div>
        </article>
      </main>
    </div>
  );
};

export default BlogPost;