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

import { useEffect, useLayoutEffect, useState } from 'react';
import { usePageUIConfig } from '../lib/page-ui-config';

/**
 * Manager that applies page-level UI configuration from route handles to DOM elements.
 *
 * Reads UI configuration from the current route's `handle` export and applies:
 * - Header transparency behavior (scroll-based transition on/off)
 * - Main area padding configuration
 *
 * Data attributes are applied to page elements, enabling per-page styling via CSS selectors.
 * This makes layout behaviors configurable per-page without hardcoding URL patterns.
 *
 * Isolated as a separate component to prevent unnecessary re-renders.
 */
export function PageConfigManager() {
    const uiConfig = usePageUIConfig();

    // Header transparency configuration
    const transparencyEnabled = uiConfig.header?.transparentOnLoad ?? false;
    const [isOnHero, setIsOnHero] = useState(transparencyEnabled);

    // Main padding configuration
    const hasTopPadding = uiConfig.main?.hasTopPadding ?? false;

    // Scroll detection for transparent header state
    useEffect(() => {
        if (!transparencyEnabled) {
            setIsOnHero(false);
            return;
        }

        // Matches Dazzle's beauty header (~80px ≈ header height). With a
        // tighter threshold the scroll-flip can fire while the user
        // perceives themselves still "at top", and the transition starts
        // colliding with their scroll velocity. 80px gives the header
        // its own height of room to settle before transitioning.
        const SCROLL_THRESHOLD = 80;
        let ticking = false;
        let rafId: number | null = null;

        const handleScroll = () => {
            if (!ticking) {
                rafId = window.requestAnimationFrame(() => {
                    const scrolled = window.scrollY > SCROLL_THRESHOLD;
                    setIsOnHero(!scrolled);
                    ticking = false;
                    rafId = null;
                });
                ticking = true;
            }
        };

        // Initial check
        handleScroll();

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
        };
    }, [transparencyEnabled]);

    // Apply header transparency attribute (useLayoutEffect to prevent flash on initial load)
    useLayoutEffect(() => {
        const headerElement = document.querySelector('header');
        if (headerElement) {
            headerElement.setAttribute('data-page-at-top', isOnHero ? 'true' : 'false');
        }
    }, [isOnHero]);

    // Apply hero-bleed attribute on <main> based on the route's static
    // transparency config. Runs on mount and whenever transparency changes
    // across SPA navigation (NOT on every scroll flip) — a hero→non-hero
    // navigation must reset `data-hero-bleed` since PageConfigManager
    // persists in the always-mounted header. Keeping it off the live
    // scroll state means <main>'s padding-top doesn't shift while the
    // header chrome is mid-transition. Same pattern as Dazzle's
    // `isHomepage ? undefined : padding` in _app.tsx — the layout decision
    // is route-driven, not scroll-driven.
    useLayoutEffect(() => {
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.setAttribute('data-hero-bleed', transparencyEnabled ? 'true' : 'false');
        }
    }, [transparencyEnabled]);

    // Apply main padding attribute
    useEffect(() => {
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.setAttribute('data-has-top-padding', hasTopPadding ? 'true' : 'false');
        }
    }, [hasTopPadding]);

    return null;
}
