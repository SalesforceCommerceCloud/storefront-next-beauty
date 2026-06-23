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
 * Manager for the SCROLL-DRIVEN header transparency state.
 *
 * Reads `handle.ui.header.transparentOnLoad` and, when enabled, toggles
 * `data-page-at-top` on the header as the user scrolls past the header height
 * (transparent → opaque transition). This is genuinely interactive state, so it
 * lives in a client component.
 *
 * NOTE: the STATIC, handle-derived layout attributes — `data-has-top-padding`
 * and `data-hero-bleed` on `<main>` — are NOT set here. They're reflected onto
 * `<main>` during render by the canonical shell (`routes/_app.tsx` via
 * `mainPaddingDataAttributes`), so the correct padding ships in the SSR'd HTML.
 * Setting them in a post-hydration effect here previously caused a ~2rem layout
 * shift on the PDP/cart (CLS ~0.25). Keep layout-affecting, route-static
 * attributes server-rendered; keep only scroll/interaction state in this effect.
 *
 * Isolated as a separate component to prevent unnecessary re-renders.
 */
export function PageConfigManager() {
    const uiConfig = usePageUIConfig();

    // Header transparency configuration
    const transparencyEnabled = uiConfig.header?.transparentOnLoad ?? false;
    const [isOnHero, setIsOnHero] = useState(transparencyEnabled);

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

    // NOTE: `data-hero-bleed` and `data-has-top-padding` on <main> are
    // reflected at render time by the canonical shell (routes/_app.tsx), NOT
    // here — see this component's header comment. Setting them in an effect
    // would re-introduce the post-hydration padding jump (CLS).

    return null;
}
