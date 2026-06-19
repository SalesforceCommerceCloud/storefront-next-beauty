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

// ============================================================================
// MONOREPO MODE
// ============================================================================
// In monorepo: This file imports the base config from the parent (../../eslint.config.js)
//              and adds template-specific Storybook overrides from eslint.storybook-overrides.js
//
// In mirror repo: This entire file is REPLACED by scripts/generate-eslint-config.js
//                 which reads the parent config and merges it with Storybook overrides.
//
// IMPORTANT: Storybook overrides are maintained in eslint.storybook-overrides.js
//            Update that file if you need to modify Storybook-specific rules.
// ============================================================================

const baseConfig = await import('../../eslint.config.js');
const { storybookOverrides } = await import('./eslint.storybook-overrides.js');

export default [
    { ignores: ['e2e/**'] }, // E2E sub-package has its own eslint.config.mjs
    ...baseConfig.default,
    ...storybookOverrides,
];
