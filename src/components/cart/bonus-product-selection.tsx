/**
 * Copyright 2026 Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Cosmetic vertical override of the bonus-product carousel.
 *
 * Behavioural difference from canonical: each carousel tile's CTA is a 3-state toggle
 * (Pick → Adding… → Selected) instead of a one-shot "Select". Picking ADDS the bonus product;
 * clicking a Selected tile REMOVES it. Each tile owns its own fetcher so only the clicked tile shows
 * the pending label, and in-flight adds count toward the promotion's max so the remaining unselected
 * tiles disable immediately (optimistic max). Selection is derived from the live basket, so a failed
 * over-max add needs no manual rollback — the tile simply resolves back to "Pick".
 *
 * Visual chrome (cream card surface, radius, title layout, gift icon, compact "selected/max" count) is
 * supplied by `[data-slot="bonus-products-rail"]` rules in the cosmetic theme `base.css`; this component
 * preserves the `<section> → <h3>`(two spans)`→ carousel` structure those rules depend on.
 */
import { type ReactElement, type ReactNode, Suspense, useMemo, useEffect, useRef, useState } from 'react';
import { Await, useFetcher } from 'react-router';
import type { ShopperBasketsV2, ShopperProducts, ShopperSearch } from '@/scapi';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/toast';
import { getBonusProductCountsForPromotion } from '@/lib/cart/bonus-product-utils';
import { requiresVariantSelection, getPrimaryProductImageUrl, isRuleBasedPromotion } from '@/lib/product/product-utils';
import { getProductBadges } from '@/lib/product/product-badges';
import { useConfig } from '@salesforce/storefront-next-runtime/config';
import { toImageUrl } from '@/lib/images/dynamic-image';
import { resourceRoutes } from '@/route-paths';
import { uiConfig } from '../../lib/config.ui';

interface BonusProductSelectionProps {
    bonusDiscountLineItem: ShopperBasketsV2.schemas['BonusDiscountLineItem'];
    bonusProductsById: Record<string, ShopperProducts.schemas['Product']>;
    basket: ShopperBasketsV2.schemas['Basket'];
    promotionName?: string;
    /**
     * The full promotion (`name` + `calloutMsg`). Cosmetic uses `name` for the rail title and `calloutMsg`
     * for the max-reached notice; canonical ignores it (renders `promotionName`).
     */
    promotion?: { name?: string; calloutMsg?: string };
    /**
     * Loader-deferred map of `promotionId → ProductSearchHit[]` for rule-based bonus promotions.
     *
     * Promise reference is intentionally NOT pinned at the cart route — every cart-mutating revalidation produces a
     * fresh reference so rule-based search results stay aligned with the live basket. The component keeps its outer
     * shell mounted across those re-suspensions, while the `<Await>` lives inside a child `<Suspense>` so only the
     * carousel content re-suspends. Per-tile fetchers (see `BonusProductTile`) mean each tile's pending state is
     * self-contained; because selection is derived from the basket, a tile briefly unmounting on re-suspension loses
     * no state that needs to survive — the `pendingAdds` set that drives optimistic max lives on this outer component.
     */
    ruleBasedBonusProductsPromise?: Promise<Record<string, ShopperSearch.schemas['ProductSearchHit'][]>>;
    onProductSelect: (productId: string, productName: string, requiresModal: boolean) => void;
}

