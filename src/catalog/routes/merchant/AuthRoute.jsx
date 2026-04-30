import AuthScreen from "../../components/auth/AuthScreen.jsx";
import MerchantLayout from "../../layouts/MerchantLayout.jsx";

export default function AuthRoute({
  brand,
  busy,
  onLogin,
  onRegister,
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
        onRequestPasswordReset={onRequestPasswordReset}
        onResetPassword={onResetPassword}
      />
    </MerchantLayout>
  );
}
