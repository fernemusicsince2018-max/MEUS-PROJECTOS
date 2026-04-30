import Catalog from "../../components/catalog/Catalog.jsx";
import PublicLayout from "../../layouts/PublicLayout.jsx";

export default function PublicCatalogRoute(props) {
  return (
    <PublicLayout>
      <Catalog {...props} />
    </PublicLayout>
  );
}
