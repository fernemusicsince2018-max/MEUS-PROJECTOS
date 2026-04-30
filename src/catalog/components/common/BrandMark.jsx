export default function BrandMark({ brand, size = 44, rounded = 14 }) {
  if (brand.logoUrl) {
    return (
      <img
        src={brand.logoUrl}
        alt={brand.name}
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          borderRadius: rounded,
          display: "block",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: `linear-gradient(135deg, ${brand.accent} 0%, ${brand.dark} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: "800",
        fontSize: size * 0.34,
        letterSpacing: "0.08em",
        boxShadow: "0 10px 25px rgba(12, 37, 34, 0.22)",
      }}
    >
      {brand.initials}
    </div>
  );
}
