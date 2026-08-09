import { useState } from "react";
import { useListProducts, useListCategories } from "@workspace/api-client-react";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import { Search, SlidersHorizontal, Package } from "lucide-react";
import { motion } from "framer-motion";

export default function Store() {
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  
  const { data: categories } = useListCategories();
  const { data: allProducts, isLoading } = useListProducts(
    activeCategory ? { categoryId: activeCategory } : {}
  );

  const products = allProducts?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-24">
      <PageHeader 
        title="Print Store" 
        subtitle="Browse our collection of premium customizable print products."
        badge="Quality Guaranteed"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-10 glass p-4 rounded-2xl">
          
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
            <button
              onClick={() => setActiveCategory(null)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeCategory === null 
                  ? "bg-primary text-white shadow-md shadow-pink-500/25" 
                  : "bg-white/50 text-gray-600 hover:bg-white/80"
              }`}
            >
              All Products
            </button>
            {categories?.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeCategory === cat.id 
                    ? "bg-primary text-white shadow-md shadow-pink-500/25" 
                    : "bg-white/50 text-gray-600 hover:bg-white/80"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/70 border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-400 text-sm transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="glass-card rounded-2xl h-[320px] sm:h-[420px] animate-pulse bg-white/40" />
            ))}
          </div>
        ) : allProducts?.length === 0 ? (
          <div className="text-center py-24 glass rounded-3xl">
            <Package size={52} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">Products Coming Soon</h3>
            <p className="text-gray-400 mt-2">Our catalog is being set up. Check back soon!</p>
          </div>
        ) : products?.length === 0 ? (
          <div className="text-center py-24 glass rounded-3xl">
            <SlidersHorizontal size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-700">No products found</h3>
            <p className="text-gray-500 mt-2">Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6"
          >
            {products?.map(product => (
              <motion.div 
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
