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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { PageConfigManager } from './page-config-manager';
import { usePageUIConfig, type PageUIConfig } from '../lib/page-ui-config';

// Mock the usePageUIConfig hook
vi.mock('../lib/page-ui-config', () => ({
    usePageUIConfig: vi.fn(),
}));

describe('PageConfigManager', () => {
    let headerElement: HTMLElement;
    let mainElement: HTMLElement;
    let scrollListeners: Array<(event: Event) => void> = [];
    let rafCallbacks: Map<number, FrameRequestCallback> = new Map();
    let rafIdCounter = 0;

    beforeEach(() => {
        // Create DOM elements that the component will query
        headerElement = document.createElement('header');
        mainElement = document.createElement('main');
        document.body.appendChild(headerElement);
        document.body.appendChild(mainElement);

        // Mock window.scrollY
        Object.defineProperty(window, 'scrollY', {
            writable: true,
            value: 0,
        });

        // Track scroll event listeners
        scrollListeners = [];

        vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
            if (event === 'scroll' && typeof handler === 'function') {
                scrollListeners.push(handler);
            }
        });

        vi.spyOn(window, 'removeEventListener').mockImplementation((event, handler) => {
            if (event === 'scroll' && typeof handler === 'function') {
                scrollListeners = scrollListeners.filter((h) => h !== handler);
            }
        });

        // Reset RAF state
        rafCallbacks = new Map();
        rafIdCounter = 0;

        // Mock requestAnimationFrame - store callbacks and return unique IDs
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            const id = ++rafIdCounter;
            rafCallbacks.set(id, callback);
            // Execute callback on next tick (unless canceled)
            void Promise.resolve().then(() => {
                if (rafCallbacks.has(id)) {
                    callback(0);
                    rafCallbacks.delete(id);
                }
            });
            return id;
        });

        // Mock cancelAnimationFrame - remove pending callbacks
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
            rafCallbacks.delete(id);
        });
    });

    afterEach(() => {
        if (headerElement.parentNode) {
            document.body.removeChild(headerElement);
        }
        if (mainElement.parentNode) {
            document.body.removeChild(mainElement);
        }
        vi.clearAllMocks();
        scrollListeners = [];
    });

    describe('scroll detection with transparent header enabled', () => {
        beforeEach(() => {
            vi.mocked(usePageUIConfig).mockReturnValue({
                header: { transparentOnLoad: true },
            } as PageUIConfig);
        });

        it('sets data-page-at-top="true" initially when at top', () => {
            Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
            render(<PageConfigManager />);

            expect(headerElement.getAttribute('data-page-at-top')).toBe('true');
        });

        it('sets data-page-at-top="false" when scrolled past threshold', async () => {
            render(<PageConfigManager />);

            // Simulate scroll past threshold (>80px)
            Object.defineProperty(window, 'scrollY', { value: 100, writable: true });

            // Trigger scroll event within act to properly flush effects
            await act(async () => {
                scrollListeners.forEach((handler) => handler(new Event('scroll')));
                await Promise.resolve();
            });

            expect(headerElement.getAttribute('data-page-at-top')).toBe('false');
        });

        it('sets data-page-at-top="true" when scrolled below threshold', async () => {
            // Start scrolled down
            Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
            render(<PageConfigManager />);

            // Wait for initial scroll check to complete
            await act(async () => {
                await Promise.resolve();
            });

            expect(headerElement.getAttribute('data-page-at-top')).toBe('false');

            // Scroll back to top
            Object.defineProperty(window, 'scrollY', { value: 50, writable: true });

            await act(async () => {
                scrollListeners.forEach((handler) => handler(new Event('scroll')));
                await Promise.resolve();
            });

            expect(headerElement.getAttribute('data-page-at-top')).toBe('true');
        });

        it('attaches scroll listener when transparentOnLoad is true', () => {
            render(<PageConfigManager />);

            expect(scrollListeners.length).toBe(1);
        });

        it('removes scroll listener on unmount', () => {
            const { unmount } = render(<PageConfigManager />);

            expect(scrollListeners.length).toBe(1);

            unmount();

            expect(scrollListeners.length).toBe(0);
        });

        it('uses requestAnimationFrame to throttle scroll updates', async () => {
            render(<PageConfigManager />);

            Object.defineProperty(window, 'scrollY', { value: 100, writable: true });

            await act(async () => {
                scrollListeners.forEach((handler) => handler(new Event('scroll')));
                await Promise.resolve();
            });

            expect(window.requestAnimationFrame).toHaveBeenCalled();
        });
    });

    describe('scroll detection with transparent header disabled', () => {
        beforeEach(() => {
            vi.mocked(usePageUIConfig).mockReturnValue({
                header: { transparentOnLoad: false },
            } as PageUIConfig);
        });

        it('sets data-page-at-top="false" when transparentOnLoad is false', () => {
            render(<PageConfigManager />);

            expect(headerElement.getAttribute('data-page-at-top')).toBe('false');
        });

        it('does not attach scroll listener when transparentOnLoad is false', () => {
            render(<PageConfigManager />);

            expect(scrollListeners.length).toBe(0);
        });
    });

    describe('main padding configuration', () => {
        // `data-has-top-padding` / `data-hero-bleed` on <main> are no longer set
        // by PageConfigManager — they're reflected at render time by the
        // canonical shell (routes/_app.tsx via mainPaddingDataAttributes) so the
        // padding ships in the SSR'd HTML and never shifts post-hydration. This
        // component must therefore NOT touch <main>; assert that explicitly.
        it('does not set data-has-top-padding on <main> (handled by the canonical shell at render)', () => {
            vi.mocked(usePageUIConfig).mockReturnValue({
                main: { hasTopPadding: true },
            } as PageUIConfig);

            render(<PageConfigManager />);

            expect(mainElement.hasAttribute('data-has-top-padding')).toBe(false);
        });

        it('does not set data-hero-bleed on <main> (handled by the canonical shell at render)', () => {
            vi.mocked(usePageUIConfig).mockReturnValue({
                header: { transparentOnLoad: true },
            } as PageUIConfig);

            render(<PageConfigManager />);

            expect(mainElement.hasAttribute('data-hero-bleed')).toBe(false);
        });
    });

    describe('combined configuration', () => {
        it('drives header scroll state without touching <main>', async () => {
            vi.mocked(usePageUIConfig).mockReturnValue({
                header: { transparentOnLoad: true },
                main: { hasTopPadding: true },
            } as PageUIConfig);

            render(<PageConfigManager />);

            expect(headerElement.getAttribute('data-page-at-top')).toBe('true');
            // <main> attributes are the canonical shell's responsibility, not this component's.
            expect(mainElement.hasAttribute('data-has-top-padding')).toBe(false);

            // Verify scroll still works
            Object.defineProperty(window, 'scrollY', { value: 100, writable: true });

            await act(async () => {
                scrollListeners.forEach((handler) => handler(new Event('scroll')));
                await Promise.resolve();
            });

            expect(headerElement.getAttribute('data-page-at-top')).toBe('false');
        });
    });

    describe('edge cases', () => {
        it('handles missing header element gracefully', () => {
            document.body.removeChild(headerElement);

            vi.mocked(usePageUIConfig).mockReturnValue({
                header: { transparentOnLoad: true },
            } as PageUIConfig);

            expect(() => render(<PageConfigManager />)).not.toThrow();
        });

        it('handles missing main element gracefully', () => {
            document.body.removeChild(mainElement);

            vi.mocked(usePageUIConfig).mockReturnValue({
                main: { hasTopPadding: true },
            } as PageUIConfig);

            expect(() => render(<PageConfigManager />)).not.toThrow();
        });

        it('respects exact threshold boundary (80px)', async () => {
            vi.mocked(usePageUIConfig).mockReturnValue({
                header: { transparentOnLoad: true },
            } as PageUIConfig);

            render(<PageConfigManager />);

            // Exactly at threshold should still be "at top"
            Object.defineProperty(window, 'scrollY', { value: 80, writable: true });

            await act(async () => {
                scrollListeners.forEach((handler) => handler(new Event('scroll')));
                await Promise.resolve();
            });

            expect(headerElement.getAttribute('data-page-at-top')).toBe('true');

            // Just past threshold should be "not at top"
            Object.defineProperty(window, 'scrollY', { value: 81, writable: true });

            await act(async () => {
                scrollListeners.forEach((handler) => handler(new Event('scroll')));
                await Promise.resolve();
            });

            expect(headerElement.getAttribute('data-page-at-top')).toBe('false');
        });
    });

    describe('RAF cleanup', () => {
        beforeEach(() => {
            vi.mocked(usePageUIConfig).mockReturnValue({
                header: { transparentOnLoad: true },
            } as PageUIConfig);
        });

        it('cancels pending RAF callback when component unmounts', () => {
            const { unmount } = render(<PageConfigManager />);

            // Trigger scroll to schedule a RAF callback
            act(() => {
                scrollListeners.forEach((handler) => handler(new Event('scroll')));
            });

            // Verify RAF was scheduled
            expect(window.requestAnimationFrame).toHaveBeenCalled();

            // Get the RAF ID that was returned (the most recent call)
            const calls = vi.mocked(window.requestAnimationFrame).mock.results;
            const rafId = calls[calls.length - 1]?.value;

            // Unmount before RAF callback executes
            unmount();

            // Verify cancelAnimationFrame was called with the correct RAF ID
            expect(window.cancelAnimationFrame).toHaveBeenCalled();
            expect(window.cancelAnimationFrame).toHaveBeenCalledWith(rafId);
        });

        it('cancels pending RAF callback when transparencyEnabled changes', async () => {
            const { rerender } = render(<PageConfigManager />);

            // Wait for initial RAF to complete
            await act(async () => {
                await Promise.resolve();
            });

            // Clear previous RAF calls
            vi.mocked(window.requestAnimationFrame).mockClear();
            vi.mocked(window.cancelAnimationFrame).mockClear();

            // Trigger scroll to schedule a RAF callback
            act(() => {
                scrollListeners.forEach((handler) => handler(new Event('scroll')));
            });

            // Verify RAF was scheduled
            expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

            // Get the RAF ID that was returned
            const rafId = vi.mocked(window.requestAnimationFrame).mock.results[0]?.value;

            // Change config to disable transparency (triggers effect cleanup)
            vi.mocked(usePageUIConfig).mockReturnValue({
                header: { transparentOnLoad: false },
            } as PageUIConfig);

            // Rerender immediately before RAF callback executes
            act(() => {
                rerender(<PageConfigManager />);
            });

            // Verify cancelAnimationFrame was called with the correct RAF ID
            expect(window.cancelAnimationFrame).toHaveBeenCalled();
            expect(window.cancelAnimationFrame).toHaveBeenCalledWith(rafId);
        });

        it('does not call state setter if RAF is canceled before execution', async () => {
            const { unmount } = render(<PageConfigManager />);

            // Set initial state
            await act(async () => {
                await Promise.resolve();
            });
            expect(headerElement.getAttribute('data-page-at-top')).toBe('true');

            // Scroll to trigger RAF (which would set to false)
            Object.defineProperty(window, 'scrollY', { value: 100, writable: true });

            act(() => {
                scrollListeners.forEach((handler) => handler(new Event('scroll')));
            });

            // Unmount immediately (cancels the RAF)
            unmount();

            // Wait for any pending promises
            await act(async () => {
                await Promise.resolve();
            });

            // State should still be "true" because RAF was canceled
            // Note: We can't directly verify the state wasn't updated since the component
            // is unmounted, but we verified cancelAnimationFrame was called which prevents
            // the stale setState from firing
            expect(window.cancelAnimationFrame).toHaveBeenCalled();
        });

        it('allows RAF to complete when not canceled', async () => {
            render(<PageConfigManager />);

            // Trigger scroll
            Object.defineProperty(window, 'scrollY', { value: 100, writable: true });

            await act(async () => {
                scrollListeners.forEach((handler) => handler(new Event('scroll')));
                await Promise.resolve();
            });

            // RAF completed and updated state
            expect(headerElement.getAttribute('data-page-at-top')).toBe('false');
            expect(window.cancelAnimationFrame).not.toHaveBeenCalled();
        });

        it('clears RAF ID after callback executes', async () => {
            render(<PageConfigManager />);

            // Trigger scroll
            Object.defineProperty(window, 'scrollY', { value: 100, writable: true });

            await act(async () => {
                scrollListeners.forEach((handler) => handler(new Event('scroll')));
                await Promise.resolve();
            });

            // RAF executed and was removed from pending callbacks
            expect(rafCallbacks.size).toBe(0);
        });
    });
});
