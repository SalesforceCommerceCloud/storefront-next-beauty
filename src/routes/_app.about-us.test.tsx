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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ShopperExperience } from '@/scapi';
import type { Route } from './+types/_app.about-us';
import { getTranslation } from '@salesforce/storefront-next-runtime/i18n';
import AboutUs, { type AboutUsPageData, loader } from './_app.about-us';
import { createTestContext } from '@/lib/test-utils';
import { fetchPageWithComponentData } from '@/lib/page-designer/page-loader.server';

const { t } = getTranslation();

const createMockPage = (regions: any[] = []): ShopperExperience.schemas['Page'] =>
    ({
        id: 'mock-page',
        typeId: 'aboutus',
        regions,
    }) as ShopperExperience.schemas['Page'];

// Mock the Region component to render the `errorElement` (static fallback) when the
// region has no Page Designer components attached. Mirrors the behaviour the cosmetic
// homepage test relies on.
vi.mock('@/components/region', async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    function RegionMock({ regionId, page, errorElement }: any) {
        const [resolvedPage, setResolvedPage] = React.useState<any>(null);
        const [isLoading, setIsLoading] = React.useState(true);

        React.useEffect(() => {
            if (page) {
                void Promise.resolve(page).then((p) => {
                    setResolvedPage(p);
                    setIsLoading(false);
                });
            } else {
                setIsLoading(false);
            }
        }, [page]);

        if (isLoading) return null;

        const region = resolvedPage?.regions?.find((r: any) => r.id === regionId);
        const hasComponents = (region?.components?.length ?? 0) > 0;

        if (!region || !hasComponents) return errorElement ?? null;

        return <div data-testid={`region-${regionId}`}>Page Designer Region: {regionId}</div>;
    }

    return { Region: RegionMock };
});

vi.mock('@/components/link', () => ({
    Link: ({ to, children }: any) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/contact', () => ({
    default: () => <div data-testid="contact">Contact Form</div>,
}));

// ContentCard mock surfaces every prop the route wires up so the tests catch
// regressions in image/alt/loading/CTA wiring, not just headline strings.
vi.mock('@/components/content-card', () => ({
    default: ({ title, description, imageUrl, imageAlt, buttonText, buttonLink, loading }: any) => (
        <div data-testid="content-card" data-loading={loading ?? 'lazy'}>
            <h3>{title}</h3>
            <p>{description}</p>
            {imageUrl ? <img data-testid="content-card-image" src={imageUrl} alt={imageAlt ?? ''} /> : null}
            {buttonText ? (
                <a data-testid="content-card-cta" href={buttonLink ?? '#'}>
                    {buttonText}
                </a>
            ) : null}
        </div>
    ),
}));

vi.mock('@/lib/decorators/page-type', () => ({
    PageType: () => (target: any) => target,
}));

vi.mock('@/lib/decorators/region-definition', () => ({
    RegionDefinition: () => (target: any) => target,
}));

vi.mock('@/lib/page-designer/page-loader.server', () => ({
    fetchPageWithComponentData: vi.fn(),
}));

vi.mock('@/lib/logger.server', () => ({
    getLogger: vi.fn(() => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    })),
}));

const renderComponent = (loaderDataOverrides?: Partial<AboutUsPageData>) => {
    const defaultData: AboutUsPageData = {
        page: {
            ...createMockPage([]),
            componentData: {},
        },
        pageUrl: 'http://localhost/about-us',
        ogImageUrl: 'http://localhost/__ASSET_MOCK__',
    };
    const data = { ...defaultData, ...loaderDataOverrides };
    return render(<AboutUs loaderData={data} />);
};

