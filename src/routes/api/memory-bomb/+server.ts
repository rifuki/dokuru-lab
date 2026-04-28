import { json } from '@sveltejs/kit';
import { allocateMemory, parseJsonBody } from '$lib/server/lab';

type Body = { mb: number };

export async function POST({ request }) {
	const body = await parseJsonBody<Body>(request);
	return json(allocateMemory(body.mb));
}
