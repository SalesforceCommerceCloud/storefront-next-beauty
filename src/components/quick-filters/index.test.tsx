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
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ShopperProducts, ShopperSearch } from '@/scapi';
import { ConfigProvider } from '@salesforce/storefront-next-runtime/config';
import { mockConfig } from '@/test-utils/config';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import QuickFilters from './index';

const mockNavigate = vi.fn();
const mockUseRouteLoaderData = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-navigate', () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock('react-router', async () => {
    const actual = await vi.importActual<typeof import('react-router')>('react-router');
    return {
        ...actual,
        useRouteLoaderData: mockUseRouteLoaderData,
    };
});

void i18next.init({
    lng: 'en-US',
    fallbackLng: 'en-US',
    resources: {
        'en-US': {
            common: {
                shopBy: 'Shop by',
                quickCategoryFilters: 'Quick category filters',
            },
        },
    },
});

const mockLoaderData = {
    searchResultCritical: {
        refinements: [
            {
                attributeId: 'cgid',
                label: 'Category',
            },
        ],
    } as ShopperSearch.schemas['ProductSearchResult'],
};

const renderComponent = ({
    category,
    loaderData = mockLoaderData,
    initialPath = '/',
}: {
    category?: ShopperProducts.schemas['Category'];
    loaderData?: typeof mockLoaderData | null;
    initialPath?: string;
}) => {
    mockUseRouteLoaderData.mockReturnValue(loaderData);

    const router = createMemoryRouter(
        [
            {
                path: '/',
                element: (
                    <I18nextProvider i18n={i18next}>
                        <ConfigProvider config={mockConfig}>
                            <QuickFilters category={category} />
                        </ConfigProvider>
                    </I18nextProvider>
                ),
            },
        ],
        {
            initialEntries: [initialPath],
        }
    );

    return render(<RouterProvider router={router} />);
};

describe('QuickFilters (Cosmetic Vertical)', () => {
    test('renders "Shop by" label with cgid refinement label from loader data', () => {
        const category = {
            id: 'mens',
            name: 'Men',
            categories: [{ id: 'mens-suits', name: 'Suits' }],
        } as ShopperProducts.schemas['Category'];

        renderComponent({ category });

        expect(screen.getByText(/Shop by Category/i)).toBeInTheDocument();
    });

    test('does not render "Shop by" label when cgid refinement not found in loader data', () => {
        const category = {
            id: 'mens',
            name: 'Men',
            categories: [{ id: 'mens-suits', name: 'Suits' }],
        } as ShopperProducts.schemas['Category'];

        const loaderDataWithoutCgid = {
            searchResultCritical: {
                ...mockLoaderData.searchResultCritical,
                refinements: [],
            },
        };

        renderComponent({ category, loaderData: loaderDataWithoutCgid });

        expect(screen.queryByText(/Shop by/i)).not.toBeInTheDocument();
    });

    test('does not render "Shop by" label when loader data is not available', () => {
        const category = {
            id: 'mens',
            name: 'Men',
            categories: [{ id: 'mens-suits', name: 'Suits' }],
        } as ShopperProducts.schemas['Category'];

        renderComponent({ category, loaderData: null });

        expect(screen.queryByText(/Shop by/i)).not.toBeInTheDocument();
    });

    test('has data-slot attribute for deterministic selection', () => {
        const category = {
            id: 'mens',
            name: 'Men',
            categories: [{ id: 'mens-tops', name: 'Tops' }],
        } as ShopperProducts.schemas['Category'];

        renderComponent({ category });

        const container = screen.getByRole('group');
        expect(container).toHaveAttribute('data-slot', 'quick-filters');
    });

    test('renders subcategories as buttons with data-state attribute', () => {
        const category = {
            id: 'mens',
            name: 'Men',
            categories: [
                { id: 'mens-tops', name: 'Tops' },
                { id: 'mens-bottoms', name: 'Bottoms' },
            ],
        } as ShopperProducts.schemas['Category'];

        renderComponent({ category, initialPath: '/?refine=cgid%3Dmens-tops' });

        const topsButton = screen.getByRole('button', { name: 'Tops' });
        expect(topsButton).toHaveAttribute('data-state', 'active');

        const bottomsButton = screen.getByRole('button', { name: 'Bottoms' });
        expect(bottomsButton).toHaveAttribute('data-state', 'inactive');
    });
});
