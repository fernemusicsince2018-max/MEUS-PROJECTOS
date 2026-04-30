import BlockedCatalog from "../../components/system/BlockedCatalog.jsx";
import PublicLayout from "../../layouts/PublicLayout.jsx";

export default function BlockedCatalogRoute({
  platformBrand,
  store,
  message,
  planStatus,
  planExpiresAt,
  onRetry,
}) {
  return (
    <PublicLayout>
      <BlockedCatalog
        platformBrand={platformBrand}
        store={store}
        message={message}
        planStatus={planStatus}
        planExpiresAt={planExpiresAt}
        onRetry={onRetry}
      />
    </PublicLayout>
  );
}
