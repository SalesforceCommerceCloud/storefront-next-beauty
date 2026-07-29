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
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import Logo from '.';

describe('Logo', () => {
    test('renders SVG with correct aria-label', () => {
        render(<Logo />);
        const logo = screen.getByRole('img', { name: /beauty next/i });
        expect(logo).toBeInTheDocument();
    });

    test('applies custom className', () => {
        const { container } = render(<Logo className="test-class h-10 w-auto" />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('test-class', 'h-10', 'w-auto');
    });

    test('uses currentColor for fill to enable CSS color inheritance', () => {
        // The wordmark is an outlined <path> (no live <text>), so the color hook
        // is fill="currentColor" on the path — the theme drives it via the
        // header/footer logo color tokens.
        const { container } = render(<Logo />);
        const path = container.querySelector('path');
        expect(path).toHaveAttribute('fill', 'currentColor');
    });

    test('renders non-trivial wordmark geometry', () => {
        // Guard against a blanked/garbled export: the aria-label and className
        // live on the <svg>, so they pass even if the path's `d` is empty. Assert
        // the geometry is actually present (multiple sub-paths) so a blank logo
        // can't ship green.
        const { container } = render(<Logo />);
        const d = container.querySelector('path')?.getAttribute('d') ?? '';
        expect(d.length).toBeGreaterThan(100);
        // "Beauty Next" is many glyphs → many moveto (M) commands.
        expect((d.match(/M/g) ?? []).length).toBeGreaterThan(1);
    });
});
