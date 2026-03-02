// Helper para execução de comandos shell
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function execAsync(
  command: string, 
  options: { 
    cwd?: string; 
    timeout?: number;
    env?: Record<string, string>;
  } = {}
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd: options.cwd,
      timeout: options.timeout || 60000,
      env: { ...process.env, ...options.env },
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    return {
      stdout,
      stderr,
      exitCode: 0
    };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1
    };
  }
}

export async function execPython(
  scriptPath: string, 
  args: string[] = [],
  options: { cwd?: string; timeout?: number } = {}
): Promise<ExecResult> {
  const command = `python "${scriptPath}" ${args.map(a => `"${a}"`).join(' ')}`;
  return execAsync(command, options);
}
