export function trustedRequestOrigin(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;
  const supplied = request.headers.get('origin') ?? request.headers.get('referer');
  if (!supplied) return false;
  try {
    return new URL(supplied).origin === requestOrigin;
  } catch {
    return false;
  }
}

