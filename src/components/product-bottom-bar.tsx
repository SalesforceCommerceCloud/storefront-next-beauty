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

import { type ReactElement, useState, useEffect } from 'react';
import type { ShopperProducts } from '@/scapi';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProductView } from '@/providers/product-view';
import { useProductImages } from '@/hooks/product/use-product-images';
import { useSelectedVariations } from '@/hooks/product/use-selected-variations';
import ProductPrice from '@/components/product-price';
import { DynamicImage } from '@/components/dynamic-image';
import { useTranslation } from 'react-i18next';

interface ProductBottomBarProps {
    product: ShopperProducts.schemas['Product'];
}

/**
 * Bottom bar that appears when the main add-to-cart button scrolls out of view.
 * Shows product image, price, and add-to-cart action.
 * Cosmetic vertical only.
 */
export default function ProductBottomBar({ product }: ProductBottomBarProps): ReactElement {
    const { t } = useTranslation('product');
    const [isVisible, setIsVisible] = useState(false);
    const selectedAttributes = useSelectedVariations({ product });
    const { galleryImages } = useProductImages({ product, selectedAttributes });

    // Access ProductView context for add-to-cart logic
    const { handleAddToCart, isAddingToOrUpdatingCart, canAddToCart } = useProductView();

    // Get first image from gallery
    const primaryImage = galleryImages[0];

    // Track main add-to-cart button visibility
    useEffect(() => {
        const mainButton = document.querySelector('[data-slot="add-to-cart-button"]');
        if (!mainButton) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(!entry.isIntersecting);
            },
            {
                threshold: 0,
                rootMargin: '0px 0px -80px 0px',
            }
        );

        observer.observe(mainButton);

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <div
            data-slot="product-bottom-bar"
            className={cn(
                'fixed bottom-0 left-0 right-0 z-40',
                'border-t border-border bg-card',
                'shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]',
                'transition-transform duration-200 ease-out',
                isVisible ? 'translate-y-0' : 'translate-y-full'
            )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="section-container py-3">
                <div className="flex items-center gap-3 md:gap-6">
                    {/* Product Image - Hidden on mobile */}
                    {primaryImage && (
                        <DynamicImage
                            src={primaryImage.src}
                            alt={primaryImage.alt || product.name}
                            className="hidden md:block h-12 w-12 rounded-md object-cover border border-border"
                            widths={[48]}
                            loading="lazy"
                        />
                    )}

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <div className="text-sm text-muted-foreground">
                            <ProductPrice
                                product={product}
                                currency={product.currency || 'USD'}
                                currentPriceProps={{ className: 'text-sm' }}
                            />
                        </div>
                    </div>

                    {/* Add to Cart Button - matches canonical button styling exactly */}
                    <Button
                        onClick={() => void handleAddToCart()}
                        disabled={!canAddToCart || isAddingToOrUpdatingCart}
                        size="lg"
                        className="text-base font-semibold leading-6 shrink-0 min-w-[140px] md:min-w-[200px]">
                        {isAddingToOrUpdatingCart ? t('addingToCart') : t('addToCart')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
