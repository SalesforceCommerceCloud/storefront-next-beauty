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

/**
 * Cosmetic vertical header override
 *
 * Extends the base header with a centered logo layout using a 3-column grid:
 * - Left: Navigation menu
 * - Center: Logo (geometrically centered)
 * - Right: Search, user actions, cart
 */

import { type ReactElement, type ReactNode, type PropsWithChildren, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router';
import { Link } from '@/components/link';
import Search from '@/components/header/search';
import CartBadge from '@/components/header/cart-badge';
import UserActions from '@/components/header/user-actions/user-actions';
import { useTranslation } from 'react-i18next';
import Logo from '../logo';
import { Button } from '@/components/ui/button';
import { SparklesIcon } from '@/components/icons';
import { useConfig } from '@salesforce/storefront-next-runtime/config';
import type { AppConfig } from '@/types/config';
import { openAgentWidget, isCimulateEnabled, validateCimulateConfig } from '@/components/cimulate';
import { UITarget } from '@/targets/ui-target';
import { cn } from '@/lib/utils';
import { Component } from '@/lib/decorators/component';
import { RegionDefinition } from '@/lib/decorators';
import { PageConfigManager } from '../page-config-manager';

// Page Designer metadata for the embedded Layout.header component. Declares the
// HeaderMetadata shape the header registry entry and the
// header.index.test.tsx HeaderMetadata assertions resolve against.
@Component('header', {
    name: 'Header',
    group: 'Layout',
    description: 'Global site header with navigation, search, and cart',
    embedded: true,
    component_id: 'header',
})
@RegionDefinition([{ id: 'announcement', name: 'Announcement' }])
export class HeaderMetadata {}

interface HeaderProps extends PropsWithChildren {
    beforeHeader?: ReactNode;
    /**
     * Slot rendered above the header's main row. Used for announcement banners
     * or other above-the-fold content that should sit at the top of the page.
     */
    announcementSlot?: ReactNode;
    variant?: 'full' | 'checkout';
}

function LocationKeyedSearch() {
    const location = useLocation();
    return <Search key={`${location.pathname}${location.search}`} />;
}

export default function Header({
    children,
    beforeHeader,
    announcementSlot,
    variant = 'full',
}: HeaderProps): ReactElement {
    const { t } = useTranslation('header');
    const headerRef = useRef<HTMLElement>(null);
    const config = useConfig<AppConfig>();
    const showChat =
        variant === 'full' &&
        isCimulateEnabled(config.cimulateAgent?.enabled) &&
        validateCimulateConfig(config.cimulateAgent);

    const updateHeaderHeight = useCallback(() => {
        if (headerRef.current) {
            const height = `${headerRef.current.offsetHeight}px`;
            headerRef.current.style.setProperty('--header-height', height);
            document.documentElement.style.setProperty('--header-height', height);
        }
    }, []);

    const handleNavMouseOver = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as Element;
        const trigger = target.closest('[data-slot="navigation-menu-trigger"]');
        if (trigger?.hasAttribute('data-has-submenu')) {
            document.documentElement.setAttribute('data-mega-menu-open', 'true');
        }
    }, []);

    const handleNavFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
        const target = e.target as Element;
        const trigger = target.closest('[data-slot="navigation-menu-trigger"]');
        if (trigger?.hasAttribute('data-has-submenu')) {
            document.documentElement.setAttribute('data-mega-menu-open', 'true');
        }
    }, []);

    const handleNavMouseLeave = useCallback(() => {
        // Only remove attribute if no submenu is currently open
        const openTrigger = document.querySelector('[data-slot="navigation-menu-trigger"][data-state="open"]');
        if (!openTrigger) {
            document.documentElement.removeAttribute('data-mega-menu-open');
        }
    }, []);

    useEffect(() => {
        const el = headerRef.current;
        if (!el) return;
        updateHeaderHeight();
        const observer = new ResizeObserver(updateHeaderHeight);
        observer.observe(el);
        return () => observer.disconnect();
    }, [updateHeaderHeight]);

    // Watch for submenu state changes (both mouse and keyboard navigation)
    useEffect(() => {
        const observer = new MutationObserver(() => {
            const openTrigger = document.querySelector('[data-slot="navigation-menu-trigger"][data-state="open"]');
            if (openTrigger) {
                document.documentElement.setAttribute('data-mega-menu-open', 'true');
            } else {
                document.documentElement.removeAttribute('data-mega-menu-open');
            }
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-state'],
            subtree: true,
        });

        return () => observer.disconnect();
    }, []);

    if (variant === 'checkout') {
        return (
            <header
                ref={headerRef}
                className="bg-header-background text-header-foreground border-b border-header-border sticky top-0 z-50">
                <div className="section-container">
                    <div className="flex items-center h-16">
                        <Link to="/" className="flex-shrink-0 flex items-center" data-testid="header-logo">
                            <Logo className="header-logo h-10 lg:h-14 w-auto transition-colors duration-300 ease-out" />
                        </Link>
                        <div className="flex-1" />
                        <CartBadge />
                    </div>
                </div>
            </header>
        );
    }

    // Centered logo layout: 3-column grid with logo in the center
    // Fixed positioning allows content to bleed behind the header
    //
    // Scroll-to-solid transition: when `data-page-at-top` flips from true →
    // false, the header chrome interpolates from transparent-on-hero state
    // to its solid cream surface. We transition every chrome property
    // together (bg, border, color) with the same duration + easing so the
    // change reads as a single coherent fade rather than several
    // independent property snaps. (Cosmetic's logo is an inline SVG
    // recolored via `color`, not `filter` — so unlike the canonical
    // raster-logo header there's no `filter` to animate here.)
    return (
        <header
            ref={headerRef}
            data-page-at-top="true"
            className={cn(
                'bg-header-background text-header-foreground fixed top-0 left-0 right-0 z-50',
                'border-b border-header-border',
                'transition-[background-color,border-color,color] duration-300 ease-out'
            )}>
            {/* PageConfigManager applies page-level UI config (header transparency, main padding)
                to DOM elements via data attributes. Rendered here instead of _app.tsx to avoid
                duplicating ~120 lines of layout code. Header is always present on _app.* routes,
                and the manager uses document.querySelector() so placement doesn't affect functionality. */}
            <PageConfigManager />
            {announcementSlot}
            <UITarget targetId="sfcc.header.promo.top" />
            {beforeHeader}
            <div className="section-container py-6">
                {/* Three-column grid: nav (left) · centered logo · actions (right) */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4">
                    {/* LEFT — Navigation menu */}
                    <div className="flex items-center justify-start gap-x-4 lg:gap-x-6">
                        <div className="lg:hidden flex items-center">{children}</div>
                        <div
                            className="hidden lg:flex items-center"
                            onMouseOver={handleNavMouseOver}
                            onFocus={handleNavFocus}
                            onMouseLeave={handleNavMouseLeave}>
                            {children}
                        </div>
                    </div>

                    {/* CENTER — Logo (geometrically centered) */}
                    <Link
                        to="/"
                        className="flex-shrink-0 flex items-center justify-self-center"
                        data-testid="header-logo">
                        <Logo className="header-logo h-10 lg:h-14 w-auto transition-colors duration-300 ease-out" />
                    </Link>

                    {/* RIGHT — Search + chat + user + cart */}
                    <div className="flex items-center justify-end gap-x-1 lg:gap-x-2">
                        <div className="hidden lg:block" data-testid="header-search-desktop">
                            <LocationKeyedSearch />
                        </div>
                        <UITarget targetId="sfcc.header.before.cart" />
                        {showChat && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="cursor-pointer lg:px-2 px-1 hover:bg-transparent hover:opacity-60 transition-opacity"
                                onClick={() => openAgentWidget()}
                                aria-label={t('openChat')}>
                                <SparklesIcon />
                            </Button>
                        )}
                        <UserActions />
                        <CartBadge />
                    </div>
                </div>

                {/* Mobile search - second row */}
                <div className="pb-2 pt-3 lg:hidden" data-testid="header-search-mobile">
                    <LocationKeyedSearch />
                </div>
                <UITarget targetId="sfcc.header.bnpl.banner" />
            </div>
        </header>
    );
}
