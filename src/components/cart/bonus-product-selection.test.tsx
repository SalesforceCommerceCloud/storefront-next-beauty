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
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShopperBasketsV2, ShopperProducts } from '@/scapi';
import { type ActionFunctionArgs, createMemoryRouter, RouterProvider } from 'react-router';

// Relative import so the test exercises the cosmetic OVERRIDE, not the canonical component.
import BonusProductSelection from './bonus-product-selection';
import { getTranslation } from '@salesforce/storefront-next-runtime/i18n';
import { SiteProvider } from '@salesforce/storefront-next-runtime/site-context';
import { mockLocale, mockSiteObject } from '@/test-utils/config';

const mockSite = mockSiteObject;

// ============================================================================
// Mocks
// ============================================================================

// Real translations via the SDK helper. Cosmetic-only CTA keys (ctaPick/ctaAdding/ctaSelected) are
// referenced with the default-value t() form in the component, so the rendered labels are the English
// defaults ("Pick"/"Adding…"/"Selected") regardless of which vertical's resources are loaded.
vi.mock('react-i18next', () => ({
    useTranslation: () => {
        const { t } = getTranslation();
        return { t, i18n: { language: mockSiteObject.defaultLocale } };
    },
}));

const mockAddToast = vi.fn();
vi.mock('@/components/toast', () => ({
    useToast: vi.fn(() => ({ addToast: mockAddToast })),
}));

const mockRequiresVariantSelection = vi.fn();
const mockGetPrimaryProductImageUrl = vi.fn();
const mockIsRuleBasedPromotion = vi.fn();
vi.mock('@/lib/product/product-utils', () => ({
    requiresVariantSelection: (product: unknown) => mockRequiresVariantSelection(product),
    getPrimaryProductImageUrl: (product: unknown) => mockGetPrimaryProductImageUrl(product),
    isRuleBasedPromotion: (bonusItem: unknown) => mockIsRuleBasedPromotion(bonusItem),
}));

// `config.global.badges` drives the top-left tile badge; provide the Sale/New set (mirrors mockConfig).
vi.mock('@salesforce/storefront-next-runtime/config', () => ({
    useConfig: vi.fn(() => ({
        global: {
            badges: [
                { propertyName: 'c_isSale', label: 'Sale', color: 'orange', priority: 1 },
                { propertyName: 'c_isNew', label: 'New', color: 'green', priority: 2 },
            ],
        },
    })),
}));

// ============================================================================
// Fixtures
// ============================================================================

const PRODUCT_NAMES = ['Navy Tie', 'Red Tie', 'Black Tie'];

function buildFixture({
    count = 3,
    selectedIndices = [],
    maxBonusItems,
    subtitleByIndex = {},
    shortDescriptionByIndex = {},
    mismatchedSubtitleIndices = [],
    saleIndices = [],
}: {
    count?: number;
    selectedIndices?: number[];
    maxBonusItems?: number;
    /** index → variation value display name (rendered as the subtitle via a `size` attribute). */
    subtitleByIndex?: Record<number, string>;
    /** index → product.shortDescription (subtitle fallback). */
    shortDescriptionByIndex?: Record<number, string>;
    /** indices whose size attribute has a value list but variationValues points at a NON-matching value. */
    mismatchedSubtitleIndices?: number[];
    saleIndices?: number[];
} = {}) {
    const safe = Math.max(1, Math.min(count, PRODUCT_NAMES.length));
    const bonusProducts = Array.from({ length: safe }, (_, i) => ({
        productId: `product-${i + 1}`,
        productName: PRODUCT_NAMES[i],
    }));
    const bonusDiscountLineItem: ShopperBasketsV2.schemas['BonusDiscountLineItem'] = {
        id: 'bdli-1',
        promotionId: 'promo-1',
        maxBonusItems: maxBonusItems ?? safe,
        bonusProducts,
    };
    const bonusProductsById: Record<string, ShopperProducts.schemas['Product']> = Object.fromEntries(
        bonusProducts.map((p, i) => [
            p.productId,
            {
                id: p.productId,
                name: p.productName,
                imageGroups: [],
                ...(subtitleByIndex[i]
                    ? {
                          variationAttributes: [
                              { id: 'size', name: 'Size', values: [{ value: '010', name: subtitleByIndex[i] }] },
                          ],
                          variationValues: { size: '010' },
                      }
                    : {}),
                ...(mismatchedSubtitleIndices.includes(i)
                    ? {
                          // variationValues points at '999', which is NOT in the values list → no match.
                          variationAttributes: [
                              { id: 'size', name: 'Size', values: [{ value: '010', name: '10 ml' }] },
                          ],
                          variationValues: { size: '999' },
                      }
                    : {}),
                ...(shortDescriptionByIndex[i] ? { shortDescription: shortDescriptionByIndex[i] } : {}),
                ...(saleIndices.includes(i) ? { representedProduct: { id: p.productId, c_isSale: true } } : {}),
            } satisfies ShopperProducts.schemas['Product'],
        ])
    );
    const productItems: NonNullable<ShopperBasketsV2.schemas['Basket']['productItems']> = selectedIndices.map((i) => ({
        itemId: `bonus-item-${i + 1}`,
        productId: `product-${i + 1}`,
        productName: PRODUCT_NAMES[i],
        quantity: 1,
        bonusProductLineItem: true,
        bonusDiscountLineItemId: 'bdli-1',
    }));
    const basket: ShopperBasketsV2.schemas['Basket'] = {
        basketId: 'basket-1',
        productItems,
        bonusDiscountLineItems: [bonusDiscountLineItem],
    };
    return { bonusDiscountLineItem, bonusProductsById, basket };
}

