const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function wrapForStylus(title, body) {
  return `/* ${title} */
/* Apply to: linkedin.com */

@-moz-document domain("linkedin.com") {

${body.trim()}

} /* end @-moz-document */
`;
}

const desktopCss = readFileSync(join(root, "content.css"), "utf8");
const androidCss = readFileSync(join(root, "content-android.css"), "utf8");

const desktopStylus = wrapForStylus(
  "JLI LinkedIn Declutter - Desktop Stylus CSS, mirrors packaged content.css",
  desktopCss
);
const androidStylus = wrapForStylus(
  "JLI LinkedIn Declutter - Android Mobile Stylus CSS, generated from content-android.css",
  androidCss
);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JLI Declutter - Stylus CSS</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      max-width: 920px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    h1 { margin-bottom: 10px; color: #0a66c2; }
    h2 { margin-top: 0; }
    .subtitle { color: #666; margin-bottom: 30px; }
    .section {
      background: white;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    textarea {
      width: 100%;
      min-height: 460px;
      font-family: "SF Mono", Monaco, Consolas, monospace;
      font-size: 13px;
      padding: 16px;
      border: 1px solid #ddd;
      border-radius: 8px;
      resize: vertical;
      background: #f8f9fa;
    }
    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    button {
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn-primary { background: #0a66c2; color: white; }
    .btn-primary:hover { background: #084e96; }
    .btn-secondary { background: #e0e0e0; color: #333; }
    .btn-secondary:hover { background: #d0d0d0; }
    .instructions {
      background: #e3f2fd;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .note {
      background: #fff4e5;
      border-left: 4px solid #f5a623;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .instructions ol { margin: 8px 0; padding-left: 24px; }
    .instructions li { margin: 8px 0; }
    code { background: #eef0f2; padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>🔗 JLI LinkedIn Declutter</h1>
  <p class="subtitle">Stylus stylesheets for desktop LinkedIn and Android mobile web LinkedIn</p>

  <div class="instructions">
    <strong>How to use:</strong>
    <ol>
      <li>Install <a href="https://add0n.com/stylus.html" target="_blank" rel="noopener">Stylus</a>.</li>
      <li>Create a new style for <code>linkedin.com</code>.</li>
      <li>Use the desktop sheet on desktop browsers. Use the Android sheet on Android/mobile web.</li>
      <li>Copy the matching CSS below, paste it into Stylus, and save.</li>
    </ol>
  </div>

  <div class="note">
    <strong>No choices.</strong> The desktop stylesheet mirrors the packaged extension <code>content.css</code>.
    The Android stylesheet is generated from <code>content-android.css</code> because mobile LinkedIn uses different markup
    and hover/collapse behavior is unreliable on touch screens.
  </div>

  <div class="section">
    <h2>Desktop CSS — matches packaged <code>content.css</code></h2>
    <textarea id="desktopOutput" readonly>${escapeHtml(desktopStylus)}</textarea>
    <div class="button-group">
      <button class="btn-primary" onclick="copyCSS(event, 'desktopOutput')">Copy Desktop CSS</button>
      <button class="btn-secondary" onclick="downloadCSS('desktopOutput', 'jli-linkedin-declutter-desktop.css')">Download Desktop .css</button>
    </div>
  </div>

  <!--
  Android Mobile CSS is intentionally hidden for now.
  The source remains in content-android.css, but the rules need more testing before
  exposing them on this page.

  <div class="section">
    <h2>Android Mobile CSS — generated from <code>content-android.css</code></h2>
    <p>This sheet hides instead of collapses. It targets Android/mobile LinkedIn feed cards, sponsored cards, app upsells, and mobile social-context posts.</p>
    <textarea id="androidOutput" readonly>${escapeHtml(androidStylus)}</textarea>
    <div class="button-group">
      <button class="btn-primary" onclick="copyCSS(event, 'androidOutput')">Copy Android CSS</button>
      <button class="btn-secondary" onclick="downloadCSS('androidOutput', 'jli-linkedin-declutter-android.css')">Download Android .css</button>
    </div>
  </div>
  -->

  <script>
    function copyCSS(event, textareaId) {
      const output = document.getElementById(textareaId);
      output.select();
      document.execCommand('copy');

      const btn = event.target;
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    }

    function downloadCSS(textareaId, filename) {
      const css = document.getElementById(textareaId).value;
      const blob = new Blob([css], { type: 'text/css' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>
`;

writeFileSync(join(root, "docs", "css-generator.html"), html);
console.log("Generated docs/css-generator.html");
