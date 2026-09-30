import React, { useState } from "react";

interface IceMarkLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const IceMarkLogo: React.FC<IceMarkLogoProps> = ({ className = "", size = "md" }) => {
  const [imgSrc, setImgSrc] = useState<string>("https://icemark.mn/images/logo_company-icemark.svg");

  const heightClasses = {
    sm: "h-7 sm:h-8",
    md: "h-9 sm:h-11",
    lg: "h-12 sm:h-14"
  }[size];

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <img
        src={imgSrc}
        alt="Ice Mark - Taste of Happiness"
        onError={() => {
          // If remote url fails or is blocked, fallback to local downloaded SVG
          if (imgSrc !== "/logo_company-icemark.svg") {
            setImgSrc("/logo_company-icemark.svg");
          }
        }}
        className={`${heightClasses} w-auto object-contain max-w-[160px] sm:max-w-[200px]`}
        loading="eager"
      />
    </div>
  );
};
