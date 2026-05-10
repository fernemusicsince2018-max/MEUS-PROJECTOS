import OrderTrackingPage from "../../components/catalog/OrderTrackingPage.jsx";
import PublicLayout from "../../layouts/PublicLayout.jsx";

export default function OrderTrackingRoute({
  order,
  loading,
  error,
  reviewBusy,
  onSubmitReview,
  onBackToStore,
  toast,
  toastNode,
}) {
  return (
    <PublicLayout>
      <OrderTrackingPage
        order={order}
        loading={loading}
        error={error}
        reviewBusy={reviewBusy}
        onSubmitReview={onSubmitReview}
        onBackToStore={onBackToStore}
      />
      {toast ? toastNode : null}
    </PublicLayout>
  );
}
