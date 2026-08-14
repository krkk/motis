<script lang="ts">
    import { X, RefreshCw } from '@lucide/svelte';
    import { refreshItinerary } from '@motis-project/motis-client';
    import { MediaQuery } from 'svelte/reactivity';
    import { page } from '$app/state';
    import { Card } from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import Control from '$lib/map/Control.svelte';
    import { formatDate } from '$lib/toDateTime';
    import ConnectionDetail from '$lib/ConnectionDetail.svelte';
    import ItineraryGeoJson from '$lib/map/itineraries/ItineraryGeoJSON.svelte';
    import { language, t } from '$lib/i18n/translation';
    import StopGeoJSON from '$lib/map/stops/StopsGeoJSON.svelte';

    import { layout } from '$lib/layout.svelte';
    layout({ custom });

    const showMap = true; // FIXME
    const themeQuery = new MediaQuery('(prefers-color-scheme: dark)');
    const theme: 'light' | 'dark' = $derived(themeQuery.current ? 'dark' : 'light');
    let level = 10;

    // FIMXE
    let refreshLegAlternativeParams = $derived({
        transitModes: (transitModes.length == possibleTransitModes.length
            ? defaultQuery.transitModes
            : transitModes) as Mode[],
        pedestrianProfile,
        useRoutedTransfers,
        requireBikeTransport,
        requireCarTransport,
        noCompulsoryReservation,
        preTransitModes: prePostModesToModes(preTransitModes),
        postTransitModes: prePostModesToModes(postTransitModes),
        preTransitRentalFormFactors: getFormFactors(preTransitModes),
        postTransitRentalFormFactors: getFormFactors(postTransitModes),
        preTransitRentalProviderGroups: providerGroupsForQuery(
            preTransitModes,
            preTransitProviderGroups
        ),
        postTransitRentalProviderGroups: providerGroupsForQuery(
            postTransitModes,
            postTransitProviderGroups
        ),
        ignorePreTransitRentalReturnConstraints,
        ignorePostTransitRentalReturnConstraints,
        elevationCosts,
        cyclingSpeed,
        pedestrianSpeed,
        maxMatchingDistance: pedestrianProfile == 'WHEELCHAIR' ? 8 : 250,
        maxPreTransitTime,
        maxPostTransitTime
    });

    let refreshingItinerary = $state(false);
    const refreshSelectedItinerary = async () => {
        const itineraryId = page.state.selectedItinerary?.id;
        if (!itineraryId || refreshingItinerary) {
            return;
        }

        refreshingItinerary = true;
        try {
            const { data: refreshed, error } = await refreshItinerary({
                query: {
                    itineraryId,
                    joinInterlinedLegs: false,
                    detailedLegs: true,
                    detailedTransfers: true,
                    withFares: true,
                    numLegAlternatives: 3,
                    language: [language],
                    ...refreshLegAlternativeParams
                }
            });

            if (error) {
                console.log(error);
                alert(String((error as Record<string, unknown>).error?.toString() ?? error));
                return;
            }
            if (refreshed && page.state.selectedItinerary?.id === itineraryId) {
                updateItinerary(refreshed, from, to);
                replaceState('', {
                    ...page.state,
                    selectedItinerary: refreshed
                });
            }
        } catch (e) {
            console.log(e);
            alert(String(e));
        } finally {
            refreshingItinerary = false;
        }
    };
</script>

{#if page.state.selectedItinerary}
    <Control class="min-h-0 md:mb-2 md:flex">
        <Card class="w-[520px] bg-background rounded-lg  flex flex-col mb-2">
            <div class="w-full flex justify-between items-center shadow-md pl-1 mb-1">
                <div class="ml-2 flex items-baseline gap-2">
                    <h2 class="text-base font-semibold">{t.journeyDetails}</h2>
                    {#if page.state.selectedItinerary.legs.length > 0}
                        {@const firstLeg = page.state.selectedItinerary.legs[0]}
                        <span class="text-sm text-muted-foreground">
                            {formatDate(new Date(firstLeg.startTime), firstLeg.from.tz)}
                        </span>
                    {/if}
                </div>
                <div class="flex items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        title={t.refreshItinerary}
                        aria-label={t.refreshItinerary}
                        disabled={refreshingItinerary || !page.state.selectedItinerary.id}
                        onclick={refreshSelectedItinerary}
                    >
                        <RefreshCw class={refreshingItinerary ? 'animate-spin' : ''} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onclick={() => {
                            history.back();
                        }}
                    >
                        <X />
                    </Button>
                </div>
            </div>
            <div
                class={'p-2 md:p-4 overflow-y-auto overflow-x-hidden min-h-0 ' +
                    (showMap ? 'md:max-h-[60vh]' : '')}
            >
                <ConnectionDetail itinerary={page.state.selectedItinerary} />
            </div>
        </Card>
    </Control>
{/if}

{#snippet custom()}
    {#if page.state.selectedItinerary}
        <ItineraryGeoJson itinerary={page.state.selectedItinerary} selected={true} {level} {theme} />
        <StopGeoJSON itinerary={page.state.selectedItinerary} {theme} />
    {/if}
{/snippet}
