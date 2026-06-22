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

interface LogoProps {
    className?: string;
}

export default function Logo({ className }: LogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 520 200"
            role="img"
            aria-label="Dazzle Beauty Essentials"
            preserveAspectRatio="xMidYMid meet"
            className={className}>
            <g fill="currentColor">
                <text
                    x="260"
                    y="118"
                    textAnchor="middle"
                    fontFamily="'Lora', Georgia, 'Iowan Old Style', 'Palatino Linotype', Palatino, serif"
                    fontWeight="500"
                    fontSize="140"
                    letterSpacing="2">
                    Dazzle
                </text>
                <text
                    x="260"
                    y="170"
                    textAnchor="middle"
                    fontFamily="'Lora', Georgia, 'Iowan Old Style', 'Palatino Linotype', Palatino, serif"
                    fontWeight="400"
                    fontSize="22"
                    letterSpacing="6"
                    opacity="0.78">
                    BEAUTY ESSENTIALS
                </text>
            </g>
        </svg>
    );
}
