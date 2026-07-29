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
import type { Meta, StoryObj } from '@storybook/react-vite';
// Relative import so the story exercises the cosmetic OVERRIDE under every VERTICAL — `@/components/...`
// would resolve to the canonical component under fashion and defeat the overlay snapshot/interaction tests.
import BonusProductSelection from '../bonus-product-selection';
import { action } from 'storybook/actions';
import { expect, within } from 'storybook/test';
import type { ShopperBasketsV2, ShopperProducts } from '@/scapi';
// Import the asset as a MODULE (not a runtime string) so Vite/Storybook resolves it via the
// vertical-public alias to a real bundled URL — a bare `/images/...` string bypasses that alias and
// 404s in the cosmetic-vertical Storybook (the file lives in verticals/cosmetic/public, not canonical
// public/). In snapshot tests the import is redirected to the asset mock, so output stays deterministic.
import sampleImage from '/images/black-cube-photo.svg';

// Reused for every tile so the carousel shows a real thumbnail; the square SVG suits the aspect-square slot.
const SAMPLE_IMAGE_GROUPS: ShopperProducts.schemas['Product']['imageGroups'] = [
    { viewType: 'large', images: [{ link: sampleImage, alt: 'Sample product' }] },
];

const TIE_COLOURS = ['Navy', 'Red', 'Black', 'Forest', 'Burgundy', 'Cream', 'Slate', 'Mustard'];
const TIE_PRICES = [29.0, 35.0, 42.0, 25.0, 39.0, 31.0, 45.0, 28.0];

// A `size` variation attribute whose value display name is a merchant-authored quantitative descriptor —
// this is what the tile subtitle renders verbatim.
const SIZE_VARIATION: ShopperProducts.schemas['VariationAttribute'] = {
    id: 'size',
    name: 'Size',
    values: [{ value: '010', name: '10 ml, 1 week supply' }],
};

/**
 * Synthesise a bonus fixture. `selectedIndices` marks products already in the basket as bonus line items for this
 * promotion (so the override renders them as "Selected"); `maxBonusItems` defaults to the product count.
 * `withSubtitle` adds a `size` variation attribute (subtitle source); `saleIndices` flags products with
 * `representedProduct.c_isSale` so the top-left "SALE" badge renders (mockConfig defines the Sale badge).
 */
function buildBonusFixture({
    count,
    selectedIndices = [],
    maxBonusItems,
    withSubtitle = false,
    saleIndices = [],
}: {
    count: number;
    selectedIndices?: number[];
    maxBonusItems?: number;
    withSubtitle?: boolean;
    saleIndices?: number[];
}) {
    const safe = Math.max(1, count);
    const productLinks = Array.from({ length: safe }, (_, i) => ({
        productId: `product-${i + 1}`,
        // Cycle the colour palette and suffix with the index so names stay unique past 8 products.
        productName: `Classic Silk Tie - ${TIE_COLOURS[i % TIE_COLOURS.length]} ${i + 1}`,
    }));
    const bonusDiscountLineItem: ShopperBasketsV2.schemas['BonusDiscountLineItem'] = {
        id: 'bdli-1',
        promotionId: 'promo-1',
        maxBonusItems: maxBonusItems ?? safe,
        bonusProducts: productLinks,
    };
    const bonusProductsById: Record<string, ShopperProducts.schemas['Product']> = Object.fromEntries(
        productLinks.map((link, i) => [
            link.productId,
            {
                id: link.productId,
                name: link.productName,
                price: TIE_PRICES[i % TIE_PRICES.length],
                imageGroups: SAMPLE_IMAGE_GROUPS,
                ...(withSubtitle ? { variationAttributes: [SIZE_VARIATION], variationValues: { size: '010' } } : {}),
                ...(saleIndices.includes(i) ? { representedProduct: { id: link.productId, c_isSale: true } } : {}),
            } satisfies ShopperProducts.schemas['Product'],
        ])
    );
    const productItems: NonNullable<ShopperBasketsV2.schemas['Basket']['productItems']> = selectedIndices.map((i) => ({
        itemId: `bonus-item-${i + 1}`,
        productId: `product-${i + 1}`,
        productName: `Classic Silk Tie - ${TIE_COLOURS[i % TIE_COLOURS.length]} ${i + 1}`,
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

const meta: Meta<typeof BonusProductSelection> = {
    title: 'Cart/Bonus Products/Bonus Product Selection',
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Cosmetic vertical override of the bonus-product carousel. Each tile CTA is a 3-state toggle: Pick (adds) → Adding… (in flight) → Selected (removes). Selected tiles stay enabled at max so they can be toggled off; unselected tiles disable once the optimistic max is reached.',
            },
        },
    },
    decorators: [
        (Story: React.ComponentType) => (
            <div className="max-w-[465px]">
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const PROMOTION_NAME = 'Buy one Classic Fit Shirt and get free ties';

// `name` here is the admin/BM label (often the promotion id, as in RefArch demo data) — it must NEVER show in
// the UI. `calloutMsg` is the shopper-facing string used for the title and the max-reached notice.
const PROMOTION = {
    name: 'ChoiceOfBonusProdect-ProductLevel',
    calloutMsg: "Buy one men's suit, get 2 free ties",
};

/** Resting state: nothing selected, every tile shows "Pick". Title shows the promotion name. */
export const Default: Story = {
    render: () => {
        const { bonusDiscountLineItem, bonusProductsById, basket } = buildBonusFixture({ count: 3 });
        return (
            <BonusProductSelection
                bonusDiscountLineItem={bonusDiscountLineItem}
                bonusProductsById={bonusProductsById}
                basket={basket}
                promotionName={PROMOTION_NAME}
                promotion={PROMOTION}
                onProductSelect={action('product-selected')}
            />
        );
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const pickButtons = await canvas.findAllByRole('button', { name: /pick/i });
        await expect(pickButtons.length).toBe(3);
        for (const button of pickButtons) {
            await expect(button).toHaveAttribute('aria-pressed', 'false');
            await expect(button).toHaveAttribute('data-state', 'unselected');
            await expect(button).toBeEnabled();
        }
        // Title uses the shopper-facing calloutMsg (NOT the id-ish name), paired with the gift icon.
        await expect(canvas.getByText(PROMOTION.calloutMsg)).toBeInTheDocument();
        await expect(canvas.queryByText(PROMOTION.name)).not.toBeInTheDocument();
        // Nothing selected → no max-reached notice.
        await expect(canvasElement.querySelector('[data-slot="bonus-max-reached"]')).toBeNull();
        await expect(canvasElement.querySelector('section[data-max-reached]')).toBeNull();
    },
};

/**
 * One product already in the basket — its tile reads "Selected" and shows the round checkmark badge.
 * Products carry a `size` subtitle ("10 ml, 1 week supply") and the first is flagged on sale so the
 * top-left "SALE" badge renders.
 */
export const WithSelected: Story = {
    render: () => {
        const { bonusDiscountLineItem, bonusProductsById, basket } = buildBonusFixture({
            count: 3,
            selectedIndices: [0],
            maxBonusItems: 3,
            withSubtitle: true,
            saleIndices: [0],
        });
        return (
            <BonusProductSelection
                bonusDiscountLineItem={bonusDiscountLineItem}
                bonusProductsById={bonusProductsById}
                basket={basket}
                promotionName={PROMOTION_NAME}
                promotion={PROMOTION}
                onProductSelect={action('product-selected')}
            />
        );
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const selectedButton = await canvas.findByRole('button', { name: /selected/i });
        await expect(selectedButton).toHaveAttribute('aria-pressed', 'true');
        await expect(selectedButton).toHaveAttribute('data-state', 'selected');
        await expect(selectedButton).toBeEnabled();

        const pickButtons = canvas.getAllByRole('button', { name: /pick/i });
        await expect(pickButtons.length).toBe(2);

        // Selected tile shows the round checkmark badge.
        const checks = canvasElement.querySelectorAll('[data-testid="bonus-selected-check"]');
        await expect(checks.length).toBe(1);

        // Subtitle renders the variation value name verbatim.
        await expect(canvas.getAllByText('10 ml, 1 week supply').length).toBe(3);

        // Top-left "SALE" badge renders for the flagged product.
        await expect(canvas.getByText(/^sale$/i)).toBeInTheDocument();
        // Below max (1 of 3 selected) → no max-reached notice.
        await expect(canvasElement.querySelector('[data-slot="bonus-max-reached"]')).toBeNull();
    },
};

/**
 * Max reached (1 of 1 selected): the selected tile stays enabled to toggle off; unselected tiles disable.
 * The title still shows the promotion name; the section gains `data-max-reached` (→ sparkles icon via CSS)
 * and the notice renders the promotion's bonus `calloutMsg`.
 */
export const AtMax: Story = {
    render: () => {
        const { bonusDiscountLineItem, bonusProductsById, basket } = buildBonusFixture({
            count: 3,
            selectedIndices: [0],
            maxBonusItems: 1,
        });
        return (
            <BonusProductSelection
                bonusDiscountLineItem={bonusDiscountLineItem}
                bonusProductsById={bonusProductsById}
                basket={basket}
                promotionName={PROMOTION_NAME}
                promotion={PROMOTION}
                onProductSelect={action('product-selected')}
            />
        );
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const selectedButton = await canvas.findByRole('button', { name: /selected/i });
        await expect(selectedButton).toBeEnabled();

        const pickButtons = canvas.getAllByRole('button', { name: /pick/i });
        await expect(pickButtons.length).toBe(2);
        for (const button of pickButtons) {
            await expect(button).toBeDisabled();
        }
        // Title shows the shopper callout; the id-ish promotion name never shows; the n/m count is hidden at max.
        const heading = canvasElement.querySelector('h3') as HTMLElement;
        await expect(within(heading).getByText(PROMOTION.calloutMsg)).toBeInTheDocument();
        await expect(canvas.queryByText(PROMOTION.name)).not.toBeInTheDocument();
        await expect(within(heading).queryByText(/\d\/\d/)).not.toBeInTheDocument();
        // Section carries the max-reached hook (drives the gift→sparkles icon swap in CSS).
        await expect(canvasElement.querySelector('section[data-max-reached]')).toBeTruthy();
        // Max-reached notice renders with the FREE badge and the static confirmation text.
        const notice = canvasElement.querySelector('[data-slot="bonus-max-reached"]') as HTMLElement;
        await expect(notice).toBeTruthy();
        await expect(within(notice).getByText(/^free$/i)).toBeInTheDocument();
        await expect(within(notice).getByText(/added to your bag/i)).toBeInTheDocument();
    },
};

/**
 * Many products (12) with a high max, so every tile is pickable. Demonstrates the horizontal scroll-snap
 * rail: the tiles overflow the panel width and scroll sideways (no arrow controls). Subtitles + a couple of
 * SALE badges are included so the scrolled tiles look realistic.
 */
export const Scrollable: Story = {
    render: () => {
        const { bonusDiscountLineItem, bonusProductsById, basket } = buildBonusFixture({
            count: 12,
            maxBonusItems: 12,
            withSubtitle: true,
            saleIndices: [1, 5, 9],
        });
        return (
            <BonusProductSelection
                bonusDiscountLineItem={bonusDiscountLineItem}
                bonusProductsById={bonusProductsById}
                basket={basket}
                promotionName={PROMOTION_NAME}
                onProductSelect={action('product-selected')}
            />
        );
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // All 12 tiles render and are pickable.
        const pickButtons = await canvas.findAllByRole('button', { name: /pick/i });
        await expect(pickButtons.length).toBe(12);

        // The rail overflows its container horizontally (scrollWidth > clientWidth), proving it scrolls.
        const rail = canvasElement.querySelector('ul[role="list"]') as HTMLElement;
        await expect(rail).toBeTruthy();
        await expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth);
    },
};
