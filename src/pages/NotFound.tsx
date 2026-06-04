import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-4">🍀</div>
      <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Page Not Found</h1>
      <p className="text-muted-foreground mb-8">Looks like this hole doesn't exist.</p>
      <Link to="/" className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold">
        Back to Home
      </Link>
    </div>
  );
}