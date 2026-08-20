import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] bg-background text-center px-4">
      <h1 className="text-6xl font-serif text-primary font-bold mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-6">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        The page you are looking for might have been removed, had its name changed,
        or is temporarily unavailable.
      </p>
      <Button asChild className="rounded-none bg-primary text-primary-foreground">
        <Link href="/">Return to Home</Link>
      </Button>
    </div>
  );
}