import { json } from '@sveltejs/kit';
import { parseJsonBody, runShell } from '$lib/server/lab';

type Body = { command: string };

export async function POST({ request }) {
	const body = await parseJsonBody<Body>(request);
	return json(await runShell(body.command));
}
