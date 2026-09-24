const PANEL_WIDTH = 600;
const PANEL_CONTENT_GAP = 20;

function createIcon(doc, name) {
  const shapes = {
    close: [["path", { d: "M6 6l12 12M18 6 6 18" }]],
    view: [
      ["path", { d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" }],
      ["circle", { cx: "12", cy: "12", r: "3" }],
    ],
    delete: [
      ["path", { d: "M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" }],
    ],
  };
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("icon");
  for (const [tagName, attributes] of shapes[name] || []) {
    const shape = doc.createElementNS("http://www.w3.org/2000/svg", tagName);
    for (const [attribute, value] of Object.entries(attributes)) {
      shape.setAttribute(attribute, value);
    }
    svg.append(shape);
  }
  return svg;
}

function aboutDocumentAreas(doc) {
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const heading =
    headings.find((element) => element.id === "name-about-this-document") ||
    headings.find(
      (element) =>
        element.textContent.trim().toLowerCase() === "about this document",
    );
  if (heading) {
    const section = heading.closest("section");
    return section ? [section] : [];
  }

  const feedback = Array.from(doc.querySelectorAll("div.head dl dt")).find(
    (element) =>
      ["Feedback", "Feedback:", "Participate", "Participate:"].includes(
        element.textContent.trim(),
      ),
  );
  const areas = [];
  for (
    let sibling = feedback?.nextElementSibling;
    sibling && sibling.tagName !== "DT";
    sibling = sibling.nextElementSibling
  ) {
    if (sibling.tagName === "DD") areas.push(sibling);
  }
  return areas;
}

function findGitHubRepository(doc) {
  for (const area of aboutDocumentAreas(doc)) {
    for (const link of area.querySelectorAll("a[href]")) {
      let linkURL;
      try {
        linkURL = new doc.defaultView.URL(
          link.href,
          doc.defaultView.location.href,
        );
      } catch {
        continue;
      }
      if (linkURL.hostname !== "github.com") continue;

      if (area.tagName !== "DD") {
        const context = link.closest("p");
        if (!context) continue;
        const prefix = doc.createRange();
        prefix.selectNodeContents(context);
        prefix.setEndBefore(link);
        if (
          !/Source for this draft[\s\S]*\bcan be found at\s*$/i.test(
            prefix.toString(),
          )
        )
          continue;
      }

      const repositoryPath = linkURL.pathname
        .replace(/\/issues\/?$/i, "")
        .replace(/\/+$/, "");
      const [owner, repository] = repositoryPath.split("/").filter(Boolean);
      if (!owner || !repository) continue;
      return `https://github.com/${owner}/${repository.replace(/\.git$/i, "")}`;
    }
  }
  return null;
}

function findAboutDocumentMailto(doc) {
  for (const area of aboutDocumentAreas(doc)) {
    const mailto = Array.from(area.querySelectorAll("a[href]")).find((link) =>
      /^mailto:/i.test(link.getAttribute("href")),
    );
    if (mailto) return mailto.getAttribute("href");
  }
  return null;
}

function reviewTitle(doc) {
  const rfc = doc.querySelector("dl#identifiers > dd.rfc")?.textContent.trim();
  const name = rfc
    ? `RFC ${rfc}`
    : doc
        .querySelector("dl#identifiers > dd.internet-draft")
        ?.textContent.trim();
  const title = doc.querySelector("h1#title")?.textContent.trim();
  const pathName = decodeURIComponent(
    new doc.defaultView.URL(doc.defaultView.location.href).pathname,
  )
    .split("/")
    .filter(Boolean)
    .pop();
  return `Review of ${name || title || pathName || ""}`;
}

/** Add a selection-triggered Comment button to an RFC HTML document. */
function initCommentButton(doc = document) {
  const existing = doc.querySelector("[data-spec-comment-button]");
  if (existing) return () => {};

  const ui = doc.createElement("div");
  ui.className = "spec-comment-ui";
  doc.body.append(ui);

  const button = doc.createElement("button");
  button.type = "button";
  button.textContent = "Comment";
  button.setAttribute("data-spec-comment-button", "");
  button.setAttribute("aria-label", "Comment on selected text");
  // Keep the document selection when the button is pressed.
  button.addEventListener("mousedown", (event) => event.preventDefault());
  ui.append(button);

  const panel = doc.createElement("aside");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Comment editor");

  const heading = doc.createElement("h2");
  heading.id = "spec-comment-heading";
  heading.textContent = reviewTitle(doc);
  const panelHeader = doc.createElement("header");
  panelHeader.setAttribute("aria-labelledby", heading.id);
  panel.setAttribute("aria-labelledby", heading.id);

  const closeButton = doc.createElement("button");
  closeButton.type = "button";
  closeButton.classList.add("icon-button");
  closeButton.append(createIcon(doc, "close"));
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
    radio.name = "spec-comment-type";
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
      const issueURL = new doc.defaultView.URL(
        `${githubRepository}/issues/new`,
      );
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
      const emailURL = new doc.defaultView.URL(
        mailingListLink,
        doc.defaultView.location.href,
      );
      emailURL.searchParams.set("subject", reviewTitle(doc));
      emailURL.searchParams.set("body", reviewText());
      const emailHref = emailURL.href.replace(
        /([?&](?:subject|body)=)[^&]*/gi,
        (parameter) => parameter.replace(/\+/g, "%20"),
      );
      doc.defaultView.open(emailHref, "_blank", "noopener,noreferrer");
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
    copyReviewButton.disabled = true;
    doc.defaultView.setTimeout(() => {
      copyReviewButton.textContent = "Copy Review";
      copyReviewButton.disabled = false;
    }, 1800);
  });
  actionsPanel.append(copyReviewButton);

  const downloadReviewButton = doc.createElement("button");
  downloadReviewButton.type = "button";
  downloadReviewButton.textContent = "Download Review";
  downloadReviewButton.disabled = true;
  downloadReviewButton.addEventListener("click", () => {
    commitCurrentComment();
    const text = `# ${reviewTitle(doc)}\n\n${reviewText()}`;
    const blob = new doc.defaultView.Blob([text], { type: "text/plain;charset=utf-8" });
    const downloadURL = doc.defaultView.URL.createObjectURL(blob);
    const link = doc.createElement("a");
    const lastSegment = new doc.defaultView.URL(doc.defaultView.location.href)
      .pathname.split("/").filter(Boolean).pop();
    let filenameSegment = lastSegment || "document";
    try {
      filenameSegment = decodeURIComponent(filenameSegment);
    } catch {
      // Keep the encoded path segment if it contains malformed escapes.
    }
    filenameSegment = filenameSegment.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
    link.href = downloadURL;
    link.download = `review-${filenameSegment || "document"}.txt`;
    link.hidden = true;
    ui.append(link);
    link.click();
    link.remove();
    doc.defaultView.setTimeout(() => doc.defaultView.URL.revokeObjectURL(downloadURL), 1000);
    downloadReviewButton.textContent = "Downloading...";
    downloadReviewButton.disabled = true;
    doc.defaultView.setTimeout(() => {
      downloadReviewButton.textContent = "Download Review";
      downloadReviewButton.disabled = false;
    }, 1800);
  });
  actionsPanel.append(downloadReviewButton);

  const commentsButton = doc.createElement("button");
  commentsButton.type = "button";
  commentsButton.setAttribute("data-comment-list-button", "");
  commentsButton.textContent = "No comments";
  commentsButton.setAttribute("aria-label", "No comments");
  commentsButton.classList.add("is-visible");
  commentsButton.addEventListener("mousedown", (event) =>
    event.preventDefault(),
  );
  commentsButton.addEventListener("click", openPanel);

  panelHeader.append(heading, closeButton);
  panel.append(
    panelHeader,
    typeGroup,
    editor,
    addButton,
    commentsList,
    actionsPanel,
  );
  ui.append(panel, commentsButton);

  const comments = [];
  let visible = false;
  let panelOpen = false;
  let changedTocLayout = false;
  let activeSelection = null;
  let nextCommentId = 1;
  let shiftAmount = 0;
  const originalBodyPosition = doc.body.style.position;
  const originalBodyLeft = doc.body.style.left;
  const originalComputedLeft =
    Number.parseFloat(doc.defaultView.getComputedStyle(doc.body).left) || 0;
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
    if (comments.length === 1) return comments[0].text;

    const groups = [];
    for (const comment of comments) {
      let group = groups.at(-1);
      if (!group || group.type !== comment.type) {
        group = { type: comment.type, comments: [] };
        groups.push(group);
      }
      group.comments.push(comment.text);
    }
    return groups
      .map((group) => {
        const heading = `${group.type}${group.comments.length > 1 ? "s" : ""}`;
        return `## ${heading}\n\n${group.comments.join("\n\n")}`;
      })
      .join("\n\n");
  }

  function updateSelectionHighlights() {
    const cssHighlights = doc.defaultView.CSS?.highlights;
    const HighlightConstructor = doc.defaultView.Highlight;
    if (!cssHighlights || !HighlightConstructor) return;

    const types = ["Major Issue", "Minor Issue", "Comment", "Nit"];
    for (const type of types) {
      const name = `spec-comment-${type.toLowerCase().replace(/\s+/g, "-")}`;
      const ranges = comments
        .filter((comment) => comment.type === type && comment.range)
        .map((comment) => comment.range);
      if (ranges.length) {
        cssHighlights.set(name, new HighlightConstructor(...ranges));
      } else {
        cssHighlights.delete(name);
      }
    }
  }

  function sortComments() {
    const typeOrder = {
      "Major Issue": 0,
      "Minor Issue": 1,
      Comment: 2,
      Nit: 3,
    };
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
    downloadReviewButton.disabled = disabled;
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
    const left = Math.max(8, line.left - buttonRect.width - 8);
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
    if (!selection || selection.isCollapsed || !selection.toString().trim())
      return "";

    const start = selection.getRangeAt(0).startContainer;
    const startElement =
      start.nodeType === doc.defaultView.Node.ELEMENT_NODE
        ? start
        : start.parentElement;
    if (!startElement || !doc.body.contains(startElement)) return "";

    const section = startElement.closest("section");
    let heading =
      section &&
      Array.from(section.children).find((element) =>
        /^H[1-6]$/.test(element.tagName),
      );
    if (!section) {
      let ancestor = startElement;
      while (
        ancestor &&
        ancestor !== doc.body &&
        ancestor.tagName !== "MAIN" &&
        !heading
      ) {
        for (
          let sibling = ancestor.previousElementSibling;
          sibling;
          sibling = sibling.previousElementSibling
        ) {
          if (/^H[1-6]$/.test(sibling.tagName)) {
            heading = sibling;
            break;
          }
        }
        ancestor = ancestor.parentElement;
      }
    }
    const sectionId = section?.id || heading?.id;

    const table = startElement.closest("table");
    const figure = startElement.closest("figure");
    const algorithm = startElement.closest("div.algorithm");
    const paragraph = startElement.closest("p");
    const target = table || figure || algorithm || paragraph;
    const targetSection = target?.closest("section") || section;
    let sectionNumber = targetSection
      ?.querySelector(":is(h1, h2, h3, h4) a.selfRef")
      ?.textContent.trim()
      .replace(/\.$/, "");
    if (!section && heading) {
      sectionNumber =
        heading
          .querySelector(":scope > span.secno")
          ?.textContent.trim()
          .replace(/\.$/, "") || heading.textContent.trim();
    }

    let sectionLabel;
    if (sectionId) {
      const appendix = sectionId.match(/^appendix-(.+)$/i);
      if (appendix) {
        sectionLabel = `Appendix ${appendix[1]}`;
      } else if (sectionNumber) {
        sectionLabel = `Section ${sectionNumber}`;
      } else {
        const number = heading
          ?.querySelector(".section-number")
          ?.textContent.trim()
          .replace(/[.\\s]+$/, "");
        sectionLabel = number
          ? `Section ${number}`
          : heading?.textContent.trim() || "Section";
      }
    }

    let targetLabel;
    if (target?.id && (table || figure)) {
      const kind = table ? "Table" : "Figure";
      const captionRef = target.querySelector(
        table ? "caption a.selfRef" : "figcaption a.selfRef",
      );
      const number = captionRef?.textContent
        .trim()
        .match(/(?:figure|table)?\s*(\d+(?:\.\d+)*)/i)?.[1];
      targetLabel = number ? `${kind} ${number}` : kind;
    } else if (algorithm) {
      const stepNumbers = [];
      let listItem = startElement.closest("li");
      while (listItem && algorithm.contains(listItem)) {
        const list = listItem.parentElement;
        if (list?.tagName === "OL") {
          const items = Array.from(list.children).filter(
            (element) => element.tagName === "LI",
          );
          const index = items.indexOf(listItem);
          if (index >= 0) stepNumbers.unshift(index + 1);
        }
        listItem = list?.parentElement?.closest("li") || null;
      }
      const step = stepNumbers.length ? ` step ${stepNumbers.join(".")}` : "";
      targetLabel = `Algorithm "${algorithm.getAttribute("data-algorithm")}"${step}`;
    } else if (paragraph?.id) {
      if (paragraph.parentElement.tagName === "SECTION") {
        const paragraphs = Array.from(paragraph.parentElement.children).filter(
          (element) => element.tagName === "P",
        );
        const paragraphNumber = paragraphs.indexOf(paragraph) + 1;
        if (paragraphNumber > 0) {
          targetLabel = `Paragraph ${paragraphNumber}`;
        }
      }
      targetLabel ??= "this text";
    }

    const quote = selection
      .toString()
      .trim()
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    const sectionLink = sectionId
      ? new URL(`#${encodeURIComponent(sectionId)}`, window.location.href)
      : null;
    let targetLink;
    if (targetLabel && target === algorithm) {
      const algorithmTarget = algorithm.querySelector("dfn[id]") || algorithm;
      if (algorithmTarget.id) {
        targetLink = new URL(
          `#${encodeURIComponent(algorithmTarget.id)}`,
          window.location.href,
        );
      }
    } else if (targetLabel && target?.id) {
      const pilcrowHref = paragraph
        ?.querySelector("a.pilcrow")
        ?.getAttribute("href");
      targetLink = new URL(
        pilcrowHref ? pilcrowHref : `#${encodeURIComponent(target.id)}`,
        window.location.href,
      );
    }
    const targetReference =
      sectionId && targetLabel
        ? ` [${targetLabel}]${targetLink ? `(${targetLink})` : ""}`
        : "";
    const leadIn = sectionLink
      ? `In [${sectionLabel}](${sectionLink})${targetReference}:\n\n`
      : "";
    return `${leadIn}${quote}\n\n`;
  }

  function showCommentText(comment) {
    if (!comment.range || !comment.selection) return;
    closePanel();
    const range = comment.range.cloneRange();
    const selection = doc.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const start =
      range.startContainer.nodeType === doc.defaultView.Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
    start?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderComments() {
    commentsList.replaceChildren();
    comments.forEach((comment) => {
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
      showButton.classList.add("icon-button");
      showButton.append(createIcon(doc, "view"));
      showButton.setAttribute("aria-label", "show text");
      showButton.title = "show text";
      showButton.addEventListener("click", () => showCommentText(comment));

      const deleteButton = doc.createElement("button");
      deleteButton.type = "button";
      deleteButton.classList.add("icon-button");
      deleteButton.append(createIcon(doc, "delete"));
      deleteButton.setAttribute("aria-label", "delete comment");
      deleteButton.title = "delete comment";
      deleteButton.addEventListener("click", () => {
        const commentIndex = comments.findIndex(
          (saved) => saved.id === comment.id,
        );
        if (commentIndex !== -1) comments.splice(commentIndex, 1);
        updateSelectionHighlights();
        renderComments();
      });

      actions.append(showButton, deleteButton);
      headerRow.append(commentType, actions);
      item.append(headerRow, content);
      commentsList.append(item);
    });
    const commentsLabel = comments.length
      ? `Comments (${comments.length})`
      : "No comments";
    commentsButton.textContent = commentsLabel;
    commentsButton.setAttribute("aria-label", commentsLabel);
    commentsButton.classList.add("is-visible");
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
    const panelWidth =
      panel.getBoundingClientRect().width ||
      Math.min(PANEL_WIDTH, viewportWidth);
    const baseLeft = bodyRect.left - shiftAmount;
    const baseRight = bodyRect.right - shiftAmount;
    const leftMargin = Math.max(0, baseLeft);
    const rightMargin = Math.max(0, viewportWidth - baseRight);
    const neededShift = Math.max(0, panelWidth - leftMargin);
    const canShift = neededShift <= rightMargin;
    const contentGap = canShift
      ? Math.min(PANEL_CONTENT_GAP, rightMargin - neededShift)
      : 0;

    setShift(canShift ? neededShift + contentGap : 0);
    adjustToc(shiftAmount);
    panel.style.left = "0px";
  }

  function openPanel() {
    if (!panelOpen) {
      changedTocLayout = doc.body.classList.replace(
        "toc-sidebar",
        "toc-inline",
      );
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
    if (changedTocLayout) {
      doc.body.classList.replace("toc-inline", "toc-sidebar");
      changedTocLayout = false;
    }
    editor.value = "";
    activeSelection = null;
    updateActionButtons();
    setShift(0);
    adjustToc(0);
    button.focus({ preventScroll: true });
  }

  function isEditable(target) {
    return (
      target instanceof doc.defaultView.Element &&
      Boolean(
        target.closest(
          "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
        ),
      )
    );
  }

  function onKeyDown(event) {
    if (
      (event.key === "Escape" ||
        event.key === "Esc" ||
        event.code === "Escape") &&
      panelOpen
    ) {
      event.preventDefault();
      event.stopPropagation();
      closePanel();
      return;
    }
    if (
      event.key.toLowerCase() !== "c" ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      isEditable(event.target)
    )
      return;

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
  editor.addEventListener("keydown", (event) => {
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
  const panelResizeObserver = doc.defaultView.ResizeObserver
    ? new doc.defaultView.ResizeObserver(() => {
        if (panelOpen) layoutPanel();
      })
    : null;
  panelResizeObserver?.observe(panel);

  return () => {
    doc.removeEventListener("selectionchange", update);
    doc.removeEventListener("keydown", onKeyDown, true);
    doc.defaultView.removeEventListener("scroll", reposition);
    doc.defaultView.removeEventListener("resize", reposition);
    panelResizeObserver?.disconnect();
    for (const type of ["Major Issue", "Minor Issue", "Comment", "Nit"]) {
      const name = `spec-comment-${type.toLowerCase().replace(/\s+/g, "-")}`;
      doc.defaultView.CSS?.highlights?.delete(name);
    }
    setShift(0);
    adjustToc(0);
    ui.remove();
  };
}

globalThis.RFCComment ||= {};
globalThis.RFCComment.initCommentButton = initCommentButton;
initCommentButton();
