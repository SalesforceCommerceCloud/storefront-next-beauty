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
import { vi, expect, test, describe, afterEach } from 'vitest';

type MockFormProps = React.PropsWithChildren<Record<string, unknown>>;

const fetcherMock = {
    data: null,
    state: 'idle',
    submit: () => {},
    Form: (props: MockFormProps) => <form {...props}>{props.children}</form>,
};

// Extend the global react-router mock to add useFetcher
vi.mock('react-router', async () => {
    const actual = await vi.importActual('react-router');
    return {
        ...actual,
        useFetcher: () => fetcherMock,
    };
});

vi.mock('@/components/toast', () => ({
    useToast: () => ({
        addToast: () => {},
    }),
}));

// Mock useConfig — `toImageUrl` reads it for DIS URL transforms and the tile reads `global.badges`
// for the top-left product badge.
vi.mock('@salesforce/storefront-next-runtime/config', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useConfig: () => ({
        global: {
            badges: [
                { propertyName: 'c_isSale', label: 'Sale', color: 'orange', priority: 1 },
                { propertyName: 'c_isNew', label: 'New', color: 'green', priority: 2 },
            ],
        },
    }),
}));

// Mock product-utils
vi.mock('@/lib/product/product-utils', async () => {
    const actual = await vi.importActual('@/lib/product/product-utils');
    return {
        ...actual,
        isRuleBasedPromotion: () => false, // Default to list-based for storybook
    };
});

import { composeStories } from '@storybook/react-vite';

// Relative import so the snapshot renders the cosmetic OVERRIDE's stories, not the canonical ones.
import * as BonusProductSelectionStories from './bonus-product-selection.stories';
import { render, cleanup } from '@testing-library/react';
import { AllProvidersWrapper } from '@/test-utils/context-provider';

const composed = composeStories(BonusProductSelectionStories);

afterEach(() => {
    cleanup();
});

describe('Cosmetic BonusProductSelection stories snapshot', () => {
    for (const [storyName, Story] of Object.entries(composed)) {
        test(`${storyName} story renders and matches snapshot`, () => {
            // `BonusProductSelection` reads `useSite()` — wrap the render so the story inherits
            // `SiteProvider` here even when the global decorator stack doesn't propagate through
            // `composeStories` in this harness.
            const { container } = render(
                <AllProvidersWrapper>
                    <Story />
                </AllProvidersWrapper>
            );
            expect(container.firstChild).toMatchSnapshot();
        });
    }
});
