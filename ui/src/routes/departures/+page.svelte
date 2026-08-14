<script lang="ts">
	import { X } from '@lucide/svelte';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import Control from '$lib/map/Control.svelte';
	import Marker from '$lib/map/Marker.svelte';
	import { t } from '$lib/i18n/translation';
	import StopTimes from '$lib/StopTimes.svelte';

	import { layout } from '$lib/layout.svelte';
	layout({ custom });

	let stop = $state<Location>();
	let stopMarker = $state<maplibregl.Marker>();
	let stopNameFromResponse = $state<string>('');
</script>

{#if page.state.selectedStop}
	<Control class="min-h-0 md:mb-2">
		<Card class="w-[520px] md:max-h-[60vh] h-full bg-background rounded-lg flex flex-col mb-2">
			<div class="w-full flex justify-between items-center shadow-md pl-1 mb-1">
				<h2 class="ml-2 text-base font-semibold">
					{#if page.state.stopArriveBy}
						{t.arrivals}
					{:else}
						{t.departures}
					{/if}
					in
					{stopNameFromResponse}
				</h2>
				<Button
					variant="ghost"
					onclick={() => {
						history.back();
					}}
				>
					<X />
				</Button>
			</div>
			<div class="p-2 md:p-4 overflow-y-auto overflow-x-hidden min-h-0 md:max-h-[60vh]">
				<StopTimes
					stopId={page.state.selectedStop.stopId}
					stopName={page.state.selectedStop.name}
					time={page.state.selectedStop.time}
					bind:stop
					bind:stopMarker
					bind:stopNameFromResponse
					arriveBy={page.state.stopArriveBy}
					exactRadius={page.state.exactRadius}
				/>
			</div>
		</Card>
	</Control>
{/if}

{#snippet custom()}
	{#if page.state.selectedStop}
		<Marker color="black" draggable={false} bind:location={stop} bind:marker={stopMarker} />
	{/if}
{/snippet}
