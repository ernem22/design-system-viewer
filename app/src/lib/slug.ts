/** Turns a Demo title ("Button — variants") into a DOM-id-safe slug
   ("button-variants") — em dashes, slashes and punctuation all fold to "-". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
