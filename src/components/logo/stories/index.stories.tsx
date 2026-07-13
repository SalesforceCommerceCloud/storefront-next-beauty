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
import type { Meta, StoryObj } from '@storybook/react-vite';
import Logo from '../index';

const meta: Meta<typeof Logo> = {
    title: 'Cosmetic/Logo',
    component: Logo,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'The "Beauty Next" inline-SVG wordmark, used in the header and error page. The SVG fills with `currentColor` and carries its own `aria-label`; sizing and color come from the caller via `className`.',
            },
        },
    },
    argTypes: {
        // The SVG inherits color from `currentColor` and size from `className`
        // (e.g. the header passes `h-4 w-auto text-foreground`). Hidden as
        // utility noise per the Designer-Friendly Input Rule.
        className: { control: false, table: { disable: true } },
    },
};

export default meta;
type Story = StoryObj<typeof Logo>;

export const Default: Story = {
    args: { className: 'h-10 w-auto text-foreground' },
};
