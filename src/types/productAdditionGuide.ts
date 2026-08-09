/**
 * Admin Product Management Guide
 * Step-by-step instructions for adding new products using the existing system
 */

/**
 * ADDING A NEW PRODUCT TYPE USING THE EXISTING SYSTEM
 * 
 * The current card printing system is designed to be flexible and extensible.
 * You can add new product types by following this pattern.
 * 
 * CURRENT STRUCTURE:
 * - Product Type: Card Printing (BoardType-based)
 * - Extra Options: Sizes, Print Sides, Laminations, Finish Options
 * - Quantity-based Pricing: Support for price tiers
 */

// ============================================================================
// METHOD 1: ADD NEW PRODUCT TYPE USING EXISTING SYSTEM
// ============================================================================

/**
 * Example: Adding a "Brochure Printing" Product
 * 
 * Same structure as cards, just different extra options
 */

export interface BrochureProduct {
  id: string;
  name: string;
  description: string;
  boardTypes: BrochureBoard[]; // Different board types for brochures
  createdAt: Date;
  updatedAt: Date;
}

export interface BrochureBoard {
  id: string;
  name: string;
  label: string;
  description: string;
  gsm: number;
  basePrice: number;
  quantityPricing: PriceOption[];
  
  // Different extra options for brochures
  sizes: BrochureSize[]; // A5, A4, A3, etc.
  folds: BrochureFold[]; // 2-fold, 3-fold, etc.
  pages: BrochurePage[]; // 4 pages, 8 pages, etc.
  printOptions: PrintOption[]; // Color, B&W
  finishOptions: FinishOption[];
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrochureSize {
  id: string;
  name: string;
  label: string;
  dimensions: { width: number; height: number; unit: string };
  basePrice: number;
  quantityPricing: PriceOption[];
}

export interface BrochureFold {
  id: string;
  name: string;
  label: string;
  basePrice: number;
  quantityPricing: PriceOption[];
}

export interface BrochurePage {
  id: string;
  name: string;
  label: string;
  pageCount: number;
  basePrice: number;
  quantityPricing: PriceOption[];
}

export interface PrintOption {
  id: string;
  name: string;
  label: string;
  basePrice: number;
  quantityPricing: PriceOption[];
}

export interface PriceOption {
  minQuantity: number;
  maxQuantity: number | null;
  price: number;
}

export interface FinishOption {
  id: string;
  name: string;
  label: string;
  basePrice: number;
  quantityPricing: PriceOption[];
}

// ============================================================================
// METHOD 2: GENERIC PRODUCT FRAMEWORK
// ============================================================================

/**
 * Create a universal product system that works for any product type
 */

export interface GenericProduct {
  id: string;
  type: 'cards' | 'brochures' | 'flyers' | 'banners' | 'stickers'; // Extensible
  name: string;
  description: string;
  baseVariants: BaseVariant[]; // e.g., BoardType for cards, Size for flyers
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseVariant {
  id: string;
  name: string;
  label: string;
  description: string;
  basePrice: number;
  quantityPricing: PriceOption[];
  
  // Dynamic extra options
  extraOptions: ExtraOption[];
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtraOption {
  id: string;
  type: string; // 'size', 'print-side', 'lamination', 'fold', 'pages', 'color', etc.
  name: string;
  label: string;
  
  // Flexible metadata
  metadata?: Record<string, any>;
  
  basePrice: number;
  quantityPricing: PriceOption[];
}

export interface CustomerProductSelection {
  productId: string;
  baseVariantId: string;
  quantity: number;
  selectedExtraOptions: ExtraOptionSelection[]; // Array of selected extra options
}

export interface ExtraOptionSelection {
  extraOptionId: string;
  value: string | number | boolean;
}

export interface ProductPricingBreakdown {
  baseVariantPrice: number;
  extraOptionsPrices: { [optionId: string]: number };
  quantityDiscount?: number;
  totalUnitPrice: number;
  totalPrice: number;
}

// ============================================================================
// METHOD 3: ADMIN IMPLEMENTATION FOR MULTIPLE PRODUCTS
// ============================================================================

/**
 * Generic Admin Product Manager Component
 * Works for cards, brochures, flyers, etc.
 */

export interface AdminProductConfig {
  product: {
    id?: string;
    type: string;
    name: string;
    description: string;
    isActive: boolean;
  };
  baseVariants: AdminBaseVariant[];
}

export interface AdminBaseVariant {
  id?: string;
  name: string;
  label: string;
  description: string;
  basePrice: number;
  quantityPricing: PriceOption[];
  extraOptions: AdminExtraOption[];
  isActive: boolean;
}

export interface AdminExtraOption {
  id?: string;
  type: string;
  name: string;
  label: string;
  basePrice: number;
  quantityPricing: PriceOption[];
  metadata?: Record<string, any>;
}

// ============================================================================
// STEP-BY-STEP: HOW TO ADD A NEW PRODUCT TYPE
// ============================================================================

/**
 * QUICK START GUIDE FOR ADDING NEW PRODUCTS
 * 
 * Example: Adding "Custom T-Shirt Printing"
 */

/*

STEP 1: Identify Your Product Requirements
=========================================
Product: Custom T-Shirt Printing
Base Variants: T-Shirt Sizes (S, M, L, XL, 2XL)
Extra Options:
  - Size
  - Color (White, Black, Navy, etc.)
  - Print Position (Front, Back, Sleeve, Full)
  - Print Type (Screen Print, DTG, Embroidery)
  - Quantity-based pricing

STEP 2: Create Product Type File
==================================
File: src/types/tshirtPrinting.ts

```typescript
import { GenericProduct, BaseVariant, ExtraOption, PriceOption } from './genericProduct';

export interface TShirtProduct extends GenericProduct {
  type: 'tshirts';
}

export interface TShirtVariant extends BaseVariant {
  size: string; // e.g., 'S', 'M', 'L'
  material: string; // e.g., '100% Cotton'
}

export interface TShirtColor extends ExtraOption {
  type: 'color';
  colorCode: string; // e.g., '#FFFFFF'
}

export interface PrintPosition extends ExtraOption {
  type: 'print_position';
  area: string; // e.g., 'front', 'back', 'sleeve'
}

export interface PrintMethod extends ExtraOption {
  type: 'print_method';
  technique: string; // e.g., 'screen', 'dtg', 'embroidery'
}
```

STEP 3: Create Admin Component
===============================
File: src/components/admin/TShirtProductManagement.tsx

```typescript
import React from 'react';
import { AdminProductConfig } from '@/types/genericProduct';

export const TShirtProductManagement: React.FC = () => {
  const [products, setProducts] = React.useState<AdminProductConfig[]>([]);
  
  // Same structure as CardConfigurator
  // - Add product
  // - Add base variant (sizes)
  // - Add extra options (colors, print position, methods)
  // - Set quantity pricing for each
  // - Save
  
  return (
    <div className="tshirt-management">
      {/* Same pattern as BoardTypeManagement */}
    </div>
  );
};
```

STEP 4: Create Customer Component
==================================
File: src/components/customer/TShirtConfigurator.tsx

```typescript
import React from 'react';
import { GenericProduct, CustomerProductSelection } from '@/types/genericProduct';

