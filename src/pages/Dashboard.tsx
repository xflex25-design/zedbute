{/* Welcome Header */}
<div className="mb-6">
  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
    Welcome, {profile?.full_name || "User"}!
  </h1>

  <p className="text-sm sm:text-base text-muted-foreground mt-1">
    Manage your music distribution and verification status
  </p>
</div>

{/* Artist Verification Card */}
<Card className="mb-6 bg-card border border-border p-6">
  <div className="flex items-center gap-3 mb-2">
    <Disc className="h-6 w-6 text-primary" />

    <h2 className="text-lg font-semibold">
      Artist verification information
    </h2>
  </div>

  <p className="text-sm text-muted-foreground">
    Get verified to unlock premium distribution features
  </p>
</Card>

{/* Hero CTA */}
<Button
  onClick={() => navigate("/verify-claim")}
  className="w-full mb-6 rounded-xl bg-gradient-primary px-6 py-5 text-base sm:text-lg font-bold text-primary-foreground shadow-glow hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
>
  <Plus className="h-5 w-5" />
  Create Artist
</Button>

{/* Quick Actions */}
<div className="mb-8">
  <h2 className="text-xl font-bold mb-4">
    Quick Actions
  </h2>

  <p className="text-sm text-muted-foreground mb-4">
    Manage your music
  </p>

  <div className="grid gap-3">
    <Button
      variant="outline"
      className="justify-start h-auto py-4 px-4 gap-3 text-base w-full"
      onClick={() => navigate("/upload-release")}
    >
      <Plus className="h-5 w-5 shrink-0" />
      Upload New Release
    </Button>

    <Button
      variant="outline"
      className="justify-start h-auto py-4 px-4 gap-3 text-base w-full"
      onClick={() => navigate("/verify-claim")}
    >
      <CheckCircle2 className="h-5 w-5 shrink-0" />
      Get Verified
    </Button>
  </div>
</div>