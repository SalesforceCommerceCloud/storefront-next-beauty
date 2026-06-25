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
 * Cosmetic (Dazzle) per-page UI overrides:
 * - Hides the cart recommendation carousels — Dazzle's cart is a focused
 *   checkout-intent page with no below-the-fold cross-sell — which also skips
 *   the two Einstein recommendation fetches in the cart loader.
 * - Shows the category-page QuickFilters "Shop by {label}" header — Dazzle
 *   leads the subcategory chips with a labelled, sparkles-iconed prompt.
 *
 * Also configures the bonus-product carousel tile: `subtitleVariationAttributeId`
 * selects which variation attribute supplies the tile subtitle (the value's
 * display name, e.g. "10 ml, 1 week supply"). Default `size`; merchants can point
 * it at a custom variation attribute (e.g. `volume`) authored in Business Manager.
 *
 * This module shadows the canonical `@/lib/config.ui` and the mirror script
 * overlays (overwrites) the canonical file with this one in the flattened
 * artifact. It must therefore be self-contained — no import from the canonical
 * module (it won't exist post-flatten) — so the `UIConfig` shape is declared
 * inline here. Same self-contained pattern as the `@/lib/fonts` override.
 */
interface UIConfig {
    pages: {
        cart: {
            showRecommendations: boolean;
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
        },
        category: {
            showCategoryLabel: true,
        },
    },
    bonusTile: {
        subtitleVariationAttributeId: 'size',
    },
};
