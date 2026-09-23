const PANEL_WIDTH = 600;

function findGitHubRepository(doc) {
  for (const link of doc.querySelectorAll("a[href]")) {
    let linkURL;
    try {
      linkURL = new doc.defaultView.URL(link.href, doc.defaultView.location.href);
    } catch {
      continue;
    }
    if (linkURL.hostname !== "github.com") continue;

    const context = link.closest("p");
    if (!context) continue;
    const prefix = doc.createRange();
    prefix.selectNodeContents(context);
    prefix.setEndBefore(link);
    if (!/Source for this draft[\s\S]*\bcan be found at\s*$/i.test(prefix.toString())) continue;

    const [owner, repository] = linkURL.pathname.split("/").filter(Boolean);
    if (!owner || !repository) continue;
    return `https://github.com/${owner}/${repository.replace(/\.git$/i, "")}`;
  }
  return null;
}

function findAboutDocumentMailto(doc) {
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const heading = headings.find(element => element.id === "name-about-this-document") ||
    headings.find(element => element.textContent.trim().toLowerCase() === "about this document");
  const section = heading?.closest("section");
  return Array.from(section?.querySelectorAll("a[href]") || [])
    .find(link => (/^mailto:/i).test(link.getAttribute("href")))
    ?.getAttribute("href") || null;
}

function reviewTitle(doc) {
  const name = doc.querySelector("dl#identifiers > dd.rfc")?.textContent.trim() ||
    doc.querySelector("dl#identifiers > dd.internet-draft")?.textContent.trim();
  const pathName = decodeURIComponent(
    new doc.defaultView.URL(doc.defaultView.location.href).pathname,
  ).split("/").filter(Boolean).pop();
  return `Review of ${name || pathName || ""}`;
}