// ============================================================================
// Controllable stub actions
// ============================================================================

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

let capturedAddBodies: string[];
let capturedRemoveItemIds: string[];
let addGate: ReturnType<typeof deferred<void>> | null;
let removeGate: ReturnType<typeof deferred<void>> | null;
let addResult: unknown;
let removeResult: unknown;
let onProductSelectSpy: ReturnType<
    typeof vi.fn<(productId: string, productName: string, requiresModal: boolean) => void>
>;

async function addAction({ request }: ActionFunctionArgs) {
    const fd = await request.formData();
    capturedAddBodies.push(String(fd.get('bonusItems')));
    if (addGate) await addGate.promise;
    return addResult;
}

async function removeAction({ request }: ActionFunctionArgs) {
    const fd = await request.formData();
    capturedRemoveItemIds.push(String(fd.get('itemId')));
    if (removeGate) await removeGate.promise;
    return removeResult;
}

function renderSelection(props: ReturnType<typeof buildFixture>, promotion?: { name?: string; calloutMsg?: string }) {
    const router = createMemoryRouter(
        [
            {
                path: '/',
                element: (
                    <SiteProvider
                        site={mockSite}
                        locale={mockLocale}
                        language={mockSiteObject.defaultLocale}
                        currency={mockSiteObject.defaultCurrency}>
                        <BonusProductSelection
                            bonusDiscountLineItem={props.bonusDiscountLineItem}
                            bonusProductsById={props.bonusProductsById}
                            basket={props.basket}
                            promotionName="Bonus ties"
                            promotion={promotion}
                            onProductSelect={onProductSelectSpy}
                        />
                    </SiteProvider>
                ),
            },
            { path: '/action/bonus-product-add', action: addAction },
            { path: '/action/cart-item-remove', action: removeAction },
        ],
        { initialEntries: ['/'] }
    );
    return render(<RouterProvider router={router} />);
}

/** Find a tile's card element by the product name rendered in it. */
function cardForProduct(name: string): HTMLElement {
    return screen.getByText(name).closest('[data-slot="bonus-product-tile"]') as HTMLElement;
}

/** Find a tile's toggle button by the product name rendered in the same card. */
function buttonForProduct(name: string): HTMLElement {
    return within(cardForProduct(name)).getByRole('button');
}

// ============================================================================
// Tests
// ============================================================================

