<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import { setContext, type Snippet } from 'svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { createShield } from './shield';
	import { browser } from '$app/environment';
	import { pushState } from '$app/navigation';
	// pinned to 0.2.3 — 0.4.0's `exports` field blocks deep-importing the worker script
	import rtlTextUrl from '@mapbox/mapbox-gl-rtl-text/mapbox-gl-rtl-text.min.js?url';

	import {
		Palette,
		Rss,
		Ban,
		LocateFixed,
		MapPin,
		TrainFront,
		Waypoints,
		MountainSnow,
		Compass
	} from '@lucide/svelte';
	import Control from '$lib/map/Control.svelte';
	import Marker from '$lib/map/Marker.svelte';
	import Popup from '$lib/map/Popup.svelte';
	import Rentals from '$lib/map/rentals/Rentals.svelte';
	import Routes from '$lib/map/routes/Routes.svelte';
	import StopsView from '$lib/map/stops/StopsView.svelte';
	import Debug from '$lib/Debug.svelte';
	import { posToLocation } from '$lib/Location';
	import LevelSelect from '$lib/LevelSelect.svelte';
	import { LEVEL_MIN_ZOOM } from '$lib/constants';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import { t } from '$lib/i18n/translation';

	// required for correct rendering of RTL scripts (Arabic, Hebrew, ...);
	// lazy: only loaded once RTL text is actually encountered
	if (browser && maplibregl.getRTLTextPluginStatus() === 'unavailable') {
		maplibregl.setRTLTextPlugin(rtlTextUrl, true);
	}
	type ColorMode = 'none' | 'stops' | 'rt' | 'route' | 'mode';
	let {
		map = $bindable(),
		zoom = $bindable(),
		bounds = $bindable(),
		center = $bindable(),
		level = $bindable(),
		style,
		attribution,
		transformRequest,
		hasDebug,
		showRoutes = $bindable(),
		isSmallScreen,
		withHillshades = $bindable(),
		dataAttributionLink,
		showMap,
		colorMode = $bindable(),
		theme,
		activeTab = $bindable(),
		from = $bindable(),
		to = $bindable(),
		stop = $bindable(),
		one = $bindable(),
		stopMarker = $bindable(),
		serverConfig,
		children,
		class: className
	}: {
		map?: maplibregl.Map;
		style: maplibregl.StyleSpecification | undefined;
		attribution: string | undefined | false;
		transformRequest?: maplibregl.RequestTransformFunction;
		center: maplibregl.LngLatLike;
		bounds?: maplibregl.LngLatBoundsLike | undefined;
		zoom: number;
		level: number;
		hasDebug: boolean;
		showRoutes: boolean;
		isSmallScreen: boolean;
		withHillshades: boolean;
		dataAttributionLink: string | undefined;
		showMap: boolean;
		colorMode: ColorMode;
		theme: 'light' | 'dark';
		children?: Snippet;
		class: string;
	} = $props();

	let el: HTMLElement | null = null;
	let currStyle: maplibregl.StyleSpecification | undefined = style;
	let ctx = $state<{ map: maplibregl.Map | undefined }>({ map: undefined });
	let touchStartTime = $state<number | null>(null);
	let touchLocation = $state<{ x: number; y: number } | null>(null);
	setContext('map', ctx);

	let bearing = $state(0);
	let fromMarker = $state<maplibregl.Marker>();
	let toMarker = $state<maplibregl.Marker>();
	let oneMarker = $state<maplibregl.Marker>();

	const setActiveTab = (tab: typeof activeTab) => {
		activeTab = tab;
		pushState('', { activeTab: tab });
	};
	const colorModeOptions: { value: ColorMode; label: string; icon: typeof Ban }[] = [
		{ value: 'none', label: t.colorMode.none, icon: Ban },
		{ value: 'stops', label: t.colorMode.stops, icon: MapPin },
		{ value: 'route', label: t.colorMode.route, icon: Palette },
		{ value: 'mode', label: t.colorMode.mode, icon: TrainFront },
		{ value: 'rt', label: t.colorMode.rt, icon: Rss }
	];

	const geolocate = new maplibregl.GeolocateControl({
		positionOptions: {
			enableHighAccuracy: true
		},
		showAccuracyCircle: false,
		trackUserLocation: true
	});
	const getLocation = () => {
		geolocate.trigger();
	};

	const updateStyle = () => {
		if (style != currStyle) {
			if (!ctx.map && el) {
				createMap(el);
			} else if (ctx.map) {
				ctx.map.setStyle(style || null);
			}
			currStyle = style;
		}
	};
	const createMap = (container: HTMLElement) => {
		if (!style) {
			return;
		}
		let tmp: maplibregl.Map;
		try {
			tmp = new maplibregl.Map({
				hash: true,
				container,
				zoom,
				bounds,
				center,
				style,
				pitchWithRotate: false,
				fadeDuration: 0,
				transformRequest,
				attributionControl:
					attribution === false || attribution === undefined
						? attribution
						: { customAttribution: attribution }
			});
			tmp.addImage(
				'shield',
				...createShield({
					fill: 'hsl(0, 0%, 98%)',
					stroke: 'hsl(0, 0%, 75%)'
				})
			);

			tmp.addImage(
				'shield-dark',
				...createShield({
					fill: 'hsl(0, 0%, 16%)',
					stroke: 'hsl(0, 0%, 30%)'
				})
			);

			const scale = new maplibregl.ScaleControl({
				maxWidth: 100,
				unit: 'metric'
			});

			tmp.addControl(scale, browser && window.innerWidth < 768 ? 'top-left' : 'bottom-left');
			tmp.addControl(geolocate);

			tmp.on('load', () => {
				map = tmp;
				ctx.map = tmp;
				bounds = tmp.getBounds();
				tmp.on('moveend', () => {
					zoom = tmp.getZoom();
					center = tmp.getCenter();
					bounds = tmp.getBounds();
				});
				tmp.on('rotate', () => {
					bearing = tmp.getBearing();
				});
				tmp.on('touchstart', (event) => {
					touchStartTime = new Date().getTime();
					touchLocation = { x: event.point.x, y: event.point.y };
				});
				tmp.on('touchend', (event) => {
					const longTouchTimeMS = 500;
					const acceptableMoveDistance = 20;

					if (touchStartTime && touchLocation) {
						const touchTime = new Date().getTime() - touchStartTime;
						const didNotMoveMap =
							Math.abs(event.point.x - touchLocation.x) < acceptableMoveDistance &&
							Math.abs(event.point.y - touchLocation.y) < acceptableMoveDistance;

						if (touchTime > longTouchTimeMS && didNotMoveMap) {
							tmp.fire('contextmenu', { lngLat: event.lngLat });
						}
					}

					touchStartTime = null;
					touchLocation = null;
				});
			});
		} catch (e) {
			console.log(e);
		}

		return {
			destroy() {
				tmp?.remove();
				ctx.map = undefined;
			}
		};
	};

	$effect(updateStyle);

	type CloseFn = () => void;