export default function BonusProductSelection({
    bonusDiscountLineItem,
    bonusProductsById,
    basket,
    promotionName,
    promotion,
    ruleBasedBonusProductsPromise,
    onProductSelect,
}: BonusProductSelectionProps): ReactElement {
    const { t } = useTranslation();

    // Check if this is a rule-based promotion
    const isRuleBased = isRuleBasedPromotion(bonusDiscountLineItem);

    const promotionId = bonusDiscountLineItem.promotionId || '';

    // Calculate selection counts
    const { selectedBonusItems, maxBonusItems } = getBonusProductCountsForPromotion(basket, promotionId);

    // Map of productId → basket itemId for products currently selected as bonus items under THIS promotion.
    // Mirrors the filter in getBonusProductCountsForPromotion: collect the promotion's bonus-discount-line-item
    // ids, then the basket product items flagged as bonus line items pointing at one of those ids. Keying by
    // productId lets each tile derive `isSelected`; the itemId is what a toggle-off submits to cart-item-remove.
    const selectionMap = useMemo<Map<string, string>>(() => {
        const map = new Map<string, string>();
        if (!promotionId) return map;

        const promotionLineItemIds = new Set(
            (basket.bonusDiscountLineItems || [])
                .filter((bli) => bli.promotionId === promotionId && bli.id)
                .map((bli) => bli.id as string)
        );
        if (promotionLineItemIds.size === 0) return map;

        for (const item of basket.productItems || []) {
            if (
                item.bonusProductLineItem === true &&
                item.bonusDiscountLineItemId &&
                promotionLineItemIds.has(item.bonusDiscountLineItemId) &&
                item.productId &&
                item.itemId
            ) {
                map.set(item.productId, item.itemId);
            }
        }
        return map;
    }, [basket.bonusDiscountLineItems, basket.productItems, promotionId]);

    // Tiles whose add request is currently in flight. Lifted here (not in the tile) so an in-flight add counts
    // toward the promotion's max immediately — that disables the remaining unselected tiles before the basket
    // revalidation lands, so the over-max race usually cannot start. Children report start/settle via callbacks.
    const [pendingAdds, setPendingAdds] = useState<Set<string>>(() => new Set());

    const onAddStart = (productId: string) =>
        setPendingAdds((prev) => {
            if (prev.has(productId)) return prev;
            const next = new Set(prev);
            next.add(productId);
            return next;
        });
    const onAddSettle = (productId: string) =>
        setPendingAdds((prev) => {
            if (!prev.has(productId)) return prev;
            const next = new Set(prev);
            next.delete(productId);
            return next;
        });

    // Defensively drop any pending entry whose add has already landed in the basket, so a tile that unmounts on
    // a rule-based re-suspension (before it can fire onAddSettle) can't leave the optimistic count permanently
    // inflated.
    const pendingAddCount = useMemo(() => {
        let count = 0;
        for (const productId of pendingAdds) {
            if (!selectionMap.has(productId)) count += 1;
        }
        return count;
    }, [pendingAdds, selectionMap]);

    // Guard `maxBonusItems > 0`: a promotion whose BLIs report 0/undefined max would otherwise make
    // `optimisticSelected (0) >= 0` true and disable every unselected tile, so nothing could be picked.
    const optimisticSelected = selectedBonusItems + pendingAddCount;
    const maxReached = maxBonusItems > 0 && optimisticSelected >= maxBonusItems;

    // Whether all bonus slots for this promotion are filled (basket-confirmed, not optimistic).
    const isMaxReached = maxBonusItems > 0 && selectedBonusItems >= maxBonusItems;

    // Build title. Prefer the shopper-facing `calloutMsg` — the promotion `name` is the admin/BM label and is
    // often just the promotion id (e.g. RefArch demo data), so it must not lead. BM callouts can contain HTML,
    // so strip tags for plain-text rendering.
    const titleText = stripHtml(promotion?.calloutMsg) || promotionName || t('cart:bonusProducts.defaultTitle');
    const titleSuffix = t('cart:bonusProducts.selectionCount', {
        selected: selectedBonusItems,
        max: maxBonusItems,
    });

    // List-based products are derived purely from props that come with the (already-resolved) basket,
    // so they're computed once at the outer component and reused across rule-based re-suspensions.
    const listBasedProducts = useMemo<DisplayProduct[]>(
        () =>
            bonusDiscountLineItem.bonusProducts
                ?.map((productLink) => {
                    const product = bonusProductsById[productLink.productId];
                    if (!product) return null;

                    return {
                        productId: productLink.productId,
                        productName: productLink.productName || product.name || 'Product',
                        imageAlt:
                            product.imageGroups?.[0]?.images?.[0]?.alt || productLink.productName || product.name || '',
                        imageUrl: getPrimaryProductImageUrl(product, 'large', product.variationValues),
                        product,
                    };
                })
                .filter((item): item is DisplayProduct => item !== null) || [],
        [bonusDiscountLineItem.bonusProducts, bonusProductsById]
    );

    const renderCarouselItem = (item: DisplayProduct): ReactElement => (
        <BonusProductTile
            key={item.productId}
            item={item}
            isSelected={selectionMap.has(item.productId)}
            selectedItemId={selectionMap.get(item.productId)}
            maxReached={maxReached}
            bonusDiscountLineItem={bonusDiscountLineItem}
            onProductSelect={onProductSelect}
            onAddStart={onAddStart}
            onAddSettle={onAddSettle}
        />
    );

    // The carousel body (which merges list + rule-based products) is the only subtree that depends on the rule-based
    // promise. Wrap just that subtree in <Suspense>/<Await> so the outer shell — and the `pendingAdds` state it owns —
    // stays mounted across loader revalidations that produce a fresh promise reference.
    const bonusPromotionId = bonusDiscountLineItem.promotionId;
    const carouselBody =
        isRuleBased && ruleBasedBonusProductsPromise && bonusPromotionId ? (
            <Suspense fallback={<BonusCarouselSkeleton />}>
                <RuleBasedBonusCarousel
                    promise={ruleBasedBonusProductsPromise}
                    promotionId={bonusPromotionId}
                    listBasedProducts={listBasedProducts}
                    renderItem={renderCarouselItem}
                />
            </Suspense>
        ) : (
            <BonusCarousel items={listBasedProducts} renderItem={renderCarouselItem} />
        );

    return (
        <section
            aria-label="Bonus Product Bundle"
            // Basket-confirmed max → cosmetic base.css swaps the title gift callout for the sparkles icon
            // (same condition as the FREE banner below, so they flip together and neither flickers on a
            // failed in-flight add).
            data-max-reached={isMaxReached ? '' : undefined}
            className="w-full overflow-hidden border border-border bg-[var(--bg-input-30)] p-4">
            <h3 className="text-base leading-6 text-card-foreground font-sans pb-3">
                <span className="font-semibold">{titleText}</span>
                {/* Keep the count span mounted even at max (render empty) so the cosmetic base.css
                    `:first-child`/`:last-child` title sizing stays stable — removing it would make the title
                    span match `:last-child` (the smaller count style) and shrink the header. The notice below
                    conveys completion once max is reached. */}
                <span className="font-normal">{isMaxReached ? '' : titleSuffix}</span>
            </h3>
            {carouselBody}
            {/* Max-reached notice. Gated on the BASKET-CONFIRMED count (not the optimistic `maxReached`) so an
                in-flight add that fails server-side can't flash this row in then out. */}
            {isMaxReached && (
                <div data-slot="bonus-max-reached" className="mt-3 flex items-center gap-2">
                    <Badge
                        variant="secondary"
                        className="bg-primary/10 text-primary uppercase font-semibold text-xs tracking-wide">
                        {t('cart:bonusProducts.maxReachedBadge', 'Free')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        {t('cart:bonusProducts.maxReachedText', 'Added to your bag — change any time before checkout.')}
                    </span>
                </div>
            )}
        </section>
    );
}

/**
 * Strip HTML tags from a promotion string (BM callouts/names can contain markup) and trim. Returns
 * `undefined` for empty/missing input so it composes with `||` fallbacks. Mirrors the tag-strip in
 * `getPromotionCalloutTextFromProduct`, but operates on a raw string.
 */
function stripHtml(value: string | undefined): string | undefined {
    const stripped = value?.replace(/<[^>]*>/g, '').trim();
    return stripped || undefined;
}

type DisplayProduct = {
    productId: string;
    productName: string;
    imageAlt: string;
    imageUrl: string | undefined;
    product: ShopperProducts.schemas['Product'];
};

/**
 * Resolve the cosmetic bonus-tile subtitle (a quantitative descriptor like "10 ml, 1 week supply").
 *
 * Source order, first non-empty wins, else `undefined` (the tile omits the subtitle row):
 *   1. the display `name` of the configured variation attribute's selected value (matched against
 *      `variationValues[attributeId]`), or its first value's `name` when no selection is recorded;
 *   2. `product.shortDescription`.
 *
 * The value `name` is merchant-authored free text in Business Manager and is rendered verbatim. Rule-based
 * bonus products (search hits cast to Product) carry neither variation attributes nor a short description,
 * so they resolve to `undefined` — by design.
 */
function getBonusTileSubtitle(product: ShopperProducts.schemas['Product'], attributeId: string): string | undefined {
    const attribute = product.variationAttributes?.find((attr) => attr.id === attributeId);
    if (attribute?.values?.length) {
        const selectedValue = product.variationValues?.[attributeId];
        // When a selection is recorded, use its value — but ONLY if it matches a known value. A recorded
        // value with no match (stale/mismatched master data) must NOT silently fall back to values[0], which
        // would render the wrong descriptor; fall through to shortDescription/omit instead. With no recorded
        // selection, the first value is a sensible representative.
        const value = selectedValue ? attribute.values.find((v) => v.value === selectedValue) : attribute.values[0];
        const name = value?.name?.trim();
        if (name) return name;
    }

    const shortDescription = product.shortDescription?.trim();
    return shortDescription || undefined;
}

/**
 * A single carousel tile. Owns its own `useFetcher` so its pending/disabled state and error toast are isolated from
 * the other tiles — picking one product no longer flashes "Adding…" on every tile (the canonical behaviour with a
 * single shared fetcher).
 */
function BonusProductTile({
    item,
    isSelected,
    selectedItemId,
    maxReached,
    bonusDiscountLineItem,
    onProductSelect,
    onAddStart,
    onAddSettle,
}: {
    item: DisplayProduct;
    isSelected: boolean;
    selectedItemId: string | undefined;
    maxReached: boolean;
    bonusDiscountLineItem: ShopperBasketsV2.schemas['BonusDiscountLineItem'];
    onProductSelect: (productId: string, productName: string, requiresModal: boolean) => void;
    onAddStart: (productId: string) => void;
    onAddSettle: (productId: string) => void;
}): ReactElement {
    const fetcher = useFetcher();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const config = useConfig();

    // Top-left "if available" badge: reuse the shared product-badge system (Sale/New/etc. from config +
    // c_ flags/promotions/stock). Recolored to the cosmetic secondary token below. Shows nothing when no
    // badge applies or for rule-based hits (which lack the badge-driving fields) — i.e. true "if available".
    const { badges } = getProductBadges({
        product: item.product as unknown as ShopperSearch.schemas['ProductSearchHit'],
        badgeDetails: config.global.badges,
        maxBadges: 1,
    });
    const topLeftBadge = badges[0];

    // Subtitle: the display name of the configured variation attribute's selected (or first) value —
    // merchant-authored free text, e.g. "10 ml, 1 week supply". Falls back to shortDescription, else omitted.
    const subtitle = getBonusTileSubtitle(item.product, uiConfig.bonusTile.subtitleVariationAttributeId);

    // Track processed fetcher data to fire the toast / settle the pending add exactly once per response.
    const processedDataRef = useRef<typeof fetcher.data>(null);

    useEffect(() => {
        if (fetcher.state === 'idle' && fetcher.data) {
            if (processedDataRef.current !== fetcher.data) {
                processedDataRef.current = fetcher.data;

                // The add (if any) has settled — clear the optimistic-max reservation for this tile. Harmless for a
                // remove (the productId won't be in the parent's pendingAdds set).
                onAddSettle(item.productId);

                // Only explicit failures toast. A successful remove returns a bare basket (no `success` field), so the
                // strict `=== false` check keeps it quiet; an over-max add fails with `{ success: false }` and toasts.
                if (fetcher.data.success === false) {
                    addToast(
                        t('product:bonusProducts.failedToAdd', {
                            error: fetcher.data.error?.message || t('product:unknownError'),
                        }),
                        'error'
                    );
                }
            }
        }
    }, [fetcher.state, fetcher.data, addToast, t, onAddSettle, item.productId]);

    const handleToggle = () => {
        if (isSelected) {
            // Toggle off: remove the basket line item. Submitting the concrete basket itemId is variant-safe.
            if (!selectedItemId) return;
            const formData = new FormData();
            formData.append('itemId', selectedItemId);
            void fetcher.submit(formData, {
                method: 'POST',
                action: resourceRoutes.cartItemRemove,
            });
            return;
        }

        if (requiresVariantSelection(item.product)) {
            // Open modal for variant selection — the add happens through the modal flow.
            onProductSelect(item.productId, item.productName, true);
            return;
        }

        // Validate required IDs before submission
        if (!bonusDiscountLineItem.id || !bonusDiscountLineItem.promotionId) {
            addToast(
                t('product:bonusProducts.failedToAdd', {
                    error: t('product:bonusProducts.missingRequiredInfo'),
                }),
                'error'
            );
            return;
        }

        // Direct add to cart for standard products
        const bonusItems = [
            {
                productId: item.productId,
                quantity: 1,
                bonusDiscountLineItemId: bonusDiscountLineItem.id,
                promotionId: bonusDiscountLineItem.promotionId,
            },
        ];

        const formData = new FormData();
        formData.append('bonusItems', JSON.stringify(bonusItems));

        onAddStart(item.productId);
        void fetcher.submit(formData, {
            method: 'POST',
            action: resourceRoutes.bonusProductAdd,
        });
    };

    // Pending spans the whole in-flight window (submit → revalidate) so the label doesn't flicker back to its resting
    // state before the basket-derived selection updates. A selected tile's in-flight op is always a REMOVE, so it
    // shows "Removing…" rather than the add-oriented "Adding…".
    const isPending = fetcher.state !== 'idle';
    const label = isPending
        ? isSelected
            ? t('cart:bonusProducts.ctaRemoving', 'Removing…')
            : t('cart:bonusProducts.ctaAdding', 'Adding…')
        : isSelected
          ? t('cart:bonusProducts.ctaSelected', 'Selected')
          : t('cart:bonusProducts.ctaPick', 'Pick');

    // TODO(variant-selection): `isSelected` keys on the carousel productId (the master id for
    // variant-requiring products), but the basket stores the chosen variant id — so a selected variant
    // may not flip its master tile to "Selected" and re-clicking re-opens the modal. Toggle-off is
    // variant-safe (it submits the concrete basket itemId); detection is not. Out of scope for this pass.

    // Compact tile sized with scale tokens: w-32 width, aspect-square image, content-driven height
    // (h-full lets all tiles in the row match the tallest so the CTA bottom-aligns via mt-auto). The
    // enclosing <li> in BonusCarousel provides list semantics, scroll-snap, and the React key.
    return (
        <article
            data-slot="bonus-product-tile"
            className="flex h-full w-32 shrink-0 flex-col gap-2 overflow-hidden rounded-xl border border-border bg-background p-2"
            aria-label="Bonus bundle product card">
            {/* Image with overlays */}
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                {item.imageUrl ? (
                    <img
                        src={toImageUrl({ src: item.imageUrl, config }) ?? item.imageUrl}
                        alt={item.imageAlt || item.productName || t('common:productImageAlt') || 'Product Image'}
                        loading="lazy"
                        className="size-full object-cover"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                        onLoad={(e) => {
                            // Clear any display:none left by a prior onError — React reuses this <img> across
                            // renders (keyed by productId on the <li>), so a later valid src must re-show it.
                            e.currentTarget.style.display = '';
                        }}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-muted-foreground text-xs">{t('common:noImageAvailable')}</span>
                    </div>
                )}

                {/* Top-left: optional product badge (uppercase, secondary token) */}
                {topLeftBadge && (
                    <Badge
                        variant="secondary"
                        className="absolute left-1 top-1 z-10 uppercase font-semibold text-xs tracking-wide">
                        {topLeftBadge.label}
                    </Badge>
                )}

                {/* Top-right: selected indicator — round checkmark colored like the selected CTA */}
                {isSelected && (
                    <span
                        data-testid="bonus-selected-check"
                        aria-hidden="true"
                        className="absolute right-1 top-1 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                    </span>
                )}
            </div>

            {/* Title + subtitle */}
            <div className="flex flex-col gap-0.5">
                <p className="text-xs font-medium leading-snug text-foreground line-clamp-2">{item.productName}</p>
                {subtitle && <p className="text-xs leading-tight text-muted-foreground">{subtitle}</p>}
            </div>

            {/* Toggle button: Pick → Adding… → Selected */}
            <Button
                className="mt-auto h-8 w-full text-xs"
                variant={isSelected ? 'default' : 'outline'}
                data-state={isSelected ? 'selected' : 'unselected'}
                aria-pressed={isSelected}
                onClick={handleToggle}
                disabled={isPending || (!isSelected && maxReached)}>
                {label}
            </Button>
        </article>
    );
}

function BonusCarousel({
    items,
    renderItem,
}: {
    items: DisplayProduct[];
    renderItem: (item: DisplayProduct) => ReactNode;
}): ReactElement {
    // Simple horizontal scroll-snap rail — no arrow controls; horizontal scroll + snap is the affordance.
    return (
        <ul role="list" className="flex gap-3 overflow-x-auto scroll-px-1 px-px py-1 [scroll-snap-type:x_mandatory]">
            {items.map((item) => (
                <li key={item.productId} className="[scroll-snap-align:start]">
                    {renderItem(item)}
                </li>
            ))}
        </ul>
    );
}

/**
 * Inner subtree that consumes the rule-based bonus product promise.
 *
 * The cart loader's `ruleBasedBonusProductsPromise` is intentionally NOT pinned at the route level — its results
 * depend on the live basket, so a cart mutation must produce a fresh promise. The enclosing `<Suspense>` re-suspends
 * back to the skeleton on each new promise, but only this subtree unmounts — the parent `<BonusProductSelection>`
 * (and the `pendingAdds` state it owns) stays mounted. Per-tile fetchers live inside the tiles here, but because
 * selection is derived from the basket and every add triggers a revalidation, a tile briefly unmounting carries no
 * pending state that must survive.
 */
function RuleBasedBonusCarousel({
    promise,
    promotionId,
    listBasedProducts,
    renderItem,
}: {
    promise: Promise<Record<string, ShopperSearch.schemas['ProductSearchHit'][]>>;
    promotionId: string;
    listBasedProducts: DisplayProduct[];
    renderItem: (item: DisplayProduct) => ReactNode;
}): ReactElement {
    return (
        <Await resolve={promise} errorElement={<BonusCarousel items={listBasedProducts} renderItem={renderItem} />}>
            {(ruleBasedByPromotionId: Record<string, ShopperSearch.schemas['ProductSearchHit'][]>) => {
                const hits = ruleBasedByPromotionId[promotionId] ?? [];
                const ruleBased = hits
                    .filter((hit) => hit.productId || hit.id)
                    .map<DisplayProduct>((hit) => {
                        const productId = (hit.productId || hit.id) as string;
                        return {
                            productId,
                            productName: hit.productName || 'Product',
                            imageAlt: hit.image?.alt || hit.productName || '',
                            imageUrl: hit.image?.disBaseLink ?? hit.image?.link ?? '',
                            product: hit as unknown as ShopperProducts.schemas['Product'],
                        };
                    });

                const all = [...listBasedProducts, ...ruleBased];
                // Deduplicate by productId — list-based wins because it appears first.
                const items = all.filter(
                    (item, index, self) => index === self.findIndex((p) => p.productId === item.productId)
                );
                return <BonusCarousel items={items} renderItem={renderItem} />;
            }}
        </Await>
    );
}

/**
 * Skeleton matching the compact tile layout (w-32 column, ~h-56 tall). Reserves space so the carousel doesn't cause
 * CLS when it streams in below the fold but within the initial viewport on small carts.
 */
function BonusCarouselSkeleton(): ReactElement {
    return (
        <div className="flex gap-3 overflow-x-auto px-px py-1" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-56 w-32 shrink-0 [--ui-radius:var(--radius-xl)]" />
            ))}
        </div>
    );
}
