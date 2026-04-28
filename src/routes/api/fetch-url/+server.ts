import { json } from '@sveltejs/kit';
import { fetchFromServer, parseJsonBody } from '$lib/server/lab';

type Body = { url: string };

export async function POST({ request }) {
	const body = await parseJsonBody<Body>(request);
	const result = await fetchFromServer(body.url);
	return json(result, { status: result.ok ? 200 : 500 });
}
