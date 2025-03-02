// 即時実行の非同期関数で処理開始
(async function initNotebookRenderer() {
  // 多重実行防止
  if (window.hasRenderedNotebook) return;
  window.hasRenderedNotebook = true;

  const url = window.location.href;
  try {
    const notebook = await fetchNotebookData(url);
    if (!notebook) return; // HTMLページ等の場合は処理終了

    renderNotebook(notebook);
  } catch (error) {
    console.error("Notebookレンダリング中にエラーが発生しました:", error);
    displayError(
      "JSONパースエラー: このファイルはNotebook形式ではありません。"
    );
  }
})();

// URLからNotebookデータを取得してパースする関数
async function fetchNotebookData(url) {
  const response = await fetch(url);
  const rawText = await response.text();
  const trimmedText = rawText.trim();
  console.log("trimmedText:", trimmedText);

  // もしHTMLページならNotebookレンダリングをスキップ
  if (trimmedText.startsWith("<!DOCTYPE") || trimmedText.startsWith("<html")) {
    console.log(
      "HTMLページが検出されたので、Notebookレンダリングはスキップします。"
    );
    return null;
  }

  let notebook;
  try {
    notebook = JSON.parse(trimmedText);
  } catch (error) {
    console.error("JSONパースエラー:", error);
    displayError(
      "JSONパースエラー: このファイルはNotebook形式ではありません。"
    );
    return null;
  }

  // Notebook形式かどうかチェック
  if (!notebook.nbformat || !Array.isArray(notebook.cells)) {
    displayError("このファイルはNotebook形式ではありません。");
    return null;
  }

  console.log("Notebook JSON:", notebook);
  return notebook;
}

// Notebook全体をレンダリングする関数
function renderNotebook(notebook) {
  // 画面の初期化
  document.body.innerHTML = "";

  // Notebook全体を包むコンテナ作成
  const container = document.createElement("div");
  container.id = "notebook-container";

  // ダウンロードボタン作成
  const downloadBtn = document.createElement("button");
  downloadBtn.id = "download-json-btn";
  downloadBtn.textContent = "ipynbファイルをダウンロード";
  downloadBtn.addEventListener("click", () => downloadJSON(notebook));
  container.appendChild(downloadBtn);

  // 目次用コンテナ（左側）作成
  const tocContainer = document.createElement("div");
  tocContainer.id = "toc-container";
  container.appendChild(tocContainer);

  // Notebookコンテンツ用コンテナ（右側）作成
  const contentContainer = document.createElement("div");
  contentContainer.id = "notebook-content";
  container.appendChild(contentContainer);

  // 各セルを順次レンダリング
  notebook.cells.forEach((cell, index) => {
    const cellElement = createCellElement(cell, index);
    contentContainer.appendChild(cellElement);
  });

  // Markdownセル内の見出しから目次を生成
  buildTOC(contentContainer, tocContainer);

  // コンテナを画面に追加
  document.body.appendChild(container);

  // コードセルにシンタックスハイライトを適用
  document.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightBlock(block);
  });
}

// 各NotebookセルのHTML要素を生成する関数
function createCellElement(cell, index) {
  const cellDiv = document.createElement("div");
  cellDiv.className = "cell";
  cellDiv.dataset.cellIndex = index;

  // コードセルの場合、実行回数のヘッダーを追加
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
    // Markdownセルの場合：marked.jsでHTMLに変換
    const htmlContent = marked.parse(cell.source.join(""));
    contentDiv.innerHTML = htmlContent;
  } else if (cell.cell_type === "code") {
    // コードセルの場合：pre/codeタグで表示
    const codeBlock = document.createElement("pre");
    const codeElem = document.createElement("code");
    codeElem.className = "python";
    codeElem.textContent = cell.source.join("");
    codeBlock.appendChild(codeElem);
    contentDiv.appendChild(codeBlock);

    // セルの出力（実行結果やエラーなど）を表示
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
          outputElem.textContent =
            output.data && output.data["text/plain"]
              ? output.data["text/plain"]
              : JSON.stringify(output.data);
        } else if (output.output_type === "error") {
          outputElem.textContent = `${output.ename}: ${output.evalue}`;
        }
        outputsDiv.appendChild(outputElem);
      });
      contentDiv.appendChild(outputsDiv);
    }

    // コード折りたたみボタンを追加
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "toggle-code-btn";
    toggleBtn.textContent = "コード折りたたみ";
    toggleBtn.addEventListener("click", () => {
      contentDiv.style.display =
        contentDiv.style.display === "none" ? "" : "none";
    });
    cellDiv.insertBefore(toggleBtn, cellDiv.firstChild);
  } else {
    // その他のセル（rawなど）はそのままテキスト表示
    contentDiv.textContent = cell.source.join("");
  }

  cellDiv.appendChild(contentDiv);
  return cellDiv;
}

// Markdownセル内の見出しから目次（TOC）を生成する関数
function buildTOC(contentContainer, tocContainer) {
  const headings = contentContainer.querySelectorAll("h1, h2, h3, h4, h5, h6");
  if (headings.length === 0) {
    tocContainer.style.display = "none";
    return;
  }

  const tocList = document.createElement("ul");
  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = `heading-${index}`;
    }
    const li = document.createElement("li");
    li.className = heading.tagName.toLowerCase();
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    li.appendChild(link);
    tocList.appendChild(li);
  });
  tocContainer.appendChild(tocList);
}

// Notebook JSONをダウンロードするための関数
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

// エラーメッセージを表示するための関数
function displayError(message) {
  document.body.innerHTML = `<div class="error-message">${message}</div>`;
}
