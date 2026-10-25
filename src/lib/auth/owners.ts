const ownerEmails = new Set(["albadwi730@gmail.com", "gmilsaed2@gmail.com"]);

export function isOwnerEmail(email?: string | null) {
  return ownerEmails.has(email?.trim().toLowerCase() ?? "");
}
