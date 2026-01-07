/**
 * Login View - Web mode authentication
 *
 * Prompts user to enter the API key shown in server console.
 * On successful login, sets an HTTP-only session cookie.
 *
 * On mount, verifies if an existing session is valid using exponential backoff.
 * This handles cases where server live reloads kick users back to login
 * even though their session is still valid.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { login, verifySession } from '@/lib/http-api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useSetupStore } from '@/store/setup-store';

/**
 * Delay helper for exponential backoff
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function LoginView() {
  const navigate = useNavigate();
  const setAuthState = useAuthStore((s) => s.setAuthState);
  const setupComplete = useSetupStore((s) => s.setupComplete);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const sessionCheckRef = useRef(false);

  // Check for existing valid session on mount with exponential backoff
  useEffect(() => {
    // Prevent duplicate checks in strict mode
    if (sessionCheckRef.current) return;
    sessionCheckRef.current = true;

    const checkExistingSession = async () => {
      const maxRetries = 5;
      const baseDelay = 500; // Start with 500ms

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const isValid = await verifySession();
          if (isValid) {
            // Session is valid, redirect to the main app
            setAuthState({ isAuthenticated: true, authChecked: true });
            navigate({ to: setupComplete ? '/' : '/setup' });
            return;
          }
          // Session is invalid, no need to retry - show login form
          break;
        } catch {
          // Network error or server not ready, retry with exponential backoff
          if (attempt < maxRetries - 1) {
            const waitTime = baseDelay * Math.pow(2, attempt); // 500, 1000, 2000, 4000, 8000ms
            await delay(waitTime);
          }
        }
      }

      // Session check complete (either invalid or all retries exhausted)
      setIsCheckingSession(false);
    };

    checkExistingSession();
  }, [navigate, setAuthState, setupComplete]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await login(apiKey.trim());
      if (result.success) {
        // Mark as authenticated for this session (cookie-based auth)
        setAuthState({ isAuthenticated: true, authChecked: true });

        // After auth, determine if setup is needed or go to app
        navigate({ to: setupComplete ? '/' : '/setup' });
      } else {
        setError(result.error || 'Invalid API key');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking existing session
  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Authentication Required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the API key shown in the server console to continue.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="apiKey" className="text-sm font-medium">
              API Key
            </label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter API key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isLoading}
              autoFocus
              className="font-mono"
              data-testid="login-api-key-input"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !apiKey.trim()}
            data-testid="login-submit-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              'Login'
            )}
          </Button>
        </form>

        {/* Help Text */}
        <div className="rounded-lg border bg-muted/50 p-4 text-sm">
          <p className="font-medium">Where to find the API key:</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
            <li>Look at the server terminal/console output</li>
            <li>Find the box labeled "API Key for Web Mode Authentication"</li>
            <li>Copy the UUID displayed there</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
