import PwaInstallPrompt from "../components/system/PwaInstallPrompt.jsx";

export default function SuperAdminLayout({ brand, screen = "superadmin", children }) {
  return (
    <>
      <div data-app-layout="superadmin" data-app-surface="superadmin">
        {children}
      </div>
      <PwaInstallPrompt brand={brand} screen={screen} />
    </>
  );
}
