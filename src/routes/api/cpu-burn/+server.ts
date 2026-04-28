import { json } from '@sveltejs/kit';
import { burnCpu, parseJsonBody } from '$lib/server/lab';

type Body = { seconds: number };

export async function POST({ request }) {
	const body = await parseJsonBody<Body>(request);
	return json(burnCpu(body.seconds));
}
