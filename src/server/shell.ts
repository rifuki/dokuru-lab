import { execFileSync, spawn } from 'node:child_process';
import type { WebSocket } from 'ws';
import { line } from './socket';

export function runShell(socket: WebSocket, command: string, timeoutMs = 15_000): Promise<void> {
	return new Promise((resolve) => {
		line(socket, 'system', `$ ${command}\n`);
		const child = spawn('/bin/sh', ['-lc', command], {
			env: process.env,
			cwd: process.cwd(),
			stdio: ['ignore', 'pipe', 'pipe']
		});

		const timeout = setTimeout(() => {
			line(socket, 'stderr', `command timed out after ${timeoutMs}ms; killing pid ${child.pid}\n`);
			child.kill('SIGKILL');
		}, timeoutMs);

		child.stdout.on('data', (chunk: Buffer) => line(socket, 'stdout', chunk.toString()));
		child.stderr.on('data', (chunk: Buffer) => line(socket, 'stderr', chunk.toString()));
		child.on('error', (error) => line(socket, 'stderr', `${error.message}\n`));
		child.on('close', (code, signal) => {
			clearTimeout(timeout);
			line(socket, 'system', `process exited code=${code ?? 'null'} signal=${signal ?? 'none'}\n`);
			resolve();
		});
	});
}

export function commandSync(command: string): string {
	return spawnSyncText('/bin/sh', ['-lc', command]);
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(Math.max(Math.trunc(value), min), max);
}

function spawnSyncText(command: string, args: string[]): string {
	try {
		return execFileSync(command, args, { encoding: 'utf8', timeout: 3000 }).trim();
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}
