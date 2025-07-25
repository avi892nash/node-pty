/**
 * Copyright (c) 2024, Microsoft Corporation (MIT License).
 *
 * Command execution functionality for node-pty with complete result collection
 * similar to execa library API.
 */

import * as os from 'os';
import { ITerminal, IExecResult, IExecOptions } from './interfaces';
import { ArgvOrCommandLine } from './types';

let terminalCtor: any;
if (process.platform === 'win32') {
  terminalCtor = require('./windowsTerminal').WindowsTerminal;
} else {
  terminalCtor = require('./unixTerminal').UnixTerminal;
}

/**
 * Executes a command and returns a promise with the complete result
 * @param command The command to execute
 * @param args Command arguments (optional if command contains args)
 * @param options Execution options
 */
export function exec(command: string, args?: string[], options?: IExecOptions): Promise<IExecResult>;
export function exec(command: string, options?: IExecOptions): Promise<IExecResult>;
export function exec(
  command: string,
  argsOrOptions?: string[] | IExecOptions,
  options?: IExecOptions
): Promise<IExecResult> {
  let actualArgs: string[] = [];
  let actualOptions: IExecOptions = {};

  // Parse overloaded arguments
  if (Array.isArray(argsOrOptions)) {
    actualArgs = argsOrOptions;
    actualOptions = options || {};
  } else {
    actualOptions = argsOrOptions || {};
  }

  return new Promise((resolve, reject) => {
    let stdout = '';
    const stderr = '';
    let timedOut = false;
    let finished = false;

    const startTime = Date.now();
    const timeout = actualOptions.timeout || 30000; // 30s default timeout

    // Parse command and args
    let file: string;
    let commandArgs: string[];

    if (actualOptions.shell !== false) {
      // Use shell by default (like execa)
      const shell = typeof actualOptions.shell === 'string'
        ? actualOptions.shell
        : (os.platform() === 'win32' ? 'cmd.exe' : 'sh');

      if (os.platform() === 'win32') {
        file = shell;
        commandArgs = ['/c', command, ...actualArgs];
      } else {
        file = shell;
        commandArgs = ['-c', actualArgs.length > 0 ? `${command} ${actualArgs.join(' ')}` : command];
      }
    } else {
      // Direct execution
      file = command;
      commandArgs = actualArgs;
    }

    // Create terminal process
    const ptyProcess: ITerminal = new terminalCtor(file, commandArgs, {
      name: 'xterm-256color',
      cols: actualOptions.cols || 80,
      rows: actualOptions.rows || 24,
      cwd: actualOptions.cwd || process.cwd(),
      env: actualOptions.env || process.env,
      encoding: actualOptions.encoding || 'utf8',
      ...actualOptions
    });

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      if (!finished) {
        timedOut = true;
        ptyProcess.kill();
        finishExecution(-1, undefined);
      }
    }, timeout);

    // Collect output data
    ptyProcess.on('data', (data: string) => {
      stdout += data;
    });

    // Handle process exit
    ptyProcess.on('exit', (exitCode: number, signal?: number) => {
      finishExecution(exitCode, signal);
    });

    // Handle errors
    ptyProcess.on('error', (error: Error) => {
      if (!finished) {
        finished = true;
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });

    function finishExecution(exitCode: number, signal?: number): void {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutHandle);

      // Strip final newline if requested (default: true, like execa)
      const shouldStripNewline = actualOptions.stripFinalNewline !== false;
      let finalStdout = stdout;
      let finalStderr = stderr;

      if (shouldStripNewline) {
        finalStdout = stdout.replace(/\r?\n$/, '');
        finalStderr = stderr.replace(/\r?\n$/, '');
      }

      const result: IExecResult = {
        stdout: finalStdout,
        stderr: finalStderr,
        exitCode,
        signal,
        command: `${command}${actualArgs.length > 0 ? ' ' + actualArgs.join(' ') : ''}`,
        timedOut
      };

      if (exitCode === 0 && !timedOut) {
        resolve(result);
      } else {
        // Create error with additional context (like execa)
        const error = new Error(`Command failed with exit code ${exitCode}: ${command}`) as any;
        error.exitCode = exitCode;
        error.signal = signal;
        error.stdout = finalStdout;
        error.stderr = finalStderr;
        error.command = result.command;
        error.timedOut = timedOut;
        reject(error);
      }
    }
  });
}

/**
 * Executes a command using template literal syntax (experimental)
 * @param template Template literal parts
 * @param substitutions Template substitutions
 */
export function execTemplate(template: TemplateStringsArray, ...substitutions: any[]): Promise<IExecResult> {
  const command = template.reduce((result, str, i) => {
    return result + str + (i < substitutions.length ? String(substitutions[i]) : '');
  }, '');

  return exec(command);
}
