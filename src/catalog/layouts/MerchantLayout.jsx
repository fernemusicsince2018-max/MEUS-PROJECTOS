import PwaInstallPrompt from "../components/system/PwaInstallPrompt.jsx";

export default function MerchantLayout({ brand, screen, children }) {
  return (
    <>
      <div data-app-layout="merchant" data-app-surface="merchant">
        {children}
      </div>
      <PwaInstallPrompt brand={brand} screen={screen} />
    </>
  );
}
