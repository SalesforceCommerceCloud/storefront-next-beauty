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
import type { ReactElement } from 'react';
import { Beaker, FlaskConical, Leaf, Palette } from 'lucide-react';
import type { Route } from './+types/_app.about-us';
import { Link } from '@/components/link';
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ContentCard from '@/components/content-card';
import Contact from '@/components/contact';
import { Typography } from '@/components/typography';
import { SeoMeta } from '@/components/seo-meta';
import { buildCanonicalUrl } from '@/utils/canonical-url';
import { PageType } from '@/lib/decorators/page-type';
import { RegionDefinition } from '@/lib/decorators/region-definition';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getLogger } from '@/lib/logger.server';
import heroFoundationsImage from '/images/hero-01.webp';
import heroIngredientsImage from '/images/hero-02.webp';
import heroRoutineImage from '/images/hero-03.webp';
import heroTextureImage from '/images/hero-04.webp';
import { Region } from '@/components/region';
import { fetchPageWithComponentData, type PageWithComponentData } from '@/lib/page-designer/page-loader.server';

@PageType({
    name: 'About Us Page',
    description: 'About Us page containing company information and a contact form.',
    supportedAspectTypes: [],
})
@RegionDefinition([
    {
        id: 'headline',
        name: 'Headline Region',
        description: 'Main content area displayed above the contact form',
        maxComponents: 10,
    },
    {
        id: 'additionalinformation',
        name: 'Additional Information Region',
        description: 'Secondary content area displayed below the contact form',
        maxComponents: 10,
    },
])
export class AboutUsPageMetadata {}

export type AboutUsPageData = {
    page: PageWithComponentData | null;
    pageUrl: string;
    ogImageUrl: string;
};

export async function loader(args: Route.LoaderArgs): Promise<AboutUsPageData> {
    const logger = getLogger(args.context);
    logger.debug('AboutUs: loader starting');

    const requestUrl = new URL(args.request.url);
    return {
        page: await fetchPageWithComponentData(args, {
            pageId: 'aboutus',
        }),
        pageUrl: buildCanonicalUrl(requestUrl.origin, requestUrl.pathname, requestUrl.search),
        ogImageUrl: new URL(heroFoundationsImage, requestUrl.origin).href,
    };
}

/**
 * Brand hero. Full-width editorial image with eyebrow + headline + body and
 * a primary CTA. Reuses the canonical `ContentCard` primitive.
 */
function AboutHero({ t }: { t: TFunction<'aboutUs'> }) {
    return (
        <section aria-labelledby="hero-heading">
            {/* The canonical ContentCard renders its title as h3. We expose an
                h2 here for assistive tech so the hierarchy stays H1 → H2 → H3
                between the page title and the card's headline. */}
            <Typography as="h2" variant="h2" id="hero-heading" className="sr-only">
                {t('hero.eyebrow', { defaultValue: 'Our story' })}
            </Typography>
            <ContentCard
                title={t('hero.headline', {
                    defaultValue: 'Clean ingredients. Every-shade colour. Beauty that fits your day.',
                })}
                description={t('hero.eyebrow', { defaultValue: 'Our story' })}
                imageUrl={heroFoundationsImage}
                imageAlt={t('hero.imageAlt', {
                    defaultValue: 'Foundation bottles arranged in a fan on warm marble.',
                })}
                buttonText={t('hero.ctaText', { defaultValue: 'Shop Skincare' })}
                buttonLink={t('hero.ctaLink', { defaultValue: '/category/newarrivals' })}
                showBackground={false}
                showBorder={false}
                loading="eager"
                className="[&_h3]:text-3xl [&_h3]:md:text-5xl [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:mb-4 [&_h3]:max-w-2xl"
            />
        </section>
    );
}

/**
 * "Our Vision" + "Why We Exist" two-up. Each card pairs an editorial image
 * with a section heading and a single paragraph. Stacks on mobile.
 */
function PrinciplesGrid({ t }: { t: TFunction<'aboutUs'> }) {
    return (
        <section aria-labelledby="principles-heading">
            <Typography as="h2" variant="h2" id="principles-heading" className="sr-only">
                {t('section.principles.heading', { defaultValue: 'Our principles' })}
            </Typography>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ContentCard
                    title={t('section.ourVision.title', { defaultValue: 'Our Vision' })}
                    description={t('section.ourVision.content', {
                        defaultValue:
                            'Beauty that earns its place on your shelf. Every product starts with one question: would we use it every day?',
                    })}
                    imageUrl={heroIngredientsImage}
                    imageAlt={t('section.ourVision.imageAlt', {
                        defaultValue: 'Serum bottles with fresh eucalyptus.',
                    })}
                    showBackground={false}
                    showBorder={false}
                    loading="lazy"
                    className="[&_h3]:text-2xl [&_h3]:font-semibold [&_p]:text-sm [&_p]:md:text-base [&_p]:leading-relaxed"
                />
                <ContentCard
                    title={t('section.ourValue.title', { defaultValue: 'Why We Exist' })}
                    description={t('section.ourValue.content', {
                        defaultValue:
                            'Honest formulas, real shades, and less guesswork. Beauty that fits the people who wear it.',
                    })}
                    imageUrl={heroTextureImage}
                    imageAlt={t('section.ourValue.imageAlt', {
                        defaultValue: 'A pipette drawing a smooth ribbon of cream.',
                    })}
                    showBackground={false}
                    showBorder={false}
                    loading="lazy"
                    className="[&_h3]:text-2xl [&_h3]:font-semibold [&_p]:text-sm [&_p]:md:text-base [&_p]:leading-relaxed"
                />
            </div>
        </section>
    );
}

