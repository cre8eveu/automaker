/**
 * Init Script Service - Executes worktree initialization scripts
 *
 * Runs the .automaker/worktree-init.sh script after worktree creation.
 * Uses Git Bash on Windows for cross-platform shell script compatibility.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { createLogger } from '@automaker/utils';
import type { EventEmitter } from '../lib/events.js';
import {
  readWorktreeMetadata,
  writeWorktreeMetadata,
} from '../lib/worktree-metadata.js';

const logger = createLogger('InitScript');

/** Common Git Bash installation paths on Windows */
const GIT_BASH_PATHS = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
  path.join(process.env.USERPROFILE || '', 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'),
];

/**
 * Find Git Bash executable on Windows
 */
function findGitBash(): string | null {
  if (process.platform !== 'win32') {
    return null;
  }

  for (const bashPath of GIT_BASH_PATHS) {
    if (fs.existsSync(bashPath)) {
      return bashPath;
    }
  }

  return null;
}

/**
 * Get the shell command for running scripts
 * Returns [shellPath, shellArgs] for cross-platform compatibility
 */
function getShellCommand(): { shell: string; args: string[] } | null {
  if (process.platform === 'win32') {
    const gitBash = findGitBash();
    if (!gitBash) {
      return null;
    }
    return { shell: gitBash, args: [] };
  }

  // Unix-like systems: prefer bash, fall back to sh
  if (fs.existsSync('/bin/bash')) {
    return { shell: '/bin/bash', args: [] };
  }
  if (fs.existsSync('/bin/sh')) {
    return { shell: '/bin/sh', args: [] };
  }

  return null;
}

export interface InitScriptOptions {
  /** Absolute path to the project root */
  projectPath: string;
  /** Absolute path to the worktree directory */
  worktreePath: string;
  /** Branch name for this worktree */
  branch: string;
  /** Event emitter for streaming output */
  emitter: EventEmitter;
}

/**
 * Check if init script exists for a project
 */
export function getInitScriptPath(projectPath: string): string {
  return path.join(projectPath, '.automaker', 'worktree-init.sh');
}

/**
 * Check if the init script has already been run for a worktree
 */
export async function hasInitScriptRun(
  projectPath: string,
  branch: string
): Promise<boolean> {
  const metadata = await readWorktreeMetadata(projectPath, branch);
  return metadata?.initScriptRan === true;
}

/**
 * Run the worktree initialization script
 * Non-blocking - returns immediately after spawning
 */
export async function runInitScript(options: InitScriptOptions): Promise<void> {
  const { projectPath, worktreePath, branch, emitter } = options;

  const scriptPath = getInitScriptPath(projectPath);

  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    logger.debug(`No init script found at ${scriptPath}`);
    return;
  }

  // Check if already run
  if (await hasInitScriptRun(projectPath, branch)) {
    logger.info(`Init script already ran for branch "${branch}", skipping`);
    return;
  }

  // Get shell command
  const shellCmd = getShellCommand();
  if (!shellCmd) {
    const error =
      process.platform === 'win32'
        ? 'Git Bash not found. Please install Git for Windows to run init scripts.'
        : 'No shell found (/bin/bash or /bin/sh)';
    logger.error(error);

    // Update metadata with error
    await writeWorktreeMetadata(projectPath, branch, {
      branch,
      createdAt: new Date().toISOString(),
      initScriptRan: true,
      initScriptStatus: 'failed',
      initScriptError: error,
    });

    emitter.emit('worktree:init-completed', {
      projectPath,
      worktreePath,
      branch,
      success: false,
      error,
    });
    return;
  }

  logger.info(`Running init script for branch "${branch}" in ${worktreePath}`);

  // Update metadata to mark as running
  const existingMetadata = await readWorktreeMetadata(projectPath, branch);
  await writeWorktreeMetadata(projectPath, branch, {
    branch,
    createdAt: existingMetadata?.createdAt || new Date().toISOString(),
    pr: existingMetadata?.pr,
    initScriptRan: false,
    initScriptStatus: 'running',
  });

  // Emit started event
  emitter.emit('worktree:init-started', {
    projectPath,
    worktreePath,
    branch,
  });

  // Spawn the script
  const child = spawn(shellCmd.shell, [...shellCmd.args, scriptPath], {
    cwd: worktreePath,
    env: {
      ...process.env,
      // Provide useful env vars to the script
      AUTOMAKER_PROJECT_PATH: projectPath,
      AUTOMAKER_WORKTREE_PATH: worktreePath,
      AUTOMAKER_BRANCH: branch,
      // Force color output even though we're not a TTY
      FORCE_COLOR: '1',
      npm_config_color: 'always',
      CLICOLOR_FORCE: '1',
      // Git colors
      GIT_TERMINAL_PROMPT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Stream stdout
  child.stdout?.on('data', (data: Buffer) => {
    const content = data.toString();
    emitter.emit('worktree:init-output', {
      projectPath,
      branch,
      type: 'stdout',
      content,
    });
  });

  // Stream stderr
  child.stderr?.on('data', (data: Buffer) => {
    const content = data.toString();
    emitter.emit('worktree:init-output', {
      projectPath,
      branch,
      type: 'stderr',
      content,
    });
  });

  // Handle completion
  child.on('exit', async (code) => {
    const success = code === 0;
    const status = success ? 'success' : 'failed';

    logger.info(`Init script for branch "${branch}" ${status} with exit code ${code}`);

    // Update metadata
    const metadata = await readWorktreeMetadata(projectPath, branch);
    await writeWorktreeMetadata(projectPath, branch, {
      branch,
      createdAt: metadata?.createdAt || new Date().toISOString(),
      pr: metadata?.pr,
      initScriptRan: true,
      initScriptStatus: status,
      initScriptError: success ? undefined : `Exit code: ${code}`,
    });

    // Emit completion event
    emitter.emit('worktree:init-completed', {
      projectPath,
      worktreePath,
      branch,
      success,
      exitCode: code,
    });
  });

  child.on('error', async (error) => {
    logger.error(`Init script error for branch "${branch}":`, error);

    // Update metadata
    const metadata = await readWorktreeMetadata(projectPath, branch);
    await writeWorktreeMetadata(projectPath, branch, {
      branch,
      createdAt: metadata?.createdAt || new Date().toISOString(),
      pr: metadata?.pr,
      initScriptRan: true,
      initScriptStatus: 'failed',
      initScriptError: error.message,
    });

    // Emit completion with error
    emitter.emit('worktree:init-completed', {
      projectPath,
      worktreePath,
      branch,
      success: false,
      error: error.message,
    });
  });
}
