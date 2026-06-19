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
import QuickFilters from '../index';
import type { ComponentType } from 'react';
import { within, expect } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import type { ShopperProducts } from '@/scapi';

const ALL_SUBCATEGORIES: NonNullable<ShopperProducts.schemas['Category']['categories']> = [
    { id: 'makeup-eyes', name: 'Eyes' },
    { id: 'makeup-lips', name: 'Lips' },
    { id: 'makeup-face', name: 'Face' },
    { id: 'makeup-nails', name: 'Nails' },
    { id: 'skincare', name: 'Skincare' },
    { id: 'fragrance', name: 'Fragrance' },
];
const MAX_VALUES = ALL_SUBCATEGORIES.length;

type SyntheticArgs = {
    valueCount: number;
    activeCategoryId: string;
    showLabels: boolean;
};

const meta: Meta<typeof QuickFilters> = {
    title: 'Cosmetic/QuickFilters',
    component: QuickFilters,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Cosmetic vertical override of QuickFilters. Displays subcategory chips with "Shop by Category" label and sparkles icon. Features rounded corners, custom colors, and data-state attributes for active/inactive states.',
            },
        },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Shows the "Shop by Category" label with sparkles icon, followed by
 * subcategory chips. The label is extracted from the cgid refinement in
 * the loader data. Default shows 4 subcategories with no active selection.
 */
export const WithShopByLabel: StoryObj<ComponentType<Partial<SyntheticArgs>>> = {
    args: {
        valueCount: 4,
        activeCategoryId: '',
        showLabels: true,
    },
    argTypes: {
        valueCount: {
            description: `Synthetic: number of subcategory chips to render (1–${MAX_VALUES})`,
            control: { type: 'number', min: 1, max: MAX_VALUES, step: 1 },
            table: { category: 'Synthetic (data shape)' },
        },
        activeCategoryId: {
            description:
                'Synthetic: seeds `refine=cgid=<id>` in the URL. The matching chip shows active state with primary-foreground text color.',
            control: 'text',
            table: { category: 'Synthetic (data shape)' },
        },
        showLabels: {
            description: 'Synthetic: when off, subcategory `name` fields are stripped so chips render the raw `id`.',
            control: 'boolean',
            table: { category: 'Synthetic (data shape)' },
        },
    },
    parameters: {
        routeLoaderData: {
            'routes/_app.category.$categoryId': {
                searchResultCritical: {
                    refinements: [
                        {
                            attributeId: 'cgid',
                            label: 'Category',
                        },
                    ],
                },
            },
        },
    },
    render: (args) => {
        const synthetic = {
            valueCount: args.valueCount ?? 4,
            activeCategoryId: args.activeCategoryId ?? '',
            showLabels: args.showLabels ?? true,
        };

        const clamped = Math.max(1, Math.min(synthetic.valueCount, MAX_VALUES));
        const subcategories = ALL_SUBCATEGORIES.slice(0, clamped).map((cat) =>
            synthetic.showLabels ? cat : { id: cat.id }
        );
        const category: ShopperProducts.schemas['Category'] = {
            id: 'makeup',
            name: 'Makeup',
            categories: subcategories,
        };

        return <QuickFilters category={category} />;
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        // Wait for component to render by finding the group role (proves router data is loaded)
        const container = await canvas.findByRole('group');
        await expect(container).toHaveAttribute('data-slot', 'quick-filters');

        // Check for "Shop by" label with sparkles
        const shopByLabel = canvas.getByText(/Shop by Category/i);
        await expect(shopByLabel).toBeInTheDocument();

        // Check buttons have proper aria-pressed and data-state attributes
        const buttons = canvas.getAllByRole('button');
        await expect(buttons.length).toBeGreaterThan(0);

        // Verify all chips start in inactive state
        for (const button of buttons) {
            await expect(button).toHaveAttribute('aria-pressed', 'false');
            await expect(button).toHaveAttribute('data-state', 'inactive');
        }
    },
};

/**
 * Shows subcategory chips without the "Shop by" label header. This happens
 * when the loader data doesn't include a cgid refinement with a label.
 */
export const WithoutShopByLabel: Story = {
    parameters: {
        routeLoaderData: {
            'routes/_app.category.$categoryId': {
                searchResultCritical: {
                    refinements: [],
                },
            },
        },
    },
    render: () => {
        const category: ShopperProducts.schemas['Category'] = {
            id: 'makeup',
            name: 'Makeup',
            categories: [
                { id: 'makeup-eyes', name: 'Eyes' },
                { id: 'makeup-lips', name: 'Lips' },
                { id: 'makeup-face', name: 'Face' },
            ],
        };
        return <QuickFilters category={category} />;
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        // Wait for buttons to render (proves router initialized)
        const buttons = await canvas.findAllByRole('button');
        await expect(buttons.length).toBe(3);

        // Should NOT have "Shop by" label
        const shopByLabel = canvas.queryByText(/Shop by/i);
        await expect(shopByLabel).not.toBeInTheDocument();
    },
};

/**
 * Shows one active chip (Eyes) to demonstrate the active state styling
 * with primary-foreground text color on primary background.
 */
export const WithActiveChip: Story = {
    parameters: {
        routeLoaderData: {
            'routes/_app.category.$categoryId': {
                searchResultCritical: {
                    refinements: [
                        {
                            attributeId: 'cgid',
                            label: 'Category',
                        },
                    ],
                },
            },
        },
        initialEntries: ['/?refine=cgid=makeup-eyes'],
    },
    render: () => {
        const category: ShopperProducts.schemas['Category'] = {
            id: 'makeup',
            name: 'Makeup',
            categories: [
                { id: 'makeup-eyes', name: 'Eyes' },
                { id: 'makeup-lips', name: 'Lips' },
                { id: 'makeup-face', name: 'Face' },
            ],
        };
        return <QuickFilters category={category} />;
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        // Wait for the active button to render with correct state
        const eyesButton = await canvas.findByRole('button', { name: 'Eyes' });
        await expect(eyesButton).toHaveAttribute('aria-pressed', 'true');
        await expect(eyesButton).toHaveAttribute('data-state', 'active');

        const lipsButton = canvas.getByRole('button', { name: 'Lips' });
        await expect(lipsButton).toHaveAttribute('aria-pressed', 'false');
        await expect(lipsButton).toHaveAttribute('data-state', 'inactive');
    },
};

/**
 * Empty categories array returns null - no component rendered.
 */
export const EmptyState: Story = {
    args: {},
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const buttons = canvasElement.querySelectorAll('button');
        await expect(buttons.length).toBe(0);
    },
};
