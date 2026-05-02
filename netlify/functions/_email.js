function getHeader(event, name) {
  const headers = event?.headers || {};
  const expected = String(name || "").toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === expected) {
      return String(value || "");
    }
  }

  return "";
}

function getAppBaseUrl(event) {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    process.env.URL ||
    "";

  if (configured) {
    return String(configured).replace(/\/$/, "");
  }

  const forwardedProto = getHeader(event, "x-forwarded-proto");
  const host = getHeader(event, "x-forwarded-host") || getHeader(event, "host");
  const protocol = forwardedProto || (String(host).includes("localhost") || String(host).includes("127.0.0.1") ? "http" : "https");

  if (!host) {
    throw new Error("Nao foi possivel determinar a URL publica da aplicacao.");
  }

  return `${protocol}://${host}`.replace(/\/$/, "");
}

function buildPasswordResetLink(event, email, token) {
  const url = new URL("/auth", `${getAppBaseUrl(event)}/`);
  url.searchParams.set("reset_email", email);
  url.searchParams.set("reset_token", token);
  return url.toString();
}

function isEmailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.PASSWORD_RESET_FROM_EMAIL);
}

async function sendPasswordResetEmail({ event, toEmail, resetLink }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const fromAddress = String(process.env.PASSWORD_RESET_FROM_EMAIL || "").trim();
  const fromName = String(process.env.PASSWORD_RESET_FROM_NAME || "KastroZap").trim();
  const replyTo = String(process.env.PASSWORD_RESET_REPLY_TO || "").trim();
  const from = fromAddress.includes("<") ? fromAddress : `${fromName} <${fromAddress}>`;

  if (!apiKey || !fromAddress) {
    throw new Error("O envio de email de recuperacao ainda nao esta configurado.");
  }

  const subject = "Recupera o acesso ao KastroZap";
  const html = `
    <div style="margin:0;padding:24px;background:#f3f7f5;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #d9e7df;">
        <div style="padding:28px 28px 20px;background:linear-gradient(135deg,#1b1c48 0%,#25ae82 62%,#ffc61a 180%);color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;opacity:0.82;">KastroZap</div>
          <h1 style="margin:14px 0 0;font-size:28px;line-height:1.08;">Recupera a tua palavra-passe</h1>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.5;max-width:420px;opacity:0.94;">
            Recebemos um pedido para redefinir o acesso da tua conta. Usa o botao abaixo para escolher uma nova palavra-passe.
          </p>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;">
            Este link e valido por 30 minutos e so deve ser usado por ti. Se nao pediste esta recuperacao, podes ignorar este email com seguranca.
          </p>
          <div style="margin:28px 0;">
            <a href="${resetLink}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#25ae82;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
              Redefinir palavra-passe
            </a>
          </div>
          <p style="margin:0 0 10px;font-size:12px;color:#475569;">Se o botao nao abrir, copia este link no browser:</p>
          <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;color:#1d4ed8;">${resetLink}</p>
        </div>
      </div>
    </div>
  `;
  const text = [
    "KastroZap",
    "",
    "Recebemos um pedido para redefinir a tua palavra-passe.",
    "Usa este link nas proximas 30 minutos:",
    resetLink,
    "",
    "Se nao pediste esta recuperacao, ignora este email.",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      reply_to: replyTo || undefined,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    let errorBody = "";
    try {
      errorBody = await response.text();
    } catch (error) {}
    throw new Error(errorBody || "Falha ao enviar o email de recuperacao.");
  }
}

async function sendPlanActivationEmail({ toEmail, storeName, planName, expiryDate, totalPrice, currencyCode }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const fromAddress = String(process.env.PASSWORD_RESET_FROM_EMAIL || "").trim();
  const fromName = String(process.env.PASSWORD_RESET_FROM_NAME || "KastroZap").trim();
  const from = fromAddress.includes("<") ? fromAddress : `${fromName} <${fromAddress}>`;

  if (!apiKey || !fromAddress) return;

  const formattedDate = new Date(expiryDate).toLocaleDateString("pt-PT");
  const formattedPrice = new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currencyCode || "AOA",
  }).format(totalPrice);

  const subject = `Plano ativado: bem-vindo ao ${planName}!`;
  const html = `
    <div style="margin:0;padding:24px;background:#f3f7f5;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #d9e7df;">
        <div style="padding:28px;background:linear-gradient(135deg,#1b1c48 0%,#25ae82 62%,#ffc61a 180%);color:#ffffff;">
          <h1 style="margin:0;font-size:24px;">O teu plano está ativo!</h1>
          <p style="margin:10px 0 0;opacity:0.9;">Olá, a loja <strong>${storeName}</strong> já tem acesso às funcionalidades premium.</p>
        </div>
        <div style="padding:28px;">
          <div style="background:#f8fafc;padding:20px;border-radius:12px;margin-bottom:20px;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Detalhes da Assinatura</div>
            <div style="font-size:16px;font-weight:700;">${planName}</div>
            <div style="font-size:14px;color:#475569;margin-top:8px;">Válido até: <strong>${formattedDate}</strong></div>
            <div style="font-size:14px;color:#475569;">Investimento: <strong>${formattedPrice}</strong></div>
          </div>
          <p style="font-size:14px;line-height:1.6;">O teu catálogo já está disponível e configurado com os limites do novo plano. Podes começar a adicionar produtos e a vender agora mesmo.</p>
          <div style="margin-top:24px;">
            <a href="${process.env.APP_BASE_URL}" style="display:inline-block;padding:12px 20px;background:#25ae82;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">Aceder ao Painel</a>
          </div>
        </div>
      </div>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    let errorBody = "";
    try {
      errorBody = await response.text();
    } catch (error) {}
    throw new Error(errorBody || "Falha ao enviar o email de ativacao do plano.");
  }
}

export { 
  buildPasswordResetLink, 
  isEmailDeliveryConfigured, 
  sendPasswordResetEmail, 
  sendPlanActivationEmail 
};
