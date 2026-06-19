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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import ProductBottomBar from './product-bottom-bar';
import type { ShopperProducts } from '@/scapi';

// Mock dependencies
vi.mock('@/hooks/product/use-product-images', () => ({
    useProductImages: vi.fn(() => ({
        galleryImages: [
            {
                src: 'https://example.com/image.jpg',
                alt: 'Test Product',
                thumbSrc: 'https://example.com/thumb.jpg',
            },
        ],
    })),
}));

vi.mock('@/hooks/product/use-selected-variations', () => ({
    useSelectedVariations: vi.fn(() => ({})),
}));

vi.mock('@/hooks/product/use-current-variant', () => ({
    useCurrentVariant: () => null,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                addToCart: 'Add to Cart',
                addingToCart: 'Adding...',
            };
            return translations[key] || key;
        },
        i18n: {
            language: 'en-US',
        },
    }),
}));

vi.mock('@salesforce/storefront-next-runtime/config', () => ({
    useConfig: vi.fn(() => ({
        engagement: {
            adapters: {
                einstein: { enabled: true },
            },
        },
    })),
}));

vi.mock('@salesforce/storefront-next-runtime/site-context', async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
        ...actual,
        useSite: vi.fn(() => ({
            site: { id: 'test-site', defaultLocale: 'en-US' },
            language: 'en-US',
            currency: 'USD',
        })),
    };
});

vi.mock('@/hooks/use-analytics', () => ({
    useAnalytics: vi.fn(() => ({
        trackCartItemAdd: vi.fn(),
    })),
}));

vi.mock('@/providers/basket', () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
    useBasket: () => ({ basket: null }),
}));

vi.mock('@/hooks/product/use-product-actions', () => ({
    useProductActions: vi.fn(() => ({
        handleAddToCart: vi.fn(),
        handleUpdateCart: vi.fn(),
        isAddingToOrUpdatingCart: false,
        canAddToCart: true,
        mode: 'add',
        isMasterOrVariantProduct: false,
        handleAddToWishlist: vi.fn(),
    })),
}));

vi.mock('@/providers/product-view', () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
    useProductView: vi.fn(() => ({
        handleAddToCart: vi.fn(),
        handleUpdateCart: vi.fn(),
        isAddingToOrUpdatingCart: false,
        canAddToCart: true,
        mode: 'add',
        isMasterOrVariantProduct: false,
        handleAddToWishlist: vi.fn(),
    })),
}));

const mockProduct: ShopperProducts.schemas['Product'] = {
    id: 'test-product',
    name: 'Test Product',
    currency: 'USD',
    price: 29.99,
    imageGroups: [
        {
            viewType: 'large',
            images: [
                {
                    link: 'https://example.com/image.jpg',
                    alt: 'Test Product',
                },
            ],
        },
    ],
};

