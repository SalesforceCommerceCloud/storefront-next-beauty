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

import { useMatches } from 'react-router';

/**
 * UI configuration for a page, embedded in the route module via `handle` export.
 * These properties control UI behaviors like header appearance.
 *
 * Export this from your route module to configure page-level UI behavior:
 *
 * @example
 * ```tsx
 * // In routes/_app._index.tsx (home page)
 * export const handle = {
 *   ui: {
 *     header: { transparentOnLoad: true }
 *   }
 * };
 * ```
 *
 * Later, these properties can be promoted to Page Designer properties
 * to make them configurable by business users.
 */
export interface PageUIConfig {
    /**
     * Header configuration for this page.
     */
    header?: {
        /**
         * When true, the header starts transparent and becomes opaque on scroll.
         * When false, the header is always opaque.
         *
         * @default false
         *
         * @example
         * ```tsx
         * // Home page with transparent header
         * export const handle = {
         *   ui: { header: { transparentOnLoad: true } }
         * };
         * ```
         */
        transparentOnLoad?: boolean;
    };
    /**
     * Main content area configuration for this page.
     */
    main?: {
        /**
         * When true, adds extra vertical spacing (--ui-vertical-spacing token) to the top
         * of the main content area, in addition to the dynamic header height.
         *
         * @default false
         *
         * @example
         * ```tsx
         * // PDP with extra top spacing
         * export const handle = {
         *   ui: { main: { hasTopPadding: true } }
         * };
         * ```
         */
        hasTopPadding?: boolean;
    };
}

/**
 * Hook that returns UI configuration from the current matched route.
 * Reads the `handle.ui` property exported from the route module.
 *
 * @returns PageUIConfig from the leaf route, or empty object if not defined
 *
 * @example
 * ```tsx
 * function TransparentHeaderManager() {
 *   const uiConfig = usePageUIConfig();
 *   const enableTransparency = uiConfig.header?.transparentOnLoad ?? false;
 *
 *   const [isOnHero, setIsOnHero] = useState(enableTransparency);
 *
 *   useEffect(() => {
 *     if (!enableTransparency) return;
 *     // ... scroll detection logic
 *   }, [enableTransparency]);
 * }
 * ```
 */
export function usePageUIConfig(): PageUIConfig {
    const matches = useMatches();
    const leafMatch = matches[matches.length - 1];

    if (!leafMatch?.handle) {
        return {};
    }

    // The route handle can contain the UI config
    const handle = leafMatch.handle as { ui?: PageUIConfig };
    return handle.ui ?? {};
}
