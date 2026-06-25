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

import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import GuestWishlist from './_app.wishlist';

vi.mock('@/components/wishlist/wishlist-page', () => ({
    WishlistPageContent: () => <div data-testid="wishlist-page-content">Wishlist content</div>,
    WishlistSkeleton: () => <div data-testid="wishlist-skeleton">Loading…</div>,
}));

vi.mock('@/components/wishlist/wishlist-load-error', () => ({
    WishlistLoadError: () => <div data-testid="wishlist-load-error">Error</div>,
}));

vi.mock('@/components/seo-meta', () => ({
    SeoMeta: ({ title }: { title?: string }) => <meta data-testid="seo-meta" data-title={title} />,
}));

vi.mock('@/analytics/wishlist-page-analytics', () => ({
    WishlistPageAnalytics: () => null,
}));

vi.mock('@/components/link', () => ({
    Link: ({ to, children, className }: any) => (
        <a href={typeof to === 'string' ? to : '#'} className={className}>
            {children}
        </a>
    ),
}));

vi.mock('react-i18next', async () => {
    const actual: any = await vi.importActual('react-i18next');
    // Mirror the cosmetic en-US overrides so the test exercises cosmetic copy,
    // not canonical fashion strings that fall through the deep-merge.
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, opts?: { defaultValue?: string }) => {
                const lookup: Record<string, string> = {
                    'wishlist.guestKeepItemsBanner': 'Sign in to keep your saved products with you across devices.',
                    'wishlist.guestKeepItemsBannerCta': 'Sign in',
                    'meta.wishlistTitle': 'Wishlist',
                };
                return lookup[key] ?? opts?.defaultValue ?? key;
            },
            i18n: { language: 'en-US', changeLanguage: vi.fn() },
        }),
    };
});

const renderComponent = () =>
    render(
        <GuestWishlist
            loaderData={
                {
                    items: [],
                    productsByProductId: Promise.resolve({}),
                } as any
            }
        />
    );

describe('GuestWishlist (cosmetic)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('wraps page content in the cosmetic section-container', () => {
        renderComponent();
        const wrapper = screen.getByTestId('cosmetic-wishlist-wrapper');
        expect(wrapper).toHaveClass('section-container');
        expect(wrapper).toHaveClass('py-8');
    });

    test('renders the guest sign-in banner with cosmetic copy and cosmetic muted surface', () => {
        renderComponent();
        const banner = screen.getByText(/Sign in to keep your saved products with you across devices\./);
        // Walk up to the Alert root which carries the surface tokens.
        const alertRoot = banner.closest('[class*="bg-muted"]');
        expect(alertRoot).not.toBeNull();
        expect(alertRoot?.className).toMatch(/bg-muted\/40/);
        expect(alertRoot?.className).toMatch(/border-border/);
    });

    test('sign-in link points at /login with returnUrl back to /wishlist', () => {
        renderComponent();
        const link = screen.getByText('Sign in').closest('a');
        expect(link).toHaveAttribute('href', expect.stringContaining('returnUrl='));
        expect(link?.getAttribute('href')).toContain('/wishlist');
    });

    test('renders the wishlist page content via Suspense', async () => {
        renderComponent();
        await waitFor(() => {
            expect(screen.getByTestId('wishlist-page-content')).toBeInTheDocument();
        });
    });
});