/** Add a selection-triggered Comment button to an RFC HTML document. */
export function initCommentButton(doc = document) {
  const existing = doc.querySelector("[data-rfc-comment-button]");
  if (existing) return () => {};

  const ui = doc.createElement("div");
  ui.className = "comment-ui";
  doc.body.append(ui);

  const button = doc.createElement("button");
  button.type = "button";
  button.textContent = "Comment";
  button.setAttribute("data-rfc-comment-button", "");
  button.setAttribute("aria-label", "Comment on selected text");
  // Keep the document selection when the button is pressed.
  button.addEventListener("mousedown", event => event.preventDefault());
  ui.append(button);

  const panel = doc.createElement("aside");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Comment editor");

  const heading = doc.createElement("h2");
  heading.id = "rfc-comment-heading";
  heading.textContent = reviewTitle(doc);
  const panelHeader = doc.createElement("header");
  panelHeader.setAttribute("aria-labelledby", heading.id);
  panel.setAttribute("aria-labelledby", heading.id);

  const closeButton = doc.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "❌";
  closeButton.title = "Close comment editor";
  closeButton.setAttribute("aria-label", "Close comment editor");

  const typeGroup = doc.createElement("fieldset");
  typeGroup.setAttribute("role", "radiogroup");
  typeGroup.setAttribute("aria-label", "Comment type");
  const typeInputs = new Map();
  const typeLabels = new Map();
  for (const type of ["Major Issue", "Minor Issue", "Comment", "Nit"]) {
    const label = doc.createElement("label");

    const radio = doc.createElement("input");
    radio.type = "radio";
    radio.name = "rfc-comment-type";
    radio.value = type;
    radio.checked = type === "Comment";
    label.setAttribute("data-type", type.toLowerCase().replace(/\s+/g, "-"));

    const labelText = doc.createElement("span");
    labelText.textContent = type;
    radio.addEventListener("change", updateTypeButtons);
    label.append(radio, labelText);
    typeGroup.append(label);
    typeInputs.set(type, radio);
    typeLabels.set(type, label);
  }

  const editor = doc.createElement("textarea");
  editor.setAttribute("aria-label", "Comment text");
  editor.rows = 12;

  const addButton = doc.createElement("button");
  addButton.type = "button";
  addButton.textContent = "Add Comment";

  const commentsList = doc.createElement("div");
  commentsList.setAttribute("aria-label", "Comments");
  commentsList.setAttribute("role", "list");

  const actionsPanel = doc.createElement("footer");
  const githubRepository = findGitHubRepository(doc);
  const mailingListLink = findAboutDocumentMailto(doc);
  let githubIssueButton;
  if (githubRepository) {
    githubIssueButton = doc.createElement("button");
    githubIssueButton.type = "button";
    githubIssueButton.textContent = "Open GitHub Issue";
    githubIssueButton.disabled = true;
    githubIssueButton.addEventListener("click", () => {
      commitCurrentComment();
      const issueURL = new doc.defaultView.URL(`${githubRepository}/issues/new`);
      issueURL.searchParams.set("title", reviewTitle(doc));
      issueURL.searchParams.set("body", reviewText());
      doc.defaultView.open(issueURL.href, "_blank", "noopener,noreferrer");
    });
    actionsPanel.append(githubIssueButton);
  }

  let emailButton;
  if (mailingListLink) {
    emailButton = doc.createElement("button");
    emailButton.type = "button";
    emailButton.textContent = "Email Mailing List";
    emailButton.disabled = true;
    emailButton.addEventListener("click", () => {
      commitCurrentComment();
      const emailURL = new doc.defaultView.URL(mailingListLink, doc.defaultView.location.href);
      emailURL.searchParams.set("subject", reviewTitle(doc));
      emailURL.searchParams.set("body", reviewText());
      doc.defaultView.location.href = emailURL.href;
    });
    actionsPanel.append(emailButton);
  }

  const copyReviewButton = doc.createElement("button");
  copyReviewButton.type = "button";
  copyReviewButton.textContent = "Copy Review";
  copyReviewButton.disabled = true;
  copyReviewButton.addEventListener("click", async () => {
    commitCurrentComment();
    const text = `# ${reviewTitle(doc)}\n\n${reviewText()}`;
    let copied = false;
    try {
      if (doc.defaultView.navigator.clipboard?.writeText) {
        await doc.defaultView.navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      // Try the document copy command below when clipboard access is denied.
    }
    if (!copied && doc.execCommand) {
      const temporary = doc.createElement("textarea");
      temporary.value = text;
      temporary.setAttribute("data-copy-fallback", "");
      ui.append(temporary);
      temporary.select();
      copied = doc.execCommand("copy");
      temporary.remove();
    }
    copyReviewButton.textContent = copied ? "Copied!" : "Copy failed";
    doc.defaultView.setTimeout(() => { copyReviewButton.textContent = "Copy Review"; }, 1800);
  });
  actionsPanel.append(copyReviewButton);

  const commentsButton = doc.createElement("button");
  commentsButton.type = "button";
  commentsButton.setAttribute("data-comment-list-button", "");
  commentsButton.setAttribute("aria-label", "Open saved comments");
  commentsButton.addEventListener("mousedown", event => event.preventDefault());
  commentsButton.addEventListener("click", openPanel);

  panelHeader.append(heading, closeButton);
  panel.append(panelHeader, typeGroup, editor, addButton, commentsList, actionsPanel);
  ui.append(panel, commentsButton);

  const comments = [];
  let visible = false;
  let panelOpen = false;
  let activeSelection = null;
  let nextCommentId = 1;
  let shiftAmount = 0;
  const originalBodyPosition = doc.body.style.position;
  const originalBodyLeft = doc.body.style.left;
  const originalComputedLeft = Number.parseFloat(
    doc.defaultView.getComputedStyle(doc.body).left,
  ) || 0;
  const toc = doc.getElementById("toc");
  const originalTocRight = toc?.style.right ?? "";
  const originalTocVisibility = toc?.style.visibility ?? "";

  function updateTypeButtons() {
    for (const [type, radio] of typeInputs) {
      const label = typeLabels.get(type);
      const selected = radio.checked;
      label.classList.toggle("is-selected", selected);
    }
  }

  function selectedType() {
    return typeGroup.querySelector("input:checked")?.value || "Comment";
  }

  function reviewText() {
    const groups = [];
    for (const comment of comments) {
      let group = groups.at(-1);
      if (!group || group.type !== comment.type) {
        group = { type: comment.type, comments: [] };
        groups.push(group);
      }
      group.comments.push(comment.text);
    }
    return groups.map(group => {
      const heading = `${group.type}${group.comments.length > 1 ? "s" : ""}`;
      return `## ${heading}\n\n${group.comments.join("\n\n")}`;
    }).join("\n\n");
  }

  function updateSelectionHighlights() {
    const cssHighlights = doc.defaultView.CSS?.highlights;
    const HighlightConstructor = doc.defaultView.Highlight;
    if (!cssHighlights || !HighlightConstructor) return;

    const types = ["Major Issue", "Minor Issue", "Comment", "Nit"];
    for (const type of types) {
      const name = `rfc-comment-${type.toLowerCase().replace(/\s+/g, "-")}`;
      const ranges = comments
        .filter(comment => comment.type === type && comment.range)
        .map(comment => comment.range);
      if (ranges.length) {
        cssHighlights.set(name, new HighlightConstructor(...ranges));
      } else {
        cssHighlights.delete(name);
      }
    }
  }

  function sortComments() {
    const typeOrder = { "Major Issue": 0, "Minor Issue": 1, Comment: 2, Nit: 3 };
    comments.sort((a, b) => {
      const typeDifference = typeOrder[a.type] - typeOrder[b.type];
      if (typeDifference) return typeDifference;
      if (a.range && b.range) {
        const position = a.range.compareBoundaryPoints(
          doc.defaultView.Range.START_TO_START,
          b.range,
        );
        if (position) return position;
      } else if (a.range || b.range) {
        return a.range ? -1 : 1;
      }
      return a.id - b.id;
    });
  }

  function updateActionButtons() {
    const disabled = comments.length === 0 && !editor.value.trim();
    if (githubIssueButton) githubIssueButton.disabled = disabled;
    if (emailButton) emailButton.disabled = disabled;
    copyReviewButton.disabled = disabled;
  }

  updateTypeButtons();

  function hide() {
    visible = false;
    button.classList.remove("is-visible");
  }

  function captureSelection() {
    const selection = doc.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return { text: "", range: null };
    }
    return {
      text: selection.toString(),
      range: selection.getRangeAt(0).cloneRange(),
    };
  }

  function update() {
    const selection = doc.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      hide();
      return;
    }

    const range = selection.getRangeAt(0);
    if (!doc.body.contains(range.commonAncestorContainer)) {
      hide();
      return;
    }

    const line = range.getClientRects()[0];
    if (!line) {
      hide();
      return;
    }

    button.classList.add("is-visible");
    const buttonRect = button.getBoundingClientRect();
    const bodyRect = doc.body.getBoundingClientRect();
    const left = Math.max(8, bodyRect.left - buttonRect.width - 12);
    const top = Math.min(
      Math.max(8, line.top + (line.height - buttonRect.height) / 2),
      doc.defaultView.innerHeight - buttonRect.height - 8,
    );
    button.style.left = `${left}px`;
    button.style.top = `${Math.max(8, top)}px`;
    visible = true;
  }

  function setShift(amount) {
    amount = Math.max(0, amount);
    if (amount === shiftAmount) return;
    shiftAmount = amount;
    if (shiftAmount > 0) {
      doc.body.style.position = "relative";
      doc.body.style.left = `${originalComputedLeft + shiftAmount}px`;
    } else {
      doc.body.style.position = originalBodyPosition;
      doc.body.style.left = originalBodyLeft;
    }
  }

  function adjustToc(amount) {
    if (!toc) return;

    // Reset first so viewport changes are measured against the stylesheet's
    // current value, rather than a value adjusted on an earlier resize.
    toc.style.right = originalTocRight;
    toc.style.visibility = originalTocVisibility;
    const style = doc.defaultView.getComputedStyle(toc);
    if (amount <= 0 || style.position !== "fixed") return;

    const right = Number.parseFloat(style.right);
    const adjustedRight = right - amount;
    if (!Number.isFinite(right) || adjustedRight < 0) {
      toc.style.visibility = "hidden";
    } else {
      toc.style.right = `${adjustedRight}px`;
    }
  }

  function commentTemplate(selection = doc.getSelection()) {
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return "";

    const start = selection.getRangeAt(0).startContainer;
    const startElement = start.nodeType === doc.defaultView.Node.ELEMENT_NODE
      ? start
      : start.parentElement;
    if (!startElement || !doc.body.contains(startElement)) return "";

    const section = startElement.closest("section");
    const heading = section && Array.from(section.children).find(element =>
      /^H[1-6]$/.test(element.tagName),
    );
    const sectionId = section?.id || heading?.id;

    const table = startElement.closest("table");
    const figure = startElement.closest("figure");
    const paragraph = startElement.closest("p");
    const target = table || figure || paragraph;
    const targetSection = target?.closest("section") || section;
    const sectionNumber = targetSection
      ?.querySelector(":is(h1, h2, h3, h4) a.selfRef")
      ?.textContent.trim().replace(/\.$/, "");

    let sectionLabel;
    if (sectionId) {
      const appendix = sectionId.match(/^appendix-(.+)$/i);
      if (appendix) {
        sectionLabel = `Appendix ${appendix[1]}`;
      } else if (sectionNumber) {
        sectionLabel = `Section ${sectionNumber}`;
      } else {
        const number = heading?.querySelector(".section-number")?.textContent.trim().replace(/[.\\s]+$/, "");
        sectionLabel = number ? `Section ${number}` : heading?.textContent.trim() || "Section";
      }
    }

    let targetLabel;
    if (target?.id && (table || figure)) {
      const kind = table ? "Table" : "Figure";
      const captionRef = target.querySelector(table
        ? "caption a.selfRef"
        : "figcaption a.selfRef");
      const number = captionRef?.textContent.trim()
        .match(/(?:figure|table)?\s*(\d+(?:\.\d+)*)/i)?.[1];
      targetLabel = number ? `${kind} ${number}` : kind;
    } else if (paragraph?.id) {
      if (paragraph.parentElement.tagName === 'SECTION') {
        const paragraphs = Array.from(paragraph.parentElement.children)
          .filter(element => element.tagName === "P");
        const paragraphNumber = paragraphs.indexOf(paragraph) + 1;
        if (paragraphNumber > 0) {
          targetLabel = `Paragraph ${paragraphNumber}`;
        }
      }
      targetLabel ??= "this text";
    }

    const quote = selection.toString().trim().replace(/\r\n?/g, "\n")
          .split("\n").map(line => `> ${line}`).join("\n");
    const sectionLink = sectionId
      ? new URL(`#${encodeURIComponent(sectionId)}`, window.location.href)
      : null;
    let targetLink;
    if (targetLabel && target?.id) {
      const pilcrowHref = paragraph?.querySelector("a.pilcrow")?.getAttribute("href");
      targetLink = new URL(
        pilcrowHref ? pilcrowHref : `#${encodeURIComponent(target.id)}`,
        window.location.href,
      );
    }
    const targetReference = sectionId && targetLink ? ` [${targetLabel}](${targetLink})` : "";
    const leadIn = sectionLink ? `In [${sectionLabel}](${sectionLink})${targetReference}:\n\n` : "";
    return `${leadIn}${quote}\n\n`;
  }

  function showCommentText(comment) {
    if (!comment.range || !comment.selection) return;
    closePanel();
    const range = comment.range.cloneRange();
    const selection = doc.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const start = range.startContainer.nodeType === doc.defaultView.Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
    start?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderComments() {
    commentsList.replaceChildren();
    comments.forEach((comment, index) => {
      commentsList.append(doc.createElement("hr"));

      const item = doc.createElement("div");
      item.setAttribute("role", "listitem");
      item.classList.add(comment.type.toLowerCase().replace(/\s+/g, "-"));

      const headerRow = doc.createElement("header");

      const content = doc.createElement("pre");
      const commentType = doc.createElement("strong");
      commentType.textContent = comment.type;
      content.textContent = comment.text;

      const actions = doc.createElement("div");
      actions.setAttribute("role", "group");
      actions.setAttribute("aria-label", "Comment actions");

      const showButton = doc.createElement("button");
      showButton.type = "button";
      showButton.textContent = "👁️";
      showButton.setAttribute("aria-label", "show text");
      showButton.title = "show text";
      showButton.addEventListener("click", () => showCommentText(comment));

      const deleteButton = doc.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "🗑️";
      deleteButton.setAttribute("aria-label", "delete comment");
      deleteButton.title = "delete comment";
      deleteButton.addEventListener("click", () => {
        const commentIndex = comments.findIndex(saved => saved.id === comment.id);
        if (commentIndex !== -1) comments.splice(commentIndex, 1);
        updateSelectionHighlights();
        renderComments();
      });

      actions.append(showButton, deleteButton);
      headerRow.append(commentType, actions);
      item.append(headerRow, content);
      commentsList.append(item);
    });
    commentsButton.textContent = `Comments (${comments.length})`;
    commentsButton.classList.toggle("is-visible", comments.length > 0);
    updateActionButtons();
  }

  function commitCurrentComment() {
    if (!editor.value.trim()) return false;
    const selection = activeSelection || captureSelection();
    comments.push({
      id: nextCommentId++,
      type: selectedType(),
      text: editor.value,
      selection: selection.text,
      range: selection.range,
    });
    sortComments();
    updateSelectionHighlights();
    editor.value = "";
    renderComments();
    return true;
  }

  function addComment() {
    if (!commitCurrentComment()) return;
    closePanel();
  }

  function layoutPanel() {
    const bodyRect = doc.body.getBoundingClientRect();
    const viewportWidth = doc.defaultView.innerWidth;
    const panelWidth = Math.min(PANEL_WIDTH, viewportWidth);
    const baseLeft = bodyRect.left - shiftAmount;
    const baseRight = bodyRect.right - shiftAmount;
    const leftMargin = Math.max(0, baseLeft);
    const rightMargin = Math.max(0, viewportWidth - baseRight);
    const neededShift = Math.max(0, panelWidth - leftMargin);
    const canShift = neededShift <= rightMargin;

    setShift(canShift ? neededShift : 0);
    adjustToc(shiftAmount);
    panel.style.left = `${Math.max(0, leftMargin - panelWidth)}px`;
  }

  function openPanel() {
    if (!panelOpen) {
      typeInputs.get("Comment").checked = true;
      updateTypeButtons();
      activeSelection = captureSelection();
      if (!editor.value) editor.value = commentTemplate();
    }
    updateActionButtons();
    panelOpen = true;
    panel.classList.add("is-open");
    layoutPanel();
    editor.focus();
  }

  function closePanel() {
    panelOpen = false;
    panel.classList.remove("is-open");
    editor.value = "";
    activeSelection = null;
    updateActionButtons();
    setShift(0);
    adjustToc(0);
    button.focus({ preventScroll: true });
  }

  function isEditable(target) {
    return target instanceof doc.defaultView.Element && Boolean(
      target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
    );
  }

  function onKeyDown(event) {
    if ((event.key === "Escape" || event.key === "Esc" || event.code === "Escape") && panelOpen) {
      event.preventDefault();
      event.stopPropagation();
      closePanel();
      return;
    }
    if (event.key.toLowerCase() !== "c" || event.ctrlKey || event.altKey || event.metaKey ||
        isEditable(event.target)) return;

    const selection = doc.getSelection();
    if (selection && !selection.isCollapsed && selection.toString()) {
      event.preventDefault();
      openPanel();
    }
  }

  button.addEventListener("click", openPanel);
  closeButton.addEventListener("click", closePanel);
  addButton.addEventListener("click", addComment);
  editor.addEventListener("input", updateActionButtons);
  editor.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      addComment();
    }
  });
  doc.addEventListener("keydown", onKeyDown, true);

  function reposition() {
    if (visible) update();
    if (panelOpen) layoutPanel();
  }

  doc.addEventListener("selectionchange", update);
  doc.defaultView.addEventListener("scroll", reposition, { passive: true });
  doc.defaultView.addEventListener("resize", reposition);

  return () => {
    doc.removeEventListener("selectionchange", update);
    doc.removeEventListener("keydown", onKeyDown, true);
    doc.defaultView.removeEventListener("scroll", reposition);
    doc.defaultView.removeEventListener("resize", reposition);
    for (const type of ["Major Issue", "Minor Issue", "Comment", "Nit"]) {
      const name = `rfc-comment-${type.toLowerCase().replace(/\s+/g, "-")}`;
      doc.defaultView.CSS?.highlights?.delete(name);
    }
    setShift(0);
    adjustToc(0);
    ui.remove();
  };
}

initCommentButton();
