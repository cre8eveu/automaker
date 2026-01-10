import { useState, useRef, useEffect } from 'react';
import { Terminal, Check, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type InitScriptState } from '@/store/app-store';
import { AnsiOutput } from '@/components/ui/ansi-output';

interface InitScriptIndicatorProps {
  projectPath: string;
}

export function InitScriptIndicator({ projectPath }: InitScriptIndicatorProps) {
  const initScriptState = useAppStore((s) => s.initScriptState[projectPath]);
  const clearInitScriptState = useAppStore((s) => s.clearInitScriptState);
  const [showLogs, setShowLogs] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [initScriptState?.output, showLogs]);

  // Reset dismissed state when a new script starts
  useEffect(() => {
    if (initScriptState?.status === 'running') {
      setDismissed(false);
      setShowLogs(true);
    }
  }, [initScriptState?.status]);

  if (!initScriptState || dismissed) return null;
  if (initScriptState.status === 'idle') return null;

  const { status, output, branch, error } = initScriptState;

  const handleDismiss = () => {
    setDismissed(true);
    // Clear state after a delay to allow for future scripts
    setTimeout(() => {
      clearInitScriptState(projectPath);
    }, 100);
  };

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'bg-card border border-border rounded-lg shadow-lg',
        'min-w-[350px] max-w-[500px]',
        'animate-in slide-in-from-right-5 duration-200'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          {status === 'running' && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          )}
          {status === 'success' && <Check className="w-4 h-4 text-green-500" />}
          {status === 'failed' && <X className="w-4 h-4 text-red-500" />}
          <span className="font-medium text-sm">
            Init Script{' '}
            {status === 'running'
              ? 'Running'
              : status === 'success'
                ? 'Completed'
                : 'Failed'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="p-1 hover:bg-accent rounded transition-colors"
            title={showLogs ? 'Hide logs' : 'Show logs'}
          >
            {showLogs ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {status !== 'running' && (
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-accent rounded transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Branch info */}
      <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <Terminal className="w-3.5 h-3.5" />
        <span>Branch: {branch}</span>
      </div>

      {/* Logs (collapsible) */}
      {showLogs && (
        <div className="border-t border-border/50">
          <div className="p-3 max-h-[300px] overflow-y-auto">
            {output.length > 0 ? (
              <AnsiOutput text={output.join('')} />
            ) : (
              <div className="text-xs text-muted-foreground/60 text-center py-2">
                {status === 'running' ? 'Waiting for output...' : 'No output'}
              </div>
            )}
            {error && (
              <div className="mt-2 text-red-500 text-xs font-medium">
                Error: {error}
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Status bar for completed states */}
      {status !== 'running' && (
        <div
          className={cn(
            'px-3 py-2 text-xs',
            status === 'success'
              ? 'bg-green-500/10 text-green-600'
              : 'bg-red-500/10 text-red-600'
          )}
        >
          {status === 'success'
            ? 'Initialization completed successfully'
            : 'Initialization failed - worktree is still usable'}
        </div>
      )}
    </div>
  );
}
