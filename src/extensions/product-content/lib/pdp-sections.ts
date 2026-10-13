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
import type { ShopperProducts } from '@/scapi';
import type { ParseKeys } from 'i18next';
import type { SectionContent, SpecTableRow } from '@/components/html-fragment/types';
import type { PdpSectionApiMethod } from '@/extensions/product-content/lib/api/product-content.server';

type TranslatorFn = (key: string, options?: { count?: number }) => string;

export type PdpSection =
    | { apiMethod: PdpSectionApiMethod; labelKey: ParseKeys<'product'> }
    | {
          labelKey: ParseKeys<'product'>;
          resolve: (product: ShopperProducts.schemas['Product'], t: TranslatorFn) => Promise<SectionContent | null>;
      };

const CONTENT_SECTIONS = [
    { attribute: 'c_ingredients', labelKey: 'materials' },
    { attribute: 'c_howToUse', labelKey: 'usageInstructions' },
    { attribute: 'c_keyBenefits', labelKey: 'careInstructions' },
] as const satisfies ReadonlyArray<{ attribute: string; labelKey: ParseKeys<'product'> }>;

const DETAIL_FIELDS = [
    { attribute: 'c_skinType', labelKey: 'cosmeticSpec.skinType' },
    { attribute: 'c_pdpFinish', labelKey: 'cosmeticSpec.finish' },
    { attribute: 'c_coverage', labelKey: 'cosmeticSpec.coverage' },
    { attribute: 'c_size', labelKey: 'cosmeticSpec.size' },
] as const;

function asNonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderTextContent(value: string): SectionContent {
    const lines = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length > 1) {
        return {
            contentType: 'bulleted-list',
            html: `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
        };
    }

    return { contentType: 'plain-text', html: escapeHtml(value) };
}

function hasContentAttribute(product: Record<string, unknown>, attribute: string): boolean {
    return asNonEmptyString(product[attribute]) !== null;
}

function hasProductDetails(product: Record<string, unknown>): boolean {
    return DETAIL_FIELDS.some(({ attribute }) => hasContentAttribute(product, attribute));
}

/**
 * Returns the cosmetic PDP sections backed directly by shopper-visible Product custom attributes.
 * The fields are expected to contain plain text: newlines in the three prose fields render as
 * bullet items; custom markup is escaped before reaching HtmlFragment.
 */
export function resolvePdpSections(product: ShopperProducts.schemas['Product']): PdpSection[] {
    const attributes = product as Record<string, unknown>;
    const sections: PdpSection[] = [];

    for (const { attribute, labelKey } of CONTENT_SECTIONS) {
        if (!hasContentAttribute(attributes, attribute)) continue;

        sections.push({
            labelKey,
            // oxlint-disable-next-line @typescript-eslint/require-await -- async for the resolver contract; body is synchronous
            resolve: async (resolvedProduct) => {
                const value = asNonEmptyString((resolvedProduct as Record<string, unknown>)[attribute]);
                return value ? renderTextContent(value) : null;
            },
        });
    }

    if (hasProductDetails(attributes)) {
        sections.push({
            labelKey: 'specifications',
            // oxlint-disable-next-line @typescript-eslint/require-await -- async for the resolver contract; body is synchronous
            resolve: async (resolvedProduct, t) => {
                const resolvedAttributes = resolvedProduct as Record<string, unknown>;
                const rows: SpecTableRow[] = DETAIL_FIELDS.flatMap(({ attribute, labelKey }) => {
                    const value = asNonEmptyString(resolvedAttributes[attribute]);
                    return value ? [{ label: t(labelKey), values: { details: value } }] : [];
                });

                return rows.length ? { contentType: 'spec-table', rows } : null;
            },
        });
    }

    return sections;
}
