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
import { type ReactElement, Suspense } from 'react';
import { Await, redirect, type ShouldRevalidateFunctionArgs } from 'react-router';
import type { Route } from './+types/_app.wishlist';
import { loadWishlistPageData, type WishlistPageData } from '@/lib/api/wishlist.server';
import { WishlistPageContent, WishlistSkeleton } from '@/components/wishlist/wishlist-page';
import { WishlistLoadError } from '@/components/wishlist/wishlist-load-error';
import { SeoMeta } from '@/components/seo-meta';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from '@/components/link';
import { getLogger } from '@/lib/logger.server';
import { getAuth } from '@/middlewares/auth.server';
import { hasUsableShopperSession } from '@/middlewares/auth.utils';
import { buildUrlFromContext } from '@/lib/url.server';
import { useTranslation } from 'react-i18next';
import { WishlistPageAnalytics } from '@/analytics/wishlist-page-analytics';
import { resourceRoutes, routes } from '@/route-paths';

/**
 * Cosmetic-vertical guest wishlist. Mirrors the canonical loader and error
 * boundary; restyles only the page wrapper and the guest sign-in banner so
 * gutters and surface tokens follow the rest of the cosmetic vertical.
 */
export async function loader({ context }: Route.LoaderArgs): Promise<WishlistPageData> {
    const logger = getLogger(context);
    logger.debug('Wishlist (guest, cosmetic): loader starting');

    const session = getAuth(context);
    if (session.userType === 'registered' && hasUsableShopperSession(session)) {
        throw redirect(buildUrlFromContext(routes.accountWishlist, context));
    }

    return loadWishlistPageData(context);
}

export function shouldRevalidate({ formAction, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
    if (formAction === resourceRoutes.wishlistRemove) {
        return false;
    }
    return defaultShouldRevalidate;
}

export function ErrorBoundary(): ReactElement {
    return <WishlistLoadError retryHref={routes.wishlist} />;
}

export default function GuestWishlist({
    loaderData,
}: {
    loaderData: Awaited<ReturnType<typeof loader>>;
}): ReactElement {
    const { t } = useTranslation('account');
    return (
        <div data-testid="cosmetic-wishlist-wrapper" className="section-container py-8">
            <WishlistPageAnalytics />
            <SeoMeta title={t('meta.wishlistTitle', { defaultValue: 'Wishlist' })} />
            <Alert className="mb-5 bg-muted/40 border-border">
                <AlertDescription>
                    {t('wishlist.guestKeepItemsBanner', {
                        defaultValue: 'Sign in to keep your saved products with you across devices.',
                    })}{' '}
                    <Link
                        to={`${routes.login}?returnUrl=${routes.wishlist}`}
                        className="font-medium text-primary hover:underline">
                        {t('wishlist.guestKeepItemsBannerCta', { defaultValue: 'Sign in' })}
                    </Link>
                </AlertDescription>
            </Alert>
            <Suspense fallback={<WishlistSkeleton />}>
                <Await resolve={loaderData.productsByProductId}>
                    {(productsByProductId) => (
                        <WishlistPageContent items={loaderData.items} productsByProductId={productsByProductId} />
                    )}
                </Await>
            </Suspense>
        </div>
    );
}
