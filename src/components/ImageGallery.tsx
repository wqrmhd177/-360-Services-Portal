"use client";

import React, { useState } from "react";
import Image from "next/image";

interface ImageGalleryProps {
  images: string[];
  alt?: string;
  className?: string;
  thumbnailSize?: "sm" | "md" | "lg";
}

export default function ImageGallery({
  images,
  alt = "Image",
  className = "",
  thumbnailSize = "md",
}: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!images || images.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">No images attached</div>
    );
  }

  // Normalize image path: add leading slash if relative path, or keep absolute URLs
  const normalizePath = (path: string): string => {
    if (!path) return "";
    // If it's already an absolute URL or starts with /, return as is
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
      return path;
    }
    // Otherwise, add leading slash for relative paths
    return `/${path}`;
  };

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  const thumbnailClass = sizeClasses[thumbnailSize];

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {images.map((imgPath, idx) => {
          const normalizedPath = normalizePath(imgPath);
          return (
            <div
              key={idx}
              className={`relative ${thumbnailClass} cursor-pointer border border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 transition-colors`}
              onClick={() => setSelectedImage(normalizedPath)}
            >
              <Image
                src={normalizedPath}
                alt={`${alt} ${idx + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100px, 150px"
              />
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 hover:bg-gray-100 transition-colors"
            >
              <svg
                className="w-6 h-6 text-gray-800"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={selectedImage}
                alt={alt}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 1200px"
              />
            </div>
            <a
              href={selectedImage}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 right-4 bg-white px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              Download
            </a>
          </div>
        </div>
      )}
    </>
  );
}
