import { useNavigate } from "react-router-dom";
import { CheckCircle2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const ReleaseSuccess = () => {
  const navigate = useNavigate();

  return (
<div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm sm:max-w-md text-center">
        <CardContent className="pt-10 pb-8 space-y-4">
          <CheckCircle2 className="mx-auto h-14 w-14 sm:h-16 sm:w-16 text-green-500" />
          <h1 className="text-xl sm:text-2xl font-bold">Payment Successful!</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Your music release is now <strong>in review</strong> and will be
            distributed within <strong>2 weeks</strong>.
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            You'll receive a notification once your music is live on all platforms within 2 weeks.
          </p>
          <Button className="w-full mt-4" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReleaseSuccess;