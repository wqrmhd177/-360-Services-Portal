"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { MovementType, ShippingType } from "@/types/workflows";
import { TOP_COUNTRIES } from "@/lib/countries";
import { isZambeelLikeService, isLogisticsService, isSourcingService } from "@/lib/serviceTypes";
import { createSupabaseClient } from "@/lib/supabaseClient";
import SuccessModal from "@/components/SuccessModal";

/** Per-country quantity, target price, and optional remarks. Currency is explicitly selected (AED/SAR/PKR). */
export type CountryDetail = {
  country: string;
  quantity: number;
  targetPrice: number;
  remarks?: string;
  currency?: "AED" | "SAR" | "PKR";
};

interface PurchaseDetail {
  // Common fields for Zambeel 360, Sourcing & Logistics, Sourcing only
  productName: string;
  /** Legacy single country (Logistics). New flow uses destinationCountries. */
  destinationCountry: string;
  /** Multiple destination countries per product (Zambeel 360, Sourcing & Logistics, Sourcing only). */
  destinationCountries?: string[];
  /** Per-country quantity and target price; one entry per destination country. */
  countryDetails?: CountryDetail[];
  countryOfPurchase: "China" | "Local Market";
  shippingType: ShippingType;
  movementType: MovementType;
  quantity: number;
  targetPrice: number;
  images: File[];
  imagePreviews: string[];
  remarks: string;
  shipToAddress?: string; // For Sourcing & Logistics and Sourcing only

  // Fields for Logistics Only and 3PL & Logistics
  shipFrom?: string;
  shipTo?: string;
  productType?: string;
  hasBrand?: "Yes" | "No";
  noOfCartons?: number;
  weightPerCarton?: number;
  cartonLength?: number;
  cartonWidth?: number;
  cartonHeight?: number;
}

