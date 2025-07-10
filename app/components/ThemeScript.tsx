// app/components/ThemeScript.tsx

// This component is a self-invoking function that runs immediately.
// It's placed in the <head> of the document to prevent any theme flicker.
const ThemeScript = () => {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('theme');
        if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (_) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{__html: script}} />;
};

export default ThemeScript;
