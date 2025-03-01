(async function () {
  // 多重実行防止
  if (window.hasRenderedNotebook) return;
  window.hasRenderedNotebook = true;

  // ページURLを取得
  const url = window.location.href;

  try {
    // Fetch APIでデータを取得
    const response = await fetch(url);
    const rawText = await response.text();

    // 先頭・末尾の空白を削除
    const trimmedText = rawText.trim();

    // ログ出力（デバッグ用）
    console.log("trimmedText:", trimmedText);

    // HTMLページと判定された場合は、Notebookレンダリングをスキップ
    if (
      trimmedText.startsWith("<!DOCTYPE") ||
      trimmedText.startsWith("<html")
    ) {
      console.log(
        "HTMLページが検出されたので、Notebookレンダリングはスキップします。"
      );
      return;
    }

    // JSONパース
    const notebook = JSON.parse(trimmedText);
    console.log("Notebook JSON:", notebook);

    // Notebook形式かどうかチェック
    if (!notebook.nbformat || !Array.isArray(notebook.cells)) {
      displayError("このファイルはNotebook形式ではありません。");
      return;
    }

    // Notebookをレンダリング
    renderNotebook(notebook);
  } catch (error) {
    console.error("JSONパースエラー:", error);
    displayError(
      "JSONパースエラー: このファイルはNotebook形式ではありません。"
    );
  }
})();

// Notebookをレンダリングする関数
function renderNotebook(notebook) {
  document.body.innerHTML = "";

  const container = document.createElement("div");
  container.id = "notebook-container";

  // JSONダウンロードボタン
  const downloadBtn = document.createElement("button");
  downloadBtn.id = "download-json-btn";
  downloadBtn.textContent = "JSONをダウンロード";
  downloadBtn.addEventListener("click", () => {
    downloadJSON(notebook);
  });
  container.appendChild(downloadBtn);

  // 目次用コンテナ（左側）
  const tocContainer = document.createElement("div");
  tocContainer.id = "toc-container";
  container.appendChild(tocContainer);

  // Notebookコンテンツ用コンテナ（右側）
  const contentContainer = document.createElement("div");
  contentContainer.id = "notebook-content";
  container.appendChild(contentContainer);

  // 各セルをレンダリング
  notebook.cells.forEach((cell, index) => {
    const cellElement = createCellElement(cell, index);
    contentContainer.appendChild(cellElement);
  });

  // Markdownセル内の見出しから目次を生成
  buildTOC(contentContainer, tocContainer);

  document.body.appendChild(container);

  // シンタックスハイライトの適用
  document.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightBlock(block);
  });
}

// セル生成用関数
function createCellElement(cell, index) {
  const cellDiv = document.createElement("div");
  cellDiv.className = "cell";
  cellDiv.dataset.cellIndex = index;

  // コードセルの場合、実行回数表示
  if (cell.cell_type === "code") {
    const header = document.createElement("div");
    header.className = "cell-header";
    const execCount =
      cell.execution_count !== null ? cell.execution_count : " ";
    header.textContent = `In [${execCount}]`;
    cellDiv.appendChild(header);
  }

  // セル内容を格納するコンテナ
  const contentDiv = document.createElement("div");
  contentDiv.className = "cell-content";

  if (cell.cell_type === "markdown") {
    // Markdownセル：marked.jsを使用してHTML変換
    const htmlContent = marked.parse(cell.source.join(""));
    contentDiv.innerHTML = htmlContent;
  } else if (cell.cell_type === "code") {
    // コードセル：pre/codeタグで表示（主にPython用）
    const codeBlock = document.createElement("pre");
    const codeElem = document.createElement("code");
    codeElem.className = "python";
    codeElem.textContent = cell.source.join("");
    codeBlock.appendChild(codeElem);
    contentDiv.appendChild(codeBlock);

    // 出力セルのレンダリング
    if (cell.outputs && cell.outputs.length > 0) {
      const outputsDiv = document.createElement("div");
      outputsDiv.className = "cell-outputs";
      cell.outputs.forEach((output) => {
        const outputElem = document.createElement("div");
        outputElem.className = "cell-output";
        if (output.output_type === "stream") {
          outputElem.textContent = output.text.join("");
        } else if (
          output.output_type === "display_data" ||
          output.output_type === "execute_result"
        ) {
          if (output.data && output.data["text/plain"]) {
            outputElem.textContent = output.data["text/plain"];
          } else {
            outputElem.textContent = JSON.stringify(output.data);
          }
        } else if (output.output_type === "error") {
          outputElem.textContent = output.ename + ": " + output.evalue;
        }
        outputsDiv.appendChild(outputElem);
      });
      contentDiv.appendChild(outputsDiv);
    }

    // コード折りたたみボタン
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "toggle-code-btn";
    toggleBtn.textContent = "コード折りたたみ";
    toggleBtn.addEventListener("click", () => {
      contentDiv.style.display =
        contentDiv.style.display === "none" ? "" : "none";
    });
    cellDiv.insertBefore(toggleBtn, cellDiv.firstChild);
  } else {
    // その他のセル（rawセルなど）はそのまま表示
    contentDiv.textContent = cell.source.join("");
  }

  cellDiv.appendChild(contentDiv);
  return cellDiv;
}

// 目次（TOC）生成用関数
function buildTOC(contentContainer, tocContainer) {
  const headings = contentContainer.querySelectorAll("h1, h2, h3, h4, h5, h6");
  if (headings.length === 0) {
    tocContainer.style.display = "none";
    return;
  }
  const tocList = document.createElement("ul");
  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = "heading-" + index;
    }
    const li = document.createElement("li");
    li.className = heading.tagName.toLowerCase();
    const link = document.createElement("a");
    link.href = "#" + heading.id;
    link.textContent = heading.textContent;
    li.appendChild(link);
    tocList.appendChild(li);
  });
  tocContainer.appendChild(tocList);
}

// JSONダウンロード用関数
function downloadJSON(notebook) {
  const blob = new Blob([JSON.stringify(notebook, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "notebook.ipynb";
  a.click();
  URL.revokeObjectURL(url);
}

// エラーメッセージ表示用関数
function displayError(message) {
  document.body.innerHTML = `<div class="error-message">${message}</div>`;
}
