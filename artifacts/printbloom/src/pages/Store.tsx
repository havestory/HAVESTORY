import { useState } from "react";
import { useListProducts, useListCategories } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { ArrowDown, Search, SlidersHorizontal, Package, X } from "lucide-react";
import { motion } from "framer-motion";

export default function Store() {
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: categories } = useListCategories();
  const { data: allProducts, isLoading } = useListProducts(
    activeCategory ? { categoryId: activeCategory } : {}
  );

  const normalizedSearch = search.trim().toLowerCase();
  const products = allProducts?.filter(product =>
    product.name.toLowerCase().includes(normalizedSearch) ||
    (product.description || "").toLowerCase().includes(normalizedSearch)
  );

  const activeName = activeCategory === null
    ? "All work"
    : categories?.find(category => category.id === activeCategory)?.name || "Collection";

  return (
    <main className="hs-store">
      <section className="hs-store-masthead">
        <div className="hs-store-code">CATALOGUE / {new Date().getFullYear()}</div>
        <div>
          <span className="hs-kicker">Frames · Prints · Personal pieces</span>
          <h1>The Frame<br />Collection</h1>
        </div>
        <div className="hs-store-intro">
          <p>Choose a format, explore finishes and create a piece made around your photograph.</p>
          <a href="#collection" className="hs-text-link">View collection <ArrowDown size={17} /></a>
        </div>
      </section>

      <section className="hs-store-catalogue" id="collection">
        <aside className="hs-store-filters">
          <div className="hs-filter-heading">
            <SlidersHorizontal size={16} />
            <span>Filter collection</span>
          </div>

          <div className="hs-category-list">
            <button
              onClick={() => setActiveCategory(null)}
              className={activeCategory === null ? "active" : ""}
            >
              <span>All work</span>
              <small>{activeCategory === null ? allProducts?.length || 0 : ""}</small>
            </button>
            {categories?.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={activeCategory === category.id ? "active" : ""}
              >
                <span>{category.name}</span>
                <small>→</small>
              </button>
            ))}
          </div>

          <div className="hs-filter-note">
            <span>Need a custom size?</span>
            <p>Send the studio your wall size or photograph and we will recommend the right format.</p>
            <a href="/custom-project">Request a custom frame</a>
          </div>
        </aside>

        <div className="hs-store-results">
          <div className="hs-store-toolbar">
            <div>
              <span className="hs-result-label">{activeName}</span>
              <strong>{products?.length || 0} pieces</strong>
            </div>

            <label className="hs-store-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search frames and prints"
                value={search}
                onChange={event => setSearch(event.target.value)}
                aria-label="Search frames and prints"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search" type="button">
                  <X size={15} />
                </button>
              )}
            </label>
          </div>

          <div className="hs-mobile-categories">
            <button onClick={() => setActiveCategory(null)} className={activeCategory === null ? "active" : ""}>All</button>
            {categories?.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={activeCategory === category.id ? "active" : ""}
              >
                {category.name}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="hs-product-grid">
              {[1,2,3,4,5,6].map(item => <div key={item} className="hs-product-skeleton" />)}
            </div>
          ) : allProducts?.length === 0 ? (
            <div className="hs-empty-state">
              <Package size={45} />
              <h2>The collection is being prepared.</h2>
              <p>New frame and print formats will appear here soon.</p>
            </div>
          ) : products?.length === 0 ? (
            <div className="hs-empty-state">
              <Search size={42} />
              <h2>No matching pieces.</h2>
              <p>Try another search or choose a different collection.</p>
              <button onClick={() => { setSearch(""); setActiveCategory(null); }}>Reset filters</button>
            </div>
          ) : (
            <motion.div layout className="hs-product-grid">
              {products?.map((product, index) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: .38, delay: Math.min(index * .045, .3) }}
                >
                  <ProductCard product={product} index={index} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>
    </main>
  );
}
