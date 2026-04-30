import Admin from "../../components/admin/Admin.jsx";
import MerchantLayout from "../../layouts/MerchantLayout.jsx";

export default function MerchantAppRoute(props) {
  return (
    <MerchantLayout brand={props.brand} screen="admin">
      <Admin {...props} />
    </MerchantLayout>
  );
}
