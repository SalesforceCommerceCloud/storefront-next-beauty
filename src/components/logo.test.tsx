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
import Logo from './logo';

describe('Logo', () => {
    test('renders SVG with correct aria-label', () => {
        render(<Logo />);
        const logo = screen.getByRole('img', { name: /dazzle beauty essentials/i });
        expect(logo).toBeInTheDocument();
    });

    test('applies custom className', () => {
        const { container } = render(<Logo className="test-class h-10 w-auto" />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('test-class', 'h-10', 'w-auto');
    });

    test('uses currentColor for fill to enable CSS color inheritance', () => {
        const { container } = render(<Logo />);
        const group = container.querySelector('g');
        expect(group).toHaveAttribute('fill', 'currentColor');
    });

    test('contains "Dazzle" text', () => {
        const { container } = render(<Logo />);
        const svg = container.innerHTML;
        expect(svg).toContain('Dazzle');
    });

    test('contains "BEAUTY ESSENTIALS" text', () => {
        const { container } = render(<Logo />);
        const svg = container.innerHTML;
        expect(svg).toContain('BEAUTY ESSENTIALS');
    });
});