/**
 * "What We Stand For" four-up pillar grid. Text-only cards with a leading
 * lucide icon. Composed from the canonical `Card` primitive so the shape
 * tokens stay consistent with the rest of the storefront.
 */
function StandardsPillars({ t }: { t: TFunction<'aboutUs'> }) {
    const pillars = [
        {
            id: 'transparency',
            Icon: Beaker,
            title: t('section.standards.pillars.transparency.title', { defaultValue: 'Ingredient transparency' }),
            content: t('section.standards.pillars.transparency.content', {
                defaultValue: 'Every formula lists what is in it and why. No proprietary blends.',
            }),
        },
        {
            id: 'performance',
            Icon: FlaskConical,
            title: t('section.standards.pillars.performance.title', { defaultValue: 'Performance you can feel' }),
            content: t('section.standards.pillars.performance.content', {
                defaultValue: 'Clean is the floor, not the ceiling. Benchmarked against the best in category.',
            }),
        },
        {
            id: 'shade',
            Icon: Palette,
            title: t('section.standards.pillars.shade.title', { defaultValue: 'Shade for everyone' }),
            content: t('section.standards.pillars.shade.content', {
                defaultValue: 'Foundations, tints, and balms developed across every undertone.',
            }),
        },
        {
            id: 'responsibility',
            Icon: Leaf,
            title: t('section.standards.pillars.responsibility.title', { defaultValue: 'Responsibly made' }),
            content: t('section.standards.pillars.responsibility.content', {
                defaultValue: 'Recyclable packaging, refillable formats, suppliers we have met in person.',
            }),
        },
    ];

    return (
        <section className="flex flex-col gap-8" aria-labelledby="standards-heading">
            <header className="flex flex-col gap-3 items-start max-w-2xl">
                <span className="text-xs font-semibold text-primary">
                    {t('section.standards.eyebrow', { defaultValue: 'Our standards' })}
                </span>
                <Typography as="h2" variant="h2" id="standards-heading" className="text-3xl md:text-4xl">
                    {t('section.standards.title', { defaultValue: 'What we stand for' })}
                </Typography>
                <Button asChild variant="outline" className="mt-2">
                    <Link to={t('section.standards.ctaLink', { defaultValue: '/category/top-seller' })}>
                        {t('section.standards.ctaText', { defaultValue: 'See our ingredients' })}
                    </Link>
                </Button>
            </header>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0">
                {pillars.map(({ id, Icon, title, content }) => (
                    <li key={id}>
                        <Card className="h-full">
                            <CardContent className="flex flex-col gap-3 py-2">
                                <span
                                    aria-hidden="true"
                                    className="inline-flex size-10 items-center justify-center rounded-xl bg-accent/40 text-foreground">
                                    <Icon className="size-5" />
                                </span>
                                <Typography as="h3" variant="h5" className="text-base font-semibold">
                                    {title}
                                </Typography>
                                <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
                            </CardContent>
                        </Card>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * Full-bleed CTA banner. Single editorial image with overlayed text and a
 * primary CTA. Reuses `ContentCard` with hero-style layout.
 */
function CommunityCTA({ t }: { t: TFunction<'aboutUs'> }) {
    return (
        <section aria-labelledby="community-heading">
            {/* Sibling h2 anchor for assistive tech, mirroring AboutHero. */}
            <Typography as="h2" variant="h2" id="community-heading" className="sr-only">
                {t('section.community.eyebrow', { defaultValue: 'Join us' })}
            </Typography>
            <ContentCard
                title={t('section.community.title', { defaultValue: 'Become part of the Beauty Next community' })}
                description={t('section.community.eyebrow', { defaultValue: 'Join us' })}
                imageUrl={heroRoutineImage}
                imageAlt={t('section.community.imageAlt', {
                    defaultValue: 'Skincare bottles laid out on warm linen.',
                })}
                buttonText={t('section.community.ctaText', { defaultValue: 'Create your account' })}
                buttonLink={t('section.community.ctaLink', { defaultValue: '/signup' })}
                showBackground={false}
                showBorder={false}
                loading="lazy"
                className="[&_h3]:text-2xl [&_h3]:md:text-3xl [&_h3]:font-semibold"
            />
        </section>
    );
}

/**
 * Closing manifesto. Text-only block with eyebrow, heading, two paragraphs,
 * and an explore CTA. Sits at the bottom on a muted card surface so it
 * reads as a final brand statement.
 */
function ClosingManifesto({ t }: { t: TFunction<'aboutUs'> }) {
    return (
        <Card className="[--ui-border-width:0px] bg-muted/40">
            <CardContent className="flex flex-col gap-4 items-start py-10 md:py-14 max-w-3xl">
                <span className="text-xs font-semibold text-primary">
                    {t('section.closing.eyebrow', { defaultValue: 'Considered beauty, every day' })}
                </span>
                <Typography as="h2" variant="h2" className="text-3xl md:text-4xl">
                    {t('section.closing.title', { defaultValue: 'Beauty that meets you where you are' })}
                </Typography>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                    {t('section.closing.content', {
                        defaultValue:
                            'Built for the morning routine that actually happens. Five minutes or fifty, we slot in.',
                    })}
                </p>
                <p className="text-base md:text-lg text-foreground font-medium leading-relaxed">
                    {t('section.closing.principle', {
                        defaultValue:
                            'Ingredients we would put on our own skin. Shades for the people in our store. Details sweated so getting ready stays easy.',
                    })}
                </p>
                <Button asChild className="mt-2">
                    <Link to={t('section.closing.ctaLink', { defaultValue: '/category/newarrivals' })}>
                        {t('section.closing.ctaText', { defaultValue: 'Explore our formulas' })}
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}

/**
 * Static fallback content for Headline Region: hero + two-up principles +
 * standards pillars. Page Designer overrides the whole stack by adding
 * components to the `headline` region.
 */
function PreContactStaticContent({ t }: { t: TFunction<'aboutUs'> }) {
    return (
        <div className="flex flex-col gap-12">
            <AboutHero t={t} />
            <PrinciplesGrid t={t} />
            <StandardsPillars t={t} />
        </div>
    );
}

/**
 * Static fallback content for Additional Information Region: community CTA
 * + closing manifesto. Sits below the Contact form.
 */
function PostContactStaticContent({ t }: { t: TFunction<'aboutUs'> }) {
    return (
        <div className="flex flex-col gap-12">
            <CommunityCTA t={t} />
            <ClosingManifesto t={t} />
        </div>
    );
}

function AboutUsRegionContent({
    page,
    regionId,
    fallback,
}: {
    page: PageWithComponentData | null;
    regionId: 'headline' | 'additionalinformation';
    fallback: ReactElement;
}) {
    if (!page) {
        return fallback;
    }
    return <Region page={page} regionId={regionId} errorElement={fallback} />;
}

function PreContactRegionContent({ page, t }: { page: PageWithComponentData | null; t: TFunction<'aboutUs'> }) {
    return <AboutUsRegionContent page={page} regionId="headline" fallback={<PreContactStaticContent t={t} />} />;
}

function PostContactRegionContent({ page, t }: { page: PageWithComponentData | null; t: TFunction<'aboutUs'> }) {
    return (
        <AboutUsRegionContent
            page={page}
            regionId="additionalinformation"
            fallback={<PostContactStaticContent t={t} />}
        />
    );
}

/**
 * Cosmetic vertical About Us page. Editorial layout for Beauty Next:
 *   1. Breadcrumb + page title
 *   2. Headline Region (Page Designer) → hero + principles + standards
 *   3. Contact form (always visible)
 *   4. Additional Information Region (Page Designer) → community CTA +
 *      closing manifesto
 *
 * Header and Footer come from the root `_app` layout.
 */
export default function AboutUs({ loaderData }: { loaderData: AboutUsPageData }): ReactElement {
    const { t } = useTranslation('aboutUs');

    return (
        <div className="pb-16">
            <SeoMeta
                title={t('title')}
                description={t('meta.description', {
                    defaultValue: 'Learn more about our story, mission, and the team behind the store.',
                })}
                openGraph={{ type: 'article', url: loaderData.pageUrl, image: loaderData.ogImageUrl }}
            />

            <div className="max-w-screen-2xl mx-auto px-4 pb-8">
                <Breadcrumb className="mb-4">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link to="/">{t('breadcrumb.home')}</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>{t('breadcrumb.aboutUs')}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <Typography as="h1" variant="h1" className="text-4xl md:text-5xl font-semibold tracking-tight">
                    {t('title')}
                </Typography>
                <p className="mt-4 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
                    {t('hero.body')}
                </p>
            </div>

            {/* Headline Region */}
            <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-12">
                <PreContactRegionContent page={loaderData.page} t={t} />
            </div>

            {/* Contact Section */}
            <div className="md:px-8 px-4 py-12 bg-secondary mt-12">
                <div className="max-w-screen-2xl mx-auto">
                    <Contact />
                </div>
            </div>

            {/* Additional Information Region */}
            <div className="max-w-screen-2xl mx-auto px-4 py-12 space-y-12">
                <PostContactRegionContent page={loaderData.page} t={t} />
            </div>
        </div>
    );
}
