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
import { describe, expect, test } from 'vitest';
import type { ShopperProducts } from '@/scapi';
import { resolvePdpSections } from './pdp-sections';

const t = (key: string) => key;

const asProduct = (attributes: Record<string, unknown>) => attributes as ShopperProducts.schemas['Product'];

async function resolveSection(product: ShopperProducts.schemas['Product'], labelKey: string) {
    const section = resolvePdpSections(product).find((candidate) => candidate.labelKey === labelKey);
    if (!section || !('resolve' in section)) throw new Error(`no ${labelKey} section`);
    return section.resolve(product, t);
}

describe('cosmetic resolvePdpSections', () => {
    test('returns no sections when the product has no cosmetic content', () => {
        expect(resolvePdpSections(asProduct({}))).toEqual([]);
    });

    test('returns sections in cosmetic PDP display order', () => {
        const product = asProduct({
            c_ingredients: 'Water',
            c_howToUse: 'Apply daily',
            c_keyBenefits: 'Hydrates',
            c_skinType: 'Normal',
        });

        expect(resolvePdpSections(product).map((section) => section.labelKey)).toEqual([
            'materials',
            'usageInstructions',
            'careInstructions',
            'specifications',
        ]);
    });

    test('renders newline-delimited ingredients as escaped bullet items', async () => {
        const content = await resolveSection(
            asProduct({ c_ingredients: 'Water\n<em>Vitamin C</em>\n  ' }),
            'materials'
        );

        expect(content).toEqual({
            contentType: 'bulleted-list',
            html: '<ul><li>Water</li><li>&lt;em&gt;Vitamin C&lt;/em&gt;</li></ul>',
        });
    });

    test('renders single how-to-use content as escaped plain text', async () => {
        const content = await resolveSection(asProduct({ c_howToUse: 'Apply <twice> daily.' }), 'usageInstructions');

        expect(content).toEqual({
            contentType: 'plain-text',
            html: 'Apply &lt;twice&gt; daily.',
        });
    });

    test('renders newline-delimited key benefits as escaped bullet items', async () => {
        const content = await resolveSection(
            asProduct({ c_keyBenefits: 'Hydrates\nBrightens & smooths' }),
            'careInstructions'
        );

        expect(content).toEqual({
            contentType: 'bulleted-list',
            html: '<ul><li>Hydrates</li><li>Brightens &amp; smooths</li></ul>',
        });
    });

    test('renders only populated product details with translated labels', async () => {
        const product = asProduct({
            c_skinType: 'Normal & dry',
            c_pdpFinish: 'Natural',
            c_coverage: 'Medium < buildable',
        });

        const content = await resolveSection(product, 'specifications');

        expect(content).toEqual({
            contentType: 'spec-table',
            rows: [
                { label: 'cosmeticSpec.skinType', values: { details: 'Normal & dry' } },
                { label: 'cosmeticSpec.finish', values: { details: 'Natural' } },
                { label: 'cosmeticSpec.coverage', values: { details: 'Medium < buildable' } },
            ],
        });
    });

    test('omits blank and wrongly typed attributes', () => {
        const product = asProduct({
            c_ingredients: '   ',
            c_howToUse: ['Apply daily'],
            c_keyBenefits: 42,
            c_skinType: ' ',
            c_pdpFinish: false,
            c_coverage: null,
            c_size: {},
        });

        expect(resolvePdpSections(product)).toEqual([]);
    });
});