export const TShirtConfigurator: React.FC<{ product: GenericProduct }> = ({ product }) => {
  const [selection, setSelection] = React.useState<CustomerProductSelection>({
    productId: product.id,
    baseVariantId: '',
    quantity: 1,
    selectedExtraOptions: [],
  });
  
  // Same pattern as CardConfigurator
  // - Select base variant (T-shirt size)
  // - Select colors
  // - Select print position
  // - Select print method
  // - Update quantity
  // - Calculate price in real-time
  
  return (
    <div className="tshirt-configurator">
      {/* Similar UI structure */}
    </div>
  );
};
```

STEP 5: Database Schema
========================
File: src/lib/db/schema/tshirts.ts

```prisma
model TShirtProduct {
  id          String    @id @default(cuid())
  name        String
  description String
  isActive    Boolean   @default(true)
  variants    TShirtVariant[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model TShirtVariant {
  id               String    @id @default(cuid())
  product          TShirtProduct @relation(fields: [productId], references: [id])
  productId        String
  
  name             String
  label            String
  description      String
  size             String
  material         String
  basePrice        Float
  
  colors           TShirtColor[]
  printPositions   PrintPosition[]
  printMethods     PrintMethod[]
  finishes         FinishOption[]
  
  quantityPricing  PricingTier[]
  isActive         Boolean   @default(true)
  
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

model TShirtColor {
  id          String    @id @default(cuid())
  variant     TShirtVariant @relation(fields: [variantId], references: [id])
  variantId   String
  
  name        String
  label       String
  colorCode   String
  basePrice   Float
  
  pricing     PricingTier[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

// Similar for PrintPosition, PrintMethod, etc.
```

STEP 6: API Routes
===================
File: src/app/api/admin/tshirts/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET: List all T-shirt products
export async function GET() {
  const products = await prisma.tShirtProduct.findMany({
    include: {
      variants: {
        include: {
          colors: true,
          printPositions: true,
          printMethods: true,
          quantityPricing: true,
        },
      },
    },
  });
  return NextResponse.json(products);
}

// POST: Create new T-shirt product
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const product = await prisma.tShirtProduct.create({
    data: {
      name: body.name,
      description: body.description,
      variants: {
        create: body.variants.map((v: any) => ({
          name: v.name,
          label: v.label,
          size: v.size,
          material: v.material,
          basePrice: v.basePrice,
          colors: { create: v.colors },
          printPositions: { create: v.printPositions },
          printMethods: { create: v.printMethods },
        })),
      },
    },
    include: { variants: true },
  });
  
  return NextResponse.json(product);
}
```

STEP 7: Add to Product Router
===============================
File: src/app/(admin)/admin/products/page.tsx

```typescript
import { TShirtProductManagement } from '@/components/admin/TShirtProductManagement';
import { CardPrintingManagement } from '@/components/admin/BoardTypeManagement';

export default function ProductsPage() {
  return (
    <div className="products-admin">
      <tabs>
        <tab label="Cards">
          <CardPrintingManagement />
        </tab>
        <tab label="T-Shirts">
          <TShirtProductManagement />
        </tab>
        <tab label="Brochures">
          {/* Add brochure management */}
        </tab>
      </tabs>
    </div>
  );
}
```

STEP 8: Customer Product Page
===============================
File: src/app/products/tshirts/page.tsx

```typescript
import { TShirtConfigurator } from '@/components/customer/TShirtConfigurator';
import { prisma } from '@/lib/db';

export default async function TShirtProductPage() {
  const product = await prisma.tShirtProduct.findFirst({
    include: {
      variants: {
        include: {
          colors: { include: { pricing: true } },
          printPositions: { include: { pricing: true } },
          printMethods: { include: { pricing: true } },
          quantityPricing: true,
        },
      },
    },
  });
  
  return <TShirtConfigurator product={product} />;
}
```

*/

// ============================================================================
// QUICK REFERENCE: ADDING PRODUCTS
// ============================================================================

const PRODUCT_ADDITION_CHECKLIST = `
✅ NEW PRODUCT CHECKLIST:

1. [ ] Define Product Type
   - What is the base variant? (Size, Board Type, etc.)
   - What are the extra options? (Color, Print Type, etc.)
   - Does it need quantity pricing? (Yes/No)

2. [ ] Create TypeScript Interfaces
   - src/types/{productName}Printing.ts
   - Define product, variant, and extra options interfaces

3. [ ] Create Admin Component
   - src/components/admin/{ProductName}Management.tsx
   - Copy pattern from BoardTypeManagement
   - Add/Edit/Remove variants and options
   - Quantity pricing support

4. [ ] Create Customer Component
   - src/components/customer/{ProductName}Configurator.tsx
   - Copy pattern from CardConfigurator
   - Real-time price calculation

5. [ ] Create Pricing Service
   - Add to src/services/pricingService.ts
   - Or create new service if needed
   - Calculate final price with all options

6. [ ] Database Schema (Prisma)
   - src/lib/db/schema/{productName}.prisma
   - Models for product, variants, options

7. [ ] API Routes
   - src/app/api/admin/{products}/route.ts (CRUD operations)
   - src/app/api/customer/{products}/route.ts (Get products)

8. [ ] Pages/Routes
   - Admin page to manage products
   - Customer page to configure products
   - Product listing page

9. [ ] Integration
   - Add to admin navigation
   - Add to customer product listing
   - Add to shopping cart/checkout

10. [ ] Testing
    - Test admin: Create, Edit, Delete
    - Test customer: Select options, Calculate price
    - Test pricing: Verify all components calculate correctly
`;

export const productAdditionGuide = PRODUCT_ADDITION_CHECKLIST;
