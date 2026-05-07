import { json } from '@sveltejs/kit';
import { parseJsonBody, stress } from '$lib/server/lab';

type Body = {
	type: string;
	duration: number;
	duration_seconds: number;
};

export async function POST({ request, url }) {
	const body = await parseJsonBody<Body>(request);
	const type = body.type ?? url.searchParams.get('type') ?? 'cpu';
	const duration = body.duration_seconds ?? body.duration ?? url.searchParams.get('duration') ?? 15;

	return json(stress(type, duration));
}
