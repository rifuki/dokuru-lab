import { json } from '@sveltejs/kit';
import { pingHost } from '$lib/server/lab';

export async function GET({ url }) {
	return json(await pingHost(url.searchParams.get('host')));
}