describe('AboutUs (cosmetic)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchPageWithComponentData).mockResolvedValue({
            ...createMockPage([]),
            componentData: {},
        });
    });

    describe('Static content', () => {
        test('renders breadcrumb and page title from canonical aboutUs strings', () => {
            renderComponent();
            expect(screen.getByText(t('aboutUs:breadcrumb.home'))).toBeInTheDocument();
            // "About Us" appears in both the breadcrumb and the H1 title.
            const aboutUsLabels = screen.getAllByText(t('aboutUs:title'));
            expect(aboutUsLabels.length).toBeGreaterThanOrEqual(1);
        });

        test('renders cosmetic hero headline', async () => {
            renderComponent();
            await waitFor(() => {
                // Asserted against the literal English string so the test is stable under
                // any active VERTICAL. The cosmetic en-US/en-GB override and the route's
                // own defaultValue resolve to this same string.
                expect(
                    screen.getByText(/Clean ingredients\. Every-shade colou?r\. Beauty that fits your day\./)
                ).toBeInTheDocument();
            });
        });

        test('renders the four standards pillars with content paragraphs', async () => {
            renderComponent();
            await waitFor(() => {
                // Pillar titles
                expect(screen.getByText('Ingredient transparency')).toBeInTheDocument();
                expect(screen.getByText('Performance you can feel')).toBeInTheDocument();
                expect(screen.getByText('Shade for everyone')).toBeInTheDocument();
                expect(screen.getByText('Responsibly made')).toBeInTheDocument();
                // Pillar content excerpts (one phrase per pillar — guards against title/content swaps)
                expect(screen.getByText(/No proprietary blends/)).toBeInTheDocument();
                expect(screen.getByText(/Benchmarked against the best in category/)).toBeInTheDocument();
                expect(screen.getByText(/across every undertone/)).toBeInTheDocument();
                expect(screen.getByText(/Recyclable packaging/)).toBeInTheDocument();
            });
        });

        test('renders four lucide pillar icons (Beaker / FlaskConical / Palette / Leaf)', async () => {
            const { container } = renderComponent();
            await waitFor(() => {
                // lucide-react renders each icon as an <svg> with the icon name in its class list.
                expect(container.querySelector('.lucide-beaker')).toBeInTheDocument();
                expect(container.querySelector('.lucide-flask-conical')).toBeInTheDocument();
                expect(container.querySelector('.lucide-palette')).toBeInTheDocument();
                expect(container.querySelector('.lucide-leaf')).toBeInTheDocument();
            });
        });

        test('renders Contact form between the two regions', async () => {
            renderComponent();
            await waitFor(() => {
                expect(screen.getByTestId('contact')).toBeInTheDocument();
            });
        });

        test('renders community CTA and closing manifesto in post-contact region', async () => {
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('Become part of the Dazzle community')).toBeInTheDocument();
                expect(screen.getByText('Beauty that meets you where you are')).toBeInTheDocument();
            });
        });

        test('wires hero CTA to /category/newarrivals with eager image loading', async () => {
            renderComponent();
            await waitFor(() => {
                const hero = screen.getByText('Shop Skincare').closest('a');
                expect(hero).toHaveAttribute('href', '/category/newarrivals');
                // Hero ContentCard is the only one with loading="eager".
                const eagerCards = screen
                    .getAllByTestId('content-card')
                    .filter((c) => c.getAttribute('data-loading') === 'eager');
                expect(eagerCards).toHaveLength(1);
            });
        });

        test('wires standards CTA to /category/top-seller', async () => {
            renderComponent();
            await waitFor(() => {
                const standards = screen.getByText('See our ingredients').closest('a');
                expect(standards).toHaveAttribute('href', '/category/top-seller');
            });
        });

        test('wires community CTA to /signup', async () => {
            renderComponent();
            await waitFor(() => {
                const community = screen.getByText('Create your account').closest('a');
                expect(community).toHaveAttribute('href', '/signup');
            });
        });

        test('wires closing CTA to /category/newarrivals', async () => {
            renderComponent();
            await waitFor(() => {
                const closing = screen.getByText('Explore our formulas').closest('a');
                expect(closing).toHaveAttribute('href', '/category/newarrivals');
            });
        });

        test('hero image has descriptive cosmetic alt text', async () => {
            renderComponent();
            await waitFor(() => {
                const heroImg = screen.getByAltText(/Foundation bottles arranged in a fan on warm marble\./);
                expect(heroImg).toBeInTheDocument();
            });
        });
    });

    describe('Page Designer regions', () => {
        test('renders Page Designer headline region when components are present', async () => {
            const page = {
                ...createMockPage([{ id: 'headline', components: [{ id: 'c1', typeId: 'hero' }] }]),
                componentData: {},
            };
            renderComponent({ page });
            await waitFor(() => {
                expect(screen.getByTestId('region-headline')).toBeInTheDocument();
                // Static fallback hero headline should NOT render when the region wins.
                expect(
                    screen.queryByText(/Clean ingredients\. Every-shade colou?r\. Beauty that fits your day\./)
                ).not.toBeInTheDocument();
            });
        });

        test('renders Page Designer additionalinformation region when components are present', async () => {
            const page = {
                ...createMockPage([{ id: 'additionalinformation', components: [{ id: 'c2', typeId: 'banner' }] }]),
                componentData: {},
            };
            renderComponent({ page });
            await waitFor(() => {
                expect(screen.getByTestId('region-additionalinformation')).toBeInTheDocument();
                // Static fallback (community CTA) should NOT render when the region wins.
                expect(screen.queryByText('Become part of the Dazzle community')).not.toBeInTheDocument();
            });
        });

        test('renders static fallback when no page is provided', async () => {
            renderComponent({ page: null });
            await waitFor(() => {
                expect(screen.getByTestId('contact')).toBeInTheDocument();
                expect(
                    screen.getByText(/Clean ingredients\. Every-shade colou?r\. Beauty that fits your day\./)
                ).toBeInTheDocument();
            });
        });
    });

    describe('Loader', () => {
        test('returns about us page data from fetchPageWithComponentData', async () => {
            const mockPageWithData = {
                ...createMockPage([]),
                componentData: { sample: Promise.resolve('data') },
            };
            vi.mocked(fetchPageWithComponentData).mockResolvedValue(mockPageWithData);

            const ctx = createTestContext();
            const args: Route.LoaderArgs = {
                request: new Request('http://localhost/about-us'),
                params: { siteId: 'test-site', localeId: 'en-US' },
                context: ctx,
                unstable_pattern: '/about-us',
            };
            const result = await loader(args);

            expect(vi.mocked(fetchPageWithComponentData)).toHaveBeenCalledWith(args, { pageId: 'aboutus' });
            expect(result.page).toBe(mockPageWithData);
            expect(result.pageUrl).toBe('http://localhost/about-us');
            expect(result.ogImageUrl).toContain('http://localhost');
        });
    });
});
