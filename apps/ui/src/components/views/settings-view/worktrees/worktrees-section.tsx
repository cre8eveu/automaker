import { useState, useEffect, useCallback, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ShellSyntaxEditor } from '@/components/ui/shell-syntax-editor';
import { GitBranch, Terminal, FileCode, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiPost, apiPut } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

interface WorktreesSectionProps {
  useWorktrees: boolean;
  onUseWorktreesChange: (value: boolean) => void;
}

interface InitScriptResponse {
  success: boolean;
  exists: boolean;
  content: string;
  path: string;
  error?: string;
}

export function WorktreesSection({ useWorktrees, onUseWorktreesChange }: WorktreesSectionProps) {
  const currentProject = useAppStore((s) => s.currentProject);
  const [scriptContent, setScriptContent] = useState('');
  const [scriptPath, setScriptPath] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load init script content when project changes
  useEffect(() => {
    if (!currentProject?.path) {
      setScriptContent('');
      setScriptPath('');
      setIsLoading(false);
      return;
    }

    const loadInitScript = async () => {
      setIsLoading(true);
      try {
        const response = await apiPost<InitScriptResponse>('/api/worktree/init-script', {
          projectPath: currentProject.path,
        });
        if (response.success) {
          setScriptContent(response.content || '');
          setScriptPath(response.path || '');
        }
      } catch (error) {
        console.error('Failed to load init script:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitScript();
  }, [currentProject?.path]);

  // Debounced save function
  const saveScript = useCallback(
    async (content: string) => {
      if (!currentProject?.path) return;

      setIsSaving(true);
      try {
        const response = await apiPut<{ success: boolean; error?: string }>(
          '/api/worktree/init-script',
          {
            projectPath: currentProject.path,
            content,
          }
        );
        if (response.success) {
          setShowSaved(true);
          savedTimeoutRef.current = setTimeout(() => setShowSaved(false), 2000);
        } else {
          toast.error('Failed to save init script', {
            description: response.error,
          });
        }
      } catch (error) {
        console.error('Failed to save init script:', error);
        toast.error('Failed to save init script');
      } finally {
        setIsSaving(false);
      }
    },
    [currentProject?.path]
  );

  // Handle content change with debounce
  const handleContentChange = useCallback(
    (value: string) => {
      setScriptContent(value);
      setShowSaved(false);

      // Clear existing timeouts
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }

      // Debounce save
      saveTimeoutRef.current = setTimeout(() => {
        saveScript(value);
      }, 1000);
    },
    [saveScript]
  );

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden',
        'border border-border/50',
        'bg-gradient-to-br from-card/90 via-card/70 to-card/80 backdrop-blur-xl',
        'shadow-sm shadow-black/5'
      )}
    >
      <div className="p-6 border-b border-border/50 bg-gradient-to-r from-transparent via-accent/5 to-transparent">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 flex items-center justify-center border border-brand-500/20">
            <GitBranch className="w-5 h-5 text-brand-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">Worktrees</h2>
        </div>
        <p className="text-sm text-muted-foreground/80 ml-12">
          Configure git worktree isolation and initialization scripts.
        </p>
      </div>
      <div className="p-6 space-y-5">
        {/* Enable Worktrees Toggle */}
        <div className="group flex items-start space-x-3 p-3 rounded-xl hover:bg-accent/30 transition-colors duration-200 -mx-3">
          <Checkbox
            id="use-worktrees"
            checked={useWorktrees}
            onCheckedChange={(checked) => onUseWorktreesChange(checked === true)}
            className="mt-1"
            data-testid="use-worktrees-checkbox"
          />
          <div className="space-y-1.5">
            <Label
              htmlFor="use-worktrees"
              className="text-foreground cursor-pointer font-medium flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4 text-brand-500" />
              Enable Git Worktree Isolation
            </Label>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Creates isolated git branches for each feature. When disabled, agents work directly in
              the main project directory.
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-border/30" />

        {/* Init Script Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-brand-500" />
              <Label className="text-foreground font-medium">Initialization Script</Label>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isSaving && (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </span>
              )}
              {showSaved && !isSaving && (
                <span className="flex items-center gap-1 text-green-500">
                  <Check className="w-3 h-3" />
                  Saved
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            Shell commands to run after a worktree is created. Runs once per worktree. Uses Git
            Bash on Windows for cross-platform compatibility.
          </p>

          {currentProject ? (
            <>
              {/* File path indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                <FileCode className="w-3.5 h-3.5" />
                <code className="font-mono">.automaker/worktree-init.sh</code>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ShellSyntaxEditor
                  value={scriptContent}
                  onChange={handleContentChange}
                  placeholder={`# Example initialization commands
npm install

# Or use pnpm
# pnpm install

# Copy environment file
# cp .env.example .env`}
                  minHeight="200px"
                  data-testid="init-script-editor"
                />
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground/60 py-4 text-center">
              Select a project to configure the init script.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
