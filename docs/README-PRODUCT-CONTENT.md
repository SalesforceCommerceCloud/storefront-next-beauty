# Cosmetic PDP product content

The Cosmetic PDP reads shopper-visible product attributes directly from the
Shopper Products response. It does not call the demo product-content API for
these sections.

| PDP section | Product attribute | Content contract |
| --- | --- | --- |
| Ingredients | `c_ingredients` | Optional, localizable plain text. One item per line renders as a list. |
| How to Use | `c_howToUse` | Optional, localizable plain text. One item per line renders as a list. |
| Key Benefits | `c_keyBenefits` | Optional, localizable plain text. One item per line renders as a list. |
| Product Details: Skin Type | `c_skinType` | Optional, localizable short text. |
| Product Details: Finish | `c_pdpFinish` | Optional, localizable short text. |
| Product Details: Coverage | `c_coverage` | Optional, localizable short text. |
| Product Details: Size | `c_size` | Optional, localizable short text. This is distinct from a variation attribute named `size`. |

## Business Manager setup

- Add the attributes to a cosmetic classification category rather than a global
  Product attribute group, so unrelated product types do not show cosmetic
  fields in Business Manager.
- Assign values to the master product when every variation shares the content.
  A variant may override a value when its formula or product detail differs.
- Verify the Shopper Products response for the selected variant contains the
  expected `c_*` fields. The PDP resolves the product returned for its current
  `pid`; it does not fetch the master product separately.

## Content safety

These attributes are plain text only. Do not place HTML, scripts, or product
markup in them. The storefront escapes markup before rendering it, so authored
HTML displays as text.

Blank, whitespace-only, and invalidly typed values omit their corresponding
PDP section. Product Details renders only when at least one details field has a
value, and displays only populated rows.

## Alternative data source

For centrally authored rich content, replace the server functions in
`src/extensions/product-content/lib/api/product-content.server.ts` with a CMS,
PIM, Page Designer-backed service, or a custom SCAPI client. Do not fall back
to the extension's demo fixtures for missing product attributes: those fixtures
are not product-specific.
