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
import { useEffect, useState } from 'react';
import { action } from 'storybook/actions';
import { expect, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import type { ShopperProducts } from '@/scapi';
import ProductBottomBar from './product-bottom-bar';
import ProductViewProvider from '@/providers/product-view';
import { ConfigProvider } from '@salesforce/storefront-next-runtime/config';
import { SiteProvider } from '@salesforce/storefront-next-runtime/site-context';
import { mockConfig, mockLocale, mockSiteObject } from '@/test-utils/config';

/**
 * ProductBottomBar is a fixed bottom bar that appears on mobile when the main
 * Add to Cart button scrolls out of view. It provides quick access to product
 * info and purchase actions without scrolling back up.
 *
 * Key behaviors:
 * - Uses IntersectionObserver to detect main button visibility
 * - Slides up from bottom when button is not in viewport
 * - Includes product image, name, price, and Add to Cart button
 * - Supports iOS safe area insets
 * - Sets body data attribute for page padding adjustment
 */
const meta: Meta<typeof ProductBottomBar> = {
    title: 'Products/Product Bottom Bar',
    component: ProductBottomBar,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component: `
The Product Bottom Bar is a mobile-optimized fixed component that provides persistent access to product information and the Add to Cart button.

**Features:**
- **Scroll-triggered visibility**: Appears when main Add to Cart button scrolls out of view
- **Product snapshot**: Shows product image, name, and current price
- **Action buttons**: Duplicate Add to Cart functionality for easy access
- **Safe area support**: Respects iOS safe area insets for notched devices
- **Body padding coordination**: Sets data attribute to adjust page padding when visible

**Usage Context:**
This component is rendered at the bottom of product detail pages in the cosmetic vertical. It enhances mobile UX by keeping purchase actions accessible during long product descriptions or review sections.
                `,
            },
        },
    },
    decorators: [
        (Story: React.ComponentType, context) => {
            const product = context.args.product || createMockProduct();

            // Log interactions
            useEffect(() => {
                const handleClick = (e: MouseEvent) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[data-slot="product-bottom-bar"]')) {
                        const label =
                            target.getAttribute('aria-label') ||
                            target.textContent?.trim() ||
                            target.tagName.toLowerCase();
                        action('bottom-bar-interaction')({ label });
                    }
                };

                document.addEventListener('click', handleClick);
                return () => document.removeEventListener('click', handleClick);
            }, []);

            // Use the global router provided by withRouter decorator
            // No need to create a new RouterProvider here
            return (
                <ConfigProvider config={mockConfig}>
                    <SiteProvider
                        site={mockSiteObject}
                        locale={mockLocale}
                        language={mockSiteObject.defaultLocale}
                        currency={mockSiteObject.defaultCurrency}>
                        <ProductViewProvider product={product} mode="add">
                            <div className="min-h-screen bg-background">
                                <Story />
                            </div>
                        </ProductViewProvider>
                    </SiteProvider>
                </ConfigProvider>
            );
        },
    ],
    argTypes: {
        product: {
            description: 'Product data to display in the bottom bar',
            control: false,
        },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Helper to create mock product
const createMockProduct = (
    overrides?: Partial<ShopperProducts.schemas['Product']>
): ShopperProducts.schemas['Product'] => ({
    id: 'cosmetic-product-123',
    name: 'Radiant Glow Serum',
    currency: 'USD',
    price: 49.99,
    imageGroups: [
        {
            viewType: 'large',
            images: [
                {
                    link: 'https://via.placeholder.com/400x400/F4F0E4/2D1F24?text=Radiant+Glow+Serum',
                    alt: 'Radiant Glow Serum',
                },
            ],
        },
    ],
    ...overrides,
});

// Interactive demo component
function InteractiveDemo() {
    const [isVisible, setIsVisible] = useState(false);
    const product = createMockProduct();

    // Mock the IntersectionObserver behavior for demo
    useEffect(() => {
        const mainButton = document.querySelector('[data-slot="add-to-cart-button"]');
        if (!mainButton) return;

        // Simulate observer — toggle visibility classes on the bottom bar
        const bottomBar = document.querySelector('[data-slot="product-bottom-bar"]') as HTMLElement;
        if (bottomBar) {
            if (isVisible) {
                bottomBar.classList.remove('translate-y-full');
                bottomBar.classList.add('translate-y-0');
            } else {
                bottomBar.classList.add('translate-y-full');
                bottomBar.classList.remove('translate-y-0');
            }
        }
    }, [isVisible]);

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-2xl mx-auto space-y-8">
                <h1 className="text-3xl font-bold">{product.name}</h1>

                <div className="flex justify-center gap-4">
                    <button
                        type="button"
                        onClick={() => setIsVisible(!isVisible)}
                        className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                        {isVisible ? 'Hide' : 'Show'} Bottom Bar
                    </button>
                    <button
                        type="button"
                        data-testid="add-to-cart"
                        data-slot="add-to-cart-button"
                        className="px-6 py-3 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90">
                        Main Add to Cart (Observed)
                    </button>
                </div>

                {/* Spacer content */}
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        This story demonstrates the bottom bar&apos;s visibility toggle. In the real implementation, the
                        bar automatically appears when the main &quot;Add to Cart&quot; button scrolls out of view.
                    </p>
                    <div className="h-[800px] bg-muted/20 rounded-lg flex items-center justify-center">
                        <p className="text-muted-foreground">Long product description content would go here</p>
                    </div>
                </div>
            </div>

            <ProductBottomBar product={product} />
        </div>
    );
}

