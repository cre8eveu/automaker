/**
 * Init Script routes - Read/write the worktree-init.sh file
 *
 * GET /init-script - Read the init script content
 * PUT /init-script - Write content to the init script file
 * DELETE /init-script - Delete the init script file
 */

import type { Request, Response } from 'express';
import path from 'path';
import * as secureFs from '../../../lib/secure-fs.js';
import { getErrorMessage, logError } from '../common.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('InitScript');

/** Fixed path for init script within .automaker directory */
const INIT_SCRIPT_FILENAME = 'worktree-init.sh';

/**
 * Get the full path to the init script for a project
 */
function getInitScriptPath(projectPath: string): string {
  return path.join(projectPath, '.automaker', INIT_SCRIPT_FILENAME);
}

/**
 * GET /init-script - Read the init script content
 */
export function createGetInitScriptHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath } = req.body as { projectPath: string };

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      const scriptPath = getInitScriptPath(projectPath);

      try {
        const content = await secureFs.readFile(scriptPath, 'utf-8');
        res.json({
          success: true,
          exists: true,
          content: content as string,
          path: scriptPath,
        });
      } catch {
        // File doesn't exist
        res.json({
          success: true,
          exists: false,
          content: '',
          path: scriptPath,
        });
      }
    } catch (error) {
      logError(error, 'Read init script failed');
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };
}

/**
 * PUT /init-script - Write content to the init script file
 */
export function createPutInitScriptHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, content } = req.body as {
        projectPath: string;
        content: string;
      };

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      if (typeof content !== 'string') {
        res.status(400).json({
          success: false,
          error: 'content must be a string',
        });
        return;
      }

      const scriptPath = getInitScriptPath(projectPath);
      const automakerDir = path.dirname(scriptPath);

      // Ensure .automaker directory exists
      await secureFs.mkdir(automakerDir, { recursive: true });

      // Write the script content
      await secureFs.writeFile(scriptPath, content, 'utf-8');

      logger.info(`Wrote init script to ${scriptPath}`);

      res.json({
        success: true,
        path: scriptPath,
      });
    } catch (error) {
      logError(error, 'Write init script failed');
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };
}

/**
 * DELETE /init-script - Delete the init script file
 */
export function createDeleteInitScriptHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath } = req.body as { projectPath: string };

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      const scriptPath = getInitScriptPath(projectPath);

      try {
        await secureFs.rm(scriptPath, { force: true });
        logger.info(`Deleted init script at ${scriptPath}`);
        res.json({
          success: true,
        });
      } catch {
        // File doesn't exist - still success
        res.json({
          success: true,
        });
      }
    } catch (error) {
      logError(error, 'Delete init script failed');
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };
}
