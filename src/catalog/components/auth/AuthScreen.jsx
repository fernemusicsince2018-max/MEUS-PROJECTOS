import React from "react";
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, Store } from "lucide-react";
import { FIELD_STYLE, PASSWORD_POLICY_HINT, SURFACE_STYLE } from "../../constants.js";
import BrandMark from "../common/BrandMark.jsx";
import { CollapsiblePanel } from "../common/UiBits.jsx";

const TAB_BUTTON = {
  flex: 1,
  border: "none",
  borderRadius: "999px",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  background: "transparent",
};

const RESET_INITIAL_STATE = {
  email: "",
  code: "",
  token: "",
  password: "",
  confirmPassword: "",
};

function readResetParamsFromUrl() {
  if (typeof window === "undefined") return { email: "", token: "" };
  const url = new URL(window.location.href);
  return {
    email: url.searchParams.get("reset_email") || "",
    token: url.searchParams.get("reset_token") || "",
  };
}

function clearResetParamsFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("reset_email");
  url.searchParams.delete("reset_token");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function AuthScreen({ brand, busy, onLogin, onRegister, onRequestPasswordReset, onResetPassword }) {
  const resetParams = React.useMemo(() => readResetParamsFromUrl(), []);
  const [mode, setMode] = React.useState("login");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loginForm, setLoginForm] = React.useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = React.useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [resetForm, setResetForm] = React.useState({
    ...RESET_INITIAL_STATE,
    email: resetParams.email,
    token: resetParams.token,
  });
  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [devResetCode, setDevResetCode] = React.useState("");
  const [devResetLink, setDevResetLink] = React.useState("");
  const [formVisibility, setFormVisibility] = React.useState({
    login: true,
    register: true,
    reset: true,
  });

  React.useEffect(() => {
    if (!resetParams.email || !resetParams.token) return;
    setMode("reset");
    setInfo("Link de recuperacao carregado. Define agora a tua nova palavra-passe.");
  }, [resetParams.email, resetParams.token]);

  function resetMessages() {
    setError("");
    setInfo("");
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setDevResetCode("");
    setDevResetLink("");
    setShowPassword(false);
    resetMessages();
    if (nextMode !== "reset") {
      clearResetParamsFromUrl();
      setResetForm((current) => ({ ...current, token: "" }));
    }
  }

  function toggleFormVisibility(modeKey) {
    setFormVisibility((current) => ({
      ...current,
      [modeKey]: !current[modeKey],
    }));
  }

  async function submitLogin(event) {
    event.preventDefault();
    resetMessages();

    try {
      await onLogin({
        email: loginForm.email.trim(),
        password: loginForm.password,
      });
    } catch (submitError) {
      setError(submitError.message || "Nao foi possivel iniciar sessao.");
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    resetMessages();

    if (registerForm.password.length < 10) {
      setError(PASSWORD_POLICY_HINT);
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError("A confirmacao da palavra-passe nao coincide.");
      return;
    }

    try {
      const response = await onRegister({
        fullName: registerForm.fullName.trim(),
        email: registerForm.email.trim(),
        password: registerForm.password,
      });

      if (response?.pendingStoreSetup) {
        setLoginForm({ email: registerForm.email.trim(), password: "" });
        setInfo(response.message || "Conta criada com sucesso. Aguarda a criacao da loja pelo administrador.");
        setMode("login");
      }
    } catch (submitError) {
      setError(submitError.message || "Nao foi possivel criar a conta.");
    }
  }

  async function submitResetRequest(event) {
    event.preventDefault();
    resetMessages();
    setDevResetCode("");
    setDevResetLink("");

    if (!resetForm.email.trim()) {
      setError("Indica o email da conta.");
      return;
    }

    try {
      const response = await onRequestPasswordReset({
        email: resetForm.email.trim(),
      });
      setInfo(response?.message || "Se existir conta com este email, enviamos um link de recuperacao.");
      setDevResetCode(response?.resetCode || "");
      setDevResetLink(response?.resetLink || "");
    } catch (submitError) {
      setError(submitError.message || "Nao foi possivel preparar a recuperacao.");
    }
  }

  async function submitResetPassword(event) {
    event.preventDefault();
    resetMessages();

    if (!resetForm.email.trim()) {
      setError("Indica o email da conta.");
      return;
    }

    if (!resetForm.token.trim() && !resetForm.code.trim()) {
      setError("Abre o link do email ou indica o codigo de recuperacao.");
      return;
    }

    if (resetForm.password.length < 10) {
      setError(PASSWORD_POLICY_HINT);
      return;
    }

    if (resetForm.password !== resetForm.confirmPassword) {
      setError("A confirmacao da palavra-passe nao coincide.");
      return;
    }

    try {
      const response = await onResetPassword({
        email: resetForm.email.trim(),
        code: resetForm.code.trim(),
        token: resetForm.token.trim(),
        password: resetForm.password,
      });
      setInfo(response?.message || "Palavra-passe atualizada. Ja podes entrar.");
      setDevResetCode("");
      setDevResetLink("");
      setResetForm({
        ...RESET_INITIAL_STATE,
        email: resetForm.email.trim(),
      });
      clearResetParamsFromUrl();
      setMode("login");
    } catch (submitError) {
      setError(submitError.message || "Nao foi possivel atualizar a palavra-passe.");
    }
  }

  const accent = brand.accent || "#1c9a74";

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", background: "var(--color-background-secondary)" }}>
      <div style={{ padding: "28px 24px 32px", background: `linear-gradient(145deg, ${brand.dark} 0%, ${accent} 62%, ${brand.highlight} 180%)`, color: "white", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 28%), radial-gradient(circle at bottom right, rgba(255,255,255,0.1), transparent 22%)" }} />
        <div style={{ position: "relative", maxWidth: "560px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)" }}>
            <BrandMark brand={brand} size={44} rounded={14} />
            <div>
              <div style={{ fontSize: "14px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{brand.name}</div>
              <div style={{ fontSize: "11px", opacity: 0.85 }}>Painel do lojista</div>
            </div>
          </div>

          <div style={{ marginTop: "72px", maxWidth: "520px" }}>
            <div style={{ fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: "800", opacity: 0.8, marginBottom: "14px" }}>
              {brand.tagline || "Sua loja no WhatsApp"}
            </div>
            <div style={{ fontSize: "42px", lineHeight: 1.02, fontWeight: "800", fontFamily: "var(--font-display)" }}>
              Cada loja entra com conta. O cliente compra sem login.
            </div>
            <div style={{ marginTop: "16px", fontSize: "15px", opacity: 0.9, maxWidth: "470px" }}>
              Cria uma conta para gerir a tua loja, produtos e link do catalogo. Os teus clientes entram direto no catalogo e enviam o pedido pelo WhatsApp.
            </div>
          </div>

          <div style={{ display: "grid", gap: "14px", marginTop: "42px", maxWidth: "460px" }}>
            {[
              ["Uma conta por loja", "Cada lojista entra no proprio painel e grava os dados no PostgreSQL.", Store],
              ["Sessao protegida", "O acesso ao painel admin fica protegido por login, bloqueio por tentativas e sessao segura.", ShieldCheck],
              ["Recuperacao segura", "Se esqueceres a palavra-passe, podes gerar um codigo temporario e trocar a credencial.", KeyRound],
            ].map(([title, copy, Icon]) => (
              <div key={title} style={{ padding: "16px 18px", borderRadius: "22px", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "14px", background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={18} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "700" }}>{title}</div>
                  <div style={{ marginTop: "5px", fontSize: "12px", opacity: 0.88 }}>{copy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "28px 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...SURFACE_STYLE, width: "100%", maxWidth: "430px", padding: "22px", boxShadow: "0 24px 80px rgba(16, 35, 31, 0.1)" }}>
          <div style={{ display: "flex", gap: "8px", padding: "6px", background: "var(--color-background-secondary)", borderRadius: "999px", marginBottom: "20px" }}>
            {[
              ["login", "Entrar"],
              ["register", "Pedir acesso"],
              ["reset", "Recuperar"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => switchMode(id)}
                data-testid={`auth-mode-${id}`}
                style={{
                  ...TAB_BUTTON,
                  background: mode === id ? accent : "transparent",
                  color: mode === id ? "white" : "var(--color-text-secondary)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "login" ? (
            <CollapsiblePanel
              title="Entra na tua loja"
              description="Usa o email e a palavra-passe da conta do lojista."
              open={formVisibility.login}
              onToggle={() => toggleFormVisibility("login")}
              summary="Os campos de entrada estao escondidos. Clica em Mostrar formulario para voltar a preencher email e palavra-passe."
              style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}
              bodyStyle={{ gap: "14px" }}
            >
              <form onSubmit={submitLogin} style={{ display: "grid", gap: "14px" }}>
                <label style={{ display: "grid", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700" }}>Email</span>
                  <div style={{ position: "relative" }}>
                    <Mail size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" }} />
                    <input
                      data-testid="auth-login-email"
                      value={loginForm.email}
                      onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                      placeholder="lojista@exemplo.com"
                      style={{ ...FIELD_STYLE, paddingLeft: "36px" }}
                    />
                  </div>
                </label>

                <label style={{ display: "grid", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700" }}>Palavra-passe</span>
                  <div style={{ position: "relative" }}>
                    <LockKeyhole size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" }} />
                    <input
                      data-testid="auth-login-password"
                      type={showPassword ? "text" : "password"}
                      value={loginForm.password}
                      onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                      placeholder="A tua palavra-passe"
                      style={{ ...FIELD_STYLE, paddingLeft: "36px", paddingRight: "40px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", display: "flex", color: "var(--color-text-secondary)", padding: 0 }}
                      title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                {error && <div style={{ padding: "11px 12px", borderRadius: "var(--border-radius-md)", background: "#fee2e2", color: "#b91c1c", fontSize: "12px", fontWeight: "700" }}>{error}</div>}
                {info && <div style={{ padding: "11px 12px", borderRadius: "var(--border-radius-md)", background: "#dcfce7", color: "#166534", fontSize: "12px", fontWeight: "700" }}>{info}</div>}

                <button type="submit" data-testid="auth-login-submit" disabled={busy} style={{ border: "none", borderRadius: "var(--border-radius-md)", padding: "13px 16px", background: accent, color: "white", fontWeight: "800", cursor: busy ? "wait" : "pointer" }}>
                  {busy ? "A entrar..." : "Entrar no painel"}
                </button>

                <button type="button" data-testid="auth-open-reset" onClick={() => switchMode("reset")} style={{ border: "none", background: "transparent", color: accent, cursor: "pointer", fontSize: "12px", fontWeight: "700", justifySelf: "start", padding: 0 }}>
                  Esqueci a palavra-passe
                </button>
              </form>
            </CollapsiblePanel>
          ) : null}

          {mode === "register" ? (
            <CollapsiblePanel
              title="Pede acesso a plataforma"
              description="A conta pode ser criada aqui, mas a loja deixa de nascer automaticamente. O super admin precisa criar ou ativar a loja antes do primeiro acesso."
              open={formVisibility.register}
              onToggle={() => toggleFormVisibility("register")}
              summary="Os campos de cadastro estao escondidos. Clica em Mostrar formulario para voltar a pedir acesso."
              style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}
              bodyStyle={{ gap: "14px" }}
            >
              <form onSubmit={submitRegister} style={{ display: "grid", gap: "14px" }}>
                <label style={{ display: "grid", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700" }}>Nome do responsavel</span>
                  <input
                    data-testid="auth-register-full-name"
                    value={registerForm.fullName}
                    onChange={(event) => setRegisterForm({ ...registerForm, fullName: event.target.value })}
                    placeholder="Opcional"
                    style={FIELD_STYLE}
                  />
                </label>

                <label style={{ display: "grid", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700" }}>Email</span>
                  <div style={{ position: "relative" }}>
                    <Mail size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" }} />
                    <input
                      data-testid="auth-register-email"
                      value={registerForm.email}
                      onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                      placeholder="lojista@exemplo.com"
                      style={{ ...FIELD_STYLE, paddingLeft: "36px" }}
                    />
                  </div>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <label style={{ display: "grid", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700" }}>Palavra-passe</span>
                    <div style={{ position: "relative" }}>
                      <input
                        data-testid="auth-register-password"
                        type={showPassword ? "text" : "password"}
                        value={registerForm.password}
                        onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                        placeholder="Palavra-passe forte"
                        style={{ ...FIELD_STYLE, paddingRight: "40px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", display: "flex", color: "var(--color-text-secondary)", padding: 0 }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  <label style={{ display: "grid", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700" }}>Confirmar</span>
                    <div style={{ position: "relative" }}>
                      <input
                        data-testid="auth-register-confirm-password"
                        type={showPassword ? "text" : "password"}
                        value={registerForm.confirmPassword}
                        onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })}
                        placeholder="Repete a palavra-passe"
                        style={{ ...FIELD_STYLE, paddingRight: "40px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", display: "flex", color: "var(--color-text-secondary)", padding: 0 }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>
                </div>

                <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>{PASSWORD_POLICY_HINT}</div>

                {error && <div style={{ padding: "11px 12px", borderRadius: "var(--border-radius-md)", background: "#fee2e2", color: "#b91c1c", fontSize: "12px", fontWeight: "700" }}>{error}</div>}
                {info && <div style={{ padding: "11px 12px", borderRadius: "var(--border-radius-md)", background: "#dcfce7", color: "#166534", fontSize: "12px", fontWeight: "700" }}>{info}</div>}

                <button type="submit" data-testid="auth-register-submit" disabled={busy} style={{ border: "none", borderRadius: "var(--border-radius-md)", padding: "13px 16px", background: accent, color: "white", fontWeight: "800", cursor: busy ? "wait" : "pointer" }}>
                  {busy ? "A enviar..." : "Pedir acesso"}
                </button>
              </form>
            </CollapsiblePanel>
          ) : null}

          {mode === "reset" ? (
            <CollapsiblePanel
              title="Recuperar acesso"
              description="Pede um link seguro por email e define uma nova palavra-passe forte."
              open={formVisibility.reset}
              onToggle={() => toggleFormVisibility("reset")}
              summary="Os campos de recuperacao estao escondidos. Clica em Mostrar formulario para voltar a pedir o link ou trocar a palavra-passe."
              style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}
              bodyStyle={{ gap: "16px" }}
            >
              <form onSubmit={submitResetRequest} style={{ display: "grid", gap: "12px" }}>
                <label style={{ display: "grid", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700" }}>Email da conta</span>
                  <div style={{ position: "relative" }}>
                    <Mail size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" }} />
                    <input
                      data-testid="auth-reset-email"
                      value={resetForm.email}
                      onChange={(event) => setResetForm({ ...resetForm, email: event.target.value })}
                      placeholder="lojista@exemplo.com"
                      style={{ ...FIELD_STYLE, paddingLeft: "36px" }}
                    />
                  </div>
                </label>

                <button type="submit" data-testid="auth-reset-request-submit" disabled={busy} style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "12px 16px", background: "transparent", color: "var(--color-text-primary)", fontWeight: "800", cursor: busy ? "wait" : "pointer" }}>
                  {busy ? "A preparar..." : "Enviar link"}
                </button>
              </form>

              <form onSubmit={submitResetPassword} style={{ display: "grid", gap: "12px" }}>
                {!resetForm.token ? (
                  <label style={{ display: "grid", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700" }}>Codigo temporario</span>
                    <div style={{ position: "relative" }}>
                      <KeyRound size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" }} />
                      <input
                        data-testid="auth-reset-code"
                        value={resetForm.code}
                        onChange={(event) => setResetForm({ ...resetForm, code: event.target.value })}
                        placeholder="Codigo ou token"
                        style={{ ...FIELD_STYLE, paddingLeft: "36px" }}
                      />
                    </div>
                  </label>
                ) : (
                  <div style={{ padding: "11px 12px", borderRadius: "var(--border-radius-md)", background: "#eff6ff", color: "#1d4ed8", fontSize: "12px", fontWeight: "700" }}>
                    Link de recuperacao validado para {resetForm.email}.
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <label style={{ display: "grid", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700" }}>Nova palavra-passe</span>
                    <div style={{ position: "relative" }}>
                      <input
                        data-testid="auth-reset-password"
                        type={showPassword ? "text" : "password"}
                        value={resetForm.password}
                        onChange={(event) => setResetForm({ ...resetForm, password: event.target.value })}
                        placeholder="Palavra-passe forte"
                        style={{ ...FIELD_STYLE, paddingRight: "40px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", display: "flex", color: "var(--color-text-secondary)", padding: 0 }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  <label style={{ display: "grid", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700" }}>Confirmar</span>
                    <div style={{ position: "relative" }}>
                      <input
                        data-testid="auth-reset-confirm-password"
                        type={showPassword ? "text" : "password"}
                        value={resetForm.confirmPassword}
                        onChange={(event) => setResetForm({ ...resetForm, confirmPassword: event.target.value })}
                        placeholder="Repete a nova palavra-passe"
                        style={{ ...FIELD_STYLE, paddingRight: "40px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", display: "flex", color: "var(--color-text-secondary)", padding: 0 }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>
                </div>

                <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>{PASSWORD_POLICY_HINT}</div>

                {devResetCode && (
                  <div data-testid="auth-reset-dev-code" style={{ padding: "11px 12px", borderRadius: "var(--border-radius-md)", background: "#fff7ed", color: "#9a3412", fontSize: "12px", fontWeight: "700" }}>
                    Token de teste neste ambiente: {devResetCode}
                  </div>
                )}

                {devResetLink && (
                  <div style={{ padding: "11px 12px", borderRadius: "var(--border-radius-md)", background: "#fff7ed", color: "#9a3412", fontSize: "12px", fontWeight: "700", wordBreak: "break-word" }}>
                    Link de teste neste ambiente: <a href={devResetLink} style={{ color: "#1d4ed8" }}>{devResetLink}</a>
                  </div>
                )}

                {error && <div style={{ padding: "11px 12px", borderRadius: "var(--border-radius-md)", background: "#fee2e2", color: "#b91c1c", fontSize: "12px", fontWeight: "700" }}>{error}</div>}
                {info && <div style={{ padding: "11px 12px", borderRadius: "var(--border-radius-md)", background: "#dcfce7", color: "#166534", fontSize: "12px", fontWeight: "700" }}>{info}</div>}

                <button type="submit" data-testid="auth-reset-submit" disabled={busy} style={{ border: "none", borderRadius: "var(--border-radius-md)", padding: "13px 16px", background: accent, color: "white", fontWeight: "800", cursor: busy ? "wait" : "pointer" }}>
                  {busy ? "A atualizar..." : "Trocar palavra-passe"}
                </button>
              </form>
            </CollapsiblePanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
