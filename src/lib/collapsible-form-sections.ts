/**
 * Optional `data-collapsible-open="N"` opens the first N sections (default 1).
 * Detaches `.admin-actions` rows first so Save / submit controls stay visible
 * after all sections instead of inside a collapsed accordion panel.
 */
export function applyCollapsibleFormSections(scope: ParentNode): void {
  const blocks = Array.from(
    scope.querySelectorAll<HTMLElement>(
      ".admin-form[data-collapsible='true'], .club-form-grid[data-collapsible='true']",
    ),
  );
  for (const block of blocks) {
    if (block.dataset.collapsibleReady === "1") continue;
    const headings = Array.from(block.querySelectorAll<HTMLElement>(":scope > h4.full"));
    if (!headings.length) {
      block.dataset.collapsibleReady = "1";
      continue;
    }
    const openCountRaw = Number(block.dataset.collapsibleOpen ?? "1");
    const openCount = Number.isFinite(openCountRaw) && openCountRaw >= 1 ? Math.floor(openCountRaw) : 1;

    const detachedActionRows = Array.from(
      block.querySelectorAll<HTMLElement>(":scope > .admin-actions"),
    );
    for (const el of detachedActionRows) {
      el.remove();
    }

    for (let i = 0; i < headings.length; i += 1) {
      const heading = headings[i];
      const nextHeading = headings[i + 1] ?? null;
      const details = document.createElement("details");
      details.className = "pp-form-section full";
      details.open = i < openCount;

      const summary = document.createElement("summary");
      summary.className = "pp-form-section__summary";
      summary.textContent = heading.textContent?.trim() || `Section ${i + 1}`;
      details.append(summary);

      const body = document.createElement("div");
      body.className = "pp-form-section__body";
      details.append(body);

      let node = heading.nextElementSibling as HTMLElement | null;
      while (node && node !== nextHeading) {
        const nextNode = node.nextElementSibling as HTMLElement | null;
        body.append(node);
        node = nextNode;
      }

      heading.replaceWith(details);
    }

    for (const el of detachedActionRows) {
      block.appendChild(el);
    }

    block.dataset.collapsibleReady = "1";
  }
}