describe('Cosmetic BonusProductSelection — 3-state toggle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedAddBodies = [];
        capturedRemoveItemIds = [];
        addGate = null;
        removeGate = null;
        addResult = { basketId: 'basket-1' };
        removeResult = { basketId: 'basket-1' };
        onProductSelectSpy = vi.fn<(productId: string, productName: string, requiresModal: boolean) => void>();
        mockRequiresVariantSelection.mockReturnValue(false);
        mockGetPrimaryProductImageUrl.mockReturnValue('');
        mockIsRuleBasedPromotion.mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ------------------------------------------------------------------------
    // Tile layout: image overlays + title/subtitle, no Free badge / price
    // ------------------------------------------------------------------------

    test('does not render a Free badge or a strikethrough price', async () => {
        renderSelection(buildFixture({ count: 2 }));
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());

        expect(screen.queryByText(/free/i)).not.toBeInTheDocument();
        // No line-through price node anywhere in the rendered tiles.
        expect(document.querySelector('.line-through')).toBeNull();
    });

    test('renders the subtitle verbatim from the configured size variation value name', async () => {
        renderSelection(buildFixture({ count: 2, subtitleByIndex: { 0: '10 ml, 1 week supply' } }));
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());

        expect(within(cardForProduct('Navy Tie')).getByText('10 ml, 1 week supply')).toBeInTheDocument();
        // The product without a size attribute or shortDescription shows no subtitle.
        expect(within(cardForProduct('Red Tie')).queryByText(/supply|ml/i)).not.toBeInTheDocument();
    });

    test('falls back to shortDescription when there is no size variation value', async () => {
        renderSelection(buildFixture({ count: 1, shortDescriptionByIndex: { 0: 'Silky, breathable knit' } }));
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());

        expect(within(cardForProduct('Navy Tie')).getByText('Silky, breathable knit')).toBeInTheDocument();
    });

    test('a recorded-but-unmatched size selection does NOT fall back to the first value name', async () => {
        // variationValues.size='999' has no matching value (values only has '010'/'10 ml'). The subtitle must
        // NOT show the wrong "10 ml"; it should fall through to shortDescription instead.
        renderSelection(
            buildFixture({ count: 1, mismatchedSubtitleIndices: [0], shortDescriptionByIndex: { 0: 'Silky knit' } })
        );
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());

        const card = cardForProduct('Navy Tie');
        expect(within(card).queryByText('10 ml')).not.toBeInTheDocument();
        expect(within(card).getByText('Silky knit')).toBeInTheDocument();
    });

    test('shows the round checkmark badge only on the selected tile', async () => {
        renderSelection(buildFixture({ count: 2, selectedIndices: [0], maxBonusItems: 2 }));
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());

        expect(within(cardForProduct('Navy Tie')).getByTestId('bonus-selected-check')).toBeInTheDocument();
        expect(within(cardForProduct('Red Tie')).queryByTestId('bonus-selected-check')).not.toBeInTheDocument();
    });

    test('renders the top-left secondary badge when getProductBadges yields one, absent otherwise', async () => {
        renderSelection(buildFixture({ count: 2, saleIndices: [0] }));
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());

        expect(within(cardForProduct('Navy Tie')).getByText(/^sale$/i)).toBeInTheDocument();
        expect(within(cardForProduct('Red Tie')).queryByText(/^sale$/i)).not.toBeInTheDocument();
    });

    test('shows the max-reached notice only when the basket-confirmed count hits max', async () => {
        // Below max: notice absent.
        const { container, unmount } = renderSelection(
            buildFixture({ count: 3, selectedIndices: [0], maxBonusItems: 3 })
        );
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        expect(container.querySelector('[data-slot="bonus-max-reached"]')).toBeNull();
        // The section's max-reached hook (drives the gift→sparkles icon swap in CSS) is also absent below max.
        expect(container.querySelector('section[data-max-reached]')).toBeNull();
        unmount();

        // At max (1 of 1 selected): notice present with the FREE badge, and the section carries the hook.
        const { container: maxContainer } = renderSelection(
            buildFixture({ count: 3, selectedIndices: [0], maxBonusItems: 1 })
        );
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        const notice = maxContainer.querySelector('[data-slot="bonus-max-reached"]') as HTMLElement;
        expect(notice).toBeTruthy();
        expect(within(notice).getByText(/^free$/i)).toBeInTheDocument();
        expect(maxContainer.querySelector('section[data-max-reached]')).toBeTruthy();
    });

    test('title uses the promotion calloutMsg, never the name (which can be the promotion id)', async () => {
        // Both present → title shows the shopper-facing calloutMsg, NOT the admin/id-ish name.
        const { unmount } = renderSelection(buildFixture({ count: 2 }), {
            name: 'ChoiceOfBonusProdect-ProductLevel',
            calloutMsg: "Buy one men's suit, get 2 free ties",
        });
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        expect(screen.getByText("Buy one men's suit, get 2 free ties")).toBeInTheDocument();
        expect(screen.queryByText('ChoiceOfBonusProdect-ProductLevel')).not.toBeInTheDocument();
        unmount();

        // calloutMsg can contain HTML → tags stripped.
        const { unmount: unmount2 } = renderSelection(buildFixture({ count: 2 }), {
            calloutMsg: '<strong>2 free ties</strong>',
        });
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        expect(screen.getByText('2 free ties')).toBeInTheDocument();
        unmount2();
    });

    test('empties the selection count once max is reached (span kept for stable title sizing)', async () => {
        // The count span is always mounted (so cosmetic base.css `:first-child`/`:last-child` title sizing
        // stays stable); only its text clears at max. Count text format is vertical-specific, so assert on
        // the second span's textContent rather than matching a string.
        const countSpan = (c: HTMLElement) => (c.querySelector('h3') as HTMLElement).querySelectorAll('span')[1];

        // Below max → count span has text.
        const { container, unmount } = renderSelection(
            buildFixture({ count: 3, selectedIndices: [0], maxBonusItems: 3 })
        );
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        expect(countSpan(container).textContent?.trim()).not.toBe('');
        unmount();

        // At max → count span is empty (but still present).
        const { container: c2 } = renderSelection(buildFixture({ count: 3, selectedIndices: [0], maxBonusItems: 1 }));
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        expect(countSpan(c2)).toBeTruthy();
        expect(countSpan(c2).textContent?.trim()).toBe('');
    });

    test('max-reached notice shows the static confirmation text (not the callout)', async () => {
        const { container } = renderSelection(buildFixture({ count: 3, selectedIndices: [0], maxBonusItems: 1 }), {
            name: 'ChoiceOfBonusProdect-ProductLevel',
            calloutMsg: "Buy one men's suit, get 2 free ties",
        });
        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        const notice = container.querySelector('[data-slot="bonus-max-reached"]') as HTMLElement;
        expect(within(notice).getByText(/added to your bag/i)).toBeInTheDocument();
        // The callout is the title, not the notice text.
        expect(within(notice).queryByText(/2 free ties/i)).not.toBeInTheDocument();
    });

    // ------------------------------------------------------------------------
    // Toggle behaviour (unchanged)
    // ------------------------------------------------------------------------

    test('renders Pick on unselected tiles and Selected on the in-basket tile', async () => {
        renderSelection(buildFixture({ count: 3, selectedIndices: [0], maxBonusItems: 3 }));

        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());

        const selected = buttonForProduct('Navy Tie');
        expect(selected).toHaveTextContent(/selected/i);
        expect(selected).toHaveAttribute('aria-pressed', 'true');
        expect(selected).toHaveAttribute('data-state', 'selected');

        expect(buttonForProduct('Red Tie')).toHaveTextContent(/pick/i);
        expect(buttonForProduct('Black Tie')).toHaveTextContent(/pick/i);
    });

    test('per-tile pending: only the clicked tile shows Adding… while others stay Pick', async () => {
        addGate = deferred<void>(); // keep the add in flight
        renderSelection(buildFixture({ count: 3, maxBonusItems: 3 }));

        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        await userEvent.click(buttonForProduct('Navy Tie'));

        await waitFor(() => expect(buttonForProduct('Navy Tie')).toHaveTextContent(/adding/i));
        expect(buttonForProduct('Navy Tie')).toBeDisabled();
        // Other tiles are untouched (max is 3, so no optimistic-max disabling here).
        expect(buttonForProduct('Red Tie')).toHaveTextContent(/pick/i);
        expect(buttonForProduct('Red Tie')).toBeEnabled();
        expect(buttonForProduct('Black Tie')).toHaveTextContent(/pick/i);

        addGate.resolve();
    });

    test('selected tile stays enabled at max while unselected tiles disable', async () => {
        renderSelection(buildFixture({ count: 3, selectedIndices: [0], maxBonusItems: 1 }));

        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());

        expect(buttonForProduct('Navy Tie')).toBeEnabled(); // selected → can toggle off
        expect(buttonForProduct('Red Tie')).toBeDisabled(); // unselected + max reached
        expect(buttonForProduct('Black Tie')).toBeDisabled();
    });

    test('optimistic max: an in-flight add disables the remaining unselected tiles immediately', async () => {
        addGate = deferred<void>(); // keep the add in flight so pendingAdds stays populated
        renderSelection(buildFixture({ count: 3, maxBonusItems: 1 }));

        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        // Before any click, all tiles are pickable.
        expect(buttonForProduct('Red Tie')).toBeEnabled();

        await userEvent.click(buttonForProduct('Navy Tie'));

        // The in-flight add counts toward max (1), so the others disable before the basket revalidates.
        await waitFor(() => expect(buttonForProduct('Red Tie')).toBeDisabled());
        expect(buttonForProduct('Black Tie')).toBeDisabled();

        addGate.resolve();
    });

    test('toggle-off submits the basket itemId to cart-item-remove', async () => {
        renderSelection(buildFixture({ count: 2, selectedIndices: [0], maxBonusItems: 2 }));

        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        await userEvent.click(buttonForProduct('Navy Tie')); // the Selected tile

        await waitFor(() => expect(capturedRemoveItemIds).toContain('bonus-item-1'));
        expect(capturedAddBodies).toHaveLength(0);
    });

    test('removing a selected tile shows "Removing…" (not "Adding…") while in flight', async () => {
        removeGate = deferred<void>(); // hold the remove in flight
        renderSelection(buildFixture({ count: 2, selectedIndices: [0], maxBonusItems: 2 }));

        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        await userEvent.click(buttonForProduct('Navy Tie')); // Selected → remove

        await waitFor(() => expect(buttonForProduct('Navy Tie')).toHaveTextContent(/removing/i));
        expect(buttonForProduct('Navy Tie')).not.toHaveTextContent(/adding/i);

        removeGate.resolve();
    });

    test('a successful remove (bare basket, no success field) does not toast', async () => {
        removeResult = { basketId: 'basket-1' }; // bare basket — no `success` key
        renderSelection(buildFixture({ count: 2, selectedIndices: [0], maxBonusItems: 2 }));

        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        await userEvent.click(buttonForProduct('Navy Tie'));

        // Wait for the remove to settle (button returns to Selected — basket prop is static).
        await waitFor(() => expect(capturedRemoveItemIds).toHaveLength(1));
        await waitFor(() => expect(buttonForProduct('Navy Tie')).toHaveTextContent(/selected/i));
        expect(mockAddToast).not.toHaveBeenCalled();
    });

    test('a failed add ({ success: false }) toasts and the tile falls back to Pick', async () => {
        addResult = { success: false, error: { message: 'Over max' } };
        renderSelection(buildFixture({ count: 2, maxBonusItems: 5 }));

        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        await userEvent.click(buttonForProduct('Navy Tie'));

        // The test i18n harness returns raw keys (no `{{error}}` interpolation), so assert on the toast
        // severity rather than the message text — the behaviour under test is "failed add → error toast".
        await waitFor(() => expect(mockAddToast).toHaveBeenCalledTimes(1));
        expect(mockAddToast).toHaveBeenCalledWith(expect.any(String), 'error');
        // Basket is unchanged, so the tile resolves back to Pick (no manual rollback needed).
        await waitFor(() => expect(buttonForProduct('Navy Tie')).toHaveTextContent(/pick/i));
    });

    test('variant-requiring product opens the modal instead of submitting', async () => {
        mockRequiresVariantSelection.mockReturnValue(true);
        renderSelection(buildFixture({ count: 2, maxBonusItems: 2 }));

        await waitFor(() => expect(screen.getByText('Navy Tie')).toBeInTheDocument());
        await userEvent.click(buttonForProduct('Navy Tie'));

        expect(onProductSelectSpy).toHaveBeenCalledWith('product-1', 'Navy Tie', true);
        expect(capturedAddBodies).toHaveLength(0);
        expect(capturedRemoveItemIds).toHaveLength(0);
    });
});
