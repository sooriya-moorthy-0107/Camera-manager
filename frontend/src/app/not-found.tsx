import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
      <div className="bg-white border-2 border-black rounded p-8 max-w-md w-full text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 bg-black text-white font-mono text-sm font-bold flex items-center justify-center mx-auto rounded">
          404
        </div>
        <h1 className="text-base font-bold uppercase tracking-wider text-black">
          Page Not Found
        </h1>
        <p className="text-xs text-neutral-600">
          The requested route or equipment page does not exist or has been moved.
        </p>
        <div className="pt-2">
          <Link href="/">
            <Button variant="primary" size="md">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

