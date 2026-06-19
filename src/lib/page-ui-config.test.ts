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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageUIConfig } from './page-ui-config';

vi.mock('react-router', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router')>();
    return {
        ...actual,
        useMatches: vi.fn(),
    };
});

import { useMatches } from 'react-router';

describe('usePageUIConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return ui config when handle.ui exists', () => {
        vi.mocked(useMatches).mockReturnValue([
            {
                id: 'routes/_app._index',
                pathname: '/',
                params: {},
                data: null,
                loaderData: null,
                handle: {
                    ui: {
                        header: { transparentOnLoad: true },
                    },
                },
            },
        ]);

        const { result } = renderHook(() => usePageUIConfig());

        expect(result.current).toEqual({
            header: { transparentOnLoad: true },
        });
    });

    it('should return empty object when no config exists', () => {
        vi.mocked(useMatches).mockReturnValue([
            {
                id: 'routes/_app.product.$productId',
                pathname: '/product/123',
                params: {},
                data: null,
                loaderData: null,
                handle: undefined,
            },
        ]);

        const { result } = renderHook(() => usePageUIConfig());

        expect(result.current).toEqual({});
    });

    it('should return main config when handle.ui.main exists', () => {
        vi.mocked(useMatches).mockReturnValue([
            {
                id: 'routes/_app.product.$productId',
                pathname: '/product/123',
                params: {},
                data: null,
                loaderData: null,
                handle: {
                    ui: {
                        main: { hasTopPadding: true },
                    },
                },
            },
        ]);

        const { result } = renderHook(() => usePageUIConfig());

        expect(result.current).toEqual({
            main: { hasTopPadding: true },
        });
    });

    it('should return combined header and main config', () => {
        vi.mocked(useMatches).mockReturnValue([
            {
                id: 'routes/_app._index',
                pathname: '/',
                params: {},
                data: null,
                loaderData: null,
                handle: {
                    ui: {
                        header: { transparentOnLoad: true },
                        main: { hasTopPadding: true },
                    },
                },
            },
        ]);

        const { result } = renderHook(() => usePageUIConfig());

        expect(result.current).toEqual({
            header: { transparentOnLoad: true },
            main: { hasTopPadding: true },
        });
    });
});
