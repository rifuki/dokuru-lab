import { json } from '@sveltejs/kit';
import { getHostResourceInfo } from '$lib/server/lab';

export function GET() {
	return json(getHostResourceInfo());
}