export default function GrowthQrFormPage() {
  const router = useRouter();
  const [resellerCode, setResellerCode] = useState("");
  const [resellerContactNo, setResellerContactNo] = useState("");
  const [resellerCountry, setResellerCountry] = useState("");
  const [existingSeller, setExistingSeller] = useState<"Yes" | "No">("No");
  const [goldSeller, setGoldSeller] = useState<"Yes" | "No">("No");
  const [serviceNeeded, setServiceNeeded] = useState<string>("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdQrNumber, setCreatedQrNumber] = useState<string>("");
  
  // Use ref to store File objects to prevent them from being lost in state updates
  const imageFilesRef = useRef<Map<number, File[]>>(new Map());
  
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetail[]>([
    {
      productName: "",
      destinationCountry: "",
      destinationCountries: [],
      countryOfPurchase: "China",
      shippingType: "sea",
      movementType: "normal",
      quantity: 0,
      targetPrice: 0,
      images: [],
      imagePreviews: [],
      remarks: ""
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState<string[]>(() =>
    purchaseDetails.map(() => "")
  );
  const [showDropdown, setShowDropdown] = useState<boolean[]>(() =>
    Array(purchaseDetails.length).fill(false)
  );
  const [resellerCountrySearch, setResellerCountrySearch] = useState("");
  const [showResellerCountryDropdown, setShowResellerCountryDropdown] = useState(false);

  // Helper to sanitize file names for Supabase Storage (remove unsafe characters)
  function sanitizeFileName(name: string): string {
    return (name || "file")
      .normalize("NFKD")
      .replace(/[^\w.\-]+/g, "_");
  }

  // Reset purchase details when service changes
  useEffect(() => {
    if (serviceNeeded) {
      const baseDetail: PurchaseDetail = {
        productName: "",
        destinationCountry: "",
        destinationCountries: isZambeelLikeService(serviceNeeded) || serviceNeeded === "Sourcing & Logistics" || serviceNeeded === "Sourcing only" ? [] : undefined,
        countryDetails: [],
        countryOfPurchase: "China",
        shippingType: "sea",
        movementType: "normal",
        quantity: 0,
        targetPrice: 0,
        images: [],
        imagePreviews: [],
        remarks: ""
      };

      if (serviceNeeded === "Sourcing & Logistics" || serviceNeeded === "Sourcing only") {
        baseDetail.shipToAddress = "";
      } else if (serviceNeeded === "Logistics Only" || serviceNeeded === "3PL & Logistics") {
        baseDetail.shipFrom = "";
        baseDetail.shipTo = "";
        baseDetail.productType = "";
        baseDetail.hasBrand = "No";
        baseDetail.noOfCartons = 0;
        baseDetail.weightPerCarton = 0;
        baseDetail.cartonLength = 0;
        baseDetail.cartonWidth = 0;
        baseDetail.cartonHeight = 0;
      }

      setPurchaseDetails([baseDetail]);
      setCountrySearch([""]);
      setShowDropdown([false]);
    }
  }, [serviceNeeded]);

  function addPurchaseDetail() {
    const baseDetail: PurchaseDetail = {
      productName: "",
      destinationCountry: "",
      destinationCountries: isSourcingService(serviceNeeded) ? [] : undefined,
      countryDetails: [],
      countryOfPurchase: "China",
      shippingType: "sea",
      movementType: "normal",
      quantity: 0,
      targetPrice: 0,
      images: [],
      imagePreviews: [],
      remarks: ""
    };

    if (serviceNeeded === "Sourcing & Logistics" || serviceNeeded === "Sourcing only") {
      baseDetail.shipToAddress = "";
    } else if (serviceNeeded === "Logistics Only" || serviceNeeded === "3PL & Logistics") {
      baseDetail.shipFrom = "";
      baseDetail.shipTo = "";
      baseDetail.productType = "";
      baseDetail.hasBrand = "No";
      baseDetail.noOfCartons = 0;
      baseDetail.weightPerCarton = 0;
      baseDetail.cartonLength = 0;
      baseDetail.cartonWidth = 0;
      baseDetail.cartonHeight = 0;
    }

    setPurchaseDetails([...purchaseDetails, baseDetail]);
    setCountrySearch([...countrySearch, ""]);
    setShowDropdown([...showDropdown, false]);
  }

  function removePurchaseDetail(index: number) {
    if (purchaseDetails.length > 1) {
      setPurchaseDetails(purchaseDetails.filter((_, i) => i !== index));
      setCountrySearch(countrySearch.filter((_, i) => i !== index));
      setShowDropdown(showDropdown.filter((_, i) => i !== index));
    }
  }

  function updatePurchaseDetail(
    index: number,
    field: keyof PurchaseDetail,
    value: string | number | File[] | string[]
  ) {
    const updated = [...purchaseDetails];
    updated[index] = { ...updated[index], [field]: value };
    setPurchaseDetails(updated);
  }

  function handleImageChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    console.log("=== IMAGE CHANGE HANDLER ===");
    console.log("Detail index:", index);
    const files = Array.from(e.target.files || []);
    console.log("Files selected:", files.length);
    console.log("File details:", files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    if (files.length > 0) {
      const detail = purchaseDetails[index];
      console.log("Current images in detail:", detail.images.length);
      
      // Store files in ref to prevent them from being lost in state updates
      const currentFiles = imageFilesRef.current.get(index) || [];
      const newImages = [...currentFiles, ...files];
      imageFilesRef.current.set(index, newImages);
      console.log("New total images stored in ref:", newImages.length);
      
      const newPreviews = [
        ...detail.imagePreviews,
        ...files.map((file) => URL.createObjectURL(file))
      ];
      updatePurchaseDetail(index, "images", newImages);
      updatePurchaseDetail(index, "imagePreviews", newPreviews);
      console.log("Images updated in state and ref");
    } else {
      console.log("No files selected");
    }
  }

  function removeImage(detailIndex: number, imageIndex: number) {
    const detail = purchaseDetails[detailIndex];
    const filesFromRef = imageFilesRef.current.get(detailIndex) || [];
    const newImages = filesFromRef.filter((_, i) => i !== imageIndex);
    const newPreviews = detail.imagePreviews.filter((_, i) => i !== imageIndex);
    // Revoke object URL to prevent memory leak
    URL.revokeObjectURL(detail.imagePreviews[imageIndex]);
    // Update ref
    imageFilesRef.current.set(detailIndex, newImages);
    updatePurchaseDetail(detailIndex, "images", newImages);
    updatePurchaseDetail(detailIndex, "imagePreviews", newPreviews);
  }

  function filterCountries(searchTerm: string, index: number): string[] {
    if (!searchTerm) return TOP_COUNTRIES;
    return TOP_COUNTRIES.filter((country) =>
      country.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  function selectCountry(index: number, country: string) {
    const detail = purchaseDetails[index];
    const useMultiCountry = isZambeelLikeService(serviceNeeded) || serviceNeeded === "Sourcing & Logistics" || serviceNeeded === "Sourcing only";
    if (useMultiCountry) {
      const current = detail.destinationCountries || [];
      if (current.includes(country)) return;
      const newCountries = [...current, country];
      const existingDetails = detail.countryDetails || [];
      const countryDetails = existingDetails.some((cd) => cd.country === country)
        ? existingDetails
        : [...existingDetails, { country, quantity: 0, targetPrice: 0, remarks: "" }];
      const updated = [...purchaseDetails];
      updated[index] = { ...detail, destinationCountries: newCountries, countryDetails };
      setPurchaseDetails(updated);
      setCountrySearch((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      setShowDropdown((prev) => {
        const next = [...prev];
        next[index] = false;
        return next;
      });
    } else {
      updatePurchaseDetail(index, "destinationCountry", country);
      const newSearch = [...countrySearch];
      newSearch[index] = country;
      setCountrySearch(newSearch);
      const newShow = [...showDropdown];
      newShow[index] = false;
      setShowDropdown(newShow);
    }
  }

  function removeDestinationCountry(detailIndex: number, country: string) {
    const detail = purchaseDetails[detailIndex];
    const current = detail.destinationCountries || [];
    const countryDetails = (detail.countryDetails || []).filter((cd) => cd.country !== country);
    const updated = [...purchaseDetails];
    updated[detailIndex] = { ...detail, destinationCountries: current.filter((c) => c !== country), countryDetails };
    setPurchaseDetails(updated);
  }

  function getCountryDetail(detail: PurchaseDetail, country: string): CountryDetail {
    const found = (detail.countryDetails || []).find((cd) => cd.country === country);
    if (found) return found;
    // Default currency based on country, but user can override via dropdown
    const defaultCurrency = getCurrencyForCountry(country) as "AED" | "SAR" | "PKR";
    return { country, quantity: 0, targetPrice: 0, remarks: "", currency: defaultCurrency };
  }

  function updateCountryDetail(
    detailIndex: number,
    country: string,
    field: "quantity" | "targetPrice" | "remarks" | "currency",
    value: number | string
  ) {
    const detail = purchaseDetails[detailIndex];
    const list = detail.countryDetails || [];
    const existing = list.find((cd) => cd.country === country);
    const entry = existing
      ? { ...existing, [field]: value }
      : {
          country,
          quantity: field === "quantity" ? (value as number) : 0,
          targetPrice: field === "targetPrice" ? (value as number) : 0,
          remarks: field === "remarks" ? (value as string) : "",
          currency:
            field === "currency"
              ? (value as "AED" | "SAR" | "PKR")
              : (getCurrencyForCountry(country) as "AED" | "SAR" | "PKR"),
        };
    const countryDetails = existing
      ? list.map((cd) => (cd.country === country ? entry : cd))
      : [...list, entry];
    const updated = [...purchaseDetails];
    updated[detailIndex] = { ...detail, countryDetails };
    setPurchaseDetails(updated);
  }

  function ensureCountryDetailsSynced(detail: PurchaseDetail): CountryDetail[] {
    const countries = detail.destinationCountries && detail.destinationCountries.length > 0
      ? detail.destinationCountries
      : detail.destinationCountry
        ? [detail.destinationCountry]
        : [];
    const existing = detail.countryDetails || [];
    return countries.map((c) => {
      const found = existing.find((cd) => cd.country === c);
      if (found) return found;
      const defaultCurrency = getCurrencyForCountry(c) as "AED" | "SAR" | "PKR";
      return { country: c, quantity: 0, targetPrice: 0, remarks: "", currency: defaultCurrency };
    });
  }

  // Get currency based on destination country
  function getCurrencyForCountry(country: string): string {
    if (!country) return "AED";
    const countryLower = country.toLowerCase();
    if (countryLower.includes("saudi") || countryLower === "saudi arabia") {
      return "SAR";
    }
    if (countryLower.includes("pakistan") || countryLower === "pakistan") {
      return "PKR";
    }
    return "AED";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const supabase = createSupabaseClient();

    // Resolve reseller country from search if user typed but didn't click dropdown
    const resolvedResellerCountry =
      resellerCountry ||
      TOP_COUNTRIES.find(
        (c) => c.toLowerCase() === resellerCountrySearch.trim().toLowerCase()
      ) ||
      "";
    if (resolvedResellerCountry && resolvedResellerCountry !== resellerCountry) {
      setResellerCountry(resolvedResellerCountry);
    }

    // Validate
    if (!resellerCode || !resellerContactNo || !resolvedResellerCountry || !serviceNeeded) {
      setError("Please fill in all required fields at the top");
      setLoading(false);
      return;
    }

    // Validate based on service type — keep original indices for image upload mapping
    type ValidDetailEntry = { detail: PurchaseDetail; originalIndex: number };
    let validDetailEntries: ValidDetailEntry[] = [];

    if (isZambeelLikeService(serviceNeeded)) {
      validDetailEntries = purchaseDetails
        .map((d, originalIndex) => ({ detail: d, originalIndex }))
        .filter(({ detail: d }) => {
          const hasCountry =
            (d.destinationCountries && d.destinationCountries.length > 0) ||
            (d.destinationCountry && d.destinationCountry.trim() !== "");
          const rows = ensureCountryDetailsSynced(d);
          const hasValidCountryDetails = rows.length > 0 && rows.every((r) => r.quantity > 0);
          return !!(d.productName && hasCountry && hasValidCountryDetails);
        });
    } else if (serviceNeeded === "Sourcing & Logistics" || serviceNeeded === "Sourcing only") {
      validDetailEntries = purchaseDetails
        .map((d, originalIndex) => ({ detail: d, originalIndex }))
        .filter(({ detail: d }) => {
          const hasCountry =
            (d.destinationCountries && d.destinationCountries.length > 0) ||
            (d.destinationCountry && d.destinationCountry.trim() !== "");
          const rows = ensureCountryDetailsSynced(d);
          const hasValidCountryDetails = rows.length > 0 && rows.every((r) => r.quantity > 0);
          return !!(
            d.productName &&
            hasCountry &&
            hasValidCountryDetails &&
            (serviceNeeded === "Sourcing & Logistics" ? d.shipToAddress : true)
          );
        });
    } else if (isLogisticsService(serviceNeeded)) {
      validDetailEntries = purchaseDetails
        .map((d, originalIndex) => ({ detail: d, originalIndex }))
        .filter(({ detail: d }) =>
          !!(
            d.productName &&
            d.productName.trim() !== "" &&
            d.shipFrom &&
            d.shipTo &&
            d.shippingType &&
            d.productType &&
            d.hasBrand &&
            d.noOfCartons &&
            d.noOfCartons > 0 &&
            d.weightPerCarton &&
            d.weightPerCarton > 0 &&
            d.cartonLength &&
            d.cartonLength > 0 &&
            d.cartonWidth &&
            d.cartonWidth > 0 &&
            d.cartonHeight &&
            d.cartonHeight > 0
          )
        );
    }

    if (validDetailEntries.length === 0) {
      setError("Please fill in all required fields for at least one purchase detail");
      setLoading(false);
      return;
    }

    console.log("=== CHECKING STATE BEFORE PROCESSING ===");
    console.log("purchaseDetails from state:", purchaseDetails.map((d, i) => ({
      index: i,
      productName: d.productName,
      imagesCount: d.images?.length || 0,
      hasImages: !!d.images && d.images.length > 0
    })));
    const validDetails = validDetailEntries.map((e) => e.detail);

    try {
      console.log("=== PROCESSING IMAGES ===");
      console.log("Number of purchase details:", validDetailEntries.length);
      
      // Process images for each purchase detail - Upload to Supabase Storage
      const processedDetails = await Promise.all(
        validDetailEntries.map(async ({ detail: d, originalIndex }) => {
          console.log(`Processing detail ${originalIndex}`);
          
          // Get files from ref using original purchaseDetails index
          const filesFromRef = imageFilesRef.current.get(originalIndex) || [];
          console.log(`  - images from ref:`, filesFromRef.length);
          console.log(`  - images from state:`, d.images?.length || 0);
          
          const imagesToUpload = filesFromRef.length > 0 ? filesFromRef : (d.images || []);
          console.log(`  - final images to upload:`, imagesToUpload.length);
          
          const imagePaths: string[] = [];
          
          if (imagesToUpload.length > 0) {
            console.log(`Uploading ${imagesToUpload.length} images for detail ${originalIndex}...`);
            
                for (const image of imagesToUpload) {
              try {
                console.log(`Uploading image: ${image.name}, size: ${image.size} bytes`);

                    // Upload to Supabase Storage with safe filename
                    const safeName = sanitizeFileName(image.name || "image.png");
                    const fileName = `qr-images/${Date.now()}-${Math.random()
                      .toString(36)
                      .substring(7)}-${safeName}`;
                const { data, error } = await supabase.storage
                  .from("qr-attachments")
                  .upload(fileName, image, {
                    cacheControl: "3600",
                    upsert: false
                  });

                if (error) {
                  console.error("Image upload error:", error);
                  // Continue with other images even if one fails
                } else if (data) {
                  console.log("Image uploaded successfully:", data.path);
                  imagePaths.push(data.path);
                }
              } catch (uploadError) {
                console.error("Failed to upload image:", uploadError);
              }
            }
          } else {
            console.log(`No images for detail ${originalIndex}`);
          }
          
          console.log(`Detail ${originalIndex} final imagePaths:`, imagePaths);
          
          const countryDetails = ensureCountryDetailsSynced(d);
          const quantity = countryDetails.reduce((sum, cd) => sum + (cd.quantity || 0), 0);
          const firstTarget = countryDetails[0]?.targetPrice ?? 0;
          return {
            ...d,
            images: undefined,
            imagePreviews: undefined,
            imagePaths,
            countryDetails: countryDetails.length > 0 ? countryDetails : undefined,
            quantity: countryDetails.length > 0 ? quantity : d.quantity,
            targetPrice: countryDetails.length > 0 ? firstTarget : d.targetPrice
          };
        })
      );
      
      console.log("=== IMAGE PROCESSING COMPLETE ===");

      // Prepare data - store purchase details as JSON
      let countries: string[] = [];
      const movementTypeByCountry: Record<string, MovementType> = {};
      const shippingTypeByCountry: Record<string, ShippingType> = {};
      
      if (isLogisticsService(serviceNeeded)) {
        // For logistics services, use shipTo as country identifier
        countries = validDetails.map((d) => d.shipTo || "");
        validDetails.forEach((d) => {
          if (d.shipTo) {
            movementTypeByCountry[d.shipTo] = d.movementType || "normal";
            shippingTypeByCountry[d.shipTo] = d.shippingType;
          }
        });
      } else {
        // Zambeel 360, Sourcing & Logistics, Sourcing only: use destinationCountries or legacy destinationCountry
        const allCountries: string[] = [];
        validDetails.forEach((d) => {
          if (d.destinationCountries && d.destinationCountries.length > 0) {
            d.destinationCountries.forEach((c) => {
              if (c && !allCountries.includes(c)) allCountries.push(c);
            });
          } else if (d.destinationCountry) {
            if (!allCountries.includes(d.destinationCountry)) allCountries.push(d.destinationCountry);
          }
        });
        countries = allCountries;
        // Growth does not set P/S/M for these services; Procurement will. Keep empty or default for backward compat.
        validDetails.forEach((d) => {
          const list = d.destinationCountries && d.destinationCountries.length > 0 ? d.destinationCountries : (d.destinationCountry ? [d.destinationCountry] : []);
          list.forEach((c) => {
            if (c && d.shippingType) shippingTypeByCountry[c] = d.shippingType;
            if (c && d.movementType) movementTypeByCountry[c] = d.movementType;
          });
        });
      }

      const shippingType = validDetails[0].shippingType || "sea";

      const formData = new FormData();
      formData.append("reseller_code", resellerCode);
      formData.append("reseller_contact_no", resellerContactNo);
      formData.append("reseller_country", resolvedResellerCountry);
      formData.append("existing_seller", existingSeller);
      formData.append("gold_seller", goldSeller);
      formData.append("service_needed", serviceNeeded);
      formData.append("countries", JSON.stringify(countries));
      formData.append("shipping_type", shippingType);
      formData.append("shipping_type_by_country", JSON.stringify(shippingTypeByCountry));
      formData.append("movement_type_by_country", JSON.stringify(movementTypeByCountry));
      formData.append("purchase_details", JSON.stringify(processedDetails));

      const res = await fetch("/api/growth/qr/create", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to create QR");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.qr_number) {
        setCreatedQrNumber(data.qr_number);
        setShowSuccessModal(true);
        setLoading(false);
      } else {
        router.push("/dashboard/growth");
      }
    } catch (err) {
      setError("Unexpected error, please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Create Quotation Request (QR)</h2>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Customer Information</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Channel Name/User ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={resellerCode}
                onChange={(e) => setResellerCode(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                placeholder="Enter channel name or user ID"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Customer Contact No. <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={resellerContactNo}
                onChange={(e) => setResellerContactNo(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                placeholder="Enter contact number"
              />
            </div>
            <div className="relative space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Customer Country <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={resellerCountrySearch}
                  onChange={(e) => {
                    setResellerCountrySearch(e.target.value);
                    setShowResellerCountryDropdown(true);
                  }}
                  onFocus={() => setShowResellerCountryDropdown(true)}
                  onBlur={() => {
                    const match = TOP_COUNTRIES.find(
                      (c) => c.toLowerCase() === resellerCountrySearch.trim().toLowerCase()
                    );
                    if (match) {
                      setResellerCountry(match);
                      setResellerCountrySearch(match);
                    }
                  }}
                  placeholder="Search or select country"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                />
                {showResellerCountryDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowResellerCountryDropdown(false)}
                    />
                    <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-card">
                      {filterCountries(resellerCountrySearch, 0).length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-500">No countries found</div>
                      ) : (
                        filterCountries(resellerCountrySearch, 0).map((country) => (
                          <button
                            key={country}
                            type="button"
                            onClick={() => {
                              setResellerCountry(country);
                              setResellerCountrySearch(country);
                              setShowResellerCountryDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-900 transition-colors hover:bg-portal-400/20 hover:text-portal-900"
                          >
                            {country}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Existing Seller of Zambeel <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={existingSeller}
                onChange={(e) => setExistingSeller(e.target.value as "Yes" | "No")}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Gold Seller of Zambeel <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={goldSeller}
                onChange={(e) => setGoldSeller(e.target.value as "Yes" | "No")}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Services <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={serviceNeeded}
                onChange={(e) => setServiceNeeded(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
              >
                <option value="">Select service</option>
                <option value="Zambeel 360">Zambeel 360</option>
                <option value="DS2">DS2</option>
                <option value="DS3">DS3</option>
                <option value="DS4">DS4</option>
                <option value="Partner Stores">Partner Stores</option>
                <option value="Amazon">Amazon</option>
                <option value="Sourcing & Logistics">Sourcing & Logistics</option>
                <option value="Sourcing only">Sourcing only</option>
                <option value="Logistics Only">Logistics Only</option>
                <option value="3PL & Logistics">3PL & Logistics</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-700">
              Purchase Detail <span className="text-red-400">*</span>
            </label>
            <button
              type="button"
              onClick={addPurchaseDetail}
              className="text-xs font-medium text-gray-900 hover:text-gray-700"
            >
              + Add Purchase Detail
            </button>
          </div>

          {!serviceNeeded ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
              Waiting For you to Select the Service
            </div>
          ) : (
            <div className="space-y-3">
              {purchaseDetails.map((detail, index) => (
                <div
                  key={index}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-soft"
                >
                  {/* Zambeel-like, Sourcing & Logistics, Sourcing only fields */}
                  {(isZambeelLikeService(serviceNeeded) ||
                    serviceNeeded === "Sourcing & Logistics" ||
                    serviceNeeded === "Sourcing only") && (
                    <>
                      <div className="space-y-3">
                        <div className="grid gap-2 text-xs md:grid-cols-[1fr,1.5fr,auto]">
                          <div className="flex flex-col space-y-1">
                            <label className="block text-xs font-medium text-gray-700 whitespace-nowrap">
                              Product Name <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={detail.productName}
                              onChange={(e) =>
                                updatePurchaseDetail(index, "productName", e.target.value)
                              }
                              className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                              placeholder="Product name"
                            />
                          </div>
                          <div className="relative flex flex-col space-y-1">
                            <label className="block text-xs font-medium text-gray-700 whitespace-nowrap">
                              Destination Countries <span className="text-red-400">*</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {(detail.destinationCountries || []).map((c) => (
                                <span
                                  key={c}
                                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-900"
                                >
                                  {c}
                                  <button
                                    type="button"
                                    onClick={() => removeDestinationCountry(index, c)}
                                    className="text-gray-500 hover:text-red-600"
                                    aria-label={`Remove ${c}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              <div className="relative inline-block min-w-[120px]">
                                <input
                                  type="text"
                                  value={countrySearch[index]}
                                  onChange={(e) => {
                                    const newSearch = [...countrySearch];
                                    newSearch[index] = e.target.value;
                                    setCountrySearch(newSearch);
                                    setShowDropdown((prev) => {
                                      const next = [...prev];
                                      next[index] = true;
                                      return next;
                                    });
                                  }}
                                  onFocus={() => {
                                    setShowDropdown((prev) => {
                                      const next = [...prev];
                                      next[index] = true;
                                      return next;
                                    });
                                  }}
                                  placeholder="Add country"
                                  className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                                />
                                {showDropdown[index] && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={() => {
                                        setShowDropdown((prev) => {
                                          const next = [...prev];
                                          next[index] = false;
                                          return next;
                                        });
                                      }}
                                    />
                                    <div className="absolute z-20 mt-1 left-0 min-w-[160px] max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-card">
                                      {filterCountries(countrySearch[index], index).length === 0 ? (
                                        <div className="px-2 py-1.5 text-xs text-gray-500">No countries found</div>
                                      ) : (
                                        filterCountries(countrySearch[index], index).map((country) => (
                                          <button
                                            key={country}
                                            type="button"
                                            onClick={() => selectCountry(index, country)}
                                            className="w-full px-2 py-1.5 text-left text-xs text-portal-900 transition-colors hover:bg-portal-400/20"
                                          >
                                            {country}
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-end pb-0.5">
                            {purchaseDetails.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removePurchaseDetail(index)}
                                className="rounded-xl border border-red-300 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 whitespace-nowrap"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Per country: one row each – Quantity, Target Price, Ref Images, Remarks */}
                        {(() => {
                          const rows = ensureCountryDetailsSynced(detail);
                          if (rows.length === 0) return null;
                          return (
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-gray-700">
                                Per country: Qty · Currency · Target Price · Images · Remarks <span className="text-red-400">*</span>
                              </label>
                              <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-xs table-fixed">
                                  <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                      <th className="text-left py-2 px-2 font-medium text-gray-700 w-32">Country</th>
                                      <th className="text-left py-2 px-2 font-medium text-gray-700 w-20">Qty</th>
                                      <th className="text-left py-2 px-2 font-medium text-gray-700 w-20">Currency</th>
                                      <th className="text-left py-2 px-2 font-medium text-gray-700 w-24">Target Price</th>
                                      <th className="text-left py-2 px-2 font-medium text-gray-700 w-24">Remarks</th>
                                      <th className="text-left py-2 px-2 font-medium text-gray-700 w-44">Ref Images</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map((row, rowIdx) => {
                                      const currency = (row.currency as "AED" | "SAR" | "PKR") ?? (getCurrencyForCountry(row.country) as "AED" | "SAR" | "PKR");
                                      return (
                                        <tr key={row.country} className="border-b border-gray-100 last:border-0">
                                          <td className="py-2 px-2 align-top font-medium text-gray-900">{row.country}</td>
                                          <td className="py-2 px-2 align-top">
                                            <input
                                              type="number"
                                              min={0}
                                              value={row.quantity || ""}
                                              onChange={(e) =>
                                                updateCountryDetail(index, row.country, "quantity", Number(e.target.value) || 0)
                                              }
                                              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
                                              placeholder="0"
                                            />
                                          </td>
                                          <td className="py-2 px-2 align-top">
                                            <select
                                              value={currency}
                                              onChange={(e) =>
                                                updateCountryDetail(index, row.country, "currency", e.target.value as "AED" | "SAR" | "PKR")
                                              }
                                              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
                                            >
                                              <option value="AED">AED</option>
                                              <option value="SAR">SAR</option>
                                              <option value="PKR">PKR</option>
                                            </select>
                                          </td>
                                          <td className="py-2 px-2 align-top">
                                            <input
                                              type="number"
                                              step="0.01"
                                              min={0}
                                              value={row.targetPrice ?? ""}
                                              onChange={(e) =>
                                                updateCountryDetail(index, row.country, "targetPrice", Number(e.target.value) || 0)
                                              }
                                              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
                                              placeholder={`0 ${currency}`}
                                              title={currency}
                                            />
                                          </td>
                                          <td className="py-2 px-2 align-top border-l border-gray-100">
                                            <input
                                              type="text"
                                              value={row.remarks ?? ""}
                                              onChange={(e) =>
                                                updateCountryDetail(index, row.country, "remarks", e.target.value)
                                              }
                                              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
                                              placeholder="Notes..."
                                            />
                                          </td>
                                          {rowIdx === 0 ? (
                                            <td rowSpan={rows.length} className="py-2 px-2 align-top border-l border-gray-100">
                                              <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-1.5">
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  multiple
                                                  onChange={(e) => handleImageChange(index, e)}
                                                  className="w-full text-[10px] text-gray-600 file:mr-1 file:rounded file:border-0 file:bg-gray-800 file:px-1.5 file:py-0.5 file:text-[10px] file:text-white"
                                                />
                                                {detail.imagePreviews.length > 0 && (
                                                  <div className="mt-1 flex flex-wrap gap-0.5">
                                                    {detail.imagePreviews.slice(0, 3).map((preview, imgIdx) => (
                                                      <div key={imgIdx} className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-gray-200">
                                                        <img src={preview} alt="" className="h-full w-full object-cover" />
                                                        <button
                                                          type="button"
                                                          onClick={() => removeImage(index, imgIdx)}
                                                          className="absolute -right-0.5 -top-0.5 rounded-full bg-red-500 p-0.5 text-[8px] text-white"
                                                        >
                                                          ×
                                                        </button>
                                                      </div>
                                                    ))}
                                                    {detail.imagePreviews.length > 3 && (
                                                      <span className="text-[9px] text-gray-500">+{detail.imagePreviews.length - 3}</span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </td>
                                          ) : null}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Ship To Address for Sourcing & Logistics and Sourcing only */}
                        {(serviceNeeded === "Sourcing & Logistics" ||
                          serviceNeeded === "Sourcing only") && (
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-gray-700">
                              Ship to (Address) {serviceNeeded === "Sourcing & Logistics" && <span className="text-red-400">*</span>}
                            </label>
                            <textarea
                              required={serviceNeeded === "Sourcing & Logistics"}
                              value={detail.shipToAddress || ""}
                              onChange={(e) =>
                                updatePurchaseDetail(index, "shipToAddress", e.target.value)
                              }
                              rows={2}
                              className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                              placeholder="Enter shipping address..."
                            />
                          </div>
                        )}

                      </div>
                    </>
                  )}

                  {/* Logistics Only and 3PL & Logistics fields */}
                  {(serviceNeeded === "Logistics Only" || serviceNeeded === "3PL & Logistics") && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">
                          Product Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={detail.productName}
                          onChange={(e) =>
                            updatePurchaseDetail(index, "productName", e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                          placeholder="Product name"
                        />
                      </div>
                      <div className="grid gap-2 text-xs md:grid-cols-2">
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">
                            Ship From <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={detail.shipFrom || ""}
                            onChange={(e) =>
                              updatePurchaseDetail(index, "shipFrom", e.target.value)
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                            placeholder="Enter origin address"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">
                            Ship To <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={detail.shipTo || ""}
                            onChange={(e) =>
                              updatePurchaseDetail(index, "shipTo", e.target.value)
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                            placeholder="Enter destination address"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">
                            Shipping <span className="text-red-400">*</span>
                          </label>
                          <select
                            required
                            value={detail.shippingType}
                            onChange={(e) =>
                              updatePurchaseDetail(index, "shippingType", e.target.value as ShippingType)
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                          >
                            <option value="">Select</option>
                            <option value="air">Air</option>
                            <option value="sea">Sea</option>
                            <option value="road">Road</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">
                            Product Type <span className="text-red-400">*</span>
                          </label>
                          <select
                            required
                            value={detail.productType || ""}
                            onChange={(e) =>
                              updatePurchaseDetail(index, "productType", e.target.value)
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                          >
                            <option value="">Select</option>
                            <option value="With Battery">With Battery</option>
                            <option value="Without Battery">Without Battery</option>
                            <option value="Liquid Item">Liquid Item</option>
                            <option value="Fragile Item">Fragile Item</option>
                            <option value="Heavy Weight Item">Heavy Weight Item</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">
                            Brand <span className="text-red-400">*</span>
                          </label>
                          <select
                            required
                            value={detail.hasBrand || "No"}
                            onChange={(e) =>
                              updatePurchaseDetail(
                                index,
                                "hasBrand",
                                e.target.value as "Yes" | "No"
                              )
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">
                            No of Cartons <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={detail.noOfCartons || ""}
                            onChange={(e) =>
                              updatePurchaseDetail(index, "noOfCartons", Number(e.target.value) || 0)
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                            placeholder="Number"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">
                            Weight per Carton (KGs) <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="number"
                            required
                            step="0.01"
                            min={0}
                            value={detail.weightPerCarton || ""}
                            onChange={(e) =>
                              updatePurchaseDetail(
                                index,
                                "weightPerCarton",
                                Number(e.target.value) || 0
                              )
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">
                          Dimensions of Carton (cm) <span className="text-red-400">*</span>
                        </label>
                        <div className="grid gap-2 md:grid-cols-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] text-gray-500">Length</label>
                            <input
                              type="number"
                              required
                              step="0.01"
                              min={0}
                              value={detail.cartonLength || ""}
                              onChange={(e) =>
                                updatePurchaseDetail(index, "cartonLength", Number(e.target.value) || 0)
                              }
                              className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                              placeholder="Length"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-gray-500">Width</label>
                            <input
                              type="number"
                              required
                              step="0.01"
                              min={0}
                              value={detail.cartonWidth || ""}
                              onChange={(e) =>
                                updatePurchaseDetail(index, "cartonWidth", Number(e.target.value) || 0)
                              }
                              className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                              placeholder="Width"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-gray-500">Height</label>
                            <input
                              type="number"
                              required
                              step="0.01"
                              min={0}
                              value={detail.cartonHeight || ""}
                              onChange={(e) =>
                                updatePurchaseDetail(index, "cartonHeight", Number(e.target.value) || 0)
                              }
                              className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                              placeholder="Height"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">
                            Packing List Upload
                          </label>
                          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-2 transition-colors hover:border-gray-400">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleImageChange(index, e)}
                              className="mb-1.5 w-full text-[10px] text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-gray-900 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-white file:hover:bg-gray-800"
                            />
                            {detail.imagePreviews.length > 0 && (
                              <div className="grid grid-cols-3 gap-1.5">
                                {detail.imagePreviews.map((preview, imgIdx) => (
                                  <div key={imgIdx} className="relative">
                                    <img
                                      src={preview}
                                      alt={`Preview ${imgIdx + 1}`}
                                      className="h-14 w-full rounded-md object-cover"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeImage(index, imgIdx)}
                                      className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-[9px] text-white hover:bg-red-600"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">Remarks</label>
                          <textarea
                            value={detail.remarks}
                            onChange={(e) =>
                              updatePurchaseDetail(index, "remarks", e.target.value)
                            }
                            rows={2}
                            className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                            placeholder="Additional notes..."
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        {purchaseDetails.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePurchaseDetail(index)}
                            className="rounded-xl border border-red-300 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 whitespace-nowrap"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Creating..." : "Create QR"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card max-w-md border-gray-200 bg-white">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">QR Created Successfully!</h3>
              <p className="mt-2 text-sm text-gray-600">
                You have submitted a Quotation Request
              </p>
              <div className="mt-4 rounded-lg border-2 border-portal-400 bg-portal-50 p-4">
                <p className="text-xs font-medium text-gray-600">QR Number</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{createdQrNumber}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push("/dashboard/growth");
                }}
                className="btn-primary flex-1"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push(`/dashboard/growth/quotation-requests`);
                }}
                className="btn-secondary flex-1"
              >
                View History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
