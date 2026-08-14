// "inspired" by https://github.com/sveltejs/kit/issues/627#issuecomment-3121655646
import { getContext, setContext } from 'svelte';

const key = Symbol('layout-slots');

export function initLayout() {
    const slots = $state({});
    return setContext(key, slots);
}

export function layout(slots) {
    const context = getContext(key);
    Object.keys(context).forEach(key => delete context[key]);
    Object.assign(context, slots);
}