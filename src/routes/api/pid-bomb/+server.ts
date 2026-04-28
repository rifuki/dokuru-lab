import { json } from '@sveltejs/kit';
import { parseJsonBody, spawnPidBomb } from '$lib/server/lab';

type Body = { count: number };

export async function POST({ request }) {
	const body = await parseJsonBody<Body>(request);
	return json(spawnPidBomb(body.count));
}
