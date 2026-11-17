/**
 * Copy / share helpers that also work on plain http:// (navigator.clipboard
 * and navigator.share exist only in secure contexts).
 */

/** Copies text to the clipboard. Returns false when the browser refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy method
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** sms: link; iOS wants "&body=", Android accepts both "?body=" and "?&body=". */
export function smsUrl(text: string): string {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return `sms:${ios ? '&' : '?'}body=${encodeURIComponent(text)}`;
}

/** Native share sheet (phones, https only). Returns false when unavailable or cancelled. */
export async function nativeShare(text: string, title: string): Promise<boolean> {
  if (!window.isSecureContext || typeof navigator.share !== 'function') return false;
  try {
    await navigator.share({ title, text });
    return true;
  } catch {
    return false;
  }
}

export const canNativeShare = (): boolean =>
  typeof window !== 'undefined' && window.isSecureContext && typeof navigator.share === 'function';
