import { json } from '@sveltejs/kit';
import { probe } from '$lib/server/lab';

export function POST() {
	return json(probe());
}
