import { useNavigate } from "react-router-dom";
import { CheckCircle2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const ReleaseSuccess = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8 space-y-4">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <h1 className="text-2xl font-bold">Payment Successful!</h1>
          <p className="text-muted-foreground">
            Your music release is now <strong>in review</strong> and will be
            distributed within <strong>2 weeks</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            You'll receive a notification once your music is live on Boomplay and Spotify.
          </p>
          <Button className="w-full mt-4" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReleaseSuccess;