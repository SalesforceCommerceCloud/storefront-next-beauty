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
 * Dazzle per-page UI overrides:
 * - Hides the cart recommendation carousels — the cart is a focused
 *   checkout-intent page with no below-the-fold cross-sell — which also skips
 *   the two Einstein recommendation fetches in the cart loader.
 * - Pares the cart line item (default variant) down to a minimal tile: hides the
 *   variation-attributes row, the strikethrough list price, the "Saved $X" promo
 *   badge, and the "Bonus Product" title badge, leaving image, title, current
 *   price, quantity, and the CTAs.
 * - Shows the category-page QuickFilters "Shop by {label}" header — the
 *   subcategory chips lead with a labelled, sparkles-iconed prompt.
 *
 * Also configures the bonus-product carousel tile: `subtitleVariationAttributeId`
 * selects which variation attribute supplies the tile subtitle (the value's
 * display name, e.g. "10 ml, 1 week supply"). Default `size`; merchants can point
 * it at a custom variation attribute (e.g. `volume`) authored in Business Manager.
 */
interface UIConfig {
    pages: {
        cart: {
            showRecommendations: boolean;
            showLineItemVariantAttributes: boolean;
            showLineItemListPrice: boolean;
            showLineItemPromoBadge: boolean;
            showLineItemBonusBadge: boolean;
        };
        category: {
            showCategoryLabel: boolean;
        };
    };
    bonusTile: {
        /** Variation-attribute id whose selected value name renders as the bonus tile subtitle. */
        subtitleVariationAttributeId: string;
    };
}

export const uiConfig: UIConfig = {
    pages: {
        cart: {
            showRecommendations: false,
            showLineItemVariantAttributes: false,
            showLineItemListPrice: false,
            showLineItemPromoBadge: false,
            showLineItemBonusBadge: false,
        },
        category: {
            showCategoryLabel: true,
        },
    },
    bonusTile: {
        subtitleVariationAttributeId: 'size',
    },
};
