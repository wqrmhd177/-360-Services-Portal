"use client";

import React, { useState, useEffect } from "react";
import { PrProduct, ShippingType, MovementType } from "@/types/workflows";
import { TOP_COUNTRIES } from "@/lib/countries";
import { getCurrencyByCountry } from "@/lib/currency";
import CurrencyInput from "./CurrencyInput";

export type ComboLookupEntry = {
  landedCostPerUnit: number;
  movementType: MovementType;
  shippingType: ShippingType;
};

interface MultiProductFormProps {
  products: PrProduct[];
  onChange: (products: PrProduct[]) => void;
  disabled?: boolean;
  /** When false, hides the "Add Another Product" button (e.g. for QR-to-PR conversion). Default true. */
  showAddProductButton?: boolean;
  /** Heading style: "combination" for QR→PR convert, "product" (default) otherwise. */
  headingMode?: "combination" | "product";
  /** Fields that cannot be edited (e.g. landed cost, quantity on convert). */
  lockedFields?: (keyof PrProduct)[];
  /** Lookup for shipping-type → landed cost when converting from QR. */
  comboLookup?: Record<string, ComboLookupEntry>;
  /** Movements service: show From/To SKU instead of Product Name / SKU Code. */
  movementsMode?: boolean;
}

const emptyProduct: PrProduct = {
  productName: "",
  skuCode: "",
  destinationCountry: "",
  quantity: 0,
  landedCostPrice: 0,
  sellingPricePerUnit: 0,
  currency: "AED",
  totalAmount: 0,
  shippingType: "sea",
  movementType: "normal",
  remarks: "",
};