</script>

{#snippet contextMenu(e: maplibregl.MapMouseEvent, close: CloseFn)}
	{#if activeTab == 'isochrones'}
		<Button
			variant="outline"
			onclick={() => {
				one = posToLocation(e.lngLat, zoom > LEVEL_MIN_ZOOM ? level : undefined);
				oneMarker?.setLngLat(one.match!);
				close();
			}}
		>
			{t.position}
		</Button>
	{/if}
	<Button
		variant="outline"
		onclick={() => {
			from = posToLocation(e.lngLat, zoom > LEVEL_MIN_ZOOM ? level : undefined);
			fromMarker?.setLngLat(from.match!);
			setActiveTab('connections');
			close();
		}}
	>
		From
	</Button>
	<Button
		variant="outline"
		onclick={() => {
			to = posToLocation(e.lngLat, zoom > LEVEL_MIN_ZOOM ? level : undefined);
			toMarker?.setLngLat(to.match!);
			setActiveTab('connections');
			close();
		}}
	>
		To
	</Button>
{/snippet}

<div use:createMap bind:this={el} class={className}>
	{#if hasDebug}
		<Control position="top-right" class="text-right">
			<Debug {bounds} {level} {zoom} />
			<Button
				size="icon"
				variant={showRoutes ? 'default' : 'outline'}
				aria-label="Toggle routes overlay"
				onclick={() => {
					showRoutes = !showRoutes;
				}}
			>
				<Waypoints class="w-5 h-5" />
			</Button>
		</Control>
	{/if}

	<LevelSelect {bounds} {zoom} bind:level />

	<div class="maplibregl-ctrl-{isSmallScreen ? 'top-left' : 'bottom-right'}">
		<div class="maplibregl-ctrl maplibregl-ctrl-attrib">
			<div class="maplibregl-ctrl-attrib-inner">
				&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>
				{#if withHillshades}
					| <a href="https://mapterhorn.com/attribution" target="_blank">Mapterhorn</a>
				{/if}
				{#if dataAttributionLink}
					| <a href={dataAttributionLink} target="_blank">{t.timetableSources}</a>
				{/if}
			</div>
		</div>
	</div>

	{#if showMap}
		{#if activeTab != 'isochrones'}
			<Control position="top-right" class="w-fit float-right">
				{@const selectedColorMode = colorModeOptions.find((o) => o.value == colorMode)}
				<Select.Root type="single" bind:value={colorMode} items={colorModeOptions}>
					<Select.Trigger class="bg-background w-40 gap-2">
						{#if selectedColorMode}
							{@const Icon = selectedColorMode.icon}
							<Icon class="h-[1.2rem] w-[1.2rem]" />
							<span class="grow text-left">{selectedColorMode.label}</span>
						{/if}
					</Select.Trigger>
					<Select.Content align="end">
						{#each colorModeOptions as option (option.value)}
							{@const Icon = option.icon}
							<Select.Item value={option.value} label={option.label} class="gap-2">
								<Icon class="h-[1.2rem] w-[1.2rem]" />
								{option.label}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</Control>
			<Control position="top-right" class="w-fit float-right pb-4">
				<Button
					class={bearing === 0 ? 'hidden' : null}
					size="icon"
					title={t.resetToNorth}
					onclick={() => map!.resetNorth()}
				>
					<Compass class="w-5 h-5" />
				</Button>
				<Button size="icon" title={t.showMyLocation} onclick={() => getLocation()}>
					<LocateFixed class="w-5 h-5" />
				</Button>
				<Button
					size="icon"
					title={t.toggleHillshades}
					variant={withHillshades ? 'default' : 'outline'}
					onclick={() => (withHillshades = !withHillshades)}
				>
					<MountainSnow class="w-5 h-5" />
				</Button>
			</Control>
			{#if showRoutes}
				<Routes
					{map}
					{bounds}
					{zoom}
					shapesDebugEnabled={serverConfig?.shapesDebugEnabled === true}
				/>
			{/if}
			<Rentals
				{map}
				{bounds}
				{zoom}
				{theme}
				isSmallScreen={isSmallScreen.current}
				debug={hasDebug}
			/>
		{/if}

		{#if colorMode === 'stops'}
			<StopsView {map} {bounds} {zoom} {level} {theme} />
		{/if}
		{#await import('$lib/RailViz.svelte') then { default: RailViz }}
			<RailViz
				{map}
				{bounds}
				{zoom}
				colorMode={colorMode === 'rt' || colorMode === 'route' || colorMode === 'mode'
					? colorMode
					: 'none'}
			/>
		{/await}

		<Popup trigger="contextmenu" children={contextMenu} />

		{#if from && activeTab == 'connections'}
			<Marker
				color="green"
				draggable={true}
				{level}
				bind:location={from}
				bind:marker={fromMarker}
			/>
		{/if}
		{#if to && activeTab == 'connections'}
			<Marker color="red" draggable={true} {level} bind:location={to} bind:marker={toMarker} />
		{/if}
		{#if stop && activeTab == 'departures'}
			<Marker
				color="black"
				draggable={false}
				{level}
				bind:location={stop}
				bind:marker={stopMarker}
			/>
		{/if}
		{#if one && activeTab == 'isochrones'}
			<Marker color="yellow" draggable={true} {level} bind:location={one} bind:marker={oneMarker} />
		{/if}
	{/if}

	{#if children}
		{@render children()}
	{/if}
</div>
