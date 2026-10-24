import { Resend } from "resend";

const APP_NAME = process.env.APP_NAME ?? "Sınıf Platformu";
const FROM = process.env.EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

type Recipient = { name: string; email: string };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout({ heading, paragraphs, action }: {
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
}) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${p}</p>`).join("");
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#171717;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#666">Düğme çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:<br><span style="word-break:break-all">${escapeHtml(action.url)}</span></p>`
    : "";
  return `<!doctype html><html lang="tr"><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#171717;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>${body}${button}
    <p style="margin:32px 0 0;font-size:12px;color:#888">${escapeHtml(APP_NAME)}</p></body></html>`;
}

async function send(to: Recipient, subject: string, html: string, text: string) {
  if (!resend) {
    // Development fallback: no email provider configured, print the message instead.
    console.info(`\n[e-posta] Kime: ${to.email}\n[e-posta] Konu: ${subject}\n${text}\n`);
    return;
  }
  const { error } = await resend.emails.send({ from: FROM, to: to.email, subject, html, text });
  if (error) throw new Error(`E-posta gönderilemedi: ${error.message}`);
}

export async function sendVerificationEmail(to: Recipient, url: string) {
  const name = escapeHtml(to.name);
  await send(
    to,
    "E-posta adresinizi doğrulayın",
    layout({
      heading: "E-posta adresinizi doğrulayın",
      paragraphs: [
        `Merhaba ${name},`,
        "Hesabınızı etkinleştirmek için aşağıdaki düğmeye tıklayın. Bağlantı 1 saat geçerlidir.",
      ],
      action: { label: "E-postamı doğrula", url },
    }),
    `Merhaba ${to.name},\nHesabınızı etkinleştirmek için bağlantıyı açın (1 saat geçerli):\n${url}`,
  );
}

export async function sendPasswordResetEmail(to: Recipient, url: string) {
  const name = escapeHtml(to.name);
  await send(
    to,
    "Şifre sıfırlama isteği",
    layout({
      heading: "Şifrenizi sıfırlayın",
      paragraphs: [
        `Merhaba ${name},`,
        "Hesabınız için bir şifre sıfırlama isteği aldık. Yeni şifre belirlemek için aşağıdaki düğmeye tıklayın. Bağlantı 1 saat geçerlidir.",
        "Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.",
      ],
      action: { label: "Şifremi sıfırla", url },
    }),
    `Merhaba ${to.name},\nŞifrenizi sıfırlamak için bağlantıyı açın (1 saat geçerli):\n${url}\nBu isteği siz yapmadıysanız yok sayın.`,
  );
}

export async function sendTeacherApprovedEmail(to: Recipient, loginUrl: string) {
  const name = escapeHtml(to.name);
  await send(
    to,
    "Öğretmen hesabınız onaylandı",
    layout({
      heading: "Öğretmen hesabınız onaylandı",
      paragraphs: [`Merhaba ${name},`, "Artık giriş yapıp sınıf oluşturabilirsiniz."],
      action: { label: "Giriş yap", url: loginUrl },
    }),
    `Merhaba ${to.name},\nÖğretmen hesabınız onaylandı. Giriş yapın: ${loginUrl}`,
  );
}

export async function sendTeacherRejectedEmail(to: Recipient) {
  const name = escapeHtml(to.name);
  await send(
    to,
    "Öğretmen başvurunuz hakkında",
    layout({
      heading: "Öğretmen başvurunuz onaylanmadı",
      paragraphs: [
        `Merhaba ${name},`,
        "Öğretmen hesabı başvurunuz yönetici tarafından onaylanmadı. Bir hata olduğunu düşünüyorsanız okul yöneticinizle iletişime geçin.",
      ],
    }),
    `Merhaba ${to.name},\nÖğretmen hesabı başvurunuz onaylanmadı. Bir hata olduğunu düşünüyorsanız okul yöneticinizle iletişime geçin.`,
  );
}
