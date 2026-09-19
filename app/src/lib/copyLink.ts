export async function copyLinkToView(): Promise<void> {
  await navigator.clipboard.writeText(window.location.href);
}