/**
 * Simulates scroll behavior with a button you can toggle to show/hide the bottom bar.
 * In real usage, the IntersectionObserver watches the main Add to Cart button.
 */
export const Interactive: Story = {
    render: () => <InteractiveDemo />,
    parameters: {
        docs: {
            description: {
                story: 'Interactive demo showing the bottom bar visibility toggle. Click "Show Bottom Bar" to slide the component up from the bottom.',
            },
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);

        // Verify bottom bar exists
        const bottomBar = canvasElement.querySelector('[data-slot="product-bottom-bar"]');
        await expect(bottomBar).toBeInTheDocument();

        // Verify initial hidden state
        await expect(bottomBar).toHaveClass('translate-y-full');
    },
};

/**
 * Shows the bottom bar in its visible state with product information.
 */
export const Visible: Story = {
    render: () => {
        const product = createMockProduct();

        return (
            <div className="min-h-screen p-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8">{product.name}</h1>
                    <button type="button" data-testid="add-to-cart" data-slot="add-to-cart-button" className="hidden">
                        Main Button
                    </button>
                </div>
                <ProductBottomBar product={product} />
            </div>
        );
    },
    parameters: {
        docs: {
            description: {
                story: 'Bottom bar in visible state showing product image, name, price, and Add to Cart button.',
            },
        },
        viewport: {
            defaultViewport: 'mobile1',
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);

        // Scope queries to the bottom bar to avoid duplicate text in page heading
        const bottomBar = canvasElement.querySelector('[data-slot="product-bottom-bar"]');
        await expect(bottomBar).toBeInTheDocument();

        const canvas = within(bottomBar as HTMLElement);

        // Check product name within bottom bar (using the truncate class to be specific)
        const productName = bottomBar?.querySelector('.truncate');
        await expect(productName).toHaveTextContent('Radiant Glow Serum');

        // Check Add to Cart button within bottom bar
        await expect(canvas.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
    },
};

/**
 * Bottom bar with a product on sale showing discounted price.
 */
export const WithSalePrice: Story = {
    render: () => {
        const product = createMockProduct({
            price: 34.99,
            priceMax: 49.99,
        });

        return (
            <div className="min-h-screen p-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8">{product.name}</h1>
                    <button type="button" data-testid="add-to-cart" data-slot="add-to-cart-button" className="hidden">
                        Main Button
                    </button>
                </div>
                <ProductBottomBar product={product} />
            </div>
        );
    },
    parameters: {
        docs: {
            description: {
                story: 'Product with sale pricing shows the discounted price in the bottom bar.',
            },
        },
        viewport: {
            defaultViewport: 'mobile1',
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);

        // Scope queries to the bottom bar to avoid duplicate text elements
        const bottomBar = canvasElement.querySelector('[data-slot="product-bottom-bar"]');
        await expect(bottomBar).toBeInTheDocument();

        // Just verify bottom bar exists and has the expected structure
        // Price display has multiple aria-live regions, so avoid text-based queries
        const priceElement = bottomBar?.querySelector('.text-muted-foreground');
        await expect(priceElement).toBeTruthy();
    },
};

/**
 * Long product name to test text truncation.
 */
export const LongProductName: Story = {
    render: () => {
        const product = createMockProduct({
            name: 'Ultra Premium Hydrating Anti-Aging Radiant Glow Vitamin C Brightening Serum with Hyaluronic Acid',
        });

        return (
            <div className="min-h-screen p-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8">{product.name}</h1>
                    <button type="button" data-testid="add-to-cart" data-slot="add-to-cart-button" className="hidden">
                        Main Button
                    </button>
                </div>
                <ProductBottomBar product={product} />
            </div>
        );
    },
    parameters: {
        docs: {
            description: {
                story: 'Long product names are truncated to prevent layout overflow.',
            },
        },
        viewport: {
            defaultViewport: 'mobile1',
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);

        // Verify text truncation is applied
        const bottomBar = canvasElement.querySelector('[data-slot="product-bottom-bar"]');
        await expect(bottomBar).toBeInTheDocument();

        const productName = bottomBar?.querySelector('p.truncate');
        await expect(productName).toBeTruthy();
        await expect(productName).toHaveClass('truncate');
    },
};

/**
 * Mobile viewport demonstration showing the bottom bar is hidden above md breakpoint.
 */
export const ResponsiveVisibility: Story = {
    render: () => {
        const product = createMockProduct();

        return (
            <div className="min-h-screen p-6">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-muted p-4 rounded-md mb-8">
                        <p className="text-sm">
                            <strong>Note:</strong> This component is hidden on desktop (md and above). Switch to mobile
                            viewport in Storybook to see it.
                        </p>
                    </div>
                    <h1 className="text-3xl font-bold mb-8">{product.name}</h1>
                    <button type="button" data-testid="add-to-cart" data-slot="add-to-cart-button" className="hidden">
                        Main Button
                    </button>
                </div>
                <ProductBottomBar product={product} />
            </div>
        );
    },
    parameters: {
        docs: {
            description: {
                story: 'The bottom bar is mobile-only and hidden on desktop viewports (≥768px).',
            },
        },
        viewport: {
            defaultViewport: 'mobile1',
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);

        const bottomBar = canvasElement.querySelector('[data-slot="product-bottom-bar"]');
        await expect(bottomBar).toBeInTheDocument();

        // Verify it has fixed positioning (core mobile layout)
        await expect(bottomBar).toHaveClass('fixed');
        await expect(bottomBar).toHaveClass('bottom-0');
    },
};
