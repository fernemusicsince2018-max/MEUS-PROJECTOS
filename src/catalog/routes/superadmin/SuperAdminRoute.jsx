import SuperAdminPanel from "../../components/admin/SuperAdminPanel.jsx";
import SuperAdminLayout from "../../layouts/SuperAdminLayout.jsx";

export default function SuperAdminRoute(props) {
  return (
    <SuperAdminLayout brand={props.brand}>
      <SuperAdminPanel {...props} />
    </SuperAdminLayout>
  );
}