describe('ProductBottomBar', () => {
    let intersectionObserverCallback: IntersectionObserverCallback;
    let mockObserve: ReturnType<typeof vi.fn>;
    let mockDisconnect: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // Mock IntersectionObserver
        mockObserve = vi.fn();
        mockDisconnect = vi.fn();

        global.IntersectionObserver = class {
            constructor(callback: IntersectionObserverCallback) {
                intersectionObserverCallback = callback;
            }
            observe = mockObserve;
            disconnect = mockDisconnect;
            unobserve = vi.fn();
            takeRecords = vi.fn();
            root = null;
            rootMargin = '';
            thresholds = [];
        } as any;

        // Spy on the constructor
        vi.spyOn(global, 'IntersectionObserver');

        // Mock querySelector for main button - store as variable to satisfy linter
        const mockQuerySelectorFn = vi.fn((selector: string) => {
            if (selector === '[data-slot="add-to-cart-button"]') {
                return document.createElement('button');
            }
            return null;
        });
        document.querySelector = mockQuerySelectorFn as any;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(<ProductBottomBar product={mockProduct} />);
    };

    describe('Rendering', () => {
        test('renders product information', () => {
            renderComponent();

            expect(screen.getByText('Test Product')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
        });

        test('renders product image with correct attributes', () => {
            const { container } = renderComponent();

            const image = screen.getByRole('img', { name: 'Test Product' });
            expect(image).toBeInTheDocument();

            // Check that the image is inside a container with hidden and md:block classes
            const imageContainer = container.querySelector('.hidden.md\\:block');
            expect(imageContainer).toBeInTheDocument();
        });

        test('has correct data-slot attribute', () => {
            const { container } = renderComponent();
            const bottomBar = container.querySelector('[data-slot="product-bottom-bar"]');
            expect(bottomBar).toBeInTheDocument();
        });

        test('is initially hidden with translate-y-full', () => {
            const { container } = renderComponent();
            const bottomBar = container.querySelector('[data-slot="product-bottom-bar"]');
            expect(bottomBar).toHaveClass('translate-y-full');
        });
    });

    describe('IntersectionObserver', () => {
        test('sets up IntersectionObserver on mount', () => {
            renderComponent();

            expect(global.IntersectionObserver).toHaveBeenCalled();
            expect(mockObserve).toHaveBeenCalled();
        });

        test('observes the main add-to-cart button', () => {
            renderComponent();

            // eslint-disable-next-line @typescript-eslint/unbound-method -- test fixture
            const mockQuerySelector = document.querySelector as ReturnType<typeof vi.fn>;
            expect(mockQuerySelector).toHaveBeenCalledWith('[data-slot="add-to-cart-button"]');
            expect(mockObserve).toHaveBeenCalled();
        });

        test('shows bottom bar when main button is not intersecting', async () => {
            const { container } = renderComponent();

            // Simulate main button scrolling out of view
            act(() => {
                intersectionObserverCallback(
                    [{ isIntersecting: false } as IntersectionObserverEntry],
                    {} as IntersectionObserver
                );
            });

            await waitFor(() => {
                const bottomBar = container.querySelector('[data-slot="product-bottom-bar"]');
                expect(bottomBar).toHaveClass('translate-y-0');
                expect(bottomBar).not.toHaveClass('translate-y-full');
            });
        });

        test('hides bottom bar when main button is intersecting', async () => {
            const { container } = renderComponent();

            // First make it visible
            act(() => {
                intersectionObserverCallback(
                    [{ isIntersecting: false } as IntersectionObserverEntry],
                    {} as IntersectionObserver
                );
            });

            // Then hide it
            act(() => {
                intersectionObserverCallback(
                    [{ isIntersecting: true } as IntersectionObserverEntry],
                    {} as IntersectionObserver
                );
            });

            await waitFor(() => {
                const bottomBar = container.querySelector('[data-slot="product-bottom-bar"]');
                expect(bottomBar).toHaveClass('translate-y-full');
            });
        });

        test('shows bottom bar when main button is not visible', async () => {
            const { container } = renderComponent();

            act(() => {
                intersectionObserverCallback(
                    [{ isIntersecting: false } as IntersectionObserverEntry],
                    {} as IntersectionObserver
                );
            });

            await waitFor(() => {
                const bar = container.querySelector('[data-slot="product-bottom-bar"]');
                expect(bar).toHaveClass('translate-y-0');
            });
        });

        test('hides bottom bar when main button becomes visible again', async () => {
            const { container } = renderComponent();

            // Make visible
            act(() => {
                intersectionObserverCallback(
                    [{ isIntersecting: false } as IntersectionObserverEntry],
                    {} as IntersectionObserver
                );
            });

            // Make hidden
            act(() => {
                intersectionObserverCallback(
                    [{ isIntersecting: true } as IntersectionObserverEntry],
                    {} as IntersectionObserver
                );
            });

            await waitFor(() => {
                const bar = container.querySelector('[data-slot="product-bottom-bar"]');
                expect(bar).toHaveClass('translate-y-full');
            });
        });

        test('does not set up observer if main button is not found', () => {
            document.querySelector = vi.fn(() => null);

            renderComponent();

            expect(global.IntersectionObserver).not.toHaveBeenCalled();
            expect(mockObserve).not.toHaveBeenCalled();
        });
    });

    describe('Add to Cart Button', () => {
        test('button has correct styling classes', () => {
            renderComponent();

            const button = screen.getByRole('button', { name: /add to cart/i });
            expect(button).toHaveClass('text-base', 'font-semibold', 'leading-6');
        });

        test('button shows "Add to Cart" text by default', () => {
            renderComponent();

            expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
        });

        test('button is enabled when canAddToCart is true', () => {
            renderComponent();

            const button = screen.getByRole('button', { name: /add to cart/i });
            expect(button).not.toBeDisabled();
        });
    });

    describe('Cleanup', () => {
        test('disconnects observer on unmount', () => {
            const { unmount } = renderComponent();

            unmount();

            expect(mockDisconnect).toHaveBeenCalled();
        });

        test('bottom bar is removed from DOM on unmount', () => {
            const { unmount } = renderComponent();

            unmount();

            expect(document.querySelector('[data-slot="product-bottom-bar"]')).toBeNull();
        });
    });

    describe('Safe Area Support', () => {
        test('includes safe-area-inset-bottom in style', () => {
            const { container } = renderComponent();
            const bottomBar = container.querySelector('[data-slot="product-bottom-bar"]');

            expect(bottomBar).toHaveStyle({ paddingBottom: 'env(safe-area-inset-bottom, 0px)' });
        });
    });
});