export default function MultiProductForm({
  products,
  onChange,
  disabled = false,
  showAddProductButton = true,
  headingMode = "product",
  lockedFields = [],
  comboLookup = {},
  movementsMode = false,
}: MultiProductFormProps) {
  const isLocked = (field: keyof PrProduct) => lockedFields.includes(field);
  const [countrySearches, setCountrySearches] = useState<string[]>(
    products.map((p) => p.destinationCountry || "")
  );
  const [showDropdowns, setShowDropdowns] = useState<boolean[]>(
    products.map(() => false)
  );

  useEffect(() => {
    // Initialize with at least one product
    if (products.length === 0) {
      onChange([{ ...emptyProduct }]);
      setCountrySearches([""]);
      setShowDropdowns([false]);
    }
  }, []);

  const addProduct = () => {
    onChange([...products, { ...emptyProduct }]);
    setCountrySearches([...countrySearches, ""]);
    setShowDropdowns([...showDropdowns, false]);
  };

  const removeProduct = (index: number) => {
    if (products.length <= 1) return; // Keep at least one product
    const newProducts = products.filter((_, i) => i !== index);
    const newSearches = countrySearches.filter((_, i) => i !== index);
    const newDropdowns = showDropdowns.filter((_, i) => i !== index);
    onChange(newProducts);
    setCountrySearches(newSearches);
    setShowDropdowns(newDropdowns);
  };

  const updateProduct = (
    index: number,
    field: keyof PrProduct,
    value: any
  ) => {
    const newProducts = [...products];
    newProducts[index] = { ...newProducts[index], [field]: value };

    // Auto-update currency when country changes
    if (field === "destinationCountry") {
      const currency = getCurrencyByCountry(value);
      newProducts[index].currency = currency;
    }

    // Auto-calculate total amount
    if (field === "quantity" || field === "sellingPricePerUnit") {
      const quantity = field === "quantity" ? value : newProducts[index].quantity;
      const pricePerUnit =
        field === "sellingPricePerUnit"
          ? value
          : newProducts[index].sellingPricePerUnit;
      newProducts[index].totalAmount = quantity * pricePerUnit;
    }

    onChange(newProducts);
  };

  const handleShippingTypeChange = (index: number, newShippingType: ShippingType) => {
    const product = products[index];
    const country = product.destinationCountry;
    const movement = product.movementType;
    let entry =
      comboLookup[`${country}|${newShippingType}|${movement}`] ??
      comboLookup[`${country}|${newShippingType}|${movement === "normal" ? "express" : "normal"}`];

    const newProducts = [...products];
    newProducts[index] = {
      ...newProducts[index],
      shippingType: newShippingType,
      ...(entry
        ? {
            landedCostPrice: entry.landedCostPerUnit,
            movementType: entry.movementType,
          }
        : {}),
    };
    onChange(newProducts);
  };

  const handleCountrySearch = (index: number, value: string) => {
    const newSearches = [...countrySearches];
    newSearches[index] = value;
    setCountrySearches(newSearches);

    const newDropdowns = [...showDropdowns];
    newDropdowns[index] = value.length > 0;
    setShowDropdowns(newDropdowns);
  };

  const selectCountry = (index: number, country: string) => {
    updateProduct(index, "destinationCountry", country);
    const newSearches = [...countrySearches];
    newSearches[index] = country;
    setCountrySearches(newSearches);

    const newDropdowns = [...showDropdowns];
    newDropdowns[index] = false;
    setShowDropdowns(newDropdowns);
  };

  const filteredCountries = (searchTerm: string) => {
    if (!searchTerm) return TOP_COUNTRIES;
    return TOP_COUNTRIES.filter((country) =>
      country.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div className="space-y-6">
      {products.map((product, index) => (
        <div
          key={index}
          className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm relative"
        >
          {/* Remove Button */}
          {products.length > 1 && (
            <button
              type="button"
              onClick={() => removeProduct(index)}
              disabled={disabled}
              className="absolute top-4 right-4 text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove Product"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}

          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {headingMode === "combination"
              ? `Combination ${index + 1}`
              : `Product ${index + 1}`}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {movementsMode ? (
              <>
                {/* From SKU */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From SKU <span className="text-red-500">*</span>
                  </label>
                  {isLocked("fromSku") ? (
                    <div className="block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 sm:text-sm text-gray-700">
                      {product.fromSku || "—"}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={product.fromSku ?? ""}
                      onChange={(e) => updateProduct(index, "fromSku", e.target.value)}
                      disabled={disabled}
                      required
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                      placeholder="Source SKU"
                    />
                  )}
                </div>
                {/* To SKU */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To SKU <span className="text-red-500">*</span>
                  </label>
                  {isLocked("toSku") ? (
                    <div className="block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 sm:text-sm text-gray-700">
                      {product.toSku || "—"}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={product.toSku ?? ""}
                      onChange={(e) => updateProduct(index, "toSku", e.target.value)}
                      disabled={disabled}
                      required
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                      placeholder="Destination SKU"
                    />
                  )}
                </div>
              </>
            ) : (
              <>
            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              {isLocked("productName") ? (
                <div className="block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 sm:text-sm text-gray-700">
                  {product.productName || "—"}
                </div>
              ) : (
                <input
                  type="text"
                  value={product.productName}
                  onChange={(e) =>
                    updateProduct(index, "productName", e.target.value)
                  }
                  disabled={disabled}
                  required
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                  placeholder="Enter product name"
                />
              )}
            </div>

            {/* SKU Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={product.skuCode}
                onChange={(e) =>
                  updateProduct(index, "skuCode", e.target.value)
                }
                disabled={disabled}
                required
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                placeholder="Enter SKU code"
              />
            </div>
              </>
            )}

            {/* Destination Country */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination Country <span className="text-red-500">*</span>
              </label>
              {isLocked("destinationCountry") ? (
                <div className="block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 sm:text-sm text-gray-700">
                  {product.destinationCountry || "—"}
                </div>
              ) : (
                <input
                  type="text"
                  value={countrySearches[index] || product.destinationCountry}
                  onChange={(e) => handleCountrySearch(index, e.target.value)}
                  onFocus={() => {
                    const newDropdowns = [...showDropdowns];
                    newDropdowns[index] = true;
                    setShowDropdowns(newDropdowns);
                  }}
                  disabled={disabled}
                  required
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                  placeholder="Search country..."
                />
              )}
              {showDropdowns[index] && !disabled && !isLocked("destinationCountry") && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredCountries(countrySearches[index]).map((country) => (
                    <div
                      key={country}
                      onClick={() => selectCountry(index, country)}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                    >
                      {country}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Currency Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                value={product.currency}
                onChange={(e) =>
                  updateProduct(
                    index,
                    "currency",
                    e.target.value as "AED" | "SAR" | "PKR"
                  )
                }
                disabled={disabled}
                required
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
              >
                <option value="AED">AED</option>
                <option value="SAR">SAR</option>
                <option value="PKR">PKR</option>
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity (Units) <span className="text-red-500">*</span>
              </label>
              {isLocked("quantity") ? (
                <div className="block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 sm:text-sm text-gray-700">
                  {product.quantity}
                </div>
              ) : (
                <input
                  type="number"
                  value={product.quantity || ""}
                  onChange={(e) =>
                    updateProduct(index, "quantity", parseFloat(e.target.value) || 0)
                  }
                  disabled={disabled}
                  required
                  min="0"
                  step="1"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                  placeholder="0"
                />
              )}
            </div>

            {/* Landed Cost Price (Per Unit) */}
            <div>
              {isLocked("landedCostPrice") ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Landed Cost Price
                  </label>
                  <div className="block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 sm:text-sm text-gray-700">
                    {product.currency} {(product.landedCostPrice ?? 0).toFixed(2)}
                  </div>
                </>
              ) : (
                <CurrencyInput
                  label="Landed Cost Price"
                  value={product.landedCostPrice ?? 0}
                  onChange={(val) => updateProduct(index, "landedCostPrice", val)}
                  currency={product.currency}
                  disabled={disabled}
                  placeholder="0.00"
                />
              )}
            </div>

            {/* Selling Price Per Unit */}
            <div>
              <CurrencyInput
                label="Selling Price (Per Unit)"
                value={product.sellingPricePerUnit || ""}
                onChange={(val) => updateProduct(index, "sellingPricePerUnit", val)}
                currency={product.currency}
                required
                disabled={disabled}
                placeholder="Enter selling price"
              />
            </div>

            {/* Total Amount (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Amount
              </label>
              <div className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 sm:text-sm text-gray-700 font-medium">
                {product.currency} {product.totalAmount.toFixed(2)}
              </div>
            </div>

            {/* Margin (Read-only): Total Amount - (Landed Cost Price * Quantity) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Margin
              </label>
              <div className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 sm:text-sm text-gray-700 font-medium">
                {product.currency}{" "}
                {(
                  product.totalAmount -
                  (product.landedCostPrice ?? 0) * product.quantity
                ).toFixed(2)}
              </div>
            </div>

            {/* Shipping Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shipping Type <span className="text-red-500">*</span>
              </label>
              <select
                value={product.shippingType}
                onChange={(e) =>
                  Object.keys(comboLookup).length > 0
                    ? handleShippingTypeChange(index, e.target.value as ShippingType)
                    : updateProduct(index, "shippingType", e.target.value as ShippingType)
                }
                disabled={disabled || isLocked("shippingType")}
                required
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
              >
                <option value="sea">Sea</option>
                <option value="air">Air</option>
                <option value="road">Road</option>
              </select>
            </div>

            {/* Movement Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Movement Type <span className="text-red-500">*</span>
              </label>
              <select
                value={product.movementType}
                onChange={(e) =>
                  updateProduct(
                    index,
                    "movementType",
                    e.target.value as MovementType
                  )
                }
                disabled={disabled || isLocked("movementType")}
                required
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
              >
                <option value="normal">Normal</option>
                <option value="express">Express</option>
              </select>
            </div>

            {/* Remarks */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks
              </label>
              <textarea
                value={product.remarks || ""}
                onChange={(e) =>
                  updateProduct(index, "remarks", e.target.value)
                }
                disabled={disabled}
                rows={2}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                placeholder="Optional remarks for this product"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Add Product Button - hidden when converting QR to PR */}
      {showAddProductButton && (
        <button
          type="button"
          onClick={addProduct}
          disabled={disabled}
          className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Another Product
        </button>
      )}
    </div>
  );
}
