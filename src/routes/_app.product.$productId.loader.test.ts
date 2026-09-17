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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { RouterContextProvider } from 'react-router';
import { ApiError, type ShopperProducts } from '@/scapi';
import { siteContext } from '@salesforce/storefront-next-runtime/site-context';
import { NormalizedApiError } from '@/lib/api/normalized-api-error';

const { mockFetchProductById, mockPdpSectionApi, mockGetReturnsAndWarranty, mockAttemptRouteSeoFallback } = vi.hoisted(
    () => ({
        mockFetchProductById: vi.fn(),
        mockPdpSectionApi: {
            getIngredientsData: vi.fn(),
            getUsageInstructions: vi.fn(),
            getCareInstructions: vi.fn(),
            getTechSpecs: vi.fn(),
        },
        mockGetReturnsAndWarranty: vi.fn(),
        mockAttemptRouteSeoFallback: vi.fn(),
    })
);

vi.mock('@/lib/api/products.server', () => ({
    fetchProductById: mockFetchProductById,
}));

vi.mock('@/lib/seo/route-fallback.server', () => ({ attemptRouteSeoFallback: mockAttemptRouteSeoFallback }));

vi.mock('@/lib/page-designer/page-loader.server', () => ({
    fetchPageWithComponentData: vi.fn(() => Promise.resolve({ id: 'pdp', regions: [] })),
}));

vi.mock('@/lib/logger.server', () => ({
    getLogger: vi.fn(() => ({ debug: vi.fn(), error: vi.fn() })),
}));

vi.mock('@salesforce/storefront-next-runtime/i18n', () => ({
    getTranslation: vi.fn(() => ({
        i18next: {
            t: (key: string) => key.replace('product:', ''),
        },
    })),
}));

vi.mock('@/extensions/product-content/lib/api/product-content.server', () => ({
    getReturnsAndWarranty: mockGetReturnsAndWarranty,
    pdpSectionApi: mockPdpSectionApi,
}));

import { loader } from './_app.product.$productId';

describe('Cosmetic product route loader', () => {
    const context = {
        get: vi.fn((key) => {
            if (key === siteContext) {
                return { currency: 'USD', site: { id: 'test-site' }, locale: { id: 'en-US' } };
            }
            return undefined;
        }),
    } as unknown as Readonly<RouterContextProvider>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAttemptRouteSeoFallback.mockResolvedValue(undefined);
    });

    test('resolves cosmetic custom attributes without calling the mock section API', async () => {
        const product = {
            id: 'serum-123',
            name: 'Vitamin C Serum',
            primaryCategoryId: 'skincare',
            master: undefined,
            c_ingredients: 'Water\nVitamin C',
            c_skinType: 'Normal',
        } as unknown as ShopperProducts.schemas['Product'];
        mockFetchProductById.mockResolvedValue(product);

        const request = new Request('https://example.com/product/serum-123');
        const result = await loader({
            request,
            params: { siteId: 'test-site', localeId: 'en-US', productId: 'serum-123' },
            context,
            url: new URL(request.url),
            pattern: '/product/:productId',
        });

        await expect(result.pdpCollapsibles).resolves.toEqual([
            { contentType: 'bulleted-list', html: '<ul><li>Water</li><li>Vitamin C</li></ul>' },
            {
                contentType: 'spec-table',
                rows: [{ label: 'cosmeticSpec.skinType', values: { details: 'Normal' } }],
            },
        ]);
        expect(mockPdpSectionApi.getIngredientsData).not.toHaveBeenCalled();
        expect(mockPdpSectionApi.getUsageInstructions).not.toHaveBeenCalled();
        expect(mockPdpSectionApi.getCareInstructions).not.toHaveBeenCalled();
        expect(mockPdpSectionApi.getTechSpecs).not.toHaveBeenCalled();
    });

    test('resolves the product ID from the final raw path segment, not the route param', async () => {
        mockFetchProductById.mockResolvedValue({ id: 'serum-123' } as unknown as ShopperProducts.schemas['Product']);

        // Under the SEO route aliases the product ID arrives on the alias splat, so the
        // route param no longer carries it. The final raw path segment is authoritative.
        const request = new Request('https://example.com/en-US/p/skincare/serums/serum-123');

        await loader({
            request,
            params: { siteId: 'test-site', localeId: 'en-US', productId: 'stale-route-param' },
            context,
            url: new URL(request.url),
            pattern: '/product/:productId',
        });

        expect(mockFetchProductById.mock.calls[0][1]).toBe('serum-123');
        expect(mockAttemptRouteSeoFallback).not.toHaveBeenCalled();
    });

    test('passes an .html product ID unchanged to the primary lookup', async () => {
        mockFetchProductById.mockResolvedValue({ id: 'legacy.html' } as ShopperProducts.schemas['Product']);
        const request = new Request('https://example.com/product/legacy.html');

        await loader({
            request,
            params: { siteId: 'test-site', localeId: 'en-US', productId: 'legacy.html' },
            context,
            url: new URL(request.url),
            pattern: '',
        });

        expect(mockFetchProductById.mock.calls[0][1]).toBe('legacy.html');
        expect(mockAttemptRouteSeoFallback).not.toHaveBeenCalled();
    });

    test('attempts fallback once for an authoritative path lookup 404', async () => {
        mockFetchProductById.mockRejectedValue(normalizedError(404));
        const request = new Request('https://example.com/product/missing');

        await expect(
            loader({
                request,
                params: { siteId: 'test-site', localeId: 'en-US', productId: 'missing' },
                context,
                url: new URL(request.url),
                pattern: '',
            })
        ).rejects.toBeInstanceOf(Response);

        expect(mockAttemptRouteSeoFallback).toHaveBeenCalledOnce();
    });

    test('does not attempt fallback for a non-404 product failure', async () => {
        mockFetchProductById.mockRejectedValue(normalizedError(500));
        const request = new Request('https://example.com/product/failure');

        await expect(
            loader({
                request,
                params: { siteId: 'test-site', localeId: 'en-US', productId: 'failure' },
                context,
                url: new URL(request.url),
                pattern: '',
            })
        ).rejects.toBeInstanceOf(Response);

        expect(mockAttemptRouteSeoFallback).not.toHaveBeenCalled();
    });
});

function normalizedError(status: number): NormalizedApiError {
    return new NormalizedApiError(
        new ApiError({
            status,
            statusText: 'Failure',
            headers: new Headers(),
            body: { type: 'Failure', title: 'Failure', detail: 'failure' },
            rawBody: '{}',
            url: 'https://api.example.com/products/failure',
            method: 'GET',
        })
    );
}
