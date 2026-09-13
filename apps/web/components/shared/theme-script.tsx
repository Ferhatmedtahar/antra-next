const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("antra-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export function ThemeScript() {
  // eslint-disable-next-line react/no-danger -- inline script must run before paint
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
