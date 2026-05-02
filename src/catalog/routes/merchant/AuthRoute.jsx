import AuthScreen from "../../components/auth/AuthScreen.jsx";
import MerchantLayout from "../../layouts/MerchantLayout.jsx";

export default function AuthRoute({
  brand,
  busy,
  onLogin,
  onRegister,
  onCheckRegisterAvailability,
  onConfirmRegisterApproval,
  onRequestPasswordReset,
  onResetPassword,
}) {
  return (
    <MerchantLayout brand={brand} screen="auth">
      <AuthScreen
        brand={brand}
        busy={busy}
        onLogin={onLogin}
        onRegister={onRegister}
        onCheckRegisterAvailability={onCheckRegisterAvailability}
        onConfirmRegisterApproval={onConfirmRegisterApproval}
        onRequestPasswordReset={onRequestPasswordReset}
        onResetPassword={onResetPassword}
      />
    </MerchantLayout>
  );
}
